// @ts-check
// ARENA-ARROWS (FIELD BUGS 2026-10-04e, systems/arena/arenaQuiver.js): THE SHOTS A BOUT LOOSED, counted as they leave the bow.
// The quiver's mark alone read every arrow missing at the healers' heal as spent on the sand - so an arrow DROPPED in a
// bout (or sold, or given away) came back with the healers and the dropped stack still lay where it fell: a duplicate.
// Now the refund is the fewer of what is missing and what was loosed - the shots inventory.js spendAmmoFor took from
// the watched pack (a real round: a conjured one vanishes anyway), less every shaft lodged in a foe whose pack can be
// looted (combat/arrowFlight.js - a bout fighter's pack is thrown away with it, so a shaft in one is lost and pays).
// A leaf: no imports, so inventory.js and arrowFlight.js reach it with no cycle. Not a DFU member - Ledger A (ARENA-ARROWS).

/** @type {{ list: any[], shots: Map<number, number> } | null} */
let watching = null;

/** Start counting the shots spent from `list` (the player's pack), from zero. @param {any[] | null | undefined} list */
export function startShotTally(list) {
  watching = Array.isArray(list) ? { list, shots: new Map() } : null;
}

/** Stop counting: the shots counted, by ammunition template (null when nothing was watched). */
export function stopShotTally() {
  const w = watching;
  watching = null;
  return w ? w.shots : null;
}

/** STUCK-ARROWS (combat/arrowFlight.js stickable): is a bout counting now? A shaft loosed on the sand keeps the classic
 *  LOST law, so the healers' refund stays the whole account of it. */
export const shotTallyOpen = () => watching !== null;

/** A real round of `template` spent from `list` - counted when `list` is the pack watched.
 *  @param {any[] | null | undefined} list @param {number} template */
export function noteShot(list, template) {
  if (watching && list === watching.list) watching.shots.set(template, (watching.shots.get(template) ?? 0) + 1);
}

/** A shaft of `template` lodged where it can be got back (a foe's pack that can be looted): no longer the bout's to pay.
 *  @param {number} template */
export function noteShotRecoverable(template) {
  if (watching) watching.shots.set(template, Math.max(0, (watching.shots.get(template) ?? 0) - 1));
}
