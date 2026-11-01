// THE GROUND'S HUE AND EDGES (bible/07-Rendering/Vanilla-Enhanced.md "The ground"): a classic ground record's stray
// hues - violet in the Alik'r's sand, pink, yellow and teal in the snow - are taken away by our rules, each texel's light
// kept, and an upscale of the ground is crisp at the record's own scale. Made-up records pin the law; with ARENA2 the
// player's own desert and winter records show it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as R from '../../src/systems/ownTextures/ownTextureRules.js';
import { OWN_TEXTURE_PACKS, ownSpec } from '../../src/systems/ownTextures/ownTexturePacks.js';
import { createClassicPictures } from '../../src/formats/classicPictures.js';

const H = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const light = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
const chroma = (d, i) => {
  const l = light(d, i);
  return Math.hypot(d[i] - l, d[i + 1] - l, d[i + 2] - l);
};
/** Violet: blue and red both over green - no sand, dirt, grass, water or snow is. */
const violets = (p) => {
  let n = 0;
  for (let i = 0; i < p.width * p.height; i++) if (p.data[i * 4 + 2] > p.data[i * 4 + 1] + 25 && p.data[i * 4] > p.data[i * 4 + 1] + 10) n++;
  return n;
};
const made = (w, h, paint) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};
/** The mean squared step of the luma between neighbours: how crisp a picture is. */
const crispness = (p) => {
  let sum = 0;
  for (let y = 0; y < p.height - 1; y++)
    for (let x = 0; x < p.width - 1; x++) {
      const i = (y * p.width + x) * 4;
      sum += (light(p.data, i) - light(p.data, i + 4)) ** 2 + (light(p.data, i) - light(p.data, i + p.width * 4)) ** 2;
    }
  return sum / ((p.width - 1) * (p.height - 1));
};
/** A box filter by a whole factor: the mip a renderer reads at the distance where the record's texel is a pixel. */
const boxDown = (p, f) => {
  const w = p.width / f, h = p.height / f, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += p.data[((y * f + dy) * p.width + x * f + dx) * 4 + c];
        data[(y * w + x) * 4 + c] = Math.round(s / (f * f));
      }
  return { width: w, height: h, data };
};

const VIOLET = [150, 104, 172, 255];
// sand of a few tans, a violet texel, a violet pair, and a pale tan speck (the sand's own hue, lighter)
const sand = made(16, 16, (x, y) =>
  (x === 5 && y === 5) || (y === 11 && (x === 10 || x === 11))
    ? VIOLET
    : x === 3 && y === 12
      ? [236, 190, 132, 255]
      : [176 + ((x * 7 + y * 3) % 5) * 4, 130 + ((x * 7 + y * 3) % 5) * 3, 80 + ((x + y) % 3) * 2, 255],
);
// snow with a pink and a yellow speck and a teal sparkle every thirteenth texel, dark ground at its east
const snowy = (x, y) => [214 + ((x * 3 + y * 5) % 4) * 6, 216 + ((x * 3 + y * 5) % 4) * 6, 226 + ((x * 3 + y * 5) % 4) * 5, 255];
const winter = made(16, 16, (x, y) =>
  x === 4 && y === 4
    ? [246, 168, 196, 255]
    : x === 9 && y === 7
      ? [250, 236, 90, 255]
      : x >= 13
        ? [92, 84, 76, 255]
        : (x * 5 + y * 11) % 13 === 0
          ? [176, 226, 240, 255]
          : snowy(x, y),
);

test('the ground\'s hue: a stray violet in the sand takes the sand\'s hue and keeps its light; a pale tan (the sand\'s own hue) and every other texel are as they were (mutants: the stray law dropped; the light not kept; strength counted as hue)', () => {
  const g = R.groundHue(sand);
  const moved = [];
  for (let i = 0; i < 256; i++) if ([0, 1, 2].some((c) => g.data[i * 4 + c] !== sand.data[i * 4 + c])) moved.push(i);
  assert.deepEqual(moved, [5 * 16 + 5, 11 * 16 + 10, 11 * 16 + 11], 'the three violets alone');
  for (const i of moved) {
    assert.ok(Math.abs(light(g.data, i * 4) - light(sand.data, i * 4)) < 1, `texel ${i}: its light kept`);
    assert.ok(g.data[i * 4] > g.data[i * 4 + 1] && g.data[i * 4 + 1] > g.data[i * 4 + 2], `texel ${i}: the sand's warm hue`);
  }
  assert.equal(violets(g), 0);
  assert.deepEqual([...g.data.slice(4 * (12 * 16 + 3), 4 * (12 * 16 + 3) + 4)], [236, 190, 132, 255], 'the pale tan kept');
  assert.equal(H(g.data), '2f978016dcdc0e97');
});

test('the snow\'s grain is light and shade, never hue: on a winter record every snowy texel takes the snow\'s hue - the pink, the yellow and the teal gone - its light kept; the dark ground beside it as it was; off the winter law only a stray hue moves (mutants: the snow law dropped; the snow\'s hue not the mean of its neighbours)', () => {
  const s = R.groundHue(winter, { snow: true });
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      assert.ok(Math.abs(light(s.data, i) - light(winter.data, i)) < 1, `(${x}, ${y}): its light kept`);
      if (x >= 13) assert.deepEqual([...s.data.slice(i, i + 4)], [92, 84, 76, 255], `(${x}, ${y}): the ground as it was`);
      else assert.ok(chroma(s.data, i) < 22, `(${x}, ${y}): the snow's own hue (${chroma(s.data, i).toFixed(1)})`);
    }
  const plain = R.groundHue(winter);
  const teal = (0 * 16 + 0) * 4;
  assert.deepEqual([...plain.data.slice(teal, teal + 3)], [176, 226, 240], 'a teal of a thirteenth of the snow is no stray: kept off the winter law');
  assert.ok(chroma(plain.data, (4 * 16 + 4) * 4) < 20 && chroma(plain.data, (7 * 16 + 9) * 4) < 20, 'the pink and the yellow are strays either way');
  assert.equal(H(s.data), 'bb5bc8e8c648f423');
});

test('the ground enhanced: its stray hues gone, its edges crisp at the record\'s own scale - held inside the four record texels nearest each texel - and a grain down to one texel; a record that is no ground is the enhanced look as it was (mutants: the hue law dropped from enhance; the crisp pass dropped; the crisp pass past its range; the fine grain dropped)', () => {
  const plain = R.enhance(sand, 64, 64, { wrap: false, seed: 4 });
  const ground = R.enhance(sand, 64, 64, { wrap: false, seed: 4, ground: true });
  assert.ok(violets(plain) > 0, 'the plain look keeps the violet');
  assert.equal(violets(ground), 0, 'the ground carries none');
  assert.ok(crispness(boxDown(ground, 4)) > 1.25 * crispness(boxDown(plain, 4)), 'crisper at the record\'s own scale');
  // the crisp pass alone: each texel's luma inside its four nearest record texels', and steeper than the upscale
  const up = R.upscaleEdgeAware(sand, 64, 64, false);
  const crisp = R.crispInRange(up, sand, 1.5, false);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const fx = Math.floor(((x + 0.5) * 16) / 64 - 0.5),
        fy = Math.floor(((y + 0.5) * 16) / 64 - 0.5);
      const near = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => light(sand.data, (Math.min(15, Math.max(0, fy + dy)) * 16 + Math.min(15, Math.max(0, fx + dx))) * 4));
      const l = light(crisp.data, (y * 64 + x) * 4);
      assert.ok(l >= Math.min(...near) - 1 && l <= Math.max(...near) + 1, `(${x}, ${y}): inside its texels' range`);
    }
  assert.ok(crispness(crisp) > 1.2 * crispness(up), 'steeper than the upscale');
  const winterGround = R.enhance(winter, 64, 64, { wrap: false, seed: 4, ground: 'winter' });
  let most = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 48; x++) most = Math.max(most, chroma(winterGround.data, (y * 64 + x) * 4));
  assert.ok(most < 30, `the winter ground's snow without a hue of its own (${most.toFixed(1)})`);
  assert.deepEqual([H(ground.data), H(winterGround.data)], ['a7daf9984ed7c353', '47f961f3ade04fef']);
});

test('the specs say which records are ground: a terrain set\'s, a winter set\'s as winter - the Base, Masked Roads\' road and Snowless Swamps\' summer alike - and no wall or flat; applyOwnRule hands it on (mutants: the ground unsaid; the winter unsaid; applyOwnRule dropping it)', () => {
  const by = (d) => OWN_TEXTURE_PACKS.find((m) => m.dir === d);
  const ground = (d, n) => ownSpec(by(d), n).ground ?? null;
  assert.deepEqual(
    [
      ground('base', '002_9-0'), ground('base', '302_9-0'), ground('base', '103_1-0'), ground('base', '303_1-0'), ground('base', '403_1-0'),
      ground('base', '017_1-0'), ground('base', '500_5-0'), ground('masked-roads', '303_46-0'), ground('snowless-swamps-and-jungles', '403_7-0'),
      ground('sands-of-the-alikr', '002_9-0'),
    ],
    [true, true, 'winter', 'winter', 'winter', null, null, 'winter', true, null],
  );
  const spec = { ...ownSpec(by('base'), '302_9-0'), w: 64, h: 64 };
  assert.equal(H(R.applyOwnRule(spec, sand).data), H(R.enhance(sand, 64, 64, { wrap: false, seed: spec.seed, ground: true }).data));
  const road = { ...ownSpec(by('masked-roads'), '303_46-0'), w: 64, h: 64 };
  assert.equal(H(R.applyOwnRule(road, winter).data), H(R.road(winter, 64, 64, { seed: road.seed, ground: 'winter' }).data));
});

const ARENA2 = process.env.ARENA2_PATH;
test('over the player\'s own records (ARENA2_PATH): the Alik\'r\'s classic sand carries violet, and neither the Base\'s 256-texel sand nor Sands\' does on its sand records; the Base\'s sand is as crisp as the classic where its texel is a pixel; the Base\'s winter snow has no hue of its own', { skip: !ARENA2 || !existsSync(join(ARENA2 ?? '', 'TEXTURE.002')) ? 'needs ARENA2_PATH (sh tools/fetch-data.sh)' : false }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  const base = OWN_TEXTURE_PACKS.find((m) => m.dir === 'base'),
    sands = OWN_TEXTURE_PACKS.find((m) => m.dir === 'sands-of-the-alikr');
  const SAND_RECORDS = [1, 2, 9, 10, 11, 12, 13, 14, 15];
  let classic = 0;
  for (const r of SAND_RECORDS) {
    const src = await art.picture(2, r, 0);
    classic += violets(src);
    const name = `002_${r}-0`;
    assert.equal(violets(R.applyOwnRule(ownSpec(base, name), src)), 0, `the Base's ${name}`);
    assert.equal(violets(R.applyOwnRule(ownSpec(sands, name), src)), 0, `Sands' ${name}`);
  }
  assert.ok(classic > 300, `the classic sand's violet (${classic})`);
  const src = await art.picture(2, 2, 0);
  const ours = R.applyOwnRule(ownSpec(base, '002_2-0'), src);
  assert.ok(crispness(boxDown(ours, 4)) > 0.9 * crispness(src), 'as crisp as the classic at the record\'s own scale');
  const snowRecord = await art.picture(103, 1, 0);
  const snow = R.applyOwnRule(ownSpec(base, '103_1-0'), snowRecord);
  let most = 0;
  for (let i = 0; i < snow.width * snow.height; i++) if (light(snow.data, i * 4) > 170) most = Math.max(most, chroma(snow.data, i * 4));
  assert.ok(most < 30, `the snow's hue is the snow's (${most.toFixed(1)})`);
});
