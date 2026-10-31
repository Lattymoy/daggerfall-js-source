// @ts-check
// AUDIT TECH-FEEDBACK II F6: THE TOUCH CORNER'S HELD BUTTONS, BY ACTION - a leaf the touch layer writes and a reader asks.
// A hold button presses its action's key (AUDIT 62 F8: an unbound action presses NOTHING); an action that ships with no
// key (SignatureTechnique, the Martial technique) is read here instead by the one place that polls it (the weapon rig).

/** @type {Set<string>} */
const _held = new Set();
/** The touch layer: a hold button for `action` went down, or came up. */
export function setTouchHeld(action, down) { if (down) _held.add(action); else _held.delete(action); }
/** Whether a touch corner button holds `action` now. */
export const touchHeld = (action) => _held.has(action);
/** The touch layer let every button go (its corner rebuilt, or the layer detached). */
export function clearTouchHeld() { _held.clear(); }
