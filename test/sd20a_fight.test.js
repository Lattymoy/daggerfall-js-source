// SD20a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "SD20 - AUDIT SD III"): THE FIGHT,
// AUDITED A THIRD TIME - its balance and its escapes run by their own scripts, each finding reproduced before it was
// fixed. The Mantella Pulse had no ceiling: under the Underking's clock a Restless Pulse passed everyone's whole health.
// A step off the arena's near edge was a fall cast back to the Crumble - out of every blow of the whole arena for the
// void's 15%. A tab hidden across a landing was never struck, and a frozen page stood in the relay's census for good. The
// Hour's End struck dead a page its fight had refused. The Hardened Hearts made the Reset a race no party could run; a
// Pulse landed inside the Reset's race; the rim was Stomp-proof; and the Hour's own costs - the void, the Orrery's lash -
// killed, with one life a Hollow.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from './fakeRoom.mjs';
import { SD_KEY, SOCIAL_ROOM, PIXEL_UNITS, HEARTBEAT_MS, worldRoom, chatRegionRoom } from '../src/net/wire.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { ABSENT_RETIRE_MS, dpsRef } from '../src/net/gateBrain.js';
import {
  SD_PULSE_PCT, SD_PULSE_STEP, SD_PULSE_MAX, SD_PULSE_CLEAR_MS, SD_POSE_FRESH_MS, SD_REM, SD_ECHO, SD_BODY, SD_BLOWS,
  SD_OPENING_MS, SD_HEART, SD_HEARTS_CLOSE_MS, SD_ARENA_SLACK, SD_PILLARS, SD_PILLAR_OVER_Y, pulsePct, pulsePctOf,
  newRemnantFight, joinRemnant, stepRemnant, remnantStateOf, sdFightProfile, heartHpFor, heartCountFor, behindPillar,
} from '../src/net/sdRemnant.js';
import { sdMarksOf, SD_OMENS } from '../src/net/sdMarks.js';
import { sdBlowVerdict, SD_STRIKE_LATE_MS } from '../src/net/sdStrike.js';
import { SD_ARENA, SD_REALM_ORIGIN, SD_FRAY_LASH, SD_PILLAR_H, realmToDungeon, dungeonToRealm } from '../src/net/sdBrain.js';
import { realmArena, arenaHolds, SD_ARENA_FLOORS, SD_REALM_FLOORS } from '../src/world/sdRealm.js';
import { SD_HALL_FLOORS } from '../src/world/sdHall.js';
import { SD_STEPS_FLOORS, SD_CAST_BACK_LOSS } from '../src/world/sdSteps.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';
import { createSdFightLink } from '../src/net/sdFightLink.js';
import { validSdOut } from '../src/net/wire.js';
import { createSdRemnantBlows } from '../src/scenes/sdRemnantBlows.js';
import { sdPerilAt } from '../src/scenes/sdArenaRead.js';
import { arenaToDungeon } from '../src/scenes/sdRemnant.js';
import { hurtPlayer, setDeathPresenter, setAvoidDeathHook } from '../src/characters/playerEntity.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const RELAY = read('server/src/index.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const T0 = 1_800_000_000_000;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
/** A `function name(` of world.js's own, its text. */
const fnOf = (name) => { const at = W.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  }\n', at) + 4); };
/** A fight in `s` with `n` fighters at `lv`, born at T0 - its Hollow's marks its own. */
function fight(s = 4, n = 4, lv = 30) {
  const f = newRemnantFight(s, 1, T0, sdMarksOf(s));
  for (let k = 0; k < n; k++) joinRemnant(f, `p${k}`, `P${k}`, lv, T0);
  return f;
}
const ringOf = (f, r = 8) => Object.keys(f.players).map((sub, k, all) => { const a = (k / all.length) * Math.PI * 2; return { sub, x: Math.sin(a) * r, z: Math.cos(a) * r, dead: false }; });
/** Beat the fight every 250 ms from `from` to `until`; the frames said, each with its moment. */
function beatTo(f, from, until, bodiesAt, rng = seeded(5)) {
  const out = [];
  for (let now = from; now <= until; now += 250) for (const x of stepRemnant(f, now, bodiesAt(now), rng)) out.push({ now, ...x });
  return out;
}
const isPulse = (x) => x.k === 'atk' && x.a === SD_BLOWS.pulse.id;
const isReset = (x) => x.k === 'atk' && x.a === SD_BLOWS.reset.id;

// ── F1: the Pulse's ceiling ─────────────────────────────────────────────

test('SD20a THE PULSE\'S CEILING (F1): the Mantella Pulse climbs to three quarters of everyone\'s health and no further - the table\'s own climb untouched (its thirtieth 70%), a Restless step\'s on the wire held to the same ceiling; under the Underking\'s 22 s clock a Restless Hollow\'s Pulse passed 100% eight minutes in, and now stands at 75% to the Hour\'s End; its omen says so (mutants: no ceiling; the wire\'s step past it; the ceiling at the whole; the omen\'s old words)', () => {
  assert.equal(SD_PULSE_MAX, 0.75);
  assert.equal(pulsePct(0), SD_PULSE_PCT);
  assert.ok(near(pulsePct(29), 0.7), 'the table\'s own thirtieth, unchanged');
  assert.ok(near(pulsePct(31), 0.74));
  assert.equal(pulsePct(32), SD_PULSE_MAX, 'its thirty-third would be 76%');
  assert.equal(pulsePct(1e6), SD_PULSE_MAX);
  assert.ok(near(pulsePctOf({ n: 15, sh: { ps: 0.04 } }), 0.72));
  assert.equal(pulsePctOf({ n: 16, sh: { ps: 0.04 } }), SD_PULSE_MAX, 'a Restless step: the same ceiling');
  assert.equal(pulsePctOf({ n: 40, sh: { ps: 0.04 } }), SD_PULSE_MAX);
  assert.equal(pulsePctOf({ n: 40 }), SD_PULSE_MAX);
  // a whole Hour of a Restless Hollow under the Underking (slot 2: its clock 22 s, its step 0.04)
  assert.deepEqual(sdMarksOf(2).slice(0, 2), ['underking', 'restless']);
  const P = sdFightProfile(sdMarksOf(2));
  assert.deepEqual([P.pulseMs, P.pulseStep], [22_000, 0.04]);
  const f = fight(2);
  const wake = T0 + SD_OPENING_MS;
  const pulses = beatTo(f, wake, f.endsAt, () => ringOf(f)).filter(isPulse);
  assert.ok(pulses.length >= 35, `a Pulse every 22 s for fifteen minutes: ${pulses.length}`);
  const pcts = pulses.map((x) => pulsePctOf(x));
  assert.ok(pcts.every((p) => p <= SD_PULSE_MAX), 'never past three quarters');
  assert.equal(pcts.at(-1), SD_PULSE_MAX, 'and there at the end');
  const last = pulses.at(-1);
  assert.ok(SD_PULSE_PCT + last.sh.ps * last.n > 1.5, 'the wall it was: past everyone\'s whole health');
  const firstOver = pulses.findIndex((x) => SD_PULSE_PCT + x.sh.ps * x.n >= 1);
  assert.ok(firstOver > 0 && pulses[firstOver].at - wake <= 9 * 60_000, 'eight minutes in, uncapped, a Pulse would kill');
  // the screen strikes it so
  const v = sdBlowVerdict(last, 0, 6, last.at, last.at + 20, true);
  assert.deepEqual(v.hits.map((h) => [h.part, h.pct]), [['all', SD_PULSE_MAX]]);
  // the omen says the ceiling
  const restless = SD_OMENS.find((o) => o.id === 'restless');
  assert.equal(restless.text, 'Each Mantella Pulse climbs twice as steeply - to three quarters of your health.');
  assert.equal(restless.law.pulseStep, 2 * SD_PULSE_STEP);
});

// ── F2: the arena holds ────────────────────────────────────────────────

test('SD20a THE ARENA HOLDS WHAT IT HAS TAKEN (F2): joined to a living fight and standing inside the rim, the body is kept on the arena\'s own floor - a step back over its near edge, where the Concord\'s band lets go and the void cast a fighter back to the Crumble out of every blow of the whole arena, is the rim; anyone else walks the Concord\'s floors as before (mutants: held whoever stands there; held from anywhere; never held; the host\'s choice forgotten)', () => {
  assert.equal(arenaHolds(true, SD_ARENA.x, SD_ARENA.z), true);
  assert.equal(arenaHolds(false, SD_ARENA.x, SD_ARENA.z), false, 'not joined: not held');
  assert.equal(arenaHolds(true, SD_ARENA.x, SD_ARENA.z - SD_ARENA.r), true, 'on the rim');
  assert.equal(arenaHolds(true, SD_ARENA.x, SD_ARENA.z - SD_ARENA.r - 0.01), false, 'past it: the Steps\' - not held');
  assert.equal(arenaHolds(true, NaN, SD_ARENA.z), false);
  assert.deepEqual(SD_ARENA_FLOORS.map((fl) => fl.kind), ['disc'], 'the disc alone - no band');
  // just off the near edge, over the void: the Concord's floors let go there; the held arena's rim does not
  const [ox, , oz] = SD_REALM_ORIGIN;
  const off = [ox + SD_ARENA.x, 0, oz + SD_ARENA.z - SD_ARENA.r - 0.5];
  const bridged = realmArena([...SD_REALM_FLOORS, ...SD_HALL_FLOORS, ...SD_STEPS_FLOORS]);
  assert.equal(bridged.clamp(off), null, 'the band: free to step off');
  const held = realmArena(SD_ARENA_FLOORS).clamp(off);
  assert.ok(held && near(held[0], off[0], 1e-6) && near(held[1], oz + SD_ARENA.z - SD_ARENA.r, 1e-6), `held: back to the rim (${held})`);
  // the host: whether it holds me, from its own text
  const at = W.indexOf('\n  const sdArenaHeld = () => {'); assert.ok(at > 0);
  const text = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  const run = (joined, x, z) => new Function('sdFightLink', 'player', 'sdDungeonToRealm', 'arenaHolds', `${text}\nreturn sdArenaHeld();`)({ joined: () => joined }, { pos: realmToDungeon(x, 0, z) }, dungeonToRealm, arenaHolds);
  assert.equal(run(true, SD_ARENA.x + 3, SD_ARENA.z - 20), true, 'joined, inside: held');
  assert.equal(run(false, SD_ARENA.x + 3, SD_ARENA.z - 20), false, 'not joined: free');
  assert.equal(run(true, SD_ARENA.x, SD_ARENA.z - SD_ARENA.r - 2), false, 'on the Steps: free');
  assert.match(W, /const _realmArenaHeld = realmArena\(SD_ARENA_FLOORS\);/);
  assert.match(W, /if \(!player\.arena && modes\?\.sdRealmSlot\?\.\(\) != null\) player\.arena = sdArenaHeld\(\) \? _realmArenaHeld : sdConcordHere\(\) \? _realmArenaBridged : _realmArena;/);
});

// ── F3: the hidden tab, the frozen page ─────────────────────────────────

test('SD20a THE WHOLE ARENA\'S BLOWS ARE JUDGED HOWEVER LATE (F3): a Pulse, a Reset or the End first seen long after it landed - a tab hidden across it - still strikes a body in the arena, once; never one on the Steps; a blow with a place to misjudge keeps the late law (mutants: the late law over the Hour\'s own; struck twice)', () => {
  const at = T0 + 10_000;
  for (const A of [SD_BLOWS.pulse, SD_BLOWS.reset, SD_BLOWS.end]) {
    const atk = { i: 3, a: A.id, at, x: 0, z: 0, yw: 0, tg: [], ...(A === SD_BLOWS.pulse ? { n: 4 } : {}) };
    const late = at + SD_STRIKE_LATE_MS + 7000;
    const v = sdBlowVerdict(atk, 0, 6, late, late + 20, true);
    assert.equal(v.hits.length, 1, `${A.key}: struck, however late`);
    assert.equal(v.done, true);
    assert.deepEqual(sdBlowVerdict(atk, 0, 6, late + 20, late + 40, true, v.seen).hits, [], `${A.key}: once`);
    const steps = sdBlowVerdict(atk, 0, -SD_ARENA.r - SD_ARENA_SLACK - 1, late, late + 20, true);
    assert.deepEqual([steps.hits, steps.done], [[], true], `${A.key}: never on the Steps`);
  }
  const stomp = { i: 4, a: SD_BLOWS.stomp.id, at, x: 0, z: 0, yw: 0, tg: [] };
  assert.deepEqual(sdBlowVerdict(stomp, 3, 0, at + SD_STRIKE_LATE_MS + 20, at + SD_STRIKE_LATE_MS + 40, true).hits, [], 'a Stomp\'s disc first seen late: not judged, as ever');
});

const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0 }; };
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
/** The fake world driven to a FOUND Hollow and its realm standing, past the Orrery (sd11b_relay.test.js's). */
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
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      const hello = async (id, pose) => { const ws = realm.connect(); await realm.hello(ws, id, pose, { name: id.replace('peer-', '') }); return ws; };
      await fn({ realm, cell, mara, beat, hello, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('SD20a A FROZEN PAGE IS ABSENT (F3): a fighter\'s pose in the Hour is stamped as the relay takes it, and past SD_POSE_FRESH_MS - the pose heartbeat\'s 20 s and five of grace - it speaks for no body in the fight\'s census: a page frozen in the arena (a hidden tab draws and poses nothing) no longer stands there earning; its next pose brings it back; a cell\'s poses carry no stamp; the beat reads the census at its own instant (mutants: never stale; never stamped; stamped everywhere)', async () => {
  assert.equal(HEARTBEAT_MS, 20_000);
  assert.equal(SD_POSE_FRESH_MS, HEARTBEAT_MS + 5000, 'a still body\'s heartbeat keeps it');
  assert.ok(SD_POSE_FRESH_MS < ABSENT_RETIRE_MS, 'absent before its share is retired');
  await withRealm(async ({ realm, cell, mara, beat, hello, step, now }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -10));
    await realm.raw(ann, JSON.stringify({ t: 'sd', k: 'in', lv: 30, bv: 1 }));
    await beat(SD_OPENING_MS + 1000);
    const f = realm.room._sdFight;
    assert.ok(f && f.players['acct-peer-ann'], 'in the fight');
    const subs = () => realm.room._sdFightBodies(f, now()).map((b) => b.sub);
    await realm.pose(ann, inArenaAt(1, -10));
    assert.equal(realm.room._all().get(ann).pAt, now(), 'its pose stamped');
    assert.deepEqual(subs(), ['acct-peer-ann']);
    step(SD_POSE_FRESH_MS);
    assert.deepEqual(subs(), ['acct-peer-ann'], 'a heartbeat late: still standing');
    step(1);
    assert.deepEqual(subs(), [], 'frozen past it: absent');
    await realm.pose(ann, inArenaAt(1, -10));
    assert.deepEqual(subs(), ['acct-peer-ann'], 'posing again: back');
    await cell.pose(mara, doorPose(11));
    assert.equal(cell.room._all().get(mara).pAt, undefined, 'a cell\'s pose: no stamp');
  });
  assert.match(RELAY, /this\._sdFightFan\(stepRemnant\(f, now, this\._sdFightBodies\(f, now\), rand01\)\);/);
});

// ── F4: a blow strikes a fighter ───────────────────────────────────────

test('SD20a A BLOW STRIKES A FIGHTER (F4): a page the realm has not counted in its fight - one that walked into the arena in the End\'s tail, its `in` refused - is shown the Hour\'s End and struck by none of it; counted, the same End strikes (mutant: every page in the arena judged)', () => {
  const run = (counted) => {
    let clock = T0 + 20_000;
    const L = createSdFightLink({ now: () => clock });
    const f = newRemnantFight(4, 1, T0); joinRemnant(f, 'a', 'A', 30, T0);
    L.word(validSdOut({ ...remnantStateOf(f), ...(counted ? { me: 1 } : {}) }));
    assert.equal(L.counted(), counted);
    const struck = [];
    const B = createSdRemnantBlows({ link: L, feet: () => arenaToDungeon(0, 6), grounded: () => true, player: () => ({ health: 200, maxHealth: 200 }), strike: (dmg, how) => struck.push({ dmg, how }) });
    const A0 = T0 + 21_000;
    L.word(validSdOut({ k: 'atk', b: SD_BODY.hour, i: 9, a: SD_BLOWS.end.id, at: A0, x: 0, z: 0, yw: 0, tg: [] }));
    let drew = false;
    for (let t = A0 - 1500; t <= A0 + 500; t += 50) { clock = t; B.frame(); drew = drew || B.shapes().length > 0; }
    return { struck, drew };
  };
  const out = run(false), inn = run(true);
  assert.equal(out.drew, true, 'shown');
  assert.deepEqual(out.struck, [], 'never struck');
  assert.equal(inn.struck.length, 1, 'a fighter: struck');
  assert.equal(inn.struck[0].how.name, SD_BLOWS.end.name);
});

// ── F5, F6: the Reset's race ───────────────────────────────────────────

test('SD20a THE RESET\'S RACE (F5, F6): the Hardened Hearts take a party at reference damage no more than half the time they stand open - the other half is the run between them; a Pulse due inside a Reset waits until SD_PULSE_CLEAR_MS past its landing, and a Reset due inside a Pulse\'s wind-up waits for it to land - over a long Last Moment, never one atop the other (mutants: the Hardened half again; the Pulse through the Reset; the Reset inside the Pulse; no clearance)', () => {
  // F5: three seconds of the living's damage between the Hearts, a quarter again Hardened - 3.75 s of the 7.5 s they stand
  const hardened = SD_OMENS.find((o) => o.id === 'hardened');
  const open = SD_BLOWS.reset.windup - SD_HEARTS_CLOSE_MS;
  assert.ok(SD_HEART.teamS * hardened.law.heartX * 1000 <= open / 2, `the Hearts' share of their window: ${SD_HEART.teamS * hardened.law.heartX} s of ${open / 1000}`);
  assert.equal(hardened.text, 'Its Hearts hold a quarter again as much.');
  // F6: a Pulse due inside the Reset's race
  assert.equal(SD_PULSE_CLEAR_MS, 4000);
  const wake = T0 + SD_OPENING_MS;
  const last = (f) => { f.phase = 3; f.hp = 0.3 * f.max; f.outUntil = wake; f.rem = { ...f.rem, x: 0, z: 0 }; return f; };
  const a = last(fight(4, 6, 40));
  a.resetAt = wake; a.pulseAt = wake + 5000;
  const fa = beatTo(a, wake, wake + 30_000, () => ringOf(a, 10), seeded(3));
  const ra = fa.find(isReset), pa = fa.find(isPulse);
  assert.ok(ra && ra.now === wake, 'the Reset called at once');
  assert.equal(pa.at, ra.at + SD_PULSE_CLEAR_MS, 'the Pulse waits until four seconds past the Reset\'s landing');
  assert.equal(a.pulseAt, pa.at + sdFightProfile(sdMarksOf(4)).pulseMs, 'and the next a whole clock after it');
  // a Reset due inside a Pulse's wind-up
  const b = last(fight(4, 6, 40));
  b.resetAt = wake + 1000; b.pulseAt = wake + 3000; b.rem.nextAt = wake + 1000;
  const fb = beatTo(b, wake, wake + 30_000, () => ringOf(b, 10), seeded(3));
  const pb = fb.find(isPulse), rb = fb.find(isReset);
  assert.equal(pb.at, wake + 3000);
  assert.ok(rb && rb.now >= pb.at + SD_BLOWS.pulse.active, `the Reset called after the Pulse lands: ${rb?.now - pb.at}`);
  // a long Last Moment, its Hearts never broken: never one atop the other
  const c = last(fight(4, 6, 40));
  c.resetAt = wake + 1000;
  const fc = beatTo(c, wake, wake + 8 * 60_000, () => ringOf(c, 10), seeded(9));
  const resets = fc.filter(isReset), pulses = fc.filter(isPulse);
  assert.ok(resets.length >= 6 && pulses.length >= 12, `${resets.length} Resets, ${pulses.length} Pulses`);
  for (const r of resets) {
    for (const p of pulses) {
      assert.ok(!(p.at >= r.now && p.at < r.at + SD_PULSE_CLEAR_MS), `a Pulse landing at ${p.at - wake} inside the Reset of ${r.now - wake}-${r.at - wake}`);
      assert.ok(!(r.now >= p.at - SD_BLOWS.pulse.windup && r.now < p.at + SD_BLOWS.pulse.active), `a Reset called at ${r.now - wake} inside the Pulse landing at ${p.at - wake}`);
    }
  }
});

// ── F7: the rim ────────────────────────────────────────────────────────

test('SD20a THE RIM IS STOMPED (F7): a body keeps 19 m from the arena\'s centre, so a fighter hugging the rim stands inside the Stomp\'s reach of the Remnant and of an Echo - at 18 the rim was the one place melee\'s punisher never reached; a lone fighter there is stomped (mutant: the old keep)', () => {
  assert.equal(SD_REM.keep, 19);
  const rim = SD_ARENA.r - CAPSULE_RADIUS;
  assert.ok(rim - SD_REM.keep - SD_REM.r <= SD_BLOWS.stomp.range, 'the Remnant reaches the rim');
  assert.ok(rim - SD_REM.keep - SD_ECHO.r <= SD_BLOWS.stomp.range, 'and an Echo');
  const f = fight(4, 1, 30);
  const wake = T0 + SD_OPENING_MS;
  const out = beatTo(f, wake, wake + 120_000, () => [{ sub: 'p0', x: 0, z: -rim, dead: false }], seeded(7));
  const stomps = out.filter((x) => x.k === 'atk' && x.b === SD_BODY.remnant && x.a === SD_BLOWS.stomp.id);
  assert.ok(stomps.length >= 1, `stomped at the rim: ${stomps.length}`);
});

// ── F8, F9: the pillar's top, the Hearts' floor ────────────────────────

test('SD20a A PILLAR SHADES WHAT STANDS BELOW ITS TOP (F8): fourteen metres up, a Levitate\'s reach, the top of a pillar was the one place the Hour-Hand never struck - a body on it stood inside the square that shades; feet on or over a top are shaded by no pillar, in the verdict, the rig and the read; a body behind a pillar on the floor is shaded as ever (mutants: the top shaded; the rig never over; the read shaded; the host never tells it; over from the floor)', () => {
  assert.equal(SD_PILLAR_OVER_Y, SD_PILLAR_H - 0.5);
  const [px, pz] = SD_PILLARS[0], at = T0 + 30_000;
  const hand = { i: 7, a: SD_BLOWS.hand.id, at, x: 0, z: 0, yw: Math.atan2(px, pz), sw: 1, tg: [] };
  const judged = (x, z, over) => {
    const hits = [];
    let seen = {}, done = false;
    for (let t = at - 100; t <= at + SD_BLOWS.hand.active + 300 && !done; t += 20) { const v = sdBlowVerdict(hand, x, z, t - 20, t, true, seen, over); seen = v.seen; done = v.done; hits.push(...v.hits); }
    return hits.map((h) => h.part);
  };
  assert.equal(behindPillar(0, 0, px, pz), true, 'its own top is inside its square');
  assert.deepEqual(judged(px, pz, false), [], 'as it was: shaded on its top');
  assert.deepEqual(judged(px, pz, true), ['beam'], 'on its top: struck');
  assert.deepEqual(judged(px * 1.25, pz * 1.25, false), [], 'behind it on the floor: shaded, as ever');
  assert.deepEqual(judged(px * 0.6, pz * 0.6, false), ['beam'], 'before it: struck, as ever');
  // the read says what the verdict does
  const s = { fi: 1, ph: 1, rem: { atk: hand }, ec: [] };
  assert.equal(sdPerilAt(s, at - 500, px, pz, 0, false), null, 'shaded: no peril');
  assert.equal(sdPerilAt(s, at - 500, px, pz, 0, true)?.name, SD_BLOWS.hand.name, 'on its top: the Hand');
  // the rig: feet on the top, the Hand lands; on the floor behind it, it does not
  const rig = (y, k = 1) => {
    let clock = at - 2000;
    const L = createSdFightLink({ now: () => clock });
    const f = newRemnantFight(4, 1, T0); joinRemnant(f, 'a', 'A', 30, T0);
    L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
    const struck = [];
    const B = createSdRemnantBlows({ link: L, feet: () => realmToDungeon(SD_ARENA.x + px * k, y, SD_ARENA.z + pz * k), grounded: () => true, player: () => ({ health: 200, maxHealth: 200 }), strike: (dmg, how) => struck.push(how.name) });
    L.word(validSdOut({ k: 'atk', b: SD_BODY.remnant, ...hand }));
    let over = null;
    for (let t = at - 1000; t <= at + SD_BLOWS.hand.active + 500; t += 50) { clock = t; B.frame(); over ??= B.over(); }
    return { struck, over };
  };
  assert.deepEqual(rig(SD_PILLAR_H), { struck: [SD_BLOWS.hand.name], over: true });
  assert.deepEqual(rig(0, 1.25), { struck: [], over: false });
  assert.match(W, /sdPerilAt\(s, now, x - SD_ARENA\.x, z - SD_ARENA\.z, cam\.yaw, !!sdBlows\?\.over\?\.\(\)\)/);
});

test('SD20a THE HEARTS\' FLOOR (F9): never more than one second of the living\'s damage - a lone fighter at level one met three Hearts of 20, ten seconds of its damage in the 7.5 they stand, and every Reset landed; its three are three seconds now, and a strong fighter\'s floor is SD_HEART.min as ever (mutant: the old floor)', () => {
  assert.equal(heartCountFor(1), 3);
  for (const lv of [1, 2, 3, 5]) {
    const each = heartHpFor([lv], 3);
    assert.equal(each, Math.max(Math.min(SD_HEART.min, dpsRef(lv)), Math.round(dpsRef(lv))), `level ${lv}`);
    assert.ok((3 * each) / dpsRef(lv) <= SD_HEART.teamS + 0.5, `level ${lv} alone: its three Hearts ${(3 * each) / dpsRef(lv)} s of its damage`);
  }
  assert.equal(heartHpFor([30], 8), SD_HEART.min, 'a strong fighter: the floor as it was');
  assert.equal(heartHpFor([30, 30, 30, 30], 5), Math.round((3 * 4 * dpsRef(30)) / 5), 'a party: three seconds between them');
});

// ── F10: the Hour's own costs ──────────────────────────────────────────

test('SD20a THE HOUR\'S COSTS ARE SETBACKS (F10): the void\'s cast-back and the Orrery\'s lash take their share, no shield taking it, and leave a body at one - never the death that ends a Hollow with one life a Hollow; the death presenter is never reached (mutants: the void kills; the lash kills)', () => {
  let died = 0;
  setDeathPresenter(() => { died++; });
  setAvoidDeathHook(() => false);
  try {
    const e = { health: 10, maxHealth: 100, activeEffects: [] };
    const said = [];
    const cast = new Function('playerEntity', 'hurtPlayer', 'flashPlayerDamage', 'SD_CAST_BACK_LOSS', 'sdSay', 'SD_STEPS_TEXT', `${fnOf('sdCastBack')}\nreturn sdCastBack;`)(e, hurtPlayer, () => {}, SD_CAST_BACK_LOSS, (t) => said.push(t), { cast: 'cast back' });
    cast();
    assert.deepEqual([e.health, died], [1, 0], 'the void: at one');
    cast();
    assert.deepEqual([e.health, died], [1, 0], 'and again: at one');
    const g = { health: 5, maxHealth: 100, activeEffects: [] };
    const [hx, , hz] = realmToDungeon(0, 0, 0);
    const env = {
      modes: { sdRealmSlot: () => 4 }, sdSay: () => {}, sdDungeonToRealm: () => [0, 0, 0], player: { pos: [hx, 0, hz] }, playerEntity: g,
      inOrreryHall: () => true, SD_FRAY_LASH, hurtPlayer, flashPlayerDamage: () => {}, online: { id: 'peer-me' },
      SD_HALL_TEXT: { snap: 'The Hour snaps back.' }, SD_TURN_WAIT_LINE: 'wait',
    };
    const heard = new Function(...Object.keys(env), `let _sdHall = null;\n${fnOf('sdHallHeard')}\nreturn sdHallHeard;`)(...Object.values(env));
    assert.ok(Math.round(100 * SD_FRAY_LASH) >= 5, 'a lash that would kill');
    heard({ k: 'pz', s: 4, st: [0, 0, 0, 0, 0, 0], f: 0, lit: 0, ok: false, i: 0, a: 1, id: 'peer-x', q: 48, x: 1, ls: ['peer-me'] });
    assert.deepEqual([g.health, died], [1, 0], 'the lash: at one');
  } finally { setDeathPresenter(null); setAvoidDeathHook(null); }
});
