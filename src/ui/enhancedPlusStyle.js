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
import { PIXEL_STACK, PIXEL_FONT_CSS, PIXEL_FACE_CSS } from './pixelifyFive.js';   // PLUS7; PLUS-DRESS: the whole trio for the sheets that forgot it
import { DIALOG_CSS } from './enhancedDialogStyle.js';
import { PORT_CSS } from './enhancedPortStyle.js';
import { LV2_CSS } from './levelUpStyle.js';
import { MOTION_CSS } from './windowMotion.js';
import { CURSOR_CSS } from './plusCursor.js';   // PLUS7: the gauntlet pointer
import { SIGIL_RUNE_TILE_URL } from './sigilRune.js';   // SIGIL-UI: the rune in a sigil weapon's tile corner (AUDIT MERGE-PLUS D5: a picture, its outline drawn in)
import { PROF_ACT_CSS } from './profActStyle.js';   // PROF-RETICLE: the acts on the crosshair, dressed
import { PROF_STATION_CSS } from './profStationStyle.js';   // PROF-STATIONS: the stations' acts, dressed

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
   sprite rather than flat, and a faint
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
/* GHOST-DIM (2026-10-02, Discord "Fatigue Bar": "the pending change on the fatigue bar is white ... Please lower the
   opacity for the damaged part of the bar"): the strip where the bar WAS is the bar's own body tone, faint - it was
   its palest tone under a cream line at 0.55, which on fatigue's mint read as a white bar still full. Lost reads as
   lost: darker than any band of the fill, never brighter. */
.hud-vital .hud-ghost { position: absolute; inset: 0; width: 0; display: block; z-index: -1;
  background: var(--v-body); opacity: 0.35; }
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
  background: rgba(0,0,0,0.28); box-shadow: 0 0 0 1px #050608;
  /* LIST-FIT (2026-09-27, kurkku on Discord: "Equipment sprites too big for the boxes"): a FLEX room, as the loot
     window's tile is. The base tile is a grid, and a grid's auto row gives a picture's max-height: 100% (the tier
     frame's cap, D2 below) nothing to resolve against - only the width was held, and a tall picture (a pauldron, a
     dai-katana) hung out of the box into the rows beneath. The shop and a player trade (a trade-shell too). */
  display: flex; align-items: center; justify-content: center; }

/* LEVEL-PLUS: THE LEVELING QUESTION (ui/enhancedLevelingChoice.js) - the last screen of making a character, in the
   rest window's shell: an eyebrow, the question as the heading, one line of lead, then the two systems side by side as
   sunk stone tiles (stacked on a phone). The chosen tile rises in brass; a tile shut online (LEVEL-ONLINE) is dimmed
   with its reason where its Choose would be. Tints and bevels only - every Plus theme keeps its own stone. */
.lvl-shell { z-index: 30; display: flex; align-items: center; justify-content: center; padding: 16px; }
.lvl-shell .px-win { width: min(780px, 100%); height: auto; max-height: min(640px, 92dvh); }
.lvl-shell .px-body { overflow: auto; }
.lvl-card { padding: 22px 26px 18px; }
.lvl-eyebrow { text-align: center; font-size: 11px; letter-spacing: 0.3em; text-indent: 0.3em; text-transform: uppercase;
  color: ${FRAME_TONES.brass}; text-shadow: 1px 1px 0 #050608; }
.lvl-card h2.lvl-title { margin: 6px 0 8px; font-family: inherit; font-weight: 400; text-align: center; font-size: 24px; letter-spacing: 0.18em; text-indent: 0.18em;
  text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.lvl-lead { margin: 0 0 18px; text-align: center; font-size: 14px; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.lvl-opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.lvl-opt { font: inherit; text-align: left; color: #d8cfae; cursor: pointer; display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px 12px; background: rgba(0,0,0,0.32); border: 2px solid;
  border-color: ${FRAME_TONES.stoneDark} ${FRAME_TONES.stoneMid} ${FRAME_TONES.stoneLit} ${FRAME_TONES.stoneDim};
  box-shadow: 0 0 0 1px #050608, inset 0 2px 0 rgba(0,0,0,0.45); transition: none; }
.lvl-opt.is-on, .lvl-opt:focus-visible { outline: none; background: rgba(192,138,62,0.12);
  border-color: ${FRAME_TONES.brassHi} ${FRAME_TONES.brassLo} #5c3f1a ${FRAME_TONES.brass};
  box-shadow: 0 0 0 1px #050608, 0 0 14px rgba(243,207,134,0.18), inset 0 1px 0 rgba(255,244,210,0.18); }
.lvl-opt-head { display: flex; align-items: baseline; gap: 10px; }
.lvl-key { flex: 0 0 auto; min-width: 22px; text-align: center; font-size: 12px; padding: 1px 4px; color: #a89f88;
  border: 1px solid rgba(125,116,96,0.55); }
.lvl-opt.is-on .lvl-key { color: rgb(243,239,44); border-color: ${FRAME_TONES.brass}; }
.lvl-opt-title { font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.lvl-opt.is-on .lvl-opt-title { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.lvl-tag { margin-left: auto; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #9c937d; white-space: nowrap; }
.lvl-opt-body { margin: 0; font-size: 14px; line-height: 1.5; color: #c5bda2; text-shadow: 1px 1px 0 #050608; }
.lvl-opt-foot { margin-top: auto; padding-top: 10px; border-top: 2px solid rgba(5,6,8,0.5); box-shadow: inset 0 1px 0 rgba(163,152,128,0.16);
  display: flex; justify-content: flex-end; }
.lvl-pick { font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: #a89f88; }
.lvl-opt.is-on .lvl-pick { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.lvl-lock { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: ${FRAME_TONES.brass}; }
.lvl-opt:disabled { cursor: default; opacity: 0.55; }
.lvl-hint { margin-top: 16px; text-align: center; font-size: 12px; letter-spacing: 0.06em; color: #9c937d; }
@media (max-width: 560px) {
  .lvl-shell { padding: 8px; } .lvl-shell .px-win { max-height: 96dvh; } .lvl-shell .px-body { padding: 10px 8px; } .lvl-card { padding: 14px 12px 12px; }
  .lvl-card h2.lvl-title { font-size: 20px; }
  .lvl-opt { min-height: 44px; padding: 12px 12px 10px; gap: 8px; } .lvl-opts { gap: 10px; } .lvl-lead { margin-bottom: 12px; } .lvl-hint { margin-top: 10px; }
}

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
/* AUDIT LIVED1b U7: the rest's clock line (AUDIT LIVED1 O) - one centred line under the readouts; empty offline, and gone */
.rest-shell .clock-line { margin: 10px 0 0; text-align: center; font-size: 12px; letter-spacing: 0.02em; color: #d8cfae;
  text-shadow: 1px 1px 0 #050608; }
.rest-shell .clock-line:empty { display: none; }

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
.rest-shell .rv-k { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #a89f88; }
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
   CARD-FIT: its set and sigil blocks are the card's short dress already, so the steps take the picture's size, then
   the picture and the tiers' briefs (their names stay); the Info box keeps every word. The screen's edge is the last
   word. */
.inv-tip.tip-compact .bigicon img { width: 56px; height: 56px; }
.inv-tip.tip-compact .set-tier-text { font-size: 11px; line-height: 1.2; }
.inv-tip.tip-tight .bigicon, .inv-tip.tip-tight .set-tier-text, .inv-tip.tip-tight .sigil-note { display: none; }
.inv-tip > .card { margin: 0; padding: 14px 16px 12px; border: 2px solid; }
.inv-tip .bigicon { display: flex; justify-content: center; margin: 0 0 8px; }
.inv-tip .bigicon img { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; }
.inv-tip h3 { margin: 0 0 4px; font: inherit; font-size: 17px; letter-spacing: 0.04em; color: #efe8d6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.inv-tip .meta { margin: 0 0 8px; font-size: 12px; color: #a89f88; }
.inv-tip .rarity { margin: 0 0 8px; padding: 0; list-style: none; font-size: 12px; color: ${FRAME_TONES.brassHi}; }   /* RARITY-UI: the tier line wears its pips, so the list's bullets went */
.inv-tip dl.stats > .pair { display: contents; }   /* CARD-FIT: a pair's group steps out of the hover card's grid */
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
.inv-info > .card { width: min(380px, 92vw); max-height: 86vh; overflow: hidden; margin: 0; padding: 16px 18px 14px;
  border: 2px solid; display: flex; flex-direction: column; gap: 10px; }
/* CARD-FIT U9: the words scroll, Close stands under them */
.inv-info-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 10px; }
.inv-info-box p { margin: 0 0 4px; font-size: 14px; line-height: 1.3; color: #e6dec6; text-shadow: 1px 1px 0 #050608; }
.inv-info-box p.center { text-align: center; }
.inv-info-box:first-child p:first-child { font-size: 16px; color: #efe8d6; }
.inv-info-box.more { padding-top: 10px; border-top: 2px solid rgba(5,6,8,0.45); box-shadow: inset 0 1px 0 rgba(163,152,128,0.16); }
.inv-info-box.more p { color: ${FRAME_TONES.brassHi}; }
.inv-info > .card > .act { align-self: center; min-width: 120px; }
.inv-dismantle .acts { justify-content: center; margin-top: 10px; }   /* SS5: the dismantle's Dismantle and Keep, under the question */
.inv-target .inv-info-body { gap: 0; }   /* MEND-AIM: the kit's chooser - one row a piece, the menu's own rows */
.inv-target .inv-menu-item { text-transform: none; letter-spacing: 0.02em; }
.inv-target .acts { justify-content: center; }


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
.pack-shell .wornpair > .wornrow .wornslot { font-size: 11px; letter-spacing: 0.06em; line-height: 1.15;
  white-space: normal; text-align: center; }
.pack-shell .wornpair > .wornrow .wornname { font-size: 11px; line-height: 1.15; text-align: center;
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
  .pack-shell .wornpair > .wornrow .wornslot { font-size: 11px; letter-spacing: 0.12em; white-space: nowrap;
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
  font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
@media (max-width: 640px) { .pack-shell .shelflabel { letter-spacing: 0; } }   /* AUDIT FONT3 L6: after the rule it narrows - AMULETS and CRYSTALS whole in a 52px group (BRACELETS was cut before FONT3 too) */
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
/* ── PLUS-MAP: THE 3D DUNGEON MAP'S BAR ── the map's turn, tilt, floor and view as Enhanced Plus buttons in a carved
   bar over the foot of the paper (ui/heldMap.js _renderTools), in the journey bar's stone and parting rules; the floor
   readout between Down and Up in the journey's gold numerals */
.hmroot .hmtools { position: absolute; left: 50%; bottom: 58px; transform: translateX(-50%); z-index: 2;
  display: flex; align-items: stretch; max-width: calc(100vw - 32px); box-sizing: border-box; border: 2px solid; border-radius: 0;
  pointer-events: auto; ${PIXEL_FONT_CSS} }
/* PLUS-MAP (Mac: "the fonts dont look like this ... make sure its enhanced plus"): the bar speaks the Plus pixel face
   outright - the map's root is lettered in the body face, and the bar inherited it */
.hmroot .hmtools button, .hmroot .hmtools .hmfloor, .hmroot .hmtools .dlg-key { ${PIXEL_FACE_CSS} }   /* AUDIT FONT3 F2: the face alone - the trio's reading pair (0.5px) outranked .hmtool's own 0.12em here, at (0,2,1) over (0,2,0); the weight and spacing inherit */
.hmroot .hmtoolgroup { display: flex; align-items: center; gap: 6px; padding: 7px 12px; }
.hmroot .hmtoolgroup + .hmtoolgroup { border-left: 2px solid rgba(5,6,8,0.55); box-shadow: inset 1px 0 0 rgba(163,152,128,0.18); }
.hmroot .hmtool { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-width: 58px; min-height: 58px; padding: 6px 8px 5px; border: 2px solid; border-radius: 0; font-family: inherit;
  font-size: 12px; letter-spacing: 0.12em; text-indent: 0.12em; text-transform: uppercase; color: #e6dec6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); cursor: pointer; }
.hmroot .hmtool .hmtoolicon { width: 22px; height: 22px; filter: drop-shadow(1px 1px 0 #050608); }
.hmroot .hmtool .dlg-key { min-width: 18px; height: 16px; padding: 0 4px; font-size: 11px; letter-spacing: 0.04em; text-indent: 0; }
.hmroot .hmtool:hover, .hmroot .hmtool:focus-visible, .hmroot .hmtool.on { outline: none; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.hmroot .hmtool:disabled { color: #6c6552; text-shadow: none; cursor: default; opacity: 0.7; }
.hmroot .hmfloor { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 92px; padding: 0 6px;
  font-variant-numeric: tabular-nums; }
.hmroot .hmfloornum { font-size: 19px; letter-spacing: 0.04em; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.hmroot .hmfloorof { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.hmroot .hmflooryou { font-size: 11px; letter-spacing: 0.06em; color: #d8cfae; text-shadow: 1px 1px 0 #050608; white-space: nowrap; }
@media (max-width: 860px) { .hmroot .hmtools { bottom: 92px; } .hmroot .hmtool { min-width: 46px; min-height: 50px; } .hmroot .hmtoollabel { display: none; } }
.travelpanel-bar { top: var(--tp-top); min-width: min(720px, 92vw); max-width: calc(100vw - 32px); box-sizing: border-box;
  border: 2px solid; border-radius: 0; align-items: stretch; }
.travelpanel-dest { gap: 3px; padding: 10px 18px 10px 20px; }
.travelpanel-label { font-size: 11px; letter-spacing: 0.2em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.travelpanel-name { font-family: inherit; font-size: 21px; line-height: 1.15; letter-spacing: 0.04em; color: #efe8d6;
  text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.travelpanel.following .travelpanel-name, .travelpanel-bar.following .travelpanel-name { color: ${FRAME_TONES.brassHi}; }
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
/* TV2: the clock held under the spinner while the land loads (systems/travelGovernor.js) - the rate that runs first */
.travelpanel-accel.held { min-width: 92px; color: rgb(236,160,60); }
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
/* ── OW-BLOCK: THE OVERWORLD'S BLOCK ── bottom right, one carved stone, one pixel face; its sections parted by the kit's
   engraved line (a dark cut with the light catching under it) - the kit paints the frame (FRAME_ROLES) */
.tview-bar { font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none;
  font-feature-settings: 'liga' 0, 'clig' 0; color: #d8cfae; border: 2px solid; border-radius: 0; width: 292px; }
.tview-bar > * + * { border-top: 2px solid rgba(5,6,8,0.55); box-shadow: inset 0 1px 0 rgba(163,152,128,0.18); }
.tview-head { padding: 9px 14px 8px; gap: 12px; }
.tview-title, .tview-label { font-size: 11px; letter-spacing: 0.2em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.tview-where { font-size: 13px; line-height: 1.2; letter-spacing: 0.03em; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.tview-trip { font-size: 11px; letter-spacing: 0.03em; color: ${FRAME_TONES.brassHi}; text-shadow: 1px 1px 0 #050608; }
.tview-idle { padding: 10px 14px; }
.tview-idle-name { font-size: 16px; line-height: 1.15; letter-spacing: 0.04em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.tview-idle-sub { font-size: 11px; letter-spacing: 0.04em; color: #8f8772; text-shadow: 1px 1px 0 #050608; }
#travel-view .tview-dock .travelpanel-dest { padding: 10px 14px 5px; }
#travel-view .tview-dock .travelpanel-name { font-size: 17px; }
#travel-view .tview-dock .travelpanel-speed { padding: 3px 0 10px 14px; }
#travel-view .tview-dock .travelpanel-acts { padding: 3px 14px 10px 8px; }
#travel-view .tview-dock .travelpanel-act { min-height: 30px; padding: 4px 10px; font-size: 12px; }
#travel-view .tview-dock > .travelpanel-msg { bottom: calc(100% + 12px); }
.tview-tools { padding: 9px 14px; }
.tview-mode { min-width: 56px; min-height: 30px; padding: 4px 10px; border: 2px solid; border-radius: 0; font-family: inherit;
  font-size: 12px; letter-spacing: 0.12em; text-indent: 0.12em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.tview-mode + .tview-mode { border-left: 2px solid; }
.tview-mode.on { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.tview-map, .tview-back { min-height: 32px; padding: 5px 14px; border: 2px solid; border-radius: 0; font-family: inherit; font-size: 13px;
  letter-spacing: 0.14em; text-indent: 0.14em; color: #e6dec6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.45); }
.tview-map:hover, .tview-map:focus-visible, .tview-back:hover, .tview-back:focus-visible, .tview-mode:hover, .tview-mode:focus-visible {
  outline: none; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.tview-filters { padding: 9px 12px 11px; gap: 5px; }
.tview-filter { border: 2px solid; border-radius: 0; font-family: inherit; font-size: 11px; letter-spacing: 0.05em; padding: 4px 7px;
  color: #8f8772; text-shadow: 1px 1px 0 #050608; }
.tview-filter.on { color: #efe8d6; }
.tview-filter:hover, .tview-filter:focus-visible { outline: none; color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.tview-fdot { width: 8px; height: 8px; border-radius: 0; box-shadow: 0 0 0 1px #050608, 1px 1px 0 1px rgba(0,0,0,0.5); }
.tview-fnum { font-size: 11px; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.tview-foot { padding: 9px 14px 11px; }
.tview-confirm { font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;
  border: 2px solid; border-radius: 0; padding: 16px 22px; gap: 14px; }
.tview-confirm-ask { font-size: 16px; letter-spacing: 0.04em; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.5); }
.tview-confirm-row { font-size: 12px; letter-spacing: 0.04em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.tview-confirm-presses > .tview-mode { min-width: 84px; min-height: 32px; border: 2px solid; border-radius: 0; }
:root[data-plus-theme="stone"] .tview-title, :root[data-plus-theme="stone"] .tview-label { color: #15130f; text-shadow: 1px 1px 0 rgba(255,255,255,0.36); }
:root[data-plus-theme="stone"] .tview-bar > * + * { border-top-color: rgba(5,6,8,0.5); box-shadow: inset 0 1px 0 rgba(255,255,255,0.16); }
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
/** LOOT2 (bible/06-Systems/Loot-Arc.md section 4): an EXALTED Legendary's pips - its three diamonds and a star. */
export const EXALTED_PIPS = `--rar-pips: '\\25c6\\25c6\\25c6\\2605';`;
/** The tiers' custom properties as rules - under `scope` (a descendant selector with its space) or everywhere. LOOT2: and
 *  the Exalted's pips after them, so its rule outranks the Legendary's at the same weight. */
export const rarityVarsCss = (scope = '') => [...Object.entries(RARITY_VARS).map(([k, v]) => `${scope}[data-rarity="${k}"] { ${v} }`),
  `${scope}[data-rarity="legendary"][data-exalted] { ${EXALTED_PIPS} }`].join('\n');
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
.sigil-word { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #9fded2; }
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
.inv-info .sigilbox { margin: 8px 0 10px; }
/* CARD-FIT: THE CARD'S DRESS (ui/sigilCard.js, the default) - two rows: the rune, the stage and the numbers toward the
   next beside them; the five stages as one bar, the stage it grows into filled as far as it has drunk (--fill). */
.sigilbox.compact { margin: 6px 0 8px; padding: 6px 9px 7px; }
.sigilbox.compact .sigil-head { flex-wrap: wrap; row-gap: 2px; margin-bottom: 5px; }
.sigilbox.compact .sigil-rune { width: 16px; height: 16px; }
.sigilbox.compact .sigil-stage { font-size: 13px; }
.sigilbox.compact .sigil-head .sigil-progress { display: block; margin: 0 0 0 auto; font-size: 11px; color: #9fded2;
  white-space: nowrap; text-shadow: 1px 1px 0 #050608; }
.sigilbox.compact .sigil-stages { margin: 0; gap: 4px; }
.sigilbox.compact .sigil-gem { height: 8px; }
.sigilbox.compact .sigil-gem.next { background: linear-gradient(90deg, var(--sigil-mid) 0 var(--fill, 0%), rgba(0,0,0,0.5) var(--fill, 0%)); }
.sigilbox.compact[data-stage="dormant"] .sigil-gem.next { background: linear-gradient(90deg, #6d7b78 0 var(--fill, 0%), rgba(0,0,0,0.5) var(--fill, 0%)); }
.pack-shell .card .sigilbox.compact p.sigil-effect, .sigilbox.compact p.sigil-effect { margin: 5px 0 0; font-size: 12px; }
.pack-shell .card .sigilbox.compact p.sigil-note, .sigilbox.compact p.sigil-note { margin: 3px 0 0; }`;
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
.inv-info .setbox { margin: 8px 0 10px; }
/* CARD-FIT: THE CARD'S DRESS (ui/setCard.js, the default) - the stage rides the head, the places are a thin row, and a
   tier is ONE row: its number, its name and its brief running on as the width allows. The Info box wears the whole. */
.setbox.compact { margin: 6px 0 8px; padding: 6px 9px 6px; }
.setbox.compact .set-name { font-size: 13px; }
.setbox.compact .set-places { margin: 4px 0 4px; gap: 3px; }
.setbox.compact .set-place { height: 6px; }
.pack-shell .card .setbox.compact p.set-stage, .setbox.compact p.set-stage { margin: 0 0 2px; font-size: 11px; color: #d6cab3; }
.setbox.compact .set-tier { margin: 3px 0 0; gap: 6px; align-items: baseline; }
.setbox.compact .set-at { width: 15px; height: 15px; font-size: 11px; align-self: flex-start; }
.setbox.compact .set-tier-body { flex: 1 1 auto; flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: 6px; }
.setbox.compact .set-tier-name { font-size: 11px; }
.setbox.compact .set-tier-text { flex: 1 0 100%; font-size: 12px; line-height: 1.3; }
/* a power's recovery, on its name's line, in the dashed frame the HUD's recovering chip wears */
.setbox.compact .set-tier-every { flex: 0 0 auto; margin-left: auto; padding: 0 3px; font-size: 11px;
  line-height: 13px; color: var(--set-hi); border: 1px dashed var(--set-lo); font-variant-numeric: tabular-nums; }`;
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
.broker-offer { display: grid; grid-template-columns: 48px minmax(0, 1fr) 124px 148px; align-items: center; gap: 10px;   /* SS2: the price's column one width in every row - WB12a: "12 Deadlands Embers" is 120px, "4" 115 - so the prices stand in a line */
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
.broker-card ul.rarity li:first-child { text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #b9ab93; }
.broker-card .setbox p.set-role { margin: 1px 0 6px; font-size: 11px; color: #b9ab93; font-style: italic; text-align: left; }
.broker-card .setbox p.set-stage { margin: 0 0 4px; font-size: 12px; color: #e8dcc6; text-align: left; }
.broker-card .boundline { margin: 8px 0 0; font-size: 12px; letter-spacing: 0.04em; color: #f3cf86; text-shadow: 1px 1px 0 #050608; }   /* SS4: the pack card's own line, on both skins' Broker sheets */
/* WB9g: THE INSIGNIA - its heading under the day's stock, its rows in the wares' own grid, the title's word in its fire,
   the aura's ring turning, and a piece's card with its sign large */
.broker-insignia-head { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; padding: 12px 10px 4px; border-top: 1px solid rgba(243,207,134,0.25); }
.broker-insignia-title { font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #ffb45c; text-shadow: 1px 1px 0 #050608, 0 0 8px rgba(255,107,20,0.45); }
.broker-insig .broker-frame { border-color: #ff8a3d #5a1208 #5a1208 #ff8a3d;
  background: radial-gradient(ellipse at 50% 62%, rgba(255,107,20,0.38), transparent 70%), rgba(20,4,2,0.82); }
.broker-insig.worn .broker-price { color: #ffd152; }
.broker-insig.owned .broker-price { color: #f3cf86; }
.broker-shell .insignia-sign { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; overflow: hidden; }
.broker-shell .insignia-word { font-size: 8px; letter-spacing: 0.01em; white-space: nowrap; }
.broker-shell .insignia-word.mono { font-size: 26px; letter-spacing: 0; line-height: 1; }   /* AUDIT WB9: the row's sign, the word's first letter */
.broker-shell .aura-ring { display: block; width: 30px; height: 30px; border-radius: 50%;
  background: conic-gradient(from 0deg, #ff6b14, #9e0d12, #ffd152, #ff6b14, #9e0d12, #ffd152, #ff6b14);
  -webkit-mask: radial-gradient(circle, transparent 48%, #000 54%, #000 70%, transparent 76%);
  mask: radial-gradient(circle, transparent 48%, #000 54%, #000 70%, transparent 76%);
  filter: drop-shadow(0 0 4px #ff6b14); animation: aura-turn 3.2s linear infinite; }
@keyframes aura-turn { to { transform: rotate(360deg); } }
.broker-shell .insignia-sign.hero { width: 100%; height: 120px; margin: 4px 0 10px; }
.broker-shell .insignia-sign.hero .insignia-word { font-size: 28px; letter-spacing: 0.06em; }
.broker-shell .insignia-sign.hero .aura-ring { width: 110px; height: 110px; filter: drop-shadow(0 0 12px #ff6b14) drop-shadow(0 0 3px #ffd152); }
.broker-insignia-card .insignia-what { margin: 0 0 8px; font-size: 13px; line-height: 1.45; color: #e6dccb; }
.broker-insignia-card .insignia-kept { margin: 0; font-size: 12px; line-height: 1.45; color: #b9ab93; }
@media (prefers-reduced-motion: reduce) { .broker-shell .aura-ring { animation: none; } }
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
/** AUDIT LOOT F6: THE REFORGE'S WINDOW (ui/reforgeWindow.js) - the Broker's shape, so his sheet lays it; these are the rules
 *  his window never needed: the pages' tabs (the chosen one the kit's brass `.on`), the Codex's rows of words alone (his
 *  grid put them in its 48px picture column), the salvage's Keep under its Break, and a card's line with its press. The
 *  classic skin lays it beside his sheet (reforgeWindow.js), the Plus sheet carries it. */
export const REFORGE_CSS = `/* ── LOOT9/LOOT10: THE REFORGE'S WINDOW (ui/reforgeWindow.js) ── */
.reforge-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px 0; }
.reforge-tabs[hidden] { display: none; }
.broker-offer.codex-row, .broker-offer.codex-set { grid-template-columns: minmax(0, 1fr); }
.broker-offer.codex-set { cursor: default; }
.broker-offer.codex-row .broker-set, .broker-offer.codex-set .broker-set { white-space: normal; }   /* a hint and a set's pieces read whole, a phone's too */
.broker-offer.codex-row:not(.found) .broker-name { color: #8d8270; }
.broker-offer > .reforge-keep { grid-column: 4; }
.reforge-card .reforge-line, .imprint-card .imprint-choice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; margin: 2px 0; }
.reforge-card .reforge-press, .imprint-card .imprint-press { width: auto; flex: 0 0 auto; }
@media (max-width: 720px) {
  .reforge-tabs { padding: 6px 12px 0; }
  .broker-offer > .reforge-keep { grid-column: 3; grid-row: 3; }   /* the Broker's phone rule spans every press over two rows: Keep sat on Break it */
}`;
/** BOUNTY1 (2026-09-28): THE BOUNTY BOARD'S WINDOW and the payday notice (ui/bountyWindow.js) - the Broker's kind: a
 *  stone window over the world, the town's notices in a list, the one pressed read whole beside it (under it on a
 *  phone). The kit dresses the window, the card, the rows, the header and the presses (ui/enhancedFrame.js); this is
 *  the layout and the notice's own ink. */
export const BOUNTY_CSS = `/* ── BOUNTY1: THE BOUNTY BOARD ── */
.bounty-shell { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.46); font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; }
.bounty-win { width: min(960px, 96vw); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
  border: 2px solid; background: rgba(14,12,11,0.96); }
.bounty-win.bounty-noticewin { width: min(560px, 94vw); }
.bounty-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 12px 16px; border-bottom: 2px solid rgba(5,6,8,0.6); }
.bounty-title { flex: 1 1 280px; min-width: 0; }
.bounty-title h2 { margin: 0; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe0b8; text-shadow: 2px 2px 0 #050608; }
.bounty-sub { margin: 2px 0 0; font-size: 12px; color: #b9ab93; }
.bounty-note { margin: 4px 0 0; font-size: 12px; color: #e59a8e; }
.bounty-note:empty { display: none; }
.bounty-note.ok { color: #9fe8b4; }
.bounty-close { flex: 0 0 auto; }
.bounty-body { display: flex; gap: 14px; padding: 12px 16px 16px; min-height: 0; overflow: auto; }
.bounty-side { flex: 1 1 50%; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.bounty-posts, .bounty-held { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.bounty-post { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 10px;
  cursor: pointer; border: 1px solid transparent; }
.bounty-post.on { background: linear-gradient(90deg, rgba(243,207,134,0.12), transparent 85%); }
.bounty-post-body { display: flex; flex-direction: column; min-width: 0; }
.bounty-post-title { font-size: 14px; color: #efe8d6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 1px 1px 0 #050608; }
.bounty-post-meta { font-size: 11px; color: #b9ab93; letter-spacing: 0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bounty-state { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #b9ab93; white-space: nowrap; }
.bounty-state.st-open { color: #f3cf86; }
.bounty-state.st-held { color: #9fe8b4; }
.bounty-post.st-paid .bounty-post-title, .bounty-post.st-paid .bounty-state { opacity: 0.55; }
.bounty-empty { padding: 10px; font-size: 13px; color: #b9ab93; font-style: italic; }
.bounty-heldhead { margin: 10px 0 2px; font-family: inherit; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #b9ab93; }
.bounty-heldrow { display: flex; flex-direction: column; padding: 4px 10px; border-left: 2px solid #c08a3e; background: rgba(243,207,134,0.05); }
.bounty-card { flex: 1 1 50%; min-width: 0; margin: 0; padding: 12px 14px; border: 2px solid; align-self: flex-start; }
.bounty-card h3 { margin: 0 0 8px; font-family: inherit; font-size: 16px; color: #efe8d6; }
.bounty-tier { margin: -4px 0 8px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #c9a86a; }
.bounty-story { margin: 0 0 6px; font-size: 13px; line-height: 1.5; color: #e6dccb; }
.bounty-poster { margin: 0 0 8px; font-size: 12px; color: #b9ab93; font-style: italic; text-align: right; }
.bounty-mapline { margin: 0 0 10px; font-size: 12px; color: #f3cf86; text-shadow: 1px 1px 0 #050608; }
.bounty-reward { display: flex; flex-direction: column; gap: 2px; margin: 0 0 8px; padding: 6px 8px; background: rgba(0,0,0,0.3); }
.bounty-reward-head { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #b9ab93; }
.bounty-gold { font-size: 14px; color: #f3cf86; text-shadow: 1px 1px 0 #050608; }
.bounty-itemhint { font-size: 12px; color: #d8ccb6; }
.bounty-progress, .bounty-mates, .bounty-why { margin: 0 0 8px; font-size: 12px; color: #9fe8b4; }
.bounty-why { color: #b9ab93; }
.bounty-acts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.bounty-noticebody { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 16px; overflow: auto; }
.bounty-noticebody .bounty-story { font-size: 14px; }
.bounty-rewardbox { display: flex; flex-direction: column; gap: 3px; align-self: stretch; }
.bounty-rewarditem { font-size: 15px; text-shadow: 1px 1px 0 #050608; }
@media (max-width: 720px) {
  .bounty-shell { padding: 8px; }
  .bounty-body { flex-direction: column; padding: 10px 12px 12px; }
  .bounty-title h2 { font-size: 17px; letter-spacing: 0.08em; }
}
@media (pointer: coarse) { .bounty-post { min-height: 44px; } }`;
/** NOTICE1 (PROF0 10.1): THE NOTICE BOARD (ui/noticeWindow.js) - a corkboard in the stone window: pinned parchment in a
 *  grid, each card tilted a hair, a pin at its head and a wax seal at its foot whose colour says who posted it (the
 *  town bone, the server red, a player amber, a guild steel, the bounty board black), opened large on a press. The kit
 *  dresses the window, the header and the presses (ui/enhancedFrame.js); this is the cork and the parchment. */
export const NOTICE_CSS = `/* ── NOTICE1: THE NOTICE BOARD ── */
.notice-shell { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.46); font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; }
.notice-win { width: min(1040px, 96vw); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
  border: 2px solid; background: rgba(14,12,11,0.96); }
.notice-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 12px 16px 8px; }
.notice-title { flex: 1 1 300px; min-width: 0; }
.notice-title h2 { margin: 0; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe0b8; text-shadow: 2px 2px 0 #050608; }
.notice-sub { margin: 2px 0 0; font-size: 12px; color: #b9ab93; }
.notice-word { margin: 4px 0 0; font-size: 12px; color: #e59a8e; }
.notice-word:empty { display: none; }
.notice-word.ok { color: #9fe8b4; }
.notice-headacts { display: flex; flex-wrap: wrap; gap: 8px; }
.notice-tabs { display: flex; gap: 4px; padding: 0 16px; border-bottom: 2px solid rgba(5,6,8,0.6); }
.notice-tab { padding: 6px 14px 5px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #b9ab93; }
.notice-tab.on { color: #f3cf86; border-bottom: 2px solid #c08a3e; margin-bottom: -2px; }
/* TOAST-SPLIT: the cork and the italic line are the board's own classes - .notice-body and .notice-hint are the HUD
   toasts' (ui/enhancedNotice.js), and a rule on either dressed both. */
.notice-cork { padding: 14px 16px 16px; min-height: 0; overflow: auto;
  background: radial-gradient(circle at 20% 30%, rgba(0,0,0,0.18) 0 1px, transparent 2px) 0 0 / 7px 7px,
    radial-gradient(circle at 70% 60%, rgba(255,220,160,0.05) 0 1px, transparent 2px) 0 0 / 11px 11px,
    linear-gradient(160deg, #5b3f26, #47301c 60%, #3b2816); }
.notice-grid { list-style: none; margin: 0; padding: 4px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.notice-card { position: relative; display: flex; flex-direction: column; gap: 6px; min-height: 150px; padding: 18px 14px 26px;
  cursor: pointer; transform: rotate(var(--tilt, 0deg)); color: #2a1f12;
  background: linear-gradient(175deg, #efe2c2, #e2d1aa 70%, #d6c294); box-shadow: 3px 4px 0 rgba(5,6,8,0.45), inset 0 0 18px rgba(120,84,40,0.25); }
.notice-card:hover, .notice-card:focus-visible { transform: rotate(0deg) scale(1.02); outline: 2px solid #f3cf86; }
.notice-card h4 { margin: 0; font-family: inherit; font-size: 14px; color: #1d150b; }
.notice-snippet { margin: 0; font-size: 12px; line-height: 1.45; white-space: pre-wrap; overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 5; -webkit-box-orient: vertical; }
.notice-foot { margin-top: auto; display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 11px; color: #5a4630; }
.notice-new { padding: 0 5px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #fff4dc; background: #9b2d1f; }
.notice-pin { position: absolute; top: 5px; left: 50%; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #f5d9a0, #9a6a2a 60%, #3c2610); box-shadow: 1px 2px 0 rgba(0,0,0,0.5); }
.notice-seal { position: absolute; right: 10px; bottom: 6px; width: 18px; height: 18px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 45%), var(--seal, #b89b6a);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.18); }
.notice-card.seal-town, .notice-read.seal-town { --seal: #cbb892; }
.notice-card.seal-server, .notice-read.seal-server { --seal: #a3261a; }
.notice-card.seal-player, .notice-read.seal-player { --seal: #c98a2b; }
.notice-card.seal-guild, .notice-read.seal-guild { --seal: #4f6f8f; }
.notice-card.seal-bounty, .notice-read.seal-bounty { --seal: #161311; }
.notice-card.hidden { opacity: 0.6; }
.notice-empty { grid-column: 1 / -1; padding: 12px; font-size: 13px; color: #e6dccb; font-style: italic; text-shadow: 1px 1px 0 #050608; }
.notice-read { position: relative; max-width: 640px; margin: 0 auto; padding: 22px 20px 18px; color: #2a1f12;
  background: linear-gradient(175deg, #efe2c2, #e2d1aa 70%, #d6c294); box-shadow: 4px 5px 0 rgba(5,6,8,0.45), inset 0 0 22px rgba(120,84,40,0.25); }
.notice-read h3 { margin: 0 0 8px; font-family: inherit; font-size: 18px; color: #1d150b; }
.notice-guild { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #34506c; }
.notice-text { margin: 0 0 10px; font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
.notice-meta { margin: 0 0 10px; font-size: 12px; color: #5a4630; font-style: italic; }
.notice-mod { margin: 0 0 10px; font-size: 11px; color: #8a2c1f; }
.notice-acts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.notice-form { max-width: 640px; margin: 0 auto; padding: 18px 18px 16px; display: flex; flex-direction: column; gap: 10px; color: #2a1f12;
  background: linear-gradient(175deg, #efe2c2, #e2d1aa 70%, #d6c294); box-shadow: 4px 5px 0 rgba(5,6,8,0.45); }
.notice-field { display: flex; flex-direction: column; gap: 3px; }
.notice-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #5a4630; }
.notice-input, .notice-textarea, .notice-select { font: inherit; font-size: 14px; color: #1d150b; background: rgba(255,250,236,0.7);
  border: 1px solid #9c8358; padding: 6px 8px; }
.notice-textarea { resize: vertical; min-height: 120px; line-height: 1.45; }
.notice-days { width: 6em; }
.notice-count { align-self: flex-end; font-size: 11px; color: #5a4630; }
.notice-tip { margin: 0; font-size: 12px; color: #5a4630; font-style: italic; }
/* GUILD1e: the Guilds tab - a guild's own notes under its banner, and the town's recruitment posters */
.notice-section { margin: 4px 4px 12px; display: flex; align-items: center; gap: 10px; font-size: 13px; letter-spacing: 0.1em;
  text-transform: uppercase; color: #f3cf86; text-shadow: 1px 1px 0 #050608; }
.notice-section + .notice-grid { margin-bottom: 18px; }
.notice-banner { flex: none; width: 30px; height: auto; filter: drop-shadow(2px 3px 0 rgba(5,6,8,0.45)); }
.notice-poster .notice-banner { width: 38px; align-self: center; }
/* SEAT1b: the Seat tab - the week's clock, the standings (each guild under its banner, the reader's own marked), the
   reader's own lines and the levers (ui/seatTab.js) */
.notice-seat-week, .notice-seat-mine { margin: 4px 6px 10px; font-size: 13px; color: #e6dccb; text-shadow: 1px 1px 0 #050608; }
.notice-standings { list-style: none; margin: 0 4px 14px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.notice-standing { display: flex; align-items: center; gap: 10px; padding: 6px 10px; font-size: 14px; color: #f3ead8;
  background: rgba(5,6,8,0.35); text-shadow: 1px 1px 0 #050608; }
.notice-standing.mine { outline: 1px solid rgba(243,239,44,0.55); }
.notice-standing .notice-banner { width: 26px; }
.notice-seat-levers { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 4px 12px; }
.notice-seat-drakes { width: 7em; }
/* SEAT1c: this week's battle, and the Chronicle */
.notice-seat-battle { margin: 4px 6px 10px; font-size: 13px; color: #f3ef2c; text-shadow: 1px 1px 0 #050608; }
.notice-chronicle { margin: 0 6px 14px 22px; padding: 0; font-size: 13px; color: #e6dccb; line-height: 1.45; text-shadow: 1px 1px 0 #050608; }
@media (max-width: 720px) {
  .notice-shell { padding: 8px; }
  .notice-cork { padding: 10px; }
  .notice-grid { grid-template-columns: 1fr; }
  .notice-title h2 { font-size: 17px; letter-spacing: 0.08em; }
}
@media (pointer: coarse) { .notice-card { min-height: 120px; } }
@media (prefers-reduced-motion: reduce) { .notice-card { transform: none; } .notice-card:hover, .notice-card:focus-visible { transform: none; } }`;
/** ARENA3: THE ARENA WINDOW (ui/arenaWindow.js) - the Notice Board's kind: a stone window over the world, six pages under a
 *  tab bar, the cards panels, the presses the kit's. The banners' colours (`data-banner` red | blue) on the pennants, the
 *  fighters, the rows and the season's split bar; brass for the chosen and for what you have won. Its classes are `aw-`
 *  (the bout's HUD's are `arena-`). The kit dresses the window, the header, the cards, the presses and the chips
 *  (ui/enhancedFrame.js); this is the layout and the arena's own ink. The classic skin lays it with the kit cut to it. */
export const ARENA_WINDOW_CSS = `/* ── ARENA3: THE ARENA WINDOW ── */
.aw-shell { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.5); font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; color: #efe8d6; }
.aw-win { --red: #c23a2b; --red-hi: #f2a597; --red-lo: #6e1a12; --blue: #3768b8; --blue-hi: #a9c8f2; --blue-lo: #172f5c;
  --brass: #c08a3e; --brass-hi: #f3cf86; --bone: #efe8d6; --mute: #b9ab93;
  position: relative; width: min(1040px, 96vw); height: min(760px, 92vh); display: flex; flex-direction: column; overflow: hidden;
  border: 2px solid; background: rgba(14,12,11,0.97); }
.aw-win[data-banner="red"] { box-shadow: inset 0 3px 0 -1px var(--red); }
.aw-win[data-banner="blue"] { box-shadow: inset 0 3px 0 -1px var(--blue); }
.aw-pennant { display: inline-block; flex: 0 0 auto; width: 9px; height: 13px; vertical-align: -2px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 74%, 0 100%); background: #5d5447; box-shadow: 1px 1px 0 #050608; }
.aw-pennant[data-banner="red"] { background: linear-gradient(180deg, var(--red-hi) 0 2px, var(--red) 2px 70%, var(--red-lo)); }
.aw-pennant[data-banner="blue"] { background: linear-gradient(180deg, var(--blue-hi) 0 2px, var(--blue) 2px 70%, var(--blue-lo)); }
.aw-pennant[data-banner=""] { background: linear-gradient(180deg, #8d8270 0 2px, #4a4237 2px); }
.aw-head { flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 16px 10px; border-bottom: 2px solid rgba(5,6,8,0.6); }
.aw-crest { width: 26px; height: 38px; }
.aw-title { flex: 1 1 300px; min-width: 0; }
.aw-title h2 { margin: 0; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe0b8; text-shadow: 2px 2px 0 #050608; }
.aw-sub { margin: 2px 0 0; font-size: 12px; color: var(--mute); }
.aw-note { margin: 4px 0 0; font-size: 12px; color: #e59a8e; }
.aw-note:empty { display: none; }
.aw-note.ok { color: var(--brass-hi); }
.aw-id { order: 3; flex: 1 1 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0;
  padding: 7px 0 0 42px; border-top: 1px solid rgba(243,207,134,0.14); }
.aw-name { font-size: 15px; color: var(--bone); text-shadow: 1px 1px 0 #050608; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-rec { margin-left: auto; }
.aw-rec { font-size: 12px; color: var(--mute); white-space: nowrap; }
.aw-chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; font-size: 11px; letter-spacing: 0.08em; white-space: nowrap;
  color: var(--bone); border: 1px solid #5a5446; background: rgba(5,6,8,0.55); }
.aw-titlechip { color: var(--brass-hi); border-color: #7a5424; text-transform: uppercase; }
.aw-bannerchip.b-red { color: var(--red-hi); border-color: var(--red); }
.aw-bannerchip.b-blue { color: var(--blue-hi); border-color: var(--blue); }
.aw-laurel { color: #d9f0a8; border-color: #6f8a32; text-transform: uppercase; }
.aw-laurel::before { content: ''; width: 9px; height: 9px; border-radius: 50% 50% 50% 0; border: 2px solid #9cc04a; border-right-color: transparent; border-bottom-color: transparent; transform: rotate(-45deg); }
.aw-close { flex: 0 0 auto; align-self: flex-start; }
.aw-tabs { flex: 0 0 auto; display: flex; gap: 4px; padding: 8px 16px 0; border-bottom: 2px solid rgba(5,6,8,0.6); overflow-x: auto; scrollbar-width: none; }
.aw-tabs::-webkit-scrollbar { display: none; }
.aw-tab { flex: 0 0 auto; padding: 6px 14px 5px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: -2px; }
.aw-tab.on { color: var(--brass-hi); }
.aw-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; }
.aw-card { margin: 0; padding: 12px 14px; border: 2px solid; min-width: 0; }
.aw-card h3 { margin: 0; font-family: inherit; font-size: 15px; letter-spacing: 0.06em; color: #efe0b8; text-shadow: 1px 1px 0 #050608; }
.aw-card h4 { margin: 10px 0 6px; font-family: inherit; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mute); }
.aw-cardhead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 10px; margin-bottom: 8px; }
.aw-state { color: var(--brass-hi); border-color: #7a5424; }
.aw-line { margin: 6px 0 0; font-size: 13px; line-height: 1.45; color: #e6dccb; }
.aw-gives { color: var(--brass-hi); }
.aw-warn { color: #e8b0a4; }
.aw-empty { margin: 8px 0 0; font-size: 13px; color: var(--mute); font-style: italic; }
.aw-cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.aw-bout-card.k-exhibition { grid-column: 1 / -1; }
.aw-tierline { margin: -4px 0 8px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mute); }
.aw-versus { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 10px; }
.aw-fighter { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 12px; border: 1px solid #3a352a; background: rgba(5,6,8,0.4); }
.aw-fighter[data-banner="red"] { border-left: 3px solid var(--red); background: linear-gradient(90deg, rgba(194,58,43,0.16), rgba(5,6,8,0.4) 60%); }
.aw-fighter[data-banner="blue"] { border-right: 3px solid var(--blue); text-align: right; align-items: flex-end;
  background: linear-gradient(270deg, rgba(55,104,184,0.18), rgba(5,6,8,0.4) 60%); }
.aw-fname { display: flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%; }
.aw-fighter[data-banner="blue"] .aw-fname { flex-direction: row-reverse; }
.aw-fn { font-size: 15px; color: var(--bone); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 1px 1px 0 #050608; }
.aw-fbill, .aw-fkind { font-size: 11px; color: var(--mute); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-fnums { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.aw-fighter[data-banner="blue"] .aw-fnums { justify-content: flex-end; }
.aw-odds { color: var(--brass-hi); border-color: #7a5424; font-variant-numeric: tabular-nums; }
.aw-fav { color: #d9f0a8; border-color: #6f8a32; text-transform: uppercase; }
.aw-vs { align-self: center; font-size: 13px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--brass-hi); text-shadow: 1px 1px 0 #050608; }
.aw-wagerline { margin: 8px 0 0; font-size: 12px; color: var(--brass-hi); }
.aw-opp { margin: 0; font-size: 14px; color: var(--bone); }
.aw-acts { display: flex; flex-wrap: wrap; gap: 8px 10px; margin-top: 10px; }
.aw-press { display: inline-flex; flex-direction: column; gap: 3px; }
.aw-act { min-width: 96px; }
.aw-why { font-size: 11px; color: var(--mute); max-width: 180px; }
.aw-wager { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding: 10px; border: 1px dashed #7a5424; background: rgba(243,207,134,0.04); }
.aw-wager-sides, .aw-stakes { display: flex; flex-wrap: wrap; gap: 6px; }
.aw-side[data-banner="red"].on { box-shadow: inset 3px 0 0 var(--red); }
.aw-side[data-banner="blue"].on { box-shadow: inset 3px 0 0 var(--blue); }
.aw-stake { min-width: 64px; }
.aw-place { align-self: flex-start; }
.aw-owed { margin: 0; padding: 6px 10px; font-size: 13px; color: var(--brass-hi); border-left: 2px solid var(--brass); background: rgba(243,207,134,0.06); }
/* ARENA4: online - the bouts on the sand now, the challenge's offer, the rating and rank chips */
.aw-live { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.aw-liveb { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 6px 8px;
  border-left: 2px solid #3a352a; background: rgba(5,6,8,0.38); }
.aw-liveb[data-kind="pvp"] { border-left-color: #e05a3a; }
.aw-livewho { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.aw-livef { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; }
.aw-livemeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; grid-column: 1; font-size: 11px; color: var(--mute); }
.aw-liveb .aw-acts { grid-column: 2; grid-row: 1 / span 2; margin: 0; }
.aw-offer { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; padding: 8px 10px; border: 1px solid #e05a3a; background: rgba(224,90,58,0.08); }
.aw-rating { color: #cfe3ff; border-color: #4a6a98; font-variant-numeric: tabular-nums; }
.aw-rankchip { color: var(--brass-hi); border-color: #7a5424; }
.aw-rankchip.champ { color: #d9f0a8; border-color: #6f8a32; }
.aw-champline { padding: 4px 8px; border-left: 2px solid #6f8a32; background: rgba(111,138,50,0.1); }
.aw-online { color: #cfe3ff; }
@media (max-width: 520px) { .aw-liveb { grid-template-columns: minmax(0, 1fr); } .aw-liveb .aw-acts { grid-column: 1; grid-row: auto; } }
/* the ladder: the ten tiers as a column, the one picked whole beside it */
.aw-ladder { display: grid; grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1.4fr); gap: 14px; align-items: start; }
.aw-tiers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column-reverse; gap: 3px; }
.aw-tier { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; gap: 0 8px;
  padding: 5px 8px; cursor: pointer; border: 1px solid transparent; }
.aw-tier.on { background: linear-gradient(90deg, rgba(243,207,134,0.14), transparent 85%); }
.aw-tiern { grid-row: 1 / span 2; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; font-size: 13px;
  color: var(--mute); border: 1px solid #4a4438; background: rgba(5,6,8,0.6); }
.aw-tier[data-state="cleared"] .aw-tiern { color: #1d150b; background: linear-gradient(180deg, var(--brass-hi), var(--brass)); border-color: #5c3f1a; }
.aw-tier[data-state="current"] .aw-tiern { color: var(--brass-hi); border-color: var(--brass); box-shadow: 0 0 6px rgba(243,207,134,0.35); }
.aw-tiername { font-size: 14px; color: var(--bone); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-tier[data-state="locked"] .aw-tiername { color: #8d8270; }
.aw-tierstate { grid-column: 3; grid-row: 1 / span 2; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mute); }
.aw-tier[data-state="current"] .aw-tierstate { color: var(--brass-hi); }
.aw-pips { display: inline-flex; align-items: center; gap: 4px; }
.aw-pips i { width: 7px; height: 7px; transform: rotate(45deg); background: rgba(0,0,0,0.6); border: 1px solid #5d5245; }
.aw-pips i.on { background: var(--brass-hi); border-color: #5c3f1a; }
.aw-pips i.crown { width: 9px; height: 9px; margin-left: 3px; }
.aw-pips i.crown.on { background: #e05a3a; border-color: #ffb08e; box-shadow: 0 0 4px rgba(224,90,58,0.6); }
.aw-tierbouts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.aw-tb { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 8px; align-items: baseline; padding: 5px 8px; font-size: 13px;
  border-left: 2px solid #3a352a; background: rgba(5,6,8,0.35); }
.aw-tb.won { border-left-color: var(--brass); }
.aw-tb.next { border-left-color: #e05a3a; background: rgba(224,90,58,0.08); }
.aw-tb.champ .aw-tbl { color: #ffb08e; }
.aw-tbl { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mute); }
.aw-tbo { color: var(--bone); }
.aw-tbm { font-size: 11px; color: var(--brass-hi); text-transform: uppercase; letter-spacing: 0.08em; }
.aw-tb.next .aw-tbm { color: #ffb08e; }
.aw-chips { display: flex; flex-wrap: wrap; gap: 6px; }
/* the team: the season's split, the banner, the roster */
.aw-split-nums { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; font-size: 14px; font-variant-numeric: tabular-nums; }
.aw-split-n { display: inline-flex; align-items: center; gap: 6px; }
.aw-split-n.b-red { color: var(--red-hi); }
.aw-split-n.b-blue { color: var(--blue-hi); flex-direction: row-reverse; }
.aw-split { position: relative; height: 14px; border: 2px solid; border-color: #25221b #6e6755 #9a9079 #3a352a;
  background: linear-gradient(180deg, var(--blue-hi) 0 2px, var(--blue) 2px 9px, var(--blue-lo)); }
.aw-split-red { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(180deg, var(--red-hi) 0 2px, var(--red) 2px 9px, var(--red-lo)); }
.aw-split-mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--brass-hi); box-shadow: 0 0 0 1px #050608; }
.aw-bannerhead { display: flex; align-items: center; gap: 12px; }
.aw-flag { width: 28px; height: 42px; }
.aw-bannerwords { flex: 1 1 auto; min-width: 0; }
.aw-motto { margin: 2px 0 0; font-size: 12px; font-style: italic; color: var(--mute); }
.aw-bannercard[data-banner="red"] { box-shadow: inset 3px 0 0 var(--red); }
.aw-bannercard[data-banner="blue"] { box-shadow: inset 3px 0 0 var(--blue); }
.aw-mini { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.aw-mini li { display: flex; justify-content: space-between; gap: 8px; }
.aw-pts { color: var(--brass-hi); font-variant-numeric: tabular-nums; }
.aw-stats { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
.aw-stat { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid #3a352a; background: rgba(5,6,8,0.45); }
.aw-stat .k { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mute); }
.aw-stat .v { font-size: 18px; color: var(--bone); font-variant-numeric: tabular-nums; text-shadow: 1px 1px 0 #050608; }
/* the boards */
.aw-subtabs { display: flex; flex-wrap: wrap; gap: 6px; }
.aw-subtab { font-size: 12px; }
.aw-boardsub { margin: 2px 0 10px; font-size: 12px; color: var(--mute); }
.aw-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.aw-table th { padding: 4px 8px; text-align: left; font-size: 11px; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mute);
  border-bottom: 1px solid rgba(243,207,134,0.25); }
.aw-table td { padding: 5px 8px; border-bottom: 1px solid rgba(5,6,8,0.6); white-space: nowrap; }
.aw-rank { width: 36px; color: var(--mute); }
.aw-row:nth-child(-n+3) .aw-rank { color: var(--brass-hi); }
.aw-table .aw-nm { width: 46%; }
.aw-who { display: flex; align-items: center; gap: 6px; min-width: 0; max-width: 360px; }
.aw-who .aw-n { overflow: hidden; text-overflow: ellipsis; }
.aw-home { font-size: 11px; color: #8d8270; overflow: hidden; text-overflow: ellipsis; }
.aw-row.you td { background: rgba(243,207,134,0.1); color: var(--brass-hi); }
.aw-row.you td:first-child { box-shadow: inset 2px 0 0 var(--brass-hi); }
.aw-gap td { padding: 0 8px; color: #8d8270; text-align: center; letter-spacing: 0.3em; }
/* the records */
.aw-bouts { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.aw-bout { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 5px 8px;
  border-left: 2px solid #3a352a; background: rgba(5,6,8,0.35); }
.aw-bout.won { border-left-color: var(--brass); }
.aw-bout.lost { border-left-color: #8a2820; }
.aw-res { justify-content: center; text-transform: uppercase; }
.aw-res.won { color: var(--brass-hi); border-color: #7a5424; }
.aw-res.lost { color: #ff9a8a; border-color: #7a2a24; }
.aw-boutwhat { display: flex; flex-direction: column; min-width: 0; }
.aw-bo { font-size: 13px; color: var(--bone); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-bt { font-size: 11px; color: var(--mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-bouttail { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font-size: 11px; color: var(--mute); white-space: nowrap; }
.aw-bp { color: var(--brass-hi); }
.aw-bpts { color: #d9f0a8; }
/* ARENA5: a kept bout's Watch the replay, under its row - a small press, so a kept row stays a row */
.aw-boutacts { grid-column: 2 / -1; display: flex; justify-content: flex-end; margin-top: -4px; }
body .aw-shell .aw-boutacts .act { min-width: 0; padding: 3px 12px; font-size: 12px; }
.aw-wagerlist { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
.aw-wl { padding: 3px 8px; border-left: 2px solid #3a352a; }
.aw-wl.s-won { border-left-color: var(--brass); color: var(--brass-hi); }
.aw-wl.s-lost { color: var(--mute); }
.aw-wl.s-open { border-left-color: #e05a3a; }
/* the rules */
.aw-rules { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.aw-rule ul { margin: 8px 0 0; padding: 0 0 0 16px; display: flex; flex-direction: column; gap: 5px; font-size: 13px; line-height: 1.45; color: #e6dccb; }
.aw-rule li::marker { color: var(--brass); }
@media (max-width: 720px) {
  .aw-shell { padding: 6px; }
  .aw-win { width: 100%; height: 96vh; }
  .aw-head { padding: 10px 12px 8px; gap: 6px 10px; }
  .aw-crest { width: 18px; height: 27px; }
  .aw-title { flex: 1 1 0; }
  .aw-close { padding-left: 10px; padding-right: 10px; }
  .aw-title h2 { font-size: 16px; letter-spacing: 0.06em; }
  .aw-id { padding-left: 0; }
  .aw-rec { margin-left: 0; }
  .aw-tabs { padding: 6px 10px 0; }
  .aw-tab { padding: 6px 10px 5px; letter-spacing: 0.08em; }
  .aw-body { padding: 10px 10px 14px; }
  .aw-cards, .aw-rules { grid-template-columns: minmax(0, 1fr); }
  .aw-versus { grid-template-columns: minmax(0, 1fr); }
  .aw-vs { justify-self: center; }
  .aw-fighter[data-banner="blue"] { text-align: left; align-items: flex-start; border-right: 1px solid #3a352a; border-left: 3px solid var(--blue); }
  .aw-fighter[data-banner="blue"] .aw-fname { flex-direction: row; }
  .aw-fighter[data-banner="blue"] .aw-fnums { justify-content: flex-start; }
  .aw-ladder { grid-template-columns: minmax(0, 1fr); }
  .aw-tb { grid-template-columns: minmax(0, 1fr) auto; }
  .aw-tbl { grid-column: 1 / -1; }
  .aw-table { table-layout: fixed; }
  .aw-table .opt { display: none; }
  .aw-table td, .aw-table th { padding: 5px 4px; overflow: hidden; text-overflow: ellipsis; }
  .aw-table th:first-child, .aw-rank { width: 30px; }
  .aw-table .aw-nm { width: 48%; }
  .aw-home { display: none; }
  .aw-bout { grid-template-columns: 52px minmax(0, 1fr); }
  .aw-bouttail { grid-column: 2; flex-direction: row; flex-wrap: wrap; gap: 2px 8px; justify-content: flex-start; white-space: normal; }
  .aw-boutacts { grid-column: 2; justify-content: flex-start; }
}
@media (pointer: coarse) { .aw-tier, .aw-tab, .aw-subtab, .aw-stake, .aw-side, .aw-boutacts .aw-act { min-height: 40px; } }
@media (prefers-reduced-motion: reduce) { .aw-tier, .aw-card { transition: none; } }`;

/** PROF1 (PROF0 8, 21): THE PROFESSIONS' FACES - the Work tab's writs on the Notice Board (the Court's purple seal), the
 *  Professions and Stores pages on the character sheet's rail, and in the world the prompt, the act's meter, the toasts,
 *  the day's chip under the compass and the rank's banner. The stone, the brass and the bone of the rest; the meters'
 *  still forms under the system's reduced motion. */
export const PROF_CSS = `/* ── PROF1: THE PROFESSIONS ── */
.notice-tab { cursor: pointer; background: none; border: 0; font: inherit; }
.notice-card.seal-court, .notice-read.seal-court { --seal: #6b3fa0; }
.notice-writ { cursor: default; }
.notice-writ .writ-kind { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #5b3c86; }
.notice-writ .writ-need { margin: 0; font-size: 15px; color: #1d150b; }
.notice-writ .writ-pay, .notice-writ .writ-left { margin: 0; font-size: 12px; color: #4a3a25; }
.notice-writ .writ-take { display: flex; align-items: center; gap: 8px; margin-top: auto; font-size: 11px; color: #5a4630; }
.notice-writ.done { opacity: 0.62; }
.notice-worktoday { margin: 10px 0 0; font-size: 12px; letter-spacing: 0.08em; color: #e6dccb; text-shadow: 1px 1px 0 #050608; }
.prof-cols { display: grid; grid-template-columns: minmax(180px, 0.9fr) 1.4fr; gap: 14px; }
.prof-list { display: flex; flex-direction: column; gap: 4px; }
.prof-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 4px 8px; text-align: left; font: inherit; font-size: 12px;
  color: var(--bone, #e9e4d9); background: rgba(10,8,6,0.55); border: 1px solid rgba(192,138,62,0.25); cursor: pointer; }
.prof-row .px-meter { grid-column: 1 / -1; height: 5px; }
.prof-row.on { border-color: var(--brass, #c08a3e); background: rgba(192,138,62,0.16); }
.prof-rank { color: #b9ab93; font-size: 11px; }
.prof-pane { min-width: 0; }
.prof-title { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.prof-title h3 { margin: 0; font-size: 16px; letter-spacing: 0.1em; text-transform: uppercase; color: #efe0b8; }
.prof-rankline, .prof-xp, .prof-today, .prof-limit { font-size: 12px; color: #b9ab93; }
.prof-xp, .prof-today, .prof-limit { margin: 4px 0; }
.prof-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.prof-spec { display: flex; flex-direction: column; gap: 4px; padding: 8px; text-align: left; font: inherit; font-size: 12px; color: #d9cfbd;
  background: rgba(10,8,6,0.6); border: 1px solid rgba(192,138,62,0.3); cursor: pointer; }
.prof-spec b { color: #f3cf86; letter-spacing: 0.06em; }
.prof-spec.on { border-color: var(--brass, #c08a3e); box-shadow: inset 0 0 0 1px rgba(243,207,134,0.5); }
.prof-spec.coming { border-style: dashed; }
.prof-spec:disabled { cursor: default; opacity: 0.72; }
.prof-spec.on:disabled { opacity: 1; }
.prof-cost { font-style: normal; font-size: 11px; color: #e8b872; }
.prof-locked { opacity: 0.55; }
.prof-word { margin: 8px 0 0; font-size: 12px; color: #e59a8e; }
.prof-gentle { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 12px; color: #b9ab93; cursor: pointer; }
.prof-storehead { display: flex; gap: 8px; margin: 4px 0 6px; }
.prof-search, .prof-sort, .prof-qty { font: inherit; font-size: 12px; color: #1d150b; background: rgba(255,250,236,0.85); border: 1px solid #9c8358; padding: 4px 6px; }
.prof-search { flex: 1 1 auto; min-width: 0; }
.prof-qty { width: 5.5em; }
.prof-families { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; }
.prof-family { font: inherit; font-size: 11px; padding: 3px 8px; color: #b9ab93; background: rgba(10,8,6,0.55); border: 1px solid rgba(192,138,62,0.25); cursor: pointer; }
.prof-family.on { color: #f3cf86; border-color: var(--brass, #c08a3e); }
.prof-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 6px; }
.prof-mat { display: grid; grid-template-columns: 1fr auto; gap: 2px 6px; padding: 6px 8px; text-align: left; font: inherit; font-size: 12px;
  color: var(--bone, #e9e4d9); background: rgba(10,8,6,0.6); border: 1px solid rgba(192,138,62,0.25); cursor: pointer; }
.prof-mat.on { border-color: var(--brass, #c08a3e); background: rgba(192,138,62,0.16); }
.prof-count { color: #f3cf86; font-variant-numeric: tabular-nums; }
.prof-split { grid-column: 1 / -1; font-size: 11px; color: #9d917d; }
.prof-matbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0 4px; font-size: 12px; color: #d9cfbd; }
.prof-smelt { display: grid; grid-template-columns: minmax(0, 1fr) 64px auto; align-items: center; gap: 4px 8px;
  padding: 4px 0; border-bottom: 1px solid rgba(192,138,62,0.18); font-size: 12px; color: #d9cfbd; }
.prof-smelt b { color: #efe0b8; font-weight: normal; }
/* AUDIT 32 P7: the name, the count and the button one row, the inputs under them - placed, never flowed: the inputs line
   spanned its row and pushed the count and the button into the name's and the count's tracks (a 220px button, a 0px
   fourth track; on a phone the button in the 64px track, 30px past the pane). The pause window's pane is 428px at 800,
   so the rows are the phone's everywhere, as they always drew. */
.prof-smelt b { grid-column: 1; grid-row: 1; } .prof-smelt .prof-qty { grid-column: 2; grid-row: 1; }
.prof-smelt .act { grid-column: 3; grid-row: 1; } .prof-smelt .prof-split { grid-column: 1 / -1; grid-row: 2; }
@media (max-width: 560px) { .prof-smelt .act { min-width: 0; } }
/* PROF3: the anvil - its recipes, a recipe's inputs, and the heat (a bar the glow's marker runs along, the band on it) */
.prof-metals { margin-top: 4px; }
.prof-recipe { display: grid; grid-template-columns: 1fr auto; width: 100%; gap: 2px 8px; padding: 4px 8px; margin: 2px 0; text-align: left; font: inherit;
  font-size: 12px; color: var(--bone, #e9e4d9); background: rgba(10,8,6,0.6); border: 1px solid rgba(192,138,62,0.25); cursor: pointer; }
.prof-recipe.on { border-color: var(--brass, #c08a3e); background: rgba(192,138,62,0.16); }
.prof-recipe b { color: #efe0b8; font-weight: normal; }
.prof-recipe .prof-split { grid-column: auto; }
.prof-craft { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; padding: 8px; font-size: 12px; color: #d9cfbd;
  border: 1px solid rgba(192,138,62,0.3); background: rgba(10,8,6,0.5); }
.prof-craft > b { color: #efe0b8; font-weight: normal; }
.prof-input { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.prof-input.prof-short { color: #d98b6e; }
.prof-heat { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }
.prof-heatword { flex: 1 1 100%; color: #efe0b8; }
.prof-heatbar { --heat: 0; position: relative; flex: 1 1 220px; height: 18px; border: 1px solid rgba(192,138,62,0.5);
  background: linear-gradient(90deg, #2a1a12, #7a2e10 45%, #d86a18 70%, #f6d58a 88%, #fff6e0);
  box-shadow: 0 0 calc(var(--heat) * 14px) rgba(246,160,60, calc(var(--heat) * 0.8)); }
.prof-heatband { position: absolute; top: -3px; bottom: -3px; border: 2px solid #efe0b8; box-sizing: border-box; }
.prof-heatmark { position: absolute; top: -5px; bottom: -5px; width: 3px; margin-left: -1px; background: #fff; }
.prof-heatbar.prof-inband .prof-heatband { border-color: #fff6e0; box-shadow: 0 0 6px #f6d58a; }
.prof-strikes { display: flex; gap: 4px; font-size: 14px; color: #6f6456; }
.prof-strike.hit { color: #f6d58a; }
.prof-strike.miss { color: #d98b6e; }
@media (prefers-reduced-motion: reduce) { .prof-heatbar { box-shadow: none; } }
/* PROF11: the mason's bench - a work's two buttons in the row's button track; the chisel's stone, its scored lines
   across it, the marked one lit (a shape as well as a colour: its line doubled), the chisel's own line framed */
.prof-smelt .prof-workacts { grid-column: 3; grid-row: 1; display: flex; gap: 4px; }
.prof-stone { flex: 1 1 100%; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px;
  background: linear-gradient(180deg, #8a8478, #6c675d 60%, #57534b); border: 1px solid rgba(192,138,62,0.5); }
.prof-chisel-line { position: relative; height: 22px; padding: 0 6px; text-align: left; font: inherit; font-size: 11px; color: #2a2620;
  background: transparent; border: 0; border-bottom: 2px dashed rgba(40,36,30,0.55); cursor: pointer; }
.prof-chisel-line.marked { border-bottom: 4px double #f6d58a; color: #fff6e0; text-shadow: 0 0 4px #f6d58a; }
.prof-chisel-line.at { outline: 2px solid #efe0b8; outline-offset: -2px; }
.prof-stone.prof-inband { box-shadow: 0 0 6px #f6d58a; }
@media (pointer: coarse) { .prof-chisel-line { height: 40px; } }
/* PROF9: the pan on the fire - its bar runs raw to burnt (a pale dough, a browned crust, the char), the heat's window
   and marker over it; the window a shape as well as a colour (its edged band) */
.prof-heatbar.prof-panbar { background: linear-gradient(90deg, #d9c9a0, #c79a58 40%, #9a5a24 62%, #5a2a14 82%, #1a0e08); }
/* PROF10: the facet - the dial runs the stone's whole turn (dark stone, the light's window an edged band on it, the
   bearing's marker), the stone itself turning beside it; under reduced motion it stands still */
.prof-heatbar.prof-facetbar { background: linear-gradient(90deg, #2a3040, #4a5a78 50%, #2a3040); }
.prof-gem { display: inline-block; min-width: 1.6em; text-align: center; color: #cfe3ff; font-weight: bold; }
@media (pointer: coarse) { .prof-recipe { min-height: 40px; } }
.prof-matline { flex: 1 1 220px; }
@media (max-width: 720px) { .prof-cols { grid-template-columns: 1fr; } .prof-specs { grid-template-columns: 1fr; } }
@media (pointer: coarse) { .prof-row, .prof-mat, .prof-spec, .prof-family { min-height: 40px; } }
/* in the world */
.prof-prompt { position: fixed; left: 50%; bottom: calc(96px * var(--hud-scale, 1)); transform: translateX(-50%); z-index: 12; pointer-events: none;
  padding: 4px 12px; font-family: ${PIXEL_STACK}; font-size: calc(14px * var(--hud-scale, 1)); color: #efe0b8;
  width: max-content; max-width: calc(100vw - 24px); box-sizing: border-box; white-space: normal; text-align: center;
  background: rgba(10,8,6,0.72); border: 1px solid rgba(192,138,62,0.5); text-shadow: 1px 1px 0 #050608; }
/* AUDIT 32 P9: a body's prompt ran off both edges of a phone (490-742px, nowrap) - it wraps inside the screen now, and the
   choice key's line stands on its own under the verb */
@media (max-width: 560px) { .prof-prompt .prof-alt { display: block; } }
.prof-prompt:empty { display: none; }
.prof-prompt kbd { font: inherit; color: #f3cf86; }
.prof-prompt .dim { color: #b9ab93; }
.prof-meter { position: fixed; left: 50%; top: 50%; z-index: 12; pointer-events: none; transform: translate(-50%, 28px);
  width: calc(160px * var(--hud-scale, 1) * var(--prof-meter-scale, 1)); font-family: ${PIXEL_STACK};
  font-size: calc(11px * var(--hud-scale, 1)); color: #efe0b8; text-align: center; text-shadow: 1px 1px 0 #050608; }
.prof-meter[hidden] { display: none; }
@media (pointer: coarse) { .prof-meter { --prof-meter-scale: 1.3; } }
.prof-bar { position: relative; height: calc(8px * var(--hud-scale, 1)); background: rgba(5,6,8,0.8); box-shadow: 0 0 0 1px #050608; }
.prof-bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(180deg, #f5dfa8 0 1px, #c08a3e 1px); }
.prof-meter.bruised .prof-bar > i { background: linear-gradient(180deg, #f5bdb4 0 1px, #b5553f 1px); }
.prof-meter .prof-hint { margin-top: 3px; }
.prof-leaves { position: relative; height: calc(80px * var(--hud-scale, 1)); margin-bottom: 4px;
  background: radial-gradient(circle at 30% 40%, rgba(74,110,48,0.9), rgba(38,58,26,0.92) 60%), #263a1a; box-shadow: 0 0 0 2px #050608; }
.prof-glint { position: absolute; width: 16%; aspect-ratio: 1; margin: -8% 0 0 -8%; border-radius: 50%;
  background: radial-gradient(circle, #fff6d8 0 20%, rgba(243,207,134,0.8) 35%, transparent 70%); animation: prof-glint 0.5s ease-in-out infinite alternate; }
@keyframes prof-glint { from { transform: scale(0.8); } to { transform: scale(1.1); } }
.prof-finds { letter-spacing: 0.2em; }
.prof-face { position: relative; height: calc(64px * var(--hud-scale, 1)); margin-bottom: 4px;
  background: radial-gradient(circle at 40% 35%, rgba(112,104,94,0.92), rgba(58,54,50,0.94) 65%), #3a3632; box-shadow: 0 0 0 2px #050608; }
.prof-point { position: absolute; width: 4%; aspect-ratio: 1; margin: -2% 0 0 -2%; border-radius: 50%; background: rgba(239,224,184,0.45); }
/* AUDIT 32 P11: the trace's line through its points, and its first point marked */
.prof-line { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.prof-line polyline { fill: none; stroke: rgba(239,224,184,0.35); stroke-width: 1px; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.prof-point.first { width: 6%; margin: -3% 0 0 -3%; background: #f3cf86; box-shadow: 0 0 0 1px #050608; }
.prof-face.prof-traceface .prof-glint { width: 9%; margin: -4.5% 0 0 -4.5%; }   /* a passed point lit, each its own at nine to a line */
.prof-face .prof-glint { width: 22%; margin: -11% 0 0 -11%; }
.prof-aim { position: absolute; width: 10%; aspect-ratio: 1; margin: -5% 0 0 -5%; border: 1px solid #efe0b8; box-sizing: border-box;
  box-shadow: 0 0 0 1px #050608; }
.prof-meter.struck-glint .prof-face { box-shadow: 0 0 0 2px #050608, 0 0 6px 2px rgba(243,207,134,0.8); }
.prof-ring { position: relative; width: calc(64px * var(--hud-scale, 1)); height: calc(64px * var(--hud-scale, 1)); margin: 0 auto 4px;
  border-radius: 50%; background-color: #4a3524; box-shadow: 0 0 0 2px #050608; }
.prof-notch, .prof-ringline { position: absolute; left: 50%; top: 50%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%;
  box-sizing: border-box; }
.prof-notch { border: 2px solid #050608; background: #2a1d12; }
.prof-ringline { border: 2px solid #efe0b8; box-shadow: 0 0 0 1px #050608; }
.prof-ring.in-band .prof-ringline { border-color: #f3cf86; box-shadow: 0 0 0 1px #050608, 0 0 6px 1px rgba(243,207,134,0.9); }
.prof-meter.clean-cut .prof-ring { box-shadow: 0 0 0 2px #050608, 0 0 6px 2px rgba(243,207,134,0.8); }
.prof-ringbar { position: relative; height: calc(10px * var(--hud-scale, 1)); margin-bottom: 4px; background: rgba(5,6,8,0.8); box-shadow: 0 0 0 1px #050608; }
.prof-ringband { position: absolute; top: 0; bottom: 0; background: rgba(243,207,134,0.45); }
.prof-ringmark { position: absolute; top: -2px; bottom: -2px; width: 2px; margin-left: -1px; background: #efe0b8; }
/* PROF8: the net's haul - the tension band on the bar, the weight on it; the tug's flash */
.prof-haulbar { position: relative; height: calc(12px * var(--hud-scale, 1)); margin-bottom: 4px; background: rgba(5,6,8,0.8); box-shadow: 0 0 0 1px #050608; }
.prof-haulband { position: absolute; top: 0; bottom: 0; background: rgba(120,190,220,0.45); box-shadow: inset 0 0 0 1px rgba(170,220,240,0.7); }
.prof-haulweight { position: absolute; top: -3px; bottom: -3px; width: 4px; margin-left: -2px; background: #efe0b8; }
.prof-meter.fish-tug .prof-hint { color: #f5dfa8; font-weight: bold; }
.prof-toasts { position: fixed; right: 12px; top: 34%; z-index: 12; display: flex; flex-direction: column; gap: 4px; align-items: flex-end;
  pointer-events: none; font-family: ${PIXEL_STACK}; font-size: calc(12px * var(--hud-scale, 1)); }
.prof-toast { padding: 3px 10px; color: #efe0b8; background: rgba(10,8,6,0.78); border-left: 2px solid var(--brass, #c08a3e);
  text-shadow: 1px 1px 0 #050608; transition: opacity 0.4s; }
.prof-toast.fade { opacity: 0; }
.prof-chip { align-self: center; margin-top: 4px; padding: 1px 10px; font-family: ${PIXEL_STACK}; font-size: calc(11px * var(--hud-scale, 1));
  color: #efe0b8; background: rgba(10,8,6,0.72); border: 1px solid rgba(192,138,62,0.4); text-shadow: 1px 1px 0 #050608; pointer-events: none; }
.prof-chip:empty { display: none; }
.prof-banner { position: fixed; left: 50%; top: 22%; transform: translateX(-50%); z-index: 13; pointer-events: none; padding: 8px 24px;
  font-family: ${PIXEL_STACK}; font-size: calc(18px * var(--hud-scale, 1)); letter-spacing: 0.12em; text-transform: uppercase; color: #f3cf86;
  background: rgba(10,8,6,0.82); border: 2px solid var(--brass, #c08a3e); text-shadow: 2px 2px 0 #050608; }
.prof-banner:empty { display: none; }
/* PROF5 (FOUND): PROF4's plane was drawn undressed - an SVG polyline with no rule fills black and strokes nothing */
.prof-plane { display: flex; flex-direction: column; gap: 6px; }
.prof-board { position: relative; height: 96px; touch-action: none; cursor: crosshair; background: linear-gradient(#8a6a44, #6f5233);
  box-shadow: inset 0 0 0 2px #050608, inset 0 0 12px rgba(5,6,8,0.5); }
.prof-board svg { display: block; width: 100%; height: 100%; }
.prof-grain { fill: none; stroke: #3b2a18; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
.prof-trail { fill: none; stroke: #f3cf86; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.prof-boardhead { fill: rgba(239,224,184,0.22); stroke: none; }
/* ── PROF5: THE MARKET TAB ── */
.market-body { display: flex; flex-direction: column; gap: 8px; }
.market-views, .market-filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.market-search { flex: 1 1 140px; min-width: 0; }
.market-num { width: 5.5em; }
.market-rows, .market-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.market-row { display: grid; grid-template-columns: minmax(0, 1.6fr) auto minmax(0, 1.4fr) auto 60px; gap: 2px 10px; align-items: center;
  padding: 5px 8px; text-align: left; font: inherit; font-size: 12px; color: var(--bone, #e9e4d9); background: rgba(10,8,6,0.55);
  border: 1px solid rgba(192,138,62,0.25); cursor: pointer; }
.market-row.on { border-color: var(--brass, #c08a3e); background: rgba(192,138,62,0.16); }
.market-row b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.market-price { color: #f3cf86; white-space: nowrap; }
.market-where, .market-quality, .market-units, .market-state { color: #b9ab93; font-size: 11px; }
.market-median { color: #cdbd9f; font-size: 11px; white-space: nowrap; }
.market-mine, .market-mod { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe0b8; }
.market-line { width: 60px; height: 16px; }
.market-line polyline { fill: none; stroke: #f3cf86; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
.market-bar, .market-counterrow, .market-order, .market-listing, .market-histrow { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center;
  padding: 5px 8px; font-size: 12px; color: var(--bone, #e9e4d9); background: rgba(10,8,6,0.4); border-left: 2px solid var(--brass, #c08a3e); }
.market-ask { flex: 1 1 200px; }
.market-road, .market-counter, .market-listform, .market-orderform { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center;
  padding: 6px 10px; background: rgba(10,8,6,0.5); border: 1px solid rgba(192,138,62,0.3); color: var(--bone, #e9e4d9); font-size: 12px; }
.market-road h4, .market-counter h4, .market-listform h4, .market-orderform h4, .market-body > h4, .market-mine-view h4, .market-history h4 {
  flex: 1 1 100%; margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #efe0b8; }
.market-roadline { flex: 1 1 100%; margin: 0; }
.market-listing.state-sold, .market-listing.state-cancelled, .market-listing.state-expired, .market-listing.state-removed { opacity: 0.62; }
.market-foot { margin: 4px 0 0; font-size: 12px; letter-spacing: 0.08em; color: #e6dccb; text-shadow: 1px 1px 0 #050608; }
/* AUDIT 30 U5: a crafted row its own columns - its quality line the width the name gave up; at a phone's width two
   even columns, every cell able to shrink (the name drew 0px, the price over the road) */
.market-piece { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.4fr) auto minmax(0, 1.4fr); }
.market-row > * { min-width: 0; }
.market-where, .market-quality { overflow-wrap: anywhere; }
/* AUDIT 30 U14: the board's parchment ink (#5a4630) on the market's dark boxes read 1.6:1 - the market's own. (The
   popup's upper case and rule it once undid here never reach the tip since TOAST-SPLIT.) */
.market-body .notice-tip, .market-body .notice-label { color: #cdbd9f; }
/* PROF5b: an auction's row - its name, its quality and its standing bid across, where it stands and when it ends under */
.market-auction { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) auto; }
.market-auction .market-where { grid-column: 1 / -1; }
/* PROF6: the Work tab's guild writs (NOTICE1's guild blue - no guild's colours are stored until SEAT1c's heraldry) and
   commissions (green), "Yours", the forms - the market's dark boxes, the board's cards */
.notice-card.seal-commission, .notice-read.seal-commission { --seal: #3f7a3a; }
.notice-writ.seal-guild .writ-kind { color: #2f4a66; }
.notice-writ.seal-commission .writ-kind { color: #2f5a2b; }
.notice-writ .writ-take { flex-wrap: wrap; }
.notice-writ .work-num { width: 4.5em; }
/* a card as narrow as its column - the Fill's select names a piece in full, and its longest name set the track's width */
.notice-grid > .notice-writ { min-width: 0; }
.notice-writ .work-select { max-width: 100%; min-width: 0; width: 100%; flex: 1 1 140px; text-overflow: ellipsis; }
.notice-writ .writ-need { overflow-wrap: anywhere; }
.work-more { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.work-yours, .work-form { display: flex; flex-direction: column; gap: 6px; padding: 6px 10px; background: rgba(10,8,6,0.5);
  border: 1px solid rgba(192,138,62,0.3); color: var(--bone, #e9e4d9); font-size: 12px; }
.work-head { margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #efe0b8; }
.work-rows { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.work-row { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 4px 8px; background: rgba(10,8,6,0.4);
  border-left: 2px solid var(--brass, #c08a3e); }
.work-what { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
.work-where { color: #b9ab93; font-size: 11px; }
.work-fields { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.work-fields .work-select { flex: 1 1 150px; min-width: 0; max-width: 100%; }
.work-num { width: 5.5em; }
.work-text { flex: 1 1 140px; min-width: 0; }
.work-hint { margin: 0; color: #cdbd9f; font-style: italic; }
.work-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.work-open.on { border-color: var(--brass, #c08a3e); background: rgba(192,138,62,0.16); }
.work-none { font-style: italic; }
/* AUDIT 31 U2: every field under its visible name; U14: a field as tall as a button beside it, a form's select never
   clipped, an armed Decline marked */
.work-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.work-label-text { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #cdbd9f; }
.work-label-wide { flex: 1 1 150px; }
.work-label .work-select, .work-label .work-text { width: 100%; }
/* in the label's column a field's own flex-basis is its HEIGHT - a select 150px tall; the label takes the row's basis */
.work-label > .work-select, .work-label > .work-text, .work-label > .work-num, .work-label > .work-label-text { flex: 0 0 auto; }
.notice-writ .work-label-text { color: #5a4630; }
.work-fields .work-num, .notice-writ .work-num, .market-num { min-height: 32px; box-sizing: border-box; }
.work-decline.armed { border-color: #b8563a; color: #f3cf86; }
.notice-writ .work-label { flex: 1 1 140px; }
/* AUDIT 31 U14: a List form's select as wide as its form - a piece's long name set the form's width past a phone's */
.market-listform .notice-select, .market-orderform .notice-select { min-width: 0; max-width: 100%; flex: 1 1 160px; text-overflow: ellipsis; }
.market-listform, .market-orderform, .market-mine-view { min-width: 0; max-width: 100%; }
/* AUDIT 31 U3: an auction's standing bid wraps under its name at a phone's width - "opening 500 Drakes - no bids yet"
   was cut to "opening 500 Drakes - no" */
.market-auction .market-price { white-space: normal; overflow-wrap: anywhere; }
/* a long maker's name cut the piece's own ("Silverthorn-of-the-Iliac's Mithril Longs...") - a Masterwork's name wraps */
.market-auction b { white-space: normal; overflow-wrap: anywhere; }
@media (max-width: 640px) { .market-row, .market-piece { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .market-row > b { grid-column: 1 / -1; }
  .market-line { display: none; }
  .market-auction { grid-template-columns: minmax(0, 1fr); } .market-auction > * { grid-column: 1 / -1; }
  .market-row b { white-space: normal; overflow-wrap: anywhere; } }
@media (prefers-reduced-motion: reduce) { .prof-glint { animation: none; } .prof-toast { transition: none; } }
${PROF_ACT_CSS}
${PROF_STATION_CSS}`;
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
.pack-shell .pack-dock .itemrow .count { right: 4px; bottom: 3px; z-index: 2; font-size: 11px; line-height: 1; color: #efe8d6;
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
.card[data-rarity] > ul.rarity > li:first-child, .card[data-rarity] > .card-body > ul.rarity > li:first-child { color: var(--rar); letter-spacing: 0.18em; }
.card[data-rarity] > ul.rarity > li:first-child::before, .card[data-rarity] > .card-body > ul.rarity > li:first-child::before { content: var(--rar-pips); margin-right: 6px; font-size: 9px;
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
.setstrip { display: flex; flex-direction: column; gap: 4px; margin: 8px 0 0; flex: 0 0 auto;
  max-height: 136px; overflow-y: auto; overscroll-behavior: contain; }   /* CARD-FIT U16: five lines, then it scrolls - eight sets can be worn at once, and the column clips */
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
@media (pointer: coarse) { .setline { min-height: 40px; } .setstrip { max-height: 216px; } }   /* AUDIT SET U14: a line a thumb presses, as every other press on a touch screen */
${BROKER_CSS}
${REFORGE_CSS}
${BOUNTY_CSS}
${NOTICE_CSS}
${PROF_CSS}
${ARENA_WINDOW_CSS}
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
body .wb-boss-bar { ${PIXEL_FONT_CSS} letter-spacing: 0.06em; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7); }
body .wb-boss-name { font-size: 14px; letter-spacing: 0.14em; text-shadow: ${OUTLINED}; }
/* WB13c: his epithet under his name; the trailing segment the foe bar's own */
body .wb-boss-sub { font-size: 11px; letter-spacing: 0.08em; color: #d8cfae; text-shadow: ${OUTLINED}; }
body .wb-boss-ghost { background: linear-gradient(180deg, #fff6e4 0 2px, #ffc08a 2px); opacity: 0.6; }
/* WB9a: the night's marks under his health - each chip its sign and name, in the HUD's pixel face */
body .wb-boss-marks { column-gap: 14px; margin: 3px 0 4px; }
body .wb-boss-chip { text-shadow: ${OUTLINED}; }
body .wb-boss-chip-head { font-size: 11px; letter-spacing: 0.12em; color: #efe8d6; }
body .wb-boss-chip-icon { filter: drop-shadow(1px 1px 0 #050608); }
body .wb-boss-chip-name { font-size: 11px; }
body .wb-boss-track { margin: 7px 0 6px; border: 2px solid; border-color: #9a9079 #3a352a #25221b #6e6755; isolation: isolate;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0 2px, transparent 2px), #1e0906;
  box-shadow: 0 0 0 1px #050608, 3px 3px 0 1px rgba(0,0,0,0.45); }
body .wb-boss-fill { background: linear-gradient(180deg, #ffc08a 0 2px, #ff7a3a 2px 4px, #d8341a 4px 8px, #9a1a0a 8px 10px, #5c0a04 10px); }
body .wb-boss-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: min(2px, 100%); background: #ffd9a8; opacity: 0.85; }
body .wb-boss-mark { top: 0; bottom: 0; z-index: 1; background: linear-gradient(90deg, #050608 0 1px, rgba(255,230,200,0.55) 1px); }
/* WB13c: the ward a lit cage, apart from the frame's brass */
body .wb-boss-ward { inset: -5px; border-color: #ffe9a8; box-shadow: 0 0 0 1px #050608, 0 0 0 3px rgba(255,210,122,0.45), inset 0 0 0 1px #050608; }
body .wb-boss-track::before, body .wb-boss-track::after { content: ''; position: absolute; top: -2px; bottom: -2px; width: 6px; z-index: 2;
  box-shadow: 0 0 0 1px #050608; background: ${CLASP}; }
body .wb-boss-track::before { left: -6px; }
body .wb-boss-track::after { right: -6px; }
body .wb-boss-callout { font-size: 15px; letter-spacing: 0.12em; text-shadow: ${OUTLINED}; }
body .wb-boss-callout.cin { animation-timing-function: steps(3); }
/* WB13c: the line to the landing a hard pixel; Dagon's plate and MOVE in a black ring, no glow */
body .wb-boss-callout-line { height: 2px; box-shadow: 0 1px 0 #050608; opacity: 1; }
body .wb-boss-callout.dagon .wb-boss-callout-text { font-size: 15px; color: #efe8d6; box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45); }
body .wb-boss-move { font-size: 12px; color: #fff6e4; background: #b8320c; box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45); }
body .wb-boss-foot { font-size: 11px; opacity: 1; color: #d8cfae; }
body .wb-boss-tag { background: rgba(5,6,8,0.6); border-color: #3a352a; box-shadow: 1px 1px 0 rgba(0,0,0,0.45); text-shadow: ${OUTLINED}; }
body .wb-boss-wrath { color: #ff9a7a; border-color: #8a2820; }
body .wb-boss-wrath.near { color: #fff6e4; }
@media (max-width: 640px) { body .wb-boss-chip-head, body .wb-boss-chip-name { font-size: 11px; letter-spacing: 0; } }   /* FONT3's floor: a phone narrows the chip by its tracking, not under 11px */
body .wb-gate-banner { ${PIXEL_FONT_CSS} font-size: 14px; letter-spacing: 0.14em; text-shadow: ${OUTLINED}; }
/* WB13e: the fight's beats in the HUD's face, outlined - the name large, the rule a brass line */
body .wb-title-card { ${PIXEL_FONT_CSS} color: #efe8d6; text-shadow: ${OUTLINED}; }
body .wb-title-kicker { font-size: 12px; letter-spacing: 0.3em; color: ${FRAME_TONES.brassHi}; }
body .wb-title-main { font-size: 34px; letter-spacing: 0.12em; color: #fff6e4; text-shadow: ${OUTLINED}, 0 0 14px rgba(255,90,30,0.45); }
body .wb-title-rule { height: 2px; background: linear-gradient(90deg, transparent, ${FRAME_TONES.brass}, transparent); box-shadow: 0 1px 0 #050608; }
body .wb-title-sub { font-size: 14px; letter-spacing: 0.06em; color: #d8cfae; }
@media (max-width: 640px), (max-height: 480px) { body .wb-title-main { font-size: 24px; } body .wb-title-sub { font-size: 12px; } }
/* FONT3 + WB13c (both 2026-10-02, the same surface found from two sides; the dress is WB13c's, the weight FONT3's
   reading 500): the ground's warning in the HUD's face, outlined on a dark band (it stood in the serif among pixel words, orange
   on the orange rim); the way out's arrow in a hard black edge */
body .wb-ground-warn { ${PIXEL_FONT_CSS} font-size: 16px; letter-spacing: 0.1em; text-shadow: ${OUTLINED};
  background: rgba(5,6,8,0.55); padding: 2px 8px; box-shadow: 0 0 0 1px rgba(5,6,8,0.8); }
body .wb-ground-arrow svg { filter: drop-shadow(1px 0 0 #050608) drop-shadow(-1px 0 0 #050608) drop-shadow(0 1px 0 #050608) drop-shadow(0 -1px 0 #050608); }
/* WB9a: the marks' card - a stone panel in the brass frame, the pixel face outlined; each aspect keeps its own colour */
body .wb-marks-card { ${PIXEL_FONT_CSS} letter-spacing: 0.05em; color: #efe8d6; text-shadow: ${OUTLINED};
  background: linear-gradient(180deg, rgba(0,0,0,0.5) 0 2px, transparent 2px), rgba(20,14,10,0.92);
  border: 2px solid; border-color: ${FRAME_TONES.brassHi} ${FRAME_TONES.brassLo} #5c3f1a ${FRAME_TONES.brass};
  box-shadow: 0 0 0 1px #050608, 3px 3px 0 1px rgba(0,0,0,0.45); }
body .wb-marks-title { font-size: 11px; letter-spacing: 0.2em; color: ${FRAME_TONES.brassHi}; }
body .wb-marks-sub { font-size: 14px; color: #efe8d6; }
body .wb-marks-name { font-size: 12px; letter-spacing: 0.12em; }
body .wb-marks-text { font-size: 11px; color: #d8cfae; opacity: 1; }
body .wb-marks-tip { font-size: 11px; font-style: normal; color: #b9ab86; opacity: 1; }
/* GATE-UX: the damage chart - the marks' card's stone panel and brass frame, the pixel face outlined, the bars the
   fire's one hue banded from a lit top; my row a brass ring and its words */
body .wb-dmg-chart { ${PIXEL_FONT_CSS} letter-spacing: 0.04em; color: #efe8d6; text-shadow: ${OUTLINED};
  background: linear-gradient(180deg, rgba(0,0,0,0.5) 0 2px, transparent 2px), rgba(20,14,10,0.92);
  border: 2px solid; border-color: ${FRAME_TONES.brassHi} ${FRAME_TONES.brassLo} #5c3f1a ${FRAME_TONES.brass};
  box-shadow: 0 0 0 1px #050608, 3px 3px 0 1px rgba(0,0,0,0.45); }
body .wb-dmg-title { font-size: 11px; letter-spacing: 0.2em; color: ${FRAME_TONES.brassHi}; }
body .wb-dmg-sub { font-size: 13px; color: #efe8d6; }
body .wb-dmg-head { font-size: 11px; letter-spacing: 0.1em; color: #b9ab86; border-bottom-color: rgba(154,144,121,0.45); }
body .wb-dmg-name { font-size: 12px; }
body .wb-dmg-lv { font-size: 11px; color: #d8cfae; opacity: 1; }
body .wb-dmg-you { font-size: 11px; color: ${FRAME_TONES.brassHi}; }
body .wb-dmg-num { font-size: 11px; letter-spacing: 0; }   /* AUDIT FONT3 L7: a five-digit Best in its 44px column */
body .wb-dmg-track { background: rgba(5,6,8,0.72); box-shadow: 0 0 0 1px #050608; border-radius: 0; }
body .wb-dmg-fill { background: linear-gradient(180deg, #ffc08a 0 1px, #ff7a3a 1px 2px, #d8341a 2px); border-radius: 0; }
body .wb-dmg-mine { outline: 1px solid ${FRAME_TONES.brassHi}; background: rgba(192,138,62,0.14); }
body .wb-dmg-more { font-size: 11px; font-style: normal; color: #b9ab86; opacity: 1; }
/* ARENA2: THE BOUT'S HUD (ui/arenaHud.js) - the plate is a panel and the clock and the crowd's marks chips (the kit's
   roles); here what a role cannot say: the HUD's words in the pixel face outlined, each track a vital's stone bevel
   with its fill banded from a lit top (health the vitals' red, stamina their green, the crowd's mood brass), the
   crowd's middle a brass tick, the darling's mark brass and the villain's blood, my own name brass, a banner's mark
   down the plate's inner edge (ARENA3's teams paint it; today mine brass, theirs blood). */
body .arena-hud { ${PIXEL_FONT_CSS} font-weight: 400; color: #efe8d6; text-shadow: ${OUTLINED}; }
body .arena-plate { padding: 7px 12px 8px; }
body .arena-track { border: 2px solid; border-color: #9a9079 #3a352a #25221b #6e6755; background: rgba(5,6,8,0.78);
  box-shadow: 0 0 0 1px #050608; }
body .arena-fill { background: linear-gradient(180deg, #f2a597 0 2px, #d8685a 2px 4px, #b53a2e 4px 8px, #8a2820 8px); }
body .arena-stam .arena-fill { background: linear-gradient(180deg, #b9f0c4 0 1px, #49b06a 1px 3px, #2f9152 3px); }
body .arena-crowd .arena-fill { background: linear-gradient(180deg, #fff0b8 0 1px, #f2c46b 1px 3px, #d9a441 3px 5px, #a87a2a 5px); }
body .arena-crowd-mid { background: ${FRAME_TONES.brassHi}; box-shadow: 0 0 0 1px #050608; }
body .arena-ftr[data-you="1"] .arena-ftr-name { color: ${FRAME_TONES.brassHi}; }
body .arena-ftr[data-banner="you"] .arena-track, body .arena-ftr[data-banner="a"] .arena-track { box-shadow: 0 0 0 1px #050608, inset 2px 0 0 ${FRAME_TONES.brass}; }
body .arena-ftr[data-banner="them"] .arena-track, body .arena-ftr[data-banner="b"] .arena-track { box-shadow: 0 0 0 1px #050608, inset -2px 0 0 #b83a2e; }
body .arena-tag[data-tag="darling"] { color: ${FRAME_TONES.brassHi}; }
body .arena-tag[data-tag="villain"] { color: #ff9a8a; }
body .arena-out { color: #ff9a8a; }
body .arena-timer { font-size: 17px; letter-spacing: 0.1em; color: #fffaf0; }
body .arena-vs { color: #d8cfae; opacity: 1; }
body .arena-crowd-word[data-band="roar"], body .arena-crowd-word[data-band="cheer"] { color: ${FRAME_TONES.brassHi}; }
body .arena-crowd-word[data-band="boo"], body .arena-crowd-word[data-band="jeer"] { color: #ff9a8a; }
body .arena-bark { font-size: 14px; letter-spacing: 0.08em; }
body .arena-hint { color: ${FRAME_TONES.brassHi}; }
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
/* AUDIT NAV1 (the presentation): the sea fight's dim words join them - on Stone the plate's hint (the board key's line)
   read 1.9:1, its waters 2.9, its labels and the card's sub-line 3.8, the plunder window's sub-line, lede and counts
   3.3-3.5 */
:root[data-plus-theme="stone"] body .dfnaval-hint, :root[data-plus-theme="stone"] body .dfnaval-waters,
:root[data-plus-theme="stone"] body .dfnaval-bar-label, :root[data-plus-theme="stone"] body .dfnaval-card-sub,
:root[data-plus-theme="stone"] body .dfnaval-winsub, :root[data-plus-theme="stone"] body .dfnaval-lede,
:root[data-plus-theme="stone"] body .dfnaval-count, :root[data-plus-theme="stone"] body .dfnaval-choice span,
:root[data-plus-theme="stone"] body .dfnaval-yardrow span { color: ${STONE_DIM}; text-shadow: 1px 1px 0 rgba(5,6,8,0.85); }
`;

/** AC-COMPARE (FIELD BUGS 2026-09-29d): THE CHARACTER'S ARMOUR ON THE PACK, AND THE CARD'S COMPARISON
 *  (ui/armourCard.js). A body part's number is a small plate in its panel's top-right corner, stepping off the rune's
 *  when the piece carries one (the padlock keeps the top left; a part's panel never holds a family's count; the foot is
 *  the name's, which a half panel centres there) - brass-rimmed, dim at 0. The overall figure is a plaque at the
 *  top-left of the figure's column, a word over a number, placed on the map's own grid area and taken out of its sizing
 *  (the map is positioned), so an empty frame's narrow column is never widened and a doll's head is never covered. The
 *  comparison rides the card's own stats dress (its rows are a `dl.stats`), under a rule of its own, its differences in
 *  the wear bar's two tones: better green, worse red.
 *  It stands BEFORE the kit (PLUS_CSS): the kit paints none of these elements - its roles are the card, the panels and
 *  the empty doll's well, never what stands in them - so they need no layer over it (FRAME1's two stay two). */
export const ARMOUR_CSS = `
.pack-shell .equipped .wornac { position: absolute; right: 3px; top: 3px; z-index: 2; min-width: 16px; height: 15px; padding: 0 3px;
  display: flex; align-items: center; justify-content: center; font-size: 11px; line-height: 1; color: #efe8d6;
  font-variant-numeric: tabular-nums; background: rgba(5,6,8,0.8); border: 1px solid rgba(192,138,62,0.8);
  border-radius: 1px 1px 7px 7px; text-shadow: 1px 1px 0 #050608; }
.pack-shell .equipped .wornrow[data-sigil] > .wornac { right: 17px; }
.pack-shell .equipped .wornac.nil { color: #9c937d; border-color: rgba(125,116,96,0.5); }
/* HOOD-SAID (FIELD BUGS 2026-09-30): a raised hood's chip, in the part plate's dress and its corner, round-topped like
   the hood it names, stepping off a family's count */
.pack-shell .equipped .wornhood { position: absolute; right: 3px; top: 3px; z-index: 2; height: 15px; padding: 0 4px;
  display: flex; align-items: center; font-size: 11px; line-height: 1; letter-spacing: 0.08em; text-transform: uppercase;
  color: #efe8d6; background: rgba(5,6,8,0.8); border: 1px solid rgba(192,138,62,0.8); border-radius: 7px 7px 1px 1px;
  text-shadow: 1px 1px 0 #050608; }
.pack-shell .equipped .worncount ~ .wornhood { right: 20px; }
.pack-shell .wornmap .wornac-total { position: absolute; left: 4px; top: 4px; z-index: 2; display: flex; flex-direction: column;
  align-items: center; gap: 1px; padding: 2px 5px 3px; white-space: nowrap; background: rgba(5,6,8,0.8);
  border: 2px solid rgba(192,138,62,0.8); box-shadow: 0 0 0 1px #050608; text-shadow: 1px 1px 0 #050608; }
.pack-shell .wornac-total .k { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a89f88; }
.pack-shell .wornac-total .v { font-size: 16px; line-height: 1; color: #f3cf86; font-variant-numeric: tabular-nums; }
.card .cmp { margin: 8px 0 0; padding-top: 6px; border-top: 2px solid rgba(5,6,8,0.45); box-shadow: inset 0 1px 0 rgba(163,152,128,0.16); }
.card .cmp .cmp-head, .pack-shell .card .cmp p.cmp-head { margin: 0 0 4px; font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase; text-align: center; color: #a89f88; }
.inv-tip .cmp dl.stats { border-top: 0; box-shadow: none; padding-top: 2px; }
.pack-shell .packtip.packdetail .card .cmp .stats { margin-top: 2px; }
.card .cmp .cmp-d { margin-left: 6px; font-variant-numeric: tabular-nums; }
.card .cmp .cmp-sep { margin-left: 4px; color: #9c937d; }
.card .cmp .cmp-sep + .cmp-d { margin-left: 4px; }
.card .cmp .cmp-d.up { color: #74d9a0; }
.card .cmp .cmp-d.down { color: #d98074; }
.card .cmp .cmp-d.same { color: #a89f88; }
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
${ARMOUR_CSS}
/* FRAME1: LAST, on purpose - see ui/enhancedFrame.js */
${FRAME_CSS}
/* RARITY-UI + SIGIL-UI, then PLUS-DRESS: after the kit - each outranks the kit's stone at the same weight */
${OVER_KIT_CSS.join('\n')}
`;
