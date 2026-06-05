import { Character } from "@shared/contracts";
import { useState } from "preact/hooks";
import { ButtonUnq, InputUnq, SelectUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import { nanoid } from "nanoid";

type TProps = {
  title: string;
  stats: Character.TSecondaryStat[];
  onChange: (next: Character.TSecondaryStat[]) => void;
  toInt: (value: string, fallback?: number) => number;
  idPrefix: string;
};

const EMPTY_SECONDARY_STAT: Character.TSecondaryStat = {
  id: "",
  name: Object.values(Character.SECONDARY_STATS)[0] as Character.SECONDARY_STATS,
  skillLevel: Character.SECONDARY_STAT_LEVEL.BASIC,
  skill: 0,
  lvlReq: 0,
  note: "",
};

export default function SecondaryStatListEditor({
  title,
  stats,
  onChange,
  toInt,
  idPrefix,
}: TProps) {
  const [selectedStat, setSelectedStat] =
    useState<Character.TSecondaryStat>(EMPTY_SECONDARY_STAT);

  const addStat = () => {
    const nextStat: Character.TSecondaryStat = {
      ...selectedStat,
      id: nanoid(),
    };
    onChange([...stats, nextStat]);
    setSelectedStat(EMPTY_SECONDARY_STAT);
  };

  const removeStat = (index: number) => {
    onChange(stats.filter((_, i) => i !== index));
  };

  const updateStat = (
    index: number,
    patch: Partial<Character.TSecondaryStat>
  ) => {
    const next = [...stats];
    next[index] = {
      ...next[index],
      ...patch,
    };
    onChange(next);
  };

  return (
    <FlexCol className="gap-1 shrink-0 !min-h-fit">
      <FlexRow className="flex-wrap gap-1 shrink-0 !min-h-fit">
        <label className="grow min-w-[120px] shrink-0">{title}</label>
        <SelectUnq
          id={`${idPrefix}-name`}
          label=""
          optionData={Object.values(Character.SECONDARY_STATS).map((value) => ({
            value,
            label: value,
          }))}
          onChange={(e) => {
            setSelectedStat((prev) => ({
              ...prev,
              name:
                (e?.value as Character.SECONDARY_STATS) ||
                (Object.values(Character.SECONDARY_STATS)[0] as Character.SECONDARY_STATS),
            }));
          }}
          value={{
            label: selectedStat.name,
            value: selectedStat.name,
          }}
          widthOverride="w-48 shrink-0"
        />
        <SelectUnq
          id={`${idPrefix}-level`}
          label="szint"
          optionData={Object.values(Character.SECONDARY_STAT_LEVEL).map((value) => ({
            value,
            label: value,
          }))}
          onChange={(e) => {
            setSelectedStat((prev) => ({
              ...prev,
              skillLevel:
                (e?.value as Character.SECONDARY_STAT_LEVEL) ||
                Character.SECONDARY_STAT_LEVEL.BASIC,
            }));
          }}
          value={{
            label: selectedStat.skillLevel,
            value: selectedStat.skillLevel,
          }}
          widthOverride="w-32 shrink-0"
        />
        <InputUnq
          id={`${idPrefix}-skill`}
          label="képzettség"
          value={selectedStat.skill}
          onBlur={(e) => {
            setSelectedStat((prev) => ({
              ...prev,
              skill: toInt(e.currentTarget.value, prev.skill),
            }));
          }}
          widthOverride="w-16 shrink-0"
        />
        <InputUnq
          id={`${idPrefix}-lvlReq`}
          label="szintkövetelmény"
          value={selectedStat.lvlReq}
          onBlur={(e) => {
            setSelectedStat((prev) => ({
              ...prev,
              lvlReq: toInt(e.currentTarget.value, prev.lvlReq),
            }));
          }}
          widthOverride="w-16 shrink-0"
        />
        <InputUnq
          id={`${idPrefix}-note`}
          label="jegyzet"
          value={selectedStat.note || ""}
          onBlur={(e) => {
            setSelectedStat((prev) => ({
              ...prev,
              note: e.currentTarget.value,
            }));
          }}
          widthOverride="w-48 shrink-0"
        />
        <ButtonUnq id={`${idPrefix}-add`} onClick={addStat} className="shrink-0">
          Add
        </ButtonUnq>
      </FlexRow>
      <FlexCol className="grow gap-1 shrink-0 !min-h-fit">
        {stats.map((stat, index) => (
          <FlexRow
            key={`${idPrefix}-${stat.id}-${index}`}
            className="flex-wrap gap-1 shrink-0 !min-h-fit"
          >
            <SelectUnq
              id={`${idPrefix}-item-name-${index}`}
              label=""
              optionData={Object.values(Character.SECONDARY_STATS).map((value) => ({
                value,
                label: value,
              }))}
              onChange={(e) =>
                updateStat(index, {
                  name:
                    (e?.value as Character.SECONDARY_STATS) ||
                    (Object.values(Character.SECONDARY_STATS)[0] as Character.SECONDARY_STATS),
                })
              }
              value={{
                label: stat.name,
                value: stat.name,
              }}
              widthOverride="w-48 shrink-0"
            />
            <SelectUnq
              id={`${idPrefix}-item-level-${index}`}
              label="szint"
              optionData={Object.values(Character.SECONDARY_STAT_LEVEL).map((value) => ({
                value,
                label: value,
              }))}
              onChange={(e) =>
                updateStat(index, {
                  skillLevel:
                    (e?.value as Character.SECONDARY_STAT_LEVEL) ||
                    Character.SECONDARY_STAT_LEVEL.BASIC,
                })
              }
              value={{
                label: stat.skillLevel,
                value: stat.skillLevel,
              }}
              widthOverride="w-32 shrink-0"
            />
            <InputUnq
              id={`${idPrefix}-item-lvlReq-${index}`}
              label="szintkövetelmény"
              value={stat.lvlReq}
              onBlur={(e) => {
                updateStat(index, {
                  lvlReq: toInt(e.currentTarget.value, stat.lvlReq),
                });
              }}
              widthOverride="w-16 shrink-0"
              className="shrink-0"
            />
            <InputUnq
              id={`${idPrefix}-item-skill-${index}`}
              label="képzettség"
              value={stat.skill}
              onBlur={(e) => {
                updateStat(index, {
                  skill: toInt(e.currentTarget.value, stat.skill),
                });
              }}
              widthOverride="w-16 shrink-0"
              className="shrink-0"
            />
            <InputUnq
              id={`${idPrefix}-item-note-${index}`}
              label="jegyzet"
              value={stat.note || ""}
              onBlur={(e) => {
                updateStat(index, {
                  note: e.currentTarget.value,
                });
              }}
              widthOverride="w-48 shrink-0"
              className="shrink-0"
            />
            <ButtonUnq
              id={`${idPrefix}-remove-${index}`}
              onClick={() => removeStat(index)}
              className="shrink-0"
            >
              X
            </ButtonUnq>
          </FlexRow>
        ))}
      </FlexCol>
    </FlexCol>
  );
}
