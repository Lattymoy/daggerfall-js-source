// @ts-check
// COMPANION-SLOTS (2026-10-02, Mac: "Companion slots should still be limited") - ONE LAW FOR EVERYONE AT THE PLAYER'S
// SIDE. A leaf: each kind of companion registers how many of its own walk with the player now - the crew's hands
// ashore (CREW-COMPANIONS, systems/naval/crewCompanions.js, never more than its own two) and the revenants sworn to the
// player (REVENANT-COMPANION, systems/revenant/revenantCompanions.js) - and every door that would add one asks here first.

/** How many companions walk with the player at once, of every kind together. */
export const COMPANION_SLOTS = 3;
/** The refusal's words. */
export const COMPANION_SLOTS_FULL = 'Your companions are full';

/** @type {Map<string, () => number>} */
const _counts = new Map();
/** A kind of companion says how many of it walk with the player (replaces that kind's earlier word). */
export function registerCompanionCount(kind, count) {
  if (typeof count === 'function') _counts.set(kind, count); else _counts.delete(kind);
}
/** How many walk with the player now - every kind's, or every kind's but `except`'s. */
export function companionsWithYou(except = null) {
  let n = 0;
  for (const [k, f] of _counts) {
    if (k === except) continue;
    try { n += Math.max(0, Number(f()) | 0); } catch { /* a kind that cannot say counts none */ }
  }
  return n;
}
/** @type {Map<string, () => Array<{ name: string, role?: string }>>} */
const _rosters = new Map();
/** COMPANION-ROSTER: a kind's companions at the player's side as the roster's slots draw them (`name`, `role`). */
export function registerCompanionRoster(kind, list) {
  if (typeof list === 'function') _rosters.set(kind, list); else _rosters.delete(kind);
}
/** Every kind's companions at the player's side but `except`'s, each with its kind. */
export function companionRoster(except = null) {
  const out = [];
  for (const [k, f] of _rosters) {
    if (k === except) continue;
    try { for (const c of f() ?? []) if (c?.name) out.push({ kind: k, name: String(c.name), role: c.role ? String(c.role) : '' }); } catch { /* none said */ }
  }
  return out;
}
/** Room for one more at the player's side? */
export const companionSlotFree = () => companionsWithYou() < COMPANION_SLOTS;
/** Tests only: forget every kind's word. */
export function _resetCompanionSlotsForTests() { _counts.clear(); _rosters.clear(); }
