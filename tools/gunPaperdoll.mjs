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
//     node tools/gunPaperdoll.mjs [--length=72] [--angle=35] [--ammo=12]
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
 * ROTATION, at full resolution and before the downscale.
 *
 * Mac: "when the paperdoll handles it, aim it angled downwards" - which
 * is how every classic weapon hangs on the doll: a sword is not drawn
 * lying flat, it drops from the fist. `deg` is how far the MUZZLE
 * falls, so a positive number always means more downward and nobody
 * has to reason about which way a rotation matrix turns.
 *
 * Done on the source art, not on the finished sprite: rotating 72x22
 * pixels resamples an image that has already thrown away everything it
 * had, and the diagonals come out as staircases with holes in them.
 * Rotate 1790x550 and let the downscale do what it is good at.
 *
 * Bilinear, and WEIGHTED BY ALPHA for the same reason the downscale
 * is - sampling the colour of transparent pixels at an edge drags the
 * outline toward black.
 */
export function rotate(img, deg) {
  if (!deg) return { img, map: (x, y) => [x, y] };
  const { width: w, height: h, data } = img;
  // screen coords have y downward, so the muzzle (at the LEFT of the
  // art) falls when the image turns anticlockwise: negate here once,
  // and `deg` stays "how far down the muzzle points" everywhere else
  const a = -deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const cx = w / 2, cy = h / 2;
  const nw = Math.ceil(Math.abs(w * ca) + Math.abs(h * sa));
  const nh = Math.ceil(Math.abs(w * sa) + Math.abs(h * ca));
  const ncx = nw / 2, ncy = nh / 2;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      // inverse map: where in the source does this destination pixel look
      const dx = x + 0.5 - ncx, dy = y + 0.5 - ncy;
      const sx = dx * ca + dy * sa + cx - 0.5;
      const sy = -dx * sa + dy * ca + cy - 0.5;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < -1 || y0 < -1 || x0 > w || y0 > h) continue;
      const fx = sx - x0, fy = sy - y0;
      let r = 0, g = 0, b = 0, al = 0;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const px = x0 + i, py = y0 + j;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const wgt = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
          const p = (py * w + px) * 4, pa = data[p + 3] / 255;
          r += data[p] * pa * wgt; g += data[p + 1] * pa * wgt; b += data[p + 2] * pa * wgt;
          al += pa * wgt;
        }
      }
      const d = (y * nw + x) * 4;
      if (al > 0) { out[d] = r / al; out[d + 1] = g / al; out[d + 2] = b / al; }
      out[d + 3] = Math.round(Math.min(1, al) * 255);
    }
  }
  // where a point of the SOURCE ended up, so the hand gap - tuned on
  // the art lying flat - follows the grip round
  const map = (x, y) => {
    const px = x - cx, py = y - cy;
    return [px * ca - py * sa + ncx, px * sa + py * ca + ncy];
  };
  return { img: { width: nw, height: nh, data: out }, map };
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

/**
 * `length` is the WEAPON'S OWN LENGTH in sprite pixels, not the
 * bounding box's width - once the art is angled those are different
 * numbers, and the one worth holding steady is the gun. Tilt it
 * further and it should get taller, not shorter.
 */
export function makeSprite(name, length, { band = null, angle = 0 } = {}) {
  const img = load(name);
  const box = alphaBox(img);
  if (!box) throw new Error(`${name} is empty`);
  const flat = crop(img, box);
  const scale = length / flat.width;
  const { img: turned, map } = rotate(flat, angle);
  const tb = alphaBox(turned) ?? { x: 0, y: 0, w: turned.width, h: turned.height };
  const trimmed = crop(turned, tb);
  const tw = Math.max(1, Math.round(trimmed.width * scale));
  const th = Math.max(1, Math.round(trimmed.height * scale));
  const small = hardenAlpha(downscale(trimmed, tw, th));
  let cut = 0, placed = null;
  if (band) {
    // the band was tuned on the art lying flat: carry its centre round
    // with the rotation and add the tilt to its own angle
    const [rx, ry] = map(band.cx * flat.width, band.cy * flat.height);
    placed = {
      cx: (rx - tb.x) / trimmed.width, cy: (ry - tb.y) / trimmed.height,
      deg: band.deg - angle, thick: band.thick, length: band.length,
    };
    cut = punchBand(small, placed);
  }
  return { name, source: `${img.width}x${img.height}`, trimmed: `${flat.width}x${flat.height}`, size: `${tw}x${th}`, angle, cut, sprite: small, band: placed };
}

function bake(name, length, opts) {
  const r = makeSprite(name, length, opts);
  writeFileSync(join(OUT, opts.out), writePng(r.sprite));
  return { ...r, out: opts.out };
}

mkdirSync(OUT, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

// THE GRIP, in fractions of the trimmed art: the wooden pistol grip
// runs down-right from about (0.90, 0.42) to the butt, so the band
// that severs it runs across at about 30 degrees, a fist thick.
const bandArg = arg('band', '0.935,0.555,-30,8,16').split(',').map(Number);
const band = process.argv.includes('--no-gap') ? null : {
  cx: bandArg[0], cy: bandArg[1], deg: bandArg[2], thick: bandArg[3], length: bandArg[4],
};
const gap = band;

// 72px wide is not a look, it is the GRIP: the doll's fist is about
// 8px across, the grip is a quarter of the art's height, and the gun
// has to be big enough that a fist-sized hole lands on the grip
// instead of eating the receiver with it.
// ANGLED DOWN (Mac, 2026-09-19), because that is how a weapon hangs
// off a fist - the classic doll never draws one lying flat. The
// muzzle falls; `angle` is how far, so more is always more downward.
const ANGLE = num('angle', 35);
const gun = bake('gun-side.png', num('length', 72), { band, angle: ANGLE, out: 'gun-paperdoll.png' });

/** THE AUDITION. Where a fist sits on a grip is a judgement call made
 *  against a doll this container does not have (no ARENA2 here), so
 *  the four candidates go on one sheet and whoever has the game picks.
 *  The default is A. */
export const GAP_CANDIDATES = [
  ['A', { cx: 0.935, cy: 0.555, deg: -30, thick: 8, length: 16 }, 'a fist-wide band square across the grip - the default'],
  ['B', { cx: 0.920, cy: 0.500, deg: -30, thick: 7, length: 16 }, 'forward and narrower, nearer the trigger'],
  ['C', { cx: 0.950, cy: 0.620, deg: -30, thick: 9, length: 16 }, 'lower down the grip, a bigger hand'],
  ['D', { cx: 0.935, cy: 0.555, deg: 28, thick: 8, length: 18 }, 'the first pass: not square to the grip'],
];

if (process.argv.includes('--sheet')) {
  const zoom = 6, pad = 10, labelH = 12;
  const tiles = GAP_CANDIDATES.map(([, g]) => makeSprite('gun-side.png', num('length', 72), { band: g, angle: ANGLE }));
  const tw = Math.max(...tiles.map((t) => t.sprite.width)) * zoom;
  const thh = Math.max(...tiles.map((t) => t.sprite.height)) * zoom;
  const W = pad + (tw + pad) * 2, H = pad + (thh + labelH + pad) * 2;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 20; out[i + 1] = 22; out[i + 2] = 26; out[i + 3] = 255; }
  tiles.forEach((t, i) => {
    const x = pad + (i % 2) * (tw + pad), y = pad + labelH + Math.floor(i / 2) * (thh + labelH + pad);
    fistOn(out, W, H, x, y, zoom, t.band, t.sprite);
    for (let py = 0; py < t.sprite.height * zoom; py++) for (let px = 0; px < t.sprite.width * zoom; px++) {
      const sp = ((py / zoom | 0) * t.sprite.width + (px / zoom | 0)) * 4;
      if (!t.sprite.data[sp + 3]) continue;
      const d = ((y + py) * W + x + px) * 4;
      out[d] = t.sprite.data[sp]; out[d + 1] = t.sprite.data[sp + 1]; out[d + 2] = t.sprite.data[sp + 2]; out[d + 3] = 255;
    }
    // a bar of dots per label, A=1 B=2 C=3 D=4: this file cannot draw
    // text and a legend in the console is enough
    for (let k = 0; k <= i; k++) for (let py = 0; py < 6; py++) for (let px = 0; px < 6; px++) {
      const d = ((y - labelH + py + 2) * W + x + k * 9 + px) * 4;
      out[d] = 200; out[d + 1] = 150; out[d + 2] = 70; out[d + 3] = 255;
    }
  });
  writeFileSync(join(PREVIEW, 'gap-candidates.png'), writePng({ width: W, height: H, data: out }));
  console.log(`\nsheet: scratch/gun-paperdoll/gap-candidates.png  (dots = A B C D, left-right then down)`);
  for (const [k, g, why] of GAP_CANDIDATES) console.log(`  ${k}  --band=${g.cx},${g.cy},${g.deg},${g.thick},${g.length}  ${why}`);
}
// THE PELLET (FIELD-GUN16, 2026-09-20, Mac: "Shrink the inventory
// icon for the pellet ammo"; FIELD-GUN18, the same day: "Shrink the
// orb pellet ammo sprite in the inventory. It's too large"). 12px,
// down from 16, down from 22.
//
// THE DEFAULT IS THE SHIPPED SIZE, so a re-bake reproduces what is in
// public/art rather than quietly restoring the old one - the same law
// FIELD-GUN15 just made a pin of for the sound picks, and for the same
// reason: a tool whose default is not what shipped is a trap laid for
// whoever runs it next.
//
// WHY 12 AND NOT ANOTHER NUMBER. The list cell is 50x38 and
// `makeIconDrawer` never ENLARGES (`fit = Math.min(1, ...)`), so an
// icon is drawn at its own size: 22 filled nearly half the cell width
// - a pellet the size of a helmet - and 16 was still reading as a
// cannonball beside a quiver of arrows.
//
// FIELD-GUN16's note claimed here that "14 starts eating the
// engraving and 12 is a brown dot". THAT JUDGEMENT WAS WRONG, and it
// is worth saying why rather than quietly moving the number: it was
// made against an 8x PREVIEW in a container with no game in it, where
// a sprite is inspected instead of glanced at. At 12 the dwarven
// banding and the central boss both still read, and the person with
// the game says 16 does not. The source is 1254px square, so any of
// these is a clean downscale rather than a resample of a resample.
const ammo = bake('gun-ammo-src.png', num('ammo', 12), { out: 'gun-ammo.png' });

for (const r of [gun, ammo]) {
  console.log(`${r.out.padEnd(20)} ${r.source} -> trimmed ${r.trimmed} -> ${r.size}${r.angle ? ` at ${r.angle}\u00b0 down` : ''}${r.cut ? `, ${r.cut} px cut for the hand` : ''}`);
}
writeFileSync(join(PREVIEW, 'gun-paperdoll-preview.png'), writePng(preview(gun.sprite, 8, true, gun.band)));
writeFileSync(join(PREVIEW, 'gun-ammo-preview.png'), writePng(preview(ammo.sprite, 8, false)));
console.log(`preview: ${PREVIEW}/`);
