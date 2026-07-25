"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Download, Eraser, Eye, EyeOff, Plus, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import Image from "next/image";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import collection from "@/generated/collection.json";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import { composeMaskbornDataUrl, type TraitSelection } from "@/lib/maskborn-renderer";
import { type AccessoryKind, type DraftLayer, useDraftStore } from "@/store/draft";

const palette = ["#1A1815", "#EDEAE2", "#F2B441", "#D85B45", "#5A8F74", "#5B67A5", "#A45488", "#8B633F"];
const accessoryKinds: AccessoryKind[] = ["Eyes", "Hats", "Special"];
const earCategory = collection.categories.find((category) => category.name === "Ears")!;

function visiblePixels(layers: DraftLayer[]) {
  return layers.filter((layer) => layer.visible).flatMap((layer) => layer.pixels);
}

function PixelLayers({ layers }: { layers: DraftLayer[] }) {
  return (
    <>
      {visiblePixels(layers).map((pixel, index) => (
        <rect key={`${pixel.x}-${pixel.y}-${index}`} x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.color} />
      ))}
    </>
  );
}

export function DrawStudio() {
  const draft = useDraftStore();
  const session = useCurrentUser();
  const discordVerified = session.data?.user.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  ) ?? false;
  const [tab, setTab] = useState<"canvas" | "compatibility">("canvas");
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [drawing, setDrawing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "error">("idle");
  const [publishError, setPublishError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"local" | "saving" | "saved" | "conflict">("local");
  const lastSavedAt = useRef<string | null>(null);
  const publishAttempt = useRef<{ hash: string; key: string } | null>(null);
  const pixels = useMemo(() => visiblePixels(draft.layers), [draft.layers]);

  useEffect(() => {
    if (!draft.updatedAt || !session.data?.user.id || !discordVerified || lastSavedAt.current === draft.updatedAt) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiFetch<{ draft: { id: string; version: number } }>(
          `/drafts/${draft.serverId ?? "new"}`,
          {
            method: "PUT",
            body: JSON.stringify({
              expectedVersion: draft.serverVersion ?? undefined,
              kind: draft.postType === "ONE_OF_ONE" ? "ONE_OF_ONE" : "TRAIT_EXTENSION",
              title: draft.title,
              description: draft.description,
              schemaVersion: draft.schemaVersion,
              generatorVersion: `snapshot-${collection.schemaVersion}`,
              payload: {
                postType: draft.postType,
                description: draft.description,
                startBlank: draft.startBlank,
                layers: draft.layers,
              },
            }),
          },
        );
        lastSavedAt.current = draft.updatedAt;
        draft.setServerState(result.draft.id, result.draft.version);
        setSaveStatus("saved");
      } catch (error) {
        setSaveStatus((error as Error & { code?: string }).code === "DRAFT_CONFLICT" ? "conflict" : "local");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [draft, session.data?.user.id, discordVerified]);

  const editAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(31, Math.floor((event.clientX - bounds.left) / bounds.width * 32)));
    const y = Math.max(0, Math.min(31, Math.floor((event.clientY - bounds.top) / bounds.height * 32)));
    if (tool === "erase" || event.buttons === 2) draft.erasePixel(x, y);
    else draft.paintPixel(x, y);
  };

  const loadBaseMarkup = async () => {
    if (draft.postType === "ONE_OF_ONE" && draft.startBlank) return "";
    const source = await fetch("/collection/base.svg").then((response) => response.text());
    return source.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  };

  const buildSvg = (base = "") => {
    const rects = pixels.map((pixel) => `<rect x="${pixel.x}" y="${pixel.y}" width="1" height="1" fill="${pixel.color}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges">${base}${rects}</svg>`;
  };

  const download = async () => {
    const svg = buildSvg(await loadBaseMarkup());
    const link = document.createElement("a");
    link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    link.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "maskborn"}.svg`;
    link.click();
  };

  const publish = async () => {
    if (!discordVerified) {
      window.dispatchEvent(new CustomEvent("maskborn:connect"));
      return;
    }
    if (!draft.title.trim() || !draft.description.trim() || pixels.length === 0) {
      setPublishError("Add a title, description, and at least one drawn pixel before publishing.");
      setPublishStatus("error");
      return;
    }
    setPublishStatus("publishing");
    setPublishError("");
    try {
      const svg = buildSvg(await loadBaseMarkup());
      const previewAssetUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(svg));
      const mediaHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (!publishAttempt.current || publishAttempt.current.hash !== mediaHash) {
        publishAttempt.current = { hash: mediaHash, key: crypto.randomUUID() };
      }
      const categories = [...new Set(draft.layers.map((layer) => layer.kind.toUpperCase()))];
      await apiFetch("/submissions", {
        method: "POST",
        headers: { "idempotency-key": publishAttempt.current.key },
        body: JSON.stringify({
          kind: draft.postType === "ONE_OF_ONE" ? "ONE_OF_ONE" : "TRAIT_EXTENSION",
          title: draft.title,
          description: draft.description,
          generatorVersion: `snapshot-${collection.schemaVersion}`,
          categories,
          pixelData: { schemaVersion: draft.schemaVersion, startBlank: draft.startBlank, layers: draft.layers },
          compatibility: draft.postType === "ACCESSORY"
            ? { checkedAgainst: earCategory.traits.map((ear) => ear.name), layerVisibility: draft.layers.map((layer) => ({ id: layer.id, visible: layer.visible })) }
            : undefined,
          mediaHash,
          previewAssetUrl,
        }),
      });
      setPublished(true);
      setPublishStatus("idle");
    } catch (error) {
      setPublishError((error as Error).message);
      setPublishStatus("error");
    }
  };

  return (
    <section className="studio pixel-studio shell">
      <div className="studio-toolbar">
        <div className="segmented">
          <button className={tab === "canvas" ? "active" : ""} onClick={() => setTab("canvas")}>Pixel canvas</button>
          <button className={tab === "compatibility" ? "active" : ""} onClick={() => setTab("compatibility")}>Ear compatibility</button>
        </div>
        <div className="save-state">
          <Save size={14} />
          {!discordVerified ? "Local only · link Discord to sync" : saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved to profile" : saveStatus === "conflict" ? "Newer draft found" : "Saved locally"}
        </div>
        <button className="text-button" onClick={draft.reset}><RotateCcw size={14} /> Reset</button>
        <button className="button button-dark" onClick={download}><Download size={15} /> Download</button>
        <button className="button button-amber" onClick={publish} disabled={publishStatus === "publishing"}>
          <Send size={15} /> {publishStatus === "publishing" ? "Publishing…" : "Publish"}
        </button>
      </div>

      {tab === "canvas" ? (
        <div className="pixel-editor-layout">
          <aside className="pixel-controls">
            <label className="plain-field">
              <span>Title</span>
              <input value={draft.title} onChange={(event) => draft.setTitle(event.target.value)} />
            </label>
            <label className="plain-field">
              <span>Description</span>
              <textarea value={draft.description} onChange={(event) => draft.setDescription(event.target.value)} rows={3} />
            </label>
            <div className="plain-field">
              <span>Post as</span>
              <div className="post-type-switch">
                <button className={draft.postType === "ONE_OF_ONE" ? "active" : ""} onClick={() => draft.setPostType("ONE_OF_ONE")}>1/1</button>
                <button className={draft.postType === "ACCESSORY" ? "active" : ""} onClick={() => draft.setPostType("ACCESSORY")}>Accessory</button>
              </div>
            </div>
            {draft.postType === "ONE_OF_ONE" && (
              <div className="plain-field">
                <span>Starting point</span>
                <div className="post-type-switch">
                  <button className={!draft.startBlank ? "active" : ""} onClick={() => draft.setStartBlank(false)}>Use base</button>
                  <button className={draft.startBlank ? "active" : ""} onClick={() => draft.setStartBlank(true)}>Blank</button>
                </div>
              </div>
            )}
            {draft.postType === "ACCESSORY" && (
              <p className="studio-note">Accessories always start on the canonical base. Add one or more Eyes, Hats, or Special layers.</p>
            )}
            <div className="tool-row">
              <button className={tool === "draw" ? "active" : ""} onClick={() => setTool("draw")}>Pencil</button>
              <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}><Eraser size={14} /> Erase</button>
            </div>
            <div className="pixel-palette">
              {palette.map((color) => (
                <button
                  key={color}
                  className={draft.color === color ? "active" : ""}
                  style={{ backgroundColor: color }}
                  onClick={() => draft.setColor(color)}
                  aria-label={`Use ${color}`}
                />
              ))}
            </div>
          </aside>

          <div className="pixel-canvas-wrap">
            <svg
              className="pixel-canvas"
              viewBox="0 0 32 32"
              shapeRendering="crispEdges"
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => { setDrawing(true); event.currentTarget.setPointerCapture(event.pointerId); editAtPointer(event); }}
              onPointerMove={(event) => drawing && editAtPointer(event)}
              onPointerUp={() => setDrawing(false)}
              onPointerCancel={() => setDrawing(false)}
            >
              {(draft.postType === "ACCESSORY" || !draft.startBlank) && <image href="/collection/base.svg" width="32" height="32" />}
              <PixelLayers layers={draft.layers} />
              <path className="pixel-grid-lines" d={Array.from({ length: 31 }, (_, index) => `M${index + 1} 0V32M0 ${index + 1}H32`).join("")} />
              <rect width="32" height="32" fill="transparent" />
            </svg>
            <div className="canvas-caption"><span>32 × 32</span><p>Drag to draw. Right-click or choose Erase to remove pixels.</p></div>
          </div>

          <aside className="pixel-layers-panel">
            <div className="layer-panel-head">
              <div><p className="eyebrow">Accessory layers</p><h3>What you are adding</h3></div>
            </div>
            <div className="add-accessory-row">
              {accessoryKinds.map((kind) => <button key={kind} onClick={() => draft.addLayer(kind)}><Plus size={13} /> {kind}</button>)}
            </div>
            <div className="draw-layer-list">
              {draft.layers.map((layer, index) => (
                <article className={draft.activeLayerId === layer.id ? "active" : ""} key={layer.id} onClick={() => draft.setActiveLayer(layer.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><b>{layer.kind}</b><small>{layer.pixels.length} pixels</small></div>
                  <button onClick={(event) => { event.stopPropagation(); draft.toggleLayer(layer.id); }} aria-label={`Toggle ${layer.kind}`}>
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); draft.removeLayer(layer.id); }} aria-label={`Remove ${layer.kind}`}><Trash2 size={14} /></button>
                </article>
              ))}
            </div>
            <button className="text-button clear-layer" onClick={draft.clearActiveLayer}><Trash2 size={13} /> Clear active layer</button>
            {publishError && <p className="field-error publish-error">{publishError}</p>}
          </aside>
        </div>
      ) : (
        <section className="ear-compatibility">
          <div className="compatibility-copy">
            <p className="eyebrow">Real generator ears</p>
            <h2>Check the accessory against every ear.</h2>
            <p>Your visible Eyes, Hats, and Special pixels are placed over each of the ten current ear traits. Hide a layer to isolate another accessory.</p>
          </div>
          <div className="ear-preview-grid">
            {earCategory.traits.map((ear) => {
              const selection: TraitSelection = [0, 0, 0, ear.index, 0, 0, 0, 0];
              return (
                <article key={ear.name}>
                  <div className="compatibility-art">
                    <Image src={composeMaskbornDataUrl(selection)} alt="" fill unoptimized />
                    <svg viewBox="0 0 32 32" shapeRendering="crispEdges"><PixelLayers layers={draft.layers} /></svg>
                  </div>
                  <span>Ears</span><h3>{ear.name}</h3>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <AnimatePresence>
        {published && (
          <motion.div className="publish-toast" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            <Check size={17} /><div><b>Published for community review</b><span>Your pixel layers are stored separately so accepted accessories can be coded into the generator.</span></div>
            <button onClick={() => setPublished(false)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
