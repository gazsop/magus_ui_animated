import { Character } from "@shared/contracts";

export const ensurePrimaryStats = (
  stats?: Character.TPrimaryStat[] | null
): Character.TPrimaryStat[] => (Array.isArray(stats) ? stats : []);

export const getPrimaryStatValue = (
  stats: Character.TPrimaryStat[] | null | undefined,
  name: Character.PRIMARY_STATS
): number =>
  ensurePrimaryStats(stats).find((s) => s.name === name)?.val ?? 0;

export const formatStringList = (
  values: Array<string | null | undefined> | null | undefined
): string => {
  const safe = (values || [])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return safe.length > 0 ? safe.join(", ") : "-";
};
