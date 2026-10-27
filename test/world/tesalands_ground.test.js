// TESA-LANDS (bible/03-World/Tamriel-Lands.md) - THE LANDS PAST THE BAY: the ground's dress (world/tamriel/groundDress.js),
// the zones' table (world/tamriel/tamrielLands.js) and the ground sets' door to a dressed set (scenes/groundSets.js,
// scenes/pixelBuild.js). Synthetic sets: no ARENA2 is read here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DRESS_CLASSES, CLASS_RECORDS, DRESS_DIALS, DRESS_BAND, compileDress, setPrototypes, dressRecord, dressLayers, dressLayersSteps,
  boxBlur, setExposure, rampFor, fleckDraw, hexRgb,
} from '../../src/world/tamriel/groundDress.js';
import {
  LANDS, LANDS_VERSION, FOREST_QUANTILES, forestQuantile, landKeyAt, landGroundSet, groundSetKey, parseGroundSetKey, landsNine,
} from '../../src/world/tamriel/tamrielLands.js';
import { BIOMES, tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { LAND_KINDS } from '../../src/world/lands/landPropMesh.js';
import { LAND_LOOKS } from '../../src/world/lands/landProps.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** A tile of `w` x `w` texels painted by `fn(x, y)` -> [r, g, b] (alpha 255, or `a`). */
function tile(w, fn, a = 255) {
  const colors = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const c = fn(x, y), o = (y * w + x) * 4; colors[o] = c[0]; colors[o + 1] = c[1]; colors[o + 2] = c[2]; colors[o + 3] = c[3] ?? a; }
  return { width: w, height: w, colors };
}
const noise = (x, y, s) => ((Math.imul(x * 73856093 ^ y * 19349663, s | 1) >>> 0) % 21) - 10;
/** A ground set of 56 records: water blue, dirt brown, grass green, stone grey (each with a grain), paving, a dirt/grass
 *  transition at 10 (its left half dirt), the rest grass. */
function synthSet(w = 32) {
  const water = (x, y) => [40 + noise(x, y, 3), 70 + noise(x, y, 5), 150 + noise(x, y, 7), 200];
  const dirt = (x, y) => [120 + noise(x, y, 11), 90 + noise(x, y, 13), 60 + noise(x, y, 17)];
  const grass = (x, y) => [60 + noise(x, y, 19), 130 + noise(x, y, 23), 50 + noise(x, y, 29)];
  const stone = (x, y) => [128 + noise(x, y, 31), 128 + noise(x, y, 37), 128 + noise(x, y, 41)];
  const paving = (x, y) => [170 + noise(x, y, 43), 160 + noise(x, y, 47), 150 + noise(x, y, 53)];
  const set = [];
  for (let r = 0; r < 56; r++) {
    const f = r === 0 ? water : r === 1 ? dirt : r === 3 ? stone : r === 46 ? paving : r === 10 ? (x, y) => (x < w / 2 ? dirt(x, y) : grass(x, y)) : grass;
    set.push(tile(w, f));
  }
  return set;
}
const DRESS = Object.freeze({
  dirt: { ramp: ['#202020', '#404040', '#606060', '#808080'] },   // a grey dirt (ash)
  grass: { ramp: ['#402010', '#804020', '#c06030', '#ff8040'] },   // an orange grass
  stone: { ramp: ['#000040', '#000080', '#0000c0', '#0000ff'] },
});
const meanOf = (l) => { let r = 0, g = 0, b = 0; const n = l.colors.length / 4; for (let k = 0; k < n; k++) { r += l.colors[k * 4]; g += l.colors[k * 4 + 1]; b += l.colors[k * 4 + 2]; } return [r / n, g / n, b / n]; };

test('TESA-LANDS THE DRESS COMPILED: water and the paving never dressed, a material\'s ramp read at RAMP_STEPS and made monotone, its colours made vivid off their own grey, a fleck only where its share is (mutants: the water dressed; the ramp not monotone; vivid off)', () => {
  assert.deepEqual(DRESS_CLASSES, ['water', 'dirt', 'grass', 'stone', 'paving']);
  assert.deepEqual(CLASS_RECORDS, [0, 1, 2, 3, 46]);
  const m = compileDress({ ...DRESS, water: { ramp: ['#ff0000', '#ff0000'] }, paving: { ramp: ['#ff0000', '#ff0000'] }, grass: { ...DRESS.grass, fleck: { colors: ['#ffffff'], share: 0.1 } } });
  assert.equal(m[0], null, 'water never'); assert.equal(m[4], null, 'the paving never');
  for (const c of [1, 2, 3]) {
    assert.ok(m[c], DRESS_CLASSES[c]);
    for (let i = 1; i < m[c].lum.length; i++) assert.ok(m[c].lum[i] >= m[c].lum[i - 1], 'monotone');
  }
  // vivid: a stop's colour moved off its own luminance by DRESS_DIALS.vivid
  const s = m[2].stops[2], g = lum(...hexRgb('#c06030'));
  assert.ok(Math.abs((s[0] - g) - (0xc0 - g) * DRESS_DIALS.vivid) < 1e-9);
  assert.ok(m[2].fleck && !m[1].fleck, 'a fleck where its share is');
  const odd = compileDress({ grass: { ramp: ['#000000', '#ffffff', '#000000'] } })[2];
  for (let i = 1; i < odd.lum.length; i++) assert.ok(odd.lum[i] >= odd.lum[i - 1], 'a ramp that dips made monotone');
  assert.equal(compileDress({ grass: { ramp: ['#000000', '#ffffff'], fleck: { colors: ['#fff'], share: 0 } } })[2].fleck, null, 'a share of none is none');
});

test('TESA-LANDS A RECORD DRESSED: a solid record its own class whole - its grain kept in proportion (a lighter texel stays lighter), its mean at its ramp\'s middle laid at the albedo, its alpha copied; water and the paving the set\'s own; a transition each side its own class (mutants: the contrast reversed; the albedo dropped; the alpha lost; the paving dressed; a transition one class)', () => {
  const set = synthSet(), protos = setPrototypes(set), mats = compileDress(DRESS);
  // the grass record: orange now, in the ramp's colours (red over green), its grain's order kept
  const out = dressRecord(set[2], 2, mats, protos);
  const [r, g] = meanOf(out);
  assert.ok(r > g * 1.3, `the grass is the ramp's orange (${r.toFixed(0)}, ${g.toFixed(0)})`);
  let ordered = 0, pairs = 0;
  for (let k = 1; k < 32 * 32; k++) {
    const a = lum(set[2].colors[(k - 1) * 4], set[2].colors[(k - 1) * 4 + 1], set[2].colors[(k - 1) * 4 + 2]), b = lum(set[2].colors[k * 4], set[2].colors[k * 4 + 1], set[2].colors[k * 4 + 2]);
    if (Math.abs(a - b) < 6) continue;
    pairs++;
    const A = lum(out.colors[(k - 1) * 4], out.colors[(k - 1) * 4 + 1], out.colors[(k - 1) * 4 + 2]), B = lum(out.colors[k * 4], out.colors[k * 4 + 1], out.colors[k * 4 + 2]);
    if ((a < b) === (A < B)) ordered++;
  }
  assert.ok(pairs > 50 && ordered / pairs > 0.9, `the set's grain, its order kept (${ordered}/${pairs})`);
  // its mean luminance the ramp's middle at the albedo (the texels about the class's mean read about the middle)
  const mid = mats[2].mid, L = lum(...meanOf(out));
  assert.ok(Math.abs(L - mid * DRESS_DIALS.albedo) < mid * 0.12, `at the ramp's middle, lit at the albedo (${L.toFixed(1)} against ${(mid * DRESS_DIALS.albedo).toFixed(1)})`);
  const brighter = dressRecord(set[2], 2, mats, protos, 1);
  assert.ok(lum(...meanOf(brighter)) > L * 1.3, 'the light it is laid at is its share');
  // alpha whole; water and paving the very layers
  const wet = tile(8, () => [60, 130, 50, 77]);
  assert.ok(dressRecord(wet, 2, mats, setPrototypes(set)).colors.every((v, i) => i % 4 !== 3 || v === 77), 'the alpha copied');
  assert.equal(dressRecord(set[0], 0, mats, protos), set[0], 'water the set\'s own');
  assert.equal(dressRecord(set[46], 46, mats, protos), set[46], 'the paving the set\'s own');
  // the transition: the dirt half grey (the ash), the grass half orange
  const t = dressRecord(set[10], 10, mats, protos), at = (x, y) => Array.from(t.colors.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 3));
  const left = at(4, 16), right = at(28, 16);
  assert.ok(Math.abs(left[0] - left[1]) < 18 && Math.abs(left[1] - left[2]) < 18, `the dirt side grey (${left})`);
  assert.ok(right[0] > right[1] * 1.3, `the grass side orange (${right})`);
});

test('TESA-LANDS THE DRESS A STEP AT A TIME: dressLayersSteps answers dressLayers\' layers, its steps a band of DRESS_BAND rows (a 256-texel record\'s), never a record whole; the blur a running sum the box\'s own (mutants: the band a record; the blur\'s window off by one)', () => {
  const set = synthSet(64), whole = dressLayers(set, DRESS);
  const it = dressLayersSteps(set, DRESS);
  let steps = 0, r;
  while (!(r = it.next()).done) steps++;
  assert.equal(r.value.length, 56);
  r.value.forEach((l, i) => assert.deepEqual(Array.from(l.colors), Array.from(whole[i].colors), `record ${i}`));
  // a 64-texel record's 64 rows are one band (DRESS_BAND * 256 / 64 rows a step): a breath a record at the least, and a
  // transition's shares their own (its texels' and each class's blur)
  assert.ok(steps >= 56 + 3, `a breath a record, and the transition's shares (${steps})`);
  const big = [tile(256, () => [120, 90, 60]), tile(256, () => [60, 130, 50]), tile(256, () => [60, 130, 50])];
  const bit = dressLayersSteps(big, DRESS);
  let n = 0;
  while (!bit.next().done) n++;
  assert.ok(n >= 256 / DRESS_BAND + 1, `a 256-texel record in bands (${n} steps)`);
  // the running sum against the box itself
  const w = 9, h = 7, a = Float32Array.from({ length: w * h }, (_, i) => (i * 37) % 11), want = new Float32Array(w * h), R = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let d = -R; d <= R; d++) s += a[y * w + Math.min(w - 1, Math.max(0, x + d))];
    want[y * w + x] = s / (2 * R + 1);
  }
  const tmp = new Float32Array(w * h), col = Float32Array.from(want);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    let s = 0;
    for (let d = -R; d <= R; d++) s += want[Math.min(h - 1, Math.max(0, y + d)) * w + x];
    col[y * w + x] = s / (2 * R + 1);
  }
  boxBlur(a, w, h, R, tmp);
  a.forEach((v, i) => assert.ok(Math.abs(v - col[i]) < 1e-5, `texel ${i}`));
});

test('TESA-LANDS THE EXPOSURE AND THE RAMP\'S READING: a set against itself is 1, against a darker classic its land\'s ratio; a luminance past a ramp\'s end is its end colour scaled within the reach; the flecks\' hash the same everywhere (mutants: the exposure inverted; the reach unclamped)', () => {
  const set = synthSet();
  assert.equal(setExposure(set, set), 1);
  const dim = set.map((l) => ({ ...l, colors: l.colors.map((v, i) => (i % 4 === 3 ? v : v >> 1)) }));
  const e = setExposure(set, dim);
  assert.ok(e > 1.9 && e < 2.1, `twice as bright (${e})`);
  assert.equal(setExposure(set, null), 1);
  const m = compileDress(DRESS)[2];
  assert.equal(rampFor(m.lum, 1e6).t, 1); assert.equal(rampFor(m.lum, 1e6).k, DRESS_DIALS.reach[1]);
  assert.equal(rampFor(m.lum, 0).k, DRESS_DIALS.reach[0]);
  const mid = rampFor(m.lum, m.mid);
  assert.ok(Math.abs(mid.t - 0.5) < 0.02 && mid.k === 1);
  assert.equal(fleckDraw(3, 4, 2, 7), fleckDraw(3, 4, 2, 7));
  assert.notEqual(fleckDraw(3, 4, 2, 7), fleckDraw(4, 3, 2, 7));
});

/** The zones the table owes: every zone past the Bay but Cyrodiil's, Valenwood's and Blackwood's (TESA-BIOME's choice -
 *  one country with Cyrodiil's across the border). */
const OWED = BIOMES.filter((b) => b.province !== 'Imperial' && b.province !== 'Valenwood' && b.key !== 'blackMarshGloomire').map((b) => b.key).sort();
const HEX = /^#[0-9a-f]{6}$/i;

test('TESA-LANDS THE TABLE: every zone of the seven provinces named once (none of Cyrodiil, Valenwood or Blackwood), each its ground (three materials dark to light, four stops of hex), its blades, its recipe\'s picks Daggerfall\'s own (a nature archive\'s record 1-31), its landmarks (one entry a kind, each look the kind\'s) and its lore; frozen whole (mutants: a zone dropped; a ramp light to dark; a look of another kind; a table that writes)', () => {
  assert.deepEqual(Object.keys(LANDS).sort(), OWED);
  assert.equal(OWED.length, 33);
  assert.ok(Number.isInteger(LANDS_VERSION) && LANDS_VERSION >= 1);
  for (const [key, land] of Object.entries(LANDS)) {
    assert.ok(typeof land.lore === 'string' && land.lore.length > 20, `${key}'s lore`);
    assert.equal(typeof land.blades, 'boolean', `${key}'s blades`);
    if (land.ground) {
      for (const c of ['dirt', 'grass', 'stone']) {
        const m = land.ground[c];
        assert.ok(m && m.ramp.length >= 3 && m.ramp.every((h) => HEX.test(h)), `${key}.${c}`);
        const L = m.ramp.map((h) => lum(...hexRgb(h)));
        for (let i = 1; i < L.length; i++) assert.ok(L[i] > L[i - 1], `${key}.${c} dark to light`);
        if (m.fleck) assert.ok(m.fleck.share > 0 && m.fleck.share < 0.1 && m.fleck.colors.every((h) => HEX.test(h)), `${key}.${c}'s flecks`);
      }
      if (land.ground.base != null) assert.equal(land.ground.base % 100, 2, `${key}'s base a summer set`);
    }
    if (land.flora) {
      const f = land.flora;
      assert.ok(f.woods >= 0 && f.woods < 1, `${key}'s woods`);
      for (const [a, r, w] of [...f.trees, ...f.cover]) assert.ok(a >= 500 && a <= 510 && r >= 1 && r <= 31 && w > 0, `${key}'s pick ${a}:${r}`);
      assert.ok(f.trees.length + f.cover.length > 0);
      assert.ok(![...f.trees, ...f.cover].some(([a, r]) => a === 510 && r === 24), `${key}: the grey dead tree is 504:24 (Low Poly Trees stands 510:24 as a pine)`);
    }
    const kinds = land.props.map((p) => p.kind);
    assert.equal(new Set(kinds).size, kinds.length, `${key}: one entry a kind`);
    for (const p of land.props) {
      assert.ok(LAND_KINDS.includes(p.kind), `${key}: ${p.kind}`);
      assert.ok(p.rate > 0 && p.rate <= 1 && ['woods', 'plains', 'any', 'wet'].includes(p.where), `${key}: ${p.kind}'s rate and where`);
      for (const l of p.looks) assert.equal(/** @type {any} */ (LAND_LOOKS)[l]?.kind, p.kind, `${key}: the look ${l} is a ${p.kind}`);
    }
  }
  assert.ok(Object.isFrozen(LANDS) && Object.isFrozen(LANDS.morrowindAshlands.ground.grass.ramp) && Object.isFrozen(LANDS.morrowindAshlands.props[0]));
  // the lands the owner named stand as the lore paints them: ash with no blades, the Alik'r's own sands, Summerset's grass
  assert.equal(LANDS.morrowindAshlands.blades, false);
  assert.equal(LANDS.hammerfellAlikr.ground, null, 'the Alik\'r keeps the Sands of the Alik\'r');
  assert.equal(LANDS.summersetVineCoast.ground.base, 302, 'the Vine Coast is grass, not the desert\'s sand');
});

test('TESA-LANDS A PIXEL\'S GROUND SET: past the Bay a summer set its zone\'s dress (its base where it names one), a winter set and a Bay pixel and a zone with no dress their own; the key read back; the 3x3 of lands the zone\'s own at its middle (mutants: a winter dressed; the base ignored; the key unread)', () => {
  const f = tamrielFrameInBay(), at = (key) => {
    for (let y = Math.ceil(f.y0); y < f.y0 + f.h; y += 5) for (let x = Math.ceil(f.x0); x < f.x0 + f.w; x += 5) if (tamrielBiomeAt(x, y)?.key === key) return [x, y];
    return null;
  };
  const ash = at('morrowindAshlands'), vine = at('summersetVineCoast'), alikr = at('hammerfellAlikr');
  assert.ok(ash && vine && alikr, 'the zones stand on the continent');
  assert.equal(landKeyAt(...ash), 'morrowindAshlands');
  assert.equal(landGroundSet(...ash, 102), groundSetKey('morrowindAshlands', 102));
  assert.equal(landGroundSet(...ash, 103), 103, 'a winter set is the snow\'s');
  assert.equal(landGroundSet(...ash, 'twin:102'), 'twin:102');
  assert.equal(landGroundSet(...vine, 2), groundSetKey('summersetVineCoast', 302), 'its base in the climate\'s stead');
  assert.equal(landGroundSet(...alikr, 2), 2, 'no dress, its own');
  assert.equal(landGroundSet(100, 100, 302), 302, 'the Bay its own');
  assert.deepEqual(parseGroundSetKey(groundSetKey('morrowindAshlands', 102)), { zone: 'morrowindAshlands', archive: 102 });
  assert.equal(parseGroundSetKey(102), null); assert.equal(parseGroundSetKey('twin:102'), null);
  const nine = landsNine(...ash);
  assert.equal(nine[4].key, 'morrowindAshlands');
  assert.equal(nine[4].flora, LANDS.morrowindAshlands.flora);
  assert.equal(nine[4].props, LANDS.morrowindAshlands.props);
  // the forest field's quantiles: monotone, and read between
  for (let i = 1; i < FOREST_QUANTILES.length; i++) assert.ok(FOREST_QUANTILES[i] > FOREST_QUANTILES[i - 1]);
  assert.equal(forestQuantile(0), FOREST_QUANTILES[0]); assert.equal(forestQuantile(1), FOREST_QUANTILES.at(-1));
  assert.ok(Math.abs(forestQuantile(0.025) - (FOREST_QUANTILES[0] + FOREST_QUANTILES[1]) / 2) < 1e-9);
});

test('TESA-LANDS THE DOORS: the ground sets\' module dresses a zone\'s key a record a breath at the pack\'s exposure and keeps its maps under the key, no blades where the zone grows none; the pixel\'s build names its set and its neighbours\' each its own zone\'s, and stands its landmarks; the Features row and its switch (mutants: the dress unstepped; the blades kept on ash; the neighbours the pixel\'s)', () => {
  const gs = read('src/scenes/groundSets.js');
  assert.match(gs, /const fileOf = \(key\) => parseGroundSetKey\(key\)\?\.archive \?\? key;/);
  assert.match(gs, /const getTexture = \(key\) => archiveTexture\(fileOf\(key\)\);/);
  assert.match(gs, /const own = await groundLayersOf\(fileOf\(groundArchive\), groundTex\);/);
  assert.match(gs, /own\.layers = await stepsBreathing\(dressLayersSteps\(own\.layers, dress, own\.modLayers \? setExposure\(own\.modLayers, classicOf\(groundTex\)\) : 1\), breathe\);\n\s+own\.modLayers = own\.layers;/);
  assert.match(gs, /else if \(dress\) groundDrawnMeans\.set\(groundArchive, own\.layers\.map\(tileMeanColour\)\);/);
  assert.match(gs, /if \(landOf\(groundArchive\)\?\.blades === false\) grassRecords\.set\(groundArchive, new Set\(\)\);/);
  const pb = read('src/scenes/pixelBuild.js');
  assert.match(pb, /const lands = tamrielLandsOn\(\);/);
  assert.match(pb, /const groundArchive = landSetOf\(px, py, snowCover \?/);
  assert.match(pb, /return climateNeighbourIn\(px, py, x, y\) \? landSetOf\(x, y, archive\) : landSetOf\(px, py, archive\);/);
  assert.match(pb, /near\.map\(\(c, k\) => neighbourSet\(px, py, k,/);
  const sh = read('src/systems/landsSwitch.js');
  assert.match(sh, /if \(pageParam\('lands', search\) === 'off' && !isOnlinePage\(search\)\) return false;/);
  assert.match(sh, /const row = onlineForcedPref\('tamrielLands', search\) \?\? getPref\('tamrielLands'\);\n\s+return !!row && \(isOnlinePage\(search\) \|\| isEnhanced\(search\)\);/);
  assert.match(read('src/scenes/shared.js'), /export \{ tamrielLandsOn \} from '\.\.\/systems\/landsSwitch\.js';/);
  const feats = read('src/systems/features.js');
  assert.match(feats, /id: 'tamriel-lands'/);
  assert.match(feats, /control: Object\.freeze\(\{ store: 'prefs', key: 'tamrielLands', initial: true, online: true \}\)/);
});
