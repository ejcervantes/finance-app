import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Button, Card, Spinner } from "../components/ui";
import { Modal } from "../components/Modal";
import { SparklesIcon, SendIcon, ChartIcon } from "../components/icons";
import type { ChatResponse, InsightsResponse, MessageRead } from "../lib/types";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

let nextId = 1;

export function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<MessageRead[]>("/assistant/history")
      .then((h) => setMessages(h.map((m) => ({ id: nextId++, role: m.role, content: m.content }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { id: nextId++, role: "user", content: text }]);
    setSending(true);
    try {
      const res = await api.post<ChatResponse>("/assistant/chat", { message: text });
      setMessages((m) => [...m, { id: nextId++, role: "assistant", content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { id: nextId++, role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "Error"}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">Asesor</h1>
          <p className="text-sm text-muted">Pregúntale con tus datos reales. No inventa cifras.</p>
        </div>
        <Button variant="secondary" onClick={() => setShowInsights(true)}>
          <ChartIcon width={18} height={18} />
          Análisis del mes
        </Button>
      </div>

      <Card className="flex h-[calc(100vh-13rem)] flex-col p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !sending && (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <SparklesIcon width={40} height={40} className="mx-auto text-primary" />
                <p className="mt-3 font-bold text-fg">Tu asesor de finanzas</p>
                <p className="mt-1 text-sm text-muted">
                  Pregúntale cómo vas, en qué gastas de más, o si te alcanza para una compra
                  (“¿me alcanza para un carro de ₡8.000.000?”).
                </p>
              </div>
            </div>
          )}
          {messages.map((m) => <Bubble key={m.id} message={m} />)}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">
                <Spinner className="h-4 w-4" /> Pensando…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale a tu asesor…"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:border-primary/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Enviar"
            className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-primary text-primary-fg transition hover:opacity-90 disabled:opacity-40"
          >
            <SendIcon width={18} height={18} />
          </button>
        </form>
      </Card>

      {showInsights && <InsightsModal onClose={() => setShowInsights(false)} />}
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg"}`}>
        <MdText text={message.content} />
      </div>
    </div>
  );
}

/** Render simple: **negritas** + saltos de línea. */
function MdText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </span>
  );
}

function InsightsModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<InsightsResponse>("/assistant/insights").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  return (
    <Modal open onClose={onClose} title="Análisis del mes">
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !data ? (
        <div className="grid place-items-center py-10"><Spinner className="h-7 w-7 text-primary" /></div>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-bold text-muted">Señales del mes</h3>
            <ul className="space-y-2">
              {data.signals.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-fg">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-muted">Consejos</h3>
            <p className="text-sm text-fg"><MdText text={data.advice} /></p>
          </div>
        </div>
      )}
    </Modal>
  );
}
