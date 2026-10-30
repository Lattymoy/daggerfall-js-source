// @ts-check
// ═══════════════════════════════════════════════════════════════════
// URBANIZER U2 (2026-10-26; KPbICA's spec, forwarded by the owner; bible/03-World/Urban-Fabric.md section 3) - THE TOWNS'
// OWN PICTURES: cut stone, brick courses and timber framing over plaster for the port's own buildings (the capitals'
// landmarks past the Bay - world/capitalSolitude.js and its kin), and each province's paving, kerbs, cobbles and walls
// for its towns' streets and yards (world/urban/townFabricModel.js).
//
// Painted as the capitals' are, by their own laws (world/capitalModels.js CAPITAL_PAINT - TESA-LORE: a tone law dithered
// onto its material's ramp of 28 shades, masonry laid stone by stone, lit on its top and left edges, its joints dark), at
// vanilla's detail (64 x 64, within the freeware's own band of colours, texel contrast and spread, every one tiling) -
// made at boot from fixed seeds under a pseudo-archive of the port's own. No game data: nothing here comes from ARENA2 or
// from any other game.
//
// A STYLE a province (URBAN_STYLES): the stone its streets are laid in and the walls its yards and dead ends stand - the
// Nord's grey granite, the Breton's brown stone and red brick, the Redguard's and the Khajiit's sandstone and adobe, the
// Altmer's white limestone, the Velothi's ochre stucco, the Empire's grey setts and brick, the Bosmer's and the Argonians'
// planks and stakes. Each style's four pictures (URBAN_KINDS): its SETTS (a main street's carriageway - small dressed
// stones in courses), its FLAGS (a pavement's slabs), its COBBLES (a side street's rounded stones) and its WALL.
// ═══════════════════════════════════════════════════════════════════
import { CAPITAL_PAINT } from '../capitalModels.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART } from '../capitalShapes.js';
import { addVendorTextures } from '../../systems/textureReplacement.js';
import { URBAN_ARCHIVE, URBAN_KINDS, URBAN_ART, URBAN_STYLES, URBAN_STYLE_KEYS } from './urbanRecords.js';

export { URBAN_ARCHIVE, URBAN_KINDS, URBAN_ART, URBAN_STYLES, URBAN_STYLE_KEYS };
/** The painting laws (world/capitalModels.js's). The capitals' landmarks name these pictures through
 *  world/urban/urbanRecords.js alone, so no module capitalModels.js reads reads this one. */
const { rng, noise, ramp, painted, masonry, cells } = CAPITAL_PAINT;
/** A picture's side, texels (world/capitalModels.js CAPITAL_ART_SIZE: Daggerfall's own). */
const S = 64;
/** The signed way from a texel to a point the nearer way round the picture (it tiles). */
const toward = (d) => ((((d + S / 2) % S) + S) % S) - S / 2;

// ---------------------------------------------------------------- the laws

/** PLASTER: a smooth wall, mottled, its cracks dark, a stain at its foot - adobe and stucco. */
function plaster(seed) {
  const mot = noise(seed, 4),
    fine = noise(seed + 1, 16),
    crack = noise(seed + 2, 6);
  return (x, y) =>
    0.55 + (mot(x, y) - 0.5) * 0.45 + (fine(x, y) - 0.5) * 0.25 - (Math.abs(crack(x, y) - 0.5) < 0.012 ? 0.3 : 0);
}
/** STAKES: a palisade of split logs side by side, each lit on its left and its point's shadow at its top. */
function stakes(seed) {
  const r = rng(seed),
    grainT = noise(seed + 3, 4),
    w = 16,
    base = Array.from({ length: S / w }, () => 0.36 + r() * 0.3);
  return (x, y) => {
    const k = Math.floor(x / w),
      dx = x % w;
    if (dx === 0) return 0.05;
    return (
      base[k] +
      (dx === 1 ? 0.18 : 0) -
      (dx === w - 1 ? 0.16 : 0) +
      (grainT(x * 3, y) - 0.5) * 0.4 -
      (y % 32 === 31 ? 0.2 : 0)
    );
  };
}
/** COBBLES: rounded stones about their own points, each its own shade, lit toward its top-left, its gaps dark. */
function cobbles(seed, n = 44) {
  const c = cells(seed, n);
  return (x, y) => {
    const q = c(x, y);
    if (q.edge < 1.1) return 0.05;
    const dx = toward(q.p[0] - x - 0.5),
      dy = toward(q.p[1] - y - 0.5);
    return 0.34 + q.p[2] * 0.34 + Math.max(-0.2, Math.min(0.2, (dx + dy) * 0.045)) - (q.edge < 2.2 ? 0.12 : 0);
  };
}
/**
 * HALF-TIMBERING: dark oak framing over plaster - a post every thirty-two texels, a rail every thirty-two, a brace across
 * every other panel corner to corner, each timber lit on its upper-left edge; the plaster mottled between, in the frame's
 * shadow beside it. Two ramps: the plaster's (0) and the oak's (1).
 */
function halfTimber(seed) {
  const pl = plaster(seed),
    grainT = noise(seed + 5, 4),
    T = 5,
    P = 32;
  /** The timber a texel is: 0 a post, 1 a rail, 2 a brace, -1 the plaster; and how far into it (its lit edge 0). */
  const frame = (x, y) => {
    const px = x % P,
      py = y % P,
      odd = (Math.floor(x / P) + Math.floor(y / P)) % 2;
    if (px < T) return [0, px];
    if (py < T) return [1, py];
    const d = px - T - (py - T);
    if (!odd && Math.abs(d) < 2.5) return [2, Math.round(d + 2)];
    return [-1, 0];
  };
  return (x, y) => {
    const [f, k] = frame(x, y);
    if (f >= 0) return [0.46 + (grainT(x, y * 3) - 0.5) * 0.36 + (k === 0 ? 0.16 : k >= T - 1 ? -0.16 : 0), 1];
    const shade = frame((x + S - 1) % S, y)[0] >= 0 || frame(x, (y + S - 1) % S)[0] >= 0;
    return [pl(x, y) - (shade ? 0.16 : 0), 0];
  };
}
/** LOG ENDS: a woodpile's face - rounds of sawn log packed in rows, each its rings about its heart, the gaps dark. */
function logEnds(seed) {
  const c = cells(seed, 26);
  return (x, y) => {
    const q = c(x, y);
    if (q.edge < 1.2) return 0.04;
    const d = Math.hypot(toward(q.p[0] - x - 0.5), toward(q.p[1] - y - 0.5));
    return 0.5 + q.p[2] * 0.2 - (Math.floor(d) % 2 ? 0.08 : 0) - (q.edge < 2.4 ? 0.18 : 0);
  };
}

/** The pictures, by record: every style's four and the shared ones. Deterministic (fixed seeds): every client's town the
 *  same stone. */
export function urbanPictures() {
  const out = new Map();
  URBAN_STYLE_KEYS.forEach((key, k) => {
    const st = URBAN_STYLES[key],
      base = 0x9100 + k * 16,
      stone = ramp(st.stone),
      wallRamp = ramp(st.wallRamp);
    const lay = (record, m, r = stone, seed = base) => out.set(record, painted(r, m, { seed }));
    if (key === 'planks') {
      // the boardwalk's planks run across the way, its rails and its stakes the palisade's
      const r7 = rng(base),
        grainT = noise(base + 1, 4);
      const rows = [];
      let y0 = 0;
      while (y0 < S) {
        const h = 8;
        rows.push({ y0, h, end: Math.floor(r7() * S), base: 0.36 + r7() * 0.3 });
        y0 += h;
      }
      const plank = (x, y) => {
        const p = rows[Math.floor(y / 8)],
          dy = y - p.y0;
        if (dy === 0 || x === p.end) return 0.04;
        return p.base + (grainT(x, y * 4) - 0.5) * 0.45 + (dy === 1 ? 0.15 : 0) - (dy === p.h - 1 ? 0.14 : 0);
      };
      lay(k * 8 + URBAN_KINDS.setts, plank);
      lay(k * 8 + URBAN_KINDS.flags, plank);
      lay(k * 8 + URBAN_KINDS.cobbles, cobbles(base + 2));
    } else {
      lay(k * 8 + URBAN_KINDS.setts, masonry(base, { rows: [7, 9], stones: [8, 12], mottle: 0.16, chips: 0.02 }).tone);
      lay(
        k * 8 + URBAN_KINDS.flags,
        masonry(base + 1, { rows: [14, 21], stones: [18, 30], mottle: 0.12, chips: 0.02 }).tone,
      );
      lay(k * 8 + URBAN_KINDS.cobbles, cobbles(base + 2));
    }
    const wallLaw =
      st.wall === 'brick'
        ? masonry(base + 3, { rows: [5, 6], stones: [10, 14], mottle: 0.16, chips: 0.02 }).tone
        : st.wall === 'rubble'
          ? masonry(base + 3, { rows: [8, 13], stones: [10, 20], mottle: 0.26, chips: 0.05 }).tone
          : st.wall === 'ashlar'
            ? masonry(base + 3, { rows: [14, 18], stones: [22, 32], mottle: 0.08, chips: 0.01 }).tone
            : st.wall === 'stakes'
              ? stakes(base + 3)
              : plaster(base + 3);
    lay(k * 8 + URBAN_KINDS.wall, wallLaw, wallRamp, base + 3);
  });
  const shared = (record, m, stops, seed) =>
    out.set(record, painted(Array.isArray(stops[0][0]) ? stops.map((s) => ramp(s)) : ramp(stops), m, { seed }));
  shared(
    URBAN_ART.brick,
    masonry(0x9a01, { rows: [5, 6], stones: [10, 14], mottle: 0.16, chips: 0.02 }).tone,
    [
      [62, 26, 18],
      [118, 52, 34],
      [160, 84, 58],
      [198, 128, 96],
    ],
    0x9a01,
  );
  shared(
    URBAN_ART.halfTimber,
    halfTimber(0x9a02),
    [
      [
        [112, 100, 82],
        [146, 134, 114],
        [168, 156, 134],
        [184, 174, 152],
      ],
      [
        [58, 42, 28],
        [86, 64, 42],
        [112, 86, 58],
        [134, 106, 74],
      ],
    ],
    0x9a02,
  );
  shared(
    URBAN_ART.ashlar,
    masonry(0x9a03, { rows: [14, 18], stones: [22, 32], mottle: 0.08, chips: 0.01 }).tone,
    [
      [58, 58, 56],
      [112, 110, 104],
      [160, 156, 148],
      [200, 196, 186],
    ],
    0x9a03,
  );
  shared(
    URBAN_ART.ochreAshlar,
    masonry(0x9a04, { rows: [14, 18], stones: [22, 32], mottle: 0.08, chips: 0.01 }).tone,
    [
      [100, 70, 40],
      [156, 116, 70],
      [200, 156, 104],
      [230, 196, 144],
    ],
    0x9a04,
  );
  shared(
    URBAN_ART.whiteAshlar,
    masonry(0x9a05, { rows: [14, 18], stones: [22, 32], mottle: 0.07, chips: 0.01 }).tone,
    [
      [140, 138, 130],
      [192, 190, 180],
      [224, 222, 212],
      [246, 244, 236],
    ],
    0x9a05,
  );
  shared(
    URBAN_ART.sandBrick,
    masonry(0x9a06, { rows: [5, 7], stones: [11, 15], mottle: 0.14, chips: 0.02 }).tone,
    [
      [118, 88, 54],
      [176, 140, 96],
      [210, 176, 126],
      [236, 210, 164],
    ],
    0x9a06,
  );
  shared(
    URBAN_ART.logEnds,
    logEnds(0x9a07),
    [
      [48, 30, 16],
      [110, 76, 44],
      [168, 126, 80],
      [210, 172, 120],
    ],
    0x9a07,
  );
  return out;
}

/** The woodpile's bark and a boardwalk's rails - the capitals' own pictures (world/capitalShapes.js). */
export const BARK = Object.freeze([CAPITAL_ARCHIVE, CAPITAL_ART.bark]);
export const TIMBER = Object.freeze([CAPITAL_ARCHIVE, CAPITAL_ART.timber]);

let _installed = false;
/**
 * ONCE: the towns' pictures on the texture door (scenes/modWorldData.js, beside installCapitals - behind no switch, as the
 * capitals' are), each painted when first asked.
 * @param {{ addTextures?: (entries: any[]) => number }} [o]
 */
export function installUrbanArt({ addTextures = addVendorTextures } = {}) {
  if (_installed) return false;
  _installed = true;
  let made = null;
  const pictureOf = (record) => (made ??= urbanPictures()).get(record) ?? null;
  const records = [
    ...URBAN_STYLE_KEYS.flatMap((_, k) => Object.values(URBAN_KINDS).map((o) => k * 8 + o)),
    ...Object.values(URBAN_ART),
  ];
  addTextures(
    records.map((record) => ({
      archive: URBAN_ARCHIVE,
      record,
      frame: 0,
      standIn: true,
      fileName: `urban-${URBAN_ARCHIVE}_${record}`,
      build: async () => pictureOf(record),
    })),
  );
  return true;
}
/** Test seam. */
export function _resetUrbanArt() {
  _installed = false;
}
