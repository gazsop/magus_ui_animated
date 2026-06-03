import { useEffect, useState } from "preact/hooks";
import { FlexCol, FlexRow } from "@components/Flex";
import {
  TSseDebugConnection,
  TSseDebugEvent,
  TSseDebugSnapshot,
  useSseContext,
} from "@contexts/sseContext";
import { formatClientDateTime } from "@/core/datetime";
import { API_BASE_URL } from "@/core/config/runtime";
import { ServerApi } from "@shared/contracts";

const readyStateColor: Record<TSseDebugConnection["readyStateLabel"], string> = {
  connecting: "text-yellow-700",
  open: "text-green-700",
  closed: "text-red-700",
  unknown: "text-gray-700",
};

const formatPayload = (event: TSseDebugEvent) =>
  event.payloadPreview || event.rawPreview || "-";

export default function SseDebug() {
  const { getDebugSnapshot, subscribeDebug } = useSseContext();
  const [snapshot, setSnapshot] = useState<TSseDebugSnapshot>(() =>
    getDebugSnapshot()
  );
  const [serverSnapshot, setServerSnapshot] =
    useState<ServerApi.EventRoutes.DebugResponse | null>(null);
  const [serverDebugError, setServerDebugError] = useState("");

  useEffect(() => subscribeDebug(setSnapshot), [subscribeDebug]);

  useEffect(() => {
    let cancelled = false;
    const loadServerDebug = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events/debug`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            data: {},
            requestTimestamp: Date.now(),
          }),
        });
        const raw = await response.text();
        if (!response.ok) throw new Error(raw || `HTTP ${response.status}`);
        const parsed = JSON.parse(raw) as {
          data?: ServerApi.EventRoutes.DebugResponse;
        };
        if (cancelled) return;
        setServerSnapshot(parsed.data || null);
        setServerDebugError("");
      } catch (error) {
        if (cancelled) return;
        setServerDebugError(error instanceof Error ? error.message : String(error));
      }
    };
    void loadServerDebug();
    const timer = window.setInterval(() => {
      void loadServerDebug();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <FlexCol className="w-full h-full min-h-0 shrink-0 gap-2 p-3 overflow-hidden text-black">
      <FlexCol className="gap-1 shrink-0 basis-36 min-h-0 overflow-hidden">
        <div className="shrink-0 text-sm font-semibold">Browser SSE connections</div>
        <FlexCol className="grow min-h-0 gap-1 overflow-y-scroll overflow-x-hidden pr-1">
          {snapshot.connections.length === 0 ? (
            <div className="text-xs opacity-70">No SSE connections registered.</div>
          ) : (
            snapshot.connections.map((connection) => (
              <FlexRow
                key={connection.id}
                className="shrink-0 items-center gap-2 rounded border border-black/20 bg-white/60 px-2 py-1 text-xs"
              >
                <span className="font-mono min-w-[150px]">{connection.id}</span>
                <span className={readyStateColor[connection.readyStateLabel]}>
                  {connection.readyStateLabel}
                </span>
                <span>{connection.scope}</span>
                {connection.advId ? <span>adv: {connection.advId}</span> : null}
                <span className="truncate opacity-70">{connection.url}</span>
              </FlexRow>
            ))
          )}
        </FlexCol>
      </FlexCol>

      <FlexCol className="gap-1 shrink-0 basis-44 min-h-0 overflow-hidden">
        <FlexRow className="shrink-0 items-center justify-between">
          <div className="text-sm font-semibold">Server SSE streams</div>
          <div className="text-xs opacity-70">
            {serverSnapshot
              ? `pid ${serverSnapshot.pid} | ${formatClientDateTime(serverSnapshot.generatedAt)}`
              : serverDebugError
                ? "failed"
                : "loading"}
          </div>
        </FlexRow>
        <FlexCol className="grow min-h-0 gap-1 overflow-y-scroll overflow-x-hidden pr-1">
          {serverDebugError ? (
            <div className="shrink-0 text-xs text-red-700">{serverDebugError}</div>
          ) : !serverSnapshot || serverSnapshot.streams.length === 0 ? (
            <div className="shrink-0 text-xs opacity-70">No server streams registered.</div>
          ) : (
            serverSnapshot.streams.map((stream) => (
              <FlexRow
                key={stream.id}
                className="shrink-0 items-center gap-2 rounded border border-black/20 bg-white/60 px-2 py-1 text-xs"
              >
                <span className="font-mono min-w-[190px] truncate">{stream.id}</span>
                <span className={stream.readyState === "open" ? "text-green-700" : "text-red-700"}>
                  {stream.readyState}
                </span>
                <span>{stream.scope}</span>
                {stream.advId ? <span>adv: {stream.advId}</span> : null}
                <span>writes: {stream.writeCount}</span>
                <span>stale: {stream.staleWriteCount}</span>
                <span>last: {stream.lastEventType || "-"}</span>
                <span>{stream.lastWriteAt ? formatClientDateTime(stream.lastWriteAt) : "-"}</span>
              </FlexRow>
            ))
          )}
        </FlexCol>
      </FlexCol>

      <FlexCol className="gap-1 grow min-h-0 overflow-hidden">
        <FlexRow className="shrink-0 items-center justify-between">
          <div className="text-sm font-semibold">Incoming data</div>
          <div className="text-xs opacity-70">{snapshot.events.length} latest events</div>
        </FlexRow>
        <FlexCol className="grow min-h-0 overflow-y-scroll overflow-x-hidden rounded border border-black/20 bg-white/60">
          {snapshot.events.length === 0 ? (
            <div className="p-2 text-xs opacity-70">No incoming SSE data yet.</div>
          ) : (
            snapshot.events.map((event) => (
              <FlexCol
                key={event.id}
                className="shrink-0 gap-1 border-b border-black/10 px-2 py-1 text-xs"
              >
                <FlexRow className="items-center gap-2">
                  <span className="font-mono">{formatClientDateTime(event.at)}</span>
                  <span className="font-semibold">{event.eventType}</span>
                  <span>{event.scope}</span>
                  <span className="font-mono text-blue-800">{event.source}</span>
                  {event.fallbackType !== event.eventType ? (
                    <span className="opacity-70">fallback: {event.fallbackType}</span>
                  ) : null}
                </FlexRow>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-black/5 p-1 font-mono text-[11px]">
                  {formatPayload(event)}
                </pre>
              </FlexCol>
            ))
          )}
        </FlexCol>
      </FlexCol>
    </FlexCol>
  );
}
