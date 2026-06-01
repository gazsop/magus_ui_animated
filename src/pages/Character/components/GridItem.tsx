import { JSX } from "preact";
import { DraggableData, Rnd } from "react-rnd";

export type TGridSpec = {
  cellW: number;
  rowH: number;
  gap: number;
  cols: number;
};

export type TGridLayoutPatch = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export default function GridItem({
  children,
  x = 1,
  y = 1,
  colSpan = 1,
  rowSpan = 1,
  editable = false,
  grid,
  onCommit,
}: {
  children: JSX.Element | JSX.Element[] | null;
  x?: number;
  y?: number;
  colSpan?: number;
  rowSpan?: number;
  editable?: boolean;
  grid?: TGridSpec;
  onCommit?: (next: TGridLayoutPatch) => void;
}) {
  const safeX = Math.max(1, Math.floor(x));
  const safeY = Math.max(1, Math.floor(y));
  const safeCol = Math.max(1, Math.floor(colSpan));
  const safeRow = Math.max(1, Math.floor(rowSpan));

  if (editable && grid) {
    const unitW = grid.cellW + grid.gap;
    const unitH = grid.rowH + grid.gap;
    const pxX = (safeX - 1) * unitW;
    const pxY = (safeY - 1) * unitH;
    const pxW = safeCol * grid.cellW + (safeCol - 1) * grid.gap;
    const pxH = safeRow * grid.rowH + (safeRow - 1) * grid.gap;

    return (
      <Rnd
        size={{ width: pxW, height: pxH }}
        position={{ x: pxX, y: pxY }}
        dragAxis="both"
        dragGrid={[unitW, unitH]}
        resizeGrid={[unitW, unitH]}
        bounds="parent"
        onDragStop={(_e: MouseEvent | TouchEvent, d: DraggableData) => {
          onCommit?.({
            x: 1 + Math.round(d.x / unitW),
            y: 1 + Math.round(d.y / unitH),
          });
        }}
        onResizeStop={(
          _e: MouseEvent | TouchEvent,
          _dir: unknown,
          ref: HTMLElement,
          _delta: unknown,
          position: { x: number; y: number }
        ) => {
          const width = parseInt(ref.style.width, 10) || pxW;
          const height = parseInt(ref.style.height, 10) || pxH;
          const nextW = Math.max(
            1,
            Math.round((width + grid.gap) / (grid.cellW + grid.gap))
          );
          const nextH = Math.max(
            1,
            Math.round((height + grid.gap) / (grid.rowH + grid.gap))
          );
          onCommit?.({
            x: 1 + Math.round(position.x / unitW),
            y: 1 + Math.round(position.y / unitH),
            w: nextW,
            h: nextH,
          });
        }}
        className="z-20"
      >
        <div className="w-full h-full min-w-0 min-h-0 relative overflow-hidden">
          <div
            className={
              editable
                ? "pointer-events-none w-full h-full min-w-0 min-h-0 overflow-hidden"
                : "w-full h-full min-w-0 min-h-0"
            }
          >
            {children}
          </div>
        </div>
      </Rnd>
    );
  }

  return (
    <div
      className="min-w-0 min-h-0 relative"
      style={{
        gridColumnStart: safeX,
        gridRowStart: safeY,
        gridColumnEnd: `span ${safeCol}`,
        gridRowEnd: `span ${safeRow}`,
        alignSelf: "stretch",
      }}
    >
      <div className="w-full h-full min-w-0 min-h-0 relative overflow-hidden">
        <div className="w-full h-full min-w-0 min-h-0">{children}</div>
      </div>
    </div>
  );
}
