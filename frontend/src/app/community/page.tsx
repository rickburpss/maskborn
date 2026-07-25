import type { Metadata } from "next";
import { LatestCreations } from "@/components/latest-creations";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Community gallery" };

export default function CommunityPage() {
  return (
    <>
      <PageIntro
        index="04"
        eyebrow="Unfiltered work"
        title="Community gallery"
        copy="Everything the community has published lives here while the vote is open and after it closes. Accepted work moves into the collection gallery without disappearing from its history."
      />
      <LatestCreations />
    </>
  );
}
