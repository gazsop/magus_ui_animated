import { useEffect, useMemo, useState } from "preact/hooks";
import { Adventure, Character, Npc, ServerApi } from "@shared/contracts";
import ImageUploadControl from "@components/ImageUploadControl";
import { MoneyAddInput } from "@components/Money";
import RndContainer from "@components/RndContainer";
import { ButtonUnq, InputUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import { buildTopLevelDiffPatch } from "@/core/api/patch";
import { debugLog } from "@/core/logger";
import { isConflictError } from "@/core/api/httpClient";
import { createEmptyHm, HM_HU_LABELS, HM_KEYS, withHmDefaults } from "@/utils/hm";
import { TCloseProps, TRestRequest, TSetError, toErrorMessage } from "./types";

type TNpcResponse = ServerApi.RestRoutes.GetAllNpcsResponse & {
  npc?: Npc.TNpc;
};

type TNpcHandlingWindowProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

const buildPrimaryStats = (): Character.TPrimaryStat[] =>
  Object.values(Character.PRIMARY_STATS).map((name) => ({
    name,
    val: 0,
  }));

const emptyRoll = (): Adventure.TRollElements => ({
  dice: Adventure.DICE.SIX,
  nrOfDices: 0,
  constant: 0,
  nrOfRolls: 0,
});

const emptyResource = (): Character.TResource => ({
  health: {
    currentHp: 0,
    maxHp: 0,
    currentEp: 0,
    maxEp: 0,
  },
  abilities: {
    name: Character.RESOURCE_TYPE.MANA,
    current: 0,
    max: 0,
    regenPerRound: emptyRoll(),
    lvlUp: emptyRoll(),
  },
});

const withResourceDefaults = (resource?: Partial<Character.TResource> | null): Character.TResource => ({
  health: {
    currentHp: Number(resource?.health?.currentHp || 0),
    maxHp: Number(resource?.health?.maxHp || 0),
    currentEp: Number(resource?.health?.currentEp || 0),
    maxEp: Number(resource?.health?.maxEp || 0),
  },
  abilities: {
    name: resource?.abilities?.name || Character.RESOURCE_TYPE.MANA,
    current: Number(resource?.abilities?.current || 0),
    max: Number(resource?.abilities?.max || 0),
    regenPerRound: resource?.abilities?.regenPerRound || emptyRoll(),
    lvlUp: resource?.abilities?.lvlUp || emptyRoll(),
  },
});

const emptyNpc = (): Npc.TNpc => ({
  id: "",
  name: "",
  hm: createEmptyHm(),
  resource: emptyResource(),
  primaryStats: buildPrimaryStats(),
  lootItems: [],
  moneyCopper: 0,
  adminNotes: "",
  notes: "",
  avatar: null,
});

const cloneNpc = (npc: Npc.TNpc): Npc.TNpc =>
  JSON.parse(JSON.stringify(npc)) as Npc.TNpc;

export default function NpcHandlingWindow({
  close,
  requestData,
  setError,
}: TNpcHandlingWindowProps) {
  const [npcs, setNpcs] = useState<Npc.TNpc[]>([]);
  const [items, setItems] = useState<Character.Item.TItem[]>([]);
  const [hash, setHash] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Npc.TNpc>(emptyNpc);
  const [selectedItemName, setSelectedItemName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedNpc = useMemo(
    () => npcs.find((npc) => npc.id === selectedId) || null,
    [npcs, selectedId]
  );

  const load = async () => {
    const [npcResponse, itemResponse] = await Promise.all([
      requestData<TNpcResponse>({ endPoint: "/getAllNpcs" }),
      requestData<{ items: Character.Item.TItem[]; hash?: string }>({ endPoint: "/getAllItems" }),
    ]);
    setNpcs(npcResponse.data?.npcs || []);
    setHash(npcResponse.data?.hash || "");
    setItems(itemResponse.data?.items || []);
  };

  useEffect(() => {
    load().catch((error) => {
      setError("NJK-k betöltése sikertelen: " + toErrorMessage(error));
      debugLog("Failed to load NPCs:", error);
    });
  }, []);

  useEffect(() => {
    if (!selectedNpc) return;
    setDraft(cloneNpc(selectedNpc));
  }, [selectedNpc]);

  const filteredNpcs = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("hu-HU");
    if (!needle) return npcs;
    return npcs.filter((npc) =>
      npc.name.toLocaleLowerCase("hu-HU").includes(needle)
    );
  }, [npcs, search]);

  const updatePrimaryStat = (name: Character.PRIMARY_STATS, value: number) => {
    setDraft((prev) => ({
      ...prev,
      primaryStats: prev.primaryStats.map((stat) =>
        stat.name === name ? { ...stat, val: value } : stat
      ),
    }));
  };

  const save = async () => {
    if (!hash || !draft.name.trim()) return;
    setBusy(true);
    try {
      const previous = draft.id ? npcs.find((npc) => npc.id === draft.id) : undefined;
      const nextNpc: Npc.TNpc = {
        ...draft,
        name: draft.name.trim(),
        hm: withHmDefaults(draft.hm),
        resource: withResourceDefaults(draft.resource),
        adminNotes: draft.adminNotes || "",
        notes: draft.notes || "",
        primaryStats: buildPrimaryStats().map((base) => {
          const current = draft.primaryStats.find((stat) => stat.name === base.name);
          return {
            name: base.name,
            val: Number(current?.val || 0),
          };
        }),
        lootItems: (draft.lootItems || [])
          .map((entry) => ({
            itemName: entry.itemName.trim(),
            amount: Math.max(1, Math.floor(Number(entry.amount || 1))),
          }))
          .filter((entry) => !!entry.itemName),
        moneyCopper: Math.max(0, Math.floor(Number(draft.moneyCopper || 0))),
        avatar: draft.avatar || null,
      };
      const patch = buildTopLevelDiffPatch(previous, nextNpc, {
        requiredPaths: ["/name"],
      });
      if (patch.length < 1) return;
      const response = await requestData<TNpcResponse, ServerApi.RestRoutes.UpdateNpcBody>({
        endPoint: "/updateNpc",
        body: { expectedHash: hash, patch },
      });
      setNpcs(response.data?.npcs || []);
      setHash(response.data?.hash || "");
      setSelectedId(response.data?.npc?.id || nextNpc.id);
      setDraft(response.data?.npc ? cloneNpc(response.data.npc) : nextNpc);
    } catch (error) {
      if (isConflictError(error)) {
        await load();
        setError("Conflict (409): az NJK lista megváltozott a szerveren. Frissítettem, próbáld újra.");
      } else {
        setError("NJK mentése sikertelen: " + toErrorMessage(error));
      }
      debugLog("Failed to save NPC:", error);
    } finally {
      setBusy(false);
    }
  };

  const addSelectedLootItem = () => {
    const itemName = selectedItemName.trim();
    if (!itemName) return;
    setDraft((prev) => ({
      ...prev,
      lootItems: [
        ...(prev.lootItems || []),
        {
          itemName,
          amount: 1,
        },
      ],
    }));
    setSelectedItemName("");
  };

  const updateHealth = (
    key: keyof Character.TResource["health"],
    value: number
  ) => {
    setDraft((prev) => {
      const resource = withResourceDefaults(prev.resource);
      return {
        ...prev,
        resource: {
          ...resource,
          health: {
            ...resource.health,
            [key]: value,
          },
        },
      };
    });
  };

  const updateAbility = (
    key: "name" | "current" | "max",
    value: Character.RESOURCE_TYPE | number
  ) => {
    setDraft((prev) => {
      const resource = withResourceDefaults(prev.resource);
      return {
        ...prev,
        resource: {
          ...resource,
          abilities: {
            ...resource.abilities,
            [key]: value,
          },
        },
      };
    });
  };

  const deleteNpc = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      const response = await requestData<TNpcResponse, ServerApi.RestRoutes.DeleteBody>({
        endPoint: "/deleteNpc",
        body: { name: draft.id },
      });
      setNpcs(response.data?.npcs || []);
      setHash(response.data?.hash || "");
      setSelectedId("");
      setDraft(emptyNpc());
    } catch (error) {
      setError("NJK törlése sikertelen: " + toErrorMessage(error));
      debugLog("Failed to delete NPC:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RndContainer
      id="npc-handling"
      aditionalIcons={null}
      close={close}
      label="npc-handling"
    >
      <div className="grow w-full min-w-0 min-h-0 fancy-container p-2 flex flex-col gap-2 overflow-hidden text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">NJK-k</h2>
          <button
            className="fancy-container px-2 py-1"
            type="button"
            onClick={() => {
              setSelectedId("");
              setDraft(emptyNpc());
            }}
          >
            Új
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 min-h-0 grow">
          <FlexCol className="fancy-container p-1 overflow-hidden gap-1">
            <InputUnq
              id="npc-search"
              label="Keresés"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <FlexCol className="overflow-y-auto gap-0.5">
              {filteredNpcs.map((npc) => (
                <button
                  key={npc.id}
                  type="button"
                  className={`w-full text-left px-2 py-1 fancy-container ${
                    npc.id === selectedId ? "bg-black/10" : ""
                  }`}
                  onClick={() => setSelectedId(npc.id)}
                >
                  {npc.name}
                </button>
              ))}
            </FlexCol>
          </FlexCol>
          <FlexCol className="fancy-container p-2 min-h-0 overflow-y-auto gap-2">
            <InputUnq
              id="npc-name"
              label="Név"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.currentTarget.value }))}
            />
            <ImageUploadControl
              id="npc-avatar"
              label="Avatar"
              value={draft.avatar || null}
              onChange={(avatar) => setDraft((prev) => ({ ...prev, avatar }))}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {HM_KEYS.map((key) => (
                <label key={key} className="flex flex-col gap-0.5">
                  <span>{HM_HU_LABELS[key]}</span>
                  <input
                    type="number"
                    className="border rounded text-black p-1"
                    value={withHmDefaults(draft.hm)[key]}
                    onInput={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        hm: {
                          ...withHmDefaults(prev.hm),
                          [key]: Number((e.currentTarget as HTMLInputElement).value || 0),
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 fancy-container p-1">
              <label className="flex flex-col gap-0.5">
                <span>FP</span>
                <input
                  type="number"
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).health.currentHp}
                  onInput={(e) => updateHealth("currentHp", Number(e.currentTarget.value || 0))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Max FP</span>
                <input
                  type="number"
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).health.maxHp}
                  onInput={(e) => updateHealth("maxHp", Number(e.currentTarget.value || 0))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>EP</span>
                <input
                  type="number"
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).health.currentEp}
                  onInput={(e) => updateHealth("currentEp", Number(e.currentTarget.value || 0))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Max EP</span>
                <input
                  type="number"
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).health.maxEp}
                  onInput={(e) => updateHealth("maxEp", Number(e.currentTarget.value || 0))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Erőforrás</span>
                <select
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).abilities.name}
                  onChange={(e) => updateAbility("name", e.currentTarget.value as Character.RESOURCE_TYPE)}
                >
                  {Object.values(Character.RESOURCE_TYPE).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Erőforráspont</span>
                <input
                  type="number"
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).abilities.current}
                  onInput={(e) => updateAbility("current", Number(e.currentTarget.value || 0))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Max erőforrás</span>
                <input
                  type="number"
                  className="border rounded text-black p-1"
                  value={withResourceDefaults(draft.resource).abilities.max}
                  onInput={(e) => updateAbility("max", Number(e.currentTarget.value || 0))}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1">
              {buildPrimaryStats().map((stat) => {
                const value = draft.primaryStats.find((entry) => entry.name === stat.name)?.val || 0;
                return (
                  <label key={stat.name} className="flex flex-col gap-0.5">
                    <span>{stat.name}</span>
                    <input
                      type="number"
                      className="border rounded text-black p-1"
                      value={value}
                      onInput={(e) =>
                        updatePrimaryStat(
                          stat.name,
                          Number((e.currentTarget as HTMLInputElement).value || 0)
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
            <MoneyAddInput
              id="npc-loot-money"
              label="Zsákmány pénz"
              valueCopper={draft.moneyCopper || 0}
              onChange={(moneyCopper) => setDraft((prev) => ({ ...prev, moneyCopper }))}
            />
            <FlexCol className="fancy-container p-1 gap-1">
              <p className="font-semibold">Zsákmány tárgyak</p>
              <FlexRow className="gap-1 flex-wrap items-end">
                <label className="flex flex-col gap-0.5 min-w-[220px] grow">
                  <span>Tárgy</span>
                  <select
                    className="border rounded text-black p-1"
                    value={selectedItemName}
                    onChange={(e) => setSelectedItemName(e.currentTarget.value)}
                  >
                    <option value="">Tárgy kiválasztása</option>
                    {items.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <ButtonUnq id="npc-add-loot-item" onClick={addSelectedLootItem}>
                  Hozzáadás
                </ButtonUnq>
              </FlexRow>
              {(draft.lootItems || []).length === 0 ? (
                <p>Nincs zsákmánytárgy.</p>
              ) : (
                (draft.lootItems || []).map((entry, index) => (
                  <FlexRow
                    key={`npc-loot-${index}-${entry.itemName}`}
                    className="items-center gap-1 flex-wrap fancy-container p-1"
                  >
                    <p className="grow min-w-[160px]">{entry.itemName}</p>
                    <label className="flex flex-col gap-0.5">
                      <span>Db</span>
                      <input
                        type="number"
                        min={1}
                        className="border rounded text-black p-1 w-20"
                        value={entry.amount}
                        onInput={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            lootItems: (prev.lootItems || []).map((current, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...current,
                                    amount: Math.max(
                                      1,
                                      Number((e.currentTarget as HTMLInputElement).value || 1)
                                    ),
                                  }
                                : current
                            ),
                          }))
                        }
                      />
                    </label>
                    <ButtonUnq
                      id={`npc-remove-loot-item-${index}`}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          lootItems: (prev.lootItems || []).filter((_, currentIndex) => currentIndex !== index),
                        }))
                      }
                    >
                      Törlés
                    </ButtonUnq>
                  </FlexRow>
                ))
              )}
            </FlexCol>
            <label className="flex flex-col gap-0.5">
              <span>Jegyzet</span>
              <textarea
                className="border rounded text-black p-1 min-h-[110px]"
                value={draft.notes}
                onInput={(e) => setDraft((prev) => ({ ...prev, notes: e.currentTarget.value }))}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span>Admin jegyzet</span>
              <textarea
                className="border rounded text-black p-1 min-h-[110px]"
                value={draft.adminNotes}
                onInput={(e) =>
                  setDraft((prev) => ({ ...prev, adminNotes: e.currentTarget.value }))
                }
              />
            </label>
            <FlexRow className="justify-end gap-1 flex-wrap">
              <ButtonUnq
                id="delete-npc"
                disabled={busy || !draft.id}
                onClick={deleteNpc}
              >
                Törlés
              </ButtonUnq>
              <ButtonUnq
                id="save-npc"
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
