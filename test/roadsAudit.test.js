// RA1 — THE ROAD-SYSTEM AUDIT (2026-08-28, Mac: "it gets stuck on
// baking roads when starting a game"). Pins for what the audit changed:
//
//   1. The ROUTER SCRATCH. routeRoad reuses three full-map arrays
//      across calls behind a generation stamp instead of allocating
//      ~6.5MB per call (~110GB across a full bake's ~17,000 calls).
//      The pins here are the ones that make the reuse safe to keep:
//      a later call over a DIFFERENT field must behave exactly as if
//      the arrays were freshly filled - stale g values must read as
//      Infinity, stale closed marks must read as open.
//   2. The SPUR GOAL reads both exit planes directly - hasRoad's own
//      law without roadExitsAt's per-call object, because the
//      predicate runs once per popped node across ~14,800 Dijkstras.
//   3. The ASYNC ROUND TRIP (loadOrBakeRoadsAsync) and the bake seam
//      on roadsForWorld - the door the Worker bake walks through.
//   4. The CLIENT MARSHAL: functions cannot cross postMessage, so the
//      cost field is built main-thread over the real injected laws
//      and only plain data crosses; the heights are COPIED, because
//      transferring the reader's own plane would detach it.
//   5. The WORKER stays a pure-module import graph, and the world
//      host actually hands the off-thread bake to roadsForWorld.

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { routeRoad, buildRoadNetwork, buildCostField, ROAD_TRACK, hasRoad } from '../src/systems/roads.js';
import { serializeRoads, deserializeRoads, loadOrBakeRoadsAsync } from '../src/systems/roadBake.js';
import { roadsForWorld } from '../src/systems/roadsBoot.js';
import { marshalBakeJob, bakeRoadsOffThread } from '../src/systems/roadBakeClient.js';
import { createNetwork, linkPixels } from '../src/systems/roads.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(p, 'utf8');

/** A hand-built flat field - every pixel one cost, no water. */
const flatField = (width, height, c) => ({
  cost: new Float32Array(width * height).fill(c), width, height, minStep: c,
});

// ── 1. the router scratch ────────────────────────────────────────

test('RA1 scratch: a route over a NEW field is untouched by the last call\'s residue', () => {
  // The killing scenario for stale state: call one fills g with SMALL
  // values (cheap ground); call two runs the same endpoints over
  // EXPENSIVE ground. If a stale g leaks - if `seen` is not consulted
  // - every relaxation compares against the old call's tiny numbers,
  // nothing is ever pushed, and the route comes back null. If a stale
  // `closed` mark leaks, the start pixel itself is refused. Either
  // way this test is the tombstone.
  const hb = new Uint8Array(10 * 3);
  const cheap = flatField(10, 3, 1);
  const r1 = routeRoad(cheap, { x: 0, y: 1 }, { x: 9, y: 1 }, { heightBytes: hb });
  assert.ok(r1, 'the cheap route exists');
  assert.equal(r1.path.length, 10, 'straight along the row');
  assert.equal(r1.cost, 9);

  const dear = flatField(10, 3, 1000);
  const r2 = routeRoad(dear, { x: 0, y: 1 }, { x: 9, y: 1 }, { heightBytes: hb });
  assert.ok(r2, 'the expensive route must exist too - stale scratch would kill it');
  assert.equal(r2.cost, 9000, 'priced on ITS field, not the last call\'s');
  assert.equal(r2.path.length, 10);
});

test('RA1 scratch: the same call twice is bit-identical - reuse costs no determinism', () => {
  const hb = new Uint8Array(16 * 16);
  for (let i = 0; i < hb.length; i++) hb[i] = (i * 7) % 40;   // some relief
  const field = () => flatField(16, 16, 3);
  const a = routeRoad(field(), { x: 1, y: 2 }, { x: 14, y: 13 }, { heightBytes: hb });
  const b = routeRoad(field(), { x: 1, y: 2 }, { x: 14, y: 13 }, { heightBytes: hb });
  assert.deepEqual(a.path, b.path);
  assert.equal(a.cost, b.cost);
});

test('RA1 scratch: the source allocates NOTHING per call - the stamp, not the fill', () => {
  // The whole point: ~17,000 calls at the real map used to mean
  // ~110GB of allocation churn. The arrays live in module scratch now
  // and no fresh full-map array is built inside routeRoad.
  const src = read('src/systems/roads.js');
  const body = src.slice(src.indexOf('export function routeRoad'), src.indexOf('export function pathCost'));
  assert.ok(!/new Float64Array\(N\)/.test(body), 'no per-call g plane');
  assert.ok(!/new Int32Array\(N\)/.test(body), 'no per-call from plane');
  assert.ok(!/new Uint8Array\(N\)/.test(body), 'no per-call closed plane');
  assert.match(body, /routerScratch\(N\)/, 'the shared scratch is what it reads');
  assert.match(src, /seen\[ni\] === gen \? g\[ni\] : Infinity/,
    'a cell another call touched must read as the fresh fill\'s Infinity');
});

// ── 2. the spur goal ─────────────────────────────────────────────

test('RA1 spur goal: a spur joins the nearest TRACK, not only the trunk', () => {
  // Geometry: two hubs make a trunk along y=1. Spur A (x=1, y=8) can
  // only join that trunk - a 7-step track down column 1. Spur B
  // (x=4, y=8) is then 3 steps from A's track and 7 from the trunk:
  // the goal test reads BOTH planes, so B's track is short. A goal
  // that read only trunkExits (the allocation fix done wrong) would
  // march B all the way to y=1.
  const width = 12, height = 10;
  const field = flatField(width, height, 1);
  const hb = new Uint8Array(width * height);
  const { network, stats } = buildRoadNetwork({
    field, heightBytes: hb,
    locations: [
      { x: 1, y: 1, locationType: LOCATION_TYPES.TownCity },
      { x: 8, y: 1, locationType: LOCATION_TYPES.TownCity },
      { x: 1, y: 8, locationType: LOCATION_TYPES.HomeFarms },
      { x: 4, y: 8, locationType: LOCATION_TYPES.HomeFarms },
    ],
  });
  assert.equal(stats.trunkLaid, 1);
  assert.equal(stats.spursLaid, 2);
  const tracks = network.segments.filter((s) => s.kind === ROAD_TRACK);
  assert.equal(tracks.length, 2);
  // deterministic order: spur A (pixel id 8001) routes before B (8004)
  const b = tracks[1];
  assert.deepEqual(b.points[0], { x: 4, y: 8 }, 'B\'s own doorstep');
  assert.ok(b.points.length <= 5,
    `B must join A's track beside it (${b.points.length} points laid - a trunk-only goal marches to y=1)`);
  assert.ok(hasRoad(network, 4, 8));
});

// ── 3. the async round trip and the bake seam ────────────────────

/** A small real network and its bytes. */
function smallBake() {
  const n = createNetwork(8, 8);
  for (let x = 1; x < 6; x++) linkPixels(n.trunkExits, 8, x, 3, x + 1, 3);
  return { network: n, bytes: serializeRoads(n) };
}

test('RA1 round trip: a good cache never calls the bake, sync or async', async () => {
  const { bytes, network } = smallBake();
  let baked = 0;
  const r = await loadOrBakeRoadsAsync(bytes, async () => { baked++; return smallBake(); });
  assert.equal(baked, 0);
  assert.equal(r.fromCache, true);
  assert.deepEqual([...r.network.trunkExits], [...network.trunkExits]);
});

test('RA1 round trip: a same-thread answer {network, stats} is awaited and serialized', async () => {
  const { network } = smallBake();
  const r = await loadOrBakeRoadsAsync(null, async () => ({ network, stats: { marker: 7 } }));
  assert.equal(r.fromCache, false);
  assert.equal(r.stats.marker, 7);
  assert.ok(r.bytes instanceof Uint8Array, 'the write-back bytes exist');
  const round = deserializeRoads(r.bytes);
  assert.deepEqual([...round.trunkExits], [...network.trunkExits], 'and they ARE the network');
});

test('RA1 round trip: a worker answer {bytes, stats} is read back through the envelope door', async () => {
  const { bytes, network } = smallBake();
  const r = await loadOrBakeRoadsAsync(null, async () => ({ bytes, stats: { s: 1 } }));
  assert.equal(r.fromCache, false);
  assert.deepEqual([...r.network.trunkExits], [...network.trunkExits],
    'the network must be deserialized from the worker\'s bytes');
  assert.equal(r.bytes, bytes, 'the bytes cross unchanged to the store write');
});

test('RA1 seam: roadsForWorld hands the injected bake the lazy inputs AND the progress', async () => {
  const { network } = smallBake();
  const store = { bytes: null };
  const seen = { inputs: null, progress: [], bakes: 0 };
  const r = await roadsForWorld({
    enabled: true,
    load: async () => null,
    save: async (k, b) => { store.bytes = b; },
    inputs: () => ({ iAmTheInputs: true }),
    onProgress: (p) => seen.progress.push(p),
    bake: async (inp, prog) => {
      seen.bakes++;
      seen.inputs = inp;
      prog({ phase: 'spurs', done: 1, total: 1 });
      return { network, stats: { offThread: true } };
    },
  });
  assert.equal(seen.bakes, 1);
  assert.equal(seen.inputs.iAmTheInputs, true, 'the bake receives inputs(), still lazy');
  assert.deepEqual(seen.progress, [{ phase: 'spurs', done: 1, total: 1 }],
    'the host\'s progress reporter must reach the injected bake');
  assert.equal(r.stats.offThread, true);
  assert.ok(store.bytes instanceof Uint8Array, 'the artifact is still written back');
  assert.deepEqual([...deserializeRoads(store.bytes).trunkExits], [...network.trunkExits]);
});

// ── 4. the client marshal ────────────────────────────────────────

/** Small real inputs, functions and all - the shape bakeInputs answers. */
function smallInputs() {
  const width = 20, height = 12;
  const heightBytes = new Uint8Array(width * height).fill(40);
  return {
    heightBytes, width, height,
    climateAt: () => 231,                    // Woodlands
    isWater: (climate, byte) => byte === 0,  // a deliberately odd law - must be honoured
    locations: [
      { x: 2, y: 2, locationType: LOCATION_TYPES.TownCity, extra: 'must not cross' },
      { x: 16, y: 9, locationType: LOCATION_TYPES.TownCity },
      { x: 9, y: 3, locationType: LOCATION_TYPES.HomeFarms },
    ],
  };
}

test('RA1 marshal: the cost field is built HERE over the real injected laws', () => {
  const inputs = smallInputs();
  const job = marshalBakeJob(inputs);
  const field = buildCostField(inputs);
  assert.deepEqual([...job.cost], [...field.cost], 'the worker receives the finished plane');
  assert.equal(job.minStep, field.minStep);
  assert.equal(job.width, 20);
  assert.equal(job.height, 12);
});

test('RA1 marshal: the heights are a COPY - transferring the reader\'s plane would detach it', () => {
  const inputs = smallInputs();
  const job = marshalBakeJob(inputs);
  assert.notEqual(job.heightBytes, inputs.heightBytes, 'not the same view');
  assert.notEqual(job.heightBytes.buffer, inputs.heightBytes.buffer, 'not the same buffer');
  assert.deepEqual([...job.heightBytes], [...inputs.heightBytes], 'same bytes');
});

test('RA1 marshal: only plain data crosses - no functions, no stray properties', () => {
  const job = marshalBakeJob(smallInputs());
  for (const [k, v] of Object.entries(job)) {
    assert.notEqual(typeof v, 'function', `${k} would not survive postMessage`);
  }
  for (const l of job.locations) {
    assert.deepEqual(Object.keys(l).sort(), ['locationType', 'x', 'y'],
      'locations cross as {x, y, locationType} and nothing else');
  }
});

// ── 5. the client's two paths ────────────────────────────────────

test('RA1 client: no Worker in this host means the same-thread bake, not a failure', async () => {
  // node has no Worker global - which IS the fallback contract.
  assert.equal(typeof Worker, 'undefined');
  const phases = new Set();
  const r = await bakeRoadsOffThread(smallInputs(), ({ phase }) => phases.add(phase));
  assert.ok(r.network, 'a network came back on this thread');
  assert.ok(r.stats.trunkLaid >= 1);
  assert.ok(phases.has('spurs'), 'progress still reports');
});

test('RA1 client: a factory that throws falls back to this thread - roads never take the boot down', async () => {
  const r = await bakeRoadsOffThread(smallInputs(), null, {
    workerFactory: () => { throw new Error('workers forbidden here'); },
  });
  assert.ok(r.network, 'the fallback still answers a network');
});

test('RA1 client: the worker protocol - job posted with transfers, progress relayed, bytes resolved', async () => {
  const { bytes } = smallBake();
  const progress = [];
  const posted = {};
  const fakeWorker = {
    onmessage: null, onerror: null, terminated: false,
    terminate() { this.terminated = true; },
    postMessage(job, transfer) {
      posted.job = job;
      posted.transfer = transfer;
      queueMicrotask(() => {
        this.onmessage({ data: { t: 'progress', phase: 'trunk', done: 2, total: 9 } });
        this.onmessage({ data: { t: 'done', bytes, stats: { fromWorker: true } } });
      });
    },
  };
  const r = await bakeRoadsOffThread(smallInputs(), (p) => progress.push(p), {
    workerFactory: () => fakeWorker,
  });
  assert.equal(r.stats.fromWorker, true);
  assert.equal(r.bytes, bytes, 'the worker\'s buffer is the answer');
  assert.deepEqual(progress, [{ phase: 'trunk', done: 2, total: 9 }]);
  assert.ok(posted.transfer.includes(posted.job.cost.buffer), 'the cost plane is transferred, not cloned');
  assert.ok(posted.transfer.includes(posted.job.heightBytes.buffer), 'so is the heights copy');
  assert.ok(fakeWorker.terminated, 'the worker is released once it has answered');
});

// ── 6. the worker's import hygiene and the host seam ─────────────

test('RA1 worker: a pure-module import graph - a worker has no DOM to lean on', () => {
  const src = read('src/systems/roadBakeWorker.js');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./roadBake.js', './roads.js'],
    'only the two pure road modules - no ui/, no scenes/');
  // comments stripped: the header itself explains the no-DOM law by name
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/\bdocument\b/.test(code), 'no DOM');
  assert.match(src, /postMessage\(\{ t: 'done', bytes, stats \}, \[bytes\.buffer\]\)/,
    'one flat buffer crosses back, transferred');
  assert.match(src, /PROGRESS_EVERY_MS/,
    'progress is throttled at the producer - ~14,800 spur reports are not ~14,800 messages');
});

test('RA1 host: the world host hands roadsForWorld the OFF-THREAD bake', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /import \{ bakeRoadsOffThread \} from '\.\.\/systems\/roadBakeClient\.js'/);
  assert.match(world, /bake: bakeRoadsOffThread,/,
    'the seam is wired, or the boot stalls exactly as reported');
});

// ── 7. the stall's second door, and the sky switch ───────────────

test('RA1: a blocked IndexedDB upgrade SAYS SO instead of hanging silently', () => {
  // indexedDB.open at a bumped version waits forever while an older
  // tab holds the database - onblocked, not onerror - and the boot
  // hangs wearing whatever status line was set last.
  const src = read('src/scenes/dataSource.js');
  assert.match(src, /req\.onblocked = \(\) => \{/, 'the blocked arm exists');
  assert.match(src, /close other (game )?tabs/i, 'and it tells the player the one fix');
});

test('RA1 sky: the switch defaults ON - ES1 is the enhanced skin\'s sky, now with a door', () => {
  assert.equal(PREF_DEFAULTS.proceduralSky, true);
});
