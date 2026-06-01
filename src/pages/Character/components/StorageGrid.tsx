import { h } from "preact";
import { Character } from "@shared/contracts";
import { getItemGridSize } from "@shared/game";
import { FlexCol } from "@components/Flex";

type StorageGridProps = {
  gridClassName: string;
  gridStyle?: h.JSX.CSSProperties;
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
          className="aspect-square border p-1 text-center fancy-container"
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
        const size = getItemGridSize(cell.item);
        return (
          <div
            key={`storage-item-${index}-${cell.item.name}`}
            className="border p-1 text-center fancy-container z-[1] overflow-hidden"
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
            <FlexCol className="text-[9px] items-center h-full justify-center">
                {renderItemVisual(cell.item)}
                <span className="truncate max-w-full">{cell.item.name}</span>
                {cell.amount > 1 ? <span className="truncate max-w-full">x{cell.amount}</span> : null}
              </FlexCol>
            </div>
        );
      })}
    </div>
  );
}
