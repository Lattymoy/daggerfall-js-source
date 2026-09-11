// Mobile touch layer (2026-08-13, Mac-directed mobile test build;
// TI1 2026-09-05, Mac: "swipe based combat... touch based to
// interact... touch to lock on to enemy... a button to bring up the
// radial UI... remove all the unneeded buttons from mobile").
// One module, zero engine changes in the 1:1 lane: it SPEAKS THE
// DESKTOP INPUT LANGUAGE instead of adding a second input system.
//
//   - Virtual stick (left half): synthesizes real KeyboardEvents for
//     MoveForwards/Backwards/Left/Right (+Run past 80% throw), so the
//     scenes' `keys` Set, the input map, and reportInput all see
//     ordinary keys. 8-way digital - a test-build call, not a motor
//     change. AUDIT 62 F8: the CODE for each is the live binding's,
//     read at press time (GetBinding), never a frozen default.
//   - The right half is ONE surface with three meanings, classified
//     by ui/touchGestures.js BEFORE anything is routed (TI1b: a drag is
//     the look unless the finger was HELD first or the host is locked
//     on - speed never decides it):
//       LOOK  - a drag; the host's look(dx,dy) applies its own factor
//               (scenes gate mousemove on pointer lock, which touch can
//               never hold). TOUCH_LOOK_GAIN rides on top: phone drags
//               are shorter than mouse sweeps.
//       SWIPE - a flick, or any drag while locked on: the host's
//               attack(dx,dy,held) - the RMB-drag seam the mouse uses
//               (WeaponManager.TrackMouseAttack through
//               weaponRig.attackInput), so the swing direction is DFU's
//               own 15-degree radial pick over the finger's trail, and
//               the host's cast gate sits in front of it exactly as it
//               sits in front of the mouse.
//       TAP   - the host's tap(x,y): the activation along the ray
//               THROUGH THE FINGER, DFU's free-cursor arm
//               (PlayerActivate.cs:303 ScreenPointToRay) - which also
//               locks a foe under it (player/lockOn.js). A tap is a tap
//               on EITHER half (TI1b): a still, short touch on the
//               stick's half engaged no key anyway, so it is answered
//               as the tap it was - a foe left of centre is lockable.
//     All coordinates are CANVAS-relative (getBoundingClientRect), the
//     space the host's unproject and the dot both speak. The look and
//     the held swipe pass the host's `paused()` first - the same
//     predicate its mouse arms carry (InputManager.cs:487-505,
//     PlayerMouseLook.cs:238-244); only the RELEASE is ungated.
//   - Lock-on dot: the host projects the locked foe's chest and calls
//     setLockDot(x, y) (or null); the layer only places a mark.
//   - Buttons, the five that have no gesture: the DIAL (Tab, the door
//     the ENHANCED skin routes to the compass rose - PX15), JUMP
//     (held), the weapon SHEATHE (ReadyWeapon, held), the interaction
//     MODE cycle (T3-touch, hosts with one), and the MENU (Escape).
//     Synthetic keydown/keyup with BOTH e.key and e.code set (the input
//     map routes on either), on the ACTION's live code - an unbound
//     action presses nothing at all. The nav row for the CLASSIC windows (arrows,
//     Enter, Escape, +/-, a name prompt) shows itself while a classic
//     overlay is up and no enhanced one is - an enhanced window is DOM
//     and takes the finger directly.
//
// Activates only when the device reports touch; desktop is untouched.
//
// TI2 - THE PHONE IN HAND, TUNED (2026-09-11, Mac: "enhance the mobile
// element... camera movement, character movement and a more phone
// built feel where it doesnt seem so non-native"). The same layer, the
// same seams, six things done the way a phone game does them - every
// knob on the port's own prefs shelf (systems/uiPrefs.js, the touch*
// keys; the Enhanced pane's Touch card sets them):
//   - the LOOK is measured in fractions of the canvas height, not raw
//     pixels (ui/touchLook.js lookNormalisation), times the player's
//     own touch sensitivity on top of the mouse setting the host applies;
//   - the STICK is ANALOG: its throw is the speed (touchLook.js
//     analogAxes -> the host's MoveAxes joystick arm). The keys are
//     still synthesized - the anim and reportInput read them - and the
//     host takes the analog reading over the key impulse when it has
//     one (`axes()` on the handle). Off, the stick is TI1's 8-way;
//   - the stick can be FIXED bottom-left instead of born under the
//     finger, the finger's offset from its centre being the throw;
//   - GYRO fine aim, opt-in: the phone's rotation rate becomes look
//     units through the host's own lookScale, so it rides the same
//     LookFilter, pitch clamp and pause gate as the drag;
//   - HAPTICS: a short pulse on a button, on the hold that arms a
//     swipe, and on a lock;
//   - the FIRST TOUCH asks for fullscreen and a landscape lock where
//     the browser allows it (iOS takes it from the manifest instead -
//     public/manifest.webmanifest, apple-mobile-web-app-capable);
//   and the chrome is a phone's: safe-area insets on every edge, a
//   press that scales, the system face, and the name prompt an inline
//   field that raises the keyboard instead of window.prompt.

import { createGestureRecognizer, TAP_PX, TAP_MS } from './touchGestures.js';
import { overlayOpen } from './enhancedOverlays.js';
import { bindings } from './input.js';                       // AUDIT 62 F8: the live registry
import { getBinding, getCombo } from '../systems/inputActions.js';   // GetBinding (:641-671), GetCombo (:1195-1207)
import { getPref } from '../systems/uiPrefs.js';             // TI2: the touch* knobs
import { lookNormalisation, analogAxes, gyroLookDelta } from './touchLook.js';   // TI2: the pure halves
import { lookScale } from './lookSettings.js';               // TI2: the gyro speaks the host's look units

const TOUCH_LOOK_GAIN = 2.0;
const STICK_RADIUS = 56;        // px, visual + clamp
const RUN_THROW = 0.8;          // stick throw fraction -> ShiftLeft
const NAV_POLL_MS = 150;        // the classic-overlay nav row's watch
const FIXED_STICK_REACH = 2.5;  // TI2: a fixed stick answers a finger within this many radii of its centre
const FIXED_STICK_INSET = 36;   // TI2: the fixed stick's edge distance from the canvas's bottom-left, px, before the safe area
const GYRO_MAX_DT = 0.1;        // TI2: a motion sample older than this (a backgrounded tab) is not integrated

// TI2: the safe area. A phone's notch, rounded corners and home bar
// sit INSIDE the viewport (play/index.html asks for viewport-fit=cover
// so the canvas runs under them); every control is inset by the
// browser's own reading of the edge it sits on, exactly as the
// enhanced skin's sheets already are (enhancedStyle.js).
const edge = (side, px) => `${side}:calc(${px}px + env(safe-area-inset-${side}, 0px))`;

export function isTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

const KEY_NAMES = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyZ: 'z', Space: ' ', ShiftLeft: 'Shift', Tab: 'Tab', Escape: 'Escape', Enter: 'Enter', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Equal: '=', Minus: '-' };
function synth(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_NAMES[code] ?? code, bubbles: true }));
}

// AUDIT 62 F8: A TOUCH CONTROL PRESSES AN ACTION, NOT A LETTER.
// The layer's promise is that it speaks the desktop input language;
// the codes it spoke were the DEFAULT bindings, frozen at write time,
// while every consumer resolves BY ACTION through the registry
// (`held(keys, 'Jump')`, `moveHeld(keys)`, `actionOf(e)` - ui/input.js,
// InputManager.GetKey's dual-dict fallthrough :1084). Move Jump off
// Space in the controls window and the JUMP button fired whatever now
// owned Space; move Run off ShiftLeft and the stick's 80% throw did
// nothing. The reverse lookup is GetBinding (inputActions.js:362,
// InputManager.cs:641-671) and it is exactly what the automap, rest
// and exterior-automap windows already ask. Resolved at PRESS time, so
// a rebind takes effect on the next touch with no re-attach.
function codeFor(action) {
  const b = bindings();
  return getBinding(b, action) ?? getBinding(b, action, false);   // primary, then the secondary dict (:1084)
}
// A combo code ('ShiftLeft+KeyW', comboCode :1165-1177) is no key any
// host matches: codeDown wants BOTH halves in the held Set
// (ui/input.js), so it is pressed as its two keys - the MODIFIER
// FIRST, so the held-first latch is up when the combo is read
// (InputManager.cs:1695-1711) - and released key-first.
const codesOf = (code) => (code == null ? [] : (getCombo(code) ?? [code]));

/**
 * Attach the touch layer.
 * @param canvas the game canvas (drag surface)
 * @param hooks { look(dx,dy), attack?(dx,dy,held), tap?(x,y), locked?(), dial?, cycleMode?(), overlayActive?(), paused?() }
 *   TI2 adds nothing to the hooks: the analog stick is read FROM the
 *   handle (`axes()`), the gyro goes through `look`.
 *   - attack/tap/dial omitted on scenes without them (the fly-cam
 *     interior): a drag then only looks, a tap does nothing, and no
 *     dial button is drawn - a drawn door that opens nothing is the
 *     lie this repo names.
 * @returns { el, setLockDot(x,y)|setLockDot(null), axes(), dispose() } or null off touch
 *   axes(): TI2 - the analog stick's reading {x, y} (x strafe right +,
 *   y forward +, -1..1) while the stick is engaged AND the analog pref
 *   is on; null otherwise, so the host's MoveAxes takes the key path.
 */
export function attachTouch(canvas, hooks = {}) {
  if (!isTouchDevice()) return null;

  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;font:600 15px system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none';
  document.body.appendChild(ui);

  // TI2: the haptic pulse - navigator.vibrate where the platform has it
  // (Android; iOS Safari has none and the call is simply absent), and
  // only while the pref says so.
  const buzz = (ms) => {
    if (!getPref('touchHaptics')) return;
    try { navigator.vibrate?.(ms); } catch { /* a platform without it */ }
  };

  // TI2: FULLSCREEN AND LANDSCAPE, asked ONCE from the first touch (a
  // user gesture, which both APIs require). requestFullscreen is
  // absent on iOS Safari for anything but a video - there the manifest
  // does the job - and the orientation lock is refused outside
  // fullscreen on most browsers, hence the order. Every refusal is
  // swallowed: a browser that will not is not an error.
  let fsAsked = false;
  function askFullscreen() {
    if (fsAsked || !getPref('touchFullscreen')) return;
    fsAsked = true;
    try {
      const de = document.documentElement;
      if (!de?.requestFullscreen || document.fullscreenElement) return;
      const lock = () => { try { globalThis.screen?.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* unsupported */ } };
      de.requestFullscreen({ navigationUI: 'hide' })?.then?.(lock, () => {});
    } catch { /* unsupported */ }
  }

  // ---- virtual stick (visual) ----
  const stick = document.createElement('div');
  stick.style.cssText = `position:absolute;width:${STICK_RADIUS * 2}px;height:${STICK_RADIUS * 2}px;box-sizing:border-box;border:2px solid rgba(255,255,255,.28);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.06),rgba(255,255,255,0) 70%);display:none`;
  const nub = document.createElement('div');
  nub.style.cssText = 'position:absolute;width:44px;height:44px;margin:-22px;left:50%;top:50%;background:rgba(255,255,255,.42);border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,.45)';
  stick.appendChild(nub);
  ui.appendChild(stick);
  // TI2: the FIXED anchor - the stick lives bottom-left and shows
  // itself at rest. Its centre in CANVAS px (the space the touches are
  // read in) and its placement in the overlay's.
  const fixedStick = () => getPref('touchStickAnchor') === 'fixed';
  const fixedCentre = () => {
    const r = canvas.getBoundingClientRect();
    return [FIXED_STICK_INSET + STICK_RADIUS, r.height - FIXED_STICK_INSET - STICK_RADIUS];
  };
  function placeStick(cx, cy) {   // canvas px -> the fixed overlay's viewport px
    const r = canvas.getBoundingClientRect();
    stick.style.left = `${cx + r.left - STICK_RADIUS}px`;
    stick.style.top = `${cy + r.top - STICK_RADIUS}px`;
    stick.style.display = 'block';
    nub.style.transform = 'translate(0,0)';
  }
  function restStick() {
    if (fixedStick()) { const [cx, cy] = fixedCentre(); placeStick(cx, cy); }
    else stick.style.display = 'none';
  }
  restStick();

  // ---- the lock-on dot (TI1) ----
  const dot = document.createElement('div');
  dot.style.cssText = 'position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.75),0 0 6px rgba(0,0,0,.6);display:none';
  ui.appendChild(dot);
  function setLockDot(x, y) {
    if (x == null) { dot.style.display = 'none'; return; }
    if (dot.style.display !== 'block') buzz(20);   // TI2: the lock lands - once, on its arrival
    const r = canvas.getBoundingClientRect();   // canvas px -> the fixed overlay's viewport px
    dot.style.left = `${x + r.left}px`;
    dot.style.top = `${y + r.top}px`;
    dot.style.display = 'block';
  }

  // ---- buttons ----
  const held = new Set();      // codes currently synthesized DOWN
  const down = (code) => { if (!held.has(code)) { held.add(code); synth('keydown', code); } };
  const up = (code) => { if (held.has(code)) { held.delete(code); synth('keyup', code); } };
  // ROAD-H H8 (2026-09-07): A MOMENTARY CONTROL NEVER LIFTS A KEY A
  // HELD CONTROL STILL OWNS. AUDIT 62 F8's review gave the two HELD
  // paths that invariant (`upCode(code, liveNeeds())` - "the held set
  // is the UNION of what the live controls want, and a release
  // subtracts only its own"); the TAP paths kept synthesizing their
  // keyup bare, and a tap's keyup is not routed through `up()` at all,
  // so it never met the guard. One key wanted by two live touch
  // controls is ordinary here: the menu button is the Escape ACTION and
  // a combo Escape ('ShiftLeft+F10') decomposes onto Run's default
  // modifier, and the dial's Tab is in no binding table at all
  // (inputActions ACTIONS), so `setBinding` cannot steal it back from a
  // stick axis rebound onto it. Tapping either then sent the host
  // `keyup:ShiftLeft` / `keyup:Tab` out from under the running stick,
  // and `setStickKey`'s `cur === code` early-return meant the stick
  // never pressed it again for the rest of the hold - the same shape
  // F8's review closed for the buttons, one door further along.
  // DFU has no seam to restore: one key is one key there, and a
  // keyboard cannot press what a finger is already holding. What the
  // port owes is the invariant its SYNTHESIS creates, so the tap keeps
  // its down edge (the host's keydown ladder is what a touch button
  // means) and drops only the keyup for a code the layer is still
  // holding for someone else.
  const tapCodes = (ks) => {
    for (const k of ks) synth('keydown', k);
    for (const k of [...ks].reverse()) if (!held.has(k)) synth('keyup', k);
  };
  const tap = (code) => tapCodes(codesOf(code));
  // AUDIT 62 F8: the action-shaped arms. An UNBOUND action presses
  // NOTHING - no fall back to the default code, because a deliberately
  // unbound action's old default very likely serves a DIFFERENT action
  // now (setBinding steals the code, inputActions.js), and pressing it
  // would be the same bug wearing the fix's clothes.
  const downAction = (action) => { const c = codeFor(action); for (const k of codesOf(c)) down(k); return c; };
  const upCode = (code, keep = null) => { for (const k of codesOf(code).reverse()) if (!keep?.has(k)) up(k); };
  const tapAction = (action) => tapCodes(codesOf(codeFor(action)));

  // TI2: a phone's button - 48 px tall (the platforms' minimum target),
  // the system face, a frosted ground, a press that scales in and
  // pulses. The label and the two edges are the caller's.
  const BTN_REST = 'rgba(14,16,19,.55)', BTN_DOWN = 'rgba(120,120,120,.6)';
  function button(label, x, y, w, onDown, onUp) {
    const b = document.createElement('div');
    b.textContent = label;
    b.style.cssText = `position:absolute;${x};${y};width:${w}px;height:48px;line-height:48px;text-align:center;color:#eee;background:${BTN_REST};border:1px solid rgba(255,255,255,.22);border-radius:14px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:auto;touch-action:none;transition:transform .08s,background .08s`;
    const rest = () => { b.style.background = BTN_REST; b.style.transform = 'scale(1)'; };
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); askFullscreen(); b.style.background = BTN_DOWN; b.style.transform = 'scale(.94)'; buzz(10); onDown(); }, { passive: false });
    b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); rest(); onUp && onUp(); }, { passive: false });
    b.addEventListener('touchcancel', () => { rest(); onUp && onUp(); });
    ui.appendChild(b);
    return b;
  }

  // TI1: the five. The dial button exists only where a host routes
  // Tab to the rose - the same gate-by-hook rule the sword button had.
  // Tab alone stays a literal: it is not an InputManager action
  // (inputActions.js ACTIONS) and the hosts match `e.code === 'Tab'`.
  if (hooks.dial) button('◆', edge('left', 16), edge('top', 16), 48, () => tap('Tab'));
  button('≡', edge('left', hooks.dial ? 72 : 16), edge('top', 16), 48, () => tapAction('Escape'));   // the menu: the pause window, save and load inside it
  // AUDIT 62 F8: each held button captures the code it resolved at the
  // press and lifts THAT one, so a rebind mid-hold cannot strand a key.
  let jumpCode = null, sheatheCode = null;
  // AUDIT 62 F8 (review): A CONTROL LIFTS ONLY THE KEYS NO OTHER LIVE
  // CONTROL STILL NEEDS. The stick already released against
  // `liveNeeds()`; the two held BUTTONS released bare, so any code they
  // SHARE with a held stick axis was torn out from under it - and the
  // shape is ordinary, not a self-conflicting rebind: Run is ShiftLeft
  // by default and a combo binding (Jump = 'ShiftLeft+KeyJ') decomposes
  // to ShiftLeft + KeyJ, which the controls window does not flag as a
  // duplicate because it is not one. Lifting the button then killed the
  // run, and `setStickKey`'s `cur === code` early-return meant the
  // stick never pressed it again for the rest of the hold. DFU has no
  // such seam to restore - one key is one key there - so the port owes
  // the invariant its synthesis creates: the held set is the UNION of
  // what the live controls want, and a release subtracts only its own.
  // The code is cleared BEFORE the lift so `liveNeeds()` does not count
  // the control that is letting go.
  button('↑↑', edge('right', 16), edge('bottom', 16), 64, () => { jumpCode = downAction('Jump'); }, () => { const c = jumpCode; jumpCode = null; upCode(c, liveNeeds()); });   // jump
  button('Z', edge('right', 96), edge('bottom', 16), 52, () => { sheatheCode = downAction('ReadyWeapon'); }, () => { const c = sheatheCode; sheatheCode = null; upCode(c, liveNeeds()); });   // ReadyWeapon: sheathe toggle (held-style so the per-frame edge reads it)
  if (hooks.cycleMode) {
    // T3-touch: NextInteractionMode (Steal > Grab > Info > Talk wrap,
    // verbatim order) - the phone's path to the F1-F4 modes. The
    // label shows the LIVE mode (grab is the boot default).
    const modeBtn = button('grab', edge('right', 160), edge('bottom', 16), 64,
      () => { modeBtn.textContent = hooks.cycleMode(); });
  }

  // Overlay-nav row (classic windows navigate on arrows/Enter/Esc) -
  // shown by itself while a classic overlay holds the game.
  const nav = document.createElement('div');
  nav.style.cssText = 'position:absolute;inset:0;display:none;pointer-events:none';
  ui.appendChild(nav);
  const navBtn = (label, code, dx) => {
    const b = button(label, edge('right', dx), edge('top', 16), 44, () => tap(code));
    nav.appendChild(b);
  };
  navBtn('↑', 'ArrowUp', 262); navBtn('↓', 'ArrowDown', 212);
  navBtn('+', 'Equal', 162); navBtn('−', 'Minus', 112);
  navBtn('⏎', 'Enter', 62); navBtn('✕', 'Escape', 12);
  // Text entry (chargen name): per-char synthetic keydowns through
  // overlayAction's 'char:' route. TI2: the field is an INLINE input
  // that raises the phone's own keyboard, not window.prompt - the
  // native dialog was the most foreign thing on the screen. The
  // field's own keys are the field's (ui/input.js isTextEntryTarget:
  // the hosts route none of them); the text is delivered on Enter or
  // the ✓, as the characters the classic window reads.
  let entry = null;
  const sendText = (text) => { for (const ch of text) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: '', bubbles: true })); };
  function closeEntry() { if (entry) { entry.remove(); entry = null; } }
  function openEntry() {
    if (entry) return;
    entry = document.createElement('input');
    entry.type = 'text';
    entry.autocapitalize = 'words';
    entry.autocomplete = 'off';
    entry.placeholder = 'name';
    entry.style.cssText = `position:absolute;left:50%;${edge('top', 76)};transform:translateX(-50%);width:min(70vw,360px);height:48px;padding:0 16px;box-sizing:border-box;font:600 18px system-ui,-apple-system,sans-serif;color:#eee;background:rgba(14,16,19,.85);border:1px solid rgba(255,255,255,.3);border-radius:14px;outline:none;pointer-events:auto`;
    entry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const t = entry.value; closeEntry(); if (t) sendText(t); }
      else if (e.key === 'Escape') closeEntry();
    });
    ui.appendChild(entry);
    entry.focus?.();
  }
  {
    const b = button('abc', edge('right', 312), edge('top', 16), 44, () => openEntry());
    nav.appendChild(b);
    const ok = button('✓', edge('right', 362), edge('top', 16), 44, () => { if (!entry) return; const t = entry.value; closeEntry(); if (t) sendText(t); });
    nav.appendChild(ok);
  }
  const navTimer = setInterval(() => {
    const classicUp = !!hooks.overlayActive?.() && !overlayOpen();
    nav.style.display = classicUp ? 'block' : 'none';
    if (!classicUp) closeEntry();
    if (hooks.overlayActive?.()) dot.style.display = 'none';
    setGyro(!!getPref('touchGyroLook'));   // TI2: the pref can flip while the layer is up (the Touch card)
    if (stickId === null && fixedStick() !== (stick.style.display === 'block')) restStick();   // ...and so can the anchor
  }, NAV_POLL_MS);

  // TI2: THE GYRO. devicemotion's rotationRate, integrated over the
  // sample's own interval and mapped by the screen orientation
  // (ui/touchLook.js gyroLookDelta) into look units - the host's
  // lookScale() is divided out here so its multiply puts it back, and
  // the delta rides hooks.look like a drag: same LookFilter, same pitch
  // clamp, same pause gate (dropped under a window, never banked).
  let gyroOn = false, gyroT = 0;
  const onMotion = (e) => {
    const now = e.timeStamp ?? performance.now();
    const dt = gyroT ? (now - gyroT) / 1000 : 0;
    gyroT = now;
    if (!(dt > 0) || dt > GYRO_MAX_DT || hooks.paused?.()) return;
    const d = gyroLookDelta(e.rotationRate, globalThis.screen?.orientation?.type ?? 'landscape-primary', dt, lookScale(), getPref('touchGyroSensitivity'));
    if (d.dx || d.dy) hooks.look?.(d.dx, d.dy);
  };
  function setGyro(on) {
    if (on === gyroOn) return;
    gyroOn = on; gyroT = 0;
    try { window[on ? 'addEventListener' : 'removeEventListener']?.('devicemotion', onMotion); } catch { /* no motion events here */ }
  }
  // iOS asks permission for motion, and only from a user gesture: the
  // Touch card asks when the switch is turned on; a pref already on at
  // boot is asked for on the first touch instead (askMotion below).
  let motionAsked = false;
  function askMotion() {
    if (motionAsked || !getPref('touchGyroLook')) return;
    motionAsked = true;
    try { globalThis.DeviceMotionEvent?.requestPermission?.()?.catch?.(() => {}); } catch { /* not iOS */ }
  }
  setGyro(!!getPref('touchGyroLook'));

  // ---- canvas touch: stick (left half) + the classified right half ----
  let stickId = null, stickOrigin = null, stickStart = 0, stickTravel = 0;
  let stickX = 0, stickY = 0;   // TI2: the analog reading while engaged (x right +, y forward +)
  let lookId = null;
  const gesture = createGestureRecognizer({ locked: () => !!hooks.locked?.() });
  const local = (tch) => { const r = canvas.getBoundingClientRect(); return [tch.clientX - r.left, tch.clientY - r.top, r.width]; };

  // AUDIT 62 F8: the stick holds ACTIONS, and remembers the code each
  // one resolved to, so a binding changed mid-hold releases the code it
  // actually pressed instead of stranding it down forever.
  const stickHeld = new Map();   // action -> the code it is holding
  // Every key a live control still wants down: the stick's axes AND the
  // two held buttons (see their release above). Whoever is letting go
  // clears its own entry first, so this never keeps a key for the
  // control that is releasing it.
  const liveNeeds = () => {
    const s = new Set();
    for (const c of stickHeld.values()) for (const k of codesOf(c)) s.add(k);
    for (const c of [jumpCode, sheatheCode]) for (const k of codesOf(c)) s.add(k);
    return s;
  };
  function setStickKey(action, want) {
    const cur = stickHeld.get(action) ?? null;
    const code = want ? codeFor(action) : null;   // unbound -> null -> nothing is pressed
    if (cur === code) return;
    if (cur != null) { stickHeld.delete(action); upCode(cur, liveNeeds()); }   // a code another axis still needs stays down
    if (code != null) { for (const k of codesOf(code)) down(k); stickHeld.set(action, code); }
  }
  function releaseStick() { for (const a of [...stickHeld.keys()]) setStickKey(a, false); }

  function setStickKeys(dx, dy, mag) {
    const on = (action, v) => setStickKey(action, v);
    const dead = mag < 0.25;
    // 8-way: an axis engages when its component clears tan(22.5deg)
    // (~0.414) of the other's - diagonals hold two keys.
    on('MoveForwards', !dead && dy < 0 && Math.abs(dy) >= Math.abs(dx) * 0.414);
    on('MoveBackwards', !dead && dy > 0 && Math.abs(dy) >= Math.abs(dx) * 0.414);
    on('MoveLeft', !dead && dx < 0 && Math.abs(dx) >= Math.abs(dy) * 0.414);
    on('MoveRight', !dead && dx > 0 && Math.abs(dx) >= Math.abs(dy) * 0.414);
    on('Run', !dead && mag >= RUN_THROW);
  }

  // AUDIT 62 F7: THE PAUSE GATE THE MOUSE ARMS ALWAYS CARRIED. The
  // mouse look returns unless the pointer is locked (a window frees it)
  // and the RMB swing is gated on the host's overlay predicate; the
  // finger had neither, so a drag on a canvas-drawn CLASSIC window
  // (inventory, travel map, spellbook) swung the weapon, fired a
  // readied spell through the M2 intercept, and banked look residual
  // that the LookFilter paid out the moment the window closed.
  // DFU: InputManager.cs:230-236 clears mouseX/mouseY/lookX/lookY every
  // Update and :487-505 returns before currentActions is populated while
  // paused, so no SwingWeapon/ActivateCenterObject is ever seen under a
  // window; PlayerMouseLook.cs:238-244 `enableMouseLook =
  // !GameManager.IsGamePaused; if (!enableMouseLook) return;` DROPS the
  // frame's delta rather than banking it.
  // The gate lives here, at the one door all three hosts share (the
  // hosts pass the same predicate their mouse arms use). The RELEASE is
  // never gated - a window opened mid-swing must still let go, exactly
  // as the ungated mouseup arms do - and because the recognizer emits
  // held:false only on the finger's lift, the gate synthesizes that
  // release itself the moment it bites.
  let swiping = false;   // a held=true swipe was actually delivered
  // TI2: one CSS pixel of finger is worth TOUCH_REF_HEIGHT/height of
  // TI1b's, times the player's touch sensitivity - the drag is a
  // fraction of the screen, not a count of whatever pixels it has.
  const lookNorm = () => lookNormalisation(canvas.getBoundingClientRect().height, getPref('touchLookSensitivity'));
  function route(events) {
    const paused = !!hooks.paused?.();
    for (const ev of events) {
      if (ev.type === 'look') {
        if (!paused) hooks.look?.(ev.dx * TOUCH_LOOK_GAIN * lookNorm(), ev.dy * TOUCH_LOOK_GAIN * lookNorm());   // dropped, never accumulated
      } else if (ev.type === 'swipe') {
        if (ev.held) {
          if (paused) { if (swiping) { swiping = false; hooks.attack?.(0, 0, false); } continue; }
          if (!swiping) buzz(15);   // TI2: the hold armed - the finger is told
          swiping = true;
        } else swiping = false;
        hooks.attack?.(ev.dx, ev.dy, ev.held);
      } else if (ev.type === 'tap') {
        // ungated: the hosts' activateGate already refuses it while
        // paused (systems/activateGate.js Fact 5, InputManager.cs:486-505)
        hooks.tap?.(ev.x, ev.y);
      }
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    askFullscreen(); askMotion();   // TI2: the first touch is the user gesture both need
    for (const t of e.changedTouches) {
      const [x, y, w] = local(t);
      // TI2: a FIXED stick's origin is its own centre, and it answers
      // only a finger that landed near it (the stick never moves, so
      // the finger's offset from a far-off origin would be a full throw
      // at once); a touch elsewhere on the half falls through to the
      // classifier below - the tap it was, or a look, as on the right.
      // A floating stick is born under the finger, as TI1's was.
      const fixed = fixedStick();
      const fc = fixed ? fixedCentre() : null;
      const onStick = !fixed || Math.hypot(x - fc[0], y - fc[1]) <= STICK_RADIUS * FIXED_STICK_REACH;
      if (x < w / 2 && stickId === null && onStick) {
        stickId = t.identifier;
        stickStart = e.timeStamp; stickTravel = 0; stickX = stickY = 0;
        stickOrigin = fixed ? fc : [x, y];
        placeStick(stickOrigin[0], stickOrigin[1]);
      } else if (lookId === null) {
        lookId = t.identifier;
        route(gesture.begin(x, y, e.timeStamp));
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const [x, y] = local(t);
        let dx = x - stickOrigin[0], dy = y - stickOrigin[1];
        const len = Math.hypot(dx, dy);
        stickTravel = Math.max(stickTravel, len);
        const mag = Math.min(1, len / STICK_RADIUS);
        if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
        nub.style.transform = `translate(${dx}px,${dy}px)`;
        setStickKeys(dx / STICK_RADIUS, dy / STICK_RADIUS, mag);
        ({ x: stickX, y: stickY } = analogAxes(dx, dy, STICK_RADIUS));   // TI2: the throw, past the dead zone
      } else if (t.identifier === lookId) {
        const [x, y] = local(t);
        route(gesture.move(x, y, e.timeStamp));
      }
    }
  }, { passive: false });

  const endTouch = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null;
        stickX = stickY = 0;
        restStick();   // TI2: a fixed stick stays, at rest; a floating one goes
        releaseStick();   // AUDIT 62 F8: the codes it actually holds, not a frozen literal list
        // TI1b: a still, short touch on this half is a TAP - it moved no
        // key (the stick's dead zone) and it is how a foe left of centre
        // gets locked.
        if (e.type !== 'touchcancel' && stickTravel < TAP_PX && (e.timeStamp - stickStart) <= TAP_MS) {
          hooks.tap?.(stickOrigin[0], stickOrigin[1]);
        }
      } else if (t.identifier === lookId) {
        lookId = null;
        route(e.type === 'touchcancel' ? gesture.cancel() : gesture.end(e.timeStamp));
      }
    }
  };
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  return {
    el: ui,
    setLockDot,
    axes: () => (stickId !== null && getPref('touchAnalogStick') ? { x: stickX, y: stickY } : null),   // TI2
    dispose() { clearInterval(navTimer); setGyro(false); ui.remove(); },
  };
}
