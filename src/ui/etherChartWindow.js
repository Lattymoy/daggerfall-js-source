// @ts-check
// ETHER-CHART (2026-10-11, the owner: "A brand new open sea map that allows you to traverse to the etheric sea";
// bible/03-World/Eltheric-Ocean.md ETHER-CHART) - THE CHART OF THE ELTHERIC OCEAN: the map a captain keeps past the Veil, the
// travel map's door's answer there (scenes/world.js toggleTravelMap) - the Bay's travel map has no sea past the Veil to
// show, and no road to travel by. Drawn on a canvas in the naval windows' sheet (ui/naval/navalPlunderWindow.js's style, the
// door's slot - ui/naval/navalPlunderDoor.js), off the world's word (scenes/etherHost.js chart): the ISLES CHARTED - a port's
// gold, a ruin's red, a wild isle's green, a rock's grey, each named as the zoom allows - the SHIP and her heading, THE
// VEIL down the chart's east edge and the way home through it, the BANDS' bounds and names (each on its own deeper side,
// the Shallows by the Veil), and the HAUNTS of the legends heard of, the square each is (dim while she lies sunk). Pan by
// dragging (a finger, the mouse's first button) or the arrows; zoom by the wheel (about the pointer, a notch a step),
// a pinch (about the fingers), + and - or the window's own buttons (about the chart's middle); C or Ship back to the
// ship; a pointer on an isle - or a tap - says what it is and how far, and which way, from the ship. The key that opened
// it (the travel map's or the map's, by binding) closes it. Nothing on it is travelled to: the Eltheric Ocean is sailed,
// and the chart's one way out to travel is the Overworld's door (ETHER-OW, below; AUDIT ETHER-OW D-5). AUDIT CAPTAIN'S
// SEA X6/X7/X8/X12/X13/X14/X17/X18.
//
// ETHER-OW (2026-10-13, the owner: "Also allow the player to zoom out into the overworld like in the Iliac Bay for easy
// travel") - THE DOOR UP: past the Veil this chart is the map's answer, and the held map's Overworld door (ui/heldMap.js,
// TV1) was on no sheet a captain there could open - so the chart wears it, in its tools row and on its key, O, the
// view's own words (scenes/travelView.js TRAVEL_VIEW_BUTTON): shown where the host can lift the camera (`overworld()`),
// it shuts the chart with its own reason, 'overworld', and the host lifts the view once the chart is down.
//
// ETHER-CHART2 (2026-10-12, the owner: "I want to improve the [Eltheric] sea map, its icons, the highlight areas, etc and
// improve readability") - THE CHART READ AT A GLANCE. Its words are the enhanced face (FONT1's law - every enhanced
// surface in the pixel face; the chart named "Cormorant Garamond", which no request loads, so every name on it was
// Georgia), painted after every mark (an isle's mark painted after a name crossed it out) - each name under a hard halo,
// on its isle's east side or its west, in layers that keep any two from standing over each other. Every isle's MARK is a
// shape as well as a colour (a port round, a ruin a diamond, a wild isle a peak, a rock a cross - a ruin's red and a
// wild isle's green are the pair a red-green eye cannot tell apart), over its land at the chart's own scale once the
// land outgrows the mark; Veilhaven ringed. The DEPTHS are areas, each band its own water, under a grid a scale bar
// long; the world's edge drawn and hatched. A HAUNT is a washed square, a sunk legend's hatched and dashed, her name and
// state on a plate in a clear corner of her square's part in view. The SHIP is a bone arrowhead in a brass ring and, off
// the canvas, a pointer at the edge saying how far. The isle named is ringed, a bearing drawn to it from the ship and its
// card beside it. AUDIT ETHER-CHART2 (bible/01-Overview/audits/Audit-Ether-Chart2.md) took the chart's own words off the map:
// a DEPTH RULER over it names each water in view, the Veil's and the world's edge, and the scale stands in the KEY under
// it, which says what each mark is.
//
// deps = { word() -> etherHost.js chart's, onExit(reason), overworld() -> whether the Overworld's door stands (ETHER-OW) }. Pure beside the mount: the view's sums (`toScreen`,
// `toChart`, `chartZoomAt`), the chart's model (`chartModel`), the scale (`scaleBar`), a name's two sides
// (`labelBoxes`) and the edge's pointer (`edgePointer`). The painters are handed their contexts: `paintChart` the
// chart, `paintRuler` the ruler, `paintScale` the key's bar, `paintMark` and `paintKey` a mark and a key's mark.
import { closeOnOutsideTap } from './enhanced/enhancedOverlays.js';
import { overlayAction, bindings } from './input.js';
import { actionsForCode } from '../systems/inputActions.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { injectNavalKit } from './naval/navalHud.js';
import { injectNavalWindowStyle } from './naval/navalPlunderWindow.js';
import { PIXEL_STACK } from './pixelifyFive.js';
import { TRAVEL_VIEW_BUTTON } from '../scenes/travelView.js';   // ETHER-OW: the Overworld door's words, the held map's own
import { t } from '../systems/textManager.js';   // L10N4 (at the merge of main): the chart's words in the player's language, read when they are drawn
import { isleByKey, BANDS, VEIL_X, LEAGUE_PX, KIND_WORDS, ETHER_BOX, compassPoint, veilhaven, ETHER_SEA_NAME } from '../world/ethericSea.js';
import { hauntOf, legendById, HAUNT_PX } from '../systems/naval/etherShips.js';
import { isleGood, goodById } from '../systems/naval/tradeGoods.js';   // ISLE-TRADE: a port isle's own good of the Bay, on its card
import { ETHER_PEACE_PX, etherWayWord } from '../systems/wild/etherWild.js';   // ETHER-WILD: Veilhaven's peace, drawn where the open sea's fights begin
import { paintWildCrows, paintWildLocks } from './wild/wildMapInk.js';   // SEA-VAULTS: the mountains' crows and padlock, on the chart's paper
import { HALL_INK } from './ink/inkMap.js';   // SEA-VAULTS: a vault's oxblood, the halls' own

/** The zooms: screen pixels a map pixel (819.2 m). */
export const CHART_ZOOMS = Object.freeze([1, 2, 4, 8, 16]);
export const CHART_ZOOM_DEFAULT = 2;
/** A name is lettered at this zoom and over (a port's at any). */
export const LABEL_ZOOM = 8;
/** An arrow's pan, in screen pixels. */
export const PAN_STEP = 80;
/** The kinds' colours on the chart (ETHER-CHART2: lifted to read on the depths' water). */
export const KIND_COLOURS = Object.freeze({ port: '#f0c06a', ruin: '#e0664c', wild: '#6cc48a', rock: '#a9afba' });
/** ETHER-CHART2: the faces the chart letters in - the enhanced skin's pixel stack at FONT3's reading weight (FONT1:
 *  every enhanced surface in the enhanced face) - and the reading pair's half pixel of tracking. */
export const CHART_FONT = Object.freeze({ name: `500 12px ${PIXEL_STACK}`, small: `500 11px ${PIXEL_STACK}` });
export const CHART_TRACKING = '0.5px';
/** AUDIT CAPTAIN'S SEA X14: a name's box on the chart, as the model reckons it - no two names lettered over each other,
 *  ports first. ETHER-CHART2: the window measures each name in its face; where no canvas does (node), a letter is
 *  this - the mean of 755 isles' names in CHART_FONT.name, measured in Chromium. */
export const LABEL_CHAR_PX = 6.7;
export const LABEL_H = 14;
/** ETHER-CHART2: the margin the chart's own words keep from the canvas's edge. */
export const CHART_MARGIN = 8;
/** ETHER-CHART2: an isle's mark's half side at each zoom (a port's one more). */
export const ICON_PX = Object.freeze([2.5, 3, 4, 5, 6]);
/** ETHER-CHART2: the scale bar's lengths (leagues) and its longest (px) - the grid's squares the bar's length. */
export const SCALE_LEAGUES = Object.freeze([1, 2, 5, 10, 20, 50, 100]);
export const SCALE_MAX_PX = 120;
/** AUDIT ETHER-CHART2 U2: THE DEPTH RULER - its height over the chart, and each water's words on it, longest first: a
 *  band's name and its name alone, the Veil's way home, the world's edge past the sea's box. */
export const RULER_H = 22;
export const RULER_WORDS = Object.freeze({
  ...Object.fromEntries(BANDS.map((b) => [b.id, Object.freeze([b.name.toUpperCase(), b.name.replace(/^the /, '').toUpperCase()])])),
  get veil() { return Object.freeze([t('sea.chart.ruler.veilHome', 'THE VEIL: TO THE ILIAC BAY'), t('sea.chart.ruler.veil', 'THE VEIL'), t('sea.chart.ruler.veilShort', 'VEIL')]); },
  get edge() { return Object.freeze([t('sea.chart.ruler.edge', 'THE WORLD\'S EDGE'), t('sea.chart.ruler.edgeShort', 'EDGE')]); },
});
/** ETHER-CHART2: the ship's pointer stands this far in from the canvas's edge. */
export const EDGE_INSET = 26;
/** ETHER-CHART2: the depths' waters, the Shallows' lightest by the Veil; past the box the world's edge. */
export const DEPTH_TONES = Object.freeze({ shallows: '#173a55', reaches: '#112b42', deep: '#0b1d31', abyss: '#06101d' });
export const VOID_TONE = '#030508';
/** AUDIT ETHER-CHART2 U3: the world's edge's line, where the sea's box meets the void. */
export const EDGE_LINE = 'rgba(170,195,230,0.55)';
/** ETHER-CHART2: the key under the chart - each mark, and what it is. */
/** L10N4: a row of the key - `[what, words]`, its words read in the player's language each time the row is. */
const keyRow = (what, words) => Object.freeze(Object.defineProperty([what], 1, { enumerable: true, get: words }));
export const CHART_KEY = Object.freeze([
  keyRow('port', () => t('sea.chart.key.port', 'Port')), keyRow('ruin', () => t('sea.chart.key.ruin', 'Ruin')),
  keyRow('wild', () => t('sea.chart.key.wild', 'Wild isle')), keyRow('rock', () => t('sea.chart.key.rock', 'Bare rock')),
  keyRow('ship', () => t('sea.chart.key.ship', 'Your ship')), keyRow('haunt', () => t('sea.chart.key.haunt', 'A legend\'s haunt')),
  keyRow('sunk', () => t('sea.chart.key.sunk', 'A legend sunk')),
]);
/** ETHER-WILD (2026-10-21): the key's row for Veilhaven's peace - shown while the chart's word says the open sea is an
 *  open PvP zone (`pvp`: online, at a relay that raises it), beside CHART_KEY's marks. */
export const CHART_PEACE_KEY = keyRow('peace', () => t('sea.chart.key.peace', 'Veilhaven\'s peace - past it, open PvP'));
/** ETHER-WILD: the peace's colours - a safe harbour's green over the depths, apart from every isle's and haunt's. */
export const PEACE_FILL = 'rgba(110,214,170,0.13)';
export const PEACE_LINE = 'rgba(140,232,190,0.85)';
/** ETHER-WILD: the peace is named on the chart once its circle is this wide (screen pixels of radius). */
export const PEACE_NAME_R = 40;
/** SEA-VAULTS (2026-10-22): the key's row for the day's vaults of the deep - shown while the word carries any. */
export const CHART_VAULT_KEY = keyRow('vault', () => t('sea.chart.key.vault', 'A vault of the deep, open today'));
/** SEA-VAULTS: a vault's name is lettered under its mark from this zoom (x4). */
export const VAULT_NAME_ZOOM = 2;
/** SEA-EVENTS (2026-10-22): the key's rows for the Aether Storm blowing and the treasure fleet under way - each shown
 *  while the word carries it. */
export const CHART_STORM_KEY = keyRow('storm', () => t('sea.chart.key.storm', 'The Aether storm, blowing now'));
export const CHART_FLEET_KEY = keyRow('fleet', () => t('sea.chart.key.fleet', 'The treasure fleet, under way'));
/** SEA-EVENTS: the storm's colours - the aether's violet over the depths - and the fleet's gold. */
export const STORM_FILL = 'rgba(150,118,236,0.15)';
export const STORM_LINE = 'rgba(190,166,255,0.9)';
export const FLEET_INK = '#f2c14e';
/** SEA-EVENTS: the storm is named on the chart once its circle is this wide (screen pixels of radius). */
export const STORM_NAME_R = 36;
/** SEA-EVENTS: the storm's name on the chart, and the fleet's under its mark. */
export const stormName = () => t('sea.chart.storm', 'AETHER STORM');
export const fleetName = (name, sunk) => (sunk ? t('sea.chart.fleetSunk', 'Treasure fleet (scattered)') : t('sea.chart.fleet', 'Treasure fleet: {ship}', { ship: name }));
/** ETHER-WILD: the peace's name on the chart. */
export const peaceName = () => t('sea.chart.peace', 'VEILHAVEN\'S PEACE');
/** AUDIT CAPTAIN'S SEA X18: the wheel's travel a zoom step takes (a trackpad's light brush was a step an event). */
export const CHART_WHEEL_STEP = 100;
/** AUDIT CAPTAIN'S SEA X6: a press that moves less than this (px) is a tap; two fingers' spread by this share a step. */
export const CHART_TAP_PX = 8;
export const CHART_PINCH_STEP = 1.6;
/** A name opening a line, its first letter raised ("the Sepulchre of Aelorrel" leads a sentence as "The Sepulchre..."). */
export const capFirst = (t) => String(t ?? '').replace(/^./, (c) => c.toUpperCase());
/** The chart's title, and its dialog's name - the sea's name its one home's (ELTHERIC; L10N4: the words about it the
 *  player's language's, the name itself as `world/ethericSea.js` says it). */
export const chartTitle = () => t('sea.chart.title', 'A chart of {sea}', { sea: ETHER_SEA_NAME });

/** @typedef {{ cx: number, cy: number, zoom: number }} ChartView */
/** A chart point (map pixels) on the canvas (`w` x `h`): the view's centre the canvas's. */
export const toScreen = (v, px, py, w, h) => [w / 2 + (px - v.cx) * CHART_ZOOMS[v.zoom], h / 2 + (py - v.cy) * CHART_ZOOMS[v.zoom]];
/** ...and back. */
export const toChart = (v, sx, sy, w, h) => [v.cx + (sx - w / 2) / CHART_ZOOMS[v.zoom], v.cy + (sy - h / 2) / CHART_ZOOMS[v.zoom]];
/** The view zoomed `dir` steps (+ in) about a canvas point, which stays over the same chart point. */
export function chartZoomAt(v, dir, sx, sy, w, h) {
  const zoom = Math.max(0, Math.min(CHART_ZOOMS.length - 1, v.zoom + Math.sign(dir)));
  if (zoom === v.zoom) return v;
  const [px, py] = toChart(v, sx, sy, w, h);
  const k = CHART_ZOOMS[zoom];
  return clampChartView({ cx: px - (sx - w / 2) / k, cy: py - (sy - h / 2) / k, zoom });
}
/** The view kept over the sea's box - its centre (the chart's edges may show past the box at its corners). */
export const clampChartView = (v) => ({ zoom: v.zoom, cx: Math.max(ETHER_BOX.x0, Math.min(ETHER_BOX.x1, v.cx)), cy: Math.max(ETHER_BOX.y0, Math.min(ETHER_BOX.y1, v.cy)) });

/** Which way, and how far, a point lies from another: "12 leagues west-north-west" (map y runs south). */
export function wayWords(from, to) {
  const dx = to.px - from.px, dy = to.py - from.py;
  const leagues = Math.hypot(dx, dy) / LEAGUE_PX;
  if (leagues < 0.5) return t('sea.chart.here', 'here');
  return t('sea.chart.way', '{n, plural, one {# league} other {# leagues}} {point}', { n: Math.max(1, Math.round(leagues)), point: etherWayWord(compassPoint(dx, dy)) });   // AUDIT SEA VENTURES F4: the point in the language of the moment
}
/** An isle in a line: "Port Pelleveth - a port - 12 leagues west-north-west" - its name's first letter raised (X17). */
export const isleWords = (isle, ship) => t('sea.chart.isleLine', '{name} - {kind} - {way}', { name: capFirst(isle.name), kind: KIND_WORDS[isle.kind] ?? t('sea.chart.anIsle', 'an isle'), way: wayWords(ship, isle) });

/** ETHER-CHART2: THE SCALE at a zoom - the longest of SCALE_LEAGUES whose bar is no longer than SCALE_MAX_PX - and its
 *  words; the grid's squares are its length. */
export function scaleBar(zoom) {
  const per = LEAGUE_PX * CHART_ZOOMS[zoom];
  let leagues = SCALE_LEAGUES[0];
  for (const n of SCALE_LEAGUES) if (n * per <= SCALE_MAX_PX) leagues = n;
  return { leagues, px: leagues * per, words: t('sea.chart.scale', '{n, plural, one {# league} other {# leagues}}', { n: leagues }) };
}
/** ETHER-CHART2: A NAME'S TWO SIDES - its isle's east, then its west - for a name `tw` wide (the model's boxes are
 *  `[x0, y0, x1, y1]`, the name centred on its isle's row). */
export const labelBoxes = (i, tw) => [
  [i.x + i.r + 4, i.y - LABEL_H / 2, i.x + i.r + 4 + tw, i.y + LABEL_H / 2],
  [i.x - i.r - 4 - tw, i.y - LABEL_H / 2, i.x - i.r - 4, i.y + LABEL_H / 2],
];
/** Do two boxes overlap? */
const overlaps = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
/** ETHER-CHART2: THE SHIP'S POINTER off the canvas - where the line from the canvas's middle to her crosses a rectangle
 *  EDGE_INSET in from its edge, and the way it points. */
export function edgePointer(x, y, w, h) {
  const cx = w / 2, cy = h / 2, dx = x - cx, dy = y - cy;
  const t = Math.max(0, Math.min(dx ? (cx - EDGE_INSET) / Math.abs(dx) : Infinity, dy ? (cy - EDGE_INSET) / Math.abs(dy) : Infinity));
  return { x: cx + dx * t, y: cy + dy * t, a: Math.atan2(dy, dx) };
}
/** The marks in multiples of `step` from `a` to `b` (either way round). */
const ticks = (a, b, step) => {
  const out = [];
  for (let t = Math.ceil(Math.min(a, b) / step) * step; t <= Math.max(a, b); t += step) out.push(t);
  return out;
};

/**
 * THE CHART'S MODEL for a canvas of `w` x `h` over the view: the charted isles on it (`{ key, name, kind, x, y, r, land,
 * icon, home, label, box }` - `land` the isle's own radius at the zoom, `icon` its mark's half side, `r` the larger;
 * lettered by the zoom, ports first, on the first of its sides clear of every name lettered (`box`)), the bands' bounds
 * on it (`{ x, name, line }` - the Shallows' the Veil, no line of its own), the depths' waters (`{ id, x0, x1 }`), the
 * depth ruler's (`ruler`: `{ id, x0, x1, words }` - the world's edge, the bands', the Veil's; `words` null where none
 * fits), the sea's box (`edge`), the grid, the scale, the Veil's x (null off it), the ship (`{ x, y, yaw, on, edge, way,
 * label }` - off the canvas, her pointer, her way from its middle and its words' place), the haunts heard of on it (`{ x,
 * y, r, name, sails, sub, inside, at, box }` - `r` a haunt's half side: a haunt is the square legendAt reads; `inside`
 * her name on a plate in her square, else alone over it; `at` and `box` null where it gave way), the isle named (`pick`:
 * `{ key, x, y, r, title, words, box }`, its card's `box`), and the header's two lines.
 * @param {any} word - etherHost.js chart's @param {ChartView} v @param {number} w @param {number} h
 * @param {{ measure?: ((text: string, font: string) => number) | null, pick?: string | null }} [opts] - a name's width
 *   in a face (the window's canvas; the mean letter, LABEL_CHAR_PX, without one) and the isle named
 */
export function chartModel(word, v, w, h, { measure = null, pick = null } = {}) {
  const k = CHART_ZOOMS[v.zoom];
  const on = (x, y, pad = 0) => x >= -pad && y >= -pad && x <= w + pad && y <= h + pad;
  /** @param {string} t @param {string} [font] */
  const width = (t, font = CHART_FONT.name) => (measure ? measure(t, font) : t.length * LABEL_CHAR_PX);
  const home = veilhaven().key;
  const isles = [];
  for (const key of word.charted ?? []) {
    const i = isleByKey(key);
    if (!i) continue;
    const [x, y] = toScreen(v, i.px + 0.5, i.py + 0.5, w, h);
    const land = i.r * k, icon = ICON_PX[v.zoom] + (i.kind === 'port' ? 1 : 0);
    const r = Math.max(icon + 1, land);
    if (!on(x, y, r + 80)) continue;
    isles.push({ key, name: i.name, kind: i.kind, x, y, r, land, icon, home: key === home, box: null, label: i.kind === 'port' || v.zoom >= CHART_ZOOMS.indexOf(LABEL_ZOOM) });
  }
  // ETHER-CHART2: the sea's box on the canvas, each band's water across it (the Abyss's to the box's west edge), and the
  // grid - a line each scale bar's length of depth west of the Veil, and of rows north and south of Veilhaven's
  const [bx0, by0] = toScreen(v, ETHER_BOX.x0, ETHER_BOX.y0, w, h), [bx1, by1] = toScreen(v, ETHER_BOX.x1, ETHER_BOX.y1, w, h);
  const boundX = (n) => (n < BANDS.length ? toScreen(v, VEIL_X - BANDS[n].from * LEAGUE_PX, 0, w, h)[0] : bx0);
  const depths = [];
  BANDS.forEach((b, n) => {
    const x0 = Math.max(0, bx0, boundX(n + 1)), x1 = Math.min(w, boundX(n));
    if (x1 > x0) depths.push({ id: b.id, x0, x1 });
  });
  const bands = [];
  BANDS.forEach((b, n) => {
    const x = boundX(n);
    if (x >= 0 && x <= w + 80) bands.push({ x, name: b.name, line: b.from > 0 });   // AUDIT CAPTAIN'S SEA X12: the Shallows named by the Veil
  });
  const [veil] = toScreen(v, VEIL_X, 0, w, h);
  // AUDIT ETHER-CHART2 U2: THE DEPTH RULER over the chart - the water across it, west to east: the world's edge, each
  // band's, the Veil's to the canvas's east edge - each named on it, centred in its own water (AUDIT CAPTAIN'S SEA X12's
  // deeper side kept: a name stands between its own bounds), the longest of its words that fits, or none. Off the map, so
  // no name of the chart's own is ever crowded out by an isle's, nor stands over one.
  const ruler = [];
  const segment = (id, x0, x1) => ruler.push({ id, x0, x1, words: /** @type {string|null} */ (null) });
  if (bx0 > 0) segment('edge', 0, Math.min(w, bx0));
  for (const d of depths) segment(d.id, d.x0, d.x1);
  if (veil < w) segment('veil', Math.max(0, veil), w);
  ruler.sort((a, b) => a.x0 - b.x0);   // read west to east
  for (const seg of ruler) seg.words = RULER_WORDS[seg.id].find((t) => width(t, CHART_FONT.small) + 12 <= seg.x1 - seg.x0) ?? null;
  const scale = scaleBar(v.zoom);
  const depthAt = (sx) => (VEIL_X - toChart(v, sx, 0, w, h)[0]) / LEAGUE_PX;
  const rowY = veilhaven().py + 0.5, rowAt = (sy) => (toChart(v, 0, sy, w, h)[1] - rowY) / LEAGUE_PX;
  const grid = {
    xs: ticks(depthAt(0), depthAt(w), scale.leagues).filter((d) => d > 0).map((d) => toScreen(v, VEIL_X - d * LEAGUE_PX, 0, w, h)[0]).filter((x) => x >= bx0),
    ys: ticks(rowAt(0), rowAt(h), scale.leagues).map((n) => toScreen(v, 0, rowY + n * LEAGUE_PX, w, h)[1]).filter((y) => y >= by0 && y <= by1),
  };
  const shipAt = { px: word.px + 0.5, py: word.py + 0.5 };
  const [sx, sy] = toScreen(v, shipAt.px, shipAt.py, w, h);
  const shipOn = on(sx, sy);
  const ship = { x: sx, y: sy, yaw: word.yaw ?? 0, on: shipOn, edge: shipOn ? null : edgePointer(sx, sy, w, h), way: shipOn ? '' : wayWords({ px: v.cx, py: v.cy }, shipAt), label: /** @type {{ x: number, y: number, words: string, box: number[] } | null} */ (null) };
  const haunts = [];
  for (const l of word.legends ?? []) {
    const legend = legendById(l.id);
    if (!legend) continue;
    const lair = hauntOf(legend);
    const [x, y] = toScreen(v, lair.px + 0.5, lair.py + 0.5, w, h);
    const r = HAUNT_PX * k;
    if (on(x, y, r)) haunts.push({ x, y, r, name: l.name, sails: !!l.sails, sub: l.sails ? (l.trait === 'night' ? t('sea.chart.hauntNight', 'Territory by night') : t('sea.chart.haunt', 'Territory')) : t('sea.chart.hauntSunk', 'Sunk. It will rise again'), inside: false, at: /** @type {number[]|null} */ (null), box: /** @type {number[]|null} */ (null) });
  }
  // AUDIT CAPTAIN'S SEA X14: the names placed greedily - ports first, then by the chart's own order - and one that would
  // stand over a name already lettered on both its sides left unlettered (a pointer or a tap still names it).
  // ETHER-CHART2: IN LAYERS - the ports' names, then the haunts', then the lesser isles' (which never stand over a
  // haunt's). Of the sides left, a name takes the first on the canvas and clear of the ship's ring and every other isle's
  // mark - a port of the ports' marks alone, so a lesser isle never moves a port's name (and so never which ports are
  // lettered) - else the first.
  const placed = [];
  const ring = shipOn ? [[sx - 16, sy - 16, sx + 16, sy + 16]] : [];
  const mark = (o) => [o.x - o.icon - 1, o.y - o.icon - 1, o.x + o.icon + 1, o.y + o.icon + 1];
  // AUDIT ETHER-CHART2 C10: each mark's box once, and a port's name weighed against the ports' alone (it scanned them all)
  const marks = isles.map((o) => ({ o, box: mark(o) })), portMarks = marks.filter((k) => k.o.kind === 'port');
  const onChart = (box) => box[0] >= 0 && box[2] <= w;
  const letter = (i) => {
    if (!i.label) return;
    const port = i.kind === 'port';
    const sides = labelBoxes(i, width(capFirst(i.name)));
    const free = sides.filter((box) => !placed.some((p) => overlaps(box, p)));
    if (!free.length) { i.label = false; return; }
    // AUDIT ETHER-CHART2 C7: where no side is clear of everything, the one on the chart before one cut by its edge
    i.box = free.find((box) => onChart(box) && !ring.some((p) => overlaps(box, p)) && !(port ? portMarks : marks).some((k) => k.o !== i && overlaps(box, k.box))) ?? free.find(onChart) ?? free[0];
    placed.push(i.box);
  };
  // ...a haunt's name and state on a plate in a corner of her square's part in view clear of every name - of those, the
  // one over the fewest isles' marks (AUDIT ETHER-CHART2 U6: a plate hid a ruin). Where that part is smaller than the
  // plate, or no corner of it is clear (AUDIT ETHER-CHART2 T1: the plate went to the first corner over a port's name), her
  // name alone over the square, given way where a name stands (a plate wider than her haunt hid the isles round it); her
  // square stands either way
  const marksUnder = (b) => isles.filter((o) => overlaps(b, mark(o))).length;
  const nameHaunt = (t) => {
    const tw = width(t.name), pw = Math.max(tw, width(t.sub, CHART_FONT.small)) + 12;
    const vx0 = Math.max(t.x - t.r, 0), vy0 = Math.max(t.y - t.r, 0), vx1 = Math.min(t.x + t.r, w), vy1 = Math.min(t.y + t.r, h);
    const taken = (b) => placed.some((p) => overlaps(b, p));
    if (vx1 - vx0 >= pw + 16 && vy1 - vy0 >= 50) {
      const corners = [[vx0 + 4, vy0 + 4], [vx1 - 4 - pw, vy0 + 4], [vx0 + 4, vy1 - 38], [vx1 - 4 - pw, vy1 - 38]].map(([x0, y0]) => [x0, y0, x0 + pw, y0 + 34]);
      const clear = corners.filter((b) => !taken(b));
      if (clear.length) {
        t.box = clear.reduce((best, b) => (marksUnder(b) < marksUnder(best) ? b : best));
        t.inside = true; t.at = [t.box[0] + 6, t.box[1] + 4];
      }
    }
    if (!t.box) {
      const cx = Math.max(tw / 2 + 6, Math.min(w - tw / 2 - 6, t.x)), cy = Math.max(CHART_MARGIN + LABEL_H / 2, t.y - t.r - 10);
      const box = [cx - tw / 2 - 3, cy - LABEL_H / 2, cx + tw / 2 + 3, cy + LABEL_H / 2];
      // AUDIT ETHER-CHART2 C8: over her own square - never below it nor beside it (held to the canvas, a square running
      // off its top or side set her name in open water, or in another legend's square)
      const hers = box[3] <= t.y + t.r && box[0] < t.x + t.r && t.x - t.r < box[2];
      if (hers && !taken(box)) { t.box = box; t.at = [cx, cy]; }
    }
    if (t.box) placed.push(t.box);
  };
  const ports = isles.filter((i) => i.kind === 'port'), lesser = isles.filter((i) => i.kind !== 'port');
  for (const i of ports) letter(i);
  for (const t of haunts) nameHaunt(t);
  // AUDIT ETHER-CHART2 U7: the ship's pointer's words - inward from it, else above or below, else further in - clear of
  // the names lettered, or over the fewest where every spot stands on one; laid after the ports' and the haunts' names and
  // before the lesser isles' (AUDIT ETHER-CHART2 C4: its plate, painted after them, covered one in six of the views where
  // she was off the chart)
  if (ship.edge) {
    const e = ship.edge, words = t('sea.chart.shipWay', 'Your ship - {way}', { way: ship.way }), tw = width(words, CHART_FONT.small);
    const at = (lx, ly) => { const x = Math.max(CHART_MARGIN, Math.min(w - tw - CHART_MARGIN, lx)), y = Math.max(CHART_MARGIN + 9, Math.min(h - CHART_MARGIN - 9, ly)); return { x, y, words, box: [x - 6, y - 9, x + tw + 6, y + 9] }; };
    const ix = e.x - Math.cos(e.a) * 28 - tw / 2, iy = e.y - Math.sin(e.a) * 28;
    const ox = -Math.cos(e.a) * 40, oy = -Math.sin(e.a) * 40;
    const spots = [at(ix, iy), at(ix, iy - 24), at(ix, iy + 24), at(ix + ox, iy + oy), at(ix + ox, iy + oy - 24), at(ix + ox, iy + oy + 24)];
    const crossed = (sp) => placed.filter((p) => overlaps(sp.box, p)).length;
    ship.label = spots.reduce((best, sp) => (crossed(sp) < crossed(best) ? sp : best));   // the first clear, else the one over the fewest
    placed.push(ship.label.box, [e.x - 16, e.y - 16, e.x + 16, e.y + 16]);   // C4: the lesser isles' names keep off it and its arrow
  }
  for (const i of lesser) letter(i);
  // AUDIT ETHER-CHART2 U9: the named isle's card - above it to the east, then the west, then below - clear of the isle,
  // the ship and the names lettered where it can be
  const named = pick ? isles.find((i) => i.key === pick) : null;
  const isle = named ? isleByKey(named.key) : null;
  let card = null;
  if (named && isle) {
    const kind = capFirst(KIND_WORDS[named.kind] ?? t('sea.chart.anIsle', 'an isle')), way = wayWords(shipAt, isle);
    // ISLE-TRADE (2026-10-17): a port isle's card names the good of the Bay its exchange makes (tradeGoods.js isleGood, off
    // the key scenes/world.js etherPortOf gives its port - `"px,py"`), so a captain plans the Veil's own trade on the chart
    const made = named.kind === 'port' ? goodById(isleGood({ key: `${isle.px},${isle.py}` })) : null;
    const title = capFirst(named.name), words = made ? t('sea.chart.cardPortLine', '{kind} - makes {good} - {way}', { kind, good: made.name.toLowerCase(), way }) : t('sea.chart.cardLine', '{kind} - {way}', { kind, way });
    const cw = Math.max(width(title), width(words, CHART_FONT.small)) + 16, ch = 36;
    const box = (x, y) => { const x0 = Math.max(4, Math.min(w - cw - 4, x)), y0 = Math.max(4, Math.min(h - ch - 4, y)); return [x0, y0, x0 + cw, y0 + ch]; };
    const o = named.r + 10;
    const spots = [box(named.x + o, named.y - o - ch), box(named.x - o - cw, named.y - o - ch), box(named.x + o, named.y + o), box(named.x - o - cw, named.y + o)];
    const self = [named.x - named.r - 6, named.y - named.r - 6, named.x + named.r + 6, named.y + named.r + 6];
    const fits = spots.filter((b) => !overlaps(b, self));
    card = { key: named.key, x: named.x, y: named.y, r: named.r, title, words, box: fits.find((b) => ![...placed, ...ring].some((p) => overlaps(b, p))) ?? fits[0] ?? spots[0] };
  }
  const st = word.stats ?? {};
  // ETHER-WILD: VEILHAVEN'S PEACE - the circle no player fights in (systems/wild/etherWild.js etherInPeace, the Veil's own
  // water drawn already), while the word says the open sea is an open PvP zone; named on the chart once it is wide enough
  const haven = veilhaven();
  const [hx, hy] = toScreen(v, haven.px + 0.5, haven.py + 0.5, w, h);
  const [px1] = toScreen(v, VEIL_X + 0.5, 0, w, h);   // AUDIT SEA VENTURES C2: and the way home east of her, to the Veil
  const peace = word.pvp && on((hx + px1) / 2, hy, (px1 - hx) / 2 + ETHER_PEACE_PX * k) ? { x: hx, y: hy, r: ETHER_PEACE_PX * k, vx: px1, named: ETHER_PEACE_PX * k >= PEACE_NAME_R } : null;
  // SEA-VAULTS: THE DAY'S VAULTS OF THE DEEP - marked for every captain whether the isle is charted or not (the mountains'
  // halls' law), each with its crows and my padlock as the word says; the paper's view for the mountains' painters
  const vaults = (word.vaults ?? []).map((t) => { const [x, y] = toScreen(v, t.x + 0.5, t.y + 0.5, w, h); return { ...t, sx: x, sy: y, icon: ICON_PX[v.zoom], named: v.zoom >= VAULT_NAME_ZOOM }; }).filter((t) => on(t.sx, t.sy, 24));
  const paperView = { ox: v.cx - w / (2 * k), oy: v.cy - h / (2 * k), scale: k };
  // SEA-EVENTS: THE AETHER STORM blowing - its reach about its eye, named once wide enough - and THE TREASURE FLEET under
  // way - its place and heading, its route from its muster to where it makes for, its name - as the word says
  const sw = word.storm ? toScreen(v, word.storm.x, word.storm.y, w, h) : null;
  const storm = sw && on(sw[0], sw[1], word.storm.r * k) ? { x: sw[0], y: sw[1], r: word.storm.r * k, named: word.storm.r * k >= STORM_NAME_R } : null;
  const fw = word.fleet ? toScreen(v, word.fleet.x, word.fleet.y, w, h) : null;
  const fleet = fw ? { x: fw[0], y: fw[1], yaw: word.fleet.yaw, sunk: !!word.fleet.sunk, name: fleetName(word.fleet.name, word.fleet.sunk), from: toScreen(v, word.fleet.from.x, word.fleet.from.y, w, h), to: toScreen(v, word.fleet.to.x, word.fleet.to.y, w, h), on: on(fw[0], fw[1], 24) } : null;
  return {
    isles, bands, veil: veil <= w ? veil : null, ruler, ship, haunts, depths, edge: [bx0, by0, bx1, by1], grid, scale, peace, vaults, paperView, storm, fleet,
    pick: card,
    title: chartTitle(),   // the haunts' `r` the square's half side (X13)
    sub: st.legends
      ? t('sea.chart.statsLegends', '{charted, plural, one {# isle} other {# isles}} charted · deepest {deepest} leagues past the Veil · {crossings, plural, one {# crossing} other {# crossings}} · {legends, plural, one {# legend} other {# legends}} ended', { charted: st.charted ?? 0, deepest: st.deepest ?? 0, crossings: st.crossings ?? 0, legends: st.legends })
      : t('sea.chart.stats', '{charted, plural, one {# isle} other {# isles}} charted - deepest {deepest} leagues past the Veil - {crossings, plural, one {# crossing} other {# crossings}}', { charted: st.charted ?? 0, deepest: st.deepest ?? 0, crossings: st.crossings ?? 0 }),
  };
}

// ── the painter ──────────────────────────────────────────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const INK = '#050608';
/** A colour of the chart's at an alpha. @param {string} hex @param {number} a */
const tint = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
/** FONT3's tracking on a context (Chromium's `letterSpacing`; a context without it letters untracked). */
const track = (g, px) => { /** @type {any} */ (g).letterSpacing = px; };
/** Diagonal lines across a box, clipped to it. */
function hatch(g, x0, y0, x1, y1, colour, gap) {
  g.save();
  g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  g.strokeStyle = colour; g.lineWidth = 1; g.beginPath();
  for (let d = x0 - (y1 - y0); d < x1; d += gap) { g.moveTo(d, y1); g.lineTo(d + (y1 - y0), y0); }
  g.stroke();
  g.restore();
}
/** Words under a hard halo - the HUD's one-step shadow law, never a blur. */
function halo(g, text, x, y, fill, align = 'left') {
  g.textAlign = /** @type {CanvasTextAlign} */ (align);
  g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(5,6,8,0.92)';
  g.strokeText(text, Math.round(x), Math.round(y));
  g.fillStyle = fill; g.fillText(text, Math.round(x), Math.round(y));
}
/** A plate under words: the naval sheet's ground with a hairline edge. */
function plate(g, x0, y0, x1, y1, edge = 'rgba(160,190,225,0.28)') {
  g.fillStyle = 'rgba(5,8,14,0.78)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = edge; g.lineWidth = 1; g.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0) - 1, Math.round(y1 - y0) - 1);
}
/** AN ISLE'S MARK, a shape for each kind: a port round (its harbour's dot in it), a ruin a diamond, a wild isle a peak,
 *  a rock a cross - each in its kind's colour, outlined in ink. `s` its half side. */
export function paintMark(g, kind, x, y, s) {
  g.lineJoin = 'miter';
  if (kind === 'rock') {
    g.lineCap = 'square';
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s);
    g.strokeStyle = INK; g.lineWidth = s * 0.8 + 3; g.stroke();
    g.strokeStyle = KIND_COLOURS.rock; g.lineWidth = s * 0.8; g.stroke();
    g.lineCap = 'butt';
    return;
  }
  g.beginPath();
  if (kind === 'port') g.arc(x, y, s, 0, TAU);
  else if (kind === 'ruin') { const d = s * 1.3; g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath(); }
  else { g.moveTo(x, y - s * 1.3); g.lineTo(x + s * 1.25, y + s); g.lineTo(x - s * 1.25, y + s); g.closePath(); }
  g.fillStyle = KIND_COLOURS[kind] ?? KIND_COLOURS.rock; g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
  if (kind === 'port' && s >= 3.5) { g.beginPath(); g.arc(x, y, s * 0.36, 0, TAU); g.fillStyle = INK; g.fill(); }
}
/** THE SHIP: an arrowhead on her heading (bow up at yaw 0) in a brass ring - bone, apart from every isle's colour. */
function paintShip(g, x, y, yaw, k = 1) {
  g.beginPath(); g.arc(x, y, 14 * k, 0, TAU);
  g.fillStyle = 'rgba(5,8,14,0.55)'; g.fill();
  g.lineWidth = 4 * k; g.strokeStyle = 'rgba(5,6,8,0.75)'; g.stroke();
  g.lineWidth = 2 * k; g.strokeStyle = '#f3cf86'; g.stroke();
  g.save(); g.translate(x, y); g.rotate(yaw); g.scale(k, k);
  g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 3.5); g.lineTo(-7, 8); g.closePath();
  g.fillStyle = '#f8f1de'; g.fill(); g.lineWidth = 1.5; g.lineJoin = 'miter'; g.strokeStyle = INK; g.stroke();
  g.restore();
}
/** A haunt's square: washed red while she sails; hatched and dashed grey while she lies sunk. */
function paintHaunt(g, t) {
  g.fillStyle = t.sails ? 'rgba(224,83,63,0.16)' : 'rgba(150,150,175,0.06)';
  g.fillRect(t.x - t.r, t.y - t.r, 2 * t.r, 2 * t.r);
  if (!t.sails) hatch(g, t.x - t.r, t.y - t.r, t.x + t.r, t.y + t.r, 'rgba(170,170,190,0.14)', 8);
  g.setLineDash(t.sails ? [] : [5, 4]); g.lineWidth = 2;
  g.strokeStyle = t.sails ? 'rgba(232,96,74,0.9)' : 'rgba(175,175,195,0.6)';
  g.strokeRect(t.x - t.r, t.y - t.r, 2 * t.r, 2 * t.r);   // AUDIT CAPTAIN'S SEA X13: a haunt is a square
  g.setLineDash([]); g.lineWidth = 1;
}
/** ETHER-WILD: VEILHAVEN'S PEACE - a safe harbour's wash and a dashed ring (a circle: the peace is read off Veilhaven
 *  whichever way a captain sails) - AUDIT SEA VENTURES C2: and, `vx` given, the way home east of her to the Veil, her own
 *  rows (systems/wild/etherWild.js etherInPeace): the ring's west half and the band to the Veil, one shape. */
export function paintPeace(g, p) {
  g.beginPath();
  if (Number.isFinite(p.vx) && p.vx > p.x) {
    g.moveTo(p.x, p.y - p.r); g.lineTo(p.vx, p.y - p.r); g.lineTo(p.vx, p.y + p.r); g.lineTo(p.x, p.y + p.r);
    g.arc(p.x, p.y, p.r, Math.PI / 2, Math.PI * 1.5); g.closePath();
  } else g.arc(p.x, p.y, p.r, 0, TAU);
  g.fillStyle = PEACE_FILL; g.fill();
  g.setLineDash([4, 3]); g.lineWidth = 1.5; g.strokeStyle = PEACE_LINE; g.stroke();
  g.setLineDash([]); g.lineWidth = 1;
}
/** SEA-VAULTS: A VAULT'S MARK - an arched door in the halls' oxblood over the ruin's diamond, bone-edged: the mountains'
 *  hall's door (ui/ink/inkMap.js HALL_INK), so a vault reads as one at a glance. `s` the isle mark's half side. */
export function paintVault(g, x, y, s) {
  const hw = s + 2, top = y - s - 4, base = y + s + 2;
  g.beginPath(); g.moveTo(x - hw, base); g.lineTo(x - hw, top + hw); g.arc(x, top + hw, hw, Math.PI, 0); g.lineTo(x + hw, base); g.closePath();
  g.fillStyle = HALL_INK; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = '#f0e2c4'; g.stroke(); g.lineWidth = 1;
  g.beginPath(); g.moveTo(x - hw * 0.45, base); g.lineTo(x - hw * 0.45, top + hw); g.arc(x, top + hw, hw * 0.45, Math.PI, 0); g.lineTo(x + hw * 0.45, base);
  g.strokeStyle = 'rgba(240,226,196,0.7)'; g.stroke();
}
/** SEA-EVENTS: THE AETHER STORM - the aether's violet wash, a dashed ring, and a bolt at its eye. */
export function paintStorm(g, st) {
  g.beginPath(); g.arc(st.x, st.y, st.r, 0, TAU);
  g.fillStyle = STORM_FILL; g.fill();
  g.setLineDash([6, 4]); g.lineWidth = 1.5; g.strokeStyle = STORM_LINE; g.stroke();
  g.setLineDash([]); g.lineWidth = 1;
  const b = Math.min(9, Math.max(4, st.r * 0.2));
  g.beginPath(); g.moveTo(st.x + b * 0.2, st.y - b); g.lineTo(st.x - b * 0.45, st.y + b * 0.1); g.lineTo(st.x + b * 0.1, st.y + b * 0.1); g.lineTo(st.x - b * 0.2, st.y + b);
  g.lineWidth = 2; g.strokeStyle = STORM_LINE; g.stroke(); g.lineWidth = 1;
}
/** SEA-EVENTS: THE TREASURE FLEET - its route a dashed gold line, its flagship a gold hull on her heading (bow up at yaw
 *  0) in a dark ring; scattered, the hull greyed and crossed. */
export function paintFleet(g, f) {
  g.setLineDash([4, 5]); g.lineWidth = 1.5; g.strokeStyle = f.sunk ? 'rgba(170,170,185,0.5)' : 'rgba(242,193,78,0.7)';
  g.beginPath(); g.moveTo(f.from[0], f.from[1]); g.lineTo(f.to[0], f.to[1]); g.stroke();
  g.setLineDash([]); g.lineWidth = 1;
  if (!f.on) return;
  g.beginPath(); g.arc(f.x, f.y, 10, 0, TAU); g.fillStyle = 'rgba(5,8,14,0.6)'; g.fill();
  g.save(); g.translate(f.x, f.y); g.rotate(f.yaw);
  g.beginPath(); g.moveTo(0, -8); g.lineTo(4.5, -1); g.lineTo(4.5, 7); g.lineTo(-4.5, 7); g.lineTo(-4.5, -1); g.closePath();
  g.fillStyle = f.sunk ? '#8c8c98' : FLEET_INK; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
  g.restore();
  if (f.sunk) { g.beginPath(); g.moveTo(f.x - 7, f.y - 7); g.lineTo(f.x + 7, f.y + 7); g.moveTo(f.x + 7, f.y - 7); g.lineTo(f.x - 7, f.y + 7); g.lineWidth = 2; g.strokeStyle = '#d06050'; g.stroke(); g.lineWidth = 1; }
}
/** A key's mark, on a canvas of its own, about its middle. */
export function paintKey(g, what, x, y) {
  if (what === 'vault') paintVault(g, x, y, 3);
  else if (what === 'storm') paintStorm(g, { x, y, r: 7 });
  else if (what === 'fleet') paintFleet(g, { x, y, yaw: Math.PI / 2, sunk: false, from: [x - 8, y], to: [x + 8, y], on: true });
  else if (what === 'peace') paintPeace(g, { x, y, r: 7 });
  else if (what === 'ship') paintShip(g, x, y, Math.PI / 4, 0.55);
  else if (what === 'haunt' || what === 'sunk') paintHaunt(g, { x, y, r: 6, sails: what === 'haunt' });
  else paintMark(g, what, x, y, what === 'port' ? 4.5 : 4);
}

/**
 * THE CHART DRAWN, back to front: the void past the world's edge, the depths and the grid, the Veil and the bands'
 * bounds, the world's edge, the haunts, the isles' lands, the bearing, their marks, the ship, the ring on the isle named -
 * then the words, after every mark: the haunts' plates and lone names, the isles' names under their halos, the ship's
 * pointer and its words, the named isle's card. The model lays every one of them clear of the others it can.
 * @param {CanvasRenderingContext2D} g @param {ReturnType<typeof chartModel>} m @param {number} w @param {number} h
 */
export function paintChart(g, m, w, h) {
  const [bx0, by0, , by1] = m.edge;
  const sea = [Math.max(0, bx0), Math.max(0, by0), w, Math.min(h, by1)];   // east of the box the Veil runs on
  if (sea[0] > 0 || sea[1] > 0 || sea[3] < h) { g.fillStyle = VOID_TONE; g.fillRect(0, 0, w, h); hatch(g, 0, 0, w, h, 'rgba(120,140,170,0.12)', 10); }
  g.save();
  g.beginPath(); g.rect(sea[0], sea[1], sea[2] - sea[0], sea[3] - sea[1]); g.clip();
  g.fillStyle = DEPTH_TONES.shallows; g.fillRect(0, 0, w, h);
  for (const d of m.depths) { g.fillStyle = DEPTH_TONES[d.id] ?? DEPTH_TONES.abyss; g.fillRect(d.x0, 0, d.x1 - d.x0, h); }
  g.strokeStyle = 'rgba(160,195,235,0.09)'; g.lineWidth = 1; g.beginPath();
  for (const x of m.grid.xs) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, h); }
  for (const y of m.grid.ys) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(w, Math.round(y) + 0.5); }
  g.stroke();
  if (m.veil != null) {
    const veil = g.createLinearGradient(m.veil, 0, Math.max(w, m.veil + 1), 0);
    veil.addColorStop(0, 'rgba(170,140,255,0.16)'); veil.addColorStop(1, 'rgba(205,185,255,0.42)');
    g.fillStyle = veil; g.fillRect(m.veil, 0, w - m.veil, h);
    g.strokeStyle = 'rgba(215,200,255,0.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.round(m.veil), 0); g.lineTo(Math.round(m.veil), h); g.stroke(); g.lineWidth = 1;
  }
  g.strokeStyle = 'rgba(170,205,240,0.4)'; g.setLineDash([6, 5]);
  for (const b of m.bands) if (b.line) { g.beginPath(); g.moveTo(Math.round(b.x) + 0.5, 0); g.lineTo(Math.round(b.x) + 0.5, h); g.stroke(); }
  g.setLineDash([]);
  g.restore();
  // AUDIT ETHER-CHART2 U3: the world's edge drawn where the sea's box meets it (the Abyss's water and the void were one black)
  if (sea[0] > 0 || sea[1] > 0 || sea[3] < h) {
    g.strokeStyle = EDGE_LINE; g.lineWidth = 1.5; g.beginPath();
    if (sea[0] > 0) { g.moveTo(sea[0], sea[1]); g.lineTo(sea[0], sea[3]); }
    if (sea[1] > 0) { g.moveTo(sea[0], sea[1]); g.lineTo(w, sea[1]); }
    if (sea[3] < h) { g.moveTo(sea[0], sea[3]); g.lineTo(w, sea[3]); }
    g.stroke(); g.lineWidth = 1;
  }
  if (m.peace) paintPeace(g, m.peace);   // ETHER-WILD: under the haunts and the isles - water, as the depths are
  if (m.storm) paintStorm(g, m.storm);   // SEA-EVENTS: the storm's water too
  for (const t of m.haunts) paintHaunt(g, t);
  // the isles' lands, once a land outgrows its mark - the isle's own size at the zoom
  for (const i of m.isles) {
    if (i.land < i.icon * 1.6) continue;
    const c = KIND_COLOURS[i.kind] ?? KIND_COLOURS.rock;
    g.beginPath(); g.arc(i.x, i.y, i.land, 0, TAU); g.fillStyle = tint(c, 0.16); g.fill(); g.strokeStyle = tint(c, 0.55); g.lineWidth = 1; g.stroke();
  }
  const s = m.ship, p = m.pick;
  if (p) { g.setLineDash([3, 4]); g.strokeStyle = 'rgba(243,207,134,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(p.x, p.y); g.stroke(); g.setLineDash([]); g.lineWidth = 1; }
  for (const i of m.isles) {
    paintMark(g, i.kind, i.x, i.y, i.icon);
    if (i.home) { g.beginPath(); g.arc(i.x, i.y, i.icon + 3.5, 0, TAU); g.lineWidth = 1.5; g.strokeStyle = KIND_COLOURS.port; g.stroke(); g.lineWidth = 1; }
  }
  for (const t of m.vaults ?? []) paintVault(g, t.sx, t.sy, t.icon);   // SEA-VAULTS: over the isles' marks, under every word
  if (m.vaults?.length) {
    paintWildLocks(g, m.paperView, m.vaults.filter((t) => t.locked), { paperW: w, paperH: h });
    paintWildCrows(g, m.paperView, m.vaults.filter((t) => t.crows), { paperW: w, paperH: h });
  }
  if (m.fleet) paintFleet(g, m.fleet);   // SEA-EVENTS: over the isles, under my ship
  if (s.on) paintShip(g, s.x, s.y, s.yaw);
  if (p) {
    g.beginPath(); g.arc(p.x, p.y, p.r + 5, 0, TAU);
    g.lineWidth = 4; g.strokeStyle = 'rgba(5,6,8,0.8)'; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#ffffff'; g.stroke(); g.lineWidth = 1;
  }
  // every word, last
  g.textBaseline = 'middle';
  track(g, CHART_TRACKING);
  for (const t of m.haunts) {
    if (!t.at || !t.box) continue;
    const [x, y] = t.at;
    if (!t.inside) { g.font = CHART_FONT.name; halo(g, t.name, x, y, t.sails ? '#ffab98' : '#c4c4d0', 'center'); continue; }
    plate(g, t.box[0], t.box[1], t.box[2], t.box[3], t.sails ? 'rgba(232,96,74,0.7)' : 'rgba(175,175,195,0.45)');
    g.textAlign = 'left';
    g.font = CHART_FONT.name; g.fillStyle = t.sails ? '#ffab98' : '#c4c4d0'; g.fillText(t.name, Math.round(x), Math.round(y + 6));
    g.font = CHART_FONT.small; g.fillStyle = t.sails ? '#e0a194' : '#9c9cab'; g.fillText(t.sub, Math.round(x), Math.round(y + 20));
  }
  g.font = CHART_FONT.small;
  for (const t of m.vaults ?? []) if (t.named) halo(g, capFirst(t.name), t.sx, t.sy + 16, '#f0b4a6', 'center');   // SEA-VAULTS: under its mark
  if (m.peace?.named) { g.font = CHART_FONT.small; halo(g, peaceName(), m.peace.x, m.peace.y - m.peace.r + 12, PEACE_LINE, 'center'); }
  if (m.storm?.named) { g.font = CHART_FONT.small; halo(g, stormName(), m.storm.x, m.storm.y - m.storm.r + 12, STORM_LINE, 'center'); }   // SEA-EVENTS: inside its ring's top
  if (m.fleet?.on) { g.font = CHART_FONT.small; halo(g, m.fleet.name, m.fleet.x, m.fleet.y + 20, m.fleet.sunk ? '#b8b8c4' : FLEET_INK, 'center'); }   // SEA-EVENTS: under its mark   // ETHER-WILD: inside its ring's top, clear of Veilhaven's own name at its middle
  g.font = CHART_FONT.name;
  for (const i of m.isles) if (i.label && i.box) halo(g, capFirst(i.name), i.box[0], (i.box[1] + i.box[3]) / 2, i.kind === 'port' ? '#f6e2b0' : '#e2dccf');
  if (!s.on && s.edge && s.label) {
    const e = s.edge, l = s.label;
    g.save(); g.translate(e.x, e.y); g.rotate(e.a);
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -9); g.lineTo(-2, 0); g.lineTo(-6, 9); g.closePath();
    g.fillStyle = '#f3cf86'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1;
    g.restore();
    plate(g, l.box[0], l.box[1], l.box[2], l.box[3], 'rgba(243,207,134,0.75)');
    g.font = CHART_FONT.small; g.textAlign = 'left'; g.fillStyle = '#f3cf86'; g.fillText(l.words, Math.round(l.x), Math.round(l.y));
  }
  if (p) {
    const [x0, y0, x1, y1] = p.box;
    plate(g, x0, y0, x1, y1, 'rgba(243,207,134,0.75)');
    g.textAlign = 'left';
    g.font = CHART_FONT.name; g.fillStyle = '#f6e2b0'; g.fillText(p.title, Math.round(x0 + 8), Math.round(y0 + 11));
    g.font = CHART_FONT.small; g.fillStyle = '#d8cfae'; g.fillText(p.words, Math.round(x0 + 8), Math.round(y0 + 26));
  }
  track(g, '0px');
}

/**
 * AUDIT ETHER-CHART2 U2: THE DEPTH RULER drawn - each water's own tone across its span (the Veil's violet, the world's
 * edge hatched), a bound between each two, the grid's ticks along its foot, the ship's caret where she is, and each
 * water's words centred in it. `w` its width, the chart's; RULER_H its height.
 * @param {CanvasRenderingContext2D} g @param {ReturnType<typeof chartModel>} m @param {number} w
 */
export function paintRuler(g, m, w) {
  const h = RULER_H;
  g.fillStyle = VOID_TONE; g.fillRect(0, 0, w, h);
  for (const seg of m.ruler) {
    if (seg.id === 'edge') { hatch(g, seg.x0, 0, seg.x1, h, 'rgba(120,140,170,0.25)', 6); continue; }
    if (seg.id === 'veil') {
      const veil = g.createLinearGradient(seg.x0, 0, Math.max(seg.x1, seg.x0 + 1), 0);
      veil.addColorStop(0, '#2b2f57'); veil.addColorStop(1, '#4b4f86');
      g.fillStyle = veil;
    } else g.fillStyle = tint(DEPTH_TONES[seg.id] ?? DEPTH_TONES.abyss, 1);
    g.fillRect(seg.x0, 0, seg.x1 - seg.x0, h);
  }
  g.strokeStyle = 'rgba(170,205,240,0.45)'; g.lineWidth = 1; g.beginPath();
  for (const seg of m.ruler) if (seg.x0 > 0) { g.moveTo(Math.round(seg.x0) + 0.5, 0); g.lineTo(Math.round(seg.x0) + 0.5, h); }
  for (const x of m.grid.xs) { g.moveTo(Math.round(x) + 0.5, h - 4); g.lineTo(Math.round(x) + 0.5, h); }
  g.stroke();
  g.strokeStyle = 'rgba(160,190,225,0.35)'; g.beginPath(); g.moveTo(0, h - 0.5); g.lineTo(w, h - 0.5); g.stroke();
  if (m.ship.on) {
    const x = Math.round(m.ship.x);
    g.beginPath(); g.moveTo(x, h - 1); g.lineTo(x + 5, h - 7); g.lineTo(x - 5, h - 7); g.closePath();
    g.fillStyle = '#f3cf86'; g.fill(); g.lineWidth = 1; g.strokeStyle = INK; g.stroke();
  }
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = CHART_FONT.small;
  track(g, CHART_TRACKING);
  for (const seg of m.ruler) if (seg.words) halo(g, seg.words, (seg.x0 + seg.x1) / 2, h / 2 - 1, seg.id === 'veil' ? '#ece4ff' : '#b8cee8', 'center');
  track(g, '0px');
}

/** AUDIT ETHER-CHART2 U4: THE SCALE BAR drawn, in the key - the bar its length in leagues at the chart's zoom, its ends
 *  ticked. @param {CanvasRenderingContext2D} g @param {{ px: number }} scale @param {number} h */
export function paintScale(g, scale, h) {
  g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'square';
  g.beginPath(); g.moveTo(1.5, 2); g.lineTo(1.5, h - 2); g.lineTo(scale.px + 1.5, h - 2); g.lineTo(scale.px + 1.5, 2); g.stroke();
  g.strokeStyle = '#d8cfae'; g.lineWidth = 2; g.stroke(); g.lineCap = 'butt'; g.lineWidth = 1;
}

/** AUDIT ETHER-CHART2 U1: THE CHART WINDOW'S SHEET - the window as tall as the screen allows and the chart in the room it
 *  leaves (a fixed 64vh put the key and the zoom under the fold on a phone held sideways), the ruler over it, the note
 *  one line (a name said on a narrow screen wrapped it to two, and the chart slid), the key and the tools, the hint set
 *  down where the height is short. ELTHERIC: on a narrow screen the title wraps - "A chart of the Eltheric Ocean" was
 *  cut on a phone held upright (tools/etherChartProbe.mjs); it never changes while the window stands, so nothing slides. */
export const ETHER_CHART_STYLE_ID = 'dfchart-style';
export const ETHER_CHART_CSS = `
.dfchart-win { width: min(96vw, 1100px); max-width: 96vw; height: min(92vh, 900px); }
.dfchart-win .dfnaval-winbody { flex: 1 1 auto; gap: 8px; }
.dfchart-note { min-height: 1.25em; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dfchart-chart { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; border-radius: 3px; overflow: hidden; box-shadow: 0 0 0 1px rgba(5,6,8,0.85); }
.dfchart-ruler { display: block; width: 100%; height: ${RULER_H}px; flex: 0 0 auto; }
.dfchart-stage { position: relative; flex: 1 1 auto; min-height: 120px; }
.dfchart-map { position: absolute; inset: 0; display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; background: ${DEPTH_TONES.reaches}; }
.dfchart-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 16px; flex: 0 0 auto; }
.dfchart-key { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; flex: 1 1 320px; font-size: 12px; color: #c9bfa4; }
.dfchart-key > span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.dfchart-tools { display: flex; gap: 8px; justify-content: flex-end; flex: 0 0 auto; }
.dfchart-over[hidden] { display: none; }
.dfchart-hint { flex: 0 0 auto; }
@media (max-width: 560px) {
  .dfchart-win .dfnaval-wintitle h2 { white-space: normal; text-overflow: clip; }
}
@media (max-height: 520px) {
  .dfchart-hint { display: none; }
  .dfchart-win .dfnaval-winhead { padding-top: 8px; padding-bottom: 8px; }
  .dfchart-key { font-size: 11px; gap: 2px 10px; }
}
`;
/** The sheet, once a document. */
export function injectEtherChartStyle(doc = document) {
  if (doc.getElementById?.(ETHER_CHART_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = ETHER_CHART_STYLE_ID;
  st.textContent = ETHER_CHART_CSS;
  (doc.head ?? doc.body).append(st);
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * THE WINDOW: `{ repaint, unmount }`.
 * @param {HTMLElement} host @param {{ word: () => any, onExit?: (reason?: string) => void, overworld?: () => boolean }} deps
 */
export function mountEtherChartWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectNavalWindowStyle();
  injectNavalKit(document);
  injectEtherChartStyle();
  const exit = (reason = 'close') => deps.onExit?.(reason);
  const shell = el('div', 'dfnaval-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', chartTitle());
  const win = el('div', 'dfnaval-win dfchart-win');
  shell.append(win);
  const head = el('header', 'dfnaval-winhead');
  const title = el('div', 'dfnaval-wintitle');
  const h2 = el('h2');
  const sub = el('p', 'dfnaval-winsub');
  const noteLine = el('p', 'dfnaval-note dfchart-note');   // ETHER-CHART2: its line kept - a name said grew the head and slid the chart under the pointer
  noteLine.setAttribute('aria-live', 'polite');
  title.append(h2, sub, noteLine);
  const close = /** @type {HTMLButtonElement} */ (el('button', 'dfnaval-btn dfnaval-close', t('sea.chart.close', 'Close')));
  close.type = 'button';
  close.style.minWidth = '0';
  close.style.flex = '0 0 auto';   // ETHER-CHART2: the sheet's narrow rule grows every button to a row; the title keeps its room
  close.addEventListener('click', () => exit('close'));
  head.append(title, close);
  // AUDIT ETHER-CHART2 U1/U2: the depth ruler over the chart, and the chart in the room the window leaves it
  const ruler = /** @type {HTMLCanvasElement} */ (el('canvas', 'dfchart-ruler'));
  ruler.setAttribute('aria-hidden', 'true');
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'dfchart-map'));
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('sea.chart.canvas', 'A chart of {sea}: your ship, the isles you have charted, the depths, the Veil and the legends\' haunts', { sea: ETHER_SEA_NAME }));
  const stage = el('div', 'dfchart-stage');
  stage.append(canvas);
  const chart = el('div', 'dfchart-chart');
  chart.append(ruler, stage);
  const hint = el('p', 'dfnaval-lede dfchart-hint', t('sea.chart.hint', 'Drag or use the arrow keys to pan. Scroll, pinch or press + and - to zoom. C finds your ship. Point at or tap an isle to see its name.'));
  // AUDIT CAPTAIN'S SEA X6: the window's own presses - a finger and a pad's cursor zoom and find the ship by them
  const tools = el('div', 'dfnaval-chart-tools dfchart-tools');
  const tool = (label, fn) => { const b = /** @type {HTMLButtonElement} */ (el('button', 'dfnaval-btn', label)); b.type = 'button'; b.style.minWidth = '0'; b.addEventListener('click', () => { fn(); draw(); }); tools.append(b); return b; };
  // ETHER-CHART2: the key - each mark drawn by the chart's own painter beside its word - and (AUDIT ETHER-CHART2 U4) the
  // scale bar, its length the chart's own at the zoom
  const key = el('div', 'dfnaval-chart-key dfchart-key');
  const dpr0 = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
  for (const [what, words] of CHART_KEY) {
    const item = el('span');
    const c = /** @type {HTMLCanvasElement} */ (el('canvas'));
    c.width = c.height = Math.round(18 * dpr0);
    c.style.cssText = 'width:18px;height:18px;flex:0 0 auto';
    c.setAttribute('aria-hidden', 'true');
    const kg = c.getContext('2d');
    if (kg) { kg.setTransform(dpr0, 0, 0, dpr0, 0, 0); paintKey(kg, what, 9, 9); }
    item.append(c, el('span', null, words));
    key.append(item);
  }
  // ETHER-WILD: Veilhaven's peace, in the key while the open sea is an open PvP zone (asked at every paint, as the door is)
  const peaceItem = el('span');
  { const c = /** @type {HTMLCanvasElement} */ (el('canvas')); c.width = c.height = Math.round(18 * dpr0); c.style.cssText = 'width:18px;height:18px;flex:0 0 auto'; c.setAttribute('aria-hidden', 'true');
    const kg = c.getContext('2d'); if (kg) { kg.setTransform(dpr0, 0, 0, dpr0, 0, 0); paintKey(kg, CHART_PEACE_KEY[0], 9, 9); }
    peaceItem.append(c, el('span', null, CHART_PEACE_KEY[1])); key.append(peaceItem); }
  // SEA-VAULTS: the day's vaults of the deep, in the key while the word carries any
  const vaultItem = el('span');
  { const c = /** @type {HTMLCanvasElement} */ (el('canvas')); c.width = c.height = Math.round(18 * dpr0); c.style.cssText = 'width:18px;height:18px;flex:0 0 auto'; c.setAttribute('aria-hidden', 'true');
    const kg = c.getContext('2d'); if (kg) { kg.setTransform(dpr0, 0, 0, dpr0, 0, 0); paintKey(kg, CHART_VAULT_KEY[0], 9, 10); }
    vaultItem.append(c, el('span', null, CHART_VAULT_KEY[1])); key.append(vaultItem); }
  // SEA-EVENTS: the storm blowing and the fleet under way, in the key while the word carries each
  const eventItem = (row) => {
    const item = el('span'), c = /** @type {HTMLCanvasElement} */ (el('canvas'));
    c.width = c.height = Math.round(18 * dpr0); c.style.cssText = 'width:18px;height:18px;flex:0 0 auto'; c.setAttribute('aria-hidden', 'true');
    const kg = c.getContext('2d'); if (kg) { kg.setTransform(dpr0, 0, 0, dpr0, 0, 0); paintKey(kg, row[0], 9, 9); }
    item.append(c, el('span', null, row[1])); key.append(item);
    return item;
  };
  const stormItem = eventItem(CHART_STORM_KEY), fleetItem = eventItem(CHART_FLEET_KEY);
  const scaleItem = el('span', 'dfchart-scale');
  const scaleBarCanvas = /** @type {HTMLCanvasElement} */ (el('canvas'));
  scaleBarCanvas.setAttribute('aria-hidden', 'true');
  const scaleWords = el('span');
  scaleItem.append(scaleBarCanvas, scaleWords);
  key.append(scaleItem);
  let scaleShown = '';
  const showScale = (sc) => {
    const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
    const at = `${sc.words}:${sc.px}:${dpr}`;   // every zoom's bar is near SCALE_MAX_PX long: its words tell them apart
    if (at === scaleShown) return;
    scaleShown = at;
    const cw = Math.ceil(sc.px) + 4, ch = 10;
    scaleBarCanvas.width = Math.round(cw * dpr); scaleBarCanvas.height = Math.round(ch * dpr);
    scaleBarCanvas.style.cssText = `width:${cw}px;height:${ch}px;flex:0 0 auto`;
    const sg = scaleBarCanvas.getContext('2d');
    if (sg) { sg.setTransform(dpr, 0, 0, dpr, 0, 0); sg.clearRect(0, 0, cw, ch); paintScale(sg, sc, ch); }
    scaleWords.textContent = sc.words;
  };
  const foot = el('div', 'dfnaval-chart-foot dfchart-foot');
  foot.append(key, tools);
  const body = el('div', 'dfnaval-winbody');
  body.append(chart, foot, hint);
  win.append(head, body);
  host.append(shell);

  let alive = true;
  let word = deps.word();
  /** @type {ChartView} */
  let view = clampChartView({ cx: word.px + 0.5, cy: word.py + 0.5, zoom: CHART_ZOOM_DEFAULT });
  let model = null;
  /** ETHER-CHART2: the isle named - by a pointer over it, or a tap - ringed, its bearing and its card drawn. @type {string|null} */
  let pick = null;
  const size = () => { const r = canvas.getBoundingClientRect(); return [Math.max(1, r.width), Math.max(1, r.height)]; };
  const zoomMid = (dir) => { const [w, h] = size(); view = chartZoomAt(view, dir, w / 2, h / 2, w, h); };
  const toShip = () => { view = clampChartView({ ...view, cx: word.px + 0.5, cy: word.py + 0.5 }); };
  tool('-', () => zoomMid(-1)); tool('+', () => zoomMid(1)); tool(t('sea.chart.ship', 'Ship'), toShip);
  const [zoomOut, zoomIn, shipBtn] = /** @type {HTMLButtonElement[]} */ ([...tools.children]);
  zoomOut.setAttribute('aria-label', t('sea.chart.zoomOut', 'Zoom out')); zoomIn.setAttribute('aria-label', t('sea.chart.zoomIn', 'Zoom in')); shipBtn.setAttribute('aria-label', t('sea.chart.findShip', 'Find your ship'));
  // ETHER-OW: THE DOOR UP - the held map's own (TV1), standing only where the host can lift the camera, asked again at
  // every paint (the open air, the enhanced lane, a body that lives - scenes/world.js travelViewAllowed)
  const overworldShown = () => typeof deps.overworld === 'function' && !!deps.overworld();
  const overBtn = /** @type {HTMLButtonElement} */ (el('button', 'dfnaval-btn dfchart-over', TRAVEL_VIEW_BUTTON));
  overBtn.type = 'button';
  overBtn.setAttribute('aria-label', t('sea.chart.rise', 'Rise to the Overworld'));
  overBtn.addEventListener('click', () => { if (overworldShown()) exit('overworld'); });
  tools.append(overBtn);
  for (const b of [zoomOut, zoomIn, shipBtn, overBtn]) { b.style.flex = '0 0 auto'; b.style.minWidth = '44px'; }
  const g = canvas.getContext('2d'), rg = ruler.getContext('2d');
  /** A name's width in a face, the canvas's own measure (FONT3's tracking on). */
  const measure = (t, font) => { if (!g) return t.length * LABEL_CHAR_PX; g.font = font; track(g, CHART_TRACKING); return g.measureText(t).width; };

  function draw() {
    if (!alive) return;
    showScale(scaleBar(view.zoom));   // AUDIT ETHER-CHART2 U11: the key's words first - their reflow moves the chart's room
    const [w, h] = size();
    const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    if (ruler.width !== Math.round(w * dpr) || ruler.height !== Math.round(RULER_H * dpr)) { ruler.width = Math.round(w * dpr); ruler.height = Math.round(RULER_H * dpr); }
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    model = chartModel(word, view, w, h, { measure, pick });
    peaceItem.hidden = !word.pvp;   // ETHER-WILD
    vaultItem.hidden = !word.vaults?.length;   // SEA-VAULTS
    stormItem.hidden = !word.storm; fleetItem.hidden = !word.fleet;   // SEA-EVENTS
    h2.textContent = model.title;
    sub.textContent = model.sub;
    zoomOut.disabled = view.zoom === 0;
    zoomIn.disabled = view.zoom === CHART_ZOOMS.length - 1;
    overBtn.hidden = !overworldShown();   // ETHER-OW
    paintChart(g, model, w, h);
    if (rg) { rg.setTransform(dpr, 0, 0, dpr, 0, 0); paintRuler(rg, model, w); }
  }
  /** What lies under a canvas point: the nearest isle drawn within its reach and a little. */
  function isleUnder(sx, sy) {
    let best = null, bd = Infinity;
    for (const i of model?.isles ?? []) { const d = Math.hypot(i.x - sx, i.y - sy); if (d <= i.r + 6 && d < bd) { bd = d; best = i; } }
    return best ? isleByKey(best.key) : null;
  }
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const note = (x, y) => {
    const isle = isleUnder(x, y);
    noteLine.textContent = isle ? isleWords(isle, { px: word.px + 0.5, py: word.py + 0.5 }) : '';
    const named = isle?.key ?? null;
    if (named !== pick) { pick = named; draw(); }
  };
  // AUDIT CAPTAIN'S SEA X6/X7: THE PRESSES BY POINTER - one pans (a finger, a pen, the mouse's first button alone), two
  // pinch the zoom about their middle, a press that never moved is a tap (an isle named); a drag ends however its press
  // ends - let go anywhere, the capture lost, the button no longer held (a right-click's menu ate its release, a pad's
  // cursor let go over another element, and the chart panned on with no button held)
  const downs = new Map();   // pointerId -> [x, y] now
  let drag = null, pinch = null;
  const endDrag = (e) => {
    if (e?.pointerId != null) downs.delete(e.pointerId);
    if (downs.size < 2) pinch = null;
    if (!downs.size) { drag = null; canvas.style.cursor = 'grab'; }
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downs.set(e.pointerId, local(e));
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grabbing';
    if (downs.size === 1) drag = { at: local(e), view, moved: false };
    else if (downs.size === 2) { const [a, b] = [...downs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 }; drag = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (drag && e.pointerType === 'mouse' && !(e.buttons & 1)) endDrag(e);
    if (downs.has(e.pointerId)) downs.set(e.pointerId, [x, y]);
    if (pinch && downs.size >= 2) {
      const [a, b] = [...downs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const step = d / pinch.d >= CHART_PINCH_STEP ? 1 : pinch.d / d >= CHART_PINCH_STEP ? -1 : 0;
      if (step) { const [w, h] = size(); view = chartZoomAt(view, step, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, w, h); pinch.d = d; draw(); }
      return;
    }
    if (drag) {
      if (Math.hypot(x - drag.at[0], y - drag.at[1]) > CHART_TAP_PX) drag.moved = true;
      if (!drag.moved) return;
      const k = CHART_ZOOMS[view.zoom];
      view = clampChartView({ zoom: drag.view.zoom, cx: drag.view.cx - (x - drag.at[0]) / k, cy: drag.view.cy - (y - drag.at[1]) / k });
      draw();
      return;
    }
    if (e.pointerType === 'mouse') note(x, y);
  });
  canvas.addEventListener('pointerup', (e) => { if (drag && !drag.moved && downs.size === 1) note(...local(e)); endDrag(e); });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // ETHER-CHART2: a mouse gone off the chart names nothing (a tap's naming stands until the next tap)
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !downs.size && pick) { pick = null; noteLine.textContent = ''; draw(); } });
  // AUDIT CAPTAIN'S SEA X18: the wheel's travel gathered, a step each CHART_WHEEL_STEP of it (a notch is one; a trackpad's brush
  // is many small events)
  let wheelAcc = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(wheelAcc) < CHART_WHEEL_STEP) return;
    const dir = -Math.sign(wheelAcc);
    wheelAcc = 0;
    const [x, y] = local(e); const [w, h] = size();
    view = chartZoomAt(view, dir, x, y, w, h); draw();
  }, { passive: false });
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // AUDIT CAPTAIN'S SEA X8: the key that opened it shuts it - the travel map's or the map's, by binding (heldMap.js
    // EM-BUG2's law); V opened it and did nothing, a rebound map key was ignored
    const acts = actionsForCode(bindings(), e.code);
    if (overlayAction(e) === 'back' || acts.includes('TravelMap') || acts.includes('AutoMap')) { e.preventDefault(); e.stopPropagation(); exit('close'); return; }
    if (e.code === 'KeyO' && overworldShown()) { e.preventDefault(); e.stopPropagation(); exit('overworld'); return; }   // ETHER-OW: the sheet's own key for the door (heldMap.js TV1)
    const [w, h] = size();
    const k = CHART_ZOOMS[view.zoom];
    const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
    if (pan) { view = clampChartView({ ...view, cx: view.cx + (pan[0] * PAN_STEP) / k, cy: view.cy + (pan[1] * PAN_STEP) / k }); }
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') view = chartZoomAt(view, 1, w / 2, h / 2, w, h);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') view = chartZoomAt(view, -1, w / 2, h / 2, w, h);
    else if (e.code === 'KeyC') toShip();
    else return;
    e.preventDefault(); e.stopPropagation();
    draw();
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.dfnaval-win', () => exit('close'));
  const onResize = () => draw();
  globalThis.addEventListener('resize', onResize);
  // AUDIT ETHER-CHART2 U11: and whenever the chart's room changes inside the window (the key's rows, the header's) - a
  // canvas whose box moved after it was painted is drawn stretched until it is painted again
  const RO = globalThis.ResizeObserver;
  const roomWatch = typeof RO === 'function' ? new RO(() => draw()) : null;
  roomWatch?.observe(stage);
  draw();
  // ETHER-CHART2: the words are lettered in the web face; the first paint may run before it lands, so the chart is
  // painted again when it does (heldMap.js's law for its ink). AUDIT ETHER-CHART2 U10: and whenever a face lands while
  // it is open - a window opened before the fonts' stylesheet came had no face to load and none pending, so `load` and
  // `ready` answered at once and the chart kept the fallback face until it was next touched
  const fonts = /** @type {FontFaceSet | undefined} */ (globalThis.document?.fonts);
  const landed = () => draw();
  try {
    fonts?.load?.(CHART_FONT.name)?.then?.(landed, () => {});
    fonts?.ready?.then?.(landed);
    fonts?.addEventListener?.('loadingdone', landed);
  } catch { /* no font set */ }
  close.focus?.({ preventScroll: true });
  return {
    // AUDIT ETHER-CHART2 C11: the note said again of the isle named, from where the ship is now - as the card is
    repaint: () => { word = deps.word(); const isle = pick ? isleByKey(pick) : null; noteLine.textContent = isle ? isleWords(isle, { px: word.px + 0.5, py: word.py + 0.5 }) : ''; draw(); },
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      globalThis.removeEventListener('resize', onResize);
      fonts?.removeEventListener?.('loadingdone', landed);
      roomWatch?.disconnect();
      offOutside();
      shell.remove();
    },
  };
}
