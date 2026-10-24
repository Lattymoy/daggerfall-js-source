// ═══════════════════════════════════════════════════════════════════
// LAMP-KEEPER II (2026-10-14, Mac: "Reimplement an old bug that was previously removed. A chance of finding a vendor
// NPC as a lamp model. Anybody that interacts with the lamp model should earn the 'I Love Lamp' title"): THE LAMP'S
// TITLE, KEPT ON THE ROW.
//
// A shop's keeper stands as a lamp now and then (src/systems/lampKeeper.js - the room's own pick, every client's), and
// the account that speaks to one is granted I Love Lamp: `players.lamp_title` (migration 0113), laid once and held for
// good, read off the row by titles.js titlesHeld as Hourbreaker is read off `sd_honours`. A guest - no handle - holds
// no title (FOUNDER's law), so its word is answered `guest` and nothing is written.
//
// TRUSTED AS SPOKEN: no relay sees an interior's people, so nothing signs the meeting - the claim is the account's own
// word, as a novelty title's may be (it buys nothing and opens nothing). Rate-limited with every act (index.js).
//
// Not a DFU member. Ledger A (LAMP-KEEPER).
// ═══════════════════════════════════════════════════════════════════

/** The title's word, in the vocabulary's spelling (src/net/identityToken.js TITLES). */
export const LAMP_TITLE = 'ilovelamp';

/**
 * THE CLAIM: `{ granted: true }` the first time this account speaks to a lamp keeper, `{ granted: false, why: 'held' }`
 * after, `{ granted: false, why: 'guest' }` for a row with no handle. One UPDATE whose WHERE holds it to the first.
 * @param {{ db: any }} ctx
 * @param {{ id: string, handle?: string|null }} player
 */
export async function claimLamp({ db }, player) {
  if (!player?.handle) return { granted: false, why: 'guest' };
  const r = await db.prepare('UPDATE players SET lamp_title = 1 WHERE id = ?1 AND lamp_title = 0').bind(player.id).run();
  return Number(r?.meta?.changes ?? 0) > 0 ? { granted: true } : { granted: false, why: 'held' };
}
