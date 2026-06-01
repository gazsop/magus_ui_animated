import { Character } from "@shared/contracts";
import {
  buildSecondaryStatDisplayRows,
  SecondaryStatDisplayRow,
} from "@shared/game";
import { JSX } from "preact";

type TSecondaryStatsTableProps = {
  stats: Character.TSecondaryStat[];
  currentLevel: number;
  emptyText?: string;
  className?: string;
  tableClassName?: string;
  renderLevelCell?: (row: SecondaryStatDisplayRow) => JSX.Element;
  renderSkillCell?: (row: SecondaryStatDisplayRow) => JSX.Element;
  renderActionCell?: (row: SecondaryStatDisplayRow) => JSX.Element | null;
};

const renderAnnotatedValue = (base: JSX.Element | string, annotation: string) => (
  <>
    {base}
    {annotation ? <span className="opacity-75"> ({annotation})</span> : null}
  </>
);

export default function SecondaryStatsTable({
  stats,
  currentLevel,
  emptyText = "No secondary skills.",
  className = "",
  tableClassName = "",
  renderLevelCell,
  renderSkillCell,
  renderActionCell,
}: TSecondaryStatsTableProps) {
  const rows = buildSecondaryStatDisplayRows(stats || [], currentLevel);
  const hasActions = !!renderActionCell;

  if (rows.length === 0) return <p>{emptyText}</p>;

  return (
    <div className={className}>
      <table className={`w-full table-fixed border-collapse text-xs ${tableClassName}`}>
        <thead className="sticky top-0 fancy-container">
          <tr>
            <th className={`text-left p-0.5 ${hasActions ? "w-[34%]" : "w-[46%]"}`}>Name</th>
            <th className={`text-left p-0.5 ${hasActions ? "w-[24%]" : "w-[24%]"}`}>Level</th>
            <th className={`text-right p-0.5 ${hasActions ? "w-[18%]" : "w-[16%]"}`}>Skill</th>
            {hasActions ? <th className="text-left p-0.5 w-[24%]">Add</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`secondary-stat-${row.current.id || row.currentSourceIndex}-${row.name}`}
              className="border-t border-slate-400/30"
            >
              <td className="p-0.5 break-words font-semibold min-w-0">{row.name}</td>
              <td className="p-0.5 min-w-0 break-words">
                {renderLevelCell
                  ? renderAnnotatedValue(renderLevelCell(row), row.futureLevelText)
                  : row.levelText}
              </td>
              <td className="p-0.5 text-right min-w-0 break-words">
                {renderSkillCell
                  ? renderAnnotatedValue(renderSkillCell(row), row.futureSkillText)
                  : row.skillText}
              </td>
              {hasActions ? <td className="p-0.5 min-w-0 align-top">{renderActionCell(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
