// THE GUNS' FLASH - its laws, on a leaf (THUNDERLOCK-ART2's audit, 2026-10-24: one home for what both guns' art reads
// off a shot frame, so a retune moves both; a leaf, so combat/thunderlockArt.js and combat/gun/pistoletArt.js - which
// imports the Thunderlock's art - both reach it with no cycle). The white-hot core (FLASH_LUMA: the one thing either
// gun's art draws this bright), its LARGEST connected body (a lone highlight of the metal, the Thunderlock's bolt
// sparking along the barrel, are smaller), that body's centre, and the flame grown out of it.

/** White-hot: a texel at or over this luma (0..255) is the flash's core. */
export const FLASH_LUMA = 215;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Texels joined to `seeds` (8-connected) that are drawn and pass `ok`, marked 1 in `into`. */
function flood(w, h, data, seeds, into, ok) {
  const st = [...seeds];
  for (const i of st) into[i] = 1;
  while (st.length) {
    const i = st.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!into[j] && data[j * 4 + 3] >= 128 && ok(j)) { into[j] = 1; st.push(j); }
    }
  }
  return into;
}

/** THE FLASH'S CORE on one frame: the largest 8-connected body of drawn white-hot texels, a 0/1 mask - or null with no
 *  flash. Pure. */
export function flashBody({ width: w, height: h, data }) {
  const luma = (i) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  const hot = (i) => luma(i) >= FLASH_LUMA;
  const seen = new Uint8Array(w * h);
  let body = null, size = 0;
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || data[i * 4 + 3] < 128 || !hot(i)) continue;
    const one = flood(w, h, data, [i], new Uint8Array(w * h), hot);
    let n = 0;
    for (let k = 0; k < w * h; k++) if (one[k]) { seen[k] = 1; n++; }
    if (n > size) { size = n; body = one; }
  }
  return body;
}

/** WHERE THE SHOT LEAVES (FIELD-GUN17's question, THUNDERLOCK-ART2's answer): the core's centre, as fractions of the
 *  frame (x from its left, y from its TOP - the axes gunFrameRect draws in); null with no flash. Pure. */
export function flashBodyPoint(img) {
  const body = img?.data ? flashBody(img) : null;
  if (!body) return null;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < body.length; i++) if (body[i]) { sx += (i % img.width) + 0.5; sy += ((i / img.width) | 0) + 0.5; n++; }
  return { x: sx / n / img.width, y: sy / n / img.height };
}

/**
 * THE FLASH'S TEXELS on one frame (AUDIT PISTOLET B3): the core (flashBody) grown through the flame's glow - the texels
 * at full red (an additive flame burns the red channel out; the brass does not) and bright, that touch it. The gold leaf
 * never takes them - "the flash and the smoke stay the flash and the smoke" (GILDED1, the Thunderlock's rule). Answers a
 * 0/1 mask; empty on a frame with no flash.
 */
export function flashMask(img) {
  const { width: w, height: h, data } = img;
  const luma = (i) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  const mask = new Uint8Array(w * h);
  const body = flashBody(img);
  if (!body) return mask;
  const seeds = [];
  for (let k = 0; k < w * h; k++) if (body[k]) seeds.push(k);
  return flood(w, h, data, seeds, mask, (j) => data[j * 4] >= 245 && luma(j) >= 150);
}
