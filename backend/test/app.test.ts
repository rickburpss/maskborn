import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

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
