import { ImageResponse } from "next/og";
import { getSharedSubmission } from "@/lib/server-submission";

export const alt = "Mask Born Order community artwork";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ArtworkOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artwork = await getSharedSubmission(slug);
  const creator = artwork?.user.socialAccounts[0]?.username
    ? `@${artwork.user.socialAccounts[0].username}`
    : artwork?.user.displayName ?? "Mask Born Order member";
  const type = artwork?.kind === "ONE_OF_ONE" ? "1/1" : artwork?.categories.join(" + ") ?? "Community artwork";

  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      padding: 56,
      gap: 58,
      background: "#EDEAE2",
      color: "#1A1815",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        width: 470,
        height: 470,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "4px solid #1A1815",
        background: "#F7F4ED",
        boxShadow: "14px 14px 0 #F2B441",
      }}>
        {artwork?.previewAssetUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={artwork.previewAssetUrl} width="454" height="454" alt="" style={{ objectFit: "contain" }} />
          : <div style={{ fontSize: 58 }}>MBO</div>}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 0" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 19, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
            Mask Born Order / {type}
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 72, lineHeight: 0.94, fontWeight: 900, textTransform: "uppercase" }}>
            {artwork?.title ?? "Community artwork"}
          </div>
          <div style={{ display: "flex", marginTop: 22, color: "#6D675E", fontSize: 25 }}>by {creator}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #1A1815", paddingTop: 22 }}>
          <div style={{ display: "flex", gap: 28, fontSize: 23 }}>
            <span>{artwork?.upvoteCount ?? 0} up</span>
            <span>{artwork?.downvoteCount ?? 0} down</span>
          </div>
          <div style={{ display: "flex", padding: "12px 17px", background: "#1A1815", color: "#EDEAE2", fontSize: 17, textTransform: "uppercase" }}>
            View and vote
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
