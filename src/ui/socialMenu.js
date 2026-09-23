// SOC5 (2026-09-16, Mac: "Players should be able to interact with others in the world upon encountering them by
// pressing F on their body, which should show options to add as a friend or invite to a party"): THE MENU ON A BODY -
// a small DOM card near the middle of the screen, over the player the ray struck.
//
// WHAT IT IS. Three buttons and a name (and, where the host offers them, Inspect first and Trade after - INSPECT1, TRADE1). `show({ name, peerId, actions })` draws it; `actions` is
// net/social.js `actionsFor(peerId)` as it stands at the moment of the press - `canFriend` / `canInvite` and, when
// either is false, `whyNotFriend` / `whyNotInvite` in words. A button that cannot be pressed is DISABLED AND SAYS WHY
// (the reason on `title`, and beside the label on the row) rather than being hidden: "already friends" is an answer,
// and a button that vanishes reads as a bug. AUDIT SOC C15: 'Remove friend' is NOT one of the three - unfriending
// arms and confirms on ui/socialPanel.js's own row, and a one-press card under the crosshair is the wrong place for
// a deliberate act.
//
// IT IS A POINTER SURFACE, LIKE THE CHAT. The world holds the mouse (pointer lock) and this card has buttons, so the
// host frees the pointer on open and takes it back on close - `onOpen` / `onClose`, inside the gesture, which is
// ui/chatPanel.js's law (AUDIT CHAT C2) and the only place a lock request is honoured. And like the chat it refuses
// to open at all under a window or a pause (`canOpen`): a window's keys are the window's.
//
// THE KEYS. One capture listener on the window while the menu stands, and it takes ONE key: Escape closes. The
// second press of F is NOT this module's - the action is routed by the host's own ladder (scenes/world.js
// `socialInteract`), which asks `isOpen()` first and closes, so there is one place that decides what F means and it
// is the place F arrives.
//
// NOTHING HERE SENDS. `onAct(act)` hands the host `{ k, peer }` or `{ k, acct }` exactly as net/wire.js SOCIAL_ACTS
// names it, and the host sends it through the hub link and writes the line that says so. The menu closes whether or
// not the send went: an act is one press, and a card left standing over a peer who has walked away is worse than a
// chat line saying to try again.
//
// Not a DFU member: Daggerfall Unity has no other players, no friends and no parties. Ledger A row (ONLINE).
import { isTextEntryTarget } from './input.js';
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';   // FONT1: the enhanced skin's own face, unsmoothed, with Silkscreen's five

export const SOCIAL_MENU_STYLE_ID = 'dagger-peermenu-style';

/** The card's sheet: the enhanced tokens (ui/enhancedStyle.js) where the skin's sheet is loaded, a fallback where it
 *  is not - the same pairing ui/chatPanel.js uses, so the two surfaces are one skin.
 *
 *  FONT1 (2026-09-16, Mac: "Any enhanced UI or text must be our enhanced version"): the face is the skin's pixel
 *  stack rather than `--data`, the menu's; ui/chatPanel.js's CHAT_CSS header carries the whole reading. The five's
 *  @font-face (FIX-D) rides this sheet as it rides the other three.
 *
 *  AUDIT SOC C1: THE PREFIX IS `dfpeer`, NOT `dfsocial`. This card and ui/socialPanel.js are two surfaces that stand
 *  at once (F opens this over a body while the friends panel is up), and they shared `.dfsocial`, `.dfsocial-name`,
 *  `.dfsocial-btn` and `.dfsocial-btn[disabled]` to the letter. Whichever sheet was injected LAST won: the menu's
 *  ships `pointer-events: none` and `left: 50%`, so an open panel lost its buttons and jumped to the screen centre.
 *  One surface, one prefix - and test/soc5_interact.test.js parses both CSS strings and pins the intersection empty.
 *  The style id moved with it, because two ids that differ only in spelling are the next thing to collide. */
export const SOCIAL_MENU_CSS = `
${PIXELIFY_FIVE_FACE}
.dfpeer { position: fixed; left: 50%; top: 52%; transform: translate(-50%, 0); z-index: 6; display: none;
  min-width: 208px; max-width: min(320px, calc(100vw - 28px)); pointer-events: none;
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfpeer[data-state="open"] { display: block; }
/* the CARD takes the pointer, not the root - ui/chatPanel.js's own split, so a gap around the box is still the world's */
.dfpeer-card { pointer-events: auto; background: rgba(14, 16, 19, .9); border: 1px solid var(--iron, #2b323b); border-radius: 6px;
  backdrop-filter: blur(4px); padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.dfpeer-card:focus { outline: none; }
.dfpeer-name { font-size: 15px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; padding: 0 2px 4px;
  border-bottom: 1px solid var(--iron, #2b323b); margin-bottom: 2px; }
.dfpeer-btn { display: flex; align-items: baseline; gap: 6px; width: 100%; text-align: left; min-height: 44px;
  background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px;
  font: inherit; font-size: 14px; padding: 6px 8px; cursor: pointer; }
.dfpeer-btn:hover:not([disabled]) { background: var(--brass, #c08a3e); color: var(--ink, #0e1013); }
/* AUDIT SOC C12: a refused row must still be READ. At opacity .5 the dim reason measured 1.84:1 at 11px against the
   card - under every threshold there is. The opacity is .75 and the reason is its own lighter bone: 4.9:1 composited
   over the card whether the relief under it is black or bright (the numbers are in test/soc5_interact.test.js). */
.dfpeer-btn[disabled] { opacity: .75; cursor: default; }
.dfpeer-btn.cancel { background: none; color: var(--dim, #8b8578); padding-top: 2px; padding-bottom: 2px; min-height: 0; }
.dfpeer-why { font-size: 11px; color: #c8c2b4; font-style: italic; margin-left: auto; }
.dfpeer-btn[disabled]:hover .dfpeer-why { color: #c8c2b4; }
`;

export function injectSocialMenuStyle(doc = document) {
  if (!doc?.getElementById || doc.getElementById(SOCIAL_MENU_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = SOCIAL_MENU_STYLE_ID;
  s.textContent = SOCIAL_MENU_CSS;
  (doc.head ?? doc.body)?.append(s);   // AUDIT SOC C25: the other three sheets' own fallback - a document with no head still gets the skin
}

/** The rows the card offers, in order, for one peer and the picture's word on them. Two acts and a way out: the two
 *  always exist, lit or not, because "why not" is the answer. Pure, so the order and the wording are pinned without
 *  a document.
 *
 *  AUDIT SOC C15: THERE IS NO 'Remove friend' ROW HERE. It used to be one, unconfirmed, on a card that opens under
 *  the crosshair from a single key - while the same act on ui/socialPanel.js arms on the first click and only sends
 *  on the second. One deliberate act, one place to do it: unfriending is the panel's, where the list that names the
 *  friendship is. `relation` and `acct` are no longer read at all - callers still hand the WHOLE of `actionsFor`
 *  in (they should not have to strip it), and the extra keys are simply ignored, which is what an object argument
 *  is for. */
export function socialMenuRows({ peerId, canFriend = false, canInvite = false, whyNotFriend = null, whyNotInvite = null, canTrade, whyNotTrade = null, tradeLabel = null, canInspect } = {}) {
  const rows = [
    { key: 'friend', label: 'Add friend', enabled: !!canFriend, why: canFriend ? null : (whyNotFriend ?? null), act: { k: 'friend.request', peer: peerId } },
    { key: 'invite', label: 'Invite to party', enabled: !!canInvite, why: canInvite ? null : (whyNotInvite ?? null), act: { k: 'party.invite', peer: peerId } },
  ];
  // INSPECT1 (kurkku: "a profile page that you can bring up when you're near them"): the look before the ask - FIRST,
  // present only when the host says (`canInspect` given), as Trade is. Not a hub act either: the host opens the
  // profile (ui/profileWindow.js) and asks the player for their card over the room's own socket.
  if (canInspect !== undefined) rows.unshift({ key: 'inspect', label: 'Inspect', enabled: !!canInspect, why: null, act: { k: 'profile.inspect', peer: peerId } });
  // TRADE1: the third act. It is present ONLY when the host says whether a trade can be had (`canTrade` given): offline, on a
  // page with no account, or on a skin that cannot draw the window, the host says nothing and the card is exactly the two
  // acts and a way out it always was. The act is NOT a hub act (net/wire.js SOCIAL_ACTS) - a trade is between two players
  // standing in one room, so the host routes `trade.request` to net/tradeSession.js, not to the hub link. When a peer has
  // already asked, the same row reads 'Accept trade' (`tradeLabel`): there is no separate panel to stand under a window.
  if (canTrade !== undefined) rows.push({ key: 'trade', label: tradeLabel || 'Trade', enabled: !!canTrade, why: canTrade ? null : (whyNotTrade ?? null), act: { k: 'trade.request', peer: peerId } });
  rows.push({ key: 'cancel', label: 'Cancel', enabled: true, why: null, act: null });
  return rows;
}

/**
 * The card over the document. `onAct(act, row)` is the host's sender; `canOpen()` its word on whether the game can
 * take a menu right now; `onOpen`/`onClose` its pointer-lock door. Handed the document and the window so the pins
 * drive it headless.
 *
 * AUDIT SOC C2/C14: `above()` is the host's word on whether a surface stands OVER this one. All three social
 * surfaces listen for Escape on the window in capture, so one press used to close two of them. The topmost is the
 * one that answers: a surface with something above it IGNORES the key entirely (it does not close and it does not
 * stop it), and the one that does handle it calls `stopImmediatePropagation` so no other window listener - the
 * host's pause door included - ever sees that press. This card is the topmost of the three, so world.js hands it
 * `() => false`.
 */
export function createSocialMenu({ onAct = null, canOpen = () => true, onOpen = null, onClose = null, above = () => false, doc = document, win = globalThis } = {}) {
  injectSocialMenuStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', 'dfpeer');
  root.dataset.state = 'closed';
  const card = el('div', 'dfpeer-card');
  card.setAttribute('role', 'menu');
  // AUDIT SOC C21: the card takes focus when it is shown, so a keyboard lands INSIDE the menu rather than wherever
  // the page left it - and -1 keeps it out of the tab order while the card is down.
  card.setAttribute('tabindex', '-1');
  const nameNode = el('div', 'dfpeer-name');
  card.setAttribute('aria-labelledby', 'dfpeer-name-node');
  nameNode.id = 'dfpeer-name-node';
  card.append(nameNode);
  root.append(card);
  doc.body?.append(root);

  let alive = true;
  let open = false;
  let shown = null;   // { peerId, rows }

  /** The card's rows, rebuilt per show: the picture can change between two presses, and a stale 'Add friend' on
   *  someone already befriended is exactly the button this menu exists to not have. */
  const paint = (name, rows) => {
    nameNode.textContent = name || 'Someone';
    card.replaceChildren(nameNode);
    for (const row of rows) {
      const b = el('button', `dfpeer-btn${row.key === 'cancel' ? ' cancel' : ''}`);
      b.type = 'button';
      b.dataset.row = row.key;
      b.setAttribute('role', 'menuitem');   // AUDIT SOC C21: a menu whose rows are menu items, not loose buttons
      b.append(el('span', 'dfpeer-label', row.label));
      if (!row.enabled && row.why) b.append(el('span', 'dfpeer-why', row.why));
      if (!row.enabled) { b.disabled = true; b.setAttribute('disabled', ''); }
      if (row.why) b.title = row.why;
      b.addEventListener('click', () => {
        if (!open || b.disabled) return;   // a disabled button's click is nothing, however it arrived
        const act = row.act;
        hide();                            // the card goes first: the act is one press, and the send may answer false
        if (act) onAct?.(act, row);
      });
      card.append(b);
    }
  };

  const hide = () => {
    if (!alive || !open) return false;
    open = false;
    shown = null;
    root.dataset.state = 'closed';
    onClose?.();   // the host takes the pointer back - inside the gesture that closed
    return true;
  };

  /** Draw the card for one peer. False when the host will not have it (a window up, a pause) or when there is no
   *  peer to draw - and a false NEVER touches the pointer, because nothing opened. */
  const show = ({ name = null, peerId = null, actions = null } = {}) => {
    if (!alive || !peerId || !canOpen()) return false;
    const rows = socialMenuRows({ peerId, ...(actions ?? {}) });
    paint(name, rows);
    shown = { peerId, rows };
    const was = open;
    open = true;
    root.dataset.state = 'open';
    card.focus?.();         // AUDIT SOC C21: the keyboard goes where the menu is
    if (!was) onOpen?.();   // the host frees the pointer (AUDIT CHAT C2's law for the chat) - on the OPEN alone, so a
    return true;            // re-show over a second peer does not ask for the lock twice
  };

  const onKey = (e) => {
    if (!open) return;
    if (isTextEntryTarget(e.target)) return;   // a field owns its own Escape (CG2)
    if (e.code !== 'Escape') return;
    if (above()) return;                       // AUDIT SOC C2/C14: a surface over this one owns the key - untouched, unstopped
    e.preventDefault();
    e.stopImmediatePropagation();              // and NO other window listener sees it: not the host's pause door, not a sibling surface
    hide();
  };
  win.addEventListener('keydown', onKey, true);
  // a PRESS inside the card is the card's - the host swings on the left button outdoors and pressing 'Add friend'
  // must not draw a weapon; a RELEASE is never stopped (AUDIT CHAT C5: the host's mouseup clears its ring)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) card.addEventListener(t, swallow);

  return {
    root,
    show, hide,
    isOpen: () => open,
    /** Which peer the card stands over, for the host's own frame and for the pins. */
    peerId: () => shown?.peerId ?? null,
    /** THE HOST'S FRAME. `covered` is a window over the HUD, an overlay, the pause door - the same word
     *  ui/chatPanel.js's render takes, and it takes the card away with it rather than leaving a menu floating over a
     *  window that now owns the keys. */
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
