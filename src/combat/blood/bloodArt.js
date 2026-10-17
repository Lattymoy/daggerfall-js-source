// @ts-check
// BLOOD2b - THE PORT'S OWN BLOOD ART, GENERATED AT BOOT (2026-09-21,
// Mac: "make it even more visceral and detailed").
//
// BLOOD1a chose to wear the splash animation's settled frame for every
// mark, so the port shipped no blood picture. It still ships none: what
// this module makes is made here, from noise, the moment a host asks -
// an atlas of splat SHAPES in the blood-red family, five kinds in four
// variants, so a floor of marks is not one picture stamped six hundred
// times.
//
//   pool     - a broad irregular blob, darker at the heart; the drop
//              under the body
//   spatter  - a blob with satellite dots; cast-off that landed short,
//              and every mark on a wall's height
//   streak   - an elongated head with a tail toward +u; a drop that
//              flew, laid along its travel (BLOOD2a's `right`)
//   drip     - a bead high in the cell and a run down to the cell's
//              foot; a wall's mark, run by gravity
//   print    - a boot's print, heel at -u and toe at +u (BLOOD2d): what
//              a walker leaves for a few steps after treading in blood
//
// AND IT DRIES. A mark is born a fresh red with a little variance of
// its own and darkens over DRY_TIME to a brown that reads as old blood,
// in DRY_STAGES steps so the host rewrites each mark's slot a bounded
// number of times and never every frame.
//
// NO RENDERER, NO GL. This answers pixels and numbers; the pool uploads
// the atlas once through the renderer's cache and picks cells.

/** The port's own pseudo-archive for the atlas - far above any classic
 *  archive number, so the renderer's `archive_record` cache key cannot
 *  collide with ARENA2 art. */
export const BLOOD_ATLAS_ARCHIVE = 38001;
export const BLOOD_ATLAS_RECORD = 'marks';
// BLOOD4 (2026-09-22, Mac, with a shot of a room's wall: "youll notice
// in the screen shot the repetition of the wall splatter. I think we
// should introduce more variations").
//
// FOUR VARIANTS IS WHY. A wall mark is always the `drip` kind and
// always `turn: 0` - it has to be, because a run has to run DOWNWARD
// (bloodMarks' wall arm says so) - so a wall full of marks was drawing
// four pictures, upright, over and over. The floor hides it because
// spatter and streaks take their angle from the throw; a wall has no
// such freedom, so the repetition lands there first and hardest.
//
// The cell stays 64 texels - the shapes are drawn at that size and
// changing it would re-draw every one of them - so twice the variants
// is twice the sheet: 512 wide, still five rows tall. `pickCell`
// mirrors on top of this (see there), so a kind now shows 16 faces
// where it showed 4.
// BLOOD5: and 1024 - the cell is 128 texels now (see THE SHAPES ARE
// GROWN, below), eight variants still, so the sheet is 1024 x 640.
export const ATLAS_SIZE = 1024;
export const ATLAS_CELLS = 8;
/** The kinds, one row each; the variants across the row. */
export const ATLAS_KINDS = Object.freeze(['pool', 'spatter', 'streak', 'drip', 'print']);
/** BLOOD2d: a boot's print - heel and sole, the toe toward +u, the way
 *  the walker faces. Five rows now; the sheet is as tall as it needs. */
/** Fresh blood's colour: the family of TEXTURE.380's own red (the splash
 *  reads about 168,16,16), a shade deeper so a lit mark is not pink.
 *
 *  BLOOD AUDIT 4: THE ATLAS IS INK AND THE TINT IS THE COLOUR. BLOOD2b
 *  painted this red into the texels and tinted them toward a "dried
 *  brown-red" of 0.5/0.36/0.34 - a MULTIPLY, over a texel whose green
 *  was already a twelfth of its red. A multiply cannot raise a channel:
 *  the dried mark came out at HALF the brightness and MORE saturated
 *  (G/R 0.082 fresh, 0.059 dried), a black-red - which is "super dark
 *  instead of red" said a second way, and it landed on every mark
 *  older than three minutes for the rest of the session. So the texel
 *  holds the mark's SHAPE and GRAIN in white, and the vertex tint is
 *  the blood's colour outright: BLOOD_BASE fresh, DRIED_TINT dried,
 *  both real colours, both under one on every channel - which is also
 *  what keeps the lane's decode honest, since decode(ink) x decode(tint)
 *  is decode(ink x tint) only while both stay inside the curve. */
/** BLOOD4 (2026-09-22, Mac from a lit interior: "blood could be a tad
 *  bit darker"). The old colour was [0.58, 0.05, 0.04]; this is that
 *  colour times 0.81 on ALL THREE CHANNELS, which is a pure darkening
 *  and not a new red - G/R stays 0.085 where it was 0.086, so every
 *  law downstream that reads the hue (freshShade's factor, the dried
 *  stain's relationship to it) is untouched. A scale was the whole
 *  ask: "a tad darker" is a luminance note, and re-mixing the channels
 *  by eye would have answered a question nobody asked. */
export const BLOOD_BASE = Object.freeze([0.47, 0.04, 0.032]);
/** How much a fresh mark's tint wanders from the base - ALL THREE
 *  CHANNELS TOGETHER, so the variance is a shade of the same red and
 *  never a hue (BLOOD AUDIT 4: the red used to wander half as far as
 *  the rest, which made the darker marks the MORE saturated ones). */
export const FRESH_VARIANCE = 0.12;
/** Dried blood: the port's own rust brown, THE COLOUR ITSELF - about
 *  the fresh red's luminance, with the green and blue a dried stain
 *  has and a wet one does not. */
export const DRIED_TINT = Object.freeze([0.3, 0.13, 0.09, 1]);
/** Seconds from fresh to fully dried, and the steps it takes. */
export const DRY_TIME = 180;
export const DRY_STAGES = 8;
/** How often the pool looks for marks that crossed a stage (seconds). */
export const DRY_TICK = 2;

/** A deterministic generator (mulberry32) so the atlas is the same
 *  picture on every boot and a pin can name a pixel. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (edge0, edge1, x) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A wobble table: `n` samples around the circle, interpolated. */
function wobble(rng, n = 12, amount = 0.2) {
  const tbl = Array.from({ length: n }, () => (rng() * 2 - 1) * amount);
  return (angle) => {
    const f = ((angle / (Math.PI * 2)) % 1 + 1) % 1 * n;
    const i = Math.floor(f), t = f - i;
    return tbl[i % n] * (1 - t) + tbl[(i + 1) % n] * t;
  };
}

// ── BLOOD5: THE SHAPES ARE GROWN, NOT STAMPED ────────────────────
// (2026-09-30, Mac, with a shot of a corpse ringed by a perfect
// starburst: "the blood splatter is too perfect of a circle ... more
// variety, and less perfect patterns ... AAA grade").
//
// BLOOD2b's pool was a circle with a twelve-sample wobble on its
// radius and its spatter the same circle with dots scattered on a
// ring, at sixty-four texels a cell. Rotated and mirrored they were
// still, every one of them, a round thing - and a floor of round
// things laid on an even turn is the starburst in the shot. So:
//
//   THE CELL IS 128 TEXELS (ATLAS_SIZE 1024) - a droplet a metre of
//     floor away is a few texels, and at 64 it was one;
//   VALUE NOISE, fractal and domain-warped, roughens every edge, so a
//     rim is ragged at every scale and never a wobble of one period;
//   A POOL IS SEVERAL BLOBS MELTED TOGETHER (a smooth minimum), with
//     fingers where it ran and satellite drops where it splashed;
//   A SPATTER IS DIRECTIONAL - a core, tendrils thrown out in one or
//     two clusters ending in beads, and a fine mist on the side the
//     tendrils went - because an impact throws blood somewhere, not
//     everywhere;
//   A STREAK IS A TEARDROP that curves as it thins, sheds a line of
//     droplets past its tail, and crowns behind its head.

/** The noise lattice's side (it wraps), and the texels a cell is. */
export const NOISE_SIZE = 64;

/** A seeded value-noise sampler: `n(x, y)` in about -1..1, smooth, and
 *  `fbm(x, y, octaves)` its fractal sum - one lattice for the sheet, a
 *  cell reads it at its own offset so no two cells share a grain. */
export function bloodNoise(rng) {
  const N = NOISE_SIZE, g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = rng() * 2 - 1;
  const n = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ix & (N - 1), x1 = (ix + 1) & (N - 1), y0 = (iy & (N - 1)) * N, y1 = ((iy + 1) & (N - 1)) * N;
    const a = g[y0 + x0] + (g[y0 + x1] - g[y0 + x0]) * sx;
    const b = g[y1 + x0] + (g[y1 + x1] - g[y1 + x0]) * sx;
    return a + (b - a) * sy;
  };
  const fbm = (x, y, octaves = 3) => {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (let o = 0; o < octaves; o++) { sum += n(x * f + o * 17.3, y * f - o * 9.1) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  };
  return { n, fbm };
}

/** A smooth minimum: two distances melted together over `k`, which is
 *  what makes blobs that touch read as one pool rather than two. */
export function smin(a, b, k) {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

/** Distance to a TAPERED run from (ax, ay) at half-width ra to (bx, by)
 *  at rb - a capsule whose ends differ, which is a tendril, a finger
 *  and a streak's body alike. */
export function taperDist(x, y, ax, ay, ra, bx, by, rb) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return len(x - (ax + dx * t), y - (ay + dy * t)) - (ra + (rb - ra) * t);
}

const TAU = Math.PI * 2;
/** `Math.hypot` of two, without its generality - this runs per texel. */
const len = (x, y) => Math.sqrt(x * x + y * y);
/** A normal deviate from two uniforms (Box-Muller), clamped so a
 *  generator that answers 0 or 1 still answers a number. */
export const gaussOf = (u1, u2) => Math.sqrt(-2 * Math.log(Math.max(1e-6, 1 - u1))) * Math.cos(TAU * u2);
/** How far inside the edge answers full thickness, per kind - the
 *  heart of the shape. */
const DEPTH_REACH = Object.freeze({ pool: 0.42, spatter: 0.2, streak: 0.19 });
/** The noise on an edge, in cell units (a cell is 2 across). */
const EDGE_ROUGH = 0.07;
/** Turn a field into the cell's `{ a, depth }`: coverage from the
 *  signed distance with a texel-wide soft edge, thickness from how far
 *  inside it is. `aa` is a texel and a half in cell units. */
const FIELD = { a: 0, depth: 0 };   // one answer, rewritten per texel - the build reads it before the next
const fromField = (sdf, reach, aa) => {
  FIELD.a = sdf >= aa ? 0 : 1 - smooth(-aa, aa, sdf);
  FIELD.depth = sdf >= 0 ? 0 : Math.pow(Math.min(1, -sdf / reach), 0.8);
  return FIELD;
};
/** The edge's grain: the fractal at two scales, and the whole point
 *  warped by a third, so a rim is ragged at every size. */
function roughen(noise, ox, oy) {
  const out = { wx: 0, wy: 0, edge: 0 };   // rewritten per texel, read at once
  return (x, y) => {
    const wx = x + 0.09 * noise.fbm(x * 2.1 + ox, y * 2.1 + oy, 2);
    const wy = y + 0.09 * noise.fbm(x * 2.1 + oy + 31.7, y * 2.1 + ox - 12.4, 2);
    out.wx = wx; out.wy = wy; out.edge = EDGE_ROUGH * noise.fbm(wx * 4.3 + ox, wy * 4.3 + oy, 3);
    return out;
  };
}
/** A run's bounding circle, so a texel far from it skips the run: a
 *  primitive further than a smooth minimum's `k` past the nearest so far
 *  cannot change it. */
const bound = (t) => ({ ...t, cx: (t.ax + t.bx) / 2, cy: (t.ay + t.by) / 2, br: len(t.bx - t.ax, t.by - t.ay) / 2 + Math.max(t.ra, t.rb) });
const meltRun = (d, x, y, t, k) => (len(x - t.cx, y - t.cy) - t.br > d + k ? d : smin(d, taperDist(x, y, t.ax, t.ay, t.ra, t.bx, t.by, t.rb), k));
/** How far outside a shape's smooth body the warp and the edge noise
 *  can still reach (0.09 of warp, 0.07 of edge, and room): past it a
 *  texel is empty without asking the noise, which is most of a cell. */
const ROUGH_REACH = 0.2;
/** Keep a primitive inside the cell's clear border (the frame is at
 *  +-1; the border and the soft edge take the rest). */
const INSIDE = 0.86;
const clampIn = (v, r) => Math.max(-INSIDE + r, Math.min(INSIDE - r, v));

function poolField(rng, noise) {
  const ox = rng() * 64, oy = rng() * 64;
  const rough = roughen(noise, ox, oy);
  const main = { x: (rng() - 0.5) * 0.12, y: (rng() - 0.5) * 0.12, r: 0.38 + rng() * 0.1 };
  // the lobes it spread into - a pool finds the floor's low side
  const lobes = Array.from({ length: 2 + Math.floor(rng() * 4) }, () => {
    const ang = rng() * TAU, d = 0.22 + rng() * 0.22, r = 0.14 + rng() * 0.15;
    return { x: clampIn(main.x + Math.cos(ang) * d, r), y: clampIn(main.y + Math.sin(ang) * d, r), r };
  });
  // fingers where it ran, thinning to a point
  const fingers = Array.from({ length: Math.floor(rng() * 3) }, () => {
    const ang = rng() * TAU, from = main.r * 0.7, to = main.r + 0.18 + rng() * 0.2;
    return bound({ ax: main.x + Math.cos(ang) * from, ay: main.y + Math.sin(ang) * from, ra: 0.07 + rng() * 0.04,
      bx: clampIn(main.x + Math.cos(ang) * to, 0.03), by: clampIn(main.y + Math.sin(ang) * to, 0.03), rb: 0.015 + rng() * 0.02 });
  });
  // satellites where it splashed - clustered on one side
  const side = rng() * TAU;
  const sats = Array.from({ length: 3 + Math.floor(rng() * 8) }, () => {
    const ang = side + gaussOf(rng(), rng()) * 0.9, d = 0.6 + rng() * 0.26, r = 0.015 + Math.pow(rng(), 2) * 0.05;
    return { x: clampIn(Math.cos(ang) * d, r), y: clampIn(Math.sin(ang) * d, r), r };
  });
  const body = (wx, wy) => {
    let d = len(wx - main.x, wy - main.y) - main.r;
    for (const l of lobes) d = smin(d, len(wx - l.x, wy - l.y) - l.r, 0.12);
    for (const f of fingers) d = meltRun(d, wx, wy, f, 0.06);
    return d;
  };
  return (x, y) => {
    let d = body(x, y);
    if (d < ROUGH_REACH) { const { wx, wy, edge } = rough(x, y); d = body(wx, wy) + edge; }
    for (const s of sats) d = Math.min(d, len(x - s.x, y - s.y) - s.r);
    return fromField(d, DEPTH_REACH.pool, 0.024);
  };
}

function spatterField(rng, noise) {
  const ox = rng() * 64, oy = rng() * 64;
  const rough = roughen(noise, ox, oy);
  const core = { x: (rng() - 0.5) * 0.1, y: (rng() - 0.5) * 0.1, r: 0.2 + rng() * 0.08 };
  const blobs = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => {
    const ang = rng() * TAU, d = core.r * (0.5 + rng() * 0.6), r = core.r * (0.4 + rng() * 0.4);
    return { x: core.x + Math.cos(ang) * d, y: core.y + Math.sin(ang) * d, r };
  });
  // ONE OR TWO DIRECTIONS the impact threw it, and every tendril and
  // most of the mist goes one of them
  const aims = [rng() * TAU];
  if (rng() < 0.45) aims.push(aims[0] + (rng() < 0.5 ? -1 : 1) * (1.2 + rng() * 1.6));
  const aimAt = () => aims[Math.floor(rng() * aims.length) % aims.length];
  const tendrils = Array.from({ length: 3 + Math.floor(rng() * 7) }, () => {
    const ang = aimAt() + gaussOf(rng(), rng()) * 0.5;
    const len = core.r + 0.18 + Math.pow(rng(), 0.7) * 0.45;
    const bx = clampIn(core.x + Math.cos(ang) * len, 0.05), by = clampIn(core.y + Math.sin(ang) * len, 0.05);
    const bead = 0.025 + rng() * 0.045;
    const gap = rng() < 0.4 ? 0.03 + rng() * 0.06 : 0;   // some beads broke off the end of their run
    return bound({ ax: core.x + Math.cos(ang) * core.r * 0.5, ay: core.y + Math.sin(ang) * core.r * 0.5, ra: 0.05 + rng() * 0.04,
      bx, by, rb: 0.008 + rng() * 0.012,
      beadX: clampIn(bx + Math.cos(ang) * (bead + gap), bead), beadY: clampIn(by + Math.sin(ang) * (bead + gap), bead), bead });
  });
  const mist = Array.from({ length: 18 + Math.floor(rng() * 40) }, () => {
    const ang = (rng() < 0.8 ? aimAt() + gaussOf(rng(), rng()) * 0.7 : rng() * TAU);
    const d = core.r + 0.1 + Math.pow(rng(), 0.6) * 0.6, r = 0.009 + Math.pow(rng(), 2.5) * 0.03;
    return { x: clampIn(core.x + Math.cos(ang) * d, r), y: clampIn(core.y + Math.sin(ang) * d, r), r };
  });
  const body = (wx, wy) => {
    let d = len(wx - core.x, wy - core.y) - core.r;
    for (const b of blobs) d = smin(d, len(wx - b.x, wy - b.y) - b.r, 0.08);
    for (const t of tendrils) d = meltRun(d, wx, wy, t, 0.05);
    return d;
  };
  return (x, y) => {
    let d = body(x, y);
    if (d < ROUGH_REACH) { const { wx, wy, edge } = rough(x, y); d = body(wx, wy) + edge * 0.7; }
    for (const t of tendrils) d = Math.min(d, len(x - t.beadX, y - t.beadY) - t.bead);
    for (const m of mist) { const dx = x - m.x, dy = y - m.y; if (dx * dx + dy * dy < 0.01) d = Math.min(d, len(dx, dy) - m.r); }
    return fromField(d, DEPTH_REACH.spatter, 0.022);
  };
}

function streakField(rng, noise) {
  const ox = rng() * 64, oy = rng() * 64;
  const rough = roughen(noise, ox, oy);
  // the head at -u where the drop struck, the tail thinning toward +u
  const hx = -0.55 + (rng() - 0.5) * 0.08, hr = 0.2 + rng() * 0.07;
  const end = 0.5 + rng() * 0.3, bend = (rng() - 0.5) * 0.3;
  const yAt = (t) => bend * t * t;   // it curves as it slows
  const SEG = 5;
  const body = Array.from({ length: SEG }, (_, k) => {
    const t0 = k / SEG, t1 = (k + 1) / SEG;
    const x0 = hx + (end - hx) * t0, x1 = hx + (end - hx) * t1;
    return bound({ ax: x0, ay: yAt(t0), ra: hr * 0.8 * (1 - t0 * 0.9), bx: x1, by: yAt(t1), rb: hr * 0.8 * (1 - t1 * 0.9) });
  });
  // the line of droplets it shed past its tail, each smaller
  const trail = Array.from({ length: 1 + Math.floor(rng() * 4) }, (_, k) => {
    const t = 1.08 + k * (0.07 + rng() * 0.06), r = Math.max(0.01, 0.035 * (1 - k * 0.2) * (0.6 + rng() * 0.6));
    return { x: clampIn(hx + (end - hx) * t, r), y: clampIn(yAt(Math.min(1.4, t)) + (rng() - 0.5) * 0.04, r), r };
  });
  // and the crown behind the head, where the impact splashed back
  const crown = Array.from({ length: 2 + Math.floor(rng() * 5) }, () => {
    const ang = Math.PI + gaussOf(rng(), rng()) * 0.8, d = hr + 0.03 + rng() * 0.12, r = 0.012 + rng() * 0.025;
    return { x: clampIn(hx + Math.cos(ang) * d, r), y: clampIn(Math.sin(ang) * d, r), r };
  });
  const run = (wx, wy) => {
    let d = len((wx - hx) * 0.95, wy * 1.08) - hr;
    for (const b of body) d = meltRun(d, wx, wy, b, 0.06);
    return d;
  };
  return (x, y) => {
    let d = run(x, y);
    if (d < ROUGH_REACH) { const { wx, wy, edge } = rough(x, y); d = run(wx, wy) + edge * 0.6; }
    for (const t of trail) d = Math.min(d, len(x - t.x, y - t.y) - t.r);
    for (const c of crown) d = Math.min(d, len(x - c.x, y - c.y) - c.r);
    return fromField(d, DEPTH_REACH.streak, 0.022);
  };
}

/**
 * One cell's mask and DEPTH: answers `{ a, depth }` for a point in cell
 * space (x, y in -1..1, y up) - `a` the coverage, `depth` how much
 * blood stands there, 1 at the heart of a pool and 0 at its thinnest.
 *
 * AUDIT BLOOD3 F1: this used to answer a `shade`, a grey darkening
 * toward the heart, and BLOOD3 then read that channel as a DENSITY -
 * which is the same quantity with the sign reversed, so the film
 * brightened exactly the texels the art had darkened and erased most
 * of the depth cue it was written to add. The art owns which end of a
 * shape is deep; it says so here, in the one unit a film can use, and
 * the shading is the film's job now (see INK_DEPTH).
 */
function shapeAt(kind, rng, noise) {
  // BLOOD5: the pool, the spatter and the streak are SIGNED DISTANCE
  // fields now - blobs, tapered runs and droplets joined by a smooth
  // minimum and roughened by value noise (see `bloodNoise`) - where
  // BLOOD2b drew each as one wobbled circle. Their thickness is how far
  // inside the edge a texel sits, so every rim feathers to nothing and
  // every heart is deep, whatever the shape grew into.
  if (kind === 'pool') return poolField(rng, noise);
  if (kind === 'spatter') return spatterField(rng, noise);
  if (kind === 'streak') return streakField(rng, noise);
  if (kind === 'print') {
    // a boot: a heel disc at -u, a longer sole at +u, a waist between,
    // a little ragged so no two prints are the same stamp
    const w = wobble(rng, 10, 0.12);
    const toeX = 0.32 + rng() * 0.12, heelX = -0.5 - rng() * 0.08;
    return (x, y) => {
      const ang = Math.atan2(y, x);
      const heel = 1 - smooth(0.2, 0.28, len((x - heelX) * 1.1, y * 1.35) * (1 + w(ang)));
      const sole = 1 - smooth(0.3, 0.38, len((x - toeX) * 0.75, y * 1.15) * (1 + w(ang + 1)));
      const waist = x > heelX && x < toeX ? 1 - smooth(0.16, 0.22, Math.abs(y) * (1 + 0.6 * Math.abs((x - (heelX + toeX) / 2) / ((toeX - heelX) / 2)))) : 0;
      return { a: Math.max(heel, sole, waist), depth: 1 - smooth(heelX, toeX, x) };
    };
  }
  // drip: a bead high in the cell and a run down to its foot.
  //
  // BLOOD4 - AND IT HAS TO BE A DIFFERENT DRIP EACH TIME. The cell
  // count went from four to eight for Mac's "repetition of the wall
  // splatter", and measuring the result said the count was never the
  // whole problem: the eight cells came out at IoU 0.96 against each
  // other - the same picture eight times - because this shape had
  // exactly TWO degrees of freedom, the run's length and its edge
  // wobble. Bead, column and foot were fixed. Doubling a constant
  // cannot vary a shape that does not vary.
  //
  // So the freedoms below are the ones a real run on a wall has, and
  // each is a thing you can see:
  //   WHERE THE BEAD STRUCK, off the cell's centre line and its own
  //     size - a spurt does not land in the middle of its own mark;
  //   WHETHER IT RAN AT ALL - a bead that hit dry stone and stayed a
  //     bead is a third of them, and it is the single biggest break in
  //     the "every mark has a tail" sameness;
  //   HOW FAR, over a wider range than before;
  //   THE DRIFT - a run wanders as it falls, it does not plumb-line;
  //     the foot follows it, because that is where the blood ended up;
  //   A SECOND RUN, thinner and shorter, where the bead split.
  const w = wobble(rng, 6, 0.25);
  const beadX = (rng() * 2 - 1) * 0.12;   // modest: the bead is the mark's deep end, and it stays near the cell's own centre line so the run has room to wander either way
  const beadR = 0.22 + rng() * 0.14;
  const ran = rng() > 0.32;                       // a third of them never ran
  const runTo = ran ? -0.9 + rng() * 0.75 : 0.5;  // 0.5 == no run at all
  const drift = (rng() * 2 - 1) * 0.22;           // where the run wanders to by its foot
  const width = 0.06 + rng() * 0.06;
  const forked = ran && rng() < 0.35;
  const forkX = (rng() * 2 - 1) * 0.16;
  const forkTo = runTo * (0.35 + rng() * 0.3);
  const forkW = width * (0.4 + rng() * 0.25);
  /** One run: its alpha at (x, y) and how far down it that point is. */
  const trail = (x, y, fromX, toY, halfW, wob) => {
    if (!(y < 0.5 && y > toY)) return { a: 0, along: -1 };
    const along = (0.5 - y) / (0.5 - toY);
    const cx = fromX + drift * along * along;     // squared: it wanders more as it slows
    const half = halfW * (1 - 0.6 * along) * (1 + (wob ? w(along * Math.PI * 2) : 0)) + 0.015;
    return { a: 1 - smooth(half - 0.03, half + 0.02, Math.abs(x - cx)), along };
  };
  const footX = beadX + drift;
  return (x, y) => {
    const rBead = len((x - beadX) * 1.2, (y - 0.5) * 0.9);
    const rFoot = len(x - footX, y - runTo);
    const bead = 1 - smooth(beadR, beadR + 0.1, rBead);
    const main = trail(x, y, beadX, runTo, width, true);
    const fork = forked ? trail(x, y, beadX + forkX, forkTo, forkW, false) : { a: 0, along: -1 };
    // the foot is the bead of blood that gathered at the end of the run
    const foot = ran ? 1 - smooth(0.06, 0.11, rFoot) : 0;
    const a = Math.max(bead, main.a, fork.a, foot);
    // THE THICKNESS, which is NOT the alpha (AUDIT BLOOD3 F1's law: the
    // sheet's ink is an invertible encoding of this, and BLOOD3's film
    // reads it back). Deep at the bead, falling ALONG the run, and
    // deep again at the foot where the blood gathered.
    //
    // A DROP IS A DOME, and that is what makes a bead-only cell legal:
    // its alpha ends at a hard rim, but its THICKNESS feathers to
    // nothing just inside that rim, so even a mark that never ran has
    // the full range of film across it. The first cut of this took the
    // depth from the run alone, which gave the bead, the foot and
    // every pixel of a no-run cell a thickness of ZERO - the deep end
    // inside out. The BLOOD3 depth pin caught it in one line.
    const dBead = 1 - smooth(beadR * 0.2, beadR + 0.02, rBead);
    const dFoot = ran ? (1 - smooth(0.02, 0.1, rFoot)) * 0.45 : 0;   // gathered, so thicker than the run above it - but never the bead's equal
    const dRun = main.a > 0 ? 1 - main.along : (fork.a > 0 ? (1 - fork.along) * 0.85 : 0);
    return { a, depth: Math.max(0, Math.min(1, Math.max(dBead, dFoot, dRun))) };
  };
}

/**
 * Build the atlas: `cells` x `cells` squares over a `size` x `size`
 * RGBA sheet, one kind per ROW, the variants across it. Every cell keeps
 * a clear two-texel border so a bilinear sample near a cell's edge
 * cannot read its neighbour, and the cell's UV rect is inset by one
 * texel for the same reason.
 *
 * @returns {{ colors: Uint8ClampedArray, width: number, height: number,
 *   cells: Array<{ kind: string, u0: number, v0: number, u1: number, v1: number }> }}
 */
const EMPTY = Object.freeze({ a: 0, depth: 0 });
export function buildBloodAtlas(opts = {}) {
  const b = atlasBuilder(opts);
  while (!b.step());
  return b.atlas;
}

/**
 * BLOOD5: THE SAME BUILD, A CELL AT A TIME. The 128-texel sheet is
 * about four times the work of the 64-texel one (a couple of hundred
 * milliseconds), and BLOOD AUDIT 4 already moved the old seventy off
 * the boot path onto the first mark - where a quarter of a second is a
 * hitch in the middle of a fight. So the build is a sequence of steps
 * a host can run in the page's idle time (`prewarmBloodAtlas`); the
 * rng is drawn in the same order either way, so the sheet is the same
 * picture to the byte however it was stepped. `step()` answers true
 * once the sheet is whole.
 */
export function atlasBuilder({ size = ATLAS_SIZE, cells = ATLAS_CELLS, seed = 0x5EED, rng = null } = {}) {
  const roll = rng ?? mulberry32(seed);
  const noise = bloodNoise(roll);   // BLOOD5: one lattice for the sheet
  const cell = size / cells;
  const rows = ATLAS_KINDS.length;   // BLOOD2d: one row a kind - the sheet is `size` wide and `rows` cells tall
  const height = cell * rows;
  const colors = new Uint8ClampedArray(size * height * 4);
  const out = [];
  const BORDER = 2;
  const atlas = { colors, width: size, height, cells: out };
  let next = 0;
  const total = rows * cells;
  function step() {
    if (next >= total) return true;
    const row = Math.floor(next / cells), col = next % cells;
    next++;
    const kind = ATLAS_KINDS[row];
    {
      const at = shapeAt(kind, roll, noise);
      // BLOOD5: the grain is the noise's too - clotting, at two scales,
      // where it was a wobble around the cell's centre
      const gx = roll() * 64, gy = roll() * 64;
      const x0 = col * cell, y0 = row * cell;
      for (let py = 0; py < cell; py++) {
        for (let px = 0; px < cell; px++) {
          const inBorder = px < BORDER || py < BORDER || px >= cell - BORDER || py >= cell - BORDER;
          const x = ((px + 0.5) / cell) * 2 - 1, y = ((py + 0.5) / cell) * 2 - 1;
          const { a, depth } = inBorder ? EMPTY : at(x, y);
          const g = inBorder || !(a > 0) ? 1 : 1 + 0.1 * noise.fbm(x * 7 + gx, y * 7 + gy, 2) + 0.05 * noise.n(x * 23 + gy, y * 23 + gx);
          const o = ((y0 + py) * size + (x0 + px)) * 4;
          // BLOOD AUDIT 4: white ink - the shape and its grain; the colour
          // is the tint's (see BLOOD_BASE).
          // AUDIT BLOOD3 F1: and the ink is now EXACTLY `1 - INK_DEPTH *
          // thickness`, thickness being the shape's depth with the grain
          // riding in it. It keeps the range and the sense it always had
          // (0.82 at the heart, 1 at the thinnest), so the lens - which
          // draws this sheet through the plain 2D quad and has no film -
          // is unchanged to the byte. But it is now INVERTIBLE, so the
          // decal shaders can recover the thickness the film needs from
          // the one channel the sheet can spare.
          const thick = Math.max(0, Math.min(1, depth * g));
          const ink = Math.round(255 * (1 - INK_DEPTH * thick));
          colors[o] = ink; colors[o + 1] = ink; colors[o + 2] = ink;
          colors[o + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
        }
      }
      out.push({
        kind,
        u0: (x0 + 1) / size, v0: (y0 + 1) / height,
        u1: (x0 + cell - 1) / size, v1: (y0 + cell - 1) / height,
      });
    }
    return next >= total;
  }
  return { step, atlas, done: () => next >= total };
}

/** The one atlas every pool shares, built on first ask - and BLOOD5,
 *  finished on first ask from wherever an idle prewarm left it. */
let _atlas = null;
let _builder = null;
export function bloodAtlas() {
  if (_atlas) return _atlas;
  _builder ??= atlasBuilder();
  while (!_builder.step());
  _atlas = _builder.atlas;
  _builder = null;
  return _atlas;
}
/** BLOOD5: build the shared sheet in the page's idle time, a few cells
 *  a slice, so the first mark finds it made. `idle` is the scheduler
 *  (the browser's requestIdleCallback); without one this does nothing
 *  and the first mark builds it, as before. Answers whether it started. */
export function prewarmBloodAtlas(idle = globalThis.requestIdleCallback) {
  if (_atlas || _builder || typeof idle !== 'function') return false;
  _builder = atlasBuilder();
  const slice = (deadline) => {
    if (_atlas || !_builder) return;
    do { if (_builder.step()) { _atlas = _builder.atlas; _builder = null; return; } }
    while ((deadline?.timeRemaining?.() ?? 0) > 6);
    idle(slice);
  };
  idle(slice);
  return true;
}

/** BLOOD5: THE DROPLET a spray carries through the air (bloodMarks'
 *  flight) - its own record beside the atlas's, drawn through the
 *  billboard pass, which is a CUTOUT: no soft edge, so the shape is in
 *  the alpha and the roundness is in the colour. A bead, a shade taller
 *  than wide with a tail up (a falling drop pulls into a teardrop), dark
 *  at the rim, the blood's red through the body and one small glint
 *  high on the side the light is usually on. */
export const BLOOD_DROP_RECORD = 'drop';
export const DROP_ART_SIZE = 16;
let _droplet = null;
export function bloodDropletArt() {
  if (_droplet) return _droplet;
  const N = DROP_ART_SIZE, colors = new Uint8ClampedArray(N * N * 4);
  const base = BLOOD_BASE.map((c) => c * 255);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const x = ((px + 0.5) / N) * 2 - 1, y = ((py + 0.5) / N) * 2 - 1;   // y DOWN the image: py 0 is the top
      // a bead in the lower two thirds and a tail narrowing up to a point
      const bead = Math.sqrt(x * x / 0.36 + (y - 0.22) * (y - 0.22) / 0.42);
      const tail = y < 0.22 ? Math.abs(x) / Math.max(0.001, 0.6 * (y + 0.85) / 1.07) : 99;
      const inside = bead <= 1 || (tail <= 1 && y > -0.85);
      const o = (py * N + px) * 4;
      if (!inside) continue;
      const rim = Math.min(1, bead);
      const shade = 1.15 - 0.55 * rim * rim;
      const glint = Math.max(0, 1 - Math.hypot(x + 0.22, y - 0.02) / 0.2);
      for (let c = 0; c < 3; c++) colors[o + c] = Math.round(Math.min(255, base[c] * shade + glint * [150, 95, 85][c]));
      colors[o + 3] = 255;
    }
  }
  return (_droplet = { colors, width: N, height: N });
}

/** A cell of `kind`, chosen by the caller's chance. */
export function pickCell(atlas, kind, rng = Math.random) {
  const of = atlas.cells.filter((c) => c.kind === kind);
  if (!of.length) return atlas.cells[0] ?? null;
  const c = of[Math.min(of.length - 1, Math.floor(rng() * of.length))];
  // BLOOD4: AND HALF OF THEM FACE THE OTHER WAY. Swapping u0 and u1
  // mirrors the cell left-for-right, which doubles every kind's faces
  // for no sheet at all - and it is the one reflection that is free of
  // consequences here:
  //   a DRIP still runs downward (the mirror is horizontal, gravity is
  //     vertical - this is exactly why the wall marks can take it);
  //   a PRINT becomes the other foot, which is a gain;
  //   a STREAK's head stays its head and only the side it flew to
  //     changes, and the quad's own `right` already came off the
  //     throw, so the two compose rather than fight.
  // The atlas's own cell objects are NEVER mutated - a mirrored pick
  // is a new object, because the cells are shared by every mark and a
  // swap in place would flip marks already on the wall.
  return rng() < 0.5 ? { ...c, u0: c.u1, u1: c.u0 } : c;
}

/** Which kind a mark is: the pool under the body, a streak that flew, a
 *  wall's run, a walker's print (BLOOD2d), or spatter. */
export function bloodMarkKind({ pool = false, wall = false, print = false, stretch = 1 } = {}) {
  if (pool) return 'pool';
  if (wall) return 'drip';
  if (print) return 'print';
  return stretch > 1.5 ? 'streak' : 'spatter';
}

// ── BLOOD3: THE MARK IS A FILM, NOT A STICKER ────────────────────
// (2026-09-21, Mac: "I think the blood is too shiny and flat.")
//
// BOTH faults were one line of the decal shader each.
//
// FLAT. The albedo was `ink * tint` - and the ink is WHITE, so every
// texel of a pool came out the same red. A real mark is not a coloured
// shape, it is a FILM of an absorbing liquid over a surface, and what
// your eye reads as depth is that the thin part passes light and the
// deep part does not. Blood absorbs green and blue far harder than
// red, so a smear's thin edge is a bright scarlet and its body a deep
// maroon going to black. The law is Beer-Lambert, anchored at the deep
// end so a full-thickness mark does not move: `tint * exp(ABSORB * (1
// - thick))`. At thick = 1 the factor is exactly 1.
//
// AND THE THICKNESS HAS TO BE A THICKNESS. BLOOD3 shipped reading it
// off the atlas's ink, which was a grey SHADE - a darkening toward the
// heart of a pool. That is the same quantity with the sign reversed:
// the film then brightened hardest exactly where the art had darkened,
// erasing three quarters of the pool's own depth cue and tipping its
// heart toward pink. Three audit lenses found it independently; the
// probe never saw it, because no test in the slice fed a real atlas
// texel to the law. The fix is at the source: `shapeAt` answers a
// DEPTH, the sheet stores `1 - INK_DEPTH * (depth * grain)`, and the
// shader inverts that one line. The ink keeps the range and the sense
// it always had, so the lens - which draws this sheet through the
// plain 2D quad, with no film - is untouched; but the decal no longer
// multiplies by the ink at all. The grey darkening WAS the film, done
// by hand in one channel; the film does it now, per channel, properly.
//
// SHINY. The wet glint was EL_WET_STRENGTH (0.9) of the light's colour
// wherever the half-vector lined up, at ANY angle and with no Fresnel -
// the look of wet plastic sheeting, not of a liquid. A water film
// reflects about 2% head-on and nearly all of it at a graze, so Schlick
// belongs on it. But Schlick for a SPECULAR lobe is F(V.H), not
// F(N.V): BLOOD3 shipped the latter, which peaks in a different regime
// from the (N.H)^64 lobe it multiplies, and the two together took the
// case the player sees most - a mark underfoot, torch at head height -
// down by 82x. That is not "less shiny", it is "not wet". So: F(V.H),
// per light, beside its own half-vector; and the cue that actually
// reads as wet head-on is not a highlight at all but a DARKENING - a
// wet surface is darker and richer than a dry one, because the light
// goes into the film before it comes back. WET_DARKEN carries that,
// and the sheen is left to do what a sheen does, at the graze.

/** BLOOD3: the per-channel gain toward a THIN film - red passes, green
 *  and blue are absorbed. At full thickness the gain is exactly 1, so
 *  this only ever brightens a rim; it never darkens what was there. */
export const BLOOD_ABSORB = Object.freeze([0.50, 0.95, 0.95]);
/** AUDIT BLOOD3 F3: the same film for the CLASSIC set, whose decal
 *  shader has no decode and no encode - it works in display space from
 *  end to end. A gain of G applied to an encoded value shows as G, not
 *  as G^(1/2.2), so the same constant in both lanes made a mark's thin
 *  rim up to 1.7x brighter under the classic set than under the lane.
 *  The exponent divided by the display gamma is the same picture. */
export const DISPLAY_GAMMA = 2.2;
export const BLOOD_ABSORB_ENCODED = Object.freeze(BLOOD_ABSORB.map((a) => a / DISPLAY_GAMMA));
/** AUDIT BLOOD3 F1: how deep the atlas's ink ramp runs. The sheet
 *  stores `1 - INK_DEPTH * thickness`, so the ink sits in
 *  [1 - INK_DEPTH, 1] - the range and the sense the hand-painted shade
 *  always had, which is why the lens did not move - and a shader
 *  recovers the thickness exactly: `(1 - ink) / INK_DEPTH`. One ramp
 *  for every shape, because a per-kind amplitude is not invertible. */
export const INK_DEPTH = 0.18;
/** AUDIT BLOOD3 F5: how far a WET mark darkens. This, not the glint, is
 *  what reads as wet when you are standing over it: light enters the
 *  film and comes back attenuated, so a wet surface is darker and more
 *  saturated than the same surface dry. A Fresnel specular without it
 *  is a highlight nobody can see. */
export const WET_DARKEN = 0.72;
/** BLOOD3: a water film's reflectance head-on (Schlick's F0 for n =
 *  1.33). The display curve lifts a small linear glint a long way, so
 *  the difference between this and a glass-like 0.04 is the difference
 *  between a sheen and a shine on the case the player sees most - a
 *  mark on the floor, underfoot, viewed almost straight down. */
export const BLOOD_F0 = 0.02;
/** BLOOD3: where a mark's rim has dried and where it is still wet.
 *  AUDIT BLOOD3 F6: these bite now. Against the old ink the gate sat
 *  above 0.93 over 93-97% of every mark and the "wet core, dry rim"
 *  was never delivered; against a real depth the band is the full
 *  0..1, so a rim at 0.15 is dry and a heart at 0.75 is wet. */
export const WET_THICK_LO = 0.15;
export const WET_THICK_HI = 0.75;
/** BLOOD3: how far the rim's shoulder tilts the surface normal - the
 *  meniscus, off the thickness gradient, so a pool has a lit edge. */
export const BLOOD_MENISCUS = 0.85;

/** BLOOD3: the film's colour at a thickness - the shader's own law, in
 *  JS, so a pin can drive it rather than read it. `thick` is coverage
 *  times the ink's recovered depth (see `filmThickness`); `tint` the
 *  mark's full-thickness colour, which is what it answers at 1. */
export function filmColour(tint, thick) {
  const d = 1 - Math.max(0, Math.min(1, thick));
  return [0, 1, 2].map((i) => (tint?.[i] ?? 0) * Math.exp(BLOOD_ABSORB[i] * d));
}

/**
 * BLOOD3 / AUDIT BLOOD3 F1: THE THICKNESS IS COVERAGE TIMES DEPTH,
 * and the depth has to be READ OUT of the ink rather than taken for
 * it. Alpha alone will not do: alpha is also what the mark is blended
 * by, so exactly where the film says "thin, bright" the mark is fading
 * out, and where the mark is solid the law has nothing left to say.
 * The ink carries the other half - but it carries it as `1 - INK_DEPTH
 * * thickness`, a darkening, which is the thickness INVERTED. BLOOD3
 * read it as a density and so ran the film backwards over every shape
 * in the sheet. Inverting it here is the whole fix, and it is exact:
 * the sheet is written by `buildBloodAtlas` from this same constant.
 *
 * @param {number} alpha the atlas's coverage
 * @param {number} ink the atlas's ink, 1 at the thinnest
 */
export const filmThickness = (alpha, ink) =>
  Math.max(0, Math.min(1, alpha)) * Math.max(0, Math.min(1, (1 - Math.max(0, Math.min(1, ink))) / INK_DEPTH));

/** BLOOD3: how much of a mark is WET at a fragment - its wetness,
 *  gated on its own depth so a dried rim does not shine while the
 *  heart still does. This is the whole of the angle-free half of the
 *  sheen; the angle is `wetFresnel`, per light, below. */
export function wetGate(wet, thick) {
  if (!(wet > 0)) return 0;
  const t = Math.max(0, Math.min(1, thick));
  const x = Math.max(0, Math.min(1, (t - WET_THICK_LO) / Math.max(1e-6, WET_THICK_HI - WET_THICK_LO)));
  return Math.max(0, Math.min(1, wet)) * (x * x * (3 - 2 * x));   // smoothstep, the shader's own
}

/** AUDIT BLOOD3 F5: Schlick for a SPECULAR lobe, which is F(V.H) and
 *  not F(N.V). `vdoth` is the cosine between the eye and the light's
 *  own half-vector - so the term belongs beside the lobe it scales,
 *  once per light, and not hoisted out in front of all of them. */
export function wetFresnel(vdoth) {
  return BLOOD_F0 + (1 - BLOOD_F0) * Math.pow(1 - Math.max(0, Math.min(1, vdoth)), 5);
}

/** BLOOD3: the sheen at a fragment for one light - the gate times the
 *  angle. Kept as one call so a pin can drive the product the shader
 *  forms. */
export const wetSheen = (wet, thick, vdoth) => wetGate(wet, thick) * wetFresnel(vdoth);

/** AUDIT BLOOD3 F5: how much a wet mark DARKENS - the cue that reads as
 *  wet head-on, where a Fresnel specular has nothing to give. */
export const wetAlbedo = (wet) => 1 - (1 - WET_DARKEN) * Math.max(0, Math.min(1, wet));

/** A fresh mark's tint: the blood's red, a shade darker by the roll -
 *  one factor on all three channels, so it is a shade and not a hue. */
export function freshTint(rng = Math.random) {
  const k = 1 - rng() * FRESH_VARIANCE;
  return [BLOOD_BASE[0] * k, BLOOD_BASE[1] * k, BLOOD_BASE[2] * k, 1];
}

/** The shade a fresh tint was rolled at: its red over the base's, since
 *  a fresh tint is the base by one factor. Anything else (a tint a pin
 *  made up) is shade one. */
export function freshShade(fresh) {
  const k = BLOOD_BASE[0] > 0 ? (fresh?.[0] ?? BLOOD_BASE[0]) / BLOOD_BASE[0] : 1;
  return k >= 1 - FRESH_VARIANCE - 1e-9 && k <= 1 + 1e-9 ? k : 1;
}

/** BLOOD2f: HOW WET a mark is at a stage - one fresh, zero dried, and
 *  the sheen goes BEFORE the colour: fresh blood loses its gloss in
 *  the first minutes and its red over the rest, so the wetness falls
 *  as the square of what is left. */
export const WET_POWER = 2;
export function wetAt(stage) {
  const t = Math.max(0, Math.min(1, (Number.isFinite(stage) ? stage : 0) / DRY_STAGES));
  return Math.pow(1 - t, WET_POWER);
}

/** How dried a mark of `age` seconds is, in DRY_STAGES steps: 0 fresh,
 *  DRY_STAGES fully dried. */
export function dryStage(age) {
  if (!(age > 0)) return 0;
  return Math.min(DRY_STAGES, Math.floor((age / DRY_TIME) * DRY_STAGES));
}

/** The tint at a stage: the fresh tint sliding to DRIED_TINT at the
 *  mark's own shade (BLOOD AUDIT 4: a mark rolled darker dries darker -
 *  the variance is the mark's for life, not the wet half of it). */
export function driedTint(fresh, stage) {
  const t = Math.max(0, Math.min(1, stage / DRY_STAGES));
  const k = freshShade(fresh);
  const end = [DRIED_TINT[0] * k, DRIED_TINT[1] * k, DRIED_TINT[2] * k];
  if (t >= 1) return [end[0], end[1], end[2], fresh[3] ?? 1];   // dried is DRIED, to the bit - not a mix that lands a rounding error off it
  return [
    fresh[0] + (end[0] - fresh[0]) * t,
    fresh[1] + (end[1] - fresh[1]) * t,
    fresh[2] + (end[2] - fresh[2]) * t,
    fresh[3] ?? 1,
  ];
}
