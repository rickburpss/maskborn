import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { PixelArtwork } from "@/components/pixel-artwork";
import { galleryTraits } from "@/lib/data";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <>
      <PageIntro
        index="02"
        eyebrow="The accepted collection"
        title="Gallery"
        copy="The official record of community work selected for the 1/1 set and the general collection. Browse a whole mask or isolate the trait that made it in."
      />
      <div className="origin-banner shell">
        <span>See how the planned collection is assembled.</span>
        <Link href="/collection">Open collection previews <ArrowUpRight size={15} /></Link>
      </div>
      <section className="gallery-shell shell">
        <div className="gallery-filters" aria-label="Gallery categories">
          {["All work", "1/1", "Background", "Fur", "Eyes", "Ears", "Tails", "Masks", "Hats", "Special"].map((filter, index) => (
            <button key={filter} className={index === 0 ? "active" : ""}>{filter}</button>
          ))}
        </div>
        <div className="gallery-grid">
          {galleryTraits.map((trait, index) => (
            <article className={`gallery-item gallery-item-${index + 1}`} key={trait.name}>
              <div className="gallery-art-wrap">
                <PixelArtwork variant={trait.variant} label={trait.name} />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="gallery-item-meta">
                <div><p>{trait.type}</p><h2>{trait.name}</h2></div>
                <a href={`https://x.com/${trait.creator.slice(1)}`} target="_blank" rel="noreferrer">
                  {trait.creator}<ArrowUpRight size={14} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
