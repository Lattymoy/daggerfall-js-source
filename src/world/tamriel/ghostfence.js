// @ts-check
// GHOSTFENCE (bible/03-World/Red-Mountain.md, The Ghostfence): the Tribunal's barrier round Red Mountain - a ring of
// pylons at the summit cone's foot, its one gate Ghostgate in the south (UESP: the Ghostfence and Ghostgate, 3E 417).
// One law read by the countryside's roll, the lairs', the roads' worker, the pixel build and the far views. Pure, and
// one float in every engine (AUDIT LANDFORMS III A8): its directions are redMountain.js dirOf's series.
import { redMountainFrame, dirOf } from './redMountain.js';
import { perlinNoise } from '../perlin.js';
import { TERRAIN_SIZE } from '../terrain/terrainSampler.js';
import { BAY_H } from './tamrielFrame.js';

const SAMPLE_M = TERRAIN_SIZE / 128;

/** THE FENCE'S DIALS (metres, turns): its radius from the volcano's centre and how far it wanders, the pylons' spacing
 *  along it, Ghostgate's turn (x east, y north: 0.75 is south) and how far past the fence the countryside keeps away. */
export const GHOSTFENCE_DIALS = Object.freeze({
  radius: 14000,
  wander: Object.freeze({ amp: 0.05, radius: 1.3, seed: 41.7 }),
  spacing: 48,
  gate: 0.75,
  keep: TERRAIN_SIZE,
});
const D = GHOSTFENCE_DIALS;
/** The pylons round the ring. */
export const GHOSTFENCE_PYLONS = Math.round((2 * Math.PI * D.radius) / D.spacing);
/** Ghostgate's half-width along the fence (metres): its towers' outer faces, where the fence's two sides meet it. */
export const GHOSTGATE_HALF = 17;

/** The fence's distance from the centre (metres) toward the direction (ux, uy): its radius wandered by noise read on a
 *  circle, so it closes on itself. */
export const ghostfenceRadius = (ux, uy) =>
  D.radius *
  (1 +
    D.wander.amp * (2 * perlinNoise(ux * D.wander.radius + D.wander.seed, uy * D.wander.radius + D.wander.seed) - 1));

/** A Bay pixel's key in the fence's sets. */
const keyOf = (px, py) => `${px},${py}`;
/** World samples (gx east, gy north) to the Bay pixel holding them. */
export const sampleToPixel = (gx, gy) => [Math.floor(gx / 128), Math.floor(BAY_H + 1 - gy / 128)];

/** THE FENCE'S FRAME: the centre and the pylons (world samples), each one's unit tangent (counter-clockwise), Ghostgate's
 *  pylon, the Bay pixels the fence crosses (`band`, closed and 4-connected) and those a road may take (`open`), each
 *  pixel's pylons and the runs with a piece of the solid or a curtain point in it (`runsBy`), Ghostgate's pixel and the
 *  band's box.
 * @typedef {{ cx: number, cy: number, n: number, pts: Float64Array, tan: Float64Array, gate: number, band: ReadonlySet<string>,
 *   open: ReadonlySet<string>, byPixel: ReadonlyMap<string, number[]>, runsBy: ReadonlyMap<string, number[]>, gatePixel: string,
 *   x0: number, x1: number, y0: number, y1: number }} GhostfenceFrame */
/** @type {GhostfenceFrame|null} */
let _frame = null;
let _rm = /** @type {any} */ (undefined);

/** THE FENCE for the volcano's frame in use (redMountain.js redMountainFrame) - made once a frame, null without one. */
export function ghostfenceFrame() {
  const rm = redMountainFrame();
  if (rm === _rm) return _frame;
  _rm = rm;
  if (!rm) return (_frame = null);
  const n = GHOSTFENCE_PYLONS,
    pts = new Float64Array(2 * n),
    tan = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const [ux, uy] = dirOf(i / n),
      r = ghostfenceRadius(ux, uy) / SAMPLE_M;
    pts[2 * i] = rm.cx + ux * r;
    pts[2 * i + 1] = rm.cy + uy * r;
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n,
      b = (i + 1) % n;
    const tx = pts[2 * b] - pts[2 * a],
      ty = pts[2 * b + 1] - pts[2 * a + 1],
      l = Math.sqrt(tx * tx + ty * ty);
    tan[2 * i] = tx / l;
    tan[2 * i + 1] = ty / l;
  }
  const band = new Set(),
    byPixel = new Map();
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  const mark = (px, py) => {
    band.add(keyOf(px, py));
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ax, ay] = sampleToPixel(pts[2 * i], pts[2 * i + 1]),
      [bx, by] = sampleToPixel(pts[2 * j], pts[2 * j + 1]);
    mark(ax, ay);
    mark(bx, by);
    if (ax !== bx && ay !== by) {
      mark(ax, by);
      mark(bx, ay);
    } // a corner crossed: both its neighbours, so the line is 4-connected
    const k = keyOf(ax, ay);
    (byPixel.get(k) ?? byPixel.set(k, []).get(k)).push(i);
  }
  const gate = Math.round(D.gate * n) % n;
  const [gx, gy] = sampleToPixel(pts[2 * gate], pts[2 * gate + 1]);
  const open = new Set();
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (band.has(keyOf(gx + dx, gy + dy))) open.add(keyOf(gx + dx, gy + dy));
  // AUDIT RED-MOUNTAIN N1: each pixel's runs - those with a piece of the solid (by its middle) or a curtain point in it
  const runsBy = new Map(),
    part = { n, pts, tan, gate };
  const add = (gx2, gy2, i) => {
    const [qx, qy] = sampleToPixel(gx2, gy2),
      k = keyOf(qx, qy),
      l = runsBy.get(k) ?? runsBy.set(k, []).get(k);
    if (l[l.length - 1] !== i) l.push(i);
  };
  for (let i = 0; i < n; i++) {
    const cuts = ghostfenceRunCuts(part, i);
    for (let c = 0; c + 3 < cuts.length; c += 2) add((cuts[c] + cuts[c + 2]) / 2, (cuts[c + 1] + cuts[c + 3]) / 2, i);
    for (let k = 0; k <= CURTAIN_STEPS; k++) {
      const [x, y] = ghostfenceCurtainPoint(part, i, k);
      add(x, y, i);
    }
  }
  return (_frame = {
    cx: rm.cx,
    cy: rm.cy,
    n,
    pts,
    tan,
    gate,
    band,
    open,
    byPixel,
    runsBy,
    gatePixel: keyOf(gx, gy),
    x0,
    x1,
    y0,
    y1,
  });
}

/** WHETHER THE COUNTRYSIDE KEEPS OFF Bay pixel (px, py): its centre within the fence, or within `keep` past it - so no
 *  farm, inn, temple or hamlet stands inside the Ghostfence or on its line (UESP: none lived past it in 3E 417). */
export function insideGhostfence(px, py) {
  const f = ghostfenceFrame();
  if (!f) return false;
  const reach = (D.radius * (1 + D.wander.amp) + D.keep) / SAMPLE_M;
  const dx = (px + 0.5) * 128 - f.cx,
    dy = (BAY_H + 0.5 - py) * 128 - f.cy;
  if (!(dx < reach && dx > -reach && dy < reach && dy > -reach)) return false;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return true;
  return d * SAMPLE_M < ghostfenceRadius(dx / d, dy / d) + D.keep;
}

/** Whether the fence crosses Bay pixel (px, py) - no lair stands there. */
export function onGhostfence(px, py) {
  const f = ghostfenceFrame();
  return !!f && px >= f.x0 && px <= f.x1 && py >= f.y0 && py <= f.y1 && f.band.has(keyOf(px, py));
}

/** Whether a body on open ground may not step into Bay pixel (px, py) - the fence's line but at Ghostgate (AUDIT
 *  RED-MOUNTAIN G2: the Overworld's route planner walked straight across it). */
export function ghostfenceShuts(px, py) {
  return onGhostfence(px, py) && !(/** @type {GhostfenceFrame} */ (_frame).open.has(keyOf(px, py)));
}

/** The pixels a road may not take (the band less Ghostgate's): every one of them, Bay pixels. */
export function ghostfenceRoadBlocks() {
  const f = ghostfenceFrame();
  if (!f) return [];
  const out = [];
  for (const k of f.band) {
    if (f.open.has(k)) continue;
    const [x, y] = k.split(',').map(Number);
    out.push({ x, y });
  }
  return out;
}

/** The pylons whose foot stands in Bay pixel (px, py) (Ghostgate's among them, stood as the gate). */
export function ghostfencePylonsIn(px, py) {
  return ghostfenceFrame()?.byPixel.get(keyOf(px, py)) ?? [];
}

/** A run of the fence - pylon i to the next - its two ends in world samples: a pylon's foot, or where it meets Ghostgate's
 *  tower (GHOSTGATE_HALF along the fence from the gate's foot). */
export function ghostfencePanel(f, i) {
  const j = (i + 1) % f.n,
    h = GHOSTGATE_HALF / SAMPLE_M;
  const end = (k, side) =>
    k === f.gate
      ? [f.pts[2 * k] + side * f.tan[2 * k] * h, f.pts[2 * k + 1] + side * f.tan[2 * k + 1] * h]
      : [f.pts[2 * k], f.pts[2 * k + 1]];
  return [end(i, 1), end(j, -1)];
}

/** The curtain's points a run, end to end less one (the glow's feet between two pylons, render/ghostfenceGlow.js - each
 *  noted on its own pixel's ground by the pixel build). */
export const CURTAIN_STEPS = 8;
/** Run i's curtain point k (0..CURTAIN_STEPS) in world samples, from its first end to its last. */
export function ghostfenceCurtainPoint(f, i, k) {
  const [[ax, ay], [bx, by]] = ghostfencePanel(f, i),
    t = k / CURTAIN_STEPS;
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

/** THE SOLID'S PIECES of run i (AUDIT RED-MOUNTAIN N1: one flat quad a run left gullies open under it): its cut points in
 *  world samples (x, y pairs, end to end) - at every crossing of a pixel's edge, and between them steps of a sample (6.4 m)
 *  at most - so each piece lies in one pixel, and its ground is that pixel's own. */
export function ghostfenceRunCuts(f, i) {
  const [[ax, ay], [bx, by]] = ghostfencePanel(f, i),
    dx = bx - ax,
    dy = by - ay;
  const ts = [0, 1];
  for (const [a, d] of [
    [ax, dx],
    [ay, dy],
  ]) {
    if (d === 0) continue;
    const lo = a < a + d ? a : a + d,
      hi = a < a + d ? a + d : a;
    for (let k = Math.ceil(lo / 128); k * 128 <= hi; k++) {
      const t = (k * 128 - a) / d;
      if (t > 0 && t < 1) ts.push(t);
    }
  }
  ts.sort((p, q) => p - q);
  const len = Math.sqrt(dx * dx + dy * dy),
    out = [];
  for (let c = 0; c + 1 < ts.length; c++) {
    const t0 = ts[c],
      t1 = ts[c + 1],
      m = Math.max(1, Math.ceil((t1 - t0) * len - 1e-9));
    for (let q = 0; q < m; q++) {
      const t = t0 + ((t1 - t0) * q) / m;
      out.push(ax + dx * t, ay + dy * t);
    }
  }
  out.push(bx, by);
  return Float64Array.from(out);
}

/** FENCE-CLEAR: is world sample (gx, gy) within `m` metres of the fence's line - a run of the 3x3 pixels about it, or
 *  Ghostgate's span between its towers' faces? (The pixel build keeps its flats and landmarks off it: scenes/
 *  ghostfenceBuild.js fireClearing.) */
export function ghostfenceNear(gx, gy, m) {
  const f = ghostfenceFrame();
  if (!f) return false;
  const [px, py] = sampleToPixel(gx, gy),
    r = m / SAMPLE_M;
  const near = (ax, ay, bx, by) => {
    const ex = bx - ax,
      ey = by - ay,
      l2 = ex * ex + ey * ey;
    let t = l2 > 0 ? ((gx - ax) * ex + (gy - ay) * ey) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = gx - ax - ex * t,
      qy = gy - ay - ey * t;
    return qx * qx + qy * qy < r * r;
  };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const i of f.runsBy.get(keyOf(px + dx, py + dy)) ?? []) {
        const [[ax, ay], [bx, by]] = ghostfencePanel(f, i);
        if (near(ax, ay, bx, by)) return true;
      }
    }
  }
  const g = f.gate,
    h = GHOSTGATE_HALF / SAMPLE_M,
    x = f.pts[2 * g],
    y = f.pts[2 * g + 1],
    tx = f.tan[2 * g],
    ty = f.tan[2 * g + 1];
  return near(x - tx * h, y - ty * h, x + tx * h, y + ty * h);
}

/** FENCE-CLEAR: does the fence's line cross Bay pixel (px, py) or a pixel beside it? (Where ghostfenceNear may answer.) */
export function ghostfenceBeside(px, py) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (onGhostfence(px + dx, py + dy)) return true;
  return false;
}
