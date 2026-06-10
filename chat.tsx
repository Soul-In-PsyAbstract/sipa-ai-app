import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";
import { useAccessToken } from "@/lib/use-access-token";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  component: ChatLayoutPage,
});

export type Thread = {
  id: string;
  user_id: string;
  title: string | null;
  updated_at: string;
};

function ChatLayoutPage() {
  return (
    <AuthGate returnTo="/chat">
      <ChatLayout />
    </AuthGate>
  );
}

function ChatLayout() {
  const { logout, user } = useAuth0();
  const { token } = useAccessToken();
  const navigate = useNavigate();
  const supabase = useMemo(() => (token ? getSupabase(token) : null), [token]);

  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [search, setSearch] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("chat_threads")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        const t = (data ?? []) as Thread[];
        setThreads(t);
        if (t.length > 0) {
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("thread_id, message, created_at")
            .in("thread_id", t.map((x) => x.id))
            .order("created_at", { ascending: true });
          const p: Record<string, string> = {};
          (msgs ?? []).forEach((m: { thread_id: string; message: { parts?: Array<{ text?: string }> } }) => {
            if (!p[m.thread_id]) {
              const text = m.message?.parts?.[0]?.text ?? "";
              p[m.thread_id] = text;
            }
          });
          setPreviews(p);
        }
      });
  }, [supabase]);

  const createThread = async () => {
    if (!supabase || !user?.sub) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: user.sub, title: "New chat" })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    const t = data as Thread;
    setThreads((prev) => [t, ...prev]);
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  };

  const deleteThread = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) navigate({ to: "/chat" });
  };

  const filtered = threads.filter((t) =>
    !search ||
    (t.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (previews[t.id] ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-system-bg">
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1 font-mono text-xs">
          <Link to="/app" className="px-3 py-1.5 text-protocol-slate hover:text-white transition-colors">Dump</Link>
          <Link to="/chat" className="px-3 py-1.5 text-white border-b-2 border-logic-blue">Chat</Link>
        </div>
        <button
          onClick={() => {
            logout({ logoutParams: { returnTo: window.location.origin } });
            navigate({ to: "/" });
          }}
          className="font-mono text-xs text-protocol-slate hover:text-white transition-colors"
        >
          Sign out
        </button>
      </nav>

      <div className="flex-1 flex min-h-0">
        <aside className="w-64 border-r border-white/5 flex flex-col">
          <div className="p-3 border-b border-white/5">
            <button
              onClick={createThread}
              className="w-full px-3 py-2 bg-logic-blue text-white font-mono text-xs hover:bg-white hover:text-black transition-colors"
            >
              + New chat
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="mt-2 w-full bg-black/40 border border-white/5 px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-logic-blue"
            />
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 && (
              <div className="p-4 font-mono text-[10px] text-protocol-slate">// no threads</div>
            )}
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`group flex items-start gap-2 px-3 py-2 border-b border-white/5 cursor-pointer ${activeId === t.id ? "bg-white/5" : "hover:bg-white/[0.02]"}`}
                onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: t.id } })}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-white truncate">{t.title || "Untitled"}</div>
                  <div className="text-[10px] text-protocol-slate truncate">{previews[t.id] || "—"}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                  className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-protocol-slate hover:text-white"
                  aria-label="delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
