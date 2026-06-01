import { Character } from "@shared/contracts";
import { FlexCol } from "@components/Flex";
import SecondaryStatsTable from "@components/SecondaryStatsTable";

export default function CharacterSecondarySkillsPanel({
  secondaryStats,
  currentLevel,
}: {
  secondaryStats: Character.TSecondaryStat[];
  currentLevel: number;
}) {
  return (
    <FlexCol className="fancy-container p-0.5 min-w-0 min-h-0 w-full h-full shrink-0 overflow-hidden">
      <p className="font-bold">Secondary Skills</p>
      <div className="mt-0.5 w-full min-h-0 grow overflow-y-auto overflow-x-hidden">
        <SecondaryStatsTable
          stats={secondaryStats}
          currentLevel={currentLevel}
        />
      </div>
    </FlexCol>
  );
}
