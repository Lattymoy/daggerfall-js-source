// @ts-check
// COATS3D (2026-10-11, the owner, sending the Courser - walk.fbx, idle.fbx, idle-1.fbx, gallop.fbx, trot.fbx - and two
// pictures: "The first image is for the horse itself and the second is for the tail. These are to be applied to horses
// for people using morrowind with the character properly rigged when riding. These also need to recieve the same
// texture treatment we gave the sprites with parity between each"; asked, every horse of the Morrowind lane - the
// ridden one with its rider astride, other riders, the standing and following horses and the wagon teams - and first
// person on the 3D horse): THE 3D HORSE, ITS PURE HALF.
//
// The horse is tools/bakeHorse.mjs's bake of the owner's rig (src/assets/horse/courser.json - its header says what is
// in it): a skinned body and its mane and tail cards on a 33-bone skeleton, in its own frame (metres, Z up, +Y the way
// it faces - Morrowind's basis, so it stands in the Morrowind body's pass as the body does), and four gaits. This
// module is everything about it that is not GL:
//  - THE STREAM (horseSkinStream): the meshes as the character pass's GPU skin draws them (formats/morrowind/mwGpuSkin.js's
//    corner: the fourteen static floats, one influence pair, the post) - the body, then the cards, a range each;
//  - THE GAIT (stepHorseGait, gaitFor): which of idle, walk, trot and gallop a horse going `speed` plays, at the rate
//    its stride covers the ground (the bake's measured speed a gait), crossfaded GAIT_FADE seconds into the next;
//  - THE POSE (writeHorsePalette): the gait's bones composed parent-first and written as the skin's palette - entry 0
//    the identity (every corner's post), entry 1 + b bone b's skin (its pose times its inverse bind);
//  - THE TEXEL MAP (horseTexelMap): where each texel of the body's picture lies on the horse, which the 3D dye
//    (systems/horse/horseCoats.js recolorHorseTexels) lays a look by - the sprites' law, on the horse's own surface.
//
// Pure: no DOM, no GL, no clock. Not a DFU member: Daggerfall's horse is a sprite. Ledger A (COATS3D).
import { texelPlanes } from '../systems/horse/horseCoats.js';
import { SKIN_STATIC_FLOATS, skinStreamFloats } from '../formats/morrowind/mwGpuSkin.js';
import { SKIN_PAL_ROW } from '../render/skinPalette.js';

/** The bake and its two pictures (the body's, the mane and tail cards'). */
export const HORSE_MODEL_URL = new URL('../assets/horse/courser.json', import.meta.url).href;
export const HORSE_PICTURE_URLS = Object.freeze({
  body: new URL('../assets/horse/body.png', import.meta.url).href,
  hair: new URL('../assets/horse/hair.png', import.meta.url).href,
});

/** The gaits, slowest first. */
export const HORSE_GAITS = Object.freeze(['idle', 'walk', 'trot', 'gallop']);
/** The speed (metres a second) each gait starts at. The walk covers 0.67 m/s at its own rate, the trot 1.93 and the
 *  gallop 10.3 (the bake's measures); the owner's rig has no canter, so between a quick trot and the gallop the
 *  gallop plays slow. A ridden horse's speed is Daggerfall's (motor.js rideSpeed: about 10.8 m/s at speed 50 - a
 *  gallop at its own rate) - and under horse care a walk (HORSE-WALK: about 5 m/s, a trot under its rider's word,
 *  gaitFor's `gallops`) or the gallop on the ride base (about 17). */
export const HORSE_GAIT_FROM = Object.freeze({ idle: 0, walk: 0.2, trot: 1.3, gallop: 5 });
/** A gait is held this share past its edges either way, so a horse at an edge's speed does not flicker between two. */
export const GAIT_HOLD = 0.15;
/** The rates a gait plays at, at least and at most: past them the hooves slide rather than the legs blur. */
export const GAIT_RATES = Object.freeze({ idle: Object.freeze([1, 1]), walk: Object.freeze([0.5, 1.9]), trot: Object.freeze([0.6, 2.2]), gallop: Object.freeze([0.5, 1.8]) });
/** Seconds one gait fades into the next. */
export const GAIT_FADE = 0.25;

/**
 * The gait a horse going `speed` plays, from `current`: the highest whose start it has reached, but a gait already
 * playing is kept until the speed is GAIT_HOLD past its edge.
 * HORSE-WALK: `gallops` false - a ridden horse its rider holds to a slow ride (motor.js slowRide: walked, or under half
 * its base) - puts the gallop out of reach, and a gallop playing ends at once. Daggerfall's walk (about 5 m/s) stands
 * on the gallop's own edge, inside the hold either way, so the gait would be its history's: a trot from a stand, a
 * slow-motion gallop after a gallop. The stride that carries it is the trot's.
 * @param {number} speed
 * @param {string} [current]
 * @param {boolean} [gallops]
 */
export function gaitFor(speed, current = 'idle', gallops = true) {
  const v = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const top = gallops ? HORSE_GAITS.length - 1 : HORSE_GAITS.indexOf('trot');
  let k = 0;
  for (let i = 1; i <= top; i++) if (v >= HORSE_GAIT_FROM[HORSE_GAITS[i]]) k = i;
  const c = HORSE_GAITS.indexOf(current);
  if (c < 0 || c > top || k === c) return HORSE_GAITS[k];
  if (k > c && v < HORSE_GAIT_FROM[HORSE_GAITS[c + 1]] * (1 + GAIT_HOLD)) return current;
  if (k < c && v > HORSE_GAIT_FROM[HORSE_GAITS[c]] * (1 - GAIT_HOLD)) return current;
  return HORSE_GAITS[k];
}

/** The rate gait `gait` plays at for a horse going `speed`: its stride covering the ground, within GAIT_RATES. */
export function gaitRate(bake, gait, speed) {
  const g = bake.gaits[gait];
  if (!g || !(g.speed > 0)) return 1;
  const [lo, hi] = GAIT_RATES[gait] ?? [1, 1];
  return Math.min(hi, Math.max(lo, (Number.isFinite(speed) ? speed : 0) / g.speed));
}

/** A horse's gait, standing: the gait it plays, each gait's clock (seconds into its cycle), the one it fades from. */
export function horseGait() {
  return { gait: 'idle', clock: { idle: 0, walk: 0, trot: 0, gallop: 0 }, from: /** @type {string | null} */ (null), fade: 1 };
}

/**
 * One step of a horse's gait: going `speed` m/s for `dt` seconds. A new gait comes in at the phase the old one was
 * at (a footfall where a footfall was) and fades in over GAIT_FADE. `seed` starts a horse's idle at its own place, so
 * a stable of horses does not breathe together. `gallops` false: its rider holds it to a slow ride (gaitFor).
 */
export function stepHorseGait(g, bake, speed, dt, seed = 0, gallops = true) {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const want = gaitFor(speed, g.gait, gallops);
  if (want !== g.gait) {
    const was = bake.gaits[g.gait], now = bake.gaits[want];
    g.clock[want] = was && now ? (g.clock[g.gait] / was.duration) * now.duration : 0;
    if (want === 'idle' && seed) g.clock.idle = ((seed * 0.6180339887) % 1) * bake.gaits.idle.duration;
    g.from = g.gait; g.gait = want; g.fade = 0;
  }
  g.fade = Math.min(1, g.fade + (step / GAIT_FADE));
  if (g.fade >= 1) g.from = null;
  for (const name of g.from ? [g.gait, g.from] : [g.gait]) {
    const d = bake.gaits[name]?.duration;
    if (d > 0) g.clock[name] = (g.clock[name] + step * gaitRate(bake, name, speed)) % d;
  }
  return g;
}

/** How much of gait `name` a horse's pose is this frame, 0..1 (the fade's share while one gait hands to another) - the
 *  rider's lean into the gallop reads it. */
export function gaitShare(g, name) {
  if (g.gait === name) return g.from ? g.fade : 1;
  return g.from === name ? 1 - g.fade : 0;
}

/**
 * Gait `name`'s bones at `time` seconds: each bone's local translation into `t` (3 a bone) and rotation into `q`
 * (x, y, z, w; 4 a bone), between the bake's two frames either side.
 */
export function gaitLocals(bake, name, time, t, q) {
  const g = bake.gaits[name];
  const nb = bake.bones.length;
  const span = (time / g.duration) % 1;
  const at = (span < 0 ? span + 1 : span) * (g.frames - 1);
  const f0 = Math.min(g.frames - 1, Math.floor(at)), f1 = Math.min(g.frames - 1, f0 + 1), k = at - f0;
  for (let b = 0; b < nb; b++) {
    t[b * 3] = g.rest[b * 3]; t[b * 3 + 1] = g.rest[b * 3 + 1]; t[b * 3 + 2] = g.rest[b * 3 + 2];
    const a = (f0 * nb + b) * 4, c = (f1 * nb + b) * 4;
    let dot = 0;
    for (let j = 0; j < 4; j++) dot += g.q[a + j] * g.q[c + j];
    const sg = dot < 0 ? -1 : 1;
    for (let j = 0; j < 4; j++) q[b * 4 + j] = g.q[a + j] + (sg * g.q[c + j] - g.q[a + j]) * k;
  }
  const m = g.moves.length;
  for (let i = 0; i < m; i++) {
    const b = g.moves[i], a = (f0 * m + i) * 3, c = (f1 * m + i) * 3;
    for (let j = 0; j < 3; j++) t[b * 3 + j] = g.t[a + j] + (g.t[c + j] - g.t[a + j]) * k;
  }
}

/** The palette's shape for this bake: entry 0 the identity, entry 1 + b bone b. */
export function horsePaletteShape(bake) {
  const entries = 1 + bake.bones.length;
  return { entries, width: 3 * Math.min(entries, SKIN_PAL_ROW), height: Math.ceil(entries / SKIN_PAL_ROW) };
}

/** A gait's working buffers, made once a horse. */
export function horsePoseScratch(bake) {
  const nb = bake.bones.length;
  return { t: new Float32Array(nb * 3), q: new Float32Array(nb * 4), t2: new Float32Array(nb * 3), q2: new Float32Array(nb * 4), world: new Float64Array(nb * 12),
    inv: bake.bones.map((b) => rowsOf(b.inverseBind)) };
}

/** A column-major 4x4 as the affine's twelve, row by row: [a0 a1 a2 t0  a3 a4 a5 t1  a6 a7 a8 t2]. */
function rowsOf(m) {
  return Float64Array.from([m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14]]);
}

/**
 * THE POSE: gait state `g`'s bones written into `pal` as the GPU skin's palette (three texels an entry, rows
 * [a0 a1 a2 t0] [a3 a4 a5 t1] [a6 a7 a8 t2] - formats/morrowind/mwGpuSkin.js writeSkinPalette's layout). Fading, the two gaits'
 * locals blend (translations lerped, rotations nlerped) before they compose. Answers `pal`.
 */
export function writeHorsePalette(bake, g, pal, scratch = horsePoseScratch(bake)) {
  const nb = bake.bones.length;
  const { t, q, t2, q2, world, inv } = scratch;
  gaitLocals(bake, g.gait, g.clock[g.gait], t, q);
  if (g.from && g.fade < 1) {
    gaitLocals(bake, g.from, g.clock[g.from], t2, q2);
    const k = g.fade;
    for (let i = 0; i < nb * 3; i++) t[i] = t2[i] + (t[i] - t2[i]) * k;
    for (let b = 0; b < nb; b++) {
      const o = b * 4;
      const sg = q[o] * q2[o] + q[o + 1] * q2[o + 1] + q[o + 2] * q2[o + 2] + q[o + 3] * q2[o + 3] < 0 ? -1 : 1;
      for (let j = 0; j < 4; j++) q[o + j] = q2[o + j] + (sg * q[o + j] - q2[o + j]) * k;
    }
  }
  // entry 0: the identity
  pal.fill(0, 0, 12);
  pal[0] = 1; pal[5] = 1; pal[10] = 1;
  for (let b = 0; b < nb; b++) {
    const o = b * 4;
    let x = q[o], y = q[o + 1], z = q[o + 2], w = q[o + 3];
    const l = Math.hypot(x, y, z, w) || 1;
    x /= l; y /= l; z /= l; w /= l;
    // the local affine
    const L = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), t[b * 3],
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), t[b * 3 + 1],
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), t[b * 3 + 2]];
    const p = bake.bones[b].parent;
    const W = world.subarray(b * 12, b * 12 + 12);
    if (p < 0) W.set(L);
    else affine(world.subarray(p * 12, p * 12 + 12), L, W);
    // the skin: the pose times the inverse bind, into entry 1 + b
    const e = 1 + b;
    const row = Math.floor(e / SKIN_PAL_ROW), col = (e - row * SKIN_PAL_ROW) * 3;
    const width = 3 * Math.min(nb + 1, SKIN_PAL_ROW);
    affine(W, inv[b], pal, (row * width + col) * 4);
  }
  return pal;
}

/** out = a o b, both affines as rows of four. */
function affine(a, b, out, o = 0) {
  for (let r = 0; r < 3; r++) {
    const a0 = a[r * 4], a1 = a[r * 4 + 1], a2 = a[r * 4 + 2], a3 = a[r * 4 + 3];
    out[o + r * 4] = a0 * b[0] + a1 * b[4] + a2 * b[8];
    out[o + r * 4 + 1] = a0 * b[1] + a1 * b[5] + a2 * b[9];
    out[o + r * 4 + 2] = a0 * b[2] + a1 * b[6] + a2 * b[10];
    out[o + r * 4 + 3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3;
  }
}

/**
 * THE STREAM: the bake's meshes, de-indexed, as the character pass's GPU skin reads a corner (formats/morrowind/mwGpuSkin.js:
 * position, diffuse, normal, UV, emission - SKIN_STATIC_FLOATS - then the four influences' palette entries and their
 * weights, then the post). Every corner's post is entry 0, the identity: the horse's skin is its bones alone. The
 * diffuse is white and the emission none (the pictures are the colour). The bake's UVs are FBX's, v up; the pass
 * samples a picture top row first, so v is turned over. Answers the stream, its corner's floats and its `ranges` - the
 * body's, then the cards' - in draw order.
 */
export function horseSkinStream(bake) {
  const floats = skinStreamFloats(1);
  const corners = bake.meshes.reduce((n, m) => n + m.indices.length, 0);
  const stream = new Float32Array(corners * floats);
  const order = [...bake.meshes].sort((a, b) => (a.alpha ? 1 : 0) - (b.alpha ? 1 : 0));   // the hide first, the alpha cards over it
  const ranges = [];
  let c = 0;
  for (const m of order) {
    const first = c;
    for (const v of m.indices) {
      const o = c * floats;
      stream[o] = m.positions[v * 3]; stream[o + 1] = m.positions[v * 3 + 1]; stream[o + 2] = m.positions[v * 3 + 2];
      stream[o + 3] = 1; stream[o + 4] = 1; stream[o + 5] = 1;
      stream[o + 6] = m.normals[v * 3]; stream[o + 7] = m.normals[v * 3 + 1]; stream[o + 8] = m.normals[v * 3 + 2];
      stream[o + 9] = m.uvs[v * 2]; stream[o + 10] = 1 - m.uvs[v * 2 + 1];
      // emission 11..13 stays 0
      for (let j = 0; j < 4; j++) {
        stream[o + SKIN_STATIC_FLOATS + j] = 1 + m.joints[v * 4 + j];
        stream[o + SKIN_STATIC_FLOATS + 4 + j] = m.weights[v * 4 + j];
      }
      stream[o + floats - 1] = 0;
      c++;
    }
    ranges.push({ part: m.part, texture: m.texture, alpha: !!m.alpha, first, count: c - first });
  }
  return { stream, floats, pairs: 1, ranges };
}

/**
 * The hide's measure off the body mesh: its length nose to rump, its nose's y and its top's z (texelPlanes), and the
 * hooves' CROWN - the coronet, where the horn meets the hair - and the hide's height over it (the legs' white's
 * measure). The crown is read off the skeleton: halfway between each hoof bone's joint (the coffin's, 3.5 cm up on the
 * owner's rig) and its parent's (the fetlock's, 13.5-14.5 cm), the mean of the four - 8.75 cm, where the picture's
 * dark horn gives way to the leg (the painting's own step, measured: its value dips to 0.11 at 10-12 cm and stands
 * 0.17-0.2 below). The skin cannot say it: the hoof bones hold the horn's lowest vertices with the pasterns.
 */
export function horseHide(bake) {
  const body = bake.meshes.find((m) => m.part === 'body');
  const joints = bake.bones.map((b) => b.bind[14]);
  const legs = bake.bones.map((b, i) => (/hoof/i.test(b.name) && b.parent >= 0 ? (joints[i] + joints[b.parent]) / 2 : null)).filter((z) => z != null);
  const crown = legs.length ? legs.reduce((a, z) => a + z, 0) / legs.length : 0;
  let y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
  const n = body.positions.length / 3;
  for (let v = 0; v < n; v++) {
    const y = body.positions[v * 3 + 1], z = body.positions[v * 3 + 2];
    if (y < y0) y0 = y; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  return { length: y1 - y0, front: y1, top: z1, crown, height: z1 - crown };
}

/** Texels of gutter a texel map reaches past its islands' edges: a mip's or a filter's neighbour is dyed too. */
export const TEXEL_GUTTER = 2;

/**
 * THE TEXEL MAP: where each texel of the body's `width` x `height` picture lies on the horse - the body's triangles
 * laid out on the picture by their UVs (v up, so a texel's row is from the top: 1 - v), each texel inside one taking
 * its bind position and normal between the triangle's corners. Answers `{ width, height, hide, planes, up }` for
 * systems/horse/horseCoats.js recolorHorseTexels: `hide` 1 where the body's hide draws (no triangle's texel is 0, nor one
 * under the hooves' crown - the horn keeps the art's), `planes` the texel's frames (texelPlanes), `up` its height over
 * the crown as a share of the hide's. The texels just past an island's edge take their nearest inside's place, TEXEL_GUTTER
 * deep, so a filtered or mipped sample at an edge is dyed with it.
 */
export function horseTexelMap(bake, width, height) {
  const job = startTexelMap(bake, width, height);
  while (!job.step()) { /* the whole map at once */ }
  return job.map;
}

/** Steps a texel map's build takes (TEXEL_MAP_STEPS): its triangles laid out in four, its gutter's rings one each, its
 *  texels placed in four - each some 5-10 ms, so a renderer builds the map over a few frames (world/horseRig.js). */
export const TEXEL_MAP_STEPS = 4 + TEXEL_GUTTER + 4;

/**
 * horseTexelMap a step at a time: `{ step(), map }` - `step()` does the next slice and answers whether the map is
 * done (`map` then whole; null before).
 */
export function startTexelMap(bake, width, height) {
  const body = bake.meshes.find((m) => m.part === 'body');
  const hide = horseHide(bake);
  const n = width * height;
  const own = new Int32Array(n).fill(-1);   // the triangle a texel is in
  const bary = new Float32Array(n * 3);
  const I = body.indices, UV = body.uvs;
  const tris = I.length / 3, rows = height;
  const hideMask = new Uint8Array(n), planes = new Float32Array(n * 9), up = new Float32Array(n);
  const p = [0, 0, 0], nr = [0, 0, 0];
  let stage = 0;
  const job = { map: /** @type {any} */ (null), step };
  /** Triangles [t0, t1) laid out on the picture: each texel inside one takes it and its weights. */
  function raster(t0, t1) {
    for (let t = t0 * 3; t < t1 * 3; t += 3) {
      const ax = UV[I[t] * 2] * width, ay = (1 - UV[I[t] * 2 + 1]) * height;
      const bx = UV[I[t + 1] * 2] * width, by = (1 - UV[I[t + 1] * 2 + 1]) * height;
      const cx = UV[I[t + 2] * 2] * width, cy = (1 - UV[I[t + 2] * 2 + 1]) * height;
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(den) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
        const w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const i = y * width + x;
        own[i] = t; bary[i * 3] = w0; bary[i * 3 + 1] = w1; bary[i * 3 + 2] = w2;
      }
    }
  }
  /** One ring of the gutter: a texel outside every island takes its nearest inside neighbour's place. */
  function ring() {
    const was = own.slice(), wasB = bary.slice();
    for (let i = 0; i < n; i++) {
      if (was[i] >= 0) continue;
      const x = i % width, y = (i - x) / width;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (was[j] < 0) continue;
        own[i] = was[j]; bary[i * 3] = wasB[j * 3]; bary[i * 3 + 1] = wasB[j * 3 + 1]; bary[i * 3 + 2] = wasB[j * 3 + 2];
        break;
      }
    }
  }
  /** Rows [r0, r1) placed: each texel's bind position and normal between its triangle's corners, its faces, its height. */
  function place(r0, r1) {
    for (let i = r0 * width; i < r1 * width; i++) {
      const t = own[i];
      if (t < 0) continue;
      p[0] = p[1] = p[2] = nr[0] = nr[1] = nr[2] = 0;
      for (let k = 0; k < 3; k++) {
        const v = I[t + k], w = bary[i * 3 + k];
        for (let j = 0; j < 3; j++) { p[j] += w * body.positions[v * 3 + j]; nr[j] += w * body.normals[v * 3 + j]; }
      }
      const l = Math.hypot(nr[0], nr[1], nr[2]) || 1;
      nr[0] /= l; nr[1] /= l; nr[2] /= l;
      hideMask[i] = p[2] >= hide.crown ? 1 : 0;
      texelPlanes(p, nr, hide, planes, i * 9);
      up[i] = hide.height > 0 ? (p[2] - hide.crown) / hide.height : 1;
    }
  }
  function step() {
    if (job.map) return true;
    if (stage < 4) raster(Math.floor((tris * stage) / 4), Math.floor((tris * (stage + 1)) / 4));
    else if (stage < 4 + TEXEL_GUTTER) ring();
    else { const k = stage - 4 - TEXEL_GUTTER; place(Math.floor((rows * k) / 4), Math.floor((rows * (k + 1)) / 4)); }
    stage++;
    if (stage >= TEXEL_MAP_STEPS) job.map = { width, height, hide: hideMask, planes, up };
    return !!job.map;
  }
  return job;
}
const NEIGHBOURS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]);

/**
 * A picture's mip chain (`{ width, height, rgba }` a level, the first the picture), each level the 2x2 mean of the
 * one above - its colour weighted by its alpha, so a card's cut-out edge does not darken as it shrinks.
 */
export function rgbaMips(width, height, rgba) {
  const mips = [{ width, height, rgba: rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba) }];
  let w = width, h = height, src = mips[0].rgba;
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
    const out = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, a = 0, k = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy), o = (sy * w + sx) * 4;
        const al = src[o + 3];
        r += src[o] * al; g += src[o + 1] * al; b += src[o + 2] * al; a += al; k++;
      }
      const o = (y * nw + x) * 4;
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round(a / k);
    }
    mips.push({ width: nw, height: nh, rgba: out });
    w = nw; h = nh; src = out;
  }
  return mips;
}
