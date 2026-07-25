import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixelArtwork } from "@/components/pixel-artwork";
import { artworks } from "@/lib/data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const artwork = artworks.find((item) => item.slug === slug);
  return { title: artwork?.title ?? "Artwork" };
}

export default async function ArtworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artwork = artworks.find((item) => item.slug === slug);
  if (!artwork) notFound();

  return (
    <section className="art-detail shell">
      <Link className="back-link" href="/community"><ArrowLeft size={15} /> Community gallery</Link>
      <div className="art-detail-grid">
        <div className="detail-art"><PixelArtwork variant={artwork.variant} label={artwork.title} /><span>32 × 32 / nearest-neighbour</span></div>
        <div className="detail-copy">
          <div className="detail-labels"><span>{artwork.type}</span><span className={artwork.status === "Added to gallery" ? "accepted" : ""}>{artwork.status}</span></div>
          <h1>{artwork.title}</h1>
          <a href={artwork.twitterUrl} target="_blank" rel="noreferrer">{artwork.creator}<ArrowUpRight size={15} /></a>
          <p className="detail-description">{artwork.description}</p>
          <div className="detail-votes">
            <button><ThumbsUp size={18} /> <b>{artwork.upvotes}</b><span>Upvotes</span></button>
            <button><ThumbsDown size={18} /> <b>{artwork.downvotes}</b><span>Downvotes</span></button>
          </div>
          <div className="vote-window"><span>Vote record</span><p>The voting window for this preview remains open. Production uses the submission timestamp from the API.</p></div>
          <button className="button button-dark"><Share2 size={16} /> Share artwork</button>
        </div>
      </div>
      <div className="provenance-row">
        <div><span>Submission</span><b>#{artwork.id}</b></div>
        <div><span>Published</span><b>{artwork.submittedAt}</b></div>
        <div><span>Base</span><b>Maskborn canonical 01</b></div>
        <div><span>Onchain status</span><b>Awaiting collection mint</b></div>
      </div>
    </section>
  );
}
