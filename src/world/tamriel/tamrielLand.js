// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL3 (2026-10-08, bible/03-World/Tamriel.md) - THE LAND, FROM THE PLAYER'S OWN PICTURE.
//
// Mac: "Can we fix the map? It doesnt look like the map thats in daggerfall." It did not: TAMRIEL1's geography was
// drawn from memory of the lore map. Daggerfall carries its own map of Tamriel - TMAP00I0.IMG, the race screen's
// picture, and TAMRIEL2.IMG, its picker, whose palette index IS the province - and the port already traces the
// picker at runtime for the chargen's province map (ui/provinceMap.js). So the continent is TRACED from the player's
// own two files when the world boots (ui/tamrielTrace.js), and this module holds what the trace found: a land mask
// and a province mask on the picture's 320 x 200 grid, a distance-to-sea field over the land, and the FIT - where the
// Bay's own 1000 x 500 stands on that picture, found by laying the Bay's land (WOODS.WLD and CLIMATE.PAK's one water
// law) over the picture's and searching the offset and the scale that agree best.
//
// Everything that read the authored geography reads THIS module now - the ink (ui/tamrielInk.js), the ground beyond
// the Bay (world/tamriel/tamrielGround.js, on the main thread and in the terrain worker, which is handed the same arrays),
// the raster - and falls back to the authored shape where no trace is set (node, the pins, a data-free probe,
// `?tamrieltrace=off`). PURE: typed arrays in, answers out; the two IMG files are read by the ui module, never here.
// ═══════════════════════════════════════════════════════════════════
import { provinceAt, coastDistance } from './tamrielGeography.js';
import { BAY_W, BAY_H, PICTURE_W, PICTURE_H, bayToPicture, inBay } from './tamrielFrame.js';

/** The picker's palette index is the race id (CreateCharRaceSelect.cs:30-31,64; systems/races.js RACE_TEMPLATES) and
 *  the race names the province; 9 is the Imperial Province, the picker's inert ninth (ui/provinceMap.js
 *  INERT_REGION), which the trace finds as the inland remainder. */
export const PROVINCE_OF_ID = Object.freeze({
  1: 'HighRock', 2: 'Hammerfell', 3: 'Skyrim', 4: 'Morrowind', 5: 'Sumurset', 6: 'Valenwood', 7: 'Elsweyr', 8: 'BlackMarsh', 9: 'Imperial',
});
export const IMPERIAL_ID = 9;

/** @typedef {{ w: number, h: number, land: Uint8Array, province: Uint8Array, dist?: Float32Array, relief?: Uint8Array|null }} TamrielTrace - `relief` the owner's heightmap's cells (TAMRIEL-RELIEF, world/tamriel/tamrielRelief.js) */

/** @type {TamrielTrace|null} */
let _trace = null;
let _version = 0;

/** The chamfer distance (3-4, over 3) from every land pixel to the nearest sea, picture units; 0 at sea. */
export function seaDistanceField(land, w, h) {
  const BIG = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = land[i] ? BIG : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let b = d[i];
      if (x > 0) b = Math.min(b, d[i - 1] + 3);
      if (y > 0) { b = Math.min(b, d[i - w] + 3); if (x > 0) b = Math.min(b, d[i - w - 1] + 4); if (x < w - 1) b = Math.min(b, d[i - w + 1] + 4); }
      d[i] = b;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let b = d[i];
      if (x < w - 1) b = Math.min(b, d[i + 1] + 3);
      if (y < h - 1) { b = Math.min(b, d[i + w] + 3); if (x < w - 1) b = Math.min(b, d[i + w + 1] + 4); if (x > 0) b = Math.min(b, d[i + w - 1] + 4); }
      d[i] = b;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i] >= BIG ? 0 : d[i] / 3;
  return d;
}

/** Install a trace (or null: the authored shape again). Keeps its own distance field. */
export function setTamrielTrace(trace) {
  if (!trace || !trace.land || !trace.province || trace.w * trace.h !== trace.land.length) { _trace = null; _version++; for (const fn of _heard) fn(null); return; }
  _trace = { w: trace.w, h: trace.h, land: trace.land, province: trace.province, dist: trace.dist ?? seaDistanceField(trace.land, trace.w, trace.h), relief: trace.relief ?? null };   // TAMRIEL-RELIEF: the heightmap's cells ride on the trace (world/tamriel/tamrielRelief.js)
  _version++;
  for (const fn of _heard) fn(_trace);
}
/** AUDIT RELEASE R4-7: who hears a trace land (or go) - the held map's idle job (ui/tamrielInk.js startTracedJob). */
const _heard = new Set();
/** @param {(trace: any) => void} fn @returns {() => boolean} its removal */
export function onTamrielTrace(fn) { _heard.add(fn); return () => _heard.delete(fn); }
export const tamrielTrace = () => _trace;
/** Moves on every install - the ink and the ground's cache key on it. */
export const tamrielLandVersion = () => _version;

/** The province key under a picture-grid point - the trace's where one is set (SMOOTH-LAND: its smooth law, landLabelAt),
 *  the authored rings' else; null at sea. */
export function provinceKeyAt(px, py) {
  if (_trace) {
    const l = landLabelAt(landLaw(_trace), px, py);
    return PROVINCE_OF_ID[/** @type {1} */ (l)] ?? null;
  }
  return provinceAt(px, py)?.key ?? null;
}

// ── SMOOTH-LAND (2026-10-26, bible/03-World/Tamriel.md SMOOTH-LAND; the owner, asked whether to smooth the coasts and the
// borders: "Whatever is most detailed") ─────────────────────────────────────────────────────────────────────────────
/**
 * THE LAND'S LAW, SMOOTH. The trace is the picture's 320 x 200 grid, a pixel of it fifteen and more of the map's: read a
 * pixel at a time, every coast and every border past the Bay was a staircase of 12.7 km steps - on the ground, on the
 * maps, in the zone's line. Now the land and each province is a mask of the picture's pixel centres, and its OUTLINE is
 * the mask's own contour made smooth:
 *   - the marching squares' contour over the centres (an edge between a centre of the mask and one off it crossed at its
 *     middle, a saddle's two of the mask kept apart - the trace's land is 4-connected, and a strait on the diagonal so
 *     stays open): a staircase's diagonal one straight line, a corner cut;
 *   - linked into its rings and cut at its corners by Chaikin's rule `passes` times (each pass a quarter of every
 *     segment) - a curve through the middle of every edge it crossed;
 *   - and stood as a SIGNED DISTANCE on the centres within `reach` of it (+ on the mask's side), held to `clamp`, read
 *     between the centres by Catmull-Rom's cubic (a saddle's two centres off the mask held at the clamp, so the cubic
 *     never joins the two across it) - so every picture centre keeps its own side, a square of four centres all one
 *     label is that label whole, and the line between two labels is the smooth outline, its slope continuous from one
 *     square to the next.
 * A point is LAND where the land's distance stands over 0; its PROVINCE the one whose own distance stands highest there,
 * of those its four centres hold - the border between two the line where theirs are equal. Every reader of the land asks
 * this (provinceKeyAt, provinceKeyBeyondBay, theatreAt, the ground's bytes, the places, the ports, the lanes, the zone),
 * and every line the maps draw is its edges (world/tamriel/tamrielLines.js).
 */
export const SMOOTH_LAND = Object.freeze({ reach: 2, clamp: 1, passes: 3 });
/** The padding round the picture (sea), pixels - the reach and a square at the edge. */
const PAD = SMOOTH_LAND.reach + 2;
/** A square of more than one label. */
const MIXED = 255;
/** AUDIT RELEASE R4-7: the law's fields are made a tile of LAW_TILE x LAW_TILE centres at a time, as reads first need
 *  them - so the law's build is its labels alone, and no one read makes more than four tiles of a field. */
export const LAW_TILE = 16;
/** The label of the trace's land that names no province (a picture made by hand without them): land to the coast's law,
 *  the picture's sea to none, no province's - provinceKeyAt's null, as it always was. */
export const NO_PROVINCE = 10;
/** @type {WeakMap<object, any>} */
const _laws = new WeakMap();

/** A contour's rings, smoothed: the marching squares' segments over a padded mask (`m`, W wide), linked at their shared
 *  ends into closed rings (the padding's sea closes every one), each cut `passes` times. Rings as flat [x, y, ...] arrays
 *  in padded centre units, the first point not repeated. @param {Uint8Array} m */
function smoothRings(m, W, H, passes) {
  /** @type {Map<number, number[]>} each end (a doubled coordinate's key): the segments that touch it */
  const at = new Map();
  /** @type {number[]} */
  const segs = [];
  const key = (/** @type {number} */ x2, /** @type {number} */ y2) => x2 * 8192 + y2;
  const add = (/** @type {number} */ ax2, /** @type {number} */ ay2, /** @type {number} */ bx2, /** @type {number} */ by2) => {
    const n = segs.length / 4;
    segs.push(ax2, ay2, bx2, by2);
    for (const k of [key(ax2, ay2), key(bx2, by2)]) { const l = at.get(k); if (l) l.push(n); else at.set(k, [n]); }
  };
  for (let y = 0; y + 1 < H; y++) {
    for (let x = 0; x + 1 < W; x++) {
      const a = m[y * W + x], b = m[y * W + x + 1], c = m[(y + 1) * W + x + 1], d = m[(y + 1) * W + x];
      const k = a * 8 + b * 4 + c * 2 + d;
      if (k === 0 || k === 15) continue;
      // the edges' middles, doubled: top, right, bottom, left
      const T = [2 * x + 1, 2 * y], R = [2 * x + 2, 2 * y + 1], B = [2 * x + 1, 2 * y + 2], Lf = [2 * x, 2 * y + 1];
      const seg = (/** @type {number[]} */ p, /** @type {number[]} */ q) => add(p[0], p[1], q[0], q[1]);
      switch (k) {
        case 1: case 14: seg(Lf, B); break;
        case 2: case 13: seg(B, R); break;
        case 3: case 12: seg(Lf, R); break;
        case 4: case 11: seg(T, R); break;
        case 6: case 9: seg(T, B); break;
        case 7: case 8: seg(T, Lf); break;
        case 5: seg(T, R); seg(Lf, B); break;   // b and d of the mask, apart
        case 10: seg(T, Lf); seg(B, R); break;   // a and c of the mask, apart
        default: break;
      }
    }
  }
  const used = new Uint8Array(segs.length / 4), rings = [];
  for (let s0 = 0; s0 < used.length; s0++) {
    if (used[s0]) continue;
    const ring = [];
    let cur = s0, endX = segs[4 * s0], endY = segs[4 * s0 + 1];
    while (cur >= 0 && !used[cur]) {
      used[cur] = 1;
      ring.push(endX / 2, endY / 2);
      const ax = segs[4 * cur], ay = segs[4 * cur + 1], bx = segs[4 * cur + 2], by = segs[4 * cur + 3];
      if (ax === endX && ay === endY) { endX = bx; endY = by; } else { endX = ax; endY = ay; }
      const list = /** @type {number[]} */ (at.get(key(endX, endY)));
      cur = list[0] === cur ? (list[1] ?? -1) : list[0];
    }
    let pts = ring;
    for (let n = 0; n < passes && pts.length >= 6; n++) {
      const out = [], len = pts.length / 2;
      for (let q = 0; q < len; q++) {
        const ax = pts[2 * q], ay = pts[2 * q + 1], bx = pts[(2 * q + 2) % pts.length], by = pts[(2 * q + 3) % pts.length];
        out.push(ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25, ax + (bx - ax) * 0.75, ay + (by - ay) * 0.75);
      }
      pts = out;
    }
    rings.push(pts);
  }
  return rings;
}

/**
 * THE LAW OF A TRACE, made once a trace: each padded pixel's label (0 the sea, else its province's id), the land's
 * distance `S`, each province's own (`T[id]`), and each square's label (MIXED where its four centres differ). AUDIT
 * RELEASE R4-7: the distances are made a tile at a time as reads first need them (`field`, `at`) - the build is the
 * labels alone (some 20-80 ms on the freeware's picture, where it was 0.15-1.6 s), `materialize` makes it whole and
 * `tilesMade` counts.
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace
 */
export function landLaw(trace) {
  let L = _laws.get(trace);
  if (L) return L;
  const { w, h, land, province } = trace, W = w + 2 * PAD, H = h + 2 * PAD, R = SMOOTH_LAND.reach, C = SMOOTH_LAND.clamp;
  const label = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (land[i]) label[(y + PAD) * W + x + PAD] = PROVINCE_OF_ID[/** @type {1} */ (province?.[i])] ? province[i] : NO_PROVINCE;
    }
  }
  // the centres within the reach of a square of mixed labels - the only ones an outline can come within the clamp of
  const near = new Uint8Array(W * H);
  for (let y = 0; y + 1 < H; y++) {
    for (let x = 0; x + 1 < W; x++) {
      const l = label[y * W + x];
      if (label[y * W + x + 1] === l && label[(y + 1) * W + x] === l && label[(y + 1) * W + x + 1] === l) continue;
      for (let qy = Math.max(0, y - R); qy <= Math.min(H - 1, y + 1 + R); qy++) for (let qx = Math.max(0, x - R); qx <= Math.min(W - 1, x + 1 + R); qx++) near[qy * W + qx] = 1;
    }
  }
  /**
   * A mask's FIELD - the signed distance of its smooth outline at every centre, made LAZILY (AUDIT RELEASE R4-7): at the
   * law's build each centre stands at the clamp on its own side (+ on the mask's, - off it - what a centre past the reach
   * is), and a tile of LAW_TILE x LAW_TILE centres is given its true distances the first time a read needs one of them
   * (`cover`). The outline (its rings and their index by square) is made with the field's first tile. A centre's value is
   * the one an eager build gives it, whichever tile or order made it.
   * @param {(l: number) => boolean} is
   */
  const field = (is) => {
    const m = new Uint8Array(W * H);
    for (let i = 0; i < m.length; i++) m[i] = is(label[i]) ? 1 : 0;
    const f = new Float32Array(W * H);
    for (let i = 0; i < f.length; i++) f[i] = m[i] ? C : -C;
    /** @type {{ start: Int32Array, seg: Float64Array }|null} */
    let index = null;
    const outline = () => {
      // the outline's segments, each in every square of centres its box meets (the distance asks a centre's squares
      // about): counted, then laid square by square (start[k] .. start[k + 1], four numbers a segment)
      const rings = smoothRings(m, W, H, SMOOTH_LAND.passes), start = new Int32Array(W * H + 1);
      const each = (/** @type {(k: number, ax: number, ay: number, bx: number, by: number) => void} */ fn) => {
        for (const r of rings) {
          for (let q = 0, n = r.length / 2; q < n; q++) {
            const ax = r[2 * q], ay = r[2 * q + 1], bx = r[(2 * q + 2) % r.length], by = r[(2 * q + 3) % r.length];
            for (let cy = Math.floor(Math.min(ay, by)); cy <= Math.floor(Math.max(ay, by)); cy++) for (let cx = Math.floor(Math.min(ax, bx)); cx <= Math.floor(Math.max(ax, bx)); cx++) fn(cy * W + cx, ax, ay, bx, by);
          }
        }
      };
      each((k) => { start[k + 1]++; });
      for (let k = 0; k < W * H; k++) start[k + 1] += start[k];
      const fillAt = start.slice(0, W * H), seg = new Float64Array(start[W * H] * 4);
      each((k, ax, ay, bx, by) => { const o = fillAt[k]++ * 4; seg[o] = ax; seg[o + 1] = ay; seg[o + 2] = bx; seg[o + 3] = by; });
      return { start, seg };
    };
    // a saddle of the mask (two opposite centres its, the other two not): its two off the mask held at the clamp, so the
    // cubic's reach past the square never joins the two across its middle - the strait stays open
    const held = new Uint8Array(W * H);
    for (let y = 0; y + 1 < H; y++) {
      for (let x = 0; x + 1 < W; x++) {
        const i = y * W + x, a = m[i], b = m[i + 1], c = m[i + W + 1], d = m[i + W];
        if (a !== c || b !== d || a === b) continue;
        if (a) { held[i + 1] = 1; held[i + W] = 1; } else { held[i] = 1; held[i + W + 1] = 1; }
      }
    }
    const done = new Uint8Array(TW * TH);
    const F = { f, done, made: 0, whole: false, tile: (/** @type {number} */ tx, /** @type {number} */ ty) => {
      done[ty * TW + tx] = 1; F.made++;
      if (F.made === done.length) F.whole = true;
      const { start, seg } = (index ??= outline());
      for (let y = ty * LAW_TILE; y < Math.min(H, (ty + 1) * LAW_TILE); y++) {
        for (let x = tx * LAW_TILE; x < Math.min(W, (tx + 1) * LAW_TILE); x++) {
          const i = y * W + x;
          if (!near[i] || held[i]) continue;   // past the reach the clamp's; a saddle's held centre the clamp's too
          let d2 = C * C;
          for (let cy = Math.max(0, y - R); cy < Math.min(H, y + R); cy++) {
            for (let cx = Math.max(0, x - R); cx < Math.min(W, x + R); cx++) {
              const k = cy * W + cx;
              for (let n = start[k] * 4, e4 = start[k + 1] * 4; n < e4; n += 4) {
                const ax = seg[n], ay = seg[n + 1], vx = seg[n + 2] - ax, vy = seg[n + 3] - ay, l2 = vx * vx + vy * vy;
                let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const qx = ax + vx * t - x, qy = ay + vy * t - y, e = qx * qx + qy * qy;
                if (e < d2) d2 = e;
              }
            }
          }
          const d = Math.sqrt(d2);
          f[i] = m[i] ? d : -d;
        }
      }
    } };
    return F;
  };
  const TW = Math.ceil(W / LAW_TILE), TH = Math.ceil(H / LAW_TILE);
  /** @type {Array<ReturnType<typeof field>|null>} */
  const F = Array(NO_PROVINCE + 1).fill(null);
  const FS = field((l) => l !== 0);
  // the sea's own: the land's, turned (a line between the sea and a province's land is the coast) - a tile of it the
  // land's tile negated
  const f0 = new Float32Array(W * H);
  for (let i = 0; i < f0.length; i++) f0[i] = -FS.f[i];
  const done0 = new Uint8Array(TW * TH);
  const F0 = { f: f0, done: done0, made: 0, whole: false, tile: (/** @type {number} */ tx, /** @type {number} */ ty) => {
    done0[ty * TW + tx] = 1; F0.made++;
    if (F0.made === done0.length) F0.whole = true;
    if (!FS.done[ty * TW + tx]) FS.tile(tx, ty);
    for (let y = ty * LAW_TILE; y < Math.min(H, (ty + 1) * LAW_TILE); y++) for (let x = tx * LAW_TILE; x < Math.min(W, (tx + 1) * LAW_TILE); x++) f0[y * W + x] = -FS.f[y * W + x];
  } };
  F[0] = F0;
  for (let id = 1; id <= NO_PROVINCE; id++) if (label.includes(id)) F[id] = field((l) => l === id);
  /** @type {Array<Float32Array|null>} */
  const T = F.map((x) => (x ? x.f : null));
  const S = FS.f;
  // each square's label: its four centres (ix, iy) .. (ix + 1, iy + 1) - one, or MIXED
  const uni = new Uint8Array(W * H).fill(MIXED);
  for (let iy = 0; iy + 1 < H; iy++) {
    for (let ix = 0; ix + 1 < W; ix++) {
      const l = label[iy * W + ix];
      if (label[iy * W + ix + 1] === l && label[(iy + 1) * W + ix] === l && label[(iy + 1) * W + ix + 1] === l) uni[iy * W + ix] = l;
    }
  }
  /** Every tile of every field made - the law whole, as an eager build stands it. */
  const materialize = () => { for (const x of [FS, ...F]) if (x) for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) if (!x.done[ty * TW + tx]) x.tile(tx, ty); };
  /** How many tiles the law has made, over its fields (AUDIT RELEASE R4-7's count). */
  const tilesMade = () => [FS, ...F].reduce((n, x) => n + (x ? x.made : 0), 0);
  L = { W, H, w, h, label, S, uni, T, TW, FS, F, materialize, tilesMade, fieldOf: (/** @type {number} */ id) => /** @type {Float32Array} */ (T[id]) };
  _laws.set(trace, L);
  return L;
}

/** AUDIT RELEASE R4-7: a law's field read at square (ix, iy) - the tiles under its sixteen centres made first. */
function at(L, F, ix, iy, fx, fy) {
  if (!F.whole) {
    const TW = L.TW;
    for (let ty = Math.floor((iy - 1) / LAW_TILE); ty <= Math.floor((iy + 2) / LAW_TILE); ty++) {
      for (let tx = Math.floor((ix - 1) / LAW_TILE); tx <= Math.floor((ix + 2) / LAW_TILE); tx++) if (!F.done[ty * TW + tx]) F.tile(tx, ty);
    }
  }
  return cubic(F.f, L.W, ix, iy, fx, fy);
}

/** Catmull-Rom's four weights at t of a span (the centres before, at its start, at its end, after). */
const crw = (/** @type {number} */ t, /** @type {number[]} */ w) => {
  const t2 = t * t, t3 = t2 * t;
  w[0] = (-t3 + 2 * t2 - t) / 2; w[1] = (3 * t3 - 5 * t2 + 2) / 2; w[2] = (-3 * t3 + 4 * t2 + t) / 2; w[3] = (t3 - t2) / 2;
};
const WX = [0, 0, 0, 0], WY = [0, 0, 0, 0];
/** A field read at padded centre coordinates in square (ix, iy), (fx, fy) into it: Catmull-Rom's cubic over the sixteen
 *  centres about it - through every centre's own value, a straight run's linear distance kept exactly, and smooth (its
 *  slope continuous) across the squares' edges, so a line is a curve with no corner where it passes from one square
 *  to the next. */
function cubic(f, W, ix, iy, fx, fy) {
  crw(fx, WX); crw(fy, WY);
  let v = 0;
  for (let j = 0; j < 4; j++) {
    const r = (iy - 1 + j) * W + ix - 1;
    v += WY[j] * (WX[0] * f[r] + WX[1] * f[r + 1] + WX[2] * f[r + 2] + WX[3] * f[r + 3]);
  }
  return v;
}

/**
 * THE LABEL AT A PICTURE POINT under the smooth law: 0 the sea (and off the picture), else the province's id (PROVINCE_OF_ID;
 * NO_PROVINCE for land that names none).
 * @param {ReturnType<typeof landLaw>} L @param {number} px @param {number} py
 */
export function landLabelAt(L, px, py) {
  if (!(px >= 0 && py >= 0 && px < L.w && py < L.h)) return 0;
  const x = px - 0.5 + PAD, y = py - 0.5 + PAD, ix = Math.floor(x), iy = Math.floor(y), W = L.W;
  const u = L.uni[iy * W + ix];
  if (u !== MIXED) return u;
  const fx = x - ix, fy = y - iy;
  if (!(at(L, L.FS, ix, iy, fx, fy) > 0)) return 0;
  const i = iy * W + ix, ids = [L.label[i], L.label[i + 1], L.label[i + W], L.label[i + W + 1]];
  let one = 0;
  for (const id of ids) if (id && id !== one) { if (one) { one = -1; break; } one = id; }
  if (one > 0) return one;   // the land of one province alone about it: that one's
  let best = 0, bv = -Infinity;
  for (const id of ids) {
    if (!id || id === best) continue;
    const v = at(L, L.F[id], ix, iy, fx, fy);
    if (v > bv || (v === bv && id < best)) { bv = v; best = id; }
  }
  return best;
}

/** SMOOTH-LAND: is a picture point on the land's side of the smooth coast (whatever province)? The law's own first ask -
 *  the lines' coast crossings are found by it (world/tamriel/tamrielLines.js). @param {ReturnType<typeof landLaw>} L */
export function landSideAt(L, px, py) {
  if (!(px >= 0 && py >= 0 && px < L.w && py < L.h)) return false;
  const x = px - 0.5 + PAD, y = py - 0.5 + PAD, ix = Math.floor(x), iy = Math.floor(y);
  const u = L.uni[iy * L.W + ix];
  if (u !== MIXED) return u !== 0;
  return at(L, L.FS, ix, iy, x - ix, y - iy) > 0;
}
/** SMOOTH-LAND: does province `p`'s distance stand over province `q`'s at a picture point (the border between them, the
 *  law's own second ask - the lines' border crossings are found by it)? @param {ReturnType<typeof landLaw>} L */
export function provinceLeadAt(L, px, py, p, q) {
  const x = px - 0.5 + PAD, y = py - 0.5 + PAD, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const vp = at(L, L.F[p], ix, iy, fx, fy), vq = at(L, L.F[q], ix, iy, fx, fy);
  return vp > vq || (vp === vq && p < q);
}

/** SMOOTH-LAND: how far a picture point stands inside the land's smooth coast, picture units - the law's own distance, so
 *  its 0 is the waterline; negative at sea, held to `clamp` either way. The trace's own, or null with none. */
export function coastDepthAt(px, py) {
  if (!_trace) return null;
  const L = landLaw(_trace);
  if (!(px >= 0 && py >= 0 && px < L.w && py < L.h)) return -SMOOTH_LAND.clamp;
  const x = px - 0.5 + PAD, y = py - 0.5 + PAD, ix = Math.floor(x), iy = Math.floor(y);
  return at(L, L.FS, ix, iy, x - ix, y - iy);
}
/** TESA3 (bible/03-World/Arena-Provinces.md): the province a Bay pixel past the Bay stands on - its centre's
 *  provinceKeyAt - or null: the Bay's own pixels (Daggerfall's regions answer there), and the sea. */
export function provinceKeyBeyondBay(px, py) {
  if (inBay(px, py)) return null;
  return provinceKeyAt(...bayToPicture(px + 0.5, py + 0.5));
}
/** Distance from a picture-grid point to the nearest coast, picture units - the trace's field (bilinear) or the
 *  authored edges'. */
export function coastDistanceAt(px, py) {
  if (!_trace) return coastDistance(px, py);
  const { w, h, dist } = _trace;
  const cx = Math.min(w - 1, Math.max(0, px - 0.5)), cy = Math.min(h - 1, Math.max(0, py - 0.5));
  const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0, fy = cy - y0;
  const d = /** @type {Float32Array} */ (dist);
  return (d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx) * (1 - fy) + (d[y1 * w + x0] * (1 - fx) + d[y1 * w + x1] * fx) * fy;
}

/** TAMRIEL4: the fit's scales, Bay pixels a picture pixel - every quarter from 15 to 21 (TAMRIEL3's twelve, 16 to 21,
 *  left the seam's own best, 15.5, outside them). */
export const FIT_PPUS = Object.freeze(Array.from({ length: 25 }, (_, i) => 15 + i / 4));
/** TAMRIEL4: how much the agreement INSIDE the Bay weighs beside the agreement along its EDGE. */
export const FIT_AREA_WEIGHT = 0.25;

/** FIT-BITS: the set bits of a 32-bit word. @param {number} x */
const popcount = (x) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
};

/**
 * THE FIT: where the Bay stands on the picture. The Bay's land (bayLand(x, y), Bay pixels, the one water law) is
 * laid on the picture's grid at each candidate scale (`ppus`, Bay pixels a picture pixel) as cells, four samples a cell
 * and the majority, and at each offset (picture pixels, `span` each way round `around`).
 *
 * TAMRIEL4 - THE SEAM FIRST. TAMRIEL3 scored the cells INSIDE the Bay alone, and the picture's own Bay is a cruder,
 * more diagonal inlet than WOODS.WLD's: its best inside (77% of the cells) left High Rock's and Hammerfell's painted
 * west coasts 100-200 Bay pixels past the data's, and the coast the player followed out of the Bay ran off the edge of
 * the data into nothing (516 edge pixels of 3,000 disagreeing). But inside the Bay the picture is never drawn - the
 * data is - so what the fit owes the map is the JOIN: the Bay's edge cells against the picture's pixels just beyond
 * them, the fraction agreeing, with the inside's fraction beside it at FIT_AREA_WEIGHT (a fraction, not a count: a
 * smaller scale lays more cells). On the freeware data the Bay stands at (38, 57) x15.5: 190 of its 192 edge cells
 * agree (231 edge pixels, 139 of them where the painting's Hammerfell reaches past the west edge), 75% inside. A
 * candidate keeps a pixel of picture round it, or it is skipped.
 *
 * Answers { ox, oy, ppu, score, cells, seam, edge } - ox, oy in PICTURE units (the frame takes them times ppu); `score`
 * of `cells` agreeing inside, `seam` of `edge` along it - or null. Deterministic; ~0.4 s at the defaults.
 * @param {{ bayLand: (x: number, y: number) => boolean, trace: TamrielTrace, around?: {ox: number, oy: number},
 *   span?: number, ppus?: readonly number[] }} o
 */
export function fitBayToPicture({ bayLand, trace, around = { ox: 46, oy: 52 }, span = 24, ppus = FIT_PPUS }) {
  let best = null, bestValue = -Infinity;
  const { w, land } = trace;
  // FIT-BITS (2026-10-20, bible/07-Rendering/Performance-Priority.md FIT-BITS): the inside's score counted 32 cells a
  // word - the picture's rows as two bitsets (its pixels that ARE 1, and that ARE 0: a cell agrees only with its own
  // value, whatever else a picture holds), a cell agreeing where the mask's bit meets the one and its clear bit the
  // zero. The same counts as a cell at a time, so the same fit: the boot paid ~0.8 s of its first world frame for the
  // cell-at-a-time walk (25 scales, 49 x 49 offsets, up to 2,178 cells each).
  const words = (w + 31) >>> 5;
  const ones = new Uint32Array(words * trace.h + 1), zeros = new Uint32Array(words * trace.h + 1);
  for (let y = 0; y < trace.h; y++) {
    for (let x = 0; x < w; x++) {
      const v = land[y * w + x], bit = 1 << (x & 31), at = y * words + (x >>> 5);
      if (v === 1) ones[at] |= bit;
      else if (v === 0) zeros[at] |= bit;
    }
  }
  // the Bay's land as the fit samples it, a mask a scale - and its print: AUDIT RELEASE R4-4, a fit kept for the trace
  // (`trace.fitKeep`, ui/tamrielTrace.js preloadTamrielTrace's) on this very land is taken, not searched again
  const masks = ppus.map((ppu) => {
    const cols = Math.floor(BAY_W / ppu), rows = Math.floor(BAY_H / ppu);
    const mask = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // four samples a cell, the majority: a 15 km cell is not one pixel's word
        let n = 0;
        for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (bayLand(Math.floor((i + dx) * ppu), Math.floor((j + dy) * ppu))) n++;
        mask[j * cols + i] = n >= 2 ? 1 : 0;
      }
    }
    return mask;
  });
  const keep = /** @type {any} */ (trace).fitKeep ?? null;
  let print = '';
  if (keep) {
    let h = 0x811c9dc5;
    for (const v of [around.ox, around.oy, span, ...ppus.map((q) => q * 4)]) { h ^= v & 0xff; h = Math.imul(h, 0x01000193) >>> 0; h ^= (v >> 8) & 0xff; h = Math.imul(h, 0x01000193) >>> 0; }
    for (const m of masks) for (let i = 0; i < m.length; i++) { h ^= m[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    print = `${h.toString(36)}:${masks.reduce((n, m) => n + m.length, 0)}`;
    const kept = keep.get(print);
    if (kept) return { ...kept };
  }
  for (let q = 0; q < ppus.length; q++) {
    const ppu = ppus[q], cols = Math.floor(BAY_W / ppu), rows = Math.floor(BAY_H / ppu), mask = masks[q];
    const mw = (cols + 31) >>> 5, tail = cols & 31 ? 2 ** (cols & 31) - 1 : 0xffffffff;
    const bits = new Uint32Array(mw * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (mask[j * cols + i] === 1) bits[j * mw + (i >>> 5)] |= 1 << (i & 31);
    const edge = 2 * (cols + rows);
    for (let oy = around.oy - span; oy <= around.oy + span; oy++) {
      if (oy < 1 || oy + rows + 1 > trace.h) continue;
      for (let ox = around.ox - span; ox <= around.ox + span; ox++) {
        if (ox < 1 || ox + cols + 1 > w) continue;
        let score = 0;
        for (let j = 0; j < rows; j++) {
          const row = (oy + j) * words, mrow = j * mw;
          for (let k = 0; k < mw; k++) {
            // the picture's 32 pixels from ox + 32k, as one word (a word past the window's last pixel is the tail's to clear)
            const b = ox + (k << 5), at = row + (b >>> 5), s = b & 31;
            const one = s ? (ones[at] >>> s) | (ones[at + 1] << (32 - s)) : ones[at];
            const zero = s ? (zeros[at] >>> s) | (zeros[at + 1] << (32 - s)) : zeros[at];
            const m = bits[mrow + k];
            score += popcount((m & one) | (~m & zero & (k === mw - 1 ? tail : 0xffffffff)));
          }
        }
        // the seam: each edge cell against the picture's pixel beyond it
        let seam = 0;
        for (let i = 0; i < cols; i++) {
          if (mask[i] === land[(oy - 1) * w + ox + i]) seam++;
          if (mask[(rows - 1) * cols + i] === land[(oy + rows) * w + ox + i]) seam++;
        }
        for (let j = 0; j < rows; j++) {
          if (mask[j * cols] === land[(oy + j) * w + ox - 1]) seam++;
          if (mask[j * cols + cols - 1] === land[(oy + j) * w + ox + cols]) seam++;
        }
        const value = seam / edge + (FIT_AREA_WEIGHT * score) / (cols * rows);
        if (value > bestValue) { bestValue = value; best = { ox, oy, ppu, score, cells: cols * rows, seam, edge }; }
      }
    }
  }
  if (keep && best) keep.keep(print, { ...best });
  return best;
}
