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

/** LAIR-WALK: how long a revenant's lair waits on the dungeon's navmesh to know where a walk reaches (wall ms) - a bake
 *  that never lands stands it by the marker law alone. */
export const LAIR_WALK_WAIT_MS = 20000;
/**
 * LAIR-WALK (bible/01-Overview/bugs/Field-Bugs-2026-10-19.md): THE END A WALK REACHES - the farthest of `marks` from `from`
 * that `reaches` answers true for (the host's: the floor the navmesh floods from where I came in, ai/nav/navmesh.js
 * reachableFrom), the farthest asked first and a tie keeping the list's order as dungeonEndOf does; null when none does.
 * No test (`reaches` null): dungeonEndOf.
 * @template {{ x: number, z: number }} M
 * @param {{ x: number, z: number } | null | undefined} from
 * @param {M[] | null | undefined} marks
 * @param {((m: M) => boolean) | null} [reaches]
 * @returns {M | null}
 */
export function reachableEndOf(from, marks, reaches = null) {
  if (typeof reaches !== 'function') return dungeonEndOf(from, marks);
  const list = Array.isArray(marks) ? marks.filter((m) => Number.isFinite(m?.x) && Number.isFinite(m?.z)) : [];
  const d = (/** @type {M} */ m) => (from ? Math.hypot(m.x - from.x, m.z - from.z) : 0);
  return list.map((m, i) => ({ m, i, d: d(m) })).sort((a, b) => b.d - a.d || a.i - b.i).find(({ m }) => reaches(m))?.m ?? null;
}
