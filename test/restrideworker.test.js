// PERF-EXT-C7 (2026-09-25, the players: "fps issues in the exterior but
// fine in the interior", "me too my friend.. don't know why. I got a
// RX6600") - STREAM1'S PROMOTIONS ON THE TERRAIN WORKER. A crossing
// promotes five pixels to stride 1, and STREAM1 paid them one a frame on
// the main thread - ~1.8 ms of grid a frame for five frames. The worker
// already builds this very grid for every pixel; now it answers the
// promotions too, and the queue is the fallback it always was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateSamples, ghostSampler } from '../src/world/terrainSampler.js';
import { buildTerrainGrid } from '../src/world/terrainSurface.js';
import * as TG from '../src/world/terrainGen.js';
import { TerrainGenClient } from '../src/world/terrainGenClient.js';
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

/** a WOODS.WLD the real reader loads: every cell at one offset, a sloping heightmap (AUDIT 58 F4's shape) */
function syntheticWoodsBytes() {
  const offsetsStart = 32 + 28 * 4;
  const cellsStart = offsetsStart + MAP_WIDTH * MAP_HEIGHT * 4;
  const heightMapOffset = cellsStart + 2 * (22 + 25);
  const out = new Uint8Array(heightMapOffset + MAP_WIDTH * MAP_HEIGHT);
  const v = new DataView(out.buffer);
  v.setUint32(0, MAP_WIDTH * MAP_HEIGHT * 4, true);
  v.setUint32(4, MAP_WIDTH, true);
  v.setUint32(8, MAP_HEIGHT, true);
  v.setUint32(16, cellsStart, true);
  v.setUint32(28, heightMapOffset, true);
  for (let i = 0; i < MAP_WIDTH * MAP_HEIGHT; i++) v.setUint32(offsetsStart + i * 4, cellsStart, true);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < MAP_WIDTH; x++) out[heightMapOffset + y * MAP_WIDTH + x] = (x * 3 + y * 5) & 0xff;
  return out;
}
const WOODS_BYTES = syntheticWoodsBytes();
const woods = new WoodsFile();
assert.equal(woods.load(WOODS_BYTES.slice()), true);

test('PERF-EXT-C7: restrideGrid is the one grid law - the kernel builds its grid with it, and it is buildTerrainGrid over the kept samples with the woods\' ghost rows', () => {
  assert.equal(typeof TG.restrideGrid, 'function');
  for (const [px, py] of [[200, 150], [431, 222]]) {
    const samples = generateSamples(woods, px, py);
    for (const stride of [1, 4]) {
      const want = buildTerrainGrid(samples, stride, ghostSampler(woods, px, py));
      const got = TG.restrideGrid({ woods, px, py, stride, samples });
      assert.equal(bytes(got.positions), bytes(want.positions), `${px},${py} stride ${stride}: positions`);
      assert.equal(bytes(got.normals), bytes(want.normals), `${px},${py} stride ${stride}: normals`);
    }
  }
  const src = readFileSync(new URL('../src/world/terrainGen.js', import.meta.url), 'utf8');
  assert.match(src, /const grid = restrideGrid\(\{ woods, px, py, stride, samples \}\);/, 'the build runs the same law');
});

test('PERF-EXT-C7: the REAL worker shell answers a grid job by its id, the bytes the main thread builds, its arrays transferred - and a grid before init says so under its id', async () => {
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg, transfer) => posted.push({ msg, transfer });
  try {
    await import('../src/world/terrainGenWorker.js');
    const samples = generateSamples(woods, 300, 180);
    globalThis.onmessage({ data: { t: 'grid', id: 7, px: 300, py: 180, stride: 1, samples } });
    assert.deepEqual([posted.at(-1).msg.t, posted.at(-1).msg.id], ['gridError', 7], 'before init: an error under the id, never the FIFO\'s');
    assert.match(posted.at(-1).msg.message, /before init/);
    globalThis.onmessage({ data: { t: 'init', woodsBytes: WOODS_BYTES.slice() } });
    globalThis.onmessage({ data: { t: 'grid', id: 8, px: 300, py: 180, stride: 1, samples } });
    const { msg, transfer } = posted.at(-1);
    assert.deepEqual([msg.t, msg.id], ['grid', 8]);
    const want = TG.restrideGrid({ woods, px: 300, py: 180, stride: 1, samples });
    assert.equal(bytes(msg.positions), bytes(want.positions), 'the worker\'s grid is the main thread\'s, byte for byte');
    assert.equal(bytes(msg.normals), bytes(want.normals));
    assert.deepEqual(transfer, [msg.positions.buffer, msg.normals.buffer], 'both arrays transferred back');
    // a grid needs no network: one asked while the network is still being fetched is answered at once
    const roadsSettled = new Promise((resolve) => {
      const inner = globalThis.postMessage;
      globalThis.postMessage = (m, t) => { inner(m, t); if (m?.t === 'roads') resolve(); };
    });
    globalThis.onmessage({ data: { t: 'roads', settlements: [] } });
    const before = posted.length;
    globalThis.onmessage({ data: { t: 'grid', id: 9, px: 300, py: 180, stride: 1, samples } });
    assert.equal(posted.length, before + 1, 'answered on the spot, not queued behind the roads');
    assert.deepEqual([posted.at(-1).msg.t, posted.at(-1).msg.id], ['grid', 9]);
    await roadsSettled;
  } finally {
    globalThis.postMessage = prevPost;
    globalThis.onmessage = prevOn;
  }
});

test('PERF-EXT-C7: the client sends a grid by id with the samples CLONED, answers by id beside the jobs\' FIFO, and builds on its own thread on a failure, a death or no worker at all', async () => {
  let onmessage = null, terminated = 0;
  const posts = [];
  const fake = { set onmessage(fn) { onmessage = fn; }, set onerror(_fn) {}, postMessage: (msg, transfer) => posts.push({ msg, transfer }), terminate: () => { terminated++; } };
  const c = new TerrainGenClient({ woods, woodsBytes: WOODS_BYTES, workerFactory: () => fake });
  assert.equal(c.threaded, true);
  const samples = generateSamples(woods, 250, 160);
  const want = TG.restrideGrid({ woods, px: 250, py: 160, stride: 1, samples });
  const a = c.grid({ px: 250, py: 160, stride: 1, samples });
  const b = c.grid({ px: 250, py: 160, stride: 1, samples });
  const job = c.generate({ px: 1, py: 2 });   // a pixel job in the FIFO between them
  const sent = posts.filter((p) => p.msg.t === 'grid');
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((p) => p.msg.id), [1, 2], 'each grid its own id');
  assert.ok(sent.every((p) => p.msg.samples === samples && !p.transfer), 'the samples go as a clone - the pixel keeps its own');
  // answered out of order, with a job reply between: each lands on its own promise
  onmessage({ data: { t: 'grid', id: 2, positions: new Float32Array([2]), normals: new Float32Array([2]) } });
  onmessage({ data: { t: 'done', samples: 'the job' } });
  onmessage({ data: { t: 'gridError', id: 1, message: 'boom' } });
  assert.equal((await job).samples, 'the job', 'the FIFO is the jobs\' alone');
  assert.deepEqual([...(await b).positions], [2], 'grid 2 took its own reply');
  const fell = await a;
  assert.equal(bytes(fell.positions), bytes(want.positions), 'a failed grid is built here, the same bytes');
  // a death resolves every grid still out, on this thread
  const d = c.grid({ px: 250, py: 160, stride: 1, samples });
  c._down('gone');
  assert.equal(terminated, 1);
  assert.equal(bytes((await d).normals), bytes(want.normals));
  assert.equal(c.threaded, false, 'and the host falls back to its queue');
  // no worker: answered here at once
  const none = new TerrainGenClient({ woods });
  assert.equal(none.threaded, false);
  assert.equal(bytes((await none.grid({ px: 250, py: 160, stride: 1, samples })).positions), bytes(want.positions));
});

test('PERF-EXT-C7: the host sends every promotion to a worker that is up - on the crossing frame - swaps only a reply its pixel still wants, and keeps STREAM1\'s queue as the fallback', () => {
  const spend = WORLD.slice(WORLD.indexOf('  function spendRestrides() {'), WORLD.indexOf('  function promoteOffThread(p) {'));
  assert.match(spend, /if \(terrainGen\.threaded\) \{\n      for \(const p of restridePending\.values\(\)\) promoteOffThread\(p\);\n      restridePending\.clear\(\);\n      return;\n    \}\n    let budget = RESTRIDE_PER_FRAME;/, 'all at once to the worker, else the one-a-frame queue');
  const off = WORLD.slice(WORLD.indexOf('  function promoteOffThread(p) {'), WORLD.indexOf('  function restrideTerrain('));
  assert.match(off, /if \(built\.get\(key\) !== p\) return;[^\n]*\n    if \(strideFor\(p\.px, p\.py\) === p\._stride\) return;/, 'nothing is sent for a pixel gone or no longer promoted');
  assert.match(off, /terrainGen\.grid\(\{ px: p\.px, py: p\.py, stride: 1, samples: p\.samples \}\)\.then\(\(grid\) => \{\n      if \(built\.get\(key\) !== p\) return;[^\n]*\n      if \(strideFor\(p\.px, p\.py\) !== 1 \|\| p\._stride === 1\) return;[^\n]*\n      restrideTerrain\(p, 1, grid\);/, 'the reply lands only on the pixel that asked, still wanting stride 1');
  assert.match(WORLD, /  function restrideTerrain\(p, stride, grid = restrideGrid\(\{ woods, px: p\.px, py: p\.py, stride, samples: p\.samples \}\)\) \{/, 'one swap, the grid from the worker or built here by the same law');
  assert.match(WORLD, /else \{ restridePending\.delete\(`\$\{p\.px\},\$\{p\.py\}`\); restrideTerrain\(p, want\); \}\n      \}\n      if \(terrainGen\.threaded\) spendRestrides\(\);/, 'the crossing frame sends them, ahead of the new pixels\' jobs');
  assert.doesNotMatch(WORLD, /buildTerrainGrid\(p\.samples/, 'the host keeps no second spelling of the grid');
});
