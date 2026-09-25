// PLUS1 (2026-09-25): THE ENHANCED PLUS SHEET - everything the refresh dresses the enhanced skin in, as ONE sheet
// injected after the enhanced one and only under Enhanced Plus (systems/uiSkin.js isEnhancedPlus). Plain Enhanced
// never loads a line of it, so it stays exactly as it was; Plus is the enhanced sheet with this laid over it, which is
// why every rule here is written to win by ORDER over the enhanced rule it replaces.
//
// The pieces keep their homes - the kit (ui/enhancedFrame.js), the dialog (enhancedDialogStyle.js), the ported
// windows (enhancedPortStyle.js), the Ascend (levelUpStyle.js), the motion (windowMotion.js) - and only the vitals'
// dress, which the refresh wrote INTO the enhanced sheet, moved here whole. The kit goes LAST, as it always did.
import { FRAME_CSS, LAYOUT_CSS, PLUS_THEMES, DEFAULT_PLUS_THEME, FRAME_TONES } from './enhancedFrame.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { PIXEL_STACK } from './pixelifyFive.js';   // PLUS7
import { DIALOG_CSS } from './enhancedDialogStyle.js';
import { PORT_CSS } from './enhancedPortStyle.js';
import { LV2_CSS } from './levelUpStyle.js';
import { MOTION_CSS } from './windowMotion.js';
import { CURSOR_CSS } from './plusCursor.js';   // PLUS7: the gauntlet pointer

export const PLUS_STYLE_ID = 'enhanced-plus-style';

/** PLUS2: the colour in effect - the stored one if it is a theme, else Slate. */
export const plusTheme = () => (Object.hasOwn(PLUS_THEMES, getPref('plusTheme')) ? getPref('plusTheme') : DEFAULT_PLUS_THEME);
/** Wear the stored colour on the page (the theme rules key on the root's data-plus-theme). */
export function applyPlusTheme(doc = globalThis.document) {
  const root = doc?.documentElement;
  if (root?.dataset) root.dataset.plusTheme = plusTheme();
}
/** Choose a colour: stored, and worn at once - no reload, the rules are already on the page. */
export function setPlusTheme(id, doc = globalThis.document) {
  if (!Object.hasOwn(PLUS_THEMES, id)) return false;
  setPref('plusTheme', id);
  applyPlusTheme(doc);
  return true;
}

/** VB2 + FRAME1: the vitals in stone and brass, the lost chunk behind the fill, the low-health frame. */
export const VITALS_CSS = `
/* ── VB2: THE VITALS, DRESSED (Enhanced Plus) ── */
.hud-bars { display: flex; align-items: center; gap: 16px; }
/* VB2: THE VITALS, DRESSED. Still the pixel language - every edge a
   whole pixel, every shade a hard stop, nothing blurred - but built
   the way the classic's carved chrome is: a stone bevel lit from the
   top left, a brass clasp at each end, the fill banded like a painted
   sprite rather than flat, and a pale
   chunk that stands where the bar WAS after a hit before it drains.
   The outer box is the same 24px it was, so the quickslot diamond's
   "22 + 32 * scale" line still clears it at every scale. Each vital
   sets five tones and the rules below read only those. */
.hud-vital { position: relative; display: flex; align-items: center;
  --v-hi: #f2a597; --v-lite: #d8685a; --v-body: #b53a2e; --v-lo: #8a2820; --v-deep: #5c1812;
  --v-ground: #1e0d0b; }
.hud-magicka { --v-hi: #b7c8ff; --v-lite: #6f8fe6; --v-body: #3f5fc4; --v-lo: #2c4394; --v-deep: #1b2a62;
  --v-ground: #0c1122; }
.hud-fatigue { --v-hi: #b9f0c4; --v-lite: #5fc27c; --v-body: #2f9152; --v-lo: #216b3b; --v-deep: #134526;
  --v-ground: #0a1a10; }
.hud-vital .hud-track { width: min(190px, 23vw); height: 20px;
  display: flex; align-items: center; justify-content: space-between;
  border: 2px solid; border-color: #9a9079 #3a352a #25221b #6e6755;
  background:
    linear-gradient(180deg, rgba(0,0,0,0.6) 0 2px, transparent 2px),
    var(--v-ground);
  box-shadow: 0 0 0 1px #050608, 3px 3px 0 1px rgba(0,0,0,0.45); isolation: isolate; }
.hud-vital .hud-fill { position: absolute; inset: 0; width: 100%;
  background:
    linear-gradient(180deg, var(--v-hi) 0 2px, var(--v-lite) 2px 6px, var(--v-body) 6px 13px,
      var(--v-lo) 13px 17px, var(--v-deep) 17px 100%); }
/* the leading edge: a 2px lit column where the fill stops, which is
   what makes the level read at a glance. min() so an empty fill keeps
   no stray sliver. */
.hud-vital .hud-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0;
  width: min(2px, 100%); background: var(--v-hi); opacity: 0.85; }
.hud-vital .hud-ghost { position: absolute; inset: 0; width: 0; display: block; z-index: -1;
  background: linear-gradient(180deg, #fff6e4 0 2px, var(--v-hi) 2px 17px, var(--v-lite) 17px 100%);
  opacity: 0.55; }
/* the brass clasps, one at each end, the full height of the frame so
   they add nothing to the row's box */
.hud-vital::before, .hud-vital::after { content: ''; position: absolute; top: 0; bottom: 0; z-index: 2;
  width: 6px; box-shadow: 0 0 0 1px #050608;
  background:
    linear-gradient(180deg, transparent 0 10px, #3d2a12 10px 14px, transparent 14px),
    linear-gradient(180deg, #f3cf86 0 2px, transparent 2px),
    linear-gradient(90deg, #e2b064 0 2px, #c08a3e 2px 4px, #7a5424 4px 6px); }
.hud-vital::before { left: -4px; }
.hud-vital::after { right: -4px; }
.hud-vlabel { position: relative; z-index: 1; padding-left: 10px;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #efe8d6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7); }
.hud-num { position: relative; z-index: 1; padding-right: 10px;
  font-size: 12px; font-variant-numeric: tabular-nums; color: #fffaf0;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7); }
/* FRAME1: THE FOE'S BAR loses health the way yours does. The same five
   tones as the health bar, so a foe's red and yours are one red. */
.hud-foe { --v-hi: #f2a597; --v-lite: #d8685a; --v-body: #b53a2e; --v-lo: #8a2820; --v-deep: #5c1812; }
.hud-foetrack { isolation: isolate; }
.hud-foetrack .hud-ghost { position: absolute; inset: 0; width: 0; display: block; z-index: -1;
  background: linear-gradient(180deg, #fff6e4 0 1px, var(--v-hi) 1px); opacity: 0.6; }
/* FRAME1: THE CHUNK. When a frame takes a real bite out of a bar, the
   bitten span breaks off as two pieces that drop and fade - in 8 hard
   steps, never a smooth tween, and without rotation (a rotated pixel is
   a blurred one). Two nodes per bar and two identical animations per
   node, so back-to-back hits each get a piece of their own. */
.hud-chunk { position: absolute; top: 0; bottom: 0; display: none; z-index: 0; pointer-events: none; }   /* under the words (z 1), over the fill */
.hud-chunk.fa, .hud-chunk.fb { display: block; }
.hud-chunk::before, .hud-chunk::after { content: ''; position: absolute; top: 0; bottom: 0; opacity: 0;
  background: linear-gradient(180deg, #fff6e4 0 2px, var(--v-lite) 2px calc(100% - 3px), var(--v-lo) calc(100% - 3px));
  box-shadow: 0 0 0 1px #050608; }
.hud-chunk::before { left: 0; width: 55%; }
.hud-chunk::after { left: 55%; right: 0; }
.hud-chunk.fa::before { animation: hud-chunk-l 560ms steps(8, end) forwards; }
.hud-chunk.fa::after { animation: hud-chunk-r 640ms steps(8, end) forwards; }
.hud-chunk.fb::before { animation: hud-chunk-l2 560ms steps(8, end) forwards; }
.hud-chunk.fb::after { animation: hud-chunk-r2 640ms steps(8, end) forwards; }
@keyframes hud-chunk-l { 0% { opacity: 1; transform: translate(0, 0); } 25% { opacity: 1; transform: translate(-1px, 3px); }
  100% { opacity: 0; transform: translate(-4px, 22px); } }
@keyframes hud-chunk-l2 { 0% { opacity: 1; transform: translate(0, 0); } 25% { opacity: 1; transform: translate(-1px, 3px); }
  100% { opacity: 0; transform: translate(-4px, 22px); } }
@keyframes hud-chunk-r { 0% { opacity: 1; transform: translate(0, 0); } 35% { opacity: 1; transform: translate(2px, 5px); }
  100% { opacity: 0; transform: translate(5px, 28px); } }
@keyframes hud-chunk-r2 { 0% { opacity: 1; transform: translate(0, 0); } 35% { opacity: 1; transform: translate(2px, 5px); }
  100% { opacity: 0; transform: translate(5px, 28px); } }
@media (prefers-reduced-motion: reduce) { .hud-chunk { display: none !important; } }
/* LOW HEALTH: the frame snaps to blood and back - a warning, stepped
   like every other state here, never faded. */
.hud-vital.low .hud-track { animation: hud-vlow 0.9s steps(1, end) infinite; }
@keyframes hud-vlow {
  0% { border-color: #e0584a #7a1d16 #5a130f #b83a2e; }
  50% { border-color: #9a9079 #3a352a #25221b #6e6755; }
}
@media (prefers-reduced-motion: reduce) {
  .hud-vital.low .hud-track { animation: none; border-color: #e0584a #7a1d16 #5a130f #b83a2e; }
}
`;

/** PLUS1: the Plus-only fixes that are not the kit's paint. */
export const PLUS_FIX_CSS = `
/* DROPS-AUDIT F4: the drop's PLUS4/PLUS5 edits to the held map's choices and the counter's columns landed in the
   PLAIN sheet and changed plain Enhanced; they are Plus's, here. The choice itself reads in --bone with the labels'
   shadow, the chosen one brighter on a brass tint; the shelf and basket columns carry a box and a heading rule; the
   detail strip keeps the kit's square corner. */
.hmpick { color: var(--bone); text-shadow: 1px 1px 0 rgba(0,0,0,0.85); }
.hmpick.on { color: #f3cf86; text-shadow: 1px 1px 0 rgba(0,0,0,0.85); border-color: var(--brass); background: rgba(192,138,62,0.16); }
.trade-shell .packcol { padding: 6px 10px 18px; border: 1px solid rgba(125,116,96,0.4); }
.trade-shell .remotehead { border-bottom: 2px solid rgba(125,116,96,0.3); padding-bottom: 10px; }
.trade-shell .trade-detail { border-radius: 0; }
/* the pack's empty pages dim under their own class - the sheet's .empty is a dashed 26px component (ui/enhancedInventory.js) */
.packtab.tabempty { opacity: 0.45; }
/* PLUS1c: a page's COUNT reads as plainly as its name - the name's colour and size (the chosen page's yellow
   included), and no offset shadow: at 11px in the dim tone the tab's 2px shadow read as a second, doubled number. */
.pack-shell .packtab .count { color: inherit; font-size: 12px; text-shadow: none; }
/* PLUS1e: THE FEATURES DESCRIPTION FOLLOWS THE SCROLL IN THE PAUSE WINDOW TOO. There the pane sits in .px-qdetail,
   which is overflow:auto but never overflows - the window's body is what scrolls - and a sticky rail sticks to its
   NEAREST scroll box, so the rail stuck to one that never moved and scrolled away with the tiles. Opening that box
   (for the Features pane only) makes the body the rail's scroller, as the title screen's pane already is. */
.px-qdetail.px-sys:has(.ft-panes) { overflow: visible; }
.px-qdetail.px-sys .ft-rail { max-height: min(calc(100dvh - 300px), 520px); overflow-y: auto; }   /* a long description scrolls inside itself, never past the window's foot */
/* PLUS1d: THE CHAT'S FORM IN TWO ROWS - the field alone across the whole conversation column (it ends where the
   roster begins, never under it), and its buttons on a row beneath: the emoji at the left, Send, Hide and close at
   the right. The chat's own sheet is injected after this one, so every rule carries a leading body. */
body .dfchat-form { flex-wrap: wrap; row-gap: 6px; align-items: center; }
body .dfchat-form .dfchat-input { flex: 1 1 100%; min-height: 34px; }
body .dfchat-form .dfchat-emoji { margin-right: auto; }
body .dfchat-form .dfchat-send, body .dfchat-form .dfchat-hide, body .dfchat-form .dfchat-close {
  display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 4px 12px; font-size: 13px; }
body .dfchat-form .dfchat-send { min-width: 72px; }
body .dfchat-form .dfchat-close { min-width: 32px; padding: 4px 8px; }
/* PLUS2: the colour swatches on the UI Overhaul card */
.look-colours { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0 12px; }
.look-colours-label { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--dim); margin-right: 4px; }
.look-colour { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 3px 9px 3px 5px;
  font: inherit; font-size: 12px; color: #d8cfae; cursor: pointer;
  background: rgba(12,14,18,0.6); border: 2px solid rgba(125,116,96,0.45); }
.look-colour[aria-pressed="true"] { border-color: #c08a3e; color: rgb(243,239,44); }
.look-colour:hover, .look-colour:focus-visible { border-color: #c08a3e; outline: none; }
.look-colour-chip { display: inline-block; width: 16px; height: 16px; box-shadow: 0 0 0 1px #050608, inset 0 0 0 1px rgba(255,255,255,0.15); }
/* PLUS1b: the effects and the needs in ONE row under the vitals (ui/enhancedHud.js .hud-status); an empty half
   takes no room, and the row wraps only when it runs out of width. */
.hud-status { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px;
  max-width: min(720px, 80vw); }
.hud-status:not(:has(> :not(:empty))) { display: none; }
.hud-status > .hud-effects, .hud-status > .hud-needs { display: contents; }
/* RENOWN4b: the Renown row under Plus's vitals is as wide as THEIR row - three min(190px, 23vw) tracks and Plus's two
   16px gaps, at every width (Plus keeps its tracks and gap on a phone too) - the end caps' 4px aside. */
.hud-renown { width: calc(3 * min(190px, 23vw) + 32px); }
/* PLUS6: THE TRAVEL CARD'S OPTIONS, THEIR TWO FACES SWAPPED (Speed / Passage / Rest - ui/heldMap.js .hmpick).
   The CHOSEN option wore dark engraved words meant for a pale fill - but a textured theme (Stone) lays its own
   stone over every tile, the pale fill went and the pick read as dark on grey. So the two faces swap: the chosen
   option takes the bright, shadowed words (and keeps its brass frame), and the option NOT chosen takes the quiet
   face - struck into the stone on a textured theme, a dimmed bone on the dark ones (where dark words would vanish). */
.hmpick { color: #9a9079; text-shadow: 1px 1px 0 rgba(0,0,0,0.85); }
.hmpick:hover, .hmpick:focus-visible { color: #d8cfae; }
.hmpick.on { color: #fffaf0; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.55); border-color: ${FRAME_TONES.brassHi} ${FRAME_TONES.brassLo} #5c3f1a ${FRAME_TONES.brass}; }
:root[data-plus-theme="stone"] .hmpick:not(.on) { color: #1f1c17; text-shadow: 1px 1px 0 rgba(255,255,255,0.34); }
:root[data-plus-theme="stone"] .hmpick:not(.on):hover { color: #1a1814; }
/* PLUS6: THE FOOD & DRINK MENU (ui/enhancedTavern.js foodMenu) - ONE window, not a column inside it. The menu
   column drew the pack's own column ground inside the tavern window and every dish was a raised tile in that - a
   box of boxes. Now the column is the window's own ground, the dishes are the lines of a bill of fare (an engraved
   rule under each, a lit band and a brass mark under the pointer), the price stands at the right in brass, a
   section's name sits centred between two engraved rules, and Back stands centred under the list. */
.tavern-shell .tavern-menu { background: none; border: 0; box-shadow: none; padding: 0; display: flex; flex-direction: column; }
.tavern-shell .tavern-menu-list { gap: 0; margin: 0; padding: 0 2px; }
.tavern-shell .tavern-row { min-height: 44px; padding: 10px 14px; margin: 0; border: 0; background: none;
  border-bottom: 2px solid rgba(5,6,8,0.5); box-shadow: 0 1px 0 rgba(163,152,128,0.16); cursor: pointer; }
.tavern-shell .tavern-row .itemname { font-size: 15px; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.tavern-shell .tavern-row .tavern-price { font-size: 14px; color: ${FRAME_TONES.brassHi}; text-shadow: 1px 1px 0 #050608; }
.tavern-shell .tavern-row:hover, .tavern-shell .tavern-row:focus-visible { outline: none;
  background: linear-gradient(90deg, rgba(243,207,134,0.13), rgba(243,207,134,0.03) 70%, transparent);
  box-shadow: 0 1px 0 rgba(163,152,128,0.16), inset 3px 0 0 ${FRAME_TONES.brass}; }
.tavern-shell .tavern-row:hover .itemname, .tavern-shell .tavern-row:focus-visible .itemname { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.tavern-shell .tavern-row:active { background: rgba(0,0,0,0.18); }
.tavern-shell .tavern-menu-header { display: flex; align-items: center; gap: 12px; margin: 16px 0 6px; font-size: 12px;
  letter-spacing: 0.22em; text-indent: 0.22em; color: ${FRAME_TONES.brassHi}; text-shadow: 1px 1px 0 #050608; }
.tavern-shell .tavern-menu-header::before, .tavern-shell .tavern-menu-header::after { content: ''; flex: 1 1 auto; height: 2px;
  background: rgba(5,6,8,0.5); box-shadow: 0 1px 0 rgba(163,152,128,0.2); }
.tavern-shell .tavern-menu-header:first-child { margin-top: 2px; }
.tavern-shell .tavern-menu > .act { align-self: center; min-width: 140px; margin-top: 16px; }
.tavern-shell .tavern-menu-list { -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 22px), transparent); mask-image: linear-gradient(180deg, #000 calc(100% - 22px), transparent); padding-bottom: 18px; }
/* the tavern's (and the merchant popup's) buttons read like every other stone button: bright, spaced capitals */
.tavern-shell .act { text-align: center; justify-content: center; color: #e6dec6; text-transform: uppercase; letter-spacing: 0.14em; text-indent: 0.14em; font-size: 14px;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.tavern-shell .act:hover, .tavern-shell .act:focus-visible, .tavern-shell .act.primary { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }

/* PLUS6: THE SHOP (ui/enhancedTrade.js). Its category tabs were words with an underline in a loose 2x2; they are
   the kit's stone buttons now (enhancedFrame.js button role), two by two, the chosen page brass-framed with gold
   words. The two columns are WELLS sunk into the window rather than raised boxes inside it, the shelf's rows are the
   lines of a list (the listRow role) with the icon in a small sunk socket, and the column's heading is the pixel
   face, not the display serif it fell back to. */
.trade-shell .packtabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; margin: 4px 0 12px; }
.trade-shell .packtab { min-height: 38px; padding: 6px 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
  color: #e6dec6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); border-bottom-width: 2px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
.trade-shell .packtab.on, .trade-shell .packtab:hover, .trade-shell .packtab:focus-visible { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); outline: none; }
/* theme-neutral: the columns and their heading show the THEME'S own window ground through a light shade - no fill of their own */
.trade-shell .packlists, .trade-shell .px-body { background: none; }
.trade-shell .packlists { background: none; }
.trade-shell .packcol { background: rgba(0,0,0,0.2); border-width: 2px; }
.trade-shell .remotehead { background: none; }
.trade-shell .remotehead { background-color: transparent; background-image: none; }
.trade-shell .remotewho h3 { font-family: inherit; font-weight: 400; font-size: 16px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.trade-shell .remotewho .meta { color: #a89f88; }
.trade-shell .itemrow { background: none; border-top: 0; border-left: 0; border-right: 0; border-bottom-width: 2px; min-height: 46px; padding: 8px 10px; }
.trade-shell .itemrow:hover { background: linear-gradient(90deg, rgba(243,207,134,0.1), transparent 70%); }
.trade-shell .itemrow .itemname { color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.trade-shell .itemrow:hover .itemname, .trade-shell .itemrow.on .itemname, .trade-shell .itemrow.picked .itemname { color: rgb(243,239,44); }
.trade-shell .itemrow .itemwt { color: #c9bfa4; }
.trade-shell .itemrow .tile { width: 34px; height: 34px; border: 2px solid; border-color: #25221b #7a7260 #9a9079 #3a352a;
  background: rgba(0,0,0,0.28); box-shadow: 0 0 0 1px #050608; }

/* PLUS6: THE REST WINDOW WHILE RESTING (ui/enhancedRest.js restingCard) - a title, a readout, a meter and a clear
   space before Stop. The vitals line sat on the button; now the rest reads top to bottom as a card: the mode as the
   window's heading, the hours in a large brass readout, a sunk meter with a banded brass fill, the vitals as three
   small stats, and Stop on its own band under an engraved rule. Tints only - every theme keeps its own stone. */
.rest-shell .px-win { width: min(460px, 92vw); max-height: min(480px, 84dvh); }
.rest-shell .card h2 { margin: 0 0 16px; text-align: center; font-size: 20px; letter-spacing: 0.18em; text-indent: 0.18em;
  text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.rest-shell .meter { margin: 0 0 6px; }
.rest-shell .meter-k { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; letter-spacing: 0.14em;
  text-transform: uppercase; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.rest-shell .meter-v { text-transform: none; font-size: 26px; letter-spacing: 0.04em; color: ${FRAME_TONES.brassHi}; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.rest-shell .meter-track { height: 14px; margin-top: 8px; background: rgba(0,0,0,0.4); border: 2px solid;
  border-color: ${FRAME_TONES.stoneDark} ${FRAME_TONES.stoneMid} ${FRAME_TONES.stoneLit} ${FRAME_TONES.stoneDim};
  box-shadow: 0 0 0 1px #050608, inset 0 2px 0 rgba(0,0,0,0.5); }
.rest-shell .meter-fill.brass { background: linear-gradient(180deg, ${FRAME_TONES.brassHi} 0 2px, #d49a48 2px 6px, ${FRAME_TONES.brass} 6px 8px, ${FRAME_TONES.brassLo} 8px);
  box-shadow: inset -2px 0 0 rgba(255,244,210,0.7); }
.rest-shell .vitals-line { margin: 14px 0 0; text-align: center; font-size: 13px; letter-spacing: 0.04em; color: #d8cfae;
  text-shadow: 1px 1px 0 #050608; word-spacing: 0.4em; }
.rest-shell .card .acts { margin-top: 22px; padding-top: 16px; border-top: 2px solid rgba(5,6,8,0.5);
  box-shadow: inset 0 1px 0 rgba(163,152,128,0.2); justify-content: center; }
.rest-shell .card > p:not(.vitals-line) { text-align: center; }

/* PLUS6: THE REST WINDOW WHILE RESTING - a title, the hours as a large gold readout, a sunk track with a banded
   brass fill, the three vitals as readouts, and Stop in its own foot under an engraved rule (it sat on the text). */
.rest-shell .card h2 { margin: 0 0 18px; text-align: center; font-size: 20px; letter-spacing: 0.2em; text-indent: 0.2em;
  text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.rest-shell .meter { margin: 0 0 18px; }
.rest-shell .meter-k { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px;
  letter-spacing: 0.14em; text-transform: uppercase; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.rest-shell .meter-v { float: none; font-size: 22px; letter-spacing: 0; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.rest-shell .meter-track { height: 14px; margin-top: 8px; border: 2px solid; border-color: #25221b #7a7260 #9a9079 #3a352a;
  background: rgba(0,0,0,0.45); box-shadow: 0 0 0 1px #050608, inset 0 2px 0 rgba(0,0,0,0.5); }
.rest-shell .meter-fill.brass { background: linear-gradient(180deg, #f3cf86 0 2px, #d9a452 2px 5px, #c08a3e 5px 8px, #7a5424 8px); }
.rest-shell .vitals-line { display: flex; justify-content: space-between; gap: 10px; margin: 0; }
.rest-shell .vitals-line .rv { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px;
  background: rgba(0,0,0,0.22); box-shadow: 0 0 0 1px rgba(5,6,8,0.6), inset 0 2px 0 rgba(0,0,0,0.3); }
.rest-shell .rv-k { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #a89f88; }
.rest-shell .rv-v { font-size: 16px; color: #efe8d6; text-shadow: 1px 1px 0 #050608; font-variant-numeric: tabular-nums; }
.rest-shell .card .acts { margin-top: 20px; padding-top: 16px; border-top: 2px solid rgba(5,6,8,0.5);
  box-shadow: inset 0 1px 0 rgba(163,152,128,0.2); justify-content: center; }
.rest-shell .act { min-width: 130px; text-align: center; justify-content: center; color: #e6dec6; text-transform: uppercase; letter-spacing: 0.14em; }
/* the shop's buttons read like every other stone button */
.trade-shell .act { text-align: center; justify-content: center; color: #e6dec6; text-transform: uppercase; letter-spacing: 0.12em;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.trade-shell .act:hover, .trade-shell .act.primary:not(:disabled) { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }

/* PLUS6: THE TALK WINDOW's buttons read like every other stone button, and its UNCHOSEN tone and mode words
   (Normal, Blunt, Where is) are quieter than the chosen one but still legible on every theme */
.talk-head .act, .talk-say .act { text-align: center; justify-content: center; color: #e6dec6; text-transform: uppercase;
  letter-spacing: 0.12em; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.talk-head .act:hover, .talk-say .act:hover { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.talk-tone button:not([aria-pressed="true"]), .talk-mode:not(.on) { color: #b3aa92; text-shadow: 1px 1px 0 #050608; }
.talk-tone button:not([aria-pressed="true"]):hover, .talk-mode:not(.on):hover { color: #efe8d6; }

/* PLUS7: THE INVENTORY'S HOVER CARD AND RIGHT-CLICK MENU (ui/enhancedInventory.js). They float on <body>, outside
   the pack's own sheet scope, so they carry their own face; the kit's panel role colours them per theme. */
.inv-tip, .inv-menu { position: fixed; z-index: 39; font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none;
  font-variant-ligatures: none; color: #d8cfae; }
.inv-tip { pointer-events: none; width: min(290px, 80vw); }
.inv-tip > .card { margin: 0; padding: 14px 16px 12px; border: 2px solid; }
.inv-tip .bigicon { display: flex; justify-content: center; margin: 0 0 8px; }
.inv-tip .bigicon img { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; }
.inv-tip h3 { margin: 0 0 4px; font: inherit; font-size: 17px; letter-spacing: 0.04em; color: #efe8d6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.inv-tip .meta { margin: 0 0 8px; font-size: 12px; color: #a89f88; }
.inv-tip .rarity { margin: 0 0 8px; padding: 0 0 0 14px; font-size: 12px; color: ${FRAME_TONES.brassHi}; }
.inv-tip dl.stats { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; margin: 0; padding-top: 8px;
  border-top: 2px solid rgba(5,6,8,0.45); box-shadow: inset 0 1px 0 rgba(163,152,128,0.16); }
.inv-tip dt { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #a89f88; align-self: center; }
.inv-tip dd { margin: 0; font-size: 14px; color: #efe8d6; text-align: right; font-variant-numeric: tabular-nums; }
.inv-menu { min-width: 190px; padding: 6px; display: flex; flex-direction: column; border: 2px solid; }
.inv-menu-head { margin: 2px 6px 6px; padding-bottom: 6px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: ${FRAME_TONES.brassHi}; border-bottom: 2px solid rgba(5,6,8,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inv-menu-item { display: block; width: 100%; min-height: 34px; padding: 6px 12px; border: 0; background: none; text-align: left;
  font: inherit; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #e6dec6;
  text-shadow: 1px 1px 0 #050608; cursor: pointer; }
.inv-menu-item:hover, .inv-menu-item:focus-visible { outline: none; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12);
  background: linear-gradient(90deg, rgba(243,207,134,0.14), transparent 80%); box-shadow: inset 3px 0 0 ${FRAME_TONES.brass}; }

/* PLUS5: THE PAUSE WINDOW'S RAIL AND TAB ROW (Quests/Stats/System, and Stats' own Character/
   Attributes/Skills/Advantages/Standing rail) were in FRAME_ROLES already - the kit paints their
   BORDER and the chosen row's brass mark - but neither band carries a fill of its own, so between
   those painted edges it still reads as the window's bare ground with words on it, not a stone
   strip the way the shop and tavern's own header bands (also a header-role selector) do. One flat
   tint, the same weight the kit's own panel ground keeps, gives both bands a surface to sit on. */
.px-win .px-tabs { background-color: rgba(15,17,22,0.55); }
.px-qrail { background-color: rgba(15,17,22,0.4); }
`;


/** PLUS8 (2026-09-25): THE JOURNEY BAR (ui/enhancedTravelControl.js), dressed for Enhanced Plus. It was plain
 *  Enhanced's slim brass-lined strip - the display serif, a hairline border, flat blue-grey buttons - and it stood
 *  at top 14px, which is ON the compass (the HUD's top block starts at 18), so the compass's points showed through
 *  it. Now it is a window of the kit: the carved stone frame with the brass fittings (window role), the theme's own
 *  ground, the pixel face, the three sections parted by engraved rules, the time readout in a sunk socket between
 *  two stone presses, and Map / Camp / Exit as the kit's stone buttons. It stands UNDER the compass and follows the
 *  HUD scale down (the panel copies --hud-scale off the HUD's host), and steps further down while the foe's bar is
 *  up under the compass, so neither is ever covered. The kit paints (enhancedFrame.js FRAME_ROLES: window, button,
 *  well); these rules only place, size and letter. */
export const TRAVEL_CSS = `
/* ── PLUS8: THE JOURNEY BAR ── */
.travelpanel { font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none;
  font-feature-settings: 'liga' 0, 'clig' 0; color: #d8cfae;
  /* the compass's foot: .hud-top at 18px, the strip 26px and its 2px rule, all times the HUD scale */
  --tp-top: calc(18px + 28px * var(--hud-scale, 1) + 20px); }
body:has(.hud-foe.on) .travelpanel { --tp-top: calc(18px + 28px * var(--hud-scale, 1) + 20px + 46px * var(--hud-scale, 1)); }
body:has(.hud-foe.on.blade) .travelpanel { --tp-top: calc(18px + 28px * var(--hud-scale, 1) + 20px + 76px * var(--hud-scale, 1)); }
.travelpanel-bar { top: var(--tp-top); min-width: min(720px, 92vw); max-width: calc(100vw - 32px); box-sizing: border-box;
  border: 2px solid; border-radius: 0; align-items: stretch; }
.travelpanel-dest { gap: 3px; padding: 10px 18px 10px 20px; }
.travelpanel-label { font-size: 11px; letter-spacing: 0.2em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.travelpanel-name { font-family: inherit; font-size: 21px; line-height: 1.15; letter-spacing: 0.04em; color: #efe8d6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.travelpanel.following .travelpanel-name { color: ${FRAME_TONES.brassHi}; }
.travelpanel-sub { font-size: 12px; letter-spacing: 0.06em; color: #c9bfa4; text-shadow: 1px 1px 0 #050608;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
/* the parting rules: a dark cut with the light catching beside it, the kit's engraved line stood on end */
.travelpanel-speed, .travelpanel-acts { border-left: 2px solid rgba(5,6,8,0.55); box-shadow: inset 1px 0 0 rgba(163,152,128,0.18); }
.travelpanel-speed { align-items: center; gap: 6px; padding: 8px 18px; }
.travelpanel-speed > .travelpanel-label { text-indent: 0.2em; }
.travelpanel-stepper { gap: 6px; }
.travelpanel-step { width: 30px; height: 30px; padding: 0; display: grid; place-items: center; border: 2px solid; border-radius: 0;
  font: inherit; font-size: 17px; line-height: 1; color: #e6dec6; text-shadow: 1px 1px 0 #050608; }
.travelpanel-accel { min-width: 64px; height: 30px; box-sizing: border-box; display: grid; place-items: center; padding: 0 8px;
  border: 2px solid; background: rgba(0,0,0,0.38); font-family: inherit; font-size: 17px; letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.travelpanel-acts { gap: 8px; padding: 8px 16px; }
.travelpanel-act { min-width: 78px; min-height: 36px; padding: 6px 14px; border: 2px solid; border-radius: 0;
  font-family: inherit; font-size: 13px; letter-spacing: 0.14em; text-indent: 0.14em; text-align: center; color: #e6dec6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.travelpanel-step:hover, .travelpanel-step:focus-visible, .travelpanel-act:hover, .travelpanel-act:focus-visible {
  outline: none; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
/* the journey's word (a stop, a speed refused): outlined gold words under the bar, the HUD lines' own face */
.travelpanel-msg { top: calc(var(--tp-top) + 104px); max-width: calc(100vw - 48px); text-align: center; font-size: 14px;
  letter-spacing: 0.06em; color: rgb(243,239,44);
  text-shadow: -1px 0 0 #050608, 1px 0 0 #050608, 0 -1px 0 #050608, 0 1px 0 #050608, 2px 2px 0 rgb(93,77,12); }
/* the junction disc: a round socket - an outline, a stone ring lit from the top left, a brass lip, sunk inside */
.travelpanel-junction { top: calc(var(--tp-top) + 112px); border: 0;
  background: color-mix(in srgb, var(--ink) 84%, transparent);
  box-shadow: inset 3px 3px 0 rgba(0,0,0,0.5), 0 0 0 2px ${FRAME_TONES.brass}, 0 0 0 3px ${FRAME_TONES.outline},
    -2px -2px 0 4px ${FRAME_TONES.stoneLit}, 2px 2px 0 4px ${FRAME_TONES.stoneDark}, 0 0 0 6px ${FRAME_TONES.outline},
    4px 4px 0 6px rgba(0,0,0,0.42); }
/* while the disc stands alone (a junction stop) it takes the bar's place under the compass */
.travelpanel.junction-only .travelpanel-junction { top: var(--tp-top); }
/* a textured stone (Stone): the small labels are struck into the rock, the words keep their light */
:root[data-plus-theme="stone"] .travelpanel-label { color: #15130f; text-shadow: 1px 1px 0 rgba(255,255,255,0.36); }
:root[data-plus-theme="stone"] .travelpanel-sub { color: #e6dec6; }
:root[data-plus-theme="stone"] .travelpanel-speed, :root[data-plus-theme="stone"] .travelpanel-acts {
  border-left-color: rgba(5,6,8,0.5); box-shadow: inset 1px 0 0 rgba(255,255,255,0.16); }
@media (max-width: 760px) {
  .travelpanel-bar { min-width: 0; width: calc(100vw - 24px); }
  .travelpanel-name { font-size: 17px; }
  .travelpanel-dest { padding: 8px 12px; }
  .travelpanel-speed { padding: 8px 10px; }
  .travelpanel-acts { padding: 8px 10px; gap: 6px; }
  .travelpanel-act { min-width: 0; padding: 6px 9px; font-size: 12px; letter-spacing: 0.1em; text-indent: 0.1em; }
  .travelpanel-junction { width: 108px; height: 108px; right: 14px; }
}
/* a phone held upright: the destination takes the whole first row, the time and the three presses the second */
@media (max-width: 560px) {
  .travelpanel-bar { flex-wrap: wrap; }
  .travelpanel-dest { flex: 1 1 100%; border-bottom: 2px solid rgba(5,6,8,0.55); box-shadow: 0 1px 0 rgba(163,152,128,0.18); }
  .travelpanel-speed { flex-direction: row; padding: 8px 8px 8px 12px; border-left: 0; box-shadow: none; }
  .travelpanel-speed > .travelpanel-label { display: none; }   /* the x40 in its socket says what it is; the row needs the room */
  .travelpanel-accel { min-width: 52px; }
  .travelpanel-acts { flex: 1 1 auto; padding: 8px 12px 8px 8px; }
  .travelpanel-act { flex: 1 1 0; min-width: 0; padding: 6px 4px; }
  .travelpanel-msg { top: calc(var(--tp-top) + 152px); }
  .travelpanel-junction { top: calc(var(--tp-top) + 164px); }
}
@media (prefers-reduced-motion: reduce) { .travelpanel-msg { transition: none; } }
`;

export const PLUS_CSS = `${VITALS_CSS}
${PLUS_FIX_CSS}
${TRAVEL_CSS}
${CURSOR_CSS}
${DIALOG_CSS}
${PORT_CSS}
${LV2_CSS}
${MOTION_CSS}
${LAYOUT_CSS}
/* FRAME1: LAST, on purpose - see ui/enhancedFrame.js */
${FRAME_CSS}
`;
