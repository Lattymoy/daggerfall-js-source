// @ts-check
// COLLECTIONS (2026-10-08, Mac: "I think we add a new tab in holdings for the weapon codex and card collection"; answered:
// "One 'Collections' tab"): THE COLLECTIONS PAGE on the Enhanced pause menu's Holdings rail (ui/enhancedMenu.js
// pauseHoldings) - what a character has gathered, in two parts under one switch:
//
//   THE CODEX (LOOT10, systems/lootCodex.js; bible/06-Systems/Loot-Arc.md section 12): every Legendary record and every
//     Aetheric set, found and not - a found one's name, its group, the day it was first found and what it is; an unfound
//     one's group and where it is said to be. The same rows the Reforge's Codex page draws (ui/reforgeWindow.js
//     renderCodex), read from the same codex, so the two never disagree. The pack's Codex button still opens that window.
//   THE CARDS (CARDS8, bible/11-Multiplayer/Tavern-Cards.md section 26): the Card Binder's collection and its decks - the
//     binder's own page (ui/cardBinderPage.js), drawn here.
//
// Dressed by the stone-and-brass kit's roles as the other Holdings pages are (ui/enhancedFrame.js FRAME_ROLES) - this
// sheet writes geometry and the words' colours alone.

import { codexRows, codexSets, codexCount } from '../systems/lootCodex.js';
import { lootRarityOn, powerLine, legendaryById, affixLine } from '../systems/lootRarity.js';
import { setById } from '../systems/sigilSets.js';
import { cardsPartShown, drawCardsPart, resetCardsPart } from './cardBinderPage.js';

export const COLLECTION_PAGE_SECTIONS = Object.freeze([Object.freeze(['collections', 'Collections'])]);
export const COLLECTION_PAGE_STYLE_ID = 'collections-page-css';
/** The page's two parts, in the switch's order. */
export const COLLECTION_PARTS = Object.freeze([Object.freeze(['codex', 'Codex']), Object.freeze(['cards', 'Cards'])]);

/** The rail shows the page while either part has something to show: the codex while Loot rarity makes Legendaries, the
 *  cards while the character carries a Card Binder. */
export const collectionsPageShown = (player = null) => lootRarityOn() || cardsPartShown(player);
/** The parts shown now, in order. */
export const collectionParts = (player = null) => COLLECTION_PARTS.filter(([id]) => (id === 'codex' ? lootRarityOn() : cardsPartShown(player)));

let _part = 'codex';
let _picked = null;   // the codex row opened whole
/** The page forgotten (a load, a new character): back to its first part. */
export function resetCollectionsPage() { _part = 'codex'; _picked = null; resetCardsPart(); }

export const COLLECTION_PAGE_CSS = `
.px-sys .coll-parts { display: flex; gap: 6px; margin: 2px 0 10px; }
.px-sys .coll-part { padding: 4px 12px; border-width: 2px; border-style: solid; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #b8b0a0; cursor: pointer; background: transparent; }
.px-sys .coll-part.on { color: #f3cf86; }
.px-sys .codex-list { display: flex; flex-direction: column; gap: 4px; margin: 4px 0 10px; }
.px-sys .codex-line { display: flex; justify-content: space-between; gap: 10px; padding: 5px 9px; border-width: 1px; border-style: solid; text-align: left; cursor: pointer; background: transparent; }
.px-sys .codex-line .nm { font-size: 13px; color: #8b8578; }
.px-sys .codex-line.found .nm { color: #e07a2e; }
.px-sys .codex-line .sub { font-size: 11px; color: #8b8578; text-align: right; }
.px-sys .codex-line.on { border-color: #e07a2e; }
.px-sys .codex-whole { margin: 2px 0 10px 12px; font-size: 12px; color: #e9e4d9; }
.px-sys .codex-whole li { margin: 2px 0; }
.px-sys .codex-set { font-size: 12px; color: #bfe8ff; margin: 2px 0 8px; }
.px-sys .codex-set .unfound { color: #8b8578; }
`;
function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(COLLECTION_PAGE_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = COLLECTION_PAGE_STYLE_ID;
  st.textContent = COLLECTION_PAGE_CSS;
  doc.head?.appendChild(st);
}

/**
 * The page into `detail`: the switch, then the chosen part.
 * @param {any} detail @param {() => void} rerender
 * @param {{el: Function, divider: Function, meter?: Function, player?: any}} kit
 */
export function drawCollectionsPage(detail, rerender, kit) {
  ensureStyle(typeof document === 'undefined' ? null : document);
  const { el } = kit;
  const parts = collectionParts(kit.player ?? null);
  if (!parts.length) { detail.append(el('p', 'px-note', 'Nothing gathered yet. Legendaries come with Loot rarity, and cards with a Card Binder.')); return; }
  if (!parts.some(([id]) => id === _part)) _part = parts[0][0];
  if (parts.length > 1) {
    const sw = el('div', 'coll-parts');
    for (const [id, label] of parts) {
      const b = el('button', `coll-part${id === _part ? ' on' : ''}`, label);
      b.type = 'button';
      b.onclick = () => { _part = id; rerender(); };
      sw.append(b);
    }
    detail.append(sw);
  }
  if (_part === 'codex') drawCodexPart(detail, rerender, kit);
  else drawCardsPart(detail, rerender, kit);
}

/** THE CODEX PART: the Legendaries, found and not, then the Aetheric sets; a row pressed opens it whole. */
function drawCodexPart(detail, rerender, { el, divider }) {
  const n = codexCount();
  const rows = codexRows();
  detail.append(divider(`Legendaries - ${n.legendary} of ${n.legendaries} found`));
  const list = el('div', 'codex-list');
  for (const r of rows) {
    const line = el('button', `codex-line${r.found ? ' found' : ''}${_picked === r.id ? ' on' : ''}`);
    line.type = 'button';
    line.dataset.record = r.id;
    line.append(el('span', 'nm', r.found ? r.name : 'Unfound'), el('span', 'sub', r.found ? `${r.group} · found on day ${r.day}` : `${r.group} · ${r.hint}`));
    line.onclick = () => { _picked = _picked === r.id ? null : r.id; rerender(); };
    list.append(line);
    if (_picked === r.id) list.append(codexWhole(el, r));
  }
  detail.append(list);
  detail.append(divider(`Aetheric - ${n.aetheric} of ${n.aetherics} found`));
  for (const s of codexSets()) {
    const p = el('p', 'codex-set');
    p.append(el('span', null, `${setById(s.set)?.name ?? s.set}: `));
    s.pieces.forEach((x, i) => { if (i) p.append(el('span', null, ' · ')); p.append(el('span', x.found ? null : 'unfound', x.found ? x.name : '?')); });
    detail.append(p);
  }
}
/** A codex row opened whole: what the record is (found), or where it is said to be. */
function codexWhole(el, r) {
  const ul = el('ul', 'codex-whole');
  if (r.found) {
    for (const a of legendaryById(r.id)?.affixes ?? []) { const line = affixLine({ rarity: 'legendary', affixes: [a] }, 0); if (line) ul.append(el('li', null, line)); }
    if (r.power) ul.append(el('li', null, powerLine(r.power)));
    if (r.lore) ul.append(el('li', null, r.lore));
    ul.append(el('li', null, `First found on day ${r.day}`));
  } else ul.append(el('li', null, r.hint || 'Not yet found'));
  return ul;
}
