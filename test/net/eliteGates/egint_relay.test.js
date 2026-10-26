// EG-H1 (EG8d, 2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 21, with 10.8, 13.2
// and 15): WHAT THE RELAY JUDGES, played against the real Room (test/fakeRoom.mjs) and the director's own law - THE TIME LAW
// (a pose at the instant it was sent: an honest dodge in a landing's last round trip never counted, a forged early stamp
// held to the law), ONE JUDGE FOR EVERY SHAPE (judgeShapes by the FULL stamp, per fight floor; the hall's own hazards),
// THE FAIR TRAIL (a teleport opens no door, a walk does; repeats refuse a member's hits; the room's wake), RIDDEN POSES (a
// pose on a moving piece judged on the piece's clock position), THE CLOCK CORRECTED, THE FEINT'S CUT, WATCHFIRE'S TELL AND
// ITS UNTELL, THE UNION FLOOR in time with the place in its set (net/eliteGates/egFloor.js), and THE BODY COUNTED - enforced in the
// Spire: a count at nothing is the member's one life, and a member alive by its own word is never felled.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../../fakeRoom.mjs';
import { EG_INTERNAL_OPEN, validEgOut, validEgIn, validPose, EG_KINDS, EG_OUT_KINDS, EG_FIGHT_KINDS, POSE_TS_MOD } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egFloorTest, EG_SEALED_MS, EG_GATHER_MS, EG_CAST_BACK_LOSS, EG_CAST_BACK_FLOOR, EG_VOID_Y } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egAim, egBlowsStep, egFightNew, egTellTo, EG_TELL_LEAD_MS, EG_TELL_NEAR_M, EG_FARWATCH_MS, EG_FEINT_AT } from '../../../src/net/eliteGates/egBodies.js';
import { egLordsStep, egLordsNew, egLordsWake } from '../../../src/net/eliteGates/egLords.js';
import { egBlowOf, egBlowFrom, egWindupFloorMs, shDisc, shLane, shCone, shRing, shAll, shOut } from '../../../src/net/eliteGates/egShape.js';
import * as SHAPE from '../../../src/net/eliteGates/egShape.js';
import { egUnionHolds, egPlaceLandings, egBlowNear, egStampDist, EG_UNION_HOLD_TICKS } from '../../../src/net/eliteGates/egFloor.js';
import { egPoseClock, egPoseShared, egTrailPush, egTrailAt, egTrailAfter, egFairNew, egFairPose, egFairOk, egFairRefuses, egFairBlind, egFairMeasure, egCrossMinMs, egRideOf, egRideAt, egRideHolds,
  egSupportAt, egFightFloorAt, EG_HOLD, EG_FAST_RUN_MPS, EG_TS_LAG_MAX_MS, EG_POSE_WAIT_MS, EG_AIR_MAX_S, EG_FAIR_REPEAT_MS, EG_BLIND_MS, EG_RIDE_KINDS } from '../../../src/net/eliteGates/egFair.js';
import { egClockNew, egClockDue, egClockHeard, egClockOffset, egClockHalfRtt, EG_CLOCK_SAMPLES, EG_CLOCK_SPACING_MS, EG_CLOCK_EVERY_MS } from '../../../src/net/eliteGates/egClock.js';
import { judgeShapes, judgePlace } from '../../../src/net/bossRef.js';
import { egBreachNew, egEnter, egStep, egBlow, egCount, egCountHeals, EG_BODY_ENFORCE } from '../../../src/net/eliteGates/egBrain.js';
import { egHazardParts } from '../../../src/net/eliteGates/egFragLaw.js';
import { egPieceAt } from '../../../src/net/eliteGates/egSpanLaw.js';
import { runSpeed } from '../../../src/player/motor.js';
import { TELL } from '../../../src/ai/tells.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 3]);
});

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const B = 'feedfacecafe0123';
const SEED = 12345;
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const SUBS = ['acct-mac', 'acct-ann', 'acct-bob', 'acct-dee'];
const LINE = { depth: 1, perS: 0.05 };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
/** A Spire-frame point (hall `spec`'s own x) as a pose in the dungeon's frame. */
const poseAt = (spec, x, z, y = 0, extra = {}) => { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0, ...extra }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');
const tsOf = (wall) => ((wall % POSE_TS_MOD) + POSE_TS_MOD) % POSE_TS_MOD;
/** The support's height under (x, z) on hall `spec` at shared second `tS` - an honest walker's feet (else where they were). */
function floorY(spec, x, z, tS, prev) {
  let y = null;
  const up = (v) => { y = Math.max(y ?? -Infinity, v ?? 0); };
  for (const d of spec.discs) if (Math.hypot(x - d.x, z - d.z) <= d.r) up(d.y);
  for (const b of spec.bands) if (z >= b.z0 && z <= b.z1 && Math.abs(x - b.x) <= b.halfW) up(b.y);
  for (const s of spec.steps) { const q = egPieceAt(s, tS); if (q.solid && Math.abs(x - (s.x + q.dx)) <= s.w / 2 && Math.abs(z - (s.z + q.dz)) <= s.d / 2) up(s.y); }
  return y ?? prev;
}

/**
 * A BREACH'S ROOM with `n` members gathered at hall `h`'s arrival plate and its trial begun - the room opened by its own
 * internal door, each member admitted by its own signed order. `fn` gets the room, its beat, the live record, the hall
 * and each member's socket.
 */
async function withSpire(fn, { n = 2, h = 2 } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const eg = fakeRoom(egRoomKey(B), { now: () => clock });
  try {
    await quiet(async () => {
      const co = SUBS.slice(0, n).map((s, i) => [s, `M${i}`, i + 1]);
      const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE }) }));
      assert.equal(res.status, 200);
      const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      clock += EG_SEALED_MS; await beat(1000);
      const rec = () => eg.room._eg;
      const spec = egHallOf(SEED, h, 0), first = egHallOf(SEED, 1, 0);
      const socks = {};
      for (const [i, [sub]] of co.entries()) {
        const ws = eg.connect();
        await eg.hello(ws, `peer-${sub}`, poseAt(first, first.arrive.x, first.arrive.z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
        const z = await mintEgOrder({ o: 'egadmit', s: sub, eb: B, ez: `${'a'.repeat(19)}${i}` }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
        socks[sub] = ws;
      }
      // the company starts at hall `h` (test/net/eliteGates/egfull_relay.test.js's `start`), once every member is admitted
      if (h > 1) { const R = rec(); R.h = h; R.sg = 'arrive'; R.wk = clock; R.cnt = { left: 1_800_000, at: clock }; R.pulledAt = clock; R.su = clock + 30_000; }
      for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
      await beat(EG_GATHER_MS + 1000);
      assert.equal(rec().sg, 'trial', 'the hall woke');
      await fn({ eg, beat, rec, spec, socks, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
/** A plain blow (no element) thrown into the room's live fight now - said at once, its landing `at`. */
const throwBlow = (R, spec, s, at, now, p = 0.4, el = null) => egAim(R.F, spec, { o: 0, s: [s], at, wu: at - now, p, b: 0, el, nm: 'Test Blow' }, [], now, []);

test('EG-H1 THE WIRE (sections 21, 10.8, 15 and 23): a member\'s word of its body (`vt`, thousandths) and the shared clock\'s ping (`clk`, its number and the one-way delay its clock measured); the count\'s fall (`bd`), the clock\'s answer, Watchfire\'s `tell` (the blow\'s FULL stamp and the lead shown) and the union floor\'s `untell`; a pose on a moving piece carries `pl` - bounded, omitted off a piece, never clamped into one (mutants: `vt` past the whole; a tell with no lead; a ride offset unbounded)', () => {
  for (const k of ['vt', 'clk']) assert.ok(EG_KINDS.includes(k), k);
  for (const k of ['bd', 'clk', 'tell', 'untell']) assert.ok(EG_OUT_KINDS.includes(k), k);
  for (const k of ['tell', 'untell']) assert.ok(EG_FIGHT_KINDS.includes(k), `${k} folds into the fight`);
  assert.deepEqual(validEgIn({ k: 'vt', v: 640, x: 1 }), { k: 'vt', v: 640 });
  assert.equal(validEgIn({ k: 'vt', v: 1001 }), null, 'a body past the whole');
  assert.deepEqual(validEgIn({ k: 'clk', c: 7, h: 150 }), { k: 'clk', c: 7, h: 150 });
  assert.deepEqual(validEgIn({ k: 'clk', c: 7, h: -3 }), { k: 'clk', c: 7 }, 'a delay out of bounds is not said');
  assert.deepEqual(validEgOut({ k: 'bd', x: 1 }), { k: 'bd' });
  assert.deepEqual(validEgOut({ k: 'clk', c: 7, now: T0 }), { k: 'clk', c: 7, now: T0 });
  const blow = { i: 4, o: 1, s: [['d', 2, 40, 3]], at: T0 + 1500, wu: 1500, p: 0.2, b: 4, el: null, nm: 'Cleave', ch: 0, pu: 0, sp: 0 };
  assert.deepEqual(validEgOut({ k: 'tell', ...blow, sh: 350 }), { k: 'tell', ...blow, sh: 350 });
  assert.equal(validEgOut({ k: 'tell', ...blow }), null, 'a tell says the lead it shows');
  assert.equal(validEgOut({ k: 'tell', ...blow, sh: 401 }), null, 'never more than the lead the brain commits');
  assert.deepEqual(validEgOut({ k: 'untell', i: 4 }), { k: 'untell', i: 4 });
  const p = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 };
  assert.deepEqual(validPose({ ...p, pl: [3, 0.123, 0, -1.5] }).pl, [3, 0.12, 0, -1.5]);
  assert.equal('pl' in validPose(p), false, 'off a piece the pose keeps its bytes');
  for (const bad of [[3, 9, 0, 0], [256, 0, 0, 0], [3, 0, 0], [-1, 0, 0, 0], [3, NaN, 0, 0]]) assert.equal('pl' in validPose({ ...p, pl: bad }), false, `no ride: ${bad}`);
});

test('EG-H1 THE TIME LAW (section 21, "Time, before enforcement"): a pose stands at its SHARED time - its own `ts` unwrapped, plus the least `arrival - ts` of its socket, less the one-way delay its corrected clock said - never later than it arrived, never before its last, never more than EG_TS_LAG_MAX_MS early; backwards, nothing. Played in the room: a dodge sent at the landing less 50 ms at a 300 ms round trip is NEVER counted; the same dodge from a clock that said no delay is (the welcome\'s error, paid); a stamp forged 600 ms early is held to the law and its blow counted (mutants: the delay ignored; the stamp trusted whole; the clamp to the last pose dropped)', async () => {
  // pure: a socket whose wall clock is skewed and wraps, 150 ms each way
  const C = egPoseClock();
  C.h = 150;
  const skew = POSE_TS_MOD - 40_000;   // its wall clock wraps within the run
  let last = -Infinity;
  for (let k = 0; k < 40; k++) {
    const sent = T0 + k * 100, arr = sent + 150 + (k % 5 === 0 ? 60 : 0);
    const t = egPoseShared(C, tsOf(sent + skew), arr);
    assert.ok(t <= arr && t >= arr - EG_TS_LAG_MAX_MS && t >= last, `pose ${k} held to the law`);
    if (k >= 1) assert.ok(Math.abs(t - sent) <= 1, `pose ${k} stands at the instant it was sent (${t - sent})`);
    last = t;
  }
  assert.equal(egPoseShared(C, tsOf(T0 + 3900 + skew - 500), T0 + 4200), null, 'a stamp running backwards judges nothing');
  const M = egPoseClock();
  let lastM = -Infinity;
  for (let k = 0; k < 10; k++) { if (k === 5) M.h = 150; const tm = egPoseShared(M, tsOf(T0 + k * 100), T0 + k * 100 + 100); assert.ok(tm >= lastM, `a delay said late never stands a pose before its last (${k})`); lastM = tm; }   // its first answer came after five poses
  const U = egPoseClock();
  for (let k = 0; k < 10; k++) egPoseShared(U, tsOf(T0 + k * 100), T0 + k * 100 + 150);
  assert.equal(egPoseShared(U, tsOf(T0 + 1000), T0 + 1150), T0 + 1150, 'a clock that said no delay: the quickest way\'s end, never before');
  assert.equal(egPoseShared(egPoseClock(), undefined, T0 + 5), T0 + 5, 'no `ts`: at its arrival');
  const F2 = egPoseClock();
  F2.h = 150;
  for (let k = 0; k < 10; k++) egPoseShared(F2, tsOf(T0 + k * 100), T0 + k * 100 + 150);
  assert.equal(egPoseShared(F2, tsOf(T0 + 400), T0 + 1150), null, 'a stamp forged before its last: out of order, it judges nothing');
  assert.equal(egPoseShared(F2, tsOf(T0 + 1000), T0 + 1800), T0 + 1800 - EG_TS_LAG_MAX_MS, 'a pose held up on its way: never more than the law before its arrival');
  // the room: a span's passage floor (hall 2), four members - a stander, a corrected dodger, a forger, an uncorrected dodger
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann, bob, dee] = SUBS;
    for (const sub of [mac, ann, bob]) await eg.raw(socks[sub], JSON.stringify({ t: 'eg', k: 'clk', c: 1, h: 150 }));   // dee's clock says no delay
    const skewOf = { [mac]: 5_000, [ann]: -7_000, [bob]: 1234, [dee]: 300 };
    const where = { [mac]: [0, cz], [ann]: [0, cz], [bob]: [0, cz], [dee]: [0, cz] };
    const q = [];   // poses on their way: [arrival, sub, pose]
    const sendAll = (sentAt) => { for (const sub of SUBS) { const [x, z] = where[sub]; q.push([sentAt + 150, sub, poseAt(spec, x, z, 0, { ts: tsOf(sentAt + skewOf[sub]) })]); } };
    const run = async (ms, also = () => {}) => {
      for (let t = 0; t < ms; t += 50) {
        const n = now();
        also(n); sendAll(n);   // a pose every 50 ms (the pose gate's 20 Hz)
        q.sort((a, b) => a[0] - b[0]);
        while (q.length && q[0][0] <= n) { const [, sub, p] = q.shift(); await eg.pose(socks[sub], p); }
        await beat(50);
      }
    };
    await run(1600);
    const at = now() + 1500;
    const blow = throwBlow(rec(), spec, shDisc(0, cz, 3), at, now());
    assert.ok(blow && blow.at >= at, 'the blow said');
    const dodge = [0, cave.az + 1.2];   // out of the disc, still on the passage's floor
    await run(2200, (n) => {
      if (n === at - 50) { where[mac] = dodge; where[dee] = dodge; }   // their dodge's first pose: the landing less 50 ms, by the shared clock
      if (n === at + 100) where[ann] = dodge;   // ann's comes after it landed
    });
    const R = rec(), v = (sub) => R.mem[sub].bd?.v ?? 1;
    assert.equal(v(bob), 0.6, 'the stander counted');
    assert.equal(v(mac), 1, 'the corrected dodge never counted');
    assert.equal(v(dee), 0.6, 'the same dodge from a clock that said no delay is counted - its poses stand a one-way late');
    assert.equal(v(ann), 0.6, 'a dodge after the landing counted');
    assert.deepEqual(R.mem[bob].cs, [1, 0, 0, 400], 'the census: one blow, its thousandths');
  }, { n: 4, h: 2 });
});

test('EG-H1 A STAMP FORGED EARLY (the time law\'s clamps, in the room): a member who stood in the blow through its landing and then says a pose stamped 600 ms before it - out of the shape - is placed no earlier than its last pose; where it stood at the landing is where it stood, and its blow is counted (mutants: the stamp trusted; the clamp to the last pose gone)', async () => {
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann] = SUBS;
    await eg.raw(socks[ann], JSON.stringify({ t: 'eg', k: 'clk', c: 1, h: 150 }));
    const send = async (sub, x, z, sentAt) => eg.pose(socks[sub], poseAt(spec, x, z, 0, { ts: tsOf(sentAt) }));
    for (let k = 0; k < 16; k++) { await send(ann, 0, cz, now() - 150); await send(mac, 3, cz, now() - 150); await beat(100); }
    const at = now() + 1200;
    throwBlow(rec(), spec, shDisc(0, cz, 3), at, now());
    while (now() < at + 300) { await send(ann, 0, cz, now() - 150); await send(mac, 3, cz, now() - 150); await beat(100); }
    const before = eg.room._egTrailsBy.get(ann).tr.length;   // PIN MOVED (AUDIT EG III, lane3 #3): the trail is the account's
    await send(ann, 0, cave.az + 1.2, at - 600);   // forged: "I left before it landed"
    const tr = eg.room._egTrailsBy.get(ann).tr;
    assert.equal(tr.length, before, 'a stamp before its last is out of order - never placed');
    assert.equal(tr.at(-1)[3], cz, 'where it stood is where it stood');
    await beat(1200);
    assert.equal(rec().mem[ann].bd?.v, 0.6, 'the forged stamp bought nothing - counted');
    assert.equal(rec().mem[mac].bd?.v ?? 1, 1, 'the member beside the blow never counted');
  }, { n: 2, h: 2 });
});

test('EG-H1 ONE JUDGE FOR EVERY SHAPE (judgeShapes, net/bossRef.js): each stamp kind judged by its whole stamp on the shared-time trail - deep in it before the landing and after it, on a fight floor of the height it lands at; an element\'s blow seen (share 0), a plain one\'s share counted; a body silent through the landing, off the fight floor, or in another hall never counted; a landing waits for the first pose sent after it, or EG_POSE_WAIT_MS. Played in the room: a lane strikes the member in it and not the one beside it at the lane\'s own anchor (mutants: a disc judged at the anchor; the margin dropped; an element counted; the wait skipped)', async () => {
  const spec = egHallOf(SEED, 2, 0), cave = spec.fl[0], cz = (cave.az + cave.bz) / 2, h = 2;
  const tr = (x, z, y = 0, at = T0, hh = h) => [[at - 200, x, y, z, hh], [at - 100, x, y, z, hh], [at + 100, x, y, z, hh]];
  const F = { h, blows: [] };
  const mk = (s, el = null, p = 0.25) => { const b = egBlowOf({ i: F.blows.length + 1, s: [s], at: T0, wu: 1500, p, el }); F.blows.push(b); return b; };
  mk(shLane(-2, cz - 4, -2, cz + 4, 4));
  mk(shCone(0, cave.az, 0, 9, 90));
  mk(shRing(0, cz, 2, 9));
  mk(shAll());
  mk(shOut([[0, cz, 2.5]]));
  mk(shDisc(0, cz, 3), 'fire');
  const bodies = [
    { sub: 'lane', tr: tr(-2, cz) }, { sub: 'edge', tr: tr(-0.5, cz) }, { sub: 'cone', tr: tr(0, cave.az + 6) }, { sub: 'wing', tr: tr(2.5, cave.az + 1) }, { sub: 'ring', tr: tr(0, cz - 4.2) },
    { sub: 'haven', tr: tr(0, cz) }, { sub: 'up', tr: tr(-2, cz, 4) }, { sub: 'hall', tr: tr(-2, cz, 0, T0, 3) }, { sub: 'silent', tr: [[T0 - 900, -2, 0, cz, h], [T0 + 600, -2, 0, cz, h]] },
  ];
  const early = judgeShapes(F, bodies.map((b) => ({ sub: b.sub, tr: b.tr.filter((e) => e[0] <= T0) })), T0 + 50, spec);
  assert.equal(early.length, 0, 'no pose sent after the landing yet, and the wait not over: not judged');
  const out = judgeShapes(F, bodies, T0 + 150, spec);
  const by = (sub) => out.filter((o) => o.sub === sub).map((o) => o.i).sort();
  assert.ok(by('lane').includes(1) && !by('edge').includes(1), 'the lane by its own width: in it struck, at its edge (not deep) not');
  assert.ok(by('cone').includes(2) && !by('wing').includes(2), 'the cone by its arc and reach - beside its apex, outside its arc, never');
  assert.ok(['lane', 'edge', 'cone', 'wing', 'ring', 'haven'].every((sub) => by(sub).includes(4)), 'the whole floor: every body on it');
  assert.ok(by('ring').includes(3) && !by('haven').includes(3), 'the ring\'s band, never its safe heart');
  assert.ok(by('haven').includes(6) && out.find((o) => o.sub === 'haven' && o.i === 6).share === 0, 'an element\'s blow is seen and takes nothing');
  assert.ok(!by('haven').includes(5) && by('ring').includes(5), 'outside the havens: the haven spares, the rest is struck');
  assert.equal(out.find((o) => o.sub === 'lane' && o.i === 1).share, 0.25, 'a plain blow\'s share');
  for (const sub of ['up', 'hall', 'silent']) assert.deepEqual(by(sub), [], `${sub}: never counted`);
  assert.deepEqual(judgeShapes(F, bodies, T0 + 200, spec), [], 'each blow once a body');
  // THE HALL'S OWN HAZARDS (judgePlace): the Falling Basalt (plain) counted, a Rampart's vent (fire) seen
  const dw = egHallOf(SEED, 12, 0), bas = dw.hazards.find((q) => q.kind === 'basalt');
  let live = 0;
  for (let t = T0; t < T0 + 20_000 && !live; t += 50) if (egHazardParts(bas, t / 1000).some((p) => p.st === 'live')) live = t;
  const part = egHazardParts(bas, live / 1000).find((p) => p.st === 'live');
  const Fd = { h: 12 }, body = { sub: 's', tr: [[live - 100, part.sh[1], 0, part.sh[2], 12], [live + 100, part.sh[1], 0, part.sh[2], 12]] }, far = { sub: 'f', tr: [[live - 100, part.sh[1] + 9, 0, part.sh[2], 12], [live + 100, part.sh[1] + 9, 0, part.sh[2], 12]] };
  const cut = (b, t) => ({ sub: b.sub, tr: b.tr.filter((e) => e[0] <= t) });
  assert.deepEqual(judgePlace(Fd, dw, 0, [cut(body, live), cut(far, live)], live), [], 'found live, waiting for a pose after it');
  const got = judgePlace(Fd, dw, 0, [body, far], live + 150);
  assert.deepEqual(got.map((o) => [o.sub, o.share, o.k]), [['s', 0.2, 1]], 'the basalt struck its member, not the one 9 m off');
  const rp = egHallOf(SEED, 4, 0), v0 = rp.vents[0], Fr = { h: 4 }, hw = T0 - 1600, fireAt = hw - v0.phase + v0.cycle - 500;
  const inV = { sub: 'v', tr: [[fireAt - 100, v0.x, 0, v0.z, 4], [fireAt + 100, v0.x, 0, v0.z, 4]] };
  judgePlace(Fr, rp, hw, [cut(inV, fireAt + 10)], fireAt + 10);
  assert.deepEqual(judgePlace(Fr, rp, hw, [inV], fireAt + 150).map((o) => [o.share, o.k]), [[0, 1]], 'a vent\'s fire seen, its save the member\'s own');
  // the room: a lane on the passage's floor, a member in it and one beside it at the lane's anchor
  await withSpire(async ({ eg, beat, rec, spec: s2, socks, now }) => {
    const c2 = s2.fl[0], z2 = (c2.az + c2.bz) / 2, [mac, ann] = SUBS;
    const stand = async () => { await eg.pose(socks[mac], poseAt(s2, -1.5, z2)); await eg.pose(socks[ann], poseAt(s2, 1.6, c2.az + 0.6)); };
    for (let k = 0; k < 6; k++) { await stand(); await beat(100); }
    const at = now() + 1500;
    throwBlow(rec(), s2, shLane(-1.5, c2.az, -1.5, c2.bz, 4), at, now());
    while (now() < at + 900) { await stand(); await beat(100); }
    assert.equal(rec().mem[mac].bd?.v, 0.6, 'in the lane: counted');
    assert.equal(rec().mem[ann].bd?.v ?? 1, 1, 'beside it, by the lane\'s anchor: never');
  });
});

test('EG-H1 THE FAIR TRAIL (`spanFair`, net/eliteGates/egFair.js): support (a floor, a piece at its clock, a ride, a climb\'s hold), speed (THE FAST BUILD\'s run times 1.1 plus a carry - pinned to the motor), air (no airborne stretch past EG_AIR_MAX_S that is no fall), blindness (a gap judges nothing; a crossing over 30% blind opens no door), the last island (a fair pose on still ground ends the window - never the end plate), a cast-back no step, a second break refusing hits EG_FAIR_REPEAT_MS; the crossing\'s measure (mutants: the speed law off; the air law off; the island never ending the window; the blind share unread; repeats never refused)', () => {
  assert.ok(Math.abs(EG_FAST_RUN_MPS - runSpeed(100, 100) * 1.1) < 1e-9, 'THE FAST BUILD\'s run is the motor\'s, Fleetfoot III on it');
  const spec = egHallOf(SEED, 2, 0), a = spec.arrive, isl = spec.discs.find((d) => d.role === 'island');
  assert.equal(egSupportAt(spec, a.x, 0, a.z, 0), EG_HOLD.island, 'the arrival plate is an island');
  assert.equal(egSupportAt(spec, spec.end.x, 0, spec.end.z, 0), EG_HOLD.still, 'the end plate holds, and is no island');
  assert.equal(egSupportAt(spec, a.x, 4, a.z, 0), EG_HOLD.none, 'four metres over it, nothing holds');
  const s0 = spec.steps[0], q0 = egPieceAt(s0, 1.0);
  assert.equal(egSupportAt(spec, s0.x + q0.dx, s0.y, s0.z + q0.dz, 1.0), EG_HOLD.piece, 'a Drift at its clock');
  assert.equal(egSupportAt(spec, s0.x + q0.dx + 30, s0.y, s0.z, 1.0), EG_HOLD.none);
  // a walk, then a teleport, then an island
  const A = egFairNew(2);
  let t = T0;
  for (let k = 0; k < 6; k++, t += 100) egFairPose(A, spec, { x: a.x, y: 0, z: a.z + k * 0.6 }, t);
  assert.ok(egFairOk(A) && A.brk === 0, 'a walk on the plate is fair');
  egFairPose(A, spec, { x: spec.end.x, y: 0, z: spec.end.z }, t); t += 100;
  assert.equal(A.why, 'speed');
  assert.equal(egFairOk(A), false, 'a teleport breaks the law - at once, never a window late');
  egFairPose(A, spec, { x: spec.end.x, y: 0, z: spec.end.z + 0.5 }, t); t += 100;
  assert.equal(egFairOk(A), false, 'the end plate never ends the window');
  // a cast-back onto the island behind: no step
  egFairPose(A, spec, { x: isl.x, y: 0, z: isl.z }, t); t += 100;
  assert.equal(A.brks, 1, 'a cast-back onto still ground behind is no break');
  egFairPose(A, spec, { x: isl.x, y: 0, z: isl.z + 0.4 }, t); t += 100;
  assert.ok(egFairOk(A), 'a fair pose on an island ends the window');
  assert.equal(egFairRefuses(A, t), false, 'one break refuses nothing');
  egFairPose(A, spec, { x: isl.x, y: 0, z: isl.z + 40 }, t); t += 100;
  assert.equal(A.brks, 2);
  assert.ok(egFairRefuses(A, t) && !egFairRefuses(A, t + EG_FAIR_REPEAT_MS), 'a second break in the hall refuses its hits a while');
  // the air: hovering past EG_AIR_MAX_S breaks it; a fall does not
  const H = egFairNew(2);
  let u = T0;
  egFairPose(H, spec, { x: a.x, y: 0, z: a.z }, u);
  for (let k = 1; k * 100 <= (EG_AIR_MAX_S + 0.4) * 1000; k++) egFairPose(H, spec, { x: a.x, y: 3, z: a.z + 5.5 + k * 0.01 }, u + k * 100);
  assert.equal(H.why, 'air', 'hovering over the void past the air\'s law');
  const Fa = egFairNew(2);
  egFairPose(Fa, spec, { x: a.x, y: 0, z: a.z }, T0);
  for (let k = 1; k <= 40; k++) egFairPose(Fa, spec, { x: a.x, y: -0.5 * k, z: a.z + 5.5 }, T0 + k * 100);
  egFairPose(Fa, spec, { x: a.x, y: 0, z: a.z }, T0 + 4100);
  assert.equal(Fa.brks, 0, 'a fall and its cast-back break nothing');
  // a ride holds; blindness judges nothing, and too much of it opens no door
  const R1 = egFairNew(2);
  for (let k = 0; k < 40; k++) egFairPose(R1, spec, { x: 80, y: 0, z: s0.z, ride: true }, T0 + k * 100);
  assert.equal(R1.brks, 0, 'a ride the piece holds is support, wherever the raw pose said');
  // PIN MOVED (FIELD BUGS 2026-10-20f FAIR-STILL): its second gap stood still on the island, and a member standing still is seen
  // standing (egStillGap) - the blind crossing is the move to the island made long
  const Bl = egFairNew(2);
  egFairPose(Bl, spec, { x: a.x, y: 0, z: a.z }, T0);
  egFairPose(Bl, spec, { x: isl.x, y: 0, z: isl.z }, T0 + EG_BLIND_MS + 1600);
  assert.equal(Bl.brks, 0, 'a blind gap judges nothing, either way');
  egFairPose(Bl, spec, { x: isl.x, y: 0, z: isl.z + 0.3 }, T0 + EG_BLIND_MS + 2000);
  assert.ok(egFairBlind(Bl) && !egFairOk(Bl), 'a crossing more than 30% blind opens no door');
  const m = egFairMeasure(A, spec);
  assert.equal(m.length, 6);
  assert.equal(m[3], 2, 'the hall\'s breaks measured');
  assert.ok(egCrossMinMs(spec) > 0 && egCrossMinMs(spec) < (spec.end.z / EG_FAST_RUN_MPS) * 1000, 'the crossing\'s lower bound: the course at the fast build, less 15%');
});

test('EG-H1 THE FAIR TRAIL IN THE ROOM (section 21): a member teleported to the end plate opens no door; a member who walks the course to it does - the crossing measured; after the room is woken mid-hall, a member at the end plate opens it on the first arrival (`wake`); a second break in the hall refuses a member\'s hits while another\'s from the same place land (mutants: the door on any arrival; the walk refused; the wake deadlocking)', async () => {
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const [mac, ann, bob] = SUBS;
    // mac: from the plate, a teleport onto the end plate; bob: its trail begun on the end plate - neither opens the door
    await eg.pose(socks[mac], poseAt(spec, spec.arrive.x, spec.arrive.z)); await beat(100);
    for (let k = 0; k < 10; k++) { await eg.pose(socks[mac], poseAt(spec, spec.end.x, spec.end.z)); await eg.pose(socks[bob], poseAt(spec, spec.end.x + 1, spec.end.z)); await eg.pose(socks[ann], poseAt(spec, spec.arrive.x, spec.arrive.z)); await beat(100); }
    assert.equal(rec().sg, 'trial', 'a teleport to the end plate opens no door, nor a trail begun there');
    assert.equal(rec().mem[mac].fair.why, 'speed');
    assert.equal(rec().mem[bob].fair.why, 'start', 'a trail begins on the arrival plate');
    // ann walks the course, her feet on what holds them, at a run
    let z = spec.arrive.z, y = 0;
    while (rec().sg === 'trial' && z <= spec.end.z) {
      z = Math.min(spec.end.z, z + 0.7);
      y = floorY(spec, 0, z, now() / 1000, y);
      await eg.pose(socks[ann], poseAt(spec, 0, z, y));
      await eg.pose(socks[mac], poseAt(spec, spec.end.x, spec.end.z));
      await eg.pose(socks[bob], poseAt(spec, spec.end.x + 1, spec.end.z));
      await beat(100);
    }
    assert.equal(rec().sg, 'closing', 'the walk opens the door');
    // the step through it: the walker's believed, the teleported member's refused
    for (const sub of [ann, mac]) await eg.raw(socks[sub], JSON.stringify({ t: 'eg', k: 'down', h: 2 }));
    assert.deepEqual([rec().mem[ann].downH, rec().mem[mac].downH], [2, 0], '`down` asks a fair trail');
    const A = rec().mem[ann].fair;
    assert.equal(A.brks, 0, `the walk broke nothing (${A.why})`);
    assert.ok(A.cross > 0, 'its crossing measured');
  }, { n: 3 });
  // the wake: a hall woken, then the room re-woken with every saved trail unfair - the first arrival opens it, said
  await withSpire(async ({ eg, beat, rec, spec, socks }) => {
    const [mac] = SUBS;
    await eg.pose(socks[mac], poseAt(spec, spec.arrive.x, spec.arrive.z)); await beat(100);
    await eg.pose(socks[mac], poseAt(spec, spec.end.x - 2, spec.end.z - 9)); await beat(100);
    // the breach checkpointed as it stood (its fight's live context is no record - net/eliteGates/egBrain.js keeps the legion's
    // callbacks on it, which storage cannot clone: the durability slice's to keep off the record)
    const R0 = rec(), ctx = R0.F.legionCtx;
    delete R0.F.legionCtx;
    await eg.room._egSave(R0, Date.now(), true);
    R0.F.legionCtx = ctx;
    eg.wake();
    await eg.fire();
    for (let k = 0; k < 6 && rec().sg === 'trial'; k++) { await eg.pose(socks[mac], poseAt(spec, spec.end.x, spec.end.z)); await beat(250); }
    assert.equal(rec().sg, 'closing', 'the wake never deadlocks the door');
    assert.equal(rec().mem[mac].fair.wake, 1, 'and its measure says so');
  }, { n: 1 });
  // repeats refuse the hits (the director's own law, a Rift-Yard)
  const co = [['acct-mac', 'M', 1], ['acct-ann', 'A', 2]];
  const R = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-mac', o: 'M', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(R, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const sp = egHallOf(SEED, 1, 0), bodies = () => co.map(([sub]) => ({ sub, sx: sp.x0 + sp.arrive.x, z: sp.arrive.z, dead: false, at: now }));
  for (let k = 0; k < 200 && R.sg !== 'trial'; k++) { now += 250; egStep(R, now, bodies(), () => 0.5); }
  assert.equal(R.sg, 'trial');
  const rift = R.F.bodies.find((b) => b.hp > 0 && b.role === 2), stand = { sx: sp.x0 + rift.x, z: rift.z - 1.5 };
  R.mem['acct-mac'].fair = { ...egFairNew(R.h), k: `${R.h}:0`, brk: 1, brks: 2, refuse: now + EG_FAIR_REPEAT_MS };
  const hp = rift.hp;
  egBlow(R, 'acct-mac', { k: 'hit', i: rift.i, q: 1, d: 200, r: 0 }, stand, now);
  assert.equal(rift.hp, hp, 'a refused member\'s blow lands nothing');
  egBlow(R, 'acct-ann', { k: 'hit', i: rift.i, q: 2, d: 200, r: 0 }, stand, now);
  assert.ok(rift.hp < hp, 'another\'s from the same place lands');
});

test('EG-H1 RIDDEN POSES (section 10.8): a body on a Drift, a Rail or a Drum rides it - `pl` its piece and its offset from the piece\'s top (egRideOf), drawn and judged at the piece\'s place on the clock plus the offset (egRideAt), its offset held to the piece\'s top (egRideHolds). Played in the room: a rider\'s trail stands on its piece as the piece swings, its fair trail held, wherever its raw pose said; a ride its piece cannot hold is no ride (mutants: the raw pose judged; any offset held; a still slab ridden)', async () => {
  const spec = egHallOf(SEED, 2, 0), s0 = spec.steps[0];
  assert.ok(EG_RIDE_KINDS.includes(s0.kind), 'the first step is a ride');
  const q = egPieceAt(s0, 3.3), pl = egRideOf(spec, s0.x + q.dx + 0.4, s0.y, s0.z + q.dz - 0.2, 3.3);
  assert.deepEqual(pl, [0, 0.4, 0, -0.2]);
  const back = egRideAt(spec, pl, 3.3);
  assert.ok(Math.abs(back[0] - (s0.x + q.dx + 0.4)) < 1e-9 && Math.abs(back[2] - (s0.z - 0.2)) < 1e-9, 'its place on the clock plus its offset');
  const later = egRideAt(spec, pl, 4.1), q2 = egPieceAt(s0, 4.1);
  assert.ok(Math.abs(later[0] - (s0.x + q2.dx + 0.4)) < 1e-9, 'the piece moved, the rider with it');
  // PIN MOVED (AUDIT EG V, d: lane4 L4-2 - a ride holds only where the pose's own feet stand on its piece): the feet with it
  const feet = [s0.x + q.dx + 0.4, s0.y, s0.z + q.dz - 0.2];
  assert.ok(egRideHolds(spec, pl, ...feet, 3.3) && !egRideHolds(spec, [0, 4, 0, 0], ...feet, 3.3) && !egRideHolds(spec, [0, 0, 2, 0], ...feet, 3.3), 'an offset off its top is no ride');
  const ledge = spec.steps.findIndex((s) => s.kind === 'ledge');
  assert.equal(egRideHolds(spec, [ledge, 0, 0, 0], spec.steps[ledge].x, spec.steps[ledge].y, spec.steps[ledge].z, 3.3), false, 'a still slab rides nothing');
  assert.equal(egRideOf(spec, s0.x + q.dx + 9, s0.y, s0.z, 3.3), null);
  await withSpire(async ({ eg, beat, rec, socks, now }) => {
    const [mac] = SUBS;
    await eg.pose(socks[mac], poseAt(spec, spec.arrive.x, spec.arrive.z)); await beat(100);
    // a walk to the first piece, then 3 s aboard - PIN MOVED (AUDIT EG V, d: lane4 L4-2): the raw pose where the screen stood
    // it, on the piece as it swings (a raw pose 40 m off claimed the ride, and the relay stood it there), its ride saying
    // where on it
    for (let z = spec.arrive.z + 0.6; z < s0.z - 1.2; z += 0.6) { await eg.pose(socks[mac], poseAt(spec, 0, z)); await beat(100); }
    for (let k = 0; k < 30; k++) { const q1 = egPieceAt(s0, now() / 1000); await eg.pose(socks[mac], poseAt(spec, s0.x + q1.dx + 0.1, s0.z + q1.dz, s0.y, { pl: [0, 0.3, 0, 0] })); await beat(100); }   // the raw a little off its offset: the ride, not the raw, stands it
    const tr = eg.room._egTrailsBy.get(mac).tr, e = tr.at(-1), qe = egPieceAt(s0, e[0] / 1000);   // PIN MOVED (AUDIT EG III, lane3 #3): the trail is the account's
    assert.ok(Math.abs(e[1] - (s0.x + qe.dx + 0.3)) < 1e-6 && Math.abs(e[3] - s0.z) < 1e-6, 'its trail stands on the piece at its clock');
    assert.equal(rec().mem[mac].fair.why, '', 'its fair trail held aboard');
    // a ride the piece cannot hold: the raw pose judged - and the void holds nothing
    for (let k = 0; k < 30; k++) { await eg.pose(socks[mac], poseAt(spec, 40, s0.z, 0, { pl: [0, 6, 0, 0] })); await beat(100); }
    assert.ok(rec().mem[mac].fair.brks >= 1, 'a ride off its piece is no ride');
  }, { n: 1 });
});

test('EG-H1 THE CLOCK CORRECTED (section 10.8; net/eliteGates/egClock.js): pings in a burst of EG_CLOCK_SAMPLES EG_CLOCK_SPACING_MS apart, again every EG_CLOCK_EVERY_MS; each answer a sample - the relay\'s clock less the midpoint of send and arrival - the offset their median, the delay half the median round trip; a slow or strange answer no sample. The room answers its ping at once, to its socket alone, and places that member\'s poses by the delay it says (mutants: the round trip not halved; the mean in place of the median; the answer to every socket)', async () => {
  const C = egClockNew(), skew = 7777, oneWay = (k) => 150 + (k === 2 ? 900 : 0);   // one answer held up on the way back
  let wall = T0;
  const pings = [];
  for (let k = 0; k < 40 && pings.length < EG_CLOCK_SAMPLES; k++, wall += 50) { const c = egClockDue(C, wall); if (c != null) pings.push([c, wall]); }
  assert.equal(pings.length, EG_CLOCK_SAMPLES);
  assert.equal(pings[1][1] - pings[0][1], EG_CLOCK_SPACING_MS, 'the burst\'s spacing');
  assert.equal(egClockDue(C, pings.at(-1)[1] + EG_CLOCK_SPACING_MS), null, 'then quiet');
  assert.notEqual(egClockDue(egClockNew(), 0), null);
  for (const [k, [c, sent]] of pings.entries()) {
    const relayAt = sent + skew + 150, back = relayAt - skew + oneWay(k);
    assert.equal(egClockHeard(C, c, relayAt, back), true);
  }
  assert.equal(egClockHeard(C, 99999, T0, T0), false, 'an answer to no ping');
  assert.ok(Math.abs(egClockOffset(C) - skew) <= 1, `the median offset is the relay's clock (${egClockOffset(C)})`);
  assert.equal(egClockHalfRtt(C), 150, 'the one-way delay: half the median round trip');
  const welcome = (skew + 150 + T0) - (T0 + 150 + 150);   // the welcome's way: the relay's now less this machine's at arrival
  assert.equal(skew - welcome, 150, 'the welcome\'s clock ran a one-way late');
  const slow = egClockNew(), c1 = egClockDue(slow, T0);
  assert.equal(egClockHeard(slow, c1, T0 + 10_000, T0 + 6000), false, 'an answer slower than the law is no sample');
  void EG_CLOCK_EVERY_MS;
  await withSpire(async ({ eg, beat, socks, now, spec }) => {
    const [mac, ann] = SUBS;
    await eg.raw(socks[mac], JSON.stringify({ t: 'eg', k: 'clk', c: 41, h: 150 }));
    const ans = egs(socks[mac]).filter((m) => m.k === 'clk');
    assert.deepEqual(ans.map((m) => [m.c, m.now]), [[41, now()]], 'answered at once, with the relay\'s clock');
    assert.equal(egs(socks[ann]).filter((m) => m.k === 'clk').length, 0, 'to its socket alone');
    for (let k = 0; k < 12; k++) { await eg.pose(socks[mac], poseAt(spec, spec.arrive.x, spec.arrive.z, 0, { ts: tsOf(now() - 150 + 5000) })); await beat(100); }
    const e = eg.room._egTrailsBy.get(mac).tr.at(-1);   // PIN MOVED (AUDIT EG III, lane3 #3): the trail is the account's
    assert.equal(now() - 100 - e[0], 150, 'the pose stands at the instant it was sent');
  });
});

test('EG-H1 THE FEINT\'S CUT, WATCHFIRE\'S TELL AND ITS UNTELL (sections 13.2 and 15): a lord\'s blow committed EG_TELL_LEAD_MS before its wind-up, told to a Watchfire holder\'s company - the holder and each member within EG_TELL_NEAR_M of it - with the lead its rank shows (Far Watch\'s EG_FARWATCH_MS more, never past the lead), then said to all with no feint flag; a feint cut at EG_FEINT_AT of its own wind-up (`ecut`) and never judged; a told blow THE UNION FLOOR holds untold to those it was told (`untell`) and dropped past its ticks. In the room: the tells reach the company\'s sockets alone (mutants: the tell to everyone; the feint flagged on the wire; the cut on the commit\'s clock; the untell never said)', async () => {
  assert.equal(EG_FEINT_AT, TELL.FEINT_AT, 'Feud-Arc section 7.3\'s FEINT_AT, exactly');
  const spec = egHallOf(SEED, 1, 0), c = spec.fight, now = T0;
  const F = egFightNew(spec, now, [20, 20, 20]);
  const here = [{ sub: 'mac', x: c.x, z: c.z }, { sub: 'ann', x: c.x + 4, z: c.z }, { sub: 'bob', x: c.x, z: c.z - 21 }];
  const watch = [{ sub: 'mac', x: c.x, z: c.z, lead: 350, ls: [] }];
  const out = [];
  const blow = egAim(F, spec, { o: 7, s: [shDisc(c.x, c.z + 3, 3)], at: now + 1000, wu: 1000, p: 0.3, b: 0, el: null, nm: 'Cleave' }, here, now, out, EG_TELL_LEAD_MS);
  assert.ok(blow && F.blows.length === 0 && out.length === 0, 'committed, not yet said');
  assert.equal(blow.at, now + 1000 + EG_TELL_LEAD_MS, 'its landing later by the lead');
  egBlowsStep(F, spec, now + 40, here, out, watch);
  assert.equal(out.length, 0, 'not told before the lead shown');
  egBlowsStep(F, spec, now + 50, here, out, watch);
  assert.deepEqual(out.map((f) => [f.k, f.to, f.sh, f.i]), [['tell', 'mac', 350, blow.i], ['tell', 'ann', 350, blow.i]], 'told to the holder and the member near it, never the far one');
  assert.ok(out.every((f) => validEgOut(f) && !('ft' in f)), 'a tell the wire takes, no feint flag');
  out.length = 0;
  egBlowsStep(F, spec, now + EG_TELL_LEAD_MS, here, out, watch);
  assert.deepEqual(out.map((f) => [f.k, f.i]), [['eb', blow.i]], 'said to all at its wind-up - told once');
  assert.ok(!('ft' in out[0]) && !('feint' in out[0]), 'the word carries no feint');
  // the feint: cut at FEINT_AT of its own wind-up, its word's time - never judged
  F.mem.feints = [[blow.i]];
  const cutAt = egBlowFrom(blow) + Math.round(blow.wu * EG_FEINT_AT), o2 = [];
  egLordsStep(F, spec, cutAt - 1, here, () => 0.5, o2, { decrees: {}, n: 3 });
  assert.equal(o2.filter((f) => f.k === 'ecut').length, 0, 'not before FEINT_AT');
  egLordsStep(F, spec, cutAt, here, () => 0.5, o2, { decrees: {}, n: 3 });
  assert.deepEqual(o2.filter((f) => f.k === 'ecut').map((f) => f.i), [blow.i], 'cut at FEINT_AT');
  assert.equal(F.blows.length, 0, 'gone from the fight');
  assert.deepEqual(judgeShapes(F, [{ sub: 'mac', tr: [[blow.at - 100, c.x, 0, c.z + 3, 1], [blow.at + 100, c.x, 0, c.z + 3, 1]] }], blow.at + 200, spec), [], 'a feint never lands');
  // a lord's own chosen blow is committed with the lead (net/eliteGates/egLords.js lordBlow): pending, its landing past its word by its wind-up
  const s3 = egHallOf(SEED, 3, 0), F3 = egFightNew(s3, now, [20, 20]), o4 = [];
  egLordsNew(F3, s3, 'kynreeve', now, o4, { decrees: {}, n: 2 });
  egLordsWake(F3, s3, now, o4, { n: 2 });
  const near3 = [{ sub: 'mac', x: s3.foe.x, z: s3.foe.z - 2 }, { sub: 'ann', x: s3.foe.x + 2, z: s3.foe.z }];
  let t3 = now;
  for (let k = 0; k < 80 && !(F3.pend ?? []).length; k++) { t3 += 250; egLordsStep(F3, s3, t3, near3, () => 0.5, o4, { decrees: {}, n: 2 }); }
  const p3 = (F3.pend ?? [])[0];
  assert.ok(p3, 'the lord chose a blow - committed, pending');
  assert.equal(p3.say, t3 + EG_TELL_LEAD_MS, 'its word due a lead after its commit');
  assert.ok(p3.b.at - p3.b.wu >= p3.say && !F3.blows.some((b) => b.i === p3.b.i), 'its whole wind-up after its word, never said early');
  // Far Watch: a blow aimed at the Long Sight holder - its lead grows, never past the brain's
  const fw = egTellTo(egBlowOf({ i: 9, s: [shDisc(c.x + 4, c.z, 3)], at: now + 900, wu: 500, p: 0.2 }), [{ sub: 'mac', x: c.x, z: c.z, lead: 350, ls: [[c.x + 4, c.z]] }], here, now + 400, now + 400);
  assert.ok(fw.length && fw.every((t) => t.lead === Math.min(EG_TELL_LEAD_MS, 350 + EG_FARWATCH_MS)), 'Far Watch: the lead grows to the brain\'s and no further');
  assert.equal(egBlowNear(egBlowOf({ i: 1, s: [shDisc(0, 0, 3)], at: 1, wu: 1, p: 0 }), 0, 3 + EG_TELL_NEAR_M), EG_TELL_NEAR_M);
  // the untell: a told blow THE UNION FLOOR holds (it would leave its company no floor)
  const F2 = egFightNew(spec, now, [20]), o3 = [];
  const trap = egAim(F2, spec, { o: 7, s: [shDisc(c.x, c.z, 45)], at: now + 900, wu: 900, p: 0.3, b: 0, el: null, nm: 'Trap' }, here, now, o3, EG_TELL_LEAD_MS);
  egBlowsStep(F2, spec, now + 100, here, o3, watch);
  assert.ok(o3.some((f) => f.k === 'tell' && f.i === trap.i));
  o3.length = 0;
  egBlowsStep(F2, spec, now + EG_TELL_LEAD_MS, here, o3, watch);
  assert.deepEqual(o3.map((f) => [f.k, f.to, f.i]), [['untell', 'mac', trap.i], ['untell', 'ann', trap.i], ['untell', 'bob', trap.i]], 'held - untold to each it was told (all three stand under it)');
  for (let k = 1; k <= EG_UNION_HOLD_TICKS + 1; k++) egBlowsStep(F2, spec, now + EG_TELL_LEAD_MS + k * 250, here, o3, watch);
  assert.ok(!o3.some((f) => f.k === 'eb') && F2.held.length === 0 && o3.filter((f) => f.k === 'untell').length === 3, 'dropped past its ticks, untold once');
  // the room: the tell to the company's sockets alone
  await withSpire(async ({ eg, beat, rec, spec: s1, socks, now: clock }) => {
    const [mac, ann, bob] = SUBS, ct = s1.fight;
    rec().mem[mac].vs = [[22, 3]];   // Watchfire III
    const place = async () => { await eg.pose(socks[mac], poseAt(s1, ct.x, ct.z)); await eg.pose(socks[ann], poseAt(s1, ct.x + 3, ct.z)); await eg.pose(socks[bob], poseAt(s1, ct.x, ct.z - 20)); };
    for (let k = 0; k < 3; k++) { await place(); await beat(250); }
    const R = rec(), held = R.F.held.length;
    const b2 = egAim(R.F, s1, { o: 7, s: [shDisc(ct.x + 1, ct.z, 3)], at: clock() + 1000, wu: 1000, p: 0.3, b: 0, el: null, nm: 'Cleave' }, [], clock(), [], EG_TELL_LEAD_MS);
    for (let k = 0; k < 4; k++) { await place(); await beat(250); }
    const told = (sub) => egs(socks[sub]).filter((m) => m.k === 'tell' && m.i === b2.i);
    assert.equal(told(mac).length, 1, 'the holder told');
    assert.equal(told(ann).length, 1, 'a member near the blow told');
    assert.equal(told(bob).length, 0, 'a member 20 m off is not');
    assert.ok(told(mac)[0].sh === 350 && validEgOut(told(mac)[0]));
    assert.ok(egs(socks[bob]).some((m) => m.k === 'eb' && m.i === b2.i), 'then said to everyone');
    void held;
  }, { n: 3, h: 1 });
});

test('EG-H1 THE UNION FLOOR, IN TIME (net/eliteGates/egFloor.js - section 13.2, where the page says it lives): moved from net/eliteGates/egShape.js whole; the place\'s own landings in its set - a Rampart vent\'s eruption holds the ring that alone would leave a way out; a fragment\'s hazards land in it too; a blow\'s word never shows less than its whole (floored) wind-up, however late it is said (mutants: the place left out of the set; the floor\'s wait shortened)', () => {
  assert.equal('egUnionHolds' in SHAPE, false, 'moved, not copied');
  const spec = egHallOf(SEED, 4, 0), now = T0, wokeAt = now - 1600, t1 = now + 1400;
  const ring = egBlowOf({ i: 1, s: [shRing(0, 25, 2.5, 12)], at: t1, wu: 1400, p: 0.2 });
  const L = egPlaceLandings(spec, wokeAt, now, t1);
  assert.deepEqual(L.map((q) => q.at), [now + 1000], 'the first vent\'s eruption, from the hall\'s wake');
  const onFloor = egFloorTest(spec);
  assert.equal(egUnionHolds([], ring, 0, 25, now, onFloor), false, 'the ring alone leaves its heart');
  assert.equal(egUnionHolds(L, ring, 0, 25, now, onFloor), true, 'the vent erupting first leaves nowhere: held');
  const dw = egHallOf(SEED, 12, 0), bas = dw.hazards.find((q) => q.kind === 'basalt');
  const P = egPlaceLandings(dw, now, now, now + 8000);
  // PIN MOVED (EG-HERO-LAY, spec law 7): this Deepway lays the Colonnade's hero now, and the fragments after it are drawn
  // again - a surge among their hazards beside the basalt: each lands in the set, the basalt a disc of its reach, the surge its
  // lane
  assert.ok(P.some((q) => q.s[0][0] === 'd') && P.every((q) => (q.s[0][0] === 'd' && q.s[0][3] === bas.r) || (q.s[0][0] === 'l' && dw.hazards.some((z) => z.kind === 'surge'))), 'a fragment\'s basalt lands in the set');
  const Fr = egFightNew(spec, wokeAt, [20]), o5 = [];
  assert.equal(egAim(Fr, spec, { o: 1, s: ring.s, at: t1, wu: 1400, p: 0.2 }, [{ sub: 'mac', x: 0, z: 25 }], now, o5), null, 'the director holds it - the vent in its set');
  assert.equal(Fr.held.length, 1);
  assert.equal(egStampDist(['l', 0, 0, 10, 0, 4], 5, 7), 5);
  assert.equal(egStampDist(['r', 0, 0, 3, 6], 0, 1), 2);
  // the wind-up whole: a blow said with less than its floor lands its floor after its word
  const F = egFightNew(egHallOf(SEED, 1, 0), now, [20]), out = [];
  const short = egAim(F, egHallOf(SEED, 1, 0), { o: 0, s: [shDisc(0, 30, 6)], at: now + 400, wu: 400, p: 0.2 }, [], now, out);
  assert.equal(short.wu, egWindupFloorMs(shDisc(0, 30, 6)));
  assert.ok(short.at - short.wu >= now, 'its landing at least its whole wind-up after its word');
});

test('EG-H1 THE BODY COUNTED, ENFORCED IN THE SPIRE (section 21; EG14\'s BOSS_BODY on in `eg:` rooms): plain blows the judge counts take a member\'s count to nothing - its FALL (one life: the witness, the Memento, said `bd` to it alone), and never a member alive by its own word (`vt` believed out of its budget) nor one who stood out of the blow; a cast-back costs a tenth, never below a quarter; the room\'s own heals restore the count (mutants: enforcement off; the fall told to everyone; the word disbelieved; the heal ignored)', async () => {
  assert.equal(EG_BODY_ENFORCE, true, 'the Spire enforces, whatever the gate\'s line');
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2, [mac, ann, bob] = SUBS;
    const stand = async () => { await eg.pose(socks[bob], poseAt(spec, 0, cz)); await eg.pose(socks[mac], poseAt(spec, 0, cz)); await eg.pose(socks[ann], poseAt(spec, 0, cave.az + 0.4)); };
    for (let k = 0; k < 4; k++) { await stand(); await beat(100); }
    for (let k = 0; k < 3; k++) {
      const at = now() + 1500;
      throwBlow(rec(), spec, shDisc(0, cz, 3), at, now(), 0.4);
      while (now() < at + 900) { await stand(); await beat(100); }
      await eg.raw(socks[mac], JSON.stringify({ t: 'eg', k: 'vt', v: 1000 }));   // mac drinks: its body whole, in its own word
      await beat(100);
    }
    // PIN MOVED (AUDIT WORLD-EVENTS L1-4, raise before the fall): the count's fall with companions standing lies down first;
    // given in to (`yield`), it is the fall
    assert.ok(egs(socks[mac]).some((m) => m.k === 'down' && m.s === bob), 'down first, for a raise');
    await eg.raw(socks[bob], JSON.stringify({ t: 'eg', k: 'yield' }));
    await beat(100);
    const R = rec();
    assert.equal(R.mem[bob].alive, 0, 'three plain blows: the count at nothing - fallen');
    assert.equal(R.mem[bob].bd.dn, true);
    assert.ok(egs(socks[bob]).some((m) => m.k === 'bd'), 'told to it');
    assert.ok(!egs(socks[mac]).some((m) => m.k === 'bd') && !egs(socks[ann]).some((m) => m.k === 'bd'), 'to it alone');
    assert.ok(egs(socks[mac]).some((m) => m.k === 'fall' && m.s === bob && m.fin === 0), 'its fall said to all - a witness, its recall in hand');
    assert.ok(R.mementos.some((q) => q.s === bob), 'its Memento laid where it fell');
    assert.equal(R.mem[mac].alive, 1, 'alive by its own word - never felled');
    assert.ok(R.mem[mac].bd.v > 0, 'its count above nothing');
    assert.equal(R.mem[ann].bd?.v ?? 1, 1, 'out of the blow: never counted');
    assert.deepEqual(R.mem[bob].cs.slice(0, 2), [3, 0]);
  }, { n: 3, h: 2 });
  // the cast-back and the heals, on the director's own record
  const co = [['acct-mac', 'M', 1]];
  const R = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-mac', o: 'M', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
  let t = T0 + EG_SEALED_MS + 100;
  egEnter(R, 'acct-mac', 'ordacct-mac'.padEnd(20, 'x'), 40, t);
  const sp = egHallOf(SEED, 1, 0);
  for (let k = 0; k < 200 && R.sg !== 'trial'; k++) { t += 250; egStep(R, t, [{ sub: 'acct-mac', sx: sp.x0 + sp.arrive.x, z: sp.arrive.z, dead: false, at: t }], () => 0.5); }
  const m = R.mem['acct-mac'];
  m.cbOwe = 1;
  egCount(R, t, [{ sub: 'acct-mac', tr: [] }], LINE);
  assert.ok(Math.abs(m.bd.v - (1 - EG_CAST_BACK_LOSS)) < 1e-9, 'a cast-back: a tenth');
  m.bd.v = EG_CAST_BACK_FLOOR + 0.03; m.cbOwe = 1;
  egCount(R, t, [{ sub: 'acct-mac', tr: [] }], LINE);
  assert.ok(Math.abs(m.bd.v - EG_CAST_BACK_FLOOR) < 1e-9, 'never below a quarter');
  egCountHeals(R, [{ k: 'eheal', p: 0.15, why: 'mending' }], t, LINE);
  assert.ok(m.bd.v > EG_CAST_BACK_FLOOR, 'a Mending restores it');
  egCountHeals(R, [{ k: 'eheal', p: 1, why: 'rest' }], t, LINE);
  assert.equal(m.bd.v, 1, 'a rest stands it whole');
  m.bd.v = 0.05;
  egCountHeals(R, [{ k: 'eheal', p: -0.25, why: 'fray', to: 'acct-mac' }], t, LINE);
  assert.ok(m.bd.v > 0, 'the fray\'s lash: never the last of it');
  m.bd.v = 0.1;
  const hit = egCount(R, t, [{ sub: 'acct-mac', tr: [] }], LINE, false);
  assert.equal(hit.length, 0);
  assert.equal(EG_VOID_Y < 0, true);
});
