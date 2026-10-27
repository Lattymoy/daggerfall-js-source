// RPT1026-FIGHTS RETIRED-BLOW (a private report, 2026-10-21: two fighters cleared the Remnant far faster than one
// could): A BLOW IS A SIGHTING. A fighter the beat has not seen for ABSENT_RETIRE_MS has its share taken out of the boss
// (gateBrain.js retireShare), and no blow arm asked whether the striker was one of them: a level-60 that stopped posing
// beside a level-1 struck a Remnant holding the level-1's share alone, its blows whole (68,250 -> 34,125 with two
// level-60s, 3,150 with a level-1, and the "absent" one's next blow 780). And the relay judged that blow from the socket's
// last pose however old - the census drops a pose older than SD_POSE_FRESH_MS, the blow path did not. Now the relay drops
// a blow from a stale pose (the Hour's and the Ketch's), and a blow that reaches the purse brings its striker's share back
// first, at the fraction the boss stands at - the Remnant, its Echoes and Hearts, the gate's Warden, the Ketch's Tonal
// Warden and its forks. tools/mutants/rpt1026_fights.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SD_KEY, SOCIAL_ROOM, PIXEL_UNITS, worldRoom, chatRegionRoom } from '../../../src/net/wire.js';
import { sdRoomKey } from '../../../src/net/superDungeon/sdLaw.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { SD_ARENA, realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import {
  newRemnantFight, joinRemnant, stepRemnant, applyRemnantHit, applyEchoHit, applyHeartHit, heartsOpen,
  SD_OPENING_MS, SD_POSE_FRESH_MS, SD_TTK_S, SD_SHARE_X, SD_PHASE_AT, SD_BREAK_MS,
} from '../../../src/net/superDungeon/sdRemnant.js';
import { ABSENT_RETIRE_MS, HIT_KINDS, HIT_CAP_X, dpsRef, newFight, joinFight, stepBrain, applyHit, BRAIN_TICK_MS } from '../../../src/net/gate/gateBrain.js';
import { newWardenFight, joinWarden, stepWarden, applyWardenHit, applyForkHit, forksOpen, KW_TTK_S, KW_SHARE_X } from '../../../src/net/ketch/ketchWarden.js';
import { KT_BRIDGE } from '../../../src/net/ketch/ketchDeck.js';

const T0 = 1_800_000_000_000;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const share = (lv) => SD_TTK_S * dpsRef(lv) * SD_SHARE_X;
/** A body of the arena's frame, alive. */
const at = (sub, x = 0, z = -10) => ({ sub, x, z, dead: false });
/** The Remnant's fight beaten every 250 ms from `from` to `until` over `bodies`; answers the moment it stopped. */
function beat(f, from, until, bodies, rng = seeded(5)) {
  let t = from;
  for (; t <= until; t += 250) stepRemnant(f, t, bodies, rng);
  return t - 250;
}

// ── the law: the Remnant ────────────────────────────────────────────

test('RPT1026-FIGHTS RETIRED-BLOW THE REPORT\'S NUMBERS: two level-60s bring 68,250; the one the beat has not seen for ABSENT_RETIRE_MS has its share out (34,125) - and its next blow brings it back, at the fraction the Remnant stands at, before it lands (it landed 780 on the other\'s share alone); beside a level-1 partner the share left is 3,150, and the level-60\'s blow restores 37,275 (mutants: no sighting; a sighting that never restores)', () => {
  assert.equal(share(60), 34_125); assert.equal(share(1), 3_150);
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 60, T0); joinRemnant(f, 'b', 'B', 60, T0);
  assert.equal(f.max, 68_250);
  let t = beat(f, T0, T0 + SD_OPENING_MS + ABSENT_RETIRE_MS + 1000, [at('b')]);
  assert.equal(f.players.a.retired, true, 'the still one, retired');
  assert.equal(f.max, 34_125, 'its share out');
  const frac = f.hp / f.max;
  t += 10;
  const got = applyRemnantHit(f, 'a', 780, HIT_KINDS.Spell, { x: 0, z: -10 }, t);
  assert.equal(got, HIT_CAP_X * dpsRef(60), 'the blow lands, capped as ever');
  assert.equal(f.players.a.retired, false, 'seen by its blow');
  assert.equal(f.players.a.seenAt, t);
  assert.equal(f.max, 68_250, 'its share back in the whole');
  assert.ok(near(f.hp, frac * 68_250 - got), 'at the fraction it stood at - a return never heals it - and the blow off that');
  // the report's second case: a level-1 partner
  const g = newRemnantFight(4, 2, T0);
  joinRemnant(g, 'hi', 'Hi', 60, T0); joinRemnant(g, 'lo', 'Lo', 1, T0);
  let u = beat(g, T0, T0 + SD_OPENING_MS + ABSENT_RETIRE_MS + 1000, [at('lo')]);
  assert.equal(g.max, 3_150, 'the level-1\'s share alone');
  u += 10;
  assert.ok(applyRemnantHit(g, 'hi', 780, HIT_KINDS.Spell, { x: 0, z: -10 }, u) > 0);
  assert.equal(g.max, 37_275, 'the level-60\'s share back before its blow');
  assert.ok(g.hp / g.max > 0.95, `one blow is no longer a quarter of the fight (${(g.hp / g.max).toFixed(3)})`);
  // a blow refused before the purse (off the arena) sees nobody: the share stays out
  const h = newRemnantFight(4, 3, T0);
  joinRemnant(h, 'a', 'A', 60, T0); joinRemnant(h, 'b', 'B', 60, T0);
  const v = beat(h, T0, T0 + SD_OPENING_MS + ABSENT_RETIRE_MS + 1000, [at('b')]);
  assert.equal(applyRemnantHit(h, 'a', 780, HIT_KINDS.Spell, { x: 0, z: -SD_ARENA.r - 5 }, v + 10), 0, 'from the Steps');
  assert.equal(h.players.a.retired, true, 'and still out');
});

test('RPT1026-FIGHTS RETIRED-BLOW THE DRAGON BREAK AND THE RESET: a retired fighter\'s blow on an Echo brings its share back and the Echoes with it (each half of the break\'s pool), and one on a Heart of the Reset in flight brings it back too (mutants: no sighting on an Echo; nor on a Heart; the Echoes not rescaled)', () => {
  const rng = seeded(9);
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 60, T0); joinRemnant(f, 'b', 'B', 1, T0);
  let t = beat(f, T0, T0 + SD_OPENING_MS + ABSENT_RETIRE_MS + 1000, [at('b')], rng);
  assert.equal(f.players.a.retired, true);
  // the break, as the beat makes it
  f.hp = 0.69 * f.max;
  t += 250; stepRemnant(f, t, [at('b')], rng);
  assert.equal(f.phase, 2);
  t += SD_BREAK_MS + 10;
  const E = f.ec[0];
  const got = applyEchoHit(f, 'a', 0, 100, HIT_KINDS.Spell, { x: 0, z: -10 }, t).length;
  assert.equal(got, 0, 'it stands');
  assert.equal(f.players.a.retired, false);
  assert.equal(f.max, share(60) + share(1));
  const pool = f.hp - SD_PHASE_AT[1] * f.max;
  assert.ok(near(f.ec[0].h + f.ec[1].h, pool), 'the Echoes stand for the break\'s pool of the whole');
  assert.ok(E.m > 5000, `each Echo half of the whole's break (${Math.round(E.m)})`);
  // the Reset, as the beat calls it: its Hearts minted (raiseHearts) with the Remnant winding it up
  const g = newRemnantFight(4, 2, T0);
  joinRemnant(g, 'a', 'A', 60, T0); joinRemnant(g, 'b', 'B', 1, T0);
  let u = beat(g, T0, T0 + SD_OPENING_MS + ABSENT_RETIRE_MS + 1000, [at('b')], rng);
  assert.equal(g.players.a.retired, true);
  Object.assign(g, { phase: 3, hp: 0.3 * g.max, outUntil: 0, stunUntil: 0, resetAt: u + 250, pulseAt: u + 600_000, clock: null });
  Object.assign(g.rem, { atk: null, nextAt: 0, mv: null });
  u += 250; stepRemnant(g, u, [at('b')], rng);
  assert.ok(g.cx && heartsOpen(g, u + 10), 'the Reset winds up, its Hearts standing');
  applyHeartHit(g, 'a', 0, 5, HIT_KINDS.Spell, { x: 0, z: -10 }, u + 10);
  assert.equal(g.players.a.retired, false, 'a Heart\'s striker stands in the arena too');
  assert.equal(g.max, share(60) + share(1));
});

// ── the law: the gate's Warden and the Ketch's ────────────────────────

test('RPT1026-FIGHTS RETIRED-BLOW THE GATE\'S WARDEN: a fighter whose share was retired (no body in the court ABSENT_RETIRE_MS) and whose blow comes before the beat sees it again strikes with its share back in his health, at the fraction he stands at (mutants: no sighting at the gate)', () => {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn');
  joinFight(f, 'a', 'A', 60, T0, true); joinFight(f, 'b', 'B', 1, T0, true);
  const both = f.max;
  let t = T0;
  for (; t <= T0 + ABSENT_RETIRE_MS + 1000; t += BRAIN_TICK_MS) stepBrain(f, t, [{ sub: 'b', x: 0, z: 3, dead: false }], seeded(3));
  assert.equal(f.players.a.retired, true);
  assert.ok(f.max < both / 10, 'the level-1\'s share alone');
  const frac = f.hp / f.max;
  const got = applyHit(f, 'a', 100, HIT_KINDS.Spell, { x: 0, z: 3 }, t);
  assert.ok(got > 0);
  assert.equal(f.players.a.retired, false);
  assert.ok(near(f.max, both), 'its share back');
  assert.ok(near(f.hp, frac * both - got, 1e-3), 'at the fraction he stood at');
});

test('RPT1026-FIGHTS RETIRED-BLOW THE KETCH\'S TONAL WARDEN: a member gone from the bridge ABSENT_RETIRE_MS has its share out, and its blow on the Warden - or on a tuning-fork of the Keel-Song - brings it back first (mutants: no sighting on the Warden; nor on a fork)', () => {
  const rng = seeded(11);
  const bridge = (sub) => ({ sub, x: KT_BRIDGE.x, z: KT_BRIDGE.z - 10, y: KT_BRIDGE.y, dead: false });
  const pose = { x: KT_BRIDGE.x, y: KT_BRIDGE.y, z: KT_BRIDGE.z - 10 };
  const spend = (d, left) => Math.min(d, left);
  const ws = (lv) => KW_TTK_S * dpsRef(lv) * KW_SHARE_X;
  const f = newWardenFight('kt:test', 1, T0);
  joinWarden(f, 'a', 'A', 60, T0); joinWarden(f, 'b', 'B', 1, T0);
  let t = T0;
  for (; t <= T0 + ABSENT_RETIRE_MS + 7000; t += 250) stepWarden(f, t, [bridge('b')], rng);
  assert.equal(f.players.a.retired, true);
  assert.ok(near(f.max, ws(1)));
  assert.ok(applyWardenHit(f, 'a', 50, HIT_KINDS.Spell, pose, t, spend) > 0);
  assert.equal(f.players.a.retired, false);
  assert.ok(near(f.max, ws(60) + ws(1)), 'its share back on the Warden');
  // the Last Note's song, as the beat sings it: its forks minted (raiseForks)
  const g = newWardenFight('kt:test', 2, T0);
  joinWarden(g, 'a', 'A', 60, T0); joinWarden(g, 'b', 'B', 1, T0);
  let u = T0;
  for (; u <= T0 + ABSENT_RETIRE_MS + 7000; u += 250) stepWarden(g, u, [bridge('b')], rng);
  assert.equal(g.players.a.retired, true);
  Object.assign(g, { phase: 3, ward: false, hp: 0.3 * g.max, outUntil: 0, stunUntil: 0, songAt: u, secAt: u + 600_000, fk: null });
  Object.assign(g.wd, { atk: null, nextAt: 0, mv: null });
  stepWarden(g, u, [bridge('b')], rng);
  assert.ok(g.fk && forksOpen(g, u + 10), 'the song winds up, its forks standing');
  applyForkHit(g, 'a', 0, 5, HIT_KINDS.Spell, pose, u + 10, spend);
  assert.equal(g.players.a.retired, false, 'a fork\'s striker stands on the bridge too');
  assert.ok(near(g.max, ws(60) + ws(1)));
});

// ── the relay: a blow from a stale pose ───────────────────────────────

const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0 }; };
const say = (o) => JSON.stringify({ t: 'sd', ...o });
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
/** The fake world driven to a FOUND Hollow and its realm standing, past the Orrery (sd20a_fight.test.js's). */
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
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room(chatRegionRoom(17)); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h);
      const beatTo = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      const hello = async (id, pose) => { const ws = realm.connect(); await realm.hello(ws, id, pose, { name: id.replace('peer-', '') }); return ws; };
      await fn({ realm, beat: beatTo, hello, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('RPT1026-FIGHTS RETIRED-BLOW AT THE RELAY: a fighter that stops posing is absent from the census, and past ABSENT_RETIRE_MS its share is out - its blow from that stale pose lands nothing now (it landed whole on its partner\'s share); posing again, its next blow brings its share back and lands (mutants: the blow\'s pose never aged)', async () => {
  await withRealm(async ({ realm, beat, hello, step, now }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -10)), bob = await hello('peer-bob', inArenaAt(3, -10));
    await realm.raw(ann, say({ k: 'in', lv: 60, bv: 1 }));
    await realm.raw(bob, say({ k: 'in', lv: 1, bv: 1 }));
    await beat(SD_OPENING_MS + 1000);
    const f = realm.room._sdFight;
    const A = 'acct-peer-ann';
    assert.ok(f && f.players[A] && f.players['acct-peer-bob'], 'both in the fight');
    assert.equal(f.max, share(60) + share(1));
    // bob keeps posing; ann stands frozen - no pose past her last
    for (let k = 0; k < 14; k++) { await realm.pose(bob, inArenaAt(3 + (k % 2) * 0.2, -10)); await beat(5000); }
    const b = realm.room._all().get(ann);
    assert.ok(now() - (b.pAt ?? b.since) > SD_POSE_FRESH_MS + ABSENT_RETIRE_MS, 'her pose older than the census\'s and the retirement together');
    assert.equal(f.players[A].retired, true, 'absent, her share out');
    assert.equal(f.max, share(1));
    const hp = f.hp, dealt = f.players[A].dealt;
    await realm.raw(ann, say({ k: 'hit', q: 1, d: 780, r: HIT_KINDS.Spell }));
    assert.equal(f.players[A].dealt, dealt, 'a blow from a stale pose lands nothing');
    assert.equal(f.hp, hp);
    assert.equal(f.max, share(1), 'nor brings her share back');
    step(1000);
    await realm.pose(ann, inArenaAt(0.4, -10));
    await realm.raw(ann, say({ k: 'hit', q: 2, d: 780, r: HIT_KINDS.Spell }));
    assert.ok(f.players[A].dealt > dealt, 'posing again, her blow lands');
    assert.equal(f.players[A].retired, false);
    assert.equal(f.max, share(60) + share(1), 'her share back before it was judged');
  });
});

test('RPT1026-FIGHTS RETIRED-BLOW THE KETCH\'S RELAY: a word aboard is judged from a pose no older than KT_POSE_FRESH_MS, the census\'s own law (mutants: the word\'s pose never aged)', () => {
  const RELAY = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(RELAY, /const pose = a\.pose && now - \(a\.pAt \?\? a\.since \?\? 0\) <= KT_POSE_FRESH_MS \? this\._ktPoseOf\(a\.pose\) : null;/);
  assert.match(RELAY, /if \(!b\.id \|\| !b\.sub \|\| !b\.pose \|\| !V\.players\[b\.sub\] \|\| now - \(b\.pAt \?\? b\.since \?\? 0\) > KT_POSE_FRESH_MS\) continue;/, 'the census\'s, the same age');
});
