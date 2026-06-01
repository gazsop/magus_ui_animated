import bgParchment from "/imgs/bg_parchment_2.png";
import borderCol from "/imgs/border_outer_column.png";
import borderInnerCol from "/imgs/border_inner_column.png";
import borderInnerCor from "/imgs/border_inner_corner.png";
import borderCor2 from "/imgs/border_corner.png";
import { FlexCol } from "./Flex";
import { JSX } from "preact/compat";

function FancyWindow({
  height,
  width,
  children,
}: {
  height: number;
  width: number;
  children?: JSX.Element | JSX.Element[];
}) {
  const outerBorderWidth = 5;
  const innerBorderWidth = 3;
  const cornerOffset = 10;
  const BetweenBordersDivWidth = 15;

  const OuterBorder = () => (
    <>
      <img
        src={borderCol}
        className={`absolute top-[5px] right-0`}
        style={{
          top: `${outerBorderWidth}px`,
          right: `0px`,
          width: `${outerBorderWidth}px`,
          height: `${height - 2 * outerBorderWidth}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderCol}
        className={`absolute rotate-180`}
        style={{
          top: `${outerBorderWidth}px`,
          left: `0px`,
          width: `${outerBorderWidth}px`,
          height: `${height - 2 * outerBorderWidth}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderCol}
        className={`absolute origin-bottom-right rotate-90`}
        style={{
          width: `${outerBorderWidth}px`,
          height: `${width}px`,
          left: `-${outerBorderWidth}px`,
          bottom: `0px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderCol}
        className={`absolute origin-top-right -rotate-90 outerBorder4`}
        style={{
          top: `0px`,
          left: `-${outerBorderWidth}px`,
          width: `${outerBorderWidth}px`,
          height: `${width}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderCor2}
        className={`absolute rotate-180`}
        style={{
          top: `0px`,
          left: `0px`,
          width: `${outerBorderWidth}px`,
          height: `${outerBorderWidth}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderCor2}
        className={`absolute `}
        style={{
          bottom: `0px`,
          right: `0px`,
          width: `${outerBorderWidth}px`,
          height: `${outerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
      <img
        src={borderCor2}
        className={`absolute rotate-90`}
        style={{
          bottom: `0px`,
          left: `0px`,
          width: `${outerBorderWidth}px`,
          height: `${outerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
      <img
        src={borderCor2}
        className={`absolute -rotate-90`}
        style={{
          bottom: `${height - outerBorderWidth}px`,
          right: `0px`,
          width: `${outerBorderWidth}px`,
          height: `${outerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
    </>
  );

  const InnerBorder = () => (
    <>
      <img
        src={borderInnerCol}
        className={`absolute select-none`}
        style={{
          top: `${outerBorderWidth + cornerOffset}px`,
          left: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          width: `${innerBorderWidth}px`,
          height: `${height - 2 * (outerBorderWidth + cornerOffset)}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderInnerCol}
        className={`absolute select-none`}
        style={{
          top: `${outerBorderWidth + cornerOffset}px`,
          right: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          width: `${innerBorderWidth}px`,
          height: `${height - 2 * (outerBorderWidth + cornerOffset)}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderInnerCol}
        className={`absolute select-none origin-top-right rotate-90`}
        style={{
          top: `${outerBorderWidth + cornerOffset}px`,
          right: `${outerBorderWidth + cornerOffset}px`,
          width: `${innerBorderWidth}px`,
          height: `${width - 2 * (outerBorderWidth + cornerOffset)}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderInnerCol}
        className={`absolute select-none origin-bottom-right rotate-90 innerBorder4`}
        style={{
          bottom: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          left: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          width: `${innerBorderWidth}px`,
          height: `${width - 2 * (outerBorderWidth + cornerOffset)}px`,
          zIndex: "var(--layer-window-decor)",
        }}
      />
      <img
        src={borderInnerCor}
        className={`absolute select-none`}
        style={{
          top: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          left: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          width: `${innerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
      <img
        src={borderInnerCor}
        className={`absolute origin-bottom-left rotate-90 select-none`}
        style={{
          top: `${outerBorderWidth + cornerOffset - 2 * innerBorderWidth}px`,
          right: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          width: `${innerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
      <img
        src={borderInnerCor}
        className={`absolute origin-top-right rotate-180 select-none`}
        style={{
          bottom: `${outerBorderWidth + cornerOffset - 2 * innerBorderWidth}px`,
          right: `${outerBorderWidth + cornerOffset}px`,
          width: `${innerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
      <img
        src={borderInnerCor}
        className={`absolute origin-top-left -rotate-90 select-none`}
        style={{
          bottom: `${outerBorderWidth + cornerOffset - 2 * innerBorderWidth}px`,
          left: `${outerBorderWidth + cornerOffset - innerBorderWidth}px`,
          width: `${innerBorderWidth}px`,
          zIndex: "var(--layer-window-decor2)",
        }}
      />
    </>
  );

  const InnerOverlay = () => {
    return (
      <div
        className={`absolute fancy-container`}
        style={{
          height: `${height - 2 * (outerBorderWidth + cornerOffset)}px`,
          width: `${width - 2 * (outerBorderWidth + cornerOffset)}px`,
          left: `${BetweenBordersDivWidth}px`,
          top: `${BetweenBordersDivWidth}px`,
          zIndex: "var(--layer-window-bg)",
        }}
      />
    );
  };
  return (
    <div
      className={`relative bg-left-top bg-no-repeat bg-cover h-full p-4`}
      style={{
        height: `${height}px`,
        width: `${width}px`,
        backgroundImage: `url(${bgParchment})`,
      }}
    >
      <div
        className="absolute top-0 left-0 w-full h-full bg-[rgba(255,255,255,0.5)]"
        style={{
          zIndex: "var(--layer-window-decor-bg)",
        }}
      >
        <InnerOverlay />
        <OuterBorder />
        <InnerBorder />
      </div>
      <FlexCol
        className="overflow-auto h-full w-full"
        style={{
          zIndex: "var(--layer-window-content)",
        }}
      >
        {children}
      </FlexCol>
    </div>
  );
}

export default FancyWindow;
