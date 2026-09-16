// CHAT1 (2026-09-12, Mac: "I want to add a new UI element. The live chat
// in enhanced format. Players will be able to type and chat live with
// other players. Currently I just want one world tab with the ability
// to add more tabs at a later time"): THE PANEL - the enhanced skin's
// DOM chat, top-left over the world, under the touch layer's corner
// buttons.
//
// TWO STATES. Closed: the active tab's last few lines stand over the
// world and fade (net/chat.js peek), with a one-word hint (Enter) or,
// on a touch device, a button. Open: a tab bar (one tab per row of
// CHAT_TABS - the World tab alone today - a badge on each with unread
// lines), the tab's lines, and the field. Enter opens the panel and
// puts the caret in the field; Enter in the field sends the line and
// closes the panel (the MMO gesture: type, send, back to the world);
// an empty Enter and Escape close it. The touch layer's Send keeps the
// panel open (a thumb typed it; the next line is likely).
//
// THE KEYS ARE THE FIELD'S (CG2). One capture listener on the window,
// alive while the panel exists: a key typed into the field is stopped
// there, so the host's ring (scenes/world.js `keys.add`) never fills
// from a chat line and typing 'w' walks no one - the browser's own
// reload keys stay swallowed (ui/input.js swallowBrowserKey) so F5 in
// the field does not destroy the session. The key UP is not stopped:
// a key held when the panel opened leaves the ring the moment it is
// released. Enter opens the panel only when no enhanced overlay is up
// (enhancedOverlays), no other field owns the key, the host says the
// game is not paused (canOpen), and the event is the keyboard's own -
// the touch layer's ⏎ button synthesizes an untrusted Enter for the
// windows it drives, and that one must not open the chat.
//
// THE MOUSE IS THE PANEL'S. The host adds every window mousedown to
// its ring and swings on the left button outdoors; a PRESS inside the
// open box is stopped at the box, so tapping Send draws no weapon. A
// RELEASE is never stopped (AUDIT CHAT C5): the host's mouseup clears
// its ring, and a press begun on the canvas and let go over the box
// must still let go, or the weapon swings until the next click.
//
// AUDIT CHAT (2026-09-12, before the merge). The open key is the
// ActivateCursor binding (Enter by default), resolved through the
// registry, not a literal (C4: the panel was eating DFU's cursor key
// at the window, and its own key could not be rebound); opening frees
// the pointer and closing takes it back inside the same gesture (C2:
// the panel opened under pointer lock, so the mouse kept looking and
// swinging while the player typed and nothing in the box could be
// clicked - the hosts' onOpen/onClose); an Enter that commits an IME
// candidate is the IME's (C3: the first Enter of every Japanese word
// shipped the half-composed line); a held Enter opens once and its
// repeats send nothing (C6); Tab stays in the field (C7: it walked
// focus onto Send and gave the keyboard back to the game); the list
// grows by the lines that arrived and keeps a reader's scroll (C8);
// the root is no live region (C9: every repaint re-announced the
// whole panel); a refused line keeps the field and the panel (B2); a
// name carries a tag from the guarded id (A5); the dial counts as an
// overlay (C1, in pixelDial.js) and an open overlay hides the panel.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { isTextEntryTarget, swallowBrowserKey, bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';
import { overlayOpen } from './enhancedOverlays.js';
import { isTouchDevice } from './touch.js';
import { CHAT_MAX } from '../net/wire.js';
import { tagOf } from '../net/chat.js';
import { rosterRows, rosterTitle, ROSTER_ROWS_MAX } from '../net/roster.js';   // CHAT-R1: who is online, in order
import { getPref, setPref } from '../systems/uiPrefs.js';   // CHAT-R2: the hidden state outlives the session

/** The action whose key opens the chat: DFU's own cursor key (Enter by default), since opening frees the cursor. */
export const CHAT_OPEN_ACTION = 'ActivateCursor';

export const CHAT_STYLE_ID = 'dagger-chat-style';

/** The panel's sheet: the enhanced tokens (enhancedStyle.js) where they exist, a fallback where the skin's sheet is not loaded. */
export const CHAT_CSS = `
.dfchat { position: fixed; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(44px + env(safe-area-inset-top, 0px));
  width: min(440px, calc(100vw - 28px)); z-index: 5; pointer-events: none;
  font-family: var(--data, 'Barlow Semi Condensed', system-ui, sans-serif); color: var(--bone, #e9e4d9); }
.dfchat.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
.dfchat-peek { display: flex; flex-direction: column; gap: 3px; }
.dfchat-line { flex: none; font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; overflow: hidden; text-shadow: 0 1px 2px #000, 0 0 6px rgba(0,0,0,.85); }
.dfchat-name { color: var(--brass, #c08a3e); font-weight: 600; }
.dfchat-tag { color: var(--dim, #8b8578); font-size: 11px; margin: 0 6px 0 2px; }
.dfchat-line.mine .dfchat-name { color: #dcc27c; }
.dfchat-time { color: var(--dim, #8b8578); font-size: 11px; margin-right: 6px; }
.dfchat-hint { margin-top: 4px; font-size: 12px; color: var(--dim, #8b8578); opacity: .75; text-shadow: 0 1px 2px #000; }
.dfchat-status { margin-top: 4px; font-size: 12px; color: #e0b070; text-shadow: 0 1px 2px #000; }
.dfchat-status:empty { display: none; }
.dfchat-open { display: none; pointer-events: auto; margin-top: 4px; align-items: center; gap: 6px; }
.dfchat.touch .dfchat-open { display: inline-flex; }
.dfchat.touch .dfchat-hint { display: none; }
.dfchat-box { display: none; pointer-events: auto; background: rgba(14, 16, 19, .84); border: 1px solid var(--iron, #2b323b); border-radius: 6px; backdrop-filter: blur(4px); }
.dfchat[data-state="open"] .dfchat-box { display: flex; flex-direction: column; }
.dfchat[data-state="open"] .dfchat-peek, .dfchat[data-state="open"] .dfchat-hint, .dfchat[data-state="open"] .dfchat-open { display: none; }
.dfchat-tabs { display: flex; gap: 2px; padding: 4px 4px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfchat-tab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--dim, #8b8578); font: inherit; font-size: 13px;
  letter-spacing: .05em; text-transform: uppercase; padding: 6px 10px; cursor: pointer; }
.dfchat-tab.active { color: var(--bone, #e9e4d9); border-bottom-color: var(--brass, #c08a3e); }
.dfchat-badge { margin-left: 6px; background: var(--brass, #c08a3e); color: var(--ink, #0e1013); border-radius: 8px; padding: 0 6px; font-size: 11px; }
.dfchat-badge:empty { display: none; }
.dfchat-list { height: min(220px, 34vh); overflow-y: auto; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; }
.dfchat-list .dfchat-line { text-shadow: none; }
.dfchat-form { display: flex; gap: 4px; padding: 6px; border-top: 1px solid var(--iron, #2b323b); }
.dfchat-input { flex: 1; min-width: 0; background: var(--ink, #0e1013); color: var(--bone, #e9e4d9); border: 1px solid var(--iron, #2b323b); border-radius: 3px; padding: 6px 8px; font: inherit; font-size: 14px; }
.dfchat-input:focus { outline: 1px solid var(--brass, #c08a3e); }
.dfchat-send, .dfchat-close, .dfchat-open, .dfchat-hide, .dfchat-show { background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit; font-size: 14px; padding: 6px 10px; cursor: pointer; }

/* CHAT-R2: THE BOX IS TWO COLUMNS - the conversation and who is in it.
   The roster is a SIBLING of the list rather than a floating panel, so
   it scrolls on its own and the box keeps one border and one corner
   radius however long either column gets. */
.dfchat-cols { display: flex; min-height: 0; }
.dfchat-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dfchat-who { flex: none; width: 132px; border-left: 1px solid var(--iron, #2b323b); display: flex; flex-direction: column; min-height: 0; }
.dfchat-whohead { flex: none; padding: 6px 8px 4px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #8b8578); }
.dfchat-wholist { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 6px; display: flex; flex-direction: column; gap: 1px; }
.dfchat-who-row { font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; color: var(--bone, #e9e4d9); }
.dfchat-who-row.me .dfchat-who-name { color: #dcc27c; }
.dfchat-who-name { font-weight: 600; }
.dfchat-who-tag { color: var(--dim, #8b8578); font-size: 10px; margin-left: 4px; }
.dfchat-who-more { font-size: 11px; color: var(--dim, #8b8578); padding-top: 4px; }
/* the roster is the first thing to go when there is no width for it */
@media (max-width: 560px) { .dfchat-who { display: none; } }

/* CHAT-R2: HIDDEN. Not display:none on the root - the panel must
   keep its listeners and its log - but every VISIBLE part away, with
   one small control left to bring it back. */
.dfchat-hide { padding: 2px 8px; font-size: 12px; }
.dfchat-show { display: none; pointer-events: auto; align-self: flex-start; font-size: 12px; padding: 4px 10px; }
.dfchat[data-hidden="1"] .dfchat-peek,
.dfchat[data-hidden="1"] .dfchat-hint,
.dfchat[data-hidden="1"] .dfchat-open,
.dfchat[data-hidden="1"] .dfchat-status,
.dfchat[data-hidden="1"] .dfchat-box { display: none; }
.dfchat[data-hidden="1"] .dfchat-show { display: inline-flex; }
`;

/** The sheet, once. */
export function injectChatStyle(doc = document) {
  if (doc.getElementById?.(CHAT_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = CHAT_STYLE_ID;
  el.textContent = CHAT_CSS;
  (doc.head ?? doc.body).append(el);
}

/** HH:MM of a stamp, for the open list. */
export const clockOf = (at) => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** The action a keydown resolves to through the registry (the default; the tests hand their own in). */
export const actionOfKey = (e) => actionForCode(bindings(), e.code);

/** Is this keydown the one that opens the panel: the cursor key (CHAT_OPEN_ACTION), unmodified, not a repeat,
 *  the keyboard's own, owned by no field and no overlay, the host willing? */
export function isOpenKey(e, { canOpen = () => true, overlay = overlayOpen, action = actionOfKey } = {}) {
  return action(e) === CHAT_OPEN_ACTION && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat && e.isTrusted !== false
    && !isTextEntryTarget(e.target) && !overlay() && !!canOpen();
}

/**
 * The panel over `log` (net/chat.js). `onSend(tabId, text)` takes a
 * typed line and answers false when it did not go (the field keeps
 * it); `canOpen()` is the host's word on whether the game can take a
 * chat right now; `onOpen`/`onClose` are the host's pointer-lock door
 * (release on open, take back on close - inside the gesture). Handed
 * the document and the window so the tests drive it headless.
 */
export function createChatPanel({ log, onSend, roster = null, canOpen = () => true, onOpen = null, onClose = null, action = actionOfKey, overlay = overlayOpen, doc = document, win = globalThis, touch = isTouchDevice() } = {}) {
  injectChatStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', `dfchat${touch ? ' touch' : ''}`);
  root.dataset.state = 'closed';
  const peek = el('div', 'dfchat-peek');
  const hint = el('div', 'dfchat-hint', 'Enter to chat');
  const status = el('div', 'dfchat-status');
  const openBtn = el('button', 'dfchat-open', 'Chat');
  openBtn.type = 'button';
  const badgeOut = el('span', 'dfchat-badge');
  openBtn.append(badgeOut);
  const box = el('div', 'dfchat-box');
  box.setAttribute('role', 'log');
  const tabs = el('div', 'dfchat-tabs');
  const list = el('div', 'dfchat-list');
  const form = el('form', 'dfchat-form');
  const input = el('input', 'dfchat-input');
  input.type = 'text'; input.maxLength = CHAT_MAX; input.placeholder = 'Say something'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label', 'Chat');
  const send = el('button', 'dfchat-send', 'Send'); send.type = 'submit';
  const close = el('button', 'dfchat-close', '✕'); close.type = 'button';
  close.setAttribute('aria-label', 'Close chat');
  const hide = el('button', 'dfchat-hide', 'Hide'); hide.type = 'button';
  hide.setAttribute('aria-label', 'Hide chat');
  const show = el('button', 'dfchat-show', 'Chat'); show.type = 'button';
  show.setAttribute('aria-label', 'Show chat');
  form.append(input, send, hide, close);
  // CHAT-R2: the two columns. `main` holds what was there before, so
  // nothing about the list, the tabs or the form moved; `who` is new
  // beside it and scrolls on its own.
  const cols = el('div', 'dfchat-cols');
  const main = el('div', 'dfchat-main');
  const who = el('div', 'dfchat-who');
  const whoHead = el('div', 'dfchat-whohead', rosterTitle(0));
  const whoList = el('div', 'dfchat-wholist');
  const whoMore = el('div', 'dfchat-who-more');
  who.append(whoHead, whoList, whoMore);
  const tabButtons = new Map();
  for (const tab of log.tabs) {
    const b = el('button', 'dfchat-tab', tab.label);
    b.type = 'button'; b.dataset.tab = tab.id;
    const badge = el('span', 'dfchat-badge');
    b.append(badge);
    b.addEventListener('click', () => { log.select(tab.id); paint(); input.focus?.(); });
    tabs.append(b);
    tabButtons.set(tab.id, { b, badge });
  }
  main.append(list, form);
  cols.append(main, who);
  box.append(tabs, cols);
  root.append(peek, hint, status, openBtn, show, box);
  doc.body.append(root);

  let painted = -1;
  let peekNodes = [];
  let listNodes = [];      // the open list's rows, in order: [{ seq, node }] - grown, not rebuilt (AUDIT CHAT C8)
  let listTab = null;
  let alive = true;
  // CHAT-R2: hidden across sessions - a player who puts the chat away
  // wants it away next time too, not one reload later.
  let hidden = getPref('chatHidden') === true;
  let whoRows = [];        // the drawn rows, keyed so an unchanged roster repaints nothing
  let whoKey = '';

  const lineNode = (line, withTime) => {
    const n = el('div', `dfchat-line${line.mine ? ' mine' : ''}`);
    if (withTime) n.append(el('span', 'dfchat-time', clockOf(line.at)));
    n.append(el('span', 'dfchat-name', line.name || '?'), el('span', 'dfchat-tag', `#${tagOf(line.id)}`), el('span', 'dfchat-text', line.text));
    return n;
  };

  /** The open list: the rows that left the cap dropped from the front, the rows that arrived appended at the
   *  back, and the scroll kept where the reader had it unless it sat at the bottom (AUDIT CHAT C8: every line
   *  rebuilt two hundred rows and yanked a reader who had scrolled up). A tab change rebuilds. */
  const paintList = () => {
    const tab = log.tab(log.active);
    const msgs = tab ? tab.messages : [];
    const atBottom = !listNodes.length || (list.scrollHeight - list.scrollTop - (list.clientHeight ?? 0)) <= 8;
    const contiguous = listTab === log.active && listNodes.length && msgs.length && msgs.some((m) => m.seq === listNodes[listNodes.length - 1].seq);
    if (!contiguous) {
      listNodes = msgs.map((line) => ({ seq: line.seq, node: lineNode(line, true) }));
      list.replaceChildren(...listNodes.map((r) => r.node));
    } else {
      while (listNodes.length && listNodes[0].seq < msgs[0].seq) listNodes.shift().node.remove();
      const lastSeq = listNodes.length ? listNodes[listNodes.length - 1].seq : -1;
      for (const line of msgs) if (line.seq > lastSeq) { const row = { seq: line.seq, node: lineNode(line, true) }; listNodes.push(row); list.append(row.node); }
    }
    listTab = log.active;
    if (atBottom) list.scrollTop = list.scrollHeight ?? 0;
  };

  /**
   * CHAT-R1/R2: WHO IS HERE. The order is net/roster.js's, not this
   * file's - the panel only draws it.
   *
   * REPAINTED ON A CHANGE, NOT EVERY FRAME. `render` runs each frame
   * and a peer's pose moves constantly, so the rows are keyed by what
   * is actually DRAWN (id, name, self) and an unchanged key touches no
   * DOM at all. Without that, a reader's scroll in this column would
   * be fighting a rebuild sixty times a second.
   */
  const paintWho = () => {
    if (!roster) { who.style.display = 'none'; return; }
    const { rows, total, shown } = rosterRows(roster());
    const key = total + '|' + rows.map((r) => r.id + ':' + r.name + ':' + (r.me ? 1 : 0)).join(',');
    if (key === whoKey) return;
    whoKey = key;
    whoHead.textContent = rosterTitle(total);
    whoRows = rows.map((r) => {
      const n = el('div', 'dfchat-who-row' + (r.me ? ' me' : ''));
      n.append(el('span', 'dfchat-who-name', r.name), el('span', 'dfchat-who-tag', '#' + r.tag));
      return n;
    });
    whoList.replaceChildren(...whoRows);
    // a cut list says so rather than quietly under-reporting the room
    whoMore.textContent = total > shown ? '+' + (total - shown) + ' more' : '';
  };

  const paint = () => {
    painted = log.version;
    root.dataset.state = log.open ? 'open' : 'closed';
    root.dataset.hidden = hidden ? '1' : '0';
    for (const tab of log.tabs) {
      const t = tabButtons.get(tab.id);
      t.b.className = `dfchat-tab${tab.id === log.active ? ' active' : ''}`;
      t.badge.textContent = tab.unread ? String(tab.unread) : '';
    }
    const unread = log.unreadTotal();
    badgeOut.textContent = unread ? String(unread) : '';
    if (log.open) { paintList(); paintWho(); }
    peekNodes = [];
    peek.replaceChildren();
  };

  /** The closed state's lines: rebuilt when the set changes, their alpha stepped every frame. */
  const paintPeek = () => {
    const shown = log.open ? [] : log.peek();
    if (shown.length !== peekNodes.length || shown.some((p, i) => peekNodes[i].line !== p.line)) {
      peekNodes = shown.map((p) => ({ line: p.line, node: lineNode(p.line, false), alpha: -1 }));
      peek.replaceChildren(...peekNodes.map((p) => p.node));
    }
    for (let i = 0; i < shown.length; i++) {
      const a = Math.round(shown[i].alpha * 20) / 20;
      if (peekNodes[i].alpha !== a) { peekNodes[i].alpha = a; peekNodes[i].node.style.opacity = String(a); }
    }
  };

  const open = () => {
    if (!alive || log.open || !canOpen()) return false;
    log.setOpen(true);
    paint();
    input.focus?.();
    onOpen?.();   // the host frees the pointer (C2) - inside the gesture that opened
    return true;
  };
  const closePanel = () => {
    if (!alive || !log.open) return false;
    log.setOpen(false);
    input.blur?.();
    paint();
    onClose?.();   // and takes it back - inside the gesture that closed, the only place a lock request is honoured
    return true;
  };
  /** The field's line out; a line the host could not send (no socket, over the rate) stays in the field and the panel stays up (B2). */
  const submit = ({ keep = false } = {}) => {
    const text = String(input.value ?? '');
    if (text.trim() && onSend?.(log.active, text) === false) return;
    input.value = '';
    if (!keep) closePanel();
  };

  const onKey = (e) => {
    if (e.target === input) {
      // the field's key (CG2): stopped here, so the host's ring never fills from a chat line
      if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }   // C3: the IME's own Enter commits a candidate, not a line
      if (e.code === 'Escape') { e.preventDefault(); closePanel(); }
      else if (e.code === 'Enter' && !e.shiftKey && !e.repeat) { e.preventDefault(); submit(); }   // C6: a held Enter opened once; its repeats send nothing
      else if (e.code === 'Tab') e.preventDefault();   // C7: focus stays in the field - Tab walked it onto Send and gave the keyboard back to the game
      else swallowBrowserKey(e);
      e.stopPropagation();
      return;
    }
    if (log.open) {
      // open but the caret wandered (a tap on the canvas): the open key brings it back rather than reaching the game
      if (action(e) === CHAT_OPEN_ACTION && e.isTrusted !== false && !isTextEntryTarget(e.target)) { e.preventDefault(); e.stopPropagation(); input.focus?.(); }
      return;
    }
    if (hidden) return;   // CHAT-R2: put away means put away - the key does not pull it back
    if (isOpenKey(e, { canOpen, overlay, action })) { e.preventDefault(); e.stopPropagation(); open(); }
  };
  win.addEventListener('keydown', onKey, true);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit({ keep: touch }); });
  close.addEventListener('click', () => closePanel());
  openBtn.addEventListener('click', () => open());

  /**
   * CHAT-R2: PUT IT AWAY, and bring it back.
   *
   * Hidden takes the peek, the hint, the open button, the status line
   * and the box - everything that draws over the world - and leaves
   * ONE small control. It does not destroy the panel: the log keeps
   * filling, the unread counts keep counting, and the key listener
   * stays on, because a player who hid the chat has not left the room
   * and the badge should be waiting when they bring it back.
   *
   * AND THE OPEN KEY STANDS DOWN WHILE HIDDEN. `isOpenKey` would
   * otherwise pull the box back up on the next Enter, which is the
   * opposite of what the button was pressed for - and Enter is
   * ActivateCursor, a key the game itself wants.
   */
  const setHidden = (next) => {
    const want = !!next;
    if (want === hidden) return false;
    hidden = want;
    if (hidden && log.open) closePanel();
    setPref('chatHidden', hidden);
    paint();
    return true;
  };
  hide.addEventListener('click', () => setHidden(true));
  show.addEventListener('click', () => { setHidden(false); open(); });
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) show.addEventListener(t, (e) => e.stopPropagation());
  // a PRESS inside the panel is the panel's; a RELEASE is never stopped (C5: the host's mouseup clears its ring)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) box.addEventListener(t, swallow);
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) openBtn.addEventListener(t, swallow);

  return {
    root, input,
    open, close: closePanel, toggle: () => (log.open ? closePanel() : open()),
    isOpen: () => log.open,
    /** CHAT-R2: the hidden state, for the host and for the pins. */
    isHidden: () => hidden,
    setHidden,
    /** The roster's rows as DRAWN, for the pins - the panel's reading of net/roster.js, not a second copy of it. */
    whoRows: () => whoRows.map((n) => n.textContent),
    /** Once a frame: hidden under a window that covers the HUD or an enhanced overlay (and closed, if open); repainted on the log's new version; the fade stepped. */
    render({ hidden = false, status: line = null } = {}) {
      if (!alive) return;
      if (hidden || overlay()) { if (log.open) closePanel(); if (root.style.display !== 'none') root.style.display = 'none'; return; }
      if (root.style.display !== '') root.style.display = '';
      if (log.version !== painted) paint();
      // CHAT-R2/R1: the dataset the sheet reads, and the roster - both
      // every frame, because neither rides the log's version: a peer
      // can join without a line being said.
      if (root.dataset.hidden !== (hidden ? '1' : '0')) root.dataset.hidden = hidden ? '1' : '0';
      if (log.open) paintWho();
      paintPeek();
      const s = line ? String(line) : '';
      if (status.textContent !== s) status.textContent = s;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      win.removeEventListener('keydown', onKey, true);
      root.remove?.();
    },
  };
}
