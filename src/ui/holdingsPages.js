// @ts-check
// HOLDINGS (2026-10-03, Mac: "Lets add a new tab to the pause menu as the stat page is starting to get bloated. Lets
// organize everything appropriately. Under the new tab add a page that allows you to see your currently owned mounts
// ships and carts. You can summon your horse/cart from this page/send away much like the companion system. You can also
// do this with ships instead of relying on a deed item") - THE HOLDINGS TAB's own pages (bible/03-World/Holdings.md).
// The tab (ui/enhancedMenu.js pauseHoldings) is a rail of what the player owns and who follows them: these two pages,
// and the Companions, Revenants and Stores pages that stood on the Stats rail before it.
//
//  - THE STABLE: the horse and the wagon - owned or not, where each is (ridden, following, parked or waiting how far
//    off, or stabled), the wagon's load against its limit; SUMMON (Horse Cart and Cargo's own summon) and SEND AWAY
//    (its other half, systems/horseCart.js sendTransportAway), and the horse renamed in place. Each act's word is said
//    under its card, never on a HUD the window covers.
//  - THE FLEET: every ship the player holds - drawn by ui/fleetPage.js over the same provider.
//
// THE PROVIDER is the host's (scenes/world.js, scenes/exterior.js - setHoldingsProvider): what the pages read and the
// acts they ask, so this file touches no runtime. Dressed by the stone-and-brass kit's roles (ui/enhancedFrame.js
// FRAME_ROLES: a card a panel, a picture a well, a state a chip) - this sheet writes geometry and
// the words' colours alone, as the Companions page's does.

import { stableWagonName, WAGON_KINDS } from '../systems/wagonKinds.js';   // WAGONS1: the Stable's card names the wagon driven
import { paintDrivenWagon, outsidePaintRow, LOOK_TEXT } from '../systems/wagonLooks.js';   // WAGONS2: and paints it
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HORSE_NAME_MAX } from '../systems/horseCartLaw.js';
import { optionPath } from './settingsMap.js';   // ORG2: a switch named in a window says where it lives

export const STABLE_PAGE_SECTIONS = Object.freeze([Object.freeze(['stable', 'Stable'])]);
export const HOLDINGS_STYLE_ID = 'holdings-pages-css';
const ART_BOX = 48;
/** The two items' inventory pictures (the item templates' playerTexture: Horse 94 201/0, Small Cart 93 213/1). */
export const HORSE_ART = Object.freeze({ archive: 201, record: 0 });
export const WAGON_ART = Object.freeze({ archive: 213, record: 1 });
let _icon = (p, box, onReady) => requestFittedIcon(p.archive, p.record, { box, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady });
/** Tests: the picture source. */
export function _setHoldingsIconForTests(fn) { _icon = fn ?? ((p, box, onReady) => requestFittedIcon(p.archive, p.record, { box, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady })); }

/**
 * @typedef {Object} StableModel
 * @property {boolean} hcc   Horse Cart and Cargo is on: the pair stands in the world (else the classic transport)
 * @property {boolean} hasHorse @property {boolean} hasCart
 * @property {any} [view]   the runtime's stableView() while `hcc`
 * @property {string|null} [kind]   WAGONS1: the wagon driven ('cart', 'openWagon', 'caravan' - systems/wagonKinds.js)
 * @property {{ choices: string[], current: number }|null} [paint]   WAGONS2: its outside's paints, and its paint now
 *
 * @typedef {Object} HoldingsProvider
 * @property {() => StableModel} [stable]   the horse and the wagon
 * @property {(verb: 'summon'|'away'|'rename'|'paint', arg?: any) => { ok: boolean, text: string }} [stableAct]
 * @property {any} [fleet]   the fleet's model and acts (ui/fleetPage.js)
 */
let _provider = /** @type {HoldingsProvider|null} */ (null);
/** The host's provider, or null to take the pages down. */
export function setHoldingsProvider(p) { _provider = p ?? null; }
export const holdingsProvider = () => _provider;
/**
 * THE ONE CONSTRUCTION SEAM (Home.md) for the two hosts that stand Horse Cart and Cargo (scenes/world.js,
 * scenes/exterior.js): the Stable's half of the provider over a host's runtime - `on()` the mod's switch, `hasHorse()`
 * and `hasCart()` the pack's two items. WAGONS2: `items()` the pack (the driven wagon painted in it - systems/
 * wagonLooks.js paintDrivenWagon) and `onPainted()` the host told (its word moved).
 */
export function stableProviderFor({ runtime, on, hasHorse, hasCart, wagonKind = () => null, items = () => [], onPainted = () => {} }) {
  return {
    stable: () => ({ hcc: !!on(), hasHorse: !!hasHorse(), hasCart: !!hasCart(), view: on() ? runtime.stableView() : null, kind: wagonKind() ?? null, paint: outsidePaintRow(items()) }),   // WAGONS1: which wagon; WAGONS2: its paint
    stableAct: (verb, arg) => {
      if (verb === 'paint') { const r = paintDrivenWagon(items(), 'outside', Number(arg) | 0); if (r.ok) onPainted(); return r; }   // WAGONS2: free, any time, the mod on or off - the paint is the wagon's
      if (!on()) return { ok: false, text: `Turn on Horse Cart and Cargo (${optionPath('feat:mod-horse-cart-and-cargo')}) to call your horse and wagon.` };   // ORG2: where it lives, from the map
      if (verb === 'summon') return runtime.summonTransport();
      if (verb === 'away') return runtime.sendTransportAway();
      // AUDIT HOLDINGS C5: a horse never named answers '' - his own, not none
      if (verb === 'rename') { const n = runtime.renameHorse(arg); return n == null ? { ok: false, text: 'You do not own a horse.' } : n ? { ok: true, text: `Your horse is called ${n}.` } : { ok: false, text: 'Your horse keeps no name - give him one.' }; }
      return { ok: false, text: 'Not here.' };
    },
  };
}
/** The Stable stands on the rail whenever a host provides it: owning nothing is a thing it says, and where to buy. */
export const stablePageShown = () => typeof _provider?.stable === 'function';

export const HOLDINGS_CSS = `
.px-sys .hld-list { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; }
.px-sys .hld-row { display: grid; grid-template-columns: ${ART_BOX + 8}px 1fr; gap: 10px; padding: 7px 10px 8px 7px; border-width: 2px; border-style: solid; box-sizing: border-box; text-align: left; }
.px-sys .hld-art { position: relative; box-sizing: border-box; width: ${ART_BOX + 8}px; height: ${ART_BOX + 8}px; border-width: 2px; border-style: solid;
  display: flex; align-items: center; justify-content: center; overflow: hidden; }
.px-sys .hld-art img.fit { image-rendering: pixelated; }
.px-sys .hld-art .hld-glyph { font-size: 22px; color: #8b8578; }
.px-sys .hld-text { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.px-sys .hld-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.px-sys .hld-name { font-size: 15px; color: #f3cf86; overflow-wrap: anywhere; }
.px-sys .hld-state { flex: none; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 10px; line-height: 1.5; letter-spacing: 0.12em; text-transform: uppercase; color: #8fc7a0; }
.px-sys .hld-state.is-away { color: #b8b0a0; }
.px-sys .hld-state.is-hurt { color: #e0a54a; }
.px-sys .hld-state.is-lost { color: #ff8a78; }
.px-sys .hld-sub { font-size: 11px; color: #8b8578; }
.px-sys .hld-meter { display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 8px; max-width: 320px; }
.px-sys .hld-mk { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #b8b0a0; }
.px-sys .hld-mn { font-size: 11px; color: #b8b0a0; font-variant-numeric: tabular-nums; }
.px-sys .hld-why { font-size: 11px; color: #e0a54a; }
.px-sys .hld-said { font-size: 11px; color: #8fc7a0; }
.px-sys .hld-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.px-sys .hld-acts .act { min-width: 0; padding-left: 10px; padding-right: 10px; }
.px-sys .hld-acts .act[aria-disabled="true"] { opacity: 0.55; }
.px-sys .hld-field { font: inherit; font-size: 14px; min-height: 32px; padding: 2px 8px; box-sizing: border-box; width: 100%; max-width: 260px;
  color: #e9e4d9; background: rgba(15,17,22,0.75); border: 2px solid rgba(125,116,96,0.7); }
.px-sys .hld-foot { font-size: 11px; color: #8b8578; margin: 4px 0 0; }
.px-sys .hld-refit { display: flex; flex-direction: column; gap: 3px; padding: 6px 9px 7px; border-width: 2px; border-style: solid; box-sizing: border-box; margin-top: 6px; }
@media (max-width: 480px) { .px-sys .hld-field { font-size: 16px; } }
:root[data-plus-theme="stone"] .px-sys .hld-sub, :root[data-plus-theme="stone"] .px-sys .hld-foot { color: #e2d9c4; }
`;
export function ensureHoldingsStyle(doc = typeof document === 'undefined' ? null : document) {
  if (!doc?.getElementById || doc.getElementById(HOLDINGS_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = HOLDINGS_STYLE_ID;
  st.textContent = HOLDINGS_CSS;
  (doc.head ?? doc.body)?.append(st);
}

/** An item's picture into a well (a glyph while it loads, or where none comes). */
export function holdingArt(el, art, glyph, rerender) {
  const f = el('div', 'hld-art');
  f.setAttribute('aria-hidden', 'true');
  let shown = false;
  if (art) {
    try {
      const pic = _icon(art, ART_BOX, () => { if (f.isConnected !== false) rerender?.(); });
      if (pic?.src) { f.append(fittedImg(pic)); shown = true; }
    } catch { shown = false; }
  }
  if (!shown) f.append(el('span', 'hld-glyph', glyph));
  return f;
}
/** A labelled meter row: its word, the kit's bar, its numbers. */
export function holdingMeter(el, meter, label, now, max, tone) {
  const r = el('div', 'hld-meter');
  r.append(el('span', 'hld-mk', label));
  r.append(typeof meter === 'function' ? meter(Math.max(0, now), Math.max(0, max), tone) : el('span', null, ''));
  r.append(el('span', 'hld-mn', `${Math.max(0, Math.round(now))} / ${Math.round(max)}`));
  return r;
}
/** How far a thing stands, in the words a card uses. */
export const farWords = (m) => (m == null ? 'away from here' : m < 1000 ? `${m} m away` : `${(m / 1000).toFixed(1)} km away`);

/**
 * THE STABLE'S WORDS: where the horse and the wagon each are, as a chip's word and a line under it, off the runtime's
 * view (systems/horseCart.js stableView) - or, with Horse Cart and Cargo off, the classic transport's: with the player.
 * Pure. Answers `{ horse, wagon }`, each `{ state, tone, line }` or null for one not owned.
 * @param {StableModel} m
 */
export function stableWords(m) {
  if (!m.hcc || !m.view) {
    const classic = { state: 'With you', tone: '', line: 'Ride from the Transport window.' };
    return { horse: m.hasHorse ? classic : null, wagon: m.hasCart ? { ...classic, line: 'Its load rides with you.' } : null };
  }
  const v = m.view;
  if (!v.persistence) {
    const classic = { state: 'With you', tone: '', line: 'Physical persistence is off: it travels with you.' };
    return { horse: v.hasHorse ? classic : null, wagon: v.hasCart ? classic : null };
  }
  const riding = v.transport === TRANSPORT.Horse, driving = v.transport === TRANSPORT.Cart;
  const teamFollowing = v.wagonMode === WAGON_MODE.FollowingPlayer && v.horseMode === HORSE_MODE.HitchedToWagon;
  let horse = null, wagon = null;
  if (v.hasHorse) {
    if (riding) horse = { state: 'Riding', tone: '', line: 'You are in the saddle.' };
    else if (driving) horse = { state: 'In harness', tone: '', line: 'Pulling your wagon.' };
    else if (teamFollowing || v.horseMode === HORSE_MODE.FollowingPlayer) horse = { state: 'Following', tone: '', line: teamFollowing ? 'Following you with the wagon.' : 'Following you.' };
    else if (v.horseMode === HORSE_MODE.LooseStationary) horse = { state: 'Waiting', tone: 'is-away', line: `Waiting where you left it, ${farWords(v.horseAt)}.` };
    else if (v.horseMode === HORSE_MODE.HitchedToWagon && v.wagonMode === WAGON_MODE.Deployed) horse = { state: 'Hitched', tone: 'is-away', line: `Hitched to your parked wagon, ${farWords(v.wagonAt)}.` };
    else horse = { state: 'Stabled', tone: 'is-away', line: 'Out of the world - mount it from the Transport window, or summon it to your side.' };
  }
  if (v.hasCart) {
    if (driving) wagon = { state: 'Driving', tone: '', line: 'You are on the box.' };
    else if (teamFollowing) wagon = { state: 'Following', tone: '', line: 'Following you behind your horse.' };
    else if (v.wagonMode === WAGON_MODE.Deployed) wagon = { state: 'Parked', tone: 'is-away', line: `Parked ${farWords(v.wagonAt)}.` };
    else wagon = { state: 'Stabled', tone: 'is-away', line: v.hasHorse ? 'Out of the world - drive it from the Transport window, or summon it.' : 'Out of the world - you need a horse to pull it.' };
  }
  return { horse, wagon };
}

let _said = null;   // { who: 'horse'|'wagon'|'both', ok, text } - the last act's word
let _renaming = false;   // the horse's name field open
let _draft = '';

function card(el, { art, glyph, name, words, sub, extra, rerender }) {
  const item = el('div', 'hld-row');
  item.append(holdingArt(el, art, glyph, rerender));
  const text = el('div', 'hld-text');
  const head = el('div', 'hld-head');
  head.append(el('span', 'hld-name', name));
  if (words) head.append(el('span', `hld-state${words.tone ? ` ${words.tone}` : ''}`, words.state));
  text.append(head);
  if (sub) text.append(el('span', 'hld-sub', sub));
  if (words?.line) text.append(el('span', 'hld-sub', words.line));
  for (const x of extra ?? []) if (x) text.append(x);
  item.append(text);
  return { item, text };
}

/**
 * THE STABLE PAGE: `detail` the rail's detail pane; `kit` the menu's makers ({ el, divider, meter }).
 */
export function drawStablePage(detail, rerender, { el, divider, meter = null } = /** @type {any} */ ({})) {
  ensureHoldingsStyle();
  const p = _provider;
  const m = p?.stable?.() ?? { hcc: false, hasHorse: false, hasCart: false };
  const words = stableWords(m);
  detail.append(divider('Stable'));
  if (!words.horse && !words.wagon) {
    detail.append(el('p', 'px-note', 'You own no horse and no wagon. Every city and town has a Stable that sells horses to ride, and a Wagon Yard that sells carts and wagons to carry what your back cannot.'));
    return;
  }
  const v = m.hcc ? m.view : null;
  const list = el('div', 'hld-list');
  const act = (verb, arg) => { const r = p?.stableAct?.(verb, arg) ?? { ok: false, text: 'Not here.' }; _said = { ok: r.ok, text: r.text }; rerender(); };
  if (words.horse) {
    const name = v?.horseName || 'Your horse';
    const extra = [];
    if (_renaming) {
      const field = /** @type {HTMLInputElement} */ (el('input', 'hld-field'));
      field.type = 'text';
      field.maxLength = HORSE_NAME_MAX;
      field.value = _draft;
      field.setAttribute('aria-label', 'Your horse\'s name');
      field.oninput = () => { _draft = field.value; };
      const save = () => { _renaming = false; act('rename', _draft); };
      field.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
      extra.push(field);
      const row = el('div', 'hld-acts');
      const ok = el('button', 'act primary', 'Name');
      ok.onclick = save;
      const no = el('button', 'act', 'Keep');
      no.onclick = () => { _renaming = false; rerender(); };
      row.append(ok, no);
      extra.push(row);
    }
    list.append(card(el, { art: HORSE_ART, glyph: '♞', name, words: words.horse, sub: v?.horseName ? 'Your horse' : null, extra, rerender }).item);
  }
  if (words.wagon) {
    const extra = [];
    if (v && v.limit > 0) extra.push(holdingMeter(el, meter, 'Load', v.kg, v.limit, 'thin'));
    if (m.paint) {   // WAGONS2: its outside's paints, a button each - pressed, painted
      const row = el('div', 'hld-acts');
      row.append(el('span', 'hld-sub', `${LOOK_TEXT.paint}:`));
      m.paint.choices.forEach((name, i) => {
        const b = el('button', i === m.paint.current ? 'act primary' : 'act', name);
        b.setAttribute('aria-pressed', i === m.paint.current ? 'true' : 'false');
        b.onclick = () => act('paint', i);
        row.append(b);
      });
      extra.push(row);
    }
    list.append(card(el, { art: WAGON_ART, glyph: '☸', name: stableWagonName(m.kind), words: words.wagon, sub: m.kind && m.kind !== 'cart' ? WAGON_KINDS[m.kind]?.name ?? null : null, extra, rerender }).item);   // WAGONS1: the wagon driven, by its kind
  }
  detail.append(list);
  // THE ACTS - the pair's, as the mod's summon is (both answer together)
  if (_said) detail.append(el('p', _said.ok ? 'hld-said' : 'hld-why', _said.text));
  const acts = el('div', 'hld-acts');
  if (m.hcc && v?.persistence) {
    const sum = el('button', 'act primary', 'Summon');
    sum.title = 'Your horse and wagon come to your side';
    sum.onclick = () => act('summon');
    acts.append(sum);
    if (v.out) {
      const away = el('button', 'act', 'Send away');
      away.title = 'Back to the stable, out of the world - mounted from the Transport window, or summoned again';
      away.onclick = () => act('away');
      acts.append(away);
    }
  }
  if (m.hcc && words.horse && !_renaming) {
    const ren = el('button', 'act', 'Rename horse');
    ren.onclick = () => { _renaming = true; _draft = v?.horseName ?? ''; _said = null; rerender(); };
    acts.append(ren);
  }
  if (acts.childNodes?.length ?? acts.children?.length) detail.append(acts);
  detail.append(el('p', 'hld-foot', m.hcc
    ? (v?.persistence ? 'Your horse and wagon stand in the world: summoned to your side, or sent back to the stable.' : `Turn on physical persistence (Horse Cart and Cargo\u2019s options, ${optionPath('feat:mod-horse-cart-and-cargo')}) to have them stand in the world.`)
    : `Turn on Horse Cart and Cargo (${optionPath('feat:mod-horse-cart-and-cargo')}) to have your horse and wagon stand in the world.`));
}

/** A visit's words forgotten (an act's answer, an open name field) - the pause menu's every mount. */
export function resetHoldingsPages() { _said = null; _renaming = false; _draft = ''; }
