"use client";

import { AlertTriangle, ArrowRight, Check, ChevronDown, Clock3, Ellipsis, Search, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import { artworks } from "@/lib/data";

const tabs = ["Review queue", "Gallery", "Traits", "Restrictions", "Payouts", "Settings"];

export function AdminDashboard() {
  const [tab, setTab] = useState("Review queue");
  const [selected, setSelected] = useState(artworks[2]);

  return (
    <section className="admin-shell">
      <aside className="admin-nav">
        <div><span className="admin-mark">MBO</span><p>Control room</p></div>
        <nav>
          {tabs.map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}
        </nav>
        <div className="admin-user"><span>WA</span><div><b>Wale</b><p>Administrator</p></div><Ellipsis size={16} /></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div><p className="eyebrow">Admin / {tab}</p><h1>{tab}</h1></div>
          <div className="admin-actions"><button><Search size={16} /></button><button><AlertTriangle size={16} /><span>3</span></button></div>
        </header>
        <div className="admin-stats">
          <article><span>Waiting for review</span><b>18</b><p><Clock3 size={13} /> 4 older than 12h</p></article>
          <article><span>Added this week</span><b>07</b><p><Check size={13} /> 3 traits, 4 one-of-ones</p></article>
          <article><span>Vote restrictions</span><b>03</b><p><ShieldCheck size={13} /> 2 expire today</p></article>
          <article><span>Pending payouts</span><b>1.42</b><p>ETH across 6 creators</p></article>
        </div>
        <div className="review-layout">
          <section className="review-queue">
            <div className="review-head"><h2>Incoming work</h2><button>Oldest first <ChevronDown size={14} /></button></div>
            {artworks.slice(1, 5).map((art) => (
              <button className={selected.id === art.id ? "selected" : ""} onClick={() => setSelected(art)} key={art.id}>
                <PixelArtwork variant={art.variant} />
                <div><span>{art.type} · {art.submittedAt}</span><b>{art.title}</b><p>{art.creator}</p></div>
                <div className="queue-score"><b>{art.upvotes - art.downvotes}</b><span>score</span></div>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
          <aside className="review-detail">
            <div className="review-preview"><PixelArtwork variant={selected.variant} /></div>
            <div className="review-detail-head"><span>{selected.type}</span><h2>{selected.title}</h2><p>by {selected.creator}</p></div>
            <div className="review-metrics">
              <div><span>Up</span><b>{selected.upvotes}</b></div>
              <div><span>Down</span><b>{selected.downvotes}</b></div>
              <div><span>Risk</span><b>Low</b></div>
            </div>
            <label className="plain-field"><span>Add to gallery as</span><button className="fake-select">{selected.type === "1/1" ? "1/1 artwork" : `${selected.type} trait`} <ChevronDown size={14} /></button></label>
            <label className="plain-field"><span>Review note</span><textarea placeholder="Add a private note for the audit log" /></label>
            <div className="review-actions"><button className="button reject">Reject</button><button className="button button-amber">Approve and add</button></div>
            <p className="audit-note"><UserRound size={13} /> This action records your account, timestamp, note, and the previous state.</p>
          </aside>
        </div>
      </main>
    </section>
  );
}
