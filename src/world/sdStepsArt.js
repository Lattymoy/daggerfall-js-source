// @ts-check
// SD7b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE STEPS' ART - what the
// Unmoored Steps wear (the realm's own pseudo-archive, world/sdRealm.js SD_REALM_ARCHIVE), made in code: nothing ships,
// the same pixels every boot. Each `{ albedo, emission }` in the renderer's color32 shape - RGBA rows, row 0 the
// texture's v 0 (a top's near edge, -z; a side's top edge).
//
// SD-LOOK S9 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 8): A DRAW ATLAS A KIND, painted through
// the Hour's paint box (world/sdPixelKit.js) from its ramps (world/sdLook.js) - top, sides, the gold line under the rim,
// the chamfer and the underside in one 128x64 record (SD_STEPS_ATLAS), so each step is one draw - and each kind reads
// at a glance from across the void:
//
//   drift   - a brass deck: a riveted rim round a field of dark tread-plate, the two rods' eyelets at its x edges
//   riser   - plain basalt courses over a brass rack-channel, its top the Hour's flags, its lip the brightest gold
//   beat    - a clock-plate whose ONE HAND sweeps back to XII across its solid 2.4 s: twelve frames (a twelfth of a turn
//             each - 0.2 s, motion, never a flash), the ticks still ahead of the hand lit gold (the time it holds), an
//             ember sector from XII to II that the hand enters for its last 0.4 s (its frames 10 and 11, ember), and the
//             last frame again with its light faltered (SD_STEPS_RECORD.falter - the warning's one falter at 2.5 Hz)
//   crumble - cracked basalt, the void's furnace light in its cracks: at rest dim, then three stages as a foot lands,
//             the cracks flaring and widening (SD_CRACK_STAGES); its two main cracks (SD_CRUMBLE_CRACKS) are where it
//             breaks into four chunks (world/sdStepsModel.js buildCrumbleChunks)
//   parts   - the pendulums' rods and gears, the waystones (their rune lit, or dark - two records), the vane, the grit
//
// Light only where it means something: the gold line under every rim (L2 - the course a dotted path of light from the
// hall), a Beat's ticks and hand (L3 - it holds), ember on what is about to fail. Metal and stone do not glow.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_RAMP, SD_LIGHT } from './sdLook.js';
import { image, putTexel, scale, ramp, step, bevel, rivet, rng, noiseField, paletteOf, quantize } from './sdPixelKit.js';
import { SD_DRIFT_SIZE, SD_BEAT_SIZE, SD_CRUMBLE_SIZE } from './sdSteps.js';

/** THE RECORDS: SD7b's two kept (the Crumble's rest, the Beat's first frame), then SD-LOOK S9's after the Hour's others. */
export const SD_STEPS_RECORD = Object.freeze({
  drift: 60,
  riser: 61,
  /** The Beat's twelve frames, the hand at each twelfth (frame 0 at XII, the whole turn ahead). */
  beat: Object.freeze([22, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]),
  /** The last frame, its light faltered. */
  falter: 73,
  /** The Crumble at rest, then its three stages under a foot. */
  crumble: Object.freeze([21, 74, 75, 76]),
  /** The parts: the waystone's rune lit, and dark. */
  parts: 77,
  partsDark: 78,
});
export const SD_STEPS_CRACKED_RECORD = SD_STEPS_RECORD.crumble[0];
export const SD_STEPS_BEAT_RECORD = SD_STEPS_RECORD.beat[0];
/** The Beat's frames from the ember on (the hand in its ember sector - its last 0.4 s), and the sector's span (hours). */
export const SD_BEAT_EMBER_FRAME = 10;
export const SD_BEAT_EMBER_HOURS = 2;

/** The atlas: its size and its cells ([x, y, w, h] texels, y from the first row). A riser's sides are tall, so its own. */
export const SD_STEPS_ATLAS = Object.freeze({
  w: 128, h: 64,
  top: Object.freeze([0, 0, 64, 64]),
  side: Object.freeze([64, 0, 64, 16]),
  line: Object.freeze([64, 16, 64, 4]),
  bevel: Object.freeze([64, 20, 64, 4]),
  under: Object.freeze([64, 24, 64, 40]),
});
export const SD_RISER_ATLAS = Object.freeze({
  w: 128, h: 64,
  top: Object.freeze([0, 0, 64, 64]),
  side: Object.freeze([64, 0, 64, 52]),
  line: Object.freeze([64, 52, 64, 4]),
  bevel: Object.freeze([64, 56, 64, 4]),
  under: Object.freeze([64, 60, 64, 4]),
});
/** The parts' atlas cells. */
export const SD_PARTS_ATLAS = Object.freeze({
  w: 64, h: 64,
  rod: Object.freeze([0, 0, 8, 64]),
  gear: Object.freeze([8, 0, 24, 24]),
  rim: Object.freeze([8, 24, 24, 8]),
  stone: Object.freeze([32, 0, 16, 32]),
  rune: Object.freeze([48, 0, 16, 32]),
  cap: Object.freeze([32, 32, 16, 16]),
  vane: Object.freeze([48, 32, 16, 16]),
  grit: Object.freeze([8, 32, 8, 8]),
  dark: Object.freeze([16, 32, 16, 16]),
});
/** A step's chamfer round its top and bottom edges (m) and the gold line under it - the art's tops are the inset rest. */
export const SD_STEP_BEVEL = 0.06;
export const SD_STEP_LINE = 0.05;

const { basalt: Ba, brass: Br, verdigris: Vg, void: Vo, bronze: Bz } = SD_RAMP;
const PALETTE = paletteOf(Ba, Br, Vg, Vo, Bz);
const GOLD = SD_LIGHT.gold.map((v) => Math.round(v * 255));
const EMBER = SD_LIGHT.ember.map((v) => Math.round(v * 255));
const BLACK = Object.freeze([0, 0, 0]);
/** The lights' rungs (emission shares of their colour): the rim line (L2), a signal (L3), a crack at each stage. */
export const SD_STEPS_GLOW = Object.freeze({ line: 0.5, lip: 0.65, tick: 1, hand: 1, falter: 0.12, sector: 0.1, crack: Object.freeze([0.18, 0.35, 0.55, 0.85]), rune: 0.8 });

/** Paint a rectangle texel by texel: `fn(s, t, x, y)` its colour - s, t 0..1 across the cell, x, y the image's texel. */
function fill(img, cell, fn) {
  const [x0, y0, w, h] = cell;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn((x + 0.5) / w, (y + 0.5) / h, x0 + x, y0 + y); if (c) putTexel(img, x0 + x, y0 + y, c); }
}
/** A top's texel in metres of its own face: (x, z) from its centre - the top's inset (the chamfer round it) - +z far. */
const topMetres = (kind, s, t) => {
  const size = kind === 'drift' ? SD_DRIFT_SIZE : kind === 'crumble' ? SD_CRUMBLE_SIZE : SD_BEAT_SIZE;
  return [(s - 0.5) * (size.w - 2 * SD_STEP_BEVEL), (t - 0.5) * (size.d - 2 * SD_STEP_BEVEL)];
};
/** The pieces every kind shares: the gold line (its light `k` of `col`), the chamfer's rubbed brass.
 *  @param {import('./sdPixelKit.js').Img} albedo @param {import('./sdPixelKit.js').Img} emission @param {typeof SD_STEPS_ATLAS | typeof SD_RISER_ATLAS} A @param {ReadonlyArray<number>} [col] @param {number} [k] */
function paintRim(albedo, emission, A, col = GOLD, k = SD_STEPS_GLOW.line) {
  fill(albedo, A.line, (s, t, x, y) => (t < 0.5 ? step(Br, 5) : step(Br, 4)));
  fill(emission, A.line, (s, t) => scale(col, t < 0.5 ? k : k * 0.7));
  fill(albedo, A.bevel, (s, t, x, y) => ramp(Br, 0.62 + 0.25 * (1 - t), x, y));
}
/** A brass band down a side: rivets on its middle, darker below, verdigris in the seam at its foot. */
function paintBrassSide(albedo, A, seed) {
  const g = noiseField(seed, 8, A.w, A.h);
  fill(albedo, A.side, (s, t, x, y) => ramp(Br, 0.42 - 0.3 * t + 0.12 * g(x, y), x, y));
  const [x0, y0, w, h] = A.side;
  for (let x = 0; x < w; x++) { putTexel(albedo, x0 + x, y0, step(Br, 4)); putTexel(albedo, x0 + x, y0 + h - 1, step(Vg, 1)); }
  for (let x = 4; x < w; x += 8) rivet(albedo, x0 + x, y0 + Math.floor(h / 2), step(Br, 3), step(Br, 0), step(Br, 5));
}

/** THE DRIFT: a brass deck - its riveted rim, a field of dark tread-plate (a diamond every 6 texels), the rods' eyelets. */
export function driftArt(seed = 0x5d90) {
  const A = SD_STEPS_ATLAS, albedo = image(A.w, A.h), emission = image(A.w, A.h), g = noiseField(seed, 8, A.w, A.h);
  fill(albedo, A.top, (s, t, x, y) => {
    const e = Math.min(x, y, 63 - x, 63 - y);
    if (e < 5) return ramp(Br, 0.5 + 0.2 * g(x, y) + (e === 0 ? 0.3 : e === 4 ? -0.25 : 0), x, y);   // the rim, its inner edge dark
    const dx = ((x % 6) + 6) % 6 - 2.5, dy = ((y + 3 * (Math.floor(x / 6) & 1)) % 6) - 2.5;
    const raised = Math.abs(dx) + Math.abs(dy) < 2.2;   // a tread's diamond
    return raised ? ramp(Bz, 0.55 + 0.2 * g(x, y), x, y) : ramp(Bz, 0.2 + 0.15 * g(x, y), x, y);
  });
  for (let k = 0; k < 8; k++) { const p = 4 + k * 8; rivet(albedo, p, 2, step(Br, 4), step(Br, 1), step(Br, 5)); rivet(albedo, p, 61, step(Br, 4), step(Br, 1), step(Br, 5)); rivet(albedo, 2, p, step(Br, 4), step(Br, 1), step(Br, 5)); rivet(albedo, 61, p, step(Br, 4), step(Br, 1), step(Br, 5)); }
  for (const ex of [5, 58]) fill(albedo, [ex - 4, 28, 9, 9], (s, t, x, y) => { const r = Math.hypot(s - 0.5, t - 0.5); return r < 0.2 ? step(Vo, 0) : r < 0.5 ? step(Br, r < 0.32 ? 5 : 3) : null; });   // the eyelets
  paintBrassSide(albedo, A, seed + 1);
  paintRim(albedo, emission, A);
  fill(albedo, A.under, (s, t, x, y) => (Math.abs(s - 0.5) < 0.06 || Math.abs(t - 0.5) < 0.08 ? ramp(Br, 0.3, x, y) : ramp(Br, 0.08 + 0.1 * g(x, y), x, y)));   // two struts crossed under it
  return { albedo: quantize(albedo, PALETTE), emission };
}

/** A RISER: plain basalt courses (16 x 8 texels, dark mortar) over a brass rack-channel; its top the Hour's flags in a brass
 *  frame; its lip the brightest gold of the course - "run up here". */
export function riserArt(seed = 0x5d91) {
  const A = SD_RISER_ATLAS, albedo = image(A.w, A.h), emission = image(A.w, A.h), g = noiseField(seed, 8, A.w, A.h), r = rng(seed);
  const shade = Array.from({ length: 64 }, () => r());
  fill(albedo, A.top, (s, t, x, y) => {
    const e = Math.min(x, y, 63 - x, 63 - y);
    if (e < 3) return ramp(Br, 0.45 + (e === 0 ? 0.3 : 0), x, y);
    const fx = (x - 3) % 29, fy = (y - 3) % 29;
    if (fx === 0 || fy === 0) return step(Ba, 0);   // the flags' joints
    return ramp(Ba, 0.35 + 0.35 * shade[(Math.floor((x - 3) / 29) * 3 + Math.floor((y - 3) / 29)) & 63] + 0.1 * g(x, y), x, y);
  });
  const [sx0, sy0, sw, sh] = A.side;
  fill(albedo, A.side, (s, t, x, y) => {
    const lx = x - sx0, ly = y - sy0, row = Math.floor(ly / 8), off = (row & 1) * 8, bx = (lx + off) % 16, by = ly % 8;
    if (Math.abs(lx - sw / 2 + 0.5) < 10) return Math.abs(lx - sw / 2 + 0.5) > 8 ? step(Br, 1) : ramp(Br, 0.12 + 0.08 * g(x, y), x, y);   // the rack's channel
    if (bx === 0 || by === 7) return step(Ba, 0);
    return ramp(Ba, 0.3 + 0.4 * shade[(row * 5 + Math.floor((lx + off) / 16) * 3) & 63] + (by === 0 ? 0.15 : 0), x, y);
  });
  paintRim(albedo, emission, A, GOLD, SD_STEPS_GLOW.lip);
  fill(albedo, A.under, (s, t, x, y) => step(Ba, 1));
  return { albedo: quantize(albedo, PALETTE), emission };
}

/** Distance from (px, py) to the segment a-b. */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
/** An hour's place round a dial: its clockwise angle from XII (radians) as the eye sees it from above, XII at +z (far),
 *  III at +x - the camera's one mirror (world/mat4.js mirrorProjectionX) puts +x on the right facing +z. */
export const hourAngle = (x, z) => { const a = Math.atan2(x, z); return a < 0 ? a + Math.PI * 2 : a; };
/** The Beat's dial (m, the plate's own): the bezel's radii, the ticks' band, the hand's reach, the hub. */
export const SD_BEAT_DIAL = Object.freeze({ bezel0: 1.04, bezel1: 1.18, tick0: 0.7, tick1: 0.95, tickW: 0.11, hand: 0.9, handW: 0.07, hub: 0.14 });
/** Where frame `k`'s hand stands: its clockwise angle from XII (a whole turn at frame 0 - the time it holds - back to I at
 *  frame 11: the hand runs BACK to twelve, anticlockwise as the eye sees it). */
export const beatHandAngle = (k) => ((12 - k) / 12) * Math.PI * 2;
/** Whether frame `k` lights hour `h` (1..11): the ticks still ahead of the hand on its way back to XII. */
export const beatTickLit = (k, h) => h >= 1 && h < 12 - k;

/** A BEAT frame `k` (0..11), or the last with its light faltered: the clock-plate. */
export function beatArt(k = 0, faltered = false, seed = 0x5d92) {
  const A = SD_STEPS_ATLAS, albedo = image(A.w, A.h), emission = image(A.w, A.h), g = noiseField(seed, 8, A.w, A.h), D = SD_BEAT_DIAL;
  const ember = k >= SD_BEAT_EMBER_FRAME, col = ember ? EMBER : GOLD, f = faltered ? SD_STEPS_GLOW.falter / SD_STEPS_GLOW.tick : 1;
  const ha = beatHandAngle(k), hx = Math.sin(ha), hz = Math.cos(ha), sector = (SD_BEAT_EMBER_HOURS / 12) * Math.PI * 2;
  fill(albedo, A.top, (s, t, x, y) => {
    const [mx, mz] = topMetres('beat', s, t), r = Math.hypot(mx, mz), a = hourAngle(mx, mz);
    const e = Math.min(x, y, 63 - x, 63 - y);
    let c = ramp(Br, 0.1 + 0.12 * g(x, y), x, y);   // the plate, dark - its lit ticks the read
    if (e < 2) c = step(Br, e === 0 ? 4 : 1);
    if (r > D.bezel0 && r < D.bezel1) c = step(Br, r < D.bezel0 + 0.05 ? 5 : r > D.bezel1 - 0.04 ? 1 : 4);   // the bezel
    else if (r < D.bezel0 && r > D.tick0 - 0.08 && a < sector) c = ramp(Vo, 0.62, x, y);   // the ember sector, inlaid
    const h = Math.round((a / (Math.PI * 2)) * 12) % 12, ta = (h / 12) * Math.PI * 2, along = mx * Math.sin(ta) + mz * Math.cos(ta), across = mx * Math.cos(ta) - mz * Math.sin(ta);
    if (along > D.tick0 && along < D.tick1 && Math.abs(across) < D.tickW / 2 * (h === 0 ? 1.8 : 1)) c = step(Br, h === 0 ? 5 : beatTickLit(k, h) ? 5 : 1);   // the ticks, XII wide
    if (r < D.hub) c = r < D.hub * 0.45 ? step(Br, 5) : step(Br, 0);
    const hal = mx * hx + mz * hz, hac = Math.abs(mx * hz - mz * hx);
    if (hal > 0 && hal < D.hand && hac < D.handW / 2 + (hal > D.hand * 0.55 && hal < D.hand * 0.8 ? 0.05 : 0)) c = step(Br, 5);   // the hand, its spade
    return c;
  });
  fill(emission, A.top, (s, t) => {
    const [mx, mz] = topMetres('beat', s, t), r = Math.hypot(mx, mz), a = hourAngle(mx, mz);
    if (r < D.hub) return BLACK;   // the hub's pin: brass, never a light
    const hal = mx * hx + mz * hz, hac = Math.abs(mx * hz - mz * hx);
    if (hal > 0 && hal < D.hand && hac < D.handW / 2 + (hal > D.hand * 0.55 && hal < D.hand * 0.8 ? 0.05 : 0)) return scale(col, SD_STEPS_GLOW.hand * f);
    const h = Math.round((a / (Math.PI * 2)) * 12) % 12, ta = (h / 12) * Math.PI * 2, along = mx * Math.sin(ta) + mz * Math.cos(ta), across = mx * Math.cos(ta) - mz * Math.sin(ta);
    if (along > D.tick0 && along < D.tick1 && Math.abs(across) < D.tickW / 2 * (h === 0 ? 1.8 : 1)) return h === 0 ? scale(GOLD, 0.3 * f) : beatTickLit(k, h) ? scale(col, SD_STEPS_GLOW.tick * f) : BLACK;
    if (r < D.bezel0 && r > D.tick0 - 0.08 && a < sector) return scale(EMBER, SD_STEPS_GLOW.sector * (ember ? 2.5 * f : 1));
    return BLACK;
  });
  paintBrassSide(albedo, A, seed + 1);
  paintRim(albedo, emission, A, col, SD_STEPS_GLOW.line * f);
  fill(albedo, A.under, (s, t, x, y) => ramp(Br, 0.1 + 0.12 * g(x, y), x, y));
  return { albedo: quantize(albedo, PALETTE), emission };
}

/** THE CRUMBLE'S TWO MAIN CRACKS (m, the step's own top, from its centre): one across x, one along z, crossing near its
 *  middle (`at`), each from edge to edge - where it breaks into four (world/sdStepsModel.js buildCrumbleChunks) - and
 *  five short branches the art alone draws. From a fixed seed: the same stone every boot. */
export const SD_CRUMBLE_CRACKS = (() => {
  const r = rng(0x5d7b), W = SD_CRUMBLE_SIZE.w / 2, D = SD_CRUMBLE_SIZE.d / 2, j = (k) => (r() - 0.5) * k;
  const at = Object.freeze([j(0.5), j(0.5)]);
  const run = (from, to, n, wob) => { const pts = [from]; for (let i = 1; i < n; i++) { const u = i / n; pts.push([from[0] + (to[0] - from[0]) * u + wob[0] * j(1),from[1] + (to[1] - from[1]) * u + wob[1] * j(1)]); } pts.push(to); return pts; };
  // across: -x edge -> at -> +x edge, wandering in z; along: -z edge -> at -> +z edge, wandering in x
  const ax = j(1.2), bx = j(1.2), az = j(1.2), bz = j(1.2);
  const across = [...run([-W, az], at, 3, [0, 0.35]), ...run(at, [W, bz], 3, [0, 0.35]).slice(1)];
  const along = [...run([ax, -D], at, 3, [0.35, 0]), ...run(at, [bx, D], 3, [0.35, 0]).slice(1)];
  const branches = [];
  for (let k = 0; k < 5; k++) {
    const src = (k & 1 ? across : along)[1 + (k % 3)], a = r() * Math.PI * 2, L = 0.25 + r() * 0.3;
    branches.push(Object.freeze([Object.freeze(src.slice()), Object.freeze([src[0] + Math.cos(a) * L, src[1] + Math.sin(a) * L])]));
  }
  const fz = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));
  return Object.freeze({ at, across: fz(across), along: fz(along), branches: Object.freeze(branches) });
})();
/** The crack stages: how wide (m) each crack's lit heart and its dark lip run at rest and at each stage under a foot. */
export const SD_CRACK_STAGES = Object.freeze([
  Object.freeze({ core: 0.022, lip: 0.06, branch: false }),
  Object.freeze({ core: 0.035, lip: 0.075, branch: false }),
  Object.freeze({ core: 0.05, lip: 0.095, branch: true }),
  Object.freeze({ core: 0.07, lip: 0.12, branch: true }),
]);
/** Distance (m) from a point of the Crumble's top to its main cracks, and to its branches. */
export function crackDistance(x, z) {
  let main = Infinity, branch = Infinity;
  for (const pts of [SD_CRUMBLE_CRACKS.across, SD_CRUMBLE_CRACKS.along]) for (let j = 1; j < pts.length; j++) main = Math.min(main, segDist(x, z, pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1]));
  for (const [a, b] of SD_CRUMBLE_CRACKS.branches) branch = Math.min(branch, segDist(x, z, a[0], a[1], b[0], b[1]));
  return [main, branch];
}
/** A CRUMBLE at stage `n` (0 at rest, 1-3 under a foot): cracked basalt, the void's furnace light in its cracks. */
export function crumbleArt(n = 0, seed = 0x5d93) {
  const A = SD_STEPS_ATLAS, albedo = image(A.w, A.h), emission = image(A.w, A.h), g = noiseField(seed, 6, A.w, A.h), S = SD_CRACK_STAGES[n];
  const k = SD_STEPS_GLOW.crack[n], col = n >= 2 ? EMBER : scale(EMBER, 1), hot = SD_RAMP.void[4];
  const crack = (mx, mz) => { const [m, b] = crackDistance(mx, mz); const d = S.branch ? Math.min(m, b * 1.4) : Math.min(m, b * 2.2); return d; };
  fill(albedo, A.top, (s, t, x, y) => {
    const [mx, mz] = topMetres('crumble', s, t), d = crack(mx, mz), e = Math.min(x, y, 63 - x, 63 - y);
    if (d < S.core) return [...hot];
    if (d < S.lip) return step(Ba, 0);
    if (e === 0) return step(Ba, 3);
    return ramp(Ba, 0.28 + 0.35 * g(x, y), x, y);
  });
  fill(emission, A.top, (s, t) => { const [mx, mz] = topMetres('crumble', s, t), d = crack(mx, mz); return d < S.core ? scale(col, k) : d < S.lip ? scale(col, k * 0.18) : BLACK; });
  // the sides: basalt strata, the main cracks running down where they meet the edges
  const [x0, y0, w, h] = A.side;
  fill(albedo, A.side, (s, t, x, y) => ramp(Ba, 0.22 + 0.25 * g(x, y * 3) + (y - y0 === 0 ? 0.25 : 0), x, y));
  for (const pts of [SD_CRUMBLE_CRACKS.across, SD_CRUMBLE_CRACKS.along]) for (const p of [pts[0], pts[pts.length - 1]]) {
    const u = Math.abs(Math.abs(p[0]) - SD_CRUMBLE_SIZE.w / 2) < 1e-6 ? (p[1] / SD_CRUMBLE_SIZE.d + 0.5) : (p[0] / SD_CRUMBLE_SIZE.w + 0.5);
    const cx = x0 + Math.round(u * (w - 1));
    for (let yy = 0; yy < h; yy++) { const wob = Math.round(Math.sin(yy * 1.7 + cx) * 0.8); putTexel(albedo, cx + wob, y0 + yy, [...hot]); putTexel(emission, cx + wob, y0 + yy, scale(col, k * (1 - yy / h))); }
  }
  paintRim(albedo, emission, A, n >= 3 ? EMBER : GOLD, SD_STEPS_GLOW.line);
  fill(albedo, A.under, (s, t, x, y) => ramp(Ba, 0.1 + 0.2 * g(x, y), x, y));
  return { albedo: quantize(albedo, PALETTE), emission };
}
/** SD7b's name for the Crumble's top, kept: its rest. */
export const crackedArt = () => crumbleArt(0);

/** THE PARTS: a rod's brass, a gear's face and rim, a waystone's basalt, its brass cap and its rune (lit gold, or dark),
 *  the vane's brass, the grit's stone. */
export function partsArt(lit = true, seed = 0x5d94) {
  const P = SD_PARTS_ATLAS, albedo = image(P.w, P.h), emission = image(P.w, P.h), g = noiseField(seed, 8, P.w, P.h);
  fill(albedo, P.rod, (s, t, x, y) => step(Br, s < 0.3 ? 4 : s < 0.7 ? 3 : 1));
  fill(albedo, P.gear, (s, t, x, y) => { const r = Math.hypot(s - 0.5, t - 0.5); return r < 0.12 ? step(Br, 0) : r < 0.18 ? step(Br, 4) : Math.abs(((Math.atan2(s - 0.5, t - 0.5) / Math.PI) * 3 + 6) % 1 - 0.5) < 0.12 && r < 0.42 ? step(Br, 1) : ramp(Br, 0.45 + 0.2 * g(x, y), x, y); });
  fill(albedo, P.rim, (s, t, x, y) => step(Br, t < 0.3 ? 5 : 3));
  fill(albedo, P.stone, (s, t, x, y) => (Math.floor(t * 8) !== Math.floor((t - 1 / 32) * 8) ? step(Ba, 0) : ramp(Ba, 0.35 + 0.3 * g(x, y), x, y)));
  fill(albedo, P.rune, (s, t, x, y) => ramp(Ba, 0.3 + 0.25 * g(x, y), x, y));
  // the rune: the Hour's hand in its ring - a ring, and a spade hand pointing up from its hub
  const rune = (s, t) => { const r = Math.hypot(s - 0.5, (t - 0.55) * 0.5); return (r > 0.32 && r < 0.42) || (Math.abs(s - 0.5) < 0.08 && t > 0.5 && t < 0.66) || (Math.abs(s - 0.5) < 0.2 - (t - 0.66) * 1.6 && t >= 0.66 && t < 0.76); };
  fill(albedo, P.rune, (s, t) => (rune(s, t) ? step(Br, lit ? 5 : 2) : null));
  fill(emission, P.rune, (s, t) => (rune(s, t) && lit ? scale(GOLD, SD_STEPS_GLOW.rune) : BLACK));
  fill(albedo, P.cap, (s, t, x, y) => ramp(Br, 0.5 + 0.3 * (1 - t), x, y));
  bevel(albedo, P.cap[0], P.cap[1], P.cap[2], P.cap[3], step(Br, 5), step(Br, 1));
  fill(albedo, P.vane, (s, t, x, y) => ramp(Br, 0.55 + 0.25 * g(x, y), x, y));
  fill(albedo, P.grit, (s, t, x, y) => step(Ba, (x + y) & 1 ? 3 : 2));
  fill(albedo, P.dark, (s, t, x, y) => step(Br, 0));
  return { albedo: quantize(albedo, PALETTE), emission };
}

/** Every colour a Steps' picture may wear (the law's own check: world/sdPixelKit.js offPalette). */
export const SD_STEPS_PALETTE = PALETTE;

/** Every picture the Steps wear, by record: `[record, { albedo, emission }]`.
 * @returns {Array<[number, { albedo: import('./sdPixelKit.js').Img, emission: import('./sdPixelKit.js').Img }]>} */
export function stepsArt() {
  const R = SD_STEPS_RECORD;
  /** @type {Array<[number, { albedo: import('./sdPixelKit.js').Img, emission: import('./sdPixelKit.js').Img }]>} */
  const out = [[R.crumble[0], crumbleArt(0)], [R.beat[0], beatArt(0)]];
  out.push([R.drift, driftArt()], [R.riser, riserArt()]);
  for (let k = 1; k < 12; k++) out.push([R.beat[k], beatArt(k)]);
  out.push([R.falter, beatArt(11, true)]);
  for (let n = 1; n < 4; n++) out.push([R.crumble[n], crumbleArt(n)]);
  out.push([R.parts, partsArt(true)], [R.partsDark, partsArt(false)]);
  return out;
}
