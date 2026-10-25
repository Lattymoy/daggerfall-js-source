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
// where it goes are the host's (scenes/decor/decorTool.js). Handed the
// document and the window so the pins drive them headless.
//
// Not a DFU member: Daggerfall Unity has no decorator. Ledger A.
// ═══════════════════════════════════════════════════════════════════

import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';
import { isTextEntryTarget } from './input.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';   // PX28b: Tab puts it away, as it puts away every enhanced window
import { DECOR_KINDS, DECOR_SIZES, decorSize, filterDecor } from '../systems/decor/decorCatalogue.js';
import { loadDecorFavourites, toggleDecorFavourite } from '../systems/decor/decorFavourites.js';
import { decorRefund, DECOR_FURNITURE_GROUP, DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES } from '../net/decorLaw.js';
import { forgeOffered, PROF_STATIONS } from './professions/profPages.js';
import { VENDOR_STATION } from '../net/vendorLaw.js';   // HOME-VENDOR: a hired trader
import { rentRowSub, rentPriceStep, RENT_PRICE_STEPS, RENT_PRICE_FIRST } from '../systems/homeRent.js';   // HOME-RENT: the owner's rooms
import {
  HOME_LOOK_PARTS, HOME_LOOK_PART_NAMES, HOME_LOOK_CLIMATES, HOME_LOOK_CLIMATE_NAMES, HOME_LOOK_SETS, HOME_LOOK_SET_NAMES, HOME_LOOK_DOOR_KEPT, homeLookOf, homeLookSig,
} from '../net/homeLaw.js';   // HOME-LOOK: the house outside, painted
import { homeLookSwatch } from '../world/homeLook.js';
import { decorIsDoor } from '../systems/decor/decorDoorways.js';   // HOME-DOORS (AUDIT): a door's controls
import { DFICON_CSS } from './menu/menuGlyphs.js';   // MENU-ORDER: a kind and a press each wear a picture
import { t } from '../systems/textManager.js';   // L10N4: MENU-ORDER's own words in the player's language
/** The crafts a piece may be made here: every station, the Forge only where it works (AUDIT 29 B2). HOME-VENDOR: and a
 *  trader only where the market trades - online, the trades open (its stock is market listings). */
/** WAGONS2 (FINAL AUDIT): `trader` - whether the room is a home, where a hired trader trades (the view's `trader`); a
 *  caravan's or a ship's offers none. */
export const stationsOffered = (trader = true) => DECOR_STATIONS.filter((k) => (k === VENDOR_STATION ? trader && forgeOffered() : !PROF_STATIONS.includes(k) || forgeOffered()));   // PROF4: the workbench as the forge

export const DECOR_STYLE_ID = 'dagger-decor-style';
export const DECOR_CSS = `
${PIXELIFY_FIVE_FACE}
${DFICON_CSS}
.dfdecor-open { position: fixed; right: calc(12px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%);
  z-index: 6; display: none; pointer-events: auto; min-height: 32px; padding: 6px 12px; border-radius: 3px;
  border: 1px solid var(--iron, #2b323b); background: rgba(14, 16, 19, .9); color: var(--bone, #e9e4d9);
  ${PIXEL_FONT_CSS} font-size: 14px; cursor: pointer; }
.dfdecor-open[data-up="1"] { display: block; }
.dfdecor-open:hover { border-color: #b8943f; color: #f2c46b; }
.dfdecor-open.touch { min-height: 44px; padding: 10px 14px; }
.dfdecor { position: fixed; inset: 0; z-index: 13; display: none; align-items: center; justify-content: center;
  pointer-events: none; ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfdecor-access { position: fixed; z-index: 20; left: 50%; top: 18%; width: min(360px, calc(100vw - 24px));
  display: flex; flex-direction: column; gap: 8px; padding: 14px; box-sizing: border-box;
  background: rgba(14, 16, 19, .97); border: 1px solid #b8943f; border-radius: 6px;
  color: var(--bone, #e9e4d9); pointer-events: auto; }
.dfdecor-access button, .dfdecor-access input { font: inherit; color: inherit; background: #1a1e24; border: 1px solid #2b323b; padding: 6px 8px; cursor: pointer; }
.dfdecor-access button[data-on="1"] { border-color: #b8943f; color: #f2c46b; }
.dfdecor-access input { width: 100%; box-sizing: border-box; cursor: text; }
.dfdecor[data-state="open"] { display: flex; }
.dfdecor-card { pointer-events: auto; width: min(960px, calc(100vw - 24px)); height: min(720px, calc(100vh - 24px));
  display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; padding: 12px 14px;   /* MENU-ORDER: a column - a hidden row takes no place */
  background: rgba(14, 16, 19, .95); border: 1px solid var(--iron, #2b323b); border-radius: 6px; }
.dfdecor-card > * { flex: none; }   /* MENU-ORDER: only the body gives way to a short screen */
.dfdecor-card[data-mode="room"] .dfdecor-filters, .dfdecor-card[data-mode="room"] .dfdecor-place,
.dfdecor-card[data-mode="room"] .dfdecor-place-row { display: none; }
.dfdecor-card[data-mode="catalogue"] .dfdecor-room-actions { display: none; }
.dfdecor-card[data-mode="own"] .dfdecor-filters, .dfdecor-card[data-mode="own"] .dfdecor-room-actions { display: none; }
.dfdecor-card[data-mode="base"] .dfdecor-filters, .dfdecor-card[data-mode="base"] .dfdecor-place,
.dfdecor-card[data-mode="base"] .dfdecor-place-row,
.dfdecor-card[data-mode="base"] .dfdecor-room-actions, .dfdecor-card:not([data-mode="base"]) .dfdecor-base-actions { display: none; }
.dfdecor-base-actions { display: flex; flex-direction: column; gap: 10px; }
.dfdecor-card[data-mode="rent"] .dfdecor-filters, .dfdecor-card[data-mode="rent"] .dfdecor-place,
.dfdecor-card[data-mode="rent"] .dfdecor-place-row,   /* HOME-RENT */
.dfdecor-card[data-mode="rent"] .dfdecor-room-actions, .dfdecor-card[data-mode="rent"] .dfdecor-base-actions,
.dfdecor-card[data-mode="rent"] .dfdecor-preview, .dfdecor-card:not([data-mode="rent"]) .dfdecor-rent-actions { display: none; }
.dfdecor-rent-actions { display: flex; flex-direction: column; gap: 10px; }
.dfdecor-card[data-yard="1"] .dfdecor-yardless { display: none; }   /* HOME-YARD: nothing held, no light, no craft outside */
.dfdecor-card[data-mode="paint"] .dfdecor-filters, .dfdecor-card[data-mode="paint"] .dfdecor-place,
.dfdecor-card[data-mode="paint"] .dfdecor-place-row,   /* HOME-LOOK */
.dfdecor-card[data-mode="paint"] .dfdecor-room-actions, .dfdecor-card[data-mode="paint"] .dfdecor-base-actions,
.dfdecor-card[data-mode="paint"] .dfdecor-rent-actions, .dfdecor-card:not([data-mode="paint"]) .dfdecor-paint-actions { display: none; }
.dfdecor-paint-actions { display: flex; flex-direction: column; gap: 10px; }
.dfdecor-paint-btns { display: flex; flex-wrap: wrap; gap: 4px; }   /* FB1001 LOOK-BUTTONS: the painter's own row, never the rent's */
.dfdecor-paint-btns[hidden] { display: none; }   /* MENU-ORDER: WAGONS2's caravan hid it by the attribute, which display: flex outweighs */
.dfdecor-card[data-mode="look"] .dfdecor-room-actions, .dfdecor-card[data-mode="look"] .dfdecor-fg-kinds,
.dfdecor-card[data-mode="look"] .dfdecor-fg-has { display: none; }
.dfdecor-room-actions { display: flex; flex-direction: column; gap: 10px; }
.dfdecor-head { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--iron, #2b323b); padding-bottom: 6px; }
.dfdecor-where { flex: 1 0 100%; font-size: 14px; color: var(--bone, #e9e4d9); }
.dfdecor-where[hidden] { display: none; }
.dfdecor-tip { position: fixed; z-index: 39; transform: translate(-50%, calc(-100% - 6px)); padding: 2px 8px;
  border: 1px solid #b8943f; background: rgba(14, 16, 19, .96); color: var(--bone, #e9e4d9); font-size: 13px;
  line-height: 1.3; white-space: nowrap; pointer-events: none; }
.dfdecor-tip[hidden] { display: none; }
.dfdecor-head > .dfdecor-tabs { flex: 1 1 auto; min-width: 0; padding-bottom: 0; border-bottom: 0; }
/* MENU-ORDER: the views are a tab bar of their own - never one more row of filters */
.dfdecor-tabs { gap: 4px; padding-bottom: 6px; border-bottom: 1px solid var(--iron, #2b323b); }
body .dfdecor-tabs .dfdecor-chip { min-height: 34px; padding: 4px 14px; font-size: 14px; }
body .dfdecor-tabs .dfdecor-chip[aria-pressed="true"] { color: #f2c46b; box-shadow: inset 0 -3px 0 #c08a3e; }
.dfdecor-roomsbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.dfdecor-roomsbar:empty { display: none; }
/* MENU-ORDER: every row of choices says what it chooses */
.dfdecor-filters { display: flex; flex-direction: column; gap: 6px; }
.dfdecor-fline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; }
.dfdecor-fgroup { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.dfdecor-fg-search { flex: 1 1 220px; align-items: center; }
.dfdecor-fg-kinds { flex: 1 1 100%; }
.dfdecor-flabel, .dfdecor-rooms-label { flex: none; min-width: 4.5em; padding-top: 6px; font-size: 12px; letter-spacing: .06em;
  text-transform: uppercase; color: var(--dim, #9a9486); }
.dfdecor-ftoggle { display: none; }
.dfdecor-search { flex: 1 1 180px; min-width: 0; min-height: 32px; padding: 3px 8px; box-sizing: border-box; border-radius: 3px;
  border: 1px solid var(--iron, #2b323b); background: #0b0d10; color: var(--bone, #e9e4d9); font: inherit; font-size: 15px; }
.dfdecor-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.dfdecor-chip { min-height: 28px; padding: 2px 10px; border-radius: 3px; border: 1px solid var(--iron, #2b323b);
  background: transparent; color: var(--dim, #9a9486); font: inherit; font-size: 13px; cursor: pointer; }
.dfdecor-kinds .dfdecor-kicon { padding-left: 6px; padding-right: 6px; }
.dfdecor-kinds .dfdecor-kicon[data-dficon]::before { margin-right: 0; }
.dfdecor-chip[aria-pressed="true"] { color: #f2c46b; border-color: #b8943f; background: rgba(242, 196, 107, .08); }
.dfdecor-card > .dfdecor-body { flex: 1 1 auto; }
.dfdecor-body { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 12px; min-height: 0; }
.dfdecor-list { overflow-y: auto; min-height: 0; border: 1px solid var(--iron, #2b323b); border-radius: 3px; contain: layout; }
.dfdecor-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 8px; align-items: center;
  padding: 4px 8px; cursor: pointer; border-bottom: 1px solid rgba(43, 50, 59, .5); }
.dfdecor-row:hover { background: rgba(242, 196, 107, .06); }
.dfdecor-row[aria-selected="true"] { background: rgba(242, 196, 107, .14); }
.dfdecor-row.dim .dfdecor-row-price { color: #b8483f; }
.dfdecor-thumb { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; overflow: hidden;
  font-size: 11px; color: var(--dim, #9a9486); border: 1px solid rgba(43, 50, 59, .7); border-radius: 2px; }
.dfdecor-thumb img { max-width: 32px; max-height: 32px; image-rendering: pixelated; }
.dfdecor-row-name { font-size: 15px; line-height: 1.3; overflow-wrap: anywhere; }
.dfdecor-row-sub { font-size: 12px; color: var(--dim, #9a9486); line-height: 1.35; }
.dfdecor-row-price { font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; color: #f2c46b; }
.dfdecor-row-end { display: flex; align-items: center; gap: 6px; }
.dfdecor-marks { display: flex; align-items: stretch; gap: 4px; }
.dfdecor-mark { min-height: 24px; padding: 2px 8px; font-size: 12px; line-height: 1.15; }
.dfdecor-mark[aria-pressed="true"] { background: #b8943f; color: #0e1013; }
.dfdecor-place-row { display: flex; align-items: stretch; gap: 4px; }
.dfdecor-place-row > .dfdecor-place { flex: 1 1 auto; }
.dfdecor-place-row > .dfdecor-mark { flex: 0 0 auto; }
.dfdecor-empty { padding: 16px; font-size: 14px; color: var(--dim, #9a9486); text-align: center; }
.dfdecor-side { display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow-y: auto; contain: layout; }   /* AUDIT HOME-STATIONS S5: six acts on a short screen; contain: a hover's words stay in this column */
.dfdecor-preview { flex: 1 1 auto; min-height: 140px; border: 1px solid var(--iron, #2b323b); border-radius: 3px;
  background: transparent; display: flex; align-items: center; justify-content: center; }
.dfdecor-preview img { max-width: 80%; max-height: 80%; image-rendering: pixelated; }
.dfdecor-preview canvas { display: none; width: 100%; height: 100%; }
.dfdecor-preview[data-model="1"] canvas { display: block; }
.dfdecor-preview[data-model="1"] img { display: none; }
.dfdecor-pick-name { font-size: 18px; overflow-wrap: anywhere; }
.dfdecor-pick-line, .dfdecor-pick-why { font-size: 13px; color: var(--dim, #9a9486); line-height: 1.4; }
.dfdecor-pick-line:empty, .dfdecor-pick-price:empty, .dfdecor-pick-why:empty { display: none; }
.dfdecor-pick-why { color: #d9a441; }
.dfdecor-pick-price { font-size: 15px; font-variant-numeric: tabular-nums; color: #f2c46b; }
/* MENU-ORDER: a side's presses in groups, each named - what it moves, what it switches, what it costs */
.dfdecor-acts { display: flex; flex-direction: column; gap: 4px; }
.dfdecor-acts-label { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #9a9486);
  padding-bottom: 3px; border-bottom: 1px solid rgba(43, 50, 59, .8); }
.dfdecor-acts-label:empty { display: none; }
.dfdecor-acts-btns { display: flex; flex-wrap: wrap; gap: 4px; }
.dfdecor-acts-btns:empty { display: none; }
.dfdecor-acts-btns > .dfdecor-btn { flex: 1 1 auto; }
.dfdecor-btn { min-height: 32px; padding: 4px 14px; border-radius: 3px; border: 1px solid #b8943f; background: #2c2412;
  color: var(--bone, #e9e4d9); font: inherit; font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; text-align: center; }
.dfdecor-btn:hover { background: #b8943f; color: #0e1013; }
.dfdecor-btn[disabled] { opacity: .45; cursor: default; background: #2c2412; color: var(--bone, #e9e4d9); }
.dfdecor-btn.warn:not([disabled]) { border-color: #b83a2e; }
.dfdecor-close { margin-left: auto; border-color: var(--iron, #2b323b); background: transparent; }
.dfdecor-foot { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 13px; color: var(--dim, #9a9486);
  padding-top: 6px; border-top: 1px solid var(--iron, #2b323b); }
.dfdecor-foot > span:empty { display: none; }
.dfdecor-bar { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 8; display: none; flex-direction: column; gap: 6px; padding: 8px 12px; width: max-content; max-width: min(1120px, calc(100vw - 24px));
  box-sizing: border-box; background: rgba(14, 16, 19, .92); border: 1px solid #b8943f; border-radius: 6px;
  pointer-events: none; ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfdecor-bar[data-up="1"] { display: flex; }
.dfdecor-bar-what { font-size: 15px; }
.dfdecor-bar-count { font-size: 13px; color: var(--dim, #9a9486); }
.dfdecor-bar-count:empty { display: none; }
/* MENU-ORDER: the keys a legend - a key's name, then what presses it - never one run-on line */
.dfdecor-bar-keys { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 2px 16px;
  font-size: 13px; color: var(--dim, #9a9486); line-height: 1.4; }
.dfdecor-key b { font-weight: normal; color: var(--bone, #e9e4d9); }
.dfdecor-bar[data-keys="0"] .dfdecor-bar-keys { display: none; }
.dfdecor-bar-why { font-size: 13px; color: #d9a441; }
.dfdecor-bar-why:empty { display: none; }
.dfdecor-bar-btns { display: flex; flex-wrap: wrap; gap: 4px; }
.dfdecor-bar-sep { flex: none; width: 1px; align-self: stretch; margin: 2px 4px; background: rgba(154, 148, 134, .35); }
.dfdecor-bar .dfdecor-chip, .dfdecor-bar .dfdecor-btn { pointer-events: auto; }
.dfdecor-bar.touch .dfdecor-chip, .dfdecor-bar.touch .dfdecor-btn { min-height: 44px; min-width: 44px; touch-action: none; }
.dfdecor-bar.touch { bottom: auto; top: calc(8px + env(safe-area-inset-top, 0px)); max-width: calc(100vw - 272px); }
/* MENU-ORDER: a portrait phone's bar. Clear of the touch layer's top-left presses beside it, a 390px screen gave it 118px -
   a word a line; under them (16px down, 48px tall, ui/touch/touch.js) it has the screen's width */
@media (orientation: portrait) { .dfdecor-bar.touch { top: calc(72px + env(safe-area-inset-top, 0px)); max-width: calc(100vw - 24px); } }
/* The decorator's hotbar wears the character bar's sockets (enhancedHotbar.js .hb). In play it stands in that bar's
   column. With no column it floats where that column sits, above the catalogue, and takes the pointer. */
.hb.hb-decor { z-index: 14; pointer-events: auto; }
.hb.hb-decor.hb-float { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(22px + env(safe-area-inset-bottom, 0px)); }
.hb.hb-decor .hb-slot { pointer-events: auto; cursor: pointer; }
.hb.hb-decor .hb-icon:not([src]) { display: none; }
/* MENU-ORDER: PICTURES BEFORE WORDS. A model has no picture until it turns in the preview: its kind's glyph stands in its
   tile over the letters, which stay for a reader. */
.dfdecor-thumb { position: relative; }
.dfdecor-thumb[data-dficon] { color: transparent; }
.dfdecor-thumb[data-dficon]::before { position: absolute; inset: 0; margin: auto; width: 62%; height: 62%; color: #c9bba1; }
/* ...and the model's own picture over it once the host has turned it small (decorTool.js modelPicture) */
.dfdecor-thumb img.dfdecor-modelpic { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; max-width: none; max-height: none;
  object-fit: contain; image-rendering: auto; }   /* AUDIT MENU-ORDER U6: over the whole tile - in its flow, the letters it keeps pushed it 7px right and cut it */
.dfdecor-thumb img.dfdecor-modelpic:not([src]) { display: none; }
.dfdecor-row-main { min-width: 0; }
.dfdecor-badges { display: flex; gap: 6px; color: #c9bba1; }
.dfdecor-badges:empty, .dfdecor-card:not([data-view="grid"]) .dfdecor-badges { display: none; }
.dfdecor-badge::before { margin: 0; }
.dfdecor-layout { flex: none; }
/* the lists as tiles: a picture, its name, its price, its badges */
.dfdecor-card[data-view="grid"] .dfdecor-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  grid-auto-rows: max-content; gap: 6px; padding: 6px; align-content: start; }
.dfdecor-card[data-view="grid"] .dfdecor-row { display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 5px; min-height: 148px; padding: 8px 6px 6px; text-align: center; box-sizing: border-box;
  border: 1px solid rgba(43, 50, 59, .9); background: rgba(10, 12, 15, .55); }
.dfdecor-card[data-view="grid"] .dfdecor-row[aria-selected="true"] { border-color: #b8943f; background: rgba(242, 196, 107, .12); }
.dfdecor-card[data-view="grid"] .dfdecor-thumb { flex: none; width: 76px; height: 76px; border-color: rgba(43, 50, 59, .5); background: rgba(0, 0, 0, .25); }
.dfdecor-card[data-view="grid"] .dfdecor-thumb img { width: 76px; height: 76px; max-width: none; max-height: none; object-fit: contain; }
.dfdecor-card[data-view="grid"] .dfdecor-thumb[data-dficon]::before { width: 46%; height: 46%; }
.dfdecor-card[data-view="grid"] .dfdecor-row-main { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
.dfdecor-card[data-view="grid"] .dfdecor-row-name { font-size: 13px; line-height: 1.25; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.dfdecor-card[data-view="grid"] .dfdecor-row-sub { display: none; }
.dfdecor-card[data-view="grid"] .dfdecor-row-price { font-size: 13px; }
.dfdecor-card[data-view="grid"] .dfdecor-row-end { flex-direction: column; align-items: stretch; width: 100%; margin-top: auto; gap: 4px; }
.dfdecor-card[data-view="grid"] .dfdecor-marks { width: 100%; }
.dfdecor-card[data-view="grid"] .dfdecor-marks > .dfdecor-mark:not(.dfdecor-fav) { flex: 1 1 auto; min-width: 0; padding: 2px 3px; font-size: 11px; white-space: normal; }
.dfdecor-marks > .dfdecor-fav { flex: 0 0 32px; width: 32px; height: 32px; min-width: 32px; max-width: 32px; min-height: 32px;
  padding: 0; aspect-ratio: 1; font-size: 16px; line-height: 1; }
.dfdecor-card[data-view="grid"] .dfdecor-empty { grid-column: 1 / -1; }
/* a side's presses as picture tiles - the glyph over its word */
.dfdecor-acts-btns > .dfdecor-btn[data-dficon] { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  min-height: 52px; min-width: 76px; padding: 5px 8px; font-size: 13px; line-height: 1.2; text-align: center; }
.dfdecor-acts-btns > .dfdecor-btn[data-dficon]::before { width: 20px; height: 20px; margin: 0; }
.dfdecor-acts-btns > .dfdecor-btn.flat[data-dficon] { flex-direction: row; min-height: 36px; gap: 8px; }
.dfdecor-acts-btns > .dfdecor-btn.flat[data-dficon]::before { width: 16px; height: 16px; }
.dfdecor-place[data-dficon]::before { width: 16px; height: 16px; }
.dfdecor-bar [data-dficon]::before { width: 14px; height: 14px; margin-right: 5px; }
.dfdecor-open[data-dficon]::before { width: 16px; height: 16px; }
@media (max-height: 480px) { .dfdecor-preview { min-height: 60px; } }   /* AUDIT HOME-STATIONS S5: a landscape phone keeps the acts on the card */
/* MENU-ORDER: a piece's own presses leave its picture smaller - the groups stand on the card, not below it */
.dfdecor-card:not([data-mode="catalogue"]):not([data-mode="look"]):not([data-mode="own"]) .dfdecor-preview { flex: none; min-height: 0; height: 92px; }
@media (max-width: 640px) {
  .dfdecor-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .dfdecor-preview { min-height: 90px; max-height: 120px; }
  /* MENU-ORDER: the list keeps a hand's height; the side below gives way and scrolls */
  .dfdecor-body { display: flex; flex-direction: column; gap: 8px; }
  .dfdecor-list { flex: 1 1 180px; min-height: 150px; }
  .dfdecor-side { flex: 0 1 auto; }
  .dfdecor-preview, .dfdecor-card:not([data-mode="catalogue"]):not([data-mode="look"]):not([data-mode="own"]) .dfdecor-preview { flex: none; min-height: 0; height: 72px; }
  .dfdecor-fgroup > .dfdecor-chips { flex-wrap: nowrap; overflow-x: auto; min-width: 0; }
  .dfdecor-fgroup > .dfdecor-chips > .dfdecor-chip { flex: none; }
  /* MENU-ORDER: a phone's rooms scroll sideways, and its filters fold behind one press, so the list keeps the screen. AUDIT
     MENU-ORDER U11: its views' tabs wrap, as they always did - scrolled, "Your things" and "Built in" stood off the screen */
  .dfdecor-roomsbar { flex-wrap: nowrap; overflow-x: auto; }
  .dfdecor-roomsbar > .dfdecor-chip { flex: none; }
  .dfdecor-ftoggle { display: inline-block; flex: none; }
  .dfdecor-filters:not([data-open="1"]) .dfdecor-fline-more { display: none; }
  .dfdecor-bar-keys { grid-template-columns: minmax(0, 1fr); }
  .dfdecor-card[data-view="grid"] .dfdecor-list { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); }
  .dfdecor-card[data-view="grid"] .dfdecor-row { min-height: 120px; }
  .dfdecor-card[data-view="grid"] .dfdecor-thumb, .dfdecor-card[data-view="grid"] .dfdecor-thumb img { width: 56px; height: 56px; }
  .dfdecor-layout { display: none; }
}
/* AUDIT MENU-ORDER U1: a short screen - a phone held landscape, as the touch layer asks - folds the filters as a narrow one
   does: every line open left a 390px-high screen's catalogue 36px, and the side's Place below its edge */
@media (max-height: 500px) {
  .dfdecor-ftoggle { display: inline-block; flex: none; }
  .dfdecor-filters:not([data-open="1"]) .dfdecor-fline-more { display: none; }
  .dfdecor-fgroup > .dfdecor-chips { flex-wrap: nowrap; overflow-x: auto; min-width: 0; }
  .dfdecor-fgroup > .dfdecor-chips > .dfdecor-chip { flex: none; }
}
`;

/** The sorts the panel offers (systems/decor/decorCatalogue.js filterDecor's). */
export const DECOR_SORTS = Object.freeze({ common: 'Most common', price: 'Cheapest', name: 'By name' });
/** MENU-ORDER: the two ways the lists are laid - pictures (tiles) or lines - and the views that tile (a room to rent and
 *  a part of the house to paint are words, never pictures). */
export const DECOR_LAYOUT_WORDS = Object.freeze({ grid: 'Pictures', list: 'List' });
export const DECOR_GRID_MODES = Object.freeze(['catalogue', 'look', 'own', 'room', 'base']);
/** MENU-ORDER: the names over the panel's rows of choices - its rooms, and each group of a side's presses. */
export const DECOR_ROOMS_WORD = 'Room';
export const DECOR_FILTERS_WORD = 'Filters';
export const DECOR_ACT_GROUPS = Object.freeze({
  get arrange() { return t('decor.panel.group.arrange', 'Arrange'); }, get use() { return t('decor.panel.group.use', 'Light and storage'); },   // a placed piece
  get station() { return t('decor.panel.group.station', 'Crafting station'); },
  get piece() { return t('decor.panel.group.piece', 'This piece'); }, get whole() { return t('decor.panel.group.whole', 'The whole room'); },   // BASE-HIDE: the room's own furniture
  get price() { return t('decor.panel.group.price', 'Price a day'); }, get offer() { return t('decor.panel.group.offer', 'Offer this room'); },   // HOME-RENT
  get rent() { return t('decor.panel.group.rent', 'Rent held'); },
});
/** MENU-ORDER: the painter's rows - a part's climate, then its building's style (walls, windows) or its own (a roof, a
 *  door); a caravan's part, its paint. */
export const DECOR_PAINT_WORDS = Object.freeze({
  get climate() { return t('decor.panel.paint.climate', 'Climate'); }, get set() { return t('decor.panel.paint.set', 'Building style'); },
  get style() { return t('decor.panel.paint.style', 'Style'); }, get paint() { return t('decor.panel.paint.paint', 'Paint'); },
});
/** MENU-ORDER: the phone's filter fold, and how many filters it hides that are chosen (a kind each, a size, holding,
 *  light) - "Filters" with none. */
export function decorFiltersText({ kinds, size, storage, light, fav = false }) {
  const n = (kinds?.size ?? 0) + (size != null ? 1 : 0) + (storage != null ? 1 : 0) + (light != null ? 1 : 0) + (fav ? 1 : 0);
  return n ? `${DECOR_FILTERS_WORD} (${n})` : DECOR_FILTERS_WORD;
}

/** A price as the surfaces say it; a piece whose size is still being read has none yet. */
export const decorPriceText = (price) => (price == null ? '...' : `${price} gold`);

/**
 * WHY A PIECE CANNOT BE PLACED, or null when it can: its size is still being read (or could not be), the room is
 * full, or the gold is short. AUDIT GUILD-YARD: `hall` - a guild hall's yard is the hall's, never "your yard".
 * @param {{ price: number|null, ready: boolean, gold: number, count: number, cap: number, yard?: boolean, hall?: boolean }} v
 */
export function decorWhyNot({ price, ready, gold, count, cap, yard = false, hall = false }) {
  if (price == null) return ready ? 'Its size cannot be read, so it has no price.' : 'Its size is still being read.';
  if (count >= cap) return `${yard ? (hall ? "The hall's yard" : 'Your yard') : 'This room'} already holds ${cap} pieces.`;   // HOME-YARD (AUDIT): a yard said "this room"; AUDIT GUILD-YARD: a hall's yard is nobody's own
  if (price > gold) return `You need ${price - gold} more gold.`;
  return null;
}

/** WHY A PLACED PIECE CANNOT BE REMOVED, or stop holding things: what it holds would go with it. */
export const DECOR_HOLDS_LINE = 'It holds things. Empty it first.';
/** BASE-HIDE: what a built-in piece's row says under its name - in the room or taken out, and how far it stands. */
export const decorBaseSub = ({ hidden, dist }) => `${hidden ? 'Taken out' : 'In the room'}${Number.isFinite(dist) ? ` - ${Math.max(0, Math.round(dist))} m away` : ''}`;
/** BASE-HIDE: the built-in view's line when the room has no furniture of its own to take out. */
export const DECOR_BASE_EMPTY = 'This room has no furniture of its own to take out.';

/** What removing a piece gives back, as said (the law's half, net/decorLaw.js decorRefund). */
export const decorRefundText = (paid) => `${decorRefund(paid)} gold`;

/** DECOR2b: where one's own piece goes when it is taken down - the pack, or (furniture, never carried) "Your things". */
export const decorBackTo = (piece) => (piece?.item?.g === DECOR_FURNITURE_GROUP ? 'Your things' : 'your pack');
/** What one placed piece's row says under its name. DECOR2a: one's own item says so - it cost nothing and goes back
 *  to the pack (DECOR2b: or, furniture, to "Your things"). */
export function decorPlacedSub({ piece, holds }) {
  const first = piece.item ? `yours, back to ${decorBackTo(piece)} when taken down` : `placed for ${piece.paid} gold`;
  return [first, piece.storage ? (holds ? 'holds things (not empty)' : 'holds things') : null, piece.light ? 'gives light' : null,
    piece.station ? DECOR_STATION_NAMES[piece.station].toLowerCase() : null]   // HOME-STATIONS
    .filter(Boolean).join(' - ');
}
/** HOME-STATIONS: the two station buttons' words for a placed piece - the craft offered (the chooser) and the act on
 *  it: made (its licence's price), or unmade (nothing back). */
export function decorStationWords(piece, offered, armed = false) {
  const kind = DECOR_STATIONS.includes(offered) ? offered : DECOR_STATIONS[0];
  const pick = `Station: ${DECOR_STATION_NAMES[kind].replace(/ station$/, '')} >`;
  const gold = `${DECOR_STATION_FEES[kind].toLocaleString('en-US')} gold`;
  // AUDIT HOME-STATIONS S4: unmaking is asked twice - the one button flips in place, and a double click that made a
  // station unmade it on the next frame, the licence gone
  if (piece?.station === kind) return armed ? { pick, act: 'Press again to destroy it. Nothing is returned', what: 'station:none' } : { pick, act: 'Unmake station (nothing back)', what: 'arm' };
  // AUDIT HOME-STATIONS S6: a change of craft names that the old licence goes
  if (piece?.station) return { pick, act: `Change station - ${gold} (no refund)`, what: `station:${kind}` };
  return { pick, act: `Make station - ${gold}`, what: `station:${kind}` };
}
/** DECOR2a: what an item in the pack says under its name in the "Your things" list. */
export const DECOR_OWN_LINE = 'yours, free to set down, and back to your pack when taken down';
/** DECOR2c: and a weapon or a piece of armour there (ARMOR-MOUNT) - it hangs on a wall. */
export const DECOR_MOUNT_LINE = 'yours, free to hang on a wall, and back to your pack when taken down';
/** The line an own entry says - a delivered piece's, a mount's, or a thing's from the pack. */
const ownLine = (e) => (e.furnishing ? decorFurnishLine(e) : e.mount ? DECOR_MOUNT_LINE : DECOR_OWN_LINE);
/** DECOR2b: what a piece of delivered furniture says there - never carried; set down free as the piece of its kinds the
 *  owner chooses (or, a pillow, as itself), and back here when taken down. */
export function decorFurnishLine(e) {
  const as = e?.looks ? ` as any of the ${e.looks.map((k) => DECOR_KINDS[k].toLowerCase()).join(' or ')} you choose` : '';
  return `delivered, free to set down${as}, and back here when taken down`;
}
/** DECOR2b: the look view's words - its button in "Your things", and its line while no look is chosen. */
export const DECOR_LOOK_BUTTON = 'Choose its look';
export const DECOR_LOOK_LINE = 'Choose how it looks. Any of these costs nothing.';

/** HOME-DOORS: what a door says beside its line - it hangs in a doorway, and how many this house has free (null: still
 *  being found). */
export const decorDoorLine = (n) => (n == null ? 'hangs in a doorway. Finding the doorways...' : n === 0 ? 'hangs in a doorway. This house has none free'
  : `hangs in a doorway - ${n} free here, marked while you place it`);
/** HOME-LOOK: what a part's choice reads as - its set and climate, its climate and its number, or the town's own. */
export function decorLookText(part, choice) {
  if (!choice) return "The town's own";
  if (part === 'walls' || part === 'windows') return `${HOME_LOOK_SET_NAMES[choice.set]}, ${HOME_LOOK_CLIMATE_NAMES[choice.climate]}`;
  return `${HOME_LOOK_CLIMATE_NAMES[choice.climate]}, style ${choice.record + 1}`;
}
/** HOME-LOOK: the choice a part starts from when its first chip is pressed - the town's own, turned into a choice. */
export const decorLookStart = (part) => (part === 'walls' || part === 'windows' ? { set: 'village', climate: 'temperate' } : { climate: 'temperate', record: 0 });
/** HOME-LOOK: how many styles a roof or a door offers in the painter at the most - fewer where its family holds fewer
 *  (the painter's door's `records`). */
export const DECOR_LOOK_STYLES = 6;
/** HOME-RENT: what the rooms view says with no room to offer - a house of one room, or rooms still being found. */
export const DECOR_RENT_ONE_ROOM = 'A one-room house has no room to rent out. Hang a door in a doorway to split it into two.';
export const DECOR_RENT_FINDING = 'Finding the rooms of your house...';
/** HOME-RENT: the rent waiting to be collected, as the rooms view says it. */
export const decorRentDueText = (due) => (due > 0 ? `Collect rent: ${due} gold` : 'No rent to collect');
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
 * THE BUTTON. `onPress()` starts decorating; `render(up)` stands it or takes it away (the host's frame).
 * @param {{ onPress: () => void, touch?: boolean, doc?: any }} opts
 */
export function createDecorButton({ onPress, touch = false, doc = document }) {
  injectStyle(doc);
  const el = maker(doc);
  const btn = el('button', `dfdecor-open${touch ? ' touch' : ''}`, 'Decorate');
  btn.type = 'button';
  btn.dataset.dficon = 'decorate';   // MENU-ORDER
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
 *   entries   - the catalogue (systems/decor/decorScan.js), or null while the blocks are read
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
 * NUDE-DECOR: `thumbKeyOf(entry)` - the key that picture is kept under (the entry's own, unless the host draws it as
 * another picture now - a figure's stand-in);
 * DECOR1e: `onMove(piece)`, `onRemove(piece)`, `onToggle(piece, 'light'|'storage')` - a placed piece's four changes;
 * `onDuplicate(piece)` - a copy of the chosen piece, placed as a new one;
 * DECOR-TURN: `onTurn(piece, dir)` - and turned where it stands, a step left (-1) or right (1).
 * BASE-HIDE: `base` in the view - the room's own furniture, each `{ key, name, kind, model, flat, shape, hidden, holds,
 * dist }`, nearest first; `onBase(keys, out)` - those pieces taken out of the room (`out`) or put back, free.
 * DECOR-ROOMS: `rooms` and `roomId` in the view - a house's rooms (`{ id, name }`, two or more) and the one chosen, and
 * `room` on each placed and built-in piece; `onRoom(id)` - a room's tab chosen.
 * @param {{ onPlace: (entry: any) => void, onClose?: () => void, onPoint?: (entry: any) => void,
 *   thumbOf?: (entry: any) => Promise<string|null>|null, onMove?: (piece: any) => void, onDuplicate?: (piece: any) => void, onRemove?: (piece: any) => void,
 *   onToggle?: (piece: any, what: string) => void, onTurn?: (piece: any, dir: number) => void, onRename?: (piece: any) => void, onAccess?: (piece: any) => void, onPlaceLook?: (furniture: any, look: any) => void,
 *   onBase?: (keys: string[], out: boolean) => void, onRoom?: (id: number) => void, onRent?: (what: string, row: any, price: number|null) => void,
 *   onPaint?: (what: string, look: any) => void, onHot?: (key: string) => void, useLabel?: (piece: any) => string, doc?: any, win?: any, thumbKeyOf?: (entry: any) => string }} opts
 */
export function createDecorPanel({
  onPlace, onClose = () => {}, onPoint = () => {}, thumbOf = () => null, onMove = () => {}, onDuplicate = () => {}, onRemove = () => {}, onToggle = () => {},
  onTurn = () => {}, onRename = () => {}, onAccess = () => {}, useLabel = () => t('decor.panel.useMe', 'Who may use: Me'), onPlaceLook = () => {}, onBase = () => {}, onRoom = () => {}, onRent = () => {}, onPaint = () => {}, onHot = () => {}, doc = document, win = globalThis,
  thumbKeyOf = (e) => e.key,
}) {
  injectStyle(doc);
  const el = maker(doc);
  const root = el('div', 'dfdecor');
  root.dataset.state = 'closed';
  const kindTip = el('div', 'dfdecor-tip');
  kindTip.hidden = true;
  kindTip.setAttribute('role', 'tooltip');
  root.append(kindTip);
  function hideKindTip() { kindTip.hidden = true; }
  function showKindTip(btn, text) {
    const r = btn.getBoundingClientRect?.();
    if (!r || !r.width) return;
    kindTip.textContent = text;
    kindTip.hidden = false;
    kindTip.style.left = `${r.left + r.width / 2}px`;
    kindTip.style.top = `${r.top}px`;
  }
  const card = el('div', 'dfdecor-card');
  card.dataset.mode = 'catalogue';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Decorate');
  root.append(card);
  swallowPresses(card);

  const head = el('div', 'dfdecor-head');
  const whereLine = el('div', 'dfdecor-where');
  whereLine.hidden = true;
  const close = el('button', 'dfdecor-btn dfdecor-close', 'Close');
  close.type = 'button';
  // MENU-ORDER: the lists as pictures (tiles) or as lines - the player's choice, kept while the panel stands
  const layoutChips = el('div', 'dfdecor-chips dfdecor-layout');
  // DECOR1e: the two views - the catalogue to place from, and the pieces already in the room to change
  const tabs = el('div', 'dfdecor-chips dfdecor-tabs');
  head.append(whereLine, tabs, layoutChips, close);
  tabs.setAttribute('role', 'tablist');
  // MENU-ORDER: a house's rooms are a row of their own under the views (DECOR-ROOMS drew them among the tabs)
  const roomsBar = el('div', 'dfdecor-roomsbar');
  const filters = el('div', 'dfdecor-filters');
  const search = el('input', 'dfdecor-search');
  search.type = 'search';
  search.setAttribute('placeholder', t('decor.panel.search', 'Search by name'));
  search.setAttribute('aria-label', 'Search the catalog');
  const kindChips = el('div', 'dfdecor-chips dfdecor-kinds');
  const sizeChips = el('div', 'dfdecor-chips');
  const hasChips = el('div', 'dfdecor-chips dfdecor-has');
  const sortChips = el('div', 'dfdecor-chips');
  // MENU-ORDER: each row of chips stands under its name - Type, Size, Show only, Sort - and a phone folds all but the
  // search and the sort behind one press, which says how many are chosen
  const group = (label, chips, cls) => { const g = el('div', `dfdecor-fgroup ${cls}`); g.append(el('span', 'dfdecor-flabel', label), chips); return g; };
  const filterToggle = el('button', 'dfdecor-chip dfdecor-ftoggle', DECOR_FILTERS_WORD);
  filterToggle.type = 'button';
  filterToggle.setAttribute('aria-expanded', 'false');   // AUDIT MENU-ORDER U15: folded, said from the first
  filterToggle.addEventListener('click', () => { filters.dataset.open = filters.dataset.open === '1' ? '0' : '1'; filterToggle.setAttribute('aria-expanded', filters.dataset.open === '1' ? 'true' : 'false'); });
  const searchGroup = el('div', 'dfdecor-fgroup dfdecor-fg-search');
  searchGroup.append(search, filterToggle);
  const lineOne = el('div', 'dfdecor-fline');
  lineOne.append(searchGroup, group(t('decor.panel.filter.sort', 'Sort'), sortChips, 'dfdecor-fg-sort'));
  const lineTwo = el('div', 'dfdecor-fline dfdecor-fline-more');
  lineTwo.append(group(t('decor.panel.filter.type', 'Type'), kindChips, 'dfdecor-fg-kinds'));
  const lineThree = el('div', 'dfdecor-fline dfdecor-fline-more');
  lineThree.append(group(t('decor.panel.filter.size', 'Size'), sizeChips, 'dfdecor-fg-size'), group(t('decor.panel.filter.has', 'Show only'), hasChips, 'dfdecor-fg-has'));
  filters.append(lineOne, lineTwo, lineThree);

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
  const sideFav = el('button', 'dfdecor-btn dfdecor-mark dfdecor-fav', 'Favourite');
  sideFav.type = 'button';
  const sideHot = el('button', 'dfdecor-btn dfdecor-mark', 'Hotbar');
  sideHot.type = 'button';
  const placeRow = el('div', 'dfdecor-place-row');
  placeRow.append(sideFav, sideHot, place);
  const roomActions = el('div', 'dfdecor-room-actions');
  const act = (label, fn) => { const b = el('button', 'dfdecor-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; };
  /** MENU-ORDER: a group of a side's presses under its name (none: a row set apart). */
  const actGroup = (label, btns, cls = '') => {
    const g = el('div', cls ? `dfdecor-acts ${cls}` : 'dfdecor-acts');
    const row = el('div', 'dfdecor-acts-btns');
    row.append(...btns);
    g.append(el('div', 'dfdecor-acts-label', label), row);
    return g;
  };
  const moveBtn = act('Move', () => { const it = placedSelected(); if (it && !moveBtn.disabled) { hide(); onMove(it.piece); } });
  const renameBtn = act('Rename', () => { const it = placedSelected(); if (it && !renameBtn.disabled) onRename(it.piece); });
  const dupBtn = act('Duplicate', () => { const it = placedSelected(); if (it && !dupBtn.disabled) { hide(); onDuplicate(it.piece); } });
  // DECOR-TURN (Mac: "the ability to rotate objects on the ground"): the chosen piece turned where it stands, the panel up
  const turnBtn = (label, dir) => { const b = act(label, () => { const it = placedSelected(); if (it && !b.disabled) onTurn(it.piece, dir); }); return b; };
  const turnLeftBtn = turnBtn('Turn left', -1), turnRightBtn = turnBtn('Turn right', 1);
  const lightBtn = act('Light', () => { const it = placedSelected(); if (it) onToggle(it.piece, 'light'); });
  const storeBtn = act('Holds things', () => { const it = placedSelected(); if (it && !storeBtn.disabled) onToggle(it.piece, 'storage'); });
  const accessBtn = act(t('decor.panel.useMe', 'Who may use: Me'), () => { const it = placedSelected(); if (it && !accessBtn.disabled) onAccess(it.piece); });
  const removeBtn = act('Remove', () => { const it = placedSelected(); if (it && !removeBtn.disabled) onRemove(it.piece); });
  // HOME-STATIONS: the craft offered (cycled, free) and the act on it (made for its licence, or unmade)
  let stationOffer = DECOR_STATIONS[0], stationFor = null, stationArmed = null;   // the offer follows a newly chosen piece's own craft
  const stationPick = act('Station', () => { const o = stationsOffered(view?.trader !== false); stationOffer = o[(o.indexOf(stationOffer) + 1) % o.length]; stationArmed = null; paintRoomSide(); });
  // AUDIT HOME-STATIONS S3: the act is the one the button SAYS (painted with it), never re-read from a newer piece
  const stationBtn = act('Make station', () => {
    const it = placedSelected();
    if (!it || stationBtn.disabled) return;
    const what = stationBtn.dataset.what;
    if (what === 'arm') { stationArmed = it.piece.id; paintRoomSide(); return; }
    stationArmed = null;
    if (what) onToggle(it.piece, what);
  });
  for (const b of [lightBtn, storeBtn, stationPick, stationBtn]) b.className += ' dfdecor-yardless';   // HOME-YARD
  for (const b of [stationPick, stationBtn]) b.className += ' flat';   // MENU-ORDER: a long word lies beside its picture
  removeBtn.className += ' warn flat';   // MENU-ORDER: a press that costs something, edged in blood (enhancedFrame.js FRAME_ROLES.warn)
  // MENU-ORDER: the eight presses in four named groups, not one wrapping row - where it stands, what it does, the craft it
  // serves, and taking it away (its own row, last); the yard's three a group of their own, hidden with it
  roomActions.append(actGroup(DECOR_ACT_GROUPS.arrange, [moveBtn, dupBtn, turnLeftBtn, turnRightBtn, renameBtn]),
    actGroup(DECOR_ACT_GROUPS.use, [lightBtn, storeBtn, accessBtn], 'dfdecor-yardless'),
    actGroup(DECOR_ACT_GROUPS.station, [stationPick, stationBtn], 'dfdecor-yardless'),
    actGroup('', [removeBtn]));
  // BASE-HIDE: the room's own furniture - the chosen piece out or back, and the whole room at once
  const baseActions = el('div', 'dfdecor-base-actions');
  const baseBtn = act('Take out', () => { const it = baseSelected(); if (it && !baseBtn.disabled) onBase([it.key], !it.hidden); });
  // DECOR-ROOMS: "all" is the chosen room's all, where the house has rooms to choose between
  const allOutBtn = act('Take all out', () => { const ks = roomed(view?.base ?? []).filter((it) => !it.hidden && !it.holds && !it.door).map((it) => it.key); if (ks.length) onBase(ks, true); });
  const allBackBtn = act('Put all back', () => { const ks = roomed(view?.base ?? []).filter((it) => it.hidden && !it.door).map((it) => it.key); if (ks.length) onBase(ks, false); });
  baseActions.append(actGroup(DECOR_ACT_GROUPS.piece, [baseBtn]), actGroup(DECOR_ACT_GROUPS.whole, [allOutBtn, allBackBtn]));
  // HOME-RENT: the chosen room's price moved, offered or withdrawn - and the rent held, collected
  const rentActions = el('div', 'dfdecor-rent-actions');
  const priceBtns = RENT_PRICE_STEPS.map((step) => act(`${step > 0 ? '+' : ''}${step}`, () => { const it = rentSelected(); if (!it) return; rentPrices.set(rentKeyOf(it), rentPriceStep(rentPriceOf(it), step)); paintRentSide(); }));
  const offerBtn = act('Offer to rent', () => { const it = rentSelected(); if (it && !offerBtn.disabled) onRent('offer', it, rentPriceOf(it)); });
  const withdrawBtn = act('Stop offering', () => { const it = rentSelected(); if (it && !withdrawBtn.disabled) onRent('withdraw', it, null); });
  const collectBtn = act('Collect rent', () => { if (!collectBtn.disabled) onRent('collect', null, null); });
  rentActions.append(actGroup(DECOR_ACT_GROUPS.price, priceBtns), actGroup(DECOR_ACT_GROUPS.offer, [offerBtn, withdrawBtn]),
    actGroup(DECOR_ACT_GROUPS.rent, [collectBtn]));
  // HOME-LOOK: the chosen part's climates and its sets or styles, the town's own, and the look painted or put back
  const paintActions = el('div', 'dfdecor-paint-actions');
  const paintClimates = el('div', 'dfdecor-chips');
  const paintKinds = el('div', 'dfdecor-chips');
  // FB1001 LOOK-BUTTONS: a row of its own - classed as the rent's, the sheet hid it in every tab but "Rooms to rent", so
  // a look could be tried and never painted
  const paintBtns = el('div', 'dfdecor-paint-btns');
  const ownBtn = act("The town's own", () => { if (!paintPart || !paintLook) return; delete paintLook[paintPart]; tryLook(); });
  const paintBtn = act('Paint it', () => { if (!paintBtn.disabled) onPaint('commit', homeLookOf(paintLook)); });
  const backBtn = act('Put back', () => { paintLook = { ...(view?.paint?.current ?? {}) }; tryLook(); });
  paintBtns.append(ownBtn, paintBtn, backBtn);
  // MENU-ORDER: the painter's two rows of choices under their names (the caravan's one, its paints)
  const climateLabel = el('div', 'dfdecor-acts-label');
  const paintKindsLabel = el('div', 'dfdecor-acts-label');
  const climateGroup = el('div', 'dfdecor-acts');
  climateGroup.append(climateLabel, paintClimates);
  const paintKindsGroup = el('div', 'dfdecor-acts');
  paintKindsGroup.append(paintKindsLabel, paintKinds);
  paintActions.append(climateGroup, paintKindsGroup, paintBtns);
  const pickWhy = el('div', 'dfdecor-pick-why');
  // MENU-ORDER: why it cannot be done stands with what it costs, above the press it stops - never under every group
  side.append(preview, pickName, pickLine, pickPrice, pickWhy, placeRow, roomActions, baseActions, rentActions, paintActions);
  // MENU-ORDER: each press its picture, beside its word
  for (const b of [offerBtn, withdrawBtn, collectBtn]) b.className += ' flat';
  for (const [b, icon] of [[place, 'place'], [moveBtn, 'move'], [dupBtn, 'place'], [turnLeftBtn, 'turn-left'], [turnRightBtn, 'turn-right'], [lightBtn, 'light'],
    [storeBtn, 'storage'], [accessBtn, 'list'], [stationPick, 'list'], [stationBtn, 'station'], [removeBtn, 'remove'], [baseBtn, 'take-out'], [allOutBtn, 'take-out'],
    [allBackBtn, 'put-back'], [offerBtn, 'rent'], [withdrawBtn, 'remove'], [collectBtn, 'treasure'], [ownBtn, 'back'], [paintBtn, 'paint'], [backBtn, 'back']]) b.dataset.dficon = icon;
  body.append(list, side);

  const foot = el('div', 'dfdecor-foot');
  const footCount = el('span', '');
  const footGold = el('span', '');
  const footStatus = el('span', '');
  foot.append(footCount, footGold, footStatus);

  card.append(head, roomsBar, filters, body, foot);
  doc.body?.append(root);

  // ── state ────────────────────────────────────────────────────────
  let alive = true;
  let open = false;
  let unregister = () => {};
  /** @type {any} */
  let view = null;
  const f = { kinds: new Set(), text: '', size: null, storage: null, light: null, fav: false, sort: 'common' };
  let selectedKey = null;
  let hoverKey = null;
  let layout = 'grid';        // MENU-ORDER: 'grid' (pictures) or 'list'
  let mode = 'catalogue';     // DECOR1e: or 'room'; DECOR2a: or 'own'; DECOR2b: or 'look'; BASE-HIDE: or 'base'; HOME-RENT: or 'rent'
  let rentKey = null;         // HOME-RENT: the room chosen in the rooms view
  let paintPart = null;       // HOME-LOOK: the part chosen in the painter
  /** @type {any} HOME-LOOK: the look being tried, before it is painted */
  let paintLook = null;
  /** @type {Map<string, number>} HOME-RENT: a price being set for a room, before it is offered */
  const rentPrices = new Map();
  let baseKey = null;         // BASE-HIDE: the built-in piece chosen
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
  const waiting = new Map();  // key -> the images waiting on its picture (the rows drawn since it was asked)
  /** @type {Set<string>} the pictures asked and not yet answered */
  const inFlight = new Set();
  /** Ask for a flat's picture once; every image waiting on it gets it, and the preview if it shows that piece. AUDIT
   *  MENU-ORDER C4: an image waits only on a picture in flight - one known to be none to be had keeps its glyph and is
   *  never listed (a list never emptied grew by every tile at every redraw), and a refusal empties the list as an
   *  answer does. */
  function askThumb(e, img = null) {
    const k = thumbKeyOf(e);
    const known = thumbs.get(k);
    if (known) { img?.setAttribute('src', known); return; }
    if (thumbs.has(k) && !inFlight.has(k)) return;   // none to be had
    if (img) waiting.set(k, [...(waiting.get(k) ?? []), img]);
    if (inFlight.has(k)) return;
    thumbs.set(k, null);
    inFlight.add(k);
    const settle = (url) => {
      inFlight.delete(k);
      thumbs.set(k, url ?? null);
      const imgs = waiting.get(k) ?? [];
      waiting.delete(k);
      if (!url || !alive) return;
      for (const i of imgs) i.setAttribute('src', url);
      if ((hoverKey ?? selectedKey) === e.key) paintSide();
    };
    Promise.resolve(thumbOf(e)).then(settle, () => settle(null));
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

  /** MENU-ORDER: A MODEL'S OWN PICTURE IN ITS TILE - asked as a flat's is (when its row comes into view, if `r` is one the
   *  observer can watch), drawn over the kind's glyph, which stands until it lands and wherever the host draws none. */
  function modelPicture(thumb, shape, r = null) {
    const img = el('img', 'dfdecor-modelpic');
    img.setAttribute('alt', '');
    thumb.append(img);
    const known = thumbs.get(thumbKeyOf(shape));
    if (known) img.setAttribute('src', known);
    else if (r && watcher) { r.decorThumb = () => askThumb(shape, img); watcher.observe(r); } else askThumb(shape, img);
  }

  const placedSelected = () => (view?.placed ?? []).find((it) => it.piece.id === placedId) ?? null;
  /** HOME-RENT: a room row's own key (a found room by its number, an offer whose walls changed by the offer's), the row
   *  chosen, and the price shown for it - the one being set, else the one it is offered at, else the first. */
  const rentKeyOf = (it) => (it.id != null ? `r${it.id}` : `o${it.offer?.room}`);
  const rentSelected = () => (view?.rent?.rows ?? []).find((it) => rentKeyOf(it) === rentKey) ?? null;
  const rentPriceOf = (it) => rentPrices.get(rentKeyOf(it)) ?? it.offer?.price ?? RENT_PRICE_FIRST;
  /** DECOR-ROOMS (2026-09-27, Discord: "For a house with multiple connects, add room switching tabs"): a house of two
   *  rooms or more lists the chosen room's pieces - its placed ones and its own furniture - and a piece the host could
   *  not stand in any room (none beneath it) in every one, so nothing is lost from the lists. */
  const roomsUp = () => Array.isArray(view?.rooms) && view.rooms.length > 1 && view.roomId != null;
  const roomed = (list) => (roomsUp() ? list.filter((it) => it.room == null || it.room === view.roomId) : list);
  /** What the preview shows for a placed piece: its catalogue entry, or the piece's own shape until the catalogue is read.
   *  AUDIT DYE-ICON 1: the shape carries the piece's item, so a hung one's picture is asked dyed (decorTool.js thumbOf). */
  const placedShape = (it) => it.entry ?? { key: `placed:${it.piece.id}`, model: it.piece.model, flat: it.piece.flat, item: it.piece.item ?? null, kind: 'decor', name: it.name };
  const ownSelected = () => (view?.own ?? []).find((e) => e.key === ownKey) ?? null;
  /** BASE-HIDE: the built-in piece chosen, and what the preview shows for it - its model turning, or its picture. */
  const baseSelected = () => (view?.base ?? []).find((it) => it.key === baseKey) ?? null;
  const baseShape = (it) => ({ key: it.shape, model: it.model, flat: it.flat, kind: it.kind, name: it.name });
  /** DECOR2b: the furniture the look view is for (still among "Your things"), and the look chosen - one of its kinds'. */
  const lookOf = () => (view?.own ?? []).find((e) => e.key === lookFor && e.looks) ?? null;
  const lookSelected = () => {
    const furn = lookOf();
    return furn ? (view?.entries ?? []).find((e) => e.key === lookKey && furn.looks.includes(e.kind)) ?? null : null;
  };
  const shown = () => {
    if (mode === 'room') { const it = placedSelected(); return it ? placedShape(it) : null; }
    if (mode === 'base') { const it = baseSelected(); return it ? baseShape(it) : null; }
    if (mode === 'own') return (view?.own ?? []).find((e) => e.key === (hoverKey ?? ownKey)) ?? null;
    return (view?.entries ?? []).find((e) => e.key === (hoverKey ?? (mode === 'look' ? lookKey : selectedKey))) ?? null;
  };
  const selected = () => (mode === 'own' ? ownSelected() : mode === 'look' ? lookSelected()
    : (view?.entries ?? []).find((e) => e.key === selectedKey) ?? null);
  const priceOf = (e) => (e && view?.priceOf ? view.priceOf(e) : null);
  const radiusOf = (e) => (e && view?.radiusOf ? view.radiusOf(e) : null);

  function chip(label, pressed, onClick, icon = null, iconOnly = false) {
    const c = el('button', iconOnly ? 'dfdecor-chip dfdecor-kicon' : 'dfdecor-chip', iconOnly ? '' : label);
    c.type = 'button';
    if (icon) c.dataset.dficon = icon;   // MENU-ORDER
    if (iconOnly) {
      c.setAttribute('aria-label', label);
      c.addEventListener('mouseenter', () => showKindTip(c, label));
      c.addEventListener('mouseleave', hideKindTip);
      c.addEventListener('focus', () => showKindTip(c, label));
      c.addEventListener('blur', hideKindTip);
    }
    c.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    c.addEventListener('click', onClick);
    return c;
  }
  /** MENU-ORDER: a row's badges - a picture each for what the piece does (holds things, gives light, serves a craft),
   *  each named on the hover and to a reader; drawn where the tiles hide the row's words. */
  function badges({ storage = false, light = false, station = false }) {
    const b = el('span', 'dfdecor-badges');
    const one = (icon, word) => { const x = el('span', 'dfdecor-badge'); x.dataset.dficon = icon; x.title = word; x.setAttribute('aria-label', word); return x; };
    if (storage) b.append(one('storage', t('decor.panel.badge.storage', 'Holds things')));
    if (light) b.append(one('light', t('decor.panel.badge.light', 'Gives light')));
    if (station) b.append(one('station', t('decor.panel.badge.station', 'A crafting station')));
    return b;
  }
  function drawTabs() {
    if (card.dataset.yard !== (view?.yard ? '1' : '0')) card.dataset.yard = view?.yard ? '1' : '0';
    if (view?.yard) {   // HOME-YARD: the catalogue, the yard's pieces, and (HOME-LOOK) the house outside
      tabs.replaceChildren(chip('Catalog', mode === 'catalogue', () => setMode('catalogue'), 'all'), chip(`In this yard (${(view.placed ?? []).length})`, mode === 'room', () => setMode('room'), 'nature'),
        ...(view.paint ? [chip('Exterior', mode === 'paint', () => setMode('paint'), 'paint')] : []));   // MENU-ORDER: each view's tab its picture
      roomsBar.replaceChildren();
      return;
    }
    const n = roomed(view?.placed ?? []).length;
    const m = view?.own?.length ?? 0;
    const k = roomed(view?.base ?? []).length;
    tabs.replaceChildren(chip('Catalog', mode === 'catalogue', () => setMode('catalogue'), 'all'), chip(`In this room (${n})`, mode === 'room', () => setMode('room'), 'room'),
      chip(`Your things (${m})`, mode === 'own' || mode === 'look', () => setMode('own'), 'own'),   // DECOR2b: a look is chosen within them
      chip(`Built in (${k})`, mode === 'base', () => setMode('base'), 'furniture'),   // BASE-HIDE: the room's own furniture
      ...(view?.rent ? [chip(`Rooms to rent (${(view.rent.rows ?? []).filter((r) => r.offer).length})`, mode === 'rent', () => setMode('rent'), 'rent')] : []),   // HOME-RENT
      ...(view?.paint?.caravan ? [chip('Paint', mode === 'paint', () => setMode('paint'), 'paint')] : []));   // WAGONS2: a caravan's inside, painted; MENU-ORDER: each tab its picture
    roomsBar.replaceChildren(...roomChips());   // DECOR-ROOMS; MENU-ORDER: a row of their own
  }
  /** DECOR-ROOMS: THE ROOM TABS - one a room, the chosen one pressed, each saying how many pieces stand in it. Choosing
   *  one is the host's (where the next flight begins); the lists follow on the next view. */
  function roomChips() {
    if (!roomsUp()) return [];
    const placed = view.placed ?? [];
    return [el('span', 'dfdecor-flabel dfdecor-rooms-label', DECOR_ROOMS_WORD), ...view.rooms.map((r) => {
      const c = el('button', 'dfdecor-chip dfdecor-room', `${r.name} (${placed.filter((it) => it.room === r.id).length})`);
      c.type = 'button';
      c.dataset.room = String(r.id);
      c.setAttribute('aria-pressed', r.id === view.roomId ? 'true' : 'false');
      c.addEventListener('click', () => { if (r.id !== view.roomId) onRoom(r.id); });
      return c;
    })];
  }
  function setMode(m) {
    if (mode === m) return;
    if (mode === 'paint') { paintLook = null; onPaint('reset', null); }   // HOME-LOOK: a look tried and left is put away
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
      const known = thumbs.get(thumbKeyOf(shape));
      if (known) img.setAttribute('src', known); else askThumb(shape, img);
    } else {
      thumb.textContent = (DECOR_KINDS[shape.kind] ?? 'Decorations').slice(0, 2);
      thumb.dataset.dficon = DECOR_KINDS[shape.kind] ? shape.kind : 'decor';   // MENU-ORDER: its kind's picture over the letters
      if (shape.model != null) modelPicture(thumb, shape);   // ...and its own over that
    }
    const main = el('span', 'dfdecor-row-main');
    main.append(el('div', 'dfdecor-row-name', it.name), el('div', 'dfdecor-row-sub', decorPlacedSub(it)),
      badges({ storage: !!it.piece.storage, light: !!it.piece.light, station: !!it.piece.station }));   // MENU-ORDER: what it does, as pictures
    r.append(thumb, main, el('span', 'dfdecor-row-price', it.piece.item ? 'yours' : `${decorRefundText(it.piece.paid)} back${view?.hall ? ' to the guild' : ''}`));   // AUDIT GUILD1d A9: a hall's half is the guild's
    r.addEventListener('click', () => { placedId = it.piece.id; redraw(); });
    return r;
  }
  /** BASE-HIDE: one of the room's own pieces - its picture (a flat's) or its kind's letters, its name, where it is. */
  function baseRow(it) {
    const r = el('div', it.hidden ? 'dfdecor-row dim' : 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = it.key;
    r.setAttribute('aria-selected', it.key === baseKey ? 'true' : 'false');
    const thumb = el('span', 'dfdecor-thumb');
    if (it.flat) {
      const img = el('img', '');
      img.setAttribute('alt', '');
      thumb.append(img);
      const shape = baseShape(it);
      const known = thumbs.get(thumbKeyOf(shape));
      if (known) img.setAttribute('src', known); else askThumb(shape, img);
    } else {
      thumb.textContent = (DECOR_KINDS[it.kind] ?? DECOR_KINDS.furniture).slice(0, 2);
      thumb.dataset.dficon = DECOR_KINDS[it.kind] ? it.kind : 'furniture';   // MENU-ORDER
      if (it.model != null) modelPicture(thumb, baseShape(it));
    }
    const main = el('span', 'dfdecor-row-main');
    main.append(el('div', 'dfdecor-row-name', it.name), el('div', 'dfdecor-row-sub', decorBaseSub(it)));
    r.append(thumb, main, el('span', 'dfdecor-row-price', it.hidden ? 'out' : 'free'));
    r.addEventListener('click', () => { baseKey = it.key; redraw(); });
    return r;
  }
  /** HOME-LOOK: one part of the house - its name, and what it wears (the look being tried). */
  function paintRow(part) {
    const r = el('div', 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = part;
    r.setAttribute('aria-selected', part === paintPart ? 'true' : 'false');
    const main = el('span', 'dfdecor-row-main');
    const was = homeLookSig(view?.paint?.current?.[part] ? { [part]: view.paint.current[part] } : null) !== homeLookSig(paintLook?.[part] ? { [part]: paintLook[part] } : null);
    main.append(el('div', 'dfdecor-row-name', HOME_LOOK_PART_NAMES[part]), el('div', 'dfdecor-row-sub', decorLookText(part, paintLook?.[part] ?? null)));
    r.append(el('span', 'dfdecor-thumb', HOME_LOOK_PART_NAMES[part].slice(0, 2)), main, el('span', 'dfdecor-row-price', was ? 'changed' : ''));
    r.addEventListener('click', () => { paintPart = part; redraw(); });
    return r;
  }
  /** HOME-LOOK: the look being tried, shown on the house (the host's preview) and in the list. */
  function tryLook() {
    onPaint('preview', homeLookOf(paintLook));
    redraw();
  }
  /** HOME-LOOK: the chosen part's choices - its climates, then its sets (walls, windows) or its styles (a roof, a door);
   *  its swatch in the preview; the look painted only when it differs from the house's. */
  /** HOME-LOOK (AUDIT): the styles a roof's or a door's family holds in a climate, as the painter's door knows it, or null. */
  function lookRecordsOf(part, climate) { return view?.paint?.records?.(part, climate) ?? null; }
  /** WAGONS2: one of the caravan's inside parts - its name and its paint now. */
  function caravanPaintRow(row) {
    const r = el('div', 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = row.part;
    r.setAttribute('aria-selected', row.part === paintPart ? 'true' : 'false');
    const main = el('span', 'dfdecor-row-main');
    main.append(el('div', 'dfdecor-row-name', row.name), el('div', 'dfdecor-row-sub', row.choices[row.current] ?? ''));
    r.append(el('span', 'dfdecor-thumb', row.name.slice(0, 2)), main, el('span', 'dfdecor-row-price', 'Free'));
    r.addEventListener('click', () => { paintPart = row.part; redraw(); });
    return r;
  }
  /** WAGONS2: the chosen part's paints, a chip each - pressed, painted at once (free, any time - Mac's answer). */
  function paintCaravanSide() {
    const row = view.paint.caravan.find((x) => x.part === paintPart) ?? null;
    pickName.textContent = row ? row.name : 'Choose a part of your caravan';
    pickLine.textContent = row ? row.choices[row.current] ?? '' : 'Walls, floor and ceiling can each be painted.';
    pickPrice.textContent = 'Free';
    paintClimates.replaceChildren();
    climateLabel.textContent = '';
    paintKindsLabel.textContent = row ? DECOR_PAINT_WORDS.paint : '';
    paintKinds.replaceChildren(...(row ? row.choices.map((name, i) => chip(name, i === row.current, () => onPaint('caravan', { part: row.part, i }))) : []));
    paintBtns.hidden = true;   // nothing to try on and paint: a chip pressed is painted
    previewImg.removeAttribute?.('src');
    pickWhy.textContent = '';
  }
  function paintPaintSide() {
    if (view?.paint?.caravan) { paintCaravanSide(); return; }   // WAGONS2
    paintBtns.hidden = false;
    const part = paintPart;
    const choice = part ? paintLook?.[part] ?? null : null;
    pickName.textContent = part ? HOME_LOOK_PART_NAMES[part] : 'Choose a part of your house';
    pickLine.textContent = part ? decorLookText(part, choice) : 'Walls, windows, roof and door can each take another look from the original game.';
    pickPrice.textContent = 'Free';
    const set = (next) => { paintLook = { ...paintLook, [part]: next }; tryLook(); };
    const start = () => choice ?? decorLookStart(part);
    paintClimates.replaceChildren(...(part ? Object.keys(HOME_LOOK_CLIMATES).map((c) => chip(HOME_LOOK_CLIMATE_NAMES[c], choice?.climate === c, () => set({ ...start(), climate: c }))) : []));
    climateLabel.textContent = part ? DECOR_PAINT_WORDS.climate : '';   // MENU-ORDER
    paintKindsLabel.textContent = !part ? '' : part === 'walls' || part === 'windows' ? DECOR_PAINT_WORDS.set : DECOR_PAINT_WORDS.style;
    if (part === 'walls' || part === 'windows') {
      paintKinds.replaceChildren(...Object.keys(HOME_LOOK_SETS).map((k) => chip(HOME_LOOK_SET_NAMES[k], choice?.set === k, () => set({ ...start(), set: k }))));
    } else if (part) {
      // AUDIT: only the styles its family holds in that climate (a record it lacks was tried and showed the town's own)
      const have = lookRecordsOf(part, (choice ?? decorLookStart(part)).climate);
      const styles = [];
      for (let r = 0; styles.length < DECOR_LOOK_STYLES && r <= 15 && (have == null || r < have); r++) if (!(part === 'door' && r === HOME_LOOK_DOOR_KEPT)) styles.push(r);
      paintKinds.replaceChildren(...styles.map((r) => chip(`Style ${r + 1}`, choice?.record === r, () => set({ ...start(), record: r }))));
    } else {
      paintKinds.replaceChildren();
    }
    ownBtn.disabled = !part || !choice;
    const differs = homeLookSig(homeLookOf(paintLook)) !== homeLookSig(view?.paint?.current ?? null);
    paintBtn.disabled = !differs;
    backBtn.disabled = !differs;
    const sw = part ? homeLookSwatch(part, choice, view?.paint?.season ?? 0) : null;
    const shape = sw ? { key: `look:${sw.archive}.${sw.record}`, flat: [sw.archive, sw.record] } : null;
    if (shape && !thumbs.has(thumbKeyOf(shape))) askThumb(shape);
    const url = shape ? thumbs.get(thumbKeyOf(shape)) : null;
    if (url) previewImg.setAttribute('src', url); else previewImg.removeAttribute?.('src');
    if (preview.dataset.model !== '0') preview.dataset.model = '0';
    pickWhy.textContent = differs ? 'Shown on your house. Paint it to keep it, for everyone to see.' : '';
  }
  /** HOME-RENT: one of the house's rooms - its name, what it is offered at or who rents it, its price. */
  function rentRow(it) {
    const r = el('div', 'dfdecor-row');
    r.setAttribute('role', 'option');
    r.dataset.key = rentKeyOf(it);
    r.setAttribute('aria-selected', rentKeyOf(it) === rentKey ? 'true' : 'false');
    const main = el('span', 'dfdecor-row-main');
    main.append(el('div', 'dfdecor-row-name', it.name), el('div', 'dfdecor-row-sub', rentRowSub(it, view?.rent?.now ?? 0)));
    r.append(el('span', 'dfdecor-thumb', String(it.id ?? it.offer?.room ?? '')), main, el('span', 'dfdecor-row-price', it.offer ? `${it.offer.price} a day` : '-'));
    r.addEventListener('click', () => { rentKey = rentKeyOf(it); redraw(); });
    return r;
  }
  function drawChips() {
    const present = new Set((view?.entries ?? []).map((e) => e.kind));
    kindChips.replaceChildren(chip('All', f.kinds.size === 0, () => { f.kinds.clear(); redraw(); }, 'all', true),
      ...Object.keys(DECOR_KINDS).filter((k) => present.has(k)).map((k) => chip(DECOR_KINDS[k], f.kinds.has(k), () => {
        if (f.kinds.has(k)) f.kinds.delete(k); else f.kinds.add(k);
        redraw();
      }, k, true)));   // MENU-ORDER: each kind its picture, named on the hover
    sizeChips.replaceChildren(chip('Any size', f.size === null, () => { f.size = null; redraw(); }),
      ...Object.keys(DECOR_SIZES).map((k) => chip(DECOR_SIZES[k], f.size === k, () => { f.size = f.size === k ? null : k; redraw(); }, `size-${k[0]}`)));
    hasChips.replaceChildren(
      chip('Holds things', f.storage === true, () => { f.storage = f.storage ? null : true; redraw(); }, 'storage'),
      chip('Gives light', f.light === true, () => { f.light = f.light ? null : true; redraw(); }, 'light'),
      chip('Favourites', f.fav, () => { f.fav = !f.fav; redraw(); }));
    sortChips.replaceChildren(...Object.keys(DECOR_SORTS).map((k) => chip(DECOR_SORTS[k], f.sort === k, () => { f.sort = k; redraw(); })));
    const words = decorFiltersText(f);   // MENU-ORDER: the phone's fold says how many it hides
    if (filterToggle.textContent !== words) filterToggle.textContent = words;
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
      const known = thumbs.get(thumbKeyOf(e));
      if (known) img.setAttribute('src', known);
      else if (watcher) { r.decorThumb = () => askThumb(e, img); watcher.observe(r); } else askThumb(e, img);
    } else {
      thumb.textContent = DECOR_KINDS[e.kind].slice(0, 2);
      thumb.dataset.dficon = e.kind;   // MENU-ORDER: a model's kind's glyph, until its own picture lands over it
      if (e.model != null) modelPicture(thumb, e, r);
    }
    const main = el('span', 'dfdecor-row-main');
    main.append(el('div', 'dfdecor-row-name', e.name), el('div', 'dfdecor-row-sub', decorRowSub(e, radiusOf(e))),
      badges({ storage: !!e.storage, light: e.light != null }));   // MENU-ORDER
    const priceEl = el('span', 'dfdecor-row-price', look ? 'free' : decorPriceText(price));
    if (look) r.append(thumb, main, priceEl);
    else {
      const on = loadDecorFavourites().has(e.key);
      const fav = el('button', 'dfdecor-btn dfdecor-mark dfdecor-fav', on ? '★' : '☆');
      fav.type = 'button';
      fav.title = on ? t('decor.panel.unfav', 'Remove favourite') : 'Favourite';
      fav.setAttribute('aria-pressed', on ? 'true' : 'false');
      fav.setAttribute('aria-label', fav.title);
      fav.addEventListener('click', (ev) => { ev.stopPropagation?.(); toggleDecorFavourite(e.key); redraw(); });
      const hotOn = (view?.hot ?? []).includes(e.key);
      const hot = el('button', 'dfdecor-btn dfdecor-mark', 'Hotbar');
      hot.type = 'button';
      hot.title = hotOn ? t('decor.panel.unhot', 'Remove from hotbar') : t('decor.panel.hot', 'Add to hotbar');
      hot.setAttribute('aria-pressed', hotOn ? 'true' : 'false');
      hot.setAttribute('aria-label', hot.title);
      hot.addEventListener('click', (ev) => { ev.stopPropagation?.(); onHot(e.key); redraw(); });
      const marks = el('span', 'dfdecor-marks');
      marks.append(fav, hot);
      const end = el('span', 'dfdecor-row-end');
      end.append(priceEl, marks);
      r.append(thumb, main, end);
    }
    r.addEventListener('click', () => { if (look) lookKey = e.key; else selectedKey = e.key; redraw(); });
    r.addEventListener('mouseenter', () => { hoverKey = e.key; paintSide(); });
    r.addEventListener('mouseleave', (ev) => leaveHover(e.key, ev));
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
      const known = thumbs.get(thumbKeyOf(e));
      if (known) img.setAttribute('src', known); else askThumb(e, img);
    } else {
      thumb.textContent = (DECOR_KINDS[e.looks?.[0]] ?? DECOR_KINDS.furniture).slice(0, 2);
      thumb.dataset.dficon = DECOR_KINDS[e.looks?.[0]] ? e.looks[0] : 'furniture';   // MENU-ORDER
    }
    const main = el('span', 'dfdecor-row-main');
    const count = (e.count ?? 1) > 1 ? ` (${e.count})` : '';
    main.append(el('div', 'dfdecor-row-name', `${e.name}${count}`), el('div', 'dfdecor-row-sub', ownLine(e)));
    r.append(thumb, main, el('span', 'dfdecor-row-price', 'free'));
    r.addEventListener('click', () => { ownKey = e.key; redraw(); });
    r.addEventListener('mouseenter', () => { hoverKey = e.key; paintSide(); });
    r.addEventListener('mouseleave', (ev) => leaveHover(e.key, ev));
    return r;
  }

  /** The list, the chips and the side - drawn again when anything they read changed. */
  function redraw() {
    hideKindTip();
    if (!view) return;
    drawTabs();
    layoutChips.replaceChildren(chip(DECOR_LAYOUT_WORDS.grid, layout === 'grid', () => { layout = 'grid'; redraw(); }, 'all'),
      chip(DECOR_LAYOUT_WORDS.list, layout === 'list', () => { layout = 'list'; redraw(); }, 'list'));
    const shape = layout === 'grid' && DECOR_GRID_MODES.includes(mode) ? 'grid' : 'list';   // MENU-ORDER: the rooms and the painter are lines
    if (card.dataset.view !== shape) card.dataset.view = shape;
    drawChips();
    const entries = view.entries;
    watcher?.disconnect();   // the rows it watched are gone
    waiting.clear();
    if (mode === 'rent' && !view.rent) { mode = 'catalogue'; card.dataset.mode = mode; }   // HOME-RENT: no rooms door here any more
    if (mode === 'paint' && !view.paint) { mode = 'catalogue'; card.dataset.mode = mode; }   // HOME-LOOK: no painter here any more
    if (mode === 'paint' && view.paint.caravan) {   // WAGONS2: the caravan's inside - a row a part, its paints chosen at once
      if (!view.paint.caravan.some((r) => r.part === paintPart)) paintPart = view.paint.caravan[0]?.part ?? null;
      list.replaceChildren(...view.paint.caravan.map(caravanPaintRow));
      listSig = signature();
      paintSide();
      return;
    }
    if (mode === 'paint') {   // HOME-LOOK: a row a part
      paintLook ??= { ...(view.paint.current ?? {}) };
      list.replaceChildren(...HOME_LOOK_PARTS.map(paintRow));
      listSig = signature();
      paintSide();
      return;
    }
    if (mode === 'rent') {   // HOME-RENT
      const rows = view.rent.rows ?? [];
      if (rentKey && !rows.some((it) => rentKeyOf(it) === rentKey)) rentKey = null;
      list.replaceChildren(...(rows.length ? rows.map(rentRow) : [el('div', 'dfdecor-empty', view.rent.finding ? DECOR_RENT_FINDING : DECOR_RENT_ONE_ROOM)]));   // RENT-ORPHANS: while the rooms are found, it says so
    } else if (mode === 'room') {
      const placed = roomed(view.placed ?? []);   // DECOR-ROOMS: the chosen room's
      if (placedId && !placed.some((it) => it.piece.id === placedId)) placedId = null;   // removed, or gone from the room
      list.replaceChildren(...(placed.length ? placed.map(placedRow) : [el('div', 'dfdecor-empty', 'Nothing placed in this room yet.')]));
    } else if (mode === 'base') {   // BASE-HIDE
      const rows = roomed(view.base ?? []);   // DECOR-ROOMS: the chosen room's
      if (baseKey && !rows.some((it) => it.key === baseKey)) baseKey = null;
      list.replaceChildren(...(rows.length ? rows.map(baseRow) : [el('div', 'dfdecor-empty', DECOR_BASE_EMPTY)]));
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
      list.replaceChildren(el('div', 'dfdecor-empty', 'Reading the catalog...'));
    } else {
      const look = mode === 'look';   // DECOR2b: the furniture's kinds alone, and neither holding nor light asked
      const shownEntries = look
        ? filterDecor(entries, { kinds: lookOf().looks, text: f.text, size: f.size, sort: f.sort, radiusOf })
        : filterDecor(entries, { kinds: f.kinds, text: f.text, size: f.size, storage: f.storage, light: f.light, favourite: f.fav ? loadDecorFavourites() : null, sort: f.sort, radiusOf });
      list.replaceChildren(...(shownEntries.length ? shownEntries.map((e) => row(e, look)) : [el('div', 'dfdecor-empty', 'Nothing matches.')]));
    }
    listSig = signature();
    paintSide();
  }
  /** Everything the list reads that the host can change under it (the room's pieces: each one's id, cost, light,
   *  storage and whether it holds anything). */
  const signature = () => [view?.entries ? view.entries.length : -1, view?.ready ? 1 : 0, view?.sized ?? 0, view?.gold ?? 0, view?.count ?? 0,   // AUDIT 05b A3: a piece measured late, priced
    (view?.placed ?? []).map((it) => `${it.piece.id}:${it.piece.paid}:${it.piece.light ? 1 : 0}:${it.piece.storage ? 1 : 0}:${it.holds ? 1 : 0}:${it.piece.station ?? ''}:${it.piece.item ? 1 : 0}:${it.piece.name ?? ''}:${it.room ?? ''}`).join(','),   // AUDIT HOME-STATIONS S3: and its craft; one's own is not copied; DECOR-ROOMS: and its room
    (view?.own ?? []).map((e) => `${e.key}:${e.name}:${e.count ?? 1}`).join(','),   // DECOR2a: the pack's list
    (view?.base ?? []).map((it) => `${it.key}:${it.name}:${it.hidden ? 1 : 0}:${it.holds ? 1 : 0}:${it.room ?? ''}`).join(','),   // BASE-HIDE
    (view?.rooms ?? []).map((r) => `${r.id}:${r.name}`).join(','), view?.roomId ?? '', view?.doorways ?? '',
    view?.yard ? 'y' : '', view?.paint ? homeLookSig(view.paint.current) : '-',   // HOME-YARD; HOME-LOOK
    (view?.paint?.caravan ?? []).map((r) => `${r.part}:${r.current}`).join(','),   // WAGONS2: the caravan's inside, painted
    paintPart === 'roof' || paintPart === 'door' ? String(lookRecordsOf(paintPart, (paintLook?.[paintPart] ?? decorLookStart(paintPart)).climate)) : '',   // HOME-LOOK (AUDIT): a family's count answered
    view?.rent ? `${view.rent.due}:${view.rent.busy ? 1 : 0}${view.rent.loaded ? 1 : 0}${view.rent.finding ? 1 : 0}:${(view.rent.rows ?? []).map((r) => `${rentKeyOf(r)}:${r.offer ? `${r.offer.price}.${r.offer.taken ? 1 : 0}.${r.offer.listed ? 1 : 0}.${r.offer.until ?? ''}` : '-'}`).join(',')}` : ''].join('|');   // HOME-RENT (RENT-FRESH, RENT-ORPHANS: read, and still finding - each changes what the view says)   // DECOR-ROOMS: the tabs, and the one chosen; HOME-DOORS: the doorways free

  /** The pointer left a card. The next card in this list paints the side itself; only leaving the list clears it. */
  function leaveHover(key, ev) {
    if (hoverKey !== key) return;
    const to = ev?.relatedTarget;
    if (to && (to === list || list.contains?.(to))) return;
    hoverKey = null;
    paintSide();
  }

  /** The piece the side is showing: favourite and hotbar, the same two presses as the card. */
  function paintMarks() {
    const e = shown();
    const markable = !!e?.key && e.kind !== 'own';
    const favOn = markable && loadDecorFavourites().has(e.key);
    const hotOn = markable && (view?.hot ?? []).includes(e.key);
    sideFav.disabled = !markable;
    sideHot.disabled = !markable;
    sideFav.title = favOn ? t('decor.panel.unfav', 'Remove favourite') : 'Favourite';
    sideHot.title = hotOn ? t('decor.panel.unhot', 'Remove from hotbar') : t('decor.panel.hot', 'Add to hotbar');
    sideFav.setAttribute('aria-pressed', favOn ? 'true' : 'false');
    sideHot.setAttribute('aria-pressed', hotOn ? 'true' : 'false');
    sideFav.setAttribute('aria-label', sideFav.title);
    sideHot.setAttribute('aria-label', sideHot.title);
  }

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
      pickLine.textContent = ownLine(e);
      pickPrice.textContent = 'Free';
      if (!thumbs.has(thumbKeyOf(e))) askThumb(e);
      const url = thumbs.get(thumbKeyOf(e));
      if (url) previewImg.setAttribute('src', url); else previewImg.removeAttribute?.('src');
    } else {
      pickName.textContent = e.name;
      pickLine.textContent = e.kind === 'door' && mode === 'catalogue' ? `${decorRowSub(e, radiusOf(e))} - ${decorDoorLine(view?.doorways ?? null)}` : decorRowSub(e, radiusOf(e));   // HOME-DOORS
      pickPrice.textContent = decorPriceText(priceOf(e));
      if (e.flat && !thumbs.has(thumbKeyOf(e))) askThumb(e);   // chosen out of view: its picture all the same
      const url = e.flat ? thumbs.get(thumbKeyOf(e)) : null;
      if (url) previewImg.setAttribute('src', url); else previewImg.removeAttribute?.('src');
    }
    if (mode === 'look') {   // DECOR2b: what is set down is one's furniture, by its own name - the look under it, free
      pickName.textContent = lookOf()?.name ?? '';
      pickLine.textContent = e ? `as ${e.name} - ${decorRowSub(e, radiusOf(e))}` : DECOR_LOOK_LINE;
      pickPrice.textContent = 'Free';
    }
    const model = e && e.model != null ? '1' : '0';
    if (preview.dataset.model !== model) preview.dataset.model = model;
    if (mode === 'paint') {
      paintPaintSide();
      paintMarks();
      return;
    }
    if (mode === 'rent') {
      paintRentSide();
    } else if (mode === 'room') {
      paintRoomSide();
    } else if (mode === 'base') {
      paintBaseSide();
    } else {
      const free = sel?.kind === 'own' || mode === 'look';   // DECOR2a: one's own costs nothing (DECOR2b: nor its look)
      const why = sel ? decorWhyNot({ price: free ? 0 : priceOf(sel), ready: free || !!view?.ready, gold: view?.gold ?? 0, count: view?.count ?? 0, cap: view?.cap ?? 0, yard: !!view?.yard, hall: !!view?.hall }) : null;
      pickWhy.textContent = why ?? '';
      place.disabled = !sel || why !== null;
      const label = mode === 'own' && sel?.looks ? DECOR_LOOK_BUTTON : 'Place';   // DECOR2b: furniture chooses its look first
      if (place.textContent !== label) place.textContent = label;
    }
    paintMarks();
    const key = e ? e.key : null;
    if (key !== pointedKey) { pointedKey = key; onPoint(e); }
  }

  /** DECOR1e: the chosen placed piece - its line, what it cost, and its four changes (a piece that holds anything is not
   *  removed, nor made to stop holding things, out from under its contents). */
  function paintRoomSide() {
    const it = placedSelected();
    if (!it) {
      pickName.textContent = roomed(view?.placed ?? []).length ? 'Choose a placed piece' : 'Nothing placed in this room yet.';
      pickLine.textContent = '';
      pickPrice.textContent = '';
    } else {
      pickName.textContent = it.name;
      pickLine.textContent = decorPlacedSub(it);
      pickPrice.textContent = it.piece.item ? `Take down: back to ${decorBackTo(it.piece)}` : `Remove: ${decorRefundText(it.piece.paid)} back${view?.hall ? " to the guild's treasury" : ''}${it.piece.station ? ' (the station license is not)' : ''}`;   // AUDIT HOME-STATIONS S6
    }
    lightBtn.textContent = it?.piece.light ? 'Light: on' : 'Light: off';
    storeBtn.textContent = it?.piece.storage ? 'Holds things: yes' : 'Holds things: no';
    removeBtn.textContent = it?.piece.item ? 'Take down' : 'Remove';   // DECOR2a: one's own goes back to the pack
    // HOME-STATIONS: a piece that holds things, or one's own item, is no station
    if ((it?.piece.id ?? null) !== stationFor) { stationFor = it?.piece.id ?? null; stationArmed = null; stationOffer = DECOR_STATIONS.includes(it?.piece.station) ? it.piece.station : DECOR_STATIONS[0]; }
    const words = decorStationWords(it?.piece, stationOffer, !!it && stationArmed === it.piece.id);
    stationPick.textContent = words.pick;
    stationPick.setAttribute('aria-label', `Station craft: ${words.pick.replace(/^Station: | >$/g, '')} - press for the next`);   // AUDIT HOME-STATIONS S9
    stationBtn.textContent = words.act;
    stationBtn.dataset.what = words.what;
    const door = !!it && decorIsDoor(it.piece);   // HOME-DOORS (AUDIT): a door hangs in its doorway - no station, no store, no light
    stationPick.disabled = !it || !!it.piece.item || it.piece.storage || door;
    stationBtn.disabled = stationPick.disabled;
    moveBtn.disabled = !it;
    renameBtn.disabled = !it;
    dupBtn.disabled = !it || !!it.piece.item;   // one's own goes back to the pack; a copy would be a bought piece
    turnLeftBtn.disabled = turnRightBtn.disabled = !it || door;   // DECOR-TURN: a door is turned by its doorway (Move)
    lightBtn.disabled = !it || door;
    storeBtn.disabled = !it || !!it.piece.item || (it.piece.storage && it.holds) || !!it.piece.station || door;   // HOME-STATIONS: a station holds nothing
    accessBtn.textContent = it?.piece ? useLabel(it.piece) : t('decor.panel.useMe', 'Who may use: Me');
    accessBtn.disabled = !it || door || !(it.piece.storage || it.piece.station);
    removeBtn.disabled = !it || it.holds;
    pickWhy.textContent = it?.holds ? DECOR_HOLDS_LINE : '';
  }

  /** HOME-RENT: the chosen room - what it is offered at or who rents it, the price being set, and the room's three acts;
   *  the rent held, collected. A room its walls no longer make can only be withdrawn. */
  function paintRentSide() {
    const it = rentSelected();
    const rent = view?.rent ?? null;
    pickName.textContent = it ? it.name : (rent?.rows?.length ? 'Choose a room' : '');
    pickLine.textContent = it ? rentRowSub(it, rent?.now ?? 0) : '';
    pickPrice.textContent = it && it.offerable ? `Price: ${rentPriceOf(it)} gold a day` : '';
    for (const b of priceBtns) b.disabled = !it || !it.offerable || !!rent?.busy;
    offerBtn.textContent = it?.offer ? (rentPriceOf(it) === it.offer.price && it.offer.listed ? 'Offered' : `Offer at ${rentPriceOf(it)} gold a day`) : 'Offer to rent';
    offerBtn.disabled = !it || !it.offerable || !!rent?.busy || (!!it.offer && it.offer.listed && rentPriceOf(it) === it.offer.price);
    // AUDIT: a room taken off the offer whose tenancy ran out can be cleared off the list (it could not); a tenancy still
    // running on one is withdrawn already
    withdrawBtn.textContent = it?.offer && !it.offer.listed ? 'Clear it' : 'Stop offering';
    withdrawBtn.disabled = !it?.offer || (!it.offer.listed && !!it.offer.taken) || !!rent?.busy;
    collectBtn.textContent = decorRentDueText(rent?.due ?? 0);
    collectBtn.disabled = !(rent?.due > 0) || !!rent?.busy;
    pickWhy.textContent = rent && !rent.loaded ? 'Asking the account service about your rooms...' : it?.offer?.taken ? 'A price changed now is what the next tenant pays.' : '';
  }

  /** BASE-HIDE: the chosen built-in piece - its line, free, out or back; and the whole room's two buttons. A piece that
   *  holds anything is never taken out from under what it holds. */
  function paintBaseSide() {
    const it = baseSelected();
    const rows = roomed(view?.base ?? []);   // DECOR-ROOMS
    pickName.textContent = it ? it.name : rows.length ? 'Choose a piece of this room\'s own furniture' : DECOR_BASE_EMPTY;
    pickLine.textContent = it ? decorBaseSub(it) : '';
    pickPrice.textContent = it || rows.length ? 'Free to take out or put back' : '';
    baseBtn.textContent = it?.hidden ? 'Put back' : 'Take out';
    baseBtn.dataset.dficon = it?.hidden ? 'put-back' : 'take-out';   // MENU-ORDER
    baseBtn.disabled = !it || (!it.hidden && it.holds);
    allOutBtn.disabled = !rows.some((r) => !r.hidden && !r.holds && !r.door);
    allBackBtn.disabled = !rows.some((r) => r.hidden && !r.door);
    pickWhy.textContent = it && !it.hidden && it.holds ? DECOR_HOLDS_LINE : '';
  }

  function paintFoot() {
    if (!view) return;
    const c = `${view.count} of ${view.cap} pieces placed`;
    if (footCount.textContent !== c) footCount.textContent = c;
    const g = `${view.gold} gold to spend (purse and bank)`;
    if (footGold.textContent !== g) footGold.textContent = g;
    const s = view.ready ? '' : `Reading the catalog - ${Math.floor((view.progress ?? 0) * 100)}%`;
    if (footStatus.textContent !== s) footStatus.textContent = s;
    const w = String(view.where ?? '');
    if (whereLine.textContent !== w) whereLine.textContent = w;
    whereLine.hidden = !w;
  }

  function hide() {
    if (!open) return;
    open = false;
    root.dataset.state = 'closed';
    hoverKey = null;
    // FB1001 LOOK-TRIED: closing is leaving the tab - the house puts a tried look away (the host's onClose), and so does
    // the painter, or it opened again on a look "tried on your house" that the house no longer wore
    if (mode === 'paint') paintLook = null;
    unregister();
    unregister = () => {};
    onClose();   // once an opening: a closed panel returns above
  }

  search.addEventListener('input', () => { f.text = String(search.value ?? ''); redraw(); });
  close.addEventListener('click', () => hide());
  sideFav.addEventListener('click', () => {
    const sel = selected();
    if (!sel?.key || sel.kind === 'own' || sideFav.disabled) return;
    toggleDecorFavourite(sel.key);
    redraw();
  });
  sideHot.addEventListener('click', () => {
    const sel = selected();
    if (!sel?.key || sel.kind === 'own' || sideHot.disabled) return;
    onHot(sel.key);
    redraw();
  });
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
    /** MENU-ORDER: the card's box on the page - the host draws a model's tile picture in the game canvas under it. */
    cardRect: () => (open && card.getBoundingClientRect ? card.getBoundingClientRect() : null),
    /** Choose a piece by its key (the host's reopen after a placement keeps the choice). */
    select(key) { selectedKey = key; if (open) redraw(); },
    /** HOME-RENT: the rooms view. */
    showRent() { if (mode === 'rent') redraw(); else setMode('rent'); },
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

/** MENU-ORDER: the bar's press that unfolds its keys' legend. */
export const DECOR_KEYS_WORD = 'Keys';
/** MENU-ORDER: each of the bar's presses its picture. */
const DECOR_BAR_ICONS = Object.freeze({ place: 'place', turnLeft: 'turn-left', turnRight: 'turn-right', raise: 'up', lower: 'down',
  smaller: 'smaller', bigger: 'bigger', grid: 'grid', preview: 'decorate', catalog: 'list', back: 'back' });
/** MENU-ORDER: THE BAR'S LEGEND - each key's name and what presses it, a pair a line (a finger's two: the stick and
 *  Fly, and the look). DECOR-FIGURE: `sized` false tells no Size key. */
export function decorBarKeys(touch, sized = true) {
  if (touch) return [['Fly', t('decor.bar.keys.flyTouch', 'the stick, and hold Fly up or Fly down')], ['Look', t('decor.bar.keys.lookTouch', 'drag: the piece stands where you look')]];
  return [['Fly', t('decor.bar.keys.fly', 'walk keys, Jump up, Crouch down, Run faster')], ['Look', t('decor.bar.keys.look', 'mouse')],
    ['Turn', t('decor.bar.keys.turn', 'wheel or Turn Left/Right (Shift for fine turns; turn a picture half round to flip it)')], ['Raise/lower', t('decor.bar.keys.raise', 'Float Up/Down')],
    ...(sized ? [['Size', '- and =']] : []), ['Grid', '/'], ['Place', t('decor.bar.keys.place', 'click or Interact')], ['Back', t('decor.bar.keys.back', 'right click or Escape')]];
}

/**
 * THE BAR, while a piece is being placed. `show(info)` / `hide()`; `info` is { name, price, why, snap, sized } (DECOR-FIGURE:
 * `sized` false hides Smaller and Bigger - a figure stands at its own size) and, for a move
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
  root.dataset.keys = '0';   // MENU-ORDER: the legend folded
  const what = el('div', 'dfdecor-bar-what');
  const tally = el('div', 'dfdecor-bar-count');
  // DECOR-FIGURE: a piece that takes no size step (one of Daggerfall's people) is told no Size key. MENU-ORDER: a legend,
  // a key's name and then what presses it
  const keys = el('div', 'dfdecor-bar-keys');
  const drawKeys = (sized) => keys.replaceChildren(...decorBarKeys(touch, sized).map(([name, how]) => {
    const k = el('span', 'dfdecor-key');
    k.append(el('b', '', `${name}:`), el('span', '', ` ${how}`));
    return k;
  }));
  drawKeys(true);
  const why = el('div', 'dfdecor-bar-why');
  const btns = el('div', 'dfdecor-bar-btns');
  const b = (label, key, cls = 'dfdecor-chip') => {
    const n = el('button', cls, label);
    n.type = 'button';
    if (DECOR_BAR_ICONS[key]) n.dataset.dficon = DECOR_BAR_ICONS[key];   // MENU-ORDER
    n.addEventListener('click', () => on[key]?.());
    return n;
  };
  const grid = b('Grid', 'grid');
  const preview = b('Preview', 'preview');
  const catalog = b('Catalogue', 'catalog');
  catalog.hidden = true;
  const confirm = b('Confirm', 'confirm', 'dfdecor-btn');
  const discard = b('Discard', 'discard');
  confirm.hidden = true;
  discard.hidden = true;
  // DECOR1e: THE FINGER'S UP AND DOWN - held, as Jump and Crouch are on a keyboard; let go when the finger lifts, is
  // taken, or the bar goes (a window over the flight)
  let flyDir = 0;
  const flyTo = (dir) => { if (dir !== flyDir) { flyDir = dir; on.fly?.(dir); } };
  const hold = (label, dir) => {
    const n = el('button', 'dfdecor-chip', label);
    n.type = 'button';
    n.dataset.dficon = dir > 0 ? 'up' : 'down';   // MENU-ORDER
    n.addEventListener('pointerdown', (e) => { try { n.setPointerCapture?.(e.pointerId); } catch { /* a pointer gone already */ } flyTo(dir); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) n.addEventListener(t, () => { if (flyDir === dir) flyTo(0); });
    return n;
  };
  const smaller = b('Smaller', 'smaller'), bigger = b('Bigger', 'bigger');   // DECOR-FIGURE: hidden for a figure (show's `sized`)
  // MENU-ORDER: the presses in the legend's groups, a rule between - place; turn; raise and lower; size; the grid (and a
  // finger's fly); back
  const seps = [];
  const sep = () => { const s = el('span', 'dfdecor-bar-sep'); seps.push(s); return s; };
  const place = b('Place', 'place', 'dfdecor-btn');
  const turnLeft = b('Turn left', 'turnLeft'), turnRight = b('Turn right', 'turnRight');
  const raise = b('Raise', 'raise'), lower = b('Lower', 'lower');
  const flightBtns = [place, turnLeft, turnRight, raise, lower, smaller, bigger, grid, preview];
  btns.append(place, sep(), turnLeft, turnRight, sep(), raise, lower, sep(), smaller, bigger, grid, preview);
  if (touch) btns.append(hold('Fly up', 1), hold('Fly down', -1));
  // MENU-ORDER: the keys' legend folded behind one press - the pictured buttons are the bar; the words wait to be asked
  const keysChip = el('button', 'dfdecor-chip dfdecor-keys-toggle', DECOR_KEYS_WORD);
  keysChip.type = 'button';
  keysChip.dataset.dficon = 'list';
  keysChip.setAttribute('aria-pressed', 'false');
  keysChip.addEventListener('click', () => { const on = root.dataset.keys !== '1'; root.dataset.keys = on ? '1' : '0'; keysChip.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  btns.append(sep(), catalog, confirm, discard, b('Back', 'back'), keysChip);
  root.append(what, tally, why, btns, keys);   // MENU-ORDER: the presses first, the legend under them when asked
  swallowPresses(root);
  doc.body?.append(root);
  let alive = true;
  return {
    root,
    show({ name, price, priceText = null, why: whyText = null, snap = false, sized = true, preview: frozen = false, browse = false, draft = false, count = null, cap = null }) {
      if (!alive) return;
      const tail = priceText != null ? priceText : decorPriceText(price);
      const w = tail ? `${name} - ${tail}` : String(name ?? '');
      if (what.textContent !== w) what.textContent = w;
      const n = Number.isSafeInteger(count) && Number.isSafeInteger(cap) ? `${count} of ${cap}` : '';
      if (tally.textContent !== n) tally.textContent = n;
      // DECOR-FIGURE: one of Daggerfall's people stands at its own size - no Smaller, no Bigger, no Size key told
      if (!browse && !!smaller.hidden === sized) { smaller.hidden = !sized; bigger.hidden = !sized; drawKeys(sized); }
      catalog.hidden = !browse;
      confirm.hidden = !draft;
      discard.hidden = !draft;
      for (const n of flightBtns) n.hidden = browse ? true : n.hidden;
      if (!browse) for (const n of [place, turnLeft, turnRight, raise, lower, grid, preview]) n.hidden = false;
      for (const s of seps) s.hidden = !!browse;
      const y = whyText ?? '';
      if (why.textContent !== y) why.textContent = y;
      grid.setAttribute('aria-pressed', snap ? 'true' : 'false');
      preview.setAttribute('aria-pressed', frozen ? 'true' : 'false');
      if (root.dataset.up !== '1') root.dataset.up = '1';
    },
    hide() { flyTo(0); if (alive && root.dataset.up !== '0') root.dataset.up = '0'; },
    isUp: () => root.dataset.up === '1',
    destroy() { if (!alive) return; flyTo(0); alive = false; root.remove?.(); },
  };
}

const classSet = (node, c, on) => {
  const parts = String(node.className).split(/\s+/).filter((x) => x && x !== c);
  if (on) parts.push(c);
  node.className = parts.join(' ');
};

/** The character bar's ten sockets, for catalogue pieces. `cells` are `{ src, filled }`; `sel` is the wheel's slot;
 *  `box` is the character bar's place on the page, when it has one. */
export function createDecorHotbar({ onSlot, doc = document, count = 10, keys = [] }) {
  injectStyle(doc);
  const el = maker(doc);
  const root = el('div', 'hb hb-decor hb-float');
  root.dataset.up = '0';
  root.setAttribute('role', 'toolbar');
  const row = el('div', 'hb-row');
  const slots = [];
  const icons = [];
  for (let i = 0; i < count; i++) {
    const n = el('button', 'hb-slot hb-empty');
    n.type = 'button';
    n.dataset.slot = String(i);
    n.dataset.filled = '0';
    const face = el('div', 'hb-face');
    const icon = el('img', 'hb-icon');
    icon.alt = '';
    icon.draggable = false;
    face.append(icon);
    n.append(el('i', 'hb-frame'), face, el('span', 'hb-key', keys[i] || String((i + 1) % 10)));
    n.addEventListener('click', () => onSlot(i));
    slots.push(n);
    icons.push(icon);
    row.append(n);
  }
  root.append(row);
  swallowPresses(root);
  doc.body?.append(root);
  let alive = true;
  return {
    root,
    rect() {
      const r = root.getBoundingClientRect?.();
      return r && r.width > 0 ? r : null;
    },
    show(up, cells, sel, dock) {
      if (!alive) return;
      root.dataset.up = up ? '1' : '0';
      classSet(root, 'on', !!up);
      if (dock) { if (root.parentNode !== dock) dock.append?.(root); }
      else if (root.parentNode && doc.body && root.parentNode !== doc.body) doc.body.append(root);
      classSet(root, 'hb-float', !dock);
      if (!up) return;
      for (let i = 0; i < slots.length; i++) {
        const src = cells?.[i]?.src || '';
        const filled = !!cells?.[i]?.filled;
        if (src) { if (icons[i].getAttribute('src') !== src) icons[i].setAttribute('src', src); }
        else icons[i].removeAttribute('src');
        slots[i].dataset.filled = filled ? '1' : '0';
        classSet(slots[i], 'hb-empty', !filled);
        classSet(slots[i], 'hb-active', i === sel);
      }
    },
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}
