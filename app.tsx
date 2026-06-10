import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";
import { useAccessToken } from "@/lib/use-access-token";
import { getSupabase } from "@/lib/supabase";
import { sha256 } from "@/lib/sha256";

export const Route = createFileRoute("/app")({
  component: BrainDumpPage,
});

type Dump = {
  id: string;
  user_id: string;
  content: string;
  tags: string[] | null;
  sha256: string;
  created_at: string;
};

function BrainDumpPage() {
  return (
    <AuthGate>
      <BrainDump />
    </AuthGate>
  );
}

function BrainDump() {
  const { logout, user } = useAuth0();
  const { token } = useAccessToken();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [dumps, setDumps] = useState<Dump[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => (token ? getSupabase(token) : null), [token]);

  useEffect(() => {
    if (!supabase || !user?.sub) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("dumps")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
        } else {
          setDumps((data ?? []) as Dump[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [supabase, user?.sub]);

  const save = async () => {
    if (!content.trim() || !supabase || !user?.sub) return;
    setSaving(true);
    try {
      const hash = await sha256(content);
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from("dumps")
        .insert({ user_id: user.sub, content, tags, sha256: hash })
        .select()
        .single();
      if (error) throw error;
      setDumps((d) => [data as Dump, ...d]);
      setContent("");
      setTagsInput("");
      toast.success("Dump saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const allTags = useMemo(() => {
    const s = new Set<string>();
    dumps.forEach((d) => d.tags?.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [dumps]);

  const filtered = dumps.filter((d) => {
    if (activeTag && !d.tags?.includes(activeTag)) return false;
    if (query && !d.content.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-system-bg flex flex-col">
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1 font-mono text-xs">
          <Link to="/app" className="px-3 py-1.5 text-white border-b-2 border-logic-blue">Dump</Link>
          <Link to="/chat" className="px-3 py-1.5 text-protocol-slate hover:text-white transition-colors">Chat</Link>
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

      <main className="flex-1 grid md:grid-cols-2 gap-px bg-white/5">
        <section className="bg-system-bg p-6 flex flex-col">
          <div className="font-mono text-xs text-logic-blue mb-3">// new entry</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Dump your thoughts…"
            className="flex-1 min-h-[300px] bg-black/40 border border-white/5 p-4 text-white font-sans text-sm resize-none focus:outline-none focus:border-logic-blue"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="tags, comma, separated"
            className="mt-3 bg-black/40 border border-white/5 p-3 text-white font-mono text-xs focus:outline-none focus:border-logic-blue"
          />
          <button
            onClick={save}
            disabled={saving || !content.trim()}
            className="mt-3 px-4 py-3 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </section>

        <section className="bg-system-bg p-6 flex flex-col">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dumps…"
            className="bg-black/40 border border-white/5 p-3 text-white font-mono text-xs focus:outline-none focus:border-logic-blue"
          />
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTag(null)}
                className={`px-2 py-1 font-mono text-[10px] border ${!activeTag ? "border-logic-blue text-logic-blue" : "border-white/10 text-protocol-slate hover:text-white"}`}
              >
                all
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                  className={`px-2 py-1 font-mono text-[10px] border ${activeTag === t ? "border-logic-blue text-logic-blue" : "border-white/10 text-protocol-slate hover:text-white"}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex-1 overflow-auto space-y-2">
            {loading && <div className="font-mono text-xs text-protocol-slate">// loading…</div>}
            {!loading && filtered.length === 0 && (
              <div className="font-mono text-xs text-protocol-slate">// no dumps yet</div>
            )}
            {filtered.map((d) => (
              <article key={d.id} className="border border-white/5 p-4 hover:border-white/10 transition-colors">
                <p className="text-sm text-white whitespace-pre-wrap line-clamp-4">{d.content}</p>
                {d.tags && d.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.tags.map((t) => (
                      <span key={t} className="font-mono text-[10px] text-logic-blue">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-protocol-slate">
                  <span>{new Date(d.created_at).toLocaleString()}</span>
                  <span title={d.sha256}>sha:{d.sha256.slice(0, 12)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
