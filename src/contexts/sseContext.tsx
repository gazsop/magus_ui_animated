import { createContext, JSX, useContext, useMemo, useRef } from "preact/compat";
import { ServerApi } from "@shared/contracts";
import { API_BASE_URL } from "../core/config/runtime";

type TSseScope = "global" | "adventure";
type TSseEnvelope = {
  type: string;
  scope: TSseScope;
  advId?: string;
  timestamp: number;
  payload?: unknown;
};

type TSseHandler = (event: TSseEnvelope) => void;
export type TSseDebugConnection = {
  id: string;
  scope: TSseScope;
  advId?: string;
  url: string;
  readyState: number;
  readyStateLabel: "connecting" | "open" | "closed" | "unknown";
  connectedAt: number;
  updatedAt: number;
  lastEventAt?: number;
  lastEventType?: string;
};

export type TSseDebugEvent = {
  id: number;
  at: number;
  source: string;
  scope: TSseScope;
  eventType: string;
  fallbackType: string;
  payloadPreview: string;
  rawPreview: string;
};

export type TSseDebugSnapshot = {
  connections: TSseDebugConnection[];
  events: TSseDebugEvent[];
};

type TSseDebugSubscriber = (snapshot: TSseDebugSnapshot) => void;

interface ISseContext {
  connectGlobal: () => void;
  connectAdventure: (advId: string) => void;
  disconnectAll: () => void;
  subscribe: (eventType: string, handler: TSseHandler) => () => void;
  setSyncSnapshot: (snapshot: ServerApi.EventRoutes.PongSyncSnapshot | null) => void;
  getDebugSnapshot: () => TSseDebugSnapshot;
  subscribeDebug: (handler: TSseDebugSubscriber) => () => void;
}

const SseContext = createContext<ISseContext>({
  connectGlobal: () => {},
  connectAdventure: () => {},
  disconnectAll: () => {},
  subscribe: () => () => {},
  setSyncSnapshot: () => {},
  getDebugSnapshot: () => ({ connections: [], events: [] }),
  subscribeDebug: () => () => {},
});

export function SseContextProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const globalRef = useRef<EventSource | null>(null);
  const advRef = useRef<EventSource | null>(null);
  const advIdRef = useRef<string>("");
  const handlersRef = useRef<Map<string, Set<TSseHandler>>>(new Map());
  const syncSnapshotRef = useRef<ServerApi.EventRoutes.PongSyncSnapshot | null>(null);
  const activityCleanupRef = useRef<null | (() => void)>(null);
  const lastActiveRef = useRef<boolean | null>(null);
  const lastActiveSentAtRef = useRef<number>(0);
  const debugConnectionsRef = useRef<Map<string, TSseDebugConnection>>(new Map());
  const debugEventsRef = useRef<TSseDebugEvent[]>([]);
  const debugSubscribersRef = useRef<Set<TSseDebugSubscriber>>(new Set());
  const debugEventSeqRef = useRef(0);

  const getReadyStateLabel = (
    readyState: number
  ): TSseDebugConnection["readyStateLabel"] => {
    if (readyState === EventSource.CONNECTING) return "connecting";
    if (readyState === EventSource.OPEN) return "open";
    if (readyState === EventSource.CLOSED) return "closed";
    return "unknown";
  };

  const getDebugSnapshot = (): TSseDebugSnapshot => ({
    connections: Array.from(debugConnectionsRef.current.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    events: [...debugEventsRef.current],
  });

  const notifyDebugSubscribers = () => {
    if (debugSubscribersRef.current.size === 0) return;
    const snapshot = getDebugSnapshot();
    debugSubscribersRef.current.forEach((subscriber) => subscriber(snapshot));
  };

  const upsertDebugConnection = (
    id: string,
    es: EventSource,
    scope: TSseScope,
    advId?: string,
    patch?: Partial<TSseDebugConnection>
  ) => {
    const now = Date.now();
    const prev = debugConnectionsRef.current.get(id);
    debugConnectionsRef.current.set(id, {
      id,
      scope,
      advId,
      url: es.url,
      readyState: es.readyState,
      readyStateLabel: getReadyStateLabel(es.readyState),
      connectedAt: prev?.connectedAt || now,
      updatedAt: now,
      lastEventAt: prev?.lastEventAt,
      lastEventType: prev?.lastEventType,
      ...patch,
    });
    notifyDebugSubscribers();
  };

  const closeDebugConnection = (id: string, es?: EventSource | null) => {
    const prev = debugConnectionsRef.current.get(id);
    if (!prev) return;
    const readyState = es?.readyState ?? EventSource.CLOSED;
    debugConnectionsRef.current.set(id, {
      ...prev,
      readyState,
      readyStateLabel: getReadyStateLabel(readyState),
      updatedAt: Date.now(),
    });
    notifyDebugSubscribers();
  };

  const recordDebugEvent = (
    source: string,
    scope: TSseScope,
    eventType: string,
    fallbackType: string,
    raw: string,
    payload: unknown
  ) => {
    const payloadPreview = JSON.stringify(payload);
    const nextEvent: TSseDebugEvent = {
      id: debugEventSeqRef.current + 1,
      at: Date.now(),
      source,
      scope,
      eventType,
      fallbackType,
      payloadPreview: (payloadPreview || "").slice(0, 1500),
      rawPreview: String(raw || "").slice(0, 1500),
    };
    debugEventSeqRef.current = nextEvent.id;
    debugEventsRef.current = [nextEvent, ...debugEventsRef.current].slice(0, 200);
    const connection = debugConnectionsRef.current.get(source);
    if (connection) {
      debugConnectionsRef.current.set(source, {
        ...connection,
        lastEventAt: nextEvent.at,
        lastEventType: eventType,
        updatedAt: nextEvent.at,
      });
    }
    notifyDebugSubscribers();
  };

  const dispatch = (eventType: string, envelope: TSseEnvelope) => {
    const specific = handlersRef.current.get(eventType);
    specific?.forEach((fn) => fn(envelope));
    const all = handlersRef.current.get("*");
    all?.forEach((fn) => fn(envelope));
  };

  const wireSource = (es: EventSource, scope: TSseScope, source: string) => {
    const parseAndDispatch = (raw: string, fallbackType: string) => {
      try {
        const parsed = JSON.parse(raw) as TSseEnvelope;
        recordDebugEvent(source, scope, parsed.type || fallbackType, fallbackType, raw, parsed);
        dispatch(parsed.type || fallbackType, parsed);
      } catch {
        const fallbackEnvelope = {
          type: fallbackType,
          scope,
          timestamp: Date.now(),
          payload: raw,
        };
        recordDebugEvent(source, scope, fallbackType, fallbackType, raw, fallbackEnvelope);
        dispatch(fallbackType, fallbackEnvelope);
      }
    };

    const sendPong = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events/pong`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            scope,
            sync: syncSnapshotRef.current || undefined,
            requestTimestamp: Date.now(),
          }),
        });
        const raw = await response.text();
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          data?: ServerApi.EventRoutes.PongResponse;
        };
        if (parsed.data?.sync) {
          dispatch("sync:status", {
            type: "sync:status",
            scope: "global",
            timestamp: Date.now(),
            payload: parsed.data.sync,
          });
        }
      } catch {
        // ignore pong failures; reconnect/timeout flow will handle state.
      }
    };

    const sendActivity = async (active: boolean) => {
      const now = Date.now();
      // Avoid burst spam and duplicate state pushes.
      if (lastActiveRef.current === active && now - lastActiveSentAtRef.current < 1000) {
        return;
      }
      lastActiveRef.current = active;
      lastActiveSentAtRef.current = now;
      try {
        await fetch(`${API_BASE_URL}/events/activity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            active,
            requestTimestamp: Date.now(),
          }),
        });
      } catch {
        // ignore activity send failures; next lifecycle event will retry
      }
    };

    es.onmessage = (message) => {
      parseAndDispatch(message.data, "message");
    };
    es.onopen = () => {
      upsertDebugConnection(source, es, scope);
    };
    es.addEventListener("connected", (message) => {
      try {
        const parsed = JSON.parse((message as MessageEvent).data) as TSseEnvelope;
        recordDebugEvent(
          source,
          scope,
          parsed.type || "connected",
          "connected",
          (message as MessageEvent).data,
          parsed
        );
        dispatch("connected", parsed);
      } catch {
        const fallbackEnvelope = {
          type: "connected",
          scope,
          timestamp: Date.now(),
        };
        recordDebugEvent(
          source,
          scope,
          "connected",
          "connected",
          (message as MessageEvent).data,
          fallbackEnvelope
        );
        dispatch("connected", fallbackEnvelope);
      }
    });
    es.addEventListener("ping", () => {
      recordDebugEvent(source, scope, "ping", "ping", "", {
        type: "ping",
        scope,
        timestamp: Date.now(),
      });
      if (scope !== "global") return;
      sendPong();
    });
    const computeActive = () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus();
    const onVisibility = () => {
      sendActivity(computeActive());
    };
    const onFocus = () => {
      sendActivity(true);
    };
    const onBlur = () => {
      sendActivity(false);
    };
    const cleanupActivityListeners = () => {
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("blur", onBlur);
      }
    };
    if (scope === "global" && typeof window !== "undefined") {
      activityCleanupRef.current?.();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", onFocus);
      window.addEventListener("blur", onBlur);
      activityCleanupRef.current = cleanupActivityListeners;
      sendActivity(computeActive());
    }
    [
      "user:online",
      "user:offline",
      "user:active",
      "user:logout",
      "user:login",
      "chat:message",
      "chat:allRoom",
      "chat:typing",
      "chat:policy",
      "adventure:selected",
      "adventure:presence",
      "adventure:userActive",
      "adventure:leave",
      "combat:state",
      "vendor:state",
      "vendor:tradeRequested",
      "vendor:tradeResolved",
      "notes:updated",
      "notes:lock",
      "private-notes:updated",
      "private-notes:lock",
      "ynev:markerUpserted",
      "ynev:markerDeleted",
      "character:updated",
      "character:levelup",
      "dev:runtime",
      "stream:error",
      "stream:closed",
    ].forEach((eventName) => {
      es.addEventListener(eventName, (message) => {
        parseAndDispatch((message as MessageEvent).data, eventName);
      });
    });
    es.onerror = () => {
      const isClosed = es.readyState === EventSource.CLOSED;
      upsertDebugConnection(source, es, scope);
      dispatch(isClosed ? "stream:closed" : "stream:error", {
        type: isClosed ? "stream:closed" : "stream:error",
        scope,
        timestamp: Date.now(),
      });
      if (isClosed) cleanupActivityListeners();
    };
  };

  const value = useMemo<ISseContext>(
    () => ({
      connectGlobal: () => {
        if (globalRef.current) return;
        const es = new EventSource(`${API_BASE_URL}/events/global`, {
          withCredentials: true,
        });
        upsertDebugConnection("global", es, "global");
        wireSource(es, "global", "global");
        globalRef.current = es;
      },
      connectAdventure: (advId: string) => {
        const safeAdvId = String(advId || "").trim();
        if (!safeAdvId) {
          if (advRef.current) {
            const source = advIdRef.current ? `adventure:${advIdRef.current}` : "adventure";
            advRef.current.close();
            closeDebugConnection(source, null);
            advRef.current = null;
          }
          advIdRef.current = "";
          return;
        }
        if (advRef.current && advIdRef.current === safeAdvId) return;
        if (advRef.current) {
          const source = advIdRef.current ? `adventure:${advIdRef.current}` : "adventure";
          advRef.current.close();
          closeDebugConnection(source, null);
          advRef.current = null;
        }
        const es = new EventSource(
          `${API_BASE_URL}/events/adventure/${encodeURIComponent(safeAdvId)}`,
          { withCredentials: true }
        );
        const source = `adventure:${safeAdvId}`;
        upsertDebugConnection(source, es, "adventure", safeAdvId);
        wireSource(es, "adventure", source);
        advRef.current = es;
        advIdRef.current = safeAdvId;
      },
      disconnectAll: () => {
        activityCleanupRef.current?.();
        activityCleanupRef.current = null;
        syncSnapshotRef.current = null;
        if (globalRef.current) {
          globalRef.current.close();
          closeDebugConnection("global", null);
          globalRef.current = null;
        }
        if (advRef.current) {
          const source = advIdRef.current ? `adventure:${advIdRef.current}` : "adventure";
          advRef.current.close();
          closeDebugConnection(source, null);
          advRef.current = null;
        }
        advIdRef.current = "";
      },
      subscribe: (eventType: string, handler: TSseHandler) => {
        const key = String(eventType || "*");
        const set = handlersRef.current.get(key) ?? new Set<TSseHandler>();
        set.add(handler);
        handlersRef.current.set(key, set);
        return () => {
          const curr = handlersRef.current.get(key);
          if (!curr) return;
          curr.delete(handler);
          if (curr.size === 0) handlersRef.current.delete(key);
        };
      },
      setSyncSnapshot: (snapshot: ServerApi.EventRoutes.PongSyncSnapshot | null) => {
        syncSnapshotRef.current = snapshot;
      },
      getDebugSnapshot,
      subscribeDebug: (handler: TSseDebugSubscriber) => {
        debugSubscribersRef.current.add(handler);
        handler(getDebugSnapshot());
        return () => {
          debugSubscribersRef.current.delete(handler);
        };
      },
    }),
    []
  );

  return <SseContext.Provider value={value}>{props.children}</SseContext.Provider>;
}

export function useSseContext() {
  return useContext(SseContext);
}
