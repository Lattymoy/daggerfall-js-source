// HOLD-KEPT ON ARRIVAL (AUDIT SHIP-REFIT, 2026-10-29). What a restored room can no longer hold is set down where the
// player arrives: a chest record that no chest of this visit stands for (scenes/chestRecords.js matchChests), and a pile
// left on a floor that furniture now stands on. restoreInteriorScene runs before the player is stood inside, so the
// set-down read the street's position in the room's frame - outside every room for a save loaded inside, and cached
// there for good. The host holds while it restores and lands once the player stands (worldModes' interiorTransition).
import { t } from '../systems/textManager.js';

/** How far a pile looks for the solid it lies inside: a crate's or a wardrobe's faces, seen from within. */
export const BURIED_RAY_M = 3;
/** The four level bearings, a hand's breadth over the floor. */
const LEVEL_RAYS = Object.freeze(
  [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].map(Object.freeze),
);
const metFromBehind = (collider, from, dir) => {
  const hit = collider.raycastHit(from, dir, BURIED_RAY_M);
  return Number.isFinite(hit?.dist) && hit.back;
};
/** Whether `pos` lies inside a solid of `collider`: the ray up meets a face from behind, and three of the four level
 *  rays do - a wardrobe's back is open against its wall, and a table's sides are open, so a pile under it stays. */
export function insideSolid(collider, pos) {
  if (!metFromBehind(collider, [pos[0], pos[1] + 0.05, pos[2]], [0, 1, 0])) return false;
  return LEVEL_RAYS.filter((d) => metFromBehind(collider, [pos[0], pos[1] + 0.15, pos[2]], d)).length >= 3;
}

/**
 * `dropPile(items, feet)` the room's pile pool (scenes/droppedLoot.js), `say(text)` the HUD's line.
 * @param {{ dropPile: (items: any[], feet: number[]) => any, say: (text: string) => void }} deps
 */
export function createArrivalSetDown({ dropPile, say }) {
  let held = [];
  return {
    /** A room's restore begins: nothing is held from another. */
    reset() {
      held = [];
    },
    /** What a chest that stands no more held. `crate`: a house the arena moved brings its things in one, unsaid. */
    hold(items, { crate = false } = {}) {
      if (items?.length) held.push({ items: items.map((it) => ({ ...it })), said: crate ? null : 'chest' });
    },
    /**
     * The restored piles (`piles`, positions in the collider's frame) that now lie inside a solid of `collider`
     * (insideSolid) are held for the arrival; the rest are answered. A scene's own container keeps its place (its
     * identity is its spot).
     */
    unburied(piles, collider) {
      if (!piles || !collider) return piles;
      return piles.filter((p) => {
        if (p.container || !p.items?.length || !insideSolid(collider, p.pos)) return true;
        held.push({ items: p.items.map((it) => ({ ...it })), said: 'buried' });
        return false;
      });
    },
    /** The player stands at `feet`: everything held is set down there, and said once a kind. */
    land(feet) {
      const said = new Set();
      for (const h of held) {
        dropPile(h.items, feet);
        if (h.said) said.add(h.said);
      }
      held = [];
      if (said.has('chest'))
        say(t('interior.setDown.chest', 'A chest that stood here is gone. What it held was set down at your feet.'));
      if (said.has('buried'))
        say(
          t(
            'interior.setDown.buried',
            'Furniture now stands where you left some things. They were set down at your feet.',
          ),
        );
      return said.size;
    },
  };
}
