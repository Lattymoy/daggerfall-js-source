// @ts-check
// PEACE-WAY (2026-10-17, the owner: "When out of combat, the ship should traverse 15% faster") - HER WAY OUT OF A FIGHT:
// the port's own, a leaf Come Sail Away's runtime reads through its `peaceWay` seam (systems/comeSailAway/comeSailAway.js
// oarSpeed, sailSpeed, moveAccelOwn) and the world host answers (scenes/world.js, the runtime's deps). The mod has no such
// law and DFU no sea; Port-Ledger section A carries the departure.
//
// OUT OF A FIGHT is the three things the sea already reads as one: no enemy near her (Come Sail Away's own
// AreEnemiesNearby over the street's foes and the city's guards, and the sea fight's hostile ship in reach - the seam that
// already holds the helm's time scale: world.js `enemiesNearby`), no boarding under way (navalHost.js `boarding`, either
// side's), and no broadside laid (navalHost.js `aiming`). While all three hold she makes PEACE_WAY of her way, under sail
// and under oars alike, and gathers it PEACE_WAY as quickly, so the bonus is a quicker passage and never a slower
// helm: she comes up to her new way in the time she came up to her old. A coast is left as it was (her way lost with no
// sail set and no oar pulling), so the moment a fight begins she sheds the bonus at her own coast and no quicker.
//
// Only the player's own boat: the captains of the sea sail their own law (navalAI.js helm - SAIL-FREE's lesson, recorded
// on bible/03-World/Come-Sail-Away.md: scaling the captains broke the duels' tuning), so a fight's odds are what they
// were and a ship that runs from me runs from the way I make in a fight, not the way I make crossing. Online each
// player's boat is stood by her own client and said by her measured velocity (comeSailAwayWire.js), so the bonus needs
// no word of its own.

/** Her way out of a fight, against her way in one. */
export const PEACE_WAY = 1.15;

/**
 * The share of her way the sea allows her now: PEACE_WAY with no enemy near, no boarding and no gun laid; else 1.
 * @param {{ enemies?: boolean, boarding?: boolean, aiming?: boolean }} at
 */
export function peaceWayOf({ enemies = false, boarding = false, aiming = false } = {}) {
  return enemies || boarding || aiming ? 1 : PEACE_WAY;
}

/** How long one answer of the world's stands (s): the runtime asks the seam in her way, her oars, her sails and their
 *  coming on - several times a frame - and the world's answer walks every foe, guard and ship near (AUDIT 2026-10-17). */
export const PEACE_HOLD_S = 0.1;
/** `read` asked at most once a PEACE_HOLD_S of `now` (s; the page's clock) - its answer held between. */
export function heldPeaceWay(read, now = () => performance.now() / 1000) {
  let at = -Infinity, k = 1;
  return () => {
    const t = now();
    if (!(t >= at && t - at < PEACE_HOLD_S)) { at = t; k = read(); }
    return k;
  };
}

/** A seam's answer as the runtime takes it: a number in [1, PEACE_WAY] - anything else (none handed, NaN) is 1. */
export function peaceShare(k) {
  const n = Number(k);
  return Number.isFinite(n) ? Math.max(1, Math.min(PEACE_WAY, n)) : 1;
}
