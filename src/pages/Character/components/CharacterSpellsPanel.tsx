import { Character } from "@shared/contracts";
import { FlexCol } from "@components/Flex";

export default function CharacterSpellsPanel({
  spells,
  levelCap,
  selectedSpecialization,
}: {
  spells: Character.Spell.TSpellElements[];
  levelCap: number;
  selectedSpecialization?: string;
}) {
  return (
    <FlexCol className="fancy-container p-0.5 min-w-0 min-h-0 w-full h-full overflow-hidden">
      <p className="font-bold">Spells</p>
      <p className="text-xs opacity-80">
        Visible up to level {levelCap}
        {selectedSpecialization ? ` | Specialization: ${selectedSpecialization}` : ""}
      </p>
      <FlexCol className="gap-0.25 mt-0.5 w-full min-h-0 grow overflow-auto">
        {spells.length === 0 ? (
          <p>No spells for current class.</p>
        ) : (
          spells.map((spell) => (
            <div key={`spell-${spell.id}`} className="fancy-container p-0.5">
              <p className="font-semibold break-words">{spell.name}</p>
              <p className="text-xs break-words">
                Lvl: {spell.lvlReq} | Cost: {spell.resourceCost}
              </p>
              <p className="text-xs break-words">{spell.description}</p>
            </div>
          ))
        )}
      </FlexCol>
    </FlexCol>
  );
}
