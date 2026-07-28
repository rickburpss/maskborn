"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { DotLoader } from "@/components/dot-loader";
import { apiFetch } from "@/lib/api";

type Restriction = {
  id: string;
  type: "VOTE" | "SUBMISSION" | "ACCOUNT";
  reasonCode: string;
  note: string | null;
  expiresAt: string;
};

type AbuseUser = {
  id: string;
  role: "USER" | "ADMIN";
  displayName: string | null;
  createdAt: string;
  recentRiskScore: number;
  socialAccounts: Array<{ provider: string; username: string }>;
  wallets: Array<{ address: string }>;
  restrictions: Restriction[];
  riskEvents: Array<{ id: string; eventType: string; score: number; createdAt: string }>;
  _count: { submissions: number; votes: number; voteEvents: number };
};

export function AdminAbusePanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [type, setType] = useState<Restriction["type"]>("VOTE");
  const [hours, setHours] = useState(6);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const abuse = useQuery({
    queryKey: ["mboadmin", "abuse", debouncedSearch],
    queryFn: ({ signal }) => apiFetch<{ items: AbuseUser[] }>(
      `/mboadmin/abuse?query=${encodeURIComponent(debouncedSearch)}&limit=25`,
      { signal },
    ),
    retry: false,
    staleTime: 15_000,
  });
  const items = abuse.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["mboadmin", "abuse"] });
  const restrict = useMutation({
    mutationFn: () => apiFetch(`/mboadmin/users/${selected!.id}/restrict`, {
      method: "POST",
      body: JSON.stringify({ type, hours, reason }),
    }),
    onSuccess: async () => {
      setReason("");
      await refresh();
    },
  });
  const lift = useMutation({
    mutationFn: (restrictionId: string) => apiFetch(`/mboadmin/restrictions/${restrictionId}/lift`, {
      method: "POST",
      body: JSON.stringify({ reason: "Lifted from the abuse monitor after administrator review." }),
    }),
    onSuccess: refresh,
  });

  return (
    <>
      <header className="admin-topbar">
        <div><p className="eyebrow">Admin / Abuse monitor</p><h1>Abuse monitor</h1></div>
        <label className="admin-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Username, wallet or user ID"
            maxLength={80}
          />
        </label>
      </header>
      <p className="abuse-guidance">
        Empty search shows accounts with recent risk signals or active restrictions. Restrictions expire automatically and every change is audited.
      </p>
      {abuse.isLoading && <DotLoader label="Checking risk signals" />}
      {abuse.isError && <div className="empty-state">The abuse monitor could not be loaded.</div>}
      {!abuse.isLoading && !abuse.isError && items.length === 0 && (
        <div className="empty-state">No matching risky accounts were found.</div>
      )}
      {selected && (
        <div className="abuse-layout">
          <section className="abuse-results">
            {items.map((user) => (
              <button
                type="button"
                key={user.id}
                className={selected.id === user.id ? "selected" : ""}
                onClick={() => setSelectedId(user.id)}
              >
                <span className="abuse-avatar">{user.displayName?.slice(0, 2).toUpperCase() || "MB"}</span>
                <span>
                  <b>{user.displayName ?? user.socialAccounts[0]?.username ?? "Unnamed member"}</b>
                  <small>{user.socialAccounts.map((account) => `@${account.username}`).join(" · ") || user.id}</small>
                </span>
                <span className="risk-score">{user.recentRiskScore}<small>24h risk</small></span>
              </button>
            ))}
          </section>
          <aside className="abuse-detail">
            <div className="abuse-detail-head">
              <ShieldAlert size={22} />
              <div><span>Account review</span><h2>{selected.displayName ?? "Unnamed member"}</h2></div>
            </div>
            <div className="abuse-facts">
              <div><span>Submissions</span><b>{selected._count.submissions}</b></div>
              <div><span>Current votes</span><b>{selected._count.votes}</b></div>
              <div><span>Vote actions</span><b>{selected._count.voteEvents}</b></div>
            </div>
            <div className="risk-events">
              <span>Recent signals</span>
              {selected.riskEvents.length ? selected.riskEvents.map((event) => (
                <p key={event.id}><b>{event.eventType}</b><span>+{event.score} · {new Date(event.createdAt).toLocaleString()}</span></p>
              )) : <p>No risk events in the last 24 hours.</p>}
            </div>
            {selected.restrictions.length > 0 && (
              <div className="active-restrictions">
                <span>Active restrictions</span>
                {selected.restrictions.map((restriction) => (
                  <div key={restriction.id}>
                    <p><b>{restriction.type}</b><small>Until {new Date(restriction.expiresAt).toLocaleString()}</small></p>
                    <button type="button" disabled={lift.isPending} onClick={() => lift.mutate(restriction.id)}>Lift</button>
                  </div>
                ))}
              </div>
            )}
            <div className="restriction-form">
              <label><span>Limit</span><select value={type} onChange={(event) => setType(event.target.value as Restriction["type"])}><option value="VOTE">Voting only</option><option value="SUBMISSION">Submissions only</option><option value="ACCOUNT">All site actions</option></select></label>
              <label><span>Hours</span><input type="number" min={1} max={8760} value={hours} onChange={(event) => setHours(Number(event.target.value))} /></label>
              <label className="restriction-reason"><span>Audit reason</span><textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Describe the observed behavior and evidence." /></label>
              <button
                type="button"
                className="button button-dark"
                disabled={selected.role === "ADMIN" || reason.trim().length < 4 || hours < 1 || hours > 8760 || restrict.isPending}
                onClick={() => restrict.mutate()}
              >
                <ShieldCheck size={15} /> Apply timed restriction
              </button>
            </div>
            {(restrict.isError || lift.isError) && (
              <p className="field-error"><AlertTriangle size={13} /> {(restrict.error ?? lift.error as Error).message}</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
