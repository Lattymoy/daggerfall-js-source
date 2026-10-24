// @ts-check
// SHIP-LIVERY (2026-10-17; bible/03-World/Naval-Refit.md SHIP-LIVERY) - THE PAINT SHOP: a livery's pictures painted and
// uploaded the first time a boat wears it, and the remap she is drawn by (scenes/comeSailAway/comeSailAwayPool.js draw -
// the one draw every host's boats go through, so a painted ship is painted on the street, on a dungeon's water and in a
// peer's sight alike). The wagons' paint's own shape (scenes/horseCartPool.js lookRemap): the remap maps each record her
// paint changes to its painted twin, under LIVERY_ARCHIVE; a boat whose paint is still being made is drawn as built.
//
// WHAT IS PAINTED, by the hull's own pictures:
//   - a port-built hull (PORT_SHIPS: the Large Boat, the Small Ship, the Carrack) - her strake, accent and canvas
//     (world/ships/shipLiveryArt.js liveryArtOf), each picture in Daggerfall's look as her stand-ins are (world/dfLook.js,
//     her own record's grain); a see-through record twice - by day its glass cut out, at night whole with its glow (the
//     pool's own NIGHT_REMAP law, kept: a painted gallery is see-through by day and lit at night);
//   - a hull of the mod's own planks (TEXTURE.067 - the Rowboat, the Large Galley, and a port hull's small things) -
//     every plank record stained (systems/naval/shipLivery.js stainPicture);
//   - classic sailcloth (TEXTURE.050 record 7, the mod's sails) - tinted (SAIL_TINT).
import { LIVERY_ARCHIVE, SHIP_PAINTS, stainPicture, tintPicture, SAIL_TINT, liveryOfCode } from '../../systems/naval/shipLivery.js';
import { liveryArtOf } from '../../world/ships/shipLiveryArt.js';
import { cutGlass } from '../../world/ships/galleonArt.js';
import { dfLook, lookSeed } from '../../world/dfLook.js';
import { classicPictureOf } from '../../formats/derivedTexture.js';
import { toColor32 } from '../../formats/color32Order.js';

/** The mod's plank archive, stained. */
export const PLANK_ARCHIVE = 67;
/** The mod's sailcloth: TEXTURE.050 record 7 (its sails' ApplyGameTextures names, `050_007`). */
export const CLASSIC_SAIL = Object.freeze([50, 7]);

/**
 * @param {{ renderer: any, pipeline: any, portArchiveOf: (hull: number) => number | null, log?: any }} deps - `portArchiveOf`
 *   the archive of the port's ship standing for a hull (null: the mod's own model)
 */
export function createLiveryPaint({ renderer, pipeline, portArchiveOf, log = console }) {
  /** `${archive}_${record}|${code}|${d|n}` -> the painted twin's record under LIVERY_ARCHIVE */
  const records = new Map();
  let next = 0;
  /** hull * 0x10000 + code (a livery's code is four nibbles) -> { day, night } (each a Map, source key -> painted key),
   *  null where it failed - a number, so a draw asks it with no string made */
  const made = new Map();
  const making = new Set();
  /** a host's remap -> (a paint's map -> the two as one) */
  const joined = new WeakMap();

  /** One painted picture up under LIVERY_ARCHIVE: its key. */
  function put(archive, record, code, tag, pic, opts = { opaque: true }, glow = null) {
    const k = `${archive}_${record}|${code}|${tag}`;
    let rec = records.get(k);
    if (rec == null) { rec = next++; records.set(k, rec); }
    renderer.uploadTexture(LIVERY_ARCHIVE, rec, toColor32(pic), opts);
    if (glow) renderer.uploadEmissionTexture?.(LIVERY_ARCHIVE, rec, toColor32(glow), { replacement: false });
    return `${LIVERY_ARCHIVE}_${rec}`;
  }
  /** A classic record as a top-down picture, or null where the player's data has none (derivedTexture.js). */
  const classic = (archive, record) => classicPictureOf((a) => pipeline.getTexture(a), pipeline.palette, archive, record);
  /** Every picture a livery repaints on a hull, painted and uploaded: `{ day, night }`. */
  async function paint(hull, code) {
    const lv = liveryOfCode(code);
    const day = new Map(), night = new Map();
    if (!lv) return { day, night };
    const port = portArchiveOf(hull);
    if (port != null) {
      for (const { record, picture, glow, night: twin } of liveryArtOf(port, lv)) {
        const looked = dfLook(picture, lookSeed(port, record));
        const src = `${port}_${record}`;
        if (twin != null && glow) {
          day.set(src, put(port, record, code, 'd', cutGlass(looked, glow), { opaque: true, cutout: true }));
          night.set(src, put(port, record, code, 'n', looked, { opaque: true }, glow));
        } else {
          const key = put(port, record, code, 'd', looked);
          day.set(src, key); night.set(src, key);
        }
      }
    }
    const stain = SHIP_PAINTS[lv.stain]?.rgb;
    if (stain) {
      const t = await pipeline.getTexture(PLANK_ARCHIVE);
      const n = t && !t.vendor ? t.recordCount ?? 0 : 0;
      for (let r = 0; r < n; r++) {
        const pic = await classic(PLANK_ARCHIVE, r);
        if (!pic) continue;
        const key = put(PLANK_ARCHIVE, r, code, 'd', dfLook(stainPicture(pic, stain), lookSeed(PLANK_ARCHIVE, r)));
        day.set(`${PLANK_ARCHIVE}_${r}`, key); night.set(`${PLANK_ARCHIVE}_${r}`, key);
      }
    }
    const sail = SHIP_PAINTS[lv.sail]?.rgb;
    if (sail) {
      const pic = await classic(CLASSIC_SAIL[0], CLASSIC_SAIL[1]);
      if (pic) {
        const key = put(CLASSIC_SAIL[0], CLASSIC_SAIL[1], code, 'd', dfLook(tintPicture(pic, sail, SAIL_TINT), lookSeed(CLASSIC_SAIL[0], CLASSIC_SAIL[1])));
        day.set(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`, key); night.set(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`, key);
      }
    }
    return { day, night };
  }
  /** A hull's paint's maps once made - null while they are made (and the making begun), or where it failed. */
  function mapsOf(hull, code) {
    const key = hull * 0x10000 + code;
    if (made.has(key)) return made.get(key);
    if (!making.has(key) && renderer?.uploadTexture && pipeline?.getTexture) {
      making.add(key);
      paint(hull, code).then((m) => { made.set(key, m); }, (e) => { made.set(key, null); log?.warn?.('[livery] a ship\'s paint could not be made - she is drawn as built', e); })
        .finally(() => making.delete(key));
    }
    return null;
  }
  /**
   * The remap a boat of `hull` wearing livery `code` is drawn by over the host's `base` (the night's twins already in it
   * while the lanterns are lit - `night`): the host's remap with her paint's keys over it, one Map a pair (the renderer
   * caches by its identity). `base` itself for a boat as built, or while her paint is made.
   */
  function remapOf(hull, code, night, base) {
    if (!code) return base;
    const m = mapsOf(hull, code);
    if (!m) return base;
    const own = night ? m.night : m.day;
    if (!own.size) return base;
    if (!base?.size) return own;
    let by = joined.get(base);
    if (!by) { by = new Map(); joined.set(base, by); }
    let j = by.get(own);
    if (!j) { j = new Map([...base, ...own]); by.set(own, j); ownOf.set(j, own); }
    return j;
  }
  /** AUDIT 2: a joined remap -> the paint's own keys in it. */
  const ownOf = new WeakMap();
  /** AUDIT 2: mesh -> (own map -> whether any of its sub-meshes' pictures is one the paint repaints). */
  const touched = new WeakMap();
  /**
   * AUDIT 2: the remap `mesh` is drawn by - her paint's (`remap`) only where it repaints one of its pictures, else the
   * host's `base`. The renderer caches each sub-mesh's picture by its remap's identity, and Daggerfall's models are
   * shared by every boat that hangs them: two boats of one hull in two paints (SEA-COLOURS: most of a sea) missed that
   * cache on every sub-mesh of every shared model every frame, and made its key's string again each time.
   */
  function remapFor(mesh, remap, base) {
    if (remap === base || !remap || !mesh?.subMeshes) return remap;
    const own = ownOf.get(remap) ?? remap;
    let by = touched.get(mesh);
    if (!by) { by = new WeakMap(); touched.set(mesh, by); }
    let v = by.get(own);
    if (v === undefined) { v = mesh.subMeshes.some((sm) => own.has(`${sm.textureArchive}_${sm.textureRecord}`)); by.set(own, v); }
    return v ? remap : base;
  }
  return { remapOf, remapFor, mapsOf, _records: records };
}
