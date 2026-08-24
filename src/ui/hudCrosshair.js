// U38: HUDCrosshair + HUDInteractionModeIcon (MIT, Daggerfall
// Workshop) - the two HUD components the audit found missing outright.
//
// THE ART DEPARTURE, first, because it shapes everything below
// (Ledger A). Both components load DFU-AUTHORED PNGs out of Unity's
// Resources folder: "Crosshair", and four icon sets of four files each
// ("icon-steal", "classic-steal", "colour-steal", "mono-steal" ...).
// None of that is ARENA2 data - it is DFU's own artwork, outside the
// C# this project translates and absent from the sparse clone. So the
// port DRAWS both:
//   - the crosshair is a centred cross of the port's own geometry;
//   - the mode indicator is the mode's NAME in the HUD font, at DFU's
//     own position and in its own slot.
// Every LAW around them is DFU's, verbatim, because that is the half
// the source actually carries: where they sit, when they are hidden,
// and the xhair-suffix mode where the icon REPLACES the crosshair
// instead of sitting beside it.
//
// The laws, line for line:
// - the crosshair is Center/Middle on the screen (:29-30), and is NOT
//   DRAWN while the cursor is active (:62-66) - a window is up and the
//   player is pointing, not aiming. This is the one that matters: a
//   crosshair painted over an open inventory is the bug this suppress
//   exists to prevent.
// - the icon's position is
//   ((nativeBarWidth * Scale) * 5) + (borderSize * 2) from the left,
//   and screenHeight - borderSize - height from the top (:129) - it
//   sits just right of the three vitals bars, on their baseline. Both
//   constants are the port's EXISTING hud.js exports, so there is one
//   home for them rather than a second copy here.
// - resScale (:107) scales the icon DOWN at low resolutions:
//   `Scale.x > 3 ? 1 : 1 / Scale.x * 3`, applied as a DIVISOR. DFU's
//   own comment says "Scale down at low resolutions"; at scale 1 the
//   divisor is 3, so the icon is a third of its nominal size.
// - the STYLE setting (:143-181) picks the icon set and its scale,
//   and a name ENDING IN "xhair" means the icon is drawn AS the
//   crosshair (:189) rather than in the corner - in that mode Grab
//   restores the plain crosshair (:88-91) while the other three
//   replace it. The port keeps the branch and the scales; only the
//   pictures differ.
import { drawText, measureText } from './text.js';
import { getBool, getString } from '../systems/settings.js';
import { getInteractionMode } from '../player/interactionMode.js';

/** iconScale / minimalScale / classicScale / colourScale / monoScale
 *  (:24-44), keyed by the setting's own words. */
export const ICON_STYLE_SCALE = Object.freeze({
  icon: 0.8, minimal: 0.5, classic: 3, classicxhair: 3,
  colour: 1, colourxhair: 1, monochrome: 0.8,
});

/** LoadAssets' switch (:143-181): an unknown word falls to the default
 *  "icon" set, and only "minimal" changes its scale. */
export function iconStyleScale(setting) {
  const s = String(setting ?? '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ICON_STYLE_SCALE, s)) return ICON_STYLE_SCALE[s];
  return s === 'minimal' ? ICON_STYLE_SCALE.minimal : ICON_STYLE_SCALE.icon;
}

/** `crosshair = iconSetting.EndsWith("xhair")` (:189). */
export const iconReplacesCrosshair = (setting) =>
  String(setting ?? '').toLowerCase().endsWith('xhair');

/** The resolution scale-down (:107), a DIVISOR. The `>` is DFU's; at
 *  scale exactly 3 both arms answer 1 - (1/3)*3 rounds back to it -
 *  so `>` vs `>=` here is an equivalent mutant, recorded in the test
 *  rather than hunted again. */
export const iconResScale = (scale) => (scale > 3 ? 1 : (1 / scale) * 3);

/** Position (:129). Returns the icon's TOP-LEFT in screen pixels.
 *  `border` and `barWidth` are hud.js's own constants, PASSED rather
 *  than imported: hud.js calls this module, so importing back would
 *  make a cycle, and duplicating them here would make a second home
 *  for two numbers that already have one. */
export function modeIconPosition(canvasHeight, scale, iconH, border, barWidth) {
  return [
    barWidth * scale * 5 + border * 2,
    canvasHeight - border - iconH,
  ];
}

// ── the port's own crosshair shape (Ledger A) ───────────────────────
/** Native-pixel arm length and thickness of the drawn cross. */
export const CROSSHAIR_ARM = 4;
export const CROSSHAIR_THICK = 1;
export const CROSSHAIR_COLOR = Object.freeze([0.86, 0.82, 0.68, 0.85]);

export const crosshairEnabled = () => getBool('GUI', 'Crosshair');
export const interactionIconStyle = () => getString('GUI', 'InteractionModeIcon');

/** MODES -> the word the indicator shows. PlayerActivateModes' own
 *  names; the port's fourth mode is 'dialogue' where DFU says Talk. */
export const MODE_LABEL = Object.freeze({
  steal: 'STEAL', grab: 'GRAB', info: 'INFO', dialogue: 'TALK',
});

/**
 * Both components, drawn from ONE call the way DaggerfallHUD draws
 * them from one Update - the crosshair first, then the indicator,
 * because in xhair mode the second REPLACES the first.
 *
 * `cursorActive` is PlayerMouseLook.cursorActive: true whenever a
 * window is up and the pointer is free.
 */
export function drawCrosshairAndModeIcon(renderer, canvas, font,
  { cursorActive = false, scale = 1, border = 10, barWidth = 4 } = {}) {
  // Draw (:62-66) - the cursor's activity hides the crosshair
  // outright, before anything else is considered.
  if (cursorActive) return;
  const style = interactionIconStyle();
  const asCrosshair = iconReplacesCrosshair(style);
  const mode = getInteractionMode();

  if (crosshairEnabled()) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    if (asCrosshair && mode !== 'grab') {
      // the icon IS the crosshair (:76-91); Grab alone keeps the plain
      // one, which is why it is the mode you aim in.
      if (font) {
        const label = MODE_LABEL[mode] ?? '';
        const w = measureText(font.fnt, label) * scale;
        drawText(renderer, font, label, cx - w / 2, cy - 4 * scale, scale, CROSSHAIR_COLOR);
      }
    } else {
      const arm = CROSSHAIR_ARM * scale, th = CROSSHAIR_THICK * scale;
      const quad = (x, y, w, h) => renderer.drawScreenQuad(null, { x, y, w, h }, undefined, CROSSHAIR_COLOR);
      quad(cx - arm, cy - th / 2, arm * 2, th);
      quad(cx - th / 2, cy - arm, th, arm * 2);
    }
  }

  // The corner indicator only exists in the NON-xhair styles (:100).
  if (asCrosshair || !font) return;
  const label = MODE_LABEL[mode] ?? '';
  if (!label) return;
  const iconScale = Math.max(1, (iconStyleScale(style) / iconResScale(scale)) * scale);
  const w = measureText(font.fnt, label) * iconScale;
  const h = (font.fnt?.fixedHeight ?? 6) * iconScale;
  const [x, y] = modeIconPosition(canvas.height, scale, h, border, barWidth);
  // a plate behind the word, so it stays legible over any terrain -
  // the port's own, standing in for the icon's opaque pixels
  renderer.drawScreenQuad(null, { x: x - 2, y: y - 1, w: w + 4, h: h + 2 }, undefined, [0, 0, 0, 0.35]);
  drawText(renderer, font, label, x, y, iconScale, CROSSHAIR_COLOR);
}
