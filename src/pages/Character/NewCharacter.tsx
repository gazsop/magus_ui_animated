import { JSX } from "preact/jsx-runtime";
import { FlexCol, FlexRow } from "@components/Flex";
import CharBagIcon from "@components/icons/magus/CharBagIcon";
import ClassBardIcon from "@components/icons/magus/ClassBardIcon";
import ClassDruidIcon from "@components/icons/magus/ClassDruidIcon";
import ClassFireMageIcon from "@components/icons/magus/ClassFireMageIcon";
import ClassGladiatorIcon from "@components/icons/magus/ClassGladiatorIcon";
import ClassHunterIcon from "@components/icons/magus/ClassHunterIcon";
import ClassMageIcon from "@components/icons/magus/ClassMageIcon";
import ClassMartialArtistIcon from "@components/icons/magus/ClassMartialArtist";
import ClassPaladinIcon from "@components/icons/magus/ClassPaladinIcon";
import ClassPriestIcon from "@components/icons/magus/ClassPriestIcon";
import ClassRogueIcon from "@components/icons/magus/ClassRogueIcon";
import ClassShamanIcon from "@components/icons/magus/ClassShamanIcon";
import ClassWarlockIcon from "@components/icons/magus/ClassWarlockIcon";
import ClassWarriorIcon from "@components/icons/magus/ClassWarriorIcon";
import ClassWitchIcon from "@components/icons/magus/ClassWitchIcon";
import DescentDwarfIcon from "@components/icons/magus/DescentDwarfIcon";
import DescentElfIcon from "@components/icons/magus/DescentElfIcon";
import DescentHalfElfIcon from "@components/icons/magus/DescentHalfElfIcon";
import DescentHumanIcon from "@components/icons/magus/DescentHumanIcon";
import DescentOrcIcon from "@components/icons/magus/DescentOrcIcon";
import ClassKnightIcon from "@components/icons/magus/ClassKnight";
import { useDataContext } from "@contexts/dataContext";
import { useState } from "preact/hooks";
import { TSetState } from "@/utils/common";
import { Adventure, Character } from "@shared/contracts";
import {
  formatRoll as formatSharedRoll,
  formatSpellCost,
  getFirstAvailableSpellUpgrade,
} from "@shared/game";
import { ButtonUnq } from "@components/GeneralElements";
import ClassSwordMasterIcon from "@components/icons/magus/ClassSwordMasterIcon";
import useError from "@hooks/error";
import { HM_KEYS, HM_HU_LABELS } from "@/utils/hm";
import SecondaryStatsTable from "@components/SecondaryStatsTable";

function NewCharacter({
  selectedCharacter,
  setSelectedCharacter,
  onCharacterSaved,
}: {
  advId: string;
  selectedCharacter: Character.TCharacter;
  setSelectedCharacter: TSetState<Character.TCharacter>;
  onCharacterSaved: (nextCharacter: Character.TCharacter) => void;
}) {
  const { descents, classes } = useDataContext();
  const [selectedDescentIndex, setSelectedDescentIndex] = useState<number>(0);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(-1);
  const selectedClass = classes[selectedClassIndex];
  const selectedDescent = descents[selectedDescentIndex];

  const { setError } = useError();

  const setSelectedDescent = (descentId: string) => {
    if (selectedDescent?.id === descentId) return;
    const descent = descents.find((d) => d.id === descentId);
    if (!descent) return;
    setSelectedDescentIndex(descents.indexOf(descent));
    if (
      selectedClass?.id &&
      !descent.allowedClasses?.find((c) => c.id === selectedClass.id)
    ) {
      setSelectedClassIndex(-1);
    }
  };

  const toNumberOrZero = (value: unknown): number => {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  };

  const buildInitialHm = (
    descent?: Character.TDescent,
    classEntry?: Character.TClass
  ): Character.THm => ({
    ATK:
      toNumberOrZero(descent?.modifiers.hm.ATK) +
      toNumberOrZero(classEntry?.modifiers.hm.ATK),
    DEF:
      toNumberOrZero(descent?.modifiers.hm.DEF) +
      toNumberOrZero(classEntry?.modifiers.hm.DEF),
    INI:
      toNumberOrZero(descent?.modifiers.hm.INI) +
      toNumberOrZero(classEntry?.modifiers.hm.INI),
    AIM:
      toNumberOrZero(descent?.modifiers.hm.AIM) +
      toNumberOrZero(classEntry?.modifiers.hm.AIM),
  });

  const buildInitialPrimaryStats = (
    descent?: Character.TDescent,
    classEntry?: Character.TClass
  ): Character.TPrimaryStat[] => {
    const descentByName = new Map(
      (descent?.modifiers.primaryStats || []).map((stat) => [stat.name, stat])
    );
    const classByName = new Map(
      (classEntry?.modifiers.primaryStats || []).map((stat) => [stat.name, stat])
    );
    const names = new Set<Character.PRIMARY_STATS>([
      ...descentByName.keys(),
      ...classByName.keys(),
    ]);
    return Array.from(names).map((name) => {
      const descentStat = descentByName.get(name);
      const classStat = classByName.get(name);
      return {
        ...descentStat,
        ...classStat,
        name,
        val: classStat?.roll
          ? 0
          : toNumberOrZero(descentStat?.val ?? classStat?.val ?? 0),
      };
    });
  };

  const FancyRow = ({
    icon,
    text,
    label,
    selected,
    setSelectedRow,
    disabled,
  }: {
    icon: JSX.Element;
    text: string;
    label?: string;
    selected?: boolean;
    setSelectedRow?: TSetState<string>;
    disabled?: boolean;
  }) => {
    const rowClass = [
      "min-h-[57px] w-full fancy-container shrink-0 p-1 items-center justify-center select-none",
      disabled ? "disabled cursor-not-allowed opacity-60" : "cursor-pointer",
      selected ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <FlexRow
        className={rowClass}
        onClick={() => {
          if (disabled) return;
          setSelectedRow && setSelectedRow(text);
        }}
      >
        {icon}
        <p className={`pl-5 w-[130px] max-w-[calc(100%-50px)] break-words`}>
          {label || text}
        </p>
      </FlexRow>
    );
  };

  const isAllowedClass: (id: string) => boolean = (id) => {
    if (!selectedDescent || !selectedDescent.allowedClasses) return false;
    return selectedDescent.allowedClasses.find((c) => c.id === id)
      ? true
      : false;
  };

  const DescriptionCol = ({
    title,
    children,
  }: {
    title: string;
    children: JSX.Element | JSX.Element[];
  }) => {
    return (
      <FlexCol
        className={`p-1 basis-full sm:basis-[calc(50%-0.125rem)] lg:basis-[calc(25%-0.375rem)] grow relative nowrap overflow-x-hidden overflow-y-auto fancy-container h-full`}
      >
        <h3 className={`text-center text-l`}>{title}</h3>
        <hr className={`fancy`} />
        {children}
      </FlexCol>
    );
  };

  const ClassRow = ({
    text,
    icon,
    id,
  }: {
    text: string;
    icon: JSX.Element;
    id: string;
  }) => {
    return (
      <FancyRow
        icon={icon}
        text={id}
        label={`${text}${
          selectedDescent?.allowedClasses
            ? selectedDescent.allowedClasses.find((c) => c.id === id)
                ?.permission
              ? " - KM Engedély"
              : ""
            : ""
        }`}
        selected={selectedClassIndex > -1 ? selectedClass?.id === id : false}
        setSelectedRow={() => selectClassIndex(id)}
        disabled={!isAllowedClass(id)}
      />
    );
  };

  const selectClassIndex = (id: string) => {
    const index = classes.findIndex((cl) => cl.id === id);
    if (index === -1) return;
    if (!isAllowedClass(id)) return;
    setSelectedClassIndex(index);
  };

  const descentIconByName: Partial<Record<Character.DESCENTS, JSX.Element>> = {
    [Character.DESCENTS.DWARF]: <DescentDwarfIcon className="w-[45px]" />,
    [Character.DESCENTS.ELF]: <DescentElfIcon className="w-[45px]" />,
    [Character.DESCENTS.HALF_ELF]: <DescentHalfElfIcon className="w-[45px]" />,
    [Character.DESCENTS.HUMAN]: <DescentHumanIcon className="w-[45px]" />,
    [Character.DESCENTS.ORC]: <DescentOrcIcon className="w-[45px]" />,
  };

  const classIconByName: Partial<Record<Character.CLASSES, JSX.Element>> = {
    [Character.CLASSES.BARD]: <ClassBardIcon className="w-[45px]" />,
    [Character.CLASSES.GLADIATOR]: <ClassGladiatorIcon className="w-[45px]" />,
    [Character.CLASSES.KNIGHT]: <ClassKnightIcon className="w-[45px]" />,
    [Character.CLASSES.MARTIAL_ARTIST]: <ClassMartialArtistIcon className="w-[45px]" />,
    [Character.CLASSES.PALADIN]: <ClassPaladinIcon className="w-[45px]" />,
    [Character.CLASSES.PRIEST]: <ClassPriestIcon className="w-[45px]" />,
    [Character.CLASSES.SWORDSMAN]: <ClassSwordMasterIcon className="w-[45px]" />,
    [Character.CLASSES.THIEF]: <ClassRogueIcon className="w-[45px]" />,
    [Character.CLASSES.WARLOCK]: <ClassWarlockIcon className="w-[45px]" />,
    [Character.CLASSES.WARRIOR]: <ClassWarriorIcon className="w-[45px]" />,
    [Character.CLASSES.WITCH]: <ClassWitchIcon className="w-[45px]" />,
    [Character.CLASSES.FIRE_MAGE]: <ClassFireMageIcon className="w-[45px]" />,
    [Character.CLASSES.DRUID]: <ClassDruidIcon className="w-[45px]" />,
    [Character.CLASSES.SHAMAN]: <ClassShamanIcon className="w-[45px]" />,
    [Character.CLASSES.MAGE]: <ClassMageIcon className="w-[45px]" />,
    [Character.CLASSES.BOUNTY_HUNTER]: <ClassHunterIcon className="w-[45px]" />,
  };

  const fallbackRowIcon = <CharBagIcon className="w-[45px]" />;
  const liveDescentRows: Array<{ id: string; text: string; icon: JSX.Element }> =
    descents.map((descent) => ({
      id: descent.id,
      text: descent.name,
      icon: descentIconByName[descent.name] || fallbackRowIcon,
    }));
  const liveClassRows: Array<{ id: string; text: string; icon: JSX.Element }> =
    classes.map((classEntry) => ({
      id: classEntry.id,
      text: classEntry.name,
      icon: classIconByName[classEntry.name] || fallbackRowIcon,
    }));

  const renderSecondarySkillProgressions = (skills: Character.TSecondaryStat[]) => (
    <SecondaryStatsTable stats={skills} currentLevel={1} />
  );

  const renderHmPreview = (hm: Character.THm) =>
    HM_KEYS.map((key) => (
      <p key={`hm-preview-${key}`}>
        {HM_HU_LABELS[key]}: {hm[key]}
      </p>
    ));

  const formatRoll = (roll?: Adventure.TRollElements | null) =>
    formatSharedRoll(roll, { validateFiniteDice: true });
  return (
    <FlexCol
      className={`grow h-full min-h-0 relative nowrap overflow-y-auto overflow-x-hidden w-full gap-1`}
    >
      <FlexRow
        className={`relative overflow-visible w-full gap-1 shrink-0 flex-col sm:flex-row`}
      >
        <FlexCol
          className={`grow sm:basis-1/2 justify-start fancy-container items-stretch overflow-x-hidden overflow-y-auto max-h-[min(305px,45vh)] p-1 gap-0.5 shrink-0`}
        >
          {liveDescentRows.map((row) => (
            <FancyRow
              key={row.id}
              icon={row.icon}
              text={row.text}
              selected={selectedDescent?.id === row.id}
              setSelectedRow={() => setSelectedDescent(row.id)}
            />
          ))}
        </FlexCol>
        <FlexCol
          className={`grow sm:basis-1/2 justify-stretch fancy-container items-stretch overflow-x-hidden overflow-y-auto max-h-[min(305px,45vh)] p-1 gap-0.5`}
        >
          {liveClassRows.map((row) => (
            <ClassRow key={row.id} text={row.text} icon={row.icon} id={row.id} />
          ))}
        </FlexCol>
      </FlexRow>

      <FlexRow
        className={`relative flex-wrap w-full grow min-h-0 gap-0.5 overflow-visible sm:overflow-hidden`}
      >
        <DescriptionCol title="Faj leírás">
          {selectedDescent ? (
            <div className="w-full overflow-y-auto h-full">
              {selectedDescent.description
                .replaceAll("\\-", "")
                .split("\n")
                .map((line) => {
                  if (line === "") return <></>;
                  return <p>{line}</p>;
                })}
              <h3 className={`text-center text-l mt-1`}>Játszható kasztok</h3>
              <hr className={`fancy`} />
              {selectedDescent.allowedClasses &&
                selectedDescent.allowedClasses.map((c) => (
                  <p>
                    {
                      classes.find((cl) => {
                        return cl.id === c.id;
                      })?.name
                    }
                    {c.permission ? ` - KM Engedély` : ""}
                  </p>
                ))}
              <h3 className={`text-center text-l mt-1`}>HM</h3>
              <hr className={`fancy`} />
              {renderHmPreview(selectedDescent.modifiers.hm)}
            </div>
          ) : (
            <></>
          )}
        </DescriptionCol>
        <DescriptionCol title="Kaszt leírás">
          {selectedClassIndex !== -1 ? (
            <div className="w-full">
              {selectedClass &&
                selectedClass.description &&
                selectedClass.description
                  .replaceAll("\\-", "")
                  .split("\n")
                  .map((line) => {
                    if (line === "") return <></>;
                    return <p>{line}</p>;
                  })}
              <h3 className={`text-center text-l mt-1`}>Főkaszt</h3>
              <hr className={`fancy`} />
              <p>{selectedClass.mainClass}</p>
              <p>Fegyverek száma: {Number(selectedClass.maxCarriedWeapons || 0)}</p>
              <h3 className={`text-center text-l mt-1`}>Alap statok</h3>
              <hr className={`fancy`} />
              <p>ÉP alap: {selectedClass.modifiers.ep}</p>
              <p>FP alap: {selectedClass.modifiers.hp}</p>
              <p>FP/szint: {formatRoll(selectedClass.modifiers.hpLvlScaling)}</p>
              <p>EFP: {selectedClass.modifiers.resource.name}</p>
              <p>Max EFP: {selectedClass.modifiers.resource.max}</p>
              <p>
                EFP/kör:{" "}
                {formatRoll(selectedClass.modifiers.resource.regenPerRound)}
              </p>
              {selectedClass.modifiers.resource.lvlUp && (
                <p>
                  EFP/szint: {formatRoll(selectedClass.modifiers.resource.lvlUp)}
                </p>
              )}
              <hr className={`fancy`} />
              {selectedClass.modifiers.primaryStats.map((stat) => (
                <p>
                  {stat.name}: {stat.roll ? formatRoll(stat.roll) : Number(stat.val || 0)}
                </p>
              ))}
              <h3 className={`text-center text-l mt-1`}>HM</h3>
              <hr className={`fancy`} />
              {renderHmPreview(selectedClass.modifiers.hm)}
              <p>HM alap: {selectedClass.modifiers.hmPlus.initial}</p>
              <p>HM/szint: {selectedClass.modifiers.hmPlus.perLvl}</p>
              <h3 className={`text-center text-l mt-1`}>Képzettségek</h3>
              <hr className={`fancy`} />
              {renderSecondarySkillProgressions([
                ...(selectedClass.modifiers.secondaryStats || []),
                ...(selectedClass.modifiers.secondaryStatScalings || []),
              ])}
            </div>
          ) : (
            <p>Válassz kasztot</p>
          )}
        </DescriptionCol>
        <DescriptionCol title="Képzettségek">
          <div className="w-full overflow-y-auto h-full">
            {selectedClassIndex !== -1 ? (
              <>
                {renderSecondarySkillProgressions([
                  ...(selectedClass.modifiers.secondaryStats || []),
                  ...(selectedClass.modifiers.secondaryStatScalings || []),
                ])}
              </>
            ) : (
              <p>Válassz kasztot</p>
            )}
          </div>
        </DescriptionCol>
        <DescriptionCol title="Varázslatok">
          <div className="w-full">
            {selectedClassIndex !== -1 ? (
              <>
                <h3 className={`text-center text-l mt-1`}>Specializációk</h3>
                {selectedClass.specs.map((spec) => (
                  <p>{spec.name}</p>
                ))}
                <hr className={`fancy`} />
                {selectedClass.spells.map((spell) => (
                  <div className={`p-1`}>
                    <p>
                      {spell.name}, lvl: {spell.lvlReq}, ktg.:{" "}
                      {formatSpellCost(getFirstAvailableSpellUpgrade(spell)?.cost)}
                    </p>
                    <p>{spell.description}</p>
                  </div>
                ))}
              </>
            ) : (
              <p>Válassz kasztot</p>
            )}
          </div>
        </DescriptionCol>
      </FlexRow>
      <ButtonUnq
        id={"charSelect-add"}
        onClick={async () => {
          if (selectedClassIndex === -1 && selectedDescentIndex === -1)
            return setError("Válassz kasztot és fajt!");
          else if (selectedClassIndex === -1) return setError("Válassz kasztot!");
          else if (selectedDescentIndex === -1) return setError("Válassz fajt!");
          const nextCharacter: Character.TCharacter = {
            ...selectedCharacter,
            initialized: false,
            descent: selectedDescent.name,
            class: selectedClass.name,
            hm: buildInitialHm(selectedDescent, selectedClass),
            primaryStats: buildInitialPrimaryStats(selectedDescent, selectedClass),
          };
          setSelectedCharacter(nextCharacter);
          onCharacterSaved(nextCharacter);
        }}
        className="m-0 h-[30px]"
      >
        Mentés
      </ButtonUnq>
    </FlexCol>
  );
}

export default NewCharacter;









