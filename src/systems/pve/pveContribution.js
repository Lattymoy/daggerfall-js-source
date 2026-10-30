// @ts-check
// FIXED-PVE STAGE 6 (bible/05-Combat/Fixed-PvE.md section 8): WHO EARNED A KILL - apart from whom the foe fought
// (pveThreat.js). Damage, effective healing of a player in the fight, damage soaked while the foe struck you, interrupts
// and support each earn points. A fight cannot be farmed: damage counts only up to the foe's health in all, healing only
// on a player in the fight, and a player must have acted within Renown's assist window (net/renownTracker.js) and earned
// a twentieth of the points to qualify. A world boss or a public event gives each qualifier a roll of their own; any
// other foe goes to the party, or lone player, that earned most. Pure. Ledger A (FIXED-PVE).
import { RENOWN_ASSIST_MS } from '../../net/renownTracker.js';

/** Points per point of each act, and for an interrupt or a support act a share of the foe's health. */
export const CONTRIB = Object.freeze({ damage: 1, healing: 1, defence: 0.5, interrupt: 0.03, support: 0.02 });
/** The least share of the fight's points that qualifies. */
export const QUALIFY_SHARE = 0.05;
/** Kinds whose qualifiers each roll their own reward. */
export const PERSONAL_KINDS = Object.freeze(['worldBoss', 'raid', 'publicEvent']);

/** A fresh ledger for a foe of `maxHealth`. @param {number} maxHealth */
export const contributionLedger = (maxHealth) => ({ maxHealth: Math.max(1, maxHealth), damage: 0,
  /** @type {Map<string, { points: number, at: number }>} */ by: new Map() });

/**
 * Credit player `id` with `amount` of act `kind` at `now` (ms). Damage past the foe's health in all, and healing of a
 * player who is not in the fight, earn nothing.
 * @param {ReturnType<typeof contributionLedger>} c @param {string} id
 * @param {'damage'|'healing'|'defence'|'interrupt'|'support'} kind @param {number} [amount]
 * @param {{ now?: number, engaged?: boolean }} [o]
 */
export function addContribution(c, id, kind, amount = 1, { now = 0, engaged = true } = {}) {
  let pts = 0;
  if (kind === 'damage') {
    const counted = Math.min(Math.max(0, amount), c.maxHealth - c.damage);
    c.damage += counted; pts = counted * CONTRIB.damage;
  } else if (kind === 'healing' || kind === 'defence') pts = engaged ? Math.max(0, amount) * CONTRIB[kind] : 0;
  else pts = c.maxHealth * CONTRIB[kind];
  if (!(pts > 0)) return;
  const e = c.by.get(id);
  c.by.set(id, { points: (e?.points ?? 0) + pts, at: now });
}

/** The players who qualify at a kill at `now` (ms): acted within the assist window, earned their share. @param {ReturnType<typeof contributionLedger>} c @param {number} now */
export function qualifiers(c, now) {
  const total = [...c.by.values()].reduce((s, e) => s + e.points, 0);
  if (!(total > 0)) return [];
  return [...c.by].filter(([, e]) => now - e.at <= RENOWN_ASSIST_MS && e.points / total >= QUALIFY_SHARE).map(([id]) => id).sort();
}

/**
 * Who a kill pays: each qualifier their own roll for a personal kind; else the qualifiers of the party (or lone player)
 * with the most points. `partyOf` names a player's party, or null alone.
 * @param {ReturnType<typeof contributionLedger>} c @param {number} now @param {{ kind?: string, partyOf?: (id: string) => string|null }} [o]
 */
export function killRewards(c, now, { kind = 'normal', partyOf = () => null } = {}) {
  const q = qualifiers(c, now);
  if (PERSONAL_KINDS.includes(kind)) return { paid: q, personal: true };
  const side = (id) => partyOf(id) ?? `solo:${id}`;
  const sums = new Map();
  for (const id of q) sums.set(side(id), (sums.get(side(id)) ?? 0) + (c.by.get(id)?.points ?? 0));
  if (!sums.size) return { paid: [], personal: false };
  const best = [...sums].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
  return { paid: q.filter((id) => side(id) === best), personal: false };
}
