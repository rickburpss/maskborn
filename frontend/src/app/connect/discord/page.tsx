"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

const healthUrl = `${API_URL}/api/health`;
const discordUrl = `${API_URL}/api/auth/discord/start`;
const oauthMessages: Record<string, string> = {
  "not-configured": "Discord is not configured on the server.",
  "invalid-state": "The Discord login expired or its secure state cookie was blocked. Please try again.",
  "token-failed": "Discord rejected the login exchange. Check the production redirect URI.",
  "profile-failed": "Discord signed in, but the profile could not be read.",
  "bot-account": "Bot accounts cannot verify a Mask Born profile.",
  "create-profile-first": "Create your Mask Born profile first, then link Discord.",
};

export default function DiscordConnectPage() {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [oauthError, setOauthError] = useState(() => {
    if (typeof window === "undefined") return "";
    const code = new URLSearchParams(window.location.search).get("error");
    return code ? oauthMessages[code] ?? "Discord login could not be completed." : "";
  });

  const wake = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (oauthError) return;
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const check = async () => {
      try {
        const response = await fetch(healthUrl, { credentials: "include", cache: "no-store" });
        const body = await response.json().catch(() => null) as { ok?: boolean } | null;
        if (response.ok && body?.ok) {
          window.location.assign(discordUrl);
          return;
        }
      } catch {
        // A sleeping free Render service commonly closes the first health request.
      }
      if (cancelled) return;
      if (Date.now() - startedAt > 90_000) {
        setFailed(true);
        return;
      }
      timer = window.setTimeout(check, 2_000);
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [attempt, oauthError]);

  return (
    <section className="discord-wake shell">
      {!oauthError && <LoaderCircle className="discord-wake-spinner" size={30} />}
      <p className="eyebrow">Discord identity</p>
      <h1>{oauthError ? "Discord did not connect." : failed ? "The order is taking too long." : "Waking the order."}</h1>
      <p>
        {oauthError || (failed
          ? "Try again and we will continue with Discord as soon as it is awake."
          : "Stay here your Discord login will open automatically when it is ready.")}
      </p>
      {(failed || oauthError) && <button className="button button-amber" onClick={() => {
        window.history.replaceState({}, "", "/connect/discord");
        setOauthError("");
        wake();
      }}>Try again <ArrowRight size={16} /></button>}
    </section>
  );
}
