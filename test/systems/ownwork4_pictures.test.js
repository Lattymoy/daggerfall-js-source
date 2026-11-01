// THE SIX RETIRED FOLDERS' PICTURES ARE OUR OWN. Each is a recipe for our painter
// (src/art/ownPainter.js), drawn at the size, record and frame count the game read. These pins hold the painter's
// primitives, every recipe's size and print (sha256 of `WxH:` and its RGBA, 16 hex digits: a change to a recipe is a
// change here), the frame counts, and that no picture is read from a file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { createPainter, RAMP, ellipse, rect, stroke, poly, ditherAt, rampShade, textWidth, PAINTED_LETTERS } from '../../src/art/ownPainter.js';
import { FORAGING_ART } from '../../src/systems/foraging/foragingArt.js';
import { TORCH_ART, TORCH_OVER, FLAME_FRAMES, dousedCandle } from '../../src/systems/handheldTorchesArt.js';
import { FISH_ART } from '../../src/systems/deepWater/fishArt.js';
import { TRAVEL_ART } from '../../src/ui/travel/travelArt.js';
import { SURVIVAL_ART } from '../../src/systems/survival/survivalArt.js';
import { rrWeekButtonPicture } from '../../src/systems/roleplayRealism/rrKeeperArt.js';   // The keepers are our rule over the player's people (rr2_realism.test.js)
import { OWN_ICONS, ownIconPicture } from '../../src/systems/survival/itemIcons.js';
import { rotPicture, MOULDY } from '../../src/systems/survival/rotPicture.js';
import { ANIMATION_TIME, torchPicture } from '../../src/systems/handheldTorches.js';
import { createClassicPictures } from '../../src/formats/classicPictures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const printOf = (p) => createHash('sha256').update(`${p.width}x${p.height}:`).update(p.data).digest('hex').slice(0, 16);
const at = (p, x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

test('OWN-WORK4 painter: a shape fills the pixels whose centres it holds, lit from the upper left, dithered between its ramp\'s steps', () => {
  const p = createPainter(8, 8);
  p.fill(rect(2, 2, 6, 6), [9, 8, 7]);
  assert.deepEqual(at(p, 2, 2), [9, 8, 7, 255]);
  assert.deepEqual(at(p, 5, 5), [9, 8, 7, 255]);
  assert.deepEqual([at(p, 1, 2)[3], at(p, 6, 2)[3], at(p, 2, 6)[3]], [0, 0, 0], 'only inside, [x0, x1) x [y0, y1)');
  const d = createPainter(9, 9);
  d.fill(ellipse(4.5, 4.5, 4.5, 4.5), RAMP.grey, { flat: true });
  const lum = (x, y) => at(d, x, y)[0];
  assert.ok(lum(2, 2) > lum(6, 6), 'the upper left is the lit side');
  assert.equal(at(d, 0, 0)[3], 0, 'a corner outside the disc stays clear');
  assert.equal(ditherAt(0, 0), 0.5 / 16);
  assert.equal(ditherAt(1, 0), 8.5 / 16);
  assert.deepEqual(rampShade(RAMP.grey, 0.5, 0, 0), RAMP.grey[2], 'half light, the lowest threshold: the step below');
  assert.deepEqual(rampShade(RAMP.grey, 0.5, 0, 3), RAMP.grey[3], 'the highest threshold: the step above');
  assert.ok(stroke([[0, 0], [10, 0]], 2).has(5, 1.9) && !stroke([[0, 0], [10, 0]], 2).has(5, 2.1), 'a rod of radius 2');
  assert.ok(poly([[0, 0], [4, 0], [0, 4]]).has(1, 1) && !poly([[0, 0], [4, 0], [0, 4]]).has(3, 3), 'a triangle');
});

test('OWN-WORK4 painter: the rim is drawn toward the dark, `space` places shapes in the shape shown, and our letters are 5 x 7', () => {
  const p = createPainter(5, 5);
  p.fill(rect(0, 0, 5, 5), [200, 200, 200]);
  p.outline({ dark: [0, 0, 0], keep: 0.5 });
  assert.deepEqual(at(p, 0, 2), [100, 100, 100, 255], 'the picture\'s edge is a rim');
  assert.deepEqual(at(p, 2, 2), [200, 200, 200, 255], 'the inside keeps its colour');
  const q = createPainter(5, 5);
  q.fill(rect(0, 0, 5, 5), [200, 200, 200]);
  q.outline({ dark: [0, 0, 0], keep: 0.5, edges: false });
  assert.deepEqual(at(q, 0, 2), [200, 200, 200, 255], 'edges: false - only a clear neighbour makes a rim');
  const s = createPainter(4, 4, { space: [8, 4] });
  s.fill(rect(0, 0, 4, 4), [1, 2, 3]);
  assert.deepEqual([at(s, 1, 0)[3], at(s, 2, 0)[3]], [255, 0], 'four units wide in an eight-unit space: half the picture');
  assert.equal(textWidth('MAP'), 17);
  assert.equal(textWidth('x'), 3);
  for (const [ch, g] of Object.entries(PAINTED_LETTERS)) if (ch !== ' ') assert.equal(g.length, 7, `${ch}: seven rows`);
  const t = createPainter(7, 8);
  t.text('I', 0, 0, [255, 0, 0], { shadow: [0, 0, 255] });
  assert.deepEqual([at(t, 1, 3), at(t, 2, 4)], [[255, 0, 0, 255], [0, 0, 255, 255]], 'the letter, its shadow one down and right');
});

// Every recipe's [width, height, print]. The sizes are the retired release's; the prints are ours.
const PICTURES = Object.freeze({
  'foraging 11600': [64, 64, 'd40e992193216009'], 'foraging 11601': [64, 64, '6151829368e6898c'],
  'foraging 11602': [64, 64, '9f0a4eebe81cc9ee'], 'foraging 11603': [128, 128, '98cb59ade44bc6d4'],
  'foraging 11604': [64, 64, '8b4a9f36cf6367a1'], 'foraging 11605': [64, 64, '8ca0e6a69ada88a3'],
  'foraging 11606': [64, 64, '4d91125d3b61d0c0'],
  'torch 112359_0-0': [90, 205, 'bd8efca6644ab2f8'], 'torch 112359_0-1': [90, 205, 'b3907e3df34d6367'],
  'torch 112359_0-2': [90, 205, 'c6f3532a16528f29'], 'torch 112359_0-3': [90, 205, '791110df3799f3a6'],
  'torch 112359_1-0': [110, 138, 'f317f7ce846a4e5b'], 'torch 112359_1-1': [110, 138, '0b5fab86266aca63'],
  'torch 112359_1-2': [110, 138, '04c178dac2b51be8'], 'torch 112359_1-3': [110, 138, 'b63e5de3265e3f33'],
  'torch 112358_0-0': [31, 34, '8065436dcac2e516'], 'torch 112358_0-1': [31, 34, '64053dc8ba1498f4'],
  'torch 112358_0-2': [31, 34, '83921b0b66bf9ae8'], 'torch 112358_0-3': [31, 34, 'f6cbf8b54e33dd04'],
  'torch 112358_0-0_Emission': [31, 34, '8065436dcac2e516'], 'torch 112358_0-1_Emission': [31, 34, '64053dc8ba1498f4'],
  'torch 112358_0-2_Emission': [31, 34, '83921b0b66bf9ae8'], 'torch 112358_0-3_Emission': [31, 34, 'f6cbf8b54e33dd04'],
  'torch 112358_10-0': [31, 34, 'a55210146c57ffb3'],
  'fish longnose_butterflyfish': [64, 64, '0e60d9621d17872f'], 'fish largemouth_bass': [64, 32, '2d3dc3f34b787a92'],
  'fish canary_rockfish': [32, 16, 'f9ea07b3ec036518'], 'fish crucian_carp': [32, 32, '3c95b259d5330e3f'],
  'fish mackerel': [32, 16, '3684dc5cd8e56e93'], 'fish white_zebra_angelfish': [32, 64, 'b5f2dcb66c379f04'],
  'fish finulon': [32, 32, '3e43b3457caf97f0'],
  'travel TOcontrolUI': [320, 27, '2630f9223dcadec3'], 'travel TOportsOff': [45, 11, '165efd4f22a9c01b'],
  'travel TOportsOn': [45, 11, '38cb9d7a2e82d409'],
  'survival 538_2-0': [47, 24, '5d1a2b6d7c75adda'], 'survival 539_0-0': [23, 26, 'b9440e83bc15be03'],
  'button 21': [32, 16, 'd377582744dda0b4'],
});
const recipes = () => [
  ...Object.entries(FORAGING_ART).map(([k, f]) => [`foraging ${k}`, f]),
  ...Object.entries(TORCH_ART).map(([k, f]) => [`torch ${k}`, f]),
  ...Object.entries(FISH_ART).map(([k, f]) => [`fish ${k}`, f]),
  ...Object.entries(TRAVEL_ART).map(([k, f]) => [`travel ${k}`, f]),
  ...Object.entries(SURVIVAL_ART).map(([k, f]) => [`survival ${k}`, f]),
  ['button 21', rrWeekButtonPicture],
];

test('OWN-WORK4: every picture is a recipe of ours, at the release\'s size, its print pinned, the same twice, opaque or clear and nothing between', () => {
  const all = recipes();
  assert.deepEqual(all.map(([k]) => k).sort(), Object.keys(PICTURES).sort(), 'one recipe a picture, and every picture pinned');
  // the 52 carried, less the eleven spoiled faces our rot draws over a fresh one; and three that were specs with the
  // authors' pixels as edits: Roleplay & Realism's finer tavern keeper and its week button (the other sixteen relabelled
  // buttons nothing asks for), the mouldy bread (our rot) and the doused candles (our rule) - the coordinator, OWN-WORK4
  assert.equal(all.length, 37, 'OWN-WORK4 AUDIT: less the six keepers, built from the player\'s own people now');
  for (const [k, paint] of all) {
    const p = paint();
    const [w, h, print] = PICTURES[k];
    assert.deepEqual([p.width, p.height], [w, h], `${k}: its size`);
    assert.equal(printOf(p), print, `${k}: its print`);
    assert.equal(printOf(paint()), print, `${k}: one recipe, one picture`);
    let clear = 0, solid = 0;
    for (let i = 3; i < p.data.length; i += 4) if (p.data[i] === 0) clear++; else if (p.data[i] === 255) solid++;
    assert.equal(clear + solid, w * h, `${k}: no half-clear pixel`);
    assert.ok(solid > 0, `${k}: something drawn`);
  }
});

test('OWN-WORK4: the torches keep the release\'s frames - four of the torch, four of the lantern, four on the floor and their twins, one doused', () => {
  const frames = (prefix) => Object.keys(TORCH_ART).filter((n) => n.startsWith(prefix) && !n.endsWith('_Emission')).length;
  assert.deepEqual([frames('112359_0-'), frames('112359_1-'), frames('112358_0-'), frames('112358_10-')], [4, 4, 4, 1]);
  assert.equal(FLAME_FRAMES.length, 4, 'the flame\'s loop is four frames long');
  assert.equal(ANIMATION_TIME, 0.0625, 'played at the release\'s rate');
  const frame = (n) => printOf(TORCH_ART[n]());
  assert.equal(new Set([0, 1, 2, 3].map((f) => frame(`112359_0-${f}`))).size, 4, 'each frame its own flame');
  for (let f = 0; f < 4; f++) assert.equal(frame(`112358_0-${f}_Emission`), frame(`112358_0-${f}`), 'a lit frame\'s twin is the frame');
});

test('OWN-WORK4: the spoiled faces are our rot over the fresh food - mouldy lighter than rotten - and raw meat and the waterskin are painted', async () => {
  assert.deepEqual({ ...MOULDY }, { mix: 0.3, cover: 0.38 });   // A share of the food, not a speck count
  const flat = { width: 12, height: 8, data: new Uint8Array(12 * 8 * 4) };
  for (let i = 0; i < 96; i++) flat.data.set([180, 60, 40, 255], i * 4);
  const mouldy = rotPicture(flat, { seed: 5, ...MOULDY }), rotten = rotPicture(flat, { seed: 5 });
  assert.ok(at(mouldy, 6, 4)[0] > at(rotten, 6, 4)[0], 'the mouldy face keeps more of the fresh colour');
  assert.notEqual(printOf(mouldy), printOf(rotten));
  const asked = [];
  const art = { build: async (spec) => { asked.push(spec.from.join('_')); return { width: 12, height: 8, data: flat.data.slice() }; } };
  for (const [n, spec] of Object.entries(OWN_ICONS)) {
    const p = await ownIconPicture(n, art);
    if (spec.paint) assert.equal(printOf(spec.seed == null ? p : SURVIVAL_ART[spec.paint]()), PICTURES[`survival ${spec.paint}`][2], `${n}: painted`);
    else assert.deepEqual([p.width, p.height], [12, 8], `${n}: over the player's own food`);
  }
  assert.deepEqual([...new Set(asked)].sort(), ['211_10_0', '211_31_0', '211_40_0', '211_9_0', '213_0_0', '213_1_0'], 'the fresh food, each from its own record');
});

test('OWN-WORK4: a candle doused by our rule - the flame above the wax goes clear, a charred wick and a wisp stand in its place, the wax and the holder kept', async () => {
  // a made-up candle: a flame (orange) over two rows of wax (grey), a gold foot
  const W = 5, H = 9, pic = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  const put = (x, y, c) => pic.data.set([...c, 255], (y * W + x) * 4);
  for (const [x, y] of [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]]) put(x, y, [250, 160, 30]);
  for (let y = 4; y < 8; y++) for (let x = 1; x < 4; x++) put(x, y, [200, 200, 205]);
  for (let x = 0; x < 5; x++) put(x, 8, [210, 170, 40]);
  const d = dousedCandle(pic);
  assert.deepEqual(pic.data[(1 * W + 2) * 4], 250, 'the lit picture is not touched');
  assert.deepEqual(at(d, 1, 2), [0, 0, 0, 0], 'the flame goes clear');
  assert.deepEqual(at(d, 2, 3), [...RAMP.black[1], 255], 'the wick, one above the wax');
  assert.deepEqual(at(d, 2, 2), [...RAMP.black[2], 255]);
  assert.deepEqual(at(d, 2, 4), [...RAMP.grey[2], 255], 'the charred wax under it');
  assert.deepEqual(at(d, 2, 0), [...RAMP.grey[3], 255], 'the wisp');
  assert.deepEqual([at(d, 1, 5), at(d, 0, 8)], [[200, 200, 205, 255], [210, 170, 40, 255]], 'the wax and the foot kept');
  // the two the release drew, ours over the player's own lit candle - never a spec, never the release's pixels
  const asked = [];
  const art = { build: async (spec) => { asked.push(spec.from.join('_')); return { ...pic, data: pic.data.slice() }; } };
  for (const n of Object.keys(TORCH_OVER)) assert.deepEqual([...(await torchPicture(n, { art })).data], [...d.data], n);
  assert.deepEqual(asked, ['210_3_0', '210_4_0'], 'the candle, record 3; the holy candle, record 4');
});

const ARENA2 = process.env.ARENA2_PATH;
const ICONS = Object.freeze({
  '532_0-0': [17, 13, '6264fc9abe60abe0'], '532_1-0': [17, 13, 'fcdedad732357ea9'], '533_0-0': [16, 13, '40f4b74853de446f'],
  '533_1-0': [16, 13, 'e5fd8e744e13e205'], '534_0-0': [34, 27, 'a74fb3e995f9eb9c'], '534_1-0': [34, 27, '20f981050395e130'], '535_0-0': [22, 11, 'c0ebf8fa8c1397b6'],
  '535_1-0': [22, 11, '2b3d9f3f385a0e43'], '536_0-0': [29, 11, '6b6bc8413dba55f6'], '536_1-0': [29, 11, 'c1e6fa54cd05e458'], '537_0-0': [29, 24, '498c5d12bb9b9b4d'],
  '537_1-0': [29, 24, '0349801ec3d25472'], '538_0-0': [47, 24, '42d9ce5e25feacc1'], '538_1-0': [47, 24, '93925068dee16537'],
  '538_2-0': [47, 24, '5d1a2b6d7c75adda'], '539_0-0': [23, 26, 'b9440e83bc15be03'],
});

test('OWN-WORK4 (ARENA2): our sixteen survival pictures over the player\'s own food, and the two doused candles over the lit - each its size (the classic record\'s) and its print', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  assert.deepEqual(Object.keys(OWN_ICONS).sort(), Object.keys(ICONS).sort());
  for (const [n, [w, h, print]] of Object.entries(ICONS)) {
    const p = await ownIconPicture(n, art);
    assert.deepEqual([p.width, p.height, printOf(p)], [w, h, print], n);
  }
  const DOUSED = { '112358_11-0': [9, 19, 'b914d5adc9e30680'], '112358_12-0': [15, 21, '275a3d8dc9bd599f'] };
  for (const [n, [w, h, print]] of Object.entries(DOUSED)) {
    const p = await torchPicture(n, { art });
    assert.deepEqual([p.width, p.height, printOf(p)], [w, h, print], n);
  }
});

test('OWN-WORK4: no picture is read from a file, and the six folders are gone', () => {
  const ART = ['src/art/ownPainter.js', 'src/systems/foraging/foragingArt.js', 'src/systems/handheldTorchesArt.js', 'src/systems/deepWater/fishArt.js',
    'src/ui/travel/travelArt.js', 'src/systems/survival/survivalArt.js', 'src/systems/roleplayRealism/rrKeeperArt.js'];
  for (const f of ART) assert.doesNotMatch(read(f), /fetch\(|readFile|import\.meta\.glob|\.png['`]|^import .* from '(?!\.\.?\/(?:\.\.\/)*art\/ownPainter\.js)/m, `${f}: paints, reads nothing`);
  for (const d of ['vendor/climates-calories', 'vendor/foraging', 'vendor/travel-options', 'vendor/iliac-puddle-no-more', 'vendor/roleplay-realism', 'vendor/handheld-torches', 'public/art/roleplay-realism']) {
    assert.equal(existsSync(join(root, d)), false, `${d} is retired`);
  }
  const loaders = ['src/systems/survival/itemIcons.js', 'src/systems/foraging/foragingInstall.js', 'src/systems/handheldTorches.js', 'src/scenes/droppedTorches.js',
    'src/systems/deepWater/deepWatersFishItems.js', 'src/scenes/deepWater/deepWatersFish.js', 'src/systems/roleplayRealism/rrVariants.js',
    'src/ui/travel/travelControlUI.js', 'src/ui/travel/travelMapWindow.js'];
  for (const f of loaders) assert.doesNotMatch(read(f), /vendor\/(climates-calories|foraging|travel-options|iliac-puddle-no-more|roleplay-realism\/|handheld-torches)|art\/roleplay-realism['/]/, `${f} names no retired folder`);
});
