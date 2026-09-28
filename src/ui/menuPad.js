// PAD-DOOR (2026-09-27, Discord - an AYN Thor, an Android handheld with a controller built in: "i can login get to
// the main screen but im unable to select online, load game anything"). THE FRONT DOOR ANSWERS A CONTROLLER.
//
// The game's pad layer (ui/gamepadInput.js) attaches with a scene (world.js, dungeon.js, exterior.js, interior.js),
// so before one there was no pad at all: the intro, the menu, its sign-in window and the boot settings took a finger
// or a mouse and nothing else, and a handheld player with the controller in their hands could only reach the screen.
// This is the door's own small loop over the page's own controls - no second menu, no map of the menu's buttons:
//
//   - the d-pad, or the left stick past half-way, moves the focus to the nearest control that way (auto-repeating
//     while held);
//   - A (or Start) presses the focused control; with nothing focused, the first press focuses the first control;
//   - B is Escape - the menu's own back (enhancedMenu.js onKey), the popups' own close;
//   - left and right on a focused list box or slider step its value, as they would on a keyboard.
//
// A control covered by something drawn over it - the sign-in window's scrim over the home - is not a place the focus
// can go: what a pad can press is what a finger could. And it STOPS when a game is chosen (main.js), where the
// scene's own pad takes over; the two never read the same press.

/** The standard-mapping buttons this loop reads (the W3C Gamepad "standard" layout). */
export const PAD = Object.freeze({ A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 });
/** A stick past this is a direction. */
export const STICK_DIRECTION = 0.5;
/** A held direction repeats after this long, then every REPEAT_MS. */
export const REPEAT_DELAY_MS = 380;
export const REPEAT_MS = 120;

const pressed = (pad, i) => !!pad?.buttons?.[i]?.pressed;

/** The direction a pad asks for this frame - the d-pad first, else the left stick - or null. `prev` is last frame's:
 *  AUDIT PAD-DOOR A6 - a stick held near a diagonal keeps the way it went while that axis still leans past
 *  STICK_DIRECTION (the larger axis alone flipped right-down-right on a hand's tremor, and every flip fired a move). */
export function padDirection(pad, prev = null) {
  if (pressed(pad, PAD.UP)) return 'up';
  if (pressed(pad, PAD.DOWN)) return 'down';
  if (pressed(pad, PAD.LEFT)) return 'left';
  if (pressed(pad, PAD.RIGHT)) return 'right';
  const x = Number(pad?.axes?.[0]) || 0, y = Number(pad?.axes?.[1]) || 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < STICK_DIRECTION) return null;
  const still = { right: x >= STICK_DIRECTION, left: x <= -STICK_DIRECTION, down: y >= STICK_DIRECTION, up: y <= -STICK_DIRECTION };
  if (prev && still[prev]) return prev;
  return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
}

/** The pad to read: a standard-mapped one first, as the game's own picker prefers (gamepadInput.js pickPad). */
export function pickDoorPad(pads) {
  const live = [...(pads ?? [])].filter((p) => p && p.connected !== false);
  return live.find((p) => p.mapping === 'standard') ?? live[0] ?? null;
}

/** The nearest candidate from `from` toward `dir` - every rect is {x, y, w, h} in one frame. A candidate counts when
 *  its centre lies ahead of the focus's that way; the score is the distance along the direction plus twice the
 *  distance across it, so the control in line wins over a nearer one off to the side. Null when nothing lies that
 *  way. Pure. */
export function nextFocus(from, candidates, dir) {
  const cx = (r) => r.x + r.w / 2, cy = (r) => r.y + r.h / 2;
  const fx = cx(from), fy = cy(from);
  let best = null, bestScore = Infinity;
  for (const c of candidates) {
    const dx = cx(c.rect) - fx, dy = cy(c.rect) - fy;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const across = dir === 'right' || dir === 'left' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) continue;
    const score = along + 2 * across;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** The candidate nearest to a rect - where the focus was, after a redraw took the focused control away. */
export function nearestTo(rect, candidates) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.rect.x + c.rect.w / 2 - cx, c.rect.y + c.rect.h / 2 - cy);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * The loop's law over one frame, with the page behind an adapter (so it is testable without a browser):
 *   ui.candidates() -> [{el, rect}]   the controls a press could reach, in document order
 *   ui.active()     -> el | null      the focused one, when it is a candidate
 *   ui.connected(el) -> bool           still in the page (a redraw removes it)
 *   ui.focus(el), ui.press(el), ui.back(), ui.step(el, dir) -> bool (a list box or slider took the step)
 * `state` carries the edges, the repeat clock and the control last focused between frames; `now` is in ms.
 * A press that redraws the menu (every door does) takes the focused control away. For a short while after, the
 * focus goes back to the control that now stands where it stood (the redrawn rail button) - so the player carries
 * on from the button they pressed rather than from the top of the page. Nothing there by then (a new screen):
 * the next press starts from the first control, as it does on a fresh page.
 */
export const REFOCUS_MS = 500;
export const REFOCUS_SLOP = 8;   // px: the same button, redrawn
export function padDoorFrame(pad, ui, state, now) {
  const confirm = pressed(pad, PAD.A) || pressed(pad, PAD.START);
  const back = pressed(pad, PAD.B);
  const dir = padDirection(pad, state.dir);
  const focusOn = (c) => { if (c) { ui.focus(c.el); state.lastEl = c.el; state.lastRect = c.rect; state.lostAt = null; } };
  // AUDIT PAD-DOOR A5: the last focused control is gone and the PAGE put the focus somewhere (a redraw's own focus, the
  // intro's end) - that is the focus now; kept as lost, every frame walked the whole page asking who held it
  if (state.lastEl && !ui.connected(state.lastEl)) {
    const held = ui.active();
    if (held) { state.lastEl = held; state.lastRect = ui.candidates().find((c) => c.el === held)?.rect ?? null; state.lostAt = null; }
  }
  // the redraw: the last focused control is gone and nothing holds the focus
  if (state.lastEl && !ui.connected(state.lastEl) && state.lastRect && !ui.active()) {
    state.lostAt ??= now;
    const same = nearestTo(state.lastRect, ui.candidates());
    const off = same ? Math.hypot(same.rect.x - state.lastRect.x, same.rect.y - state.lastRect.y) : Infinity;
    if (off <= REFOCUS_SLOP) focusOn(same);
    else if (now - state.lostAt > REFOCUS_MS) { state.lastEl = null; state.lastRect = null; state.lostAt = null; }
  }
  if (confirm && !state.confirm) {
    const el = ui.active();
    if (el) ui.press(el);
    else focusOn(ui.candidates()[0]);
  }
  if (back && !state.back) ui.back();
  let fire = false;
  if (dir && dir !== state.dir) { fire = true; state.heldAt = now; state.lastRepeat = now; }
  else if (dir && now - state.heldAt >= REPEAT_DELAY_MS && now - state.lastRepeat >= REPEAT_MS) { fire = true; state.lastRepeat = now; }
  if (fire) {
    const el = ui.active();
    if (!el) {
      focusOn(ui.candidates()[0]);
    } else if (!((dir === 'left' || dir === 'right') && ui.step(el, dir))) {
      const all = ui.candidates();
      const from = all.find((c) => c.el === el)?.rect;
      focusOn(from ? nextFocus(from, all.filter((c) => c.el !== el), dir) : all[0]);
    }
  }
  state.confirm = confirm; state.back = back; state.dir = dir;
}

const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** The page adapter. A control counts when it is drawn, enabled, outside any inert subtree and NOT covered: its
 *  centre hits it - or, where it lives in a scrolling container (the home's list on a short screen, a settings
 *  column), the container's own centre hits the container: a list the player can scroll to, whatever covers its
 *  edge (the home's footer strip lies over the list's last rows). A window drawn over the whole list - the sign-in
 *  scrim over the home - covers that centre too, so nothing under it counts. */
export function domDoorUi(doc = globalThis.document) {
  const win = doc.defaultView;
  const scrollParent = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = win.getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth)) return p;
    }
    return null;
  };
  const reachable = (el, r) => {
    const vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x >= 0 && y >= 0 && x < vw && y < vh) {
      const hit = doc.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return true;
    }
    const sc = scrollParent(el);
    if (!sc) return false;
    const s = sc.getBoundingClientRect();
    const px = (Math.max(0, s.left) + Math.min(vw, s.right)) / 2, py = (Math.max(0, s.top) + Math.min(vh, s.bottom)) / 2;
    const hit = doc.elementFromPoint(px, py);
    return !!hit && sc.contains(hit);
  };
  const candidates = () => {
    const out = [];
    for (const el of doc.querySelectorAll(FOCUSABLE)) {
      if (el.disabled || el.closest('[inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (win.getComputedStyle(el).visibility === 'hidden') continue;
      if (!reachable(el, r)) continue;
      out.push({ el, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
    }
    return out;
  };
  return {
    candidates,
    connected: (el) => !!el?.isConnected,
    active() {
      const el = doc.activeElement;
      if (!el || el === doc.body || el === doc.documentElement) return null;
      return candidates().some((c) => c.el === el) ? el : null;
    },
    focus(el) {
      doc.querySelector('.pad-focus')?.classList.remove('pad-focus');
      try { el.focus({ preventScroll: true, focusVisible: true }); } catch { el.focus(); }
      el.classList.add('pad-focus');
      el.scrollIntoView?.({ block: 'center', inline: 'nearest' });   // centred: clear of a strip drawn over a list's edge
    },
    press(el) { el.click(); },
    back() {
      // AUDIT PAD-DOOR A2: the menu's Escape skips a key from a field (enhancedMenu.js onKey - ui/input.js
      // isTextEntryTarget's test), so B on the sign-in's name or the search box did nothing: the field lets go first
      let target = doc.activeElement ?? doc.body;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true)) { target.blur?.(); target = doc.body; }
      target.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    },
    step(el, dir) {
      const d = dir === 'right' ? 1 : -1;
      if (el.tagName === 'SELECT') {
        const i = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + d));
        if (i === el.selectedIndex) return true;
        el.selectedIndex = i;
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
        return true;
      }
      if (el.tagName === 'INPUT' && el.type === 'range') {
        if (d > 0) el.stepUp(); else el.stepDown();
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
        return true;
      }
      return false;
    },
  };
}

const PAD_FOCUS_CSS = '.pad-focus { outline: 2px solid #d9b25a !important; outline-offset: 2px !important; }';

/** Start the door's pad loop; answers the detach. Nothing happens until a pad is pressed - a page with no pad polls
 *  an empty list once a frame and does nothing. */
export function attachMenuPad({ doc = globalThis.document, getPads = () => globalThis.navigator?.getGamepads?.() ?? [] } = {}) {
  const win = doc?.defaultView;
  if (!win || typeof win.requestAnimationFrame !== 'function') return () => {};
  const ui = domDoorUi(doc);
  const style = doc.createElement('style');
  style.textContent = PAD_FOCUS_CSS;
  doc.head.append(style);
  const state = { confirm: false, back: false, dir: null, heldAt: 0, lastRepeat: 0, lastEl: null, lastRect: null, lostAt: null };
  let raf = 0, live = true;
  const loop = () => {
    if (!live) return;
    let pad = null;
    try { pad = pickDoorPad(getPads()); } catch { pad = null; }
    if (pad) padDoorFrame(pad, ui, state, win.performance?.now?.() ?? Date.now());
    raf = win.requestAnimationFrame(loop);
  };
  raf = win.requestAnimationFrame(loop);
  return () => {
    live = false;
    win.cancelAnimationFrame(raf);
    style.remove();
    doc.querySelector('.pad-focus')?.classList.remove('pad-focus');
  };
}
