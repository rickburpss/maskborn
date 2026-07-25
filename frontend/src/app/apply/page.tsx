import type { Metadata } from "next";
import { ApplicationForm } from "@/components/application-form";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Apply" };

export default function ApplyPage() {
  return (
    <>
      <PageIntro
        index="03"
        eyebrow="Join the collection"
        title="Apply to the order"
        copy="Complete the campaign actions, assemble a Maskborn from available traits, quote-post the result, and send us the link with your wallet."
      />
      <ApplicationForm />
    </>
  );
}
