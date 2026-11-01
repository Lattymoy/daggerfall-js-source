// @ts-check
// THE PAINT SHOP: a livery's pictures painted and uploaded the first time a boat wears it, and the remap she is drawn by
// (scenes/comeSailAway/comeSailAwayPool.js draw - the one draw every host's boats go through, so a painted ship is
// painted on the street, on a dungeon's water and in a peer's sight alike). The wagons' paint's own shape
// (scenes/horseCartPool.js lookRemap): the remap maps each record her paint changes to its painted twin, under
// LIVERY_ARCHIVE; a boat whose paint is still being made is drawn as built.
//
// WHAT IS PAINTED, by the hull's own pictures:
//   - a port-built hull (PORT_SHIPS: the Large Boat, the Small Ship, the Carrack) - her strake, accent and canvas
//     (world/ships/shipLiveryArt.js liveryArtOf), each picture in Daggerfall's look as her stand-ins are (world/dfLook.js,
//     her own record's grain); a see-through record twice - by day its glass cut out, at night whole with its glow (the
//     pool's own NIGHT_REMAP law, kept: a painted gallery is see-through by day and lit at night);
//   - a hull of our boats' own planks (OWN-WORK4: world/ships/ownBoats/ownBoatArt.js - the Rowboat, the Large Galley, and
//     a port hull's small things) - every wood record stained (systems/naval/shipLivery.js stainPicture);
//   - our boats' sailcloth (its canvas record, the Large Galley's sail) - tinted (SAIL_TINT).
import {
  LIVERY_ARCHIVE,
  SHIP_PAINTS,
  stainPicture,
  tintPicture,
  SAIL_TINT,
  liveryOfCode,
} from '../../systems/naval/shipLivery.js';
import { sailEmblemOf, sailEmblemKey } from './sailEmblem.js'; // Her guild's arms on her canvas
import { logoVersion } from '../../ui/guild/guildLogoImages.js';
import { liveryArtOf } from '../../world/ships/shipLiveryArt.js';
import { cutGlass } from '../../world/ships/galleonArt.js';
import { dfLook, lookSeed } from '../../world/dfLook.js';
import { toColor32 } from '../../formats/color32Order.js';
import { OWN_BOAT_ARCHIVE, OWN_TEX, OWN_WOOD_RECORDS, ownBoatArt } from '../../world/ships/ownBoats/ownBoatArt.js';

/** Our boats' plank archive, stained (its wood records, OWN_WOOD_RECORDS). */
export const PLANK_ARCHIVE = OWN_BOAT_ARCHIVE;
/** Our boats' sailcloth - their canvas record (each sail's ApplyGameTextures child names it). */
export const CLASSIC_SAIL = Object.freeze([OWN_BOAT_ARCHIVE, OWN_TEX.canvas]);
/** Our boats' pictures as painted (before Daggerfall's look), made once at the first paint that needs them. */
let _own = null;
const ownPicture = (record) => (_own ??= new Map(ownBoatArt())).get(record) ?? null;

/**
 * @param {{ renderer: any, pipeline: any, portArchiveOf: (hull: number) => number | null, log?: any }} deps - `portArchiveOf`
 *   the archive of the port's ship standing for a hull (null: the mod's own model)
 */
export function createLiveryPaint({ renderer, pipeline, portArchiveOf, log = console }) {
  /** Each pair of arms a sail has flown, its slot (1 up) - a paint's key carries it beside her code */
  const armsSlots = new Map();
  /** @type {WeakMap<any, { n: number, lv: number }>} a pair of arms' slot, as last asked */
  const slotOfArms = new WeakMap();
  /** @type {number[]} each slot's generation, and when it was last drawn */
  const slotGen = [],
    slotUsed = [];
  let useTick = 0;
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
    if (rec == null) {
      rec = next++;
      records.set(k, rec);
    }
    renderer.uploadTexture(LIVERY_ARCHIVE, rec, toColor32(pic), opts);
    if (glow) renderer.uploadEmissionTexture?.(LIVERY_ARCHIVE, rec, toColor32(glow), { replacement: false });
    return `${LIVERY_ARCHIVE}_${rec}`;
  }
  /** Every picture a livery repaints on a hull, painted and uploaded: `{ day, night }`. GUILD-SHOP: `code` is her livery's
   *  own (three bytes); a sailcloth flying arms is paintArmed's. */
  async function paint(hull, code) {
    const lv = liveryOfCode(code);
    const day = new Map(),
      night = new Map();
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
          day.set(src, key);
          night.set(src, key);
        }
      }
    }
    const stain = SHIP_PAINTS[lv.stain]?.rgb;
    if (stain) {
      for (const r of OWN_WOOD_RECORDS) {
        const pic = ownPicture(r);
        if (!pic) continue;
        const key = put(PLANK_ARCHIVE, r, code, 'd', dfLook(stainPicture(pic, stain), lookSeed(PLANK_ARCHIVE, r)));
        day.set(`${PLANK_ARCHIVE}_${r}`, key);
        night.set(`${PLANK_ARCHIVE}_${r}`, key);
      }
    }
    // The classic sail is tinted alone - its cloth's picture is tiled dozens of times over a sail, so
    // a sailcloth (a pattern, the arms) is a port hull's whole canvas only (shipLivery.js clothHull)
    const sail = SHIP_PAINTS[lv.sail]?.rgb;
    if (sail) {
      const pic = ownPicture(CLASSIC_SAIL[1]);
      if (pic) {
        const key = put(
          CLASSIC_SAIL[0],
          CLASSIC_SAIL[1],
          code,
          'd',
          dfLook(tintPicture(pic, sail, SAIL_TINT), lookSeed(CLASSIC_SAIL[0], CLASSIC_SAIL[1])),
        );
        day.set(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`, key);
        night.set(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`, key);
      }
    }
    return { day, night };
  }
  /** Her paint with her guild's arms on her canvas - her paint as made without them (`base`), its canvas alone
   *  painted again with the emblem (AUDIT GUILD-SHOP N2: every other record is the same picture, never painted twice). */
  function paintArmed(hull, code, own, base, arms) {
    const lv = liveryOfCode(code),
      port = portArchiveOf(hull);
    if (!lv || port == null) return base;
    const day = new Map(base.day),
      night = new Map(base.night);
    for (const { record, picture } of liveryArtOf(port, lv, sailEmblemOf(arms), { canvasOnly: true })) {
      const key = put(port, record, own, 'd', dfLook(picture, lookSeed(port, record)));
      day.set(`${port}_${record}`, key);
      night.set(`${port}_${record}`, key);
    }
    return { day, night };
  }
  /** A hull's paint's maps once made - null while they are made (and the making begun), or where it failed. GUILD-SHOP:
   *  a sailcloth flying arms is made a pair of arms at a time, its slot over the 24 bits of her code - and while it is
   *  made, she wears her paint without them (AUDIT GUILD-SHOP N3: she drew as built a frame each time arms came in). */
  function mapsOf(hull, code, arms = null) {
    const key = hull * 0x100000000 + code;
    const base = made.has(key) ? made.get(key) : (begin(key, () => paint(hull, code)), null);
    if (!base || !((code >> 16) & 128) || !arms) return base;
    const slot = armsSlotOf(arms),
      own = code + slot * 0x1000000,
      armed = hull * 0x100000000 + own;
    if (made.has(armed)) return made.get(armed) ?? base;
    const gen = slotGen[slot];
    if (renderer?.uploadTexture) {
      made.set(armed, null);
      Promise.resolve()
        .then(() => {
          if (slotGen[slot] === gen) made.set(armed, paintArmed(hull, code, own, base, arms));
          else made.delete(armed);
        })
        .catch((e) => {
          log?.warn?.(e);
        });
    } // her paint without the arms stands
    return base;
  }
  /** One making begun, once - its maps, or null where it failed. */
  function begin(key, run) {
    if (making.has(key) || !renderer?.uploadTexture || !pipeline?.getTexture) return;
    making.add(key);
    run()
      .then(
        (m) => {
          made.set(key, m);
        },
        (e) => {
          made.set(key, null);
          log?.warn?.("[livery] a ship's paint could not be made - she is drawn as built", e);
        },
      )
      .finally(() => making.delete(key));
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
    if (!by) {
      by = new Map();
      joined.set(base, by);
    }
    let j = by.get(own);
    if (!j) {
      j = new Map([...base, ...own]);
      by.set(own, j);
      ownOf.set(j, own);
    }
    return j;
  }
  /** A pair of arms' slot, 1 to 255 - kept on the arms object for as long as no logo comes in (AUDIT GUILD-SHOP
   *  N7: no string made a frame). Past 255, the slot least lately drawn is given again, its paints made again under a
   *  new generation, so a making still out for the old arms lands as nothing. */
  function armsSlotOf(arms) {
    const lv = logoVersion(),
      held = slotOfArms.get(arms);
    if (held && held.lv === lv) {
      slotUsed[held.n] = ++useTick;
      return held.n;
    }
    const k = sailEmblemKey(arms);
    let n = armsSlots.get(k);
    if (n == null) {
      n = armsSlots.size < 255 ? armsSlots.size + 1 : leastUsedSlot();
      for (const [old, m] of armsSlots) if (m === n) armsSlots.delete(old);
      for (const key of made.keys()) if (Math.floor(key / 0x1000000) % 256 === n) made.delete(key);
      // And its pictures let go - put's key is the same for the new arms, and the renderer keeps a key it has
      for (const [key, rec] of records)
        if (Math.floor(Number(key.split('|')[1]) / 0x1000000) % 256 === n) {
          renderer.releaseTexture?.(LIVERY_ARCHIVE, rec);
          records.delete(key);
        }
      slotGen[n] = (slotGen[n] ?? 0) + 1;
      armsSlots.set(k, n);
    }
    slotOfArms.set(arms, { n, lv });
    slotUsed[n] = ++useTick;
    return n;
  }
  const leastUsedSlot = () => {
    let best = 1;
    for (let n = 2; n <= 255; n++) if ((slotUsed[n] ?? 0) < (slotUsed[best] ?? 0)) best = n;
    return best;
  };
  /** A joined remap -> the paint's own keys in it. */
  const ownOf = new WeakMap();
  /** Mesh -> (own map -> whether any of its sub-meshes' pictures is one the paint repaints). */
  const touched = new WeakMap();
  /**
   * The remap `mesh` is drawn by - her paint's (`remap`) only where it repaints one of its pictures, else the
   * host's `base`. The renderer caches each sub-mesh's picture by its remap's identity, and Daggerfall's models are
   * shared by every boat that hangs them: two boats of one hull in two paints (SEA-COLOURS: most of a sea) missed that
   * cache on every sub-mesh of every shared model every frame, and made its key's string again each time.
   */
  function remapFor(mesh, remap, base) {
    if (remap === base || !remap || !mesh?.subMeshes) return remap;
    const own = ownOf.get(remap) ?? remap;
    let by = touched.get(mesh);
    if (!by) {
      by = new WeakMap();
      touched.set(mesh, by);
    }
    let v = by.get(own);
    if (v === undefined) {
      v = mesh.subMeshes.some((sm) => own.has(`${sm.textureArchive}_${sm.textureRecord}`));
      by.set(own, v);
    }
    return v ? remap : base;
  }
  return { remapOf, remapFor, mapsOf, _records: records };
}
