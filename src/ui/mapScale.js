// @ts-check
// FIELD BUGS 2026-10-09e - MAP-SCALE (bible/01-Overview/Field-Bugs-2026-10-09e.md; the Discord's "Desktop client
// in-game map icons and text too small on high resolutions": "playing this game on a monitor greater than 1080P will
// result in text and icons being way to small for the eye to comfortably see ... For the record I'm using a 2k monitor").
//
// The held map (ui/heldMap.js) fits its PAPER to the screen and inks every name, glyph and line on it in fixed paper
// pixels - 11 and 12 px names, a 6 px city - and its chrome (the search, the card, the key, the foot) in fixed CSS
// pixels. On a 1440p screen the paper is a third larger and every word on it the same size: the map reads as a 1080p
// one shrunk. THE MAP'S SCALE puts the interface back at the size it was drawn for: the sheet is inked on a paper of
// the screen's size OVER the scale and laid back up at full device resolution (the canvas's backing keeps every device
// pixel), and the chrome over it is zoomed by the same (one CSS `zoom`, enhancedStyle.js .hmroot's `--hm-ui`). So a
// 1440p map is the 1080p map, sharper - the same names at the same zoom, the same reach of the wheel.
//
// AUTO is the screen's height over 1080 CSS pixels (the viewport's own, so a desktop already scaled by its system
// stays as the system put it), never under 1 - a phone and a 1080p screen are as they were - nor over MAP_SCALE_MAX.
// The player's own choice (the Interface tab's Maps row, prefs `mapScale`) stands instead: MAP_SCALE_CHOICES.

/** The height the map's interface was drawn for, CSS pixels. */
export const MAP_SCALE_BASE_H = 1080;
export const MAP_SCALE_MIN = 0.75;
export const MAP_SCALE_MAX = 2;
/** The Maps row's steps, in order: auto, then the fixed scales. */
export const MAP_SCALE_CHOICES = Object.freeze(['auto', 0.75, 1, 1.25, 1.5, 1.75, 2]);

/** The held map's interface scale at a viewport `height` (CSS px) under the player's `pref` ('auto' or a number):
 *  auto the height over MAP_SCALE_BASE_H to the nearest twentieth, 1 to MAP_SCALE_MAX; a number its own, clamped. */
export function mapUiScale(height, pref = 'auto') {
  const n = typeof pref === 'number' ? pref : pref === 'auto' || pref == null ? NaN : Number(pref);
  if (Number.isFinite(n) && n > 0) return Math.max(MAP_SCALE_MIN, Math.min(MAP_SCALE_MAX, n));
  const h = Number(height);
  if (!Number.isFinite(h) || h <= MAP_SCALE_BASE_H) return 1;
  return Math.min(MAP_SCALE_MAX, Math.round((h / MAP_SCALE_BASE_H) * 20) / 20);
}

/** The Maps row's word for a choice, the scale auto resolves to beside it. */
export const mapScaleLabel = (pref, height) => (pref === 'auto' || pref == null
  ? `Auto (${mapUiScale(height).toFixed(2)}×)`
  : `${mapUiScale(height, pref).toFixed(2)}×`);

/** The next choice from `pref` by `dir` (+1, -1), held at the ends (a range, not a ring). */
export function nextMapScale(pref, dir) {
  const i = Math.max(0, MAP_SCALE_CHOICES.indexOf(MAP_SCALE_CHOICES.includes(pref) ? pref : 'auto'));
  return MAP_SCALE_CHOICES[Math.max(0, Math.min(MAP_SCALE_CHOICES.length - 1, i + Math.sign(dir)))];
}
