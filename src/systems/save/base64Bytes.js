// Base64 to bytes and back, with no atob or btoa - moved from saveTransfer.js (SNOW-THREAD, 2026-10-26) so a module
// that needs only these two (systems/snowfall.js, and through it the snow's build worker) loads nothing else.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 -> bytes, with no atob (the app's preload has none and node's is not the browser's) */
export function base64ToBytes(s) {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0,
    buf = 0,
    bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 255;
    }
  }
  return out.subarray(0, o);
}
/** bytes -> base64 */
export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i],
      b = bytes[i + 1],
      c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s +=
      B64[(n >> 18) & 63] +
      B64[(n >> 12) & 63] +
      (b === undefined ? '=' : B64[(n >> 6) & 63]) +
      (c === undefined ? '=' : B64[n & 63]);
  }
  return s;
}
