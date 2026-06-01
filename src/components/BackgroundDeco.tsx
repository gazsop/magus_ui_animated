import { useEffect, useState } from "preact/hooks";
import borderInnerCol from "/imgs/border_inner_column.png";

const getVisibleViewport = () => ({
  width: Math.floor(window.visualViewport?.width || window.innerWidth),
  height: Math.floor(window.visualViewport?.height || window.innerHeight),
});

export default function BackgroundDeco({
  backgroundOffsetX = 10,
  backgroundOffsetY = 10,
}: {
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
}) {
  const [viewport, setViewport] = useState(getVisibleViewport);
  const isSm = viewport.width < 768;

  const windowHeight = Math.max(1, viewport.height);
  const windowWidth = Math.max(1, viewport.width);
  const safeOffsetX = Math.min(backgroundOffsetX, Math.floor(windowWidth / 2));
  const safeOffsetY = Math.min(backgroundOffsetY, Math.floor(windowHeight / 2));

  const borderWidth = isSm ? 4 : 5;
  const cornerDecoWidth = isSm ? 50 : 60;

  useEffect(() => {
    const resizeWidthListener = () => {
      setViewport(getVisibleViewport());
    };
    window.addEventListener("resize", resizeWidthListener);
    window.visualViewport?.addEventListener("resize", resizeWidthListener);
    window.visualViewport?.addEventListener("scroll", resizeWidthListener);
    return () => {
      window.removeEventListener("resize", resizeWidthListener);
      window.visualViewport?.removeEventListener("resize", resizeWidthListener);
      window.visualViewport?.removeEventListener("scroll", resizeWidthListener);
    };
  }, []);

  return (
    <div
      className="select-none pointer-events-none absolute top-0 left-0 overflow-hidden"
      style={{ width: windowWidth, height: windowHeight }}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          height: windowHeight,
          width: safeOffsetX,
          backgroundColor: "rgba(123, 69, 0, 0.24)",
        }}
      />
      <div
        className="absolute top-0 right-0"
        style={{
          height: windowHeight,
          width: safeOffsetX,
          backgroundColor: "rgba(123, 69, 0, 0.24)",
        }}
      />
      <div
        className="absolute top-0"
        style={{
          height: safeOffsetY,
          width: Math.max(0, windowWidth - 2 * safeOffsetX),
          left: safeOffsetX,
          backgroundColor: "rgba(123, 69, 0, 0.24)",
        }}
      />
      <div
        className="absolute"
        style={{
          height: safeOffsetY,
          width: Math.max(0, windowWidth - 2 * safeOffsetX),
          top: windowHeight - safeOffsetY,
          left: safeOffsetX,
          backgroundColor: "rgba(123, 69, 0, 0.24)",
        }}
      />
      <img
        src={
          isSm
            ? "/imgs/border_deco_corner_m.png"
            : "/imgs/border_deco_corner.png"
        }
        className="absolute top-0 right-0 pointer-events-none"
        style={{ zIndex: 10, width: cornerDecoWidth }}
      />
      <img
        src={
          isSm
            ? "/imgs/border_deco_corner_m.png"
            : "/imgs/border_deco_corner.png"
        }
        className={`${
          isSm ? "rotate-180 " : "-rotate-90 "
        }absolute top-0 left-0 select-none pointer-events-none`}
        style={{ zIndex: 10, width: cornerDecoWidth }}
      />
      <img
        src={
          isSm
            ? "/imgs/border_deco_corner_m.png"
            : "/imgs/border_deco_corner.png"
        }
        className="absolute left-0 select-none rotate-180 pointer-events-none"
        style={{
          zIndex: 10,
          width: cornerDecoWidth,
          top: isSm
            ? windowHeight - cornerDecoWidth / 2 - 2
            : windowHeight - cornerDecoWidth,
        }}
      />
      <img
        src={
          isSm
            ? "/imgs/border_deco_corner_m.png"
            : "/imgs/border_deco_corner.png"
        }
        className={`${
          isSm ? "" : "rotate-90 "
        }absolute right-0 select-none pointer-events-none`}
        style={{
          zIndex: 10,
          width: cornerDecoWidth,
          top: isSm
            ? windowHeight - cornerDecoWidth / 2 - 2
            : windowHeight - cornerDecoWidth,
        }}
      />
      <img
        src={borderInnerCol}
        className="absolute pointer-events-none"
        style={{
          zIndex: 9,
          height: `${Math.max(0, windowHeight - 2 * safeOffsetY)}px`,
          top: safeOffsetY,
          right: safeOffsetX,
          width: borderWidth,
        }}
      />
      <img
        src={borderInnerCol}
        className="absolute pointer-events-none"
        style={{
          zIndex: 9,
          height: `${Math.max(0, windowHeight - 2 * safeOffsetY)}px`,
          width: borderWidth,
          left: safeOffsetX,
          top: safeOffsetY,
        }}
      />
      <img
        src={borderInnerCol}
        className="absolute origin-top-right -rotate-90 pointer-events-none"
        style={{
          zIndex: 9,
          height: `calc(100vw - ${
            isSm ? 2 * (safeOffsetY + borderWidth) : 2 * safeOffsetY
          }px)`,
          top: safeOffsetY,
          left: safeOffsetY,
          width: borderWidth,
        }}
      />
      <img
        src={borderInnerCol}
        className="absolute origin-bottom-right rotate-90 pointer-events-none"
        style={{
          zIndex: 9,
          height: `calc(100vw - ${
            isSm ? 2 * (safeOffsetY + borderWidth) : 2 * safeOffsetY
          }px)`,
          width: borderWidth,
          bottom: -1 * (windowHeight - safeOffsetY),
          left: safeOffsetY,
        }}
      />
    </div>
  );
}
