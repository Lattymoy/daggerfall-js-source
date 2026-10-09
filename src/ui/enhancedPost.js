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
import { placeBeside } from './enhancedTimers.js';

/** How often the mark's count and the open window look at the box's version, ms. */
export const POST_TICK_MS = 500;

/** The window's own words for what is not the service's (a box with no session, a claim already under way). */
const POST_WORDS = Object.freeze({
  'signed-out': 'Sign in to an account to receive post.',
  busy: 'A claim is already under way.',
});
/** The words a refusal shows in the window - its own, else the account's own sentences (net/accountClient.js REFUSALS). */
export const postRefusalText = (/** @type {string|undefined} */ w) => (w && (POST_WORDS[w] ?? REFUSALS[w])) || 'The mailbox could not do that right now. Try again in a moment.';

/** A piece's date, in the player's own clock: "8 Oct". */
export const postDayText = (/** @type {number} */ sentAtS) => new Date(sentAtS * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** An item's rarity as its name wears it (`data-rarity`, LR1's attribute - the sheet colours each rung, enhancedStyle.js),
 *  or null: a rung's word alone, never anything the sheet could read as more. */
export const postRarity = (/** @type {string|null} */ r) => (typeof r === 'string' && /^[a-z]{1,16}$/.test(r) ? r : null);

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
 * THE WINDOW. `box()` the host's PostBox (net/serverPost.js), or null when there is none. `keep` is the caller's record of
 * what the window was showing (the piece open, the line said) - AUDIT SERVER-POST: the pause face is rebuilt by anything
 * that renders it (a quest's clock lapsing, the cloud's answer), and the window rebuilt with it reopens where it stood.
 * Answers { root, stop, draw }: the caller stops the tick when the window goes (a render, an unmount).
 * @param {Document} doc
 * @param {{ box: () => any, onClose: () => void, every?: number, keep?: { openId?: string|null, said?: string, ok?: boolean } }} o
 */
export function postWindow(doc, { box, onClose, every = POST_TICK_MS, keep = {} }) {
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
  let openId = typeof keep.openId === 'string' ? keep.openId : null;
  /** @type {any} the open piece's whole, or `{ error }` where it would not open */
  let opened = null;
  let seen = -1;
  /** AUDIT SERVER-POST: WHERE THE FOCUS GOES after the next draw - a draw empties the view, and a focus left on a button it
   *  took away fell to the page's body, where a Tab reached nothing. A key: 'back', 'claim', 'throw', 'retry', a row's id. */
  /** @type {string|null} */ let focusTo = null;
  const tell = (/** @type {string} */ text, ok = false) => { keep.said = text; keep.ok = ok; say.textContent = text; say.classList?.toggle?.('ok', ok); };
  if (keep.said) tell(keep.said, !!keep.ok);
  const setOpen = (/** @type {string|null} */ id) => { openId = id; keep.openId = id; };

  /** The key the element holding the focus answers to, if it is in the view. */
  const focusKeyOf = () => {
    const a = /** @type {any} */ (doc).activeElement;
    return a && view.contains?.(a) ? (a.getAttribute?.('data-key') ?? null) : null;
  };
  const keyed = (/** @type {any} */ n, /** @type {string} */ key) => { n.setAttribute('data-key', key); return n; };
  const focusKey = (/** @type {string|null} */ key) => {
    if (!key) return;
    const n = /** @type {HTMLElement|null} */ (view.querySelector?.(`[data-key="${key}"]`));
    if (n) n.focus?.({ preventScroll: true }); else close.focus?.();
  };

  const empty = (/** @type {string} */ text) => view.append(el('p', 'pm-empty', text));

  const drawList = (/** @type {any} */ b) => {
    if (!b || b.state === 'unknown') { empty('Looking in your mailbox...'); return; }
    if (b.state === 'signed-out') { empty(postRefusalText('signed-out')); return; }
    if (b.state === 'guest') { empty(postRefusalText('post-needs-account')); return; }
    if (b.state === 'error' && !b.post.length) {
      empty('The mailbox could not be read right now.');
      view.append(keyed(button('pm-retry', 'Try again', () => { b.refresh?.()?.catch?.(() => {}); focusTo = 'retry'; }), 'retry'));
      return;
    }
    if (!b.post.length) { empty('Your mailbox is empty.'); return; }
    const list = el('div', 'pm-list');
    for (const p of b.post) {
      const row = /** @type {any} */ (keyed(el('button', `pm-row${p.read ? '' : ' unread'}${p.item && !p.claimed ? ' gift' : ''}`), p.id));
      row.type = 'button';
      const text = el('span', 'pm-text');
      text.append(el('span', 'pm-subject', p.subject), el('span', 'pm-from', `${p.from} - ${postDayText(p.sentAt)}`));
      row.append(el('span', 'pm-dot'), text);
      if (!p.read) row.append(el('span', 'pm-sr', ' - unread'));   // said, as the dot is seen
      if (p.item) {
        const chip = el('span', 'pm-chip');
        const name = el('span', null, p.item.name);
        const rar = postRarity(p.item.rarity);
        if (rar) name.setAttribute('data-rarity', rar);
        chip.append(name, el('span', 'pm-state', p.claimed ? 'Claimed' : 'Waiting'));
        row.append(chip);
      }
      row.addEventListener('click', () => openOne(p.id));
      list.append(row);
    }
    view.append(list);
  };

  const drawOne = (/** @type {any} */ b) => {
    const head = b?.post?.find((/** @type {any} */ p) => p.id === openId) ?? null;   // the piece open, as the box lists it
    if (!head) { setOpen(null); opened = null; drawList(b); return; }
    const back = keyed(button('pm-back', 'Back', () => { const was = openId; setOpen(null); opened = null; tell(''); focusTo = was; draw(true); }), 'back');
    const piece = el('article', 'pm-piece');
    piece.append(el('h4', 'pm-subject', head.subject), el('p', 'pm-from', `From ${head.from} - ${postDayText(head.sentAt)}`));
    if (opened?.error) {
      piece.append(el('p', 'pm-body', 'This message could not be opened.'));
      piece.append(keyed(button('pm-retry', 'Try again', () => { focusTo = 'retry'; openOne(head.id); }), 'retry'));
    } else piece.append(el('p', 'pm-body', opened?.body ?? 'Opening...'));
    if (head.item) {
      const card = el('div', 'pm-item');
      const name = el('span', 'pm-itemname', head.item.name);
      const rar = postRarity(head.item.rarity);
      if (rar) name.setAttribute('data-rarity', rar);
      card.append(name);
      if (head.claimed) card.append(el('span', 'pm-state', 'Claimed.'));   // into whichever of the account's characters took it
      else {
        const claim = keyed(button('pm-claim', b.busy ? 'Claiming...' : 'Claim', () => claimOne(head.id)), 'claim');
        claim.setAttribute('aria-label', `Claim ${head.item.name}`);
        if (b.busy) claim.disabled = true;
        card.append(claim);
      }
      piece.append(card);
    }
    const foot = el('div', 'pm-foot');
    foot.append(back);
    if (!head.item || head.claimed) foot.append(keyed(button('pm-throw', 'Throw away', () => throwOne(head.id)), 'throw'));
    piece.append(foot);
    view.append(piece);
  };

  const draw = (force = false) => {
    const b = box();
    const v = b ? b.version : -2;
    if (!force && v === seen) return;
    seen = v;
    const had = focusKeyOf();
    view.textContent = '';
    if (openId) drawOne(b); else drawList(b);
    if (say.textContent !== (keep.said ?? '')) say.textContent = keep.said ?? '';
    const to = focusTo ?? had;
    focusTo = null;
    focusKey(to);
  };

  const openOne = async (/** @type {string} */ id, again = false) => {
    setOpen(id); opened = null;
    if (!again) tell('');   // reopened by a rebuild, the line it said stays said
    focusTo = 'back';
    draw(true);
    const b = box();
    const r = b ? await b.open(id) : { ok: false, error: 'signed-out' };
    if (openId !== id) return;
    if (r.ok) opened = r.post;
    else { tell(postRefusalText(r.error)); if (r.error === 'no-post') setOpen(null); else opened = { error: r.error }; }
    draw(true);
  };
  const claimOne = async (/** @type {string} */ id) => {
    const b = box();
    if (!b || b.busy) return;   // AUDIT SERVER-POST: a second press while the first is out is no second claim, and no busy sentence
    tell('');
    const going = b.claim(id);
    focusTo = 'claim';
    draw(true);   // the button down at once (the box is busy the moment the claim sets out)
    const r = await going;
    if (r.ok) { tell(`${r.item?.name ?? 'The item'} is in your pack.`, true); focusTo = 'back'; }
    else tell(postRefusalText(r.error));
    draw(true);
  };
  const throwOne = async (/** @type {string} */ id) => {
    const b = box();
    if (!b) return;
    const r = await b.remove(id);
    if (r.ok) { setOpen(null); opened = null; tell(''); } else tell(postRefusalText(r.error));
    draw(true);
    if (r.ok) (view.querySelector?.('.pm-row') ?? close).focus?.();
  };

  const b0 = box();
  if (b0 && (b0.state === 'unknown' || b0.state === 'error')) b0.refresh?.()?.catch?.(() => {});   // a first look, or another after a failed one
  draw(true);
  if (openId) openOne(openId, true);   // reopened where it stood: its words read again (the box keeps them - no second call)
  let tick = null;
  const step = () => { if (win.isConnected === false && tick) { clearInterval(tick); tick = null; return; } draw(); };
  tick = setInterval(step, every);
  if (!openId) globalThis.requestAnimationFrame?.(() => close.focus?.());
  return { root: win, stop: () => { if (tick) clearInterval(tick); tick = null; }, draw, close, openOne };
}
