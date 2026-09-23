// STATUS-LIVE (2026-09-22, kurkku via Mac: "minor thing: would be nice
// if the info panel that comes up when you press i didn't pause the
// game, that way you could quickly check your status while walking
// around"): THE LIVE READOUT'S STATE AND THE LAW THAT YIELDS IT.
//
// The BOX is ui/statusBox.js and its header carries the whole of why.
// This half is here, a leaf on systems/ with nothing from ui/ in it,
// for one reason: ui/input.js's `routeAction` is the ONE door every
// host's window keys and the large HUD's eleven panels go through, so
// the yield belongs there - and ui/input.js is imported (through
// ui/inputMessageBox.js) by ui/actionText.js, which is what the box
// extends. Importing the box from input.js closed that ring and the
// class body met `ActionTextBox` in its temporal dead zone: a real
// crash on a real import order, found by running it. A leaf cannot
// close a ring.
//
// ONE PLAYER, ONE STATUS PANEL - so one module-level pair rather than
// a fifth thing for each of the four hosts to remember. `drop` is the
// host's OWN door back out of its slot, registered when it mounted
// the box, because "is the slot free" is the question every host's
// window guards ask and a box that is merely `done` has not answered
// it yet.

import { codeForAction } from './inputActions.js';
import { buttonText } from './controlsConfig.js';

/** The live binding store, pushed down by ui/input.js's `bindings()`
 *  and `setBindings` - the ONE store, so the caption names the key
 *  that actually answers. PUSHED rather than imported, for the same
 *  reason this module is a leaf. Null until the store is first built,
 *  which is what the fallback caption below is for. */
let _store = null;
export function setStatusBindings(store) { _store = store ?? null; }

/** ClickAnywhereToClose is not this box's law, so the panel must not
 *  say it is (the AUDIT ENH-NOTICE3 B2-B4 rule: a hint tells the
 *  truth). Names the LIVE Status binding where there is one. */
export function statusReadoutHint() {
  const code = _store ? codeForAction(_store, 'Status') : null;
  const key = code ? buttonText(code, true) : null;
  return key ? `press ${key} or ESC to close` : 'press the status key or ESC to close';
}

let _live = null;
let _drop = null;

/** The box has been mounted in a host's slot: this is the live one,
 *  and `drop` is how it leaves that slot. */
export function holdStatusReadout(box, drop = null) { _live = box; _drop = drop; }
/** The box closed itself (dismissal, replacement, or the uncovering
 *  that ends a readout left under another window). */
export function forgetStatusReadout(box) { if (_live === box) { _live = null; _drop = null; } }

/** Is a readout up?
 *
 *  A `&& !_live.done` term stood here and was DEAD, which the mutant
 *  run proved: every door that raises `done` on this box goes through
 *  `StatusReadout.input`, and that forgets it in the same statement -
 *  so `_live` set AND done is a state nothing can reach. A guard no
 *  mutation can kill is a guard no reader can trust, so it is gone
 *  rather than left standing as a second, softer claim about when a
 *  readout is up. */
export const statusReadoutUp = () => !!_live;

/** Close the live readout and FREE THE HOST'S SLOT in the same act.
 *  False when there was nothing up. */
export function closeStatusReadout() {
  if (!_live) return false;
  const box = _live, drop = _drop;
  box.input();               // done, and the enhanced panel slides out
  forgetStatusReadout(box);  // (the box's own input already did, unless a caller passed something else)
  try { drop?.(box); } catch { /* the host is gone; the box is closed either way */ }
  return true;
}

/** THE ACTIONS A READOUT YIELDS TO: the ones that RAISE A WINDOW, and
 *  so want the slot it is standing in. Everything else - walking,
 *  looking, swinging, a quickslot, a torch - happens UNDER it, which
 *  is the whole point of it not pausing. Spelled out rather than
 *  derived as "not a movement key", because the set that matters is
 *  routeAction's own window arms and a derived one would quietly grow
 *  a hole every time an action is appended to the registry. */
export const STATUS_YIELD_ACTIONS = Object.freeze(new Set([
  'Escape',            // ...and Escape SPENDS the key: it closes the readout, it does not also open the pause menu
  'CharacterSheet', 'Inventory', 'LogBook', 'NoteBook', 'AutoMap', 'TravelMap',
  'CastSpell',         // the spellbook
  'Rest', 'Transport',
  'QuickSave', 'QuickLoad',
  // NOT 'ToggleConsole', 'CenterView', 'PrintScreen' or 'Slide':
  // those four are the registry rows nothing in src/ routes
  // (test/pad1.test.js's derived law names them), so a dispatch
  // would never hand one of them here - and a set that lists an
  // action no door produces reads as a promise nothing keeps.
]));

/**
 * The yield, asked once per dispatched action (ui/input.js's
 * routeAction, and the two outdoor hosts' own ladders, which do not
 * reach it). Returns true when the key is SPENT here - Escape alone,
 * which closes the readout and does nothing else, because a player
 * pressing Escape at a panel means "close this", not "and also open
 * the menu".
 */
export function statusReadoutTakesAction(act) {
  if (!statusReadoutUp() || !STATUS_YIELD_ACTIONS.has(act)) return false;
  closeStatusReadout();
  return act === 'Escape';
}

/** Tests and host teardown: forget the live readout without touching
 *  a slot that may already be gone. */
export function _resetStatusReadout() { _live = null; _drop = null; _store = null; }
