// Pointer-lock request that cannot crash the game.
//
// canvas.requestPointerLock() returns a Promise in modern Chrome and
// REJECTS if the document isn't focused, a request is already pending,
// or it fires inside the post-exit "user exited pointer lock" cooldown.
// Every scene called it bare - an unhandled rejection surfaced as a
// crash overlay AND left look disengaged (mouse events arrive, yaw
// frozen). This swallows the rejection: a refused lock is a no-op the
// CLICK TO LOOK hint already covers, never fatal. One click later it
// retries. Attaches a one-time pointerlockerror log per document.

let _errBound = false;

export function requestLook(canvas) {
  if (!_errBound && typeof document !== 'undefined') {
    document.addEventListener('pointerlockerror', () => {
      console.warn('[input] pointer lock refused (focus/cooldown); click again to look');
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
