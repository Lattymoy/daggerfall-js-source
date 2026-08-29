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

/* PX28b (Mac: "Tab should also minimize any open UI menus, currently
   it only applies to the radial"). PX28 taught the DIAL to put a
   window away, and that was the wrong half: `openPixelDial` is only
   reached through the host's key routing, and while an enhanced
   window is up the window owns the keyboard - so Tab never got there.
   The fix that could not miss one is here, where the registry already
   knows what is open: ONE listener, in the capture phase, alive only
   while the stack is. Nothing needs adding to a window, and a window
   added later is covered by having registered at all.

   NOT through overlayAction's 'back'. Escape means back a LEVEL in a
   window with levels - the wizard steps, the pack's tooltip pops -
   and Tab means PUT THIS AWAY. Two different words, kept apart. */
let _listening = false;

function onTab(e) {
  if (e.code !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
  // A text field owns Tab: the chronicle's note composer and the
  // spellbook's rename are both fields, and Tab in one of them is the
  // browser's own business.
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!stack.length) return;
  e.preventDefault();
  e.stopPropagation();
  closeTopOverlay();
}

function listen() {
  if (_listening || typeof window === 'undefined') return;
  window.addEventListener('keydown', onTab, true);
  _listening = true;
}

function unlisten() {
  if (!_listening || typeof window === 'undefined') return;
  window.removeEventListener('keydown', onTab, true);
  _listening = false;
}

/** Register an open overlay. Returns an unregister for the teardown to
 *  call - which it must, or the stack grows a dead arm. */
export function registerOverlay(close) {
  if (typeof close !== 'function') return () => {};
  const entry = { close };
  stack.push(entry);
  listen();
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) unlisten();
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
  if (!entry) { unlisten(); return false; }
  try { entry.close(); } catch { /* a window already gone is still closed */ }
  if (!stack.length) unlisten();
  return true;
}

/** For a host tearing down entirely. */
export function clearOverlays() { stack.length = 0; unlisten(); }
