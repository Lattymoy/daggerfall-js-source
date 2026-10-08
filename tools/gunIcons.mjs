// THE THUNDERLOCK'S LIST PICTURES, AND THE GILDED RUNG'S GOLD (THUNDERLOCK-ART + GILDED1, 2026-10-07).
//
// Mac: "The thunderlock/ammo also doesnt recieve proper artwork in slots like the hotbar or inventory" - and the Gilded
// rung's "most rare and gilded item in the entire game".
//
// FROM THE DOLL LAYER'S OWN PIXELS, BECAUSE THAT IS THE ART THERE IS. Mac's painting of the gun lives in the ignored
// scratch/ (tools/gunPaperdoll.mjs's input); what the tree carries is its doll layer, public/art/gun-paperdoll.png -
// 68x42, with an ellipse punched out of the grip where the fist closes. That gap is right on the doll and wrong in a
// list: the pack tile and the hotbar slot drew a gun broken in two, its butt a speck beside it. So:
//
//   gun-icon.png            the doll layer with the GAP HEALED - each row bridged from the receiver's edge to the butt's,
//                           its colours carried across and shaded as a turned stock is (lit above, shadowed below) -
//                           and trimmed to what is drawn. The whole gun, in every list (systems/thunderlock.js record 1).
//   gun-icon-gilded.png     the same in gold leaf: each pixel's lightness laid on a gold ramp (its own darkest and
//   gun-paperdoll-gilded.png lightest a twentieth in from either end), two glints on its brightest places - the Hourlock's
//                           list picture and doll layer (records 3 and 2; systems/gilded.js).
//
// THE PELLET IS NOT ITS BUSINESS. public/art/gun-ammo.png stays the 12px ball tools/gunPaperdoll.mjs cut from Mac's own
// painting, at Mac's own size (FIELD-GUN16 and FIELD-GUN18: "Shrink the orb pellet ammo sprite in the inventory. It's too
// large" - gunLab.test.js pins it). Its slots drew initials for the dye's reason (systems/textureReplacement.js
// standInDye), never the picture's.
//
// DETERMINISTIC: the same doll layer in, the same pixels out - nothing random, nothing timed. test/thunderlockart.test.js
// runs `gunIcons` over the committed doll layer and compares the result to the committed PNGs PIXEL FOR PIXEL (the
// MW bake's law: a derivation you cannot re-run is a claim you cannot check; pixels, not bytes, so a zlib build cannot
// fail it).
//
//     node tools/gunIcons.mjs           -> public/art/gun-icon.png, gun-icon-gilded.png, gun-paperdoll-gilded.png
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE = 'public/art/gun-paperdoll.png';
export const OUT = Object.freeze({
  icon: 'public/art/gun-icon.png',
  iconGilded: 'public/art/gun-icon-gilded.png',
  dollGilded: 'public/art/gun-paperdoll-gilded.png',
});

/** A pixel counts as drawn above this alpha - the doll layer's own edge is hard. */
const DRAWN = 40;

/** The 8-connected parts of a picture's drawn pixels, largest first: `[[index, ...], ...]` over `y * w + x`. */
export function parts({ width: w, height: h, data }) {
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || data[i * 4 + 3] <= DRAWN) continue;
    const part = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      part.push(p);
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) {
            const q = ny * w + nx;
            if (!seen[q] && data[q * 4 + 3] > DRAWN) { seen[q] = 1; stack.push(q); }
          }
        }
      }
    }
    out.push(part);
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * THE GAP HEALED. The body is the largest part and the butt the second; on every row both stand on, the pixels between
 * the body's last before the butt and the butt's first are bridged - the two edge colours carried across, then shaded
 * by the row's place in the butt's height (a turned stock catches the light along its top and falls into shadow under
 * it). A picture with one part has no gap, and comes back as it went in.
 */
export function healGap(img) {
  const { width: w, height: h, data } = img;
  const out = { width: w, height: h, data: new Uint8ClampedArray(data) };
  const ps = parts(img);
  if (ps.length < 2) return out;
  const body = new Set(ps[0]), butt = ps[1];
  const by = butt.map((p) => (p / w) | 0);
  const top = Math.min(...by), bottom = Math.max(...by);
  for (let y = top; y <= bottom; y++) {
    const bx = butt.filter((p) => ((p / w) | 0) === y).map((p) => p % w);
    if (!bx.length) continue;
    const right = Math.min(...bx);
    let left = -1;
    for (let x = right - 1; x >= 0; x--) if (body.has(y * w + x)) { left = x; break; }
    if (left < 0 || right - left <= 1) continue;
    const r = bottom > top ? (y - top) / (bottom - top) : 0.5;
    const shade = 1.16 - 0.4 * r;
    for (let x = left + 1; x < right; x++) {
      const t = (x - left) / (right - left);
      const a = (y * w + left) * 4, b = (y * w + right) * 4, o = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) out.data[o + k] = Math.round((data[a + k] * (1 - t) + data[b + k] * t) * shade);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** The box of everything drawn, and the picture cut to it. */
export function trim(img) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= 0) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return img;
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) out.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * W * 4);
  return { width: W, height: H, data: out };
}

/** GOLD LEAF, darkest to brightest - the ramp a gilded pixel's lightness is laid on. */
export const GOLD = Object.freeze([[46, 26, 4], [96, 62, 8], [156, 108, 20], [212, 160, 38], [246, 204, 76], [255, 236, 150], [255, 255, 232]]);
/** A ramp read at `t` (0..1), linearly between its stops. */
export function ramp(stops, t) {
  const u = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u)), f = u - i;
  return [0, 1, 2].map((k) => Math.round(stops[i][k] * (1 - f) + stops[i + 1][k] * f));
}
const lightness = (d, o) => (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;

/**
 * GILD a picture: every drawn pixel's lightness, read between the picture's own darkest and lightest (a twentieth in from
 * either end, so one black speck or one glint does not flatten the rest), laid on the gold ramp with its mid-tones held a
 * shade dark so the form stays; then a white glint on each of its two brightest pixels that stand apart. Alpha is kept.
 */
export function gild(img) {
  const { width: w, height: h, data } = img;
  const out = { width: w, height: h, data: new Uint8ClampedArray(data) };
  const ls = [];
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] >= 8) ls.push(lightness(data, i * 4));
  if (!ls.length) return out;
  ls.sort((a, b) => a - b);
  const lo = ls[Math.floor(ls.length * 0.05)], hi = ls[Math.floor(ls.length * 0.95)];
  const span = Math.max(1e-6, hi - lo);
  const bright = [];
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] < 8) continue;
    const t = Math.max(0, Math.min(1, (lightness(data, o) - lo) / span)) ** 1.1;
    const c = ramp(GOLD, 0.06 + 0.88 * t);
    out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2];
    bright.push([t, i]);
  }
  // the two glints: the brightest pixels at least five apart, ties broken by place so the pick is one answer
  bright.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const glints = [];
  for (const [, i] of bright) {
    if (glints.length >= 2) break;
    const x = i % w, y = (i / w) | 0;
    if (glints.every((j) => Math.abs((j % w) - x) + Math.abs(((j / w) | 0) - y) >= 5)) glints.push(i);
  }
  for (const i of glints) { const o = i * 4; out.data[o] = 255; out.data[o + 1] = 255; out.data[o + 2] = 255; }
  return out;
}

/** Every picture this tool makes, from the doll layer's pixels: `{ icon, iconGilded, dollGilded }`. */
export function gunIcons(doll) {
  const icon = trim(healGap(doll));
  return { icon, iconGilded: gild(icon), dollGilded: gild(doll) };
}

if (isMain(import.meta.url)) {
  const r = gunIcons(readPng(readFileSync(SOURCE)));
  for (const [k, path] of Object.entries(OUT)) {
    writeFileSync(path, writePng(r[k]));
    console.log(`  ${path}  ${r[k].width}x${r[k].height}`);
  }
}
