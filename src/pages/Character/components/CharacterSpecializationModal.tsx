import { Character } from "@shared/contracts";
import { useEffect, useMemo, useState } from "preact/hooks";

type TSpellPreview = Character.Spell.TSpellElements | Character.Spell.ISpellLevel;

const normalizeText = (value: unknown): string => String(value || "").trim();

const spellMatchesSpec = (spell: TSpellPreview, specName: string): boolean =>
  normalizeText(spell.spec).toLowerCase() === normalizeText(specName).toLowerCase();

const spellIsLevelTenToTwenty = (spell: TSpellPreview): boolean => {
  const lvlReq = Number(spell.lvlReq || 0);
  return lvlReq >= 10 && lvlReq <= 20;
};

const flattenSpecSpells = (
  spells: Character.Spell.TSpellElements[],
  specName: string
): TSpellPreview[] =>
  spells
    .flatMap((spell) => [spell, ...(spell.levels || [])])
    .filter((spell) => spellMatchesSpec(spell, specName))
    .filter(spellIsLevelTenToTwenty)
    .sort((a, b) => Number(a.lvlReq || 0) - Number(b.lvlReq || 0));

export default function CharacterSpecializationModal({
  specs,
  spells,
  selected,
  isMobile,
  onSelect,
}: {
  specs: Character.TClass["specs"];
  spells: Character.Spell.TSpellElements[];
  selected: string;
  isMobile: boolean;
  onSelect: (specName: string) => void;
}) {
  const visibleSpecs = useMemo(
    () => (specs || []).filter((spec) => normalizeText(spec.name)),
    [specs]
  );
  const selectedIndex = visibleSpecs.findIndex(
    (spec) => normalizeText(spec.name).toLowerCase() === normalizeText(selected).toLowerCase()
  );
  const [page, setPage] = useState(() => Math.max(0, selectedIndex));

  useEffect(() => {
    setPage(Math.max(0, selectedIndex));
  }, [selectedIndex, visibleSpecs.length]);

  const renderSpecCard = (spec: Character.TClass["specs"][number]) => {
    const specName = normalizeText(spec.name);
    const specSpells = flattenSpecSpells(spells, specName);
    const isSelected = normalizeText(selected).toLowerCase() === specName.toLowerCase();

    return (
      <button
        type="button"
        className={`fancy-container p-2 text-left min-h-[280px] flex flex-col gap-2 border ${
          isSelected ? "border-amber-300 bg-amber-950/40" : "border-slate-500"
        }`}
        onClick={() => onSelect(specName)}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-lg">{specName}</p>
            {spec.description ? (
              <p className="text-xs opacity-80 mt-0.5">{spec.description}</p>
            ) : null}
          </div>
          <span className="text-xs px-2 py-0.5 rounded border border-slate-500">
            {isSelected ? "Selected" : "Choose"}
          </span>
        </div>

        <div className="min-h-0 grow overflow-auto flex flex-col gap-1">
          <p className="text-xs font-semibold opacity-80">Level 10-20 spells</p>
          {specSpells.length === 0 ? (
            <p className="text-xs opacity-70">No level 10-20 spells for this specialization yet.</p>
          ) : (
            specSpells.map((spell) => (
              <div key={`spec-spell-${specName}-${spell.id}`} className="rounded border border-slate-600 p-1">
                <p className="font-semibold text-sm break-words">
                  {spell.name}
                  {"rank" in spell && spell.rank ? ` r${spell.rank}` : ""}
                </p>
                <p className="text-xs opacity-80">
                  Level {spell.lvlReq} | Cost {spell.resourceCost}
                </p>
                {spell.description ? (
                  <p className="text-xs break-words mt-0.5">{spell.description}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </button>
    );
  };

  if (visibleSpecs.length === 0) {
    return (
      <div className="flex flex-col gap-2 min-h-0">
        <p className="text-sm font-semibold">Choose Specialization</p>
        <p className="text-sm text-red-700">Current class has no specializations configured.</p>
      </div>
    );
  }

  if (isMobile) {
    const currentPage = Math.min(page, visibleSpecs.length - 1);
    const currentSpec = visibleSpecs[currentPage];

    return (
      <div className="flex flex-col gap-2 min-h-0">
        <div>
          <p className="text-sm font-semibold">Choose Specialization</p>
          <p className="text-xs opacity-80">
            Page {currentPage + 1}/{visibleSpecs.length}
          </p>
        </div>
        {renderSpecCard(currentSpec)}
        <div className="flex justify-between gap-2">
          <button
            type="button"
            className="fancy-container px-2 py-1"
            disabled={currentPage <= 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            Previous spec
          </button>
          <button
            type="button"
            className="fancy-container px-2 py-1"
            disabled={currentPage >= visibleSpecs.length - 1}
            onClick={() => setPage((prev) => Math.min(visibleSpecs.length - 1, prev + 1))}
          >
            Next spec
          </button>
        </div>
      </div>
    );
  }

  const columnCount = Math.min(4, Math.max(2, visibleSpecs.length));

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div>
        <p className="text-sm font-semibold">Choose Specialization</p>
        <p className="text-xs opacity-80">
          Pick one branch. Each card previews specialization spells from level 10 to 20.
        </p>
      </div>
      <div
        className="grid gap-2 min-h-0"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {visibleSpecs.map((spec) => (
          <div key={`spec-card-${spec.name}`} className="min-w-0">
            {renderSpecCard(spec)}
          </div>
        ))}
      </div>
    </div>
  );
}
