"use client";

import { ArrowRight } from "lucide-react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import collection from "@/generated/collection.json";
import { collectionSamples } from "@/lib/generated-samples";

export function CollectionBrowser() {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("Ascending");
  const samples = useMemo(() => {
    const normalized = query.trim().replace(/^#/, "");
    const filtered = normalized
      ? collectionSamples.filter((sample) => String(sample.id).includes(normalized))
      : [...collectionSamples];
    return filtered.sort((a, b) => order === "Ascending" ? a.id - b.id : b.id - a.id);
  }, [order, query]);

  return (
    <section className="collection-browser shell">
      <div className="origin-stats">
        <article><span>Planned supply</span><b>{collection.supply.toLocaleString()}</b><p>Final pre-launch target</p></article>
        <article><span>Generated set</span><b>{collection.rolledSupply.toLocaleString()}</b><p>Eight traits per mask</p></article>
        <article><span>Preview library</span><b>{collectionSamples.length}</b><p>Normal generated examples</p></article>
        <article><span>Trait library</span><b>{collection.categories.reduce((sum, category) => sum + category.count, 0)}</b><p>Community can help it grow</p></article>
      </div>

      {/* <div className="wallet-lookup prelaunch-note">
        <div>
          <p className="eyebrow">Pre-launch collection</p>
          <h2>Nothing has been deployed yet.</h2>
          <p>The generator defines how Maskborns are assembled. Community submissions can be selected before the final collection is launched.</p>
        </div>
      </div> */}

      <div className="origin-legends">
        <div className="profile-section-head">
          <div><p className="eyebrow">Generator samples</p><h2>Normal generated masks</h2></div>
        </div>
        <div className="filter-row collection-filter-row">
          <label className="filter-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find sample number" />
          </label>
          <label className="select-wrap">
            <span className="sr-only">Sort sample numbers</span>
            <select value={order} onChange={(event) => setOrder(event.target.value)}>
              <option>Ascending</option>
              <option>Descending</option>
            </select>
          </label>
        </div>
        <div className="owned-grid preview-grid">
          {samples.map((sample) => (
            <article key={sample.id}>
              <PixelArtwork source={sample.preview} label={`Maskborn sample ${sample.id}`} />
              <span>#{String(sample.id).padStart(4, "0")}</span>
            </article>
          ))}
        </div>
        {samples.length === 0 && <div className="empty-state">No sample matches that number.</div>}
      </div>

      <a className="collection-next" href="/gallery">Community selections <ArrowRight /></a>
    </section>
  );
}
