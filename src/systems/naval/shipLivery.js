// @ts-check
// SHIP-LIVERY (2026-10-17, the owner: "Letting players customize the exterior and interior textures of the ship";
// bible/03-World/Naval-Refit.md SHIP-LIVERY) - A SHIP'S PAINT: the law, and the painter. The port's own; pure.
//
// A LIVERY is four choices, each a paint of SHIP_PAINTS or none (0 - as she was built):
//   strake - the painted strakes of a port-built hull (world/ships/galleonArt.js and its kin: the galleon's oxblood, the
//            carrack's Bay blue, the large boat's sea green) - her gunport strake, her castles, her lids;
//   accent - their trim's colour (the galleon's gilt, the carrack's and the large boat's ochre);
//   sail   - her canvas;
//   stain  - the wood of a hull built of Daggerfall's own planks (the mod's Rowboat and Large Galley, TEXTURE.067) - a
//            stain over the whole of her, its grain kept.
// Which a hull takes is `liveryPartsOf`: the port's ships strake, accent and sail; the galley stain and sail; the rowboat
// stain alone.
//
// THE PAINTER REPAINTS A PICTURE BY ITS FAMILIES. A port ship's pictures are painted from a palette (`C` and her own
// `K`) shaded and mixed over noise; each texel is read as the palette colour nearest it, and one of the family the
// livery paints takes that paint at the texel's own lightness against the family's base (`paintFamilies`) - her planks'
// seams, her grain and her light kept, every other colour (her oak, her tar, her black wales, her glass) left as built.
// Canvas is a family of its own. A classic plank takes a stain (`stainPicture`): the paint at the texel's lightness,
// laid over the wood at STAIN_STRENGTH, so the plank still reads as a plank. Sails of classic canvas take `tintPicture`.
//
// THE WORD: a livery is one number on the boats' word (`liveryCode`, four nibbles; systems/comeSailAway/
// comeSailAwayWire.js `l`) - a reader takes it through the door (`liveryOfCode`), one it refuses as built.

/** The paints, index 1 up (0 is none - as she was built): each in Daggerfall's own earths and dyes. */
export const SHIP_PAINTS = Object.freeze([
  null,
  Object.freeze({ id: 'oxblood', rgb: Object.freeze([118, 34, 27]) }),
  Object.freeze({ id: 'crimson', rgb: Object.freeze([152, 32, 30]) }),
  Object.freeze({ id: 'black', rgb: Object.freeze([28, 26, 24]) }),
  Object.freeze({ id: 'navy', rgb: Object.freeze([32, 44, 80]) }),
  Object.freeze({ id: 'bay', rgb: Object.freeze([46, 66, 94]) }),
  Object.freeze({ id: 'teal', rgb: Object.freeze([38, 92, 96]) }),
  Object.freeze({ id: 'sea', rgb: Object.freeze([58, 92, 70]) }),
  Object.freeze({ id: 'forest', rgb: Object.freeze([40, 64, 36]) }),
  Object.freeze({ id: 'ochre', rgb: Object.freeze([176, 128, 48]) }),
  Object.freeze({ id: 'gold', rgb: Object.freeze([196, 152, 62]) }),
  Object.freeze({ id: 'white', rgb: Object.freeze([206, 200, 182]) }),
  Object.freeze({ id: 'grey', rgb: Object.freeze([112, 110, 104]) }),
  Object.freeze({ id: 'purple', rgb: Object.freeze([86, 40, 80]) }),
  Object.freeze({ id: 'tan', rgb: Object.freeze([150, 112, 72]) }),
]);
/** The most a paint's index is. */
export const PAINT_MAX = SHIP_PAINTS.length - 1;
export const LIVERY_PARTS = Object.freeze(['strake', 'accent', 'sail', 'stain']);
/** The pseudo-archive a livery's pictures go up under (a painted picture a session's own, never a file). */
export const LIVERY_ARCHIVE = 38191;
/** How much of a stain lies over a classic plank (the rest the plank's own colour). */
export const STAIN_STRENGTH = 0.62;
/** How much of a paint a classic sail takes. */
export const SAIL_TINT = 0.85;

/** The parts a hull takes (HULL_NAMES' order: Rowboat, Large Boat, Small Ship, Large Galley, Carrack). */
export function liveryPartsOf(hull) {
  if (hull === 1 || hull === 2 || hull === 4) return ['strake', 'accent', 'sail'];
  if (hull === 3) return ['stain', 'sail'];
  if (hull === 0) return ['stain'];
  return [];
}
const paintIndex = (v) => (Number.isInteger(v) && v >= 0 && v <= PAINT_MAX ? v : null);
/** Whether `v` is a paint's index (0 none - as built). */
export const isPaint = (v) => paintIndex(v) != null;
/**
 * A livery through its door: `{ strake, accent, sail, stain }`, each a paint's index (0 none) - a part the hull does not
 * take none - or null: none chosen at all, or a field that is no paint (the whole refused, as the flag's door refuses).
 * @param {any} raw @param {number} [hull] - when given, the parts it does not take are made none
 */
export function liveryOf(raw, hull) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { strake: 0, accent: 0, sail: 0, stain: 0 };
  for (const p of LIVERY_PARTS) {
    if (raw[p] == null) continue;
    const i = paintIndex(raw[p]);
    if (i == null) return null;
    out[p] = i;
  }
  if (hull != null) { const takes = liveryPartsOf(hull); for (const p of LIVERY_PARTS) if (!takes.includes(p)) out[p] = 0; }
  return LIVERY_PARTS.some((p) => out[p]) ? out : null;
}
/** A livery as the word's one number (0 as built): a nibble a part. */
export const liveryCode = (l) => { const v = liveryOf(l); return v ? v.strake | (v.accent << 4) | (v.sail << 8) | (v.stain << 12) : 0; };
/** The word's number as a livery - null as built, or a number that is not one. */
export function liveryOfCode(n) {
  if (!Number.isInteger(n) || n <= 0 || n >= 1 << 16) return null;
  return liveryOf({ strake: n & 15, accent: (n >> 4) & 15, sail: (n >> 8) & 15, stain: (n >> 12) & 15 });
}

// ── the painter ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A colour's lightness (Rec. 601). */
export const lumOf = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
/** `paint` at the lightness of `px` against `base`'s - the paint shaded as the texel was shaded. */
function shadeAs(paint, px, base) {
  const k = lumOf(px) / Math.max(1, lumOf(base));
  return [clamp8(paint[0] * k), clamp8(paint[1] * k), clamp8(paint[2] * k)];
}

/**
 * A picture repainted by its families: each texel read as the `palette` colour nearest it, and one of a `family`'s
 * members painted that family's `paint` at its lightness against the family's `base`. Answers `{ picture, changed }` -
 * a new picture (the source untouched), and whether any texel took a paint.
 * @param {{ width: number, height: number, data: Uint8Array }} pic
 * @param {ReadonlyArray<ReadonlyArray<number>>} palette - every colour the picture was painted from
 * @param {{ members: ReadonlyArray<ReadonlyArray<number>>, base: ReadonlyArray<number>, paint: ReadonlyArray<number> | null }[]} families
 */
export function paintFamilies(pic, palette, families) {
  const out = new Uint8Array(pic.data);
  const live = families.filter((f) => f.paint);
  if (!live.length) return { picture: { ...pic, data: out }, changed: false };
  // the palette and each family's members as one list, each entry the family it paints (-1 none)
  const anchors = [...palette.map((c) => ({ c, f: -1 }))];
  live.forEach((f, i) => { for (const c of f.members) anchors.push({ c, f: i }); });
  const memo = new Map();
  let changed = false;
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const r = out[i], g = out[i + 1], b = out[i + 2];
    const key = (r << 16) | (g << 8) | b;
    let f = memo.get(key);
    if (f === undefined) {
      let best = Infinity;
      f = -1;
      for (const a of anchors) {
        const d = (a.c[0] - r) ** 2 + (a.c[1] - g) ** 2 + (a.c[2] - b) ** 2;
        if (d < best || (d === best && a.f >= 0)) { best = d; f = a.f; }
      }
      memo.set(key, f);
    }
    if (f < 0) continue;
    const c = shadeAs(live[f].paint, [r, g, b], live[f].base);
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2];
    changed = true;
  }
  return { picture: { ...pic, data: out }, changed };
}

/** The mean lightness of a picture's opaque texels. */
export function meanLum(pic) {
  let s = 0, n = 0;
  for (let i = 0; i < pic.data.length; i += 4) if (pic.data[i + 3]) { s += lumOf([pic.data[i], pic.data[i + 1], pic.data[i + 2]]); n++; }
  return n ? s / n : 0;
}
/** A picture with `paint` laid over it at `strength`: each texel the paint at its lightness against the picture's mean
 *  (its grain kept), mixed over its own colour. A new picture. */
export function tintPicture(pic, paint, strength) {
  const out = new Uint8Array(pic.data);
  const mean = Math.max(1, meanLum(pic)), base = [mean, mean, mean];
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const c = shadeAs(paint, [out[i], out[i + 1], out[i + 2]], base);
    for (let k = 0; k < 3; k++) out[i + k] = clamp8(out[i + k] * (1 - strength) + c[k] * strength);
  }
  return { ...pic, data: out };
}
/** A classic plank stained: `tintPicture` at STAIN_STRENGTH. */
export const stainPicture = (pic, paint) => tintPicture(pic, paint, STAIN_STRENGTH);
