// @ts-check
// SHIP-LIVERY (2026-10-17; bible/03-World/Naval-Refit.md SHIP-LIVERY) - THE PORT'S SHIPS REPAINTED: each port-built
// hull's pictures (world/ships/galleonArt.js, carrackArt.js, largeBoatArt.js - the painters their stand-ins are built
// by) with a livery's paints laid over their families (systems/naval/shipLivery.js paintFamilies). Each ship's families
// are her own palette's: her STRAKE (the galleon's oxblood and its planks' seams, the carrack's Bay blue, the large boat's
// sea green - and the oxblood of the lids she shares with the galleon), her ACCENT (the galleon's gilt; the carrack's and
// the large boat's ochre, and the gilt they share) and her CANVAS (the fleet's one sailcloth). Every other colour - her
// oak, her tar, her wales, her iron, her glass - stays as built. Only her PAINTED pictures are read (`records`: her
// sides, castles, galleries, houses, rails, lids, trim and gilt) - never her deck, spars, rigging, iron or bottom, whose
// grain a stray texel near a paint's family would mark; her canvas (`canvas`) is a sail whole, every texel of it
// shaded by the paint against the cloth's own (`shadeCloth`), its seams and its dirt kept.
import { C, galleonArt, GALLEON_ARCHIVE, GALLEON_NIGHT, galleonGlow, TEX as GALLEON_TEX } from './galleonArt.js';
import { CARRACK_PALETTE as CARRACK_K, carrackArt, CARRACK_ARCHIVE, CARRACK_NIGHT, carrackGlow, TEX as CARRACK_TEX } from './carrackArt.js';
import { LARGE_BOAT_PALETTE as LARGE_BOAT_K, largeBoatArt, LARGE_BOAT_ARCHIVE, TEX as LARGE_BOAT_TEX } from './largeBoatArt.js';
import { SHIP_PAINTS, paintFamilies, lumOf } from '../../systems/naval/shipLivery.js';

const GILT = [C.gilt, C.giltDark, C.giltLit];
/** The galleon's strake: her oxblood, its light, and the seams and trenails its planks and lids are painted with. */
const OXBLOOD = [C.oxblood, C.oxbloodLit, [70, 20, 16], [80, 24, 18], [44, 13, 10], [62, 19, 15]];
export const CANVAS = Object.freeze([C.canvas, C.canvasSeam, C.canvasDirt]);
const palette = (...sets) => sets.flatMap((s) => Object.values(s));
/** The records of `tex` named by `keys` (those it has). */
const recs = (tex, keys) => Object.freeze(keys.filter((k) => tex[k] != null).map((k) => tex[k]));
/** A port ship's painted pictures, by her TEX names. */
const PAINTED = ['hullSide0', 'hullSide1', 'hullSide2', 'hullSide3', 'hullSide4', 'castle0', 'castle1', 'sternWindows0', 'sternWindows1', 'transom0', 'transom1',
  'house0', 'quarterRail0', 'roof', 'trim', 'gilt', 'lid', 'dark', 'door'];

/** Each port ship's archive: its painter, the colours it paints from, its families and their bases, and its glass. */
export const LIVERY_ART = Object.freeze({
  [GALLEON_ARCHIVE]: Object.freeze({
    art: galleonArt, records: recs(GALLEON_TEX, PAINTED), canvas: GALLEON_TEX.canvas, palette: palette(C), strake: OXBLOOD, strakeBase: C.oxblood, accent: GILT, accentBase: C.gilt, night: GALLEON_NIGHT, glow: galleonGlow,
  }),
  [CARRACK_ARCHIVE]: Object.freeze({
    art: carrackArt, records: recs(CARRACK_TEX, PAINTED), canvas: CARRACK_TEX.canvas, palette: palette(C, CARRACK_K), strake: [CARRACK_K.blue, CARRACK_K.blueLit, CARRACK_K.blueDark, [18, 26, 38], [26, 36, 52]], strakeBase: CARRACK_K.blue,
    accent: [CARRACK_K.ochre, CARRACK_K.ochreLit, CARRACK_K.ochreDark, ...GILT], accentBase: CARRACK_K.ochre, night: CARRACK_NIGHT, glow: carrackGlow,
  }),
  [LARGE_BOAT_ARCHIVE]: Object.freeze({
    art: largeBoatArt, records: recs(LARGE_BOAT_TEX, PAINTED), canvas: LARGE_BOAT_TEX.canvas, palette: palette(C, LARGE_BOAT_K), strake: [LARGE_BOAT_K.green, LARGE_BOAT_K.greenLit, LARGE_BOAT_K.greenDark, ...OXBLOOD], strakeBase: LARGE_BOAT_K.green,
    accent: [LARGE_BOAT_K.ochre, LARGE_BOAT_K.ochreDark, ...GILT], accentBase: LARGE_BOAT_K.ochre, night: Object.freeze({}), glow: () => null,
  }),
});

const _art = new Map();   // archive -> [record, picture][] - painted once
const artOf = (archive) => { if (!_art.has(archive)) _art.set(archive, LIVERY_ART[archive].art()); return _art.get(archive); };
/** AUDIT 2: every port ship's base pictures painted for the livery painter now - the pool's preload asks, while the world
 *  loads (AUDIT GN2-PF3's law): the first livery of a port hull painted them inside the pool's draw, 50 ms the first time
 *  she was seen painted (SEA-COLOURS paints the sea's from its first sail). */
export function warmLiveryArt() { for (const archive of Object.keys(LIVERY_ART)) artOf(Number(archive)); }

/**
 * A livery over one port ship's pictures: each record it changes, `{ record, picture, glow, night }` - its picture
 * repainted (before Daggerfall's look - world/dfLook.js - as its stand-in is built), and for a see-through record its
 * glass's glow and its night twin's record (null for one with none). [] for an archive no port ship's, or a livery that
 * paints none of hers.
 * @param {number} archive @param {{ strake: number, accent: number, sail: number } | null} livery
 */
export function liveryArtOf(archive, livery) {
  const a = LIVERY_ART[archive];
  if (!a || !livery) return [];
  const paint = (i) => SHIP_PAINTS[i]?.rgb ?? null;
  const families = [
    { members: a.strake, base: a.strakeBase, paint: paint(livery.strake) },
    { members: a.accent, base: a.accentBase, paint: paint(livery.accent) },
  ];
  const sail = paint(livery.sail);
  const out = [];
  for (const [record, pic] of artOf(archive)) {
    if (record === a.canvas) {
      if (sail) out.push({ record, picture: shadeCloth(pic, sail), glow: null, night: null });
      continue;
    }
    if (!a.records.includes(record) || !families.some((f) => f.paint)) continue;
    const { picture, changed } = paintFamilies(pic, a.palette, families);
    if (!changed) continue;
    const night = a.night[record] ?? null;
    out.push({ record, picture, glow: night != null ? a.glow(record) : null, night });
  }
  return out;
}

/** A sail of the fleet's canvas in `paint`: every texel the paint at its lightness against the cloth's own (C.canvas) -
 *  the seams, the dirt and the light of the cloth kept. A new picture. */
export function shadeCloth(pic, paint) {
  const data = new Uint8Array(pic.data), base = lumOf(C.canvas);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const k = lumOf([data[i], data[i + 1], data[i + 2]]) / base;
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(paint[c] * k)));
  }
  return { ...pic, data };
}
