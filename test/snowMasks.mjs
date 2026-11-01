// THE SNOW'S SURFACE MASKS THE PINS STAND ON. Snowfall's own three masks are retired with
// vendor/snowfall/, and ours are laid at runtime by our snow law over the player's own winter records
// (src/systems/ownTextures/ownTexturePacks.js ownSnowMasks), which no pin may carry. So the pins lay the same law over a
// made-up winter set drawn from the ground's own layout: snow, with water where the marching squares put a record's
// water corners (world/terrain/groundEdge.js) and on record 0, and grey paving on Daggerfall's road (46, whole) and its
// two flanks (47 and 55, half). Nothing here is Daggerfall's or an author's.
import { snowMask } from '../src/systems/ownTextures/ownTextureRules.js';
import { groundKindsOf, cornerShare, GROUND_KIND } from '../src/world/terrain/groundEdge.js';
import { SNOW_MASK_ARCHIVES } from '../src/systems/snowfall.js';

const SNOW = [230, 232, 240],
  WATER = [40, 80, 150],
  PAVING = [112, 112, 112];

/** A made-up winter record, 64 x 64, top-down RGBA. */
export function madeUpWinterRecord(record) {
  const data = new Uint8Array(64 * 64 * 4);
  const k = groundKindsOf(record << 2);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const fx = (x + 0.5) / 64,
        fy = 1 - (y + 0.5) / 64; // the tile's frame: v = 0 is the record's bottom row
      let c = SNOW;
      if (record === 0) c = WATER;
      else if (record === 46) c = PAVING;
      else if (record === 47 || record === 55) c = fx > 1 - fy ? PAVING : SNOW;
      else if (k) {
        const kind = cornerShare(k.mask, fx, fy) >= 0.5 ? k.b : k.a;
        c = kind === GROUND_KIND.water ? WATER : SNOW;
      }
      // a speckle, as a classic snow record has one
      const speck = (x * 7 + y * 13) % 29 === 0 ? -18 : 0;
      data.set([c[0] + speck, c[1] + speck, c[2] + speck, 255], (y * 64 + x) * 4);
    }
  return { width: 64, height: 64, data };
}

/** The three winter archives' masks (SNOW_MASK_ARCHIVES' order), our law over the made-up set. */
export const MASKS = SNOW_MASK_ARCHIVES.map(() => {
  const out = new Uint8Array(56 * 4096);
  for (let r = 0; r < 56; r++) out.set(snowMask(madeUpWinterRecord(r)), r * 4096);
  return out;
});
