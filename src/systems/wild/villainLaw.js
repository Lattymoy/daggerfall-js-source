// @ts-check
// PVP-VILLAIN (the PvP rework, 2026-10-29 - the owner's numbers, "v3"; "if u get attacked first u dont gain any villany to
// kill htem", "as well as if somoe attack your party", "so u cant get pushed in becoming a villian its a CHOICES"): THE
// VILLAIN METER. A kill of a player raises it, the more the lower the victim, and an unflagged victim by a flat sum; a
// kill in self-defence adds none. At VILLAIN.red the killer is a villain: a red skull, its flag held up. Monsters near
// its level, helpful quests and raids lower it; no clock, no gold and no death do. Pure. A departure: DFU has no PvP.

/** The meter's numbers, in monster-kill units. */
export const VILLAIN = Object.freeze({
  max: 10_000,
  red: 5_000,
  perLevel: 100,
  fromLevels: 5,
  unflagged: 2_000, // a kill: each level under the killer from 5 under, and an unflagged victim
  monster: 1,
  monsterBelow: 1,
  quest: 200,
  raid: 500, // what lowers it: a monster at or above the killer's level less 1
});

/** The meter held to 0..VILLAIN.max (anything not a number is 0). */
export const villainClamp = (/** @type {unknown} */ n) =>
  Number.isFinite(n) ? Math.max(0, Math.min(VILLAIN.max, Math.trunc(/** @type {number} */ (n)))) : 0;

/** Is a meter at `n` a villain's? */
export const isVillain = (/** @type {unknown} */ n) => villainClamp(n) >= VILLAIN.red;

/**
 * What a kill of a player adds to its killer's meter. `killer` and `victim` are character levels (null: unknown, no
 * level points); `flagged` the victim's flag at the kill; `defended` the victim struck the killer or its party first in
 * this fight. Hits add nothing; only a kill is counted.
 * @param {{ killer?: number | null, victim?: number | null, flagged?: boolean, defended?: boolean }} o
 */
export function villainKillPoints({ killer = null, victim = null, flagged = true, defended = false }) {
  if (defended) return 0;
  const under =
    Number.isSafeInteger(killer) && Number.isSafeInteger(victim)
      ? /** @type {number} */ (killer) - /** @type {number} */ (victim)
      : 0;
  const levels = under >= VILLAIN.fromLevels ? under * VILLAIN.perLevel : 0;
  return levels + (flagged ? 0 : VILLAIN.unflagged);
}

/** The meter after a change of `delta`, held to its bounds. */
export const villainAfter = (/** @type {unknown} */ n, /** @type {number} */ delta) =>
  villainClamp(villainClamp(n) + (Number.isFinite(delta) ? Math.trunc(delta) : 0));

/** What a monster kill takes off: VILLAIN.monster for a monster at or above the killer's level less VILLAIN.monsterBelow. */
export const villainMonsterLowers = (/** @type {number} */ killerLevel, /** @type {number} */ monsterLevel) =>
  Number.isFinite(killerLevel) && Number.isFinite(monsterLevel) && monsterLevel >= killerLevel - VILLAIN.monsterBelow
    ? VILLAIN.monster
    : 0;

/** What a helpful quest takes off. */
export const villainQuestLowers = () => VILLAIN.quest;

/** What a raid takes off: none for a villain (a raid is closed to one; it is not counted). */
export const villainRaidLowers = (/** @type {unknown} */ n) => (isVillain(n) ? 0 : VILLAIN.raid);
