// IC-GRAND's PERF PASS (2026-10-26, the coordinator: "A DISTRICT'S NINE NEAR SLICES NEVER FINISHED within 900 s ... make
// arrival and crossing workable ... off-main-thread work"; bible/03-World/Arena-Provinces.md IC-GRAND, "Off the page's
// thread") - THE CITY'S OWN MADE AHEAD ON A WORKER, pinned: a slice's pieces in the order its build asks them; the worker's
// blocks, the landmarks' footprint laid there (PIN MOVED, IC-FOOTPRINT-OFF-THREAD: it was laid on the page), the page's
// own blocks to the byte, the landmarks' parts the model door's, and its models the family's;
// each piece handed over once, the worker told what the page made itself; the door and the family asking it first; the
// sweep telling it the slices coming, the player's own first, and letting it go out of the city's reach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sliceWork, prebuildDeps, makeWork, imperialPrebuilt, setImperialPrebuild } from '../../src/world/imperialPrebuild.js';
import { createPrebuildWorkerState, DONE_KEEP } from '../../src/world/imperialPrebuildWorker.js';
import { createImperialPrebuild } from '../../src/world/imperialPrebuildClient.js';
import { createCapitalPrebuild, prebuildWanted, PREBUILD_REACH } from '../../src/scenes/capitalPrebuild.js';
import { imperialBlockJson, imperialModelBuild, imperialOwnName, imperialFarName, imperialFabricModelId, imperialSkylineId, NEAR_RING } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_SPAN, IMPERIAL_SLICE_PARTS, IMPERIAL_ARENA_CODE, imperialSlicePlan, imperialCodeCell, polar, imperialFarPartId } from '../../src/world/imperialCity.js';
import { installCapitals, _resetCapitals, capitalFootprint, imperialPartModel } from '../../src/world/capitalModels.js';
import { customModelFor } from '../../src/world/customModels.js';
import { getDFBlockReplacementData, getNewDFBlockIndex, _resetWorldDataReplacement } from '../../src/formats/worldData/worldDataReplacement.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const N = IMPERIAL_SPAN, B = 102.4, HALF = N * 4;
/** The slice a point of the city's metres stands in. */
const sliceAt = (x, z) => Math.floor((z + HALF * B) / (8 * B)) * N + Math.floor((x + HALF * B) / (8 * B));
const MARKET = sliceAt(...polar(30, 3460)), PALACE = sliceAt(...polar(30, 1200));
/** The landmarks' footprint of a slice as the install makes it (its parts and its eight neighbours'). */
const footprintOf = (s) => {
  const sx = s % N, sy = Math.floor(s / N), models = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = sx + dx, y = sy + dy; if (x >= 0 && y >= 0 && x < N && y < N) models.push(...IMPERIAL_SLICE_PARTS[y * N + x]); }
  return models.length ? capitalFootprint({ models }) : null;
};
/** A fake worker running the worker's own state machine, its answers delivered when `flush` says. */
function fakeWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminated: false, queued: [] };
  const state = createPrebuildWorkerState((m) => w.queued.push(m));
  w.postMessage = (m) => { w.sent.push(m); state.on(m); };
  w.terminate = () => { w.terminated = true; };
  w.flush = (n = Infinity) => { for (let i = 0; i < n && state.step(); i++); for (const m of w.queued.splice(0)) w.onmessage?.({ data: m }); };
  w.state = state;
  return w;
}

test('IC-GRAND OFF THE PAGE\'S THREAD - a slice\'s pieces in the order its build asks them: near, its own cells\' blocks in its location\'s order (rows from the south), the landmarks\' parts its carrier stands (IC-FOOTPRINT-OFF-THREAD) and then their fabric\'s models; far, its far blocks, the parts and its carrier\'s skyline (mutants: the models first; a far slice made near; the parts not made)', () => {
  const near = sliceWork(MARKET, true), far = sliceWork(MARKET, false);
  const plan = imperialSlicePlan(MARKET), sx = MARKET % N, sy = Math.floor(MARKET / N), own = [];
  for (let i = 0; i < 64; i++) { const pr = 7 - Math.floor(i / 8), pc = i % 8; if (imperialCodeCell(plan[pr][pc])) own.push([sy * 8 + pr, sx * 8 + pc]); }
  assert.ok(own.length > 40);
  const parts = IMPERIAL_SLICE_PARTS[MARKET].map((id) => ({ kind: 'model', id }));
  // a slice with the landmarks' parts on its carrier: they come after its blocks, before its fabric's models, near or far
  const pp = IMPERIAL_SLICE_PARTS[PALACE], pn = sliceWork(PALACE, true), pf = sliceWork(PALACE, false), firstModel = (l) => l.findIndex((w) => w.kind === 'model');
  assert.ok(pp.length >= 1, 'the Palace District\'s landmarks');
  assert.deepEqual(pn.slice(firstModel(pn), firstModel(pn) + pp.length).map((w) => w.id), pp, 'near: the parts first of its models');
  assert.deepEqual(pf.slice(firstModel(pf), firstModel(pf) + pp.length).map((w) => w.id), pp.map(imperialFarPartId), 'far: the parts first of its models (IC-TOWER-LOD: the coarse ones)');
  assert.deepEqual(near, [...own.map(([r, c]) => ({ kind: 'block', name: imperialOwnName(r, c) })), ...parts, ...own.map(([r, c]) => ({ kind: 'model', id: imperialFabricModelId(r, c) }))]);
  const farCells = [];
  for (let i = 0; i < 64; i++) { const pr = 7 - Math.floor(i / 8), pc = i % 8; if (!['L', 'O', IMPERIAL_ARENA_CODE].includes(plan[pr][pc])) farCells.push([sy * 8 + pr, sx * 8 + pc]); }
  assert.deepEqual(farCells, own, 'the city\'s own cells alone');   // PIN MOVED (IC-PROPS, 2026-10-27): no block of Daggerfall's among them since (world/imperialCity.js cellOf) - Daggerfall's cells stood far only
  assert.deepEqual(far.filter((w) => w.kind === 'block').map((w) => w.name), farCells.map(([r, c]) => imperialFarName(r, c)), 'every cell\'s far view but the lake\'s, the open shore\'s and the arena\'s');
  assert.deepEqual(far.filter((w) => w.kind === 'model'), [...parts, { kind: 'model', id: imperialSkylineId(MARKET) }], 'the parts, then the skyline once, on its carrier');
});

test('IC-GRAND THE WORKER\'S PIECES ARE THE PAGE\'S - IC-FOOTPRINT-OFF-THREAD (PIN MOVED: the footprint was laid on the page): its blocks made with the landmarks\' footprint laid there (closed and bare where a face stands), the page\'s own blocks to the byte; the landmarks\' parts its slices stand made there, the model door\'s own; its models the family\'s; a far block closes nothing; the page\'s model door takes a part the worker made (mutants: the footprint unlaid in the worker; the parts not made; the part not taken; the far block footprinted)', () => {
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });   // the landmarks' parts on the model door, for the footprint
  const deps = prebuildDeps(), pageDeps = { ...deps, footprintOf };
  let closedByFace = 0, bared = 0;
  /** a slice's pieces as the worker's own state makes them */
  const madeBy = (s, near) => {
    const got = new Map(), st = createPrebuildWorkerState((m) => got.set(m.t === 'block' ? `b:${m.name}` : `m:${m.id}`, m.t === 'block' ? m.json : m.model));
    st.on({ t: 'want', slices: [{ s, near }] });
    for (let i = 0; i < 500 && st.step(); i++);
    return got;
  };
  for (const s of [MARKET, PALACE]) {
    const got = madeBy(s, true);
    for (const w of sliceWork(s, true).filter((x) => x.kind === 'block').slice(0, s === PALACE ? 64 : 12)) {
      const made = got.get(`b:${w.name}`), plain = makeWork(w, deps);
      assert.ok(made.RmbBlock.FldHeader.AutoMapData instanceof Uint8Array, 'its automap one buffer');
      const page = imperialBlockJson(w.name, pageDeps);
      made.RmbBlock.FldHeader.AutoMapData = Array.from(made.RmbBlock.FldHeader.AutoMapData);
      assert.deepEqual(made, page, w.name);
      closedByFace += page.RmbBlock.FldHeader.AutoMapData.filter((v, i) => v !== plain.RmbBlock.FldHeader.AutoMapData[i]).length;
      bared += page.RmbBlock.FldHeader.GroundData.GroundScenery.filter((g, i) => g.TextureRecord !== plain.RmbBlock.FldHeader.GroundData.GroundScenery[i].TextureRecord).length;
    }
    // the landmarks' parts: made there, the model door's own
    for (const id of IMPERIAL_SLICE_PARTS[s]) {
      const m = got.get(`m:${id}`), door = customModelFor(id);
      assert.ok(m && m.indices.length > 0, `part ${id} made`);
      assert.deepEqual([Array.from(m.positions), Array.from(m.indices), m.subMeshes], [Array.from(door.positions), Array.from(door.indices), door.subMeshes], `part ${id} the door's`);
    }
  }
  assert.ok(closedByFace > 20, `the footprint laid: ${closedByFace} cells closed, ${bared} trees bared`);
  // a far block: as the page makes it (nothing closed), whatever the footprint
  const fw = sliceWork(PALACE, false).find((x) => x.kind === 'block'), far = madeBy(PALACE, false).get(`b:${fw.name}`);
  far.RmbBlock.FldHeader.AutoMapData = Array.from(far.RmbBlock.FldHeader.AutoMapData);
  assert.deepEqual(far, imperialBlockJson(fw.name, { ...deps, footprintOf: () => () => true }), 'a far block closes nothing');
  // the models: the family's, a cell with none none
  for (const w of sliceWork(MARKET, true).filter((x) => x.kind === 'model' && !IMPERIAL_SLICE_PARTS[MARKET].includes(x.id)).slice(0, 6)) {
    const a = makeWork(w, deps), b = imperialModelBuild(w.id);
    assert.deepEqual([a.positions, a.indices, a.subMeshes], [b.positions, b.indices, b.subMeshes]);
  }
  // the page's model door takes a part the worker made before it builds one
  const part = IMPERIAL_SLICE_PARTS[PALACE][0], sentinel = { ...imperialPartModel(part), taken: true };
  _resetCapitals();
  setImperialPrebuild({ takeBlock: () => null, takeModel: (id) => (id === part ? sentinel : undefined), made() {} });
  installCapitals({ addTextures: () => 0 });
  assert.equal(customModelFor(part), sentinel, 'the worker\'s part taken');
  setImperialPrebuild(null);
  _resetCapitals();
});

test('IC-GRAND THE WORKER AND THE PAGE - the worker makes the wanted slices\' pieces in order, a new list replacing the last; the client holds what comes back and hands each over once (null, and the worker told to skip it, for one it has not made); a model\'s none a null; no worker, nothing held - the page makes every piece; a failed worker let go; the worker\'s memory of what was made bounded (mutants: handed over twice; the worker never told; a new list appended; never forgotten)', () => {
  const w = fakeWorker();
  const client = createImperialPrebuild({ makeWorker: () => w, log: { warn() {} } });
  assert.equal(imperialPrebuilt(), client, 'the page\'s client registered');
  client.want([{ s: MARKET, near: true }]);
  client.want([{ s: MARKET, near: true }]);
  assert.equal(w.sent.filter((m) => m.t === 'want').length, 1, 'said once while the list is the same');
  const work = sliceWork(MARKET, true);
  w.flush(3);
  const first = work[0].name;
  assert.ok(client.takeBlock(first)?.RmbBlock, 'made, held, handed over');
  assert.equal(client.takeBlock(first), null, 'once');
  // a piece the worker has not reached: made on the page, the worker told, never made there
  const later = work[10].name;
  assert.equal(client.takeBlock(later), null);
  assert.ok(w.sent.some((m) => m.t === 'made' && m.key === `b:${later}`), 'the worker told');
  w.flush(20);
  assert.equal(client.takeBlock(later), null, 'skipped');
  // a new list replaces the last: the old slice's pieces still owed are never made
  client.want([{ s: PALACE, near: false }]);
  w.flush();
  assert.equal(w.state.owed, 0);
  assert.equal(client.takeBlock(work[40].name), null, 'the last list\'s pieces let go');
  assert.ok(client.takeBlock(sliceWork(PALACE, false)[0].name), 'the new list made');
  // a model with none: null, not undefined
  const empty = work.find((x) => x.kind === 'model' && !imperialModelBuild(x.id));
  if (empty) { client.want([{ s: MARKET, near: true }]); w.flush(); assert.equal(client.takeModel(empty.id), null); }
  assert.equal(client.takeModel(-1), undefined, 'not made: the page makes it');
  // a failed worker: let go, nothing held, every piece the page's
  w.onerror({ message: 'gone' });
  assert.ok(w.terminated && !client.alive && client.held === 0);
  client.dispose();
  assert.equal(imperialPrebuilt(), null);
  // the worker's memory of what was made: a made piece skipped, forgotten after DONE_KEEP others (a slice come back to
  // after a walk across the city is made again)
  const st = createPrebuildWorkerState(() => {});
  st.on({ t: 'made', key: `b:${work[0].name}` });
  st.on({ t: 'want', slices: [{ s: MARKET, near: true }] });
  assert.equal(st.owed, work.length - 1, 'a made piece skipped');
  for (let i = 0; i < DONE_KEEP; i++) st.on({ t: 'made', key: `x:${i}` });
  st.on({ t: 'want', slices: [{ s: MARKET, near: true }] });
  assert.equal(st.owed, work.length, 'forgotten after DONE_KEEP others');
  // no worker at all
  const none = createImperialPrebuild({ makeWorker: () => { throw new Error('no Worker'); }, log: { warn() {} } });
  none.want([{ s: MARKET, near: true }]);
  assert.equal(none.takeBlock(first), null);
  assert.equal(none.takeModel(work.at(-1).id), undefined);
  none.dispose();
});

test('IC-GRAND THE DOOR AND THE FAMILY ASK THE WORKER FIRST - a block the worker made is the door\'s (its footprint laid there), a model the family\'s; what it has not made the page makes as before; the pixel\'s build reads a slice\'s blocks a breath at a time before its tiles read them all (mutants: the door unwired; the family unwired; the blocks read in one task)', () => {
  _resetWorldDataReplacement();
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const w = fakeWorker();
  const client = createImperialPrebuild({ makeWorker: () => w, log: { warn() {} } });
  client.want([{ s: MARKET, near: true }]);
  w.flush();
  const work = sliceWork(MARKET, true), blk = work[1].name, mdl = work.find((x) => x.kind === 'model' && imperialModelBuild(x.id));
  const held = client.held;
  const door = getDFBlockReplacementData(getNewDFBlockIndex(blk), blk);
  assert.equal(client.held, held - 1, 'the door took the worker\'s block');
  const page = imperialBlockJson(blk, { ...prebuildDeps(), footprintOf });
  assert.deepEqual(Array.from(door.rmbBlock.fldHeader.autoMapData), page.RmbBlock.FldHeader.AutoMapData, 'its footprint laid');
  const m = customModelFor(mdl.id);
  assert.equal(client.held, held - 2, 'the family took the worker\'s model');
  assert.deepEqual(m.indices, imperialModelBuild(mdl.id).indices);
  client.dispose();
  setImperialPrebuild(null);
  _resetWorldDataReplacement();
  _resetCapitals();
  assert.match(read('src/world/capitalModels.js'), /registerPortBlockFamily\(\{ indexOf: imperialBlockIndex, nameOf: imperialBlockName, make, keep: IMPERIAL_KEEP\.blocks \}\);/);
  // and the pixel's build reads a slice's blocks a breath at a time before its tiles read all sixty-four in one task
  assert.match(read('src/scenes/pixelBuild.js'), /if \(capitalViewOf\(dfLocation\) \|\| dfLocation\?\.settle2\) for \(const name of dfLocation\.exterior\.exteriorData\.blockNames\) \{ blocks\.getBlockByName\(name\); await breather\.breathe\(\); \}[^\n]*\n\s+if \(groundLocation\) locationRect = setLocationTiles\(/);   // PIN MOVED (IC-GRAND x GROUND-AGREE, at the merge into the main-merged TESA branch): main's GROUND-AGREE tiles the ground's place (`groundLocation`), the pre-read still stands just before it
});

test('IC-GRAND THE WORKER TOLD WHAT IS COMING - on the frame, only when the player\'s pixel moves: the slices within NEAR_RING of it near (the player\'s own first, then nearest first), the ring past them far; made within PREBUILD_REACH of the city\'s centre pixel and let go past it; wired before the city\'s near and far sweep queues the pixels (mutants: far first; the reach unread; unwired)', () => {
  const want = prebuildWanted(500, 400, 500, 400), C = (N * N - 1) / 2;
  assert.deepEqual(want[0], { s: C, near: true }, 'the player\'s own first');
  assert.equal(want.filter((x) => x.near).length, (2 * NEAR_RING + 1) ** 2);
  assert.equal(want.length, (2 * NEAR_RING + 3) ** 2);
  assert.ok(want.findIndex((x) => !x.near) > want.findLastIndex((x) => x.near), 'near before far');
  assert.deepEqual(want.slice(1, 5).map((x) => x.s).sort((a, b) => a - b), [C - N, C - 1, C + 1, C + N], 'the nearest of a ring first');
  assert.ok(prebuildWanted(500 - 12, 400 - 12, 500, 400).every((x) => x.s >= 0), 'the city\'s edge: only its own slices');
  let made = 0, wanted = 0;
  const host = { state: { current: { x: 500, y: 400 } } };
  const fake = () => { made++; return { want: () => { wanted++; }, dispose: () => { made--; } }; };
  const pb = createCapitalPrebuild(host, { make: fake, centre: () => ({ px: 500, py: 400 }) });
  pb.sweep(); pb.sweep();
  assert.deepEqual([made, wanted], [1, 1], 'made once, told once while the player stands');
  host.state.current = { x: 501, y: 400 };
  pb.sweep();
  assert.equal(wanted, 2);
  host.state.current = { x: 500 + PREBUILD_REACH + 1, y: 400 };
  pb.sweep();
  assert.equal(made, 0, 'let go out of reach');
  assert.equal(pb.client, null);
  assert.match(read('src/scenes/tamrielSweepsHost.js'), /function sweepCapitalPixels\(\) \{\n\s+capitalPrebuild\.sweep\(\);[^\n]*\n\s+sweepCapitalLod\(\);/);
  assert.match(read('src/world/imperialPrebuildClient.js'), /return new Worker\(new URL\('\.\/imperialPrebuildWorker\.js', import\.meta\.url\), \{ type: 'module' \}\);/);
});
