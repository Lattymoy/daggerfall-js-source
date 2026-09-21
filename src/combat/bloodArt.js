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
function shapeAt(kind, rng, bits) {
  if (kind === 'pool') {
    const w = wobble(rng, 14, 0.22);
    return (x, y) => {
      const r = Math.hypot(x, y), ang = Math.atan2(y, x);
      const edge = 0.78 * (1 + w(ang));
      return { a: 1 - smooth(edge - 0.1, edge + 0.05, r), depth: 1 - smooth(0, edge, r) };
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
      return { a, depth: 1 - smooth(0, edge, r) };
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
      return { a, depth: 1 - Math.max(0, Math.min(1, t)) };
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
      return { a: Math.max(heel, sole, waist), depth: 1 - smooth(heelX, toeX, x) };
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
    return { a: Math.max(bead, run, foot), depth: 1 - Math.max(0, Math.min(1, along < 0 ? 1 : along)) };
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
          const { a, depth } = inBorder ? { a: 0, depth: 0 } : at(x, y);
          const g = 1 + grain(Math.atan2(y, x)) * 0.5 + grain(px * 0.37 + py * 0.11) * 0.5;
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
