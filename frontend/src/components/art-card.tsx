"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import type { Artwork, VoteValue } from "@/lib/types";

export function ArtCard({ artwork, index }: { artwork: Artwork; index: number }) {
  const [vote, setVote] = useState<VoteValue>(null);
  const [shared, setShared] = useState(false);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const session = useCurrentUser();
  const discordVerified = session.data?.user.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  );

  const upvotes = artwork.upvotes + (vote === "up" ? 1 : 0);
  const downvotes = artwork.downvotes + (vote === "down" ? 1 : 0);
  const selectedVariant = artwork.previewVariants?.find((variant) => variant.id === activePreview);
  const defaultVariant = artwork.previewVariants?.reduce((largest, variant) =>
    variant.categories.length > largest.categories.length ? variant : largest);
  const previewSource = selectedVariant?.url ?? artwork.previewAssetUrl;

  const applyVote = async (next: Exclude<VoteValue, null>) => {
    if (!discordVerified) {
      window.dispatchEvent(new CustomEvent("maskborn:connect"));
      return;
    }
    const previous = vote;
    const desired = previous === next ? null : next;
    setVote(desired);
    try {
      const result = await apiFetch<{ vote: "UP" | "DOWN" | null }>(`/submissions/${artwork.id}/vote`, {
        method: "PUT",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ value: desired?.toUpperCase() ?? null }),
      });
      setVote(result.vote?.toLowerCase() as VoteValue);
    } catch (error) {
      setVote(previous);
      if (["AUTH_REQUIRED", "DISCORD_REQUIRED"].includes((error as Error & { code?: string }).code ?? "")) {
        window.dispatchEvent(new CustomEvent("maskborn:connect"));
      }
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/art/${artwork.slug}`;
    if (navigator.share) await navigator.share({ title: artwork.title, url });
    else await navigator.clipboard.writeText(url);
    setShared(true);
    window.setTimeout(() => setShared(false), 1500);
  };

  return (
    <motion.article
      className="art-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: Math.min(index * 0.05, 0.2) }}
    >
      <Link href={`/art/${artwork.slug}`} className="art-image-link">
        <PixelArtwork variant={artwork.variant} source={previewSource} label={`${artwork.title}${selectedVariant ? ` — ${selectedVariant.label}` : ""}`} />
        <span className="art-type">{artwork.type}</span>
        <span className={`status-tag ${artwork.status === "Added to gallery" ? "accepted" : ""}`}>
          {artwork.status}
        </span>
      </Link>
      {artwork.previewVariants && artwork.previewVariants.length > 0 && (
        <div className="trait-preview-controls" aria-label={`Preview layers for ${artwork.title}`}>
          <span>View traits</span>
          <div>
            {artwork.previewVariants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                className={(activePreview === variant.id || (!activePreview && defaultVariant?.id === variant.id)) ? "active" : ""}
                aria-pressed={activePreview === variant.id || (!activePreview && defaultVariant?.id === variant.id)}
                onClick={() => setActivePreview(variant.id)}
              >
                {variant.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="art-card-body">
        <div className="card-kicker"><span>#{String(index + 1).padStart(3, "0")}</span><span>{artwork.submittedAt}</span></div>
        <Link href={`/art/${artwork.slug}`}><h3>{artwork.title}</h3></Link>
        {artwork.twitterUrl ? (
          <a className="creator-link" href={artwork.twitterUrl} target="_blank" rel="noreferrer">
            {artwork.creator}<ArrowUpRight size={13} />
          </a>
        ) : <span className="creator-link">{artwork.creator}</span>}
        <div className="vote-row">
          <button className={vote === "up" ? "voted" : ""} onClick={() => applyVote("up")} aria-label={`Upvote ${artwork.title}`}>
            <ThumbsUp size={15} fill={vote === "up" ? "currentColor" : "none"} /> {upvotes}
          </button>
          <button className={vote === "down" ? "voted down" : ""} onClick={() => applyVote("down")} aria-label={`Downvote ${artwork.title}`}>
            <ThumbsDown size={15} fill={vote === "down" ? "currentColor" : "none"} /> {downvotes}
          </button>
          <button className="share-button" onClick={share} aria-label={`Share ${artwork.title}`}>
            <AnimatePresence mode="wait">
              {shared ? <motion.span key="done" initial={{ scale: 0.7 }} animate={{ scale: 1 }}><Check size={15} /></motion.span> : <Share2 key="share" size={15} />}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
