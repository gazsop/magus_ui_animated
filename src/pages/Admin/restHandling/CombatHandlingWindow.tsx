import { useEffect, useMemo, useState } from "preact/hooks";
import { Combat, Npc, ServerApi } from "@shared/contracts";
import RndContainer from "@components/RndContainer";
import { ButtonUnq, InputUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import { buildTopLevelDiffPatch } from "@/core/api/patch";
import { debugLog } from "@/core/logger";
import { isConflictError } from "@/core/api/httpClient";
import { TCloseProps, TRestRequest, TSetError, toErrorMessage } from "./types";

type TCombatResponse = ServerApi.RestRoutes.GetAllCombatsResponse & {
  combat?: Combat.TCombat;
};

type TCombatHandlingWindowProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

const emptyCombat = (): Combat.TCombat => ({
  id: "",
  name: "",
  adminNote: "",
  friendlyNpcs: [],
  enemyNpcs: [],
});

const cloneCombat = (combat: Combat.TCombat): Combat.TCombat =>
  JSON.parse(JSON.stringify(combat)) as Combat.TCombat;

export default function CombatHandlingWindow({
  close,
  requestData,
  setError,
}: TCombatHandlingWindowProps) {
  const [combats, setCombats] = useState<Combat.TCombat[]>([]);
  const [npcs, setNpcs] = useState<Npc.TNpc[]>([]);
  const [hash, setHash] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Combat.TCombat>(emptyCombat);
  const [selectedNpcId, setSelectedNpcId] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedCombat = useMemo(
    () => combats.find((combat) => combat.id === selectedId) || null,
    [combats, selectedId]
  );

  const load = async () => {
    const [combatResponse, npcResponse] = await Promise.all([
      requestData<TCombatResponse>({ endPoint: "/getAllCombats" }),
      requestData<{ npcs: Npc.TNpc[]; hash?: string }>({ endPoint: "/getAllNpcs" }),
    ]);
    setCombats(combatResponse.data?.combats || []);
    setHash(combatResponse.data?.hash || "");
    setNpcs(npcResponse.data?.npcs || []);
  };

  useEffect(() => {
    load().catch((error) => {
      setError("Harcok betöltése sikertelen: " + toErrorMessage(error));
      debugLog("Failed to load combats:", error);
    });
  }, []);

  useEffect(() => {
    if (!selectedCombat) return;
    setDraft(cloneCombat(selectedCombat));
  }, [selectedCombat]);

  const filteredCombats = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("hu-HU");
    if (!needle) return combats;
    return combats.filter((combat) =>
      combat.name.toLocaleLowerCase("hu-HU").includes(needle)
    );
  }, [combats, search]);

  const addNpc = (side: Combat.TCombatNpcSide) => {
    const npc = npcs.find((entry) => entry.id === selectedNpcId);
    if (!npc) return;
    const ref = { id: npc.id, name: npc.name };
    setDraft((prev) => ({
      ...prev,
      [side === "friendly" ? "friendlyNpcs" : "enemyNpcs"]: [
        ...(side === "friendly" ? prev.friendlyNpcs : prev.enemyNpcs),
        ref,
      ],
    }));
    setSelectedNpcId("");
  };

  const removeNpc = (side: Combat.TCombatNpcSide, index: number) => {
    setDraft((prev) => ({
      ...prev,
      [side === "friendly" ? "friendlyNpcs" : "enemyNpcs"]:
        (side === "friendly" ? prev.friendlyNpcs : prev.enemyNpcs)
          .filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const save = async () => {
    if (!hash || !draft.name.trim()) return;
    setBusy(true);
    try {
      const previous = draft.id ? combats.find((combat) => combat.id === draft.id) : undefined;
      const nextCombat: Combat.TCombat = {
        ...draft,
        name: draft.name.trim(),
        adminNote: draft.adminNote || "",
        friendlyNpcs: (draft.friendlyNpcs || []).filter((entry) => entry.id && entry.name),
        enemyNpcs: (draft.enemyNpcs || []).filter((entry) => entry.id && entry.name),
      };
      const patch = buildTopLevelDiffPatch(previous, nextCombat, {
        requiredPaths: ["/name"],
      });
      if (patch.length < 1) return;
      const response = await requestData<TCombatResponse, ServerApi.RestRoutes.UpdateCombatBody>({
        endPoint: "/updateCombat",
        body: { expectedHash: hash, patch },
      });
      setCombats(response.data?.combats || []);
      setHash(response.data?.hash || "");
      setSelectedId(response.data?.combat?.id || nextCombat.id);
      setDraft(response.data?.combat ? cloneCombat(response.data.combat) : nextCombat);
    } catch (error) {
      if (isConflictError(error)) {
        await load();
        setError("Conflict (409): a harclista megváltozott a szerveren. Frissítettem, próbáld újra.");
      } else {
        setError("Harc mentése sikertelen: " + toErrorMessage(error));
      }
      debugLog("Failed to save combat:", error);
    } finally {
      setBusy(false);
    }
  };

  const deleteCombat = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      const response = await requestData<TCombatResponse, ServerApi.RestRoutes.DeleteBody>({
        endPoint: "/deleteCombat",
        body: { name: draft.id },
      });
      setCombats(response.data?.combats || []);
      setHash(response.data?.hash || "");
      setSelectedId("");
      setDraft(emptyCombat());
    } catch (error) {
      setError("Harc törlése sikertelen: " + toErrorMessage(error));
      debugLog("Failed to delete combat:", error);
    } finally {
      setBusy(false);
    }
  };

  const NpcList = ({ side, rows }: { side: Combat.TCombatNpcSide; rows: Combat.TCombatNpcRef[] }) => (
    <FlexCol className="fancy-container p-1 gap-1">
      <p className="font-semibold">{side === "friendly" ? "Baráti NJK-k" : "Ellenséges NJK-k"}</p>
      {rows.length === 0 ? (
        <p>Nincs NJK.</p>
      ) : (
        rows.map((entry, index) => (
          <FlexRow key={`${side}-${index}-${entry.id}`} className="items-center gap-1 fancy-container p-1">
            <p className="grow">{entry.name}</p>
            <ButtonUnq id={`remove-${side}-${index}`} onClick={() => removeNpc(side, index)}>
              Törlés
            </ButtonUnq>
          </FlexRow>
        ))
      )}
    </FlexCol>
  );

  return (
    <RndContainer
      id="combat-handling"
      aditionalIcons={null}
      close={close}
      label="combat-handling"
    >
      <div className="grow w-full min-w-0 min-h-0 fancy-container p-2 flex flex-col gap-2 overflow-hidden text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Harcok</h2>
          <button
            className="fancy-container px-2 py-1"
            type="button"
            onClick={() => {
              setSelectedId("");
              setDraft(emptyCombat());
            }}
          >
            Új
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 min-h-0 grow">
          <FlexCol className="fancy-container p-1 overflow-hidden gap-1">
            <InputUnq
              id="combat-search"
              label="Keresés"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <FlexCol className="overflow-y-auto gap-0.5">
              {filteredCombats.map((combat) => (
                <button
                  key={combat.id}
                  type="button"
                  className={`w-full text-left px-2 py-1 fancy-container ${
                    combat.id === selectedId ? "bg-black/10" : ""
                  }`}
                  onClick={() => setSelectedId(combat.id)}
                >
                  {combat.name}
                </button>
              ))}
            </FlexCol>
          </FlexCol>
          <FlexCol className="fancy-container p-2 min-h-0 overflow-y-auto gap-2">
            <InputUnq
              id="combat-name"
              label="Harc neve"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.currentTarget.value }))}
            />
            <label className="flex flex-col gap-0.5">
              <span>Admin jegyzet</span>
              <textarea
                className="border rounded text-black p-1 min-h-[110px]"
                value={draft.adminNote}
                onInput={(e) => setDraft((prev) => ({ ...prev, adminNote: e.currentTarget.value }))}
              />
            </label>
            <FlexRow className="gap-1 flex-wrap items-end">
              <label className="flex flex-col gap-0.5 min-w-[220px] grow">
                <span>NJK</span>
                <select
                  className="border rounded text-black p-1"
                  value={selectedNpcId}
                  onChange={(e) => setSelectedNpcId(e.currentTarget.value)}
                >
                  <option value="">NJK kiválasztása</option>
                  {npcs.map((npc) => (
                    <option key={npc.id} value={npc.id}>
                      {npc.name}
                    </option>
                  ))}
                </select>
              </label>
              <ButtonUnq id="add-friendly-npc" onClick={() => addNpc("friendly")}>
                Baráti
              </ButtonUnq>
              <ButtonUnq id="add-enemy-npc" onClick={() => addNpc("enemy")}>
                Ellenség
              </ButtonUnq>
            </FlexRow>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <NpcList side="friendly" rows={draft.friendlyNpcs || []} />
              <NpcList side="enemy" rows={draft.enemyNpcs || []} />
            </div>
            <FlexRow className="justify-end gap-1 flex-wrap">
              <ButtonUnq
                id="delete-combat"
                disabled={busy || !draft.id}
                onClick={deleteCombat}
              >
                Törlés
              </ButtonUnq>
              <ButtonUnq
                id="save-combat"
                disabled={busy || !draft.name.trim()}
                onClick={save}
              >
                Mentés
              </ButtonUnq>
            </FlexRow>
          </FlexCol>
        </div>
      </div>
    </RndContainer>
  );
}
