import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    // @ts-expect-error BeforeInstallPromptEvent
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen bg-system-bg flex flex-col">
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-6 font-mono text-xs">
          <Link to="/login" search={{ returnTo: "/chat" } as never} className="px-3 py-1.5 bg-logic-blue text-white hover:bg-white hover:text-black transition-colors">
            Открыть AI Chat
          </Link>
          <Link to="/login" className="text-protocol-slate hover:text-white transition-colors">
            Войти
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <div className="font-mono text-xs text-logic-blue mb-6">// system online</div>
          <h1 className="text-5xl md:text-7xl font-mono text-white tracking-tight leading-[1.05]">
            // AI is practice
          </h1>
          <p className="mt-8 text-lg text-protocol-slate max-w-xl mx-auto">
            Cognitive infrastructure for neurodivergent minds.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link to="/login" className="px-5 py-3 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors">
              Brain Dump →
            </Link>
            <Link to="/login" search={{ returnTo: "/chat" } as never} className="px-5 py-3 border border-white/10 text-white font-mono text-sm hover:bg-white hover:text-black transition-colors">
              Open Chat →
            </Link>
            {installPrompt && (
              <button onClick={install} className="px-5 py-3 border border-logic-blue text-logic-blue font-mono text-sm hover:bg-logic-blue hover:text-white transition-colors">
                Install App ↓
              </button>
            )}
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-px bg-white/5 max-w-5xl w-full">
          {[
            { tag: "01", title: "Brain Dump", body: "Capture thoughts with tags, search, and SHA-256 integrity hashes." },
            { tag: "02", title: "AI Chat", body: "Threaded conversations with the non-lying AI. Persistent across sessions." },
            { tag: "03", title: "Secure & Private", body: "Auth0 + Supabase RLS. Your data is yours. Always encrypted in transit." },
          ].map((f) => (
            <div key={f.tag} className="bg-system-bg p-8">
              <div className="font-mono text-xs text-logic-blue">// {f.tag}</div>
              <h3 className="mt-4 text-xl text-white font-mono">{f.title}</h3>
              <p className="mt-3 text-sm text-protocol-slate leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 px-6 py-6 text-center">
        <div className="font-mono text-xs text-protocol-slate">
          Powered by Auth0 · SIPA OS · soulinpsyabstract.llc
        </div>
      </footer>
    </div>
  );
}
