// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE BOOT WALKS' BLOCK PARTS, KEPT.
// The boot reads SetLocationTiles' rect for every Bay town and Eltheric isle template (terrainTiles.js locationRectReader,
// BOOT-RECTS). The rect needs three parts of a block (ground tiles, town-map cells, misc places - TOWN-SHAPES), but the
// world-data door serves the whole block: some 400 blocks, 1.1 s of a warm launch's 2.7 s boot stall. So the parts are kept
// in one derived-store record, keyed on firstVisitPin('groundTiles') (tools/computationPin.mjs), BLOCKS.BSA's bytesStamp and
// worldDataBlocksServing (worldDataReplacement.js). A new record sweeps the last (`fv-ground:`). Blocks are kept under the
// walk's name (its `as` fields). A pinned town or a set block variant bypasses the record. prefetchGroundTiles fetches it
// once, before the walks, and installs the keeper.

import {
  bytesStamp,
  textStamp,
  derivedValueStore,
  keepAnswer,
  firstVisitPin,
} from '../../systems/firstVisit/firstVisitStore.js';
import { anyBlockVariant } from '../../systems/worldDataVariants.js';
import { setGroundTilesKeeper } from './terrainTiles.js';
import { SHAPE_AUTOMAP_SIDE } from '../townShape.js';

/** The cache's scope: one record, the last written. */
export const GROUND_TILES_SCOPE = 'fv-ground:';

const TILES = 16; // RMB_TILES_PER_BLOCK
const SAVE_AFTER_MS = 2000;
const CELLS = SHAPE_AUTOMAP_SIDE * SHAPE_AUTOMAP_SIDE;

/** @type {{ key: string, walks: Map<string, Map<string|number, KeptBlock>>, store: any, added: boolean, timer: any } | null} */
let kept = null;

/** One block as kept: `t` its tiles (bitfield, textureRecord), `m` the town-map cells that are set, one bit each (null for
 *  none), `r` the x, z and model id (-1 a flat's) of every misc model and flat - all the outline reads of a block
 *  (townShape.js townTiles; FB1028: townFieldTiles reads a field by its model id). */
/** @typedef {{ t: Int32Array, m: Uint8Array|null, r: Float64Array }} KeptBlock */

/** The record's key for these inputs. @param {Uint8Array|null} blocksBytes @param {string} serving */
export function groundTilesKey(blocksBytes, serving) {
  const stamp = bytesStamp(blocksBytes);
  return stamp ? `${GROUND_TILES_SCOPE}${firstVisitPin('groundTiles')}:${stamp}:${textStamp(serving)}` : null;
}

const isBlock = (b) =>
  b?.t instanceof Int32Array &&
  b.t.length === TILES * TILES * 2 &&
  b.r instanceof Float64Array &&
  b.r.length % 3 === 0 &&
  (b.m === null || (b.m instanceof Uint8Array && b.m.length === CELLS / 8));

/** A stored record is a Map of walk name -> Map of block name -> KeptBlock. */
function isRecord(v) {
  if (!(v instanceof Map)) return false;
  for (const walk of v.values()) {
    if (!(walk instanceof Map)) return false;
    for (const b of walk.values()) if (!isBlock(b)) return false;
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
  if (!key) {
    kept = null;
    return false;
  }
  if (kept?.key === key) return kept.walks.size > 0;
  const hit = store ? await store.get(key) : null;
  // the record this one replaces must not save later: its sweep would delete this key
  if (kept?.timer) clearTimeout(kept.timer);
  kept = { key, walks: isRecord(hit) ? hit : new Map(), store, added: false, timer: null };
  return isRecord(hit);
}

/** The block parts as the rect reads them: groundTiles[x][y].tileBitfield / .textureRecord, autoMapData cells (set or not),
 *  and each record's xPos and zPos, and a model's modelIdNum. @param {KeptBlock} k */
function unpack(k) {
  const groundTiles = [];
  for (let x = 0; x < TILES; x++) {
    const col = [];
    for (let y = 0; y < TILES; y++) {
      const i = (x * TILES + y) * 2;
      col.push({ tileBitfield: k.t[i], textureRecord: k.t[i + 1] });
    }
    groundTiles.push(col);
  }
  let autoMapData = null;
  if (k.m) {
    autoMapData = new Uint8Array(CELLS);
    for (let c = 0; c < CELLS; c++) if (k.m[c >> 3] & (1 << (c & 7))) autoMapData[c] = 1;
  }
  const records = [];
  for (let i = 0; i < k.r.length; i += 3)
    records.push(
      k.r[i + 2] >= 0 ? { xPos: k.r[i], zPos: k.r[i + 1], modelIdNum: k.r[i + 2] } : { xPos: k.r[i], zPos: k.r[i + 1] },
    );
  return { groundTiles, autoMapData, misc3dObjectRecords: records, miscFlatObjectRecords: [] };
}
function pack(part) {
  const t = new Int32Array(TILES * TILES * 2);
  for (let x = 0; x < TILES; x++) {
    for (let y = 0; y < TILES; y++) {
      const tile = part.groundTiles[x][y];
      const i = (x * TILES + y) * 2;
      t[i] = tile.tileBitfield;
      t[i + 1] = tile.textureRecord;
    }
  }
  let m = null;
  const cells = part.autoMapData;
  if (cells?.length === CELLS) {
    m = new Uint8Array(CELLS / 8);
    for (let c = 0; c < CELLS; c++) if (cells[c]) m[c >> 3] |= 1 << (c & 7);
  }
  const models = part.misc3dObjectRecords ?? [],
    all = [...models, ...(part.miscFlatObjectRecords ?? [])];
  const r = new Float64Array(all.length * 3);
  all.forEach((rec, i) => {
    r[i * 3] = rec.xPos;
    r[i * 3 + 1] = rec.zPos;
    r[i * 3 + 2] = i < models.length && Number.isFinite(rec.modelIdNum) ? rec.modelIdNum : -1;
  });
  return { t, m, r };
}

/**
 * One block's parts for a walk: the kept ones, or `read()`'s (the block as the door serves it), kept.
 * @param {string} walk - the walk's name @param {string|number} block - the block's name (its index where the reader
 *   cannot name it): a pack's new blocks take their indices in the order the index meets them, not promised the same
 *   on the next launch
 * @param {() => { groundTiles: any[][], autoMapData?: any, misc3dObjectRecords?: any[], miscFlatObjectRecords?: any[] } | null} read
 */
export function keptGroundTiles(walk, block, read) {
  if (!kept || anyBlockVariant()) return read();
  const hit = kept.walks.get(walk)?.get(block);
  if (hit) return unpack(hit);
  const part = read();
  if (part?.groundTiles?.length !== TILES) return part;
  let m = kept.walks.get(walk);
  if (!m) {
    m = new Map();
    kept.walks.set(walk, m);
  }
  m.set(block, pack(part));
  scheduleSave();
  return part;
}

/** The walks' additions written back once they have run (the two walks run moments apart in the boot). */
function scheduleSave() {
  const k = kept;
  if (!k?.store || k.timer) return;
  k.timer = setTimeout(() => {
    k.timer = null;
    keepAnswer(k.store, k.key, k.walks, GROUND_TILES_SCOPE);
  }, SAVE_AFTER_MS);
}

/** Tests: write what was added now, and answer when it is stored. */
export async function _flushGroundTiles() {
  const k = kept;
  if (!k?.store) return;
  if (k.timer) {
    clearTimeout(k.timer);
    k.timer = null;
  }
  await keepAnswer(k.store, k.key, k.walks, GROUND_TILES_SCOPE);
}
/** Tests: forget the fetched record. */
export function _resetGroundTiles() {
  if (kept?.timer) clearTimeout(kept.timer);
  kept = null;
}
