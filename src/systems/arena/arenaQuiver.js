// @ts-check
// ARENA-ARROWS (FIELD BUGS 2026-10-04e, Discord: "Arrows are not refunded, which causes problems"): THE QUIVER COMES
// BACK FULL FROM THE SAND. A bout's healers put the fighter back as they found them - health, fatigue and magicka (the
// duel's own heal, bible/11-Multiplayer/Arena.md "2. The fights") - but nothing put back what the bow spent. An arrow
// that strikes a foe is lodged in its pack (combat/arrowFlight.js) and looted from the corpse in any other fight; a bout
// fighter is stood with no pack, never dies (the yield floor: no corpse, no loot) and is taken away at the verdict, and a
// player's opponent is a remote body - so every arrow loosed on the sand was gone for good, and a ladder emptied a
// quiver tier by tier. Now the player's ammunition is counted as they step into a bout (`markQuiver`) and what the
// bout LOOSED is handed back with the healers (`refundQuiver`): the fewer of what is missing and the shots the bout's
// tally counted (systems/shotTally.js) - so an arrow dropped, sold or given away on the sand is no shot, and never
// comes back while the dropped stack still lies there.
//
// Counted: the ammunition every ranged weapon spends (inventory.js spendAmmoFor - an Arrow, a Dwemer Pellet), REAL
// stacks only: a conjured arrow (isSummoned) is spent first and vanishes anyway, and a quest's is never loosed. Never
// more than went in: a stack grown on the sand hands nothing back. Handed back as inventory.js addItem stacks it. Pure:
// the lists in, the count handed back out. Not a DFU member - Ledger A (ARENA-ARROWS).

import { ARROW_TEMPLATE, isSummoned, addItem } from '../inventory.js';
import { PELLET_TEMPLATE } from '../../characters/thunderlockIds.js';

/** The ammunition a bout's quiver counts - every template inventory.js's spendAmmoFor can spend. */
export const QUIVER_TEMPLATES = Object.freeze([ARROW_TEMPLATE, PELLET_TEMPLATE]);

/** @param {any} it @param {number} template */
const counted = (it, template) => it?.templateIndex === template && !isSummoned(it) && !it.questItem;

/**
 * The quiver as the bout begins: `[{ template, count, proto }]`, one row a kind the pack holds (`proto` a copy of its
 * first stack, for a stack spent to nothing). Pure.
 * @param {any[] | null | undefined} items
 */
export function markQuiver(items) {
  const mark = [];
  for (const template of QUIVER_TEMPLATES) {
    let count = 0, proto = null;
    for (const it of items ?? []) if (counted(it, template)) { count += Math.max(0, it.stackCount ?? 1); proto ??= it; }
    if (count > 0) mark.push({ template, count, proto: { ...proto } });
  }
  return mark;
}

/**
 * Hand back what the bout loosed of `mark` into `items`: the fewer of what is missing and `loosed` (the shot tally's
 * count of the kind - none counted, none paid), added as inventory.js addItem stacks it (onto the kind's stack, or a new
 * one off the copy when it was spent to nothing). Answers how many came back.
 * @param {any[] | null | undefined} items
 * @param {{ template: number, count: number, proto: any }[] | null | undefined} mark
 * @param {Map<number, number> | null | undefined} loosed
 */
export function refundQuiver(items, mark, loosed) {
  if (!Array.isArray(items) || !Array.isArray(mark)) return 0;
  let back = 0;
  for (const m of mark) {
    let now = 0;
    for (const it of items) if (counted(it, m.template)) now += Math.max(0, it.stackCount ?? 1);
    const owed = Math.min(m.count - now, loosed?.get(m.template) ?? 0);
    if (!(owed > 0)) continue;
    addItem(items, { ...m.proto, stackCount: owed });
    back += owed;
  }
  return back;
}
