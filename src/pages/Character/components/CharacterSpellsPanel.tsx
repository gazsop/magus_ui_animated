import { Character } from "@shared/contracts";
import { formatSpellCost, formatSpellDuration } from "@shared/game";
import { FlexCol } from "@components/Flex";

export default function CharacterSpellsPanel({
  spells,
  levelCap,
  selectedSpecialization,
}: {
  spells: Character.Spell.TSpellElements[];
  levelCap?: number;
  selectedSpecialization?: string;
}) {
  const visibleSpells = spells
    .filter((spell) => Number(spell.lvlReq || 0) <= Number(levelCap ?? Number.MAX_SAFE_INTEGER))
    .filter((spell) => {
      if (!selectedSpecialization) return true;
      const spec = String(spell.spec || "").trim().toLowerCase();
      return spec === "common" || spec === selectedSpecialization.trim().toLowerCase();
    });

  return (
    <FlexCol className="gap-2">
      <p className="font-semibold">Spells</p>
      <FlexCol className="gap-1 max-h-[50vh] overflow-auto pr-1">
        {visibleSpells.length === 0 ? (
          <p className="text-xs opacity-70">No spells available at this level.</p>
        ) : (
          visibleSpells.map((spell) => (
            <div key={`spell-${spell.id}`} className="fancy-container p-1 select-none">
              <p className="font-semibold break-words">{spell.name}</p>
              <p className="text-xs break-words">
                Lvl: {spell.lvlReq} | {spell.spec || "common"} | {spell.activation}
              </p>
              <p className="text-xs break-words">
                Schools: {spell.schools?.length ? spell.schools.join(", ") : "-"}
              </p>
              {spell.choice ? (
                <p className="text-xs break-words">Choice: {spell.choice.label}</p>
              ) : null}
              <FlexCol className="gap-0.5 my-1">
                {(spell.upgrades || []).map((upgrade) => (
                  <p key={`spell-upgrade-${spell.id}-${upgrade.level}`} className="text-xs break-words">
                    Lvl {upgrade.level}:{" "}
                    {upgrade.available ? (upgrade.stagnates ? "Stagnál" : upgrade.raw) : "-"} | Cost:{" "}
                    {formatSpellCost(upgrade.cost)} | Duration:{" "}
                    {formatSpellDuration(upgrade.duration)}
                  </p>
                ))}
              </FlexCol>
              <p className="text-xs break-words">{spell.description}</p>
            </div>
          ))
        )}
      </FlexCol>
    </FlexCol>
  );
}
