import type { Metadata } from "next";
import { ArtworkDetail } from "@/components/artwork-detail";
import { getSharedSubmission } from "@/lib/server-submission";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getSharedSubmission(slug);
  if (!artwork) return { title: "Community artwork" };
  const creator = artwork.user.socialAccounts[0]?.username
    ? `@${artwork.user.socialAccounts[0].username}`
    : artwork.user.displayName ?? "a Mask Born Order member";
  const description = `${artwork.description} Created by ${creator}. View it and vote during the community window.`;
  return {
    title: artwork.title,
    description,
    alternates: { canonical: `/art/${artwork.slug}` },
    openGraph: {
      type: "article",
      title: artwork.title,
      description,
      url: `/art/${artwork.slug}`,
      images: [{ url: `/art/${artwork.slug}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: artwork.title,
      description,
      images: [`/art/${artwork.slug}/opengraph-image`],
    },
  };
}

export default async function ArtworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArtworkDetail slug={slug} />;
}
