// NO-BETHESDA2 (2026-10-31; the owner: "ensuring they are not implemented"): a vendored mod's picture that is
// Daggerfall's own (its derived.json names it, tools/classicDerive.mjs) is built from the player's files here, never
// fetched. It comes back as the browser's decode of the mod's PNG gave it: a clear pixel reads 0,0,0,0, as a canvas
// decode zeroes it, whatever colour the author's file kept under it - so a texture's filtering sees what it saw before.
import { classicArt } from './classicArt.js';

/** The spec's picture, top-down RGBA `{ width, height, data }`. `art` is a classicPictures reader (the session's
 *  own by default; a test hands its own). Rejects where the player's file has no such record. */
export async function rebuiltPicture(spec, art = classicArt()) {
  const pic = await art.build(spec);
  const d = pic.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] === 0) { d[i - 3] = 0; d[i - 2] = 0; d[i - 1] = 0; }
  return pic;
}
