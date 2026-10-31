// @ts-check
// PVP-VILLAIN-KEEP (2026-10-29, the PvP rework; bible/11-Multiplayer/PvP-Rework.md PVP-VILLAIN-KEEP): THE VILLAIN METER,
// KEPT ON THE CHARACTER (`realm_characters.villainy`, migration 0192). The relay counts a kill's points and signs them into
// the fall (wildReceipt.js `vp`); this service adds them to the killer's row in the fall's own batch, so a fall asked
// twice adds once. A raid's claim and a Renown report lower it, each bounded by what it paid. The mint signs the meter
// (`vl`, realm.js realmMintFacts), so a fresh relay never forgets it. A departure: DFU has no PvP.
import { VILLAIN } from '../../src/systems/wild/villainLaw.js';
import { REALM_CHARACTER_RE } from '../../src/net/identityToken.js';

/** The most a Renown report may lower the meter: a whole report's worth of monster kills and quests. */
export const VILLAIN_REPORT_DOWN_MAX = 5_000;

/**
 * A FALL'S POINTS ON ITS KILLER - the steps for the fall's own batch (wild.js wildFall and wildShielded): the receipt's
 * `vp` added to the killer's character `kc` (the account `k`'s), held to VILLAIN.max. None without points or a character.
 * @param {any} db @param {any} claims a verified fall receipt's claims
 */
export function villainFallSteps(db, claims) {
  const { k, kc, vp } = claims ?? {};
  if (!k || typeof kc !== 'string' || !REALM_CHARACTER_RE.test(kc) || !Number.isSafeInteger(vp) || vp <= 0) return [];
  return [
    db
      .prepare('UPDATE realm_characters SET villainy = MIN(?3, villainy + ?4) WHERE id = ?1 AND player = ?2')
      .bind(kc, k, VILLAIN.max, Math.min(vp, VILLAIN.max)),
  ];
}

/**
 * A RAID'S CLAIM LOWERS IT (villainLaw.js villainRaidLowers: VILLAIN.raid, none while red) - a step for the claim's own
 * batch, by THIS claim's row alone (raids.js claimRaid's `mine`, its ?3 the raid and ?4 the nonce).
 * @param {any} db @param {string} playerId @param {string} character @param {string} raid @param {string} nonce
 */
export function villainRaidStep(db, playerId, character, raid, nonce) {
  return db
    .prepare(
      'UPDATE realm_characters SET villainy = MAX(0, villainy - ?5) WHERE id = ?2 AND player = ?1 AND villainy > 0 AND villainy < ?6' +
        ' AND EXISTS (SELECT 1 FROM raid_cleanses WHERE raid = ?3 AND account = ?1 AND nonce = ?4)',
    )
    .bind(playerId, character, raid, nonce, VILLAIN.raid, VILLAIN.red);
}

/** What a Renown report may take off: its tab's word `vd` (a monster at its level 1, a quest 200), never more than the
 *  XP the report credited - the hour's progress bound - nor VILLAIN_REPORT_DOWN_MAX. 0 for a repeat (it credits none) or a bad word. */
export function villainReportDown(/** @type {unknown} */ vd, /** @type {any} */ r) {
  if (!Number.isSafeInteger(vd) || /** @type {number} */ (vd) <= 0 || !(r?.credited > 0)) return 0; // a repeat credits 0
  return Math.min(/** @type {number} */ (vd), Math.trunc(r.credited), VILLAIN_REPORT_DOWN_MAX);
}

/**
 * A RENOWN REPORT LOWERS IT, by villainReportDown's sum - the caller's own realm character, never below 0.
 * @param {any} ctx `{ db }` @param {string} playerId @param {unknown} character @param {number} down
 */
export async function lowerVillainy({ db }, playerId, character, down) {
  if (!(down > 0) || typeof character !== 'string' || !REALM_CHARACTER_RE.test(character)) return;
  await db
    .prepare(
      'UPDATE realm_characters SET villainy = MAX(0, villainy - ?3) WHERE id = ?1 AND player = ?2 AND villainy > 0',
    )
    .bind(character, playerId, down)
    .run();
}
