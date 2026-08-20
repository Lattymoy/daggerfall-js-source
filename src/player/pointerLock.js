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

export function requestLook(canvas) {
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
