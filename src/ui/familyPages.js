// @ts-check
// LEGACY3 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 11; Mac: "implement it into the pause menu as a new
// tab"): THE FAMILY TAB's own pages - Project Legacy's `FamilyLegacyWindow` and `FamilyLegacyInformationPanel`,
// rebuilt in the Enhanced Plus window as the Holdings tab's pages are (ui/holdingsPages.js): a rail of pages in the
// pause window (ui/enhancedMenu.js pauseFamily), each drawn here over a PROVIDER the world host sets
// (setFamilyProvider), so this file touches no runtime.
//
//  - THE FAMILY TREE: every generation a row, couples side by side, children hung beneath (systems/legacy/tree.js -
//    a pure layout, U5), the living, the dead, the one played, the elders and the heirs each drawn as such (U2); pan
//    by dragging, zoom with the wheel ABOUT THE POINTER (U1 - the mod zoomed about the corner and read the wheel under
//    every other window), or the three buttons. A person pressed is read whole in THE CARD beside the tree: their face,
//    age and span, the eight stats, the career's skills BY NAME (U3), parents and children, and the acts - play as
//    them (the mod's switch, S1-S4), or pass the mantle (an Enduring elder).
//  - THE HOUSE: the surname, the model and what it means, the seat, the generations, the living and the fallen.
//  - THE HALL OF ANCESTORS: every family this browser has founded, living and ended, each with its tree's numbers.
//
// Dressed by the stone-and-brass kit's roles (ui/enhancedFrame.js FRAME_ROLES): this sheet writes geometry and the
// words' colours alone.
import { layoutTree } from '../systems/legacy/tree.js';
import { MODELS, personOf, currentOf, isAlive, parentsOf, childrenOf, siblingsOf, fullNameOf } from '../systems/legacy/family.js';
import { ageOf, spanOf, isElder } from '../systems/legacy/age.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { STAT_KEYS_ORDER } from '../systems/statMods.js';
import { homeOf, familyHome, sameHouse } from '../systems/legacy/household.js';   // LEGACY-HOME: where each of the line lives
import { houseLine } from '../net/houseLaw.js';   // LEGACY7 part three: a player spouse's own house on their card

export const FAMILY_PAGE_SECTIONS = Object.freeze([
  Object.freeze(['tree', 'Family Tree']), Object.freeze(['house', 'The House']), Object.freeze(['hall', 'Hall of Ancestors']),
]);
export const FAMILY_STYLE_ID = 'family-pages-css';

/** A node's plate, in CSS pixels at zoom 1, and the slot and row it stands in. */
export const TREE_NODE_W = 78;
export const TREE_NODE_H = 96;
export const TREE_SLOT_W = 100;
export const TREE_ROW_H = 136;
export const TREE_ZOOM_MIN = 0.4;
export const TREE_ZOOM_MAX = 1.6;
/** One wheel notch's zoom step - the mod's 0.05 of a 0.25..1 range, as a ratio over the wider range. */
export const TREE_ZOOM_STEP = 1.12;

/**
 * @typedef {Object} FamilyProvider
 * @property {() => boolean} on   Project Legacy is on
 * @property {() => any} family   the family played (systems/legacy/family.js), or null
 * @property {() => number} lived   the played member's own minutes lived
 * @property {(pose:any) => Promise<{width:number, height:number, colors:Uint8Array}|null>} [faces]   a portrait
 * @property {(id:number) => string|null} switchRefusal   why playing `id` is refused, or null
 * @property {() => string|null} [mantleRefusal]   AUDIT LEGACY U4: why the played elder may not pass the mantle now, or null
 * @property {(id:number) => {ok:boolean, why?:string}} switchTo
 * @property {() => {ok:boolean, why?:string}} [passMantle]   an Enduring elder retires
 * @property {() => any[]} [hall]   every stored family
 * @property {(minutes:number) => string} [date]   a classic date in words
 * @property {() => boolean} [inWorld]   LEGACY-HOME: whether the line stands in the world (the "Family In World" dial,
 *   and the Living World running - AUDIT LEGACY II B5)
 * @property {() => boolean} [livingWorld]   whether the Living World runs (its towns are where the line stands)
 * @property {(house:any) => boolean} [markHome]   LEGACY-HOME: make one of the family's houses its home
 */
let _provider = /** @type {FamilyProvider|null} */ (null);
/** The host's provider, or null to take the pages down. */
export function setFamilyProvider(p) { _provider = p ?? null; }
export const familyProvider = () => _provider;

// the page's own state, kept across the window's re-renders and reset each visit
let _sel = null;      // the person pressed
let _zoom = 1;
let _pan = null;      // { x, y } - null: centre on the played one at the next draw
let _said = null;     // { ok, text } - the last act's word
let _armed = null;    // 'switch:<id>' | 'mantle' - a press that asks again before it acts
let _homeSaid = null; // the House page's word on a home marked (AUDIT LEGACY II U7)
/** A fresh visit: nothing pressed, the tree centred, no word left over. */
export function resetFamilyPages() { _sel = null; _zoom = 1; _pan = null; _said = null; _armed = null; _homeSaid = null; }
/** AUDIT LEGACY U8: another page or tab pressed - an armed act and its word never wait for the way back. */
export function disarmFamilyPages() { _said = null; _armed = null; }

export const FAMILY_CSS = `
.px-sys .fam-wrap { display: flex; gap: 12px; align-items: flex-start; min-height: 360px; }   /* AUDIT LEGACY U6: the tree no taller than its own height - the card scrolls, the tree's tools stay in view */
.px-sys .fam-view { position: relative; flex: 1 1 auto; min-width: 0; height: min(400px, 62vh); min-height: 260px; overflow: hidden; cursor: grab;
  border-width: 2px; border-style: solid; box-sizing: border-box; touch-action: none; user-select: none; }
.px-sys .fam-view.dragging { cursor: grabbing; }
.px-sys .fam-stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.px-sys .fam-lines { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.px-sys .fam-lines path { fill: none; stroke: #7a5424; stroke-width: 3; }
.px-sys .fam-lines path.wed { stroke: #c08a3e; stroke-dasharray: 2 4; }
.px-sys .fam-node { position: absolute; width: ${TREE_NODE_W}px; height: ${TREE_NODE_H}px; box-sizing: border-box; padding: 4px 3px 3px;
  display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; border-width: 2px; border-style: solid; }
.px-sys .fam-node.on { outline: 2px solid #f3cf86; outline-offset: 1px; }
/* AUDIT LEGACY II U5: the keyboard's place is seen - the kit's panel rule takes every outline, and a kin link wore none */
.px-sys .fam-node:focus-visible { outline: 2px dashed #f3cf86; outline-offset: 2px; }
.px-sys .fam-kin button:focus-visible { outline: 1px solid #f3cf86; outline-offset: 2px; }
.px-sys .fam-node.dead { filter: grayscale(1) brightness(0.62); }
.px-sys .fam-node.played .fam-nname { color: #f3cf86; }
.px-sys .fam-face { width: 48px; height: 52px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.px-sys .fam-face canvas { image-rendering: pixelated; max-width: 100%; max-height: 100%; }
.px-sys .fam-face .fam-glyph { font-size: 22px; color: #8b8578; }
.px-sys .fam-nname { font-size: 11px; line-height: 1.1; color: #e2d9c4; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-sys .fam-mark { position: absolute; top: 2px; right: 3px; font-size: 11px; color: #c08a3e; }
.px-sys .fam-mark.dead { color: #b8b0a0; }
.px-sys .fam-tools { position: absolute; right: 6px; top: 6px; display: flex; gap: 4px; z-index: 1; }
.px-sys .fam-tools .act { min-width: 30px; padding: 2px 6px; }
.px-sys .fam-card { flex: 0 0 268px; max-width: 268px; box-sizing: border-box; padding: 9px 11px 10px; border-width: 2px; border-style: solid;
  display: flex; flex-direction: column; gap: 6px; text-align: left; overflow-y: auto; max-height: min(400px, 62vh); }
.px-sys .fam-card .fam-top { display: grid; grid-template-columns: 60px 1fr; gap: 9px; align-items: center; }
.px-sys .fam-card .fam-face { width: 60px; height: 64px; border-width: 2px; border-style: solid; box-sizing: border-box; }
.px-sys .fam-card h3 { margin: 0; font-size: 16px; color: #f3cf86; overflow-wrap: anywhere; }
.px-sys .fam-sub { font-size: 12px; color: #b8b0a0; }
.px-sys .fam-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.px-sys .fam-chip { padding: 0 5px; border-width: 1px; border-style: solid; font-size: 10px; line-height: 1.5; letter-spacing: 0.1em; text-transform: uppercase; color: #8fc7a0; }
.px-sys .fam-chip.dead { color: #b8b0a0; }
.px-sys .fam-chip.elder { color: #e0b46a; }
.px-sys .fam-chip.blood { color: #e08a7a; }
.px-sys .fam-grid { display: grid; grid-template-columns: 1fr auto; gap: 1px 10px; font-size: 12px; }
.px-sys .fam-grid .k { color: #b8b0a0; } .px-sys .fam-grid .v { color: #e2d9c4; text-align: right; }
.px-sys .fam-h { margin: 4px 0 0; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #c08a3e; }
.px-sys .fam-kin { font-size: 12px; color: #e2d9c4; }
.px-sys .fam-kin button { all: unset; cursor: pointer; color: #f3cf86; text-decoration: underline dotted; display: inline-block; padding: 5px 0; }   /* AUDIT LEGACY II U13: a finger's target */
.px-sys .fam-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.px-sys .fam-said { color: #8fc7a0; font-size: 12px; } .px-sys .fam-why { color: #e08a7a; font-size: 12px; }
.px-sys .fam-hall { display: flex; flex-direction: column; gap: 8px; }
.px-sys .fam-hallrow { padding: 7px 10px 8px; border-width: 2px; border-style: solid; box-sizing: border-box; text-align: left; }
.px-sys .fam-hallrow .fam-makehome { margin-top: 6px; }
@media (max-width: 720px) { .px-sys .fam-wrap { flex-direction: column; align-items: stretch; } .px-sys .fam-card { max-width: none; flex-basis: auto; max-height: none; } }
`;
export function ensureFamilyStyle(doc = typeof document === 'undefined' ? null : document) {
  if (!doc?.getElementById || doc.getElementById(FAMILY_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = FAMILY_STYLE_ID;
  st.textContent = FAMILY_CSS;
  (doc.head ?? doc.body)?.append(st);
}

// ---- the words (pure) -------------------------------------------------------------------------------------------

const RACE_WORDS = Object.freeze({ Breton: 'Breton', Redguard: 'Redguard', Nord: 'Nord', DarkElf: 'Dark Elf', HighElf: 'High Elf', WoodElf: 'Wood Elf', Khajiit: 'Khajiit', Argonian: 'Argonian' });
export const raceWord = (race) => RACE_WORDS[race] ?? String(race ?? '');
export const modelWord = (m) => (m === MODELS.bloodline ? 'Bloodline' : 'Enduring');
export const modelLine = (m) => (m === MODELS.bloodline
  ? 'A Bloodline: every death is final. When one of the house falls, the mantle passes to another of the blood - or the line ends.'
  : 'An Enduring line: a death is not the end, but it costs years. When a life’s span is spent, the mantle passes on.');

/** The chips a person wears: played, dead (and at peace, or lying unclaimed), elder, heir, spouse. Pure. */
export function personChips(family, p, livedNow) {
  const out = [];
  if (!p) return out;
  if (p.died) out.push({ cls: 'dead', text: p.died.cause === 'years' ? 'Died of years' : p.died.cause === 'gone' ? 'Gone from the realm' : 'Fallen' });   // LEGACY7 part three: a player spouse's character deleted
  // AUDIT LEGACY H9: the death quest on the tree - laid to rest, or still lying where they fell
  const rest = p.died ? (family.remains ?? []).find((r) => r.of === p.id) : null;
  if (rest?.state === 'rested') out.push({ cls: '', text: 'At peace' });
  else if (rest) out.push({ cls: 'dead', text: rest.state === 'taken' ? 'Carried home' : 'Lies unclaimed' });
  else if (p.id === family.currentId) out.push({ cls: '', text: 'Played' });
  else if (p.retired != null) out.push({ cls: 'elder', text: 'Retired' });
  if (!p.died && family.model === MODELS.enduring && isElder(p, p.id === family.currentId ? livedNow : p.lived)) out.push({ cls: 'elder', text: 'Elder' });
  if (p.kind === 'resident') out.push({ cls: '', text: 'Wed into the house' });
  if (p.kind === 'player') out.push({ cls: '', text: 'Wed from another house' });   // LEGACY7 part three: another player's character
  if (!p.died && p.minor) out.push({ cls: '', text: 'A child' });   // LEGACY5: played once the mantle passes to them
  if (!p.died && p.characterId == null && p.id !== family.currentId && p.kind === 'member') out.push({ cls: 'blood', text: 'Not yet played' });
  // U2: the heir answer (B12), drawn - a Bloodline member who would leave a newborn heir
  if (!p.died && p.kind === 'member' && family.model === MODELS.bloodline && p.heir === true) out.push({ cls: 'blood', text: 'Has an heir' });
  return out;
}

/** The card's identity line: "Dark Elf Nightblade, level 7". A spouse who married in has no career of this house's
 *  record (a townsperson's trade is the census's; another player's character is theirs) - their race alone, and
 *  LEGACY7 part three's player spouse their own house: "Dark Elf - ☠ Ysolde II of House Hlaalu". */
export const identityLine = (p) => ((p.kind ?? 'member') !== 'member'
  ? `${raceWord(p.race)}${p.kind === 'player' && houseLine(p.realm?.house) ? ` - ${houseLine(p.realm.house)}` : ''}`
  : `${raceWord(p.race)} ${p.className}${p.characterId || p.level > 1 ? `, level ${p.level}` : ''}`);

// ---- the tree's view (pan and zoom, pure) -----------------------------------------------------------------------

/** Zoom by `factor` about the point (`px`, `py`) of the view - the point under the pointer stays under it (U1). */
export function zoomAbout(view, factor, px, py) {
  const z = Math.max(TREE_ZOOM_MIN, Math.min(TREE_ZOOM_MAX, view.zoom * factor));
  const k = z / view.zoom;
  return { zoom: z, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}
/** The pan that centres a node in a view `w` x `h` at `zoom`. */
export function centreOn(node, w, h, zoom) {
  const cx = (node.x * TREE_SLOT_W + TREE_NODE_W / 2) * zoom;
  const cy = (node.y * TREE_ROW_H + TREE_NODE_H / 2) * zoom;
  return { x: w / 2 - cx, y: h / 2 - cy };
}

// ---- drawing -----------------------------------------------------------------------------------------------------

/** A portrait into a face box - the game's own FACE##I0.CIF record (ui/partyPanel.js createFaceLoader), a glyph until
 *  it lands or where none comes. */
function faceBox(el, p, cls = 'fam-face') {
  const box = el('div', cls);
  const glyph = el('span', 'fam-glyph', p?.gender === 'female' ? '♀' : '♂');
  box.append(glyph);
  const faces = _provider?.faces;
  if (faces && p) {
    faces({ race: p.race, gender: p.gender, face: p.face }).then((img) => {
      if (!img?.width || img.colors?.byteLength !== img.width * img.height * 4) return;
      const cv = /** @type {HTMLCanvasElement} */ (el('canvas'));
      const ctx = cv.getContext?.('2d');
      if (!ctx?.createImageData) return;
      cv.width = img.width; cv.height = img.height;
      const d = ctx.createImageData(img.width, img.height);
      d.data.set(new Uint8ClampedArray(img.colors.buffer, img.colors.byteOffset, img.colors.byteLength));
      ctx.putImageData(d, 0, 0);
      glyph.remove();
      box.append(cv);
    }).catch(() => { /* the glyph stands */ });
  }
  return box;
}

/** A small "who" button that presses another person on the tree. */
function kinButton(el, family, p, rerender) {
  const b = el('button', null, fullNameOf(p.given, p.surname));
  b.onclick = () => { _sel = p.id; _armed = null; _pan = null; _said = null; rerender(); };
  return b;
}

/**
 * THE FAMILY TREE PAGE: `detail` the rail's pane; `kit` the menu's makers ({ el, divider }).
 */
export function drawTreePage(detail, rerender, { el, divider, door = (fn) => fn() } = /** @type {any} */ ({})) {
  ensureFamilyStyle();
  const prov = _provider;
  const family = prov?.on?.() ? prov.family() : null;
  detail.append(divider('Family Tree'));
  if (!family) { detail.append(el('p', 'px-note', noFamilyLine(prov))); return; }
  const layout = layoutTree(family);
  const livedNow = prov.lived?.() ?? 0;
  if (_sel == null || !personOf(family, _sel)) _sel = family.currentId;
  const wrap = el('div', 'fam-wrap');
  const view = el('div', 'fam-view');
  const stage = el('div', 'fam-stage');
  const W = layout.width * TREE_SLOT_W, H = layout.depth * TREE_ROW_H;
  stage.style.width = `${W}px`; stage.style.height = `${H}px`;
  // the lines first, under the plates
  const svgNs = 'http://www.w3.org/2000/svg';
  const doc = /** @type {any} */ (globalThis.document);
  const svg = doc?.createElementNS ? doc.createElementNS(svgNs, 'svg') : el('div');
  svg.setAttribute?.('class', 'fam-lines');
  svg.setAttribute?.('width', String(W)); svg.setAttribute?.('height', String(H));
  const at = new Map(layout.nodes.map((n) => [n.id, n]));
  const centreX = (id) => at.get(id).x * TREE_SLOT_W + TREE_NODE_W / 2;
  const top = (id) => at.get(id).y * TREE_ROW_H;
  const mid = (id) => at.get(id).y * TREE_ROW_H + TREE_NODE_H / 2;
  const path = (d, cls = '') => { if (!doc?.createElementNS) return; const p = doc.createElementNS(svgNs, 'path'); p.setAttribute('d', d); if (cls) p.setAttribute('class', cls); svg.append(p); };
  for (const c of layout.couples) path(`M ${centreX(c.a) + TREE_NODE_W / 2} ${mid(c.a)} H ${centreX(c.b) - TREE_NODE_W / 2}`, 'wed');
  for (const f of layout.families) {
    const px = f.parents.reduce((s, id) => s + centreX(id), 0) / f.parents.length;
    const py = top(f.parents[0]) + TREE_NODE_H;
    const bar = top(f.children[0]) - (TREE_ROW_H - TREE_NODE_H) / 2;
    const xs = f.children.map(centreX);
    path(`M ${px} ${py} V ${bar}`);
    if (xs.length > 1 || xs[0] !== px) path(`M ${Math.min(px, ...xs)} ${bar} H ${Math.max(px, ...xs)}`);
    for (const id of f.children) path(`M ${centreX(id)} ${bar} V ${top(id)}`);
  }
  stage.append(svg);
  for (const n of layout.nodes) {
    const p = personOf(family, n.id);
    if (!p) continue;
    const node = el('div', `fam-node${p.died ? ' dead' : ''}${p.id === family.currentId ? ' played' : ''}${p.id === _sel ? ' on' : ''}`);
    node.style.left = `${n.x * TREE_SLOT_W}px`; node.style.top = `${n.y * TREE_ROW_H}px`;
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', `${fullNameOf(p.given, p.surname)}${p.died ? ', dead' : ''}`);
    node.setAttribute('aria-pressed', p.id === _sel ? 'true' : 'false');   // AUDIT LEGACY II U14: the picked plate, and the one played, said
    if (p.id === family.currentId) node.setAttribute('aria-current', 'true');
    node.setAttribute('data-focus', `fam-node-${p.id}`);   // the keyboard's plate kept across a redraw
    node.append(faceBox(el, p), el('span', 'fam-nname', p.given || '?'));
    if (p.died) node.append(el('span', 'fam-mark dead', '✝'));
    else if (p.id === family.currentId) node.append(el('span', 'fam-mark', '◆'));
    const pick = () => { _sel = p.id; _armed = null; _said = null; rerender(); };
    node.onclick = (e) => { e.stopPropagation?.(); if (!moved) pick(); };
    node.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); pick(); } };
    stage.append(node);
  }
  view.append(stage);
  view.setAttribute('role', 'group');
  view.setAttribute('aria-label', `The tree of the house of ${family.surname}`);
  // AUDIT LEGACY II U4: the browser scrolls a clipped box to show a plate the keyboard reaches - the pan never knew, and
  // the tools went out of sight with no way back. The box never scrolls; a plate the keyboard reaches is panned to
  view.onscroll = () => { if (view.scrollLeft || view.scrollTop) { view.scrollLeft = 0; view.scrollTop = 0; } };
  view.addEventListener?.('focusin', (e) => {
    const t = /** @type {any} */ (e.target);
    const id = Number(t?.getAttribute?.('data-focus')?.replace('fam-node-', ''));
    const n = Number.isInteger(id) ? at.get(id) : null;
    if (!n) return;
    const w = view.clientWidth || 520, h = view.clientHeight || 340;
    const sx = _pan ? _pan.x + n.x * TREE_SLOT_W * _zoom : 0, sy = _pan ? _pan.y + n.y * TREE_ROW_H * _zoom : 0;
    if (_pan && sx >= 0 && sy >= 0 && sx + TREE_NODE_W * _zoom <= w && sy + TREE_NODE_H * _zoom <= h) return;
    _pan = centreOn(n, w, h, _zoom);
    apply();
  });
  // the view: pan by dragging, zoom about the pointer
  let moved = false;
  const apply = () => { stage.style.transform = `translate(${_pan.x}px, ${_pan.y}px) scale(${_zoom})`; };
  const ensurePan = () => {
    if (_pan) return;
    const w = view.clientWidth || 520, h = view.clientHeight || 340;
    const n = at.get(_sel) ?? at.get(family.currentId) ?? layout.nodes[0];
    _pan = n ? centreOn(n, w, h, _zoom) : { x: 12, y: 12 };
  };
  let drag = null;
  // AUDIT LEGACY U2: the pointer is CAPTURED only once a drag is under way (past four pixels) - captured at the press,
  // the click went to the view and no plate and no zoom button could be pressed with a mouse or a finger
  view.onpointerdown = (e) => { if (e.target?.closest?.('.fam-tools')) return; drag = { x: e.clientX, y: e.clientY, px: _pan?.x ?? 0, py: _pan?.y ?? 0, id: e.pointerId, held: false }; moved = false; };
  // AUDIT LEGACY II U8: a drag ends when the button does - a flick released outside the view, a pointer the browser
  // cancelled or a capture lost left it panning on a bare hover
  const endDrag = () => { drag = null; view.classList.remove('dragging'); setTimeout(() => { moved = false; }, 0); };
  view.onpointermove = (e) => {
    if (drag && e.buttons !== undefined && !(e.buttons & 1)) { endDrag(); return; }
    if (!drag || !_pan) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.abs(dx) + Math.abs(dy) <= 4) return;
    moved = true;
    if (!drag.held) { drag.held = true; view.classList.add('dragging'); view.setPointerCapture?.(drag.id); }
    _pan = { x: drag.px + dx, y: drag.py + dy };
    apply();
  };
  view.onpointerup = endDrag;
  view.onpointercancel = endDrag;
  view.onlostpointercapture = () => { if (drag?.held) endDrag(); };
  view.onwheel = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    ensurePan();
    const r = view.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const v = zoomAbout({ zoom: _zoom, x: _pan.x, y: _pan.y }, e.deltaY < 0 ? TREE_ZOOM_STEP : 1 / TREE_ZOOM_STEP, e.clientX - r.left, e.clientY - r.top);
    _zoom = v.zoom; _pan = { x: v.x, y: v.y };
    apply();
  };
  const tools = el('div', 'fam-tools');
  const tool = (label, title, fn) => { const b = el('button', 'act', label); b.title = title; b.setAttribute('aria-label', title); b.onclick = (e) => { e.stopPropagation?.(); fn(); }; return b; };   // AUDIT LEGACY U10: named for a reader, not by a glyph
  const zoomCentre = (f) => { ensurePan(); const w = view.clientWidth || 520, h = view.clientHeight || 340; const v = zoomAbout({ zoom: _zoom, x: _pan.x, y: _pan.y }, f, w / 2, h / 2); _zoom = v.zoom; _pan = { x: v.x, y: v.y }; apply(); };
  tools.append(tool('+', 'Zoom in', () => zoomCentre(TREE_ZOOM_STEP)), tool('−', 'Zoom out', () => zoomCentre(1 / TREE_ZOOM_STEP)),
    tool('◎', 'Centre on the one you play', () => { _sel = family.currentId; _pan = null; rerender(); }));
  view.append(tools);
  wrap.append(view, personCard(el, family, personOf(family, _sel), livedNow, rerender, door));
  detail.append(wrap);
  // the first frame lays the pan once the view has a size
  const lay = () => { ensurePan(); apply(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(lay); else lay();
}

/** THE CARD - `FamilyLegacyInformationPanel`, whole. */
function personCard(el, family, p, livedNow, rerender, door) {
  const card = el('div', 'fam-card');
  if (!p) return card;
  const played = p.id === family.currentId;
  const lived = played ? livedNow : p.lived;
  const top = el('div', 'fam-top');
  const who = el('div');
  who.append(el('h3', null, fullNameOf(p.given, p.surname)), el('div', 'fam-sub', identityLine(p)));
  if (p.kind === 'member') who.append(el('div', 'fam-sub', `Generation ${p.gen + 1} of the house of ${family.surname}`));
  top.append(faceBox(el, p), who);
  card.append(top);
  const chips = el('div', 'fam-chips');
  for (const c of personChips(family, p, livedNow)) chips.append(el('span', `fam-chip${c.cls ? ` ${c.cls}` : ''}`, c.text));
  if (chips.childNodes?.length || chips.children?.length) card.append(chips);
  const facts = el('div', 'fam-grid');
  const fact = (k, v) => facts.append(el('span', 'k', k), el('span', 'v', v));
  if (family.model === MODELS.enduring || p.died) fact('Age', p.died ? `${ageOf(p, lived)} at death` : `${ageOf(p, lived)} of ${spanOf(p.race)}`);
  if (_provider?.date && p.born) fact('Born', _provider.date(p.born));
  if (p.died && _provider?.date) fact('Died', _provider.date(p.died.at));
  if (p.died?.place?.loc) fact('Fell at', String(p.died.place.loc));
  if (family.model === MODELS.enduring && (p.toll | 0) > 0) fact('Arkay’s toll', `${p.toll} years`);
  const lives = _provider?.inWorld?.() === false ? null : livesLine(family, p);   // AUDIT LEGACY II B5: never a home the world does not show
  if (lives) fact('Lives', lives);
  card.append(facts);
  if (p.stats) {
    card.append(el('p', 'fam-h', 'Attributes'));
    const g = el('div', 'fam-grid');
    for (const k of STAT_KEYS_ORDER) g.append(el('span', 'k', k[0].toUpperCase() + k.slice(1)), el('span', 'v', String(p.stats[k] ?? '')));
    card.append(g);
  } else if (Object.values(p.blood ?? {}).some((v) => v > 0)) {
    card.append(el('p', 'fam-h', 'The blood'));
    const g = el('div', 'fam-grid');
    for (const k of STAT_KEYS_ORDER) if (p.blood[k] > 0) g.append(el('span', 'k', k[0].toUpperCase() + k.slice(1)), el('span', 'v', `+${p.blood[k]}`));
    card.append(g);
  }
  for (const [label, ids] of [['Primary skills', p.groups?.primary], ['Major skills', p.groups?.major], ['Minor skills', p.groups?.minor]]) {
    if (!ids?.length) continue;
    card.append(el('p', 'fam-h', label));
    const g = el('div', 'fam-grid');
    for (const id of ids) g.append(el('span', 'k', SKILL_NAMES[id] ?? `Skill ${id}`), el('span', 'v', p.skills ? String(p.skills[id] ?? '') : (p.hearth?.[id] ? `+${p.hearth[id]}` : '')));
    card.append(g);
  }
  const kinLine = (label, list) => {
    if (!list.length) return;
    const line = el('div', 'fam-kin');
    line.append(document.createTextNode?.(`${label}: `) ?? el('span', null, `${label}: `));
    list.forEach((k, i) => { if (i) line.append(document.createTextNode?.(', ') ?? el('span', null, ', ')); line.append(kinButton(el, family, k, rerender)); });
    card.append(line);
  };
  kinLine('Parents', parentsOf(family, p));
  kinLine('Spouse', p.spouse != null && personOf(family, p.spouse) ? [personOf(family, p.spouse)] : []);
  kinLine('Siblings', siblingsOf(family, p));
  kinLine('Children', childrenOf(family, p));
  // the acts
  if (_said) card.append(liveLine(el, _said));
  const acts = el('div', 'fam-acts');
  if (isAlive(p) && !played && p.kind === 'member' && p.retired == null) {
    const why = _provider?.switchRefusal?.(p.id) ?? null;
    const key = `switch:${p.id}`;
    const b = el('button', `act${_armed === key ? ' primary' : ''}`, _armed === key ? `Yes - play as ${p.given}` : `Play as ${p.given}`);
    b.setAttribute('data-focus', 'fam-act-switch');   // AUDIT LEGACY II U6: armed, its words change - the keyboard stays on it
    if (why && why !== 'none') { b.disabled = true; b.title = why; }
    b.onclick = () => {
      if (_armed !== key) { _armed = key; _said = { ok: true, text: p.characterId ? `${fullNameOf(p.given, p.surname)}'s journey picks up where they left it. You are saved where you stand.` : `${fullNameOf(p.given, p.surname)} sets out for the first time from the family seat. You are saved where you stand.` }; rerender(); return; }
      _armed = null;
      const r = door(() => _provider?.switchTo?.(p.id) ?? { ok: false, why: 'Not here.' });
      _said = r.ok ? { ok: true, text: `Playing as ${p.given}...` } : { ok: false, text: r.why ?? 'Not now.' };
      rerender();
    };
    acts.append(b);
    if (why && why !== 'none') card.append(el('p', 'fam-why', why));
  }
  if (played && family.model === MODELS.enduring && isElder(p, livedNow) && _provider?.passMantle) {
    const armed = _armed === 'mantle';
    const b = el('button', `act${armed ? ' primary' : ''}`, armed ? 'Yes - pass the mantle' : 'Pass the mantle');
    b.setAttribute('data-focus', 'fam-act-mantle');   // AUDIT LEGACY II U6
    b.title = `${p.given} retires to the family seat, and you choose who carries the line on.`;
    // AUDIT LEGACY U4: why not, said on the card before the press - pressed, the act takes the pause down first
    const why = _provider?.mantleRefusal?.() ?? null;
    if (why && why !== 'none') { /** @type {any} */ (b).disabled = true; b.title = why; card.append(el('p', 'fam-why', why)); }
    b.onclick = () => {
      if (!armed) { _armed = 'mantle'; _said = { ok: true, text: `${p.given} will retire to the family seat for good. Press again to choose who carries the line on.` }; rerender(); return; }
      _armed = null;
      const r = door(() => _provider.passMantle());
      _said = r.ok ? null : { ok: false, text: r.why ?? 'Not now.' };
      rerender();
    };
    acts.append(b);
  }
  if (acts.childNodes?.length || acts.children?.length) card.append(acts);
  return card;
}

/** LEGACY-HOME: where one of the line lives, in words - or null (the dead, the one played, one wed in). */
export function livesLine(family, p) {
  if (isAlive(p) && p.kind === 'player') return 'With their own house, wherever its road leads';   // LEGACY7 part three: another player's character walks their own world
  if (!isAlive(p) || p.kind !== 'member' || p.id === family.currentId) return null;
  const home = homeOf(family, p);
  if (!home) return 'On their own journey';
  if (home.lent) return `In ${family.seat?.loc ?? 'the family seat'}, among its townsfolk`;
  const h = (family.houses ?? []).find((x) => sameHouse(x, home));
  const where = h?.location ? ` in ${h.location}` : '';
  return sameHouse(home, familyHome(family)) ? `At the family home${where}` : `In their own house${where}`;
}

/** An act's word, said to a reader as it changes (AUDIT LEGACY II U14). */
function liveLine(el, said) {
  const n = el('p', said.ok ? 'fam-said' : 'fam-why', said.text);
  n.setAttribute('role', 'status');
  n.setAttribute('aria-live', 'polite');
  return n;
}

const noFamilyLine = (prov) => (!prov ? 'Your family is kept in the world - open this from a game.'
  : !prov.on?.() ? 'Turn on Project Legacy (Features) to found a family and carry your line on.'
    : 'Your family is founded when your character is made, or the first time an older character is loaded.');

/** THE HOUSE PAGE. */
export function drawHousePage(detail, rerender, { el, divider } = /** @type {any} */ ({})) {
  ensureFamilyStyle();
  const prov = _provider;
  const family = prov?.on?.() ? prov.family() : null;
  detail.append(divider(family ? `The House of ${family.surname}` : 'The House'));
  if (!family) { detail.append(el('p', 'px-note', noFamilyLine(prov))); return; }
  const me = currentOf(family);
  const g = el('div', 'fam-grid');
  const fact = (k, v) => g.append(el('span', 'k', k), el('span', 'v', v));
  fact('Model', modelWord(family.model));
  fact('Seat', family.seat?.loc ? `${family.seat.loc}, ${family.seat.region}` : 'none yet - the first town you stand in');
  fact('Generations', String(1 + family.people.reduce((m, p) => Math.max(m, p.gen | 0), 0)));
  fact('Living', String(family.people.filter((p) => isAlive(p) && p.kind === 'member').length));
  fact('Fallen', String(family.people.filter((p) => p.died).length));
  if (me) fact('Head of the house', fullNameOf(me.given, me.surname));
  if (prov.date && family.founded) fact('Founded', prov.date(family.founded));
  detail.append(g, el('p', 'px-note', modelLine(family.model)));
  // LEGACY-HOME: THE HOMES - every house one of the line holds, the family home among them (where the never-played and
  // the retired live, and where a member saved in it waits), the player's to choose
  detail.append(el('p', 'fam-h', 'The homes'));
  const houses = family.houses ?? [];
  if (!houses.length) {
    detail.append(el('p', 'px-note', family.seat?.loc ? `The line holds no house of its own. Its members live in ${family.seat.loc}, among its townsfolk - buy a house at a bank, and they move in.` : 'The line holds no house of its own, and no seat yet.'));
  } else {
    const home = familyHome(family);
    const list = el('div', 'fam-hall');
    for (const h of houses) {
      const row = el('div', 'fam-hallrow');
      const holder = personOf(family, h.by);
      row.append(el('div', 'fam-kin', `${h.location || 'A house'}${sameHouse(h, home) ? ' - the family home' : ''}`),
        el('div', 'fam-sub', holder ? `${fullNameOf(holder.given, holder.surname)}'s deed` : 'A deed of the house'));
      if (!sameHouse(h, home) && prov.markHome) {
        const b = el('button', 'act fam-makehome', 'Make this the family home');
        b.setAttribute('aria-label', `Make ${h.location || 'this house'} the family home`);
        // AUDIT LEGACY II U7: said, and the keyboard kept on the homes - the pressed button goes with its row's change,
        // and the browser's focus landed on the OTHER row's same button, whose next press undid the first
        b.onclick = () => {
          const ok = prov.markHome(h);
          _homeSaid = ok ? { ok: true, text: `${h.location || 'That house'} is the family home now.` } : { ok: false, text: 'That house is not the family\'s.' };
          rerender();
        };
        row.append(b);
      }
      list.append(row);
    }
    detail.append(list);
    if (_homeSaid) { const n = liveLine(el, _homeSaid); n.setAttribute('tabindex', '-1'); n.setAttribute('data-focus', 'fam-home-said'); detail.append(n); setTimeout(() => n.focus?.({ preventScroll: true }), 0); _homeSaid = null; }
  }
  if (prov.livingWorld && !prov.livingWorld()) detail.append(el('p', 'px-note', 'Your family lives in the Living World\'s towns - turn on the Living World (Features, the enhanced screens) to meet them there.'));
  else if (prov.inWorld && !prov.inWorld()) detail.append(el('p', 'px-note', 'Your family keeps out of sight: "Family In World" is off in Project Legacy\'s settings.'));
  else detail.append(el('p', 'px-note', 'Your family lives in the world while you play another of them. Speak with one to play as them.'));
  const fallen = family.people.filter((p) => p.died).sort((a, b) => (b.died.at ?? 0) - (a.died.at ?? 0));
  if (fallen.length) {
    detail.append(el('p', 'fam-h', 'The fallen'));
    const list = el('div', 'fam-hall');
    for (const p of fallen) {
      const row = el('div', 'fam-hallrow');
      row.append(el('div', 'fam-kin', `${fullNameOf(p.given, p.surname)} - ${identityLine(p)}`),
        el('div', 'fam-sub', [p.died.cause === 'years' ? 'died of their years' : p.died.cause === 'slain' ? `was slain${p.died.by ? ` by ${p.died.by}` : ''}` : p.died.cause === 'gone' ? 'is gone from the realm' : 'fell', p.died.place?.loc ? `at ${p.died.place.loc}` : '', prov.date ? `on ${prov.date(p.died.at)}` : ''].filter(Boolean).join(' ')));
      list.append(row);
    }
    detail.append(list);
  }
}

/** THE HALL OF ANCESTORS PAGE: every family this browser keeps. */
export function drawHallPage(detail, rerender, { el, divider } = /** @type {any} */ ({})) {
  ensureFamilyStyle();
  const prov = _provider;
  detail.append(divider('Hall of Ancestors'));
  const all = prov?.hall?.() ?? [];
  if (!all.length) { detail.append(el('p', 'px-note', 'No house has been founded here yet.')); return; }
  const list = el('div', 'fam-hall');
  const playing = prov?.family?.()?.id ?? null;
  for (const f of all) {
    const row = el('div', 'fam-hallrow');
    const gens = 1 + f.people.reduce((m, p) => Math.max(m, p.gen | 0), 0);
    const head = currentOf(f);
    row.append(el('div', 'fam-kin', `The House of ${f.surname}${f.id === playing ? ' (yours)' : ''}`),
      el('div', 'fam-sub', `${modelWord(f.model)} - ${gens} ${gens === 1 ? 'generation' : 'generations'}, ${f.people.length} remembered, ${f.people.filter((p) => p.died).length} fallen`),
      el('div', 'fam-sub', f.ended != null ? `The line ended${prov.date ? ` on ${prov.date(f.ended)}` : ''}.` : head ? `Carried by ${fullNameOf(head.given, head.surname)}.` : ''));
    list.append(row);
  }
  detail.append(list);
}
