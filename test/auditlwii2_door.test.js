// AUDIT LW-II-2 (2026-10-10, the second audit of THE LIVING WORLD II, lane door): THE CARAVAN'S DOOR AGAIN - LW11's
// counter, deeds, hold-up and escort, and the host seams world.js wires them through (scenes/caravanHost.js,
// systems/livingWorld/caravanDoor.js, relations.js's road records, the two trade skins' confirm). Each finding was
// reproduced by a reviewer, fixed, and is pinned here. The fixtures are the real producers' - the census's rosters, the
// trips townTrips mints over a map (with the lives' real `fate`: test/lwRoads.mjs livingMap), the trouble's own
// encounter (trouble.js troubleOf), the counter's own roll (shopStock.js stockShopShelf) - and world.js's seams are
// lifted as world.js writes them. Pure and synthetic: no game data.
import './modsOff.js';   // MO1: Daggerfall's own shelves
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yields, reportAt, counterOf, WARE_KEY } from '../src/systems/livingWorld/caravanDoor.js';
import { createCaravanHost, CARAVAN_LINES } from '../src/scenes/caravanHost.js';
import { createRelations, REPORTS_MAX } from '../src/systems/livingWorld/relations.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { townTrips, ownTrip, partyAt, membersAt, placeCycle, handsOn, CALENDAR_MPM, NATIVE_PIXEL, WALK_TO_H } from '../src/systems/livingWorld/trips.js';
import { turnKey } from '../src/systems/livingWorld/lives.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { lwRng, textSeed } from '../src/systems/livingWorld/seed.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { applyTransfer } from '../src/systems/itemTransfer.js';
import { CRIMES } from '../src/systems/crimes.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { setInteractionMode } from '../src/player/interactionMode.js';
import { livingMap } from './lwRoads.mjs';
import { withDom } from './invdrag.mjs';

const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const town = (mapId, px, py, blocks) => ({ mapId, px, py, blocks, type: 0, region: 17, people: 3, name: `T${mapId}`, port: false });
/** The planner's way between two towns as the straight run of pixels between them, and the census's own rosters
 *  (lw11_caravan.test.js's map). */
function miniWorld(towns) {
  const rosters = new Map();
  return {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
    dryAt: () => true,
  };
}
/** The merchants' caravans of a town of 24 blocks bound for one of 20 eight pixels east, by their ids. */
function caravans() {
  const a = town(901, 100, 100, 24), b = town(902, 108, 100, 20);
  const world = miniWorld([a, b]);
  const got = new Map();
  for (let day = 0; day < 40; day++) for (const tr of townTrips(a, day * 1440 + 720, world, O()) ?? []) if (tr.kind === 'merchant') got.set(tr.id, tr);
  return { world, trips: [...got.values()], a, b };
}
/** A caravan with an armed hand. */
const armedCaravan = () => caravans().trips.find((tr) => tr.party.length >= 2 && tr.party.some((m) => m.cls != null) && !tr.enc);
/** A minute the party walks on the way out (by day, past its town). */
const walkingOut = (trip) => {
  for (let t = Math.ceil(trip.outT0); t < trip.outT1; t += 10) { const at = partyAt(trip, t); if (at.phase === 'out' && !at.camp && !at.halt && !at.fight) return t; }
  throw new Error('never walking');
};
const first = (name) => name.split(' ')[0];

/** A host over trips (the first the one asked of), its deps recorded; `slain` the player's own hand by its minute
 *  (relations.js `slain`, as world.js livingSlainAt reads it), `dead` every hand's dead. */
function hostOver(trip, { now, rel = createRelations(), dead = new Set(), slain = new Map(), here = null, level = 5, stock = null, regionAt = () => 17, travelFree = true, trips = [trip] } = {}) {
  const log = { said: [], charged: [], paid: [], trades: [], loot: [], choices: [], travelled: [] };
  const clock = { t: now };
  const deps = {
    relations: () => rel, clock: () => clock.t, day: (t) => Math.floor(t / 1440),
    roads: () => ({ parties: () => trips.map((tr) => ({ trip: tr, at: partyAt(tr, clock.t) })) }),
    findTrip: (res) => trips.find((tr) => tr.party.some((m) => m.id === res.id)) ?? null,
    tripById: (id) => trips.find((tr) => tr.id === id) ?? null,
    resOf: (id) => { for (const tr of trips) { const m = tr.party.find((p) => p.id === id); if (m) return m; } return null; },
    stock: stock ?? (() => [{ name: 'Rope' }, { name: 'Lamp' }, { name: 'Bread' }]),
    openTrade: (o) => { log.trades.push(o); return true; },
    openLoot: (o) => { log.loot.push(o); return true; },
    choose: (lines, options) => log.choices.push({ lines, options }),
    say: (text) => log.said.push(text),
    regionAt,
    charge: (region, crime) => log.charged.push([region, crime]),
    slainAt: (res, t) => slain.has(res.id) && slain.get(res.id) <= t,
    deadAt: (res, t) => dead.has(res.id) || (slain.has(res.id) && slain.get(res.id) <= t),
    here: () => (typeof here === 'function' ? here() : here),
    level: () => level,
    pay: (g) => log.paid.push(g),
    goldItem: (n) => ({ gold: n, stackCount: n }),
    online: () => false,
    travelWith: (tr, until) => { log.travelled.push(until); return true; },
    travelFree: () => travelFree,
  };
  return { host: createCaravanHost(deps), log, clock, rel, dead, slain, deps };
}
const codes = (log) => log.choices.at(-1)?.options.map((o) => o.code) ?? [];
/** Hired on (the record the door's H writes) - `near` the minute the escort was last with the party. */
const hire = (h, trip, t, pay = 99) => h.rel.setEscort({ trip: trip.id, t, pay, fights: 0, leader: trip.leader.id, to: trip.to?.mapId ?? 0, near: t });

// ── world.js, as it is written ─────────────────────────────────────
const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const HOST_AT = WORLD.indexOf('const caravanHostOf = () => (_caravanHost ??= createCaravanHost({');
/** The caravan host's deps as world.js hands them over. */
const DEPS = WORLD.slice(HOST_AT, WORLD.indexOf('\n  }));', HOST_AT));
/** One dep of them, a line's expression. */
const depOf = (name) => { const m = new RegExp(`\\n {4}${name}: (.*),(?: {3}//[^\\n]*)?\\n`).exec(DEPS); assert.ok(m, `the host's ${name}`); return m[1]; };
/** The offline journey with a caravan (`travelWith`), whole. */
const TRAVEL_WITH = (() => { const i = DEPS.indexOf('    travelWith: (trip, until) => {'); return i < 0 ? '' : DEPS.slice(i + '    travelWith: '.length, DEPS.indexOf('\n    },', i) + '\n    }'.length); })();
/** A seam lifted over stubs for the names it reads. @param {string} src @param {Record<string, any>} names */
const lift = (src, names) => new Function(...Object.keys(names), `return ${src};`)(...Object.values(names));
/** world.js's `travelFree` and `travelWith` over a stub host: `mode` the host's, `enemies` the travel map's refusal. */
function travelHost({ mode = 'exterior', enemies = false, online = false, now = 0 } = {}) {
  const log = [];
  const names = {
    params: { has: (k) => k === 'online' && online },
    livingTravelEnemies: () => enemies,
    townTalk: { say: (x) => log.push(['say', x]) },
    CANNOT_TRAVEL_ENEMIES_TEXT: 'You cannot travel with enemies nearby.',
    _mode: () => mode,
    modes: { forceExitToExterior: () => { log.push(['exit']); mode = 'exterior'; } },
    advanceOwnMinutes: (m) => log.push(['clock', m]),
    skyMinutes: () => now,
    livingPartyAt: partyAt,
    ohTeleportToWorld: (x, z) => { log.push(['teleport', x, z, mode]); return { catch: (f) => log.push(['caught', typeof f]) }; },
  };
  return { travelWith: lift(TRAVEL_WITH, names), travelFree: lift(depOf('travelFree'), names), log };
}

/** A merchant's armed caravan of the lives' map (the host's own composition, its real `fate`), with no trouble, the
 *  noon it was read at and a minute it walks out. */
function livingCaravan(map) {
  const o = O();
  for (let day = 20; day < 80; day++) for (const tw of map.towns) for (const tr of townTrips(tw, day * DAY_MIN + 720, map.world, o) ?? []) {
    if (tr.kind !== 'merchant' || tr.party.length < 2 || !tr.party.some((m) => m.cls != null) || tr.enc) continue;
    try { return { trip: tr, town: tw, noon: day * DAY_MIN + 720, t: walkingOut(tr) }; } catch { /* never walking: the next */ }
  }
  return null;
}
/** A traveller's turn key at their trip's cycle - their place, as the host keys a hand death (world.js livingTripPlace). */
const keyOn = (map, res, trip) => {
  const roster = map.world.rosterOf(map.byId.get(res.town));
  const place = roster.find((r) => r.slot === res.slot) ?? res;
  return turnKey(place, placeCycle(place, roster, Math.floor(trip.outT0 / DAY_MIN), 1));
};
/** The same trip minted again over the character's turns - its hand deaths laid on by the map's `fate`. */
const remint = (turns, got) => { const m = livingMap({ turns }); return (townTrips(m.byId.get(got.town.mapId), got.noon, m.world, O()) ?? []).find((x) => x.id === got.trip.id); };

/** A caravan a band robs on its way out - the trouble's own encounter over a band's hold-up (the host's `bandAt`, in
 *  outlaws.js bandTrouble's shape), the trip as troubledTrip leaves it. */
function bandRobbed() {
  const band = { band: { key: 'O17.0~0', name: 'the Black Hand' }, foes: Array(6).fill(144), level: 30 };
  for (const tr of caravans().trips) {
    if (tr.party.length < 2) continue;
    const enc = troubleOf(tr, { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10), bandAt: () => band });
    if (enc?.kind === 'robbed' && enc.leg === 'out') return troubledTrip(tr, enc);
  }
  return null;
}

test('AUDIT LW-II-2 C1: the hold-up of the trip as the host mints it - its guards\' hand deaths laid on by the real fate (trips.js handsOn): cut down by the player\'s own hand, it yields and the step writes its robbery; the same guards dead beside the player never (mutants: the hand\'s dead, the road\'s fallen)', () => {
  const base = livingMap();
  const got = livingCaravan(base);
  assert.ok(got, 'an armed caravan of the lives\' map');
  const { trip, t } = got;
  const armed = trip.party.filter((m) => m.cls != null);
  const at = partyAt(trip, t);
  // the player cut its guards down a minute ago: the character's own `slain` turns, at their places and the trip's cycle
  const slain = new Map(armed.map((m) => [keyOn(base, m, trip), { t: t - 1, seen: true, who: m.name }]));
  const minted = remint({ slain }, got);
  assert.deepEqual(minted.fallen.map((f) => [f.res.id, f.t, f.hand]), armed.map((m) => [m.id, t - 1, true]), 'the host\'s fate lays the hand deaths on the trip it mints');
  assert.equal(membersAt(minted, t).some((m) => m.cls != null), false, 'no armed among the members left');
  const down = (m) => (slain.get(keyOn(base, m, trip))?.t ?? Infinity) <= t;
  assert.equal(yields(minted, t, down), true, 'its armed beaten by the player\'s own hand: it yields');
  assert.equal(yields(minted, t), false, 'none of them the player\'s: nothing beaten');
  // through the host: the step writes the robbery
  const h = hostOver(minted, { now: t, here: { x: at.x, z: at.z }, slain: new Map(armed.map((m) => [m.id, t - 1])) });
  h.host.step();
  assert.equal(h.rel.wares(minted.id)?.robbed, t, 'its robbery the character\'s');
  assert.equal(h.log.said.at(-1), CARAVAN_LINES.yield(first(minted.leader.name)));
  // AUDIT LW-II C4's law kept: the same guards died fighting beside the player (`died`, a hand death too - never the
  // player's own): nobody beaten
  const died = new Map(armed.map((m) => [keyOn(base, m, trip), { t: t - 1, seen: false, who: m.name }]));
  const fell = remint({ died }, got);
  assert.ok(fell.fallen.length === armed.length && fell.fallen.every((f) => f.hand), 'their hand deaths on it');
  const d = hostOver(fell, { now: t, here: { x: at.x, z: at.z }, dead: new Set(armed.map((m) => m.id)) });
  d.host.step();
  assert.equal(d.rel.wares(fell.id), null, 'died beside the player: no hold-up');
  // and the road's own fallen are no one's beating (AUDIT LW-II C4)
  const road = { ...trip, fallen: armed.map((m) => ({ res: m, t: t - 100, s: 0 })) };
  assert.equal(yields(road, t, () => true), false, 'its guards the road\'s: nothing to beat');
});

test('AUDIT LW-II-2 C2: an escort who robs the caravan, or strikes one of its people down, after the hire is paid nothing - the contract ends there, in the file\'s words; one struck down before the hire is none of the contract\'s (mutants: the robbery, the slaying, the hire\'s minute)', () => {
  // two armed: one struck down, the other stands - no hold-up, the slaying alone
  const trip = caravans().trips.find((tr) => tr.party.filter((m) => m.cls != null).length >= 2 && !tr.enc);
  const t = walkingOut(trip);
  const guard = trip.party.find((m) => m.cls != null);
  const name = first(trip.leader.name);
  let clock;
  const near = () => { const at = partyAt(trip, clock.t); return at.x == null ? null : { x: at.x, z: at.z }; };
  const walk = (h, from, to) => { for (let x = from; x <= to; x += 10) { h.clock.t = x; h.host.step(); } };
  // hired at the door before it sets out, walked beside it - then one of its guards struck down by the player
  const slain = new Map();
  const a = hostOver(trip, { now: trip.outT0 - 30, here: () => near(), slain, level: 7 });
  clock = a.clock;
  a.host.offers({ living: { res: trip.leader } }, () => {});
  a.log.choices.at(-1).options.find((o) => o.code === 'KeyH').action();
  walk(a, Math.ceil(trip.outT0), t - 10);
  assert.ok(a.rel.escort(), 'kept beside it');
  slain.set(guard.id, t);
  clock.t = t;
  a.host.step();
  assert.deepEqual([a.rel.escort(), a.log.said.at(-1), a.rel.wares(trip.id)], [null, CARAVAN_LINES.betrayed(name), null], 'the contract ends there (no hold-up: its other guard stands)');
  walk(a, t, trip.outT1 + 10);
  assert.deepEqual(a.log.paid, [], 'nothing at the town');
  assert.equal(CARAVAN_LINES.betrayed('Ada'), 'Ada hired you to keep the caravan, not to turn on it. There is no pay.');
  // robbed by the character after the hire (its record, as the hold-up writes it): ended unpaid
  const b = hostOver(trip, { now: t, here: () => near() });
  clock = b.clock;
  hire(b, trip, t - 100);
  b.host.step();
  assert.ok(b.rel.escort());
  b.rel.setWares(trip.id, [], 0, t - 50);
  clock.t = t + 10;
  b.host.step();
  assert.deepEqual([b.rel.escort(), b.log.said.at(-1)], [null, CARAVAN_LINES.betrayed(name)]);
  // a guard struck down BEFORE the hire is none of the contract's: walked to the town beside it, paid
  const c = hostOver(trip, { now: t, here: () => near(), slain: new Map([[guard.id, t - 300]]) });
  clock = c.clock;
  hire(c, trip, t - 200);
  c.rel.setEscort({ ...c.rel.escort(), near: t });
  walk(c, t, trip.outT1 - 1);
  clock.t = trip.outT1;
  c.host.step();
  assert.deepEqual(c.log.paid, [99], 'paid at the town');
});

test('AUDIT LW-II-2 C3: a stack partly taken from a counter is recorded with what is left - an add-only [place, count] among its gone, read back (the old form too) - and the next session shelves the part left; a snapshot right after a take names the piece, the save writing the session\'s shelves first (mutants: the part, the read, the write, the shelf, the flush, the save\'s flush)', () => {
  const raw = armedCaravan();
  const t = walkingOut(raw);
  const trip = handsOn(raw, (m) => (m.cls != null ? t - 1 : null));   // its guards' hand deaths on it, as the host mints it
  const at = partyAt(trip, t);
  const slain = new Map(raw.party.filter((m) => m.cls != null).map((m) => [m.id, t - 1]));
  const stock = (counter, tr) => stockShopShelf({ buildingType: counter.buildingType, quality: counter.quality }, { level: 5 }, { rolls: lwRng(textSeed(tr.id), 0x77617265) });   // the host's own roll (world.js `stock`)
  const h = hostOver(trip, { now: t, here: { x: at.x, z: at.z }, stock, slain });
  h.host.step();   // it yields
  h.host.offers({ living: { res: trip.leader } }, () => {});
  h.log.choices.at(-1).options.find((o) => o.code === 'KeyT').action();
  const loot = h.log.loot.at(-1).items;
  const stack = loot.find((it) => (it.stackCount ?? 1) > 2 && it[WARE_KEY] != null);
  assert.ok(stack, 'a stack on the counter\'s roll');
  const place = stack[WARE_KEY], n0 = stack.stackCount;
  const pack = [];
  applyTransfer(stack, { ok: true, amount: n0 - 1 }, loot, pack, { rolls: () => 0.5 });   // the loot window's take of all but one
  assert.deepEqual([pack[0]?.stackCount, stack.stackCount, loot.includes(stack)], [n0 - 1, 1, true], 'one left on the shelf');
  h.host.step();
  const snap = JSON.parse(JSON.stringify(h.rel.snapshot()));
  assert.deepEqual(snap.road.wares, [[trip.id, [[place, 1]], counterOf(trip).purse, t]], 'the part left, by its place');
  const loaded = createRelations(snap);
  assert.deepEqual([[...loaded.wares(trip.id).gone], [...loaded.wares(trip.id).left]], [[], [[place, 1]]]);
  const next = hostOver(trip, { now: t + 1, rel: loaded, stock });
  const again = next.host.shelfOf(trip).items.find((it) => it[WARE_KEY] === place);
  assert.equal(again?.stackCount, 1, 'the next session shelves the part left, never the whole stack');
  next.host.step();
  assert.deepEqual(loaded.snapshot().road.wares, snap.road.wares, 'and writes it back as it was');
  // a part of a stack bought at the counter (the how-many box: one off it), the deal done - written with the deal
  const buy = hostOver(raw, { now: t, stock });
  buy.host.offers({ living: { res: raw.leader } }, () => {});
  buy.log.choices.at(-1).options.find((o) => o.code === 'KeyB').action();
  const o = buy.log.trades[0];
  const ware = o.shelf.items.find((it) => it[WARE_KEY] === place);
  const basket = [];
  applyTransfer(ware, { ok: true, amount: 1 }, o.shelf.items, basket, { rolls: () => 0.5 });
  o.done('Buy', basket, 1);
  assert.deepEqual(buy.rel.wares(raw.id) && [...buy.rel.wares(raw.id).left], [[place, n0 - 1]], 'the deal\'s record names the part left');
  buy.host.step();
  assert.deepEqual(buy.rel.snapshot().road.wares, [[raw.id, [[place, n0 - 1]], 0]]);
  // the record's forms: the old (places alone) read and written as it was; a malformed part dropped; whole before parts
  const old = createRelations({ v: 1, people: {}, road: { wares: [['L1.t1:1', [6, [4, 3], 2, [5, 0], [7, 2.5], [1001, 1], 'x'], 10]] } });
  assert.deepEqual([[...old.wares('L1.t1:1').gone], [...old.wares('L1.t1:1').left]], [[6, 2], [[4, 3]]]);
  assert.deepEqual(old.snapshot().road.wares, [['L1.t1:1', [2, 6, [4, 3]], 10]]);
  assert.deepEqual(createRelations({ v: 1, people: {}, road: { wares: [['L1.t1:1', [5, 2], 10]] } }).snapshot().road.wares, [['L1.t1:1', [2, 5], 10]], 'an older save\'s record as it was');
  const w = createRelations();
  w.setWares('L1.t2:1', [3, [1, 4], [0, 2]], 5);
  assert.deepEqual(w.snapshot().road.wares, [['L1.t2:1', [3, [0, 2], [1, 4]], 5]]);
  // a snapshot right after a take, no step between: the host's flush writes the session's shelves (the save's)
  const f = hostOver(trip, { now: t, here: { x: at.x, z: at.z }, slain });
  f.host.step();
  f.host.offers({ living: { res: trip.leader } }, () => {});
  f.log.choices.at(-1).options.find((o) => o.code === 'KeyT').action();
  const items = f.log.loot.at(-1).items;
  const lamp = items.find((it) => it.name === 'Lamp');
  items.splice(items.indexOf(lamp), 1);
  assert.deepEqual(f.rel.snapshot().road.wares[0][1], [], 'before: the step has not run');
  f.host.flush();
  assert.deepEqual(f.rel.snapshot().road.wares[0][1], [lamp[WARE_KEY]], 'the save names the piece');
  // world.js: the character's save flushes the caravan host first, then snapshots (none made: the snapshot alone)
  const save = /registerModSaveData\(LIVING_WORLD_VENDOR, \{\n {4}newSaveData: \(\) => null,\n(?: {4}\/\/[^\n]*\n)* {4}getSaveData: (\(\) => \{ _caravanHost\?\.flush\(\); return livingRelations\.snapshot\(\); \}),\n/.exec(WORLD);
  assert.ok(save, 'the save\'s getSaveData flushes the shelves');
  const calls = [];
  assert.deepEqual(lift(save[1], { _caravanHost: { flush: () => calls.push('flush') }, livingRelations: { snapshot: () => { calls.push('snapshot'); return 'snap'; } } })(), 'snap');
  assert.deepEqual(calls, ['flush', 'snapshot']);
  assert.equal(lift(save[1], { _caravanHost: null, livingRelations: { snapshot: () => 'snap' } })(), 'snap');
});

test('AUDIT LW-II-2 C6/H1: travel on with them only where a journey may go - the door offers R only when the host says a journey may go (outdoors, no enemy, duel or hostile ship near: the travel map\'s own refusals); world.js\'s travelWith refuses with enemies near in the map\'s words, goes out to the open world first were it reached inside, and catches its teleport (mutants: the door\'s gate, the host\'s gate, the refusal, the exit, the catch)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const door = (free) => { const h = hostOver(trip, { now: t, travelFree: free }); hire(h, trip, t); h.host.offers({ living: { res: trip.leader } }, () => {}); return codes(h.log); };
  assert.ok(door(true).includes('KeyR'), 'outdoors, nothing near: R');
  assert.ok(!door(false).includes('KeyR'), 'indoors (a lodged party at an inn), or enemies near: no R');
  // world.js's gate: outdoors and the travel map's refusal - the very expression the map's door asks
  const enemies = 'duelEnemyNear() || areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes]) || navalHostileNear()';
  assert.ok(WORLD.includes(`const livingTravelEnemies = () => ${enemies};`), 'the travel map\'s refusal');
  assert.ok(WORLD.includes(`    if (${enemies}) {   // NAV-H: a hostile ship in reach too\n      townTalk.say(CANNOT_TRAVEL_ENEMIES_TEXT);`), 'as the map\'s door asks it');
  assert.equal(travelHost().travelFree(), true);
  assert.equal(travelHost({ mode: 'interior' }).travelFree(), false, 'indoors');
  assert.equal(travelHost({ mode: 'dungeon' }).travelFree(), false, 'below');
  assert.equal(travelHost({ enemies: true }).travelFree(), false, 'enemies near');
  // world.js's journey: refused with enemies near, the map's words, the clock unmoved
  const until = t + 30;
  const foes = travelHost({ enemies: true, now: t });
  assert.equal(foes.travelWith(trip, until), false);
  assert.deepEqual(foes.log, [['say', 'You cannot travel with enemies nearby.']]);
  assert.equal(travelHost({ online: true, now: t }).travelWith(trip, until), false, 'online the clock is everyone\'s');
  // outdoors: the clock moved, the player set down beside the party, the teleport's failure caught
  const out = travelHost({ now: t });
  assert.equal(out.travelWith(trip, until), true);
  const at = partyAt(trip, until);
  assert.deepEqual(out.log, [['clock', 30], ['teleport', at.x + 120, at.z, 'exterior'], ['caught', 'function']]);
  // reached inside all the same: out to the open world first, then the teleport
  const inside = travelHost({ mode: 'interior', now: t });
  assert.equal(inside.travelWith(trip, until), true);
  assert.deepEqual(inside.log.map((e) => e[0]), ['exit', 'clock', 'teleport', 'caught']);
  assert.equal(inside.log[2][3], 'exterior', 'the teleport from the open world');
});

test('AUDIT LW-II-2 C7: travelled on with them to its town, the player is set down where the party last walked - a minute short of the town, never left on the empty road (the party has no place at its town: `stay`); a stop on the road sets them beside it (mutants: the last minute)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  assert.equal(partyAt(trip, trip.outT1).x, undefined, 'in its town the party stands nowhere');
  const last = partyAt(trip, trip.outT1 - 1);
  assert.ok(last.x != null, 'a minute short of it, on its road');
  const town = travelHost({ now: t });
  assert.equal(town.travelWith(trip, trip.outT1), true);
  assert.deepEqual(town.log.find((e) => e[0] === 'teleport'), ['teleport', last.x + 120, last.z, 'exterior']);
  const road = travelHost({ now: t });
  road.travelWith(trip, t + 60);
  const by = partyAt(trip, t + 60);
  assert.deepEqual(road.log.find((e) => e[0] === 'teleport'), ['teleport', by.x + 120, by.z, 'exterior'], 'a stop on the road: beside the party there');
});

test('AUDIT LW-II-2 C8: a witnessed murder outlives forty reports nobody lives to carry - the book full, a void one leaves first; a report whose every witness is dead now is dropped at the step (a hand\'s death is for good); the one struck down never witnesses their own murder (mutants: the eviction, the host\'s word, the drop, the victim)', () => {
  const trips = [];
  for (const tr of caravans().trips) if (tr.party.length >= 2 && !trips.some((x) => x.party.some((m) => tr.party.some((n) => n.id === m.id)))) trips.push(tr);
  const [A, B1, B2] = trips;
  assert.ok(B2, 'three caravans, no traveller in two');
  const [tA, t1, t2] = [A, B1, B2].map(walkingOut);
  const dead = new Set();
  const h = hostOver(A, { now: tA, dead, trips: [A, B1, B2] });
  // the victim struck down, the lives' book of places a frame late (not yet dead to the host): no witness of it
  const victim = A.party.find((m) => m.id !== A.leader.id);
  assert.equal(h.host.slain(victim, tA), true);
  const murder = h.rel.reports()[0];
  assert.equal(murder.crime, CRIMES.Murder);
  assert.ok(!murder.witnesses.includes(victim.id) && murder.witnesses.length > 0, 'the victim carries nothing; the rest do');
  dead.add(victim.id);
  // twenty purses picked in one party, every one of it then cut down: twenty reports nobody lives to carry
  for (let i = 0; i < 20; i++) assert.equal(h.host.caught(B1.leader, t1), true);
  for (const m of B1.party) dead.add(m.id);
  // twenty more in another, past REPORTS_MAX: a void one leaves the book, never the witnessed murder
  for (let i = 0; i < 20; i++) h.host.caught(B2.leader, t2);
  assert.equal(h.rel.reports().length, REPORTS_MAX);
  assert.ok(h.rel.reports().includes(murder), 'the witnessed murder kept');
  assert.equal(h.rel.reports().filter((r) => r.trip === B1.id).length, 19, 'a void one out');
  // the step, before any town: the reports whose every witness is dead now are dropped
  h.clock.t = Math.min(...h.rel.reports().map((r) => r.at)) - 1;
  h.host.step();
  assert.deepEqual([h.rel.reports().filter((r) => r.trip === B1.id).length, h.rel.reports().filter((r) => r.trip === B2.id).length], [0, 20], 'void now: dropped; witnessed: kept');
  assert.deepEqual(h.log.charged, [], 'nothing charged before a town');
  // the murder carried in: charged
  h.clock.t = murder.at;
  h.host.step();
  assert.deepEqual(h.log.charged.filter(([, c]) => c === CRIMES.Murder), [[17, CRIMES.Murder]]);
  // the book's own law, with no word of the host's: the oldest first, as before
  const r = createRelations();
  for (let i = 0; i < REPORTS_MAX + 1; i++) r.report({ crime: CRIMES.Theft, region: 1, at: i, witnesses: ['x'] });
  assert.equal(r.reports()[0].at, 1);
  const v = createRelations();
  for (let i = 0; i < REPORTS_MAX + 1; i++) v.report({ crime: CRIMES.Theft, region: 1, at: i, witnesses: [i === 7 ? 'gone' : 'x'] }, (rep) => rep.witnesses[0] === 'gone');
  assert.deepEqual([v.reports()[0].at, v.reports().some((x) => x.at === 7)], [0, false], 'the void one out, the oldest kept');
});

test('AUDIT LW-II-2 C9: a caravan a band robbed on its way under the escort still pays it at the town - its people came through - but its merchant says what happened, never "in one piece" (Mac\'s call) (mutants: the robbed word)', () => {
  const trip = bandRobbed();
  assert.ok(trip?.robbed?.by && !trip.turned, 'a caravan the band robs on its way out, walking on');
  let clock;
  const near = () => { const at = partyAt(trip, clock.t); return at.x == null ? null : { x: at.x, z: at.z }; };
  const h = hostOver(trip, { now: trip.outT0 - 30, here: () => near(), level: 7 });
  clock = h.clock;
  h.host.offers({ living: { res: trip.leader } }, () => {});
  h.log.choices.at(-1).options.find((o) => o.code === 'KeyH').action();
  for (let x = Math.ceil(trip.outT0); x < trip.outT1; x += 10) { clock.t = x; h.host.step(); }
  clock.t = trip.outT1;
  h.host.step();
  assert.equal(h.log.paid.length, 1, 'paid');
  assert.equal(h.log.said.at(-1), CARAVAN_LINES.paidRobbed(first(trip.leader.name), h.log.paid[0]));
  assert.equal(CARAVAN_LINES.paidRobbed('Ada', 300), 'Ada: "We\'re in - robbed, but alive. 300 gold, as agreed."');
  assert.doesNotMatch(CARAVAN_LINES.paidRobbed('Ada', 300), /one piece/);
  // one the band never touched: "in one piece", as before
  const whole = armedCaravan();
  let c2;
  const near2 = () => { const at = partyAt(whole, c2.t); return at.x == null ? null : { x: at.x, z: at.z }; };
  const w = hostOver(whole, { now: whole.outT0 - 30, here: () => near2() });
  c2 = w.clock;
  hire(w, whole, whole.outT0 - 30);
  for (let x = Math.ceil(whole.outT0); x < whole.outT1; x += 10) { c2.t = x; w.host.step(); }
  c2.t = whole.outT1;
  w.host.step();
  assert.equal(w.log.said.at(-1), CARAVAN_LINES.paid(first(whole.leader.name), 99));
});

test('AUDIT LW-II-2 C10: a sale the counter refused (the road counter\'s purse spent) is no deal in either skin - the staging cleared, no coin clinks and no letter of credit is told; a deal done clinks and tells it as before (mutants: the classic return, the enhanced return)', () => {
  const ware = () => stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 10 }, {}, { rolls: () => 0, torchesFromItems: false }).find((it) => it.group === 'Weapons');
  const hooksFor = (pack, refuse) => ({
    mode: 'Sell', shelfItems: () => [], packItems: () => pack, entity: { items: pack }, accepts: () => true, enchanted: () => false,
    priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 0,
    rows: (id) => [{ text: `#${id}`, center: true }],
    weight: () => ({ carriedWeightKg: 100, maxEncumbranceKg: 100 }),   // at the limit: a sale's coin is a letter of credit
    // worldModes.js's road commit: a refused sale's goods back in the pack, and false
    commit: (m, staged) => { if (refuse) { pack.push(...staged); return false; } return true; },
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  });
  const deal = [SOUND.GoldPieces, SOUND.ParchmentScratching];
  const played = [];
  const was = audio.playOneShot;
  audio.playOneShot = (clip) => { played.push(clip); };
  try {
    for (const refuse of [true, false]) {
      // the classic skin: its own confirm (ConfirmTrade's Yes arm)
      played.length = 0;
      const pack = [];
      const w = new NativeTradeWindow(hooksFor(pack, refuse));
      w.staged.push(ware());
      w._confirm(250);
      if (refuse) assert.deepEqual([w.box, played.filter((c) => deal.includes(c)), w.staged.length, pack.length, w.lastPrice], [null, [], 0, 1, null], 'classic: refused');
      else assert.deepEqual([w.box?.rows?.[0]?.text, played, w.staged.length], ['You are paid with a letter of credit.', [SOUND.ParchmentScratching], 0], 'classic: done');
      // the enhanced skin: the row, the stage, the mode action, Yes
      withDom((dom) => {
        played.length = 0;
        const bag = [ware()];
        const host = dom.mk('div');
        dom.body.append(host);
        const view = mountEnhancedTrade(host, hooksFor(bag, refuse));
        try {
          const find = (sel, text) => host.querySelectorAll(sel).find((n) => n.textContent === text) ?? null;
          host.querySelectorAll('.itemrow').find((r) => r.querySelector('.itemname')?.children?.[0]?.textContent === bag[0].name).onclick({ timeStamp: 1000 });
          find('.act.primary', 'Sell').onclick();   // staged
          assert.equal(bag.length, 0, 'staged out of the pack');
          find('.act.primary', 'Sell').onclick();   // the mode action: the offer
          find('.act.primary', 'Yes').onclick();
          const texts = [];
          const walk = (n) => { texts.push(n.textContent); for (const c of n.children) walk(c); };
          walk(host);
          const letter = texts.includes('You are paid with a letter of credit.');
          if (refuse) assert.deepEqual([played.filter((c) => deal.includes(c)), letter, bag.length], [[], false, 1], 'enhanced: refused');
          else assert.deepEqual([played.filter((c) => deal.includes(c)), letter], [[SOUND.ParchmentScratching], true], 'enhanced: done');
        } finally { view.unmount(); }
      });
    }
  } finally { audio.playOneShot = was; }
});

test('AUDIT LW-II-2 C12: a counter\'s shelf made before a band\'s hold-up loses the band\'s half when it comes - in the session, as the next session shelves it (no two shelves for one caravan) (mutants: the late half)', () => {
  const trip = bandRobbed();
  assert.ok(trip?.robbed, 'a caravan the band robs on its way out');
  const stock = () => ['Rope', 'Lamp', 'Bread', 'Oil', 'Salt', 'Wine'].map((name) => ({ name }));
  const h = hostOver(trip, { now: trip.robbed.t - 60, stock });
  const shelf = h.host.shelfOf(trip);
  assert.deepEqual(shelf.items.map((i) => i.name), ['Rope', 'Lamp', 'Bread', 'Oil', 'Salt', 'Wine'], 'before the hold-up: whole');
  h.clock.t = trip.robbed.t + 1;
  assert.equal(h.host.shelfOf(trip), shelf, 'the one shelf');
  assert.deepEqual(shelf.items.map((i) => i.name), ['Rope', 'Bread', 'Salt'], 'after it: the band\'s half gone from it');
  h.host.step();
  const next = hostOver(trip, { now: trip.robbed.t + 1, rel: createRelations(JSON.parse(JSON.stringify(h.rel.snapshot()))), stock });
  assert.deepEqual(next.host.shelfOf(trip).items.map((i) => i.name), ['Rope', 'Bread', 'Salt'], 'the next session\'s the same');
  assert.equal(h.rel.wares(trip.id), null, 'the band\'s half never the character\'s');
});

test('AUDIT LW-II-2 C15: a failed pickpocket on a road party puts back the crime flag that stood before it - no watch, no crime of its own, and never another crime cleared; in a town it is the crime, as before (mutants: the flag kept, the door\'s clear)', async () => {
  const talker = (living) => {
    const log = { caught: 0, crimes: 0 };
    const playerEntity = { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [], level: 1, crimeCommitted: CRIMES.Murder };
    const tt = createTownTalk({
      renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
      fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
      playerEntity, regionIndex: 0, rolls: () => 0.999, onCrime: () => { log.crimes++; },
      livingTalk: { caught: () => { log.caught++; } },
    });
    return { tt, playerEntity, log, person: { living } };
  };
  setInteractionMode('steal');
  try {
    for (const roadside of [true, false]) {
      const { tt, playerEntity, log, person } = talker({ town: { roadside } });
      await tt.ensureLoaded();
      tt.tryActivate([0, 1, 0], [0, 0, 1], [{ person, pos: [0, 0, 2] }]);
      await new Promise((res) => setTimeout(res, 0));
      assert.equal(log.caught, 1, 'the hand caught');
      if (roadside) assert.deepEqual([playerEntity.crimeCommitted, log.crimes], [CRIMES.Murder, 0], 'on the road: the crime standing before it kept, no watch');
      else assert.deepEqual([playerEntity.crimeCommitted, log.crimes], [CRIMES.Pickpocketing, 1], 'in a town: the crime');
    }
  } finally { setInteractionMode('dialogue'); }
  // world.js's road door clears no flag of its own
  const caught = WORLD.slice(WORLD.indexOf('  const livingRoadCaught = (p) => {'), WORLD.indexOf('\n  };', WORLD.indexOf('  const livingRoadCaught = (p) => {')));
  assert.ok(caught.includes('caravanHostOf().caught(p.living.res, skyMinutes());'), 'the road\'s report');
  assert.ok(!/setCrimeCommitted/.test(caught), 'no flag cleared');
});

test('AUDIT LW-II-2 R9: a deed against a hunter on its way out is carried home - its way out ends in the wild, no town to carry it to; a merchant\'s still to the town it is bound for (mutants: the wild)', () => {
  const hamlet = { mapId: 940, px: 100, py: 100, blocks: 2, type: 1, region: 17, people: 3, name: 'Hamlet', port: false };
  const rosters = new Map();
  const world = {
    townsNear: (px, py, r) => [hamlet].filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r),
    routeOf: () => null, rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    dryAt: () => true,
  };
  const hunter = world.rosterOf(hamlet).find((r) => r.job === 'hunter');
  let trip = null;
  for (let k = 40; k < 60 && !trip; k++) trip = ownTrip(hunter, hamlet, k, world, { mpm: CALENDAR_MPM }) ?? null;
  assert.ok(trip?.wild && trip.to.mapId === -1, 'a hunter\'s trip into the wild');
  const t = walkingOut(trip);
  assert.equal(reportAt(trip, t), trip.backT1, 'carried home');
  // through the host: the hunter struck down on its way out, by a party of one - a hand caught in its purse, reported home
  const h = hostOver(trip, { now: t });
  assert.equal(h.host.caught(trip.leader, t), true);
  assert.equal(h.rel.reports()[0].at, trip.backT1);
  const merchant = armedCaravan();
  assert.equal(reportAt(merchant, walkingOut(merchant)), merchant.outT1, 'a merchant\'s: the town it is bound for');
});

test('AUDIT LW-II-2 P4: the caravan host\'s real deps in world.js - the escort\'s pay reaches the purse, the region read at the deed\'s map pixel, the counter\'s roll seeded by its trip, the escort\'s rate by the player\'s level - and the counter\'s window and a deed\'s report read the region where the party stands (mutants: each wire, the counter\'s region)', () => {
  // the pay: the player's purse
  const paid = [];
  const pe = { level: 9 };
  lift(depOf('pay'), { addGoldPieces: (e, g) => paid.push([e, g]), playerEntity: pe })(250);
  assert.deepEqual(paid, [[pe, 250]], 'the escort\'s pay reaches addGoldPieces');
  // the level: the player's
  assert.equal(lift(depOf('level'), { playerEntity: pe })(), 9);
  assert.equal(lift(depOf('level'), { playerEntity: {} })(), 1, 'none yet: the first');
  // the region: maps' at the native point's map pixel
  const asked = [];
  const regionAt = lift(depOf('regionAt'), { maps: { getRegionIndexAt: (px, py) => { asked.push([px, py]); return 23; } } });
  assert.equal(regionAt(3 * NATIVE_PIXEL + 100, (499 - 7) * NATIVE_PIXEL + 100), 23);
  assert.deepEqual(asked, [[3, 7]], 'the deed\'s map pixel');
  // the counter's roll: the trip's own seed - the same all trip, another trip's its own
  assert.match(depOf('stock'), /^\(counter, trip\) => stockShopShelf\(\{ buildingType: counter\.buildingType, quality: counter\.quality \}, playerEntity, \{ rolls: lwRng\(textSeed\(trip\.id\), 0x77617265\) \}\)$/);
  const stock = lift(depOf('stock'), { stockShopShelf, lwRng, textSeed, playerEntity: { level: 5 } });
  const trip = armedCaravan();
  const counter = counterOf(trip);
  const shelfOf = (tr) => stock(counter, tr).map((it) => `${it.name}x${it.stackCount ?? 1}`);
  assert.deepEqual(shelfOf(trip), shelfOf(trip), 'the same all trip');
  assert.notDeepEqual(shelfOf(trip), shelfOf({ ...trip, id: `${trip.id}x` }), 'another trip, its own');
  // the host over a region that varies by map pixel: the counter's window and a deed's report read it where the party is
  const byPixel = (x, z) => 1 + ((Math.floor(x / NATIVE_PIXEL) + 2 * (499 - Math.floor(z / NATIVE_PIXEL))) % 60);
  const t = walkingOut(trip);
  let t2 = t;
  while (t2 < trip.outT1 && (partyAt(trip, t2).x == null || byPixel(partyAt(trip, t2).x, partyAt(trip, t2).z) === byPixel(partyAt(trip, t).x, partyAt(trip, t).z) || partyAt(trip, t2).fight)) t2 += 10;
  assert.ok(t2 < trip.outT1, 'it walks into another pixel\'s region');
  for (const at of [t, t2]) {
    const h = hostOver(trip, { now: at, regionAt: byPixel });
    const p = partyAt(trip, at);
    h.host.offers({ living: { res: trip.leader } }, () => {});
    h.log.choices.at(-1).options.find((o) => o.code === 'KeyB').action();
    assert.equal(h.log.trades[0].b.regionIndex, byPixel(p.x, p.z), 'the counter\'s region where the party stands');
    h.log.trades[0].caught();
    assert.equal(h.rel.reports()[0].region, byPixel(p.x, p.z), 'the deed\'s region where the party stands');
  }
});

test('AUDIT LW-II-2 P7: travelled on with a hired caravan with trouble ahead, the journey stops a minute short of it (decision 6: "stops at the trouble the trip carries") - before the dusk and the town (mutants: the trouble\'s stop)', () => {
  let trip = null, t = null;
  for (const tr of caravans().trips) {
    const enc = troubleOf(tr, { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10) });
    if (!enc || enc.leg !== 'out' || enc.camp) continue;
    const f = troubledTrip(tr, enc);
    if (f.turned) continue;
    const dusk = Math.floor(enc.t0 / DAY_MIN) * DAY_MIN + WALK_TO_H * 60;
    for (let x = Math.ceil(enc.t0) - 40; x > enc.t0 - 300 && x > f.outT0; x -= 10) {
      const at = partyAt(f, x);
      if (at.phase === 'out' && !at.camp && !at.halt && Math.floor(x / DAY_MIN) === Math.floor(enc.t0 / DAY_MIN) && dusk > enc.t0) { t = x; break; }
    }
    if (t != null) { trip = f; break; }
  }
  assert.ok(trip, 'a hired caravan walking to its trouble that day');
  const h = hostOver(trip, { now: t });
  hire(h, trip, t);
  h.host.offers({ living: { res: trip.leader } }, () => {});
  h.log.choices.at(-1).options.find((o) => o.code === 'KeyR').action();
  assert.equal(h.log.travelled[0], trip.enc.t0 - 1, 'a minute short of its trouble');
  assert.equal(h.rel.escort().near, trip.enc.t0 - 1, 'with them the while');
});
