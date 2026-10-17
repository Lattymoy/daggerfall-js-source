// AUDIT EG V (2026-10-15; bible/11-Multiplayer/Elite-Gates.md sections 7, 25.1 and 29, EG-H3 and EG-ZN) - FIX GROUP E,
// "render": THE SWAP'S WORKER BUILDS WHAT THE MAIN THREAD LAID AND PAINTED.
//   L6-8  the worker's build carries its circle's five specs (world/eliteGates/egCircleParts.js egCircleBuild); the page takes them as
//         given (net/eliteGates/egLaw.js egSpecGive), a hall a frame of the Court's rest and the rest at THE SWAP, before anything
//         under the veil reads them - it laid halls 2-5 again there (17-102 ms, lane 6's swap_tick probe);
//   L6-9  the next band's dress is painted in that worker (world/eliteGates/egBandArt.js is pure) and put up a record a frame of the
//         rest - it was painted on the main thread in one plain rest frame (150-270 ms at Redoubts 5, 10 and 15).
// Pinned on the mode machine's own source (scenes/worldModes.js - its stand, prebuild, swap and band dress) over a counting
// renderer, its worker the worker's own handler (world/eliteGates/egCircleWorker.js) run in this process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egCircleSpecs, egBandOfCircle, egSpecGive, egSpecForget, egHallOf, EG_SPEC, EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { createEgSwap } from '../../../src/scenes/eliteGates/egSwap.js';
import { egCircleParts, egCircleBuild, egCirclePartsTransfers } from '../../../src/world/eliteGates/egCircleParts.js';
import { buildEgCircleModel, egCircleColliderTris, egCircleLights, egGateParts } from '../../../src/world/eliteGates/egHall.js';
import { realmArt } from '../../../src/world/superDungeon/sdRealmArt.js';
import { SD_REALM_ARCHIVE } from '../../../src/world/superDungeon/sdRealm.js';
import { identity } from '../../../src/world/mat4.js';
import { egBandArt, egBandArchive, EG_DRESS_RECORDS, EG_BAND_RECORDS } from '../../../src/world/eliteGates/egBandArt.js';
import { createEgOccluders } from '../../../src/scenes/eliteGates/egOcclude.js';
import { buildEgLookModel } from '../../../src/world/eliteGates/egLook.js';
import { Collider } from '../../../src/player/collider.js';
import { egBeatTellDown } from '../../../src/scenes/eliteGates/egSpan.js';
import { createEgGroundLook } from '../../../src/scenes/eliteGates/egGroundLook.js';   // EG-LOOK: the circle's ruin and its band's wreck, stood with it

const SEED = 0x5eed1234, B = '0123456789abcdef';
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, `${a} .. ${b}`); return src.slice(i, j); };

/** The worker's own handler (world/eliteGates/egCircleWorker.js), loaded once in this process; its answers pass through a structured
 *  clone that hands over the buffers it names, as a real worker's postMessage does. */
const HANDLER = await (async () => {
  const was = globalThis.onmessage;
  try { await import('../../../src/world/eliteGates/egCircleWorker.js'); return globalThis.onmessage; } finally { globalThis.onmessage = was; }
})();
/** Workers over that handler, each build asked answered at once. */
async function workerOf() {
  const was = globalThis.postMessage;
  let reply = null;
  globalThis.postMessage = (m, transfer = []) => reply?.(structuredClone(m, { transfer }));
  const restore = () => { globalThis.postMessage = was; };
  const made = [];
  const factory = () => {
    const w = { posted: [], onmessage: null, onerror: null, terminate() {}, postMessage(m) { w.posted.push(m); reply = (data) => w.onmessage?.({ data }); HANDLER({ data: m }); } };
    made.push(w);
    return w;
  };
  return { factory, restore, lastAsk: () => made.at(-1)?.posted.at(-1) };
}

/** The mode machine's circle (its own source) over a counting renderer: each record of a band's dress put up, each paint of
 *  a band on this thread (`egBandArt`), each hall taken as given (`egSpecGive`), counted. */
function rig(workerFactory) {
  const WM = rd('src/scenes/eliteGates/egCircleHost.js');   // PIN MOVED (HOST-SPLIT, EG-LOOK): the circle's own module
  const src = between(WM, "  const EG_BUCKET = 'eg:hall';", '  // ── EG-H3 end');
  const ups = [], painted = [], given = [], live = new Set();
  const renderer = {
    createMesh: (m) => { const g = { m }; live.add(g); return g; }, destroyMesh: (g) => { live.delete(g); },
    uploadTexture: (a, r) => { ups.push(`${a}_${r}`); }, uploadEmissionTexture: () => {},
    releaseTexture: () => true, evictEmissionTexture: () => true,
  };
  const st = { loc: { egBreach: B, egSeed: SEED, egCircle: 4, egGeo: 0 }, worker: workerFactory };
  const paintSpy = (band) => { painted.push(band); return egBandArt(band); };
  const giveSpy = (s) => { given.push(s.h); return egSpecGive(s); };
  const wm = new Function('createEgGroundLook', 'host', 'renderer', 'isEgHall', 'createEgSwap', 'identity', 'realmArt', 'SD_REALM_ARCHIVE', 'buildEgCircleModel', 'egCircleColliderTris', 'egCircleLights', 'egCircleSpecs', 'egGateParts', 'EG_TEXT', 'egBandOfCircle', 'egBandArt', 'egBandArchive', 'buildEgLookModel', 'createEgOccluders', 'EG_BAND_RECORDS', 'egBeatTellDown', 'egSpecGive', 'st',
    `let mode = 'dungeon', dungeonLoc = st.loc, dungeonCtx = null;\nconst wm = { get mode() { return mode; }, get dungeonLoc() { return dungeonLoc; }, get dungeonCtx() { return dungeonCtx; } };\n${src.replace('const egSwap = createEgSwap();', 'const egSwap = createEgSwap({ workerFactory: st.worker });')}\nreturn { standEgHall, egPrebuild, egSwapCircle, egBandsDown, set ctx(c) { dungeonCtx = c; }, set mode(m) { mode = m; } };`)(
    createEgGroundLook, { egGateOpen: () => false }, renderer, (l) => !!l?.egBreach, createEgSwap, identity, realmArt, SD_REALM_ARCHIVE, buildEgCircleModel, egCircleColliderTris, egCircleLights, egCircleSpecs, egGateParts, EG_TEXT, egBandOfCircle, paintSpy, egBandArchive, buildEgLookModel, createEgOccluders, EG_BAND_RECORDS, egBeatTellDown, giveSpy, st);
  const ctx = { dynamicDraws: [], collider: new Collider(() => -Infinity), addActivationNamer() {}, addTeardown() {}, egRecircle() {} };
  wm.ctx = ctx;
  return { wm, ctx, ups, painted, given, st };
}
const eh = (c) => ({ b: B, seed: SEED, c, geo: 0 });
const bandUps = (ups, band) => ups.filter((k) => k.startsWith(`${egBandArchive(band)}_`)).length;

test('AUDIT EG V L6-8, L6-9 THE WORKER\'S BUILD (world/eliteGates/egCircleParts.js egCircleBuild, world/eliteGates/egCircleWorker.js): a build asked carries the circle\'s made level as before, its five halls\' specs as the hall law lays them, and - when a band is asked - that band\'s dress painted, every record of it, its pixels handed over with the rest; the worker answers with it (mutants: the specs left out; the dress left out; the dress painted for another band; its pixels copied)', async () => {
  const c = 6, band = egBandOfCircle(c), m = egCircleBuild({ seed: SEED, c, geo: 0, band });
  const plain = egCircleParts(SEED, c, 0);
  assert.equal(m.key, plain.key);
  assert.deepEqual(m.lamps, plain.lamps);
  assert.deepEqual(m.specs.map((s) => JSON.stringify(s)), egCircleSpecs(SEED, c, 0).map((s) => JSON.stringify(s)), 'its five halls, the law\'s own');
  assert.deepEqual(m.art.map(([rec]) => rec), [...EG_BAND_RECORDS], 'every record of the dress');
  assert.deepEqual(m.art.map(([, a]) => [...a.albedo.colors.slice(0, 64)]), egBandArt(band).map(([, a]) => [...a.albedo.colors.slice(0, 64)]), 'the band\'s own');
  assert.equal(egCircleBuild({ seed: SEED, c, geo: 0 }).art, null, 'no band asked: no dress');
  const bufs = new Set(egCirclePartsTransfers(m));
  for (const [, a] of m.art) assert.ok(bufs.has(a.albedo.colors.buffer) && bufs.has(a.emission.colors.buffer), 'its pixels handed over');
  const W = await workerOf();
  try {
    const w = W.factory(), got = [];
    w.onmessage = (ev) => got.push(ev.data);
    w.postMessage({ t: 'build', id: 3, seed: SEED, c, geo: 0, band });
    assert.equal(got.length, 1);
    assert.deepEqual([got[0].t, got[0].id, got[0].parts.specs.length, got[0].parts.art.length], ['built', 3, 5, EG_BAND_RECORDS.length]);
  } finally { W.restore(); }
});

test('AUDIT EG V E NEW-2 UNDER ANOTHER LAW THE WORKER BUILDS FROM THE HALLS GIVEN (section 22, THE LAW PIN; EG-H2 departure 4): a build asked with a breach of another law\'s halls (`given`, as its room gave them) takes them as given before anything is laid - its specs and its made level are that law\'s, not the worker\'s own - and the swap hands them to the worker; the same circle asked without them is another build (mutants: the halls given never taken; the swap never hands them; a build with them taken for one without)', async () => {
  const c = 2, law = EG_SPEC - 1, hs = [6, 7, 8, 9, 10];
  try {
    const own = egCircleBuild({ seed: SEED, c, geo: 0 });
    const theirs = hs.map((h) => ({ ...JSON.parse(JSON.stringify(egHallOf(SEED, h, 0, law))), laid: 90 + h }));
    const m = egCircleBuild({ seed: SEED, c, geo: 0, given: theirs });
    assert.deepEqual(m.specs.map((s) => s.laid), [96, 97, 98, 99, 100], 'its five halls, the room\'s');
    egSpecForget();
    for (const s of theirs) egSpecGive(s);
    assert.deepEqual([...m.model.positions], [...egCircleParts(SEED, c, 0).model.positions], 'built from them');
    egSpecForget();
    assert.notDeepEqual([...m.model.positions], [...own.model.positions], 'not the worker\'s own law\'s');
    // the swap hands them over; asked again without them, it is another build
    const W = await workerOf();
    try {
      const swap = createEgSwap({ workerFactory: W.factory });
      assert.equal(swap.want(SEED, c, 0, -1, theirs), 'ready');
      assert.deepEqual(W.lastAsk().given.map((s) => s.laid), [96, 97, 98, 99, 100], 'handed with the ask');
      const id = W.lastAsk().id;
      assert.equal(swap.want(SEED, c, 0, -1, theirs), 'ready');
      assert.equal(W.lastAsk().id, id, 'asked again with them: the build held');
      assert.deepEqual(swap.peek(SEED, c, 0).specs.map((s) => s.laid), [96, 97, 98, 99, 100]);
      egSpecForget();
      assert.equal(swap.want(SEED, c, 0), 'ready');
      assert.ok(W.lastAsk().id > id && W.lastAsk().given === null, 'without them: built again');
      assert.deepEqual(swap.peek(SEED, c, 0).specs.map((s) => s.laid), hs.map((h) => egHallOf(SEED, h, 0).laid), 'the worker\'s own law\'s');
      swap.drop();
      egSpecForget();
      // the mode machine's own prebuild hands them on (scenes/worldModes.js egPrebuild)
      const R = rig(W.factory);
      assert.equal(R.wm.egPrebuild({ ...eh(c), given: theirs }), 'ready');
      assert.deepEqual(W.lastAsk().given.map((s) => s.laid), [96, 97, 98, 99, 100], 'the host hands them on');
    } finally { W.restore(); }
  } finally { egSpecForget(); }
});

test('AUDIT EG V L6-9 THE NEXT BAND\'S DRESS, PAINTED IN THE WORKER AND PUT UP A RECORD A FRAME (section 25.1; EG-ZN): while the Court of a band\'s last circle rests, each prebuild puts up one record of the next band\'s dress the worker painted - none painted on this thread - until it is whole; THE SWAP after puts up nothing more; a rest too short to put it all up leaves the swap to put up the rest, still painting nothing; a band already up asks no dress of the worker; and with no worker nothing is painted in the rest - the old step\'s stand paints it under the veil (mutants: the dress painted here at the prebuild; the whole dress put up in one frame; the swap leaving records unput; the dress asked of a band already up; a band whole at its first record; a record put up twice; the built level unread in the rest)', async () => {
  const W = await workerOf();
  try {
    const R = rig(W.factory), band1 = egBandOfCircle(6);
    R.wm.standEgHall(R.ctx, eh(5));
    assert.equal(bandUps(R.ups, egBandOfCircle(5)), EG_BAND_RECORDS.length, 'the standing circle\'s band at its stand');
    R.painted.length = 0;
    const per = [];
    for (let k = 0; k < EG_BAND_RECORDS.length; k++) { const n0 = R.ups.length; assert.equal(R.wm.egPrebuild(eh(6)), 'ready'); per.push(R.ups.length - n0); }
    assert.deepEqual(per, EG_BAND_RECORDS.map(() => 1), 'a record a rest frame');
    assert.equal(bandUps(R.ups, band1), EG_BAND_RECORDS.length, 'the next band whole');
    assert.deepEqual(R.painted, [], 'none of it painted on this thread');
    const n1 = R.ups.length;
    assert.equal(R.wm.egSwapCircle(eh(6)), true);
    assert.equal(R.ups.length, n1, 'the swap puts up nothing more');
    // a circle of the same band asks no dress
    assert.equal(R.wm.egPrebuild(eh(7)), 'ready');
    assert.deepEqual([W.lastAsk().c, W.lastAsk().band], [7, -1], 'its band up already: no dress asked of the worker');
    assert.equal(R.ups.length, n1, 'its band up already: nothing');
    // a rest cut short: the swap puts up what is left, painting nothing
    R.wm.standEgHall(R.ctx, eh(10));
    const band2 = egBandOfCircle(11), u0 = bandUps(R.ups, band2);
    assert.equal(R.wm.egPrebuild(eh(11)), 'ready');
    assert.equal(R.wm.egPrebuild(eh(11)), 'ready');
    assert.equal(bandUps(R.ups, band2) - u0, 2);
    assert.equal(R.wm.egSwapCircle(eh(11)), true);
    assert.equal(bandUps(R.ups, band2) - u0, EG_BAND_RECORDS.length, 'the swap put up the rest of it');
    assert.deepEqual(R.painted, [], 'and painted none');
    // a rest cut short and no swap in place (the old step): the stand puts up what is left of it, each record once
    R.wm.standEgHall(R.ctx, eh(15));
    const band3 = egBandOfCircle(16), u1 = bandUps(R.ups, band3);
    assert.equal(R.wm.egPrebuild(eh(16)), 'ready');
    assert.equal(R.wm.egPrebuild(eh(16)), 'ready');
    R.wm.standEgHall(R.ctx, eh(16));
    assert.equal(bandUps(R.ups, band3) - u1, EG_BAND_RECORDS.length, 'the stand put up the rest of it, none twice');
    assert.deepEqual(R.painted, [band3], 'painted here, under the veil');
  } finally { W.restore(); }
  // no worker: nothing painted in the rest; the old step's stand paints it under the veil
  const N = rig(null);
  N.wm.standEgHall(N.ctx, eh(5));
  N.painted.length = 0;
  assert.equal(N.wm.egPrebuild(eh(6)), null, 'no build offered');
  assert.deepEqual([N.painted, bandUps(N.ups, egBandOfCircle(6))], [[], 0], 'nothing painted or put up in the rest');
  N.wm.standEgHall(N.ctx, eh(6));
  assert.deepEqual(N.painted, [egBandOfCircle(6)], 'the stand paints it, under the veil');
});

test('AUDIT EG V L6-8 THE NEW CIRCLE\'S HALLS COME WITH ITS BUILD (EG-H3\'s sixth departure; section 7): once its dress is up, each prebuild takes one of the built circle\'s halls as given, the five in five rest frames, and THE SWAP takes any left before it builds the waystones and stands the spans - so the page lays no hall of a circle the worker built; every one is the hall law\'s own (mutants: the specs never taken; taken after the swap reads them; one taken twice)', async () => {
  const W = await workerOf();
  try {
    const R = rig(W.factory);
    R.wm.standEgHall(R.ctx, eh(2));
    for (let k = 0; k < 5; k++) assert.equal(R.wm.egPrebuild(eh(3)), 'ready');
    const halls = egCircleSpecs(SEED, 3, 0).map((s) => s.h);
    assert.deepEqual(R.given, halls, 'a hall a rest frame, the five');
    assert.equal(R.wm.egPrebuild(eh(3)), 'ready');
    assert.deepEqual(R.given, halls, 'each once');
    assert.equal(R.wm.egSwapCircle(eh(3)), true);
    assert.deepEqual(R.given, halls);
    // a rest cut short: the swap gives the rest first
    R.given.length = 0;
    assert.equal(R.wm.egPrebuild(eh(4)), 'ready');
    assert.deepEqual(R.given, [egCircleSpecs(SEED, 4, 0)[0].h]);
    const WM = rd('src/scenes/eliteGates/egCircleHost.js'), swap = between(WM, '  function egSwapCircle(r) {', '  // ── EG-H3 end');
    assert.ok(swap.indexOf('egSwapFeed(parts, egBandOfCircle(r.c));') < swap.indexOf('egLookBuild(') && swap.indexOf('egSwapFeed(parts, egBandOfCircle(r.c));') < swap.indexOf('ctx.egRecircle?.('), 'given before the waystones and the spans read them');
    assert.equal(R.wm.egSwapCircle(eh(4)), true);
    assert.deepEqual(R.given, egCircleSpecs(SEED, 4, 0).map((s) => s.h), 'the swap gave the four left');
  } finally { W.restore(); }
});
