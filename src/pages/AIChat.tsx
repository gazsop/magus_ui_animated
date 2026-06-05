import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { Application } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";
import useRequest from "@hooks/request";
import ChatWindowTemplate, { TChatWindowMessage } from "@components/ChatWindowTemplate";

type TChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TAiChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: TChatMessage[];
};

const STORAGE_KEY = "ai-chat-sessions-v1";
const MAX_CONTEXT_MESSAGES = 20;

const createSessionId = () =>
  `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const createEmptySession = (title = "Chat 1"): TAiChatSession => {
  const now = Date.now();
  return {
    id: createSessionId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

const sanitizeSession = (input: unknown, index: number): TAiChatSession | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<TAiChatSession>;
  const id = String(raw.id || "").trim() || createSessionId();
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter(
          (message): message is TChatMessage =>
            !!message &&
            typeof message === "object" &&
            ((message as TChatMessage).role === "user" ||
              (message as TChatMessage).role === "assistant") &&
            typeof (message as TChatMessage).content === "string"
        )
        .map((message) => ({ role: message.role, content: message.content }))
    : [];
  return {
    id,
    title: String(raw.title || `Chat ${index + 1}`).trim() || `Chat ${index + 1}`,
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
    messages,
  };
};

const readSessions = (): TAiChatSession[] => {
  if (typeof window === "undefined") return [createEmptySession()];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const sessions = Array.isArray(parsed)
      ? parsed
          .map(sanitizeSession)
          .filter((session): session is TAiChatSession => !!session)
      : [];
    return sessions.length > 0 ? sessions : [createEmptySession()];
  } catch {
    return [createEmptySession()];
  }
};

const deriveSessionTitle = (text: string, fallback: string) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
};

export default function AIChat({
  close,
  classes,
}: {
  close: () => void;
  classes?: string;
}) {
  const [aiRequest] = useRequest(Application.REQUEST_CONTROLLER.AI);
  const [sessions, setSessions] = useState<TAiChatSession[]>(readSessions);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id || "");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );
  const messages = activeSession?.messages || [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (sessions.some((session) => session.id === activeSessionId)) return;
    setActiveSessionId(sessions[0]?.id || "");
  }, [sessions, activeSessionId]);

  const patchSession = useCallback(
    (sessionId: string, patch: (session: TAiChatSession) => TAiChatSession) => {
      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? patch(session) : session))
      );
    },
    []
  );

  const createSession = useCallback(() => {
    setSessions((prev) => {
      const nextSession = createEmptySession(`Chat ${prev.length + 1}`);
      setActiveSessionId(nextSession.id);
      setInput("");
      return [...prev, nextSession];
    });
  }, []);

  const renameSession = useCallback(() => {
    if (!activeSession) return;
    const nextTitle = window.prompt("Beszélgetés neve", activeSession.title)?.trim();
    if (!nextTitle) return;
    patchSession(activeSession.id, (session) => ({
      ...session,
      title: nextTitle,
      updatedAt: Date.now(),
    }));
  }, [activeSession, patchSession]);

  const deleteSession = useCallback(() => {
    if (!activeSession || sessions.length <= 1) {
      patchSession(activeSession?.id || "", (session) => ({
        ...session,
        messages: [],
        updatedAt: Date.now(),
      }));
      return;
    }
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== activeSession.id);
      setActiveSessionId(next[0]?.id || "");
      setInput("");
      return next.length > 0 ? next : [createEmptySession()];
    });
  }, [activeSession, sessions.length, patchSession]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text || loading || !activeSession) return;

      const sessionId = activeSession.id;
      const userMessage: TChatMessage = { role: "user", content: text };
      const nextMessages = [...activeSession.messages, userMessage];
      const nextTitle =
        activeSession.messages.length === 0
          ? deriveSessionTitle(text, activeSession.title)
          : activeSession.title;

      patchSession(sessionId, (session) => ({
        ...session,
        title: nextTitle,
        messages: nextMessages,
        updatedAt: Date.now(),
      }));
      setInput("");
      setLoading(true);

      aiRequest<ServerApi.AiRoutes.ChatResponse, ServerApi.AiRoutes.ChatBody>({
        endPoint: "/chat",
        errorMode: "quiet",
        body: {
          model: "deepseek-chat",
          messages: nextMessages.slice(-MAX_CONTEXT_MESSAGES),
          temperature: 0.7,
          maxTokens: 2048,
        },
      })
        .then((response) => {
          const reply = response.data?.reply ?? "";
          patchSession(sessionId, (session) => ({
            ...session,
            messages: [...session.messages, { role: "assistant", content: reply }],
            updatedAt: Date.now(),
          }));
        })
        .catch(() => {
          patchSession(sessionId, (session) => ({
            ...session,
            messages: [
              ...session.messages,
              { role: "assistant", content: "Jótündér Keresztanya most nem tud válaszolni" },
            ],
            updatedAt: Date.now(),
          }));
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [activeSession, loading, aiRequest, patchSession]
  );

  const handleReset = useCallback(() => {
    if (!activeSession) return;
    patchSession(activeSession.id, (session) => ({
      ...session,
      messages: [],
      updatedAt: Date.now(),
    }));
    setInput("");
    setLoading(false);
  }, [activeSession, patchSession]);

  const displayMessages: TChatWindowMessage[] = messages.map((msg, idx) => ({
    id: `${activeSession?.id || "session"}-${msg.role}-${idx}`,
    author: msg.role === "user" ? "Te" : "Jótündér Keresztanya",
    content: msg.content,
    side: msg.role === "user" ? "self" : "other",
  }));

  return (
    <ChatWindowTemplate
      id="ai-chat-window"
      aditionalIcons={
        <div className="flex items-center gap-1 max-w-[60vw] overflow-hidden">
          <select
            className="max-w-[150px] rounded px-1 py-0.5 text-xs text-black"
            value={activeSession?.id || ""}
            disabled={loading}
            onChange={(event) => {
              setActiveSessionId(event.currentTarget.value);
              setInput("");
            }}
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
          <button
            className="fancy-container px-1.5 py-0.5 text-[11px]"
            onClick={createSession}
            title="Új alkalom"
            type="button"
          >
            +
          </button>
          <button
            className="fancy-container px-1.5 py-0.5 text-[11px]"
            onClick={renameSession}
            title="Beszélgetés átnevezése"
            type="button"
            disabled={!activeSession}
          >
            Rename
          </button>
          <button
            className="fancy-container px-1.5 py-0.5 text-[11px]"
            onClick={handleReset}
            title="Beszélgetés visszaállítása"
            type="button"
            disabled={!activeSession || loading}
          >
            Reset
          </button>
          <button
            className="fancy-container px-1.5 py-0.5 text-[11px]"
            onClick={deleteSession}
            title={sessions.length <= 1 ? "Beszélgetés törlése" : "Beszélgetés végleges törlése"}
            type="button"
            disabled={!activeSession || loading}
          >
            {sessions.length <= 1 ? "Clear" : "Delete"}
          </button>
        </div>
      }
      close={close}
      label="AI Chat"
      classes={classes}
      messages={displayMessages}
      emptyText=""
      loadingLabel={loading ? "DeepSeek" : null}
      input={{
        placeholder: "",
        value: input,
        disabled: loading,
        submitDisabled: !input.trim(),
        onInput: setInput,
        onSend: handleSend,
      }}
    />
  );
}
