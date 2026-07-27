"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

const healthUrl = `${API_URL}/api/health`;
const discordUrl = `${API_URL}/api/auth/discord/start`;

export default function DiscordConnectPage() {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const wake = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
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
  }, [attempt]);

  return (
    <section className="discord-wake shell">
      <LoaderCircle className="discord-wake-spinner" size={30} />
      <p className="eyebrow">Discord identity</p>
      <h1>{failed ? "The order is taking too long." : "Waking the order."}</h1>
      <p>
        {failed
          ? "Try again and we will continue with Discord as soon as it is awake."
          : "Stay here your Discord login will open automatically when it is ready."}
      </p>
      {failed && <button className="button button-amber" onClick={wake}>Try again <ArrowRight size={16} /></button>}
    </section>
  );
}
