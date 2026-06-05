import { h } from "preact";
import { Character } from "@shared/contracts";
import { getItemGridSize } from "@shared/game";

type StorageGridProps = {
  gridClassName: string;
  gridStyle?: h.JSX.CSSProperties;
  storageId?: string;
  cells: ({ item: Character.Item.TItem; amount: number } | null)[];
  columns: number;
  renderItemVisual: (item: Character.Item.TItem, className?: string) => h.JSX.Element;
  onDragOver: (e: DragEvent) => void;
  onDropAt: (index: number) => (e: DragEvent) => void;
  onDragStartAt: (
    item: Character.Item.TItem,
    index: number
  ) => (e: DragEvent) => void;
  onMouseEnterItem?: (item: Character.Item.TItem, e: MouseEvent) => void;
  onMouseLeaveItem?: () => void;
  onContextMenuItem?: (item: Character.Item.TItem, index: number, e: MouseEvent) => void;
};

export default function StorageGrid({
  gridClassName,
  gridStyle,
  storageId,
  cells,
  columns,
  renderItemVisual,
  onDragOver,
  onDropAt,
  onDragStartAt,
  onMouseEnterItem,
  onMouseLeaveItem,
  onContextMenuItem,
}: StorageGridProps) {
  const safeColumns = Math.max(1, Number(columns || 1));

  return (
    <div className={gridClassName} style={gridStyle}>
      {cells.map((_, index) => (
        <div
          key={`storage-drop-cell-${index}`}
          className="aspect-square border border-slate-500/70 bg-slate-800/35 p-1 text-center fancy-container"
          style={{
            gridColumn: `${(index % safeColumns) + 1} / span 1`,
            gridRow: `${Math.floor(index / safeColumns) + 1} / span 1`,
          }}
          onDragOver={onDragOver}
          onDrop={onDropAt(index)}
        />
      ))}
      {cells.map((cell, index) => {
        if (!cell) return null;
        const size = getItemGridSize(cell.item, storageId);
        return (
          <div
            key={`storage-item-${index}-${cell.item.name}`}
            className="border border-slate-300/70 bg-slate-500/45 p-1 text-center fancy-container z-[1] overflow-hidden"
            style={{
              gridColumn: `${(index % safeColumns) + 1} / span ${size.x}`,
              gridRow: `${Math.floor(index / safeColumns) + 1} / span ${size.y}`,
            }}
            draggable
            onDragOver={onDragOver}
            onDrop={onDropAt(index)}
            onDragStart={onDragStartAt(cell.item, index)}
          onMouseEnter={
            cell && onMouseEnterItem
              ? (e) => onMouseEnterItem(cell.item, e as unknown as MouseEvent)
              : undefined
          }
          onMouseLeave={cell && onMouseLeaveItem ? onMouseLeaveItem : undefined}
          onContextMenu={
            cell && onContextMenuItem
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenuItem(cell.item, index, e as unknown as MouseEvent);
                }
              : undefined
          }
        >
            <div className="relative flex h-full min-w-0 items-center justify-center overflow-hidden text-[9px]">
              {renderItemVisual(cell.item)}
              <span className="absolute inset-0 flex items-end justify-center overflow-hidden bg-black/25 px-0.5 pb-0.5 text-center leading-tight text-white [overflow-wrap:anywhere]">
                <span className="max-h-[2.4em] overflow-hidden">
                  {cell.item.name}
                  {cell.amount > 1 ? ` x${cell.amount}` : ""}
                </span>
              </span>
            </div>
            </div>
        );
      })}
    </div>
  );
}
