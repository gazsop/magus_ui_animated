import { useCallback, useState } from "preact/hooks";
import { Application } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";
import useRequest from "@hooks/request";
import ChatWindowTemplate, { TChatWindowMessage } from "@components/ChatWindowTemplate";

type TChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function AIChat({
  close,
  classes,
}: {
  close: () => void;
  classes?: string;
}) {
  const [aiRequest] = useRequest(Application.REQUEST_CONTROLLER.AI);
  const [messages, setMessages] = useState<TChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(
    (text: string) => {
      if (!text || loading) return;

      const userMessage: TChatMessage = { role: "user", content: text };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);

      aiRequest<ServerApi.AiRoutes.ChatResponse, ServerApi.AiRoutes.ChatBody>({
        endPoint: "/chat",
        errorMode: "quiet",
        body: {
          model: "deepseek-chat",
          messages: updatedMessages,
          temperature: 0.7,
          maxTokens: 2048,
        },
      })
        .then((response) => {
          const reply = response.data?.reply ?? "";
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Jótündér Keresztanya most nem tud válaszolni" },
          ]);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [loading, messages, aiRequest]
  );

  const handleReset = useCallback(() => {
    setMessages([]);
    setInput("");
    setLoading(false);
  }, []);

  const displayMessages: TChatWindowMessage[] = messages
    .map((msg, idx) => ({
      id: `${msg.role}-${idx}`,
      author: msg.role === "user" ? "Te" : "Jótündér Keresztanya",
      content: msg.content,
      side: msg.role === "user" ? "self" : "other",
    }));

  return (
    <ChatWindowTemplate
      id="ai-chat-window"
      aditionalIcons={
        <button
          className="fancy-container px-1.5 py-0.5 text-[11px]"
          onClick={handleReset}
          title="Reset conversation"
          type="button"
        >
          Reset
        </button>
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
