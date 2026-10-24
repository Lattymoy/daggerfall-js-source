// PIXEL-KEYS (2026-10-12, a profile of a player's live client walking the overworld's coast: the sea's captains sound
// the water ahead of them - scenes/world.js navalIsWater, three points a step of every probe - and each sounding made
// its pixel's key text anew to ask the built pixels for it, `${x},${y}`: some 0.4 ms a frame and a string a call,
// for the few pixels a probe crosses). A PIXEL'S KEY, THE TEXT THE BUILT PIXELS ARE FILED UNDER, MADE ONCE: kept by
// the pixel's numbers, the same text every time it is asked. The map is 1000 by 500 pixels; anything past
// PIXEL_KEY_SPAN either way is made each time, as it was. Past PIXEL_KEYS_KEPT texts the keeping starts again.

/** A pixel coordinate kept within this of nought, either way (the map's own are 0-999 and 0-499). */
export const PIXEL_KEY_SPAN = 4096;
/** How many texts are kept before the keeping starts again (a session's walk crosses a few hundred pixels). */
export const PIXEL_KEYS_KEPT = 8192;

const _kept = new Map();

/**
 * The key a built pixel is filed under: `${px},${py}` - the same string each time for a pixel within PIXEL_KEY_SPAN.
 * @param {number} px @param {number} py
 * @returns {string}
 */
export function pixelKeyText(px, py) {
  if (!(Number.isInteger(px) && Number.isInteger(py) && Math.abs(px) < PIXEL_KEY_SPAN && Math.abs(py) < PIXEL_KEY_SPAN)) return `${px},${py}`;
  const n = (px + PIXEL_KEY_SPAN) * (2 * PIXEL_KEY_SPAN) + (py + PIXEL_KEY_SPAN);
  let k = _kept.get(n);
  if (k === undefined) {
    if (_kept.size >= PIXEL_KEYS_KEPT) _kept.clear();
    k = `${px},${py}`;
    _kept.set(n, k);
  }
  return k;
}
