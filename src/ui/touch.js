// Mobile touch layer (2026-08-13, Mac-directed mobile test build;
// TI1 2026-09-05, Mac: "swipe based combat... touch based to
// interact... touch to lock on to enemy... a button to bring up the
// radial UI... remove all the unneeded buttons from mobile").
// One module, zero engine changes in the 1:1 lane: it SPEAKS THE
// DESKTOP INPUT LANGUAGE instead of adding a second input system.
//
//   - Virtual stick (left half): synthesizes real KeyboardEvents for
//     KeyW/KeyA/KeyS/KeyD (+ShiftLeft past 80% throw), so the scenes'
//     `keys` Set, the input map, and reportInput all see ordinary
//     keys. 8-way digital - a test-build call, not a motor change.
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
//     space the host's unproject and the dot both speak.
//   - Lock-on dot: the host projects the locked foe's chest and calls
//     setLockDot(x, y) (or null); the layer only places a mark.
//   - Buttons, the five that have no gesture: the DIAL (Tab, the door
//     every combat host routes to the compass rose - PX15), JUMP
//     (Space, held), the weapon SHEATHE (Z, held), the interaction MODE
//     cycle (T3-touch, hosts with one), and the MENU (Escape). Synthetic
//     keydown/keyup with BOTH e.key and e.code set (the input map
//     routes on either). The nav row for the CLASSIC windows (arrows,
//     Enter, Escape, +/-, a name prompt) shows itself while a classic
//     overlay is up and no enhanced one is - an enhanced window is DOM
//     and takes the finger directly.
//
// Activates only when the device reports touch; desktop is untouched.

import { createGestureRecognizer, TAP_PX } from './touchGestures.js';
import { overlayOpen } from './enhancedOverlays.js';

const TOUCH_LOOK_GAIN = 2.0;
const STICK_RADIUS = 56;        // px, visual + clamp
const RUN_THROW = 0.8;          // stick throw fraction -> ShiftLeft
const NAV_POLL_MS = 150;        // the classic-overlay nav row's watch

export function isTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

const KEY_NAMES = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyZ: 'z', Space: ' ', ShiftLeft: 'Shift', Tab: 'Tab', Escape: 'Escape', Enter: 'Enter', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Equal: '=', Minus: '-' };
function synth(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_NAMES[code] ?? code, bubbles: true }));
}

/**
 * Attach the touch layer.
 * @param canvas the game canvas (drag surface)
 * @param hooks { look(dx,dy), attack?(dx,dy,held), tap?(x,y), locked?(), dial?, cycleMode?(), overlayActive?() }
 *   - attack/tap/dial omitted on scenes without them (the fly-cam
 *     interior): a drag then only looks, a tap does nothing, and no
 *     dial button is drawn - a drawn door that opens nothing is the
 *     lie this repo names.
 * @returns { el, setLockDot(x,y)|setLockDot(null), dispose() } or null off touch
 */
export function attachTouch(canvas, hooks = {}) {
  if (!isTouchDevice()) return null;

  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;font:16px monospace;-webkit-user-select:none;user-select:none';
  document.body.appendChild(ui);

  // ---- virtual stick (visual) ----
  const stick = document.createElement('div');
  stick.style.cssText = `position:absolute;width:${STICK_RADIUS * 2}px;height:${STICK_RADIUS * 2}px;border:2px solid rgba(255,255,255,.35);border-radius:50%;display:none`;
  const nub = document.createElement('div');
  nub.style.cssText = 'position:absolute;width:40px;height:40px;margin:-20px;left:50%;top:50%;background:rgba(255,255,255,.35);border-radius:50%';
  stick.appendChild(nub);
  ui.appendChild(stick);

  // ---- the lock-on dot (TI1) ----
  const dot = document.createElement('div');
  dot.style.cssText = 'position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.75),0 0 6px rgba(0,0,0,.6);display:none';
  ui.appendChild(dot);
  function setLockDot(x, y) {
    if (x == null) { dot.style.display = 'none'; return; }
    const r = canvas.getBoundingClientRect();   // canvas px -> the fixed overlay's viewport px
    dot.style.left = `${x + r.left}px`;
    dot.style.top = `${y + r.top}px`;
    dot.style.display = 'block';
  }

  // ---- buttons ----
  const held = new Set();      // codes currently synthesized DOWN
  const down = (code) => { if (!held.has(code)) { held.add(code); synth('keydown', code); } };
  const up = (code) => { if (held.has(code)) { held.delete(code); synth('keyup', code); } };
  const tap = (code) => { synth('keydown', code); synth('keyup', code); };

  function button(label, x, y, w, onDown, onUp) {
    const b = document.createElement('div');
    b.textContent = label;
    b.style.cssText = `position:absolute;${x};${y};width:${w}px;height:44px;line-height:44px;text-align:center;color:#ddd;background:rgba(20,20,20,.55);border:1px solid rgba(255,255,255,.25);border-radius:8px;pointer-events:auto`;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(90,90,90,.7)'; onDown(); }, { passive: false });
    b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(20,20,20,.55)'; onUp && onUp(); }, { passive: false });
    b.addEventListener('touchcancel', () => { b.style.background = 'rgba(20,20,20,.55)'; onUp && onUp(); });
    ui.appendChild(b);
    return b;
  }

  // TI1: the five. The dial button exists only where a host routes
  // Tab to the rose - the same gate-by-hook rule the sword button had.
  if (hooks.dial) button('◆', 'left:16px', 'top:16px', 48, () => tap('Tab'));
  button('≡', hooks.dial ? 'left:72px' : 'left:16px', 'top:16px', 48, () => tap('Escape'));   // the menu: the pause window, save and load inside it
  button('↑↑', 'right:16px', 'bottom:16px', 64, () => down('Space'), () => up('Space'));   // jump
  button('Z', 'right:96px', 'bottom:16px', 52, () => down('KeyZ'), () => up('KeyZ'));   // ReadyWeapon: sheathe toggle (held-style so the per-frame edge reads it)
  if (hooks.cycleMode) {
    // T3-touch: NextInteractionMode (Steal > Grab > Info > Talk wrap,
    // verbatim order) - the phone's path to the F1-F4 modes. The
    // label shows the LIVE mode (grab is the boot default).
    const modeBtn = button('grab', 'right:160px', 'bottom:16px', 64,
      () => { modeBtn.textContent = hooks.cycleMode(); });
  }

  // Overlay-nav row (classic windows navigate on arrows/Enter/Esc) -
  // shown by itself while a classic overlay holds the game.
  const nav = document.createElement('div');
  nav.style.cssText = 'position:absolute;inset:0;display:none;pointer-events:none';   // TI1d (review): a full-bleed positioning context - the buttons' right/top read against the viewport as written
  ui.appendChild(nav);
  const navBtn = (label, code, dx) => {
    const b = button(label, `right:${dx}px`, 'top:16px', 44, () => tap(code));
    nav.appendChild(b);
    b.style.right = `${dx}px`;
  };
  navBtn('↑', 'ArrowUp', 262); navBtn('↓', 'ArrowDown', 212);
  navBtn('+', 'Equal', 162); navBtn('−', 'Minus', 112);
  navBtn('⏎', 'Enter', 62); navBtn('✕', 'Escape', 12);
  // Text entry (chargen name): prompt() -> per-char synthetic
  // keydowns through overlayAction's 'char:' route.
  {
    const b = button('abc', 'right:312px', 'top:16px', 44, () => {
      const text = window.prompt('name');
      if (!text) return;
      for (const ch of text) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: '', bubbles: true }));
    });
    nav.appendChild(b);
  }
  const navTimer = setInterval(() => {
    const classicUp = !!hooks.overlayActive?.() && !overlayOpen();
    nav.style.display = classicUp ? 'block' : 'none';
    if (hooks.overlayActive?.()) dot.style.display = 'none';
  }, NAV_POLL_MS);

  // ---- canvas touch: stick (left half) + the classified right half ----
  let stickId = null, stickOrigin = null, stickStart = 0, stickTravel = 0;
  let lookId = null;
  const gesture = createGestureRecognizer({ locked: () => !!hooks.locked?.() });
  const local = (tch) => { const r = canvas.getBoundingClientRect(); return [tch.clientX - r.left, tch.clientY - r.top, r.width]; };

  function setStickKeys(dx, dy, mag) {
    const on = (code, v) => (v ? down(code) : up(code));
    const dead = mag < 0.32;   // TI1d: 18 px at STICK_RADIUS 56 - strictly wider than TAP_PX (16), the left-half tap's law
    // 8-way: an axis engages when its component clears tan(22.5deg)
    // (~0.414) of the other's - diagonals hold two keys.
    on('KeyW', !dead && dy < 0 && Math.abs(dy) >= Math.abs(dx) * 0.414);
    on('KeyS', !dead && dy > 0 && Math.abs(dy) >= Math.abs(dx) * 0.414);
    on('KeyA', !dead && dx < 0 && Math.abs(dx) >= Math.abs(dy) * 0.414);
    on('KeyD', !dead && dx > 0 && Math.abs(dx) >= Math.abs(dy) * 0.414);
    on('ShiftLeft', !dead && mag >= RUN_THROW);
  }

  function route(events) {
    for (const ev of events) {
      if (ev.type === 'look') hooks.look?.(ev.dx * TOUCH_LOOK_GAIN, ev.dy * TOUCH_LOOK_GAIN);
      else if (ev.type === 'swipe') hooks.attack?.(ev.dx, ev.dy, ev.held);
      else if (ev.type === 'tap') hooks.tap?.(ev.x, ev.y);
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const [x, y, w] = local(t);
      if (x < w / 2 && stickId === null) {
        stickId = t.identifier;
        stickOrigin = [x, y]; stickStart = e.timeStamp; stickTravel = 0;
        stick.style.left = `${t.clientX - STICK_RADIUS}px`;
        stick.style.top = `${t.clientY - STICK_RADIUS}px`;
        stick.style.display = 'block';
        nub.style.transform = 'translate(0,0)';
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
        stick.style.display = 'none';
        for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) up(c);
        // TI1b: a still, short touch on this half is a TAP - it moved no
        // key (the stick's dead zone) and it is how a foe left of centre
        // gets locked.
        // TI1d: however long it rested (the right half's law), and the
        // stick's dead zone stays wider than TAP_PX so a tap-qualified
        // touch never pressed a movement key.
        if (e.type !== 'touchcancel' && stickTravel < TAP_PX) {
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
    dispose() { clearInterval(navTimer); ui.remove(); },
  };
}
