// @ts-check
// COLLECTIONS (2026-10-08, Mac: "I think we add a new tab in holdings for the weapon codex and card collection"; answered:
// "One 'Collections' tab"): THE COLLECTIONS PAGE on the Enhanced pause menu's Holdings rail (ui/enhanced/enhancedMenu.js
// pauseHoldings) - what a character has gathered, in two parts under one switch:
//
//   THE CODEX (LOOT10, systems/loot/lootCodex.js; bible/06-Systems/Loot-Arc.md section 12): every Legendary record and every
//     Aetheric set, found and not - a found one's name, its group, the day it was first found and what it is; an unfound
//     one's group and where it is said to be. The rows, the lines a row opened shows and the sets' counts are the
//     Reforge's Codex page's (ui/reforgeWindow.js renderCodex - AUDIT CARDS-5 D12 made the lines the same), read from the
//     same codex, so the two never disagree; the Scry door is the guilds' window's alone. The pack's Codex button still
//     opens that window.
//   THE CARDS (CARDS8, bible/11-Multiplayer/Tavern-Cards.md section 26): the Card Binder's collection and its decks - the
//     binder's own page (ui/card/cardBinderPage.js), drawn here.
//
// Dressed by the stone-and-brass kit's roles as the other Holdings pages are (ui/enhanced/enhancedFrame.js FRAME_ROLES) - this
// sheet writes geometry and the words' colours alone. CARDS-PLUS (2026-10-13, bible/11-Multiplayer/Tavern-Cards.md
// section 38): until then that sentence was a claim the roles did not keep - none named the switch, the codex's rows or
// the binder's filters, chips and decks, and this sheet's own `background` and border colours painted over any that
// might; the switch and the binder's presses are the kit's tiles now, a codex row its list line, a deck its panel.
//
// COLLECTIONS-II (2026-10-22, the owner: "with the introduction of a lot of titles, auras, profile icons, etc I think its
// time we introduce these elements to the collections tab, along with telling how they are found, even if they arent
// currently able to be obtained. This needs to be a proper overhaul to the collections ui"; bible/10-UI/Collections.md):
// the page is every player's now, its parts six - the account's WARDROBE first, a kind a part (Titles, Auras, Icons,
// Glyphs: ui/collections/wardrobePart.js over ui/collections/wardrobeCatalogue.js - every one, held or not, where it
// comes from and how it is had, worn from here), then this character's Codex and Cards. The switch is a row of tiles,
// each its part's name over its count and a meter of it, so the page opens on how much of everything is collected.

import { codexRows, codexSets, codexCount, codexGilded } from '../systems/loot/lootCodex.js';   // AUDIT WORLD-REWARDS A5: and the Gilded rung's rows
import { lootRarityOn, powerLine, legendaryById, affixLine, RARITIES } from '../systems/loot/lootRarity.js';
import { gildedById } from '../systems/gilded.js';
import { setById } from '../systems/sigil/sigilSets.js';
import { cardsPartShown, drawCardsPart, resetCardsPart, disarmCardsPart, deckCards } from './card/cardBinderPage.js';
import { collectionOf } from '../systems/iliac/iliacItems.js';   // COLLECTIONS-II: the Cards tile's count
import { t } from '../systems/textManager.js';
import { wardrobeCount, wordPair } from './collections/wardrobeCatalogue.js';   // COLLECTIONS-II: the wardrobe's parts
import { drawWardrobePart, wardrobeAccount, wardrobeOfFlow, resetWardrobePart, rereadWardrobeAccount, WARDROBE_PART_CSS, WARDROBE_THEME_CSS } from './collections/wardrobePart.js';

export const COLLECTION_PAGE_SECTIONS = Object.freeze([Object.freeze(['collections', 'Collections'])]);
export const COLLECTION_PAGE_STYLE_ID = 'collections-page-css';
/** The page's parts, in the switch's order - COLLECTIONS-II: the account's wardrobe, a kind a part, then the character's
 *  codex and cards. Each `[id, its name]`, the name read when drawn. */
export const COLLECTION_PARTS = Object.freeze([
  wordPair('titles', () => t('coll.part.titles', 'Titles')),
  wordPair('auras', () => t('coll.part.auras', 'Auras')),
  wordPair('icons', () => t('coll.part.icons', 'Icons')),
  wordPair('glyphs', () => t('coll.part.glyphs', 'Glyphs')),
  wordPair('codex', () => t('coll.part.codex', 'Codex')),
  wordPair('cards', () => t('coll.part.cards', 'Cards')),
]);
/** COLLECTIONS-II: the wardrobe's parts and the kind each lists (ui/collections/wardrobeCatalogue.js WARDROBE_KINDS). */
export const WARDROBE_PARTS = Object.freeze({ titles: 'title', auras: 'aura', icons: 'icon', glyphs: 'glyph' });
const partOfKind = (/** @type {string} */ kind) => Object.keys(WARDROBE_PARTS).find((id) => WARDROBE_PARTS[/** @type {keyof typeof WARDROBE_PARTS} */ (id)] === kind) ?? null;

/** COLLECTIONS-II: THE RAIL SHOWS THE PAGE ALWAYS - the wardrobe's catalogue is every player's to read, held or not
 *  (until then the page showed only while the codex or the cards had something). */
export const collectionsPageShown = (_player = null) => true;
/** The parts shown now, in order: the wardrobe's four always, the codex while Loot rarity makes Legendaries, the cards
 *  while the character carries a Card Binder. */
export const collectionParts = (player = null) => COLLECTION_PARTS.filter(([id]) => (id === 'codex' ? lootRarityOn() : id === 'cards' ? cardsPartShown(player) : true));

let _part = 'titles';
let _picked = null;   // the codex row opened whole
/** The page forgotten (a load, a new character): back to its first part. COLLECTIONS-II: and the wardrobe's rows, its
 *  filter and its account read. */
export function resetCollectionsPage() { _part = 'titles'; _picked = null; resetCardsPart(); resetWardrobePart(); }
/** AUDIT CARDS-5 D5: leaving the page (another rail page, another tab) disarms what was armed on it. (AUDIT COLLECTIONS-II,
 *  lane 2: the account's read is the menu visit's, kept across leaving - resetCollectionsPage lets it go.) */
export function disarmCollectionsPage() { disarmCardsPart(); }
/** AUDIT COLLECTIONS-II (lane 2): the account card closed - the page's read of the account asked again (a wear, a
 *  sign-out or another account there is the service's to say). */
export function rereadCollectionsAccount() { rereadWardrobeAccount(); }
/** AUDIT CARDS-5 D14: a landing names the part to open on ('codex' | 'cards'; COLLECTIONS-II: or a wardrobe kind's). */
export function setCollectionsPart(/** @type {string} */ part) { if (COLLECTION_PARTS.some(([id]) => id === part)) _part = part; }

export const COLLECTION_PAGE_CSS = `
.px-sys .coll-parts { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; margin: 2px 0 12px; }
.px-sys .coll-part { display: flex; flex-direction: column; align-items: stretch; gap: 3px; padding: 6px 9px 7px; border-width: 2px; border-style: solid; text-align: left; color: #b8b0a0; cursor: pointer; }
.px-sys .coll-part .coll-pname { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
.px-sys .coll-part .coll-pcount { font-size: 11px; color: #8b8578; }
.px-sys .coll-part .px-meter { height: 8px; margin-top: 2px; }
.px-sys .coll-part.on { color: #f3cf86; }
.px-sys .coll-part.on .coll-pcount { color: #e9e4d9; }
.px-sys .codex-list { display: flex; flex-direction: column; gap: 4px; margin: 4px 0 10px; }
.px-sys .codex-line { display: flex; justify-content: space-between; gap: 10px; padding: 5px 9px 6px; border-width: 0 0 1px; border-style: solid; text-align: left; cursor: pointer; }
.px-sys .codex-line .nm { font-size: 13px; color: #8b8578; }
.px-sys .codex-line.found .nm { color: #e07a2e; }
.px-sys .codex-line .sub { font-size: 11px; color: #8b8578; text-align: right; }
.px-sys .codex-whole { margin: 2px 0 10px; padding: 8px 12px 10px; border-width: 2px; border-style: solid; list-style: none; font-size: 12px; color: #e9e4d9; }
.px-sys .codex-whole li { margin: 2px 0; }
.px-sys .codex-set { font-size: 12px; color: #bfe8ff; margin: 2px 0 8px; }
.px-sys .codex-set .unfound { color: #8b8578; }
`;
function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(COLLECTION_PAGE_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = COLLECTION_PAGE_STYLE_ID;
  st.textContent = `${COLLECTION_PAGE_CSS}${WARDROBE_PART_CSS}${WARDROBE_THEME_CSS}`;   // COLLECTIONS-II: and the wardrobe's parts' sheet - AUDIT COLLECTIONS-II: and its Stone theme's
  doc.head?.appendChild(st);
}

/**
 * The page into `detail`: the switch, then the chosen part.
 * @param {any} detail @param {() => void} rerender
 * @param {{el: Function, divider: Function, meter?: Function, player?: any, account?: (onChange: () => void) => any, doc?: any, now?: () => number}} kit
 *   COLLECTIONS-II: `account` the host's account-flow constructor (the wardrobe's read and its presses), `doc` and `now`
 *   a pin's own document and clock
 */
export function drawCollectionsPage(detail, rerender, kit) {
  ensureStyle(typeof document === 'undefined' ? null : document);
  const flow = wardrobeAccount(kit, rerender);   // COLLECTIONS-II: the account's wardrobe, asked once a visit
  const parts = collectionParts(kit.player ?? null);
  if (!parts.some(([id]) => id === _part)) _part = parts[0][0];
  detail.append(partTiles(kit, parts, wardrobeOfFlow(flow), rerender));
  const kind = WARDROBE_PARTS[/** @type {keyof typeof WARDROBE_PARTS} */ (_part)];
  const goTo = (/** @type {string} */ k) => { const id = partOfKind(k); if (id) { _part = id; disarmCardsPart(); } };
  if (kind) drawWardrobePart(detail, rerender, { ...kit, goTo }, kind, flow);
  else if (_part === 'codex') drawCodexPart(detail, rerender, kit);
  else drawCardsPart(detail, rerender, kit);
}

/** COLLECTIONS-II: A PART'S COUNT - `{ held, total }`, held null where it cannot be known (no account read): a wardrobe
 *  kind's off the account's wardrobe, the codex's every record found (the Gilded rung, the Legendaries, the Aetheric
 *  pieces), the cards' every card of the catalog the binder holds one of. */
export function partCount(/** @type {string} */ id, /** @type {any} */ wardrobe, /** @type {any} */ player = null) {
  const kind = WARDROBE_PARTS[/** @type {keyof typeof WARDROBE_PARTS} */ (id)];
  if (kind) { const n = wardrobeCount(kind, wardrobe); return { held: wardrobe ? n.held : null, total: n.total }; }
  if (id === 'codex') { const n = codexCount(); return { held: n.gilded + n.legendary + n.aetheric, total: n.gildeds + n.legendaries + n.aetherics }; }
  const have = collectionOf(player?.items);
  const all = deckCards();
  return { held: all.filter((c) => have.has(c.id)).length, total: all.length };
}

/** COLLECTIONS-II: THE SWITCH - a tile a part, its name over its count and a meter of it; the one shown brass. */
function partTiles(/** @type {any} */ kit, /** @type {ReadonlyArray<readonly [string, () => string]>} */ parts, /** @type {any} */ wardrobe, /** @type {() => void} */ rerender) {
  const { el } = kit;
  const sw = el('div', 'coll-parts');
  for (const [id, label] of parts) {
    const n = partCount(id, wardrobe, kit.player ?? null);
    const b = el('button', `coll-part${id === _part ? ' on' : ''}`);
    b.type = 'button';
    b.setAttribute('data-focus', `coll-part-${id}`);
    b.setAttribute('aria-pressed', id === _part ? 'true' : 'false');
    b.append(el('span', 'coll-pname', label()), el('span', 'coll-pcount', t('coll.count', '{held} / {total}', { held: n.held ?? '–', total: n.total })));
    if (typeof kit.meter === 'function') b.append(kit.meter(n.held ?? 0, n.total));
    b.onclick = () => { _part = id; disarmCardsPart(); rerender(); };
    sw.append(b);
  }
  return sw;
}

/** THE CODEX PART: the Legendaries, found and not, then the Aetheric sets; a row pressed opens it whole. AUDIT WORLD-REWARDS
 *  A5: and the Gilded rung's records first, over them all, as the Reforge's Codex page lists them - this page's rows are
 *  that page's, and it never showed the rung (GILDED1), nor the gate's and the serpent's own hints (GILDED2). */
function drawCodexPart(detail, rerender, { el, divider }) {
  const n = codexCount();
  const rows = codexRows();
  detail.append(divider(t('coll.codex.gilded', 'Gilded - {n} of {total} found', { n: n.gilded, total: n.gildeds })));   // AUDIT COLLECTIONS-II (lanes 3, 5): the codex's words in the player's language, on a page every player opens
  const gilded = el('div', 'codex-list');
  for (const r of codexGilded()) gilded.append(...codexLine(el, r, rerender));
  detail.append(gilded);
  detail.append(divider(t('coll.codex.legendaries', 'Legendaries - {n} of {total} found', { n: n.legendary, total: n.legendaries })));
  const list = el('div', 'codex-list');
  for (const r of rows) list.append(...codexLine(el, r, rerender));
  detail.append(list);
  detail.append(divider(t('coll.codex.aetheric', 'Aetheric - {n} of {total} found', { n: n.aetheric, total: n.aetherics })));
  for (const s of codexSets()) {
    const p = el('p', 'codex-set');
    p.append(el('span', null, t('coll.codex.set', '{name} - {n} of {total}:', { name: setById(s.set)?.name ?? s.set, n: s.pieces.filter((x) => x.found).length, total: s.pieces.length })), el('span', null, ' '));   // AUDIT CARDS-5 D12: each set's count, as the Reforge's
    s.pieces.forEach((x, i) => { if (i) p.append(el('span', null, ' · ')); p.append(el('span', x.found ? null : 'unfound', x.found ? x.name : '?')); });
    detail.append(p);
  }
}
/** One codex row, and - pressed - the record whole under it (a Legendary's or, AUDIT WORLD-REWARDS A5, a Gilded's). */
function codexLine(el, r, rerender) {
  const out = [];
  {
    const line = el('button', `codex-line${r.found ? ' found' : ''}${_picked === r.id ? ' on' : ''}`);
    line.type = 'button';
    line.dataset.record = r.id;
    line.append(el('span', 'nm', r.found ? r.name : t('coll.codex.unfound', 'Unfound')), el('span', 'sub', r.found ? t('coll.codex.foundOn', '{group} · found on day {day}', { group: r.group, day: r.day }) : `${r.group} · ${r.hint}`));
    line.setAttribute('data-focus', `codex-row-${r.id}`);
    line.onclick = () => { _picked = _picked === r.id ? null : r.id; rerender(); };
    if (r.kind === 'gilded' && r.found) line.dataset.rarity = 'gilded';
    out.push(line);
    if (_picked === r.id) out.push(codexWhole(el, r));
  }
  return out;
}
/** A codex row opened whole: what the record is (found), or where it is said to be. */
function codexWhole(el, r) {
  const ul = el('ul', 'codex-whole');
  ul.append(el('li', null, `${RARITIES[r.kind]?.label ?? 'Legendary'} · ${r.group}`));   // AUDIT CARDS-5 D12: the Reforge's own lines, in its order
  if (r.found) {
    const rec = r.kind === 'gilded' ? gildedById(r.id) : legendaryById(r.id);   // AUDIT WORLD-REWARDS A5: a Gilded record's lines, as the Reforge's
    for (const a of rec?.affixes ?? []) { const line = affixLine({ rarity: r.kind ?? 'legendary', affixes: [a] }, 0); if (line) ul.append(el('li', null, line)); }
    if (r.power) ul.append(el('li', null, powerLine(r.power)));
    if (r.lore) ul.append(el('li', null, r.lore));
    ul.append(el('li', null, t('coll.codex.firstFound', 'First found on day {day}', { day: r.day })));
  } else ul.append(el('li', null, t('coll.codex.notFound', 'Not yet found')));
  if (r.hint) ul.append(el('li', 'codex-hint', r.hint));
  return ul;
}
