import { createContext, JSX, useContext, useEffect, useMemo, useRef, useState } from "preact/compat";
import { ServerApi } from "@shared/contracts";
import { API_BASE_URL } from "../core/config/runtime";

type TLiveEventScope = "global" | "adventure" | "chat";

type TLiveEventEnvelope = {
  id?: number;
  type: string;
  scope: TLiveEventScope;
  advId?: string;
  timestamp: number;
  payload?: unknown;
};

type TLiveEventHandler = (event: TLiveEventEnvelope) => void;

export type TLiveDebugConnection = {
  id: string;
  scope: "global" | "adventure";
  advId?: string;
  url: string;
  readyState: number;
  readyStateLabel: "connecting" | "open" | "closed" | "unknown";
  connectedAt: number;
  updatedAt: number;
  lastEventAt?: number;
  lastEventType?: string;
};

export type TLiveDebugEvent = {
  id: number;
  at: number;
  source: string;
  scope: TLiveEventScope;
  eventType: string;
  fallbackType: string;
  payloadPreview: string;
  rawPreview: string;
};

export type TLiveDebugSnapshot = {
  connections: TLiveDebugConnection[];
  events: TLiveDebugEvent[];
};

type TLiveDebugSubscriber = (snapshot: TLiveDebugSnapshot) => void;

type TLiveEventsContext = {
  connectGlobal: () => void;
  connectAdventure: (advId: string) => void;
  disconnectAll: () => void;
  subscribe: (eventType: string, handler: TLiveEventHandler) => () => void;
  setSyncSnapshot: (snapshot: ServerApi.EventRoutes.PongSyncSnapshot | null) => void;
  getDebugSnapshot: () => TLiveDebugSnapshot;
  subscribeDebug: (handler: TLiveDebugSubscriber) => () => void;
};

const LiveEventsContext = createContext<TLiveEventsContext>({
  connectGlobal: () => {},
  connectAdventure: () => {},
  disconnectAll: () => {},
  subscribe: () => () => {},
  setSyncSnapshot: () => {},
  getDebugSnapshot: () => ({ connections: [], events: [] }),
  subscribeDebug: () => () => {},
});

const WAIT_MS = 25000;
const BATCH_MS = 150;

export function LiveEventsProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [advId, setAdvId] = useState("");
  const handlersRef = useRef<Map<string, Set<TLiveEventHandler>>>(new Map());
  const syncSnapshotRef = useRef<ServerApi.EventRoutes.PongSyncSnapshot | null>(null);
  const debugEventsRef = useRef<TLiveDebugEvent[]>([]);
  const debugSubscribersRef = useRef<Set<TLiveDebugSubscriber>>(new Set());
  const debugSeqRef = useRef(0);
  const latestIdRef = useRef(0);

  const getStorageKey = (scopeAdvId: string) =>
    scopeAdvId ? `live-long-poll-latest:adventure:${scopeAdvId}` : "live-long-poll-latest:global";

  const getDebugSnapshot = (): TLiveDebugSnapshot => ({
    connections: [
      {
        id: advId ? `long-poll:${advId}` : "long-poll:global",
        scope: advId ? "adventure" : "global",
        advId: advId || undefined,
        url: `${API_BASE_URL}/events/poll`,
        readyState: globalEnabled ? 1 : 2,
        readyStateLabel: globalEnabled ? "open" : "closed",
        connectedAt: 0,
        updatedAt: Date.now(),
      },
    ],
    events: [...debugEventsRef.current],
  });

  const notifyDebug = () => {
    if (debugSubscribersRef.current.size === 0) return;
    const snapshot = getDebugSnapshot();
    debugSubscribersRef.current.forEach((subscriber) => subscriber(snapshot));
  };

  const recordDebugEvent = (event: TLiveEventEnvelope) => {
    const next: TLiveDebugEvent = {
      id: debugSeqRef.current + 1,
      at: Date.now(),
      source: event.advId ? `long-poll:${event.advId}` : "long-poll:global",
      scope: event.scope,
      eventType: event.type,
      fallbackType: event.type,
      payloadPreview: JSON.stringify(event.payload ?? {}).slice(0, 1500),
      rawPreview: JSON.stringify(event).slice(0, 1500),
    };
    debugSeqRef.current = next.id;
    debugEventsRef.current = [next, ...debugEventsRef.current].slice(0, 200);
    notifyDebug();
  };

  const dispatch = (eventType: string, event: TLiveEventEnvelope) => {
    recordDebugEvent(event);
    handlersRef.current.get(eventType)?.forEach((handler) => {
      try {
        handler(event);
      } catch {}
    });
    handlersRef.current.get("*")?.forEach((handler) => {
      try {
        handler(event);
      } catch {}
    });
  };

  const sendActivity = async (active: boolean) => {
    try {
      await fetch(`${API_BASE_URL}/events/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ active, requestTimestamp: Date.now() }),
      });
    } catch {}
  };

  useEffect(() => {
    if (!globalEnabled) return;
    dispatch("connected", {
      type: "connected",
      scope: "global",
      timestamp: Date.now(),
      payload: {},
    });
    const computeActive = () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus();
    const onVisibility = () => void sendActivity(computeActive());
    const onFocus = () => void sendActivity(true);
    const onBlur = () => void sendActivity(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    void sendActivity(computeActive());
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [globalEnabled]);

  useEffect(() => {
    if (!globalEnabled || !advId) return;
    dispatch("connected", {
      type: "connected",
      scope: "adventure",
      advId,
      timestamp: Date.now(),
      payload: { advId },
    });
  }, [globalEnabled, advId]);

  useEffect(() => {
    if (!globalEnabled) return;
    const storageKey = getStorageKey(advId);
    latestIdRef.current = Math.max(0, Math.floor(Number(window.localStorage.getItem(storageKey) || 0)));
    let stopped = false;
    let abortController: AbortController | null = null;

    const poll = async () => {
      while (!stopped) {
        abortController = new AbortController();
        try {
          const response = await fetch(`${API_BASE_URL}/events/poll`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "include",
            signal: abortController.signal,
            body: JSON.stringify({
              data: {
                advId: advId || undefined,
                sinceId: latestIdRef.current,
                waitMs: WAIT_MS,
                batchMs: BATCH_MS,
                sync: syncSnapshotRef.current || undefined,
              } satisfies ServerApi.EventRoutes.PollBody,
              requestTimestamp: Date.now(),
            }),
          });
          const raw = await response.text();
          if (!response.ok) throw new Error(raw || `HTTP ${response.status}`);
          const parsed = JSON.parse(raw) as { data?: ServerApi.EventRoutes.PollResponse };
          const data = parsed.data;
          if (!data || stopped) continue;
          latestIdRef.current = Math.max(latestIdRef.current, Number(data.latestId || 0));
          window.localStorage.setItem(storageKey, String(latestIdRef.current));
          (data.events || []).forEach((event) => {
            dispatch(event.type, {
              id: event.id,
              type: event.type,
              scope: event.scope || "global",
              advId: event.advId,
              timestamp: event.createdAt,
              payload: event.payload,
            });
          });
          if (data.sync) {
            dispatch("sync:status", {
              type: "sync:status",
              scope: "global",
              timestamp: Date.now(),
              payload: data.sync,
            });
          }
        } catch {
          if (stopped || abortController.signal.aborted) return;
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      }
    };

    void poll();
    return () => {
      stopped = true;
      abortController?.abort();
    };
  }, [globalEnabled, advId]);

  const value = useMemo<TLiveEventsContext>(
    () => ({
      connectGlobal: () => setGlobalEnabled(true),
      connectAdventure: (nextAdvId: string) => setAdvId(String(nextAdvId || "").trim()),
      disconnectAll: () => {
        setGlobalEnabled(false);
        setAdvId("");
      },
      subscribe: (eventType: string, handler: TLiveEventHandler) => {
        const key = String(eventType || "*");
        const set = handlersRef.current.get(key) ?? new Set<TLiveEventHandler>();
        set.add(handler);
        handlersRef.current.set(key, set);
        return () => {
          const current = handlersRef.current.get(key);
          if (!current) return;
          current.delete(handler);
          if (current.size === 0) handlersRef.current.delete(key);
        };
      },
      setSyncSnapshot: (snapshot: ServerApi.EventRoutes.PongSyncSnapshot | null) => {
        syncSnapshotRef.current = snapshot;
      },
      getDebugSnapshot,
      subscribeDebug: (handler: TLiveDebugSubscriber) => {
        debugSubscribersRef.current.add(handler);
        handler(getDebugSnapshot());
        return () => {
          debugSubscribersRef.current.delete(handler);
        };
      },
    }),
    [advId, globalEnabled]
  );

  return <LiveEventsContext.Provider value={value}>{props.children}</LiveEventsContext.Provider>;
}

export function useLiveEventsContext() {
  return useContext(LiveEventsContext);
}
