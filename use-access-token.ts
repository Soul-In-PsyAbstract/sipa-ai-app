import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export function useAccessToken() {
  const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isLoading) return;
    if (!isAuthenticated) {
      setToken(null);
      setReady(true);
      return;
    }
    getAccessTokenSilently()
      .then((t) => {
        if (!cancelled) {
          setToken(t);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently, isAuthenticated, isLoading]);

  return { token, ready: ready && !isLoading, isAuthenticated };
}
