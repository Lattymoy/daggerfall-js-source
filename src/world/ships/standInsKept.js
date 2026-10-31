// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE SHIPS' PAINTED PICTURES, KEPT.
// The galleon, carrack and large boat pictures are painted by galleonArt.js shipStandIns in the colours of the player's
// ART_PAL.COL (dfLook.js): 130 ms of one frame on every warm launch. A picture depends on the build and the palette only,
// so it is kept in the derived store. The key holds:
//   - the scope `fv-standin:<name>:` (one answer a picture, a new one sweeps the last);
//   - firstVisitPin('standIns'), the pin of the painting's code (tools/computationPin.mjs);
//   - a stamp over the palette's 256 colours.
// A RENDER OF GAME DATA IS GAME DATA (Port-Doctrine.md): the picture stays in the player's store, never in the repository.

import { fnv1a, keptAnswer, derivedValueStore, firstVisitPin } from '../../systems/firstVisit/firstVisitStore.js';
import { dfLookPaletteRgb } from '../dfLook.js';

/** One picture's scope. */
export const standInScope = (fileName) => `fv-standin:${fileName}:`;

/** The key of one picture as the palette now stands. */
export function standInKey(fileName) {
  const rgb = dfLookPaletteRgb();
  return `${standInScope(fileName)}${firstVisitPin('standIns')}:${rgb ? fnv1a(rgb).toString(36) : 'painted'}`;
}

let _store = null;
/** Test seam: the store the ships' pictures are kept in (node has no IndexedDB); null for the player's. */
export function _setStandInStoreForTests(store) {
  _store = store ?? null;
}

/** A picture as dfLook answers one: top-down RGBA of its size. */
const isPicture = (v) =>
  !!v &&
  Number.isInteger(v.width) &&
  Number.isInteger(v.height) &&
  v.data instanceof Uint8Array &&
  v.data.length === v.width * v.height * 4;

/**
 * One painted picture: the kept one, or `paint()`'s, kept. With no store, `paint()`'s.
 * @param {string} fileName - the stand-in's name on the texture door
 * @param {() => any} paint
 */
export async function keptStandIn(fileName, paint, store = _store ?? derivedValueStore()) {
  if (!store) return paint();
  const { value } = await keptAnswer({
    key: standInKey(fileName),
    scope: standInScope(fileName),
    build: paint,
    accept: isPicture,
    store,
  });
  return value;
}
