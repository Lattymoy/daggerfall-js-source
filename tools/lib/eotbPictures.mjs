// EYE OF THE BEHOLDER'S PICTURES, FOR THE TOOLS AND THE PINS. 2869 of the mod's 3035 are Daggerfall's own records and
// are not carried: eotbDerived.json names each one's record and palette (tools/classicDerive.mjs). OWN-WORK4: the
// other 166, the author's death, are ours (player/eyeOfTheBeholder/eotbDeath.js). A tool reads a sprite by its name
// here, built from the player's ARENA2.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from '../pngIO.mjs';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { deathSpec, layDown } from '../../src/player/eyeOfTheBeholder/eotbDeath.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EOTB_DERIVED = Object.freeze(
  JSON.parse(readFileSync(join(ROOT, 'src/player/eyeOfTheBeholder/eotbDerived.json'), 'utf8')),
);

/** A sprite's spec: eotbDerived.json's, or our death's (`laid` set for a body laid down). */
export const eotbSpecOf = (key) => EOTB_DERIVED[key] ?? deathSpec(key, EOTB_DERIVED);
/** Whether the mod has a sprite of this name. */
export const eotbHas = (key) => eotbSpecOf(key) != null;

/** A reader of the mod's sprites as top-down RGBA `{ width, height, data }`, each built from `arena2`'s TEXTURE file.
 *  With no ARENA2 it rejects, saying so. */
export function eotbPictures({ arena2 = process.env.ARENA2_PATH } = {}) {
  const classic = createClassicPictures(async (name) => {
    if (!arena2) throw new Error(`${name}: ARENA2_PATH is not set (sh tools/fetch-data.sh)`);
    return readFileSync(join(arena2, name));
  });
  /** @returns {Promise<{width:number, height:number, data:Uint8Array|Uint8ClampedArray}>} */
  async function picture(key) {
    const spec = eotbSpecOf(key);
    if (!spec) throw new Error(`${key}: no such sprite`);
    if (spec.laid == null) return classic.build(spec);
    return layDown(await classic.build({ from: spec.from, pal: spec.pal }), spec.laid);
  }
  /** The sprite as a PNG data URL, for a probe's page. */
  const dataUrl = async (key) => `data:image/png;base64,${writePng(await picture(key)).toString('base64')}`;
  return { picture, dataUrl };
}
