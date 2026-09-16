// SOC5 (2026-09-16, Mac: "Players should be able to interact with others in the world upon encountering them by
// pressing F on their body, which should show options to add as a friend or invite to a party"): THE MENU ON A BODY -
// a small DOM card near the middle of the screen, over the player the ray struck.
//
// WHAT IT IS. Three or four buttons and a name. `show({ name, peerId, actions })` draws it; `actions` is
// net/social.js `actionsFor(peerId)` as it stands at the moment of the press - `canFriend` / `canInvite` and, when
// either is false, `whyNotFriend` / `whyNotInvite` in words. A button that cannot be pressed is DISABLED AND SAYS WHY
// (the reason on `title`, and beside the label on the row) rather than being hidden: "already friends" is an answer,
// and a button that vanishes reads as a bug. 'Remove friend' appears only for a friend, because it is the one act
// with no meaning for anyone else.
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

export const SOCIAL_MENU_STYLE_ID = 'dagger-socialmenu-style';

/** The card's sheet: the enhanced tokens (ui/enhancedStyle.js) where the skin's sheet is loaded, a fallback where it
 *  is not - the same pairing ui/chatPanel.js uses, so the two surfaces are one skin. */
export const SOCIAL_MENU_CSS = `
.dfsocial { position: fixed; left: 50%; top: 52%; transform: translate(-50%, 0); z-index: 6; display: none;
  min-width: 208px; max-width: min(320px, calc(100vw - 28px)); pointer-events: none;
  font-family: var(--data, 'Barlow Semi Condensed', system-ui, sans-serif); color: var(--bone, #e9e4d9); }
.dfsocial[data-state="open"] { display: block; }
/* the CARD takes the pointer, not the root - ui/chatPanel.js's own split, so a gap around the box is still the world's */
.dfsocial-card { pointer-events: auto; background: rgba(14, 16, 19, .9); border: 1px solid var(--iron, #2b323b); border-radius: 6px;
  backdrop-filter: blur(4px); padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.dfsocial-name { font-size: 15px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; padding: 0 2px 4px;
  border-bottom: 1px solid var(--iron, #2b323b); margin-bottom: 2px; }
.dfsocial-btn { display: flex; align-items: baseline; gap: 6px; width: 100%; text-align: left;
  background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px;
  font: inherit; font-size: 14px; padding: 6px 8px; cursor: pointer; }
.dfsocial-btn:hover:not([disabled]) { background: var(--brass, #c08a3e); color: var(--ink, #0e1013); }
.dfsocial-btn[disabled] { opacity: .5; cursor: default; }
.dfsocial-btn.cancel { background: none; color: var(--dim, #8b8578); padding-top: 2px; padding-bottom: 2px; }
.dfsocial-why { font-size: 11px; color: var(--dim, #8b8578); font-style: italic; margin-left: auto; }
.dfsocial-btn[disabled]:hover .dfsocial-why { color: var(--dim, #8b8578); }
`;

export function injectSocialMenuStyle(doc = document) {
  if (!doc?.getElementById || doc.getElementById(SOCIAL_MENU_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = SOCIAL_MENU_STYLE_ID;
  s.textContent = SOCIAL_MENU_CSS;
  doc.head?.append(s);
}

/** The rows the card offers, in order, for one peer and the picture's word on them. `relation` decides whether the
 *  third row exists at all; the other two always exist, lit or not, because "why not" is the answer. Pure, so the
 *  order and the wording are pinned without a document. */
export function socialMenuRows({ peerId, acct = null, relation = 'none', canFriend = false, canInvite = false, whyNotFriend = null, whyNotInvite = null } = {}) {
  const rows = [
    { key: 'friend', label: 'Add friend', enabled: !!canFriend, why: canFriend ? null : (whyNotFriend ?? null), act: { k: 'friend.request', peer: peerId } },
    { key: 'invite', label: 'Invite to party', enabled: !!canInvite, why: canInvite ? null : (whyNotInvite ?? null), act: { k: 'party.invite', peer: peerId } },
  ];
  // 'friend.remove' is an ACCOUNT act (net/wire.js SOCIAL_ACTS: 'acct'), never a peer one - a person is unfriended,
  // not a tab. No account, no row: the hub could not resolve it, so the button would be a lie.
  if (relation === 'friend' && acct) rows.push({ key: 'remove', label: 'Remove friend', enabled: true, why: null, act: { k: 'friend.remove', acct } });
  rows.push({ key: 'cancel', label: 'Cancel', enabled: true, why: null, act: null });
  return rows;
}

/**
 * The card over the document. `onAct(act, row)` is the host's sender; `canOpen()` its word on whether the game can
 * take a menu right now; `onOpen`/`onClose` its pointer-lock door. Handed the document and the window so the pins
 * drive it headless.
 */
export function createSocialMenu({ onAct = null, canOpen = () => true, onOpen = null, onClose = null, doc = document, win = globalThis } = {}) {
  injectSocialMenuStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', 'dfsocial');
  root.dataset.state = 'closed';
  const card = el('div', 'dfsocial-card');
  card.setAttribute('role', 'menu');
  const nameNode = el('div', 'dfsocial-name');
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
      const b = el('button', `dfsocial-btn${row.key === 'cancel' ? ' cancel' : ''}`);
      b.type = 'button';
      b.dataset.row = row.key;
      b.append(el('span', 'dfsocial-label', row.label));
      if (!row.enabled && row.why) b.append(el('span', 'dfsocial-why', row.why));
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
    if (!was) onOpen?.();   // the host frees the pointer (AUDIT CHAT C2's law for the chat) - on the OPEN alone, so a
    return true;            // re-show over a second peer does not ask for the lock twice
  };

  const onKey = (e) => {
    if (!open) return;
    if (isTextEntryTarget(e.target)) return;   // a field owns its own Escape (CG2)
    if (e.code !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();   // and the host's pause door never sees it: Escape closed the menu
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
