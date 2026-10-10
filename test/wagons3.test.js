// WAGONS3 (2026-10-10, bible/06-Systems/Wagons.md section WAGONS3; Mac: "1. All the wagons/carts are oversized in the
// overworld 2. Spawning the wagon can trap you under the wagon 3. ... sit on the wagon itself, the ledge its built for
// and requiring 2 horses to use. 4. Proper animated rope mechanics that connect the horses to the wagon 5. Using a wagon
// doesnt allow you to zoom out into 3rd person when mounted"; asked: "Open Wagon + Caravan", "Buy a second Horse",
// "Traces and reins"). The law (systems/wagonKinds.js, world/wagonModels.js, systems/wagonRopes.js), the pool
// (scenes/horseCartPool.js - the team, the driver, the harness, the parked box, the Overworld's rig), the runtime's gate
// (systems/horseCart.js) and the hosts' seat (scenes/world.js, scenes/exterior.js, player/mwView.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from './hccWorld.mjs';
import { TRANSPORT, WAGON_MODE, HORSE_MODE, HITCHED_HORSE_LOCAL_Z, DEPLOY_CLEARANCE, HORSE_BOX_SIZE } from '../src/systems/horseCartLaw.js';
import { createHorseCartPool, CAPSULE_BOX_SKIN, TEAM_MAX, WAGON_BUCKET } from '../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import {
  WAGON_KINDS, wagonHorsesOf, horseCountOf, wagonTeamShort, WAGON_TEAM_TEXT, newWagonItem,
} from '../src/systems/wagonKinds.js';
import { TRANSPORT_HORSE } from '../src/systems/itemTemplates.js';
import {
  MEASURED, LIFT, TEAM, driverSeatFor, teamSidesOf, traceRootsOf, DRIVER_HANDS_TOP, RIG_READ_M, rigLengthOf, rigGrowOf,
  wagonGeometry, buildBakedWagonParts,
} from '../src/world/wagonModels.js';
import { SEATED_HIP_HEIGHT, SEAT_HIP_DROP, SEAT_PELVIS_HEIGHT, seatedMotion, seatedCamera, seatRigInput, seatTopByte } from '../src/player/seatPose.js';
import { ROPE, newRope, layRope, stepRope, restSag, tubeModel, tubeInto, tubeVertexCount } from '../src/systems/wagonRopes.js';
import { TEX, WAGON_ARCHIVE, wagonArt } from '../src/world/wagonArt.js';
import { quatAngleAxis, UNITY_QUAT_IDENTITY, quatRotate as quatRotateT, quatForward } from '../src/world/quat.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bakeOf = (kind) => JSON.parse(rd(`src/assets/wagons/${kind}.json`));
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);
const QUIET = { warn() {}, error() {}, info() {} };
const ART = { ensureStationary: () => true, ensureWalk() {}, hasWalk: () => true };
function fakeRenderer() {
  const r = { draws: [], meshes: [], updates: [], destroyed: [], batches: [] };
  r.createMesh = (model) => { const m = { model }; r.meshes.push(m); return m; };
  r.updateMeshVertices = (m, p, n) => { r.updates.push({ m, p: Float32Array.from(p), n: Float32Array.from(n) }); };
  r.destroyMesh = (m) => r.destroyed.push(m);
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, m: [...m], o });
  r.uploadTexture = () => {};
  r.createBillboardBatch = () => { const b = { origin: [0, 0, 0] }; r.batches.push(b); return b; };
  r.destroyBillboardBatch = (b) => { r.batches = r.batches.filter((x) => x !== b); };
  return r;
}
/** The runtime on the fake flat world, drawn by a real pool of Mac's `kind`. */
async function wagonWorld(kind, opts = {}) {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, bakedWagon: async (k) => bakeOf(k), log: QUIET, ...opts });
  pool.partsOf(kind); await flush();
  const world = makeWorld({ presentation: { ...pool.presentation, horseArt: ART } });
  pool.attach(world.rt);
  return { ...world, pool, renderer, parts: pool.partsOf(kind) };
}
/** Drive off and on along +z for `n` steps of 10 cm. */
function drive(world, n = 40) {
  const { w, rt, step } = world;
  step(2);
  const r = rt.tryUseTransport(TRANSPORT.Cart);
  step(2);
  for (let i = 0; i < n; i++) { w.pos[2] += 0.1; step(); }
  return r;
}
const horseItems = (n) => Array.from({ length: n }, () => ({ templateIndex: TRANSPORT_HORSE }));
/** Drive on into a left turn: `n` steps of 10 cm, the rider turned `dyaw` radians each - a four-wheeler mid-turn has its
 *  pole steered off its body. */
function turnDrive(world, n = 60, dyaw = 0.03) {
  const { w, step } = world;
  for (let i = 0; i < n; i++) { w.yaw += dyaw; w.pos[0] += Math.sin(w.yaw) * 0.1; w.pos[2] += Math.cos(w.yaw) * 0.1; step(); }
}
const qr = (q, v) => quatRotateT(q, v);

// ── THE LAW ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('WAGONS3 THE TEAM\'S LAW: the two bench wagons take a pair, the Small Cart one horse; a pack\'s horses counted item by item; a team short of its wagon\'s horses is refused by name - none at all is the mod\'s own refusal, no wagon none (mutants: the pair dropped, the count by presence, the zero refused)', () => {
  assert.deepEqual(Object.fromEntries(Object.values(WAGON_KINDS).map((k) => [k.key, k.horses])), { cart: 1, openWagon: 2, caravan: 2 });
  assert.equal(wagonHorsesOf('caravan'), 2);
  assert.equal(wagonHorsesOf('nonsense'), 1, 'a kind the law does not know: the Small Cart\'s');
  assert.equal(horseCountOf([...horseItems(2), { templateIndex: 1 }]), 2);
  assert.equal(horseCountOf(null), 0);
  const pack = (kind, horses) => [newWagonItem(kind), ...horseItems(horses)];
  assert.equal(wagonTeamShort(pack('openWagon', 1)), 'Your Open Wagon needs two horses to pull it. Buy another at a town\'s Stable.');
  assert.equal(wagonTeamShort(pack('caravan', 1)), WAGON_TEAM_TEXT.short('caravan'));
  assert.equal(wagonTeamShort(pack('caravan', 2)), null, 'a pair');
  assert.equal(wagonTeamShort(pack('caravan', 3)), null, 'and to spare');
  assert.equal(wagonTeamShort(pack('caravan', 0)), null, 'no horse: the mod\'s own "You need a horse to pull the wagon."');
  assert.equal(wagonTeamShort(pack('cart', 1)), null, 'the Small Cart\'s one');
  assert.equal(wagonTeamShort(horseItems(1)), null, 'no wagon');
  assert.equal(wagonTeamShort([newWagonItem('cart'), newWagonItem('openWagon'), ...horseItems(1)]), WAGON_TEAM_TEXT.short('openWagon'), 'the wagon driven is the best owned');
});

test('WAGONS3 THE DRIVER\'S SEAT, READ OFF THE BAKE: the bench wagons\' hips on their bench\'s top, a thigh or less behind its front edge and clear of the body\'s front wall; the seated feet the measured biped\'s seated hips below them - on the caravan\'s step; the Small Cart has none (mutants: the bench\'s height unread, the hips\' height unread, the lift dropped)', () => {
  assert.equal(SEAT_PELVIS_HEIGHT, 1.09);
  close(SEATED_HIP_HEIGHT, SEAT_PELVIS_HEIGHT - SEAT_HIP_DROP, 1e-12, 'the seated hips');
  assert.equal(driverSeatFor('cart'), null);
  for (const kind of ['openWagon', 'caravan']) {
    const b = MEASURED[kind].bench, bake = bakeOf(kind);
    const bench = bake.parts.find((p) => p.role === 'bench');
    // the bench's top: its up-facing polygon, interpolated along its run at the hips
    const P = (i) => [bench.positions[i * 3], bench.positions[i * 3 + 1], bench.positions[i * 3 + 2]];
    const top = bench.polygons.map((poly) => poly.map(P)).find((vs) => { const u = vs[1].map((v, k) => v - vs[0][k]), w = vs[2].map((v, k) => v - vs[0][k]); const ny = u[2] * w[0] - u[0] * w[2], l = Math.hypot(u[1] * w[2] - u[2] * w[1], ny, u[0] * w[1] - u[1] * w[0]); return Math.abs(ny / l) > 0.9 && vs[0][1] > 1.2; });
    assert.ok(top, `${kind}: the bench has a top`);
    const back = top.reduce((a, v) => (v[2] < a[2] ? v : a)), front = top.reduce((a, v) => (v[2] > a[2] ? v : a));
    const yAt = back[1] + ((b.z - back[2]) / (front[2] - back[2])) * (front[1] - back[1]);
    close(b.y, yAt, 0.01, `${kind}: the hips on the bench's top`);
    assert.ok(front[2] - b.z <= 0.45 + 1e-9 && front[2] - b.z >= 0.3, `${kind}: the knees at its lip (${front[2] - b.z})`);
    const wall = Math.max(...bake.parts.find((p) => p.role === 'body').positions.filter((_, i) => i % 3 === 2 && bake.parts.find((q) => q.role === 'body').positions[i - 1] < 3));
    assert.ok(b.z - wall > 0.12, `${kind}: clear of the front wall behind (${(b.z - wall).toFixed(2)} m)`);
    const seat = driverSeatFor(kind);
    assert.deepEqual(seat.feet.map((v) => +v.toFixed(6)), [0, +(b.y - SEATED_HIP_HEIGHT - LIFT).toFixed(6), b.z]);
    assert.equal(seat.yaw, 0, 'facing the way it is pulled');
    assert.equal(seat.top, DRIVER_HANDS_TOP);
    assert.ok(DRIVER_HANDS_TOP > SEATED_HIP_HEIGHT && DRIVER_HANDS_TOP < SEATED_HIP_HEIGHT + 0.25, 'the reins held over the lap');
  }
  // the caravan's seated feet come down on its step
  const step = bakeOf('caravan').parts.find((p) => p.role === 'step');
  const stepTop = Math.max(...step.positions.filter((_, i) => i % 3 === 1));
  const feetUp = driverSeatFor('caravan').feet[1] + LIFT;
  assert.ok(Math.abs(stepTop - feetUp) < 0.08, `the caravan's step under the seated feet: ${stepTop} vs ${feetUp}`);
  const ahead = seatRigInput([0, feetUp, MEASURED.caravan.bench.z], 0, DRIVER_HANDS_TOP).req.feet.L.at[2];
  const stepZ = step.positions.filter((_, i) => i % 3 === 2);
  assert.ok(ahead >= Math.min(...stepZ) && ahead <= Math.max(...stepZ), `the feet before the hips land on it: ${ahead}`);
});

test('WAGONS3 THE TEAM\'S PLACES: a pair either side of the pole, the Small Cart\'s one in its shafts; each horse two traces - a pair\'s from their singletrees on the turning pole, the cart\'s from its shafts\' roots on its tilted body; the pole runs on between the pair to their collars (mutants: the pair on the pole, a horse\'s traces on the other\'s tree, the cart\'s roots off its body)', () => {
  assert.deepEqual(teamSidesOf('cart'), [0]);
  assert.deepEqual(teamSidesOf('openWagon'), [-TEAM.side, TEAM.side]);
  assert.ok(TEAM.side * 2 >= HORSE_BOX_SIZE[0], 'two horses side by side, not through each other');
  const cart = traceRootsOf('cart');
  assert.equal(cart.length, 2);
  assert.ok(cart.every(([h, , , onBogie]) => h === 0 && onBogie === false));
  assert.deepEqual(cart.map(([, s]) => s), [-1, 1]);
  assert.ok(cart.every(([, , q]) => q[1] < TEAM.cartTrace[1] - LIFT - 0.05), 'the cart\'s roots on its body as Mac drew it - tipped on its axle (borne level only while hitched)');
  for (const kind of ['openWagon', 'caravan']) {
    const roots = traceRootsOf(kind);
    assert.equal(roots.length, 4, `${kind}: two horses, two traces each`);
    for (const [h, s, q, onBogie] of roots) {
      assert.equal(onBogie, true, 'on the pole\'s singletrees, turning with it');
      close(q[0], teamSidesOf(kind)[h] + s * TEAM.tree.half, 1e-12, `${kind}: horse ${h}'s ${s < 0 ? 'left' : 'right'} trace on its own tree`);
      close(q[1], TEAM.tree.y - LIFT, 1e-12, 'at the tree\'s height');
      assert.ok(q[2] < WAGON_KINDS[kind].hitch - HORSE_BOX_SIZE[2] / 2, 'behind the horse\'s rump');
    }
    // the pole: past the hitch to the collars' line, between the pair
    const g = wagonGeometry(bakeOf(kind));
    let hi = -Infinity, wide = 0;
    for (let i = 0; i < g.bogie.geometry.positions.length; i += 3) { hi = Math.max(hi, g.bogie.geometry.positions[i + 2]); }
    for (let i = 0; i < g.bogie.geometry.positions.length; i += 3) if (g.bogie.geometry.positions[i + 2] > WAGON_KINDS[kind].hitch) wide = Math.max(wide, Math.abs(g.bogie.geometry.positions[i]));
    assert.ok(hi > WAGON_KINDS[kind].hitch + TEAM.poleTip - 0.01, `${kind}: the pole past the hitch (${hi})`);
    assert.ok(wide < TEAM.side - TEAM.collar[0], `${kind}: its yoke between the collars (${wide})`);
  }
  assert.deepEqual(traceRootsOf('nonsense'), []);
});

test('WAGONS3 THE OVERWORLD\'S RIG: a driven rig is drawn as long as RIG_READ_M grown by the traveller\'s step - every kind the same length, never grown past the traveller, never shrunk below itself; off the view its own size (mutants: the traveller\'s grow kept, the floor at 1 dropped, the classic hitch unread)', () => {
  assert.equal(RIG_READ_M, 4);
  for (const kind of ['cart', 'openWagon', 'caravan']) {
    assert.equal(rigGrowOf(1, kind), 1);
    assert.equal(rigGrowOf(0.5, kind), 1);
    close(rigGrowOf(10, kind) * rigLengthOf(kind), 40, 1e-9, `${kind}: forty metres at the view's own step`);
    assert.ok(rigGrowOf(10, kind) < 10, `${kind}: less than the traveller's grow`);
    assert.ok(rigGrowOf(1.2, kind) >= 1, `${kind}: never under its own size`);
  }
  close(rigLengthOf('caravan'), WAGON_KINDS.caravan.hitch + 1.3 + 0.8, 1e-12, 'hitch, a horse\'s half, the rear wheels');
  close(rigLengthOf('cart', HITCHED_HORSE_LOCAL_Z), HITCHED_HORSE_LOCAL_Z + 1.3 + 0.57, 1e-12, 'the classic wagon standing for the kind: its own hitch');
});

// ── THE ROPES ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('WAGONS3 THE ROPES: a rope is laid at rest - its ends pinned, its middle hung the parabola\'s sag for its slack - and stepped by Verlet: it settles there under gravity, each link its share of the slack span; it swings when an end moves and is laid again when one leaps; a grown rope hangs as the small one (mutants: gravity dropped, the constraints unpinned, the leap unread, the slack unread)', () => {
  const a = [0, 2, 0], b = [0, 2, 3];
  const r = newRope('rein');
  assert.equal(r.laid, false);
  stepRope(r, a, b, 1 / 60);
  assert.equal(r.laid, true, 'its first step lays it');
  const mid = (rope) => rope.p[Math.floor(rope.n / 2) * 3 + 1];
  close(2 - mid(r), restSag(3, ROPE.rein.slack), 1e-9, 'laid at the parabola\'s sag');
  for (let i = 0; i < 600; i++) stepRope(r, a, b, 1 / 60);
  const links = [];
  for (let i = 0; i < r.n - 1; i++) links.push(Math.hypot(r.p[i * 3 + 3] - r.p[i * 3], r.p[i * 3 + 4] - r.p[i * 3 + 1], r.p[i * 3 + 5] - r.p[i * 3 + 2]));
  const want = (3 * ROPE.rein.slack) / (r.n - 1);
  assert.ok(links.every((l) => Math.abs(l - want) < 0.01), `each link its share: ${links.map((l) => l.toFixed(3))} vs ${want.toFixed(3)}`);
  assert.ok(2 - mid(r) > 0.2 && 2 - mid(r) < 0.6, `settled hanging: ${2 - mid(r)}`);
  assert.deepEqual([...r.p.slice(0, 3)], a, 'its ends where they are pinned');
  assert.deepEqual([...r.p.slice((r.n - 1) * 3)], b);
  // an end walked: the middle swings behind it, then settles
  const before = mid(r);
  for (let i = 0; i < 5; i++) stepRope(r, [0, 2 + 0.05 * (i + 1), 0], b, 1 / 60);
  assert.notEqual(mid(r), before, 'it moves with its end');
  // a leap: laid again where it hangs at rest, never swung across
  stepRope(r, [100, 2, 0], [100, 2, 3], 1 / 60);
  close(2 - mid(r), restSag(3, ROPE.rein.slack), 1e-9, 'a leap lays it again');
  assert.ok(Math.abs(r.p[3] - 100) < 1e-9 && Math.abs(r.q[3] - 100) < 1e-9, 'with no velocity');
  // grown: the same shape at the scale
  const s = newRope('trace'), g = newRope('trace');
  stepRope(s, [0, 2, 0], [0, 2, 2], 1 / 60); stepRope(g, [0, 20, 0], [0, 20, 20], 1 / 60, 10);
  for (let i = 0; i < 200; i++) { stepRope(s, [0, 2, 0], [0, 2, 2], 1 / 60); stepRope(g, [0, 20, 0], [0, 20, 20], 1 / 60, 10); }
  close((20 - mid(g)) / 10, 2 - mid(s), 0.02, 'a grown rope hangs as the small one does');
  // gravity: a rope held straight drops at its first step - its links slack, nothing else would move it down
  const st = newRope('trace');
  layRope(st, [0, 2, 0], [0, 2, 2]);
  for (let i = 0; i < st.n * 3; i += 3) st.p[i + 1] = 2;
  st.q.set(st.p);
  stepRope(st, [0, 2, 0], [0, 2, 2], 1 / 60);
  assert.ok(mid(st) < 2 - 1e-4, `gravity takes it down: ${mid(st)}`);
  // a still frame pins its ends and moves nothing else
  const at = Float64Array.from(r.p);
  stepRope(r, [100, 2, 0], [100, 2, 3], 0);
  assert.deepEqual([...r.p], [...at]);
});

test('WAGONS3 THE HARNESS\'S TUBE: ROPE.sides faces round each link, laid once with both windings and its strap\'s picture round it; each frame its rings stand square to the rope at its radius, their normals out from it (mutants: one winding, a normal not unit, the ring off its point)', () => {
  const m = tubeModel(3, WAGON_ARCHIVE, TEX.harness);
  assert.equal(m.positions.length, tubeVertexCount(3) * 3);
  assert.equal(m.indices.length, 3 * (ROPE.points - 1) * ROPE.sides * 12, 'two triangles a face, each face twice');
  assert.deepEqual(m.subMeshes, [{ textureArchive: WAGON_ARCHIVE, textureRecord: TEX.harness, startIndex: 0, primitiveCount: m.indices.length / 3 }]);
  // both windings: every triangle has its reverse
  const tris = new Set();
  for (let i = 0; i < m.indices.length; i += 3) tris.add(`${m.indices[i]},${m.indices[i + 1]},${m.indices[i + 2]}`);
  for (let i = 0; i < m.indices.length; i += 3) assert.ok(tris.has(`${m.indices[i]},${m.indices[i + 2]},${m.indices[i + 1]}`) || tris.has(`${m.indices[i + 1]},${m.indices[i]},${m.indices[i + 2]}`) || tris.has(`${m.indices[i + 2]},${m.indices[i + 1]},${m.indices[i]}`), 'each face from both sides');
  const r = newRope('trace');
  layRope(r, [0, 1, 0], [0, 1, 2]);
  tubeInto(r, 1, 0.05, m.positions, m.normals);
  const ring = ROPE.sides + 1;
  for (let i = 0; i < r.n; i++) for (let k = 0; k <= ROPE.sides; k++) {
    const v = ((1 * r.n + i) * ring + k) * 3;
    const n = [m.normals[v], m.normals[v + 1], m.normals[v + 2]];
    close(Math.hypot(...n), 1, 1e-5, 'a unit normal');
    const off = [m.positions[v] - r.p[i * 3], m.positions[v + 1] - r.p[i * 3 + 1], m.positions[v + 2] - r.p[i * 3 + 2]];
    close(Math.hypot(...off), 0.05, 1e-5, 'at its radius');
    close(off[0] / 0.05, n[0], 1e-4, 'out along its normal');
  }
  assert.ok(m.positions.slice(0, tubeVertexCount(1) * 3).every((v) => v === 0), 'another rope\'s rings untouched');
  // the leather the strap wears: the wagons' own archive, painted from numbers
  const art = new Map(wagonArt());
  assert.ok(art.has(TEX.harness));
  assert.equal(TEX.harness, 20);
});

// ── THE POOL ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('WAGONS3 THE TEAM, DRIVEN AND PARKED: a driven bench wagon\'s pair stands either side of the hitch facing down the pole, drawn; the Small Cart\'s one is its driver\'s mount, not drawn; parked in harness the runtime\'s horse leads its mate beside it; my parked pair keeps its second horse in harness while I own two and the first is away; one horse owned, it does not (mutants: the pair on the hitch, the cart\'s horse drawn, the mate unstood, the count unread)', async () => {
  let owned = 2;
  const art = { fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }), decode: () => ({ width: 1, height: 1, data: new Uint8Array(4) }) };   // the horse's pictures, stood in
  for (const kind of ['cart', 'openWagon', 'caravan']) {
    const world = await wagonWorld(kind, { horses: () => owned, ...art });
    world.pool.presentation.horseArt.ensureStationary(); await flush();
    assert.equal(drive(world).succeeded, true, `${kind}: driven`);
    world.pool.frame(1 / 30, [0, 2, -5], 0);
    const s = world.pool.shown();
    assert.equal(s.wagon.kind, HCC_WIRE_KIND.Trailing);
    const team = world.pool.teamOf('', s);
    if (kind === 'cart') {
      assert.equal(team.length, 1);
      assert.equal(team[0].drawn, false, 'the Small Cart\'s horse is its driver\'s mount');
      assert.equal(team[0].hitched, true, 'its traces still reach the cart');
      assert.equal(world.renderer.batches.length, 0, 'no billboard for it');
    } else {
      assert.equal(team.length, 2);
      assert.deepEqual(team.map((h) => h.side), [-TEAM.side, TEAM.side]);
      for (const h of team) {
        close(Math.hypot(h.position[0] - s.wagon.hitch[0] - h.side, h.position[2] - s.wagon.hitch[2]), 0, 1e-6, `${kind}: either side of the hitch`);
        assert.deepEqual(h.forward, [0, 0, 1], 'facing down the pole');
        assert.ok(h.drawn && h.hitched);
      }
      assert.equal(world.renderer.batches.length, 2, `${kind}: two billboards`);
    }
    // parked, hitched: the runtime's horse leads, its mate beside it
    world.w.mode = TRANSPORT.Foot; world.step(3);
    world.pool.frame(1 / 30, [0, 2, -5], 0);
    const p = world.pool.shown();
    assert.deepEqual([p.wagon.kind, p.wagon.hitched], [HCC_WIRE_KIND.Deployed, true]);
    const parked = world.pool.teamOf('', p);
    assert.deepEqual(parked.map((h) => [h.side, h.hitched, h.drawn]), kind === 'cart' ? [[0, true, true]] : [[-TEAM.side, true, true], [TEAM.side, true, true]], `${kind}: in harness at its pole`);
    if (kind === 'cart') continue;
    // ridden away: the second stays in harness at the parked wagon while I own two
    assert.equal(world.rt.tryUseTransport(TRANSPORT.Horse).succeeded, true);
    world.step(2);
    for (let i = 0; i < 20; i++) { world.w.pos[0] += 0.5; world.step(); }
    world.pool.frame(1 / 30, [0, 2, -5], 0);
    const q = world.pool.shown();
    assert.equal(q.wagon.hitched, false, 'the first horse ridden off');
    const away = world.pool.teamOf('', q);
    const mate = away.find((h) => h.hitched);
    assert.ok(mate && mate.drawn && mate.side === TEAM.side, `${kind}: its mate in harness`);
    const hitchAt = [q.wagon.position[0], 0, q.wagon.position[2] + WAGON_KINDS[kind].hitch];
    close(Math.hypot(mate.position[0] - hitchAt[0] - TEAM.side, mate.position[2] - hitchAt[2]), 0, 1e-6, 'at its pole\'s end, its side of it');
    owned = 1;
    assert.equal(world.pool.teamOf('', q).filter((h) => h.hitched).length, 0, 'one horse owned: none is left at the wagon');
    owned = 2;
  }
  assert.equal(TEAM_MAX, 3);
});

test('WAGONS3 THE DRIVER\'S SEAT AS DRAWN: driving a bench wagon, my seat stands where the wagon is drawn - its own point of the wagon\'s frame, facing the way it is driven, the hands before the hips at the reins\' height; drawn where the player is drawn (the motor\'s step interpolated); parked, the Small Cart, the classic model: none (mutants: the seat unturned, the shift unread, a seat while parked)', async () => {
  let shift = null;
  const world = await wagonWorld('caravan', { renderShift: () => shift });
  drive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const s = world.pool.shown();
  const seat = world.pool.driverSeat();
  const local = driverSeatFor('caravan').feet;
  const want = [s.wagon.position[0] + local[0], s.wagon.position[1] + local[1], s.wagon.position[2] + local[2]];   // unturned: driven straight along +z
  assert.ok(seat.feet.every((v, k) => Math.abs(v - want[k]) < 1e-6), `on the bench: ${seat.feet} vs ${want}`);
  close(seat.yaw, 0, 1e-9, 'facing the way it is driven');
  assert.equal(seat.g, 1);
  assert.deepEqual(seat.hands.map((h) => +(h[1] - seat.feet[1]).toFixed(6)), [+(DRIVER_HANDS_TOP + 0.04).toFixed(6), +(DRIVER_HANDS_TOP + 0.04).toFixed(6)], 'the hands at the reins\' height');
  assert.ok(seat.hands.every((h) => h[2] > seat.feet[2]), 'before the hips');
  // into a turn: the seat turns with the wagon
  turnDrive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const t = world.pool.shown(), ts = world.pool.driverSeat(), off = qr(t.wagon.rotation, local);
  const tw = [t.wagon.position[0] + off[0], t.wagon.position[1] + off[1], t.wagon.position[2] + off[2]];
  assert.ok(Math.abs(Math.atan2(quatForward(t.wagon.rotation)[0], quatForward(t.wagon.rotation)[2])) > 0.2, 'turned');
  assert.ok(ts.feet.every((v, k) => Math.abs(v - tw[k]) < 1e-6), `on the turned bench: ${ts.feet} vs ${tw}`);
  close(ts.yaw, Math.atan2(quatForward(t.wagon.rotation)[0], quatForward(t.wagon.rotation)[2]), 1e-9, 'facing the way the wagon faces');
  const seat2 = ts;
  shift = [0.3, 0.5, -0.2];
  const moved = world.pool.driverSeat();
  close(moved.feet[0] - seat2.feet[0], 0.3, 1e-9, 'drawn where the player is drawn');
  close(moved.feet[2] - seat2.feet[2], -0.2, 1e-9, 'level - the step\'s rise is not the shift\'s');
  close(moved.feet[1], seat2.feet[1], 1e-9, 'its height its own');
  shift = null;
  world.w.mode = TRANSPORT.Foot; world.step(3); world.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.equal(world.pool.driverSeat(), null, 'parked: nobody drives');
  const cart = await wagonWorld('cart');
  drive(cart); cart.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.equal(cart.pool.driverSeat(), null, 'the Small Cart: its driver rides');
  const classic = createHorseCartPool({ renderer: fakeRenderer(), meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'caravan', bakedWagon: async () => { throw new Error('no bake'); }, log: QUIET });
  classic.partsOf('caravan'); await flush();
  assert.equal(classic.partsOf('caravan'), null, 'no classic mesh here either');
});

test('WAGONS3 THE HARNESS: a driven pair\'s four traces from collar to singletree and two reins from the hands to the bits, the Small Cart\'s two traces, a parked pair\'s four; stepped each frame into one leather tube mesh an owner, drawn casting no shadow, refilled in place and laid again when the harness changes (mutants: the reins from the hips, a trace to the body\'s frame, the mesh made each frame, the shadow cast)', async () => {
  const world = await wagonWorld('openWagon', { horses: () => 2 });
  drive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const ends = world.pool.harnessEnds('');
  assert.deepEqual(ends.map((e) => e.kind), ['trace', 'trace', 'trace', 'trace', 'rein', 'rein']);
  const team = world.pool.teamOf('', world.pool.shown());
  const seat = world.pool.driverSeat();
  ends.slice(0, 4).forEach((e, i) => {
    const h = team[i >> 1], s = i % 2 ? 1 : -1;
    close(e.a[0], h.position[0] + s * TEAM.collar[0], 1e-6, 'from its collar');
    close(e.a[1], h.position[1] + TEAM.collar[1], 1e-6, 'at its chest');
    close(e.b[0], h.side + s * TEAM.tree.half, 1e-6, 'to its own singletree');
    close(e.b[1], world.pool.shown().wagon.position[1] + TEAM.tree.y - LIFT, 1e-6, 'at the tree\'s height');
  });
  assert.deepEqual(ends[4].a, seat.hands[0], 'the left rein in the left hand');
  assert.deepEqual(ends[5].a, seat.hands[1]);
  close(ends[4].b[0], -TEAM.side, 1e-9, 'to the left horse\'s bit');
  close(ends[4].b[1], TEAM.bit[1], 1e-9);
  const h = world.pool.harness.get('');
  assert.equal(h.ropes.length, 6);
  assert.ok(h.gpu, 'its mesh');
  const made = world.renderer.meshes.length;
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.equal(world.renderer.meshes.length, made, 'refilled in place, not made again');
  assert.ok(world.renderer.updates.length >= 1, 'its vertices refilled');
  world.renderer.draws.length = 0;
  world.pool.draw(world.renderer);
  const harnessDraw = world.renderer.draws.find((d) => d.gpu === h.gpu);
  assert.ok(harnessDraw && harnessDraw.o?.noShadow === true, 'drawn, casting no shadow');
  // into a turn: the pole steered off the body, the singletrees on it - each horse's two roots astride its own line down the pole
  turnDrive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const ts = world.pool.shown();
  assert.ok(Math.abs(ts.wagon.turn.steer) > 1, `steered: ${ts.wagon.turn.steer}`);
  const tt = world.pool.teamOf('', ts), te = world.pool.harnessEnds('');
  for (let k = 0; k < 2; k++) {
    const h = tt[k], l = te[k * 2].b, r = te[k * 2 + 1].b;
    const mid = [(l[0] + r[0]) / 2 - h.position[0], (l[2] + r[2]) / 2 - h.position[2]];
    const cross = mid[0] * h.forward[2] - mid[1] * h.forward[0];
    assert.ok(Math.abs(cross) < 1e-6, `horse ${k}: its tree straight behind it down the steered pole (${cross})`);
  }
  // parked in harness: the four traces, no reins
  world.w.mode = TRANSPORT.Foot; world.step(3); world.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.deepEqual(world.pool.harnessEnds('').map((e) => e.kind), ['trace', 'trace', 'trace', 'trace']);
  assert.ok(world.renderer.destroyed.includes(h.gpu), 'the driven harness let go for the parked one');
  // the Small Cart's
  const cart = await wagonWorld('cart');
  drive(cart); cart.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.deepEqual(cart.pool.harnessEnds('').map((e) => e.kind), ['trace', 'trace']);
  // the switch off: nothing of it stands
  world.pool.setEnabled(false); world.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.equal(world.pool.harness.size, 0);
});

test('WAGONS3 THE PARKED BOX NEVER HOLDS ME (Mac: "Spawning the wagon can trap you under the wagon"): a summoned wagon of each kind stands its hitch and DEPLOY_CLEARANCE behind me, its box clear of my capsule; a box over my capsule is not stood until I step out of it; a model that changes under a standing box stands it again (mutants: the mod\'s 2.5 m for every kind, the capsule unread, the parts\' change unread)', async () => {
  assert.equal(DEPLOY_CLEARANCE, 1);
  for (const kind of ['cart', 'openWagon', 'caravan']) {
    const buckets = [];
    const col = { addMesh: (b) => buckets.push(['add', b]), removeBucket: (b) => buckets.push(['remove', b]), raycastAll: () => [] };
    let capsule = { feet: [0, 0, 0], height: 1.8, radius: 0.35 };
    const world = await wagonWorld(kind, { collider: () => col, playerCapsule: () => capsule });
    const { w, rt, step, pool } = world;
    w.items.cart = true; w.items.horse = true;
    w.mode = TRANSPORT.Foot; w.pos = [0, 0.9, 0]; w.yaw = 0;
    step(2);
    rt.handleSummonTransport();
    step(2);
    pool.frame(1 / 30, [0, 2, 0], 0);
    const s = pool.shown();
    assert.equal(s.wagon.kind, HCC_WIRE_KIND.Deployed, `${kind}: summoned`);
    close(-s.wagon.position[2], WAGON_KINDS[kind].hitch + DEPLOY_CLEARANCE, 0.05, `${kind}: its hitch and the clearance behind me`);
    const m = (await import('../src/world/quat.js')).mat4FromQuatPos(s.wagon.rotation, s.wagon.position);
    assert.equal(pool.capsuleInBox(m, pool.partsOf(kind)), false, `${kind}: its box clear of my capsule`);
    assert.ok(buckets.some(([op, b]) => op === 'add' && b === WAGON_BUCKET), `${kind}: its box stood`);
    // standing in it: taken down, and stood again once I am out
    capsule = { feet: [s.wagon.position[0], 0, s.wagon.position[2] + 1], height: 1.8, radius: 0.35 };
    assert.equal(pool.capsuleInBox(m, pool.partsOf(kind)), true);
    buckets.length = 0; pool.frame(1 / 30, [0, 2, 0], 0);
    assert.deepEqual(buckets, [['remove', WAGON_BUCKET]], `${kind}: not stood round me`);
    buckets.length = 0; pool.frame(1 / 30, [0, 2, 0], 0);
    assert.deepEqual(buckets, [], 'nor tried again while I am in it');
    capsule = { feet: [s.wagon.position[0] + 3, 0, s.wagon.position[2]], height: 1.8, radius: 0.35 };
    assert.equal(pool.capsuleInBox(m, pool.partsOf(kind)), false);
    buckets.length = 0; pool.frame(1 / 30, [0, 2, 0], 0);
    assert.ok(buckets.some(([op]) => op === 'add'), `${kind}: stood once I stepped out`);
    // touching it within the skin is in it
    const b = pool.partsOf(kind).bounds;
    capsule = { feet: [s.wagon.position[0] + b.max[0] + 0.35 + CAPSULE_BOX_SKIN / 2, 0, s.wagon.position[2]], height: 1.8, radius: 0.35 };
    assert.equal(pool.capsuleInBox(m, pool.partsOf(kind)), true, 'a body touching it');
  }
  // the classic wagon keeps the mod's own 2.5 m
  const src = rd('src/systems/horseCart.js');
  assert.match(src, /function deploySetback\(\) \{ const z = hitchZ\(\); return z > HITCHED_HORSE_LOCAL_Z \? z \+ DEPLOY_CLEARANCE : WAGON_FOLLOW_DISTANCE; \}/);
  assert.match(src, /const \[wx, wz\] = toWorld\(vsub\(playerPosition\(\), vscale\(fwd, deploySetback\(\)\)\)\);   \/\/ WAGONS3: clear of the player/);
  assert.match(src, /const \[wx, wz\] = toWorld\(vsub\(playerPosition\(\), vscale\(heading, deploySetback\(\)\)\)\);/);
  assert.match(src, /const wg = tryFindGround\(phys, vsub\(grounded, vscale\(fwd, hitchSetback\(\)\)\)\);/);
  const pool = rd('src/scenes/horseCartPool.js');
  assert.match(pool, /standWagonCollider\(parked && !capsuleInBox\(parked, myParts\) \? parked : null, myParts\);/);
  assert.match(pool, /if \(parts !== _bucketParts\) \{ _bucketKey = standBox\(WAGON_BUCKET, null, _bucketKey, parts\); _bucketParts = parts; \}/);
});

test('WAGONS3 TWO HORSES TO PULL A PAIR\'S WAGON: short of its pair the wagon is refused by the transport window, the hotkey and the plaque alike, with the team\'s own word; a team that falls short while it pulls stops where it is - the wagon parked in harness, its driver afoot beside it (mutants: the window\'s gate dropped, the press\'s, the hitch\'s, the reconcile)', async () => {
  const world = await wagonWorld('caravan');
  const { w, rt, step } = world;
  w.short = WAGON_TEAM_TEXT.short('caravan');
  step(2);
  const can = rt.canUseTransport(TRANSPORT.Cart);
  assert.deepEqual([can.allowed, can.denialMessage], [false, w.short], 'the window\'s row dark, said why');
  const r = rt.tryUseTransport(TRANSPORT.Cart);
  assert.equal(r.succeeded, false);
  assert.equal(w.said.at(-1), w.short, 'the press says it');
  assert.equal(w.mode, TRANSPORT.Foot);
  // the game set the cart some other way (a save, a script): turned back with the word
  w.mode = TRANSPORT.Cart; step(1);
  assert.equal(w.mode, TRANSPORT.Foot);
  assert.equal(w.said.at(-1), w.short);
  assert.equal(world.state().Mode, WAGON_MODE.WithPlayer, 'turned back - the wagon not laid behind me as a team that was pulling is');
  // a pair: driven
  w.short = null;
  assert.equal(drive(world).succeeded, true);
  assert.equal(w.mode, TRANSPORT.Cart);
  // a horse sold from under the team: it stops where it is
  w.short = WAGON_TEAM_TEXT.short('caravan');
  step(1);
  assert.equal(w.mode, TRANSPORT.Foot, 'afoot');
  assert.deepEqual([world.state().Mode, world.state().HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon], 'the wagon parked, the horse left in harness');
  assert.equal(w.said.at(-1), w.short);
  // and the parked wagon will not be driven off short
  const said = w.said.length;
  w.pos = [world.rt.view().horse.position[0] + 1.2, 0.9, world.rt.view().horse.position[2]]; step(1);
  assert.equal(rt.tryUseTransport(TRANSPORT.Cart).succeeded, false);
  assert.ok(w.said.length > said && w.said.at(-1) === w.short);
  const src = rd('src/systems/horseCart.js');
  assert.match(src, /function hitchDeployedWagon\(\) \{\n\s+if \(refuseShortTeam\(\)\) return;/, 'the plaque\'s and the horse\'s hitch refuse it too');
  assert.match(src, /function startFollowingHitchedTeam\(\) \{\n\s+if \(refuseShortTeam\(\)\) return;/);
  assert.match(src, /entryMode === TRANSPORT\.Cart && tm\(\)\.hasCart\(\) && tm\(\)\.hasHorse\(\) && !teamShort\(\)/, 'a failed door\'s rollback never hitches a short team');
  // the hosts hand the runtime the word and the pool the count
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /teamShort: \(\) => wagonTeamShort\(playerEntity\.items \?\? \[\]\),/, host);
    assert.match(s, /horses: \(\) => horseCountOf\(playerEntity\.items \?\? \[\]\),/, host);
  }
});

test('WAGONS3 THE CAMERA\'S WALL ON THE BENCH: a ray from my seat back into my driven wagon\'s body stops at it, less the camera\'s radius; one ahead, one starting inside it, a parked wagon and the Small Cart have none (mutants: the wall\'s frame unturned, inside taken for a hit, the radius unread)', async () => {
  const world = await wagonWorld('caravan');
  drive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const s = world.pool.shown(), parts = world.pool.partsOf('caravan');
  const seat = world.pool.driverSeat();
  const eye = [seat.feet[0], seat.feet[1] + 1.4, seat.feet[2]];
  const front = s.wagon.position[2] + parts.cabin.max[2];
  close(world.pool.cameraHit(eye, [0, 0, -1], 10), eye[2] - front, 1e-6, 'back into the body: its front');
  close(world.pool.cameraHit(eye, [0, 0, -1], 10, 0.2), eye[2] - front - 0.2, 1e-6, 'less the radius');
  assert.equal(world.pool.cameraHit(eye, [0, 0, 1], 10), Infinity, 'ahead: the team, no wall');
  assert.equal(world.pool.cameraHit(eye, [0, 0, -1], 0.1), Infinity, 'out of reach');
  assert.equal(world.pool.cameraHit([s.wagon.position[0], s.wagon.position[1] + 1, s.wagon.position[2] + 1], [0, 0, -1], 10), Infinity, 'from inside it: none');
  // the wagon turned: the wall turns with it
  turnDrive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const t = world.pool.shown(), ts = world.pool.driverSeat(), back = qr(t.wagon.rotation, [0, 0, -1]);
  const teye = [ts.feet[0], ts.feet[1] + 1.4, ts.feet[2]];
  const lz = qr([-t.wagon.rotation[0], -t.wagon.rotation[1], -t.wagon.rotation[2], t.wagon.rotation[3]], [teye[0] - t.wagon.position[0], teye[1] - t.wagon.position[1], teye[2] - t.wagon.position[2]])[2];
  close(world.pool.cameraHit(teye, back, 10), lz - parts.cabin.max[2], 1e-6, 'straight back along the turned wagon: its front');
  world.w.mode = TRANSPORT.Foot; world.step(3); world.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.equal(world.pool.cameraHit(eye, [0, 0, -1], 10), Infinity, 'parked: a collider of its own');
  const cart = await wagonWorld('cart');
  drive(cart); cart.pool.frame(1 / 30, [0, 2, -5], 0);
  assert.equal(cart.pool.cameraHit([0, 2, 3], [0, 0, -1], 10), Infinity, 'the Small Cart: no bench');
  void quatAngleAxis; void UNITY_QUAT_IDENTITY;
});

test('WAGONS3 ANOTHER PLAYER ON THEIR BENCH: a peer driving a bench wagon (their pose\'s `rd` 2 at the puller) is drawn on its seat as drawn here - seated (`st` the reins\' height), no mount under them (`rd` 0), still heard driving the cart (`bench` 2), their pace read still; the list\'s own entry and the anchor their wagon hangs from untouched; a Small Cart\'s driver stays in the saddle (mutants: the seat unread, `rd` kept, the entry written)', async () => {
  let anchor = [0, 0.9, 10];
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'cart', bakedWagon: async (k) => bakeOf(k), log: QUIET, peerAnchor: () => anchor });
  pool.partsOf('openWagon'); pool.partsOf('cart'); await flush();
  pool.applyOwner('ann', { w: [HCC_WIRE_KIND.Trailing, 0, 1, 10 - 7.1, 0, 0, 0, 1, 0, 0], wk: 1 }, (q) => q, 0);
  pool.applyOwner('bob', { w: [HCC_WIRE_KIND.Trailing, 30, 1, 10 - 3.8, 0, 0, 0, 1, 0, 0] }, (q) => q, 0);
  for (let i = 0; i < 3; i++) pool.frame(1 / 30, [0, 2, -5]);
  const seat = pool.driverDrawn('ann');
  assert.ok(seat, 'their bench as drawn here');
  const theirs = { id: 'ann', shown: { x: anchor[0], y: anchor[1], z: anchor[2], yaw: 1, rd: 2, mv: 1 } };
  const list = [theirs, { id: 'bob', shown: { x: 30, y: 0.9, z: 10, rd: 2 } }, { id: 'cy', shown: { x: 5, y: 0, z: 5 } }];
  pool.driverGlue(list, { toWire: (q) => q.map((v) => v + 1000) });
  const d = list[0].shown;
  assert.deepEqual([d.x, d.y, d.z], seat.feet.map((v) => v + 1000), 'on their seat');
  assert.deepEqual([d.yaw, d.rd, d.bench, d.st, d.mv], [seat.yaw, 0, 2, seatTopByte(DRIVER_HANDS_TOP), 1]);
  assert.deepEqual([d.deck, d.deckKey], [[0, 0, -1], 'wagon:ann:driver'], 'their pace read still');
  assert.equal(theirs.shown.rd, 2, 'the online list\'s own entry untouched');
  assert.equal(list[1].shown.rd, 2, 'a Small Cart\'s driver in the saddle');
  assert.deepEqual(list[2].shown, { x: 5, y: 0, z: 5 });
  // their team: a pair at the anchor, their harness with its reins in the hands drawn
  const team = pool.teamOf('ann');
  assert.deepEqual(team.map((h) => [h.side, h.drawn]), [[-TEAM.side, true], [TEAM.side, true]]);
  assert.deepEqual(pool.harnessEnds('ann').map((e) => e.kind), ['trace', 'trace', 'trace', 'trace', 'rein', 'rein']);
  const w = rd('src/scenes/world.js');
  assert.match(w, /for \(const d of drawable\) if \(d\?\.shown\) _peerMapPoses\.set\(d\.id, d\.shown\);\n\s*if \(hccOn\(\)\) hcc\.driverGlue\(drawable, \{ toWire: campToWire \}\);/, 'glued after the map\'s poses - where peerAnchor reads the puller');
  assert.match(rd('src/net/remotePlayers.js'), /const rd = \(peer\.shown\?\.rd \| 0\) \|\| \(peer\.shown\?\.bench === 2 \? 2 : 0\);/, 'the cart still heard');
  anchor = null;
});

test('WAGONS3 THE OVERWORLD\'S RIG, DRAWN: my driven bench wagon, its pair, its seat and its harness grown by the rig\'s law about the hitch - the pair a rig\'s grow apart, their billboards that big, the seat on the grown bench (mutants: the team ungrown, the seat at the traveller\'s grow)', async () => {
  const world = await wagonWorld('openWagon');
  drive(world);
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  world.pool.draw(world.renderer, null, { selfGrow: 10, grow: () => 10 });
  world.pool.frame(1 / 30, [0, 2, -5], 0);
  const g = rigGrowOf(10, 'openWagon', WAGON_KINDS.openWagon.hitch);
  const team = world.pool.teamOf('', world.pool.shown());
  assert.ok(team.every((h) => Math.abs(h.g - g) < 1e-9), 'the team at the rig\'s grow');
  close(Math.abs(team[1].position[0] - team[0].position[0]), 2 * TEAM.side * g, 1e-6, 'a grown pair\'s width apart');
  const seat = world.pool.driverDrawn('', { selfGrow: 10, grow: () => 10 });
  close(seat.g, g, 1e-9, 'the seat on the grown bench');
  const s = world.pool.shown();
  const local = driverSeatFor('openWagon').feet;
  close(seat.feet[2], s.wagon.hitch[2] + (s.wagon.position[2] + local[2] - s.wagon.hitch[2]) * g, 1e-6, 'grown about the hitch');
  assert.ok(world.pool.harnessEnds('').every((e) => Math.abs(e.g - g) < 1e-9), 'the harness at it too');
});

// ── THE HOSTS ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('WAGONS3 THE HOSTS SIT ME ON THE BENCH: the wagon\'s LateUpdate before the camera; the eye on the seat, the camera\'s feet the seat\'s, the bench no saddle (`riding` false, `seated`, still), the wagon\'s body a wall to the camera; the body drawn on it (the motor\'s draw overrides), still, seated by the rig; a door takes me off it (mutants: the eye left at the puller, the bench taken for a saddle, the wall dropped, the body at the capsule)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.ok(s.indexOf('hccTick(dt, now);\n    _driverSeat') > 0 || s.indexOf('    hccTick(dt, now);\n    // WAGONS3') > 0, `${host}: the LateUpdate before the bench`);
    assert.match(s, /_driverSeat = walkMode [^\n]*player\.transportMode === TRANSPORT_MODES\.Cart && !\(townTalk\.overlay instanceof DeathScreen\) \? hcc\.driverSeat\(\) : null;/, `${host}: driving, never over a death's sink`);
    assert.match(s, /if \(_driverSeat\) cam\.pos = \[_driverSeat\.feet\[0\], _driverSeat\.feet\[1\] \+ SEATED_EYE_HEIGHT, _driverSeat\.feet\[2\]\];/, `${host}: the seated eye`);

    assert.match(s, /riding: !!player\.riding && !_driverSeat,/, `${host}: the bench is no saddle`);
    assert.match(s, /\.\.\.\(_driverSeat \? \{ seated: true, stopped: true, feet: _driverSeat\.feet \} : \{\}\),/, `${host}: seated, still, the camera's feet the seat's`);
    assert.ok(s.indexOf('feet: player.feetAt(), yaw: cam.yaw, pitch: cam.pitch,') < s.indexOf('...(_driverSeat ? { seated: true, stopped: true, feet: _driverSeat.feet } : {}),'), `${host}: the seat's feet after the smoothed ones - the later key wins`);
    assert.match(s, /raycast: \(o, d, m\) => Math\.min\(collider\.raycast\(o, d, m(?:, camFilter)?\), hcc\.cameraHit\(o, d, m\)\),/, `${host}: the wall`);
    assert.match(s, /hcc\.cameraHit\(o, d, m, r\)\); return Number\.isFinite\(h\) \? h : null; \}/, `${host}: the sphere's wall`);
    assert.match(s, /seat: _driver(?:Body)?Seat \? \{ feet: _driver(?:Body)?Seat\.feet, yaw: _driver(?:Body)?Seat\.yaw, top: _driver(?:Body)?Seat\.top \} : null,/, `${host}: seated by the rig`);
    assert.match(s, /hcc\.faceTeams\((?:mwv\.eye|eye)\);/, `${host}: the team turned to the eye that draws it`);
    assert.match(s, /if \(_driverSeat && player\.transportMode === TRANSPORT_MODES\.Cart(?: && !\(townTalk\.overlay instanceof DeathScreen\))?\) cam\.pos = \[_driverSeat\.feet\[0\], _driverSeat\.feet\[1\] \+ SEATED_EYE_HEIGHT, _driverSeat\.feet\[2\]\];   \/\/ WAGONS3: on my bench \(last frame's seat/, `${host}: the frame's picks aim from the bench`);
    assert.ok(s.indexOf("(last frame's seat until the wagon steps)") < s.indexOf('const _hccPick = pickActivatableHit(cam.pos, useFwd, hcc.targets(), collider);'), `${host}: before the picks`);
  }
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(_driverBodySeat\) \{ player\.drawFeet = _driverBodySeat\.feet; player\.drawYaw = _driverBodySeat\.yaw; player\.drawGrow = _driverBodySeat\.g > 1 \? _driverBodySeat\.g : null; \}/);
  assert.match(w, /const tvFace = tvf \? \{ yaw: tvf\.yaw, up: tvf\.up, grow: player\.drawGrow \?\? tvf\.grow \} : null;/, 'under the Overworld at the rig\'s grow');
  assert.match(w, /if \(_mode\(\) !== 'exterior'\) \{ _driverSeat = null; _driverBodySeat = null; \}/, 'a door: off the bench');
  assert.match(w, /drawAt: \(feet, g = 1\) => \{ player\.drawFeet = feet; player\.drawGrow = feet && g > 1 \? g : null; if \(!feet\) player\.drawYaw = null; \},/, 'a seat in another\'s rig at its grow too');
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /player\.drawFeet = _driverSeat \? _driverSeat\.feet : null; player\.drawYaw = _driverSeat \? _driverSeat\.yaw : null;/);
  assert.match(e, /if \(modeNow\(\) !== 'exterior'\) \{ _driverSeat = null; player\.drawFeet = null; player\.drawYaw = null; \}/);
  assert.match(rd('src/player/motor.js'), /bodyYawFor\(viewYaw\) \{ return this\.drawYaw \?\? this\._bodyYaw \?\? /);
  assert.match(rd('src/combat/fpArm.js'), /const cam = seatedCamera\(camera && camera\(\)\);/, 'the rig reads a seated body still');
  const bag = { forward: 1, speed: 5 };
  assert.deepEqual(seatedCamera({ seat: { feet: [0, 0, 0] }, move: bag, yaw: 1 }), { seat: { feet: [0, 0, 0] }, move: seatedMotion(bag), yaw: 1 });
  const free = { seat: null, move: bag };
  assert.equal(seatedCamera(free), free, 'afoot: the bag as handed');
  assert.equal(seatedCamera(null), null);
  assert.deepEqual(seatedMotion({ forward: 1, strafe: -1, running: true, speed: 9, standing: false, riding: true, jumping: true, grounded: true, height: 1.8 }), { forward: 0, strafe: 0, running: false, speed: 0, standing: true, riding: false, jumping: false, grounded: true, height: 1.8 });
});

test('WAGONS3 THIRD PERSON FROM THE BENCH (Mac: "Using a wagon doesnt allow you to zoom out into 3rd person when mounted"): the frame\'s `seated` hides the first-person horse - the team is in the world - on either lane, and leaves RIDE-POV\'s saddle rule to the saddle: the hosts hand the bench `riding` false (mutants: the hide unread, the word kept from a frame before)', async () => {
  const mv = await import('../src/player/mwView.js');
  mv.mwViewFrame({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0, riding: false, seated: true, stopped: true });
  assert.equal(mv.mwViewHides().horse, true, 'on the bench: no first-person horse');
  mv.mwViewFrame({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0, riding: true });
  assert.equal(mv.mwViewHides().horse, false, 'in the saddle: the horse on the screen again');
  mv.mwViewFrame({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0 });
  const src = rd('src/player/mwView.js');
  assert.match(src, /benchSeated = !!state\.seated;/);
  assert.match(src, /mounted = !!state\.riding;\n\s*if \(mounted\)/, 'RIDE-POV unchanged: the saddle holds the head');
  assert.match(rd('src/player/mountRig.js'), /!mwViewHides\(\)\.horse\) \{/, 'the mount\'s picture asks the hides');
  void buildBakedWagonParts;
});
