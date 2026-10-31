// @ts-check
// PASS-PANELS (2026-10-30, the owner: "rework this to be more of a helldivers type system"; then "It shouldnt be called
// battle pass ... needs to be a panel that you open. To reveal the track rewards. Like hell divers"): THE SHOP'S FOLIOS.
// The season's story, its stages and the Aurum its finds earned today; then a cover a folio (a track) that opens into its
// spread, a page (a panel) at a time - each item its picture, name, price in Aurum and press; then the stage's challenges.
// A page opens once its folio has had its Aurum spent in it, the Gilded Folio once it is unlocked with Aurum, and every
// spend is pressed twice, as a daily ware's. Wired by enhancedShop.js; the law is net/battlePassLaw.js.
import {
  PASS_TRACKS, PASS_CHALLENGES, PASS_PREMIUM_AURUM, passSeasonById, passSeasonShown, passPanelsOf, passItemOf, passSpentOn,
  passPanelOpen, passBuyBlock, passTracksOpen, passOpen,
} from '../../net/battlePassLaw.js';
import {
  PASS_SEASON_TEXT, PASS_SEASON_LOOK, PASS_STAGE_TEXT, PASS_PANEL_TEXT as W, passChallengeText, passGrantName, passGrantKind,
  passPanelNumeral, passFolioName,
} from '../passText.js';
import { accountRefusalText } from '../../net/accountClient.js';   // AUDIT-STOREFRONT III C10: a refusal in the account flow's own words, one table
import { GRIMOIRE_DRESS } from '../grimoireDress.js';
import { wareArtNode } from '../wareArt.js';
import { aurumArtNode } from '../aurumArt.js';
import { titleBadge, paintTitle } from '../playerBadge.js';

/** The season the section shows: the card's, else the one running or the next to come. Pure. */
export const passShownSeason = (/** @type {any} */ flow, /** @type {number} */ nowMs) => passSeasonById(flow?.pass?.season) ?? passSeasonShown(nowMs);
/** The account's card for a season, or null. */
const cardFor = (/** @type {any} */ flow, /** @type {string} */ season) => (flow?.pass?.season === season ? flow.pass : null);
/** The grants an account bought of a season's folios. */
const boughtOf = (/** @type {any} */ flow, /** @type {string} */ season) => { const b = cardFor(flow, season)?.bought; return Array.isArray(b) ? b : []; };
/** Every item a season's folios hold, in their order: `{ grant, aurum, track, panel }`. Pure. */
export const passItemsIn = (/** @type {string} */ season) => PASS_TRACKS.flatMap((track) => passPanelsOf(season, track).flatMap((p, panel) => p.items.map((it) => ({ ...it, track, panel }))));
/** THE PAGE A FOLIO OPENS ON: the first with an item still to buy, else the first. Pure. */
export const passLandingPage = (/** @type {string} */ season, /** @type {string} */ track, /** @type {ReadonlyArray<string>} */ bought) =>
  Math.max(0, passPanelsOf(season, track).findIndex((p) => p.items.some((it) => !bought.includes(it.grant))));
/** Each folio's emblem on its cover - an item it holds, drawn as every face draws it (ui/wareArt.js). */
export const PASS_FOLIO_EMBLEM = Object.freeze({ s1: Object.freeze({ free: 'glyph:cog', premium: 'icon:gearheart' }) });

/** WHY NOBODY CAN BUY HERE, or null: 'reading', 'out' (nobody signed in), 'guest', 'closed' (no pass card, the Folios
 *  shut or Aurum shut - AUDIT-STOREFRONT III B3: the service refuses a buy when either switch is off). Pure. */
export function passCannot(/** @type {any} */ flow) {
  if (!flow || flow.stage === 'loading') return 'reading';
  if (flow.stage !== 'in') return 'out';
  if (!flow.account?.handle) return 'guest';
  if (!flow.pass?.open || !flow.aurum?.open) return 'closed';
  return null;
}
/** Afford or short of `price`, off the Aurum card's balance. */
const pay = (/** @type {any} */ flow, /** @type {number} */ price) => {
  const bal = Number(flow?.aurum?.balance) || 0;
  return bal >= price ? { state: 'afford', price } : { state: 'short', price, need: price - bal };   // AUDIT AURUM-SPEND F5: a debt counts
};
/**
 * WHAT AN ITEM IN A FOLIO OFFERS, from the flow as it stands. Pure. `state`: 'held', 'afford' (Buy, for `price` Aurum),
 * 'short' (`need` more Aurum), 'panel' (its page shut: `need` more spent in its folio opens it), 'track' (the Gilded Folio
 * not unlocked), 'soon' (the season's folios not open yet), 'item' (no folio holds it), or why nobody can buy here.
 * @param {any} flow @param {string} season @param {string} grant @param {number} nowMs
 */
export function passItemState(flow, season, grant, nowMs) {
  const at = passItemOf(season, grant), price = at?.aurum ?? 0, bought = boughtOf(flow, season);
  if (bought.includes(grant)) return { state: 'held', price };
  const no = passCannot(flow) ?? (cardFor(flow, season) ? null : 'closed');
  if (no) return { state: no, price };
  const block = passBuyBlock(season, grant, { premium: flow.pass.tracks?.premium === true, bought, nowMs });
  if (block === 'panel' && at) return { state: 'panel', price, need: Math.max(0, passPanelsOf(season, at.track)[at.panel].open - passSpentOn(season, at.track, bought)) };
  return block ? { state: block, price } : pay(flow, price);
}
/** WHAT THE GILDED FOLIO'S UNLOCK OFFERS. Pure. 'held' (unlocked), 'afford', 'short' (`need` more), 'soon', or why nobody
 *  can buy here. @param {any} flow @param {string} season @param {number} nowMs */
export function passUnlockState(flow, season, nowMs) {
  const price = /** @type {Record<string, number>} */ (PASS_PREMIUM_AURUM)[season] ?? 0;
  if (cardFor(flow, season)?.tracks?.premium === true) return { state: 'held', price };
  const no = passCannot(flow) ?? (cardFor(flow, season) ? null : 'closed');
  if (no) return { state: no, price };
  return passTracksOpen(passSeasonById(season), nowMs) ? pay(flow, price) : { state: 'soon', price };
}

/** A padlock, on what a folio keeps shut. */
function lockNode(/** @type {Document} */ doc, /** @type {string} */ cls) {
  const NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg'), p = doc.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ viewBox: '0 0 12 12', class: `sh-lock ${cls}`, 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  for (const [k, v] of Object.entries({ d: 'M3 5.5V4a3 3 0 0 1 6 0v1.5h.5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 2 11V6a.5.5 0 0 1 .5-.5Zm1.5 0h3V4a1.5 1.5 0 0 0-3 0Z', fill: 'currentColor', 'fill-rule': 'evenodd' })) p.setAttribute(k, v);
  svg.append(p);
  return svg;
}
/** A folio's leather and its metal: the Brass Folio's brown and brass, the Gilded Folio's wine and gold leaf. */
const FOLIO_INK = Object.freeze({
  free: Object.freeze({ hide: ['#5a3818', '#24160a'], metal: '#c8954a', hi: '#f0c987' }),
  premium: Object.freeze({ hide: ['#4a1838', '#1a0814'], metal: '#e8b84a', hi: '#fff0b0' }),
});
let folioIds = 0;
/** A FOLIO'S COVER, drawn: its leather, spine, framed border, corner fittings, a medallion for its emblem and a title plate -
 *  the Gilded Folio's with gold leaf about its medallion and studs on its frame. */
function folioCover(/** @type {Document} */ doc, /** @type {string} */ track) {
  const NS = 'http://www.w3.org/2000/svg', ink = FOLIO_INK[/** @type {keyof typeof FOLIO_INK} */ (track)] ?? FOLIO_INK.free, id = `sh-fhide-${++folioIds}`;
  const n = (/** @type {string} */ tag, /** @type {Record<string, any>} */ a) => { const x = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) x.setAttribute(k, String(v)); return x; };
  const svg = n('svg', { viewBox: '0 0 120 160', class: 'sh-fbook', 'aria-hidden': 'true' });
  const defs = n('defs', {}), grad = n('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 });
  grad.append(n('stop', { offset: 0, 'stop-color': ink.hide[0] }), n('stop', { offset: 1, 'stop-color': ink.hide[1] }));
  defs.append(grad);
  svg.append(defs, n('rect', { x: 3, y: 2, width: 114, height: 156, rx: 3, fill: `url(#${id})`, stroke: '#120a04', 'stroke-width': 2 }),
    n('rect', { x: 3, y: 2, width: 12, height: 156, fill: '#000000', opacity: 0.3 }),
    n('rect', { x: 5, y: 22, width: 8, height: 3, fill: ink.metal }), n('rect', { x: 5, y: 135, width: 8, height: 3, fill: ink.metal }),
    n('rect', { x: 22, y: 10, width: 88, height: 140, fill: 'none', stroke: ink.metal, 'stroke-width': 2 }),
    n('rect', { x: 26, y: 14, width: 80, height: 132, fill: 'none', stroke: ink.metal, 'stroke-width': 0.8, opacity: 0.7 }));
  for (const [x, y, sx, sy] of [[22, 10, 1, 1], [110, 10, -1, 1], [22, 150, 1, -1], [110, 150, -1, -1]]) {
    svg.append(n('path', { d: 'M0 0 h15 l-4 4 h-7 v7 l-4 4 Z', fill: ink.metal, stroke: ink.hi, 'stroke-width': 0.5, transform: `translate(${x} ${y}) scale(${sx} ${sy})` }));
  }
  if (track === 'premium') {   // gold leaf: rays about the medallion, studs along the frame
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      svg.append(n('line', { x1: 66 + c * 31, y1: 64 + s * 31, x2: 66 + c * (i % 2 ? 36 : 40), y2: 64 + s * (i % 2 ? 36 : 40), stroke: ink.metal, 'stroke-width': 1.2, opacity: 0.85 }));
    }
    for (const [x, y] of [[66, 10], [66, 150], [22, 80], [110, 80]]) svg.append(n('circle', { cx: x, cy: y, r: 2.4, fill: ink.hi, stroke: '#3a2400', 'stroke-width': 0.6 }));
  }
  svg.append(n('circle', { cx: 66, cy: 64, r: 28, fill: '#0b0a10', opacity: 0.6, stroke: ink.metal, 'stroke-width': 1.6 }),
    n('rect', { x: 38, y: 116, width: 56, height: 13, rx: 1.5, fill: ink.metal, stroke: '#2a1a08', 'stroke-width': 0.8 }),
    n('rect', { x: 44, y: 121.5, width: 44, height: 2, fill: '#000000', opacity: 0.35 }));
  return svg;
}

/** THE SECTION, built once a tab: its nodes in the window's order (the head, the folios, the challenges) and `draw`, which
 *  brings each up to date in place - a press keeps its focus as it turns. The folio open and its page are kept in `keep`.
 * @param {Document} doc
 * @param {{ flow: () => any, now: () => number, el: (tag: string, cls: string|null, text?: string|null) => any, button: (cls: string, text: string, fn: () => void) => any,
 *   num: (n: number) => string, dayText: (ms: number) => string, armed: (id: string) => boolean, arm: (id: string|null) => void, redraw: () => void,
 *   canGetAurum: () => boolean, toAurum: () => void, wearPress: (w: { kind: string, key: string }, worn: boolean) => any,
 *   worn: (w: { kind: string, key: string }) => boolean, keep: { folio?: string|null, page?: number }, reduced: boolean }} o */
export function passSection(doc, o) {
  const { el, keep } = o;
  const season = /** @type {NonNullable<ReturnType<typeof passSeasonById>>} */ (passShownSeason(o.flow(), o.now()));
  const sid = season.id;
  /** @type {string|null} the spend whose answer is out */
  let pending = null;
  /** @type {{ id: string, error: string, text: string }|null} the last refusal, said on the press it answers */
  let said = null;
  /** @type {{ error: string, note: string }|null} AUDIT-STOREFRONT III C10/C11: the flow's words a spend's answer left - the
   *  section says them, so the window's own line does not say them again */
  let heard = null;
  const says = (/** @type {any} */ fl) => !!heard && !!(heard.error || heard.note) && (fl?.error || '') === heard.error && (fl?.note || '') === heard.note;
  // AUDIT-STOREFRONT III C4: the Grimoire's face draws a capital I as a 1 - its pages are numbered 1, 2, 3
  const numeral = (/** @type {number} */ p) => passPanelNumeral(p, doc.documentElement?.dataset?.plusDress === GRIMOIRE_DRESS);

  // ── THE HEAD: the story, the stages, how the folios work, the day's finds, who can buy ──
  const head = el('section', 'sh-pass');
  const name = el('h4', 'sh-passname', PASS_SEASON_TEXT[/** @type {keyof typeof PASS_SEASON_TEXT} */ (sid)]?.() ?? sid);
  name.id = 'sh-passname';
  head.setAttribute('aria-labelledby', name.id);
  const stages = el('ol', 'sh-stages');
  let stagesKey = '';
  const day = el('div', 'sh-passday'), dayWords = el('span', 'sh-daytext'), bar = el('div', 'sh-daybar'), fill = el('div', 'sh-dayfill');
  bar.append(fill);
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', W.foundLabel());
  bar.setAttribute('aria-valuemin', '0');
  day.append(dayWords, bar, el('p', 'sh-passline', W.foundLine()));
  const who = el('p', 'sh-passwho');
  const live = el('p', 'sh-sr');   // a refusal said to a screen reader as well as on its press
  live.setAttribute('role', 'status');
  const note = el('p', 'sh-pnote');   // AUDIT-STOREFRONT III C11: a spend's answer, said beside the folio it was made in
  note.setAttribute('role', 'status');
  head.append(name, el('p', 'sh-passlook', PASS_SEASON_LOOK[/** @type {keyof typeof PASS_SEASON_LOOK} */ (sid)]?.() ?? ''), stages, el('p', 'sh-passhow', W.how()), day, who, live);

  // ── A SPEND: armed by the first press, made by the second; its answer said on the press ──
  const spend = (/** @type {string} */ id, /** @type {(fl: any) => any} */ go) => {
    const fl = o.flow();
    if (!fl || fl.busy || pending) return;
    said = null;
    live.textContent = '';
    if (!o.armed(id)) { o.arm(id); return; }
    pending = id;
    o.arm(null);
    /** @type {Promise<any>} */ let asked;
    try { asked = Promise.resolve(go(fl)); } catch (e) { asked = Promise.reject(e); }
    const refused = (/** @type {string} */ error) => { said = { id, error, text: accountRefusalText(error) }; };
    asked.then((r) => { if (!r?.ok) refused(String(r?.error ?? 'server')); }, () => refused('offline'))
      .finally(() => {
        pending = null;
        const after = o.flow();
        heard = { error: after?.error || '', note: after?.note || '' };
        if (said) live.textContent = said.text;
        o.redraw();
        if (!said && heard.note) note.scrollIntoView?.({ block: 'nearest' });   // AUDIT-STOREFRONT III C11: in sight without a scroll
      });
  };
  /** A press, swapped in when what it offers turns - the focus kept on it, or (AUDIT-STOREFRONT III C1) given to `home`
   *  when none takes its place. */
  const swap = (/** @type {any} */ d, /** @type {any} */ host, /** @type {string} */ key, /** @type {() => any} */ make, /** @type {() => any} */ home = () => null) => {
    if (d.actKey === key) return;
    const had = d.act && doc.activeElement === d.act;
    d.act?.remove?.();
    d.act = make();
    d.actKey = key;
    if (d.act) { host.append(d.act); if (had) d.act.focus?.({ preventScroll: true }); } else if (had) home()?.focus?.({ preventScroll: true });
  };
  const busyNow = (/** @type {any} */ fl) => !!fl?.busy || pending;
  /** A spend's press: its words, armed or not, and its full words for a screen reader; AUDIT-STOREFRONT III C12: while its
   *  answer is out, its third words (Buying..., Unlocking...) - never the first press's, which read as called off. */
  const spendPress = (/** @type {string} */ cls, /** @type {string} */ id, /** @type {[string, string, string]} */ words, /** @type {[string, string]} */ labels, /** @type {(fl: any) => any} */ go, /** @type {any} */ fl) => {
    const on = o.armed(id), going = pending === id;
    const b = o.button(`sh-buy sh-aurumbuy ${cls}`, going ? words[2] : on ? words[1] : words[0], () => spend(id, go));
    if (!going) b.setAttribute('aria-label', on ? labels[1] : labels[0]);
    if (on || going) b.setAttribute('data-armed', 'true');
    if (busyNow(fl)) b.setAttribute('aria-disabled', 'true');
    return b;
  };
  const shortOf = (/** @type {string} */ id) => said?.id === id && said.error === 'pass-short';
  /** A price's number as it is seen, and its words with the currency for a screen reader (AUDIT-STOREFRONT III C9: a
   *  span's aria-label is dropped from the tree). */
  const priceWords = (/** @type {number} */ n) => {
    const seen = el('span', 'sh-pricen', o.num(n));
    seen.setAttribute('aria-hidden', 'true');
    return [seen, el('span', 'sh-sr', W.price(n))];
  };
  /** Why no press stands on an item or the unlock (AUDIT-STOREFRONT III C5), in the shop's short words, or ''. */
  const reasonOf = (/** @type {string} */ state) => (state === 'soon' ? W.itemSoon(o.dayText(season.fromMs)) : state === 'closed' ? W.itemClosed()
    : state === 'guest' ? W.itemGuest() : state === 'out' ? W.itemOut() : '');
  /** The Gilded Folio's unlock: its price, what more it needs, its press - on its cover and in its spread. */
  const unlockNode = () => {
    const row = el('div', 'sh-punlock'), cost = el('span', 'sh-price sh-aurumprice'), coin = aurumArtNode(doc, 0, 22, 'sh-coin');
    const n = /** @type {Record<string, number>} */ (PASS_PREMIUM_AURUM)[sid] ?? 0;
    if (coin) cost.append(coin);
    cost.append(...priceWords(n));
    const state = el('span', 'sh-state');
    row.append(cost, state);
    return { row, state, act: null, actKey: '' };
  };
  const drawUnlock = (/** @type {any} */ u, /** @type {any} */ fl, /** @type {number} */ nowMs, /** @type {() => any} */ home) => {
    const st = /** @type {any} */ (passUnlockState(fl, sid, nowMs)), id = `unlock:${sid}`, bad = said?.id === id ? said.text : '';
    u.row.hidden = st.state === 'held';
    const words = bad || (st.state === 'short' ? W.short(st.need) : reasonOf(st.state));
    if (u.state.textContent !== words) u.state.textContent = words;
    u.state.className = `sh-state sh-state-${bad ? 'bad' : st.state}`;
    const getA = (st.state === 'short' || shortOf(id)) && o.canGetAurum(), nm = passFolioName(sid, 'premium');
    swap(u, u.row, `${st.state}:${o.armed(id) ? 1 : 0}:${busyNow(fl) ? 1 : 0}:${getA ? 1 : 0}`, () => {
      if (st.state === 'afford') return spendPress('sh-punlockb', id, [W.unlock(st.price), W.unlockConfirm(st.price), W.unlocking()], [W.unlockLabel(nm, st.price), W.unlockConfirmLabel(nm, st.price)], (f) => f.passUnlock?.(sid), fl);
      return getA ? o.button('sh-getaurum', W.getAurum(), () => o.toAurum()) : null;
    }, home);   // AUDIT-STOREFRONT III C1: unlocked, its row goes - the focus to what stays
  };

  // ── THE FOLIOS: their covers, or one opened on its spread ──
  const body = el('div', 'sh-folios');
  /** @type {Map<string, any>} the items drawn now, by grant */
  let items = new Map();
  /** @type {Record<string, any>} each cover's parts, by track - while the covers stand */
  let covers = {};
  /** @type {any} the open spread's parts, or null */
  let spread = null;

  const itemNode = (/** @type {string} */ grant) => {
    const i = grant.indexOf(':'), kind = grant.slice(0, i), key = grant.slice(i + 1), price = passItemOf(sid, grant)?.aurum ?? 0;
    const card = el('article', `sh-pitem sh-pitem-${kind}`);
    card.setAttribute('data-grant', grant);
    const pic = el('div', 'sh-pitempic'), art = wareArtNode(doc, grant, 64, 'sh-pitemart'), tick = el('span', 'sh-ptick', '✓');
    tick.setAttribute('aria-hidden', 'true');
    if (art) pic.append(art);
    pic.append(lockNode(doc, 'sh-plock'), tick);
    const word = el('span', 'sh-rewardname', passGrantName(grant));
    if (kind === 'title') { paintTitle(word, titleBadge({ title: key }), false); word.style?.setProperty?.('--n', String(passGrantName(grant).length)); }   // on the tile's wood: its own paint
    const buy = el('div', 'sh-pitembuy'), cost = el('span', 'sh-price sh-aurumprice'), coin = aurumArtNode(doc, 0, 18, 'sh-coin');
    if (coin) cost.append(coin);
    cost.append(...priceWords(price));
    const state = el('span', 'sh-state');
    buy.append(cost, state);
    card.append(pic, word, el('span', 'sh-rewardkind', passGrantKind(grant)), buy);
    items.set(grant, { card, buy, state, kind, key, act: null, actKey: '' });
    return card;
  };
  const coverNode = (/** @type {string} */ track) => {
    const box = el('article', `sh-folio sh-folio-${track}`), face = el('button', `sh-fcover sh-fcover-${track}`);
    face.type = 'button';
    face.setAttribute('data-folio', track);
    face.addEventListener('click', () => openFolio(track));
    const art = el('div', 'sh-fcoverart'), emblem = wareArtNode(doc, /** @type {any} */ (PASS_FOLIO_EMBLEM)[sid]?.[track] ?? '', 56, 'sh-femblem');
    art.append(folioCover(doc, track));
    if (emblem) art.append(emblem);
    art.append(lockNode(doc, 'sh-flock'));
    const words = el('div', 'sh-fcoverwords'), n = passPanelsOf(sid, track).reduce((a, p) => a + p.items.length, 0);
    const prog = el('span', 'sh-fprog'), state = el('span', 'sh-fstate');
    words.append(el('span', 'sh-fname', passFolioName(sid, track)), el('span', 'sh-fholds', W.holds(n)), prog, state, el('span', 'sh-fopen', W.open()));
    face.append(art, words);
    box.append(face);
    const unlock = track === 'premium' ? unlockNode() : null;
    if (unlock) box.append(unlock.row);
    covers[track] = { face, prog, state, unlock, n };
    return box;
  };
  const showCovers = (/** @type {string|null} */ focusOn = null) => {
    keep.folio = null;
    body.textContent = '';
    items = new Map(); covers = {}; spread = null;
    const row = el('div', 'sh-fcovers');
    for (const track of PASS_TRACKS) row.append(coverNode(track));
    body.append(row, note);
    draw(o.flow());
    if (focusOn) covers[focusOn]?.face.focus?.({ preventScroll: true });
  };
  /** The spread: its head (Back, the folio's name, its spent, the Gilded Folio's unlock), its page arrows and tabs, a page. */
  const showSpread = (/** @type {string} */ track, /** @type {number} */ page, /** @type {boolean} */ turn) => {
    const pages = passPanelsOf(sid, track);
    keep.folio = track;
    body.textContent = '';
    items = new Map(); covers = {};
    const box = el('section', `sh-spread sh-spread-${track}${turn && !o.reduced ? ' sh-turnin' : ''}`), top = el('div', 'sh-spreadhead');
    const h = el('h4', 'sh-fname', passFolioName(sid, track));
    h.id = `sh-spread-${track}`;
    box.setAttribute('aria-labelledby', h.id);
    const back = o.button('sh-fback', W.back(), () => showCovers(track));
    back.setAttribute('aria-label', W.backLabel());
    const spent = el('span', 'sh-pspent'), line = el('p', 'sh-ptrackline');
    top.append(back, h, spent, line);
    const unlock = track === 'premium' ? unlockNode() : null;
    if (unlock) top.append(unlock.row);
    const nav = el('div', 'sh-pagenav'), tabs = el('div', 'sh-pagetabs');
    const prev = o.button('sh-pageprev', '', () => turnPage(-1, false)), next = o.button('sh-pagenext', '', () => turnPage(1, false));
    prev.setAttribute('aria-label', W.prev());
    next.setAttribute('aria-label', W.next());
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', W.pages(passFolioName(sid, track)));
    const tabList = pages.map((_, p) => {
      const tb = el('button', 'sh-pagetab');
      tb.type = 'button';
      tb.id = `sh-page-${track}-${p}`;
      tb.setAttribute('role', 'tab');
      const num = el('span', 'sh-pagetabnum', numeral(p));   // AUDIT-STOREFRONT III C16: a narrow screen shows the numeral alone (PASS_CSS)
      num.setAttribute('aria-hidden', 'true');
      tb.append(el('span', 'sh-pagetabword', W.page(numeral(p))), num, lockNode(doc, 'sh-tablock'), el('span', 'sh-tabtick', '✓'));
      tb.addEventListener('click', () => goPage(p, false));
      tabs.append(tb);
      return tb;
    });
    nav.append(prev, tabs, next);
    const host = el('div', 'sh-pagehost');
    box.append(top, nav, note, host);
    // the arrow keys turn the pages, Home and End the first and last; a swipe on the page turns it
    box.addEventListener?.('keydown', (/** @type {KeyboardEvent} */ e) => {
      const to = e.key === 'ArrowRight' ? spread.page + 1 : e.key === 'ArrowLeft' ? spread.page - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? pages.length - 1 : null;
      if (to == null || to < 0 || to >= pages.length) return;
      e.preventDefault?.(); e.stopPropagation?.();
      goPage(to, true);
    });
    let downX = /** @type {number|null} */ (null);
    host.addEventListener?.('pointerdown', (/** @type {PointerEvent} */ e) => { downX = e.clientX; });
    host.addEventListener?.('pointerup', (/** @type {PointerEvent} */ e) => {
      if (downX == null) return;
      const dx = e.clientX - downX;
      downX = null;
      if (Math.abs(dx) >= 40) turnPage(dx < 0 ? 1 : -1, false);
    });
    body.append(box);
    spread = { track, box, spent, line, unlock, prev, next, tabList, host, page: -1, pageState: null };
    showPage(Math.max(0, Math.min(pages.length - 1, page)), 0);
  };
  /** A page of the open spread, its items drawn; `dir` the way it turned (a flip that way), 0 for none. */
  const showPage = (/** @type {number} */ p, /** @type {number} */ dir) => {
    const s = spread, panel = passPanelsOf(sid, s.track)[p];
    s.page = p;
    keep.page = p;
    s.host.textContent = '';
    items = new Map();
    const page = el('div', `sh-page${dir && !o.reduced ? (dir > 0 ? ' sh-flipnext' : ' sh-flipprev') : ''}`), ph = el('div', 'sh-ppanelhead');
    page.setAttribute('role', 'tabpanel');
    page.setAttribute('aria-labelledby', s.tabList[p].id);
    s.pageState = el('span', 'sh-ppanelstate');
    ph.append(el('span', 'sh-ppanelnum', W.page(numeral(p))), s.pageState);
    const grid = el('div', 'sh-pitems');
    for (const it of panel.items) grid.append(itemNode(it.grant));
    page.append(ph, grid);
    s.host.append(page);
    draw(o.flow());
  };
  const goPage = (/** @type {number} */ p, /** @type {boolean} */ byKey) => {
    if (!spread || p === spread.page) return;
    showPage(p, p > spread.page ? 1 : -1);
    if (byKey) spread.tabList[p].focus?.();   // a turn by key: the focus on the page's tab, never left on a press gone
  };
  const turnPage = (/** @type {number} */ by, /** @type {boolean} */ byKey) => {
    if (!spread) return;
    const p = spread.page + by;
    if (p >= 0 && p < spread.tabList.length) goPage(p, byKey);
  };
  /** A cover pressed: its spread, on its first page with an item still to buy - the focus on that page's tab. */
  const openFolio = (/** @type {string} */ track) => {
    showSpread(track, passLandingPage(sid, track, boughtOf(o.flow(), sid)), true);
    spread?.tabList[spread.page]?.focus?.({ preventScroll: true });
  };

  // ── THE OPEN STAGE'S CHALLENGES: each its count and its Aurum, paid once ──
  const chal = el('section', 'sh-pchal'), over = el('p', 'sh-passline');
  const chalList = el('ul', 'sh-challenges');
  let chalKey = '';
  chalList.setAttribute('aria-label', W.challenges());
  chal.append(el('h5', 'sh-subhead', W.challenges()), chalList, over);

  const drawItem = (/** @type {string} */ grant, /** @type {any} */ d, /** @type {any} */ fl, /** @type {number} */ nowMs, /** @type {ReadonlyArray<string>} */ bought, /** @type {boolean} */ premium) => {
    const st = /** @type {any} */ (passItemState(fl, sid, grant, nowMs)), at = /** @type {NonNullable<ReturnType<typeof passItemOf>>} */ (passItemOf(sid, grant));
    const shut = st.state !== 'held' && ((at.track === 'premium' && !premium) || !passPanelOpen(sid, at.track, at.panel, bought));
    const id = `item:${grant}`, bad = said?.id === id ? said.text : '';
    const words = bad || (st.state === 'held' ? W.itemOwned() : st.state === 'short' ? W.short(st.need) : reasonOf(st.state) || (shut ? W.locked() : ''));
    if (d.state.textContent !== words) d.state.textContent = words;
    d.state.className = `sh-state sh-state-${bad ? 'bad' : st.state}`;
    const cls = `sh-pitem sh-pitem-${d.kind} fx-${d.kind}-${d.key} sh-pitem-${st.state}${shut ? ' sh-pitemlocked' : ''}`;
    if (d.card.className !== cls) d.card.className = cls;
    const worn = st.state === 'held' && o.worn(d), getA = (st.state === 'short' || shortOf(id)) && o.canGetAurum();
    swap(d, d.buy, `${st.state}:${worn ? 1 : 0}:${o.armed(id) ? 1 : 0}:${busyNow(fl) ? 1 : 0}:${getA ? 1 : 0}`, () => {
      if (st.state === 'held') return o.wearPress({ kind: d.kind, key: d.key }, worn);
      const nm = passGrantName(grant);
      if (st.state === 'afford') return spendPress('sh-pbuy', id, [W.buy(), W.confirm(), W.buying()], [W.buyLabel(nm, st.price), W.confirmLabel(nm, st.price)], (f) => f.passBuy?.(sid, grant), fl);
      return getA ? o.button('sh-getaurum', W.getAurum(), () => o.toAurum()) : null;
    });
  };
  /** A page's words: what of it is owned, or what opens it. */
  const pageWords = (/** @type {string} */ track, /** @type {number} */ p, /** @type {ReadonlyArray<string>} */ bought, /** @type {boolean} */ premium, /** @type {boolean} */ card) => {
    const panel = passPanelsOf(sid, track)[p];
    // AUDIT-STOREFRONT III C17: the folio's lock first - nothing is spent in a shut folio, so a page's Aurum is no way in
    if (track === 'premium' && !premium) return { locked: true, words: W.pageFolio() };
    if (!passPanelOpen(sid, track, p, bought)) return { locked: true, words: W.pageLocked(panel.open - passSpentOn(sid, track, bought)) };
    return { locked: false, words: card ? W.owned(panel.items.filter((it) => bought.includes(it.grant)).length, panel.items.length) : '' };
  };
  const drawStages = (/** @type {number} */ nowMs) => {
    const rows = season.stages.map((st) => (nowMs >= st.toMs ? ['done', W.stageEnded(o.dayText(st.toMs - 1))] : nowMs >= st.fromMs ? ['open', W.stageUntil(o.dayText(st.toMs - 1))] : ['soon', W.stageOpens(o.dayText(st.fromMs))]));
    const key = JSON.stringify(rows);
    if (key === stagesKey) return;
    stagesKey = key;
    stages.textContent = '';
    season.stages.forEach((st, i) => {
      const li = el('li', `sh-stagechip sh-stage-${rows[i][0]}`);
      li.append(el('span', 'sh-stagenum', numeral(i)), el('span', 'sh-stagename', PASS_STAGE_TEXT[/** @type {keyof typeof PASS_STAGE_TEXT} */ (st.key)]?.() ?? st.key), el('span', 'sh-stagewhen', rows[i][1]));
      stages.append(li);
    });
  };
  const drawChallenges = (/** @type {any} */ card, /** @type {number} */ nowMs) => {
    const running = passOpen(season, nowMs), st = card && running ? card.stage : season.stages.findIndex((s) => nowMs >= s.fromMs && nowMs < s.toMs);
    const key = JSON.stringify([st, running, nowMs >= season.toMs, card?.challenges ?? null]);
    if (key === chalKey) return;
    chalKey = key;
    chal.hidden = !running && nowMs < season.toMs;   // before the season: nothing to count yet
    over.textContent = nowMs >= season.toMs ? W.over() : '';
    chalList.textContent = '';
    for (const c of running ? PASS_CHALLENGES.filter((x) => x.stage === st) : []) {
      const got = card?.challenges?.find((/** @type {any} */ x) => x.key === c.key), n = Math.min(c.n, got?.n ?? 0);
      const li = el('li', `sh-challenge${got?.paid ? ' sh-cdone' : ''}`), meter = el('div', 'sh-cmeter'), cf = el('div', 'sh-cfill');
      cf.style.width = `${Math.round((n / c.n) * 100)}%`;
      meter.append(cf);
      li.append(el('span', 'sh-cwhat', passChallengeText(c.key)), meter, el('span', 'sh-ccount', `${o.num(n)} / ${o.num(c.n)}`), el('span', 'sh-caurum', W.challengePay(c.aurum)));
      chalList.append(li);
    }
  };

  const draw = (/** @type {any} */ fl) => {
    const nowMs = o.now(), card = cardFor(fl, sid), bought = boughtOf(fl, sid), premium = card?.tracks?.premium === true;
    drawStages(nowMs);
    day.hidden = !card;
    if (card) {
      const tx = W.found(card.today, card.dayMax);
      if (dayWords.textContent !== tx) dayWords.textContent = tx;
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, card.today / (card.dayMax || 1))) * 100)}%`;
      bar.setAttribute('aria-valuemax', String(card.dayMax));
      bar.setAttribute('aria-valuenow', String(card.today));
    }
    const no = passCannot(fl);
    const whoText = no === 'reading' ? W.reading() : no === 'out' ? W.signIn() : no === 'guest' ? W.guest() : no === 'closed' ? W.closed()
      : passTracksOpen(season, nowMs) ? '' : W.soon(o.dayText(season.fromMs));
    if (who.textContent !== whoText) who.textContent = whoText;
    for (const [track, c] of Object.entries(covers)) {   // a cover: what it holds owned, Free or Unlocked or Locked, its label whole
      const has = passItemsIn(sid).filter((it) => it.track === track && bought.includes(it.grant)).length, shut = track === 'premium' && !premium;
      const stateWord = track === 'free' ? W.free() : shut ? W.locked() : W.unlocked(), prog = W.owned(has, c.n);
      if (c.prog.textContent !== prog) c.prog.textContent = prog;
      if (c.state.textContent !== stateWord) c.state.textContent = stateWord;
      c.face.className = `sh-fcover sh-fcover-${track}${shut ? ' sh-fcover-locked' : ''}`;
      c.face.setAttribute('aria-label', W.coverLabel(passFolioName(sid, track), stateWord, has, c.n));
      if (c.unlock) drawUnlock(c.unlock, fl, nowMs, () => c.face);
    }
    if (spread) {
      const s = spread, track = s.track;
      // AUDIT-STOREFRONT III C13: what the account spent here, off the service's ledger - never what its items are worth (an
      // Admin holds every item and spent nothing); an older service's card says none, so its items' worth
      const spentText = card && (track === 'free' || premium) ? W.spent(card.spent?.[track] ?? passSpentOn(sid, track, bought)) : '';
      if (s.spent.textContent !== spentText) s.spent.textContent = spentText;
      const lineText = track === 'free' ? W.freeLine() : premium ? W.premiumOpen() : W.premiumLine();
      if (s.line.textContent !== lineText) s.line.textContent = lineText;
      if (s.unlock) drawUnlock(s.unlock, fl, nowMs, () => s.tabList[s.page]);
      s.tabList.forEach((/** @type {any} */ tb, /** @type {number} */ p) => {
        const pw = pageWords(track, p, bought, premium, !!card), on = p === s.page;
        const done = !pw.locked && passPanelsOf(sid, track)[p].items.every((it) => bought.includes(it.grant));
        tb.className = `sh-pagetab${on ? ' on' : ''}${pw.locked ? ' sh-pagetab-locked' : ''}${done ? ' sh-pagetab-done' : ''}`;
        tb.setAttribute('aria-selected', on ? 'true' : 'false');
        tb.tabIndex = on ? 0 : -1;
        tb.setAttribute('aria-label', W.pageTab(numeral(p), pw.locked ? W.locked() : pw.words || W.free()));
      });
      // AUDIT-STOREFRONT III C2: an end's arrow says it cannot turn and keeps the focus a press on it left there
      s.prev.setAttribute('aria-disabled', s.page <= 0 ? 'true' : 'false');
      s.next.setAttribute('aria-disabled', s.page >= s.tabList.length - 1 ? 'true' : 'false');
      const pw = pageWords(track, s.page, bought, premium, !!card);
      if (s.pageState.textContent !== pw.words) s.pageState.textContent = pw.words;
      s.pageState.className = `sh-ppanelstate${pw.locked ? ' sh-ppanelstate-locked' : ''}`;
    }
    for (const [grant, d] of items) drawItem(grant, d, fl, nowMs, bought, premium);
    drawChallenges(card, nowMs);
    const noteText = says(fl) && !said ? heard?.note ?? '' : '';
    if (note.textContent !== noteText) note.textContent = noteText;
  };
  // a face rebuilt around the window opens where it was, without the turn
  if (keep.folio && PASS_TRACKS.includes(keep.folio)) showSpread(keep.folio, keep.page ?? 0, false);
  else showCovers();
  // AUDIT-STOREFRONT III C8: `back` - Escape in an open folio goes back to its cover (true), never the window shut; C10/C11:
  // `says` - whether the flow's line is the section's to say
  const back = () => { if (!spread) return false; showCovers(spread.track); return true; };
  return { nodes: [head, body, chal], draw, back, says };
}

/** THE SECTION'S SHEET: geometry and words alone - every surface's paint is the kit's, by its role (enhancedFrame.js
 *  FRAME_ROLES: a folio, its spread and the challenges panels, a cover and an item tiles, a picture a well, a page's tab
 *  the kit's tab, the spent a chip, the day's finds a meter); a picture keeps its own ground. Laid in SHOP_CSS. */
export const PASS_CSS = `
.px-shopwin :is(.sh-folio, .sh-spread, .sh-pchal) { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-width: 2px; border-style: solid; min-width: 0; }
.px-shopwin .sh-pchal[hidden], .px-shopwin .sh-passday[hidden], .px-shopwin .sh-punlock[hidden] { display: none; }
.px-shopwin .sh-passhow { margin: 0; font-size: 13.5px; line-height: 1.45; color: #fff4e0; }
.px-shopwin .sh-passday { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }   /* AUDIT-STOREFRONT III C3: never wider than its panel */
.px-shopwin .sh-passday .sh-passline { flex-basis: 100%; }
.px-shopwin .sh-daytext { flex: 0 1 auto; min-width: 0; font-size: 14px; color: #ffe29a; font-variant-numeric: tabular-nums; }
.px-shopwin .sh-passday .sh-daybar { flex: 1 1 90px; }
.px-shopwin .sh-daybar, .px-shopwin .sh-cmeter { height: 12px; box-sizing: border-box; border-width: 2px; border-style: solid; background-color: rgba(0,0,0,0.5); }
.px-shopwin .sh-dayfill, .px-shopwin .sh-cfill { height: 100%; background: linear-gradient(90deg, #c89a4a, #f3cf86); }
.px-shopwin .sh-passline { margin: 0; font-size: 12.5px; color: #e2dccd; }
.px-shopwin .sh-passline:empty { display: none; }
.px-shopwin .sh-passwho { margin: 0; font-size: 13.5px; color: #ffd27a; }
.px-shopwin .sh-passwho:empty { display: none; }
/* THE COVERS: a folio a large closed cover, side by side; the whole cover the press that opens it */
.px-shopwin .sh-folios { display: flex; flex-direction: column; min-width: 0; }
.px-shopwin .sh-fcovers { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.px-shopwin .sh-fcover { font: inherit; color: #f4ecd8; display: grid; grid-template-columns: 120px minmax(0, 1fr); align-items: center; gap: 16px; padding: 12px;
  border-width: 2px; border-style: solid; background-color: transparent; text-align: left; cursor: pointer; }
.px-shopwin .sh-fcoverart { position: relative; width: 120px; height: 160px; filter: drop-shadow(3px 4px 0 rgba(0,0,0,0.45)); }
.px-shopwin .sh-fbook { display: block; width: 100%; height: 100%; }
.px-shopwin .sh-femblem { position: absolute; left: 55%; top: 40%; width: 46%; height: auto; translate: -50% -50%; }
.px-shopwin .sh-fcover-locked .sh-femblem { filter: grayscale(0.6) brightness(0.7); }
.px-shopwin .sh-flock { position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; color: #f3cf86; display: none; filter: drop-shadow(1px 1px 0 #000); }
.px-shopwin .sh-fcover-locked .sh-flock { display: block; }
.px-shopwin .sh-fcoverwords { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; }
.px-shopwin .sh-fname { margin: 0; font-size: 21px; letter-spacing: 0.06em; color: #ffe2a8; line-height: 1.15; }
.px-shopwin .sh-fcover-premium .sh-fname, .px-shopwin .sh-spread-premium .sh-fname { color: #ffd27a; }
.px-shopwin .sh-fholds { font-size: 13px; color: #e2dccd; }
.px-shopwin .sh-fprog { font-size: 13px; color: #9fe8b4; font-variant-numeric: tabular-nums; }
.px-shopwin .sh-fstate { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #9fdcff; }
.px-shopwin .sh-fcover-locked .sh-fstate { color: #ffb08f; }
.px-shopwin .sh-fopen { margin-top: 4px; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f3cf86; }
.px-shopwin .sh-fopen::after { content: ' \\203A'; }
.px-shopwin .sh-fcover:hover .sh-fopen, .px-shopwin .sh-fcover:focus-visible .sh-fopen { color: rgb(243,239,44); }
.px-shopwin .sh-fcover:focus-visible { outline: 2px solid #f3cf86; outline-offset: 2px; }
/* THE SPREAD: its head, its page arrows and tabs, one page */
.px-shopwin .sh-spreadhead { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding-bottom: 8px; border-bottom-width: 1px; border-bottom-style: solid; }
.px-shopwin .sh-spreadhead .sh-fname { margin-right: auto; }
.px-shopwin .sh-fback { min-height: 36px; padding: 0 14px; }
.px-shopwin .sh-fback::before { content: '\\2039  '; }
.px-shopwin .sh-pspent { font-size: 12px; padding: 3px 9px; border-width: 1px; border-style: solid; color: #ffe29a; font-variant-numeric: tabular-nums; }
.px-shopwin .sh-pspent:empty { display: none; }
.px-shopwin .sh-ptrackline { flex-basis: 100%; margin: 0; font-size: 13px; color: #e2dccd; }
.px-shopwin .sh-punlock { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.px-shopwin .sh-punlock .sh-price { font-size: 20px; }
.px-shopwin .sh-punlock .sh-state:empty { display: none; }
.px-shopwin .sh-pagenav { display: flex; align-items: center; gap: 6px; }
.px-shopwin .sh-pageprev, .px-shopwin .sh-pagenext { min-width: 44px; min-height: 36px; padding: 0; font-size: 20px; }
.px-shopwin :is(.sh-pageprev, .sh-pagenext)[aria-disabled="true"] { opacity: 0.55; cursor: default; }
.px-shopwin .sh-pageprev::before, .px-shopwin .sh-pagenext::before { content: ''; display: inline-block; width: 10px; height: 10px; border-left: 3px solid currentColor; border-bottom: 3px solid currentColor; }
.px-shopwin .sh-pageprev::before { transform: translateX(2px) rotate(45deg); } .px-shopwin .sh-pagenext::before { transform: translateX(-2px) rotate(-135deg); }   /* a drawn chevron, not a font's: a pixel font (the Grimoire's) draws its arrows too small to see */
.px-shopwin .sh-pagetabs { display: flex; flex: 1; justify-content: center; flex-wrap: nowrap; gap: 2px 6px; min-width: 0; }
.px-shopwin .sh-pagetabnum { display: none; }
.px-shopwin .sh-pagetab { font: inherit; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 4px 12px; font-size: 13px; letter-spacing: 0.12em;
  text-transform: uppercase; color: #d8cfae; background: none; border: 0; cursor: pointer; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-shopwin .sh-pagetab:hover, .px-shopwin .sh-pagetab.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-shopwin .sh-pagetab:focus-visible { outline: 2px solid #f3cf86; outline-offset: -2px; }
.px-shopwin .sh-tablock { width: 11px; height: 11px; color: #f3cf86; display: none; }
.px-shopwin .sh-tabtick { color: #9fe8b4; display: none; }
.px-shopwin .sh-pagetab-locked .sh-tablock, .px-shopwin .sh-pagetab-done .sh-tabtick { display: inline; }
.px-shopwin .sh-page { display: flex; flex-direction: column; gap: 8px; }
.px-shopwin .sh-pnote { margin: 0; font-size: 13.5px; color: #9fe8b4; text-align: center; }
.px-shopwin .sh-pnote:empty { display: none; }
.px-shopwin .sh-folios > .sh-pnote { margin-top: 8px; }
.px-shopwin .sh-pagehost { touch-action: pan-y; }
.px-shopwin .sh-ppanelhead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 2px 12px; }
.px-shopwin .sh-ppanelnum { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #d8b56a; }
.px-shopwin .sh-ppanelstate { font-size: 13px; color: var(--dim); }
.px-shopwin .sh-ppanelstate-locked { color: #ffb08f; }
/* AN ITEM: its picture over its words, centred, its price and its press at its foot */
.px-shopwin .sh-pitems { --card: 150px; display: grid; grid-template-columns: repeat(auto-fit, var(--card)); justify-content: center; gap: 10px; }
.px-shopwin .sh-pitem { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; padding: 7px;
  border-width: 2px; border-style: solid; min-width: 0; color: #f4ecd8; }
.px-shopwin .sh-pitem-title { container-type: inline-size; }
.px-shopwin .sh-pitempic { position: relative; align-self: stretch; height: 92px; margin-bottom: 3px; display: grid; place-items: center; border-width: 2px; border-style: solid;
  background-color: #08070d; background-image: radial-gradient(ellipse at 50% 58%, rgba(120,140,190,0.2), rgba(10,9,16,0) 70%); }
.px-shopwin .sh-spread-premium .sh-pitempic { background-image: radial-gradient(ellipse at 50% 58%, rgba(255,190,80,0.24), rgba(10,9,16,0) 70%); }
.px-shopwin .sh-pitemart { width: 64px; height: 64px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); }
.px-shopwin .sh-pitemlocked .sh-pitemart { opacity: 0.4; filter: grayscale(0.7) drop-shadow(0 4px 8px rgba(0,0,0,0.65)); }
.px-shopwin .sh-plock, .px-shopwin .sh-ptick { position: absolute; top: 5px; right: 5px; display: none; }
.px-shopwin .sh-plock { width: 16px; height: 16px; color: #f3cf86; }
.px-shopwin .sh-ptick { font-size: 16px; line-height: 1; color: #9fe8b4; }
.px-shopwin .sh-pitemlocked .sh-plock, .px-shopwin .sh-pitem-held .sh-ptick { display: block; }
.px-shopwin .sh-pitem .sh-rewardname { font-size: 14px; line-height: 1.2; overflow-wrap: break-word; hyphens: auto; }
.px-shopwin .sh-pitem-title .sh-rewardname { max-width: 100%; box-sizing: border-box; font-size: max(11px, min(14px, calc(90cqw / (var(--n, 10) * 0.62)))); padding: 1px 5px; white-space: nowrap; }
.px-shopwin .sh-rewardkind { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
.px-shopwin .sh-pitembuy { align-self: stretch; margin-top: auto; padding-top: 4px; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 8px; }
.px-shopwin .sh-pitem .sh-price { font-size: 17px; }
.px-shopwin .sh-pitem .sh-aurumprice .sh-coin { width: 18px; height: 18px; }
.px-shopwin .sh-pitem-held .sh-price { font-size: 13px; opacity: 0.8; }
.px-shopwin .sh-pitem .sh-state { font-size: 12px; }
.px-shopwin .sh-pitem .sh-state:empty { display: none; }
.px-shopwin .sh-pitem :is(.sh-buy, .sh-wear, .sh-getaurum) { flex: 1 1 100%; min-height: 38px; padding: 0 10px; justify-content: center; }
.px-shopwin .sh-state-bad { color: #e8a49c; }
.px-shopwin .sh-caurum { font-size: 12px; color: #ffe29a; text-align: right; white-space: nowrap; }
/* THE TURN: a cover opening, a page turning - none for less motion */
.px-shopwin .sh-turnin { animation: sh-coverturn 420ms steps(7) both; transform-origin: left center; }
.px-shopwin .sh-flipnext { animation: sh-flipnext 280ms steps(5) both; transform-origin: left center; }
.px-shopwin .sh-flipprev { animation: sh-flipprev 280ms steps(5) both; transform-origin: right center; }
@keyframes sh-coverturn { from { transform: perspective(1400px) rotateY(-80deg); opacity: 0.2; } to { transform: none; opacity: 1; } }
@keyframes sh-flipnext { from { transform: perspective(1400px) rotateY(-50deg); opacity: 0.3; } to { transform: none; opacity: 1; } }
@keyframes sh-flipprev { from { transform: perspective(1400px) rotateY(50deg); opacity: 0.3; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .px-shopwin :is(.sh-turnin, .sh-flipnext, .sh-flipprev) { animation: none; }
}
@media (max-width: 640px) {
  .px-shopwin :is(.sh-folio, .sh-spread, .sh-pchal) { padding: 10px; }
  .px-shopwin .sh-fcovers { grid-template-columns: 1fr; }
  .px-shopwin .sh-fcover { grid-template-columns: 90px minmax(0, 1fr); gap: 12px; }
  .px-shopwin .sh-fcoverart { width: 90px; height: 120px; }
  .px-shopwin .sh-pitems { --card: 128px; gap: 6px; }
  .px-shopwin .sh-pagetabword { display: none; }
  .px-shopwin .sh-pagetabnum { display: inline; }
  .px-shopwin .sh-pagetab { padding: 4px 10px; }
}
@media (max-height: 480px) {
  .px-shopwin .sh-fcover { grid-template-columns: 72px minmax(0, 1fr); gap: 12px; padding: 8px; }
  .px-shopwin .sh-fcoverart { width: 72px; height: 96px; }
  .px-shopwin .sh-fname { font-size: 18px; }
  .px-shopwin .sh-pitempic { height: 66px; }
  .px-shopwin .sh-pitemart { width: 50px; height: 50px; }
  .px-shopwin .sh-pitems { --card: 136px; }
  .px-shopwin .sh-pitem :is(.sh-buy, .sh-wear, .sh-getaurum) { min-height: 34px; }
}
`;
