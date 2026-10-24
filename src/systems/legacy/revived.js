// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REVIVE (2026-10-14) - A DEATH TAKEN BACK.
//
// Mac, of TheHalfinStream's Enduring elder, who died of her years in Castle Wayrest on 2026-10-13 while the remains
// bug (FIELD BUGS 2026-10-13d REMAINS-STAND) hid what she lay with: "I want to roll back this specific account", then
// "Undo the death", then "Full revive".
//
// A DEATH IS A FACT EVERY COPY OF A LINE KEEPS (store.js mergeFacts: "a death is only ever added"), and every device
// that played the line keeps a copy (its store, every member's save) - so a death scrubbed from the realm's copy alone
// came back from the first stale copy to meet it, and the realm entombed her again (legacy.js entombLineDead). A death
// taken back is therefore a fact of its own, carried the same way: the person is stamped `revived: [diedAt]`, the
// `died.at` of each death taken back, and every copy that meets the stamp - a merge on a device (store.js mergeFacts,
// legacyHost.js mergeFamily), a write at the realm (legacy.js putLineage takes the stored copy's stamps into every copy
// sent) - drops THAT death and what it laid: its remains row and the Succession it left waiting. Only that death: a
// later one is another `at`, and stands. The operator's revival (tools/reviveRealmCharacter.mjs) writes the stamp.
//
// Pure, and the service's as much as the client's (server-account/src/legacy.js imports it): one law, two doors.
//
// REZ-BLOODLINE AUDIT R1 (2026-10-16): A PARTY'S RESURRECT TAKES A DEATH BACK THE SAME WAY. Online the death door writes
// a fall at once - the line's record and the realm's tombstone, so no killed tab and no second device escapes it - and a
// Resurrect inside the hold's window unwrites it with this stamp (scenes/legacyHost.js takeBack; legacy.js realmRaise
// stamps the realm's copy).
// ═══════════════════════════════════════════════════════════════════

/** REZ-BLOODLINE (FIELD BUGS 2026-10-16b): HOW LONG A FALL IS HELD FOR A PARTY'S RESURRECT, in seconds - the longest an
 *  online death screen stands (ui/deathScreen.js ONLINE_RESPAWN_SECONDS, the body's minute; the open zone's two,
 *  systems/wild/wildZone.js WILD_DEATH_HOLD_S - each counted on the wall clock) and half a minute over. One number for both
 *  doors: the page asks the realm no later (scenes/legacyHost.js REZ_HOLD_MS), and the realm takes a raise no later than
 *  this past the tombstone it stamped (server-account/src/legacy.js realmRaise) - the realm's clock starts at the
 *  tombstone's landing, after the page's, so the page's window closes first. */
export const REZ_HOLD_S = 150;

/** The deaths taken back on a person - their `died.at`s - or none. @param {any} p @returns {number[]} */
export const revivedOf = (p) => (Array.isArray(p?.revived) ? p.revived.filter((n) => Number.isFinite(n)) : []);

/** Stamp `person` with the death at `diedAt` taken back. In place. @param {any} person @param {number} diedAt */
export function stampRevived(person, diedAt) {
  if (!person || !Number.isFinite(diedAt)) return;
  const had = revivedOf(person);
  if (!had.includes(diedAt)) person.revived = [...had, diedAt];
}

/**
 * Drop from `family` every death a stamp takes back - the person's `died`, the remains row it laid (`of` them, `at` it)
 * and the Succession it left waiting (`pending`, `fallenId` them, `at` it). In place; answers whether anything went.
 * @param {any} family
 */
export function dropRevived(family) {
  const back = new Map();
  for (const p of family?.people ?? []) {
    const at = revivedOf(p);
    if (at.length) back.set(p.id, at);
  }
  if (!back.size) return false;
  let n = 0;
  for (const p of family.people) {
    if (p.died && back.get(p.id)?.includes(Number(p.died.at))) { p.died = null; n++; }
  }
  if (Array.isArray(family.remains)) {
    const kept = family.remains.filter((r) => !back.get(r?.of)?.includes(Number(r?.at)));
    n += family.remains.length - kept.length;
    family.remains = kept;
  }
  if (family.pending && back.get(family.pending.fallenId)?.includes(Number(family.pending.at))) { family.pending = null; n++; }
  return n > 0;
}

/**
 * The stamps `other` carries, taken into `mine` person by person (by id), and every death they take back dropped from
 * `mine`. In place; answers whether anything went. The merge's law (store.js mergeFacts, legacyHost.js mergeFamily) -
 * a stamp is a fact as a death is, never unheard.
 * @param {any} mine @param {any} other
 */
export function takeRevived(mine, other) {
  if (!mine) return false;
  const byId = new Map((mine.people ?? []).map((p) => [p.id, p]));
  for (const o of other?.people ?? []) {
    const p = byId.get(o?.id);
    if (p) for (const at of revivedOf(o)) stampRevived(p, at);
  }
  return dropRevived(mine);
}
