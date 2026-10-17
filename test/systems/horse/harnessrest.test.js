// HARNESS-REST (2026-10-11, a profile of a player's live client in a town: 4.0% of the main thread - eleven parked
// teams' harnesses stepped, laid and sent to the GPU every frame, their ends never moving; bible/07-Rendering/
// Performance-Priority.md HARNESS-REST) - A HARNESS WHOSE ENDS STAND STILL COMES TO REST. Over a real pool's real driven
// harness (perfwagon.test.js's world): still for HARNESS_REST_S it is neither stepped, laid nor sent again, and hangs as
// last drawn; an end that moves wakes it in that frame; an end creeping under HARNESS_STILL_M a frame wakes it too, once
// the creep from where it came to rest is past it.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundsOf } from '../../../src/render/bounds.js';
import { createHorseCartPool, harnessStill, HARNESS_REST_S, HARNESS_STILL_M } from '../../../src/scenes/horseCartPool.js';
import { makeWorld } from '../../hccWorld.mjs';
import { TRANSPORT } from '../../../src/systems/horse/horseCartLaw.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const QUIET = { warn() {}, error() {}, info() {} };
const ART = { ensureStationary: () => true, ensureWalk() {}, hasWalk: () => true };
/** A renderer that counts what the harness sends it. */
function fakeRenderer() {
  const r = { sent: 0 };
  r.createMesh = (model) => ({ model, bounds: boundsOf(model.positions) });
  r.updateMeshVertices = (m, p) => { r.sent++; boundsOf(p).forEach((v, i) => { m.bounds[i] = v; }); };
  r.destroyMesh = () => {}; r.drawMesh = () => {}; r.recordShadowMesh = () => {};
  r.uploadTexture = () => {}; r.evictTexture = () => {};
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] }); r.destroyBillboardBatch = () => {};
  return r;
}
async function drivenHarness() {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'openWagon', bakedWagon: async (k) => JSON.parse(rd(`src/assets/wagons/${k}.json`)), log: QUIET, horses: () => 2 });
  pool.partsOf('openWagon'); await flush();
  const world = makeWorld({ presentation: { ...pool.presentation, horseArt: ART } });
  pool.attach(world.rt);
  const { w, rt, step } = world;
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 40; i++) { w.pos[2] += 0.1; step(); }
  return { ...world, pool, renderer };
}
const ropesOf = (h) => h.ropes.map((r) => [...r.p]);

test('HARNESS-REST harnessStill: every end of every rope within HARNESS_STILL_M of where it stood, at the same scale - a hair over on one axis of one end, another scale, another count or nothing to stand by is not still (mutants: an end unread, the scale unread)', () => {
  const at = [{ a: [1, 2, 3], b: [4, 5, 6], g: 1 }, { a: [0, 0, 0], b: [1, 1, 1], g: 1 }];
  const moved = (i, end, k, by, g = 1) => at.map((e, j) => ({ a: [...e.a], b: [...e.b], g: j === i ? g : e.g, ...(j === i ? { [end]: e[end].map((v, n) => (n === k ? v + by : v)) } : {}) }));
  assert.equal(harnessStill(moved(0, 'a', 0, 0), at), true, 'where it stood');
  assert.equal(harnessStill(moved(1, 'b', 2, HARNESS_STILL_M / 2), at), true, 'within the hair');
  for (const [i, end, k] of [[0, 'a', 0], [0, 'a', 1], [1, 'b', 2], [1, 'a', 0]]) assert.equal(harnessStill(moved(i, end, k, HARNESS_STILL_M * 2), at), false, `rope ${i} end ${end} axis ${k} moved`);
  assert.equal(harnessStill(moved(0, 'a', 0, 0, 2), at), false, 'grown');
  assert.equal(harnessStill(at.slice(1), at), false, 'a rope fewer');
  assert.equal(harnessStill(at, null), false, 'nothing to stand by');
});

test(`HARNESS-REST a real driven pair's harness, standing: stepped and sent every frame for HARNESS_REST_S (${HARNESS_REST_S} s), then neither stepped, laid nor sent - its ropes hanging as last drawn; the team moving off wakes it that frame (mutants: never at rest, the clock unread, a moved end unread, the rest sent anyway)`, async () => {
  const world = await drivenHarness();
  const { pool, renderer, w, step } = world;
  const dt = 1 / 60, eye = [0, 2, -5];
  pool.frame(dt, eye, 0);
  const h = pool.harness.get('');
  assert.ok(h?.gpu && h.ropes.length >= 2, 'a driven pair\'s traces and reins');
  // standing: every frame stepped and sent until the clock runs
  const frames = Math.round(HARNESS_REST_S / dt);
  renderer.sent = 0;
  for (let i = 0; i < frames - 2; i++) pool.frame(dt, eye, 0);
  assert.equal(renderer.sent, frames - 2, 'still, but not yet at rest: sent every frame');
  for (let i = 0; i < 4; i++) pool.frame(dt, eye, 0);
  const sentAtRest = renderer.sent;
  const hung = ropesOf(h);
  for (let i = 0; i < 120; i++) pool.frame(dt, eye, 0);
  assert.equal(renderer.sent, sentAtRest, 'at rest: nothing sent');
  assert.deepEqual(ropesOf(h), hung, 'and its ropes not stepped - hanging as last drawn');
  assert.equal(pool.harness.get(''), h, 'the same harness, kept');
  // the team moves off: the frame it moves in, stepped and sent
  w.pos[2] += 0.5; step();
  renderer.sent = 0;
  pool.frame(dt, eye, 0);
  assert.equal(renderer.sent, 1, 'woken the frame its ends move');
  assert.notDeepEqual(ropesOf(h), hung, 'and stepped');
});

test('HARNESS-REST an end creeping a fraction of HARNESS_STILL_M a frame is measured from where it came to rest, not from last frame - the creep adds up and wakes it (mutants: measured from last frame)', async () => {
  const world = await drivenHarness();
  const { pool, renderer, w, step } = world;
  const dt = 1 / 60, eye = [0, 2, -5];
  for (let i = 0; i < Math.round(HARNESS_REST_S / dt) + 4; i++) pool.frame(dt, eye, 0);
  const h = pool.harness.get('');
  renderer.sent = 0;
  pool.frame(dt, eye, 0);
  assert.equal(renderer.sent, 0, 'at rest');
  // the team creeps 0.025 mm a frame (the fake world carries the driver's point to every end, one to one): a rope at rest
  // is never left more than a tenth of a millimetre off the point it hangs from
  let woke = -1;
  for (let i = 1; i <= 12 && woke < 0; i++) {
    w.pos[2] += 2.5e-5; step();
    pool.frame(dt, eye, 0);
    if (renderer.sent) woke = i;
  }
  assert.ok(woke >= 4 && woke <= 6, `woken once the creep from where it came to rest passed the hair (frame ${woke})`);
  assert.ok(h.stillS < HARNESS_REST_S);
});
