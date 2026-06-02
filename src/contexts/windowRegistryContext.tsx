import { JSX, createContext, useContext, useMemo } from "preact/compat";
import {
  IWindowsLayerWindowProps,
  WindowsLayerProvider,
  useWindowsLayer,
  IWindowsLayerShortcut,
  IOnlineUserBadge,
} from "@/pages/WindowsLayer";
import { PageState } from "@/app/navigation";

interface IWindowRegistryContext {
  registerWindow: (windowElem: IWindowsLayerWindowProps) => void;
  unregisterWindow: (windowName: string) => void;
  updateWindow: (windowName: string, windowElem: IWindowsLayerWindowProps) => void;
  toggleWindow: (windowName: string, fallbackWindow?: IWindowsLayerWindowProps) => void;
}

const WindowRegistryContext = createContext<IWindowRegistryContext | null>(null);

function WindowRegistryBridge(props: { children: JSX.Element | JSX.Element[] }) {
  const { addWindow, removeWindow, updateWindow, toggleWindow } = useWindowsLayer();
  const value = useMemo(
    () => ({
      registerWindow: addWindow,
      unregisterWindow: removeWindow,
      updateWindow,
      toggleWindow,
    }),
    [addWindow, removeWindow, updateWindow, toggleWindow]
  );
  return <WindowRegistryContext.Provider value={value}>{props.children}</WindowRegistryContext.Provider>;
}

export function WindowRegistryProvider(props: {
  children: JSX.Element | JSX.Element[];
  windows?: IWindowsLayerWindowProps[];
  shortcuts?: IWindowsLayerShortcut[];
  onlineUsers?: IOnlineUserBadge[];
  currentPage: PageState;
}) {
  return (
    <WindowsLayerProvider
      windows={props.windows}
      shortcuts={props.shortcuts}
      onlineUsers={props.onlineUsers}
      currentPage={props.currentPage}
    >
      <WindowRegistryBridge>{props.children}</WindowRegistryBridge>
    </WindowsLayerProvider>
  );
}

export function useWindowRegistry() {
  const ctx = useContext(WindowRegistryContext);
  if (!ctx) throw new Error("useWindowRegistry must be used inside WindowRegistryProvider");
  return ctx;
}
