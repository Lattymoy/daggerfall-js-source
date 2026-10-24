// AUDIT WARDEN1 (2026-10-11, Mac: "Audit this" - five cold lanes over PR #753: the relay and the wire's law, the client's
// law, host and save, the show and the pool's hold, the records, the whole play). BY EXECUTION, each finding pinned where
// it broke: one account is one team in a town's crowd (R1); a team's spot is its wagon's, near enough (R2); only a wagon
// carries a landing, measured from the wagon (R3, R5); a failed round is the round's alone (R4); a landing kept in its own
// pixel, else its cell (R6); a thrown caravan's visitor walks in where it landed (R9); a horse is thrown only standing by
// its wagon (C1); the throw lifts the horses it moves (C2); a building's reach let go (C3); the cell's throw taken on the
// street (C4); the mod off throws nothing (C5); a throw of another character's team is not mine (C6); a show ends when its
// team is no longer the one thrown (C7); the carried wagon in its own load, wheels and hitch (C8); the live wagon lifted
// only on the spot thrown from, the hold counted (C9); a rider stood down (C10); the team set down before the pool's step
// (C11); an idle frame does nothing (C12); a concealed owner's horses concealed (C13); the wagon on the top of the guard's
// picture; and the records the lanes found unpinned (D1-D13). `06-Systems/Wagon-Warden.md` AUDIT WARDEN1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validParkData, parkKeyOf, parkKey, PIXEL_UNITS, WARDEN_ROAD_MS, WARDEN_TOWN_CAP, WARDEN_LAND_REACH, POSE_BOUND, PARK_ACCOUNT_MAX,
  wardenVerdicts, validParkYeet, parkSameSpot, WARDEN_SPOT_NATIVES, WARDEN_RETRY_MS, cellRoomOfWire, mapPixelOfWire, CLOSE_REPLACED,
} from '../../../src/net/wire.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import {
  landingsOf, landingOf, strayOf, thrownRecord, thrownTo, wardenWordOf, wardenStamp, horseThrownWith, WARDEN_HORSE_BY_NATIVES,
  WARDEN_SAME_NATIVES, WARDEN_LAND_PAST, WARDEN_LAND_SCATTER,
} from '../../../src/systems/wagon/wagonWarden.js';
import { ROAD_WEIGHT } from '../../../src/systems/gothwayBoards.js';
import { createHorseCartPool } from '../../../src/scenes/horseCartPool.js';
import { WAGON_MODE, HORSE_MODE, INTERIOR_ACCESS, WAGON_MODEL_ID } from '../../../src/systems/horse/horseCartLaw.js';
import { createWardenShows, WARDEN_HEAD } from '../../../src/scenes/wagon/wagonWardenShow.js';
import { createWagonWarden, wardenTownIn, WARDEN_SHOW_REACH } from '../../../src/scenes/wagon/wagonWardenHost.js';
import { NAV_CELL } from '../../../src/world/city/cityNavigation.js';
import { PERSON_GUARD_IDLE_RECORD } from '../../../src/characters/mobile/mobilePerson.js';
import { mobileBillboardSize } from '../../../src/world/rmbFlats.js';
import { caravanRecordOf, caravanStands } from '../../../src/net/caravanVisitLink.js';
import { createWagonRiders, RIDE_ROW } from '../../../src/scenes/wagon/wagonRiders.js';
import { RIDE_TEXT } from '../../../src/systems/wagon/wagonSeats.js';
import { makeWorld } from '../../hccWorld.mjs';
import { syntheticWagon41214 } from '../../hccModel.mjs';
import { CARGO_DEFINITIONS } from '../../../src/systems/wagon/wagon41214.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const AX = 100 * PIXEL_UNITS + 1000, AZ = (499 - 150) * PIXEL_UNITS + 1000;
const X = 'world:6,9';
const W = (x = AX, z = AZ) => [2, x, 1, z, 0, 0, 0, 1, 50, 0];
const H = (x = AX + 120, z = AZ) => [x, 1, z, 0, 1, 0];
const LY = [AX + 3000, AZ - 2000];
const framesOf = (ws, t) => ws.sent.filter((f) => f.t === t);
const tick = () => new Promise((r) => setTimeout(r, 0));

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

// ─── the relay and the wire ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WARDEN1 R1: ONE ACCOUNT, ONE TEAM A TOWN - an account\'s later teams in a town go before anyone\'s; four made-up characters of one socket throw no other player\'s team (mutants: the account ignored, the extras thrown last)', async () => {
  const t0 = 1_000_000;
  const e = (k, sub, since) => ({ k, sub, since, r: { w: W(), ly: LY, tw: 7 } });
  const honest = [e('h1', 'acct-a', t0 + 1), e('h2', 'acct-b', t0 + 2), e('h3', 'acct-c', t0 + 3)];
  const troll = [e('t1', 'acct-t', t0 + 10), e('t2', 'acct-t', t0 + 11), e('t3', 'acct-t', t0 + 12), e('t4', 'acct-t', t0 + 13)];
  assert.deepEqual(wardenVerdicts([...honest, ...troll], t0 + 20).due.sort(), ['t2', 't3', 't4'], 'the troll\'s own extras, newest though they are');
  const early = [e('t1', 'acct-t', t0 - 4), e('t2', 'acct-t', t0 - 3), e('t3', 'acct-t', t0 - 2), e('t4', 'acct-t', t0 - 1)];
  assert.deepEqual(wardenVerdicts([...honest, ...early], t0 + 20).due.sort(), ['t2', 't3', 't4'], 'oldest though they are: the account keeps its longest parked');
  const five = [...honest, e('h4', 'acct-d', t0 + 4), e('h5', 'acct-e', t0 + 5)];
  assert.deepEqual(wardenVerdicts(five, t0 + 20).due, ['h1'], 'five accounts: the longest parked, as ever');
  // the relay: three players parked, then one socket names four characters
  await onClock(async ({ step }) => {
    const { w, park, join } = await world();
    const ks = [];
    for (const id of ['ann1', 'bob1', 'cid1']) {
      const ws = await join(X, id);
      ks.push(await parkKeyOf(`acct-${id}`, 'char-own-0001'));
      await park(X, ws, { c: 'char-own-0001', a: [AX, AZ], r: { w: W(), ly: LY, tw: 77 } });
      step(1000);
    }
    const troll = await join(X, 'trl1');
    assert.equal(PARK_ACCOUNT_MAX, WARDEN_TOWN_CAP, 'why it mattered: one account stands as many teams as a town holds');
    for (let i = 1; i <= PARK_ACCOUNT_MAX; i++) { await park(X, troll, { c: `char-trl-000${i}`, a: [AX + i * 50, AZ], r: { w: W(AX + i * 50), ly: LY, tw: 77 } }); step(1000); }
    for (const k of ks) assert.equal('y' in w.room(X).store.get(parkKey(k)), false, 'no honest team thrown');
    const trolls = await Promise.all([1, 2, 3, 4].map((i) => parkKeyOf('acct-trl1', `char-trl-000${i}`)));
    assert.deepEqual(trolls.map((k) => Number.isFinite(w.room(X).store.get(parkKey(k))?.y)), [false, true, true, true], 'its own three extras');
  });
});

test('AUDIT WARDEN1 R2: an owner back from away whose first word says no horse yet (its picture not in) and a ground solved again is told of the throw - the mark kept, its clock kept - never the throw undone unheard; a moved team clears it (mutants: the exact match of every part)', async () => {
  await onClock(async ({ now, step }) => {
    const { w, park, join } = await world();
    const ann = await join(X, 'ann1'), bob = await join(X, 'bob1');
    const k = await parkKeyOf('acct-ann1', 'char-ann-0001');
    await park(X, ann, { c: 'char-ann-0001', a: [AX, AZ], r: { w: W(), h: H(), ly: LY, tw: 77, rd: 1 } });
    const since = now();
    await w.room(X).drop(ann);
    step(WARDEN_ROAD_MS);
    await w.room(X).ping(bob);
    const y = w.room(X).store.get(parkKey(k)).y;
    assert.equal(y, now(), 'thrown while she was away');
    step(60_000);
    const back = await join(X, 'ann2', 'acct-ann1');
    const reSolved = W(); reSolved[2] = 1.37;
    await park(X, back, { c: 'char-ann-0001', a: [AX, AZ], r: { w: reSolved, ly: LY, tw: 77, rd: 1 } });
    const rec = w.room(X).store.get(parkKey(k));
    assert.equal(rec.y, y, 'still thrown (a thrown team\'s clock is no road\'s: it starts again where it lands)');
    assert.ok(Number.isFinite(since));
    assert.deepEqual(framesOf(back, 'parkYeet').map((f) => f.at), [y], 'and she is told');
    assert.equal(framesOf(bob, 'park').at(-1).y, y, 'the room hears it still thrown');
    await park(X, back, { c: 'char-ann-0001', a: LY, r: { w: W(LY[0], LY[1]) } });
    assert.equal('y' in w.room(X).store.get(parkKey(k)), false, 'her save moved it: the mark goes');
  });
  assert.equal(parkSameSpot({ w: W() }, { w: W(AX, AZ + WARDEN_SPOT_NATIVES) }), true);
  assert.equal(parkSameSpot({ w: W() }, { w: W(AX, AZ + WARDEN_SPOT_NATIVES + 1) }), false, 'z too');
});

test('AUDIT WARDEN1 R3/R5: a landing rides only with a wagon - a lone horse is no cart, never thrown nor counted; it is measured from the wagon (where the throw is measured from) and bounded by the world (mutants: the horse\'s landing kept, the anchor\'s reach, the world\'s bound dropped)', () => {
  const h = validParkData({ c: 'char-ann-0001', a: [AX, AZ], r: { h: H(), ly: LY, tw: 77, rd: 1 } });
  assert.deepEqual(h.r, { h: [AX + 120, 1, AZ, 0, 1, 0] }, 'the horse alone, no landing');
  assert.deepEqual(wardenVerdicts([{ k: 'h', since: 0, r: { h: H(), ly: LY, tw: 7, rd: 1 } }], 1e12).due, [], 'nor would the cell throw one');
  const town = [1, 2, 3, 4].map((i) => ({ k: `k${i}`, since: i, r: { w: W(), ly: LY, tw: 7 } }));
  assert.deepEqual(wardenVerdicts([...town, { k: 'h0', since: 0, r: { h: H(), ly: LY, tw: 7 } }], 10).due, [], 'nor count it in a town');
  // the wagon stands 8000 natives from its anchor (within PARK_REACH): the landing's reach is the wagon's
  const wx = AX + 8000;
  const kept = validParkData({ c: 'char-ann-0001', a: [AX, AZ], r: { w: W(wx), ly: [wx + WARDEN_LAND_REACH, AZ] } });
  assert.deepEqual(kept.r.ly, [wx + WARDEN_LAND_REACH, AZ], 'a pixel from the wagon');
  assert.equal('ly' in validParkData({ c: 'char-ann-0001', a: [AX, AZ], r: { w: W(wx), ly: [AX - WARDEN_LAND_REACH, AZ] } }).r, false, 'a pixel from the anchor, past one from the wagon');
  assert.equal('ly' in validParkData({ c: 'char-ann-0001', a: [AX, AZ], r: { w: W(wx), ly: [wx, AZ + WARDEN_LAND_REACH + 1] } }).r, false, 'z too');
  const edge = POSE_BOUND - 10;
  assert.equal('ly' in validParkData({ c: 'char-ann-0001', a: [edge, AZ], r: { w: W(edge), ly: [POSE_BOUND + 1, AZ] } }).r, false, 'past the world');
});

test('AUDIT WARDEN1 R4: a round the cell cannot make (its park list refused) is the round\'s alone - the frame is read as ever, the round asked again WARDEN_RETRY_MS on with the list read afresh, and it throws then (mutants: the failure uncaught, the list kept, no retry time)', async () => {
  await onClock(async ({ now, step }) => {
    const { w, park, join } = await world();
    const ann = await join(X, 'ann1'), bob = await join(X, 'bob1');
    const k = await parkKeyOf('acct-ann1', 'char-ann-0001');
    await park(X, ann, { c: 'char-ann-0001', a: [AX, AZ], r: { w: W(), ly: LY, tw: 77, rd: 1 } });
    step(WARDEN_ROAD_MS);
    const room = w.room(X).room;
    room._parks = null;   // a woken object: the list is read again
    const list = room.state.storage.list.bind(room.state.storage);
    let refuse = 1;
    room.state.storage.list = async (o) => { if (refuse-- > 0) throw new Error('storage refused'); return list(o); };
    const warn = console.warn; console.warn = () => {};
    try { await w.room(X).ping(bob); } finally { console.warn = warn; }
    assert.ok(framesOf(bob, 'pong').length >= 1, 'the frame answered');
    assert.equal(room._wardenAt, now() + WARDEN_RETRY_MS);
    assert.equal(room._parks, null, 'the refused list not kept');
    await w.room(X).ping(bob);
    assert.equal('y' in w.room(X).store.get(parkKey(k)), false, 'not before its time');
    step(WARDEN_RETRY_MS);
    await w.room(X).ping(bob);
    assert.equal(w.room(X).store.get(parkKey(k)).y, now(), 'thrown at the retry');
  });
});

test('AUDIT WARDEN1 C6/D8: the cell\'s word to the owner names whose team (`k`), and only the socket that spoke for it hears it - another character\'s socket of the same account does not (mutants: the frame unnamed, every socket of the account told, the re-sayer\'s socket ignored) - ONE-BODY (PIN MOVED): a second tab replaces the first in a place', async () => {
  await onClock(async ({ step }) => {
    const { w, park, join } = await world();
    const a1 = await join(X, 'ann1', 'acct-ann1'), bob = await join(X, 'bob1');
    const k = await parkKeyOf('acct-ann1', 'char-ann-0001');
    await park(X, a1, { c: 'char-ann-0001', a: [AX, AZ], r: { w: W(), ly: LY, tw: 77, rd: 1 } });
    // PIN MOVED (ONE-BODY, FIELD BUGS 2026-10-15c): this stood her two characters' sockets in the cell at once - the first
    // told of its team's throw, the second (her account, another character) not, and the first alone told again as it
    // re-said the spot. A cell stands one body an account now (server/src/index.js the hello's one-socket law): her
    // second tab's hello closes the first (CLOSE_REPLACED). The watch's word is still the socket's that speaks for the
    // team, never the account's: her ONE socket here, speaking for another character, is not told of the throw; a tab
    // back on the thrown character is told, named, as it says the spot again.
    const a2 = await join(X, 'ann2', 'acct-ann1');
    assert.equal(a1.closed?.code, CLOSE_REPLACED, 'a place: her second tab replaces the first');
    await park(X, a2, { c: 'char-ann-0002', a: [AX + 900, AZ], r: { w: W(AX + 900) } });
    step(WARDEN_ROAD_MS);
    await w.room(X).ping(bob);
    assert.ok(Number.isFinite(w.room(X).store.get(parkKey(k)).y), 'her first character\'s team thrown');
    assert.equal(framesOf(a2, 'parkYeet').length, 0, 'her other character\'s socket - her one body here - is not told');
    const a3 = await join(X, 'ann3', 'acct-ann1');   // her first character again, in a tab of its own
    assert.equal(a2.closed?.code, CLOSE_REPLACED);
    await park(X, a3, { c: 'char-ann-0001', a: [AX, AZ], r: { w: W(), ly: LY, tw: 77, rd: 1 } });
    assert.deepEqual(framesOf(a3, 'parkYeet').map((f) => f.k), [k], 're-said: told, and named');
    assert.equal(framesOf(a2, 'parkYeet').length, 0, 'and only the one that re-said it');
  });
  assert.deepEqual(validParkYeet({ at: 1, from: [AX, AZ], to: LY, k: 'b'.repeat(24) }).k, 'b'.repeat(24));
  assert.equal(validParkYeet({ at: 1, from: [AX, AZ], to: LY, k: 'nope' }), null);
  assert.equal(validParkYeet({ at: 1, from: [AX, AZ], to: [AX, AZ + WARDEN_LAND_REACH + 1] }), null, 'z too (D13)');
});

// ─── the client's law ───────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WARDEN1 C1: a horse is thrown with its wagon only standing by it (WARDEN_HORSE_BY_NATIVES - a hitched pair at the Caravan\'s pole included); one ridden off and left at a shop stays - in a reader\'s record and in my save; a lone horse\'s record is no throw (mutants: every horse moved, the reach on one axis)', () => {
  assert.equal(WARDEN_HORSE_BY_NATIVES, 480);
  assert.ok(WARDEN_HORSE_BY_NATIVES / 40 > 7.7 + 1.5, 'past the Caravan\'s 7.7 m hitch and its horse');
  assert.equal(horseThrownWith([0, 0], [WARDEN_HORSE_BY_NATIVES, -WARDEN_HORSE_BY_NATIVES]), true);
  assert.equal(horseThrownWith([0, 0], [WARDEN_HORSE_BY_NATIVES + 1, 0]), false);
  assert.equal(horseThrownWith([0, 0], [0, WARDEN_HORSE_BY_NATIVES + 1]), false);
  const dx = LY[0] - AX, dz = LY[1] - AZ;
  assert.deepEqual(thrownRecord({ w: W(), h: H(AX + 300), ly: LY }).h, [AX + 300 + dx, 1, AZ + dz, 0, 1, 0], 'by it: thrown');
  assert.deepEqual(thrownRecord({ w: W(), h: H(AX + 6000), ly: LY }).h, H(AX + 6000), 'left at a shop: where it stands');
  assert.deepEqual(thrownRecord({ w: W(), h: H(AX, AZ + 6000), ly: LY }).h, H(AX, AZ + 6000));
  // my save: the runtime's own
  const { rt, step, state } = makeWorld();
  assert.equal(rt.summonTransport().ok, true); step();
  const s = state();
  s.HorseMode = HORSE_MODE.LooseStationary; s.HorseWorldX = s.WorldX + 6000; s.HorseWorldZ = s.WorldZ; s.HorseHeadingX = 1; s.HorseHeadingZ = 0;
  const horse = [s.HorseWorldX, s.HorseWorldZ];
  assert.equal(rt.adoptYeet([s.WorldX, s.WorldZ], [s.WorldX - 3000, s.WorldZ]), true);
  assert.deepEqual([s.HorseWorldX, s.HorseWorldZ], horse, 'my horse left at the shop stays there');
  assert.equal(s.HorseMode, HORSE_MODE.LooseStationary);
  s.HorseMode = HORSE_MODE.FollowingPlayer; s.HorseWorldX = s.WorldX + 100;
  const follow = [s.HorseWorldX, s.HorseWorldZ];
  assert.equal(rt.adoptYeet([s.WorldX, s.WorldZ], [s.WorldX - 3000, s.WorldZ]), true);
  assert.deepEqual([s.HorseWorldX, s.HorseWorldZ, s.HorseMode], [...follow, HORSE_MODE.FollowingPlayer], 'nor one following me');
});

test('AUDIT WARDEN1 C3/D11: a throw lets go a building\'s reach to the wagon\'s load (its storage stayed open from the counter); none is adopted with the persistence off (mutants: the reach kept, the persistence ignored)', () => {
  const { rt, step, state } = makeWorld();
  assert.equal(rt.summonTransport().ok, true); step();
  const s = state();
  s.InteriorAccessMode = INTERIOR_ACCESS.Building; s.InteriorAccessId = 7;
  assert.equal(rt.adoptYeet([s.WorldX, s.WorldZ], [s.WorldX - 3000, s.WorldZ]), true);
  assert.deepEqual([s.InteriorAccessMode, s.InteriorAccessId], [INTERIOR_ACCESS.None, 0]);
  const off = makeWorld();
  assert.equal(off.rt.summonTransport().ok, true); off.step();
  off.w.settings.physicalPersistence = false; off.rt.handleSettingsChanged();
  const so = off.state();
  so.Mode = WAGON_MODE.Deployed;
  assert.equal(off.rt.adoptYeet([so.WorldX, so.WorldZ], [so.WorldX - 3000, so.WorldZ]), false, 'nothing kept in the world, nothing thrown');
  assert.deepEqual(thrownTo([AX, AZ + WARDEN_SAME_NATIVES + 1], [AX, AZ], LY), null, 'thrownTo\'s window on z too (D13)');
  assert.equal(wardenWordOf({ ...wardenStamp([AX, AZ], 0, 7, true, LY), ly: [AX, AZ + WARDEN_LAND_REACH + 1] }, [AX, AZ]), null, 'and the word\'s reach (D13)');
});

test('AUDIT WARDEN1 R6: a throw may go out through any edge, the nearest first (ties west, east, south, north); the nearest is landingOf\'s; each strayed along its edge, never past its ends (D12)', () => {
  const R = [0, 0, 100, 200];
  const st = 0.5, s = st * WARDEN_LAND_SCATTER;
  assert.deepEqual(landingsOf(R, [10, 60], st), [[-WARDEN_LAND_PAST, 60 + s], [10 + s, -WARDEN_LAND_PAST], [100 + WARDEN_LAND_PAST, 60 + s], [10 + s, 200 + WARDEN_LAND_PAST]]);
  assert.deepEqual(landingOf(R, [10, 60], st), [-WARDEN_LAND_PAST, 60 + s]);
  assert.deepEqual(landingsOf(R, [50, 50]).slice(0, 2), [[-WARDEN_LAND_PAST, 50], [100 + WARDEN_LAND_PAST, 50]], 'a tie: west, then east');
  assert.deepEqual(landingsOf(R, [50, 198], 1)[0], [50 + WARDEN_LAND_SCATTER, 200 + WARDEN_LAND_PAST], 'along x on a north edge');
  assert.deepEqual(landingsOf(R, [95, 199], 1)[0], [100, 200 + WARDEN_LAND_PAST], 'never past its end');
});

test('AUDIT WARDEN1 R9: a caravan the town watch threw stands, for its visitor, where it landed - one walked in there stays; one inside at the old spot is let out (mutants: the raw record judged)', () => {
  const r = { w: [2, AX, 1, AZ, 0, 0, 0, 1, 0, 0], ly: LY };
  r.w[9] = 0;
  const e = { k: 'a'.repeat(24), r: { ...r, w: [...r.w] }, y: 5 };
  const v = validParkData({ c: 'char-ann-0001', a: [AX, AZ], r: { w: [2, AX, 1, AZ, 0, 0, 0, 1, 0, 0], wk: 2, ly: LY } });   // wk 2: the Caravan (horseCartWire.js)
  e.r = v.r;
  const landed = caravanRecordOf(e);
  assert.deepEqual([landed.w[1], landed.w[3]], LY);
  assert.equal(caravanStands(landed, [LY[0], 1, LY[1]]), true, 'walked in where it landed: it stands');
  assert.equal(caravanStands(landed, [AX, 1, AZ]), false, 'inside where it stood: it went');
  assert.equal(caravanRecordOf({ ...e, y: undefined }), e.r, 'not thrown: as said');
  assert.equal(caravanRecordOf(null), null);
});

// ─── the pool ───────────────────────────────────────────────────────────────────────────────────────────────────────

function rt(state, view = {}) {
  return { view: () => ({ state, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, horseTargetLabel: 'Bess' };
}

test('AUDIT WARDEN1 C2/C8/C9/C13: the snapshot lifts the horses the throw moves - in harness always, a lone one only as asked - and carries the wagon\'s load, wheels, hitch and the owner\'s concealment; a hold that leaves the lone horse keeps it drawn; holds are counted (mutants: every drawn horse lifted, the hold hiding a following horse, a hold set down by another show)', () => {
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, selfId: () => 'me' });
  const state = { Mode: WAGON_MODE.Deployed, WorldX: AX, WorldZ: AZ, HorseMode: HORSE_MODE.FollowingPlayer, HorseWorldX: AX, HorseWorldZ: AZ + 400, HorseName: 'Bess' };
  pool.attach(rt(state, { deployed: { isGrounded: true, position: [0, 1, 0], rotation: [0, 0, 0, 1], cargoTier: 50 }, horse: { isInteractive: true, position: [0, 0, 10], forward: [0, 0, 1], walk: { walking: false } } }));
  pool.frame(0.016, [0, 1.7, -10]);
  const snap = pool.teamSnapshot('');
  assert.deepEqual(snap.horses, [], 'my following horse is not the throw\'s');
  assert.equal(snap.tier, 50); assert.equal(snap.hitched, false); assert.ok(snap.turn); assert.equal(snap.lone, false);
  assert.equal(pool.teamSnapshot('', true).horses.length, 1, 'one standing by it, asked');
  pool.holdTeam('', true, false);
  assert.equal(pool.drawnFrameOf(''), null, 'the wagon held');
  assert.equal(pool.teamOf('').length, 1, 'the horse it leaves drawn');
  pool.holdTeam('', true, true);
  assert.deepEqual(pool.teamOf(''), [], 'a second show that carries it hides it');
  pool.holdTeam('', false);
  assert.equal(pool.drawnFrameOf(''), null, 'one show set it down: the other still carries it');
  pool.holdTeam('', false);
  assert.ok(pool.drawnFrameOf(''), 'both down');
  // a hitched team: its horse is the throw's
  state.HorseMode = HORSE_MODE.HitchedToWagon;
  pool.frame(0.016, [0, 1.7, -10]);
  const hitched = pool.teamSnapshot('');
  assert.equal(hitched.hitched, true); assert.equal(hitched.horses.length, 1, 'in its shafts');
  // a concealed peer's look rides the snapshot
  const peers = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, selfId: () => 'me' });
  peers.attach(rt({ Mode: 0 }));
  peers.setPeerLook(() => 'veil');
  const kA = 'a'.repeat(24), key = `kept:${kA}`;
  peers.applyKept(X, { k: kA, id: 'p1', name: 'Ann', r: { w: W(), ly: LY } }, (p) => [p[0] - AX, p[1], p[2] - AZ], 0);
  peers.frame(0.016, [0, 0, 0]);
  assert.equal(peers.teamSnapshot(key)?.conceal, 'veil');
});

test('AUDIT WARDEN1 C8: the carried wagon is drawn with its load (the pool\'s own cargo pieces) - drawShowWagon hands the tier, the wheels and the hitch to the one drawWagon (mutants: the tier dropped)', async () => {
  const draws = [];
  const renderer = { textures: new Map(), uploadTexture: (a, rec) => `${a}_${rec}`, createMesh: (model) => ({ model }), drawMesh: (m) => draws.push(m), createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch() {} };
  const gpu = { [WAGON_MODEL_ID]: { id: WAGON_MODEL_ID } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  const meshes = { getGpuMesh: async (id) => gpu[id] ?? null, cpuModels: new Map([[WAGON_MODEL_ID, syntheticWagon41214()]]) };
  const pool = createHorseCartPool({ renderer, meshes, collider: () => null, selfId: () => 'me', now: () => 0, fetchFn: async () => ({ ok: false, status: 404 }), log: { error() {}, warn() {}, info() {} } });
  pool.attach(rt({ Mode: 0 }));
  pool.partsOf('cart');
  for (let i = 0; i < 8; i++) await tick();
  assert.ok(pool.partsOf('cart'));
  const n = (tier) => { draws.length = 0; pool.drawShowWagon(renderer, null, [0, 0, 0], [0, 0, 0, 1], 'cart', null, tier); return draws.length; };
  assert.ok(n(50) > n(0), `a loaded wagon carries its load: ${n(50)} against ${n(0)}`);
});

test('AUDIT WARDEN1 C10: a lifted wagon offers no seat - a rider seated in it is stood down where they sat, told (its seat had stood at the landing before the throw) (mutants: the seat kept, the rider left pinned)', () => {
  const said = [], pins = [];
  const owner = { held: false };
  const pool = {
    peerRide: (id) => (id === 'olaf' ? { model: 'openWagon', kind: 2, passengers: [['me', 1]], go: null, declined: [], position: [0, 0, 0], wire: [10, 2, 20], held: owner.held } : null),
    peerSeat: (id, k) => (owner.held ? null : { feet: [k, 1, 2], yaw: Math.PI / 2 }),
    mySeat: () => null, mySeatCount: () => 0,
  };
  const r = createWagonRiders({
    selfId: () => 'me', name: (id) => id.toUpperCase(), now: () => 1000, say: (l) => said.push(l), pool,
    pin: (feet) => pins.push(['pin', feet]), unpin: (feet) => pins.push(['down', feet]), changed: () => {},
    jumpPressed: () => false, traveling: () => false, canTravel: () => true, travel: () => true,
  });
  r.press('olaf', RIDE_ROW.ask, 1);
  r.frame();
  assert.equal(r.seated(), true);
  owner.held = true;
  r.frame();
  assert.equal(r.seated(), false);
  assert.deepEqual(pins.at(-1), ['down', null], 'down where the body is - no seat to step off');
  assert.ok(said.includes(RIDE_TEXT.lifted));
  // the pool's own: a held peer offers no seat, and says it is held
  const p = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, selfId: () => 'me' });
  p.attach(rt({ Mode: 0 }));
  p.holdTeam('p1', true);
  assert.equal(p.peerSeat('p1', 0), null);
});

// ─── the show ───────────────────────────────────────────────────────────────────────────────────────────────────────

function fakeRenderer() {
  const made = [], gone = [];
  return { made, gone, textures: new Set(), createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b) };
}
const guardTex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) };

test('AUDIT WARDEN1 C7/C8/C12/C13 and the guard\'s top: a show whose team is no longer the one thrown ends where it stands - its team set down, every billboard let go; the carried wagon drawn with its load, wheels and hitch; a concealed owner\'s horses concealed; the wagon rides on the top of the guard\'s standing picture and lands on the landing; a frame with no throw does nothing (mutants: alive unasked, the tier dropped, the conceal dropped, a keeper\'s height, the landing lost)', async () => {
  const r = fakeRenderer();
  let clock = 0, alive = true, scened = 0;
  const held = [], drawn = [];
  const shows = createWardenShows({
    renderer: r, getTexture: async () => guardTex, uploadRecordFrame: () => {},
    toScene: (p) => { scened++; return [p[0] / 40, p[1], p[2] / 40]; }, groundAt: () => 0,
    showWagon: (...a) => { drawn.push(a.slice(5)); return true; }, wagonBox: () => [-1, 0, -2, 1, 2, 2], horseArt: () => true,
    hold: (o, on, lone) => held.push([o, on, lone]), now: () => clock,
  });
  assert.equal(shows.frame([0, 0, 0]), 0); assert.equal(scened, 0, 'C12: an idle frame turns nothing (and mints no copy of the shows to walk)');
  const turn = { angle: 1.25 };
  const snap = { kind: 'cart', look: { body: 2 }, tier: 75, turn, hitched: true, conceal: 'veil', lone: false, at: [0, 0, 0], rotation: [0, 0, 0, 1], horses: [{ at: [0, 0, 3.1], forward: [0, 0, 1] }] };
  shows.start({ key: 'kept:k', owners: ['kept:k'], snap, origin: [0, 0, 0], landing: [40 * 200, 0], alive: () => alive });
  assert.deepEqual(held, [['kept:k', true, false]], 'held, its lone horse left as the snapshot says');
  await tick();
  shows.frame([0, 1.7, -20]);
  const T = shows.state()[0].times;
  assert.equal(r.made.filter((b) => b.archive !== 399 && b.conceal === 'veil').length, 1, 'C13: the carried horse concealed as its owner is');
  shows.draw(r);
  assert.deepEqual(drawn.at(-1), [{ body: 2 }, 75, turn, true], 'C8: its paint, load, wheels and hitch');
  const top = mobileBillboardSize(guardTex, PERSON_GUARD_IDLE_RECORD).h;
  assert.equal(top, 2); assert.notEqual(top, WARDEN_HEAD);
  clock = T.lift + 0.01; shows.frame([0, 1.7, -20]);
  clock = T.turn - 0.001; shows.frame([0, 1.7, -20]);
  assert.ok(Math.abs(shows.state()[0].at[1] - top) < 0.05, `on the top of the guard's picture: ${shows.state()[0].at[1]} against ${top}`);
  clock = T.land - 1e-6; shows.frame([0, 1.7, -20]);
  const at = shows.state()[0].at;
  assert.ok(Math.abs(at[0] - 200) < 0.05 && Math.abs(at[1]) < 0.05 && Math.abs(at[2]) < 0.05, `D7: down on the landing: ${at}`);
  // C7: a team no longer the one thrown
  const r2 = fakeRenderer();
  const held2 = [];
  const s2 = createWardenShows({ renderer: r2, getTexture: async () => guardTex, toScene: (p) => p, groundAt: () => 0, showWagon: () => true, horseArt: () => true, hold: (o, on) => held2.push([o, on]), now: () => clock });
  s2.start({ key: 'mine', owners: [''], snap: { ...snap, conceal: null }, origin: [0, 0, 0], landing: [4000, 0], alive: () => alive });
  await tick(); clock += 0.5; s2.frame([0, 0, 0]);
  assert.ok(r2.made.length >= 2);
  alive = false;
  s2.frame([0, 0, 0]);
  assert.equal(s2.playing('mine'), false, 'summoned: the show ends');
  assert.deepEqual(held2.at(-1), ['', false], 'its team the pool\'s again');
  assert.equal(r2.gone.length, r2.made.length, 'EVERY ALLOCATION HAS AN OWNER');
});

// ─── the host ───────────────────────────────────────────────────────────────────────────────────────────────────────

function hostWorld({ onlineSession = {}, town = 'here', myKey = () => null, enabled = true, persistence = true, base = [AX, AZ] } = {}) {
  const [BX, BZ] = base;
  const state = { Mode: WAGON_MODE.Deployed, WorldX: BX, WorldZ: BZ, HeadingX: 0, HeadingZ: 1, HorseMode: HORSE_MODE.HitchedToWagon, HorseWorldX: 0, HorseWorldZ: 0 };
  const adopted = [], started = [], told = [], snapAsks = [];
  let wall = 1_000_000, eye = [0, 1.7, 0], street = true;
  const runtime = { view: () => ({ state, persistence }), adoptYeet: (from, to) => { const a = thrownTo([state.WorldX, state.WorldZ], from, to); if (!a) return false; adopted.push([from, to]); state.WorldX = a[0]; state.WorldZ = a[1]; return true; } };
  const snaps = { '': { kind: 'cart', at: [0, 0, 0], rotation: [0, 0, 0, 1], horses: [] }, p1: { kind: 'cart', at: [5, 0, 5], rotation: [0, 0, 0, 1], horses: [] }, [`kept:${'a'.repeat(24)}`]: { kind: 'cart', at: [0, 0, 0], rotation: [0, 0, 0, 1], horses: [] } };
  const hcc = { enabled, parts: { box: [-1, 0, -2, 1, 2, 2] }, teamSnapshot: (o, lone) => { snapAsks.push([o, lone]); return snaps[o] ?? null; }, kept: new Map(), keptOwner: (k) => `kept:${k}` };
  const shows = { start: (o) => { started.push(o); return true; }, playing: () => false };
  const nav = { width: 64, height: 64, weightAt: (gx, gy) => (gx === 3 || gy === 31 ? ROAD_WEIGHT : gx === 20 && gy > 5 && gy < 60 ? 0 : 8) };
  const h = createWagonWarden({
    hcc, runtime: () => runtime, shows, online: () => onlineSession,
    toWire: (p) => [p[0] * 40 + BX, p[1], p[2] * 40 + BZ], toScene: (p) => [(p[0] - BX) / 40, p[1], (p[2] - BZ) / 40],
    townAt: (x, z) => (town === 'here' ? { town: 77, nav, local: [x + 5, z + 50], toScene: (u, v) => [u - 5, v - 50] } : town),
    townName: (id) => (id === 77 ? 'Daggerfall' : ''), wallNow: () => wall, eye: () => eye, street: () => street, notify: (l) => told.push(...l), myKey,
  });
  return { h, state, adopted, started, told, snapAsks, hcc, snaps, nav, step: (ms) => { wall += ms; }, setEye: (e) => { eye = e; }, setStreet: (s) => { street = s; } };
}

test('AUDIT WARDEN1 C4/C6/C7: the cell\'s throw of my team is kept for the next street frame (a door\'s load, my caravan\'s room) and taken once; one naming another character\'s team is not mine; the show ends once my save no longer parks the wagon where it landed (mutants: adopted at once, adopted twice, the key unread, alive unasked)', () => {
  const hw = hostWorld({ myKey: () => 'c'.repeat(24) });
  assert.equal(hw.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY, k: 'd'.repeat(24) }), false, 'another character\'s team');
  assert.equal(hw.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY, k: 'c'.repeat(24) }), true);
  assert.equal(hw.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY, k: 'c'.repeat(24) }), false, 'said twice: kept once');
  assert.deepEqual(hw.adopted, [], 'nothing moved in the door\'s load');
  hw.h.tick();
  assert.deepEqual(hw.adopted, [[[AX, AZ], LY]]);
  hw.h.tick();
  assert.equal(hw.adopted.length, 1);
  const show = hw.started[0];
  assert.equal(show.alive(), true, 'parked where it landed');
  hw.state.WorldX += WARDEN_SAME_NATIVES + 1;
  assert.equal(show.alive(), false, 'summoned beside me: no longer the team thrown');
  hw.state.WorldX -= WARDEN_SAME_NATIVES + 1; hw.state.Mode = WAGON_MODE.WithPlayer;
  assert.equal(show.alive(), false, 'driven off');
  // an old relay names no team: taken
  const old = hostWorld({ myKey: () => 'c'.repeat(24) });
  assert.equal(old.h.onParkYeet(X, { at: 2, from: [AX, AZ], to: LY, k: null }), true);
  // a save read back drops what was kept for the old one
  const re = hostWorld();
  re.h.onParkYeet(X, { at: 3, from: [AX, AZ], to: LY });
  re.h.restoreSaveData(null);
  re.h.tick();
  assert.deepEqual(re.adopted, []);
});

test('AUDIT WARDEN1 C5/D10/D11: no stamp and no offline throw with the mod off, nor with the persistence off, nor a wagon not parked; a wagon whose parts are not in is asked again, never stamped townless (mutants: the switch unread, the parts guard dropped, the persistence and the mode unread)', () => {
  const off = hostWorld({ onlineSession: null, enabled: false });
  off.h.tick(); off.step(10 * WARDEN_ROAD_MS); off.h.tick();
  assert.equal(off.h.stamp, null); assert.deepEqual(off.adopted, []); assert.deepEqual(off.told, []);
  const parts = hostWorld({ onlineSession: null });
  parts.hcc.parts = null;
  parts.h.tick();
  assert.equal(parts.h.stamp, null, 'its parts not in: asked again');
  parts.hcc.parts = { box: [-1, 0, -2, 1, 2, 2] };
  parts.h.tick();
  assert.equal(parts.h.stamp.tw, 77, 'stamped in its town once they are');
  const mode = hostWorld({ onlineSession: null });
  mode.state.Mode = WAGON_MODE.WithPlayer;
  mode.h.tick();
  assert.equal(mode.h.stamp, null);
  const kept = hostWorld({ onlineSession: null, persistence: false });
  kept.h.tick();
  assert.equal(kept.h.stamp, null, 'nothing kept in the world');
  // my throw taken with the street down (a window's frame): my save moves, I am told, nothing is played
  const shut = hostWorld();
  shut.setStreet(false);
  shut.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY }); shut.h.tick();
  assert.equal(shut.adopted.length, 1); assert.equal(shut.started.length, 0); assert.equal(shut.told.length, 2);
});

test('AUDIT WARDEN1 C2/C9/D1/D4: a reader\'s throw plays when the kept word was not yet thrown (the usual case), from their live wagon where it stands on the spot thrown from - else the kept one alone, the live one not held; it lifts a horse only standing by it; far off, or indoors, nothing is played; it ends when the cell says it moved (mutants: the dedupe on the key alone, any live wagon lifted, the reach ignored, the first owner alone, alive unasked)', () => {
  const hw = hostWorld();
  const kA = 'a'.repeat(24);
  hw.hcc.kept.set(`${X}|${kA}`, { k: kA, y: null });
  const e = { k: kA, id: 'p1', name: 'Ann', r: { w: W(), h: H(AX + 300), ly: LY }, y: 7 };
  assert.equal(hw.h.keptWord(X, e), true, 'kept, not thrown, now thrown: played');
  assert.deepEqual(hw.started[0].owners, ['p1', `kept:${kA}`], 'their live wagon on the spot: lifted, both held');
  assert.deepEqual(hw.snapAsks[0], ['p1', true], 'the horse by it lifted with it');
  hw.hcc.kept.set(`${X}|${kA}`, { k: kA, y: 7 });
  assert.equal(hw.started[0].alive(), true);
  hw.hcc.kept.set(`${X}|${kA}`, { k: kA, y: null });
  assert.equal(hw.started[0].alive(), false, 'the cell says it moved: the show ends');
  // their live wagon elsewhere (another character's, an id reused): the kept one alone
  const other = hostWorld();
  other.snaps.p1.at = [500, 0, 0];
  assert.equal(other.h.keptWord(X, { ...e, r: { w: W(), h: H(AX + 6000), ly: LY } }), true);
  assert.deepEqual(other.started[0].owners, [`kept:${kA}`], 'never their other wagon');
  assert.deepEqual(other.snapAsks.at(-1), [`kept:${kA}`, false], 'a horse left at a shop is not lifted');
  // far off: nothing
  const far = hostWorld();
  far.setEye([WARDEN_SHOW_REACH + 10, 1.7, 0]);
  assert.equal(far.h.keptWord(X, e), false);
  far.setEye([WARDEN_SHOW_REACH - 10, 1.7, 0]);
  assert.equal(far.h.keptWord(X, e), true);
  // indoors: nothing
  const inside = hostWorld();
  inside.setStreet(false);
  assert.equal(inside.h.keptWord(X, e), false);
  // a lone horse's word is no throw
  assert.equal(hostWorld().h.keptWord(X, { ...e, r: { h: H(), ly: LY } }), false);
});

test('AUDIT WARDEN1 C2: my throw lifts my horse only when it is the throw\'s - one left by the wagon, never one following me or left at a shop (mutants: the lone horse always lifted)', () => {
  const hw = hostWorld();
  hw.state.HorseMode = HORSE_MODE.LooseStationary; hw.state.HorseWorldX = AX + 300; hw.state.HorseWorldZ = AZ;
  hw.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY }); hw.h.tick();
  assert.deepEqual(hw.snapAsks.at(-1), ['', true]);
  const far = hostWorld();
  far.state.HorseMode = HORSE_MODE.LooseStationary; far.state.HorseWorldX = AX + 6000; far.state.HorseWorldZ = AZ;
  far.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY }); far.h.tick();
  assert.deepEqual(far.snapAsks.at(-1), ['', false]);
  const follow = hostWorld();
  follow.state.HorseMode = HORSE_MODE.FollowingPlayer; follow.state.HorseWorldX = AX + 30; follow.state.HorseWorldZ = AZ;
  follow.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY }); follow.h.tick();
  assert.deepEqual(follow.snapAsks.at(-1), ['', false]);
});

test('AUDIT WARDEN1 R6: my landing keeps the team in its own map pixel where an edge allows; else in its own cell; else the nearest edge\'s (mutants: the pixel unread, the cell unread)', () => {
  // the wagon 6 m from the town's west edge, the town's frame starting 5 m west of the scene's 0 (the hosts' own): the
  // west's landing leaves pixel 100 (1000 natives into it), as does the south's - the north's stays
  const inPixel = hostWorld({ onlineSession: null });
  inPixel.state.WorldX = AX + 40;
  inPixel.h.tick();
  const ly = inPixel.h.stamp.ly;
  assert.deepEqual(mapPixelOfWire(ly[0], ly[1]), mapPixelOfWire(AX + 40, AZ));
  assert.ok(ly[1] > AZ + (64 * NAV_CELL - 50) * 40, 'out through the north');
  // no edge keeps it in its pixel (a town filling it) and the nearest's leaves its cell (pixel 96, a cell's west
  // edge): the next nearest that stays in the cell
  const BX = 96 * PIXEL_UNITS + 1000;
  const full = hostWorld({ onlineSession: null, base: [BX, AZ] });
  full.state.WorldX = BX + 40;
  full.nav.width = 2000; full.nav.height = 2000;   // past the pixel every way (a stand-in for an eight-block city)
  full.h.tick();
  const lf = full.h.stamp.ly;
  assert.notDeepEqual(mapPixelOfWire(lf[0], lf[1]), mapPixelOfWire(BX + 40, AZ));
  assert.notEqual(cellRoomOfWire(BX + 40 - 46 * 40, AZ), cellRoomOfWire(BX + 40, AZ), 'the west\'s (the nearest) leaves the cell');
  assert.equal(cellRoomOfWire(lf[0], lf[1]), cellRoomOfWire(BX + 40, AZ), 'its own cell');
  assert.ok(lf[1] < AZ, 'out through the south (the next nearest)');
});

test('AUDIT WARDEN1 D5: the guard navigates - the host\'s way runs from inside the town round a wall, along its streets, and ends at the lift (mutants: a straight jog always, the start set outside the town)', () => {
  const hw = hostWorld();
  hw.h.onParkYeet(X, { at: 1, from: [AX, AZ], to: LY }); hw.h.tick();
  const approach = hw.started[0].approach;
  // the town's frame is the scene's + (5, 50); the wall at gx 20 (x 32 - 33.6 m) for gy 6..59; lift east of the wall,
  // thrown east: the guard sets out WARDEN_APPROACH_FROM back - west of the wall - and walks round it
  const lift = [40 - 5, 30 - 50];
  const pts = approach(lift, [1, 0]);
  assert.ok(Array.isArray(pts) && pts.length >= 3, 'a way, not a straight jog');
  assert.deepEqual(pts.at(-1), lift, 'ending at the lift');
  const [u0, v0] = [pts[0][0] + 5, pts[0][1] + 50];
  assert.ok(u0 >= 0 && v0 >= 0 && u0 < 64 * NAV_CELL && v0 < 64 * NAV_CELL, 'it sets out inside the town');
  assert.ok(u0 < lift[0] + 5, 'from the town\'s side - behind the throw');
  assert.ok(pts.every(([x, z]) => { const gx = Math.floor((x + 5) / NAV_CELL), gy = Math.floor((z + 50) / NAV_CELL); return !(gx === 20 && gy > 5 && gy < 60); }), 'never through the wall');
});

test('AUDIT WARDEN1 D3: the town under a scene point - the built pixels\' own: undefined where nothing is built, null on built ground no watch keeps (or past the town\'s blocks), else its map id, its grid, the point in its frame and back (mutants: the blocks\' bounds dropped, the frame\'s origin dropped)', () => {
  const nav = { width: 10, height: 20 };
  const built = [{ px: 1, py: 2, wardenTown: 77, locOrigin: [30, 0, 40], population: { nav } }, { px: 2, py: 2, wardenTown: null, locOrigin: [0, 0, 0], population: { nav } }];
  const translate = (px) => [px * 1000, 0, 0];
  assert.equal(wardenTownIn(built, translate, 1000, -5, 5), undefined, 'nothing built');
  assert.equal(wardenTownIn(built, translate, 1000, 2500, 5), null, 'built, no watch');
  assert.equal(wardenTownIn(built, translate, 1000, 1010, 50), null, 'west of the town\'s blocks');
  assert.equal(wardenTownIn(built, translate, 1000, 1030 + 10 * NAV_CELL, 50), null, 'east of them');
  const t = wardenTownIn(built, translate, 1000, 1035, 45);
  assert.equal(t.town, 77); assert.equal(t.nav, nav); assert.deepEqual(t.local, [5, 5]); assert.deepEqual(t.toScene(5, 5), [1035, 45]);
});

test('AUDIT WARDEN1 hosts: world.js hands the host its switches - the eye, the street, the HUD, the town\'s name, my park key - registers the stamp with the save both ways, takes the town under a point off the one pure home, and frames the watch before the pool\'s step (C11: a landing\'s frame drew its team horseless) (mutants: each switch stubbed, the frame after the pool)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /eye: \(\) => cam\.pos, street: \(\) => _mode\(\) === 'exterior' && !_loading,\n\s+notify: \(lines\) => \{ for \(const l of lines\) townTalk\.say\(l\); \},\n\s+myKey: \(\) => myParkKey\(\),/);
  assert.match(w, /townName: \(id\) => _townOfMapId\.get\(id >>> 0\)\?\.name \?\? '',/);
  assert.match(w, /getSaveData: \(\) => wagonWarden\?\.getSaveData\(\) \?\? null,\n\s+restoreSaveData: \(rec\) => wagonWarden\?\.restoreSaveData\(rec\),/);
  assert.match(w, /const wardenTownAt = \(x, z\) => wardenTownIn\(built\.values\(\), \(px, py\) => state\.pixelTranslation\(px, py, _wardenT\), TERRAIN_SIZE, x, z\);/);
  assert.match(w, /hold: \(owner, on, lone\) => hcc\.holdTeam\(owner, on, lone\),/);
  assert.match(w, /showWagon: \(r, texRemap, position, rotation, kind, look, tier, turn, hitched\) => hcc\.drawShowWagon\(r, texRemap, position, rotation, kind, look, tier, turn, hitched\),/);
  const watch = w.indexOf("try { if (!_loading) wagonWarden?.tick(); if (_mode() === 'exterior') wardenShows?.frame(cam.pos); }");
  const pool = w.indexOf('    hccTick(dt, now);\n    // WAGONS3 (Mac: "sit on the wagon itself');
  assert.ok(watch > 0 && pool > watch && pool - watch < 400, 'the watch framed just before the pool\'s step');
  assert.equal(w.split("wardenShows?.frame(cam.pos)").length - 1, 1, 'once a frame');
  assert.match(rd('src/scenes/wagon/wagonRiders.js'), /if \(r\.held && ride\.seat != null\) \{ getDown\(RIDE_TEXT\.lifted\); return; \}/);
  const link = rd('src/net/caravanVisitLink.js');
  assert.match(link, /link\.onParks = \(r, list\) => \{ if \(r === cell\) judge\(caravanRecordOf\(/, 'R9: the welcome\'s list judged where it landed');
  assert.match(link, /link\.onPark = \(r, e\) => \{ if \(r === cell && e\?\.k === visit\?\.k\) judge\(caravanRecordOf\(e\)\); \};/, 'and every word after');
});
