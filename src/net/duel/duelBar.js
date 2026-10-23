// @ts-check
// FIELD BUGS 2026-10-19f DUEL-BAR (a player's private report: in a duel, their own health bar did not drop when the other
// player hit them; the owner, 2026-10-19: "Bar shows duel vitality"): MY VITALITY AS THE REFEREE SAYS IT, the HUD's
// health bar's source for the length of a duel (ui/hud/hudVitals.js hudHealth, handed in by the world host). DISPLAY
// ONLY: nothing writes it to the save, whose health a duel never touches (INT8, bible/06-Systems/Integrity-Arc.md
// section 5).
//
// A LEAF OF ITS OWN, BESIDE THE DUEL'S LAW AND OUTSIDE IT: net/duel/duelSession.js is in the relay's bundle (the arena's
// bout reaches it, server/src/index.js), where a byte changed is a relay version and a deploy - and the client's HUD is
// no relay law.

/**
 * My own entry of the referee's word (`dref` `bout`/`hp` `h`, net/wire.js: `[[id, hp, max], [id, hp, max]]`) as the
 * HUD's health pair, or null - outside a live duel (the duel manager's `live`: null before a duel starts and once it is
 * over - won, lost, yielded, left, called off, or let go where no word of the referee's comes) and before its bout is set.
 * @param {{ h?: any[] | null } | null | undefined} live  the duel manager's `live` duel
 * @param {string} me  my own peer id
 * @returns {{ health: number, maxHealth: number } | null}
 */
export function duelVitality(live, me) {
  const mine = live?.h?.find((x) => x[0] === me);
  return mine ? { health: mine[1], maxHealth: mine[2] } : null;
}
