import { createContext, useContext, useState, JSX, memo, useMemo, useCallback, useEffect } from "preact/compat";
import { FlexCol, FlexRow } from "@components/Flex";
import { RndWindowControlsContext } from "@components/RndContainer";
import { PageState } from "@/app/navigation";
import { renderWindowDescriptor } from "@/windows/windowDescriptorRenderers";
import {
  TWindowDescriptor,
  TWindowLauncherGroup,
  TWindowRegistration,
  TWindowState,
} from "@/windows/windowTypes";

export type IWindowsLayerWindowProps = TWindowRegistration;

export interface IWindowsLayerShortcut {
  name: string;
  icon: JSX.Element;
  onClick: () => void;
  launcherGroup?: TWindowLauncherGroup;
  className?: string;
  style?: JSX.CSSProperties;
}

export interface IOnlineUserBadge {
  uid: string;
  name: string;
  active: boolean;
  status?: "active" | "inactive" | "offline";
  onClick?: () => void;
  hasNotification?: boolean;
  style?: JSX.CSSProperties;
}

type TLauncherGroup = TWindowLauncherGroup;

const PINNED_WINDOWS_STORAGE_KEY = "windows_layer_pinned_windows_v1";
type TPinnedWindowRecord = {
  name: string;
  descriptor?: TWindowDescriptor;
  launcherGroup?: TWindowLauncherGroup;
  allowedPages?: PageState[];
  keepStateAcrossPages?: boolean;
  launcherVisible?: boolean;
};

const sanitizeWindowDescriptor = (input: unknown): TWindowDescriptor | undefined => {
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
  const launcherGroup =
    raw.launcherGroup === "general" ||
    raw.launcherGroup === "admin" ||
    raw.launcherGroup === "page" ||
    raw.launcherGroup === "chat"
      ? raw.launcherGroup
      : undefined;
  const allowedPages = Array.isArray(raw.allowedPages)
    ? raw.allowedPages.filter((page): page is PageState =>
        Object.values(PageState).includes(page as PageState)
      )
    : undefined;
  return {
    id,
    kind,
    title,
    icon,
    params: Object.keys(params).length > 0 ? params : undefined,
    launcherGroup,
    allowedPages,
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
  const allowedPages = Array.isArray(raw.allowedPages)
    ? raw.allowedPages.filter((page): page is PageState =>
        Object.values(PageState).includes(page as PageState)
      )
    : undefined;
  const launcherGroup =
    raw.launcherGroup === "general" ||
    raw.launcherGroup === "admin" ||
    raw.launcherGroup === "page" ||
    raw.launcherGroup === "chat"
      ? raw.launcherGroup
      : undefined;
  return {
    name,
    descriptor,
    launcherGroup,
    allowedPages,
    keepStateAcrossPages: raw.keepStateAcrossPages,
    launcherVisible: raw.launcherVisible,
  };
};

const readPinnedWindowRecords = (): TPinnedWindowRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_WINDOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const records = parsed
      .map(sanitizePinnedWindowRecord)
      .filter((entry): entry is TPinnedWindowRecord => !!entry);
    const seen = new Set<string>();
    return records.filter((entry) => {
      if (seen.has(entry.name)) return false;
      seen.add(entry.name);
      return true;
    });
  } catch {
    return [];
  }
};

const writePinnedWindowRecords = (records: TPinnedWindowRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PINNED_WINDOWS_STORAGE_KEY, JSON.stringify(records));
};

const pinnedWindowNames = (records: TPinnedWindowRecord[]) =>
  records.map((entry) => entry.name);

const dedupeWindowsByName = (items: TWindowState[]) => {
  const out: TWindowState[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    if (!item.name || seen.has(item.name)) return;
    seen.add(item.name);
    out.push(item);
  });
  return out;
};

const makePlaceholderIcon = (name: string) => {
  const letters = name
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <>{letters || "W"}</>;
};

type TWindowLike = IWindowsLayerWindowProps | TWindowState;

const getRegistrationName = (windowElem: TWindowLike) =>
  windowElem.name || windowElem.descriptor?.id || "";

const getRegistrationIcon = (windowElem: TWindowLike) =>
  windowElem.icon ||
  makePlaceholderIcon(
    windowElem.descriptor?.icon ||
      windowElem.descriptor?.title ||
      getRegistrationName(windowElem)
  );

const normalizeWindowRegistration = (
  windowElem: IWindowsLayerWindowProps,
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
    basePersistentLauncher: options?.basePersistentLauncher ?? Boolean(windowElem.persistentLauncher ?? descriptor?.persistentLauncher),
    isOpen: options?.isOpen ?? options?.defaultOpen ?? windowElem.defaultOpen ?? descriptor?.defaultOpen ?? false,
    allowedPages: windowElem.allowedPages ?? descriptor?.allowedPages,
    keepStateAcrossPages: windowElem.keepStateAcrossPages ?? descriptor?.keepStateAcrossPages,
    launcherGroup: windowElem.launcherGroup ?? descriptor?.launcherGroup,
    launcherVisible: windowElem.launcherVisible ?? descriptor?.launcherVisible,
  };
};

const makePinnedPlaceholderWindow = (record: TPinnedWindowRecord): TWindowState => ({
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

interface IWindowsLayer {
  addWindow: (windowElem: IWindowsLayerWindowProps) => void;
  removeWindow: (windowName: string) => void;
  updateWindow: (
    windowName: string,
    windowElem: IWindowsLayerWindowProps
  ) => void;
}

const WindowsLayerContext = createContext<IWindowsLayer>({
  addWindow: () => {},
  removeWindow: () => {},
  updateWindow: () => {},
});

const sameWindowSemanticFields = (a: TWindowState, b: TWindowLike) =>
  a.name === getRegistrationName(b) &&
  a.icon === getRegistrationIcon(b) &&
  JSON.stringify(a.descriptor || null) === JSON.stringify(b.descriptor || null) &&
  Boolean(a.hasNotification) === Boolean(b.hasNotification) &&
  Boolean(a.persistentLauncher) === Boolean(b.persistentLauncher ?? b.descriptor?.persistentLauncher) &&
  Boolean(a.defaultOpen) === Boolean(b.defaultOpen ?? b.descriptor?.defaultOpen) &&
  Boolean(a.keepStateAcrossPages) === Boolean(b.keepStateAcrossPages ?? b.descriptor?.keepStateAcrossPages) &&
  Boolean(a.launcherVisible ?? true) === Boolean(b.launcherVisible ?? b.descriptor?.launcherVisible ?? true) &&
  String(a.allowedPages || "") === String(b.allowedPages ?? b.descriptor?.allowedPages ?? "");

const isWindowAllowedForPage = (windowElem: TWindowState, currentPage: PageState) => {
  const allowed = windowElem.allowedPages;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(currentPage);
};

const WindowsCanvas = memo(function WindowsCanvas(props: {
  windows: TWindowState[];
  selectedWindow: string;
  removeWindow: (name: string) => void;
  minimizeWindow: (name: string) => void;
  setSelectedWindow: (name: string) => void;
}) {
  const { windows, selectedWindow, removeWindow, minimizeWindow, setSelectedWindow } = props;
  return (
    <>
      {windows.map((windowElem) => {
        if (!windowElem || !windowElem.isOpen) return null;
        return (
          <div key={windowElem.name}>
            <RndWindowControlsContext.Provider
              value={{
                minimize: () => minimizeWindow(windowElem.name),
              }}
            >
              {renderWindowDescriptor(windowElem.descriptor, {
                close: () => removeWindow(windowElem.name),
                minimize: () => minimizeWindow(windowElem.name),
                selectWindow: () => setSelectedWindow(windowElem.name),
                classes: selectedWindow === windowElem.name ? "z-50" : "z-10",
              })}
            </RndWindowControlsContext.Provider>
          </div>
        );
      })}
    </>
  );
});

const PresenceBar = memo(function PresenceBar(props: { onlineUsers: IOnlineUserBadge[] }) {
  if (props.onlineUsers.length === 0) return null;
  return (
    <FlexCol className="gap-0.5">
      {props.onlineUsers.map((onlineUser) => {
        const status = onlineUser.status ?? (onlineUser.active ? "active" : "inactive");
        const statusClass =
          status === "active"
            ? "text-green-200"
            : status === "inactive"
              ? "text-yellow-300"
              : "text-red-300";
        const statusLabel =
          status === "active" ? "active" : status === "inactive" ? "inactive" : "offline";
        return (
          <FlexRow
            key={`${onlineUser.uid}-online-badge`}
            className={`fancy-container h-[35px] m-0.5 items-center justify-center font-bold text-xs select-none cursor-pointer relative ${statusClass}`}
            style={{ borderRadius: "17px 0px 0px 17px", ...(onlineUser.style ?? {}) }}
            title={`${onlineUser.name} (${statusLabel})`}
            onClick={onlineUser.onClick}
          >
            {onlineUser.name.slice(0, 2).toUpperCase()}
            {onlineUser.hasNotification ? (
              <span
                className="absolute top-[4px] right-[4px] w-2 h-2 rounded-full bg-red-500"
                title="New message"
              />
            ) : null}
          </FlexRow>
        );
      })}
    </FlexCol>
  );
});

const LauncherBar = memo(function LauncherBar(props: {
  shortcuts: IWindowsLayerShortcut[];
  windows: TWindowState[];
  groups?: TLauncherGroup[];
  setSelectedWindow: (name: string) => void;
  openWindow: (name: string) => void;
  toggleWindow: (name: string) => void;
  togglePinnedWindow: (name: string) => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<"general" | "admin" | "page" | "chat", {
      shortcuts: IWindowsLayerShortcut[];
      windows: TWindowState[];
    }> = {
      general: { shortcuts: [], windows: [] },
      admin: { shortcuts: [], windows: [] },
      page: { shortcuts: [], windows: [] },
      chat: { shortcuts: [], windows: [] },
    };
    props.shortcuts.forEach((shortcut) => {
      const group = shortcut.launcherGroup ?? "page";
      out[group].shortcuts.push(shortcut);
    });
    props.windows
      .filter((windowElem) => windowElem.launcherVisible !== false || windowElem.persistentLauncher)
      .forEach((windowElem) => {
        const group = windowElem.launcherGroup ?? "page";
        out[group].windows.push(windowElem);
      });
    return out;
  }, [props.shortcuts, props.windows]);

  const GroupDivider = () => (
    <div className="px-1 py-1">
      <div className="h-[1px] bg-slate-300/40 w-full" />
    </div>
  );

  return (
    <FlexCol className="gap-0.5">
      {(() => {
        const sections = (props.groups ?? ["chat", "page", "admin", "general"])
          .filter((group) => {
            const segment = grouped[group];
            return segment.shortcuts.length > 0 || segment.windows.length > 0;
          });

        return sections.map((group, index) => {
          const segment = grouped[group];
          return (
            <div key={`launcher-group-${group}`}>
              {segment.shortcuts.map((shortcut) => (
                <FlexRow
                  key={`${shortcut.name}-shortcut`}
                  className={`fancy-container h-[35px] m-0.5 cursor-pointer items-center pl-2 ${
                    shortcut.className ?? ""
                  }`}
                  style={{ borderRadius: "17px 0px 0px 17px", ...(shortcut.style ?? {}) }}
                  onClick={shortcut.onClick}
                  title={shortcut.name}
                >
                  {shortcut.icon}
                </FlexRow>
              ))}
              {segment.windows.map((windowElem) => (
                <FlexRow
                  key={`${windowElem.name}-launcher`}
                  className="fancy-container h-[35px] m-0.5 cursor-pointer items-center pl-2 relative"
                  style={{ borderRadius: "17px 0px 0px 17px" }}
                  onClick={() => {
                    if (windowElem.isOpen) {
                      props.setSelectedWindow("");
                      props.toggleWindow(windowElem.name);
                      return;
                    }
                    props.setSelectedWindow(windowElem.name);
                    props.openWindow(windowElem.name);
                  }}
                  onContextMenu={(e) => {
                    if (windowElem.basePersistentLauncher) return;
                    e.preventDefault();
                    e.stopPropagation();
                    props.togglePinnedWindow(windowElem.name);
                  }}
                  title={
                    windowElem.basePersistentLauncher
                      ? windowElem.name
                      : `${windowElem.name} (right click to ${
                          windowElem.persistentLauncher ? "unpin" : "pin"
                        })`
                  }
                >
                  {windowElem.icon}
                  {windowElem.persistentLauncher && !windowElem.basePersistentLauncher ? (
                    <span
                      className="absolute bottom-[4px] right-[4px] text-[10px] leading-none"
                      title="Pinned"
                    >
                      P
                    </span>
                  ) : null}
                  {windowElem.hasNotification ? (
                    <span
                      className="absolute top-[4px] right-[4px] w-2 h-2 rounded-full bg-red-500"
                      title="New message"
                    />
                  ) : null}
                </FlexRow>
              ))}
              {index < sections.length - 1 ? <GroupDivider /> : null}
            </div>
          );
        });
      })()}
    </FlexCol>
  );
});

export const WindowsLayerProvider = (props: {
  children: JSX.Element | JSX.Element[];
  windows?: IWindowsLayerWindowProps[];
  shortcuts?: IWindowsLayerShortcut[];
  onlineUsers?: IOnlineUserBadge[];
  currentPage: PageState;
}) => {
  const initialWindows = props.windows ?? [];
  const [pinnedWindowRecords, setPinnedWindowRecords] = useState<TPinnedWindowRecord[]>(
    () => readPinnedWindowRecords()
  );
  const [windows, setWindows] = useState<TWindowState[]>(
    (() => {
      const baseWindows: TWindowState[] = initialWindows.map((windowElem) => ({
        ...normalizeWindowRegistration(windowElem, {
          isOpen: windowElem.defaultOpen ?? windowElem.descriptor?.defaultOpen ?? false,
          basePersistentLauncher: true,
        }),
        persistentLauncher: true,
        basePersistentLauncher: true,
      }));
      const existing = new Set(baseWindows.map((windowElem) => windowElem.name));
      const placeholders = readPinnedWindowRecords()
        .filter((record) => !existing.has(record.name))
        .map(makePinnedPlaceholderWindow);
      return dedupeWindowsByName([...baseWindows, ...placeholders]);
    })()
  );
  const [selectedWindow, setSelectedWindow] = useState<string>("");

  const addWindow = useCallback((windowElem: IWindowsLayerWindowProps) => {
    const windowName = getRegistrationName(windowElem);
    if (!windowName) return;
    const defaultOpen = windowElem.defaultOpen ?? windowElem.descriptor?.defaultOpen ?? true;
    setWindows((prev) => {
      const existingIndex = prev.findIndex((windowEl) => windowEl.name === windowName);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const isPinned = pinnedWindowNames(pinnedWindowRecords).includes(windowName);
        const normalizedWindow = normalizeWindowRegistration(windowElem, {
          isOpen: true,
          basePersistentLauncher:
            existing.basePersistentLauncher ||
            Boolean(windowElem.persistentLauncher ?? windowElem.descriptor?.persistentLauncher),
        });
        const nextWindow: TWindowState = {
          ...existing,
          ...normalizedWindow,
          persistentLauncher:
            isPinned ||
            Boolean(windowElem.persistentLauncher ?? windowElem.descriptor?.persistentLauncher) ||
            existing.basePersistentLauncher,
          basePersistentLauncher:
            existing.basePersistentLauncher ||
            Boolean(windowElem.persistentLauncher ?? windowElem.descriptor?.persistentLauncher),
          isOpen: true,
        };
        if (
          existing.isOpen === nextWindow.isOpen &&
          sameWindowSemanticFields(existing, nextWindow)
        ) {
          return prev;
        }
        const next = [...prev];
        next[existingIndex] = nextWindow;
        setSelectedWindow(windowName);
        return next;
      }
      if (defaultOpen) setSelectedWindow(windowName);
      return dedupeWindowsByName([
        ...prev,
        {
          ...normalizeWindowRegistration(windowElem, {
            isOpen: defaultOpen,
            basePersistentLauncher: Boolean(windowElem.persistentLauncher ?? windowElem.descriptor?.persistentLauncher),
          }),
          persistentLauncher:
            pinnedWindowNames(pinnedWindowRecords).includes(windowName) ||
            Boolean(windowElem.persistentLauncher ?? windowElem.descriptor?.persistentLauncher),
          basePersistentLauncher: Boolean(windowElem.persistentLauncher ?? windowElem.descriptor?.persistentLauncher),
        },
      ]);
    });
  }, [pinnedWindowRecords]);

  const removeWindow = useCallback((windowName: string) => {
    setWindows((prev) => {
      const idx = prev.findIndex((windowElem) => windowElem.name === windowName);
      if (idx < 0) return prev;
      const windowElem = prev[idx];
      if (windowElem.persistentLauncher) {
        if (!windowElem.isOpen) return prev;
        const next = [...prev];
        next[idx] = { ...windowElem, isOpen: false };
        return next;
      }
      return prev.filter((w) => w.name !== windowName);
    });

    setSelectedWindow((prev) => (prev === windowName ? "" : prev));
  }, []);

  const updateWindow = useCallback((windowName: string, windowElem: IWindowsLayerWindowProps) => {
    setWindows((prev) => {
      const windowIndex = prev.findIndex(
        (existingWindow) => existingWindow.name === windowName
      );
      if (windowIndex < 0) return prev;
      const existing = prev[windowIndex];
      if (sameWindowSemanticFields(existing, windowElem)) {
        return prev;
      }
      const next = [...prev];
      const normalizedWindow = normalizeWindowRegistration(windowElem, {
        isOpen: existing.isOpen,
        basePersistentLauncher: existing.basePersistentLauncher,
      });
      next[windowIndex] = {
        ...existing,
        ...normalizedWindow,
        isOpen: existing.isOpen,
        name: existing.name,
      };
      return next;
    });
  }, []);

  const openWindow = useCallback((name: string) => {
    setWindows((prev) => {
      const idx = prev.findIndex((windowState) => windowState.name === name);
      if (idx < 0) return prev;
      const current = prev[idx];
      if (current.isOpen) return prev;
      const next = [...prev];
      next[idx] = { ...current, isOpen: true };
      return next;
    });
  }, []);

  const minimizeWindow = useCallback((name: string) => {
    setWindows((prev) => {
      const idx = prev.findIndex((windowState) => windowState.name === name);
      if (idx < 0) return prev;
      const current = prev[idx];
      if (!current.isOpen) return prev;
      const next = [...prev];
      next[idx] = { ...current, isOpen: false };
      return next;
    });
    setSelectedWindow((prev) => (prev === name ? "" : prev));
  }, []);

  const toggleWindow = useCallback((name: string) => {
    setWindows((prev) => {
      const idx = prev.findIndex((windowState) => windowState.name === name);
      if (idx < 0) return prev;
      const current = prev[idx];
      const next = [...prev];
      next[idx] = { ...current, isOpen: !current.isOpen };
      return next;
    });
  }, []);

  const togglePinnedWindow = useCallback((name: string) => {
    setPinnedWindowRecords((prev) => {
      const current = windows.find((windowElem) => windowElem.name === name);
      const existing = prev.some((entry) => entry.name === name);
      const next = existing
        ? prev.filter((entry) => entry.name !== name)
        : [
            ...prev,
            {
              name,
              descriptor: current?.descriptor,
              launcherGroup: current?.launcherGroup,
              allowedPages: current?.allowedPages,
              keepStateAcrossPages: current?.keepStateAcrossPages,
              launcherVisible: current?.launcherVisible,
            },
          ];
      writePinnedWindowRecords(next);
      return next;
    });
    setWindows((prev) =>
      prev.flatMap((windowElem) => {
        if (windowElem.basePersistentLauncher || windowElem.name !== name) return [windowElem];
        const nextPersistent = !windowElem.persistentLauncher;
        return [{ ...windowElem, persistentLauncher: nextPersistent }];
      })
    );
  }, [windows]);

  useEffect(() => {
    setWindows((prev) =>
      prev.map((windowElem) => {
        const shouldBePinned =
          windowElem.basePersistentLauncher ||
          pinnedWindowNames(pinnedWindowRecords).includes(windowElem.name);
        return shouldBePinned === windowElem.persistentLauncher
          ? windowElem
          : { ...windowElem, persistentLauncher: shouldBePinned };
      })
    );
  }, [pinnedWindowRecords]);

  const shortcuts = props.shortcuts ?? [];
  const onlineUsers = props.onlineUsers ?? [];
  const visibleWindows = useMemo(
    () => windows.filter((windowElem) => isWindowAllowedForPage(windowElem, props.currentPage)),
    [windows, props.currentPage]
  );

  useEffect(() => {
    setWindows((prev) => {
      let changed = false;
      const next = prev.flatMap((windowElem) => {
        if (isWindowAllowedForPage(windowElem, props.currentPage)) return [windowElem];
        if (windowElem.keepStateAcrossPages !== false) {
          if (!windowElem.isOpen) return [windowElem];
          changed = true;
          return [{ ...windowElem, isOpen: false }];
        }
        changed = true;
        return [];
      });
      return changed ? dedupeWindowsByName(next) : prev;
    });
  }, [props.currentPage]);

  useEffect(() => {
    setSelectedWindow((prev) => {
      if (!prev) return prev;
      return visibleWindows.some((windowElem) => windowElem.name === prev) ? prev : "";
    });
  }, [visibleWindows]);

  return (
    <WindowsLayerContext.Provider
      value={{ addWindow, removeWindow, updateWindow }}
    >
      {props.children}
      <WindowsCanvas
        windows={visibleWindows}
        selectedWindow={selectedWindow}
        removeWindow={removeWindow}
        minimizeWindow={minimizeWindow}
        setSelectedWindow={setSelectedWindow}
      />
      <FlexCol
        className="fixed top-[10vh] bg-transparent w-10 sm:right-0 right-[10px] gap-1"
        style={{ zIndex: "var(--layer-window-icons)" }}
      >
        <PresenceBar onlineUsers={onlineUsers} />
        <LauncherBar
          shortcuts={shortcuts}
          windows={visibleWindows}
          groups={["chat"]}
          setSelectedWindow={setSelectedWindow}
          openWindow={openWindow}
          toggleWindow={toggleWindow}
          togglePinnedWindow={togglePinnedWindow}
        />
      </FlexCol>
      <FlexCol
        className="fixed bottom-[10vh] bg-transparent w-10 sm:right-0 right-[10px] gap-1"
        style={{ zIndex: "var(--layer-window-icons)" }}
      >
        <LauncherBar
          shortcuts={shortcuts}
          windows={visibleWindows}
          groups={["general", "admin", "page"]}
          setSelectedWindow={setSelectedWindow}
          openWindow={openWindow}
          toggleWindow={toggleWindow}
          togglePinnedWindow={togglePinnedWindow}
        />
      </FlexCol>
    </WindowsLayerContext.Provider>
  );
};

export const useWindowsLayer = () => {
  return useContext(WindowsLayerContext);
};

export default WindowsLayerProvider;
