// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIRM1 (2026-10-13; bible/06-Systems/Firmament.md) - THE FIRMAMENT, DRAWN: the whole sky over the whole screen, as Path
// of Exile opens its tree - and as the Ascension opens its stars (ui/enhanced/enhancedLevelUp.js: a screen that is the whole screen,
// swapped in over the pause window, which it puts back when it closes).
//
// WHAT A PLAYER DOES HERE
//   - first, CHOOSES A SIGN: the seven starts glow; one pressed is theirs (the Serpent in the middle reaches every sign);
//   - then HOVERS a star to read it - and sees the shortest way to it from what they hold, lit (PoE's path preview);
//   - PRESSES it to allocate that whole way, if the purses pay; RIGHT-PRESSES (or long-presses) one they hold to take it
//     back, with every star that only reached the sign through it (firmamentLaw.js refundTakes);
//   - and CONFIRMS: every change is pending until then - free to try - and the confirm says what it allocates, what it
//     refunds and the silver a refund costs (free below Renown 10). The book asks the service the whole tree.
//   Drag pans, the wheel (or a pinch) zooms, F finds your sign, the search lights every star whose words match.
//
// TWO DRESSES, ONE WINDOW. Its frames are the stone-and-brass kit's roles (ui/enhanced/enhancedFrame.js FRAME_ROLES: the bar a
// window, the tip and the side panels, the presses buttons), so Enhanced Plus carves them and DFO Grimoire turns them into
// its pages and planks with no rule of this file's. The SKY is a canvas, and reads the dress itself: on Plus a night of
// brass and gold over a dithered dark; under the Grimoire a star-chart inked on the page - brown ink, red for what is held,
// gold leaf on a held star's rim - drawn at half resolution and laid pixelated, as every surface of the dress is.
//
// The law is net/firmament/firmamentLaw.js, the sky net/firmament/firmamentTree.js, the purses and the asks net/firmament/firmamentBook.js. Nothing
// here decides what may be allocated - it asks the law, and the service asks it again.
// ═══════════════════════════════════════════════════════════════════

import { t, localizedTable } from '../systems/textManager.js';   // UI-CALM: the read's failure, said; AUDIT GROWTH LANE5-1: every word the window says
import { FIRM_NODES, FIRM_EDGES, SIGNS, SERPENT, FIRM_RADII, signById } from '../net/firmament/firmamentTree.js';
import {
  pathTo, refundTakes, firmCostOf, fits, pointsLeft, treeDiff, refundSilver, statWords, statDef, overCap, treeStats, treeParts, FIRM_RESPEC_GOLD,
  buildCode, treeOfCode, treeFault,
} from '../net/firmament/firmamentLaw.js';
import { firmamentBook } from '../net/firmament/firmamentBook.js';
import { firmamentStatus, onFirmamentChange } from '../systems/firmamentLive.js';   // FIRM-STATUS: whether the stars act now, said on the side panel
import { sigilDueling } from '../systems/sigil/sigil.js';
import { accountRefusalText } from '../net/accountClient.js';   // AUDIT UICALM-FIRM1 L4 L4: a refusal the window has no words for, in the account's
import { FRAME_TONES } from './enhanced/enhancedFrame.js';
import { GRIM_TONES, GRIMOIRE_STACK, px } from './grimoireDress.js';
import { artVar } from './grimoireArt.js';
import { wrapAngle } from '../world/mat4.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';
import { audio } from '../systems/audio.js';   // the UI's own click, for a press on the sky (its buttons click through ui/uiClickSound.js)
import { SOUND } from '../systems/soundClips.js';

export const FIRM_STYLE_ID = 'firmament-window-css';

// ─── THE TWO PALETTES ───────────────────────────────────────────────

const F = FRAME_TONES, G = GRIM_TONES;
/** The respec's price, as the words take it (FIRM_RESPEC_GOLD, said `{gold, number}` - the reader's own grouping). */
const GOLD = { gold: FIRM_RESPEC_GOLD };
/** The sky's colours under Enhanced Plus: a night of brass and gold, the life ring in verdigris. */
export const PLUS_SKY = Object.freeze({
  ground0: '#111827', ground1: '#04060a', haze: 'rgba(192,138,62,0.05)', star: '#d9d2c0',
  edge: 'rgba(122,114,96,0.42)', edgeLit: '#d8432f', edgePath: 'rgba(216,67,47,0.5)', edgeLife: 'rgba(78,127,114,0.45)', edgeLifeLit: '#d8432f',
  node: F.groundButton, rim: F.stoneMid, rimLife: '#4e7f72',
  lit: F.brassHi, litRim: F.brass, litLife: '#9fe8cc', litRimLife: '#2c7341',
  glow: 'rgba(243,207,134,0.85)', glowLife: 'rgba(120,230,190,0.75)',
  text: '#e9e4d9', textDim: '#9a9486', textLit: F.brassHi, search: '#72f0d8', refuse: '#cf4a3a', figure: 'rgba(194,183,154,0.11)',
  plate: 'rgba(233,228,217,0.3)', halo: 'rgba(6,8,12,0.92)',
});
/** ...and under DFO Grimoire: a chart inked on the page. */
export const GRIM_SKY = Object.freeze({
  ground0: G.cream, ground1: G.tan, haze: 'rgba(91,59,31,0.06)', star: G.inkFaint,
  edge: 'rgba(91,59,31,0.55)', edgeLit: G.red, edgePath: 'rgba(181,36,24,0.45)', edgeLife: 'rgba(44,90,42,0.5)', edgeLifeLit: G.red,
  node: G.cream, rim: G.ink, rimLife: '#2c5a2a',
  lit: G.red, litRim: G.goldLeaf, litLife: '#3f7a2a', litRimLife: G.goldLeaf,
  glow: 'rgba(142,26,16,0.35)', glowLife: 'rgba(47,106,34,0.3)',
  text: G.ink, textDim: G.inkSoft, textLit: G.redDeep, search: '#1f4f9e', refuse: G.redHi, figure: 'rgba(91,59,31,0.16)',
  plate: 'rgba(43,26,12,0.4)', halo: 'rgba(239,220,174,0.95)',
});
/** Whether the page wears DFO Grimoire. */
const grimoireWorn = (doc) => doc?.documentElement?.dataset?.plusDress === 'grimoire';

/** A star's drawn radius, in tree units, by kind. */
export const NODE_R = Object.freeze({ small: 9, road: 9, notable: 16, keystone: 25, start: 30 });

// ─── THE SHEET ──────────────────────────────────────────────────────

/** What Escape says over unaccepted stars - the window's own Escape. */
const unacceptedEscape = () => t('firmament.unacceptedEscape', 'You have unaccepted changes. Press {accept} to keep them, or press Escape again to discard them.', { accept: t('firmament.accept', 'Accept') });
/** GROWTH5: what a press that would leave the sky says in the Growth tab (back(): Escape, another page or tab, the sheet's
 *  or the QuickDial's key) - any of them, so it names none. */
const unacceptedLeave = () => t('firmament.unacceptedLeave', 'You have unaccepted changes. Press {accept} to keep them, or leave again to discard them.', { accept: t('firmament.accept', 'Accept') });
/** What the overlays' close (the QuickDial's key) says over unaccepted stars. */
const unacceptedClose = () => t('firmament.unacceptedClose', 'You have unaccepted changes. Press {accept} to keep them, or close again to discard them.', { accept: t('firmament.accept', 'Accept') });   // AUDIT GROWTH LANE5-2: the button's own word

export const FIRM_CSS = `
.fmt-root { position: fixed; inset: 0; z-index: 14; overflow: hidden; user-select: none; -webkit-user-select: none; touch-action: none; }
.fmt-root.fmt-embed { position: absolute; z-index: auto; }   /* GROWTH3: drawn in the pause window's Growth tab, the stage's size */
.fmt-root.fmt-embed .fmt-bar h2 { display: none; }   /* GROWTH3: the rail names the page */
/* GROWTH-BOOK: in the tab the sky's words stand left of its side panel - the help line wraps there, never cut at both
   ends, and the birthsign line is centred over the sky, not under the panel */
@media (min-width: 761px) {
  .fmt-root.fmt-embed .fmt-side { width: 280px; }
  .fmt-root.fmt-embed .fmt-hint { left: 12px; right: 304px; transform: none; white-space: normal; max-width: none; text-align: center; line-height: 1.4; }
  .fmt-root.fmt-embed .fmt-say { left: calc((100% - 292px) / 2); max-width: calc(100% - 316px); }
  .fmt-root.fmt-embed:has(.fmt-side.shut) .fmt-hint { right: 12px; }
  .fmt-root.fmt-embed:has(.fmt-side.shut) .fmt-say { left: 50%; max-width: calc(100% - 32px); }
}
.fmt-root canvas.fmt-sky { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
.fmt-root canvas.fmt-sky.drag { cursor: grabbing; }
.fmt-root canvas.fmt-sky.over { cursor: pointer; }
.fmt-bar { position: absolute; left: 16px; right: 16px; margin-inline: auto; width: fit-content; top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  justify-content: center; padding: 8px 14px; max-width: calc(100vw - 32px); box-sizing: border-box; font-family: var(--data); color: #e9e4d9; }
.fmt-bar h2 { margin: 0 6px 0 0; font-family: var(--brand); font-weight: 400; font-size: 26px; letter-spacing: 0.02em; color: #f3cf86; line-height: 1; }
.fmt-purse { display: inline-flex; align-items: baseline; gap: 6px; padding: 3px 10px; font-size: 14px; white-space: nowrap; }
.fmt-purse b { font-size: 18px; font-weight: 600; color: #f3cf86; }
.fmt-purse.life b { color: #9fe8cc; }
.fmt-purse .of { color: #b9b2a1; font-size: 12px; }
.fmt-btn { font: inherit; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 12px; cursor: pointer; color: #e9e4d9; }
.fmt-btn[disabled] { opacity: 0.45; cursor: default; }
.fmt-find { font: inherit; font-size: 13px; padding: 5px 8px; width: 180px; color: #e9e4d9; background: transparent; }
.fmt-side { position: absolute; right: 12px; top: 74px; bottom: 54px; width: 300px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 12px 14px;
  overflow-y: auto; font-family: var(--data); color: #e9e4d9; font-size: 13px; }
.fmt-side.shut { display: none; }
.fmt-side h3 { margin: 10px 0 6px; font-family: var(--display); font-size: 17px; font-weight: 600; color: #f3cf86; }
.fmt-side h3:first-child { margin-top: 0; }
.fmt-side .fmt-sign { font-family: var(--display); font-size: 15px; color: #c2b79a; margin: 0 0 8px; }
.fmt-side ul { list-style: none; margin: 0; padding: 0; }
.fmt-side li { padding: 2px 0; line-height: 1.35; }
.fmt-side li.capped { color: #f3cf86; }
.fmt-side li.capped::after { content: ' ' attr(data-cap); color: #b9b2a1; font-size: 12px; }   /* AUDIT UICALM-FIRM1 L5 M8: UI-CALM's type floor and quiet ink */
.fmt-side li.neg { color: #e08a7a; }
.fmt-side .none { color: #b9b2a1; font-style: italic; }
.fmt-side .fmt-note { color: #b9b2a1; font-size: 12px; margin: 10px 0 0; line-height: 1.4; }
.fmt-side .fmt-live { color: #f3cf86; font-size: 14px; margin: 0 0 8px; line-height: 1.4; }
.fmt-side .fmt-live.off { color: #e08a7a; }
.fmt-tip { position: absolute; z-index: 2; pointer-events: none; min-width: 200px; max-width: 320px; padding: 10px 12px; font-family: var(--data); color: #e9e4d9; font-size: 13px; display: none; }
.fmt-tip.on { display: block; }
.fmt-tip .nm { font-family: var(--display); font-size: 18px; font-weight: 600; color: #f3cf86; line-height: 1.15; }
.fmt-tip .nm.life { color: #9fe8cc; }
.fmt-tip .kd { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #b9b2a1; margin: 2px 0 6px; }
.fmt-tip ul { list-style: none; margin: 0; padding: 0; }
.fmt-tip li { padding: 1px 0; }
.fmt-tip li.neg { color: #e08a7a; }
.fmt-tip .tx { margin: 6px 0 0; font-style: italic; color: #c2b79a; line-height: 1.35; }
.fmt-tip .ft { margin: 8px 0 0; font-size: 12px; color: #c2b79a; }
.fmt-tip .ft.no { color: #e08a7a; }
.fmt-hint { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); pointer-events: none; padding: 6px 14px; font-family: var(--data); font-size: 12px; color: #c2b79a;
  white-space: nowrap; max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; }
.fmt-say { position: absolute; left: 50%; top: 74px; transform: translateX(-50%); pointer-events: none; padding: 7px 16px; font-family: var(--display); font-size: 16px; color: #e9e4d9; display: none; max-width: calc(100vw - 32px); box-sizing: border-box; text-align: center; }
.fmt-say.on { display: block; }
.fmt-say.no { color: #ffb4a6; }
.fmt-confirmbox { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 16px 20px; min-width: 300px; max-width: calc(100vw - 32px); box-sizing: border-box;
  font-family: var(--data); color: #e9e4d9; display: none; z-index: 3; }
.fmt-confirmbox.on { display: block; }
.fmt-confirmbox h3 { margin: 0 0 8px; font-family: var(--display); font-size: 20px; color: #f3cf86; }
.fmt-confirmbox p { margin: 4px 0; font-size: 14px; }
.fmt-confirmbox .fmt-code { width: 100%; box-sizing: border-box; margin: 2px 0 8px; user-select: text; -webkit-user-select: text; }
.fmt-confirmbox .row.share { justify-content: flex-start; margin-top: 2px; }
.fmt-confirmbox .row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
@media (max-width: 760px) {
  .fmt-side { top: auto; bottom: 48px; height: 38vh; width: auto; left: 12px; right: 12px; }
  .fmt-bar h2 { font-size: 20px; }
  .fmt-find { width: 110px; }
}
/* DFO Grimoire: the words in its face and ink - the frames are the kit's, which the dress repaints */
:root[data-plus-dress="grimoire"] .fmt-root { font-family: ${GRIMOIRE_STACK}; }
:root[data-plus-dress="grimoire"] .fmt-bar h2 { font-family: ${GRIMOIRE_STACK}; color: ${G.redDeep}; font-size: 32px; }
:root[data-plus-dress="grimoire"] .fmt-tip .nm, :root[data-plus-dress="grimoire"] .fmt-side h3, :root[data-plus-dress="grimoire"] .fmt-confirmbox h3 { color: ${G.red}; font-family: ${GRIMOIRE_STACK}; }
:root[data-plus-dress="grimoire"] .fmt-tip .nm.life { color: #2f6a22; }
:root[data-plus-dress="grimoire"] .fmt-purse b { color: ${G.yellow}; }
:root[data-plus-dress="grimoire"] .fmt-purse.life b { color: #c8f0a0; }
:root[data-plus-dress="grimoire"] .fmt-btn.fmt-go, :root[data-plus-dress="grimoire"] .fmt-btn.fmt-exit { color: ${G.yellow}; }
:root[data-plus-dress="grimoire"] .fmt-side li.capped { color: ${G.red}; }
:root[data-plus-dress="grimoire"] .fmt-side .fmt-live { color: inherit; }
:root[data-plus-dress="grimoire"] .fmt-side .fmt-live.off { color: ${G.redHi}; }
:root[data-plus-dress="grimoire"] .fmt-tip li.neg, :root[data-plus-dress="grimoire"] .fmt-side li.neg, :root[data-plus-dress="grimoire"] .fmt-tip .ft.no { color: ${G.redHi}; }
:root[data-plus-dress="grimoire"] .fmt-say { font-family: ${GRIMOIRE_STACK}; }
/* THE SCROLLS (the lead dev, 2026-10-13: "give the tooltips when hovering a scroll look the upper message also a scroll
   look"; "dont use a scroll tooltip for enhanced plus"): under the DFO Grimoire a star's card and the word under the bar
   are written on a little scroll, its wooden rods down the sides - once its art is read, the pack's own (REPR01I0, the
   item scroll the shelves hold out - grimoireDress.js THE ITEM SCROLLS); until then, this one. Enhanced Plus keeps its
   stone panels. */
:root[data-plus-dress="grimoire"] .fmt-tip, :root[data-plus-dress="grimoire"] .fmt-say { background: radial-gradient(ellipse at 50% 45%, #f1deb1 0%, #e6cb93 62%, #d2ae72 100%) !important;
  border: 0 !important; border-image: none !important; border-radius: 2px !important; outline: none !important;
  box-shadow: inset 0 0 0 1px rgba(92,56,24,0.35), inset 0 0 14px rgba(120,76,30,0.35) !important;
  filter: drop-shadow(1px 2px 0 rgba(0,0,0,0.45)) drop-shadow(3px 7px 8px rgba(0,0,0,0.45));
  color: #2b1a0c !important; text-shadow: none !important; }
:root[data-plus-dress="grimoire"] .fmt-tip::before, :root[data-plus-dress="grimoire"] .fmt-tip::after, :root[data-plus-dress="grimoire"] .fmt-say::before, :root[data-plus-dress="grimoire"] .fmt-say::after { content: ''; position: absolute; top: -7px; bottom: -7px; width: 13px; border-radius: 7px;
  background: linear-gradient(90deg, #2a170a 0%, #6b4220 30%, #a8743d 48%, #6b4220 70%, #2a170a 100%);
  box-shadow: 0 -3px 0 -1px #1d0f05, 0 3px 0 -1px #1d0f05; pointer-events: none; }
:root[data-plus-dress="grimoire"] .fmt-tip::before, :root[data-plus-dress="grimoire"] .fmt-say::before { left: -11px; }
:root[data-plus-dress="grimoire"] .fmt-tip::after, :root[data-plus-dress="grimoire"] .fmt-say::after { right: -11px; }
:root[data-plus-dress="grimoire"] .fmt-tip .nm { color: #8e1b10 !important; }
:root[data-plus-dress="grimoire"] .fmt-tip .nm.life { color: #2f5f1e !important; }
:root[data-plus-dress="grimoire"] .fmt-tip .kd { color: #6a4a2a !important; }
:root[data-plus-dress="grimoire"] .fmt-tip li { color: #2b1a0c; }
:root[data-plus-dress="grimoire"] .fmt-tip li.neg, :root[data-plus-dress="grimoire"] .fmt-tip .ft.no, :root[data-plus-dress="grimoire"] .fmt-say.no { color: #a3200f !important; }
:root[data-plus-dress="grimoire"] .fmt-tip .tx { color: #4a3420 !important; }
:root[data-plus-dress="grimoire"] .fmt-tip .ft { color: #5a3e22 !important; border-top: 1px solid rgba(92,56,24,0.4); padding-top: 5px; }
:root[data-plus-dress="grimoire"] .fmt-say { color: #2b1a0c !important; padding: 7px 20px !important; }
:root[data-plus-dress="grimoire"][data-grim-art="ready"] .fmt-tip, :root[data-plus-dress="grimoire"][data-grim-art="ready"] .fmt-say {
  background: none !important; border: 2px solid transparent !important; border-radius: 0 !important; box-shadow: none !important;
  border-image: var(${artVar('sideScroll')}, none) 15 fill / ${px(15, 'gq')} / 0 round !important; padding: ${px(6, 'gq')} ${px(16, 'gq')} !important; }
:root[data-plus-dress="grimoire"][data-grim-art="ready"] .fmt-tip::before, :root[data-plus-dress="grimoire"][data-grim-art="ready"] .fmt-tip::after,
:root[data-plus-dress="grimoire"][data-grim-art="ready"] .fmt-say::before, :root[data-plus-dress="grimoire"][data-grim-art="ready"] .fmt-say::after { display: none; }
`;
function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(FIRM_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = FIRM_STYLE_ID;
  st.textContent = FIRM_CSS;
  doc.head?.appendChild(st);
}

// ─── THE MODEL (pure: the window's words) ────────────────────────────

/** What a star is called by kind, as its card says it. */
export function kindWords(n) {
  const ring = n.ring === 'life' ? 'life' : 'combat';
  if (n.kind === 'start') return n.key === `${SERPENT.id}.start` ? t('firmament.kind.signCentre', 'Birthsign, in the center') : t('firmament.kind.sign', 'Birthsign');
  if (n.kind === 'keystone') return t('firmament.kind.keystone', '{ring, select, life {Craft keystone} other {Combat keystone}}', { ring });
  if (n.kind === 'notable') return t('firmament.kind.notable', '{ring, select, life {Craft notable} other {Combat notable}}', { ring });
  return n.kind === 'road' ? t('firmament.kind.road', '{ring, select, life {Craft} other {Combat}} · {name}', { ring, name: n.name })
    : t('firmament.kind.star', '{ring, select, life {Craft star} other {Combat star}}', { ring });
}
/** A star's lines: its stats in words, a price's (a negative) marked. */
export function statLines(stats) {
  // a price is a line against the player: less of a good thing, or more damage taken
  return Object.entries(stats ?? {}).map(([k, v]) => ({ text: statWords(k, v), neg: /Taken$/.test(k) ? v > 0 : v < 0 }));
}
/** The sky's sums as the side panel says them: `{ combat: [...], life: [...] }`, each line `{ text, capped, neg }`. */
export function summaryOf(tree) {
  // AUDIT UICALM-FIRM1 L1 M2: what the sky does - the gains capped, then the prices paid (treeStats) - and a channel held
  // back where its gains pass the budget
  const held = treeStats(tree);
  const over = new Set(overCap(treeParts(tree).gains).map((o) => o.key));
  const out = { combat: [], life: [] };
  for (const [k, v] of Object.entries(held).sort(([a], [b]) => a.localeCompare(b))) {
    const d = statDef(k);
    if (!d) continue;
    const neg = /Taken$/.test(k) ? v > 0 : v < 0;
    out[d.kind].push({ key: k, text: statWords(k, v), capped: over.has(k), neg });
  }
  return out;
}
/** Why a star cannot be allocated, in words - or null when it can (`path` the law's way to it). */
export function refusalOf(tree, key, stars, craft) {
  const n = FIRM_NODES.get(key);
  if (!n) return t('firmament.no.unknown', 'Unknown star.');
  if (!tree.start) return n.kind === 'start' ? null : signFirst();
  if (n.kind === 'start') return key === tree.start ? null : t('firmament.no.otherSign', 'You already have a birthsign. To change it, right-click yours to reset all stars.');
  if (tree.keys.includes(key)) return null;
  const path = pathTo(tree, key);
  if (!path.length) return t('firmament.no.path', 'Your stars have no path to this star.');
  const want = [...tree.keys, ...path];
  if (fits(want, stars, craft)) return null;
  const c = firmCostOf(path), left = pointsLeft(tree.keys, stars, craft);
  if (c.combat > left.stars) return t('firmament.no.stars', 'You need {need} {need, plural, one {Star} other {Stars}} and have {have}. Craft points can only be spent on craft stars.', { need: c.combat, have: Math.max(0, left.stars) });
  return t('firmament.no.points', 'You need {need} {need, plural, one {point} other {points}} and have {have}.', { need: c.combat + c.life, have: Math.max(0, left.stars) + left.craft });
}
/** Why a star other than a sign cannot be taken before a sign is - the refusal's words and the press's. */
const signFirst = () => t('firmament.no.signFirst', 'Choose a birthsign first: one of the seven large stars.');
/** The respec with nothing to take back, and without the gold - the press's title and the service's refusal. */
const respecNone = () => t('firmament.respec.none', 'Nothing to reset yet.');
const needGold = () => t('firmament.respec.needGold', 'You need {gold, number} gold to respec.', GOLD);

// ─── THE WINDOW ─────────────────────────────────────────────────────

const el = (tag, cls = null, text = null) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const cloneTree = (t) => ({ start: t?.start ?? null, keys: [...(t?.keys ?? [])] });
/** A tiny seeded dice, so the sky's dust is the same every opening. */
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * Mount the Firmament over `host`. `book` the page's (net/firmament/firmamentBook.js) - or `preview` for a sky with no service
 * (the lab page, an offline look): `{ tree, stars, craft, renown, commit? }`. `onExit` when it closes.
 * GROWTH3 (bible/10-UI/Growth.md section 6): `embed` draws it IN the pause window's Growth tab (ui/growth/growthStage.js) -
 * the stage's size, not the screen's; no Close (the tab is left as any page is), no overlay of its own and no Escape of its
 * own: the window's back stack asks `back()` (a confirm shut, unaccepted stars asked about once) before it goes on.
 * @param {HTMLElement} host
 * @param {{ book?: any, preview?: any, onExit?: () => void, doc?: Document, embed?: boolean }} [o]
 */
export function mountFirmamentWindow(host, { book = firmamentBook(), preview = null, onExit = () => {}, doc = document, embed = false } = {}) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  ensureStyle(doc);
  const grim = grimoireWorn(doc);
  const P = grim ? GRIM_SKY : PLUS_SKY;
  const font = (() => {
    if (grim) return GRIMOIRE_STACK;
    try { return globalThis.getComputedStyle(doc.documentElement).getPropertyValue('--display').trim() || 'Georgia, serif'; } catch { return 'Georgia, serif'; }
  })();
  const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── the purses and the trees ──
  const purse = () => (preview ? { stars: preview.stars ?? 0, craft: preview.craft ?? 0, renown: preview.renown ?? 1, refund: preview.refund ?? { freeBelow: 10, perStar: 10 } }
    : { stars: book?.state?.stars ?? 0, craft: book?.state?.craft ?? 0, renown: book?.state?.renown ?? 1, refund: book?.state?.refund ?? { freeBelow: 10, perStar: 10 } });
  let committed = cloneTree(preview ? preview.tree : book?.current?.());
  let pending = cloneTree(committed);
  const online = !!book || !!preview;

  // ── the frame ──
  const root = el('div', 'fmt-root');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', t('firmament.title', 'The Firmament'));
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'fmt-sky'));
  canvas.setAttribute('aria-hidden', 'true');
  const bar = el('div', 'fmt-bar');
  bar.setAttribute('data-grim', 'wood');
  const title = el('h2', null, t('firmament.title', 'The Firmament'));
  const starsChip = el('span', 'fmt-purse');
  const craftChip = el('span', 'fmt-purse life');
  const find = /** @type {HTMLInputElement} */ (el('input', 'fmt-find'));
  find.type = 'search';
  find.placeholder = t('firmament.search', 'Search stars...');
  find.setAttribute('aria-label', t('firmament.searchAria', 'Search stars'));
  const btn = (label, cls, fn, aria = null) => {
    const b = /** @type {HTMLButtonElement} */ (el('button', `fmt-btn ${cls}`.trim(), label));
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    return b;
  };
  const undoBtn = btn(t('firmament.discard', 'Discard changes'), '', () => { pending = cloneTree(committed); refresh(); say(t('firmament.say.discarded', 'Changes discarded.')); });
  const goBtn = btn(t('firmament.accept', 'Accept'), 'fmt-go', () => openConfirm());
  const sideBtn = btn(t('firmament.summary', 'Summary'), '', () => { side.classList.toggle('shut'); });
  const signBtn = btn(t('firmament.signBtn', 'Birthsign'), '', () => focusSign(), t('firmament.signAria', 'Center on your birthsign'));
  const respecBtn = btn(t('firmament.respecBtn', 'Respec'), '', () => openRespec(), t('firmament.respec.tip', 'Remove all your stars and your birthsign for {gold, number} gold.', GOLD));
  const shareBtn = btn(t('firmament.shareBtn', 'Share'), '', () => openShare(), t('firmament.shareAria', 'Copy your build code, or load one'));
  const exitBtn = btn(t('firmament.close', 'Close'), 'fmt-exit', () => close());
  bar.append(title, starsChip, craftChip, find, signBtn, sideBtn, shareBtn, undoBtn, respecBtn, goBtn, exitBtn);
  const side = el('div', 'fmt-side');
  side.setAttribute('data-grim', 'ink');
  if ((globalThis.innerWidth ?? 1280) < 760) side.classList.add('shut');
  const tip = el('div', 'fmt-tip');
  tip.setAttribute('data-grim', 'ink');
  const coarse = !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;   // AUDIT UICALM-FIRM1 L4 H1: a finger's words
  const hint = el('div', 'fmt-hint', coarse ? t('firmament.hintTouch', 'Tap a star to see it, tap again to learn it and the stars on the way · Hold a learned star to remove it · Drag to pan · Pinch to zoom')
    : t('firmament.hint', 'Click a star to learn it and the stars on the way · Right-click a learned star to remove it · Drag to pan · Scroll to zoom · F: center on your birthsign'));
  hint.setAttribute('data-grim', 'ink');
  const sayBox = el('div', 'fmt-say');
  sayBox.setAttribute('data-grim', 'ink');
  sayBox.setAttribute('role', 'status');
  const confirmBox = el('div', 'fmt-confirmbox');
  confirmBox.setAttribute('data-grim', 'ink');
  root.append(canvas, bar, side, tip, hint, sayBox, confirmBox);
  if (embed) { root.classList.add('fmt-embed'); root.setAttribute('aria-modal', 'false'); exitBtn.hidden = true; }   // GROWTH3
  host.append(root);

  // ── the view ──
  const view = { x: 0, y: 0, z: 0.35 };
  const vw = () => root.clientWidth || globalThis.innerWidth || 1280;
  const vh = () => root.clientHeight || globalThis.innerHeight || 720;
  /** The whole sky in the frame - beside the summary, where it stands open. */
  const room = () => (side.classList.contains('shut') ? vw() : Math.max(320, vw() - 320));
  /** The whole sky in the frame, and no further out: the farthest a wheel or a pinch takes the view. */
  const zFloor = () => Math.max(0.12, Math.min(room(), vh() - 240) / 2900);   // between the bar above and the hint below
  const Z_CEIL = 2.5;
  /** The sky's own edge: the outer keystones and their names. */
  const SKY_EDGE = FIRM_RADII.lifeKeystone + 80;
  /** HOLD THE SKY IN THE FRAME: never further out than the whole of it, and never dragged off - the middle of the
   * screen always looks at the sky, so it cannot be pushed out of sight. */
  const hold = () => {
    view.z = Math.max(zFloor(), Math.min(Z_CEIL, view.z));
    // how far the sky's middle may stand from the screen's: far enough to bring an outer keystone near the middle when
    // close in, never so far that the sky slides out of sight when far out (the inner ring's width at the least)
    const reach = Math.max(FIRM_RADII.life * view.z, SKY_EDGE * view.z - 0.35 * Math.min(vw(), vh()));
    view.x = Math.max(-reach, Math.min(reach, view.x));
    view.y = Math.max(-reach, Math.min(reach, view.y));
  };
  /** AUDIT UICALM-FIRM1 L4 H1: where the bar's foot stands - the sky is centred in the room under it (the bar had stood
   *  over the middle of a phone's sky, the signs under it) */
  const barFoot = () => { try { const r = bar.getBoundingClientRect(), o = root.getBoundingClientRect(); return Math.max(0, r.bottom - o.top); } catch { return 0; } };
  const fit = () => {
    view.z = zFloor();
    view.x = (room() - vw()) / 2;
    view.y = Math.max(40, barFoot() / 2);
  };
  fit();
  /** Screen pixels (CSS) to the sky's units, and back. */
  const toSky = (sx, sy) => ({ x: (sx - vw() / 2 - view.x) / view.z, y: (sy - vh() / 2 - view.y) / view.z });
  const toScreen = (x, y) => ({ x: vw() / 2 + view.x + x * view.z, y: vh() / 2 + view.y + y * view.z });

  // ── the dust: a fixed field of faint stars behind the sky ──
  const rnd = seeded(41214);
  const dust = Array.from({ length: 900 }, () => ({ x: (rnd() - 0.5) * 3600, y: (rnd() - 0.5) * 3600, r: 0.6 + rnd() * 1.8, a: 0.15 + rnd() * 0.55, p: rnd() * Math.PI * 2 }));

  // ── the state the frame reads ──
  let hover = /** @type {string|null} */ (null);
  let preview_ = /** @type {Set<string>} */ (new Set());   // the way a hover would allocate
  let refundPreview = /** @type {Set<string>} */ (new Set());
  let matches = /** @type {Set<string>} */ (new Set());
  /** @type {{ key: string, t0: number }[]} */
  let bursts = [];
  let dead = false;
  let dirty = true;
  let sayTimer = 0;

  const held = () => new Set([pending.start, ...pending.keys].filter(Boolean));
  const heldCommitted = () => new Set([committed.start, ...committed.keys].filter(Boolean));

  /** A line over the sky - gone after a moment, or (`stay`) until the next. */
  /** AUDIT GROWTH LANE2-6: the line under the bar, in the root's own frame - in the tab the root is not at the screen's
   *  top (it stood 200 px low, or off a short stage), and again whenever the window is resized (a phone's face measured
   *  while it waited, detached, for its door). */
  const placeSay = () => { sayBox.style.top = `${Math.round((barFoot() || 66) + 10)}px`; };
  function say(text, refused = false, stay = false) {
    sayBox.textContent = text;
    // always under the bar, however tall it has wrapped
    placeSay();
    sayBox.classList.add('on');
    sayBox.classList.toggle('no', refused);
    clearTimeout(sayTimer);
    if (!stay) sayTimer = /** @type {any} */ (setTimeout(() => sayBox.classList.remove('on'), refused ? 3200 : 2200));
  }

  /** Whether anything the player chose is not accepted yet - a star, a refund, a birthsign. */
  function unaccepted() { const c = changes(); return !!(c.added || c.removed || (c.startChanged && pending.start)); }
  function changes() {
    const d = treeDiff(committed, pending);
    const removedCommitted = committed.start ? d.removed.length : 0;
    const p = purse();
    return { added: d.added.length, removed: removedCommitted, silver: refundSilver(removedCommitted, p.renown), startChanged: d.startChanged };
  }

  /** A respec on its way (Accept waits for it). */
  let respecking = false;
  function refresh() {
    const p = purse();
    const left = pointsLeft(pending.keys, p.stars, p.craft);
    starsChip.replaceChildren(el('span', null, `★ ${t('firmament.purse.stars', 'Stars')}`), el('b', null, String(Math.max(0, left.stars))), el('span', 'of', t('firmament.purse.of', 'of {n}', { n: p.stars })));
    craftChip.replaceChildren(el('span', null, `✦ ${t('firmament.purse.craft', 'Craft')}`), el('b', null, String(left.craft)), el('span', 'of', t('firmament.purse.of', 'of {n}', { n: p.craft })));
    starsChip.title = t('firmament.purse.starsTip', 'Stars: 2 for each Renown level after the first (your Renown is {renown}). They can be spent on any star.', { renown: p.renown });
    craftChip.title = t('firmament.purse.craftTip', 'Craft points: 1 for every 8 ranks, counting all your professions. They can only be spent on craft stars (the outer ring).');
    const c = changes();
    const n = c.added + c.removed + (c.startChanged && pending.start ? 1 : 0);   // AUDIT UICALM-FIRM1 L4 M5: a birthsign alone is a change
    goBtn.textContent = n ? t('firmament.acceptN', 'Accept ({n})', { n }) : t('firmament.accept', 'Accept');
    goBtn.disabled = !n || !online || respecking;   // AUDIT UICALM-FIRM1 L2 M1: no change while the sky is being taken back
    undoBtn.disabled = !n;
    // THE RESPEC: a sky with something learned in it, and (online) the gold in the purse
    respecBtn.disabled = !committed.start || (!preview && !book?.canRespec?.());
    respecBtn.title = !committed.start ? respecNone() : respecBtn.disabled ? needGold() : t('firmament.respec.tip', 'Remove all your stars and your birthsign for {gold, number} gold.', GOLD);
    drawSide();
    dirty = true;
  }

  function drawSide() {
    const s = summaryOf(pending);
    const sign = pending.start ? signById(pending.start.split('.')[0]) : null;
    const parts = [];
    parts.push(el('h3', null, sign ? sign.name : t('firmament.side.noSign', 'No birthsign chosen')));
    parts.push(el('p', 'fmt-sign', sign ? sign.lore : t('firmament.side.chooseSign', 'Click one of the seven large stars to choose your birthsign. The Serpent, in the center, can reach every part of the sky.')));
    // FIRM-STATUS: the sums below are the stars held, whether or not they act - this line says whether they act now.
    // A lab sky (preview) has no game to act in.
    if (!preview) {
      const status = firmamentStatus({ read: book?.state?.open === true, dueling: sigilDueling() });
      parts.push(el('p', `fmt-live${status === 'active' ? '' : ' off'}`, statusText(status)));
    }
    for (const ring of /** @type {const} */ (['combat', 'life'])) {
      parts.push(el('h3', null, ring === 'combat' ? t('firmament.side.combat', 'Combat') : t('firmament.side.craft', 'Crafting and trade')));
      const ul = el('ul');
      if (!s[ring].length) ul.append(el('li', 'none', ring === 'combat' ? t('firmament.side.none', 'Nothing learned yet.') : t('firmament.side.noneCraft', 'Nothing learned yet. Craft stars are on the outer ring.')));
      for (const line of s[ring]) {
        const li = el('li', `${line.capped ? 'capped' : ''} ${line.neg ? 'neg' : ''}`.trim(), line.text);
        if (line.capped) li.setAttribute('data-cap', t('firmament.side.capped', '(capped)'));   // the CSS's ::after says it
        ul.append(li);
      }
      parts.push(ul);
    }
    const p = purse();
    // the caps (firmamentLaw.js STAT_DEFS, BLOW_CAP, BLOW_TOTAL_CAP) and where the sky sleeps (firmamentPowers.js firmamentAwake: offline,
    // a duel or an arena bout, mentoring; never a blow or a spell at a player - a siege and the Wrothgarian zone included)
    parts.push(el('p', 'fmt-note', `${t('firmament.side.caps', 'Limits for all stars together: +30% weapon damage (up to +50% against unaware foes, or while you are below half Health), +30% spell damage, 15% less damage taken.')} ${t('firmament.side.where', 'Stars work only online, and not while you mentor. Combat stars do nothing in duels or Arena fights, and never add damage against other players.')}`));
    parts.push(el('p', 'fmt-note', `${p.renown < p.refund.freeBelow
      ? t('firmament.side.refundFree', 'Removing stars is free until Renown {renown}.', { renown: p.refund.freeBelow })
      : t('firmament.side.refundCost', 'Removing an accepted star costs {silver} silver.', { silver: p.refund.perStar })} ${t('firmament.side.respec', 'A respec removes all your stars and your birthsign for {gold, number} gold.', GOLD)}`));
    side.replaceChildren(...parts);
  }

  // ── the tip ──
  function showTip(key, sx, sy) {
    const n = FIRM_NODES.get(key);
    if (!n) { tip.classList.remove('on'); return; }
    const parts = [el('div', `nm${n.ring === 'life' ? ' life' : ''}`, n.kind === 'small' ? (n.ring === 'life' ? t('firmament.tip.minorCraft', 'Minor craft star') : t('firmament.tip.minor', 'Minor star')) : n.name)];
    const sign = signById(n.sector);
    parts.push(el('div', 'kd', `${kindWords(n)}${sign && n.kind !== 'start' ? ` · ${sign.name}` : ''}`));
    const ul = el('ul');
    for (const l of statLines(n.stats)) ul.append(el('li', l.neg ? 'neg' : null, l.text));
    parts.push(ul);
    if (n.text) parts.push(el('p', 'tx', n.text));
    if (n.kind === 'start') parts.push(el('p', 'tx', signById(n.sector)?.lore ?? ''));
    const p = purse();
    let foot = null, no = false;
    if (held().has(key)) {
      if (n.kind === 'start') foot = t('firmament.tip.ownSign', 'Your birthsign. Right-click to reset all stars and choose again.');
      else {
        const takes = refundTakes(pending, key);
        const paid = takes.filter((k) => heldCommitted().has(k)).length;
        const silver = committed.start ? refundSilver(paid, p.renown) : 0;
        foot = takes.length > 1 ? t('firmament.tip.removeWith', 'Right-click to remove it and {n, plural, one {the star that depends on it} other {the # stars that depend on it}}.', { n: takes.length - 1 })
          : t('firmament.tip.remove', 'Right-click to remove.');
        if (silver) foot += ` ${t('firmament.tip.removeCost', 'Costs {silver} silver.', { silver })}`;
      }
    } else {
      const why = refusalOf(pending, key, p.stars, p.craft);
      if (why) { foot = why; no = true; } else if (n.kind === 'start') foot = t('firmament.tip.takeSign', 'Click to choose this birthsign.');
      else {
        // the life ring takes Craft points first, then Stars (firmamentLaw.js pointsLeft)
        const c = firmCostOf(pathTo(pending, key));
        foot = !c.life ? t('firmament.tip.learnStars', 'Click to learn. Cost: {n} {n, plural, one {Star} other {Stars}}.', { n: c.combat })
          : !c.combat ? t('firmament.tip.learnCraft', 'Click to learn. Cost: {n} {n, plural, one {point} other {points}}, Craft points first.', { n: c.life })
            : t('firmament.tip.learnBoth', 'Click to learn. Cost: {stars} {stars, plural, one {Star} other {Stars}}, plus {craft} {craft, plural, one {point} other {points}} for craft stars, Craft points first.', { stars: c.combat, craft: c.life });
      }
    }
    if (foot) parts.push(el('p', `ft${no ? ' no' : ''}`, foot));
    tip.replaceChildren(...parts);
    tip.classList.add('on');
    const w = tip.offsetWidth || 260, h = tip.offsetHeight || 140;
    let x = sx + 18, y = sy + 18;
    if (x + w > vw() - 8) x = sx - w - 18;
    if (y + h > vh() - 8) y = Math.max(8, vh() - h - 8);
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  }

  // ── allocation ──
  /** The game's own button click (DAGGER.SND's ButtonClick) for a press on the sky: the canvas is no button, so the
   *  page's click (ui/uiClickSound.js) never hears it. Silent where the sound engine is not up (a lab with no data). */
  const click = () => { try { if (audio.enabled) audio.playOneShot(SOUND.ButtonClick, 1); } catch { /* a sound is not the sky's problem */ } };
  function allocate(key) {
    const n = FIRM_NODES.get(key);
    if (!n) return;
    const p = purse();
    if (!pending.start) {
      if (n.kind !== 'start') { say(signFirst(), true); return; }
      pending = { start: key, keys: [] };
      burst(key);
      say(t('firmament.say.signChosen', 'Birthsign chosen: {name}.', { name: n.name }));
      refresh();
      return;
    }
    if (held().has(key)) return;
    const why = refusalOf(pending, key, p.stars, p.craft);
    if (why) { say(why, true); return; }
    const path = pathTo(pending, key);
    pending = { start: pending.start, keys: [...pending.keys, ...path] };
    for (const k of path) burst(k);
    refresh();
  }
  function refund(key) {
    if (!held().has(key)) return;
    const n = FIRM_NODES.get(key);
    if (n?.kind === 'start') {
      if (!pending.keys.length && pending.start === key) { pending = { start: null, keys: [] }; say(t('firmament.say.chooseSign', 'Choose a birthsign.')); refresh(); return; }
      pending = { start: null, keys: [] };
      say(t('firmament.say.allRemoved', 'All stars removed. Choose a birthsign.'));
      refresh();
      return;
    }
    const takes = new Set(refundTakes(pending, key));
    pending = { start: pending.start, keys: pending.keys.filter((k) => !takes.has(k)) };
    refresh();
  }
  function burst(key) { if (!still) bursts.push({ key, t0: performance.now() }); }

  // ── the confirm ──
  let confirming = /** @type {'accept'|'respec'|'share'} */ ('accept');
  /** THE BUILD CODE (the lead dev, 2026-10-13: "Build sharing. A short build code you can paste in Discord and load into
   *  the tree"): the stars as they stand in the window, as a line to copy (firmamentLaw.js buildCode); and a line pasted
   *  in, loaded as changes to accept like any other - judged by the law against this character's purses first. */
  function openShare() {
    confirming = 'share';
    const parts = [el('h3', null, t('firmament.share.title', 'Share your build'))];
    const code = buildCode(pending);
    if (code) {
      parts.push(el('p', null, t('firmament.share.yours', 'Your current build, including unaccepted changes. Copy this code to share it:')));
      const out = /** @type {HTMLInputElement} */ (el('input', 'fmt-find fmt-code'));
      out.readOnly = true;
      out.value = code;
      out.setAttribute('aria-label', t('firmament.share.codeAria', 'Your build code'));
      out.onfocus = () => out.select();
      const copy = btn(t('firmament.share.copy', 'Copy'), 'fmt-go', async () => {
        let ok = false;
        try { await globalThis.navigator?.clipboard?.writeText(code); ok = true; } catch { /* the field is selected below */ }
        if (!ok) { out.focus(); out.select(); try { ok = !!globalThis.document?.execCommand?.('copy'); } catch { ok = false; } }
        say(ok ? t('firmament.share.copied', 'Build code copied.') : t('firmament.share.copyFail', 'Select the code and copy it.'), !ok);
      });
      const row = el('div', 'row share');
      row.append(copy);
      parts.push(out, row);
    } else parts.push(el('p', null, t('firmament.share.none', 'Choose a birthsign first to get a build code.')));
    parts.push(el('p', null, t('firmament.share.load', 'Load a build code:')));
    const inp = /** @type {HTMLInputElement} */ (el('input', 'fmt-find fmt-code'));
    inp.placeholder = 'FIRM-...';
    inp.setAttribute('aria-label', t('firmament.share.loadAria', 'Build code to load'));
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); load(); } else if (e.key === 'Escape') confirmBox.classList.remove('on'); };
    const load = () => { if (loadBuild(inp.value)) confirmBox.classList.remove('on'); };
    const back = btn(t('firmament.back', 'Back'), '', () => confirmBox.classList.remove('on'));
    const go = btn(t('firmament.share.loadBtn', 'Load'), '', () => load());
    const row = el('div', 'row');
    row.append(back, go);
    parts.push(inp, row);
    confirmBox.replaceChildren(...parts);
    confirmBox.classList.add('on');
    inp.focus?.({ preventScroll: true });
  }
  const notACode = () => t('firmament.build.notCode', 'Not a valid build code.');
  const noSign = () => t('firmament.build.noSign', 'That build has no valid birthsign.');
  /** Each read when it is said (textManager.js localizedTable: a getter a key - an arrow, so tools/l10nRouted.mjs reads it as the port's own). */
  const BUILD_REFUSALS = /** @type {Readonly<Record<string, string>>} */ (localizedTable({
    'build-code': () => notACode(), 'build-sky': () => t('firmament.build.oldSky', 'That code is from a different version of the Firmament. Ask for a new code.'),
    'build-start': () => noSign(), 'firm-path': () => t('firmament.build.path', 'That build has a star that isn\'t connected to its birthsign.'),
    'firm-key': () => notACode(), 'firm-start': () => noSign(),
  }));
  /** A pasted code loaded as the window's changes, when the law and this character's purses allow it. */
  function loadBuild(text) {
    const r = treeOfCode(text);
    if (r.error) { say(BUILD_REFUSALS[r.error] ?? notACode(), true); return false; }
    const p = purse();
    const fault = treeFault(r.tree, p.stars, p.craft);
    if (fault === 'firm-points') {
      const c = firmCostOf(r.tree.keys);
      const needStars = Math.max(c.combat, c.combat + c.life - p.craft);
      const have = { stars: p.stars, craft: p.craft };
      say(c.life ? t('firmament.build.pointsCraft', 'That build needs {need, plural, one {# Star} other {# Stars}} and up to {life, plural, one {# Craft point} other {# Craft points}}. You have {stars, plural, one {# Star} other {# Stars}} and {craft, plural, one {# Craft point} other {# Craft points}}.', { need: needStars, life: c.life, ...have })
        : t('firmament.build.points', 'That build needs {need, plural, one {# Star} other {# Stars}}. You have {stars, plural, one {# Star} other {# Stars}} and {craft, plural, one {# Craft point} other {# Craft points}}.', { need: needStars, ...have }), true);
      return false;
    }
    if (fault) { say(BUILD_REFUSALS[fault] ?? t('firmament.build.cannot', 'You can\'t learn that build.'), true); return false; }
    pending = cloneTree(r.tree);
    refresh();
    focusSign();
    const c = changes();
    say(!(c.added || c.removed) ? t('firmament.build.same', 'You already have that build.')
      : c.silver ? t('firmament.build.loadedCost', 'Build loaded. Press {accept} to keep it. Removing the stars it leaves out costs {silver} silver.', { silver: c.silver, accept: t('firmament.accept', 'Accept') })
        : t('firmament.build.loaded', 'Build loaded. Press {accept} to keep it.', { accept: t('firmament.accept', 'Accept') }));
    return true;
  }
  /** THE RESPEC, asked first: every star and the birthsign back, for the gold. */
  function openRespec() {
    if (respecBtn.disabled) return;
    confirming = 'respec';
    const row = el('div', 'row');
    const yes = btn(t('firmament.respec.go', 'Respec · {gold, number} gold', GOLD), 'fmt-go', () => respec());
    const no = btn(t('firmament.back', 'Back'), '', () => confirmBox.classList.remove('on'));
    row.append(no, yes);
    confirmBox.replaceChildren(el('h3', null, t('firmament.respec.ask', 'Reset all stars?')),
      el('p', null, t('firmament.respec.what', 'This removes all your stars and your birthsign and gives back their points, so you can choose again.')),
      el('p', null, t('firmament.respec.cost', 'It costs {gold, number} gold, taken from the gold you carry first, then from your bank account.', GOLD)), row);
    confirmBox.classList.add('on');
    yes.focus?.({ preventScroll: true });
  }
  async function respec() {
    confirmBox.classList.remove('on');
    respecBtn.disabled = true;
    respecking = true;
    refresh();
    let r;
    try { r = preview ? { ok: true } : book ? await book.respec() : { ok: false, error: 'offline' }; } finally { respecking = false; }
    if (dead) return;
    if (r?.ok) {
      committed = preview ? { start: null, keys: [] } : cloneTree(book?.current?.() ?? { start: null, keys: [] });
      pending = cloneTree(committed);
      say(t('firmament.respec.done', 'Respec done. Choose a birthsign.'), false, true);
    } else say(refusalText(r?.error, true), true);
    refresh();
  }
  function openConfirm() {
    confirming = 'accept';
    const c = changes();
    if (!c.added && !c.removed && !(c.startChanged && pending.start)) return;
    const lines = [el('h3', null, t('firmament.confirm.ask', 'Accept these changes?'))];
    if (c.startChanged && pending.start) lines.push(el('p', null, t('firmament.confirm.sign', 'Birthsign: {name}.', { name: FIRM_NODES.get(pending.start)?.name })));
    if (c.added) lines.push(el('p', null, t('firmament.confirm.learn', 'Learn {n, plural, one {# star} other {# stars}}.', { n: c.added })));
    if (c.removed) lines.push(el('p', null, c.silver ? t('firmament.confirm.removeCost', 'Remove {n, plural, one {# star} other {# stars}} for {silver} silver.', { n: c.removed, silver: c.silver })
      : t('firmament.confirm.removeFree', 'Remove {n, plural, one {# star} other {# stars}} for free.', { n: c.removed })));
    const row = el('div', 'row');
    const yes = btn(c.silver ? t('firmament.acceptSilver', 'Accept · {silver} silver', { silver: c.silver }) : t('firmament.accept', 'Accept'), 'fmt-go', () => commit());
    const no = btn(t('firmament.back', 'Back'), '', () => confirmBox.classList.remove('on'));
    row.append(no, yes);
    lines.push(row);
    confirmBox.replaceChildren(...lines);
    confirmBox.classList.add('on');
    yes.focus?.({ preventScroll: true });
  }
  /** Each read when it is said (textManager.js localizedTable: a getter a key). */
  const REFUSALS = /** @type {Readonly<Record<string, string>>} */ (localizedTable({
    'firm-points': () => t('firmament.refusal.points', 'Not enough points.'), 'firm-path': () => t('firmament.refusal.path', 'A star isn\'t connected to your birthsign.'),
    'firm-key': () => t('firmament.refusal.key', 'One of those stars is unknown.'), 'firm-start': () => t('firmament.refusal.start', 'Choose a birthsign first.'),
    'firm-closed': () => t('firmament.refusal.closed', 'The Firmament isn\'t available to you right now.'),
    'firm-stale': () => t('firmament.refusal.stale', 'Your stars changed in another session. Check them and try again.'),
    'marks-short': () => t('firmament.refusal.silver', 'Not enough silver to remove those stars.'),
    'marks-closed': () => t('firmament.refusal.silverClosed', 'Silver can\'t be spent on this server right now.'),
    offline: () => t('firmament.refusal.offline', 'The server didn\'t answer. Your change is saved and will be sent again.'),
    'no-session': () => t('firmament.refusal.session', 'Sign in to save your stars.'), 'firm-rate': () => t('firmament.refusal.rate', 'Too many changes this hour. Try again later.'),
    'firm-gold': () => needGold(), 'realm-gold': () => needGold(),
    'firm-respec-empty': () => respecNone(), 'firm-busy': () => t('firmament.refusal.busy', 'A change is still being sent. Try again in a moment.'),
  }));
  /** AUDIT UICALM-FIRM1 L4 L3-L4, L2 L5: EVERY REFUSAL SAYS WHY - the window's own words where it has them, else the
   *  account's (accountClient.js REFUSALS, in the player's language); a change the book keeps (no word on it - the net,
   *  the server, the Worker's rate and maintenance) says so; a respec is never kept, so its lost answer says to look. */
  function refusalText(error, respec) {
    const KEPT = ['offline', 'server', 'rate', 'maintenance'];
    if (KEPT.includes(error)) return respec ? t('firmament.refusal.respecLost', 'The server didn\'t answer the respec. Open the Firmament again in a moment to see if it went through.') : REFUSALS.offline;
    return /** @type {Record<string, string>} */ (REFUSALS)[error] ?? accountRefusalText(error);
  }
  /** Whether the stars act now, in the player's words (firmamentLive.js firmamentStatus). */
  function statusText(status) {
    if (status === 'seat') return t('firmament.status.seat', 'Your stars are off: another tab or device is playing online, so this one is offline.');
    if (status === 'unread') return t('firmament.status.unread', 'Your stars are off until they load from the server.');
    if (status === 'no-sign') return t('firmament.status.noSign', 'Your stars are off until you choose a birthsign and press {accept}.', { accept: t('firmament.accept', 'Accept') });
    if (status === 'mentoring') return t('firmament.status.mentoring', 'Your stars are off while you mentor a lower-level party. They return when you leave the party.');
    if (status === 'duel') return t('firmament.status.duel', 'Your combat stars are off during this duel or Arena fight. Your crafting and trade stars still work.');
    return t('firmament.status.active', 'Your accepted stars are active.');
  }
  /** UI-CALM (2026-10-14, a player: "why dont i get any stars ... with renown lvl 5"): a read the service refused was
   *  silent - the purses stood at their empty defaults ("0 of 0", Renown 1) as if that were the answer. Now it says so. */
  function readFailText(st) {
    if (!st?.error) return null;
    if (st.error === 'firm-closed') return t('firm.readFail.closed', 'The Firmament is turned off on this server for now, so your stars can\'t be loaded.');
    if (st.error === 'no-session') return t('firm.readFail.session', 'Sign in to see your stars.');
    if (st.error === 'offline') return t('firm.readFail.offline', 'The server didn\'t answer, so your stars couldn\'t be loaded. Try again in a moment.');
    if (st.status === 404) return t('firm.readFail.missing', 'This server doesn\'t have the Firmament yet. Your stars are not lost.');
    return t('firm.readFail.other', 'Your stars couldn\'t be loaded (the server answered {why}). The points shown are not your real totals.', { why: st.status ?? st.error });
  }
  async function commit() {
    confirmBox.classList.remove('on');
    const want = cloneTree(pending);
    const added = treeDiff(committed, want).added;
    goBtn.disabled = true;
    let r;
    if (preview) r = preview.commit ? await preview.commit(want) : { ok: true };
    else r = book ? await book.commit(want) : { ok: false, error: 'offline' };
    if (dead) return;
    if (r?.ok) {
      committed = preview ? cloneTree(want) : cloneTree(book?.current?.() ?? want);
      if (!preview) pending = cloneTree(committed);
      for (const k of added) burst(k);
      say(added.length ? t('firmament.say.saved', 'Stars saved.') : t('firmament.say.changed', 'Changes saved.'));
    } else {
      say(refusalText(r?.error, false), true);
      if (!preview && book) { committed = cloneTree(book.current()); }
    }
    refresh();
  }

  function focusSign() {
    const k = pending.start ?? committed.start;
    const n = k ? FIRM_NODES.get(k) : null;
    if (!n) { fit(); dirty = true; return; }
    view.z = Math.max(view.z, 0.75);
    view.x = -n.x * view.z - (side.classList.contains('shut') ? 0 : 160);
    view.y = -n.y * view.z + barFoot() / 2;
    hold();
    dirty = true;
  }

  // ── the search ──
  find.oninput = () => {
    const q = find.value.trim().toLowerCase();
    matches = new Set();
    if (q.length >= 2) {
      for (const n of FIRM_NODES.values()) {
        const words = [n.name, ...Object.entries(n.stats).map(([k, v]) => statWords(k, v)), n.text ?? ''].join(' ').toLowerCase();
        if (words.includes(q)) matches.add(n.key);
      }
    }
    dirty = true;
  };
  find.onkeydown = (e) => { if (e.key === 'Escape') { find.value = ''; matches = new Set(); dirty = true; find.blur(); e.stopPropagation(); } e.stopPropagation(); };

  // ── the pointer ──
  /** The star under a screen point, or null. */
  function pick(sx, sy) {
    const at = toSky(sx, sy);
    let best = null, bestD = Infinity;
    for (const n of FIRM_NODES.values()) {
      const d = Math.hypot(n.x - at.x, n.y - at.y);
      const r = NODE_R[n.kind] + 6 / view.z;
      if (d < r && d < bestD) { best = n.key; bestD = d; }
    }
    return best;
  }
  function setHover(key, sx, sy) {
    if (key !== hover) {
      hover = key;
      preview_ = new Set();
      refundPreview = new Set();
      if (key) {
        if (held().has(key)) { if (FIRM_NODES.get(key)?.kind !== 'start') refundPreview = new Set(refundTakes(pending, key)); }
        else if (pending.start) preview_ = new Set(pathTo(pending, key));
      }
      canvas.classList.toggle('over', !!key);
      dirty = true;
    }
    if (key) showTip(key, sx, sy); else tip.classList.remove('on');
  }
  const pointers = new Map();
  let drag = null;   // { x, y, vx, vy, moved }
  let pinch = null;  // { d, z }
  let longPress = 0;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
      drag = null;
      clearTimeout(longPress);
      return;
    }
    drag = { x: p.x, y: p.y, vx: view.x, vy: view.y, moved: false, button: e.button };
    if (e.pointerType === 'touch') {
      const key = pick(p.x, p.y);
      longPress = /** @type {any} */ (setTimeout(() => { if (drag && !drag.moved && key) { drag.moved = true; click(); refund(key); setHover(null, 0, 0); } }, 550));
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.z * (d / Math.max(1, pinch.d))) / view.z);
      return;
    }
    if (drag) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; clearTimeout(longPress); canvas.classList.add('drag'); }
      if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; hold(); dirty = true; setHover(null, 0, 0); return; }
    }
    setHover(pick(p.x, p.y), p.x, p.y);
  });
  const up = (e) => {
    const p = local(e);
    pointers.delete(e.pointerId);
    clearTimeout(longPress);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    const d = drag;
    drag = null;
    canvas.classList.remove('drag');
    if (!d || d.moved) return;
    const key = pick(p.x, p.y);
    if (!key) return;
    // AUDIT UICALM-FIRM1 L4 H1: a finger's first tap on a star reads it (its card); the second learns it
    if (e.pointerType === 'touch' && d.button !== 2 && hover !== key) { setHover(key, p.x, p.y); return; }
    click();
    if (d.button === 2) refund(key); else allocate(key);
    hover = null;
    setHover(pick(p.x, p.y), p.x, p.y);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = null; clearTimeout(longPress); canvas.classList.remove('drag'); });
  canvas.addEventListener('pointerleave', (e) => { if (!drag && e.pointerType !== 'touch') setHover(null, 0, 0); });   // a finger lifted is no pointer gone: its card stays
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  function zoomAt(sx, sy, factor) {
    const before = toSky(sx, sy);
    view.z = Math.max(zFloor(), Math.min(Z_CEIL, view.z * factor));
    const after = toScreen(before.x, before.y);
    view.x += sx - after.x;
    view.y += sy - after.y;
    hold();
    dirty = true;
  }
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  // ── the keys: a modal overlay owns its input (U50's law) ──
  let armedClose = false;
  // AUDIT GROWTH LANE3-8: the ask is for the stars it named - one taken or given back since, and the next leave asks again
  let armedAt = '';
  const sig = () => `${pending.start}|${pending.keys.join()}`;
  const rearm = () => { if (armedClose && armedAt !== sig()) armedClose = false; };
  const arm = () => { armedClose = true; armedAt = sig(); };
  function onKey(e) {
    if (dead || (embed && !root.isConnected)) return;   // GROWTH3: a stage between two draws of its page hears nothing
    if (embed && root.closest?.('[inert]')) return;   // AUDIT GROWTH LANE2-1: and nothing while a window over the pause window holds it inert (the account window's fields)
    if (e.target === find || e.target?.classList?.contains?.('fmt-code')) return;   // a field takes its own keys
    let used = true;
    switch (e.key) {
      case 'Escape':
        if (embed) { used = false; break; }   // GROWTH3: the window's back stack asks back() - one Escape, one owner
        if (confirmBox.classList.contains('on')) { confirmBox.classList.remove('on'); break; }
        rearm();
        if (unaccepted() && !armedClose) { arm(); say(unacceptedEscape(), true); break; }
        close();
        break;
      case 'Enter': if (e.target?.tagName === 'BUTTON') { used = false; break; } click(); if (confirmBox.classList.contains('on')) { if (confirming === 'respec') respec(); else if (confirming === 'accept') commit(); } else openConfirm(); break;
      case 'f': case 'F': click(); focusSign(); break;
      case '+': case '=': zoomAt(vw() / 2, vh() / 2, 1.25); break;
      case '-': case '_': zoomAt(vw() / 2, vh() / 2, 0.8); break;
      case 'ArrowLeft': view.x += 60; hold(); dirty = true; break;
      case 'ArrowRight': view.x -= 60; hold(); dirty = true; break;
      case 'ArrowUp': view.y += 60; hold(); dirty = true; break;
      case 'ArrowDown': view.y -= 60; hold(); dirty = true; break;
      case 'Tab': used = false; break;
      default: used = false;
    }
    if (used && e.key !== 'Escape') armedClose = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  globalThis.addEventListener?.('keydown', onKey, true);
  /** AUDIT UICALM-FIRM1 L4 M4: the overlays' close (the QuickDial's key, Tab by default) asks first, as Escape does - it
   *  had closed the window and thrown away unaccepted stars. Asked, the window stays up and on the overlays' stack. */
  const overlayClose = () => {
    rearm();
    if (!dead && unaccepted() && !armedClose) {
      arm();
      say(unacceptedClose(), true);
      unregister = registerOverlay(overlayClose);
      return;
    }
    close();
  };
  let unregister = embed ? () => {} : registerOverlay(overlayClose);   // GROWTH3: in the tab the pause window is the overlay
  /** GROWTH3: the pause window's back stack, in the tab - a confirm open is shut, unaccepted stars are asked about once
   *  (as Escape asks); answers whether it took the press. A second press goes on, and the stars are let go. */
  function back() {
    if (dead) return false;
    if (confirmBox.classList.contains('on')) { confirmBox.classList.remove('on'); return true; }
    rearm();
    if (unaccepted() && !armedClose) { arm(); say(unacceptedLeave(), true); return true; }
    return false;
  }

  // ── the drawing ──
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let dpr = 1;
  function resize() {
    const want = Math.min(2, globalThis.devicePixelRatio || 1);   // full resolution in both dresses: the names must read
    dpr = want;
    canvas.width = Math.max(1, Math.round(vw() * dpr));
    canvas.height = Math.max(1, Math.round(vh() * dpr));
    hold();   // a smaller window cannot leave the view further out than the sky
    dirty = true;
    placeSay();   // LANE2-6
  }
  resize();
  const onResize = () => resize();
  globalThis.addEventListener?.('resize', onResize);
  // GROWTH3: in the tab the stage moves under the sky (the rail, a phone turned, full screen and back) - it is watched
  let watch = null;
  if (embed) try { watch = new globalThis.ResizeObserver(() => { if (!dead) resize(); }); watch.observe(root); } catch { watch = null; }

  const sky = (x, y) => [x, y];
  function background(t) {
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (grim) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, P.ground0); g.addColorStop(0.75, G.page); g.addColorStop(1, P.ground1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      const g = ctx.createRadialGradient(w / 2 + view.x * dpr * 0.15, h / 2 + view.y * dpr * 0.15, 10, w / 2, h / 2, Math.max(w, h) * 0.8);
      g.addColorStop(0, P.ground0); g.addColorStop(1, P.ground1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // the dust, with a slow parallax and (Plus) a twinkle
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = view.x * 0.35, py = view.y * 0.35, z = 0.35 + view.z * 0.25;
    for (const d of dust) {
      const x = vw() / 2 + px + d.x * z, y = vh() / 2 + py + d.y * z;
      if (x < -4 || y < -4 || x > vw() + 4 || y > vh() + 4) continue;
      const a = grim ? d.a * 0.45 : d.a * (still ? 1 : 0.65 + 0.35 * Math.sin(t / 900 + d.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = P.star;
      if (grim) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      else { ctx.beginPath(); ctx.arc(x, y, d.r * 0.6, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  const toWorld = () => ctx.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * (vw() / 2 + view.x), dpr * (vh() / 2 + view.y));
  const line = (w) => Math.max(w / view.z, 1.2 / view.z);

  function edgePath(e) {
    const a = FIRM_NODES.get(e.a), b = FIRM_NODES.get(e.b);
    if (!a || !b) return;
    if (e.arc) {
      const a0 = Math.atan2(a.y - e.arc.cy, a.x - e.arc.cx), a1 = Math.atan2(b.y - e.arc.cy, b.x - e.arc.cx);
      const d = wrapAngle(a1 - a0);   // the short way round (ONCRASH1 C2: the one wrap)
      ctx.moveTo(a.x, a.y);
      ctx.arc(e.arc.cx, e.arc.cy, e.arc.r, a0, a0 + d, d < 0);
    } else { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  }

  function edges(t) {
    const H = held();
    const lit = [], litLife = [], dim = [], dimLife = [], path = [], refundLine = [];
    for (const e of FIRM_EDGES) {
      const life = FIRM_NODES.get(e.a)?.ring === 'life' && FIRM_NODES.get(e.b)?.ring === 'life';
      const ha = H.has(e.a), hb = H.has(e.b);
      if (ha && hb) {
        if (refundPreview.has(e.a) || refundPreview.has(e.b)) refundLine.push(e);
        else (life ? litLife : lit).push(e);
      } else if ((ha || preview_.has(e.a)) && (hb || preview_.has(e.b)) && (preview_.has(e.a) || preview_.has(e.b))) path.push(e);
      else (life ? dimLife : dim).push(e);
    }
    const stroke = (list, colour, width, glow = null) => {
      if (!list.length) return;
      ctx.beginPath();
      for (const e of list) edgePath(e);
      ctx.strokeStyle = colour;
      ctx.lineWidth = line(width);
      if (glow && !grim) { ctx.shadowColor = glow; ctx.shadowBlur = 14 * dpr; }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    stroke(dim, P.edge, 2.2);
    stroke(dimLife, P.edgeLife, 2.2);
    stroke(lit, P.edgeLit, 4.2, P.glow);
    stroke(litLife, P.edgeLifeLit, 4.2, P.glowLife);
    if (path.length) {
      stroke(path, P.edgePath, 3.4);
    }
    if (refundLine.length) stroke(refundLine, P.edge, 2.2);   // what a right-click would unlearn goes back to an unlearned line
  }

  function nodes(t) {
    const H = held();
    const p = purse();
    const left = pointsLeft(pending.keys, p.stars, p.craft);
    for (const n of FIRM_NODES.values()) {
      const r = NODE_R[n.kind];
      const isHeld = H.has(n.key), isPath = preview_.has(n.key), isRefund = refundPreview.has(n.key);
      const life = n.ring === 'life';
      const fill = isHeld ? (life ? P.litLife : P.lit) : P.node;
      const rim = isHeld ? (life ? P.litRimLife : P.litRim) : (life ? P.rimLife : P.rim);
      // a start not yet chosen glows (still - nothing in the sky moves), so the first press is plain
      const choosing = !pending.start && n.kind === 'start';
      if ((isHeld || choosing || isPath) && !grim) {
        ctx.shadowColor = life ? P.glowLife : P.glow;
        ctx.shadowBlur = (n.kind === 'small' || n.kind === 'road' ? 10 : 22) * dpr;
      }
      ctx.beginPath();
      if (n.kind === 'keystone') {
        // an eight-pointed star round the keystone
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rr = i % 2 ? r * 0.78 : r * 1.12;
          const x = n.x + rr * Math.cos(a), y = n.y + rr * Math.sin(a);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
      } else ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isPath ? (life ? P.edgeLifeLit : P.edgePath) : fill;
      ctx.globalAlpha = isPath ? 0.55 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.lineWidth = line(n.kind === 'small' || n.kind === 'road' ? 1.6 : 2.6);
      ctx.strokeStyle = isRefund ? P.refuse : rim;
      ctx.stroke();
      if (n.kind === 'notable' || n.kind === 'start') {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
        ctx.lineWidth = line(1.4);
        ctx.strokeStyle = isHeld ? rim : (life ? P.rimLife : P.rim);
        ctx.stroke();
      }
      if (n.kind === 'start') {
        // the sign's own mark: a four-pointed star inside
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.25 : r * 0.7; const x = n.x + rr * Math.cos(a), y = n.y + rr * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath();
        ctx.fillStyle = isHeld ? (grim ? G.cream : '#fff7e0') : rim;
        ctx.fill();
      }
      if (matches.has(n.key)) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 11, 0, Math.PI * 2); ctx.lineWidth = line(2.4); ctx.strokeStyle = P.search; ctx.stroke();
      }
      if (n.key === hover) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2); ctx.lineWidth = line(2); ctx.strokeStyle = P.textLit; ctx.stroke();
      }
    }
    // the words: the six great keystones of the outer ring alone, each set outward into the dark where it covers no star
    // and no other name (labelLayout), on a halo of the ground so a line under it never runs through its letters
    ctx.lineJoin = 'round';
    for (const L of labelLayout()) {
      ctx.font = L.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5 / view.z;
      ctx.strokeStyle = P.halo;
      ctx.strokeText(L.text, L.x, L.y);
      ctx.fillStyle = H.has(L.key) ? P.textLit : (L.kind === 'notable' ? P.textDim : P.text);
      ctx.fillText(L.text, L.x, L.y);
    }
    void left;
  }

  // ── THE NAMES' PLACES: tried round each star (below, above, outward, beside, and further out), the first that covers
  // no star and no name already placed; signs first, then keystones, then notables. A notable with no free place is left
  // unnamed at this zoom (its card names it); a sign or a keystone takes its least-crowded place. Laid out once a zoom.
  let _labels = { z: -1, list: /** @type {any[]} */ ([]) };
  function labelLayout() {
    if (_labels.z === view.z) return _labels.list;
    const z = view.z;
    const sizes = { start: 20, keystone: 17, notable: 15 };
    const want = [...FIRM_NODES.values()].filter((n) => n.kind === 'keystone' && n.ring === 'life');   // the six great keystones on the outer ring alone: every other star names itself when hovered
    const rank = { start: 0, keystone: 1, notable: 2 };
    want.sort((a, b) => rank[a.kind] - rank[b.kind]);
    const placed = [];
    const out = [];
    const pad = 3 / z;
    const hitsStar = (r) => {
      for (const m of FIRM_NODES.values()) {
        const rr = NODE_R[m.kind] + 4 / z;
        const cx = Math.max(r.x0, Math.min(m.x, r.x1)), cy = Math.max(r.y0, Math.min(m.y, r.y1));
        if (Math.hypot(m.x - cx, m.y - cy) < rr) return 1;
      }
      return 0;
    };
    const hitsName = (r) => placed.reduce((n, q) => n + (r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0 ? 1 : 0), 0);
    for (const n of want) {
      const px = sizes[n.kind] / z;
      const face = `${n.kind === 'notable' ? '' : '600 '}${px}px ${font}`;
      ctx.font = face;
      const w = ctx.measureText(n.name).width, h = px * 1.1;
      const gap = NODE_R[n.kind] + 6 / z;
      const len = Math.hypot(n.x, n.y) || 1, ux = n.x / len, uy = n.y / len;
      // OUTWARD FIRST: beyond the outer keystone there is only dark, so its name stands clear of every star and line
      const reach = Math.abs(ux) * (w / 2) + Math.abs(uy) * (h / 2);
      const spots = [
        [ux * (gap + reach), uy * (gap + reach)],
        [0, gap + h / 2], [0, -gap - h / 2], [ux * (gap + w / 2), uy * (gap + h / 2)],
        [gap + w / 2, 0], [-gap - w / 2, 0],
        [0, gap * 2 + h / 2], [0, -gap * 2 - h / 2], [ux * (gap * 2 + w / 2), uy * (gap * 2 + h / 2)],
      ];
      let best = null, bestCost = Infinity;
      for (const [dx, dy] of spots) {
        const x = n.x + dx, y = n.y + dy;
        const r = { x0: x - w / 2 - pad, x1: x + w / 2 + pad, y0: y - h / 2 - pad, y1: y + h / 2 + pad };
        const cost = hitsStar(r) * 10 + hitsName(r) * 10;
        if (cost < bestCost) { best = { x, y, r }; bestCost = cost; }
        if (cost === 0) break;
      }
      if (!best || (bestCost > 0 && n.kind !== 'keystone')) continue;   // a crowded sign or notable stays unnamed until the view comes closer
      placed.push(best.r);
      out.push({ key: n.key, kind: n.kind, text: n.name, font: face, x: best.x, y: best.y });
    }
    _labels = { z, list: out };
    return out;
  }


  function sparks(t) {
    if (!bursts.length) return;
    const life = 900;
    bursts = bursts.filter((b) => t - b.t0 < life);
    for (const b of bursts) {
      const n = FIRM_NODES.get(b.key);
      if (!n) continue;
      const u = (t - b.t0) / life;
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_R[n.kind] + u * 60, 0, Math.PI * 2);
      ctx.strokeStyle = n.ring === 'life' ? P.edgeLifeLit : P.edgeLit;
      ctx.globalAlpha = 1 - u;
      ctx.lineWidth = line(3 * (1 - u) + 0.5);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + n.x;
        const rr = NODE_R[n.kind] + u * 90;
        ctx.fillStyle = n.ring === 'life' ? P.litLife : P.lit;
        ctx.fillRect(n.x + rr * Math.cos(a) - 2 / view.z, n.y + rr * Math.sin(a) - 2 / view.z, 4 / view.z, 4 / view.z);
      }
      ctx.globalAlpha = 1;
    }
    dirty = true;
  }

  let raf = 0, lastPaint = 0;
  function frame(t) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    // the sky moves at 30 frames a second while anything moves in it, and only when asked otherwise
    const moving = !still && bursts.length > 0;
    if (!dirty && !(moving && t - lastPaint > 33)) return;
    lastPaint = t;
    dirty = false;
    background(t);
    toWorld();
    edges(t);
    nodes(t);
    sparks(t);
  }
  raf = requestAnimationFrame(frame);

  // the book's word moves the purses and the tree (a read answered, a change confirmed elsewhere)
  const offBook = !preview && book?.onChange ? book.onChange(() => {
    if (dead) return;
    const was = committed;
    committed = cloneTree(book.current());
    // a pending sky over a tree that moved under it starts again from the new one
    if (treeDiff(was, committed).added.length || treeDiff(was, committed).removed.length) pending = cloneTree(committed);
    refresh();
    const fail = readFailText(book.state);
    if (fail) say(fail, true, true);
  }) : null;
  // FIRM-STATUS: the side panel's status line moves when the page goes offline or online, or mentoring starts or ends
  const offSky = preview ? null : onFirmamentChange(() => {
    if (!dead) refresh();
  });
  if (!preview && book) book.read?.().catch?.(() => {});

  refresh();
  if (pending.start) focusSign(); else { fit(); hold(); dirty = true; }   // mounted: the bar's foot is known now
  // AUDIT GROWTH LANE5-1: no line of its own for a window with no service - the tab never mounts it so (growthTab.js
  // firmamentPage says the Firmament is online only), and Accept stands disabled
  if (online && !pending.start) say(t('firmament.say.start', 'Choose a birthsign: one of the seven large stars.'), false, true);
  if (!embed) goBtn.focus?.({ preventScroll: true });   // GROWTH3: in the tab the window's own focus stands

  function close() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(sayTimer);
    globalThis.removeEventListener?.('keydown', onKey, true);
    globalThis.removeEventListener?.('resize', onResize);
    watch?.disconnect?.();
    unregister();
    offBook?.();
    offSky?.();
    root.remove();
    try { onExit(); } catch { /* the host's */ }
  }

  return {
    close,
    destroy: close,
    /** GROWTH3: the tab's Escape (above), and the stage's word that it moved. */
    back,
    resize: (refit = false) => { if (dead) return; if (refit && embed && vw() < 980) side.classList.add('shut'); resize(); if (refit) { fit(); hold(); } },   // refit: its first true size (the stage laid out) - a narrow stage starts with the summary shut, as a narrow screen does
    /** Test and probe seam: what the window holds now. */
    model: () => ({ committed: cloneTree(committed), pending: cloneTree(pending), changes: changes(), view: { ...view }, hover, matches: [...matches] }),
    /** Probe seams: press a star, take one back, as a pointer would. */
    allocate, refund,
    /** Probe seam: centre the view on a point of the sky at a zoom. */
    look: (x, y, z = view.z) => { view.z = z; view.x = -x * z; view.y = -y * z; hold(); dirty = true; },
    hoverAt: (key) => { const n = FIRM_NODES.get(key); if (!n) return; const s = toScreen(n.x, n.y); setHover(key, s.x, s.y); },
  };
}
