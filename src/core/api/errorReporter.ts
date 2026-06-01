import { API_BASE_URL } from "../config/runtime";

type TClientErrorReport = {
  message: string;
  stack?: string;
  level?: "error" | "warn" | "info";
  context?: string;
  request?: unknown;
  response?: unknown;
  meta?: unknown;
};

let isSending = false;

export async function reportClientError(payload: TClientErrorReport): Promise<void> {
  if (isSending) return;
  isSending = true;
  try {
    await fetch(`${API_BASE_URL}/rest/reportClientError`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: payload,
        requestTimestamp: Date.now(),
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort telemetry only.
  } finally {
    isSending = false;
  }
}

