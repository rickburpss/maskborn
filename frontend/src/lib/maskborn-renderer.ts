import snapshot from "../generated/renderer.json";

type SparsePixel = [number, number, string];
type TraitSelection = [number, number, number, number, number, number, number, number];

const W = snapshot.canvas.width;
const EMPTY = snapshot.empty;
const KEYLINE = snapshot.keyline;
const layerIndex = Object.fromEntries(snapshot.layerOrder.map((name, index) => [name, index]));

const makeBuffer = () => Array.from({ length: W }, () => Array<string>(W).fill(EMPTY));

function blit(buffer: string[][], pixels: SparsePixel[], xMax = W) {
  for (const [x, y, color] of pixels) {
    if (x < xMax) buffer[y][x] = color;
  }
}

function earMode(hat: number, ear: number) {
  if (
    snapshot.compatibility.noEarsHatIndices.includes(hat)
    || snapshot.compatibility.noEarsPairs.some(([hatIndex, earIndex]) => hatIndex === hat && earIndex === ear)
  ) return "none";
  if (snapshot.compatibility.leftOnlyHatIndices.includes(hat)) return "left";
  return "all";
}

function shade(buffer: string[][]) {
  for (const [row, x] of Object.entries(snapshot.formLeft)) {
    const y = Number(row);
    if (buffer[y][x] !== KEYLINE) buffer[y][x] = "D";
  }
  for (let y = 6; y < 9; y += 1) {
    for (const x of [12, 20]) {
      if (buffer[y][x] === "G") buffer[y][x] = "D";
    }
  }
}

function outline(buffer: string[][]) {
  const next = buffer.map((row) => [...row]);
  const neighbours = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (buffer[y][x] !== EMPTY) continue;
      const touchesBody = neighbours.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && nx < W && ny >= 0 && ny < W
          && buffer[ny][nx] !== EMPTY && buffer[ny][nx] !== KEYLINE;
      });
      if (touchesBody) next[y][x] = KEYLINE;
    }
  }
  return next;
}

function toSvg(colors: (string | null)[][]) {
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">'];
  for (let y = 0; y < W; y += 1) {
    let x = 0;
    while (x < W) {
      const color = colors[y][x];
      let width = 1;
      while (x + width < W && colors[y][x + width] === color) width += 1;
      if (color) parts.push(`<rect x="${x}" y="${y}" width="${width}" height="1" fill="${color}"/>`);
      x += width;
    }
  }
  parts.push("</svg>");
  return parts.join("");
}

export function composeMaskbornSvg(selection: TraitSelection) {
  const background = selection[layerIndex.Background];
  const furIndex = selection[layerIndex.Fur];
  const eyes = selection[layerIndex.Eyes];
  const ears = selection[layerIndex.Ears];
  const tails = selection[layerIndex.Tails];
  const masks = selection[layerIndex.Masks];
  const hats = selection[layerIndex.Hats];
  const special = selection[layerIndex.Special];
  const layers = snapshot.layers;
  const buffer = makeBuffer();

  blit(buffer, layers.Tails[tails] as SparsePixel[]);
  blit(buffer, snapshot.base as SparsePixel[]);
  const mode = earMode(hats, ears);
  if (mode !== "none") blit(buffer, layers.Ears[ears] as SparsePixel[], mode === "left" ? 17 : W);
  shade(buffer);
  blit(buffer, layers.Masks[masks] as SparsePixel[]);
  blit(buffer, snapshot.defaultEyes as SparsePixel[]);

  const fur = layers.Fur[furIndex];
  blit(buffer, fur.pattern as SparsePixel[]);
  blit(buffer, layers.Eyes[eyes] as SparsePixel[]);

  const outlined = outline(buffer);
  blit(outlined, fur.glow as SparsePixel[]);
  blit(outlined, layers.Hats[hats] as SparsePixel[]);
  blit(outlined, layers.Special[special] as SparsePixel[]);

  const shifted = makeBuffer();
  for (let y = 0; y + snapshot.canvas.yShift < W; y += 1) {
    shifted[y + snapshot.canvas.yShift] = [...outlined[y]];
  }

  const furPalette = fur.palette as Record<string, string>;
  const palette = snapshot.palette as Record<string, string>;
  const backgroundGrid = layers.Background[background] as string[][];
  const colors = shifted.map((row, y) => row.map((cell, x) => {
    const key = cell === EMPTY ? backgroundGrid[y][x] : cell;
    return furPalette[key] ?? palette[key] ?? null;
  }));
  return toSvg(colors);
}

export function composeMaskbornDataUrl(selection: TraitSelection) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(composeMaskbornSvg(selection))}`;
}

export type { TraitSelection };
