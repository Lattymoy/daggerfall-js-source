// The cinematic's data-free, generated evocation of the Iliac Bay.
// The front door runs before the ARENA2 picker, so this is authored
// geography, not WOODS.WLD/MAPS.BSA or a raster derived from game data.
// A western opening, northern and southern shores, and Balfiera are
// described by primitives below; seeded noise supplies coast and relief.
// It is composed for the cinematic and is not a gameplay travel map.
//
// INTRO4 (bible/10-UI/UI-Arc.md INTRO4): INTRO2's own landscape of the Bay (buildIliac, its ranges, its sea floor) is
// retired with INTRO2's film. The Bay's authored SHAPE stays and is drawn inside the continent the new film pulls back
// to (introTamriel.js, in the hole tamrielGeography.js leaves for the Bay), and the seeded noise stays the one home
// ui/tamrielInk.js and the continent read.

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
