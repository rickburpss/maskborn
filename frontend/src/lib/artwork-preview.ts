import type { ArtworkPreviewVariant } from "@/lib/types";

export function selectLargestPreviewVariant(variants?: ArtworkPreviewVariant[]) {
  if (!variants?.length) return undefined;
  return variants.reduce((largest, variant) =>
    variant.categories.length > largest.categories.length ? variant : largest);
}
