// @ts-check
// LW4 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVES - who holds a traveller's place in their town, cycle by
// cycle. The road kills (trouble.js); a traveller slain is slain for good, their place stands empty while the town
// mourns, and a newcomer takes it - a new name, a new face, a new trade's record - and the town's talk remembers the one
// who went. Pure, like the rest of the living world (LW0 decision 2): no save holds who died, so every reader's world
// holds the same dead and the same newcomers, and a slot's whole history is a short read of its own seeded dice.
//
// THE FATE. Each traveller slot rolls its fate once a cycle - its own cycle (trips.js cycleOf), a sellsword's its
// contract merchant's (formCaravans' contract: the slot's own deal, never who holds it) - against its job's HAZARD.
// A roll under it is a death that cycle, COUNTED unless another roll under it fell in the VACANT_CYCLES before (a
// place standing empty has nobody in it to die; the rule reads the rolls alone, so a slot's history is never a chain).
// A counted death empties the place for the VACANT_CYCLES after; the newcomer holds it from the cycle after that - the
// census's own mint with the death's cycle in the seed (census.js mintResident's `gen`), `L<map>.t<slot>~<cycle>`.
// The death plays out where it falls: on that cycle's trip (trouble.js - a fated death is always ON the road: ownTrip
// sets out whatever the cycle's chance said), or, a cycle with no trip to make, abroad and unseen.
//
// A CHARACTER'S OWN TURNS (LW0 decision 6). A player who fights beside a party can turn a fate: a member the road
// would have taken, alive when the fight is won, was SPARED; one cut down beside them FELL. Both are the character's
// (the LivingWorld record), keyed by the PLACE and the cycle (`<place>@<cycle>` - the census's id, which holder held it
// that cycle being the dice's own answer), and read here over the dice - the world is shared, what one player changed
// in it is theirs.
//
// LW7: THE HAND DEATHS. A holder the player struck down (`slain`), or who died fighting at the player's side (`died`),
// is dead from THAT MINUTE (`handDeath`) - a death the road's dice never held: it empties the place as any death does
// (and a turn the character made always counts - it was made on a holder they met), but it is not the road's (`dies`
// stays the dice's and the fights' own), so the cycle's trip and its trouble stand as they were.
import { lwRoll } from './seed.js';

/** A slot's chance a cycle of dying on the road, by job (a sailor's is the sea's, LW5) - a town of a dozen travellers
 *  loses one every season or so: a merchant one cycle in about 170, a sellsword one in 100, an adventurer one in 80. */
export const HAZARD = Object.freeze({ merchant: 0.006, mercenary: 0.01, adventurer: 0.012, pilgrim: 0.006, courier: 0.004, pedlar: 0.004 });
/** The cycles a place stands empty after a death. */
export const VACANT_CYCLES = 3;
const FATE = 0x46415445;   // 'FATE'

/**
 * @typedef {{ spared?: Set<string>|null, fallen?: Set<string>|null, slain?: Map<string, { t: number }>|null,
 *   died?: Map<string, { t: number }>|null }} Turns - a character's own turns of fate, `<place>@<cycle>`; LW7 the hand
 *   deaths, each with its minute
 */

/** A resident's place: the census's id, whichever generation holds it (`L<map>.t<slot>`). @param {{ id: string }} res */
export const placeKeyOf = (res) => String(res.id).replace(/~\d+$/, '');
/** A turn's key - the place and the cycle. @param {{ id: string }} res @param {number} k */
export const turnKey = (res, k) => `${placeKeyOf(res)}@${k}`;

/** LW7: the minute a slot's holder died in cycle `k` by a HAND - struck down by the player (`slain`), or fighting at
 *  their side (`died`) - or null. @param {any} res @param {number} k @param {Turns} [turns] */
export function handDeath(res, k, turns) {
  const key = turnKey(res, k);
  const at = turns?.slain?.get(key) ?? turns?.died?.get(key) ?? null;
  return at ? at.t : null;
}

/** Does the ROAD take a slot in cycle `k` - its own dice, then the character's turns of its fights. @param {any} res @param {number} k @param {Turns} [turns] */
export function roadHits(res, k, turns) {
  const key = turnKey(res, k);
  if (turns?.fallen?.has(key)) return true;
  if (turns?.spared?.has(key)) return false;
  const h = HAZARD[/** @type {keyof typeof HAZARD} */ (res.job)] ?? 0;
  return h > 0 && lwRoll(res.town, res.slot, k, FATE) < h;
}

/** Does a slot's holder die in cycle `k` - the road's fate, or (LW7) a hand's. @param {any} res @param {number} k @param {Turns} [turns] */
export const fateHits = (res, k, turns) => handDeath(res, k, turns) != null || roadHits(res, k, turns);

/** No death in the VACANT_CYCLES before cycle `k`. @param {any} res @param {number} k @param {Turns} [turns] */
const quietBefore = (res, k, turns) => {
  for (let j = k - VACANT_CYCLES; j < k; j++) if (fateHits(res, j, turns)) return false;
  return true;
};

/** Is a death in cycle `k` counted - a death that cycle and none in the VACANT_CYCLES before; LW7: a turn the character
 *  made (one cut down beside them, a hand's) always - it was made on a holder they met. @param {any} res @param {number} k @param {Turns} [turns] */
export function deathCounted(res, k, turns) {
  if (!fateHits(res, k, turns)) return false;
  return !!turns?.fallen?.has(turnKey(res, k)) || handDeath(res, k, turns) != null || quietBefore(res, k, turns);
}

/**
 * THE PLACE in cycle `k`: `holder` the generation holding it (null: the census's own; a number: the cycle of the death
 * the newcomer came after), or `vacant` while it stands empty, and `dies` whether the road takes its holder this cycle.
 * LW7: `hand` the minute a hand took its holder this cycle (null: none) - dead from then, the road's day kept.
 * `res` is the slot's census resident (its id, town, slot and job - the dice are the slot's, whoever holds it).
 * @param {any} res @param {number} k @param {Turns} [turns]
 * AUDIT-B1: `diced` the dice's own death this cycle, the character's turns of it aside - the trip's and the trouble's shape.
 * @returns {{ vacant: boolean, holder: number|null, dies: boolean, diced: boolean, since: number|null, hand: number|null }}
 */
export function placeAt(res, k, turns) {
  let last = null;
  // back from the cycle to the first counted death (a slot's hazard is percents a cycle: a few dozen cycles at most) -
  // to the world's first cycle, never a window, so a death long ago never falls out of the reading and back to the census
  for (let j = k - 1; j >= 0; j--) if (deathCounted(res, j, turns)) { last = j; break; }
  if (last != null && k - last <= VACANT_CYCLES) return { vacant: true, holder: null, dies: false, diced: false, since: last, hand: null };
  // the holder: the newcomer after the last death; before it, the generations back (each the death that came before it).
  // The road's own death this cycle reads the road's own count - a hand's death beside it never makes the road's fate
  const quiet = quietBefore(res, k, turns);
  const dies = roadHits(res, k, turns) && (!!turns?.fallen?.has(turnKey(res, k)) || quiet);
  // AUDIT-B1: the dice's own death this cycle - the character's turns of THIS cycle aside (a spare, one cut down beside
  // them): what shapes the cycle's trip and its trouble, which a turn never re-rolls
  const h = HAZARD[/** @type {keyof typeof HAZARD} */ (res.job)] ?? 0;
  const diced = h > 0 && lwRoll(res.town, res.slot, k, FATE) < h && quiet;
  return { vacant: false, holder: last, dies, diced, since: last, hand: handDeath(res, k, turns) };
}
