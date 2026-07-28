"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccessoryKind = "Background" | "Eyes" | "Hats" | "Special";
export type DraftPixel = { x: number; y: number; color: string };
export type DraftLayer = {
  id: string;
  kind: AccessoryKind;
  name: string;
  visible: boolean;
  pixels: DraftPixel[];
};

type LayerSnapshot = {
  layers: DraftLayer[];
  activeLayerId: string;
};

type DraftState = {
  schemaVersion: 2;
  title: string;
  description: string;
  postType: "ONE_OF_ONE" | "ACCESSORY";
  startBlank: boolean;
  layers: DraftLayer[];
  activeLayerId: string;
  color: string;
  updatedAt: string | null;
  serverId: string | null;
  serverVersion: number | null;
  past: LayerSnapshot[];
  future: LayerSnapshot[];
  strokeStart: LayerSnapshot | null;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setPostType: (postType: "ONE_OF_ONE" | "ACCESSORY") => void;
  setStartBlank: (startBlank: boolean) => void;
  setColor: (color: string) => void;
  setActiveLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  addLayer: (kind: AccessoryKind) => void;
  removeLayer: (id: string) => void;
  toggleLayer: (id: string) => void;
  beginStroke: () => void;
  endStroke: () => void;
  paintPixels: (coordinates: Array<{ x: number; y: number }>) => void;
  erasePixels: (coordinates: Array<{ x: number; y: number }>) => void;
  clearActiveLayer: () => void;
  undo: () => void;
  redo: () => void;
  setServerState: (serverId: string, serverVersion: number) => void;
  reset: () => void;
};

const singularKind = (kind: AccessoryKind) => kind === "Eyes" ? "Eye" : kind === "Hats" ? "Hat" : kind;

const firstLayer = (): DraftLayer => ({
  id: "hats-1",
  kind: "Hats",
  name: "Hat 1",
  visible: true,
  pixels: [],
});

const initial = {
  schemaVersion: 2 as const,
  title: "Untitled mask",
  description: "A community-made Maskborn contribution.",
  postType: "ACCESSORY" as const,
  startBlank: false,
  layers: [firstLayer()],
  activeLayerId: "hats-1",
  color: "#F2B441",
  updatedAt: null as string | null,
  serverId: null as string | null,
  serverVersion: null as number | null,
  past: [] as LayerSnapshot[],
  future: [] as LayerSnapshot[],
  strokeStart: null as LayerSnapshot | null,
};

const touched = () => new Date().toISOString();
const accessoryKindSet = new Set<AccessoryKind>(["Background", "Eyes", "Hats", "Special"]);

function restoreLayers(value: unknown, fallback: DraftLayer[]) {
  if (!Array.isArray(value)) return fallback;
  const usedIds = new Set<string>();
  const restored = value.flatMap((candidate, index): DraftLayer[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const layer = candidate as Record<string, unknown>;
    if (typeof layer.kind !== "string" || !accessoryKindSet.has(layer.kind as AccessoryKind)) return [];
    const kind = layer.kind as AccessoryKind;
    const rawId = typeof layer.id === "string" && layer.id.trim() ? layer.id : `${kind.toLowerCase()}-${index + 1}`;
    const id = usedIds.has(rawId) ? `${rawId}-${index + 1}` : rawId;
    usedIds.add(id);
    const coordinates = new Map<string, DraftPixel>();
    if (Array.isArray(layer.pixels)) {
      for (const candidatePixel of layer.pixels.slice(0, 1024)) {
        if (!candidatePixel || typeof candidatePixel !== "object") continue;
        const pixel = candidatePixel as Record<string, unknown>;
        if (
          Number.isInteger(pixel.x)
          && Number.isInteger(pixel.y)
          && Number(pixel.x) >= 0
          && Number(pixel.x) < 32
          && Number(pixel.y) >= 0
          && Number(pixel.y) < 32
          && typeof pixel.color === "string"
          && /^#[0-9a-f]{6}$/i.test(pixel.color)
        ) {
          const x = Number(pixel.x);
          const y = Number(pixel.y);
          coordinates.set(`${x},${y}`, { x, y, color: pixel.color.toUpperCase() });
        }
      }
    }
    return [{
      id,
      kind,
      name: typeof layer.name === "string" && layer.name.trim()
        ? layer.name.trim()
        : `${singularKind(kind)} ${index + 1}`,
      visible: typeof layer.visible === "boolean" ? layer.visible : true,
      pixels: [...coordinates.values()],
    }];
  });
  return restored.length > 0 ? restored : fallback;
}

const snapshot = (state: Pick<DraftState, "layers" | "activeLayerId">): LayerSnapshot => ({
  layers: state.layers,
  activeLayerId: state.activeLayerId,
});
const addHistory = (state: DraftState) => ({
  past: [...state.past.slice(-49), snapshot(state)],
  future: [],
});

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      ...initial,
      setTitle: (title) => set({ title, updatedAt: touched() }),
      setDescription: (description) => set({ description, updatedAt: touched() }),
      setPostType: (postType) => set({
        postType,
        startBlank: false,
        updatedAt: touched(),
      }),
      setStartBlank: (startBlank) => set({ startBlank, updatedAt: touched() }),
      setColor: (color) => set({ color }),
      setActiveLayer: (activeLayerId) => set((state) =>
        state.layers.some((layer) => layer.id === activeLayerId) ? { activeLayerId } : state),
      renameLayer: (id, name) => set((state) => {
        const layer = state.layers.find((item) => item.id === id);
        if (!layer || layer.name === name) return state;
        return {
          ...addHistory(state),
          layers: state.layers.map((item) => item.id === id ? { ...item, name } : item),
          updatedAt: touched(),
        };
      }),
      addLayer: (kind) => set((state) => {
        const id = `${kind.toLowerCase()}-${crypto.randomUUID()}`;
        const count = state.layers.filter((layer) => layer.kind === kind).length + 1;
        return {
          ...addHistory(state),
          layers: [...state.layers, { id, kind, name: `${singularKind(kind)} ${count}`, visible: true, pixels: [] }],
          activeLayerId: id,
          updatedAt: touched(),
        };
      }),
      removeLayer: (id) => set((state) => {
        if (state.layers.length === 1 || !state.layers.some((layer) => layer.id === id)) return state;
        const layers = state.layers.filter((layer) => layer.id !== id);
        return {
          ...addHistory(state),
          layers,
          activeLayerId: state.activeLayerId === id ? layers[0].id : state.activeLayerId,
          updatedAt: touched(),
        };
      }),
      toggleLayer: (id) => set((state) => {
        if (!state.layers.some((layer) => layer.id === id)) return state;
        return {
          ...addHistory(state),
          layers: state.layers.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer),
          updatedAt: touched(),
        };
      }),
      beginStroke: () => set((state) => state.strokeStart ? state : { strokeStart: snapshot(state) }),
      endStroke: () => set((state) => {
        if (!state.strokeStart) return state;
        if (state.layers === state.strokeStart.layers) return { strokeStart: null };
        return {
          past: [...state.past.slice(-49), state.strokeStart],
          future: [],
          strokeStart: null,
        };
      }),
      paintPixels: (coordinates) => set((state) => {
        const active = state.layers.find((layer) => layer.id === state.activeLayerId);
        if (!active) return state;
        const valid = coordinates.filter(({ x, y }) =>
          Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < 32 && y >= 0 && y < 32);
        if (valid.length === 0) return state;
        const next = new Map(active.pixels.map((pixel) => [`${pixel.x},${pixel.y}`, pixel]));
        let changed = false;
        for (const { x, y } of valid) {
          const key = `${x},${y}`;
          if (next.get(key)?.color !== state.color) {
            next.set(key, { x, y, color: state.color });
            changed = true;
          }
        }
        if (!changed) return state;
        return {
          layers: state.layers.map((layer) =>
            layer.id === state.activeLayerId ? { ...layer, pixels: [...next.values()] } : layer),
          updatedAt: touched(),
        };
      }),
      erasePixels: (coordinates) => set((state) => {
        const active = state.layers.find((layer) => layer.id === state.activeLayerId);
        if (!active) return state;
        const removed = new Set(coordinates
          .filter(({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < 32 && y >= 0 && y < 32)
          .map(({ x, y }) => `${x},${y}`));
        if (!active.pixels.some((pixel) => removed.has(`${pixel.x},${pixel.y}`))) return state;
        return {
          layers: state.layers.map((layer) => layer.id === state.activeLayerId
            ? { ...layer, pixels: layer.pixels.filter((pixel) => !removed.has(`${pixel.x},${pixel.y}`)) }
            : layer),
          updatedAt: touched(),
        };
      }),
      clearActiveLayer: () => set((state) => {
        const active = state.layers.find((layer) => layer.id === state.activeLayerId);
        if (!active || active.pixels.length === 0) return state;
        return {
          ...addHistory(state),
          layers: state.layers.map((layer) => layer.id === state.activeLayerId ? { ...layer, pixels: [] } : layer),
          updatedAt: touched(),
        };
      }),
      undo: () => set((state) => {
        const previous = state.past.at(-1);
        if (!previous) return state;
        return {
          ...previous,
          past: state.past.slice(0, -1),
          future: [snapshot(state), ...state.future].slice(0, 50),
          strokeStart: null,
          updatedAt: touched(),
        };
      }),
      redo: () => set((state) => {
        const next = state.future[0];
        if (!next) return state;
        return {
          ...next,
          past: [...state.past.slice(-49), snapshot(state)],
          future: state.future.slice(1),
          strokeStart: null,
          updatedAt: touched(),
        };
      }),
      setServerState: (serverId, serverVersion) => set({ serverId, serverVersion }),
      reset: () => set({ ...initial, layers: [firstLayer()] }),
    }),
    {
      name: "maskborn-draft-v2",
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        title: state.title,
        description: state.description,
        postType: state.postType,
        startBlank: state.startBlank,
        layers: state.layers,
        activeLayerId: state.activeLayerId,
        color: state.color,
        updatedAt: state.updatedAt,
        serverId: state.serverId,
        serverVersion: state.serverVersion,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<DraftState>;
        const layers = restoreLayers((saved as { layers?: unknown }).layers, current.layers);
        const activeLayerId = layers.some((layer) => layer.id === saved.activeLayerId)
          ? saved.activeLayerId!
          : layers[0].id;
        return { ...current, ...saved, layers, activeLayerId, past: [], future: [], strokeStart: null };
      },
    },
  ),
);
