import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { createPortal, JSX } from "preact/compat";
import { Character, ServerApi } from "@shared/contracts";
import {
  copperToInventoryMoney,
  DEFAULT_STORAGE_ID,
  getDefaultStorageColumns,
  getDefaultStorageRows,
  getDefaultStorageSlotAmount,
  getItemGridSize,
  getPlacementForStorageIndex,
  indexToSlot,
  inventoryMoneyToCopper,
  isBagOrSatchel,
  isWeaponOrShield,
  slotToIndex,
} from "@shared/game";
import { createEmptyHm } from "@/utils/hm";
import { getEmptySlotIcon, getItemDefaultIcon } from "@/utils/itemIcons";
import { FlexCol, FlexRow } from "@components/Flex";
import ItemHoverCard from "@components/ItemHoverCard";
import { MoneyAddInput, MoneyDisplay } from "@components/Money";
import StorageGrid from "@pages/Character/components/StorageGrid";

type DragSource = "storage" | "equipment";
type TCell = {
  item: Character.Item.TItem;
  amount: number;
  placement?: Character.Item.TItemPlacement;
  additionalAuras?: Character.Item.TItemAura[];
  bag?: Character.Item.TBagInstance;
} | null;
interface DragItem {
  cell: NonNullable<TCell>;
  from: DragSource;
  index: number;
  storageId?: string;
}

type TItemMenuState = {
  x: number;
  y: number;
  from: DragSource;
  index: number;
  item: Character.Item.TItem;
  storageId?: string;
} | null;

export type TBagStoragePanel = {
  storageId: string;
  label: string;
  panel: JSX.Element;
};

const absPositions = [
  ["hands", "16%", "4%"],
  ["mainHand", "2%", "7%"],
  ["head", "2%", "47%"],
  ["neck", "18%", "47%"],
  ["chest", "32%", "47%"],
  ["legs", "55%", "47%"],
  ["feet", "84%", "47%"],
  ["rings1", "40%", "7%"],
  ["rings2", "55%", "7%"],
  ["cloak", "65%", "70%"],
  ["shoulder", "20%", "68%"],
  ["trinket", "2%", "75%"],
  ["offHand", "50%", "68%"],
  ["bracer", "35%", "69%"],
  ["bag", "72%", "8%"],
  ["satchel", "72%", "25%"],
] as const;

const isItemAllowedInSlot = (item: Character.Item.TItem, slotName: string): boolean => {
  const eq = item.equipable;
  if (!eq) return false;
  switch (slotName) {
    case "mainHand": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.WEP1H || eq === Character.Item.ITEM_TYPE_EQUIPPABLE.WEP2H;
    case "offHand": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.SHIELD || eq === Character.Item.ITEM_TYPE_EQUIPPABLE.WEP1H;
    case "rings1":
    case "rings2":
    case "trinket": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.ACCESSORY;
    case "head": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.HEAD;
    case "neck": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.NECK;
    case "chest": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.CHEST;
    case "legs": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.LEGS;
    case "feet": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.BOOTS;
    case "cloak": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.BACK;
    case "shoulder": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.SHOULDER;
    case "bracer": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.BRACER;
    case "hands": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.GLOVES;
    case "bag": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.BAG;
    case "satchel": return eq === Character.Item.ITEM_TYPE_EQUIPPABLE.SATCHEL;
    default: return false;
  }
};

const createMockItem = (index: number): Character.Item.TItem => ({ hm: createEmptyHm(), name: `Item ${index + 1}`, description: `Inventory item ${index + 1}`, size: { sizeX: 1, sizeY: 1, weight: 1 }, equipable: null });

const makeCell = (
  entry: Character.Item.TBackpack["items"][number]
): NonNullable<TCell> => ({
  item: entry.item,
  amount: Math.max(1, Number(entry.amount || 1)),
  placement: entry.placement,
  additionalAuras: Array.isArray(entry.additionalAuras) ? entry.additionalAuras : undefined,
  bag: entry.bag,
});

const makeEntry = (
  cell: NonNullable<TCell>,
  placement: Character.Item.TItemPlacement
): Character.Item.TBackpack["items"][number] => ({
  amount: cell.item.equipable ? 1 : Math.max(1, Number(cell.amount || 1)),
  item: cell.item,
  placement,
  ...(cell.additionalAuras ? { additionalAuras: cell.additionalAuras } : {}),
  ...(cell.bag ? { bag: cell.bag } : {}),
});

const getOccupiedIndexes = (
  item: Character.Item.TItem,
  topLeftIndex: number,
  width: number,
  totalSlots: number,
  storageId?: string
) => {
  const size = getItemGridSize(item, storageId);
  const start = indexToSlot(topLeftIndex, width);
  const rows = Math.ceil(totalSlots / width);
  if (start.placeX + size.x > width || start.placeY + size.y > rows) return null;
  const indexes: number[] = [];
  for (let y = 0; y < size.y; y += 1) {
    for (let x = 0; x < size.x; x += 1) {
      const idx = (start.placeY + y) * width + start.placeX + x;
      if (idx < 0 || idx >= totalSlots) return null;
      indexes.push(idx);
    }
  }
  return indexes;
};

const getOccupationMap = (cells: TCell[], width: number, storageId?: string) => {
  const occupation = new Map<number, number>();
  cells.forEach((cell, index) => {
    if (!cell) return;
    const indexes = getOccupiedIndexes(cell.item, index, width, cells.length, storageId);
    if (!indexes) return;
    indexes.forEach((idx) => occupation.set(idx, index));
  });
  return occupation;
};

const canPlaceCell = (
  cells: TCell[],
  width: number,
  cell: NonNullable<TCell>,
  targetIndex: number,
  storageId: string,
  ignoreIndex?: number
) => {
  if (storageId === DEFAULT_STORAGE_ID && !isWeaponOrShield(cell.item)) return false;
  const indexes = getOccupiedIndexes(cell.item, targetIndex, width, cells.length, storageId);
  if (!indexes) return false;
  const occupation = getOccupationMap(cells, width, storageId);
  return indexes.every((idx) => {
    const owner = occupation.get(idx);
    return owner === undefined || owner === ignoreIndex;
  });
};

const withPlacement = (
  cell: NonNullable<TCell>,
  placement: Character.Item.TItemPlacement
): NonNullable<TCell> => ({
  ...cell,
  placement,
});

export function useInventoryPanels({ inventory, vendorMode, defaultCapacity, onMoneyChange, onInventoryChange, onDropItem, onSellItem, onUseItem, onEquipItem }: { inventory?: Character.Item.TInventory; vendorMode?: boolean; defaultCapacity?: number; onMoneyChange?: (money: Character.Item.TMoney) => Promise<void> | void; onInventoryChange?: (inventory: Character.Item.TInventory) => Promise<void> | void; onDropItem?: (source: ServerApi.CharacterRoutes.ItemActionSource) => Promise<void> | void; onSellItem?: (source: ServerApi.CharacterRoutes.ItemActionSource, requestedPriceCopper: number) => Promise<void> | void; onUseItem?: (source: ServerApi.CharacterRoutes.ItemActionSource) => Promise<void> | void; onEquipItem?: (source: ServerApi.CharacterRoutes.ItemActionSource, targetSlotId?: string, target?: ServerApi.CharacterRoutes.ItemActionSource) => Promise<void> | void; }) {
  const defaultMoney: Character.Item.TMoney = [{ name: Character.Item.MONEY.GOLD, amount: 0 },{ name: Character.Item.MONEY.SILVER, amount: 0 },{ name: Character.Item.MONEY.COPPER, amount: 0 }];
  const defaultSlots = getDefaultStorageSlotAmount(defaultCapacity);
  const defaultColumns = getDefaultStorageColumns(defaultCapacity);
  const defaultRows = getDefaultStorageRows(defaultCapacity);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [itemMenu, setItemMenu] = useState<TItemMenuState>(null);
  const [hoveredItem, setHoveredItem] = useState<Character.Item.TItem | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [defaultCells, setDefaultCells] = useState<TCell[]>(Array(defaultSlots).fill(null));
  const [storageCells, setStorageCells] = useState<Record<string, TCell[]>>({});
  const [equippedItems, setEquippedItems] = useState<TCell[]>(Array(absPositions.length).fill(null));
  const [equippedBags, setEquippedBags] = useState<Array<{ item: Character.Item.TItem; bag: Character.Item.TBagInstance }>>([]);
  const [isMoneyModalOpen, setIsMoneyModalOpen] = useState(false);
  const [moneyInputCopper, setMoneyInputCopper] = useState(0);
  const [sellTarget, setSellTarget] = useState<TItemMenuState>(null);
  const [sellInputCopper, setSellInputCopper] = useState(0);
  const hoverTimerRef = useRef<number | null>(null);

  const allNonDefaultStorages = useMemo(
    () =>
      (inventory?.backpacks || []).filter(
        (bp) => !bp.isDefault && String(bp.id || "") !== DEFAULT_STORAGE_ID
      ),
    [inventory]
  );

  const renderItemVisual = (item: Character.Item.TItem, className = "w-6 h-6") => item.imgMeta?.src || item.img ? <img src={item.imgMeta?.src || item.img} className={`${className} fancy-container`} style={{ objectFit: item.imgMeta?.fit || "cover" }} /> : getItemDefaultIcon(item, className, "misc");
  const clearHoverTimer = () => { if (hoverTimerRef.current !== null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; } };
  const hideHover = () => { clearHoverTimer(); setHoveredItem(null); };
  const scheduleHover = (item: Character.Item.TItem, x: number, y: number) => { clearHoverTimer(); hoverTimerRef.current = window.setTimeout(() => { setHoveredItem(item); setHoverPos({ x, y }); }, 900); };

  useEffect(() => {
    const nextDefault = Array(defaultSlots).fill(null) as TCell[];
    const nextStorage: Record<string, TCell[]> = {};
    const nextEquip = Array(absPositions.length).fill(null) as TCell[];
    const nextEqBags: Array<{ item: Character.Item.TItem; bag: Character.Item.TBagInstance }> = [];

    const sourceBackpacks = inventory?.backpacks?.length ? inventory.backpacks : [{ id: DEFAULT_STORAGE_ID, isDefault: true, type: "basic", size: { sizeX: defaultColumns, sizeY: defaultRows, weight: 0, slotAmount: defaultSlots }, items: Array.from({ length: defaultSlots }, (_, i) => i < 0 ? { amount: 1, item: createMockItem(i) } : null).filter(Boolean) as Character.Item.TBackpack["items"] } as Character.Item.TBackpack];
    sourceBackpacks.forEach((bp, bpIdx) => {
      const sid = String(bp.id || (bp.isDefault ? DEFAULT_STORAGE_ID : `storage_${bpIdx + 1}`));
      if (!bp.isDefault && sid !== DEFAULT_STORAGE_ID) {
        const slots = Math.max(1, Number(bp.size?.slotAmount || (bp.size?.sizeX || 1) * (bp.size?.sizeY || 1)));
        nextStorage[sid] = Array(slots).fill(null);
      }
      (bp.items || []).forEach((entry, entryIdx) => {
        const width = sid === DEFAULT_STORAGE_ID ? defaultColumns : Math.max(1, Number(bp.size?.sizeX || 1));
        const pos = entry.placement?.slot || { placeX: entryIdx % width, placeY: Math.floor(entryIdx / width) };
        const idx = slotToIndex(pos, width);
        const cell = makeCell(entry);
        if (entry.placement?.equippedSlotId) {
          const slotIdx = absPositions.findIndex((x) => x[0] === entry.placement?.equippedSlotId);
          if (slotIdx >= 0) nextEquip[slotIdx] = cell;
        } else if (sid === DEFAULT_STORAGE_ID) {
          if (idx >= 0 && idx < nextDefault.length && canPlaceCell(nextDefault, width, cell, idx, DEFAULT_STORAGE_ID)) nextDefault[idx] = cell;
        } else {
          const dest = nextStorage[sid] || [];
          if (idx >= 0 && idx < dest.length && canPlaceCell(dest, width, cell, idx, sid)) dest[idx] = cell;
          nextStorage[sid] = dest;
        }
        if (entry.bag && entry.bag.state === "equipped") nextEqBags.push({ item: entry.item, bag: entry.bag });
      });
    });

    setDefaultCells(nextDefault);
    setStorageCells(nextStorage);
    setEquippedItems(nextEquip);
    setEquippedBags(nextEqBags);
  }, [defaultColumns, defaultRows, defaultSlots, inventory]);

  const nonDefaultStorages = allNonDefaultStorages;

  const emitInventoryChange = (nextDefault: TCell[], nextStorage: Record<string, TCell[]>, nextEquip: TCell[]) => {
    const backpacks: Character.Item.TBackpack[] = [{ id: DEFAULT_STORAGE_ID, label: "Default", isDefault: true, type: "basic", size: { sizeX: defaultColumns, sizeY: defaultRows, weight: 0, slotAmount: defaultSlots }, items: nextDefault.map((cell, idx) => cell ? makeEntry(cell, getPlacementForStorageIndex(DEFAULT_STORAGE_ID, idx, defaultColumns)) : null).filter(Boolean) as Character.Item.TBackpack["items"] }];
    nonDefaultStorages.forEach((bp, i) => {
      const sid = String(bp.id || `storage_${i + 1}`);
      const sx = Math.max(1, Number(bp.size?.sizeX || 1));
      const cells = nextStorage[sid] || [];
      backpacks.push({ ...bp, id: sid, isDefault: false, items: cells.map((cell, idx) => cell ? makeEntry(cell, getPlacementForStorageIndex(sid, idx, sx)) : null).filter(Boolean) as Character.Item.TBackpack["items"] });
    });
    nextEquip.forEach((cell, idx) => {
      if (!cell) return;
      const rememberedPlacement = cell.placement || getPlacementForStorageIndex(DEFAULT_STORAGE_ID, idx, defaultColumns);
      backpacks[0].items.push(makeEntry(cell, { ...rememberedPlacement, equippedSlotId: absPositions[idx][0] }));
    });
    void onInventoryChange?.({ backpacks, money: inventory?.money || defaultMoney });
  };

  const handleDragStart = (item: Character.Item.TItem, from: DragSource, index: number, storageId?: string) => (e: DragEvent) => {
    hideHover();
    const cells = storageId ? getCellsForStorage(storageId) : [];
    const amount =
      from === "equipment"
        ? Math.max(1, Number(equippedItems[index]?.amount || 1))
        : Math.max(1, Number(cells[index]?.amount || 1));
    const cell = from === "equipment" ? equippedItems[index] : cells[index];
    if (!cell) return;
    setDraggedItem({ cell: { ...cell, amount }, from, index, storageId });
    e.dataTransfer?.setData("text/plain", `${item.name}-${index}`);
  };
  const handleDragOver = (e: DragEvent) => e.preventDefault();

  const getCellsForStorage = (storageId: string): TCell[] =>
    storageId === DEFAULT_STORAGE_ID ? defaultCells : storageCells[storageId] || [];
  const getStorageWidth = (storageId: string) =>
    storageId === DEFAULT_STORAGE_ID
      ? defaultColumns
      : Math.max(
          1,
          Number(
            nonDefaultStorages.find(
              (bp, idx) => String(bp.id || `storage_${idx + 1}`) === storageId
            )?.size?.sizeX || 1
          )
        );
  const setCellsForStorage = (storageId: string, cells: TCell[]) => {
    if (storageId === DEFAULT_STORAGE_ID) setDefaultCells(cells);
    else setStorageCells((prev) => ({ ...prev, [storageId]: cells }));
  };

  const handleStorageDrop = (targetStorageId: string, targetIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    const cells = [...getCellsForStorage(targetStorageId)];
    const targetWidth = getStorageWidth(targetStorageId);
    if (draggedItem.from === "storage") {
      const sourceStorageId = String(draggedItem.storageId || DEFAULT_STORAGE_ID);
      const srcCells =
        sourceStorageId === targetStorageId
          ? cells
          : [...getCellsForStorage(sourceStorageId)];
      const moved = srcCells[draggedItem.index];
      if (!moved) return;
      const occupation = getOccupationMap(cells, targetWidth, targetStorageId);
      const targetOwner = occupation.get(targetIndex);
      const targetCell = targetOwner !== undefined ? cells[targetOwner] : null;
      const sameName = targetCell && targetCell.item.name === moved.item.name;
      const maxStack = moved.item.equipable || isBagOrSatchel(moved.item) ? 1 : Math.max(1, Number(moved.item.maxStack || 1));
      if (
        sameName &&
        targetCell &&
        targetOwner !== undefined &&
        targetOwner !== draggedItem.index &&
        maxStack > 1 &&
        getItemGridSize(moved.item, targetStorageId).x === 1 &&
        getItemGridSize(moved.item, targetStorageId).y === 1
      ) {
        const merged = targetCell.amount + moved.amount;
        const kept = Math.min(maxStack, merged);
        const overflow = Math.max(0, merged - kept);
        cells[targetOwner] = { ...targetCell, amount: kept };
        srcCells[draggedItem.index] = overflow > 0 ? { ...moved, amount: overflow } : null;
      } else {
        srcCells[draggedItem.index] = null;
        if (!canPlaceCell(cells, targetWidth, moved, targetIndex, targetStorageId, sourceStorageId === targetStorageId ? draggedItem.index : undefined)) {
          setDraggedItem(null);
          return;
        }
        cells[targetIndex] = withPlacement(moved, getPlacementForStorageIndex(targetStorageId, targetIndex, targetWidth));
      }
      setCellsForStorage(targetStorageId, cells);
      if (sourceStorageId !== targetStorageId) {
        setCellsForStorage(sourceStorageId, srcCells);
      }
      const nextStorage =
        sourceStorageId === targetStorageId
          ? targetStorageId === DEFAULT_STORAGE_ID
            ? storageCells
            : { ...storageCells, [targetStorageId]: cells }
          : {
              ...storageCells,
              ...(sourceStorageId === DEFAULT_STORAGE_ID ? {} : { [sourceStorageId]: srcCells }),
              ...(targetStorageId === DEFAULT_STORAGE_ID ? {} : { [targetStorageId]: cells }),
            };
      emitInventoryChange(
        targetStorageId === DEFAULT_STORAGE_ID ? cells : sourceStorageId === DEFAULT_STORAGE_ID ? srcCells : defaultCells,
        nextStorage,
        equippedItems
      );
      setDraggedItem(null);
      return;
    }
    if (!canPlaceCell(cells, targetWidth, draggedItem.cell, targetIndex, targetStorageId)) {
      setDraggedItem(null);
      return;
    }
    void onEquipItem?.(
      {
        from: "equipment",
        index: draggedItem.index,
      },
      undefined,
      {
        from: "storage",
        index: targetIndex,
        storageId: targetStorageId,
      }
    );
    setDraggedItem(null);
  };

  const handleTargetDrop = (targetIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    const slotName = absPositions[targetIndex][0];
    if (!isItemAllowedInSlot(draggedItem.cell.item, slotName)) { setDraggedItem(null); return; }
    if (equippedItems[targetIndex]) {
      setDraggedItem(null);
      return;
    }
    void onEquipItem?.(
      {
        from: draggedItem.from,
        index: draggedItem.index,
        storageId: draggedItem.storageId,
      },
      slotName,
      {
        from: "equipment",
        index: targetIndex,
      }
    );
    setDraggedItem(null);
  };

  const handleDropAction = async () => {
    if (!itemMenu) return;
    await onDropItem?.({
      from: itemMenu.from,
      index: itemMenu.index,
      storageId: itemMenu.storageId,
    });
    setItemMenu(null);
  };

  const handleEquipAction = () => {
    if (!itemMenu || itemMenu.from !== "storage" || !itemMenu.item.equipable) return;
    const targetSlotId = absPositions.find(([slotName], index) => {
      return isItemAllowedInSlot(itemMenu.item, slotName) && !equippedItems[index];
    })?.[0];
    if (targetSlotId) {
      void onEquipItem?.(
        {
          from: "storage",
          index: itemMenu.index,
          storageId: itemMenu.storageId,
        },
        targetSlotId,
        {
          from: "equipment",
          index: absPositions.findIndex(([slotName]) => slotName === targetSlotId),
        }
      );
    }
    setItemMenu(null);
  };

  const handleUseAction = async () => {
    if (!itemMenu || itemMenu.item.consumable !== true || isBagOrSatchel(itemMenu.item)) return;
    await onUseItem?.({
      from: itemMenu.from,
      index: itemMenu.index,
      storageId: itemMenu.storageId,
    });
    setItemMenu(null);
  };

  const openSellAction = () => {
    if (!itemMenu) return;
    setSellTarget(itemMenu);
    setSellInputCopper(0);
    setItemMenu(null);
  };

  const submitSellAction = async () => {
    if (!sellTarget) return;
    await onSellItem?.(
      {
        from: sellTarget.from,
        index: sellTarget.index,
        storageId: sellTarget.storageId,
      },
      sellInputCopper
    );
    setSellTarget(null);
  };

  const equipmentPanel = <FlexRow className="w-full min-w-0 shrink-0 justify-center items-start"><div className="relative w-full border p-1 fancy-container bg-center bg-contain bg-no-repeat" style={{ aspectRatio: "670 / 887", backgroundImage: "url('/imgs/character_3.svg')" }}>{equippedItems.map((cell, index) => <div key={`eq-${index}`} className={`aspect-square absolute border fancy-container text-center select-none origin-top-left ${absPositions[index][0] === "bag" || absPositions[index][0] === "satchel" ? "w-[13%]" : ""}`} style={{ top: absPositions[index][1], left: absPositions[index][2], width: absPositions[index][0] === "bag" || absPositions[index][0] === "satchel" ? "13%" : "18%" }} onDragOver={handleDragOver} onDrop={handleTargetDrop(index)} draggable={!!cell} onDragStart={cell ? handleDragStart(cell.item, "equipment", index) : undefined} onMouseEnter={cell ? (e) => scheduleHover(cell.item, e.clientX, e.clientY) : undefined} onMouseLeave={cell ? hideHover : undefined} onContextMenu={cell ? (e) => { e.preventDefault(); e.stopPropagation(); hideHover(); setItemMenu({ x: e.clientX, y: e.clientY, from: "equipment", index, item: cell.item }); } : undefined}>{cell ? <FlexCol className="items-center text-[9px]">{renderItemVisual(cell.item)}<span className="truncate">{cell.item.name}</span>{cell.amount > 1 ? <span>x{cell.amount}</span> : null}</FlexCol> : <FlexRow className="w-full h-full items-center justify-center">{getEmptySlotIcon(absPositions[index][0])}</FlexRow>}</div>)}</div></FlexRow>;

  const moneyFooter = <FlexRow className="w-full min-w-0 mt-1 gap-1 justify-between fancy-container p-0.5 cursor-pointer" onClick={() => setIsMoneyModalOpen(true)}><MoneyDisplay copper={inventoryMoneyToCopper(inventory?.money || defaultMoney)} className="text-xs" /></FlexRow>;
  const defaultStoragePanel = <FlexCol className="w-full h-full min-w-0 min-h-0 p-1 fancy-container"><p className="text-xs font-semibold mb-1">Default ({defaultSlots} weapon/shield)</p><StorageGrid storageId={DEFAULT_STORAGE_ID} gridClassName="grid gap-1" gridStyle={{ gridTemplateColumns: `repeat(${defaultColumns}, minmax(0, 1fr))` }} columns={defaultColumns} cells={defaultCells.slice(0, defaultSlots)} renderItemVisual={renderItemVisual} onDragOver={handleDragOver} onDropAt={(index) => handleStorageDrop(DEFAULT_STORAGE_ID, index)} onDragStartAt={(item, index) => handleDragStart(item, "storage", index, DEFAULT_STORAGE_ID)} onMouseEnterItem={(item, e) => scheduleHover(item, e.clientX, e.clientY)} onMouseLeaveItem={hideHover} onContextMenuItem={(item, index, e) => { hideHover(); setItemMenu({ x: e.clientX, y: e.clientY, from: "storage", index, item, storageId: DEFAULT_STORAGE_ID }); }} />{moneyFooter}</FlexCol>;

  const bagOwnerById = new Map<string, Character.Item.TItem>();
  equippedBags.forEach((entry) => bagOwnerById.set(entry.bag.id, entry.item));
  const bagStoragePanels: TBagStoragePanel[] = nonDefaultStorages
    .filter((bp) => bagOwnerById.has(String(bp.id || "")))
    .map((bp, idx) => {
    const sid = String(bp.id || `storage_${idx + 1}`);
    const columns = Math.max(1, Number(bp.size?.sizeX || 4));
    const cells = getCellsForStorage(sid);
    const owner = bagOwnerById.get(sid);
    const label = bp.label || owner?.name || `Storage ${idx + 1}`;
    return {
      storageId: sid,
      label,
      panel: (
      <FlexCol className="w-full h-full min-w-0 min-h-0 p-1 fancy-container">
        <p className="text-xs font-semibold mb-1">
          {label} ({columns}x
          {Math.max(1, Number(bp.size?.sizeY || Math.ceil(cells.length / columns)))})
        </p>
        <StorageGrid
          storageId={sid}
          gridClassName="grid gap-1"
          gridStyle={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          columns={columns}
          cells={cells}
          renderItemVisual={renderItemVisual}
          onDragOver={handleDragOver}
          onDropAt={(index) => handleStorageDrop(sid, index)}
          onDragStartAt={(item, index) => handleDragStart(item, "storage", index, sid)}
          onMouseEnterItem={(item, e) => scheduleHover(item, e.clientX, e.clientY)}
          onMouseLeaveItem={hideHover}
          onContextMenuItem={(item, index, e) =>
            {
              hideHover();
              setItemMenu({ x: e.clientX, y: e.clientY, from: "storage", index, item, storageId: sid });
            }
          }
        />
      </FlexCol>
      ),
    };
  });
  const backpackPanel = <></>;

  const applyMoneyDelta = async (sign: 1 | -1) => {
    const current = inventory?.money || defaultMoney;
    const next = copperToInventoryMoney(
      inventoryMoneyToCopper(current) + sign * Math.max(0, moneyInputCopper)
    );
    await onMoneyChange?.(next);
  };

  const moneyModal = isMoneyModalOpen ? createPortal(<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2"><div className="fancy-container p-1 w-[min(420px,95vw)] max-h-[90vh] overflow-auto flex flex-col gap-1"><p className="font-bold text-center">Money</p><MoneyDisplay copper={inventoryMoneyToCopper(inventory?.money || defaultMoney)} className="justify-center" /><MoneyAddInput id="character-money-delta" valueCopper={moneyInputCopper} onChange={setMoneyInputCopper} /><FlexRow className="justify-end gap-1 flex-wrap"><button className="fancy-container p-0.5" onClick={() => setIsMoneyModalOpen(false)}>Close</button><button className="fancy-container p-0.5" onClick={() => applyMoneyDelta(1)}>Add</button><button className="fancy-container p-0.5" onClick={() => applyMoneyDelta(-1)}>Extract</button></FlexRow></div></div>, document.body) : null;
  const itemHoverModal = hoveredItem ? createPortal(<ItemHoverCard item={hoveredItem} x={hoverPos.x} y={hoverPos.y} iconFallback="misc" />, document.body) : null;
  const itemContextMenu = itemMenu ? createPortal(<div className="fixed inset-0 z-[100010]" onClick={() => setItemMenu(null)}><div className="fixed z-[100011] fancy-container p-1 text-xs min-w-[140px] flex flex-col" style={{ left: `${Math.min(window.innerWidth - 160, itemMenu.x + 4)}px`, top: `${Math.min(window.innerHeight - 180, itemMenu.y + 4)}px` }} onClick={(e) => e.stopPropagation()}>{vendorMode ? <button className="w-full text-left px-2 py-1 hover:bg-black/10" onClick={openSellAction}>Eladas</button> : <><button className="w-full text-left px-2 py-1 hover:bg-black/10" onClick={handleDropAction}>Eldob</button><button className="w-full text-left px-2 py-1 hover:bg-black/10" onClick={openSellAction}>Elad</button>{itemMenu.item.consumable === true && !isBagOrSatchel(itemMenu.item) ? <button className="w-full text-left px-2 py-1 hover:bg-black/10" onClick={handleUseAction}>Használ</button> : null}{itemMenu.from === "storage" && itemMenu.item.equipable ? <button className="w-full text-left px-2 py-1 hover:bg-black/10" onClick={handleEquipAction}>Felvesz</button> : null}</>}</div></div>, document.body) : null;
  const sellModal = sellTarget ? createPortal(<div className="fixed inset-0 bg-black/50 z-[100005] flex items-center justify-center p-2"><div className="fancy-container p-2 w-[min(420px,95vw)] flex flex-col gap-2"><p className="font-bold text-center">Eladas - {sellTarget.item.name}</p><MoneyAddInput id="character-sell-price" label="Requested price" valueCopper={sellInputCopper} onChange={setSellInputCopper} /><FlexRow className="justify-end gap-1 flex-wrap"><button className="fancy-container p-0.5" onClick={() => setSellTarget(null)}>Close</button><button className="fancy-container p-0.5" onClick={() => void submitSellAction()}>Send</button></FlexRow></div></div>, document.body) : null;

  return { equipmentPanel, backpackPanel, bagStoragePanels, defaultStoragePanel, moneyModal, itemHoverModal, itemContextMenu, sellModal };
}

export default function Inventory({ inventory, vendorMode, defaultCapacity, onMoneyChange, onInventoryChange, onDropItem, onSellItem, onUseItem, onEquipItem }: { inventory?: Character.Item.TInventory; vendorMode?: boolean; defaultCapacity?: number; onMoneyChange?: (money: Character.Item.TMoney) => Promise<void> | void; onInventoryChange?: (inventory: Character.Item.TInventory) => Promise<void> | void; onDropItem?: (source: ServerApi.CharacterRoutes.ItemActionSource) => Promise<void> | void; onSellItem?: (source: ServerApi.CharacterRoutes.ItemActionSource, requestedPriceCopper: number) => Promise<void> | void; onUseItem?: (source: ServerApi.CharacterRoutes.ItemActionSource) => Promise<void> | void; onEquipItem?: (source: ServerApi.CharacterRoutes.ItemActionSource, targetSlotId?: string, target?: ServerApi.CharacterRoutes.ItemActionSource) => Promise<void> | void; }) {
  const { equipmentPanel, backpackPanel, bagStoragePanels, defaultStoragePanel, moneyModal, itemHoverModal, itemContextMenu, sellModal } = useInventoryPanels({ inventory, vendorMode, defaultCapacity, onMoneyChange, onInventoryChange, onDropItem, onSellItem, onUseItem, onEquipItem });
  return <>{equipmentPanel}{defaultStoragePanel}{backpackPanel}{bagStoragePanels.map((entry) => entry.panel)}{moneyModal}{itemHoverModal}{itemContextMenu}{sellModal}</>;
}
