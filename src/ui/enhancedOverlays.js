// PX28 - WHAT IS OPEN, SO TAB CAN PUT IT AWAY.
//
// Mac: "when hitting tab a second time, it should minimize any UI."
//
// Tab already toggled the DIAL - openPixelDial closes itself on a
// second press. What it could not do is close what the dial OPENED.
// Press Tab, press Items, and the pack is up with Tab doing nothing,
// because each enhanced window owns its own keyboard and knows
// nothing about the others.
//
// This is the smallest thing that fixes it honestly: a stack of
// close-arms. Each enhanced overlay registers itself on mount and
// clears on teardown, and Tab closes the TOP one before it would open
// the dial. A stack rather than a single slot because the windows do
// stack - the pack can raise a tooltip, the sheet page can hand over
// to the spellbook - and the top one is what a player means by "this".
//
// It holds FUNCTIONS, never DOM: a registry that reached into windows
// would be a second owner of them, and every one of these already
// owns its own teardown.
const stack = [];

/** Register an open overlay. Returns an unregister for the teardown to
 *  call - which it must, or the stack grows a dead arm. */
export function registerOverlay(close) {
  if (typeof close !== 'function') return () => {};
  const entry = { close };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Is anything up? */
export const overlayOpen = () => stack.length > 0;

/**
 * Close the topmost overlay, and say whether there was one. The close
 * arm is expected to unregister itself through the handle above; the
 * splice here is the belt to that braces, so a close that forgets
 * cannot wedge the stack shut.
 */
export function closeTopOverlay() {
  const entry = stack.pop();
  if (!entry) return false;
  try { entry.close(); } catch { /* a window already gone is still closed */ }
  return true;
}

/** For a host tearing down entirely. */
export function clearOverlays() { stack.length = 0; }
