"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, Download, ExternalLink, Lock } from "lucide-react";
import { type FormEvent, type WheelEvent, useEffect, useMemo, useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import collection from "@/generated/collection.json";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import { composeMaskbornDataUrl, type TraitSelection } from "@/lib/maskborn-renderer";
import { useSessionStore } from "@/store/session";

const campaignPostUrl = process.env.NEXT_PUBLIC_X_CAMPAIGN_POST_URL ?? "https://x.com";
const campaignPostId = campaignPostUrl.match(/status\/([0-9]{1,19})/)?.[1];
const signalStorageKey = "maskborn-application-signal-v1";
const submittedStorageKey = "maskborn-application-submitted-v1";
const xPostUrl = /^https:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/[0-9]{1,19}(?:[/?#].*)?$/i;

const actions = [
  { label: "Like the post", intent: "like" },
  { label: "Repost it", intent: "retweet" },
  { label: "Leave a comment", intent: "reply" },
] as const;

export function ApplicationForm() {
  const twitter = useSessionStore((state) => state.twitter);
  const storedWallet = useSessionStore((state) => state.wallet);
  const session = useCurrentUser();
  const xAccount = session.data?.user.socialAccounts.find((account) => account.provider === "X_MANUAL");
  const discordVerified = session.data?.user.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  ) ?? false;
  const [selection, setSelection] = useState<TraitSelection>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [checks, setChecks] = useState([false, false, false]);
  const [tweet, setTweet] = useState("");
  const [wallet, setWallet] = useState(storedWallet ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const allChecked = checks.every(Boolean);
  const valid = discordVerified && allChecked && xPostUrl.test(tweet.trim()) && wallet.length > 20;
  const preview = useMemo(() => composeMaskbornDataUrl(selection), [selection]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedChecks = window.localStorage.getItem(signalStorageKey);
      if (storedChecks) {
        try {
          const values = JSON.parse(storedChecks);
          if (Array.isArray(values) && values.length === 3) setChecks(values.map(Boolean));
        } catch {
          window.localStorage.removeItem(signalStorageKey);
        }
      }
      setSubmitted(window.localStorage.getItem(submittedStorageKey) === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return useSessionStore.subscribe((state, previous) => {
      if (state.wallet && state.wallet !== previous.wallet) setWallet(state.wallet);
    });
  }, []);

  const selectTrait = (categoryIndex: number, traitIndex: number) => {
    setSelection((current) => current.map((value, index) => index === categoryIndex ? traitIndex : value) as TraitSelection);
  };

  const answerSignal = (index: number, intent: typeof actions[number]["intent"]) => {
    const next = checks.map((value, itemIndex) => itemIndex === index ? true : value);
    setChecks(next);
    window.localStorage.setItem(signalStorageKey, JSON.stringify(next));
    const intentUrl = campaignPostId
      ? intent === "reply"
        ? `https://x.com/intent/post?in_reply_to=${campaignPostId}`
        : `https://x.com/intent/${intent}?tweet_id=${campaignPostId}`
      : campaignPostUrl;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  };

  const horizontalWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.currentTarget.scrollLeft += event.deltaY;
    }
  };

  const downloadBuild = async () => {
    const artwork = new Image();
    artwork.src = preview;
    await artwork.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(artwork, 0, 0, canvas.width, canvas.height);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "maskborn-build.png";
    link.click();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || submitted) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      let walletId = session.data?.user.wallets.find((item) => item.address.toLowerCase() === wallet.toLowerCase())?.id;
      if (!walletId) {
        const result = await apiFetch<{ wallet: { id: string } }>("/wallet", {
          method: "PUT",
          body: JSON.stringify({ address: wallet, primary: true }),
        });
        walletId = result.wallet.id;
      }
      await apiFetch("/applications", {
        method: "POST",
        body: JSON.stringify({
          walletId,
          quotePostUrl: tweet,
          builderTraits: selection,
          checklist: { liked: true, reposted: true, commented: true },
        }),
      });
      window.localStorage.setItem(submittedStorageKey, "true");
      setSubmitted(true);
    } catch (error) {
      const requestError = error as Error & { code?: string };
      if (requestError.code === "APPLICATION_ALREADY_SUBMITTED") {
        window.localStorage.setItem(submittedStorageKey, "true");
        setSubmitted(true);
      } else {
        setSubmitError(requestError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div className="success-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="success-mark"><Check size={32} /></div>
        <p className="eyebrow">Application received</p>
        <h2>Your application is already in the queue.</h2>
        <p>Each verified profile can submit this application once. Follow its review status from your profile.</p>
      </motion.div>
    );
  }

  return (
    <form className="application-layout shell" onSubmit={submit}>
      <aside className="application-steps">
        <p className="eyebrow">Before you build</p>
        <h2>Answer the signal.</h2>
        <a href={campaignPostUrl} target="_blank" rel="noreferrer" className="campaign-link">
          Open campaign post <ExternalLink size={15} />
        </a>
        {actions.map((action, index) => (
          <button
            type="button"
            className={`check-row signal-action ${checks[index] ? "complete" : ""}`}
            key={action.label}
            onClick={() => answerSignal(index, action.intent)}
          >
            <span className="fake-check">{checks[index] && <Check size={14} />}</span>
            {action.label}
            <ExternalLink size={13} />
          </button>
        ))}
        <p className="verification-note">Each action opens the campaign post and is remembered in this browser. The team checks the actions manually.</p>
      </aside>

      <section className="builder-panel">
        <div className="builder-head">
          <div><p className="eyebrow">Mask builder</p><h2>Assemble your order</h2></div>
          <button type="button" className="button button-dark build-download" onClick={downloadBuild}>
            <Download size={15} /> Download
          </button>
        </div>
        <div className="builder-workspace">
          <div className="builder-preview"><PixelArtwork source={preview} label="Your assembled Maskborn" /></div>
          <div className="trait-picker">
            {collection.categories.map((category) => (
              <div className="trait-group" key={category.name}>
                <p>{category.name} <span>{category.traits[selection[category.index]].name}</span></p>
                <div className="trait-strip" onWheel={horizontalWheel}>
                  {category.traits.slice(0, 30).map((trait) => (
                    <button
                      type="button"
                      className={selection[category.index] === trait.index ? "selected" : ""}
                      onClick={() => selectTrait(category.index, trait.index)}
                      key={trait.name}
                      title={trait.name}
                    >
                      <PixelArtwork source={trait.preview} label={`${category.name}: ${trait.name}`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`application-submit ${allChecked ? "unlocked" : "locked"}`}>
        {!allChecked ? (
          <div className="final-lock">
            <Lock size={22} />
            <p className="eyebrow">Final check locked</p>
            <h2>Answer all three signals first.</h2>
            <p>Your quote-post and wallet fields open after Like, Repost, and Comment are completed.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="eyebrow">Final check</p>
              <h2>Quote it. Paste it. Send it.</h2>
              <p>Your X post ties this version of the build to your application.</p>
            </div>
            <div className="form-stack">
              <label>
                <span>Quote post URL</span>
                <input value={tweet} onChange={(event) => setTweet(event.target.value)} placeholder="https://x.com/you/status/..." />
              </label>
              <label>
                <span>Wallet address</span>
                <input value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="Paste the wallet for this submission" />
              </label>
              {!(xAccount || twitter) && <p className="field-hint">Add your X username from the header before submission.</p>}
              {!discordVerified && <p className="field-hint">Link Discord from the header before submitting.</p>}
              {submitError && <p className="field-error">{submitError}</p>}
              <button className="button button-amber submit-application" disabled={!valid || submitting}>
                {submitting ? "Sending…" : "Submit application"} <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}
      </section>
    </form>
  );
}
