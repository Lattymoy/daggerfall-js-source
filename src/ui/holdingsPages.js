// @ts-check
// HOLDINGS (2026-10-03, Mac: "Lets add a new tab to the pause menu as the stat page is starting to get bloated. Lets
// organize everything appropriately. Under the new tab add a page that allows you to see your currently owned mounts
// ships and carts. You can summon your horse/cart from this page/send away much like the companion system. You can also
// do this with ships instead of relying on a deed item") - THE HOLDINGS TAB's own pages (bible/03-World/Holdings.md).
// The tab (ui/enhanced/enhancedMenu.js pauseHoldings) is a rail of what the player owns and who follows them: these two pages,
// and the Companions, Revenants and Stores pages that stood on the Stats rail before it.
//
//  - THE STABLE: the horse and the wagon - owned or not, where each is (ridden, following, parked or waiting how far
//    off, with the player, or stabled - WAGON-STABLED: sent away), the wagon's load against its limit; SUMMON (Horse Cart and Cargo's own summon) and SEND AWAY
//    (its other half, systems/horse/horseCart.js sendTransportAway), and the horse renamed in place. Each act's word is said
//    under its card, never on a HUD the window covers.
//  - THE FLEET: every ship the player holds - drawn by ui/fleetPage.js over the same provider.
//
// THE PROVIDER is the host's (scenes/world.js, scenes/exterior.js - setHoldingsProvider): what the pages read and the
// acts they ask, so this file touches no runtime. Dressed by the stone-and-brass kit's roles (ui/enhanced/enhancedFrame.js
// FRAME_ROLES: a card a panel, a picture a well, a state a chip) - this sheet writes geometry and
// the words' colours alone, as the Companions page's does.

import { stableWagonName, WAGON_KINDS } from '../systems/wagon/wagonKinds.js';   // WAGONS1: the Stable's card names the wagon driven
import { paintDrivenWagon, outsidePaintRow, LOOK_TEXT } from '../systems/wagon/wagonLooks.js';   // WAGONS2: and paints it
import { restyleRiddenHorse, horseLookRows, birthHorses, HORSE_LOOK_PARTS } from '../systems/horse/horseCoats.js';   // COATS1: and the horse's look
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HORSE_NAME_MAX } from '../systems/horse/horseCartLaw.js';
import { optionPath } from './settings/settingsMap.js';   // ORG2: a switch named in a window says where it lives
import { upkeepReach } from '../systems/upkeep/upkeepRuntime.js';   // STEED1/WAGONS4: a horse fed by hand only beside it, a kit spent only at the wagon
import { t } from '../systems/textManager.js';   // HORSE-TIERS: Boons' two hunger lines in the player's language

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
 * @property {string|null} [kind]   WAGONS1: the wagon driven ('cart', 'openWagon', 'caravan' - systems/wagon/wagonKinds.js)
 * @property {{ choices: string[], current: number }|null} [paint]   WAGONS2: its outside's paints, and its paint now
 * @property {{ desc: string, rows: Array<{ part: string, name: string, choices: string[], current: number }> }|null} [look]   COATS1: the ridden horse's look - in words, and a row of choices a part (coat, pattern, legs)
 * @property {any} [care]   STEED1/WAGONS4: the upkeep's model (systems/upkeep/upkeepRuntime.js model) - each horse's stats, bond, hunger and breath; the wagon's soundness; the oats, apples and kits carried
 *
 * @typedef {Object} HoldingsProvider
 * @property {() => StableModel} [stable]   the horse and the wagon
 * @property {(verb: 'summon'|'away'|'rename'|'paint'|'coat'|'pattern'|'legs'|'feed'|'treat'|'ride'|'kit', arg?: any) => { ok: boolean, text: string }} [stableAct]
 * @property {any} [fleet]   the fleet's model and acts (ui/fleetPage.js)
 * @property {{ model: () => any, openStars?: () => boolean }} [captain]   CAPT-LOG: the captain's standing, letter, contracts and log (ui/captainPage.js) - CAPTAIN-TREE: `openStars` the stars' window
 */
let _provider = /** @type {HoldingsProvider|null} */ (null);
/** The host's provider, or null to take the pages down. */
export function setHoldingsProvider(p) { _provider = p ?? null; }
export const holdingsProvider = () => _provider;
/**
 * THE ONE CONSTRUCTION SEAM (Home.md) for the two hosts that stand Horse Cart and Cargo (scenes/world.js,
 * scenes/exterior.js): the Stable's half of the provider over a host's runtime - `on()` the mod's switch, `hasHorse()`
 * and `hasCart()` the pack's two items. WAGONS2: `items()` the pack (the driven wagon painted in it - systems/
 * wagonLooks.js paintDrivenWagon) and `onPainted()` the host told (its word moved). COATS1: the ridden horse's look
 * (systems/horse/horseCoats.js restyleRiddenHorse - its coat, its pattern, its legs) the same way, in the same pack, the host
 * told the same; and a horse not yet born is born before the card reads it (birthHorses). STEED1/WAGONS4: `upkeep` the
 * host's (systems/upkeep/upkeepRuntime.js createUpkeep) - its model on the card, and its acts: a horse fed by hand only beside it
 * (the mod's own mount reach - a horse waiting across the map is not) and never at the stable; a kit spent on the wagon
 * only where its load can be reached; `pass(minutes)` the host's clock for the kit's hour.
 */
export function stableProviderFor({ runtime, on, hasHorse, hasCart, wagonKind = () => null, items = () => [], onPainted = () => {}, upkeep = null, pass = () => {} }) {
  const view = () => (on() ? runtime.stableView() : null);
  return {
    stable: () => { birthHorses(items()); const v = view(); return { hcc: !!on(), hasHorse: !!hasHorse(), hasCart: !!hasCart(), view: v, kind: wagonKind() ?? null, paint: outsidePaintRow(items()), look: horseLookRows(items()), care: upkeep?.model({ near: upkeepReach(runtime, on()).near, name: v?.horseName ?? '' }) ?? null }; },   // WAGONS1: which wagon; WAGONS2: its paint; COATS1: the horse's look; STEED1/WAGONS4: their upkeep
    stableAct: (verb, arg) => {
      if (upkeep && (verb === 'feed' || verb === 'treat' || verb === 'ride' || verb === 'kit')) {   // STEED1/WAGONS4: the upkeep's own acts, the mod on or off
        const r = upkeep.act(verb, arg, { ...upkeepReach(runtime, on()), pass });
        if (r.ok) onPainted();
        return r;
      }
      if (verb === 'paint') { const r = paintDrivenWagon(items(), 'outside', Number(arg) | 0); if (r.ok) onPainted(); return r; }   // WAGONS2: free, any time, the mod on or off - the paint is the wagon's
      if (HORSE_LOOK_PARTS.some((p) => p.part === verb)) { const r = restyleRiddenHorse(items(), verb, Number(arg) | 0); if (r.ok) onPainted(); return r; }   // COATS1: the same - the look is the horse's
      if (!on()) return { ok: false, text: `Turn on Horse Cart and Cargo (${optionPath('feat:mod-horse-cart-and-cargo')}) to call your horse and wagon.` };   // ORG2: where it lives, from the map
      if (verb === 'summon') return runtime.summonTransport();
      if (verb === 'away') return runtime.sendTransportAway();
      // AUDIT HOLDINGS C5: a horse never named answers '' - his own, not none
      if (verb === 'rename') { const n = runtime.renameHorse(arg); return n == null ? { ok: false, text: 'You do not own a horse.' } : n ? { ok: true, text: `Your horse is called ${n}.` } : { ok: false, text: 'Your horse has no name. Give him one.' }; }
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
.px-sys .hld-name { font-size: 17px; color: #f3cf86; overflow-wrap: anywhere; }
.px-sys .hld-state { flex: none; padding: 0 6px; border-width: 1px; border-style: solid; font-size: 12px; line-height: 1.5; letter-spacing: 0.1em; text-transform: uppercase; color: #8fc7a0; }
.px-sys .hld-state.is-away { color: #b8b0a0; }
.px-sys .hld-state.is-hurt { color: #e0a54a; }
.px-sys .hld-state.is-lost { color: #ff8a78; }
.px-sys .hld-sub { font-size: 14px; line-height: 1.35; color: #bdb4a0; }   /* UI-CALM: the card's words were 11px grey under 17px presses */
.px-sys .hld-meter { display: grid; grid-template-columns: 96px minmax(0, 1fr) 104px; align-items: center; gap: 10px; max-width: 400px; }
.px-sys .hld-meter.hld-stat { grid-template-columns: 96px minmax(0, 1fr) 104px; }
.px-sys .hld-mk { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #cfc7b1; }
.px-sys .hld-mn { font-size: 13px; color: #ddd5bd; font-variant-numeric: tabular-nums; }
.px-sys .hld-why { font-size: 13px; color: #e0a54a; }
.px-sys .hld-said { font-size: 13px; color: #8fc7a0; }
.px-sys .hld-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.px-sys .hld-acts .act { min-width: 0; padding-left: 12px; padding-right: 12px; font-size: 14px; letter-spacing: 0.06em; }
.px-sys .hld-acts .act[aria-disabled="true"] { opacity: 0.55; }
.px-sys .hld-field { font: inherit; font-size: 14px; min-height: 32px; padding: 2px 8px; box-sizing: border-box; width: 100%; max-width: 260px;
  color: #e9e4d9; background: rgba(15,17,22,0.75); border: 2px solid rgba(125,116,96,0.7); }
.px-sys .hld-foot { font-size: 13px; line-height: 1.35; color: #bdb4a0; margin: 6px 0 0; }
/* UI-CALM: the card's sections - the care, then the stats under a small head, then the look a line and a small press */
.px-sys .hld-stats { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
.px-sys .hld-subhead { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #9c937d; margin-bottom: 2px; }
.px-sys .hld-lookline { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
.px-sys .hld-linkbtn { font: inherit; font-size: 13px; letter-spacing: 0.04em; padding: 2px 0; min-height: 0; background: none; border: 0;
  color: #f3cf86; text-decoration: none; cursor: pointer; }
.px-sys .hld-linkbtn::before { content: '\\203a  '; }
.px-sys .hld-linkbtn:hover, .px-sys .hld-linkbtn:focus-visible { color: rgb(243,239,44); outline: none; }
/* UI-CALM: a look's choice is a SELECTOR - swatches where each choice is a colour, a stepper where it is a word */
.px-sys .hld-pick { display: grid; grid-template-columns: 96px auto 1fr; align-items: center; gap: 10px; min-height: 30px; }
.px-sys .hld-picklabel { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #cfc7b1; }
.px-sys .hld-pickname { font-size: 14px; color: #ddd5bd; }
.px-sys .hld-swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.px-sys .hld-swatch { width: 22px; height: 22px; padding: 0; min-height: 0; box-sizing: border-box; cursor: pointer; background: var(--sw, #555);
  border: 2px solid #050608; box-shadow: 0 0 0 1px #5a5446; }
.px-sys .hld-swatch:hover, .px-sys .hld-swatch:focus-visible { outline: none; box-shadow: 0 0 0 2px #f3cf86; }
.px-sys .hld-swatch.on { box-shadow: 0 0 0 2px rgb(243,239,44), 0 0 0 4px #050608; }
.px-sys .hld-step { font: inherit; font-size: 18px; line-height: 1; width: 28px; height: 28px; min-height: 0; padding: 0; cursor: pointer;
  color: #ddd5bd; background: rgba(10,12,17,0.6); border: 2px solid #5a5446; }
.px-sys .hld-step:hover, .px-sys .hld-step:focus-visible { outline: none; color: rgb(243,239,44); border-color: #f3cf86; }
.px-sys .hld-pick:has(.hld-step) { grid-template-columns: 96px auto minmax(7em, auto) auto 1fr; }
.px-sys .hld-stepname { text-align: center; }
.px-sys .hld-refit { display: flex; flex-direction: column; gap: 3px; padding: 6px 9px 7px; border-width: 2px; border-style: solid; box-sizing: border-box; margin-top: 6px; }
/* SHIP-COLOURS: the flag she will fly, over the designer's rows (ui/fleetPage.js coloursPanel) */
.px-sys .hld-flag { width: max-content; padding: 6px; margin: 4px 0; background: rgba(10,12,17,0.55); border: 2px solid #5a5446; }
.px-sys .hld-flag svg { display: block; }
.px-sys .hld-swatch.hld-swatch-none { background: repeating-linear-gradient(45deg, #2a2a2a 0 4px, #555 4px 8px); }
.px-sys .hld-log { display: grid; grid-template-columns: minmax(120px, 38%) 1fr; align-items: baseline; gap: 8px; }
@media (max-width: 480px) { .px-sys .hld-field { font-size: 16px; } }
:root[data-plus-theme="stone"] .px-sys .hld-sub, :root[data-plus-theme="stone"] .px-sys .hld-foot { color: #e2d9c4; }
@media (max-width: 480px) { .px-sys .hld-pick { grid-template-columns: 1fr; gap: 4px; } .px-sys .hld-pick:has(.hld-step) { grid-template-columns: auto minmax(0, 1fr) auto; } .px-sys .hld-pick:has(.hld-step) .hld-picklabel { grid-column: 1 / -1; } .px-sys .hld-stepname { min-width: 0; overflow-wrap: anywhere; } }   /* AUDIT UICALM-FIRM1 L4 L6: the name gives way, the › stays on the card */
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
/** STEED1: a stat's row - its word, the kit's bar of it out of 100, and the number with its bond's share beside.
 *  STEED-UI: its making on the row's tooltip - what it was born with, what the bond adds, what hunger takes. */
function statMeter(el, meter, label, now, plus, tone, why = '') {
  const r = el('div', 'hld-meter hld-stat');
  r.append(el('span', 'hld-mk', label));
  r.append(typeof meter === 'function' ? meter(Math.max(0, now), 100, tone) : el('span', null, ''));
  r.append(el('span', 'hld-mn', plus ? `${Math.round(now)} (+${plus})` : `${Math.round(now)}`));
  if (why) r.title = why;
  return r;
}
/** STEED-UI: a stat's making in words - born, the bond's points, hunger's. */
export const statWhy = (st, bonus, penalty, hunger) => [`Born ${st.born}`, bonus ? `+${bonus} from your bond` : '', penalty ? `−${penalty} ${String(hunger).toLowerCase()}` : ''].filter(Boolean).join(', ');
/** STEED1: a hunger's chip tone. HORSE-TIERS: NO RED where hunger costs nothing (Boons) - amber at most. */
const HUNGER_TONE = Object.freeze({ fed: '', hungry: 'is-hurt', starving: 'is-lost' });
export const hungerTone = (h, care) => (care?.hungerCosts === false && h.hungerKey === 'starving' ? HUNGER_TONE.hungry : HUNGER_TONE[h.hungerKey] ?? '');
/** STEED1: what a hunger costs, in the card's words. STEED-UI: a fed horse says how long its food lasts. HORSE-TIERS:
 *  each tier's own words - Hard's what hunger takes, Boons' only the gallop a starving horse has not earned. */
const HUNGER_LINE = Object.freeze({
  fed: 'Fed.',
  hungry: 'Hungry: every attribute 10 lower, and slower to catch its breath.',
  starving: 'Starving: every attribute 25 lower, no gallop, and your bond is fading. Feed it.',
});
const HUNGER_LINE_BOONS = Object.freeze({   // HORSE-TIERS: in the player's language (L10N4's ratchet), read as it is shown
  fed: 'Fed.',
  get hungry() { return t('holdings.horse.boons.hungry', 'Hungry, but no penalty yet.'); },
  get starving() { return t('holdings.horse.boons.starving', 'Starving. It will not gallop until it eats. Feed it.'); },
});
/** STEED-UI: the bond's row - the kit's bar of the way from its word to the next, and the points still to go (whole at
 *  Kindred). */
function bondMeter(el, meter, h) {
  const r = el('div', 'hld-meter');
  r.append(el('span', 'hld-mk', 'Bond'));
  const span = h.next ? h.next.at - (h.tierAt ?? 0) : 1, got = h.next ? h.bond - (h.tierAt ?? 0) : 1;
  r.append(typeof meter === 'function' ? meter(Math.max(0, got), span, 'thin') : el('span', null, ''));
  r.append(el('span', 'hld-mn', h.next ? `${h.next.at - Math.floor(h.bond)} to ${h.next.name}` : 'Whole'));
  r.title = h.next ? `Fed by your hand, ${h.tier} grows to ${h.next.name} at ${h.next.at}` : 'Kindred: the bond is complete';
  return r;
}
/** STEED-UI: hours of food as a card says them. */
const foodHours = (hours) => (hours >= 2 ? `${Math.floor(hours)} hours` : hours * 60 >= 2 ? `${Math.round(hours * 60)} minutes` : 'a minute');
export const hungerLine = (h, care = null) => (h.hungerKey === 'fed' && h.fedHours > 0 ? `Fed, with food enough for ${foodHours(h.fedHours)}.` : (care?.hungerCosts === false ? HUNGER_LINE_BOONS : HUNGER_LINE)[h.hungerKey] ?? '');
/** STEED1: the choice to ride horse `h` (`chooseRiddenHorse` - made the pack's first). FIELD BUGS 2026-10-16b
 *  HORSE-CARE-OFF: on every other horse's card in every tier - with its care, or (Off, any skin but the enhanced one)
 *  in a row of its own. */
function rideButton(el, h, act) {
  const ride = el('button', 'act', 'Ride this one');
  ride.title = 'The horse you ride, and the first in your wagon’s team';
  ride.onclick = () => act('ride', h.i);
  return ride;
}
/**
 * STEED1: a horse's care on its card - its bond and hunger in words, its breath (the one ridden), its four stats, and
 * the acts: oats and an apple from the pack, and the one ridden chosen. `h` a horse of the upkeep's model.
 * STEED-UI: its bond a bar to the next word, its food's hours, a winded breath said, each stat's making on its tooltip.
 */
function steedLines(el, meter, h, care, act) {
  const out = [];
  out.push(el('span', 'hld-sub', `${h.tier} - bond ${Math.floor(h.bond)} of 100${h.bonus ? `, +${h.bonus} to every stat` : ''}. ${hungerLine(h, care)}`));
  out.push(bondMeter(el, meter, h));
  if (h.ridden) {
    out.push(holdingMeter(el, meter, 'Breath', h.breath * 100, 100, h.breath < 0.25 || h.winded ? 'blood' : 'verdigris'));
    if (h.winded) out.push(el('span', 'hld-sub hld-why', 'Winded. It will not gallop until it has caught its breath.'));
  }
  const row = el('div', 'hld-acts');
  const feed = el('button', h.full ? 'act' : 'act primary', `Feed oats (${care.oats})`);
  feed.title = h.full ? 'It is not hungry' : 'A sack of oats, a day’s food';
  if (!care.oats || h.full || !care.near) feed.setAttribute('aria-disabled', 'true');
  feed.onclick = () => act('feed', h.i);
  const treat = el('button', 'act', `Give an apple (${care.apples})`);
  treat.title = 'A treat it loves: a little food, and the bond grows faster';
  if (!care.apples || h.full || !care.near) treat.setAttribute('aria-disabled', 'true');
  treat.onclick = () => act('treat', h.i);
  row.append(feed, treat);
  if (!h.ridden) row.append(rideButton(el, h, act));
  out.push(row);
  // UI-CALM: the care first - its words, its bond and breath and the presses that answer them - then the four stats, a
  // block of their own under a small head (they are read, never pressed)
  const stats = el('div', 'hld-stats');
  stats.append(el('span', 'hld-subhead', 'Stats'));
  for (const st of h.stats) stats.append(statMeter(el, meter, st.name, st.now, Math.max(0, st.now - st.born), 'thin', statWhy(st, h.bonus, h.penalty, h.hunger)));
  out.push(stats);
  return out;
}
/** STEED-UI: a wagon's state's bar tone - sound and worn the kit's verdigris, rickety its plain, failing blood. */
const WAGON_METER_TONE = Object.freeze({ sound: 'verdigris', worn: 'verdigris', rickety: '', failing: 'blood' });
/** WAGON-TIERS: NO RED where wear costs nothing (Boons - Climates & Calories' RED MEANS IT COSTS): a failing wagon's bar
 *  is rickety's plain. A read that does not say (`wearSlows` absent) is the system as it stood. */
export const wagonMeterTone = (w) => (w.wearSlows === false && w.stateKey === 'failing' ? WAGON_METER_TONE.rickety : WAGON_METER_TONE[w.stateKey] ?? 'verdigris');
/** WAGON-TIERS: Boons' words - a worn-down wagon rolls at its pace (the yard's price follows, mendLine), and a Sound one
 *  rolls faster for it. */
const WAGON_ADVICE_BOONS = Object.freeze({   // in the player's language (L10N4's ratchet), read as it is shown
  get rickety() { return t('holdings.wagon.boons.rickety', 'Rickety, but it still rolls at full pace.'); },
  get failing() { return t('holdings.wagon.boons.failing', 'Failing, but it still rolls at full pace.'); },
  get sound() { return t('holdings.wagon.boons.sound', 'Sound, and it rolls faster for it.'); },   // Mac: "Sound wagon rolls faster"
});
/** STEED-UI: what a Wagon Yard asks to make it whole - at the yard, and with its wright going out to it. */
export const mendLine = (w) => (w.mend > 0 ? `A Wagon Yard repairs it fully for ${w.mend} gold, or ${w.mendAway} if its wright must travel to it.` : 'A town’s Wagon Yard mends it.');
/** WAGONS4: the wagon's soundness on its card - its condition, its state's word, and a kit's act. STEED-UI: its bar in
 *  its state's tone, and the yard's price. */
function wagonLines(el, meter, w, care, act) {
  const out = [];
  out.push(holdingMeter(el, meter, 'Repair', w.share * 100, 100, wagonMeterTone(w)));
  const advice = w.wearSlows === false && Object.hasOwn(WAGON_ADVICE_BOONS, w.stateKey) ? WAGON_ADVICE_BOONS[w.stateKey]   // WAGON-TIERS: Boons says no slowness, and the boon
    : w.stateKey === 'failing' ? 'Failing. Its team pulls it at its slowest.'
    : w.stateKey === 'rickety' ? 'Rickety. Its team pulls it more slowly.' : w.stateKey === 'worn' ? 'Worn. A Wagon Yard can repair it.' : 'Sound.';
  out.push(el('span', `hld-sub${w.tone ? ' hld-why' : ''}`, `${advice} ${mendLine(w)}`));
  if (w.kitWorks) {
    const row = el('div', 'hld-acts');
    const kit = el('button', 'act', `Use a repair kit (${care.kits})`);
    kit.title = 'An hour’s work: a quarter of its soundness back, to 60% at most';
    if (!care.kits) kit.setAttribute('aria-disabled', 'true');
    kit.onclick = () => act('kit');
    row.append(kit);
    out.push(row);
  }
  return out;
}

/** How far a thing stands, in the words a card uses. */
export const farWords = (m) => (m == null ? 'away from here' : m < 1000 ? `${m} m away` : `${(m / 1000).toFixed(1)} km away`);

/** The chip of a horse or a wagon with the player: the classic transport's (the mod off, or its persistence), and
 *  WAGON-STABLED's - the mod's WithPlayer never sent to the stable, which the next door leaves outside. */
const WITH_YOU = 'With you';

/**
 * THE STABLE'S WORDS: where the horse and the wagon each are, as a chip's word and a line under it, off the runtime's
 * view (systems/horse/horseCart.js stableView) - or, with Horse Cart and Cargo off, the classic transport's: with the player.
 * Pure. Answers `{ horse, wagon }`, each `{ state, tone, line }` or null for one not owned.
 * @param {StableModel} m
 */
export function stableWords(m) {
  if (!m.hcc || !m.view) {
    const classic = { state: WITH_YOU, tone: '', line: 'Ride from the Transport window.' };
    return { horse: m.hasHorse ? classic : null, wagon: m.hasCart ? { ...classic, line: 'Its load rides with you.' } : null };
  }
  const v = m.view;
  if (!v.persistence) {
    const classic = { state: WITH_YOU, tone: '', line: 'Physical persistence is off: it travels with you.' };
    return { horse: v.hasHorse ? classic : null, wagon: v.hasCart ? classic : null };
  }
  const riding = v.transport === TRANSPORT.Horse, driving = v.transport === TRANSPORT.Cart;
  const teamFollowing = v.wagonMode === WAGON_MODE.FollowingPlayer && v.horseMode === HORSE_MODE.HitchedToWagon;
  const beside = { state: WITH_YOU, tone: '', line: 'At your side. It waits outside the next door you go through.' };   // WAGON-STABLED
  let horse = null, wagon = null;
  if (v.hasHorse) {
    if (riding) horse = { state: 'Riding', tone: '', line: 'You are in the saddle.' };
    else if (driving) horse = { state: 'In harness', tone: '', line: 'Pulling your wagon.' };
    else if (teamFollowing || v.horseMode === HORSE_MODE.FollowingPlayer) horse = { state: 'Following', tone: '', line: teamFollowing ? 'Following you with the wagon.' : 'Following you.' };
    else if (v.horseMode === HORSE_MODE.LooseStationary) horse = { state: 'Waiting', tone: 'is-away', line: `Waiting where you left it, ${farWords(v.horseAt)}.` };
    else if (v.horseMode === HORSE_MODE.HitchedToWagon && v.wagonMode === WAGON_MODE.Deployed) horse = { state: 'Hitched', tone: 'is-away', line: `Hitched to your parked wagon, ${farWords(v.wagonAt)}.` };
    // WAGON-STABLED: Stabled is sent away (the runtime's word); the mod's WithPlayer never sent is beside the player, and
    // the next door stands it outside
    else if (!v.horseStabled) horse = beside;
    else horse = { state: 'Stabled', tone: 'is-away', line: 'Stabled. Mount it from the Transport window, or summon it to your side.' };
  }
  if (v.hasCart) {
    if (driving) wagon = { state: 'Driving', tone: '', line: 'You are on the box.' };
    else if (teamFollowing) wagon = { state: 'Following', tone: '', line: 'Following you behind your horse.' };
    else if (v.wagonMode === WAGON_MODE.Deployed) wagon = { state: 'Parked', tone: 'is-away', line: `Parked ${farWords(v.wagonAt)}.` };
    else if (!v.wagonStabled) wagon = beside;
    else wagon = { state: 'Stabled', tone: 'is-away', line: v.hasHorse ? 'Stored. Drive it from the Transport window, or summon it.' : 'Stored. You need a horse to pull it.' };
  }
  return { horse, wagon };
}

let _said = null;   // { who: 'horse'|'wagon'|'both', ok, text } - the last act's word
let _renaming = false;   // the horse's name field open
let _draft = '';
let _lookOpen = '';   // UI-CALM: whose look's pickers are open - 'horse', 'wagon', or none

/** UI-CALM: a colour a look's swatch wears, by the name the card says - a horse's coats, a wagon's outside paints. A
 *  name with none is drawn as a word (the stepper). */
export const LOOK_SWATCHES = Object.freeze({
  Bay: '#7a4527', Chestnut: '#9c5224', Black: '#26211e', Grey: '#9d9a93', Dun: '#b39a6b', Buckskin: '#c9a256', Palomino: '#dcbd7c',
  'Weathered oak': '#7d6a4f', Red: '#9a2f24', Blue: '#2f4f8a', Green: '#3d6a3a', White: '#e4ded0', 'Cream canvas': '#e3d6b4',
  Ochre: '#c08a2e', Oxblood: '#5e1d1b',
});

/**
 * WAGONS2/COATS1: a card's row of choices. UI-CALM (2026-10-14, a player: "Why are horse coat colors huge buttons
 * instead of a selector? Why do they take up more space than the horse stats?"): A SELECTOR, NOT A WALL OF PRESSES - its
 * word, then where every choice has a colour (a coat, a wagon's paint) a row of small swatches, the one worn ringed and
 * named beside them; else a stepper, ‹ the one worn › . Each swatch says its name to a reader and under the pointer.
 */
function choiceRow(el, word, { choices, current }, choose) {
  const row = el('div', 'hld-pick');
  row.append(el('span', 'hld-picklabel', word));
  const colours = choices.map((name) => LOOK_SWATCHES[name] ?? null);
  if (colours.every(Boolean)) {
    const set = el('div', 'hld-swatches');
    set.setAttribute('role', 'radiogroup');
    set.setAttribute('aria-label', word);
    choices.forEach((name, i) => {
      const b = el('button', `hld-swatch${i === current ? ' on' : ''}`);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i === current ? 'true' : 'false');
      b.setAttribute('aria-label', name);
      b.title = name;
      if (b.style) b.style.setProperty?.('--sw', colours[i]);
      b.onclick = () => choose(i);
      set.append(b);
    });
    row.append(set, el('span', 'hld-pickname', choices[current] ?? ''));
    return row;
  }
  const n = choices.length;
  const step = (d, glyph, aria) => {
    const b = el('button', 'hld-step', glyph);
    b.setAttribute('aria-label', aria);
    b.onclick = () => choose(((current + d) % n + n) % n);
    return b;
  };
  row.append(step(-1, '\u2039', `${word}: previous`), el('span', 'hld-pickname hld-stepname', choices[current] ?? ''), step(1, '\u203a', `${word}: next`));
  return row;
}
/** UI-CALM: a look in words, and the small press that opens its pickers (or closes them). */
function lookLine(el, who, desc, rerender) {
  const row = el('div', 'hld-lookline');
  row.append(el('span', 'hld-sub', desc));
  const b = el('button', 'hld-linkbtn', _lookOpen === who ? 'Done' : 'Change look');
  b.setAttribute('aria-expanded', _lookOpen === who ? 'true' : 'false');
  b.onclick = () => { _lookOpen = _lookOpen === who ? '' : who; rerender(); };
  row.append(b);
  return row;
}

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
    detail.append(el('p', 'px-note', 'You own no horse and no wagon. A city\'s or town\'s Stable sells horses to ride, and its Wagon Yard carts and wagons to carry more than you can.'));
    return;
  }
  const v = m.hcc ? m.view : null;
  const care = m.care ?? null;   // STEED1/WAGONS4: the upkeep's model
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
    const ridden = care?.horseCare ? care.horses.find((h) => h.ridden) : null;
    if (ridden) extra.push(...steedLines(el, meter, ridden, care, act));   // STEED1: its care
    // COATS1: its look in words, and (UI-CALM) behind a small press its coats, patterns and legs as selectors - the look
    // is chosen once in a while, the care read every visit, so the care comes first and the look waits to be asked for
    if (m.look) {
      extra.push(lookLine(el, 'horse', `${m.look.desc[0].toUpperCase()}${m.look.desc.slice(1)}.`, rerender));
      if (_lookOpen === 'horse') for (const row of m.look.rows) extra.push(choiceRow(el, row.name, row, (i) => act(/** @type {any} */ (row.part), i)));
    }
    list.append(card(el, { art: HORSE_ART, glyph: '♞', name, words: words.horse, sub: v?.horseName ? 'Your horse' : null, extra, rerender }).item);
    // STEED1: every other horse owned - its look, its care, and the choice to ride it. FIELD BUGS 2026-10-16b
    // HORSE-CARE-OFF: on every tier - Off (and any skin but the enhanced one) its look and the choice, no care to show
    for (const h of care ? care.horses.filter((x) => !x.ridden) : []) {
      const cared = !!care.horseCare;
      const extra = cared ? steedLines(el, meter, h, care, act) : [el('div', 'hld-acts')];
      if (!cared) extra[0].append(rideButton(el, h, act));
      list.append(card(el, { art: HORSE_ART, glyph: '♞', name: `${h.look[0].toUpperCase()}${h.look.slice(1)}`, words: cared ? { state: h.hunger, tone: hungerTone(h, care), line: null } : null, sub: 'Another horse of yours', extra, rerender }).item);
    }
  }
  if (words.wagon) {
    const extra = [];
    if (v && v.limit > 0) extra.push(holdingMeter(el, meter, 'Load', v.kg, v.limit, 'thin'));
    if (care?.wagonUpkeep && care.wagon) extra.push(...wagonLines(el, meter, care.wagon, care, act));   // WAGONS4: its soundness, and a kit
    if (m.paint) {   // WAGONS2: its outside's paints - UI-CALM: swatches, behind the same small press as the horse's look
      extra.push(lookLine(el, 'wagon', `${LOOK_TEXT.paint}: ${m.paint.choices[m.paint.current] ?? ''}.`, rerender));
      if (_lookOpen === 'wagon') extra.push(choiceRow(el, LOOK_TEXT.paint, m.paint, (i) => act('paint', i)));
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
      away.title = 'Back to the stable. Mount it from the Transport window, or summon it again';
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
export function resetHoldingsPages() { _said = null; _renaming = false; _draft = ''; _lookOpen = ''; }
