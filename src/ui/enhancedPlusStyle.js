// PLUS1 (2026-09-25): THE ENHANCED PLUS SHEET - everything the refresh dresses the enhanced skin in, as ONE sheet
// injected after the enhanced one (systems/uiSkin.js isEnhancedPlus). Plus is the enhanced sheet with this laid over
// it, which is why every rule here is written to win by ORDER over the enhanced rule it replaces. PLUS-ONLY
// (2026-09-26): plain Enhanced is retired, so every enhanced page wears this sheet - a new enhanced surface is dressed
// HERE (or given a role in ui/enhancedFrame.js), never left in the plain sheet's look.
//
// The pieces keep their homes - the kit (ui/enhancedFrame.js), the dialog (enhancedDialogStyle.js), the ported
// windows (enhancedPortStyle.js), the Ascend (levelUpStyle.js), the motion (windowMotion.js) - and only the vitals'
// dress, which the refresh wrote INTO the enhanced sheet, moved here whole. The kit goes LAST, as it always did.
import { FRAME_CSS, LAYOUT_CSS, PLUS_THEMES, DEFAULT_PLUS_THEME, FRAME_TONES } from './enhancedFrame.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { PIXEL_STACK, PIXEL_FONT_CSS } from './pixelifyFive.js';   // PLUS7; PLUS-DRESS: the whole trio for the sheets that forgot it
import { DIALOG_CSS } from './enhancedDialogStyle.js';
import { PORT_CSS } from './enhancedPortStyle.js';
import { LV2_CSS } from './levelUpStyle.js';
import { MOTION_CSS } from './windowMotion.js';
import { CURSOR_CSS } from './plusCursor.js';   // PLUS7: the gauntlet pointer
import { SIGIL_RUNE_TILE_URL } from './sigilRune.js';   // SIGIL-UI: the rune in a sigil weapon's tile corner (AUDIT MERGE-PLUS D5: a picture, its outline drawn in)

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
/* UI3: A PHONE'S VITALS SAY THEIR NUMBERS ALONE. A 23vw track holds "MAGICKA" or "70%" but not both - on a phone the
   two ran into one word ("MAGICKA70%") - and the three colours already name the bars (the reference's own order). */
@media (max-width: 640px) {
  .hud-vlabel { display: none; }
  .hud-vital .hud-track { justify-content: center; }
  .hud-num { padding-right: 0; }
}
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
/* PADPLUS1: the quickslot tags' pad glyphs are vectors under Plus - drawn bigger and smooth, not pixel-doubled */
.hud-qsglyph { width: 18px; height: 18px; image-rendering: auto; }
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
/* (PLUS1b's one status row under the vitals is gone - UI3: its effects and needs are the status widget's tiles,
   ui/hudStatus.js, on the quickslot block at the left edge.) */
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
.inv-tip { pointer-events: none; width: min(290px, 80vw); max-height: calc(100vh - 16px); overflow: hidden; }
/* AUDIT SET U13: a hover card taller than the screen sheds what a glance can spare (ui/enhancedInventory.js fitTip) -
   first the tiers' words grow small and the sigil's note goes, then the tiers keep their names alone and the Prince's
   line and the sigil's count go; the card a press opens keeps every word. The screen's edge is the last word. */
.inv-tip.tip-compact .set-tier-text { font-size: 11px; line-height: 1.2; }
.inv-tip.tip-compact .sigil-note { display: none; }
.inv-tip.tip-tight .set-tier-text, .inv-tip.tip-tight .set-role, .inv-tip.tip-tight .sigil-progress { display: none; }
.inv-tip > .card { margin: 0; padding: 14px 16px 12px; border: 2px solid; }
.inv-tip .bigicon { display: flex; justify-content: center; margin: 0 0 8px; }
.inv-tip .bigicon img { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; }
.inv-tip h3 { margin: 0 0 4px; font: inherit; font-size: 17px; letter-spacing: 0.04em; color: #efe8d6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.inv-tip .meta { margin: 0 0 8px; font-size: 12px; color: #a89f88; }
.inv-tip .rarity { margin: 0 0 8px; padding: 0; list-style: none; font-size: 12px; color: ${FRAME_TONES.brassHi}; }   /* RARITY-UI: the tier line wears its pips, so the list's bullets went */
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
/* PLUS10: THE INFO BOX - the classic Info popup's own text (TEXT.RSC), in the kit's stone over the pack. */
.inv-info { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.35); font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; }
.inv-info > .card { width: min(380px, 92vw); max-height: 86vh; overflow: auto; margin: 0; padding: 16px 18px 14px;
  border: 2px solid; display: flex; flex-direction: column; gap: 10px; }
.inv-info-box p { margin: 0 0 4px; font-size: 14px; line-height: 1.3; color: #e6dec6; text-shadow: 1px 1px 0 #050608; }
.inv-info-box p.center { text-align: center; }
.inv-info-box:first-child p:first-child { font-size: 16px; color: #efe8d6; }
.inv-info-box.more { padding-top: 10px; border-top: 2px solid rgba(5,6,8,0.45); box-shadow: inset 0 1px 0 rgba(163,152,128,0.16); }
.inv-info-box.more p { color: ${FRAME_TONES.brassHi}; }
.inv-info > .card > .act { align-self: center; min-width: 120px; }
.inv-dismantle .acts { justify-content: center; margin-top: 10px; }   /* SS5: the dismantle's Dismantle and Keep, under the question */


/* PLUS5: THE PAUSE WINDOW'S RAIL AND TAB ROW (Quests/Stats/System, and Stats' own Character/
   Attributes/Skills/Advantages/Standing rail) were in FRAME_ROLES already - the kit paints their
   BORDER and the chosen row's brass mark - but neither band carries a fill of its own, so between
   those painted edges it still reads as the window's bare ground with words on it, not a stone
   strip the way the shop and tavern's own header bands (also a header-role selector) do. One flat
   tint, the same weight the kit's own panel ground keeps, gives both bands a surface to sit on. */
.px-win .px-tabs { background-color: rgba(15,17,22,0.55); }
.px-qrail { background-color: rgba(15,17,22,0.4); }

/* PLUS9: THE SPLIT WORN PANELS (ui/enhancedInventory.js WORN_FAMILIES). Chest, arms and legs are one grid cell
   holding two half panels - armour | clothes, left | right. Each half is a .wornrow, so the kit's tile stone, the
   brass of the picked one, the drag and the hover card all come along; these rules only split the cell and fit it.
   PLUS9b: with the real paper doll standing in the centre a half is only ~75px wide, so side by side the icon and
   the name could not both fit (the name was cut to four letters, and PLUS9 had dropped the icon for it). A FILLED
   half is now a little stack - the item's picture, its name under it on up to two lines - and its slot word goes to
   the hover card (the cell's place says it anyway). An EMPTY half keeps the open diamond and the slot word, so the
   player still sees where a shirt or a pauldron goes. A half wide enough for a row (a container query, not a guess at
   the screen) lays out as the full panels do. */
.pack-shell .equipped .wornpair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px;
  min-width: 0; min-height: 0; container-type: inline-size; }
.pack-shell .equipped .wornpair > .wornrow { min-width: 0; min-height: 0;
  flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 4px 4px; text-align: center; }
.pack-shell .wornpair > .wornrow .tile { width: 28px; height: 28px; font-size: 14px; }
.pack-shell .wornpair > .wornrow .tile img { max-width: 28px; max-height: 28px; }
.pack-shell .wornpair > .wornrow .worntile { font-size: 16px; line-height: 1; }
.pack-shell .wornpair > .wornrow .worntext { width: 100%; align-items: center; gap: 1px; }
.pack-shell .wornpair > .wornrow:not(.wornempty) .wornslot { display: none; }
.pack-shell .wornpair > .wornrow .wornslot { font-size: 9px; letter-spacing: 0.06em; line-height: 1.15;
  white-space: normal; text-align: center; }
.pack-shell .wornpair > .wornrow .wornname { font-size: 10px; line-height: 1.15; text-align: center;
  white-space: normal; overflow-wrap: anywhere; max-width: 100%;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
.pack-shell .wornpair > .wornrow.wornempty .wornname { display: none; }   /* the open diamond and the slot word carry an empty */
/* a pair with room for two rows (each half ~170px): icon beside the slot word and the name, like the full panels */
@container (min-width: 346px) {
  .pack-shell .equipped .wornpair > .wornrow { flex-direction: row; justify-content: flex-start; gap: 10px;
    padding: 4px 10px; text-align: left; }
  .pack-shell .wornpair > .wornrow .tile { width: 34px; height: 34px; }
  .pack-shell .wornpair > .wornrow .tile img { max-width: 30px; max-height: 30px; }
  .pack-shell .wornpair > .wornrow .worntext { align-items: flex-start; gap: 3px; }
  .pack-shell .wornpair > .wornrow:not(.wornempty) .wornslot { display: block; }
  .pack-shell .wornpair > .wornrow .wornslot, .pack-shell .wornpair > .wornrow .wornname { text-align: left; }
  .pack-shell .wornpair > .wornrow .wornslot { font-size: 10px; letter-spacing: 0.12em; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .pack-shell .wornpair > .wornrow .wornname { font-size: 12px; }
}
@media (min-width: 1300px) {
  .pack-shell .equipped .wornpair { gap: 8px; }
}
/* UI1 (bible/10-UI/Slots-Hotbar-Status.md): THE BODY'S PICTURES GROW TOO, where the map has the room - a desktop's
   pack, whose five rows stand 64px and more. A worn panel's picture has a room up to 56px square (a 48px box: the
   grid's own, so the pack's slot and the body's are one picture), a half panel's up to 44 (a 36px box) over its name;
   a short window's row shrinks the room with it, and the picture inside shrinks whole (ui/textureCanvas.js
   fittedImg). The room is no box: the panel is the frame (UI1b). The phone's map keeps its compact rows. */
@media (min-width: 1000px) {
  .pack-shell .charcol .equipped .wornrow .tile { width: auto; height: min(56px, calc(100% - 4px)); aspect-ratio: 1; font-size: 26px; }
  .pack-shell .charcol .equipped .wornpair > .wornrow .tile { height: min(44px, calc(100% - 26px)); font-size: 18px; }
}
/* PLUS11: FIVE ROWS, NOT SIX - the accessories left the grid for the shelf, so every panel is a fifth taller.
   The three rules mirror the enhanced sheet's own three (the map, the map in the pack's column, and that column at
   desktop widths), one class deeper so they win. */
.pack-shell .wornmap.plus5 { grid-template-rows: repeat(5, minmax(44px, 1fr)); }
.pack-shell .charcol .wornmap.plus5 { grid-template-rows: repeat(5, minmax(44px, auto)); }
@media (min-width: 1000px) { .pack-shell .charcol .wornmap.plus5 { grid-template-rows: repeat(5, minmax(48px, 1fr)); } }
/* PLUS11: THE ACCESSORY SHELF - under the doll where Mount / Cart stood: six labelled pairs of square sockets in a
   row, the classic shelf turned on its side. The kit paints the sockets (enhancedFrame.js tile role). */
.pack-shell .wornshelf { display: flex; gap: 10px; margin-top: 10px; min-width: 0; padding: 0 2px; }
.pack-shell .shelfgrp { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pack-shell .shelfpair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; width: 100%; max-width: 116px; }
.pack-shell .wornsock { position: relative; aspect-ratio: 1; min-width: 0; min-height: 0; max-height: 56px; margin: 0;
  display: flex; align-items: center; justify-content: center; padding: 2px; overflow: hidden;
  background: rgba(10,12,17,0.72); border: 2px solid rgba(125,116,96,0.35); color: #a89f88; font: inherit;
  touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.pack-shell button.wornsock { cursor: pointer; }
.pack-shell .wornsock .tile { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;
  border: 0; background: none; font-size: 13px; color: #d8cfae; }
.pack-shell .wornsock .tile img { max-width: 100%; max-height: 100%; }
/* AUDIT UI A1: a phone's accessory socket (23px across six pairs) shrinks its picture whole on purpose (UI1) - smoothly */
@media (max-width: 640px) { .pack-shell .wornsock .tile img.fit { image-rendering: auto; } }
.pack-shell .wornsock .worntile { font-size: 14px; color: rgba(125,116,96,0.55); }
.pack-shell .wornsock.wornempty { background: rgba(0,0,0,0.18); border-color: rgba(125,116,96,0.22); }
.pack-shell .wornsock.dragging { opacity: 0.4; }
body.draglock .pack-shell .wornsock { touch-action: none; }
.pack-shell .wornshelf.dragover { outline: 2px solid var(--brass); outline-offset: 3px; }
.pack-shell .shelflabel { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
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

/** RARITY-UI + SIGIL-UI (2026-09-26, Mac: "Rarity needs to be more noticable in the UI with the icon borders being
 *  color coded"; "sigil weapons need a visible indicator within the info section, something that makes it stand out,
 *  along with progress as you use it"). An item's FRAME wears its tier: the pack's tiles, the worn panels' icons, the
 *  shelf's sockets, the loot list's and the shop's icons, the hotbar's slots, the quickslot diamond's cells - every
 *  one bevelled in the tier's colour (lit top-left, shaded bottom-right, the kit's light) with the colour's glow sunk
 *  inside, brighter under the pointer. NEVER BY COLOUR ALONE (AUDIT INV2 A8/A9's law): a tile carries its tier's
 *  pips in the free corner - one magic, two rare, three legendary, a diamond within a diamond for an Aetheric (SET6),
 *  a star for an artifact - and the card says the word. The five hues are lootRarity.js RARITIES' own, pinned against
 *  that table. A weapon that carries a sigil
 *  wears the rune (ui/sigilCard.js) in the tile's other free corner, in the arcane teal no tier wears, and its card
 *  draws the sigil's own block. Laid AFTER the kit so a tier outranks the kit's stone at the same weight. */
/** LOCK1: the padlock a locked piece wears - a shackle and a body with a keyhole, pixel for pixel, in brass with its
 *  own black outline (a masked glyph's drop shadow is clipped by its mask, so the outline is drawn in). */
export const LOCK_GLYPH_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 12 12' shape-rendering='crispEdges'><path fill='#f3cf86' stroke='#050608' stroke-width='2' paint-order='stroke' fill-rule='evenodd' d='M2 0H8V1H9V4H7V2H3V4H1V1H2ZM0 4H10V10H0ZM4 6V8H6V6Z'/></svg>`;
const LOCK_GLYPH_URL = `url("data:image/svg+xml,${encodeURIComponent(LOCK_GLYPH_SVG)}")`;
/** RARITY-UI: each tier's colours as custom properties - one table, laid globally by the Plus sheet (ITEM_FRAME_CSS) and
 *  scoped to one window by a sheet that must dress nothing else (AUDIT SET U1: the Sigil Broker's on the classic skin). */
const RARITY_VARS = Object.freeze({
  magic: `--rar: #6f9ee8; --rar-hi: #b3cdf6; --rar-lo: #34568f; --rar-rgb: 111,158,232; --rar-pips: '\\25c6';`,
  rare: `--rar: #e4c34f; --rar-hi: #f6e398; --rar-lo: #8f7420; --rar-rgb: 228,195,79; --rar-pips: '\\25c6\\25c6';`,
  legendary: `--rar: #e07a2e; --rar-hi: #f7b684; --rar-lo: #8e4518; --rar-rgb: 224,122,46; --rar-pips: '\\25c6\\25c6\\25c6';`,
  aetheric: `--rar: #bfe8ff; --rar-hi: #f0faff; --rar-lo: #4d7fa3; --rar-rgb: 191,232,255; --rar-pips: '\\25c8';`,
  artifact: `--rar: #b57bee; --rar-hi: #dcbcf8; --rar-lo: #683a9c; --rar-rgb: 181,123,238; --rar-pips: '\\2726';`,
});
/** The tiers' custom properties as rules - under `scope` (a descendant selector with its space) or everywhere. */
export const rarityVarsCss = (scope = '') => Object.entries(RARITY_VARS).map(([k, v]) => `${scope}[data-rarity="${k}"] { ${v} }`).join('\n');
/** SIGIL-UI: the sigil's colours, as custom properties. */
export const SIGIL_VARS_CSS = `:root { --sigil: #72f0d8; --sigil-mid: #2fb8a2; --sigil-lo: #0f5048; --sigil-rgb: 114,240,216; }`;
/** SIGIL-UI: the rune's breath. */
export const SIGIL_KEYFRAMES_CSS = `@keyframes sigil-breathe { from { opacity: 0.72; } to { opacity: 1; } }`;
/** SIGIL-UI: the sigil's own block on a card (ui/sigilCard.js) - every rule its own class, so a sheet may lay it where nothing else of the Plus dress is laid (AUDIT SET U1: the Sigil Broker's window on the classic skin). */
export const SIGIL_BLOCK_CSS = `/* the block on the card */
.sigilbox { position: relative; margin: 8px 0 10px; padding: 8px 10px 7px; text-align: left;
  border: 2px solid; border-color: #54c9b4 #0e3f39 #0e3f39 #54c9b4;
  background: radial-gradient(ellipse at 12% 0%, rgba(var(--sigil-rgb),0.2), transparent 60%), rgba(6,20,20,0.82);
  box-shadow: 0 0 0 1px #050608, inset 0 0 14px rgba(var(--sigil-rgb),0.16), 0 0 10px rgba(var(--sigil-rgb),0.18); }
.sigilbox[data-stage="dormant"] { border-color: #5e6b69 #252b2a #252b2a #5e6b69; background: rgba(12,15,15,0.82);
  box-shadow: 0 0 0 1px #050608, inset 0 0 10px rgba(0,0,0,0.4); }
.sigil-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.sigil-rune { flex: 0 0 auto; display: inline-flex; width: 20px; height: 20px; color: var(--sigil);
  filter: drop-shadow(0 0 4px rgba(var(--sigil-rgb),0.85)) drop-shadow(1px 1px 0 #050608);
  animation: sigil-breathe 2.4s steps(6, end) infinite alternate; }
.sigil-rune svg { width: 100%; height: 100%; image-rendering: pixelated; }
.sigilbox[data-stage="dormant"] .sigil-rune { color: #7d8b88; filter: drop-shadow(1px 1px 0 #050608); animation: none; }
.sigil-title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.sigil-word { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #9fded2; }
.sigil-stage { font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sigil);
  text-shadow: 1px 1px 0 #050608, 0 0 8px rgba(var(--sigil-rgb),0.6); }
.sigilbox[data-stage="dormant"] .sigil-word, .sigilbox[data-stage="dormant"] .sigil-stage { color: #8d9a97; text-shadow: 1px 1px 0 #050608; }
.sigil-effect { margin: 0 0 6px; font-size: 13px; color: #e6fbf6; text-shadow: 1px 1px 0 #050608; }
.sigil-stages { display: flex; gap: 5px; margin: 0 0 6px; }
.sigil-gem { flex: 1 1 0; height: 7px; border: 1px solid; border-color: #3c5a56 #121c1b #121c1b #3c5a56; background: rgba(0,0,0,0.5); }
.sigil-gem.grown { background: linear-gradient(180deg, #7b8f8b, #435451); border-color: #9fb3af #2a3534 #2a3534 #9fb3af; }
.sigil-gem.awake { background: linear-gradient(180deg, #c8fff4 0 1px, var(--sigil) 1px 4px, var(--sigil-mid) 4px);
  border-color: #c8fff4 var(--sigil-lo) var(--sigil-lo) #c8fff4; box-shadow: 0 0 5px rgba(var(--sigil-rgb),0.55); }
.sigil-meter { position: relative; height: 10px; border: 2px solid; border-color: #0b1f1d #4c8d84 #4c8d84 #0b1f1d;
  background: rgba(0,0,0,0.6); box-shadow: 0 0 0 1px #050608; overflow: hidden; }
.sigil-fill { position: absolute; left: 0; top: 0; bottom: 0; display: block;
  background: linear-gradient(180deg, #d2fff6 0 1px, var(--sigil) 1px 4px, var(--sigil-mid) 4px 100%); }
.sigil-fill::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: min(2px, 100%); background: #eafffb; }
.sigilbox[data-stage="dormant"] .sigil-fill { background: linear-gradient(180deg, #a9b5b3 0 1px, #6d7b78 1px); }
.sigilbox[data-stage="dormant"] .sigil-meter { border-color: #0f1312 #5e6b69 #5e6b69 #0f1312; }
.sigilbox[data-stage="dormant"] .sigil-progress, .sigilbox[data-stage="dormant"] .sigil-effect { color: #9aa6a3; }
.sigil-progress { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin: 4px 0 0;
  font-size: 11px; letter-spacing: 0.06em; color: #9fded2; font-variant-numeric: tabular-nums; }
.sigil-party { color: #85a8a1; font-style: italic; letter-spacing: 0.02em; }
.sigil-note { margin: 3px 0 0; font-size: 11px; color: #85a8a1; font-style: italic; }
/* AUDIT SET U9: the pack card's own paragraph rule (.pack-shell .card p: centred, 14px, its parchment colour) outranks
   a bare class, so the block's three lines drew as the card's - the set block's own fix (its lines say whose they are) */
.pack-shell .card .sigilbox p.sigil-effect { font-size: 13px; color: #e6fbf6; text-align: left; text-shadow: 1px 1px 0 #050608; }
.pack-shell .card .sigilbox p.sigil-progress { font-size: 11px; color: #9fded2; text-align: left; text-shadow: none; }
.pack-shell .card .sigilbox p.sigil-note { font-size: 11px; color: #85a8a1; text-align: left; text-shadow: none; }
.pack-shell .card .sigilbox[data-stage="dormant"] p.sigil-effect, .pack-shell .card .sigilbox[data-stage="dormant"] p.sigil-progress { color: #9aa6a3; }
.inv-info .sigilbox { margin: 8px 0 10px; }`;
/** SET5: a set's block on a card (ui/setCard.js setCard) - every rule its own class, laid by the Broker's window on the classic skin too (AUDIT SET U1). */
export const SET_BLOCK_CSS = `.setbox { position: relative; margin: 8px 0 10px; padding: 8px 10px 8px; text-align: left; border: 2px solid;
  border-color: var(--set-hi) var(--set-lo) var(--set-lo) var(--set-hi);
  background: radial-gradient(ellipse at 12% 0%, rgba(var(--set-rgb),0.22), transparent 62%), rgba(16,12,10,0.86);
  box-shadow: 0 0 0 1px #050608, inset 0 0 14px rgba(var(--set-rgb),0.14), 0 0 10px rgba(var(--set-rgb),0.14); }
.setbox[data-stage="asleep"] { filter: saturate(0.4); }
.set-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.set-name { font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--set);
  text-shadow: 1px 1px 0 #050608, 0 0 8px rgba(var(--set-rgb),0.5); }
.set-count { font-size: 12px; color: var(--set-hi); font-variant-numeric: tabular-nums; text-shadow: 1px 1px 0 #050608; }
/* the card's own paragraph rule (.pack-shell .card p: centred, 14px) outranks a bare class - the block's lines say
   whose they are */
.pack-shell .card .setbox p.set-role, .inv-info .setbox p.set-role, .setbox p.set-role { margin: 1px 0 6px; font-size: 11px;
  color: #b9ab93; font-style: italic; text-align: left; text-shadow: 1px 1px 0 #050608; }
.set-places { display: flex; gap: 4px; margin: 0 0 6px; }
.set-place { flex: 1 1 0; height: 8px; border: 1px solid; border-color: #4a4036 #17120e #17120e #4a4036; background: rgba(0,0,0,0.5); }
.set-place.on { background: linear-gradient(180deg, var(--set-hi) 0 1px, var(--set) 1px 5px, var(--set-lo) 5px);
  border-color: var(--set-hi) var(--set-lo) var(--set-lo) var(--set-hi); box-shadow: 0 0 5px rgba(var(--set-rgb),0.5); }
.pack-shell .card .setbox p.set-stage, .inv-info .setbox p.set-stage, .setbox p.set-stage { margin: 0 0 4px; font-size: 12px;
  color: #e8dcc6; text-align: left; text-shadow: 1px 1px 0 #050608; }
.set-tier { display: flex; gap: 8px; align-items: flex-start; margin: 5px 0 0; opacity: 0.55; }
.set-tier.awake { opacity: 1; }
.set-at { flex: 0 0 auto; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #050608; background: #8a7d69; border: 1px solid;
  border-color: #b9ab93 #3a3129 #3a3129 #b9ab93; }
.set-tier.awake .set-at { background: var(--set); border-color: var(--set-hi) var(--set-lo) var(--set-lo) var(--set-hi);
  box-shadow: 0 0 6px rgba(var(--set-rgb),0.6); }
.set-tier-body { display: flex; flex-direction: column; min-width: 0; }
.set-tier-name { font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--set-hi); }
.set-tier:not(.awake) .set-tier-name { color: #b9ab93; }
.set-tier-text { font-size: 12px; line-height: 1.35; color: #e6dccb; }
.inv-info .setbox { margin: 8px 0 10px; }`;
/** SET7: the Sigil Broker's window (ui/brokerWindow.js) - every rule the window's own class; the window lays it itself on the classic skin (AUDIT SET U1), with the kit made for its roles alone. */
export const BROKER_CSS = `/* ── SET7: THE SIGIL BROKER'S WINDOW (ui/brokerWindow.js) - the Info box's kind: a stone window over the world, the
   day's six offers in a list, the one pressed shown whole beside it (under it on a phone). The kit dresses the window,
   the card, the rows, the header and the presses (ui/enhancedFrame.js FRAME_ROLES); this is the layout. ── */
.broker-shell { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.42); font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; }
.broker-win { width: min(980px, 96vw); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
  border: 2px solid; background: rgba(14,12,11,0.96); }
.broker-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 12px 16px; border-bottom: 2px solid rgba(5,6,8,0.6); }
.broker-title { flex: 1 1 280px; min-width: 0; }
.broker-title h2 { margin: 0; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe0b8; text-shadow: 2px 2px 0 #050608; }
.broker-sub { margin: 2px 0 0; font-size: 12px; color: #b9ab93; }
.broker-note { margin: 4px 0 0; font-size: 12px; color: #e59a8e; }
.broker-note.ok { color: #f3cf86; }
.broker-purse { flex: 0 0 auto; white-space: nowrap; padding: 4px 10px; font-size: 13px; color: #ffd6d0; letter-spacing: 0.06em; border: 1px solid #7a2a24;
  background: rgba(90,20,16,0.45); box-shadow: 0 0 8px rgba(224,64,48,0.35); text-shadow: 1px 1px 0 #050608; }
.broker-body { display: flex; gap: 14px; padding: 12px 16px 16px; min-height: 0; overflow: auto; }
.broker-offers { flex: 1 1 55%; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.broker-offer { display: grid; grid-template-columns: 48px minmax(0, 1fr) 112px 148px; align-items: center; gap: 10px;   /* SS2: the price's column one width in every row - "12 Sigil Stones" is 108px, "4" 101 - so the prices stand in a line */
  padding: 6px 10px; cursor: pointer; border: 1px solid transparent; }
.broker-offer.on { background: linear-gradient(90deg, rgba(243,207,134,0.12), transparent 85%); }
.broker-frame { position: relative; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid; border-color: var(--rar-hi, #6d6252) var(--rar-lo, #231e18) var(--rar-lo, #231e18) var(--rar-hi, #6d6252);
  background: radial-gradient(ellipse at 50% 115%, rgba(var(--rar-rgb, 120,110,90),0.3), transparent 68%), rgba(0,0,0,0.45); }
.broker-frame .tile { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; font-size: 13px; color: #e6dccb; }
.broker-frame .tile img { max-width: 36px; max-height: 36px; image-rendering: pixelated; }
.broker-frame[data-sigil]::after { content: ''; position: absolute; right: 2px; top: 2px; width: 10px; height: 10px; pointer-events: none;
  background: var(--set-rune) center / contain no-repeat; }
.broker-offer-body { display: flex; flex-direction: column; min-width: 0; }
.broker-name { font-size: 14px; color: var(--rar, #e8dcc6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 1px 1px 0 #050608; }
.broker-set { font-size: 11px; color: #b9ab93; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.broker-price { font-size: 12px; color: #ffcfc8; white-space: nowrap; font-variant-numeric: tabular-nums; }
.broker-buy { width: 100%; min-width: 0; white-space: nowrap; }   /* one column's width in every row: the prices stand in a line */
.broker-close { flex: 0 0 auto; }
.broker-offer.no-bought .broker-name, .broker-offer.no-bought .broker-price { opacity: 0.5; }
.broker-offer.no-stones .broker-price { color: #9a8e7c; }
.broker-card { flex: 1 1 45%; min-width: 0; margin: 0; padding: 12px 14px; border: 2px solid; align-self: flex-start; }
.broker-card h3 { margin: 0 0 6px; font-family: inherit; font-size: 16px; color: var(--rar, #efe8d6); }   /* AUDIT SET U14: the window's pixel face, as the pack's own card (.pack-shell .card h3) - never the display serif */
.broker-card ul.rarity { list-style: none; margin: 0 0 8px; padding: 0; font-size: 13px; line-height: 1.45; color: #e6dccb; }
.broker-card ul.rarity li:first-child { text-transform: uppercase; letter-spacing: 0.16em; font-size: 10.5px; color: #b9ab93; }
.broker-card .setbox p.set-role { margin: 1px 0 6px; font-size: 11px; color: #b9ab93; font-style: italic; text-align: left; }
.broker-card .setbox p.set-stage { margin: 0 0 4px; font-size: 12px; color: #e8dcc6; text-align: left; }
.broker-card .boundline { margin: 8px 0 0; font-size: 12px; letter-spacing: 0.04em; color: #f3cf86; text-shadow: 1px 1px 0 #050608; }   /* SS4: the pack card's own line, on both skins' Broker sheets */
@media (max-width: 720px) {
  .broker-shell { padding: 8px; }
  .broker-head { padding: 10px 12px; }
  .broker-title { flex-basis: 100%; }
  .broker-title h2 { font-size: 17px; letter-spacing: 0.08em; }
  .broker-purse { margin-right: auto; font-size: 12px; letter-spacing: 0.02em; }
  .broker-body { flex-direction: column; padding: 10px 12px 12px; }
  .broker-offer { grid-template-columns: 44px minmax(0, 1fr) 112px; padding: 6px 8px; }
  .broker-offer .broker-price { grid-column: 2; grid-row: 2; }
  .broker-offer .broker-buy { grid-column: 3; grid-row: 1 / span 2; padding-left: 6px; padding-right: 6px; letter-spacing: 0.03em; }
}`;
export const ITEM_FRAME_CSS = `
/* ── RARITY-UI: THE TIER ON THE ICON'S FRAME ── */
${rarityVarsCss()}
/* the pack's grid (and the remote pane's): the tile IS the icon's frame */
.pack-shell .pack-dock .itemrow[data-rarity] {
  border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi);
  background-image: radial-gradient(ellipse at 50% 115%, rgba(var(--rar-rgb),0.26), transparent 68%),
    linear-gradient(180deg, rgba(255,255,255,0.06) 0 2px, transparent 2px);
  box-shadow: 0 0 0 1px #050608, inset 0 0 0 1px rgba(var(--rar-rgb),0.3), inset 0 0 12px rgba(var(--rar-rgb),0.2); }
.pack-shell .pack-dock .itemrow[data-rarity]:hover, .pack-shell .pack-dock .itemrow[data-rarity]:focus-visible {
  border-color: var(--rar-hi);
  box-shadow: 0 0 0 1px #050608, 0 0 9px rgba(var(--rar-rgb),0.6), inset 0 0 0 1px rgba(var(--rar-rgb),0.45),
    inset 0 0 16px rgba(var(--rar-rgb),0.32); }
.pack-shell .pack-dock .itemrow[data-rarity].on { border-color: var(--rar-hi); outline-color: rgba(var(--rar-rgb),0.7);
  box-shadow: 0 0 0 1px #050608, 0 0 12px rgba(var(--rar-rgb),0.55), inset 0 0 16px rgba(var(--rar-rgb),0.32); }
/* the tier's pips, bottom-left - the corner the key chip (top-left) and the count (bottom-right) leave free */
.pack-shell .pack-dock .itemrow[data-rarity]::before { content: var(--rar-pips); position: absolute; left: 3px; bottom: 1px;
  font-size: 8px; line-height: 1; letter-spacing: 1px; color: var(--rar); pointer-events: none;
  text-shadow: 1px 1px 0 #050608, 0 0 4px rgba(var(--rar-rgb),0.7); }
/* UI1 (bible/10-UI/Slots-Hotbar-Status.md): THE SLOT IS THE FRAME, AND ONLY IT (Mac: "rarity outlines ... the
   UI/Hotbar border itself instead of it being an icon within an icon") - the sprite, fitted to the slot's 52px room
   (ui/iconFit.js), stands straight on the slot's own ground under the tier's border, in no second box. The stack's
   count takes the slot's last corner. */
.pack-shell .pack-dock .itemrow .count { right: 4px; bottom: 3px; z-index: 2; font-size: 10px; line-height: 1; color: #efe8d6;
  pointer-events: none; text-shadow: -1px 0 0 #050608, 1px 0 0 #050608, 0 -1px 0 #050608, 0 1px 0 #050608, 1px 1px 0 #050608; }
.pack-shell .pack-dock .itemrow.hasbar .count { bottom: 7px; }
.pack-shell .pack-dock .itemrow[data-locked] .count { right: 16px; }   /* the padlock keeps the corner (LOCK1) */
/* a LIST's row keeps its engraved rule - the icon inside it is the frame (the loot window, the shop, a player trade) */
.pack-shell .loot-win .itemrow[data-rarity] .tile, .trade-shell .itemrow[data-rarity] .tile,
.ptrade-shell .itemrow[data-rarity] .tile {
  border: 2px solid; border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi);
  background: radial-gradient(ellipse at 50% 115%, rgba(var(--rar-rgb),0.3), transparent 70%), rgba(8,9,12,0.7);
  box-shadow: 0 0 0 1px #050608, inset 0 0 8px rgba(var(--rar-rgb),0.28); }
.pack-shell .loot-win .itemrow[data-rarity]:hover .tile, .trade-shell .itemrow[data-rarity]:hover .tile,
.ptrade-shell .itemrow[data-rarity]:hover .tile {
  box-shadow: 0 0 0 1px #050608, 0 0 8px rgba(var(--rar-rgb),0.55), inset 0 0 10px rgba(var(--rar-rgb),0.35); }
/* UI1b (Mac: "rarity outlines actually [on] the UI/Hotbar border itself instead of it being an icon within an icon"):
   A WORN PANEL IS ITS PIECE'S FRAME, as a grid slot and a shelf socket are - the tier on the panel's own border, lit
   from the top left, its glow behind the picture; the picture stands in no second box. It had been the list's rule: a
   small framed tile inside the big panel. */
/* AUDIT UI A2: :root first - a textured theme lays its stone on every tile at (0,5,0) (enhancedFrame.js themeCss), and
   at (0,4,0) this lost its glow to it under Stone; level with it, and later, it wins */
:root .pack-shell .equipped .wornrow[data-rarity] {
  border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi);
  background-image: radial-gradient(ellipse 72px 80% at 40px 50%, rgba(var(--rar-rgb),0.28), transparent),
    linear-gradient(180deg, rgba(255,255,255,0.06) 0 2px, transparent 2px);
  box-shadow: 0 0 0 1px #050608, inset 0 0 0 1px rgba(var(--rar-rgb),0.3), inset 0 0 12px rgba(var(--rar-rgb),0.18); }
.pack-shell .equipped .wornpair > .wornrow[data-rarity] {
  background-image: radial-gradient(ellipse at 50% 38%, rgba(var(--rar-rgb),0.28), transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,0.06) 0 2px, transparent 2px); }
.pack-shell .equipped .wornrow[data-rarity]:hover, .pack-shell .equipped .wornrow[data-rarity]:focus-visible {
  border-color: var(--rar-hi);
  box-shadow: 0 0 0 1px #050608, 0 0 9px rgba(var(--rar-rgb),0.6), inset 0 0 0 1px rgba(var(--rar-rgb),0.45),
    inset 0 0 16px rgba(var(--rar-rgb),0.32); }
.pack-shell .equipped .wornrow[data-rarity].on { border-color: var(--rar-hi); outline-color: rgba(var(--rar-rgb),0.7);
  box-shadow: 0 0 0 1px #050608, 0 0 12px rgba(var(--rar-rgb),0.55), inset 0 0 16px rgba(var(--rar-rgb),0.32); }
/* the shelf's sockets are their icons' frames */
.pack-shell .wornsock[data-rarity] { border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi);
  box-shadow: 0 0 0 1px #050608, inset 0 0 10px rgba(var(--rar-rgb),0.3); }
.pack-shell .wornsock[data-rarity]:hover { box-shadow: 0 0 0 1px #050608, 0 0 8px rgba(var(--rar-rgb),0.55), inset 0 0 12px rgba(var(--rar-rgb),0.36); }
/* the carried tile keeps its tier in the hand */
.dragghost[data-rarity] .tile.has-icon, .dragghost[data-rarity] .tile { border: 2px solid;
  border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi); box-shadow: 0 0 10px rgba(var(--rar-rgb),0.55); }
/* the hotbar and the crossbar: the slot's own frame */
.hb .hb-slot[data-rarity] .hb-frame { border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 0 12px rgba(var(--rar-rgb),0.3); }
.hb .hb-slot.hb-active[data-rarity] .hb-frame { border-color: var(--rar-hi);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 0 14px rgba(192,138,62,0.35), 0 0 8px rgba(var(--rar-rgb),0.6); }
/* the quickslot diamond: the frame is a clipped rhombus, so its colour is a BACKGROUND (enhancedStyle's own note) */
.hud-qdiamond .hud-qcell[data-rarity]:not(.socket) .hud-qframe {
  background: linear-gradient(135deg, var(--rar-hi) 0%, var(--rar) 45%, var(--rar-lo) 100%); }
/* the card: the name in the tier's colour, the tier's word marked, the big picture lit from below */
.inv-tip .card[data-rarity] h3, .inv-info .card[data-rarity] .inv-info-box:first-child p:first-child,
.pack-shell .packdetail .card[data-rarity] h3 { color: var(--rar); text-shadow: 1px 1px 0 #050608, 0 0 8px rgba(var(--rar-rgb),0.45); }
.card[data-rarity] > ul.rarity > li:first-child { color: var(--rar); letter-spacing: 0.18em; }
.card[data-rarity] > ul.rarity > li:first-child::before { content: var(--rar-pips); margin-right: 6px; font-size: 9px;
  letter-spacing: 1px; text-shadow: 0 0 4px rgba(var(--rar-rgb),0.7); }
.inv-tip > .card[data-rarity] { border-top-color: var(--rar); }
.bigicon[data-rarity] img { filter: drop-shadow(0 0 7px rgba(var(--rar-rgb),0.55)) drop-shadow(1px 1px 0 #050608); }
/* AUDIT MERGE-PLUS D2: a list's picture keeps its icon INSIDE the tier's 2px frame - a worn pair's 28px tile is
   border-box, and its 28px icon cap painted over two of the frame's four edges */
.pack-shell .loot-win .itemrow[data-rarity] .tile img, .trade-shell .itemrow[data-rarity] .tile img,
.ptrade-shell .itemrow[data-rarity] .tile img { max-width: 100%; max-height: 100%; }
/* AUDIT MERGE-PLUS D1: A TIER NEVER HIDES A STATE. The tier's frame is laid after the kit and outranks it, so every
   passing state painted on the same frame is said again here, at the tier's weight and after it: the reorder's
   insertion mark, the picked socket (and a socket as a drop target), the hotbar's strike, refusal and drop target,
   the refused drag. The state wins the moment it lasts; the tier's glow stays under it where there is room. */
.pack-shell .pack-dock .itemrow[data-rarity].dragover {
  box-shadow: 0 0 0 1px #050608, inset 0 2px 0 #c08a3e, inset 0 0 12px rgba(var(--rar-rgb),0.2); }
.pack-shell .wornsock[data-rarity].on { border-color: var(--rar-hi); outline-color: rgba(var(--rar-rgb),0.7);
  background-image: linear-gradient(180deg, rgba(243,207,134,0.14) 0 2px, rgba(192,138,62,0.08) 2px);
  box-shadow: 0 0 0 1px #050608, 0 0 12px rgba(var(--rar-rgb),0.55), inset 0 0 16px rgba(var(--rar-rgb),0.32); }
.pack-shell .wornsock[data-rarity].dragover { box-shadow: 0 0 0 1px #050608, inset 0 2px 0 #c08a3e, inset 0 0 10px rgba(var(--rar-rgb),0.3); }
.hb .hb-slot[data-rarity].hb-strike .hb-frame { border-color: #f3cf86 #c08a3e #7a5424 #f3cf86; }
.hb .hb-slot[data-rarity].hb-deny .hb-frame { border-color: var(--blood, #8c3a32); }
.hb .hb-slot[data-rarity].dragover .hb-frame { border-color: var(--verdigris, #4e7f72); border-style: solid; }
.dragghost.refused[data-rarity] .tile.has-icon, .dragghost.refused[data-rarity] .tile { border-color: var(--blood, #8c3a32);
  box-shadow: 0 0 10px rgba(140,58,50,0.55); }

/* ── SIGIL-UI: THE RUNE IN THE CORNER, AND THE SIGIL'S OWN BLOCK ── */
${SIGIL_VARS_CSS}
/* AUDIT MERGE-PLUS D5: the corner rune is a PICTURE with its black outline drawn in (ui/sigilRune.js
   SIGIL_RUNE_TILE_SVG), as the padlock is - it was a mask over the teal, and a masked glyph's drop shadow is clipped
   by its own mask, so the outline and glow it was given never drew. D6: and every picture markItemFrame marks
   wears it - the loot window's, the shop's and the trade's rows and the carried tile, not only the grid's. */
.pack-shell .pack-dock .itemrow[data-sigil]::after, .pack-shell .wornsock[data-sigil]::after,
.pack-shell .equipped .wornrow[data-sigil]::after, .hb .hb-slot[data-sigil]::before,
.hud-qdiamond .hud-qcell[data-sigil]:not(.socket) .hud-qbody::after,
.pack-shell .loot-win .itemrow[data-sigil] .tile::after, .trade-shell .itemrow[data-sigil] .tile::after,
.ptrade-shell .itemrow[data-sigil] .tile::after, .dragghost[data-sigil] .tile::after {
  content: ''; position: absolute; width: 11px; height: 11px; pointer-events: none; z-index: 2;
  background: ${SIGIL_RUNE_TILE_URL} center / contain no-repeat;
  animation: sigil-breathe 2.4s steps(6, end) infinite alternate; }
.pack-shell .pack-dock .itemrow[data-sigil]::after, .pack-shell .wornsock[data-sigil]::after,
.pack-shell .equipped .wornrow[data-sigil]::after { right: 3px; top: 3px; }   /* UI1b: the panel is the frame, so its corner */
.pack-shell .equipped .wornrow[data-sigil] .worncount { right: 18px; }   /* the family's count steps off the rune's corner */
.dragghost[data-sigil] .tile { position: relative; }
.pack-shell .loot-win .itemrow[data-sigil] .tile::after,
.trade-shell .itemrow[data-sigil] .tile::after, .ptrade-shell .itemrow[data-sigil] .tile::after,
.dragghost[data-sigil] .tile::after { right: -4px; top: -4px; width: 9px; height: 9px; }
.hb .hb-slot[data-sigil]::before { right: 3px; bottom: 9px; }
.hud-qdiamond .hud-qcell[data-sigil]:not(.socket) .hud-qbody::after { left: calc(50% - 6px); top: 12%; width: 12px; height: 12px; }
${SIGIL_KEYFRAMES_CSS}
${SIGIL_BLOCK_CSS}
@media (prefers-reduced-motion: reduce) {
  .sigil-rune, .pack-shell .pack-dock .itemrow[data-sigil]::after, .pack-shell .wornsock[data-sigil]::after,
  .pack-shell .equipped .wornrow[data-sigil]::after, .hb .hb-slot[data-sigil]::before,
  .hud-qdiamond .hud-qcell[data-sigil]:not(.socket) .hud-qbody::after,
  .pack-shell .loot-win .itemrow[data-sigil] .tile::after, .trade-shell .itemrow[data-sigil] .tile::after,
  .ptrade-shell .itemrow[data-sigil] .tile::after, .dragghost[data-sigil] .tile::after { animation: none; } }
/* ── SET5: A SET PIECE'S RUNE IN ITS SET'S COLOUR, ITS SET'S BLOCK ON THE CARD, THE DOLL'S STRIP (ui/setCard.js) ──
   The rune: markItemFrame writes --set-rune (ui/sigilRune.js sigilRuneTileUrl, the set's colour) beside data-set, and
   this rule - the rune rule's own selectors, later and as specific - swaps the picture; every other line of the rune
   stays the sigil's. The block and the strip take --set, --set-hi, --set-lo and --set-rgb from the set's record
   (setShades), so the sheet names no set. */
.pack-shell .pack-dock .itemrow[data-set]::after, .pack-shell .wornsock[data-set]::after,
.pack-shell .equipped .wornrow[data-set]::after, .hb .hb-slot[data-set]::before,
.hud-qdiamond .hud-qcell[data-set]:not(.socket) .hud-qbody::after,
.pack-shell .loot-win .itemrow[data-set] .tile::after, .trade-shell .itemrow[data-set] .tile::after,
.ptrade-shell .itemrow[data-set] .tile::after, .dragghost[data-set] .tile::after { background-image: var(--set-rune); }
${SET_BLOCK_CSS}
.setstrip { display: flex; flex-direction: column; gap: 4px; margin: 8px 0 0; flex: 0 0 auto; }
.setline { display: flex; align-items: center; gap: 8px; min-height: 24px; padding: 2px 8px; cursor: pointer; text-align: left;
  font: inherit; font-size: 12px; color: #e8dcc6; border: 1px solid; border-color: var(--set-hi) var(--set-lo) var(--set-lo) var(--set-hi);
  background: linear-gradient(90deg, rgba(var(--set-rgb),0.22), rgba(10,8,6,0.82) 70%); box-shadow: 0 0 0 1px #050608; }
.setline:hover, .setline:focus-visible { background: linear-gradient(90deg, rgba(var(--set-rgb),0.36), rgba(10,8,6,0.82) 76%); outline: none; }
.setline-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--set);
  letter-spacing: 0.04em; text-shadow: 1px 1px 0 #050608; }
.setline-count { font-variant-numeric: tabular-nums; color: var(--set-hi); }
.setline-pips { display: inline-flex; gap: 4px; padding: 0 2px; }
.setline-pips i { width: 7px; height: 7px; transform: rotate(45deg); background: rgba(0,0,0,0.6); border: 1px solid #5d5245; }
.setline-pips i.on { background: var(--set); border-color: var(--set-hi); box-shadow: 0 0 4px rgba(var(--set-rgb),0.7); }
.setline-stage { min-width: 64px; text-align: right; color: #b9ab93; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
@media (pointer: coarse) { .setline { min-height: 40px; } }   /* AUDIT SET U14: a line a thumb presses, as every other press on a touch screen */
${BROKER_CSS}
/* ── WEAR-UI: THE HOTBAR'S WEAR BAR, ON EVERY PICTURE OF A PIECE THAT WEARS (ui/enhancedInventory.js wearBar) ──
   The hotbar's own bar (3px, a hard black ring, its green and its red under 40), a lit pixel on top like every fill
   here. Along the foot of a grid tile or a socket; inside the foot of a list's picture. A broken piece's track goes
   to blood. The grid's tier pips step up over it. */
.pack-shell .wear, .trade-shell .wear, .ptrade-shell .wear { position: absolute; left: 4px; right: 4px; bottom: 2px; height: 3px;
  display: block; z-index: 1; pointer-events: none; background: rgba(5,6,8,0.82); box-shadow: 0 0 0 1px #050608; }
.pack-shell .wear > i, .trade-shell .wear > i, .ptrade-shell .wear > i { display: block; height: 100%;
  background: linear-gradient(180deg, #c8f5da 0 1px, #74d9a0 1px); }
.pack-shell .wear.worn > i, .trade-shell .wear.worn > i, .ptrade-shell .wear.worn > i { background: linear-gradient(180deg, #f5bdb4 0 1px, #d98074 1px); }
.pack-shell .wear.broken, .trade-shell .wear.broken, .ptrade-shell .wear.broken { background: rgba(122,29,22,0.9); }
.pack-shell .loot-win .itemrow .tile, .pack-shell .wornrow .tile, .trade-shell .itemrow .tile, .ptrade-shell .itemrow .tile { position: relative; }
.pack-shell .loot-win .itemrow .wear, .pack-shell .wornrow .wear, .trade-shell .itemrow .wear, .ptrade-shell .itemrow .wear { left: 2px; right: 2px; bottom: 0; }
.pack-shell .pack-dock .itemrow.hasbar[data-rarity]::before { bottom: 6px; }
/* ── LOCK1: THE PADLOCK ON A LOCKED PIECE (systems/itemLock.js) - bottom-right of a grid tile or a socket (above the
   wear bar's end when there is one; the key chip has the top-left), the top-left corner of a list's picture (the
   rune has its top-right). The card says it in words. */
.pack-shell [data-locked] .tile::before, .trade-shell [data-locked] .tile::before, .ptrade-shell [data-locked] .tile::before {
  content: ''; position: absolute; right: 2px; bottom: 2px; width: 11px; height: 11px; z-index: 2; pointer-events: none;
  background: ${LOCK_GLYPH_URL} center / contain no-repeat; }
.pack-shell .hasbar[data-locked] .tile::before { bottom: 6px; }
.pack-shell .loot-win [data-locked] .tile::before,
.trade-shell [data-locked] .tile::before, .ptrade-shell [data-locked] .tile::before { right: auto; bottom: auto; left: -4px; top: -4px; }
/* UI1b: a worn panel's padlock is the panel's, top left - the rune has its top right */
.pack-shell .equipped .wornrow[data-locked] .tile::before { content: none; }
.pack-shell .equipped .wornrow[data-locked]::before { content: ''; position: absolute; left: 3px; top: 3px; width: 11px; height: 11px;
  z-index: 2; pointer-events: none; background: ${LOCK_GLYPH_URL} center / contain no-repeat; }
.card .lockline, .card .boundline, .pack-shell .card p.lockline, .pack-shell .card p.boundline { margin: 6px 0 4px; font-size: 12px; letter-spacing: 0.04em; color: #f3cf86; text-shadow: 1px 1px 0 #050608; }
.card .lockline::before { content: ''; display: inline-block; width: 11px; height: 11px; margin-right: 6px; vertical-align: -1px;
  background: ${LOCK_GLYPH_URL} center / contain no-repeat; }
`;

/** AUDIT MERGE-PLUS D3: the lane's words on Stone's light grey (ONLINE_DRESS_CSS, last) - each 4.5:1 or better over
 *  Stone's panel and ground (PLUS_THEMES.stone), measured in test/auditmergeplus_ui.test.js. */
export const STONE_DIM = '#e2dccd';
export const STONE_WORD = '#fbf8f0';
export const STONE_AMBER = '#ffd98a';
export const STONE_RED = '#ffc4bb';
/** PLUS-DRESS: the words over the world - a one-pixel outline and the HUD's drop, never a blur. */
const OUTLINED = '-1px 0 0 #050608, 1px 0 0 #050608, 0 -1px 0 #050608, 0 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7)';
/** PLUS-DRESS: a brass clasp at each end of a bar, the vitals' own (VITALS_CSS .hud-vital::before). */
const CLASP = 'linear-gradient(180deg, #f3cf86 0 2px, transparent 2px), linear-gradient(90deg, #e2b064 0 2px, #c08a3e 2px 4px, #7a5424 4px 6px)';

/** PLUS-DRESS (2026-09-26, Mac: "just ensure any of the new UI elements are also apart of how enhanced plus looks"):
 *  the online lane's newer screens, dressed. Most of it is the kit's by ROLE (ui/enhancedFrame.js FRAME_ROLES - the
 *  journal page, the F-menu, the decorator, the duel strip, the party invitation, the Guild tab's heads and rows, and
 *  the blood-edged WARN role for a press that costs something). This block is what a role cannot say. Every rule
 *  carries a leading body where the surface's own sheet is injected after this one (the kit's own convention). */
export const ONLINE_DRESS_CSS = `
/* A native hover turned the words to ink on a brass fill; the kit's hover keeps the ground dark, so the words stay
   bone. Where the native hover outweighed the kit's (a :not() in it), the kit's hover is said again at its weight. */
body .dfprofile-close:hover, body .dfdecor-btn:hover, body .dfduel-btn:hover, body .dfdecor-open:hover { color: var(--bone, #e9e4d9); }
body .dfpage-btn:hover:not(:disabled), body .dfpeer-btn:not(.cancel):hover:not([disabled]) {
  color: var(--bone, #e9e4d9); background-color: ${FRAME_TONES.groundButtonHi};
  background-image: linear-gradient(180deg, rgba(255,255,255,0.08) 0 2px, transparent 2px calc(100% - 3px), rgba(0,0,0,0.32) calc(100% - 3px)); }
body .dfpeer-btn.cancel:hover:not([disabled]) { background: none; color: var(--bone, #e9e4d9); }
/* The lane drew its presses borderless or on a 1px line, so the kit's bevel had no edge to paint: a 2px edge (width
   and style only - the kit owns the colour), taken out of the padding so each press keeps its size (the sheet is
   border-box). The touch skin's own paddings outweigh these and stand. */
body .dfsocial-btn, body .dfsocial-close, body .dfprofile-close, body .dfprofile-duel, body .dfpage-btn, body .dfpeer-btn:not(.cancel),
body .dfduel-btn, body .dfdecor-btn, body .dfdecor-open { border-width: 2px; border-style: solid; }
body .dfsocial-btn { padding: 2px 6px; }
body .dfsocial-close { padding: 0 6px; }
body .dfprofile-close, body .dfpage-btn { padding: 4px 10px; }
body .dfprofile-duel { padding: 5px 11px; }
body .dfpeer-btn:not(.cancel) { padding: 4px 6px; }
body .dfduel-btn { padding: 3px 11px; }
body .dfdecor-btn { padding: 3px 13px; }
body .dfdecor-open { padding: 5px 11px; }
/* the duel strip: the skin's pixel face (it was the page's own), and the challenge's blood down its left edge */
body .dfduel-toast { ${PIXEL_FONT_CSS} border-left-color: #b83a2e;
  box-shadow: 0 0 0 1px #050608, inset 3px 0 0 #b83a2e, inset 0 0 0 1px rgba(5,6,8,0.75), 3px 3px 0 1px rgba(0,0,0,0.4); }
/* the Social panel: the tab's count a red seal, the presence dot a square gem, a letter's row marked like a list's */
body .dfsocial-badge { background: #b83a2e; color: #fff6ee; box-shadow: 0 0 0 1px #050608, inset 0 1px 0 rgba(255,255,255,0.28);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.55); }
body .dfsocial-dot { border-radius: 0; }
body .dfsocial-row .dfsocial-dot, body .dfsocial-letter .dfsocial-dot.unread { box-shadow: 0 0 0 1px #050608, inset 1px 1px 0 rgba(255,255,255,0.3); }
body .dfsocial-letter:hover, body .dfsocial-letter:focus-visible { box-shadow: inset 2px 0 0 ${FRAME_TONES.brass}; }
body .dfsocial-sec { color: #b3a684; }
/* the decorator: the chosen piece carries the list's brass mark */
body .dfdecor-row[aria-selected="true"] { box-shadow: 0 1px 0 rgba(163,152,128,0.1), inset 2px 0 0 ${FRAME_TONES.brass}; }
/* RENOWN, wherever a name wears it: the box is a brass plaque - over a player's head, on the profile card and on the
   HUD's own row */
body .dfname-renown, body .dfprofile-renown, .hud-renownbox { border-radius: 0; border-color: ${FRAME_TONES.brassHi} ${FRAME_TONES.brassLo} #5c3f1a ${FRAME_TONES.brass};
  background: rgba(12,14,18,0.88); color: ${FRAME_TONES.brassHi}; box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45);
  text-shadow: 1px 1px 0 #050608; }
/* RENOWN4's bar, the vitals' way (VB2): a stone bevel, the gold banded from a lit top, a lit leading edge, what is
   earned and not yet answered paler after it, a brass clasp at each end. Paint only - the row keeps its 22px.
   UI3: at the vitals' own height now, so banded as they are (a lit 2px, the light, the body, the low, the deep), and
   the XP inside it in their numbers' face. */
.hud-renown .hud-renowntrack { border-color: #9a9079 #3a352a #25221b #6e6755; isolation: isolate;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0 2px, transparent 2px), #171208;
  box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45); }
.hud-renown .hud-fill { background: linear-gradient(180deg, #fff0b8 0 2px, #f2c46b 2px 6px, #d9a441 6px 13px, #a87a2a 13px 17px, #6e4f1a 17px 100%); }
.hud-renown .hud-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: min(2px, 100%); background: #fff0b8; opacity: 0.85; }
.hud-renownghost { background: linear-gradient(180deg, rgba(255,240,184,0.5) 0 2px, rgba(242,196,107,0.3) 2px); }
.hud-renownnum { color: #fffaf0; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7); }
.hud-renown .hud-renowntrack::before, .hud-renown .hud-renowntrack::after { content: ''; position: absolute; top: -2px; bottom: -2px;
  width: 6px; z-index: 2; box-shadow: 0 0 0 1px #050608; background: ${CLASP}; }
.hud-renown .hud-renowntrack::before { left: -6px; }
.hud-renown .hud-renowntrack::after { right: -6px; }
/* the party's lines in the vitals' own tones, banded from a lit top, each in a hard black ring */
body .dfparty-track { background: rgba(5,6,8,0.72); box-shadow: 0 0 0 1px #050608, 1px 1px 0 1px rgba(0,0,0,0.35); }
body .dfparty-vital.health .dfparty-fill { background: linear-gradient(180deg, #f2a597 0 1px, #d8685a 1px 2px, #b53a2e 2px 4px, #8a2820 4px); }
body .dfparty-vital.fatigue .dfparty-fill { background: linear-gradient(180deg, #b9f0c4 0 1px, #2f9152 1px); }
body .dfparty-vital.magicka .dfparty-fill { background: linear-gradient(180deg, #b7c8ff 0 1px, #3f5fc4 1px); }
/* THE GATE (WB2, WB4): the boss's bar is a vital - the stone bevel, the fire banded from a lit top with a lit edge,
   the phase marks cut in, brass clasps, the ward a brass cage around it - and the words are the HUD's: the pixel
   face, outlined. The fire's own colours stay his. */
body .wb-boss-bar { ${PIXEL_FONT_CSS} font-weight: 400; letter-spacing: 0.06em; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7); }
body .wb-boss-name { font-size: 14px; letter-spacing: 0.14em; text-shadow: ${OUTLINED}; }
body .wb-boss-track { border: 2px solid; border-color: #9a9079 #3a352a #25221b #6e6755; isolation: isolate;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0 2px, transparent 2px), #1e0906;
  box-shadow: 0 0 0 1px #050608, 3px 3px 0 1px rgba(0,0,0,0.45); }
body .wb-boss-fill { background: linear-gradient(180deg, #ffc08a 0 2px, #ff7a3a 2px 4px, #d8341a 4px 8px, #9a1a0a 8px 10px, #5c0a04 10px); }
body .wb-boss-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: min(2px, 100%); background: #ffd9a8; opacity: 0.85; }
body .wb-boss-mark { top: 0; bottom: 0; z-index: 1; background: linear-gradient(90deg, #050608 0 1px, rgba(255,230,200,0.55) 1px); }
body .wb-boss-ward { inset: -5px; border-color: ${FRAME_TONES.brassHi} ${FRAME_TONES.brassLo} #5c3f1a ${FRAME_TONES.brass};
  box-shadow: 0 0 0 1px #050608, inset 0 0 0 1px #050608; }
body .wb-boss-track::before, body .wb-boss-track::after { content: ''; position: absolute; top: -2px; bottom: -2px; width: 6px; z-index: 2;
  box-shadow: 0 0 0 1px #050608; background: ${CLASP}; }
body .wb-boss-track::before { left: -6px; }
body .wb-boss-track::after { right: -6px; }
body .wb-boss-callout { font-size: 15px; letter-spacing: 0.12em; text-shadow: ${OUTLINED}; }
body .wb-boss-foot { font-size: 11px; opacity: 1; color: #d8cfae; }
body .wb-gate-banner { ${PIXEL_FONT_CSS} font-weight: 400; font-size: 14px; letter-spacing: 0.14em; text-shadow: ${OUTLINED}; }
/* AUDIT MERGE-PLUS D3: STONE'S LIGHT GROUND. The lane's newer surfaces joined the window and panel roles above, and
   Stone paints those a light grey their words were never chosen for - they had kept their own dark ground on every
   theme until then (the F-menu's Cancel read at 2.3:1, a refused row's reason at 4.1:1). On Stone the lane's dim
   word (--dim, set on the surface so everything inside inherits it), the refusal's and the note's words, the
   decorator's amber reasons and its red price are lifted to 4.5:1 or better, each over a hard black drop. */
:root[data-plus-theme="stone"] body .dfdecor-card, :root[data-plus-theme="stone"] body .dfpage-card,
:root[data-plus-theme="stone"] body .dfpeer-card, :root[data-plus-theme="stone"] body .dfsocial-toast,
:root[data-plus-theme="stone"] body .dfduel-toast, :root[data-plus-theme="stone"] body .dfdecor-bar {
  --dim: ${STONE_DIM}; text-shadow: 1px 1px 0 rgba(5,6,8,0.85); }
:root[data-plus-theme="stone"] body .dfpeer-why, :root[data-plus-theme="stone"] body .dfpeer-btn[disabled]:hover .dfpeer-why,
:root[data-plus-theme="stone"] body .dfpage-note, :root[data-plus-theme="stone"] body .dfduel-sub { color: ${STONE_WORD}; }
:root[data-plus-theme="stone"] body .dfdecor-pick-why, :root[data-plus-theme="stone"] body .dfdecor-bar-why { color: ${STONE_AMBER}; }
:root[data-plus-theme="stone"] body .dfdecor-row.dim .dfdecor-row-price { color: ${STONE_RED}; }
`;

/** The layers that stand OVER the kit on purpose, in order - each outranks the kit's stone at the same weight. */
export const OVER_KIT_CSS = [ITEM_FRAME_CSS, ONLINE_DRESS_CSS];

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
/* RARITY-UI + SIGIL-UI, then PLUS-DRESS: after the kit - each outranks the kit's stone at the same weight */
${OVER_KIT_CSS.join('\n')}
`;
