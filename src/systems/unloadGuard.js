// @ts-check
// MAC-L3 (2026-09-16, Mac relaying Orion: "right click in general seems
// to cause either a new window to open, or for the page to refresh to
// the menu, causing unsaved progress to be lost").
//
// ═══ THE HALF THAT IS NOT THE RIGHT BUTTON ════════════════════════
//
// The browser menu is shut once now (ui/input.js's
// `installContextMenuGuard`), and that answers the first half of the
// report. It does not answer the second, and the second is the one that
// costs a player their evening.
//
// THIS PORT HAD NO UNLOAD GUARD AT ALL. Not one `beforeunload` in the
// tree. Every way out of a running game was silent and instant:
//
//   - a mouse gesture the browser reads as Back (a right-drag or a
//     rocker, which some mice and some browsers do by default, and
//     which a page that suppresses `contextmenu` makes MORE likely
//     rather than less, because nothing absorbs the press);
//   - the Back button, or a swipe on a trackpad;
//   - Ctrl-W, Ctrl-R, F5 on a build where the swallow missed;
//   - closing the tab on the wrong window.
//
// Any of them and the save is whatever it was an hour ago. So the fix
// is not to chase the gesture - there are too many and they are the
// browser's, not ours - but to put a door in front of ALL of them. That
// is what `beforeunload` is for, and it is the only thing that catches
// a navigation the page did not start.
//
// ═══ WHAT IT DOES NOT DO ══════════════════════════════════════════
//
// It does not save for the player. An automatic save on the way out
// sounds kinder and is a trap: `beforeunload` gives no time for async
// work, the write would be half-done as often as not, and a corrupt
// slot is worse than a stale one. It ASKS, and the browser draws its
// own wording; nothing here can change that text.
//
// It also does not fire for a navigation the GAME asked for. Exiting to
// the title menu, a deliberate reload onto a moved build - those call
// `releaseUnloadGuard` first, because prompting a player for a door
// they just opened themselves trains them to click through the prompt
// that matters.
//
// Not a DFU member: Daggerfall Unity is not in a browser tab. Ledger A
// row (THE BROWSER TAB'S OWN DOORS).

/**
 * THE ARMS, PLURAL, and that is not an accident.
 *
 * THE FOUR HOSTS are not one at a time: `scenes/world.js` boots and
 * hands its interiors and dungeons to `scenes/worldModes.js`, and a
 * single `_atRisk` slot meant the last host to arm silently replaced
 * the first one's answer - the world host's honest "has the player
 * spawned yet" quietly overwritten by a mode machine's "yes". One slot
 * for four hosts is the same shape of bug as one name for two meanings,
 * which is what MAC-L1 spent its morning on.
 *
 * So every arm stands on its own and the question is asked of ALL of
 * them: if ANY host says something would be lost, the browser asks.
 * @type {Set<() => boolean>}
 */
const _arms = new Set();
/** @type {any} the window the listener went on, so it is installed once */
let _installed = null;

/**
 * Arm the guard for one host. `atRisk()` is asked at the moment of the
 * navigation - not now - so a host can arm at boot and answer honestly
 * later.
 *
 * @param {() => boolean} atRisk
 * @param {any} [win] the window to listen on (the tests hand their own)
 * @returns {() => void} this arm's own release - a host that tears down
 *   drops its answer without touching anybody else's
 */
export function armUnloadGuard(atRisk, win = (typeof globalThis !== 'undefined' ? globalThis : null)) {
  _arms.add(atRisk);
  if (win?.addEventListener && _installed !== win) {
    _installed = win;
    win.addEventListener('beforeunload', (e) => {
      if (!unloadGuardWouldAsk()) return;
      // The two halves every browser has wanted at one time or another.
      // `returnValue` is the old spelling and is still what some engines
      // read; `preventDefault` is the current one. Both, because the
      // cost of the wrong one is the bug this file exists for.
      e.preventDefault();
      e.returnValue = '';
      return '';
    });
  }
  return () => { _arms.delete(atRisk); };
}

/**
 * Stand EVERY arm down - the game itself is navigating.
 *
 * The listener stays (removing and re-adding it is one more thing to
 * get wrong); it is the ANSWERS that go away, which is the same thing
 * from the outside and cannot leave a half-installed state behind.
 */
export function releaseUnloadGuard() {
  _arms.clear();
}

/** For the pins: is anything armed, and would it ask right now? */
export const unloadGuardArmed = () => _arms.size > 0;
export const unloadGuardWouldAsk = () => {
  for (const atRisk of _arms) if (atRisk()) return true;
  return false;
};

/** The tests drive a fresh window per case. */
export function resetUnloadGuard() {
  _arms.clear();
  _installed = null;
}
