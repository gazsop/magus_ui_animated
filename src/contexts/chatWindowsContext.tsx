import { createContext, JSX } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import ChatWindowTemplate, { TChatWindowMessage } from "@components/ChatWindowTemplate";
import { Application } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";
import useRequest from "@hooks/request";
import { useSseSubscription } from "@hooks/sse";
import { IWindowsLayerWindowProps } from "@pages/WindowsLayer";
import { PageState } from "@/app/navigation";
import { formatClientDateTime } from "@/core/datetime";
import { applyWindowNotificationEvent } from "./uiReducers";
import { useWindowRegistry } from "./windowRegistryContext";
import { TSetState } from "@/utils/common";

export type TChatPolicy = {
  allowUserDirect: boolean;
  allowUserAllRoom: boolean;
};

type TChatTarget = { uid: string; name: string };
type TTypingUsersByTarget = Record<string, Record<string, number>>;
type TDirectMessage = { fromUid: string; toUid: string; text: string; createdAt: number };
type TPresenceEvent = { uid: string; createdAt: number; json: { state: string; createdAt: number } };
type TAllRoomMessage = ServerApi.ChatRoutes.AllRoomMessage;

const CHAT_TYPING_PING_INTERVAL_MS = 2500;
const CHAT_TYPING_VISIBLE_MS = 4000;
const LOGGED_IN_PAGES: PageState[] = [
  PageState.CHAR_SELECTION,
  PageState.CHAR_SHEET,
  PageState.ADMIN,
  PageState.DEV,
];
const YNEV_COORDINATE_PATTERN = /(x:\s*(-?\d+(?:\.\d+)?),\s*y:\s*(-?\d+(?:\.\d+)?))/i;

type TChatWindowsContext = {
  renderChatWindow: (
    uid: string,
    name: string,
    close: () => void,
    classes?: string
  ) => JSX.Element;
  openChatWindow: (
    uid: string,
    name: string,
    registerWindow: (windowDef: IWindowsLayerWindowProps) => void
  ) => void;
  windowUids: string[];
  getWindowDef: (uid: string) => IWindowsLayerWindowProps;
  target: TChatTarget | null;
};

const ChatWindowsContext = createContext<TChatWindowsContext | null>(null);

const buildChatWindowDef = (
  uid: string,
  name: string,
  hasNotification: boolean
): IWindowsLayerWindowProps => {
  const windowName = `CHAT:${uid}`;
  const iconText = (uid === "__all" ? "AL" : name.slice(0, 2)).toUpperCase();
  return {
    name: windowName,
    icon: <>{iconText}</>,
    hasNotification,
    defaultOpen: true,
    allowedPages: LOGGED_IN_PAGES,
    keepStateAcrossPages: true,
    launcherGroup: "chat",
    launcherVisible: false,
    descriptor: {
      id: windowName,
      kind: "chat",
      title: `Chat - ${name}`,
      icon: iconText,
      params: { uid, name },
      defaultOpen: true,
      allowedPages: LOGGED_IN_PAGES,
      keepStateAcrossPages: true,
      launcherGroup: "chat",
      launcherVisible: false,
    },
  };
};

export function ChatWindowsProvider({
  children,
  selfUid,
  activeAdventureId,
  isAdmin,
  chatPolicy,
  target,
  onTargetHandled,
  unreadByPeer,
  setUnreadByPeer,
}: {
  children: JSX.Element | JSX.Element[];
  selfUid: string;
  activeAdventureId: string;
  isAdmin: boolean;
  chatPolicy: TChatPolicy;
  target: TChatTarget | null;
  onTargetHandled: () => void;
  unreadByPeer: Record<string, number>;
  setUnreadByPeer: TSetState<Record<string, number>>;
}) {
  const [chatRequest] = useRequest(Application.REQUEST_CONTROLLER.CHAT);
  const [threads, setThreads] = useState<Record<string, TDirectMessage[]>>({});
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [presenceEvents, setPresenceEvents] = useState<TPresenceEvent[]>([]);
  const [allRoomMessages, setAllRoomMessages] = useState<TAllRoomMessage[]>([]);
  const [typingByTarget, setTypingByTarget] = useState<TTypingUsersByTarget>({});
  const typingPingRef = useRef<Record<string, number>>({});

  const openYnevAtCoordinates = (x: number, y: number) => {
    if (!activeAdventureId || !Number.isFinite(x) || !Number.isFinite(y)) return;
    window.dispatchEvent(
      new CustomEvent("ynev:jump", {
        detail: {
          advId: activeAdventureId,
          x,
          y,
          nonce: String(Date.now()),
        },
      })
    );
  };

  const renderAllRoomContent = (message: TAllRoomMessage) => {
    const match = YNEV_COORDINATE_PATTERN.exec(message.text);
    if (!match) return message.text;
    const full = match[1];
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return message.text;
    const before = message.text.slice(0, match.index);
    const after = message.text.slice(match.index + full.length);
    return (
      <>
        {before}
        <button
          type="button"
          className="underline text-sky-300 hover:text-sky-100"
          onClick={() => openYnevAtCoordinates(x, y)}
        >
          {full}
        </button>
        {after}
      </>
    );
  };

  const clearTypingUser = (targetUid: string, typingUid: string) => {
    setTypingByTarget((prev) => {
      const current = prev[targetUid];
      if (!current || !current[typingUid]) return prev;
      const nextUsers = { ...current };
      delete nextUsers[typingUid];
      const next = { ...prev };
      if (Object.keys(nextUsers).length > 0) next[targetUid] = nextUsers;
      else delete next[targetUid];
      return next;
    });
  };

  const pruneTypingState = (now = Date.now()) => {
    setTypingByTarget((prev) => {
      let changed = false;
      const next: TTypingUsersByTarget = {};
      Object.entries(prev).forEach(([targetUid, users]) => {
        const activeUsers: Record<string, number> = {};
        Object.entries(users).forEach(([uid, expiresAt]) => {
          if (expiresAt > now) activeUsers[uid] = expiresAt;
          else changed = true;
        });
        if (Object.keys(activeUsers).length > 0) next[targetUid] = activeUsers;
        else if (Object.keys(users).length > 0) changed = true;
      });
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    const timer = window.setInterval(() => pruneTypingState(), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadConversation = (withUid: string) => {
    if (!withUid) return;
    chatRequest<Array<{ json: TDirectMessage }>>({
      endPoint: "/getConversation",
      body: { withUid, limit: 100 },
      errorMode: "quiet",
    })
      .then((response) => {
        const messages = (response.data || []).map((row) => row.json);
        setThreads((prev) => ({ ...prev, [withUid]: messages }));
      })
      .catch(() => {});
  };

  const loadAllRoom = () => {
    if (!activeAdventureId) return;
    chatRequest<TAllRoomMessage[]>({
      endPoint: "/getAllRoom",
      body: { advId: activeAdventureId, limit: 100 },
      errorMode: "quiet",
    })
      .then((response) => setAllRoomMessages(response.data || []))
      .catch(() => {});
  };

  const loadPresenceEvents = () => {
    chatRequest<TPresenceEvent[]>({
      endPoint: "/getPresenceEvents",
      body: { limit: 50 },
      errorMode: "quiet",
    })
      .then((response) => setPresenceEvents(response.data || []))
      .catch(() => {});
  };

  const renderChatWindow = (
    uid: string,
    name: string,
    close: () => void,
    classes?: string
  ) => {
    const isWritable =
      isAdmin ||
      (uid === "__all"
        ? chatPolicy.allowUserAllRoom
        : chatPolicy.allowUserDirect || uid.toUpperCase() === "ADMIN");
    const typingUids = Object.keys(typingByTarget[uid] || {}).filter(
      (typingUid) => typingUid !== selfUid
    );
    const typingLabel =
      typingUids.length > 0
        ? typingUids.length === 1
          ? `${uid === "__all" ? typingUids[0] : name} is typing...`
          : `${typingUids.length} people are typing...`
        : null;
    const messages: TChatWindowMessage[] =
      uid === "__all"
        ? allRoomMessages.map((m) => ({
            id: m.id,
            author: m.uid === selfUid ? "Me" : m.uid,
            content: renderAllRoomContent(m),
            side: m.uid === selfUid ? "self" : "other",
          }))
        : (threads[uid] || []).map((m, idx) => ({
            id: `${m.createdAt}-${idx}`,
            author: m.fromUid === selfUid ? "Me" : name,
            content: m.text,
            side: m.fromUid === selfUid ? "self" : "other",
          }));
    const disabledNote = !isWritable
      ? uid === "__all"
        ? "All-room chat is read-only for users in this adventure."
        : "Direct user-to-user chat is disabled in this adventure."
      : null;
    const sendTypingPing = () => {
      if (!activeAdventureId || !isWritable) return;
      const now = Date.now();
      const typingKey = `${uid}:${uid === "__all" ? "all" : "direct"}`;
      if (now - (typingPingRef.current[typingKey] || 0) < CHAT_TYPING_PING_INTERVAL_MS) return;
      typingPingRef.current[typingKey] = now;
      chatRequest<ServerApi.ChatRoutes.TypingEvent, ServerApi.ChatRoutes.TypingBody>({
        endPoint: "/typing",
        errorMode: "quiet",
        body: {
          advId: activeAdventureId,
          targetUid: uid,
          room: uid === "__all" ? "all" : "direct",
        },
      }).catch(() => {});
    };

    return (
      <ChatWindowTemplate
        id={`chat-${uid}`}
        close={close}
        label={`Chat - ${name}`}
        classes={classes}
        messages={messages}
        emptyText={uid === "__all" ? "No all-room messages yet." : `No messages with ${name} yet.`}
        typingLabel={typingLabel}
        presenceLog={{
          title: "Presence log",
          actionLabel: "Last 50",
          onAction: loadPresenceEvents,
          emptyText: "No presence events loaded.",
          entries: presenceEvents.map((ev, idx) => ({
            id: `${ev.uid}-${ev.createdAt}-${idx}`,
            line: `${formatClientDateTime(ev.createdAt)} | ${ev.uid} | ${ev.json?.state || "-"}`,
          })),
        }}
        input={{
          disabled: !isWritable,
          onTyping: sendTypingPing,
          onSend: (text) => {
            if (!activeAdventureId || !isWritable) return;
            return chatRequest(
              uid === "__all"
                ? {
                    endPoint: "/sendAllRoom",
                    body: { advId: activeAdventureId, text },
                  }
                : {
                    endPoint: "/send",
                    body: { advId: activeAdventureId, toUid: uid, text },
                  }
            )
              .then(() => {
                if (uid === "__all") loadAllRoom();
              })
              .catch(() => {});
          },
        }}
        disabledNote={disabledNote}
      />
    );
  };

  const getWindowDef = (uid: string) => {
    const name = peerNames[uid] || (uid === "__all" ? "All Room" : uid);
    return buildChatWindowDef(uid, name, (unreadByPeer[uid] || 0) > 0);
  };

  const openChatWindow = (
    uid: string,
    name: string,
    registerWindow: (windowDef: IWindowsLayerWindowProps) => void
  ) => {
    setPeerNames((prev) => ({ ...prev, [uid]: name }));
    setUnreadByPeer((prev) => applyWindowNotificationEvent(prev, uid, 0));
    registerWindow(buildChatWindowDef(uid, name, (unreadByPeer[uid] || 0) > 0));
    if (!activeAdventureId) return;
    if (uid === "__all") loadAllRoom();
    else loadConversation(uid);
    onTargetHandled();
  };

  useSseSubscription("chat:message", (event) => {
    const payload = (event.payload || {}) as {
      fromUid?: string;
      toUid?: string;
      text?: string;
      createdAt?: number;
    };
    const fromUid = String(payload.fromUid || "");
    const toUid = String(payload.toUid || "");
    if (!selfUid || (fromUid !== selfUid && toUid !== selfUid)) return;
    const peerUid = fromUid === selfUid ? toUid : fromUid;
    if (!peerUid) return;
    setThreads((prev) => ({
      ...prev,
      [peerUid]: [
        ...(prev[peerUid] || []),
        {
          fromUid,
          toUid,
          text: String(payload.text || ""),
          createdAt: Number(payload.createdAt || Date.now()),
        },
      ],
    }));
    clearTypingUser(peerUid, fromUid);
    if (fromUid !== selfUid) {
      setUnreadByPeer((prev) =>
        applyWindowNotificationEvent(prev, peerUid, (prev[peerUid] || 0) + 1)
      );
    }
  });

  useSseSubscription("chat:allRoom", (event) => {
    const payload = (event.payload || {}) as {
      id?: string;
      uid?: string;
      text?: string;
      createdAt?: number;
      sourceType?: ServerApi.ChatRoutes.AllRoomEventSourceType;
      sourceId?: string;
    };
    const uid = String(payload.uid || "");
    if (!uid) return;
    setAllRoomMessages((prev) => [
      ...prev,
      {
        id: String(payload.id || `${uid}-${Date.now()}`),
        uid,
        text: String(payload.text || ""),
        createdAt: Number(payload.createdAt || Date.now()),
        ...(payload.sourceType ? { sourceType: payload.sourceType } : {}),
        ...(payload.sourceId ? { sourceId: String(payload.sourceId) } : {}),
      },
    ]);
    clearTypingUser("__all", uid);
    if (uid !== selfUid) {
      setUnreadByPeer((prev) =>
        applyWindowNotificationEvent(prev, "__all", (prev.__all || 0) + 1)
      );
    }
  });

  useSseSubscription("chat:typing", (event) => {
    const payload = (event.payload || {}) as Partial<ServerApi.ChatRoutes.TypingEvent>;
    const fromUid = String(payload.fromUid || "");
    const targetUid = String(payload.targetUid || "");
    const room = payload.room === "all" ? "all" : "direct";
    const eventAdvId = String(payload.advId || "");
    if (!fromUid || fromUid === selfUid || !targetUid || eventAdvId !== activeAdventureId) return;
    if (room === "direct" && targetUid !== selfUid) return;
    const windowUid = room === "all" ? "__all" : fromUid;
    setTypingByTarget((prev) => ({
      ...prev,
      [windowUid]: {
        ...(prev[windowUid] || {}),
        [fromUid]: Date.now() + CHAT_TYPING_VISIBLE_MS,
      },
    }));
  });

  const windowUids = Array.from(
    new Set<string>([...Object.keys(threads), ...Object.keys(peerNames), "__all"])
  );

  return (
    <ChatWindowsContext.Provider
      value={{ renderChatWindow, openChatWindow, windowUids, getWindowDef, target }}
    >
      {children}
    </ChatWindowsContext.Provider>
  );
}

export function useChatWindows() {
  const ctx = useContext(ChatWindowsContext);
  if (!ctx) {
    throw new Error("useChatWindows must be used inside ChatWindowsProvider");
  }
  return ctx;
}

export function ChatWindowRegistryBridge() {
  const { registerWindow, updateWindow } = useWindowRegistry();
  const { target, openChatWindow, windowUids, getWindowDef } = useChatWindows();
  const handledTargetRef = useRef("");

  useEffect(() => {
    if (!target?.uid) {
      handledTargetRef.current = "";
      return;
    }
    const targetKey = `${target.uid}:${target.name}`;
    if (handledTargetRef.current === targetKey) return;
    handledTargetRef.current = targetKey;
    openChatWindow(target.uid, target.name, registerWindow);
  }, [target?.uid, target?.name, openChatWindow, registerWindow]);

  useEffect(() => {
    windowUids.forEach((uid) => {
      updateWindow(`CHAT:${uid}`, getWindowDef(uid));
    });
  }, [windowUids, getWindowDef, updateWindow]);

  return null;
}

export function ChatDescriptorWindow({
  uid,
  name,
  close,
  classes,
}: {
  uid: string;
  name: string;
  close: () => void;
  classes?: string;
}) {
  const { renderChatWindow } = useChatWindows();
  return renderChatWindow(uid, name, close, classes);
}
