/**
 * THE WINDOW STACK - UserInterfaceManager (Game/UserInterface/
 * UserInterfaceManager.cs), ported whole.
 *
 * DFU keeps every open UI window on ONE stack. `TopWindow` is the only
 * window that receives input and the only one a window-aware system
 * (DaggerfallRestWindow's `uiManager.TopWindow != this`, :364/:399)
 * tests itself against; `PushWindow` lays a new window OVER whatever is
 * open; `PopWindow` returns to the one beneath and calls its `OnReturn`.
 * The game pauses for any window whose `PauseWhileOpen` is set - the
 * default (UserInterfaceWindow.cs:141) - and stays paused until the
 * stack drains back to the HUD.
 *
 * The port has held ONE overlay slot per host since U3, which is why
 * worldModes' `mountInterior` carries a FLAG saying pause-and-resume of
 * a rest "is the DFU behaviour and a single-slot host cannot have it".
 * This module is that missing depth, in the shape the existing slots
 * can adopt: a host keeps its slot variable as the MIRROR OF THE TOP
 * (`onTop` writes it) and the stack carries what is underneath. A door
 * that used to replace the occupant pushes instead, the ~40 close paths
 * that null the slot by hand keep working - `reconcile` reads the live
 * slot back and turns "the slot went empty" into a pop.
 *
 * NOT ported here, deliberately:
 *   - PushWindow's `InputManager.ClearAllActions` (:82) and the fade
 *     clear (:85-86). The first is offered as the optional
 *     `clearActions` hook because the port has no InputManager layer;
 *     the second belongs to DaggerfallUI's fade behaviour, which the
 *     port's hosts own.
 *   - RemoveWindow's `PlayerActivate.SetClickDelay` (:206/:214). That
 *     half is ALREADY ported, in systems/activateGate.js - the gate
 *     arms the delay itself off `paused` rather than asking four hosts
 *     to remember, and arming it here as well would double it.
 */

/** UserInterfaceManager.cs:38. */
const MAX_MESSAGE_COUNT = 10;

/** UserInterfaceWindow.cs:141 - `pauseWhileOpened` defaults TRUE, so a
 *  plain port window (no field at all) pauses, which is exactly what
 *  every host's `overlayHeld` already assumes. Only an explicit
 *  `pauseWhileOpen: false` - DaggerfallHUD's override - opts out. */
export const pauseWhileOpen = (win) => !!win && win.pauseWhileOpen !== false;

/**
 * Build a stack.
 *
 * @param hud            the base window that is never popped
 *                       (DaggerfallHUD). RemoveWindow branches on
 *                       DaggerfallUI.enableHUD (:201-215) and the
 *                       port's hosts draw their HUD outside the stack,
 *                       so they pass none and take the `enableHUD ==
 *                       false` arm - drain at `windows.Count < 1`.
 * @param onTop          called with the new top (or null) whenever it
 *                       changes - the host's slot mirror.
 * @param onWindowChange OnWindowChange (:41), raised by Push/Pop/Change.
 * @param clearActions   InputManager.ClearAllActions (:82).
 */
export function makeWindowStack({ hud = null, onTop = null, onWindowChange = null, clearActions = null } = {}) {
  /** windows.Peek() is the LAST element here. */
  const windows = hud ? [hud] : [];
  const messages = [];
  // GameManager.isGamePaused, as AddWindow raises it (:183-184) and
  // RemoveWindow lowers it (:203-214). It is a LATCH, not a fold: DFU
  // pauses for the window being pushed and does not unpause until the
  // stack is back to the HUD, which is why a non-pausing window laid
  // over a pausing one leaves the game paused.
  let gamePaused = false;

  const isHud = (w) => !!hud && w === hud;
  const top = () => (windows.length > 0 ? windows[windows.length - 1] : null);

  let lastTop = top();
  const publishTop = () => {
    const t = top();
    if (t === lastTop) return;
    lastTop = t;
    onTop?.(t);
  };

  /** AddWindow (:179-186). */
  function addWindow(win) {
    windows.push(win);
    win.onPush?.();
    if (pauseWhileOpen(win)) gamePaused = true;
  }

  /** RemoveWindow (:190-216). The HUD is never popped; the window that
   *  is uncovered gets OnReturn. */
  function removeWindow() {
    const oldWindow = top();
    if (oldWindow && !isHud(oldWindow)) {
      windows.pop();
      oldWindow.onPop?.();
      const t = top();
      if (t) t.onReturn?.();
    }
    // :201-215 - the two arms of DaggerfallUI.enableHUD. With a HUD in
    // the stack the game resumes once only the HUD is left; without
    // one, once the stack is empty.
    if (hud ? windows.length <= 1 : windows.length < 1) gamePaused = false;
  }

  /** ChangeWindow's `while (windows.Count > 0) RemoveWindow()`
   *  (:125-126). RemoveWindow refuses to pop the HUD, so DFU's own
   *  loop would spin for ever on a stack that has one - it is only
   *  ever reached with the HUD absent. The port takes the same law and
   *  stops when the pop stops moving, rather than hanging the frame. */
  function drain() {
    while (windows.length > 0) {
      const before = windows.length;
      removeWindow();
      if (windows.length === before) break;
    }
  }

  const api = {
    /** TopWindow (:54-57). */
    topWindow: top,
    /** WindowCount (:70-73) - `windows.Count-1`, the HUD not counted.
     *  A HUD-less stack has nothing to subtract. */
    windowCount: () => windows.length - (hud ? 1 : 0),
    /** MessageCount (:62-65). */
    messageCount: () => messages.length,
    /** The depth the port's hosts ask about: how many windows are on
     *  top of the HUD, i.e. whether a pop has somewhere to return to. */
    depth: () => windows.length - (hud ? 1 : 0),

    /** PushWindow (:79-91). */
    pushWindow(win) {
      if (!win) return false;
      addWindow(win);
      clearActions?.();
      publishTop();
      onWindowChange?.();
      return true;
    },

    /** PopWindow (:99-104). */
    popWindow() {
      removeWindow();
      publishTop();
      onWindowChange?.();
    },

    /** ContainsWindow (:114-117). */
    containsWindow(win) { return windows.indexOf(win) >= 0; },

    /** THE DRAW CHAIN. DaggerfallUI paints ONE window a frame -
     *  `uiManager.TopWindow.Draw()` (DaggerfallUI.cs:491) - and depth
     *  reaches the screen through DaggerfallPopupWindow.Draw
     *  (:77-86), which runs `previousWindow.Draw()` BEFORE its own
     *  `base.Draw()`. Every box DaggerfallUI.MessageBox opens is
     *  built on `uiManager.TopWindow` as its previousWindow (:1330,
     *  :1339), so the chain is exactly this stack and the window a
     *  box was pushed over is painted UNDER it.
     *
     *  The port's hosts hold the TOP in their own slot (that is what
     *  `onTop` mirrors) and paint it themselves, so this walks what
     *  the top COVERS, deepest first, and the host draws its slot
     *  after. The HUD is skipped - the hosts draw it outside the
     *  stack. A stack of depth 1 enumerates nothing, which is why
     *  every single-window host renders exactly as before.
     *
     *  No dim rides with it: `parentPanel.BackgroundColor =
     *  ScreenDimColor` is Color.clear (nativePanel.js's SCREEN_DIM),
     *  and the court boxes set it to (0,0,0,0) themselves
     *  (DaggerfallCourtWindow.cs:224). */
    eachCoveredWindow(fn) {
      for (let i = 0; i < windows.length - 1; i++) if (!isHud(windows[i])) fn(windows[i], i);
    },

    /** ChangeWindow (:123-131) - pop EVERYTHING, then add the one.
     *  This is what the port's dispatch sites have always done in a
     *  single assignment: a window handing control to its successor is
     *  DFU's `CloseWindow(); PushWindow(next);`, which nets to a
     *  replacement, not to depth. */
    changeWindow(win) {
      drain();
      if (win) addWindow(win);
      publishTop();
      onWindowChange?.();
    },

    /** ChangeWindow's first half alone (:125-126) - the teardown door.
     *  A host that drops its whole scene drops the stack with it.
     *
     *  `onDrop` is the port's own half of OnPop: the hosts' windows own
     *  uploaded textures and billboard batches, and uploadTexture
     *  memoizes for ever, so a scene teardown that just forgets the
     *  stack both leaks and leaves live cache keys behind. It runs on
     *  EVERY window the drain removes, not only the top. */
    clear(onDrop = null) {
      if (onDrop) for (let i = windows.length - 1; i >= 0; i--) if (!isHud(windows[i])) onDrop(windows[i]);
      drain();
      publishTop();
    },

    /** GameManager.IsPlayingGame's window half, inverted
     *  (GameManager.cs:926-942): the game is not being played while
     *  `isGamePaused` (:928-930), nor while the top window is a
     *  non-HUD window that pauses (:937-939). */
    paused() {
      if (gamePaused) return true;
      const t = top();
      return !!t && !isHud(t) && pauseWhileOpen(t);
    },

    /** PostMessage (:139-150) - the overflow arm CLEARS the queue,
     *  DFU's own TODO and not a bug to fix on this side. */
    postMessage(message) {
      if (messages.length >= MAX_MESSAGE_COUNT) messages.length = 0;
      messages.push(message);
    },
    /** GetMessage (:157-163) - empty string, never null. */
    getMessage() { return messages.length > 0 ? messages.shift() : ''; },
    /** PeekMessage (:168-174). */
    peekMessage() { return messages.length > 0 ? messages[0] : ''; },

    /**
     * THE PORT SEAM. Not a DFU member: DFU windows close themselves
     * through `CloseWindow()` -> `uiManager.PopWindow()`, so the stack
     * always hears about it. The port's hosts hold the top in a plain
     * closure variable that ~40 `onClose` callbacks and probe hooks
     * null directly (`if (interiorOverlay === win) interiorOverlay =
     * null`), and rewriting every one of them is exactly the blast
     * radius this module exists to avoid.
     *
     * So the host calls this once a frame with its live slot and the
     * stack catches up:
     *   - slot unchanged      -> nothing.
     *   - slot went empty     -> PopWindow, which uncovers the window
     *                            beneath and hands it back through
     *                            `onTop` (a rest resumes).
     *   - slot holds someone
     *     else                -> the host replaced its top by hand;
     *                            swap the top entry and leave the depth
     *                            alone (ChangeWindow's shape, applied
     *                            to one level).
     *
     * Returns true when the stack moved.
     */
    reconcile(live) {
      const t = top();
      if (live === t) return false;
      if (!live) {
        if (windows.length === 0) return false;
        api.popWindow();
        return true;
      }
      if (windows.length === 0 || isHud(t)) {
        addWindow(live);
        publishTop();
        onWindowChange?.();
        return true;
      }
      // Replace the top in place: the window beneath is still suspended
      // and still returns when this one closes.
      windows[windows.length - 1] = live;
      if (pauseWhileOpen(live)) gamePaused = true;
      lastTop = live;
      onWindowChange?.();
      return true;
    },
  };
  return api;
}

/** BuildParamDict (:222-240) - `?a=1?b=2` into a Map-like object.
 *  Empty segments are dropped (StringSplitOptions.RemoveEmptyEntries)
 *  and a segment that is not exactly one `=` pair is skipped. */
export function buildParamDict(message) {
  const dict = {};
  for (const part of String(message ?? '').split('?')) {
    if (part === '') continue;
    const parts = part.split('=');
    if (parts.length !== 2) continue;
    dict[parts[0].trim()] = parts[1].trim();
  }
  return dict;
}
