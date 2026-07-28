import type { Metadata } from "next";
import { CollectionBrowser } from "@/components/collection-browser";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Collection previews" };

export default function CollectionPage() {
  return (
    <>
      <PageIntro
        index="01"
        eyebrow="The collection in progress"
        title="The planned 10,000"
        copy="A pre-launch collection assembled from traits. The community is helping shape which original traits and 1/1s make the final set."
      />
      <CollectionBrowser />
    </>
  );
}
