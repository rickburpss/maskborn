import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { GalleryBrowser } from "@/components/gallery-browser";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <>
      <PageIntro
        index="02"
        eyebrow="The accepted collection"
        title="Gallery"
        copy="The official record of community work selected for the 1/1 set and the general collection. Browse a whole mask or isolate the trait that made it in."
      />
      <div className="origin-banner shell">
        <span>See how the planned collection is assembled.</span>
        <Link href="/collection">Open collection previews <ArrowUpRight size={15} /></Link>
      </div>
      <GalleryBrowser />
    </>
  );
}
