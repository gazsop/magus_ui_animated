import { Adventure, Character } from "@shared/contracts";
import { formatRoll as formatSharedRoll, getRollRange } from "@shared/game";
import { TRpFieldDescriptor, isRpFieldFilled } from "@pages/Character/utils/rpWizard";

export type TRpWizardStep =
  | { kind: "name" }
  | {
      kind: "primary";
      statName: Character.PRIMARY_STATS;
      label: string;
      roll: Adventure.TRollElements;
      rollText: string;
    }
  | { kind: "hm"; key: keyof Character.THm; label: string }
  | { kind: "rp"; field: TRpFieldDescriptor }
  | { kind: "languages" };

export const formatRoll = (roll?: Adventure.TRollElements) => {
  return formatSharedRoll(roll, {
    includeRollAttempts: true,
    rollAttemptSuffix: ", jobbik",
    constantMode: "raw-positive-prefix",
  });
};

export const buildWizardSteps = (
  orderedRollStats: Character.TPrimaryStat[],
  rpFields: TRpFieldDescriptor[],
  hmKeys: Array<{ key: keyof Character.THm; label: string }> = []
): TRpWizardStep[] => [
  { kind: "name" },
  ...orderedRollStats.map((s) => ({
    kind: "primary" as const,
    statName: s.name,
    label: s.name,
    roll: s.roll!,
    rollText: formatRoll(s.roll),
  })),
  ...hmKeys.map((hm) => ({ kind: "hm" as const, key: hm.key, label: hm.label })),
  ...rpFields.map((field) => ({ kind: "rp" as const, field })),
  { kind: "languages" },
];

export const getAllocatedHmPoints = (
  hm: Character.THm,
  hmBase: Character.THm
): number =>
  (Object.keys(hmBase) as Array<keyof Character.THm>).reduce(
    (sum, key) => sum + Math.max(0, Number(hm[key] || 0) - Number(hmBase[key] || 0)),
    0
  );

export const getWizardStartIndex = (
  steps: TRpWizardStep[],
  rp: Character.TRpElements,
  primaryStats: Character.TPrimaryStat[],
  hm?: Character.THm,
  hmBase?: Character.THm,
  hmInitialPoints = 0
) => {
  if (!rp.name?.trim()) return 0;
  const firstRollIndex = steps.findIndex(
    (step) =>
      step.kind === "primary" &&
      ((primaryStats.find((stat) => stat.name === step.statName)?.val ?? 0) <= 0)
  );
  if (firstRollIndex > -1) return firstRollIndex;
  if (
    hm &&
    hmBase &&
    hmInitialPoints > 0 &&
    getAllocatedHmPoints(hm, hmBase) !== hmInitialPoints
  ) {
    const firstHmIndex = steps.findIndex((step) => step.kind === "hm");
    if (firstHmIndex > -1) return firstHmIndex;
  }

  const firstRpIndex = steps.findIndex(
    (step) => step.kind === "rp" && !isRpFieldFilled(rp, step.field)
  );
  if (firstRpIndex > -1) return firstRpIndex;
  if (rp.knownLanguages.length < 1) {
    const languageIndex = steps.findIndex((step) => step.kind === "languages");
    return languageIndex > -1 ? languageIndex : steps.length;
  }
  return steps.length;
};

export const validateWizardName = (nameValue: string): string => {
  if (nameValue.length < 5 || nameValue.length > 40) {
    return "A név hossza 5 és 40 karakter között legyen.";
  }
  if (!/\s/.test(nameValue)) {
    return "A név tartalmazzon szóközt (vezetéknév + keresztnév).";
  }
  return "";
};

export const validatePrimaryStatFinalValue = (
  entered: number,
  roll?: Adventure.TRollElements
): string => {
  const { minTotal, maxTotal } = getRollRange(roll);
  if (!Number.isFinite(entered)) return "Adj meg egy érvényes számot.";
  if (entered < minTotal || entered > maxTotal) {
    return `Érvénytelen végső érték. Tartomány: ${minTotal}-${maxTotal}.`;
  }
  return "";
};

export const buildRuntimeSelectOptions = (
  fieldKey: keyof Character.TRpElements,
  currentRp: Character.TRpElements,
  religions: Array<{ name: string; value: string }>,
  personalities: Array<{ name: string; value: string }>,
  defaultOptions?: Array<{ label: string; value: string }>
) => {
  if (fieldKey === "religion") {
    return religions.length
      ? religions.map((r) => ({ label: r.name, value: r.name }))
      : [{ label: currentRp.religion || "-", value: currentRp.religion || "" }];
  }
  if (fieldKey === "personality") {
    return personalities.length
      ? personalities.map((p) => ({ label: p.name, value: p.name }))
      : [{ label: currentRp.personality || "-", value: currentRp.personality || "" }];
  }
  return defaultOptions;
};

export const hasInvalidRollStat = (primaryStats: Character.TPrimaryStat[]) =>
  primaryStats.some((stat) => {
    if (!stat.roll) return false;
    const entered = Number(stat.val ?? 0);
    return !!validatePrimaryStatFinalValue(entered, stat.roll);
  });

export const isWizardFinalizeInvalid = (
  rp: Character.TRpElements,
  primaryStats: Character.TPrimaryStat[],
  hm?: Character.THm,
  hmBase?: Character.THm,
  hmInitialPoints = 0
) =>
  !rp.name.trim() ||
  rp.name.trim().length < 5 ||
  rp.name.trim().length > 40 ||
  !/\s/.test(rp.name.trim()) ||
  rp.age < 20 ||
  rp.age > 300 ||
  rp.height < 100 ||
  rp.height > 300 ||
  rp.weight < 20 ||
  rp.weight > 500 ||
  !rp.skinColor.trim() ||
  !rp.hair.trim() ||
  !rp.eyes.trim() ||
  !rp.religion.trim() ||
  !rp.bornPlace.trim() ||
  !rp.personality.trim() ||
  !rp.description.trim() ||
  rp.knownLanguages.length === 0 ||
  hasInvalidRollStat(primaryStats) ||
  (!!hm &&
    !!hmBase &&
    hmInitialPoints > 0 &&
    getAllocatedHmPoints(hm, hmBase) !== hmInitialPoints);
