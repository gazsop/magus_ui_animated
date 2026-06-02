import { createContext, useContext, JSX, useMemo, useCallback, useEffect, useReducer, useState } from "preact/compat";
import { FlexCol } from "@components/Flex";
import { RndWindowControlsContext } from "@components/RndContainer";
import { PageState } from "@/app/navigation";
import { WindowDescriptorRenderer } from "@/windows/windowDescriptorRenderers";
import {
  IOnlineUserBadge,
  IWindowsLayerShortcut,
  TWindowRegistration,
  TWindowState,
} from "@/windows/windowTypes";
import {
  buildInitialWindowState,
  getVisibleWindows,
  windowsReducer,
} from "@/windows/windowState";
import {
  readPinnedWindowRecords,
  writePinnedWindowRecords,
} from "@/windows/windowStorage";
import { LauncherBar, PresenceBar } from "@/windows/WindowLaunchers";

export type IWindowsLayerWindowProps = TWindowRegistration;
export type { IOnlineUserBadge, IWindowsLayerShortcut };

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

const WindowsCanvas = (props: {
  windows: TWindowState[];
  selectedWindow: string;
  removeWindow: (name: string) => void;
  minimizeWindow: (name: string) => void;
  selectWindow: (name: string) => void;
}) => {
  const { windows, selectedWindow, removeWindow, minimizeWindow, selectWindow } = props;
  return (
    <>
      {windows.map((windowElem, index) => {
        if (!windowElem || !windowElem.isOpen) return null;
        const isSelected = selectedWindow === windowElem.name;
        const zIndex = isSelected ? 27 : Math.min(26, 12 + index);
        return (
          <div key={windowElem.name}>
            <RndWindowControlsContext.Provider
              value={{
                minimize: () => minimizeWindow(windowElem.name),
                selectWindow: () => selectWindow(windowElem.name),
                zIndex,
              }}
            >
              <WindowDescriptorRenderer
                descriptor={windowElem.descriptor}
                renderProps={{
                  close: () => removeWindow(windowElem.name),
                  minimize: () => minimizeWindow(windowElem.name),
                  selectWindow: () => selectWindow(windowElem.name),
                  zIndex,
                  classes: isSelected ? "z-50" : "z-10",
                }}
              />
            </RndWindowControlsContext.Provider>
          </div>
        );
      })}
    </>
  );
};

export const WindowsLayerProvider = (props: {
  children: JSX.Element | JSX.Element[];
  windows?: IWindowsLayerWindowProps[];
  shortcuts?: IWindowsLayerShortcut[];
  onlineUsers?: IOnlineUserBadge[];
  currentPage: PageState;
}) => {
  const [pinnedWindowRecords, setPinnedWindowRecords] = useState(() =>
    readPinnedWindowRecords()
  );
  const [state, dispatch] = useReducer(
    windowsReducer,
    null,
    () => buildInitialWindowState(props.windows ?? [], readPinnedWindowRecords())
  );

  const visibleWindows = useMemo(
    () => getVisibleWindows(state, props.currentPage),
    [state, props.currentPage]
  );

  const addWindow = useCallback((windowElem: IWindowsLayerWindowProps) => {
    dispatch({
      type: "register",
      window: windowElem,
      pinnedRecords: pinnedWindowRecords,
    });
  }, [pinnedWindowRecords]);

  const removeWindow = useCallback((windowName: string) => {
    dispatch({ type: "close", name: windowName });
  }, []);

  const updateWindow = useCallback((windowName: string, windowElem: IWindowsLayerWindowProps) => {
    dispatch({ type: "update", name: windowName, window: windowElem });
  }, []);

  const minimizeWindow = useCallback((name: string) => {
    dispatch({ type: "minimize", name });
  }, []);

  const selectWindow = useCallback((name: string) => {
    dispatch({ type: "select", name });
  }, []);

  const toggleOrOpenWindow = useCallback((name: string, fallbackOpen?: () => void) => {
    const current = visibleWindows.find((windowElem) => windowElem.name === name);
    if (!current) {
      fallbackOpen?.();
      return;
    }
    dispatch({ type: current.isOpen ? "toggle" : "open", name });
  }, [visibleWindows]);

  const togglePinnedWindow = useCallback((name: string) => {
    setPinnedWindowRecords((prev) => {
      const current = state.windows.find((windowElem) => windowElem.name === name);
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
      dispatch({ type: "applyPinned", pinnedRecords: next });
      return next;
    });
  }, [state.windows]);

  useEffect(() => {
    dispatch({ type: "applyPinned", pinnedRecords: pinnedWindowRecords });
  }, [pinnedWindowRecords]);

  useEffect(() => {
    (props.windows ?? []).forEach((windowElem) => {
      dispatch({
        type: "register",
        window: windowElem,
        pinnedRecords: pinnedWindowRecords,
        basePersistentLauncher: true,
        openOnRegister: false,
      });
    });
  }, [props.windows, pinnedWindowRecords]);

  useEffect(() => {
    dispatch({ type: "applyPage", currentPage: props.currentPage });
  }, [props.currentPage]);

  useEffect(() => {
    const selectedWindow = state.selectedWindow;
    if (!selectedWindow) return;
    if (visibleWindows.some((windowElem) => windowElem.name === selectedWindow)) return;
    dispatch({ type: "select", name: "" });
  }, [state.selectedWindow, visibleWindows]);

  const contextValue = useMemo(
    () => ({ addWindow, removeWindow, updateWindow }),
    [addWindow, removeWindow, updateWindow]
  );

  const shortcuts = props.shortcuts ?? [];
  const onlineUsers = props.onlineUsers ?? [];

  return (
    <WindowsLayerContext.Provider value={contextValue}>
      {props.children}
      <WindowsCanvas
        windows={visibleWindows}
        selectedWindow={state.selectedWindow}
        removeWindow={removeWindow}
        minimizeWindow={minimizeWindow}
        selectWindow={selectWindow}
      />
      <FlexCol
        className="fixed top-[10vh] bg-transparent w-10 sm:right-0 right-[10px] gap-1"
        style={{ zIndex: "var(--layer-window-icons)" }}
      >
        <PresenceBar
          onlineUsers={onlineUsers}
          windows={visibleWindows}
          toggleOrOpenWindow={toggleOrOpenWindow}
        />
        <LauncherBar
          shortcuts={shortcuts}
          windows={visibleWindows}
          groups={["chat"]}
          toggleOrOpenWindow={toggleOrOpenWindow}
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
          toggleOrOpenWindow={toggleOrOpenWindow}
          togglePinnedWindow={togglePinnedWindow}
        />
      </FlexCol>
    </WindowsLayerContext.Provider>
  );
};

export const useWindowsLayer = () => useContext(WindowsLayerContext);

export default WindowsLayerProvider;
