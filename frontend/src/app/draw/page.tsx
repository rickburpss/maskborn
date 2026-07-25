import type { Metadata } from "next";
import { DrawStudio } from "@/components/draw-studio";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Draw" };

export default function DrawPage() {
  return (
    <>
      <PageIntro
        index="05"
        eyebrow="The pixel studio"
        title="Draw your Maskborn"
        copy="Start from the body, break it apart, or make a trait that works across the collection. Your current draft stays in this browser while you work."
      />
      <DrawStudio />
    </>
  );
}
