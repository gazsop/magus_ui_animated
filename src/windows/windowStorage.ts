import { PageState } from "@/app/navigation";
import {
  TPinnedWindowRecord,
  TWindowDescriptor,
  TWindowLauncherGroup,
} from "./windowTypes";

const PINNED_WINDOWS_STORAGE_KEY = "windows_layer_pinned_windows_v1";
const LAUNCHER_GROUPS: TWindowLauncherGroup[] = ["general", "admin", "page", "chat"];

const sanitizeLauncherGroup = (value: unknown): TWindowLauncherGroup | undefined =>
  LAUNCHER_GROUPS.includes(value as TWindowLauncherGroup)
    ? (value as TWindowLauncherGroup)
    : undefined;

const sanitizeAllowedPages = (value: unknown): PageState[] | undefined =>
  Array.isArray(value)
    ? value.filter((page): page is PageState =>
        Object.values(PageState).includes(page as PageState)
      )
    : undefined;

export const sanitizeWindowDescriptor = (input: unknown): TWindowDescriptor | undefined => {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Partial<TWindowDescriptor>;
  const id = String(raw.id || "").trim();
  const kind = String(raw.kind || "").trim();
  const title = String(raw.title || "").trim();
  const icon = String(raw.icon || "").trim();
  if (!id || !kind || !title || !icon) return undefined;

  const params: Record<string, string> = {};
  if (raw.params && typeof raw.params === "object" && !Array.isArray(raw.params)) {
    Object.entries(raw.params).forEach(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        params[key] = String(value);
      }
    });
  }

  return {
    id,
    kind,
    title,
    icon,
    params: Object.keys(params).length > 0 ? params : undefined,
    launcherGroup: sanitizeLauncherGroup(raw.launcherGroup),
    allowedPages: sanitizeAllowedPages(raw.allowedPages),
    keepStateAcrossPages: raw.keepStateAcrossPages,
    persistentLauncher: raw.persistentLauncher,
    launcherVisible: raw.launcherVisible,
    defaultOpen: raw.defaultOpen,
  };
};

const sanitizePinnedWindowRecord = (entry: unknown): TPinnedWindowRecord | null => {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Partial<TPinnedWindowRecord>;
  const descriptor = sanitizeWindowDescriptor(raw.descriptor);
  const name = String(raw.name || descriptor?.id || "").trim();
  if (!name || !descriptor) return null;

  return {
    name,
    descriptor,
    launcherGroup: sanitizeLauncherGroup(raw.launcherGroup),
    allowedPages: sanitizeAllowedPages(raw.allowedPages),
    keepStateAcrossPages: raw.keepStateAcrossPages,
    launcherVisible: raw.launcherVisible,
  };
};

export const readPinnedWindowRecords = (): TPinnedWindowRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_WINDOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .map(sanitizePinnedWindowRecord)
      .filter((entry): entry is TPinnedWindowRecord => !!entry)
      .filter((entry) => {
        if (seen.has(entry.name)) return false;
        seen.add(entry.name);
        return true;
      });
  } catch {
    return [];
  }
};

export const writePinnedWindowRecords = (records: TPinnedWindowRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PINNED_WINDOWS_STORAGE_KEY, JSON.stringify(records));
};

export const getPinnedWindowNames = (records: TPinnedWindowRecord[]) =>
  records.map((entry) => entry.name);
