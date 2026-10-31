// NO-BETHESDA2 (2026-10-31, the owner: "ensuring they are not implemented"): EYE OF THE BEHOLDER'S PICTURES, FOR THE
// TOOLS AND THE PINS. 2869 of the mod's 3035 are Daggerfall's own records and are not carried: derived.json names each
// one's record and palette (tools/classicDerive.mjs). The author's own 166 are files under Textures/. A tool reads a
// sprite by its name here: the file, or the spec built from the player's ARENA2 (formats/classicPictures.js).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from '../pngIO.mjs';
import { createClassicPictures } from '../../src/formats/classicPictures.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EOTB_TEXTURES = join(ROOT, 'vendor/eye-of-the-beholder/Textures');
export const EOTB_DERIVED = Object.freeze(
  JSON.parse(readFileSync(join(ROOT, 'vendor/eye-of-the-beholder/derived.json'), 'utf8')),
);

/** The file a sprite name stands in (`<archive>_<record>-<frame>`), whether or not it is there. */
export const eotbFileOf = (key, dir = EOTB_TEXTURES) => join(dir, key.split('_')[0], `${key}.png`);
/** Whether the mod has a sprite of this name: a file, or a spec. */
export const eotbHas = (key, dir = EOTB_TEXTURES) =>
  Object.hasOwn(EOTB_DERIVED, key) || existsSync(eotbFileOf(key, dir));

/** A reader of the mod's sprites as top-down RGBA `{ width, height, data }`: a file as it is, a spec built from
 *  `arena2`'s TEXTURE file. A spec with no ARENA2 rejects, saying so. */
export function eotbPictures({ arena2 = process.env.ARENA2_PATH, dir = EOTB_TEXTURES } = {}) {
  const classic = createClassicPictures(async (name) => {
    if (!arena2) throw new Error(`${name}: ARENA2_PATH is not set (sh tools/fetch-data.sh)`);
    return readFileSync(join(arena2, name));
  });
  /** @returns {Promise<{width:number, height:number, data:Uint8Array|Uint8ClampedArray}>} */
  async function picture(key) {
    if (Object.hasOwn(EOTB_DERIVED, key)) return classic.build(EOTB_DERIVED[key]);
    return readPng(readFileSync(eotbFileOf(key, dir)));
  }
  /** The sprite as a PNG data URL, for a probe's page. */
  const dataUrl = async (key) => `data:image/png;base64,${writePng(await picture(key)).toString('base64')}`;
  return { picture, dataUrl };
}
