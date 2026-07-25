"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArtCard } from "@/components/art-card";
import { SectionHeading } from "@/components/section-heading";
import { artworks } from "@/lib/data";
import { apiFetch } from "@/lib/api";
import type { ArtType, Artwork } from "@/lib/types";

const options = ["Newest", "Most upvoted", "Most downvoted", "Least voted", "No votes"];

export function LatestCreations({ limit }: { limit?: number }) {
  const [sort, setSort] = useState("Newest");
  const feed = useQuery({
    queryKey: ["submissions", "feed"],
    queryFn: () => apiFetch<{ items: Array<{
      id: string;
      slug: string;
      title: string;
      description: string;
      kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
      categories: string[];
      status: string;
      previewAssetUrl: string;
      upvoteCount: number;
      downvoteCount: number;
      publishedAt: string;
      user: { socialAccounts: Array<{ username: string }> };
      galleryEntry: unknown | null;
    }> }>("/submissions?limit=60"),
    retry: false,
  });
  const source = useMemo<Artwork[]>(() => {
    if (!feed.data) return artworks;
    return feed.data.items.map((item, index) => {
      const username = item.user.socialAccounts[0]?.username ?? "unknown";
      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        creator: `@${username}`,
        twitterUrl: `https://x.com/${username}`,
        type: item.kind === "ONE_OF_ONE" ? "1/1" : (item.categories[0] as ArtType ?? "Hats"),
        status: item.galleryEntry ? "Added to gallery" : item.status === "PENDING" ? "In review" : "Community",
        variant: index,
        upvotes: item.upvoteCount,
        downvotes: item.downvoteCount,
        submittedAt: new Date(item.publishedAt).toLocaleDateString(),
        previewAssetUrl: item.previewAssetUrl,
      };
    });
  }, [feed.data]);
  const sorted = useMemo(() => {
    const list = [...source];
    if (sort === "Most upvoted") list.sort((a, b) => b.upvotes - a.upvotes);
    if (sort === "Most downvoted") list.sort((a, b) => b.downvotes - a.downvotes);
    if (sort === "Least voted") list.sort((a, b) => (a.upvotes + a.downvotes) - (b.upvotes + b.downvotes));
    if (sort === "No votes") return list.filter((art) => art.upvotes + art.downvotes === 0);
    return list;
  }, [sort, source]);
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
        <label className="select-wrap">
          <span className="sr-only">Sort creations</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {options.map((option) => <option key={option}>{option}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="art-grid">
        {visible.map((artwork, index) => <ArtCard key={artwork.id} artwork={artwork} index={index} />)}
      </div>
      {visible.length === 0 && <div className="empty-state">Nothing has landed in this filter yet.</div>}
    </section>
  );
}
