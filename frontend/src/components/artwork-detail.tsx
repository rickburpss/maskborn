"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ArtworkVoteControls } from "@/components/artwork-vote-controls";
import { PixelArtwork } from "@/components/pixel-artwork";
import { apiFetch } from "@/lib/api";

type SubmissionDetail = {
  id: string;
  title: string;
  description: string;
  kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
  categories: string[];
  status: string;
  previewAssetUrl: string;
  upvoteCount: number;
  downvoteCount: number;
  publishedAt: string;
  user: { displayName: string | null; socialAccounts: Array<{ username: string }> };
  galleryEntry: unknown | null;
  traitVotes: Array<{ category: string; upvotes: number; downvotes: number }>;
  viewerVotes?: Array<{ value: "UP" | "DOWN"; category: string | null }>;
};

export function ArtworkDetail({ slug }: { slug: string }) {
  const [shared, setShared] = useState(false);
  const submission = useQuery({
    queryKey: ["submission", slug],
    queryFn: () => apiFetch<{ item: SubmissionDetail; voteClosesAt: string }>(`/submissions/${encodeURIComponent(slug)}`),
    retry: false,
  });

  if (submission.isLoading) {
    return <section className="art-detail shell"><div className="empty-state">Loading artwork…</div></section>;
  }
  if (submission.isError || !submission.data) {
    return (
      <section className="art-detail shell">
        <Link className="back-link" href="/community"><ArrowLeft size={15} /> Community gallery</Link>
        <div className="empty-state">This artwork was not found or is no longer public.</div>
      </section>
    );
  }

  const artwork = submission.data.item;
  const username = artwork.user.socialAccounts[0]?.username;
  const creator = username ? `@${username}` : artwork.user.displayName ?? "Mask Born member";
  const status = artwork.galleryEntry ? "Added to gallery" : artwork.status === "PENDING" ? "In review" : "Community";
  const type = artwork.kind === "ONE_OF_ONE" ? "1/1" : artwork.categories.join(" + ");
  const voteClosesAt = new Date(submission.data.voteClosesAt);

  return (
    <section className="art-detail shell">
      <Link className="back-link" href="/community"><ArrowLeft size={15} /> Community gallery</Link>
      <div className="art-detail-grid">
        <div className="detail-art"><PixelArtwork source={artwork.previewAssetUrl} label={artwork.title} /><span>32 × 32 / nearest-neighbour</span></div>
        <div className="detail-copy">
          <div className="detail-labels"><span>{type}</span><span className={artwork.galleryEntry ? "accepted" : ""}>{status}</span></div>
          <h1>{artwork.title}</h1>
          {username ? <a href={`https://x.com/${username}`} target="_blank" rel="noreferrer">{creator}<ArrowUpRight size={15} /></a> : <p>{creator}</p>}
          <p className="detail-description">{artwork.description}</p>
          <div className="detail-votes">
            <div><ThumbsUp size={18} /> <b>{artwork.upvoteCount}</b><span>Upvotes</span></div>
            <div><ThumbsDown size={18} /> <b>{artwork.downvoteCount}</b><span>Downvotes</span></div>
          </div>
          <ArtworkVoteControls
            id={artwork.id}
            title={artwork.title}
            categories={artwork.kind === "ONE_OF_ONE" ? [] : artwork.categories}
            initialUpvotes={artwork.upvoteCount}
            initialDownvotes={artwork.downvoteCount}
            traitVotes={artwork.traitVotes}
            viewerVotes={artwork.viewerVotes ?? []}
          />
          <div className="vote-window"><span>Vote record</span><p>The 24-hour voting window ends at {voteClosesAt.toLocaleString()}.</p></div>
          <button className="button button-dark" onClick={async () => {
            if (navigator.share) await navigator.share({ title: artwork.title, text: `Vote for ${artwork.title} on Mask Born Order.`, url: window.location.href });
            else await navigator.clipboard.writeText(window.location.href);
            setShared(true);
            window.setTimeout(() => setShared(false), 1600);
          }}>
            <Share2 size={16} /> {shared ? "Link copied" : "Share artwork"}
          </button>
        </div>
      </div>
      <div className="provenance-row">
        <div><span>Submission</span><b>#{artwork.id}</b></div>
        <div><span>Published</span><b>{new Date(artwork.publishedAt).toLocaleDateString()}</b></div>
        <div><span>Base</span><b>Maskborn canonical 01</b></div>
        <div><span>Onchain status</span><b>Awaiting collection mint</b></div>
      </div>
    </section>
  );
}
