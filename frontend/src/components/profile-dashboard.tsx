"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Copy, FilePenLine, Plus, WalletCards } from "lucide-react";
import Link from "next/link";
import { PixelArtwork } from "@/components/pixel-artwork";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import { artworks } from "@/lib/data";
import { useSessionStore } from "@/store/session";

export function ProfileDashboard() {
  const localTwitter = useSessionStore((state) => state.twitter);
  const localWallet = useSessionStore((state) => state.wallet);
  const session = useCurrentUser();
  const remoteUsername = session.data?.user.socialAccounts.find((account) => account.provider === "X_MANUAL")?.username;
  const twitter = remoteUsername ? `@${remoteUsername}` : localTwitter ?? "@not-connected";
  const wallet = session.data?.user.wallets.find((item) => item.isPrimary)?.address ?? localWallet;
  const userArt = [artworks[0], artworks[3]];
  const payoutEligible = ["Bone Merchant"];
  const profile = useQuery({
    queryKey: ["profile", "submission-slots"],
    queryFn: () => apiFetch<{
      slots: {
        oneOfOne: { limit: number; consumed: number };
        traits: { usedCategories: string[]; allowedCategories: string[] };
      };
    }>("/profile"),
    enabled: Boolean(session.data?.user.id),
    retry: false,
  });
  const oneOfOneSlots = profile.data?.slots.oneOfOne;
  const usedTraits = profile.data?.slots.traits.usedCategories.length ?? 0;
  const traitTotal = profile.data?.slots.traits.allowedCategories.length ?? 4;

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
        <article><span>Community score</span><b>701</b><p>Upvotes across your work</p></article>
        <article><span>1/1 submissions</span><b>{oneOfOneSlots?.consumed ?? 0} / {oneOfOneSlots?.limit ?? 2}</b><p>Two lifetime submissions</p></article>
        <article><span>Trait types used</span><b>{usedTraits} / {traitTotal}</b><p>One submission per trait type</p></article>
        <article><span>Payout eligible</span><b>{payoutEligible.length}</b><p>Accepted creator collection</p></article>
      </div>

      <div className="profile-main-grid">
        <div>
          <div className="profile-section-head"><div><p className="eyebrow">Your work</p><h2>Submissions</h2></div><Link href="/draw"><Plus size={15} /> New work</Link></div>
          <div className="submission-list">
            {userArt.map((art, index) => (
              <article key={art.id}>
                <PixelArtwork variant={art.variant} />
                <div className="submission-title"><span>{art.type}</span><Link href={`/art/${art.slug}`}>{art.title}</Link><p>{art.submittedAt}</p></div>
                <div className="submission-votes"><b>{art.upvotes}</b><span>upvotes</span></div>
                <span className={`status-tag ${index === 0 ? "accepted" : ""}`}>{art.status}</span>
                <Link className="icon-button" href={`/art/${art.slug}`}><ArrowUpRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
        <aside className="profile-aside">
          <div className="draft-card">
            <FilePenLine size={21} />
            <p className="eyebrow">Local draft</p>
            <h3>Untitled mask</h3>
            <p>Saved in this browser a few moments ago.</p>
            <Link className="button button-dark" href="/draw">Continue drawing</Link>
          </div>
          <div className="earnings-card">
            <WalletCards size={21} />
            <p className="eyebrow">Future creator payout</p>
            <h3>Eligible collections</h3>
            <div className="eligible-collection-list">
              {payoutEligible.map((name, index) => (
                <div key={name}><span>{String(index + 1).padStart(2, "0")}</span><b>{name}</b></div>
              ))}
            </div>
            <p>Names appear here when your accepted 1/1 is marked eligible before launch.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
