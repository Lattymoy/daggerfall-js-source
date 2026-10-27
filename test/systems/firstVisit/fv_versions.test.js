// FIRST-VISIT REFRESH ON UPDATE (2026-10-26, the owner: "make sure any of our changes relating to caching do not prevent
// anything from refreshing properly ... scoped to only the things that have changed"; bible/07-Rendering/
// Performance-Priority.md FIRST-VISIT). Every kept answer's version is the pin of its own computation
// (tools/computationPin.mjs), GENERATED at install and build (scripts/firstVisitPins.mjs -> src/firstVisitPins.js,
// gitignored) and served live by the dev server - nobody bumps a version. Held here: the generator covers every cache
// that keeps answers and yields a pin for each; a cache with no pin throws, never keys on undefined; no pin reads the
// pins themselves; the pin moves with the code the answer comes from (a declaration a root reaches, across imports; a
// shipped data file it reads) and with nothing else (a comment, a line break, a declaration no root reaches); it is the
// same on every OS (CRLF and LF, either path separator); the dev server computes the pins for each page load; and writing an answer sweeps its scope's older keys, so the store does not grow across updates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computationPin, computationReach, FIRST_VISIT_COMPUTATIONS, firstVisitPins } from '../../../tools/computationPin.mjs';
import { pinsSource, firstVisitPinsPlugin, PINS_PATH } from '../../../scripts/firstVisitPins.mjs';
import { staleKey, keptAnswer, keepAnswer, firstVisitPin } from '../../../src/systems/firstVisit/firstVisitStore.js';
import { prefetchGroundTiles, groundTilesKey, keptGroundTiles, _flushGroundTiles, _resetGroundTiles, GROUND_TILES_SCOPE } from '../../../src/world/terrain/groundTilesKept.js';
import { prefetchPortSites, keptPortSitesOn, _flushPortSites, _resetPortSites, portSitesKey, PORT_SITES_SCOPE } from '../../../src/world/portSitesKept.js';
import { seaField } from '../../../src/world/portSites.js';
import { keepLandPieces, LAND_PIECES_SCOPE } from '../../../src/systems/travel/landPiecesKept.js';
import { routeGround } from '../../../src/systems/travel/travelRoute.js';
import { keptStandIn, standInScope } from '../../../src/world/ships/standInsKept.js';
import { shipBuildScope, shipBuildKey } from '../../../src/systems/comeSailAway/shipBuildsKept.js';
import { BAY_FIT_SCOPE } from '../../../src/world/tamriel/bayFitKept.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Every module under src/ (path from the repo root) and its text. */
function sources(dir = 'src', out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) sources(p, out);
    else if (p.endsWith('.js') && p !== PINS_PATH) out.push([p, readFileSync(join(ROOT, p), 'utf8')]);
  }
  return out;
}

test('FIRST-VISIT REFRESH: the generator covers every cache that keeps answers - each module that keeps one asks firstVisitPin, each name it asks is a computation, each computation is asked for, and each yields a pin (mutants: a cache keyed without a pin; a computation left out of the generator)', () => {
  const asked = new Map();   // computation name -> the modules that ask its pin
  const asks = new Set(), keeps = [];
  const all = sources().filter(([p]) => p !== 'src/systems/firstVisit/firstVisitStore.js');
  for (const [p, text] of all) {
    const names = [...text.matchAll(/firstVisitPin\('([A-Za-z]+)'\)/g)].map((m) => m[1]);
    for (const n of names) asked.set(n, [...(asked.get(n) ?? []), p]);
    if (names.length) asks.add(p);
    if (/import\s*\{[^}]*\b(keepAnswer|keptAnswer)\b[^}]*\}\s*from\s*'[^']*firstVisit\/firstVisitStore\.js'/.test(text)) keeps.push([p, text]);
  }
  // a module that keeps answers asks its pin, or takes its key from a module beside it that does (the ships' loader)
  for (const [p, text] of keeps) {
    const near = [...text.matchAll(/from\s*'(\.[^']+)'/g)].map((m) => join(p, '..', m[1]).split(sep).join('/'));
    assert.ok(asks.has(p) || near.some((q) => asks.has(q)), `${p} keeps answers but asks no firstVisitPin - its key would not refresh on an update`);
  }
  assert.ok(keeps.length >= 6, 'the caches were found');
  assert.deepEqual([...asked.keys()].sort(), Object.keys(FIRST_VISIT_COMPUTATIONS).sort(), 'every pin asked for is generated, and every generated pin is asked for');
  const pins = firstVisitPins();
  for (const [name, pin] of Object.entries(pins)) assert.match(pin, /^[0-9a-f]{8}$/, name);
  assert.equal(Object.keys(pins).length, Object.keys(FIRST_VISIT_COMPUTATIONS).length);
});

test('FIRST-VISIT REFRESH: the generated module is the pins, and a cache with no pin throws - never a key on undefined (mutants: a missing pin read as undefined; the module text not the pins)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fv-pins-'));
  try {
    const pins = { groundTiles: '0123abcd', bayFit: 'deadbeef' };
    writeFileSync(join(dir, 'pins.mjs'), pinsSource(pins));
    const mod = await import(`file:///${join(dir, 'pins.mjs').split(sep).join('/')}`);
    assert.deepEqual({ ...mod.FIRST_VISIT_PINS }, pins);
    assert.equal(firstVisitPin('bayFit', mod.FIRST_VISIT_PINS), 'deadbeef');
    assert.throws(() => firstVisitPin('portSites', mod.FIRST_VISIT_PINS), /no pin for portSites/);
    assert.throws(() => firstVisitPin('bayFit', null), /no pin for bayFit/, 'no pins module at all');
    assert.throws(() => firstVisitPin('bayFit', { bayFit: 'undefined' }), /no pin/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('FIRST-VISIT REFRESH: no pin reads the pins themselves, the store or a cache\'s own module beyond its roots - a pin over its own value could never settle (mutant: the generated module unskipped)', () => {
  for (const [name, c] of Object.entries(FIRST_VISIT_COMPUTATIONS)) {
    const files = new Set([...computationReach(c).seen.keys()].map((k) => k.slice(0, k.indexOf('#'))));
    for (const f of [PINS_PATH, 'src/systems/firstVisit/firstVisitStore.js']) assert.ok(!files.has(f), `${name} reaches ${f}`);
  }
});

/** A fixture repo: files written, a pin taken. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'fv-pin-'));
  const write = (fs2) => { for (const [p, t] of Object.entries(fs2)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), t); } };
  write(files);
  const pin = (r = root) => computationPin({ roots: [['a.js', 'compute']], files: ['data.json'], root: r });
  return { root, pin, write, done: () => rmSync(root, { recursive: true, force: true }) };
}
const A = "import { helper } from './b.js';\nconst SCALE = 3;\nexport function compute(x) { return helper(x) * SCALE; }\nexport function unused() { return 1; }\n";
const B = "export const helper = (x) => x + 1;\nexport const other = () => 2;\n";

test('FIRST-VISIT REFRESH: the pin moves with the code the answer comes from - a declaration a root reaches, here or across an import, and a shipped data file - and with nothing else: a comment, a line break, a declaration no root reaches (mutants: the walk stopping at the file; comments tokenised; data unread)', () => {
  const f = fixture({ 'a.js': A, 'b.js': B, 'data.json': '{\n "k": 1\n}\n' });
  try {
    const base = f.pin();
    f.write({ 'a.js': A.replace('const SCALE = 3;', '// the scale\nconst   SCALE = 3;\n') });
    assert.equal(f.pin(), base, 'a comment and layout move nothing');
    f.write({ 'a.js': A.replace('return 1;', 'return 2;') });
    assert.equal(f.pin(), base, 'a declaration no root reaches moves nothing');
    f.write({ 'b.js': B.replace('() => 2', '() => 3') });
    assert.equal(f.pin(), base, 'nor one across the import that the root does not name');
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

test('FIRST-VISIT REFRESH: the same pin on every OS - the same tokens with CRLF or LF line ends, in the code and in the data, and a root named with either path separator; its keys name files with forward slashes (mutants: raw bytes hashed; a native separator in a key)', () => {
  const lf = fixture({ 'a.js': A, 'b.js': B, 'data.json': '{\n "k": 1\n}\n' });
  const crlf = fixture({ 'a.js': A.split('\n').join('\r\n'), 'b.js': B.split('\n').join('\r\n'), 'data.json': '{\r\n "k": 1\r\n}\r\n' });
  try {
    assert.equal(crlf.pin(), lf.pin(), 'CRLF and LF');
    assert.equal(lf.pin(lf.root.split(sep).join('/')), lf.pin(), 'the root with forward slashes');
    if (sep === '\\') assert.equal(lf.pin(lf.root.split('/').join('\\')), lf.pin(), 'and with backslashes');
    const keys = [...computationReach({ roots: [['a.js', 'compute']], root: lf.root }).seen.keys()];
    assert.deepEqual(keys.sort(), ['a.js#SCALE', 'a.js#compute', 'b.js#helper']);
  } finally { lf.done(); crlf.done(); }
});

test('FIRST-VISIT REFRESH: the dev server serves the pins as the walk computes them, under each page load\'s own URL - so a dev edit is a new key at the next load, as an update is - and answers for no other module (mutants: the file on disk served; a load URL\'s query not matched; a native path not matched)', () => {
  const plugin = firstVisitPinsPlugin();
  plugin.configResolved({ root: ROOT, command: 'serve' });
  assert.equal(plugin.load(join(ROOT, 'src/other.js')), null);
  const want = pinsSource(firstVisitPins());
  assert.equal(plugin.load(`${join(ROOT, PINS_PATH).split(sep).join('/')}?load=1700000000000`), want, 'a page load\'s own URL, as Vite keys it');
  assert.equal(plugin.load(join(ROOT, PINS_PATH)), want, 'the native path');
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

test('FIRST-VISIT REFRESH: a refused write sweeps nothing - the older answer stays (mutant: the sweep run whatever the write answered)', async () => {
  const store = storeOf();
  store.m.set(`${BAY_FIT_SCOPE}old`, { k: 'old' });
  store.set = async () => null;   // the player's store, its write refused (a full quota)
  assert.equal(await keepAnswer(store, `${BAY_FIT_SCOPE}new`, { k: 'new' }, BAY_FIT_SCOPE), false);
  assert.deepEqual(keysOf(store, BAY_FIT_SCOPE), [`${BAY_FIT_SCOPE}old`]);
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
  assert.deepEqual(keysOf(store, PORT_SITES_SCOPE), [portSitesKey()]);
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

