import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeSupabaseClient } from "@/integrations/supabase/client-auth";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Brain Dump — SIPA OS" }] }),
  component: AppPage,
});

type Dump = {
  id: string;
  content: string;
  tags: string[];
  sha256: string;
  created_at: string;
};

type Profile = { display_name: string | null; plan: "BASIC" | "PRO" };

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function AppPage() {
  const { user, accessToken, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dumps, setDumps] = useState<Dump[]>([]);
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !accessToken) navigate({ to: "/login" });
  }, [accessToken, loading, navigate]);

  useEffect(() => {
    if (!user || !accessToken) return;
    const db = makeSupabaseClient(accessToken);
    (async () => {
      const [{ data: p }, { data: d }] = await Promise.all([
        db.from("profiles").select("display_name, plan").eq("id", user.id).maybeSingle(),
        db.from("dumps").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProfile(p as Profile | null);
      setDumps((d ?? []) as Dump[]);
    })();
  }, [user, accessToken]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    dumps.forEach((d) => d.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [dumps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dumps.filter((d) => {
      if (activeTag && !d.tags.includes(activeTag)) return false;
      if (q && !d.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dumps, search, activeTag]);

  const handleSave = async () => {
    if (!content.trim() || !user || !accessToken) return;
    setSaving(true);
    try {
      const db = makeSupabaseClient(accessToken);
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const hash = await sha256(content);
      const { data, error } = await db
        .from("dumps")
        .insert({ user_id: user.id, content: content.trim(), tags, sha256: hash })
        .select()
        .single();
      if (error) throw error;
      setDumps((prev) => [data as Dump, ...prev]);
      setContent("");
      setTagsInput("");
      toast.success(`Saved · ${hash.slice(0, 12)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    const db = makeSupabaseClient(accessToken);
    const { error } = await db.from("dumps").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setDumps((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading || !accessToken) {
    return (
      <div className="min-h-screen bg-system-bg flex items-center justify-center">
        <span className="font-mono text-xs text-protocol-slate/60 tracking-widest">// LOADING SESSION...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-system-bg text-protocol-slate font-sans">
      <nav className="border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="size-7 bg-logic-blue rounded-sm flex items-center justify-center text-system-bg font-bold text-sm">S</div>
            <span className="font-mono text-[11px] tracking-widest text-white">SIPA OS</span>
          </Link>
          <div className="flex gap-1 font-mono text-[10px] uppercase tracking-widest">
            <Link to="/app" className="px-3 py-1 text-white border-b border-logic-blue">Dump</Link>
            <Link to="/chat" className="px-3 py-1 text-protocol-slate/60 hover:text-white transition-colors">Chat</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-mono text-[10px] text-white">{profile?.display_name ?? user?.email}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-logic-blue">
              ★ Plan: {profile?.plan ?? "BASIC"}
            </div>
          </div>
          <button
            onClick={signOut}
            className="font-mono text-[10px] uppercase tracking-widest text-protocol-slate/60 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-light text-white mb-1">🧠 Brain Dump</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-protocol-slate/60">
            Выгрузи мозг — текст · идея · задача · мысль
          </p>
        </header>

        <section className="border border-white/10 bg-white/[0.02] p-5 mb-10">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Что у тебя в голове прямо сейчас..."
            rows={5}
            className="w-full bg-transparent text-white font-mono text-sm placeholder:text-protocol-slate/30 focus:outline-none resize-none"
          />
          <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-3 border-t border-white/5">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="теги: идея, задача, дамп"
              className="flex-1 bg-transparent border border-white/10 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-logic-blue transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="px-6 py-2 bg-logic-blue text-white font-mono text-[11px] uppercase tracking-widest hover:bg-white hover:text-black transition-all disabled:opacity-30"
            >
              {saving ? "Hashing..." : "Сохранить + SHA256"}
            </button>
          </div>
        </section>

        <section className="mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по записям..."
            className="flex-1 bg-transparent border border-white/10 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-logic-blue transition-colors"
          />
          <div className="font-mono text-[10px] uppercase tracking-widest text-protocol-slate/60 self-center">
            {filtered.length} / {dumps.length} записей
          </div>
        </section>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTag(null)}
              className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border transition-colors ${
                activeTag === null ? "border-logic-blue text-white" : "border-white/10 text-protocol-slate/60 hover:text-white"
              }`}
            >
              all
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
                className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border transition-colors ${
                  activeTag === t ? "border-logic-blue text-white" : "border-white/10 text-protocol-slate/60 hover:text-white"
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        <ul className="space-y-3">
          {filtered.length === 0 && (
            <li className="text-center py-16 font-mono text-xs text-protocol-slate/40 tracking-widest uppercase">
              // No dumps yet
            </li>
          )}
          {filtered.map((d) => (
            <li key={d.id} className="border border-white/10 bg-white/[0.02] p-4 group">
              <p className="text-white text-sm whitespace-pre-wrap mb-3">{d.content}</p>
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-protocol-slate/50">
                <span>{new Date(d.created_at).toLocaleString()}</span>
                <span className="text-logic-blue">sha256: {d.sha256.slice(0, 16)}...</span>
                {d.tags.map((t) => (
                  <span key={t} className="text-white/70">#{t}</span>
                ))}
                <button
                  onClick={() => handleDelete(d.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                >
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}