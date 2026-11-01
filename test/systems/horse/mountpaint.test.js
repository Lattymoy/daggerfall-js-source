// AUDIT-STOREFRONT (2026-10-29, the owner: "the horse designs are awful"; bible/06-Systems/Storefront.md section 7): THE
// LOOKS BY THE HORSE'S SHAPE (systems/horse/mountPaint.js) where the shop's side view does not reach - the mane seen from
// the saddle, the views from the front and behind, the 3D horse's legs and chest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

import { recolorHorse, recolorHorseTexels, withMountLook, POINT_SHINE } from '../../../src/systems/horse/horseCoats.js';
import { VIEW_FRONT, VIEW_SIDE, VIEW_BACK, GHOST_LEGS } from '../../../src/systems/horse/mountPaint.js';
import { horseTexelMap } from '../../../src/world/horseModel.js';
import { MOUNT_PREVIEW_FILE } from '../../../src/ui/mountPreview.js';
import { horsePictures } from '../../../tools/lib/horsePictures.mjs';

const bytes = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url));
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx / 255]; };
const lum = (c, o) => (c[o] + c[o + 1] + c[o + 2]) / 765;

/** The riding view built: a neck's hide on the right, a mane 44 px across off it to the left with a grey shine every
 *  fourth row, and a grey patch in the air by its fringe. */
function saddleView() {
  const W = 80, H = 40, colors = new Uint8Array(W * H * 4);
  const put = (x, y, rgb) => colors.set([...rgb, 255], (y * W + x) * 4);
  for (let y = 2; y < 38; y++) {
    for (let x = 50; x < 78; x++) { const r = 120 + y * 2; put(x, y, [r, Math.round(r * 0.53), Math.round(r * 0.27)]); }
    for (let x = 6; x < 50; x++) put(x, y, [24, 22, 22]);
    if (y % 4 === 0 && y < 34) for (let x = 10; x < 46; x++) put(x, y, [120, 120, 120]);
  }
  for (let y = 18; y < 22; y++) for (let x = 2; x < 6; x++) put(x, y, [120, 120, 120]);
  return { width: W, height: H, colors };
}
const saddle = { bottomFirst: false, legs: false, tack: false };   // as systems/riding.js dyes its frames

test('AUDIT-STOREFRONT the mane seen from the saddle: every strand of it the look\'s, however far from the hide; brightest at its fringe, by its share of the way out; its grey shine taken with it, never a grey beside it; and no plate seam stood up along the neck (mutants: the strands past EDGE_MAX left the hide\'s; the tips by length alone; the shine left grey; the shine too eager; the face read from the mane)', () => {
  const img = saddleView(), W = img.width;
  const fire = recolorHorse(img, withMountLook(0, 'dawnfire'), saddle).colors;
  const band = (x0, x1) => { let s = 0, n = 0; for (let y = 2; y < 38; y++) for (let x = x0; x < x1; x++) { s += lum(fire, (y * W + x) * 4); n++; } return s / n; };
  assert.ok(band(6, 20) > 0.7, `the fringe's half burns (${band(6, 20).toFixed(2)})`);
  assert.ok(band(6, 13) > band(30, 37) + 0.05, `brightest at the fringe (${band(6, 13).toFixed(2)} over ${band(30, 37).toFixed(2)})`);
  for (let y = 4; y < 34; y += 4) for (let x = 10; x < 46; x++) {
    const o = (y * W + x) * 4;
    assert.ok(fire[o] > fire[o + 2] + 20 && lum(fire, o) > 0.5, `the shine at ${x},${y} burns (${[...fire.slice(o, o + 3)]})`);
  }
  assert.ok(POINT_SHINE >= 5);
  for (let y = 18; y < 22; y++) for (let x = 2; x < 6; x++) assert.deepEqual([...fire.slice((y * W + x) * 4, (y * W + x) * 4 + 4)], [120, 120, 120, 255], `the grey at ${x},${y} kept`);
  // the automaton's seams: the plates' line across the neck, never a column (the face is the hooves' views') - its neck
  // the same with the mane off it
  const brass = recolorHorse(img, withMountLook(0, 'automaton'), saddle).colors;
  const bare = { ...img, colors: new Uint8Array(img.colors) };
  for (let y = 0; y < img.height; y++) for (let x = 0; x < 50; x++) bare.colors.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
  const bareBrass = recolorHorse(bare, withMountLook(0, 'automaton'), saddle).colors;
  for (let y = 2; y < 38; y++) for (let x = 52; x < 78; x++) { const o = (y * W + x) * 4; assert.deepEqual([...brass.slice(o, o + 4)], [...bareBrass.slice(o, o + 4)], `the neck at ${x},${y}`); }
  for (let x = 52; x < 76; x++) {
    let dark = 0;
    for (let y = 2; y < 38; y++) { const o = (y * W + x) * 4; if (hsv(brass[o], brass[o + 1], brass[o + 2])[2] < 0.2) dark++; }
    assert.ok(dark < 36 * 0.4, `no seam down column ${x} (${dark} dark)`);
  }
});

test('AUDIT-STOREFRONT the views: the automaton\'s heart at its chest from the side and the front quarter; none from behind, and none from the front, where its head stands before it; seen from the front or behind its plates never seamed as a flank\'s (mutants: the heart from behind; the view ignored for its face)', { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH not set' }, async () => {
  const raw = await horsePictures().picture(MOUNT_PREVIEW_FILE);   // OWN-WORK4: the shop's side view, ours, built from ARENA2
  const img = { width: raw.width, height: raw.height, colors: new Uint8Array(raw.data) }, W = img.width;
  const heart = (view) => { const c = recolorHorse(img, withMountLook(0, 'automaton'), { bottomFirst: false, view }).colors; let n = 0; for (let i = 0; i < W * img.height; i++) { const [h, s, v] = hsv(c[i * 4], c[i * 4 + 1], c[i * 4 + 2]); if (c[i * 4 + 3] && h > 190 && h < 215 && s > 0.5 && v > 0.5) n++; } return n; };
  assert.ok(heart(undefined) > 6 && heart(VIEW_SIDE) > 6 && heart(1) > 6, 'seen from the side');
  for (const v of [VIEW_FRONT, 3, VIEW_BACK]) assert.equal(heart(v), 0, `none from view ${v}`);
  const seamCols = (view) => {
    const c = recolorHorse(img, withMountLook(0, 'automaton'), { bottomFirst: false, view }).colors, plain = recolorHorse(img, withMountLook(0, 'automaton'), { bottomFirst: false, view: VIEW_FRONT }).colors;
    let n = 0; for (let i = 0; i < W * img.height; i++) if (c[i * 4] !== plain[i * 4]) n++; return n;
  };
  assert.equal(seamCols(VIEW_BACK), 0, 'from behind as from the front: no flank\'s seams');
  assert.ok(seamCols(VIEW_SIDE) > 20, 'the side\'s are its own');
});

test('AUDIT-STOREFRONT the 3D horse: the ghost\'s legs pale out toward its hooves, never a dither in its picture; the automaton\'s heart at its chest as its mesh has it, read off its texel map (mutants: the 3D legs dithered; the 3D heart at a guessed place in the air)', () => {
  const p = PNG.sync.read(bytes('src/assets/horse/body.png'));
  const BODY = { width: p.width, height: p.height, colors: new Uint8Array(p.data) };
  const MAP = horseTexelMap(JSON.parse(bytes('src/assets/horse/courser.json').toString()), BODY.width, BODY.height);
  const ghost = recolorHorseTexels(BODY, withMountLook(0, 'spectral'), MAP).colors;
  let low = 0;
  for (let i = 0; i < MAP.hide.length; i++) {
    if (!MAP.hide[i] || MAP.up[i] >= GHOST_LEGS * 0.3) continue;
    low++;
    assert.ok(hsv(ghost[i * 4], ghost[i * 4 + 1], ghost[i * 4 + 2])[2] > 0.55, `texel ${i} pale (up ${MAP.up[i].toFixed(2)})`);
    assert.equal(ghost[i * 4 + 3], BODY.colors[i * 4 + 3], 'its alpha the picture\'s');
  }
  assert.ok(low > 100, `the hooves' texels read (${low})`);
  const brass = recolorHorseTexels(BODY, withMountLook(0, 'automaton'), MAP).colors;
  let core = 0;
  for (let i = 0; i < MAP.hide.length; i++) { const [h, s, v] = hsv(brass[i * 4], brass[i * 4 + 1], brass[i * 4 + 2]); if (MAP.hide[i] && h > 190 && h < 215 && s > 0.5 && v > 0.5) core++; }
  assert.ok(core > 100, `its heart (${core} texels)`);
});
