"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Copy, FilePenLine, Plus, WalletCards } from "lucide-react";
import Link from "next/link";
import { ArtCard } from "@/components/art-card";
import { PixelArtwork } from "@/components/pixel-artwork";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import type { ArtType, Artwork, ArtworkPreviewVariant } from "@/lib/types";
import { useDraftStore } from "@/store/draft";
import { useSessionStore } from "@/store/session";

export function ProfileDashboard() {
  const localTwitter = useSessionStore((state) => state.twitter);
  const localWallet = useSessionStore((state) => state.wallet);
  const session = useCurrentUser();
  const remoteUsername = session.data?.user.socialAccounts.find((account) => account.provider === "X_MANUAL")?.username;
  const twitter = remoteUsername ? `@${remoteUsername}` : localTwitter ?? "@not-connected";
  const wallet = session.data?.user.wallets.find((item) => item.isPrimary)?.address ?? localWallet;
  const draftTitle = useDraftStore((state) => state.title);
  const draftUpdatedAt = useDraftStore((state) => state.updatedAt);
  const profile = useQuery({
    queryKey: ["profile", "submission-slots"],
    queryFn: () => apiFetch<{
      slots: {
        oneOfOne: { limit: number; consumed: number };
        traits: { usedCategories: string[]; allowedCategories: string[] };
      };
      submissions: Array<{
        id: string;
        slug: string;
        title: string;
        description: string;
        kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
        categories: string[];
        status: string;
        previewAssetUrl: string;
        previewVariants: ArtworkPreviewVariant[] | null;
        upvoteCount: number;
        downvoteCount: number;
        publishedAt: string;
        galleryEntry: { feeShare?: unknown | null } | null;
      }>;
    }>("/profile"),
    enabled: Boolean(session.data?.user.id),
    retry: false,
  });
  const oneOfOneSlots = profile.data?.slots.oneOfOne;
  const usedTraits = profile.data?.slots.traits.usedCategories.length ?? 0;
  const traitTotal = profile.data?.slots.traits.allowedCategories.length ?? 4;
  const userArt: Artwork[] = (profile.data?.submissions ?? []).map((item, index) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    creator: twitter,
    twitterUrl: `https://x.com/${twitter.replace(/^@/, "")}`,
    type: item.kind === "ONE_OF_ONE" ? "1/1" : (item.categories[0] as ArtType ?? "Hats"),
    status: item.galleryEntry ? "Added to gallery" : item.status === "PENDING" ? "In review" : "Community",
    variant: index,
    upvotes: item.upvoteCount,
    downvotes: item.downvoteCount,
    submittedAt: new Date(item.publishedAt).toLocaleDateString(),
    previewAssetUrl: item.previewAssetUrl,
    previewVariants: item.kind === "TRAIT_EXTENSION" ? (item.previewVariants ?? []) : [],
  }));
  const communityScore = userArt.reduce((total, item) => total + item.upvotes, 0);
  const payoutEligible = (profile.data?.submissions ?? [])
    .filter((item) => Boolean(item.galleryEntry?.feeShare))
    .map((item) => item.title);

  return (
    <section className="profile-shell shell">
      <div className="profile-card">
        <div className="profile-avatar"><PixelArtwork variant={0} /></div>
        <div>
          <p className="eyebrow">Order member</p>
          <h1>{twitter}</h1>
          <a href={`https://x.com/${twitter.slice(1)}`} target="_blank" rel="noreferrer">View on X <ArrowUpRight size={14} /></a>
        </div>
        <div className="profile-wallet">
          <span>Payout wallet</span>
          <button>{wallet ? `${wallet.slice(0, 7)}…${wallet.slice(-5)}` : "Not added"} <Copy size={13} /></button>
        </div>
      </div>

      <div className="stats-row">
        <article><span>Community score</span><b>{communityScore}</b><p>Upvotes across your work</p></article>
        <article><span>1/1 submissions</span><b>{oneOfOneSlots?.consumed ?? 0} / {oneOfOneSlots?.limit ?? 2}</b><p>Two lifetime submissions</p></article>
        <article><span>Trait types used</span><b>{usedTraits} / {traitTotal}</b><p>One submission per trait type</p></article>
        <article><span>Payout eligible</span><b>{payoutEligible.length}</b><p>Accepted creator collection</p></article>
      </div>

      <div className="profile-main-grid">
        <div>
          <div className="profile-section-head"><div><p className="eyebrow">Your work</p><h2>Submissions</h2></div><Link href="/draw"><Plus size={15} /> New work</Link></div>
          <div className="art-grid profile-creations">
            {userArt.map((art, index) => <ArtCard key={art.id} artwork={art} index={index} />)}
          </div>
          {!profile.isLoading && userArt.length === 0 && <div className="empty-state">You have not published a creation yet.</div>}
        </div>
        <aside className="profile-aside">
          {draftUpdatedAt && (
            <div className="draft-card">
              <FilePenLine size={21} />
              <p className="eyebrow">Local draft</p>
              <h3>{draftTitle.trim() || "Untitled mask"}</h3>
              <p>Last saved {new Date(draftUpdatedAt).toLocaleString()}.</p>
              <Link className="button button-dark" href="/draw">Continue drawing</Link>
            </div>
          )}
          <div className="earnings-card">
            <WalletCards size={21} />
            <p className="eyebrow">Future creator payout</p>
            <h3>Eligible collections</h3>
            <div className="eligible-collection-list">
              {payoutEligible.map((name, index) => (
                <div key={name}><span>{String(index + 1).padStart(2, "0")}</span><b>{name}</b></div>
              ))}
            </div>
            <p>{payoutEligible.length > 0
              ? "These accepted works have a recorded creator fee share."
              : "No accepted work is payout eligible yet."}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
