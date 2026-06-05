import { ServerApi } from "@shared/contracts";
import { useEffect } from "preact/hooks";
import { useLiveEventsContext } from "../contexts/liveEventsContext";

type TLiveEventEnvelope = {
  type: string;
  scope: "global" | "adventure" | "chat";
  advId?: string;
  timestamp: number;
  payload?: unknown;
};

export function useLiveEventSubscription(
  eventType: string,
  handler: (event: TLiveEventEnvelope) => void
) {
  const { subscribe } = useLiveEventsContext();
  useEffect(() => subscribe(eventType, handler), [eventType, handler, subscribe]);
}

const getPayloadAdvId = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.advId === "string" || typeof obj.advId === "number") {
    return String(obj.advId);
  }
  if (obj.vendor && typeof obj.vendor === "object") {
    const vendor = obj.vendor as Record<string, unknown>;
    if (typeof vendor.advId === "string" || typeof vendor.advId === "number") {
      return String(vendor.advId);
    }
  }
  return "";
};

export function useAdventureLiveEventSubscription<TPayload = unknown>(
  eventType: string,
  advId: string,
  handler: (payload: TPayload, event: TLiveEventEnvelope, eventAdvId: string) => void
) {
  useLiveEventSubscription(eventType, (event) => {
    if (event.scope === "global") return;
    const payload = (event.payload || {}) as TPayload;
    const eventAdvId = getPayloadAdvId(payload) || String(event.advId || "");
    if (!eventAdvId || !advId || eventAdvId !== advId) return;
    handler(payload, event, eventAdvId);
  });
}

export function useSyncStatusSubscription(
  advId: string,
  handler: (payload: ServerApi.EventRoutes.PongSyncStatus) => void
) {
  useLiveEventSubscription("sync:status", (event) => {
    const payload = event.payload as ServerApi.EventRoutes.PongSyncStatus | undefined;
    if (!payload?.advId || !advId || payload.advId !== advId) return;
    handler(payload);
  });
}
