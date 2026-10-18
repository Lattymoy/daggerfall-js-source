// @ts-check
// CABIN-LOOK (2026-10-17, the owner: "Letting players customize the exterior and interior textures of the ship";
// bible/03-World/Naval-Refit.md SHIP-LIVERY) - A SHIP'S CABIN STAINED: every picture of the room built below her deck (the
// bank ship's interior, scenes/sailingCabin.js) given a stained twin of its own (systems/naval/shipLivery.js stainPicture,
// at CABIN_STAIN), drawn by the room's own remap over the climate's (scenes/interiorContext.js `restyle`) - her walls,
// floor, beams and built furniture one wood, its grain kept. A picture that is glass (a window's mask) is left as built,
// so her windows light as they did. The stain is her Fleet record's (`cabin`), made at the visit below.
import { SHIP_PAINTS, tintPicture } from '../systems/naval/shipLivery.js';
import { classicPictureOf } from '../formats/derivedTexture.js';
import { toColor32 } from '../formats/color32Order.js';
import { dfLook, lookSeed } from '../world/dfLook.js';

/** The pseudo-archive a cabin's stained pictures go up under. */
export const CABIN_ARCHIVE = 38192;
/** How much of the stain lies over the room's pictures. */
export const CABIN_STAIN = 0.55;

const _records = new Map();   // `${key}|${paint}` -> record
let _next = 0;

/**
 * The room's restyle for a cabin stained `paint` (null for one as built): `(texRemap, subMeshLists, deps)` - each
 * picture the room's models wear (its key as the climate resolves it) stained, uploaded under CABIN_ARCHIVE and set in the
 * room's remap in its place, before the room's batch is made.
 * @param {number} paint - a paint's index (0 none)
 */
export function cabinRestyle(paint) {
  const rgb = SHIP_PAINTS[paint]?.rgb;
  if (!rgb) return null;
  return async (texRemap, lists, { renderer, getTexture, palette }) => {
    if (!renderer?.uploadTexture) return;
    const seen = new Set();
    for (const list of lists) for (const sm of list ?? []) {
      const own = `${sm.textureArchive}_${sm.textureRecord}`;
      if (seen.has(own)) continue;
      seen.add(own);
      const key = texRemap.get(own) ?? own;
      if (renderer.windowMasks?.has?.(key) || renderer.glassMasks?.has?.(key)) continue;   // glass: lit as built
      const [archive, record] = key.split('_').map(Number);
      const pic = await classicPictureOf(getTexture, palette, archive, record);
      if (!pic) continue;
      const k = `${key}|${paint}`;
      let rec = _records.get(k);
      if (rec == null) { rec = _next++; _records.set(k, rec); }
      renderer.uploadTexture(CABIN_ARCHIVE, rec, toColor32(dfLook(tintPicture(pic, rgb, CABIN_STAIN), lookSeed(archive, record))), { opaque: true });
      texRemap.set(own, `${CABIN_ARCHIVE}_${rec}`);
    }
  };
}
