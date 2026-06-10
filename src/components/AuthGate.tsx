import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

export function AuthGate({ children, returnTo }: { children: ReactNode; returnTo?: string }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const dest = returnTo ?? pathname;
      navigate({ to: "/login", search: { returnTo: dest } as never });
    }
  }, [isAuthenticated, isLoading, navigate, returnTo, pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-system-bg">
        <div className="font-mono text-xs text-protocol-slate">// authenticating…</div>
      </div>
    );
  }
  return <>{children}</>;
}
