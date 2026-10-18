// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT18 (2026-10-17, the INTEGRITY arc's lane 4 - bible/06-Systems/Integrity-Arc.md section 7): THE FAMILY'S OWN LAW, AS
// THE REALM ASKS IT. A line's record is the client's (family.js - its births, its deaths, what each member inherits) and
// the account service keeps the copy every device reads (server-account/src/legacy.js putLineage): it took any record of
// the family's shape, so a modified client could write a member's blood or hearth past what the family law ever gives,
// an estate past its ceiling, and a copy that unwrote a death the line had recorded. The bounds live here - a leaf, so the
// Worker reads the family law's own numbers without the family's dice, names and chargen behind it - and family.js and
// heirloom.js take them from here: one home each.
//
// What an honest copy can never be: a member's blood a stat gift past BLOOD_MAX or not whole, a hearth a skill gift past
// HEARTH_MAX or on no skill, a waiting estate past ESTATE_MAX; and, beside the copy stored, one that has lost a member, a
// death, a retirement or a fallen's remains - the facts store.js mergeFacts only ever adds (REVIVE's stamps take a death
// back before this is asked: legacy.js withoutRevived).
// ═══════════════════════════════════════════════════════════════════

import { SKILL_COUNT } from '../skills.js';

/** THE BLOOD: a stat's gift is `round((parent - 50) / 10)`, held to 0..3 (family.js bloodOf). */
export const BLOOD_MAX = 3;
/** THE HEARTH: a primary or major skill's gift is `floor(parent / 20)`, held to 0..3 (family.js hearthOf). */
export const HEARTH_MAX = 3;
/** THE ESTATE: a quarter of the purse the dead carried, at most what fits under the online birth's liquid ceiling
 *  beside the gold every birth carries (net/realm/realmGoldLaw.js REALM_BIRTH_WEALTH_MAX less systems/startingGear.js
 *  STARTING_GOLD - restated, and pinned equal, so this leaf imports no net code). AUDIT LEGACY H7: it was the ceiling
 *  itself, and a born heir's first save would have carried 10,100. */
export const ESTATE_SHARE = 0.25;
export const ESTATE_MAX = 9_900;
/** The share of the fallen's purse that lies with them - a tenth, at most REMAINS_GOLD_MAX (AUDIT LEGACY H7: it had
 *  no ceiling). A quarter more is the estate (ESTATE_SHARE); the rest is the fallen's save's, and the past's. */
export const REMAINS_GOLD_SHARE = 0.1;
export const REMAINS_GOLD_MAX = 2_500;
/** A member's blood names at most the eight stats. */
export const BLOOD_KEYS_MAX = 8;

const whole = (/** @type {unknown} */ v, /** @type {number} */ max) => Number.isInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= max;
const isObject = (/** @type {unknown} */ v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * WHAT A LINE'S COPY BREAKS of the family's own law - short codes, none for a lawful copy: 'blood', 'hearth', 'estate'
 * (the copy alone), and beside `stored` (the copy the realm keeps, or null for a founding) 'member' (one it held is
 * gone), 'death' (one it recorded is undone), 'retired' (likewise), 'remains' (a fallen's remains it held are gone).
 * @param {any} record @param {any} [stored]
 * @returns {string[]}
 */
export function lineageLawFindings(record, stored = null) {
  const out = new Set();
  const people = Array.isArray(record?.people) ? record.people : [];
  for (const p of people) {
    if (p?.blood !== undefined) {
      if (!isObject(p.blood) || Object.keys(p.blood).length > BLOOD_KEYS_MAX || !Object.values(p.blood).every((v) => whole(v, BLOOD_MAX))) out.add('blood');
    }
    if (p?.hearth !== undefined) {
      if (!isObject(p.hearth) || !Object.entries(p.hearth).every(([k, v]) => /^(0|[1-9]\d?)$/.test(k) && Number(k) < SKILL_COUNT && whole(v, HEARTH_MAX))) out.add('hearth');
    }
  }
  if (record?.pending != null && !whole(record.pending.estate ?? 0, ESTATE_MAX)) out.add('estate');
  if (stored && Array.isArray(stored.people)) {
    const byId = new Map(people.map((/** @type {any} */ p) => [p?.id, p]));
    for (const was of stored.people) {
      const now = byId.get(was?.id);
      if (!now) { out.add('member'); continue; }
      if (was.died && !now.died) out.add('death');
      if (was.retired != null && now.retired == null) out.add('retired');
    }
    const rows = new Set((Array.isArray(record?.remains) ? record.remains : []).map((/** @type {any} */ r) => r?.id));
    for (const r of Array.isArray(stored.remains) ? stored.remains : []) if (!rows.has(r?.id)) out.add('remains');
  }
  return [...out];
}
