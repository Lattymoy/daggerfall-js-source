// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE LAND'S PIECES, KEPT.
//
// The living world's first way (livingWorld/ways.js) folds the land into pieces (travelRoute.js routeGround `pieces`:
// which pixels a walk can join, over half a million of them) - 160 ms inside the first frame of a warm launch, every
// launch, for the same answer. The pieces are a function of the ground (the climate and heightmap bytes and the water
// line) and the drawn network (the road and track bytes), so they are kept in the player's derived store under:
//   - LAND_PIECES_VERSION, bumped by hand when the step law or the fold changes shape;
//   - an FNV-1a stamp over every byte the fold reads (2 MB, a few milliseconds - next to the fold, nothing).
// A different ground or network is a different key: worked out again and kept under its own.

import { fnv1a, derivedValueStore } from '../firstVisit/firstVisitStore.js';

/** Bump when the step law (travelRoute.js stepKind) or the fold changes shape. */
export const LAND_PIECES_VERSION = 1;

const EMPTY = new Uint8Array(0);

/** The key for a ground's pieces over a network. @param {ReturnType<import('./travelRoute.js').routeGround>} ground */
export function landPiecesKey(ground, roads, tracks) {
  const { climate, heights, waterByte, width, height } = ground.pieceInputs();
  let h = fnv1a(climate);
  h = fnv1a(heights, h);
  h = fnv1a(roads ?? EMPTY, h);
  h = fnv1a(tracks ?? EMPTY, h);
  return `fv-pieces:v${LAND_PIECES_VERSION}:${width}x${height}:${waterByte}:${roads ? 'r' : '-'}${tracks ? 't' : '-'}:${h.toString(36)}`;
}

/**
 * The ground's pieces over this network: the kept ones adopted, or folded now and kept. Answers whether they were kept.
 * Null (nothing to wait for) where there is no store - node, or a browser without IndexedDB - and for a ground that
 * cannot say what it folds.
 * @param {any} ground - travelRoute.js routeGround's
 * @param {{ roads?: any, tracks?: any }} net
 * @param {{ get(k: string): Promise<any>, set(k: string, v: any): Promise<any> } | null} [store]
 * @returns {Promise<boolean> | null}
 */
export function keepLandPieces(ground, { roads = null, tracks = null } = {}, store = derivedValueStore()) {
  if (!store || typeof ground?.pieceInputs !== 'function') return null;
  const key = landPiecesKey(ground, roads, tracks);
  const n = ground.pieceInputs().width * ground.pieceInputs().height;
  return (async () => {
    const hit = await store.get(key);
    if (hit instanceof Int32Array && hit.length === n) {
      ground.adoptPieces(roads, tracks, hit);
      return true;
    }
    await store.set(key, ground.landPieces(roads, tracks));
    return false;
  })();
}
