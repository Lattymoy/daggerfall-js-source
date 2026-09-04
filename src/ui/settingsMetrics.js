// MENU: the settings screen's OWN metric.
//
// This screen deliberately does NOT use nativePanel.nativeMetrics.
// That function floors to the largest integer scale that fits a whole
// 320x200 page (nativePanel.js:28-31), which on every phone in either
// orientation is s=1 - verified at 390x844, 844x390, 393x851, 375x667
// and 360x640. Since renderer.js:1067-1071 sets canvas.width from
// clientWidth with NO devicePixelRatio, s=1 means SEVEN CSS PIXELS of
// text: half of what the launcher's hardcoded s=2 already showed. A
// readability pass that halves the type on the device that needs it
// most is not a readability pass.
//
// A settings screen may do what an IMG-backed window may not: it is a
// scrolling list, so its PAGE can be elastic. Everything else in the
// port keeps nativeMetrics and its 320x200 law.
//
// The returned object is shape-compatible with nativePanel's drawRect
// / drawImg / shadowText, which read only { s, ox, oy }.
import { isTouchDevice } from './touch.js';

export const PAGE_W = 320;
export const MIN_PAGE_W = 156;
export const MIN_PAGE_H = 150;

const metric = (s, pageW, pageH, W, H, mode) => ({
  s, pageW, pageH, mode,
  ox: Math.floor((W - pageW * s) / 2),
  oy: Math.floor((H - pageH * s) / 2),
});

/** @param {{width:number,height:number}} canvas
 *  @param {{textScale?:number}} opts textScale 1 = the player's Large
 *         Text choice (accessibility), which buys a whole extra scale
 *         step rather than a fractional one - integer scales only, or
 *         classic art aliases. */
export function settingsMetrics(canvas, { textScale = 0 } = {}) {
  const W = canvas.width | 0;
  const H = canvas.height | 0;
  // 1. CLASSIC - the largest integer scale that fits a full page.
  //    Identical to nativeMetrics wherever that returns >= 2.
  let s = Math.floor(Math.min(W / PAGE_W, H / 200));
  if (textScale > 0) s += textScale;
  if (s >= 2 && W >= PAGE_W * s && H >= 200 * s) return metric(s, PAGE_W, 200, W, H, 'classic');
  // 2. COMFORT - hold the TYPE at s=2 and let the PAGE flex on both
  //    axes instead. This is the arm that saves the phone.
  s = 2 + (textScale > 0 ? 1 : 0);
  if (W >= MIN_PAGE_W * s && H >= MIN_PAGE_H * s) {
    const pageW = Math.max(MIN_PAGE_W, Math.min(PAGE_W, Math.floor(W / s)));
    const pageH = Math.max(MIN_PAGE_H, Math.floor(H / s));
    return metric(s, pageW, pageH, W, H, 'comfort');
  }
  // 3. DEGENERATE - a viewport under ~312x300 CSS px. s=1 and the page
  //    IS the viewport; nothing is off-screen even here.
  return metric(1, Math.max(MIN_PAGE_W, Math.min(PAGE_W, W)), Math.max(MIN_PAGE_H, H), W, H, 'tiny');
}

/** Screen point -> PAGE point, or null outside the page. Replaces
 *  pointToNative, which clamps against a fixed NATIVE_H of 200. */
export function pointToPage(m, px, py) {
  const x = (px - m.ox) / m.s;
  const y = (py - m.oy) / m.s;
  return x >= 0 && y >= 0 && x < m.pageW && y < m.pageH ? [x, y] : null;
}

/** The minimum interactive short axis IN PAGE UNITS. On a touch
 *  device that is 44 CSS px - the size a fingertip actually hits -
 *  converted through the live scale; on a pointer device 12 page
 *  units is comfortable and keeps the classic density. */
export const tapMin = (m) => (isTouchDevice() ? Math.ceil(44 / m.s) : 12);
