import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import collection from "../generated/collection.json";
import { composeMaskbornSvg, type TraitSelection } from "./maskborn-renderer";

function raster(svg: string) {
  const pixels = Array.from({ length: 32 }, () => Array<string | null>(32).fill(null));
  const rect = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1" fill="(#[a-f0-9]{6})"\/>/gi;
  for (const match of svg.matchAll(rect)) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const width = Number(match[3]);
    const color = match[4]!.toLowerCase();
    for (let offset = 0; offset < width; offset += 1) pixels[y]![x + offset] = color;
  }
  return pixels;
}

describe("browser renderer", () => {
  for (const fixture of collection.fixtures) {
    it(`matches Python fixture ${fixture.id}`, () => {
      const expected = readFileSync(join(process.cwd(), "public", fixture.preview), "utf8");
      const actual = composeMaskbornSvg(fixture.traits as TraitSelection);
      expect(raster(actual)).toEqual(raster(expected));
    });
  }
});
