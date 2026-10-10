// WARDEN1 (2026-10-10, Mac: "So I want to do something extremely funny. Anytime there are too many carts/wagons in a city
// or they are parked on the road for a long time. I want a gaurd to navigate, lift the wagon/horse on top of their sprite
// and yeet it far away"; asked: it lands outside town, fetched or summoned; everyone sees it; ten real minutes on a road;
// four a town, the longest parked first). BY EXECUTION: the wire's law (the park word's town, road and landing; which
// teams the watch throws; the owner's word); THE RELAY keeping the clock - the road's ten minutes thrown at the first
// frame past them, a fifth team in a town throwing the longest parked, the throw fanned and told its owner, the owner
// away told when they re-say the spot, a moved word clearing the mark, a word with no landing never thrown, the alarm
// left to its own duties; the client's law (the stamp, the road share, the landing, the offline clock, the record and the
// save moved); the pool holding a carried team and drawing a thrown one where it landed; the runtime's adoption; the
// show's clock and its allocations; the host's three throws. `06-Systems/Wagon-Warden.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validParkData, parkKeyOf, parkKey, PIXEL_UNITS, WARDEN_ROAD_MS, WARDEN_TOWN_CAP, WARDEN_LAND_REACH, WARDEN_TOWN_MAX,
  wardenVerdicts, wardenDue, validParkYeet, parkSpotOf, parkSameSpot, relaySupportsWarden, WARDEN_RELAY_MIN, POSE_BOUND,
} from '../src/net/wire.js';
import { fakeRooms } from './fakeRoom.mjs';
import {
  WARDEN_TOWN_TYPES, isWardenTown, roadShare, landingOf, strayOf, wardenStamp, validWardenStamp, stampFits, wardenWordOf,
  offlineDue, thrownRecord, thrownTo, WARDEN_LAND_PAST, WARDEN_LAND_SCATTER, WARDEN_ROAD_SHARE, WARDEN_SAME_NATIVES, WARDEN_TEXT,
} from '../src/systems/wagonWarden.js';
import { ROAD_WEIGHT } from '../src/systems/gothwayBoards.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { WAGON_MODE, HORSE_MODE } from '../src/systems/horseCartLaw.js';
import {
  createWardenShows, showTimes, arcPoint, flightSeconds, arcPeak, tumbleTurns, lineOf, WARDEN_APPROACH_MAX, WARDEN_GUARD_SPEED,
  WARDEN_LIFT_S, WARDEN_TURN_S, WARDEN_PAUSE_S, WARDEN_LEAVE_MIN, WARDEN_HEAD,
} from '../src/scenes/wagonWardenShow.js';
import { createWagonWarden, WARDEN_SHOW_REACH } from '../src/scenes/wagonWardenHost.js';
import { GUARD_TEXTURE, PERSON_GUARD_IDLE_RECORD } from '../src/characters/mobilePerson.js';
import { makeWorld } from './hccWorld.mjs';
import { syntheticWagon41214 } from './hccModel.mjs';
import { WAGON_MODEL_ID } from '../src/systems/horseCartLaw.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// a team in map pixel (100, 150): cell world:6,9 (hcc_park.test.js's)
const AX = 100 * PIXEL_UNITS + 1000, AZ = (499 - 150) * PIXEL_UNITS + 1000;
const X = 'world:6,9';
const W = (x = AX, z = AZ) => [2, x, 1, z, 0, 0, 0, 1, 50, 0];
const H = (x = AX + 120, z = AZ) => [x, 1, z, 0, 1, 0];
const CA = 'char-ann-0001';
const LY = [AX + 3000, AZ - 2000];
const framesOf = (ws, t) => ws.sent.filter((f) => f.t === t);
const thrownFans = (ws) => framesOf(ws, 'park').filter((f) => Number.isFinite(f.y));

/** A world on a fake clock (arena4_relay.test.js's). */
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
async function world() {
  const w = fakeRooms();
  const park = (name, ws, data) => { const r = w.room(name); r.room._meterOf(ws).parkBucket = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data })); };
  const join = async (name, id, acct) => { const r = w.room(name); const ws = r.connect(); await r.hello(ws, id, null, acct ? { tokenSub: acct } : {}); return ws; };
  return { w, park, join };
}
const road = (extra = {}) => ({ w: W(), ly: LY, tw: 77, rd: 1, ...extra });

// ─── the wire ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('WARDEN1 wire: the park word carries its landing (within a map pixel of its anchor), and with it its town and its road - none of them without a landing; a relay before world189 drops all three', () => {
  const v = validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: LY, tw: 77, rd: 1 } });
  assert.deepEqual(v.r, { w: W(), ly: LY, tw: 77, rd: 1 });
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), tw: 77, rd: 1 } }).r, { w: W() }, 'no landing: never thrown, so neither the town nor the road rides');
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: [AX + WARDEN_LAND_REACH, AZ], tw: 77 } }).r, { w: W(), ly: [AX + WARDEN_LAND_REACH, AZ], tw: 77 }, 'a pixel off: kept');
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: [AX + WARDEN_LAND_REACH + 1, AZ], tw: 77, rd: 1 } }).r, { w: W() }, 'past a pixel: a landing in another town is no throw of this one');
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: [AX, AZ - WARDEN_LAND_REACH - 1] } }).r, { w: W() });
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: [AX, NaN] } }).r, { w: W() });
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: [AX, AZ, 0] } }).r, { w: W() });
  for (const tw of [-1, 1.5, '77', WARDEN_TOWN_MAX + 1]) assert.equal('tw' in validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: LY, tw } }).r, false, `town ${tw}`);
  assert.equal(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: LY, tw: WARDEN_TOWN_MAX } }).r.tw, WARDEN_TOWN_MAX, 'an unsigned map id');
  assert.equal('rd' in validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ly: LY, rd: 2 } }).r, false, 'the road is 1 or nothing');
  assert.equal(relaySupportsWarden('world188'), false);
  assert.equal(relaySupportsWarden(`world${WARDEN_RELAY_MIN}`), true);
  assert.equal(WARDEN_RELAY_MIN, 189);
});

test('WARDEN1 wire: wardenVerdicts - a road team WARDEN_ROAD_MS after it came to stand (not a moment before); a town past WARDEN_TOWN_CAP throws its longest parked, ties by key; a team already thrown, or one with no landing, neither thrown nor counted; `next` the soonest road team', () => {
  const t0 = 1_000_000;
  const e = (k, since, r = {}) => ({ k, since, r: { w: W(), ly: LY, ...r } });
  assert.deepEqual(wardenVerdicts([e('a', t0, { rd: 1 })], t0 + WARDEN_ROAD_MS - 1), { due: [], next: t0 + WARDEN_ROAD_MS });
  assert.deepEqual(wardenVerdicts([e('a', t0, { rd: 1 })], t0 + WARDEN_ROAD_MS), { due: ['a'], next: null });
  assert.deepEqual(wardenVerdicts([e('a', t0, { rd: 1 }), e('b', t0 + 5, { rd: 1 })], t0), { due: [], next: t0 + WARDEN_ROAD_MS }, 'the soonest');
  assert.deepEqual(wardenVerdicts([{ k: 'a', since: t0, r: { w: W(), rd: 1 } }], t0 + 1e9).due, [], 'no landing (an older client\'s word): never thrown');
  assert.deepEqual(wardenVerdicts([{ ...e('a', t0, { rd: 1 }), y: t0 }], t0 + 1e9), { due: [], next: null }, 'thrown already');
  assert.deepEqual(wardenVerdicts([{ k: 'a', at: t0, r: { w: W(), ly: LY, rd: 1 } }], t0 + WARDEN_ROAD_MS).due, ['a'], 'a record from before `since` ages from when it was said');
  // a town: four stand, the longest parked go first
  const town = [e('k5', t0 + 5, { tw: 7 }), e('k1', t0 + 1, { tw: 7 }), e('k3', t0 + 3, { tw: 7 }), e('k2', t0 + 2, { tw: 7 })];
  assert.deepEqual(wardenVerdicts(town, t0 + 10).due, [], `${WARDEN_TOWN_CAP} stand`);
  assert.deepEqual(wardenVerdicts([...town, e('k4', t0 + 4, { tw: 7 })], t0 + 10).due, ['k1']);
  assert.deepEqual(wardenVerdicts([...town, e('k4', t0 + 4, { tw: 7 }), e('k0', t0 + 9, { tw: 7 })], t0 + 10).due.sort(), ['k1', 'k2']);
  assert.deepEqual(wardenVerdicts([...town, e('kb', t0 + 1, { tw: 7 }), e('ka', t0 + 1, { tw: 7 })], t0 + 10).due.sort(), ['k1', 'ka'], 'ties by key');
  assert.deepEqual(wardenVerdicts([...town, e('k4', t0 + 4, { tw: 8 })], t0 + 10).due, [], 'another town counts its own');
  const far = { k: 'kz', since: t0 - 5, r: { w: W(AX + PIXEL_UNITS), ly: LY, tw: 7 } };
  assert.deepEqual(wardenVerdicts([...town, far], t0 + 10).due, [], 'a word naming the town from another map pixel crowds nobody\'s - nor is it thrown');
  assert.deepEqual(wardenVerdicts([...town, e('k4', t0 + 4, { tw: 7 }), far], t0 + 10).due, ['k1'], 'the town\'s own pixel counts its own');
  assert.deepEqual(wardenVerdicts([...town, { ...e('k0', t0, { tw: 7 }), y: t0 }], t0 + 10).due, [], 'a thrown team stands in no town');
  assert.deepEqual(wardenVerdicts([...town, { k: 'k0', since: t0, r: { w: W(), tw: 7 } }], t0 + 10).due, [], 'nor one with no landing');
  assert.deepEqual(wardenVerdicts([...town, e('k0', t0 + 9, { tw: 7, rd: 1 })], t0 + 9 + WARDEN_ROAD_MS).due, ['k0'], 'a road team thrown (the newest of five) is not counted again: four are left, and none of them goes');
  assert.deepEqual(wardenVerdicts(null, t0), { due: [], next: null });
});

test('WARDEN1 wire: the cell\'s round is due when it has not read its teams since it woke, or past the next road team\'s time; the owner\'s word is a clock, a spot and a landing within a pixel of it; a record\'s spot is its wagon\'s, else its horse\'s', () => {
  assert.equal(wardenDue(undefined, 0), true);
  assert.equal(wardenDue(null, 1e15), false, 'none waits');
  assert.equal(wardenDue(100, 99), false); assert.equal(wardenDue(100, 100), true);
  assert.deepEqual(validParkYeet({ t: 'parkYeet', at: 5, from: [AX, AZ], to: LY }), { at: 5, from: [AX, AZ], to: LY });
  assert.equal(validParkYeet({ at: 5, from: [AX, AZ], to: [AX + WARDEN_LAND_REACH + 1, AZ] }), null);
  assert.equal(validParkYeet({ at: 5, from: [POSE_BOUND + 1, AZ], to: [POSE_BOUND + 1, AZ] }), null);
  assert.equal(validParkYeet({ from: [AX, AZ], to: LY }), null);
  assert.equal(validParkYeet({ at: 5, from: [AX], to: LY }), null);
  assert.deepEqual(parkSpotOf({ w: W(5, 6), h: H(7, 8) }), [5, 6]);
  assert.deepEqual(parkSpotOf({ h: H(7, 8) }), [7, 8]);
  assert.equal(parkSpotOf({}), null);
  assert.equal(parkSameSpot({ w: W(), h: H(), n: 'Bess' }, { w: W(), h: H(), n: 'Bessie' }), true, 'a new name moves nothing');
  assert.equal(parkSameSpot({ w: W() }, { w: W(AX + 1) }), false);
  assert.equal(parkSameSpot({ w: W() }, { w: W(), h: H() }), false, 'a horse come to stand by it is a new team');
  assert.equal(parkSameSpot(null, { w: W() }), false);
});

// ─── the relay ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('WARDEN1 relay: a team on a road ten minutes is thrown at the first frame past them - marked with the cell\'s clock, fanned to the room with where it stood, told its owner\'s socket (where it stood and where it landed); re-said by its owner, told again; moved by its owner, the mark is gone and its clock starts again', async () => {
  await onClock(async ({ now, step }) => {
    const { w, park, join } = await world();
    const ann = await join(X, 'ann1'), bob = await join(X, 'bob1');
    const k = await parkKeyOf('acct-ann1', CA);
    const t0 = now();
    await park(X, ann, { c: CA, a: [AX, AZ], r: road() });
    assert.equal(w.room(X).store.get(parkKey(k)).since, t0, 'when it came to stand there');
    step(WARDEN_ROAD_MS - 1);
    await w.room(X).ping(bob);
    assert.equal(thrownFans(bob).length, 0, 'a moment short');
    step(1);
    await w.room(X).ping(bob);
    const fan = thrownFans(bob);
    assert.equal(fan.length, 1);
    assert.equal(fan[0].y, now()); assert.equal(fan[0].k, k); assert.deepEqual(fan[0].data.ly, LY);
    assert.deepEqual(framesOf(ann, 'parkYeet'), [{ t: 'parkYeet', at: now(), from: [AX, AZ], to: LY }]);
    assert.equal(thrownFans(ann).length, 0, 'the owner is told, never fanned their own');
    assert.equal(w.room(X).store.get(parkKey(k)).y, now());
    await w.room(X).ping(bob);
    assert.equal(thrownFans(bob).length, 1, 'thrown once');
    // the owner's client had not heard (a frame lost): re-saying the spot it was thrown from is answered
    step(1000);
    await park(X, ann, { c: CA, a: [AX, AZ], r: road() });
    assert.equal(framesOf(ann, 'parkYeet').length, 2);
    // a repainted word at the same spot keeps the mark too, and the room hears it still thrown
    await park(X, ann, { c: CA, a: [AX, AZ], r: road({ wl: 2 }) });
    assert.equal(framesOf(ann, 'parkYeet').length, 3);
    assert.equal(thrownFans(bob).at(-1).data.wl, 2);
    // the owner's save moved it to the landing: the mark goes, its clock starts there
    step(1000);
    await park(X, ann, { c: CA, a: LY, r: { w: W(LY[0], LY[1]) } });
    const rec = w.room(X).store.get(parkKey(k));
    assert.equal('y' in rec, false); assert.equal(rec.since, now());
    const last = framesOf(bob, 'park').at(-1);
    assert.equal('y' in last, false); assert.deepEqual(last.data, { w: W(LY[0], LY[1]) });
  });
});

test('WARDEN1 relay: an owner away when the watch throws - a joiner\'s list draws it where it landed (`y`), the throw made before the list is read; the owner, back, is told as they re-say the spot it was thrown from; the ALARM throws nothing (a cell\'s alarm is its other duties\')', async () => {
  await onClock(async ({ now, step }) => {
    const { w, park, join } = await world();
    const ann = await join(X, 'ann1');
    const k = await parkKeyOf('acct-ann1', CA);
    await park(X, ann, { c: CA, a: [AX, AZ], r: road() });
    await w.room(X).drop(ann);
    step(WARDEN_ROAD_MS + 5000);
    await w.room(X).fire();
    assert.equal('y' in w.room(X).store.get(parkKey(k)), false, 'the alarm left it');
    const cid = await join(X, 'cid1');
    const list = framesOf(cid, 'parks')[0].data;
    assert.equal(list.length, 1); assert.equal(list[0].y, now(), 'thrown as the joiner came, and handed thrown');
    const back = await join(X, 'ann2', 'acct-ann1');
    assert.deepEqual(framesOf(back, 'parks')[0].data, [], 'never handed its own');
    assert.equal(framesOf(back, 'parkYeet').length, 0, 'told only as it speaks for the team');
    await park(X, back, { c: CA, a: [AX, AZ], r: road() });
    assert.deepEqual(framesOf(back, 'parkYeet'), [{ t: 'parkYeet', at: list[0].y, from: [AX, AZ], to: LY }], 'told when it was thrown, where from and where to');
  });
});

test('WARDEN1 relay: a woken cell reads its teams at its first frame (a hibernated object forgot its clock); a word with no landing is never thrown; a team that moved restarts its clock, one that only re-said keeps it', async () => {
  await onClock(async ({ now, step }) => {
    const { w, park, join } = await world();
    const ann = await join(X, 'ann1'), bob = await join(X, 'bob1');
    const k = await parkKeyOf('acct-ann1', CA);
    await park(X, ann, { c: CA, a: [AX, AZ], r: { w: W(), h: H(), n: 'Bess', ly: LY, tw: 77, rd: 1 } });
    const t0 = now();
    step(5 * 60 * 1000);
    await park(X, ann, { c: CA, a: [AX, AZ], r: { w: W(), h: H(), n: 'Bessie', ly: LY, tw: 77, rd: 1 } });
    assert.equal(w.room(X).store.get(parkKey(k)).since, t0, 'renamed, not moved: the clock runs on');
    step(5 * 60 * 1000);
    w.room(X).wake();
    await w.room(X).ping(bob);
    assert.equal(thrownFans(bob).length, 1, 'ten minutes after it came, though the object slept between');
    // moved: a new clock
    const { w: w2, park: park2, join: join2 } = await world();
    const a2 = await join2(X, 'ann1'), b2 = await join2(X, 'bob1');
    await park2(X, a2, { c: CA, a: [AX, AZ], r: road() });
    step(5 * 60 * 1000);
    await park2(X, a2, { c: CA, a: [AX + 10, AZ], r: road({ w: W(AX + 10) }) });
    assert.equal(w2.room(X).store.get(parkKey(k)).since, now());
    step(5 * 60 * 1000);
    await w2.room(X).ping(b2);
    assert.equal(thrownFans(b2).length, 0, 'five minutes at its new spot');
    // no landing: never
    const { w: w3, park: park3, join: join3 } = await world();
    const a3 = await join3(X, 'ann1'), b3 = await join3(X, 'bob1');
    await park3(X, a3, { c: CA, a: [AX, AZ], r: { w: W(), tw: 77, rd: 1 } });
    step(10 * WARDEN_ROAD_MS);
    await w3.room(X).ping(b3);
    assert.equal(thrownFans(b3).length, 0);
    assert.equal(w3.room(X).room._wardenAt, null, 'nothing waits');
  });
});

test('WARDEN1 relay: a fifth team in a town throws the longest parked there, at the store - the others stand; a sixth throws the next', async () => {
  await onClock(async ({ step }) => {
    const { w, park, join } = await world();
    const bob = await join(X, 'bob1');
    const owners = [];
    for (let i = 1; i <= WARDEN_TOWN_CAP + 2; i++) {
      const ws = await join(X, `own${i}`);
      owners.push({ ws, k: await parkKeyOf(`acct-own${i}`, CA) });
    }
    for (let i = 0; i < WARDEN_TOWN_CAP; i++) { await park(X, owners[i].ws, { c: CA, a: [AX + i * 100, AZ], r: { w: W(AX + i * 100), ly: LY, tw: 77 } }); step(1000); }
    assert.equal(thrownFans(bob).length, 0, `${WARDEN_TOWN_CAP} stand`);
    await park(X, owners[WARDEN_TOWN_CAP].ws, { c: CA, a: [AX + 900, AZ], r: { w: W(AX + 900), ly: LY, tw: 77 } });
    assert.deepEqual(thrownFans(bob).map((f) => f.k), [owners[0].k], 'the longest parked');
    assert.deepEqual(framesOf(owners[0].ws, 'parkYeet').map((f) => f.from), [[AX, AZ]]);
    for (const o of owners.slice(1, WARDEN_TOWN_CAP + 1)) assert.equal(framesOf(o.ws, 'parkYeet').length, 0);
    step(1000);
    await park(X, owners[WARDEN_TOWN_CAP + 1].ws, { c: CA, a: [AX + 950, AZ], r: { w: W(AX + 950), ly: LY, tw: 77 } });
    assert.deepEqual(thrownFans(bob).map((f) => f.k), [owners[0].k, owners[1].k], 'the next longest - the thrown one is outside town');
    assert.equal(Number.isFinite(w.room(X).store.get(parkKey(owners[1].k)).y), true);
  });
});

test('WARDEN1 relay hosts: the frame\'s door runs the round when it is due; the alarm is its other duties\' alone; a socket speaking for a team is marked (`pk`) so the watch can tell it', () => {
  const s = rd('server/src/index.js');
  assert.match(s, /if \(a\.id && isCellRoom\(a\.key\) && wardenDue\(this\._wardenAt, Date\.now\(\)\)\) await this\._parkWarden\(Date\.now\(\)\);/);
  const alarm = s.slice(s.indexOf('  async alarm() {'), s.indexOf('  /** The alarm\'s duties past the boss rooms\' beats'));
  assert.equal(alarm.includes('_parkWarden'), false, 'the alarm throws nothing');
  assert.match(s, /if \(a\.pk !== k\) \{ a = \{ \.\.\.a, pk: k \}; this\._setAttach\(ws, a\); \}/);
  assert.match(s, /await this\._parkWarden\(now\);   \/\/ WARDEN1: a throw an alarm missed is made before the joiner reads the cell/);
});

// ─── the client's law ───────────────────────────────────────────────────────────────────────────────────────────────

test('WARDEN1 law: the watch keeps a city, a hamlet and a village; a third of the wagon\'s footprint on road cells stands it on the road; a throw lands straight out through the nearest edge, past it, strayed along it but never past its ends', () => {
  assert.deepEqual(WARDEN_TOWN_TYPES, [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
  assert.equal(isWardenTown(LOCATION_TYPES.TownCity), true); assert.equal(isWardenTown(LOCATION_TYPES.HomeFarms), false);
  // a 10 x 10 grid of 1 m cells, a road down the column gx 4
  const weightAt = (gx) => (gx === 4 ? ROAD_WEIGHT : 8);
  assert.equal(roadShare(weightAt, 10, 10, 1, [4.5, 5], [0, 1], [1, 2]), 1 / 3, 'its middle column of samples on the road: a third');
  assert.ok(roadShare(weightAt, 10, 10, 1, [4.5, 5], [0, 1], [1, 2]) >= WARDEN_ROAD_SHARE);
  assert.equal(roadShare(weightAt, 10, 10, 1, [5.5, 5], [0, 1], [1, 2]), 1 / 3, 'its left column');
  assert.ok(roadShare(weightAt, 10, 10, 1, [6.5, 5], [0, 1], [1, 2]) < WARDEN_ROAD_SHARE, 'a wheel off the road is not on it');
  assert.equal(roadShare(weightAt, 10, 10, 1, [2, 5], [0, 1], [0.5, 2]), 0, 'off it');
  assert.equal(roadShare(weightAt, 10, 10, 1, [4.5, 5], [1, 0], [0.4, 0.4]), 1, 'wholly on it');
  assert.equal(roadShare(() => ROAD_WEIGHT, 10, 10, 1, [-5, 5], [0, 1], [1, 1]), 0, 'off the grid stands on no road');
  assert.equal(roadShare((gx, gy) => (gy === 5 ? ROAD_WEIGHT : 8), 10, 10, 1, [5, 5.5], [1, 0], [0.4, 3]), 1, 'turned along x: its length lies along the road at gy 5');
  const R = [0, 0, 100, 200];
  assert.deepEqual(landingOf(R, [10, 100]), [-WARDEN_LAND_PAST, 100], 'west');
  assert.deepEqual(landingOf(R, [95, 100]), [100 + WARDEN_LAND_PAST, 100], 'east');
  assert.deepEqual(landingOf(R, [50, 3]), [50, -WARDEN_LAND_PAST], 'south');
  assert.deepEqual(landingOf(R, [50, 190]), [50, 200 + WARDEN_LAND_PAST], 'north');
  assert.deepEqual(landingOf(R, [50, 50]), [-WARDEN_LAND_PAST, 50], 'a tie goes west');
  assert.deepEqual(landingOf(R, [10, 100], 1), [-WARDEN_LAND_PAST, 100 + WARDEN_LAND_SCATTER]);
  assert.deepEqual(landingOf(R, [3, 195], 1), [-WARDEN_LAND_PAST, 200], 'never past the edge\'s end');
  assert.deepEqual(landingOf(R, [10, 100], 9), [-WARDEN_LAND_PAST, 100 + WARDEN_LAND_SCATTER], 'the stray clamped');
  for (const a of [[0, 0], [AX, AZ], [-5, 7], [2147483647, -2147483648]]) { const s = strayOf(a); assert.ok(s >= -1 && s <= 1, String(s)); assert.equal(strayOf(a), s); }
  assert.notEqual(strayOf([AX, AZ]), strayOf([AX + 1, AZ]));
});

test('WARDEN1 law: the stamp - a town needs a landing, the road a town; read back from a save; fits its anchor exactly; its word within the cell\'s reach; the offline clock the road\'s alone, at ten minutes', () => {
  const s = wardenStamp([AX, AZ], 1000, 77, true, LY);
  assert.deepEqual(s, { a: [AX, AZ], at: 1000, tw: 77, rd: true, ly: LY });
  assert.deepEqual(wardenStamp([AX, AZ], 1000), { a: [AX, AZ], at: 1000, tw: null, rd: false, ly: null }, 'no town: no watch');
  assert.deepEqual(wardenStamp([AX, AZ], 1000, 77, true, null), { a: [AX, AZ], at: 1000, tw: null, rd: false, ly: null }, 'no landing: no town');
  assert.deepEqual(validWardenStamp(JSON.parse(JSON.stringify(s))), s);
  assert.equal(validWardenStamp(null), null); assert.equal(validWardenStamp({ a: [1], at: 0 }), null); assert.equal(validWardenStamp({ a: [1, 2] }), null);
  assert.deepEqual(validWardenStamp({ a: [1, 2], at: 3, tw: 77, rd: 'yes', ly: LY }), { a: [1, 2], at: 3, tw: 77, rd: false, ly: LY });
  assert.equal(stampFits(s, [AX, AZ]), true); assert.equal(stampFits(s, [AX + 1, AZ]), false); assert.equal(stampFits(null, [AX, AZ]), false);
  assert.deepEqual(wardenWordOf(s, [AX, AZ]), { ly: LY, tw: 77, rd: 1 });
  assert.deepEqual(wardenWordOf({ ...s, rd: false }, [AX, AZ]), { ly: LY, tw: 77 });
  assert.equal(wardenWordOf(s, [AX + 1, AZ]), null, 'another wagon\'s stamp');
  assert.equal(wardenWordOf(wardenStamp([AX, AZ], 0), [AX, AZ]), null);
  assert.equal(wardenWordOf({ ...s, ly: [AX + WARDEN_LAND_REACH + 1, AZ] }, [AX, AZ]), null, 'the cell would drop it');
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { w: W(), ...wardenWordOf(s, [AX, AZ]) } }).r, { w: W(), ly: LY, tw: 77, rd: 1 }, 'passes the cell\'s own door');
  assert.equal(offlineDue(s, [AX, AZ], 1000 + WARDEN_ROAD_MS - 1), false);
  assert.equal(offlineDue(s, [AX, AZ], 1000 + WARDEN_ROAD_MS), true);
  assert.equal(offlineDue({ ...s, rd: false }, [AX, AZ], 1e15), false, 'off the road: offline no other team crowds a town');
  assert.equal(offlineDue(s, [AX + 1, AZ], 1e15), false);
  assert.match(WARDEN_TEXT.thrown('Daggerfall'), /out of Daggerfall!/);
  assert.match(WARDEN_TEXT.thrown(''), /out of town!/);
});

test('WARDEN1 law: a thrown record has every part moved by the throw, its heights as said; the save\'s anchor moves the same, only while it is the team thrown', () => {
  const r = { w: W(), h: H(), n: 'Bess', ly: LY, tw: 77 };
  const t = thrownRecord(r);
  const dx = LY[0] - AX, dz = LY[1] - AZ;
  assert.deepEqual(t.w, [2, AX + dx, 1, AZ + dz, 0, 0, 0, 1, 50, 0]);
  assert.deepEqual(t.h, [AX + 120 + dx, 1, AZ + dz, 0, 1, 0]);
  assert.deepEqual(r.w, W(), 'a fresh record');
  assert.deepEqual(thrownRecord({ h: H(), ly: LY }).h, [LY[0], 1, LY[1], 0, 1, 0], 'a lone horse lands where it is thrown');
  const r0 = { w: W() };
  assert.equal(thrownRecord(r0), r0, 'no landing: as it is');
  assert.equal(thrownRecord(null), null);
  assert.deepEqual(thrownTo([AX + 5, AZ], [AX, AZ], LY), [LY[0] + 5, LY[1]]);
  assert.deepEqual(thrownTo([AX + WARDEN_SAME_NATIVES, AZ], [AX, AZ], LY), [LY[0] + WARDEN_SAME_NATIVES, LY[1]]);
  assert.equal(thrownTo([AX + WARDEN_SAME_NATIVES + 1, AZ], [AX, AZ], LY), null, 'driven off since');
});

// ─── the pool ───────────────────────────────────────────────────────────────────────────────────────────────────────

function rt(state, view = {}) {
  return { view: () => ({ state, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, horseTargetLabel: 'Bess' };
}

test('WARDEN1 pool: a thrown kept word stands where it landed (its `y` kept); a held team is drawn nowhere - no frame, no team, no box for the ray; my park word carries the host\'s watch fields', () => {
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, selfId: () => 'me' });
  pool.attach(rt({ Mode: 0 }));
  const toScene = (p) => [p[0] - AX, p[1], p[2] - AZ];
  const kA = 'a'.repeat(24), key = `kept:${kA}`;
  pool.applyKept(X, { k: kA, id: 'p1', name: 'Ann', r: { w: W(), h: H(), ly: LY } }, toScene, 0);
  assert.deepEqual(pool.peers.get(key).wagon.position, [0, 1, 0], 'not thrown: where it stood');
  pool.applyKept(X, { k: kA, id: 'p1', name: 'Ann', r: { w: W(), h: H(), ly: LY }, y: 5 }, toScene, 0);
  assert.deepEqual(pool.peers.get(key).wagon.position, [LY[0] - AX, 1, LY[1] - AZ], 'thrown: where it landed');
  assert.deepEqual(pool.peers.get(key).horse.position, [LY[0] - AX + 120, 1, LY[1] - AZ]);
  assert.equal([...pool.kept.values()][0].y, 5);
  assert.equal(pool.keptOwner(kA), key);
  pool.frame(0.016, [0, 0, 0]);
  assert.ok(pool.drawnFrameOf(key));
  const snap = pool.teamSnapshot(key);
  assert.deepEqual(snap.at, [LY[0] - AX, 1, LY[1] - AZ]); assert.equal(snap.kind, 'cart'); assert.deepEqual(snap.rotation, [0, 0, 0, 1]);
  pool.holdTeam(key, true);
  assert.equal(pool.drawnFrameOf(key), null);
  assert.deepEqual(pool.teamOf(key), []);
  assert.equal(pool.teamSnapshot(key), null);
  assert.equal(pool.targets().some((t) => t.key.includes(kA)), false, 'nobody\'s to press');
  pool.holdTeam(key, false);
  assert.ok(pool.drawnFrameOf(key));
  // my word
  const state = { Mode: WAGON_MODE.Deployed, WorldX: AX, WorldZ: AZ, HorseMode: HORSE_MODE.HitchedToWagon, HorseWorldX: 0, HorseWorldZ: 0, HorseName: 'Bess' };
  const mine = createHorseCartPool({ renderer: null, meshes: null });
  mine.attach(rt(state, { deployed: { isGrounded: true, position: [0, 1, 0], rotation: [0, 0, 0, 1], cargoTier: 50 } }));
  const toWire = (p) => [p[0] + AX, p[1], p[2] + AZ];
  const asked = [];
  mine.setWardenWord((a) => { asked.push(a); return { ly: LY, tw: 77, rd: 1 }; });
  const w = mine.parkWord(toWire);
  assert.deepEqual(asked, [[AX, AZ]], 'asked for my anchor');
  assert.deepEqual({ ly: w.r.ly, tw: w.r.tw, rd: w.r.rd }, { ly: LY, tw: 77, rd: 1 });
  assert.deepEqual(validParkData({ c: CA, ...w }).r.ly, LY);
  mine.setWardenWord(() => null);
  assert.equal('ly' in mine.parkWord(toWire).r, false);
  mine.attach(rt({ ...state, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.LooseStationary, HorseWorldX: AX, HorseWorldZ: AZ }, { horse: { isInteractive: true, position: [0, 1, 0], forward: [0, 0, 1], walk: { walking: false } } }));
  mine.setWardenWord(() => ({ ly: LY, tw: 77 }));
  assert.equal('ly' in (mine.parkWord(toWire).r ?? {}), false, 'a lone horse is no cart');
});

test('WARDEN1 pool: a team the watch carries is no box for the ray - mine nor another\'s - and stands no collider of mine', async () => {
  const renderer = { textures: new Map(), uploadTexture: (a, rec) => `${a}_${rec}`, createMesh: (model) => ({ model }), drawMesh() {}, createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch() {} };
  const gpu = { [WAGON_MODEL_ID]: { id: WAGON_MODEL_ID } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  const meshes = { getGpuMesh: async (id) => gpu[id] ?? null, cpuModels: new Map([[WAGON_MODEL_ID, syntheticWagon41214()]]) };
  const buckets = new Map();
  const collider = { addMesh: (k) => buckets.set(k, 1), removeBucket: (k) => buckets.delete(k), surfaceHit: () => ({ dist: Infinity, key: null, normal: null }), sphereCast: () => ({ dist: Infinity, key: null }) };
  const pool = createHorseCartPool({ renderer, meshes, collider: () => collider, selfId: () => 'me', now: () => 0, fetchFn: async () => ({ ok: false, status: 404 }), log: { error() {}, warn() {}, info() {} } });
  pool.attach(rt({ Mode: WAGON_MODE.Deployed, WorldX: AX, WorldZ: AZ, HorseMode: HORSE_MODE.None }, { deployed: { isGrounded: true, position: [40, 0, 40], rotation: [0, 0, 0, 1], cargoTier: 50 } }));
  pool.partsOf('cart');
  for (let i = 0; i < 8; i++) await tick();
  assert.ok(pool.partsOf('cart'), 'the parts built');
  const kA = 'a'.repeat(24), key = `kept:${kA}`;
  pool.applyKept(X, { k: kA, id: 'p1', name: 'Ann', r: { w: W() } }, (p) => [p[0] - AX, p[1], p[2] - AZ], 0);
  pool.frame(0.016, [0, 1.7, -10]);
  const keys = () => pool.targets().map((t) => t.key);
  assert.ok(keys().includes(`hccPeer:${key}:w`)); assert.ok(keys().some((k) => !k.startsWith('hccPeer:')), 'mine');
  assert.equal(buckets.size, 1, 'my parked wagon stands its box');
  pool.holdTeam(key, true); pool.holdTeam('', true);
  pool.frame(0.016, [0, 1.7, -10]);
  assert.deepEqual(keys(), [], 'neither is pressed');
  assert.equal(buckets.size, 0, 'nor walls me in while it is carried');
  pool.holdTeam(key, false); pool.holdTeam('', false);
  pool.frame(0.016, [0, 1.7, -10]);
  assert.equal(keys().length, 2); assert.equal(buckets.size, 1);
});

test('WARDEN1 hosts: the online plumbing carries `y` and the owner\'s word; world.js plays a throw before the pool moves the record, wires the owner\'s word, stamps off its built towns, frames, draws and ends the show; the runtime adopts a throw', () => {
  const o = rd('src/net/online.js');
  assert.match(o, /\.\.\.\(m\.data && Number\.isFinite\(m\.y\) \? \{ y: m\.y \} : \{\}\)/);
  assert.match(o, /\.\.\.\(Number\.isFinite\(e\.y\) \? \{ y: e\.y \} : \{\}\) \}\)\);/);
  assert.match(o, /const y = isCellRoom\(room\) \? validParkYeet\(m\) : null;\n\s*if \(y\) this\._deliver\('parkYeet', \(\) => this\.onParkYeet\?\.\(room, y\)\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /online\.onPark = \(room, e\) => \{ wagonWarden\?\.keptWord\(room, e\); hcc\.applyKept\(room, e, campToScene, performance\.now\(\)\); \};/);
  assert.match(w, /online\.onParkYeet = \(room, y\) => wagonWarden\?\.onParkYeet\(room, y\);/);
  assert.match(w, /wardenTown: dfLocation && isWardenTown\(dfLocation\.mapTableData\?\.locationType\) \? \(dfLocation\.mapTableData\?\.mapId \?\? 0\) >>> 0 : null,/);
  assert.match(w, /if \(!_loading\) wagonWarden\?\.tick\(\); if \(_mode\(\) === 'exterior'\) wardenShows\?\.frame\(cam\.pos\);/);
  assert.match(w, /if \(_mode\(\) === 'exterior'\) wardenShows\?\.draw\(renderer\);/);
  assert.match(w, /livePersonBatches\.push\(\.\.\.wardenShows\.batches\(\)\)/);
  assert.equal((w.match(/wardenShows\?\.destroyAll\(\);/g) ?? []).length, 2, 'a re-anchor and a load');
  assert.match(w, /hcc\.setWardenWord\(\(a\) => wagonWarden\?\.word\(a\) \?\? null\);/);
  assert.match(w, /registerModSaveData\(WARDEN_VENDOR, \{/);
  assert.match(rd('src/systems/horseCart.js'), /adoptYeet,   \/\/ WARDEN1/);
});

// ─── the runtime ────────────────────────────────────────────────────────────────────────────────────────────────────

test('WARDEN1 runtime: adoptYeet moves the parked wagon by the throw, turned as it stood, its horse in its shafts or standing beside it moved with it; never a wagon driven off since, nor one not parked', () => {
  const { w, rt, step, state } = makeWorld();
  w.yaw = 1.2;   // turned, so a heading lost is seen
  assert.equal(rt.adoptYeet([0, 0], [100, 0]), false, 'nothing parked');
  assert.equal(rt.summonTransport().ok, true);
  step();
  const s = state();
  assert.equal(s.Mode, WAGON_MODE.Deployed);
  const a = [s.WorldX, s.WorldZ], heading = [s.HeadingX, s.HeadingZ], hm = s.HorseMode;
  assert.equal(rt.adoptYeet([a[0] + WARDEN_SAME_NATIVES + 1, a[1]], [a[0] + 9000, a[1]]), false, 'not the team thrown');
  assert.deepEqual([s.WorldX, s.WorldZ], a);
  assert.equal(rt.adoptYeet([a[0] + 7, a[1]], [a[0] + 9007, a[1] - 4000]), true);
  assert.deepEqual([s.WorldX, s.WorldZ], [a[0] + 9000, a[1] - 4000], 'moved by the throw');
  assert.ok(Math.abs(heading[0]) > 0.5, 'the summon faced it the player\'s way');
  assert.deepEqual([s.HeadingX, s.HeadingZ], heading, 'turned as it stood');
  assert.equal(s.HorseMode, hm, 'its horse kept in its shafts');
  // a horse left standing beside it is thrown with it
  s.HorseMode = HORSE_MODE.LooseStationary; s.HorseWorldX = s.WorldX + 200; s.HorseWorldZ = s.WorldZ; s.HorseHeadingX = 1; s.HorseHeadingZ = 0;
  const at = [s.WorldX, s.WorldZ];
  assert.equal(rt.adoptYeet(at, [at[0] - 3000, at[1]]), true);
  assert.deepEqual([s.WorldX, s.HorseWorldX, s.HorseWorldZ], [at[0] - 3000, at[0] - 2800, at[1]]);
  assert.equal(s.HorseMode, HORSE_MODE.LooseStationary);
  assert.deepEqual([s.HorseHeadingX, s.HorseHeadingZ], [1, 0]);
  // driven off: no longer parked
  assert.equal(rt.sendTransportAway().ok, true);
  assert.equal(rt.adoptYeet([s.WorldX, s.WorldZ], [0, 0]), false);
});

// ─── the show ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('WARDEN1 show law: the guard jogs the last WARDEN_APPROACH_MAX seconds of its way, lifts, winds up, throws, stands, walks back as long as it came; the throw\'s flight and rise clamped; it leaves the hands and lands exactly; whole turns', () => {
  const T = showTimes(16, 300);
  assert.equal(T.walkFrom, 0); assert.equal(T.approach, 16 / WARDEN_GUARD_SPEED);
  assert.equal(T.lift, T.approach + WARDEN_LIFT_S); assert.equal(T.turn, T.lift + WARDEN_TURN_S);
  assert.equal(T.fly, flightSeconds(300)); assert.equal(T.land, T.turn + T.fly);
  assert.equal(T.leave, T.land + WARDEN_PAUSE_S); assert.equal(T.gone, T.leave + T.approach);
  const far = showTimes(100, 10);
  assert.equal(far.approach, WARDEN_APPROACH_MAX); assert.equal(far.walkFrom, 100 - WARDEN_APPROACH_MAX * WARDEN_GUARD_SPEED, 'a long way: starts nearer along it');
  assert.equal(showTimes(0, 10).gone - showTimes(0, 10).leave, WARDEN_LEAVE_MIN);
  assert.equal(flightSeconds(1), 1.8); assert.equal(flightSeconds(1e6), 4.5); assert.equal(arcPeak(1), 15); assert.equal(arcPeak(1e6), 90);
  assert.deepEqual(arcPoint([0, 5, 0], [100, 1, 0], 0, 30), [0, 5, 0]);
  assert.deepEqual(arcPoint([0, 5, 0], [100, 1, 0], 1, 30).map((v) => Math.round(v * 1e9) / 1e9), [100, 1, 0]);
  assert.deepEqual(arcPoint([0, 5, 0], [100, 1, 0], 0.5, 30), [50, 33, 0]);
  assert.equal(tumbleTurns(0.1), 1); assert.equal(tumbleTurns(4), 5);
  const line = lineOf([[0, 0], [3, 4], [3, 10]]);
  assert.deepEqual(line.cum, [0, 5, 11]); assert.equal(line.len, 11);
});

/** A renderer that counts its billboards. */
function fakeRenderer() {
  const made = [], gone = [];
  return {
    made, gone, textures: new Set(),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
}
const guardTex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ x: 0, y: 0 }) };
const tick = () => new Promise((r) => setTimeout(r, 0));

test('WARDEN1 show: a throw holds the team under every key it may be drawn under, waits a moment for the guard\'s picture, walks, lifts it over the guard\'s head, throws it to the landing and sets it down there, the guard gone after; every billboard it made is let go; a second throw of one team while the first plays is none', async () => {
  const r = fakeRenderer();
  let clock = 0;
  const held = new Map(), sounds = [];
  const uploads = [];
  const shows = createWardenShows({
    renderer: r, getTexture: async () => guardTex, uploadRecordFrame: (a, rec, f) => uploads.push(`${a}:${rec}#${f}`),
    toScene: (p) => [p[0] / 40, p[1], p[2] / 40], groundAt: () => 0,
    showWagon: () => true, wagonBox: () => [-1, 0, -2, 1, 2, 2], horseArt: () => true,
    hold: (o, on) => held.set(o, on), sound: (w) => sounds.push(w), now: () => clock,
  });
  const snap = { kind: 'cart', look: null, at: [0, 0, 0], rotation: [0, 0, 0, 1], horses: [{ at: [0, 0, 3.1], forward: [0, 0, 1] }] };
  assert.equal(shows.start({ key: 'kept:k', owners: ['p1', 'kept:k'], snap, origin: [0, 0, 0], landing: [40 * 200, 0] }), true);
  assert.equal(shows.start({ key: 'kept:k', owners: ['p1'], snap, origin: [0, 0, 0], landing: [0, 0] }), false, 'one show a team');
  assert.equal(shows.start({ key: 'x', owners: ['x'], snap: null, origin: [0, 0, 0], landing: [0, 0] }), false, 'no wagon, no show');
  assert.deepEqual([...held], [['p1', true], ['kept:k', true]]);
  shows.frame([0, 1.7, -20]);
  assert.equal(shows.state()[0].t, null, 'the clock waits for the guard\'s picture');
  await tick();
  shows.frame([0, 1.7, -20]);
  const st = shows.state()[0];
  assert.equal(st.t, 0); assert.equal(st.guard, true); assert.equal(st.horses, 1);
  const guard = r.made.find((b) => b.archive === GUARD_TEXTURE);
  assert.ok(guard, 'the city guards\' own picture');
  const T = st.times;
  // lifted: over the guard's head
  clock = T.lift - 0.001; shows.frame([0, 1.7, -20]);
  clock = T.lift + WARDEN_TURN_S / 2; shows.frame([0, 1.7, -20]);
  assert.equal(guard.record, `${PERSON_GUARD_IDLE_RECORD}#0`, 'standing to throw');
  assert.ok(shows.state()[0].at[1] >= WARDEN_HEAD - 0.5, `held over the guard's head as it winds up: ${shows.state()[0].at[1]}`);
  clock = T.turn; shows.frame([0, 1.7, -20]);
  const atRelease = shows.state()[0].at;
  assert.ok(atRelease[1] >= WARDEN_HEAD - 0.5, `on the guard's head: ${atRelease[1]}`);
  clock = T.turn + T.fly / 2; shows.frame([0, 1.7, -20]);
  assert.ok(shows.state()[0].at[1] > 15, 'in the air');
  assert.equal(shows.draw(r), 1);
  clock = T.land; shows.frame([0, 1.7, -20]);
  assert.deepEqual([...held], [['p1', false], ['kept:k', false]], 'landed: the pool\'s again');
  assert.equal(shows.state()[0].held, false); assert.equal(shows.draw(r), 0);
  assert.equal(r.gone.filter((b) => b.archive !== GUARD_TEXTURE).length, 1, 'the horse\'s picture let go');
  assert.deepEqual(sounds, ['heave', 'throw', 'land']);
  clock = T.gone; shows.frame([0, 1.7, -20]);
  assert.equal(shows.playing('kept:k'), false);
  assert.equal(r.gone.length, r.made.length, 'EVERY ALLOCATION HAS AN OWNER');
  // a teardown mid-throw sets the team down
  shows.start({ key: 'mine', owners: [''], snap, origin: [0, 0, 0], landing: [4000, 0] });
  await tick(); clock += 1; shows.frame([0, 0, 0]);
  shows.destroyAll();
  assert.equal(held.get(''), false);
  assert.equal(r.gone.length, r.made.length);
  assert.ok(uploads.length > 0);
});

test('WARDEN1 show: a guard\'s picture that never comes plays the throw with no guard, once SHOW_ART_WAIT has passed', async () => {
  let clock = 0;
  const shows = createWardenShows({ renderer: fakeRenderer(), getTexture: () => new Promise(() => {}), toScene: (p) => p, groundAt: () => NaN, now: () => clock });
  shows.start({ key: 'k', owners: ['o'], snap: { kind: 'cart', at: [0, 0, 0], rotation: [0, 0, 0, 1], horses: [] }, origin: [0, 0, 0], landing: [100, 0] });
  shows.frame(null);
  assert.equal(shows.state()[0].t, null);
  clock = 1.5; shows.frame(null);
  assert.equal(shows.state()[0].t, 0);
  assert.equal(shows.state()[0].guard, false);
});

// ─── the host ───────────────────────────────────────────────────────────────────────────────────────────────────────

function hostWorld({ onlineSession = null, town = undefined } = {}) {
  const state = { Mode: WAGON_MODE.Deployed, WorldX: AX, WorldZ: AZ, HeadingX: 0, HeadingZ: 1, HorseMode: HORSE_MODE.HitchedToWagon };
  const adopted = [], started = [], told = [];
  let wall = 1_000_000;
  const runtime = { view: () => ({ state, persistence: true }), adoptYeet: (from, to) => { adopted.push([from, to]); state.WorldX = to[0]; state.WorldZ = to[1]; return true; } };
  const snaps = { '': { kind: 'cart', at: [0, 0, 0], rotation: [0, 0, 0, 1], horses: [] }, p1: { kind: 'cart', at: [5, 0, 5], rotation: [0, 0, 0, 1], horses: [] } };
  const hcc = { parts: { box: [-1, 0, -2, 1, 2, 2] }, teamSnapshot: (o) => snaps[o] ?? null, kept: new Map(), keptOwner: (k) => `kept:${k}` };
  const shows = { start: (o) => { started.push(o); return true; }, playing: () => false };
  // a 10 x 10 town of 1.6 m cells whose frame starts at the scene's (0, 0): a road down gx 3
  const nav = { width: 64, height: 64, weightAt: (gx) => (gx === 3 ? ROAD_WEIGHT : 8) };
  const h = createWagonWarden({
    hcc, runtime: () => runtime, shows, online: () => onlineSession,
    toWire: (p) => [p[0] * 40 + AX, p[1], p[2] * 40 + AZ], toScene: (p) => [(p[0] - AX) / 40, p[1], (p[2] - AZ) / 40],
    townAt: (x, z) => (town === 'here' ? { town: 77, nav, local: [x + 5, z + 50], toScene: (u, v) => [u - 5, v - 50] } : town),
    townName: (id) => (id === 77 ? 'Daggerfall' : ''), wallNow: () => wall, eye: () => [0, 1.7, 0], notify: (l) => told.push(...l),
  });
  return { h, state, adopted, started, told, step: (ms) => { wall += ms; }, set town(t) { town = t; }, hcc };
}

test('WARDEN1 host: my parked wagon is stamped once the ground under it is built - its town, its road, its landing; its word carries it; offline the road\'s ten minutes throw it - my save moved, the throw played, I am told; online the cell alone throws', () => {
  const hw = hostWorld();
  hw.h.tick();
  assert.equal(hw.h.stamp, null, 'its pixel not built: asked again next frame');
  hw.town = null;
  hw.h.tick();
  assert.deepEqual(hw.h.stamp, { a: [AX, AZ], at: 1_000_000, tw: null, rd: false, ly: null }, 'built ground no watch keeps');
  assert.equal(hw.h.word([AX, AZ]), null);
  // the wagon moved into a town, on its road (the town's frame: the scene's x + 5 - gx 3 at x 0)
  hw.state.WorldX = AX + 40;
  hw.town = 'here';
  hw.h.tick();
  const s = hw.h.stamp;
  assert.equal(s.tw, 77); assert.equal(s.rd, true); assert.deepEqual(s.a, [AX + 40, AZ]);
  assert.deepEqual(hw.h.word([AX + 40, AZ]), { ly: s.ly, tw: 77, rd: 1 });
  assert.equal(s.ly[0], Math.round(-WARDEN_LAND_PAST * 40 - 5 * 40 + AX), 'out through the west edge (the nearest), a stray along it');
  assert.deepEqual(hw.h.getSaveData(), s, 'the save keeps it');
  hw.step(WARDEN_ROAD_MS - 1); hw.h.tick();
  assert.equal(hw.adopted.length, 0);
  hw.step(1); hw.h.tick();
  assert.deepEqual(hw.adopted, [[[AX + 40, AZ], s.ly]]);
  assert.equal(hw.started.length, 1); assert.deepEqual(hw.started[0].owners, ['']); assert.deepEqual(hw.started[0].landing, s.ly);
  assert.deepEqual(hw.told, [WARDEN_TEXT.thrown('Daggerfall'), WARDEN_TEXT.fetch]);
  hw.h.tick();
  assert.equal(hw.adopted.length, 1, 'thrown once: the stamp is the old spot\'s');
  // online: the cell decides
  const on = hostWorld({ onlineSession: {}, town: 'here' });
  on.h.tick(); on.step(10 * WARDEN_ROAD_MS); on.h.tick();
  assert.equal(on.adopted.length, 0);
  // a save read back
  on.h.restoreSaveData({ a: [1, 2], at: 3, tw: 9, rd: true, ly: [4, 5] });
  assert.deepEqual(on.h.stamp, { a: [1, 2], at: 3, tw: 9, rd: true, ly: [4, 5] });
  on.h.restoreSaveData(null);
  assert.equal(on.h.stamp, null);
});

test('WARDEN1 host: the cell\'s word to me moves my save and plays the throw from where my wagon was drawn; a word about another\'s team plays its throw once, from its live team else its kept one; a word with no landing, or one said already, plays nothing; far off nothing is played', () => {
  const hw = hostWorld({ onlineSession: {}, town: 'here' });
  assert.equal(hw.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY }), true);
  assert.deepEqual(hw.adopted, [[[AX, AZ], LY]]);
  assert.equal(hw.started[0].key, 'mine'); assert.deepEqual(hw.told.length, 2);
  const kA = 'a'.repeat(24);
  const e = { k: kA, id: 'p1', name: 'Ann', r: { w: W(), ly: LY }, y: 7 };
  assert.equal(hw.h.keptWord(X, e), true);
  assert.deepEqual(hw.started[1].owners, ['p1', `kept:${kA}`]); assert.equal(hw.started[1].key, `kept:${kA}`); assert.deepEqual(hw.started[1].landing, LY);
  hw.hcc.kept.set(`${X}|${kA}`, { k: kA, y: 7 });
  assert.equal(hw.h.keptWord(X, e), false, 'said already');
  assert.equal(hw.h.keptWord(X, { ...e, y: undefined }), false, 'not thrown');
  assert.equal(hw.h.keptWord(X, { ...e, y: 8, r: { w: W() } }), false, 'no landing');
  assert.equal(hw.h.keptWord(X, { ...e, id: 'p9', y: 8 }), false, 'drawn nowhere here');
  assert.equal(WARDEN_SHOW_REACH, 200);
});
