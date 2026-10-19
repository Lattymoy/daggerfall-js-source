// @ts-check
// OUTDOOR-LOOT FOLLOW-UPS (2026-10-19, Travis: "I heard a report of someone killing a bear and not seeing the skin option even though they had a skinning knife"): THE STRIKER'S LEDGER.
//
// A blow on a PEER'S foe is handed to the owner as a hit (scenes/exteriorFoes.js damageFoe's divert); the foe dies at the owner,
// and the owner says `slain: 1` to the striker whose blow killed it. DISC10-E latched the blow on the PUPPET OBJECT
// (`f._struckAt`) and landed the word only inside SLAIN_WINDOW_MS (3000, the take's round trip). But each side's hit queue
// (net/hitPend.js) holds a refused frame up to 2000 ms before it gives it up, so in a fight - the rate gate spent - the blow can wait
// 2 s at the striker, the word 2 s at the owner: the credit arrived ~4 s after the blow it answers, and was refused. The killer got
// no kill report (playerKills.js: sets, quests, the werewolf's urge) and no Hunting stamp (huntHost.js createBodyStamps).
//
// So the credit is a LEDGER, not a latch on a puppet: `(owner, seq) -> { at, entity, mobileType }`, written at every blow of
// mine on a peer's foe (the last blow's time wins). A `slain` lands ONCE inside SLAIN_KEEP_MS of that blow - and with the puppet
// swept (a stream gap, a room change that is no seam, the owner gone quiet) it lands on the ledger's own entity. The anti-forgery
// rule of DISC10-E stays whole: a word credits only a body I STRUCK, only from the foe's OWNER (the key names the sender), once,
// and what it was is what my puppet said it was at the blow, never what the frame says.
//
// Small and bounded: a Map in insertion order (a re-noted body moves to the end), at most STRIKES_KEPT_MAX bodies, and the
// expired go from the front as new blows come. Pure; the pool wires it. Not a DFU member: Daggerfall has one player.

/** How long after my LAST blow on a peer's foe its owner's `slain` is still mine - a minute: longer than any queue's 2 s at each end
 *  and a stalled link, shorter than a fight that has moved on. */
export const SLAIN_KEEP_MS = 60_000;
/** The most struck bodies the ledger holds (the oldest go first): a pool stands tens of puppets, a hundred blows a minute is a crowd. */
export const STRIKES_KEPT_MAX = 64;

/** @typedef {{ at: number, entity: any, mobileType: number | null }} Strike */

export function createStrikeLedger() {
  /** @type {Map<string, Strike>} */
  const struck = new Map();
  const key = (/** @type {string} */ owner, /** @type {number} */ seq) => `${owner}:${seq}`;
  /** The expired and the surplus, from the front (the oldest blow is first). */
  const trim = (/** @type {number} */ now) => {
    for (const [k, s] of struck) { if (now - s.at > SLAIN_KEEP_MS || struck.size > STRIKES_KEPT_MAX) struck.delete(k); else break; }
  };
  return {
    /** My blow on `owner`'s foe `seq`, at `now` (the pool's clock): its entity and what it is, as my puppet of it says. */
    note(/** @type {string} */ owner, /** @type {number} */ seq, /** @type {number} */ now, /** @type {any} */ entity, /** @type {number | null} */ mobileType) {
      const k = key(owner, seq);
      struck.delete(k);   // the last blow's place in the order
      struck.set(k, { at: now, entity, mobileType: Number.isInteger(mobileType) ? mobileType : null });
      trim(now);
    },
    /** The owner's `slain` for `seq`, heard at `now`: the strike it answers, ONCE - or null for a body I never struck, one struck more
     *  than SLAIN_KEEP_MS ago (let go), or one already credited. */
    land(/** @type {string} */ owner, /** @type {number} */ seq, /** @type {number} */ now) {
      const k = key(owner, seq);
      const s = struck.get(k);
      if (!s) return null;
      struck.delete(k);
      return now - s.at > SLAIN_KEEP_MS ? null : s;
    },
    /** The pool going away: no blow of the old world is credited in the next. */
    clear() { struck.clear(); },
    get size() { return struck.size; },
  };
}
