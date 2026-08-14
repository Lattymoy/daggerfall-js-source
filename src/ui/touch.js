// Mobile touch layer (2026-08-13, Mac-directed mobile test build).
// One module, zero engine changes: it SPEAKS THE DESKTOP INPUT
// LANGUAGE instead of adding a second input system.
//
//   - Virtual stick (left half): synthesizes real KeyboardEvents for
//     KeyW/KeyA/KeyS/KeyD (+ShiftLeft past 80% throw), so the scenes'
//     `keys` Set, the input map, and reportInput all see ordinary
//     keys. 8-way digital - a test-build call, not a motor change.
//   - Look (right half drag): scenes gate mousemove on pointer lock,
//     which touch can never hold - so each scene passes a look(dx,dy)
//     hook and applies its own 0.0025 factor (TOUCH_LOOK_GAIN rides
//     on top; phone drags are shorter than mouse sweeps).
//   - Attack (sword button): mirrors the RMB-drag seam 1:1 -
//     press -> attack(0,0,true), drags while held -> attack(dx,dy,true),
//     release -> attack(0,0,false). The drag-gesture strike mapper is
//     untouched.
//   - Action buttons: synthetic keydown/keyup with BOTH e.key and
//     e.code set (the input map routes on either). Hold-style keys
//     (Space jump, KeyE use) press/release; window keys (F5/F6/
//     Backspace/C/Esc/arrows/Enter) tap. The ⌨ button toggles the
//     overlay-nav row for the classic windows.
//
// Activates only when the device reports touch; desktop is untouched.

const TOUCH_LOOK_GAIN = 2.0;
const STICK_RADIUS = 56;        // px, visual + clamp
const RUN_THROW = 0.8;          // stick throw fraction -> ShiftLeft

export function isTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

const KEY_NAMES = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyC: 'c', Space: ' ', ShiftLeft: 'Shift', F5: 'F5', F6: 'F6', Backspace: 'Backspace', Escape: 'Escape', Enter: 'Enter', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Minus: '-', Equal: '=' };
function synth(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_NAMES[code] ?? code, bubbles: true }));
}

/**
 * Attach the touch layer.
 * @param canvas the game canvas (drag surface)
 * @param hooks { look(dx,dy), attack?(dx,dy,held) } - attack omitted
 *              on scenes without combat (fly-cam viewers).
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

  // ---- buttons ----
  const held = new Set();      // codes currently synthesized DOWN
  const down = (code) => { if (!held.has(code)) { held.add(code); synth('keydown', code); } };
  const up = (code) => { if (held.has(code)) { held.delete(code); synth('keyup', code); } };
  const tap = (code) => { synth('keydown', code); synth('keyup', code); };

  function button(label, x, y, w, onDown, onUp) {
    const b = document.createElement('div');
    b.textContent = label;
    b.style.cssText = `position:absolute;${x};${y};width:${w}px;height:44px;line-height:44px;text-align:center;color:#ddd;background:rgba(20,20,20,.55);border:1px solid rgba(255,255,255,.3);border-radius:8px;pointer-events:auto`;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(90,90,90,.7)'; onDown(); }, { passive: false });
    b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(20,20,20,.55)'; onUp && onUp(); }, { passive: false });
    b.addEventListener('touchcancel', () => { b.style.background = 'rgba(20,20,20,.55)'; onUp && onUp(); });
    ui.appendChild(b);
    return b;
  }

  let attackHeld = false;
  if (hooks.attack) {
    button('\u2694', 'right:16px', 'bottom:88px', 64,
      () => { attackHeld = true; hooks.attack(0, 0, true); },
      () => { attackHeld = false; hooks.attack(0, 0, false); });
  }
  button('E', 'right:96px', 'bottom:16px', 52, () => down('KeyE'), () => up('KeyE'));
  button('\u2191\u2191', 'right:16px', 'bottom:16px', 64, () => down('Space'), () => up('Space'));   // jump
  button('F5', 'left:16px', 'top:16px', 48, () => tap('F5'));
  button('F6', 'left:72px', 'top:16px', 48, () => tap('F6'));
  button('\u2630', 'left:128px', 'top:16px', 48, () => tap('Backspace'));   // spellbook
  button('C', 'left:184px', 'top:16px', 48, () => tap('KeyC'));             // cast

  // Overlay-nav row (classic windows navigate on arrows/Enter/Esc)
  const nav = document.createElement('div');
  nav.style.cssText = 'position:absolute;right:16px;top:16px;display:none;pointer-events:none';
  ui.appendChild(nav);
  const navBtn = (label, code, dx) => {
    const b = button(label, `right:${dx}px`, 'top:16px', 44, () => tap(code));
    nav.appendChild(b);
    b.style.right = `${dx}px`;
  };
  navBtn('\u2191', 'ArrowUp', 262); navBtn('\u2193', 'ArrowDown', 212);
  navBtn('+', 'Equal', 162); navBtn('\u2212', 'Minus', 112);
  navBtn('\u23ce', 'Enter', 62); navBtn('\u2715', 'Escape', 12);
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
  button('\u2328', 'right:16px', 'top:70px', 44, () => { nav.style.display = nav.style.display === 'none' ? 'block' : 'none'; });

  // ---- canvas touch: stick (left half) + look/attack drag (right half) ----
  let stickId = null, stickOrigin = null;
  let lookId = null, lookLast = null;

  function setStickKeys(dx, dy, mag) {
    const on = (code, v) => (v ? down(code) : up(code));
    const dead = mag < 0.25;
    // 8-way: an axis engages when its component clears tan(22.5deg)
    // (~0.414) of the other's - diagonals hold two keys.
    on('KeyW', !dead && dy < 0 && Math.abs(dy) >= Math.abs(dx) * 0.414);
    on('KeyS', !dead && dy > 0 && Math.abs(dy) >= Math.abs(dx) * 0.414);
    on('KeyA', !dead && dx < 0 && Math.abs(dx) >= Math.abs(dy) * 0.414);
    on('KeyD', !dead && dx > 0 && Math.abs(dx) >= Math.abs(dy) * 0.414);
    on('ShiftLeft', !dead && mag >= RUN_THROW);
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && stickId === null) {
        stickId = t.identifier;
        stickOrigin = [t.clientX, t.clientY];
        stick.style.left = `${t.clientX - STICK_RADIUS}px`;
        stick.style.top = `${t.clientY - STICK_RADIUS}px`;
        stick.style.display = 'block';
        nub.style.transform = 'translate(0,0)';
      } else if (lookId === null) {
        lookId = t.identifier;
        lookLast = [t.clientX, t.clientY];
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = t.clientX - stickOrigin[0], dy = t.clientY - stickOrigin[1];
        const len = Math.hypot(dx, dy);
        const mag = Math.min(1, len / STICK_RADIUS);
        if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
        nub.style.transform = `translate(${dx}px,${dy}px)`;
        setStickKeys(dx / STICK_RADIUS, dy / STICK_RADIUS, mag);
      } else if (t.identifier === lookId) {
        const dx = (t.clientX - lookLast[0]) * TOUCH_LOOK_GAIN;
        const dy = (t.clientY - lookLast[1]) * TOUCH_LOOK_GAIN;
        lookLast = [t.clientX, t.clientY];
        if (attackHeld && hooks.attack) hooks.attack(dx, dy, true);
        else hooks.look && hooks.look(dx, dy);
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
      } else if (t.identifier === lookId) {
        lookId = null;
      }
    }
  };
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  return ui;
}
