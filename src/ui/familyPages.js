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
//  - THE HOUSE ON THE CHARACTER SHEET (sheetHouse): the one played's own facts off their card, on the pause window's
//    Stats page - the model, the generation, and an Enduring house's age, toll and elder's word.
//
// Dressed by the stone-and-brass kit's roles (ui/enhancedFrame.js FRAME_ROLES): this sheet writes geometry and the
// words' colours alone.
import { layoutTree } from '../systems/legacy/tree.js';
import { MODELS, NO_LINEAGE, personOf, currentOf, isAlive, parentsOf, childrenOf, siblingsOf, fullNameOf } from '../systems/legacy/family.js';
import { ageOf, spanOf, isElder, isSpent } from '../systems/legacy/age.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { STAT_KEYS_ORDER } from '../systems/statMods.js';
import { homeOf, familyHome, sameHouse } from '../systems/legacy/household.js';   // LEGACY-HOME: where each of the line lives
import { houseLine } from '../net/houseLaw.js';   // LEGACY7 part three: a player spouse's own house on their card
import { houseWord } from '../systems/legacy/houseName.js';   // LEGACY-NAME: a seat's house said once
import { facePose } from '../systems/legacy/facePose.js';   // AUDIT LEGACY III P17: a person's portrait, asked one way
import { optionPath } from './settingsMap.js';   // ORG2

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
 * @property {() => any} [past]   AUDIT LEGACY III A17: the past played back (a dead or retired member's save), or null
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
 * @property {() => ({region:string, loc:string}|null)} [familySeatHere]   FAMILY-SEAT: the town the one played stands in,
 *   when the seat may move there (scenes/legacyHost.js familySeatHere), or null
 * @property {() => {ok:boolean, why?:string}} [moveFamilySeat]   FAMILY-SEAT: the seat moved there
 * @property {() => (string|null)} [choice]   LEGACY-CHOICE: the played character's own answer (`entity.legacyChoice`)
 * @property {() => boolean} [online]   LEGACY-CHOICE: whether the page is the online lane's
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
let _seatSaid = null; // FAMILY-SEAT: the House page's word on the seat (armed: what the second press will do)
/** AUDIT FB1007b S5: where the seat's move is not offered, the House page says where it is - the host's refusal says the
 *  same (scenes/legacyHost.js LEGACY_TEXT.seatNowhere). */
export const SEAT_HINT = 'Stand in another town - its streets or one of its buildings - to make it the family\'s seat.';
/** A fresh visit: nothing pressed, the tree centred, no word left over. */
export function resetFamilyPages() { _sel = null; _zoom = 1; _pan = null; _said = null; _armed = null; _homeSaid = null; _seatSaid = null; }
/** AUDIT LEGACY U8: another page or tab pressed - an armed act and its word never wait for the way back. */
export function disarmFamilyPages() { _said = null; _armed = null; _seatSaid = null; }

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
/* AUDIT LEGACY III U3: STACKED BY THE PANE, never the viewport alone - beside the pause rail the detail pane is 380-550px
   wide from a 721px window up, and the card beside the tree left it a keyhole (74px at 721, its Zoom in clipped out of
   reach). Under 560px of pane the card goes below the tree, which keeps the whole width */
.px-sys .fam-page { container: fampage / inline-size; }
@container fampage (max-width: 560px) { .px-sys .fam-wrap { flex-direction: column; align-items: stretch; } .px-sys .fam-card { max-width: none; flex-basis: auto; max-height: none; } }
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
/** LEGACY-NAME: a house's title - "The House of Hlaalu", a seat's house "The House of Sentinel" (never "of of"), and
 *  "The House" while it has no name yet (founded where no town stands, its seat still to come). */
export const houseTitle = (surname) => (houseWord(surname) ? `The House of ${houseWord(surname)}` : 'The House');
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

/** A person's age as their card says it: an Enduring house's living against their span ("34 of 90"), anyone's at their
 *  death ("71 at death"); null where the house counts no years (a Bloodline's living - the span is the Enduring
 *  model's, section 6). The card and the character sheet (sheetHouse) read this one line. Pure. AUDIT LEGACY III
 *  A11/F10/U7: the BLOOD's years alone, and a grown one's - the house keeps no years of one wed in (every spouse read
 *  twenty for life), nor of a child not yet of age (a newborn read "23 of 90"). */
export function ageWord(family, p, lived) {
  if ((p.kind ?? 'member') !== 'member' || (p.minor && !p.died)) return null;
  if (p.died) return `${ageOf(p, lived)} at death`;
  return family.model === MODELS.enduring ? `${ageOf(p, lived)} of ${spanOf(p.race)}` : null;
}
/** AUDIT LEGACY III U9: where a person's life ended, by how - a fall is "Fell at", a death of years "Died at". */
const endedAtLabel = (cause) => (cause === 'fell' || cause === 'slain' ? 'Fell at' : 'Died at');

/** The elder's word on the character sheet - the card's Elder chip and its Pass the mantle, and the span spent that
 *  tollLine said at the last rise. */
export const SHEET_HOUSE_TEXT = Object.freeze({
  elder: 'An elder of the house: the mantle may pass from you on the Family tab.',
  spent: 'Your span is spent: your next death is your last.',
});

/**
 * THE HOUSE ON THE CHARACTER SHEET (bible/06-Systems/Legacy-Arc.md section 11 - the arc's first plan: "the age and the
 * elder's word on the character sheet"; AUDIT LEGACY F2 found it never built). The one played's house as their card
 * says it: the model and their generation, and in an Enduring house their age against their span, Arkay's toll and the
 * elder's word (ui/enhancedMenu.js statsCharacter draws it). Null with no house to show: Project Legacy off, no family,
 * the one played none of it, or fallen. Pure over the provider.
 * @returns {{ title: string, rows: [string, string][], word: string|null } | null}
 */
export function sheetHouse(prov = _provider) {
  if (!prov?.on?.()) return null;
  if (prov.past?.()) return null;   // AUDIT LEGACY III A17: the past played back is no one's sheet - the head's facts on its clock
  const family = prov.family?.() ?? null;
  const p = family ? currentOf(family) : null;
  if (!p || p.died) return null;
  const lived = prov.lived?.() ?? 0;
  /** @type {[string, string][]} */
  const rows = [['Model', modelWord(family.model)], ['Generation', String((p.gen | 0) + 1)]];
  const age = ageWord(family, p, lived);
  if (age) rows.push(['Age', age]);
  let word = null;
  if (family.model === MODELS.enduring) {
    if ((p.toll | 0) > 0) rows.push(['Arkay’s toll', `${p.toll} years`]);
    word = isSpent(p, lived) ? SHEET_HOUSE_TEXT.spent : isElder(p, lived) ? SHEET_HOUSE_TEXT.elder : null;
  }
  return { title: houseTitle(family.surname), rows, word };
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
    // AUDIT LEGACY III P17: a townsperson wed in wears their own face (systems/legacy/facePose.js)
    faces(facePose(p)).then((img) => {
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
  // a couple's line from the left plate's edge to the right's - an earlier spouse stands left of the member (tree.js)
  for (const c of layout.couples) { const [l, r] = centreX(c.a) <= centreX(c.b) ? [c.a, c.b] : [c.b, c.a]; path(`M ${centreX(l) + TREE_NODE_W / 2} ${mid(l)} H ${centreX(r) - TREE_NODE_W / 2}`, 'wed'); }
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
  view.setAttribute('aria-label', `The family tree${houseWord(family.surname) ? ` of the house of ${houseWord(family.surname)}` : ''}`);
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
  const page = el('div', 'fam-page');   // AUDIT LEGACY III U3: the pane the stacking reads (FAMILY_CSS's @container)
  page.append(wrap);
  detail.append(page);
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
  if (p.kind === 'member') who.append(el('div', 'fam-sub', `Generation ${p.gen + 1} of the house${houseWord(family.surname) ? ` of ${houseWord(family.surname)}` : ''}`));
  top.append(faceBox(el, p), who);
  card.append(top);
  const chips = el('div', 'fam-chips');
  for (const c of personChips(family, p, livedNow)) chips.append(el('span', `fam-chip${c.cls ? ` ${c.cls}` : ''}`, c.text));
  if (chips.childNodes?.length || chips.children?.length) card.append(chips);
  const facts = el('div', 'fam-grid');
  const fact = (k, v) => facts.append(el('span', 'k', k), el('span', 'v', v));
  const age = ageWord(family, p, lived);
  if (age) fact('Age', age);
  if (_provider?.date && p.born) fact('Born', _provider.date(p.born));
  if (p.died && _provider?.date && p.died.cause !== 'gone') fact('Died', _provider.date(p.died.at));   // U7: one gone from the realm died on no day of ours
  if (p.died?.place?.loc) fact(endedAtLabel(p.died.cause), String(p.died.place.loc));
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
    b.title = `${p.given} retires to keep the house, and you choose who carries the line on.`;   // AUDIT LEGACY III F11d: never "to the seat" - where they keep it is the house's (household.js)
    // AUDIT LEGACY U4: why not, said on the card before the press - pressed, the act takes the pause down first
    const why = _provider?.mantleRefusal?.() ?? null;
    if (why && why !== 'none') { /** @type {any} */ (b).disabled = true; b.title = why; card.append(el('p', 'fam-why', why)); }
    b.onclick = () => {
      if (!armed) { _armed = 'mantle'; _said = { ok: true, text: `${p.given} will retire for good, to keep the house. Press again to choose who carries the line on.` }; rerender(); return; }
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

/** LEGACY-HOME: whose deed a house of the line's is, in words. PERMADEATH-HOUSES: one of the line's dead holds it until
 *  whoever carries the line takes it up (legacyHost.js takeDeeds), and one taken up names who left it. */
export function deedLine(family, h, holder = personOf(family, h?.by)) {
  if (!holder) return 'A deed of the house';
  const name = fullNameOf(holder.given, holder.surname);
  if (!isAlive(holder)) return `The late ${name}'s deed - it passes to whoever carries the line`;
  const from = Number.isInteger(h?.from) ? personOf(family, h.from) : null;
  return from ? `${name}'s deed, left by ${fullNameOf(from.given, from.surname)}` : `${name}'s deed`;
}

/** An act's word, said to a reader as it changes (AUDIT LEGACY II U14). */
function liveLine(el, said) {
  const n = el('p', said.ok ? 'fam-said' : 'fam-why', said.text);
  n.setAttribute('role', 'status');
  n.setAttribute('aria-live', 'polite');
  return n;
}

/** Why a page has no family to show. LEGACY-CHOICE: a character who answered no lineage, and online one made before the
 *  question was put there (or copied in), play without a house for good - a new character founds one. */
export const noFamilyLine = (prov) => (!prov ? 'Your family is kept in the world - open this from a game.'
  : !prov.on?.() ? `Turn on Project Legacy (${optionPath('feat:mod-project-legacy')}) to found a family and carry your line on.`   // ORG2
    : prov.choice?.() === NO_LINEAGE ? 'This character chose to live without a house. Make a new character to found one.'
      : prov.online?.() ? 'This character has no house - online, a house is founded only when a character is made. Make a new character to found one.'
        : 'Your family is founded when your character is made, or the first time an older character is loaded.');

/** THE HOUSE PAGE. */
export function drawHousePage(detail, rerender, { el, divider } = /** @type {any} */ ({})) {
  ensureFamilyStyle();
  const prov = _provider;
  const family = prov?.on?.() ? prov.family() : null;
  detail.append(divider(houseTitle(family?.surname)));
  if (!family) { detail.append(el('p', 'px-note', noFamilyLine(prov))); return; }
  const me = currentOf(family);
  const g = el('div', 'fam-grid');
  const fact = (k, v) => g.append(el('span', 'k', k), el('span', 'v', v));
  fact('Model', modelWord(family.model));
  fact('Seat', family.seat?.loc ? `${family.seat.loc}, ${family.seat.region}` : 'none yet - the first town you stand in');
  fact('Generations', String(1 + family.people.reduce((m, p) => Math.max(m, p.gen | 0), 0)));
  // AUDIT LEGACY III A15/U9: both counts the blood's - the Fallen counted every spouse, and a player's character gone
  // from the realm, beside a Living that counted the blood alone
  fact('Living', String(family.people.filter((p) => isAlive(p) && p.kind === 'member').length));
  fact('Fallen', String(fallenOfHouse(family).length));
  if (me) fact('Head of the house', fullNameOf(me.given, me.surname));
  if (prov.date && family.founded) fact('Founded', prov.date(family.founded));
  detail.append(g, el('p', 'px-note', modelLine(family.model)));
  // FAMILY-SEAT (FIELD BUGS 2026-10-07b, afjiz: "the option in the enhanced ui to reset your family seat to a town your
  // currently in"): the seat is the first town the house stands in, and the player's to move to the town the one played
  // stands in now - armed by the first press, as a switch is (the heirs are born where the seat is)
  const here = prov.moveFamilySeat ? prov.familySeatHere?.() ?? null : null;
  if (here) {
    const armed = _armed === 'seat';
    const b = el('button', `act fam-moveseat${armed ? ' primary' : ''}`, armed ? `Yes - make ${here.loc} the family seat` : `Make ${here.loc} the family seat`);
    b.setAttribute('data-focus', 'fam-act-seat');   // armed, its words change - the keyboard stays on it
    b.onclick = () => {
      if (!armed) { _armed = 'seat'; _seatSaid = { ok: true, text: `The house's heirs will be born in ${here.loc}, and its fallen laid to rest there. Press again to move the seat.` }; rerender(); return; }
      _armed = null;
      const r = prov.moveFamilySeat();
      _seatSaid = r.ok ? { ok: true, text: `${here.loc} is your family's seat now.` } : { ok: false, text: r.why ?? 'Not now.' };
      rerender();
    };
    detail.append(b);
  } else if (prov.moveFamilySeat && family.seat?.loc && !family.pending && me && isAlive(me) && !prov.past?.()) {
    // AUDIT FB1007b S5: where the move is not offered, the page says where it is - else the seat looked fixed for good
    detail.append(el('p', 'px-note fam-seathint', SEAT_HINT));
  }
  if (_seatSaid) {
    const n = liveLine(el, _seatSaid);
    // AUDIT FB1007b S4: the move said, the keyboard kept on the page (AUDIT LEGACY II U7's way) - the pressed button goes
    // with the move, and the focus fell to the page, whose next Tab went back to the tabs. Armed, it stays on the button
    if (_armed !== 'seat') { n.setAttribute('tabindex', '-1'); n.setAttribute('data-focus', 'fam-seat-said'); setTimeout(() => n.focus?.({ preventScroll: true }), 0); _seatSaid = null; }
    detail.append(n);
  }
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
        el('div', 'fam-sub', deedLine(family, h, holder)));
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
  if (prov.livingWorld && !prov.livingWorld()) detail.append(el('p', 'px-note', `Your family lives in the Living World\u2019s towns - turn on Living world (${optionPath('feat:living-world')}) to meet them there.`));
  else if (prov.inWorld && !prov.inWorld()) detail.append(el('p', 'px-note', 'Your family keeps out of sight: "Family In World" is off in Project Legacy\'s settings.'));
  else detail.append(el('p', 'px-note', 'Your family lives in the world while you play another of them. Speak with one to play as them.'));
  // the house's dead - the blood's, and a spouse's beside them (wed in: said so); one gone from the realm is no death
  const fallen = family.people.filter((p) => p.died && p.died.cause !== 'gone').sort((a, b) => (b.died.at ?? 0) - (a.died.at ?? 0));
  if (fallen.length) {
    detail.append(el('p', 'fam-h', 'The fallen'));
    const list = el('div', 'fam-hall');
    for (const p of fallen) {
      const row = el('div', 'fam-hallrow');
      // AUDIT LEGACY III F6: a fall names what struck them down, as the journal does (the revenant's name, died.by)
      const how = p.died.cause === 'years' ? 'died of their years' : p.died.cause === 'slain' ? `was slain${p.died.by ? ` by ${p.died.by}` : ''}` : `fell${p.died.by ? ` to ${p.died.by}` : ''}`;
      row.append(el('div', 'fam-kin', `${fullNameOf(p.given, p.surname)} - ${identityLine(p)}${p.kind === 'member' ? '' : ' (wed into the house)'}`),
        el('div', 'fam-sub', [how, p.died.place?.loc ? `at ${p.died.place.loc}` : '', prov.date ? `on ${prov.date(p.died.at)}` : ''].filter(Boolean).join(' ')));
      list.append(row);
    }
    detail.append(list);
  }
}

/** The house's fallen as its pages count them: the blood's dead (AUDIT LEGACY III A15). */
export const fallenOfHouse = (family) => (family?.people ?? []).filter((p) => p.died && p.kind === 'member');

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
    row.append(el('div', 'fam-kin', `${houseTitle(f.surname)}${f.id === playing ? ' (yours)' : ''}`),
      el('div', 'fam-sub', `${modelWord(f.model)} - ${gens} ${gens === 1 ? 'generation' : 'generations'}, ${f.people.length} remembered, ${fallenOfHouse(f).length} fallen`),
      el('div', 'fam-sub', f.ended != null ? `The line ended${prov.date ? ` on ${prov.date(f.ended)}` : ''}.` : head ? `Carried by ${fullNameOf(head.given, head.surname)}.` : ''));
    list.append(row);
  }
  detail.append(list);
}
