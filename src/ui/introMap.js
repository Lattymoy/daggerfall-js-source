// ═══════════════════════════════════════════════════════════════════
// THE INTRO MAP — the Iliac Bay, generated, with no game data at all.
//
// The intro flies over the Iliac Bay before the enhanced menu, and the
// enhanced door opens BEFORE the ARENA2 folder pick (main.js says so in
// its own header, and gives that as the reason the title and the splash
// are not run there). So the land under the flyover cannot come out of
// WOODS.WLD or MAPS.BSA or any other archive: not because reading it
// would be hard, but because at that moment there is nothing to read.
//
// Port-Doctrine's second non-negotiable is the other half of the same
// point - A RENDER OF GAME DATA IS GAME DATA - so a baked raster of the
// real province could not ship in the repo even if we had one. What
// ships is this: a generator, in the enhanced skin's own procedural
// language (pixelGround, render/enhancedSky.js), producing a heightmap
// and a colourmap for ui/introFlyover.js to fly over.
//
// ── WHAT IS AUTHORED AND WHAT IS GENERATED ───────────────────────
//
// AUTHORED, and it is the whole of the authored data: the SHAPE. The
// Iliac Bay's geography is common knowledge about a fictional place -
// a bay opening west into the Eltheric Ocean, High Rock along its north
// shore, Hammerfell along its south, the Isle of Balfiera in the middle
// of it - and STROKES below is that read as a handful of primitives.
// It is ours the way the coastline in an atlas is the cartographer's:
// no byte of it came from a Bethesda file.
//
// GENERATED: everything else. The coast is those strokes displaced by
// fbm so it is ragged rather than geometric; the mountains are ridged
// noise banded away from the water; the colour is a function of height,
// slope and latitude. All of it off ONE seeded LCG, so a boot, a
// screenshot and a probe all see the same province.
//
// ── IT IS NOT A MAP OF ANYWHERE ──────────────────────────────────
//
// Stated plainly because the alternative is implying otherwise: this is
// an EVOCATION at province scale, not a survey. No location sits at its
// real coordinates, the bay's proportions are composed for a camera
// crossing it in twenty seconds, and nothing here should ever be used
// to answer a question about the game world. The game world is read
// from the player's own data by src/world/, which is a different thing
// entirely and stays that way.
//
// ── THE OUTPUT SHAPE ─────────────────────────────────────────────
//
// { w, h, height: Uint8Array, colour: Uint8Array }  - a heightmap and
// an RGB colourmap on the same grid, which is exactly what a voxel-space
// renderer eats. Sea is a FLAT floor at SEA_LEVEL rather than a mask:
// the renderer draws water by height comparison, so a lake, an inlet and
// the open ocean are one case and not three.
// ═══════════════════════════════════════════════════════════════════

/** Grid size. Wider than tall - the bay's frame is a landscape one. */
export const INTRO_MAP_W = 1024;
export const INTRO_MAP_H = 640;

/** The water floor, in heightmap units (0..255). Everything at or below
 *  this is water to the renderer, so coast is where the field crosses
 *  it rather than a separate mask that could disagree with the height. */
export const SEA_LEVEL = 46;

/** The default seed. A constant, not a clock: the intro must draw the
 *  same province every boot, or two screenshots of it are two provinces
 *  and no probe can pin anything about it. */
export const INTRO_MAP_SEED = 0x111ac;

// ── THE AUTHORED SHAPE ─────────────────────────────────────────────
//
// Coordinates are NORMALISED (0..1 across the grid, x east, y south) so
// the table survives a resolution change. Everything is expressed as a
// signed distance in the same units, positive out to sea.

/** The strokes that carve the ocean out of a full landmass, in the
 *  order they are cut. Each is a primitive with a `kind` the field
 *  function knows; the composition is a max() of their sea-ness, so a
 *  point is sea if ANY stroke says it is.
 *
 *  Read as geography, west to east:
 *    eltheric  the open ocean off the west edge, its meridian ragged
 *    mouth     the bay's wide western opening
 *    throat    the bay narrowing as it runs east
 *    head      the rounded eastern end (Wayrest's water)
 *    ilessan   the northern shore's bite
 *    tigonus   the southern shore's bite
 *  and one stroke that puts land BACK:
 *    balfiera  the isle in the middle of the bay
 */
export const STROKES = Object.freeze([
  // The Eltheric Ocean: everything west of a north-south meridian.
  { kind: 'west', name: 'eltheric', x: 0.150, wobble: 0.055, period: 2.3 },
  // The bay proper: a wedge east from the ocean, tapering, with a
  // rounded head. Two capsules and a disc rather than one polygon -
  // a capsule's distance field is exact and cheap, and the taper is
  // just its two radii.
  { kind: 'capsule', name: 'mouth', x0: 0.100, y0: 0.500, x1: 0.420, y1: 0.480, r0: 0.230, r1: 0.150 },
  { kind: 'capsule', name: 'throat', x0: 0.420, y0: 0.480, x1: 0.700, y1: 0.440, r0: 0.150, r1: 0.088 },
  { kind: 'disc', name: 'head', x: 0.735, y: 0.432, r: 0.092 },
  // The two shores' bites - what makes the coast read as a coast and
  // not a taper. North first, then south.
  { kind: 'disc', name: 'ilessan', x: 0.330, y: 0.318, r: 0.078 },
  { kind: 'disc', name: 'tigonus', x: 0.470, y: 0.648, r: 0.070 },
  { kind: 'capsule', name: 'abibon', x0: 0.170, y0: 0.700, x1: 0.300, y1: 0.665, r0: 0.055, r1: 0.038 },
]);

/** The Isle of Balfiera: land put back into the middle of the bay.
 *  Its own stroke because it is subtracted from the sea AFTER every
 *  cut, which is what makes it an island rather than a peninsula the
 *  bay happens to flow round. */
export const BALFIERA = Object.freeze({ x: 0.452, y: 0.470, r: 0.052 });

/** Where the mountains stand: ridges banded along the two shores, away
 *  from the water. `lat` is the band's centre in normalised y, `spread`
 *  its falloff, `gain` how high it pushes. North is the Wrothgarians,
 *  south the Dragontails - named for what they evoke, not surveyed. */
export const RANGES = Object.freeze([
  { name: 'wrothgarian', lat: 0.055, spread: 0.115, gain: 1.00 },
  { name: 'dragontail', lat: 0.930, spread: 0.125, gain: 0.94 },
  // A low spur reaching toward the bay's head, so the eastern horizon
  // is not a flat lid when the camera crests at the last cue.
  { name: 'wrothspur', lat: 0.230, spread: 0.070, gain: 0.42 },
]);

// ── NOISE ──────────────────────────────────────────────────────────

/** The one LCG, same constants as pixelGround's. Returned as a closure
 *  so a caller can never accidentally share a cursor between fields. */
export function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
}

/** A seeded value-noise lattice: 256x256 of random, sampled with smooth
 *  interpolation and wrapped, so it tiles and costs one table. */
export function makeNoise(seed) {
  const N = 256;
  const rnd = lcg(seed);
  const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[((y & (N - 1)) * N) + (x & (N - 1))];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    // smoothstep, not linear - a linear lattice shows its grid as
    // diamond creases the moment it is used for a coastline.
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  };
}

/** Fractal sum: `oct` octaves, each half the amplitude and twice the
 *  frequency. Returns 0..1.
 *
 *  NOT CALLED `fbm`, and the repo's own one-home gate is why. render/
 *  enhancedSky.js already exports an `fbm`, and that one is not a
 *  general utility - its header says it mirrors the sky SHADER's noise
 *  "IDENTICALLY" so cloud cover can be computed on the CPU and match
 *  what is drawn. Importing it here would tie this coastline to that
 *  shader: tune the clouds, move the Iliac Bay. Two functions with one
 *  name and two jobs is the collision the gate exists to catch, and
 *  the answer is a name that says which job this one has. */
export function octaveNoise(noise, x, y, oct = 5, lac = 2, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise(x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
}

/** Ridged sum - the fold that turns hills into ranges. `1 - |2n-1|`
 *  puts a crease where the noise crosses its own middle, and squaring
 *  sharpens the crest without moving it. */
export function ridged(noise, x, y, oct = 5) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(2 * noise(x * f, y * f) - 1);
    sum += amp * r * r;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// ── THE FIELD ──────────────────────────────────────────────────────

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Distance from a point to a capsule (a segment with a radius that
 *  lerps end to end). Negative inside. Exact, so the coast it carves
 *  has no seams where two strokes meet. */
export function capsuleDist(px, py, s) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = clamp01(((px - s.x0) * dx + (py - s.y0) * dy) / len2);
  const cx = s.x0 + dx * t, cy = s.y0 + dy * t;
  return Math.hypot(px - cx, py - cy) - (s.r0 + (s.r1 - s.r0) * t);
}

/**
 * How far the point (nx, ny) is OUTSIDE the water, in normalised units.
 * Negative in the sea, positive on land, zero on the coast - before the
 * fbm displacement, which the caller adds. Pure, and pinned directly:
 * this function is the authored shape.
 */
export function seaDistance(nx, ny) {
  // Start as far inland as anything can be, then take the nearest sea.
  let d = 1;
  for (const s of STROKES) {
    let sd;
    if (s.kind === 'west') {
      // A meridian with a slow wobble - the ocean edge, not a ruler.
      sd = nx - (s.x + s.wobble * Math.sin(ny * Math.PI * s.period));
    } else if (s.kind === 'capsule') {
      sd = capsuleDist(nx, ny, s);
    } else {
      sd = Math.hypot(nx - s.x, ny - s.y) - s.r;
    }
    if (sd < d) d = sd;
  }
  // Balfiera goes back IN as land, after every cut - an island, not a
  // gap the bay flows around.
  const bd = Math.hypot(nx - BALFIERA.x, ny - BALFIERA.y) - BALFIERA.r;
  if (-bd > d) d = -bd;
  return d;
}

/**
 * Build the province.
 *
 * Returns { w, h, height, colour }: a heightmap in 0..255 with water at
 * a flat SEA_LEVEL floor, and an RGB colourmap on the same grid.
 * Deterministic in `seed` alone.
 */
export function buildIliac({ w = INTRO_MAP_W, h = INTRO_MAP_H, seed = INTRO_MAP_SEED } = {}) {
  const coastN = makeNoise(seed);
  const hillN = makeNoise(seed ^ 0x9e37);
  const rangeN = makeNoise(seed ^ 0x51ed);
  const tintN = makeNoise(seed ^ 0x2545);

  const height = new Uint8Array(w * h);
  const colour = new Uint8Array(w * h * 3);

  // The range bands depend on LATITUDE ALONE, so they are a per-row
  // constant and not a per-pixel exp(). Three exps a row instead of
  // three a pixel is most of the build time this map used to cost.
  const bands = new Float32Array(h * RANGES.length);
  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let k = 0; k < RANGES.length; k++) {
      const rg = RANGES[k];
      bands[y * RANGES.length + k] = Math.exp(-Math.pow((ny - rg.lat) / rg.spread, 2)) * rg.gain;
    }
  }

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const i = y * w + x;

      // COAST. The authored distance, displaced by fbm at three
      // scales: headlands, bays, and the fret.
      //
      // THE FRET IS SCALED BY NEARNESS TO THE SHORE. Displacing the
      // whole field equally moves the BAY as much as it roughens its
      // edge, so the first build came back with a smooth blob at the
      // right size - the noise was there and it was spent in the wrong
      // place. `near` falls off over ~0.09 units, which is the only
      // band where a displacement is visible as coastline at all.
      const d0 = seaDistance(nx, ny);
      const near = Math.exp(-Math.abs(d0) * 11);
      const warp = (octaveNoise(coastN, nx * 5.5, ny * 5.5, 4) - 0.5) * 0.055
                 + (octaveNoise(coastN, nx * 17, ny * 17, 3) - 0.5) * 0.050 * near
                 + (octaveNoise(coastN, nx * 53, ny * 53, 2) - 0.5) * 0.018 * near;
      const d = d0 + warp;

      if (d <= 0) {
        // Water. Flat floor; the renderer shades it, not the map.
        height[i] = SEA_LEVEL;
        // Depth only tints - shallows over the shelf, deep out west.
        const deep = clamp01(-d * 5.5);
        const r = 22 + (1 - deep) * 20;
        const g = 48 + (1 - deep) * 34;
        const b = 74 + (1 - deep) * 30;
        colour[i * 3] = r; colour[i * 3 + 1] = g; colour[i * 3 + 2] = b;
        continue;
      }

      // LAND. A coastal plain rising inland, plus rolling hills, plus
      // the ridged ranges banded away from the bay.
      const inland = clamp01(d * 3.4);                 // 0 at the shore
      const plain = Math.pow(inland, 0.65) * 30;
      const hills = octaveNoise(hillN, nx * 11, ny * 11, 4) * 26 * (0.30 + 0.70 * inland);

      // ONE ridged sample serves every band - they differ in WHERE they
      // stand, not in what the rock does.
      let bandSum = 0;
      for (let k = 0; k < RANGES.length; k++) bandSum += bands[y * RANGES.length + k];
      let range = 0;
      if (bandSum > 0.02) {
        range = bandSum * ridged(rangeN, nx * 7.5, ny * 7.5, 5) * 168;
      }
      // The ranges keep off the water: a peak on the beach reads as an
      // error even when the noise is happy to put one there.
      range *= clamp01(d * 5);

      const z = SEA_LEVEL + 2 + plain + hills + range;
      const zi = z > 255 ? 255 : z | 0;
      height[i] = zi;

      // COLOUR by height and latitude, with a little noise so a band
      // never reads as a contour line. Shore sand, then grass, then
      // the moor, then rock, then snow on the crests.
      const above = (zi - SEA_LEVEL) / (255 - SEA_LEVEL);
      const t = clamp01(tintN(nx * 40, ny * 40) * 0.12 - 0.06 + above * 1.35);
      let r, g, b;
      if (d < 0.005) { r = 146; g = 132; b = 100; }                       // strand
      else if (t < 0.09) { r = 82; g = 104; b = 56; }                      // low grass
      else if (t < 0.22) { r = 56; g = 82; b = 44; }                       // wood
      else if (t < 0.38) { r = 92; g = 96; b = 58; }                       // moor
      else if (t < 0.55) { r = 104; g = 94; b = 72; }                      // scrub rock
      else if (t < 0.72) { r = 118; g = 112; b = 104; }                    // bare rock
      else { r = 198; g = 202; b = 210; }                                  // snow
      // Hammerfell reads warmer than High Rock: a slow south-facing
      // shift, so the two shores are not the same green.
      const south = clamp01((ny - 0.50) * 2.2);
      r += south * 26; g += south * 8; b -= south * 14;
      colour[i * 3] = r > 255 ? 255 : r | 0;
      colour[i * 3 + 1] = g > 255 ? 255 : g | 0;
      colour[i * 3 + 2] = b < 0 ? 0 : b | 0;
    }
  }
  return { w, h, height, colour };
}
