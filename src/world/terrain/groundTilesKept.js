// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE BOOT WALKS' GROUND TILES, KEPT.
//
// The boot reads SetLocationTiles' rect for every Bay town Deep Waters blends and every Eltheric isle template
// (terrainTiles.js locationRectReader, BOOT-RECTS). The rect reads one thing of a block - its ground tiles - but
// the block is served whole through the world-data door, and with a town pack on that is a pack file rebuilt for
// each of some 400 blocks: 1.1 s of a warm launch's 2.7 s boot stall, every launch, for the same answer.
//
// So each block's ground tiles are kept in the player's derived store, one record for the walks, keyed on:
//   - GROUND_TILES_VERSION, bumped by hand when what is kept changes shape;
//   - BLOCKS.BSA's stamp (firstVisitStore.js bytesStamp);
//   - what the door serves blocks by (worldDataReplacement.js worldDataBlocksServing: the gate, each block file's mod
//     and pack sha256, the port's blocks, the layers on) and the build.
// Inside the record a walk's blocks are kept under the walk's own name (its `as` fields): a block reads alike at every
// location a walk reads it at (locationRectReader's own law), not necessarily at every walk's.
// A pinned town is read through by locationRectReader as before and never reaches this; while any block variant is set
// nothing is read from the record or added to it.
//
// The record is fetched once, before the walks (prefetchGroundTiles, from the mod world-data loader that opens the
// door they read through), so the walks stay synchronous; what they add is written back a moment later. The fetch
// installs this module as terrainTiles.js's keeper - the walks' module never imports the store.

import { BUILD_TAG } from '../../buildTag.js';
import { bytesStamp, textStamp, derivedValueStore } from '../../systems/firstVisit/firstVisitStore.js';
import { anyBlockVariant } from '../../systems/worldDataVariants.js';
import { setGroundTilesKeeper } from './terrainTiles.js';

/** Bump when the kept tiles change shape. */
export const GROUND_TILES_VERSION = 1;

const TILES = 16;   // RMB_TILES_PER_BLOCK
const SAVE_AFTER_MS = 2000;

/** @type {{ key: string, walks: Map<string, Map<number, Int32Array>>, store: any, added: boolean, timer: any } | null} */
let kept = null;

/** The record's key for these inputs. @param {Uint8Array|null} blocksBytes @param {string} serving */
export function groundTilesKey(blocksBytes, serving) {
  const stamp = bytesStamp(blocksBytes);
  return stamp ? `fv-ground:v${GROUND_TILES_VERSION}:${stamp}:${textStamp(serving, BUILD_TAG)}` : null;
}

/** A stored record is a Map of walk name -> Map of block index -> 512 numbers. */
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
 * @param {string} walk - the walk's name @param {number} index - the block's index
 * @param {() => any[][] | null | undefined} read
 */
export function keptGroundTiles(walk, index, read) {
  if (!kept || anyBlockVariant()) return read();
  const tiles = kept.walks.get(walk)?.get(index);
  if (tiles) return unpack(tiles);
  const groundTiles = read();
  if (groundTiles?.length !== TILES) return groundTiles;
  let m = kept.walks.get(walk);
  if (!m) { m = new Map(); kept.walks.set(walk, m); }
  m.set(index, pack(groundTiles));
  scheduleSave();
  return groundTiles;
}

/** The walks' additions written back once they have run (the two walks run moments apart in the boot). */
function scheduleSave() {
  const k = kept;
  if (!k?.store || k.timer) return;
  k.timer = setTimeout(() => { k.timer = null; k.store.set(k.key, k.walks); }, SAVE_AFTER_MS);
}

/** Tests: write what was added now, and answer when it is stored. */
export async function _flushGroundTiles() {
  const k = kept;
  if (!k?.store) return;
  if (k.timer) { clearTimeout(k.timer); k.timer = null; }
  await k.store.set(k.key, k.walks);
}
/** Tests: forget the fetched record. */
export function _resetGroundTiles() { if (kept?.timer) clearTimeout(kept.timer); kept = null; }
