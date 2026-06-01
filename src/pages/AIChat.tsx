import { useCallback, useState } from "preact/hooks";
import { Application } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";
import useRequest from "@hooks/request";
import ChatWindowTemplate, { TChatWindowMessage } from "@components/ChatWindowTemplate";

type TChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `-egy fantasy RPG játékban vagy, mint a kalandozók affelé spirituális segítője
-ne emlegesd a mivoltodat, papíron a "Jótündér Keresztanya" vagy, de se nem fizika, se nem szellemi lény. Egy narrátor.
-nincs mindenhol sárkány, szellem, stb., ez egy varázsvilág, de a kalandozók nem feltétlenül találkoznak ezekkel a lényekkel minden nap
-nem tudsz fizikailag interraktálni a kalandozókkal
-magyarul, szarkasztikusan, viccesen, tömören adj választ
-más nyelvű kérdésre válaszolj azzal, hogy nem érted a nyelvet!`;

export default function AIChat({
  close,
  classes,
}: {
  close: () => void;
  classes?: string;
}) {
  const [aiRequest] = useRequest(Application.REQUEST_CONTROLLER.AI);
  const [messages, setMessages] = useState<TChatMessage[]>([
    { role: "system", content: SYSTEM_PROMPT },
  ]);
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
    setMessages([{ role: "system", content: SYSTEM_PROMPT }]);
    setInput("");
    setLoading(false);
  }, []);

  // Filter out system messages for display
  const displayMessages: TChatWindowMessage[] = messages
    .filter((m) => m.role !== "system")
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
