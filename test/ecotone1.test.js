// ECOTONE1 (2026-10-07, Mac: "Making it where bione transitions are insta t and instead fade and transition naturally
// into each other") - BLENDED CLIMATES: where map pixels of two climates meet, one wandering, patchy border (world/
// ecotone.js) in place of the pixel's straight edge - the ground's tile sets sampled across it in both terrain programs
// (render/ecotoneGlsl.js, renderer.drawTerrain's `eco`), the wild's flats laid by the climate that owns each tile
// (world/terrainNature.js), the grass grown by the ground under it (scenes/world.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { glslFunctions } from './glsl.mjs';
import { ECOTONE, ECOTONE_REACH, ecoHash, ecoNoise, ecoShare, ecoOrigin, ecotoneShares, ecotoneOwner } from '../src/world/ecotone.js';
import { ecotoneGlsl, ECO_UNITS } from '../src/render/ecotoneGlsl.js';
import * as RENDER from '../src/render/renderer.js';
import { EL_TERRAIN_FS } from '../src/render/enhancedLighting.js';
import { layoutNature, TREE_RECORDS, isTreeRecord } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { floraSwayOf } from '../src/systems/windDrive.js';
import { climateBlendOn } from '../src/scenes/shared.js';
import { FEATURES, checkFeature } from '../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { onlineForcedPref } from '../src/systems/onlineLane.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PX = 240, PY = 180, PIXEL = 819.2;
/** a deterministic spread of points (a Weyl sequence), pixel-local metres */
const points = (n, x0 = 0, x1 = PIXEL, z0 = 0, z1 = PIXEL) => Array.from({ length: n }, (_, i) => [x0 + (x1 - x0) * ((i * 0.6180339887) % 1), z0 + (z1 - z0) * ((i * 0.7548776662) % 1)]);

test('ECOTONE1: the numbers - the band, the seam\'s wander, the patches, their stretch and rim, pinned as literals (every measurement below reads ECOTONE)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ECOTONE)), {
    band: 96, warp: [{ cell: 64, amp: 48 }, { cell: 8, amp: 16 }], patch: [{ cell: 8, weight: 0.65 }, { cell: 2, weight: 0.35 }],
    stretch: 2, edge: 0.06, row0: 512, saltX: 101, saltZ: 211,
  });
  assert.equal(ECOTONE_REACH, 160, 'the band and the widest wander');
  for (const o of [...ECOTONE.warp, ...ECOTONE.patch]) assert.equal(128 % o.cell, 0, 'every lattice cell divides a pixel - its origin is whole cells');
  assert.deepEqual(ecoOrigin(PX, PY), [PX * 128, (512 - PY) * 128]);
  assert.deepEqual([...ECO_UNITS], [3, 4, 5]);
});

test('ECOTONE1: the four shares of a point sum to one; past the reach of both edges a pixel is wholly its own, exactly; and near an edge the shares are a border, not a line (mutants: the reach short; a share\'s side flipped)', () => {
  for (const [x, z] of points(400)) {
    const s = ecotoneShares(PX, PY, x, z);
    assert.ok(Math.abs(s.own + s.nx + s.nz + s.nd - 1) < 1e-12);
    const far = Math.min(x, PIXEL - x) >= ECOTONE_REACH && Math.min(z, PIXEL - z) >= ECOTONE_REACH;
    if (far) assert.deepEqual([s.own, s.nx, s.nz, s.nd], [1, 0, 0, 0]);
  }
  let mixed = 0, total = 0;
  for (const [, z] of points(300, 0, PIXEL, ECOTONE_REACH, PIXEL - ECOTONE_REACH)) {
    for (const d of [3, 20, 40, 80]) {
      const s = ecotoneShares(PX, PY, PIXEL - d, z);
      assert.equal(s.sx, 1, 'the east edge is the nearer');
      total++;
      if (s.nx > 0.01) mixed++;
    }
  }
  assert.ok(mixed > total * 0.25 && mixed < total * 0.9, `the neighbour holds some of the band, not all and not none (${mixed} of ${total})`);
});

test('ECOTONE1: the edge is the same point seen from either side - the pixel west of an edge and the pixel east of it agree on the shares of every point near it, and the four about a corner agree on its four (mutants: the warp\'s salt per pixel; the origin\'s row the map\'s y)', () => {
  const shareOf = (px, py, x, z) => ecotoneShares(px, py, x, z, undefined);
  // across the east edge of (PX, PY): a point d metres west of it is (PIXEL - d) in (PX, PY) and the same point is d metres
  // short of (PX + 1, PY)'s west edge - which that pixel reckons at its own x = -d... a pixel is asked only of its own
  // points, so the twin is the point just across: both answer the SAME continuous field, so the west pixel's
  // neighbour-share just inside meets the east pixel's own-share just inside, at the edge
  for (const [, z] of points(200, 0, PIXEL, 0, PIXEL)) {
    const w = shareOf(PX, PY, PIXEL - 1e-7, z), e = shareOf(PX + 1, PY, 1e-7, z);
    assert.ok(Math.abs((w.nx + w.nd) - (e.own + e.nz)) < 1e-5, `z ${z.toFixed(2)}: the east pixel's share meets across the edge`);
    assert.ok(Math.abs((w.own + w.nz) - (e.nx + e.nd)) < 1e-5);
  }
  // across the north edge: (PX, PY)'s north neighbour is (PX, PY - 1), whose south edge is z = 0
  for (const [x] of points(200)) {
    const s = shareOf(PX, PY, x, PIXEL - 1e-7), n = shareOf(PX, PY - 1, x, 1e-7);
    assert.ok(Math.abs((s.nz + s.nd) - (n.own + n.nx)) < 1e-5, `x ${x.toFixed(2)}: the north pixel's share meets across the edge`);
  }
  // the four about the north-east corner of (PX, PY), each just inside its own quarter of the corner
  const e = 1e-7;
  for (let i = 0; i < 40; i++) {
    const sw = shareOf(PX, PY, PIXEL - e, PIXEL - e), se = shareOf(PX + 1, PY, e, PIXEL - e);
    const nw = shareOf(PX, PY - 1, PIXEL - e, e), ne = shareOf(PX + 1, PY - 1, e, e);
    // the weight each gives the south-west pixel (PX, PY)
    const wSW = [sw.own, se.nx, nw.nz, ne.nd];
    for (const v of wSW) assert.ok(Math.abs(v - wSW[0]) < 1e-5, `the corner's south-west weight, alike from all four: ${wSW}`);
  }
});

test('ECOTONE1: the border\'s shape - along an edge, the neighbour\'s share rises from none to whole across about two hundred metres, through a half at the edge; and it is patches, not a fade: most of the band is wholly one climate or the other (mutants: the stretch dropped; the band halved)', () => {
  const at = (u) => {
    let sum = 0, whole = 0, n = 0;
    for (const [, z] of points(800)) {
      const s = ecotoneShares(PX, PY, PIXEL - 1e-9 + u, z, undefined, 1);   // x-seam only: u metres past the east edge, read in this pixel's frame
      const share = s.nx + s.nd;
      sum += share; n++;
      if (share < 0.02 || share > 0.98) whole++;
    }
    return { share: sum / n, whole: whole / n };
  };
  const prof = [-150, -100, -50, 0].map((u) => +at(u).share.toFixed(2));
  assert.ok(prof[0] < 0.02, `150 m inside, nearly none (${prof})`);
  assert.ok(prof[1] > 0 && prof[1] < 0.15, `100 m inside, a few islands (${prof})`);
  assert.ok(prof[2] > 0.15 && prof[2] < 0.45, `50 m inside, a fair share (${prof})`);
  assert.ok(prof[3] > 0.4 && prof[3] < 0.6, `at the edge, about half (${prof})`);
  assert.ok(at(-50).whole > 0.7, 'most of the band is one climate or the other, wholly - patches with soft rims');
});

test('ECOTONE1: the owner of a point - the climate whose pixels share it most, the pixel\'s own on a tie; a seam with the same climate across it and one along the far row moves nothing, and asking it would answer the same (mutants: the skip on the wrong axis; the own key not the tie\'s)', () => {
  const keys = [[1, 1, 1, 1, 1, 2, 1, 1, 2], [1, 1, 1, 1, 1, 1, 1, 2, 2], [3, 3, 3, 1, 1, 2, 1, 1, 2], [1, 2, 1, 2, 1, 2, 1, 2, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1]];
  for (const k of keys) {
    const key = (dx, dz) => k[(dz + 1) * 3 + dx + 1];
    for (const [x, z] of points(600)) {
      const got = ecotoneOwner(PX, PY, x, z, key);
      // the reference: every axis asked, the climates summed
      const s = ecotoneShares(PX, PY, x, z, undefined, 3);
      const w = new Map();
      for (const [dx, dz, v] of [[0, 0, s.own], [s.sx, 0, s.nx], [0, s.sz, s.nz], [s.sx, s.sz, s.nd]]) w.set(key(dx, dz), (w.get(key(dx, dz)) ?? 0) + v);
      let best = key(0, 0), bw = w.get(best);
      for (const [kk, v] of w) if (v > bw) { best = kk; bw = v; }
      assert.equal(key(got[0], got[1]), best, `keys ${k} at ${x.toFixed(1)},${z.toFixed(1)}`);
      if (best === key(0, 0)) assert.deepEqual(got, [0, 0]);
    }
  }
});

test('ECOTONE1: the GLSL is the JS - the hash bit for bit, the lattice noise and the seam\'s share to the float, and the ground\'s blend the shares by slot, under two neighbourhoods (one whose corner differs from both its sides, where neither seam may be skipped) (mutants: any term of either side; a skip on the wrong rule)', () => {
  const origin = ecoOrigin(PX, PY);
  const colour = { uEcoArr1: [1, 0, 0, 1], uEcoArr2: [0, 1, 0, 1], uEcoArr3: [0, 0, 1, 1] };
  const layouts = [
    { slots: { W: 0, E: 1, S: 0, N: 2, SW: 0, SE: 1, NW: 2, NE: 3 }, least: 40 },
    { slots: { W: 0, E: 0, S: 0, N: 0, SW: 3, SE: 1, NW: 2, NE: 3 }, least: 5 },   // every side the pixel's own, every corner another's: only the corners blend
  ];
  for (const { slots, least } of layouts) {
    const fns = glslFunctions(ecotoneGlsl(''), {
      uEcoSide: [slots.W, slots.E, slots.S, slots.N], uEcoCorner: [slots.SW, slots.SE, slots.NW, slots.NE], uEcoOrigin: [origin[0], origin[1], 1],
      textureGrad: (smp) => colour[smp],
    });
    for (const [ix, iz, salt] of [[0, 0, 0], [30720, 42496, 101], [-7, 99999, 4294967295], [123456, 7, 214]]) assert.equal(fns.ecoHash([ix, iz], salt), ecoHash(ix, iz, salt), `hash ${ix},${iz},${salt}`);
    for (const [x, z] of points(120)) {
      const tx = x / 6.4, tz = z / 6.4;
      for (const cell of [64, 8, 2]) assert.ok(Math.abs(fns.ecoNoise([tx, tz], cell, 103) - ecoNoise(origin, tx, tz, cell, 103)) < 1e-12);
      const u = (x % 300) - 150;
      assert.ok(Math.abs(fns.ecoShare(u, [tx, tz], 101) - ecoShare(origin, u, tx, tz, 101)) < 1e-12, `share at u ${u}`);
    }
    // the blend: own black, sets 1-3 red, green, blue - the result is each slot's weight
    const bySlot = (sh) => {
      const w = [0, 0, 0, 0];
      const nx = sh.sx < 0 ? slots.W : slots.E, nz = sh.sz < 0 ? slots.S : slots.N;
      const nd = sh.sz < 0 ? (sh.sx < 0 ? slots.SW : slots.SE) : (sh.sx < 0 ? slots.NW : slots.NE);
      w[0] += sh.own; w[nx] += sh.nx; w[nz] += sh.nz; w[nd] += sh.nd;
      return w;
    };
    let blended = 0;
    const corners = [[0, 160, 0, 160], [660, PIXEL, 0, 160], [0, 160, 660, PIXEL], [660, PIXEL, 660, PIXEL]];
    for (const [x, z] of [...points(200), ...corners.flatMap(([x0, x1, z0, z1]) => points(80, x0, x1, z0, z1))]) {
      const got = fns.ecotone([0, 0, 0], [x, z], [0.5, 0.5, 2], [0.01, 0], [0, 0.01]);
      const want = bySlot(ecotoneShares(PX, PY, x, z));
      for (let k = 1; k <= 3; k++) assert.ok(Math.abs(got[k - 1] - want[k]) < 1e-9, `slot ${k} at ${x.toFixed(1)},${z.toFixed(1)}: ${got} against ${want}`);
      if (want[1] + want[2] + want[3] > 0.01) blended++;
    }
    assert.ok(blended > least, `the neighbours blend in (${blended})`);
    // the switch off: the pixel's own texel, untouched
    fns.globals.uEcoOrigin = [origin[0], origin[1], 0];
    assert.deepEqual(fns.ecotone([0.2, 0.3, 0.4], [PIXEL - 1, PIXEL - 1], [0.5, 0.5, 2], [0.01, 0], [0, 0.01]), [0.2, 0.3, 0.4]);
  }
});

test('ECOTONE1: both terrain programs sample their neighbours right after their own tile - the lane decoding them as it decodes its own; the clip variant still the plain program and one line; the units free in both (mutants: the call dropped from either; the lane\'s neighbours undecoded)', () => {
  const r = read('src/render/renderer.js');
  const classic = r.slice(r.indexOf('const TERRAIN_FS = `'), r.indexOf('}`;', r.indexOf('const TERRAIN_FS = `')));
  assert.match(classic, /\$\{ecotoneGlsl\(\)\}/);
  assert.match(classic, /vec3 tex = textureGrad\(uTileArr, vec3\(tuv, float\(layer\)\), gx, gy\)\.rgb;\n {2}tex = ecotone\(tex, vLocalXZ, vec3\(tuv, float\(layer\)\), gx, gy\);/);
  assert.match(EL_TERRAIN_FS, /vec3 tex = elDecode\(textureGrad\(uTileArr, vec3\(tuv, float\(layer\)\), gx, gy\)\.rgb\);\n {2}tex = ecotone\(tex, vLocalXZ, vec3\(tuv, float\(layer\)\), gx, gy\);/);
  assert.match(EL_TERRAIN_FS, /c \+= w\.y \* elDecode\(textureGrad\(uEcoArr1, tl, gx, gy\)\.rgb\);/, 'the lane blends in its own linear light');
  assert.match(ecotoneGlsl(''), /c \+= w\.y \* \(textureGrad\(uEcoArr1, tl, gx, gy\)\.rgb\);/, 'the classic program in its display values');
  // a phone's mediump int is sixteen bits: the origin runs to 128,000 and the hash wraps at 2^32, so every integer of the
  // chunk says highp itself (a fragment stage's ints are mediump unless they say)
  for (const re of [/uniform highp ivec3 uEcoOrigin;/, /float ecoHash\(highp ivec2 c, highp uint salt\) \{\n {2}highp uint h = /, /highp ivec2 i = uEcoOrigin\.xy \/ cell \+ ivec2\(fl\);/, /float ecoShare\(float u, vec2 lt, highp uint salt\)/]) {
    assert.match(ecotoneGlsl(''), re, 'highp: ' + re);
  }
  assert.equal(RENDER.terrainClipFs(EL_TERRAIN_FS).split('\n').length, EL_TERRAIN_FS.split('\n').length + 1);
  // the terrain programs' other samplers: units 0 and 2, the lane's 8-14 and the cloud's 15 - never 3, 4 or 5
  assert.deepEqual([RENDER.CLOUD_SHADOW_UNIT, RENDER.BB_SURFACE_UNIT], [15, 6]);
  for (const u of ECO_UNITS) assert.ok(u > 2 && u < 6);
});

/** A recording GL: every call by name, uniforms by their location's name, binds by unit. */
function recordingGl() {
  const log = [];
  let unit = 0, ids = 0;
  const enums = new Map();
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'drawingBufferWidth') return 320;
      if (k === 'drawingBufferHeight') return 200;
      if (k.toUpperCase() === k) { if (!enums.has(k)) enums.set(k, 0x9000 + enums.size); return enums.get(k); }
      switch (k) {
        case 'getProgramParameter': case 'getShaderParameter': return () => true;
        case 'getAttribLocation': return () => 0;
        case 'getParameter': return () => new Float32Array(4);
        case 'getExtension': return () => null;
        case 'getUniformLocation': return (p, name) => ({ name });
        case 'activeTexture': return (u) => { unit = u - enums.get('TEXTURE0'); };
        case 'bindTexture': return (target, tex) => { log.push({ k, unit, target, tex }); };
        default:
          if (k.startsWith('create')) return () => ({ id: ++ids });
          if (k.startsWith('uniform')) return (loc, ...args) => { log.push({ k, name: loc?.name, args: args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a)) }); };
          return () => {};
      }
    },
  });
  return { gl, log, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('ECOTONE1: the terrain draw hands a border pixel\'s neighbours - their sets on units 3-5, shadowed across the frame\'s border pixels, the slots and the origin; any other pixel turns the switch off, once a frame (mutants: the binds unshadowed; the switch left on; the slots swapped)', () => {
  const rig = recordingGl();
  const r = new RENDER.Renderer(rig.canvas);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  const surface = { vao: {}, indexCount: 6 };
  const A = { id: 'set A' }, B = { id: 'set B' };
  const eco = { tex: [A, B, null], side: Int32Array.of(0, 1, 0, 2), corner: Int32Array.of(0, 1, 2, 2), origin: Int32Array.of(30720, 42496, 1) };
  const at = rig.log.length;
  r.drawTerrain(surface, I, { id: 'own' }, { id: 'tilemap' }, 6.4, false, eco);
  const d1 = rig.log.slice(at);
  const binds = d1.filter((e) => e.k === 'bindTexture' && e.unit >= 3 && e.unit <= 5).map((e) => [e.unit, e.tex?.id]);
  assert.deepEqual(binds, [[3, 'set A'], [4, 'set B']], 'the sets on their units, the empty slot bound to nothing');
  const u = (log, name) => log.filter((e) => e.name === name).map((e) => e.args);
  assert.deepEqual(u(d1, 'uEcoSide'), [[[0, 1, 0, 2]]]);
  assert.deepEqual(u(d1, 'uEcoCorner'), [[[0, 1, 2, 2]]]);
  assert.deepEqual(u(d1, 'uEcoOrigin'), [[[30720, 42496, 1]]]);
  assert.deepEqual(u(d1, 'uEcoArr1').concat(u(d1, 'uEcoArr2'), u(d1, 'uEcoArr3')), [[3], [4], [5]], 'the samplers on their units, the frame\'s block');
  // a second border pixel with the same sets: no rebind
  const at2 = rig.log.length;
  r.drawTerrain(surface, I, { id: 'own' }, { id: 'tilemap' }, 6.4, false, eco);
  assert.equal(rig.log.slice(at2).filter((e) => e.k === 'bindTexture' && e.unit >= 3 && e.unit <= 5).length, 0, 'shadowed');
  // a pixel with none: the switch off, once
  const at3 = rig.log.length;
  r.drawTerrain(surface, I, { id: 'own' }, { id: 'tilemap' }, 6.4, false, null);
  r.drawTerrain(surface, I, { id: 'own' }, { id: 'tilemap' }, 6.4, false, null);
  assert.deepEqual(u(rig.log.slice(at3), 'uEcoOrigin'), [[0, 0, 0]], 'off, and not again while it stays off');
  // the next frame forgets every shadow: the switch goes off again at its first plain pixel
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  const at4 = rig.log.length;
  r.drawTerrain(surface, I, { id: 'own' }, { id: 'tilemap' }, 6.4, false, null);
  assert.deepEqual(u(rig.log.slice(at4), 'uEcoOrigin'), [[0, 0, 0]]);
});

const flat = (record = 2) => ({ heights: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.05), tiles: new Uint8Array(128 * 128).fill(record) });
const TEMPERATE = 300, MOUNTAIN = 100, DESERT = 0;
const opts = (extra = {}) => ({ mapPixelX: PX, mapPixelY: PY, rawWorldHeight: 100, climateType: TEMPERATE, locationRect: null, forests: { archive: 504, pois: [] }, ...extra });
const eastIs = (archive, type) => ({ nature: [504, 504, 504, 504, 504, archive, 504, 504, 504], type: [TEMPERATE, TEMPERATE, TEMPERATE, TEMPERATE, TEMPERATE, type, TEMPERATE, TEMPERATE, TEMPERATE] });
const key = (f) => `${f.x.toFixed(6)},${f.z.toFixed(6)}`;

test('ECOTONE1: the layout at a border - no border, or one of the pixel\'s own climate, is the layout as it was, flat for flat; between two wooded climates every flat stands where it stood and the border\'s take the neighbour\'s archive and its own kind of record (mutants: the owner\'s archive not carried; the woods\' dice the climate\'s)', () => {
  const { heights, tiles } = flat();
  const plain = layoutNature(heights, tiles, opts());
  const same = (a, b) => a.length === b.length && a.every((f, i) => f.record === b[i].record && f.x === b[i].x && f.z === b[i].z && f.archive === b[i].archive);
  assert.ok(same(layoutNature(heights, tiles, opts({ ecotone: null })), plain));
  assert.ok(same(layoutNature(heights, tiles, opts({ ecotone: eastIs(504, TEMPERATE) })), plain), 'a border of the pixel\'s own climate');
  const border = layoutNature(heights, tiles, opts({ ecotone: eastIs(510, MOUNTAIN) }));
  assert.deepEqual(border.map(key).sort(), plain.map(key).sort(), 'every flat where it stood');
  const theirs = border.filter((f) => f.archive === 510);
  const eastOwns = (f) => {
    const tx = Math.floor(f.x / 6.4), tz = Math.floor(f.z / 6.4);
    const [dx, dz] = ecotoneOwner(PX, PY, (tx + 0.5) * 6.4, (tz + 0.5) * 6.4, (ax, az) => (ax === 1 && az === 0 ? 510 : 504));
    return dx === 1 && dz === 0;
  };
  assert.equal(theirs.length, plain.filter(eastOwns).length, 'exactly the flats on the tiles the mountains own');
  assert.ok(theirs.length > 50, `and there are some (${theirs.length})`);
  assert.ok(border.every((f) => f.archive === undefined || f.archive === 510));
  assert.ok(theirs.every((f) => f.x > PIXEL - ECOTONE_REACH - 6.4), 'only within the border\'s reach of the east edge');
  const before = new Map(plain.map((f) => [key(f), f]));
  for (const f of theirs) assert.equal(isTreeRecord(510, f.record), isTreeRecord(504, before.get(key(f)).record), 'a Tree for a Tree, cover for cover');
  for (const f of theirs) assert.ok(isTreeRecord(510, f.record) ? TREE_RECORDS[510].includes(f.record) : f.record >= 1 && f.record <= 31);
  // the owner of each is the mountains', by the ground's own border
  for (const f of theirs) {
    const tx = Math.floor(f.x / 6.4), tz = Math.floor(f.z / 6.4);
    assert.deepEqual(ecotoneOwner(PX, PY, (tx + 0.5) * 6.4, (tz + 0.5) * 6.4, (dx, dz) => (dx === 1 && dz === 0 ? 510 : 504)), [1, 0]);
  }
});

test('ECOTONE1: a desert across the border lays its tiles by DFU\'s scatter law on the tile\'s own dice - at the tile\'s corner, its records any of 31, about a quarter as thick; the pixel\'s own tiles keep their flats (mutants: the desert\'s scale dropped; the corner the woods\' inset)', () => {
  const { heights, tiles } = flat();
  const plain = layoutNature(heights, tiles, opts());
  const border = layoutNature(heights, tiles, opts({ ecotone: eastIs(503, DESERT) }));
  const theirs = border.filter((f) => f.archive === 503), mine = border.filter((f) => f.archive === undefined);
  assert.ok(theirs.length > 20, `the desert's flats (${theirs.length})`);
  assert.ok(theirs.every((f) => Number.isInteger(+(f.x / 6.4).toFixed(9)) && Number.isInteger(+(f.z / 6.4).toFixed(9))), 'at their tiles\' corners');
  const plainKeys = new Set(plain.map(key));
  assert.ok(mine.every((f) => plainKeys.has(key(f))), 'the pixel\'s own flats are its layout\'s');
  // the desert's tiles: how many tiles it owns, and the share that stand a flat - DFU's grass chance, 0.9, the WOODS
  // byte's elevation scale (100 / 128) and the desert's quarter
  let owned = 0;
  for (let tz = 0; tz < 128; tz++) for (let tx = 100; tx < 128; tx++) {
    const [dx, dz] = ecotoneOwner(PX, PY, (tx + 0.5) * 6.4, (tz + 0.5) * 6.4, (ax, az) => (ax === 1 && az === 0 ? '503' : '504'));
    if (dx === 1 && dz === 0) owned++;
  }
  const rate = theirs.length / owned, want = 0.9 * (100 / 128) * 0.25;
  assert.ok(Math.abs(rate - want) < 0.05, `a desert tile stands a flat at ${rate.toFixed(3)} against DFU's ${want.toFixed(3)}`);
});

test('ECOTONE1: the switch - the row, the enhanced skin, ?ecotone=off; online the room\'s', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.climateBlend;
  assert.equal(pref, true, 'on by default');
  try {
    setUiSkin('enhanced'); setPref('climateBlend', true);
    assert.equal(climateBlendOn(''), true);
    assert.equal(climateBlendOn('?ecotone=off'), false, 'the kill door');
    setPref('climateBlend', false);
    assert.equal(climateBlendOn(''), false, 'the row is the switch');
    assert.equal(climateBlendOn('?online=1'), true, 'online: the border moves the room\'s flats');
    setPref('climateBlend', true); setUiSkin('classic');
    assert.equal(climateBlendOn(''), false, 'offline, the classic skin keeps DFU\'s straight edge');
    assert.equal(climateBlendOn('?online=1&ecotone=off'), true);
  } finally { setUiSkin(skin); setPref('climateBlend', pref); }
  assert.equal(onlineForcedPref('climateBlend', '?online=1'), true);
  const row = FEATURES.find((f) => f.id === 'climate-blend');
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'climateBlend', initial: true, online: true });
  assert.equal(floraSwayOf(510, new Set([504, 510]), 10), 1, 'a border pixel\'s other nature sways as its own does');
  assert.equal(floraSwayOf(210, new Set([504, 510]), 10), 0);
});

test('ECOTONE1: the world host - the 3x3 read once a build; the kernel handed the border\'s natures; the neighbours\' sets loaded through the one tile-set home and held by the pixel; the slots in the shader\'s order; the draw, the grass and the flats by the border (mutants: the slots W/E swapped; a neighbour\'s set unheld; the grass the pixel\'s own set)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const ecotones = climateBlendOn\(\);/);
  assert.equal((w.match(/climateBlendOn\(/g) ?? []).length, 1);
  assert.match(w, /const near = ecotones \? climates3x3\(px, py, climate\) : null;/);
  assert.match(w, /ecotone: natureBorder,/);
  assert.match(read('src/world/terrainGen.js'), /ecotone,   \/\/ ECOTONE1/);
  assert.match(w, /const loadGroundSet = async \(groundArchive, hold\) => \{\n\s+hold\.tileArray\(groundArchive\); const groundTex = await getTexture\(groundArchive\);/, 'the one home, held for the pixel');
  assert.match(w, /await loadGroundSet\(groundArchive, pipeline\);/);
  assert.match(w, /for \(const a of archives\) await loadGroundSet\(a, pipeline\);/);
  assert.match(w, /side: Int32Array\.of\(slot\(3\), slot\(5\), slot\(1\), slot\(7\)\),/, 'W, E, S, N of the 3x3 indexed (dz + 1) * 3 + (dx + 1)');
  assert.match(w, /corner: Int32Array\.of\(slot\(0\), slot\(2\), slot\(6\), slot\(8\)\),/, 'SW, SE, NW, NE');
  assert.match(w, /out\[\(dz \+ 1\) \* 3 \+ dx \+ 1\] = \(dx === 0 && dz === 0\) \|\| x < 0 \|\| y < 0 \|\| x >= MAP_W \|\| y >= MAP_H \? own : getWorldClimateSettings\(maps\.getClimateIndex\(x, y\)\);/, 'north is the row above: y = py - dz');
  assert.match(w, /const y = py - dz|x = px \+ dx, y = py - dz/);
  assert.match(w, /const ga = p\.ecoGround \? borderGround\(p, lx, lz\) : p\.groundArchive;/, 'the grass by the border');
  assert.match(w, /return groundMeanColour\.get\(p\.ecoGround \? borderGround\(p, lx, lz\) : p\.groundArchive\)\?\.\[rec\] \?\? null;/);
  assert.match(w, /const i = addFlat\(archive, f\.record, f\.x, f\.y, f\.z\);/, 'a border flat its own climate\'s archive');
  assert.match(w, /batch\.sway = floraSwayOf\(archive, natureSet, plain\.h\);/);
  assert.match(read('src/scenes/treeHost.js'), /const base = n\.flat\?\.base \?\? f\.base, archive = n\.flat\?\.archive \?\? f\.archive;/, 'a felled border tree\'s own stump');
});
