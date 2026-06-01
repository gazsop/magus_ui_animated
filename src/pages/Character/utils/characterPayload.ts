import { Character } from "@shared/contracts";

type TCharacterPayloadParseResult = {
  json: Character.TCharacter | null;
  computed: Character.TComputedCharacter | null;
  hash?: string;
};

const parseMaybeJson = (value: unknown): unknown =>
  typeof value === "string" ? JSON.parse(value) : value;

const isCharacterJson = (value: unknown): value is Character.TCharacter => {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return "rp" in obj && "primaryStats" in obj && "hm" in obj;
};

export const parseCharacterPayload = (payload: unknown): TCharacterPayloadParseResult => {
  try {
    const root = parseMaybeJson(payload);
    if (!root || typeof root !== "object") return { json: null, computed: null };
    const obj = root as Record<string, unknown>;

    if ("json" in obj) {
      const json = parseMaybeJson(obj.json) as Character.TCharacter;
      const computed =
        obj.computed && typeof obj.computed === "object"
          ? (obj.computed as Character.TComputedCharacter)
          : null;
      return {
        json: json && typeof json === "object" ? json : null,
        computed,
        hash: typeof obj.hash === "string" ? obj.hash : undefined,
      };
    }

    if ("data" in obj && obj.data && typeof obj.data === "object") {
      const parsed = parseCharacterPayload(obj.data);
      return {
        ...parsed,
        hash: typeof obj.hash === "string" ? obj.hash : parsed.hash,
      };
    }

    const computed =
      obj.computed && typeof obj.computed === "object"
        ? (obj.computed as Character.TComputedCharacter)
        : null;
    if (isCharacterJson(obj)) {
      const record = obj as Record<string, unknown>;
      return {
        json: obj,
        computed,
        hash: typeof record.hash === "string" ? record.hash : undefined,
      };
    }
    if (computed) {
      return {
        json: null,
        computed,
        hash: typeof obj.hash === "string" ? obj.hash : undefined,
      };
    }
  } catch {
    return { json: null, computed: null };
  }
  return { json: null, computed: null };
};
