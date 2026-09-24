// DUEL1 (2026-09-24, Mac: "When inspecting a player, they should be able to send an invite to duel"): THE CHALLENGE, AS
// THE CHALLENGED PLAYER SEES IT - a strip at the top of the screen, the party invitation's own shape (ui/socialPanel.js's
// toast): who challenges, how long is left to answer, Accept and Decline. The strip takes no pointer but its two buttons,
// so it never stands between the player and the world; with the pointer held by the game the chat's line says the other
// way to answer (turn to them and press the F-menu's key: 'Accept duel' / 'Decline duel').
//
// It shows the NEWEST standing challenge and goes away the moment the duel law no longer holds it (`asks()` - answered,
// lapsed, taken back, or a duel begun), so it can never stand for something that is no longer true. Handed the document
// and the window so the pins drive it headless.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { DUEL_ASK_TTL_MS } from '../net/duelSession.js';

export const DUEL_PROMPT_STYLE_ID = 'dagger-duel-prompt-style';
export const DUEL_PROMPT_CSS = `
.dfduel-toast { position: fixed; left: 50%; transform: translateX(-50%); top: calc(8px + env(safe-area-inset-top, 0px));
  z-index: 8; display: none; align-items: center; gap: 10px; padding: 8px 12px; pointer-events: none;
  background: rgba(24, 12, 14, .94); border: 1px solid #7a3b3b; border-radius: 6px; color: #e9e4d9;
  font-family: inherit; max-width: calc(100vw - 24px); box-sizing: border-box; }
.dfduel-toast[data-up="1"] { display: flex; }
.dfduel-who { display: flex; flex-direction: column; min-width: 0; }
.dfduel-name { font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
.dfduel-sub { font-size: 12px; color: #b9a99a; line-height: 1.3; }
.dfduel-btn { pointer-events: auto; min-height: 32px; padding: 4px 12px; border-radius: 3px; border: 1px solid #7a3b3b;
  background: #3a2226; color: #e9e4d9; font: inherit; font-size: 13px; cursor: pointer; }
.dfduel-btn:hover { background: #b8483f; color: #0e1013; }
.dfduel-toast.touch .dfduel-btn { min-height: 44px; padding: 8px 12px; }
`;

/** The strip's second line: the seconds left to answer, whole and never below one while it stands. */
export function duelPromptSub(msLeft) {
  const s = Math.max(1, Math.ceil((Number.isFinite(msLeft) ? msLeft : 0) / 1000));
  return `Answer within ${s}s`;
}

/**
 * @param {object} o
 * @param {() => { peer: string, at: number }[]} o.asks  the duel law's standing challenges, newest first
 * @param {(peer: string) => any} o.accept
 * @param {(peer: string) => any} o.decline
 * @param {(peer: string) => string} o.name
 * @param {() => number} o.now  the duel law's own clock
 * @param {boolean} [o.touch]
 * @param {Document} [o.doc]
 */
export function createDuelPrompt({ asks, accept, decline, name, now, touch = false, doc = document }) {
  if (doc?.getElementById && !doc.getElementById(DUEL_PROMPT_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = DUEL_PROMPT_STYLE_ID;
    st.textContent = DUEL_PROMPT_CSS;
    (doc.head ?? doc.body)?.append(st);
  }
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', `dfduel-toast${touch ? ' touch' : ''}`);
  root.dataset.up = '0';
  const who = el('div', 'dfduel-who');
  const nm = el('div', 'dfduel-name');
  const sub = el('div', 'dfduel-sub');
  who.append(nm, sub);
  const yes = el('button', 'dfduel-btn', 'Accept'); yes.type = 'button';
  const no = el('button', 'dfduel-btn', 'Decline'); no.type = 'button';
  root.append(who, yes, no);
  doc.body?.append(root);
  let shown = null;   // the peer the strip stands for
  let alive = true;
  const swallow = (e) => e.stopPropagation();   // a press on the strip is the strip's - never a swing
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) root.addEventListener(t, swallow);
  const answer = (fn) => { const p = shown; if (!p) return; try { fn(p); } finally { paint(); } };
  yes.addEventListener('click', () => answer(accept));
  no.addEventListener('click', () => answer(decline));
  const paint = () => {
    if (!alive) return;
    let list = [];
    try { list = asks() ?? []; } catch { list = []; }
    const top = list[0] ?? null;
    shown = top ? top.peer : null;
    const up = !!top;
    if (root.dataset.up !== (up ? '1' : '0')) root.dataset.up = up ? '1' : '0';
    if (!up) return;
    const line = `${name(top.peer) || 'Someone'} challenges you to a duel`;
    if (nm.textContent !== line) nm.textContent = line;
    const s = duelPromptSub(DUEL_ASK_TTL_MS - (now() - top.at));
    if (sub.textContent !== s) sub.textContent = s;
  };
  return {
    root,
    /** The host's frame (and the duel law's onChange): stand for the newest challenge, or go. */
    render: paint,
    /** Which peer the strip stands for, or null. */
    peer: () => shown,
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}
