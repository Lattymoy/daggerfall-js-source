// @ts-check
// WILD-ALERT (2026-10-04, Mac: "Enemies alerted are given an exclamation point"): THE MARK OVER AN ALERTED FOE - a "!" in
// the HUD lines' own face (outlined gold, the pixel stack), over the head of each wilderness foe that has noticed the
// player (systems/encounters.js foeAlerted; systems/wildAlert.js says when). It pops in as the foe notices, holds while
// a fast traveller's clock is held for it (the host decides how long it stands - WILD_MARK_S in play), and goes.
//
// A READOUT, NOT A WINDOW, and DOM rather than the bitmap pass for the reason the crew's lines are (ui/navalHud.js
// drawCrewLines): a glyph that pops wants a CSS animation, and one element a mark, MOVED each frame and never rebuilt,
// is the party HUD's own discipline. Where a mark sits is the host's projection; this file wears the points.
//
// IT OWNS ITS OWN END. A host draws it every frame; a host whose loop stops (P0's unwind, a later boot) never says so to
// this layer, and a "!" left standing would float over the title menu. So while a mark stands the layer keeps a
// watchdog: a frame that does not come within WILD_MARKS_IDLE_MS takes the layer down (destroyWildMarks), and the next
// host's first draw raises it again.
//
// Not a DFU member: Daggerfall Unity marks no foe. Ledger A row (WILD-ALERT).
import { PIXEL_STACK } from './pixelifyFive.js';
import { injectEnhancedFonts } from './enhancedStyle.js';
import { WILD_MARK } from '../systems/wildAlert.js';

export const WILD_MARKS_STYLE_ID = 'dfwild-style';
/** The most marks standing at once - the nearest kept (an encounter pool is eight; a peer's camp rides beside it). */
export const WILD_MARKS_MAX = 12;
/** The mark's lift over the head point it is handed (CSS px). */
export const WILD_MARK_LIFT = 6;
/** How far the mark is drawn (m), and from where it begins to fade. */
export const WILD_MARK_RANGE = 140;
export const WILD_MARK_FADE_FROM = 90;
/** How long a standing mark waits for its next frame before the layer takes itself down (ms). */
export const WILD_MARKS_IDLE_MS = 400;

/** The mark's size by distance: whole near, a little smaller far off - never so small it is a speck. */
export const wildMarkScale = (distance) => Math.max(0.6, Math.min(1.25, 1.35 - (Math.max(0, distance) / 160)));
/** Its opacity by distance: whole to WILD_MARK_FADE_FROM, then down to a third at the range's end. */
export function wildMarkAlpha(distance) {
  if (!(distance > WILD_MARK_FADE_FROM)) return 1;
  if (distance >= WILD_MARK_RANGE) return 0;
  return 1 - ((distance - WILD_MARK_FADE_FROM) / (WILD_MARK_RANGE - WILD_MARK_FADE_FROM)) * (2 / 3);
}

export const WILD_MARKS_CSS = `
.dfwild-marks { position: fixed; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
.dfwild-mark { position: absolute; left: 0; top: 0; will-change: transform; }
.dfwild-mark > span { display: block; font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-size: 26px; line-height: 1;
  color: rgb(243,239,44); letter-spacing: 0;
  text-shadow: -2px 0 0 #050608, 2px 0 0 #050608, 0 -2px 0 #050608, 0 2px 0 #050608, 2px 2px 0 rgb(93,77,12), 3px 3px 0 rgba(0,0,0,0.45); }
.dfwild-mark.pop > span { animation: dfwild-pop 0.42s steps(6) both; }
@keyframes dfwild-pop { 0% { transform: translateY(6px) scale(0.2); opacity: 0; } 55% { transform: translateY(-4px) scale(1.35); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dfwild-mark.pop > span { animation: none; } }
`;

let root = null;
/** @type {Array<{ n: any, s: any, k: Record<string, any> }>} */
let slots = [];
/** @type {{ id: any, clear: (id: any) => void } | null} */
let watchdog = null;
const unwatch = () => { if (watchdog) { watchdog.clear(watchdog.id); watchdog = null; } };
/** The watchdog's arm: re-armed by every frame that draws a mark, cleared by one that draws none. */
function watch(on, timers) {
  unwatch();
  if (!on) return;
  const id = timers.set(() => { watchdog = null; destroyWildMarks(); }, WILD_MARKS_IDLE_MS);
  id?.unref?.();
  watchdog = { id, clear: timers.clear };
}
const TIMERS = { set: (fn, ms) => globalThis.setTimeout(fn, ms), clear: (t) => globalThis.clearTimeout(t) };

function inject(doc) {
  if (!doc.getElementById?.(WILD_MARKS_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = WILD_MARKS_STYLE_ID;
    st.textContent = WILD_MARKS_CSS;
    (doc.head ?? doc.documentElement)?.append(st);
  }
  if (doc.head) injectEnhancedFonts(doc);   // the pixel face on the classic skin too (the naval readout's own reason)
}

/**
 * The marks this frame. `points` - `{ key, x, y, distance }`, CSS px of the viewport, the head point (the host's
 * projection, in front of the eye); the nearest WILD_MARKS_MAX are drawn. `covered` a window over the HUD: none.
 * @param {Array<{ key: string, x: number, y: number, distance: number }>} points
 * @param {{ covered?: boolean, doc?: any, scale?: number, timers?: { set: (fn: () => void, ms: number) => any, clear: (id: any) => void } }} [opts]
 *   `timers` the watchdog's clock (the page's setTimeout; a pin hands its own)
 */
export function drawWildMarks(points, { covered = false, doc = globalThis.document, scale = 1, timers = TIMERS } = {}) {
  const want = covered ? [] : [...(points ?? [])].filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.distance < WILD_MARK_RANGE)
    .sort((a, b) => a.distance - b.distance).slice(0, WILD_MARKS_MAX);
  watch(want.length > 0, timers);
  if (!root) {
    if (!want.length || !doc?.createElement) return;
    inject(doc);
    root = doc.createElement('div');
    root.className = 'dfwild-marks';
    root.setAttribute?.('aria-hidden', 'true');
    (doc.body ?? doc.documentElement)?.append(root);
  }
  while (slots.length < want.length) {
    const n = doc.createElement('div');
    n.className = 'dfwild-mark';
    const s = doc.createElement('span');
    s.textContent = WILD_MARK;
    n.append(s);
    root.append(n);
    slots.push({ n, s, k: {} });
  }
  // EACH MARK KEEPS ITS OWN ELEMENT while it stands - the nearest-first order moves every frame, and a pop handed to
  // another element mid-way would be cut short (or played twice)
  const wantKeys = new Set(want.map((p) => p.key));
  const free = [];
  const held = new Map();
  for (const slot of slots) {
    if (slot.k.key != null && wantKeys.has(slot.k.key) && !held.has(slot.k.key)) held.set(slot.k.key, slot);
    else free.push(slot);
  }
  for (const p of want) {
    let slot = held.get(p.key);
    if (!slot) {
      // a mark not standing last frame takes a free element and pops (a mark that stands keeps its own)
      slot = free.shift();
      slot.k.key = p.key;
      slot.n.className = 'dfwild-mark';
      void slot.n.offsetWidth;   // a reflow between, so a reused element plays the pop again
      slot.n.className = 'dfwild-mark pop';
    }
    if (slot.k.on !== true) { slot.k.on = true; slot.n.style.display = ''; }
    const sc = Math.round(wildMarkScale(p.distance) * scale * 100) / 100;
    const at = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) scale(${sc}) translate(-50%, calc(-100% - ${WILD_MARK_LIFT}px))`;
    if (slot.k.at !== at) { slot.k.at = at; slot.n.style.transform = at; }
    const al = String(Math.round(wildMarkAlpha(p.distance) * 100) / 100);
    if (slot.k.a !== al) { slot.k.a = al; slot.n.style.opacity = al; }
  }
  for (const slot of free) {
    slot.k.key = null;
    if (slot.k.on !== false) { slot.k.on = false; slot.n.style.display = 'none'; }
  }
}

/** The page is going (a test's reset, the host's teardown): the layer leaves with it. */
export function destroyWildMarks() {
  unwatch();
  root?.remove?.();
  root = null; slots = [];
}

export const wildMarksMounted = () => !!root;
