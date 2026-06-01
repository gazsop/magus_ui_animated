import { useEffect, useState } from "preact/hooks";
import { Character } from "@shared/contracts";
import { FlexCol, FlexRow } from "@components/Flex";
import { InputUnq, SelectUnq } from "@components/GeneralElements";
import { MutableRefObject } from "preact/compat";

export function SecondaryStatLevelsElement({
  statArray,
  secondaryStatRefs,
}: {
  statArray: Character.TSecondaryStat[];
  secondaryStatRefs: MutableRefObject<Character.TSecondaryStat[]>;
}) {
  const [secondaryStats, setSecondaryStats] =
    useState<Character.TSecondaryStat[]>(statArray);

  useEffect(() => {
    setSecondaryStats(statArray);
  }, [statArray]);

  useEffect(() => {
    secondaryStatRefs.current = secondaryStats;
  }, [secondaryStats, secondaryStatRefs]);

  return (
    <FlexCol>
      {secondaryStats.map((stat, index) => (
        <FlexRow key={stat.id || `${stat.name}-${index}`}>
          <label className={"grow"}>{stat.name as string}</label>
          <SelectUnq
            id={`secondaryStat-${stat.id}`}
            key={`secondaryStat-${stat.id}`}
            label={"lvl"}
            optionData={Object.values(Character.SECONDARY_STAT_LEVEL).map(
              (c) => ({
                value: c,
                label: c,
              })
            )}
            onChange={(e) => {
              if (!e) return;
              setSecondaryStats((prev) => {
                const next = [...prev];
                next[index] = {
                  ...next[index],
                  skillLevel: e.value,
                };
                return next;
              });
            }}
            value={{
              label: stat.skillLevel,
              value: stat.skillLevel,
            }}
          />
          <InputUnq
            id={`secondaryStat-${stat.id}-1`}
            key={`secondaryStat-${stat.id}-1`}
            label={"xp"}
            type="number"
            value={stat.skill}
            onBlur={(e) => {
              const parsed = parseInt(e.currentTarget.value);
              setSecondaryStats((prev) => {
                const next = [...prev];
                next[index] = {
                  ...next[index],
                  skill: Number.isNaN(parsed) ? 0 : parsed,
                };
                return next;
              });
            }}
            widthOverride="w-20"
          />
          <InputUnq
            id={`secondaryStat-${stat.id}-note`}
            key={`secondaryStat-${stat.id}-note`}
            label={"note"}
            value={stat.note || ""}
            onBlur={(e) => {
              const value = e.currentTarget.value;
              setSecondaryStats((prev) => {
                const next = [...prev];
                next[index] = {
                  ...next[index],
                  note: value,
                };
                return next;
              });
            }}
            widthOverride="w-48"
          />
        </FlexRow>
      ))}
    </FlexCol>
  );
}

