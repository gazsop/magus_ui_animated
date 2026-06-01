import { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { FlexCol } from "@components/Flex";
import RndContainer from "@components/RndContainer";

export type TChatWindowMessage = {
  id: string;
  author: string;
  content: string | JSX.Element;
  side: "self" | "other";
};

export type TChatWindowLogEntry = {
  id: string;
  line: string;
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
    onInput?: (value: string) => void;
    onTyping?: () => void;
    onSend: (text: string) => void | Promise<void>;
  };
  disabledNote?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loadingLabel]);

  return (
    <RndContainer
      id={id}
      aditionalIcons={aditionalIcons}
      close={close}
      label={label}
      className={classes}
    >
      <FlexCol className="w-full h-full min-h-0 p-2 gap-2">
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
              className={`rounded px-2 py-1 ${
                message.side === "self"
                  ? "bg-slate-600/40 self-end max-w-[80%]"
                  : "bg-slate-700/40 self-start max-w-[90%]"
              }`}
            >
              <p className="font-bold opacity-70 mb-0.5 text-[10px] uppercase tracking-wider">
                {message.author}
              </p>
              {typeof message.content === "string" ? (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              ) : (
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
              )}
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
          className="flex gap-2"
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
          <input
            ref={inputRef}
            name={input.name || "chatInput"}
            className="grow min-w-0 px-2 py-1 rounded text-black text-xs"
            placeholder={input.placeholder}
            value={input.value}
            onInput={(e) => {
              input.onInput?.((e.target as HTMLInputElement).value);
              input.onTyping?.();
            }}
            autoComplete="off"
            disabled={input.disabled}
          />
          <button
            className="fancy-container px-2 text-xs"
            disabled={input.disabled || input.submitDisabled}
            type="submit"
          >
            {input.sendLabel || "Send"}
          </button>
        </form>
        {disabledNote ? (
          <p className="text-[11px] px-1 opacity-80">{disabledNote}</p>
        ) : null}
      </FlexCol>
    </RndContainer>
  );
}
