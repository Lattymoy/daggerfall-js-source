// TESA-LANDS (bible/03-World/Tamriel-Lands.md) - THE LANDS PAST THE BAY: the ground's dress (world/tamriel/groundDress.js),
// the zones' table (world/tamriel/tamrielLands.js) and the ground sets' door to a dressed set (scenes/groundSets.js,
// scenes/pixelBuild.js). Synthetic sets: no ARENA2 is read here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DRESS_CLASSES, CLASS_RECORDS, DRESS_DIALS, DRESS_BAND, compileDress, setPrototypes, dressRecord, dressRecordSteps, dressLayers, dressLayersSteps,
  boxBlur, setExposure, rampFor, fleckDraw, hexRgb,
} from '../../src/world/tamriel/groundDress.js';
import {
  LANDS, FOREST_QUANTILES, forestQuantile, landKeyAt, landGroundSet, groundSetKey, parseGroundSetKey, landsNine, DEAD_TREES,
} from '../../src/world/tamriel/tamrielLands.js';
import { BIOMES, tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { LAND_KINDS } from '../../src/world/lands/landPropMesh.js';
import { LAND_LOOKS } from '../../src/world/lands/landProps.js';
import { dressMessage } from '../../src/world/tamriel/groundDressWorker.js';
import { createDressClient, defaultDressWorker, DRESS_WORKER_DEATHS, DRESS_ANSWER_MS } from '../../src/world/tamriel/groundDressClient.js';
import { createGroundSets } from '../../src/scenes/groundSets.js';
import { createPlaceHolds } from '../../src/scenes/placeHolds.js';
import { setSnowlessGround, winterSetSnowless } from '../../src/world/climateSwaps.js';
import { winterGroundSnowless } from '../../src/systems/dfmodTextures.js';
import { tileMeanColour } from '../../src/render/labGrass.js';

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

test('TESA-LANDS A TRANSITION\'S INSIDE IS ITS CLASS\'S (the second audit, lane C): past the shape\'s soft edge a transition\'s texels wear their solid record\'s dress exactly - a Gaussian half the prototypes\' gap wide gave a texel AT its prototype 12% of the next class, so a transition\'s grass was dressed 88/12 with its dirt where the solid grass beside it was grass whole (mutant: the shares left soft)', () => {
  const w = 64, set = synthSet(w), protos = setPrototypes(set), mats = compileDress(DRESS);
  const t = dressRecord(set[10], 10, mats, protos), dirt = dressRecord(set[10], 1, mats, protos), grass = dressRecord(set[10], 2, mats, protos);
  const r = Math.max(1, Math.round(w * DRESS_DIALS.blur)), margin = r + 3;
  let worst = 0, n = 0, edge = 0;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, solid = x < w / 2 ? dirt : grass;
    const d = Math.max(Math.abs(t.colors[o] - solid.colors[o]), Math.abs(t.colors[o + 1] - solid.colors[o + 1]), Math.abs(t.colors[o + 2] - solid.colors[o + 2]));
    if (Math.abs(x + 0.5 - w / 2) > margin) { worst = Math.max(worst, d); n++; } else if (d > 0) edge++;
  }
  assert.ok(n > w * w * 0.7, `the inside's texels (${n})`);
  assert.ok(worst <= 1, `the inside wears its solid record's dress (worst ${worst} of a channel)`);
  assert.ok(edge > 0, 'the shape\'s edge still blends');
  assert.equal(DRESS_DIALS.crisp, 0.15);
});

test('TESA-LANDS THE DRESS A STEP AT A TIME: dressLayersSteps answers dressLayers\' layers, its steps a band of DRESS_BAND rows (a 256-texel record\'s), never a record whole; the blur a running sum the box\'s own (mutants: the band a record; the shares a record; the blur\'s window off by one)', () => {
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
  // a 256-texel transition: its shares in bands too, then its blurs, then its dress in bands
  const dirt = (x, y) => [120 + (((x * 7 + y * 3) % 5) - 2), 90, 60], grass = (x, y) => [60, 130 + (((x * 5 + y) % 5) - 2), 50];
  const tset = [tile(256, () => [40, 70, 150]), tile(256, dirt), tile(256, grass), tile(256, () => [128, 128, 128])];
  const tr = tile(256, (x, y) => (x < 128 ? dirt(x, y) : grass(x, y))), ts = dressRecordSteps(tr, 10, compileDress(DRESS), setPrototypes(tset));
  let tn = 0;
  while (!ts.next().done) tn++;
  assert.ok(tn >= 2 * (256 / DRESS_BAND), `a transition's shares and its dress each in bands (${tn} steps)`);
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
      for (const [a, r, w] of [...f.trees, ...f.cover]) {
        const classic = [500, 501, 502, 503, 504, 506, 508, 510].includes(a) && r >= 1 && r <= 31;
        const skyrim = a === 38362 && r >= 0 && r <= 36;   // SKYRIM_FLORA_ARCHIVE: record = catalog index
        assert.ok((classic || skyrim) && w > 0, `${key}'s pick ${a}:${r} (a summer nature archive's: the second audit - the winter ones, 505, 507 and 509, had passed)`);
      }
      assert.ok(f.trees.length + f.cover.length > 0);
    }
    const kinds = land.props.map((p) => p.kind);
    assert.equal(new Set(kinds).size, kinds.length, `${key}: one entry a kind`);
    for (const p of land.props) {
      assert.ok(LAND_KINDS.includes(p.kind), `${key}: ${p.kind}`);
      assert.ok(p.rate > 0 && p.rate <= 1 && ['woods', 'plains', 'any', 'wet'].includes(p.where), `${key}: ${p.kind}'s rate and where`);
      for (const l of p.looks) assert.equal(/** @type {any} */ (LAND_LOOKS)[l]?.kind, p.kind, `${key}: the look ${l} is a ${p.kind}`);
    }
  }
  // THE DEAD TREES (AUDIT): Low Poly Trees (vendor/low-poly-trees/Trees/trees.json) stands the classic sets' grey dead tree
  // (504:24, 510:24) as 504:25's pine - no recipe names one; each of DEAD_TREES on a mesh no pine is on
  const lpt = JSON.parse(read('vendor/low-poly-trees/Trees/trees.json'));
  const mesh = (a, r) => lpt.prefabs[`${a}_${r}`]?.mesh, meshName = (a, r) => lpt.meshes[mesh(a, r)]?.name;
  assert.deepEqual([meshName(504, 24), meshName(510, 24), meshName(510, 25)], ['504_25', '504_25', '504_25'], 'the grey dead tree the pine in the mod');
  const pines = new Set([[510, 5], [510, 11], [510, 12], [510, 13], [510, 25], [510, 30], [504, 13], [504, 24], [510, 24]].map(([a, r]) => mesh(a, r)));
  for (const [a, r] of DEAD_TREES) assert.ok(mesh(a, r) != null && !pines.has(mesh(a, r)) && meshName(a, r) !== '504_25', `${a}:${r} bare in the mod too`);
  // the broadleaf lands (the second audit, lane D): Northpoint's oak and beech and Auridon's laurel, maple and cherry stand no pine
  for (const key of ['highRockNorthpoint', 'summersetAuridon']) for (const [a, r] of LANDS[key].flora.trees) assert.ok(!pines.has(mesh(a, r)), `${key}: ${a}:${r} no pine`);
  for (const [key, land] of Object.entries(LANDS)) {
    for (const [a, r] of land.flora?.trees ?? []) assert.ok(meshName(a, r) !== '504_25' || r === 25, `${key}: ${a}:${r} stands as the pine`);
  }
  assert.ok(Object.isFrozen(LANDS) && Object.isFrozen(LANDS.morrowindAshlands.ground.grass.ramp) && Object.isFrozen(LANDS.morrowindAshlands.props[0]));
  // the lands the owner named stand as the lore paints them: ash with no blades, the Alik'r's own sands, Summerset's grass
  assert.equal(LANDS.morrowindAshlands.blades, false);
  // the second audit (lane E): a zone whose meadows are the temperate set's grass (its `base` TEXTURE.302 - the Vine Coast, the
  // High Savannah, the Pellitine) grows the grass's blades with them, as every grass land does
  for (const [key, land] of Object.entries(LANDS)) if (land.ground?.base === 302) assert.equal(land.blades, true, `${key}: its grass bladed`);
  assert.equal(LANDS.hammerfellAlikr.ground, null, 'the Alik\'r keeps the Sands of the Alik\'r');
  assert.equal(LANDS.summersetVineCoast.ground.base, 302, 'the Vine Coast is grass, not the desert\'s sand');
});

test('TESA-LANDS A PIXEL\'S GROUND SET: past the Bay a summer set its zone\'s dress (its base where it names one), a winter set and a Bay pixel and a zone with no dress their own; the key read back; the 3x3 of lands the zone\'s own at its middle (mutants: a winter dressed; the base ignored; the key unread; the second audit\'s snowless winter undressed)', () => {
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
  // the second audit (lane C): a winter drawn snowless (Snowless Swamps and Jungles' 403) is its summer's ground, dressed as
  // it - the snow lane's summer set there; a snowy winter, and a snowless one no zone dresses, its own
  const hist = at('blackMarshHist'), snowless = (a) => a === 403;
  assert.equal(landGroundSet(...hist, 403), 403, 'the add-on off: the snow\'s');
  assert.equal(landGroundSet(...hist, 403, snowless), groundSetKey('blackMarshHist', 402), 'snowless: the summer\'s dress');
  assert.equal(landGroundSet(...ash, 103, snowless), 103, 'a snowy winter still the snow\'s');
  assert.equal(landGroundSet(100, 100, 403, snowless), 403, 'the Bay its own');
  // the page hands the door's word (world/climateSwaps.js - the terrain worker's modules are world/'s alone)
  setSnowlessGround(snowless);
  try { assert.equal(winterSetSnowless(403), true); assert.equal(winterSetSnowless(303), false); } finally { setSnowlessGround(winterGroundSnowless); }
  assert.match(read('src/scenes/pixelBuild.js'), /const landSetOf = \(x, y, archive\) => \(lands \? landGroundSet\(x, y, archive, winterSetSnowless\) : archive\);/);
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
  assert.ok(Math.abs(forestQuantile(0.025) - (FOREST_QUANTILES[2] + FOREST_QUANTILES[3]) / 2) < 1e-9, 'every 1% (the second audit: every 5% had been)');
});

test('TESA-LANDS THE DRESS OFF THE PAGE\'S THREAD (AUDIT): the worker answers dressLayers\' set, its buffers moved; the client hands it copies (the set as drawn untouched) and takes the dressed set back - and with no worker, a factory that throws or a worker that fails mid-dress, the page dresses it a band a breath; the ground sets dress a zone\'s key through it, and a key an earlier scene uploaded reads its colours off the dress, never the mod door; a dressed key\'s puddles its file\'s, marked once (mutants: the copies unmade; the fallback dropped; the means the door\'s; the puddles marked again)', async () => {
  const set = synthSet(16), want = dressLayers(set, DRESS, 0.9), bytes = (ls) => ls.map((l) => Array.from(l.colors));
  // the worker's answer
  let posted = null;
  dressMessage({ t: 'dress', id: 4, layers: set.map((l) => ({ ...l, colors: l.colors.slice() })), dress: DRESS, exposure: 0.9 }, (m, t) => { posted = { m, t }; });
  assert.deepEqual([posted.m.t, posted.m.id], ['dressed', 4]);
  assert.deepEqual(bytes(posted.m.layers), bytes(want), 'dressLayers\' set');
  assert.ok(posted.t.length >= 50 && new Set(posted.t).size === posted.t.length, 'its buffers moved, each once');
  dressMessage({ t: 'dress', id: 5, layers: null, dress: DRESS, exposure: 1 }, (m) => { posted = { m }; });
  assert.deepEqual([posted.m.t, posted.m.id], ['error', 5]);
  // the client: copies to the worker, the dressed set back
  const fake = () => {
    const w = { sent: [], onmessage: null, onerror: null };
    w.postMessage = (m, t) => { w.sent.push({ m, t }); setTimeout(() => dressMessage(m, (a) => w.onmessage?.({ data: a })), 0); };
    w.terminate = () => { w.dead = true; };
    return w;
  };
  const w1 = fake(), c1 = createDressClient({ makeWorker: () => w1, log: { warn() {} } }), before = bytes(set);
  assert.deepEqual(bytes(await c1.dress(set, DRESS, 0.9, async () => {})), bytes(want));
  assert.deepEqual(bytes(set), before, 'the set as drawn untouched');
  assert.ok(w1.sent[0].m.layers.every((l, r) => l.colors !== set[r].colors) && w1.sent[0].t.length === 56, 'the worker handed copies, moved');
  assert.equal(c1.dressed, 1);
  // no worker: the page's own, a band a breath
  let breaths = 0;
  const c2 = createDressClient({ makeWorker: () => { throw new Error('no Worker'); }, log: { warn() {} } });
  assert.equal(c2.alive, false);
  assert.deepEqual(bytes(await c2.dress(set, DRESS, 0.9, async () => { breaths++; })), bytes(want));
  assert.ok(breaths > 56, `a band a breath (${breaths})`);
  assert.equal(defaultDressWorker(), null, 'node: no Worker');
  // a worker that fails mid-dress: what it was asked is the page's
  const w3 = { sent: [], onmessage: null, onerror: null, postMessage(m) { this.sent.push(m); }, terminate() { this.dead = true; } };
  const c3 = createDressClient({ makeWorker: () => w3, log: { warn() {} } });
  const asked = c3.dress(set, DRESS, 0.9, async () => {});
  w3.onerror({ message: 'gone' });
  assert.deepEqual(bytes(await asked), bytes(want));
  assert.ok(!c3.alive && w3.dead);
  assert.match(read('src/world/tamriel/groundDressClient.js'), /return new Worker\(new URL\('\.\/groundDressWorker\.js', import\.meta\.url\), \{ type: 'module' \}\);/);
  // the ground sets: a zone's key dressed through the client, and learned again in a scene after
  const tex = { recordCount: 56, getDFBitmap: (r) => r, getColor32: (r) => ({ ...set[r], colors: set[r].colors.slice() }) };
  const tileArrays = new Map(), key = groundSetKey('morrowindAshlands', 102), dressed = [];
  const scene = () => {
    const maps = { grassRecords: new Map(), floorRecords: new Map(), groundPuddles: new Map(), groundMeanColour: new Map(), groundDrawnMeans: new Map() };
    const sets = createGroundSets({
      renderer: { tileArrays, *uploadTileArraySteps(k, layers) { tileArrays.set(k, layers); }, applyGroundSharpness() {} },
      getTexture: async () => tex, labGrass: null, breathe: async () => {}, ...maps,
      dresser: () => ({ dress: async (l, d, e) => { dressed.push(d); return dressLayers(l, d, e); } }),
    });
    return { sets, maps };
  };
  let reads = 0;
  const counted = tex.getColor32;
  tex.getColor32 = (r) => { reads++; return counted(r); };
  const one = scene();
  await one.sets.loadGroundSet(key, { tileArray() {} });
  assert.equal(reads, 2 * 56, 'the set made: its records read for its marks and its grass\'s, the key\'s puddles its file\'s - never marked again');
  assert.deepEqual(dressed, [LANDS.morrowindAshlands.ground], 'dressed once, in its zone\'s dress');
  assert.equal(one.maps.grassRecords.get(key).size, 0, 'the ash grows no blades (its grass records none)');
  const means = tileArrays.get(key).map(tileMeanColour);
  assert.deepEqual(one.maps.groundMeanColour.get(key), means, 'the grass\'s colours the dress\'s');
  assert.equal(one.maps.groundPuddles.get(key), one.maps.groundPuddles.get(102), 'its puddles its file\'s, marked once');
  // a scene after reads the file's records twice - its puddles' marks and its grass's - and never marks them again under
  // the key (the second audit: the module's means and the file's marks taken once)
  const two = scene();
  reads = 0;
  await two.sets.loadGroundSet(key, { tileArray() {} });
  assert.equal(reads, 2 * 56, 'a scene after: its marks and its grass\'s, once each');
  assert.equal(dressed.length, 1, 'an uploaded set not dressed again');
  assert.deepEqual(two.maps.groundMeanColour.get(key), means, 'a scene after: the dress\'s colours still - never the classic records\'');
  assert.notDeepEqual(means, set.map(tileMeanColour));
});

test('TESA-LANDS THE DRESS\'S WORKER LIVES ON (the second audit, lane C): a dead worker is let go and the next dress makes another, DRESS_WORKER_DEATHS at the most (one failure had sent the session\'s every dress to the page); a post that throws is the page\'s to dress (it was rejected, its set held); an answer that never comes, or comes unreadable, counts the worker dead and the page dresses what it held (a set had waited the scene) (mutants: no worker after one death; the post\'s throw unheld; no watch; the unreadable answer unheard)', async () => {
  const set = synthSet(16), want = dressLayers(set, DRESS, 0.9);
  const bytes = (ls) => ls.map((l) => (l?.colors ? Array.from(l.colors) : l));
  assert.equal(DRESS_WORKER_DEATHS, 3); assert.equal(DRESS_ANSWER_MS, 60000);
  // a worker a death: each fails at its first dress, the next dress makes another - three, then the page's for good
  const made = [];
  const failing = () => { const w = { onmessage: null, onerror: null, onmessageerror: null, postMessage() { setTimeout(() => w.onerror?.({ message: 'gone' }), 0); }, terminate() { w.dead = true; } }; made.push(w); return w; };
  const c = createDressClient({ makeWorker: failing, log: { warn() {} }, timer: null });
  for (let i = 0; i < 4; i++) assert.deepEqual(bytes(await c.dress(set, DRESS, 0.9, async () => {})), bytes(want), `dress ${i}: dressed whatever its worker did`);
  assert.equal(made.length, 3, 'three workers made, each let go'); assert.equal(c.deaths, 3); assert.equal(c.alive, false);
  assert.ok(made.every((w) => w.dead));
  // a post that throws: the page's, and the worker kept
  const throwing = { onmessage: null, onerror: null, postMessage() { throw new Error('DataCloneError'); }, terminate() {} };
  const t = createDressClient({ makeWorker: () => throwing, log: { warn() {} }, timer: null });
  assert.deepEqual(bytes(await t.dress(set, DRESS, 0.9, async () => {})), bytes(want), 'the page dressed it');
  assert.equal(t.alive, true); assert.equal(t.deaths, 0);
  // an answer that never comes: the watch counts the worker dead, the page dresses what it held
  const silent = { onmessage: null, onerror: null, postMessage() {}, terminate() { silent.dead = true; } };
  let watch = null;
  const s = createDressClient({ makeWorker: () => silent, log: { warn() {} }, timer: (fn, ms) => { watch = { fn, ms }; return 1; }, untimer() {} });
  const asked = s.dress(set, DRESS, 0.9, async () => {});
  assert.equal(watch.ms, DRESS_ANSWER_MS);
  watch.fn();
  assert.deepEqual(bytes(await asked), bytes(want)); assert.ok(silent.dead); assert.equal(s.deaths, 1);
  // an answer the page cannot read: the same
  const garbled = { onmessage: null, onerror: null, onmessageerror: null, postMessage() { setTimeout(() => garbled.onmessageerror?.({}), 0); }, terminate() { garbled.dead = true; } };
  const g = createDressClient({ makeWorker: () => garbled, log: { warn() {} }, timer: null });
  assert.deepEqual(bytes(await g.dress(set, DRESS, 0.9, async () => {})), bytes(want)); assert.ok(garbled.dead); assert.equal(g.deaths, 1);
  // disposed: no worker again, and no death counted
  const d = createDressClient({ makeWorker: () => ({ postMessage() {}, terminate() {} }), log: { warn() {} }, timer: null });
  d.dispose(); assert.equal(d.alive, false); assert.equal(d.deaths, 0);
  assert.deepEqual(bytes(await d.dress(set, DRESS, 0.9, async () => {})), bytes(want), 'the page\'s after');
});

test('TESA-LANDS A SET ON ITS WAY, ITS PLACE GONE (the second audit, lane C): a pixel dropped while its set was being made (a dress queued on the worker is seconds of it) had its set swept before it was there to free, and it landed held by no one for good - 20 MB of the GPU\'s a set, more for every zone crossed at speed; now the next sweep frees it, and a place that stands keeps its own. And a dressed key an earlier scene uploaded marks its file\'s puddles under its file, once for every zone that wears it (mutants: the set not asked again once it stands; the marks the key\'s alone)', async () => {
  const set = synthSet(16);
  const tex = { recordCount: 56, getDFBitmap: (r) => r, getColor32: (r) => ({ ...set[r], colors: set[r].colors.slice() }) };
  const tileArrays = new Map(), freed = [];
  const holds = createPlaceHolds({ free: { mesh: () => false, tex() {}, tile: (k) => { if (!tileArrays.has(k)) return false; tileArrays.delete(k); freed.push(k); return true; } }, kept: { pixel: 0, interior: 0, dungeon: 0 } });
  const maps = () => ({ grassRecords: new Map(), floorRecords: new Map(), groundPuddles: new Map(), groundMeanColour: new Map(), groundDrawnMeans: new Map() });
  const setsOf = (m) => createGroundSets({
    renderer: { tileArrays, *uploadTileArraySteps(k, layers) { tileArrays.set(k, layers); }, applyGroundSharpness() {} },
    getTexture: async () => tex, labGrass: null, breathe: async () => {}, ...m,
    dresser: () => ({ dress: async (l, d, e) => dressLayers(l, d, e) }),
  });
  const sets = setsOf(maps()), ash = groundSetKey('morrowindAshlands', 102), pine = groundSetKey('skyrimPinewood', 102);
  const gone = holds.place('pixel', 'gone');
  const made = sets.loadGroundSet(ash, { tileArray: (k) => gone.hold('tile', k) });
  gone.release();   // kept none: dropped at once, and its sweep finds no set there yet
  assert.deepEqual(freed, []);
  await made;
  assert.ok(tileArrays.has(ash), 'it landed');
  holds.place('pixel', 'next').release();
  assert.deepEqual(freed, [ash], 'the next sweep frees it');
  // a place that stands keeps its own through every sweep
  const stands = holds.place('pixel', 'stands');
  await sets.loadGroundSet(pine, { tileArray: (k) => stands.hold('tile', k) });
  holds.place('pixel', 'other').release();
  assert.ok(tileArrays.has(pine) && !freed.includes(pine));
  await sets.loadGroundSet(ash, { tileArray: (k) => stands.hold('tile', k) });
  // a scene after: both keys uploaded, the file's puddles not yet marked - marked once, under the file, and both keys its
  const m = maps(), after = setsOf(m);
  await after.loadGroundSet(ash, { tileArray() {} });
  await after.loadGroundSet(pine, { tileArray() {} });
  assert.ok(m.groundPuddles.has(102), 'under the file');
  assert.equal(m.groundPuddles.get(ash), m.groundPuddles.get(102));
  assert.equal(m.groundPuddles.get(pine), m.groundPuddles.get(102), 'the file\'s other zone\'s key finds them');
});

test('TESA-LANDS THE DOORS: the ground sets\' module dresses a zone\'s key a record a breath at the pack\'s exposure and keeps its maps under the key, no blades where the zone grows none; the pixel\'s build names its set and its neighbours\' each its own zone\'s, and stands its landmarks; the Features row and its switch (mutants: the dress unstepped; the blades kept on ash; the neighbours the pixel\'s)', () => {
  const gs = read('src/scenes/groundSets.js');
  assert.match(gs, /const fileOf = \(key\) => parseGroundSetKey\(key\)\?\.archive \?\? key;/);
  assert.match(gs, /const getTexture = \(key\) => archiveTexture\(fileOf\(key\)\);/);
  assert.match(gs, /const own = await groundLayersOf\(fileOf\(groundArchive\), groundTex\);/);
  assert.match(gs, /own\.layers = await dresser\(\)\.dress\(own\.layers, dress, own\.modLayers \? setExposure\(own\.modLayers, classicOf\(groundTex\)\) : 1, breathe\);\n\s+own\.modLayers = own\.layers;\n\s+DRESSED_MEANS\.set\(groundArchive, own\.layers\.map\(tileMeanColour\)\);/);
  assert.match(gs, /if \(dress\) groundDrawnMeans\.set\(groundArchive, DRESSED_MEANS\.get\(groundArchive\)\);[^\n]*\n\s+else if \(labGrass\) groundDrawnMeans\.set\(/);   // PIN MOVED (the second audit, lane C): the dress's means first - never taken twice off the same layers
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
