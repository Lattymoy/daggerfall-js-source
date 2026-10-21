// GRIM1 (2026-10-09, Discord: CLEM - "Grimoir UI is almost amazing ... the map leaves something to be desired at least
// in function, i love the artwork. Sadly GrimUI doesn't allow me pick up tents. sounds are missing ... No Hotbar ... the
// lack of customizability is disappointing ... I want some of the features of enhanced+ just not the overall look of
// it"; Skibbster - "More support for grimoire and classic UI in general"; Dudey - "Create a DFO Grimoir UI. Keep the
// style and soul of Grimoir UI and make it offer everything enhanced plus has (means supports every window and ui
// ingame) ... healthbar/mana/stamina etc all have to stay true to grimoir ui ... if it looks anything like enhanced plus
// ppl will hate it") - THE DFO GRIMOIRE DRESS.
//
// WHAT IT IS. A third look on the UI Overhaul card beside Classic, Enhanced Plus and GrimoireUI: the ENHANCED skin -
// so every window, every HUD piece and every feature the enhanced skin carries (the hotbar, the camps and their tents,
// the rest window, the sounds, the maps, the trade, the online panels) - dressed head to foot in LordSquacquerone's
// GrimoireUI: the cream page and the tan scroll, the dark planked desk, the red Exit press with its yellow lettering,
// the wooden shelf boxes, the glass vials, and the Alagard face the pack draws every word in. It is NOT a colour of
// Enhanced Plus: nothing of Plus's dress shows through - no carved stone, no brass corner fittings, no pixel face, no
// spaced capitals, no starfield.
//
// HOW IT IS WORN. `<html data-plus-dress="grimoire">` (the `plusDress` pref), and while it is worn the Plus colour
// stands at Slate underneath (the bare kit), so a Stone or Ember a player chose for Enhanced Plus is kept for when
// they wear it again and never bleeds into this. Three sheets, all keyed on that attribute and all after every other:
//   1. THE FACE        the pack's Alagard (FONT0003-SDF.ttf), over every family the enhanced sheets name
//   2. THE KIT         every role of ui/enhanced/enhancedFrame.js FRAME_ROLES repainted in the pack's materials, the HUD's
//                      vitals as the pack's three vials, the hotbar as its shelf boxes, the front door on its desk
//   3. THE INK         Plus writes light words on dark stone; a page wants dark ink. Every rule of every enhanced sheet
//                      on the page is read once (and every sheet injected later, as it lands) and re-said for the
//                      parchment: a light word becomes ink - brown by how bright it was, gold becomes the pack's red,
//                      a colour keeps its hue in a darker ink - a dark ground becomes a faint brown wash, a stone edge a
//                      brown line, a hard black shadow under a word goes. Only INSIDE a parchment surface and never
//                      inside a wooden one (a press, a shelf box, a band, a socket), where Plus's light words stand on
//                      the dark wood as the pack's own gold-on-wood labels do.
// The pictures are the pack's, cut at run time (ui/grimoireArt.js) - nothing new is committed.
import { FRAME_ROLES, FRAME_CSS } from './enhanced/enhancedFrame.js';
import { CHANNEL_COLOURS, NAME_COLOURS, PING_COLOURS, RP_COLOURS, channelRules, pipRules } from './chatColours.js';   // CHAT-COLOURS, NAME-INK, PING1: the chat's colours on the page
import { tierMarkCss } from './lootTierMarks.js';   // LOOT-MARKS: the quick loot's tier gem and wash, on the page
import { buildGrimoireArt, grimoireFontUrl, grimoireImg, artVar, FRAME_ART, nativeSize, BOOK_SLICE, PLATE_SLICE,
  VIAL_CUT, DIAL_ICONS, dialIconSize, dialArtName, grimoireDeskUrl } from './grimoireArt.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { pageParam } from '../systems/pageQuery.js';

export const GRIMOIRE_DRESS = 'grimoire';
/** The scope every rule of the dress sits under. */
export const G = ':root[data-plus-dress="grimoire"]';
/** DIAL-PACK: the Tab dial's doors in Daggerfall's own art unless the card's row keeps the pack's paintings. */
const DIAL_CLASSIC = `${G}:not([data-grim-dial="pack"])`;
export const GRIMOIRE_FAMILY = 'DFO Alagard';
export const GRIMOIRE_STACK = `'${GRIMOIRE_FAMILY}', 'Alagard', Georgia, serif`;

/** The dress in effect: 'grimoire' or 'none' - the URL's `?dress=` for this page load (SKIN-CARRY's law: the card
 *  carries the choice there when the shelf refused it), else the shelf's. */
export const plusDress = (search) => {
  const url = pageParam('dress', search ?? globalThis.location?.search ?? '');
  const id = url === GRIMOIRE_DRESS || url === 'none' ? url : getPref('plusDress');
  return id === GRIMOIRE_DRESS ? GRIMOIRE_DRESS : 'none';
};
/** The DFO Grimoire card's own choices - the page the windows are written on and what the front door stands on. */
export const GRIMOIRE_PAGES = Object.freeze({ cream: 'Cream page', scroll: 'Tan scroll' });
export const GRIMOIRE_BACKDROPS = Object.freeze({ desk: 'The desk', map: 'The map' });
/** The vitals: the pack's three vials standing in the corner as Daggerfall stands its bars, or lying in a row under
 *  the hotbar with their numbers on the glass. */
export const GRIMOIRE_VITALS = Object.freeze({ upright: 'Upright vials', row: 'Vials in a row' });
/** GRIM3 (a player: "Any chance you could work it in a way that it can (optionallly) rettain the look of the original
 *  GrimoireUI spellbook?"): the spellbook as the dress's book (the desk's painted book, like every other) or as
 *  GrimoireUI's own spellbook picture (SPBK00I0), every press of the enhanced book written on it. */
export const GRIMOIRE_SPELLBOOKS = Object.freeze({ book: 'DFO book', pack: 'GrimoireUI\'s own' });
/** DIAL-PACK (2026-10-12, Mac: "add the old Tab selector as optional to the overhaul option"): the Tab dial's doors in
 *  Daggerfall's own art (the face and the HUD bar's icons - ui/dialClassicArt.js, the default) or the pack's paintings
 *  (GRIM4's helm, book, chest and map). */
export const GRIMOIRE_DIALS = Object.freeze({ classic: 'Daggerfall icons', pack: 'Grimoire paintings' });
export const grimoireDial = () => (Object.hasOwn(GRIMOIRE_DIALS, getPref('grimoireDial')) ? getPref('grimoireDial') : 'classic');
export const grimoireSpellbook = () => (Object.hasOwn(GRIMOIRE_SPELLBOOKS, getPref('grimoireSpellbook')) ? getPref('grimoireSpellbook') : 'book');
export const grimoireVitals = () => (Object.hasOwn(GRIMOIRE_VITALS, getPref('grimoireVitals')) ? getPref('grimoireVitals') : 'upright');
export const grimoirePages = () => (Object.hasOwn(GRIMOIRE_PAGES, getPref('grimoirePages')) ? getPref('grimoirePages') : 'cream');
export const grimoireBackdrop = () => (Object.hasOwn(GRIMOIRE_BACKDROPS, getPref('grimoireBackdrop')) ? getPref('grimoireBackdrop') : 'desk');

/** INK-TONES: a rarity's tone deepened to read on the page (the loot plaque's own), and a set's and the sigil's own
 *  colour mixed down with the ink - 40% (the sigil's lighter teal 35%) keeps its hue and reads at 4.5:1 or better on the cream page. */
export const RARITY_INK = Object.freeze({ magic: '#1f4f9e', rare: '#5c4600', legendary: '#9a4210', aetheric: '#1d6a86', artifact: '#5e2a96', gilded: '#7a4a00' });
export const SET_INK = 'color-mix(in srgb, var(--set, #4fb8a8) 40%, #120a04)';
/** AUDIT C&C S4: the felt temperature's colours deepened to read on the page - the Plus plaque's ice and amber as inks
 *  (4.9:1 and 4.6:1 on the cream, the magic and the gilded tones' own), and its felt frame in the Plus warn's dark edge
 *  (4.2:1); a comfortable reading is written in the ink and a costing one framed in the pack's red. */
export const TEMP_INK = Object.freeze({ cold: '#1f4f9e', hot: '#7a4a00', warn: '#7a5424' });
export const SIGIL_INK = 'color-mix(in srgb, var(--sigil, #72f0d8) 35%, #120a04)';
/** The pack's tones, sampled off its own pictures. */
export const GRIM_TONES = Object.freeze({
  ink: '#2b1a0c', inkSoft: '#5b3b1f', inkFaint: '#80603e',
  red: '#8e1a10', redHi: '#b52418', redDeep: '#5a0a06',
  yellow: '#f4e04c', yellowDeep: '#c8a52a', goldLeaf: '#d8b04a',
  cream: '#efdcae', page: '#e3c995', scroll: '#c99a5c', tan: '#b3834a',
  wood: '#3a2414', woodDark: '#1c1108', woodLit: '#7a5230', woodMid: '#53351d',
  outline: '#140b04',
});
const T = GRIM_TONES;

// ── THE INK: colour, read and re-said ────────────────────────────────────────────────────────────────────────────────
/** The enhanced sheet's own :root colours (ui/enhanced/enhancedStyle.js), resolved before a value is re-said, so a `var(--bone)`
 *  word is inked as #e9e4d9 would be. */
export const ENHANCED_VARS = Object.freeze({
  '--ink': '#0e1013', '--slate': '#171b21', '--iron': '#2b323b', '--bone': '#e9e4d9', '--dim': '#9a9486',
  '--brass': '#c08a3e', '--blood': '#8c3a32', '--ruby': '#b91309', '--verdigris': '#4e7f72', '--emerald': '#2c7341',
  '--cinnabar': '#bf2a1f',
});
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
/** A CSS colour as [r, g, b, a], or null. */
export function parseColour(s) {
  const t = String(s).trim().toLowerCase();
  if (Object.hasOwn(NAMED, t)) return [...NAMED[t]];
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return [...h].map((c, i) => (i < 3 ? parseInt(c + c, 16) : parseInt(c + c, 16) / 255)).concat(h.length === 3 ? [1] : []);
    if (h.length === 6 || h.length === 8) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat([h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]);
    return null;
  }
  m = /^rgba?\(([^)]*)\)$/.exec(t);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const ch = p.slice(0, 3).map((v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v)));
    const a = p[3] == null ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    return ch.some(Number.isNaN) || Number.isNaN(a) ? null : [...ch, a];
  }
  return null;
}
function hsl([r, g, b]) {
  const R = r / 255, Gc = g / 255, B = b / 255, mx = Math.max(R, Gc, B), mn = Math.min(R, Gc, B), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === R ? ((Gc - B) / d + (Gc < B ? 6 : 0)) : mx === Gc ? (B - R) / d + 2 : (R - Gc) / d + 4;
  return [h * 60, s, l];
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const hsla = (h, s, l, a) => (a >= 1 ? `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)` : `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${r3(a)})`);
/** How much colour a colour has, 0..1 (its max channel less its min) - HSL saturation calls a near-white bone
 *  "saturated", chroma does not. */
const chroma = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
/** Daggerfall's own yellow, which the pack keeps on its pages for a value (its sheet's "Gold: 7579", its bank's
 *  balance, a speaker's words) - always with its hard dark edge. */
export const GRIM_YELLOW = '#f4e04c';
export const YELLOW_EDGE = '1px 1px 0 #3a2400, 2px 2px 0 rgba(58,36,0,0.35)';
/** THE PIXEL GRID. The pack's face is drawn on a 16-unit em (1024 units, every point on a multiple of 64): at 16, 32 or
 *  48 pixels each of its pixels is whole screen pixels and the letter is as hard-edged as the pack's own; at any other
 *  size it smears. Every size the enhanced sheets set is moved to the nearest whole grid. */
export const GRID_SIZES = Object.freeze([16, 32, 48]);
export const snapSize = (px) => (px <= 20 ? 16 : px <= 40 ? 32 : 48);
/** How light a colour reads, 0..1 (Rec. 601 luma). */
const luma = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** A WORD's colour on the page: light words become ink, darker the brighter they were; gold and yellow (Plus's
 *  "chosen", "worth reading") the pack's red; a hue keeps its hue as a darker ink. A word already dark stands. */
export function inkColour(c) {
  const v = parseColour(c); if (!v) return null;
  const [r, g, b, a] = v;
  if (a === 0) return null;
  const L = luma(v);
  if (L < 0.42) return null;
  const [h, s] = hsl([r, g, b]);
  const t = Math.min(1, (L - 0.42) / 0.5);
  if (chroma(v) < 0.16) return hsla(26, 0.6, 0.21 - 0.13 * t, a);                       // bone and parchment: the pack's brown ink, dark enough to read on any of its pages
  if (h >= 50 && h <= 72 && chroma(v) > 0.5) return a >= 1 ? GRIM_YELLOW : `rgba(244, 224, 76, ${r3(a)})`;   // Daggerfall's yellow stays its yellow, as the pack writes a value on its page
  if (h >= 38 && h <= 72) return hsla(5, 0.8, 0.29, a);                        // gold and brass: the pack's red
  if (h >= 18 && h < 38) return hsla(h, 0.72, readableL(h, 0.72, 0.24), a);    // brass and amber: a dark amber
  const sat = Math.max(0.55, Math.min(0.85, s));
  return hsla(h, sat, readableL(h, sat, 0.25), a);                              // a hue (a rarity, a gain, a loss): its ink
}
/** INK-READ (2026-10-12, Mac: "make sure the fonts are readable the grey ones arent"): the lightness a hue's ink may have
 *  and still read at 4.5:1 on the pages' darkest tan (relative luminance 0.43): `want` or darker, a hundredth at a time
 *  - an amber at 24% stood at 3.96:1 (the credits' "by ...", the settings' heads), a teal at 25% at 3.3:1. */
const INK_LUMA_MAX = 0.055;
function readableL(h, s, want) {
  let l = want;
  for (; l > 0.08; l -= 0.01) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const lin = (v) => { const u = v + m; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
    if (0.2126 * lin(r1) + 0.7152 * lin(g1) + 0.0722 * lin(b1) <= INK_LUMA_MAX) break;
  }
  return Math.round(l * 100) / 100;
}
/** A WORD's colour on the wood: Plus's grey words (its bone, its dim) warmed to the pack's tan and cream - the way it
 *  letters "Amulets" or "Rings" on its shelves - and never left darker than the tan. A hue (gold, a rarity) stands. */
export function woodColour(c) {
  const v = parseColour(c); if (!v) return null;
  const [, , , a] = v;
  if (a === 0 || chroma(v) >= 0.16) return null;
  const L = luma(v);
  if (L < 0.3) return null;
  return hsla(40, 0.5, Math.max(0.66, Math.min(0.9, L * 0.95 + 0.04)), a);
}
/** A GROUND or an EDGE on the wood: Plus's cool slate and navy warmed to the wood's brown at the same lightness and
 *  alpha, so a dark band inside a shelf box reads as its shadow, never as a blue hole in it. A strong hue stands. */
export function woodWash(c) {
  const v = parseColour(c); if (!v) return null;
  const [, , , a] = v;
  if (a === 0 || chroma(v) >= 0.22) return null;
  const L = luma(v);
  if (L > 0.75) return null;
  return hsla(28, 0.42, Math.max(0.03, L * 0.95), a);
}
/** A GROUND's colour on the page: a dark ground becomes a faint brown wash (a box on a page is a stain, not a slab),
 *  a coloured dark one keeps its hue as a tint; a light ground stands. */
export function washColour(c) {
  const v = parseColour(c); if (!v) return null;
  const [r, g, b, a] = v;
  if (a === 0) return null;
  const L = luma(v);
  if (L >= 0.35) return null;
  const [h, s] = hsl([r, g, b]);
  if (chroma(v) >= 0.12 && L > 0.08) return hsla(h, Math.min(0.7, s), 0.42, a * 0.3);
  return hsla(30, 0.45, 0.32, Math.min(0.2, a * 0.16));
}
/** A LINE's colour on the page (borders, outlines, a box's shadow): dark becomes a brown line, a stone bevel's mid grey
 *  a lighter brown; a hue keeps its hue, darker. */
export function lineColour(c, shadow = false) {
  const v = parseColour(c); if (!v) return null;
  const [r, g, b, a] = v;
  if (a === 0) return null;
  const L = luma(v);
  const [h, s] = hsl([r, g, b]);
  if (chroma(v) >= 0.16) return L > 0.45 ? hsla(h >= 38 && h <= 72 ? 5 : h, Math.min(0.8, s), 0.34, a) : null;
  if (L < 0.35) return hsla(26, 0.5, 0.17, shadow ? a * 0.45 : Math.min(1, a * 0.75));
  return hsla(30, 0.38, 0.42, a);
}
const COLOUR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;
/** INK-VARS (2026-10-11, the Social panel on the page: "those fonts need to be made readable"): THE COLOURS A SHEET
 *  NAMES FOR ITSELF. A var the enhanced root does not hold (the Arena window's `--mute`, the stat card's `--sf-dim`) is
 *  read as the one colour the sheets define it as - learned off every sheet before it is inked (learnSheetVars). A
 *  name defined as two different colours (a rarity's `--rar`, a hotbar slot's `--hb-acc`: one per kind) is the
 *  element's own and is never pinned; a Plus colour's own re-definition (Stone's) is not the dress's and is not read. */
const SHEET_VARS = new Map();
const AMBIGUOUS = Symbol('ambiguous');
const VAR_DEF = /(?:^|[;{\s])(--[a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*(?:!important\s*)?(?=;|$)/gi;
/** Learn the colours a sheet's rules define for their own vars (see SHEET_VARS). */
export function learnSheetVars(css) {
  const text = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const inner = text.slice(open + 1, j - 1);
    i = j;
    if (/^@(media|supports)\b/.test(prelude)) { learnSheetVars(inner); continue; }
    if (prelude.startsWith('@') || /data-plus-theme|data-plus-dress/.test(prelude)) continue;
    for (const m of inner.matchAll(VAR_DEF)) {
      const name = m[1], val = m[2].toLowerCase().replace(/\s+/g, '');
      if (Object.hasOwn(ENHANCED_VARS, name)) continue;
      const was = SHEET_VARS.get(name);
      SHEET_VARS.set(name, was === undefined || was === val ? val : AMBIGUOUS);
    }
  }
}
/** The colour a var stands for on the dressed page: the enhanced root's own, else the sheets' one definition. */
const knownVar = (name) => { const s = SHEET_VARS.get(name); return ENHANCED_VARS[name] ?? (s === AMBIGUOUS ? undefined : s); };
/** Every `var(--name)` and `var(--name, fallback)` whose colour is known, written as that colour. A FALLBACK IS NOT
 *  THE COLOUR: `var(--dim, #9a9486)` re-said as `var(--dim, <ink>)` still drew --dim's light grey on the page, since
 *  --dim is always set - which is how every word of the Social panel, the letters and the guild page stayed bone and
 *  grey on the parchment. An unknown var keeps its place, its fallback read in turn. */
export function varsOut(v) {
  let out = '', i = 0;
  for (;;) {
    const k = v.indexOf('var(', i);
    if (k < 0) return out + v.slice(i);
    let d = 0, j = k + 3;
    for (; j < v.length; j++) { if (v[j] === '(') d++; else if (v[j] === ')' && --d === 0) break; }
    if (j >= v.length) return out + v.slice(i);
    const inner = v.slice(k + 4, j), comma = inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const known = knownVar(name);
    out += v.slice(i, k) + (known ?? `var(${name}${comma < 0 ? '' : `,${varsOut(inner.slice(comma + 1))}`})`);
    i = j + 1;
  }
}
/** Every colour in a value re-said by `fn` (a token `fn` leaves alone stands as written). */
export function mapColours(value, fn) {
  let changed = false;
  const out = varsOut(value).replace(COLOUR_TOKEN, (tok) => { const n = fn(tok); if (n == null) return tok; changed = true; return n; });
  return changed ? out : null;
}

// ── THE SCOPES ───────────────────────────────────────────────────────────────────────────────────────────────────────
const R = FRAME_ROLES;
/** PARCHMENT: the surfaces that ARE a page - a window, a box inside it, a rail - and the full screens the enhanced skin
 *  writes on (the menus' shell, the chargen wizard). Words inside them are inked. */
export const INK_ROOTS = Object.freeze([...new Set([...R.window, ...R.windowGround, ...R.panel, ...R.railRight, ...R.railLeft,
  '.shell .detail'])]);
/** WOOD: the surfaces inside a page that are NOT page - a press, a shelf box, a band, a socket, a field, a tab. Words
 *  inside them keep Plus's light colours, which is what the pack writes on its wood. */
export const WOOD_ROOTS = Object.freeze([...new Set([...R.button, ...R.primary, ...R.warn, ...R.tile, ...R.chip, ...R.well,
  ...R.input, ...R.header, ...R.footer, ...R.tabs, ...R.chosen])]);
const list = (sels, suffix = '') => sels.map((s) => `${s}${suffix}`).join(', ');
/** THE MARKS. The two scopes are written as an attribute the dress stamps on each surface as it lands
 *  (`data-grim="ink"` on a page, `"wood"` on a wooden piece - markGrimoireSurfaces below), not as the selector lists
 *  themselves: spelled into every re-said rule, the lists made the ink thirty megabytes. */
export const INK_MARK = '[data-grim="ink"]', WOOD_MARK = '[data-grim="wood"]';
const IN_INK = `:is(${INK_MARK}, ${INK_MARK} *)`;
const NOT_WOOD = `:not(${WOOD_MARK}, ${WOOD_MARK} *)`;
const IN_WOOD = `:is(${WOOD_MARK}, ${WOOD_MARK} *)`;
/** a role surface itself: its OWN ground, frame and edge are the kit's to paint, never the ink's */
const NOT_SURFACE = ':not([data-grim])';
/** THE DESK: the full screens (the menus' shell, the chargen wizard, the front door, the Ascend) - what stands on them
 *  outside any surface (a pane's headings, a list's words, a filter strip) is lettered as the pack letters its wood. */
export const DESK_ROOTS = Object.freeze(['.shell', '.wizard', '.px-home', '.lv-sky']);
const ON_DESK = ':is([data-grim-desk] *):not([data-grim], [data-grim] *)';
const INK_SEL = INK_ROOTS.join(', '), WOOD_SEL = WOOD_ROOTS.join(', '), DESK_SEL = DESK_ROOTS.join(', ');
/** The presses the dress writes as words (the kit's button role, less the menus' own doors and the tab plates). */
export const PRESS_ROOTS = Object.freeze(R.button.filter((s) => !/doorbtn|packtab/.test(s)));
const PRESS_SEL = PRESS_ROOTS.join(', ');
/** A press whose word is the way out of its window. */
/** A press whose word takes you back out of a question (the pack writes it red, over a red rule). */
export const CANCEL_WORDS = /^\s*(?:\S\s*)?(cancel|stop|back|no|never ?mind)\s*$/i;
/** The eight attributes' words (a sheet row whose word is one is an attribute's, drawn as a skill's bar). */
export const ATTRIBUTE_WORD = /^\s*(strength|intelligence|willpower|agility|endurance|personality|speed|luck)\s*$/i;
/** The three vitals' words (a sheet row whose word is one is drawn as the HUD's own vial). */
export const VITAL_WORD = /^\s*(health|fatigue|magicka)\s*$/i;
/** A dial door's word, and the symbol it is drawn as (ui/grimoireArt.js DIAL_ICONS). */
export const DIAL_WORD = new RegExp(`\\b(${Object.keys(DIAL_ICONS).join('|')})\\b`, 'i');
export const EXIT_WORDS = /^\s*(?:\S\s*)?(close|exit|done|leave)\s*$/i;   // a key's cap before the word ("E Leave") counts
/** Stamp every role surface in `root` (and `root` itself): wood first, so a surface in both lists is wood. Answers how
 *  many it stamped. */
export function markGrimoireSurfaces(root) {
  let n = 0;
  const stamp = (el, kind) => { if (el.dataset && el.dataset.grim !== kind) { el.dataset.grim = kind; n++; } };
  const each = (sel, kind) => {
    if (root.matches?.(sel)) stamp(root, kind);
    for (const el of root.querySelectorAll?.(sel) ?? []) stamp(el, kind);
  };
  each(INK_SEL, 'ink');
  each(WOOD_SEL, 'wood');
  const desk = (el) => { if (el.dataset && el.dataset.grimDesk == null) { el.dataset.grimDesk = ''; n++; } };
  if (root.matches?.(DESK_SEL)) desk(root);
  for (const el of root.querySelectorAll?.(DESK_SEL) ?? []) desk(el);
  // a press is written on the ground it stands on - the nearest page or wood above it (a desk, or nothing, is wood)
  const press = (el) => {
    let p = el.parentElement;
    while (p && p.dataset && p.dataset.grim == null && p.dataset.grimDesk == null) p = p.parentElement;
    const on = p?.dataset?.grim === 'ink' ? 'page' : 'wood';
    if (el.dataset.grimOn !== on) { el.dataset.grimOn = on; n++; }
    // the way out of a window wears the pack's Exit, whatever its sheet calls it
    if (EXIT_WORDS.test(el.textContent ?? '') && el.dataset.grimExit == null) { el.dataset.grimExit = ''; n++; }
    if (CANCEL_WORDS.test(el.textContent ?? '') && el.dataset.grimCancel == null) { el.dataset.grimCancel = ''; n++; }
  };
  if (root.matches?.(PRESS_SEL)) press(root);
  for (const el of root.querySelectorAll?.(PRESS_SEL) ?? []) press(el);
  // GRIM4: an attribute's row on the sheet (its word one of the eight) - drawn as a skill's bar is, never as a vial; a
  // vital's (Health, Fatigue, Magicka) - drawn as the HUD's own vial
  const mrows = root.matches?.('.px-mrow') ? [root] : [...(root.querySelectorAll?.('.px-mrow') ?? [])];
  for (const r of mrows) {
    const word = r.querySelector?.('.px-mtop .k')?.textContent ?? '';
    const kind = ATTRIBUTE_WORD.test(word) ? 'attr' : VITAL_WORD.test(word) ? 'vital' : null;
    if (kind && r.dataset && r.dataset.grimMeter !== kind) { r.dataset.grimMeter = kind; n++; }
  }
  // GRIM4: each of the Tab dial's doors is its symbol, by the door's own word (whatever direction a host hangs it on)
  const arms = root.matches?.('.px-dial .px-arm') ? [root] : [...(root.querySelectorAll?.('.px-dial .px-arm') ?? [])];
  for (const arm of arms) {
    const k = DIAL_WORD.exec(arm.textContent ?? '')?.[1]?.toLowerCase();
    if (k && arm.dataset && arm.dataset.grimIcon !== k) { arm.dataset.grimIcon = k; n++; }
  }
  return n;
}

// ── GRIM3: THE UNROLLING SCROLL ───────────────────────────────────────────────────────────────────────────────────────
/** One beat: a scroll taken away and drawn again inside it is the same scroll re-said (every screen of the enhanced skin
 *  rebuilds itself whole), already open. */
export const UNROLL_BEAT_MS = 250;
const nowMs = () => globalThis.performance?.now?.() ?? Date.now();
const reducedMotion = (doc) => !!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
/** When a scroll was last taken away. */
let _scrollGoneAt = -Infinity;
/** Note a node taken off the page (the observer's removed nodes): a scroll among it was re-said, not opened; a book
 *  among it was re-said (a tab or a page pressed) or closed. */
export function noteGrimoireRemoved(node) {
  if (node?.matches?.(UNROLL_SEL) || node?.querySelector?.(UNROLL_SEL)) _scrollGoneAt = nowMs();
  if (_book?.el && node && (node === _book.el || node.contains?.(_book.el))) _book.goneAt = nowMs();
}

// ── GRIM3: THE BOOK'S NOISES ──────────────────────────────────────────────────────────────────────────────────────────
// A player: "I REQUIRE the little book noises to stay INTACT" - and then, with a video of it: "I was thinking mostly
// spellbook". GrimoireUI is worn over the classic spellbook, which opens with Daggerfall's OpenBook and shuts with its
// PageTurn (ui/spellbookWindow.js OnPush / OnPop); choosing a spell in it is silent. The enhanced spellbook never played
// either; under this dress it plays both, as the classic does - and no other book makes a sound it did not make.
/** The book last drawn: its window, its open tab and page, the element, and when it was taken away. */
let _book = null;
/** A book drawn again inside this beat of its last drawing being taken away is that book re-said. */
export const BOOK_BEAT_MS = 250;
/** What a newly drawn book sounds: 'open' (a book opened), 'turn' (its tab or its page changed), or null (the same page
 *  drawn again). */
export function bookSound(was, now, t = nowMs()) {
  const redrawn = was && was.kind === now.kind && was.goneAt != null && t - was.goneAt <= BOOK_BEAT_MS;
  if (!redrawn) return 'open';
  return was.tab !== now.tab || was.row !== now.row ? 'turn' : null;
}
let _audio = null;
/** Play one of the game's clips, at the player's own volume (lazily: the sound system loads with the game). */
function playClip(name) {
  (_audio ??= Promise.all([import('../systems/audio.js'), import('../systems/soundClips.js')]).catch(() => null))
    .then((m) => { if (m) m[0].audio?.playOneShot?.(m[1].SOUND[name], 1); })
    .catch(() => {});
}
/** Read each newly drawn book and sound it. */
export function markGrimoireBook(root) {
  const books = root.matches?.('.px-journal') ? [root] : [...(root.querySelectorAll?.('.px-journal') ?? [])];
  for (const j of books) {
    if (j.dataset.grimBook != null) continue;
    j.dataset.grimBook = '';
    const win = j.closest?.('.px-win'), shell = j.closest?.('.sb-shell, .cr-shell, .px-home');
    const on = (list) => list.find((b) => b.classList.contains('on'))?.textContent.trim() ?? '';
    const now = { el: j, kind: `${shell?.className ?? ''}|${win?.className ?? ''}`, spellbook: !!j.closest?.('.sb-shell'),
      tab: on(win ? [...win.querySelectorAll(':scope > .px-tabs button')] : []), row: on([...j.querySelectorAll(':scope > .px-qrail .px-qrow')]) };
    const sound = bookSound(_book, now);
    _book = now;
    if (now.spellbook && sound === 'open') playClip('OpenBook');
  }
}
/** A book taken away and not drawn again inside the beat was closed: the spellbook shuts with its page-turn. */
function bookClosedCheck() {
  const was = _book;
  if (!was?.spellbook || was.goneAt == null) return;
  setTimeout(() => { if (_book === was && !was.el.isConnected) { playClip('PageTurn'); _book = null; } }, BOOK_BEAT_MS + 20);
}

// ── GRIM3: THE SCROLL ROLLS SHUT ──────────────────────────────────────────────────────────────────────────────────────
/** Where each open scroll stands on the screen (kept as it lands and as it changes size), so a closed one can be rolled
 *  up where it stood after it is gone. */
const _scrollBox = new WeakMap();
let _scrollRO = null;
function keepScrollBox(w) {
  const doc = w.ownerDocument, RO = doc.defaultView?.ResizeObserver;
  const take = () => { const r = w.getBoundingClientRect(); if (r.width && r.height) _scrollBox.set(w, { left: r.left, top: r.top, width: r.width, height: r.height }); };
  take();
  if (typeof RO === 'function') { _scrollRO ??= new RO((es) => { for (const e of es) { const r = e.target.getBoundingClientRect(); if (r.width) _scrollBox.set(e.target, { left: r.left, top: r.top, width: r.width, height: r.height }); } }); _scrollRO.observe(w); }
}
/** A scroll closed (taken away with no scroll drawn in its place): its likeness rolls back up where it stood - the
 *  parchment drawn in between its rods as they come together - and is gone. */
export function rollUpGrimoireScroll(node, doc, from = null) {
  if (reducedMotion(doc)) return;
  // A WHOLE OVERLAY TAKEN OFF THE PAGE (the rest window's host, fixed over the screen): its likeness is the overlay
  // itself, put back as it was for the beat - the scroll keeps every rule its shell gave it (its size, its writing), so
  // it rolls up exactly as it stood instead of a lookalike that jumped first (Dudey: "it still doesnt close properly like
  // a scroll")
  if (from === doc.body && !node.matches?.(UNROLL_SEL) && node.style?.position === 'fixed') {
    const inner = [...(node.querySelectorAll?.(UNROLL_SEL) ?? [])];
    if (inner.length) {
      const g = node.cloneNode(true);
      g.removeAttribute('id'); g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      g.setAttribute('aria-hidden', 'true'); g.style.pointerEvents = 'none'; g.dataset.grimGhost = '';
      for (const w of g.querySelectorAll(UNROLL_SEL)) {
        w.querySelectorAll(':scope > .grim-rod').forEach((r) => r.remove());
        w.dataset.grimUnroll = 'closing';
        w.style.setProperty('--uw', `${_scrollBox.get(inner[0])?.width ?? 0}px`);
        for (const sd of ['l', 'r']) { const r = doc.createElement('i'); r.className = `grim-rod ${sd}`; w.append(r); }
      }
      doc.body.append(g);
      const gone = () => g.remove();
      g.addEventListener('animationend', (e) => { if (e.target.dataset?.grimUnroll === 'closing') gone(); });
      setTimeout(gone, 900);
      return;
    }
  }
  const scrolls = node?.matches?.(UNROLL_SEL) ? [node] : [...(node?.querySelectorAll?.(UNROLL_SEL) ?? [])];
  for (const w of scrolls) {
    const box = _scrollBox.get(w);
    if (!box) continue;
    const g = w.cloneNode(true);
    g.querySelectorAll('.grim-rod').forEach((r) => r.remove());
    g.setAttribute('aria-hidden', 'true');
    g.dataset.grimUnroll = 'closing';
    Object.assign(g.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`,
      margin: '0', zIndex: '60', pointerEvents: 'none', transform: 'none', maxWidth: 'none', maxHeight: 'none', minWidth: '0', minHeight: '0', boxSizing: 'border-box' });
    g.style.setProperty('--uw', `${box.width}px`);
    for (const sd of ['l', 'r']) { const r = doc.createElement('i'); r.className = `grim-rod ${sd}`; g.append(r); }
    doc.body.append(g);
    const gone = () => g.remove();
    g.addEventListener('animationend', (e) => { if (e.target === g) gone(); });
    setTimeout(gone, 900);
  }
}
/** THE SPINE'S ARROWS (GrimoireUI's own spellbook): two presses laid over the arrows the picture paints on its spine,
 *  turning the list of spells a page up or down. Stamped on each book as it lands; harmless while the card says the
 *  dress's book (the sheet shows them only on the pack's). */
export function markGrimoireSpellbook(root) {
  const wins = root.matches?.('.sb-shell > .px-win') ? [root] : [...(root.querySelectorAll?.('.sb-shell > .px-win') ?? [])];
  for (const w of wins) {
    if (w.querySelector(':scope > .grim-sbarrow')) continue;
    const doc = w.ownerDocument;
    for (const [dir, label] of [['up', 'Scroll the spells up'], ['down', 'Scroll the spells down']]) {
      const b = doc.createElement('button');
      b.type = 'button'; b.className = `grim-sbarrow ${dir}`; b.setAttribute('aria-label', label); b.textContent = label;
      b.onclick = (e) => {
        e.stopPropagation();
        const rail = w.querySelector('.px-qrail');
        rail?.scrollBy?.({ top: (dir === 'up' ? -1 : 1) * Math.max(40, rail.clientHeight * 0.8), behavior: 'auto' });
      };
      w.append(b);
    }
  }
}
/** THE SCROLL UNROLLS. A question or a short choice written on the pack's scroll (the rest window, a yes or no, a list
 *  to pick from) opens as a scroll does: its two rods together in the middle, rolling apart, the parchment between them
 *  coming into the light - the rods (cut from the scroll itself, ui/grimoireArt.js rodL/rodR) land exactly where the
 *  scroll's own rods are drawn, and are gone. */
/** Every window the dress draws as the pack's choice scroll: the rest window, a question (yes or no, a line to type, a
 *  list to pick from), a service's short menu (a guild hall's Join / Talk / Service, the coven's, the ships' and the
 *  houses' for sale, the transport's) and a confirm inside a window (a purchase, a sale, a spell deleted). */
export const UNROLL_SEL = '.rest-win, .dlg-win, .port-win.size-narrow, .sb-ask > .card, .px-setwrap .detail.open';   // SETTING-SCROLL: and a setting's words beside the book
export function markGrimoireUnroll(root) {
  const wins = root.matches?.(UNROLL_SEL) ? [root] : [...(root.querySelectorAll?.(UNROLL_SEL) ?? [])];
  for (const w of wins) {
    if (w.dataset.grimUnroll != null) continue;
    w.dataset.grimUnroll = '';
    const doc = w.ownerDocument;
    keepScrollBox(w);
    if (reducedMotion(doc) || nowMs() - _scrollGoneAt <= UNROLL_BEAT_MS) continue;
    w.style.setProperty('--uw', `${w.offsetWidth}px`);
    const rods = ['l', 'r'].map((s) => { const r = doc.createElement('i'); r.className = `grim-rod ${s}`; r.setAttribute('aria-hidden', 'true'); return r; });
    w.append(...rods);
    w.dataset.grimUnroll = 'open';
    const done = () => { rods.forEach((r) => r.remove()); if (w.dataset.grimUnroll === 'open') w.dataset.grimUnroll = 'done'; };
    rods[0].addEventListener('animationend', done);
    setTimeout(done, 1200);
  }
}

/** Where a selector's own compound ends and its pseudo-element begins (the scope is spliced in before it). */
function splice(sel, scope) {
  const m = /(::?(?:before|after|first-letter|first-line|placeholder|selection|marker|-webkit-[a-z-]+|-moz-[a-z-]+))+$/i.exec(sel);
  let head = m ? sel.slice(0, m.index) : sel;
  const tail = m ? m[0] : '';
  if (!head || /[\s>+~]$/.test(head)) head += '*';
  return `${head}${scope}${tail}`;
}
/** Selectors the ink never needs: another dress's or colour's, the root's own, and the HUD over the world (never on a
 *  page - leaving them out keeps the parchment's selectors off the HUD's per-frame restyles). */
/** A selector naming a chosen, open or pointed-at state. */
const STATE_SEL = /\.on\b|\.sel\b|\.active\b|\.open\b|:hover|:focus|\[aria-(pressed|selected|current)/;
const SKIP_INK = /data-plus-theme|data-plus-dress|^:root\b|^html\b|^body$|(^|\s)\.(hud|hb|lv-sky|px-ground|ld)\b|\.hud-|\.hb-/;

/** A declaration block split at its top-level semicolons (never inside a url() or a string). */
function decls(block) {
  const out = [];
  let depth = 0, q = null, at = 0;
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (q) { if (c === q && block[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) { out.push(block.slice(at, i)); at = i + 1; }
  }
  out.push(block.slice(at));
  return out.map((d) => {
    const k = d.indexOf(':');
    return k < 0 ? null : { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() };
  }).filter((d) => d && d.prop && d.value);
}
function splitSelectors(prelude) {
  const out = [];
  let depth = 0, at = 0;
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { out.push(prelude.slice(at, i).trim()); at = i + 1; }
  }
  out.push(prelude.slice(at).trim());
  return out.filter(Boolean);
}
const PIXEL_FACE = /'Pixelify Five',\s*'Pixelify Sans'|'Pixelify Sans'|"Pixelify Sans"|var\(--(display|data|brand)\)|'Cormorant'|'Barlow Semi Condensed'|'Grenze Gotisch'/;
const important = (v) => (/!important\s*$/.test(v) ? ' !important' : '');
const bare = (v) => v.replace(/\s*!important\s*$/, '');

/** One rule's declarations re-said: the FACE ones (for everywhere) and the INK ones (words, for a page) and the WASH
 *  ones (grounds and edges, for a page, never a surface's own). Each a declaration string, possibly empty. */
export function sayRule(block, { state = false } = {}) {
  const face = [], ink = [], wash = [], wood = [], woodGround = [];
  let yellowEdge = null;
  for (const { prop, value } of decls(block)) {
    const imp = important(value), v = bare(value);
    if ((prop === 'font-family' || prop === 'font') && PIXEL_FACE.test(v)) {
      // `font` shorthand: its size (and line height, weight, style) stand, its family list is the pack's face
      face.push(`${prop}: ${prop === 'font' ? `${v.slice(0, v.search(PIXEL_FACE)).trimEnd()} ${GRIMOIRE_STACK}`.trim() : GRIMOIRE_STACK}${imp}`);
      if (prop === 'font-family') face.push('-webkit-font-smoothing: none', 'font-synthesis: none', 'font-variant-ligatures: normal');
    } else if (prop === 'text-transform' && /uppercase/.test(v)) face.push(`text-transform: none${imp}`);
    else if (prop === 'font-size') {
      const m = /^([\d.]+)px$/.exec(v);
      if (m) face.push(`font-size: ${snapSize(+m[1])}px${imp}`);
    } else if (prop === 'font-weight' && (/bold/.test(v) || +v >= 500)) face.push(`font-weight: 400${imp}`);   // the pack's face has one weight; a made-up bold smears it
    // Plus's diamonds - beside a chosen tab, a chosen rail row, a step done - go: the pack marks a choice by its red
    else if (prop === 'content' && /^(['"])(?:\\25c[67]\s*|[\u25c6\u25c7]\s*)+\1$/i.test(v.trim())) face.push(`content: none${imp}`);
    else if (prop === 'letter-spacing') {
      // a part-pixel of tracking moves every letter off the grid: whole pixels stand, the rest goes
      const m = /^(-?[\d.]+)(em|px)$/.exec(v);
      if (m && +m[1] !== 0 && !(m[2] === 'px' && Number.isInteger(+m[1]) && +m[1] <= 2)) face.push(`letter-spacing: 0${imp}`);
    } else if (prop === 'color' || prop === '-webkit-text-fill-color' || prop === 'caret-color') {
      // a CHOSEN or pointed-at word (a rail's open row, a hovered line) is the pack's red, as its talk window marks
      // "Where is..." and the line you picked; a VALUE keeps Daggerfall's yellow, as its sheet writes "Gold: 7579"
      const n = mapColours(v, (t) => { const c = inkColour(t); return state && c && /#f4e04c|rgba\(244, 224, 76/.test(c) ? hsla(5, 0.8, 0.29, parseColour(t)[3]) : c; });
      if (n) ink.push(`${prop}: ${n}${imp}`);
      if (prop === 'color' && n && /#f4e04c|rgba\(244, 224, 76/.test(n)) yellowEdge = `text-shadow: ${YELLOW_EDGE}${imp}`;
      const w = mapColours(v, woodColour); if (w) wood.push(`${prop}: ${w}${imp}`);
    } else if (prop === 'text-shadow') {
      const toks = varsOut(v).match(COLOUR_TOKEN) ?? [];
      if (toks.length && toks.every((t) => { const c = parseColour(t); return c && luma(c) < 0.4; })) ink.push(`text-shadow: none${imp}`);
    } else if (prop === 'background' || prop === 'background-color' || prop === 'background-image') {
      const n = mapColours(v, washColour); if (n) wash.push(`${prop}: ${n}${imp}`);
      const w = mapColours(v, woodWash); if (w) woodGround.push(`${prop}: ${w}${imp}`);
    } else if (/^(border(-(top|right|bottom|left))?(-color)?|outline(-color)?|column-rule(-color)?)$/.test(prop)) {
      const n = mapColours(v, (t) => lineColour(t)); if (n) wash.push(`${prop}: ${n}${imp}`);
      const w = mapColours(v, woodWash); if (w) woodGround.push(`${prop}: ${w}${imp}`);
    } else if (prop === 'box-shadow') {
      const n = mapColours(v, (t) => lineColour(t, true)); if (n) wash.push(`${prop}: ${n}${imp}`);
    }
  }
  if (yellowEdge) ink.push(yellowEdge);
  return { face: face.join('; '), ink: ink.join('; '), wash: wash.join('; '), wood: wood.join('; '), woodGround: woodGround.join('; ') };
}

/** THE INK, for one sheet: every rule re-said under the dress's scope. Comments go, @keyframes and @font-face are left
 *  out (a keyframe's colour is a moment of an animation, never a page's), @media and @supports are kept round what they
 *  hold. */
export function inkCss(css) {
  const text = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  learnSheetVars(text);   // INK-VARS: a sheet's own colours are known before its words are re-said
  let out = '', i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const inner = text.slice(open + 1, j - 1);
    i = j;
    if (/^@(media|supports)\b/.test(prelude)) { const kept = inkCss(inner); if (kept) out += `${prelude} {\n${kept}}\n`; continue; }
    if (prelude.startsWith('@')) continue;
    const all = splitSelectors(prelude);
    const groups = [[all.filter((x) => !STATE_SEL.test(x)), false], [all.filter((x) => STATE_SEL.test(x)), true]];
    for (const [sels, state] of groups) {
      if (!sels.length) continue;
      const said = sayRule(inner, { state });
      if (!said.face && !said.ink && !said.wash && !said.wood && !said.woodGround) continue;
      if (said.face) out += `${sels.map((s) => (/^(:root|html)\b/.test(s) ? s.replace(/^(:root|html)/, G) : `${G} ${s}`)).join(',\n')} { ${said.face} }\n`;
      const paged = sels.filter((x) => !SKIP_INK.test(x));
      if (!paged.length) continue;
      if (said.ink) out += `${paged.map((s) => `${G} ${splice(s, `${IN_INK}${NOT_WOOD}`)}`).join(',\n')} { ${said.ink} }\n`;
      if (said.wash) out += `${paged.map((s) => `${G} ${splice(s, `${IN_INK}${NOT_WOOD}${NOT_SURFACE}`)}`).join(',\n')} { ${said.wash} }\n`;
      if (said.wood) out += `${paged.map((s) => `${G} ${splice(s, IN_WOOD)}`).join(',\n')} { ${said.wood} }\n`;
      if (said.woodGround) out += `${paged.map((s) => `${G} ${splice(s, `${IN_WOOD}${NOT_SURFACE}`)}`).join(',\n')} { ${said.woodGround} }\n`;
      const onDesk = [said.wood, said.woodGround].filter(Boolean).join('; ');
      if (onDesk) out += `${paged.map((s) => `${G} ${splice(s, ON_DESK)}`).join(',\n')} { ${onDesk} }\n`;
    }
  }
  return out;
}

// ── THE FACE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const faceCss = (url = grimoireFontUrl()) => `
@font-face { font-family: '${GRIMOIRE_FAMILY}'; src: url("${url}") format('truetype'); font-display: swap; }
${G} { --display: ${GRIMOIRE_STACK}; --data: ${GRIMOIRE_STACK}; --brand: ${GRIMOIRE_STACK}; -webkit-font-smoothing: none; font-synthesis: none; }
${G} body, ${G} .hud, ${G} #enhanced-menu, ${G} .shell, ${G} .px-win { font-family: ${GRIMOIRE_STACK}; }`;

// ── THE KIT ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const at = (sels, suffix = '') => sels.map((s) => `${G} ${s}${suffix}`).join(',\n');
const v = (name, fallback = 'none') => `var(${artVar(name)}, ${fallback})`;
// GRIM3: THE GRID. Every length a picture is drawn at is a whole number of the game's pixels: `px(n)` is n of them at
// the screen's scale (`--gp`, ui/grimoireArt.js layGrimoireGrid), `px(n, 'gq')` at the half scale the small presses
// wear, `px(n, 'gc')` at the front door's cover scale. A picture's own size is its size on the game's grid (nativeSize).
const GRID_FALLBACK = { gp: 3, gq: 2, gk: 1, gs: 3, gc: 5, gd: 4, gfoe: 1.45, gboss: 2.05 };   // BAR-SCREEN: the foe's and the boss's glass (below)
export const px = (n, u = 'gp') => `calc(${n} * var(--${u}, ${GRID_FALLBACK[u]}px))`;
/** n of the game's pixels at the SCREEN's scale - for a full screen (the Ascend), which grows with the screen. */
const pxs = (n) => px(n, 'gs');
const tile = (name, fallback) => `${v(name)} 0 0 / ${px(nativeSize(name)[0])} auto repeat, ${fallback}`;
const PAGE = tile('page', T.page);
const SCROLL = tile('scroll', T.scroll);
const WOOD = (dim = 0.18) => `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ${tile('wood', T.wood)}`;
/** The pack's leather press (the Options window's Save Game / Continue plates): its wood under a red-brown stain. */
const PLATE = `linear-gradient(180deg, rgba(255,196,120,0.22) 0 2px, transparent 2px calc(100% - 3px), rgba(0,0,0,0.38) calc(100% - 3px)), linear-gradient(rgba(120,44,18,0.66), rgba(78,26,10,0.74)), ${tile('wood', '#6a2a14')}`;
const PLATE_HI = `linear-gradient(180deg, rgba(255,214,150,0.3) 0 2px, transparent 2px calc(100% - 3px), rgba(0,0,0,0.3) calc(100% - 3px)), linear-gradient(rgba(150,58,24,0.6), rgba(100,34,12,0.7)), ${tile('wood', '#7a3418')}`;
/** A book page: GRIM3, the pack's own painted page (BIOG00I0's book, cut down its spine) as a 9-slice - its corners as
 *  painted, its edges and the gutter's curve drawn along the page at the grid's pixels, its paper filling the middle -
 *  so the page has the painting's depth at any size and is never deformed. `side` is which page of the spread. */
const { top: BT, bottom: BB, outer: BO, gutter: BG } = BOOK_SLICE;
export const bookPage = (side, u = 'gp') => {
  const [r, l] = side === 'left' ? [BG, BO] : [BO, BG];
  const q = (n) => px(n, u);
  return `background: #d9bc86; border-style: solid; border-width: ${q(BT)} ${q(r)} ${q(BB)} ${q(l)};
  border-image: ${v(side === 'left' ? 'bookL' : 'bookR')} ${BT} ${r} ${BB} ${l} fill / ${q(BT)} ${q(r)} ${q(BB)} ${q(l)} stretch;`;
};
/** The vial as a bar of any length: its cork, then its tube repeated at its own pixels; the drained glass for the track. */
const tube = (kind, empty = false) => `${v('vialCork')} 0 0 / ${px(VIAL_CUT.cork, 'gq')} 100% no-repeat,
  ${v(`vial${kind}Tube${empty ? 'Empty' : ''}`)} ${px(VIAL_CUT.cork, 'gq')} 0 / ${px(VIAL_CUT.tubeLen, 'gq')} 100% repeat-x`;
const VIAL_H = px(11, 'gq');
/** GRIM5: THE VIAL DRAWN OUT - its own head at the left, its own foot at the far end of the TRACK, its body drawn out
 *  between (ui/grimoireArt.js longBody: the vial's own course from shoulder to foot, over the whole length). The
 *  empty glass is the track itself (its foot at 100%); the liquid is inside the track, which is a size container, so a
 *  liquid that stops short still lays its foot at `100cqw`, where the glass ends - and is cut where it stops. */
const VIAL_FOOT = 86 - VIAL_CUT.footFrom;
const longVial = (kind, empty = false, u = 'gq') => { const e = empty ? 'Empty' : '', W = empty ? '100%' : '100cqw';
  return `${v(`vial${kind}Head${e}`)} 0 0 / ${px(VIAL_CUT.tubeFrom, u)} 100% no-repeat,
  ${v(`vial${kind}Foot${e}`)} ${empty ? '100%' : `calc(100cqw - ${px(VIAL_FOOT, u)})`} 0 / ${px(VIAL_FOOT, u)} 100% no-repeat,
  ${v(`vial${kind}Body${e}`)} ${px(VIAL_CUT.tubeFrom, u)} 0 / calc(${W} - ${px(VIAL_CUT.tubeFrom + VIAL_FOOT, u)}) 100% no-repeat`; };
/** VIAL-LONG: the UPRIGHT vial drawn out, in its track's own terms (the track lies cork to the right and the dress turns
 *  it up): its foot at the start, where the liquid rises from, its head at the track's end, its glass between. */
const longUp = (kind, empty = false, u = 'gq') => { const e = empty ? 'Empty' : '', W = empty ? '100%' : '100cqw';
  return `${v(`vial${kind}UpFoot${e}`)} 0 0 / ${px(VIAL_FOOT, u)} 100% no-repeat,
  ${v(`vial${kind}UpHead${e}`)} ${empty ? '100%' : `calc(100cqw - ${px(VIAL_CUT.tubeFrom, u)})`} 0 / ${px(VIAL_CUT.tubeFrom, u)} 100% no-repeat,
  ${v(`vial${kind}UpBody${e}`)} ${px(VIAL_FOOT, u)} 0 / calc(${W} - ${px(VIAL_CUT.tubeFrom + VIAL_FOOT, u)}) 100% no-repeat`; };
/** THE PACK'S RULE under a heading (GRIM3, Dudey: "what are those pointed lines under the journy the realm"): the
 *  spellbook's own hand-drawn ink stroke (ui/grimoireArt.js rule), its dotted ends kept at the pack's pixels and its
 *  stroke run along between them. */
// UI-CALM (2026-10-14, a player: "dotted line everywhere"): the stroke's dotted ends went with every dotted rule - a
// heading is ruled by one plain line of the page's brown ink, and every rule that was dotted is drawn whole
const RULE_UNDER = 'border-bottom: 2px solid rgba(92,56,24,0.5) !important; border-image: none !important;';
/** One of the pack's own pixels (a third of the game's), for a picture laid at the pack's own size. */
const pk = (n) => `calc(${n} * var(--gp, 3px) / 3)`;
/** The spellbook window, when the card says GrimoireUI's own. */
const SB = `${G}[data-grim-spellbook="pack"] .sb-shell`;
/** A PLANK: the desk's grain in a black outline, lit along its top and shaded along its foot by a pixel each. */
const PLANK = `linear-gradient(180deg, #0e0703 0 ${px(1)}, rgba(255,214,150,0.26) ${px(1)} ${px(2)}, rgba(0,0,0,0) ${px(2)} calc(100% - ${px(2)}),
    rgba(0,0,0,0.5) calc(100% - ${px(2)}) calc(100% - ${px(1)}), #0e0703 calc(100% - ${px(1)})),
  linear-gradient(90deg, #0e0703 0 ${px(1)}, rgba(255,214,150,0.14) ${px(1)} ${px(2)}, rgba(0,0,0,0) ${px(2)} calc(100% - ${px(2)}), rgba(0,0,0,0.4) calc(100% - ${px(2)}) calc(100% - ${px(1)}), #0e0703 calc(100% - ${px(1)})),
  linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), ${tile('wood', T.wood)}`;
/** A meter (the sheet's Health, Fatigue and Magicka, the Ascend's three) as its vial at its own pixels; a skill's or a
 *  level's thin bar as gold leaf in a groove. */
const meterCss = (scopes) => {
  const q = (x) => scopes.map((sc) => `${G} ${sc} ${x}`).join(', ');
  return `${q('.px-meter')} { height: ${VIAL_H} !important; border: 0 !important; border-radius: 0 !important; overflow: hidden;
  background: ${tube('Fatigue', true)}, #0a120a !important; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline}, ${px(1, 'gq')} ${px(2, 'gq')} 0 rgba(0,0,0,0.35) !important; }
${q('.px-meter:has(> .px-fill.blood)')} { background: ${tube('Health', true)}, #1a0a0a !important; }
${q('.px-meter:has(> .px-fill.verdigris)')} { background: ${tube('Magicka', true)}, #0a0e18 !important; }
${q('.px-fill')} { height: 100% !important; box-shadow: none !important; background: ${tube('Fatigue')}, #3a8a3a !important; }
${q('.px-fill.blood')} { background: ${tube('Health')}, #8a1c18 !important; }
${q('.px-fill.verdigris')} { background: ${tube('Magicka')}, #2f5fb4 !important; }
${q('.px-meter:has(> .px-fill.thin)')} { height: ${px(3, 'gq')} !important; background: rgba(40,22,8,0.55) !important; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline} !important; }
${q('.px-fill.thin')} { background: linear-gradient(180deg, #fff0a0 0 ${px(1, 'gq')}, ${T.goldLeaf} ${px(1, 'gq')} ${px(2, 'gq')}, #9a7420 ${px(2, 'gq')}) !important; }
/* MASTERY-INK (2026-10-20, Dudey: "dont use those thick green bars for mastery make them red and the same thickness as
   the yellow ones"): a mastered skill's climb past 100 is the thin bar's groove in red, not a Fatigue vial */
${q('.px-meter.px-over')} { height: ${px(3, 'gq')} !important; background: rgba(40,22,8,0.55) !important; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline} !important; }
${q('.px-fill.px-overfill')} { background: linear-gradient(180deg, #e8705c 0 ${px(1, 'gq')}, ${T.redHi} ${px(1, 'gq')} ${px(2, 'gq')}, ${T.redDeep} ${px(2, 'gq')}) !important; }
${q('.px-meter.px-over .px-tick')} { display: none; }
${q('.px-skillmeter')} { gap: ${px(2, 'gq')} !important; }
/* GRIM4 (Dudey: "the bars in the ascend and status screen also do not look like the player health/stam/mana bars"): a
   vital's row is the HUD's own vial; GRIM5 ("the vial bars are toooshort in the stat screen"): drawn out to the row's
   length - the vial's own head (cork and lit shoulder), its glass, and its own foot at the far end, each at the HUD's
   pixels (ui/grimoireArt.js VIAL_CUT). The track is a size container, so the liquid lays the foot at the TRACK's end
   (100cqw) however little of the vial it fills - the glass and the liquid one picture, the liquid cut where it stops. */
${q('.px-mrow[data-grim-meter="vital"] .px-meter')} { width: 100% !important; container-type: inline-size; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline} !important;
  filter: drop-shadow(${px(1, 'gq')} ${px(1, 'gq')} 0 rgba(0,0,0,0.55)); background: ${longVial('Fatigue', true)}, #0a120a !important; }
${q('.px-mrow[data-grim-meter="vital"] .px-meter:has(> .px-fill.blood)')} { background: ${longVial('Health', true)}, #1a0a0a !important; }
${q('.px-mrow[data-grim-meter="vital"] .px-meter:has(> .px-fill.verdigris)')} { background: ${longVial('Magicka', true)}, #0a0e18 !important; }
${q('.px-mrow[data-grim-meter="vital"] .px-fill')} { position: relative; background: ${longVial('Fatigue')}, #3a8a3a !important; }
${q('.px-mrow[data-grim-meter="vital"] .px-fill.blood')} { background: ${longVial('Health')}, #8a1c18 !important; }
${q('.px-mrow[data-grim-meter="vital"] .px-fill.verdigris')} { background: ${longVial('Magicka')}, #2f5fb4 !important; }
${q('.px-mrow[data-grim-meter="attr"]')} { margin: 0 0 12px; }   /* the skill grid's 8 and its row gap's 4 */
${q('.px-mrow[data-grim-meter="attr"] .px-mtop')} { margin-bottom: 3px; }
${q('.px-mrow[data-grim-meter="attr"] .px-meter')} { height: ${px(3, 'gq')} !important; background: rgba(40,22,8,0.55) !important; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline} !important; }
${q('.px-mrow[data-grim-meter="attr"] .px-fill')} { background: linear-gradient(180deg, #fff0a0 0 ${px(1, 'gq')}, ${T.goldLeaf} ${px(1, 'gq')} ${px(2, 'gq')}, #9a7420 ${px(2, 'gq')}) !important; }`;
};
/** The pack's Exit press - a red slab with a darker red rectangle set in it. */
const EXIT = 'linear-gradient(180deg, #c0201a 0%, #a8160f 45%, #8a0e08 100%)';
const EXIT_HI = 'linear-gradient(180deg, #d83024 0%, #bc1f15 45%, #9a140c 100%)';
const EXIT_LINE = `inset 0 0 0 2px #a8160f, inset 0 0 0 3px ${T.redDeep}, inset 0 0 0 4px #d0402e`;
const WORD_ON_WOOD = `1px 1px 0 ${T.outline}, 2px 2px 0 rgba(0,0,0,0.45)`;
const pressable = [...R.button, ...R.primary];
/** GRIM3: A TAB is the pack's own tab plate (its inventory's "WEAPONS & ARMOR"), at the pack's own pixels (--gk): its
 *  black outline, lit lip and capped ends, its lettering lifted off it (ui/grimoireArt.js liftLetters) so ours is cut
 *  in dark in its place, as the pack cuts its own; the open tab is the same plate lit toward the page it opens, its
 *  name in red. */
const { top: PT, side: PS, bottom: PB } = PLATE_SLICE;
const PLATE_W = `${px(PT, 'gk')} ${px(PS, 'gk')} ${px(PB, 'gk')} ${px(PS, 'gk')}`;
const TAB_EDGE = `border-style: solid !important; border-width: ${PLATE_W} !important; border-radius: 0 !important;
  box-shadow: ${px(1, 'gk')} ${px(2, 'gk')} 0 rgba(0,0,0,0.45) !important; outline: none;`;
const TAB_CSS = `background: #8e7048 !important; ${TAB_EDGE}
  border-image: ${v('plate')} ${PT} ${PS} ${PB} ${PS} fill / ${PLATE_W} stretch !important;
  color: #2a1a0a !important; text-shadow: 0 1px 0 rgba(255,232,180,0.32) !important; opacity: 1;`;
const TAB_ON_CSS = `background: #c8a874 !important; ${TAB_EDGE}
  border-image: ${v('plateOn')} ${PT} ${PS} ${PB} ${PS} fill / ${PLATE_W} stretch !important;
  color: ${T.red} !important; text-shadow: 0 1px 0 rgba(255,244,210,0.45) !important;
  text-decoration: underline solid ${T.red} !important; text-decoration-thickness: ${px(1, 'gk')} !important; text-underline-offset: 0.22em !important;`;
/** A closed tab under the pointer lifts a shade - its name stays ink: red is the open tab's alone. */
const TAB_HOVER = `color: #120a04 !important; filter: brightness(1.14);`;
/** GRIM3: THE SCROLLBAR - quiet (Dudey: "the scrollbar looks out of place and needs to be less appearing"): three of the
 *  game's pixels wide, no track to speak of but a faint ruled line down the page, the thumb a half-clear stroke of the
 *  page's own ink that firms up under the pointer and goes red as it is dragged; on wood a pale stroke instead. */
const SB_INK = 'rgba(74,44,18,0.38)', SB_INK_HI = 'rgba(74,44,18,0.68)', SB_RED = 'rgba(142,26,16,0.78)';
const SB_PALE = 'rgba(232,207,152,0.3)', SB_PALE_HI = 'rgba(232,207,152,0.6)';
const SB_WOOD = `:is([data-grim="wood"], [data-grim="wood"] *, [data-grim-desk] *, .shell .list, .shell .pane, .shell .panes)`;
const SCROLLBAR_CSS = `${G} ::-webkit-scrollbar { width: ${px(3)}; height: ${px(3)}; background: transparent; }
${G} ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
${G} ::-webkit-scrollbar-corner { background: transparent; }
${G} ::-webkit-scrollbar-track { border: 0; border-radius: 0; box-shadow: none;
  background: linear-gradient(90deg, transparent 0 ${px(1)}, rgba(92,56,24,0.14) ${px(1)} ${px(2)}, transparent ${px(2)}); }
${G} ::-webkit-scrollbar-track:horizontal { background: linear-gradient(180deg, transparent 0 ${px(1)}, rgba(92,56,24,0.14) ${px(1)} ${px(2)}, transparent ${px(2)}); }
${G} ::-webkit-scrollbar-thumb { border: 0; border-radius: 0; box-shadow: none; min-height: ${px(10)}; background: ${SB_INK}; }
${G} ::-webkit-scrollbar-thumb:hover { background: ${SB_INK_HI}; }
${G} ::-webkit-scrollbar-thumb:active { background: ${SB_RED}; }
${G} ${SB_WOOD}::-webkit-scrollbar-track { background: linear-gradient(90deg, transparent 0 ${px(1)}, rgba(232,207,152,0.1) ${px(1)} ${px(2)}, transparent ${px(2)}); }
${G} ${SB_WOOD}::-webkit-scrollbar-thumb { background: ${SB_PALE}; }
${G} ${SB_WOOD}::-webkit-scrollbar-thumb:hover { background: ${SB_PALE_HI}; }
/* THE SETTINGS IN THE BOOK - compact (Dudey: "the filers and the search function in the settings take so much place
   there isnt much left for seeing the rest"): the categories in tight rows, and the search, the filters, All off and
   Reset on one slim strip (two at most) - the page is for the settings. A touch screen keeps its thumb-sized targets. */
@media (any-pointer: fine) {
  ${G} .px-journal .subrail { padding: ${px(1)} ${px(1)} ${px(2)} !important; gap: 0 ${px(1)} !important; }
  ${G} .px-journal .subrail .subbtn { min-height: 0 !important; padding: 1px ${px(2)} !important; font-size: 16px !important; line-height: 20px !important; }
  ${G} .opt-tools { padding: ${px(1)} ${px(2)} !important; gap: ${px(1)} ${px(2)} !important; flex-wrap: wrap; }
  ${G} .opt-search { flex: 1 1 ${px(60)} !important; width: auto !important; max-width: 34% !important; min-height: 0 !important; height: 26px; padding: 0 ${px(2)} !important; font-size: 16px !important; }
  ${G} .opt-filters { gap: 0 ${px(1)} !important; flex: 0 1 auto; }
  ${G} .opt-filters .chip { min-height: 0 !important; padding: 1px ${px(2)} !important; font-size: 16px !important; line-height: 20px !important; }
  ${G} .opt-tools .acts { gap: ${px(2)} !important; margin: 0 0 0 auto !important; flex-wrap: nowrap; }
  ${G} .opt-tools .act { min-height: 0 !important; padding: 1px ${px(1)} !important; font-size: 16px !important; line-height: 20px !important; white-space: nowrap; }
  ${G} .sec-jump { gap: 0 ${px(1)} !important; padding: ${px(1)} ${px(2)} !important; }
  ${G} .sec-jumpbtn { min-height: 0 !important; padding: 0 ${px(2)} !important; font-size: 16px !important; line-height: 22px !important; }
}
/* A BAR THAT STAYS PUT while the rest scrolls under it (the settings' search and filters, the pool's head, a review's
   head, the controls' head) keeps a ground of its own - the page's paper on a page, the desk's wood on the desk - or
   the rows scroll visibly through it (Dudey: "the settings menu isnt working correctly") */
${G} :is(.opt-tools, .poolbar, .reviewhead, .ctl-head) { background: ${WOOD(0.34)} !important; box-shadow: 0 ${px(1)} 0 rgba(0,0,0,0.35) !important; }
${G} :is([data-grim="ink"], .px-journal) :is(.opt-tools, .poolbar, .reviewhead, .ctl-head) {
  background: linear-gradient(180deg, #ddc28e, #d6b982) !important; border-bottom: ${px(1)} solid rgba(74,44,18,0.45) !important;
  box-shadow: 0 ${px(1)} 0 rgba(74,44,18,0.12) !important; }`;
/** The windows too small or too thin for the board's frame. */
export const SMALL_WINDOWS = Object.freeze(['.px-about', '.px-profile', '.px-support', '.travelpanel-bar', '.tview-bar', '.tview-side',
  '.tview-confirm', '#wp-menu', '#travel-pace-box', '.helmpanel-bar', '.saddlepanel-bar', '.hmroot .hmtools', 'body .dfdecor-bar',
  'body .dfcards', 'body .dfiliac', 'body .dfgambit']);   // AUDIT CARDS-PLUS B4: the card tables' panels - the torn page's frame ran off the screen's edges; KG3: the third's

export function kitCss() {
  const fb = FRAME_ART.band;
  return `
/* ── GRIM1: THE DFO GRIMOIRE KIT (ui/grimoireDress.js) ── */
/* GRIM3: every picture is drawn pixel for pixel on the one grid - never smoothed (a photo, a video, the world and the
   paper doll's canvas stay as they are drawn) */
${G} *:not(img, video, canvas, iframe), ${G} *::before, ${G} *::after { image-rendering: pixelated; }
/* ...but the game's wordmark is no picture of the pack's: it is drawn smooth, as it was made */
${G} .px-wordmark, ${G} .px-wordmark *, ${G} .px-wordmark::before, ${G} .px-wordmark::after { image-rendering: auto; }
/* WINDOW - a torn page pinned on a board: the pack's cream page for a ground, the frame cut from its talk page and the
   spellmaker's desk (ui/grimoireArt.js), reaching outside the box so no window moves a pixel */
${at(R.window)}, ${at(R.windowGround)} {
  background: ${PAGE}; color: ${T.ink};
  border-image: ${v('frame')} ${fb} / ${px(fb)} / ${px(fb - 4)} round;
  box-shadow: 6px 10px 26px rgba(0,0,0,0.6); outline: none; }
${G}[data-grim-pages="scroll"] :is(${list(R.window)}), ${G}[data-grim-pages="scroll"] :is(${list(R.windowGround)}) { background: ${SCROLL}; }
${G}:not([data-grim-art="ready"]) :is(${list(R.window)}) { border-color: ${T.woodLit} ${T.woodDark} ${T.outline} ${T.woodMid}; border-image: none;
  box-shadow: 0 0 0 4px ${T.wood}, 0 0 0 5px ${T.outline}, 6px 10px 26px rgba(0,0,0,0.65); }
${at(R.window, ' .px-corner')} { display: none; }
/* a SMALL window - a plaque in a corner, a bar along an edge, a menu at the pointer - is a scrap of page in a thin
   wooden frame: the torn-page board is for a window you read */
${at(SMALL_WINDOWS)} { border-image: none; border-color: ${T.woodLit} ${T.woodDark} ${T.outline} ${T.woodMid};
  box-shadow: 0 0 0 2px ${T.wood}, 0 0 0 3px ${T.outline}, 3px 5px 12px rgba(0,0,0,0.55); }

/* PANEL - a box inside a page: a sheet of the older, tan scroll laid on it, its edge a brown line */
${at(R.panel)} { background: ${SCROLL}; color: ${T.ink};
  border-color: rgba(92,56,24,0.75) rgba(60,34,14,0.8) rgba(48,26,10,0.85) rgba(80,48,20,0.75);
  box-shadow: inset 0 0 14px rgba(96,54,16,0.32), 1px 2px 0 rgba(48,26,10,0.28); outline: none; }
${G}[data-grim-pages="scroll"] :is(${list(R.panel)}) { background: ${PAGE}; }
${at(R.panelAccent)} { border-left-color: ${T.red}; }

/* RAILS - the left-hand page of the talk window: the same page, ruled off from the right-hand one */
${at([...R.railRight, '.shell > .side', 'aside.side'])} { background: linear-gradient(rgba(120,70,20,0.07), rgba(120,70,20,0.07)), ${PAGE}; border-right-color: rgba(60,34,14,0.75); color: ${T.ink}; }
${at(R.railLeft)} { border-left-color: rgba(60,34,14,0.75); }
/* THE MENUS' OWN SCREENS (Continue, Load Game, Settings, Overhauls): the rail is a page, the room beside it the desk the
   pack's cards and pages are laid on */
${G} .shell .pane, ${G} .shell .panes, ${G} .shell .list { background: ${WOOD(0.32)} !important; }

/* PRESS - GrimoireUI presses nothing on a plate but its red Exit. What you can do on a page is WRITTEN on it, in ink,
   as its inventory writes Wagon, Info, Equip, Remove, Use and Gold down its parchment strip - red under the pointer,
   underlined in the pack's dotted rule. What stands on wood is lettered in its yellow, as its spellmaker letters Buy
   and New on the desk. Which is which is the press's own ground: the dress stamps it as it lands (data-grim-on). */
${at(pressable)} { background: none; border-color: transparent; border-radius: 0; box-shadow: none; transition: none; filter: none;
  text-decoration: none; }
${G} [data-grim-on="page"] { background: none !important; border-color: transparent !important; box-shadow: none !important; border-radius: 0;
  color: ${T.ink} !important; text-shadow: 0 1px 0 rgba(255,240,205,0.4) !important; text-decoration: none; }
${G} [data-grim-on="page"].primary { color: ${T.red} !important; }
/* HUD-CLASS: a chosen press (\`.on\` - a word the HUD writes too) is named by its own press root, so no rule of the dress
   can reach the HUD's \`.on\` (test/ui/naval/hudclass_sheets.test.js); at rest only, so the hover after it still wins as it did */
${at(PRESS_ROOTS, '[data-grim-on="page"].on:not(:hover):not(:focus-visible)')} { color: ${T.red} !important; }
${G} [data-grim-on="page"]:hover, ${G} [data-grim-on="page"]:focus-visible { color: ${T.redHi} !important; background: none !important;
  text-decoration: underline solid ${T.red}; text-underline-offset: 0.2em; outline: none; }
/* CANCEL - the way back out of a question: the pack's red word over its red rule */
${G} [data-grim-cancel][data-grim-on="page"] { color: ${T.red} !important; padding-left: 18px !important; padding-right: 18px !important;
  background: linear-gradient(${T.red}, ${T.red}) center bottom / calc(100% - 24px) 3px no-repeat,
    radial-gradient(circle, ${T.red} 1px, transparent 1.6px) left bottom / 6px 3px repeat-x !important; }
${G} [data-grim-on="wood"] { background: none !important; border-color: transparent !important; box-shadow: none !important; border-radius: 0;
  color: ${T.yellow} !important; text-shadow: 1px 1px 0 ${T.outline}, 2px 2px 0 rgba(0,0,0,0.5) !important; }
${G} [data-grim-on="wood"].primary { color: #fff27a !important; text-decoration: underline solid rgba(255,242,122,0.6); text-underline-offset: 0.22em; }
/* HUD-CLASS: the chosen press on wood by its own press root, as on the page - its rule underlined only while it is not
   disabled, where the plainer rule's underline gave way to the disabled one's */
${at(PRESS_ROOTS, '[data-grim-on="wood"].on:not(:hover):not(:focus-visible)')} { color: #fff27a !important; }
${at(PRESS_ROOTS, '[data-grim-on="wood"].on:not(:hover):not(:focus-visible):not(:disabled):not([disabled])')} {
  text-decoration: underline solid rgba(255,242,122,0.6); text-underline-offset: 0.22em; }
${G} [data-grim-on="wood"]:hover, ${G} [data-grim-on="wood"]:focus-visible { color: #fff8b0 !important; background: rgba(255,214,120,0.08) !important;
  outline: none; }   /* UI-CALM: no dotted rule under a word the pointer is on - the light and the ground say it */
${G} [data-grim-on]:active:not(:disabled) { translate: 1px 1px; }
${G} [data-grim-on]:disabled, ${G} [data-grim-on][disabled] { opacity: 0.45; text-decoration: none; background: none !important; translate: none; }
/* INK-DISABLED (2026-10-11): a press on a PAGE that cannot be pressed is written in the softer ink, solid - at 45% the
   brown on the tan scroll stood under 2:1, and the reason written beside its word (a friend's "offline", "no username",
   what a guild's name still needs) went with it. The softer ink still reads as the dead press beside the live one. */
${G} [data-grim-on="page"]:is(:disabled, [disabled]) { opacity: 1 !important; color: ${T.inkSoft} !important; text-decoration: none !important; cursor: default; }
/* ...and the reason itself (a press's \`*-why\`, written inside it): the press is a wooden surface to the ink, so its
   reason was re-said for the wood - cream on the scroll. On a page it is the soft ink, as its word is. */
${G} [data-grim-on="page"] [class$="-why"] { color: ${T.inkSoft} !important; text-shadow: none !important; }
/* ...and its key (a press's \`*-key\`, the saddle's and the helm's): re-said for the wood it was cream on the parchment, at
   1.1:1 (AUDIT UICALM-FIRM1 L4 L5) */
${G} [data-grim-on="page"] [class$="-key"] { color: ${T.inkSoft} !important; text-shadow: none !important; }
/* EXIT - the way out of a window (its Close) and the one press a screen is for, in the pack's own red Exit frame: cut
   from its inventory's Exit press (ui/grimoireArt.js), the pack's yellow lettering set in it */
${G} [data-grim-exit], ${at([...R.primary, '.px-winclose', '.lv-ok'])} {
  background: linear-gradient(180deg, #6a0404, #4a0202) !important; color: ${T.yellow} !important;
  border: 2px solid #8a0c08 !important; border-image: ${v('exit')} 7 6 7 7 / ${px(7, 'gq')} ${px(6, 'gq')} ${px(7, 'gq')} ${px(7, 'gq')} stretch !important; border-radius: 0 !important;
  box-shadow: ${px(1, 'gq')} ${px(1, 'gq')} 0 rgba(0,0,0,0.55) !important;
  text-shadow: 1px 1px 0 #2a0000, 2px 2px 0 rgba(0,0,0,0.4) !important; text-decoration: none !important; }
${G} [data-grim-exit]:hover, ${G} [data-grim-exit]:focus-visible, ${at([...R.primary, '.px-winclose', '.lv-ok'], ':hover')}, ${at([...R.primary, '.px-winclose', '.lv-ok'], ':focus-visible')} {
  background: linear-gradient(180deg, #8a0806, #5a0302) !important; color: #fff27a !important; filter: brightness(1.12); outline: none; }
/* WARN - a press that costs something: written in the pack's red, struck under with a hard line */
${at(R.warn)} { color: ${T.red} !important; text-decoration: underline solid rgba(142,26,16,0.6) !important; text-underline-offset: 0.22em; }
${G} [data-grim-on="wood"]:is(${list(R.warn)}) { color: #ff8a6a !important; }
/* AUDIT CARDS-PLUS (lane B): ...and it answers the pointer and the keyboard as every press does - its own red outweighed
   the hover's, so a Concede, a Leave or a Disband never changed under either */
${at(R.warn, ':hover:not(:disabled)')}, ${at(R.warn, ':focus-visible')} { color: ${T.redHi} !important; text-decoration: underline double ${T.redHi} !important; }
${G} [data-grim-on="wood"]:is(${list(R.warn)}):is(:hover, :focus-visible) { color: #ffb08f !important; }
/* UI-CALM II (a player: "the close button is not yellow highlighted when hovering over it ... and it has this damn
   dotted line"): a way out that is ALSO a warn press (the Firmament's Close) is the Exit plate first - its yellow word,
   no line under it, the brighter yellow and the lit plate under the pointer, as every other Close */
${G} [data-grim-exit]:is(${list(R.warn)}), ${G} [data-grim-on="wood"][data-grim-exit]:is(${list(R.warn)}) { color: ${T.yellow} !important; text-decoration: none !important; }
${G} [data-grim-exit]:is(${list(R.warn)}):is(:hover, :focus-visible), ${G} [data-grim-on="wood"][data-grim-exit]:is(${list(R.warn)}):is(:hover, :focus-visible) {
  color: #fff27a !important; text-decoration: none !important; background: linear-gradient(180deg, #8a0806, #5a0302) !important; filter: brightness(1.12); }

/* TILE - the inventory's wooden shelf box: what you pick sits IN it. Chosen, it is framed in the pack's yellow. */
${at(R.tile)} { background: rgba(14,8,3,0.92); color: ${T.cream}; text-shadow: ${WORD_ON_WOOD};
  border-color: #5a3a1e #2a170a #1c0f05 #4a2e16; border-radius: 0;
  border-image: ${v('cubby')} 5 5 7 6 fill / ${px(5, 'gq')} ${px(5, 'gq')} ${px(7, 'gq')} ${px(6, 'gq')} stretch; box-shadow: 0 0 0 1px ${T.outline}; transition: none; }
/* AUDIT CARDS-PLUS C2: its marks drawn OVER the box - the cubby's fill is painted above every inset shadow, so a chosen
   tile, a pointed-at one and the keyboard's looked as every other (a binder's chosen filter, the Codex | Cards part);
   an outline is drawn above the fill */
${at(R.tile, ':hover')}, ${at(R.tile, ':focus-visible')} { box-shadow: 0 0 0 1px ${T.outline}; outline: 2px solid rgba(216,176,74,0.55); outline-offset: -4px; }
${at(R.tile, '.on')}, ${at(R.tile, '.sel')}, ${at(R.tile, '[aria-pressed="true"]')} {
  box-shadow: 0 0 0 1px ${T.outline}, 0 0 10px rgba(216,176,74,0.35); outline: 2px solid ${T.goldLeaf}; outline-offset: -4px; }
${at(R.tile, ':active')} { box-shadow: 0 0 0 1px ${T.outline}; outline: 2px solid rgba(0,0,0,0.6); outline-offset: -4px; }

/* CHIP - a small plaque of the desk's wood, never pressed */
${at(R.chip)} { background: ${WOOD(0.12)}; color: ${T.cream}; text-shadow: ${WORD_ON_WOOD};
  border-color: ${T.woodLit} #2a180a ${T.outline} ${T.woodMid}; box-shadow: 0 0 0 1px ${T.outline}, 2px 2px 0 rgba(0,0,0,0.35); }
/* AUDIT C&C S4: ...and the HUD's temperature plate, a chip of this wood, keeps its levels on it - the status tiles' own
   amber and red (ui/enhanced/enhancedStyle.js .hst-cell.warn / .danger, which this dress leaves as they are). The wood's frame
   above outweighed the plate's level rules (three classes to two), and the plate wore the same wood felt, costing or
   comfortable */
${G} .hud-temp[data-level="warn"] { border-color: #f3cf86 #7a5424 #7a5424 #f3cf86; }
${G} .hud-temp[data-level="danger"] { border-color: #ff9a7a #b53a2e #b53a2e #ff9a7a; }
/* AUDIT CARDS-PLUS B1: THE CARD TABLES' MARKS, re-said in the dress's own colours, as the plate's levels are just above.
   The dress repaints a seat, a holding, a power and a chip by their roles and re-says the panels' own sheets in its ink,
   and every state the panels mark went with them - a target looked as every holding, the winner as every seat, the
   power ahead as the one behind. What is yours or for you is the chosen role's deep green, what is the other's the
   pack's red (each 3:1 or better on the page and the scroll), a lead a bar inside the plate's top so a target's ring
   outside it never hides it, the power ahead gold leaf on its wood, a card's own power badge as its card prints it, an
   empty place a hollow in the page, the keyboard's place a red ring, and a word on the page in the ink. */
${G} body .dfcards .seat.you { border-color: #1d5530 !important; box-shadow: 0 0 0 2px #1d5530, 1px 2px 0 rgba(48,26,10,0.28) !important; }
${G} body .dfcards .seat.to-act { box-shadow: inset 0 0 0 2px ${T.red}, 0 0 10px rgba(142,26,16,0.35) !important; }
${G} body .dfcards .seat.won { border-color: #1d5530 !important; box-shadow: inset 0 0 0 100vmax rgba(29,85,48,0.16), 0 0 0 2px #1d5530 !important; }
${G} body .dfiliac .hold.lead-mine { border-top-color: #1d5530 !important; box-shadow: inset 0 3px 0 #1d5530, inset 0 0 14px rgba(96,54,16,0.32) !important; }
${G} body .dfiliac .hold.lead-theirs { border-top-color: ${T.red} !important; box-shadow: inset 0 3px 0 ${T.red}, inset 0 0 14px rgba(96,54,16,0.32) !important; }
${G} body .dfiliac .hold.target { outline: 3px solid #1d5530 !important; outline-offset: 2px; cursor: pointer; }
${G} body .dfiliac .holdname, ${G} body .dfiliac .duel { color: ${T.ink} !important; text-shadow: none !important; }
${G} body .dfiliac .pw.ahead { border-color: ${T.goldLeaf} !important; color: ${T.yellow} !important; }
${G} body .dfiliac .ic .p { background: #8e2a1c !important; color: #fff6ee !important; text-shadow: none !important; }
${G} body .dfiliac .ic .p.up { background: #2f7a43 !important; }
${G} body .dfiliac .ic .p.down { background: #4a1a12 !important; color: #ffb4a6 !important; }
${G} body .dfiliac .slot { background: rgba(43,26,12,0.12) !important; box-shadow: inset 0 0 0 1px rgba(43,26,12,0.5) !important; }
${G} body .dfcards [tabindex="0"]:focus-visible, ${G} body .dfiliac [tabindex="0"]:focus-visible { outline: 2px solid ${T.red} !important; outline-offset: 2px; }
/* KG3: The King's Gambit's marks that are no role's. Its chosen tiles and rows are the kit's (a tile's gold leaf, a list
   row's wash - NO-BAR); a press armed for its second press in the pack's red; the keyboard's place the red ring, as the
   other two panels'; a name, a term and the result's head in the ink on the page (a unit's name in its picture's well
   is on wood, and keeps the wood's words), the result's win the green that is yours and its loss the pack's red; an
   action left and a tier's step lit in gold leaf on their wooden chip (the painter's own word for lit, dfgambit-lit) */
${G} body .dfgambit button[data-armed="true"] { outline: 2px solid ${T.red} !important; outline-offset: 1px; }
${G} body .dfgambit [tabindex="0"]:focus-visible { outline: 2px solid ${T.red} !important; outline-offset: 2px; }
${G} body .dfgambit :is(.dfgambit-regname, .dfgambit-term, .dfgambit-head)${IN_INK}${NOT_WOOD} { color: ${T.ink} !important; text-shadow: none !important; }
${G} body .dfgambit .dfgambit-head.dfgambit-won${IN_INK}${NOT_WOOD} { color: #1d5530 !important; }
${G} body .dfgambit .dfgambit-head.dfgambit-lost${IN_INK}${NOT_WOOD} { color: ${T.red} !important; }
${G} body .dfgambit .dfgambit-pip.dfgambit-lit, ${G} body .dfgambit .dfgambit-step i.dfgambit-lit { background: ${T.goldLeaf} !important; }
${G} .px-sys .binder-chip.short { color: #ff8a6a !important; outline: 2px solid #ff8a6a; outline-offset: -3px; }
${G} .px-sys .gr-acts .act:is(:disabled, [disabled]) { color: rgba(43,26,12,0.35) !important; }   /* AUDIT SPEC-RESET L3-6: the guide's refused press faded, as the pack's are - the page press's soft ink read as enabled */

/* WELL - sunk into the board: a dark hollow with the light caught on its far lip */
${at(R.well)} { background-color: rgba(22,13,6,0.9); color: ${T.cream};
  border-color: ${T.outline} ${T.woodMid} ${T.woodLit} #2a170a; box-shadow: 0 0 0 1px rgba(20,11,4,0.5), inset 2px 3px 0 rgba(0,0,0,0.55); }
/* a FIELD is a strip of fresh page in a dark frame, written in ink */
${at(R.input)} { background: ${T.cream}; color: ${T.ink}; text-shadow: none; caret-color: ${T.red};
  border-color: ${T.outline} ${T.woodLit} ${T.goldLeaf} ${T.woodMid}; }
/* INK-FIELDS (2026-10-11: the guild's name and the map's Find a place typed in cream and in yellow on the cream): a field
   is a WOODEN surface to the ink (its role says so) and its own sheet's light word - and, focused, the map's yellow - was
   re-said for the wood, which outweighs the plain rule above. What is typed in a field is ink, whatever is focused; the
   chat's own field said this first (below) and every field says it now. */
${at(R.input)}, ${at(R.input, ':focus')} { color: ${T.ink} !important; -webkit-text-fill-color: ${T.ink} !important; caret-color: ${T.red} !important;
  text-shadow: none !important; }
${at(R.input, '::placeholder')} { color: ${T.inkFaint} !important; -webkit-text-fill-color: ${T.inkFaint} !important; opacity: 1; }
${at(R.input, ':focus')} { border-color: ${T.red} ${T.goldLeaf} ${T.goldLeaf} ${T.red}; outline: none; }

/* BANDS - a window's name and the shelf its presses stand on: a plank of the desk across the page. GRIM3 (Dudey: "the
   wooden bars in the inventory look cheap"): a real plank - the desk's grain at the grid's pixels in a black outline,
   its top edge lit and its foot shaded a pixel each - laid on the page inside its torn edge,
   never a strip of texture run on under it */
/* a band whose own sheet gives it no room (the shop's "On the shelf") gets a plank's worth, so no word sits on its line */
${G} .remotehead { padding: ${px(2)} ${px(4)} !important; display: flex; align-items: center; min-height: ${px(14)}; box-sizing: border-box; }
${G} .remotehead .remotewho h3, ${G} .remotehead .remotewho .meta { margin: 0; line-height: 16px; }
${at([...R.header, ...R.footer])} { background: ${PLANK} !important; color: ${T.cream}; text-shadow: ${WORD_ON_WOOD};
  border-color: transparent; border-image: none; box-shadow: 0 ${px(1)} 0 rgba(0,0,0,0.35); }
${at(R.headerRule)} { border-bottom-color: rgba(60,34,14,0.7); border-bottom-style: solid; box-shadow: none; }
${at(R.footerRule)} { border-top-color: rgba(60,34,14,0.7); border-top-style: solid; box-shadow: none; }

/* TABS - GRIM3: the pack's own tab plates (its inventory's), at its own pixels; the open one lit, its name red */
${at(R.tabs)} { ${TAB_CSS} }
${at(R.tabs, '.on')} { ${TAB_ON_CSS} }
${at(R.tabs, ':hover:not(.on)')}, ${at(R.tabs, ':focus-visible:not(.on)')} { ${TAB_HOVER} outline: none; }

/* RULES - ruled in brown ink, the pack's dotted line under a heading */
${at(R.rule)} { border-bottom-color: rgba(92,56,24,0.4); box-shadow: none; }
${at(R.ruleTop)} { border-top-color: rgba(92,56,24,0.4); box-shadow: none; }
${at(R.listRow)} { border-bottom-color: rgba(92,56,24,0.35); border-bottom-style: solid; background-image: none; box-shadow: none; }
/* NO-BAR (2026-10-12, Mac: the Reforge's rows "have those lines"): a row under the pointer or chosen is not marked with a
   red bar down its edge - the page is washed under it, a shade deeper when it is the chosen one, as a finger on a page */
${at(R.listRow, ':hover')}, ${at(R.listRow, ':focus-visible')} { box-shadow: none; background-color: rgba(142,26,16,0.07); }
${at(R.listRow, '.on')} { box-shadow: none; background-color: rgba(142,26,16,0.13); }
${at(R.qrow, '.on')} { box-shadow: none; background: rgba(142,26,16,0.13); }
${at(R.wing)} { background: linear-gradient(180deg, rgba(60,34,14,0.75) 0 1px, transparent 1px); }
${G} .px-divider::before, ${G} .px-divider::after { background: rgba(60,34,14,0.6); }
${G} .px-sigil, ${G} .px-divider i { color: ${T.red}; }
/* NO-LINES (2026-10-11, a player: "those weird lines everywhere, those are not needed"): a page of the pack is not ruled
   off line by line. The thin separators under a row, over a row and under a heading, the wings and the dashes either
   side of a section's name are gone; what tells two rows apart is their spacing, as on the pack's own pages. */
${at([...R.rule, ...R.listRow, ...R.headerRule])} { border-bottom-color: transparent !important; box-shadow: none; }
${at([...R.ruleTop, ...R.footerRule])} { border-top-color: transparent !important; box-shadow: none; }
${at(R.wing)} { background: none !important; }
${G} .px-divider::before, ${G} .px-divider::after { content: none !important; }
${G} .empty { border-color: transparent !important; background: rgba(120,70,20,0.08); }   /* an empty state: a wash of the page, no dashed box */
${G} .px-divider > span, ${G} .px-divider { color: ${T.red}; letter-spacing: 0.08em; }
/* the talk window: its two pages part by the scroll's own shading at the gutter, not a dotted line */
${G} .talk-topics { box-shadow: inset -10px 0 12px -10px rgba(60,34,14,0.55); }
${G} .talk-list > *, ${G} .talk-row { border-color: transparent !important; }
/* the Professions page: a profession is a line on the page (its bar the gold leaf in its groove), never a box; the open
   one marked as a rail's open row is. A choice at 50 is a scrap of the page tinted, its name in red; the chosen one
   darker, its name underlined in the pack's red */
${G} .prof-row { background: none !important; border-color: transparent !important; color: ${T.ink} !important; }
${G} .prof-row:hover { background: rgba(142,26,16,0.06) !important; }
${G} .prof-row.on { box-shadow: none !important; background: rgba(142,26,16,0.13) !important; }
${G} .prof-row.on .prof-name { color: ${T.red} !important; }
${G} .prof-row .prof-rank { color: ${T.inkSoft} !important; }
${G} .prof-spec { background: rgba(120,70,20,0.1) !important; border-color: transparent !important; box-shadow: none !important; color: ${T.ink} !important; }
${G} .prof-spec b { color: ${T.red} !important; text-shadow: none !important; }
${G} .prof-spec:hover:not(:disabled) { background: rgba(142,26,16,0.08) !important; }
${G} .prof-spec.on { background: rgba(142,26,16,0.14) !important; }
${G} .prof-spec.on b { text-decoration: underline solid ${T.red}; text-underline-offset: 0.2em; }
${G} .prof-spec.coming { border-style: none !important; font-style: italic; }
/* MASTER SKILLS: no box round a career group - its name in red over the pack's own dotted ink rule (the one its pages
   rule a heading with), its pips in gold leaf, its skills laid on the page under it */
${G} .px-mgroup { border-color: transparent !important; background: none !important; padding: 0 2px 2px !important; margin-bottom: 18px !important; }
${G} .px-mhead { border-bottom: 0; padding-bottom: 8px !important; margin-bottom: 10px !important; ${RULE_UNDER} }
${G} .px-mname { color: ${T.red} !important; text-shadow: none !important; }
${G} .px-mcount { color: ${T.inkSoft} !important; }
${G} .px-pips, ${G} .px-pip.on { color: ${T.goldLeaf} !important; text-shadow: 0 1px 0 ${T.outline} !important; }
/* THE REFORGE ON THE PAGE (2026-10-12, Mac: "make sure the fonts are readable the grey ones arent. plus make it look
   better"): a row reads as the pack's own price lists do - what it is in the book's red when it is a family to scry
   (an item keeps its rarity's ink), what it is for in ink beneath, its price in ink beside, and the press written in
   red when it can be pressed; a press that cannot says why in the softer ink, leaning, never faded. */
${G} .reforge-shell .broker-offer .broker-price { color: ${T.ink} !important; text-shadow: none !important; opacity: 1 !important; }
${G} .reforge-shell .broker-offer.scry-row .broker-name { color: #7a170c !important; text-shadow: none !important; }   /* the page's red, a shade deep: 4.7:1 on its darkest */
${G} .reforge-shell .broker-offer .broker-set { color: ${T.ink} !important; text-shadow: none !important; }
${G} .reforge-shell .broker-buy[data-grim-on="page"]:not(:disabled):not([disabled]):not(:hover) { color: #7a170c !important; }
${G} .reforge-shell .broker-buy[data-grim-on="page"]:is(:disabled, [disabled]) { color: #4f3218 !important; font-style: italic; }   /* 5:1 */
${G} .reforge-shell .broker-offer { padding-top: 8px !important; padding-bottom: 8px !important; }
${G} body .reforge-shell .reforge-tabs .act.reforge-tab.on[data-grim-on]:not(:hover):not(:focus-visible) { color: #7a170c !important; text-decoration: underline solid #7a170c !important; text-underline-offset: 0.22em; }   /* the open page's word, 4.7:1 and underlined */

/* THE NOTICE - GRIM3 (Dudey: "the notification box is unreadable"): a note on the tan scroll is written in the pack's
   brown ink and nothing else - Plus's hard dark shadow under each word, re-said in ink, doubled every letter - at the
   face's own size, its line a whole pixel of the grid, the red rule down its edge */
${G} .notice:not(.notice-toast) { border: ${px(1)} solid rgba(48,26,10,0.85) !important; border-left: ${px(2)} solid ${T.red} !important; border-right: 0 !important;
  box-shadow: ${px(1)} ${px(2)} 0 rgba(0,0,0,0.4), 0 8px 18px rgba(0,0,0,0.4) !important; padding: 12px 18px 10px 16px; }
${G} .notice:not(.notice-toast), ${G} .notice:not(.notice-toast) * { text-shadow: none !important; }
${G} .notice:not(.notice-toast) .notice-row { color: ${T.ink} !important; font-size: 16px; line-height: 20px; }
${G} .notice:not(.notice-toast) .notice-row.highlight { color: ${T.red} !important; }
${G} .notice:not(.notice-toast) .notice-hint { color: ${T.inkSoft} !important; border-top: 2px solid rgba(92,56,24,0.55); font-size: 16px; letter-spacing: 0; text-transform: none; }

/* THE UI OVERHAUL CARD's own little rows, legible on their page */
${G} .look-colours-label { color: ${T.ink} !important; text-shadow: none !important; font-size: 12px; }
${G} .look-colour { background: none !important; border-color: rgba(92,56,24,0.45) !important; color: ${T.ink} !important; text-shadow: none !important; }
${G} .look-colour[aria-pressed="true"] { border-color: ${T.red} !important; color: ${T.red} !important; background: rgba(142,26,16,0.08) !important; }

/* THE CHOSEN OPTION - the pack's green wax seal (the Options window's Continue) */
${at(R.chosen)} { background: linear-gradient(180deg, #4fa064 0 1px, #2f7a46 1px calc(100% - 2px), #1d5530 calc(100% - 2px)); color: #f6efd0;
  text-shadow: 1px 1px 0 #0a2010; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px rgba(255,255,255,0.12); }

/* SCROLLBARS - GRIM3: a scroll's wooden rod in a groove ruled into the page, every line a whole pixel of the grid: the
   groove a dark channel with a lit far lip, the rod turned wood with a lit left face, a shaded right one and its two
   brass-capped ends; pressed, the rod is the pack's red */
${SCROLLBAR_CSS}
@supports not selector(::-webkit-scrollbar) { ${G} * { scrollbar-color: ${T.woodMid} rgba(92,56,24,0.18); } }

/* THE FRONT DOOR AND EVERY FULL SCREEN - the pack's own desk (its Biography screen: the candle, the open book) or its
   map of the Iliac Bay, where Plus had its starfield. GRIM3: the desk is drawn at a whole number of screen pixels to
   each of its own (--gc, the smallest that covers the screen), so its every pixel is the same square */
${G} .px-ground { opacity: 0 !important; animation: none !important; }
${G} .lv-sky { background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%), ${WOOD(0.3)}; }
/* the loading screen on the desk; character creation over the pack's map of the Iliac Bay, as its own chargen screens
   stand over the map of Tamriel */
${G} .ld { background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.62) 100%),
  url("${grimoireImg('BIOG00I0')}") 50% 100% / ${px(320, 'gc')} ${px(200, 'gc')} no-repeat, ${T.woodDark}; image-rendering: auto; }
${G} .wizard, ${G}[data-grim-backdrop="map"] .ld {
  background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 100%), url("${grimoireImg('TMAP00I0')}") 50% 50% / ${px(320, 'gc')} ${px(200, 'gc')} no-repeat, ${T.woodDark}; }
/* Plus's diamond marks beside a word go; the pack marks nothing that way */
${G} .px-c, ${G} .port-rowmark, ${G} .pick-mark, ${G} .px-qmark, ${G} .px-qtimed, ${G} .worntile, ${G} .px-profilegem, ${G} .px-gem,
${G} .px-divider i, ${G} .px-term { visibility: hidden !important; }
${G} body { background: ${T.woodDark}; }
${G} .px-vignette, ${G} .px-stars, ${G} .px-star { display: none !important; }
${G} .px-menu .doorbtn::before, ${G} .px-menu .doorbtn::after { color: ${T.yellowDeep}; }

/* ── THE HUD ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
/* THE VITALS - the pack's three glass vials, on their sides: GRIM3: each bar is the vial at its own pixels - its cork,
   then its tube repeated along the bar (ui/grimoireArt.js VIAL_CUT), never one picture stretched - the glass drained
   where the bar has gone, the words in the pack's lettering over the glass. No stone, no brass clasps. */
${G} .hud-vital::before, ${G} .hud-vital::after { display: none; }
${G} .hud-vital .hud-track { height: ${VIAL_H}; border-color: transparent; border-radius: 0; background: ${tube('Health', true)}, #1a0a0a;
  box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline}; filter: drop-shadow(${px(1, 'gq')} ${px(1, 'gq')} 0 rgba(0,0,0,0.55)); }
${G} .hud-magicka .hud-track { background: ${tube('Magicka', true)}, #0a0e18; }
${G} .hud-fatigue .hud-track { background: ${tube('Fatigue', true)}, #0a120a; }
${G} .hud-vital .hud-fill { background: ${tube('Health')}, var(--v-body); }
${G} .hud-magicka .hud-fill { background: ${tube('Magicka')}, var(--v-body); }
${G} .hud-fatigue .hud-fill { background: ${tube('Fatigue')}, var(--v-body); }
${G} .hud-vital .hud-fill::after { width: min(1px, 100%); opacity: 0.5; }
${G} .hud-vital .hud-chunk { display: none !important; }
${G} .hud-vlabel { padding-left: ${px(VIAL_CUT.cork + 2, 'gq')}; color: #fff3cf; letter-spacing: 0; text-transform: none; font-size: 12px;
  text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
${G} .hud-num { color: #fffbe6; font-size: 12px; text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
${G} .hud-vital.low .hud-track { animation: grim-vlow 0.9s steps(1, end) infinite; }
@keyframes grim-vlow { 0% { filter: drop-shadow(0 0 3px #ff2a14) drop-shadow(1px 2px 0 rgba(0,0,0,0.6)); } 50% { filter: drop-shadow(1px 2px 0 rgba(0,0,0,0.6)); } }
@media (prefers-reduced-motion: reduce) { ${G} .hud-vital.low .hud-track { animation: none; filter: drop-shadow(0 0 3px #ff2a14); } }
/* the foe's bar, the breath and the grip: the same glass - the red vial, the blue, the green */
${G} .hud-foe .hud-track, ${G} .hud-breath .hud-track { height: ${VIAL_H}; border-color: transparent; border-radius: 0;
  box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline}; filter: drop-shadow(${px(1, 'gq')} ${px(1, 'gq')} 0 rgba(0,0,0,0.55)); }
/* THE FOE'S BAR - the pack's red vial on its side, as wide as the compass is long and as tall as your own vials */
${G} .hud-foe .hud-foetrack { width: min(360px, 50vw); height: ${VIAL_H}; }
${G} .hud-foe .hud-track { background: ${tube('Health', true)}, #1a0a0a; }
${G} .hud-foe .hud-fill { background: ${tube('Health')}, #8a1c18; }
${G} .hud-foe .hud-chunk { display: none !important; }
/* the foe's bar is the player's own glass, as thick as the player's vials - whichever face the foe bar is set to (the
   blade picture stood twice as thick: Dudey, "the enemy hp bar should be scaled the same as the players hp bar in
   thickness") */
${G} .hud-foe.blade .hud-foeblade { display: none !important; }
${G} .hud-foe.blade .hud-foetrack { display: block !important; }
/* GRIM3: WHAT A BAR LOSES DRAINS AWAY IN THE GLASS (Dudey, on the fuse it replaced: "we need a different fitting effect
   thats not too much"): what a blow, a spell or a sprint took stays a moment as the vial's own liquid gone dark - the
   same glass, the same tube, darkened and dulled - and drains back to the liquid at the game's own pace (the held strip
   the bar always kept, enhancedHud.js lossTick). No flame, no spark: a vial losing what it held. */
${G} .hud-vital .hud-ghost, ${G} .hud-foe .hud-foetrack .hud-ghost { opacity: 1; border-radius: 0; z-index: -1; display: block;
  background: ${tube('Health')}, #5a1410; filter: brightness(0.5) saturate(0.75); animation: none; }
${G} .hud-magicka .hud-ghost { background: ${tube('Magicka')}, #142a5a; }
${G} .hud-fatigue .hud-ghost { background: ${tube('Fatigue')}, #1a3a14; }
${G}[data-grim-vitals="upright"] .hud-vital .hud-ghost { background: ${v('vialHealthUp')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #5a1410; }
${G}[data-grim-vitals="upright"] .hud-magicka .hud-ghost { background: ${v('vialMagickaUp')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #142a5a; }
${G}[data-grim-vitals="upright"] .hud-fatigue .hud-ghost { background: ${v('vialFatigueUp')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #1a3a14; }
${G} .hud-foename { font-size: 16px; margin-bottom: 2px; }
${G} .hud-foepoise { width: min(360px, 50vw); height: ${px(3, 'gq')}; max-height: ${px(3, 'gq')}; margin-top: ${px(2, 'gq')}; background: rgba(28,14,6,0.75); box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline}; border-radius: 0; }
${G} .hud-foepoise.poise-windup .hud-poisefill { background: linear-gradient(180deg, #f6dc7a 0 ${px(1, 'gq')}, ${T.goldLeaf} ${px(1, 'gq')}); }
${G} .hud-poiseword { color: ${T.yellow}; text-shadow: ${WORD_ON_WOOD}; text-transform: none; letter-spacing: 0; }
${G} .hud-foename, ${G} .hud-breathlabel { color: ${T.yellow}; text-transform: none; letter-spacing: 0.02em;
  text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
/* RENOWN - a strip of page with the climb to the next rank in gold leaf */
${G} .hud-renowntrack { background: ${PAGE}; border-color: ${T.woodLit} ${T.woodDark} ${T.outline} ${T.woodMid}; box-shadow: 0 0 0 1px ${T.outline}; }
${G} .hud-renowntrack .hud-fill { background: linear-gradient(180deg, #f6dc7a 0 2px, ${T.goldLeaf} 2px calc(100% - 3px), #9a7420 calc(100% - 3px)); }
${G} .hud-renownnum { color: ${T.ink}; text-shadow: 0 1px 0 rgba(255,240,200,0.5); }
${G} .hud-renownbox { color: ${T.yellow}; text-shadow: ${WORD_ON_WOOD}; }

/* THE COMPASS - GRIM3 (Dudey: "the compas needs to look more like a compass not like a board with NSWE in it"; "its
   HUGE!!! turning it around would also make more sense"): the pack's own compass - its gilded dome in its wooden box
   (COMPBOX) over its parchment strip (COMPASS: N, E, S, W and the ticks between, drawn by the pack) - on the game's own
   grid (ui/grimoireArt.js compBox, compass), two and a half screen pixels to each of its own (--gcm: "still a bit too
   big" at the pack's 3x, "a bit too small" at 2x), and turned over to hang from the top of the screen: the box's flat back on the
   screen's edge, its dome bowing down, the gold needle pointing down at the heading from above. Only the box is turned;
   the strip reads the right way up, its letters let down under the needle, sliding under the dome as you turn (the HUD says the heading, --hud-heading). The
   quest's, the party's and Detect's marks still ride the strip; the HUD's word points go - the strip writes its own. */
${G} .hud-top { top: 0 !important; }
${G} .hud-compass { --gcm: calc(var(--gq, 2px) * 1.25); width: calc(69 * var(--gcm)); height: calc(17 * var(--gcm)); background: none; border: 0; box-shadow: none;
  filter: drop-shadow(${px(1, 'gq')} ${px(1, 'gq')} 0 rgba(0,0,0,0.55)); }
/* GRIM4 (Dudey: "The compass looks blurry make better readable"): the box and the strip are the pack's own pictures at
   ITS resolution - three of its pixels to one of the game's - drawn smooth at the compass's size, never the game-grid
   cut stretched pixel for pixel by two and a half (which smeared every letter): N, E, S and W keep the pack's own
   strokes. */
${G} .hud-compass::after { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; image-rendering: auto;
  background: url("${grimoireImg('COMPBOX')}") 0 0 / 100% 100% no-repeat; transform: scaleY(-1); }
${G} .hud-compass .hud-strip { left: calc(2 * var(--gcm)); right: calc(2 * var(--gcm)); top: calc(2 * var(--gcm)); bottom: var(--gcm); image-rendering: auto;
  background: url("${grimoireImg('COMPASS')}") no-repeat #bc8941;
  background-size: calc(322 * var(--gcm)) calc(14 * var(--gcm));
  background-position: calc((32.5 - 32.83 - var(--hud-heading, 0) * 257) * var(--gcm)) calc(4 * var(--gcm)); }
/* TURN1 (Dudey: "let the players rotate the compass with alt + u"): unlocked, the compass carries a turn-over press
   beside its X; turned, the box stands the way the pack painted it - the dome up, the needle under it - and the strip's
   letters rise to meet the needle. */
${G} #hud-layout-handles i[data-hm-handle="turn"] { display: block; }
${G} .hud-compass[data-hm-turn]::after { transform: none; }
${G} .hud-compass[data-hm-turn] .hud-strip { top: var(--gcm); bottom: calc(2 * var(--gcm));
  background-position-y: calc(0.5 * var(--gcm)); }
${G} .hud-compass .hud-point { visibility: hidden; }
${G} .hud-needle { display: none; }
/* GRIM-MARKS (2026-10-13, field video: "what are those colored edges, the blue and greenish ones"): the strip's marks
   (ui/enhanced/enhancedHud.js - Detect, the party, the professions' nodes, a ship, a boat, the gate, the quest) are laid by
   left: 0..100% OF THE COMPASS BOX and stood on its foot. Here the box is the wooden frame, the parchment two --gcm in
   from each side and one up from the foot, and the frame (::after, z 3) sits over all of it - so every mark ON the strip
   was buried under the wood, and a mark clamped to an end (a node or a mate BEHIND you: compassMarkerLerp's clamp) hung
   half out past the frame's corner as a stray coloured wedge - the Motherlode's teal, Logging's sap green. The box is
   now the parchment's open span (less --gcm-mark each side: clear of the rim's corners, and the widest mark's half - the
   boat's 7px - so an end mark stands whole) and the frame and the strip reach back out to where they always stood:
   nothing on screen moves, and the marks' 0..100% is the strip's. The foot is the dome's curve ("you can't run the
   markers on the bottom"), so the triangles hang from the box's FLAT side - its top, where the needle hangs, pointing
   down at the bearing as the needle does - and turned over (dome up) they stand on its flat foot. A ship's bow rides
   the row just under them. All over the frame's rim. */
${G} .hud-compass { --gcm-mark: calc(3 * var(--gcm) + 7px); width: calc(69 * var(--gcm) - 2 * var(--gcm-mark)); margin-left: var(--gcm-mark); margin-right: var(--gcm-mark); }
${G} .hud-compass::after { left: calc(-1 * var(--gcm-mark)); right: calc(-1 * var(--gcm-mark)); }
${G} .hud-compass .hud-strip { left: calc(2 * var(--gcm) - var(--gcm-mark)); right: calc(2 * var(--gcm) - var(--gcm-mark)); }
${G} .hud-compass .hud-detect, ${G} .hud-compass .hud-party, ${G} .hud-compass .hud-node { top: calc(2 * var(--gcm)) !important; bottom: auto !important; z-index: 4; }
${G} .hud-compass .hud-ship { top: calc(2 * var(--gcm) + 6px) !important; z-index: 4; }
${G} .hud-compass .hud-boat, ${G} .hud-compass .hud-gate, ${G} .hud-compass .hud-serpent, ${G} .hud-compass .hud-sd, ${G} .hud-compass .hud-quest { z-index: 4; }
${G} .hud-compass[data-hm-turn] .hud-detect, ${G} .hud-compass[data-hm-turn] .hud-party, ${G} .hud-compass[data-hm-turn] .hud-node { top: auto !important; bottom: calc(2 * var(--gcm)) !important; }
${G} .hud-compass[data-hm-turn] .hud-ship { top: auto !important; bottom: calc(2 * var(--gcm) + 6px) !important; }

/* THE HOTBAR - a row of the inventory's shelf boxes; the key in yellow on the lip, what is in hand framed in gold */
${G} .hb .hb-slot { background: rgba(14,8,3,0.82); border-image: ${v('cubby')} 5 5 7 6 fill / ${px(5, 'gq')} ${px(5, 'gq')} ${px(7, 'gq')} ${px(6, 'gq')} stretch;
  box-shadow: 0 0 0 1px ${T.outline}, 2px 3px 0 rgba(0,0,0,0.45); }
${G} .hb .hb-frame { border-color: transparent; box-shadow: none; }
${G} .hb .hb-slot.hb-empty .hb-frame { border-color: transparent; }
${G} .hb .hb-slot.hb-active .hb-frame { border-color: ${T.goldLeaf}; box-shadow: inset 0 0 12px rgba(216,176,74,0.45); }
${G} .hb .hb-slot.hb-strike .hb-frame { border-color: #fff27a ${T.goldLeaf} ${T.yellowDeep} #fff27a; }
${G} .hb .hb-key { color: ${T.yellow}; text-shadow: ${WORD_ON_WOOD}; }
${G} .hb .hb-caption { background: ${WOOD(0.1)}; color: ${T.cream}; border-color: ${T.woodLit} #2a180a ${T.outline} ${T.woodMid}; }

/* THE QUICKSLOT DIAMOND - a rhombus of the desk's wood with a gilded rim */
${G} .hud-qdiamond .hud-qframe { background: linear-gradient(135deg, #f0d276 0%, ${T.goldLeaf} 30%, #8a6418 70%, #4a3208 100%); }
${G} .hud-qdiamond .hud-qground { background: linear-gradient(135deg, rgba(58,36,20,0.95) 0%, rgba(30,18,8,0.92) 60%, rgba(18,10,4,0.9) 100%); }
${G} .hud-qdiamond .hud-qcell.socket .hud-qframe { background: linear-gradient(135deg, rgba(122,82,48,0.7), rgba(42,24,10,0.7)); }
${G} .hud-qdiamond .hud-qcell.cycling .hud-qframe { background: linear-gradient(135deg, #fff39a, ${T.yellow} 50%, #9a8a14); }
/* DIAMOND-HB: the hotbar's diamond slots (Diamond, Diamonds) - the old diamond's wood and gilded rim. The shelf box's
   border-image is for square slots; clipped to a diamond it would be cut at the corners */
${G} .hb { --gem-rim: linear-gradient(135deg, #f0d276 0%, ${T.goldLeaf} 30%, #8a6418 70%, #4a3208 100%);
  --gem-rim-empty: linear-gradient(135deg, rgba(122,82,48,0.7), rgba(42,24,10,0.7));
  --gem-rim-active: linear-gradient(135deg, #fff39a, ${T.yellow} 50%, #9a8a14);
  --gem-rim-strike: linear-gradient(135deg, #fff27a, ${T.goldLeaf} 50%, ${T.yellowDeep}); }
${G} .hb.hb-gem .hb-slot { border-image: none; box-shadow: none;
  background: linear-gradient(135deg, rgba(58,36,20,0.95) 0%, rgba(30,18,8,0.92) 60%, rgba(18,10,4,0.9) 100%); }

/* THE DIAL - GRIM4 (Dudey: "instead of words give this fitting symbols, all in the style of grimoire"): each door of the
   Tab dial is a piece of the pack's own painting (ui/grimoireArt.js DIAL_ICONS) - the Empire's helm for Skills, the
   spellmaker's spellbook for Magic, the map of Tamriel for Map, the Save Game chest for Items - standing at the same
   distance from the knot on all four sides, the rule from each reaching the same breath short of it. The word stays
   on the door for a reader of the page, unseen; the symbol under the pointer (or the keys) is lit and edged in the
   pack's yellow, the others a shade back. */
${G} .px-dial .px-rose { --dial-r: clamp(64px, calc(39vh - 110px), 150px); --dial-k: 1; }
${G} .px-dial .px-arm[data-grim-icon] { font-size: 0 !important; letter-spacing: 0; text-indent: 0; gap: 0; padding: 6px; min-width: 0; min-height: 0;
  text-shadow: none; color: transparent; }
${G} .px-dial .px-arm[data-grim-icon] .px-term { display: none; }
${G} .px-dial .px-arm[data-grim-icon] .px-c { visibility: visible !important; display: block; flex: 0 0 auto; font-size: 0; color: transparent; text-shadow: none;
  background: center / 100% 100% no-repeat; image-rendering: auto;
  filter: brightness(0.78) saturate(0.85) drop-shadow(2px 3px 0 rgba(0,0,0,0.55)); }
${G} .px-dial .px-arm[data-grim-icon]:is(.on, :hover, :focus-visible) .px-c {
  filter: drop-shadow(0 0 1px ${T.yellow}) drop-shadow(0 0 5px rgba(244,224,76,0.5)) drop-shadow(2px 3px 0 rgba(0,0,0,0.55)); }
${Object.keys(DIAL_ICONS).map((k) => { const [w, h] = dialIconSize(k); return `${G} .px-dial .px-arm[data-grim-icon="${k}"] .px-c { width: calc(${w}px * var(--dial-k)); height: calc(${h}px * var(--dial-k));
  background-image: var(${artVar(dialArtName(k))}, none);${DIAL_ICONS[k].cells ? ' image-rendering: pixelated;' : ''} }`; }).join('\n')}
/* DIAL-CLASSIC (ui/dialClassicArt.js; Mac: "the arena2 files look for those symbols ... make the icons fit to each other
   sizewise"): in game the doors wear Daggerfall's own - the player's face, the HUD bar's star, sack and scroll, each at
   a whole number of screen pixels to its own, the four the same height; the pack's paintings (above) are each door's
   until its own is read. DIAL-PACK (Mac: "add the old Tab selector as optional"): the card's 'Tab dial' row keeps the
   pack's paintings instead (GRIMOIRE_DIALS 'pack'). */
${Object.keys(DIAL_ICONS).map((k) => { const [w, h] = dialIconSize(k); return `${DIAL_CLASSIC} .px-dial .px-arm[data-grim-icon="${k}"] .px-c { width: calc(var(--dial-classic-w-${k}, ${w}px) * var(--dial-k)); height: calc(var(--dial-classic-h-${k}, ${h}px) * var(--dial-k));
  background-image: var(--dial-classic-${k}, var(${artVar(dialArtName(k))}, none)); }`; }).join('\n')}
${DIAL_CLASSIC}[data-grim-dial-art="classic"] .px-dial .px-arm[data-grim-icon] .px-c { image-rendering: pixelated; }
${DIAL_CLASSIC}[data-grim-dial-art="classic"][data-grim-dial-face="head"] .px-dial .px-arm[data-grim-icon="skills"] .px-c { image-rendering: auto; }   /* PORTRAIT3D: the Morrowind head, smooth (ui/dialClassicArt.js readHeadDial) */
${G} .px-dial .px-arm[data-grim-icon]::after { content: none; }
${G} .px-dial .px-arm[data-grim-icon]::before { background: rgba(216,176,74,0.4); }
${G} .px-dial .px-arm[data-grim-icon]:is(.on, :hover)::before { background: ${T.goldLeaf}; }
${G} .px-dial .px-arm.px-n[data-grim-icon] { left: 50%; top: calc(50% - var(--dial-r)); bottom: auto; transform: translate(-50%, -100%); }
${G} .px-dial .px-arm.px-s[data-grim-icon] { left: 50%; top: calc(50% + var(--dial-r)); bottom: auto; transform: translate(-50%, 0); }
${G} .px-dial .px-arm.px-w[data-grim-icon] { left: calc(50% - var(--dial-r)); right: auto; top: 50%; transform: translate(-100%, -50%); }
${G} .px-dial .px-arm.px-e[data-grim-icon] { left: calc(50% + var(--dial-r)); right: auto; top: 50%; transform: translate(0, -50%); }
${G} .px-dial .px-arm.px-n[data-grim-icon]::before { left: 50%; top: calc(100% + 8px); bottom: auto; width: 2px; height: calc(var(--dial-r) - 46px); transform: translateX(-50%); }
${G} .px-dial .px-arm.px-s[data-grim-icon]::before { left: 50%; bottom: calc(100% + 8px); top: auto; width: 2px; height: calc(var(--dial-r) - 46px); transform: translateX(-50%); }
${G} .px-dial .px-arm.px-w[data-grim-icon]::before { left: calc(100% + 8px); right: auto; top: 50%; height: 2px; width: calc(var(--dial-r) - 46px); transform: translateY(-50%); }
${G} .px-dial .px-arm.px-e[data-grim-icon]::before { right: calc(100% + 8px); left: auto; top: 50%; height: 2px; width: calc(var(--dial-r) - 46px); transform: translateY(-50%); }
@media (max-width: 480px) { ${G} .px-dial .px-rose { --dial-k: 0.72; --dial-r: clamp(56px, calc(43vw - 90px), 110px); } }

/* THE FOE'S VIAL AND THE BOSS'S - GRIM4 (Dudey: "The lifebar of the enemy and the boss are not looking like the lifebar
   of the player"): the very vial your own health stands in - the pack's whole red vial, cork, glass, its light and its
   bubbles, at its own pixels (ui/grimoireArt.js vialHealth), laid on its side - never a length of tube repeated. The
   foe's is your vial's size exactly (as long as the compass is wide); a boss's the same vial at the game's full scale,
   the bigger glass for the bigger foe. What a blow took drains in the glass, darkened, as yours does. */
${G} .hud-foe .hud-foetrack { width: ${px(86, 'gq')}; height: ${VIAL_H}; background: ${v('vialHealthEmpty')} 0 0 / 100% 100% no-repeat, #1a0a0a; }
${G} .hud-foe .hud-foetrack .hud-fill { background: ${v('vialHealth')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #8a1c18; }
${G} .hud-foe .hud-foetrack .hud-ghost { background: ${v('vialHealth')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #5a1410; }
${G} .hud-foe .hud-foetrack .hud-fill { position: relative; }
${G} .hud-foe .hud-foetrack .hud-fill::after, ${G} .wb-boss-fill::before { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: min(1px, 100%);
  background: var(--v-hi, #f2a597); opacity: 0.5; }
${G} .hud-foe .hud-foepoise { width: ${px(86, 'gq')}; }
/* ...and the breath and the grip are the same glass whole: the blue vial and the green */
${G} .hud-breath .hud-track { width: ${px(86, 'gq')}; background: ${v('vialMagickaEmpty')} 0 0 / 100% 100% no-repeat, #0a0e18; }
${G} .hud-breath .hud-fill { background: ${v('vialMagicka')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #2f5fb4; }
${G} .hud-grip .hud-track { background: ${v('vialFatigueEmpty')} 0 0 / 100% 100% no-repeat, #0a120a; }
${G} .hud-grip .hud-fill { background: ${v('vialFatigue')} 0 0 / ${px(86, 'gq')} 100% no-repeat, #3a8a3a; }
${G} .wb-boss-track { width: ${px(86)}; max-width: 100%; height: ${px(11)}; margin: ${px(2, 'gq')} auto ${px(2, 'gq')}; box-sizing: border-box; border: 0 !important; border-radius: 0;
  background: ${v('vialHealthEmpty')} 0 0 / 100% 100% no-repeat, #1a0a0a !important; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline} !important;
  filter: drop-shadow(${px(1, 'gq')} ${px(1, 'gq')} 0 rgba(0,0,0,0.55)); }
${G} .wb-boss-track::before, ${G} .wb-boss-track::after, ${G} .wb-boss-fill::after { display: none !important; }
${G} .wb-boss-fill { background: ${v('vialHealth')} 0 0 / ${px(86)} 100% no-repeat, #8a1c18 !important; box-shadow: none !important; }
${G} .wb-boss-ghost { background: ${v('vialHealth')} 0 0 / ${px(86)} 100% no-repeat, #5a1410 !important; filter: brightness(0.5) saturate(0.75); opacity: 1 !important; }
${G} .wb-boss-bar.sea .wb-boss-track { background: ${v('vialMagickaEmpty')} 0 0 / 100% 100% no-repeat, #0a0e18 !important; }
${G} .wb-boss-bar.sea .wb-boss-fill { background: ${v('vialMagicka')} 0 0 / ${px(86)} 100% no-repeat, #2f5fb4 !important; }
${G} .wb-boss-bar.sea .wb-boss-ghost { background: ${v('vialMagicka')} 0 0 / ${px(86)} 100% no-repeat, #142a5a !important; }
${G} .wb-boss-bar.brass .wb-boss-fill { filter: sepia(1) saturate(1.8) hue-rotate(-6deg) brightness(1.08); }
${G} .wb-boss-bar.star .wb-boss-fill, ${G} .wb-boss-bar.star .wb-boss-ghost { filter: hue-rotate(255deg) saturate(0.85) brightness(1.12); }
${G} .wb-boss-mark { top: 0; bottom: 0; width: ${px(1, 'gq')}; background: rgba(20,11,4,0.8) !important; }
${G} .wb-boss-name { color: ${T.yellow}; letter-spacing: 0.02em; text-transform: none;
  text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
@media (prefers-reduced-motion: no-preference) { ${G} .wb-boss-bar.low .wb-boss-track { animation: grim-vlow 0.9s steps(1, end) infinite; } }

/* THE REVENANT'S CARD - GRIM4 (Dudey: "the revenant window isnt readable"): a card on the tan scroll is written in the
   pack's ink, flat - the stack's hard dark shadow (meant for words over the world) under every letter doubled each one
   on the paper. Its name in ink over the dotted rule, what it is in red, its rank and kind in the softer ink, what it
   says in ink; the two chips stay lettered on their wood. */
${G} .rvncard, ${G} .rvncard :not(.rvncard-rank, .rvncard-mood) { text-shadow: none !important; }
${G} .rvncard .rvncard-kicker { line-height: 20px; }
${G} .rvncard .rvncard-name { color: ${T.ink} !important; line-height: 20px; padding-bottom: 2px; margin-bottom: 4px; border-bottom: 2px solid rgba(92,56,24,0.55) !important; }
${G} .rvncard .rvncard-sub { color: ${T.inkSoft} !important; line-height: 20px; }
${G} .rvncard .rvncard-say { color: ${T.ink} !important; line-height: 20px; }
${G} .rvncard .rvncard-body { color: ${T.inkSoft} !important; line-height: 20px; }
${G} .rvncard .rvncard-mood { line-height: 18px; vertical-align: 0; }

/* HOW MANY - GRIM5 (Dudey: "the "of 5" my inner monk is killing me xD its not in the middle next ot the how many box"): the
   question's three parts on one line, each centred on the field - a word's own margin (a note's, re-said) never lifts
   one of them off it */
${G} .qtyfield { align-items: center; }
${G} .qtyfield > span { margin: 0 !important; padding: 0 !important; line-height: 20px; align-self: center; }
/* THE PACK'S FOOT - GRIM5 (Dudey: "The gold counter is also a bit misplaced"): the purse's word and figure stand on
   the plank's middle line as the carry weight's do - never on the Drop press's baseline, which lifted them - and the
   carry's bar is a bar: the skill's thin gold groove at a length of its own, never squeezed to a sliver */
${G} .pack-shell .packgold { align-items: center; }
${G} .pack-shell .packbar :is(.packcarry, .packgold) > :is(.k, .v) { line-height: 20px; }
${G} .pack-shell .packcarry .px-meter { flex: 0 0 auto; width: ${px(60, 'gq')}; height: ${px(3, 'gq')}; border: 0; border-radius: 0;
  background: rgba(20,11,4,0.6); box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline}, 0 1px 0 ${px(1, 'gq')} rgba(255,214,150,0.12); }
${G} .pack-shell .packcarry .px-fill { box-shadow: none; background: linear-gradient(180deg, #fff0a0 0 ${px(1, 'gq')}, ${T.goldLeaf} ${px(1, 'gq')} ${px(2, 'gq')}, #9a7420 ${px(2, 'gq')}); }
${G} .pack-shell .packcarry .px-fill.blood { background: linear-gradient(180deg, #f2a597 0 ${px(1, 'gq')}, #b53a2e ${px(1, 'gq')} ${px(2, 'gq')}, #6a1c14 ${px(2, 'gq')}); }

/* GRIM6 - Dudey's last list.
   The front door's settings jumped when a group was pressed: Plus's ground canvas (hidden under the dress, but still
   1200 pixels tall in a 960-pixel frame) let the press scroll the whole menu up - it is out of the page here. */
${G} .px-ground { display: none !important; }
/* the held map's Find me press goes ON THE DUNGEON'S SHEET (Dudey: "remove the find me button in dungeon 3d handdrawn map")
   - and stays on the world's and the town's, left of Close (FINDME-SHEET, Mac: "the worldmap is also missing the find me
   button next to close"): the rule took it off every sheet, the world map's with the dungeon's */
${G} .hmroot[data-hm-sheet="automap"] .hmfindme { display: none !important; }
/* THE PACK'S DOLL (Dudey: "box fonts leaving the box ... this cant happening"): a slot's word and a piece's name are
   written INSIDE the shelf box - kept off its frame by the frame's own width - wrapping between words, never run over
   the wood or cut at the edge */
${G} .pack-shell .equipped .wornrow { padding: ${px(5, 'gq')} ${px(5, 'gq')} ${px(7, 'gq')} ${px(6, 'gq')} !important; overflow: hidden; }
${G} .pack-shell .equipped .wornrow .worntext { min-width: 0; max-width: 100%; }
${G} .pack-shell .equipped .wornrow :is(.wornslot, .wornname) { white-space: normal !important; overflow-wrap: break-word; max-width: 100%;
  line-height: 16px; letter-spacing: 0 !important; }
${G} .pack-shell .equipped .wornpair > .wornrow :is(.wornslot, .wornname) { text-align: center; }
/* THE CHAT, on its page (Dudey: "The chat fonts when i type in it are white ... same for reading names"): what you type
   is ink on the field; a name keeps its colour, deepened to read on the paper (a plain one is ink); the times, the tags
   and the roster's head the softer ink; a herald's line the blue ink */
${G} body .dfchat-input { color: ${T.ink} !important; -webkit-text-fill-color: ${T.ink} !important; caret-color: ${T.red}; text-shadow: none !important; }
${G} body .dfchat-input::placeholder { color: ${T.inkFaint} !important; -webkit-text-fill-color: ${T.inkFaint} !important; }
${G} .dfchat-box :is(.dfchat-name, .dfchat-who-name) { text-shadow: none !important; }
/* NAME-INK (2026-10-11, Mac: "the color was the problem not the font"): a name deepened to three tenths was the ink its
   words are written in, and a speaker read as part of the line. A name is in a colour of its own on the page (ui/
   chatColours.js NAME_COLOURS, each 4.5:1 or better on the page): a stranger's the page's red, my own a brown gold, a
   party member's green and a friend's blue - social's two colours (set on the element) each deepened by hand, not by a
   filter, so they keep their hue. */
${G} .dfchat-box :is(.dfchat-name, .dfchat-who-name) { color: ${NAME_COLOURS.other.dark} !important; filter: none !important; }
${G} .dfchat-box .dfchat-line.mine .dfchat-name, ${G} .dfchat-box .dfchat-who-row.me .dfchat-who-name { color: ${NAME_COLOURS.mine.dark} !important; }
${G} :is(.dfchat-box, .dfsocial) :is(.dfchat-name, .dfchat-who-name, .dfsocial-name)[style*="115, 255, 115"] { color: ${NAME_COLOURS.party.dark} !important; filter: none !important; }
${G} :is(.dfchat-box, .dfsocial) :is(.dfchat-name, .dfchat-who-name, .dfsocial-name)[style*="143, 208, 255"] { color: ${NAME_COLOURS.friend.dark} !important; filter: none !important; }
/* CHAT-COLOURS on the page: the chat is written on the CREAM page (the lighter of the pack's two), so a channel's
   colour - ink-dark, each 4.5:1 or better - reads as a colour and not as the ink; a pip of it on each tab's plate */
${G} body .dfchat-box { background: ${PAGE} !important; }
${channelRules(`${G} body .dfchat[data-colours="on"] .dfchat-box`, 'dark', true)}
${pipRules(`${G} body .dfchat[data-colours="on"] .dfchat-box`, 'dark', true)}
${G} body .dfchat[data-colours="on"] .dfchat-box :is(.dfchat-tab, .dfchat-chan)[data-tab]::before { box-shadow: 0 0 0 1px rgba(255,240,205,0.7) !important; }
${Object.entries(CHANNEL_COLOURS).map(([ch, c]) => `${G} body .dfchat[data-colours="on"] .dfchat-box .dfchat-chan[data-tab="${ch}"] { color: ${c.dark} !important; }`).join('\n')}
/* ...and the lines standing over the world keep the light colours, under the HUD's outline (the box's ink is the box's) */
${channelRules(`${G} body .dfchat[data-colours="on"] .dfchat-peek`, 'light', true)}
${pipRules(`${G} body .dfchat[data-colours="on"] .dfchat-peek`, 'light', true)}
/* PING1 on the page: the line on a gold wash with a bar at its edge, my @name the deep brown-gold, underlined */
${G} .dfchat-box .dfchat-line.ping { background: ${PING_COLOURS.wash.dark} !important; box-shadow: inset 3px 0 0 ${PING_COLOURS.bar.dark} !important; }
${G} .dfchat-box .dfchat-mention { color: ${PING_COLOURS.mention.dark} !important; text-decoration: underline solid ${PING_COLOURS.bar.dark}; text-underline-offset: 0.18em; }
${G} .dfchat-peek .dfchat-mention { color: ${PING_COLOURS.mention.light} !important; }
/* THE UNREAD COUNT ON A TAB'S PLATE (2026-10-11, Mac: "make the 5 shown in the channel not cover whatever it is the 5
   is also not really well placed"): Plus's dot is a 7px disc with its number drawn at no size, and on the plate the
   face's own size came back - the number stood over the dot, above the word's line and against the plate's edge. On the
   page it is a wax seal: the book's red disc, the number in cream at the middle of it, beside the word on its line and
   clear of it; a tab holding a line that names me, the mention's gold with the number in ink. */
${G} body .dfchat-box .dfchat-tab .dfchat-badge:not(:empty) { display: inline-flex !important; align-items: center; justify-content: center;
  box-sizing: border-box; min-width: 17px; height: 17px; padding: 0 4px !important; margin: 0 0 0 7px !important; border-radius: 9px !important;
  font-size: 12px !important; line-height: 1 !important; letter-spacing: 0 !important; text-indent: 0 !important; vertical-align: middle;
  position: relative; top: -1px; color: #fff0c8 !important; -webkit-text-fill-color: #fff0c8 !important; text-shadow: none !important;
  text-decoration: none !important; background: ${T.red} !important; box-shadow: 0 0 0 1px rgba(40,14,4,0.65), inset 0 1px 0 rgba(255,190,150,0.35) !important; }
${G} body .dfchat-box .dfchat-tab.pinged .dfchat-badge:not(:empty) { background: #e2ad42 !important; color: ${T.ink} !important; -webkit-text-fill-color: ${T.ink} !important;
  box-shadow: 0 0 0 1px rgba(60,30,4,0.7), inset 0 1px 0 rgba(255,240,190,0.6) !important; }
${G} .dfchat-badge.ping { background: ${PING_COLOURS.bar.dark} !important; }
/* THE SOCIAL PANEL, on its scroll (2026-10-11: "those fonts need to be made readable"): a name keeps the colour its
   standing earns (a friend's blue, a party's green - set on the element, which no sheet's ink can re-say) deepened to
   read on the tan as the chat's names are - half as bright stood at 2.3:1 on the scroll, three tenths stands near 4:1 -
   and a plain name, a subject, a letter's own words are ink. INK-VARS reads the rest (its greys, its bone) as ink. */
${G} .dfsocial :is(.dfsocial-name, .dfsocial-subject)[style*="color"] { filter: brightness(0.3) saturate(1.6); text-shadow: none !important; }   /* (a party's and a friend's names: their own deepened colour, NAME-INK above) */
${G} .dfsocial :is(.dfsocial-name, .dfsocial-subject, .dfsocial-lettertext):not([style*="color"]) { color: ${T.ink} !important; text-shadow: none !important; }
${G} .dfsocial .dfsocial-letter.read .dfsocial-name { color: ${T.inkSoft} !important; }
${G} .dfchat-box :is(.dfchat-time, .dfchat-tag, .dfchat-whohead, .dfchat-who-more, .dfchat-who-tag) { color: ${T.inkSoft} !important; text-shadow: none !important; }
${G} .dfchat-box .dfchat-line.system .dfchat-text { color: #163a6a !important; text-shadow: none !important; }   /* CHAT-COLOURS: 5:1 on the cream page's darkest (the herald's #1f4f8e stood at 3.6) */
${G} .dfchat-box :is(.dfchat-time, .dfchat-tag) { color: #4f3218 !important; }   /* ...and a line's time and tag 5:1 too, on the mention's wash as well */
/* ...and with the box shut (Dudey: "make sure the blue event text is readable when the chat box is not open"), the lines
   that stand over the world wear the HUD's hard outline, every one - a herald's blue among them */
${G} .dfchat-peek, ${G} .dfchat-peek * {
  text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6) !important; }
${G} .dfchat-peek .dfchat-line.system .dfchat-text { color: #9cc8ff !important; }
/* CHAT-RP: a line of roleplay on the page - the deep green, leaning (ui/chatColours.js RP_COLOURS); over the world the light */
${G} .dfchat-box .dfchat-line.rp .dfchat-text { color: ${RP_COLOURS.dark} !important; text-shadow: none !important; font-style: italic; }
${G} .dfchat-peek .dfchat-line.rp .dfchat-text { color: ${RP_COLOURS.light} !important; }

/* THE OVERWORLD'S FILTERS - GRIM4 (Dudey: "the numbers next to the filters are hardly readable"): a count is written in
   ink at the face's own size, as its word is, on the same line; the block is wide enough that no word is cut, and the
   waypoints' hint wraps on its page instead of running off it. */
${G} .tview-side { width: 316px; }
${G} .tview-filter .tview-fnum { font-size: 16px !important; line-height: 20px; color: ${T.inkSoft} !important; text-shadow: none !important; opacity: 1; }
${G} .tview-filter.on .tview-fnum { color: ${T.ink} !important; }
${G} .tview-filter.tview-wp-pick { white-space: normal; overflow: visible; text-overflow: clip; line-height: 20px; }
/* THE PACE STEPS (Dudey: "the + next to the speed multiplayers is too close to the boxes"): the minus and the plus are
   drawn, not lettered - a glyph sits wherever its face put it in its cell - each a bar of ink at the grid's pixels,
   centred in its own step, the two steps the same breath either side of the number's well; red under the pointer */
${G} :is(.tview-pace-row, .travelpanel-pace-row, .pbox-pace-row) { grid-template-columns: 1fr 24px 66px 24px; column-gap: 6px; }
${G} :is(.tview-pace-num, .travelpanel-pace-num, .pbox-pace-num) { margin: 0 !important; }
${G} :is(.tview-pace-step, .travelpanel-pace-step, .pbox-pace-step) { position: relative; width: 24px; min-width: 0; padding: 0; font-size: 0 !important; color: transparent !important; }
${G} :is(.tview-pace-step, .travelpanel-pace-step, .pbox-pace-step)::before { content: ''; position: absolute; left: 50%; top: 50%;
  width: ${px(5, 'gq')}; height: ${px(1, 'gq')}; transform: translate(-50%, -50%); background: ${T.ink}; }
${G} :is(.tview-pace-num, .travelpanel-pace-num, .pbox-pace-num) + :is(.tview-pace-step, .travelpanel-pace-step, .pbox-pace-step)::after { content: ''; position: absolute; left: 50%; top: 50%;
  width: ${px(1, 'gq')}; height: ${px(5, 'gq')}; transform: translate(-50%, -50%); background: ${T.ink}; }
${G} :is(.tview-pace-step, .travelpanel-pace-step, .pbox-pace-step):is(:hover, :focus-visible):not(:disabled)::before,
${G} :is(.tview-pace-num, .travelpanel-pace-num, .pbox-pace-num) + :is(.tview-pace-step, .travelpanel-pace-step, .pbox-pace-step):is(:hover, :focus-visible):not(:disabled)::after { background: ${T.red}; }

/* THE HUD'S WORDS - a skill up, a loot line, the mode word: the pack's yellow lettering with its hard black edge, the
   way its death screen writes "Welcome Adventurer" */
${G} .notice.notice-toast, ${G} .lv-note.lv-note-skill .lv-note-title, ${G} .lv-note.lv-note-skill .lv-note-sub, ${G} .hud-modeword {
  color: ${T.yellow}; text-shadow: -1px 0 0 ${T.outline}, 1px 0 0 ${T.outline}, 0 -1px 0 ${T.outline}, 0 1px 0 ${T.outline}, 2px 2px 0 rgba(0,0,0,0.6); }
/* LEVEL-INK (2026-10-20, Dudey: "when leveling up the black fonts are hard to read"): the level strip's plates (a level
   risen or awaited, a Renown risen, a quest's word) are scraps of the page, so they are written in the page's full ink -
   the title in the pack's red, the line under it in the darkest ink (the key keeps its wooden box and its light word) -
   never the gold, the faint ink or a shadow the stone skins give them; and a hand big enough to read over a fight */
${G} .lv-note:not(.lv-note-skill) .lv-note-title, ${G} .lv-note:not(.lv-note-skill) .lv-note-gem { color: ${T.red} !important; text-shadow: none !important; opacity: 1 !important; }
${G} .lv-note:not(.lv-note-skill) .lv-note-title { font-size: 16px !important; letter-spacing: 0.08em !important; text-indent: 0.08em !important; }
${G} .lv-note:not(.lv-note-skill) .lv-note-sub { color: ${T.ink} !important; text-shadow: none !important; opacity: 1 !important; font-size: 18px !important; }
${G} .lv-note.lv-standing:not(.lv-note-skill) .lv-note-title { font-size: 14px !important; }
${G} .lv-note.lv-standing:not(.lv-note-skill) .lv-note-sub { font-size: 15px !important; }
${G} .hud-cross { filter: sepia(0.6) saturate(1.4); }
/* the crosshair's world plaque - a scrap of page held over the world, never a slab */
${G} .wplaque, ${G} .wplaque-stats { background: ${v('page')} 0 0 / 355px auto repeat, rgba(227,201,149,0.92); color: ${T.ink};
  border-color: rgba(92,56,24,0.8) rgba(60,34,14,0.85) rgba(48,26,10,0.9) rgba(80,48,20,0.8); box-shadow: 0 0 0 1px ${T.outline}, 3px 4px 10px rgba(0,0,0,0.45); }
/* THE PACK'S STATS PAGE AND ITS PLAQUES (Dudey: "the stat button is hard to read in inventory and the statpage is also
   hard to read and the armor shown is also hard to read"): what is written straight on the paper is in ink - the
   page's head, its "against a level" and its rules line - and the doll's two plaques (the flip to Stats / Paperdoll and
   the overall Armour) are scraps of page with dark letters, never faint words over the painting */
${G} .sf-head h3 { color: ${T.red} !important; text-shadow: none !important; }
${G} .sf-head p, ${G} .sf-chips-k, ${G} .sf-err { color: ${T.ink} !important; text-shadow: none !important; opacity: 1 !important; }
${G} .sf-foot { color: ${T.inkSoft} !important; text-shadow: none !important; opacity: 1 !important; }
${G} .statflip-btn, ${G} .wornac-total, ${G} .worntemp-total { background: ${v('page')} 0 0 / 355px auto repeat, rgba(227,201,149,0.96) !important; color: ${T.ink} !important;
  text-shadow: none !important; opacity: 1 !important; border: 2px solid ${T.outline} !important; border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px rgba(255,240,205,0.35), 2px 2px 0 rgba(0,0,0,0.45) !important; }
${G} .statflip-btn { padding: 2px 10px !important; }
/* FLIP-FIT (Dudey's pack: the Stats side stood ~300px wider than the card and, turned over, spilled LEFT under the
   jewellery column): the card's back is held to the card's own width - one track that never grows past it, faces that
   may shrink, the five tiles that share the width instead of standing on their words' width. */
${G} .pack-shell .statflip { min-width: 0 !important; max-width: 100% !important; }
${G} .pack-shell .statflip-inner { grid-template-columns: minmax(0, 1fr) !important; grid-template-rows: minmax(0, 1fr) !important; min-width: 0 !important; }
${G} .pack-shell .statflip-face { min-width: 0 !important; max-width: 100% !important; }
${G} .pack-shell .statflip-back { overflow: hidden !important; }
${G} .pack-shell .statflip-scroll { position: absolute !important; inset: 0 !important; max-width: 100% !important; }
${G} .pack-shell .statflip .sf-page { max-width: 100% !important; min-width: 0 !important; }
${G} .pack-shell .statflip .sf-tiles { grid-template-columns: repeat(auto-fit, minmax(min(100%, 84px), 1fr)) !important; }
${G} .pack-shell .statflip .sf-tile { min-width: 0 !important; overflow-wrap: break-word; }
${G} .statflip-btn:hover, ${G} .statflip-btn:focus-visible { color: ${T.red} !important; }
${G} .wornac-total .k, ${G} .worntemp-total .k { color: ${T.inkSoft} !important; text-shadow: none !important; opacity: 1 !important; }
${G} .wornac-total .v { color: ${T.red} !important; text-shadow: none !important; opacity: 1 !important; }
/* AUDIT C&C S4: the Felt plaque's number in the way its reading runs and its frame in its level, as the Plus plaque wears
   them, in inks deepened for the page (TEMP_INK) - the Armour plaque's red ink painted every reading the colour of a
   cost; and its costing mark (AUDIT C&C S14) inked on a scrap of the page */
${G} .worntemp-total .v { color: ${T.ink} !important; text-shadow: none !important; opacity: 1 !important; }
${G} .worntemp-total[data-side="cold"] .v { color: ${TEMP_INK.cold} !important; }
${G} .worntemp-total[data-side="hot"] .v { color: ${TEMP_INK.hot} !important; }
${G} .worntemp-total[data-level="warn"] { border-color: ${TEMP_INK.warn} !important; }
${G} .worntemp-total[data-level="danger"] { border-color: ${T.red} !important; }
${G} .worntemp-total[data-level="danger"]::after { color: ${T.red}; background: ${T.cream}; border-color: ${T.red}; text-shadow: none; }
/* ...and written on it in ink (Dudey, of the quick loot: "no one can read that" - the HUD's pale outlined letters were
   left on the paper): every word dark and flat, the lit row in red, a tier's colour deepened to read on paper */
${G} :is(.wplaque, .wplaque-stats), ${G} :is(.wplaque, .wplaque-stats) * { color: ${T.ink} !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; }
${G} :is(.wplaque-sub, .wplaque-count, .wplaque-keys, .wplaque-statkey, .wplaque-more, .wplaque-empty, .wplaque-renown) { color: ${T.inkSoft} !important; }
${G} .wplaque-title { color: ${T.ink} !important; }
${G} .wplaque-title::first-letter { color: ${T.red} !important; }
${G} .wplaque-row.sel { background: rgba(142,26,16,0.12) !important; box-shadow: inset 2px 0 0 ${T.red} !important; }
${G} .wplaque-row.sel, ${G} .wplaque-row.sel * { color: ${T.red} !important; }
${G} .wplaque-row[data-rarity="magic"] > span:first-child { color: #1f4f9e !important; }
${G} .wplaque-row[data-rarity="rare"] > span:first-child { color: #5c4600 !important; }
${G} .wplaque-row[data-rarity="legendary"] > span:first-child { color: #9a4210 !important; }
${G} .wplaque-row[data-rarity="aetheric"] > span:first-child { color: #1d6a86 !important; }
${G} .wplaque-row[data-rarity="artifact"] > span:first-child { color: #5e2a96 !important; }
${G} .wplaque-row[data-rarity="gilded"] > span:first-child { color: #7a4a00 !important; }
/* LOOT-MARKS (2026-10-12, a player's video: "seeing rarity in the quickloot is quite hard"): on the page the Rare, the
   Legendary and the Gilded were three browns - each rolled row now carries its tier's own bright gem, edged in ink, and
   a wash of its ink tone under it (ui/lootTierMarks.js); the lit row keeps its red bar beside the wash. */
${tierMarkCss({ scope: G, wash: (k) => RARITY_INK[k], washAlpha: 0.3, edge: T.outline, bang: true })}

/* INK-TONES (2026-10-10, a player: "make the fonts better visible ... the blue and Mora's Mantle ones ... don't make them
   totally different"): a rarity's, a set's and the sigil's words are drawn in their OWN colour - a CSS variable
   (--rar, --set, --sigil), which the ink cannot re-say - so on the page they stayed Plus's pale glow, made for black
   stone. On paper each is that same colour deepened into the ink: the tier's tone as the loot plaque already writes
   it, a set's own colour mixed down with the ink (so every set keeps its hue), the sigil's teal likewise. */
${Object.entries(RARITY_INK).map(([k, c]) => `${G} .card[data-rarity="${k}"] > ul.rarity > li:first-child, ${G} .card[data-rarity="${k}"] > .card-body > ul.rarity > li:first-child { color: ${c} !important; text-shadow: none !important; }`).join('\n')}
/* INK-VARS: the Sigil Broker's offers and its card's name, in their tier's colour (var(--rar)) - the aetheric's pale
   blue and the gilded's gold leaf stood on the parchment at under 1.5:1 - deepened into the ink as the card's tier line is */
${Object.entries(RARITY_INK).map(([k, c]) => `${G} [data-rarity="${k}"] .broker-name, ${G} .broker-card[data-rarity="${k}"] h3 { color: ${c} !important; text-shadow: none !important; }`).join('\n')}
/* the set's ribbon under the pack, and its block on an item's card */
${G} .setline { color: ${T.ink} !important; text-shadow: none !important;
  background: linear-gradient(90deg, rgba(var(--set-rgb),0.2), rgba(var(--set-rgb),0.06) 72%) !important;
  border-color: ${SET_INK} !important; box-shadow: inset 0 0 0 1px rgba(255,240,205,0.25) !important; }
${G} .setline:hover, ${G} .setline:focus-visible { background: linear-gradient(90deg, rgba(var(--set-rgb),0.32), rgba(var(--set-rgb),0.1) 76%) !important; }
${G} :is(.setline-name, .setline-count, .set-name, .set-count, .set-tier.awake .set-tier-name) { color: ${SET_INK} !important; text-shadow: none !important; }
${G} .setline-stage { color: ${T.inkSoft} !important; text-shadow: none !important; }
${G} .setline-pips i { background: rgba(43,26,12,0.12) !important; border-color: ${T.inkSoft} !important; }
${G} .setline-pips i.on { background: ${SET_INK} !important; border-color: ${T.ink} !important; box-shadow: none !important; }
/* a tier not yet awake is still written in ink - softer, never greyed out to nothing */
${G} .set-tier:not(.awake) { opacity: 1 !important; }
${G} .set-tier:not(.awake) :is(.set-tier-name, .set-tier-text) { color: ${T.inkFaint} !important; text-shadow: none !important; }
${G} .set-tier.awake .set-tier-text, ${G} .setbox p.set-stage { color: ${T.ink} !important; text-shadow: none !important; }
/* the sigil's block */
${G} .sigilbox:not([data-stage="dormant"]) :is(.sigil-word, .sigil-stage, .sigil-progress, p.sigil-progress) { color: ${SIGIL_INK} !important; text-shadow: none !important; }
${G} .sigilbox[data-stage="dormant"] :is(.sigil-word, .sigil-stage, .sigil-progress, p.sigil-progress, .sigil-effect) { color: ${T.inkFaint} !important; text-shadow: none !important; }

/* ASCEND - the pack's character sheet, open on the desk: the eight attributes written down the left-hand page as a
   ledger (the one chosen in red), the bonus points and the choice on the right-hand page, the skills on a strip of
   scroll under the book, the vials and the red Exit-framed Ascend on the plank at the foot. Plus's star map is gone:
   the stars ARE the ledger's lines - the same presses, laid out as the pack lays its sheet. */
${G} .lv-sky .px-vignette { display: none; }
${G} .lv-crown { background: ${WOOD(0.3)} !important; border-bottom: 2px solid ${T.outline}; box-shadow: 0 2px 0 rgba(255,214,150,0.15), 0 4px 10px rgba(0,0,0,0.5) !important; }
${G} .lv-crown .k { color: #c9a46a !important; text-transform: none; letter-spacing: 0.02em; }
${G} .lv-crown .v { color: ${T.cream} !important; }
${G} .lv-jump { color: ${T.yellow} !important; text-shadow: 1px 1px 0 ${T.outline}, 2px 2px 0 rgba(0,0,0,0.5) !important; }
${G} .lv-barnote { color: #c9a46a !important; }
${G} .lv-foot { background: ${WOOD(0.3)} !important; border-top: 2px solid ${T.outline}; box-shadow: 0 -2px 0 rgba(255,214,150,0.15) !important; }
${G} .lv-foot .k, ${G} .lv-foot .v { color: ${T.cream} !important; }
${G} .lv-vitals { gap: 32px; justify-content: center; }
/* the three vials stand centred under the book, the Ascend at the plank's right end - not centred in what the Ascend
   leaves of the plank (a third column the Ascend's own width balances it) */
@media (min-width: 1000px) and (min-height: 620px) {
  ${G} .lv-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: end; }
  ${G} .lv-foot > .lv-vitals { grid-column: 2; }
  ${G} .lv-foot > .lv-acts { grid-column: 3; justify-self: end; }
}
${G} .lv-vitals .px-mrow[data-grim-meter="vital"] { flex: 0 0 auto; width: min(${px(130, 'gq')}, calc((100vw - 420px) / 3)); }
${meterCss(['.lv-sky', '.lv-foot'])}
@media (min-width: 1000px) and (min-height: 620px) {
  ${G} .lv-sky { grid-template-columns: minmax(16px, 1fr) minmax(0, ${pxs(180)}) ${pxs(14)} minmax(0, ${pxs(180)}) minmax(16px, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr) auto auto minmax(0, 0.15fr) auto; }
  /* GRIM3: the book is the board's leather and its two pages, each drawn at the grid's own pixels (the same book every
     list-beside-a-page window is): the board behind (::before), the left page (::after), the right page the skills' own
     column - so no picture of a book is ever stretched to the screen */
  ${G} .lv-sky::after { content: ''; grid-column: 2 / 3; grid-row: 2 / 7; z-index: 0; position: relative; pointer-events: none;
    margin: ${pxs(4)} calc(-1 * ${pxs(7)}) ${pxs(3)} calc(-1 * ${pxs(4)}); ${bookPage('left', 'gs')}
    filter: drop-shadow(${pxs(1)} ${pxs(2)} 0 rgba(0,0,0,0.5)) drop-shadow(0 6px 14px rgba(0,0,0,0.45)); }
  ${G} .lv-crown { grid-column: 1 / -1; grid-row: 1; }
  /* the left-hand page: the eight attributes, and in the page left under them, centred both ways - the points still
     to give, then the chosen attribute between its - and its +, the way the pack's own chargen sets a value between
     its two arrows */
  ${G} .lv-stage { grid-column: 2; grid-row: 2 / 4; display: flex; flex-direction: column; margin-top: ${pxs(4 + BOOK_SLICE.top)}; padding: ${pxs(1)} ${pxs(BOOK_SLICE.gutter - 6)} 0 ${pxs(BOOK_SLICE.outer - 3)}; align-items: stretch; z-index: 1; min-height: 0; }
  /* GRIM5 (Dudey: "put the points left under the last number of the attributes not too close"): the points stand on the
     ledger's own columns - the box in the figures' column, its right edge on theirs, its word before it - a line's breath
     under the last attribute */
  ${G} .lv-plate { grid-column: 2; grid-row: 4; justify-self: stretch; align-self: end; z-index: 1; margin: 16px 0 0; font-size: 16px;
    padding: 0 calc(${pxs(BOOK_SLICE.gutter - 6)} + 10px) 0 calc(${pxs(BOOK_SLICE.outer - 3)} + 10px);
    display: grid; grid-template-columns: minmax(0, 1fr) auto 2.2em; column-gap: 10px; align-items: center; text-align: right; }
  ${G} .lv-plate { align-items: baseline !important; }
  ${G} .lv-plate > .lv-count { grid-column: 2; grid-row: 1; justify-self: end; margin-right: -12px !important; }
  ${G} .lv-plate > .lv-countk { grid-column: 1; grid-row: 1; justify-self: end; margin-right: 6px !important; }
  ${G} .lv-plate > :is(.lv-hint, .lv-refuse) { grid-column: 1 / 3; grid-row: 2; justify-self: end; max-width: none; }
  ${G} .lv-plate > * { position: static !important; margin: 0 !important; transform: none !important; inset: auto !important; }
  ${G} .lv-plate .lv-howto, ${G} .lv-plate .lv-hint:empty, ${G} .lv-plate .lv-refuse:empty { display: none; }
  ${G} .lv-plate .lv-hint, ${G} .lv-plate .lv-refuse { max-width: 200px; font-size: 16px; }
  ${G} .lv-plate .lv-countk { font-size: 16px; color: ${T.red} !important; }
  ${G} .lv-choice { grid-column: 2; grid-row: 5; align-self: start; justify-self: stretch; z-index: 1; margin: ${pxs(3)} ${pxs(BOOK_SLICE.gutter - 6)} 0 ${pxs(BOOK_SLICE.outer - 3)}; padding: 0; gap: 0; }
  ${G} .lv-choice .lv-ask { display: none; }
  ${G} .lv-choice .lv-pick { width: 100%; justify-content: center; align-items: center; gap: 6px; }
  ${G} .lv-choice .lv-pickname { width: auto; min-width: 190px; flex: 0 1 auto; }
  ${G} .lv-choice .lv-pickname .n { font-size: 32px !important; }
  ${G} .lv-choice .lv-pickname .f { font-size: 16px !important; }
  ${G} .lv-choice .lv-pick .lv-arrow, ${G} .lv-choice .lv-pick .lv-press { width: 36px; min-width: 36px; height: 36px; padding: 0; font-size: 32px; line-height: 32px; }
  ${G} .lv-choice .lv-pick .lv-press { color: ${T.red} !important; border: 0 !important; background: none !important; box-shadow: none !important; }
  ${G} .lv-choice .lv-pick .lv-press:disabled { opacity: 0.35; }
  ${G} .lv-choice .lv-blurb { width: 100%; max-width: none; min-height: 0; text-align: center; }
  ${G} .lv-choice .lv-blurb p { font-size: 16px; line-height: 16px; margin: 4px 0 0; }
  /* the right-hand page: the skills, written down it from the top to the foot */
  ${G} .lv-ribbonwrap { grid-column: 4; grid-row: 2 / 7; z-index: 1; min-height: 0; position: relative;
    margin: ${pxs(4)} calc(-1 * ${pxs(4)}) ${pxs(3)} calc(-1 * ${pxs(7)}); padding: ${pxs(1)} ${pxs(1)} ${pxs(1)} 0 !important;
    display: flex; flex-direction: column; ${bookPage('right', 'gs').replace(/;/g, ' !important;')} box-shadow: none !important;
    filter: drop-shadow(${pxs(1)} ${pxs(2)} 0 rgba(0,0,0,0.5)) drop-shadow(0 6px 14px rgba(0,0,0,0.45)); }
  ${G} .lv-ribbonwrap::before { content: 'Skills'; display: block; text-align: center; font-family: ${GRIMOIRE_STACK}; font-size: 32px; color: ${T.red};
    padding-bottom: 6px; margin-bottom: 8px; ${RULE_UNDER} }
  ${G} .lv-ribbon { flex: 1 1 auto; min-height: 0; display: grid !important; grid-template-columns: 1fr; grid-auto-rows: min-content; align-content: space-evenly;
    column-gap: 22px; overflow-x: hidden !important; overflow-y: auto !important; mask-image: none !important; -webkit-mask-image: none !important; padding: 0 !important; }
  /* GRIM4 (Dudey: "make sure theres not so much space left on the book pages when using different resolutions"): a long
     list (15 skills and more) is the same ledger as a short one - one column, its lines spread down the whole page,
     never packed at the top of it - at the face's small size; where the page is tall enough for every line at the
     large size it is written large, and only where it is too short for one column does it take two (the page is a
     size container: what it holds never sets its height) */
  ${G} .lv-ribbonwrap { container: lvpage / size; }
  ${G} .lv-ribbon:has(.lv-sk:nth-child(15)) { grid-template-columns: 1fr; grid-auto-rows: minmax(min-content, 1fr); align-content: stretch; }
  ${G} .lv-ribbon:has(.lv-sk:nth-child(15)) .lv-sk { align-content: center; padding-top: 2px !important; padding-bottom: 2px !important; }
  ${G} .lv-ribbon:has(.lv-sk:nth-child(22)) { grid-template-columns: 1fr 1fr; }
  @container lvpage (max-height: 620px) { ${G} .lv-ribbon:has(.lv-sk:nth-child(15)) { grid-template-columns: 1fr 1fr; } }
  @container lvpage (min-height: 860px) {
    ${G} .lv-ribbon:has(.lv-sk:nth-child(15)):not(:has(.lv-sk:nth-child(20))) .lv-sk .n,
    ${G} .lv-ribbon:has(.lv-sk:nth-child(15)):not(:has(.lv-sk:nth-child(20))) .lv-sk .v { font-size: 32px !important; }
  }
  ${G} .lv-sk { display: grid !important; grid-template-columns: 1fr auto 14px; align-items: baseline; gap: 0 8px; width: auto !important; min-height: 0 !important;
    padding: 6px 8px !important; border-bottom: 1px solid rgba(92,56,24,0.45) !important; text-align: left; }
  ${G} .lv-sk .n { font-size: 32px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  ${G} .lv-sk .v { font-size: 32px !important; }
  ${G} .lv-ribbon:has(.lv-sk:nth-child(15)) .lv-sk .n, ${G} .lv-ribbon:has(.lv-sk:nth-child(15)) .lv-sk .v { font-size: 16px !important; }
  ${G} .lv-sk.on { background: rgba(142,26,16,0.13) !important; box-shadow: none !important; }
  ${G} .lv-skrole { margin: 8px 0 0; text-align: center; font-size: 16px; }
  ${G} .lv-foot { grid-column: 1 / -1; grid-row: 7; }
}
/* the ledger */
${G} .lv-lines { display: none; }
${G} .lv-figure { width: 100% !important; height: auto !important; aspect-ratio: auto !important; max-height: none !important;
  display: flex; flex-direction: column; justify-content: flex-start; gap: 0; }
/* GRIM3 (Dudey: "the spaces between the atributes can be a bit bigger ... them empty space where the left stat points
   are in is a bit much"): on the open book the eight lines share the page down to the points, each its own airy line */
@media (min-width: 1000px) and (min-height: 620px) {
  ${G} .lv-stage > .lv-figure { flex: 1 1 auto; min-height: 0; display: grid !important; grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto repeat(8, minmax(0, 1fr)); align-content: stretch; justify-content: stretch; }
  ${G} .lv-stage > .lv-figure > .lv-star { align-items: center !important; padding-top: 4px !important; padding-bottom: 4px !important; }
}
${G} .lv-figure::before { content: 'Attributes'; display: block; text-align: center; font-family: ${GRIMOIRE_STACK}; font-size: 32px; color: ${T.red};
  padding-bottom: 6px; margin-bottom: 8px; ${RULE_UNDER} }
${G} .lv-star { position: relative !important; left: auto !important; top: auto !important; transform: none !important;
  display: grid !important; grid-template-columns: 1fr auto 2.2em; align-items: baseline; gap: 0 10px; width: 100%;
  padding: 2px 10px !important; background: none !important; border: 0; text-align: left; }   /* GRIM5: no dotted rule under each (Dudey: "remove those dotted lines") */
${G} .lv-star .lv-gem { display: none !important; }
${G} .lv-star .lv-name { font-size: 32px !important; letter-spacing: 0 !important; text-indent: 0 !important; text-transform: none !important;
  color: ${T.ink} !important; text-shadow: none !important; }
${G} .lv-star .lv-val { font-size: 32px !important; color: ${T.ink} !important; text-shadow: none !important; }
${G} .lv-star .lv-delta { font-size: 16px !important; color: ${T.red} !important; text-shadow: none !important; }
${G} .lv-star:hover .lv-name, ${G} .lv-star:focus-visible .lv-name { color: ${T.redHi} !important; }
${G} .lv-star.on { background: rgba(142,26,16,0.1) !important; box-shadow: inset 4px 0 0 ${T.red}; }
${G} .lv-star.on .lv-name, ${G} .lv-star.on .lv-val, ${G} .lv-star.raised .lv-val { color: ${T.red} !important; }
${G} .lv-star.full .lv-val { color: ${T.inkFaint} !important; }
${G} .lv-star.boosted:not(.full) .lv-val { color: #1f3a8a !important; }
${G} .lv-star.lowered:not(.full) .lv-val { color: #8a3a0a !important; }
/* the right-hand page: the bonus points, the choice and its gloss */
/* GRIM5 (Dudey: "make sure that the points left in the box are centralized"): the figure's ink in the box's very middle -
   the face sets a digit high in its line and leaves its spacing at the right, so the box pads it down and across */
${G} .lv-count { font-size: 32px !important; line-height: 32px; padding: 7px 10px 3px 12px; display: block !important;
  width: auto !important; height: auto !important; min-width: 0; box-sizing: border-box; text-align: right !important; text-indent: 0 !important; letter-spacing: 0 !important;
  color: ${T.red} !important; text-shadow: none !important; background: none !important;
  border: 2px solid rgba(60,34,14,0.75) !important; box-shadow: inset 0 0 0 3px rgba(227,201,149,0.9), inset 0 0 0 4px rgba(60,34,14,0.5) !important; }
${G} .lv-countk, ${G} .lv-howto, ${G} .lv-hint, ${G} .lv-refuse, ${G} .lv-ask, ${G} .lv-blurb p { color: ${T.inkSoft} !important; text-shadow: none !important; text-transform: none !important; letter-spacing: 0.01em !important; }
${G} .lv-ask { color: ${T.red} !important; font-size: 18px; ${RULE_UNDER} padding-bottom: 4px; }
${G} .lv-pickname { background: none !important; border: 0 !important; box-shadow: none !important; }
${G} .lv-pickname .n { color: ${T.red} !important; font-size: 30px !important; text-shadow: none !important; }
${G} .lv-pickname .f, ${G} .lv-pickname .c { color: ${T.ink} !important; text-shadow: none !important; }
${G} .lv-pick .lv-arrow, ${G} .lv-pick .lv-press { background: none !important; border-color: transparent !important; box-shadow: none !important;
  color: ${T.ink} !important; text-shadow: none !important; font-size: 26px; }
${G} .lv-pick .lv-arrow:hover, ${G} .lv-pick .lv-press:hover { color: ${T.red} !important; background: rgba(142,26,16,0.08) !important; }
/* the skills: on a narrow screen a strip of the tan scroll under the book; on a wide one, the right-hand page */
@media not all and (min-width: 1000px) and (min-height: 620px) {
  ${G} .lv-ribbonwrap { background: ${SCROLL} !important; border: 0 !important;
    box-shadow: 0 0 0 2px rgba(60,34,14,0.6), 0 0 0 4px #8a6436, 0 0 0 5px ${T.outline}, 4px 8px 14px 5px rgba(0,0,0,0.45) !important; }
}
${G} .lv-sk { background: none !important; border-color: transparent !important; box-shadow: none !important; }
${G} .lv-sk .n, ${G} .lv-sk .v { color: ${T.ink} !important; text-shadow: none !important; }
${G} .lv-sk.on .n, ${G} .lv-sk.on .v, ${G} .lv-sk .lv-up { color: ${T.red} !important; }
${G} .lv-skrole, ${G} .lv-skrole .g { color: ${T.inkSoft} !important; text-shadow: none !important; }

`;
}

// ── THE ROSTERS: where things stand, as the pack stands them ─────────────────────────────────────────────────────────
/** The desk picture's geometry (BIOG00I0, 960 x 600): the open book's two pages, as fractions of the picture. The front
 *  door lays the picture over the screen at `--gbw` wide (never narrower than the screen, never shorter than it) with its
 *  foot on the screen's foot - which keeps the picture's own "Biography" off the top on a 16:9 screen and under the
 *  wordmark on a 16:10 one - and writes its doors on those pages. */
export const DESK_BOOK = Object.freeze({ x: 75 / 960, y: 208 / 600, w: 755 / 960, h: 372 / 600, spine: 13 / 755 });
/** AUDIT UICALM-FIRM1 L3 M1: and tall enough for the two questions' leaves - under PX8's short line the book's fixed type ran
 *  "Thine Own Tale" into "Offline", its rule through the word and the lines off the page (932x430, 1280x480); there the
 *  one page held up stands instead, as on a phone */
const BOOK_MQ = '(min-width: 900px) and (min-aspect-ratio: 5/4) and (min-height: 561px)';
/** The painted book's spine stands at 388 of its 786 pixels: each half drawn across its own column. */
export const BOOK_SPINE = 388 / 786;
export function rosterCss() {
  const B = DESK_BOOK;
  const ink3 = `${T.red}`;
  return `
/* ── GRIM2: THE ROSTERS - each screen stood where the pack stands it ── */

/* THE FRONT DOOR - the pack's desk, its book open, and the doors written on its two pages in ink, the way the pack's
   own chooser writes "Would you like to:" - no stack of presses down the middle of the screen. */
${G} .px-home:not(.px-over):not(.lv-sky) { --gbw: ${px(320, 'gd')}; --gbh: ${px(200, 'gd')};
  --gbx: calc((100vw - var(--gbw)) / 2); --gby: calc((100vh - var(--gbh)) / 2); background: #120a05; }
/* GRIM6 (Dudey: "the background around the book looks too pixelated washed out"): the desk is the pack's own painting at
   ITS resolution, drawn smooth, never the game-grid cut blown up pixel by pixel; it stands where GRIM3 set it.
   GRIM3: the desk is Daggerfall's 320 x 200 picture, whole - the candle, the inkwell, the quill - at the biggest whole
   number of screen pixels to each of its own it fits at (--gd: ui/grimoireArt.js deskScale - DESK-FILL: now the exact fit, the whole desk as big as the screen holds it), centred, its edges
   falling away into the dark room round it; never scaled by a part of a pixel, never smoothed, and worked on its own
   grid (grimoireArt.js clarify) so the grain, the brass and the paper read crisp (Dudey: "the main screen background
   looks like i have not glasses on") */
/* DESK-HD: the detailed desk (ui/grimoireArt.js grimoireDeskUrl), its room's dark edges already in it - so no
   vignette is laid over it again; the pack's BIOG00I0 stands under it, seen only if the painting cannot load */
${G} .px-home:not(.px-over):not(.lv-sky)::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: url("${grimoireDeskUrl()}") var(--gbx) var(--gby) / var(--gbw) var(--gbh) no-repeat,
    url("${grimoireImg('BIOG00I0')}") var(--gbx) var(--gby) / var(--gbw) var(--gbh) no-repeat; image-rendering: auto; }
${G}[data-grim-backdrop="map"] .px-home:not(.px-over):not(.lv-sky)::before { background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 100%),
  url("${grimoireImg('TMAP00I0')}") center / cover no-repeat; }
${G} .px-home:not(.px-over):not(.lv-sky) .px-rule { display: none; }
@media ${BOOK_MQ} {
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) > .px-stage:not(.px-acctstage) { display: block; padding: 0; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-wordmark { position: absolute; left: 50%; top: max(4px, calc(var(--gby) + var(--gbh) * 0.005));
    translate: -50% 0; width: min(calc(var(--gbw) * 0.3), 470px); z-index: 1; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.6)); }
  /* UI-CALM (ui/enhanced/enhancedMenu.js drawDoors): THE BOOK'S TWO LEAVES ARE THE DOOR'S TWO PAGES - the two questions, The
     Realm (Online) on the left and Thine Own Tale (Offline) on the right, each its own head, its word and a line in a
     smaller hand under it; the offline level its games on the left and the way back on the right; Settings and
     Overhauls two small plaques across the foot of the book */
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu {
    position: absolute; box-sizing: border-box;
    left: calc(var(--gbx) + var(--gbw) * ${B.x.toFixed(4)}); top: calc(var(--gby) + var(--gbh) * ${B.y.toFixed(4)});
    width: calc(var(--gbw) * ${B.w.toFixed(4)}); height: calc(var(--gbh) * ${B.h.toFixed(4)});
    padding: calc(var(--gbh) * 0.05) calc(var(--gbw) * 0.045) calc(var(--gbh) * 0.04);
    display: grid; grid-template-columns: 1fr 1fr; column-gap: calc(var(--gbw) * 0.09); grid-template-rows: minmax(0, 1fr) auto;
    align-content: stretch; row-gap: calc(var(--gbh) * 0.012); }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .px-page { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: calc(var(--gbh) * 0.012);
    grid-row: 1; min-height: 0; min-width: 0; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .px-page:first-of-type { grid-column: 1; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .px-page + .px-page { grid-column: 2; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .px-pagehead { display: block; margin: 0 0 calc(var(--gbh) * 0.012); padding-bottom: calc(var(--gbh) * 0.012);
    font-family: ${GRIMOIRE_STACK}; font-weight: normal; font-size: 32px; letter-spacing: 0; text-transform: none; color: ${ink3};
    ${RULE_UNDER} width: 80%; text-align: center; text-shadow: none; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .px-pagenote { display: block; margin: 0; font-family: ${GRIMOIRE_STACK}; font-size: 22px; line-height: 1.2; color: ${T.ink};
    opacity: 0.8; text-align: center; text-shadow: none; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu[data-level="top"] .px-page { justify-content: center; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu[data-level="top"] .px-pagehead { margin-bottom: calc(var(--gbh) * 0.03); }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu[data-level="top"] .doorbtn { font-size: 48px; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .door-word { gap: calc(var(--gbh) * 0.006); }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .door-sub { font-family: ${GRIMOIRE_STACK}; font-size: 22px; line-height: 1.2; letter-spacing: 0; text-transform: none;
    color: ${T.ink}; opacity: 0.78; text-shadow: none; max-width: 15em; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:hover .door-sub, ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:focus-visible .door-sub { color: ${T.red}; text-shadow: none; opacity: 1; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn.door-back { margin-top: auto; font-size: 26px; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn {
    width: auto; min-height: 0; margin: 0; padding: calc(var(--gbh) * 0.006) 0.4em; justify-content: center;
    background: none; border: 0; border-radius: 0; box-shadow: none; translate: none; filter: none;
    font-size: 32px; letter-spacing: 0; color: ${T.ink}; text-shadow: 0 1px 0 rgba(255,240,205,0.45); }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn .px-c { display: none; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:hover,
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:focus-visible {
    background: none; color: ${T.red}; text-decoration: none; outline: none; }   /* UI-CALM: the red ink alone, no dotted rule */
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:disabled { background: none; filter: none; color: rgba(43,26,12,0.38); text-shadow: none; }
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-foot { position: absolute; left: 0; right: 0; bottom: 0; }
}
@media ${BOOK_MQ} and (min-height: 1250px) {
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn,
  ${G}:not([data-grim-backdrop="map"]) .px-home:not(.px-over):not(.lv-sky) .px-menu .px-pagehead { font-size: 48px; }
}
/* the map, or a screen too narrow for the book: the doors on one page, held up over it */
@media not all and ${BOOK_MQ} {
  ${G} .px-home:not(.px-over):not(.lv-sky) .px-menu { background: ${PAGE}; padding: 22px 26px; gap: 4px;
    border: 2px solid; border-image: ${v('frame')} ${FRAME_ART.band} / ${FRAME_ART.band}px / ${FRAME_ART.band - 14}px round; box-shadow: 6px 10px 26px rgba(0,0,0,0.65); }
}
${G}[data-grim-backdrop="map"] .px-home:not(.px-over):not(.lv-sky) .px-menu { background: ${PAGE}; padding: 22px 26px; gap: 4px;
  border: 2px solid; border-image: ${v('frame')} ${FRAME_ART.band} / ${FRAME_ART.band}px / ${FRAME_ART.band - 14}px round; box-shadow: 6px 10px 26px rgba(0,0,0,0.65); }
${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn .px-c { display: none; }
/* AUDIT UICALM-FIRM1 L3 M8: a phone's rail is the page it is written on - the shell's phone rule laid it on the dark,
   under the page's ink ("Main menu" read at 1.29:1) */
@media (max-width: 860px), (pointer: coarse) { ${G} .shell:not(.wizard) .rail { background: ${PAGE} !important; } }
/* UI-CALM: the shell's rail - Offline's word a small head in the page's red over its four, never read as a door */
${G} .rail .railgroup { margin: 18px 24px 2px; font-family: ${GRIMOIRE_STACK}; font-size: 16px; letter-spacing: 0.04em; text-transform: none;
  color: ${T.redDeep}; border-bottom: 1px solid rgba(43,26,12,0.25); padding-bottom: 2px; }   /* AUDIT UICALM-FIRM1 L3 M8: the deep red, whole - its 0.85 of the red read at 3.4:1 */
/* UI-CALM II (2026-10-14, a player: "cheap letters, overlapping, dotted lines everywhere, the highlighting of words is
   bad, the summary board looks cut off"): THE WALK IN THE PACK'S OWN HAND. A question's answers are leaves of the
   pack's parchment in its frame, the word in ink and the chosen one in its red with a red line inside the frame -
   never a yellow word on the bare desk with a rule under it; a press in the bar is a plate, its word cream, the way on
   in the yellow; the map's names are parchment tags, the chosen one red; no word on the walk wears a rule under it or a
   doubled shadow. */
${G} .wizard .choose h2 { color: ${T.cream} !important; font-size: 32px !important; letter-spacing: 0 !important; text-shadow: 0 2px 0 rgba(0,0,0,0.65) !important; }
${G} .wizard .choose h2::before, ${G} .wizard .choose h2::after { display: none; }
${G} .wizard .bigchoice .bigbtn, ${G} .wizard .bigchoice .bigbtn[data-grim-on] { background: ${PAGE} !important; border: 2px solid !important;
  border-image: ${v('frame')} ${FRAME_ART.band} / ${FRAME_ART.band}px / 0 round !important; border-radius: 0 !important;
  color: ${T.ink} !important; text-shadow: none !important; text-decoration: none !important; font-size: 32px !important;
  box-shadow: 4px 6px 14px rgba(0,0,0,0.55) !important; filter: none !important; translate: none !important; }
${G} .wizard .bigchoice .bigbtn .bigk { color: ${T.ink} !important; font-size: 32px !important; text-shadow: none !important; }
${G} .wizard .bigchoice .bigbtn .bign { color: ${T.inkSoft} !important; font-size: 16px !important; text-shadow: none !important; }
${G} .wizard .bigchoice .bigbtn:hover, ${G} .wizard .bigchoice .bigbtn:focus-visible,
${G} .wizard .bigchoice .bigbtn:hover .bigk, ${G} .wizard .bigchoice .bigbtn:focus-visible .bigk { color: ${T.red} !important; outline: none !important; }
${G} .wizard .bigchoice .bigbtn.on, ${G} body .wizard .stagebody .bigchoice .bigbtn.bigbtn.on.on[data-grim-on]:not(:hover):not(:focus-visible) { color: ${T.red} !important; box-shadow: inset 0 0 0 3px rgba(142,26,16,0.7), 4px 6px 14px rgba(0,0,0,0.55) !important; }
${G} .wizard .bigchoice .bigbtn.on .bigk, ${G} body .wizard .stagebody .bigchoice .bigbtn.on .bigk.bigk { color: ${T.red} !important; }
/* the presses on the walk - the bar's, a card's, a stage's own - are plates on the desk; on a card, the card's ink */
${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act, ${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act[data-grim-on] {
  background: rgba(28,17,8,0.72) !important; border: 2px solid rgba(239,220,174,0.32) !important; border-image: none !important; border-radius: 0 !important;
  color: ${T.cream} !important; text-decoration: none !important; text-shadow: none !important; font-size: 16px !important; line-height: 20px !important;
  padding: 8px 22px !important; min-height: 40px !important; box-shadow: none !important; filter: none !important; translate: none !important; }
${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act.primary { border-color: ${T.yellowDeep} !important; color: ${T.yellow} !important; }
${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act:hover:not(:disabled), ${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act:focus-visible {
  background: rgba(70,42,18,0.85) !important; border-color: ${T.cream} !important; color: #fff6dc !important; outline: none !important; }
${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act:disabled { opacity: 0.45 !important; }
${G} .wizard :is(.actionbar, .choose .acts, .skillpane .acts) .act.primary:disabled { opacity: 0.85 !important; }   /* AUDIT UICALM-FIRM1 L3 M5: a way on that waits reads ("18 left to spend") */
${G} .wizard .actionbar { background: rgba(20,12,5,0.72) !important; border-top: 2px solid rgba(239,220,174,0.16) !important; }
${G} .wizard .dcard .acts .act, ${G} .wizard .dcard .acts .act[data-grim-on] { background: none !important; border: 2px solid rgba(92,56,24,0.55) !important;
  border-image: none !important; color: ${T.ink} !important; text-decoration: none !important; text-shadow: none !important;
  font-size: 16px !important; padding: 6px 14px !important; min-height: 0 !important; box-shadow: none !important; filter: none !important; translate: none !important; }
${G} .wizard .dcard .acts .act.primary { border-color: ${T.red} !important; color: ${T.red} !important; }
${G} .wizard .dcard .acts .act:hover, ${G} .wizard .dcard .acts .act:focus-visible { background: rgba(142,26,16,0.1) !important; color: ${T.redHi} !important; outline: none !important; }
${G} .wizard .dcard p { text-shadow: none !important; }
/* the name: a line of the page to write on, and Suggest one a plate under it */
${G} .wizard .choose .namebox { background: ${PAGE} !important; color: ${T.ink} !important; font-size: 32px !important; text-shadow: none !important;
  border: 2px solid ${T.outline} !important; box-shadow: inset 0 0 0 2px rgba(92,56,24,0.35), 4px 6px 14px rgba(0,0,0,0.5) !important; caret-color: ${T.red}; }
${G} .wizard .choose .namebox:focus { box-shadow: inset 0 0 0 2px ${T.red}, 4px 6px 14px rgba(0,0,0,0.5) !important; }
/* the faces: frames on the desk, the chosen one ringed in the yellow */
${G} .wizard .facegrid button.on { outline: 3px solid ${T.yellowDeep} !important; outline-offset: 2px; }
/* the walk's lists (classes, attributes, skills) on the desk's wood, a row's word cream and its line the tan */
${G} .wizard .stagebody > .list, ${G} .wizard .stagebody.solo > .skillpane { border: 2px solid transparent !important;
  border-image: ${v('frame')} ${FRAME_ART.band} / ${FRAME_ART.band}px / 0 round !important; box-shadow: 6px 10px 26px rgba(0,0,0,0.55) !important;
  padding: 14px 16px !important; box-sizing: border-box; }
/* the chosen row on the wood: the pack's yellow at its edge and a lighter grain - not a box round the row and its presses */
${G} .wizard .list .row.on, ${G} .wizard .skillpane .row.on { outline: none !important; border-color: transparent !important;
  background: linear-gradient(90deg, rgba(244,224,76,0.16), rgba(244,224,76,0.03) 70%) !important; box-shadow: inset 3px 0 0 ${T.yellow} !important; }
${G} .wizard .list .row.on .row-name, ${G} .wizard .skillpane .row.on .row-name { color: ${T.yellow} !important; }
/* CURSOR-EDGE: the walk's scrollers in the dress's own ::-webkit-scrollbar (the wood's lit grain; the card's ink on its
   parchment) - the standard pair only where that is not, or Chromium draws the native one */
${G} .wizard::-webkit-scrollbar-thumb, ${G} .wizard ::-webkit-scrollbar-thumb { background: ${T.woodLit}; }
${G} .wizard .dcard::-webkit-scrollbar-thumb, ${G} .wizard .dcard ::-webkit-scrollbar-thumb { background: rgba(92,56,24,0.6); }
@supports not selector(::-webkit-scrollbar) {
${G} .wizard, ${G} .wizard * { scrollbar-width: thin; scrollbar-color: ${T.woodLit} transparent; }
${G} .wizard .dcard, ${G} .wizard .dcard * { scrollbar-color: rgba(92,56,24,0.6) transparent; } }
${G} .wizard .stagebody.solo > .skillpane { background: ${WOOD(0.32)}; }
${G} .wizard .row-name { color: ${T.cream} !important; text-shadow: 0 1px 0 rgba(0,0,0,0.6) !important; }
${G} .wizard .row-sub { color: #d6b98a !important; text-shadow: none !important; }
${G} .wizard .classlist .classway { color: ${T.yellow} !important; border-bottom: 2px solid rgba(200,165,42,0.4) !important; text-shadow: none !important; }
/* the class's bars in the page's own ink and red (AUDIT UICALM-FIRM1 L5 L3: the calm sheet's dark bar and its amber
   stood on the page) */
${G} .wizard .cprof-bar { border-color: rgba(43,26,12,0.55); background: rgba(43,26,12,0.12); }
${G} .wizard .cprof-fill { background: ${T.redDeep}; }
/* the map of Tamriel: its lands parchment-pale on the desk, the chosen one in the red; the names parchment tags */
${G} .wizard .prov { fill: rgba(227,201,149,0.2); stroke: rgba(239,220,174,0.5); stroke-width: 0.7; }
${G} .wizard .prov.hot:not(.inert), ${G} .wizard .prov:not(.inert):hover { fill: rgba(227,201,149,0.38); stroke: ${T.cream}; }
${G} .wizard .prov.on { fill: rgba(142,26,16,0.5); stroke: ${T.goldLeaf}; stroke-width: 1; }
${G} .wizard .prov.inert { fill: rgba(0,0,0,0.28); stroke: rgba(239,220,174,0.2); }
${G} .wizard .maplabel { background: ${PAGE} !important; color: ${T.ink} !important; font-size: 16px !important; line-height: 18px !important;
  border: 1px solid ${T.outline} !important; text-shadow: none !important; text-decoration: none !important; box-shadow: 0 2px 0 rgba(0,0,0,0.5) !important; }
${G} .wizard .maplabel.hot, ${G} .wizard .maplabel:hover, ${G} .wizard .maplabel:focus-visible { color: ${T.red} !important; outline: none !important; }
${G} .wizard .maplabel.on { background: ${T.red} !important; color: ${T.cream} !important; }
${G} .wizard .maplabel.inert { background: none !important; border: 0 !important; box-shadow: none !important; color: rgba(239,220,174,0.55) !important; font-style: normal; }
/* UI-CALM II: THE SETTINGS LIST ON THE DESK - every option one line of the wood, a Features row no longer a plate of
   its own among bare rows; the tags under a name in the tan, no boxes; the card beside the list clear of the top */
${G} .panes.opt .opt-body .ft-tile { background: none !important; border: 0 !important; border-image: none !important; box-shadow: none !important;
  border-bottom: 1px solid rgba(239,220,174,0.12) !important; margin: 0 !important; filter: none !important; }
${G} .panes.opt .opt-body .ft-tile:hover, ${G} .panes.opt .opt-body .ft-tile.sel { background: rgba(0,0,0,0.22) !important; }
${G} .panes.opt .opt-body > .row { border-bottom: 1px solid rgba(239,220,174,0.12) !important; }
${G} .panes.opt .kind { background: none !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; color: #d6b98a !important; text-shadow: none !important; }
${G} .panes.opt .sec-head { border-bottom: 2px solid rgba(200,165,42,0.35) !important; }
${G} .panes.opt .sec-head .count { color: #c9a66b !important; text-shadow: none !important; }
@media (min-width: 861px) { ${G} .panes.opt > .detail { padding-top: 18px !important; box-sizing: border-box; } }
/* UI-CALM: on the one page held up (the map, a narrow screen) the level's head, its line and each door's line are the
   page's own ink - the heads in its red, the lines in its brown; the book's leaves say the same at their own size */
${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .px-pagehead { font-family: ${GRIMOIRE_STACK}; font-weight: normal; font-size: 26px;
  letter-spacing: 0; text-indent: 0; text-transform: none; color: ${ink3}; text-shadow: none; }
${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .px-pagenote, ${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .door-sub {
  font-family: ${GRIMOIRE_STACK}; font-size: 18px; letter-spacing: 0; text-transform: none; color: ${T.ink}; opacity: 0.8; text-shadow: none; }
${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn.door-back { font-size: 22px; letter-spacing: 0; text-indent: 0; }
${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn { justify-content: center; background: none; border: 0; border-radius: 0; box-shadow: none;
  translate: none; filter: none; letter-spacing: 0; text-indent: 0; color: ${T.ink}; text-shadow: 0 1px 0 rgba(255,240,205,0.45); }
${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:hover, ${G} .px-home:not(.px-over):not(.lv-sky) .px-menu .doorbtn:focus-visible {
  background: none; color: ${T.red}; text-decoration: none; outline: none; }   /* UI-CALM: the red ink alone, no dotted rule */
${G} .px-home:not(.px-over):not(.lv-sky) .px-wordmark { background: radial-gradient(ellipse 60% 55% at 50% 45%, rgba(28,17,8,0.92) 35%, rgba(28,17,8,0) 72%); }

/* THE INVENTORY - the pack's own: its wooden tab plates in one row across the top, the jewellery down the left as
   pairs of shelf boxes each named beneath, the body on the grey marble in the middle, the goods in shelf boxes on the
   right. (Wide screens; a phone keeps the stacked pack.) */
@media (min-width: 1000px) {
  ${G} .pack-shell .pack { display: grid; grid-template-columns: 132px minmax(0, 1fr) minmax(230px, 290px);
    grid-template-rows: auto minmax(0, 1fr); grid-template-areas: "tabs tabs tabs" "shelf doll list"; gap: 10px 12px; padding: 8px 14px 10px; }
  ${G} .pack-shell .pack-main, ${G} .pack-shell .charcol, ${G} .pack-shell .pack-dock { display: contents; }
  ${G} .pack-shell .packcats { grid-area: tabs; padding: 0; border: 0; overflow: visible; }
  ${G} .pack-shell .pack-dock .packcats .packtabs, ${G} .pack-shell .packtabs { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 4px; }
  ${G} .pack-shell .pack-dock .packtab { min-height: 30px; padding: 2px 6px; justify-content: center; font-size: 13px; }
  ${G} .pack-shell .equipped { grid-area: doll; min-height: 0; padding: 10px; background: ${v('stone')} 0 0 / 310px auto repeat, #6b6b68;
    border: 2px solid; border-color: ${T.outline} ${T.woodLit} ${T.goldLeaf} ${T.woodMid};
    box-shadow: 0 0 0 3px ${T.wood}, 0 0 0 4px ${T.outline}, inset 3px 4px 10px rgba(0,0,0,0.45); }
  /* PACK-ROOM (2026-10-10): the worn map is held to its column (STATS-OVERLAP), and there the figure - as wide as it is
     tall allows - left each flank ~80px, a pair's names broken a letter at a time ("Mo/un/t"). The goods give 40px
     back and the figure stands at most 210px wide: each flank about twice what it was, its names whole words. */
  ${G} .pack-shell .wornmap-doll.hasart { max-width: 210px; }
  ${G} .pack-shell .wornshelf { grid-area: shelf; flex-direction: column; justify-content: space-between; gap: 6px; margin: 0; padding: 4px 0; }
  ${G} .pack-shell .shelfgrp { flex: 0 0 auto; gap: 2px; }
  ${G} .pack-shell .shelflabel { font-size: 14px; color: #e3c27a; text-shadow: 1px 1px 0 ${T.outline}, 2px 2px 0 rgba(0,0,0,0.5); }
  /* BELT-LANTERN: the column holds seven groups now (the Lantern's under the Crystals) - each socket is the column's height
     shared out (--shelf-n, the groups drawn: the shelf's own count) less the names, never past the 56px box it was, so
     the column never runs under the band at any window's height */
  ${G} .pack-shell .wornshelf { container-type: size; gap: 2px; padding: 2px 0; }
  ${G} .pack-shell .wornshelf { --sock: min(56px, calc((100cqh - var(--shelf-n, 6) * 19px - (var(--shelf-n, 6) - 1) * 2px) / var(--shelf-n, 6))); }
  ${G} .pack-shell .shelfpair { width: auto; max-width: none; grid-template-columns: repeat(2, var(--sock)); justify-content: center; }
  ${G} .pack-shell .shelfpair.shelfone { grid-template-columns: var(--sock); }
  ${G} .pack-shell .wornsock { width: var(--sock); height: var(--sock); max-height: none; aspect-ratio: auto; }
  ${G} .pack-shell .shelflabel { line-height: 17px; }
  ${G} .pack-shell .packlists { grid-area: list; min-height: 0; padding: 8px; background: rgba(14,8,3,0.55);
    border: 2px solid; border-color: ${T.outline} ${T.woodLit} ${T.woodLit} ${T.woodMid}; box-shadow: inset 2px 3px 8px rgba(0,0,0,0.55); }
  ${G} .pack-shell .charcol > :not(.equipped):not(.wornshelf), ${G} .pack-shell .pack-dock > :not(.packcats):not(.packlists) { grid-column: 2 / 4; }
  /* SET-ROW (2026-10-11, Mac: "this shouldnt happen the inventory box next to the paperdoll shouldnt get smaller aswell"):
     the worn sets' lines stood in a row of their own across the doll AND the goods, and the goods' box gave up their
     height. They are the doll's: a row under the doll alone, the goods' box running down beside them to the band */
  ${G} .pack-shell .pack:has(> .pack-main .setstrip, .setstrip) { grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: "tabs tabs tabs" "shelf doll list" "shelf sets list"; }
  ${G} .pack-shell .charcol > .setstrip { grid-area: sets !important; margin: 0 !important; min-width: 0; }
}
/* THE BOOKS - a window that is a list beside a page (the character and system window, the spellbook, the chronicle)
   is the pack's open book laid on its desk: the list on the left-hand page, the page it opens on the right, the spine
   between them - and the presses on a page are WRITTEN on it, the way the pack's spellbook writes Delete, Up, Sort and
   Down along its foot, the one it is for in red.
   GRIM3 (Dudey: "the book is in a window thats in a window"; "keep the style ... POLISH it"): the book lies on the desk
   board, as the pack's Biography book lies on its desk - no torn page under it, no leather slab round it, and no strip
   of board between the tabs and the book: the plates stand on the book's own top edge. The board is
   the desk's wood in a hard bevel; the tabs are the pack's own tab plates across its top; the book is the pack's own
   painted book, each page a 9-slice of the painting (its corners as painted, its edges and the gutter's curve drawn
   along the page), so it keeps the painting's depth and never deforms, whatever the window holds: it is always
   exactly the board's room, and each page scrolls within itself. */
${G} .px-win:has(> .px-body > .px-journal) { background: ${WOOD(0.14)} !important; border: 0 !important; border-image: none !important; outline: none !important;
  box-shadow: 0 0 0 ${px(1)} #0c0603, inset ${px(1)} ${px(1)} 0 0 rgba(255,214,150,0.24), inset calc(-1 * ${px(1)}) calc(-1 * ${px(1)}) 0 0 rgba(0,0,0,0.55),
    inset 0 0 0 ${px(2)} rgba(0,0,0,0.12), 0 14px 30px rgba(0,0,0,0.6) !important; }
${G} .px-win:has(> .px-body > .px-journal) > .px-body { padding: 0 ${px(4)} ${px(4)} !important; overflow: visible !important; background: none !important;
  display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 0; border: 0 !important; box-shadow: none !important; }
${G} .px-journal { gap: 0; position: relative; flex: 1 1 auto; min-height: 0 !important; height: auto; background: none; border: 0; padding: 0;
  filter: drop-shadow(${px(1)} ${px(2)} 0 rgba(0,0,0,0.5)) drop-shadow(0 4px 10px rgba(0,0,0,0.35)); }
${G} .px-journal > .px-qrail { ${bookPage('left')} flex: 0 0 auto; width: 31%; min-width: min(${px(84)}, 44%); max-width: 44%; min-height: 0; overflow-y: auto; overflow-x: hidden; box-shadow: none;
  padding: ${px(1)} 0 ${px(1)} ${px(1)}; border-right-width: ${px(BG - 7)}; }
${G} .px-journal > .px-qdetail { ${bookPage('right')} flex: 1 1 0; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; box-shadow: none;
  padding: ${px(2)} calc(${px(2)} + ${px(BG - BO)}) ${px(1)} ${px(2)}; }
/* PAGE-CENTRE (2026-10-12, a player: "on the pause menu, the elements on the right-hand menu seem to be skewed very far to
   the right instead of centered on the page"): the right-hand page's 9-slice gives its gutter edge BG of the pack's
   pixels and its outer edge BO, so what was written on it stood the gutter's width in from the spine and a hair from the
   page's edge. The outer side takes the difference as padding: the writing stands as far from the edge as from the
   spine, in the middle of the page. */
${G} .px-journal .px-qrow { color: ${T.ink}; min-width: 0; }
/* a page scrolls down, never across (Dudey: "the spellbook has 2 scrollbars"): a long name wraps, its cost keeps its place */
${G} .px-journal .px-qrail .px-qrow { overflow-wrap: anywhere; } ${G} .px-journal .px-qrail .sb-cost { flex: 0 0 auto; padding-left: ${px(2)}; }
${G} .px-journal .px-qrow.on { color: ${T.red}; background: rgba(142,26,16,0.1); }
/* the tabs: the pack's plates in a row across the top of the board */
${G} .px-win:has(> .px-body > .px-journal) > .px-tabs { background: none !important; border: 0 !important; box-shadow: none !important;
  padding: ${px(3)} ${px(4)} 0 !important; gap: ${px(1)} !important; justify-content: center; align-items: flex-end; flex-wrap: nowrap;
  position: relative; z-index: 2; margin-bottom: calc(-1 * ${px(2)}); }
${G} .px-win:has(> .px-body > .px-journal) > .px-tabs button { min-height: 0; margin: 0; padding: ${px(1, 'gk')} ${px(10, 'gk')} 0 !important; flex: 0 1 ${px(46)};
  font-size: 16px; line-height: 20px; letter-spacing: 0; text-indent: 0; text-transform: none; justify-content: center; ${TAB_CSS} transition: none; }
${G} .px-win:has(> .px-body > .px-journal) > .px-tabs button:hover:not(.on), ${G} .px-win:has(> .px-body > .px-journal) > .px-tabs button:focus-visible:not(.on) { ${TAB_HOVER} }
${G} .px-win:has(> .px-body > .px-journal) > .px-tabs button.on { ${TAB_ON_CSS} }
@media (max-width: 480px) {
  ${G} .px-journal > .px-qrail { flex: 0 0 auto; max-height: 32%; }
}
${meterCss(['.px-journal'])}

/* a question's answers are written on its scroll, not stood on a plank across it */
${G} .dlg-win .dlg-acts { background: none !important; border-color: rgba(92,56,24,0.55) !important; border-top-style: solid !important; box-shadow: none !important; }
${G} .dlg-win .dlg-btn { background: none !important; border-color: transparent !important; box-shadow: none !important; border-radius: 0;
  color: #f4e04c !important; text-shadow: ${YELLOW_EDGE} !important; font-size: 16px !important; line-height: 24px !important; }
${G} .dlg-win .dlg-btn:hover, ${G} .dlg-win .dlg-btn:focus-visible { color: #fff27a !important; background: none !important; }
${G} .dlg-win .dlg-btn[data-grim-cancel] { color: ${T.red} !important; text-shadow: none !important; }
/* a line of a list on a page is written in ink; the chosen one in the pack's red, never Plus's gold */
${G} [data-grim="ink"] .port-row:not(.on) .port-rowname, ${G} [data-grim="ink"] .port-row:not(.on) .port-rowvalue { color: ${T.ink} !important; text-shadow: none !important; }
${G} [data-grim="ink"] .port-row.on, ${G} [data-grim="ink"] .port-row.on *, ${G} [data-grim="ink"] .pick-row.on, ${G} [data-grim="ink"] .pick-row.on * { color: ${T.red} !important; text-shadow: none !important; }

/* THE ITEM SCROLLS - what an item is and what you can do with it (the hover card, the right-click menu, the Info box,
   the bindings card) is a little scroll of the list picker's, its rods drawn smaller, held over the shelves */
/* (one picture edge to edge - its own parchment filled in, no second paper laid inside it: Dudey, "in both of them is
   btw a slight window to see in the scroll"; drawn INSIDE its box, the rods too - the hover card's holder clips what
   stands outside it, which cut the rods off and left a plain sheet) */
${at(['.pack-shell .packtip > .card', '.inv-tip > .card', '.inv-menu', '.inv-info > .card', '.pbind > .card'])} { background: none !important; border: 2px solid transparent !important; border-radius: 0 !important;
  border-image: ${v('sideScroll')} 15 fill / ${px(15, 'gq')} / 0 round !important; outline: none !important;
  padding: ${px(6, 'gq')} ${px(16, 'gq')} !important;
  box-shadow: none !important; filter: drop-shadow(${px(1, 'gq')} ${px(2, 'gq')} 0 rgba(0,0,0,0.5)) drop-shadow(3px 7px 8px rgba(0,0,0,0.45)); color: ${T.ink}; }
/* what you can do with the item is the pack's own parchment strip - Wagon, Info, Equip, Remove, Use, Gold - big words
   written down the scroll, one under the other, the one it is for in red; no boxes, no plates, no frames */
${G} .pack-shell .packtip > .card .acts, ${G} .inv-info > .card .acts { display: flex !important; flex-flow: row wrap !important;
  justify-content: center !important; align-items: center !important; gap: 0 10px !important; border-top: 2px solid rgba(92,56,24,0.55) !important; padding-top: 6px !important; margin-top: 6px !important; }
${G} .pack-shell .packtip > .card .acts .act, ${G} .inv-menu button, ${G} .inv-menu .act, ${G} .inv-info > .card .acts .act {
  background: none !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; outline: none;
  flex: 0 0 auto !important; width: auto !important; min-width: 0 !important; max-width: none !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 6px !important;
  font-size: 16px !important; line-height: 24px !important; letter-spacing: 0 !important; text-transform: none !important; text-decoration: none !important;
  color: ${T.ink} !important; text-shadow: 1px 1px 0 rgba(255,240,205,0.45) !important; translate: none !important; filter: none !important; }
${G} .inv-menu { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 0 !important; }
${G} .pack-shell .packtip > .card .acts .act.primary, ${G} .inv-menu .primary, ${G} .inv-info > .card .acts .act.primary { color: ${T.red} !important; }
${G} .pack-shell .packtip > .card .acts .act:hover, ${G} .pack-shell .packtip > .card .acts .act:focus-visible,
${G} .inv-menu button:hover, ${G} .inv-menu button:focus-visible, ${G} .inv-info > .card .acts .act:hover { color: ${T.redHi} !important; background: none !important; }
${G} .pack-shell .packtip > .card .acts .act:disabled, ${G} .inv-menu button:disabled { color: rgba(43,26,12,0.35) !important; }
${G} .pack-shell .packtip > .card h3, ${G} .inv-tip > .card h3 { font-size: 32px !important; color: ${T.red} !important; text-shadow: none !important; }
/* HUD-TIP / STATUS-TIPS: the HUD's hover card is the pack's scroll - its name in red, a smaller hand than an item's; what
   it does in ink, the time left in the softer ink under a rule */
${G} .inv-tip.hud-tip > .card h3 { font-size: 22px !important; }
${G} .inv-tip.hud-tip .meta { color: ${T.inkSoft} !important; text-shadow: none !important; }
${G} .inv-tip.hud-tip .hud-tip-line { color: ${T.ink} !important; text-shadow: none !important; font-size: 15px; }
${G} .inv-tip.hud-tip .hud-tip-foot { color: ${T.inkSoft} !important; text-shadow: none !important; border-top-color: rgba(92,56,24,0.55) !important; box-shadow: none !important; }

/* THE SCROLLS - a question or a short choice (the rest window, a yes or no) is the pack's list-picker scroll, its two
   rods top and foot; the rest's three ways to rest are written across it in a row, as the pack's Rest scroll writes
   "For a while - Until fully healed - Loiter a while", with Cancel in red beneath */
${at(['.rest-win', '.dlg-win', '.port-win.size-narrow', '.sb-ask > .card'])} { background: none !important; border: 2px solid transparent !important;
  border-image: ${v('sideScroll')} 15 fill / ${px(15)} / ${px(5)} ${px(13)} round !important;
  box-shadow: none !important; outline: none !important; filter: drop-shadow(${px(1)} ${px(2)} 0 rgba(0,0,0,0.45)) drop-shadow(4px 8px 10px rgba(0,0,0,0.5)); }
/* GRIM3: THE SCROLL UNROLLS as it opens (markGrimoireUnroll): its rods together in the middle, rolling apart, the
   parchment between them coming into the light, and the rods landing on the scroll's own */
${G} [data-grim-unroll="open"] { animation: grim-unroll 560ms cubic-bezier(0.25, 0.8, 0.3, 1) both; }
/* ...and rolls shut as it closes: its likeness, where it stood, the rods coming back together over it */
${G} [data-grim-unroll="closing"] { animation: grim-unroll 380ms cubic-bezier(0.6, 0, 0.8, 0.3) reverse both; }
${G} [data-grim-unroll="closing"] > .grim-rod { animation-duration: 380ms; animation-direction: reverse; animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.3); }
/* the writing comes up as the parchment opens out and goes as it rolls in - never a sliver of a word left between the
   rods */
${G} [data-grim-unroll="open"] > :not(.grim-rod) { animation: grim-ink-show 560ms linear both; }
${G} [data-grim-unroll="closing"] > :not(.grim-rod) { animation: grim-ink-show 380ms linear reverse both; }
@keyframes grim-ink-show { 0%, 40% { opacity: 0; } 100% { opacity: 1; } }
@keyframes grim-unroll { from { clip-path: inset(calc(-1 * ${px(8)}) calc(50% - ${px(15)})); } to { clip-path: inset(calc(-1 * ${px(8)}) calc(-1 * ${px(13)})); } }
${G}:not([data-grim-spellbook="pack"]) .grim-sbarrow { display: none; }
${G} .grim-rod { position: absolute; z-index: 20; pointer-events: none; display: block; top: calc(-1 * ${px(5)}); bottom: calc(-1 * ${px(5)}); width: ${px(15)};
  border: 0 solid transparent; border-width: ${px(15)} 0; box-sizing: border-box; background: none;
  animation: grim-rod-l 560ms cubic-bezier(0.25, 0.8, 0.3, 1) both; }
${G} .grim-rod.l { border-image: ${v('rodL')} 15 0 fill / ${px(15)} 0 stretch; left: calc(-1 * ${px(13)}); }
${G} .grim-rod.r { border-image: ${v('rodR')} 15 0 fill / ${px(15)} 0 stretch; right: calc(-1 * ${px(13)}); animation-name: grim-rod-r; }
/* the rods ride the clip's own edges: both are moved the same way (left / right, inset - one style pass), never one on
   the compositor and the other on the page, which drift apart while the game draws its frame and left the parchment
   showing outside the rods, or the scroll snapping shut (Dudey: "the resting window is also not closing the scroll
   correctly") */
@keyframes grim-rod-l { 0% { left: calc(50% - ${px(15)}); } 96% { opacity: 1; } 100% { left: calc(-1 * ${px(13)}); opacity: 0; } }
@keyframes grim-rod-r { 0% { right: calc(50% - ${px(15)}); } 96% { opacity: 1; } 100% { right: calc(-1 * ${px(13)}); opacity: 0; } }
${G} .rest-win .card, ${G} .dlg-win .card { background: none !important; border-color: transparent !important; box-shadow: none !important; outline: none; }
/* a service's menu and a confirm on the scroll: no plank across it - its name and its presses written in ink, the one it
   is for in red, the way out in the pack's red Exit */
${G} .sb-ask > .card { position: relative; }
${G} .port-win.size-narrow .port-head, ${G} .port-win.size-narrow .port-foot, ${G} .port-win.size-narrow .port-inner,
${G} .sb-ask > .card .sb-acts { background: none !important; border: 0 !important; border-image: none !important; box-shadow: none !important; }
${G} .port-win.size-narrow .port-head :is(h1, h2, h3, p, span), ${G} .sb-ask > .card :is(p, span, h3) { color: ${T.ink} !important; text-shadow: none !important; }
${G} .port-win.size-narrow .port-head h2::first-letter { color: ${T.red}; }
${G} :is(.port-win.size-narrow, .sb-ask > .card) [data-grim-on]:not([data-grim-exit]) { color: ${T.ink} !important; text-shadow: 0 1px 0 rgba(255,240,205,0.4) !important; }
${G} :is(.port-win.size-narrow, .sb-ask > .card) [data-grim-on].primary:not([data-grim-exit]) { color: ${T.red} !important; }
${G} :is(.port-win.size-narrow, .sb-ask > .card) [data-grim-on]:not([data-grim-exit]):hover { color: ${T.redHi} !important; text-decoration: underline solid ${T.red}; text-underline-offset: 0.2em; }
${G} .rest-win > .px-body, ${G} .dlg-win > .px-body { background: none; border-color: transparent; box-shadow: none; }
${G} .rest-win h2 { color: ${T.ink} !important; text-shadow: none !important; text-align: center; font-size: 32px !important; line-height: 34px;
  padding-bottom: 4px; margin-bottom: 2px; ${RULE_UNDER} }
/* the rest scroll is a short question, not a window (Dudey: "the resting window is pretty big") */
${G} .rest-win { max-width: min(92vw, 420px) !important; }
${G} .rest-win .card { padding: 6px 10px !important; }
${G} .rest-win h2::first-letter { color: ${T.red}; }
${G} .rest-win .acts.selection-acts { border-top: 0 !important; box-shadow: none !important; }
${G} .rest-win .acts.selection-acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 10px; align-items: stretch; }
${G} .rest-win .acts.selection-acts { margin-top: 6px !important; padding-top: 4px !important; }
${G} .rest-win .acts.selection-acts .act { width: auto; min-height: 0; white-space: normal; line-height: 24px; padding: 2px 4px; font-size: 24px; }
${G} .rest-win .acts.selection-acts .act:last-child:nth-child(4) { grid-column: 1 / -1; justify-self: center; margin-top: 4px; color: ${T.red} !important; }

/* THE TALK WINDOW - as the pack lays it: what you can ask down a scroll on the LEFT (its "Tell me about... / Where
   is..." page), the conversation on the right-hand page, the speaker's name and the tone on the plank above; what the
   speaker says in Daggerfall's yellow over the page's ink, your own words in the pack's blue */
${G} .talk-main { grid-template-columns: minmax(240px, 36%) 1fr; }
${G} .talk-topics { order: -1; border-left: 0 !important; border-right: 0 !important; background: ${SCROLL}; }   /* NO-LINES: the gutter's shading parts the pages */
${G} .talk-log { background: none; }
${G} .talk-log .talk-entry.a, ${G} .talk-log .talk-entry.a * { color: ${GRIM_YELLOW} !important; text-shadow: ${YELLOW_EDGE} !important; }
${G} .talk-log .talk-entry.q, ${G} .talk-log .talk-entry.q * { color: #7a9ae8 !important; text-shadow: 1px 1px 0 #10183a !important; }
@media (max-width: 640px) { ${G} .talk-topics { border-right: 0 !important; } }

/* the pack's tab plates: the lighter wood, the name cut in dark; the chosen page's tab a scrap of page, its name red */
${G} .pack-shell .packtabs .packtab { ${TAB_CSS} }
${G} .pack-shell .packtabs .packtab .count { color: ${T.inkSoft} !important; text-shadow: none !important; }
${G} .pack-shell .packtabs .packtab.tabempty { color: rgba(42,26,10,0.72) !important; opacity: 1; }
${G} .pack-shell .packtabs .packtab.tabempty .count { color: rgba(42,26,10,0.6) !important; }
${G} .pack-shell .packtabs .packtab:hover:not(.on) { ${TAB_HOVER} }
${G} .pack-shell .packtabs .packtab.on { ${TAB_ON_CSS} }
${G} .pack-shell .packtabs .packtab.on .count { color: ${T.red} !important; text-shadow: none !important; }
${G} .pack-shell .packtab.on::after { content: none; }

/* THE SPELLBOOK AS GRIMOIRE DRAWS IT - GRIM3 (a player: "(optionallly) rettain the look of the original GrimoireUI
   spellbook"; the card's Spellbook: GrimoireUI's own). The window is the pack's own spellbook picture (SPBK00I0, at the
   pack's own pixels: --gp / 3 each), its title, spine arrows, three boxes, ruled bands and red EXIT as painted, and every
   press and word of the enhanced book written where the pack writes it: the spells down the left page (the spine's
   arrows turn it), the spell's name over the right page, its cost and its target and element in the three boxes, one
   effect to each ruled band, Ready - Hotbar - Rename - Icon - Delete along the foot where the pack wrote DELETE UP SORT
   DOWN (lifted off the picture, ui/grimoireArt.js SPBK_WIPES), and Close on its EXIT. */
${SB} > .px-win { width: ${pk(777)} !important; height: ${pk(492)} !important; max-width: none !important; max-height: none !important;
  padding: 0 !important; position: relative; display: block !important; outline: none !important;
  background: ${v('spbk', `url("${grimoireImg('SPBK00I0')}")`)} 0 0 / 100% 100% no-repeat !important; border: 0 !important; border-image: none !important;
  box-shadow: ${px(2)} ${px(3)} 0 rgba(0,0,0,0.45), 0 14px 30px rgba(0,0,0,0.6) !important; filter: none !important; }
${SB} > .px-win > .sb-top { position: absolute !important; inset: 0 !important; display: block !important; height: auto !important; padding: 0 !important;
  background: none !important; border: 0 !important; border-image: none !important; box-shadow: none !important; pointer-events: none; }
${SB} .sb-top .sb-spacer { display: none; }
${SB} .sb-top .sb-who h2 { position: absolute; left: ${pk(80)}; top: 0; width: ${pk(200)}; height: ${pk(32)}; margin: 0; opacity: 0; }
${SB} .sb-top .sb-magicka { position: absolute; left: ${pk(26)}; top: ${pk(34)}; width: ${pk(318)}; margin: 0; text-align: center;
  color: ${T.inkSoft} !important; text-shadow: none !important; font-size: 16px; letter-spacing: 0; text-transform: none; }
${SB} .sb-top .act { pointer-events: auto; position: absolute !important; left: ${pk(650)}; top: ${pk(447)}; width: ${pk(125)}; height: ${pk(43)};
  margin: 0 !important; padding: 0 !important; color: transparent !important; text-shadow: none !important; font-size: 16px;
  background: none !important; border: 0 !important; border-image: none !important; box-shadow: none !important; translate: none !important; }
${SB} .sb-top .act:hover, ${SB} .sb-top .act:focus-visible { background: rgba(255,232,120,0.14) !important; box-shadow: inset 0 0 0 ${pk(3)} rgba(255,236,130,0.55) !important; outline: none; }
${SB} > .px-win > .px-body { position: absolute !important; inset: 0 !important; padding: 0 !important; margin: 0 !important; overflow: visible !important;
  background: none !important; border: 0 !important; display: block !important; pointer-events: none; }
/* the body lies over the whole picture to place its pieces: it lets a press through (to the EXIT under it), and only
   the list and the page's own pieces take one (Dudey: "the exit button of the og grimoire spellbook isnt working") */
${SB} .px-journal { pointer-events: none; }
${SB} .px-journal > .px-qrail { pointer-events: auto; }
${SB} .px-journal { position: static !important; display: block !important; height: 100%; background: none !important; border: 0 !important; padding: 0 !important; filter: none !important; }
${SB} .px-journal > .px-qrail { position: absolute; left: ${pk(26)}; top: ${pk(58)}; width: ${pk(318)}; height: ${pk(382)}; margin: 0;
  border: 0 !important; border-image: none !important; background: none !important; padding: 0 !important; overflow-y: auto; scrollbar-width: none; }
${SB} .px-journal > .px-qrail::-webkit-scrollbar { display: none; width: 0; }
${SB} .px-qrail .px-qrow { min-height: 0; padding: ${pk(4)} ${pk(8)} !important; font-size: 16px; line-height: 20px; letter-spacing: 0; text-transform: none; }
${SB} .px-qrail .sb-cost { color: ${T.inkSoft} !important; text-shadow: none !important; font-size: 16px; }
${SB} .px-qrail .px-qrow.on .sb-cost { color: ${T.red} !important; }
${SB} .px-journal > .px-qdetail { position: absolute; inset: 0; border: 0 !important; border-image: none !important; background: none !important;
  padding: 0 !important; overflow: visible; pointer-events: none; }
${SB} .px-qdetail > * { pointer-events: auto; }
${SB} .px-qdetail > .px-qname { position: absolute; left: ${pk(424)}; top: ${pk(4)}; width: ${pk(326)}; height: ${pk(28)}; margin: 0; justify-content: center; }
${SB} .px-qdetail > .px-qname .px-qwing { display: none; }
${SB} .px-qdetail > .px-qname h3 { font-size: 16px !important; line-height: 20px; color: ${T.red} !important; text-shadow: none !important; letter-spacing: 0; text-indent: 0; text-transform: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${SB} .px-qdetail > .px-qmeta { position: absolute; left: ${pk(441)}; top: ${pk(35)}; width: ${pk(58)}; height: ${pk(61)}; margin: 0;
  display: flex; align-items: center; justify-content: center; text-align: center; }
${SB} .px-qmeta .px-qtimer { color: ${GRIM_YELLOW} !important; text-shadow: ${YELLOW_EDGE} !important; font-size: 16px; line-height: 16px; letter-spacing: 0; text-transform: none; }
${SB} .px-qmeta .px-qtimer.urgent { color: #ff7a5a !important; }
${SB} .px-qdetail > .sb-frame { position: absolute; left: ${pk(540)}; top: ${pk(35)}; width: ${pk(184)}; height: ${pk(61)}; margin: 0;
  display: grid; grid-template-columns: ${pk(86)} ${pk(60)}; column-gap: ${pk(38)}; flex-wrap: nowrap; gap: 0 ${pk(38)}; }
${SB} .sb-frame .sb-chip { display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 !important; border: 0 !important; background: none !important;
  box-shadow: none !important; color: ${GRIM_YELLOW} !important; text-shadow: ${YELLOW_EDGE} !important; font-size: 16px; line-height: 16px; letter-spacing: 0; text-transform: none; }
${SB} .px-qdetail > .px-divider { display: none; }
${SB} .px-qdetail > .sb-effects, ${SB} .px-qdetail > .px-note { position: absolute; left: ${pk(430)}; top: ${pk(124)}; width: ${pk(312)}; height: ${pk(316)}; margin: 0;
  display: grid; grid-template-rows: repeat(3, ${pk(112)}); row-gap: ${pk(3)}; overflow: hidden; gap: ${pk(3)} 0; }
${SB} .sb-effects .sb-effect { padding: ${pk(4)} ${pk(6)}; border: 0 !important; background: none !important; overflow: hidden; }
${SB} .sb-effect .sb-group { color: ${T.ink} !important; font-size: 16px; } ${SB} .sb-effect .sb-sub { color: ${T.inkSoft} !important; font-size: 16px; letter-spacing: 0; text-transform: none; }
${SB} .sb-effect .sb-nums { margin: ${pk(2)} 0 0 ${pk(10)}; } ${SB} .sb-effect .sb-num { color: ${T.red} !important; text-shadow: none !important; font-size: 16px; letter-spacing: 0; }
${SB} .px-qdetail > .sb-acts { position: absolute !important; left: ${pk(18)}; top: ${pk(446)}; width: ${pk(622)}; height: ${pk(36)}; margin: 0 !important; padding: 0 !important;
  display: flex !important; align-items: center; justify-content: flex-start; gap: 0 ${pk(6)}; flex-wrap: nowrap; border: 0 !important; background: none !important; box-shadow: none !important; }
${SB} .px-qdetail > .sb-acts .act { font-size: 16px !important; line-height: 20px; padding: 0 ${pk(3)} !important; min-height: 0; white-space: nowrap;
  flex: 0 0 auto !important; width: auto !important; min-width: 0 !important; margin: 0 !important; }
${SB} .px-qdetail > .sb-acts .act:first-child { color: ${T.red} !important; }
${SB} .px-qdetail > .sb-acts .act:nth-child(4) { margin-left: auto !important; }
${SB} .px-qdetail > .sb-rename, ${SB} .px-qdetail > .sheet-notice { position: absolute; left: ${pk(430)}; top: ${pk(392)}; width: ${pk(312)}; margin: 0; }
${SB} .px-qdetail > .sb-icons { position: absolute; left: ${pk(426)}; top: ${pk(104)}; width: ${pk(320)}; height: ${pk(336)}; max-height: none; margin: 0;
  background: #d8bc88 !important; border: ${pk(3)} solid rgba(60,34,14,0.7) !important; box-sizing: border-box; }
${SB} .px-qdetail:has(> .sb-icons) > .sb-effects { visibility: hidden; }
${SB} .grim-sbarrow { position: absolute; z-index: 5; left: ${pk(358)}; width: ${pk(36)}; height: ${pk(44)}; padding: 0; margin: 0; border: 0; cursor: pointer;
  background: none; color: transparent; font-size: 0; }
${SB} .grim-sbarrow.up { top: ${pk(36)}; } ${SB} .grim-sbarrow.down { top: ${pk(398)}; }
${SB} .grim-sbarrow:hover, ${SB} .grim-sbarrow:focus-visible { background: radial-gradient(closest-side, rgba(255,240,180,0.45), rgba(255,240,180,0)); outline: none; }
${SB}:not([data-grim-art]) > .px-win, ${G}:not([data-grim-art="ready"])[data-grim-spellbook="pack"] .sb-shell > .px-win { background-color: #d9bc86 !important; }

/* THE VITALS, UPRIGHT - Daggerfall's own three bars in the corner (health, fatigue, magicka, left to right), each the
   pack's vial standing on its foot with the cork on top, the liquid rising from the foot. The bars keep their own
   fill: the dress turns each track on its end (the HUD's scale and the move editor's nudges ride as ever). */
${G}[data-grim-vitals="upright"] .hud-bars { position: absolute; left: calc(50% + (18px - 50vw) / var(--hud-scale, 1)); bottom: calc(-4px / var(--hud-scale, 1));
  align-items: flex-end; gap: 6px; }
${G}[data-grim-vitals="upright"] .hud-vital { width: ${px(11, 'gq')}; height: ${px(86, 'gq')}; }
${G}[data-grim-vitals="upright"] .hud-health { order: 1; } ${G}[data-grim-vitals="upright"] .hud-fatigue { order: 2; } ${G}[data-grim-vitals="upright"] .hud-magicka { order: 3; }
${G}[data-grim-vitals="upright"] .hud-vital .hud-track { position: absolute; left: 0; bottom: 0; width: ${px(86, 'gq')} !important; height: ${px(11, 'gq')};
  transform-origin: 0 100%; transform: translateX(${px(11, 'gq')}) rotate(-90deg); box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline};
  filter: drop-shadow(calc(-1 * ${px(1, 'gq')}) ${px(1, 'gq')} 0 rgba(0,0,0,0.6)); }
${G}[data-grim-vitals="upright"] .hud-vital .hud-track { background: ${v('vialHealthUpEmpty')} 0 0 / 100% 100% no-repeat, #1a0a0a; }
${G}[data-grim-vitals="upright"] .hud-magicka .hud-track { background: ${v('vialMagickaUpEmpty')} 0 0 / 100% 100% no-repeat, #0a0e18; }
${G}[data-grim-vitals="upright"] .hud-fatigue .hud-track { background: ${v('vialFatigueUpEmpty')} 0 0 / 100% 100% no-repeat, #0a120a; }
${G}[data-grim-vitals="upright"] .hud-vital .hud-fill { background: ${v('vialHealthUp')} 0 0 / ${px(86, 'gq')} 100% no-repeat, var(--v-body); }
${G}[data-grim-vitals="upright"] .hud-magicka .hud-fill { background: ${v('vialMagickaUp')} 0 0 / ${px(86, 'gq')} 100% no-repeat, var(--v-body); }
${G}[data-grim-vitals="upright"] .hud-fatigue .hud-fill { background: ${v('vialFatigueUp')} 0 0 / ${px(86, 'gq')} 100% no-repeat, var(--v-body); }
${G}[data-grim-vitals="upright"] .hud-vlabel, ${G}[data-grim-vitals="upright"] .hud-num { display: none; }
${G}[data-grim-vitals="upright"] .hud-vital.low .hud-track { animation: grim-vlow-up 0.9s steps(1, end) infinite; }
@keyframes grim-vlow-up { 0% { filter: drop-shadow(0 0 3px #ff2a14) drop-shadow(-2px 1px 0 rgba(0,0,0,0.6)); } 50% { filter: drop-shadow(-2px 1px 0 rgba(0,0,0,0.6)); } }
/* the quick block (its caption, the mode word, and the status tiles) steps right of the vials */
${G}[data-grim-vitals="upright"] .hud-quick { left: calc(24px + 112px * var(--hud-scale, 1) + env(safe-area-inset-left, 0px)); }
/* the Renown row keeps its place under the hotbar, the width of the hotbar now the vials have gone to the corner */
${G}[data-grim-vitals="upright"] .hud-renown { width: calc(2 * min(190px, 23vw) + 16px); }

/* ── FOE-PLATE / VIAL-LONG (2026-10-11: "change the monster and bosses hp bar iam not sold that it look good enough yet
   iam also not a fan of the animation when it loses hp (same for the other bars) ... and when i use alt + u and try to make
   the bar smaller and larger and longer it bugs out") ──────────────────────────────────────────────────────────────────
   NO DRAIN. What a blow takes is gone at once, as Daggerfall's own bars drop - the darkened liquid that held where the bar
   was and drained after it is not drawn on any bar (yours, a foe's, a boss's); the low-health pulse stands. */
${G} :is(.hud-vital, .hud-foe, .hud-breath) .hud-ghost, ${G} .hud-chunk, ${G} .wb-boss-ghost { display: none !important; }
${G} .wb-boss-fill { transition: none !important; }
/* THE FOE'S BAR: nothing behind it (a board under it only hid the world - "nothing like this please"), no thicker than
   your own vials: the foe's name in Daggerfall's yellow over the pack's red vial DRAWN OUT - the vial's own head, its
   glass and its own foot at the track's end (longVial), so the bar is the vial at ANY length: the editor's length handle
   draws more glass, never a stretched picture or a liquid that stops short of its own glass. Its width is the editor's
   own measure (min(280px, 40vw)), so a first pull on the handle never jumps. */
/* BAR-SCREEN (2026-10-11: 22 and 33 pixels "too thick", 11 "too thin" - "please remember ppl have different resolutions"):
   THE TWO BARS ARE THE SCREEN'S SIZE, NOT A PIXEL COUNT. The foe's glass is 1.75% of the screen's height (16px on a
   917-pixel-high view, 19 on 1080, 25 on 1440, 38 on 2160; never under 13), the boss's 1.4 times it, and each is as
   long as its thickness allows (the foe's 17.5 of them, under 40% of the width; the boss's 20.5, under 88%). The vial is
   drawn at that same measure - its cork, its glass and its foot each 1/11 of the thickness to the game's pixel (--gfoe,
   --gboss) - so a taller screen draws the same vial bigger, never a thinner one. The editor's sizes and lengths ride on
   top, from this same base (its length rules re-said below), and the player's HUD scale over the foe's as ever. */
${G} { --grim-foe-h: clamp(13px, 1.75vh, 48px); --grim-boss-h: clamp(18px, 2.45vh, 64px);
  --gfoe: calc(var(--grim-foe-h) / 11); --gboss: calc(var(--grim-boss-h) / 11);
  --grim-foe-w: min(calc(var(--grim-foe-h) * 17.5), 40vw); --grim-boss-w: min(calc(var(--grim-boss-h) * 20.5), 88vw); }
${G} .hud .hud-foe { gap: 0; align-items: stretch; margin-top: ${px(3, 'gq')}; }
${G} .hud .hud-foe .hud-foename { margin: 0 0 ${px(2, 'gq')}; line-height: 20px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: var(--grim-foe-w); align-self: center; }
${G} .hud .hud-foe[data-hm-len] .hud-foename { max-width: calc(var(--grim-foe-w) * var(--hml, 1)); }
${G} .hud .hud-foe .hud-foetrack { width: var(--grim-foe-w); height: var(--grim-foe-h); container-type: inline-size; align-self: center;
  background: ${longVial('Health', true, 'gfoe')}, #1a0a0a; box-shadow: 0 0 0 1px ${T.outline}; filter: drop-shadow(1px 1px 0 rgba(0,0,0,0.55)); }
${G} .hud .hud-foe .hud-foetrack .hud-fill { background: ${longVial('Health', false, 'gfoe')}, #8a1c18; }
${G} .hud .hud-foe[data-hm-len] .hud-foetrack { width: calc(var(--grim-foe-w) * var(--hml, 1)) !important; }
/* THE EDITOR'S PREVIEW (no foe yet): its "Enemy (preview)" stands on the name's own line - the name is empty, and a line
   with no words has no height and clipped its label away */
${G} .hud .hud-foe[data-hm-dummy]:not(.on) .hud-foename { overflow: visible; min-height: 20px; max-width: none; align-self: stretch; }
${G} .hud .hud-foe[data-hm-dummy]:not(.on) .hud-foename::after { color: ${T.yellow};
  text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
${G} .hud .hud-foe .hud-foepoise { width: auto; align-self: stretch; margin: ${px(2, 'gq')} 0 0; }
/* ...stepped down under a boss's bar while one stands - or while the editor shows his last one as its preview (the bar a
   fight left on the page, hidden, which the editor stands up again) - so the two never write over each other */
${G} body:has(> .wb-boss-bar:not([data-hm-ghost]):is(:not([style*="display: none"]), [data-hm-dummy])) .hud .hud-foe { margin-top: calc(${px(3, 'gq')} + (90px + var(--grim-boss-h)) / var(--hud-scale, 1)); }
/* ...and under the editor's stand-in for his bar by its own (shorter) height - it is a name and a glass, no marks, no
   chips; the full push sent the foe's preview down under the editor's own banner ("i cant see the enemy bar and its
   missplaced in this mode"), and none laid it under the stand-in */
${G} body:has(> .wb-boss-bar[data-hm-ghost]) .hud .hud-foe {
  margin-top: calc(${px(3, 'gq')} + (52px + var(--grim-boss-h)) / var(--hud-scale, 1)); }
/* THE BOSS'S BAR: the bigger glass, as thick as it was - the red vial drawn out the bar's whole width, his name in the
   yellow and his title in the cream over it, the night's marks and the court's chips under it, his phases notched into
   the glass; nothing behind it. Its length is the editor's too (the bar's width; the glass follows it). */
${G} .wb-boss-name { font-size: 16px; line-height: 20px; }
${G} .wb-boss-sub { color: ${T.cream} !important; line-height: 16px;
  text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
/* BAR-SCREEN: the boss's measure (above) - its width the bar's, its glass's thickness the screen's */
${G} .wb-boss-bar { width: var(--grim-boss-w); }
${G} .wb-boss-bar[data-hm-len] { width: calc(var(--grim-boss-w) * var(--hml, 1)) !important; }
${G} .wb-boss-track { width: 100% !important; max-width: none; margin: ${px(2, 'gq')} 0 ${px(2, 'gq')}; container-type: inline-size; height: var(--grim-boss-h);
  background: ${longVial('Health', true, 'gboss')}, #1a0a0a !important; box-shadow: 0 0 0 ${px(1, 'gq')} ${T.outline} !important; }
${G} .wb-boss-fill { background: ${longVial('Health', false, 'gboss')}, #8a1c18 !important; }
${G} .wb-boss-bar.sea .wb-boss-track { background: ${longVial('Magicka', true, 'gboss')}, #0a0e18 !important; }
${G} .wb-boss-bar.sea .wb-boss-fill { background: ${longVial('Magicka', false, 'gboss')}, #2f5fb4 !important; }
${G} .wb-boss-mark { top: ${px(1, 'gq')}; bottom: ${px(1, 'gq')}; width: ${px(1, 'gq')}; background: rgba(20,11,4,0.85) !important; box-shadow: ${px(1, 'gq')} 0 0 rgba(255,214,150,0.35); }
${G} .wb-boss-foot .wb-boss-tag { text-shadow: ${WORD_ON_WOOD}; }
/* his attack's name is called UNDER the bar, over the world in the HUD's hard outline - its own reserved line stood empty
   between his blows, and a bar that grew and shrank with each call would jump */
${G} .wb-boss-callout { position: absolute; left: 0; right: 0; top: calc(100% + ${px(2, 'gq')}); display: block; margin: 0; min-height: 0; text-align: center;
  white-space: nowrap; text-shadow: -1px 0 0 #120804, 1px 0 0 #120804, 0 -1px 0 #120804, 0 1px 0 #120804, 1px 2px 0 rgba(0,0,0,0.6); }
${G} .wb-boss-callout-line { max-width: 60%; margin: 1px auto 0; }

/* CHOSEN-CHIP (FIELD BUGS, the decorator: "the decorations menu doesn't show what tabs on it are active (I think I have
   "all" chosen in the screenshot)"): A CHOSEN CHIP SAYS SO OVER ITS PICTURE. The kit marks a chosen tile with a gold
   line inside it (box-shadow, inset) - and a tile is the pack's shelf box, a border-image drawn with its fill, which
   paints over every inset shadow: a chosen Catalogue, All or Small stood exactly as the others did. The mark is now
   what the picture cannot cover - the pack's bright yellow word, underlined, as a chosen press on wood is lettered, and
   a gold frame laid OVER the box (an outline, drawn above the border-image) - on every pickable cell that says it is
   pressed: the decorator's tabs, filters, sizes, sorts, rooms and grid, and any chip of the tile role like them. */
${at(R.tile, '[aria-pressed="true"]')} { color: #fff27a !important; outline: 2px solid ${T.goldLeaf} !important; outline-offset: -3px;
  text-decoration: underline solid rgba(255,242,122,0.6); text-underline-offset: 0.22em; }

/* SETTING-SCROLL (2026-10-11, Mac: "when you click on a mod or something to see its descriptions in the menu it in the same
   window show the description outside in a scroll like you would hover or click an item in the inventory" - "ingame it
   should show a scroll outside on the right of the window (outside of the book)"): A SETTING'S WORDS ARE A SCROLL BESIDE
   THE BOOK. The pause book's settings page raised its description as a sheet from the page's foot, over the very rows it
   described, its Close a stray word on the paper. Here it is the item scroll the pack's shelves hold out (THE ITEM
   SCROLLS above): the picker's scroll, rods and all, standing to the RIGHT of the book - or, where the screen leaves
   less room there than a scroll needs, slid in over the book's own edge just as far as keeps it whole on the screen.
   It unrolls as it opens and rolls shut as it closes (UNROLL_SEL), and its Close is the red word at its foot.
   HOW IT GETS OUT: the sheet was placed in the page's own column (.panes, positioned and clipping); with the column no
   longer its anchor, the book itself is (its filter makes the spread the containing block), so nothing between clips
   it. The book is centred, so the room to its right is half of what the screen leaves beside it. */
${G} .px-setwrap .panes { position: static !important; }
${G} .px-setwrap .detail { display: none; }
${G} .px-setwrap .detail.open { display: flex; flex-direction: column; transform: none !important; transition: none !important;
  --grim-sw: min(340px, 92vw);
  /* clear of the book by the rod that stands out of the scroll's box (px(13)), and kept whole on the screen with it */
  left: min(calc(100% + ${px(13)} + 12px), calc((100% + 100vw) / 2 - var(--grim-sw) - ${px(13)} - 8px)) !important; right: auto !important;
  top: 9% !important; bottom: auto !important; width: var(--grim-sw); max-height: 82% !important; overflow-y: auto; z-index: 30;
  box-sizing: border-box; background: none !important; border: 2px solid transparent !important; border-radius: 0 !important;
  border-image: ${v('sideScroll')} 15 fill / ${px(15)} / ${px(5)} ${px(13)} round !important;
  padding: ${px(8, 'gq')} ${px(18, 'gq')} ${px(6, 'gq')} !important; color: ${T.ink};
  filter: drop-shadow(${px(1)} ${px(2)} 0 rgba(0,0,0,0.45)) drop-shadow(4px 8px 10px rgba(0,0,0,0.5)); }
${G}:not([data-grim-art="ready"]) .px-setwrap .detail.open { background: ${T.page} !important; border-color: ${T.woodLit} ${T.woodDark} ${T.outline} ${T.woodMid} !important; }
${G} .px-setwrap .detail.open > .dcard, ${G} .px-setwrap .detail.open > .card { order: 1; background: none !important; border: 0 !important; border-image: none !important;
  box-shadow: none !important; padding: 0 !important; margin: 0 !important; color: ${T.ink}; }
${G} .px-setwrap .detail.open h3 { color: ${T.red} !important; font-size: 32px !important; line-height: 34px; margin: 0 0 ${px(2, 'gq')} !important; text-shadow: none !important;
  border: 0 !important; overflow-wrap: anywhere; }
${G} .px-setwrap .detail.open :is(p, li) { color: ${T.ink} !important; text-shadow: none !important; line-height: 20px; }
${G} .px-setwrap .detail.open .status { color: ${T.inkSoft} !important; }
${G} .px-setwrap .detail.open code { display: inline-block; background: none !important; color: ${T.inkSoft} !important; border: 0 !important; padding: 0 !important; outline: none !important; box-shadow: none !important;
  border-top: 2px solid rgba(92,56,24,0.45) !important; padding-top: ${px(1)} !important; text-shadow: none !important; }
${G} .px-setwrap .detail.open > .sheet-close { order: 2; align-self: center; width: auto !important; min-height: 0 !important; margin: ${px(3, 'gq')} 0 0 !important;
  padding: 0 ${px(3, 'gq')} !important; background: none !important; border: 0 !important; box-shadow: none !important; border-image: none !important;
  color: ${T.red} !important; letter-spacing: 0 !important; text-transform: none !important; text-shadow: none !important; font-size: 16px !important; line-height: 24px; }
${G} .px-setwrap .detail.open > .sheet-close:hover, ${G} .px-setwrap .detail.open > .sheet-close:focus-visible { color: ${T.redHi} !important;
  text-decoration: underline solid ${T.red}; text-underline-offset: 0.2em; outline: none; }

/* ...AND ON THE FRONT DOOR ("handle it the best you can in main menu"): the menu's settings already stand the words in a
   column of their own, right of the list, on the desk's wood - so there the card itself is the same scroll, held out in
   that column (the book's has no room of its own and steps outside; this one has its own). */
${G} .shell .detail > :is(.dcard, .card) { position: relative; margin: ${px(6, 'gq')} ${px(13)} ${px(4, 'gq')} !important; box-sizing: border-box;
  background: none !important; border: 2px solid transparent !important; border-radius: 0 !important; box-shadow: none !important; outline: none !important;
  border-image: ${v('sideScroll')} 15 fill / ${px(15)} / ${px(5)} ${px(13)} round !important;
  padding: ${px(8, 'gq')} ${px(18, 'gq')} ${px(6, 'gq')} !important; color: ${T.ink};
  filter: drop-shadow(${px(1)} ${px(2)} 0 rgba(0,0,0,0.45)) drop-shadow(4px 8px 10px rgba(0,0,0,0.5)); }
${G}:not([data-grim-art="ready"]) .shell .detail > :is(.dcard, .card) { background: ${T.page} !important; }
${G} .shell .detail > :is(.dcard, .card) h3 { color: ${T.red} !important; font-size: 32px !important; line-height: 34px; margin: 0 0 ${px(2, 'gq')} !important;
  text-shadow: none !important; border: 0 !important; overflow-wrap: anywhere; }
${G} .shell .detail > :is(.dcard, .card) :is(p, li) { color: ${T.ink} !important; text-shadow: none !important; line-height: 20px; }
${G} .shell .detail > :is(.dcard, .card) .status { color: ${T.inkSoft} !important; }
${G} .shell .detail > :is(.dcard, .card) code { display: inline-block; background: none !important; color: ${T.inkSoft} !important; border: 0 !important; outline: none !important;
  box-shadow: none !important; padding: ${px(1)} 0 0 !important; border-top: 2px solid rgba(92,56,24,0.45) !important; text-shadow: none !important; }

/* SETTINGS-SCROLL (2026-10-11, a video of the book's Settings: "when scrolling up and down the text is overlapped and
   hidden except for a small section"): THE KEYS' HEAD STICKS AS ONE LINE. In the book the settings scroll is a short
   window (301 pixels of a 648-high screen), the search bar sticks over it (91 in the pack's lettering) and the Controls
   head stuck under that at 163 - its sentence in the pack's 16-pixel face, three lines on the page's measure - so the
   rows scrolled through 47 pixels. The sentence is the intro's own law, said in the card above it (enhancedControls.js
   ctl-intro-law), so the stuck head keeps what must stay in reach - Primary, Defaults and Confirm, and the line a
   Confirm owes when it owes one - and a question about a key (ctl-asking) still stands in it whole. */
${G} .ctl-head:not(.ctl-asking) > p.meta { display: none !important; }
${G} .ctl-head:not(.ctl-asking) { padding: ${px(1)} ${px(3)} !important; }
${G} .ctl-head:not(.ctl-asking) .acts { flex-wrap: nowrap !important; justify-content: center; gap: ${px(4)} !important; margin: 0 !important; }
${G} .ctl-head:not(.ctl-asking) .acts .act { min-height: 0 !important; padding-top: 1px !important; padding-bottom: 1px !important; line-height: 20px; }
${G} .ctl-head .ctl-notice { margin: 1px 0 0 !important; line-height: 18px; text-align: center; }
/* ...and a key's row in the book is a line, not a thumb's target, where there is no thumb: 68 pixels a row (a 44-pixel
   row and 11 of padding each side) showed two keys at a time in that window. A touch screen keeps its targets. */
@media (any-pointer: fine) {
  ${G} .px-journal .ctl-row { padding-top: 3px !important; padding-bottom: 3px !important; min-height: 0 !important; }
  ${G} .px-journal .ctl-row > :is(.row-main, .ctl) { min-height: 0 !important; }
  ${G} .px-journal .ctl-row :is(.ctl-key, .ctl-clear) { min-height: 0 !important; padding-top: 1px !important; padding-bottom: 1px !important; line-height: 20px; }
}

/* THE UPRIGHT VIALS AT ANY HEIGHT: the editor's length is the vials' height (they stand; a length across them was a width
   the vial picture pinned, so the handle did nothing); lengthened, each is drawn out (longUp) - its foot, its glass, its
   head - so a tall vial is the HUD's own vial taller. The handle is on their top edge (--hm-len-axis), and a size taken
   from the corner grows them from the corner they stand in. */
${G}[data-grim-vitals="upright"] .hud .hud-bars, ${G}[data-grim-vitals="upright"] .hud .hud-bars .hud-vital { --hm-len-axis: y; }
${G}[data-grim-vitals="upright"] .hud .hud-bars[data-hm] { transform-origin: 0 100%; }
${G}[data-grim-vitals="upright"] .hud .hud-bars[data-hm-len] .hud-vital, ${G}[data-grim-vitals="upright"] .hud .hud-bars .hud-vital[data-hm-len] {
  height: calc(${px(86, 'gq')} * var(--hml-g, 1) * var(--hml-b, 1)); }
${['Health', 'Magicka', 'Fatigue'].map((k) => { const sel = (x) => `${G}[data-grim-vitals="upright"] .hud .hud-bars[data-hm-len] .hud-${k.toLowerCase()} ${x}, ${G}[data-grim-vitals="upright"] .hud .hud-bars .hud-${k.toLowerCase()}[data-hm-len] ${x}`;
    return `${sel('.hud-track')} { width: calc(${px(86, 'gq')} * var(--hml-g, 1) * var(--hml-b, 1)) !important; container-type: inline-size;
  background: ${longUp(k, true)}, #120a06; }
${sel('.hud-fill')} { background: ${longUp(k)}, var(--v-body); }`; }).join('\n')}
`;
}

/** The dress's whole static sheet: the face, the kit and the rosters. */
export const grimoireKitCss = () => snapCss(`${faceCss()}\n${kitCss()}\n${rosterCss()}`);
/** Every whole-pixel font size in a sheet moved to the face's grid (the kit's own, so it obeys its own law). */
export const snapCss = (css) => css.replace(/font-size:\s*([\d.]+)px/g, (m, n) => `font-size: ${snapSize(+n)}px`);
/** HUD-CLASS: the sheet evaluated once, as the dress lays it - the text the audit of the game's sheets reads
 *  (test/ui/naval/hudclass_sheets.test.js: a sheet whose selectors are built where it is laid is read only as an export). Pure:
 *  the card's choices are the root's attributes, never a rebuild. */
export const GRIMOIRE_KIT_CSS = grimoireKitCss();

// ── WEARING IT ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const GRIM_KIT_ID = 'dfo-grimoire-kit';
export const GRIM_INK_ID = 'dfo-grimoire-ink';
/** A sheet's text as the ink should read it: the kit's own rules (enhancedFrame.js FRAME_CSS) are the dress's to
 *  repaint outright, so they are left out - the ink re-says only what each screen wrote for itself. */
const readable = (style) => {
  let t = style.textContent ?? '';
  if (t.includes(FRAME_CSS)) t = t.replace(FRAME_CSS, '');
  return t;
};
const _said = new WeakMap();   // a <style> -> { len, ink }
let _observer = null, _poll = null;

/** Lay the dress's sheets on a page (idempotent): the face and kit, the ink of every enhanced sheet on it, and a watch
 *  that inks each sheet injected after (and keeps the dress's two sheets last). */
export function mountGrimoireDress(doc = globalThis.document) {
  if (!doc?.head) return false;
  const root = doc.documentElement;
  root.dataset.plusDress = GRIMOIRE_DRESS;
  root.dataset.grimPages = grimoirePages();
  root.dataset.grimBackdrop = grimoireBackdrop();
  root.dataset.grimVitals = grimoireVitals();
  root.dataset.grimSpellbook = grimoireSpellbook();
  root.dataset.grimDial = grimoireDial();   // DIAL-PACK
  let kit = doc.getElementById(GRIM_KIT_ID);
  if (!kit) { kit = doc.createElement('style'); kit.id = GRIM_KIT_ID; kit.textContent = GRIMOIRE_KIT_CSS; }
  let ink = doc.getElementById(GRIM_INK_ID);
  if (!ink) { ink = doc.createElement('style'); ink.id = GRIM_INK_ID; }
  const reink = () => {
    let changed = false;
    // INK-VARS: every sheet's own colours learned first, so a var one sheet defines and another names is read
    for (const s of doc.querySelectorAll('style')) if (s !== kit && s !== ink && _said.get(s)?.len !== (s.textContent ?? '').length) learnSheetVars(readable(s));
    for (const s of doc.querySelectorAll('style')) {
      if (s === kit || s === ink) continue;
      const len = (s.textContent ?? '').length;
      const was = _said.get(s);
      if (was && was.len === len) continue;
      _said.set(s, { len, ink: inkCss(readable(s)) });
      changed = true;
    }
    if (changed || !ink.textContent) ink.textContent = [...doc.querySelectorAll('style')].map((s) => _said.get(s)?.ink ?? '').join('\n');
    // the dress's two sheets stand last, so at equal weight they win
    if (doc.head.lastElementChild !== ink || ink.previousElementSibling !== kit) doc.head.append(kit, ink);
  };
  reink();
  if (doc.body) markGrimoireSurfaces(doc.body);
  const MO = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (!_observer && typeof MO === 'function') {
    // THE MARKS ARE STAMPED AS A SURFACE LANDS, before it paints (an observer runs before the frame does): every overlay
    // the page adds is watched whole - its own re-renders included - and the HUD alone is not, whose words change
    // every frame and which holds no page.
    const watched = new WeakSet();
    const land = (n) => { markGrimoireSurfaces(n); markGrimoireUnroll(n); markGrimoireSpellbook(n); markGrimoireBook(n); };
    const watch = (n) => {
      if (n.nodeType !== 1 || watched.has(n) || n.classList?.contains('hud')) return;
      watched.add(n);
      land(n);
      _observer.observe(n, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    };
    _observer = new MO((recs) => {
      let sheets = false;
      // what was taken away first (a scroll or a book re-drawn is taken away and drawn again in one beat: GRIM3)
      const gone = [];
      for (const r of recs) for (const n of r.removedNodes ?? []) if (n.nodeType === 1 && !n.classList?.contains('grim-rod') && n.dataset?.grimGhost == null) { noteGrimoireRemoved(n); gone.push([n, r.target]); }
      // a scroll taken away with none drawn in this same batch was CLOSED: it rolls up
      const drawn = recs.some((r) => [...(r.addedNodes ?? [])].some((n) => n.nodeType === 1 && (n.matches?.(UNROLL_SEL) || n.querySelector?.(UNROLL_SEL))));
      if (!drawn) for (const [n, from] of gone) rollUpGrimoireScroll(n, doc, from);
      if (gone.length) bookClosedCheck();
      for (const r of recs) {
        if (r.type === 'attributes') { if (r.target.nodeType === 1) { markGrimoireSurfaces(r.target); markGrimoireUnroll(r.target); } continue; }
        for (const n of r.addedNodes) {
          if (n.nodeName === 'STYLE') { if (n !== kit && n !== ink) sheets = true; continue; }
          if (n.nodeType !== 1 || n.classList?.contains('grim-rod') || n.classList?.contains('grim-sbarrow')) continue;
          if (r.target === doc.body || r.target === doc.documentElement) watch(n); else land(n);
        }
      }
      if (sheets) reink();
    });
    _observer.observe(doc.head, { childList: true });
    if (doc.body) { _observer.observe(doc.body, { childList: true }); for (const n of doc.body.children) watch(n); }
    // a sheet whose text is rewritten in place (a few windows re-say theirs as they open) is caught on the next beat
    _poll = setInterval(reink, 2000);
  }
  buildGrimoireArt(doc);
  return true;
}
/** Take the dress off a page (the Plus colours show again at once). */
export function unmountGrimoireDress(doc = globalThis.document) {
  const root = doc?.documentElement;
  if (root?.dataset) { delete root.dataset.plusDress; delete root.dataset.grimPages; delete root.dataset.grimBackdrop; delete root.dataset.grimVitals; delete root.dataset.grimSpellbook; }
  _observer?.disconnect(); _observer = null;
  if (_poll) clearInterval(_poll); _poll = null;
  doc?.getElementById?.(GRIM_KIT_ID)?.remove(); doc?.getElementById?.(GRIM_INK_ID)?.remove();
}
/** Choose the dress ('grimoire' or 'none'): stored, and worn or taken off at once. */
export function setPlusDress(id, doc = globalThis.document) {
  const want = id === GRIMOIRE_DRESS ? GRIMOIRE_DRESS : 'none';
  setPref('plusDress', want);
  if (doc?.documentElement) { if (want === GRIMOIRE_DRESS) mountGrimoireDress(doc); else unmountGrimoireDress(doc); }
  return want;
}
/** The card's two choices, worn at once. */
export function setGrimoirePages(id, doc = globalThis.document) {
  if (!Object.hasOwn(GRIMOIRE_PAGES, id)) return false;
  setPref('grimoirePages', id);
  if (doc?.documentElement?.dataset) doc.documentElement.dataset.grimPages = id;
  return true;
}
export function setGrimoireVitals(id, doc = globalThis.document) {
  if (!Object.hasOwn(GRIMOIRE_VITALS, id)) return false;
  setPref('grimoireVitals', id);
  if (doc?.documentElement?.dataset) doc.documentElement.dataset.grimVitals = id;
  return true;
}
export function setGrimoireDial(id, doc = globalThis.document) {
  if (!Object.hasOwn(GRIMOIRE_DIALS, id)) return false;
  setPref('grimoireDial', id);
  if (doc?.documentElement?.dataset) doc.documentElement.dataset.grimDial = id;
  return true;
}
export function setGrimoireSpellbook(id, doc = globalThis.document) {
  if (!Object.hasOwn(GRIMOIRE_SPELLBOOKS, id)) return false;
  setPref('grimoireSpellbook', id);
  if (doc?.documentElement?.dataset) doc.documentElement.dataset.grimSpellbook = id;
  return true;
}
export function setGrimoireBackdrop(id, doc = globalThis.document) {
  if (!Object.hasOwn(GRIMOIRE_BACKDROPS, id)) return false;
  setPref('grimoireBackdrop', id);
  if (doc?.documentElement?.dataset) doc.documentElement.dataset.grimBackdrop = id;
  return true;
}
