import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { FlexCol } from "@components/Flex";
import useRequest from "@hooks/request";
import useError from "@hooks/error";
import { Application, Character } from "@shared/contracts";
import { User } from "@shared/contracts";
import { useSseSubscription } from "@hooks/sse";
import { formatClientDateTime } from "@/core/datetime";
import { useDataContext } from "@/contexts/dataContext";
import { ensurePushSubscription } from "@/utils/push";

type TErrorLogRow = {
  id?: number;
  createdAt: number;
  source: "backend" | "frontend";
  level: "error" | "warn" | "info";
  uid: string | null;
  uname: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  message: string;
  stack: string | null;
  requestJson: string | null;
  responseJson: string | null;
  metaJson: string | null;
};

type TRuntimeSnapshot = {
  onlineUsers: Array<{ uid: string; name: string; active: boolean }>;
  activeAdventures: Array<{ uid: string; advId: string }>;
  runtimeCache: Array<{
    advId: string;
    users: string[];
    hasAdventure: boolean;
    characterCount: number;
    characters?: Array<{ uid: string; hash: string }>;
    allCharactersLoaded: boolean;
    combat: { enabled: boolean; turn: number };
    lastAccessTs: number;
  }>;
  timestamp: number;
};

type TGeneralIconProps = {
  className?: string;
};

type TPushSendResult = {
  attempted: number;
  sent: number;
  removed: number;
  failed: number;
};

const generalIconModules = import.meta.glob<{
  default: ComponentType<TGeneralIconProps>;
}>("../components/icons/general/*.tsx", { eager: true });

const magusIconModules = import.meta.glob<{
  default: ComponentType<TGeneralIconProps>;
}>("../components/icons/magus/*.tsx", { eager: true });

const iconEntries = [
  ...Object.entries(generalIconModules).map(([path, module]) => ({
    Icon: module.default,
    group: "general",
    name: path.split("/").pop()?.replace(/\.tsx$/, "") || path,
  })),
  ...Object.entries(magusIconModules).map(([path, module]) => ({
    Icon: module.default,
    group: "magus",
    name: path.split("/").pop()?.replace(/\.tsx$/, "") || path,
  })),
]
  .sort((a, b) => a.name.localeCompare(b.name));

export default function Dev() {
  const { user, classes, refreshCharacterBootstrap } = useDataContext();
  const isSuperAdmin = user?.json?.rank === User.USER_RANK.SUPERADMIN;
  const [restRequest] = useRequest(Application.REQUEST_CONTROLLER.REST);
  const [adventureRequest] = useRequest(Application.REQUEST_CONTROLLER.ADVENTURES);
  const [characterRequest] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [pushRequest] = useRequest(Application.REQUEST_CONTROLLER.PUSH);
  const { setError } = useError();
  const [rows, setRows] = useState<TErrorLogRow[]>([]);
  const [runtime, setRuntime] = useState<TRuntimeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clearCacheBusy, setClearCacheBusy] = useState(false);
  const [refreshHashesBusy, setRefreshHashesBusy] = useState(false);
  const [runPatchesBusy, setRunPatchesBusy] = useState(false);
  const [cacheAdvId, setCacheAdvId] = useState("");
  const [spellImportClassId, setSpellImportClassId] = useState("");
  const [spellImportSpec, setSpellImportSpec] = useState("common");
  const [spellImportFile, setSpellImportFile] = useState<File | null>(null);
  const [spellImportBusy, setSpellImportBusy] = useState(false);
  const [secondaryImportClassId, setSecondaryImportClassId] = useState("");
  const [secondaryImportFile, setSecondaryImportFile] = useState<File | null>(null);
  const [secondaryImportBusy, setSecondaryImportBusy] = useState(false);
  const [pushTitle, setPushTitle] = useState("MAGUS");
  const [pushBody, setPushBody] = useState("Test push notification");
  const [pushMessage, setPushMessage] = useState("Dev push test");
  const [pushStatus, setPushStatus] = useState("Not checked");
  const [pushBusy, setPushBusy] = useState(false);

  const selectedSpellImportClass = classes.find((entry) => entry.id === spellImportClassId);
  const spellImportSpecs = [
    "common",
    ...((selectedSpellImportClass?.specs || [])
      .map((spec) => String(spec.name || "").trim())
      .filter(Boolean)),
  ];

  const normalizeImportedSpell = (
    input: unknown,
    index: number
  ): Character.Spell.TSpellElements => {
    if (!input || typeof input !== "object") {
      throw new Error(`Spell at index ${index} is not an object`);
    }
    const raw = input as Partial<Character.Spell.TSpellElements>;
    const name = String(raw.name || "").trim();
    if (!name) throw new Error(`Spell at index ${index} is missing name`);
    return {
      id: String(raw.id || `${Date.now()}-${index}`),
      name,
      lvlReq: Math.max(0, Number(raw.lvlReq || 0)),
      description: String(raw.description || ""),
      resourceCost: Math.max(0, Number(raw.resourceCost || 0)),
      spec: spellImportSpec,
      imgSrc: raw.imgSrc ? String(raw.imgSrc) : undefined,
      passive: Boolean(raw.passive),
      type:
        raw.type === "heal" || raw.type === "utility" || raw.type === "damage"
          ? raw.type
          : "damage",
      nrOfTurns: Math.max(0, Number(raw.nrOfTurns || 0)),
      nrOfTurnsToCast: Math.max(0, Number(raw.nrOfTurnsToCast || 0)),
      range: Math.max(0, Number(raw.range || 0)),
      class: raw.class || Character.Spell.SPELL_CLASSES.FIRE,
      parentId: String(raw.parentId || "0"),
      levels: Array.isArray(raw.levels) ? raw.levels : [],
    };
  };

  const importSpells = async () => {
    if (!spellImportClassId) {
      setError("Select a class before importing spells.");
      return;
    }
    if (!spellImportSpec) {
      setError("Select a specialization before importing spells.");
      return;
    }
    if (!spellImportFile) {
      setError("Select a spell JSON file before importing.");
      return;
    }

    try {
      setSpellImportBusy(true);
      const text = await spellImportFile.text();
      const parsed = JSON.parse(text) as unknown;
      const rawSpells = Array.isArray(parsed) ? parsed : [parsed];
      const importedSpells = rawSpells.map((spell, index) =>
        normalizeImportedSpell(spell, index)
      );
      if (importedSpells.length < 1) {
        setError("Spell JSON did not contain any spells.");
        return;
      }

      const classResponse = await characterRequest<Character.TClass & { hash: string }>({
        endPoint: "/getClass",
        body: { classId: spellImportClassId },
      });
      const selectedClass = classResponse.data;
      const nextSpells = [...(selectedClass.spells || []), ...importedSpells];
      await characterRequest({
        endPoint: "/updateClass",
        body: {
          expectedHash: selectedClass.hash,
          patch: [{ op: "replace", path: "/spells", value: nextSpells }],
        },
      });
      setSpellImportFile(null);
      await refreshCharacterBootstrap();
      setError(`Imported ${importedSpells.length} spell(s).`);
    } catch (error) {
      setError(`Failed to import spells: ${error}`);
    } finally {
      setSpellImportBusy(false);
    }
  };

  const normalizeSecondaryStatName = (value: unknown): Character.SECONDARY_STATS => {
    const text = String(value || "").trim();
    const byKey = (Character.SECONDARY_STATS as Record<string, Character.SECONDARY_STATS>)[text];
    if (byKey) return byKey;
    const byValue = Object.values(Character.SECONDARY_STATS).find((entry) => entry === text);
    if (byValue) return byValue;
    throw new Error(`Unknown secondary skill: ${text || "(empty)"}`);
  };

  const normalizeSecondaryStatLevel = (value: unknown): Character.SECONDARY_STAT_LEVEL => {
    const text = String(value || "").trim();
    const byKey = (Character.SECONDARY_STAT_LEVEL as Record<string, Character.SECONDARY_STAT_LEVEL>)[text];
    if (byKey) return byKey;
    const byValue = Object.values(Character.SECONDARY_STAT_LEVEL).find((entry) => entry === text);
    if (byValue) return byValue;
    throw new Error(`Unknown secondary skill level: ${text || "(empty)"}`);
  };

  const normalizeImportedSecondaryStat = (
    input: unknown,
    index: number
  ): Character.TSecondaryStat => {
    if (!input || typeof input !== "object") {
      throw new Error(`Secondary skill at index ${index} is not an object`);
    }
    const raw = input as Partial<Character.TSecondaryStat>;
    const name = normalizeSecondaryStatName(raw.name);
    const skillLevel = normalizeSecondaryStatLevel(
      raw.skillLevel || Character.SECONDARY_STAT_LEVEL.NONE
    );
    return {
      id: String(raw.id || `${secondaryImportClassId}-${name}-${index}`),
      name,
      lvlReq: Math.max(0, Math.floor(Number(raw.lvlReq || 0))),
      skillLevel,
      skill: Math.max(0, Math.floor(Number(raw.skill || 0))),
    };
  };

  const importSecondarySkills = async () => {
    if (!secondaryImportClassId) {
      setError("Select a class before importing secondary skills.");
      return;
    }
    if (!secondaryImportFile) {
      setError("Select a secondary skills JSON file before importing.");
      return;
    }

    try {
      setSecondaryImportBusy(true);
      const text = await secondaryImportFile.text();
      const parsed = JSON.parse(text) as unknown;
      const selectedClass = classes.find((entry) => entry.id === secondaryImportClassId);
      const rawStats =
        Array.isArray(parsed)
          ? parsed
          : selectedClass &&
            parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as Record<string, unknown>)[selectedClass.name])
          ? ((parsed as Record<string, unknown>)[selectedClass.name] as unknown[])
          : [];
      const importedStats = rawStats.map((stat, index) =>
        normalizeImportedSecondaryStat(stat, index)
      );
      if (importedStats.length < 1) {
        setError("Secondary skills JSON did not contain any skills for the selected class.");
        return;
      }

      const classResponse = await characterRequest<Character.TClass & { hash: string }>({
        endPoint: "/getClass",
        body: { classId: secondaryImportClassId },
      });
      const latestClass = classResponse.data;
      await characterRequest({
        endPoint: "/updateClass",
        body: {
          expectedHash: latestClass.hash,
          patch: [
            {
              op: "replace",
              path: "/modifiers",
              value: {
                ...latestClass.modifiers,
                secondaryStats: importedStats,
              },
            },
          ],
        },
      });
      setSecondaryImportFile(null);
      await refreshCharacterBootstrap();
      setError(`Imported ${importedStats.length} secondary skill(s).`);
    } catch (error) {
      setError(`Failed to import secondary skills: ${error}`);
    } finally {
      setSecondaryImportBusy(false);
    }
  };

  const unsubscribePush = async () => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushStatus("Push is not supported in this browser.");
      return;
    }
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setPushStatus("No local push subscription found.");
        return;
      }
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await pushRequest({
        endPoint: "/unsubscribe",
        body: { endpoint },
      });
      setPushStatus("Push subscription removed.");
    } catch (error) {
      setError(`Failed to unsubscribe push: ${error}`);
      setPushStatus("Push unsubscribe failed.");
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestPush = async () => {
    setPushBusy(true);
    try {
      const subscription = await ensurePushSubscription(pushRequest);
      setPushStatus(
        subscription.configured
          ? "Push subscription active."
          : "Push subscription active with ephemeral dev VAPID keys."
      );
      const response = await pushRequest<TPushSendResult>({
        endPoint: "/test",
        body: {
          title: pushTitle,
          body: pushBody,
          message: pushMessage,
          url: "/dev",
        },
      });
      setPushStatus(
        `Push attempted: ${response.data.attempted}, sent: ${response.data.sent}, removed: ${response.data.removed}, failed: ${response.data.failed}`
      );
    } catch (error) {
      setError(`Failed to send test push: ${error}`);
      setPushStatus("Push test failed.");
    } finally {
      setPushBusy(false);
    }
  };

  const load = () => {
    setIsLoading(true);
    Promise.all([
      restRequest<TErrorLogRow[]>({
        endPoint: "/getErrorLogs",
        body: { limit: 200 },
      }),
      restRequest<TRuntimeSnapshot>({
        endPoint: "/getRuntimeState",
        body: {},
      }),
    ])
      .then(([errorsResp, runtimeResp]) => {
        setRows(Array.isArray(errorsResp.data) ? errorsResp.data : []);
        setRuntime(runtimeResp.data || null);
      })
      .catch((error) => {
        setError(`Failed to load dev data: ${error}`);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useSseSubscription("dev:runtime", (event) => {
    const payload = event.payload as TRuntimeSnapshot | undefined;
    if (!payload || typeof payload !== "object") return;
    setRuntime(payload);
  });

  return (
    <FlexCol className="w-full h-full min-h-0 fancy-container p-2 gap-1">
      <div className="flex items-center justify-between">
        <p className="font-bold">Dev Panel</p>
        <div className="flex items-center gap-1">
          <input
            className="px-2 py-1 rounded text-black"
            placeholder="Adventure ID"
            value={cacheAdvId}
            onInput={(e) => setCacheAdvId((e.currentTarget as HTMLInputElement).value)}
          />
          <button
            className="fancy-container px-2 py-1"
            onClick={() => {
              const advId = cacheAdvId.trim();
              if (!advId) {
                setError("Adventure ID is required to clear cache.");
                return;
              }
              setClearCacheBusy(true);
              adventureRequest<{ ok: boolean; scope: string; advId?: string }>({
                endPoint: "/cache/clear",
                body: { advId },
              })
                .then(() => load())
                .catch((error) => {
                  setError(`Failed to clear adventure cache: ${error}`);
                })
                .finally(() => setClearCacheBusy(false));
            }}
            type="button"
            disabled={clearCacheBusy}
          >
            {clearCacheBusy ? "Clearing..." : "Clear Adv Cache"}
          </button>
          <button
            className="fancy-container px-2 py-1"
            onClick={() => {
              setRefreshHashesBusy(true);
              restRequest<{ ok: boolean; updatedCharacters: number; runtime: TRuntimeSnapshot }>({
                endPoint: "/refreshRuntimeCharacterHashes",
                body: {},
              })
                .then((resp) => {
                  if (resp.data?.runtime) {
                    setRuntime(resp.data.runtime);
                  } else {
                    load();
                  }
                })
                .catch((error) => {
                  setError(`Failed to refresh runtime character hashes: ${error}`);
                })
                .finally(() => setRefreshHashesBusy(false));
            }}
            type="button"
            disabled={refreshHashesBusy}
          >
            {refreshHashesBusy ? "Refreshing..." : "Refresh Char Hashes"}
          </button>
          {isSuperAdmin ? (
            <button
              className="fancy-container px-2 py-1"
              onClick={() => {
                setRunPatchesBusy(true);
                restRequest<{ ok: boolean; applied: unknown[]; pending: unknown[] }>({
                  endPoint: "/runPendingPatchesAsSuperadmin",
                  body: {},
                })
                  .then((resp) => {
                    const appliedCount = Array.isArray(resp.data?.applied)
                      ? resp.data.applied.length
                      : 0;
                    setError(`Patch runner completed. Applied: ${appliedCount}`);
                    load();
                  })
                  .catch((error) => {
                    setError(`Failed to run pending patches: ${error}`);
                  })
                  .finally(() => setRunPatchesBusy(false));
              }}
              type="button"
              disabled={runPatchesBusy}
            >
              {runPatchesBusy ? "Running Patches..." : "Run Pending Patches"}
            </button>
          ) : null}
          <button className="fancy-container px-2 py-1" onClick={load} type="button">
            Refresh
          </button>
        </div>
      </div>
      <div className="fancy-container p-1 flex items-end gap-1 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label>Spell class</label>
          <select
            className="text-black px-2 py-1 rounded min-w-[180px]"
            value={spellImportClassId}
            onChange={(e) => {
              const nextClassId = (e.currentTarget as HTMLSelectElement).value;
              setSpellImportClassId(nextClassId);
              setSpellImportSpec("common");
            }}
          >
            <option value="">Select class</option>
            {classes.map((entry) => (
              <option key={`spell-import-class-${entry.id}`} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label>Specialization</label>
          <select
            className="text-black px-2 py-1 rounded min-w-[180px]"
            value={spellImportSpec}
            onChange={(e) => setSpellImportSpec((e.currentTarget as HTMLSelectElement).value)}
          >
            {spellImportSpecs.map((spec) => (
              <option key={`spell-import-spec-${spec}`} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label>Spell JSON</label>
          <input
            type="file"
            accept="application/json,.json"
            className="text-black px-2 py-1 rounded"
            onChange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0] || null;
              setSpellImportFile(file);
            }}
          />
        </div>
        <button
          className="fancy-container px-2 py-1"
          type="button"
          disabled={spellImportBusy}
          onClick={() => void importSpells()}
        >
          {spellImportBusy ? "Uploading..." : "Upload Spells"}
        </button>
      </div>
      <div className="fancy-container p-1 flex items-end gap-1 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label>Secondary skills class</label>
          <select
            className="text-black px-2 py-1 rounded min-w-[180px]"
            value={secondaryImportClassId}
            onChange={(e) =>
              setSecondaryImportClassId((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="">Select class</option>
            {classes.map((entry) => (
              <option key={`secondary-import-class-${entry.id}`} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label>Secondary skills JSON</label>
          <input
            type="file"
            accept="application/json,.json"
            className="text-black px-2 py-1 rounded"
            onChange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0] || null;
              setSecondaryImportFile(file);
            }}
          />
        </div>
        <button
          className="fancy-container px-2 py-1"
          type="button"
          disabled={secondaryImportBusy}
          onClick={() => void importSecondarySkills()}
        >
          {secondaryImportBusy ? "Uploading..." : "Upload Secondary Skills"}
        </button>
      </div>
      <div className="fancy-container p-1 flex items-end gap-1 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label>Push title</label>
          <input
            className="text-black px-2 py-1 rounded min-w-[180px]"
            value={pushTitle}
            onInput={(e) => setPushTitle((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label>Push body</label>
          <input
            className="text-black px-2 py-1 rounded min-w-[220px]"
            value={pushBody}
            onInput={(e) => setPushBody((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label>Push message</label>
          <input
            className="text-black px-2 py-1 rounded min-w-[220px]"
            value={pushMessage}
            onInput={(e) => setPushMessage((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <button
          className="fancy-container px-2 py-1"
          type="button"
          disabled={pushBusy}
          onClick={() => void sendTestPush()}
        >
          {pushBusy ? "Pushing..." : "Push"}
        </button>
        <button
          className="fancy-container px-2 py-1"
          type="button"
          disabled={pushBusy}
          onClick={() => void unsubscribePush()}
        >
          Disable Push
        </button>
        <p className="min-w-[220px]">{pushStatus}</p>
      </div>
      <div className="fancy-container p-1">
        <p className="font-bold mb-1">Icons ({iconEntries.length})</p>
        <div className="flex flex-row gap-1 overflow-x-auto pb-1">
          {iconEntries.map(({ Icon, group, name }) => (
            <div
              key={`${group}-icon-${name}`}
              className="fancy-container p-1 flex shrink-0 flex-col items-center justify-center gap-1 min-h-[72px] w-[120px]"
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs text-center break-all">
                {group}/{name}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grow min-h-0 overflow-auto grid grid-cols-1 xl:grid-cols-2 gap-1">
        <div className="fancy-container p-1 min-h-0 overflow-auto">
          <p className="font-bold mb-1">
            Runtime Snapshot {runtime?.timestamp ? `(${formatClientDateTime(runtime.timestamp)})` : ""}
          </p>
          {runtime ? (
            <>
              <p>Online users: {runtime.onlineUsers.length}</p>
              {runtime.onlineUsers.map((u) => (
                <p key={`online-${u.uid}`}>
                  {u.uid} ({u.name}) - {u.active ? "active" : "inactive"}
                </p>
              ))}
              <hr className="fancy my-1" />
              <p>Active adventures by user: {runtime.activeAdventures.length}</p>
              {runtime.activeAdventures.map((a) => (
                <p key={`active-${a.uid}-${a.advId}`}>
                  {a.uid} {"->"} {a.advId}
                </p>
              ))}
              <hr className="fancy my-1" />
              <p>Runtime cache buckets: {runtime.runtimeCache.length}</p>
              {runtime.runtimeCache.map((bucket) => (
                <div key={`bucket-${bucket.advId}`} className="fancy-container p-1 mb-1">
                  <p>adv: {bucket.advId}</p>
                  <p>users: {bucket.users.join(", ") || "-"}</p>
                  <p>
                    hasAdventure: {String(bucket.hasAdventure)} | chars: {bucket.characterCount} | loaded:{" "}
                    {String(bucket.allCharactersLoaded)}
                  </p>
                  {(bucket.characters || []).length > 0 ? (
                    <>
                      <p>cached hashes:</p>
                      {(bucket.characters || []).map((c) => (
                        <p key={`bucket-char-${bucket.advId}-${c.uid}`} className="text-xs break-all">
                          {c.uid} | hash: {c.hash}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p>cached hashes: none</p>
                  )}
                  <p>
                    combat: {bucket.combat.enabled ? "on" : "off"} turn {bucket.combat.turn}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <p>No runtime snapshot.</p>
          )}
        </div>

        <div className="fancy-container p-1 min-h-0 overflow-auto">
          <p className="font-bold mb-1">Error Logs ({rows.length})</p>
          {isLoading ? (
            <p>Loading...</p>
          ) : rows.length === 0 ? (
            <p>No errors found.</p>
          ) : (
            rows.map((row, idx) => (
              <div key={`${row.createdAt}-${row.id || idx}`} className="fancy-container p-1 mb-1">
                <p>
                  [{formatClientDateTime(row.createdAt)}] {row.level.toUpperCase()} {row.source.toUpperCase()}{" "}
                  {row.statusCode ? `(${row.statusCode})` : ""}
                </p>
                <p>
                  user: {row.uname || row.uid || "-"} | {row.method || "-"} {row.path || "-"}
                </p>
                <p className="break-words">{row.message}</p>
                {row.stack ? <pre className="text-xs whitespace-pre-wrap break-words">{row.stack}</pre> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </FlexCol>
  );
}
