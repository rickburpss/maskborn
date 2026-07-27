"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import { selectLargestPreviewVariant } from "@/lib/artwork-preview";
import type { Artwork, VoteValue } from "@/lib/types";

export function ArtCard({ artwork, index }: { artwork: Artwork; index: number }) {
  const [votes, setVotes] = useState<Record<string, VoteValue>>(() => Object.fromEntries(
    (artwork.viewerVotes ?? []).map((vote) => [vote.category ?? "ONE_OF_ONE", vote.value.toLowerCase() as VoteValue]),
  ));
  const [voteIntent, setVoteIntent] = useState<Exclude<VoteValue, null> | null>(null);
  const [counts, setCounts] = useState({ up: artwork.upvotes, down: artwork.downvotes });
  const [voteError, setVoteError] = useState("");
  const [shared, setShared] = useState(false);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const session = useCurrentUser();
  const discordVerified = session.data?.user?.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  );

  const upvotes = counts.up;
  const downvotes = counts.down;
  const selectedVariant = artwork.previewVariants?.find((variant) => variant.id === activePreview);
  const defaultVariant = selectLargestPreviewVariant(artwork.previewVariants);
  const previewSource = selectedVariant?.url ?? artwork.previewAssetUrl;

  const voteCategories = artwork.categories ?? [];
  const applyVote = async (next: Exclude<VoteValue, null>, selectedCategory?: string) => {
    if (!discordVerified) {
      window.dispatchEvent(new CustomEvent("maskborn:connect"));
      return;
    }
    if (voteCategories.length > 1 && !selectedCategory) {
      setVoteIntent(next);
      return;
    }
    const category = selectedCategory ?? (voteCategories.length === 1 ? voteCategories[0] : null);
    const voteKey = category ?? "ONE_OF_ONE";
    const previousVotes = { ...votes };
    const previous = votes[voteKey] ?? null;
    const previousCounts = counts;
    const desired = previous === next ? null : next;
    setVoteError("");
    setVotes((current) => ({ ...current, [voteKey]: desired }));
    setCounts((current) => ({
      up: current.up + (previous === "up" ? -1 : 0) + (desired === "up" ? 1 : 0),
      down: current.down + (previous === "down" ? -1 : 0) + (desired === "down" ? 1 : 0),
    }));
    setVoteIntent(null);
    try {
      const result = await apiFetch<{
        vote: "UP" | "DOWN" | null;
        category: string | null;
        upvotes: number;
        downvotes: number;
      }>(`/submissions/${artwork.id}/vote`, {
        method: "PUT",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ value: desired?.toUpperCase() ?? null, category }),
      });
      const resultKey = result.category ?? "ONE_OF_ONE";
      setVotes((current) => ({ ...current, [resultKey]: result.vote?.toLowerCase() as VoteValue ?? null }));
      setCounts({ up: result.upvotes, down: result.downvotes });
    } catch (error) {
      setVotes(previousVotes);
      setCounts(previousCounts);
      setVoteError((error as Error).message);
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
        <AnimatePresence>
          {voteIntent && (
            <motion.div
              className="trait-vote-picker"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              <span>{voteIntent === "up" ? "Upvote which trait?" : "Downvote which trait?"}</span>
              <div>
                {voteCategories.map((category) => {
                  const totals = artwork.traitVotes?.find((item) => item.category === category);
                  return (
                    <button
                      type="button"
                      key={category}
                      className={votes[category] ? `voted ${votes[category] === "down" ? "down" : ""}` : ""}
                      onClick={() => applyVote(voteIntent, category)}
                    >
                      {category.charAt(0) + category.slice(1).toLowerCase()}
                      <small>{votes[category] ? `your vote: ${votes[category]}` : `${totals?.upvotes ?? 0} up`}</small>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="trait-vote-cancel" onClick={() => setVoteIntent(null)}>Cancel</button>
            </motion.div>
          )}
        </AnimatePresence>
        {Object.entries(votes).some(([, value]) => value) && (
          <p className="vote-target">
            Your votes: {Object.entries(votes).filter(([, value]) => value).map(([category, value]) =>
              `${category === "ONE_OF_ONE" ? "Artwork" : category.charAt(0) + category.slice(1).toLowerCase()} ${value}`).join(" · ")}
          </p>
        )}
        {voteError && <p className="field-error vote-error">{voteError}</p>}
        <div className="vote-row">
          <button className={Object.values(votes).includes("up") ? "voted" : ""} onClick={() => applyVote("up")} aria-label={`Upvote ${artwork.title}`}>
            <ThumbsUp size={15} fill={Object.values(votes).includes("up") ? "currentColor" : "none"} /> {upvotes}
          </button>
          <button className={Object.values(votes).includes("down") ? "voted down" : ""} onClick={() => applyVote("down")} aria-label={`Downvote ${artwork.title}`}>
            <ThumbsDown size={15} fill={Object.values(votes).includes("down") ? "currentColor" : "none"} /> {downvotes}
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
