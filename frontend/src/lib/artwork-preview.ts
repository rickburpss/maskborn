import type { ArtworkPreviewVariant } from "@/lib/types";

export function selectLargestPreviewVariant(variants?: ArtworkPreviewVariant[]) {
  if (!variants?.length) return undefined;
  return variants.reduce((largest, variant) =>
    variant.categories.length > largest.categories.length ? variant : largest);
}

const categoryLabels: Record<string, string> = {
  BACKGROUND: "Background",
  EYES: "Eyes",
  HATS: "Hats",
  SPECIAL: "Special",
};

export function genericPreviewLabel(
  variant: Pick<ArtworkPreviewVariant, "categories">,
  artworkCategories: string[],
) {
  if (variant.categories.length > 1 && variant.categories.length === artworkCategories.length) {
    return "All traits";
  }
  return variant.categories
    .map((category) => categoryLabels[category] ?? `${category.charAt(0)}${category.slice(1).toLowerCase()}`)
    .join(" + ");
}
