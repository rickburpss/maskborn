"use client";

import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArtCard } from "@/components/art-card";
import { DotLoader } from "@/components/dot-loader";
import { SectionHeading } from "@/components/section-heading";
import { apiFetch } from "@/lib/api";
import type { ArtType, Artwork } from "@/lib/types";

const options = ["Newest", "Highest likes", "Highest trait likes", "Most downvoted", "Least voted", "No votes"];
const categories = ["All work", "1/1", "Background", "Eyes", "Hats", "Special"];

export function LatestCreations({ limit }: { limit?: number }) {
  const [sort, setSort] = useState("Newest");
  const [category, setCategory] = useState("All work");
  const [search, setSearch] = useState("");
  const feed = useInfiniteQuery({
    queryKey: ["submissions", "feed"],
    queryFn: ({ pageParam }) => apiFetch<{ items: Array<{
      id: string;
      slug: string;
      title: string;
      description: string;
      kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
      categories: string[];
      status: string;
      previewAssetUrl: string;
      previewVariants: Array<{ id: string; label: string; categories: string[]; url: string }> | null;
      traitVotes: Array<{ category: string; upvotes: number; downvotes: number }>;
      viewerVotes?: Array<{ value: "UP" | "DOWN"; category: string | null }>;
      upvoteCount: number;
      downvoteCount: number;
      publishedAt: string;
      user: { displayName: string | null; socialAccounts: Array<{ username: string }> };
      galleryEntry: unknown | null;
    }>; nextCursor: string | null }>(`/submissions?limit=24${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
  const source = useMemo<Artwork[]>(() => {
    if (!feed.data) return [];
    return feed.data.pages.flatMap((page) => page.items).map((item, index) => {
      const username = item.user.socialAccounts[0]?.username;
      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        creator: username ? `@${username}` : item.user.displayName ?? "Mask Born member",
        twitterUrl: username ? `https://x.com/${username}` : undefined,
        type: item.kind === "ONE_OF_ONE" ? "1/1" : (item.categories[0] as ArtType ?? "Hats"),
        status: item.galleryEntry ? "Added to gallery" : item.status === "PENDING" ? "In review" : "Community",
        variant: index,
        upvotes: item.upvoteCount,
        downvotes: item.downvoteCount,
        submittedAt: new Date(item.publishedAt).toLocaleDateString(),
        previewAssetUrl: item.previewAssetUrl,
        previewVariants: item.kind === "TRAIT_EXTENSION" ? (item.previewVariants ?? []) : [],
        categories: item.categories,
        traitVotes: item.traitVotes,
        viewerVotes: item.viewerVotes,
      };
    });
  }, [feed.data]);
  const sorted = useMemo(() => {
    const list = [...source];
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = list.filter((art) => {
      const matchesCategory = category === "All work"
        || (category === "1/1" ? art.type === "1/1" : art.categories?.includes(category.toUpperCase()));
      const matchesSearch = !normalizedSearch
        || `${art.title} ${art.creator} ${art.description}`.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
    if (sort === "Highest likes") filtered.sort((a, b) => b.upvotes - a.upvotes);
    if (sort === "Highest trait likes") {
      const trait = category.toUpperCase();
      filtered.sort((a, b) =>
        (b.traitVotes?.find((item) => item.category === trait)?.upvotes ?? 0)
        - (a.traitVotes?.find((item) => item.category === trait)?.upvotes ?? 0));
    }
    if (sort === "Most downvoted") filtered.sort((a, b) => b.downvotes - a.downvotes);
    if (sort === "Least voted") filtered.sort((a, b) => (a.upvotes + a.downvotes) - (b.upvotes + b.downvotes));
    if (sort === "No votes") return filtered.filter((art) => art.upvotes + art.downvotes === 0);
    return filtered;
  }, [category, search, sort, source]);
  const visible = typeof limit === "number" ? sorted.slice(0, limit) : sorted;

  return (
    <section className="latest-section shell">
      <SectionHeading
        eyebrow="Fresh from the community"
        title="Latest creations"
        description="Vote while the first 24-hour window is open. After that, the record stays put."
        href={limit ? "/community" : undefined}
        linkLabel={limit ? "See every submission" : undefined}
      />
      <div className="filter-row">
        <div className="filter-label"><SlidersHorizontal size={15} /> Sort the feed</div>
        {!limit && (
          <label className="filter-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artwork or creator" />
          </label>
        )}
        <label className="select-wrap">
          <span className="sr-only">Filter creations by trait</span>
          <select value={category} onChange={(event) => {
            setCategory(event.target.value);
            if (event.target.value === "All work" || event.target.value === "1/1") {
              setSort((current) => current === "Highest trait likes" ? "Highest likes" : current);
            }
          }}>
            {categories.map((option) => <option key={option}>{option}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="select-wrap">
          <span className="sr-only">Sort creations</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {options.filter((option) => option !== "Highest trait likes" || !["All work", "1/1"].includes(category))
              .map((option) => <option key={option}>{option}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="art-grid">
        {visible.map((artwork, index) => <ArtCard key={artwork.id} artwork={artwork} index={index} />)}
      </div>
      {feed.isLoading && <DotLoader label="Loading community submissions" />}
      {feed.isError && <div className="empty-state">Community submissions could not be loaded. Try again shortly.</div>}
      {!feed.isLoading && !feed.isError && visible.length === 0 && (
        <div className="empty-state">
          {source.length === 0 ? "No community work has been published yet." : "Nothing has landed in this filter yet."}
        </div>
      )}
      {!limit && feed.hasNextPage && (
        <div className="load-more-row">
          <button className="button button-dark" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {feed.isFetchingNextPage ? "Loading next batch…" : "Load 24 more"}
          </button>
          <span>{source.length} submissions loaded</span>
        </div>
      )}
    </section>
  );
}
