// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE BOOT WALKS' GROUND TILES, KEPT.
//
// The boot reads SetLocationTiles' rect for every Bay town Deep Waters blends and every Eltheric isle template
// (terrainTiles.js locationRectReader, BOOT-RECTS). The rect reads one thing of a block - its ground tiles - but
// the block is served whole through the world-data door, and with a town pack on that is a pack file rebuilt for
// each of some 400 blocks: 1.1 s of a warm launch's 2.7 s boot stall, every launch, for the same answer.
//
// So each block's ground tiles are kept in the player's derived store, one record for the walks, keyed on:
//   - GROUND_TILES_VERSION, the pin of what computes a block's tiles (tools/computationPin.mjs: the classic reader, the
//     world-data door, the packs, patches, the arena's block and the carriages' layer, and the mods' shipped world data);
//   - BLOCKS.BSA's stamp (firstVisitStore.js bytesStamp);
//   - what the door serves blocks by (worldDataReplacement.js worldDataBlocksServing: the gate, each block file's mod
//     and pack version, the port's blocks, the layers on).
// One record: a new one sweeps the last (`fv-ground:`).
// Inside the record a walk's blocks are kept under the walk's own name (its `as` fields): a block reads alike at every
// location a walk reads it at (locationRectReader's own law), not necessarily at every walk's.
// A pinned town is read through by locationRectReader as before and never reaches this; while any block variant is set
// nothing is read from the record or added to it.
//
// The record is fetched once, before the walks (prefetchGroundTiles, from the mod world-data loader that opens the
// door they read through), so the walks stay synchronous; what they add is written back a moment later. The fetch
// installs this module as terrainTiles.js's keeper - the walks' module never imports the store.

import { bytesStamp, textStamp, derivedValueStore, keepAnswer } from '../../systems/firstVisit/firstVisitStore.js';
import { anyBlockVariant } from '../../systems/worldDataVariants.js';
import { setGroundTilesKeeper } from './terrainTiles.js';

/** Set to `node tools/computationPin.mjs`'s pin of this computation (test/systems/firstVisit/fv_versions.test.js holds it
 *  there): a change to the code that computes the answer is a new key, and nothing else is. */
export const GROUND_TILES_VERSION = '2c74e194';
/** The cache's scope: one record, the last written. */
export const GROUND_TILES_SCOPE = 'fv-ground:';

const TILES = 16;   // RMB_TILES_PER_BLOCK
const SAVE_AFTER_MS = 2000;

/** @type {{ key: string, walks: Map<string, Map<string|number, Int32Array>>, store: any, added: boolean, timer: any } | null} */
let kept = null;

/** The record's key for these inputs. @param {Uint8Array|null} blocksBytes @param {string} serving */
export function groundTilesKey(blocksBytes, serving) {
  const stamp = bytesStamp(blocksBytes);
  return stamp ? `${GROUND_TILES_SCOPE}${GROUND_TILES_VERSION}:${stamp}:${textStamp(serving)}` : null;
}

/** A stored record is a Map of walk name -> Map of block name -> 512 numbers. */
function isRecord(v) {
  if (!(v instanceof Map)) return false;
  for (const walk of v.values()) {
    if (!(walk instanceof Map)) return false;
    for (const t of walk.values()) if (!(t instanceof Int32Array) || t.length !== TILES * TILES * 2) return false;
  }
  return true;
}

/**
 * Fetch the kept tiles for these blocks as the door now serves them. Answers whether a record was found.
 * @param {{ blocksBytes: Uint8Array|null, serving: string, store?: any }} o
 */
export async function prefetchGroundTiles({ blocksBytes, serving, store = derivedValueStore() }) {
  setGroundTilesKeeper(keptGroundTiles);
  const key = groundTilesKey(blocksBytes, serving);
  if (!key) { kept = null; return false; }
  if (kept?.key === key) return kept.walks.size > 0;
  const hit = store ? await store.get(key) : null;
  kept = { key, walks: isRecord(hit) ? hit : new Map(), store, added: false, timer: null };
  return isRecord(hit);
}

/** The tiles as setLocationTiles reads them: groundTiles[x][y].tileBitfield / .textureRecord. */
function unpack(t) {
  const out = [];
  for (let x = 0; x < TILES; x++) {
    const col = [];
    for (let y = 0; y < TILES; y++) { const i = (x * TILES + y) * 2; col.push({ tileBitfield: t[i], textureRecord: t[i + 1] }); }
    out.push(col);
  }
  return out;
}
function pack(groundTiles) {
  const t = new Int32Array(TILES * TILES * 2);
  for (let x = 0; x < TILES; x++) {
    for (let y = 0; y < TILES; y++) { const tile = groundTiles[x][y]; const i = (x * TILES + y) * 2; t[i] = tile.tileBitfield; t[i + 1] = tile.textureRecord; }
  }
  return t;
}

/**
 * One block's ground tiles for a walk: the kept ones, or `read()`'s (the block as the door serves it), kept.
 * @param {string} walk - the walk's name @param {string|number} block - the block's name (its index where the reader
 *   cannot name it): a pack's new blocks take their indices in the order the index meets them, not promised the same
 *   on the next launch
 * @param {() => any[][] | null | undefined} read
 */
export function keptGroundTiles(walk, block, read) {
  if (!kept || anyBlockVariant()) return read();
  const tiles = kept.walks.get(walk)?.get(block);
  if (tiles) return unpack(tiles);
  const groundTiles = read();
  if (groundTiles?.length !== TILES) return groundTiles;
  let m = kept.walks.get(walk);
  if (!m) { m = new Map(); kept.walks.set(walk, m); }
  m.set(block, pack(groundTiles));
  scheduleSave();
  return groundTiles;
}

/** The walks' additions written back once they have run (the two walks run moments apart in the boot). */
function scheduleSave() {
  const k = kept;
  if (!k?.store || k.timer) return;
  k.timer = setTimeout(() => { k.timer = null; keepAnswer(k.store, k.key, k.walks, GROUND_TILES_SCOPE); }, SAVE_AFTER_MS);
}

/** Tests: write what was added now, and answer when it is stored. */
export async function _flushGroundTiles() {
  const k = kept;
  if (!k?.store) return;
  if (k.timer) { clearTimeout(k.timer); k.timer = null; }
  await keepAnswer(k.store, k.key, k.walks, GROUND_TILES_SCOPE);
}
/** Tests: forget the fetched record. */
export function _resetGroundTiles() { if (kept?.timer) clearTimeout(kept.timer); kept = null; }
