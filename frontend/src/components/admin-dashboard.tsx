"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Clock3, Search, ShieldCheck, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import { DotLoader } from "@/components/dot-loader";
import { apiFetch } from "@/lib/api";
import { AdminAbusePanel } from "@/components/admin-abuse-panel";

type ReviewItem = {
  id: string;
  title: string;
  kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
  categories: string[];
  previewAssetUrl: string;
  publishedAt: string;
  upvoteCount: number;
  downvoteCount: number;
  user: { displayName: string | null; socialAccounts: Array<{ username: string }> };
};

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Newest");
  const [view, setView] = useState<"review" | "abuse">("review");
  const queue = useQuery({
    queryKey: ["mboadmin", "review-queue"],
    queryFn: () => apiFetch<{ items: ReviewItem[] }>("/mboadmin/review-queue"),
    retry: false,
    enabled: view === "review",
  });

  const allItems = queue.data?.items;
  const items = useMemo(() => {
    const source = allItems ?? [];
    const normalized = search.trim().toLowerCase();
    const filtered = source.filter((item) => {
      const username = item.user.socialAccounts[0]?.username ?? "";
      return !normalized || `${item.title} ${item.user.displayName ?? ""} ${username} ${item.categories.join(" ")}`
        .toLowerCase().includes(normalized);
    });
    if (sort === "Highest score") filtered.sort((a, b) =>
      (b.upvoteCount - b.downvoteCount) - (a.upvoteCount - a.downvoteCount));
    else if (sort === "Most votes") filtered.sort((a, b) =>
      (b.upvoteCount + b.downvoteCount) - (a.upvoteCount + a.downvoteCount));
    else filtered.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    return filtered;
  }, [allItems, search, sort]);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const review = useMutation({
    mutationFn: (decision: "ACCEPTED" | "REJECTED") => apiFetch(`/mboadmin/submissions/${selected!.id}/review`, {
      method: "PUT",
      body: JSON.stringify({ decision, note }),
    }),
    onSuccess: async () => {
      setNote("");
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["mboadmin", "review-queue"] });
    },
  });

  if (view === "abuse") {
    return (
      <section className="admin-shell">
        <aside className="admin-nav">
          <div><span className="admin-mark">MBO</span><p>Control room</p></div>
          <nav>
            <button onClick={() => setView("review")}>Review queue</button>
            <button className="active">Abuse monitor</button>
          </nav>
          <div className="admin-user"><span>AD</span><div><b>Signed-in admin</b><p>Administrator</p></div></div>
        </aside>
        <main className="admin-main"><AdminAbusePanel /></main>
      </section>
    );
  }

  return (
    <section className="admin-shell">
      <aside className="admin-nav">
        <div><span className="admin-mark">MBO</span><p>Control room</p></div>
        <nav>
          <button className="active">Review queue</button>
          <button onClick={() => setView("abuse")}>Abuse monitor</button>
        </nav>
        <div className="admin-user"><span>AD</span><div><b>Signed-in admin</b><p>Administrator</p></div></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div><p className="eyebrow">Admin / Review queue</p><h1>Review queue</h1></div>
          <div className="admin-actions">
            <label className="admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search queue" /></label>
            <label className="select-wrap"><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Newest</option><option>Highest score</option><option>Most votes</option></select><ChevronDown size={14} /></label>
          </div>
        </header>
        <div className="admin-stats">
          <article><span>Waiting for review</span><b>{allItems?.length ?? 0}</b><p><Clock3 size={13} /> Live queue</p></article>
          <article><span>Accepted this week</span><b>—</b><p><Check size={13} /> Not loaded on this screen</p></article>
          <article><span>Vote restrictions</span><b>—</b><p><ShieldCheck size={13} /> Not loaded on this screen</p></article>
          <article><span>Pending payouts</span><b>—</b><p>Not loaded on this screen</p></article>
        </div>
        {queue.isLoading && <DotLoader label="Loading the review queue" />}
        {queue.isError && <div className="empty-state">The review queue could not be loaded. Confirm this account has admin access.</div>}
        {!queue.isLoading && !queue.isError && items.length === 0 && <div className="empty-state">{allItems?.length ? "No submissions match those filters." : "There are no submissions waiting for review."}</div>}
        {selected && (
          <div className="review-layout">
            <section className="review-queue">
              <div className="review-head"><h2>Incoming work</h2></div>
              {items.map((art) => {
                const username = art.user.socialAccounts[0]?.username;
                const creator = username ? `@${username}` : art.user.displayName ?? "Mask Born member";
                return (
                  <button className={selected.id === art.id ? "selected" : ""} onClick={() => setSelectedId(art.id)} key={art.id}>
                    <PixelArtwork source={art.previewAssetUrl} label={art.title} />
                    <div><span>{art.kind === "ONE_OF_ONE" ? "1/1" : art.categories.join(" + ")} · {new Date(art.publishedAt).toLocaleDateString()}</span><b>{art.title}</b><p>{creator}</p></div>
                    <div className="queue-score"><b>{art.upvoteCount - art.downvoteCount}</b><span>score</span></div>
                    <ArrowRight size={16} />
                  </button>
                );
              })}
            </section>
            <aside className="review-detail">
              <div className="review-preview"><PixelArtwork source={selected.previewAssetUrl} label={selected.title} /></div>
              <div className="review-detail-head">
                <span>{selected.kind === "ONE_OF_ONE" ? "1/1" : selected.categories.join(" + ")}</span>
                <h2>{selected.title}</h2>
                <p>by {selected.user.socialAccounts[0]?.username ? `@${selected.user.socialAccounts[0].username}` : selected.user.displayName ?? "Mask Born member"}</p>
              </div>
              <div className="review-metrics">
                <div><span>Up</span><b>{selected.upvoteCount}</b></div>
                <div><span>Down</span><b>{selected.downvoteCount}</b></div>
                <div><span>Risk</span><b>—</b></div>
              </div>
              <label className="plain-field"><span>Review note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required audit-log note" /></label>
              <div className="review-actions">
                <button className="button reject" disabled={note.trim().length < 2 || review.isPending} onClick={() => review.mutate("REJECTED")}>Reject</button>
                <button className="button button-amber" disabled={note.trim().length < 2 || review.isPending} onClick={() => review.mutate("ACCEPTED")}>Accept for gallery review</button>
              </div>
              {review.isError && <p><AlertTriangle size={13} /> {(review.error as Error).message}</p>}
              <p className="audit-note"><UserRound size={13} /> This action records your account, timestamp, note, and the previous state.</p>
            </aside>
          </div>
        )}
      </main>
    </section>
  );
}
