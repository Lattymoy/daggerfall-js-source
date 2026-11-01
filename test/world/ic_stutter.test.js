// IC-STUTTER (2026-10-27, the owner: "Traveling in the Imperial City at x60 presents really bad stuttering"; bible/03-World/
// Arena-Provinces.md IC-STUTTER) - THE CITY'S WORK OFF THE FRAME AT A JOURNEY'S PACE, pinned: the city's workers told the
// slices ahead of the traveller near, a ring before the stream asks; a piece a build waits on asked of its slice's worker
// ahead of every wanted piece, made again where it was let go, never waited on for ever; a pool of workers, each slice
// one worker's; the stream's pump building a pixel of the city only once its view's pieces are made, the next ready pixel
// meanwhile, holes asked before views built again; and the near slice's own passes over its 512 by 512 grid - the yards'
// measures, ground and search, the living town's places, the streets' pieces - walked a step at a time through the build's
// breather, each the same answer as the pass run whole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prebuildWanted, createCapitalPrebuild, slicePieceKeys, pageHasPiece, NEED_AHEAD } from '../../src/scenes/capitalPrebuild.js';
import { createImperialPrebuild, prebuildPoolSize, PREBUILD_POOL_MAX } from '../../src/world/imperialPrebuildClient.js';
import { createPrebuildWorkerState, workOfKey } from '../../src/world/imperialPrebuildWorker.js';
import { sliceWork, pieceSlice } from '../../src/world/imperialPrebuild.js';
import { NEAR_RING, imperialBlockJson, imperialOwnName, imperialFarName } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_SPAN, imperialSlicePlan, imperialCodeCell, polar } from '../../src/world/imperialCity.js';
import { capitalCentrePixel, capitalNear } from '../../src/world/tamrielCapitals.js';
import { installCapitals, imperialSliceFootprint } from '../../src/world/capitalModels.js';
import { prebuildDeps } from '../../src/world/imperialPrebuild.js';
import { CityNavigation } from '../../src/world/city/cityNavigation.js';
import { yardGround, yardGroundSteps, yardSitesOn, yardSitesSteps, craftYardSitesOn, craftYardSitesSteps, yardMeasuresOf, yardMeasuresSteps, YARD_ROWS_A_STEP } from '../../src/world/merchantYards/merchantYardSites.js';
import { townPlaces, townPlacesSteps, streetNet, streetNetSteps, PLACES_ROWS_A_STEP, PLACES_CELLS_A_STEP } from '../../src/systems/livingWorld/places.js';
import { LivingTown, livingTownPlaces, livingPlacesWay } from '../../src/systems/livingWorld/livingTown.js';
import { componentsOf, componentsSteps, PIECES_CELLS_A_STEP } from '../../src/systems/travel/townWalk.js';
import { fabricHomesIn } from '../../src/world/imperialHomes.js';
import { capitalPlaceId, CAPITALS } from '../../src/world/tamrielCapitals.js';
import { townWayCells, townWayCellsSteps, snapCell, WAY_CELLS_A_STEP } from '../../src/systems/travel/townWalk.js';
import { findTownPath } from '../../src/systems/livingWorld/townPaths.js';
import { createTownWalk, WAY_STEPS_AN_ASK } from '../../src/scenes/townWalkHost.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../src/systems/travel/travelOptions.js';
import { TravelControlUI } from '../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../../src/systems/travel/travelPaths.js';
import { rectOf } from '../../src/systems/travel/travelAutopilot.js';
import { NAV_CELL } from '../../src/world/city/cityNavigation.js';
import { SCENE_MAP_RATIO } from '../../src/world/streamingWorld.js';
import { layoutLocation, layoutLocationSteps } from '../../src/world/locationLayout.js';
import { blockFromJson, registerPortBlockFamily, portBlockFamilyHas, getDFBlockReplacementData } from '../../src/formats/worldData/worldDataReplacement.js';
import { registerCustomModelFamily, registerCustomModel, customModelFor, customModelReady } from '../../src/world/customModels.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const N = IMPERIAL_SPAN, R = (N - 1) / 2, B = 102.4, HALF = N * 4;
const sliceAt = (x, z) => Math.floor((z + HALF * B) / (8 * B)) * N + Math.floor((x + HALF * B) / (8 * B));
const MARKET = sliceAt(...polar(30, 3460)), ARENA_D = sliceAt(...polar(90, 5200)), QUARTERED = 136;
/** A step generator's answer and how many times it gave the frame back. */
function walk(steps) {
  let yields = 0;
  for (;;) { const r = steps.next(); if (r.done) return { value: r.value, yields }; yields++; }
}
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
/** A slice's walkers' grid of its own blocks (Daggerfall's cells left shut), as icgrand_living.test.js makes it. */
function sliceNav(s) {
  installCapitals({ addTextures: () => 0 });
  const deps = prebuildDeps(imperialSliceFootprint), plan = imperialSlicePlan(s), sx = s % N, sy = Math.floor(s / N);
  const nav = new CityNavigation(8, 8);
  for (let i = 0; i < 64; i++) {
    const pr = 7 - Math.floor(i / 8), pc = i % 8;
    if (!imperialCodeCell(plan[pr][pc])) continue;
    const fh = imperialBlockJson(imperialOwnName(sy * 8 + pr, sx * 8 + pc), deps).RmbBlock.FldHeader;
    nav.setBlockData(i % 8, Math.floor(i / 8), fh.AutoMapData, (tx, ty) => fh.GroundData.GroundTiles[ty * 16 + tx].TileBitfield & 0x3f);
  }
  return nav;
}

test('IC-STUTTER AHEAD OF THE TRAVELLER - the outer ring\'s slices one more crossing the way the traveller is going brings within NEAR_RING are wanted near, first of their ring; going nowhere, the ring past the near one far as before; the sweep hands the way of the last crossing (mutants: the heading unread; the ring past it all near; ahead last in its ring; the heading never kept)', () => {
  const C = (N * N - 1) / 2, at = (ox, oy) => C + oy * N + ox;
  const still = prebuildWanted(500, 400, 500, 400);
  assert.equal(still.filter((x) => x.near).length, (2 * NEAR_RING + 1) ** 2, 'no heading: the near ring alone near');
  const east = prebuildWanted(500, 400, 500, 400, [1, 0]);
  const nearEast = east.filter((x) => x.near).map((x) => x.s);
  assert.equal(nearEast.length, (2 * NEAR_RING + 1) ** 2 + (2 * NEAR_RING + 1), 'and the next column east of it');
  for (const oy of [-1, 0, 1]) assert.ok(nearEast.includes(at(2, oy)), `(2, ${oy}) ahead`);
  for (const s of [at(2, -2), at(2, 2), at(-2, 0)]) assert.ok(!nearEast.includes(s), 'never the corners past it nor behind');
  const ring2 = east.slice((2 * NEAR_RING + 1) ** 2);
  assert.deepEqual(ring2.slice(0, 3).map((x) => x.near), [true, true, true], 'ahead first of its ring');
  assert.equal(ring2[0].s, at(2, 0), 'the nearest of them first');
  const diag = prebuildWanted(500, 400, 500, 400, [1, 1]).filter((x) => x.near).map((x) => x.s);
  assert.equal(diag.length, 9 + 5, 'a diagonal crossing: the five a step that way brings near');
  for (const s of [at(2, 0), at(2, 1), at(2, 2), at(0, 2), at(1, 2)]) assert.ok(diag.includes(s));
  // the sweep keeps the way of the last crossing and hands it on
  const told = [];
  const host = { state: { current: { x: 500, y: 400 } } };
  const pb = createCapitalPrebuild(host, { make: () => ({ want: (l) => told.push(l), dispose() {}, alive: true }), centre: () => ({ px: 500, py: 400 }) });
  pb.sweep();
  assert.equal(pb.heading, null);
  host.state.current = { x: 501, y: 400 };
  pb.sweep();
  assert.deepEqual(pb.heading, [1, 0]);
  assert.deepEqual(told.at(-1), prebuildWanted(501, 400, 500, 400, [1, 0]), 'its want the one with the heading');
  host.state.current = { x: 501, y: 399 };
  pb.sweep();
  assert.deepEqual(pb.heading, [0, -1]);
});

test('IC-STUTTER THE WORKER\'S NEED - a piece a build waits on is made before every wanted piece, made again where it was made before (the page let it go), never twice for one ask, and a new wanted list never drops it; a key\'s work and its slice read back (mutants: needs after the list; made before kept skipped; a new list drops the needs; the page\'s own drops nothing)', () => {
  const work = sliceWork(MARKET, true), keyOf = (w) => (w.kind === 'block' ? `b:${w.name}` : `m:${w.id}`);
  assert.deepEqual(workOfKey(keyOf(work[3])), work[3]);
  assert.deepEqual(workOfKey(keyOf(work.at(-1))), work.at(-1));
  assert.equal(workOfKey('x:1'), null);
  for (const w of [...work, ...sliceWork(MARKET, false)]) assert.equal(pieceSlice(keyOf(w)), MARKET, `${keyOf(w)} the market's`);
  assert.equal(pieceSlice('m:1'), null);
  const made = [];
  const st = createPrebuildWorkerState((m) => made.push(m.t === 'block' ? `b:${m.name}` : `m:${m.id}`));
  st.on({ t: 'want', slices: [{ s: MARKET, near: true }] });
  st.step();
  assert.deepEqual(made, [keyOf(work[0])], 'the wanted list in order');
  const late = keyOf(work[20]);
  st.on({ t: 'need', keys: [late, late, keyOf(work[0])] });
  st.on({ t: 'want', slices: [{ s: ARENA_D, near: false }] });   // a new list: the needs stand
  st.step(); st.step();
  assert.deepEqual(made.slice(1), [late, keyOf(work[0])], 'the needs first, the made one made again, each once');
  st.step();
  assert.equal(made.at(-1), keyOf(sliceWork(ARENA_D, false)[0]), 'then the new list');
  st.on({ t: 'need', keys: [keyOf(work[30])] });
  st.on({ t: 'made', key: keyOf(work[30]) });   // the page made it meanwhile: not made here
  const before = made.length;
  st.step();
  assert.notEqual(made.at(-1), keyOf(work[30]));
  assert.equal(made.length, before + 1);
});

test('IC-STUTTER THE POOL - the machine\'s cores less two, PREBUILD_POOL_MAX at most and one at least, one with no Worker; each slice one worker\'s (its wanted share and its needs); a need asked once until it comes back; a piece a worker could not make is the page\'s and never waited on (mutants: the cores unread; every slice one worker\'s; a need asked every frame; a failure waited on)', () => {
  assert.equal(prebuildPoolSize(8, true), PREBUILD_POOL_MAX);
  assert.equal(prebuildPoolSize(4, true), 2);
  assert.equal(prebuildPoolSize(2, true), 1);
  assert.equal(prebuildPoolSize(16, false), 1, 'no Worker: one (node)');
  const ws = [fakeWorker(), fakeWorker()];
  let n = 0;
  const client = createImperialPrebuild({ makeWorker: () => ws[n++], workers: 2, log: { warn() {} } });
  assert.equal(client.workers, 2);
  const slices = [{ s: MARKET, near: true }, { s: MARKET + 1, near: true }, { s: ARENA_D, near: false }];
  client.want(slices);
  const shares = ws.map((w) => w.sent.find((m) => m.t === 'want').slices.map((x) => x.s));
  assert.deepEqual(shares.flat().sort((a, b) => a - b), slices.map((x) => x.s).sort((a, b) => a - b), 'every slice told once');
  assert.ok(shares[0].length && shares[1].length, 'shared between the two');
  const owner = ws.findIndex((w) => w.sent.find((m) => m.t === 'want').slices.some((x) => x.s === MARKET));
  const keys = slicePieceKeys(MARKET, true);
  client.need(keys.slice(0, 4));
  client.need(keys.slice(0, 4));
  assert.equal(ws[owner].sent.filter((m) => m.t === 'need').length, 1, 'asked once');
  assert.equal(ws[1 - owner].sent.filter((m) => m.t === 'need').length, 0, 'of its slice\'s worker');
  assert.equal(client.asked, 4);
  ws[owner].flush(4);
  assert.ok(keys.slice(0, 4).every((k) => client.has(k)), 'held');
  assert.equal(client.asked, 0);
  // a piece a worker could not make: the page's (has, and a take hands nothing - the page makes it as ever)
  ws[owner].onmessage({ data: { t: 'error', key: keys[10], message: 'boom' } });
  assert.ok(client.has(keys[10]), 'never waited on');
  assert.equal(client.takeBlock(keys[10].slice(2)), null, 'the page makes it');
  client.dispose();
});

test('IC-STUTTER THE PUMP\'S NEXT PIXEL - a pixel of the city builds once every piece of the view it builds now is held or the page\'s; the queue\'s first ready pixel moved to its head, the rest in order; the pieces owed asked - a hole\'s before a view built again; nothing of the city, or no worker: every pixel ready; the host\'s pump asks it (mutants: the gate unwired; owed never asked; the view\'s distance unread; holes asked last; the page\'s own unread; a pixel of the city always ready; the head left; the whole queue asked; the look begun again every frame; the looks unkept; the look\'s word taken; the looks kept past the worker)', () => {
  const asked = [], held = new Set(), page = new Set();
  const fake = { alive: true, want() {}, dispose() {}, has: (k) => held.has(k), need: (ks) => asked.push([...ks]) };
  // the city on a fake map: pixel (100 + sx, 200 + sy) is slice (sx, sy) of the family capital
  const onPixel = (px, py) => (px >= 100 && px < 100 + N && py >= 200 && py < 200 + N ? { cap: { family: true }, s: (py - 200) * N + (px - 100) } : null);
  const pxOf = (s) => ({ px: 100 + (s % N), py: 200 + Math.floor(s / N) });
  const host = { state: { current: { x: pxOf(MARKET).px, y: pxOf(MARKET).py } }, built: new Map() };
  const pb = createCapitalPrebuild(host, { make: () => fake, centre: () => ({ px: 100 + R, py: 200 + R }), pageHas: (k) => page.has(k), onPixel });
  pb.sweep();
  const me = pxOf(MARKET), far = pxOf(MARKET + 3), other = { px: 5, py: 5 };
  // the market under the traveller builds near; three slices east, far
  assert.equal(pb.readyToBuild(other.px, other.py), true, 'no pixel of the city: ready');
  assert.equal(pb.readyToBuild(me.px, me.py), false, 'nothing made: not ready');
  assert.deepEqual(asked.at(-1), slicePieceKeys(MARKET, true), 'its near view\'s pieces asked');
  assert.equal(pb.readyToBuild(far.px, far.py), false);
  assert.deepEqual(asked.at(-1), slicePieceKeys(MARKET + 3, false), 'a far slice\'s far view\'s');
  // the queue: a rebuilt view (the market stands) and a hole (far) owed, a pixel off the city ready behind them
  host.built.set(`${me.px},${me.py}`, {});
  asked.length = 0;
  const q = [me, far, other];
  assert.equal(pb.firstReady(q), true);
  assert.deepEqual(q, [other, me, far], 'the first ready pixel at the head, the rest in order');
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0], [...slicePieceKeys(MARKET + 3, false), ...slicePieceKeys(MARKET, true)], 'the hole\'s pieces asked before the standing view\'s');
  // made: held, or the page's own
  for (const k of slicePieceKeys(MARKET, true)) (k.startsWith('b:') ? held : page).add(k);
  const q2 = [far, me];
  assert.equal(pb.firstReady(q2), true);
  assert.deepEqual(q2, [me, far]);
  assert.equal(pb.firstReady([far]), false, 'none ready: the pump waits');
  // the next builds' pieces alone asked: NEED_AHEAD pixels owing them, never the whole queue's (the held pieces' room)
  asked.length = 0;
  const many = Array.from({ length: N * N }, (_, s) => s).filter((s) => s !== MARKET && s !== MARKET + 3 && slicePieceKeys(s, false).length && !capitalNear(pxOf(s).px, pxOf(s).py, host.state.current)).slice(0, NEED_AHEAD + 4).map(pxOf);
  assert.equal(pb.firstReady(many), false);
  assert.deepEqual(asked[0], many.slice(0, NEED_AHEAD).flatMap((p) => slicePieceKeys((p.py - 200) * N + (p.px - 100), false)));
  // A LOOK A SLICE: a frame looks at a pixel from the first key its look found owed, never its whole view again - half of
  // each pixel's pieces made, a pixel past the asked ones costs the frame one look (mutants: the look begun again every
  // frame; the looks unkept)
  const sOf = (p) => (p.py - 200) * N + (p.px - 100);
  for (const p of many) { const ks = slicePieceKeys(sOf(p), false); for (const k of ks.slice(0, ks.length >> 1)) held.add(k); }
  pb.firstReady(many);
  let looked = 0;
  fake.has = (k) => { looked++; return held.has(k); };
  pb.firstReady(many.slice(0, NEED_AHEAD));
  const asking = looked;
  looked = 0;
  pb.firstReady(many);
  assert.equal(looked - asking, many.length - NEED_AHEAD, 'one look a pixel past the asked ones');
  assert.ok(many.slice(NEED_AHEAD).every((p) => slicePieceKeys(sOf(p), false).length > 3), 'pixels with more than one piece to look past');
  fake.has = (k) => held.has(k);
  // the pixel chosen looked at whole: a piece let go since its look found it made is owed again, and asked (mutant: the
  // look's word taken)
  const farKeys = slicePieceKeys(MARKET + 3, false);
  for (const k of farKeys) held.add(k);
  assert.equal(pb.firstReady([far]), true, 'every piece made: ready');
  held.delete(farKeys[0]);
  asked.length = 0;
  assert.equal(pb.firstReady([far]), false, 'one let go since: owed again');
  assert.deepEqual(asked, [[farKeys[0]]], 'and asked');
  held.add(farKeys[0]);
  assert.ok(pb.looks > 0);
  // no worker standing: every pixel ready, every piece the page's as ever
  fake.alive = false;
  assert.equal(pb.firstReady([far]), true);
  fake.alive = true;
  pb.drop();
  assert.equal(pb.firstReady([far]), true, 'let go: ready');
  assert.equal(pb.looks, 0, 'its looks with it');
  // the host's pump asks it, after the stream's books
  assert.match(read('src/scenes/world.js'), /if \(building \|\| !state\.owes\(queue\) \|\| !capitalPrebuild\.firstReady\(queue\)\) return;/);
  assert.match(read('src/scenes/world.js'), /sweepCapitalPixels, capitalPrebuild \} = createTamrielSweeps\(\{/);
  assert.match(read('src/scenes/tamrielSweepsHost.js'), /return \{ swap, [^\n]*capitalPrebuild \};/);
  assert.equal(capitalNear(me.px + 1, me.py, host.state.current), true);
  assert.equal(typeof pageHasPiece('b:TESAI0000.RMB'), 'boolean');
});

test('IC-STUTTER THE PAGE\'S OWN - a family\'s block or model the page has read is the page\'s (a read of it makes nothing); one never read, or let go by its family\'s keep, is not; a registered model built once, or off, is the page\'s', () => {
  let made = 0;
  registerPortBlockFamily({ indexOf: (n) => (n === 'ICSTUTR0.RMB' || n === 'ICSTUTR1.RMB' ? 990001 + Number(n[7]) : -1), nameOf: () => null, make: () => { made++; return { rmbBlock: {} }; }, keep: 1 });
  assert.equal(portBlockFamilyHas('ICSTUTR0.RMB'), false, 'never read');
  getDFBlockReplacementData(990001, 'ICSTUTR0.RMB');
  assert.equal(portBlockFamilyHas('ICSTUTR0.RMB'), true, 'read: kept');
  assert.equal(pageHasPiece('b:ICSTUTR0.RMB'), true);
  getDFBlockReplacementData(990002, 'ICSTUTR1.RMB');
  assert.equal(portBlockFamilyHas('ICSTUTR0.RMB'), false, 'let go by its keep');
  assert.equal(made, 2);
  registerCustomModelFamily({ owns: (id) => id === 990101, build: () => ({}) });
  assert.equal(customModelReady(990101), false, 'a family\'s model never built');
  customModelFor(990101);
  assert.equal(customModelReady(990101), true, 'built: kept');
  assert.equal(pageHasPiece('m:990101'), true);
  let on = true;
  registerCustomModel(990102, () => ({}), () => on);
  assert.equal(customModelReady(990102), false, 'registered, never built');
  on = false;
  assert.equal(customModelReady(990102), true, 'off: nothing to make');
  on = true;
  customModelFor(990102);
  assert.equal(customModelReady(990102), true, 'built once');
  assert.equal(customModelReady(990103), false, 'no model at all: not the page\'s');
});

/** A town of 512 cells a side, split down its middle by a wall: a street grid each side, three doors on each (a town of two
 *  quarters), its grid's own bytes. */
function twoQuarters() {
  const W = 512, H = 512, grid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid[y * W + x] = (x === 256 ? 0 : (x % 32 < 6 || y % 32 < 6 ? 15 : 0)) << 4;
  const nav = { width: W, height: H, grid, weightAt: (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y * W + x] >> 4 : 0), inBounds: (x, y) => x >= 0 && y >= 0 && x < W && y < H };
  const door = (key, gx) => ({ key, x: (gx + 0.5) * 1.6, z: 2.5 * 1.6, nx: 0, nz: 1 });
  const doors = [door(1, 40), door(2, 100), door(3, 160), door(4, 300), door(5, 360), door(6, 420)];
  let walkable = 0;
  for (let i = 0; i < W * H; i++) if (grid[i]) walkable++;
  return { nav, doors, buildings: doors.map((d) => ({ key: d.key, type: 2 })), walkable };
}

test('IC-STUTTER THE YARDS A STEP AT A TIME - on a 512-cell grid the yards\' ground gives the frame back every YARD_ROWS_A_STEP rows and after each of its fills, their search every YARD_ROWS_A_STEP rows of every turn, the measures a block at a time - and each answers what the pass run whole answers (mutants: the ground\'s rows unbroken; the search\'s rows unbroken; the measures in one)', () => {
  const W = 512, H = 512;
  const weight = (x, y) => ((x >= 240 && x < 270 && y >= 240 && y < 270) || (x * 7 + y * 13) % 97 === 0 && x < 128 ? 0 : (x % 64 === 5 || y % 64 === 9 ? 15 : 7));
  const nav = { width: W, height: H, weightAt: weight };
  const boxes = { buildings: [[100, 100, 140, 160], [400, 300, 460, 380]], props: [[10, 10, 12, 12]], flats: [[50, 50]], keep: [[200, 200, 8]] };
  const whole = yardGround(nav, boxes), stepped = walk(yardGroundSteps(nav, boxes));
  assert.deepEqual(stepped.value, whole);
  assert.equal(stepped.yields, H / YARD_ROWS_A_STEP - 1 + 3, 'every band of rows, and after the buildings\' and the props\' boxes');
  const g1 = yardGround(nav, boxes), g2 = yardGround(nav, boxes);
  const sites = walk(yardSitesSteps(g1)), craft = walk(craftYardSitesSteps(g1));
  assert.deepEqual(sites.value, yardSitesOn(g2));
  assert.deepEqual(craft.value, craftYardSitesOn(g2));
  assert.ok(sites.value.length >= 2 && craft.value.length >= 1, 'the yards found');
  assert.ok(sites.yields >= 2 * 4 * Math.floor((H - 40) / YARD_ROWS_A_STEP), `the search's rows broken: ${sites.yields}`);
  assert.ok(craft.yields >= 4 * Math.floor((H - 40) / YARD_ROWS_A_STEP), `the professions' too: ${craft.yields}`);
  const yl = { blocks: Array.from({ length: 64 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8), originX: 0, originZ: 0, layout: { models: [] } })) };
  const m = walk(yardMeasuresSteps(yl, {}));
  assert.deepEqual(m.value, yardMeasuresOf(yl, {}));
  assert.equal(m.yields, 64, 'a block a step');
});

test('IC-STUTTER THE PLACES\' STEPS COUNTED - on a town of two quarters 512 cells a side: the street net gives the frame back every PLACES_ROWS_A_STEP rows and every PLACES_CELLS_A_STEP cells it floods, the town walk\'s pieces every PIECES_CELLS_A_STEP cells it reads or floods, and the town\'s places every pass and band of rows, its quarters\' each - the same places as the pass run whole (mutants: the flood in one; the pieces\' flood in one; the places\' rows unbroken; the door passes in one; the quarters made whole)', () => {
  const t = twoQuarters();
  const net = walk(streetNetSteps(t.nav));
  assert.equal(net.yields, t.nav.height / PLACES_ROWS_A_STEP - 1 + Math.floor(t.walkable / PLACES_CELLS_A_STEP));
  const pieces = walk(componentsSteps({ ...t.nav }));
  assert.equal(pieces.yields, Math.floor((t.nav.width * t.nav.height + t.walkable) / PIECES_CELLS_A_STEP));
  const whole = townPlaces(t.nav, t.doors, t.buildings, { quarters: true });
  const stepped = walk(townPlacesSteps(t.nav, t.doors, t.buildings, { quarters: true }));
  assert.equal(whole.quarters?.length, 2, 'a town of two quarters');
  assert.deepEqual(stepped.value.quarters.map((q) => [q.netId, q.square?.cell, q.exits.map((e) => e.cell), q.corners.map((c) => c.cell), [...q.doors.keys()]]), whole.quarters.map((q) => [q.netId, q.square?.cell, q.exits.map((e) => e.cell), q.corners.map((c) => c.cell), [...q.doors.keys()]]));
  assert.deepEqual([...stepped.value.net], [...whole.net]);
  // AUDIT LW-ANTICS A5: each quarter's squares, corners and exits keyed its own - two quarters never share a spot's key
  const keysOf = (q) => [...q.squares, ...q.corners, ...q.exits].map((sp) => sp.key);
  const [k0, k1] = whole.quarters.map(keysOf);
  assert.ok(k1.length && k1.every((k) => k.startsWith('q1.')) && k0.every((k) => !k.startsWith('q')), 'the second quarter\'s tagged, the first as it was');
  assert.equal(k0.filter((k) => k1.includes(k)).length, 0, 'no key in both');
  assert.equal(stepped.yields, 95, 'the count its steps make on this town - a pass left whole, or a quarter\'s, changes it');
});

test('IC-STUTTER THE LIVING TOWN\'S PLACES AND THE STREETS\' PIECES A STEP AT A TIME - on a near slice of the Imperial City (its own blocks, its fabric\'s homes): the town\'s places and its quarters\' made in steps are the ones made whole, the street net and the town walk\'s pieces the same labels; each gives the frame back many times over the 512 by 512 grid; a LivingTown handed its places stands as one that made them (mutants: the places\' rows unbroken; the quarters made whole; the flood in one; the places handed in unread)', async () => {
  // PIN MOVED (IC-STAIRS, IC-PROPS): the Arena District's slice is one quarter on the city laid again - a slice of five
  const nav = sliceNav(QUARTERED), homes = fabricHomesIn(QUARTERED);
  const IC = CAPITALS.findIndex((c) => c.family);
  const o = { town: { mapId: capitalPlaceId(IC, QUARTERED), blocks: 64, region: 70, people: 3, port: false }, buildings: homes.buildings, doors: homes.doors };
  const whole = townPlaces(nav, o.doors, o.buildings, livingPlacesWay(o));
  const stepped = walk(townPlacesSteps(nav, o.doors, o.buildings, livingPlacesWay(o)));
  assert.ok(whole.quarters?.length >= 2, 'a town of quarters');
  assert.deepEqual(JSON.stringify([...stepped.value.doors], null, 0), JSON.stringify([...whole.doors], null, 0));
  assert.deepEqual(stepped.value.quarters.map((q) => [q.netId, q.square?.cell, q.exits.map((e) => e.cell), q.corners.length]), whole.quarters.map((q) => [q.netId, q.square?.cell, q.exits.map((e) => e.cell), q.corners.length]));
  assert.ok(stepped.yields >= 3 * (nav.height / PLACES_ROWS_A_STEP), `the places' passes broken: ${stepped.yields}`);
  const net = walk(streetNetSteps(nav));
  assert.deepEqual(net.value.label, streetNet(nav).label);
  assert.ok(net.yields >= nav.height / PLACES_ROWS_A_STEP - 1);
  const fresh = sliceNav(QUARTERED);
  const pieces = walk(componentsSteps(fresh));
  assert.ok(pieces.yields >= (fresh.width * fresh.height) / PIECES_CELLS_A_STEP, `the flood broken: ${pieces.yields}`);
  assert.equal(componentsOf(fresh), pieces.value, 'kept on the grid: the walk\'s next ask a read');
  assert.deepEqual(componentsOf(sliceNav(QUARTERED)), pieces.value, 'the same labels');
  // the living town handed its places made a step at a time stands as one that made them
  let breaths = 0;
  const places = await livingTownPlaces(nav, o, async () => { breaths++; });
  assert.ok(breaths >= stepped.yields, 'breathed between its steps');
  const make = (extra) => new LivingTown(nav, { ...o, ...extra, makePerson: () => null, clock: () => 300 * 1440 + 360, rate: () => 12, mpm: 1 });
  const handed = make({ places }), own = make({});
  assert.equal(handed.places, places, 'its places the ones handed');
  assert.deepEqual(handed.residents.map((r) => r.id), own.residents.map((r) => r.id), 'the same people');
});

test('IC-STUTTER THE HOST - the town\'s places awaited a step at a time through the build\'s breather (its yards\' measures, ground, search and the professions\'), the living town handed its places and the streets\' pieces flooded before the pixel stands (mutants: the measures in one; the living town\'s places unhanded; the flood unwired)', () => {
  const w = read('src/scenes/world.js'), pb = read('src/scenes/pixelBuild.js');
  assert.match(w, /async function townPlacesFor\(dfLocation, lefaySpot, people, loc = null, shut = null, breathe = async \(\) => \{\}\) \{/);
  assert.match(w, /\.\.\.await stepsBreathing\(yardMeasuresSteps\(shut\?\.yardLayout\?\.\(yl\) \?\? yl, \{/);   // PIN MOVED (FB1028 YARDS Y1): the yards' layout
  assert.match(w, /\}\), breathe\),\n\s+keep: lefaySpot/);
  assert.match(pb, /const places = yardTown \|\| portTown \? await townPlacesFor\(dfLocation, lefaySpot, climate\?\.people, loc, yardShut, \(\) => breather\.breathe\(\)\) : null;/);   // PIN MOVED (FB1028): the yards' own shut
  assert.match(pb, /if \(livingWorldOn\(\)\) livingOf\.places = await livingTownPlaces\(nav, livingOf, \(\) => breather\.breathe\(\)\);/);
  assert.match(pb, /population = livingWorldOn\(\) \? new LivingTown\(nav, \{\n\s+\.\.\.livingOf,/);
  assert.match(pb, /await stepsBreathing\(componentsSteps\(nav\), \(\) => breather\.breathe\(\)\);/);
  assert.match(pb, /\{ enhancedWater: waterSwitchOn\(\) \}\);\n\s+await breather\.breathe\(\);/, 'the walkers\' grid a block a breath');
  assert.match(read('src/systems/livingWorld/livingTown.js'), /this\.places = o\.places \?\? townPlaces\(nav, o\.doors, o\.buildings, livingPlacesWay\(o\)\);/);
});

test('IC-STUTTER A JOURNEY\'S WAY A FEW THOUSAND CELLS A STEP - on a near slice of the Imperial City the way to the slice\'s edge, searched WAY_CELLS_A_STEP cells a step on a scratch of its own, is the way searched whole, whatever the residents search on the grid between its steps; the host walks WAY_STEPS_AN_ASK steps an ask and says the way is still in the making, then hands it; the journey asks again every frame until it has it, the leg walked meanwhile (mutants: the search whole; the residents\' search begins it again; the host\'s steps unbounded; the journey never asks again)', () => {
  const nav = sliceNav(ARENA_D);
  const from = snapCell(nav, [nav.width - 3, nav.height / 2], 40), to = [-300, nav.height / 2];
  const whole = townWayCells(nav, from, to);
  const key = {}, gen = townWayCellsSteps(nav, from, to, { scratchKey: key });
  let got = gen.next(), steps = 0;
  while (!got.done && steps < 400) { findTownPath(nav, from, snapCell(nav, [10, 10], 40), {}); steps++; got = gen.next(); }
  assert.ok(got.done, 'found, the residents\' searches between its steps notwithstanding');
  assert.deepEqual(got.value, whole, 'the same way');
  assert.ok(whole?.reached && whole.cells.length > 1);
  assert.ok(steps >= 2, `searched in steps: ${steps}`);
  // the host over the slice's grid: in the making for a few asks, then the way, as natives
  const o = mapPixelWorldOrigin(100, 200), t = [0, 0, 0], locOrigin = [o.x / SCENE_MAP_RATIO, 0, o.z / SCENE_MAP_RATIO];
  const state = { pixelTranslation: () => t, localFromWorld: (x, z) => [x / SCENE_MAP_RATIO, z / SCENE_MAP_RATIO], worldCoords: (p) => ({ x: p[0] * SCENE_MAP_RATIO, z: p[2] * SCENE_MAP_RATIO }) };
  const fresh = sliceNav(ARENA_D);   // its pieces not yet flooded: the host's first asks flood them a step at a time too
  const built = new Map([['100,200', { population: { nav: fresh }, locOrigin }]]);
  const tw = createTownWalk({ built, state });
  const cellAt = (gx, gy) => ({ x: (locOrigin[0] + (gx + 0.5) * NAV_CELL) * SCENE_MAP_RATIO, z: (locOrigin[2] + (gy + 0.5) * NAV_CELL) * SCENE_MAP_RATIO });
  let way = tw.townWay(cellAt(from[0], from[1]), cellAt(to[0], to[1])), asks = 1;
  assert.equal(way?.pending, true, 'still in the making after its first steps');
  while (way?.pending && asks < 100) { way = tw.townWay(cellAt(from[0] - asks, from[1]), cellAt(to[0], to[1])); asks++; }
  assert.ok(asks >= Math.ceil((steps + 1 + (512 * 512) / 16384) / WAY_STEPS_AN_ASK), `${asks} asks for ${steps + 1} steps and the flood's`);
  assert.equal(way.pts.length, whole.cells.length, 'the way found from where it was first asked');
  const last = cellAt(...whole.cells.at(-1));
  assert.ok(Math.abs(way.pts.at(-1).x - last.x) < 1e-6 && Math.abs(way.pts.at(-1).z - last.z) < 1e-6);
  assert.ok(WAY_CELLS_A_STEP * WAY_STEPS_AN_ASK <= 32768, 'an ask a few milliseconds');
  // the journey: asked again every frame while the way is in the making, its streets walked once it is found
  const mid = (px, py) => { const q = mapPixelWorldOrigin(px, py); return { x: q.x + 16384, z: q.z + 16384 }; };
  const pos = { at: mid(500, 250) }, asked = [];
  let pending = 3;
  const pts = [{ x: mid(500, 250).x + 400, z: mid(500, 250).z }, { x: mid(500, 250).x + 400, z: mid(500, 250).z + 800 }];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, k) => (vendor === 'roads-hazelnut' ? k === 'Enabled' : modSetting(vendor, k)));
  const jo = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => pos.at, mapPixel: () => ({ x: 500, y: 250 }), yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (q) => q?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: () => {}, messageBox: () => {},
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (q) => { const w = mapPixelWorldOrigin(q.pixel.x, q.pixel.y); return rectOf(w.x + 16000, w.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
    townKey: () => '500,250', townWay: (a, b) => { asked.push([a, b]); return pending-- > 0 ? { pending: true, pts: [] } : { pts }; },
  });
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }];
  assert.equal(jo.beginTravelAlongRoute({ legs, point: { pixel: { x: 502, y: 250 }, ...mid(502, 250) } }, false, { quiet: true }), true);
  assert.equal(asked.length, 1);
  assert.equal(jo.state.route.street, null, 'in the making: the leg walked meanwhile');
  for (let f = 0; f < 6 && !jo.state.route.street; f++) jo.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  assert.equal(asked.length, 4, 'asked again each frame until found, then never');
  assert.ok(jo.state.route.street, 'its streets walked');
  assert.deepEqual(jo.state.autopilot.path.slice(1), pts.map((q) => [q.x, q.z]));
  jo.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  assert.equal(asked.length, 4);
});

test('IC-STUTTER A TOWN LAID OUT A BLOCK A STEP - a near slice of the Imperial City\'s sixty-four blocks laid out a step a block, the layout the whole one\'s; the pixel\'s build walks it through its breather (mutants: the layout in one; the build\'s layout whole)', () => {
  installCapitals({ addTextures: () => 0 });
  const deps = prebuildDeps(imperialSliceFootprint), plan = imperialSlicePlan(MARKET), sx = MARKET % N, sy = Math.floor(MARKET / N);
  const names = [];
  for (let i = 0; i < 64; i++) { const pr = 7 - Math.floor(i / 8), pc = i % 8; names.push(imperialCodeCell(plan[pr][pc]) ? imperialOwnName(sy * 8 + pr, sx * 8 + pc) : imperialFarName(sy * 8 + pr, sx * 8 + pc)); }
  const made = new Map();
  const blocksFile = { checkName: (n) => n, getBlockByName: (n) => { if (!made.has(n)) made.set(n, blockFromJson(imperialBlockJson(n, deps), 1)); return made.get(n); } };
  const mapsFile = { getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * 8 + x] };
  const loc = { exterior: { exteriorData: { width: 8, height: 8, blockNames: names } }, climate: { groundArchive: 302 } };
  const whole = layoutLocation(loc, mapsFile, blocksFile, { enhanced: true });
  const stepped = walk(layoutLocationSteps(loc, mapsFile, blocksFile, { enhanced: true }));
  assert.equal(stepped.yields, whole.blocks.length, 'a block a step');
  assert.equal(whole.blocks.length, 64);
  assert.deepEqual(stepped.value.blocks.map((b) => [b.blockName, b.layout.models.length, b.originX, b.originZ]), whole.blocks.map((b) => [b.blockName, b.layout.models.length, b.originX, b.originZ]));
  assert.match(read('src/scenes/pixelBuild.js'), /const loc = await stepsBreathing\(layoutLocationSteps\(dfLocation, maps, blocks, \{ enhanced: isEnhanced\(\), windmills: windmillsOn\(\) \}\), \(\) => breather\.breathe\(\)\);/);
});
