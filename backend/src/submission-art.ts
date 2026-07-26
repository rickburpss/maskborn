import { createHash } from "node:crypto";
import { z } from "zod";

export const communityLayerKinds = ["Background", "Eyes", "Hats", "Special"] as const;

const pixelSchema = z.object({
  x: z.number().int().min(0).max(31),
  y: z.number().int().min(0).max(31),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

const layerSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(communityLayerKinds),
  visible: z.boolean(),
  pixels: z.array(pixelSchema).max(1024),
});

export const sourcePixelDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  startBlank: z.boolean(),
  layers: z.array(layerSchema).min(1).max(64),
});

export type SourcePixelData = z.infer<typeof sourcePixelDataSchema>;

export type CanonicalTraitPixels = {
  kind: typeof communityLayerKinds[number];
  stage: number;
  pixels: Array<[number, number, string]>;
};

export function canonicalizePixelData(source: SourcePixelData) {
  const traits = communityLayerKinds.flatMap((kind, stage): CanonicalTraitPixels[] => {
    const coordinates = new Map<string, [number, number, string]>();
    for (const layer of source.layers) {
      if (!layer.visible || layer.kind !== kind) continue;
      for (const pixel of layer.pixels) {
        coordinates.set(`${pixel.x},${pixel.y}`, [pixel.x, pixel.y, pixel.color.toUpperCase()]);
      }
    }
    const pixels = [...coordinates.values()].sort((left, right) => left[1] - right[1] || left[0] - right[0]);
    return pixels.length > 0 ? [{ kind, stage, pixels }] : [];
  });
  return {
    schemaVersion: 1,
    canvas: { width: 32, height: 32 },
    startBlank: source.startBlank,
    renderOrder: communityLayerKinds,
    traits,
  };
}

export type TraitPreviewVariant = {
  id: string;
  label: string;
  categories: Array<typeof communityLayerKinds[number]>;
  svg: string;
};

export function createTraitPreviewVariants(source: SourcePixelData, baseMarkup: string): TraitPreviewVariant[] {
  const canonical = canonicalizePixelData(source);
  const present = communityLayerKinds.filter((kind) => canonical.traits.some((trait) => trait.kind === kind));
  const pixelsByKind = new Map(canonical.traits.map((trait) => [trait.kind, trait.pixels]));
  const rects = (kind: typeof communityLayerKinds[number]) => (pixelsByKind.get(kind) ?? [])
    .map(([x, y, color]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`)
    .join("");

  return Array.from({ length: (1 << present.length) - 1 }, (_, index) => index + 1).map((mask) => {
    const categories = present.filter((_, index) => (mask & (1 << index)) !== 0);
    const background = categories.includes("Background") ? rects("Background") : "";
    const foreground = categories.filter((kind) => kind !== "Background").map(rects).join("");
    const id = categories.map((kind) => kind.toLowerCase()).join("-");
    const label = categories.length === present.length && present.length > 1 ? "All" : categories.join(" + ");
    return {
      id,
      label,
      categories,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges">${background}${baseMarkup}${foreground}</svg>`,
    };
  });
}

export function jsonBuffer(value: unknown) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
