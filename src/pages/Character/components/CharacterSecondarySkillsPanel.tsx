import { Application, Character, ServerApi } from "@shared/contracts";
import { FlexCol } from "@components/Flex";
import SecondaryStatsTable from "@components/SecondaryStatsTable";
import { previewSecondaryStatPointSpend, SecondaryStatDisplayRow } from "@shared/game";
import useRequest from "@hooks/request";
import useError from "@hooks/error";
import { useState } from "preact/hooks";

type TSpendConfig = {
  advId: string;
  uid: string;
  expectedHash: string;
  availablePoints: number;
  onUpdated: (payload: unknown) => void;
};

export default function CharacterSecondarySkillsPanel({
  secondaryStats,
  currentLevel,
  spend,
}: {
  secondaryStats: Character.TSecondaryStat[];
  currentLevel: number;
  spend?: TSpendConfig;
}) {
  const [request] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const { setError } = useError();
  const [pointsById, setPointsById] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState("");

  const renderSpendCell = (row: SecondaryStatDisplayRow) => {
    if (!spend) return null;
    const statId = row.current.id;
    const points = Math.max(0, Math.floor(Number(pointsById[statId] || 0)));
    const preview = previewSecondaryStatPointSpend(row.current, points);
    const available = Math.max(0, Math.floor(Number(spend.availablePoints || 0)));
    const disabled =
      busyId === statId ||
      !spend.expectedHash ||
      points < 1 ||
      points > available ||
      !preview.canSpend;
    const afterText = preview.canSpend
      ? `${preview.after.skillLevel} ${Number(preview.after.skill || 0)}`
      : "";

    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex gap-1 min-w-0">
          <input
            type="number"
            min={0}
            className="min-w-0 w-14 px-1 py-0.5 rounded"
            value={points}
            onInput={(event) => {
              const value = Math.max(
                0,
                Math.floor(Number((event.currentTarget as HTMLInputElement).value || 0))
              );
              setPointsById((prev) => ({ ...prev, [statId]: value }));
            }}
          />
          <button
            type="button"
            className="fancy-container px-1 py-0.5 disabled:opacity-50"
            disabled={disabled}
            onClick={async () => {
              if (disabled) return;
              setBusyId(statId);
              try {
                const response = await request<
                  Character.TCharacterServer | Character.TCharacter,
                  ServerApi.CharacterRoutes.SpendSecondarySkillPointsBody
                >({
                  endPoint: "/spendSecondarySkillPoints",
                  body: {
                    advId: spend.advId,
                    uid: spend.uid,
                    expectedHash: spend.expectedHash,
                    statId,
                    points,
                  },
                });
                spend.onUpdated(response.data);
                setPointsById((prev) => ({ ...prev, [statId]: 0 }));
              } catch (error) {
                setError("Képzettségpont költése sikertelen: " + error);
              } finally {
                setBusyId("");
              }
            }}
          >
            +
          </button>
        </div>
        {afterText ? <span className="text-[10px] opacity-75">{"->"} {afterText}</span> : null}
      </div>
    );
  };

  return (
    <FlexCol className="fancy-container p-0.5 min-w-0 min-h-0 w-full h-full shrink-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">Képzettségek</p>
        {spend ? (
          <p className="text-xs opacity-80">
            Elkölthető: {Math.max(0, Math.floor(Number(spend.availablePoints || 0)))}
          </p>
        ) : null}
      </div>
      <div className="mt-0.5 w-full min-h-0 grow overflow-y-auto overflow-x-hidden">
        <SecondaryStatsTable
          stats={secondaryStats}
          currentLevel={currentLevel}
          renderActionCell={spend ? renderSpendCell : undefined}
        />
      </div>
    </FlexCol>
  );
}
