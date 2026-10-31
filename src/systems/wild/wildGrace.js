// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ZONE-GRACE (2026-10-26, the owner: "making the experience more palatable while retaining its punishment"; asked,
// "Entry/rise grace") - SAFE PASSAGE, AS THIS GAME HEARS IT (bible/11-Multiplayer/Wild-Zone.md section 3b).
//
// The relay's referee keeps it (net/wild/wildRef.js WILD_GRACE: sixty seconds after entering the zone or rising from a
// fall, no player's blow lands; one's own blow on a player ends it) and says it (`wref` `grace` - net/wire.js
// validWildRefOut). This says it to the player: my own begun (once - a cell crossed carries it, and is said again by the new
// room), ended by my own blow or run out, and a blow of mine it kept off a stranger (at most once in WILD_GRACE_SAY_MS).
// It keeps who else is under it, for any door that asks (`graced`). Nothing here decides a blow: the referee does.
// ═══════════════════════════════════════════════════════════════════
import { WILD_TEXT } from './wildZone.js';

/** The least time between two "kept off" lines, ms - a held button refused on every swing says it once. */
export const WILD_GRACE_SAY_MS = 3_000;

/**
 * @param {{ me: () => string | null, say: (line: string) => void, now?: () => number }} o - `me` my socket's id (the
 *   referee's words name fighters by it), `say` the line's door
 */
export function createWildGrace({ me, say, now = () => Date.now() }) {
  /** @type {Map<string, number>} fighter id -> when its safe passage ends */
  const until = new Map();
  let mine = 0,
    keptSaid = -Infinity;
  const secs = (/** @type {number} */ ms) => Math.max(1, Math.ceil(ms / 1000));
  return {
    /** A referee's `grace` word (`{ id, ms, n? }`). */
    heard(/** @type {{ id: string, ms: number, n?: number }} */ g) {
      const at = now();
      if (g.ms > 0) until.set(g.id, at + g.ms);
      else until.delete(g.id);
      if (g.n === 1) {
        if (at - keptSaid >= WILD_GRACE_SAY_MS) {
          keptSaid = at;
          say(WILD_TEXT.graceKept(secs(g.ms)));
        }
        return;
      }
      if (g.id !== me()) return;
      if (g.ms > 0) {
        const fresh = mine <= at;
        mine = at + g.ms;
        if (fresh) say(WILD_TEXT.graceOn(secs(g.ms)));
      } else if (mine > at) {
        mine = 0;
        say(WILD_TEXT.graceOff());
      }
    },
    /** The zone's frame: my safe passage run out, said - and (AUDIT PVP-EASE L3-7, L4-6) out of the zone, nothing heard
     *  stands and nothing is said ("Other players can attack you" a minute after the step out, where none can); the
     *  strangers' passages run out forgotten. @param {boolean} [inZone] */
    frame(inZone = true) {
      if (!inZone) {
        if (mine || until.size) this.clear();
        return;
      }
      const at = now();
      for (const [id, end] of until) if (end <= at) until.delete(id);
      if (mine && mine <= at) {
        mine = 0;
        say(WILD_TEXT.graceOff());
      }
    },
    /** How long my safe passage has left, ms. */
    mine: () => Math.max(0, mine - now()),
    /** Whether fighter `id` is under safe passage, as last heard. @param {string} id */
    graced: (id) => (until.get(id) ?? 0) > now(),
    /** The room left or the zone with it: nothing heard stands. */
    clear() {
      until.clear();
      mine = 0;
    },
  };
}
