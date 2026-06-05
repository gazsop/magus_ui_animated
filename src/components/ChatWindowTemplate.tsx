import { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { FlexCol } from "@components/Flex";
import RndContainer from "@components/RndContainer";
import { ServerApi } from "@shared/contracts";

export type TChatWindowMessage = {
  id: string;
  author: string;
  content: string | JSX.Element;
  side: "self" | "other";
  timestamp?: string;
  timestampTitle?: string;
  onDelete?: () => void;
};

export type TChatWindowLogEntry = {
  id: string;
  line: string;
};

export type TChatReferenceSuggestion =
  | ServerApi.ChatRoutes.ChatReferenceSearchResult
  | {
      kind: "command";
      id: string;
      label: string;
      description?: string;
    };

type TActiveReferenceMention = {
  start: number;
  end: number;
  query: string;
};

const findActiveReferenceMention = (
  value: string,
  caret: number
): TActiveReferenceMention | null => {
  const beforeCaret = value.slice(0, caret);
  const match = /(^|\s)@([^\s@]*)$/.exec(beforeCaret);
  if (!match) return null;
  const start = beforeCaret.length - match[2].length - 1;
  return {
    start,
    end: caret,
    query: match[2],
  };
};

export default function ChatWindowTemplate({
  id,
  label,
  close,
  classes,
  aditionalIcons = null,
  messages,
  emptyText,
  loadingLabel,
  typingLabel,
  presenceLog,
  input,
  disabledNote,
  onRead,
}: {
  id: string;
  label: string;
  close: () => void;
  classes?: string;
  aditionalIcons?: JSX.Element | null;
  messages: TChatWindowMessage[];
  emptyText: string;
  loadingLabel?: string | null;
  typingLabel?: string | null;
  presenceLog?: {
    title: string;
    actionLabel: string;
    onAction: () => void;
    entries: TChatWindowLogEntry[];
    emptyText: string;
  };
  input: {
    name?: string;
    placeholder?: string;
    value?: string;
    disabled?: boolean;
    submitDisabled?: boolean;
    sendLabel?: string;
    beforeSendAction?: JSX.Element | null;
    afterSendAction?: JSX.Element | null;
    focusKey?: unknown;
    onInput?: (value: string) => void;
    onTyping?: () => void;
    referenceSuggestions?: TChatReferenceSuggestion[];
    onReferenceQuery?: (query: string) => void;
    onReferenceSelect?: (
      result: TChatReferenceSuggestion,
      mention: TActiveReferenceMention
    ) => void;
    onSend: (text: string) => void | Promise<void>;
  };
  disabledNote?: string | null;
  onRead?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeReferenceMention, setActiveReferenceMention] =
    useState<TActiveReferenceMention | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    onRead?.();
  }, [messages, loadingLabel]);

  useEffect(() => {
    if (input.focusKey === undefined) return;
    const target = inputRef.current;
    if (!target) return;
    target.focus();
    const pos = target.value.length;
    target.setSelectionRange(pos, pos);
  }, [input.focusKey]);

  return (
    <RndContainer
      id={id}
      aditionalIcons={aditionalIcons}
      close={close}
      label={label}
      className={classes}
    >
      <FlexCol
        className="w-full h-full min-h-0 p-2 gap-2"
        onMouseDown={onRead}
        onFocusIn={onRead}
      >
        <div
          ref={scrollRef}
          className="fancy-container grow min-h-0 overflow-y-auto p-2 text-xs flex flex-col gap-2"
        >
          {messages.length === 0 && (
            <p className="opacity-60 italic">{emptyText}</p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`group relative rounded px-2 py-1 ${
                message.side === "self"
                  ? "bg-slate-600/40 self-end max-w-[80%]"
                  : "bg-slate-700/40 self-start max-w-[90%]"
              }`}
            >
              {message.onDelete ? (
                <span
                  title="Üzenet törlése"
                  role="button"
                  tabIndex={0}
                  aria-label="Üzenet törlése"
                  className="absolute right-1 top-0 cursor-pointer text-[10px] font-bold leading-none text-red-500 opacity-70 hover:opacity-100"
                  onClick={message.onDelete}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") message.onDelete?.();
                  }}
                >
                  x
                </span>
              ) : null}
              <p className="whitespace-pre-wrap break-words">
                <span
                  className="font-bold opacity-70"
                  title={message.timestampTitle || message.timestamp}
                >
                  {message.author ? `${message.author} ` : ""}
                  {message.timestamp || ""}:{" "}
                </span>
                {message.content}
              </p>
            </div>
          ))}
          {loadingLabel ? (
            <div className="bg-slate-700/40 self-start max-w-[90%] rounded px-2 py-1">
              <p className="font-bold opacity-70 mb-0.5 text-[10px] uppercase tracking-wider">
                {loadingLabel}
              </p>
              <p className="animate-pulse">Jó tündér keresztanya gondolkodik...</p>
            </div>
          ) : null}
        </div>
        {typingLabel ? (
          <p className="px-1 text-[11px] opacity-70 italic">{typingLabel}</p>
        ) : null}
        {presenceLog ? (
          <div className="fancy-container max-h-[140px] overflow-y-auto p-2 text-[11px]">
            <div className="flex justify-between items-center mb-1">
              <p className="font-bold">{presenceLog.title}</p>
              <button
                className="fancy-container px-2 py-0.5"
                onClick={presenceLog.onAction}
                type="button"
              >
                {presenceLog.actionLabel}
              </button>
            </div>
            {presenceLog.entries.length === 0 ? (
              <p className="opacity-60 italic">{presenceLog.emptyText}</p>
            ) : (
              presenceLog.entries.map((entry) => <p key={entry.id}>{entry.line}</p>)
            )}
          </div>
        ) : null}
        <form
          className="relative flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.disabled) return;
            const formInput = e.currentTarget.elements.namedItem(
              input.name || "chatInput"
            ) as HTMLInputElement | null;
            const text = String(input.value ?? formInput?.value ?? "").trim();
            if (!text) return;
            Promise.resolve(input.onSend(text)).then(() => {
              if (input.value === undefined && formInput) formInput.value = "";
              inputRef.current?.focus();
            });
          }}
        >
          <div className="relative grow min-w-0">
            <input
              ref={inputRef}
              name={input.name || "chatInput"}
              className="w-full px-2 py-1 rounded text-black text-xs"
              placeholder={input.placeholder}
              value={input.value}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                input.onInput?.(target.value);
                const mention = findActiveReferenceMention(
                  target.value,
                  target.selectionStart ?? target.value.length
                );
                setActiveReferenceMention(mention);
                input.onReferenceQuery?.(mention?.query || "");
                input.onTyping?.();
              }}
              onKeyUp={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                const mention = findActiveReferenceMention(
                  target.value,
                  target.selectionStart ?? target.value.length
                );
                setActiveReferenceMention(mention);
                input.onReferenceQuery?.(mention?.query || "");
              }}
              autoComplete="off"
              disabled={input.disabled}
            />
            {activeReferenceMention && (input.referenceSuggestions || []).length > 0 ? (
              <div className="absolute bottom-full left-0 right-0 z-[100004] mb-1 max-h-56 overflow-y-auto fancy-container bg-black/90 p-1 text-xs leading-tight shadow-lg">
                {(input.referenceSuggestions || []).map((result) => (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    className="flex min-h-9 w-full flex-col gap-0.5 px-2 py-1.5 text-left leading-tight hover:bg-white/10"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      input.onReferenceSelect?.(result, activeReferenceMention);
                      setActiveReferenceMention(null);
                    }}
                  >
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span className="truncate font-semibold">{result.label}</span>
                      <span className="shrink-0 opacity-70">[{result.kind}]</span>
                    </span>
                    {result.description ? (
                      <span className="block w-full truncate text-[11px] leading-tight opacity-70">
                        {result.description}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {input.beforeSendAction}
          <button
            className="fancy-container px-2 text-xs"
            disabled={input.disabled || input.submitDisabled}
            type="submit"
          >
            {input.sendLabel || "Send"}
          </button>
          {input.afterSendAction}
        </form>
        {disabledNote ? (
          <p className="text-[11px] px-1 opacity-80">{disabledNote}</p>
        ) : null}
      </FlexCol>
    </RndContainer>
  );
}
