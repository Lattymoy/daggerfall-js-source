// THE GUN'S PAPERDOLL AND INVENTORY ART (Mac, 2026-09-19: "treat this
// like the other weapon sprites, it needs a gap for it to fit into the
// paperdoll's right hand").
//
// ONE SPRITE DOES BOTH JOBS, which is why the gap is not optional. A
// weapon's paperdoll layer and its inventory icon are the SAME record
// in Daggerfall - GetInventoryTextureArchive hands back the item's
// PlayerTextureArchive, the very field the doll draws from
// (src/characters/paperdollArt.js) - so whatever is cut out of the
// sprite is cut out of both. That is exactly why classic weapon icons
// have a notch in them: it is not an icon with a hole, it is a doll
// layer being shown in a list.
//
// THE GAP. The doll composites bottom-up and weapons carry drawOrder
// 100, so the weapon lands ON TOP of the body - including the hand.
// Transparent pixels are the only way the fist reads through, so the
// grip gets an ellipse punched out of it where the hand closes. Too
// small and the gun floats in front of a fist; too large and the hand
// is holding air.
//
//     node tools/gunPaperdoll.mjs [--width=72] [--ammo=22]
//                                 [--band=cx,cy,deg,thick,length] [--no-gap]
//                                 [--sheet]
//
// `cx,cy` are fractions of the TRIMMED sprite so they survive a change
// of --width; `deg,thick,length` are the band's angle and size in
// sprite pixels, because a cut has to stay square to the grip.
// `--sheet` renders four candidates side by side. Everything goes to
// public/art/, previews to scratch/gun-paperdoll/.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPng, writePng } from './pngIO.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const num = (k, d) => Number(arg(k, d));

const SRC = process.env.GUN_ART_DIR ?? 'scratch/gun-art';
const OUT = 'public/art';
const PREVIEW = 'scratch/gun-paperdoll';

// The classic panel, for scale (src/ui/paperDoll.js PAPERDOLL_W/H).
export const PAPERDOLL_W = 110, PAPERDOLL_H = 184;

/** The box of everything that is not fully transparent. */
export function alphaBox(img, threshold = 8) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < threshold) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(img, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const s = ((y + box.y) * img.width + (x + box.x)) * 4, d = (y * box.w + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
  }
  return { width: box.w, height: box.h, data: out };
}

/**
 * Box-average downscale, WEIGHTED BY ALPHA.
 *
 * Nearest-neighbour is the reflex for pixel art and it is wrong in this
 * direction: going from 1790px to 56 it keeps one pixel in thirty-two
 * and throws the other thirty-one away, which turns every rivet and
 * barrel line into aliasing confetti. Averaging the box is what a good
 * downsample does. The alpha weighting is the part that matters at an
 * edge - average the colour of transparent pixels in and the outline
 * bleeds toward black.
 */
export function downscale(img, tw, th) {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy0 = Math.floor(y * h / th), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * h / th));
    for (let x = 0; x < tw; x++) {
      const sx0 = Math.floor(x * w / tw), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * w / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const p = (sy * w + sx) * 4, al = data[p + 3] / 255;
          r += data[p] * al; g += data[p + 1] * al; b += data[p + 2] * al;
          a += al; n++;
        }
      }
      const d = (y * tw + x) * 4;
      if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
      out[d + 3] = Math.round((a / n) * 255);
    }
  }
  return { width: tw, height: th, data: out };
}

/**
 * 1-BIT ALPHA, because the port's own law is 1-bit: drawScreenQuad
 * discards texels under 0.5 alpha and the classic art is an indexed
 * bitmap where index 0 is simply absent. A soft edge looks right in a
 * PNG viewer and wrong the moment the game draws it, so it is hardened
 * here where it can be seen rather than there where it cannot.
 */
export function hardenAlpha(img, threshold = 110) {
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= threshold ? 255 : 0;
  return img;
}

/**
 * THE HAND GAP AS A BAND - a cut straight ACROSS the grip, at the
 * grip's own angle, rather than a circle punched into it.
 *
 * This is what the classic weapon art does and the reason is what it
 * leaves BEHIND: a band severs the grip cleanly, so the receiver stays
 * above the hand and the butt stays below it, and the eye reads two
 * ends of one grip with a fist between them. A circle leaves a ragged
 * crescent and reads as damage - which is exactly how the first pass
 * looked.
 *
 * `deg` is the direction the band RUNS, so it is perpendicular to the
 * grip: a grip sloping down-right at 60 degrees wants a band at about
 * 30. Pixel space, not fractions, because a band has to stay square to
 * the grip and an aspect-distorted one does not.
 */
export function punchBand(img, { cx, cy, deg = 30, thick = 8, length = 16 }) {
  const { width: w, height: h, data } = img;
  const ox = cx * w, oy = cy * h;
  const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  let cut = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
      const along = dx * ca + dy * sa, across = -dx * sa + dy * ca;
      if (Math.abs(along) > length / 2 || Math.abs(across) > thick / 2) continue;
      const p = (y * w + x) * 4;
      if (data[p + 3] !== 0) { data[p + 3] = 0; cut++; }
    }
  }
  return cut;
}

/** THE HAND GAP: an ellipse of nothing, where the fist closes. */
export function punchGap(img, { cx, cy, rx, ry }) {
  const { width: w, height: h, data } = img;
  const ox = cx * w, oy = cy * h, ax = Math.max(0.5, rx * w), ay = Math.max(0.5, ry * h);
  let cut = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - ox) / ax, dy = (y + 0.5 - oy) / ay;
      if (dx * dx + dy * dy > 1) continue;
      const p = (y * w + x) * 4;
      if (data[p + 3] !== 0) { data[p + 3] = 0; cut++; }
    }
  }
  return cut;
}

/** A STAND-IN FIST, drawn BEHIND the sprite at the gap, because the
 *  only question worth asking of a hand gap is whether a hand fills
 *  it. Without one the preview shows a gun with a bite out of it and
 *  a detached butt, and every reading of that is guesswork. This is
 *  the preview's own - there is no ARENA2 in this container and
 *  therefore no real doll to lay it over. */
function fistOn(out, w, h, x, y, zoom, gap, sprite) {
  if (!gap) return;
  const cx = x + gap.cx * sprite.width * zoom, cy = y + gap.cy * sprite.height * zoom;
  const r = (gap.thick ? gap.thick / 2 : 0) * zoom * 1.15;
  const rx = gap.thick ? r : gap.rx * sprite.width * zoom * 1.25;
  const ry = gap.thick ? r : gap.ry * sprite.height * zoom * 1.25;
  for (let py = Math.floor(cy - ry); py <= cy + ry; py++) {
    for (let px = Math.floor(cx - rx); px <= cx + rx; px++) {
      const dx = (px - cx) / rx, dy = (py - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const d = (py * w + px) * 4;
      const shade = 1 - 0.28 * (dx * dx + dy * dy);
      out[d] = 176 * shade; out[d + 1] = 130 * shade; out[d + 2] = 103 * shade; out[d + 3] = 255;
    }
  }
}

/** The sprite, magnified with a checker behind it and the doll's own
 *  panel beside it, because "is the gap the size of a fist" is a
 *  question about SCALE and cannot be answered on a sprite alone. */
function preview(sprite, zoom, withPanel, gap = null) {
  const pad = 8;
  const pw = withPanel ? PAPERDOLL_W + pad : 0;
  const w = pad + sprite.width * zoom + pad + pw;
  const h = Math.max(sprite.height * zoom, withPanel ? PAPERDOLL_H : 0) + pad * 2;
  const out = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const d = (y * w + x) * 4;
    const al = a / 255, ia = 1 - al;
    out[d] = out[d] * ia + r * al; out[d + 1] = out[d + 1] * ia + g * al;
    out[d + 2] = out[d + 2] * ia + b * al; out[d + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ((x >> 3) + (y >> 3)) & 1 ? 54 : 38;
    put(x, y, c, c, c + 4);
  }
  fistOn(out, w, h, pad, pad, zoom, gap, sprite);
  for (let y = 0; y < sprite.height * zoom; y++) {
    for (let x = 0; x < sprite.width * zoom; x++) {
      const s = ((y / zoom | 0) * sprite.width + (x / zoom | 0)) * 4;
      put(pad + x, pad + y, sprite.data[s], sprite.data[s + 1], sprite.data[s + 2], sprite.data[s + 3]);
    }
  }
  if (withPanel) {
    const px = pad + sprite.width * zoom + pad;
    for (let y = 0; y < PAPERDOLL_H; y++) for (let x = 0; x < PAPERDOLL_W; x++) put(px + x, pad + y, 26, 24, 22);
    // the sprite at 1:1 over the panel, roughly where a right hand is
    // (the Hands armour label sits at y=90 - PaperDoll.armourLabelPos)
    const sx = px + 16, sy = pad + 84;
    fistOn(out, w, h, sx, sy, 1, gap, sprite);
    for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) {
      const s = (y * sprite.width + x) * 4;
      put(sx + x, sy + y, sprite.data[s], sprite.data[s + 1], sprite.data[s + 2], sprite.data[s + 3]);
    }
  }
  return { width: w, height: h, data: out };
}

const load = (name) => readPng(readFileSync(join(SRC, name)));

function bake(name, targetW, { gap = null, band = null, out } = {}) {
  const img = load(name);
  const box = alphaBox(img);
  if (!box) throw new Error(`${name} is empty`);
  const cropped = crop(img, box);
  const th = Math.max(1, Math.round(targetW * cropped.height / cropped.width));
  const small = hardenAlpha(downscale(cropped, targetW, th));
  const cut = band ? punchBand(small, band) : gap ? punchGap(small, gap) : 0;
  writeFileSync(join(OUT, out), writePng(small));
  return { name, out, source: `${img.width}x${img.height}`, trimmed: `${cropped.width}x${cropped.height}`, size: `${targetW}x${th}`, cut, sprite: small };
}

mkdirSync(OUT, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

// THE GRIP, in fractions of the trimmed art: the wooden pistol grip
// runs down-right from about (0.90, 0.42) to the butt, so the band
// that severs it runs across at about 30 degrees, a fist thick.
const bandArg = arg('band', '0.935,0.555,28,8,18').split(',').map(Number);
const band = process.argv.includes('--no-gap') ? null : {
  cx: bandArg[0], cy: bandArg[1], deg: bandArg[2], thick: bandArg[3], length: bandArg[4],
};
const gap = band;

// 72px wide is not a look, it is the GRIP: the doll's fist is about
// 8px across, the grip is a quarter of the art's height, and the gun
// has to be big enough that a fist-sized hole lands on the grip
// instead of eating the receiver with it.
const gun = bake('gun-side.png', num('width', 72), { band, out: 'gun-paperdoll.png' });

/** THE AUDITION. Where a fist sits on a grip is a judgement call made
 *  against a doll this container does not have (no ARENA2 here), so
 *  the four candidates go on one sheet and whoever has the game picks.
 *  The default is A. */
export const GAP_CANDIDATES = [
  ['A', { cx: 0.935, cy: 0.555, deg: 28, thick: 8, length: 18 }, 'a fist-wide band across the grip - the default'],
  ['B', { cx: 0.925, cy: 0.510, deg: 28, thick: 7, length: 18 }, 'a shade forward and narrower'],
  ['C', { cx: 0.945, cy: 0.600, deg: 28, thick: 9, length: 18 }, 'lower down the grip, a bigger hand'],
  ['D', { cx: 0.935, cy: 0.555, deg: 45, thick: 8, length: 18 }, 'the same place, cut at a steeper angle'],
];

if (process.argv.includes('--sheet')) {
  const src = crop(load('gun-side.png'), alphaBox(load('gun-side.png')));
  const zoom = 6, pad = 10, labelH = 12;
  const tiles = GAP_CANDIDATES.map(([, g]) => {
    const th = Math.max(1, Math.round(num('width', 72) * src.height / src.width));
    const sprite = hardenAlpha(downscale(src, num('width', 72), th));
    punchBand(sprite, g);
    return { sprite, g };
  });
  const tw = tiles[0].sprite.width * zoom, thh = tiles[0].sprite.height * zoom;
  const W = pad + (tw + pad) * 2, H = pad + (thh + labelH + pad) * 2;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 20; out[i + 1] = 22; out[i + 2] = 26; out[i + 3] = 255; }
  tiles.forEach((t, i) => {
    const x = pad + (i % 2) * (tw + pad), y = pad + labelH + Math.floor(i / 2) * (thh + labelH + pad);
    fistOn(out, W, H, x, y, zoom, t.g, t.sprite);
    for (let py = 0; py < thh; py++) for (let px = 0; px < tw; px++) {
      const sp = ((py / zoom | 0) * t.sprite.width + (px / zoom | 0)) * 4;
      if (!t.sprite.data[sp + 3]) continue;
      const d = ((y + py) * W + x + px) * 4;
      out[d] = t.sprite.data[sp]; out[d + 1] = t.sprite.data[sp + 1]; out[d + 2] = t.sprite.data[sp + 2]; out[d + 3] = 255;
    }
    // a bar of dots per label, A=1 B=2 C=3 D=4, because this file
    // cannot draw text and a legend in the console is enough
    for (let k = 0; k <= i; k++) for (let py = 0; py < 6; py++) for (let px = 0; px < 6; px++) {
      const d = ((y - labelH + py + 2) * W + x + k * 9 + px) * 4;
      out[d] = 200; out[d + 1] = 150; out[d + 2] = 70; out[d + 3] = 255;
    }
  });
  writeFileSync(join(PREVIEW, 'gap-candidates.png'), writePng({ width: W, height: H, data: out }));
  console.log('\nsheet: scratch/gun-paperdoll/gap-candidates.png  (dots = A B C D, left-right then down)');
  for (const [k, g, why] of GAP_CANDIDATES) console.log(`  ${k}  --band=${g.cx},${g.cy},${g.deg},${g.thick},${g.length}  ${why}`);
}
const ammo = bake('gun-ammo-src.png', num('ammo', 22), { out: 'gun-ammo.png' });

for (const r of [gun, ammo]) {
  console.log(`${r.out.padEnd(20)} ${r.source} -> trimmed ${r.trimmed} -> ${r.size}${r.cut ? `, ${r.cut} px cut for the hand` : ''}`);
}
writeFileSync(join(PREVIEW, 'gun-paperdoll-preview.png'), writePng(preview(gun.sprite, 8, true, gap)));
writeFileSync(join(PREVIEW, 'gun-ammo-preview.png'), writePng(preview(ammo.sprite, 8, false)));
console.log(`preview: ${PREVIEW}/`);
