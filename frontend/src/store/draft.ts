"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccessoryKind = "Background" | "Eyes" | "Hats" | "Special";
export type DraftPixel = { x: number; y: number; color: string };
export type DraftLayer = {
  id: string;
  kind: AccessoryKind;
  visible: boolean;
  pixels: DraftPixel[];
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
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setPostType: (postType: "ONE_OF_ONE" | "ACCESSORY") => void;
  setStartBlank: (startBlank: boolean) => void;
  setColor: (color: string) => void;
  setActiveLayer: (id: string) => void;
  addLayer: (kind: AccessoryKind) => void;
  removeLayer: (id: string) => void;
  toggleLayer: (id: string) => void;
  paintPixel: (x: number, y: number) => void;
  erasePixel: (x: number, y: number) => void;
  clearActiveLayer: () => void;
  setServerState: (serverId: string, serverVersion: number) => void;
  reset: () => void;
};

const firstLayer = (): DraftLayer => ({
  id: "hats-1",
  kind: "Hats",
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
};

const touched = () => new Date().toISOString();

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
      addLayer: (kind) => set((state) => {
        const id = `${kind.toLowerCase()}-${Date.now()}`;
        return {
          layers: [...state.layers, { id, kind, visible: true, pixels: [] }],
          activeLayerId: id,
          updatedAt: touched(),
        };
      }),
      removeLayer: (id) => set((state) => {
        if (state.layers.length === 1) return state;
        const layers = state.layers.filter((layer) => layer.id !== id);
        return {
          layers,
          activeLayerId: state.activeLayerId === id ? layers[0].id : state.activeLayerId,
          updatedAt: touched(),
        };
      }),
      toggleLayer: (id) => set((state) => ({
        layers: state.layers.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer),
        updatedAt: touched(),
      })),
      paintPixel: (x, y) => set((state) => ({
        layers: state.layers.map((layer) => {
          if (layer.id !== state.activeLayerId) return layer;
          return {
            ...layer,
            pixels: [...layer.pixels.filter((pixel) => pixel.x !== x || pixel.y !== y), { x, y, color: state.color }],
          };
        }),
        updatedAt: touched(),
      })),
      erasePixel: (x, y) => set((state) => ({
        layers: state.layers.map((layer) => layer.id === state.activeLayerId
          ? { ...layer, pixels: layer.pixels.filter((pixel) => pixel.x !== x || pixel.y !== y) }
          : layer),
        updatedAt: touched(),
      })),
      clearActiveLayer: () => set((state) => ({
        layers: state.layers.map((layer) => layer.id === state.activeLayerId ? { ...layer, pixels: [] } : layer),
        updatedAt: touched(),
      })),
      setServerState: (serverId, serverVersion) => set({ serverId, serverVersion }),
      reset: () => set({ ...initial, layers: [firstLayer()] }),
    }),
    { name: "maskborn-draft-v2" },
  ),
);
