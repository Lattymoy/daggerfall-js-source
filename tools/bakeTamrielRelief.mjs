// THE RELIEF OF TAMRIEL, baked from the owner's heightmap into the module the trace loads (its own chunk).
//
//     ARENA2_PATH=/home/claude/dfdata/arena2 node tools/bakeTamrielRelief.mjs
//
// TAMRIEL-RELIEF (2026-10-24, the owner, with a heightmap of the whole continent: "Heres the entire tamriel height map
// btw", then "This is the heightmap. Use it"). The picture is committed as supplied - a phone's screenshot, its map
// cropped - under src/assets/tamriel/source/ (test/tooling/doctrine.test.js row), and this bake turns it into
// src/world/tamriel/tamrielReliefData.js: a height a cell, two cells a picture unit, over the picture of Daggerfall's
// own map the land past the Bay is traced from (ui/tamrielTrace.js - TMAP00I0 and TAMRIEL2, the player's files).
//
// THE COAST STAYS THE TRACE'S. The heightmap is drawn on the lore's map, not on Daggerfall's: its coasts are near the
// trace's but not on them, and its Morrowind has an Inner Sea round Vvardenfell where the picker's is land. So the
// heightmap is laid ON the trace, never the other way:
//   1. its land - a pixel LAND_LEVEL bright or brighter, the specks under SPECK_PX (the jpeg's halos) dropped;
//   2. the best scale and offset a side (`fitAffine`: the trace's picture is 320 x 200 drawn for a 4:3 screen, so its
//      units are not square) - the land the two agree on over the land either holds, climbed from the boxes' fit;
//   3. a smooth warp on top (`warpDemons`, Thirion's demons on the two lands' signed distances, the field smoothed by
//      WARP.sigma and no step past WARP.max), so a coast the heightmap draws a few units off the trace's comes onto it
//      and the ranges inland come with it;
//   4. sampled at EVERY cell of the grid, the sea's too, the heightmap blurred by BLUR first (its pixels are a third of a
//      unit) - AUDIT TESA II G1: the module never carries the trace's land (a raster of TAMRIEL2.IMG and TMAP00I0.IMG is
//      game data and never ships - Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA): the trace's mask is laid on the
//      player's machine (world/tamriel/tamrielRelief.js loadRelief, maskRelief), and the cells it leaves are the ones the
//      module once carried, to the byte. The warp pulls the heightmap toward the trace's coasts (smoothed over WARP.sigma,
//      never past WARP.max): its sea's edge is the heightmap's own, moved - the owner's call, Tamriel.md TAMRIEL-RELIEF; and
//   5. its brightness made WOODS' bytes by the Bay's own (`calibrate`): the heightmap and WOODS.WLD both draw the Bay,
//      so the brightness at a Bay land pixel's place and that pixel's byte are paired, and a brightness takes the byte
//      at the same rank among them up to TOP_RANK - past it a line to CEILING_BYTE at full brightness (Skyrim's spine
//      and the Jerall stand brighter than anything on the Bay). The two agree on the Bay's ranks, not its hills: the
//      heightmap is the lore's, and its hills are not WOODS' (the pairs correlate at 0.25).
//
// The module is the cells run-length coded (a 0, a count and a byte is a run of that byte) in base64, with the numbers
// that made it. Nothing imports it statically: world/tamriel/tamrielRelief.js loadRelief
// imports it when the trace is made (ui/tamrielTrace.js), so it is a chunk of its own, never the boot chunk's or a
// worker's - the workers are handed the cells with the trace. test/world/tamrielrelief.test.js re-runs the bake where
// ARENA2_PATH names the data and holds the module to it byte for byte.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { RELIEF_SCALE } from '../src/world/tamriel/tamrielRelief.js'; // AUDIT TESA II G8: the grid's one home (the runtime's)
import { fitBayToPicture } from '../src/world/tamriel/tamrielLand.js'; // AUDIT TESA II G8: the Bay's fit as the world host makes it
import { isWaterPixel } from '../src/ui/overworldModel.js'; // ... over the port's one water law

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // AUDIT 68: a path, never read off a URL string
export const SOURCE = 'src/assets/tamriel/source/tamriel-heightmap.png';
export const OUT = 'src/world/tamriel/tamrielReliefData.js';
/** A heightmap pixel this bright or brighter is land; land pieces under SPECK_PX pixels are the jpeg's, not islands. */
export const LAND_LEVEL = 12;
export const SPECK_PX = 30;
/** The heightmap's blur before it is sampled (its own pixels). */
export const BLUR = 1.0;
/** The warp: its field's smoothing (picture units), its steps, its largest move (picture units). */
export const WARP = Object.freeze({ sigma: 3, steps: 80, max: 8 });
/** The highest byte the relief stands (WOODS' units), at the heightmap's full brightness - about 1.6 times the Bay's
 *  highest common ground (its 99th rank, 85): Skyrim's spine, the Jerall and Red Mountain over the Wrothgarians. */
export const CEILING_BYTE = 180;
/** The rank among the Bay's pairs the curve follows the Bay's own bytes to; past it a line to CEILING_BYTE (the Bay's
 *  last hundredth is a few peaks, too few to rank the continent's brightest by). */
export const TOP_RANK = 0.99;
/** THE BAY'S FIT ON THE TRACE, as the world host makes it (scenes/world.js: fitBayToPicture over the one water law) - in
 *  Bay pixels, setTamrielFit's shape (AUDIT TESA II G8: it was a copy of the freeware's numbers). @param {{ trace: any,
 *  woods: any, maps: any }} o */
export function bakeFit({ trace, woods, maps }) {
  const fit = fitBayToPicture({
    bayLand: (x, y) => !isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)),
    trace,
  });
  if (!fit) throw new Error('the Bay does not fit the trace');
  return { ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu };
}

/** The heightmap's brightness (0..255) a pixel, from the PNG. */
export function readHeightmap(bytes) {
  const p = readPng(bytes);
  const g = new Float32Array(p.width * p.height);
  for (let i = 0; i < g.length; i++) g[i] = (p.data[i * 4] + p.data[i * 4 + 1] + p.data[i * 4 + 2]) / 3;
  return { w: p.width, h: p.height, g };
}

/** A Gaussian blur, separable, edges clamped. */
export function blur(src, w, h, sigma) {
  if (!(sigma > 0)) return Float32Array.from(src);
  const r = Math.ceil(sigma * 3),
    k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(w * h),
    out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += k[i + r] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
      tmp[y * w + x] = a;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
      out[y * w + x] = a;
    }
  return out;
}

/** Bilinear read of a w x h field at (x, y) in its pixel units (a pixel's centre at +0.5); `out` past the edge. */
export function bilinear(f, w, h, x, y, out = 0) {
  const fx = x - 0.5,
    fy = y - 0.5;
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy);
  if (x0 < -1 || y0 < -1 || x0 > w - 1 || y0 > h - 1) return out;
  const tx = fx - x0,
    ty = fy - y0;
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? out : f[yy * w + xx]);
  return (
    (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
    (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
  );
}

/** The heightmap's land: LAND_LEVEL and brighter, its 4-connected pieces under SPECK_PX dropped. */
export function landOf(g, w, h) {
  const land = new Uint8Array(w * h);
  for (let i = 0; i < land.length; i++) land[i] = g[i] >= LAND_LEVEL ? 1 : 0;
  const seen = new Uint8Array(w * h),
    stack = [];
  for (let s = 0; s < land.length; s++) {
    if (!land[s] || seen[s]) continue;
    const piece = [];
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      piece.push(i);
      const x = i % w,
        y = (i - x) / w;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (land[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (piece.length < SPECK_PX) for (const i of piece) land[i] = 0;
  }
  return land;
}

/** Felzenszwalb's squared distance, one line. */
function edt1(f, n) {
  const d = new Float64Array(n),
    v = new Int32Array(n),
    z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
}
/** The distance (pixels) from each pixel to the nearest pixel where `mask` is set. */
export function distanceTo(mask, w, h) {
  const BIG = 1e12,
    g = new Float64Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = mask[i] ? 0 : BIG;
  const col = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = g[y * w + x];
    const d = edt1(col, h);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  const row = new Float64Array(w),
    out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = g[y * w + x];
    const d = edt1(row, w);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}
/** A land's signed distance: + inland (to the sea), - at sea (to the land). */
export function signedDistance(land, w, h) {
  const sea = Uint8Array.from(land, (v) => (v ? 0 : 1));
  const toSea = distanceTo(sea, w, h),
    toLand = distanceTo(land, w, h);
  return Float32Array.from(toSea, (v, i) => (land[i] ? v - 0.5 : 0.5 - toLand[i]));
}

/** The heightmap's land read on the trace's grid through a scale and offset a side (a: x scale, b: x offset, c, d). */
function landOnTrace(hLand, hw, hh, tw, th, A) {
  const out = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++)
      out[y * tw + x] = bilinear(hLand, hw, hh, A.a * (x + 0.5) + A.b, A.c * (y + 0.5) + A.d) > 0.5 ? 1 : 0;
  return out;
}
const iou = (p, q) => {
  let i = 0,
    u = 0;
  for (let k = 0; k < p.length; k++) {
    i += p[k] & q[k];
    u += p[k] | q[k];
  }
  return i / u;
};

/** THE BEST SCALE AND OFFSET A SIDE: the trace's land against the heightmap's, the boxes' fit climbed. */
export function fitAffine(hLand, hw, hh, tLand, tw, th) {
  const box = (m, w, h) => {
    let x0 = w,
      y0 = h,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (m[y * w + x]) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    return { x0, y0, x1, y1 };
  };
  const hb = box(hLand, hw, hh),
    tb = box(tLand, tw, th);
  const a = (hb.x1 - hb.x0) / (tb.x1 - tb.x0),
    c = (hb.y1 - hb.y0) / (tb.y1 - tb.y0);
  let best = { a, b: hb.x0 - a * tb.x0, c, d: hb.y0 - c * tb.y0 };
  let score = iou(landOnTrace(hLand, hw, hh, tw, th, best), tLand);
  for (const step of [0.08, 0.04, 0.02, 0.01]) {
    for (let moved = true; moved;) {
      moved = false;
      const base = best;
      for (const da of [-step, 0, step])
        for (const dc of [-step, 0, step])
          for (const db of [-step * 100, 0, step * 100])
            for (const dd of [-step * 100, 0, step * 100]) {
              const A = { a: base.a + da, b: base.b + db, c: base.c + dc, d: base.d + dd };
              const s = iou(landOnTrace(hLand, hw, hh, tw, th, A), tLand);
              if (s > score + 1e-9) {
                score = s;
                best = A;
                moved = true;
              }
            }
    }
  }
  return { ...best, iou: score };
}

/** THE WARP: a smooth field u (trace pixels) so the moving land's signed distance read at x + u(x) is the fixed one's at
 *  x - Thirion's demons, the field smoothed by `sigma` each step and held within `max`. */
export function warpDemons(fixed, moving, w, h, { sigma, steps, max }) {
  const ux = new Float32Array(w * h),
    uy = new Float32Array(w * h);
  for (let it = 0; it < steps; it++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x,
          px = x + 0.5 + ux[i],
          py = y + 0.5 + uy[i];
        const m = bilinear(moving, w, h, px, py, -20);
        const gx = (bilinear(moving, w, h, px + 1, py, -20) - bilinear(moving, w, h, px - 1, py, -20)) / 2;
        const gy = (bilinear(moving, w, h, px, py + 1, -20) - bilinear(moving, w, h, px, py - 1, -20)) / 2;
        const diff = fixed[i] - m,
          den = gx * gx + gy * gy + diff * diff;
        if (den > 1e-6) {
          ux[i] += (diff * gx) / den;
          uy[i] += (diff * gy) / den;
        }
      }
    const sx = blur(ux, w, h, sigma),
      sy = blur(uy, w, h, sigma);
    for (let i = 0; i < ux.length; i++) {
      const n = Math.hypot(sx[i], sy[i]),
        k = n > max ? max / n : 1;
      ux[i] = sx[i] * k;
      uy[i] = sy[i] * k;
    }
  }
  return { ux, uy };
}

/** The heightmap's brightness at a picture point (units), through the warp and the scale and offset. */
export function brightnessAt(H, A, warp, tw, th, px, py) {
  const qx = px + bilinear(warp.ux, tw, th, px, py),
    qy = py + bilinear(warp.uy, tw, th, px, py);
  return bilinear(H.g, H.w, H.h, A.a * qx + A.b, A.c * qy + A.d);
}

/** THE BYTES: a brightness's byte by its rank among the Bay's pairs up to the Bay's TOP_RANK brightness, then a line
 *  from there to CEILING_BYTE at full brightness. `pairs` [brightness, byte] a Bay land pixel. Returns a curve, a byte
 *  for each brightness 0..255. */
export function calibrate(pairs) {
  const gs = pairs.map((p) => p[0]).sort((x, y) => x - y),
    bs = pairs.map((p) => p[1]).sort((x, y) => x - y);
  const n = gs.length,
    curve = new Uint8Array(256);
  const rank = (g) => {
    let lo = 0,
      hi = n;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (gs[m] < g) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  const k = Math.floor(n * TOP_RANK),
    gTop = gs[k],
    bTop = bs[k];
  for (let g = 0; g < 256; g++) {
    const b = g <= gTop ? bs[Math.min(n - 1, rank(g))] : bTop + ((g - gTop) * (CEILING_BYTE - bTop)) / (255 - gTop);
    curve[g] = Math.max(0, Math.min(CEILING_BYTE, Math.round(b)));
  }
  for (let g = 1; g < 256; g++) curve[g] = Math.max(curve[g], curve[g - 1]); // never falling
  return curve;
}

/** The cells run-length coded (world/tamriel/tamrielRelief.js decodeRelief): a run of RUN_MIN or more of one byte is a 0, its
 *  count (1..255) and the byte; every other byte (1..255) is a cell. A cell is never 0. */
export const RUN_MIN = 4;
export function encodeCells(cells) {
  const out = [];
  for (let i = 0; i < cells.length;) {
    if (!(cells[i] > 0)) throw new Error(`a cell of 0 at ${i}`);
    let r = 1;
    while (i + r < cells.length && cells[i + r] === cells[i] && r < 255) r++;
    if (r >= RUN_MIN) {
      out.push(0, r, cells[i]);
      i += r;
    } else out.push(cells[i++]);
  }
  return Buffer.from(out).toString('base64');
}

/** THE BAKE: the module's numbers and cells from the heightmap, the trace and WOODS.WLD. */
export async function bakeRelief({ heightmapBytes, trace, woods, bayToPicture }) {
  const H0 = readHeightmap(heightmapBytes);
  const hLand = landOf(H0.g, H0.w, H0.h);
  const H = { ...H0, g: blur(H0.g, H0.w, H0.h, BLUR) };
  const tw = trace.w,
    th = trace.h,
    tLand = Uint8Array.from(trace.land, (v) => (v ? 1 : 0));
  const A = fitAffine(hLand, H0.w, H0.h, tLand, tw, th);
  const moving = signedDistance(landOnTrace(hLand, H0.w, H0.h, tw, th, A), tw, th),
    fixed = signedDistance(tLand, tw, th);
  const warp = warpDemons(fixed, moving, tw, th, WARP);
  const warped = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const i = y * tw + x;
      warped[i] = bilinear(moving, tw, th, x + 0.5 + warp.ux[i], y + 0.5 + warp.uy[i], -20) > 0 ? 1 : 0;
    }
  const iouWarp = iou(warped, tLand);
  const pairs = [];
  for (let y = 0; y < 500; y++)
    for (let x = 0; x < 1000; x++) {
      const byte = woods.getHeightMapValue(x, y);
      if (byte <= 3) continue; // the sea's bytes (WOODS' water law)
      const [px, py] = bayToPicture(x + 0.5, y + 0.5);
      if (!tLand[Math.floor(py) * tw + Math.floor(px)]) continue;
      pairs.push([brightnessAt(H, A, warp, tw, th, px, py), byte]);
    }
  const curve = calibrate(pairs);
  const S = RELIEF_SCALE,
    w = tw * S,
    h = th * S,
    cells = new Uint8Array(w * h);
  // AUDIT TESA II G1: every cell - the trace's mask is the player's machine's. A cell is never 0: the curve's least is a Bay
  // land pixel's byte (over 3, the pairs above), and encodeCells refuses a 0
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = (i + 0.5) / S,
        py = (j + 0.5) / S;
      cells[j * w + i] = curve[Math.max(0, Math.min(255, Math.round(brightnessAt(H, A, warp, tw, th, px, py))))];
    }
  let warpMax = 0;
  for (let k = 0; k < warp.ux.length; k++) warpMax = Math.max(warpMax, Math.hypot(warp.ux[k], warp.uy[k]));
  return {
    w,
    h,
    scale: S,
    cells,
    curve,
    fit: { a: A.a, b: A.b, c: A.c, d: A.d },
    iouFit: A.iou,
    iouWarp,
    warpMax,
    pairs: pairs.length,
  };
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The module's text. */
export function moduleText(r) {
  return `// @ts-check
// GENERATED by tools/bakeTamrielRelief.mjs from ${SOURCE} (the owner's heightmap of Tamriel), laid on the trace of
// Daggerfall's own map - do not edit; re-run the bake. world/tamriel/tamrielRelief.js reads it, and lays the player's own
// trace's coast on it (a height for every cell here, the sea's too: nothing of the trace ships - AUDIT TESA II G1).
//
// The heightmap laid on the trace: x = ${r4(r.fit.a)} * u + ${r4(r.fit.b)}, y = ${r4(r.fit.c)} * v + ${r4(r.fit.d)} (the land
// agreeing ${r4(r.iouFit)} of the land either holds), then warped (at most ${r4(r.warpMax)} units; ${r4(r.iouWarp)} agreeing);
// its brightness made WOODS' bytes by the Bay's ${r.pairs} land pixels.
export const RELIEF_DATA = Object.freeze({
  w: ${r.w},
  h: ${r.h},
  scale: ${r.scale},
  curve: '${Buffer.from(r.curve).toString('base64')}',
  cells: '${encodeCells(r.cells)}',
});
`;
}

if (isMain(import.meta.url)) {
  const A2 = process.env.ARENA2_PATH;
  if (!A2 || !existsSync(join(A2, 'TAMRIEL2.IMG'))) {
    console.error('ARENA2_PATH must name the data (sh tools/fetch-data.sh)');
    process.exit(1);
  }
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(A2, n)));
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { setTamrielFit, bayToPicture } = await import('../src/world/tamriel/tamrielFrame.js');
  const pal = new DFPalette();
  pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes, palette: pal, relief: false, niben: false }); // AUDIT TESA II G2: never its own output; NIBEN-SEA: the painting's own coasts (the player's trace masks the river)
  const woods = new WoodsFile();
  woods.load(await fetchBytes('WOODS.WLD'));
  const maps = new MapsFile();
  maps.load(await fetchBytes('MAPS.BSA'), await fetchBytes('CLIMATE.PAK'), await fetchBytes('POLITIC.PAK'));
  setTamrielFit(bakeFit({ trace, woods, maps }));
  const r = await bakeRelief({ heightmapBytes: readFileSync(join(ROOT, SOURCE)), trace, woods, bayToPicture });
  writeFileSync(join(ROOT, OUT), moduleText(r));
  console.log(
    `relief ${r.w} x ${r.h}: fit ${r4(r.iouFit)}, warped ${r4(r.iouWarp)} (at most ${r4(r.warpMax)} units), ${r.pairs} Bay pairs; curve ${Array.from(r.curve.filter((_, g) => g % 32 === 0)).join(' ')}`,
  );
}
