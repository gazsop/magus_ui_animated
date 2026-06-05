import { Adventure, Character, Application, Combat, ServerApi, Vendor } from "@shared/contracts";
import { createPortal, useEffect, useMemo, useRef, useState } from "preact/compat";
import {
  copperToInventoryMoney,
  copperToMoneyBreakdown,
  inventoryMoneyToCopper,
  moneyBreakdownToCopper,
} from "@shared/game";
import useRequest from "@hooks/request";
import useError from "@hooks/error";
import { useAdventureLiveEventSubscription, useSyncStatusSubscription } from "@hooks/liveEvents";
import { useLiveEventsContext } from "@contexts/liveEventsContext";
import { useWindowsLayer } from "@pages/WindowsLayer";
import AuraEditor, { createEmptyAuraEditorDraft, TAuraEditorDraft } from "@components/AuraEditor";
import AuraDisplay from "@components/AuraDisplay";
import RndContainer from "@components/RndContainer";
import ItemHoverCard from "@components/ItemHoverCard";
import { FlexRow } from "@components/Flex";
import { isConflictError } from "@/core/api/httpClient";
import { buildTopLevelDiffPatch } from "@/core/api/patch";
import { useDataContext } from "@contexts/dataContext";
import { formatClientDateTime } from "@/core/datetime";
import { parseCharacterPayload } from "@pages/Character/utils/characterPayload";
import CharacterSpellsPanel from "@pages/Character/components/CharacterSpellsPanel";
import CharacterSecondarySkillsPanel from "@pages/Character/components/CharacterSecondarySkillsPanel";
import useAurasAndDamagePanel from "@pages/Character/components/CharacterAurasAndDamage";
import { PageState } from "@/app/navigation";
import {
  registerWindowDescriptorRenderer,
  TWindowDescriptorRenderer,
  unregisterWindowDescriptorRenderer,
} from "@/windows/windowDescriptorRenderers";
import { defineWindowRegistration } from "@/windows/windowFactory";
import {
  MoneyAddInput,
  MoneyDisplay,
} from "@components/Money";
import {
  buildAdventureCharacterDataWindowDescriptor,
  CharacterIdentity,
  useAdminAdventureCharacters,
} from "@/contexts/adminAdventureCharactersContext";

type TNamedValue = { name: string; value: string };

type AdventureMeta = Adventure.IAdventureServer & { hash: string };
type TAuraTarget = {
  uid: string;
  advId: string;
  json: Character.TCharacter;
  entry: CharacterIdentity;
  auraId?: string;
};
type TItemAuraTarget = TAuraTarget & {
  bpIndex: number;
  itemIndex: number;
  itemName: string;
};

const TURN_DURATION_MS = 10_000;
const ADMIN_EQUIPMENT_SLOT_IDS = [
  "hands",
  "mainHand",
  "head",
  "neck",
  "chest",
  "legs",
  "feet",
  "rings1",
  "rings2",
  "cloak",
  "shoulder",
  "trinket",
  "offHand",
  "bracer",
  "bag",
  "satchel",
] as const;

const computeSpellVisibilityCap = (level: number): number => {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  if (safeLevel < 10) return 10;
  return Math.min(99, (Math.floor(safeLevel / 10) + 1) * 10);
};

const buildAdminCharacterSubWindow = ({
  advId,
  uid,
  kind,
  title,
  icon,
}: {
  advId: string;
  uid: string;
  kind: string;
  title: string;
  icon: string;
}) => defineWindowRegistration({
  id: `${kind}-${advId}-${uid}`,
  kind,
  title,
  icon,
  params: { advId, uid },
  defaultOpen: true,
  allowedPages: [PageState.CHAR_SHEET],
  keepStateAcrossPages: true,
  launcherVisible: false,
});

function AdminCharacterDamagePanel({
  character,
  onSave,
}: {
  character: Character.TCharacter;
  onSave: (nextCharacter: Character.TCharacter) => Promise<void>;
}) {
  const { damagesPanel } = useAurasAndDamagePanel({ character, onSave });
  return damagesPanel;
}

const parsePathTokens = (path: string): Array<string | number> =>
  String(path || "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => (/^\d+$/.test(token) ? Number(token) : token));

const getByPath = (root: unknown, path: string): unknown => {
  const tokens = parsePathTokens(path);
  let curr: unknown = root;
  for (const token of tokens) {
    if (curr === null || curr === undefined) return undefined;
    if (typeof token === "number") {
      if (!Array.isArray(curr)) return undefined;
      curr = curr[token];
      continue;
    }
    if (typeof curr !== "object") return undefined;
    curr = (curr as Record<string, unknown>)[token];
  }
  return curr;
};

const setByPath = (root: unknown, path: string, value: unknown): boolean => {
  const tokens = parsePathTokens(path);
  if (tokens.length === 0 || root === null || typeof root !== "object") return false;
  let curr: unknown = root;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];
    if (typeof token === "number") {
      if (!Array.isArray(curr)) return false;
      if (curr[token] === undefined || curr[token] === null) {
        curr[token] = typeof nextToken === "number" ? [] : {};
      }
      curr = curr[token];
      continue;
    }
    if (curr === null || typeof curr !== "object") return false;
    const obj = curr as Record<string, unknown>;
    if (obj[token] === undefined || obj[token] === null) {
      obj[token] = typeof nextToken === "number" ? [] : {};
    }
    curr = obj[token];
  }
  const leaf = tokens[tokens.length - 1];
  if (typeof leaf === "number") {
    if (!Array.isArray(curr)) return false;
    curr[leaf] = value;
    return true;
  }
  if (curr === null || typeof curr !== "object") return false;
  (curr as Record<string, unknown>)[leaf] = value;
  return true;
};

export default function AdventureGridView({ advId = "" }: { advId?: string }) {
  const { addWindow, updateWindow } = useWindowsLayer();
  const { setSyncSnapshot } = useLiveEventsContext();
  const { classes, descents } = useDataContext();
  const {
    characters,
    setCharacters,
    isLoading,
    reloadCharacters,
    applyCharacterServerRow,
    commitUpdatedCharacter,
    mapCharacterServerRows,
    setCharacterDataRenderer,
  } = useAdminAdventureCharacters();
  const [religions, setReligions] = useState<TNamedValue[]>([]);
  const [combatMode, setCombatMode] = useState(false);
  const [turn, setTurn] = useState(1);
  const [combatInitiatives, setCombatInitiatives] = useState<Adventure.TCombatInitiative[]>([]);
  const [npcManageTargetUid, setNpcManageTargetUid] = useState("");
  const [npcDamageValue, setNpcDamageValue] = useState(0);
  const [npcHealHpValue, setNpcHealHpValue] = useState(0);
  const [npcHealEpValue, setNpcHealEpValue] = useState(0);
  const [npcResourceDeltaValue, setNpcResourceDeltaValue] = useState(0);
  const [npcManageBusy, setNpcManageBusy] = useState(false);
  const [combats, setCombats] = useState<Combat.TCombat[]>([]);
  const [selectedCombatId, setSelectedCombatId] = useState("");
  const [vendors, setVendors] = useState<Vendor.TVendor[]>([]);
  const [vendorState, setVendorState] = useState<Vendor.TVendorState | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [tradeFinalPrice, setTradeFinalPrice] = useState<Record<string, number>>({});
  const [adventureMeta, setAdventureMeta] = useState<AdventureMeta | null>(null);
  const syncMetaRefreshRef = useRef(false);
  const [adventureDateBusy, setAdventureDateBusy] = useState(false);
  const [adventureDateStep, setAdventureDateStep] = useState(1);
  const [hoveredItem, setHoveredItem] = useState<Character.Item.TItem | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<Character.Item.TItem[]>([]);
  const [allItems, setAllItems] = useState<Character.Item.TItem[]>([]);
  const [itemQty, setItemQty] = useState(1);
  const [addTarget, setAddTarget] = useState<{
    uid: string;
    advId: string;
    json: Character.TCharacter;
    entry: CharacterIdentity;
  } | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [isAuraModalOpen, setIsAuraModalOpen] = useState(false);
  const [auraTarget, setAuraTarget] = useState<TAuraTarget | null>(null);
  const [auraDraft, setAuraDraft] = useState<TAuraEditorDraft>(createEmptyAuraEditorDraft());
  const [isItemAuraModalOpen, setIsItemAuraModalOpen] = useState(false);
  const [itemAuraTarget, setItemAuraTarget] = useState<TItemAuraTarget | null>(null);
  const [itemAuraDraft, setItemAuraDraft] = useState<TAuraEditorDraft>(
    createEmptyAuraEditorDraft({ color: "" })
  );
  const [isMoneyModalOpen, setIsMoneyModalOpen] = useState(false);
  const [moneyTarget, setMoneyTarget] = useState<{
    uid: string;
    advId: string;
    json: Character.TCharacter;
    entry: CharacterIdentity;
  } | null>(null);
  const [moneyDraft, setMoneyDraft] = useState({
    gold: 0,
    silver: 0,
    copper: 0,
    mode: "set" as "set" | "add" | "sub",
  });
  const [isGiveXpModalOpen, setIsGiveXpModalOpen] = useState(false);
  const [xpBulkValue, setXpBulkValue] = useState(0);
  const [xpByUid, setXpByUid] = useState<Record<string, number>>({});
  const [xpBusy, setXpBusy] = useState(false);
  const [isStatEditModalOpen, setIsStatEditModalOpen] = useState(false);
  const [statEditTarget, setStatEditTarget] = useState<{
    uid: string;
    advId: string;
    entry: CharacterIdentity;
    json: Character.TCharacter;
    label: string;
  } | null>(null);
  const [statEditPath, setStatEditPath] = useState("");
  const [statEditValueRaw, setStatEditValueRaw] = useState("");
  const [statEditError, setStatEditError] = useState("");
  const [statEditBusy, setStatEditBusy] = useState(false);
  const [userNamesByUid, setUserNamesByUid] = useState<Record<string, string>>({});
  const [requestCharacters] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [requestAdventure] = useRequest(Application.REQUEST_CONTROLLER.ADVENTURES);
  const [requestRest] = useRequest(Application.REQUEST_CONTROLLER.REST);
  const [requestUsers] = useRequest(Application.REQUEST_CONTROLLER.USERS);
  const { setError } = useError();
  const canUseDom = typeof document !== "undefined";

  const applyCombatState = (state?: Partial<Adventure.TCombatState> | null) => {
    const enabled = Boolean(state?.enabled);
    const serverTurn = Math.max(0, Number(state?.turn || 0));
    setCombatMode(enabled);
    setTurn(enabled ? Math.max(1, serverTurn || 1) : 1);
    if (enabled && state?.combatId) setSelectedCombatId(String(state.combatId));
    setCombatInitiatives(enabled && Array.isArray(state?.initiatives) ? state.initiatives : []);
  };

  const reloadCombatState = async () => {
    if (!advId) {
      applyCombatState(null);
      return;
    }
    const response = await requestAdventure<Adventure.TCombatState>({
      endPoint: "/combat/get",
      body: { advId },
      errorMode: "quiet",
    });
    applyCombatState(response.data);
  };

  const reloadVendorState = async () => {
    if (!advId) return;
    const response = await requestAdventure<Vendor.TVendorState>({
      endPoint: "/vendor/get",
      body: { advId },
      errorMode: "quiet",
    });
    setVendorState(response.data || null);
    setSelectedVendorId(String(response.data?.vendorId || ""));
  };

  const reloadAdventureMeta = async () => {
    if (!advId) {
      setAdventureMeta(null);
      return;
    }
    const response = await requestAdventure<AdventureMeta>({
      endPoint: "/get",
      body: { id: advId },
      errorMode: "quiet",
    });
    const nextMeta = response.data || null;
    setAdventureMeta(nextMeta);
  };

  useEffect(() => {
    if (!advId) {
      setSyncSnapshot(null);
      return;
    }
    setSyncSnapshot({
      advId,
      adventure: {
        hash: adventureMeta?.hash || "",
      },
    });
    return () => setSyncSnapshot(null);
  }, [advId, adventureMeta?.hash, setSyncSnapshot]);

  useSyncStatusSubscription(advId, (payload) => {
    const status = payload.adventure;
    if (!status) return;
    if (status.status !== "stale" && status.status !== "missing") return;
    if (syncMetaRefreshRef.current || adventureDateBusy) return;
    syncMetaRefreshRef.current = true;
    reloadAdventureMeta()
      .catch((error) => {
        setError("Failed to gently refresh adventure data: " + error, {
          severity: "quiet",
          context: "admin-adventure:gently-refresh",
        });
      })
      .finally(() => {
        syncMetaRefreshRef.current = false;
      });
  });

  const updateAdventureDateBy = async (deltaMs: number) => {
    if (!advId || !adventureMeta || adventureDateBusy || deltaMs === 0) return;
    const current = Number(adventureMeta.json.worldDateCurrent || Date.now());
    const nextCurrent = current + deltaMs;
    const shouldSyncTurn = combatMode && deltaMs % TURN_DURATION_MS === 0;
    const nextTurn = shouldSyncTurn
      ? Math.max(1, turn + deltaMs / TURN_DURATION_MS)
      : turn;
    try {
      setAdventureDateBusy(true);
      const response = await requestAdventure<AdventureMeta>({
        endPoint: "/update",
        body: {
          id: advId,
          expectedHash: adventureMeta.hash,
          patch: [{ op: "replace", path: "/worldDateCurrent", value: nextCurrent }],
        },
      });
      setAdventureMeta(response.data || null);
      if (shouldSyncTurn) {
        const combatResponse = await requestAdventure<Adventure.TCombatState>({
          endPoint: "/combat/set",
          body: { advId, enabled: true, turn: nextTurn },
        });
        applyCombatState(combatResponse.data);
      }
    } catch (error) {
      if (isConflictError(error)) {
        await reloadAdventureMeta();
        setError("Conflict (409): adventure date changed on server. Reloaded latest data, please retry.");
        return;
      }
      setError("Failed to update adventure date: " + error);
    } finally {
      setAdventureDateBusy(false);
    }
  };

  const setCombatEnabled = (enabled: boolean) => {
    if (!advId) return;
    if (enabled && !selectedCombatId) {
      setError("Select a combat first.");
      return;
    }
    requestAdventure<Adventure.TCombatState>({
      endPoint: "/combat/set",
      body: { advId, enabled, turn: enabled ? 1 : 0, combatId: enabled ? selectedCombatId : undefined },
    })
      .then((response) => {
        applyCombatState(response.data);
      })
      .catch((error) => {
        setError("Failed to set combat mode: " + error);
      });
  };

  const setVendorEnabled = (enabled: boolean) => {
    if (!advId) return;
    requestAdventure<Vendor.TVendorState>({
      endPoint: "/vendor/set",
      body: { advId, enabled, vendorId: enabled ? selectedVendorId : undefined },
    })
      .then((response) => {
        setVendorState(response.data || null);
        setSelectedVendorId(String(response.data?.vendorId || selectedVendorId || ""));
      })
      .catch((error) => {
        setError("Failed to set vendor mode: " + error);
      });
  };

  const resolveTrade = (trade: Vendor.TVendorTrade, accepted: boolean) => {
    if (!advId) return;
    requestCharacters<{
      trade: Vendor.TVendorTrade | null;
      vendor: Vendor.TVendorState;
      character?: Character.TCharacterServer | null;
    }>({
      endPoint: "/vendor/resolve",
      body: {
        advId,
        tradeId: trade.id,
        accepted,
        finalPriceCopper: tradeFinalPrice[trade.id] ?? trade.suggestedPriceCopper,
      },
    })
      .then((response) => {
        if (response.data?.vendor) setVendorState(response.data.vendor);
        const character = response.data?.character;
        if (character?.json) {
          applyCharacterServerRow(character);
        }
      })
      .catch((error) => {
        setError("Failed to resolve trade: " + error);
      });
  };

  const advanceCombatTurn = () => {
    if (!advId) return;
    requestAdventure<Adventure.TCombatState>({
      endPoint: "/combat/next",
      body: { advId },
    })
      .then((response) => {
        applyCombatState(response.data);
        if (response.data?.enabled) void updateAdventureDateBy(TURN_DURATION_MS);
      })
      .catch((error) => {
        setError("Failed to advance combat turn: " + error);
      });
  };

  const npcManageTarget = combatInitiatives.find((row) => row.uid === npcManageTargetUid && row.kind === "npc") || null;

  const openNpcManageModal = (row: Adventure.TCombatInitiative) => {
    setNpcManageTargetUid(row.uid);
    setNpcDamageValue(0);
    setNpcHealHpValue(0);
    setNpcHealEpValue(0);
    setNpcResourceDeltaValue(0);
  };

  const applyNpcResourceAction = async (
    action: ServerApi.AdventureRoutes.CombatNpcResourceAction,
    amount: number
  ) => {
    if (!advId || !npcManageTarget || npcManageBusy) return;
    setNpcManageBusy(true);
    try {
      const response = await requestAdventure<Adventure.TCombatState, ServerApi.AdventureRoutes.UpdateCombatNpcResourceBody>({
        endPoint: "/combat/npc/resource",
        body: {
          advId,
          npcUid: npcManageTarget.uid,
          action,
          amount,
        },
      });
      applyCombatState(response.data);
      if (action === "damage") setNpcDamageValue(0);
      if (action === "healHp") setNpcHealHpValue(0);
      if (action === "healEp") setNpcHealEpValue(0);
      if (action === "resourceDelta") setNpcResourceDeltaValue(0);
    } catch (error) {
      setError("Failed to update NPC resources: " + error);
    } finally {
      setNpcManageBusy(false);
    }
  };

  const openGiveXpModal = () => {
    const nextXpByUid: Record<string, number> = {};
    characters.forEach((entry) => {
      nextXpByUid[entry.id] = 0;
    });
    setXpByUid(nextXpByUid);
    setXpBulkValue(0);
    setIsGiveXpModalOpen(true);
  };

  const applyXpToAll = (value: number) => {
    setXpBulkValue(value);
    setXpByUid((prev) => {
      const next: Record<string, number> = {};
      characters.forEach((entry) => {
        next[entry.id] = value;
      });
      return { ...prev, ...next };
    });
  };

  const saveGivenXp = async () => {
    if (!advId || xpBusy) return;
    const targets = characters
      .map((entry) => ({
        entry,
        xp: Number(xpByUid[entry.id] || 0),
      }))
      .filter((row) => row.xp !== 0 && row.entry.full);

    if (targets.length === 0) {
      setIsGiveXpModalOpen(false);
      return;
    }

    try {
      setXpBusy(true);
      const updates = await Promise.all(
        targets.map(async ({ entry, xp }) => {
          const response = await requestCharacters<Character.TCharacterServer>({
            endPoint: "/grantXp",
            body: {
              uid: entry.id,
              advId,
              xpDelta: xp,
            },
          });
          return response.data;
        })
      );

      setCharacters((prev) => {
        const map = new Map<string, CharacterIdentity>();
        prev.forEach((p) => map.set(p.id, p));
        mapCharacterServerRows(updates).forEach((entry) => {
          map.set(entry.id, entry);
        });
        return Array.from(map.values());
      });
      setIsGiveXpModalOpen(false);
    } catch (error) {
      setError("Failed to give XP: " + error);
    } finally {
      setXpBusy(false);
    }
  };

  useEffect(() => {
    if (!isAddItemModalOpen) return;
    const handle = setTimeout(() => {
      const q = itemSearch.trim().toLowerCase();
      if (!q) {
        setItemResults(allItems.slice(0, 100));
        return;
      }
      setItemResults(
        allItems
          .filter((it) => {
            const name = String(it.name || "").toLowerCase();
            const desc = String(it.description || "").toLowerCase();
            return name.includes(q) || desc.includes(q);
          })
          .slice(0, 100)
      );
    }, 180);
    return () => clearTimeout(handle);
  }, [itemSearch, allItems, isAddItemModalOpen]);

  useEffect(() => {
    requestUsers<Array<{ uid: string; name: string }>>({
      endPoint: "/getAll",
      errorMode: "quiet",
    })
      .then((response) => {
        const next: Record<string, string> = {};
        (response.data || []).forEach((user) => {
          if (!user?.uid) return;
          next[user.uid] = user.name || user.uid;
        });
        setUserNamesByUid(next);
      })
      .catch(() => setUserNamesByUid({}));
    requestRest<{ entries: TNamedValue[] }>({ endPoint: "getAllReligions", errorMode: "quiet" })
      .then((response) => setReligions(response.data?.entries || []))
      .catch(() => setReligions([]));
    requestRest<{ vendors: Vendor.TVendor[]; hash?: string }>({ endPoint: "/getAllVendors", errorMode: "quiet" })
      .then((response) => {
        setVendors(response.data?.vendors || []);
        if (!selectedVendorId && response.data?.vendors?.[0]) {
          setSelectedVendorId(response.data.vendors[0].id);
        }
      })
      .catch(() => setVendors([]));
    requestRest<{ combats: Combat.TCombat[]; hash?: string }>({ endPoint: "/getAllCombats", errorMode: "quiet" })
      .then((response) => {
        setCombats(response.data?.combats || []);
        if (!selectedCombatId && response.data?.combats?.[0]) {
          setSelectedCombatId(response.data.combats[0].id);
        }
      })
      .catch(() => setCombats([]));
  }, []);

  useEffect(() => {
    reloadCombatState().catch((error) => {
      setError("Failed to fetch combat mode: " + error, {
        severity: "quiet",
        context: "admin-adventure:combat-load",
      });
    });
  }, [advId]);

  useEffect(() => {
    reloadVendorState().catch((error) => {
      setError("Failed to fetch vendor mode: " + error, {
        severity: "quiet",
        context: "admin-adventure:vendor-load",
      });
    });
  }, [advId]);

  useEffect(() => {
    reloadAdventureMeta().catch((error) => {
      setError("Failed to fetch adventure datetime: " + error, {
        severity: "quiet",
        context: "admin-adventure:meta-load",
      });
      setAdventureMeta(null);
    });
  }, [advId]);

  useAdventureLiveEventSubscription(
    "combat:state",
    advId,
    (payload: {
      advId?: string;
      enabled?: boolean;
      turn?: number;
      initiatives?: Adventure.TCombatInitiative[];
    }) => {
      applyCombatState(payload);
    }
  );
  useAdventureLiveEventSubscription("vendor:state", advId, (payload: Vendor.TVendorState) => {
    setVendorState(payload);
    setSelectedVendorId(String(payload.vendorId || selectedVendorId || ""));
  });
  useAdventureLiveEventSubscription(
    "vendor:tradeRequested",
    advId,
    (payload: { vendor?: Vendor.TVendorState; trade?: Vendor.TVendorTrade }) => {
      if (payload.vendor) setVendorState(payload.vendor);
      if (payload.trade) {
        setTradeFinalPrice((prev) => ({
          ...prev,
          [payload.trade!.id]: payload.trade!.suggestedPriceCopper,
        }));
      }
    }
  );
  useAdventureLiveEventSubscription(
    "vendor:tradeResolved",
    advId,
    (payload: { vendor?: Vendor.TVendorState }) => {
      if (payload.vendor) setVendorState(payload.vendor);
    }
  );
  const persistCharacterUpdate = async ({
    uid,
    advId,
    json,
    entry,
    errorPrefix,
    onSuccess,
  }: {
    uid: string;
    advId: string;
    json: Character.TCharacter;
    entry: CharacterIdentity;
    errorPrefix: string;
    onSuccess?: () => void;
  }) => {
    setAddBusy(true);
    try {
      if (!entry.hash) {
        throw new Error("Missing hash guard; reload character data before update");
      }
      const patch = buildTopLevelDiffPatch(entry.full, json);
      if (patch.length < 1) return;
      const response = await requestCharacters<Character.TCharacterServer>({
        endPoint: "/update",
        body: {
          uid,
          advId,
          expectedHash: entry.hash,
          patch,
        },
      });
      const parsed = parseCharacterPayload(response.data);
      onSuccess?.();
      if (parsed.json) {
        const row = response.data as { hash?: string };
        const nextEntry = commitUpdatedCharacter(entry, parsed.json, parsed.computed, row.hash);
        openCharacterDataWindow(nextEntry, parsed.json);
      }
    } catch (error) {
      if (isConflictError(error)) {
        setError(`${errorPrefix}: conflict (409). Reload character data and retry.`);
        await reloadCharacters().catch(() => undefined);
        return;
      }
      setError(`${errorPrefix}: ${error}`);
    } finally {
      setAddBusy(false);
    }
  };

  const openStatEditor = ({
    uid,
    advId,
    entry,
    json,
    label,
    path,
    value,
  }: {
    uid: string;
    advId: string;
    entry: CharacterIdentity;
    json: Character.TCharacter;
    label: string;
    path: string;
    value: unknown;
  }) => {
    setStatEditTarget({ uid, advId, entry, json, label });
    setStatEditPath(path);
    setStatEditValueRaw(JSON.stringify(value ?? null, null, 2));
    setStatEditError("");
    setIsStatEditModalOpen(true);
  };

  const saveStatEdit = async () => {
    if (!statEditTarget || !statEditPath.trim()) {
      setStatEditError("Stat path is required.");
      return;
    }
    let parsedValue: unknown = statEditValueRaw;
    try {
      parsedValue = JSON.parse(statEditValueRaw);
    } catch {
      // Fallback: treat invalid JSON input as plain string.
      parsedValue = statEditValueRaw;
    }
    const next = JSON.parse(JSON.stringify(statEditTarget.json)) as Character.TCharacter;
    const ok = setByPath(next, statEditPath.trim(), parsedValue);
    if (!ok) {
      setStatEditError("Invalid stat path.");
      return;
    }
    setStatEditBusy(true);
    try {
      await persistCharacterUpdate({
        uid: statEditTarget.uid,
        advId: statEditTarget.advId,
        json: next,
        entry: statEditTarget.entry,
        errorPrefix: `Failed to update ${statEditTarget.label}`,
        onSuccess: () => {
          setIsStatEditModalOpen(false);
          setStatEditTarget(null);
          setStatEditPath("");
          setStatEditValueRaw("");
          setStatEditError("");
        },
      });
    } finally {
      setStatEditBusy(false);
    }
  };

  const updateCharacterPath = async (
    entry: CharacterIdentity,
    json: Character.TCharacter | null,
    path: string,
    value: unknown,
    label: string
  ) => {
    if (!json) return;
    const next = JSON.parse(JSON.stringify(json)) as Character.TCharacter;
    if (!setByPath(next, path, value)) {
      setError(`Failed to update ${label}: invalid path`);
      return;
    }
    await persistCharacterUpdate({
      uid: entry.id,
      advId,
      json: next,
      entry,
      errorPrefix: `Failed to update ${label}`,
    });
  };

  const grantXpToCharacter = async (
    entry: CharacterIdentity,
    xpDelta: number,
    overrideCharacter?: Character.TCharacter | null
  ) => {
    const amount = Math.floor(Number(xpDelta || 0));
    if (!advId || !entry.full || amount === 0 || xpBusy) return;
    try {
      setXpBusy(true);
      const response = await requestCharacters<Character.TCharacterServer>({
        endPoint: "/grantXp",
        body: {
          uid: entry.id,
          advId,
          xpDelta: amount,
        },
      });
      const parsed = parseCharacterPayload(response.data);
      if (!parsed.json) return;
      const row = response.data as { hash?: string };
      const nextEntry = commitUpdatedCharacter(
        entry,
        parsed.json,
        parsed.computed,
        row.hash
      );
      openCharacterDataWindow(nextEntry, parsed.json || overrideCharacter);
      setXpByUid((prev) => ({ ...prev, [entry.id]: 0 }));
    } catch (error) {
      setError("Failed to give XP: " + error);
    } finally {
      setXpBusy(false);
    }
  };

  const getVisibleSpellsForCharacter = (character: Character.TCharacter | null | undefined) => {
    const classDef = classes.find((x) => x.name === String(character?.class || ""));
    const levelCap = computeSpellVisibilityCap(character?.level?.current || 1);
    const activeSpecialization = String(character?.rp?.specialization || "").trim().toLowerCase();
    return (classDef?.spells || [])
      .filter((spell) => Number(spell.lvlReq || 0) <= levelCap)
      .filter((spell) => {
        const spec = String(spell.spec || "").trim().toLowerCase();
        if (!spec || spec === "common") return true;
        if (!activeSpecialization) return false;
        return spec === activeSpecialization;
      });
  };

  const renderAdminCharacterSpellsWindow: TWindowDescriptorRenderer = (descriptor, props) => {
    const uid = descriptor.params?.uid || "";
    const entry = characters.find((candidate) => candidate.id === uid);
    const character = entry?.full || null;
    const levelCap = computeSpellVisibilityCap(character?.level?.current || 1);
    return (
      <RndContainer
        id={`admin-character-spells-${advId}-${uid}`}
        close={props.close}
        minimize={props.minimize}
        selectWindow={props.selectWindow}
        zIndex={props.zIndex}
        label={descriptor.title}
        aditionalIcons={null}
        className={props.classes}
      >
        <CharacterSpellsPanel
          spells={getVisibleSpellsForCharacter(character)}
          levelCap={levelCap}
          selectedSpecialization={character?.rp?.specialization || undefined}
        />
      </RndContainer>
    );
  };

  const renderAdminCharacterSecondaryWindow: TWindowDescriptorRenderer = (descriptor, props) => {
    const uid = descriptor.params?.uid || "";
    const entry = characters.find((candidate) => candidate.id === uid);
    const character = entry?.full || null;
    return (
      <RndContainer
        id={`admin-character-secondary-${advId}-${uid}`}
        close={props.close}
        minimize={props.minimize}
        selectWindow={props.selectWindow}
        zIndex={props.zIndex}
        label={descriptor.title}
        aditionalIcons={null}
        className={props.classes}
      >
        <CharacterSecondarySkillsPanel
          secondaryStats={character?.secondaryStats || []}
          currentLevel={character?.level?.current || 1}
          spend={
            entry && character
              ? {
                  advId,
                  uid,
                  expectedHash: entry.hash || "",
                  availablePoints: Number(character.secondarySkillPoints || 0),
                  onUpdated: (payload) => {
                    const parsed = parseCharacterPayload(payload);
                    if (!parsed.json) return;
                    const row = payload as { hash?: string };
                    commitUpdatedCharacter(entry, parsed.json, parsed.computed, row.hash);
                  },
                }
              : undefined
          }
        />
      </RndContainer>
    );
  };

  const buildCharacterDataWindow = (
    entry: CharacterIdentity,
    close: () => void,
    windowClasses?: string,
    overrideCharacter?: Character.TCharacter | null
  ) => {
    const c = overrideCharacter ?? entry.full;
    const characterClassName = c?.class || entry.className;
    const classDef = classes.find((x) => x.name === characterClassName);
    const secondarySkills = c?.secondaryStats || [];
    const inventoryItems = (c?.inventory?.backpacks || []).flatMap((bp, bpIndex) => {
      const width = Math.max(1, Number(bp.size?.sizeX || 1));
      return (bp.items || []).map((wrapped, itemIndex) => ({
        bpIndex,
        storageId: String(bp.id || (bp.isDefault ? "storage_default" : `storage_${bpIndex + 1}`)),
        storageLabel: String(bp.label || (bp.isDefault ? "Default" : `Storage ${bpIndex + 1}`)),
        itemIndex,
        storageIndex: wrapped.placement?.slot
          ? Math.max(0, Number(wrapped.placement.slot.placeY || 0)) * width +
            Math.max(0, Number(wrapped.placement.slot.placeX || 0))
          : itemIndex,
        amount: wrapped.amount || 0,
        item: wrapped.item,
        additionalAuras: wrapped.additionalAuras || [],
        placement: wrapped.placement,
        bag: wrapped.bag,
      }));
    });
    const equippedItems = inventoryItems.filter(
      (row) => !!row.item?.equipable && !!row.placement?.equippedSlotId
    );
    const removeCharacterItem = (source: ServerApi.CharacterRoutes.ItemActionSource) => {
      requestCharacters<Character.TCharacterServer>({
        endPoint: "/dropItem",
        body: {
          uid: entry.id,
          advId,
          source,
        },
      })
        .then((response) => {
          const parsed = parseCharacterPayload(response.data);
          if (!parsed.json) return;
          const row = response.data as { hash?: string };
          const nextEntry = commitUpdatedCharacter(
            entry,
            parsed.json,
            parsed.computed,
            row.hash
          );
          openCharacterDataWindow(nextEntry, parsed.json);
        })
        .catch((error) => {
          setError("Failed to remove item: " + error);
        });
    };
    const equippedStorageOwners = new Map<string, string>();
    inventoryItems.forEach((row) => {
      const bag = (row as typeof row & { bag?: Character.Item.TBagInstance }).bag;
      if (!bag?.id) return;
      if (bag.state !== "equipped" && !row.placement?.equippedSlotId) return;
      equippedStorageOwners.set(bag.id, row.item.name);
    });
    const inventoryStorageGroups = (c?.inventory?.backpacks || []).map((bp, bpIndex) => {
      const storageId = String(bp.id || (bp.isDefault ? "storage_default" : `storage_${bpIndex + 1}`));
      const isDefault = bp.isDefault || storageId === "storage_default";
      const ownerName = equippedStorageOwners.get(storageId);
      return {
        storageId,
        label: isDefault
          ? "Default"
          : ownerName || String(bp.label || `Storage ${bpIndex + 1}`),
        bpIndex,
        isDefault,
        isActiveBagStorage: !isDefault && equippedStorageOwners.has(storageId),
        items: inventoryItems.filter(
          (row) => row.bpIndex === bpIndex && !row.placement?.equippedSlotId
        ),
      };
    });
    const characterAuras = c?.auras || [];
    const money = c?.inventory?.money || [
      { name: Character.Item.MONEY.GOLD, amount: 0 },
      { name: Character.Item.MONEY.SILVER, amount: 0 },
      { name: Character.Item.MONEY.COPPER, amount: 0 },
    ];
    const gold = Number(money[0]?.amount || 0);
    const silver = Number(money[1]?.amount || 0);
    const copper = Number(money[2]?.amount || 0);
    const EditableStat = ({
      label,
      path,
      value,
      className = "",
    }: {
      label: string;
      path: string;
      value: unknown;
      className?: string;
    }) => (
      <button
        type="button"
        className={`text-left underline decoration-dotted underline-offset-2 hover:text-blue-800 cursor-pointer select-none ${className}`}
        onClick={() => {
          if (!c) return;
          openStatEditor({
            uid: entry.id,
            advId,
            entry,
            json: c,
            label,
            path,
            value,
          });
        }}
        title={`Edit ${label}`}
    >
        {String(value ?? "-")}
      </button>
    );
    const EditableSelect = ({
      label,
      path,
      value,
      options,
      placeholder = "-",
      disabled = false,
    }: {
      label: string;
      path: string;
      value: string | number;
      options: Array<{ label: string; value: string | number }>;
      placeholder?: string;
      disabled?: boolean;
    }) => (
      <select
        className="w-full min-w-[120px] px-1 py-0.5 rounded text-black"
        value={String(value ?? "")}
        disabled={disabled || !c || options.length < 1}
        title={`Edit ${label}`}
        onChange={(e) => {
          const rawValue = (e.currentTarget as HTMLSelectElement).value;
          const nextValue = typeof value === "number" ? Number(rawValue) : rawValue;
          void updateCharacterPath(entry, c, path, nextValue, label);
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={`${entry.id}-${label}-${option.value}`} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
    const EditableList = ({
      label,
      path,
      values,
      options,
    }: {
      label: string;
      path: string;
      values: string[];
      options: string[];
    }) => {
      const selected = options.find((option) => !values.includes(option)) || "";
      const setValues = (nextValues: string[]) => {
        void updateCharacterPath(entry, c, path, nextValues, label);
      };
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <select
              className="min-w-[120px] px-1 py-0.5 rounded text-black"
              disabled={!c || !selected}
              defaultValue={selected}
              onChange={() => {}}
              data-list-select={`${entry.id}-${path}`}
            >
              {options
                .filter((option) => !values.includes(option))
                .map((option) => (
                  <option key={`${entry.id}-${label}-add-${option}`} value={option}>
                    {option}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="fancy-container px-2 py-0.5"
              disabled={!c || !selected}
              onClick={(e) => {
                const root = (e.currentTarget as HTMLButtonElement).parentElement;
                const select = root?.querySelector("select") as HTMLSelectElement | null;
                const value = String(select?.value || selected).trim();
                if (!value || values.includes(value)) return;
                setValues([...values, value]);
              }}
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {values.length < 1 ? <span>-</span> : null}
            {values.map((value) => (
              <span
                key={`${entry.id}-${label}-value-${value}`}
                className="inline-flex items-center gap-1 border border-slate-500 rounded px-1"
              >
                {value}
                <button
                  type="button"
                  className="px-1"
                  disabled={!c}
                  onClick={() => setValues(values.filter((item) => item !== value))}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      );
    };
    const specializationOptions = (classDef?.specs || []).map((spec) => ({
      label: spec.name,
      value: spec.name,
    }));
    const religionOptions = religions.map((religion) => ({
      label: religion.name,
      value: religion.name,
    }));
    const languageOptions = descents.map((descent) => descent.name);
    const visibleSpells = getVisibleSpellsForCharacter(c);
    const openAdminSpellsWindow = () => {
      openCharacterSpellsWindow(entry);
    };
    const openAdminSecondaryStatsWindow = () => {
      openCharacterSecondaryWindow(entry);
    };
    const adjustOrbs = async (key: keyof Character.TOrbs, delta: number) => {
      if (!c) return;
      const nextOrbs: Character.TOrbs = {
        black: Math.max(0, Number(c.orbs?.black || 0)),
        white: Math.max(0, Number(c.orbs?.white || 0)),
        voidorb: Math.max(0, Number(c.orbs?.voidorb || 0)),
      };
      nextOrbs[key] = Math.max(0, nextOrbs[key] + delta);
      await persistCharacterUpdate({
        uid: entry.id,
        advId,
        json: {
          ...c,
          orbs: nextOrbs,
        },
        entry,
        errorPrefix: "Failed to update orbs",
      });
    };
    const saveAdminDamagePanel = async (nextCharacter: Character.TCharacter) => {
      await persistCharacterUpdate({
        uid: entry.id,
        advId,
        json: nextCharacter,
        entry,
        errorPrefix: "Failed to update damage/heal",
      });
    };
    return (
      <RndContainer
        id={`adv_char_data_${advId}_${entry.id}`}
        close={close}
        label={`Character Data - ${entry.name}`}
        aditionalIcons={null}
        className={windowClasses}
      >
          <div className="w-full h-full min-h-0 p-2 text-sm grid grid-cols-1 lg:grid-cols-3 gap-2 auto-rows-fr overflow-auto">
            <div className="min-h-0 overflow-auto p-1 border border-slate-500 rounded">
              <p className="font-semibold mb-1">Alapadatok</p>
              <div className="flex flex-col gap-1 text-xs">
                <p><span className="font-semibold">Játékos UID:</span> {entry.id}</p>
                <p><span className="font-semibold">Név:</span> {entry.name || "-"}</p>
                <p><span className="font-semibold">Faj:</span> {c?.descent || "-"}</p>
                <p><span className="font-semibold">Kaszt:</span> {c?.class || "-"}</p>
                <p><span className="font-semibold">Szint:</span> {c?.level?.current || 1}</p>
                <p><span className="font-semibold">XP:</span> {c?.level?.currentXp ?? 0}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold">XP hozzáadása:</span>
                  <input
                    type="number"
                    className="w-24 px-1 py-0.5 rounded text-black"
                    value={xpByUid[entry.id] ?? 0}
                    disabled={xpBusy || !c}
                    onInput={(e) => {
                      const value = Number((e.currentTarget as HTMLInputElement).value || 0);
                      setXpByUid((prev) => ({ ...prev, [entry.id]: value }));
                    }}
                  />
                  <button
                    type="button"
                    className="fancy-container px-2 py-0.5"
                    disabled={xpBusy || !c || Number(xpByUid[entry.id] || 0) === 0}
                    onClick={() => void grantXpToCharacter(entry, Number(xpByUid[entry.id] || 0), c)}
                  >
                    Add XP
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">Orbok:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                    {([
                      ["black", "Fekete"],
                      ["white", "Fehér"],
                      ["voidorb", "Pszi"],
                    ] as Array<[keyof Character.TOrbs, string]>).map(([key, label]) => {
                      const value = Math.max(0, Number(c?.orbs?.[key] || 0));
                      return (
                        <div
                          key={`${entry.id}-orb-${key}`}
                          className="flex items-center justify-between gap-1 border border-slate-500 rounded px-1 py-0.5"
                        >
                          <span>{label}: {value}</span>
                          <span className="flex gap-0.5">
                            <button
                              type="button"
                              className="fancy-container px-1 py-0.5"
                              disabled={!c || value < 1}
                              onClick={() => void adjustOrbs(key, -1)}
                              title={`${label} orb kivétele`}
                            >
                              -
                            </button>
                            <button
                              type="button"
                              className="fancy-container px-1 py-0.5"
                              disabled={!c}
                              onClick={() => void adjustOrbs(key, 1)}
                              title={`${label} orb hozzáadása`}
                            >
                              +
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p><span className="font-semibold">Jellem:</span> {c?.rp?.personality || "-"}</p>
                <div>
                  <span className="font-semibold">Hit:</span>{" "}
                  <EditableSelect
                    label="Hit"
                    path="rp.religion"
                    value={c?.rp?.religion || ""}
                    options={religionOptions}
                  />
                </div>
                <div>
                  <span className="font-semibold">Szakosodás:</span>{" "}
                  <EditableSelect
                    label="Szakosodás"
                    path="rp.specialization"
                    value={c?.rp?.specialization || ""}
                    options={specializationOptions}
                    placeholder={
                      Number(c?.level?.current || 1) >= 10
                        ? "Select specialization"
                        : "Level 10 required"
                    }
                    disabled={Number(c?.level?.current || 1) < 10}
                  />
                </div>
                <div>
                  <span className="font-semibold">Nyelvek:</span>
                  <EditableList
                    label="Nyelvek"
                    path="rp.knownLanguages"
                    values={c?.rp?.knownLanguages || []}
                    options={languageOptions}
                  />
                </div>
                <p>
                  <span className="font-semibold">HP:</span>{" "}
                  <EditableStat label="Current HP" path="resource.health.currentHp" value={c?.resource?.health?.currentHp ?? 0} /> /{" "}
                  <EditableStat label="Max HP" path="resource.health.maxHp" value={c?.resource?.health?.maxHp ?? 0} />
                </p>
                <div>
                  <span className="font-semibold">Képzettségek:</span>{" "}
                  <EditableStat label="Képzettségek" path="rp.professions" value={c?.rp?.professions || []} />
                </div>
                <p>
                  <span className="font-semibold">EP:</span>{" "}
                  <EditableStat label="Current EP" path="resource.health.currentEp" value={c?.resource?.health?.currentEp ?? 0} /> /{" "}
                  <EditableStat label="Max EP" path="resource.health.maxEp" value={c?.resource?.health?.maxEp ?? 0} />
                </p>
                <p>
                  <span className="font-semibold">TÉ/VÉ:</span>{" "}
                  <EditableStat label="ATK" path="hm.ATK" value={entry.hm.ATK} /> /{" "}
                  <EditableStat label="DEF" path="hm.DEF" value={entry.hm.DEF} />
                </p>
                <p>
                  <span className="font-semibold">KÉ/CÉ:</span>{" "}
                  <EditableStat label="INI" path="hm.INI" value={entry.hm.INI} /> /{" "}
                  <EditableStat label="AIM" path="hm.AIM" value={entry.hm.AIM} />
                </p>
              </div>
              <div className="mt-2">
                <p className="font-semibold mb-1">Elsődleges tulajdonságok (szerkeszthető)</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  {(c?.primaryStats || []).map((stat, idx) => (
                    <div key={`${entry.id}-primary-edit-${stat.name}-${idx}`} className="flex gap-1">
                      <span className="font-semibold">{stat.name}:</span>
                      <EditableStat
                        label={`Primary ${stat.name}`}
                        path={`primaryStats[${idx}].val`}
                        value={stat.val ?? 0}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-semibold">RP adatok</summary>
                <div className="mt-1 grid grid-cols-1 gap-1">
                  <p><span className="font-semibold">Kor:</span> {c?.rp?.age ?? "-"}</p>
                  <p><span className="font-semibold">Nem:</span> {c?.rp?.bioType || "-"}</p>
                  <p><span className="font-semibold">Magasság:</span> {c?.rp?.height ?? "-"}</p>
                  <p><span className="font-semibold">Súly:</span> {c?.rp?.weight ?? "-"}</p>
                  <p><span className="font-semibold">Bőrszín:</span> {c?.rp?.skinColor || "-"}</p>
                  <p><span className="font-semibold">Haj:</span> {c?.rp?.hair || "-"}</p>
                  <p><span className="font-semibold">Szem:</span> {c?.rp?.eyes || "-"}</p>
                  <p><span className="font-semibold">Születési hely:</span> {c?.rp?.bornPlace || "-"}</p>
                  <p><span className="font-semibold">Iskolák:</span> {c?.rp?.schools || "-"}</p>
                  <p className="whitespace-pre-wrap break-words">
                    <span className="font-semibold">Leírás:</span> {c?.rp?.description || "-"}
                  </p>
                </div>
              </details>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col">
              <p className="font-semibold mb-1">Karakter ablakok</p>
              <div className="flex flex-col gap-2 text-xs">
                <button
                  type="button"
                  className="fancy-container px-2 py-1 text-left"
                  onClick={openAdminSpellsWindow}
                >
                  Varázslatok ({visibleSpells.length})
                </button>
                <button
                  type="button"
                  className="fancy-container px-2 py-1 text-left"
                  onClick={openAdminSecondaryStatsWindow}
                >
                  Képzettségek ({secondarySkills.length})
                </button>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col">
              {c ? (
                <AdminCharacterDamagePanel
                  character={c}
                  onSave={saveAdminDamagePanel}
                />
              ) : (
                <p>-</p>
              )}
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col md:col-span-1">
              <p className="font-semibold mb-1">Felszerelt tárgyak</p>
              <div className="min-h-0 grow overflow-y-auto">
                {equippedItems.length === 0 ? (
                  <p>-</p>
                ) : (
                  <table className="w-full border-collapse">
                    <tbody>
                      {equippedItems.map((row) => (
                        <tr key={`${entry.id}-eq-${row.bpIndex}-${row.itemIndex}`}>
                          <td className="pr-2 font-semibold">
                            <span
                              className="cursor-help"
                              onMouseEnter={(e) => {
                                setHoveredItem(row.item);
                                setHoverPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseMove={(e) => {
                                setHoverPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              {row.item.name}
                            </span>
                          </td>
                          <td>{row.item.equipable}</td>
                          <td>x{row.amount}</td>
                          <td>
                            <button
                              type="button"
                              className="fancy-container px-2 py-0.5"
                              onClick={() =>
                                removeCharacterItem({
                                  from: "equipment",
                                  index: row.placement?.equippedSlotId
                                    ? ADMIN_EQUIPMENT_SLOT_IDS.indexOf(
                                        row.placement.equippedSlotId as (typeof ADMIN_EQUIPMENT_SLOT_IDS)[number]
                                      )
                                    : -1,
                                })
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col md:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">Aurák / hatások</p>
                <button
                  type="button"
                  className="fancy-container px-2 py-0.5"
                  onClick={() => {
                    if (!c) return;
                    setAuraTarget({ uid: entry.id, advId, json: c, entry });
                    setAuraDraft(createEmptyAuraEditorDraft());
                    setIsAuraModalOpen(true);
                  }}
                >
                  + Add Aura
                </button>
              </div>
              <div className="min-h-0 grow overflow-y-auto">
                {characterAuras.length === 0 ? (
                  <p>-</p>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {characterAuras.map((aura) => (
                        <tr key={`${entry.id}-aura-${aura.id}`}>
                          <td className="pr-2 align-top">
                            <AuraDisplay aura={aura} />
                          </td>
                          <td className="w-[132px] align-top">
                            <button
                              type="button"
                              className="fancy-container px-2 py-0.5 mr-1"
                              onClick={() => {
                                if (!c) return;
                                setAuraTarget({
                                  uid: entry.id,
                                  advId,
                                  json: c,
                                  entry,
                                  auraId: aura.id,
                                });
                                setAuraDraft(
                                  createEmptyAuraEditorDraft({
                                    name: aura.name || "",
                                    description: aura.description || "",
                                    color: aura.color || "#888888",
                                    effect: Array.isArray(aura.effect) ? aura.effect : [],
                                    modifiers: Array.isArray(aura.modifiers) ? aura.modifiers : [],
                                  })
                                );
                                setIsAuraModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="fancy-container px-2 py-0.5"
                              onClick={() => {
                                if (!c) return;
                                const next = JSON.parse(JSON.stringify(c)) as Character.TCharacter;
                                next.auras = (next.auras || []).filter((x) => x.id !== aura.id);
                                void persistCharacterUpdate({
                                  uid: entry.id,
                                  advId,
                                  json: next,
                                  entry,
                                  errorPrefix: "Failed to remove aura",
                                });
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col md:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">Felszereléslista</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="fancy-container px-2 py-0.5"
                    onClick={() => {
                      if (!c) return;
                      setMoneyTarget({ uid: entry.id, advId, json: c, entry });
                      setMoneyDraft({
                        gold,
                        silver,
                        copper,
                        mode: "set",
                      });
                      setIsMoneyModalOpen(true);
                    }}
                  >
                    Money
                  </button>
                  <button
                    type="button"
                    className="fancy-container px-2 py-0.5"
                    onClick={() => {
                      if (!c) return;
                      setAddTarget({
                        uid: entry.id,
                        advId,
                        json: c,
                        entry,
                      });
                      setItemSearch("");
                      setItemQty(1);
                      setAddBusy(true);
                      requestRest<{ items: Character.Item.TItem[]; hash?: string }>({
                        endPoint: "/getAllItems",
                        body: {},
                      })
                        .then((response) => {
                          const items = Array.isArray(response.data?.items) ? response.data.items : [];
                          setAllItems(items);
                          setItemResults(items.slice(0, 100));
                          setIsAddItemModalOpen(true);
                        })
                        .catch((error) => {
                          setError("Failed to load item catalog: " + error);
                        })
                        .finally(() => setAddBusy(false));
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
              <p className="text-xs mb-1">
                <MoneyDisplay copper={inventoryMoneyToCopper(money)} className="text-xs" />
              </p>
              <div className="min-h-0 grow overflow-y-auto flex flex-col gap-2">
                {inventoryStorageGroups.length === 0 ? (
                  <p>-</p>
                ) : (
                  inventoryStorageGroups.map((group) => (
                    <div
                      key={`${entry.id}-storage-${group.storageId}`}
                      className="border border-slate-600 rounded p-1"
                    >
                      <p className="font-semibold text-xs mb-1">
                        {group.label}
                        {group.isDefault
                          ? " (default)"
                          : group.isActiveBagStorage
                            ? " (equipped storage)"
                            : " (stored storage)"}
                      </p>
                      {group.items.length === 0 ? (
                        <p className="text-xs">-</p>
                      ) : (
                        <table className="w-full border-collapse">
                          <tbody>
                            {group.items.map((row) => (
                              <tr key={`${entry.id}-inv-${row.bpIndex}-${row.itemIndex}`}>
                                <td className="pr-2 font-semibold">
                                  <span
                                    className="cursor-help"
                                    onMouseEnter={(e) => {
                                      setHoveredItem(row.item);
                                      setHoverPos({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseMove={(e) => {
                                      setHoverPos({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseLeave={() => setHoveredItem(null)}
                                  >
                                    {row.item.name}
                                  </span>
                                </td>
                                <td>{row.item.equipable ? `EQ: ${row.item.equipable}` : "Bag item"}</td>
                                <td>x{row.amount}</td>
                                <td>
                                  <div className="text-xs pr-2 min-w-[160px]">
                                    {Array.isArray(row.additionalAuras) && row.additionalAuras.length > 0 ? (
                                      <div className="flex flex-col gap-0.5 mb-0.5">
                                        {row.additionalAuras.map((aura, auraIndex) => (
                                          <AuraDisplay
                                            key={`${entry.id}-item-aura-${row.bpIndex}-${row.itemIndex}-${auraIndex}`}
                                            aura={aura}
                                            sourceLabel="item"
                                            showName={false}
                                            showColorDot={false}
                                          />
                                        ))}
                                      </div>
                                    ) : (
                                      <span>Auras: 0</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="fancy-container px-2 py-0.5 mr-1"
                                    onClick={() => {
                                      if (!c) return;
                                      setItemAuraTarget({
                                        uid: entry.id,
                                        advId,
                                        json: c,
                                        entry,
                                        bpIndex: row.bpIndex,
                                        itemIndex: row.itemIndex,
                                        itemName: row.item.name,
                                      });
                                      setItemAuraDraft(createEmptyAuraEditorDraft({ color: "" }));
                                      setIsItemAuraModalOpen(true);
                                    }}
                                  >
                                    +Aura
                                  </button>
                                  <button
                                    type="button"
                                    className="fancy-container px-2 py-0.5"
                                    onClick={() => {
                                      if (!c) return;
                                      const next = JSON.parse(JSON.stringify(c)) as Character.TCharacter;
                                      const bp = next.inventory?.backpacks?.[row.bpIndex];
                                      const selected = bp?.items?.[row.itemIndex];
                                      if (!selected) return;
                                      const current = Array.isArray(selected.additionalAuras)
                                        ? selected.additionalAuras
                                        : [];
                                      if (current.length < 1) return;
                                      selected.additionalAuras = current.slice(0, current.length - 1);
                                      void persistCharacterUpdate({
                                        uid: entry.id,
                                        advId,
                                        json: next,
                                        entry,
                                        errorPrefix: "Failed to remove item aura",
                                      });
                                    }}
                                  >
                                    -Aura
                                  </button>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="fancy-container px-2 py-0.5"
                                    onClick={() =>
                                      removeCharacterItem({
                                        from: "storage",
                                        index: row.storageIndex,
                                        storageId: row.storageId,
                                      })
                                    }
                                  >
                                    -1
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
      </RndContainer>
    );
  };

  const openCharacterDataWindow = (entry: CharacterIdentity, overrideCharacter?: Character.TCharacter | null) => {
    addWindow(buildAdventureCharacterDataWindowDescriptor(advId, entry));
    if (overrideCharacter) {
      updateWindow(
        `ADV-CHAR-DATA-${advId}-${entry.id}`,
        buildAdventureCharacterDataWindowDescriptor(advId, entry)
      );
    }
  };

  const openCharacterSpellsWindow = (entry: CharacterIdentity) => {
    addWindow(buildAdminCharacterSubWindow({
      advId,
      uid: entry.id,
      kind: "admin-adventure-character-spells",
      title: `Varázslatok - ${entry.name}`,
      icon: "SP",
    }));
  };

  const openCharacterSecondaryWindow = (entry: CharacterIdentity) => {
    addWindow(buildAdminCharacterSubWindow({
      advId,
      uid: entry.id,
      kind: "admin-adventure-character-secondary",
      title: `Képzettségek - ${entry.name}`,
      icon: "KS",
    }));
  };

  useEffect(() => {
    registerWindowDescriptorRenderer(
      "admin-adventure-character-spells",
      renderAdminCharacterSpellsWindow
    );
    registerWindowDescriptorRenderer(
      "admin-adventure-character-secondary",
      renderAdminCharacterSecondaryWindow
    );
    setCharacterDataRenderer(buildCharacterDataWindow);
    return () => {
      unregisterWindowDescriptorRenderer(
        "admin-adventure-character-spells",
        renderAdminCharacterSpellsWindow
      );
      unregisterWindowDescriptorRenderer(
        "admin-adventure-character-secondary",
        renderAdminCharacterSecondaryWindow
      );
      setCharacterDataRenderer(null);
    };
  });

  const combatBoardRows = useMemo(() => {
    if (!combatMode || combatInitiatives.length < 1) {
      return characters.slice(0, 7).map((entry) => ({
        type: "character" as const,
        key: `character:${entry.id}`,
        entry,
      }));
    }
    return combatInitiatives
      .map((row) => {
        if (row.kind === "npc") {
          return {
            type: "npc" as const,
            key: row.uid,
            row,
          };
        }
        const entry = characters.find((candidate) => candidate.id === row.uid);
        if (!entry) return null;
        return {
          type: "character" as const,
          key: `character:${entry.id}`,
          entry,
          row,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row)
      .slice(0, 7);
  }, [characters, combatInitiatives, combatMode]);

  const renderCharacterCard = (entry: CharacterIdentity) => (
    <div
      key={`adv-char-cell-${entry.id}`}
      className="min-h-[150px] border border-slate-400 rounded-md p-3 bg-white/60 select-none cursor-pointer"
      onClick={() => openCharacterDataWindow(entry)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold truncate">{entry.name}</p>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="px-2 py-0.5 rounded border border-slate-400 bg-slate-100 text-slate-900 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                openCharacterSpellsWindow(entry);
              }}
            >
              Spells
            </button>
            <button
              type="button"
              className="px-2 py-0.5 rounded border border-slate-400 bg-slate-100 text-slate-900 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                openCharacterSecondaryWindow(entry);
              }}
            >
              Skills
            </button>
          </div>
        </div>
        <p className="text-xs opacity-70 truncate">{userNamesByUid[entry.id] || entry.id}</p>
        <p>Race: {entry.race}</p>
        <p>Class: {entry.className}</p>
        <p>Level: {entry.level}</p>
        <p className="mt-1 font-medium">HM</p>
        <p>
          ATK: {entry.hm.ATK} | DEF: {entry.hm.DEF} | INI: {entry.hm.INI} | AIM: {entry.hm.AIM}
        </p>
        <p className="mt-1 font-medium">Primary Stats</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
          {entry.primaryStats.map((stat) => (
            <p key={`${entry.id}-${stat.name}`}>
              {stat.name}: {stat.val ?? 0}
            </p>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNpcCard = (row: Adventure.TCombatInitiative) => (
    <div
      key={`adv-npc-cell-${row.uid}`}
      className={`min-h-[150px] border rounded-md p-3 select-none ${
        row.side === "friendly"
          ? "border-emerald-500 bg-emerald-50/70"
          : "border-red-500 bg-red-50/70"
      }`}
    >
      <div className="flex flex-col gap-1">
        <p className="font-semibold truncate">{row.name}</p>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs opacity-70 truncate">
            {row.side === "friendly" ? "Baráti NJK" : "Ellenséges NJK"}
          </p>
          <button
            type="button"
            className="px-2 py-0.5 rounded border border-slate-400 bg-slate-100 text-slate-900 text-xs"
            onClick={() => openNpcManageModal(row)}
          >
            Kezelés
          </button>
        </div>
        <p>Initiative: {row.total}</p>
        <p>
          FP: {row.resource?.health?.currentHp ?? 0}/{row.resource?.health?.maxHp ?? 0} | EP:{" "}
          {row.resource?.health?.currentEp ?? 0}/{row.resource?.health?.maxEp ?? 0}
        </p>
        <p>
          {row.resource?.abilities?.name || Character.RESOURCE_TYPE.MANA}:{" "}
          {row.resource?.abilities?.current ?? 0}/{row.resource?.abilities?.max ?? 0}
        </p>
        <p className="mt-1 font-medium">HM</p>
        <p>
          ATK: {row.hm?.ATK ?? 0} | DEF: {row.hm?.DEF ?? 0} | INI: {row.hm?.INI ?? row.baseInitiative} | AIM: {row.hm?.AIM ?? 0}
        </p>
        <p className="mt-1 font-medium">Primary Stats</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
          {(row.primaryStats || []).map((stat) => (
            <p key={`${row.uid}-${stat.name}`}>
              {stat.name}: {stat.val ?? 0}
            </p>
          ))}
        </div>
        {row.notes ? <p className="text-xs mt-1">{row.notes}</p> : null}
      </div>
    </div>
  );

  return (
    <div className="admin-adventures-page w-full h-full fancy-container p-2 sm:p-4 relative overflow-auto">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Kaland szereplői</h2>
        {isLoading ? <span>Loading...</span> : <span>{characters.length} total</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="min-h-[150px] border border-slate-400 rounded-md p-3 bg-white/60 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold">Parancsok</p>
            <span className="text-sm">Turn: {turn}</span>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <p>Current: {formatClientDateTime(adventureMeta?.json.worldDateCurrent)}</p>
            <p>Started: {formatClientDateTime(adventureMeta?.json.worldDateStart)}</p>
          </div>
          {combatMode ? (
            <div className="rounded border border-red-300 bg-red-50/70 p-2 text-xs">
              <p className="font-semibold mb-1">Kezdeményezés</p>
              {combatInitiatives.length < 1 ? (
                <p>-</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                   {combatInitiatives.map((row) => (
                     <p key={`combat-initiative-${row.uid}`}>
                       {row.name}:{" "}
                       {row.rollSubmitted || row.roll > 0
                         ? `${row.total} (${row.baseInitiative}+k10 ${row.roll})`
                         : `pending (${row.baseInitiative}+k10 ?)`}
                     </p>
                   ))}
                </div>
              )}
            </div>
          ) : null}
          <div className="flex items-center gap-1 flex-wrap">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded border border-slate-400 bg-slate-100"
              value={adventureDateStep}
              onInput={(e) => {
                const nextValue = Number((e.currentTarget as HTMLInputElement).value || 0);
                setAdventureDateStep(Number.isFinite(nextValue) ? nextValue : 0);
              }}
            />
            <button
              type="button"
              className="px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
              disabled={adventureDateBusy || !adventureMeta}
              onClick={() => void updateAdventureDateBy(adventureDateStep * 24 * 60 * 60 * 1000)}
            >
              Day
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
              disabled={adventureDateBusy || !adventureMeta}
              onClick={() => void updateAdventureDateBy(adventureDateStep * 60 * 60 * 1000)}
            >
              Hour
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
              disabled={adventureDateBusy || !adventureMeta}
              onClick={() => void updateAdventureDateBy(adventureDateStep * 60 * 1000)}
            >
              Min
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1">
            <button
              type="button"
              className="px-3 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
              onClick={openGiveXpModal}
            >
              Give XP
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded border ${
                combatMode
                  ? "bg-red-700 text-white border-red-800"
                  : "bg-slate-100 text-slate-900 border-slate-400"
              }`}
              onClick={() => setCombatEnabled(!combatMode)}
            >
              {combatMode ? "Combat Mode: ON" : "Combat Mode: OFF"}
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded border ${
                vendorState?.enabled
                  ? "bg-emerald-700 text-white border-emerald-800"
                  : "bg-slate-100 text-slate-900 border-slate-400"
              }`}
              disabled={combatMode || (!vendorState?.enabled && !selectedVendorId)}
              onClick={() => setVendorEnabled(!vendorState?.enabled)}
            >
              {vendorState?.enabled ? "Vendor Mode: ON" : "Vendor Mode: OFF"}
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
              disabled={!combatMode}
              onClick={advanceCombatTurn}
            >
              Next Turn
            </button>
            <div className="grid grid-cols-1 gap-1 rounded border border-slate-400 bg-white/50 p-1">
              <p className="text-xs font-semibold">Harc</p>
              <select
                className="px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
                value={selectedCombatId}
                disabled={combatMode}
                onChange={(e) => setSelectedCombatId(e.currentTarget.value)}
              >
                <option value="">Harc kiválasztása</option>
                {combats.map((combat) => (
                  <option key={combat.id} value={combat.id}>{combat.name}</option>
                ))}
              </select>
              <p className="text-xs opacity-80">
                {combatMode
                  ? `Active combat: ${combats.find((combat) => combat.id === selectedCombatId)?.name || "selected"}`
                  : selectedCombatId
                  ? "Ready to start combat mode."
                  : "Select a combat first."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-1 rounded border border-slate-400 bg-white/50 p-1">
              <p className="text-xs font-semibold">Kereskedő mód</p>
              <select
                className="px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
                value={selectedVendorId}
                disabled={Boolean(vendorState?.enabled)}
                onChange={(e) => setSelectedVendorId(e.currentTarget.value)}
              >
                <option value="">Kereskedő kiválasztása</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
              <p className="text-xs opacity-80">
                {combatMode
                  ? "Disabled while combat mode is on."
                  : vendorState?.enabled
                  ? `Active vendor: ${vendorState.vendorName}`
                  : selectedVendorId
                  ? "Ready to start vendor mode."
                  : "Select a vendor first."}
              </p>
            </div>
          </div>
        </div>
        {combatBoardRows.map((row) =>
          row.type === "npc" ? renderNpcCard(row.row) : renderCharacterCard(row.entry)
        )}
      </div>
      {vendorState?.pendingTrades?.some((trade) => trade.status === "pending") && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100010] p-2">
          <div className="fancy-container p-2 w-[min(620px,95vw)] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">Kereskedői cserék</p>
            <div className="flex flex-col gap-2">
              {vendorState.pendingTrades.filter((trade) => trade.status === "pending").map((trade) => (
                <div className="fancy-container p-2 flex flex-col gap-1" key={trade.id}>
                  <p className="font-semibold">{trade.type === "buy" ? "Buy request" : "Sell request"} - {trade.item.name}</p>
                  <p className="text-xs">Character: {characters.find((entry) => entry.id === trade.uid)?.name || trade.uid}</p>
                  <div className="text-xs flex flex-col gap-1">
                    <FlexRow className="items-center gap-1 flex-wrap">
                      <span>Felajánlott:</span>
                      <MoneyDisplay copper={trade.suggestedPriceCopper} />
                    </FlexRow>
                    {typeof trade.requestedPriceCopper === "number" ? (
                      <FlexRow className="items-center gap-1 flex-wrap">
                        <span>Kért:</span>
                        <MoneyDisplay copper={trade.requestedPriceCopper} />
                      </FlexRow>
                    ) : null}
                  </div>
                  <MoneyAddInput
                    id={`vendor-trade-final-${trade.id}`}
                    label="Final price"
                    valueCopper={tradeFinalPrice[trade.id] ?? trade.suggestedPriceCopper}
                    onChange={(nextCopper) =>
                      setTradeFinalPrice((prev) => ({
                        ...prev,
                        [trade.id]: nextCopper,
                      }))
                    }
                  />
                  <div className="flex justify-end gap-1 flex-wrap">
                    <button className="fancy-container px-2 py-1" type="button" onClick={() => resolveTrade(trade, false)}>Elutasítás</button>
                    <button className="fancy-container px-2 py-1" type="button" onClick={() => resolveTrade(trade, true)}>Elfogadás</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {npcManageTarget && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100011] p-2">
          <div className="fancy-container p-2 w-[min(560px,95vw)] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">NJK kezelése: {npcManageTarget.name}</p>
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => setNpcManageTargetUid("")}
                disabled={npcManageBusy}
              >
                Close
              </button>
            </div>
            <div className="text-sm flex flex-col gap-1">
              <p>
                FP: {npcManageTarget.resource?.health?.currentHp ?? 0}/{npcManageTarget.resource?.health?.maxHp ?? 0} | EP:{" "}
                {npcManageTarget.resource?.health?.currentEp ?? 0}/{npcManageTarget.resource?.health?.maxEp ?? 0}
              </p>
              <p>
                {npcManageTarget.resource?.abilities?.name || Character.RESOURCE_TYPE.MANA}:{" "}
                {npcManageTarget.resource?.abilities?.current ?? 0}/{npcManageTarget.resource?.abilities?.max ?? 0}
              </p>
            </div>
            <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
              <tbody>
                <tr>
                  <td className="w-[34%] pr-1 whitespace-nowrap"><label htmlFor="npc-damage-value">Sebzés</label></td>
                  <td className="pr-1">
                    <input
                      id="npc-damage-value"
                      type="number"
                      min={0}
                      className="w-full px-1 rounded text-black"
                      value={npcDamageValue}
                      onInput={(e) => setNpcDamageValue(Number(e.currentTarget.value) || 0)}
                      disabled={npcManageBusy}
                    />
                  </td>
                  <td className="w-[112px]">
                    <button
                      type="button"
                      className="fancy-container px-2 py-1 w-full"
                      onClick={() => void applyNpcResourceAction("damage", npcDamageValue)}
                      disabled={npcManageBusy}
                    >
                      Alkalmaz
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="pr-1 whitespace-nowrap"><label htmlFor="npc-heal-hp-value">FP gyógyítás</label></td>
                  <td className="pr-1">
                    <input
                      id="npc-heal-hp-value"
                      type="number"
                      min={0}
                      className="w-full px-1 rounded text-black"
                      value={npcHealHpValue}
                      onInput={(e) => setNpcHealHpValue(Number(e.currentTarget.value) || 0)}
                      disabled={npcManageBusy}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="fancy-container px-2 py-1 w-full"
                      onClick={() => void applyNpcResourceAction("healHp", npcHealHpValue)}
                      disabled={npcManageBusy}
                    >
                      FP
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="pr-1 whitespace-nowrap"><label htmlFor="npc-heal-ep-value">EP gyógyítás</label></td>
                  <td className="pr-1">
                    <input
                      id="npc-heal-ep-value"
                      type="number"
                      min={0}
                      className="w-full px-1 rounded text-black"
                      value={npcHealEpValue}
                      onInput={(e) => setNpcHealEpValue(Number(e.currentTarget.value) || 0)}
                      disabled={npcManageBusy}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="fancy-container px-2 py-1 w-full"
                      onClick={() => void applyNpcResourceAction("healEp", npcHealEpValue)}
                      disabled={npcManageBusy}
                    >
                      EP
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="pr-1 whitespace-nowrap"><label htmlFor="npc-resource-delta-value">Erőforrás +/-</label></td>
                  <td className="pr-1">
                    <input
                      id="npc-resource-delta-value"
                      type="number"
                      className="w-full px-1 rounded text-black"
                      value={npcResourceDeltaValue}
                      onInput={(e) => setNpcResourceDeltaValue(Number(e.currentTarget.value) || 0)}
                      disabled={npcManageBusy}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="fancy-container px-2 py-1 w-full"
                      onClick={() => void applyNpcResourceAction("resourceDelta", npcResourceDeltaValue)}
                      disabled={npcManageBusy}
                    >
                      Mentés
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex flex-col gap-0.5 max-h-[220px] overflow-auto text-xs">
              {(npcManageTarget.damageLog || []).length === 0 ? (
                <p>Nincs sebzésesemény.</p>
              ) : (
                [...(npcManageTarget.damageLog || [])]
                  .reverse()
                  .map((entry) => (
                    <p key={entry.id}>
                      {formatClientDateTime(entry.time)} | FP {entry.hpChange} | EP {entry.epChange} [{entry.hpCurrent}/{entry.hpMax} FP, {entry.epCurrent}/{entry.epMax} EP]
                    </p>
                  ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {isAddItemModalOpen && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100000] p-2">
          <div className="fancy-container p-2 w-[min(540px,95vw)] max-w-[95vw] max-h-[90vh] h-[min(82vh,720px)] flex flex-col gap-2">
            <p className="font-semibold">Tárgy hozzáadása a felszereléslistához</p>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                className="grow min-w-0 px-2 py-1 rounded"
                placeholder="Search by item name or description..."
                value={itemSearch}
                onInput={(e) => setItemSearch((e.currentTarget as HTMLInputElement).value)}
              />
              <input
                type="number"
                min={1}
                className="w-[72px] px-2 py-1 rounded"
                value={itemQty}
                onInput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  setItemQty(Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
                }}
              />
            </div>
            <div className="grow min-h-0 overflow-auto border border-slate-500 rounded p-1">
              {addBusy ? (
                <p>Loading...</p>
              ) : itemResults.length === 0 ? (
                <p>Nincs egyező tárgy.</p>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {itemResults.map((it, idx) => (
                      <tr key={`add-item-${idx}-${it.name}`}>
                        <td className="pr-2 font-semibold">{it.name}</td>
                        <td className="pr-2">{it.equipable || "bag"}</td>
                        <td className="pr-2">{it.description || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="fancy-container px-2 py-0.5"
                            onClick={() => {
                              if (!addTarget) return;
                              setAddBusy(true);
                              requestCharacters<Character.TCharacterServer>({
                                endPoint: "/grantItem",
                                body: {
                                  uid: addTarget.uid,
                                  advId: addTarget.advId,
                                  itemName: it.name,
                                  amount: itemQty,
                                },
                              })
                                .then((response) => {
                                  const parsed = parseCharacterPayload(response.data);
                                  if (parsed.json) {
                                    const row = response.data as { hash?: string };
                                    const nextEntry = commitUpdatedCharacter(
                                      addTarget.entry,
                                      parsed.json,
                                      parsed.computed,
                                      row.hash
                                    );
                                    openCharacterDataWindow(nextEntry, parsed.json);
                                  }
                                  setIsAddItemModalOpen(false);
                                  setAddTarget(null);
                                  setItemSearch("");
                                  setItemResults([]);
                                  setAllItems([]);
                                })
                                .catch((error) => {
                                  setError("Failed to add item to inventory: " + error);
                                })
                                .finally(() => setAddBusy(false));
                            }}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  setIsAddItemModalOpen(false);
                  setAddTarget(null);
                  setItemSearch("");
                  setItemResults([]);
                  setAllItems([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {isGiveXpModalOpen && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100004] p-2">
          <div className="fancy-container p-2 w-[min(560px,95vw)] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">TP adása</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm whitespace-nowrap">Minden játékos:</p>
              <input
                type="number"
                className="px-2 py-1 rounded w-[140px]"
                value={xpBulkValue}
                onInput={(e) =>
                  applyXpToAll(Number((e.currentTarget as HTMLInputElement).value || 0))
                }
              />
            </div>
            <div className="grow min-h-0 overflow-auto border border-slate-500 rounded p-1">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {characters.map((entry) => (
                    <tr key={`xp-row-${entry.id}`}>
                      <td className="pr-2 font-semibold">{entry.id} - {entry.name}</td>
                      <td className="w-[150px]">
                        <input
                          type="number"
                          className="px-2 py-1 rounded w-full"
                          value={xpByUid[entry.id] ?? 0}
                          onInput={(e) => {
                            const value = Number((e.currentTarget as HTMLInputElement).value || 0);
                            setXpByUid((prev) => ({ ...prev, [entry.id]: value }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={saveGivenXp}
                disabled={xpBusy}
              >
                Save
              </button>
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => setIsGiveXpModalOpen(false)}
                disabled={xpBusy}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {isAuraModalOpen && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100001] p-2">
          <div className="fancy-container p-2 w-[min(520px,95vw)] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">{auraTarget?.auraId ? "Edit Aura" : "Aura hozzáadása"}</p>
            <AuraEditor draft={auraDraft} onChange={setAuraDraft} />
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  setIsAuraModalOpen(false);
                  setAuraTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  if (!auraTarget?.json || !auraTarget.entry || !auraDraft.name.trim()) return;
                  const next = JSON.parse(JSON.stringify(auraTarget.json)) as Character.TCharacter;
                  if (!Array.isArray(next.auras)) next.auras = [];
                  if (auraTarget.auraId) {
                    next.auras = next.auras.map((aura) =>
                      aura.id === auraTarget.auraId
                        ? {
                            ...aura,
                            name: auraDraft.name.trim(),
                            description: auraDraft.description.trim(),
                            effect: auraDraft.effect,
                            color: auraDraft.color,
                            manual: true,
                            modifiers: auraDraft.modifiers,
                          }
                        : aura
                    );
                  } else {
                    next.auras.push({
                      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                      name: auraDraft.name.trim(),
                      description: auraDraft.description.trim(),
                      effect: auraDraft.effect,
                      color: auraDraft.color,
                      manual: true,
                      modifiers: auraDraft.modifiers,
                    });
                  }
                  void persistCharacterUpdate({
                    uid: auraTarget.uid,
                    advId: auraTarget.advId,
                    json: next,
                    entry: auraTarget.entry,
                    errorPrefix: auraTarget.auraId ? "Failed to update aura" : "Failed to add aura",
                    onSuccess: () => {
                      setIsAuraModalOpen(false);
                      setAuraTarget(null);
                    },
                  });
                }}
              >
                Save Aura
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {isItemAuraModalOpen && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100007] p-2">
          <div className="fancy-container p-2 w-[min(520px,95vw)] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">Add Item Aura: {itemAuraTarget?.itemName || "-"}</p>
            <AuraEditor
              draft={itemAuraDraft}
              onChange={setItemAuraDraft}
              showName={false}
              showColor={false}
            />
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  setIsItemAuraModalOpen(false);
                  setItemAuraTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  if (!itemAuraTarget?.json || !itemAuraTarget.entry) return;
                  const next = JSON.parse(JSON.stringify(itemAuraTarget.json)) as Character.TCharacter;
                  const bp = next.inventory?.backpacks?.[itemAuraTarget.bpIndex];
                  const selected = bp?.items?.[itemAuraTarget.itemIndex];
                  if (!selected) return;
                  selected.additionalAuras = [
                    ...(Array.isArray(selected.additionalAuras) ? selected.additionalAuras : []),
                    {
                      description: itemAuraDraft.description.trim(),
                      effect: itemAuraDraft.effect,
                      modifiers: itemAuraDraft.modifiers,
                    },
                  ];
                  void persistCharacterUpdate({
                    uid: itemAuraTarget.uid,
                    advId: itemAuraTarget.advId,
                    json: next,
                    entry: itemAuraTarget.entry,
                    errorPrefix: "Failed to add item aura",
                    onSuccess: () => {
                      setIsItemAuraModalOpen(false);
                      setItemAuraTarget(null);
                    },
                  });
                }}
              >
                {auraTarget?.auraId ? "Save Changes" : "Save Aura"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {isMoneyModalOpen && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100002] p-2">
          <div className="fancy-container p-2 w-[min(420px,95vw)] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">Pénz szerkesztése</p>
            <MoneyAddInput
              id="admin-character-money"
              valueCopper={moneyBreakdownToCopper(moneyDraft)}
              onChange={(nextCopper) =>
                setMoneyDraft((prev) => ({ ...copperToMoneyBreakdown(nextCopper), mode: prev.mode }))
              }
            />
            <div className="flex gap-2 flex-wrap">
              <button
                className="fancy-container px-2 py-1"
                onClick={() => {
                  if (!moneyTarget?.json || !moneyTarget.entry) return;
                  const next = JSON.parse(JSON.stringify(moneyTarget.json)) as Character.TCharacter;
                  next.inventory.money = copperToInventoryMoney(moneyBreakdownToCopper(moneyDraft));
                  void persistCharacterUpdate({
                    uid: moneyTarget.uid,
                    advId: moneyTarget.advId,
                    json: next,
                    entry: moneyTarget.entry,
                    errorPrefix: "Failed to set money",
                    onSuccess: () => {
                      setIsMoneyModalOpen(false);
                      setMoneyTarget(null);
                    },
                  });
                }}
              >
                Set
              </button>
              <button
                className="fancy-container px-2 py-1"
                onClick={() => {
                  if (!moneyTarget?.json || !moneyTarget.entry) return;
                  const next = JSON.parse(JSON.stringify(moneyTarget.json)) as Character.TCharacter;
                  const currentMoney = next.inventory?.money || [
                    { name: Character.Item.MONEY.GOLD, amount: 0 },
                    { name: Character.Item.MONEY.SILVER, amount: 0 },
                    { name: Character.Item.MONEY.COPPER, amount: 0 },
                  ];
                  next.inventory.money = copperToInventoryMoney(
                    inventoryMoneyToCopper(currentMoney) + moneyBreakdownToCopper(moneyDraft)
                  );
                  void persistCharacterUpdate({
                    uid: moneyTarget.uid,
                    advId: moneyTarget.advId,
                    json: next,
                    entry: moneyTarget.entry,
                    errorPrefix: "Failed to add money",
                    onSuccess: () => {
                      setIsMoneyModalOpen(false);
                      setMoneyTarget(null);
                    },
                  });
                }}
              >
                Add
              </button>
              <button
                className="fancy-container px-2 py-1"
                onClick={() => {
                  if (!moneyTarget?.json || !moneyTarget.entry) return;
                  const next = JSON.parse(JSON.stringify(moneyTarget.json)) as Character.TCharacter;
                  const currentMoney = next.inventory?.money || [
                    { name: Character.Item.MONEY.GOLD, amount: 0 },
                    { name: Character.Item.MONEY.SILVER, amount: 0 },
                    { name: Character.Item.MONEY.COPPER, amount: 0 },
                  ];
                  next.inventory.money = copperToInventoryMoney(
                    inventoryMoneyToCopper(currentMoney) - moneyBreakdownToCopper(moneyDraft)
                  );
                  void persistCharacterUpdate({
                    uid: moneyTarget.uid,
                    advId: moneyTarget.advId,
                    json: next,
                    entry: moneyTarget.entry,
                    errorPrefix: "Failed to subtract money",
                    onSuccess: () => {
                      setIsMoneyModalOpen(false);
                      setMoneyTarget(null);
                    },
                  });
                }}
              >
                Subtract
              </button>
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  setIsMoneyModalOpen(false);
                  setMoneyTarget(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {isStatEditModalOpen && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100006] p-2">
          <div className="fancy-container p-2 w-[min(620px,95vw)] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">Karakterérték szerkesztése</p>
            <p className="text-xs">
              Clicked: <span className="font-semibold">{statEditTarget?.label || "-"}</span>
            </p>
            <label className="text-xs font-semibold">Útvonal</label>
            <input
              className="px-2 py-1 rounded text-black"
              value={statEditPath}
              onInput={(e) => setStatEditPath((e.currentTarget as HTMLInputElement).value)}
              placeholder="Example: hm.ATK or primaryStats[0].val"
              disabled={statEditBusy}
            />
            <label className="text-xs font-semibold">Érték (JSON ajánlott)</label>
            <textarea
              className="px-2 py-1 rounded text-black min-h-[140px]"
              value={statEditValueRaw}
              onInput={(e) => setStatEditValueRaw((e.currentTarget as HTMLTextAreaElement).value)}
              placeholder='Examples: 12 | "Warrior" | true | ["A","B"]'
              disabled={statEditBusy}
            />
            {statEditError ? <p className="text-red-700 text-sm">{statEditError}</p> : null}
            {statEditTarget?.json ? (
              <p className="text-xs opacity-80">
                Current at path: {JSON.stringify(getByPath(statEditTarget.json, statEditPath))}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={() => {
                  if (statEditBusy) return;
                  setIsStatEditModalOpen(false);
                  setStatEditTarget(null);
                  setStatEditPath("");
                  setStatEditValueRaw("");
                  setStatEditError("");
                }}
                disabled={statEditBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fancy-container px-2 py-1"
                onClick={saveStatEdit}
                disabled={statEditBusy}
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : <></>}
      {hoveredItem && canUseDom
        ? createPortal(
            <ItemHoverCard
              item={hoveredItem}
              x={hoverPos.x}
              y={hoverPos.y}
              iconFallback="trinket"
              showEffectHm
              showPrimary
              showWeaponDamages
            />,
            document.body
          )
        : <></>}
    </div>
  );
}












