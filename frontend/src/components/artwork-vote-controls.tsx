"use client";

import { AnimatePresence, motion } from "motion/react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import type { TraitVoteTotal, VoteValue } from "@/lib/types";

type Props = {
  id: string;
  title: string;
  categories: string[];
  initialUpvotes: number;
  initialDownvotes: number;
  traitVotes: TraitVoteTotal[];
  viewerVote: { value: "UP" | "DOWN"; category: string | null } | null;
};

const label = (category: string) => category.charAt(0) + category.slice(1).toLowerCase();

export function ArtworkVoteControls(props: Props) {
  const session = useCurrentUser();
  const [vote, setVote] = useState<VoteValue>(props.viewerVote?.value.toLowerCase() as VoteValue ?? null);
  const [category, setCategory] = useState<string | null>(props.viewerVote?.category ?? null);
  const [intent, setIntent] = useState<Exclude<VoteValue, null> | null>(null);
  const [counts, setCounts] = useState({ up: props.initialUpvotes, down: props.initialDownvotes });
  const verified = session.data?.user?.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  );

  const submit = async (next: Exclude<VoteValue, null>, target?: string) => {
    if (!verified) {
      window.dispatchEvent(new CustomEvent("maskborn:connect"));
      return;
    }
    const desired = vote === next ? null : next;
    if (desired && props.categories.length > 1 && !target) {
      setIntent(next);
      return;
    }
    const previous = { vote, category, counts };
    const selected = target ?? category ?? (props.categories.length === 1 ? props.categories[0] : null);
    setVote(desired);
    setCategory(desired ? selected : null);
    setCounts((current) => ({
      up: current.up + (vote === "up" ? -1 : 0) + (desired === "up" ? 1 : 0),
      down: current.down + (vote === "down" ? -1 : 0) + (desired === "down" ? 1 : 0),
    }));
    setIntent(null);
    try {
      const result = await apiFetch<{
        vote: "UP" | "DOWN" | null;
        category: string | null;
        upvotes: number;
        downvotes: number;
      }>(`/submissions/${props.id}/vote`, {
        method: "PUT",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ value: desired?.toUpperCase() ?? null, category: selected }),
      });
      setVote(result.vote?.toLowerCase() as VoteValue);
      setCategory(result.category);
      setCounts({ up: result.upvotes, down: result.downvotes });
    } catch (error) {
      setVote(previous.vote);
      setCategory(previous.category);
      setCounts(previous.counts);
      if (["AUTH_REQUIRED", "DISCORD_REQUIRED"].includes((error as Error & { code?: string }).code ?? "")) {
        window.dispatchEvent(new CustomEvent("maskborn:connect"));
      }
    }
  };

  return (
    <div className="detail-vote-control">
      <AnimatePresence>
        {intent && (
          <motion.div className="trait-vote-picker" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
            <span>{intent === "up" ? "Upvote which trait?" : "Downvote which trait?"}</span>
            <div>
              {props.categories.map((item) => (
                <button type="button" key={item} onClick={() => submit(intent, item)}>
                  {label(item)} <small>{props.traitVotes.find((total) => total.category === item)?.upvotes ?? 0} up</small>
                </button>
              ))}
            </div>
            <button type="button" className="trait-vote-cancel" onClick={() => setIntent(null)}>Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
      {category && <p className="vote-target">Your vote: {label(category)}</p>}
      <div className="detail-vote-buttons">
        <button className={vote === "up" ? "voted" : ""} onClick={() => submit("up")}><ThumbsUp size={17} /> {counts.up} Upvote</button>
        <button className={vote === "down" ? "voted down" : ""} onClick={() => submit("down")}><ThumbsDown size={17} /> {counts.down} Downvote</button>
      </div>
    </div>
  );
}
