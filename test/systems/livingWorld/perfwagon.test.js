// PERF-WAGON (2026-10-10, Mac: "For carts, wagons, etc, we need culling"): THE REST OF THE CARTS, WAGONS AND TENTS ARE
// CULLED (bible/07-Rendering/Performance-Priority.md PERF-WAGON). PERF-TEAMS (test/scenes/perf_teams.test.js) cut another
// player's team by its distance and asked each of the pool's wagons the street's view test in the world host; what it
// left drawn every frame, behind the eye or not - the living world's road teams (LW10), the harness, Eye of the
// Beholder's cart, the camps' and the hideouts' tents, and every one of them in the fixed city's host - now takes the
// same verdict (PERF-YARD's law: in view drawn, off screen in a shadow's reach cast into the maps alone, else nothing).
//
// BY EXECUTION over the real producers: frustum.js sphereAabb and decorRoom.js drawSeen / castOnly; the road's teams
// over a real pool's presentation and its baked Small Cart; a real driven harness; the real cart; a real camp's tent;
// a real hideout's tents over the synthetic map's bands. Then the hosts' wiring, all four named.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sphereAabb } from '../../../src/render/frustum.js';
import { boundsOf } from '../../../src/render/bounds.js';
import { drawSeen, castOnly, DECOR_DRAW, DECOR_SHADOW, DECOR_SKIP } from '../../../src/scenes/decor/decorRoom.js';
import { createHorseCartPool, peerTeamBox } from '../../../src/scenes/horseCartPool.js';
import { createRoadTeams, ROAD_WAGON_KIND } from '../../../src/world/road/roadTeams.js';
import { makeWorld } from '../../hccWorld.mjs';
import { TRANSPORT, NORMAL_GROUND_OFFSET } from '../../../src/systems/horse/horseCartLaw.js';
import { createEotbWagon } from '../../../src/player/eyeOfTheBeholder/eotbWagon.js';
import { createCamps } from '../../../src/scenes/camps.js';
import { TENT_MODEL } from '../../../src/systems/survival/camp.js';
import { createSurvivalItem } from '../../../src/systems/survival/items.js';
import { TEMPLATE } from '../../../src/systems/survival/food.js';
import { setWorldMinutes } from '../../../src/systems/worldTick.js';
import { createHideouts } from '../../../src/scenes/hideouts.js';
import { hideoutsOf, outlawBandAt } from '../../../src/systems/livingWorld/outlaws.js';
import { NATIVE_PER_M } from '../../../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../../../src/systems/livingWorld/relations.js';
import { livingMap } from '../../lwRoads.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const bakeOf = (kind) => JSON.parse(rd(`src/assets/wagons/${kind}.json`));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const QUIET = { warn() {}, error() {}, info() {} };
const ART = { ensureStationary: () => true, ensureWalk() {}, hasWalk: () => true };
/** A renderer the way the real one mints its meshes: each its measured sphere (`bounds`, boundsOf - renderer.createMesh's
 *  own measure), kept with its vertices (updateMeshVertices); the draws and the shadow records apart. */
function fakeRenderer() {
  const r = { draws: [], casts: [], meshes: [] };
  r.createMesh = (model) => { const m = { model, bounds: boundsOf(model.positions) }; r.meshes.push(m); return m; };
  r.updateMeshVertices = (m, p) => { boundsOf(p).forEach((v, i) => { m.bounds[i] = v; }); };
  r.destroyMesh = () => {};
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, m: [...m], o });
  r.recordShadowMesh = (gpu, m) => r.casts.push({ gpu, m: [...m] });
  r.uploadTexture = () => {}; r.evictTexture = () => {};
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] }); r.destroyBillboardBatch = () => {};
  return r;
}
const near = (list, x, z, reach = 12) => list.some((d) => Math.hypot(d.m[12] - x, d.m[14] - z) < reach);

test('PERF-WAGON the measures: sphereAabb carries a mesh\'s sphere into the world - the centre by the whole matrix, the radius by its longest axis; drawSeen draws by the verdict over a box - in view drawn, off screen in a shadow\'s reach cast alone (what casts nothing casting nothing), else nothing, and with no test or no box drawn and never asked; castOnly one a renderer (mutants: the radius ungrown, the centre unmoved, the verdict unread, the cast arm drawn, the skip drawn, a cast counted)', () => {
  const s = Float32Array.of(1, 2, 3, 0.5);
  assert.deepEqual(sphereAabb(s, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, -5, 1]), [10.5, 1.5, -2.5, 11.5, 2.5, -1.5], 'carried by the translation');
  const turned = sphereAabb(s, [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]).map((v) => +v.toFixed(9) + 0);   // a quarter turn about y: x -> -z, z -> x
  assert.deepEqual(turned, [2.5, 1.5, -1.5, 3.5, 2.5, -0.5], 'its centre turned with the frame');
  assert.deepEqual(sphereAabb(s, [3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1]), [1.5, 4.5, 7.5, 4.5, 7.5, 10.5], 'grown: the centre and the radius three times');
  assert.equal(sphereAabb(null, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), null, 'no sphere: nothing to measure');
  assert.equal(sphereAabb(s, null), null);
  const log = { draws: [], casts: [] };
  const r = { drawMesh: (g, m, remap, o) => log.draws.push([g, o?.noShadow ?? false]), recordShadowMesh: (g) => log.casts.push(g) };
  const box = [0, 0, 0, 1, 1, 1], M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const asked = [];
  const by = (v) => (b) => { asked.push(b); return v; };
  assert.equal(drawSeen(r, by(DECOR_DRAW), box, 'a', M), true, 'in view: drawn, counted');
  assert.equal(drawSeen(r, by(DECOR_SHADOW), box, 'b', M), false, 'a cast is no draw');
  assert.equal(drawSeen(r, by(DECOR_SHADOW), box, 'room', M, null, { noShadow: true }), false);
  assert.equal(drawSeen(r, by(DECOR_SKIP), box, 'c', M), false);
  assert.deepEqual([log.draws, log.casts], [[['a', false]], ['b']], 'drawn the one in view, cast the one in reach - the room casting nothing - and the third neither');
  assert.equal(asked.length, 4);
  asked.length = 0;
  assert.equal(drawSeen(r, null, box, 'd', M), true, 'no test: drawn');
  assert.equal(drawSeen(r, by(DECOR_SKIP), null, 'e', M), true, 'no box: drawn');
  assert.deepEqual([asked.length, log.draws.map(([g]) => g)], [0, ['a', 'd', 'e']], 'and never asked');
  assert.equal(castOnly(r), castOnly(r), 'one maps-alone renderer a renderer, kept');
});

/** A real pool's presentation and the road's teams over it, the cart's bake built; one wagon synced at each point. */
async function roadTeamsAt(points, grow = 1) {
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'caravan', bakedWagon: async (k) => bakeOf(k), log: QUIET });
  pool.partsOf(ROAD_WAGON_KIND); await flush();
  const teams = createRoadTeams({ renderer: r, presentation: () => ({ ...pool.presentation, horseArt: ART }), collider: () => null });
  teams.sync([], points.map(([x, z], i) => ({ key: `t${i}:w0`, feet: [x, 0, z], front: [x, 0, z + 3], yaw: 0, moving: true, tier: 60, s: 0, distM: i, hitched: true })), { eye: [0, 1.7, 0], grow });
  return { r, teams };
}

test('PERF-WAGON the road\'s teams (LW10): each wagon asked PERF-TEAMS\' verdict over PERF-TEAMS\' box (the pool\'s teamVerdict, peerTeamBox) - in view drawn, in a shadow\'s reach cast alone, else nothing; no test, every wagon drawn as before; a grown wagon under the Overworld drawn whole and never asked (mutants: the test not taken, the cast arm drawn, the grow unread, the test not handed on)', async () => {
  const { r, teams } = await roadTeamsAt([[0, 30], [0, -30]]);
  const asked = [];
  const ahead = (off) => (box) => { asked.push([...box]); return (box[2] + box[5]) / 2 > 0 ? DECOR_DRAW : off; };
  assert.equal(teams.draw(r, null, ahead(DECOR_SKIP)), 1, 'the one ahead');
  assert.ok(near(r.draws, 0, 30) && !near(r.draws, 0, -30), 'drawn ahead, nothing behind');
  assert.equal(r.casts.length, 0);
  assert.deepEqual(asked, [peerTeamBox([0, NORMAL_GROUND_OFFSET, 30]), peerTeamBox([0, NORMAL_GROUND_OFFSET, -30])], 'each wagon\'s own PERF-TEAMS box, where it is drawn');
  r.draws.length = 0;
  assert.equal(teams.draw(r, null, ahead(DECOR_SHADOW)), 1, 'a cast is no draw');
  assert.ok(!near(r.draws, 0, -30) && r.casts.length > 0 && r.casts.every((c) => Math.hypot(c.m[12], c.m[14] + 30) < 12), 'behind: its parts cast into the maps alone');
  r.draws.length = 0; r.casts.length = 0;
  assert.equal(teams.draw(r), 2, 'no test: both, as before');
  assert.ok(near(r.draws, 0, 30) && near(r.draws, 0, -30));
  // the Overworld's grown teams: drawn whole, the test never asked
  const g = await roadTeamsAt([[0, -30]], 8);
  let gAsked = 0;
  assert.equal(g.teams.draw(g.r, null, () => { gAsked++; return DECOR_SKIP; }), 1);
  assert.equal(gAsked, 0, 'a grown wagon is not PERF-TEAMS\' box');
  // the roads' layer hands the host's test on to the teams
  assert.ok(rd('src/scenes/livingWorld/livingRoads.js').includes('    drawTeams: (r, cull = null) => deps.teams?.draw(r, null, cull) ?? 0,'), 'the roads\' layer passes the test to its teams');
});

/** The fake flat world's runtime, drawn by a real pool of Mac's `kind` on the measuring renderer. */
async function wagonWorld(kind, opts = {}) {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, bakedWagon: async (k) => bakeOf(k), log: QUIET, ...opts });
  pool.partsOf(kind); await flush();
  const world = makeWorld({ presentation: { ...pool.presentation, horseArt: ART } });
  pool.attach(world.rt);
  return { ...world, pool, renderer };
}
function drive(world, n = 40) {
  const { w, rt, step } = world;
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < n; i++) { w.pos[2] += 0.1; step(); }
}

test('PERF-WAGON the harness: a driven pair\'s traces and reins asked the same test over the ropes\' own sphere (kept with them as they move) - drawn in view, and off screen nothing at all, in a shadow\'s reach or not (a strap casts nothing); no test, drawn as before (mutants: the box unmade, the reach drawn, the test not handed on)', async () => {
  const world = await wagonWorld('openWagon', { horses: () => 2 });
  drive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const h = world.pool.harness.get('');
  assert.ok(h?.gpu?.bounds, 'a harness, its sphere measured');
  const rope = world.pool.harnessEnds('').flatMap((e) => [e.a, e.b]);
  const harnessDrawn = () => world.renderer.draws.some((d) => d.gpu === h.gpu);
  const run = (cull) => { world.renderer.draws.length = 0; world.renderer.casts.length = 0; world.pool.draw(world.renderer, null, {}, cull); };
  const seen = [];
  run((box) => { seen.push([...box]); return DECOR_DRAW; });
  assert.ok(harnessDrawn(), 'in view: drawn');
  const hb = seen.find((b) => rope.every((p) => p[0] >= b[0] - 1e-6 && p[0] <= b[3] + 1e-6 && p[1] >= b[1] - 1e-6 && p[1] <= b[4] + 1e-6 && p[2] >= b[2] - 1e-6 && p[2] <= b[5] + 1e-6) && b[3] - b[0] < 20);
  assert.ok(hb, 'its own box asked, round every rope\'s ends');
  for (const off of [DECOR_SHADOW, DECOR_SKIP]) {
    run((box) => (box === seen[0] ? DECOR_DRAW : (box[3] - box[0] < 20 ? off : DECOR_DRAW)));
    assert.equal(harnessDrawn(), false, `off screen (${off}): not drawn`);
    assert.equal(world.renderer.casts.some((c) => c.gpu === h.gpu), false, 'and never cast');
  }
  run(null);
  assert.ok(harnessDrawn(), 'no test: drawn');
});

test('PERF-WAGON the cart (Eye of the Beholder\'s): asked the test over its mesh\'s own box where it stands - in view drawn, in a shadow\'s reach cast alone, else nothing; no test, drawn; the box not in hand yet, drawn and never asked (mutants: the box unmade, the test not handed on)', async () => {
  const w = createEotbWagon();
  const cpu = new Map([[41239, { positions: new Float32Array([-1, 0, -2, 1, 1, 2]) }]]);
  w.attach({ getGpuMesh: async () => ({ id: 41239 }), cpuModels: cpu });
  await flush(2);
  w.tick(1 / 60, { feet: [0, 0, 0], yaw: 0, height: 1.8, cart: true });   // the cart 2.49 behind
  const log = { draws: [], casts: [] };
  const r = { drawMesh: (g, m) => log.draws.push(m[14]), recordShadowMesh: (g, m) => log.casts.push(m[14]) };
  const asked = [];
  assert.equal(w.draw(r, null, (box) => { asked.push([...box]); return DECOR_SKIP; }), false);
  assert.deepEqual([log.draws, log.casts], [[], []], 'off screen: nothing');
  assert.ok(asked.length === 1 && asked[0][2] <= -2.49 - 2 + 1e-6 && asked[0][5] >= -2.49 + 2 - 1e-6 && asked[0][4] >= 1 + 0.9 - 1e-6, `its mesh's box, placed: ${asked[0]}`);
  assert.equal(w.draw(r, null, () => DECOR_SHADOW), false);
  assert.equal(log.casts.length, 1, 'in a shadow\'s reach: cast alone');
  assert.equal(w.draw(r, null, () => DECOR_DRAW), true);
  assert.equal(w.draw(r), true, 'no test: drawn');
  assert.equal(log.draws.length, 2);
  assert.ok(rd('src/player/mwView.js').includes('  return eotbWagon.draw(renderer, texRemap, cull);'), 'the seam hands the host\'s test on');
  // its box not in hand (the pipeline has no triangles for it): drawn, never asked
  const bare = createEotbWagon();
  bare.attach({ getGpuMesh: async () => ({ id: 41239 }), cpuModels: new Map() });
  await flush(2);
  bare.tick(1 / 60, { feet: [0, 0, 0], yaw: 0, height: 1.8, cart: true });
  let bareAsked = 0;
  assert.equal(bare.draw(r, null, () => { bareAsked++; return DECOR_SKIP; }), true);
  assert.equal(bareAsked, 0);
});

test('PERF-WAGON the tents: a camp\'s tent asked the test over its model\'s own box (its target\'s), a hideout\'s over its mesh\'s sphere - in view drawn, in a shadow\'s reach cast alone, else nothing; no test, every tent drawn as before (mutants: each box unmade)', async () => {
  setWorldMinutes(1000);
  const renderer = {
    createBillboardBatch: () => ({ centers: [], frame: null }), destroyBillboardBatch: () => {}, drawMesh: () => {},
  };
  const state = { feet: [0, 1, 0], yaw: 0 };
  const entity = { items: [] };
  const camps = createCamps({
    renderer, getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {},
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) }, entity,
    camera: () => ({ feet: state.feet, yaw: state.yaw }), collider: () => ({ raycast: (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null) }),   // a floor at y = 0 (surv3_camps' own)
    place: () => ({}), pixelKeyAt: () => 'px:0', say: () => {}, showOverlay: () => {}, openRest: () => {}, advanceMinutes: () => {}, selfId: () => null,
  });
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment);
  entity.items.push(gear);
  assert.equal(camps.placeItem(gear, entity.items), true);
  await flush(2);
  const log = { draws: [], casts: [] };
  const r = { drawMesh: (g, m) => log.draws.push(m), recordShadowMesh: (g, m) => log.casts.push(m) };
  const asked = [];
  assert.equal(camps.draw(r, null, (box) => { asked.push([...box]); return DECOR_SKIP; }), 0);
  assert.deepEqual([log.draws.length, log.casts.length], [0, 0], 'off screen: nothing');
  assert.equal(asked.length, 1);
  assert.ok(asked[0][4] - asked[0][1] > 1.9 && asked[0][4] - asked[0][1] < 2.1, `the model's own box, two high: ${asked[0]}`);
  assert.equal(camps.draw(r, null, () => DECOR_SHADOW), 0);
  assert.equal(log.casts.length, 1, 'cast alone');
  assert.equal(camps.draw(r, null, () => DECOR_DRAW), 1);
  assert.equal(camps.draw(r), 1, 'no test: drawn');
  // a hideout's tents, over the synthetic map's bands: a band in its hideout, stood
  const map = livingMap({});
  map.world.townsIn = (rg) => map.towns.filter((tn) => tn.region === rg);   // the host's composition (auditlwii2_outlaws realMap)
  const hs = hideoutsOf(17, map.world) ?? [];
  let h = null, t = 0;
  for (const x of hs) { for (let day = 300; day < 400 && !h; day++) if (outlawBandAt(x, day * DAY_MIN + 600)) { h = x; t = day * DAY_MIN + 600; } if (h) break; }
  assert.ok(h, 'a band holding a hideout');
  const host = createHideouts({
    hideoutsNear: () => [h], bandAt: (x, at) => outlawBandAt(x, at), clock: () => t, here: () => ({ x: h.x + 50 * NATIVE_PER_M, z: h.z }), ready: () => true, owner: () => true,
    sceneOf: (nx, nz) => [nx / NATIVE_PER_M, 0, nz / NATIVE_PER_M],
    spawn: (type, feet, o) => Promise.resolve({ type, feet, o, dead: false, entity: {} }), remove: () => {}, inPool: () => true,
    relations: () => createRelations(), say: () => {}, chest: function* () { return { items: [], robbed: [] }; }, dropPile: (items) => ({ items }), removePile: () => {},
    now: () => 0, renderer: { createBillboardBatch: () => ({ centers: [] }), destroyBillboardBatch: () => {} }, getTexture: () => Promise.resolve({ getFrameCount: () => 1, getSize: () => ({ width: 8, height: 16 }) }),
    meshes: { getGpuMesh: () => Promise.resolve({ bounds: Float32Array.of(0, 1, 0, 2) }) }, uploadRecordFrame: () => {},
  });
  host.frame(1.01);
  await flush(2);
  const tents = host.shown()?.tents ?? 0;
  assert.ok(tents >= 2, `its tents stood (${tents})`);
  log.draws.length = 0; log.casts.length = 0;
  const hasked = [];
  assert.equal(host.draw(r, null, (box) => { hasked.push([...box]); return DECOR_SKIP; }), 0);
  assert.deepEqual([log.draws.length, log.casts.length, hasked.length], [0, 0, tents], 'off screen: nothing, each tent asked');
  assert.ok(hasked.every((b) => Math.abs(b[4] - b[1] - 4) < 1e-6 && Math.abs(b[3] - b[0] - 4) < 1e-6 && Math.abs(b[2] + b[5] - 2 * h.z / NATIVE_PER_M) < 100), `each its sphere's box, where it stands: ${JSON.stringify(hasked)}`);
  assert.equal(host.draw(r, null, () => DECOR_SHADOW), 0);
  assert.equal(log.casts.length, tents, 'cast alone');
  assert.equal(host.draw(r), tents, 'no test: every tent');
});

test('PERF-WAGON the four hosts: world.js hands the street\'s test (yardCull) to the cart, the tents, the road\'s teams and the hideouts\' tents beside PERF-TEAMS\' wagons; exterior.js makes its own over its frame\'s planes - made before the pass - and hands it to the cart, the tents and the wagons; worldModes.js and dungeonContext.js draw none of them (the view out of a window, its eye another, untested) (mutants: each wire, the fixed city\'s test off)', () => {
  const w = rd('src/scenes/world.js'), e = rd('src/scenes/exterior.js');
  for (const line of [
    '    mwViewDrawWagon(renderer, null, yardCull);',
    '    camps.draw(renderer, null, yardCull);',
    '    hcc.draw(renderer, null, tvf ? { selfGrow: tvf.grow, grow: peerGrow } : undefined, yardCull);',
    "    if (livingRoads && livingWorldOn() && _mode() === 'exterior') livingRoads.drawTeams(renderer, yardCull);",
    '    _livingHideoutsHost?.draw(renderer, null, yardCull);',
  ]) assert.ok(w.includes(line), `world.js: ${line}`);
  const kept = w.indexOf('    _lastProj = proj; _lastView = view;   // TI1'), pass = w.indexOf('    mwViewDrawWagon(renderer, null, yardCull);');
  assert.ok(kept > 0 && kept < pass, 'the frame\'s matrices kept before the pass');
  assert.ok(e.includes('  const streetCull = (box) => (cullOn ? decorCullVerdict(_planes, box, streetReach) : DECOR_DRAW);'), 'exterior.js: its own test over its frame\'s planes, ?cull=off honoured');
  assert.ok(e.includes('  const streetReach = (box) => renderer.shadowReach(box);'));
  for (const line of [
    '    mwViewDrawWagon(renderer, texRemap, streetCull);',
    '    camps.draw(renderer, texRemap, streetCull);',
    '    hcc.draw(renderer, texRemap, undefined, streetCull);',
  ]) assert.ok(e.includes(line), `exterior.js: ${line}`);
  const planes = e.indexOf('    if (cullOn) frustumPlanes(multiply(proj, view, _pv), _planes);'), epass = e.indexOf('    mwViewDrawWagon(renderer, texRemap, streetCull);');
  assert.ok(planes > 0 && planes < epass, 'the planes made before the pass');
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const s = rd(f);
    assert.ok(!/hcc\.draw\(|mwViewDrawWagon\(|camps\.draw\(|drawTeams\(/.test(s), `${f} draws none of them`);
  }
  assert.ok(e.includes('renderer.outsideViewDraws?.add(({ renderer: r }) => { if (hccOn()) hcc.drawOutside(r, null); });'), 'the view out untested');
});
