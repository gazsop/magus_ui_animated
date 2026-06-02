import { JSX } from "preact";
import { memo, useMemo } from "preact/compat";
import { FlexCol, FlexRow } from "@components/Flex";
import {
  IOnlineUserBadge,
  IWindowsLayerShortcut,
  TWindowLauncherGroup,
  TWindowState,
} from "./windowTypes";

type TLauncherButtonProps = {
  keyId: string;
  title: string;
  children: JSX.Element | JSX.Element[] | string;
  className?: string;
  style?: JSX.CSSProperties;
  onClick?: () => void;
  onContextMenu?: (e: JSX.TargetedMouseEvent<HTMLDivElement>) => void;
  notification?: boolean;
  pinned?: boolean;
};

const LauncherButton = (props: TLauncherButtonProps) => (
  <FlexRow
    key={props.keyId}
    className={`fancy-container h-[35px] m-0.5 cursor-pointer items-center pl-2 relative select-none ${
      props.className ?? ""
    }`}
    style={{ borderRadius: "17px 0px 0px 17px", ...(props.style ?? {}) }}
    onClick={props.onClick}
    onContextMenu={props.onContextMenu}
    title={props.title}
  >
    {props.children}
    {props.pinned ? (
      <span
        className="absolute bottom-[4px] right-[4px] text-[10px] leading-none"
        title="Pinned"
      >
        P
      </span>
    ) : null}
    {props.notification ? (
      <span
        className="absolute top-[4px] right-[4px] w-2 h-2 rounded-full bg-red-500"
        title="New message"
      />
    ) : null}
  </FlexRow>
);

export const PresenceBar = memo(function PresenceBar(props: {
  onlineUsers: IOnlineUserBadge[];
  windows: TWindowState[];
  toggleOrOpenWindow: (name: string, fallbackOpen?: () => void) => void;
}) {
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
          <LauncherButton
            key={`${onlineUser.uid}-online-badge`}
            keyId={`${onlineUser.uid}-online-badge`}
            className={`justify-center font-bold text-xs ${statusClass}`}
            style={onlineUser.style}
            title={`${onlineUser.name} (${statusLabel})`}
            onClick={() => {
              if (onlineUser.windowName) {
                props.toggleOrOpenWindow(onlineUser.windowName, onlineUser.onClick);
                return;
              }
              onlineUser.onClick?.();
            }}
            notification={onlineUser.hasNotification}
          >
            {onlineUser.name.slice(0, 2).toUpperCase()}
          </LauncherButton>
        );
      })}
    </FlexCol>
  );
});

export const LauncherBar = memo(function LauncherBar(props: {
  shortcuts: IWindowsLayerShortcut[];
  windows: TWindowState[];
  groups?: TWindowLauncherGroup[];
  toggleOrOpenWindow: (name: string) => void;
  togglePinnedWindow: (name: string) => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<TWindowLauncherGroup, {
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
      {(props.groups ?? ["chat", "page", "admin", "general"])
        .filter((group) => {
          const segment = grouped[group];
          return segment.shortcuts.length > 0 || segment.windows.length > 0;
        })
        .map((group, index, sections) => {
          const segment = grouped[group];
          return (
            <div key={`launcher-group-${group}`}>
              {segment.shortcuts.map((shortcut) => (
                <LauncherButton
                  key={`${shortcut.name}-shortcut`}
                  keyId={`${shortcut.name}-shortcut`}
                  className={shortcut.className}
                  style={shortcut.style}
                  onClick={shortcut.onClick}
                  title={shortcut.name}
                >
                  {shortcut.icon}
                </LauncherButton>
              ))}
              {segment.windows.map((windowElem) => (
                <LauncherButton
                  key={`${windowElem.name}-launcher`}
                  keyId={`${windowElem.name}-launcher`}
                  title={
                    windowElem.basePersistentLauncher
                      ? windowElem.name
                      : `${windowElem.name} (right click to ${
                          windowElem.persistentLauncher ? "unpin" : "pin"
                        })`
                  }
                  onClick={() => props.toggleOrOpenWindow(windowElem.name)}
                  onContextMenu={(e) => {
                    if (windowElem.basePersistentLauncher) return;
                    e.preventDefault();
                    e.stopPropagation();
                    props.togglePinnedWindow(windowElem.name);
                  }}
                  notification={windowElem.hasNotification}
                  pinned={Boolean(windowElem.persistentLauncher && !windowElem.basePersistentLauncher)}
                >
                  {windowElem.icon}
                </LauncherButton>
              ))}
              {index < sections.length - 1 ? <GroupDivider /> : null}
            </div>
          );
        })}
    </FlexCol>
  );
});
