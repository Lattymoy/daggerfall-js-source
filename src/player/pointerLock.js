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

import { isTextEntryTarget } from '../ui/input.js';   // PL2: a typed field's Enter is the field's (CG2)
import { overlayOpen } from '../ui/enhancedOverlays.js';   // PL3: an enhanced overlay up (the dial, the pack) owns Enter too

let _errBound = false;

// U45 - PlayerMouseLook.cursorActive (:32, :185-213), THE TOGGLE THAT
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
// PL1: DFU refuses the toggle for 0.3 seconds after an input message
// box closes (PlayerMouseLook.cs:192-196 over the stamp
// DaggerfallInputMessageBox.CloseWindow writes at :301), because
// Return both submits the box and is the toggle's default binding -
// "players often think this is a bug". The port's input boxes stamp
// through noteInputBoxClosed below.
let _timeClosedInputBox = -Infinity;
export const INPUT_BOX_TOGGLE_REFUSAL_MS = 300;
/** DaggerfallInputMessageBox.CloseWindow's stamp (:301). */
export function noteInputBoxClosed(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  _timeClosedInputBox = now;
}
/** PlayerMouseLook.cs:196's gate - C# ALLOWS when the elapsed time is
 *  strictly greater than 0.3s, so <= refuses. */
export const cursorToggleRefused = (now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) =>
  now - _timeClosedInputBox <= INPUT_BOX_TOGGLE_REFUSAL_MS;
let _cursorActive = false;
export const cursorActive = () => _cursorActive;
export const setCursorActive = (b) => { _cursorActive = !!b; };
export function toggleCursorActive(canvas) {
  _cursorActive = !_cursorActive;
  if (_cursorActive) releaseLook();
  else if (canvas) requestLook(canvas);
  return _cursorActive;
}

/** FREEMOUSE: the action the port added beside DFU's, for the players
 *  who want a key that is ONLY the mouse. Named here because this is
 *  the one module that reads it. */
export const FREE_MOUSE_ACTION = 'FreeMouse';

/** KB1 (Mac: "Enter = chat" online; "Y frees the cursor"): WHO OWNS ActivateCursor's KEY. Offline it is DFU's - Enter
 *  frees the mouse (PlayerMouseLook.cs:190). Online the chat panel opens on that same action (ui/chatPanel.js
 *  CHAT_OPEN_ACTION), and both listeners sit on the window's capture phase, so ONE Enter opened the chat AND flipped
 *  cursorActive - and the flag, left up, then refused the relock when the chat closed. A mounted chat CLAIMS the key;
 *  the toggle then leaves ActivateCursor to it (FreeMouse, Y by default, always frees the mouse). Each release is
 *  once-only, so a panel torn down twice cannot hand back a claim another panel still holds.
 *  AUDIT KB1: A CLAIM IS PER PRESS. `takes(e)` is the claimant's own word on whether it will act on THIS event; a
 *  claim that stood for the panel's life made Enter dead whenever the chat declined it (hidden, unable to open),
 *  where DFU's Enter frees the mouse. */
const _cursorKeyClaims = new Set();
export function claimCursorKey(takes = () => true) {
  const claim = { takes };
  _cursorKeyClaims.add(claim);
  return () => { _cursorKeyClaims.delete(claim); };
}
export function cursorKeyClaimed(e = null) {
  for (const c of _cursorKeyClaims) if (c.takes(e)) return true;
  return false;
}

/** One call per host at boot: Enter (Actions.ActivateCursor) or the
 *  player's own FreeMouse key frees the mouse during play and takes it
 *  back. `isWindowUp` is the
 *  host's own overlay predicate - DFU gates on !IsGamePaused, and a
 *  window up is this port's paused. `actionsOf` answers a key event's
 *  actions - every one a shared key carries (UXB1-S; the hosts pass
 *  ui/input.js's actionsOf) - or a single action, which reads the same. */
export function bindCursorToggle(canvas, isWindowUp = () => false, actionsOf = null) {
  if (typeof addEventListener !== 'function' || !actionsOf) return () => {};
  // PL3 (2026-09-12, Mac: "The mouse pointer can still get stuck outside
  // of the game, not allowing you to interact with the game unless
  // refreshing"). The flag is a module global that NOTHING reset: a
  // host that booted after it had latched true (a new game from the
  // menu, a scene the last one left it in) had every relock arm refused
  // at requestLook's precedence line from its first frame. A host boot
  // is a fresh PlayerMouseLook (cursorActive is an instance field,
  // :32) - so the bind is the reset.
  setCursorActive(false);
  const onKey = (e) => {
    if (isWindowUp()) return;
    // PL3: the enhanced overlays the host's predicate never saw - the
    // pixel dial (Tab) and whatever it opened - own Enter while they
    // are up (the dial's Enter is its commit). The toggle fired FIRST
    // (a window capture listener registered at boot), flipped the flag
    // and released the lock, and the dial's own close never relocked:
    // every later click was refused by the precedence line, for good.
    if (overlayOpen()) return;
    if (isTextEntryTarget(e.target)) return;   // PL2: a name being typed into a DOM field is not the toggle
    // FREEMOUSE: TWO ACTIONS, ONE TOGGLE. `ActivateCursor` is DFU's
    // (PlayerMouseLook.cs:190) and keeps its meaning; `FreeMouse` is
    // the port's own row, minted because ActivateCursor's default key
    // is Enter and online Enter is also the chat's open, so the press
    // a player reaches for to free the mouse is the press that opens a
    // text box. They are ORed HERE rather than given a listener each:
    // one toggle, one flag, one place that can refuse it - a second
    // binding over `_cursorActive` is the bug PL3 spent a whole slice
    // on, in a new hat.
    const got = actionsOf(e);
    const acts = Array.isArray(got) ? got : got ? [got] : [];   // UXB1-S (AUDIT UXB1 F9: named for what the hosts hand in)
    if (!acts.includes(FREE_MOUSE_ACTION) && !(acts.includes('ActivateCursor') && !cursorKeyClaimed(e))) return;   // KB1: online, ActivateCursor's key is the chat's - when the chat takes this press
    e.preventDefault();
    // PL1: "Don't allow activate cursor for 0.3 seconds after closing
    // an input message box" (PlayerMouseLook.cs:192-196).
    if (cursorToggleRefused()) return;
    toggleCursorActive(canvas);
  };
  // PL2 (2026-09-12, Mac: "Pointer can detach from the game and you're
  // unable to click back in"). The hosts' keydown ladders are bubble
  // listeners registered BEFORE this one, and a window that closes on
  // Enter - a message box's Enter button, a conversation's, the rest
  // and level-up prompts - closes INSIDE that ladder. By the time the
  // event reached this listener `isWindowUp()` was already false, so
  // the same press that dismissed the window flipped cursorActive,
  // released the lock, and every later click was refused by
  // requestLook's precedence line (a deliberately freed cursor is
  // taken back only by the toggle). DFU never sees that press at all:
  // InputManager.Update withholds every action for inputWaitTotal
  // (0.0833 s) after a pause ends (InputManager.cs:49, :511-515 - "GUI
  // actions do not 'fall-through' to main world as closing GUI and
  // picking up next input all happen same-frame"), and ActionStarted
  // is what PlayerMouseLook.cs:190 reads. The port's one-line copy of
  // that skip is the CAPTURE phase: the guard is read before any
  // bubble listener can pop the window, so a press under a window is
  // the window's and only a press with nothing up is the toggle.
  addEventListener('keydown', onKey, true);
  // PL3: THE NET. A click that lands on the page itself - the canvas,
  // or the body beside it - with nothing up, no cursor activated and no
  // lock held is the player asking for the game back; take the lock
  // inside that gesture whatever swallowed the canvas arm (a DOM
  // element the hosts never knew, a host without the arm). A click on
  // any element of the page's UI is that element's and is left alone,
  // and a finger never holds a lock (ui/touch.js).
  const onDown = (e) => {
    if (e.pointerType === 'touch') return;
    if (typeof document === 'undefined' || document.pointerLockElement) return;
    const t = e.target;
    if (t !== canvas && t !== document.body && t !== document.documentElement) return;
    if (isWindowUp() || overlayOpen() || _cursorActive) return;
    requestLook(canvas);
  };
  if (typeof document !== 'undefined') document.addEventListener?.('pointerdown', onDown, true);
  return () => { removeEventListener('keydown', onKey, true); if (typeof document !== 'undefined') document.removeEventListener?.('pointerdown', onDown, true); };
}

// PL3: the moment of the last honoured request - the look gate's grace
// (below) reads it.
let _lastRequestAt = -Infinity;
export const RELOCK_GRACE_MS = 150;
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function requestLook(canvas) {
  // The precedence above: a cursor the player activated is not taken
  // back by the next gesture, only by the toggle.
  if (_cursorActive) return;
  _lastRequestAt = nowMs();
  if (!_errBound && typeof document !== 'undefined') {
    document.addEventListener('pointerlockerror', () => {
      console.warn('[input] pointer lock refused (focus/cooldown); the next gesture retries');
    }, false);
    _errBound = true;
  }
  try {
    // MAC1 (Mac, 2026-09-10: "camera turning being very jumpy"). The
    // bare request hands the look the OS pointer's ACCELERATED deltas
    // (Windows' "enhance pointer precision", the Mac's curve), so a slow
    // turn and a flick over the same mouse travel land different
    // angles and a fast pass overshoots. unadjustedMovement asks for
    // the raw device counts - what a game's look wants and what Unity's
    // mouse axis reads. A browser or platform without it rejects with
    // NotSupportedError, and the plain request follows on THAT
    // rejection alone; every other refusal (focus, cooldown, pending)
    // stays the no-op it was. Older browsers ignore the argument.
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (err?.name !== 'NotSupportedError') return;
        try {
          const q = canvas.requestPointerLock();
          if (q && typeof q.catch === 'function') q.catch(() => {});
        } catch { /* non-fatal */ }
      });
    }
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
    // PL3: a door that relocks INSIDE its closing gesture (ui/pauseDoor.js,
    // the talk panel, the chat) is a frame ahead of the host's "window
    // up" - the overlay slot drains after this gate runs - so the very
    // next frame saw `held` still true and released the lock the
    // gesture had just won, and the frame after asked for it back with
    // no gesture at all, which the browser refuses after an Escape exit.
    // A request honoured within the grace holds; a window that is
    // really still up releases on the frame after it.
    if (held) { if (nowMs() - _lastRequestAt > RELOCK_GRACE_MS) releaseLook(); }
    else if (wasHeld) requestLook(canvas);
    wasHeld = held;
  };
}
