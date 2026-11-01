// OWN-WORK4 (2026-10-31): THE CART'S HORSE, FOR THE TOOLS AND THE PINS. The 45 pictures are ours, built from the
// player's ARENA2 (src/systems/horse/horseArt.js). A tool or a pin reads one by its name here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { ownHorsePicture } from '../../src/systems/horse/horseArt.js';

/** A reader of the horse's pictures as top-down RGBA `{ width, height, data }`, built from `arena2`'s TEXTURE.495. With
 *  no ARENA2 it rejects, saying so. */
export function horsePictures({ arena2 = process.env.ARENA2_PATH } = {}) {
  const art = createClassicPictures(async (name) => {
    if (!arena2) throw new Error(`${name}: ARENA2_PATH is not set (sh tools/fetch-data.sh)`);
    return readFileSync(join(arena2, name));
  });
  return { picture: (/** @type {string} */ file) => ownHorsePicture(file, { art }) };
}
