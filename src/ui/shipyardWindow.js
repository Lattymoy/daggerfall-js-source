// @ts-check
// SHIPYARDS (2026-10-11, Mac: "A new highly detailed shipmaster vendor and crew recruitment station within it. All
// detailed functions including ship upgrading should be present here, along with ship buying, etc."): THE SHIPMASTER'S
// WINDOW - every ship a port does business in, one window, in the sea fight's stone-and-brass kit (ui/naval/navalYardWindow.js's
// sheet and door, ui/naval/navalPlunderDoor.js). Five pages, a tab each:
//   SHIPS FOR SALE - a card a hull: her figures, what she is, what the shipmaster asks of you, and Buy;
//   YOUR FLEET     - every ship you hold: where she lies, her worth and the shipmaster's offer, Sell (pressed twice - a
//                    sale is for good), Bring her here, Lay her up, and her name;
//   SHIPWRIGHT     - for a ship at hand: her hull, canvas, hands and powder made whole, her stores and grog (the yard's own
//                    rows and words - navalYardWindow.js yardText, yardNote);
//   REFITS         - her hold, rigging, hull and guns, a tier at a time, for gold, timber, iron and pitch;
//   CREW HALL      - the ship you sign hands on to, her named hands and their posts (paid off, pressed twice), and the
//                    day's sailors at the crewmaster's table - each his grade, his trade, his record and his fee.
// The model and the acts are the host's (scenes/shipyardHost.js), handed in: `model(view)` for the page and the ship the
// window has chosen, `act(verb, a, b)` for a press. The last press's word stands under the title.
//
// deps = { model(view) -> shipyardHost.js model's, act(verb, a, b) -> { ok, text, door? }, page - the tab to open on,
// onDoor(door) - a summons' placing to run once the window is down, onExit(reason) - 'close', or 'door' after onDoor }.
//
// Not a DFU member. Ledger A (SHIPYARDS).
import { closeOnOutsideTap } from './enhanced/enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { injectNavalKit } from './naval/navalHud.js';
import { injectNavalWindowStyle } from './naval/navalPlunderWindow.js';
import { yardText, yardNote } from './naval/navalYardWindow.js';
import { whereWords, refitLine, refitRowWords } from './fleetPage.js';
import { SHIP_NAME_MAX, REFIT_NUMERALS } from '../systems/fleet.js';
import { CREW_ROLES } from '../systems/naval/shipCrew.js';

export const SHIPYARD_STYLE_ID = 'dagger-shipyard-style';
/** The tabs, in the host's page order (scenes/shipyardHost.js SHIPYARD_PAGES). */
export const SHIPYARD_TABS = Object.freeze([
  Object.freeze({ id: 'ships', label: 'Ships for sale' }),
  Object.freeze({ id: 'fleet', label: 'Your fleet' }),
  Object.freeze({ id: 'yard', label: 'Shipwright' }),
  Object.freeze({ id: 'refits', label: 'Refits' }),
  Object.freeze({ id: 'crew', label: 'Crew Hall' }),
]);
/** MENU-ORDER (2026-10-12): each page's picture (ui/menu/menuGlyphs.js). */
export const SHIPYARD_TAB_ICONS = Object.freeze({ ships: 'ship', fleet: 'anchor', yard: 'saw', refits: 'anvil', crew: 'people' });
export const SHIPYARD_CSS = `
.dfyard-pic { display: block; color: #c9bba1; } .dfyard-card .dfyard-pic::before { width: 40px; height: 40px; margin: 0 0 4px; }
.dfyard-card[data-hull="0"] .dfyard-pic::before { width: 24px; height: 24px; }   /* MENU-ORDER: her picture her size - a rowboat small, a galley great */
.dfyard-card[data-hull="1"] .dfyard-pic::before { width: 30px; height: 30px; }
.dfyard-card[data-hull="2"] .dfyard-pic::before { width: 38px; height: 38px; }
.dfyard-card[data-hull="4"] .dfyard-pic::before { width: 44px; height: 44px; }
.dfyard-card[data-hull="3"] .dfyard-pic::before { width: 50px; height: 50px; }
/* MENU-ORDER: and her own picture over the glyph once the host has drawn her (scenes/shipPortraits.js) - at her size
   still, a rowboat's the card's half and a galley's its width */
.dfyard-shipimg { display: block; width: 100%; height: auto; aspect-ratio: 2 / 1; margin: 0 0 4px; border: 1px solid rgba(125,116,96,0.35); }
.dfyard-shipimg:not([src]) { display: none; }
.dfyard-pic:has(> .dfyard-shipimg[src])::before { display: none; }
.dfyard-card[data-hull="0"] .dfyard-shipimg { width: 50%; }
.dfyard-card[data-hull="1"] .dfyard-shipimg { width: 62%; }
.dfyard-card[data-hull="2"] .dfyard-shipimg { width: 76%; }
.dfyard-card[data-hull="4"] .dfyard-shipimg { width: 88%; }
.dfyard-tab[data-dficon] { display: inline-flex; align-items: center; justify-content: center; gap: 2px; }
.dfyard-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px 0; }
.dfyard-tab { flex: 1 1 auto; padding: 5px 10px; font: inherit; font-size: 13px; letter-spacing: 0.06em; color: #d8cfae; border: 2px solid; cursor: pointer;
  background: rgba(4,5,7,0.4); text-shadow: 1px 1px 0 #050608; }
.dfyard-tab[aria-selected="true"] { color: #f3d58a; background: rgba(40,32,14,0.55); }
.dfyard-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.dfyard-card { display: flex; flex-direction: column; gap: 5px; padding: 10px 11px; border: 2px solid; background: rgba(4,5,7,0.5); white-space: normal; }
.dfyard-card b { font-weight: normal; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.dfyard-card .dfyard-line { font-size: 12px; color: #c9bfa4; }
.dfyard-card .dfyard-figs { font-size: 12px; color: #b3a684; }   /* MENU-ORDER: a step larger */
.dfyard-card .dfyard-why { font-size: 12px; color: #e59a8e; }
.dfyard-card .dfnaval-btn { min-width: 0; margin-top: 4px; font-size: 13px; padding: 5px 10px; }
.dfyard-row { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(0, 1.6fr) fit-content(40%); align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(5,6,8,0.6); white-space: normal; }
.dfyard-row:last-child { border-bottom-color: transparent; }
.dfyard-row b { font-weight: normal; letter-spacing: 0.06em; text-transform: uppercase; color: #efe8d6; font-size: 13px; }
.dfyard-row span { font-size: 12px; color: #b9ab93; }
.dfyard-row .dfyard-acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.dfyard-row .dfnaval-btn { min-width: 0; font-size: 12px; padding: 4px 9px; }
/* FIELD BUGS 2026-10-16b YARD-ROWS ("Shipyard formatting is cooked"): an \`auto\` acts track took its every press on one
   line before the fr tracks had a pixel, so a ship's words stood a word a line; the acts' track is held to fit-content,
   and a ship of the fleet carries hers on a line of their own under her words, as the Holdings card does
   (ui/fleetPage.js shipCard's hld-acts) */
.dfyard-fleetrow { grid-template-columns: minmax(110px, 1fr) minmax(0, 1.6fr); }
.dfyard-fleetrow .dfyard-acts { grid-column: 1 / -1; }
.dfyard-choose { display: flex; flex-wrap: wrap; gap: 6px; }
.dfyard-choose .dfnaval-btn { min-width: 0; font-size: 12px; padding: 4px 10px; }
.dfyard-choose .dfnaval-btn[aria-pressed="true"] { color: #f3d58a; }
.dfyard-name { display: flex; gap: 6px; }
.dfyard-name input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 13px; padding: 4px 6px; color: #efe8d6; background: rgba(4,5,7,0.6); border: 2px solid; }
.dfyard-quote { font-style: italic; }
.dfyard-post { font: inherit; font-size: 12px; color: #efe8d6; background: rgba(4,5,7,0.6); border: 2px solid; }
.dfyard-acts .dfyard-post { min-width: 0; max-width: 12em; text-overflow: ellipsis; }   /* YARD-ROWS' audit: a long hand's name in the swap picker never holds the presses' track past its fit-content cap */
@media (max-width: 560px) {
  .dfyard-cards { grid-template-columns: 1fr; }
  .dfyard-row { grid-template-columns: 1fr; gap: 4px; }
  .dfyard-row .dfyard-acts { justify-content: flex-start; }
}
`;

const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;

/** A ship for sale's card words. Pure - the pins' reading. */
export function shipCardText(s) {
  const figs = [`${s.length} m long, ${s.beam} m in the beam`];
  if (s.crew > 0) figs.push(`a crew of ${s.crew}, ${s.hands} named on deck`);
  else figs.push('no crew (you sail it alone)');
  if (s.guns > 0) figs.push(`${s.guns} ${s.guns === 1 ? 'gun' : 'guns'}${s.barrels ? ' and fire barrels' : ''}`);
  else if (s.barrels) figs.push('fire barrels');
  figs.push(`hull ${s.hullHp}${s.sailHp > 0 ? `, canvas ${s.sailHp}` : ''}`);
  return {
    name: s.name, line: s.line, figs: figs.join(' - '),
    note: s.docks ? null : 'Too big for the quay. It anchors off the harbor.',
    press: `Buy - ${gold(s.asked)}`,
    why: s.why, can: !s.why,
  };
}
/** A fleet row's words. Pure. */
export function fleetRowText(r) {
  const w = whereWords(r);
  const fits = refitLine(r.upgrades);
  return {
    name: r.label, sub: `${r.hullName} - ${w.state}`, where: w.line,
    worth: `Worth ${gold(r.worth)}. The shipmaster offers ${gold(r.offer)}.${fits ? ` Refits: ${fits}.` : ''}`,
    sell: r.sell, canSell: !r.sell, summon: r.can?.summon ?? null, away: r.can?.away ?? null,
  };
}
/** A recruit's words. Pure. */
export function recruitText(r) {
  const record = r.fights || r.boardings ? `${r.fights} ${r.fights === 1 ? 'fight' : 'fights'}, ${r.boardings} ${r.boardings === 1 ? 'boarding' : 'boardings'}` : 'never been in a fight';
  return {
    name: r.name, who: `${r.gradeLabel} ${r.trade} - ${r.className}, ${r.sex === 'female' ? 'she' : 'he'} has ${record}.`,
    // AUDIT SHIPYARDS L2-2: the price this ship's hire comes to; L7-2: a full deck signs on in a hand's place
    quote: `"${r.line}"`, press: `${r.swap ? 'Sign on in place' : 'Sign on'} - ${gold(r.price ?? r.fee)}`, why: r.why, can: !r.why,
  };
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** @param {string} text @param {string} cls @param {() => void} onPress @param {boolean} [can] @param {string|null} [why] */
const button = (text, cls, onPress, can = true, why = null) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', cls, text));
  b.setAttribute('type', 'button');
  if (!can) b.setAttribute('disabled', '');
  if (why) b.title = why;
  b.onclick = (e) => { e.stopPropagation(); if (!b.disabled) onPress(); };
  return b;
};
function injectStyle(doc = document) {
  if (doc.getElementById?.(SHIPYARD_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = SHIPYARD_STYLE_ID;
  st.textContent = SHIPYARD_CSS;
  (doc.head ?? doc.body).append(st);
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{ model: (view: any) => any, act: (verb: string, a?: any, b?: any) => any, page?: string, onDoor?: ((door: any) => void) | null, onExit?: ((reason?: string) => void) | null, now?: () => number, picture?: ((hull: number, where: () => any) => Promise<string|null> | null) | null }} deps
 *   MENU-ORDER: `picture` a hull's own picture as the host draws her (scenes/shipPortraits.js), under the box `where` reads.
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountShipyardWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectNavalWindowStyle();
  injectStyle();
  injectNavalKit(document);
  const view = { page: SHIPYARD_TABS.some((t) => t.id === deps.page) ? deps.page : 'ships', uid: null };
  /** @type {{ text: string, warn: boolean } | null} */
  let note = null;
  /** a press waiting for its second: `sell:<uid>` or `payoff:<uid>:<name>` */
  let confirm = null;
  let confirmAt = 0;
  /** @type {Record<string, string>} the hand each recruit would sign on in place of, as the player picked it */
  const swapPick = {};
  let draft = null;   // the name field's text, while it is being typed
  const now = () => (deps.now ? deps.now() : performance.now());
  const exit = (reason = 'close') => deps.onExit?.(reason);
  const shell = el('div', 'dfnaval-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', 'The shipmaster');
  const win = el('div', 'dfnaval-win');
  win.style.width = 'min(760px, 96vw)';
  shell.append(win);
  const head = el('header', 'dfnaval-winhead');
  const title = el('div', 'dfnaval-wintitle');
  const h2 = el('h2');
  const sub = el('p', 'dfnaval-winsub');
  const noteLine = el('p', 'dfnaval-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(h2, sub, noteLine);
  const close = button('Leave', 'dfnaval-btn dfnaval-close', () => exit('close'));
  close.style.minWidth = '0';
  head.append(title, close);
  const tabs = el('div', 'dfyard-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'dfnaval-winbody');
  win.append(head, tabs, body);

  let alive = true;
  /** MENU-ORDER: her own picture on her card - asked once a hull, set on every image waiting on it, over her glyph */
  /** @type {Map<number, string|null>} */
  const shipPics = new Map();
  /** @type {Map<number, any[]>} */
  const shipWaiting = new Map();
  const shipPicture = (pic, hull) => {
    const img = el('img', 'dfyard-shipimg');
    img.setAttribute('alt', '');
    pic.append(img);
    const url = shipPics.get(hull);
    if (url) { img.setAttribute('src', url); return; }
    if (!deps.picture) return;   // AUDIT MENU-ORDER C4: no host to ask, nothing to wait on - her glyph
    shipWaiting.set(hull, [...(shipWaiting.get(hull) ?? []), img]);
    if (shipPics.has(hull)) return;   // in flight
    shipPics.set(hull, null);
    const settle = (u) => {
      const imgs = shipWaiting.get(hull) ?? [];
      shipWaiting.delete(hull);
      if (!u || !alive) { shipPics.delete(hull); return; }
      shipPics.set(hull, u);
      for (const i of imgs) i.setAttribute('src', u);
    };
    Promise.resolve(deps.picture(hull, () => (alive ? win.getBoundingClientRect?.() ?? null : null))).then(settle, () => settle(null));
  };
  const said = (r) => { if (r && typeof r.text === 'string' && r.text) note = { text: r.text, warn: !r.ok }; };
  const press = (verb, a, b) => {
    confirm = null;
    const r = deps.act(verb, a, b);
    if (r?.door) { deps.onDoor?.(r.door); exit('door'); return; }   // a summons that wants the water clicked: the window makes way for it
    said(r);
    if (r?.ok && typeof r.page === 'string') { view.page = r.page; if (r.uid != null) view.uid = r.uid; }   // AUDIT SHIPYARDS L7-4: a bought ship's page
    render();
  };
  /** THE SECOND PRESS: an act that cannot be taken back (a ship bought, a ship sold, a hand paid off) asks once and is
   *  done by the next press of the same button - never by the click that asked (AUDIT SHIPYARDS L1-5: a double click
   *  bought two ships, and confirmed a sale in one gesture). */
  const CONFIRM_MS = 350;
  const twoPress = (key, ask, go) => {
    if (confirm === key) { if (now() - confirmAt >= CONFIRM_MS) go(); return; }
    confirm = key; confirmAt = now(); note = { text: ask, warn: true }; render();
  };
  const chooser = (m) => {
    if (!(m.choices?.length > 1)) return null;
    const row = el('div', 'dfyard-choose');
    for (const c of m.choices) {
      const b = button(c.label, 'dfnaval-btn', () => { view.uid = c.uid; render(); });
      b.setAttribute('aria-pressed', String(c.uid === m.uid));
      row.append(b);
    }
    return row;
  };
  const section = (label, count = '') => {
    const sec = el('section', 'dfnaval-sec');
    const sh = el('h3', 'dfnaval-sechead');
    sh.append(el('span', null, label), el('span', 'dfnaval-count', count));
    sec.append(sh);
    return sec;
  };

  function shipsPage(m) {
    const sec = section('Ships for sale', `${m.ships.length} on the slips`);
    const cards = el('div', 'dfyard-cards');
    for (const s of m.ships) {
      const t = shipCardText(s);
      const card = el('div', 'dfyard-card');
      card.setAttribute('data-hull', String(s.hull));
      const pic = el('span', 'dfyard-pic');   // MENU-ORDER: a ship's card leads with a ship
      pic.setAttribute('data-dficon', 'ship');
      shipPicture(pic, s.hull);
      card.append(pic, el('b', null, t.name), el('span', 'dfyard-line', t.line), el('span', 'dfyard-figs', t.figs));
      if (t.note) card.append(el('span', 'dfyard-figs', t.note));
      if (t.why) card.append(el('span', 'dfyard-why', t.why));
      const key = `buy:${s.hull}`;
      card.append(button(confirm === key ? `Yes - buy for ${gold(s.asked)}` : t.press, 'dfnaval-btn dfnaval-take',
        () => twoPress(key, `Buy the ${t.name} for ${gold(s.asked)}? Press again to confirm.`, () => press('buy', s.hull)), t.can, t.why));
      cards.append(card);
    }
    sec.append(cards);
    body.append(sec);
  }
  function fleetPage(m) {
    const sec = section('Your fleet', m.fleet.length ? `${m.fleet.length} ${m.fleet.length === 1 ? 'ship' : 'ships'}` : 'none');
    if (!m.fleet.length) sec.append(el('p', 'dfnaval-lede', 'You don\'t own a ship. The shipmaster has a few for sale.'));
    for (const r of m.fleet) {
      const t = fleetRowText(r);
      const row = el('div', 'dfyard-row dfyard-fleetrow');   // YARD-ROWS: her acts under her words
      row.setAttribute('data-uid', String(r.uid));
      const left = el('div');
      left.append(el('b', null, t.name), el('br'), el('span', null, t.sub));
      const mid = el('div');
      mid.append(el('span', null, t.where), el('br'), el('span', null, t.worth));
      if (t.sell) mid.append(el('br'), el('span', null, t.sell));
      const acts = el('div', 'dfyard-acts');
      const key = `sell:${r.uid}`;
      acts.append(button(confirm === key ? `Yes - sell for ${gold(r.offer)}` : 'Sell', 'dfnaval-btn',
        () => twoPress(key, `Sell ${t.name} for ${gold(r.offer)}? This can't be undone. Press again to confirm.`, () => press('sell', r.uid)), t.canSell, t.sell));
      acts.append(button('Bring here', 'dfnaval-btn', () => press('summon', r.uid), !t.summon, t.summon));
      acts.append(button('Lay up', 'dfnaval-btn', () => press('away', r.uid), !t.away, t.away));
      const named = el('div', 'dfyard-name');
      const input = /** @type {HTMLInputElement} */ (el('input'));
      input.maxLength = SHIP_NAME_MAX;
      input.placeholder = 'Ship name';
      input.value = draft?.uid === r.uid ? draft.text : (r.name ?? '');
      input.oninput = () => { draft = { uid: r.uid, text: input.value }; };
      input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { press('rename', r.uid, input.value); draft = null; } };
      named.append(input, button('Rename', 'dfnaval-btn', () => { press('rename', r.uid, input.value); draft = null; }));
      acts.append(named);
      row.append(left, mid, acts);
      sec.append(row);
    }
    body.append(sec);
  }
  function yardPage(m) {
    const sec = section('The shipwright', m.ship ? m.ship.label : '');
    const ch = chooser(m);
    if (ch) sec.append(ch);
    if (!m.yard) { sec.append(el('p', 'dfnaval-lede', m.why ?? 'The shipwright has nothing to work on.')); body.append(sec); return; }
    const t = yardText(m.yard);
    sec.append(el('p', 'dfnaval-lede', t.lede));
    for (const r of [...t.rows, ...t.provisions]) {
      const row = el('div', 'dfyard-row');
      row.setAttribute('data-row', r.id);
      const acts = el('div', 'dfyard-acts');
      const prov = t.provisions.includes(r);
      acts.append(button(r.press, 'dfnaval-btn', () => { const res = prov ? m.yard.buyProvision?.(r.id) : m.yard.buy?.(r.id); note = yardNote(res); render(); }, r.can));
      row.append(el('b', null, r.label), el('span', null, r.state), acts);
      sec.append(row);
    }
    if (t.whole) {
      const acts = el('div', 'dfnaval-acts');
      acts.append(button(t.whole, 'dfnaval-btn dfnaval-take dfnaval-whole', () => { note = yardNote(m.yard.buyAll?.()); render(); }, t.canWhole));
      sec.append(acts);
    }
    body.append(sec);
  }
  function refitsPage(m) {
    const sec = section('Refits', m.ship ? m.ship.label : '');
    const ch = chooser(m);
    if (ch) sec.append(ch);
    const o = m.refit;
    if (!o) { sec.append(el('p', 'dfnaval-lede', m.why ?? 'No ship to refit.')); body.append(sec); return; }
    if (o.why) sec.append(el('p', 'dfnaval-lede', o.why));
    for (const r of o.rows) {
      const row = el('div', 'dfyard-row');
      row.setAttribute('data-line', r.id);
      const w = refitRowWords(r);   // REFIT-ORES: the Fleet page's words - a metal's melt and its captain's level said
      const left = el('div');
      left.append(el('b', null, w.name), el('br'), el('span', null, w.gain));
      const mid = el('span', null, r.next ? [w.asks, w.melt, w.lock].filter(Boolean).join(' ') : 'This upgrade line is complete.');
      const acts = el('div', 'dfyard-acts');
      acts.append(button(r.next ? `Refit - ${REFIT_NUMERALS[r.tier + 1]}` : 'Done', 'dfnaval-btn', () => press('refit', m.uid, r.id), !!r.next && r.afford && !o.why, o.why ?? w.lock));
      row.append(left, mid, acts);
      sec.append(row);
    }
    body.append(sec);
  }
  function crewPage(m) {
    const sec = section(m.crewName, m.crewmaster ? `Crewmaster: ${m.crewmaster}` : '');
    const ch = chooser(m);
    if (ch) sec.append(ch);
    if (m.why) sec.append(el('p', 'dfnaval-lede', m.why));
    body.append(sec);   // AUDIT SHIPYARDS L2-7: the hall's header and the ship chooser first, her hands under them
    if (m.ship) {
      const crew = section(`${m.ship.label}'s hands`, m.room?.ok ? 'a place for another' : m.room?.full ? 'the deck is full' : 'no place');
      for (const h of m.hands) {
        const row = el('div', 'dfyard-row');
        const left = el('div');
        left.append(el('b', null, h.name), el('br'), el('span', null, `${h.fights} ${h.fights === 1 ? 'fight' : 'fights'}, ${h.boardings} ${h.boardings === 1 ? 'boarding' : 'boardings'}${h.ashore ? ' - ashore with you' : ''}`));
        const post = /** @type {HTMLSelectElement} */ (el('select', 'dfyard-post'));
        // AUDIT SHIPYARDS L2-7: the Fleet page's posts (AUDIT HOLDINGS C3) - a Bard by his class keeps his calling to
        // offer and stands no lookout
        for (const role of [...CREW_ROLES.filter((r) => !(h.bard && r === 'Lookout')), ...(h.bard ? ['Bard'] : [])]) {
          const o = /** @type {HTMLOptionElement} */ (el('option', null, role));
          o.value = role;
          if (role === h.role) o.selected = true;
          post.append(o);
        }
        post.onchange = () => press('role', m.uid, { name: h.name, role: post.value });
        const acts = el('div', 'dfyard-acts');
        const key = `payoff:${m.uid}:${h.name}`;
        const she = h.gender === 'female';   // AUDIT SHIPYARDS L7-9: a woman is paid off as one
        acts.append(button(confirm === key ? `Yes - pay ${she ? 'her' : 'him'} off` : 'Pay off', 'dfnaval-btn',
          () => twoPress(key, `Pay off ${h.name}? ${she ? 'She' : 'He'} leaves ${m.ship.label} for good. Press again.`, () => press('payoff', m.uid, h.name)),
          !h.ashore, h.ashore ? 'Ashore with you' : null));
        row.append(left, post, acts);
        crew.append(row);
      }
      body.append(crew);
    }
    const hall = section('Looking for a berth', m.recruits.length ? `${m.recruits.length} at the table` : 'none');
    hall.append(el('p', 'dfnaval-lede', m.recruits.length ? 'Sailors at the crewmaster\'s table, looking for a berth today:' : 'No one is looking for a berth today. Come back tomorrow.'));
    const free = m.hands.filter((h) => !h.ashore);
    for (const r of m.recruits) {
      const t = recruitText(r);
      const row = el('div', 'dfyard-row');
      row.setAttribute('data-recruit', r.id);
      const left = el('div');
      left.append(el('b', null, t.name), el('br'), el('span', null, t.who));
      const mid = el('span', 'dfyard-quote', t.quote);
      const acts = el('div', 'dfyard-acts');
      if (r.swap && free.length) {
        // AUDIT SHIPYARDS L7-2: her deck full, he signs on in the place of the hand picked here (her newest by default)
        const pick = /** @type {HTMLSelectElement} */ (el('select', 'dfyard-post'));
        pick.setAttribute('aria-label', 'In place of');
        const chosen = free.some((h) => h.name === swapPick[r.id]) ? swapPick[r.id] : free[free.length - 1].name;
        for (const h of free) {
          const o = /** @type {HTMLOptionElement} */ (el('option', null, `in place of ${h.name}, ${h.role}`));
          o.value = h.name;
          if (h.name === chosen) o.selected = true;
          pick.append(o);
        }
        pick.onchange = () => { swapPick[r.id] = pick.value; };
        acts.append(pick, button(t.press, 'dfnaval-btn dfnaval-take', () => press('hire', m.uid, { id: r.id, replace: pick.value }), t.can, t.why));
      } else {
        acts.append(button(t.press, 'dfnaval-btn dfnaval-take', () => press('hire', m.uid, r.id), t.can, t.why));
      }
      row.append(left, mid, acts);
      hall.append(row);
    }
    body.append(hall);
  }

  function render() {
    if (!alive) return;
    const m = deps.model({ ...view });
    view.page = m.page;
    if (m.uid != null) view.uid = m.uid;
    h2.textContent = m.title;
    sub.textContent = `${m.keeper ? `${m.keeper}, the shipmaster` : 'The shipmaster'} - your purse: ${gold(m.gold)}`;
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `dfnaval-note${note?.warn ? ' warn' : ''}`;
    if (note) noteLine.removeAttribute('hidden'); else noteLine.setAttribute('hidden', '');
    for (const c of [...tabs.children]) c.remove();
    for (const t of SHIPYARD_TABS) {
      const b = button(t.id === 'crew' ? m.crewName ?? t.label : t.label, 'dfyard-tab', () => { view.page = t.id; confirm = null; note = null; render(); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.id === m.page));
      b.setAttribute('data-tab', t.id);
      b.setAttribute('data-dficon', SHIPYARD_TAB_ICONS[t.id] ?? 'ship');   // MENU-ORDER: each page its picture
      tabs.append(b);
    }
    for (const c of [...body.children]) c.remove();
    if (m.page === 'ships') shipsPage(m);
    else if (m.page === 'fleet') fleetPage(m);
    else if (m.page === 'yard') yardPage(m);
    else if (m.page === 'refits') refitsPage(m);
    else crewPage(m);
  }
  render();
  host.append(shell);
  close.focus?.({ preventScroll: true });
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit('close'); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.dfnaval-win', () => exit('close'));
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
