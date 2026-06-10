import { createFileRoute } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccessToken } from "@/lib/use-access-token";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThread,
});

type Part = { type: "text"; text: string };
type Msg = {
  id: string;
  thread_id: string;
  user_id: string;
  message: { role: "user" | "assistant"; parts: Part[] };
  created_at: string;
};

function ChatThread() {
  const { threadId } = Route.useParams();
  const { token } = useAccessToken();
  const { user } = useAuth0();
  const supabase = useMemo(() => (token ? getSupabase(token) : null), [token]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    setMessages([]);
    supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setMessages((data ?? []) as Msg[]);
      });
  }, [supabase, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !supabase || !user?.sub || !token) return;
    setSending(true);
    const userMsg = {
      thread_id: threadId,
      user_id: user.sub,
      message: { role: "user" as const, parts: [{ type: "text" as const, text }] },
    };
    setInput("");

    const { data: insertedUser, error: e1 } = await supabase
      .from("chat_messages")
      .insert(userMsg)
      .select()
      .single();
    if (e1) { toast.error(e1.message); setSending(false); return; }
    setMessages((m) => [...m, insertedUser as Msg]);

    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("chat_threads").update({ title, updated_at: new Date().toISOString() }).eq("id", threadId);
    } else {
      await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    }

    try {
      const history = [...messages, insertedUser as Msg].map((m) => ({
        role: m.message.role,
        content: m.message.parts.map((p) => p.text).join(""),
      }));
      const res = await fetch(import.meta.env.VITE_CHAT_GATEWAY as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history, thread_id: threadId }),
      });
      if (!res.ok) throw new Error(`Gateway ${res.status}`);
      const ct = res.headers.get("content-type") ?? "";
      let replyText = "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        replyText = j.reply ?? j.content ?? j.message ?? j.text ?? JSON.stringify(j);
      } else {
        replyText = await res.text();
      }

      const aiMsg = {
        thread_id: threadId,
        user_id: user.sub,
        message: { role: "assistant" as const, parts: [{ type: "text" as const, text: replyText }] },
      };
      const { data: insertedAI, error: e2 } = await supabase
        .from("chat_messages")
        .insert(aiMsg)
        .select()
        .single();
      if (e2) throw e2;
      setMessages((m) => [...m, insertedAI as Msg]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-8 space-y-4">
        {messages.length === 0 && (
          <div className="font-mono text-xs text-protocol-slate text-center pt-12">
            // empty thread — send a message to start
          </div>
        )}
        {messages.map((m) => {
          const isUser = m.message.role === "user";
          const text = m.message.parts.map((p) => p.text).join("");
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 text-sm whitespace-pre-wrap ${isUser ? "bg-logic-blue text-white" : "bg-white/5 text-white border border-white/5"}`}>
                <div className="font-mono text-[10px] mb-1 opacity-60">
                  {isUser ? "// you" : "// sipa"}
                </div>
                {text}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-3 text-sm bg-white/5 border border-white/5">
              <div className="font-mono text-xs text-protocol-slate animate-pulse">// thinking…</div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="border-t border-white/5 p-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          disabled={sending}
          className="flex-1 bg-black/40 border border-white/5 px-4 py-3 text-white font-sans text-sm focus:outline-none focus:border-logic-blue"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-5 py-3 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-50"
        >
          Send →
        </button>
      </form>
    </div>
  );
}
