"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import { apiFetch } from "@/lib/api";

type GalleryEntry = {
  id: string;
  kind: "ONE_OF_ONE" | "TRAIT";
  categories: string[];
  submission: {
    title: string;
    previewAssetUrl: string;
    user: {
      displayName: string | null;
      socialAccounts: Array<{ username: string }>;
    };
  };
};

const filters = ["All work", "1/1", "Background", "Fur", "Eyes", "Ears", "Tails", "Masks", "Hats", "Special"];

export function GalleryBrowser() {
  const [filter, setFilter] = useState("All work");
  const gallery = useQuery({
    queryKey: ["gallery"],
    queryFn: () => apiFetch<{ items: GalleryEntry[] }>("/gallery"),
    retry: false,
  });
  const entries = useMemo(() => {
    const items = gallery.data?.items ?? [];
    if (filter === "All work") return items;
    if (filter === "1/1") return items.filter((entry) => entry.kind === "ONE_OF_ONE");
    return items.filter((entry) => entry.categories.includes(filter.toUpperCase()));
  }, [filter, gallery.data]);

  return (
    <section className="gallery-shell shell">
      <div className="gallery-filters" aria-label="Gallery categories">
        {filters.map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <div className="gallery-grid">
        {entries.map((entry, index) => {
          const username = entry.submission.user.socialAccounts[0]?.username;
          const creator = username ? `@${username}` : entry.submission.user.displayName ?? "Mask Born member";
          return (
            <article className={`gallery-item gallery-item-${(index % 6) + 1}`} key={entry.id}>
              <div className="gallery-art-wrap">
                <PixelArtwork source={entry.submission.previewAssetUrl} label={entry.submission.title} />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="gallery-item-meta">
                <div><p>{entry.kind === "ONE_OF_ONE" ? "1/1" : entry.categories.join(" + ")}</p><h2>{entry.submission.title}</h2></div>
                {username ? (
                  <a href={`https://x.com/${username}`} target="_blank" rel="noreferrer">
                    {creator}<ArrowUpRight size={14} />
                  </a>
                ) : <span>{creator}</span>}
              </div>
            </article>
          );
        })}
      </div>
      {gallery.isLoading && <div className="empty-state">Loading accepted work…</div>}
      {gallery.isError && <div className="empty-state">The gallery could not be loaded. Try again shortly.</div>}
      {!gallery.isLoading && !gallery.isError && entries.length === 0 && (
        <div className="empty-state">{(gallery.data?.items.length ?? 0) === 0 ? "No community work has been accepted yet." : "No accepted work matches this filter."}</div>
      )}
    </section>
  );
}
