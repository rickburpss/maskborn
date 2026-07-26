import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { canonicalizePixelData, createTraitPreviewVariants, sourcePixelDataSchema } from "../src/submission-art.js";

process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/maskborn";
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
process.env.NODE_ENV = "test";

let app: Awaited<typeof import("../src/app.js")>["app"];
let extractXPostId: Awaited<typeof import("../src/utils.js")>["extractXPostId"];

beforeAll(async () => {
  ({ app } = await import("../src/app.js"));
  ({ extractXPostId } = await import("../src/utils.js"));
});

describe("API shell", () => {
  it("returns health without touching the database", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "maskborn-api" });
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("uses the stable error envelope", async () => {
    const response = await request(app).get("/api/not-a-route");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("keeps public viewing open but rejects unauthenticated actions", async () => {
    const response = await request(app)
      .put("/api/submissions/example/vote")
      .send({ value: "UP" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });
});

describe("X post URLs", () => {
  it("extracts IDs from supported X and Twitter status URLs", () => {
    expect(extractXPostId("https://x.com/maskborn/status/1234567890123456789")).toBe("1234567890123456789");
    expect(extractXPostId("https://twitter.com/maskborn/status/12345?ref_src=test")).toBe("12345");
  });

  it("rejects profile, lookalike, and non-status URLs", () => {
    expect(extractXPostId("https://x.com/maskborn")).toBeNull();
    expect(extractXPostId("https://x.com.example/status/12345")).toBeNull();
    expect(extractXPostId("https://example.com/maskborn/status/12345")).toBeNull();
  });
});

describe("submission artwork canonicalization", () => {
  it("keeps visible pixels, resolves later-layer overlaps, and sorts coordinates", () => {
    const source = sourcePixelDataSchema.parse({
      schemaVersion: 2,
      startBlank: false,
      layers: [
        { id: "background-1", kind: "Background", visible: true, pixels: [{ x: 8, y: 4, color: "#f2b441" }] },
        { id: "eyes-1", kind: "Eyes", visible: true, pixels: [{ x: 4, y: 9, color: "#ffffff" }, { x: 2, y: 1, color: "#1a1815" }] },
        { id: "eyes-2", kind: "Eyes", visible: true, pixels: [{ x: 4, y: 9, color: "#d85b45" }] },
        { id: "hidden", kind: "Special", visible: false, pixels: [{ x: 0, y: 0, color: "#ffffff" }] },
      ],
    });
    const result = canonicalizePixelData(source);
    expect(result.traits).toEqual([
      { kind: "Background", stage: 0, pixels: [[8, 4, "#F2B441"]] },
      { kind: "Eyes", stage: 1, pixels: [[2, 1, "#1A1815"], [4, 9, "#D85B45"]] },
    ]);
  });

  it("builds individual, combined, and all-trait previews in generator order", () => {
    const source = sourcePixelDataSchema.parse({
      schemaVersion: 2,
      startBlank: false,
      layers: [
        { id: "background", kind: "Background", visible: true, pixels: [{ x: 1, y: 1, color: "#F2B441" }] },
        { id: "eyes", kind: "Eyes", visible: true, pixels: [{ x: 4, y: 9, color: "#1A1815" }] },
      ],
    });
    const variants = createTraitPreviewVariants(source, '<g id="maskborn-base"/>');
    expect(variants.map((variant) => variant.label)).toEqual(["Background", "Eyes", "All"]);
    const all = variants[2]!.svg;
    expect(all.indexOf('x="1"')).toBeLessThan(all.indexOf("maskborn-base"));
    expect(all.indexOf("maskborn-base")).toBeLessThan(all.indexOf('x="4"'));
  });
});
