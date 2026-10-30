// @ts-check
// FIXED-PVE BACKSTAB (bible/05-Combat/Fixed-PvE.md section 12): against a template foe the backstab's triple
// (combat/formulas.js backstabDamage) lands only as an opener, on a foe that has not seen the striker; once it fights,
// a blow from behind is half again. A leader (Strong, Elite, Champion) takes at most LEADER_BACKSTAB_CAP of its health
// from one. Any other target keeps Daggerfall's triple. Ledger A (FIXED-PVE).

/** A blow from behind on a template foe that has seen the striker: this times the blow, not the triple. */
export const BACKSTAB_FIGHT = 1.5;
/** The most of a leader template's health one backstab takes. */
export const LEADER_BACKSTAB_CAP = 0.4;

/**
 * The blow a landed backstab does to `target`: `before` the blow, `after` the backstab's (the triple, or `before` when
 * it failed), `unaware` the host's word that the target had not noticed the striker.
 * @param {any} target @param {number} before @param {number} after @param {boolean} unaware
 */
export function templateBackstab(target, before, after, unaware) {
  if (!target?.pveTemplate || !(before > 0) || after === before) return after;
  const d = unaware ? after : Math.round(before * BACKSTAB_FIGHT);
  if (!target.pveCategory || target.pveCategory === 'normal') return d;
  return Math.min(d, Math.max(before, Math.floor((target.maxHealth || 0) * LEADER_BACKSTAB_CAP)));
}
