"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, Clock3, Search, ShieldCheck, UserRound } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import { DotLoader } from "@/components/dot-loader";
import { apiFetch } from "@/lib/api";
import { AdminAbusePanel } from "@/components/admin-abuse-panel";
import type { ArtworkPreviewVariant } from "@/lib/types";
import { Pagination } from "@/components/pagination";

type ReviewItem = {
  id: string;
  title: string;
  kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
  categories: string[];
  previewAssetUrl: string;
  previewVariants?: ArtworkPreviewVariant[];
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
  const deferredSearch = useDeferredValue(search.trim());
  const [sort, setSort] = useState<"time" | "votes">("time");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"review" | "abuse">("review");
  const [gallerySelections, setGallerySelections] = useState<Record<string, string[]>>({});
  const queue = useQuery({
    queryKey: ["mboadmin", "review-queue", page, sort, direction, deferredSearch],
    queryFn: () => apiFetch<{
      items: ReviewItem[];
      pagination: { page: number; pages: number; total: number; limit: number };
    }>(`/mboadmin/review-queue?page=${page}&limit=12&sort=${sort}&direction=${direction}&search=${encodeURIComponent(deferredSearch)}`),
    retry: false,
    enabled: view === "review",
  });

  const allItems = queue.data?.items;
  const items = allItems ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const selectedCategories = selected
    ? gallerySelections[selected.id] ?? selected.categories
    : [];
  const selectedCategoryKeys = new Set(selectedCategories.map((category) => category.toLowerCase()));
  const selectedVariant = selected?.previewVariants?.find((variant) => {
    const variantKeys = variant.categories.map((category) => category.toLowerCase());
    return variantKeys.length === selectedCategoryKeys.size
      && variantKeys.every((category) => selectedCategoryKeys.has(category));
  });
  const review = useMutation({
    mutationFn: (decision: "ACCEPTED" | "REJECTED") => decision === "ACCEPTED"
      ? apiFetch(`/mboadmin/submissions/${selected!.id}/accept-to-gallery`, {
        method: "POST",
        body: JSON.stringify({ categories: selectedCategories, note }),
      })
      : apiFetch(`/mboadmin/submissions/${selected!.id}/review`, {
        method: "PUT",
        body: JSON.stringify({ decision, note }),
      }),
    onSuccess: async () => {
      setNote("");
      setSelectedId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mboadmin", "review-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["gallery"] }),
      ]);
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
            <label className="admin-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search every submission" /></label>
            <label className="select-wrap">
              <select value={sort} onChange={(event) => { setSort(event.target.value as "time" | "votes"); setPage(1); }}>
                <option value="time">Submission time</option>
                <option value="votes">Upvotes</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <button
              type="button"
              className="admin-direction"
              onClick={() => { setDirection((value) => value === "asc" ? "desc" : "asc"); setPage(1); }}
              aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
              title={direction === "asc" ? "Ascending" : "Descending"}
            >
              {direction === "asc" ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </button>
          </div>
        </header>
        <div className="admin-stats">
          <article><span>Waiting for review</span><b>{queue.data?.pagination.total ?? 0}</b><p><Clock3 size={13} /> Full queue</p></article>
          <article><span>Accepted this week</span><b>—</b><p><Check size={13} /> Not loaded on this screen</p></article>
          <article><span>Vote restrictions</span><b>—</b><p><ShieldCheck size={13} /> Not loaded on this screen</p></article>
          <article><span>Pending payouts</span><b>—</b><p>Not loaded on this screen</p></article>
        </div>
        {queue.isLoading && <DotLoader label="Loading the review queue" />}
        {queue.isError && <div className="empty-state">The review queue could not be loaded. Confirm this account has admin access.</div>}
        {!queue.isLoading && !queue.isError && items.length === 0 && <div className="empty-state">{deferredSearch ? "No submissions match that search." : "There are no submissions waiting for review."}</div>}
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
              <div className="review-preview">
                <PixelArtwork source={selectedVariant?.url ?? selected.previewAssetUrl} label={selected.title} />
              </div>
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
              {selected.kind === "TRAIT_EXTENSION" && (
                <fieldset className="gallery-trait-picker">
                  <legend>Accept traits into gallery</legend>
                  <p>Select one, several, or all submitted traits. The preview shows exactly what the gallery will display.</p>
                  <div>
                    {selected.categories.map((category) => {
                      const checked = selectedCategories.includes(category);
                      return (
                        <label key={category}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setGallerySelections((current) => ({
                              ...current,
                              [selected.id]: checked
                                ? selectedCategories.filter((item) => item !== category)
                                : [...selectedCategories, category],
                            }))}
                          />
                          <span>{category.charAt(0) + category.slice(1).toLowerCase()}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <label className="plain-field"><span>Review note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required audit-log note" /></label>
              <div className="review-actions">
                <button className="button reject" disabled={note.trim().length < 2 || review.isPending} onClick={() => review.mutate("REJECTED")}>Reject</button>
                <button
                  className="button button-amber"
                  disabled={note.trim().length < 2 || review.isPending || (selected.kind === "TRAIT_EXTENSION" && selectedCategories.length === 0)}
                  onClick={() => review.mutate("ACCEPTED")}
                >
                  {selected.kind === "ONE_OF_ONE" ? "Accept 1/1 to gallery" : `Accept ${selectedCategories.length} trait${selectedCategories.length === 1 ? "" : "s"} to gallery`}
                </button>
              </div>
              {review.isError && <p><AlertTriangle size={13} /> {(review.error as Error).message}</p>}
              <p className="audit-note"><UserRound size={13} /> This action records your account, timestamp, note, and the previous state.</p>
            </aside>
          </div>
        )}
        {queue.data && (
          <Pagination
            page={queue.data.pagination.page}
            pages={queue.data.pagination.pages}
            onPageChange={(nextPage) => {
              setSelectedId(null);
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </main>
    </section>
  );
}
