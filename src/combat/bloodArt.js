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
export const ATLAS_SIZE = 256;
export const ATLAS_CELLS = 4;
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
export const BLOOD_BASE = Object.freeze([0.58, 0.05, 0.04]);
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

/**
 * One cell's mask and shade: answers `{ a, shade }` for a point in cell
 * space (x, y in -1..1, y up), a the coverage and shade a darkening
 * toward the heart of a pool.
 */
function shapeAt(kind, rng, bits) {
  if (kind === 'pool') {
    const w = wobble(rng, 14, 0.22);
    return (x, y) => {
      const r = Math.hypot(x, y), ang = Math.atan2(y, x);
      const edge = 0.78 * (1 + w(ang));
      return { a: 1 - smooth(edge - 0.1, edge + 0.05, r), shade: 0.82 + 0.18 * smooth(0, edge, r) };
    };
  }
  if (kind === 'spatter') {
    const w = wobble(rng, 10, 0.3);
    const dots = Array.from({ length: 6 + Math.floor(rng() * 5) }, () => {
      const ang = rng() * Math.PI * 2, d = 0.5 + rng() * 0.42;
      return { x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: 0.05 + rng() * 0.11 };
    });
    return (x, y) => {
      const r = Math.hypot(x, y), ang = Math.atan2(y, x);
      const edge = 0.42 * (1 + w(ang));
      let a = 1 - smooth(edge - 0.08, edge + 0.04, r);
      for (const d of dots) a = Math.max(a, 1 - smooth(d.r - 0.03, d.r + 0.03, Math.hypot(x - d.x, y - d.y)));
      return { a, shade: 0.9 + 0.1 * smooth(0, edge, r) };
    };
  }
  if (kind === 'streak') {
    const w = wobble(rng, 8, 0.18);
    const beads = Array.from({ length: 3 + Math.floor(rng() * 3) }, () => ({ x: 0.2 + rng() * 0.7, y: (rng() * 2 - 1) * 0.12, r: 0.04 + rng() * 0.07 }));
    return (x, y) => {
      // the head at -u, the tail thinning toward +u
      const t = (x + 0.85) / 1.75;            // 0 at the head, 1 at the tail's end
      const half = 0.3 * (1 - 0.8 * Math.max(0, t)) * (1 + w(t * Math.PI * 2)) + 0.02;
      let a = x < -0.85 || x > 0.9 ? 0 : 1 - smooth(half - 0.06, half + 0.03, Math.abs(y));
      const head = 1 - smooth(0.3, 0.42, Math.hypot(x + 0.55, y * 1.15));
      a = Math.max(a, head);
      for (const b of beads) a = Math.max(a, 1 - smooth(b.r - 0.02, b.r + 0.02, Math.hypot(x - b.x, y - b.y)));
      return { a, shade: 0.88 + 0.12 * t };
    };
  }
  if (kind === 'print') {
    // a boot: a heel disc at -u, a longer sole at +u, a waist between,
    // a little ragged so no two prints are the same stamp
    const w = wobble(rng, 10, 0.12);
    const toeX = 0.32 + rng() * 0.12, heelX = -0.5 - rng() * 0.08;
    return (x, y) => {
      const ang = Math.atan2(y, x);
      const heel = 1 - smooth(0.2, 0.28, Math.hypot((x - heelX) * 1.1, y * 1.35) * (1 + w(ang)));
      const sole = 1 - smooth(0.3, 0.38, Math.hypot((x - toeX) * 0.75, y * 1.15) * (1 + w(ang + 1)));
      const waist = x > heelX && x < toeX ? 1 - smooth(0.16, 0.22, Math.abs(y) * (1 + 0.6 * Math.abs((x - (heelX + toeX) / 2) / ((toeX - heelX) / 2)))) : 0;
      return { a: Math.max(heel, sole, waist), shade: 0.9 + 0.1 * smooth(heelX, toeX, x) };
    };
  }
  // drip: a bead high in the cell and a run down to its foot
  const w = wobble(rng, 6, 0.25);
  const runTo = -0.85 + rng() * 0.3;
  return (x, y) => {
    const bead = 1 - smooth(0.24, 0.34, Math.hypot(x * 1.2, (y - 0.5) * 0.9));
    const along = y < 0.5 && y > runTo ? (0.5 - y) / (0.5 - runTo) : -1;
    const half = along < 0 ? 0 : 0.09 * (1 - 0.6 * along) * (1 + w(along * Math.PI * 2)) + 0.015;
    const run = along < 0 ? 0 : 1 - smooth(half - 0.03, half + 0.02, Math.abs(x));
    const foot = 1 - smooth(0.07, 0.12, Math.hypot(x, y - runTo));
    return { a: Math.max(bead, run, foot), shade: 0.85 + 0.15 * Math.max(0, along) };
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
export function buildBloodAtlas({ size = ATLAS_SIZE, cells = ATLAS_CELLS, seed = 0x5EED, rng = null } = {}) {
  const roll = rng ?? mulberry32(seed);
  const cell = size / cells;
  const rows = ATLAS_KINDS.length;   // BLOOD2d: one row a kind - the sheet is `size` wide and `rows` cells tall
  const height = cell * rows;
  const colors = new Uint8ClampedArray(size * height * 4);
  const out = [];
  const BORDER = 2;
  for (let row = 0; row < rows; row++) {
    const kind = ATLAS_KINDS[row];
    for (let col = 0; col < cells; col++) {
      const at = shapeAt(kind, roll, null);
      const grain = wobble(roll, 24, 0.08);
      const x0 = col * cell, y0 = row * cell;
      for (let py = 0; py < cell; py++) {
        for (let px = 0; px < cell; px++) {
          const inBorder = px < BORDER || py < BORDER || px >= cell - BORDER || py >= cell - BORDER;
          const x = ((px + 0.5) / cell) * 2 - 1, y = ((py + 0.5) / cell) * 2 - 1;
          const { a, shade } = inBorder ? { a: 0, shade: 1 } : at(x, y);
          const g = 1 + grain(Math.atan2(y, x)) * 0.5 + grain(px * 0.37 + py * 0.11) * 0.5;
          const o = ((y0 + py) * size + (x0 + px)) * 4;
          // BLOOD AUDIT 4: white ink - the shape and its grain; the colour
          // is the tint's (see BLOOD_BASE)
          const ink = Math.round(255 * Math.max(0, Math.min(1, shade * g)));
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
  }
  return { colors, width: size, height, cells: out };
}

/** The one atlas every pool shares, built on first ask. */
let _atlas = null;
export function bloodAtlas() { return _atlas ??= buildBloodAtlas(); }

/** A cell of `kind`, chosen by the caller's chance. */
export function pickCell(atlas, kind, rng = Math.random) {
  const of = atlas.cells.filter((c) => c.kind === kind);
  if (!of.length) return atlas.cells[0] ?? null;
  return of[Math.min(of.length - 1, Math.floor(rng() * of.length))];
}

/** Which kind a mark is: the pool under the body, a streak that flew, a
 *  wall's run, a walker's print (BLOOD2d), or spatter. */
export function bloodMarkKind({ pool = false, wall = false, print = false, stretch = 1 } = {}) {
  if (pool) return 'pool';
  if (wall) return 'drip';
  if (print) return 'print';
  return stretch > 1.5 ? 'streak' : 'spatter';
}

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
