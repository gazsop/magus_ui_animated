import { Application } from "@shared/contracts";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import useRequest from "@hooks/request";
import { useDataContext } from "@contexts/dataContext";
import { useSseSubscription } from "@hooks/sse";
import { CLIENT_DATETIME_DISPLAY_FORMAT, formatClientDateTime } from "@/core/datetime";
import { API_BASE_URL } from "@/core/config/runtime";

type TNotesLock = {
  uid: string;
  name: string;
  acquiredAt: number;
  expiresAt: number;
} | null;

type TAdventureNotes = {
  advId: string;
  content: string;
  revision: number;
  lastEditedByUid: string | null;
  lastEditedByName: string | null;
  lastEditedAt: number | null;
  lock: TNotesLock;
};

type TNotesMode = "shared" | "private";

const emptyNotes = (advId: string): TAdventureNotes => ({
  advId,
  content: "",
  revision: 0,
  lastEditedByUid: null,
  lastEditedByName: null,
  lastEditedAt: null,
  lock: null,
});

const modeConfig = (mode: TNotesMode) => {
  const base = mode === "private" ? "/notes/private" : "/notes";
  return {
    getEndpoint: `${base}/get`,
    saveEndpoint: `${base}/save`,
    takeLockEndpoint: `${base}/lock/take`,
    releaseLockEndpoint: `${base}/lock/release`,
    heartbeatEndpoint: `${base}/lock/heartbeat`,
    updatedEvent: mode === "private" ? "private-notes:updated" : "notes:updated",
    lockEvent: mode === "private" ? "private-notes:lock" : "notes:lock",
    emptyText:
      mode === "private"
        ? "Select an adventure to use private notes."
        : "Select an adventure to use shared notes.",
    placeholder: mode === "private" ? "Private adventure notes..." : "Shared adventure notes...",
  };
};

const buildPrivateSaveUrl = () => `${API_BASE_URL}/adventures/notes/private/save`;

const sameVisibleState = (a: TAdventureNotes, b: TAdventureNotes) =>
  a.advId === b.advId &&
  a.content === b.content &&
  a.revision === b.revision &&
  a.lastEditedByUid === b.lastEditedByUid &&
  a.lastEditedByName === b.lastEditedByName &&
  a.lastEditedAt === b.lastEditedAt &&
  (a.lock?.uid || null) === (b.lock?.uid || null) &&
  (a.lock?.name || null) === (b.lock?.name || null) &&
  (a.lock?.acquiredAt || null) === (b.lock?.acquiredAt || null) &&
  (a.lock?.expiresAt || null) === (b.lock?.expiresAt || null);

const patchLock = (prev: TNotesLock, next: TNotesLock): TNotesLock => {
  const prevUid = prev?.uid || null;
  const nextUid = next?.uid || null;
  const prevName = prev?.name || null;
  const nextName = next?.name || null;
  const prevAcquired = prev?.acquiredAt || null;
  const nextAcquired = next?.acquiredAt || null;
  const prevExpires = prev?.expiresAt || null;
  const nextExpires = next?.expiresAt || null;

  if (
    prevUid === nextUid &&
    prevName === nextName &&
    prevAcquired === nextAcquired &&
    prevExpires === nextExpires
  ) {
    return prev;
  }
  if (!next) return null;
  return {
    uid: next.uid,
    name: next.name,
    acquiredAt: next.acquiredAt,
    expiresAt: next.expiresAt,
  };
};

const patchNotes = (prev: TAdventureNotes, next: TAdventureNotes): TAdventureNotes => {
  let changed = false;
  let patched = prev;

  if (prev.advId !== next.advId) {
    patched = { ...patched, advId: next.advId };
    changed = true;
  }
  if (prev.content !== next.content) {
    patched = { ...patched, content: next.content };
    changed = true;
  }
  if (prev.revision !== next.revision) {
    patched = { ...patched, revision: next.revision };
    changed = true;
  }
  if (prev.lastEditedByUid !== next.lastEditedByUid) {
    patched = { ...patched, lastEditedByUid: next.lastEditedByUid };
    changed = true;
  }
  if (prev.lastEditedByName !== next.lastEditedByName) {
    patched = { ...patched, lastEditedByName: next.lastEditedByName };
    changed = true;
  }
  if (prev.lastEditedAt !== next.lastEditedAt) {
    patched = { ...patched, lastEditedAt: next.lastEditedAt };
    changed = true;
  }

  const nextLock = patchLock(patched.lock, next.lock);
  if (nextLock !== patched.lock) {
    patched = { ...patched, lock: nextLock };
    changed = true;
  }

  return changed ? patched : prev;
};

export default function SharedAdventureNotes({
  advId,
  mode = "shared",
}: {
  advId: string;
  mode?: TNotesMode;
}) {
  const { user } = useDataContext();
  const [adventureRequest] = useRequest(Application.REQUEST_CONTROLLER.ADVENTURES);
  const config = useMemo(() => modeConfig(mode), [mode]);
  const [notes, setNotes] = useState<TAdventureNotes>(emptyNotes(advId));
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const draftRef = useRef("");
  const dirtyRef = useRef(false);
  const advIdRef = useRef(advId);
  const modeRef = useRef<TNotesMode>(mode);
  const isPrivate = mode === "private";

  const isOwner = useMemo(
    () => !!notes.lock?.uid && notes.lock.uid === user?.uid,
    [notes.lock?.uid, user?.uid]
  );
  const canEdit = isPrivate || isOwner;

  useEffect(() => {
    draftRef.current = draft;
    dirtyRef.current = dirty;
    advIdRef.current = advId;
    modeRef.current = mode;
  }, [advId, dirty, draft, mode]);

  const savePrivateOnUnload = () => {
    if (modeRef.current !== "private" || !advIdRef.current || !dirtyRef.current) return;
    const payload = JSON.stringify({
      data: { advId: advIdRef.current, content: draftRef.current },
      requestTimestamp: Date.now(),
    });
    void fetch(buildPrivateSaveUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: payload,
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  };

  const loadNotes = () => {
    if (!advId) return;
    setLoading(true);
    adventureRequest<TAdventureNotes>({
      endPoint: config.getEndpoint,
      body: { advId },
    })
      .then((response) => {
        const next = response.data || emptyNotes(advId);
        setNotes((prev) => patchNotes(prev, next));
        setDraft((prev) => (prev === (next.content || "") ? prev : next.content || ""));
        setDirty(false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const saveNotes = () => {
    if (!advId || !dirty || (!isPrivate && !isOwner)) return;
    setBusy(true);
    adventureRequest<TAdventureNotes>({
      endPoint: config.saveEndpoint,
      body: { advId, content: draft },
    })
      .then((response) => {
        const next = response.data || emptyNotes(advId);
        setNotes((prev) => (sameVisibleState(prev, next) ? prev : next));
        setDraft(next.content || "");
        setDirty(false);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const takeLock = () => {
    if (!advId) return;
    setBusy(true);
    adventureRequest<TAdventureNotes>({
      endPoint: config.takeLockEndpoint,
      body: { advId },
    })
      .then((response) => {
        const next = response.data || emptyNotes(advId);
        setNotes((prev) => patchNotes(prev, next));
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const releaseLock = () => {
    if (!advId) return;
    setBusy(true);
    adventureRequest<TAdventureNotes>({
      endPoint: config.releaseLockEndpoint,
      body: { advId },
    })
      .then((response) => {
        const next = response.data || emptyNotes(advId);
        setNotes((prev) => patchNotes(prev, next));
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    if (!advId) {
      setNotes(emptyNotes(""));
      setDraft("");
      setDirty(false);
      return;
    }
    loadNotes();
  }, [advId, mode]);

  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!dirty || !canEdit) return;
    saveTimerRef.current = window.setTimeout(() => {
      saveNotes();
    }, isPrivate ? 5_000 : 900);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [dirty, draft, canEdit, advId, config.saveEndpoint, isPrivate]);

  useEffect(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (!isOwner || !advId) return;
    heartbeatTimerRef.current = window.setInterval(() => {
      adventureRequest<TAdventureNotes>({
        endPoint: config.heartbeatEndpoint,
        body: { advId },
      })
        .then((response) => {
          const next = response.data || emptyNotes(advId);
          setNotes((prev) => patchNotes(prev, next));
        })
        .catch(() => {});
    }, 25_000);
    return () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [isOwner, advId, config.heartbeatEndpoint]);

  useEffect(() => {
    if (!isPrivate) return;
    const handleBeforeUnload = () => {
      savePrivateOnUnload();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      savePrivateOnUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isPrivate]);

  useSseSubscription(config.updatedEvent, (event) => {
    if (event.scope !== "adventure") return;
    const payload = (event.payload || {}) as TAdventureNotes;
    if (!payload?.advId || payload.advId !== advId) return;
    setNotes((prev) => patchNotes(prev, payload));
    if (!dirty || !canEdit) {
      setDraft(payload.content || "");
      setDirty(false);
    }
  });

  useSseSubscription(config.lockEvent, (event) => {
    if (event.scope !== "adventure") return;
    const payload = (event.payload || {}) as TAdventureNotes;
    if (!payload?.advId || payload.advId !== advId) return;
    setNotes((prev) => {
      const nextLock = patchLock(prev.lock, payload.lock);
      if (nextLock === prev.lock) return prev;
      return { ...prev, lock: nextLock };
    });
  });

  if (!advId) {
    return (
      <div className="w-full h-full min-h-0 p-2 text-sm">
        {config.emptyText}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 p-2 flex flex-col gap-2 overflow-auto">
      <div className="fancy-container p-2 text-xs">
        {!isPrivate ? (
          <p>
            Edit lock:{" "}
            <span className="font-bold">
              {notes.lock ? `${notes.lock.name} (${notes.lock.uid})` : "free"}
            </span>
          </p>
        ) : null}
        <p>
          Last edit ({CLIENT_DATETIME_DISPLAY_FORMAT}):{" "}
          <span className="font-bold">
            {notes.lastEditedByName || "-"} | {formatClientDateTime(notes.lastEditedAt)}
          </span>
        </p>
        <p>
          Revision: <span className="font-bold">{notes.revision || 0}</span>
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {!isPrivate ? (
          <>
            <button
              className="fancy-container px-2 py-1"
              onClick={takeLock}
              disabled={busy || isOwner || (!!notes.lock && notes.lock.uid !== user?.uid)}
            >
              Take Edit
            </button>
            <button
              className="fancy-container px-2 py-1"
              onClick={releaseLock}
              disabled={busy || !isOwner}
            >
              Release
            </button>
          </>
        ) : null}
        <button
          className="fancy-container px-2 py-1"
          onClick={saveNotes}
          disabled={busy || !canEdit || !dirty}
        >
          Save now
        </button>
      </div>

      <textarea
        className="grow min-h-0 w-full fancy-container p-2 text-black"
        value={draft}
        onInput={(e) => {
          const value = (e.currentTarget as HTMLTextAreaElement).value;
          setDraft(value);
          setDirty(true);
        }}
        readOnly={!canEdit}
        placeholder={loading ? "Loading notes..." : config.placeholder}
      />
    </div>
  );
}
