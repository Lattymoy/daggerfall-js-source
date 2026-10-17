// DOMES (FIELD BUGS 2026-10-04d, the town geometry audit beside the Discord's "missing walls" thread: "stand-ins wrongly
// sized"). Beautiful Cities stands the RMB Resource Pack's three domes - 53182 on two markets, 53187 on two pawnshops,
// 53194 on three gem stores, ten placements, each a misc record over its building's roof. The port draws its own
// stand-in for each (the pack is not carried). Measured now off the pack's published files: their meshes ("HF Dome 03.fbx"
// for 53182 and 53194, "HF Dome 04.fbx" for 53187) are octagons in centimetres, stood at their prefabs' scale of 4.6875 -
// which Daggerfall Unity keeps, MeshReplacement.ImportCustomGameobject multiplying a prefab's own scale in - so each is a
// drum 4.8 m across standing ON its origin, 3.63 m high, a dome over it to 8.43 m and on 03 a spire to 10.75 m. The
// stand-in was a hemisphere 3.6 m high over a drum sunk 1.2 m under the origin, into the roof the author stands it on.
// Pinned: every vertex of each stand-in on the measured profile, the octagon's corners, the three bands' pictures, the
// faces sound, and where the pack places them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

import { RMBRP_PIECES, DOME_UNIT, DOME_PROFILE, DOME_SPIRE, DOME_BANDS } from '../../src/world/townStandIns.js';

/** The meshes as measured (HF Dome 03/04.fbx: [corner radius, height] in centimetres, ring by ring), the prefabs' scale,
 *  and Unity's centimetre: the law the stand-ins are built on, written out here so a change to either is seen. */
const MEASURED = [[102.4, 1.15], [102.4, 77.4], [94.6, 116.6], [72.4, 149.8], [39.2, 172], [19.7, 175.9], [6.4, 179.8]];
const SPIRE = [[4.8, 205.4], [0, 229.4]];
const DOMES = { 53182: { spire: true, bands: ['12_1', '6_2', '6_3'] }, 53187: { spire: false, bands: ['38_1', '38_1'] }, 53194: { spire: true, bands: ['12_1', '6_3', '6_3'] } };

const ring = (m, i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];

test('DOMES the profile: every vertex of each stand-in on the pack\'s own mesh - the drum\'s foot on the origin (5 cm up), 4.8 m across at its corners, 3.63 m high; the dome to 8.43 m; on 53182 and 53194 the spire to 10.75 m (mutants: the scale, a ring, the spire)', () => {
  assert.equal(DOME_UNIT, 0.046875, 'a centimetre at the prefabs\' 4.6875');
  assert.deepEqual(DOME_PROFILE, MEASURED);
  assert.deepEqual(DOME_SPIRE, SPIRE);
  for (const [id, { spire }] of Object.entries(DOMES)) {
    const m = RMBRP_PIECES[id]();
    const want = [...MEASURED, ...(spire ? SPIRE : [[0, 179.8]])].map(([r, y]) => [r * 0.046875, y * 0.046875]);
    const hit = new Set();
    const ys = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      const [x, y, z] = ring(m, i), r = Math.hypot(x, z);
      const k = want.findIndex(([wr, wy]) => Math.abs(wr - r) < 1e-4 && Math.abs(wy - y) < 1e-4);
      assert.ok(k >= 0, `${id}: a vertex at radius ${r.toFixed(4)}, ${y.toFixed(4)} up, on no ring of the measured mesh`);
      hit.add(k); ys.push(y);
    }
    assert.equal(hit.size, want.length, `${id}: every ring of the measured mesh stood`);
    assert.deepEqual([Math.min(...ys), Math.max(...ys)].map((v) => +v.toFixed(3)), [0.054, spire ? 10.753 : 8.428], `${id}: foot and top`);
  }
});

test('DOMES the octagon: the corners at every eighth of a turn from +x, as the meshes stand theirs (the stand-in had sixteen)', () => {
  for (const id of Object.keys(DOMES)) {
    const m = RMBRP_PIECES[id](), angles = new Set();
    for (let i = 0; i < m.positions.length / 3; i++) {
      const [x, , z] = ring(m, i);
      if (Math.hypot(x, z) > 1) angles.add(((Math.round((Math.atan2(z, x) * 180) / Math.PI) % 360) + 360) % 360);
    }
    assert.deepEqual([...angles].sort((a, b) => a - b), [0, 45, 90, 135, 180, 225, 270, 315], id);
  }
});

test('DOMES the pictures: the meshes\' three materials by height - the drum and the dome\'s foot to 116.6, the dome to 179.8, the spire - each the picture its prefab names (53182\'s three; 53187 its dome 38_1; 53194 the pair the stand-in wore) (mutants: a band, a picture)', () => {
  assert.deepEqual(DOME_BANDS, [116.6, 179.8]);
  for (const [id, { bands }] of Object.entries(DOMES)) {
    const m = RMBRP_PIECES[id](), seen = new Map();
    for (const sm of m.subMeshes) {
      let top = -Infinity, foot = Infinity;
      for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t++) { const y = ring(m, m.indices[t])[1]; top = Math.max(top, y); foot = Math.min(foot, y); }
      seen.set(`${sm.textureArchive}_${sm.textureRecord}`, [+(foot / 0.046875).toFixed(2), +(top / 0.046875).toFixed(2)]);
    }
    const expect = new Map();
    const span = (k, f, t) => { const e = expect.get(k); expect.set(k, e ? [Math.min(e[0], f), Math.max(e[1], t)] : [f, t]); };
    span(bands[0], 1.15, 116.6); span(bands[1], 116.6, 179.8); if (bands[2]) span(bands[2], 179.8, 229.4);
    assert.deepEqual(seen, expect, `${id}: the bands' pictures`);
  }
});

test('DOMES sound: every face wound to its normal and turned out of the dome (or up, on the crown); no doors', () => {
  for (const id of Object.keys(DOMES)) {
    const m = RMBRP_PIECES[id]();
    assert.deepEqual(m.doors, []);
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => ring(m, m.indices[t + k])), i0 = m.indices[t];
      const n = [m.normals[i0 * 3], m.normals[i0 * 3 + 1], m.normals[i0 * 3 + 2]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, `${id} face ${t / 3}: wound to its normal`);
      const mid = [(a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3];
      assert.ok(n[0] * mid[0] + n[2] * mid[1] >= -1e-9 && n[1] >= -1e-9, `${id} face ${t / 3}: facing out`);
    }
  }
});

test('DOMES placed: the pack\'s ten - misc records over their buildings\' roofs, 238 units up (5.95 m) on the markets and gem stores and 114 (2.85 m) on the pawnshops, where the drum\'s foot stands (the profile above: five centimetres over the record)', () => {
  const pack = JSON.parse(zlib.gunzipSync(readFileSync(new URL('../../vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz', import.meta.url))).toString('utf8'));
  const P = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  const placed = [];
  for (const [name, entry] of Object.entries(pack.files)) {
    const op = P(entry)[2].find((o) => o[0] === 's' && o[1].join('.') === 'RmbBlock.Misc3dObjectRecords');
    for (const row of op?.[2]?.$m ?? []) if (Array.isArray(row) && DOMES[row[0]]) placed.push(`${name.replace('.RMB.json', '')} ${row[0]} ${-row[3] - 4}`);
  }
  assert.deepEqual(placed.sort(), [
    'DAGEMSBL00 53194 238', 'DAGEMSBL00 53194 238', 'GEMSBL00 53194 237', 'GEMSGL00 53194 237', 'MARKAB00 53182 238',
    'MARKAB01 53182 238', 'PAWNBL00 53187 114', 'PAWNBL00 53187 114', 'PAWNGL00 53187 114', 'PAWNGL00 53187 114',
  ]);
});
