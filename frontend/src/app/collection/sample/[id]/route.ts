import { composeMaskbornSvg } from "@/lib/maskborn-renderer";
import { sampleSelection } from "@/lib/generated-samples";

export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const sampleId = Number(id);
    if (!Number.isInteger(sampleId) || sampleId < 17 || sampleId > 48) {
      return new Response("Sample not found.", { status: 404 });
    }
    return new Response(composeMaskbornSvg(sampleSelection(sampleId)), {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  });
}
