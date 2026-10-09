// WAGONS1 (2026-10-09, Mac's three wagons): the kinds' law (systems/wagonKinds.js), their pictures (world/wagonArt.js),
// their parts (world/wagonModels.js), the cart's pool drawing them by kind (scenes/horseCartPool.js), the online word
// saying which (systems/horseCartWire.js, net/wire.js's park record) and the capacity each carries (itemTransfer.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  WAGON_KINDS, WAGON_KIND_ORDER, SMALL_CART_KG, activeWagonItem, activeWagonKind, wagonKgFor, wagonKgLimitOf, wagonHitchOf,
  newWagonItem, wagonKindOf, isWagonItem, wagonKindCode, wagonKindOfCode, stableWagonName,
} from '../src/systems/wagonKinds.js';
import { wagonArt, TEX, WAGON_ARCHIVE, BANDS, SIDE_Y0, SIDE_Y1 } from '../src/world/wagonArt.js';
import {
  wagonGeometry, buildBakedWagonParts, wagonFaceSkin, MEASURED, LIFT, CART_REST_PITCH_DEG, cargoFor, seatsFor, doorFor, pitchedPoint,
  wagonIconModel, wagonPoolDeps, WAGON_MODEL_URLS,
} from '../src/world/wagonModels.js';
import { createHorseCartPool, CARAVAN_ENTER_ROW, KEY_WAGON, peerKey } from '../src/scenes/horseCartPool.js';
import { hccWireRecord, validHccRecord, hccRecordKey, HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { validParkData } from '../src/net/wire.js';
import { HITCHED_HORSE_LOCAL_Z, NORMAL_GROUND_OFFSET } from '../src/systems/horseCartLaw.js';
import { WAGON_KG_LIMIT, planStore } from '../src/systems/itemTransfer.js';
import { TRANSPORT_SMALL_CART, inventoryItemModel } from '../src/systems/itemTemplates.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { resolveItemName } from '../src/systems/itemInfo.js';

const bakeOf = (kind) => JSON.parse(readFileSync(new URL(`../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
const geo = Object.fromEntries(WAGON_KIND_ORDER.map((k) => [k, wagonGeometry(bakeOf(k))]));
const id = (g) => g;
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };

test('WAGONS1 THE KINDS: three, their names, capacities, values, hitches and seats as the law says (the Small Cart DFU\'s 750 kg at its template\'s 150) - a pack drives its best wagon, and a cart item unmarked is the Small Cart (mutants: a rank flipped, a capacity moved, the mark unread)', () => {
  assert.deepEqual(WAGON_KIND_ORDER, ['cart', 'openWagon', 'caravan']);
  assert.deepEqual(WAGON_KIND_ORDER.map((k) => [WAGON_KINDS[k].name, WAGON_KINDS[k].kg, WAGON_KINDS[k].value, WAGON_KINDS[k].hitch, WAGON_KINDS[k].seats, WAGON_KINDS[k].enterable, WAGON_KINDS[k].rank]),
    [['Small Cart', 750, 150, 3.8, 0, false, 0], ['Open Wagon', 1500, 900, 7.1, 4, false, 1], ['Caravan', 2000, 2500, 7.7, 0, true, 2]]);
  assert.equal(SMALL_CART_KG, 750); assert.equal(WAGON_KG_LIMIT, SMALL_CART_KG, 'itemTransfer.js reads the one 750');
  const cart = newWagonItem('cart'), open = newWagonItem('openWagon'), caravan = newWagonItem('caravan');
  assert.deepEqual(cart, { group: 'Transportation', templateIndex: TRANSPORT_SMALL_CART });
  assert.deepEqual([open.wagonKind, open.value, caravan.wagonKind, caravan.value], ['openWagon', 900, 'caravan', 2500]);
  assert.deepEqual([cart, open, caravan].map(resolveItemName), ['Small Cart', 'Open Wagon', 'Caravan'], 'each says its kind; the rows keep the template\'s ItemName');
  assert.ok([cart, open, caravan].every(isWagonItem));
  assert.deepEqual([cart, open, caravan, { templateIndex: TRANSPORT_SMALL_CART, wagonKind: 'barge' }].map(wagonKindOf), ['cart', 'openWagon', 'caravan', 'cart']);
  // the best owned is driven, whatever order the pack holds them in
  assert.equal(activeWagonItem([caravan, cart, open]), caravan);
  assert.equal(activeWagonItem([cart, open]), open);
  assert.equal(activeWagonKind([{ templateIndex: 94 }]), null);
  assert.deepEqual([[], [cart], [cart, open], [open, caravan]].map((items) => wagonKgFor({ items })), [750, 750, 1500, 2000]);
  assert.deepEqual(WAGON_KIND_ORDER.map(wagonKgLimitOf), [750, 1500, 2000]);
  assert.equal(wagonKgLimitOf('nonsense'), 750);
  assert.deepEqual(WAGON_KIND_ORDER.map(wagonHitchOf), [3.8, 7.1, 7.7]);
  assert.deepEqual(WAGON_KIND_ORDER.map(wagonKindCode), [0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3, -1, 1.5, 'x'].map(wagonKindOfCode), ['cart', 'openWagon', 'caravan', 'cart', 'cart', 'cart', 'cart']);
  assert.deepEqual(WAGON_KIND_ORDER.map(stableWagonName), ['Your wagon', 'Your open wagon', 'Your caravan']);
  // the item's picture is its own kind's wagon
  assert.deepEqual([cart, open, caravan].map(inventoryItemModel), [112490, 112491, 112492]);
});

test('WAGONS1 THE CAPACITY: the wagon store takes what the DRIVEN wagon holds - 750 kg in the Small Cart, 1500 in the Open Wagon (mutant: the 750 still read)', () => {
  const brick = { group: 'MiscItems', templateIndex: 1, weightInKg: 100, stackCount: 10 };
  const full = [{ group: 'MiscItems', templateIndex: 1, weightInKg: 700, stackCount: 1 }];
  assert.equal(planStore(brick, { remote: full, usingWagon: true }).ok, false, 'the cart: 50 kg free, a 100 kg brick does not fit');
  const p = planStore(brick, { remote: full, usingWagon: true, wagonKg: wagonKgLimitOf('openWagon') });
  assert.equal(p.ok, true); assert.equal(p.amount, 8, 'the open wagon: 800 kg free, eight of them');
});

test('WAGONS1 THE PICTURES: fifteen, each 64 x 64, painted from numbers to the same bytes every time under the wagons\' own archive (mutant: a seed from the clock)', () => {
  const hash = () => createHash('sha256').update(Buffer.concat(wagonArt().map(([, p]) => Buffer.from(p.data)))).digest('hex');
  assert.equal(hash(), hash());
  const art = wagonArt();
  assert.deepEqual(art.map(([r]) => r), Object.values(TEX).sort((a, b) => a - b));
  for (const [, p] of art) { assert.equal(p.width, 64); assert.equal(p.height, 64); assert.equal(p.data.length, 64 * 64 * 4); }
  assert.equal(WAGON_ARCHIVE, 38181);
  assert.deepEqual([SIDE_Y0, SIDE_Y1], [0.94, 3.06]);
  assert.deepEqual(BANDS.caravanSide.recs, [TEX.caravanSide]);
});

test('WAGONS1 THE PARTS: each wagon\'s statics and wheels on the wagons\' archive, every wheel re-based on its turning centre, the rear pair the parked solve\'s, the whole lifted the mod\'s metre (the wheels meet the ground at y -1) (mutants: the lift dropped, a wheel not re-based, a front wheel taken for a rear)', () => {
  assert.equal(LIFT, NORMAL_GROUND_OFFSET);
  for (const kind of WAGON_KIND_ORDER) {
    const g = geo[kind], parts = buildBakedWagonParts(g, id);
    assert.equal(g.wheels.length, kind === 'cart' ? 2 : 4, kind);
    for (const s of [g.statics, ...g.wheels.map((w) => w.geometry)]) assert.ok(s.slots.every((x) => x.archive === WAGON_ARCHIVE), `${kind}: one archive`);
    let low = Infinity;
    for (const w of g.wheels) {
      // re-based: its corners about its pivot, a radius off it
      for (let i = 1; i < w.geometry.positions.length; i += 3) low = Math.min(low, w.geometry.positions[i] + w.pivot[1]);
      const ys = []; for (let i = 1; i < w.geometry.positions.length; i += 3) ys.push(w.geometry.positions[i]);
      assert.ok(Math.abs(Math.min(...ys) + w.radius) < 1e-4, `${kind} ${w.role}: about its own centre`);
    }
    assert.ok(Math.abs(low + LIFT) < 1e-4, `${kind}: its wheels on the ground a metre under its origin (${low})`);
    assert.deepEqual(parts.wheelLeftPivot, g.wheels.find((w) => w.role === 'wheelRearLeft').pivot);
    assert.deepEqual(parts.wheelRightPivot, g.wheels.find((w) => w.role === 'wheelRearRight').pivot);
    assert.ok(parts.wheelLeftPivot[0] < 0 && parts.wheelRightPivot[0] > 0, `${kind}: left on the left`);
    assert.equal(parts.wheelLeftPivot[2], 0, `${kind}: the rear pair at z 0`);
    assert.ok(Math.abs(parts.wheelRadius - (kind === 'cart' ? 0.5445 : 0.7811)) < 1e-3, `${kind}: radius ${parts.wheelRadius}`);
    assert.ok(parts.bounds.size.every((v) => v > 0.5));
  }
});

test('WAGONS1 THE MEASURES: the floors, sides and fronts the seats, the cargo and the caravan\'s ends are laid by are the bake\'s (mutant: a measure moved off the model)', () => {
  const pts = (kind, role) => { const p = bakeOf(kind).parts.find((x) => x.role === role).positions; const out = []; for (let i = 0; i < p.length; i += 3) out.push(p.slice(i, i + 3)); return out; };
  const span = (ps, k) => [Math.min(...ps.map((q) => q[k])), Math.max(...ps.map((q) => q[k]))];
  const ow = pts('openWagon', 'body'), cv = pts('caravan', 'body');
  assert.ok(Math.abs(span(ow, 0)[1] - MEASURED.openWagon.sideX) < 1e-3 && Math.abs(span(cv, 0)[1] - MEASURED.caravan.sideX) < 1e-3, 'the sides');
  assert.ok(Math.abs(span(cv, 1)[0] - MEASURED.caravan.floorY) < 1e-3 && Math.abs(span(cv, 1)[1] - MEASURED.caravan.endTopY) < 1e-3, 'the caravan, foot to roof');
  assert.ok(ow.some((q) => Math.abs(q[1] - MEASURED.openWagon.floorY) < 1e-3), 'the open wagon\'s bed');
  assert.ok(Math.abs(span(cv, 2)[0] - MEASURED.caravan.rearZ) < 1e-3, 'the caravan\'s rear end');
  assert.ok(Math.abs(Math.max(...pts('caravan', 'step').map((q) => q[2])) - MEASURED.caravan.frontZ) < 1e-2, 'the caravan\'s front');
  assert.ok(Math.abs(Math.max(...pts('cart', 'shaftLeft').map((q) => q[2])) - MEASURED.cart.frontZ) < 1e-2, 'the cart\'s shaft tips');
  assert.ok(Math.abs(SIDE_Y0 - MEASURED.caravan.floorY) < 0.005 && Math.abs(SIDE_Y0 - span(ow, 1)[0]) < 0.005, 'the liveries from the foot of the sides');
  // the cart rests tipped 10.1 degrees forward on its axle (its bottom), borne level hitched
  assert.ok(Math.abs(CART_REST_PITCH_DEG - 10.111) < 0.01, `${CART_REST_PITCH_DEG}`);
  const cart = buildBakedWagonParts(geo.cart, id);
  assert.equal(cart.hitchPitch, CART_REST_PITCH_DEG);
  const front = [0, MEASURED.cart.bottomFront[0] - LIFT, MEASURED.cart.bottomFront[1]], back = [0, MEASURED.cart.bottomBack[0] - LIFT, MEASURED.cart.bottomBack[1]];
  const f = pitchedPoint(cart, front, cart.hitchPitch), b = pitchedPoint(cart, back, cart.hitchPitch);
  assert.ok(Math.abs(f[1] - b[1]) < 1e-6, 'hitched, its bottom is level');
  assert.ok(pitchedPoint(cart, [0, 0, 3.14], 0)[1] === 0, 'unhitched, as drawn');
});

test('WAGONS1 THE FACES: the caravan\'s rear end wears its door and its front end its window, its sides the livery on their height; the open wagon\'s sides its box-and-tilt; a wheel\'s face its spokes, its tread its tyre (mutants: front and rear swapped, a side tiled)', () => {
  assert.equal(wagonFaceSkin('caravan', 'body', [0, 0, -1], [0, 2, -0.71]).rec, TEX.caravanRear);
  assert.equal(wagonFaceSkin('caravan', 'body', [0, 0, 1], [0, 2, 5.11]).rec, TEX.caravanFront);
  assert.equal(wagonFaceSkin('caravan', 'body', [1, 0, 0], [1.36, 2, 2]).band, BANDS.caravanSide);
  assert.equal(wagonFaceSkin('caravan', 'body', [0.13, 0.99, 0], [0.5, 3.45, 2]).rec, TEX.caravanRoof);
  assert.equal(wagonFaceSkin('openWagon', 'body', [1, 0, 0], [1.36, 2, 2]).band, BANDS.openSide);
  assert.equal(wagonFaceSkin('openWagon', 'body', [0, 1, 0], [0, 1.01, 2]).rec, TEX.floor);
  assert.equal(wagonFaceSkin('cart', 'body', [-1, 0, 0], [1.05, 1, 1]).rec, TEX.inner, 'a wall looking into the bed');
  assert.equal(wagonFaceSkin('cart', 'body', [1, 0, 0], [1.16, 1, 1]).rec, TEX.side);
  assert.equal(wagonFaceSkin('cart', 'wheelRearLeft', [-1, 0, 0], [0, 0.5, 0], [0, 0.5, 0], 0.5).rec, TEX.wheel);
  assert.equal(wagonFaceSkin('cart', 'wheelRearLeft', [0, -1, 0], [0, 0, 0]).rec, TEX.tyre);
  assert.equal(wagonFaceSkin('cart', 'shaftLeft', [0, 1, 0], [0, 0, 3]).rec, TEX.beam);
  // the door reads the right way round from outside: its left edge (x +1.36 seen from behind) at u 0
  const uv = wagonFaceSkin('caravan', 'body', [0, 0, -1], [0, 2, -0.71]).uv;
  assert.deepEqual(uv([MEASURED.caravan.sideX, MEASURED.caravan.floorY, -0.71]).map((v) => +v.toFixed(6)), [1, 0]);
  assert.deepEqual(uv([-MEASURED.caravan.sideX, MEASURED.caravan.endTopY, -0.71]).map((v) => +v.toFixed(6)), [0, 1]);
});

test('WAGONS1 WHAT RIDES IN THEM: the cargo the fullness shows - the classic twelve, in each bed (none in the caravan: its load is inside) - four seats in the open wagon\'s back facing across it, the caravan\'s door behind its rear end (mutants: the cargo out of the bed, a seat facing along)', () => {
  assert.deepEqual(cargoFor('caravan'), []);
  for (const kind of ['cart', 'openWagon']) {
    const c = cargoFor(kind), m = MEASURED[kind];
    assert.deepEqual(c.map((d) => [d.threshold, d.modelId]), CARGO_DEFINITIONS.map((d) => [d.threshold, d.modelId]));
    for (const d of c) assert.ok(Math.abs(d.position[0]) < m.sideX, `${kind}: across the bed`);
  }
  const open = cargoFor('openWagon');
  assert.ok(open.every((d) => d.position[2] > 1.4 && d.position[2] < 5.2), 'the open wagon\'s load in the front of its bed (its back is the passengers\')');
  assert.deepEqual(seatsFor('cart'), []); assert.deepEqual(seatsFor('caravan'), []);
  const seats = seatsFor('openWagon');
  assert.equal(seats.length, 4);
  for (const s of seats) { assert.equal(s.feet[1], MEASURED.openWagon.floorY - LIFT); assert.equal(Math.abs(s.yaw), 90); assert.equal(Math.sign(s.yaw), -Math.sign(s.feet[0]), 'facing in, across the bed'); assert.ok(s.feet[2] < 2, 'in the back'); }
  assert.equal(doorFor('cart'), null);
  const d = doorFor('caravan');
  assert.ok(d.step[2] < MEASURED.caravan.rearZ && d.step[1] === -LIFT, 'on the ground behind the rear end');
});

test('WAGONS1 THE ICON: the whole wagon as one model, its wheels in place, every sub-mesh the wagons\' art (the item picture\'s door)', () => {
  const m = wagonIconModel(geo.caravan);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === WAGON_ARCHIVE));
  assert.equal(m.indices.length / 3, m.subMeshes.reduce((a, s) => a + s.primitiveCount, 0));
  let low = Infinity; for (let i = 1; i < m.positions.length; i += 3) low = Math.min(low, m.positions[i]);
  assert.ok(Math.abs(low + LIFT) < 1e-4, 'its wheels where they turn');
});

function fakeRenderer() {
  const r = { textures: new Map(), draws: [], meshes: 0 };
  r.uploadTexture = (a, rec, px, o) => { r.textures.set(`${a}_${rec}`, { px, o }); };
  r.createMesh = (model) => { r.meshes++; return { model }; };
  r.drawMesh = (gpu, m) => r.draws.push({ gpu, m: [...m] });
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] });
  r.destroyBillboardBatch = () => {};
  return r;
}
function fakeRuntime(view) {
  return { view: () => ({ state: { HorseName: '', HorseMode: 0 }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, actionRows: () => [{ id: 1, label: 'Hitch up' }] };
}
const loader = async (kind) => bakeOf(kind);
const deployed = (pos = [10, 1, 10]) => ({ isGrounded: true, position: pos, rotation: [0, 0, 0, 1], cargoTier: 90 });

test('WAGONS1 THE POOL: the wagon drawn is the kind driven - its statics and every wheel, the wagons\' fifteen pictures uploaded once and opaque; the horse hitched its own length ahead; a bake that will not load gives the classic wagon its place (mutants: the kind unread, the hitch the mod\'s for every kind, no fall back)', async () => {
  let kind = 'caravan';
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, bakedWagon: loader });
  pool.attach(fakeRuntime({ deployed: deployed() }));
  assert.equal(pool.partsOf('caravan'), null, 'building');
  await flush();
  const parts = pool.partsOf('caravan');
  assert.ok(parts?.gpu?.body && parts.gpu.wheels.length === 4);
  assert.equal([...r.textures.keys()].filter((k) => k.startsWith(`${WAGON_ARCHIVE}_`)).length, 15);
  assert.ok([...r.textures.values()].every((t) => t.o?.opaque));
  r.draws.length = 0;
  assert.equal(pool.draw(r), 1);
  assert.equal(r.draws.length, 5, 'the caravan: its body and four wheels, no cargo');
  assert.deepEqual(WAGON_KIND_ORDER.map((k) => pool.hitchOf(k)), [3.8, 7.1, 7.7]);
  assert.equal(pool.presentation.hitchOf(), 7.7, 'the runtime\'s hitch is the driven wagon\'s');
  // a peer's word naming the open wagon is drawn as one
  pool.applyOwner('ann', { w: [2, 20, 1, 20, 0, 0, 0, 1, 0, 0], wk: 1 }, (p) => p, 0);
  assert.equal(pool.peers.get('ann').wagon.model, 'openWagon');
  // no bake: the classic wagon for every kind, the mod's 3.1
  const failing = createHorseCartPool({ renderer: fakeRenderer(), meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'openWagon', bakedWagon: async () => { throw new Error('offline'); }, log: { warn() {}, error() {} } });
  failing.partsOf('openWagon');
  await flush();
  assert.equal(failing.hitchOf('openWagon'), HITCHED_HORSE_LOCAL_Z);
  const classic = createHorseCartPool({ renderer: null, meshes: null, collider: () => null });
  assert.equal(classic.hitchOf('caravan'), HITCHED_HORSE_LOCAL_Z, 'no bake asked for: the classic wagon, as before WAGONS1');
  kind = 'cart';
});

test('WAGONS1 THE CART\'S TILT: unhitched, the cart rests tipped on its shafts as drawn; a horse in its shafts bears it level - the body\'s matrix turned about the axle, the wheels not (mutant: the tilt unread)', async () => {
  const r = fakeRenderer();
  let hitched = false;
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'cart', bakedWagon: loader });
  pool.attach({ ...fakeRuntime({}), view: () => ({ state: { HorseName: '', HorseMode: hitched ? 0 : 3 }, moving: null, deployed: deployed([0, 0, 0]), horse: null, teamFollowing: false, horseFollowing: false, persistence: true }) });
  pool.partsOf('cart'); await flush();
  const bodyOf = () => { r.draws.length = 0; pool.draw(r); return r.draws[0].m; };
  const rest = bodyOf();
  hitched = true;
  const borne = bodyOf();
  assert.deepEqual(rest.slice(0, 12).map((v) => +v.toFixed(6)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 'at rest, unturned');
  assert.ok(Math.abs(Math.atan2(borne[9], borne[10]) * 180 / Math.PI - CART_REST_PITCH_DEG) < 1e-3, 'hitched, nose up by its rest (its +z turned toward +y)');
});

test('WAGONS1 THE CARAVAN\'S ROW: my parked caravan\'s plaque adds "Step inside" after the mod\'s rows; its press goes to the caravan\'s door (within the mod\'s reach), never to the runtime; its door is behind it (mutant: the row on every wagon)', async () => {
  let entered = 0, kind = 'caravan';
  const pool = createHorseCartPool({ renderer: fakeRenderer(), meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, bakedWagon: loader, enterCaravan: () => { entered++; } });
  const rt = { ...fakeRuntime({ deployed: deployed([5, 1, 5]) }), handleDeployedWagonActivation: () => { throw new Error('not the runtime'); } };
  pool.attach(rt);
  pool.partsOf('caravan'); await flush();
  const rows = pool.hoverName(KEY_WAGON).actions;
  assert.deepEqual(rows.map((x) => x.id), [1, CARAVAN_ENTER_ROW]);
  assert.equal(pool.hoverName(KEY_WAGON).title, 'Caravan');
  assert.ok(pool.activate(KEY_WAGON, 2, null, null, CARAVAN_ENTER_ROW));
  let far = 0;
  pool.activate(KEY_WAGON, 9, null, () => far++, CARAVAN_ENTER_ROW);
  assert.deepEqual([entered, far], [1, 1]);
  const door = pool.parkedDoor();
  assert.ok(door.step[2] < 5 && Math.abs(door.yaw - Math.PI) < 1e-9, 'behind it, facing away');
  kind = 'openWagon';
  pool.partsOf('openWagon'); await flush();
  assert.deepEqual(pool.hoverName(KEY_WAGON).actions.map((x) => x.id), [1], 'no door on the open wagon');
  assert.equal(pool.parkedDoor(), null);
});

test('WAGONS1 THE WORD: `wk` names the wagon (absent, the cart - every word before WAGONS1), `wh` a horse in a parked one\'s shafts, `ps` who rides where, `go` a journey, `pn` who was turned away - each validated; the cell\'s park record keeps the wagon\'s kind (mutants: the kind dropped, a bad passenger list seating anyone)', () => {
  const view = { wagon: { kind: HCC_WIRE_KIND.Deployed, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 25, angle: 0, model: 'caravan', hitched: true, passengers: [['bob', 1]] }, horse: null, name: '', go: [10, 20, 3], declined: ['eve'] };
  const rec = hccWireRecord(view);
  assert.deepEqual([rec.wk, rec.wh, rec.ps, rec.go, rec.pn], [2, 1, [['bob', 1]], [10, 20, 3], ['eve']]);
  const v = validHccRecord(rec);
  assert.deepEqual([v.w.model, v.w.hitched, v.w.passengers, v.go, v.pn], ['caravan', true, [['bob', 1]], [10, 20, 3], ['eve']]);
  assert.notEqual(hccRecordKey(rec), hccRecordKey({ ...rec, ps: undefined }), 'a rider sitting down is a moved word');
  const old = validHccRecord({ w: rec.w });
  assert.deepEqual([old.w.model, old.w.hitched, old.w.passengers], ['cart', false, []]);
  assert.deepEqual(validHccRecord({ w: rec.w, ps: [['bob', 1], ['bob', 2]] }).w.passengers, [], 'one rider, one seat - or none seated');
  assert.deepEqual(validHccRecord({ w: rec.w, ps: [['bob', 9]] }).w.passengers, []);
  assert.equal(validHccRecord({ w: rec.w, go: [1, 2] }).go, undefined);
  const park = validParkData({ c: 'abc12345', a: [1, 3], r: { w: rec.w, wk: 2, wh: 1 } });
  assert.deepEqual([park.r.wk, park.r.wh], [2, 1]);
  assert.equal(validParkData({ c: 'abc12345', a: [1, 3], r: { w: rec.w, wk: 7 } }).r.wk, undefined, 'a kind the law does not know is no kind');
});

test('WAGONS1 THE HOSTS\' SEAM: one constructor hands both hosts the driven kind and the bake loader, each bake fetched once; both hosts call it, and world.js gives the pool the caravan\'s door and the riders (THE ONE CONSTRUCTION SEAM)', async () => {
  let fetched = 0;
  const deps = wagonPoolDeps(() => [newWagonItem('openWagon')], async () => { fetched++; return { ok: true, json: async () => ({}) }; });
  assert.equal(deps.wagonKind(), 'openWagon');
  await Promise.all([deps.bakedWagon('cart'), deps.bakedWagon('cart')]);
  assert.equal(fetched, 1);
  assert.equal(wagonPoolDeps(() => []).wagonKind(), 'cart');
  assert.deepEqual(Object.keys(WAGON_MODEL_URLS), WAGON_KIND_ORDER);
  for (const host of ['world', 'exterior']) {
    const src = readFileSync(new URL(`../src/scenes/${host}.js`, import.meta.url), 'utf8');
    assert.match(src, /\.\.\.wagonPoolDeps\(\(\) => playerEntity\.items \?\? \[\]\)/, `${host}.js builds the pool with the seam`);
    assert.match(src, /wagonKgLimit: \(\) => wagonKgFor\(playerEntity\)/, `${host}.js: the runtime's capacity is the driven wagon's`);
  }
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /enterCaravan: \(\) => caravanRooms\.enter\(\)/);
  assert.match(world, /riders: \{ passengers: \(\) => wagonRiders\?\.passengers\(\)/);
  assert.match(world, /peerKey|hcc/);
  void peerKey;
});
