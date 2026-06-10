import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-system-bg">
      <div className="text-center">
        <div className="font-mono text-xs text-protocol-slate">// 404</div>
        <h1 className="mt-2 text-2xl text-white font-mono">page not found</h1>
        <a href="/" className="mt-6 inline-block px-4 py-2 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors">
          ← home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-system-bg px-4">
      <div className="max-w-md text-center">
        <div className="font-mono text-xs text-protocol-slate">// runtime error</div>
        <h1 className="mt-2 text-xl text-white font-mono">{error.message || "Something went wrong"}</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 px-4 py-2 bg-logic-blue text-white font-mono text-sm hover:bg-white hover:text-black transition-colors"
        >
          retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f0f0f" },
      { title: "SIPA OS — The Non-Lying AI" },
      { name: "description", content: "Cognitive infrastructure for neurodivergent minds." },
      { property: "og:title", content: "SIPA OS — The Non-Lying AI" },
      { property: "og:description", content: "Cognitive infrastructure for neurodivergent minds." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-system-bg">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const onRedirectCallback = (appState?: AppState) => {
    const target = (appState?.returnTo as string | undefined) ?? "/app";
    router.navigate({ to: target });
  };

  if (typeof window === "undefined") {
    return <>{children}</>;
  }

  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN as string}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID as string}
      authorizationParams={{
        redirect_uri: window.location.origin + "/app",
        audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthShell>
        <Outlet />
        <Toaster theme="dark" position="bottom-right" />
      </AuthShell>
    </QueryClientProvider>
  );
}
