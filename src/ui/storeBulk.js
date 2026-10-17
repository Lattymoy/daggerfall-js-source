// @ts-check
// LOOT-BULK (2026-10-16): Take all and Stash all walk the list the player is looking at, top to bottom, through the
// same plan a single click uses. One click. The room still hears a container when its window closes, not per item.
import { stacksWith } from '../systems/inventory.js';
import { LOOT_LIST_MAX } from '../systems/loot/loot.js';
import { t } from '../systems/textManager.js';

/** A room container's list, past which a close cannot be said (systems/loot/loot.js LOOT_LIST_MAX). */
export const CONTAINER_LIST_CAP = LOOT_LIST_MAX;
/** Said when Stash all stops because the next row would put a room container past that cap. */
export const containerFull = () => t('inventory.store.containerFull', 'This container cannot hold any more.');

const STOP = new Set(['cannotCarry', 'wagonFull', 'packFull', 'packGone']);

/** True when `item` would be a new row and the destination is already at `cap`. A stack that merges is not a new row. */
export function listAtCap(dest, item, cap) {
  if (cap == null || dest.length < cap) return false;
  return !dest.some((held) => held !== item && stacksWith(held, item));
}

/**
 * What one row does. `stop` is the pack or the destination having no room for this row: the walk ends, and this row
 * stays. `partial` moves what fits and the walk ends. `skip` is a row the law refuses for some other reason: the walk
 * goes on. A map and a choose-one gift are skipped: Take all does not read a map and does not close the window.
 * @param {any} item
 * @param {{ ok?: boolean, amount?: number, map?: boolean, claimsChoice?: boolean, refusal?: { reason?: string } }} plan
 * @returns {'move' | 'partial' | 'stop' | 'skip'}
 */
export function bulkVerdict(item, plan) {
  if (!plan || plan.map || plan.claimsChoice) return 'skip';
  if (!plan.ok) return STOP.has(plan.refusal?.reason) ? 'stop' : 'skip';
  const stack = item?.stackCount ?? 1;
  return (plan.amount ?? stack) < stack ? 'partial' : 'move';
}

/**
 * Top to bottom. `decide` answers `{ verdict, refusal, plan }`. `commit` runs for a move and a partial. A stop is not
 * committed. The notice is the stop's text, or the first skip's text when nothing moved.
 * @param {any[]} items
 * @param {(item: any) => { verdict: string, refusal?: { text?: string }, plan?: any }} decide
 * @param {(item: any, decided: { plan?: any }) => void} commit
 */
export function runBulk(items, decide, commit) {
  let moved = 0;
  let stopText = null;
  let skipText = null;
  for (const item of items) {
    const d = decide(item);
    if (d.verdict === 'skip') { skipText ??= d.refusal?.text ?? null; continue; }
    if (d.verdict === 'stop') { stopText = d.refusal?.text ?? stopText; break; }
    commit(item, d);
    moved += 1;
    if (d.verdict === 'partial') break;
  }
  return { moved, notice: stopText ?? (moved ? null : skipText) };
}
