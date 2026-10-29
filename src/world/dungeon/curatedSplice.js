// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): WHERE A CURATED BLOCK STANDS - in place of one interior block of
// a dungeon the game lays out itself (a spawned dungeon, an Elite one, a lair past the Bay), never one of Daggerfall's
// own 4,232, the Abyss Hollow or a made level, and never the starting block. Drawn off the dungeon's own map id over its
// type's pool, so every client and every visit lays the same block in the same place. Asked of the block list the
// dungeon is laid from (world/dungeon/dungeonLayout.js), after any smaller size is drawn (world/smallerDungeons.js).

import { hash32 } from '../blockHash.js';
import { curatedBlockName } from './curatedBlocks.js';

/** The share of game-made dungeons whose type's pool holds a block that stand one (the owner's to move, section 11). */
export const CURATED_CHANCE = 0.5;
/** The hash's own lane: no other law draws on it. */
export const CURATED_LANE = 0xd1f5;
/** A dungeon the game lays out itself: a spawn (world/spawnedDungeons.js) or a lair (world/tamrielDungeons.js). */
export const gameMade = (loc) => !!loc?.spawned || loc?.country?.dungeon === true;
const border = (b) => /^b/i.test(b?.blockName ?? '');
/** The draw: a share of the lane, and a pick among `n`. */
const share = (id, k) => hash32(id, CURATED_LANE, k) / 4294967296;
const pick = (id, k, n) => hash32(id, CURATED_LANE, k) % n;

/**
 * THE SPLICE: which block of `loc`'s list a curated record takes, and which record - or null. A game-made dungeon whose
 * type's pool holds a record, drawn in by CURATED_CHANCE; the slot an interior block that is not the start. Pure.
 * @param {any} loc a location (its `mapTableData`, `dungeon.blocks`) @param {readonly any[]} records
 * @param {readonly any[]} [blocks] the list it is laid from (a smaller size's), else its own
 */
export function curatedSlot(loc, records, blocks = loc?.dungeon?.blocks ?? []) {
  if (!gameMade(loc) || !blocks.length) return null;
  const type = loc.mapTableData?.dungeonType;
  const pool = records.filter((r) => r.types.includes(type));
  if (!pool.length) return null;
  const id = (loc.mapTableData?.mapId ?? 0) >>> 0;
  if (share(id, 0) >= CURATED_CHANCE) return null;
  const slots = blocks.map((b, j) => j).filter((j) => !border(blocks[j]) && !blocks[j].isStartingBlock);
  if (!slots.length) return null;
  return { j: slots[pick(id, 2, slots.length)], rec: pool[pick(id, 1, pool.length)] };
}
/** The block list laid: `blocks` with the curated record's block in its slot (a new list), or `blocks` itself. Pure. */
export function spliceCurated(loc, records, blocks = loc?.dungeon?.blocks ?? []) {
  const s = curatedSlot(loc, records, blocks);
  if (!s) return blocks;
  return blocks.map((b, j) => (j === s.j ? { ...b, blockName: curatedBlockName(s.rec.n) } : b));
}
