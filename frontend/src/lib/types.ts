export type ArtType = "1/1" | "Background" | "Fur" | "Eyes" | "Ears" | "Tails" | "Masks" | "Hats" | "Special";
export type GalleryStatus = "In review" | "Added to gallery" | "Community";
export type VoteValue = "up" | "down" | null;
export type ArtworkPreviewVariant = {
  id: string;
  label: string;
  categories: string[];
  url: string;
};

export type Artwork = {
  id: string;
  slug: string;
  title: string;
  creator: string;
  twitterUrl?: string;
  type: ArtType;
  status: GalleryStatus;
  variant: number;
  upvotes: number;
  downvotes: number;
  submittedAt: string;
  description: string;
  previewAssetUrl?: string;
  previewVariants?: ArtworkPreviewVariant[];
};
