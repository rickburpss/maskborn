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
        startBlank: postType === "ACCESSORY" ? false : false,
        updatedAt: touched(),
      }),
      setStartBlank: (startBlank) => set({ startBlank, updatedAt: touched() }),
      setColor: (color) => set({ color }),
      setActiveLayer: (activeLayerId) => set({ activeLayerId }),
      renameLayer: (id, name) => set((state) => ({
        ...addHistory(state),
        layers: state.layers.map((layer) => layer.id === id ? { ...layer, name } : layer),
        updatedAt: touched(),
      })),
      addLayer: (kind) => set((state) => {
        const id = `${kind.toLowerCase()}-${Date.now()}`;
        const count = state.layers.filter((layer) => layer.kind === kind).length + 1;
        return {
          ...addHistory(state),
          layers: [...state.layers, { id, kind, name: `${singularKind(kind)} ${count}`, visible: true, pixels: [] }],
          activeLayerId: id,
          updatedAt: touched(),
        };
      }),
      removeLayer: (id) => set((state) => {
        if (state.layers.length === 1) return state;
        const layers = state.layers.filter((layer) => layer.id !== id);
        return {
          ...addHistory(state),
          layers,
          activeLayerId: state.activeLayerId === id ? layers[0].id : state.activeLayerId,
          updatedAt: touched(),
        };
      }),
      toggleLayer: (id) => set((state) => ({
        ...addHistory(state),
        layers: state.layers.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer),
        updatedAt: touched(),
      })),
      beginStroke: () => set((state) => state.strokeStart ? state : { strokeStart: snapshot(state) }),
      endStroke: () => set((state) => state.strokeStart ? {
        past: [...state.past.slice(-49), state.strokeStart],
        future: [],
        strokeStart: null,
      } : state),
      paintPixels: (coordinates) => set((state) => ({
        layers: state.layers.map((layer) => {
          if (layer.id !== state.activeLayerId) return layer;
          const next = new Map(layer.pixels.map((pixel) => [`${pixel.x},${pixel.y}`, pixel]));
          for (const { x, y } of coordinates) next.set(`${x},${y}`, { x, y, color: state.color });
          return {
            ...layer,
            pixels: [...next.values()],
          };
        }),
        updatedAt: touched(),
      })),
      erasePixels: (coordinates) => set((state) => {
        const removed = new Set(coordinates.map(({ x, y }) => `${x},${y}`));
        return {
        layers: state.layers.map((layer) => layer.id === state.activeLayerId
          ? { ...layer, pixels: layer.pixels.filter((pixel) => !removed.has(`${pixel.x},${pixel.y}`)) }
          : layer),
        updatedAt: touched(),
        };
      }),
      clearActiveLayer: () => set((state) => ({
        ...addHistory(state),
        layers: state.layers.map((layer) => layer.id === state.activeLayerId ? { ...layer, pixels: [] } : layer),
        updatedAt: touched(),
      })),
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
        const layers = (saved.layers ?? current.layers).map((layer, index) => ({
          ...layer,
          name: layer.name?.trim() || `${singularKind(layer.kind)} ${index + 1}`,
        }));
        return { ...current, ...saved, layers, past: [], future: [], strokeStart: null };
      },
    },
  ),
);
