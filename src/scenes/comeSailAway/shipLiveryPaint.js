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
import { clothPicture } from '../../systems/naval/sailCloth.js';   // GUILD-SHOP: her sailcloth
import { sailEmblemOf, sailEmblemKey } from './sailEmblem.js';
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
  /** GUILD-SHOP: each pair of arms a sail has flown, its slot (1 up) - a paint's key carries it beside her code */
  const armsSlots = new Map();
  let slotsGiven = 0;
  /** `${archive}_${record}|${code}|${d|n}` -> the painted twin's record under LIVERY_ARCHIVE */
  const records = new Map();
  let next = 0;
  /** hull * 0x100000000 + code (a livery's code is three bytes, GUILD-SHOP its arms' slot a fourth) -> { day, night }
   *  (each a Map, source key -> painted key), null where it failed - a number, so a draw asks it with no string made */
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
  /** Every picture a livery repaints on a hull, painted and uploaded: `{ day, night }`. GUILD-SHOP: `arms` her guild's, on
   *  a sailcloth that flies them; `code` the paint's own key, her arms' slot in it. */
  async function paint(hull, code, arms = null) {
    const lv = liveryOfCode(code % 0x1000000);
    const day = new Map(), night = new Map();
    if (!lv) return { day, night };
    const emblem = lv.cloth?.arms ? sailEmblemOf(arms) : null;
    const port = portArchiveOf(hull);
    if (port != null) {
      for (const { record, picture, glow, night: twin } of liveryArtOf(port, lv, emblem)) {
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
    if (sail || lv.cloth) {
      const pic = await classic(CLASSIC_SAIL[0], CLASSIC_SAIL[1]);
      if (pic) {
        // GUILD-SHOP: a sailcloth's pattern over the cloth's own light (its mean, the classic cloth having no base of the port's)
        const tinted = sail ? tintPicture(pic, sail, SAIL_TINT) : pic, base = meanRgb(pic);
        const cloth = lv.cloth ? clothPicture(pic, sail ?? base, SHIP_PAINTS[lv.cloth.second]?.rgb ?? base, lv.cloth, base, emblem) : tinted;
        const key = put(CLASSIC_SAIL[0], CLASSIC_SAIL[1], code, 'd', dfLook(cloth, lookSeed(CLASSIC_SAIL[0], CLASSIC_SAIL[1])));
        day.set(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`, key); night.set(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`, key);
      }
    }
    return { day, night };
  }
  /** A hull's paint's maps once made - null while they are made (and the making begun), or where it failed. GUILD-SHOP:
   *  a sailcloth flying arms is made a pair of arms at a time, its slot over the 24 bits of her code. */
  function mapsOf(hull, code, arms = null) {
    const flies = (code >> 16) & 128 && arms ? armsSlotOf(arms) : 0;
    const own = code + flies * 0x1000000;
    const key = hull * 0x100000000 + own;
    if (made.has(key)) return made.get(key);
    if (!making.has(key) && renderer?.uploadTexture && pipeline?.getTexture) {
      making.add(key);
      paint(hull, own, flies ? arms : null).then((m) => { made.set(key, m); }, (e) => { made.set(key, null); log?.warn?.('[livery] a ship\'s paint could not be made - she is drawn as built', e); })
        .finally(() => making.delete(key));
    }
    return null;
  }
  /**
   * The remap a boat of `hull` wearing livery `code` is drawn by over the host's `base` (the night's twins already in it
   * while the lanterns are lit - `night`): the host's remap with her paint's keys over it, one Map a pair (the renderer
   * caches by its identity). `base` itself for a boat as built, or while her paint is made.
   */
  function remapOf(hull, code, night, base, arms = null) {
    if (!code) return base;
    const m = mapsOf(hull, code, arms);
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
  /** GUILD-SHOP: a pair of arms' slot, 1 to 255. The 256th pair takes the first's slot, whose paints are made again. */
  function armsSlotOf(arms) {
    const k = sailEmblemKey(arms);
    let n = armsSlots.get(k);
    if (n != null) return n;
    n = (slotsGiven++ % 255) + 1;
    for (const [old, m] of armsSlots) if (m === n) armsSlots.delete(old);
    for (const key of made.keys()) if (Math.floor(key / 0x1000000) % 256 === n) made.delete(key);
    armsSlots.set(k, n);
    return n;
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

/** GUILD-SHOP: a top-down picture's mean colour - the classic sailcloth's own, its pattern's base. */
function meanRgb(/** @type {any} */ pic) {
  const d = pic.data, out = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; out[0] += d[i]; out[1] += d[i + 1]; out[2] += d[i + 2]; n++; }
  return n ? out.map((v) => v / n) : [200, 190, 170];
}
