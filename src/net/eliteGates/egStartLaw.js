// @ts-check
// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections
// 5, 16.6 and 18): WHERE A BREACH MAY START, AND THE WAGER - the law the account service signs by and the start window
// asks by, so the window's ticks and the service's answer are one rule.
//
//   STARTING DEEPER (section 16.6): Hall 1 always (start Redoubt 0); any Redoubt the account has taken this season; or,
//     until it takes one this season, floor(best / 2) of its all-time best. Deepest first. "No carries": a member who
//     cannot make a start is refused its admission there.
//   THE WAGER (section 18): up to three decrees of the company's choosing, from three different families, for the whole
//     breach - a wagered breach ranks on the Depths alone.
//
// A LEAF, importing nothing: the account Worker bundles it (.github/workflows/account-deploy.yml lists it), and the
// hall law (net/eliteGates/egLaw.js, with its generator) stays out of that bundle. The decrees' families are copied here by number
// and HELD EQUAL to net/eliteGates/egLaw.js EG_DECREES by test/net/eliteGates/egarch_law.test.js (the arc's law for a copied table: section 29).
//
// Not a DFU member. Ledger A (ELITE-GATES).

/** The most decrees a Wager takes, and the deepest start an order may name (net/identityToken.js EG_ORDER_START_MAX). */
export const EG_WAGER_MAX = 3;
export const EG_START_DEEPEST = 999;
/** Each decree's family by its number - net/eliteGates/egLaw.js EG_DECREES' `fam`, copied and held equal by a test. */
export const EG_WAGER_FAMILY_OF = Object.freeze([
  'blows', 'blows', 'blows', 'blows', 'legion', 'legion', 'legion', 'legion', 'legion', 'ground', 'ground', 'ground', 'ground',
  'covenant', 'covenant', 'lord', 'lord', 'lord', 'lord', 'ground',   // AUDIT EG V (L2-10): 19 The Fraying, the ground's
]);

/**
 * THE STARTS AN ACCOUNT MAY MAKE: `season` the Redoubts it has taken this season (any order, repeats allowed), `best`
 * its all-time deepest - `[...Redoubts deepest first, 0]`, 0 being Hall 1. Until a Redoubt is taken this season, the
 * one start below Hall 1 is floor(best / 2) (none when that is 0). Pure.
 * @param {ReadonlyArray<number>} season @param {number} best
 */
export function egStartsFrom(season, best) {
  const ok = (w) => Number.isSafeInteger(w) && w >= 1 && w <= EG_START_DEEPEST;
  const taken = [...new Set((season ?? []).filter(ok))];
  const deeper = taken.length ? taken : (ok(Math.floor((Number(best) || 0) / 2)) ? [Math.floor(best / 2)] : []);
  return [...deeper.sort((a, b) => b - a), 0];
}
/** Whether start `ew` is one of `starts` (Hall 1 always is). */
export const egMayStart = (starts, ew) => ew === 0 || (Array.isArray(starts) && Number.isSafeInteger(ew) && ew > 0 && starts.includes(ew));

/**
 * A WAGER, read: up to EG_WAGER_MAX decree numbers, each a decree, no two of one family - answered sorted, or null for
 * anything else (an empty list is no Wager: `[]`). Pure.
 * @param {unknown} ids
 */
export function egWagerOf(ids) {
  if (ids == null) return [];
  if (!Array.isArray(ids) || ids.length > EG_WAGER_MAX) return null;
  const fams = new Set();
  for (const id of ids) {
    const fam = Number.isSafeInteger(id) ? EG_WAGER_FAMILY_OF[id] : undefined;
    if (!fam || fams.has(fam)) return null;
    fams.add(fam);
  }
  return [...ids].sort((a, b) => a - b);
}
/** Whether decree `id` may join Wager `wg` (a decree, not held, its family not held, room left) - the window's toggle. */
export const egWagerTakes = (wg, id) => egWagerOf([...(wg ?? []), id]) != null;
