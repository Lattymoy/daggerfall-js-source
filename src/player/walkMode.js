// PADWALK (Mac: "make ... walk mode bindable on controller"): WALK MODE, ONE BUTTON ON AND OFF.
//
// DFU's slow, quiet walk is Sneak, held (LeftAlt). Walk mode is the same walk LATCHED: the WalkMode action's key or
// pad button turns it on, the same press turns it off. The hosts read `walkModeOn()` beside their held Sneak, so the
// motor sees exactly what a held Sneak would give it. A pad button reaches here the way every pad button reaches the
// hosts - as the poller's synthetic keydown (ui/gamepadInput.js synth) - so there is one toggle for both hands.
// Running (a Run press) lets it go, so a sprint is never slowed by a latch left on.

let _on = false;
let _bound = false;

export const WALK_MODE_ACTION = 'WalkMode';
export const walkModeOn = () => _on;
export function setWalkMode(v) {
  _on = !!v;
  return _on;
}
export function toggleWalkMode() {
  _on = !_on;
  return _on;
}

/** One listener for the page (idempotent): `actionsOf(e)` answers a key event's actions (ui/input.js actionsOf);
 *  `isWindowUp()` gates it off while a window is up, as the cursor toggle is. */
export function bindWalkMode(actionsOf, isWindowUp = () => false) {
  if (_bound || typeof addEventListener !== 'function' || !actionsOf) return () => {};
  _bound = true;
  const onKey = (e) => {
    if (e.repeat || isWindowUp()) return;
    const got = actionsOf(e);
    const acts = Array.isArray(got) ? got : got ? [got] : [];
    if (acts.includes(WALK_MODE_ACTION)) toggleWalkMode();
    else if (acts.includes('Run') && _on) _on = false;
  };
  addEventListener('keydown', onKey, true);
  return () => {
    removeEventListener('keydown', onKey, true);
    _bound = false;
  };
}
