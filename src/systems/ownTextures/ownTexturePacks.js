// @ts-check
// OWN-WORK4 (2026-10-31; the owner: "Our goal is no latching onto other mod authors or needing permissions") - THE
// TEXTURE PACKS, OUR OWN. Vanilla Enhanced's three mods, Sands of the Alik'r and Snowfall's winter ground were outside
// authors' repaints of Daggerfall's textures; they are retired. Each keeps the interface the player had - its key,
// title, switch, dependencies, arrays and the records and sizes it dresses (ownTexturePacks.json) - and each picture is
// ours: the player's own classic record under one of our rules (ownTextureRules.js). This says which record and rule.
import listing from './ownTexturePacks.json' with { type: 'json' };
import { wrapsOf, recordSeed, snowMask } from './ownTextureRules.js';

/** @typedef {{ rule: string, from: number[], fallback?: number[], w: number, h: number, wrap?: boolean, fromSummer?: boolean, road?: false | 'full' | 'flank', seed: number }} OwnSpec */

/** The packs: `{ key, dir, rule, index }`, `index` in the door's own shape (dfmodTextures.js buildDfmodIndex). */
export const OWN_TEXTURE_PACKS = Object.freeze(listing.Mods.map((m) => Object.freeze({ ...m })));

const NAME = /^(\d+)_(\d+)-(\d+)$/;
const ARRAY = /^(\d+)-TexArray$/;
/** Daggerfall's road (46) and its two flanks (47 by dirt, 55 by grass) in every terrain set (world/road/roadPainter.js). */
export const ROAD_RECORDS = Object.freeze([46, 47, 55]);
/** A record's road: the paving whole (46), a flank (47, 55), or none. */
const roadOf = (record) => (record === ROAD_RECORDS[0] ? 'full' : ROAD_RECORDS.includes(record) ? 'flank' : false);
/** A climate's terrain set - the ground's 56 records (002-004, 102-104, 302-304, 402-404). */
export const isTerrainSet = (archive) => archive < 500 && [2, 3, 4].includes(archive % 100);
/** The ground Snowless Swamps and Jungles keeps green: the swamp's summer set. Every other archive it names is a winter
 *  set, built from its summer set (the archive before it) - no snow. */
const SWAMP_SUMMER = 402;

/** The spec for record (archive, record, frame) of a pack at w x h - which classic record our rule reads, and how. The
 *  grain's seed is the record read, so one record under one rule is one picture, whichever name asks for it. */
function specOf(mod, archive, record, frame, w, h) {
  const seed = recordSeed(archive, record, frame);
  switch (mod.rule) {
    case 'enhance':
      return { rule: 'enhance', from: [archive, record, frame], w, h, wrap: wrapsOf(archive), seed };
    case 'road':
      return isTerrainSet(archive) && ROAD_RECORDS.includes(record)
        ? { rule: 'road', from: [archive, record, frame], w, h, seed }
        : { rule: 'enhance', from: [archive, record, frame], w, h, wrap: wrapsOf(archive), seed };
    case 'snowless': {
      const summer = archive === SWAMP_SUMMER ? archive : archive - 1;
      return {
        rule: 'enhance',
        from: [summer, record, frame],
        w,
        h,
        wrap: wrapsOf(summer),
        seed: recordSeed(summer, record, frame),
      };
    }
    case 'desert':
      // a road record keeps its paving: 46 whole, its flanks (47, 55) on their paved half
      return {
        rule: 'desert',
        from: [archive, record, frame],
        w,
        h,
        seed,
        ...(roadOf(record) && { road: roadOf(record) }),
      };
    case 'snow':
      // Daggerfall's own winter record; where the player's data has none, our snow over the summer record
      return { rule: 'snow', from: [archive, record, frame], fallback: [archive - 1, record, frame], w, h, seed };
    default:
      return null;
  }
}

/** A name the pack carries, as its spec - or null where the pack carries no such name. */
export function ownSpec(mod, name) {
  const t = mod.index.textures.find((x) => x[0] === name);
  const m = t && NAME.exec(name);
  return m ? specOf(mod, Number(m[1]), Number(m[2]), Number(m[3]), t[1], t[2]) : null;
}

/** An array's slices as specs, one a record - or null where the pack carries no slices for it: no such array, or one
 *  not 56 deep (the door refuses an array whose depth is not the archive's, as DFU does). */
export function ownSliceSpecs(mod, arrayName) {
  const a = mod.index.arrays.find((x) => x[0] === arrayName);
  const m = a && ARRAY.exec(arrayName);
  if (!m || a[3] !== 56) return null;
  return Array.from({ length: a[3] }, (_, r) => specOf(mod, Number(m[1]), r, 0, a[1], a[2]));
}

/** A spec's cache key: the rule, the record it reads and the size. */
export const specKey = (spec) => `${spec.rule}:${spec.from.join('_')}:${spec.w}x${spec.h}`;

/**
 * THE SNOW'S SURFACE MASKS, OURS: for each winter archive (`archives`, systems/snowfall.js SNOW_MASK_ARCHIVES), its 56
 * records' masks (ownTextureRules.js snowMask) laid end to end, 64 x 64 bytes each. `picture(archive, record)` reads
 * the player's own record (systems/classicArt.js); a winter record the data lacks is read from the summer set under our
 * snow (fromSummer), and a record neither has is all snow. An archive with no record at all is refused.
 * @param {number[]} archives @param {(archive: number, record: number) => Promise<any>} picture
 */
export async function ownSnowMasks(archives, picture) {
  const masks = [];
  for (const a of archives) {
    const out = new Uint8Array(56 * 4096).fill(255);
    let read = 0;
    for (let r = 0; r < 56; r++) {
      if (r % 8 === 0) await new Promise((go) => setTimeout(go, 0)); // a few records a task: the page keeps its frames
      let src = await picture(a, r).catch(() => null),
        fromSummer = false;
      if (!src) {
        src = await picture(a - 1, r).catch(() => null);
        fromSummer = true;
      }
      if (src?.width !== 64 || src.height !== 64) continue;
      out.set(snowMask(src, { fromSummer }), r * 4096);
      read++;
    }
    if (!read) throw new Error(`TEXTURE.${String(a).padStart(3, '0')}: no record to lay the snow by`);
    masks.push(out);
  }
  return masks;
}
