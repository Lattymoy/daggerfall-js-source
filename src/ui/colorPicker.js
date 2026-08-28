// CP1 - THE COLOR PICKER (ColorPicker.cs, MIT, Daggerfall Workshop;
// original author TheLacus). The last magic-crafting-row window, and
// its one DFU consumer is the ADVANCED SETTINGS screen's colour rows
// (DaggerfallAdvancedSettingsWindow.AddColorPicker) - which is the
// port's settings screen too: seven live-tier colour settings (the
// tooltip pair, the four automap building colours, the two micro-map
// colours) were drawn as read-only detail dialogs until this landed.
//
// THE SHAPE, verbatim: a 280x120 panel whose OWN BACKGROUND is the
// live picked colour (ConfirmColorPicked :203-206 - the panel IS the
// preview swatch), an S/V picture on the right (the (int) casts make
// it 186x90: (int)(280f/3*2), (int)(120f/4*3)) with a crosshair, a
// 360-hue slider under it (DisplayUnits 50, TotalUnits 50+360-1, so
// the scroll range is exactly 0..359), an 8-character hex box that
// parses THE MOMENT the eighth character lands (:277-285), RGBA and
// HSV readouts, and OK. OK fires OnColorPicked and closes; Escape is
// the popup's CancelWindow - nothing fires, the old colour stands.
//
// ALPHA RIDES THE HEX BOX ONLY - DFU's own quirk, kept: the S/V
// picture and the hue slider always produce alpha 1, so picking by
// eye DISCARDS a translucent setting's alpha (ToolTipBackgroundColor
// ships 404040D2) and only typing eight hex digits can keep it.
//
// RECORDED DEPARTURES:
// - the crosshair DRAG (:150-175) collapses to tap-to-place: the
//   settings host is single-shot (a drag is a scroll, never a tap -
//   launcherScene's own law), the same posture every ported scrollbar
//   drag already has. Trough clicks page the hue by DisplayUnits
//   toward the click and the wheel steps one, HorizontalSlider's own
//   MouseClick/MouseScroll laws, so every hue a drag reaches, a tap
//   reaches.
// - GetPixel's edge (:265-271): position y=0 flips to texture row
//   `height`, one past the last, where Unity's default Repeat wrap
//   silently reads row 0 (v=0, black); the port CLAMPS to the top
//   row instead of emulating the wrap. One row, picked deliberately:
//   tapping the very top of the picture should answer the brightest
//   value, not the darkest.
// - Slider_OnScroll samples at `crosshair.Position` - the crosshair
//   PANEL's top-left, half an art-sized offset from the point the
//   user picked (Update samples at the MOUSE and centres the panel
//   on it). The offset's size is the Resources "Crosshair" PNG's,
//   which the port does not carry, so the port samples at the picked
//   point itself and the quirk is recorded rather than reproduced.
// - the elastic page: DFU's panel is 280 wide on a fixed 320 native
//   page; the port's settings page can be narrower (settingsMetrics'
//   comfort law), so the panel clamps to the page and the preview
//   keeps DFU's own (int) proportions of the CLAMPED size.

// ---- Unity's HSV laws (Color.RGBToHSV / HSVToRGB) ----

export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, s, v];
}

export function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

// ---- the constants (:21-26), with C#'s (int) casts ----

export const NUMBER_OF_COLORS = 360;
export const COLOR_PICKER_PANEL_W = 280;
export const COLOR_PICKER_PANEL_H = 120;
export const COLOR_PREVIEW_W = Math.trunc(COLOR_PICKER_PANEL_W / 3 * 2);   // 186
export const COLOR_PREVIEW_H = Math.trunc(COLOR_PICKER_PANEL_H / 4 * 3);   // 90
export const HUE_SLIDER_DISPLAY_UNITS = 50;   // slider.DisplayUnits (:132)
/** TotalUnits = DisplayUnits + colors.Length - 1 (:133), so the max
 *  scroll index is TotalUnits - DisplayUnits = 359. */
export const HUE_SLIDER_TOTAL_UNITS = HUE_SLIDER_DISPLAY_UNITS + NUMBER_OF_COLORS - 1;
export const HUE_MAX_SCROLL = HUE_SLIDER_TOTAL_UNITS - HUE_SLIDER_DISPLAY_UNITS;

/** GetColors (:212-223): the 360 fully-saturated hues; the i==0
 *  ternary is DFU's own redundancy (0/360 is 0 either way). */
export function pickerColors() {
  const out = [];
  for (let i = 0; i < NUMBER_OF_COLORS; i++) {
    const h = i === 0 ? 0 : i / NUMBER_OF_COLORS;
    out.push(hsvToRgb(h, 1, 1));
  }
  return out;
}

/** GetColorPreview (:233-256) for a hue: the S/V field, rows stored
 *  BOTTOM-UP as Unity's SetPixels lays them (row 0 = v 0 = black at
 *  the texture's bottom). Answers a flat [r,g,b] row-major array. */
export function colorPreviewPixels(hue01) {
  const px = new Array(COLOR_PREVIEW_W * COLOR_PREVIEW_H);
  let index = 0;
  for (let i = 0; i < COLOR_PREVIEW_H; i++) {
    const v = i === 0 ? 0 : i / COLOR_PREVIEW_H;
    for (let j = 0; j < COLOR_PREVIEW_W; j++) {
      const s = j === 0 ? 0 : j / COLOR_PREVIEW_W;
      px[index++] = hsvToRgb(hue01, s, v);
    }
  }
  return px;
}

/** GetPixel (:265-271): panel-local (x, y) with y DOWN, rounded,
 *  flipped into the bottom-up store; the port clamps the one
 *  out-of-range edge Unity's Repeat wrap would send to black. */
export function samplePreview(pixels, x, y) {
  const posX = Math.min(COLOR_PREVIEW_W - 1, Math.max(0, Math.round(x)));
  const row = Math.min(COLOR_PREVIEW_H - 1, Math.max(0, COLOR_PREVIEW_H - Math.round(y)));
  return pixels[row * COLOR_PREVIEW_W + posX];
}

// ---- hex, in ColorUtility's RRGGBBAA dress ----

const to2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0').toUpperCase();
/** ColorUtility.ToHtmlStringRGBA, no leading '#'. */
export const toHexRGBA = ([r, g, b], a = 1) => `${to2(r)}${to2(g)}${to2(b)}${to2(a)}`;
/** TryParseHtmlString("#" + text) for the 8-digit form; null on a
 *  malformed string, which leaves the box text standing unparsed. */
export function parseHexRGBA(text) {
  if (!/^[0-9a-fA-F]{8}$/.test(text ?? '')) return null;
  const b = (i) => parseInt(text.slice(i, i + 2), 16) / 255;
  return { rgb: [b(0), b(2), b(4)], a: b(6) };
}

/** The window's geometry on the settings PAGE (the #region UI rects,
 *  :79-138): the panel centred (Center/Middle), the picture and the
 *  slider right-aligned inside it, hex at (5,30), readouts at (5,55)
 *  and (5,60), OK 39x22 centred in the left column at y 75, the
 *  slider 10 tall with a 5 gap under the picture. The panel clamps
 *  to an elastic page and the preview keeps DFU's (int) proportions
 *  of the clamped size - the recorded departure above. */
export function colorPickerLayout(P, H) {
  const pw = Math.min(COLOR_PICKER_PANEL_W, P - 8);
  const ph = COLOR_PICKER_PANEL_H;
  const px = Math.floor((P - pw) / 2), py = Math.floor((H - ph) / 2);
  const prevW = Math.trunc(pw / 3 * 2), prevH = Math.trunc(ph / 4 * 3);
  return {
    panel: [px, py, pw, ph],
    preview: [px + pw - prevW, py, prevW, prevH],
    slider: [px + pw - prevW, py + prevH + 5, prevW, 10],
    ok: [px + Math.round((pw - prevW) / 2 - 39 / 2), py + 75, 39, 22],
    hexAt: [px + 5, py + 30],
    rgbaAt: [px + 5, py + 55],
    hsvAt: [px + 5, py + 60],
  };
}

// ---- the window ----

export class ColorPickerWindow {
  /** hooks: { color: {rgb, a}?, onPicked(hex8), onClose() }.
   *  `color` is the sender swatch's colour (SetColor(sender
   *  .BackgroundColor), :140-143); absent falls to white. */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.colors = pickerColors();
    this.done = false;
    this.hexText = '';
    this.scrollIndex = 0;
    this.crosshair = [0, 0];      // preview-local, y down - the PICKED point
    this.alpha = 1;
    this.preview = null;          // the S/V pixel field
    this._previewDirty = true;    // the host re-uploads on change
    this.setColor(hooks.color?.rgb ?? [1, 1, 1], hooks.color?.a ?? 1);
  }

  /** SetColor (:181-194): hue to the slider, S/V to the crosshair,
   *  the picture regenerated from the colour's OWN (unquantized)
   *  hue, every readout refreshed, the panel confirmed. */
  setColor(rgb, a = 1) {
    const [h, s, v] = rgbToHsv(...rgb);
    this.scrollIndex = Math.min(HUE_MAX_SCROLL, Math.max(0, Math.round(NUMBER_OF_COLORS * h)));
    this.crosshair = [COLOR_PREVIEW_W * s, COLOR_PREVIEW_H * (1 - v)];   // SetCrosshairPosition (:196-201)
    this.preview = colorPreviewPixels(h);
    this._previewDirty = true;
    this.color = rgb;
    this.alpha = a;
    this.hexText = toHexRGBA(rgb, a);
  }

  /** the slider's shared clamp + Slider_OnScroll (:287-296): a new
   *  hue regenerates the picture and re-samples the picked point -
   *  alpha resets to 1, the picture knows none. */
  _setScroll(v) {
    this.scrollIndex = Math.min(HUE_MAX_SCROLL, Math.max(0, v));
    const hue = this.scrollIndex === 0 ? 0 : this.scrollIndex / NUMBER_OF_COLORS;
    this.preview = colorPreviewPixels(hue);
    this._previewDirty = true;
    this.color = samplePreview(this.preview, this.crosshair[0], this.crosshair[1]);
    this.alpha = 1;
    this.hexText = toHexRGBA(this.color, 1);
  }

  /** a tap in the PICTURE (Update's drag, collapsed): place the
   *  crosshair, sample, confirm. Preview-local coordinates. */
  pickAt(x, y) {
    this.crosshair = [x, y];
    this.color = samplePreview(this.preview, x, y);
    this.alpha = 1;
    this.hexText = toHexRGBA(this.color, 1);
  }

  /** a tap in the SLIDER: HorizontalSlider.MouseClick (:170-178) -
   *  page by DisplayUnits toward the click's side of the thumb.
   *  `frac` is the click's 0..1 position across the trough. */
  sliderClick(frac) {
    const t = this.thumb();
    if (frac < t.start) this._setScroll(this.scrollIndex - HUE_SLIDER_DISPLAY_UNITS);
    else if (frac > t.end) this._setScroll(this.scrollIndex + HUE_SLIDER_DISPLAY_UNITS);
  }

  /** MouseScrollUp/Down (:181-191): one unit a notch. */
  wheel(dir) { this._setScroll(this.scrollIndex + Math.sign(dir)); }

  /** the thumb's 0..1 span across the trough - DisplayUnits of
   *  TotalUnits wide, offset by the scroll fraction. */
  thumb() {
    const w = HUE_SLIDER_DISPLAY_UNITS / HUE_SLIDER_TOTAL_UNITS;
    const start = (this.scrollIndex / HUE_MAX_SCROLL) * (1 - w);
    return { start, end: start + w, w };
  }

  /** HexColor_OnType (:277-285): parse fires at EXACTLY eight
   *  characters; anything else just edits the text. */
  typeHex(ch) {
    if (ch === '\b') { this.hexText = this.hexText.slice(0, -1); return; }
    if (!/^[0-9a-fA-F]$/.test(ch) || this.hexText.length >= 8) return;
    this.hexText += ch.toUpperCase();
    if (this.hexText.length === 8) {
      const parsed = parseHexRGBA(this.hexText);
      if (parsed) this.setColor(parsed.rgb, parsed.a);
    }
  }

  /** OkButton (:298-305): the pick fires, the window closes. */
  ok() {
    this.done = true;
    this.hooks.onPicked?.(toHexRGBA(this.color, this.alpha));
    this.hooks.onClose?.();
  }

  /** CancelWindow: nothing fires; the old colour stands. */
  cancel() {
    this.done = true;
    this.hooks.onClose?.();
  }
}
