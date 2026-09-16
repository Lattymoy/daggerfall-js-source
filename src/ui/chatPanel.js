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
// SOC3 (2026-09-16, Mac: "A social button next to the chat UI, that
// when tapped opens the new friends list + party interface ... be able
// to invite friends or other individuals to the new 4 person party
// system. Party system: Upon joining a party, the players name who are
// in a party together should turn green"): THREE SEAMS, AND NO NET.
//
// This file still imports no socket and no social module. What SOC3
// adds is three OPTIONS the host fills from the picture it already
// holds (net/social.js, over the hub's link):
//   `social`  - the button beside the chat's controls, in BOTH states,
//               with a badge counting what is waiting on the player
//               (requests to me + live invites). The button only opens
//               something the HOST owns (ui/socialPanel.js), so the
//               chat neither knows nor imports the panel.
//   `nameColor` - a peer id in, a CSS colour or null out. The chat
//               lines' author names and the roster rows wear it, which
//               is where "the players name ... should turn green"
//               lands in the DOM. The colour is the HOST's answer, not
//               a class this file invents, because who is in my party
//               is the hub's word and nothing the panel can see.
//   `rowActions` - what a click on a roster row offers for that PEER.
//               The roster is the one place a stranger has a name, and
//               "other individuals" is exactly that column; the labels,
//               their enabled state and the REASON a disabled one gives
//               all come from the host (net/social.js actionsFor).
// A host that passes none of the three gets the chat it had, byte for
// byte: no button is built, no colour is asked for, no row is a door.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { isTextEntryTarget, swallowBrowserKey, bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';
import { overlayOpen } from './enhancedOverlays.js';
import { isTouchDevice } from './touch.js';
import { CHAT_MAX } from '../net/wire.js';
import { tagOf } from '../net/chat.js';
import { rosterRows, rosterTitle } from '../net/roster.js';   // CHAT-R1: who is online, in order (the cap is the model's own - AUDIT-CHATR F4: this file imported it and never used it, and lint could not see that: no-unused-vars is on for server/src and not for src)
import { getPref, setPref } from '../systems/uiPrefs.js';   // CHAT-R2: the hidden state outlives the session
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';   // FONT1: the enhanced skin's own face, unsmoothed, with Silkscreen's five

/** The action whose key opens the chat: DFU's own cursor key (Enter by default), since opening frees the cursor. */
export const CHAT_OPEN_ACTION = 'ActivateCursor';

export const CHAT_STYLE_ID = 'dagger-chat-style';

/** The panel's sheet: the enhanced tokens (enhancedStyle.js) where they exist, a fallback where the skin's sheet is not loaded.
 *
 *  FONT1 (2026-09-16, Mac: "Especially the new online interfaces font use our enhanced font"): THE FACE IS THE
 *  SKIN'S, NOT THE LAUNCHER'S. This sheet set `--data` (Barlow Semi Condensed) - which is the MENU's face, the one
 *  the boot screens and the settings pages are set in - so the chat stood over an enhanced world in a font nothing
 *  else in that world uses. In-game the enhanced skin is the pixel stack (ui/pixelifyFive.js PIXEL_STACK, the same
 *  face ui/enhancedHud.js and every floating window wear), unsmoothed, and text laid over the world takes the HUD's
 *  hard shadow pair rather than a blur: a blurred drop shadow under a pixel glyph reads as a rendering fault.
 *  The @font-face for the FIVE rides this sheet too (FIX-D), because this sheet is injected on its own and a
 *  document that never mounted the skin's stylesheet would otherwise draw Pixelify's 5 - the glyph that reads as 8.
 *
 *  AND THE SIZES CAME DOWN A STEP where the line is long. Pixelify Sans measures about 1.29x the width of Barlow
 *  Semi Condensed at one size (measured in Chromium, tools/font1Probe.mjs), so every size here is really a size and
 *  a quarter: the chat line is 13px where it was 14, the tag/time/hint/status 10-11 where they were 11-12, the
 *  roster row 12 where it was 13. Nothing a THUMB presses moved - AUDIT SOC C8's 44px targets and the button type
 *  (14px / 6px 10px, pinned) are untouched, because a pixel face is not a reason to shrink a target. */
export const CHAT_CSS = `
${PIXELIFY_FIVE_FACE}
.dfchat { position: fixed; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(44px + env(safe-area-inset-top, 0px));
  width: min(440px, calc(100vw - 28px)); z-index: 5; pointer-events: none;
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfchat.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
.dfchat-peek { display: flex; flex-direction: column; gap: 3px; }
.dfchat-line { flex: none; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; overflow: hidden; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.dfchat-name { color: var(--brass, #c08a3e); font-weight: 600; }
.dfchat-tag { color: var(--dim, #8b8578); font-size: 10px; margin: 0 6px 0 2px; }
.dfchat-line.mine .dfchat-name { color: #dcc27c; }
.dfchat-line.system .dfchat-text { color: #8fb8d8; font-style: italic; }
.dfchat-time { color: var(--dim, #8b8578); font-size: 10px; margin-right: 6px; }
.dfchat-hint { margin-top: 4px; font-size: 11px; color: var(--dim, #8b8578); opacity: .75; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.dfchat-status { margin-top: 4px; font-size: 11px; color: #e0b070; text-shadow: ${PIXEL_TEXT_SHADOW}; }
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
.dfchat-who-row { font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; color: var(--bone, #e9e4d9); }
.dfchat-who-row.me .dfchat-who-name { color: #dcc27c; }
.dfchat-who-name { font-weight: 600; }
.dfchat-who-tag { color: var(--dim, #8b8578); font-size: 10px; margin-left: 4px; }
.dfchat-who-more { font-size: 11px; color: var(--dim, #8b8578); padding-top: 4px; }
/* the roster is the first thing to go when there is no width for it */
@media (max-width: 560px) { .dfchat-who { display: none; } }

/* SOC3: THE SOCIAL BUTTON, IN BOTH STATES - one class in two places,
   so the badge's law is written once. Closed it stands beside the Chat
   button, and unlike that one it is drawn on a DESKTOP too: Enter
   opens the chat and until SOC5 nothing opens the social panel, so a
   button that only existed on a touch device would be the feature's
   only door on half the machines. Open it sits at the far end of the
   tab bar, where an MMO puts it. */
/* AUDIT SOC C24: the closed-state Social button stands on the Chat button's own line, so it wears the Chat button's
   own font-size and padding (14px / 6px 10px - .dfchat-open, in the shared rule above) instead of a smaller pair
   that made the two different heights, and the Chat button carries a 6px right margin so they are not flush. */
.dfchat-social { background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit;
  font-size: 14px; padding: 6px 10px; cursor: pointer; align-items: center; }
.dfchat.touch .dfchat-open { margin-right: 6px; }
.dfchat-social-out { display: inline-flex; pointer-events: auto; margin-top: 4px; }
.dfchat[data-state="open"] .dfchat-social-out { display: none; }
.dfchat-social-tab { display: inline-flex; margin: 2px 4px 4px auto; }
/* a request waiting on YOU is not an unread line: its own colour, so the two badges never read as one count */
.dfchat-social .dfchat-badge { background: #c8503c; color: #f6efe2; }

/* SOC3: A ROSTER ROW IS A DOOR (Mac: "invite friends or other
   individuals"). The "other individuals" are the names in this column,
   so a click on one opens a small menu of what can be done with that
   peer; what cannot carries the reason as its title rather than
   vanishing, because a missing button teaches nothing. */
.dfchat-who-row.act { cursor: pointer; }
.dfchat-rowmenu { display: flex; flex-direction: column; gap: 2px; padding: 3px 0 4px; }
.dfchat-rowbtn { display: flex; align-items: baseline; gap: 4px; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit;
  font-size: 11px; text-align: left; padding: 3px 6px; cursor: pointer; }
.dfchat-rowbtn[disabled] { opacity: .45; cursor: default; }
/* AUDIT SOC C11: the reason a row is dead, drawn beside its label - a title is a hover, and a finger cannot hover. */
.dfchat-rowwhy { font-size: 10px; font-style: italic; color: var(--dim, #8b8578); margin-left: auto; }
/* AUDIT SOC C8: the finger's own sizes for the two controls SOC3 added to this panel - the Social button (23 tall)
   and a roster row's menu buttons (18) - on the touch skin alone, where every one of them is pressed by a thumb. */
.dfchat.touch .dfchat-social { min-height: 44px; }
.dfchat.touch .dfchat-who-row.act { min-height: 44px; padding: 12px 0 0; }
.dfchat.touch .dfchat-rowbtn { min-height: 44px; font-size: 13px; padding: 8px 8px; }

/* CHAT-R2: HIDDEN. Not display:none on the root - the panel must
   keep its listeners and its log - but every VISIBLE part away, with
   one small control left to bring it back. */
.dfchat-hide { padding: 2px 8px; font-size: 12px; }
.dfchat-show { display: none; pointer-events: auto; align-self: flex-start; font-size: 12px; padding: 4px 10px; }
.dfchat[data-hidden="1"] .dfchat-peek,
.dfchat[data-hidden="1"] .dfchat-hint,
.dfchat[data-hidden="1"] .dfchat-open,
.dfchat[data-hidden="1"] .dfchat-status,
.dfchat[data-hidden="1"] .dfchat-social-out,
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
 *
 * SOC3's three, all optional and all the HOST's answers (see the
 * header): `social` is `{ onToggle, pending }` - the button beside the
 * chat's controls and the number on its badge; `nameColor(peerId)` is
 * a CSS colour or null for an author's name and a roster row;
 * `rowActions(peerId)` is `[{ label, enabled, why, run }]` - the menu a
 * click on a roster row opens.
 *
 * AUDIT SOC C2/C14: `above()` is the host's word on whether a social
 * surface stands OVER the chat (the friends panel, the F-menu). All
 * three listen for Escape on the window in capture, so ONE press used
 * to close two of them. The topmost answers: with something above it
 * the chat IGNORES Escape - it does not close and it does not stop the
 * key - and when it does handle one it calls stopImmediatePropagation,
 * so neither a sibling surface nor the host's pause door sees it.
 */
export function createChatPanel({ log, onSend, roster = null, canOpen = () => true, onOpen = null, onClose = null, above = () => false, action = actionOfKey, overlay = overlayOpen, doc = document, win = globalThis, touch = isTouchDevice(), social = null, nameColor = null, rowActions = null } = {}) {
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
  // SOC3: the two Social buttons - one for each state of the panel, built only when the host asked for them. The
  // badge is a SPAN of the chat's own badge class, so a request waiting on the player counts the way an unread line
  // does; its colour in the sheet is what keeps the two from reading as one number.
  const socialBadges = [];
  const socialButton = (cls) => {
    const b = el('button', `dfchat-social ${cls}`, 'Social');
    b.type = 'button';
    // AUDIT SOC C21: NO aria-label ON THE BUTTON. One overrode the whole of its content, so the badge - the count of
    // requests and invitations waiting on this player, the only thing on the button that ever changes - was read as
    // "Friends and party" and nothing else. The word stays a title for the mouse; the badge names ITSELF, and the
    // button's accessible name becomes "Social 3" the moment there is a 3.
    b.setAttribute('title', 'Friends and party');
    const badge = el('span', 'dfchat-badge');
    b.append(badge); socialBadges.push(badge);
    b.addEventListener('click', () => social.onToggle?.());
    return b;
  };
  const socialOut = social ? socialButton('dfchat-social-out') : null;
  if (social) tabs.append(socialButton('dfchat-social-tab'));
  main.append(list, form);
  cols.append(main, who);
  box.append(tabs, cols);
  // the Social button follows the Chat button (they share a line when both are drawn); `show` and the box keep their places
  root.append(peek, hint, status, openBtn, ...(socialOut ? [socialOut] : []), show, box);
  doc.body.append(root);

  let painted = -1;
  let socialBadgeLabel = null;   // SOC3/C21: the badge's last spoken label, so the attribute is written on a change
  let peekNodes = [];
  let listNodes = [];      // the open list's rows, in order: [{ seq, node }] - grown, not rebuilt (AUDIT CHAT C8)
  let listTab = null;
  let alive = true;
  // CHAT-R2: hidden across sessions - a player who puts the chat away
  // wants it away next time too, not one reload later.
  let hidden = getPref('chatHidden') === true;
  let whoRows = [];        // the drawn rows, keyed so an unchanged roster repaints nothing
  let whoKey = '';
  let whoNames = [];       // SOC3: [{ id, nameEl, css }] - the roster's name spans, for the colour pass
  let menuFor = null;      // SOC3: the roster row whose action menu is open (a peer id), or null

  /** A drawn line, and the span its AUTHOR's name is in - SOC3 colours that span from the host's `nameColor` without
   *  rebuilding the row, so a party formed while the chat is open turns the names green where they already stand. */
  const lineNode = (line, withTime) => {
    const n = el('div', `dfchat-line${line.mine ? ' mine' : ''}${line.system ? ' system' : ''}`);
    if (withTime) n.append(el('span', 'dfchat-time', clockOf(line.at)));
    // SRV-N: a notice is NOT ATTRIBUTED. No name and no `#tag`, because
    // both are the marks of a person having spoken - a notice drawn with
    // them would read as a player called 'Server' with a tag of its own,
    // and the tag would be `tagOf('')`: a real-looking four-character
    // hash off an empty id, identical on every notice and therefore
    // exactly the thing a player could be fooled by. Its own colour
    // instead, which is a mark no player's line can wear.
    if (line.system) n.append(el('span', 'dfchat-text', line.text));
    else n.append(el('span', 'dfchat-name', line.name || '?'), el('span', 'dfchat-tag', `#${tagOf(line.id)}`), el('span', 'dfchat-text', line.text));
    return n;
  };
  /** One drawn row of the two line lists: the node, and the record the colour pass walks. */
  const lineRow = (line, withTime, extra) => {
    const node = lineNode(line, withTime);
    const nameEl = line.system ? null : node.children[withTime ? 1 : 0];
    return { node, nameEl, id: line.id, css: null, ...extra };
  };

  /**
   * SOC3 (Mac: "the players name who are in a party together should
   * turn green"): THE COLOUR PASS.
   *
   * Who is in my party is the HUB's word (net/social.js isPartyPeer),
   * which this file cannot see and must not cache - a seat can change
   * between two frames with no line said and no peer joining, so a
   * colour baked in at build time would be wrong until the next
   * message. So the spans that are drawn are asked again each pass and
   * the ones whose answer did not change are not touched at all - the
   * same law the roster column repaints under (CHAT-R2).
   *
   * The answer is cached PER PEER ID for the pass: two hundred rows are
   * a handful of distinct authors, and `nameColor` walks the party's
   * seats on every call.
   */
  const paintNames = () => {
    if (!nameColor) return;
    const asked = new Map();
    const of = (id) => { if (!asked.has(id)) asked.set(id, nameColor(id) || ''); return asked.get(id); };
    const pass = (rows) => { for (const r of rows) { if (!r.nameEl) continue; const css = of(r.id); if (r.css === css) continue; r.css = css; r.nameEl.style.color = css; } };
    pass(listNodes); pass(peekNodes); pass(whoNames);
  };

  /** SOC3: the badge on both Social buttons - what is waiting on the player (requests to me + live invites). */
  const paintSocial = () => {
    if (!social) return;
    const n = Number(social.pending?.() ?? 0);
    const text = Number.isFinite(n) && n > 0 ? String(n) : '';
    // C21: the badge says what its number MEANS, so "3" is not read out as a bare digit beside "Social". Written on
    // a CHANGE, like everything else on this frame - `setAttribute` is a write whatever the value.
    const label = text ? `${text} waiting` : '';
    const moved = label !== socialBadgeLabel;
    socialBadgeLabel = label;
    for (const b of socialBadges) {
      if (b.textContent !== text) b.textContent = text;
      if (moved) b.setAttribute('aria-label', label);
    }
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
      listNodes = msgs.map((line) => lineRow(line, true, { seq: line.seq }));
      list.replaceChildren(...listNodes.map((r) => r.node));
    } else {
      while (listNodes.length && listNodes[0].seq < msgs[0].seq) listNodes.shift().node.remove();
      const lastSeq = listNodes.length ? listNodes[listNodes.length - 1].seq : -1;
      for (const line of msgs) if (line.seq > lastSeq) { const row = lineRow(line, true, { seq: line.seq }); listNodes.push(row); list.append(row.node); }
    }
    listTab = log.active;
    if (atBottom) list.scrollTop = list.scrollHeight ?? 0;
  };

  /**
   * SOC3: the menu under an opened roster row. Every label, its enabled
   * state and the REASON a disabled one carries come from the host
   * (net/social.js actionsFor), so this file decides nothing about who
   * may be friended or invited - it draws an answer and calls back.
   *
   * A refused act is a SENTENCE, never a missing button: "already
   * friends" and "the party is full" are the two things a player most
   * wants to be told, and a row that silently drops the option teaches
   * neither. AUDIT SOC C11: the sentence is DRAWN beside the label as
   * well as titled - a `title` is a mouse hover, and the touch skin
   * this panel also runs in has no hover at all.
   */
  const rowMenu = (peerId) => {
    const menu = el('div', 'dfchat-rowmenu');
    for (const a of rowActions(peerId) ?? []) {
      const b = el('button', 'dfchat-rowbtn', String(a.label ?? ''));
      b.type = 'button';
      if (a.enabled === false) {
        b.disabled = true;
        if (a.why) { b.setAttribute('title', String(a.why)); b.append(el('span', 'dfchat-rowwhy', String(a.why))); }
      } else b.addEventListener('click', (e) => { e.stopPropagation?.(); a.run?.(); menuFor = null; paintWho(); });
      menu.append(b);
    }
    return menu;
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
    // SOC3: the open menu is part of what is DRAWN, so it joins the key - a roster that did not change still has to
    // repaint when a row is opened or closed, and nothing else about this law moved.
    const key = total + '|' + (menuFor ?? '') + '|' + rows.map((r) => r.id + ':' + r.name + ':' + (r.me ? 1 : 0)).join(',');
    if (key === whoKey) return;
    whoKey = key;
    whoHead.textContent = rosterTitle(total);
    // ROSTER-G (Mac: "the roster naming itself seems hardcoded"): the #tag is the tie-breaker for two players with ONE
    // name (net/roster.js's second sort clause, the chat line's own suffix), and it read as a fixed code stuck to every
    // name. It is drawn only where it does that work - beside a name another row shares.
    const dup = new Set(); const seen = new Set();
    for (const r of rows) { const k = r.name.toLowerCase(); if (seen.has(k)) dup.add(k); seen.add(k); }
    whoNames = [];
    whoRows = rows.map((r) => {
      // SOC3: a row is a door for everyone but ME - "Add friend" on my own name is the one action that can never mean
      // anything, and net/social.js would refuse it in words a player should not have to read. A host whose picture
      // is not up yet (no account, no hub) offers nothing, and a row with nothing behind it is not a door either.
      const acts = !!rowActions && !r.me && (rowActions(r.id) ?? []).length > 0;
      const n = el('div', 'dfchat-who-row' + (r.me ? ' me' : '') + (acts ? ' act' : ''));
      const nameEl = el('span', 'dfchat-who-name', r.name);
      whoNames.push({ id: r.id, nameEl, css: null });
      n.append(nameEl);
      if (dup.has(r.name.toLowerCase())) n.append(el('span', 'dfchat-who-tag', '#' + r.tag));
      if (acts) {
        n.addEventListener('click', () => { menuFor = menuFor === r.id ? null : r.id; paintWho(); });
        if (menuFor === r.id) n.append(rowMenu(r.id));
      }
      return n;
    });
    whoList.replaceChildren(...whoRows);
    // a cut list says so rather than quietly under-reporting the room
    whoMore.textContent = total > shown ? '+' + (total - shown) + ' more' : '';
    paintNames();   // SOC3: the spans are new, so the colours they wear are asked for once, here
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
    paintSocial();   // SOC3
    paintNames();
  };

  /** The closed state's lines: rebuilt when the set changes, their alpha stepped every frame. */
  const paintPeek = () => {
    const shown = log.open ? [] : log.peek();
    if (shown.length !== peekNodes.length || shown.some((p, i) => peekNodes[i].line !== p.line)) {
      peekNodes = shown.map((p) => lineRow(p.line, false, { line: p.line, alpha: -1 }));
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
      // AUDIT SOC C2/C14: a surface OVER the chat owns Escape - the key is left whole for it, and the field keeps its line
      if (e.code === 'Escape') { if (above()) { e.stopPropagation(); return; } e.preventDefault(); e.stopImmediatePropagation(); closePanel(); return; }
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
  // SOC3: the closed-state Social button is outside the box, so it carries the box's own press rule - a thumb that
  // taps it must not also draw a weapon (D7). The tab-bar one is inside the box and already has it.
  if (socialOut) for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) socialOut.addEventListener(t, swallow);

  return {
    root, input,
    open, close: closePanel, toggle: () => (log.open ? closePanel() : open()),
    isOpen: () => log.open,
    /** CHAT-R2: the hidden state, for the host and for the pins. */
    isHidden: () => hidden,
    setHidden,
    // AUDIT-CHATR F5: a `whoRows()` accessor stood here, labelled "for
    // the pins". No pin ever called it - they read the drawn column out
    // of the fake document, which is the stronger reading anyway - so it
    // was an export whose only justification was a use that did not
    // exist. Deleted rather than pinned into life.
    /**
     * Once a frame.
     *
     * `covered` is THE HOST'S word - a window over the HUD, an enhanced
     * overlay, the pause door - and it takes the whole panel out of the
     * page while it holds. It is NOT the player's `hidden`, and the two
     * must never share a name here: AUDIT-CHATR F1 found this parameter
     * called `hidden`, shadowing the closure of the same name, so the
     * dataset line below wrote the host's word into the player's slot
     * and every frame quietly undid the Hide button. The feature was
     * inert in the only host that has one, and every CHAT-R2 pin passed,
     * because they drove `setHidden` and never drove a FRAME.
     */
    render({ covered = false, status: line = null } = {}) {
      if (!alive) return;
      if (covered || overlay()) { if (log.open) closePanel(); if (root.style.display !== 'none') root.style.display = 'none'; return; }
      if (root.style.display !== '') root.style.display = '';
      if (log.version !== painted) paint();
      // CHAT-R2/R1: the dataset the sheet reads, and the roster - both
      // every frame, because neither rides the log's version: a peer
      // can join without a line being said.
      if (root.dataset.hidden !== (hidden ? '1' : '0')) root.dataset.hidden = hidden ? '1' : '0';
      if (log.open) paintWho();
      paintPeek();
      // SOC3: neither of these rides the log's version either - a friend request lands and a party forms with nothing
      // said in the chat at all, so the badge and the name colours are asked for on the frame like the roster is.
      paintSocial();
      paintNames();
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
