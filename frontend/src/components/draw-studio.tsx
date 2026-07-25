"use client";

import { AnimatePresence, motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Eraser, Eye, EyeOff, Plus, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import NextImage from "next/image";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import collection from "@/generated/collection.json";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import { composeMaskbornDataUrl, type TraitSelection } from "@/lib/maskborn-renderer";
import { type AccessoryKind, type DraftLayer, useDraftStore } from "@/store/draft";

const palette = [
  "#1A1815", "#EDEAE2", "#FFFFFF", "#8A8A82",
  "#F2B441", "#F06A32", "#D85B45", "#B82E38",
  "#E881A6", "#A45488", "#7356A8", "#5B67A5",
  "#3D91C7", "#57B8A6", "#5A8F74", "#8B633F",
];
const accessoryKinds: AccessoryKind[] = ["Background", "Eyes", "Hats", "Special"];
const compatibilityGroups = [
  { name: "Ears", categoryIndex: 3 },
  { name: "Masks", categoryIndex: 5 },
  { name: "Tails", categoryIndex: 4 },
] as const;

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
  const queryClient = useQueryClient();
  const discordVerified = session.data?.user.socialAccounts.some(
    (account) => account.provider === "DISCORD" && account.verificationState === "VERIFIED",
  ) ?? false;
  const [tab, setTab] = useState<"canvas" | "compatibility">("canvas");
  const [compatibilityGroup, setCompatibilityGroup] = useState<"Ears" | "Masks" | "Tails">("Ears");
  const [previewBackground, setPreviewBackground] = useState(false);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [drawing, setDrawing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "error">("idle");
  const [publishError, setPublishError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"local" | "saving" | "saved" | "conflict">("local");
  const lastSavedAt = useRef<string | null>(null);
  const publishAttempt = useRef<{ hash: string; key: string } | null>(null);
  const pixels = useMemo(() => visiblePixels(draft.layers), [draft.layers]);
  const backgroundLayers = draft.layers.filter((layer) => layer.kind === "Background");
  const foregroundLayers = draft.layers.filter((layer) => layer.kind !== "Background");
  const activeLayer = draft.layers.find((layer) => layer.id === draft.activeLayerId);
  const editingBackground = activeLayer?.kind === "Background" && !previewBackground;
  const selectedCompatibility = compatibilityGroups.find((group) => group.name === compatibilityGroup)!;
  const compatibilityCategory = collection.categories.find((category) => category.name === compatibilityGroup)!;
  const profile = useQuery({
    queryKey: ["profile", "submission-slots"],
    queryFn: () => apiFetch<{
      slots: {
        oneOfOne: { limit: number; consumed: number };
        traits: { usedCategories: string[] };
      };
    }>("/profile"),
    enabled: discordVerified,
    retry: false,
  });
  const usedTraitCategories = new Set(profile.data?.slots.traits.usedCategories ?? []);
  const availableAccessoryKinds = accessoryKinds.filter((kind) => !usedTraitCategories.has(kind.toUpperCase()));
  const repeatedDraftTraits = draft.postType === "ACCESSORY"
    ? [...new Set(draft.layers.map((layer) => layer.kind))].filter((kind) => usedTraitCategories.has(kind.toUpperCase()))
    : [];
  const oneOfOneExhausted = (profile.data?.slots.oneOfOne.consumed ?? 0) >= (profile.data?.slots.oneOfOne.limit ?? 2);

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
    if (activeLayer?.kind === "Background" && previewBackground) return;
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
    const rects = (layers: DraftLayer[]) => visiblePixels(layers)
      .map((pixel) => `<rect x="${pixel.x}" y="${pixel.y}" width="1" height="1" fill="${pixel.color}"/>`)
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges">${rects(backgroundLayers)}${base}${rects(foregroundLayers)}</svg>`;
  };

  const download = async () => {
    const svg = buildSvg(await loadBaseMarkup());
    const artwork = new Image();
    artwork.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
    link.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "maskborn"}.png`;
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
    if (repeatedDraftTraits.length > 0) {
      setPublishError(`Already submitted trait type: ${repeatedDraftTraits.join(", ")}. Remove it and use one of the remaining types.`);
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
            ? {
                checkedAgainst: Object.fromEntries(compatibilityGroups.map((group) => [
                  group.name,
                  collection.categories.find((category) => category.name === group.name)!.traits.map((trait) => trait.name),
                ])),
                layerVisibility: draft.layers.map((layer) => ({ id: layer.id, visible: layer.visible })),
              }
            : undefined,
          mediaHash,
          previewAssetUrl,
        }),
      });
      setPublished(true);
      setPublishStatus("idle");
      await queryClient.invalidateQueries({ queryKey: ["profile", "submission-slots"] });
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
          <button className={tab === "compatibility" ? "active" : ""} onClick={() => setTab("compatibility")}>Compatibility</button>
        </div>
        <div className="save-state">
          <Save size={14} />
          {!discordVerified ? "Local only · link Discord to sync" : saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved to profile" : saveStatus === "conflict" ? "Newer draft found" : "Saved locally"}
        </div>
        <button className="text-button" onClick={draft.reset}><RotateCcw size={14} /> Reset</button>
        <button className="button button-dark" onClick={download}><Download size={15} /> Download</button>
        <button className="button button-amber" onClick={publish} disabled={publishStatus === "publishing" || repeatedDraftTraits.length > 0}>
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
                <button className={draft.postType === "ONE_OF_ONE" ? "active" : ""} onClick={() => draft.setPostType("ONE_OF_ONE")} disabled={oneOfOneExhausted}>1/1</button>
                <button className={draft.postType === "ACCESSORY" ? "active" : ""} onClick={() => draft.setPostType("ACCESSORY")}>Trait(s)</button>
              </div>
              {oneOfOneExhausted && <p className="field-hint">Both lifetime 1/1 submissions have been used.</p>}
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
              <p className="studio-note">Trait posts start on the canonical base. Each of Background, Eyes, Hats, and Special can be submitted only once per profile.</p>
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
            <label className="custom-color">
              <span>Mix your own</span>
              <input type="color" value={draft.color} onChange={(event) => draft.setColor(event.target.value.toUpperCase())} />
              <b>{draft.color}</b>
            </label>
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
              {editingBackground ? (
                <PixelLayers layers={backgroundLayers} />
              ) : (
                <>
                  <PixelLayers layers={backgroundLayers} />
                  {(draft.postType === "ACCESSORY" || !draft.startBlank) && <image href="/collection/base.svg" width="32" height="32" />}
                  <PixelLayers layers={foregroundLayers} />
                </>
              )}
              <path className="pixel-grid-lines" d={Array.from({ length: 31 }, (_, index) => `M${index + 1} 0V32M0 ${index + 1}H32`).join("")} />
              <rect width="32" height="32" fill="transparent" />
            </svg>
            <div className="canvas-caption">
              <span>32 × 32</span>
              <p>{editingBackground ? "Background mode: the Maskborn is hidden while you paint." : "Drag to draw. Right-click or choose Erase to remove pixels."}</p>
              {activeLayer?.kind === "Background" && (
                <button className="text-button background-preview-toggle" onClick={() => setPreviewBackground((value) => !value)}>
                  {previewBackground ? "Back to painting" : "Done · preview with Maskborn"}
                </button>
              )}
            </div>
          </div>

          <aside className="pixel-layers-panel">
            <div className="layer-panel-head">
              <div><p className="eyebrow">Trait layers</p><h3>What you are adding</h3></div>
            </div>
            <div className="add-accessory-row">
              {availableAccessoryKinds.map((kind) => (
                  <button key={kind} onClick={() => {
                    draft.addLayer(kind);
                    if (kind === "Background") setPreviewBackground(false);
                  }}>
                    <Plus size={13} /> {kind}
                  </button>
              ))}
              {availableAccessoryKinds.length === 0 && <p className="field-hint">All four trait submission types have been used.</p>}
            </div>
            <div className="draw-layer-list">
              {draft.layers.map((layer, index) => (
                <article className={draft.activeLayerId === layer.id ? "active" : ""} key={layer.id} onClick={() => {
                  draft.setActiveLayer(layer.id);
                  if (layer.kind === "Background") setPreviewBackground(false);
                }}>
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
            <p className="eyebrow">Real generator traits</p>
            <h2>Check ears, masks, and tails.</h2>
            <p>Switch groups to see your visible Eyes, Hats, and Special pixels against every current compatibility trait. Background layers stay beneath the character.</p>
            <div className="compatibility-switch">
              {compatibilityGroups.map((group) => (
                <button className={compatibilityGroup === group.name ? "active" : ""} key={group.name} onClick={() => setCompatibilityGroup(group.name)}>
                  {group.name} <span>{collection.categories.find((category) => category.name === group.name)!.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ear-preview-grid">
            {compatibilityCategory.traits.map((trait) => {
              const selection = [0, 0, 0, 0, 0, 0, 0, 0] as TraitSelection;
              selection[selectedCompatibility.categoryIndex] = trait.index;
              return (
                <article key={trait.name}>
                  <div className="compatibility-art">
                    <NextImage src={composeMaskbornDataUrl(selection)} alt="" fill unoptimized />
                    <svg viewBox="0 0 32 32" shapeRendering="crispEdges"><PixelLayers layers={foregroundLayers} /></svg>
                  </div>
                  <span>{compatibilityGroup}</span><h3>{trait.name}</h3>
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
