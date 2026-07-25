"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectModal } from "@/components/connect-modal";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSessionStore } from "@/store/session";

const navItems = [
  { href: "/", label: "Home", primary: true },
  { href: "/gallery", label: "Gallery", primary: true },
  { href: "/draw", label: "Draw", primary: false },
  { href: "/apply", label: "Apply", primary: true },
  { href: "/community", label: "Community gallery", primary: false },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const localTwitter = useSessionStore((state) => state.twitter);
  const session = useCurrentUser();
  const xAccount = session.data?.user.socialAccounts.find((account) => account.provider === "X_MANUAL");
  const discordVerified = session.data?.user.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  ) ?? false;
  const twitter = xAccount?.username
    ? `@${xAccount.username}`
    : localTwitter;

  useMotionValueEvent(scrollY, "change", (value) => setCompact(value > 90));

  useEffect(() => {
    const openConnect = () => setConnectOpen(true);
    window.addEventListener("maskborn:connect", openConnect);
    return () => window.removeEventListener("maskborn:connect", openConnect);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const collapsed = compact || mobile;

  return (
    <>
      <motion.header
        className="site-header"
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.nav
          className="nav-capsule"
          animate={{ width: collapsed ? "min(590px, calc(100vw - 138px))" : "min(790px, calc(100vw - 138px))" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          aria-label="Main navigation"
        >
          <Link className="wordmark" href="/" aria-label="Mask Born Order home">
            MB<span>O</span>
          </Link>
          <div className="nav-links">
            {navItems.map((item) => (
              <AnimatePresence key={item.href} initial={false}>
                {(!collapsed || item.primary) && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                  >
                    <Link className={pathname === item.href ? "active" : ""} href={item.href}>
                      {item.label}
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
          <AnimatePresence>
            {collapsed && (
              <motion.button
                className="menu-trigger"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setMenuOpen((value) => !value)}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X size={16} /> : <Menu size={16} />} Menu
              </motion.button>
            )}
          </AnimatePresence>
        </motion.nav>
        <button className="connect-button" onClick={() => setConnectOpen(true)}>
          <span className={discordVerified ? "status-dot online" : "status-dot"} />
          {discordVerified ? (twitter?.replace("@", "") ?? "Discord linked") : (twitter ? "Verify" : "Connect")}
        </button>
      </motion.header>

      <AnimatePresence>
        {menuOpen && collapsed && (
          <motion.div
            className="nav-drawer"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {navItems.map((item, index) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                <span>0{index + 1}</span>{item.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}
