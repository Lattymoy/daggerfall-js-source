// CSA-I (2026-09-27) - COME SAIL AWAY'S POSITION READING: the map OnGUI draws while the boat's position box has it up
// (ComeSailAway.cs 4113-4170), its markers (5681-5780), the picture it is drawn on, and OnGUI's debug values (4177-4182).
//
// THE PICTURE is record 3 of the mod's archive (Start 1077: TryImportTexture(112395, 3, 0)), which is Daggerfall's
// own travel map - TRAV0I00.IMG's 320x160 interior from row 12 down (DFU's regionPanelOffset) scaled to 1000x500, one
// texel a map pixel. The port never carries it (bible/03-World/Come-Sail-Away.md "The bundle"): it is rebuilt here
// from the player's own file, nearest at the texel centres - the sampler the bundle's picture matches best (a mean
// |RGB| of 7.3 of 765 a pixel, the rest the bundle's DXT1 blocks; bilinear stands at 19.2). The bundle draws it with
// point filtering, as the host does.
//
// THE LINES AND THE MARKERS are `lineTexture` (Start 1078: TextureReader.GetTexture2D(0, 112, 0, 0) - TEXTURE.000's
// solid record 112, palette 112's 220,220,220) tinted each draw: GUI.DrawTexture multiplies the texture by the colour,
// so every red line, marker and backdrop is its colour times that grey (kept). The host draws the texture itself.
//
// Everything here is the arithmetic of the draw; the runtime (systems/comeSailAway/comeSailAway.js) owns the state it reads.

import { roundToInt } from '../mathf.js';   // Mathf.RoundToInt's one home
import { MAP_WIDTH, MAP_HEIGHT } from '../../formats/woodsFile.js';   // the world map's 1000x500: one texel a map pixel
import { REGION_PANEL_OFFSET } from '../../ui/travel/travelMapWindow.js';   // DaggerfallTravelMapWindow.regionPanelOffset's one home

const f = Math.fround;

/** TRAV0I00.IMG's interior: DFU's regionPanelOffset (12) down, 320x160 - stretched to the world map's 1000x500
 *  (`1000f * screenScaleX` by `500f * screenScaleY` is the rect OnGUI draws it over). */
export const TRAVEL_MAP_IMG = 'TRAV0I00.IMG';
export const TRAVEL_MAP_INTERIOR = Object.freeze([320, 160]);
/** lineTexture: TextureReader.GetTexture2D(0, 112, 0, 0) - archive, record, frame (alpha index 0). */
export const LINE_TEXTURE = Object.freeze({ archive: 0, record: 112, frame: 0 });

/** mapMarkerModeLabels (482) and mapMarkerModeColors (484-494): Unity's Color constants, as floats. */
export const MAP_MARKER_MODE_LABELS = Object.freeze(['Yellow', 'Green', 'Cyan', 'Blue', 'Magenta', 'Red', 'White', 'Gray']);
const rgba = (r, g, b, a = 1) => Object.freeze({ r: f(r), g: f(g), b: f(b), a: f(a) });
export const MAP_MARKER_MODE_COLORS = Object.freeze([
  rgba(1, 0.92156863, 0.015686275),   // Color.yellow
  rgba(0, 1, 0), rgba(0, 1, 1), rgba(0, 0, 1), rgba(1, 0, 1), rgba(1, 0, 0), rgba(1, 1, 1),
  rgba(0.5, 0.5, 0.5),   // Color.gray
]);
export const COLOR_BLACK = rgba(0, 0, 0);
export const COLOR_WHITE = rgba(1, 1, 1);
export const COLOR_RED = rgba(1, 0, 0);
export const COLOR_GREEN = rgba(0, 1, 0);
export const COLOR_BLUE = rgba(0, 0, 1);
/** DaggerfallUI.DaggerfallDefaultTextColor (DaggerfallUI.cs:52): Color32(243, 239, 44, 255). */
export const DAGGERFALL_DEFAULT_TEXT_COLOR = rgba(243 / 255, 239 / 255, 44 / 255);
/** DaggerfallUI.DaggerfallDefaultShadowPos (:81): Vector2.one. */
export const DAGGERFALL_DEFAULT_SHADOW_POS = Object.freeze([1, 1]);

/** The five help lines (4138-4142), each 20 pixels under the last from the screen's corner, and the colour line. */
export const MAP_HELP_LINES = Object.freeze([
  'Left-click to place a marker',
  'Right-click to remove a marker',
  'Press 1-8 to change the marker color',
  'Hold Left Shift for finer placement',
  'Press Esc to exit',
]);

/**
 * Record 3 rebuilt: TRAV0I00.IMG's interior sampled at each texel's centre, nearest. `bitmap` is the IMG's palette
 * indices ({ width, height, data }), `colorOf(index)` its palette's { r, g, b }. RGBA, rows top down as GUI draws.
 */
export function travelMapPicture(bitmap, colorOf, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const [iw, ih] = TRAVEL_MAP_INTERIOR;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(ih - 1, Math.round((y + 0.5) * ih / height - 0.5));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(iw - 1, Math.round((x + 0.5) * iw / width - 0.5));
      const c = colorOf(bitmap.data[(sy + REGION_PANEL_OFFSET) * bitmap.width + sx]);
      const i = (y * width + x) * 4;
      data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Unity's Rect.Contains(Vector2) over a GUI rect { x, y, w, h }: the min edges in, the max edges out. */
export const guiRectContains = (r, p) => p[0] >= r.x && p[0] < f(r.x + r.w) && p[1] >= r.y && p[1] < f(r.y + r.h);
/** Vector2Int.Distance: the float square root of the integer squares. */
export const vector2IntDistance = (a, b) => f(Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])));
/**
 * The map's rect (4122-4123, 5710-5712 and 5742-5744 alike): `screenRect.width * screenScaleX / 2` - the screen's
 * width scaled again before it is halved, so a scaled screen puts the map off centre (kept) - less half the map.
 * @param {{ x?: number, y?: number, width: number, height: number }} screenRect
 * @param {number[]} scale - [screenScaleX, screenScaleY]
 */
export function mapRect(screenRect, scale) {
  const [screenScaleX, screenScaleY] = scale;
  const num2 = f(1000 * screenScaleX);
  const num3 = f(500 * screenScaleY);
  return {
    x: f(f(f(screenRect.x ?? 0) + f(f(f(screenRect.width) * screenScaleX) / 2)) - f(num2 / 2)),
    y: f(f(f(screenRect.y ?? 0) + f(f(f(screenRect.height) * screenScaleY) / 2)) - f(num3 / 2)),
    w: num2, h: num3,
  };
}

/** The mouse in GUI space: `(mouse.x, screenRect.height - mouse.y)` - InputManager.MousePosition is bottom up. */
export const guiMouse = (screenRect, mouse) => [f(mouse[0]), f(f(screenRect.height) - f(mouse[1]))];
/** The map pixel under the mouse: `RoundToInt(mouse - rect)` on each axis - in screen pixels off the rect's corner,
 *  not the picture's (kept: a scaled map's markers stand at the screen's offset, and so do their labels). */
export const mapPixelUnder = (rect, gui) => [roundToInt(f(gui[0] - rect.x)), roundToInt(f(gui[1] - rect.y))];

/** DaggerfallDateTime.DayOfMonthWithSuffix (Day + 1 and its suffix) and MonthName, from { day, month } (zero based). */
export function dayOfMonthWithSuffix(day) {
  const d = day + 1;
  const s = d === 1 || d === 21 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
  return `${d}${s}`;
}
/** LeftClickOnMap's label: "(x, y) - 5th of Morning Star". */
export const markerLabel = (pos, dayWithSuffix, monthName) => `(${pos[0]}, ${pos[1]}) - ${dayWithSuffix} of ${monthName}`;

/**
 * Mono's Single.ToString() - the "G" format at a float's seven significant digits: fixed above 1E-05 and under 1E+07,
 * else "d.ddddddE+XX"; trailing zeros dropped. What OnGUI's debug values print.
 */
export function csFloatString(v) {
  v = f(v);
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'Infinity';
  if (v === -Infinity) return '-Infinity';
  if (v === 0) return '0';
  const sign = v < 0 ? '-' : '';
  const [m, e] = Math.abs(v).toExponential(6).split('e');
  const exp = Number(e);
  if (exp >= 7 || exp <= -5) {   // fixed only while -5 < exponent < 7 (the "G" rule)
    const mant = m.replace(/\.?0+$/, '');
    return `${sign}${mant}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  const fixed = Math.abs(v).toPrecision(7);
  return sign + (fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed);
}

/**
 * OnGUI's map (4113-4170), as the draws it makes in order: the backdrop over the whole screen (the setting's
 * opacity of black, blended), the picture stretched over its rect, the position's two red lines while a reading was
 * got and `Mathf.Sin(Time.unscaledTime * 5)` is above nought, the six lines of text, every marker (its black outline
 * first when the outline is thicker than nought), then the label of each marker within the click range of the mouse.
 * A quad names its texture ('line' or 'map') and draws it tinted; a text is DaggerfallFont.DrawText at scale 3, its
 * shadow first.
 *
 * `o` = { screenRect, screen: [Screen.width, Screen.height], scale: [x, y], mouse (GUI space), unscaledTime,
 *         showingPosition, pixel: [CurrentMapPixel.X, .Y], markers, markerMode, opacity, lineThickness,
 *         markerThickness, outlineThickness, markerThicknessRaw, clickRange }
 */
export function mapOverlayDraws(o) {
  const draws = [];
  const quad = (tex, x, y, w, h, color) => draws.push({ kind: 'quad', tex, rect: { x: f(x), y: f(y), w: f(w), h: f(h) }, color });
  const text = (str, pos, scale, color, shadowPos) => draws.push({ kind: 'text', text: str, x: f(pos[0]), y: f(pos[1]), scale, color, shadow: COLOR_BLACK, shadowPos });
  // the backdrop: `new Rect(0, 0, Screen.width, Screen.height)`, black at mapBackdropOpacity
  quad('line', 0, 0, o.screen[0], o.screen[1], { ...COLOR_BLACK, a: f(o.opacity) });
  const r = mapRect(o.screenRect, o.scale);
  const num2 = r.w, num3 = r.h;
  quad('map', r.x, r.y, r.w, r.h, COLOR_WHITE);
  const val4 = mapPixelUnder(r, o.mouse);
  if (o.showingPosition && f(Math.sin(f(f(o.unscaledTime) * 5))) > 0) {
    const t = o.lineThickness;
    quad('line', f(r.x + f(f(f(o.pixel[0]) * o.scale[0]) - t)), r.y, 1 + t * 2, num3, COLOR_RED);
    quad('line', r.x, f(f(r.y + f(f(o.pixel[1]) * o.scale[1])) - t), num2, 1 + t * 2, COLOR_RED);
  }
  const shadow3 = [DAGGERFALL_DEFAULT_SHADOW_POS[0] * 3, DAGGERFALL_DEFAULT_SHADOW_POS[1] * 3];
  MAP_HELP_LINES.forEach((line, i) => text(line, [0, 20 * i], 3, DAGGERFALL_DEFAULT_TEXT_COLOR, shadow3));
  text(`Current marker color is ${MAP_MARKER_MODE_LABELS[o.markerMode]}`, [0, f(o.screen[1] - 20)], 3, DAGGERFALL_DEFAULT_TEXT_COLOR, shadow3);
  for (const m of o.markers) {
    const t = o.markerThickness, ot = o.outlineThickness;
    const x = f(f(r.x + m.position[0]) - t), y = f(f(r.y - t) + m.position[1]), w = 1 + t * 2, h = 1 + t * 2;
    if (ot !== 0) quad('line', f(x - ot), f(y - ot), w + ot * 2, h + ot * 2, COLOR_BLACK);
    quad('line', x, y, w, h, m.color);
  }
  for (const m of o.markers) {
    // the label's rect takes mapMarkerThickness itself, not the Final one Left Shift zeroes (kept)
    const t = o.markerThicknessRaw;
    const x = f(f(r.x + m.position[0]) - t), y = f(f(r.y - t) + m.position[1]);
    if (vector2IntDistance(val4, m.position) <= o.clickRange) text(m.label, [f(x + 10), f(y - 20)], 3, DAGGERFALL_DEFAULT_TEXT_COLOR, shadow3);
  }
  return draws;
}
