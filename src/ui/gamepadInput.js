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
//     :159-160). The cursor it draws in windows is GP3's.
//
// The pad is the FIRST connected one with the standard mapping. Every
// code this layer presses it releases when the pad goes, the setting
// turns off, or the layer is disposed - a held key with no hand on it
// is the disease the touch layer's `up()` guards against.
import { bindings } from './input.js';
import { getBinding, getAxisBinding, getAxisInversion, getJoystickUIBinding } from '../systems/inputActions.js';
import { unityAxes, unityButtons, axisNumber, axisKeyDown, isAxisKeyName, parseAxisKeyName, movementAxes, cameraAxes, controllerLookDegrees, controllerSettings, NUM_AXES } from '../systems/gamepad.js';
import { lookScale } from './lookSettings.js';
import { setControllerLook } from '../player/lookFilter.js';

/** The swing's drag, in the attack hook's pixels per second at a full stick. */
export const SWING_PX_PER_SEC = 800;

const MOUSE_CODE_OF_UI = Object.freeze({ LeftClick: 'Mouse0', RightClick: 'Mouse1', MiddleClick: 'Mouse2' });

function synth(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}

/** Is there a Gamepad API to poll. */
export function hasGamepadApi() {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
}

/** The first connected standard-mapping pad, or null. */
export function pickPad(list) {
  for (const p of list ?? []) if (p && p.connected !== false && (p.mapping === 'standard' || p.mapping === '')) return p;
  return null;
}

/**
 * @param canvas the host's canvas (unused beyond identity; the pad has no element)
 * @param hooks { look(dx, dy), attack(dx, dy, held), overlayActive() }
 *   - the same object the host hands attachTouch
 * @returns { tick(dt), axes(), usingController(), dispose() } or null without the API
 */
export function attachGamepad(canvas, hooks = {}, { getPads = null, dispatch = synth } = {}) {
  if (!getPads && !hasGamepadApi()) return null;
  getPads ??= () => navigator.getGamepads();
  const axes = new Float32Array(NUM_AXES + 1);
  const buttons = new Set();
  const held = new Set();        // every code this layer is pressing
  let analog = null;             // the movement stick's throw for MoveAxes
  let usingController = false;
  let mouseMoved = false;
  let swinging = false;
  const onMouseMove = (e) => { if (e.movementX || e.movementY) mouseMoved = true; };
  window.addEventListener('mousemove', onMouseMove);

  const press = (code) => { if (!held.has(code)) { held.add(code); dispatch('keydown', code); } };
  const releaseAll = (keep = null) => {
    for (const code of [...held]) if (!keep?.has(code)) { held.delete(code); dispatch('keyup', code); }
  };
  const codeOf = (store, action) => getBinding(store, action) ?? getBinding(store, action, false);

  function tick(dt) {
    const s = controllerSettings();
    const pad = s.enabled ? pickPad(getPads()) : null;
    if (!pad) {
      analog = null;
      if (swinging) { swinging = false; hooks.attack?.(0, 0, false); }
      if (usingController) { usingController = false; setControllerLook(false); }
      releaseAll();
      mouseMoved = false;
      return;
    }
    unityAxes(pad, axes);
    unityButtons(pad, buttons);
    const b = bindings();
    const wanted = new Set(buttons);
    // axis keys: every bound one, polled (GetAxisKey)
    for (const dict of [b.primary, b.secondary]) {
      for (const code of dict.keys()) if (isAxisKeyName(code) && axisKeyDown(axes, parseAxisKeyName(code))) wanted.add(code);
    }
    // the movement stick (FindInputAxisActions)
    const mh = axisNumber(getAxisBinding(b, 'MovementHorizontal')), mvn = axisNumber(getAxisBinding(b, 'MovementVertical'));
    let moved = false;
    if (mh && mvn) {
      const m = movementAxes(axes[mh], axes[mvn], { deadzone: s.deadzone, threshold: s.threshold, invertH: getAxisInversion(b, 'MovementHorizontal'), invertV: getAxisInversion(b, 'MovementVertical') });
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
    // UsingController (:1536-1546): a stick makes the pad live, the mouse takes it back
    if (mouseMoved) usingController = false;
    else if (moved) usingController = true;
    mouseMoved = false;
    setControllerLook(usingController);
    // the UI buttons as the mouse's (GetMouseButton :1050-1063) and Back as Escape (:1065-1068)
    const overlay = !!hooks.overlayActive?.();
    for (const [ui, mouse] of Object.entries(MOUSE_CODE_OF_UI)) {
      const code = getJoystickUIBinding(b, ui);
      if (code && buttons.has(code)) wanted.add(mouse);
    }
    const back = getJoystickUIBinding(b, 'Back');
    if (back && buttons.has(back) && overlay) { const c = codeOf(b, 'Escape'); if (c) wanted.add(c); }
    // edges: presses first, then the releases of what is no longer wanted
    for (const code of wanted) press(code);
    releaseAll(wanted);
    // the swing: RightClick's button held is the drag's button held -
    // its edges first, so the frame the button lifts is a look again
    const swingBtn = getJoystickUIBinding(b, 'RightClick');
    const swingNow = !!swingBtn && buttons.has(swingBtn) && !overlay;
    if (swingNow && !swinging) { swinging = true; hooks.attack?.(0, 0, true); }
    else if (!swingNow && swinging) { swinging = false; hooks.attack?.(0, 0, false); }
    // the look, in the hook's units (the host multiplies by lookScale())
    // - or, while the swing's button is down, the drag's direction
    if ((look.x || look.y) && !overlay && hooks.look) {
      const toUnits = (deg) => ((deg * Math.PI) / 180) / lookScale();
      const dx = toUnits(controllerLookDegrees(look.x, dt, s.lookSensitivity));
      const dy = toUnits(controllerLookDegrees(look.y, dt, s.lookSensitivity));
      if (swinging) hooks.attack?.(look.x * SWING_PX_PER_SEC * dt, -look.y * SWING_PX_PER_SEC * dt, true);
      else hooks.look(dx, -dy);   // the hook reads screen-down positive and negates
    }
  }

  return {
    tick,
    axes: () => analog,
    usingController: () => usingController,
    held: () => new Set(held),
    dispose() { releaseAll(); setControllerLook(false); window.removeEventListener('mousemove', onMouseMove); },
  };
}
