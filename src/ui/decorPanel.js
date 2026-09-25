// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1d (2026-09-25) — THE DECORATOR'S THREE SURFACES.
//
// Mac, asked how the decorator opens: "A UI element that can be clicked
// to open the decorate panel. Allows free cam mode for placement and an
// intuitive scrolling menu with filters". So three surfaces, one sheet:
//
//  - THE BUTTON. "Decorate", at the screen's right edge, standing only
//    where the player may decorate (their online home, or their own
//    house or ship - the host's word) and no window is up. It is a
//    pointer surface like the duel strip's buttons: a press on it is
//    its own, never a swing.
//  - THE PANEL. A window over the room, pausing it as every window does
//    (the host puts it in the room's own overlay slot, the enhanced
//    merchant panel's pattern). A scrolling list of every piece
//    Daggerfall furnishes, filtered by kind, by words, by size, by
//    whether it holds things or gives light, sorted most common first,
//    cheapest first or by name; a preview of the piece pointed at (a
//    model turning - the host draws it on the game's canvas and copies
//    it into the preview's own, the card over the game being opaque; a
//    flat shows its own picture); what it costs, and why it cannot be
//    placed when it cannot - too little gold, a full room, or a size
//    still being read.
//  - THE BAR. While a piece is being placed, a strip at the foot of the
//    screen: what is being placed, what it will cost, and the keys - and
//    the same things as buttons, for a hand with no keys.
//
// The panel has three tabs (DECOR1e, DECOR2a): the catalogue, "In this
// room" - the pieces standing, each moved, lit, made to hold things or
// removed (or, the player's own, taken down) - and "Your things", what
// in the pack can stand, free. DECOR2b: "Your things" lists the
// furniture the furnisher delivered too, and one that takes its look
// from Daggerfall's own pieces opens the catalogue on its kinds to
// choose it (the LOOK view), free.
//
// The surfaces decide nothing: what may be placed, what it costs and
// where it goes are the host's (scenes/decorTool.js). Handed the
// document and the window so the pins drive them headless.
//
// Not a DFU member: Daggerfall Unity has no decorator. Ledger A.
// ═══════════════════════════════════════════════════════════════════

import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';
import { isTextEntryTarget } from './input.js';
import { registerOverlay } from './enhancedOverlays.js';   // PX28b: Tab puts it away, as it puts away every enhanced window
import { DECOR_KINDS, DECOR_SIZES, decorSize, filterDecor } from '../systems/decorCatalogue.js';
import { decorRefund, DECOR_FURNITURE_GROUP } from '../net/decorLaw.js';

export const DECOR_STYLE_ID = 'dagger-decor-style';
export const DECOR_CSS = `
${PIXELIFY_FIVE_FACE}
.dfdecor-open { position: fixed; right: calc(12px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%);
  z-index: 6; display: none; pointer-events: auto; min-height: 32px; padding: 6px 12px; border-radius: 3px;
  border: 1px solid var(--iron, #2b323b); background: rgba(14, 16, 19, .9); color: var(--bone, #e9e4d9);
  ${PIXEL_FONT_CSS} font-size: 14px; cursor: pointer; }
.dfdecor-open[data-up="1"] { display: block; }
.dfdecor-open:hover { border-color: #b8943f; color: #f2c46b; }
.dfdecor-open.touch { min-height: 44px; padding: 10px 14px; }
.dfdecor { position: fixed; inset: 0; z-index: 13; display: none; align-items: center; justify-content: center;
  pointer-events: none; ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfdecor[data-state="open"] { display: flex; }
.dfdecor-card { pointer-events: auto; width: min(920px, calc(100vw - 24px)); height: min(620px, calc(100vh - 24px));
  display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 8px; box-sizing: border-box; padding: 12px 14px;
  background: rgba(14, 16, 19, .95); border: 1px solid var(--iron, #2b323b); border-radius: 6px; }
.dfdecor-card[data-mode="room"] { grid-template-rows: auto auto minmax(0, 1fr) auto; }
.dfdecor-card[data-mode="room"] .dfdecor-filters, .dfdecor-card[data-mode="room"] .dfdecor-place { display: none; }
.dfdecor-card[data-mode="catalogue"] .dfdecor-room-actions { display: none; }
.dfdecor-card[data-mode="own"] { grid-template-rows: auto auto minmax(0, 1fr) auto; }
.dfdecor-card[data-mode="own"] .dfdecor-filters, .dfdecor-card[data-mode="own"] .dfdecor-room-actions { display: none; }
.dfdecor-card[data-mode="look"] .dfdecor-room-actions, .dfdecor-card[data-mode="look"] .dfdecor-kinds,
.dfdecor-card[data-mode="look"] .dfdecor-has { display: none; }
.dfdecor-room-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.dfdecor-head { display: flex; align-items: baseline; gap: 10px; border-bottom: 1px solid var(--iron, #2b323b); padding-bottom: 6px; }
.dfdecor-title { font-size: 18px; }
.dfdecor-where { font-size: 13px; color: var(--dim, #8b8578); flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dfdecor-filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dfdecor-search { flex: 1 1 180px; min-width: 0; min-height: 28px; padding: 3px 8px; box-sizing: border-box; border-radius: 3px;
  border: 1px solid var(--iron, #2b323b); background: #0b0d10; color: var(--bone, #e9e4d9); font: inherit; font-size: 14px; }
.dfdecor-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.dfdecor-chip { min-height: 26px; padding: 2px 8px; border-radius: 3px; border: 1px solid var(--iron, #2b323b);
  background: transparent; color: var(--dim, #8b8578); font: inherit; font-size: 12px; cursor: pointer; }
.dfdecor-chip[aria-pressed="true"] { color: #f2c46b; border-color: #b8943f; background: rgba(242, 196, 107, .08); }
.dfdecor-body { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 12px; min-height: 0; }
.dfdecor-list { overflow-y: auto; min-height: 0; border: 1px solid var(--iron, #2b323b); border-radius: 3px; }
.dfdecor-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 8px; align-items: center;
  padding: 4px 8px; cursor: pointer; border-bottom: 1px solid rgba(43, 50, 59, .5); }
.dfdecor-row:hover { background: rgba(242, 196, 107, .06); }
.dfdecor-row[aria-selected="true"] { background: rgba(242, 196, 107, .14); }
.dfdecor-row.dim .dfdecor-row-price { color: #b8483f; }
.dfdecor-thumb { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; overflow: hidden;
  font-size: 11px; color: var(--dim, #8b8578); border: 1px solid rgba(43, 50, 59, .7); border-radius: 2px; }
.dfdecor-thumb img { max-width: 32px; max-height: 32px; image-rendering: pixelated; }
.dfdecor-row-name { font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
.dfdecor-row-sub { font-size: 11px; color: var(--dim, #8b8578); line-height: 1.3; }
.dfdecor-row-price { font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dfdecor-empty { padding: 16px; font-size: 13px; color: var(--dim, #8b8578); text-align: center; }
.dfdecor-side { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.dfdecor-preview { flex: 1 1 auto; min-height: 140px; border: 1px solid var(--iron, #2b323b); border-radius: 3px;
  background: transparent; display: flex; align-items: center; justify-content: center; }
.dfdecor-preview img { max-width: 80%; max-height: 80%; image-rendering: pixelated; }
.dfdecor-preview canvas { display: none; width: 100%; height: 100%; }
.dfdecor-preview[data-model="1"] canvas { display: block; }
.dfdecor-preview[data-model="1"] img { display: none; }
.dfdecor-pick-name { font-size: 16px; overflow-wrap: anywhere; }
.dfdecor-pick-line, .dfdecor-pick-why { font-size: 12px; color: var(--dim, #8b8578); line-height: 1.4; }
.dfdecor-pick-why { color: #d9a441; }
.dfdecor-pick-price { font-size: 15px; font-variant-numeric: tabular-nums; }
.dfdecor-btn { min-height: 32px; padding: 4px 14px; border-radius: 3px; border: 1px solid #b8943f; background: #2c2412;
  color: var(--bone, #e9e4d9); font: inherit; font-size: 14px; cursor: pointer; }
.dfdecor-btn:hover { background: #b8943f; color: #0e1013; }
.dfdecor-btn[disabled] { opacity: .45; cursor: default; background: #2c2412; color: var(--bone, #e9e4d9); }
.dfdecor-close { margin-left: auto; border-color: var(--iron, #2b323b); background: transparent; }
.dfdecor-foot { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--dim, #8b8578); }
.dfdecor-bar { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 8; display: none; flex-direction: column; gap: 6px; padding: 8px 12px; max-width: calc(100vw - 24px);
  box-sizing: border-box; background: rgba(14, 16, 19, .92); border: 1px solid #b8943f; border-radius: 6px;
  pointer-events: none; ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfdecor-bar[data-up="1"] { display: flex; }
.dfdecor-bar-what { font-size: 14px; }
.dfdecor-bar-keys { font-size: 12px; color: var(--dim, #8b8578); line-height: 1.4; }
.dfdecor-bar-why { font-size: 12px; color: #d9a441; }
.dfdecor-bar-why:empty { display: none; }
.dfdecor-bar-btns { display: flex; flex-wrap: wrap; gap: 4px; }
.dfdecor-bar .dfdecor-chip, .dfdecor-bar .dfdecor-btn { pointer-events: auto; }
.dfdecor-bar.touch .dfdecor-chip, .dfdecor-bar.touch .dfdecor-btn { min-height: 44px; min-width: 44px; touch-action: none; }
.dfdecor-bar.touch { bottom: auto; top: calc(8px + env(safe-area-inset-top, 0px)); max-width: calc(100vw - 272px); }
@media (max-width: 640px) {
  .dfdecor-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .dfdecor-preview { min-height: 90px; max-height: 120px; }
}
`;

/** The sorts the panel offers (systems/decorCatalogue.js filterDecor's). */
export const DECOR_SORTS = Object.freeze({ common: 'Most common', price: 'Cheapest', name: 'By name' });

/** A price as the surfaces say it; a piece whose size is still being read has none yet. */
export const decorPriceText = (price) => (price == null ? '...' : `${price} gold`);

/**
 * WHY A PIECE CANNOT BE PLACED, or null when it can: its size is still being read (or could not be), the room is
 * full, or the gold is short.
 * @param {{ price: number|null, ready: boolean, gold: number, count: number, cap: number }} v
 */
export function decorWhyNot({ price, ready, gold, count, cap }) {
  if (price == null) return ready ? 'Its size cannot be read, so it has no price.' : 'Its size is still being read.';
  if (count >= cap) return `This room already holds ${cap} pieces.`;
  if (price > gold) return `You need ${price - gold} more gold.`;
  return null;
}

/** WHY A PLACED PIECE CANNOT BE REMOVED, or stop holding things: what it holds would go with it. */
export const DECOR_HOLDS_LINE = 'It holds things - empty it first.';

/** What removing a piece gives back, as said (the law's half, net/decorLaw.js decorRefund). */
export const decorRefundText = (paid) => `${decorRefund(paid)} gold`;

/** DECOR2b: where one's own piece goes when it is taken down - the pack, or (furniture, never carried) "Your things". */
export const decorBackTo = (piece) => (piece?.item?.g === DECOR_FURNITURE_GROUP ? 'Your things' : 'your pack');
/** What one placed piece's row says under its name. DECOR2a: one's own item says so - it cost nothing and goes back
 *  to the pack (DECOR2b: or, furniture, to "Your things"). */
export function decorPlacedSub({ piece, holds }) {
  const first = piece.item ? `yours - back to ${decorBackTo(piece)} when taken down` : `placed for ${piece.paid} gold`;
  return [first, piece.storage ? (holds ? 'holds things (not empty)' : 'holds things') : null, piece.light ? 'gives light' : null]
    .filter(Boolean).join(' - ');
}
/** DECOR2a: what an item in the pack says under its name in the "Your things" list. */
export const DECOR_OWN_LINE = 'yours - free to set down, and back to your pack when taken down';
/** DECOR2b: what a piece of delivered furniture says there - never carried; set down free as the piece of its kinds the
 *  owner chooses (or, a pillow, as itself), and back here when taken down. */
export function decorFurnishLine(e) {
  const as = e?.looks ? ` as any of the ${e.looks.map((k) => DECOR_KINDS[k].toLowerCase()).join(' or ')} you choose` : '';
  return `delivered - free to set down${as}, and back here when taken down`;
}
/** DECOR2b: the look view's words - its button in "Your things", and its line while no look is chosen. */
export const DECOR_LOOK_BUTTON = 'Choose its look';
export const DECOR_LOOK_LINE = 'Choose how it looks - any of these, free.';

/** What one catalogue row says under its name. */
export function decorRowSub(entry, radius) {
  const size = decorSize(radius);
  return [DECOR_KINDS[entry.kind], size ? DECOR_SIZES[size] : null, entry.storage ? 'holds things' : null, entry.light ? 'gives light' : null]
    .filter(Boolean).join(' - ');
}

function injectStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(DECOR_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = DECOR_STYLE_ID;
  s.textContent = DECOR_CSS;
  (doc.head ?? doc.body)?.append(s);
}
const maker = (doc) => (tag, cls, text) => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** A press on a surface is the surface's - never a swing or a look. */
const swallowPresses = (node) => {
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(t, swallow);
};

/**
 * THE BUTTON. `onPress()` opens the panel; `render(up)` stands it or takes it away (the host's frame).
 * @param {{ onPress: () => void, touch?: boolean, doc?: any }} opts
 */
export function createDecorButton({ onPress, touch = false, doc = document }) {
  injectStyle(doc);
  const el = maker(doc);
  const btn = el('button', `dfdecor-open${touch ? ' touch' : ''}`, 'Decorate');
  btn.type = 'button';
  btn.dataset.up = '0';
  swallowPresses(btn);
  btn.addEventListener('click', () => { if (btn.dataset.up === '1') onPress(); });
  doc.body?.append(btn);
  let alive = true;
  return {
    root: btn,
    render(up) { if (!alive) return; const v = up ? '1' : '0'; if (btn.dataset.up !== v) btn.dataset.up = v; },
    isUp: () => btn.dataset.up === '1',
    destroy() { if (!alive) return; alive = false; btn.remove?.(); },
  };
}

/**
 * THE PANEL. `open(view)` shows it; the host's frame calls `update(view)` while it is open. A view is:
 *   where     - whose room it is, as a line ("Your home", "Your house", "Your ship")
 *   entries   - the catalogue (systems/decorScan.js), or null while the blocks are read
 *   progress  - 0..1, while the scan runs; ready - whether every size has been read
 *   radiusOf(entry), priceOf(entry) - the scan's measure and the law's price (null: not yet, or never)
 *   gold      - what the player can pay with (the purse and the bank); count, cap - the room's pieces and its limit
 *   placed    - DECOR1e: the room's placed pieces, each `{ piece, name, entry, holds, own }` (its catalogue entry when
 *               read, whether it holds anything, and - DECOR2a - whether it is the player's own item)
 *   own       - DECOR2a: what in the pack can stand here, each a catalogue-shaped entry of kind 'own' (free); DECOR2b:
 *               and the delivered furniture, `looks` the catalogue kinds one takes its look from (null: a picture of
 *               its own)
 * `onPlace(entry)` - the Place button; `onClose()` - the panel went (Close, Escape, or a placement began);
 * DECOR2b: `onPlaceLook(furniture, look)` - the look view's Place: one's furniture, as the catalogue piece chosen;
 * `onPoint(entry|null)` - the piece the preview shows changed; `thumbOf(entry)` - a Promise of a flat's picture (a URL);
 * DECOR1e: `onMove(piece)`, `onRemove(piece)`, `onToggle(piece, 'light'|'storage')` - a placed piece's four changes.
 * @param {{ onPlace: (entry: any) => void, onClose?: () => void, onPoint?: (entry: any) => void,
 *   thumbOf?: (entry: any) => Promise<string|null>|null, onMove?: (piece: any) => void, onRemove?: (piece: any) => void,
 *   onToggle?: (piece: any, what: string) => void, onPlaceLook?: (furniture: any, look: any) => void, doc?: any, win?: any }} opts
 */
export function createDecorPanel({
  onPlace, onClose = () => {}, onPoint = () => {}, thumbOf = () => null, onMove = () => {}, onRemove = () => {}, onToggle = () => {},
  onPlaceLook = () => {}, doc = document, win = globalThis,
}) {
  injectStyle(doc);
  const el = maker(doc);
  const root = el('div', 'dfdecor');
  root.dataset.state = 'closed';
  const card = el('div', 'dfdecor-card');
  card.dataset.mode = 'catalogue';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Decorate');
  root.append(card);
  swallowPresses(card);

  const head = el('div', 'dfdecor-head');
  const where = el('div', 'dfdecor-where');
  const close = el('button', 'dfdecor-btn dfdecor-close', 'Close');
  close.type = 'button';
  head.append(el('div', 'dfdecor-title', 'Decorate'), where, close);

  // DECOR1e: the two views - the catalogue to place from, and the pieces already in the room to change
  const tabs = el('div', 'dfdecor-chips dfdecor-tabs');
  const filters = el('div', 'dfdecor-filters');
  const search = el('input', 'dfdecor-search');
  search.type = 'search';
  search.setAttribute('placeholder', 'Search');
  search.setAttribute('aria-label', 'Search the catalogue');
  const kindChips = el('div', 'dfdecor-chips dfdecor-kinds');
  const sizeChips = el('div', 'dfdecor-chips');
  const hasChips = el('div', 'dfdecor-chips dfdecor-has');
  const sortChips = el('div', 'dfdecor-chips');
  filters.append(search, kindChips, sizeChips, hasChips, sortChips);

  const body = el('div', 'dfdecor-body');
  const list = el('div', 'dfdecor-list');
  list.setAttribute('role', 'listbox');
  const side = el('div', 'dfdecor-side');
  const preview = el('div', 'dfdecor-preview');
  const previewImg = el('img', '');
  previewImg.setAttribute('alt', '');
  const previewGl = el('canvas', '');
  preview.append(previewImg, previewGl);
  const pickName = el('div', 'dfdecor-pick-name');
  const pickLine = el('div', 'dfdecor-pick-line');
  const pickPrice = el('div', 'dfdecor-pick-price');
  const place = el('button', 'dfdecor-btn dfdecor-place', 'Place');
  place.type = 'button';
  const roomActions = el('div', 'dfdecor-room-actions');
  const act = (label, fn) => { const b = el('button', 'dfdecor-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const moveBtn = act('Move', () => { const it = placedSelected(); if (it && !moveBtn.disabled) { hide(); onMove(it.piece); } });
  const lightBtn = act('Light', () => { const it = placedSelected(); if (it) onToggle(it.piece, 'light'); });
  const storeBtn = act('Holds things', () => { const it = placedSelected(); if (it && !storeBtn.disabled) onToggle(it.piece, 'storage'); });
  const removeBtn = act('Remove', () => { const it = placedSelected(); if (it && !removeBtn.disabled) onRemove(it.piece); });
  roomActions.append(moveBtn, lightBtn, storeBtn, removeBtn);
  const pickWhy = el('div', 'dfdecor-pick-why');
  side.append(preview, pickName, pickLine, pickPrice, place, roomActions, pickWhy);
  body.append(list, side);

  const foot = el('div', 'dfdecor-foot');
  const footCount = el('span', '');
  const footGold = el('span', '');
  const footStatus = el('span', '');
  foot.append(footCount, footGold, footStatus);

  card.append(head, tabs, filters, body, foot);
  doc.body?.append(root);

  // ── state ────────────────────────────────────────────────────────
  let alive = true;
  let open = false;
  let unregister = () => {};
  /** @type {any} */
  let view = null;
  const f = { kinds: new Set(), text: '', size: null, storage: null, light: null, sort: 'common' };
  let selectedKey = null;
  let hoverKey = null;
  let mode = 'catalogue';     // DECOR1e: or 'room'; DECOR2a: or 'own'; DECOR2b: or 'look'
  let placedId = null;        // the placed piece chosen in the room's view
  let ownKey = null;          // DECOR2a: the item chosen in the pack's list
  let lookFor = null;         // DECOR2b: the furniture a look is being chosen for (its key in "Your things")
  let lookKey = null;         // DECOR2b: the look chosen (a catalogue key)
  let listSig = '';           // what the list was last drawn from
  let pointedKey;             // the preview's piece, as last told to the host
  /** @type {Map<string, string|null>} */
  const thumbs = new Map();   // key -> a flat's picture (null: none to be had)
  // A flat's picture is asked for when its row comes into view, not when the list is drawn: hundreds of pictures made
  // at once, the moment an archive lands, is a hitch the panel must not cost. Without an observer (a headless pin), at
  // once.
  /** @type {Map<string, any[]>} */
  const waiting = new Map();  // key -> the images waiting on its picture
  /** Ask for a flat's picture once; every image waiting on it gets it, and the preview if it shows that piece. */
  function askThumb(e, img = null) {
    const known = thumbs.get(e.key);
    if (known) { img?.setAttribute('src', known); return; }
    if (img) waiting.set(e.key, [...(waiting.get(e.key) ?? []), img]);
    if (thumbs.has(e.key)) return;   // in flight, or none to be had
    thumbs.set(e.key, null);
    Promise.resolve(thumbOf(e)).then((url) => {
      thumbs.set(e.key, url ?? null);
      const imgs = waiting.get(e.key) ?? [];
      waiting.delete(e.key);
      if (!url || !alive) return;
      for (const i of imgs) i.setAttribute('src', url);
      if ((hoverKey ?? selectedKey) === e.key) paintSide();
    }, () => {});
  }
  const Watch = win?.IntersectionObserver;
  const watcher = typeof Watch === 'function'
    ? new Watch((items) => {
      for (const it of items) {
        if (!it.isIntersecting) continue;
        watcher.unobserve(it.target);
        it.target.decorThumb?.();
      }
    }, { root: list })
    : null;

  const placedSelected = () => (view?.placed ?? []).find((it) => it.piece.id === placedId) ?? null;
  /** What the preview shows for a placed piece: its catalogue entry, or the piece's own shape until the catalogue is read. */
  const placedShape = (it) => it.entry ?? { key: `placed:${it.piece.id}`, model: it.piece.model, flat: it.piece.flat, kind: 'decor', name: it.name };
  const ownSelected = () => (view?.own ?? []).find((e) => e.key === ownKey) ?? null;
  /** DECOR2b: the furniture the look view is for (still among "Your things"), and the look chosen - one of its kinds'. */
  const lookOf = () => (view?.own ?? []).find((e) => e.key === lookFor && e.looks) ?? null;
  const lookSelected = () => {
    const furn = lookOf();
    return furn ? (view?.entries ?? []).find((e) => e.key === lookKey && furn.looks.includes(e.kind)) ?? null : null;
  };
  const shown = () => {
    if (mode === 'room') { const it = placedSelected(); return it ? placedShape(it) : null; }
    if (mode === 'own') return (view?.own ?? []).find((e) => e.key === (hoverKey ?? ownKey)) ?? null;
    return (view?.entries ?? []).find((e) => e.key === (hoverKey ?? (mode === 'look' ? lookKey : selectedKey))) ?? null;
  };
  const selected = () => (mode === 'own' ? ownSelected() : mode === 'look' ? lookSelected()
    : (view?.entries ?? []).find((e) => e.key === selectedKey) ?? null);
  const priceOf = (e) => (e && view?.priceOf ? view.priceOf(e) : null);
  const radiusOf = (e) => (e && view?.radiusOf ? view.radiusOf(e) : null);

  function chip(label, pressed, onClick) {
    const c = el('button', 'dfdecor-chip', label);
    c.type = 'button';
    c.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    c.addEventListener('click', onClick);
    return c;
  }
  function drawTabs() {
    const n = view?.placed?.length ?? 0;
    const m = view?.own?.length ?? 0;
    tabs.replaceChildren(chip('Catalogue', mode === 'catalogue', () => setMode('catalogue')), chip(`In this room (${n})`, mode === 'room', () => setMode('room')),
      chip(`Your things (${m})`, mode === 'own' || mode === 'look', () => setMode('own')));   // DECOR2b: a look is chosen within them
  }
  function setMode(m) {
    if (mode === m) return;
    mode = m;
    card.dataset.mode = m;
    hoverKey = null;
    redraw();
  }
  /** DECOR2b: THE LOOK VIEW - the catalogue on the kinds one piece of furniture takes its look from, `look` chosen. */
  function chooseLook(key, look = null) {
    lookFor = key;
    lookKey = look;
    if (mode === 'look') redraw(); else setMode('look');
  }
  function placedRow(it) {
    const r = el('div', 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = it.piece.id;
    r.setAttribute('aria-selected', it.piece.id === placedId ? 'true' : 'false');
    const thumb = el('span', 'dfdecor-thumb');
    const shape = placedShape(it);
    if (shape.flat && it.entry) {
      const img = el('img', '');
      img.setAttribute('alt', '');
      thumb.append(img);
      const known = thumbs.get(shape.key);
      if (known) img.setAttribute('src', known); else askThumb(shape, img);
    } else {
      thumb.textContent = (DECOR_KINDS[shape.kind] ?? 'Decorations').slice(0, 2);
    }
    const main = el('span', '');
    main.append(el('div', 'dfdecor-row-name', it.name), el('div', 'dfdecor-row-sub', decorPlacedSub(it)));
    r.append(thumb, main, el('span', 'dfdecor-row-price', it.piece.item ? 'yours' : `${decorRefundText(it.piece.paid)} back`));
    r.addEventListener('click', () => { placedId = it.piece.id; redraw(); });
    return r;
  }
  function drawChips() {
    const present = new Set((view?.entries ?? []).map((e) => e.kind));
    kindChips.replaceChildren(chip('All', f.kinds.size === 0, () => { f.kinds.clear(); redraw(); }),
      ...Object.keys(DECOR_KINDS).filter((k) => present.has(k)).map((k) => chip(DECOR_KINDS[k], f.kinds.has(k), () => {
        if (f.kinds.has(k)) f.kinds.delete(k); else f.kinds.add(k);
        redraw();
      })));
    sizeChips.replaceChildren(chip('Any size', f.size === null, () => { f.size = null; redraw(); }),
      ...Object.keys(DECOR_SIZES).map((k) => chip(DECOR_SIZES[k], f.size === k, () => { f.size = f.size === k ? null : k; redraw(); })));
    hasChips.replaceChildren(
      chip('Holds things', f.storage === true, () => { f.storage = f.storage ? null : true; redraw(); }),
      chip('Gives light', f.light === true, () => { f.light = f.light ? null : true; redraw(); }));
    sortChips.replaceChildren(...Object.keys(DECOR_SORTS).map((k) => chip(DECOR_SORTS[k], f.sort === k, () => { f.sort = k; redraw(); })));
  }

  /** One catalogue row - or, `look` (DECOR2b), one look for one's furniture: free. */
  function row(e, look = false) {
    const r = el('div', 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = e.key;
    r.setAttribute('aria-selected', e.key === (look ? lookKey : selectedKey) ? 'true' : 'false');
    const price = look ? 0 : priceOf(e);
    if (price != null && view && price > view.gold) r.className = 'dfdecor-row dim';
    const thumb = el('span', 'dfdecor-thumb');
    if (e.flat) {
      const img = el('img', '');
      img.setAttribute('alt', '');
      thumb.append(img);
      const known = thumbs.get(e.key);
      if (known) img.setAttribute('src', known);
      else if (watcher) { r.decorThumb = () => askThumb(e, img); watcher.observe(r); } else askThumb(e, img);
    } else {
      thumb.textContent = DECOR_KINDS[e.kind].slice(0, 2);
    }
    const main = el('span', '');
    main.append(el('div', 'dfdecor-row-name', e.name), el('div', 'dfdecor-row-sub', decorRowSub(e, radiusOf(e))));
    r.append(thumb, main, el('span', 'dfdecor-row-price', look ? 'free' : decorPriceText(price)));
    r.addEventListener('click', () => { if (look) lookKey = e.key; else selectedKey = e.key; redraw(); });
    r.addEventListener('mouseenter', () => { hoverKey = e.key; paintSide(); });
    r.addEventListener('mouseleave', () => { if (hoverKey === e.key) { hoverKey = null; paintSide(); } });
    return r;
  }

  /** DECOR2a: one item in the pack that can stand here - its pack picture, its name, free. DECOR2b: or a piece of
   *  delivered furniture - with no picture of its own, its kind's letters. */
  function ownRow(e) {
    const r = el('div', 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = e.key;
    r.setAttribute('aria-selected', e.key === ownKey ? 'true' : 'false');
    const thumb = el('span', 'dfdecor-thumb');
    if (e.icon || e.flat) {
      const img = el('img', '');
      img.setAttribute('alt', '');
      thumb.append(img);
      const known = thumbs.get(e.key);
      if (known) img.setAttribute('src', known); else askThumb(e, img);
    } else {
      thumb.textContent = (DECOR_KINDS[e.looks?.[0]] ?? DECOR_KINDS.furniture).slice(0, 2);
    }
    const main = el('span', '');
    const count = (e.count ?? 1) > 1 ? ` (${e.count})` : '';
    main.append(el('div', 'dfdecor-row-name', `${e.name}${count}`), el('div', 'dfdecor-row-sub', e.furnishing ? decorFurnishLine(e) : DECOR_OWN_LINE));
    r.append(thumb, main, el('span', 'dfdecor-row-price', 'free'));
    r.addEventListener('click', () => { ownKey = e.key; redraw(); });
    r.addEventListener('mouseenter', () => { hoverKey = e.key; paintSide(); });
    r.addEventListener('mouseleave', () => { if (hoverKey === e.key) { hoverKey = null; paintSide(); } });
    return r;
  }

  /** The list, the chips and the side - drawn again when anything they read changed. */
  function redraw() {
    if (!view) return;
    drawTabs();
    drawChips();
    const entries = view.entries;
    watcher?.disconnect();   // the rows it watched are gone
    waiting.clear();
    if (mode === 'room') {
      const placed = view.placed ?? [];
      if (placedId && !placed.some((it) => it.piece.id === placedId)) placedId = null;   // removed, or gone from the room
      list.replaceChildren(...(placed.length ? placed.map(placedRow) : [el('div', 'dfdecor-empty', 'Nothing placed in this room yet.')]));
    } else if (mode === 'own') {
      const own = view.own ?? [];
      if (ownKey && !own.some((e) => e.key === ownKey)) ownKey = null;   // set down, or gone from the pack
      list.replaceChildren(...(own.length ? own.map(ownRow) : [el('div', 'dfdecor-empty', 'Nothing in your pack can stand in a room.')]));
    } else if (mode === 'look' && !lookOf()) {   // DECOR2b: the furniture set down, or gone - back to the list of it
      mode = 'own';
      card.dataset.mode = 'own';
      redraw();
      return;
    } else if (!entries) {
      list.replaceChildren(el('div', 'dfdecor-empty', 'Reading the catalogue...'));
    } else {
      const look = mode === 'look';   // DECOR2b: the furniture's kinds alone, and neither holding nor light asked
      const shownEntries = look
        ? filterDecor(entries, { kinds: lookOf().looks, text: f.text, size: f.size, sort: f.sort, radiusOf })
        : filterDecor(entries, { kinds: f.kinds, text: f.text, size: f.size, storage: f.storage, light: f.light, sort: f.sort, radiusOf });
      list.replaceChildren(...(shownEntries.length ? shownEntries.map((e) => row(e, look)) : [el('div', 'dfdecor-empty', 'Nothing matches.')]));
    }
    listSig = signature();
    paintSide();
  }
  /** Everything the list reads that the host can change under it (the room's pieces: each one's id, cost, light,
   *  storage and whether it holds anything). */
  const signature = () => [view?.entries ? view.entries.length : -1, view?.ready ? 1 : 0, view?.gold ?? 0, view?.count ?? 0,
    (view?.placed ?? []).map((it) => `${it.piece.id}:${it.piece.paid}:${it.piece.light ? 1 : 0}:${it.piece.storage ? 1 : 0}:${it.holds ? 1 : 0}`).join(','),
    (view?.own ?? []).map((e) => `${e.key}:${e.name}:${e.count ?? 1}`).join(',')].join('|');   // DECOR2a: the pack's list

  function paintSide() {
    const e = shown();
    const sel = selected();
    if (!e) {
      pickName.textContent = mode === 'own' ? ((view?.own?.length ?? 0) ? 'Choose one of your things' : '') : view?.entries ? 'Choose a piece' : '';
      pickLine.textContent = '';
      pickPrice.textContent = '';
      previewImg.removeAttribute?.('src');
    } else if (e.kind === 'own') {
      pickName.textContent = e.name;
      pickLine.textContent = e.furnishing ? decorFurnishLine(e) : DECOR_OWN_LINE;
      pickPrice.textContent = 'Free';
      if (!thumbs.has(e.key)) askThumb(e);
      const url = thumbs.get(e.key);
      if (url) previewImg.setAttribute('src', url); else previewImg.removeAttribute?.('src');
    } else {
      pickName.textContent = e.name;
      pickLine.textContent = decorRowSub(e, radiusOf(e));
      pickPrice.textContent = decorPriceText(priceOf(e));
      if (e.flat && !thumbs.has(e.key)) askThumb(e);   // chosen out of view: its picture all the same
      const url = e.flat ? thumbs.get(e.key) : null;
      if (url) previewImg.setAttribute('src', url); else previewImg.removeAttribute?.('src');
    }
    if (mode === 'look') {   // DECOR2b: what is set down is one's furniture, by its own name - the look under it, free
      pickName.textContent = lookOf()?.name ?? '';
      pickLine.textContent = e ? `as ${e.name} - ${decorRowSub(e, radiusOf(e))}` : DECOR_LOOK_LINE;
      pickPrice.textContent = 'Free';
    }
    const model = e && e.model != null ? '1' : '0';
    if (preview.dataset.model !== model) preview.dataset.model = model;
    if (mode === 'room') {
      paintRoomSide();
    } else {
      const free = sel?.kind === 'own' || mode === 'look';   // DECOR2a: one's own costs nothing (DECOR2b: nor its look)
      const why = sel ? decorWhyNot({ price: free ? 0 : priceOf(sel), ready: free || !!view?.ready, gold: view?.gold ?? 0, count: view?.count ?? 0, cap: view?.cap ?? 0 }) : null;
      pickWhy.textContent = why ?? '';
      place.disabled = !sel || why !== null;
      const label = mode === 'own' && sel?.looks ? DECOR_LOOK_BUTTON : 'Place';   // DECOR2b: furniture chooses its look first
      if (place.textContent !== label) place.textContent = label;
    }
    const key = e ? e.key : null;
    if (key !== pointedKey) { pointedKey = key; onPoint(e); }
  }

  /** DECOR1e: the chosen placed piece - its line, what it cost, and its four changes (a piece that holds anything is not
   *  removed, nor made to stop holding things, out from under its contents). */
  function paintRoomSide() {
    const it = placedSelected();
    if (!it) {
      pickName.textContent = (view?.placed?.length ?? 0) ? 'Choose a placed piece' : 'Nothing placed in this room yet.';
      pickLine.textContent = '';
      pickPrice.textContent = '';
    } else {
      pickName.textContent = it.name;
      pickLine.textContent = decorPlacedSub(it);
      pickPrice.textContent = it.piece.item ? `Take down: back to ${decorBackTo(it.piece)}` : `Remove: ${decorRefundText(it.piece.paid)} back`;
    }
    lightBtn.textContent = it?.piece.light ? 'Light: on' : 'Light: off';
    storeBtn.textContent = it?.piece.storage ? 'Holds things: yes' : 'Holds things: no';
    removeBtn.textContent = it?.piece.item ? 'Take down' : 'Remove';   // DECOR2a: one's own goes back to the pack
    for (const b of [moveBtn, lightBtn]) b.disabled = !it;
    storeBtn.disabled = !it || !!it.piece.item || (it.piece.storage && it.holds);
    removeBtn.disabled = !it || it.holds;
    pickWhy.textContent = it?.holds ? DECOR_HOLDS_LINE : '';
  }

  function paintFoot() {
    if (!view) return;
    const c = `${view.count} of ${view.cap} pieces placed`;
    if (footCount.textContent !== c) footCount.textContent = c;
    const g = `${view.gold} gold to spend (purse and bank)`;
    if (footGold.textContent !== g) footGold.textContent = g;
    const s = view.ready ? '' : `Reading the catalogue - ${Math.floor((view.progress ?? 0) * 100)}%`;
    if (footStatus.textContent !== s) footStatus.textContent = s;
    const w = view.where ?? '';
    if (where.textContent !== w) where.textContent = w;
  }

  function hide() {
    if (!open) return;
    open = false;
    root.dataset.state = 'closed';
    hoverKey = null;
    unregister();
    unregister = () => {};
    onClose();   // once an opening: a closed panel returns above
  }

  search.addEventListener('input', () => { f.text = String(search.value ?? ''); redraw(); });
  close.addEventListener('click', () => hide());
  place.addEventListener('click', () => {
    const sel = selected();
    if (!sel || place.disabled) return;
    if (mode === 'own' && sel.looks) { chooseLook(sel.key); return; }   // DECOR2b: its look first
    const furn = mode === 'look' ? lookOf() : null;
    hide();
    if (furn) onPlaceLook(furn, sel); else onPlace(sel);
  });
  // Escape closes, unless a field is being typed into (the field's own Escape clears it)
  const onKey = (e) => {
    if (!open || e.code !== 'Escape' || isTextEntryTarget(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation?.();
    hide();
  };
  win?.addEventListener?.('keydown', onKey, true);

  /** The room's overlay slot holds this while the panel is up: it pauses the room like every window, and draws nothing
   *  on the canvas (the panel is the document's). The keys the host routes to it are the ones no field took. */
  let slot = null;
  const makeSlot = () => ({
    isChoiceWindow: true,
    get done() { return !open; },
    input(code) { if (code === 'Escape') hide(); },
    click() {}, wheel() {}, hover() {}, tick() {}, draw() {},
    dispose() { hide(); },
  });

  return {
    root,
    /** Open over the room; answers the object the host's overlay slot holds while it is up. */
    open(v) {
      if (!alive) return null;
      view = v;
      open = true;
      root.dataset.state = 'open';
      pointedKey = undefined;
      unregister = registerOverlay(() => hide());
      slot = makeSlot();
      redraw();
      paintFoot();
      return slot;
    },
    /** THE HOST'S FRAME while it is open: the scan's progress, the gold, the count. */
    update(v) {
      if (!alive || !open) return;
      view = v;
      if (signature() !== listSig) redraw();
      paintFoot();
    },
    close: hide,
    isOpen: () => open,
    /** The piece the preview shows (hovered, else chosen), or null. */
    pointed: () => (open ? shown() : null),
    /** The preview's box on the page, for the host's model pass (the document's own rect), or null. */
    previewRect: () => (open && preview.getBoundingClientRect ? preview.getBoundingClientRect() : null),
    /** The canvas the host copies the turning model into. */
    previewCanvas: () => previewGl,
    /** Choose a piece by its key (the host's reopen after a placement keeps the choice). */
    select(key) { selectedKey = key; if (open) redraw(); },
    /** DECOR1e: which view - 'catalogue' or 'room' (DECOR2a: 'own'; DECOR2b: 'look') - and the placed piece chosen in the room's. */
    mode: () => mode,
    showRoom(id = null) { placedId = id ?? placedId; if (mode === 'room') redraw(); else setMode('room'); },
    /** DECOR2a: the pack's list, with `key` chosen (or the choice kept). */
    showOwn(key = null) { ownKey = key ?? ownKey; if (mode === 'own') redraw(); else setMode('own'); },
    /** DECOR2b: the look view for the furniture keyed `key` in "Your things", `look` chosen. */
    showLook(key, look = null) { ownKey = key; chooseLook(key, look); },
    selectedKey: () => selectedKey,
    destroy() {
      if (!alive) return;
      alive = false;
      open = false;
      watcher?.disconnect();
      unregister();
      win?.removeEventListener?.('keydown', onKey, true);
      root.remove?.();
    },
  };
}

/**
 * THE BAR, while a piece is being placed. `show(info)` / `hide()`; `info` is { name, price, why, snap } and, for a move
 * (DECOR1e), `priceText` - free, or what a resize costs or gives back. The buttons are
 * the keys' twins: `on` holds place, back, turnLeft, turnRight, raise, lower, smaller, bigger, grid - and, on a touch
 * screen (DECOR1e), `fly(dir)`: Fly up (1) or Fly down (-1) held, 0 let go. A touch screen's bar stands at the top,
 * clear of the stick and the layer's buttons along the bottom.
 * @param {{ on: Record<string, (dir?: number) => void>, touch?: boolean, doc?: any }} opts
 */
export function createDecorBar({ on, touch = false, doc = document }) {
  injectStyle(doc);
  const el = maker(doc);
  const root = el('div', `dfdecor-bar${touch ? ' touch' : ''}`);
  root.dataset.up = '0';
  const what = el('div', 'dfdecor-bar-what');
  const keys = el('div', 'dfdecor-bar-keys',
    touch ? 'Fly: the stick, and hold Fly up or Fly down - Look: drag - the piece stands where you look.'
      : 'Fly: walk keys, Jump up, Crouch down, Run faster - Look: mouse - Turn: wheel or Turn Left/Right (Shift: fine) - Raise/lower: Float Up/Down - Size: - and = - Grid: / - Place: click or Interact - Back: right click or Escape');
  const why = el('div', 'dfdecor-bar-why');
  const btns = el('div', 'dfdecor-bar-btns');
  const b = (label, key, cls = 'dfdecor-chip') => {
    const n = el('button', cls, label);
    n.type = 'button';
    n.addEventListener('click', () => on[key]?.());
    return n;
  };
  const grid = b('Grid', 'grid');
  // DECOR1e: THE FINGER'S UP AND DOWN - held, as Jump and Crouch are on a keyboard; let go when the finger lifts, is
  // taken, or the bar goes (a window over the flight)
  let flyDir = 0;
  const flyTo = (dir) => { if (dir !== flyDir) { flyDir = dir; on.fly?.(dir); } };
  const hold = (label, dir) => {
    const n = el('button', 'dfdecor-chip', label);
    n.type = 'button';
    n.addEventListener('pointerdown', (e) => { try { n.setPointerCapture?.(e.pointerId); } catch { /* a pointer gone already */ } flyTo(dir); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) n.addEventListener(t, () => { if (flyDir === dir) flyTo(0); });
    return n;
  };
  btns.append(b('Place', 'place', 'dfdecor-btn'), b('Turn left', 'turnLeft'), b('Turn right', 'turnRight'), b('Raise', 'raise'),
    b('Lower', 'lower'), b('Smaller', 'smaller'), b('Bigger', 'bigger'), grid);
  if (touch) btns.append(hold('Fly up', 1), hold('Fly down', -1));
  btns.append(b('Back', 'back'));
  root.append(what, keys, why, btns);
  swallowPresses(root);
  doc.body?.append(root);
  let alive = true;
  return {
    root,
    show({ name, price, priceText = null, why: whyText = null, snap = false }) {
      if (!alive) return;
      const w = `${name} - ${priceText ?? decorPriceText(price)}`;
      if (what.textContent !== w) what.textContent = w;
      const y = whyText ?? '';
      if (why.textContent !== y) why.textContent = y;
      grid.setAttribute('aria-pressed', snap ? 'true' : 'false');
      if (root.dataset.up !== '1') root.dataset.up = '1';
    },
    hide() { flyTo(0); if (alive && root.dataset.up !== '0') root.dataset.up = '0'; },
    isUp: () => root.dataset.up === '1',
    destroy() { if (!alive) return; flyTo(0); alive = false; root.remove?.(); },
  };
}
