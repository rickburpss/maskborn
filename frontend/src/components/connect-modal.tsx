"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, LogIn, LogOut, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import { useSessionStore } from "@/store/session";

const walletPattern = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
const usernamePattern = /^@?[A-Za-z0-9_]{1,15}$/;

export function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const local = useSessionStore();
  const session = useCurrentUser();
  const queryClient = useQueryClient();
  const xAccount = session.data?.user?.socialAccounts.find((account) => account.provider === "X_MANUAL");
  const discordAccount = session.data?.user?.socialAccounts.find(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  );
  const twitter = xAccount?.username
    ? `@${xAccount.username}`
    : local.twitter;
  const remoteWallet = session.data?.user?.wallets.find((item) => item.isPrimary)?.address;
  const wallet = remoteWallet ?? local.wallet;
  const [usernameInput, setUsernameInput] = useState(twitter ?? "");
  const [walletInput, setWalletInput] = useState(wallet ?? "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const isSignedIn = Boolean(session.data?.user?.id);
  const showAccountChoice = !session.isLoading && !isSignedIn && !creatingAccount;
  const showAccountFlow = isSignedIn || creatingAccount;

  const closeModal = () => {
    setCreatingAccount(false);
    onClose();
  };

  const submitUsername = async (event: FormEvent) => {
    event.preventDefault();
    const value = usernameInput.trim();
    if (!usernamePattern.test(value)) {
      setError("Enter a valid X username.");
      return;
    }
    try {
      const normalized = value.replace(/^@/, "").toLowerCase();
      await apiFetch("/auth/username", {
        method: "POST",
        body: JSON.stringify({ username: normalized }),
      });
      local.connectTwitter(`@${normalized}`);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      setError("");
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const submitWallet = async (event: FormEvent) => {
    event.preventDefault();
    const value = walletInput.trim();
    if (!walletPattern.test(value)) {
      setError("Paste a valid EVM or Solana wallet address.");
      return;
    }
    try {
      await apiFetch("/wallet", { method: "PUT", body: JSON.stringify({ address: value, primary: true }) });
      local.setWallet(value);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      setError("");
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && closeModal()}
        >
          <motion.section
            className="connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <button className="icon-button modal-close" onClick={closeModal} aria-label="Close connect dialog">
              <X size={18} />
            </button>
            <p className="eyebrow">Your identity</p>
            <h2 id="connect-title">{showAccountChoice ? "Enter the order" : isSignedIn ? "Your account" : "Create account"}</h2>
            <p className="modal-copy">
              {showAccountChoice
                ? "Already a member, or joining for the first time?"
                : "Use X for attribution, verify with Discord, then add your payout wallet."}
            </p>

            {showAccountChoice && (
              <div className="account-choice">
                <Link className="account-choice-button" href="/connect/discord" onClick={closeModal}>
                  <LogIn size={19} />
                  <span><b>Have an account</b><small>Log in with linked Discord</small></span>
                  <ArrowRight size={17} />
                </Link>
                <button className="account-choice-button" type="button" onClick={() => setCreatingAccount(true)}>
                  <UserPlus size={19} />
                  <span><b>Create account</b><small>Start a new member profile</small></span>
                  <ArrowRight size={17} />
                </button>
              </div>
            )}

            {creatingAccount && !isSignedIn && (
              <button className="account-choice-back" type="button" onClick={() => setCreatingAccount(false)}>
                <ArrowLeft size={14} /> Account options
              </button>
            )}

            {showAccountFlow && <div className="connect-step">
              <div className="step-index">{twitter ? <Check size={16} /> : "01"}</div>
              <div>
                <span className="field-label">X account</span>
                {twitter ? (
                  <p className="connected-value">{twitter}</p>
                ) : (
                  <form onSubmit={submitUsername}>
                    <div className="input-action">
                      <input
                        value={usernameInput}
                        onChange={(event) => setUsernameInput(event.target.value)}
                        placeholder="@username"
                        autoComplete="username"
                        aria-label="X username"
                      />
                      <button aria-label="Save X username"><ArrowRight size={17} /></button>
                    </div>
                  </form>
                )}
              </div>
            </div>}

            {showAccountFlow && <div className="connect-step">
              <div className="step-index">{discordAccount ? <Check size={16} /> : "02"}</div>
              <div>
                <span className="field-label">Discord verification</span>
                {discordAccount ? (
                  <p className="connected-value">{discordAccount.username}</p>
                ) : twitter ? (
                  <Link className="button button-dark" href="/connect/discord" onClick={closeModal}>
                    Link Discord <ArrowRight size={16} />
                  </Link>
                ) : (
                  <>
                    <button className="button button-dark" type="button" disabled>Link Discord <ArrowRight size={16} /></button>
                    <p className="field-hint">Save your X username first.</p>
                  </>
                )}
              </div>
            </div>}

            {showAccountFlow && <div className="connect-step">
              <div className="step-index">{wallet ? <Check size={16} /> : "03"}</div>
              <form onSubmit={submitWallet}>
                <label className="field-label" htmlFor="wallet">Payout wallet</label>
                {wallet ? (
                  <button type="button" className="wallet-value" onClick={copyWallet}>
                    {wallet.slice(0, 8)}…{wallet.slice(-6)} {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                ) : (
                  <>
                    <div className="input-action">
                      <input
                        id="wallet"
                        value={walletInput}
                        onChange={(event) => setWalletInput(event.target.value)}
                        placeholder="0x... or Solana address"
                        autoComplete="off"
                        disabled={!discordAccount}
                      />
                      <button aria-label="Save wallet" disabled={!discordAccount}><ArrowRight size={17} /></button>
                    </div>
                    {!discordAccount && <p className="field-hint">Link Discord before adding a wallet.</p>}
                    {error && <p className="field-error">{error}</p>}
                  </>
                )}
              </form>
            </div>}

            {(twitter || discordAccount) && (
              <div className="modal-actions">
                <Link href="/profile" className="button button-amber" onClick={closeModal}>Open profile</Link>
                <button className="text-button danger" onClick={async () => {
                  try {
                    await apiFetch("/auth/disconnect", { method: "POST" });
                    local.disconnect();
                    setUsernameInput("");
                    setWalletInput("");
                    await queryClient.cancelQueries({ queryKey: ["session"] });
                    queryClient.setQueryData(["session"], { user: null });
                    setError("");
                    closeModal();
                  } catch (requestError) {
                    setError((requestError as Error).message);
                  }
                }}>
                  <LogOut size={15} /> Disconnect
                </button>
              </div>
            )}
            {session.data?.user?.role === "ADMIN" && showAccountFlow && (
              <Link className="admin-account-link" href="/mboadmin" onClick={closeModal}>Open admin control room <ArrowRight size={14} /></Link>
            )}
            {showAccountFlow && <p className="fine-print">Discord verification is required for every action. The pasted X username remains unverified attribution.</p>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
