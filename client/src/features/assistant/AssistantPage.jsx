import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { api, dataOf } from "../../lib/api";
import { PageHeader } from "../dashboard/Dashboard";
const prompts = [
  "Which bridges require attention?",
  "Why is BR-102 high risk?",
  "What happens if BR-102 fails?",
  "What are our single points of failure?",
];
export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(message = input) {
    if (!message.trim() || busy) return;
    setInput("");
    setMessages([...messages, { role: "user", text: message }]);
    setBusy(true);
    try {
      const result = await dataOf(api.post("/assistant/chat", { message }));
      setMessages((items) => [
        ...items,
        { role: "assistant", text: result.answer, sources: result.sources },
      ]);
    } catch {
      setMessages((items) => [
        ...items,
        { role: "assistant", text: "Assistant is temporarily unavailable." },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader eyebrow="Decision support" title="InfraLife assistant" />
      <section className="assistant-layout">
        <div className="panel chat-panel">
          <div className="chat-messages">
            {!messages.length && (
              <div className="assistant-empty">
                <Bot size={34} />
                <h2>Ask about the corridor</h2>
                <p>
                  Answers are grounded in current asset, risk, graph, and
                  maintenance records.
                </p>
              </div>
            )}
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={index}>
                <span>{message.text}</span>
                {message.sources?.map((source) => (
                  <small
                    className="source-chip"
                    key={`${source.assetId}-${source.label}`}
                  >
                    {source.assetId} / {source.label}
                  </small>
                ))}
              </div>
            ))}
            {busy && (
              <div className="message assistant">
                Looking through the register...
              </div>
            )}
          </div>
          <div className="suggestions">
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about an asset or dependency..."
            />
            <button className="icon-button">
              <Send size={17} />
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
