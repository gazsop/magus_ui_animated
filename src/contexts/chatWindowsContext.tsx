import { createContext, JSX } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import ChatReferenceText, { createChatReferenceToken } from "@components/ChatReferenceText";
import ChatWindowTemplate, {
  TChatReferenceSuggestion,
  TChatWindowMessage,
} from "@components/ChatWindowTemplate";
import PlayerTradeModal from "@components/PlayerTradeModal";
import { Application } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";
import useRequest from "@hooks/request";
import { useLiveEventSubscription } from "@hooks/liveEvents";
import { IWindowsLayerWindowProps } from "@pages/WindowsLayer";
import { PageState } from "@/app/navigation";
import { formatClientDateTime, formatClientTime } from "@/core/datetime";
import { applyWindowNotificationEvent } from "./uiReducers";
import { useWindowRegistry } from "./windowRegistryContext";
import { TSetState } from "@/utils/common";
import { defineWindowRegistration } from "@/windows/windowFactory";

export type TChatPolicy = {
  allowUserDirect: boolean;
  allowUserAllRoom: boolean;
};

type TChatTarget = { uid: string; name: string };
type TTypingUsersByTarget = Record<string, Record<string, number>>;
type TDirectMessage = { id?: string; advId?: string; fromUid: string; toUid: string; text: string; createdAt: number };
type TPresenceEvent = { uid: string; createdAt: number; json: { state: string; createdAt: number } };
type TAllRoomMessage = ServerApi.ChatRoutes.AllRoomMessage & { advId?: string };

const CHAT_TYPING_PING_INTERVAL_MS = 2500;
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
  return defineWindowRegistration({
    id: windowName,
    name: windowName,
    kind: "chat",
    title: `Chat - ${name}`,
    icon: iconText,
    params: { uid, name },
    hasNotification,
    defaultOpen: true,
    allowedPages: LOGGED_IN_PAGES,
    keepStateAcrossPages: true,
    launcherGroup: "chat",
    launcherVisible: false,
  });
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
  const [characterRequest] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [threads, setThreads] = useState<Record<string, TDirectMessage[]>>({});
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [presenceEvents, setPresenceEvents] = useState<TPresenceEvent[]>([]);
  const [allRoomMessages, setAllRoomMessages] = useState<TAllRoomMessage[]>([]);
  const [draftsByTarget, setDraftsByTarget] = useState<Record<string, string>>({});
  const [focusKeyByTarget, setFocusKeyByTarget] = useState<Record<string, number>>({});
  const [referenceSuggestionsByTarget, setReferenceSuggestionsByTarget] = useState<
    Record<string, TChatReferenceSuggestion[]>
  >({});
  const [typingByTarget, setTypingByTarget] = useState<TTypingUsersByTarget>({});
  const [activeTrade, setActiveTrade] =
    useState<ServerApi.CharacterRoutes.PlayerTradeState | null>(null);
  const [activeTradePeerName, setActiveTradePeerName] = useState("");
  const typingPingRef = useRef<Record<string, number>>({});
  const chatEventKeysRef = useRef<Set<string>>(new Set());
  const referenceSearchTimerRef = useRef<Record<string, number>>({});

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
    if (/@\[[^\]]+\]\(chatref:/.test(message.text)) {
      return (
        <ChatReferenceText
          text={message.text}
          onYnevJump={openYnevAtCoordinates}
        />
      );
    }
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

  const renderDirectContent = (text: string) => {
    if (!/@\[[^\]]+\]\(chatref:/.test(text)) return text;
    return <ChatReferenceText text={text} onYnevJump={openYnevAtCoordinates} />;
  };

  const applyPlayerTradeResponse = (
    response: Partial<ServerApi.CharacterRoutes.PlayerTradeResponse>
  ) => {
    const trade = response.trade;
    if (!trade || !trade.participants[selfUid]) return;
    if (trade.status === "cancelled") {
      setActiveTrade(null);
      return;
    }
    const peerUid = trade.fromUid === selfUid ? trade.toUid : trade.fromUid;
    setPeerNames((prev) => ({ ...prev, [peerUid]: prev[peerUid] || peerUid }));
    setActiveTradePeerName((prev) => prev || peerNames[peerUid] || peerUid);
    setActiveTrade(trade);
  };

  const createPlayerTrade = async (toUid: string, name: string) => {
    if (!activeAdventureId || !toUid || toUid === "__all") return;
    const response = await characterRequest<ServerApi.CharacterRoutes.PlayerTradeResponse>({
      endPoint: "/trade/create",
      body: { advId: activeAdventureId, toUid },
    });
    setActiveTradePeerName(name);
    applyPlayerTradeResponse(response.data);
  };

  const updatePlayerTradeOffer = async (
    tradeId: string,
    offer: ServerApi.CharacterRoutes.PlayerTradeOffer
  ) => {
    if (!activeAdventureId) return;
    const response = await characterRequest<ServerApi.CharacterRoutes.PlayerTradeResponse>({
      endPoint: "/trade/updateOffer",
      body: { advId: activeAdventureId, tradeId, offer },
    });
    applyPlayerTradeResponse(response.data);
  };

  const acceptPlayerTrade = async (tradeId: string) => {
    if (!activeAdventureId) return;
    const response = await characterRequest<ServerApi.CharacterRoutes.PlayerTradeResponse>({
      endPoint: "/trade/accept",
      body: { advId: activeAdventureId, tradeId },
    });
    applyPlayerTradeResponse(response.data);
  };

  const closePlayerTrade = async (tradeId: string) => {
    if (!activeAdventureId) return;
    const response = await characterRequest<ServerApi.CharacterRoutes.PlayerTradeResponse>({
      endPoint: "/trade/close",
      body: { advId: activeAdventureId, tradeId },
    });
    applyPlayerTradeResponse(response.data);
    setActiveTrade(null);
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

  const markChatEventSeen = (type: string, payload: { id?: unknown; createdAt?: unknown; fromUid?: unknown; toUid?: unknown; uid?: unknown; text?: unknown }) => {
    const key = payload.id
      ? `${type}:${String(payload.id)}`
      : `${type}:${String(payload.fromUid || payload.uid || "")}:${String(payload.toUid || "")}:${String(payload.createdAt || "")}:${String(payload.text || "")}`;
    if (chatEventKeysRef.current.has(key)) return false;
    chatEventKeysRef.current.add(key);
    if (chatEventKeysRef.current.size > 1000) {
      chatEventKeysRef.current = new Set(Array.from(chatEventKeysRef.current).slice(-500));
    }
    return true;
  };

  const applyChatMessageEvent = (payload: {
    id?: string;
    advId?: string;
    fromUid?: string;
    toUid?: string;
    text?: string;
    createdAt?: number;
  }) => {
    const eventAdvId = String(payload.advId || activeAdventureId || "");
    if (eventAdvId && activeAdventureId && eventAdvId !== activeAdventureId) return;
    const fromUid = String(payload.fromUid || "");
    const toUid = String(payload.toUid || "");
    if (!selfUid || (fromUid !== selfUid && toUid !== selfUid)) return;
    if (!markChatEventSeen("chat:message", payload)) return;
    const peerUid = fromUid === selfUid ? toUid : fromUid;
    if (!peerUid) return;
    setThreads((prev) => {
      const messageId = payload.id ? String(payload.id) : "";
      const current = prev[peerUid] || [];
      if (messageId && current.some((message) => message.id === messageId)) return prev;
      return {
        ...prev,
        [peerUid]: [
          ...current,
          {
            id: messageId || undefined,
            advId: eventAdvId,
            fromUid,
            toUid,
            text: String(payload.text || ""),
            createdAt: Number(payload.createdAt || Date.now()),
          },
        ],
      };
    });
    clearTypingUser(peerUid, fromUid);
    if (fromUid !== selfUid) {
      setUnreadByPeer((prev) =>
        applyWindowNotificationEvent(prev, peerUid, (prev[peerUid] || 0) + 1)
      );
    }
  };

  const applyAllRoomEvent = (payload: {
    id?: string;
    advId?: string;
    uid?: string;
    text?: string;
    createdAt?: number;
    sourceType?: ServerApi.ChatRoutes.AllRoomSourceType;
    sourceId?: string;
  }) => {
    const eventAdvId = String(payload.advId || activeAdventureId || "");
    if (eventAdvId && activeAdventureId && eventAdvId !== activeAdventureId) return;
    const uid = String(payload.uid || "");
    if (!uid) return;
    if (!markChatEventSeen("chat:allRoom", payload)) return;
    setAllRoomMessages((prev) => {
      const messageId = String(payload.id || `${uid}-${Date.now()}`);
      if (messageId && prev.some((message) => message.id === messageId)) return prev;
      return [
        ...prev,
        {
          id: messageId,
          advId: eventAdvId,
          uid,
          text: String(payload.text || ""),
          createdAt: Number(payload.createdAt || Date.now()),
          ...(payload.sourceType ? { sourceType: payload.sourceType } : {}),
          ...(payload.sourceId ? { sourceId: String(payload.sourceId) } : {}),
        },
      ];
    });
    clearTypingUser("__all", uid);
    if (uid !== selfUid) {
      setUnreadByPeer((prev) =>
        applyWindowNotificationEvent(prev, "__all", (prev.__all || 0) + 1)
      );
    }
  };

  const applyAllRoomDeletedEvent = (payload: Partial<ServerApi.ChatRoutes.AllRoomDeletedEvent>) => {
    const eventAdvId = String(payload.advId || activeAdventureId || "");
    if (eventAdvId && activeAdventureId && eventAdvId !== activeAdventureId) return;
    const messageId = String(payload.messageId || "");
    if (!messageId) return;
    setAllRoomMessages((prev) => {
      const next = prev.filter((message) => message.id !== messageId);
      return next.length === prev.length ? prev : next;
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
        const messages = (response.data || []).map((row) => ({
          ...row.json,
          id: (row as { id?: string }).id,
        }));
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

  const deleteAllRoomMessage = (messageId: string) => {
    if (!isAdmin || !activeAdventureId || !messageId) return;
    chatRequest<ServerApi.ChatRoutes.AllRoomDeletedEvent, ServerApi.ChatRoutes.DeleteAllRoomBody>({
      endPoint: "/deleteAllRoom",
      body: { advId: activeAdventureId, messageId },
      errorMode: "quiet",
    })
      .then(() => {
        setAllRoomMessages((prev) => prev.filter((message) => message.id !== messageId));
      })
      .catch(() => {});
  };

  const markChatRead = (uid: string) => {
    setUnreadByPeer((prev) => applyWindowNotificationEvent(prev, uid, 0));
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
            author: m.uid === selfUid ? "" : m.uid,
            content: renderAllRoomContent(m),
            side: m.uid === selfUid ? "self" : "other",
            timestamp: formatClientTime(m.createdAt),
            timestampTitle: formatClientDateTime(m.createdAt),
            onDelete: isAdmin ? () => deleteAllRoomMessage(m.id) : undefined,
          }))
        : (threads[uid] || []).map((m, idx) => ({
            id: `${m.createdAt}-${idx}`,
            author: m.fromUid === selfUid ? "" : name,
            content: renderDirectContent(m.text),
            side: m.fromUid === selfUid ? "self" : "other",
            timestamp: formatClientTime(m.createdAt),
            timestampTitle: formatClientDateTime(m.createdAt),
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
    const draftValue = draftsByTarget[uid] || "";
    const setDraftValue = (value: string) => {
      setDraftsByTarget((prev) => ({ ...prev, [uid]: value }));
    };
    const clearReferenceSuggestions = () => {
      setReferenceSuggestionsByTarget((prev) => {
        if (!prev[uid]) return prev;
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    };
    const withJotunderSuggestion = (
      query: string,
      results: ServerApi.ChatRoutes.ChatReferenceSearchResult[]
    ): TChatReferenceSuggestion[] => {
      if (uid !== "__all") return results;
      const normalized = query.trim().toLocaleLowerCase("hu-HU");
      if (!normalized || !"jotunder".startsWith(normalized)) return results;
      return [
        {
          kind: "command",
          id: "jotunder",
          label: "@jotunder",
          description: "Jó tündér keresztanya megszólítása",
        },
        ...results,
      ];
    };
    const searchReferences = (query: string) => {
      const normalized = query.trim();
      window.clearTimeout(referenceSearchTimerRef.current[uid]);
      if (!normalized) {
        clearReferenceSuggestions();
        return;
      }
      const immediateSuggestions = withJotunderSuggestion(normalized, []);
      if (immediateSuggestions.length > 0) {
        setReferenceSuggestionsByTarget((prev) => ({
          ...prev,
          [uid]: immediateSuggestions,
        }));
      }
      referenceSearchTimerRef.current[uid] = window.setTimeout(() => {
        chatRequest<
          ServerApi.ChatRoutes.ChatReferenceSearchResponse,
          ServerApi.ChatRoutes.ChatReferenceSearchBody
        >({
          endPoint: "/searchReferences",
          body: { query: normalized, limit: 8 },
          errorMode: "quiet",
        })
          .then((response) => {
            setReferenceSuggestionsByTarget((prev) => ({
              ...prev,
              [uid]: withJotunderSuggestion(normalized, response.data.results || []),
            }));
          })
          .catch(() => {
            if (immediateSuggestions.length === 0) clearReferenceSuggestions();
          });
      }, 160);
    };
    const insertChatReference = (
      result: TChatReferenceSuggestion,
      mention: { start: number; end: number }
    ) => {
      if (result.kind === "command") {
        if (result.id !== "jotunder") return;
        const token = "@jotunder";
        setDraftsByTarget((prev) => {
          const current = prev[uid] || "";
          const next = `${current.slice(0, mention.start)}${token}${current.slice(mention.end)}`;
          return { ...prev, [uid]: next };
        });
        clearReferenceSuggestions();
        setFocusKeyByTarget((prev) => ({ ...prev, [uid]: (prev[uid] || 0) + 1 }));
        return;
      }
      const token = createChatReferenceToken(result);
      setDraftsByTarget((prev) => {
        const current = prev[uid] || "";
        const next = `${current.slice(0, mention.start)}${token}${current.slice(mention.end)}`;
        return { ...prev, [uid]: next };
      });
      clearReferenceSuggestions();
      setFocusKeyByTarget((prev) => ({ ...prev, [uid]: (prev[uid] || 0) + 1 }));
    };
    const insertJotunderMention = () => {
      setDraftsByTarget((prev) => {
        const current = prev[uid] || "";
        if (/@jotunder\b/i.test(current)) return prev;
        const nextValue = current.trim()
          ? `${current.trimEnd()} @jotunder`
          : "@jotunder";
        return { ...prev, [uid]: nextValue };
      });
      setFocusKeyByTarget((prev) => ({ ...prev, [uid]: (prev[uid] || 0) + 1 }));
    };

    return (
      <ChatWindowTemplate
        id={`chat-${uid}`}
        close={close}
        label={`Chat - ${name}`}
        classes={classes}
        messages={messages}
        onRead={() => markChatRead(uid)}
        emptyText={uid === "__all" ? "No all-room messages yet." : `No messages with ${name} yet.`}
        typingLabel={typingLabel}
        presenceLog={
          uid === "__all"
            ? undefined
            : {
                title: "Jelenléti krónika",
                actionLabel: "Last 50",
                onAction: loadPresenceEvents,
                emptyText: "No presence events loaded.",
                entries: presenceEvents.map((ev, idx) => ({
                  id: `${ev.uid}-${ev.createdAt}-${idx}`,
                  line: `${formatClientDateTime(ev.createdAt)} | ${ev.uid} | ${ev.json?.state || "-"}`,
                })),
              }
        }
        input={{
          value: draftValue,
          disabled: !isWritable,
          focusKey: focusKeyByTarget[uid],
          onTyping: sendTypingPing,
          onInput: setDraftValue,
          referenceSuggestions: referenceSuggestionsByTarget[uid] || [],
          onReferenceQuery: searchReferences,
          onReferenceSelect: insertChatReference,
          beforeSendAction:
            uid === "__all" ? (
              <button
                type="button"
                className="fancy-container px-2 text-xs"
                disabled={!isWritable}
                onClick={insertJotunderMention}
              >
                @jotunder
              </button>
            ) : null,
          afterSendAction:
            uid !== "__all" && activeAdventureId ? (
              <button
                type="button"
                className="fancy-container px-2 text-xs"
                disabled={!isWritable}
                onClick={() => void createPlayerTrade(uid, name)}
              >
                Trade
              </button>
            ) : null,
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
                setDraftValue("");
                clearReferenceSuggestions();
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

  useLiveEventSubscription("chat:message", (event) => {
    applyChatMessageEvent((event.payload || {}) as Parameters<typeof applyChatMessageEvent>[0]);
  });

  useLiveEventSubscription("chat:allRoom", (event) => {
    applyAllRoomEvent((event.payload || {}) as Parameters<typeof applyAllRoomEvent>[0]);
  });

  useLiveEventSubscription("chat:allRoomDeleted", (event) => {
    applyAllRoomDeletedEvent((event.payload || {}) as Parameters<typeof applyAllRoomDeletedEvent>[0]);
  });

  useLiveEventSubscription("chat:typing", (event) => {
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
        [fromUid]: Date.now() + 4000,
      },
    }));
  });

  useLiveEventSubscription("playerTrade:updated", (event) => {
    const payload = (event.payload || {}) as Partial<ServerApi.CharacterRoutes.PlayerTradeResponse>;
    if (String(payload.trade?.advId || "") !== activeAdventureId) return;
    applyPlayerTradeResponse(payload);
  });

  useLiveEventSubscription("playerTrade:completed", (event) => {
    const payload = (event.payload || {}) as Partial<ServerApi.CharacterRoutes.PlayerTradeResponse>;
    if (String(payload.trade?.advId || "") !== activeAdventureId) return;
    applyPlayerTradeResponse(payload);
  });

  const windowUids = Array.from(
    new Set<string>([...Object.keys(threads), ...Object.keys(peerNames), "__all"])
  );

  return (
    <ChatWindowsContext.Provider
      value={{ renderChatWindow, openChatWindow, windowUids, getWindowDef, target }}
    >
      {children}
      {activeTrade ? (
        <PlayerTradeModal
          advId={activeAdventureId}
          selfUid={selfUid}
          peerName={activeTradePeerName || "Player"}
          trade={activeTrade}
          onUpdateOffer={updatePlayerTradeOffer}
          onAccept={acceptPlayerTrade}
          onClose={closePlayerTrade}
        />
      ) : null}
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
