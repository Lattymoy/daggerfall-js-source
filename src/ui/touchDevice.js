// @ts-check
// TI3 (2026-09-17, Mac: "Some desktop users are reportably recieving the
// mobile UI instead of desktop"). THE ONE HOME of "is this a touch
// device": ui/touch.js re-exports it for the layer and its callers,
// scenes/dataSource.js's diet reads it too.
//
// The law it replaces was a SNIFF - `'ontouchstart' in window ||
// navigator.maxTouchPoints > 0` - and Chromium answers both on any
// Windows machine with a touch digitizer, and maxTouchPoints > 0 on a
// laptop whose pen or touchpad driver registers as one: a desktop with
// a mouse got the stick, the buttons and the lean data diet. The
// question actually being asked is "is the PRIMARY pointer a finger",
// and CSS Media Queries Level 4 answers it: `(pointer: coarse)` and
// `(hover: none)` are both true on a phone or a tablet in hand, and a
// touchscreen laptop answers fine + hover for its mouse (AUDIT QS F8
// reached the same pair for the quickslot diamond). The sniff stays as
// the FALLBACK where matchMedia is absent or does not know the query
// (neither coarse nor fine matches), so an old phone keeps its layer.
//
// `?touch=on` / `?touch=off` is the door, for the player the heuristic
// still gets wrong (an iPad with a trackpad answers fine + hover and is
// desktop here; the door puts the layer back). A leaf: no DOM, no prefs.

export const TOUCH_DOOR = /[?&]touch=(on|off)\b/;

/** The door's answer: true, false, or null when the query has none. */
export function touchDoor(search = '') {
  const m = TOUCH_DOOR.exec(String(search ?? ''));
  return m ? m[1] === 'on' : null;
}

/** Whether a finger is the way this page is pointed at. `win` is the
 *  window-like the hosts run under (node stubs one). */
export function isTouchDevice(win = globalThis.window) {
  if (!win) return false;
  const door = touchDoor(win.location?.search);
  if (door !== null) return door;
  const sniff = 'ontouchstart' in win || (win.navigator?.maxTouchPoints ?? 0) > 0;
  if (!sniff) return false;
  if (typeof win.matchMedia !== 'function') return true;   // no media queries: the sniff is all there is
  try {
    const coarse = win.matchMedia('(pointer: coarse)').matches;
    const fine = win.matchMedia('(pointer: fine)').matches;
    if (!coarse && !fine) return true;   // the query is unknown here (neither answers): the sniff stands
    return coarse && win.matchMedia('(hover: none)').matches;
  } catch { return true; }
}
