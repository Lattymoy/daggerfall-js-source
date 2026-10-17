// @ts-check
// SD4b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 6): A DUNGEON'S END - the
// marker farthest from its entrance across the floor plan. RVN7d's lair law (bible/12-Enhanced-AI/Feud-Arc.md 18.4: a
// revenant at home stands "at the layout marker farthest from the entrance"), lifted out of the dungeon host
// (scenes/dungeonContext.js) so the lair's stand and a Super dungeon's Rift and Return read ONE law. Pure: the same
// markers in, the same marker out, on every client - a tie keeps the first in the list's order.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS; RVN7d's law, moved).

/**
 * The farthest of `marks` ([{ x, y, z }], the dungeon's frame) from `from` ({ x, z }, the entrance), measured across
 * the floor plan - the height never asked (RVN7d's law). The first mark when there is no entrance; null with no mark.
 * @template {{ x: number, z: number }} M
 * @param {{ x: number, z: number } | null | undefined} from
 * @param {M[] | null | undefined} marks
 * @returns {M | null}
 */
export function dungeonEndOf(from, marks) {
  const list = Array.isArray(marks) ? marks.filter((m) => Number.isFinite(m?.x) && Number.isFinite(m?.z)) : [];
  if (!list.length) return null;
  if (!from) return list[0];
  const d = (/** @type {M} */ m) => Math.hypot(m.x - from.x, m.z - from.z);
  return list.reduce((a, m) => (d(m) > d(a) ? m : a));
}
