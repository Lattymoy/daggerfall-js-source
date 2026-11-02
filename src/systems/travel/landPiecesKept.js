// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE LAND'S PIECES, KEPT.
// The living world's first way (livingWorld/ways.js) folds the land into pieces (travelRoute.js routeGround `pieces`),
// 160 ms in the first frame of every warm launch. The pieces depend on the ground and the drawn network only, so they are
// kept in the derived store. The key holds:
//   - firstVisitPin('landPieces'), the pin of the fold's code (tools/computationPin.mjs);
//   - an FNV-1a stamp over every byte the fold reads (2 MB, a few ms).
// A different ground or network is a different key and sweeps the last (`fv-pieces:`).

import { fnv1a, derivedValueStore, keepAnswer, firstVisitPin } from '../firstVisit/firstVisitStore.js';

/** The cache's scope: one network's pieces, the last folded. */
export const LAND_PIECES_SCOPE = 'fv-pieces:';

const EMPTY = new Uint8Array(0);

/** The key for a ground's pieces over a network. @param {ReturnType<import('./travelRoute.js').routeGround>} ground */
export function landPiecesKey(ground, roads, tracks) {
  const { climate, heights, waterByte, width, height } = ground.pieceInputs();
  let h = fnv1a(climate);
  h = fnv1a(heights, h);
  h = fnv1a(roads ?? EMPTY, h);
  h = fnv1a(tracks ?? EMPTY, h);
  return `${LAND_PIECES_SCOPE}${firstVisitPin('landPieces')}:${width}x${height}:${waterByte}:${roads ? 'r' : '-'}${tracks ? 't' : '-'}:${h.toString(36)}`;
}

/**
 * The ground's pieces over this network: the kept ones adopted, or folded now and kept. Answers whether they were kept.
 * Null (nothing to wait for) with no store (node, no IndexedDB) or a ground that cannot say what it folds.
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
    // not awaited: the pieces are folded and held by the ground, and the ways wait on this promise
    keepAnswer(store, key, ground.landPieces(roads, tracks), LAND_PIECES_SCOPE).catch(() => {});
    return false;
  })();
}
