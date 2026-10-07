// SD8b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md sections 10 and 14): THE RELAY RUNS
// THE BRASS REMNANT - the fight's words on the wire (an `in`, a blow on the Remnant, an Echo or a Heart; the fight said
// back), the Hollow's realm running net/sdRemnant.js on its alarm (the gate's shape - a fight kept in storage, its frames
// fanned, a blow believed from the socket's own pose), a lost fight made fresh by the next `in`, the fall said once and
// told to the hub - whose record falls with it - and the page's half: the words sent down my own socket, the fight heard
// from my own realm alone.
import { SD_ENDINGS } from '../src/net/sdMarks.js';   // SD18a (PIN MOVED): Sunfall's seven
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_KINDS, SD_OUT_KINDS, validSdIn, validSdOut, parseClient, SD_BRAIN_V, SD_BRAIN_MIN, SD_FIGHT_HZ, sdFightGate, sdFightRelayGate,
  SD_ARENA_BOUND, SD_BODIES, SD_FIGHT_BLOWS, SD_ECHOES, SD_HEARTS_MAX, SD_TARGETS_MAX, SD_NO_WORDS, SD_FIGHT_KEY,
  SD_INTERNAL_FELL, validSdFellTell, SD_KEY, SOCIAL_ROOM, worldRoom, PIXEL_UNITS, GATE_DMG_WIRE_MAX, RELAY_VERSION,
} from '../src/net/wire.js';
import { realmToDungeon, SD_ARENA } from '../src/net/sdBrain.js';
import {
  SD_BODY, SD_BLOW_BY_ID, SD_ECHO_SPOTS, SD_HEARTS, SD_BLOWS, SD_OPENING_MS, SD_LOST_MS, SD_PHASE_AT, SD_TTK_S, SD_SHARE_X,
  newRemnantFight, joinRemnant, remnantStateOf, stepRemnant, atkFrameOf,
} from '../src/net/sdRemnant.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { dpsRef, POSE_SLACK, HIT_KINDS } from '../src/net/gateBrain.js';
import { fakeRooms } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const T0 = 1_800_000_000_000;
/** A pose `x`, `z` metres from the arena's centre, in the dungeon's frame. */
const inArenaAt = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const fights = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k !== 'pz' && m.k !== 'ev');
const say = (o) => JSON.stringify({ t: 'sd', ...o });

/** The fake world driven to a FOUND Hollow (slot 1) and its realm standing - SD3's own way there (SD6b's rig). */
async function withRealm(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room('chat:r17'); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      assert.equal(hub.store.get(SD_KEY).ph, 'found');
      const realm = world.room(sdRoomKey(rec.s));
      { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }   // AUDIT SD: past the Orrery, kept as a realm keeps it - the fight's door asks its Concord (PIN MOVED)
      /** Beat the realm's alarm while it is armed, up to `ms` of the clock. */
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      await fn({ world, hub, hws, cell, realm, rec, beat, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('SD8b THE WIRE: the fight\'s words each way, projected and bounded - an `in` (a level, a brain), a blow (its number, a damage the wire bounds, its kind) on the Remnant, an Echo or a Heart; the whole fight as the law says it, a body\'s walk and blow, the health, a phase\'s turn, the Echoes, the Hearts, the stun, the fall, a loss, a refusal; its numbers the law\'s own, pinned equal (mutants: an Echo past the second; a Heart past the eighth; the Hour\'s blow from a body)', () => {
  assert.deepEqual([...SD_KINDS], ['found', 'pz', 'in', 'hit', 'ehit', 'xhit', 'spent']);   // SD9a: and a slot's spoils taken (PIN MOVED)
  assert.deepEqual([...SD_OUT_KINDS], ['ev', 'pz', 'st', 'mv', 'atk', 'hp', 'ph', 'ec', 'cx', 'cxh', 'cxb', 'stun', 'fell', 'lost', 'no', 'rcpt']);   // SD9a: and the fall's receipt (PIN MOVED)
  // the law's numbers
  assert.equal(SD_BODIES, Object.keys(SD_BODY).length);
  assert.equal(SD_FIGHT_BLOWS, SD_BLOW_BY_ID.length);
  assert.equal(SD_ECHOES, SD_ECHO_SPOTS.length);
  assert.equal(SD_HEARTS_MAX, SD_HEARTS[1]);
  assert.equal(SD_TARGETS_MAX, Math.max(SD_BLOWS.volley.max, ...SD_ENDINGS.map((e) => e.law.volleyMax ?? 0)), 'the most marks a Volley throws - SD18a: Sunfall\'s seven');   // PIN MOVED (SD18a)
  assert.ok(SD_ARENA_BOUND >= SD_ARENA.r + POSE_SLACK, 'the whole arena and its slack');
  assert.equal(SD_BRAIN_V, 1); assert.ok(SD_BRAIN_MIN <= SD_BRAIN_V);
  // in
  assert.deepEqual(validSdIn({ k: 'in', lv: 30, bv: 1, x: 1 }), { k: 'in', lv: 30, bv: 1 });
  assert.deepEqual(validSdIn({ k: 'in', lv: 30 }), { k: 'in', lv: 30 }, 'an old game says no brain');
  assert.equal(validSdIn({ k: 'in', lv: 0 }), null);
  assert.deepEqual(validSdIn({ k: 'hit', q: 3, d: 12.5, r: 0, junk: 1 }), { k: 'hit', q: 3, d: 12.5, r: 0 });
  assert.deepEqual(validSdIn({ k: 'ehit', e: 1, q: 3, d: 1, r: 2 }), { k: 'ehit', e: 1, q: 3, d: 1, r: 2 });
  assert.deepEqual(validSdIn({ k: 'xhit', c: 7, q: 3, d: 1, r: 1 }), { k: 'xhit', c: 7, q: 3, d: 1, r: 1 });
  for (const bad of [{ k: 'hit', q: 1, d: 0, r: 0 }, { k: 'hit', q: 1, d: GATE_DMG_WIRE_MAX + 1, r: 0 }, { k: 'hit', q: -1, d: 1, r: 0 }, { k: 'hit', q: 1, d: 1, r: 3 }, { k: 'ehit', e: 2, q: 1, d: 1, r: 0 }, { k: 'xhit', c: 8, q: 1, d: 1, r: 0 }, { k: 'hit', q: 1, d: NaN, r: 0 }])
    assert.equal(validSdIn(bad), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'sd', k: 'hit', q: 1, d: 5, r: 1 }), { hasHello: true }), { t: 'sd', k: 'hit', q: 1, d: 5, r: 1 });
  // out: the whole fight, as the law says it
  const f = newRemnantFight(4, 2, T0);
  joinRemnant(f, 'a', 'Ann', 30, T0);
  f.hp = SD_PHASE_AT[0] * f.max - 1;
  const body = (x) => ({ sub: 'a', x: 0, z: -10, dead: false, ...x });
  stepRemnant(f, T0 + SD_OPENING_MS, [body()], () => 0.4);
  const st = remnantStateOf(f);
  assert.deepEqual(validSdOut(st), st, 'the state, whole');
  assert.equal(validSdOut({ ...st, fi: 0 }), null);
  assert.equal(validSdOut({ ...st, h: st.m + 1 }), null);
  assert.equal(validSdOut({ ...st, ec: [st.ec[0]] }), null, 'two Echoes or none');
  assert.equal(validSdOut({ ...st, rem: { ...st.rem, x: SD_ARENA_BOUND + 1 } }), null);
  const clk = atkFrameOf(SD_BODY.hour, { i: 7, a: SD_BLOWS.pulse.id, at: T0 + 9, x: 0, z: 0, yw: 0, tg: [], n: 0 });
  assert.deepEqual(validSdOut({ ...st, clk }).clk, { b: SD_BODY.hour, i: 7, a: SD_BLOWS.pulse.id, at: T0 + 9, x: 0, z: 0, yw: 0, tg: [], n: 0 }, 'the Hour\'s blow in a state');
  assert.equal(validSdOut({ ...st, clk: { ...clk, b: SD_BODY.remnant } }), null, 'the Hour\'s blow is the Hour\'s');
  assert.equal(validSdOut({ ...st, rem: { ...st.rem, atk: { ...clk, b: SD_BODY.gold } } }), null, 'a body\'s blow its own');
  // a body's blow
  const atk = atkFrameOf(SD_BODY.gold, { i: 9, a: SD_BLOWS.hand.id, at: T0 + 5, x: -9, z: 2, yw: 0.5, tg: [], sw: -1 });
  assert.deepEqual(validSdOut(atk), atk);
  assert.deepEqual(validSdOut(atkFrameOf(SD_BODY.hour, { i: 9, a: SD_BLOWS.pulse.id, at: T0 + 5, x: 0, z: 0, yw: 0, tg: [], n: 3 })).n, 3);
  for (const bad of [{ b: 4 }, { a: 6 }, { sw: 2 }, { tg: Array.from({ length: SD_TARGETS_MAX + 1 }, () => [0, 0]) }, { tg: [[0, SD_ARENA_BOUND + 1]] }, { i: 0 }])
    assert.equal(validSdOut({ ...atk, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(validSdOut({ k: 'mv', b: 2, x: 1, z: 2, tx: 3, tz: 4, v: 3, at: T0 }), { k: 'mv', b: 2, x: 1, z: 2, tx: 3, tz: 4, v: 3, at: T0 });
  assert.equal(validSdOut({ k: 'mv', b: 3, x: 1, z: 2, tx: 3, tz: 4, v: 3, at: T0 }), null, 'the Hour does not walk');
  assert.deepEqual(validSdOut({ k: 'hp', h: 5, m: 9 }), { k: 'hp', h: 5, m: 9 });
  assert.equal(validSdOut({ k: 'hp', h: 10, m: 9 }), null);
  assert.deepEqual(validSdOut({ k: 'ph', n: 2, at: T0, up: T0 + 2500 }), { k: 'ph', n: 2, at: T0, up: T0 + 2500 });
  assert.equal(validSdOut({ k: 'ph', n: 4, at: T0, up: T0 }), null);
  const ec = { k: 'ec', e: [[0, 100, T0, T0 + 1], [50, 100, T0, 0]], at: T0 + 1, d: 0, n: 'Ann' };
  assert.deepEqual(validSdOut(ec), ec);
  assert.equal(validSdOut({ ...ec, e: [[101, 100, T0, 0], [50, 100, T0, 0]] }), null);
  assert.equal(validSdOut({ ...ec, d: 2 }), null);
  const cx = { k: 'cx', i: 4, m: 30, c: [[1, 2], [3, 4], [5, 6]] };
  assert.deepEqual(validSdOut(cx), cx);
  assert.equal(validSdOut({ ...cx, c: Array(9).fill([0, 0]) }), null, 'eight Hearts at most');
  assert.deepEqual(validSdOut({ k: 'cxh', i: 4, h: [30, 0, 12] }), { k: 'cxh', i: 4, h: [30, 0, 12] });
  assert.deepEqual(validSdOut({ k: 'cxb', i: 4, c: 2, n: 'Bo', at: T0 }), { k: 'cxb', i: 4, c: 2, n: 'Bo', at: T0 });
  assert.deepEqual(validSdOut({ k: 'stun', until: T0 + 8000, at: T0 }), { k: 'stun', until: T0 + 8000, at: T0 });
  assert.equal(validSdOut({ k: 'stun', until: T0, at: T0 }), null);
  const fell = { k: 'fell', at: T0, top: ['Ann', 'Bo'], n: 2, dm: [{ n: 'Ann', l: 30, d: 900, x: 10, h: 40, b: 60, f: 1 }] };
  assert.deepEqual(validSdOut(fell), fell);
  assert.deepEqual(validSdOut({ k: 'lost', at: T0 }), { k: 'lost', at: T0 });
  for (const w of SD_NO_WORDS) assert.deepEqual(validSdOut({ k: 'no', m: w }), { k: 'no', m: w });
  assert.equal(validSdOut({ k: 'no', m: 'go away' }), null);
  // the record's own kind is untouched
  assert.equal(validSdOut({ k: 'ev', s: 0, ph: 'gone', r: -1, at: 1, until: 1, next: 1 }), null);
  // the buckets, and the hub's door
  let b = null, n = 0;
  for (let k = 0; k < 40; k++) { const g = sdFightGate(b, 1000); b = g.bucket; n += g.pass ? 1 : 0; }
  assert.equal(n, SD_FIGHT_HZ);
  b = null; n = 0;
  for (let k = 0; k < 40; k++) { const g = sdFightRelayGate(b, 1000); b = g.bucket; n += g.pass ? 1 : 0; }
  assert.equal(n, SD_FIGHT_HZ + 4, 'the relay\'s deeper');
  assert.equal(SD_INTERNAL_FELL, '/internal/sd/fell');
  assert.deepEqual(validSdFellTell({ s: 4, at: T0, top: 'Ann', n: 3, x: 1 }), { s: 4, at: T0, top: 'Ann', n: 3, rc: [], here: [] });   // SD9a: and its receipts and who stood there, none told (PIN MOVED)
  for (const bad of [{ s: 0, at: T0, top: '', n: 0 }, { s: 4, at: -1, top: '', n: 0 }, { s: 4, at: T0, top: 3, n: 0 }, { s: 4, at: T0, top: '', n: 257 }]) assert.equal(validSdFellTell(bad), null);
});

test('SD8b THE REALM RUNS THE FIGHT: an `in` from the arena joins and is answered with the whole fight, its share in it; the alarm beats it - asleep through the opening, then its walks and blows said to everyone; a blow from the arena is believed, from off it, dead or before an `in` it is nothing (junk, before an `in`); a fight word in a cell is junk (mutants: the share at the wrong level; blows believed off the arena; no beat)', async () => {
  await withRealm(async ({ realm, cell, rec, beat, step, now }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    assert.equal(ann.closed, null);
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    const st = fights(ann).at(-1);
    assert.equal(st.k, 'st');
    assert.deepEqual([st.s, st.fi, st.ph, st.n], [rec.s, 1, 1, 1]);
    assert.equal(st.m, Math.round(SD_TTK_S * dpsRef(30) * SD_SHARE_X), 'Ann\'s share');
    assert.ok(realm.alarm.at != null, 'the beat armed');
    assert.ok(realm.store.get(SD_FIGHT_KEY), 'kept');
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(4, -12), { name: 'Bo' });
    assert.deepEqual(fights(bo).map((m) => [m.k, m.fi, m.n]), [['st', 1, 1]], 'the fight at the hello, as it stands');
    await realm.raw(bo, say({ k: 'in', lv: 20, bv: SD_BRAIN_V }));
    assert.equal(fights(bo).at(-1).n, 2);
    await beat(SD_OPENING_MS - 1000);
    assert.ok(fights(ann).every((m) => m.k !== 'atk' && m.k !== 'mv'), 'asleep through the opening');
    await beat(20_000);
    assert.ok(fights(ann).some((m) => m.k === 'atk' && m.b === SD_BODY.remnant), 'its blows said');
    assert.deepEqual(fights(ann).filter((m) => m.k === 'atk').map((m) => m.i), fights(bo).filter((m) => m.k === 'atk').map((m) => m.i), 'to everyone');
    // a blow believed: the health falls on the next beat's word
    const f = realm.room._sdFight;
    const h0 = f.hp;
    await realm.raw(ann, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(f.hp, h0 - 40);
    await beat(500);
    assert.ok(fights(bo).some((m) => m.k === 'hp' && m.h === Math.round(f.hp)), 'its health said');
    // from off the arena, dead, or before an `in`: nothing
    await realm.pose(ann, inArenaAt(0, -(SD_ARENA.r + POSE_SLACK + 3)));
    await realm.raw(ann, say({ k: 'hit', q: 2, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(f.hp, h0 - 40, 'off the arena');
    await realm.pose(ann, inArenaAt(0, -12, { dd: 1 }));
    step(1000);
    await realm.raw(ann, say({ k: 'hit', q: 3, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(f.hp, h0 - 40, 'the dead strike nothing');
    const cy = realm.connect(); await realm.hello(cy, 'peer-cy', inArenaAt(-4, -12), { name: 'Cy' });
    await realm.raw(cy, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(cy.meters.junk, 1, 'no `in`, no blow');
    // a fight word in a cell is junk
    const c = cell.connect(); await cell.hello(c, 'peer-dee', doorPose(5), { name: 'Dee' });
    await cell.raw(c, say({ k: 'in', lv: 10, bv: SD_BRAIN_V }));
    assert.equal(c.meters.junk, 1);
    assert.equal(cell.store.get(SD_FIGHT_KEY), undefined);
    assert.ok(now() > T0);
  });
});

test('SD8b REFUSED: a game whose brain is older than the realm\'s, an `in` from off the arena or a dead pose, a Hour that has closed - each its own word or nothing (mutants: an older brain let in; the arena not asked)', async () => {
  await withRealm(async ({ realm, hub, rec, step }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30 }));
    assert.deepEqual(fights(ann).at(-1), { t: 'sd', k: 'no', m: 'an older Hour' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_MIN - 1 }));
    assert.deepEqual(fights(ann).at(-1), { t: 'sd', k: 'no', m: 'an older Hour' });
    assert.equal(realm.store.get(SD_FIGHT_KEY), undefined, 'no fight made');
    await realm.pose(ann, inArenaAt(0, -(SD_ARENA.r + POSE_SLACK + 2)));
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    assert.equal(realm.store.get(SD_FIGHT_KEY), undefined, 'not from off the arena');
    await realm.pose(ann, inArenaAt(0, -12, { dd: 1 }));
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    assert.equal(realm.store.get(SD_FIGHT_KEY), undefined, 'not from a dead pose');
    // the Hour closed: the hub's record gone by
    step(hub.store.get(SD_KEY).until - Date.now() + 1);
    realm.room._sdLive = null;
    await realm.pose(ann, inArenaAt(0, -12));
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    assert.deepEqual(fights(ann).at(-1), { t: 'sd', k: 'no', m: 'the Hour has closed' });
    assert.ok(rec.s > 0);
  });
});

test('SD8b LOST, AND FRESH: a fight nobody living stands in is lost (said to the realm, kept so) and the beat stops; the next `in` finds a fresh one, numbered on, whole; a realm that slept past the loss\'s time finds its fight done at the next `in` - an eviction keeps the fight meanwhile (mutants: a lost fight kept; the number not moved)', async () => {
  await withRealm(async ({ realm, beat, step }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    await beat(SD_OPENING_MS + 2000);
    realm.room._sdFight.hp -= 100;
    // the fight kept through an eviction
    realm.wake();
    await beat(1000);
    assert.ok(realm.room._sdFight && realm.room._sdFight.fi === 1, 'woken from storage');
    // Ann walks off the arena: lost
    await realm.pose(ann, inArenaAt(0, -(SD_ARENA.r + POSE_SLACK + 5)));
    await beat(SD_LOST_MS + 1000);
    assert.ok(fights(ann).some((m) => m.k === 'lost'), 'said');
    assert.ok(realm.store.get(SD_FIGHT_KEY).lost, 'kept so');
    const armed = realm.alarm.at;
    assert.ok(armed == null || armed > Date.now() + 5000, 'the beat stopped');
    // back in: a fresh one
    await realm.pose(ann, inArenaAt(0, -12));
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    const st = fights(ann).at(-1);
    assert.deepEqual([st.k, st.fi, st.h === st.m, st.ph], ['st', 2, true, 1], 'fresh, numbered on, whole');
    // a realm that slept: nobody beat it past the loss's time - the next `in` finds it done
    const before = realm.room._sdFight;
    step(SD_LOST_MS + 5000);
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    assert.notEqual(realm.room._sdFight, before);
    assert.equal(fights(ann).at(-1).fi, 3);
  });
});

test('SD8b THE FALL: the Last Moment\'s last blow fells it - kept before it is said, `fell` to everyone in the realm with its chart, the hub told until it answers: its record falls (the collapse from then) and every hello online hears it; a later `in` is answered with the fall; the beat stops (mutants: the fall unsaid; the hub not told; the hub\'s record left standing)', async () => {
  await withRealm(async ({ realm, hub, hws, rec, beat }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -6), { name: 'Ann' });
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(3, -6), { name: 'Bo' });
    for (const ws of [ann, bo]) await realm.raw(ws, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    await beat(SD_OPENING_MS + 1000);
    // the Last Moment, nearly done
    const f = realm.room._sdFight;
    f.phase = 3; f.outUntil = 0; f.ec = null; f.hp = 30; f.resetAt = Date.now() + 600_000;
    const evsBefore = hws.sent.filter((m) => m.t === 'sd' && m.k === 'ev').length;
    await realm.raw(ann, say({ k: 'hit', q: 9, d: 50, r: HIT_KINDS.Spell }));
    const fell = fights(bo).find((m) => m.k === 'fell');
    assert.ok(fell, 'said to everyone');
    assert.deepEqual(fell.top, ['Ann', 'Bo'].slice(0, fell.top.length));
    assert.ok(Array.isArray(fell.dm) && fell.dm.length === 2, 'its chart');
    const kept = realm.store.get(SD_FIGHT_KEY);
    assert.ok(kept.fell && kept.said && kept.told, 'kept, said, told');
    const hr = hub.store.get(SD_KEY);
    assert.equal(hr.ph, 'fell');
    assert.equal(hr.s, rec.s);
    assert.equal(hr.top, 'Ann');
    assert.equal(hr.n, 2);
    assert.ok(hws.sent.filter((m) => m.t === 'sd' && m.k === 'ev').length > evsBefore, 'everyone online hears it');
    // a later `in` (a fighter come back in): the fall
    await realm.raw(bo, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    const late = fights(bo).filter((m) => m.k !== 'rcpt').at(-1);   // SD9a: its receipt again after it (PIN MOVED)
    assert.equal(late.k, 'st');
    assert.equal(late.fell.at, fell.at, 'the fall');
    // a newcomer after the kill is not admitted to the realm at all (SD3's law)
    const cy = realm.connect(); await realm.hello(cy, 'peer-cy', inArenaAt(-3, -6), { name: 'Cy' });
    assert.ok(cy.closed, 'refused at the door');
    // the beat stops: the alarm, fired, says nothing of the fight
    const n = fights(ann).length;
    await beat(5000);
    if (realm.alarm.at != null) await realm.fire();
    assert.equal(fights(ann).length, n, 'nothing more said');
    assert.equal(fights(ann).filter((m) => m.k === 'fell').length, 1, 'said once');
  });
});

/** A session joined to `room` at a relay that says `relayV`, its socket open and welcomed (SD6b's rig). */
function rig(room, relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const heard = [], records = [];
  s.onSdFight = (r, rm) => heard.push([r, rm]);
  s.onSd = (r, rm) => records.push([r, rm]);
  const info = console.info; console.info = () => {};
  try {
    s.join(room, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: relayV });
  } finally { console.info = info; }
  const ws = sockets[0];
  return { s, ws, heard, records, out: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'sd'), tick: (ms) => { t += ms; } };
}

test('SD8b THE PAGE: an `in` and a blow go down my own socket in the realm at a relay that keeps it, on the fight\'s bucket, the brain said; the fight is heard from my own realm alone - never a hub\'s or a cell\'s (mutants: no brain said; the fight heard from anywhere)', () => {
  const realmKey = sdRoomKey(4);
  assert.equal(rig(worldRoom(PX, PY)).s.sendSdIn(33), false, 'never from a cell');
  const old = rig(realmKey, 'world174');
  assert.equal(old.s.sendSdIn(33), false, 'never at a relay that would close the socket on it');
  const { s, ws, heard, records, out } = rig(realmKey);
  assert.equal(s.sendSdIn(33), true);
  assert.deepEqual(out().at(-1), { t: 'sd', k: 'in', lv: 33, bv: SD_BRAIN_V }, 'the brain said');
  assert.equal(s.sendSdBlow('hit', { q: 1, d: 10, r: 0 }), true);
  assert.equal(s.sendSdBlow('ehit', { e: 1, q: 2, d: 10, r: 1 }), true);
  assert.equal(s.sendSdBlow('xhit', { c: 3, q: 3, d: 10, r: 2 }), true);
  assert.deepEqual(out().slice(-3).map((m) => m.k), ['hit', 'ehit', 'xhit']);
  assert.equal(s.sendSdBlow('ehit', { e: 5, q: 4, d: 10, r: 1 }), false, 'the wire\'s law first');
  let n = 0;
  for (let k = 0; k < 40; k++) if (s.sendSdBlow('hit', { q: 10 + k, d: 1, r: 0 })) n++;
  assert.ok(n < 40 && n >= SD_FIGHT_HZ - 4, `the bucket (${n})`);
  // heard: the fight from my own realm; the record from the hub alone
  ws.receive({ t: 'sd', k: 'lost', at: T0 });
  ws.receive({ t: 'sd', k: 'hp', h: 5, m: 9 });
  assert.deepEqual(heard.map(([w, rm]) => [w.k, rm]), [['lost', realmKey], ['hp', realmKey]]);
  ws.receive({ t: 'sd', k: 'ev', s: 4, ph: 'found', r: 3, at: 1, until: 9e12, next: 9e12, foundAt: 2, fb: 'Mara' });
  assert.equal(records.length, 0, 'a record from a realm is nobody\'s');
  const hub = rig(SOCIAL_ROOM);
  hub.ws.receive({ t: 'sd', k: 'lost', at: T0 });
  assert.equal(hub.heard.length, 0, 'the fight from a hub is nobody\'s');
  const cell = rig(worldRoom(PX, PY));
  cell.ws.receive({ t: 'sd', k: 'hp', h: 5, m: 9 });
  assert.equal(cell.heard.length, 0, 'nor from a cell');
});

test('SD8b the relay by source: the fight\'s words routed in a realm alone on their own bucket; the alarm beats the fight; the hub keeps the fall\'s door; net/sdRemnant.js in the bundle', () => {
  const w = read('server/src/index.js');
  assert.match(w, /if \(m\.k === 'in' \|\| m\.k === 'hit' \|\| m\.k === 'ehit' \|\| m\.k === 'xhit'\) \{\n\s+if \(!this\._spend\(ws, now, sdFightRelayGate, 'sdFightBucket', 'sdFightDrops', 'too many fight frames'\)\) return;\n\s+if \(!isSdRoom\(a\.key\)\) \{ this\._junk\(ws\); return; \}/);
  assert.match(w, /if \(await this\._sdFightTick\(\)\) return;/);
  assert.match(w, /if \(path === SD_INTERNAL_FELL\) return this\._sdFellInternal\(request\);/);
  assert.match(w, /import \{ newRemnantFight, joinRemnant, applyRemnantHit, applyEchoHit, applyHeartHit, stepRemnant, remnantStateOf, arenaOf, inArena, SD_ARENA_SLACK, SD_LOST_MS \} from '\.\.\/\.\.\/src\/net\/sdRemnant\.js';/);   // AUDIT SD II (SD11e, PIN MOVED): L4 C2 - the arena's own slack
  assert.match(read('test/relayversion.test.js'), /'src\/net\/sdBrain\.js', 'src\/net\/sdRemnant\.js'[\],]/);   // SD9a: net/sdReceipt.js after it (PIN MOVED)
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD8b - shipped 2026-10-07/);
});
