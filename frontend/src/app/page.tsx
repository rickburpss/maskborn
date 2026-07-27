import { ArrowDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { LatestCreations } from "@/components/latest-creations";

export default function Home() {
  return (
    <>
      <section className="home-hero shell">
        <div className="hero-topline">
          <p>Community built</p>
          <span>Collection 001</span>
          <p>Shaped before launch</p>
        </div>
        <div className="hero-title">
          <p className="eyebrow">Born from the same base. Made by different hands.</p>
          <h1>Mask Born<br /><span>Order</span></h1>
          <Link className="hero-cta" href="/apply">
            Enter the order <ArrowUpRight />
          </Link>
        </div>
        <a className="scroll-cue" href="#featured"><ArrowDown size={16} /> Pick a maskborn</a>
      </section>

      <div id="featured">
        <FeaturedCarousel />
      </div>

      <section className="manifesto shell">
        <p className="manifesto-index">[ 01 / The idea ]</p>
        <h2>One base. Hundreds of hands. Every accepted piece leaves a mark on the collection.</h2>
        <div>
          <p>Build with ready traits, draw a 1/1, or make the accessory the order did not know it needed.</p>
          <Link className="text-link" href="/draw">Open the studio <ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <LatestCreations limit={6} />
    </>
  );
}
