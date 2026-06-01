import { Character } from "@shared/contracts";

export type TRpFieldDescriptor = {
  key: keyof Character.TRpElements;
  label: string;
  parser?: (val: string) => string | number;
  formatter?: (val: string | number | null | undefined) => string;
  selectOptions?: Array<{ label: string; value: string }>;
};

export const RP_WIZARD_FIELDS: TRpFieldDescriptor[] = [
  {
    key: "age",
    label: "Kor",
    parser: (v) => Number(v) || 0,
    formatter: (v) => (Number(v) > 0 ? String(v) : ""),
  },
  { key: "skinColor", label: "Bőrszín" },
  { key: "hair", label: "Haj" },
  { key: "eyes", label: "Szem" },
  {
    key: "bioType",
    label: "Nem",
    selectOptions: [
      { label: Character.BTYPE.MALE, value: Character.BTYPE.MALE },
      { label: Character.BTYPE.FEMALE, value: Character.BTYPE.FEMALE },
    ],
  },
  {
    key: "height",
    label: "Magasság",
    parser: (v) => Number(v) || 0,
    formatter: (v) => (Number(v) > 0 ? String(v) : ""),
  },
  {
    key: "weight",
    label: "Súly",
    parser: (v) => Number(v) || 0,
    formatter: (v) => (Number(v) > 0 ? String(v) : ""),
  },
  {
    key: "religion",
    label: "Vallás",
    selectOptions: [],
  },
  { key: "bornPlace", label: "Születési hely" },
  { key: "schools", label: "Iskolák" },
  {
    key: "personality",
    label: "Jellem",
    selectOptions: [],
  },
  { key: "description", label: "Leírás" },
];

export function validateRpFieldValue(
  field: TRpFieldDescriptor,
  parsedValue: string | number
): string {
  const strVal = String(parsedValue ?? "").trim();
  if (field.key === "schools") return "";
  const isNumericField =
    field.key === "age" || field.key === "height" || field.key === "weight";
  if (isNumericField) {
    const n = Number(parsedValue || 0);
    if (!Number.isFinite(n)) return "Adj meg egy érvényes számot.";
    if (field.key === "age" && (n < 20 || n > 300)) return "A kor 20 és 300 között legyen.";
    if (field.key === "height" && (n < 100 || n > 300))
      return "A magasság 100 és 300 között legyen.";
    if (field.key === "weight" && (n < 20 || n > 500)) return "A súly 20 és 500 között legyen.";
    return "";
  }
  if (!strVal) return `${field.label} kötelező mező.`;
  if (strVal.length < 3 || strVal.length > 30)
    return `${field.label} hossza 3-30 karakter legyen.`;
  return "";
}

export function isRpFieldFilled(
  rp: Character.TRpElements,
  field: TRpFieldDescriptor
): boolean {
  if (field.key === "schools") return true;
  const value = rp[field.key];
  if (field.key === "age" || field.key === "height" || field.key === "weight") {
    return Number(value || 0) > 0;
  }
  return String(value ?? "").trim().length > 0;
}
