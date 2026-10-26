// @ts-check
// ═════════════════════════════════════════════════════════════════════
// WILD-REJOIN (FIELD BUGS 2026-10-25h, bible/11-Multiplayer/Wild-Zone.md section 4): A FALL THAT OUTLIVES ITS PAGE.
//
// The report: "if you die in the wilderness and alt f4 before you are looted you wont be able to be looted by who killed
// you. you can also skip the death timer this way."
//
// A fall in the zone lives in the relay's referee and on the dying game's screen. The account service's record is the
// last save from before the fall - a dead character is never saved - so a game closed on the death screen came back
// alive, where it last saved, with its two minutes skipped. The referee still holds the fighter down for its two minutes,
// and now says so to a socket that stands in the zone (net/wild/wildRef.js wildDownWord, `wref` `down`). This module
// decides what the page does with that word:
//
//   - A page that saw its own death in the zone in the last WILD_REJOIN_KNOWN_MS knows it already - it is on the death
//     screen, risen from it, or raised by a party's Resurrect - and takes nothing from the word.
//   - Any other living page is the one that came back: it lies down again for the time the word says is left, and its
//     body is where the word says the fall was (the room's frame), so the drop the fall's receipt takes is laid there.
//
// The host (scenes/world.js) hands in the clock and the death's presenter, and lays the body where the answer says.
// ═════════════════════════════════════════════════════════════════════
import { WILD_DEATH_HOLD_S, setWildDeath } from './wildZone.js';

/** How long after its own death in the zone a page takes no `down` word, ms: the death's hold, and the referee's
 *  margin over it with room to spare (net/wild/wildRef.js WILD_DOWN_SAY_MIN_MS). */
export const WILD_REJOIN_KNOWN_MS = (WILD_DEATH_HOLD_S + 30) * 1000;

/**
 * @typedef {object} WildRejoinDeath   the death a page that came back takes
 * @property {number} servedS          seconds the death lay before this page heard of it
 * @property {number[] | null} p       where the body lies in that room's frame, `[x, y, z]`, or null when unknown
 */

/**
 * @typedef {object} WildBody          where my body lies, read at the death for the deposit that follows it
 * @property {number[]} p              the body's place in its room's frame, `[x, y, z]`
 * @property {string} room             the room the remains are laid in
 * @property {string | null} dungeon   the hall it lies in (its lock's key - PVPDUNGEONS), or null outdoors
 * @property {{ x: number, y: number } | null} px   the map pixel it lies on (the world map's mark)
 */

/**
 * @typedef {object} WildPlace         where the player stands now, as the body record needs it
 * @property {string | null} dungeon   the hall's key, or null
 * @property {{ x: number, y: number } | null} px   the travel map pixel, or null
 */

/**
 * @param {{ now?: () => number, present?: () => void, place?: () => WildPlace }} [o] `now` a wall clock, ms; `present`
 *   puts the character down and its death screen up without telling the death's subscribers again
 *   (characters/playerEntity.js presentHeardDeath); `place` where the player stands now (the host's hall and pixel)
 */
export function createWildRejoin({ now = () => Date.now(), present = () => {}, place = () => ({ dungeon: null, px: null }) } = {}) {
  let ownDeathAt = -Infinity;
  /** @type {WildRejoinDeath | null} */
  let waiting = null;
  return {
    /**
     * THE BODY RECORD, one home for both deaths that lay one (the first dead frame's, at the death mark; a death the
     * referee told of, where its word says): the place, the room, and the hall and pixel the player stands in now.
     * @param {number[]} p @param {string} room
     * @returns {WildBody}
     */
    bodyAt(p, room) {
      const here = place();
      return { p: [...p], room, dungeon: here.dungeon ?? null, px: here.px ?? null };
    },
    /** This page's first dead frame in the zone: its own death noted, and the death the referee told of, if this is
     *  one - answered once, and only inside its own hold (a word whose death never reached a dead frame in the zone is
     *  never a later death's). */
    begin() {
      const death = waiting && now() - ownDeathAt < WILD_REJOIN_KNOWN_MS ? waiting : null;
      ownDeathAt = now();
      waiting = null;
      return death;
    },
    /**
     * The referee's `down` word (net/wire.js validWildRefOut's projection: `{ ms, r?, p? }`), heard while `alive` says
     * whether the character stands. Answers the death this page takes - its words set (systems/wild/wildZone.js: a kill,
     * nothing dropped yet, the time served) and the character put down - or null when the word is not for it.
     * @param {{ ms: number, r?: string, p?: number[] }} word @param {{ alive: boolean }} state
     * @returns {WildRejoinDeath | null}
     */
    heard(word, { alive }) {
      if (!alive || now() - ownDeathAt < WILD_REJOIN_KNOWN_MS) return null;
      if (!(Number.isFinite(word?.ms) && word.ms > 0)) return null;
      ownDeathAt = now();
      const servedS = Math.max(0, WILD_DEATH_HOLD_S - Math.ceil(word.ms / 1000));
      waiting = { servedS, p: Array.isArray(word.p) ? [...word.p] : null };
      setWildDeath({ kill: true, dropped: 0, served: servedS });
      present();
      return waiting;
    },
  };
}
