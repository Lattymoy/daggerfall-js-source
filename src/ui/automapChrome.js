// ROAD-C c2/S4: THE SHARED NATIVE CHROME of both automap windows -
// ONE module with TWO ACTION TABLES, and never an `if (exterior)`
// ladder inside it.
//
// The two DFU windows are the same panel of buttons at the SAME nine
// rects (DaggerfallAutomapWindow.cs:395-470 and
// DaggerfallExteriorAutomapWindow.cs:356-430 - compare them line for
// line) wired to DIFFERENT verbs. That is the whole shape: the rects,
// the press-hold machine, the guards and the tooltips are shared; the
// meaning of each rect is a table.
//
// PRESS-HOLD IS THE POINT. DFU's arrow, rotate and stair buttons do
// not act on click: OnMouseDown raises a flag, OnMouseUp clears it,
// and Update() polls every flag EVERY FRAME (:933-1010 /
// :755-836), so the verb runs once per frame for as long as the
// button is held - which is exactly why every speed in
// ui/automapCamera.js is per-SECOND. Only the grid, exit and compass
// act on a click.
//
// VERBS ARE NAMES, not functions. The table answers strings that match
// DFU's own method names, and the window binds them to
// ui/automapCamera.js. That keeps this module pure (it is testable
// with no camera, no renderer and no data) and keeps the citation
// legible: `ActionMoveRotationPivotAxisForward` is greppable in the
// C# and in the port at once.

import { pointToNative } from './nativePanel.js';

/** toolTipDelay (DaggerfallAutomapWindow.cs:22) - SECONDS. */
export const TOOL_TIP_DELAY = 1;

/** Unity's default double-click window; the panel's OnMouseDoubleClick
 *  is what the debug teleport click rides. */
export const DOUBLE_CLICK_TIME = 0.3;
export const DOUBLE_CLICK_SLOP = 2;   // native pixels

/**
 * Every rect on the native 320x200 screen, as DFU lays them out. The
 * two windows agree on ALL of these - eight 21x19 arrow/rotate/stair
 * buttons in a row at y=171, the 27x19 grid button before them and the
 * 28x19 exit button after, with one-pixel gaps at 191..192 and
 * 235..236 that are part of the art.
 */
export const CHROME_RECTS = Object.freeze({
  panel: Object.freeze({ x: 1, y: 1, w: 318, h: 169 }),        // dummyPanelAutomap (:358-360)
  microMap: Object.freeze({ x: 0, y: 52, w: 28, h: 28 }),      // dummyPanelOverlay (:383-385)
  compass: Object.freeze({ x: 3, y: 172, w: 76, h: 17 }),      // dummyPanelCompass (:473-475)
  grid: Object.freeze({ x: 78, y: 171, w: 27, h: 19 }),        // :396
  forward: Object.freeze({ x: 105, y: 171, w: 21, h: 19 }),    // :404
  backward: Object.freeze({ x: 126, y: 171, w: 21, h: 19 }),   // :412
  left: Object.freeze({ x: 149, y: 171, w: 21, h: 19 }),       // :421
  right: Object.freeze({ x: 170, y: 171, w: 21, h: 19 }),      // :429
  rotateLeft: Object.freeze({ x: 193, y: 171, w: 21, h: 19 }), // :437
  rotateRight: Object.freeze({ x: 214, y: 171, w: 21, h: 19 }),// :445
  upstairs: Object.freeze({ x: 237, y: 171, w: 21, h: 19 }),   // :453
  downstairs: Object.freeze({ x: 258, y: 171, w: 21, h: 19 }), // :461
  exit: Object.freeze({ x: 281, y: 171, w: 28, h: 19 }),       // :469
});

/** labelHoverText (:483-489): y=192, centred, MaxWidth 320,
 *  MaxCharacters 64, TextScale 1. */
export const HOVER_LABEL = Object.freeze({ y: 192, maxWidth: 320, maxCharacters: 64, centered: true });

/** The exterior window's caption strip and its three legend swatches,
 *  which are STRIP-LOCAL (DaggerfallExteriorAutomapWindow.cs:271-273,
 *  :468-474). */
export const CAPTION_STRIP = Object.freeze({ x: 0, y: 190, w: 320, h: 10 });
export const CAPTION_SWATCHES = Object.freeze({
  temple: Object.freeze({ x: 97, y: 2, w: 5, h: 5 }),
  shop: Object.freeze({ x: 141, y: 2, w: 5, h: 5 }),
  tavern: Object.freeze({ x: 183, y: 2, w: 5, h: 5 }),
});

/** The eight held buttons, in DFU's own Update() poll order. */
export const HOLD_BUTTONS = Object.freeze(['forward', 'backward', 'left', 'right', 'rotateLeft', 'rotateRight', 'upstairs', 'downstairs']);
/** The three click buttons. */
export const CLICK_BUTTONS = Object.freeze(['grid', 'exit', 'compass']);

/**
 * THE DUNGEON TABLE (DaggerfallAutomapWindow.cs).
 * Left is the plain verb, right is the alternate: the arrows move the
 * ROTATION PIVOT, the rotate buttons turn the CAMERA about itself, the
 * stairs move the SLICE, the grid resets the pivot and the compass
 * resets the whole view.
 */
export const DUNGEON_ACTIONS = Object.freeze({
  grid: Object.freeze({
    leftClick: 'ActionChangeAutomapGridMode',          // :1979
    rightClick: 'ActionResetRotationPivotAxis',        // :1988
    wheelUp: 'ActionIncreaseCameraFieldOfView',        // :1996
    wheelDown: 'ActionDecreaseCameraFieldOfView',      // :2004
  }),
  forward: Object.freeze({ leftHold: 'ActionMoveForward', rightHold: 'ActionMoveRotationPivotAxisForward' }),
  backward: Object.freeze({ leftHold: 'ActionMoveBackward', rightHold: 'ActionMoveRotationPivotAxisBackward' }),
  left: Object.freeze({ leftHold: 'ActionMoveLeft', rightHold: 'ActionMoveRotationPivotAxisLeft' }),
  right: Object.freeze({ leftHold: 'ActionMoveRight', rightHold: 'ActionMoveRotationPivotAxisRight' }),
  rotateLeft: Object.freeze({ leftHold: 'ActionRotateLeft', rightHold: 'ActionRotateCameraLeft' }),
  rotateRight: Object.freeze({ leftHold: 'ActionRotateRight', rightHold: 'ActionRotateCameraRight' }),
  upstairs: Object.freeze({ leftHold: 'ActionMoveUpstairs', rightHold: 'ActionIncreaseSliceLevel' }),
  downstairs: Object.freeze({ leftHold: 'ActionMoveDownstairs', rightHold: 'ActionDecreaseSliceLevel' }),
  exit: Object.freeze({ leftClick: 'ActionExit' }),
  compass: Object.freeze({ leftClick: 'ActionSwitchFocusToNextBeaconObject', rightClick: 'ActionResetView' }),
});

/**
 * THE EXTERIOR TABLE (DaggerfallExteriorAutomapWindow.cs). SAME RECTS,
 * different verbs: the arrows PAN and their right button JUMPS to a
 * location border, the rotate buttons turn about the camera or about
 * the player marker, the stairs ZOOM (ActionMoveUpstairs is literally
 * `ActionZoom(-zoomSpeed * dt)`, :1135-1140) and the grid cycles the
 * view mode - whose RIGHT click does nothing at all but play the
 * button sound (:1375-1381, verbatim).
 */
export const EXTERIOR_ACTIONS = Object.freeze({
  grid: Object.freeze({
    leftClick: 'ActionSwitchToNextExteriorAutomapViewMode',   // :1372
    rightClick: 'ActionClickSoundOnly',                       // :1380 - the sound IS the whole handler
  }),
  forward: Object.freeze({ leftHold: 'ActionMoveForward', rightHold: 'ActionMoveToNorthLocationBorder' }),
  backward: Object.freeze({ leftHold: 'ActionMoveBackward', rightHold: 'ActionMoveToSouthLocationBorder' }),
  left: Object.freeze({ leftHold: 'ActionMoveLeft', rightHold: 'ActionMoveToWestLocationBorder' }),
  right: Object.freeze({ leftHold: 'ActionMoveRight', rightHold: 'ActionMoveToEastLocationBorder' }),
  rotateLeft: Object.freeze({ leftHold: 'ActionRotateLeft', rightHold: 'ActionRotateAroundPlayerPosLeft' }),
  rotateRight: Object.freeze({ leftHold: 'ActionRotateRight', rightHold: 'ActionRotateAroundPlayerPosRight' }),
  upstairs: Object.freeze({ leftHold: 'ActionMoveUpstairs', rightHold: 'ActionApplyMaxZoom' }),
  downstairs: Object.freeze({ leftHold: 'ActionMoveDownstairs', rightHold: 'ActionApplyMinZoom' }),
  exit: Object.freeze({ leftClick: 'ActionExit' }),
  compass: Object.freeze({ leftClick: 'ActionFocusPlayerPosition', rightClick: 'ActionResetView' }),
});

/**
 * WHICH `alreadyIn` FLAG EACH DOWN CHECKS - and this is a DFU QUIRK,
 * not a tidy rule, present in BOTH windows identically. The arrow and
 * stair buttons' RIGHT-down checks `alreadyInRightMouseDown`, but the
 * two ROTATE buttons' right-down checks `alreadyInMouseDown` instead
 * (DaggerfallAutomapWindow.cs:2188, :2228 and the exterior's :1565,
 * :1605). The consequence is real and observable: right-holding
 * rotate-left blocks a LEFT hold on any other button, and it sets the
 * left flag when it takes. Ported verbatim - a future reviewer who
 * "fixes" this breaks parity.
 */
export const RIGHT_DOWN_GUARD = Object.freeze({
  forward: 'right', backward: 'right', left: 'right', right: 'right',
  rotateLeft: 'left', rotateRight: 'left',
  upstairs: 'right', downstairs: 'right',
});

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Which named rect a NATIVE point falls in, or null. Buttons win over
 *  the panel, which is what DFU's child-panel ordering does. */
export function hitChrome(nx, ny) {
  if (nx == null || ny == null || nx < 0 || ny < 0) return null;
  for (const name of [...CLICK_BUTTONS, ...HOLD_BUTTONS, 'microMap']) {
    if (inRect(CHROME_RECTS[name], nx, ny)) return name;
  }
  if (inRect(CHROME_RECTS.panel, nx, ny)) return 'panel';
  return null;
}

/** Screen pixels -> the named rect, through the nativePanel mapping. */
export function hitChromeAt(m, px, py) {
  const v = pointToNative(m, px, py);
  return v ? hitChrome(v[0], v[1]) : null;
}

/** The compass strip's heading, 0..1. DFU registers the automap CAMERA
 *  with the compass (Automap.cs CreateAutomapCamera registers
 *  `cameraAutomap` to the compass), so this reads the MAP camera's
 *  yaw and never the player's. */
export const compassHeading01 = (mapYawDeg) => (((mapYawDeg % 360) + 360) % 360) / 360;

const DOM_LEFT = 0;
const DOM_MIDDLE = 1;
const DOM_RIGHT = 2;
const sideOf = (button) => (button === DOM_RIGHT ? 'right' : button === DOM_MIDDLE ? 'middle' : 'left');

/**
 * The press-hold machine. Pure: no clock of its own (tick(dt) is the
 * clock), no camera, no renderer.
 *
 *   pointer(phase, nx, ny, button) -> { verbs, drag, doubleClick, sound }
 *   tick(dt)                       -> { verbs, tooltip }
 *
 * `verbs` from pointer() are the CLICK verbs (grid/exit/compass, which
 * fire on release over the same rect, as Unity's OnMouseClick does);
 * `verbs` from tick() are the HELD verbs, one entry per frame per held
 * button, in DFU's own Update() poll order.
 */
export class AutomapChrome {
  constructor(table) {
    this.table = table;
    this.held = { left: new Set(), right: new Set() };
    this.panelDrag = { left: false, right: false, middle: false };
    this.alreadyIn = { left: false, right: false, middle: false };
    this.suppressToolTip = new Set();
    this.hover = null;
    this.hoverT = 0;
    this.time = 0;
    this._pressed = null;      // { side, name } - the click candidate
    this._lastDown = null;     // { t, nx, ny, side } - double-click detection
    this._dragAt = null;       // last pointer position while a panel drag is live
  }

  /** inDragMode() (:151): any button held down ON THE RENDER PANEL. */
  inDragMode() { return this.panelDrag.left || this.panelDrag.right || this.panelDrag.middle; }

  /** Every hold flag cleared and every guard released - what a window
   *  must call when it loses the pointer (the browser has no
   *  "mouse left the window" guarantee, and a latched hold spins the
   *  map forever). */
  releaseAll() {
    this.held.left.clear();
    this.held.right.clear();
    this.panelDrag = { left: false, right: false, middle: false };
    this.alreadyIn = { left: false, right: false, middle: false };
    this.suppressToolTip.clear();
    this._pressed = null;
    this._dragAt = null;
  }

  pointer(phase, nx, ny, button = DOM_LEFT) {
    const side = sideOf(button);
    const name = hitChrome(nx, ny);
    const out = { verbs: [], drag: null, doubleClick: false, sound: false };

    if (phase === 'down') {
      if (name === 'panel') {
        // the render panel starts a DRAG - and a double click on it is
        // its own event (OnMouseDoubleClick, :375-377)
        const last = this._lastDown;
        if (last && last.side === side && this.time - last.t <= DOUBLE_CLICK_TIME
          && Math.abs(last.nx - nx) <= DOUBLE_CLICK_SLOP && Math.abs(last.ny - ny) <= DOUBLE_CLICK_SLOP) {
          out.doubleClick = true;
        }
        this._lastDown = { t: this.time, nx, ny, side };
        this.panelDrag[side] = true;
        this._dragAt = [nx, ny];
        return out;
      }
      if (!name) return out;
      const entry = this.table[name];
      if (!entry) return out;
      // every handler's first line: a live panel drag swallows the press
      if (this.inDragMode()) return out;
      if (CLICK_BUTTONS.includes(name)) {
        this._pressed = { side, name };
        return out;   // the verb fires on RELEASE (OnMouseClick)
      }
      // a hold button: the `alreadyIn` guard, on the flag DFU checks
      const guard = side === 'right' ? RIGHT_DOWN_GUARD[name] : 'left';
      if (this.alreadyIn[guard]) return out;
      this.alreadyIn[guard] = true;
      this.held[side].add(name);
      this.suppressToolTip.add(name);   // SuppressToolTip = true while held
      out.sound = true;                 // PlayOneShot(SoundClips.ButtonClick)
      return out;
    }

    if (phase === 'move') {
      if (name !== this.hover) this.hoverT = 0;   // MouseLeave restarts the delay
      this.hover = name;
      if (this.inDragMode() && this._dragAt) {
        const dx = nx - this._dragAt[0];
        const dy = ny - this._dragAt[1];
        this._dragAt = [nx, ny];
        const kind = this.panelDrag.left ? 'pan' : this.panelDrag.right ? 'rotate' : 'slice';
        out.drag = { kind, dx, dy };
      }
      return out;
    }

    // 'up'
    // DEPARTURE, deliberate and recorded: a release of a side ends
    // that side's panel drag WHEREVER it lands. DFU's
    // PanelAutomap_OnMouseUp is a component event, so releasing
    // outside the render panel leaves `leftMouseDownOnPanelAutomap`
    // set and the map keeps dragging - a real latch in the original.
    // The port routes `up` from the window for exactly this reason
    // (see the four hosts' listeners), and honouring it here is the
    // point: an unreleasable drag is worse than a one-frame
    // difference in where the drag ends.
    if (this.panelDrag[side]) { this.panelDrag[side] = false; this._dragAt = null; }
    if (this._pressed && this._pressed.side === side) {
      const { name: pressedName } = this._pressed;
      this._pressed = null;
      // Unity fires OnMouseClick only when the release lands on the
      // same component the press did.
      if (pressedName === name && !this.inDragMode()) {
        const entry = this.table[pressedName];
        const verb = side === 'right' ? entry?.rightClick : entry?.leftClick;
        if (verb) { out.verbs.push(verb); out.sound = true; }
      }
    }
    if (this.held[side].size) {
      for (const heldName of this.held[side]) {
        const guard = side === 'right' ? RIGHT_DOWN_GUARD[heldName] : 'left';
        this.alreadyIn[guard] = false;
        this.suppressToolTip.delete(heldName);
      }
      this.held[side].clear();
    }
    return out;
  }

  /** The wheel over a rect: only the DUNGEON grid button answers one
   *  (the exterior window registers no scroll handler on it at all). */
  wheel(nx, ny, dir) {
    if (this.inDragMode()) return null;
    const name = hitChrome(nx, ny);
    const entry = name ? this.table[name] : null;
    if (!entry) return null;
    return (dir < 0 ? entry.wheelUp : entry.wheelDown) ?? null;
  }

  /**
   * DFU's Update(): poll every down-flag and run its verb, once per
   * frame, in the order the C# writes them. Also advances the tooltip
   * clock - a tooltip shows after ToolTipDelay seconds of hover, and
   * never while its own button is held (SuppressToolTip).
   */
  tick(dt) {
    this.time += dt;
    const verbs = [];
    for (const name of HOLD_BUTTONS) {
      if (this.held.left.has(name)) {
        const v = this.table[name]?.leftHold;
        if (v) verbs.push(v);
      }
    }
    for (const name of HOLD_BUTTONS) {
      if (this.held.right.has(name)) {
        const v = this.table[name]?.rightHold;
        if (v) verbs.push(v);
      }
    }
    if (this.hover && !this.suppressToolTip.has(this.hover)) this.hoverT += dt;
    else this.hoverT = 0;
    const tooltip = this.hover && this.hoverT >= TOOL_TIP_DELAY && !this.suppressToolTip.has(this.hover)
      ? this.hover : null;
    return { verbs, tooltip };
  }
}
