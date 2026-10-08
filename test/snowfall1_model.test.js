// SNOWFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These should be
// on by default and integrate into our enhanced environments seamlessly") - SNOWFALL 1.0.5 (demifiend000), ported off
// its assembly (vendor/snowfall/). THE MODEL (systems/snowfall.js): SnowpackState, SnowDepthRules.Resolve,
// SnowCoverageData over the mod's own three masks (public/art/snowfall/), SnowContactRamp, PersistentTrackField and its
// save, the masks' rasterizers, the statics' encodings, BasicRoadsClassifier and BasicRoadsTerrain, and the field's
// eviction - pinned against a C# reference that runs the decompiled method bodies themselves (the session's harness:
// the mod's own sources on .NET 8, its float arithmetic and its DeflateStream): nine trace hashes, float bits and all,
// one LCG run through them in order, so the sections below run in the reference's order and share its generator.
// bible/03-World/Snowfall.md is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import * as M from '../src/systems/snowfall.js';
import { deflateRaw, inflateRaw } from '../src/formats/rawDeflate.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

const f32 = Math.fround;
let lcg = 12345;
const next = () => (lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0);
const R = (n) => (next() >>> 8) % n;
const U = () => f32((next() >>> 8) / 16777216);
const dv = new DataView(new ArrayBuffer(8));
const F = (f) => { dv.setFloat32(0, f); return (dv.getUint32(0) >>> 0).toString(16).padStart(8, '0'); };
const D = (d) => { dv.setFloat64(0, d); return BigInt.asUintN(64, dv.getBigInt64(0)).toString(16).padStart(16, '0'); };
const H = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const Px = (p) => { let s = ''; for (let k = 0; k < p.length; k += 4) s += `${p[k]},${p[k + 1]},${p[k + 2]},${p[k + 3]};`; return H(s); };
const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const coverage = () => new M.SnowCoverage(MASKS);

function settings(v) {
  const s = { ...M.SNOWFALL_BUILT_IN };
  if (v === 1) Object.assign(s, { settlementMinimumDepth: f32(0.15), settlementMaximumDepth: f32(0.55), wildernessMinimumDepth: f32(0.3), wildernessMaximumDepth: f32(0.95), snowfallDepthStep: f32(0.037), snowfallDepthHours: f32(1.25), meltDepthStep: f32(0.023), meltDepthHours: 5, roadBermRise: f32(0.08), pathMaximumDepth: f32(0.17) });
  if (v === 2) Object.assign(s, { roadBermsEnabled: false, wildernessMaximumDepth: f32(0.4), settlementMaximumDepth: f32(0.2), pathMaximumDepth: f32(0.33) });
  return s;
}
/** A field's cells as its save lays them (9 bytes a cell, little-endian), in the save's order. */
const savedCells = (field) => {
  const save = {}; field.writeSaveData(save);
  const raw = zlib.inflateRawSync(Buffer.from(save.PackedCells, 'base64'));
  const cells = [];
  for (let j = 0; j < raw.length; j += 9) cells.push(`${raw.readInt32LE(j)},${raw.readInt32LE(j + 4)},${raw[j + 8]}`);
  return cells;
};

test('SNOWFALL1 the snowpack: three settings, 4000 steps each of weather, winter, desert, a configure, a save and its restore, a clock reset and time run backwards - every depth and phase in double bits, as the reference prints them (mutants: the melt\'s step; the interval\'s hours; a phase carried over a season; the restored winter kept)', () => {
  let sb = '';
  for (let v = 0; v < 3; v++) {
    const p = new M.SnowpackState(); p.configure(settings(v), false);
    let now = 0, winter = true, desert = false, snowing = false;
    for (let i = 0; i < 4000; i++) {
      const k = R(100);
      if (k < 3) winter = !winter; else if (k < 5) desert = !desert; else if (k < 25) snowing = !snowing;
      else if (k === 25) { const s = settings(R(3)); p.configure(s, R(2) === 0); }
      else if (k === 26) { const d = {}; p.write(d); p.restore(R(4) === 0 ? null : d); sb += `w ${F(d.SettlementDepth)} ${F(d.WildernessDepth)} ${D(d.PhaseProgressSeconds)}\n`; }
      else if (k === 27) p.resetClock(R(3) === 0 ? 0 : now);
      else if (k === 28 && now > 5000) now -= R(5000);
      now += R(k < 60 ? 4000 : 40000);
      const changed = p.advance(now, winter, desert, snowing);
      sb += `${changed ? 1 : 0} ${D(p.settlementDepth)} ${D(p.wildernessDepth)} ${D(p.phaseProgressSeconds)} ${p.phaseWasSnowing ? 1 : 0}\n`;
    }
  }
  assert.equal(sb.length, 664107);
  assert.equal(H(sb), '5ce5e3638c1d8f63baf78002ca60bb123ed5a69752ef47cfee9c5a7222cf2776', 'the reference\'s snowpack, byte for byte');
});

test('SNOWFALL1 SnowDepthRules.Resolve: 6000 contexts (settlement, cap, path, berm bytes; one in eleven excluded) under three settings with Basic Roads on and off - the float bits the reference prints (mutants: the berm\'s ceiling; the cap\'s min; an excluded context with depth)', () => {
  let sb = '';
  for (let i = 0; i < 6000; i++) {
    const s = settings(i % 3);
    if (i % 7 === 0) s.basicRoadsIntegration = false;
    const r = R(256), g = R(256), b = R(256), a = R(256);
    let ctx = M.contextOf(r, g, b, a);
    if (i % 11 === 0) ctx = M.SNOW_EXCLUDED;
    const wild = f32(f32(0.1) + f32(U() * f32(0.9))), settle = f32(f32(0.1) + f32(U() * f32(0.9))), cap = f32(f32(0.1) + f32(U() * f32(0.5)));
    sb += `${F(M.resolveSnowDepth(ctx, wild, settle, cap, s))}\n`;
  }
  assert.equal(H(sb), 'e1e83e50daf2758a0a48a09305a0ecc5b829fc46f265d6a4821302050e80e5b8');
});

test('SNOWFALL1 SnowCoverageData over the mod\'s own masks: every tile\'s full-cover flag on five archives, and 20000 samples - the coverage (none off the masks) and the road distance field - float bits (mutants: the turn\'s rotation; the flip; the bilinear\'s weights; the distance records)', () => {
  const cov = coverage();
  let sb = '';
  const archives = [103, 303, 403, 102, 3];
  for (const a of archives) for (let t = 0; t < 256; t++) sb += cov.isFullySnowCovered(a, t) ? '1' : '0';
  sb += '\n';
  for (let i = 0; i < 20000; i++) {
    const a = archives[R(5) === 0 ? 3 + R(2) : R(3)];
    const tile = (R(4) === 0 ? (46 + R(2) * (R(2) === 0 ? 1 : 9)) * 4 + R(4) : R(256)) & 255;
    const u = f32(f32(U() * f32(1.2)) - f32(0.1)), v = f32(f32(U() * f32(1.2)) - f32(0.1));
    const c = cov.sample(a, tile, u, v);
    sb += `${c === null ? 'none' : F(c)} ${F(cov.roadDistance(a, tile, u, v))}\n`;
  }
  assert.equal(H(sb), 'b47895636ff658f184991921e64b81443235519d8bf7f990048b06d82df85908');
  assert.deepEqual(M.SNOW_MASK_ARCHIVES, [103, 303, 403]);
  for (const m of MASKS) assert.equal(m.length, M.SNOW_MASK_BYTES, 'a mask is 56 records of 64 x 64 bytes');
});

test('SNOWFALL1 SnowContactRamp: sixty masks, five green levels, radius 0-6 - the pixels the reference leaves (mutants: the ramp\'s distance; the hard boundary\'s test)', () => {
  let sb = '';
  for (let t = 0; t < 60; t++) {
    const w = 8 + R(40), h = 8 + R(40);
    const p = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const g = [0, 1, 128, 250, 255][R(5)];
      const r = R(256), b = R(256), a = R(256);
      p.set([r, g, b, a], i * 4);
    }
    const radius = R(7);
    M.snowContactRamp(p, w, h, radius);
    sb += `${w}x${h} ${radius} ${Px(p)}\n`;
  }
  assert.equal(H(sb), '2d1e2404f82f143bbf2b3d37cb240d4decb11dee2975e98fe64170305ff7f60b');
});

test('SNOWFALL1 PersistentTrackField: 1500 steps of stamps (a long one now and then), refills, mask applications over part-rectangles, saves and restores, and the scene moving under the world - the counts, the masks, the evictions, and the save\'s cells in the dictionary\'s own order (mutants: the cell size; the bucket span; the slot reuse order; the refill\'s step; the save\'s byte layout)', () => {
  let sb = '';
  const gps = { x: 32768 * 512 + 12345, z: 32768 * 250 + 23456 };
  const tr = { x: f32(103.25), z: f32(-57.5) };
  const toGlobal = (x, z) => [gps.x / 40 + x - tr.x, gps.z / 40 + z - tr.z];
  const f = new M.PersistentTrackField(toGlobal);
  for (let i = 0; i < 1500; i++) {
    const k = R(100);
    if (k < 80) {
      const sx = f32(f32(U() * 120) - 60), sz = f32(f32(U() * 120) - 60);
      let ex = f32(f32(sx + f32(U() * 4)) - 2), ez = f32(f32(sz + f32(U() * 4)) - 2);
      if (k < 3) { ex = f32(sx + f32(U() * 2000)); ez = f32(sz + f32(U() * 50)); }
      const w = f32(f32(0.3) + f32(U() * f32(2.4))), rem = f32(U() * f32(1.1));
      f.stampSegment(sx, sz, ex, ez, w, rem);
    } else if (k < 88) f.refill(R(40));
    else if (k < 95) {
      const res = R(2) === 0 ? 161 : 256;
      const px = M.fullSnowMask(res);
      const pminx = R(3) === 0 ? R(res) : 0;
      const pmaxx = pminx === 0 ? -1 : pminx + R(res);
      const pminz = R(res), pmaxz = pminz + R(res);
      const cx = f32(f32(U() * 100) - 50), cz = f32(f32(U() * 100) - 50), dia = f32(40 + f32(U() * 400));
      const n = f.applyToMask(px, res, cx, cz, dia, pminx, pmaxx, pminz, pmaxz);
      sb += `mask ${n} ${Px(px)}\n`;
    } else if (k < 97) {
      const d = {}; f.writeSaveData(d);
      const f2 = new M.PersistentTrackField(toGlobal); const ok = f2.restoreSaveData(d);
      sb += `save ${d.CellCount} ${ok ? 'True' : 'False'} ${f2.count}\n`;
    } else if (k === 97) { gps.x += R(2000) - 1000; tr.x = f32(tr.x + f32(U() * 10)); tr.z = f32(tr.z - f32(U() * 10)); }
    sb += `${f.count} ${f.evictedCells}\n`;
  }
  const cells = savedCells(f);
  sb += `order ${H(cells.join(';'))}\n`;
  cells.sort();
  sb += `cells ${H(cells.join(';'))}\n`;
  assert.equal(H(sb), '5c9a238df27951655bded311327ccbf01b88b81f719420f24e4980ae4f61978a');
});

test('SNOWFALL1 the rasterizers: 600 track segments into the local window, the middle ring\'s history and the far mask at their own scales and minimum radii, and 300 bodies into a 161 mask - the pixels written and the masks the reference leaves (mutants: the capsule\'s end caps; the minimum radius; the shoulder; a body\'s refill)', () => {
  let sb = '';
  const local = M.fullSnowMask(256), hist = M.fullSnowMask(641), far = M.fullSnowMask(641);
  const lcx = f32(12.5), lcz = f32(-3.25), hcx = -20, hcz = 35, fcx = 48, fcz = -16;
  let farLast = 0;
  for (let i = 0; i < 600; i++) {
    const sx = f32(f32(U() * 400) - 200), sz = f32(f32(U() * 400) - 200);
    let ex = f32(f32(sx + f32(U() * 6)) - 3), ez = f32(f32(sz + f32(U() * 6)) - 3);
    if (i % 50 === 0) { ex = sx; ez = sz; }
    const w = f32(f32(0.3) + f32(U() * f32(2.5))), rem = f32(U() * f32(1.1));
    const a = M.rasterizeTrack(local, 256, f32(lcx - 44), f32(lcz - 44), f32(255 / 88), 0.5, f32(sx * 0.25), f32(sz * 0.25), f32(ex * 0.25), f32(ez * 0.25), w, rem);
    const b = M.rasterizeTrack(hist, 641, hcx - 160, hcz - 160, 2, 0.75, sx, sz, ex, ez, w, rem);
    const c = M.rasterizeTrack(far, 641, fcx - 320, fcz - 320, 1, 0.75, sx, sz, ex, ez, w, rem);
    if (c > 0) farLast = c;
    sb += `${a} ${b} ${farLast}\n`;
  }
  sb += `${Px(local)}\n${Px(hist)}\n${Px(far)}\n`;
  const corpse = M.fullSnowMask(161);
  for (let i = 0; i < 300; i++) {
    const x = f32(f32(U() * 200) - 20), z = f32(f32(U() * 200) - 20);
    const radius = i % 30 === 0 ? 0 : f32(U() * 9);
    sb += M.rasterizeCorpse(corpse, 161, x, z, radius, R(256)) ? '1' : '0';
  }
  sb += `\n${Px(corpse)}\n`;
  assert.equal(H(sb), 'f14bfe099875aaab7b35d27d29734afb30fcefcb68bcdcddcf8cd911cb7c3d93');
});

test('SNOWFALL1 the statics and the grid: 4000 encodings (the depth multiplier and the coverage), snaps to a lattice, SmoothSteps, outside weights and InterpolateQuad\'s blends - float bits (mutants: the encoding\'s rounding; the snap\'s origin; the quad\'s diagonal)', () => {
  let sb = '';
  const sample = (k) => ({ height: f32(U() * 100), normal: [U(), U(), U()], contextA: [U(), k, 0, 0], offset: f32(U() * f32(0.01)) });
  for (let i = 0; i < 4000; i++) {
    const c = M.encodeStaticSnow(f32(f32(U() * f32(2.6)) - f32(0.3)), f32(f32(U() * f32(1.4)) - f32(0.2)));
    const gx = f32(f32(U() * 2000) - 1000), gz = f32(f32(U() * 2000) - 1000), sp = f32(f32(0.1) + f32(U() * 12)), ox = f32(U() * 50), oz = f32(U() * 50);
    const g = M.snapToGrid(gx, gz, sp, ox, oz);
    const e0 = f32(U() * 60), e1 = f32(f32(e0 + f32(U() * 20)) + f32(0.01));
    const ss = M.smoothStepF(e0, e1, f32(U() * 90));
    const out = U() * 40 - 4, feather = i % 9 === 0 ? 0 : f32(U() * 32);
    sb += `${c[0]},${c[1]} ${F(g[0])} ${F(g[1])} ${F(ss)} ${M.outsideWeight(out, feather)}\n`;
    const a = sample(0), r = sample(1), tp = sample(2), cc = sample(3);
    const q = M.interpolateQuad(a, r, tp, cc, U(), U());
    sb += `${F(q.height)} ${F(q.normal[0])} ${F(q.normal[1])} ${F(q.normal[2])} ${F(q.contextB[1])} ${F(q.blend[0])} ${F(q.blend[1])} ${F(q.blend[2])} ${F(q.offset)}\n`;
  }
  assert.equal(H(sb), 'fa48dcc637198a197944357547a65ec8e00261fef1d9a65978ea45060f48f918');
});

test('SNOWFALL1 Basic Roads: 20000 path-edge and outside distances, 24 painted pixels classified (their road and track tiles, the path and the berm weights over 400 points each) and 2000 predictions - what the reference answers (mutants: a track polygon\'s vertex; the corner bits; the location rectangle\'s paving; an authored tile classified)', () => {
  const cov = coverage();
  let sb = '';
  for (let i = 0; i < 20000; i++) {
    const tile = (([10, 11, 12, 25, 26, 27, 51, 52, 46, 3][R(10)] << 2) | R(4)) & 255;
    const u = f32(f32(U() * f32(1.6)) - f32(0.3)), v = f32(f32(U() * f32(1.6)) - f32(0.3));
    sb += `${F(M.pathEdgeDistance(tile, u, v))} ${F(M.pathOutsideDistance(tile, u, v))}\n`;
  }
  for (let n = 0; n < 24; n++) {
    const net = {};
    net.roads = R(256); { const w = R(256), e = R(256); net.roadCorners = M.roadCorners(w, e); }
    net.paths = R(256); { const w = R(256), e = R(256); net.pathCorners = M.roadCorners(w, e); }
    const rect = n % 3 === 0 ? { xMin: 50, yMin: 40, xMax: 74, yMax: 70 } : { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
    const ground = R(4);
    const tiles = new Uint8Array(16384), authored = new Array(16384).fill(false);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      let t = M.predictRoadTile(x, y, net.roads, net.roadCorners, ground, true, rect);
      if (t < 0) t = M.predictRoadTile(x, y, net.paths, net.pathCorners, ground, false, rect);
      if (t < 0 || R(23) === 0) t = R(4) === 0 ? ([46, 47, 55, 10, 11, 12, 25, 26, 27, 51, 52][R(11)] << 2) | R(4) : R(56) << 2;
      tiles[y * 128 + x] = Math.min(t, 255);
      authored[y * 128 + x] = R(40) === 0;
    }
    const terr = new M.BasicRoadsTerrain(500 + n, 200, tiles, authored, net, rect);
    sb += `net ${net.roads} ${net.paths} ${terr.roadTiles} ${terr.pathTiles}\n`;
    let kinds = '';
    for (let z = 0; z < 128; z++) for (let x = 0; x < 128; x++) kinds += `${terr.at(x, z)}${terr.pathTile(x, z)}`;
    sb += `${H(kinds)}\n`;
    for (let i = 0; i < 400; i++) {
      const x = f32(f32(U() * 130) - 1), z = f32(f32(U() * 130) - 1);
      const pf = i % 13 === 0 ? 7 : f32(U() * 4);
      const p = terr.samplePath(x, z, f32(6.4), pf);
      const bw = i % 17 === 0 ? 0 : f32(U() * 4);
      const b = terr.sampleBerm(x, z, f32(6.4), bw, [103, 303, 403][i % 3], cov);
      sb += `${p} ${b}\n`;
    }
  }
  for (let i = 0; i < 2000; i++) {
    const x = R(130) - 1, y = R(130) - 1, flags = R(256), corners = R(256), ground = R(5) - 1 + (i % 7 === 0 ? 4 : 0), road = R(2) === 0;
    const rx = R(128), ry = R(128), rw = R(30), rh = R(30);
    sb += `${M.predictRoadTile(x, y, flags, corners, ground, road, { xMin: rx, yMin: ry, xMax: rx + rw, yMax: ry + rh })}${i % 40 === 39 ? '\n' : ' '}`;
  }
  assert.equal(H(sb), 'e4c9678b8e09594697e9832e206c68a3f0037db9e961db89bcfacab98d08c20c');
});

test('SNOWFALL1 the field\'s ceiling: fourteen 1.5 km strides past the 65,536 cells, refills and save round trips between - the counts, the evictions (the oldest written first), a mask and the save\'s order (mutants: the eviction\'s order; the ceiling)', () => {
  let sb = '';
  const gps = { x: 32768 * 300, z: 32768 * 100 };
  const toGlobal = (x, z) => [gps.x / 40 + x - 0, gps.z / 40 + z - 0];
  const f = new M.PersistentTrackField(toGlobal);
  for (let i = 0; i < 14; i++) {
    const x = f32(U() * 400), z = f32(U() * 400);
    const ex = f32(f32(x + 1500) + f32(U() * 500)), ez = f32(f32(z + f32(U() * 300)) - 150);
    const w = f32(f32(0.5) + f32(U() * f32(1.2))), rem = f32(U() * f32(0.9));
    f.stampSegment(x, z, ex, ez, w, rem);
    if (i % 4 === 3) f.refill(R(60));
    if (i % 5 === 4) { const d = {}; f.writeSaveData(d); f.restoreSaveData(d); }
    sb += `${f.count} ${f.evictedCells}\n`;
  }
  const px = M.fullSnowMask(321);
  sb += `${f.applyToMask(px, 321, 700, 200, 900)} ${Px(px)}\n`;
  sb += `order ${H(savedCells(f).join(';'))}\n`;
  assert.equal(H(sb), '65e9db6d77dff416f34a5c74180a10784cc70dd5d39fd0add618c23f67f6f0a7');
  // the reference's own lines, as a reader can check them by eye: the ceiling reached, then the oldest let go
  assert.deepEqual(sb.split('\n').slice(8, 12), ['55679 0', '65536 0', '65536 10834', '44148 15881']);
  assert.equal(M.TRACK_MAX_CELLS, 65536);
  assert.equal(M.TRACK_CELL_SIZE, 0.5);
});

test('SNOWFALL1 the save\'s bytes: DeflateStream\'s raw stream both ways - the port\'s deflate inflates with zlib to the bytes it took, and zlib\'s stored, fixed and dynamic blocks inflate to theirs; a stream that ends early or names a bad code is refused (mutants: the length table; the distance\'s extra bits; the window)', () => {
  let seed = 7;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 24;
  const inputs = [new Uint8Array(0), Uint8Array.of(42), new Uint8Array(100000).fill(7), Uint8Array.from({ length: 70000 }, rnd),
    Uint8Array.from({ length: 50000 }, (_, i) => (i % 9 === 8 ? rnd() : (i * 31) & 255)), new TextEncoder().encode('snow '.repeat(20000))];
  for (const input of inputs) {
    const packed = deflateRaw(input);
    assert.deepEqual(new Uint8Array(zlib.inflateRawSync(Buffer.from(packed))), input, `the port's stream of ${input.length} bytes`);
    for (const level of [0, 1, 6, 9]) {
      const theirs = zlib.deflateRawSync(Buffer.from(input), { level });
      assert.deepEqual(inflateRaw(new Uint8Array(theirs)), input, `zlib level ${level}, ${input.length} bytes`);
    }
  }
  const good = zlib.deflateRawSync(Buffer.from(inputs[4]));
  assert.throws(() => inflateRaw(new Uint8Array(good.subarray(0, good.length >> 1))), 'a stream cut short');
  assert.throws(() => inflateRaw(Uint8Array.of(0xff, 0xff, 0xff)), 'a reserved block type');
  // the save round trip through the field, the payload the mod's own save record carries
  const field = new M.PersistentTrackField((x, z) => [x + 1000, z + 2000]);
  field.stampSegment(0, 0, 30, 12, f32(0.9), f32(0.2));
  const d = {}; field.writeSaveData(d);
  assert.equal(d.FormatVersion, 1);
  assert.ok(d.CellCount > 0 && typeof d.PackedCells === 'string');
  const back = new M.PersistentTrackField((x, z) => [x + 1000, z + 2000]);
  assert.equal(back.restoreSaveData(d), true);
  assert.deepEqual(savedCells(back), savedCells(field));
  assert.equal(back.restoreSaveData({ ...d, PackedCells: 'not base64 of a stream' }), false, 'a malformed payload is refused, not half kept');
});

test('SNOWFALL1 the settings: the mod\'s settings file and DynamicSnowSettings\' initialisers agree key for key; ReadSettings clamps as the mod clamps (a maximum under its minimum is the minimum; the resolutions by index) - and General.Enabled is the row\'s switch, on by default (mutants: a clamp\'s bound; the mesh table)', () => {
  assert.deepEqual(M.snowfallSettings(), M.SNOWFALL_BUILT_IN, 'the defaults read through the store are the built-in values');
  assert.equal(MOD_SETTINGS.snowfall.keys.Enabled.default, true, 'on by default (Mac: "These should be on by default")');
  const keys = { 'Snowpack.WildernessMinimumDepth': 0.6, 'Snowpack.WildernessMaximumDepth': 0.3, 'Surface.MeshResolution': 0, 'Surface.MaskResolution': 2, 'Surface.SnowRadius': 99, 'General.ActivationOverride': 7, 'Basic Roads.BermRise': NaN, Enabled: false };
  const s = M.snowfallSettings((k) => (k in keys ? keys[k] : MOD_SETTINGS.snowfall.keys[k]?.default));
  assert.equal(s.wildernessMinimumDepth, f32(0.6));
  assert.equal(s.wildernessMaximumDepth, f32(0.6), 'a maximum under its minimum is the minimum');
  assert.equal(s.meshResolution, 97);
  assert.equal(s.maskResolution, 512);
  assert.equal(s.snowRadius, 64);
  assert.equal(s.activationOverride, 2);
  assert.equal(s.roadBermRise, f32(0.05), 'a non-finite road value falls back to its default');
  assert.equal(s.enabled, false);
  for (const k of Object.keys(MOD_SETTINGS.snowfall.keys)) assert.ok(k === 'Enabled' || /^[A-Z][A-Za-z ]+\.[A-Za-z]+$/.test(k), k);
});

test('SNOWFALL1 a location\'s rectangle and its own ground: SnowContextData.LocationRect in global metres off the pixel\'s corner and the tile origin; BasicRoadsTerrain.MarkAuthoredBlock marks a block\'s tiles under record 56, its rows from the north (mutants: the tile\'s 256 units; the row flip; the record bound)', () => {
  const r = M.locationRect(100, 200, { x: 56, y: 48 }, 1, 2);
  assert.deepEqual(r, { minX: (100 * 32768 + 56 * 256) / 40, minZ: ((499 - 200) * 32768 + 48 * 256) / 40, maxX: (100 * 32768 + 56 * 256 + 4096) / 40, maxZ: ((499 - 200) * 32768 + 48 * 256 + 8192) / 40 });
  const ground = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ textureRecord: x === 3 && y === 0 ? 60 : x === 5 ? 60 : 9 })));
  const authored = new Uint8Array(16384);
  M.markAuthoredBlock(authored, ground, 10, 20);
  assert.equal(authored[(20 + 15) * 128 + 10 + 3], 0, 'the block\'s y 0 is its north row - the tile row 15 from its origin');
  assert.equal(authored[(20 + 0) * 128 + 10 + 3], 1, 'and its y 15 the south row');
  assert.equal(authored[(20 + 0) * 128 + 10 + 5], 0, 'a record from 56 up is not the location\'s ground');
  assert.equal(authored[(20 + 0) * 128 + 10 + 4], 1);
  assert.equal(authored[19 * 128 + 10], 0, 'nothing outside the block');
  let n = 0; for (const v of authored) n += v;
  assert.equal(n, 16 * 15 - 1, 'every tile but the column of 60s and the one north tile');
  assert.throws(() => M.markAuthoredBlock(authored, ground, 120, 0), /Malformed/);
});
