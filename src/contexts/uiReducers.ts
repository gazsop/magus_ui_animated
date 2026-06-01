import { IOnlineUserBadge } from "@/pages/WindowsLayer";

export type PresenceState = Record<string, IOnlineUserBadge>;

export const applyPresenceEvent = (
  prev: PresenceState,
  payload: { uid?: string; name?: string; active?: boolean },
  mode: "upsert" | "remove" | "active"
): PresenceState => {
  const uid = String(payload.uid || "");
  if (!uid) return prev;

  if (mode === "remove") {
    if (!prev[uid]) return prev;
    const next = { ...prev };
    delete next[uid];
    return next;
  }

  const current = prev[uid];
  const nextName = String(payload.name || current?.name || uid);
  const nextActive =
    mode === "active" ? Boolean(payload.active) : current?.active ?? true;

  if (current && current.name === nextName && current.active === nextActive) {
    return prev;
  }

  return {
    ...prev,
    [uid]: {
      uid,
      name: nextName,
      active: nextActive,
    },
  };
};

export const applyWindowNotificationEvent = (
  prev: Record<string, number>,
  uid: string,
  nextCount: number
) => {
  const safeUid = String(uid || "");
  if (!safeUid) return prev;
  const normalized = Math.max(0, Number(nextCount || 0));
  if ((prev[safeUid] || 0) === normalized) return prev;
  return { ...prev, [safeUid]: normalized };
};
