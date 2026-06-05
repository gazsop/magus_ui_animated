import { Application } from "@shared/contracts";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import useRequest from "@hooks/request";
import { useDataContext } from "@contexts/dataContext";
import { useLiveEventSubscription } from "@hooks/liveEvents";
import { CLIENT_DATETIME_DISPLAY_FORMAT, formatClientDateTime } from "@/core/datetime";
import { API_BASE_URL } from "@/core/config/runtime";

type TNotesLock = {
  uid: string;
  name: string;
  acquiredAt: number;
  expiresAt: number;
} | null;

type TNoteEntry = {
  id: string;
  uid: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
};

type TAdventureNotes = {
  advId: string;
  entries: TNoteEntry[];
  currentEntryId: string | null;
  revision: number;
  lastEditedByUid: string | null;
  lastEditedByName: string | null;
  lastEditedAt: number | null;
  lock: TNotesLock;
};

type TNotesMode = "shared" | "private";

const emptyNotes = (advId: string): TAdventureNotes => ({
  advId,
  entries: [],
  currentEntryId: null,
  revision: 0,
  lastEditedByUid: null,
  lastEditedByName: null,
  lastEditedAt: null,
  lock: null,
});

const normalizeNotes = (advId: string, value: Partial<TAdventureNotes> | null | undefined): TAdventureNotes => ({
  advId: String(value?.advId || advId),
  entries: Array.isArray(value?.entries) ? value.entries : [],
  currentEntryId: value?.currentEntryId || null,
  revision: Math.max(0, Number(value?.revision || 0)),
  lastEditedByUid: value?.lastEditedByUid || null,
  lastEditedByName: value?.lastEditedByName || null,
  lastEditedAt: value?.lastEditedAt || null,
  lock: value?.lock || null,
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
    placeholder: mode === "private" ? "Saját krónikajegyzetek..." : "Közös krónikajegyzetek...",
  };
};

const buildPrivateSaveUrl = () => `${API_BASE_URL}/adventures/notes/private/save`;

const sameLock = (a: TNotesLock, b: TNotesLock) =>
  (a?.uid || null) === (b?.uid || null) &&
  (a?.name || null) === (b?.name || null) &&
  (a?.acquiredAt || null) === (b?.acquiredAt || null) &&
  (a?.expiresAt || null) === (b?.expiresAt || null);

const sameEntries = (a: TNoteEntry[], b: TNoteEntry[]) =>
  a.length === b.length &&
  a.every((entry, index) => {
    const other = b[index];
    return (
      other &&
      entry.id === other.id &&
      entry.uid === other.uid &&
      entry.name === other.name &&
      entry.content === other.content &&
      entry.createdAt === other.createdAt &&
      entry.updatedAt === other.updatedAt &&
      entry.revision === other.revision
    );
  });

const sameVisibleState = (a: TAdventureNotes, b: TAdventureNotes) =>
  a.advId === b.advId &&
  a.currentEntryId === b.currentEntryId &&
  a.revision === b.revision &&
  a.lastEditedByUid === b.lastEditedByUid &&
  a.lastEditedByName === b.lastEditedByName &&
  a.lastEditedAt === b.lastEditedAt &&
  sameLock(a.lock, b.lock) &&
  sameEntries(a.entries, b.entries);

const patchNotes = (prev: TAdventureNotes, next: TAdventureNotes): TAdventureNotes =>
  sameVisibleState(prev, next) ? prev : next;

const getEditableEntry = (notes: TAdventureNotes, uid: string | undefined) => {
  if (!uid || !notes.currentEntryId) return null;
  const entry = notes.entries.find((candidate) => candidate.id === notes.currentEntryId);
  return entry?.uid === uid ? entry : null;
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

  const applyRemoteNotes = (nextRaw: Partial<TAdventureNotes> | null | undefined) => {
    const next = normalizeNotes(advId, nextRaw);
    setNotes((prev) => patchNotes(prev, next));
    if (!dirtyRef.current || !canEdit) {
      const editable = getEditableEntry(next, user?.uid);
      setDraft(editable?.content || "");
      setDirty(false);
    }
  };

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
      .then((response) => applyRemoteNotes(response.data))
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
        const next = normalizeNotes(advId, response.data);
        setNotes((prev) => patchNotes(prev, next));
        const editable = getEditableEntry(next, user?.uid);
        setDraft(editable?.content || "");
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
        const next = normalizeNotes(advId, response.data);
        setNotes((prev) => patchNotes(prev, next));
        const editable = getEditableEntry(next, user?.uid);
        setDraft(editable?.content || "");
        setDirty(false);
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
        applyRemoteNotes(response.data);
        setDraft("");
        setDirty(false);
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
        .then((response) => applyRemoteNotes(response.data))
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

  useLiveEventSubscription(config.updatedEvent, (event) => {
    const payload = (event.payload || {}) as TAdventureNotes;
    if (!payload?.advId || payload.advId !== advId) return;
    applyRemoteNotes(payload);
  });

  useLiveEventSubscription(config.lockEvent, (event) => {
    const payload = (event.payload || {}) as TAdventureNotes;
    if (!payload?.advId || payload.advId !== advId) return;
    applyRemoteNotes(payload);
  });

  if (!advId) {
    return (
      <div className="w-full h-full min-h-0 p-2 text-sm">
        {config.emptyText}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 p-2 flex flex-col gap-2 overflow-hidden">
      <div className="fancy-container p-2 text-xs shrink-0">
        {!isPrivate ? (
          <p>
            Szerkesztés:{" "}
            <span className="font-bold">
              {notes.lock ? `${notes.lock.name} (${notes.lock.uid})` : "szabad"}
            </span>
          </p>
        ) : null}
        <p>
          Utolsó mentés ({CLIENT_DATETIME_DISPLAY_FORMAT}):{" "}
          <span className="font-bold">
            {notes.lastEditedByName || "-"} | {formatClientDateTime(notes.lastEditedAt)}
          </span>
        </p>
        <p>
          Verzió: <span className="font-bold">{notes.revision || 0}</span>
        </p>
      </div>

      <div className="flex gap-2 flex-wrap shrink-0">
        {!isPrivate ? (
          <>
            <button
              className="fancy-container px-2 py-1"
              onClick={takeLock}
              disabled={busy || isOwner || (!!notes.lock && notes.lock.uid !== user?.uid)}
            >
              Szerkesztés átvétele
            </button>
            <button
              className="fancy-container px-2 py-1"
              onClick={releaseLock}
              disabled={busy || !isOwner}
            >
              Elengedés
            </button>
          </>
        ) : null}
        <button
          className="fancy-container px-2 py-1"
          onClick={saveNotes}
          disabled={busy || !canEdit || !dirty}
        >
          Mentés
        </button>
      </div>

      <div className="min-h-0 grow overflow-y-auto flex flex-col gap-2 pr-1">
        {notes.entries.length < 1 ? (
          <p className="text-sm opacity-75">Nincs bejegyzés.</p>
        ) : null}
        {notes.entries.map((entry) => (
          <article key={entry.id} className="fancy-container p-2 text-sm">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs opacity-80">
              <span className="font-bold">{entry.name || entry.uid}</span>
              <span>{formatClientDateTime(entry.updatedAt || entry.createdAt)}</span>
              {entry.revision > 1 ? <span>szerkesztve: {entry.revision}</span> : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words">{entry.content}</p>
          </article>
        ))}
      </div>

      <textarea
        className="h-36 shrink-0 w-full fancy-container p-2 text-black"
        value={draft}
        onInput={(e) => {
          const value = (e.currentTarget as HTMLTextAreaElement).value;
          setDraft(value);
          setDirty(true);
        }}
        readOnly={!canEdit}
        placeholder={loading ? "Jegyzetek betöltése..." : config.placeholder}
      />
    </div>
  );
}
