// @ts-check
// STAR6 (2026-10-20): THE FALLEN STAR'S TRACKER - a plate over the world for a player within STAR_HUD_M of a star: its
// name (a Heart-Star its own), the town it fell near, the coven come for it, how it stands (the gathering, a wave of
// four, the master by name, held, lost), its light as a bar and the time to its deadline. Design:
// bible/11-Multiplayer/Starfall.md section 8. Its reading is the law's (systems/starfall/starfallClient.js
// starTrackerModel); this is the node.
//
// MADE ONCE AND UPDATED, never rebuilt: each part written only when what it says changes (the Elite Breach's tracker's
// law, ui/eliteGates/egHud.js). DRESSED IN EVERY SKIN, as the gate's bar is - a fight is read whatever skin is worn: under
// Enhanced Plus the kit's panel (ui/enhanced/enhancedFrame.js FRAME_ROLES, `body .star-hud`), on the classic skin the
// kit's own rules cut to it (scopeRules).
//
// WHERE IT STANDS (AUDIT STAR U1): the right-upper column, which the quest card (ui/quest/questTracker.js) and the party
// list (ui/partyPanel.js) already share - it stood over both at 24%. It stands under the quest card now, by the height the
// card publishes (--dfquest-h), and publishes its own bottom as the card does (STAR_TRACKER_HEIGHT_VAR), so the party list
// steps under the lower of the two: nothing in the column is hidden and nothing covers another. Where the master's bar
// (ui/gate/gateBossBar.js: 460 wide, centred, from 58) shares the screen's width with it, it keeps its 24% under the bar.
// SPOKEN ONCE A CHANGE (AUDIT STAR U2): the phase line alone is live - on the whole plate the countdown was read out
// every second.
//
// Not a DFU member. Ledger A (STARFALL).
import { FRAME_TONES, frameCss, scopeRules } from '../enhanced/enhancedFrame.js';
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { isEnhancedPlus } from '../../systems/uiSkin.js';
import { isTouchDevice } from '../touch/touchDevice.js';
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';
import { STAR_CARD_TEXT } from '../../systems/starfall/starWords.js';
import { STAR_VIOLET_CSS, STAR_GOLD_CSS } from './starMapMark.js';

export const STAR_TRACKER_STYLE_ID = 'dagger-star-tracker-style';
export const STAR_TRACKER_KIT_ID = 'dagger-star-tracker-kit';
/** The parts, in their order down the plate. */
export const STAR_TRACKER_KEYS = Object.freeze(['title', 'near', 'coven', 'phase', 'left']);
/** The plate's bottom, published for the party list to step under (0 while it is not shown) - the quest card's way
 *  (ui/quest/questTracker.js TRACKER_HEIGHT_VAR), against the party list's own line. */
export const STAR_TRACKER_HEIGHT_VAR = '--dfstar-h';
/** The gap the party list keeps under the plate, px. */
export const STAR_TRACKER_GAP = 8;
/** The party list's lines (ui/partyPanel.js .dfparty: 92, a touch screen's 76). */
const PARTY_TOP = 92, PARTY_TOUCH_TOP = 76;

/** Its line in the column: under the quest card (its published height), on the party list's line where there is none. */
const under = (line) => `calc(${line}px + var(--dfquest-h, 0px) + env(safe-area-inset-top, 0px))`;
/** The party list's rules while the plate stands (ui/partyPanel.js PARTY_CSS's shapes, under the lower of the card and the
 *  plate): its line, a touch screen's, a landscape phone's cut, and a phone's list at the foot kept under the plate. */
function partyUnder() {
  const lower = 'max(var(--dfquest-h, 0px), var(--dfstar-h, 0px))', on = 'body:has(.star-hud.on)';
  return `@media (min-width: 561px) {
  ${on} .dfparty { top: calc(${PARTY_TOP}px + ${lower} + env(safe-area-inset-top, 0px));
    max-height: calc(100dvh - 100px - ${lower} - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); }
  ${on} .dfparty.touch { top: calc(${PARTY_TOUCH_TOP}px + ${lower} + env(safe-area-inset-top, 0px)); }
}
@media (max-height: 560px) and (min-width: 561px) {
  ${on} .dfparty.touch { max-height: calc(100dvh - 152px - ${lower} - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); }
}
@media (max-width: 560px) {
  ${on} .dfparty, ${on} .dfparty.touch { max-height: calc(100dvh - 168px - var(--dfstar-h, 0px) - env(safe-area-inset-bottom, 0px)); }
}`;
}
/** The master's bar while it stands (ui/gate/gateBossBar.js in the star's theme, hidden by its display). */
const BAR_UP = 'body:has(.wb-boss-bar.star:not([style*="display: none"]))';
export const STAR_TRACKER_CSS = `
.star-hud { --star-floor: 0px; position: fixed; right: calc(8px + env(safe-area-inset-right, 0px)); top: max(var(--star-floor), ${under(PARTY_TOP)}); width: min(300px, 72vw); box-sizing: border-box; pointer-events: none; z-index: 30;
  padding: 9px 12px 10px; border-width: 2px; border-style: solid; ${PIXEL_FONT_CSS} font-size: calc(14px * var(--hud-scale, 1)); line-height: 1.35;
  color: #efe8f8; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.star-hud.touch { top: max(var(--star-floor), ${under(PARTY_TOUCH_TOP)}); }
/* where the compass, the foe's frame and the master's bar (460 wide, centred, from 58, about 100 tall) share the width
   with the column: its 24% under them, and under the bar itself while the bar stands (its 72 on a phone, 44 on a short
   screen) */
@media (max-width: 1100px) {
  .star-hud { --star-floor: 24%; }
  ${BAR_UP} .star-hud { --star-floor: max(24%, 162px); }
}
@media (max-height: 480px) and (min-width: 641px) { ${BAR_UP} .star-hud { --star-floor: max(24%, 148px); } }
/* the quest card steps aside - keeping its line, as it does for a bout's bar (ui/enhanced/enhancedStyle.js .qtrack) - while
   the master's bar stands over its corner: 1000 and under, the bar's half and the card's 268 from the edge */
@media (max-width: 1000px) { ${BAR_UP}:has(.star-hud.on) .qtrack { visibility: hidden; } }
/* the party list steps under the lower of the quest card and this plate while it stands (its own rule steps under the
   card alone); a phone's list stands at the foot, kept clear of the plate */
${partyUnder()}
.star-hud-title { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: ${STAR_VIOLET_CSS}; }
.star-hud.heart .star-hud-title { color: ${FRAME_TONES.brassHi}; }
.star-hud-near { font-size: 16px; line-height: 1.25; margin-top: 3px; color: #ffffff; }
.star-hud-coven { font-size: 13px; margin-top: 2px; color: #c9bde0; }
.star-hud-phase { font-size: 15px; margin-top: 6px; }
.star-hud-light { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.star-hud-gauge { flex: none; font-size: 11px; line-height: 1; letter-spacing: 0.12em; text-transform: uppercase; color: #c9bde0; }
.star-hud-track { position: relative; flex: 1; height: 8px; background: rgba(20,14,34,0.85); border: 1px solid rgba(185,162,255,0.45); }
.star-hud-fill { position: absolute; left: 0; top: 0; bottom: 0; background: ${STAR_VIOLET_CSS}; box-shadow: 0 0 6px ${STAR_VIOLET_CSS}; }
.star-hud.low .star-hud-fill { background: #ff6a4a; box-shadow: 0 0 6px #ff6a4a; animation: star-low 1s steps(2, jump-none) infinite; }
.star-hud.held .star-hud-fill { background: ${STAR_GOLD_CSS}; box-shadow: 0 0 6px ${STAR_GOLD_CSS}; }
.star-hud.held .star-hud-phase { color: ${STAR_GOLD_CSS}; }
@keyframes star-low { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .star-hud.low .star-hud-fill { animation: none; } }
.star-hud-left { font-size: 13px; margin-top: 4px; color: #c9bde0; font-variant-numeric: tabular-nums; }
.star-hud-left:empty, .star-hud-coven:empty { display: none; }
@media (max-width: 640px) {
  .star-hud, .star-hud.touch { --star-floor: 16%; top: max(var(--star-floor), ${under(PARTY_TOUCH_TOP)}); padding: 7px 10px 8px; }
  ${BAR_UP} .star-hud { --star-floor: max(16%, 176px); }
  .star-hud-near { font-size: 15px; }
}
`;
/** The kit's selector of this plate (its classic copy is the kit's rules cut to it). */
export const isStarTrackerSelector = (/** @type {string} */ sel) => /\.star-hud(?![\w-])/.test(sel);

let root = null, parts = null, fill = null, touch = false, ro = null;
const shown = { vis: '', cls: '', light: -1, at: '' };

function ensureStyle(doc) {
  const lay = (id, text) => {
    if (doc.getElementById?.(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = text;
    (doc.head ?? doc.body)?.append(st);
  };
  lay(STAR_TRACKER_STYLE_ID, STAR_TRACKER_CSS);
  if (doc.head) injectEnhancedFonts(doc);
  if (!isEnhancedPlus()) lay(STAR_TRACKER_KIT_ID, scopeRules(frameCss(), isStarTrackerSelector));
}
function build(doc) {
  ensureStyle(doc);
  const part = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  touch = isTouchDevice();   // once a plate: a finger does not come and go mid-game (the quest card reads it once too)
  root = part('star-hud');
  parts = Object.fromEntries(STAR_TRACKER_KEYS.map((k) => [k, part(`star-hud-${k}`)]));
  parts.phase.setAttribute?.('aria-live', 'polite');   // AUDIT STAR U2: the phase alone is spoken, never the countdown
  const light = part('star-hud-light');
  parts.gauge = part('star-hud-gauge');   // AUDIT STAR W7: the bar named - its light
  const track = part('star-hud-track');
  fill = part('star-hud-fill');
  track.append(fill);
  light.append(parts.gauge, track);
  root.append(parts.title, parts.near, parts.coven, parts.phase, light, parts.left);
  (doc.body ?? doc.documentElement)?.append(root);
  // its box changing on its own - the face arriving after the first measure - measures it again (the quest card's AUDIT GUIDE O5)
  const RO = doc.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
  if (typeof RO === 'function') { ro = new RO(() => { if (root && shown.vis === 'on') publish(doc, true); }); ro.observe(root); }
}

/** AUDIT STAR U1: the plate's bottom against the party list's line, published (0 hidden) - the quest card's measure
 *  (ui/quest/questTracker.js publishCard): its box where a page can say where it stands, its height where it cannot. */
function publish(doc, on) {
  const style = doc?.documentElement?.style;
  if (!style?.setProperty) return;
  let px = 0;
  if (on) {
    const r = root.getBoundingClientRect?.();
    if (r && Number.isFinite(r.bottom) && r.bottom > 0) px = Math.ceil(r.bottom) - (touch ? PARTY_TOUCH_TOP : PARTY_TOP) + STAR_TRACKER_GAP;
    else { const h = Math.ceil(Number(root.offsetHeight) || 0); px = h ? h + STAR_TRACKER_GAP : 0; }
  }
  style.setProperty(STAR_TRACKER_HEIGHT_VAR, `${Math.max(0, px)}px`);
}

/**
 * Draw the tracker for a reading (null hides it): `{ title, near, coven, phase, light, low, left, heart, held }`
 * (systems/starfall/starfallClient.js starTrackerModel); `hidden` the HUD's own hide.
 * @param {any} model @param {{ hidden?: boolean, doc?: any }} [o]
 */
export function drawStarTracker(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  let moved = false;
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; moved = true; }
  if (!want) { if (moved) { shown.at = ''; shown.cls = ''; root.className = 'star-hud'; publish(doc, false); } return; }   // its `on` gone: the party list's own line again
  for (const k of STAR_TRACKER_KEYS) { const v = model[k] ?? ''; if (v !== shown[k]) { shown[k] = v; parts[k].textContent = v; moved = true; } }
  const gauge = STAR_CARD_TEXT.light();
  if (gauge !== shown.gauge) { shown.gauge = gauge; parts.gauge.textContent = gauge; moved = true; }
  const cls = ['star-hud', 'on', touch && 'touch', model.heart && 'heart', model.low && 'low', model.held && 'held'].filter(Boolean).join(' ');
  if (cls !== shown.cls) { shown.cls = cls; root.className = cls; moved = true; }
  const pct = Math.round(Math.max(0, Math.min(1, Number(model.light) || 0)) * 100);
  if (pct !== shown.light) { shown.light = pct; fill.style.width = `${pct}%`; }
  // AUDIT STAR U1: measured again only when its words or its place may have moved - a part rewritten, the window
  // resized, the quest card above it grown or gone - never on a still frame
  const at = `${globalThis.innerWidth}x${globalThis.innerHeight}|${doc?.documentElement?.style?.getPropertyValue?.('--dfquest-h') ?? ''}`;
  if (moved || at !== shown.at) { shown.at = at; publish(doc, true); }
}
/** The tracker taken down (a load, a reset). */
export function destroyStarTracker() {
  const doc = root?.ownerDocument;
  try { ro?.disconnect?.(); } catch { /* gone */ }
  root?.remove?.();
  if (root) publish(doc ?? globalThis.document, false);
  root = null; parts = null; fill = null; touch = false; ro = null;
  shown.vis = ''; shown.cls = ''; shown.light = -1; shown.at = '';
  delete shown.gauge;
  for (const k of STAR_TRACKER_KEYS) delete shown[k];
}
