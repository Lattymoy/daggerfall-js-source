// JOURNAL1 (2026-09-23, the community arc - Addison Knox: "Player journals ... shared in-world for storytelling"): THE
// PAGE ANOTHER PLAYER HELD OUT - a card in the middle of the screen, opened from the F-menu's "Read their page" row
// when I turn to them. Nothing opens it on its own: a page held out WAITS (net/journalPage.js PageOffers), because a
// window that opened over my game whenever somebody near me pressed a button would be theirs to open, not mine.
//
// WHAT IT SAYS: whose journal it is (the name the room knows them by), the date and place they wrote it (the entry's
// own head, their word), and the page as their notebook laid it out, a blank line where it broke. Every word came off
// another player's keyboard and is written with textContent; the wire's page law cleaned it first (net/wire.js
// pageLaw), and the sheet breaks a word too long for the card rather than letting it run out of it.
//
// WHAT IT OFFERS: to KEEP the page in my own journal - a note, dated where and when I kept it, that says whose it was
// (net/journalPage.js keptPageTokens) - once; and to put it away.
//
// IT IS A POINTER SURFACE, like the profile beside it (ui/profileWindow.js, whose shape this is): the host frees the
// pointer on the open and takes it back on the close; one capture listener takes one key - Escape closes - unless a
// surface stands over this one; a press inside the card is the card's, never a swing.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { isTextEntryTarget } from './input.js';
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';

export const PAGE_STYLE_ID = 'dagger-page-style';

/** The window's words - the one place they live. */
export const PAGE_KEEP_TEXT = 'Keep in my journal';
export const PAGE_KEPT_TEXT = 'Kept in your journal';
export const PAGE_CLOSE_TEXT = 'Put it away';

/**
 * THE VIEW, pure: whose page it is, and the page (net/wire.js pageLaw's shape). `kept` once it is in my journal;
 * `canKeep` false where the host has no journal to keep it in. The page and the name ride along, so a Keep files the
 * page the card SHOWS, under the name it shows - whether or not its writer is still in the room.
 */
export function pageView({ name = null, page = null, kept = false, canKeep = true } = {}) {
  const who = (typeof name === 'string' && name) ? name : 'Someone';
  return {
    title: `${who}'s journal`,
    head: page?.head || null,
    lines: Array.isArray(page?.lines) ? page.lines : [],
    kept: !!kept,
    canKeep: !!canKeep,
    name: who,
    page,
  };
}

/** The card's sheet - the profile's pairing: the enhanced tokens where the skin's sheet is loaded, a fallback where it
 *  is not, the skin's own pixel face (FONT1). Its prefix is `dfpage`, a surface of its own (AUDIT SOC C1's lesson). The
 *  page itself is the lighter leaf inside the card, and it scrolls within it, so the buttons stand at the card's foot
 *  whatever the page's length. */
export const PAGE_CSS = `
${PIXELIFY_FIVE_FACE}
.dfpage { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 7; display: none;
  width: min(520px, calc(100vw - 28px)); pointer-events: none; ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfpage[data-state="open"] { display: block; }
.dfpage-card { pointer-events: auto; background: rgba(14, 16, 19, .94); border: 1px solid var(--iron, #2b323b); border-radius: 6px;
  backdrop-filter: blur(4px); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;
  max-height: calc(100vh - 28px); }
.dfpage-card:focus { outline: none; }
.dfpage-head { flex: none; text-align: center; }
.dfpage-title { font-size: 18px; line-height: 1.3; overflow-wrap: anywhere; }
.dfpage-when { font-size: 12px; color: var(--dim, #8b8578); line-height: 1.4; overflow-wrap: anywhere; }
.dfpage-leaf { flex: 0 1 auto; min-height: 0; overflow-y: auto; background: rgba(233, 228, 217, .06); border: 1px solid var(--iron, #2b323b);
  border-radius: 3px; padding: 10px 12px; }
.dfpage-line { margin: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; min-height: 1.5em; }
.dfpage-note { flex: none; font-size: 12px; font-style: italic; color: #c8c2b4; text-align: center; }
.dfpage-acts { flex: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.dfpage-btn { flex: 0 1 auto; min-width: 120px; min-height: 44px; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9);
  border: 0; border-radius: 3px; font: inherit; font-size: 14px; padding: 6px 12px; cursor: pointer; text-align: center; }
.dfpage-btn:hover:not(:disabled) { background: var(--brass, #c08a3e); color: var(--ink, #0e1013); }
.dfpage-btn:disabled { opacity: .6; cursor: default; }
`;

export function injectPageStyle(doc = document) {
  if (!doc?.getElementById || doc.getElementById(PAGE_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = PAGE_STYLE_ID;
  s.textContent = PAGE_CSS;
  (doc.head ?? doc.body)?.append(s);
}

/**
 * The card over the document. `canOpen()` is the host's word on whether a surface may stand (the F-menu's gate),
 * `onOpen`/`onClose` its pointer door, `onKeep(peerId, view)` keeps the page the card shows in my journal and answers
 * whether it did, `above()` whether a surface stands over this one (then Escape is not ours).
 */
export function createPageWindow({ canOpen = () => true, onOpen = null, onClose = null, onKeep = null, above = () => false, doc = document, win = globalThis } = {}) {
  injectPageStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', 'dfpage');
  root.dataset.state = 'closed';
  const card = el('div', 'dfpage-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'dfpage-title-node');
  card.setAttribute('tabindex', '-1');
  root.append(card);
  doc.body?.append(root);

  let alive = true;
  let open = false;
  let shownPeer = null;
  let view = null;

  const paint = () => {
    card.replaceChildren();
    const head = el('div', 'dfpage-head');
    const title = el('div', 'dfpage-title', view.title);
    title.id = 'dfpage-title-node';
    head.append(title);
    if (view.head) head.append(el('div', 'dfpage-when', view.head));
    card.append(head);
    const leaf = el('div', 'dfpage-leaf');
    for (const line of view.lines) leaf.append(el('p', 'dfpage-line', line));   // a blank line keeps its height: the break between two paragraphs
    card.append(leaf);
    if (view.kept) card.append(el('div', 'dfpage-note', 'A copy is in your journal, under Notes.'));
    const acts = el('div', 'dfpage-acts');
    if (view.canKeep) {
      const keep = el('button', 'dfpage-btn', view.kept ? PAGE_KEPT_TEXT : PAGE_KEEP_TEXT);
      keep.type = 'button';
      keep.disabled = view.kept;
      keep.addEventListener('click', () => {
        if (!view || view.kept || !shownPeer) return;
        if (onKeep?.(shownPeer, view) !== true) return;
        view = { ...view, kept: true };
        paint();
      });
      acts.append(keep);
    }
    const close = el('button', 'dfpage-btn', PAGE_CLOSE_TEXT);
    close.type = 'button';
    close.addEventListener('click', () => { hide(); });
    acts.append(close);
    card.append(acts);
  };

  const hide = () => {
    if (!alive || !open) return false;
    open = false;
    shownPeer = null;
    view = null;
    root.dataset.state = 'closed';
    onClose?.();   // the host takes the pointer back - inside the gesture that closed
    return true;
  };

  /** Stand the card for one writer's page. False when the host will not have a surface now, or there is no page. */
  const show = (peerId, v) => {
    if (!alive || !peerId || !v || !canOpen()) return false;
    view = v;
    shownPeer = peerId;
    paint();
    const was = open;
    open = true;
    root.dataset.state = 'open';
    card.focus?.();
    if (!was) onOpen?.();   // the pointer freed on the OPEN alone
    return true;
  };

  const onKey = (e) => {
    if (!open) return;
    if (isTextEntryTarget(e.target)) return;
    if (e.code !== 'Escape') return;
    if (above()) return;   // a surface over this one owns the key - untouched, unstopped
    e.preventDefault();
    e.stopImmediatePropagation();
    hide();
  };
  win.addEventListener('keydown', onKey, true);
  // a PRESS inside the card is the card's - never a swing or a look; a RELEASE is never stopped (AUDIT CHAT C5)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) card.addEventListener(t, swallow);

  return {
    root,
    show, hide,
    isOpen: () => open,
    /** Whose page the card stands for. */
    peerId: () => shownPeer,
    /** THE HOST'S FRAME: a window over the HUD or a pause takes the card away with it, as it takes the F-menu. */
    render({ covered = false } = {}) {
      if (!alive) return;
      if (covered && open) hide();
    },
    destroy() {
      if (!alive) return;
      alive = false;
      open = false;
      win.removeEventListener('keydown', onKey, true);
      root.remove?.();
    },
  };
}
