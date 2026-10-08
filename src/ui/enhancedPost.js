// @ts-check
// SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
// menu. It should show notifications whenever players have a message. First use is to utilize it for players being
// granted items.").
//
// THE MAILBOX. An envelope beside the hourglass over the paused game (ui/enhancedTimers.js's mark, measured as it is)
// wears a count while anything waits - a message unread, or an item not yet claimed - and opens a window in the pause
// window's own frame: the developers' messages, newest first; one opened, its words, and the item it holds with a Claim
// that lands it in the pack of the online character being played (net/serverPost.js PostBox.claim). The box is the
// host's (scenes/world.js), looked at on the letterbox's clock; both the count and the window follow its `version` on a
// tick of their own, since the pause face draws itself only when it is opened, closed or Escaped.
import { REFUSALS } from '../net/accountClient.js';
import { RARITIES } from '../systems/lootRarity.js';
import { placeBeside } from './enhancedTimers.js';

/** How often the mark's count and the open window look at the box's version, ms. */
export const POST_TICK_MS = 500;

/** The words a refusal shows in the window - the account's own sentences (net/accountClient.js REFUSALS). */
export const postRefusalText = (/** @type {string|undefined} */ w) => (w && REFUSALS[w]) || 'The mailbox could not do that right now. Try again in a moment.';

/** A piece's date, in the player's own clock: "8 Oct". */
export const postDayText = (/** @type {number} */ sentAtS) => new Date(sentAtS * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A rarity's class for an item's name ('rar-gilded'), or none for one off the ladder - the sheet colours it (enhancedStyle.js). */
export const rarityClass = (/** @type {string|null} */ r) => (r && Object.hasOwn(RARITIES, r) ? `rar-${r}` : '');

/**
 * The envelope, the button beside the hourglass, and the count it wears while anything waits (empty - and hidden by
 * the sheet - at none). `count` the box's `waiting`.
 * @param {Document} doc
 * @param {{ onOpen: () => void, open?: boolean, count?: number }} o
 */
export function postMark(doc, { onOpen, open = false, count = 0 }) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'px-postmark';
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.title = 'Mailbox';
  const env = doc.createElement('span');
  env.className = 'px-envelope';
  env.setAttribute('aria-hidden', 'true');
  const badge = doc.createElement('span');
  badge.className = 'px-postbadge';
  badge.setAttribute('aria-hidden', 'true');
  b.append(env, badge);
  setPostCount(b, count);
  b.addEventListener('click', () => onOpen());
  return b;
}

/** The mark's count, written: its badge and its label. */
export function setPostCount(/** @type {any} */ mark, /** @type {number} */ count) {
  const n = Number.isSafeInteger(count) && count > 0 ? count : 0;
  const badge = mark?.querySelector?.('.px-postbadge');
  const text = n ? (n > 99 ? '99+' : String(n)) : '';
  if (badge && badge.textContent !== text) badge.textContent = text;
  mark?.setAttribute?.('aria-label', n ? `Mailbox: ${n} waiting` : 'Mailbox');
  mark?.classList?.toggle?.('waiting', n > 0);
}

/**
 * THE MARK KEPT LIVE: its count follows the box (`box()` the host's PostBox, or null) every POST_TICK_MS, and the tick
 * stops itself once the mark is out of the page. Answers the stop.
 * @param {any} mark @param {() => any} box
 */
export function watchPostMark(mark, box, every = POST_TICK_MS) {
  let seen = -1;
  let tick = null;
  const step = () => {
    if (mark?.isConnected === false && tick) { clearInterval(tick); tick = null; return; }
    const b = box();
    if (!b || b.version === seen) return;
    seen = b.version;
    setPostCount(mark, b.waiting);
  };
  step();
  tick = setInterval(step, every);
  return () => { if (tick) clearInterval(tick); tick = null; };
}

/** THE ENVELOPE STANDS LEFT OF THE HOURGLASS (or of the profile mark, where there is no hourglass) - and the hourglass is
 *  itself placed off the profile's measured box (enhancedTimers.js anchorBeside), so each placing places the hourglass
 *  first and the envelope off it: a caption that changes width moves both. Placed again whenever the profile, the
 *  hourglass or the face changes size; answers the disconnect, for the caller's teardown.
 *  @param {any} mark @param {any} glass the hourglass, or null @param {any} profile @param {any} host */
export function anchorPost(mark, glass, profile, host, gap = 10) {
  const place = () => { if (glass) placeBeside(glass, profile, host, gap); placeBeside(mark, glass ?? profile, host, gap); };
  globalThis.requestAnimationFrame?.(place);
  const RO = globalThis.ResizeObserver;
  const ro = RO ? new RO(place) : null;
  for (const n of [profile, glass, host]) if (n) ro?.observe?.(n);
  globalThis.addEventListener?.('resize', place);
  globalThis.document?.fonts?.ready?.then?.(place).catch?.(() => {});
  return () => { ro?.disconnect?.(); globalThis.removeEventListener?.('resize', place); };
}

/**
 * THE WINDOW. `box()` the host's PostBox (net/serverPost.js), or null when there is none. Answers { root, stop, draw }:
 * the caller stops the tick when the window goes (a render, an unmount).
 * @param {Document} doc
 * @param {{ box: () => any, onClose: () => void, every?: number }} o
 */
export function postWindow(doc, { box, onClose, every = POST_TICK_MS }) {
  const el = (/** @type {string} */ tag, /** @type {string|null} */ cls, /** @type {string|null} */ text = null) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (/** @type {string} */ cls, /** @type {string} */ text, /** @type {() => void} */ fn) => {
    const b = /** @type {any} */ (el('button', `act ${cls}`, text));
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  const win = el('div', 'px-win px-postwin');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-labelledby', 'pm-title');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
  const body = el('div', 'px-body');
  const head = el('div', 'pm-head');
  const title = el('h3', 'pm-title', 'Mailbox');
  title.id = 'pm-title';
  const close = button('pm-close', 'Close', () => onClose());
  head.append(title, close);
  const say = el('p', 'pm-say');
  say.setAttribute('role', 'status');
  const view = el('div', 'pm-view');
  body.append(head, say, view);
  win.append(body);

  /** @type {string|null} the piece open, or null for the list */
  let openId = null;
  /** @type {any} */ let opened = null;
  let seen = -1;
  let said = '';
  const tell = (/** @type {string} */ text, ok = false) => { said = text; say.textContent = text; say.classList.toggle('ok', ok); };

  const empty = (/** @type {string} */ text) => view.append(el('p', 'pm-empty', text));

  const drawList = (/** @type {any} */ b) => {
    if (!b || b.state === 'unknown') { empty('Looking in your mailbox...'); return; }
    if (b.state === 'signed-out') { empty('Sign in to an account to receive post.'); return; }
    if (b.state === 'guest') { empty(postRefusalText('post-needs-account')); return; }
    if (b.state === 'error' && !b.post.length) { empty('The mailbox could not be read right now.'); return; }
    if (!b.post.length) { empty('Your mailbox is empty.'); return; }
    const list = el('div', 'pm-list');
    for (const p of b.post) {
      const row = /** @type {any} */ (el('button', `pm-row${p.read ? '' : ' unread'}${p.item && !p.claimed ? ' gift' : ''}`));
      row.type = 'button';
      const text = el('span', 'pm-text');
      text.append(el('span', 'pm-subject', p.subject), el('span', 'pm-from', `${p.from} - ${postDayText(p.sentAt)}`));
      row.append(el('span', 'pm-dot'), text);
      if (p.item) {
        const chip = el('span', `pm-chip ${rarityClass(p.item.rarity)}`.trim(), p.item.name);
        chip.append(el('span', 'pm-state', p.claimed ? 'Claimed' : 'Waiting'));
        row.append(chip);
      }
      row.addEventListener('click', () => openOne(p.id));
      list.append(row);
    }
    view.append(list);
  };

  const drawOne = (/** @type {any} */ b) => {
    const head = b?.post?.find((/** @type {any} */ p) => p.id === openId) ?? null;   // the piece open, as the box lists it
    if (!head) { openId = null; opened = null; drawList(b); return; }
    const back = button('pm-back', 'Back', () => { openId = null; opened = null; tell(''); draw(true); });
    const piece = el('article', 'pm-piece');
    piece.append(el('h4', 'pm-subject', head.subject), el('p', 'pm-from', `From ${head.from} - ${postDayText(head.sentAt)}`));
    piece.append(el('p', 'pm-body', opened?.body ?? 'Opening...'));
    if (head.item) {
      const card = el('div', 'pm-item');
      card.append(el('span', `pm-itemname ${rarityClass(head.item.rarity)}`.trim(), head.item.name));
      if (head.claimed) card.append(el('span', 'pm-state', 'Claimed - it is in your pack.'));
      else {
        const claim = button('pm-claim', b.busy ? 'Claiming...' : 'Claim', () => claimOne(head.id));
        if (b.busy) claim.disabled = true;
        card.append(claim);
      }
      piece.append(card);
    }
    const foot = el('div', 'pm-foot');
    foot.append(back);
    if (!head.item || head.claimed) foot.append(button('pm-throw', 'Throw away', () => throwOne(head.id)));
    piece.append(foot);
    view.append(piece);
  };

  const draw = (force = false) => {
    const b = box();
    const v = b ? b.version : -2;
    if (!force && v === seen) return;
    seen = v;
    view.textContent = '';
    if (openId) drawOne(b); else drawList(b);
    if (say.textContent !== said) say.textContent = said;
  };

  const openOne = async (/** @type {string} */ id) => {
    openId = id; opened = null; tell('');
    draw(true);
    const b = box();
    const r = b ? await b.open(id) : { ok: false, error: 'signed-out' };
    if (openId !== id) return;
    if (r.ok) opened = r.post; else { tell(postRefusalText(r.error)); if (r.error === 'no-post') openId = null; }
    draw(true);
  };
  const claimOne = async (/** @type {string} */ id) => {
    const b = box();
    if (!b) return;
    tell('');
    const r = await b.claim(id);
    if (r.ok) tell(`${r.item?.name ?? 'The item'} is in your pack.`, true);
    else tell(postRefusalText(r.error));
    draw(true);
  };
  const throwOne = async (/** @type {string} */ id) => {
    const b = box();
    if (!b) return;
    const r = await b.remove(id);
    if (r.ok) { openId = null; opened = null; tell(''); } else tell(postRefusalText(r.error));
    draw(true);
  };

  const b0 = box();
  if (b0 && (b0.state === 'unknown' || b0.state === 'error')) b0.refresh?.()?.catch?.(() => {});   // a first look, or another after a failed one
  draw(true);
  let tick = null;
  const step = () => { if (win.isConnected === false && tick) { clearInterval(tick); tick = null; return; } draw(); };
  tick = setInterval(step, every);
  globalThis.requestAnimationFrame?.(() => close.focus?.());
  return { root: win, stop: () => { if (tick) clearInterval(tick); tick = null; }, draw, close, openOne };
}
