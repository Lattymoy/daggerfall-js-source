// @ts-check
// HOTFIX 1003f (2026-10-03, the owner, live: "the arena button for the host needs to be on the screen. Not inside the
// pause menu"): THE SESSION'S BUTTON - while a private session holds this screen (ARENA6, scenes/arena/arenaOnline.js
// inSession), a button stands on the screen and the / key (which no game action holds - systems/inputActions.js; the
// stands took + and -, ui/arena/arenaHud.js) opens the Arena window on its Bouts page: the session's card, its code, its
// members, Make Red / Make Blue and Start bout. Hidden under any window and with the HUD toggled off. A press on it is
// its own - never a swing, never the pointer's lock. One element, made the first time it is shown.

/** The key that opens the window while a session holds this screen (`KeyboardEvent.code`). */
export const ARENA_SESSION_KEY = 'Slash';
/** The button's words. */
export const ARENA_SESSION_LABEL = 'Arena';
/** The key as the button names it. */
export const ARENA_SESSION_KEY_TEXT = '/';
const STYLE_ID = 'arena-session-btn-style';
const CSS = `
.arena-session-btn { position: fixed; top: 64px; right: 12px; z-index: 12; display: flex; gap: 6px; align-items: center;
  padding: 6px 12px; font: 600 13px/1.2 system-ui, sans-serif; color: #f1e6c8; background: rgba(28, 22, 14, 0.82);
  border: 1px solid #8a7444; border-radius: 4px; cursor: pointer; pointer-events: auto; }
.arena-session-btn:hover, .arena-session-btn:focus-visible { background: rgba(58, 44, 22, 0.92); outline: 1px solid #d9b45a; }
.arena-session-btn[hidden] { display: none; }
.arena-session-btn .arena-session-key { font-size: 11px; padding: 0 4px; border: 1px solid #5a5446; opacity: 0.85; }
`;

/**
 * The button and its key. `open()` the host's door to the Arena window (answers whether it opened); `frame(show)` each
 * frame - shown while a session holds this screen and nothing stands over it.
 * @param {{ open: () => any, doc?: any }} deps
 */
export function createArenaSessionButton({ open, doc = globalThis.document }) {
  let btn = null, shown = false, listening = false;
  const win = doc?.defaultView ?? globalThis;
  const onKey = (e) => {
    if (!shown || !e || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.code !== ARENA_SESSION_KEY) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(String(t.tagName ?? '')))) return;   // never in a field
    e.preventDefault?.();
    open();
  };
  const make = () => {
    if (btn || !doc?.createElement || !doc.body) return btn;
    if (doc.getElementById && !doc.getElementById(STYLE_ID)) {
      const st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      doc.head?.append?.(st);
    }
    btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'arena-session-btn';
    btn.setAttribute('aria-label', `${ARENA_SESSION_LABEL} (${ARENA_SESSION_KEY_TEXT})`);
    const word = doc.createElement('span');
    word.textContent = ARENA_SESSION_LABEL;
    const key = doc.createElement('span');
    key.className = 'arena-session-key';
    key.textContent = ARENA_SESSION_KEY_TEXT;
    btn.append(word, key);
    const swallow = (e) => { e?.stopPropagation?.(); };   // the button's press is its own - never a swing, never the lock
    btn.addEventListener('mousedown', swallow);
    btn.addEventListener('pointerdown', swallow);
    btn.addEventListener('click', (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); open(); });
    btn.hidden = true;
    doc.body.append(btn);
    return btn;
  };
  return {
    /** Shown (`show`) or hidden, this frame. */
    frame(show) {
      const on = !!show;
      if (on === shown) return;
      shown = on;
      if (on) make();
      if (btn) btn.hidden = !on;
      if (on && !listening && typeof win?.addEventListener === 'function') { win.addEventListener('keydown', onKey); listening = true; }
      else if (!on && listening) { win.removeEventListener?.('keydown', onKey); listening = false; }
    },
    get shown() { return shown; },
    dispose() {
      if (listening) { win.removeEventListener?.('keydown', onKey); listening = false; }
      btn?.remove?.();
      btn = null;
      shown = false;
    },
  };
}
