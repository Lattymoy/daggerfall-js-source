// @ts-check
// GEM3 (2026-10-09) - THE SOCKETS, DRAWN.
//
// Gem Sockets (bible/06-Systems/Gem-Sockets.md section 5; Mac: "Id like to have and show weapons with physical gem
// slots that can be slotted into"). LOOT20 told a socket in words - "Socket: empty", one more line under the affixes -
// and filled it only at a guild's page. This is the socket as a PLACE on the piece: a row of round wells under the
// card's picture, one a socket, an empty one sunk and dark and a set one holding its gem's own picture in a ring of its
// grade's colour; and on every tile of a socketed piece, one pip a socket in the top edge (the corners are the key's,
// the tier's, the count's and the rune's), filled where a gem is set. A graded gem's own tile wears its grade's ring.
//
// The wells are the pack's to press (ui/enhancedInventory.js hands `onWell` on its own piece's detail card): an empty
// one opens the gems the pack holds, a set one asks first and shatters its gem. The facts and the presses are
// systems/lootRarity.js's and systems/reforge.js's; this file draws them, and owns its sheet (one style tag, both
// skins), so no other dress has to know a socket exists.
import { socketsOf, gemLine, affixLabel, GEM_NAMES, SOCKET_EMPTY, gemGrade, gemKindOf, lootRarityOn } from '../systems/lootRarity.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** Each grade's ring - the poorer greys, DFU's own plain stone in bone, the two the port adds above it in ice and gold. */
export const GEM_GRADE_COLOURS = Object.freeze({ chipped: '#7d776c', flawed: '#b3ab98', plain: '#e9e4d9', flawless: '#7fe0ff', perfect: '#ffd24a' });
export const SOCKET_WELLS_STYLE_ID = 'gem-socket-wells';
const gradeRules = Object.entries(GEM_GRADE_COLOURS).map(([g, c]) => `[data-gem-grade="${g}"] { --gem-ring: ${c}; }`).join('\n');
export const SOCKET_WELLS_CSS = `/* GEM3: the card's wells, the chooser, and the tile's pips (ui/socketWells.js) */
${gradeRules}
.sock-wells { display: flex; justify-content: center; gap: 8px; margin: 6px 0 8px; }
.sock-well { position: relative; width: 30px; height: 30px; padding: 0; border-radius: 50%; border: 2px solid;
  border-color: #2a2620 #6a6253 #6a6253 #2a2620; background: radial-gradient(circle at 50% 60%, #050608 0 45%, #1a1712 75%);
  box-shadow: 0 0 0 1px #050608, inset 0 2px 4px rgba(0,0,0,0.85); display: inline-flex; align-items: center; justify-content: center;
  cursor: default; color: inherit; font: inherit; }
.sock-well.set { border-color: var(--gem-ring, #e9e4d9); background: radial-gradient(circle at 40% 35%, #2a2620, #050608 70%);
  box-shadow: 0 0 0 1px #050608, inset 0 1px 3px rgba(0,0,0,0.8), 0 0 8px color-mix(in srgb, var(--gem-ring, #e9e4d9) 55%, transparent); }
.sock-well img { width: 22px; height: 22px; image-rendering: pixelated; pointer-events: none; }
.sock-well.press { cursor: pointer; }
.sock-well.press:hover, .sock-well.press:focus-visible { outline: 1px solid #f3cf86; outline-offset: 1px; }
.sock-well[data-asking] { border-color: #d0604f; box-shadow: 0 0 0 1px #050608, 0 0 10px rgba(208,96,79,0.8); }
.sock-well[data-open] { border-color: #f3cf86; }
.sock-choose { margin: 0 0 8px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.sock-choose > li { margin: 0; }
.sock-pick { width: 100%; display: flex; align-items: center; gap: 8px; padding: 3px 8px; text-align: left; cursor: pointer;
  font: inherit; font-size: 12px; color: #e9e4d9; background: rgba(5,6,8,0.55); border: 1px solid #6a6253; }
.sock-pick:hover, .sock-pick:focus-visible { border-color: var(--gem-ring, #f3cf86); }
.sock-pick .sock-gem { color: var(--gem-ring, #e9e4d9); }
.sock-none { margin: 0 0 8px; font-size: 12px; color: #a89f88; text-align: center; }
.sock-pips { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); display: flex; gap: 2px; z-index: 2;
  pointer-events: none; }
.sock-pips > i { width: 5px; height: 5px; border-radius: 50%; background: #050608; box-shadow: 0 0 0 1px #8a8170; }
.sock-pips > i.set { background: var(--gem-ring, #e9e4d9); box-shadow: 0 0 0 1px #050608, 0 0 3px var(--gem-ring, #e9e4d9); }
[data-gem-grade]:not([data-rarity]) img { filter: drop-shadow(0 0 3px var(--gem-ring)) drop-shadow(1px 1px 0 #050608); }
@media (pointer: coarse) { .sock-well { width: 40px; height: 40px; } .sock-pick { min-height: 40px; } }
`;
function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(SOCKET_WELLS_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = SOCKET_WELLS_STYLE_ID;
  st.textContent = SOCKET_WELLS_CSS;
  doc.head?.appendChild(st);
}

/** A well's word: the gem and its line ("Flawless Ruby: +4 Fire damage"), or the empty socket's. */
export function wellText(item, value) {
  if (value === SOCKET_EMPTY) return 'Empty socket';
  const line = gemLine(item, value);
  return line ? `${GEM_NAMES[value]}: ${affixLabel(/** @type {any} */ (line))}` : '';
}

/**
 * THE CARD'S WELLS for a piece, or null for a piece with no socket (or the ladder off): a row of round wells, one a
 * socket in its order. `picture(gemId)` answers a gem's picture node (or null while it loads); `onWell(at, value)`
 * makes the wells pressable (the pack's own piece's card); `asking` the well whose Shatter is waiting, `open` the well
 * whose chooser is open.
 * @param {any} item
 * @param {{ picture?: ((gem: string) => any) | null, onWell?: ((at: number, value: string) => void) | null, asking?: number|null, open?: number|null }} [opts]
 */
export function socketWells(item, { picture = null, onWell = null, asking = null, open = null } = {}) {
  if (!lootRarityOn()) return null;
  const list = socketsOf(item);
  if (!list.length) return null;
  ensureStyle(globalThis.document);
  const row = el('div', 'sock-wells');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', list.length === 1 ? 'Socket' : `${list.length} sockets`);
  list.forEach((v, at) => {
    const w = el(onWell ? 'button' : 'span', `sock-well${v === SOCKET_EMPTY ? ' empty' : ' set'}${onWell ? ' press' : ''}`);
    w.dataset.socket = String(at);
    if (v !== SOCKET_EMPTY) {
      w.dataset.gem = v;
      w.dataset.gemGrade = /** @type {string} */ (gemGrade(v));
      const pic = picture?.(v) ?? null;
      if (pic) w.append(pic);
    }
    const said = asking === at && v !== SOCKET_EMPTY ? `${wellText(item, v)} - press again to shatter it` : wellText(item, v);
    w.setAttribute('title', said);
    w.setAttribute('aria-label', said);
    if (asking === at && v !== SOCKET_EMPTY) w.dataset.asking = '';
    if (open === at && v === SOCKET_EMPTY) w.dataset.open = '';
    if (onWell) {
      w.setAttribute('type', 'button');
      w.onclick = (e) => { e?.stopPropagation?.(); onWell(at, v); };
    }
    row.append(w);
  });
  return row;
}

/**
 * THE CHOOSER under an open empty well: a press a gem the pack holds, each with the line it would give THIS piece, or
 * the word that there is none. `choices` - `{ id, count }` the pack's loose gems; `onPick(id)` sets one.
 * @param {any} item @param {{ id: string, count: number }[]} choices @param {(id: string) => void} onPick
 */
export function socketChooser(item, choices, onPick) {
  ensureStyle(globalThis.document);
  if (!choices.length) return el('p', 'sock-none', 'No gem in your pack to set - any grade of Ruby, Emerald, Sapphire, Diamond, Jade, Turquoise, Malachite or Amber.');
  const ul = el('ul', 'sock-choose');
  for (const { id, count } of choices) {
    const li = el('li');
    const b = el('button', 'sock-pick');
    b.setAttribute('type', 'button');
    b.dataset.gem = id;
    b.dataset.gemGrade = /** @type {string} */ (gemGrade(id));
    const line = gemLine(item, id);
    b.append(el('span', 'sock-gem', `${GEM_NAMES[id]}${count > 1 ? ` (${count})` : ''}`), el('span', null, line ? affixLabel(/** @type {any} */ (line)) : ''));
    b.setAttribute('aria-label', `Set the ${GEM_NAMES[id]}: ${line ? affixLabel(/** @type {any} */ (line)) : ''}`);
    b.onclick = (e) => { e?.stopPropagation?.(); onPick(id); };
    li.append(b);
    ul.append(li);
  }
  return ul;
}

/** THE TILE'S MARKS: a socketed piece's pips (one a socket, filled where a gem is set) in the frame's top edge, and a
 *  graded gem's own grade (its ring - the sheet's). Every frame is a fresh node per render, so nothing is taken off.
 *  Answers the node. */
export function markSocketFrame(node, item) {
  if (!node || !lootRarityOn()) return node;
  const gem = gemKindOf(item);
  if (gem) { node.dataset.gemGrade = /** @type {string} */ (gemGrade(gem)); ensureStyle(globalThis.document); return node; }
  const list = socketsOf(item);
  if (!list.length) return node;
  ensureStyle(globalThis.document);
  node.dataset.sockets = String(list.length);
  const pips = el('span', 'sock-pips');
  pips.setAttribute('aria-hidden', 'true');
  for (const v of list) {
    const i = el('i', v === SOCKET_EMPTY ? null : 'set');
    if (v !== SOCKET_EMPTY) i.dataset.gemGrade = /** @type {string} */ (gemGrade(v));
    pips.append(i);
  }
  node.append(pips);
  return node;
}
