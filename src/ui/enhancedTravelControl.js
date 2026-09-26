// TO1 - THE ENHANCED LANE'S TRAVEL PANEL. Mac, 2026-09-17, with the
// mod: "One additionally feature I want to add that isn't apart of this
// package is an enhanced version of the UI for enhanced mode."
//
// So this is the port's OWN, not Hazelnut's. The classic panel
// (ui/travelControlUI.js) is his 320x27 strip, rect for rect; this is
// the same five controls in the enhanced skin's language - the brass
// and bone of ui/enhancedStyle.js, at the screen's own resolution,
// with the things a 320-pixel strip had no room to say: the hours and
// minutes still to go, how far the destination is, what the journey is
// following, and the junction map as a real canvas rather than a
// hundred stretched texels.
//
// IT IS THE HUD'S KIND OF THING, NOT A WINDOW. ui/enhancedHud.js's
// header states the law it is built on: "IT IS A READOUT, NOT A
// WINDOW. Nothing here ... registers with the overlay stack", and it
// is painted from `drawHud`, the one call every host already makes.
// The same holds here for the same reason - an accelerated journey
// must not pause the game, and anything in the port's overlay slot
// does (scenes/world.js `_overlayHeld`, and townTalk's keydown returns
// true for whatever stands in it, so the player could not even steer).
// Two differences from the HUD: this one has BUTTONS, so its controls
// opt back into pointer events the way the touch quickslots do
// (`pointer-events: auto` on the controls alone), and it paints only
// while a journey is running.
//
// UPDATED, NOT REBUILT - the HUD's third law, for the same reason: at
// fifty times speed this is asked sixty times a second.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import {
  JUNCTION_MAP_WIDTH, JUNCTION_MAP_HEIGHT, JUNCTION_MAP_W2, JUNCTION_MAP_H2,
  JUNCTION_HERE_PT, junctionDirectionIndex, drawMapSection, DOT_SCALE, packRGBA,
} from './travelPathsOverlay.js';
import { TRAVEL_OPTIONS_TEXT as T } from '../systems/travelOptionsText.js';

export const ENHANCED_TRAVEL_ID = 'enhanced-travel';

let host = null;
let parts = null;
let last = null;

/** enhancedHud.js:278 - write only on a change. */
function put(node, key, value) {
  if (!node || last[key] === value) return;
  last[key] = value;
  node.textContent = value;
}
function cls(node, key, value) {
  if (!node || last[key] === value) return;
  last[key] = value;
  node.className = value;
}

function build(doc, hooks) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const root = doc.createElement('div');
  root.id = ENHANCED_TRAVEL_ID;
  root.className = 'travelpanel';
  root.innerHTML = `
    <div class="travelpanel-bar">
      <div class="travelpanel-dest">
        <span class="travelpanel-label">Travelling to</span>
        <span class="travelpanel-name"></span>
        <span class="travelpanel-sub"></span>
      </div>
      <div class="travelpanel-speed">
        <span class="travelpanel-label">Time</span>
        <div class="travelpanel-stepper">
          <button type="button" class="travelpanel-step" data-act="slower" aria-label="Slower">&#8722;</button>
          <span class="travelpanel-accel">1</span>
          <button type="button" class="travelpanel-step" data-act="faster" aria-label="Faster">+</button>
        </div>
      </div>
      <div class="travelpanel-acts">
        <button type="button" class="travelpanel-act" data-act="map" title="${T.TipMap}">Map</button>
        <button type="button" class="travelpanel-act" data-act="camp" title="${T.TipCamp}">Camp</button>
        <button type="button" class="travelpanel-act travelpanel-exit" data-act="exit">Exit</button>
      </div>
    </div>
    <div class="travelpanel-msg"></div>
    <canvas class="travelpanel-junction" width="${JUNCTION_MAP_WIDTH * DOT_SCALE}" height="${JUNCTION_MAP_HEIGHT * DOT_SCALE}"></canvas>
  `;
  doc.body.append(root);
  root.addEventListener('click', (e) => {
    const act = e.target?.closest?.('[data-act]')?.dataset?.act;
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    hooks[act]?.();
  });
  return {
    root,
    name: root.querySelector('.travelpanel-name'),
    sub: root.querySelector('.travelpanel-sub'),
    accel: root.querySelector('.travelpanel-accel'),
    msg: root.querySelector('.travelpanel-msg'),
    junction: root.querySelector('.travelpanel-junction'),
    bar: root.querySelector('.travelpanel-bar'),
  };
}

/** The journey's remaining time, as the panel says it. `minutes` is
 *  what the popup estimated; a journey that has been running knows
 *  how long it has been. Both are the mod's own numbers - this only
 *  spells them. */
export function etaText(minutesLeft) {
  if (!Number.isFinite(minutesLeft) || minutesLeft <= 0) return '';
  const h = Math.trunc(minutesLeft / 60), m = Math.trunc(minutesLeft % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** The straight-line distance to the destination, in map pixels, which
 *  is the only honest unit the port has for it: a map pixel is a
 *  kilometre and a half of Iliac Bay. */
export function distanceText(from, to) {
  if (!from || !to) return '';
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.round(Math.sqrt(dx * dx + dy * dy));
  return d <= 0 ? 'arriving' : `${d} pixel${d === 1 ? '' : 's'} out`;
}

/** The junction map, into the panel's own canvas at whatever size the
 *  screen gives it. Same buffer and same routine as the classic
 *  panel's (ui/travelJunctionMap.js) - one law, two skins. */
export function paintJunction(canvas, buf, { mapPixel, direction, settings, deps }) {
  if (!canvas?.getContext) return false;
  drawMapSection(buf, {
    originX: mapPixel.x - JUNCTION_MAP_W2, originY: mapPixel.y - JUNCTION_MAP_H2,
    width: JUNCTION_MAP_WIDTH, height: JUNCTION_MAP_HEIGHT,
    circular: settings?.junctionMapCircular !== false,
  }, {
    pathsAt: (x, y, type) => deps.pathsAt?.(x, y, type) ?? 0,
    locationAt: (x, y) => deps.locationAt?.(x, y) ?? null,
    colorOf: (t) => deps.locationColorOf?.(t) ?? null,
    onlyLargeDots: !(settings?.variableSizeDots ?? false),
    markedMapId: deps.markedMapId?.() ?? -1,
    markColor: settings?.markLocationColor ? packRGBA(...settings.markLocationColor) : null,
    showPaths: [true, true, false, false],
  });
  const player = settings?.playerColor ? packRGBA(...settings.playerColor) : packRGBA(255, 0, 0, 255);
  buf[JUNCTION_HERE_PT] = player;
  const pip = junctionDirectionIndex(direction);
  if (pip > 0 && pip < buf.length) buf[pip] = player;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const w = JUNCTION_MAP_WIDTH * DOT_SCALE, h = JUNCTION_MAP_HEIGHT * DOT_SCALE;
  const img = ctx.createImageData(w, h);
  const out = new Uint32Array(img.data.buffer);
  // the buffer is bottom-up, as every generated map texture in this
  // port is (ui/travelMapWindow.js:1438-1446)
  for (let row = 0; row < h; row++) out.set(buf.subarray((h - row - 1) * w, (h - row) * w), row * w);
  ctx.putImageData(img, 0, 0);
  return true;
}

/** The panel's frame. `state` is what the journey knows:
 *  { showing, covered, destination, following, accel, message, minutesLeft,
 *    from, to, junction: { on, mapPixel, direction, settings, deps, buf } }
 *  `hooks` are the five controls, wired once at build.
 *
 *  AUDIT-TO1 F1: THE JUNCTION MAP OUTLIVES THE BAR. In the mod the
 *  mini-map is a child of the HUD's native panel (TravelOptionsMod.cs
 *  :358) whose visibility is `Enabled` alone, and the two moments it
 *  exists for are both moments the travel window is DOWN: the stop at
 *  a junction (SelectNextPath enables the panel and then closes the
 *  window, :735-748) and the off-path toggle (:646-652, no journey at
 *  all). So `showing: false` with `junction.on` keeps the panel mounted
 *  with the bar and the message hidden and the disc alone on screen.
 *
 *  AUDIT-TO1 L7: `covered` is the HUD's own word (enhancedHud.js) - a
 *  window over the HUD hides this too. The mod keeps its travel UI up
 *  under its own map on purpose (:1343-1345) but that map is opaque;
 *  this port's enhanced overworld is a GL picture under transparent
 *  chrome, and the brass bar painted straight over the bay. */
export function drawEnhancedTravelControl(state = {}, hooks = {}) {
  if (typeof document === 'undefined') return null;
  const junctionOnly = !state.showing && !!state.junction?.on;
  if (!state.showing && !junctionOnly) { hideEnhancedTravelControl(); return null; }
  if (!host) { last = {}; parts = build(document, hooks); host = parts.root; }
  if (state.covered) {
    if (last.covered !== true) { last.covered = true; parts.root.style.display = 'none'; }
    return parts.root;
  }
  if (last.covered === true) { last.covered = false; parts.root.style.display = ''; }
  // PLUS8: THE HUD'S SCALE, READ OFF THE HUD. The bar stands under the
  // compass (Enhanced Plus - ui/enhancedPlusStyle.js TRAVEL_CSS), and the
  // compass grows with --hud-scale; this panel is a sibling of `.hud` on
  // <body>, not a child, so it never inherited the variable (AUDIT FONT
  // F2's finding for the mid-screen label, again). The number is the one
  // enhancedHud.js already wrote on its own host - read, not recomputed,
  // so the clamp keeps its one home. An inline style read: no layout.
  const scale = document.querySelector('.hud')?.style?.getPropertyValue('--hud-scale') || '1';
  if (last.scale !== scale) { last.scale = scale; parts.root.style.setProperty('--hud-scale', scale); }
  cls(parts.root, 'rootClass', `travelpanel${state.following ? ' following' : ''}${junctionOnly ? ' junction-only' : ''}`);
  cls(parts.bar, 'barClass', junctionOnly ? 'travelpanel-bar hidden' : 'travelpanel-bar');
  put(parts.name, 'name', String(state.destination ?? ''));
  const eta = etaText(state.minutesLeft);
  const dist = distanceText(state.from, state.to);
  put(parts.sub, 'sub', [eta, dist].filter(Boolean).join('  ·  '));
  put(parts.accel, 'accel', `×${state.accel ?? 1}`);
  put(parts.msg, 'msg', String(state.message ?? ''));
  cls(parts.msg, 'msgClass', state.message && !junctionOnly ? 'travelpanel-msg show' : 'travelpanel-msg');
  const j = state.junction;
  cls(parts.junction, 'junctionClass', j?.on ? 'travelpanel-junction show' : 'travelpanel-junction');
  if (j?.on && j.buf) {
    const key = `${j.mapPixel.x},${j.mapPixel.y},${j.direction}`;
    if (last.junctionKey !== key) {
      last.junctionKey = key;
      paintJunction(parts.junction, j.buf, j);
    }
  }
  return parts.root;
}

/** The panel goes away when the journey does. Kept mounted but hidden
 *  would be the HUD's shape; a journey is rare and its panel is not
 *  cheap (a canvas), so this one is torn down. */
export function hideEnhancedTravelControl() {
  if (!host) return;
  try { host.remove(); } catch { /* already gone */ }
  host = null; parts = null; last = null;
}

export const enhancedTravelControlMounted = () => !!host;

/** The mod's own two tooltips, for the buttons that carry them. */
export const TRAVEL_TIPS = Object.freeze({ map: T.TipMap, camp: T.TipCamp });
