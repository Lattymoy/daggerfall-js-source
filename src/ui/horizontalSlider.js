// ROAD-G G6: THE HORIZONTAL SLIDER - HorizontalSlider.cs (MIT,
// Daggerfall Workshop; original author TheLacus) plus the ONE factory
// every settings window builds it through, DaggerfallUI.AddSlider
// (DaggerfallUI.cs:1106-1124).
//
// WHY IT HAS ITS OWN HOME. `ui/nativeTalk.js` already carried half of
// DrawSlider's thumb arithmetic for the topic list's horizontal bar,
// and the mouse-controls window needs the WHOLE component - four
// sliders in three of its four modes. Two copies of one C# class is
// exactly the drift the one-home ratchet exists to catch, so the law
// is here and nativeTalk's `topicSliderThumb` delegates to it.
//
// THE MODES (:18). ScrollBar is the bare bar nativeTalk uses;
// SetIndicator gives it one of the other three, and the mode is what
// GetValue and the indicator text read (:236-260, :346-364):
//   IntSlider        min/max/start as integers, indicator = the value
//   FloatSlider      min/max/start x10, ROUNDED, indicator = n1
//   MultipleChoices  0..items.length-1, indicator = items[selected]
//
// THE UNITS. AddSlider fixes DisplayUnits at 20 (:1111) and
// SetDisplayUnits derives `totalUnits = (max - min) + displayUnits`
// (:266-272), so the reachable ScrollIndex band is exactly [0, max-min]
// and a CLICK either side of the thumb pages by TWENTY units (:169-178)
// - two whole points of mouse sensitivity per click, which is DFU's
// feel and not a rounding of ours.
//
import { clampScrollIndex } from './verticalScrollBar.js';

// TWO PIECES OF DFU ART THE PORT HAS NO BYTES FOR, both recorded the
// way ui/travelPopUp.js records the same shape for its green checkbox:
//   - the thumb is three textures out of DFU's own Resources folder
//     (HSliderThumbLeft/Body/Right, :112-114), tinted; the port draws
//     the flat tint over the trough instead.
//   - that tint is `new Color(153, 153, 0)` (:1113) - Unity's FLOAT
//     constructor, which does not clamp, so the value that reaches the
//     shader saturates to (1,1,0). The thumb is YELLOW, and TINT below
//     is that saturation written out rather than the raw triple.

/** AddSlider (:1110-1111, :1118): the trough is 4 tall, DisplayUnits
 *  is 20, and the indicator sits 2 past the right edge. */
export const SLIDER_HEIGHT = 4;
export const SLIDER_DISPLAY_UNITS = 20;
export const SLIDER_INDICATOR_OFFSET = 2;
/** DrawSlider's floor (:315). */
export const THUMB_MIN_W = 10;
/** BackgroundColor (:1112) and the saturated TintColor (:1113). */
export const TROUGH_COLOR = Object.freeze([0.5, 0.5, 0.5, 0.3]);
export const TINT = Object.freeze([1, 1, 0, 1]);

// SetScrollIndex's clamp (:279-291) is ALREADY in the tree, and by
// DFU's own admission: HorizontalSlider.cs's header says "Reused code
// from VerticalScrollBar", and VerticalScrollBar.SetScrollIndex
// (:187-202) is the method it was reused from - same three lines, same
// order. ui/verticalScrollBar.js is its home; this is the horizontal
// class's name for it, not a second copy.
export { clampScrollIndex } from './verticalScrollBar.js';

/**
 * DrawSlider's thumb (:313-316), which MouseClick (:170-178) pages
 * against: a trough-wide thumb scaled by displayUnits/totalUnits with a
 * 10px floor, slid across the remaining travel. Null when there is
 * nothing to scroll - Draw returns before the thumb exists (:161-162).
 */
export function sliderThumb([tx, ty, tw, th], scrollIndex, totalUnits, displayUnits) {
  if (totalUnits <= displayUnits) return null;
  const thumbW = Math.max(THUMB_MIN_W, tw * (displayUnits / totalUnits));
  const thumbX = scrollIndex * (tw - thumbW) / (totalUnits - displayUnits);
  return [tx + thumbX, ty, thumbW, th];
}

/** Mathf.RoundToInt - banker's rounding on the .5 tie, which is NOT
 *  Math.round. SetIndicator(float) runs three values through it
 *  (:207-211) and SetValue one more (:246-250). */
export function roundToInt(v) {
  const f = Math.floor(v);
  const d = v - f;
  if (d !== 0.5) return Math.round(v);
  return f % 2 === 0 ? f : f + 1;
}

/**
 * A slider in one of SetIndicator's three modes.
 *
 * `float` is SetIndicator(float,float,float) (:203-212): the three
 * values are multiplied by ten and rounded, so the slider counts in
 * TENTHS and GetValue divides back (:236-240).
 */
export function makeSlider(spec) {
  const displayUnits = spec.displayUnits ?? SLIDER_DISPLAY_UNITS;
  let mode, min, max, start, items = null;
  if (spec.mode === 'float') {
    mode = 'float';
    min = roundToInt(spec.min * 10);
    max = roundToInt(spec.max * 10);
    start = roundToInt(spec.start * 10);
  } else if (spec.mode === 'choices') {
    mode = 'choices';
    items = spec.items;
    min = 0;
    max = items.length - 1;
    start = spec.selected;
  } else {
    mode = 'int';
    min = spec.min; max = spec.max; start = spec.start;
  }
  // SetupIndicator (:329-343): SetDisplayUnits derives totalUnits from
  // the range, then the start value is stored as an INDEX off min.
  const totalUnits = (max - min) + displayUnits;
  const s = {
    mode, min, max, items, displayUnits, totalUnits,
    scrollIndex: clampScrollIndex(start - min, totalUnits, displayUnits),
  };
  return s;
}

/** SetScrollIndex (:279-291). */
export function setScrollIndex(s, value) {
  s.scrollIndex = clampScrollIndex(value, s.totalUnits, s.displayUnits);
  return s.scrollIndex;
}

/** Value (:98-102) and GetValue (:236-240). */
export const sliderValue = (s) => s.scrollIndex + s.min;
export const sliderGetValue = (s) => (s.mode === 'float' ? sliderValue(s) / 10 : sliderValue(s));

/** GetIndicatorText (:346-364). The float arm is C#'s "n1" - one
 *  decimal place, which is what a 2.0 sensitivity must read as. */
export function indicatorText(s) {
  const selected = sliderValue(s);
  if (s.mode === 'int') return String(selected);
  if (s.mode === 'float') return (selected / 10).toFixed(1);
  return selected < s.items.length ? s.items[selected] : '';
}

/** MouseClick (:169-178): a click either side of the thumb pages by
 *  DisplayUnits. `localX` is measured from the trough's left edge. */
export function sliderClick(s, rect, localX) {
  const thumb = sliderThumb(rect, s.scrollIndex, s.totalUnits, s.displayUnits);
  if (!thumb) return s.scrollIndex;
  const [tx, , tw] = thumb;
  const x = localX + rect[0];
  if (x < tx) return setScrollIndex(s, s.scrollIndex - s.displayUnits);
  if (x > tx + tw) return setScrollIndex(s, s.scrollIndex + s.displayUnits);
  return s.scrollIndex;
}

/** Update's thumb drag (:130-153): the pointer's travel is divided by
 *  `Size.x / totalUnits` and TRUNCATED toward zero before it is added
 *  to the index the drag started on. */
export function sliderDrag(s, width, dragPixels, startIndex) {
  const scale = width / s.totalUnits;
  return setScrollIndex(s, startIndex + Math.trunc(dragPixels / scale));
}

/** MouseScrollUp/Down (:180-190): one unit a notch. */
export const sliderScroll = (s, dir) => setScrollIndex(s, s.scrollIndex + (dir < 0 ? -1 : 1));
