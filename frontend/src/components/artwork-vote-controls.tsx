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
  viewerVotes: Array<{ value: "UP" | "DOWN"; category: string | null }>;
};

const label = (category: string) => category.charAt(0) + category.slice(1).toLowerCase();

export function ArtworkVoteControls(props: Props) {
  const session = useCurrentUser();
  const [votes, setVotes] = useState<Record<string, VoteValue>>(() => Object.fromEntries(
    props.viewerVotes.map((vote) => [vote.category ?? "ONE_OF_ONE", vote.value.toLowerCase() as VoteValue]),
  ));
  const [intent, setIntent] = useState<Exclude<VoteValue, null> | null>(null);
  const [counts, setCounts] = useState({ up: props.initialUpvotes, down: props.initialDownvotes });
  const [voteError, setVoteError] = useState("");
  const verified = session.data?.user?.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  );

  const submit = async (next: Exclude<VoteValue, null>, target?: string) => {
    if (!verified) {
      window.dispatchEvent(new CustomEvent("maskborn:connect"));
      return;
    }
    if (props.categories.length > 1 && !target) {
      setIntent(next);
      return;
    }
    const selected = target ?? (props.categories.length === 1 ? props.categories[0] : null);
    const voteKey = selected ?? "ONE_OF_ONE";
    const currentVote = votes[voteKey] ?? null;
    const desired = currentVote === next ? null : next;
    const previous = { votes: { ...votes }, counts };
    setVoteError("");
    setVotes((current) => ({ ...current, [voteKey]: desired }));
    setCounts((current) => ({
      up: current.up + (currentVote === "up" ? -1 : 0) + (desired === "up" ? 1 : 0),
      down: current.down + (currentVote === "down" ? -1 : 0) + (desired === "down" ? 1 : 0),
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
      const resultKey = result.category ?? "ONE_OF_ONE";
      setVotes((current) => ({ ...current, [resultKey]: result.vote?.toLowerCase() as VoteValue ?? null }));
      setCounts({ up: result.upvotes, down: result.downvotes });
    } catch (error) {
      setVotes(previous.votes);
      setCounts(previous.counts);
      setVoteError((error as Error).message);
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
                <button
                  type="button"
                  key={item}
                  className={votes[item] ? `voted ${votes[item] === "down" ? "down" : ""}` : ""}
                  onClick={() => submit(intent, item)}
                >
                  {label(item)} <small>{votes[item] ? `your vote: ${votes[item]}` : `${props.traitVotes.find((total) => total.category === item)?.upvotes ?? 0} up`}</small>
                </button>
              ))}
            </div>
            <button type="button" className="trait-vote-cancel" onClick={() => setIntent(null)}>Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
      {Object.entries(votes).some(([, value]) => value) && (
        <p className="vote-target">
          Your votes: {Object.entries(votes).filter(([, value]) => value).map(([category, value]) =>
            `${category === "ONE_OF_ONE" ? "Artwork" : label(category)} ${value}`).join(" · ")}
        </p>
      )}
      {voteError && <p className="field-error vote-error">{voteError}</p>}
      <div className="detail-vote-buttons">
        <button className={Object.values(votes).includes("up") ? "voted" : ""} onClick={() => submit("up")}><ThumbsUp size={17} /> {counts.up} Upvote</button>
        <button className={Object.values(votes).includes("down") ? "voted down" : ""} onClick={() => submit("down")}><ThumbsDown size={17} /> {counts.down} Downvote</button>
      </div>
    </div>
  );
}
