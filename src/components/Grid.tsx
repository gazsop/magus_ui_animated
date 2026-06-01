import { JSX } from "preact";


type GridProps = {
  data: JSX.Element[][];
  label?: string;
  classes?: {
    rows?: string[];
    cols?: string[];
    cells?: Array<[number, number, string]>;
  };
  options?: {
    width?: number[];
    minWidth?: number[];
    alignItems?: string;
    justifyItems?: string;
    gap?: string;
  };
};

const Grid = ({ data, label, classes = {}, options = {} }: GridProps) => {
  const {
    width = [],
    minWidth = [],
    alignItems = "stretch",
    justifyItems = "stretch",
    gap = "4",
  } = options;
  const { rows = [], cols = [], cells = [] } = classes;

  if (
    (width.length && width.length !== data[0]?.length) ||
    (minWidth.length && minWidth.length !== data[0]?.length)
  )
    return null;

  return (
    <div>
      {label && <h2 className="text-lg font-bold mb-4">{label}</h2>}
      <div
        className={`grid gap-${gap} p-5 grid-cols-${data[0]?.length || 1}`}
        style={{ alignItems, justifyItems }}
      >
        {data.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className={`${rows[rowIndex] || ""}`}>
            {row.map((element, colIndex) => {
              const cellClass =
                cells.find(([r, c]) => r === rowIndex && c === colIndex)?.[2] ||
                cols[colIndex] ||
                "";
              return (
                <div
                  key={`col-${rowIndex}-${colIndex}`}
                  className={`bg-gray-200 border border-gray-300 p-5 rounded text-center ${
                    width[colIndex] ? `w-[${width[colIndex]}%]` : "w-auto"
                  } ${
                    minWidth[colIndex] ? `min-w-[${minWidth[colIndex]}%]` : ""
                  } ${cellClass}`}
                >
                  {element}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Grid;
