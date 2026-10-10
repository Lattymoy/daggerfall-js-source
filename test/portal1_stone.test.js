// PORTAL1 - THE PORTAL STONE (2026-10-04, the owner: "with the removal of fast travel, I want to implement a new item
// available at all shops, this should cost weykar shards (from dismantling gear with rarity). These should always be
// readily available. When using this item, it opens a portal allowing you to traverse to anywhere on the map. This is a
// one use item that stays open for a short time, allowing multiple players to traverse"), and AUDIT PORTAL1 (the owner:
// "Audit this. It needs to be perfect"; bible/01-Overview/Audit-PORTAL1.md). The laws pinned here:
//   - THE STONE: template 572 beside the Welkynd Shard - stacking with its own kind, BOUND (the realm's list names it),
//     miscellany (never a crystal worn), lighter than the shards it costs.
//   - THE COUNTER: PORTAL_STONE_SHARDS shards the purse may spend (unlocked, unworn) for one stone, all or nothing,
//     never out of stock; a shop keeper's popup carries the row on both skins when its art stands - a teller and a mod's
//     service never; a purse already short is told at once.
//   - THE USE: the pack's Use, both skins' readers and the hotbar hand the stone to the host's `openPortal` door; the
//     door, the pick and the step ask one hold ladder; one stone spent at the pick, on a place with room and ground.
//   - THE PORTAL: kept in the world frame (the host's own x40 one), held its time and sealed, entered by a STEP IN that
//     is forgotten across any gap; online believed only near its opener, one an opener, never longer than first said.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as PS from '../src/systems/portalStone.js';
import { PORTAL_STONE_TEMPLATE, PORTAL_STONE_TEMPLATES, PORTAL_STONE, PORTAL_STONE_SHARDS, portalStones, isPortalStone, welkyndShards, WELKYND_SHARD, WELKYND_SHARD_TEMPLATE, isWelkyndShard } from '../src/systems/gateSpoils.js';
import { BOUND_TEMPLATES } from '../src/net/realmTradeLaw.js';
import { isBound } from '../src/systems/itemBound.js';
import { setLocked } from '../src/systems/itemLock.js';
import { addItem } from '../src/systems/inventory.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { equipItem, isEquipped } from '../src/systems/equip.js';
import { useItem, USE_PENDING } from '../src/systems/useItem.js';
import { survivalInfoTokens, itemStatRows } from '../src/systems/itemInfo.js';
import { useResultAction, itemLine } from '../src/ui/enhancedInventory.js';
import * as qs from '../src/systems/quickslots.js';
import { createPortalGates } from '../src/scenes/portalGates.js';
import { portalOpenAt, portalLife, PORTAL_MS, createPortalSet } from '../src/scenes/portalFx.js';
import { FadeBehaviour } from '../src/ui/fadeLayer.js';
import { MerchantServiceWindow, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H, portalRowRect, PORTAL_ROW_KEY } from '../src/ui/merchantServiceWindow.js';
import { MerchantRepairWindow, REPAIR_PANEL_X, REPAIR_PANEL_Y, REPAIR_PANEL_H } from '../src/ui/merchantRepairWindow.js';
import { REFORGE_ROW_BG } from '../src/ui/guildServiceWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const shardsIn = (items) => items.filter(isWelkyndShard).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const stonesIn = (items) => items.filter(isPortalStone).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const fakeRenderer = () => {
  const made = [], freed = [];
  return {
    made, freed,
    uploadTexture() {}, uploadEmissionTexture() {},
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.push(b); return b; },
    destroyBillboardBatch: (b) => freed.push(b),
  };
};
/** THE HOST'S OWN FRAME (world.js campToWire / campToScene over streamingWorld.js): the wire's x/z in Daggerfall units,
 *  40 to the metre (SCENE_MAP_RATIO), about a floating origin that moves; y unscaled. AUDIT PORTAL1 T1: a metre-sized
 *  fixture hid a reach of 256 units - 6.4 m - read as 256 m. */
const RATIO = 40;
const hostFrame = () => {
  const f = { origin: [1000, 0, 2000] };
  f.toWire = (p) => [(p[0] + f.origin[0]) * RATIO, p[1], (p[2] + f.origin[2]) * RATIO];
  f.toScene = (n) => [n[0] / RATIO - f.origin[0], n[1], n[2] / RATIO - f.origin[2]];
  return f;
};
/** world.js's own source of one member, cut whole and run over a stand-in scope (test/csa_together.test.js's idiom). */
function cut(src, head, end) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is in the source`);
  const j = src.indexOf(end, i);
  assert.ok(j > i, 'and it ends');
  return src.slice(i, j + end.length);
}
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

test('PORTAL1 the stone: its own row beside the shard (572, the Diamond\'s art, miscellany - never a crystal worn), stacking with its own kind alone, BOUND - the realm\'s service names it - priced at its shards\' worth and lighter than them; its card on both skins', () => {
  assert.equal(PORTAL_STONE_TEMPLATE, 572);
  assert.equal(WELKYND_SHARD_TEMPLATE + 1, PORTAL_STONE_TEMPLATE, 'beside the shard');
  const row = templateByIndex(PORTAL_STONE_TEMPLATE);
  assert.equal(row?.name, 'Portal Stone');
  assert.equal(row.bound, true); assert.equal(row.stackable, true);
  assert.deepEqual([row.worldTextureArchive, row.worldTextureRecord, row.baseWeight, row.basePrice], [254, 3, 0.25, 1250]);
  assert.equal(PORTAL_STONE_SHARDS, 5); assert.equal(PS.PORTAL_STONE_SHARDS, 5, 'one law, re-exported');
  assert.equal(PORTAL_STONE.value, PORTAL_STONE_SHARDS * WELKYND_SHARD.value);
  assert.ok(row.baseWeight < PORTAL_STONE_SHARDS * templateByIndex(WELKYND_SHARD_TEMPLATE).baseWeight, 'THE TRADE LIGHTENS THE PACK - the counter has no carry gate because of it');
  assert.equal(PORTAL_STONE_TEMPLATES.length, 1);
  assert.ok(BOUND_TEMPLATES.includes(PORTAL_STONE_TEMPLATE), 'the realm\'s service refuses it too');
  const s = portalStones(1);
  assert.ok(isPortalStone(s) && isBound(s));
  assert.equal(s.group, 'UselessItems2', 'miscellany - a gem is a crystal a slot takes'); assert.equal(s.name, 'Portal Stone');
  assert.equal(qs.hotbarKindOf(s), 'use', 'used from the bar, never worn');
  assert.equal(portalStones(0).stackCount, 1, 'at least one');
  const pack = [portalStones(1)];
  addItem(pack, portalStones(2));
  assert.equal(pack.length, 1); assert.equal(pack[0].stackCount, 3, 'stones stack');
  addItem(pack, welkyndShards(2));
  assert.equal(pack.length, 2, '...with their own kind alone');
  const lines = ['Opens a portal to any place on the map.', 'It stands 30 seconds, for anyone to step through.'];
  assert.deepEqual(PS.portalStoneLines(), lines);
  assert.deepEqual(survivalInfoTokens(s).map((t) => t.text).slice(2), lines, 'the classic popup\'s card');
  assert.deepEqual(itemStatRows(s).filter((r) => r.label === '').map((r) => r.text), lines, 'the stat rows');
  assert.deepEqual(itemLine(s).survival, lines, 'the enhanced card');
});

test('PORTAL1 the counter: five shards the purse may spend for a stone - exactly five buys, a locked or WORN one is never spent nor counted, short refuses with nothing taken; never out of stock; the words say what is kept', () => {
  const five = [welkyndShards(5)];
  assert.equal(PS.portalStoneRefusal(five), null);
  assert.equal(PS.buyPortalStone(five).ok, true); assert.equal(shardsIn(five), 0); assert.equal(stonesIn(five), 1, 'exactly the price');
  const four = [welkyndShards(4)];
  assert.deepEqual(PS.buyPortalStone(four), { ok: false, reason: 'shards' }); assert.equal(shardsIn(four), 4, 'nothing taken');
  const mixed = [welkyndShards(3), welkyndShards(2)];
  setLocked(mixed[1], true);
  assert.equal(PS.portalStoneRefusal(mixed), 'shards', 'a locked stack is the player\'s word to keep it');
  assert.equal(PS.shardsKept(mixed), 2);
  // AUDIT PORTAL1 I1: a WORN shard (a gem is a crystal a slot takes) is neither counted nor spent
  const e = { items: [welkyndShards(6)] };
  equipItem(e, e.items[0]);
  const worn = e.items.find((it) => isEquipped(it));
  assert.ok(worn && isWelkyndShard(worn), 'a shard worn as a crystal');
  assert.equal(PS.shardsKept(e.items), 1);
  assert.equal(PS.buyPortalStone(e.items).ok, true);
  assert.ok(e.items.includes(worn), 'the worn shard is still in the pack - no ghost on the doll');
  assert.equal(shardsIn(e.items), 1);
  // again and again while the shards last, one stack of stones
  const pack = [welkyndShards(3), welkyndShards(9)];
  for (let i = 0; i < 2; i++) assert.equal(PS.buyPortalStone(pack).ok, true);
  assert.equal(shardsIn(pack), 2); assert.equal(stonesIn(pack), 2); assert.equal(pack.filter(isPortalStone).length, 1);
  assert.equal(PS.buyPortalStone(pack).reason, 'shards');
  assert.equal(PS.PORTAL_TEXT.ask(12), 'Buy a Portal Stone for 5 Welkynd Shards? You carry 12.');
  assert.equal(PS.PORTAL_TEXT.shards(1), 'A Portal Stone costs 5 Welkynd Shards. You carry 1.');
  assert.equal(PS.PORTAL_TEXT.shards(3, 2), 'A Portal Stone costs 5 Welkynd Shards. You carry 3 you may spend (2 more are locked or worn).');
  assert.equal(PS.PORTAL_TEXT.row, 'Portal Stone (5 shards)');
});

test('PORTAL1 the use: the stone hands itself to the host\'s door on every reader - the pack\'s two skins and the hotbar - and a host with no open world says why; one stone spent at the pick', () => {
  const pack = [portalStones(2)];
  const r = useItem(pack[0], pack, { entity: { items: pack } });
  assert.equal(r.kind, 'openPortal'); assert.equal(r.item, pack[0]);
  assert.equal(pack[0].stackCount, 2, 'Use spends nothing - the pick does');
  assert.equal(USE_PENDING.openPortal, PS.PORTAL_TEXT.notHere, 'the readers\' stand-in is the door\'s own refusal');
  assert.deepEqual(useResultAction(r, { openPortal: () => {} }), { kind: 'openPortal', item: pack[0], closeFirst: true });
  assert.deepEqual(useResultAction(r, {}), { kind: 'message', text: PS.PORTAL_TEXT.notHere });
  const inv = read('src/ui/nativeInventory.js');
  assert.match(inv, /if \(r\.kind === 'openPortal'\) \{\n\s+if \(this\.hooks\.openPortal\) \{ this\._closeSilently\(\); this\.hooks\.openPortal\(r\.item, collection\); \}\n\s+else this\.boxes = \[\{ rows: \[\{ text: USE_PENDING\.openPortal, center: true \}\] \}\];/);
  assert.match(read('src/ui/enhancedInventory.js'), /const openPortal = deps\.openPortal;\n\s+onExit\(\);[^\n]*\n\s+openPortal\(act\.item, collection\);/, 'the hook read before the unmount clears it');
  const e = { items: pack, equipTable: {} };
  const press = (hooks) => {
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(pack[0]));
    const said = [];
    let done = null;
    const doors = { quickUse: (n) => { done = qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: e, items: pack, hooks, say: (l) => said.push(l) }); return true; } };
    qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) });
    qs.clearHotbar();
    return { done, said };
  };
  const calls = [];
  assert.equal(press({ openPortal: (item, list) => { calls.push([item, list]); return true; } }).done.kind, 'used');
  assert.deepEqual(calls, [[pack[0], pack]]);
  assert.equal(press({ openPortal: () => false }).done.kind, 'refused', 'a refused door is a refused press');
  const none = press({});
  assert.equal(none.done.kind, 'refused'); assert.deepEqual(none.said, [PS.PORTAL_TEXT.notHere]);
  assert.equal(PS.spendPortalStone(pack[0], pack), true); assert.equal(pack[0].stackCount, 1);
  const last = pack[0];
  assert.equal(PS.spendPortalStone(last, pack), true); assert.equal(pack.length, 0, 'the last stone leaves the pack');
  assert.equal(PS.spendPortalStone(last, pack), false, 'a stone no longer there spends nothing');
  assert.equal(PS.spendPortalStone(welkyndShards(3), [welkyndShards(3)]), false, 'only a stone');
});

test('PORTAL1 the numbers, as the record states them; the hold ladder in its order; the place - ahead along the camera\'s forward, short of a wall, on the ground, refused with no room or no ground', () => {
  assert.deepEqual(
    [PS.PORTAL_OPEN_MS, PS.PORTAL_AHEAD, PS.PORTAL_WALL_GAP, PS.PORTAL_MIN_AHEAD, PS.PORTAL_GROUND_PROBE, PS.PORTAL_REACH, PS.PORTAL_REACH_Y, PS.PORTAL_SAY_REACH, PS.PORTAL_PEER_REACH, PS.PORTAL_REGROUND, PS.PORTAL_STEP_GAP_MS, PS.PORTAL_STEP_JUMP],
    [30000, 2, 0.6, 1.2, 3, 0.9, 2, 32, 40, 4, 250, 1.5]);
  assert.equal(PS.portalHold({}), null);
  assert.equal(PS.portalHold({ dead: true, duel: true }), 'busy');
  assert.equal(PS.portalHold({ busy: true, enemies: true }), 'busy');
  assert.equal(PS.portalHold({ duel: true, siege: true, enemies: true, journey: true }), 'duel');
  assert.equal(PS.portalHold({ siege: true, enemies: true, journey: true }), 'siege');
  assert.equal(PS.portalHold({ enemies: true, journey: true }), 'enemies');
  assert.equal(PS.portalHold({ journey: true }), 'journey');
  for (const k of ['busy', 'duel', 'siege', 'enemies', 'journey']) assert.ok(PS.PORTAL_HOLD_TEXT[k], k);
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  const asked = [];
  const ground = (o, d, m) => { asked.push([o, d, m]); return 1.5; };
  assert.ok(near(PS.portalPlace([0, 5, 0], 0, { ground }).at, [0, 4.5, 2]), 'yaw 0 faces +z ([sin, cos] - world.js playerForward), on the probe\'s ground');
  assert.deepEqual(asked, [[[0, 6, 2], [0, -1, 0], 3]], 'the probe: a metre over the feet, straight down, three metres');
  assert.ok(near(PS.portalPlace([1, 5, 1], Math.PI / 2, { ground }).at, [3, 4.5, 1]));
  const walls = [];
  const wallAt = (d) => (o, dir, m) => { walls.push([o, dir, m]); return d; };
  assert.ok(near(PS.portalPlace([0, 5, 0], 0, { ground, wall: wallAt(2.4) }).at, [0, 4.5, 1.8]), 'a wall 2.4 m on: 0.6 short of it');
  assert.deepEqual(walls[0], [[0, 6, 0], [0, 0, 1], 2.6], 'the wall ray: from a metre up, along the facing, as far as the portal and its gap');
  assert.ok(near(PS.portalPlace([0, 5, 0], 0, { ground, wall: wallAt(9) }).at, [0, 4.5, 2]), 'a wall beyond: the full two metres');
  assert.deepEqual(PS.portalPlace([0, 5, 0], 0, { ground, wall: wallAt(1.7) }), { refused: 'room' }, 'no room: inside reach of a wall');
  assert.deepEqual(PS.portalPlace([0, 5, 0], 0, { ground: () => null }), { refused: 'ground' });
  assert.deepEqual(PS.portalPlace([0, 5, 0], 0, { ground: () => 3.5 }), { refused: 'ground' }, 'a drop past the probe');
  assert.deepEqual(PS.portalPlace([0, 5, 0], 0), { refused: 'ground' }, 'no probe, no ground');
  assert.ok(PS.PORTAL_MIN_AHEAD > PS.PORTAL_REACH, 'the opener stands outside their own portal, wall or none');
  for (const k of ['room', 'ground', 'water', 'aboard', 'standing', 'noMap', 'gone', 'notHere', 'noStreet']) assert.ok(PS.PORTAL_TEXT[k], k);
});

test('PORTAL1 the step: an entry is a step from outside to inside - never asked, standing in, over it or out of reach is no entry', () => {
  const at = [0, 0, 0];
  assert.deepEqual(PS.portalStepIn(null, [0, 0, 0], at), { inside: true, entered: false }, 'never asked: no entry');
  assert.deepEqual(PS.portalStepIn(true, [0, 0, 0], at), { inside: true, entered: false }, 'standing in: no entry');
  assert.deepEqual(PS.portalStepIn(false, [PS.PORTAL_REACH - 0.01, 0, 0], at), { inside: true, entered: true });
  assert.deepEqual(PS.portalStepIn(false, [0, 0, PS.PORTAL_REACH - 0.01], at), { inside: true, entered: true }, 'z as x');
  assert.deepEqual(PS.portalStepIn(false, [PS.PORTAL_REACH + 0.01, 0, 0], at), { inside: false, entered: false });
  assert.deepEqual(PS.portalStepIn(false, [0, PS.PORTAL_REACH_Y + 0.01, 0], at), { inside: false, entered: false }, 'over it is not in it');
  assert.deepEqual(PS.portalStepIn(false, [0, -PS.PORTAL_REACH_Y - 0.01, 0], at), { inside: false, entered: false }, 'under it neither');
  assert.equal(PS.insidePortal(null, at), false);
});

test('PORTAL1 the wire: the opener says where it stands, the pixel and the time left - never the name; a field outside its law refuses the record whole', () => {
  const f = hostFrame();
  const g = createPortalGates({ renderer: fakeRenderer(), now: () => 1000, toScene: f.toScene, toWire: f.toWire })
    .open([0.0312, 2.5, -3.456], { pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  const w = PS.portalWire(g, 2000);
  assert.deepEqual(w, { i: g.id, p: [40001.25, 2.5, 79861.76], d: [12, 345], r: 29000 }, 'the producer\'s own gate, in the wire\'s units');
  assert.ok(!JSON.stringify(w).includes('Daggerfall'), 'the name is read off each receiver\'s map');
  assert.deepEqual(PS.validPortalRecord(w), w);
  const bad = [
    null, [], 'x', { ...w, i: '' }, { ...w, i: 'a b' }, { ...w, i: 'x'.repeat(25) }, { ...w, i: 7 },
    { ...w, p: [1, 2] }, { ...w, p: [1, NaN, 2] }, { ...w, p: [1e12, 0, 0] }, { ...w, p: [0, 0, 1e12] }, { ...w, p: [0, 1e9, 0] },
    { ...w, d: [1.5, 2] }, { ...w, d: [-1, 2] }, { ...w, d: [2, -1] }, { ...w, d: [1000, 2] }, { ...w, d: [2, 500] }, { ...w, d: [2] },
    { ...w, r: 0 }, { ...w, r: -5 }, { ...w, r: PS.PORTAL_OPEN_MS + 1 }, { ...w, r: Infinity },
  ];
  for (const b of bad) assert.equal(PS.validPortalRecord(b), null, JSON.stringify(b));
  assert.deepEqual(PS.validPortalRecord({ ...w, r: PS.PORTAL_OPEN_MS, extra: 1 }), { ...w, r: PS.PORTAL_OPEN_MS }, 'projected: nothing else rides');
});

test('PORTAL1 the vortex held: a hold of its own and a place of its own - COMPANION-PORTAL\'s defaults untouched', () => {
  assert.equal(portalLife(), PORTAL_MS.open + PORTAL_MS.hold + PORTAL_MS.close);
  assert.equal(portalLife({ holdMs: 5000 }), PORTAL_MS.open + 5000 + PORTAL_MS.close);
  assert.equal(portalOpenAt(PORTAL_MS.open + 4000, { holdMs: 5000 }).open, 1, 'held');
  assert.equal(portalOpenAt(portalLife({ holdMs: 5000 }), { holdMs: 5000 }).done, true, 'sealed at its life');
  assert.equal(portalOpenAt(PORTAL_MS.open + PORTAL_MS.hold + PORTAL_MS.close).done, true, 'a companion\'s as ever');
  const r = fakeRenderer();
  let now = 0;
  const set = createPortalSet({ renderer: r, now: () => now });
  const p = set.open([10, 0, 10], { holdMs: 5000, fixed: true });
  now = 100; set.tick([10, 1.6, 0]);
  assert.deepEqual([p.origin[0], p.origin[2]], [10, 10], 'fixed: where it opened, never a step behind from the eye');
  now = 4000; set.tick(); assert.equal(set.count, 1);
  set.remove(p); assert.equal(set.count, 0); assert.deepEqual(r.freed, [p.batch], 'removed, its batch freed');
  set.remove(p); assert.equal(r.freed.length, 1, 'once');
});

test('PORTAL1 the pool, mine: opened in the world frame through the host\'s own converters, standing where it opened as the origin moves, its vortex living exactly its time, walked into once, sealing takes nobody, the busy host silent and a hold said; the step forgotten across a gap, a jump and the host\'s change of place; one of mine; said only near it', () => {
  let now = 1000;
  const f = hostFrame();
  const r = fakeRenderer();
  const entered = [], refused = [];
  let hold = null;
  const gates = createPortalGates({
    renderer: r, now: () => now, toScene: f.toScene, toWire: f.toWire,
    onEnter: (g) => entered.push(g.dest.name), onRefused: (h, g) => refused.push([h, g.dest.name]),
  });
  const g = gates.open([0, 0, 2], { pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.deepEqual(g.native, [40000, 0, 80080], 'kept in the world frame');
  assert.equal(gates.mine(), g); assert.equal(g.until, 1000 + PS.PORTAL_OPEN_MS);
  assert.equal(portalLife({ holdMs: g.fx.holdMs }), PS.PORTAL_OPEN_MS, 'its vortex lives exactly the portal\'s time');
  const step = (feet, dt = 100) => { now += dt; return gates.tick(feet, { hold: () => hold }); };
  // THE FLOATING ORIGIN MOVES: the portal stands where it opened in the world, the vortex with it
  f.origin = [1010, 0, 2005];
  step([-10, 0, -3]);
  const fxp = g.fx;
  assert.deepEqual([fxp.feet[0], fxp.feet[2], fxp.origin[0], fxp.origin[2]], [-10, -3, -10, -3], 'the vortex in this frame - fixed, not behind a body');
  // standing on it as it opens takes nobody; walking off and back in does - once
  step([-10, 0, -3]); assert.deepEqual(entered, []);
  step([-10, 0, -4]); step([-10, 0, -3.5]); step([-10, 0, -3]);
  assert.deepEqual(entered, ['Daggerfall']);
  step([-10, 0, -3]); assert.deepEqual(entered, ['Daggerfall'], 'once a step');
  // a hold: the busy host lets nobody through in silence; any other hold is said
  step([-10, 0, -4]); hold = 'busy'; step([-10, 0, -3.5]); step([-10, 0, -3]);
  assert.deepEqual([entered.length, refused], [1, []]);
  hold = 'enemies'; step([-10, 0, -4]); step([-10, 0, -3.5]); step([-10, 0, -3]);
  assert.deepEqual([entered.length, refused], [1, [['enemies', 'Daggerfall']]]);
  hold = null;
  // THE STEP IS FORGOTTEN: frames apart (a building - the host ticks nothing there), feet that jumped (a door, a teleport)
  step([-10, 0, -4]); step([-10, 0, -3], PS.PORTAL_STEP_GAP_MS + 1);
  assert.equal(entered.length, 1, 'outside, a building visit, back out into it: no entry (AUDIT PORTAL1 U1)');
  step([-10, 0, -4.4]); step([-10, 0, -6]); step([-10, 0, -3]);
  assert.equal(entered.length, 1, 'a jump into it: no entry');
  step([-10, 0, -4]); gates.forgetSteps(); step([-10, 0, -3]);
  assert.equal(entered.length, 1, 'the host forgot the step (its change of place): no entry');
  step(null); step([-10, 0, -3]);
  assert.equal(entered.length, 1, 'off the street and back: no entry');
  step([-10, 0, -4]); step([-10, 0, -3]); assert.deepEqual(entered, ['Daggerfall', 'Daggerfall'], 'a real step after them all');
  // my word: near it (the scene's metres), else none
  const w = gates.wireRecord([-10 + PS.PORTAL_SAY_REACH - 1, 0, -3]);
  assert.deepEqual(w.p, [40000, 0, 80080]); assert.equal(w.r, g.until - now);
  assert.equal(gates.wireRecord([-10, 0, -3 + PS.PORTAL_SAY_REACH + 1]), null, 'far along z: said to nobody');
  assert.equal(gates.wireRecord([-10 + PS.PORTAL_SAY_REACH + 1, 0, -3]), null, 'far along x');
  assert.equal(gates.wireRecord(null), null);
  // sealing: no entry in its last PORTAL_MS.close
  now = g.until - PORTAL_MS.close + 10; gates.tick([-10, 0, -4]); now += 10; gates.tick([-10, 0, -3]);
  assert.equal(entered.length, 2, 'a sealing portal takes nobody');
  now = g.until; gates.tick(null);
  assert.equal(gates.mine(), null); assert.equal(gates.gates.length, 0); assert.deepEqual(r.freed, [fxp.batch], 'gone at its time, its batch freed');
  // one of mine at a time; a teardown clears all
  gates.open([0, 0, 0], { pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  gates.open([5, 0, 0], { pixel: { x: 40, y: 40 }, name: 'Wayrest' });
  assert.equal(gates.gates.length, 1); assert.equal(gates.mine().dest.name, 'Wayrest');
  gates.clear();
  assert.equal(gates.gates.length, 0); assert.equal(gates.batches().length, 0);
});

test('PORTAL1 the pool, a peer\'s: believed only near its opener\'s own feet, named off my map, one an opener, said again never longer than first said, gone at its time, stood on my own ground', () => {
  let now = 1000;
  const f = hostFrame();
  const r = fakeRenderer();
  const entered = [];
  const places = new Map([['12,345', 'Daggerfall'], ['40,40', 'Wayrest']]);
  let groundY = null;
  const gates = createPortalGates({
    renderer: r, now: () => now, toScene: f.toScene, toWire: f.toWire,
    destOf: (x, y) => (places.has(`${x},${y}`) ? { pixel: { x, y }, name: places.get(`${x},${y}`) } : null),
    groundAt: () => groundY, onEnter: (g) => entered.push(g.dest.name),
  });
  // the opener's own pool says it - the producer's record, not a literal
  const opener = createPortalGates({ renderer: fakeRenderer(), now: () => now, toScene: f.toScene, toWire: f.toWire });
  opener.open([20, 1, 0], { pixel: { x: 40, y: 40 }, name: 'Wayrest' });
  const word = opener.wireRecord([18, 1, 0]);
  const peerFeet = [18, 1, 0];
  assert.equal(gates.applyOwner('p1', word, null), false, 'an opener I cannot see opens nothing');
  assert.equal(gates.applyOwner('p1', word, [18 + PS.PORTAL_PEER_REACH + 3, 1, 0]), false, 'AUDIT PORTAL1 O1: a portal far from its opener is refused');
  assert.equal(gates.applyOwner('p1', { ...word, d: [7, 7] }, peerFeet), false, 'a pixel with no place');
  assert.equal(gates.applyOwner('p1', { ...word, r: 0 }, peerFeet), false);
  assert.equal(gates.applyOwner(null, word, peerFeet), false, 'never ownerless (mine)');
  assert.equal(gates.applyOwner('p1', word, peerFeet), true);
  const peer = gates.gates.find((x) => x.owner === 'p1');
  assert.equal(peer.dest.name, 'Wayrest', 'named off my map');
  const first = peer.until;
  now += 1000;
  assert.equal(gates.applyOwner('p1', { ...word, r: PS.PORTAL_OPEN_MS }, peerFeet), true);
  assert.equal(peer.until, first, 'AUDIT PORTAL1 O2: said again with more time - never longer than first said');
  assert.equal(gates.applyOwner('p1', { ...word, r: 5000 }, peerFeet), true);
  assert.equal(peer.until, now + 5000, 'said again with less - the less');
  assert.equal(r.made.length, 1, 'the same portal said again keeps its look');
  assert.equal(gates.applyOwner('p1', { ...word, i: 'other' }, peerFeet), false, 'one an opener: the first stands its time');
  // stood on my ground: found near the opener's height, the portal comes down to it
  groundY = -1.5;
  gates.tick([0, 0, 0]);
  assert.equal(f.toScene(peer.native)[1], -1.5, 'AUDIT PORTAL1 O5: my ground');
  assert.equal(peer.grounded, true);
  // I step through theirs
  now += 100; gates.tick([20, -1.5, -3]); now += 100; gates.tick([20, -1.5, -2]); now += 100; gates.tick([20, -1.5, -0.5]);
  assert.deepEqual(entered, ['Wayrest']);
  // gone at its own time with no word since; then another of theirs is believed - and ground far off its height is not taken
  now = peer.until; gates.tick(null);
  assert.equal(gates.gates.length, 0);
  assert.equal(gates.applyOwner('p1', { ...word, i: 'other' }, peerFeet), true, 'the next once the first ran out');
  const far = gates.gates[0];
  groundY = 30;
  now += 100; gates.tick([0, 0, 0]);
  assert.equal(f.toScene(far.native)[1], 1, 'ground far off the opener\'s height: the portal keeps it');
  assert.equal(far.grounded, true);
});

test('PORTAL1 the door, the pick and the arrival, as world.js runs them: every refusal at the door in its order and again at the pick, the map in teleport mode with no fee, the black lifted only where the classic box made it, one stone spent on a placed portal, the frame owed full; the arrival black, off the frame, the following team around it, a failure lifting the black', async () => {
  const w = read('src/scenes/world.js');
  const fade = new FadeBehaviour();
  const said = [], overlays = [], built = [], arrivals = [];
  const f = hostFrame();
  const pack = [portalStones(2)];
  const playerEntity = { health: 10, items: pack, wagonItems: [] };
  const scope = {
    townTalk: { say: (l) => said.push(l), showOverlay: (w2) => overlays.push(w2) },
    playerEntity, player: { isPlayerSwimming: false, feetAt: () => [0, 0, 0] }, cam: { pos: [0, 1.6, 0], yaw: 0 },
    walkMode: true, playerSpawned: true, _modeNow: 'exterior', _teleporting: false, busy: false,
    duel: false, siege: false, enemies: false, journeyOn: false, boat: null,
    PORTAL_TEXT: PS.PORTAL_TEXT, PORTAL_HOLD_TEXT: PS.PORTAL_HOLD_TEXT, portalHold: PS.portalHold, portalPlace: PS.portalPlace, spendPortalStone: PS.spendPortalStone,
    travelView: { state: 'off' }, cityGuards: { guards: [] }, exteriorFoes: { foes: [] },
    collider: { surfaceHit: () => ({ dist: 1 }), raycastHit: () => null },
    hudFade: fade, surfacePlayer: () => {}, _foesFullAt: 0, console: { warn: () => {} },
    travelMapDoorReady: () => true,
    buildTravelMapWindow: (deps) => { const win = { deps, teleport: false, activateTeleportationTravel() { this.teleport = true; } }; built.push(win); return win; },
    isOnShip: () => false, playerTravelPixel: () => ({ x: 0, y: 0 }), hcc: [],
    teleportTo: async (dest) => { arrivals.push(dest.name); scope.hcc.push('teleport'); if (dest.fail) throw new Error('no'); },
  };
  Object.assign(scope, {
    _mode: () => scope._modeNow, worldMoveBusy: () => scope.busy, duelEnemyNear: () => scope.duel, inSiegeRoom: () => scope.siege,
    areEnemiesNearby: () => scope.enemies, navalHostileNear: () => false, csaBoatUnderMe: () => scope.boat,
    hccRuntimeOn: () => ({ handlePreFastTravel: () => scope.hcc.push('pre'), handlePostFastTravel: () => scope.hcc.push('post') }),
  });
  Object.defineProperty(scope, 'travelOptions', { get: () => ({ isTravelActive: scope.journeyOn }) });
  scope.portalGates = createPortalGates({ renderer: fakeRenderer(), now: () => 0, toScene: f.toScene, toWire: f.toWire });
  scope.portalHoldNow = mount(scope, cut(w, 'const portalHoldNow = () => portalHold({', '\n  });\n'), 'portalHoldNow');
  scope.portalDoorRefusal = mount(scope, cut(w, 'const portalDoorRefusal = () => {', '\n  };\n'), 'portalDoorRefusal');
  scope.standPortal = mount(scope, cut(w, 'function standPortal(pick, item, live) {', '\n  }\n'), 'standPortal');
  const openPortalStone = mount(scope, cut(w, 'function openPortalStone(item, list) {', '\n  }\n'), 'openPortalStone');
  const portalArrive = mount(scope, cut(w, 'function portalArrive(g) {', '\n  }\n'), 'portalArrive');
  // THE DOOR, in its order
  const door = (set, want) => {
    const keep = Object.fromEntries(Object.keys(set).map((k) => [k, scope[k]]));
    Object.assign(scope, set);
    said.length = 0;
    assert.equal(openPortalStone(pack[0], pack), false, JSON.stringify(Object.keys(set)));
    assert.deepEqual(said, [want], JSON.stringify(Object.keys(set)));
    Object.assign(scope, keep);
  };
  door({ _modeNow: 'interior', busy: true }, PS.PORTAL_TEXT.notHere);
  door({ busy: true, duel: true }, PS.PORTAL_HOLD_TEXT.busy);
  door({ _teleporting: true }, PS.PORTAL_HOLD_TEXT.busy);
  door({ duel: true, siege: true }, PS.PORTAL_HOLD_TEXT.duel);
  door({ siege: true, enemies: true }, PS.PORTAL_HOLD_TEXT.siege);
  door({ enemies: true, journeyOn: true }, PS.PORTAL_HOLD_TEXT.enemies);
  door({ journeyOn: true }, PS.PORTAL_HOLD_TEXT.journey);
  door({ travelView: { state: 'up' } }, PS.PORTAL_HOLD_TEXT.journey);
  door({ player: { isPlayerSwimming: true, feetAt: () => [0, 0, 0] }, boat: {} }, PS.PORTAL_TEXT.water);
  door({ boat: {} }, PS.PORTAL_TEXT.aboard);
  door({ isOnShip: () => true }, PS.PORTAL_TEXT.aboard);
  door({ travelMapDoorReady: () => false }, PS.PORTAL_TEXT.noMap);
  playerEntity.health = 0; door({}, PS.PORTAL_HOLD_TEXT.busy); playerEntity.health = 10;
  assert.equal(built.length, 0, 'no map for a refusal');
  // the map: teleport mode, no fee, shown
  said.length = 0;
  assert.equal(openPortalStone(pack[0], pack), true);
  const win = built.at(-1);
  assert.equal(win.teleport, true, 'teleport mode - a pick is never ordinary fast travel');
  assert.equal(win.deps.travelOptions(), null, 'no Travel Options fee');
  assert.deepEqual(overlays, [win], 'shown');
  // the pick asks the door again
  scope.enemies = true;
  win.deps.onTeleport({ pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.deepEqual([said.at(-1), pack[0].stackCount, scope.portalGates.mine()], [PS.PORTAL_HOLD_TEXT.enemies, 2, null], 'a foe came while the map stood: refused at the pick, nothing spent');
  scope.enemies = false;
  scope.collider = { surfaceHit: () => ({ dist: 1 }), raycastHit: () => ({ dist: 1.5 }) };
  win.deps.onTeleport({ pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.deepEqual([said.at(-1), pack[0].stackCount], [PS.PORTAL_TEXT.room, 2], 'a wall in the way: refused, nothing spent');
  scope.collider = { surfaceHit: () => null, raycastHit: () => null };
  win.deps.onTeleport({ pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.deepEqual([said.at(-1), pack[0].stackCount], [PS.PORTAL_TEXT.ground, 2], 'no ground: refused, nothing spent');
  scope.collider = { surfaceHit: () => ({ dist: 1 }), raycastHit: () => null };
  // the held map smashes nothing - nothing is faded; the classic box smashed it black - it lifts
  win.deps.onTeleport({ pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.equal(fade.fadeInProgress, false, 'AUDIT PORTAL1 U4: no flash on the held map');
  assert.equal(said.at(-1), PS.PORTAL_TEXT.opened('Daggerfall'));
  assert.equal(pack[0].stackCount, 1, 'one stone spent');
  const g = scope.portalGates.mine();
  assert.deepEqual(f.toScene(g.native), [0, 0, 2], 'two metres ahead, on the ground');
  assert.equal(scope._foesFullAt, -Infinity, 'the next foes frame owed full');
  scope.portalGates.clear();
  fade.smashHUDToBlack();
  win.deps.onTeleport({ pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.equal(fade.fadeInProgress, true, 'the classic box\'s black lifts');
  assert.equal(pack.length, 0, 'the last stone spent');
  scope.portalGates.clear();
  win.deps.onTeleport({ pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.equal(said.at(-1), PS.PORTAL_TEXT.gone, 'no stone left: nothing opens');
  assert.equal(scope.portalGates.mine(), null);
  // a stone in a companion's storage is spent from it (AUDIT PORTAL1 I2)
  const kept = [portalStones(1)];
  assert.equal(openPortalStone(kept[0], kept), true);
  built.at(-1).deps.onTeleport({ pixel: { x: 40, y: 40 }, name: 'Wayrest' });
  assert.deepEqual([kept.length, scope.portalGates.mine()?.dest.name], [0, 'Wayrest']);
  // THE ARRIVAL: black at once, the teleport off the frame, the team around it; a failure lifts the black
  const fresh = new FadeBehaviour(); scope.hudFade = fresh;
  scope.hcc.length = 0;
  portalArrive({ dest: { name: 'Wayrest' } });
  assert.equal(fresh.backgroundColor[3], 1, 'black at once');
  assert.deepEqual(arrivals, [], 'not inside the frame');
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual([arrivals, scope.hcc], [['Wayrest'], ['pre', 'teleport', 'post']]);
  portalArrive({ dest: { name: 'Nowhere', fail: true } });
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(fresh.backgroundColor[3], 0, 'AUDIT PORTAL1 U5: a failed arrival lifts the black');
  scope.busy = true;
  portalArrive({ dest: { name: 'Wayrest' } });
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual([arrivals.length, fresh.backgroundColor[3]], [2, 0], 'a move already under way: no arrival, no black left');
});

test('PORTAL1 the counter\'s row on the classic popups: under the art, drawn in the Reforge row\'s dark with its label, its key P, the popup closed before the sale asks - no hook, no row; the panels\' button', () => {
  for (const [Win, px, py, ph] of [[MerchantServiceWindow, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H], [MerchantRepairWindow, REPAIR_PANEL_X, REPAIR_PANEL_Y, REPAIR_PANEL_H]]) {
    const [rx, ry, rw, rh] = portalRowRect(ph);
    assert.deepEqual([rx, ry, rw, rh], [5, ph + 2, 120, 10], 'just under the art');
    const order = [];
    let w = null;
    w = new Win({ service: 'Sell', portal: { label: PS.PORTAL_TEXT.row, onBuy: () => order.push(['buy', w.done]) }, onClose: () => order.push(['close']) });
    w.click(px + rx + rw / 2, py + ry + rh / 2);
    assert.deepEqual(order, [['close'], ['buy', true]], `${Win.name}: closed, then the sale`);
    const k = [];
    const w2 = new Win({ service: 'Sell', portal: { label: 'x', onBuy: () => k.push('buy') } });
    w2.input(PORTAL_ROW_KEY);
    assert.deepEqual(k, ['buy']); assert.equal(w2.done, true);
    const bare = new Win({ service: 'Sell' });
    bare.click(px + rx + rw / 2, py + ry + rh / 2);
    bare.input(PORTAL_ROW_KEY);
    assert.equal(bare.done, false, `${Win.name}: no hook, no row and no key`);
  }
  assert.equal(PORTAL_ROW_KEY, 'KeyP');
  // AUDIT PORTAL1 C1: the host's guard reads the popup by its hooks - the window calls onClose ON them
  const slot = { overlay: null };
  const hooks = { service: 'Sell', portal: { label: 'x', onBuy: () => {} }, onClose() { if (slot.overlay?.hooks === this) slot.overlay = null; } };
  slot.overlay = new MerchantServiceWindow(hooks);
  slot.overlay.input(PORTAL_ROW_KEY);
  assert.equal(slot.overlay, null, 'the popup out of the slot before the question');
  const msw = read('src/ui/merchantServiceWindow.js');
  assert.match(msw, /drawRect\(renderer, m, px \+ rx, py \+ ry, rw, rh, REFORGE_ROW_BG\);\n\s+shadowText\(renderer, font, label, m, px \+ rx, py \+ ry \+ 2, \{ align: 'center', w: rw \}\);/, 'the Reforge row\'s one dark, the label centred on it');
  assert.deepEqual(REFORGE_ROW_BG, [0.16, 0.11, 0.06, 0.92]);
  assert.match(msw, /if \(this\.hooks\.portal\) drawPortalRow\(renderer, m, font, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H, this\.hooks\.portal\.label\);/, 'the plain popup draws it');
  assert.match(read('src/ui/merchantRepairWindow.js'), /if \(this\.hooks\.portal && font\) drawPortalRow\(renderer, m, font, REPAIR_PANEL_X, REPAIR_PANEL_Y, REPAIR_PANEL_H, this\.hooks\.portal\.label\);/, 'the repair popup draws it');
  for (const door of ['src/ui/merchantServiceDoor.js', 'src/ui/merchantRepairDoor.js']) {
    assert.match(read(door), /\.\.\.\(hooks\.portal \? \[\{ label: hooks\.portal\.label, onClick: \(\) => \{ close\(\); hooks\.portal\.onBuy\?\.\(\); \} \}\] : \[\]\),[^\n]*\n\s+\{ label: 'Exit', onClick: close \},/, `${door}: the Enhanced Plus panel's button, above Exit`);
  }
});

test('PORTAL1 the hosts: every shop\'s keeper sells it (a teller and a mod\'s service never), its popup out of the slot before the question, a short purse told at once; the open world opens, draws, steps and forgets; says and hears it on the foes frame; every load ends it; a building\'s pack refuses in words, the dungeon\'s has no door and the street says its own', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /const portalRow = \(\) => \(mode === 'interior' && isShop\(interiorBuilding\?\.buildingType\)\n\s+\? \{ label: PORTAL_TEXT\.row, onBuy: \(\) => askPortalStone\(\) \} : undefined\);/);
  assert.match(wm, /onSell: \(\) => openMerchantSell\(\),\n\s+portal: portalRow\(\),/, 'the repair shop\'s popup');
  assert.match(wm, /portal: banking \|\| custom \? undefined : portalRow\(\),/, 'the plain shop\'s - never a bank\'s or a mod\'s service');
  assert.match(wm, /onClose\(\) \{ if \(interiorOverlay\?\.hooks === this\) interiorOverlay = null; \},\n\s+\}\)\);/, 'AUDIT PORTAL1 C1: the plain popup leaves the slot as the repair one does');
  assert.match(wm, /if \(portalStoneRefusal\(items\)\) \{ say\(PORTAL_TEXT\.shards\(shardsHeld\(items\), shardsKept\(items\)\)\); return; \}\n\s+mountInterior\(new YesNoBoxWindow\(\{/, 'a short purse is told at once, its kept shards named');
  assert.match(wm, /onYes: \(\) => buyPortalStoneNow\(\), onNo: \(\) => \{\},/);
  assert.match(wm, /const sale = buyPortalStone\(playerEntity\.items\);\n\s+if \(!sale\.ok\) \{ say\(PORTAL_TEXT\.shards\(shardsHeld\(playerEntity\.items\), shardsKept\(playerEntity\.items\)\)\); return false; \}/);
  const w = read('src/scenes/world.js');
  const doors = cut(w, '  const packDoors = {', '\n  };\n');
  assert.match(doors, /openPortal: \(item, list\) => openPortalStone\(item, list\),/, 'the pack\'s door (the interior\'s pack is this host\'s)');
  assert.match(w, /onEnter: \(g\) => portalArrive\(g\),\n\s+onRefused: \(hold\) => townTalk\.say\(PORTAL_HOLD_TEXT\[hold\]\),/);
  assert.match(w, /destOf: \(x, y\) => \{\n\s+const s = travelLocationSummaryAt\(mapDict, x, y\);\n\s+const loc = s \? maps\.getLocation\(s\.regionIndex, s\.mapIndex\) : null;\n\s+return loc\?\.name \? \{ pixel: \{ x, y \}, name: loc\.name \} : null;/, 'a destination named off this map, a nameless one refused');
  assert.match(w, /if \(cell\) \{ const rk = raidWireWord\(\); if \(rk\) frame\.rk = rk; \} if \(cell\) portalWord\(frame, full\);/, 'my portal on my foes frame, the line\'s last word');
  assert.match(w, /const portalWord = \(frame, full\) => \{\n\s+if \(!full\) return;\n\s+const pg = portalGates\.wireRecord\(walkMode && playerSpawned \? player\.feetAt\(\) : cam\.pos\);[^\n]*\n\s+if \(pg\) frame\.pg = pg;/, '...on every full frame, near it, in the scene\'s metres');
  assert.match(w, /exteriorFoes\.setOnPortals\(\(from, r\) => \{ const p = online\?\.peers\?\.get\(from\); portalGates\.applyOwner\(from, r, p\?\.shown \? onlineToScene\(p\.shown\) : null\); \}\);/, 'a peer\'s, with the peer\'s own feet');
  assert.match(w, /portalGates\.tick\(_mode\(\) === 'exterior' && walkMode && playerSpawned \? player\.feetAt\(\) : null, \{ hold: portalHoldNow \}\);/);
  assert.match(w, /if \(_mode\(\) === 'exterior'\) livePersonBatches\.push\(\.\.\.portalGates\.batches\(\)\);/);
  assert.match(w, /if \(_mode\(\) !== _torchesMode\) \{ droppedTorches\.destroyAll\(\);[^\n]* portalGates\.forgetSteps\(\); _torchesMode = _mode\(\); \}/, 'the step forgotten at every change of place');
  assert.match(w, /if \(restoresSoFar\(\) !== _portalRestores\) \{ _portalRestores = restoresSoFar\(\); portalGates\.clear\(\);[^\n]*\n\s+if \(_bootLoaded\)[^\n]*\n\s+if \(_mode\(\) !== _torchesMode\)/, 'AUDIT PORTAL1 U9: a load ends every portal - asked at the one door every load passes, before the frame turns indoors');   // PIN MOVED (AUDIT LW-II-2 D2): the one door lets the deep's layers go too, after the portals
  assert.ok(w.indexOf('if (restoresSoFar() !== _portalRestores)') < w.indexOf('if (modes.frame(dt, now)) {'), '...above the indoor return');
  const save = read('src/systems/save.js');
  assert.match(save, /return null;\n\s+\}\n\s+_restores\+\+;/, 'the count moves for a load that lands, never for a refused one');
  const f = read('src/scenes/exteriorFoes.js');
  assert.match(f, /if \(data\.pg !== undefined\) _onPortals\?\.\(from, data\.pg\);[^\n]*\n\s+if \(data\.hv !== undefined\) _onHcc/, 'past the pool\'s room test, beside the camps');
  assert.match(f, /\n\s+setOnPortals,   \/\/ PORTAL1\n\s+setOnCamps, setOnHcc, setOnDuel \};/, 'the pool hands the door out');
  assert.match(f, /const items = unbound\(validLootList\(r\.it\)\);/, 'AUDIT PORTAL1 I4: an heir\'s list lands without a bound piece');
  assert.doesNotMatch(read('server/src/index.js'), /\bpg\b/, 'the relay reads nothing inside a foes frame - no relay change, no version');
  assert.match(read('src/scenes/shared.js'), /import '\.\.\/systems\/portalStone\.js';/, 'the Use registers in every host');
  assert.doesNotMatch(read('src/scenes/dungeonContext.js'), /openPortal/, 'the dungeon: no door - the reader says PORTAL_TEXT.notHere');
  assert.match(read('src/scenes/exterior.js'), /openPortal: \(\) => \{ townTalk\.say\(PORTAL_TEXT\.noStreet\); return false; \},/, 'the standalone street: its own words');
});
