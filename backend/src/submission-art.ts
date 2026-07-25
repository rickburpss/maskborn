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

export function jsonBuffer(value: unknown) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
