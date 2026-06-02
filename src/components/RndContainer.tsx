import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { DraggableData, Rnd, RndDragEvent } from "react-rnd";
import { FlexRow, FlexCol } from "./Flex";
import RefreshCwIcon from "./icons/general/RefreshCwIcon";
import MoveIcon from "./icons/general/MoveIcon";
import MaximizeIcon from "./icons/general/MaximizeIcon";
import MinimizeIcon from "./icons/general/MinimizeIcon";
import XIcon from "./icons/general/XIcon";
import FancyWindow from "./FancyWindow";
import { JSX } from "preact";

const yOff = {
  sm: 5,
  md: 24,
};
const xOff = {
  sm: 4,
  md: 24,
};

const MIN_WINDOW_SIZE = 240;

export const RndWindowControlsContext = createContext<{
  minimize?: () => void;
  selectWindow?: () => void;
  zIndex?: number;
} | null>(null);

function RndContainer({
  id,
  aditionalIcons,
  close,
  minimize,
  selectWindow,
  zIndex,
  label,
  children,
  onDragStart,
  onSizeChange,
  className,
  hideClose = false,
}: {
  id: string;
  aditionalIcons: JSX.Element | null;
  close: () => void;
  minimize?: () => void;
  selectWindow?: () => void;
  zIndex?: number;
  label: string;
  children: JSX.Element | JSX.Element[];
  onDragStart?: (e: RndDragEvent) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  className?: string;
  hideClose?: boolean;
}) {
  const inheritedControls = useContext(RndWindowControlsContext);
  const effectiveMinimize = minimize ?? inheritedControls?.minimize;
  const effectiveSelectWindow = selectWindow ?? inheritedControls?.selectWindow;
  const effectiveZIndex = zIndex ?? inheritedControls?.zIndex ?? "var(--layer-window)";
  const bringToFront = () => {
    effectiveSelectWindow?.();
  };
  const getViewportSize = () => ({
    width: Math.floor(window.visualViewport?.width || window.innerWidth),
    height: Math.floor(window.visualViewport?.height || window.innerHeight),
  });
  const getXOff = () => (getViewportSize().width < 768 ? xOff.sm : xOff.md);
  const getYOff = () => (getViewportSize().width < 768 ? yOff.sm : yOff.md);
  const getBounds = () => {
    const viewport = getViewportSize();
    const xOffPx = getXOff();
    const yOffPx = getYOff();
    return {
      viewport,
      xOffPx,
      yOffPx,
      maxWidth: Math.max(1, viewport.width - 2 * xOffPx),
      maxHeight: Math.max(1, viewport.height - 2 * yOffPx),
    };
  };

  const [onDragState, setOnDragState] = useState(false);
  const [resizeable, setResizeable] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: getBounds().maxWidth,
    height: getBounds().maxHeight,
  });
  const [windowPosition, setWindowPosition] = useState({
    x: getXOff(),
    y: getYOff(),
  });
  const lastSizeChangeRef = useRef<{ width: number; height: number } | null>(null);

  const emitSizeChange = (size: { width: number; height: number }) => {
    const previous = lastSizeChangeRef.current;
    if (previous?.width === size.width && previous.height === size.height) return;
    lastSizeChangeRef.current = size;
    onSizeChange?.(size);
  };

  useEffect(() => {
    emitSizeChange(windowSize);
  }, [windowSize]);

  useEffect(() => {
    const onResize = () => {
      const { viewport, xOffPx, yOffPx, maxWidth, maxHeight } = getBounds();
      const minWidth = Math.min(MIN_WINDOW_SIZE, maxWidth);
      const minHeight = Math.min(MIN_WINDOW_SIZE, maxHeight);
      setWindowSize((prevSize) => {
        const nextSize = {
          width: Math.max(minWidth, Math.min(prevSize.width, maxWidth)),
          height: Math.max(minHeight, Math.min(prevSize.height, maxHeight)),
        };

        setWindowPosition((prevPos) => ({
          x: Math.min(
            Math.max(prevPos.x, xOffPx),
            Math.max(xOffPx, viewport.width - nextSize.width - xOffPx)
          ),
          y: Math.min(
            Math.max(prevPos.y, yOffPx),
            Math.max(yOffPx, viewport.height - nextSize.height - yOffPx)
          ),
        }));

        return nextSize;
      });
    };

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <Rnd
        id={id}
        size={{ width: windowSize.width, height: windowSize.height }}
        position={{ x: windowPosition.x, y: windowPosition.y }}
        onMouseDown={bringToFront}
        onTouchStart={bringToFront}
        onDragStart={(e: RndDragEvent) => {
          bringToFront();
          if (e && onDragStart) onDragStart(e);
          if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
            const target = e.target as HTMLElement;
            if (target.closest(".move") && onDragState) {
              setOnDragState(false);
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }}
        onDragStop={(_e: MouseEvent | TouchEvent, d: DraggableData) => {
          const { viewport, xOffPx, yOffPx } = getBounds();
          let x = d.x;
          let y = d.y;
          if (d.x < xOffPx) x = xOffPx;
          if (d.y < yOffPx) y = yOffPx;
          if (x + windowSize.width > viewport.width - xOffPx)
            x = viewport.width - windowSize.width - xOffPx;
          if (y + windowSize.height > viewport.height - yOffPx)
            y = viewport.height - windowSize.height - yOffPx;

          setWindowPosition({ x: x, y: y });
        }}
        onResizeStop={(
          _e: MouseEvent | TouchEvent,
          _: unknown,
          ref: HTMLElement,
          __: unknown,
          position: { x: number; y: number }
        ) => {
          let width = parseInt(ref.style.width);
          let height = parseInt(ref.style.height);
          let x = position.x;
          let y = position.y;
          const { viewport, xOffPx, yOffPx, maxWidth, maxHeight } = getBounds();
          const minWidth = Math.min(MIN_WINDOW_SIZE, maxWidth);
          const minHeight = Math.min(MIN_WINDOW_SIZE, maxHeight);
          if (x < xOffPx) x = xOffPx;
          if (y < yOffPx) y = yOffPx;
          if (height + y > viewport.height - yOffPx) {
            height = maxHeight;
            y = yOffPx;
          }
          if (width + x > viewport.width - xOffPx) {
            width = maxWidth;
            x = xOffPx;
          }

          if (width < minWidth) width = minWidth;
          if (height < minHeight) height = minHeight;
          setWindowSize({
            width: width,
            height: height,
          });
          setWindowPosition({
            x: x,
            y: y,
          });
        }}
        onResize={(
          _e: MouseEvent | TouchEvent,
          _direction: unknown,
          ref: HTMLElement
        ) => {
          const width = parseInt(ref.style.width);
          const height = parseInt(ref.style.height);
          if (Number.isFinite(width) && Number.isFinite(height)) {
            emitSizeChange({ width, height });
          }
        }}
        className={`${
          className ? className + " " : ""
        }flex flex-col border border-black pointer-events-auto`}
        disableDragging={!onDragState}
        enableResizing={resizeable}
        resizeGrid={[20, 20]}
        dragGrid={[20, 20]}
        style={{
          zIndex: effectiveZIndex,
        }}
      >
        <FancyWindow height={windowSize.height} width={windowSize.width}>
          <FlexRow
            className="absolute top-2 right-4 h-auto w-max max-w-[calc(100%-2rem)] justify-end items-center cursor-default select-none"
            style={{
              zIndex: "var(--layer-window-header)",
            }}
          >
            <FlexRow className={`fancy-container touch-none`}>
              {aditionalIcons}
              <RefreshCwIcon
                className="h-5 sm:h-4 m-1 w-7 sm:w-6 cursor-pointer"
                onClick={() => {
                  bringToFront();
                  setOnDragState(true);
                  setResizeable(false);
                  setWindowPosition({ x: getXOff(), y: getYOff() });
                  const { maxWidth, maxHeight } = getBounds();
                  setWindowSize({
                    width: Math.min(MIN_WINDOW_SIZE, maxWidth),
                    height: Math.min(MIN_WINDOW_SIZE, maxHeight),
                  });
                }}
              />
              <MoveIcon
                className={`relative h-5 sm:h-4 m-1 w-7 sm:w-6 cursor-pointer ${
                  onDragState ? "text-[#22c55e]" : ""
                }`}
                onClick={() => {
                  bringToFront();
                  setOnDragState((prev) => !prev);
                }}
              />
              <MaximizeIcon
                className={`h-5 sm:h-4 m-1 w-7 sm:w-6 cursor-pointer ${
                  resizeable ? "text-[#22c55e]" : ""
                }`}
                onClick={() => {
                  bringToFront();
                  setResizeable((prev) => !prev);
                }}
              />
              {effectiveMinimize ? (
                <span onClick={effectiveMinimize}>
                  <MinimizeIcon className="h-5 sm:h-4 m-1 w-7 sm:w-6 cursor-pointer" />
                </span>
              ) : null}
              {!hideClose && (
                <XIcon className="h-5 sm:h-4 m-1 w-7 sm:w-6 cursor-pointer" onClick={close} />
              )}
            </FlexRow>
          </FlexRow>
          <FlexRow
            className="h-[calc(100%-1.5rem)] w-full min-w-0 min-h-0 overflow-auto grow"
            style={{
              zIndex: "var(--layer-window-content)",
            }}
          >
            <FlexCol
              className={`fancy-container w-full h-full min-w-0 min-h-0 shrink-0 grow overflow-auto p-2 pt-4`}
            >
              <p>{label}</p>
              {children}
            </FlexCol>
            {onDragState && (
              <div
                id="invisible-layer"
                className={`absolute top-[1.5rem] left-0 w-full h-[calc(100%-1.5rem)] bg-transparent grow`}
              ></div>
            )}
          </FlexRow>
        </FancyWindow>
      </Rnd>
    </div>
  );
}

export default RndContainer;
