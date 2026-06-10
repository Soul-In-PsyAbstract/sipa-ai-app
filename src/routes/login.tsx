import { createFileRoute } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { Logo } from "@/components/Logo";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

const searchSchema = z.object({
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

type Provider = {
  key: string;
  label: string;
  connection: string;
};

const PROVIDERS: Provider[] = [
  { key: "google", label: "Continue with Google", connection: "google-oauth2" },
  { key: "microsoft", label: "Continue with Microsoft", connection: "windowslive" },
  { key: "github", label: "Continue with GitHub", connection: "github" },
  { key: "mail-ru", label: "Continue with Mail.ru", connection: "mailru" },
];

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const { loginWithRedirect, isLoading } = useAuth0();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const redirectUri = typeof window !== "undefined" ? window.location.origin + "/app" : undefined;

  const loginWith = (connection?: string) => {
    loginWithRedirect({
      appState: { returnTo: returnTo ?? "/app" },
      authorizationParams: {
        redirect_uri: redirectUri,
        ...(connection ? { connection } : {}),
      },
    });
  };

  const sendMagicLink = async () => {
    if (!email) {
      toast.error("Enter your email");
      return;
    }
    setSending(true);
    try {
      loginWithRedirect({
        appState: { returnTo: returnTo ?? "/app" },
        authorizationParams: {
          redirect_uri: redirectUri,
          connection: "email",
          login_hint: email,
        },
      });
    } catch (err) {
      toast.error("Failed to send magic link");
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-system-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Logo />
        </div>
        <div className="border border-white/5 p-8 bg-system-bg">
          <div className="font-mono text-xs text-logic-blue">// secure session</div>
          <h1 className="mt-2 text-2xl text-white font-mono">// Authenticate</h1>
          <p className="mt-4 text-sm text-protocol-slate">
            Choose a provider or use a magic link.
          </p>

          <div className="mt-6 space-y-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.key}
                onClick={() => loginWith(p.connection)}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-white/10 text-white font-mono text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-50 text-left"
              >
                {p.label} →
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-mono text-[10px] text-protocol-slate">OR</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="mt-6">
            <label className="font-mono text-[10px] text-protocol-slate">// magic link</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="mt-2 w-full px-3 py-2 bg-black border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-logic-blue"
            />
            <button
              onClick={sendMagicLink}
              disabled={sending || isLoading}
              className="mt-3 w-full px-4 py-3 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-50"
            >
              {sending ? "..." : "Send magic link →"}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center font-mono text-[10px] text-protocol-slate">
          Powered by Auth0
        </div>
      </div>
    </div>
  );
}
