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

interface ISseContext {
  connectGlobal: () => void;
  connectAdventure: (advId: string) => void;
  disconnectAll: () => void;
  subscribe: (eventType: string, handler: TSseHandler) => () => void;
  setSyncSnapshot: (snapshot: ServerApi.EventRoutes.PongSyncSnapshot | null) => void;
}

const SseContext = createContext<ISseContext>({
  connectGlobal: () => {},
  connectAdventure: () => {},
  disconnectAll: () => {},
  subscribe: () => () => {},
  setSyncSnapshot: () => {},
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

  const dispatch = (eventType: string, envelope: TSseEnvelope) => {
    const specific = handlersRef.current.get(eventType);
    specific?.forEach((fn) => fn(envelope));
    const all = handlersRef.current.get("*");
    all?.forEach((fn) => fn(envelope));
  };

  const wireSource = (es: EventSource, scope: TSseScope) => {
    const parseAndDispatch = (raw: string, fallbackType: string) => {
      try {
        const parsed = JSON.parse(raw) as TSseEnvelope;
        dispatch(parsed.type || fallbackType, parsed);
      } catch {
        dispatch(fallbackType, {
          type: fallbackType,
          scope,
          timestamp: Date.now(),
          payload: raw,
        });
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
            data: { scope, sync: syncSnapshotRef.current || undefined },
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
            data: { active },
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
    es.addEventListener("connected", (message) => {
      try {
        const parsed = JSON.parse((message as MessageEvent).data) as TSseEnvelope;
        dispatch("connected", parsed);
      } catch {
        dispatch("connected", {
          type: "connected",
          scope,
          timestamp: Date.now(),
        });
      }
    });
    es.addEventListener("ping", () => {
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
        wireSource(es, "global");
        globalRef.current = es;
      },
      connectAdventure: (advId: string) => {
        const safeAdvId = String(advId || "").trim();
        if (!safeAdvId) {
          if (advRef.current) {
            advRef.current.close();
            advRef.current = null;
          }
          advIdRef.current = "";
          return;
        }
        if (advRef.current && advIdRef.current === safeAdvId) return;
        if (advRef.current) {
          advRef.current.close();
          advRef.current = null;
        }
        const es = new EventSource(
          `${API_BASE_URL}/events/adventure/${encodeURIComponent(safeAdvId)}`,
          { withCredentials: true }
        );
        wireSource(es, "adventure");
        advRef.current = es;
        advIdRef.current = safeAdvId;
      },
      disconnectAll: () => {
        activityCleanupRef.current?.();
        activityCleanupRef.current = null;
        syncSnapshotRef.current = null;
        if (globalRef.current) {
          globalRef.current.close();
          globalRef.current = null;
        }
        if (advRef.current) {
          advRef.current.close();
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
    }),
    []
  );

  return <SseContext.Provider value={value}>{props.children}</SseContext.Provider>;
}

export function useSseContext() {
  return useContext(SseContext);
}
