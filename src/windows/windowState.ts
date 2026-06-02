import { Fragment, h } from "preact";
import { PageState } from "@/app/navigation";
import {
  TPinnedWindowRecord,
  TWindowRegistration,
  TWindowState,
} from "./windowTypes";
import { getPinnedWindowNames } from "./windowStorage";

export type TWindowsLayerState = {
  windows: TWindowState[];
  selectedWindow: string;
};

export type TWindowStateAction =
  | {
      type: "register";
      window: TWindowRegistration;
      pinnedRecords: TPinnedWindowRecord[];
      basePersistentLauncher?: boolean;
      openOnRegister?: boolean;
    }
  | { type: "update"; name: string; window: TWindowRegistration }
  | { type: "close"; name: string }
  | { type: "open"; name: string }
  | { type: "minimize"; name: string }
  | { type: "toggle"; name: string }
  | { type: "select"; name: string }
  | { type: "applyPinned"; pinnedRecords: TPinnedWindowRecord[] }
  | { type: "applyPage"; currentPage: PageState };

type TWindowLike = TWindowRegistration | TWindowState;

export const makePlaceholderIcon = (name: string) => {
  const letters = name
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return h(Fragment, null, letters || "W");
};

export const getRegistrationName = (windowElem: TWindowLike) =>
  windowElem.name || windowElem.descriptor?.id || "";

export const getRegistrationIcon = (windowElem: TWindowLike) =>
  windowElem.icon ||
  makePlaceholderIcon(
    windowElem.descriptor?.icon ||
      windowElem.descriptor?.title ||
      getRegistrationName(windowElem)
  );

export const dedupeWindowsByName = (items: TWindowState[]) => {
  const out: TWindowState[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    if (!item.name || seen.has(item.name)) return;
    seen.add(item.name);
    out.push(item);
  });
  return out;
};

export const normalizeWindowRegistration = (
  windowElem: TWindowRegistration,
  options?: { defaultOpen?: boolean; basePersistentLauncher?: boolean; isOpen?: boolean }
): TWindowState => {
  const descriptor = windowElem.descriptor;
  const name = getRegistrationName(windowElem);
  return {
    ...windowElem,
    name,
    icon: getRegistrationIcon(windowElem),
    defaultOpen: windowElem.defaultOpen ?? descriptor?.defaultOpen,
    persistentLauncher: windowElem.persistentLauncher ?? descriptor?.persistentLauncher,
    basePersistentLauncher:
      options?.basePersistentLauncher ??
      Boolean(windowElem.persistentLauncher ?? descriptor?.persistentLauncher),
    isOpen:
      options?.isOpen ??
      options?.defaultOpen ??
      windowElem.defaultOpen ??
      descriptor?.defaultOpen ??
      false,
    allowedPages: windowElem.allowedPages ?? descriptor?.allowedPages,
    keepStateAcrossPages: windowElem.keepStateAcrossPages ?? descriptor?.keepStateAcrossPages,
    launcherGroup: windowElem.launcherGroup ?? descriptor?.launcherGroup,
    launcherVisible: windowElem.launcherVisible ?? descriptor?.launcherVisible,
  };
};

export const makePinnedPlaceholderWindow = (record: TPinnedWindowRecord): TWindowState => ({
  name: record.name,
  icon: makePlaceholderIcon(record.descriptor!.icon),
  descriptor: record.descriptor!,
  defaultOpen: false,
  isOpen: false,
  persistentLauncher: true,
  basePersistentLauncher: false,
  allowedPages: record.allowedPages ?? record.descriptor!.allowedPages,
  keepStateAcrossPages: record.keepStateAcrossPages ?? record.descriptor!.keepStateAcrossPages ?? true,
  launcherGroup: record.launcherGroup ?? record.descriptor!.launcherGroup,
  launcherVisible: record.launcherVisible ?? record.descriptor!.launcherVisible,
});

export const sameWindowSemanticFields = (a: TWindowState, b: TWindowLike) =>
  a.name === getRegistrationName(b) &&
  a.icon === getRegistrationIcon(b) &&
  JSON.stringify(a.descriptor || null) === JSON.stringify(b.descriptor || null) &&
  Boolean(a.hasNotification) === Boolean(b.hasNotification) &&
  Boolean(a.persistentLauncher) ===
    Boolean(b.persistentLauncher ?? b.descriptor?.persistentLauncher) &&
  Boolean(a.defaultOpen) === Boolean(b.defaultOpen ?? b.descriptor?.defaultOpen) &&
  Boolean(a.keepStateAcrossPages) ===
    Boolean(b.keepStateAcrossPages ?? b.descriptor?.keepStateAcrossPages) &&
  Boolean(a.launcherVisible ?? true) ===
    Boolean(b.launcherVisible ?? b.descriptor?.launcherVisible ?? true) &&
  String(a.allowedPages || "") === String(b.allowedPages ?? b.descriptor?.allowedPages ?? "");

export const isWindowAllowedForPage = (windowElem: TWindowState, currentPage: PageState) => {
  const allowed = windowElem.allowedPages;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(currentPage);
};

export const getVisibleWindows = (state: TWindowsLayerState, currentPage: PageState) =>
  state.windows.filter((windowElem) => isWindowAllowedForPage(windowElem, currentPage));

export const buildInitialWindowState = (
  initialWindows: TWindowRegistration[],
  pinnedRecords: TPinnedWindowRecord[]
): TWindowsLayerState => {
  const baseWindows: TWindowState[] = initialWindows.map((windowElem) => ({
    ...normalizeWindowRegistration(windowElem, {
      isOpen: windowElem.defaultOpen ?? windowElem.descriptor?.defaultOpen ?? false,
      basePersistentLauncher: true,
    }),
    persistentLauncher: true,
    basePersistentLauncher: true,
  }));
  const existing = new Set(baseWindows.map((windowElem) => windowElem.name));
  const placeholders = pinnedRecords
    .filter((record) => !existing.has(record.name))
    .map(makePinnedPlaceholderWindow);
  return {
    windows: dedupeWindowsByName([...baseWindows, ...placeholders]),
    selectedWindow: "",
  };
};

const updateWindowAt = (
  windows: TWindowState[],
  name: string,
  patch: (windowElem: TWindowState) => TWindowState
) => {
  const idx = windows.findIndex((windowElem) => windowElem.name === name);
  if (idx < 0) return windows;
  const next = [...windows];
  next[idx] = patch(windows[idx]);
  return next;
};

export const windowsReducer = (
  state: TWindowsLayerState,
  action: TWindowStateAction
): TWindowsLayerState => {
  switch (action.type) {
    case "register": {
      const windowName = getRegistrationName(action.window);
      if (!windowName) return state;
      const defaultOpen =
        action.openOnRegister === false
          ? false
          : action.window.defaultOpen ?? action.window.descriptor?.defaultOpen ?? true;
      const existingIndex = state.windows.findIndex((windowElem) => windowElem.name === windowName);
      const pinnedNames = getPinnedWindowNames(action.pinnedRecords);

      if (existingIndex >= 0) {
        const existing = state.windows[existingIndex];
        const normalizedWindow = normalizeWindowRegistration(action.window, {
          isOpen: action.openOnRegister === false ? existing.isOpen : true,
          basePersistentLauncher:
            existing.basePersistentLauncher ||
            action.basePersistentLauncher ||
            Boolean(action.window.persistentLauncher ?? action.window.descriptor?.persistentLauncher),
        });
        const nextWindow: TWindowState = {
          ...existing,
          ...normalizedWindow,
          persistentLauncher:
            pinnedNames.includes(windowName) ||
            Boolean(action.window.persistentLauncher ?? action.window.descriptor?.persistentLauncher) ||
            existing.basePersistentLauncher,
          basePersistentLauncher:
            existing.basePersistentLauncher ||
            action.basePersistentLauncher ||
            Boolean(action.window.persistentLauncher ?? action.window.descriptor?.persistentLauncher),
          isOpen: action.openOnRegister === false ? existing.isOpen : true,
        };
        if (existing.isOpen === nextWindow.isOpen && sameWindowSemanticFields(existing, nextWindow)) {
          return { ...state, selectedWindow: windowName };
        }
        const next = [...state.windows];
        next[existingIndex] = nextWindow;
        return { windows: next, selectedWindow: windowName };
      }

      const nextWindow = {
        ...normalizeWindowRegistration(action.window, {
          isOpen: defaultOpen,
          basePersistentLauncher:
            action.basePersistentLauncher ||
            Boolean(action.window.persistentLauncher ?? action.window.descriptor?.persistentLauncher),
        }),
        persistentLauncher:
          pinnedNames.includes(windowName) ||
          action.basePersistentLauncher ||
          Boolean(action.window.persistentLauncher ?? action.window.descriptor?.persistentLauncher),
        basePersistentLauncher:
          action.basePersistentLauncher ||
          Boolean(action.window.persistentLauncher ?? action.window.descriptor?.persistentLauncher),
      };
      return {
        windows: dedupeWindowsByName([...state.windows, nextWindow]),
        selectedWindow: defaultOpen ? windowName : state.selectedWindow,
      };
    }

    case "update": {
      const windowIndex = state.windows.findIndex((existingWindow) => existingWindow.name === action.name);
      if (windowIndex < 0) return state;
      const existing = state.windows[windowIndex];
      if (sameWindowSemanticFields(existing, action.window)) return state;
      const next = [...state.windows];
      const normalizedWindow = normalizeWindowRegistration(action.window, {
        isOpen: existing.isOpen,
        basePersistentLauncher: existing.basePersistentLauncher,
      });
      next[windowIndex] = {
        ...existing,
        ...normalizedWindow,
        isOpen: existing.isOpen,
        name: existing.name,
      };
      return { ...state, windows: next };
    }

    case "close": {
      const target = state.windows.find((windowElem) => windowElem.name === action.name);
      if (!target) return state;
      const selectedWindow = state.selectedWindow === action.name ? "" : state.selectedWindow;
      if (target.persistentLauncher) {
        if (!target.isOpen) return { ...state, selectedWindow };
        return {
          windows: updateWindowAt(state.windows, action.name, (windowElem) => ({
            ...windowElem,
            isOpen: false,
          })),
          selectedWindow,
        };
      }
      return {
        windows: state.windows.filter((windowElem) => windowElem.name !== action.name),
        selectedWindow,
      };
    }

    case "open":
      return {
        windows: updateWindowAt(state.windows, action.name, (windowElem) => ({
          ...windowElem,
          isOpen: true,
        })),
        selectedWindow: state.windows.some((windowElem) => windowElem.name === action.name)
          ? action.name
          : state.selectedWindow,
      };

    case "minimize":
      return {
        windows: updateWindowAt(state.windows, action.name, (windowElem) => ({
          ...windowElem,
          isOpen: false,
        })),
        selectedWindow: state.selectedWindow === action.name ? "" : state.selectedWindow,
      };

    case "toggle": {
      const target = state.windows.find((windowElem) => windowElem.name === action.name);
      if (!target) return state;
      const nextOpen = !target.isOpen;
      return {
        windows: updateWindowAt(state.windows, action.name, (windowElem) => ({
          ...windowElem,
          isOpen: nextOpen,
        })),
        selectedWindow: nextOpen ? action.name : state.selectedWindow === action.name ? "" : state.selectedWindow,
      };
    }

    case "select":
      return state.selectedWindow === action.name
        ? state
        : { ...state, selectedWindow: action.name };

    case "applyPinned": {
      const pinnedNames = getPinnedWindowNames(action.pinnedRecords);
      const windows = state.windows.map((windowElem) => {
        const shouldBePinned =
          windowElem.basePersistentLauncher || pinnedNames.includes(windowElem.name);
        return shouldBePinned === windowElem.persistentLauncher
          ? windowElem
          : { ...windowElem, persistentLauncher: shouldBePinned };
      });
      return { ...state, windows };
    }

    case "applyPage": {
      let changed = false;
      const windows = state.windows.flatMap((windowElem) => {
        if (isWindowAllowedForPage(windowElem, action.currentPage)) return [windowElem];
        if (windowElem.keepStateAcrossPages !== false) {
          if (!windowElem.isOpen) return [windowElem];
          changed = true;
          return [{ ...windowElem, isOpen: false }];
        }
        changed = true;
        return [];
      });
      const selectedWindow =
        state.selectedWindow &&
        windows.some(
          (windowElem) =>
            windowElem.name === state.selectedWindow &&
            isWindowAllowedForPage(windowElem, action.currentPage)
        )
          ? state.selectedWindow
          : "";
      if (!changed && selectedWindow === state.selectedWindow) return state;
      return { windows: changed ? dedupeWindowsByName(windows) : state.windows, selectedWindow };
    }

    default:
      return state;
  }
};
