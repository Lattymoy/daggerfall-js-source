// OWN-WORK4 (2026-10-31, the owner: "Our goal is no latching onto other mod authors or needing permissions. A proper 1
// to 1 recreation for everything.") - THE TEXTURE PACKS, OUR OWN. Vanilla Enhanced, Sands of the Alik'r and Snowfall's
// winter ground are retired with their directories; each picture is built at runtime from the player's own classic
// record under our rule (src/systems/ownTextures/ownTextureRules.js), and the snow's masks and albedo are ours too.
// Here: each rule's own law on made-up pictures (no picture of Daggerfall's or of an author's is in a pin), the specs a
// pack's names resolve to, the masks, and - with ARENA2 - the rules over the player's real records.
// bible/07-Rendering/Vanilla-Enhanced.md, Sands-Of-The-Alikr.md and bible/03-World/Snowfall.md are the records; the
// mutants are tools/mutants/ownwork4_textures.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as R from '../../src/systems/ownTextures/ownTextureRules.js';
import { OWN_TEXTURE_PACKS, ownSpec, ownSliceSpecs, ownSnowMasks, specKey } from '../../src/systems/ownTextures/ownTexturePacks.js';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { SNOW_MASK_ARCHIVES, SnowCoverage } from '../../src/systems/snowfall.js';
import { MASKS, madeUpWinterRecord } from '../snowMasks.mjs';

const H = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const luma = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
/** A made-up picture: `paint(x, y)` answers its [r, g, b, a]. */
const made = (w, h, paint) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};
const tile = made(8, 8, (x, y) => [(x * 37 + y * 11) & 255, (x * 5 + y * 41) & 255, (x * 23 + y * 7) & 255, 255]);
const sprite = made(8, 8, (x, y) => ((x - 3.5) ** 2 + (y - 3.5) ** 2 < 9 ? [60 + x * 20, 120, 40 + y * 18, 255] : [0, 0, 0, 0]));
const TAN = [176, 130, 80, 255],
  WATER = [40, 80, 150, 255],
  GRASS = [60, 110, 50, 255];
const shore = made(16, 16, (x) => (x < 8 ? TAN.map((c, k) => (k < 3 ? c + (x % 3) * 6 : c)) : WATER));
const ROOT = new URL('../../', import.meta.url);

test('OWN-WORK4 the edge-aware upscale: a cubic clamped to the four source texels nearest each output texel - no halo past an edge; a cutout stays a cutout; smaller is a box filter (mutants: the clamp dropped; the alpha left soft)', () => {
  const up = R.upscaleEdgeAware(tile, 32, 32, true);
  assert.deepEqual([up.width, up.height], [32, 32]);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const fx = ((x + 0.5) * 8) / 32 - 0.5,
        fy = ((y + 0.5) * 8) / 32 - 0.5;
      const i0 = Math.floor(fx),
        j0 = Math.floor(fy);
      for (let c = 0; c < 3; c++) {
        const near = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => tile.data[((((j0 + dy) % 8) + 8) % 8 * 8 + ((((i0 + dx) % 8) + 8) % 8)) * 4 + c]);
        const v = up.data[(y * 32 + x) * 4 + c];
        assert.ok(v >= Math.min(...near) && v <= Math.max(...near), `(${x}, ${y}) channel ${c}: inside its texels' range`);
      }
    }
  const s = R.upscaleEdgeAware(sprite, 32, 32, false);
  assert.ok([...s.data].filter((_, i) => i % 4 === 3).every((a) => a === 0 || a === 255), 'the cutout is hard');
  assert.equal(s.data[3], 0, 'a clear corner stays clear');
  assert.equal(s.data[(16 * 32 + 16) * 4 + 3], 255, 'the middle stays drawn');
  assert.deepEqual([R.upscaleEdgeAware(tile, 4, 4, true).width], [4]);
});

test('OWN-WORK4 the enhanced look: the record at the pack\'s size, sharpened only inside each texel\'s own range, our grain, our grade - one record, one picture, the same on every machine (mutants: the sharpen past its range; the grain unseeded; the grade dropped)', () => {
  const a = R.enhance(tile, 32, 32, { wrap: true, seed: 11 });
  assert.deepEqual([a.width, a.height], [32, 32]);
  assert.equal(H(a.data), H(R.enhance(tile, 32, 32, { wrap: true, seed: 11 }).data), 'deterministic');
  assert.notEqual(H(a.data), H(R.enhance(tile, 32, 32, { wrap: true, seed: 12 }).data), 'the seed is the grain');
  const sp = R.enhance(sprite, 24, 24, { wrap: false, seed: 3 });
  assert.equal(sp.data[3], 0, 'a sprite\'s clear corner');
  // the sharpen: each texel's luma inside its 3 x 3's range of the upscale
  const up = R.upscaleEdgeAware(tile, 32, 32, false);
  const sh = R.sharpenInRange(up, 0.55, false);
  for (let y = 1; y < 31; y++)
    for (let x = 1; x < 31; x++) {
      const around = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) around.push(luma(up.data, ((y + dy) * 32 + x + dx) * 4));
      const l = luma(sh.data, (y * 32 + x) * 4);
      assert.ok(l >= Math.min(...around) - 0.01 && l <= Math.max(...around) + 0.01, `(${x}, ${y})`);
    }
  // the grade: a mid-dark texel darker, a light one lighter, the colour wider
  const g = R.grade(made(2, 1, (x) => (x ? [200, 180, 160, 255] : [70, 60, 50, 255])), { contrast: 0.12, saturation: 1.08 });
  assert.ok(luma(g.data, 0) < luma([70, 60, 50], 0) && luma(g.data, 4) > luma([200, 180, 160], 0));
  assert.deepEqual([H(a.data), H(sp.data)], ['0916320011623063', '01d488cfbd4ab601']);
});

test('OWN-WORK4 the road: the paving\'s own stones raised and lit from the north-west, the ground beside it a worn verge, the rest the enhanced look (mutants: the relief unlit; the verge dropped)', () => {
  // grass, a worn grey verge (a little colour left in it), then the paving's stones
  const paving = made(16, 16, (x, y) => (x + y < 12 ? GRASS : x + y < 17 ? [118, 112, 105, 255] : (x * 7 + y * 3) % 5 === 0 ? [150, 150, 150, 255] : [100, 100, 100, 255]));
  const r = R.road(paving, 64, 64, { seed: 5 });
  const e = R.enhance(paving, 64, 64, { wrap: false, seed: 5 });
  assert.deepEqual([r.width, r.height], [64, 64]);
  let verge = 0, darker = 0;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const t = (x + y) / 4;
      if (t < 13 || t > 16) continue;
      verge++;
      if (luma(r.data, (y * 64 + x) * 4) < luma(e.data, (y * 64 + x) * 4) - 0.01) darker++;
    }
  assert.ok(darker > verge * 0.3, `the verge worn darker (${darker} of ${verge})`);
  for (let y = 0; y < 16; y++) assert.equal(H(r.data.slice(y * 256, y * 256 + 64)), H(e.data.slice(y * 256, y * 256 + 64)), 'the grass far from the road: the enhanced look itself');
  assert.notEqual(H(r.data), H(e.data), 'the paving: ours');
  assert.equal(H(r.data), 'd761b1ee66144315');
});

test('OWN-WORK4 the Alik\'r\'s sand: a desert record at its own size, its tan graded pale and rippled, the water as it was; a pale speck in dark dirt and a road\'s paving left as they were (mutants: the water graded; the sand left dark; the ripple dropped; a speck taken for a dune; the paving paled)', () => {
  const d = R.desert(shore, { seed: 9 });
  assert.deepEqual([d.width, d.height], [16, 16]);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      if (x >= 8) assert.deepEqual([...d.data.slice(i, i + 4)], WATER, `(${x}, ${y}) water`);
      else assert.ok(luma(d.data, i) > luma(shore.data, i) + 0.08, `(${x}, ${y}) paler`);
    }
  const rows = Array.from({ length: 16 }, (_, y) => luma(d.data, (y * 16 + 2) * 4));
  assert.ok(Math.max(...rows) - Math.min(...rows) > 0.02, 'rippled down a column of one tan');
  assert.equal(H(d.data), '104a211646569573');
  // dark dirt with a pale speck every few texels: no dune round it, so the speck is the record's
  const DIRT = [70, 52, 34, 255];
  const dirt = made(16, 16, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? TAN : DIRT));
  const dd = R.desert(dirt, { seed: 9 }).data;
  for (let y = 2; y < 14; y++) assert.deepEqual([...dd.slice((y * 16 + 2) * 4, (y * 16 + 14) * 4)], [...dirt.data.slice((y * 16 + 2) * 4, (y * 16 + 14) * 4)], `row ${y}: the dirt and its specks as they were`);
  // a flank: sand in its upper-left half, a darker paving with pale joints in its lower-right
  const PAVE = [130, 95, 60, 255];
  const flank = made(16, 16, (x, y) => (x + y < 15 ? (x > 1 && x < 6 && y > 1 && y < 6 ? PAVE : TAN) : x % 6 === 0 || y % 6 === 0 ? [190, 150, 100, 255] : PAVE));
  const f = R.desert(flank, { seed: 9, road: 'flank' });
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      if (x + y >= 20) assert.deepEqual([...f.data.slice(i, i + 4)], [...flank.data.slice(i, i + 4)], `(${x}, ${y}) the paving`);
      if (x + y <= 10) assert.ok(luma(f.data, i) > luma(flank.data, i) + 0.05, `(${x}, ${y}) the sand paled, a dark mottle on the sand's half too`);
    }
  const at = (14 * 16 + 12) * 4;
  assert.notDeepEqual([...R.desert(flank, { seed: 9 }).data.slice(at, at + 3)], [...flank.data.slice(at, at + 3)], 'no road: a pale joint is sand');
});

test('OWN-WORK4 our snow law: on a winter record the lying snow made a cold, shaded white and crept over the flat ground beside it, the water left; on a summer record laid over all but the water; the record\'s own grain kept in the snow (mutants: the water snowed on; the summer left bare; the snow left warm; the grain dropped)', () => {
  const winter = made(16, 16, (x) => (x < 6 ? [214, 214, 222, 255] : x < 10 ? [110, 104, 96, 255] : WATER));
  const w = R.snow(winter, { seed: 2 });
  for (let y = 0; y < 16; y++) {
    const i = (y * 16 + 2) * 4;
    assert.ok(w.data[i + 2] >= w.data[i] && luma(w.data, i) > 0.8, 'the snow: white, and cold');
    assert.deepEqual([...w.data.slice((y * 16 + 13) * 4, (y * 16 + 13) * 4 + 4)], WATER, 'the water as it was');
  }
  assert.ok(luma(w.data, (8 * 16 + 6) * 4) > luma(winter.data, (8 * 16 + 6) * 4), 'the bare ground at the snow\'s edge takes some');
  const summer = made(16, 16, (x) => (x < 10 ? GRASS : WATER));
  const s = R.snow(summer, { seed: 2, fromSummer: true });
  assert.ok(luma(s.data, (8 * 16 + 3) * 4) > 0.8, 'the summer grass under snow');
  assert.deepEqual([...s.data.slice((8 * 16 + 13) * 4, (8 * 16 + 13) * 4 + 4)], WATER);
  // a speckled snow record: its speckle is still there under our snow, at half its strength
  const speckled = made(16, 16, (x, y) => ((x * 7 + y * 3) % 5 === 0 ? [196, 198, 206, 255] : [226, 228, 236, 255]));
  const sp = R.snow(speckled, { seed: 2 });
  const lum = (d) => Array.from({ length: 256 }, (_, i) => luma(d, i * 4));
  const spread = (a) => Math.sqrt(a.reduce((t, v) => t + v * v, 0) / a.length - (a.reduce((t, v) => t + v, 0) / a.length) ** 2);
  assert.ok(spread(lum(sp.data)) > 0.25 * spread(lum(speckled.data)), 'the speckle kept');
  assert.ok(spread(lum(sp.data)) < spread(lum(speckled.data)), 'and softened');
  assert.deepEqual([H(w.data), H(s.data)], ['116fe8363c20d46a', '104a181ef2687494']);
});

test('OWN-WORK4 the snow\'s masks: where our law lays snow on a winter record, 0 to 255, in the record\'s own rows (row 0 its top, as SnowCoverage reads them) - water and paving bare, a snow record whole (mutants: the rows flipped; the paving snowed on)', () => {
  const m = (r) => R.snowMask(madeUpWinterRecord(r));
  assert.ok(m(0).every((v) => v === 0), 'record 0: water');
  assert.ok(m(1).every((v) => v === 255), 'record 1: snow, edge to edge');
  assert.ok(m(46).every((v) => v === 0), 'the road: paving');
  const flank = m(47);
  assert.equal(flank[5 * 64 + 40], 0, 'the flank\'s paving at the record\'s top right');
  assert.equal(flank[58 * 64 + 5], 255, 'its snow at the bottom left');
  assert.equal(flank[58 * 64 + 40], 255, 'below the diagonal, snow - the rows not flipped');
  const cov = new SnowCoverage(MASKS);
  assert.equal(cov.isFullySnowCovered(303, 1 << 2), true);
  assert.equal(cov.isFullySnowCovered(303, 46 << 2), false);
  assert.equal(cov.sample(303, 47 << 2, 0.9, 0.9), 0, 'the ground\'s v = 1 is the record\'s top row - the paving');
  assert.equal(cov.sample(303, 47 << 2, 0.1, 0.1), 1, 'and its v = 0 the bottom - the snow');
  assert.ok(Number.isFinite(cov.roadDistance(303, 47 << 2, 0.1, 0.1)), 'a road flank\'s distance from its bare edge');
  assert.equal(H(MASKS[0]), H(MASKS[1]));
  assert.equal(H(MASKS[0]), '62e81a1451754ddb');
});

test('OWN-WORK4 our snow\'s albedo: 64 x 64, opaque, a cold white that repeats - made, never read (mutants: the albedo warm; a clear texel)', () => {
  const a = R.snowAlbedo(64);
  assert.deepEqual([a.width, a.height, a.data.length], [64, 64, 64 * 64 * 4]);
  let sum = 0;
  for (let i = 0; i < 64 * 64; i++) {
    assert.equal(a.data[i * 4 + 3], 255);
    assert.ok(a.data[i * 4 + 2] >= a.data[i * 4], 'cold: no texel redder than it is blue');
    sum += luma(a.data, i * 4);
  }
  assert.ok(sum / 4096 > 0.88, 'white');
  assert.equal(H(a.data), H(R.snowAlbedo(64).data));
  assert.equal(H(a.data), '0bf7743231eda9e9');
  assert.throws(() => R.applyOwnRule({ rule: 'paint', w: 1, h: 1, seed: 0 }, tile), /no own texture rule paint/);
});

test('OWN-WORK4 the specs: each pack\'s name resolves to the classic record our rule reads - the Base\'s records enhanced (a wall wraps, a terrain record and a flat do not), Masked Roads\' road and flanks our road, Snowless Swamps\' winter its summer, Sands\' our desert, Snowfall\'s our snow over the winter record with the summer behind it; an array is its records (mutants: a road record enhanced; the swamp\'s winter snowed; the fallback dropped)', () => {
  const by = (d) => OWN_TEXTURE_PACKS.find((m) => m.dir === d);
  const pick = (d, n) => {
    const s = ownSpec(by(d), n);
    return s && [s.rule, s.from.join('_'), s.w, s.h, s.wrap ?? null, s.fallback?.join('_') ?? null];
  };
  assert.deepEqual(
    [
      pick('base', '302_9-0'), pick('base', '017_1-0'), pick('base', '500_5-0'), pick('masked-roads', '303_46-0'),
      pick('snowless-swamps-and-jungles', '403_7-0'), pick('snowless-swamps-and-jungles', '408_1-0'),
      pick('snowless-swamps-and-jungles', '402_7-0'), pick('sands-of-the-alikr', '002_9-0'), pick('snowfall', '403_12-0'),
      pick('base', '999_0-0'),
    ],
    [
      ['enhance', '302_9_0', 256, 256, false, null], ['enhance', '17_1_0', 128, 128, true, null], ['enhance', '500_5_0', 67, 109, false, null],
      ['road', '303_46_0', 256, 256, null, null], ['enhance', '402_7_0', 256, 256, false, null], ['enhance', '407_1_0', 64, 64, true, null],
      ['enhance', '402_7_0', 256, 256, false, null], ['desert', '2_9_0', 64, 64, null, null], ['snow', '403_12_0', 64, 64, null, '402_12_0'],
      null,
    ],
  );
  assert.deepEqual(['002_46-0', '002_47-0', '002_55-0', '002_9-0'].map((n) => ownSpec(by('sands-of-the-alikr'), n).road), ['full', 'flank', 'flank', undefined], 'the desert\'s road records keep their paving');
  const slices = ownSliceSpecs(by('masked-roads'), '302-TexArray');
  assert.deepEqual(slices.map((s, r) => (s.rule === 'road' ? r : null)).filter((r) => r !== null), [46, 47, 55]);
  assert.equal(ownSliceSpecs(by('masked-roads'), '403-TexArray'), null, '57 deep: no slices');
  assert.equal(specKey(ownSpec(by('snowless-swamps-and-jungles'), '403_7-0')), specKey(ownSpec(by('base'), '402_7-0')), 'the swamp\'s winter IS its summer: one picture');
});

test('OWN-WORK4 the masks the snow host lays: ours over the player\'s winter records, a record the data lacks read from the summer set under our snow, an archive with nothing refused (mutants: the summer fallback dropped; nothing read taken for snow)', async () => {
  const asked = [];
  const masks = await ownSnowMasks(SNOW_MASK_ARCHIVES, async (a, r) => {
    asked.push(`${a}_${r}`);
    if (a === 403 && r === 5) return null;   // no winter record: the summer one
    return a === 402 ? made(64, 64, () => GRASS) : madeUpWinterRecord(r);
  });
  assert.deepEqual(masks.map((m) => m.length), [229376, 229376, 229376]);
  assert.equal(H(masks[0]), H(MASKS[0]), 'the same law the pins stand on');
  assert.ok(asked.includes('402_5'), 'the summer record read');
  assert.ok(masks[2].slice(5 * 4096, 6 * 4096).every((v) => v > 200), 'the summer grass under our snow');
  await assert.rejects(ownSnowMasks([103], async () => null), /TEXTURE\.103: no record/);
  const host = readFileSync(new URL('src/scenes/snowfallHost.js', ROOT), 'utf8');
  assert.match(host, /const defaultMasks = \(\) =>\n\s*ownSnowMasks\(SNOW_MASK_ARCHIVES, \(archive, record\) => classicArt\(\)\.picture\(archive, record, 0\)\);/);
  assert.doesNotMatch(host, /fetch\(/, 'nothing fetched: no file of the mod\'s is served');
});

test('OWN-WORK4 nothing of the retired packs stands: their directories and art are gone, and no source, test or tool names them (mutants: none - the tree\'s own state)', () => {
  const dirs = ['vendor/vanilla-enhanced/', 'public/art/vanilla-enhanced/', 'vendor/sands-of-the-alikr/', 'public/art/sands-of-the-alikr/', 'vendor/snowfall/', 'public/art/snowfall/'];
  const ls = execFileSync('git', ['ls-files', ...dirs], { cwd: new URL('.', ROOT), encoding: 'utf8' });
  assert.equal(ls, '', 'retired');
  for (const d of dirs) assert.equal(existsSync(new URL(d, ROOT)), false, `${d}: not on disk either`);
});

const ARENA2 = process.env.ARENA2_PATH;
test('OWN-WORK4 over the player\'s own records (ARENA2_PATH): the masks of Daggerfall\'s winter sets - its water bare, its snow whole, its road paved bare and its flanks half (the swamp\'s 47 is mud); the Base\'s grass at 256 and sharper than a plain upscale', { skip: !ARENA2 || !existsSync(join(ARENA2 ?? '', 'TEXTURE.303')) ? 'needs ARENA2_PATH (sh tools/fetch-data.sh)' : false }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  const masks = await ownSnowMasks(SNOW_MASK_ARCHIVES, (a, r) => art.picture(a, r, 0));
  const share = (m, r) => m.slice(r * 4096, (r + 1) * 4096).filter((v) => v > 127).length / 4096;
  for (const [i, a] of SNOW_MASK_ARCHIVES.entries()) {
    assert.equal(share(masks[i], 0), 0, `${a}: record 0, the water`);
    assert.ok(share(masks[i], 46) < 0.05, `${a}: the road paved`);
    if (a !== 403) assert.ok(share(masks[i], 47) > 0.3 && share(masks[i], 47) < 0.7, `${a}: a flank half paved`);   // the swamp's 47 is mud under snow
  }
  assert.equal(share(masks[1], 1), 1, 'TEXTURE.303 record 1: snow, edge to edge');
  const base = OWN_TEXTURE_PACKS.find((m) => m.dir === 'base');
  const spec = ownSpec(base, '302_2-0');
  const src = await art.picture(302, 2, 0);
  const ours = R.applyOwnRule(spec, src);
  assert.deepEqual([ours.width, ours.height], [256, 256]);
  assert.notEqual(H(ours.data), H(R.upscaleEdgeAware(src, 256, 256, false).data), 'more than an upscale');
});
