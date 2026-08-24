// Pointer-lock lifecycle (DFU parity: mouselook is the resting state,
// the cursor exists only for windows).
//
// canvas.requestPointerLock() returns a Promise in modern Chrome and
// REJECTS if the document isn't focused, a request is already pending,
// or it fires inside the post-exit "user exited pointer lock" cooldown.
// Every scene called it bare - an unhandled rejection surfaced as a
// crash overlay AND left look disengaged (mouse events arrive, yaw
// frozen). requestLook swallows the rejection: a refused lock is a
// no-op, never fatal - the next gesture retries. Attaches a one-time
// pointerlockerror log per document.
//
// makeLookGate is the per-host reconciler between the overlay state
// and the lock: a window up RELEASES the lock so the cursor can click
// it (DFU frees the mouse for every window - Escape must never be the
// only way in), and the window closing re-locks (the closing keypress
// or click is the transient user activation requestPointerLock needs;
// a refusal is covered by the hosts' relock-on-gesture arms).

let _errBound = false;

// U43 - PlayerMouseLook.cursorActive (:32, :185-213), THE TOGGLE THAT
// HAD NO CONSUMER. `ActivateCursor` has been bound to Enter in the
// input registry since I1 and nothing has ever read it, so the port
// had no way to free the mouse during play at all - and the large
// HUD's eleven panels are unreachable without one, because
// IsLargeHUDInteractable is exactly this flag.
//
// DFU'S OWN COMMENT DRAWS THE DISTINCTION THIS FLAG EXISTS FOR: "This
// is distinct from cursor being left active when UI open... When
// cursor simply active from closing a popup, etc. a click will
// recapture cursor" - a deliberately activated cursor TAKES
// PRECEDENCE and survives the click that would otherwise re-lock. In
// this port that precedence is one line inside requestLook, which
// every relock-on-gesture arm in every host already goes through, so
// there is no ninth call site to remember.
//
// FLAGGED: DFU also refuses the toggle for 0.3 seconds after an input
// message box closes, because Return both submits the box and is the
// default binding here ("players often think this is a bug"). The
// port's boxes do not share a clock with this module yet.
let _cursorActive = false;
export const cursorActive = () => _cursorActive;
export const setCursorActive = (b) => { _cursorActive = !!b; };
export function toggleCursorActive(canvas) {
  _cursorActive = !_cursorActive;
  if (_cursorActive) releaseLook();
  else if (canvas) requestLook(canvas);
  return _cursorActive;
}

/** One call per host at boot: Enter (Actions.ActivateCursor) frees
 *  the mouse during play and takes it back. `isWindowUp` is the
 *  host's own overlay predicate - DFU gates on !IsGamePaused, and a
 *  window up is this port's paused. */
export function bindCursorToggle(canvas, isWindowUp = () => false, actionOf = null) {
  if (typeof addEventListener !== 'function' || !actionOf) return () => {};
  const onKey = (e) => {
    if (isWindowUp()) return;
    if (actionOf(e) !== 'ActivateCursor') return;
    e.preventDefault();
    toggleCursorActive(canvas);
  };
  addEventListener('keydown', onKey);
  return () => removeEventListener('keydown', onKey);
}

export function requestLook(canvas) {
  // The precedence above: a cursor the player activated is not taken
  // back by the next gesture, only by the toggle.
  if (_cursorActive) return;
  if (!_errBound && typeof document !== 'undefined') {
    document.addEventListener('pointerlockerror', () => {
      console.warn('[input] pointer lock refused (focus/cooldown); the next gesture retries');
    }, false);
    _errBound = true;
  }
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* older browsers throw synchronously; non-fatal */
  }
}

/** Exit pointer lock (no-op when not held). */
export function releaseLook() {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    try { document.exitPointerLock(); } catch { /* non-fatal */ }
  }
}

/** One per host, called every frame with "is a window up". Releases
 *  the lock while a window is up; re-locks on the close edge. */
export function makeLookGate(canvas) {
  let wasHeld = false;
  return (held) => {
    if (held) releaseLook();
    else if (wasHeld) requestLook(canvas);
    wasHeld = held;
  };
}
