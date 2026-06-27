import { Character } from "@shared/contracts";
import { ensurePrimaryStats, formatStringList } from "@/utils/stats";
import { useEffect, useRef, useState } from "preact/hooks";
import { FlexCol } from "@components/Flex";
import {
  TextAreaUnq,
} from "@components/GeneralElements";
import usePopup from "@hooks/popup";
import { HM_HU_LABELS, HM_KEYS } from "@/utils/hm";
import {
  RP_WIZARD_FIELDS,
  validateRpFieldValue,
} from "@pages/Character/utils/rpWizard";
import {
  buildRuntimeSelectOptions,
  buildWizardSteps,
  getAllocatedHmPoints,
  getWizardStartIndex,
  isWizardFinalizeInvalid,
  validatePrimaryStatFinalValue,
  validateWizardName,
  TRpWizardStep,
} from "@pages/Character/utils/rpWizardFlow";

export type TRPElementProps = {
  rpData: Character.TRpElements;
  primaryStats: Character.TPrimaryStat[];
  primaryStatRolls?: Character.TPrimaryStat[];
  hm: Character.THm;
  religions: Array<{ name: string; value: string }>;
  personalities: Array<{ name: string; value: string }>;
  languageOptions: string[];
  hmBase?: Character.THm;
  hmInitialPoints?: number;
  disabled: boolean;
  autoStartWizard?: boolean;
  onSave: (
    rp: Character.TRpElements,
    primaryStats: Character.TPrimaryStat[],
    hm: Character.THm,
    options?: { updatePageState?: boolean }
  ) => Promise<void>;
};
export default function RPElement({
  rpData,
  primaryStats,
  primaryStatRolls = [],
  hm,
  religions,
  personalities,
  languageOptions,
  hmBase,
  hmInitialPoints = 0,
  disabled,
  autoStartWizard = false,
  onSave,
}: TRPElementProps) {
  const safeRpData: Character.TRpElements = {
    name: rpData?.name ?? "",
    age: rpData?.age ?? 0,
    skinColor: rpData?.skinColor ?? "",
    hair: rpData?.hair ?? "",
    eyes: rpData?.eyes ?? "",
    bioType: rpData?.bioType ?? Character.BTYPE.MALE,
    height: rpData?.height ?? 0,
    weight: rpData?.weight ?? 0,
    description: rpData?.description ?? "",
    religion: rpData?.religion ?? "",
    bornPlace: rpData?.bornPlace ?? "",
    schools: rpData?.schools ?? "",
    personality: rpData?.personality ?? "",
    knownLanguages: rpData?.knownLanguages ?? [],
    professions: rpData?.professions ?? [],
    avatar: rpData?.avatar ?? null,
  };
  const primaryRollsByName = new Map(
    ensurePrimaryStats(primaryStatRolls).map((stat) => [stat.name, stat])
  );
  const safePrimaryStats: Character.TPrimaryStat[] = ensurePrimaryStats(primaryStats).map(
    (stat) => ({
      ...primaryRollsByName.get(stat.name),
      ...stat,
      roll: primaryRollsByName.get(stat.name)?.roll ?? stat.roll,
    })
  );
  const safeHm: Character.THm = {
    ATK: hm?.ATK ?? 0,
    DEF: hm?.DEF ?? 0,
    INI: hm?.INI ?? 0,
    AIM: hm?.AIM ?? 0,
  };
  const safeHmBase: Character.THm = {
    ATK: hmBase?.ATK ?? safeHm.ATK,
    DEF: hmBase?.DEF ?? safeHm.DEF,
    INI: hmBase?.INI ?? safeHm.INI,
    AIM: hmBase?.AIM ?? safeHm.AIM,
  };
  const { setPopup } = usePopup();
  const [rpDraft, setRpDraft] = useState<Character.TRpElements>(safeRpData);
  const [primaryStatsDraft, setPrimaryStatsDraft] =
    useState<Character.TPrimaryStat[]>(safePrimaryStats);
  const [hmDraft, setHmDraft] = useState<Character.THm>(safeHm);
  const flowStartedRef = useRef(false);
  const religionsRef = useRef(religions);
  const personalitiesRef = useRef(personalities);
  const rpDraftRef = useRef(rpDraft);
  const primaryStatsDraftRef = useRef(primaryStatsDraft);
  const hmDraftRef = useRef(hmDraft);
  useEffect(() => {
    setRpDraft(safeRpData);
    setPrimaryStatsDraft(safePrimaryStats);
    setHmDraft(safeHm);
  }, [
    rpData?.name,
    rpData?.age,
    rpData?.skinColor,
    rpData?.hair,
    rpData?.eyes,
    rpData?.bioType,
    rpData?.height,
    rpData?.weight,
    rpData?.description,
    rpData?.religion,
    rpData?.bornPlace,
    rpData?.schools,
    rpData?.personality,
    rpData?.knownLanguages,
    rpData?.professions,
    rpData?.avatar,
    primaryStats,
    primaryStatRolls,
    hm?.ATK,
    hm?.DEF,
    hm?.INI,
    hm?.AIM,
    hmBase?.ATK,
    hmBase?.DEF,
    hmBase?.INI,
    hmBase?.AIM,
  ]);
  useEffect(() => {
    rpDraftRef.current = rpDraft;
    primaryStatsDraftRef.current = primaryStatsDraft;
    hmDraftRef.current = hmDraft;
    religionsRef.current = religions;
    personalitiesRef.current = personalities;
  }, [rpDraft, primaryStatsDraft, hmDraft, religions, personalities]);
  const persist = async (
    nextRp: Character.TRpElements,
    nextPrimaryStats: Character.TPrimaryStat[],
    nextHm: Character.THm
  ) => {
    rpDraftRef.current = nextRp;
    primaryStatsDraftRef.current = nextPrimaryStats;
    hmDraftRef.current = nextHm;
    setRpDraft(nextRp);
    setPrimaryStatsDraft(nextPrimaryStats);
    setHmDraft(nextHm);
  };
  const knownLanguages = formatStringList(rpDraft.knownLanguages);
  const professions = formatStringList(rpDraft.professions);
  const orderedRollStats = primaryStatsDraft
    .filter((stat) => !!stat.roll)
    .sort((a, b) => {
      if (a.name === Character.PRIMARY_STATS.STR) return -1;
      if (b.name === Character.PRIMARY_STATS.STR) return 1;
      return 0;
    });
  const hasPendingPrimaryRollStats = safePrimaryStats.some(
    (stat) => Number(stat.val ?? 0) <= 0
  );
  const hasPrimaryRollDefinitions = safePrimaryStats.some((stat) => !!stat.roll);
  const selectedBodyType = rpDraft.bioType || Character.BTYPE.MALE;
  useEffect(() => {
    if (!autoStartWizard || disabled || flowStartedRef.current) return;
    if (hasPendingPrimaryRollStats && !hasPrimaryRollDefinitions) return;
    flowStartedRef.current = true;

    const rpFields = RP_WIZARD_FIELDS;

    const hmSteps =
      hmInitialPoints > 0
        ? HM_KEYS.map((key) => ({ key, label: HM_HU_LABELS[key] || key }))
        : [];
    const steps: TRpWizardStep[] = buildWizardSteps(orderedRollStats, rpFields, hmSteps);

    const openStep = (index: number) => {
      if (index >= steps.length) {
        setPopup({ label: "Kész", text: "Karakter adatfeltöltés kész." });
        return;
      }
      const step = steps[index];
      const hasPrev = index > 0;
      const common = {
        prev: hasPrev ? "Previous" : undefined,
        prevCallback: hasPrev ? () => openStep(index - 1) : undefined,
        showClose: false,
        save: "Next",
      };

      if (step.kind === "name") {
        setPopup({
          ...common,
          label: "Karakter létrehozás",
          text: "Add meg a karakter nevét.",
          input: rpDraftRef.current.name || "",
          saveCallback: async (inputValue) => {
            const nameValue = (inputValue || "").trim();
            const nameError = validateWizardName(nameValue);
            if (nameError) {
              openStep(index);
              setPopup((prev) =>
                prev
                  ? {
                      ...prev,
                      error: nameError,
                    }
                  : prev
              );
              return;
            }
            const nextRp = { ...rpDraftRef.current, name: nameValue };
            await persist(nextRp, primaryStatsDraftRef.current, hmDraftRef.current);
            openStep(index + 1);
          },
        });
        return;
      }

      if (step.kind === "primary") {
        setPopup({
          ...common,
          label: "Primer stat dobás",
          text: `${step.label}: ${step.rollText}. Add meg a végső értéket.`,
          input: "",
          saveCallback: async (inputValue) => {
            const entered = Number(inputValue || "");
            const statError = validatePrimaryStatFinalValue(entered, step.roll);
            if (statError) {
              openStep(index);
              setPopup((prev) =>
                prev
                  ? {
                      ...prev,
                      error: statError,
                    }
                  : prev
              );
              return;
            }
            const nextPrimary = primaryStatsDraftRef.current.map((stat) => {
              if (stat.name !== step.statName) return stat;
              return { ...stat, roll: step.roll, val: entered };
            });
            await persist(rpDraftRef.current, nextPrimary, hmDraftRef.current);
            openStep(index + 1);
          },
        });
        return;
      }

      if (step.kind === "hm") {
        const currentAllocation = Math.max(
          0,
          Number(hmDraftRef.current[step.key] || 0) - Number(safeHmBase[step.key] || 0)
        );
        const allocatedWithoutCurrent =
          getAllocatedHmPoints(hmDraftRef.current, safeHmBase) - currentAllocation;
        const remaining = Math.max(0, hmInitialPoints - allocatedWithoutCurrent);
        setPopup({
          ...common,
          label: "HM elosztás",
          text: `${step.label}: alap ${safeHmBase[step.key]}, kiosztható maradék ${remaining}. Add meg az erre költött HM-et.`,
          input: String(currentAllocation),
          saveCallback: async (inputValue) => {
            const allocation = Number(inputValue || 0);
            if (!Number.isFinite(allocation) || allocation < 0 || allocation > remaining) {
              openStep(index);
              setPopup((prev) =>
                prev
                  ? {
                      ...prev,
                      error: `A HM érték 0 és ${remaining} között legyen.`,
                    }
                  : prev
              );
              return;
            }
            const nextHm = {
              ...hmDraftRef.current,
              [step.key]: Number(safeHmBase[step.key] || 0) + allocation,
            };
            await persist(rpDraftRef.current, primaryStatsDraftRef.current, nextHm);
            openStep(index + 1);
          },
        });
        return;
      }

      if (step.kind === "rp") {
        const currentValue = rpDraftRef.current[step.field.key];
        const runtimeSelectOptions = buildRuntimeSelectOptions(
          step.field.key,
          rpDraftRef.current,
          religionsRef.current,
          personalitiesRef.current,
          step.field.selectOptions
        );
        setPopup({
          ...common,
          label: "RP adat",
          text: step.field.label,
          input: step.field.formatter
            ? step.field.formatter(
                currentValue as string | number | null | undefined
              )
            : String(currentValue ?? ""),
          selectOptions: runtimeSelectOptions,
          saveCallback: async (inputValue) => {
            const parsedValue = step.field.parser
              ? step.field.parser(inputValue || "")
              : inputValue || "";
            const errorMsg = validateRpFieldValue(step.field, parsedValue);
            const isInvalid = !!errorMsg;
            if (isInvalid) {
              setPopup({
                ...common,
                label: "Hiányzó adat",
                text: step.field.label,
                error: errorMsg,
                input: step.field.formatter
                  ? step.field.formatter(parsedValue)
                  : String(parsedValue ?? ""),
                selectOptions: runtimeSelectOptions,
                saveCallback: async (retryValue) => {
                  const retryParsed = step.field.parser
                    ? step.field.parser(retryValue || "")
                    : retryValue || "";
                  const retryError = validateRpFieldValue(step.field, retryParsed);
                  if (retryError) {
                    setPopup((prev) =>
                      prev
                        ? {
                            ...prev,
                            error: retryError,
                            input: step.field.formatter
                              ? step.field.formatter(retryParsed)
                              : String(retryParsed ?? ""),
                          }
                        : prev
                    );
                    return;
                  }
                  const nextRpRetry = {
                    ...rpDraftRef.current,
                    [step.field.key]: retryParsed,
                  };
                  await persist(
                    nextRpRetry,
                    primaryStatsDraftRef.current,
                    hmDraftRef.current
                  );
                  openStep(index + 1);
                },
              });
              return;
            }
            const nextRp = { ...rpDraftRef.current, [step.field.key]: parsedValue };
            await persist(nextRp, primaryStatsDraftRef.current, hmDraftRef.current);
            openStep(index + 1);
          },
        });
        return;
      }
      if (step.kind === "languages") {
        const openAction = () => {
          const buildLanguageManager = () => ({
            options: languageOptions,
            selected: languageOptions[0] || "",
            items: rpDraftRef.current.knownLanguages,
            onAdd: async (value: string) => {
              const nextValue = (value || "").trim();
              if (!nextValue) return;
              if (rpDraftRef.current.knownLanguages.includes(nextValue)) return;
              const nextRp = {
                ...rpDraftRef.current,
                knownLanguages: [...rpDraftRef.current.knownLanguages, nextValue],
              };
              await persist(nextRp, primaryStatsDraftRef.current, hmDraftRef.current);
              openAction();
            },
            onRemove: async (value: string) => {
              const nextRp = {
                ...rpDraftRef.current,
                knownLanguages: rpDraftRef.current.knownLanguages.filter(
                  (item) => item !== value
                ),
              };
              await persist(nextRp, primaryStatsDraftRef.current, hmDraftRef.current);
              openAction();
            },
          });

          const reopenLanguageStep = () => {
            openAction();
          };

          const showLanguageError = (label: string, text: string, error: string) => {
            setPopup({
              ...common,
              label,
              text,
              error,
              languageManager: buildLanguageManager(),
              save: "Next",
              saveCallback: async () => {
                reopenLanguageStep();
              },
            });
          };

          setPopup({
            ...common,
            label: "Ismert nyelvek",
            text: `Jelenlegi: ${
              rpDraftRef.current.knownLanguages.length > 0
                ? rpDraftRef.current.knownLanguages.join(", ")
                : "-"
            }`,
            languageManager: buildLanguageManager(),
            save: "Next",
            saveCallback: async () => {
              const isInvalid = isWizardFinalizeInvalid(
                rpDraftRef.current,
                primaryStatsDraftRef.current,
                hmDraftRef.current,
                safeHmBase,
                hmInitialPoints
              );

              if (isInvalid) {
                showLanguageError(
                  "Hiányos vagy hibás adatok",
                  "Javítsd a kötelező mezőket, mielőtt továbblépsz.",
                  "A mentés letiltva. Van hiányzó mező, érvénytelen primer stat érték vagy hibás HM elosztás."
                );
                return;
              }
              try {
                await onSave(
                  rpDraftRef.current,
                  primaryStatsDraftRef.current,
                  hmDraftRef.current,
                  { updatePageState: true }
                );
                openStep(index + 1);
              } catch (error) {
                showLanguageError(
                  "Mentés sikertelen",
                  "A karakter nem menthető, amíg nem felel meg az inicializációs feltételeknek.",
                  error instanceof Error ? error.message : String(error)
                );
              }
            },
          });
        };
        openAction();
        return;
      }
    };

    const startIndex = getWizardStartIndex(
      steps,
      rpDraftRef.current,
      primaryStatsDraftRef.current,
      hmDraftRef.current,
      safeHmBase,
      hmInitialPoints
    );
    if (startIndex < steps.length) {
      openStep(startIndex);
    }
  }, [
    disabled,
    hasPendingPrimaryRollStats,
    hasPrimaryRollDefinitions,
    orderedRollStats,
    hmInitialPoints,
    religions,
    personalities,
    languageOptions,
    autoStartWizard,
  ]);

  const rpInputClass = "w-full px-1";
  const rpLabelClass = "w-[42%] pr-1 whitespace-nowrap align-middle";
  const rpValueClass = "w-[58%] align-middle";

  return (
    <FlexCol className="w-full h-full min-w-0 min-h-0 overflow-auto fancy-container shrink-0 p-0.5 gap-0.5">
      <table className="w-full table-fixed border-separate border-spacing-y-0.5">
        <tbody>
          <tr>
            <td className={rpLabelClass}><label htmlFor="character-name">Név</label></td>
            <td className={rpValueClass}><input id="character-name" className={rpInputClass} value={rpDraft.name || ""} disabled readOnly /></td>
          </tr>
          <tr>
            <td className={rpLabelClass}><label htmlFor="character-religion">Vallás</label></td>
            <td className={rpValueClass}><input id="character-religion" className={rpInputClass} value={rpDraft.religion || ""} disabled readOnly /></td>
          </tr>
          <tr>
            <td className={rpLabelClass}><label htmlFor="character-personality">Jellem</label></td>
            <td className={rpValueClass}><input id="character-personality" className={rpInputClass} value={rpDraft.personality || ""} disabled readOnly /></td>
          </tr>
          <tr>
            <td className={rpLabelClass}><label htmlFor="character-known-languages">Ismert nyelvek</label></td>
            <td className={rpValueClass}><input id="character-known-languages" className={rpInputClass} value={knownLanguages} disabled readOnly /></td>
          </tr>
        </tbody>
      </table>
      <details className="fancy-container p-1">
        <summary className="cursor-pointer select-none font-semibold px-1">
          További RP adatok
        </summary>
        <FlexCol className="mt-1 gap-0.5">
          <table className="w-full table-fixed border-separate border-spacing-y-0.5">
            <tbody>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-body-type">Nem</label></td>
                <td className={rpValueClass}><input id="character-body-type" className={rpInputClass} value={selectedBodyType} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-born-place">Születési hely</label></td>
                <td className={rpValueClass}><input id="character-born-place" className={rpInputClass} value={rpDraft.bornPlace || ""} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-age">Kor</label></td>
                <td className={rpValueClass}><input id="character-age" className={rpInputClass} value={rpDraft.age ?? 0} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-skin-color">Bőrszín</label></td>
                <td className={rpValueClass}><input id="character-skin-color" className={rpInputClass} value={rpDraft.skinColor || ""} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-hair">Haj</label></td>
                <td className={rpValueClass}><input id="character-hair" className={rpInputClass} value={rpDraft.hair || ""} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-eye">Szem</label></td>
                <td className={rpValueClass}><input id="character-eye" className={rpInputClass} value={rpDraft.eyes || ""} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-height">Magasság</label></td>
                <td className={rpValueClass}><input id="character-height" className={rpInputClass} value={rpDraft.height ?? 0} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-weight">Súly</label></td>
                <td className={rpValueClass}><input id="character-weight" className={rpInputClass} value={rpDraft.weight ?? 0} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-schools">Iskolák</label></td>
                <td className={rpValueClass}><input id="character-schools" className={rpInputClass} value={rpDraft.schools || ""} disabled readOnly /></td>
              </tr>
              <tr>
                <td className={rpLabelClass}><label htmlFor="character-professions">Szakmák</label></td>
                <td className={rpValueClass}><input id="character-professions" className={rpInputClass} value={professions} disabled readOnly /></td>
              </tr>
            </tbody>
          </table>
          <TextAreaUnq
            id="character-description"
            label="Leírás"
            value={rpDraft.description || ""}
            onChange={() => {}}
            element="editor"
            className="h-[200px] overflow-auto"
            disabled
          />
        </FlexCol>
      </details>
    </FlexCol>
  );
}




