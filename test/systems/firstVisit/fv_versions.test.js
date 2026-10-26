// FIRST-VISIT REFRESH ON UPDATE (2026-10-26, the owner: "make sure any of our changes relating to caching do not prevent
// anything from refreshing properly ... scoped to only the things that have changed"; bible/07-Rendering/
// Performance-Priority.md FIRST-VISIT). Every kept answer's VERSION is the pin of its own computation
// (tools/computationPin.mjs), so an update that changes the computation is a new key on every player's next launch, and
// one that does not keeps their answers. Held here: each VERSION is its pin - a change to the code without the new
// pin fails here, with the pin to set; the pin moves with the code the answer comes from (a declaration a root reaches,
// across imports; a shipped data file it reads) and with nothing else (a comment, a line break, a declaration no root
// reaches, a CRLF checkout); and writing an answer sweeps its scope's older keys, so the store does not grow across
// updates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computationPin, computationReach, FIRST_VISIT_COMPUTATIONS } from '../../../tools/computationPin.mjs';
import { staleKey, keptAnswer } from '../../../src/systems/firstVisit/firstVisitStore.js';
import { prefetchGroundTiles, groundTilesKey, keptGroundTiles, _flushGroundTiles, _resetGroundTiles, GROUND_TILES_SCOPE } from '../../../src/world/terrain/groundTilesKept.js';
import { prefetchPortSites, keptPortSitesOn, _flushPortSites, _resetPortSites, PORT_SITES_KEY, PORT_SITES_SCOPE } from '../../../src/world/portSitesKept.js';
import { seaField } from '../../../src/world/portSites.js';
import { keepLandPieces, LAND_PIECES_SCOPE } from '../../../src/systems/travel/landPiecesKept.js';
import { routeGround } from '../../../src/systems/travel/travelRoute.js';
import { keptStandIn, standInScope } from '../../../src/world/ships/standInsKept.js';
import { shipBuildScope, shipBuildKey } from '../../../src/systems/comeSailAway/shipBuildsKept.js';
import { BAY_FIT_SCOPE } from '../../../src/world/tamriel/bayFitKept.js';

const ROOT = new URL('../../../', import.meta.url);

test('FIRST-VISIT REFRESH: every kept answer\'s VERSION is the pin of its own computation - a change to that code without the new pin fails here (mutant: any computation\'s code edited)', async () => {
  for (const [name, c] of Object.entries(FIRST_VISIT_COMPUTATIONS)) {
    const mod = await import(new URL(c.module, ROOT).href);
    const pin = computationPin(c);
    assert.equal(mod[c.constant], pin, `${name}: its computation changed - set ${c.constant} in ${c.module} to '${pin}' (node tools/computationPin.mjs), so every player's kept answer is worked out again`);
  }
});

test('FIRST-VISIT REFRESH: no computation reaches a cache\'s own VERSION - a pin taken over its own value could never be set (mutant: a kept module unskipped)', () => {
  const versions = new Set(Object.values(FIRST_VISIT_COMPUTATIONS).map((c) => `${c.module}#${c.constant}`));
  for (const [name, c] of Object.entries(FIRST_VISIT_COMPUTATIONS)) {
    const reached = [...computationReach(c).seen.keys()].filter((k) => versions.has(k));
    assert.deepEqual(reached, [], `${name} reaches ${reached.join(', ')} - add its module to the computation's skip`);
  }
});

/** A fixture repo: files written, a pin taken. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'fv-pin-'));
  const write = (fs2) => { for (const [p, t] of Object.entries(fs2)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), t); } };
  write(files);
  const pin = () => computationPin({ roots: [['a.js', 'compute']], files: ['data.json'], root });
  return { pin, write, done: () => rmSync(root, { recursive: true, force: true }) };
}
const A = "import { helper } from './b.js';\nconst SCALE = 3;\nexport function compute(x) { return helper(x) * SCALE; }\nexport function unused() { return 1; }\n";
const B = "export const helper = (x) => x + 1;\nexport const other = () => 2;\n";

test('FIRST-VISIT REFRESH: the pin moves with the code the answer comes from - a declaration a root reaches, here or across an import, and a shipped data file - and with nothing else: a comment, a line break, a declaration no root reaches, a CRLF checkout (mutants: the walk stopping at the file; comments tokenised; data unread)', () => {
  const f = fixture({ 'a.js': A, 'b.js': B, 'data.json': '{\n "k": 1\n}\n' });
  try {
    const base = f.pin();
    f.write({ 'a.js': A.replace('const SCALE = 3;', '// the scale\nconst   SCALE = 3;\n') });
    assert.equal(f.pin(), base, 'a comment and layout move nothing');
    f.write({ 'a.js': A.replace('return 1;', 'return 2;') });
    assert.equal(f.pin(), base, 'a declaration no root reaches moves nothing');
    f.write({ 'b.js': B.replace('() => 2', '() => 3') });
    assert.equal(f.pin(), base, 'nor one across the import that the root does not name');
    f.write({ 'data.json': '{\r\n "k": 1\r\n}\r\n' });
    assert.equal(f.pin(), base, 'a CRLF checkout of the data pins the same');
    f.write({ 'a.js': A.replace('const SCALE = 3;', 'const SCALE = 4;') });
    const scaled = f.pin();
    assert.notEqual(scaled, base, 'a constant the root reads moves it');
    f.write({ 'b.js': B.replace('x + 1', 'x + 2') });
    assert.notEqual(f.pin(), scaled, 'and a helper across an import');
    const helped = f.pin();
    f.write({ 'data.json': '{ "k": 2 }\n' });
    assert.notEqual(f.pin(), helped, 'and the shipped data it reads');
  } finally { f.done(); }
});

/** The player's store, with the sweep the real one makes (dataSource.js sweepDerived over staleKey). */
function storeOf() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.get(k) ?? null; },
    async set(k, v) { m.set(k, structuredClone(v)); return true; },
    async sweep(scope, keep) { for (const k of [...m.keys()]) if (staleKey(k, scope, keep)) m.delete(k); return true; },
  };
}
const keysOf = (store, scope) => [...store.m.keys()].filter((k) => k.startsWith(scope));

test('FIRST-VISIT REFRESH: staleKey - a key of the scope that is not the one written; another scope and the written key are never stale (mutants: the scope unread; the kept key swept)', () => {
  assert.equal(staleKey('fv-ground:aaaa:1', 'fv-ground:', 'fv-ground:bbbb:1'), true);
  assert.equal(staleKey('fv-ground:bbbb:1', 'fv-ground:', 'fv-ground:bbbb:1'), false);
  assert.equal(staleKey('fv-bayfit:aaaa', 'fv-ground:', 'fv-ground:bbbb:1'), false);
  assert.equal(staleKey('mw-arm-records:v3:x', 'fv-ground:', 'fv-ground:bbbb:1'), false);
  assert.equal(staleKey('fv-standin:galleon-38131_10:a', standInScope('galleon-38131_1'), 'fv-standin:galleon-38131_1:b'), false, 'a picture\'s scope ends at its name');
});

test('FIRST-VISIT REFRESH: the walks\' ground tiles - a record under a new key sweeps the last, so the store holds one (mutant: no sweep)', async () => {
  const store = storeOf();
  store.m.set('fv-ground:00000000:old:x', new Map());   // an older build's record
  store.m.set('fv-pieces:keep', 1);
  const tiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ tileBitfield: 1, textureRecord: 2 })));
  for (const bytes of [new Uint8Array(70000).fill(1), new Uint8Array(70000).fill(2)]) {
    _resetGroundTiles();
    await prefetchGroundTiles({ blocksBytes: bytes, serving: 'open', store });
    keptGroundTiles('', 'A.RMB', () => tiles);
    await _flushGroundTiles();
    assert.deepEqual(keysOf(store, GROUND_TILES_SCOPE), [groundTilesKey(bytes, 'open')]);
  }
  assert.equal(store.m.get('fv-pieces:keep'), 1, 'another cache\'s key untouched');
  _resetGroundTiles();
});

test('FIRST-VISIT REFRESH: port sites, land pieces and the Bay fit keep one record each; a picture and a ship keep one answer each, beside the others (mutants: no sweep; a scope too wide)', async () => {
  const store = storeOf();
  // port sites: the record under an older pin goes when this one is written
  store.m.set(`${PORT_SITES_SCOPE}00000000`, new Map());
  _resetPortSites();
  await prefetchPortSites(store);
  const W = 48, H = 40, g = { width: W, height: H, blocked: new Uint8Array(W * H), road: new Uint8Array(W * H) };
  keptPortSitesOn(g, seaField(W, H, null, [4, 0]));
  await _flushPortSites();
  assert.deepEqual(keysOf(store, PORT_SITES_SCOPE), [PORT_SITES_KEY]);
  _resetPortSites();
  // land pieces: another ground's pieces replace the last
  for (const h of [30, 40]) await keepLandPieces(routeGround(() => 0, () => h, 10, 16, 8), { roads: new Uint8Array(128) }, store);
  assert.equal(keysOf(store, LAND_PIECES_SCOPE).length, 1);
  // the Bay fit: one, by the shared door
  for (const k of ['a', 'b']) await keptAnswer({ key: `${BAY_FIT_SCOPE}v:${k}`, scope: BAY_FIT_SCOPE, build: () => ({ k }), store });
  assert.deepEqual(keysOf(store, BAY_FIT_SCOPE), [`${BAY_FIT_SCOPE}v:b`]);
  // pictures: each its own scope - two pictures both kept, a picture painted anew replacing its own
  const pic = () => ({ width: 1, height: 1, data: new Uint8Array(4) });
  store.m.set(`${standInScope('test-1_1')}00000000:painted`, pic());   // under an older pin
  await keptStandIn('test-1_10', pic, store);
  await keptStandIn('test-1_1', pic, store);
  assert.equal(keysOf(store, standInScope('test-1_1')).length, 1);
  assert.equal(keysOf(store, standInScope('test-1_10')).length, 1, 'the neighbour picture kept');
  // ships: each ship's scope its own
  assert.ok(shipBuildKey('galleon', 's', '{}', 0, '[]').startsWith(shipBuildScope('galleon')));
  assert.ok(!shipBuildKey('galleon', 's', '{}', 0, '[]').startsWith(shipBuildScope('carrack')));
});

