import { Character } from "@shared/contracts";

export const HM_KEYS: Array<keyof Character.THm> = ["ATK", "DEF", "INI", "AIM"];

export const HM_HU_LABELS: Record<keyof Character.THm, string> = {
  ATK: "TÉ",
  DEF: "VÉ",
  INI: "KÉ",
  AIM: "CÉ",
};

export const createEmptyHm = (): Character.THm => ({
  ATK: 0,
  DEF: 0,
  INI: 0,
  AIM: 0,
});

const toNumericHmValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
};

export const withHmDefaults = (
  hm?:
    | Partial<Character.THm>
    | Partial<Record<keyof Character.THm, number | Character.TValueModifier>>
    | null
): Character.THm => ({
  ATK: toNumericHmValue(hm?.ATK),
  DEF: toNumericHmValue(hm?.DEF),
  INI: toNumericHmValue(hm?.INI),
  AIM: toNumericHmValue(hm?.AIM),
});

export const formatHmCompact = (hm?: Partial<Character.THm> | null): string => {
  const safe = withHmDefaults(hm);
  return `ATK ${safe.ATK}, DEF ${safe.DEF}, INI ${safe.INI}, AIM ${safe.AIM}`;
};
