// EV7 - THE TERRAIN WORKER, pinned with no GL, no DOM, and no game
// data: the kernel IS buildPixel's old prologue (proven against the
// inline sequence as oracle, location blend included), the client's
// fallback IS the old path (no Worker in node, a throwing factory, a
// dying worker and a failed job all resolve through the same-thread
// kernel), the wire protocol copies the WOODS bytes (never transfers
// the reader's own buffer - the RA1 law) and answers a FIFO in order,
// and the worker shell imports only pure modules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateSamples, ghostSampler } from '../src/world/terrainSampler.js';
import { buildTerrainGrid, convertTilemap } from '../src/world/terrainSurface.js';
import { assignTiles, blendLocationTerrain, calcAvgMaxHeight, generateTileData } from '../src/world/terrainTiles.js';
import { layoutNature } from '../src/world/terrainNature.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { TerrainGenClient, terrainThreadDisabled } from '../src/world/terrainGenClient.js';

// The distantland fake woods (the real reader's orientations - the
// large heightmap's y DESCENDS), grown the third method layoutNature's
// rawWorldHeight rides.
const fakeWoods = {
  getHeightMapValuesRange1Dim(mx, my, d) {
    const a = new Float32Array(d * d);
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        a[r + c * d] = 20 + 7 * Math.sin((mx + r) * 0.7) + 5 * Math.cos((my + c) * 1.1);
      }
    }
    return a;
  },
  getLargeHeightMapValuesRange(mx, my, span) {
    const d = span * 3;
    const a = new Float32Array(d * d);
    for (let x = 0; x < d; x++) {
      for (let y = 0; y < d; y++) {
        a[x + y * d] = 3 + 2 * Math.sin((mx * 3 + x) * 0.5 + (my * 3 - y) * 0.3);
      }
    }
    return a;
  },
  getHeightMapValue(px, py) {
    return (px * 7 + py * 3) % 200;
  },
};

/** buildPixel's OLD prologue, inline and verbatim - the oracle. */
function oracle({ px, py, stride = 1, tilemap, locationRect = null, hasLocation = false, climateType }) {
  const samples = generateSamples(fakeWoods, px, py);
  let avg = 0;
  if (hasLocation) {
    [avg] = calcAvgMaxHeight(samples);
    blendLocationTerrain(samples, avg, locationRect);
  }
  assignTiles(generateTileData(samples, px, py), tilemap, true);
  const grid = buildTerrainGrid(samples, stride, ghostSampler(fakeWoods, px, py));
  const tilemapBytes = convertTilemap(tilemap);
  const nature = layoutNature(samples, tilemap, {
    mapPixelX: px, mapPixelY: py,
    rawWorldHeight: fakeWoods.getHeightMapValue(px, py),
    climateType, locationRect,
  });
  return { samples, tilemap, positions: grid.positions, normals: grid.normals, tilemapBytes, avg, nature };
}

test('EV7: the kernel IS the old prologue - a wilderness pixel, bit for bit', () => {
  const job = { px: 207, py: 213, climateType: 231 };
  const want = oracle({ ...job, tilemap: new Uint8Array(128 * 128) });
  const got = generatePixelTerrain({ woods: fakeWoods, ...job, tilemap: new Uint8Array(128 * 128) });
  for (const k of ['samples', 'tilemap', 'positions', 'normals', 'tilemapBytes']) {
    assert.deepEqual([...got[k]], [...want[k]], `${k} identical`);
  }
  assert.equal(got.avg, want.avg);
  assert.deepEqual(got.nature, want.nature, 'the nature layout is the same flats at the same spots');
  assert.ok(got.nature.length > 0, 'the fixture actually grows something');
});

test('EV7: the kernel IS the old prologue - a location pixel blends over the pre-seeded tilemap', () => {
  // the caller's setLocationTiles half, stood in by hand: some tiles
  // written and a rect answered, exactly the data that rides the job
  const seed = () => {
    const t = new Uint8Array(128 * 128);
    for (let y = 40; y < 60; y++) for (let x = 40; x < 60; x++) t[y * 128 + x] = 12;
    return t;
  };
  const rect = { xMin: 40, xMax: 60, yMin: 40, yMax: 60 };
  const job = { px: 207, py: 213, locationRect: rect, hasLocation: true, climateType: 231 };
  const want = oracle({ ...job, tilemap: seed() });
  const got = generatePixelTerrain({ woods: fakeWoods, ...job, tilemap: seed() });
  assert.ok(got.avg > 0, 'the blend average came back for the location layout');
  assert.equal(got.avg, want.avg);
  for (const k of ['samples', 'tilemap', 'positions', 'normals', 'tilemapBytes']) {
    assert.deepEqual([...got[k]], [...want[k]], `${k} identical`);
  }
  // and the blend really ran: the rect's samples differ from unblended
  const raw = generateSamples(fakeWoods, 207, 213);
  assert.notEqual(got.samples[50 * 129 + 50], raw[50 * 129 + 50], 'the location rect planed');
});

test('EV7: no Worker in this host means the same-thread kernel, not a failure', async () => {
  assert.equal(typeof Worker, 'undefined', 'node has no Worker - the case under test');
  const c = new TerrainGenClient({ woods: fakeWoods, woodsBytes: new Uint8Array(8) });
  const job = { px: 207, py: 213, tilemap: new Uint8Array(128 * 128), climateType: 231 };
  const got = await c.generate(job);
  const want = oracle({ px: 207, py: 213, tilemap: new Uint8Array(128 * 128), climateType: 231 });
  assert.deepEqual([...got.samples], [...want.samples]);
  assert.deepEqual(got.nature, want.nature);
});

test('EV7: a factory that throws falls back to this thread', async () => {
  const c = new TerrainGenClient({
    woods: fakeWoods, woodsBytes: new Uint8Array(8),
    workerFactory: () => { throw new Error('workers forbidden here'); },
  });
  const got = await c.generate({ px: 210, py: 213, tilemap: new Uint8Array(128 * 128), climateType: 231 });
  assert.equal(got.samples.length, 129 * 129, 'the kernel still answered');
});

test('EV7: the worker protocol - copied init bytes, cloned job tilemap, FIFO answers, transfer lists', async () => {
  const posted = [];
  let onmessage = null, terminated = 0;
  const fake = {
    set onmessage(fn) { onmessage = fn; },
    set onerror(fn) { this._onerror = fn; },
    postMessage: (msg, transfer) => posted.push({ msg, transfer }),
    terminate: () => { terminated++; },
  };
  const woodsBytes = new Uint8Array([1, 2, 3, 4]);
  const c = new TerrainGenClient({ woods: fakeWoods, woodsBytes, workerFactory: () => fake });

  // init: a COPY crossed, and ITS buffer is in the transfer list -
  // the reader's own bytes were never detached
  assert.equal(posted.length, 1);
  assert.equal(posted[0].msg.t, 'init');
  assert.notEqual(posted[0].msg.woodsBytes.buffer, woodsBytes.buffer, 'a copy, not the reader\'s plane');
  assert.deepEqual([...posted[0].msg.woodsBytes], [1, 2, 3, 4]);
  assert.deepEqual(posted[0].transfer, [posted[0].msg.woodsBytes.buffer]);
  assert.equal(woodsBytes.byteLength, 4, 'the original survives');

  // two jobs in flight (pump + a teleport overlap): the job's tilemap
  // is CLONED by postMessage (no transfer list), so a dying worker can
  // still fall back over intact inputs
  const t1 = new Uint8Array(128 * 128);
  const p1 = c.generate({ px: 1, py: 2, tilemap: t1, climateType: 231 });
  const p2 = c.generate({ px: 3, py: 4, tilemap: new Uint8Array(128 * 128), climateType: 231 });
  assert.equal(posted.length, 3);
  assert.equal(posted[1].transfer, undefined, 'the job crosses by clone, not transfer');
  assert.equal(t1.byteLength, 128 * 128, 'the caller\'s tilemap is intact');

  // answers resolve in arrival order - and EVERY reply field survives
  // the client's mapping (AUDIT EV F-DOC1's sub-gap: avg drives
  // building heights and nature the flats; a dropped field here
  // passed the old suite green)
  const reply = (px) => ({
    t: 'done', px,
    samples: new Float32Array([px]), tilemap: new Uint8Array(1),
    positions: new Float32Array(0), normals: new Float32Array(0),
    tilemapBytes: new Uint8Array(0), avg: px + 0.5,
    nature: [{ record: px, x: 1, y: 2, z: 3 }],
  });
  onmessage({ data: reply(1) });
  onmessage({ data: reply(3) });
  const r1 = await p1, r2 = await p2;
  assert.equal(r1.samples[0], 1);
  assert.equal(r2.samples[0], 3);
  assert.equal(r1.avg, 1.5, 'avg rides the reply - a location\'s buildings stand on it');
  assert.deepEqual(r1.nature, [{ record: 1, x: 1, y: 2, z: 3 }], 'and the nature layout with it');
  assert.equal(r1.tilemapBytes.length, 0, 'tilemapBytes mapped');

  // a failed job resolves through the same-thread kernel over the
  // inputs this side still holds
  const p3 = c.generate({ px: 207, py: 213, tilemap: new Uint8Array(128 * 128), climateType: 231 });
  onmessage({ data: { t: 'error', message: 'boom' } });
  assert.equal((await p3).samples.length, 129 * 129, 'the fallback answered the failed job');
  assert.equal(terminated, 0, 'one bad job does not kill the worker');
});

test('EV7: a worker that dies mid-job resolves every pending build on this thread', async () => {
  let onerror = null;
  const fake = {
    set onmessage(fn) { this._m = fn; },
    set onerror(fn) { onerror = fn; },
    postMessage: () => {},
    terminate: () => {},
  };
  const c = new TerrainGenClient({ woods: fakeWoods, woodsBytes: new Uint8Array(4), workerFactory: () => fake });
  const p = c.generate({ px: 207, py: 213, tilemap: new Uint8Array(128 * 128), climateType: 231 });
  onerror({ message: 'the tab reaped it' });
  assert.equal((await p).samples.length, 129 * 129);
  // and the client stays useful, same-thread, for the rest of the session
  const p2 = await c.generate({ px: 208, py: 213, tilemap: new Uint8Array(128 * 128), climateType: 231 });
  assert.equal(p2.samples.length, 129 * 129);
});

test('EV7: ?terrainthread=off is the escape hatch, in the ?cull=off shape', () => {
  assert.equal(terrainThreadDisabled('?terrainthread=off'), true);
  assert.equal(terrainThreadDisabled('?foo=1&terrainthread=off&bar=2'), true);
  assert.equal(terrainThreadDisabled('?terrainthread=on'), false);
  assert.equal(terrainThreadDisabled(''), false);
  assert.equal(terrainThreadDisabled(undefined), false, 'no location (node) reads as enabled');
});

test('EV7 AUDIT F-DOC1: the REAL shell executes - both error arms answer through real postMessage', async () => {
  // The first cut covered the shell with source pins only; nothing
  // ever ran its onmessage. This drives the actual handler in node:
  // the module IS `globalThis.onmessage = ...`, so importing it and
  // capturing globalThis.postMessage exercises the real wire code
  // (the happy path's field forwarding is made rot-proof structurally
  // - the job crosses as a spread - and pinned below).
  const posted = [];
  const prevPost = globalThis.postMessage;
  const prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrainGenWorker.js');
    assert.equal(typeof globalThis.onmessage, 'function', 'the module is the message loop');
    globalThis.onmessage({ data: { t: 'job', px: 1, py: 2 } });
    assert.equal(posted.at(-1).t, 'error');
    assert.match(posted.at(-1).message, /before init/, 'a job before init says so');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: new Uint8Array(8) } });
    assert.equal(posted.at(-1).t, 'error');
    assert.match(posted.at(-1).message, /WOODS\.WLD failed to load/, 'garbage bytes fail loudly');
    const n = posted.length;
    globalThis.onmessage({ data: { t: 'nonsense' } });
    globalThis.onmessage({ data: null });
    assert.equal(posted.length, n, 'unknown shapes are ignored silently');
  } finally {
    globalThis.postMessage = prevPost;
    globalThis.onmessage = prevOn;
  }
});

test('EV7: the worker shell imports only pure modules and spells the Worker URL the Vite way', () => {
  const shell = readFileSync('src/world/terrainGenWorker.js', 'utf8');
  const imports = [...shell.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../formats/woodsFile.js', './terrainGen.js'],
    'the import graph is exactly the reader and the kernel');
  const code = shell.replace(/\/\/[^\n]*/g, '').replace(/\/\*[^]*?\*\//g, '');
  assert.ok(!/\bdocument\b/.test(code) && !/new Worker/.test(code), 'no DOM, no nested workers');
  assert.ok(shell.includes('globalThis.onmessage = (ev) =>'), 'the message loop is the module');
  // AUDIT EV F-DOC1: the job crosses as a SPREAD - a hand-copied field
  // list was the one place a new kernel input could be dropped with
  // every test green
  assert.ok(shell.includes('generatePixelTerrain({ ...m, woods })'), 'the job forwards whole');
  // the client spells the constructor the way Vite's static analysis
  // bundles (eslint.config.js's RA1 note: never globalThis.Worker)
  const client = readFileSync('src/world/terrainGenClient.js', 'utf8');
  assert.ok(client.includes("new Worker(new URL('./terrainGenWorker.js', import.meta.url), { type: 'module' })"));
});

test('EV7: the world host rides the client and the pinned build contracts stand', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  assert.ok(world.includes('const terrainGen = new TerrainGenClient({ woods, woodsBytes })'),
    'one client, built beside the reader it falls back to');
  assert.ok(world.includes('await terrainGen.generate({'), 'buildPixel awaits the kernel');
  assert.ok(world.includes('setLocationTiles(dfLocation, maps, blocks, seedTilemap)'),
    'the file-object half stays on this thread and rides the job as data');
  // the publish stays atomic and main-side: built.set is still the
  // last act of the build, after the GL uploads and the collider
  const bp = world.slice(world.indexOf('async function buildPixel'), world.indexOf('function restrideTerrain'));
  assert.ok(bp.lastIndexOf('built.set(key,') > bp.lastIndexOf('collider.addMesh'), 'publish follows the collider');
  assert.ok(bp.includes('renderer.createTerrainSurface(positions, normals'), 'GL consumes the reply on this thread');
  // AUDIT EV F-SIM1: one build per pixel, ever in flight - the cache
  // answers a finished pixel, the in-flight map answers a flying one
  // with the SAME promise, so a teleport overlapping a pump build (or
  // a leave-and-return crossing) can never double-build and overwrite
  // a published entry's GL objects
  assert.ok(world.includes('const inFlight = new Map();'), 'the in-flight map exists');
  assert.ok(bp.includes('if (built.has(key)) return built.get(key);'), 'a finished pixel answers from the cache');
  assert.ok(bp.includes('.finally(() => inFlight.delete(key))'), 'and a settled build leaves the map');
  // AUDIT EV F-SIM2: the ring class re-checks at publish - the
  // pixelChanged restride sweep cannot see an unpublished pixel
  assert.ok(bp.includes('if (wantStride !== entry._stride) restrideTerrain(entry, wantStride);'),
    'a crossing during the round trip cannot leave a wrong-class chunk');
  // AUDIT EV F-SIM6: the probe's idle truth covers teleport builds too
  assert.ok(world.includes('queue.length === 0 && !building && inFlight.size === 0'),
    '__streamIdle counts every in-flight build');
});
