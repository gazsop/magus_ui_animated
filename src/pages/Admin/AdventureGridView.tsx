import { Adventure, Character, Application, Vendor } from "@shared/contracts";
import { createPortal, useEffect, useRef, useState } from "preact/compat";
import {
  applySecondaryStatPoints,
  copperToInventoryMoney,
  copperToMoneyBreakdown,
  inventoryMoneyToCopper,
  moneyBreakdownToCopper,
} from "@shared/game";
import useRequest from "@hooks/request";
import useError from "@hooks/error";
import { useAdventureSseSubscription, useSyncStatusSubscription } from "@hooks/sse";
import { useSseContext } from "@contexts/sseContext";
import { useWindowsLayer } from "@pages/WindowsLayer";
import AuraEditor, { createEmptyAuraEditorDraft, TAuraEditorDraft } from "@components/AuraEditor";
import AuraDisplay from "@components/AuraDisplay";
import RndContainer from "@components/RndContainer";
import ItemHoverCard from "@components/ItemHoverCard";
import SecondaryStatsTable from "@components/SecondaryStatsTable";
import { FlexRow } from "@components/Flex";
import { isConflictError } from "@/core/api/httpClient";
import { buildTopLevelDiffPatch } from "@/core/api/patch";
import { useDataContext } from "@contexts/dataContext";
import { formatClientDateTime } from "@/core/datetime";
import { parseCharacterPayload } from "@pages/Character/utils/characterPayload";
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

const clampInt = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
};

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
  const { setSyncSnapshot } = useSseContext();
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
  const [personalities, setPersonalities] = useState<TNamedValue[]>([]);
  const [combatMode, setCombatMode] = useState(false);
  const [turn, setTurn] = useState(1);
  const [combatInitiatives, setCombatInitiatives] = useState<Adventure.TCombatInitiative[]>([]);
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
    requestAdventure<Adventure.TCombatState>({
      endPoint: "/combat/set",
      body: { advId, enabled, turn: enabled ? 1 : 0 },
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
    requestRest<{ entries: TNamedValue[] }>({ endPoint: "getAllPersonalities", errorMode: "quiet" })
      .then((response) => setPersonalities(response.data?.entries || []))
      .catch(() => setPersonalities([]));
    requestRest<{ vendors: Vendor.TVendor[]; hash?: string }>({ endPoint: "/getAllVendors", errorMode: "quiet" })
      .then((response) => {
        setVendors(response.data?.vendors || []);
        if (!selectedVendorId && response.data?.vendors?.[0]) {
          setSelectedVendorId(response.data.vendors[0].id);
        }
      })
      .catch(() => setVendors([]));
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

  useAdventureSseSubscription(
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
  useAdventureSseSubscription("vendor:state", advId, (payload: Vendor.TVendorState) => {
    setVendorState(payload);
    setSelectedVendorId(String(payload.vendorId || selectedVendorId || ""));
  });
  useAdventureSseSubscription(
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
  useAdventureSseSubscription(
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

  const buildCharacterDataWindow = (
    entry: CharacterIdentity,
    close: () => void,
    windowClasses?: string,
    overrideCharacter?: Character.TCharacter | null
  ) => {
    const c = overrideCharacter ?? entry.full;
    const characterClassName = c?.class || entry.className;
    const classDef = classes.find((x) => x.name === characterClassName);
    const spells = classDef?.spells || [];
    const secondarySkills = c?.secondaryStats || [];
    const updateSecondarySkill = (
      idx: number,
      patch: Partial<Character.TSecondaryStat>,
      label: string
    ) => {
      if (!c) return;
      const current = c.secondaryStats?.[idx];
      if (!current) return;
      const next = JSON.parse(JSON.stringify(c)) as Character.TCharacter;
      next.secondaryStats = [...(next.secondaryStats || [])];
      next.secondaryStats[idx] = {
        ...next.secondaryStats[idx],
        ...patch,
      };
      void persistCharacterUpdate({
        uid: entry.id,
        advId,
        json: next,
        entry,
        errorPrefix: `Failed to update ${label}`,
      });
    };
    const secondaryLevelOptions = [
      { label: "", value: Character.SECONDARY_STAT_LEVEL.NONE },
      { label: Character.SECONDARY_STAT_LEVEL.BASIC, value: Character.SECONDARY_STAT_LEVEL.BASIC },
      { label: Character.SECONDARY_STAT_LEVEL.MASTER, value: Character.SECONDARY_STAT_LEVEL.MASTER },
    ];
    const inventoryItems = (c?.inventory?.backpacks || []).flatMap((bp, bpIndex) =>
      (bp.items || []).map((wrapped, itemIndex) => ({
        bpIndex,
        storageId: String(bp.id || (bp.isDefault ? "storage_default" : `storage_${bpIndex + 1}`)),
        storageLabel: String(bp.label || (bp.isDefault ? "Default" : `Storage ${bpIndex + 1}`)),
        itemIndex,
        amount: wrapped.amount || 0,
        item: wrapped.item,
        additionalAuras: wrapped.additionalAuras || [],
        placement: wrapped.placement,
      }))
    );
    const equippedItems = inventoryItems.filter(
      (row) => !!row.item?.equipable && !!row.placement?.equippedSlotId
    );
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
    const descentOptions = descents.map((descent) => ({
      label: descent.name,
      value: descent.name,
    }));
    const classOptions = classes.map((classEntry) => ({
      label: classEntry.name,
      value: classEntry.name,
    }));
    const specializationOptions = (classDef?.specs || []).map((spec) => ({
      label: spec.name,
      value: spec.name,
    }));
    const levelOptions = Array.from({ length: 20 }, (_, idx) => {
      const level = idx + 1;
      return { label: String(level), value: level };
    });
    const religionOptions = religions.map((religion) => ({
      label: religion.name,
      value: religion.name,
    }));
    const personalityOptions = personalities.map((personality) => ({
      label: personality.name,
      value: personality.name,
    }));
    const languageOptions = descents.map((descent) => descent.name);
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
              <p className="font-semibold mb-1">Basic Data</p>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr>
                    <td className="pr-2 font-semibold">Player UID</td><td className="pr-4">{entry.id}</td>
                    <td className="pr-2 font-semibold">Name</td><td><EditableStat label="Name" path="rp.name" value={entry.name} /></td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">Race</td>
                    <td className="pr-4">
                      <EditableSelect
                        label="Race"
                        path="descent"
                        value={c?.descent || ""}
                        options={descentOptions}
                      />
                    </td>
                    <td className="pr-2 font-semibold">Class</td>
                    <td>
                      <EditableSelect
                        label="Class"
                        path="class"
                        value={c?.class || ""}
                        options={classOptions}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">Level</td>
                    <td className="pr-4">
                      <EditableSelect
                        label="Level"
                        path="level.current"
                        value={c?.level?.current || 1}
                        options={levelOptions}
                      />
                    </td>
                    <td className="pr-2 font-semibold">Religion</td>
                    <td>
                      <EditableSelect
                        label="Religion"
                        path="rp.religion"
                        value={c?.rp?.religion || ""}
                        options={religionOptions}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">Personality</td>
                    <td className="pr-4">
                      <EditableSelect
                        label="Personality"
                        path="rp.personality"
                        value={c?.rp?.personality || ""}
                        options={personalityOptions}
                      />
                    </td>
                    <td className="pr-2 font-semibold">Specialization</td>
                    <td>
                      <EditableSelect
                        label="Specialization"
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
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">Languages</td>
                    <td className="pr-4">
                      <EditableList
                        label="Languages"
                        path="rp.knownLanguages"
                        values={c?.rp?.knownLanguages || []}
                        options={languageOptions}
                      />
                    </td>
                    <td className="pr-2 font-semibold">HP</td><td>
                      <EditableStat label="Current HP" path="resource.health.currentHp" value={c?.resource?.health?.currentHp ?? 0} /> /{" "}
                      <EditableStat label="Max HP" path="resource.health.maxHp" value={c?.resource?.health?.maxHp ?? 0} />
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">Professions</td><td colSpan={3}><EditableStat label="Professions" path="rp.professions" value={c?.rp?.professions || []} /></td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">EP</td><td className="pr-4">
                      <EditableStat label="Current EP" path="resource.health.currentEp" value={c?.resource?.health?.currentEp ?? 0} /> /{" "}
                      <EditableStat label="Max EP" path="resource.health.maxEp" value={c?.resource?.health?.maxEp ?? 0} />
                    </td>
                    <td className="pr-2 font-semibold">ATK/DEF</td><td>
                      <EditableStat label="ATK" path="hm.ATK" value={entry.hm.ATK} /> /{" "}
                      <EditableStat label="DEF" path="hm.DEF" value={entry.hm.DEF} />
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold">INI/AIM</td><td className="pr-4">
                      <EditableStat label="INI" path="hm.INI" value={entry.hm.INI} /> /{" "}
                      <EditableStat label="AIM" path="hm.AIM" value={entry.hm.AIM} />
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2">
                <p className="font-semibold mb-1">Primary Stats (Editable)</p>
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
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col">
              <p className="font-semibold mb-1">Spells</p>
              <div className="min-h-0 grow overflow-y-auto">
                {spells.length === 0 ? (
                  <p>-</p>
                ) : (
                  <table className="w-full border-collapse">
                    <tbody>
                      {spells.map((spell) => (
                        <tr key={`${entry.id}-spell-${spell.id}`}>
                          <td className="pr-2 font-semibold">{spell.name}</td>
                          <td>lvl {spell.lvlReq}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col">
              <p className="font-semibold mb-1">Secondary Skills</p>
              <div className="min-h-0 grow overflow-y-auto">
                {secondarySkills.length === 0 ? (
                  <p>-</p>
                ) : (
                  <SecondaryStatsTable
                    stats={secondarySkills}
                    currentLevel={c?.level?.current || 1}
                    tableClassName="border-collapse"
                    emptyText="-"
                    renderLevelCell={(row) => (
                      <select
                        className="w-full min-w-[80px] px-1 py-0.5 rounded text-black"
                        value={row.current.skillLevel || Character.SECONDARY_STAT_LEVEL.NONE}
                        disabled={!c}
                        onChange={(e) => {
                          updateSecondarySkill(
                            row.currentSourceIndex,
                            {
                              skillLevel: e.currentTarget.value as Character.SECONDARY_STAT_LEVEL,
                            },
                            "secondary skill level"
                          );
                        }}
                      >
                        {secondaryLevelOptions.map((option) => (
                          <option
                            key={`${entry.id}-secondary-level-${row.currentSourceIndex}-${option.value}`}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                    renderSkillCell={(row) => (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-[72px] px-1 py-0.5 rounded text-black"
                        defaultValue={String(clampInt(Number(row.current.skill || 0), 0, 100))}
                        disabled={!c}
                        onBlur={(e) => {
                          const nextValue = clampInt(Number(e.currentTarget.value || 0), 0, 100);
                          e.currentTarget.value = String(nextValue);
                          if (nextValue === clampInt(Number(row.current.skill || 0), 0, 100)) return;
                          updateSecondarySkill(
                            row.currentSourceIndex,
                            { skill: nextValue },
                            "secondary skill value"
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                      />
                    )}
                    renderActionCell={(row) => (
                      <div className="fancy-container p-0.5 flex flex-wrap items-center gap-0.5 min-w-0">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          defaultValue="1"
                          className="w-12 min-w-0 px-1 py-0.5 rounded text-black"
                          disabled={!c}
                          data-secondary-add={`${entry.id}-${row.currentSourceIndex}`}
                        />
                        <button
                          type="button"
                          className="px-1 py-0.5 min-w-0"
                          disabled={!c}
                          onClick={(e) => {
                            const root = (e.currentTarget as HTMLButtonElement).parentElement;
                            const input = root?.querySelector("input") as HTMLInputElement | null;
                            const amount = clampInt(Number(input?.value || 1), 1, 100);
                            if (input) input.value = String(amount);
                            const nextSkill = applySecondaryStatPoints(row.current, amount);
                            if (
                              nextSkill.skill === row.current.skill &&
                              nextSkill.skillLevel === row.current.skillLevel
                            ) {
                              return;
                            }
                            updateSecondarySkill(
                              row.currentSourceIndex,
                              {
                                skill: nextSkill.skill,
                                skillLevel: nextSkill.skillLevel,
                              },
                              "secondary skill value"
                            );
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col md:col-span-1">
              <p className="font-semibold mb-1">Equipped Items</p>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden p-1 border border-slate-500 rounded flex flex-col md:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">Auras</p>
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
                <p className="font-semibold">Inventory</p>
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
              <div className="min-h-0 grow overflow-y-auto">
                {inventoryItems.length === 0 ? (
                  <p>-</p>
                ) : (
                  <table className="w-full border-collapse">
                    <tbody>
                      {inventoryItems.map((row) => (
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
                              onClick={() => {
                                if (!c) return;
                                const next = JSON.parse(JSON.stringify(c)) as Character.TCharacter;
                                const bp = next.inventory?.backpacks?.[row.bpIndex];
                                if (!bp || !bp.items?.[row.itemIndex]) return;
                                const selected = bp.items[row.itemIndex];
                                const nextAmount = Math.max(0, Number(selected.amount || 0) - 1);
                                if (nextAmount <= 0) {
                                  bp.items.splice(row.itemIndex, 1);
                                } else {
                                  selected.amount = nextAmount;
                                }
                                void persistCharacterUpdate({
                                  uid: entry.id,
                                  advId,
                                  json: next,
                                  entry,
                                  errorPrefix: "Failed to remove item",
                                });
                              }}
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

  useEffect(() => {
    setCharacterDataRenderer(buildCharacterDataWindow);
    return () => setCharacterDataRenderer(null);
  });

  return (
    <div className="admin-adventures-page w-full h-full fancy-container p-2 sm:p-4 relative overflow-auto">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Adventure Characters</h2>
        {isLoading ? <span>Loading...</span> : <span>{characters.length} total</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="min-h-[150px] border border-slate-400 rounded-md p-3 bg-white/60 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold">Commands</p>
            <span className="text-sm">Turn: {turn}</span>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <p>Current: {formatClientDateTime(adventureMeta?.json.worldDateCurrent)}</p>
            <p>Started: {formatClientDateTime(adventureMeta?.json.worldDateStart)}</p>
          </div>
          {combatMode ? (
            <div className="rounded border border-red-300 bg-red-50/70 p-2 text-xs">
              <p className="font-semibold mb-1">Initiative</p>
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
              <p className="text-xs font-semibold">Vendor Mode</p>
              <select
                className="px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-900"
                value={selectedVendorId}
                disabled={Boolean(vendorState?.enabled)}
                onChange={(e) => setSelectedVendorId(e.currentTarget.value)}
              >
                <option value="">Select vendor</option>
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
        {characters.slice(0, 7).map((entry) => (
          <div
            key={`adv-char-cell-${entry.id}`}
            className="min-h-[150px] border border-slate-400 rounded-md p-3 bg-white/60 select-none cursor-pointer"
            onClick={() => openCharacterDataWindow(entry)}
          >
            <div className="flex flex-col gap-1">
              <p className="font-semibold truncate">{entry.name}</p>
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
        ))}
      </div>
      {vendorState?.pendingTrades?.some((trade) => trade.status === "pending") && canUseDom
        ? createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100010] p-2">
          <div className="fancy-container p-2 w-[min(620px,95vw)] max-h-[90vh] overflow-auto flex flex-col gap-2">
            <p className="font-semibold">Vendor Trades</p>
            <div className="flex flex-col gap-2">
              {vendorState.pendingTrades.filter((trade) => trade.status === "pending").map((trade) => (
                <div className="fancy-container p-2 flex flex-col gap-1" key={trade.id}>
                  <p className="font-semibold">{trade.type === "buy" ? "Buy request" : "Sell request"} - {trade.item.name}</p>
                  <p className="text-xs">Character: {characters.find((entry) => entry.id === trade.uid)?.name || trade.uid}</p>
                  <div className="text-xs flex flex-col gap-1">
                    <FlexRow className="items-center gap-1 flex-wrap">
                      <span>Suggested:</span>
                      <MoneyDisplay copper={trade.suggestedPriceCopper} />
                    </FlexRow>
                    {typeof trade.requestedPriceCopper === "number" ? (
                      <FlexRow className="items-center gap-1 flex-wrap">
                        <span>Requested:</span>
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
                    <button className="fancy-container px-2 py-1" type="button" onClick={() => resolveTrade(trade, false)}>Reject</button>
                    <button className="fancy-container px-2 py-1" type="button" onClick={() => resolveTrade(trade, true)}>Accept</button>
                  </div>
                </div>
              ))}
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
            <p className="font-semibold">Add Item To Inventory</p>
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
                <p>No matching items.</p>
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
                              if (!addTarget?.json) return;
                              const next = JSON.parse(JSON.stringify(addTarget.json)) as Character.TCharacter;
                              if (!next.inventory) {
                                next.inventory = {
                                  backpacks: [],
                                  money: addTarget.json.inventory?.money || [
                                    { name: Character.Item.MONEY.GOLD, amount: 0 },
                                    { name: Character.Item.MONEY.SILVER, amount: 0 },
                                    { name: Character.Item.MONEY.COPPER, amount: 0 },
                                  ],
                                };
                              }
                              if (!Array.isArray(next.inventory.backpacks)) next.inventory.backpacks = [];
                              if (next.inventory.backpacks.length === 0) {
                                next.inventory.backpacks.push({
                                  id: "storage_default",
                                  label: "Default",
                                  isDefault: true,
                                  type: "basic",
                                  size: { sizeX: 4, sizeY: 2, weight: 0, slotAmount: 8 },
                                  items: [],
                                });
                              }
                              const firstBackpack = next.inventory.backpacks[0];
                              const existing = it.createsInventorySpace
                                ? undefined
                                : firstBackpack.items.find((row) => row.item?.name === it.name);
                              if (existing) {
                                existing.amount = Number(existing.amount || 0) + Math.max(1, itemQty);
                              } else {
                                const amount = it.createsInventorySpace
                                  ? 1
                                  : Math.max(1, itemQty);
                                const entries = it.createsInventorySpace
                                  ? Array.from({ length: Math.max(1, itemQty) }, () => ({
                                      amount,
                                      item: it,
                                      additionalAuras: [],
                                    }))
                                  : [
                                      {
                                        amount,
                                        item: it,
                                        additionalAuras: [],
                                      },
                                    ];
                                firstBackpack.items.push(...entries);
                              }
                              void persistCharacterUpdate({
                                uid: addTarget.uid,
                                advId: addTarget.advId,
                                json: next,
                                entry: addTarget.entry,
                                errorPrefix: "Failed to add item to inventory",
                                onSuccess: () => {
                                  setIsAddItemModalOpen(false);
                                  setAddTarget(null);
                                  setItemSearch("");
                                  setItemResults([]);
                                  setAllItems([]);
                                },
                              });
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
            <p className="font-semibold">Give XP</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm whitespace-nowrap">All players:</p>
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
            <p className="font-semibold">{auraTarget?.auraId ? "Edit Aura" : "Add Aura"}</p>
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
            <p className="font-semibold">Edit Money</p>
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
            <p className="font-semibold">Edit Character Stat</p>
            <p className="text-xs">
              Clicked: <span className="font-semibold">{statEditTarget?.label || "-"}</span>
            </p>
            <label className="text-xs font-semibold">Path</label>
            <input
              className="px-2 py-1 rounded text-black"
              value={statEditPath}
              onInput={(e) => setStatEditPath((e.currentTarget as HTMLInputElement).value)}
              placeholder="Example: hm.ATK or primaryStats[0].val"
              disabled={statEditBusy}
            />
            <label className="text-xs font-semibold">Value (JSON preferred)</label>
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










