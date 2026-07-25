import { ArrowRight } from "lucide-react";
import { PixelArtwork } from "@/components/pixel-artwork";
import collection from "@/generated/collection.json";

export function CollectionBrowser() {
  return (
    <section className="collection-browser shell">
      <div className="origin-stats">
        <article><span>Planned supply</span><b>{collection.supply.toLocaleString()}</b><p>Final pre-launch target</p></article>
        <article><span>Generated set</span><b>{collection.rolledSupply.toLocaleString()}</b><p>Eight traits per mask</p></article>
        <article><span>Designed 1/1s</span><b>{collection.legendaryCount}</b><p>Bespoke collection references</p></article>
        <article><span>Trait library</span><b>{collection.categories.reduce((sum, category) => sum + category.count, 0)}</b><p>Community can help it grow</p></article>
      </div>

      <div className="wallet-lookup prelaunch-note">
        <div>
          <p className="eyebrow">Pre-launch collection</p>
          <h2>Nothing has been deployed yet.</h2>
          <p>The generator defines how Maskborns are assembled. Community submissions can be selected before the final collection is launched.</p>
        </div>
      </div>

      <div className="origin-legends">
        <div className="profile-section-head">
          <div><p className="eyebrow">Generator samples</p><h2>Normal generated masks</h2></div>
        </div>
        <div className="owned-grid preview-grid">
          {collection.fixtures.slice(0, 12).map((fixture) => (
            <article key={fixture.id}>
              <PixelArtwork source={fixture.preview} label={`Generated Maskborn ${fixture.id}`} />
              <span>#{String(fixture.id).padStart(4, "0")}</span>
              <h3>Generated Maskborn</h3>
            </article>
          ))}
        </div>
      </div>

      <div className="origin-legends">
        <div className="profile-section-head">
          <div><p className="eyebrow">Designed for the set</p><h2>Pre-launch 1/1s</h2></div>
        </div>
        <div className="legend-grid">
          {collection.legends.map((legend) => (
            <article id={legend.slug} key={legend.slug}>
              <PixelArtwork source={legend.preview} label={legend.name} />
              <span>{String(legend.index + 1).padStart(2, "0")}</span>
              <h3>{legend.name}</h3>
              <p>{legend.note}</p>
            </article>
          ))}
        </div>
      </div>

      <a className="collection-next" href="/gallery">Community selections <ArrowRight /></a>
    </section>
  );
}
