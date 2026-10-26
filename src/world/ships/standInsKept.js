// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE SHIPS' PAINTED PICTURES, KEPT.
//
// The galleon's, the carrack's and the large boat's pictures are painted by the build's own code (galleonArt.js
// shipStandIns: planks, liveries, glass) and laid in Daggerfall's colours from the player's ART_PAL.COL (dfLook.js) the
// first time the boats' pool asks for their archive - 130 ms of one frame on a warm launch, every launch. A picture is
// a function of the build and the palette alone, so it is kept in the player's derived store under:
//   - STAND_INS_VERSION, bumped by hand when what is kept changes shape;
//   - the build (BUILD_TAG), so a release that repaints a ship never reads an older picture;
//   - the picture's own name, and a stamp over the palette's 256 colours.
// A RENDER OF GAME DATA IS GAME DATA (bible/01-Overview/Port-Doctrine.md): the palette is the player's, so a picture lives
// in the player's own store only - never written into the repository, never shipped.

import { BUILD_TAG } from '../../buildTag.js';
import { fnv1a, keptAnswer, derivedValueStore } from '../../systems/firstVisit/firstVisitStore.js';
import { dfLookPaletteRgb } from '../dfLook.js';

/** Bump when a kept picture changes shape. */
export const STAND_INS_VERSION = 1;

/** The key of one picture as the palette now stands. */
export function standInKey(fileName) {
  const rgb = dfLookPaletteRgb();
  return `fv-standin:v${STAND_INS_VERSION}:${fileName}:${BUILD_TAG}:${rgb ? fnv1a(rgb).toString(36) : 'painted'}`;
}

let _store = null;
/** Test seam: the store the ships' pictures are kept in (node has no IndexedDB); null for the player's. */
export function _setStandInStoreForTests(store) { _store = store ?? null; }

/** A picture as dfLook answers one: top-down RGBA of its size. */
const isPicture = (v) => !!v && Number.isInteger(v.width) && Number.isInteger(v.height) && v.data instanceof Uint8Array && v.data.length === v.width * v.height * 4;

/**
 * One painted picture: the kept one, or `paint()`'s, kept. With no store, `paint()`'s.
 * @param {string} fileName - the stand-in's name on the texture door
 * @param {() => any} paint
 */
export async function keptStandIn(fileName, paint, store = _store ?? derivedValueStore()) {
  if (!store) return paint();
  const { value } = await keptAnswer({ key: standInKey(fileName), build: paint, accept: isPicture, store });
  return value;
}
