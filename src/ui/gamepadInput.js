// GP1 - THE GAMEPAD POLLER (2026-09-11). The DOM half of the joystick
// layer: reads the browser's Gamepad API once a frame and speaks the
// desktop input language to the host, as ui/touch.js does for a
// finger - so no host learns a third vocabulary.
//
//   - BUTTONS are keys. Unity names them JoystickButton0..19 and DFU
//     binds any Action to one through the same dictionary as a
//     keyboard key (GetKey :1080-1085 over KeyCodeList, which
//     GetKeyCodeList :1573-1585 fills with them); the port's hosts
//     fill their held-keys Set from keydown's `e.code` and resolve BY
//     ACTION through the registry (ui/input.js held/actionOf), so a
//     button's edge is a synthetic KeyboardEvent whose code is the
//     Unity name, and rebinding Jump to JoystickButton0 in the
//     controls grid works with no host change at all.
//   - AXIS KEYS the same: every "JoystickAxisNButtonM" code the
//     registry binds is polled through GetAxisKey's law
//     (systems/gamepad.js axisKeyDown) and edged as a key.
//   - THE MOVEMENT STICK is FindInputAxisActions (:1872-1928): the four
//     move actions raised as keys - the code each is bound to, as the
//     touch stick presses them - and the analog throw handed to the
//     host's MoveAxes through `axes()`, the seam TI2 opened.
//   - THE CAMERA STICK is Update :525-540 + PlayerMouseLook :114-122:
//     degrees a second at JoystickLookSensitivity, paid into the host's
//     look hook in the hook's own units, so the LookFilter, the pitch
//     clamp, the invert and the pause gate are the mouse's.
//   - THE UI BUTTONS are GetMouseButton's OR (:1050-1063): LeftClick,
//     RightClick and MiddleClick are Mouse0/Mouse1/Mouse2 in the held
//     set (ActivateCenterObject, SwingWeapon and AutoRun by default -
//     and a swing's direction is the camera stick, through the attack
//     hook, as the swipe is on a phone); Back is the Escape action
//     (GetBackButtonDown :1065-1068), pressed only while a window is
//     up - in the world DFU's B does nothing unless bound.
//   - USING CONTROLLER (:1536-1546): a stick past the dead zone makes
//     the pad the live device, a mouse move takes it back; while it is
//     live the look filter never smooths below 0.5 (ApplySmoothing
//     :159-160).
//   - THE CONTROLLER CURSOR (GP3): UpdateControllerCursorPosition
//     (:1518-1570) and OnGUI (:556-573). While a window is up
//     (CursorVisible) and the pad is the live device, a 32x32 cursor
//     stands where the mouse last was, the MOVEMENT stick moves it at
//     JoystickCursorSensitivity * 900 px a second (raw axes, the
//     inversions applied, clamped to the screen), and the three click
//     actions land as pointer events AT ITS POINT - the way
//     BaseScreenComponent reads InputManager.MousePosition (:573) and
//     GetMouseButtonDown (:626-628). The events are synthetic
//     PointerEvents on the canvas, so every host's overlay seam takes
//     them as it takes a mouse; the OS cursor hides meanwhile
//     (Cursor.visible = false, :563).
//
// The pad is the FIRST connected one with the standard mapping. Every
// code this layer presses it releases when the pad goes, the setting
// turns off, or the layer is disposed - a held key with no hand on it
// is the disease the touch layer's `up()` guards against.
import { bindings } from './input.js';
import { getBinding, getAxisBinding, getAxisInversion, getJoystickUIBinding } from '../systems/inputActions.js';
import { unityAxes, unityButtons, axisNumber, axisKeyDown, axisKeyName, parseAxisKeyName, movementAxes, cameraAxes, controllerLookDegrees, cursorStep, controllerSettings, NUM_AXES, AXIS_KEY_BASE } from '../systems/gamepad.js';
import { getBinding as getBindingOf, isPadCode } from '../systems/inputActions.js';
// PADPLUS1: the Enhanced Plus controller layer - its layout, the crossbar, the menus, the prompts (ui/plusPad.js)
import {
  plusPadActive, ensurePlusPadLayout, plusToggleRun, crossbarInForce, crossbarApi, crossbarSlot, CROSSBAR_CODES, CROSSBAR_HOLD,
  LOOT_DPAD, plusDpadByCode, NEXT_MODE, plusStickSens, scaleStick, plusBindCapturing, lootPrompts, quickActApi, cycleTab, spatialStep, scrollAt, domTargetAt, domPointer, domHoverChange, interactiveAt, markHover, showPrompts, windowPrompts, activeTabStrip,
} from './plusPad.js';
import { GAUNTLET_POINT, GAUNTLET_PRESS } from './plusCursor.js';
import { overlayOpen } from './enhancedOverlays.js';   // PADPLUS2: the enhanced doors' registry - a DOM window is up
import { getInt, getBool } from '../systems/settings.js';
import { quickLootSelection, quickLootWheel } from '../systems/quickLoot.js';   // PADPLUS6: the loot plaque's list, on the d-pad   // PADPLUS2: the swing mode decides the stroke
import { lookScale } from './lookSettings.js';
import { getInteractionMode, nextInteractionMode, MODE_ACTIONS } from '../player/interactionMode.js';   // PADPLUS10: hold up = the next mode
import { setControllerLook } from '../player/lookFilter.js';
import { padFamilyOf, setPadFamily } from './padGlyphs.js';   // QS3: which family of button glyph the HUD's quickslot tags draw

/** PADPLUS1: the pad codes that are the WORLD's and stand down while a window is up under Plus (View and Menu
 *  keep theirs - they open and close windows). */
const MENU_BUTTONS = Object.freeze(['JoystickButton0', 'JoystickButton1', 'JoystickButton2', 'JoystickButton3', 'JoystickButton4', 'JoystickButton5',
  'JoystickButton8', 'JoystickButton9', 'JoystickAxis9Button0', 'JoystickAxis10Button0',
  'JoystickAxis7Button0', 'JoystickAxis7Button1', 'JoystickAxis6Button0', 'JoystickAxis6Button1']);
const DPAD_DOWN = 'JoystickAxis7Button1';
/** PADPLUS10: the registry action that selects an interaction mode ('grab' -> 'GrabMode'). */
const modeActionOf = (mode) => Object.keys(MODE_ACTIONS).find((a) => MODE_ACTIONS[a] === mode) ?? null;
/** PADPLUS9: how long a d-pad direction is held before it is its HOLD action (down: the travel map) rather than its tap. */
export const DPAD_HOLD_S = 0.45;
const DPAD_DIRS = Object.freeze([['JoystickAxis7Button0', 'up'], ['JoystickAxis7Button1', 'down'], ['JoystickAxis6Button1', 'left'], ['JoystickAxis6Button0', 'right']]);

/** PADPLUS4: ONE POINTER. With the pad in hand the page showed two - the gauntlet (a mouse pointer the page had not
 *  hidden: a pad-only player never grants the pointer lock) and the pad's own cursor. While the pad is the live
 *  device under Plus the root wears .plus-padhide and every mouse pointer on the page is none; a real mouse move
 *  makes the mouse the live device again and gives it back (GP1's UsingController). */
const PADHIDE_CSS = 'html.plus-padhide.plus-padhide, html.plus-padhide.plus-padhide *, html.plus-padhide.plus-padhide *::before, html.plus-padhide.plus-padhide *::after { cursor: none !important; }';
let padHidden = false;
function padHideMouse(on) {
  const d = globalThis.document;
  if (!d?.documentElement || padHidden === !!on) return;
  padHidden = !!on;
  if (on && !d.getElementById('plus-padhide-style') && d.head) {
    const st = d.createElement('style'); st.id = 'plus-padhide-style'; st.textContent = PADHIDE_CSS; d.head.append(st);
  }
  d.documentElement.classList.toggle('plus-padhide', padHidden);
}

/** The swing's drag, in the attack hook's pixels per second at a full stick. */
export const SWING_PX_PER_SEC = 800;

const MOUSE_CODE_OF_UI = Object.freeze({ LeftClick: 'Mouse0', RightClick: 'Mouse1', MiddleClick: 'Mouse2' });
/** The DOM button each UI click action is (MouseEvent.button: left 0, middle 1, right 2). */
const DOM_BUTTON_OF_UI = Object.freeze({ LeftClick: 0, MiddleClick: 1, RightClick: 2 });
/** controllerCursorWidth / Height (:138-139). */
export const CURSOR_SIZE = 32;
const CURSOR_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 2 L4 26 L10 20 L15 30 L19 28 L14 18 L22 18 Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>');

function defaultMakeEvent(type, init) {
  const Ctor = type.startsWith('pointer') && typeof globalThis.PointerEvent === 'function' ? globalThis.PointerEvent : globalThis.MouseEvent;
  return new Ctor(type, init);
}

function synth(type, code) {
  // PAD1: ON THE DOCUMENT, not the window. An event dispatched at the
  // window has a path of one - the window - so a listener on the
  // document never sees it, capture or not; one dispatched at the
  // document reaches the document's listeners and then bubbles to the
  // window's. The hosts listen on the window and saw every button; the
  // enhanced controls pane's capture listens on the document (a capture
  // listener, so it beats the hosts' ladders) and could never bind one.
  // A node harness without a document takes the window.
  (globalThis.document ?? window).dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}

/** Is there a Gamepad API to poll. */
export function hasGamepadApi() {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
}

/** The first connected standard-mapping pad; a blank-mapping pad only if
 *  no standard one is present - so a non-gamepad HID device that also
 *  reports itself with an empty mapping (e.g. some headsets/media-key
 *  devices) never shadows a real, later-enumerated standard pad. */
export function pickPad(list) {
  let fallback = null;
  for (const p of list ?? []) {
    if (!p || p.connected === false) continue;
    if (p.mapping === 'standard') return p;
    if (p.mapping === '' && !fallback) fallback = p;
  }
  return fallback;
}

/**
 * @param canvas the host's canvas (unused beyond identity; the pad has no element)
 * @param hooks { look(dx, dy), attack(dx, dy, held), overlayActive() }
 *   - the same object the host hands attachTouch
 * @returns { tick(dt), axes(), usingController(), dispose() } or null without the API
 */
export function attachGamepad(canvas, hooks = {}, { getPads = null, dispatch = synth, makeEvent = defaultMakeEvent } = {}) {
  if (!getPads && !hasGamepadApi()) return null;
  getPads ??= () => navigator.getGamepads();
  const axes = new Float32Array(NUM_AXES + 1);
  const buttons = new Set();
  const held = new Set();        // every code this layer is pressing
  let analog = null;             // the movement stick's throw for MoveAxes
  let usingController = false;
  let mouseMoved = false;
  let swinging = false;
  let lastMouse = null;          // Input.mousePosition, the port's last real mouse point (client px)
  let cursor = null;             // controllerCursorPosition, client px
  const cursorHeld = {};         // the UI click actions down at the cursor
  let cursorEl = null;
  // PADPLUS1: the Plus layer's own state - the run latch, the crossbar's held buttons, the menu buttons' last frame,
  // the DOM element the cursor pressed on and the one it is over
  const P = { layout: false, runLatch: false, runPrev: false, runIdle: 0, lbPrev: false, rbPrev: false, setOrder: 0,
    stale: new Set(), lastOverlay: false, lootUp: false, lootRep: {}, xbSet: null, xbHeld: new Set(), xbPrev: new Set(), menuPrev: new Set(), dh: {}, padMap: null, padMapCode: null, padMapSeen: false, padMapAge: 0, scroll: 0, domOver: null, promptAt: 0, tabs: false, plusCursor: null };
  let paneCapturing = () => false;   // the controls pane's capture (ui/enhancedControls.js captureArmed), loaded lazily - no import ring
  import('./enhancedControls.js').then((m) => { if (typeof m.captureArmed === 'function') paneCapturing = m.captureArmed; }).catch(() => {});
  const capturing = () => paneCapturing() || plusBindCapturing();   // PADPLUS10: and the Plus bindings window's
  const onMouseMove = (e) => {
    if (e.isTrusted === false) return;   // the cursor's own synthetic moves are not a hand on the mouse
    if (e.movementX || e.movementY) mouseMoved = true;
    if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) lastMouse = [e.clientX, e.clientY];
  };
  window.addEventListener('mousemove', onMouseMove);
  const cursorShow = (on) => {
    if (canvas?.style) canvas.style.cursor = on ? 'none' : '';   // Cursor.visible = false (:563)
    if (typeof document === 'undefined' || !document.body) return;
    if (on && !cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.style.cssText = `position:fixed;left:0;top:0;width:${CURSOR_SIZE}px;height:${CURSOR_SIZE}px;pointer-events:none;z-index:6;background:url("${CURSOR_SVG}") no-repeat;display:none`;
      document.body.appendChild(cursorEl);
    }
    if (!cursorEl) return;
    // PADPLUS1: under Plus the cursor is the gauntlet and stands above every window (it stood at z-index 6, under
    // the enhanced windows it was meant to point at)
    const plusNow = on && plusPadActive();
    if (P.plusCursor !== plusNow) {
      P.plusCursor = plusNow;
      cursorEl.style.zIndex = plusNow ? '2147483001' : '6';
      cursorEl.style.width = plusNow ? '31px' : `${CURSOR_SIZE}px`;
      cursorEl.style.height = plusNow ? '34px' : `${CURSOR_SIZE}px`;
      cursorEl.style.backgroundImage = `url("${plusNow ? GAUNTLET_POINT : CURSOR_SVG}")`;
    }
    if (plusNow) {
      const pressed = Object.values(cursorHeld).some(Boolean);
      const want = `url("${pressed ? GAUNTLET_PRESS : GAUNTLET_POINT}")`;
      if (cursorEl.style.backgroundImage !== want) cursorEl.style.backgroundImage = want;
    }
    cursorEl.style.display = on ? 'block' : 'none';
    if (on && cursor) { cursorEl.style.left = `${cursor[0]}px`; cursorEl.style.top = `${cursor[1]}px`; }
  };
  const domDown = {};   // PADPLUS1: the DOM element each button went down on
  const pointerAt = (type, button) => {
    if (!cursor) return;
    // PADPLUS1: UNDER PLUS THE CURSOR CLICKS THE PAGE. The enhanced windows are DOM above the canvas, and an event
    // dispatched at the canvas never reaches them - the pad could open a window and not press one button in it.
    // Over a DOM element the events go to it, as a mouse's would; over the canvas (a classic window) they stay there.
    if (plusPadActive()) {
      const t = domTargetAt(cursor[0], cursor[1], canvas);
      const phase = type === 'pointerdown' ? 'down' : type === 'pointerup' ? 'up' : 'move';
      if (phase === 'move') {
        if (t !== P.domOver) { domHoverChange(P.domOver, t, { x: cursor[0], y: cursor[1], makeEvent }); P.domOver = t; }
        markHover(t ? interactiveAt(cursor[0], cursor[1]) : null);
      }
      if (phase === 'down') domDown[button] = t;
      const at = phase === 'up' ? (t ?? domDown[button]) : t;
      if (phase === 'up') domDown[button] = null;
      if (at) { domPointer(at, phase, { x: cursor[0], y: cursor[1], button, makeEvent }); return; }
    }
    canvas.dispatchEvent(makeEvent(type, { clientX: cursor[0], clientY: cursor[1], button, buttons: type === 'pointerup' ? 0 : (button === 0 ? 1 : button === 2 ? 2 : 4), pointerType: 'mouse', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
  };
  const cursorRelease = () => {
    for (const ui of Object.keys(cursorHeld)) if (cursorHeld[ui]) { cursorHeld[ui] = false; pointerAt('pointerup', DOM_BUTTON_OF_UI[ui]); }
  };

  const press = (code) => { if (!held.has(code)) { held.add(code); dispatch('keydown', code); } };
  const releaseAll = (keep = null) => {
    for (const code of [...held]) if (!keep?.has(code)) { held.delete(code); dispatch('keyup', code); }
  };
  const codeOf = (store, action) => getBinding(store, action) ?? getBinding(store, action, false);
  // PADPLUS1: a pad code down - a button, or an axis key past its half (RT as the RightClick UI button under Plus)
  const padDownIn = (axesNow, code) => !!code && (buttons.has(code) || (code.startsWith('JoystickAxis') && axisKeyDown(axesNow, parseAxisKeyName(code) ?? -1)));

  /**
   * PADPLUS1: ONE FRAME OF THE PLUS LAYER, between the codes the frame wants and the edges it presses.
   *  - RUN IS A TOGGLE: the Run row's button flips a latch that holds Run's code; letting the stick rest half a
   *    second (or a window opening) lets go, so a sprint never outlives the walk it started.
   *  - THE CROSSBAR: while it is in force (the hotbar says so) LB and RB are its and only its; with one held, a NEW
   *    press of a face button or a d-pad direction presses that set's slot, and that button is swallowed until it is
   *    let go - so A under LB never also activates, and letting LB go first does not leak a jump.
   *  - IN A WINDOW: the world's pad codes stand down (B would open the pack UNDER the pack it is closing), LB/RB turn
   *    the tab strip, the d-pad jumps the cursor to the next control, Y is the right-click (Options), the right
   *    stick scrolls. Not while the controls pane is capturing a button - that press is the binding.
   */
  function plusFrame({ b, wanted, overlay, dt, padDown, moving, axes: ax }) {
    const swallowed = new Set();
    const dpad = plusDpadByCode();   // PADPLUS10: the player's d-pad (tap and hold per direction)
    // PADPLUS10: one d-pad action - its registry key pressed; NextMode presses the key of the mode after the current one
    const fireDpad = (action, code) => {
      if (!action) return;
      const name = action === NEXT_MODE ? modeActionOf(nextInteractionMode(getInteractionMode())) : action;
      const c = name ? codeOf(b, name) : null;
      if (!c) return;
      wanted.add(c);
      if (action === 'AutoMap' || action === 'TravelMap') { P.padMap = action; P.padMapCode = code; P.padMapSeen = false; P.padMapAge = 0; }
    };
    // run toggle
    const runCode = getBindingOf(b, 'Run', false);
    if (plusToggleRun() && runCode && isPadCode(runCode)) {
      const d = padDown(runCode);
      if (d && !P.runPrev && !overlay) { P.runLatch = !P.runLatch; P.runIdle = 0; }
      P.runPrev = d;
      P.runIdle = moving ? 0 : P.runIdle + dt;
      if (overlay || P.runIdle > 0.5) P.runLatch = false;
      wanted.delete(runCode);
      if (P.runLatch) wanted.add(runCode);
    } else P.runLatch = false;
    // the crossbar
    const lb = buttons.has(CROSSBAR_HOLD[0]), rb = buttons.has(CROSSBAR_HOLD[1]);
    if (lb && !P.lbPrev) P.setOrder = 0;
    if (rb && !P.rbPrev) P.setOrder = 1;
    P.lbPrev = lb; P.rbPrev = rb;
    const xbOn = !overlay && crossbarInForce();
    // PADPLUS6: LOOKING AT LOOT, THE D-PAD IS THE PLAQUE'S. The quick-loot plaque's list moves on the mouse wheel,
    // and a pad has none; up and down move its highlight now (held, they repeat), right takes everything, left opens
    // the container - and none of the four reaches the bare d-pad's own actions (map, log, rest, swap hands) or a
    // quickslot while a list is in front of you. A bumper held is still the crossbar's.
    const lootUp = !overlay && !lb && !rb && lootListed();
    P.lootUp = lootUp;
    const set = !xbOn ? null : lb && rb ? P.setOrder : lb ? 0 : rb ? 1 : null;
    const downNow = new Set();
    for (const code of CROSSBAR_CODES) if (padDown(code)) downNow.add(code);
    if (xbOn) {
      for (const c of CROSSBAR_HOLD) wanted.delete(c);
      for (const code of CROSSBAR_CODES) {
        if (!downNow.has(code)) { P.xbHeld.delete(code); continue; }
        if (set !== null && !P.xbPrev.has(code)) { P.xbHeld.add(code); crossbarApi()?.press?.(crossbarSlot(set, code)); }
        if (P.xbHeld.has(code)) { swallowed.add(code); wanted.delete(code); continue; }
        // PADPLUS3: the bare d-pad never reaches a slot - it is its own actions, one press each
        const bare = dpad[code];
        if (bare && !lootUp) {
          wanted.delete(code); swallowed.add(code);
          // PADPLUS10: a direction with a HOLD fires its tap on the release (below); one without fires on the press
          if (bare.hold) continue;
          if (set === null && !P.xbPrev.has(code)) fireDpad(bare.tap, code);
        }
      }
      // PADPLUS9/PADPLUS10: TAP OR HOLD, every direction that has a hold - down: map / travel map, left: quest log /
      // transport, up: swap hands / next interaction mode. The hold fires ONCE, the moment it has been held long
      // enough; letting go before that is the tap. Each new hold of up is one more step through the modes.
      for (const [code, act] of Object.entries(dpad)) {
        const st = P.dh[code] ??= { t: -1, fired: false };
        if (!act.hold) { st.t = -1; continue; }
        const now = downNow.has(code);
        if (now && !P.xbPrev.has(code)) { st.t = set === null && !lootUp ? 0 : -1; st.fired = false; }
        if (st.t >= 0 && (set !== null || lootUp)) st.t = -1;   // a bumper or a loot plaque took the press
        if (st.t < 0) continue;
        if (now) {
          st.t += dt;
          if (!st.fired && st.t >= DPAD_HOLD_S) { st.fired = true; fireDpad(act.hold, code); }
        } else {
          if (!st.fired) fireDpad(act.tap, code);
          st.t = -1;
        }
      }
    } else { P.xbHeld.clear(); if (!overlay) for (const st of Object.values(P.dh)) st.t = -1; }
    if (lootUp) {
      for (const [code, act] of Object.entries(LOOT_DPAD)) {
        wanted.delete(code); swallowed.add(code);
        const down = downNow.has(code), fresh = down && !P.xbPrev.has(code);
        if (act === 'up' || act === 'down') {
          if (!down) { P.lootRep[code] = 0; continue; }
          P.lootRep[code] = fresh ? 0.35 : (P.lootRep[code] ?? 0) - dt;
          if (fresh || P.lootRep[code] <= 0) { if (!fresh) P.lootRep[code] = 0.12; quickLootWheel(act === 'up' ? -1 : 1); }
        } else if (fresh) { const c = codeOf(b, act); if (c) wanted.add(c); }
      }
    }
    P.xbPrev = downNow;
    if (P.xbSet !== set) { P.xbSet = set; crossbarApi()?.setActive?.(set); }
    // the windows
    if (overlay && !capturing()) {
      const menuDown = new Set();
      for (const c of MENU_BUTTONS) if (padDown(c)) menuDown.add(c);
      const edge = (c) => menuDown.has(c) && !P.menuPrev.has(c);
      for (const c of MENU_BUTTONS) { wanted.delete(c); if (c !== 'JoystickButton0' && c !== 'JoystickButton1' && c !== 'JoystickAxis10Button0') swallowed.add(c); }
      if (edge('JoystickButton4')) cycleTab(-1);
      if (edge('JoystickButton5')) cycleTab(1);
      // PADPLUS9: THE MAP THE D-PAD OPENED, THE D-PAD CLOSES - down again is Back (the automap closes on Escape as on
      // its own key). Only the automap: the travel map has buttons below buttons, and down is how the cursor
      // reaches them (B closes it). The press that opened a window is stale until let go, so it never closes it too.
      let closeMap = false;
      if (P.padMap) P.padMapSeen = true;
      const mapCode = P.padMapCode ?? DPAD_DOWN;
      if (P.padMap === 'AutoMap' && edge(mapCode) && !P.stale.has(mapCode)) {
        const c = codeOf(b, 'Escape'); if (c) { wanted.add(c); closeMap = true; }
        P.padMap = null;
      }
      if (cursor) {
        for (const [c, dir] of DPAD_DIRS) {
          if (!edge(c) || (closeMap && c === mapCode)) continue;
          const to = spatialStep(cursor, dir);
          if (to) { cursor[0] = to[0]; cursor[1] = to[1]; usingController = true; pointerAt('pointermove', 0); cursorShow(true); }
        }
        if (edge('JoystickButton3')) { pointerAt('pointerdown', 2); pointerAt('pointerup', 2); }
        // PADPLUS5: X is the quick act on the item under the cursor - wear, take off, light, use
        if (edge('JoystickButton2')) { try { quickActApi()?.act?.(globalThis.document?.elementFromPoint?.(cursor[0], cursor[1]) ?? null); } catch (e) { console.warn('[gamepad] quick act:', e?.message ?? e); } }
        // the right stick: its vertical, as a wheel (Axis5 is up-positive)
        const rv = ax[5] ?? 0;
        if (Math.abs(rv) > 0.25) {
          P.scroll += -rv * 900 * dt * plusStickSens('right');   // PADPLUS10: the right stick's sensitivity
          const step = Math.trunc(P.scroll);
          if (step) { P.scroll -= step; scrollAt(cursor[0], cursor[1], step); }
        } else P.scroll = 0;
      }
      P.menuPrev = menuDown;
    } else {
      P.menuPrev.clear();
      // PADPLUS9: the map the d-pad opened is forgotten once it has closed (by B, by down, by its key), or if no
      // window came up for it within a second - so a later window's down is never taken for the map's close
      if (P.padMap) { P.padMapAge += dt; if (P.padMapSeen || P.padMapAge > 1) { P.padMap = null; P.padMapSeen = false; } }
    }
    return swallowed;
  }

  // PADPLUS2: a full-screen enhanced door on the page (#enhanced-inventory, #enhanced-pause, ...), looked for five
  // times a second - the doors' hosts are fixed, inset 0, direct children of the body
  let domUp = false, domAt = 0;
  /** PADPLUS6: is the quick-loot plaque listing rows right now (a corpse, a chest, a player's verbs). */
  const lootListed = () => { try { return quickLootSelection() != null; } catch { return false; } };
  const domWindowUp = (dt) => {
    domAt -= dt;
    if (domAt > 0) return domUp;
    domAt = 0.2;
    domUp = false;
    const body = globalThis.document?.body;
    if (!body?.children) return false;
    for (const n of body.children) {
      if (!n.id?.startsWith?.('enhanced-') || !n.getClientRects?.().length) continue;
      const cs = globalThis.getComputedStyle?.(n);
      // PADPLUS4: a WINDOW takes the pointer. The damage numbers' layer (#enhanced-hitnums, born on the first blow and
      // never taken down) is full-screen and fixed too, but click-through - it read as a window from the first swing
      // on, and the prompt bar and the cursor came up over the world
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none')) continue;
      domUp = true; break;
    }
    return domUp;
  };

  /**
   * PADPLUS2: RT ATTACKS AND THE CAMERA STAYS YOURS (the report: "while hold rt to attack i cant look around").
   * PAD1 made the attack button the mouse's drag button: while it was held the right stick drew the swing and the
   * look stopped - and the host drops an owed look for the length of a held gesture swing (lookFilter.settle).
   * Under Plus the right stick never stops looking. The swing is a short STROKE the layer draws itself, in the
   * direction the LEFT stick leans (forward = thrust, sideways = slash, back = chop) or alternating slashes with it
   * at rest, re-drawn every SWING_REPEAT while RT stays down:
   *  - Gesture swing mode (the default) without bow drawback: each stroke is a one-frame press - held on the frame
   *    the rig reads it, let go on the next - so the look is dropped for one frame, never for the hold.
   *  - Click / Click-or-Hold modes, or bow drawback on: RT is simply held (the rig swings on the press, a bow draws
   *    and looses on the release), and those modes do not stop the look.
   */
  const SWING_REPEAT = 0.4, STROKE_PX = 60;
  let swingT = 0, swingAlt = false, pulsed = false;
  function plusSwing(down, left, dt) {
    const gesture = getInt('Controls', 'WeaponSwingMode', 0, 2) === 0 && !getBool('Controls', 'BowDrawback');
    if (pulsed) { pulsed = false; hooks.attack?.(0, 0, false); }
    if (!down) {
      if (swinging) { swinging = false; if (!gesture) hooks.attack?.(0, 0, false); }
      swingT = 0;
      return;
    }
    const first = !swinging;
    swinging = true;
    swingT -= dt;
    if (!first && swingT > 0) return;
    swingT = SWING_REPEAT;
    let dx, dy;
    if (Math.hypot(left.h, left.v) > 0.5) { const m = Math.hypot(left.h, left.v); dx = (left.h / m) * STROKE_PX; dy = (-left.v / m) * STROKE_PX; }
    else { swingAlt = !swingAlt; dx = swingAlt ? STROKE_PX : -STROKE_PX; dy = STROKE_PX * 0.3; }
    if (gesture) { hooks.attack?.(dx, dy, true); pulsed = true; }
    else if (first) hooks.attack?.(dx, dy, true);
  }

  function tick(dt) {
    const plus = plusPadActive();
    padHideMouse(plus && usingController);   // PADPLUS4: the pad in hand hides the mouse's pointer, in the world too
    const s = controllerSettings();
    const pad = s.enabled ? pickPad(getPads()) : null;
    if (!pad) {
      analog = null;
      if (swinging) { swinging = false; hooks.attack?.(0, 0, false); }
      if (usingController) { usingController = false; setControllerLook(false); }
      setPadFamily(null);   // QS3: a glyph for a pad nobody is holding is a lie
      cursorRelease(); cursorShow(false);
      P.runLatch = false; P.xbHeld.clear(); P.xbPrev.clear(); P.menuPrev.clear();
      if (P.xbSet !== null) { P.xbSet = null; crossbarApi()?.setActive?.(null); }
      showPrompts(null); markHover(null);
      releaseAll();
      mouseMoved = false;
      return;
    }
    unityAxes(pad, axes);
    unityButtons(pad, buttons);
    const b = bindings();
    if (plus && !P.layout) { P.layout = true; try { ensurePlusPadLayout(b); } catch (e) { console.warn('[gamepad] Plus layout:', e?.message ?? e); } }
    const padDown = (code) => padDownIn(axes, code) && !(plus && P.stale.has(code));   // PADPLUS3: a stale button is up
    const wanted = new Set(buttons);
    // axis keys: all thirty-two, polled (GetAxisKey) - GetAnyKeyDown
    // walks every one of them (KeyCodeList :1573-1587), which is how
    // the joystick window's capture sees a stick move (GP2)
    for (let key = AXIS_KEY_BASE; key < AXIS_KEY_BASE + NUM_AXES * 2; key++) if (axisKeyDown(axes, key)) wanted.add(axisKeyName(key));
    // the movement stick (FindInputAxisActions)
    const mh = axisNumber(getAxisBinding(b, 'MovementHorizontal')), mvn = axisNumber(getAxisBinding(b, 'MovementVertical'));
    let moved = false;
    // PADPLUS2: UNDER PLUS, A WINDOW IS ANY WINDOW. The hosts' `overlayActive` is the TOWN's slot alone - in the
    // world host a dungeon's or a building's windows live on their own stacks (modes.overlayHeld), so with one of
    // them up the pad still thought it was walking: no cursor, no clicks, B opening the pack under the pack. The
    // host's own `paused` gate (the one the finger and the mouse arms read) carries those stacks, and the enhanced
    // doors' registry and their full-screen hosts are the last word for a DOM window that is in none of them.
    const overlay = !!hooks.overlayActive?.() || (plus && (!!hooks.paused?.() || overlayOpen() || domWindowUp(dt)));
    // PADPLUS3: A BUTTON HELD ACROSS A WINDOW'S EDGE IS STALE UNTIL IT IS LET GO (the report: "i cant close the
    // inventory reliably with b ... it opens back again"). B opens the pack in the world and is Back in a window, so
    // the press that opened it was read as Back on the next frame, and the press that closed it as Inventory on the
    // frame after - the same thumb, two meanings, both firing. Whatever is down the frame a window opens or closes
    // does nothing more until it comes up; the next press means what the new state says.
    if (plus) {
      const downAll = new Set(buttons);
      for (let key = AXIS_KEY_BASE; key < AXIS_KEY_BASE + NUM_AXES * 2; key++) if (axisKeyDown(axes, key)) downAll.add(axisKeyName(key));
      if (overlay !== P.lastOverlay) { P.lastOverlay = overlay; P.stale = downAll; }
      else for (const c of [...P.stale]) if (!downAll.has(c)) P.stale.delete(c);
      for (const c of P.stale) wanted.delete(c);
    }
    // FindInputAxisActions never runs under a pause (Update :488-500
    // returns first): no move codes, no throw, while a window is up -
    // and so the joystick window's capture never takes 'KeyW' for a stick
    if (mh && mvn && !overlay) {
      // PADPLUS10: the left stick's sensitivity - past the dead zone the lean is scaled, so a gentler thumb reaches a full run
      let [lh, lv] = [axes[mh], axes[mvn]];
      if (plus && Math.hypot(lh, lv) > s.deadzone) [lh, lv] = scaleStick(lh, lv, plusStickSens('left'));
      const m = movementAxes(lh, lv, { deadzone: s.deadzone, threshold: s.threshold, invertH: getAxisInversion(b, 'MovementHorizontal'), invertV: getAxisInversion(b, 'MovementVertical') });
      if (m) {
        for (const a of m.actions) { const c = codeOf(b, a); if (c) wanted.add(c); }
        analog = { x: m.x, y: m.y };
        moved = true;
      } else analog = null;
    } else analog = null;
    // the camera stick (Update :525-540, PlayerMouseLook :114-122)
    const ch = axisNumber(getAxisBinding(b, 'CameraHorizontal')), cv = axisNumber(getAxisBinding(b, 'CameraVertical'));
    let look = { x: 0, y: 0 };
    if (ch && cv) {
      look = cameraAxes(axes[ch], axes[cv], { deadzone: s.deadzone, invertH: getAxisInversion(b, 'CameraHorizontal'), invertV: getAxisInversion(b, 'CameraVertical') });
      if (look.x || look.y) moved = true;
    }
    // UsingController (:1536-1546): a stick makes the pad live, the mouse
    // takes it back - the movement stick counts here even under a window
    // (distMovement > JoystickDeadzone, :1531, :1540), where the move arm
    // above did not run; and the cursor is born where the mouse last was
    if (mh && mvn && Math.hypot(axes[mh], axes[mvn]) > s.deadzone) moved = true;
    const wasUsing = usingController;
    if (mouseMoved) usingController = false;
    else if (moved) usingController = true;
    if (usingController && !wasUsing) {
      const r = canvas?.getBoundingClientRect?.();
      cursor = lastMouse ? [lastMouse[0], lastMouse[1]] : r ? [r.left + r.width / 2, r.top + r.height / 2] : [0, 0];
    }
    mouseMoved = false;
    setControllerLook(usingController);
    setPadFamily(padFamilyOf(pad.id));   // QS3: Xbox or PlayStation, off the pad's own id
    // PADPLUS1: the Plus layer - the run toggle and the crossbar in the world, the tabs, the jumps, the scroll and
    // the Options press in a window. `swallowed` are buttons it took: no key, no click for them this frame.
    const swallowed = plus ? plusFrame({ b, wanted, overlay, dt, padDown, moving: !!analog, axes, s }) : null;
    // PADPLUS10: while the bindings window waits for a button, a press is only its own code - no Back, no click
    const binding = plus && plusBindCapturing();
    const uiDown = (code) => !binding && padDown(code) && !swallowed?.has(code);
    // the UI buttons as the mouse's (GetMouseButton :1050-1063) and Back as Escape (:1065-1068)
    for (const [ui, mouse] of Object.entries(MOUSE_CODE_OF_UI)) {
      const code = getJoystickUIBinding(b, ui);
      if (code && uiDown(code)) wanted.add(mouse);
    }
    const back = getJoystickUIBinding(b, 'Back');
    if (back && uiDown(back) && overlay) { const c = codeOf(b, 'Escape'); if (c) wanted.add(c); }
    // edges: presses first, then the releases of what is no longer wanted
    for (const code of wanted) press(code);
    releaseAll(wanted);
    // THE CONTROLLER CURSOR (GP3): CursorVisible is a window up
    if (overlay && usingController && cursor) {
      let h = mh ? axes[mh] : 0, v = mvn ? axes[mvn] : 0;   // GetAxisRaw (:1526-1527)
      if (getAxisInversion(b, 'MovementHorizontal')) h = -h;
      if (getAxisInversion(b, 'MovementVertical')) v = -v;
      if (Math.hypot(h, v) > s.deadzone) {
        const st = cursorStep(h, v, dt, s.cursorSensitivity * (plus ? plusStickSens('left') : 1));   // PADPLUS10: and the cursor's speed
        // PADPLUS1: a little friction over a control, so a thumb can stop on a button rather than sail past it
        if (plus && P.domOver && interactiveAt(cursor[0], cursor[1])) { st.dx *= 0.55; st.dy *= 0.55; }
        const r = canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0, width: Infinity, height: Infinity };
        cursor[0] = Math.min(r.left + r.width, Math.max(r.left, cursor[0] + st.dx));
        cursor[1] = Math.min(r.top + r.height, Math.max(r.top, cursor[1] - st.dy));   // Unity's y is up (:1568)
        pointerAt('pointermove', 0);
      }
      for (const [ui, button] of Object.entries(DOM_BUTTON_OF_UI)) {
        const code = getJoystickUIBinding(b, ui);
        const down = !!code && uiDown(code);
        if (down && !cursorHeld[ui]) { cursorHeld[ui] = true; pointerAt('pointerdown', button); }
        else if (!down && cursorHeld[ui]) { cursorHeld[ui] = false; pointerAt('pointerup', button); }
      }
      cursorShow(true);
    } else { cursorRelease(); cursorShow(false); if (plus) markHover(null); }
    // PADPLUS1: the prompt bar - a window up under the live pad; the strip's tabs are looked for four times a second
    if (plus && overlay && usingController) {
      P.promptAt -= dt;
      if (P.promptAt <= 0) { P.promptAt = 0.25; P.tabs = !!activeTabStrip(); P.quick = !!quickActApi()?.available?.(); }
      showPrompts(windowPrompts({ tabs: P.tabs, quick: P.quick, uiBack: getJoystickUIBinding(b, 'Back') ?? 'JoystickButton1', uiClick: getJoystickUIBinding(b, 'LeftClick') ?? 'JoystickButton0' }), padFamilyOf(pad.id));
    } else if (plus && P.lootUp && usingController) showPrompts(lootPrompts({ take: getJoystickUIBinding(b, 'LeftClick') ?? 'JoystickButton0' }), padFamilyOf(pad.id));   // PADPLUS6
    else showPrompts(null);
    // the swing: RightClick's button held is the drag's button held -
    // its edges first, so the frame the button lifts is a look again
    const swingBtn = getJoystickUIBinding(b, 'RightClick');
    const swingNow = !!swingBtn && uiDown(swingBtn) && !overlay;
    if (plus) plusSwing(swingNow, { h: mh ? axes[mh] : 0, v: mvn ? axes[mvn] : 0 }, dt);
    else if (swingNow && !swinging) { swinging = true; hooks.attack?.(0, 0, true); }
    else if (!swingNow && swinging) { swinging = false; hooks.attack?.(0, 0, false); }
    // the look, in the hook's units (the host multiplies by lookScale())
    // - or, while the swing's button is down, the drag's direction
    if ((look.x || look.y) && !overlay && hooks.look) {
      const toUnits = (deg) => ((deg * Math.PI) / 180) / lookScale();
      const lookSens = s.lookSensitivity * (plus ? plusStickSens('right') : 1);   // PADPLUS10: the right stick's sensitivity
      const dx = toUnits(controllerLookDegrees(look.x, dt, lookSens));
      const dy = toUnits(controllerLookDegrees(look.y, dt, lookSens));
      if (swinging && !plus) hooks.attack?.(look.x * SWING_PX_PER_SEC * dt, -look.y * SWING_PX_PER_SEC * dt, true);   // PADPLUS2: under Plus the right stick always looks
      else hooks.look(dx, -dy);   // the hook reads screen-down positive and negates
    }
  }

  return {
    tick,
    axes: () => analog,
    usingController: () => usingController,
    cursor: () => (cursor ? [cursor[0], cursor[1]] : null),
    held: () => new Set(held),
    dispose() { padHideMouse(false); showPrompts(null); markHover(null); if (P.xbSet !== null) crossbarApi()?.setActive?.(null); cursorRelease(); cursorShow(false); cursorEl?.remove?.(); cursorEl = null; releaseAll(); setControllerLook(false); setPadFamily(null); window.removeEventListener('mousemove', onMouseMove); },
  };
}
