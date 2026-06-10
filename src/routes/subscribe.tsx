import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/subscribe")({
  component: Subscribe,
});

function Subscribe() {
  return (
    <div className="min-h-screen bg-system-bg flex flex-col">
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo />
        <Link to="/app" className="font-mono text-xs text-protocol-slate hover:text-white transition-colors">
          ← back
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="font-mono text-xs text-logic-blue">// billing</div>
        <h1 className="mt-2 text-4xl text-white font-mono">// Upgrade to PRO</h1>
        <p className="mt-4 text-sm text-protocol-slate max-w-md text-center">
          Unlock unlimited dumps, longer chat memory, and priority gateway access.
        </p>

        <div className="mt-12 grid md:grid-cols-2 gap-px bg-white/5 max-w-3xl w-full">
          <div className="bg-system-bg p-8">
            <div className="font-mono text-xs text-protocol-slate">// 01</div>
            <h2 className="mt-3 text-2xl text-white font-mono">BASIC</h2>
            <div className="mt-4 text-3xl text-white font-mono">$0</div>
            <ul className="mt-6 space-y-2 text-sm text-protocol-slate">
              <li>// 100 dumps / month</li>
              <li>// 50 chat messages / day</li>
              <li>// 7-day history</li>
            </ul>
            <button disabled className="mt-8 w-full px-4 py-3 border border-white/10 text-protocol-slate font-mono text-sm cursor-not-allowed">
              Current plan
            </button>
          </div>
          <div className="bg-system-bg p-8 border-t md:border-t-0 md:border-l border-logic-blue">
            <div className="font-mono text-xs text-logic-blue">// 02</div>
            <h2 className="mt-3 text-2xl text-white font-mono">PRO</h2>
            <div className="mt-4 text-3xl text-white font-mono">$9.99<span className="text-sm text-protocol-slate">/mo</span></div>
            <ul className="mt-6 space-y-2 text-sm text-protocol-slate">
              <li>// unlimited dumps</li>
              <li>// unlimited chat</li>
              <li>// full history + export</li>
              <li>// priority gateway</li>
            </ul>
            <button className="mt-8 w-full px-4 py-3 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors">
              Upgrade →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
