import { useEffect, useMemo, useState } from "preact/hooks";
import { Adventure, Character } from "@shared/contracts";
import { FlexCol } from "@components/Flex";
import { createEmptyAuraEditorDraft } from "@components/AuraEditor";
import RndContainer from "@components/RndContainer";
import SaveIcon from "@components/icons/general/SaveIcon";
import { debugLog } from "@/core/logger";
import { TCloseProps, TRestRequest, TSetError, toErrorMessage } from "./types";
import { createEmptyHm, withHmDefaults } from "@/utils/hm";
import { isConflictError } from "@/core/api/httpClient";
import { buildTopLevelDiffPatch } from "@/core/api/patch";
import ItemSearchListSection from "./ItemSearchListSection";
import ItemEditorSection from "./ItemEditorSection";
import usePopup from "@/hooks/popup";
import {
  TItemAuraDraft,
  TItemFilter,
  TItemSort,
  TPrimaryStatDraft,
} from "./itemHandlingTypes";

const ITEM_CACHE: {
  items: Character.Item.TItem[];
  hash: string;
  loaded: boolean;
  inflight: Promise<Character.Item.TItem[]> | null;
} = {
  items: [],
  hash: "",
  loaded: false,
  inflight: null,
};

type TItemHandlingWindowProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

export default function ItemHandlingWindow({
  close,
  requestData,
  setError,
}: TItemHandlingWindowProps) {
  const [allItems, setAllItems] = useState<Character.Item.TItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sizeX, setSizeX] = useState("1");
  const [sizeY, setSizeY] = useState("1");
  const [weight, setWeight] = useState("1");
  const [priceCopper, setPriceCopper] = useState(0);
  const [maxStack, setMaxStack] = useState("1");
  const [storageSizeX, setStorageSizeX] = useState("4");
  const [storageSizeY, setStorageSizeY] = useState("2");
  const [storageSlotAmount, setStorageSlotAmount] = useState("");
  const [img, setImg] = useState("");
  const [imgMeta, setImgMeta] = useState<Character.TImageMeta | null>(null);
  const [consumable, setConsumable] = useState(false);
  const [createsInventorySpace, setCreatesInventorySpace] = useState(false);
  const [equipable, setEquipable] = useState<Character.Item.ITEM_TYPE_EQUIPPABLE | "">("");
  const [auras, setAuras] = useState<TItemAuraDraft[]>([]);
  const [auraDraft, setAuraDraft] = useState<TItemAuraDraft>(
    createEmptyAuraEditorDraft({ name: "", color: "" })
  );
  const [primaryStatName, setPrimaryStatName] = useState<Character.PRIMARY_STATS | "">("");
  const [primaryStatValue, setPrimaryStatValue] = useState("0");
  const [primaryStats, setPrimaryStats] = useState<TPrimaryStatDraft[]>([]);
  const [hmAtk, setHmAtk] = useState("0");
  const [hmDef, setHmDef] = useState("0");
  const [hmAim, setHmAim] = useState("0");
  const [hmIni, setHmIni] = useState("0");
  const [weaponRoll, setWeaponRoll] = useState<Adventure.TRollElements>({
    dice: Adventure.DICE.SIX,
    nrOfDices: 1,
    constant: 0,
    nrOfRolls: 1,
  });
  const [weaponDamages, setWeaponDamages] = useState<Adventure.TRollElements[]>([]);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<TItemSort>("nameAsc");
  const [filterBy, setFilterBy] = useState<TItemFilter>("all");
  const { setPopup } = usePopup();

  const loadItems = (force = false) => {
    if (!force && ITEM_CACHE.loaded) {
      setAllItems([...ITEM_CACHE.items]);
      return;
    }
    if (!force && ITEM_CACHE.inflight) {
      ITEM_CACHE.inflight
        .then((items) => setAllItems([...items]))
        .catch((error) => {
          setError(toErrorMessage(error));
          debugLog("Failed to reuse inflight items request:", error);
        });
      return;
    }
    ITEM_CACHE.inflight = requestData<{ items: Character.Item.TItem[]; hash: string }>({
      endPoint: "getAllItems",
    })
      .then((response) => {
        const wrapped = response.data as unknown as { items?: Character.Item.TItem[]; hash?: string };
        const items = Array.isArray(wrapped?.items) ? wrapped.items : [];
        ITEM_CACHE.items = items;
        ITEM_CACHE.hash = wrapped?.hash || "";
        ITEM_CACHE.loaded = true;
        setAllItems([...items]);
        return items;
      })
      .catch((error) => {
        setError(toErrorMessage(error));
        debugLog("Failed to fetch items:", error);
        return [];
      })
      .finally(() => {
        ITEM_CACHE.inflight = null;
      });
  };

  useEffect(() => {
    loadItems(false);
  }, []);

  const toNum = (value: string, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };
  const autoStorageSlotAmount = String(
    Math.max(1, toNum(storageSizeX, 1)) * Math.max(1, toNum(storageSizeY, 1))
  );

  const addItem = () => {
    if (!name.trim()) return;
    const nextItem: Character.Item.TItem = {
      name: name.trim(),
      description: description.trim(),
      priceCopper: Math.max(0, Math.floor(Number(priceCopper || 0))),
      hm: createEmptyHm(),
      size: {
        sizeX: Math.max(1, toNum(sizeX, 1)),
        sizeY: Math.max(1, toNum(sizeY, 1)),
        weight: Math.max(0, toNum(weight, 0)),
      },
      maxStack:
        equipable || createsInventorySpace
          ? 1
          : Math.max(1, Number.isFinite(toNum(maxStack, 1)) ? toNum(maxStack, 1) : 1),
      img: img.trim() || undefined,
      imgMeta: imgMeta,
      consumable,
      createsInventorySpace,
      equipable: equipable ? equipable : null,
      storage:
        equipable === Character.Item.ITEM_TYPE_EQUIPPABLE.STORAGE ||
        createsInventorySpace
          ? {
              sizeX: Math.max(1, toNum(storageSizeX, 1)),
              sizeY: Math.max(1, toNum(storageSizeY, 1)),
              slotAmount: Math.max(
                1,
                storageSlotAmount.trim()
                  ? toNum(storageSlotAmount, toNum(autoStorageSlotAmount, 1))
                  : toNum(autoStorageSlotAmount, 1)
              ),
            }
          : undefined,
      effects: {
        auras,
        primaryStats,
        hm: {
          ATK: toNum(hmAtk, 0),
          DEF: toNum(hmDef, 0),
          AIM: toNum(hmAim, 0),
          INI: toNum(hmIni, 0),
        },
        weaponDamages:
          equipable === Character.Item.ITEM_TYPE_EQUIPPABLE.WEP1H ||
          equipable === Character.Item.ITEM_TYPE_EQUIPPABLE.WEP2H ||
          equipable === Character.Item.ITEM_TYPE_EQUIPPABLE.SHIELD
            ? weaponDamages
            : [],
      },
    };
    const previousByName = ITEM_CACHE.items.find((item) => item.name === nextItem.name);
    const patch = buildTopLevelDiffPatch(previousByName, nextItem, {
      requiredPaths: ["/name"],
    });
    if (patch.length < 1) return;
    setIsSavingItem(true);
    requestData<{ items: Character.Item.TItem[]; hash: string }>({
      endPoint: "updateItem",
      body: {
        expectedHash: ITEM_CACHE.hash,
        patch,
      },
    })
      .then((response) => {
        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        ITEM_CACHE.items = items;
        ITEM_CACHE.hash = response.data?.hash || "";
        ITEM_CACHE.loaded = true;
        setAllItems(items);
        setName("");
        setDescription("");
        setSizeX("1");
        setSizeY("1");
        setWeight("1");
        setPriceCopper(0);
        setMaxStack("1");
        setStorageSizeX("4");
        setStorageSizeY("2");
        setStorageSlotAmount("");
        setImg("");
        setImgMeta(null);
        setConsumable(false);
        setCreatesInventorySpace(false);
        setEquipable("");
        setAuras([]);
        setAuraDraft(createEmptyAuraEditorDraft({ name: "", color: "" }));
        setPrimaryStatName("");
        setPrimaryStatValue("0");
        setPrimaryStats([]);
        setWeaponRoll({
          dice: Adventure.DICE.SIX,
          nrOfDices: 1,
          constant: 0,
          nrOfRolls: 1,
        });
        setWeaponDamages([]);
      })
      .catch((error) => {
        if (isConflictError(error)) {
          loadItems(true);
          setError("Conflict (409): items changed on server. Reloaded latest data, please retry.");
          return;
        }
        setError(toErrorMessage(error));
        debugLog("Failed to save item:", error);
      })
      .finally(() => setIsSavingItem(false));
  };

  const selectItemForEdit = (item: Character.Item.TItem) => {
    setName(item.name || "");
    setDescription(item.description || "");
    setSizeX(String(item.size?.sizeX ?? 1));
    setSizeY(String(item.size?.sizeY ?? 1));
    setWeight(String(item.size?.weight ?? 0));
    setPriceCopper(Math.max(0, Math.floor(Number(item.priceCopper || 0))));
    setMaxStack(String(item.maxStack ?? 1));
    setStorageSizeX(String(item.storage?.sizeX ?? 4));
    setStorageSizeY(String(item.storage?.sizeY ?? 2));
    setStorageSlotAmount(
      item.storage?.slotAmount !== undefined ? String(item.storage.slotAmount) : ""
    );
    setImg(item.img || "");
    setImgMeta(item.imgMeta || null);
    setConsumable(Boolean(item.consumable));
    setCreatesInventorySpace(Boolean(item.createsInventorySpace));
    setEquipable((item.equipable as Character.Item.ITEM_TYPE_EQUIPPABLE | null) || "");
    setAuras(
      Array.isArray(item.effects?.auras)
        ? item.effects.auras.map((aura) => ({
            name: "",
            description: aura.description || "",
            effect: Array.isArray(aura.effect) ? aura.effect : [],
            applyWhen: aura.applyWhen === "carried" ? "carried" : "equipped",
            color: "",
            modifiers: Array.isArray(aura.modifiers) ? aura.modifiers : [],
          }))
        : []
    );
    setAuraDraft(createEmptyAuraEditorDraft({ name: "", color: "" }));
    setPrimaryStats(
      Array.isArray(item.effects?.primaryStats)
        ? item.effects.primaryStats.map((entry) => ({
            name: entry.name,
            value: Number(entry.value || 0),
          }))
        : []
    );
    setPrimaryStatName("");
    setPrimaryStatValue("0");
    const safeHm = withHmDefaults(item.effects?.hm);
    setHmAtk(String(safeHm.ATK));
    setHmDef(String(safeHm.DEF));
    setHmAim(String(safeHm.AIM));
    setHmIni(String(safeHm.INI));
    setWeaponRoll({
      dice: Adventure.DICE.SIX,
      nrOfDices: 1,
      constant: 0,
      nrOfRolls: 1,
    });
    setWeaponDamages(
      Array.isArray(item.effects?.weaponDamages) ? item.effects.weaponDamages : []
    );
  };

  const addAura = () => {
    if (auraDraft.effect.length < 1 && auraDraft.modifiers.length < 1 && !auraDraft.description.trim()) {
      return;
    }
    setAuras((prev) => [
      ...prev,
      {
        ...auraDraft,
        name: "",
        color: "",
        applyWhen: auraDraft.applyWhen === "carried" ? "carried" : "equipped",
        description: auraDraft.description.trim(),
      },
    ]);
    setAuraDraft(createEmptyAuraEditorDraft({ name: "", color: "" }));
  };

  const removeAura = (idx: number) => {
    setAuras((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPrimaryStat = () => {
    if (!primaryStatName) return;
    const value = toNum(primaryStatValue, 0);
    setPrimaryStats((prev) => [...prev, { name: primaryStatName, value }]);
    setPrimaryStatName("");
    setPrimaryStatValue("0");
  };

  const removePrimaryStat = (idx: number) => {
    setPrimaryStats((prev) => prev.filter((_, i) => i !== idx));
  };

  const addWeaponDamage = () => {
    setWeaponDamages((prev) => [
      ...prev,
      {
        dice: weaponRoll.dice,
        nrOfDices: Math.max(0, Number(weaponRoll.nrOfDices) || 0),
        constant: Number(weaponRoll.constant) || 0,
        nrOfRolls: Math.max(1, Number(weaponRoll.nrOfRolls) || 1),
      },
    ]);
  };

  const removeWeaponDamage = (idx: number) => {
    setWeaponDamages((prev) => prev.filter((_, i) => i !== idx));
  };

  const listedItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = allItems.filter((item) => {
      if (filterBy === "consumable" && !item.consumable) return false;
      if (filterBy === "equippable" && item.equipable === null) return false;
      if (
        filterBy === "storage" &&
        item.equipable !== Character.Item.ITEM_TYPE_EQUIPPABLE.STORAGE &&
        item.createsInventorySpace !== true
      ) return false;
      if (!s) return true;
      const typeLabel = item.equipable ? String(item.equipable) : "none";
      return (
        item.name.toLowerCase().includes(s) ||
        typeLabel.toLowerCase().includes(s) ||
        (item.consumable ? "consumable" : "nonconsumable").includes(s)
      );
    });
    filtered.sort((a, b) =>
      sortBy === "nameAsc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
    return filtered;
  }, [allItems, filterBy, search, sortBy]);

  const confirmDeleteItem = (item: Character.Item.TItem) => {
    requestData<{ items: Character.Item.TItem[]; hash: string }>({
      endPoint: "deleteItem",
      body: { name: item.name },
    })
      .then((response) => {
        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        ITEM_CACHE.items = items;
        ITEM_CACHE.hash = response.data?.hash || "";
        ITEM_CACHE.loaded = true;
        setAllItems(items);
      })
      .catch((error) => {
        setError(toErrorMessage(error));
        debugLog("Failed to delete item:", error);
      });
  };

  const deleteItem = (item: Character.Item.TItem) => {
    setPopup({
      label: "Delete item",
      text: `Delete item "${item.name}"?`,
      save: "Delete",
      saveCallback: () => confirmDeleteItem(item),
    });
  };

  return (
    <RndContainer
      id="item-handling"
      aditionalIcons={<SaveIcon onClick={() => loadItems(true)} className="h-4 m-1 w-6 cursor-pointer" />}
      close={close}
      label="item-handling"
    >
      <FlexCol className="grow w-full min-w-0 min-h-0 overflow-auto p-1 gap-1">
        <ItemEditorSection
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          sizeX={sizeX}
          setSizeX={setSizeX}
          sizeY={sizeY}
          setSizeY={setSizeY}
          weight={weight}
          setWeight={setWeight}
          priceCopper={priceCopper}
          setPriceCopper={setPriceCopper}
          maxStack={maxStack}
          setMaxStack={setMaxStack}
          storageSizeX={storageSizeX}
          setStorageSizeX={setStorageSizeX}
          storageSizeY={storageSizeY}
          setStorageSizeY={setStorageSizeY}
          storageSlotAmount={storageSlotAmount}
          setStorageSlotAmount={setStorageSlotAmount}
          autoStorageSlotAmount={autoStorageSlotAmount}
          img={img}
          imgMeta={imgMeta}
          setImgMeta={setImgMeta}
          setImg={setImg}
          consumable={consumable}
          setConsumable={setConsumable}
          createsInventorySpace={createsInventorySpace}
          setCreatesInventorySpace={setCreatesInventorySpace}
          equipable={equipable}
          setEquipable={setEquipable}
          auraDraft={auraDraft}
          setAuraDraft={setAuraDraft}
          auras={auras}
          addAura={addAura}
          removeAura={removeAura}
          primaryStatName={primaryStatName}
          setPrimaryStatName={setPrimaryStatName}
          primaryStatValue={primaryStatValue}
          setPrimaryStatValue={setPrimaryStatValue}
          primaryStats={primaryStats}
          addPrimaryStat={addPrimaryStat}
          removePrimaryStat={removePrimaryStat}
          hmAtk={hmAtk}
          setHmAtk={setHmAtk}
          hmDef={hmDef}
          setHmDef={setHmDef}
          hmAim={hmAim}
          setHmAim={setHmAim}
          hmIni={hmIni}
          setHmIni={setHmIni}
          weaponRoll={weaponRoll}
          setWeaponRoll={setWeaponRoll}
          weaponDamages={weaponDamages}
          addWeaponDamage={addWeaponDamage}
          removeWeaponDamage={removeWeaponDamage}
          addItem={addItem}
          isSavingItem={isSavingItem}
        />
        <ItemSearchListSection
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterBy={filterBy}
          setFilterBy={setFilterBy}
          listedItems={listedItems}
          selectItemForEdit={selectItemForEdit}
          onDeleteItem={deleteItem}
        />
      </FlexCol>
    </RndContainer>
  );
}








