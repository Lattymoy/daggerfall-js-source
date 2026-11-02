// @ts-check
// YARD-BLOCK (2026-10-28, bible/11-Multiplayer/Yard-Cells.md section 12): STRANGERS' YARDS MERGED A BLOCK AT A TIME.
// YARD-MERGE made each yard one draw a texture, but a full city stands about 500 strangers' yards within 300 m. Here
// the yards of one block (YARD-CELL's cell) within the yard range share one mesh a texture and one batch a picture.
// A piece going out of a merged yard lets the block's merge go at once, as YARD-MERGE lets a yard's go. A yard
// crossing the range is merged in or out at the next merge, the old merge drawn until then. Merges are made nearest
// block first on a time budget a frame, always at least one.

import {
  DECOR_MERGE_SETTLE_MS,
  DECOR_DRAW,
  DECOR_SHADOW,
  standDecorMerge,
  decorMergeMatrix,
  decorFlatSeen,
} from './decor/decorRoom.js';
import { transformedAabb } from '../render/frustum.js';

/** How long one frame spends merging blocks, milliseconds. At least one block is merged in a frame that has one due. */
export const YARD_BLOCK_MERGE_BUDGET_MS = 2;

/**
 * @typedef {{ pool: any }} BlockYard  a yard as the host keeps it - its pool (decorRoom.js createDecorRoom)
 * @typedef {{ mesh: any, flatGroups: Array<{ batch: any, members: any[] }>, at: number[], entries: any[] }} BlockMerge
 * @typedef {{ key: string, px: number, py: number, origin: () => number[], yards: Set<BlockYard>,
 *   merged: BlockMerge | null, held: Set<BlockYard>, changed: boolean, changedAt: number, distance: number }} Block
 */

/** The host's blocks of strangers' yards. `now`: the merges' settle clock (ms); `clock`: the frame's budget's (ms).
 *  @param {{ renderer: any, now: () => number, clock: () => number }} deps */
export function createYardBlockMerge({ renderer, now, clock }) {
  /** @type {Map<string, Block>} */
  const blocks = new Map();

  /** The merge let go: its mesh and batches destroyed, each piece in it drawn by its own pool again. */
  function dropMerge(/** @type {Block} */ block) {
    const merged = block.merged;
    if (!merged) return;
    for (const entry of merged.entries) entry.merged = false;
    if (merged.mesh) renderer?.destroyMesh?.(merged.mesh.gpu);
    for (const group of merged.flatGroups) renderer?.destroyBillboardBatch?.(group.batch);
    block.merged = null;
  }

  /** The block merged again over `yards` (the old merge let go in the same frame, so nothing is drawn alone between). */
  function remerge(/** @type {Block} */ block, /** @type {BlockYard[]} */ yards) {
    dropMerge(block);
    const into = [];
    /** @type {Map<string, any[]>} */
    const keyed = new Map();
    for (const yard of yards) {
      const parts = yard.pool.mergeParts();
      for (const entry of parts.into) into.push(entry);
      for (const [key, entries] of parts.keyed) {
        const group = keyed.get(key);
        if (group) group.push(...entries);
        else keyed.set(key, [...entries]);
      }
    }
    const origin = block.origin();
    const stood = standDecorMerge(renderer, into, keyed, origin);
    const entries = [...into];
    for (const group of keyed.values()) entries.push(...group);
    block.merged = { mesh: stood.mesh, flatGroups: stood.flatGroups, at: [origin[0], origin[1], origin[2]], entries };
    block.held = new Set(yards);
    block.changed = false;
  }

  /** Whether the yards in range are the ones the block's merge holds. */
  function holdsExactly(/** @type {Block} */ block, /** @type {BlockYard[]} */ inRange) {
    if (inRange.length !== block.held.size) return false;
    return inRange.every((yard) => block.held.has(yard));
  }

  return {
    /**
     * A yard joins its block: `key` names the block (its pixel and its cell), `origin()` is the block's pixel's place in
     * the scene now. Answers the `merge` door the yard's pool is built with (decorRoom.js createDecorRoom).
     * @param {string} key @param {number} px @param {number} py @param {() => number[]} origin
     */
    door(key, px, py, origin) {
      let block = blocks.get(key);
      if (!block) {
        block = {
          key,
          px,
          py,
          origin,
          yards: new Set(),
          merged: null,
          held: new Set(),
          changed: false,
          changedAt: 0,
          distance: 0,
        };
        blocks.set(key, block);
      }
      const owner = block;
      return {
        block: owner,
        now,
        changed() {
          owner.changed = true;
          owner.changedAt = now();
        },
        letGo() {
          dropMerge(owner);
          owner.changed = true;
          owner.changedAt = now();
        },
      };
    },
    /** A yard stands in its block (after its pool is built with the block's door). */
    join(/** @type {any} */ door, /** @type {BlockYard} */ yard) {
      door.block.yards.add(yard);
    },
    /** A yard taken down leaves its block - its pool already destroyed, so the merge it was in is let go. A block left
     *  with no yard goes. */
    leave(/** @type {any} */ door, /** @type {BlockYard} */ yard) {
      const block = door.block;
      block.yards.delete(yard);
      if (block.held.has(yard)) {
        dropMerge(block);
        block.held = new Set();
      }
      if (!block.yards.size && blocks.get(block.key) === block) {
        dropMerge(block);
        blocks.delete(block.key);
      }
    },
    /**
     * THE FRAME'S MERGES: each block whose pieces have stood DECOR_MERGE_SETTLE_MS unchanged, and whose merge is not of
     * the yards in range now (`inRange(yard)`), merged again - nearest first (`distance(block)`), while the frame's
     * merging time is under YARD_BLOCK_MERGE_BUDGET_MS, and always one. Answers how many were merged.
     * @param {(yard: BlockYard) => boolean} inRange @param {(block: Block) => number} distance
     */
    step(inRange, distance) {
      const due = [];
      const settledBefore = now() - DECOR_MERGE_SETTLE_MS;
      for (const block of blocks.values()) {
        if (block.changedAt > settledBefore) continue;
        const yards = [...block.yards].filter(inRange);
        if (!block.changed && holdsExactly(block, yards)) continue;
        block.distance = distance(block);
        due.push({ block, yards });
      }
      due.sort((a, b) => a.block.distance - b.block.distance);
      const started = clock();
      let made = 0;
      for (const { block, yards } of due) {
        if (made > 0 && clock() - started >= YARD_BLOCK_MERGE_BUDGET_MS) break;
        if (yards.length) remerge(block, yards);
        else {
          dropMerge(block);
          block.held = new Set();
          block.changed = false;
        }
        made++;
      }
      return made;
    },
    /**
     * The blocks' merged models, in the world's mesh pass: each through `cull` (decorRoom.js's verdicts, the whole
     * merge's box) and the remap of its pixel (`remapOf(px, py)`). Answers how many pieces were drawn.
     * @param {any} r @param {((box: number[]) => number) | null} cull @param {(px: number, py: number) => any} remapOf
     */
    draw(r, cull, remapOf) {
      let drawn = 0;
      for (const block of blocks.values()) {
        const mesh = block.merged?.mesh;
        if (!mesh) continue;
        const seen = cull ? cull((mesh.wbox ??= transformedAabb(mesh.box, mesh.matrix))) : DECOR_DRAW;
        const remap = remapOf(block.px, block.py);
        if (seen === DECOR_SHADOW) r?.recordShadowMesh?.(mesh.gpu, mesh.matrix, remap);
        else if (seen === DECOR_DRAW) {
          r?.drawMesh?.(mesh.gpu, mesh.matrix, remap);
          drawn += mesh.n;
        }
      }
      return drawn;
    },
    /** The blocks' merged flats pushed onto `out`: a group's batch while any of its flats is big enough to see from
     *  `eye` (decorFlatSeen). */
    batches(/** @type {any[]} */ out, /** @type {number[] | null} */ eye, /** @type {number} */ minAngle) {
      for (const block of blocks.values()) {
        for (const group of block.merged?.flatGroups ?? []) {
          if (group.members.some((entry) => decorFlatSeen(entry, eye, minAngle))) out.push(group.batch);
        }
      }
      return out;
    },
    /** FB1001 YARD-RECENTRE: every merge moved to where its block's pixel stands now, as one - nothing merged again. */
    rebase() {
      for (const block of blocks.values()) {
        const merged = block.merged;
        if (!merged) continue;
        const origin = block.origin();
        const step = [origin[0] - merged.at[0], origin[1] - merged.at[1], origin[2] - merged.at[2]];
        if (!step[0] && !step[1] && !step[2]) continue;
        if (merged.mesh) {
          merged.mesh.matrix = decorMergeMatrix(origin);
          merged.mesh.wbox = null;
        }
        for (const group of merged.flatGroups) {
          const was = group.batch.origin ?? [0, 0, 0];
          group.batch.origin = [was[0] + step[0], was[1] + step[1], was[2] + step[2]];
        }
        merged.at = [origin[0], origin[1], origin[2]];
      }
    },
    /** The blocks standing (the tests' window). */
    blocks: () => [...blocks.values()],
    destroy() {
      for (const block of blocks.values()) dropMerge(block);
      blocks.clear();
    },
  };
}
