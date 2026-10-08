// @ts-check
// CARDS8 (2026-10-08, Mac: "Tab + CARDS7 + CARDS8"; bible/11-Multiplayer/Tavern-Cards.md section 26): THE CARDS PART of
// the Collections page (ui/collectionsPage.js) - the Card Binder's collection and its decks:
//
//   THE COLLECTION: every card of the catalog (net/iliacCards.js) a deck can hold, in a grid of their painted faces
//     (render/iliacCardFaces.js - "Painted in code"): one the pack holds at its count, one it does not shown dim, its
//     name kept (a collection is a list of what is still to find). A kind's switch narrows it. A card pressed says what
//     it is.
//   THE DECKS: the binder's (systems/iliacItems.js `decks`), each with its count and the rules' word on it (net/
//     iliacHand.js deckValid) and the pack's (deckHeldRefusal - a deck needs the cards it names). Edit, delete (a second
//     press), or start a new one.
//   THE DECK BUILDER: a deck open for building - a card pressed in the grid goes in, a card pressed in the deck comes out;
//     kept once the rules and the pack allow it.
//
// The locations are no deck's (the game draws its three holdings from them) - the collection shows the cards a player
// holds and builds with. Dressed by the stone-and-brass kit as the other Holdings pages are.

import { ILIAC_CARDS, cardById } from '../net/iliacCards.js';
import { deckValid } from '../net/iliacHand.js';
import { paintIliacCard, paintIliacBack, ILIAC_CARD_ASPECT } from '../render/iliacCardFaces.js';
import { binderOf, collectionOf, deckHeldRefusal, setBinderDeck, dropBinderDeck, DECK_NAME_MAX, BINDER_DECKS_MAX } from '../systems/iliacItems.js';

export const CARD_BINDER_STYLE_ID = 'card-binder-page-css';
/** The kinds' switch: [id, label]. */
export const CARD_KIND_FILTERS = Object.freeze([['all', 'All'], ['unit', 'Units'], ['spell', 'Spells'], ['prince', 'Princes']]);
/** A tile's height in the grid (its width the cards' aspect). */
const TILE_H = 112;
/** The rules' and the pack's refusals of a deck, in words. */
export const DECK_REFUSAL_WORDS = Object.freeze({
  size: 'A deck holds exactly 30 cards.', copies: 'At most two of one card.', legendary: 'At most one of a Legendary or rarer card.',
  'unknown card': 'A card this build does not know.', 'not held': 'Your binder does not hold every card this deck names.',
});

/** The deck cards: the catalog's (its locations are a list of their own - net/iliacCards.js ILIAC_LOCATIONS). */
export const deckCards = () => ILIAC_CARDS;
/** Whether the part shows: the character carries a binder. */
export const cardsPartShown = (/** @type {any} */ player = null) => !!binderOf(player?.items);

let _filter = 'all';
let _picked = /** @type {string|null} */ (null);
let _editing = /** @type {{i: number, name: string, cards: string[]}|null} */ (null);
let _dropArmed = /** @type {number|null} */ (null);
let _said = /** @type {string|null} */ (null);
/** The part forgotten (a load, a new character, a visit's end). */
export function resetCardsPart() { _filter = 'all'; _picked = null; _editing = null; _dropArmed = null; _said = null; }

export const CARD_BINDER_CSS = `
.px-sys .binder-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
.px-sys .binder-filter { padding: 2px 10px; border-width: 1px; border-style: solid; font-size: 11px; color: #b8b0a0; background: transparent; cursor: pointer; }
.px-sys .binder-filter.on { color: #f3cf86; border-color: #c08a3e; }
.px-sys .binder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(${Math.round(TILE_H * 0.7)}px, 1fr)); gap: 8px; margin: 4px 0 10px; }
.px-sys .binder-tile { position: relative; padding: 0; border: none; background: transparent; cursor: pointer; }
.px-sys .binder-tile canvas { display: block; width: 100%; height: auto; }
.px-sys .binder-tile.unheld canvas { opacity: 0.32; filter: grayscale(0.8); }
.px-sys .binder-tile.on { outline: 2px solid #f3cf86; }
.px-sys .binder-count { position: absolute; right: 3px; top: 3px; padding: 0 4px; font-size: 11px; background: rgba(20,16,10,0.85); color: #f3cf86; border: 1px solid #8a6a3a; }
.px-sys .binder-name { font-size: 10px; color: #b8b0a0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-sys .binder-said { font-size: 12px; color: #e9e4d9; margin: 2px 0 8px; }
.px-sys .binder-decks { display: flex; flex-direction: column; gap: 4px; margin: 4px 0 10px; }
.px-sys .binder-deck { display: flex; align-items: center; gap: 8px; padding: 5px 9px; border-width: 1px; border-style: solid; }
.px-sys .binder-deck .nm { flex: 1; font-size: 13px; color: #f3cf86; }
.px-sys .binder-deck .why { font-size: 11px; color: #d0604f; }
.px-sys .binder-deck .ok { font-size: 11px; color: #9fc28a; }
.px-sys .binder-edit { margin: 4px 0 10px; }
.px-sys .binder-edit input { font: inherit; padding: 2px 6px; margin-right: 6px; }
.px-sys .binder-deckcards { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.px-sys .binder-chip { padding: 1px 6px; font-size: 11px; border: 1px solid #8a6a3a; color: #e9e4d9; background: transparent; cursor: pointer; }
`;
function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(CARD_BINDER_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = CARD_BINDER_STYLE_ID;
  st.textContent = CARD_BINDER_CSS;
  doc.head?.appendChild(st);
}

/** A card's painted face on a canvas, `h` tall (a back for a card the catalog does not know). Never throws: a host with no
 *  2D context (the bench's DOM) draws nothing. */
export function cardCanvas(/** @type {any} */ doc, /** @type {any} */ card, h = TILE_H) {
  const cv = doc.createElement('canvas');
  const dpr = Math.min(2, Number(globalThis.devicePixelRatio) || 1);
  const w = Math.round(h * ILIAC_CARD_ASPECT);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext?.('2d');
  if (ctx) {
    ctx.scale?.(dpr, dpr);
    try { if (card) paintIliacCard(ctx, card, w, h); else paintIliacBack(ctx, w, h); } catch { /* a face that will not paint is a blank tile */ }
  }
  return cv;
}

/** Why `cards` cannot be kept in this pack's binder, or null. */
export function deckRefusal(/** @type {string[]} */ cards, /** @type {any[]} */ items) {
  return deckValid(cards) ?? deckHeldRefusal(cards, items);
}

/**
 * The part into `detail`.
 * @param {any} detail @param {() => void} rerender @param {{el: Function, divider: Function, player?: any}} kit
 */
export function drawCardsPart(detail, rerender, kit) {
  const doc = typeof document === 'undefined' ? null : document;
  ensureStyle(doc);
  const { el, divider } = kit;
  const items = kit.player?.items ?? [];
  const binder = binderOf(items);
  if (!binder) { detail.append(el('p', 'px-note', 'No Card Binder carried.')); return; }
  const have = collectionOf(items);
  const all = deckCards();
  const kinds = all.filter((c) => have.has(c.id)).length;
  const total = [...have.values()].reduce((s, n) => s + n, 0);
  // THE DECKS (or the one open for building) first - what a player came to change
  if (_editing) drawEditor(detail, rerender, el, items, binder);
  else drawDecks(detail, rerender, el, divider, items, binder);
  detail.append(divider(`Collection - ${kinds} of ${all.length} cards (${total} held)`));
  const filters = el('div', 'binder-filters');
  for (const [id, label] of CARD_KIND_FILTERS) {
    const b = el('button', `binder-filter${id === _filter ? ' on' : ''}`, label);
    b.type = 'button';
    b.onclick = () => { _filter = id; rerender(); };
    filters.append(b);
  }
  detail.append(filters);
  if (_said) detail.append(el('p', 'binder-said', _said));
  const grid = el('div', 'binder-grid');
  for (const c of all.filter((x) => _filter === 'all' || x.kind === _filter)) {
    const n = have.get(c.id) ?? 0;
    const tile = el('button', `binder-tile${n ? '' : ' unheld'}${_picked === c.id ? ' on' : ''}`);
    tile.type = 'button';
    tile.dataset.card = c.id;
    tile.title = `${c.name} - ${c.text}`;
    if (doc) tile.append(cardCanvas(doc, c));
    if (n) tile.append(el('span', 'binder-count', `×${n}`));
    tile.append(el('div', 'binder-name', c.name));
    tile.onclick = () => pressCard(c.id, n, rerender);
    grid.append(tile);
  }
  detail.append(grid);
}

/** A card pressed: building, it goes in the deck; else it is said. */
function pressCard(/** @type {string} */ id, /** @type {number} */ held, rerender) {
  const c = cardById(id);
  _picked = id;
  if (_editing && c) {
    const inDeck = _editing.cards.filter((x) => x === id).length;
    if (!held) _said = `Your binder holds no ${c.name}.`;
    else if (inDeck >= held) _said = `Your binder holds ${held} ${c.name} - all of them are in this deck.`;
    else { _editing.cards = [..._editing.cards, id]; _said = `${c.name} into the deck (${_editing.cards.length} of 30).`; }
  } else if (c) _said = `${c.name}: ${c.text}${held ? ` You hold ${held}.` : ' You hold none yet.'}`;
  rerender();
}

/** THE DECKS: each with its count and whether it can be played, and its acts. */
function drawDecks(detail, rerender, el, divider, items, binder) {
  const decks = Array.isArray(binder.decks) ? binder.decks : [];
  detail.append(divider(`Decks - ${decks.length} of ${BINDER_DECKS_MAX}`));
  const list = el('div', 'binder-decks');
  decks.forEach((d, i) => {
    const row = el('div', 'binder-deck');
    row.dataset.deck = String(i);
    const why = deckRefusal(d.cards, items);
    row.append(el('span', 'nm', d.name), el('span', why ? 'why' : 'ok', why ? DECK_REFUSAL_WORDS[why] ?? why : `${d.cards.length} cards - ready`));
    const edit = el('button', 'act', 'Edit');
    edit.type = 'button';
    edit.onclick = () => { _editing = { i, name: d.name, cards: d.cards.slice() }; _said = null; _dropArmed = null; rerender(); };
    const drop = el('button', 'act', _dropArmed === i ? 'Delete it' : 'Delete');
    drop.type = 'button';
    drop.onclick = () => {
      if (_dropArmed !== i) { _dropArmed = i; rerender(); return; }
      dropBinderDeck(binder, i); _dropArmed = null; _said = `${d.name} taken apart - its cards stay in your binder.`; rerender();
    };
    row.append(edit, drop);
    list.append(row);
  });
  detail.append(list);
  if (decks.length < BINDER_DECKS_MAX) {
    const add = el('button', 'act', 'New deck');
    add.type = 'button';
    add.onclick = () => { _editing = { i: decks.length, name: `Deck ${decks.length + 1}`, cards: [] }; _said = 'Press a card below to put it in the deck.'; _dropArmed = null; rerender(); };
    detail.append(add);
  }
}

/** THE DECK BUILDER: its name, its cards (a press takes one out), its count and the rules' word; kept when allowed. */
function drawEditor(detail, rerender, el, items, binder) {
  const e = /** @type {{i: number, name: string, cards: string[]}} */ (_editing);
  const box = el('div', 'binder-edit');
  box.append(el('div', 'px-qverdict', `Building - ${e.cards.length} of 30`));
  const name = el('input');
  name.type = 'text';
  name.maxLength = DECK_NAME_MAX;
  name.value = e.name;
  name.setAttribute?.('aria-label', 'Deck name');
  name.oninput = () => { e.name = String(name.value ?? '').slice(0, DECK_NAME_MAX); };
  box.append(name);
  const chips = el('div', 'binder-deckcards');
  const counts = new Map();
  for (const id of e.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of [...counts].sort((a, b) => (cardById(a[0])?.cost ?? 0) - (cardById(b[0])?.cost ?? 0))) {
    const chip = el('button', 'binder-chip', `${cardById(id)?.name ?? id} ×${n}`);
    chip.type = 'button';
    chip.dataset.card = id;
    chip.onclick = () => { const k = e.cards.lastIndexOf(id); if (k >= 0) e.cards = e.cards.filter((_, j) => j !== k); rerender(); };
    chips.append(chip);
  }
  box.append(chips);
  const why = deckRefusal(e.cards, items);
  box.append(el('p', why ? 'why' : 'ok', why ? DECK_REFUSAL_WORDS[why] ?? why : 'This deck can be played.'));
  const keep = el('button', 'act', 'Keep deck');
  keep.type = 'button';
  keep.disabled = !!why;
  keep.onclick = () => {
    if (deckRefusal(e.cards, items)) return;
    if (setBinderDeck(binder, e.i, { name: e.name.trim() || `Deck ${e.i + 1}`, cards: e.cards })) { _said = `${e.name.trim() || 'The deck'} kept in your binder.`; _editing = null; }
    rerender();
  };
  const cancel = el('button', 'act', 'Cancel');
  cancel.type = 'button';
  cancel.onclick = () => { _editing = null; _said = null; rerender(); };
  box.append(keep, cancel);
  detail.append(box);
}
