// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 6.1, 10.8, 21, 22
// and 23) - FIX GROUP D ("net"), THE RELAY'S HALF, against the real Room (test/fakeRoom.mjs - a breach's room opened by its
// own internal door, each member admitted by its own signed order), the member's own client (net/online.js OnlineSession -
// its real send policy), and the director's own producers (egBreachNew, egEnter, egStep, egCount, egHeal):
//   L4-1   THE SILENT SOCKET'S BODY HELD: a member standing still sends no pose (sendPose says one on a move and every
//          HEARTBEAT_MS), and the judge counted no body with no pose near a landing - every open socket's trail is held at
//          its newest pose to the edge no pose can still land before (now less EG_TS_LAG_MAX_MS), so a still member, a
//          backgrounded tab and a client holding its poses back take what lands there; a dodge sent in the landing's last
//          round trip is still never counted; the drains read a held body;
//   L4-2   A RIDE ONLY WHERE THE POSE STANDS: `pl` naming a piece the pose's own feet are not on is no ride (egRideHolds);
//   L4-7   THE COUNT MENDED ONLY BY A HEAL A CAST BACKS (egHeal), Lifeline with it;
//   L4-8   EG_RELAY_MIN the arc's own relay (world213), never a main relay that carries no breach;
//   L4-9   THE HOLD'S FINDING KEPT IN THE RECORD: a room woken twice inside its hold gives the gap back to what the hold
//          found, never to a word its company stamped meanwhile;
//   L4-10  A ROOM WOKEN MID-TRIAL HOLDS THE BODY of a member whose socket is gone, from the pose its record kept;
//   lane 4's UNVERIFIED: the hub's held receipts (egRcFold) keep EG_RC_KEEP unclaimed ones whatever spent marks stand
//          beside them; a whole fight's blows (`efs`) never past the wire's bound.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { EG_INTERNAL_OPEN, EG_KEY, RELAY_VERSION, EG_RELAY_MIN, relaySupportsEg, POSE_TS_MOD, validEgOut } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, EG_SEALED_MS, EG_GATHER_MS } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egAim, egFightNew } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { egRideHolds, egRideOf, egRideAt, EG_TS_LAG_MAX_MS, EG_POSE_NEAR_MS, EG_SUPPORT_LAG_S } from '../../../src/net/eliteGates/egFair.js';
import { egPieceAt, EG_BODY_R } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egBreachNew, egEnter, egStep, egCount, egHeal, egFightStateOf, EG_LIFELINE_UNDER } from '../../../src/net/eliteGates/egBrain.js';
import { egResume, egRelease, egRcFold, egRcSpent, egRcLive, EG_RC_KEEP } from '../../../src/net/eliteGates/egDurable.js';
import { egWispAt, EG_HAZARDS } from '../../../src/net/eliteGates/egFragLaw.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { healRef } from '../../../src/net/gate/gateBrain.js';
import { OnlineSession, HEARTBEAT_MS } from '../../../src/net/online.js';
import { EG_VESTIGES } from '../../../src/net/eliteGates/egVestige.js';
import { EG_BLOWS_MAX } from '../../../src/net/eliteGates/egShape.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 6]);
});

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000, B = 'feedfacecafe0a3c', SEED = 12345;
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const SUBS = ['acct-mac', 'acct-ann', 'acct-bob', 'acct-dee'];
const LINE = { depth: 1, perS: 0.05 };
const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };
/** A Spire-frame point (hall `spec`'s own x) as a pose in the dungeon's frame. */
const poseAt = (spec, x, z, y = 0, extra = {}) => { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0, ...extra }; };

/** A breach's room with `n` members at hall `h`'s trial (test/net/eliteGates/egint_relay.test.js withSpire's shape): its beat, the record,
 *  the hall, each member's socket into it, the clock. */
async function withSpire(fn, { n = 4, h = 2 } = {}) {
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
      if (h > 1) { const R = rec(); R.h = h; R.sg = 'arrive'; R.wk = clock; R.cnt = { left: 1_800_000, at: clock }; R.pulledAt = clock; R.su = clock + 30_000; }
      for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
      await beat(EG_GATHER_MS + 1000);
      assert.equal(rec().sg, 'trial', 'the hall woke');
      await fn({ eg, beat, rec, spec, socks, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
const throwBlow = (R, spec, s, at, now, p = 0.4) => egAim(R.F, spec, { o: 0, s: [s], at, wu: at - now, p, b: 0, el: null, nm: 'Test Blow' }, [], now, []);

// ── L4-1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-1 A SILENT SOCKET\'S BODY IS HELD (sections 6.1 and 21): each member\'s own client (OnlineSession - a pose said on a move and every HEARTBEAT_MS, 150 ms on its way, its corrected clock\'s delay said): a member standing still in a blow through its landing - one pose in all those seconds, its socket open - takes its share, as the closed socket\'s body does; a dodge sent at the landing less 50 ms is still never counted (the hold stands nothing over a pose on its way); a still member out of the blow takes nothing (mutants: an open socket\'s trail unheld; held to now - a pose on its way overrun)', async () => {
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann, bob, dee] = SUBS;
    const where = { [mac]: [0, cz], [ann]: [0, cz], [dee]: [7, cz] };
    // each one's own client in the breach's room (net/online.js) - its frames carried to the relay 150 ms on
    const { FakeWS, sockets } = fakeSocketClass();
    const ses = {};
    for (const sub of [mac, ann, dee]) {
      const s = new OnlineSession({ url: 'wss://relay.test', name: sub, id: `peer-${sub}`, secret: `secret-of-peer-${sub}`, WebSocketImpl: FakeWS, now: () => now() });
      s.join(egRoomKey(B), poseAt(spec, ...where[sub]));
      const ws = sockets.at(-1); ws.open(); ws.receive({ t: 'welcome', id: `peer-${sub}`, peers: [], host: null, world: null });
      ses[sub] = { s, ws, seen: ws.sent.length };
      await eg.raw(socks[sub], JSON.stringify({ t: 'eg', k: 'clk', c: 1, h: 150 }));
    }
    const q = [];
    const frame = async () => {
      const n = now();
      for (const sub of [mac, ann, dee]) {
        const S = ses[sub];
        S.s.sendPose({ ...poseAt(spec, ...where[sub]), mv: 0 });
        for (; S.seen < S.ws.sent.length; S.seen++) { const m = S.ws.sent[S.seen]; if (JSON.parse(m).t === 'pose') q.push([n + 150, sub, m]); }
      }
      q.sort((a, b) => a[0] - b[0]);
      while (q.length && q[0][0] <= n) { const [, sub, m] = q.shift(); await eg.raw(socks[sub], m); }
    };
    // bob stands in the blow and his tab closes
    for (let k = 0; k < 4; k++) { await eg.pose(socks[bob], poseAt(spec, 0, cz)); await beat(100); }
    await eg.drop(socks[bob]);
    for (let t = 0; t < 1600; t += 50) { await frame(); await beat(50); }
    const posesOf = (sub) => ses[sub].ws.sent.filter((m) => JSON.parse(m).t === 'pose').length;
    const at = now() + 1500;
    assert.ok(throwBlow(rec(), spec, shDisc(0, cz, 3), at, now()), 'the blow said');
    for (let t = 0; t < 2200; t += 50) {
      if (now() === at - 50) where[ann] = [0, cave.az + 1.2];   // her dodge: the landing less 50 ms, by the shared clock
      await frame(); await beat(50);
    }
    assert.ok(now() - T0 < HEARTBEAT_MS + EG_SEALED_MS + EG_GATHER_MS + 10_000, 'inside one heartbeat of standing still');
    assert.equal(posesOf(mac), 1, 'the real client said ONE pose standing still - the producer\'s own policy');
    assert.equal(posesOf(dee), 1);
    const R = rec(), v = (sub) => R.mem[sub].bd?.v ?? 1;
    assert.equal(v(mac), 0.6, 'a member standing still, socket open, takes the blow');
    assert.equal(v(bob), 0.6, 'the closed socket\'s body, as before');
    assert.equal(v(ann), 1, 'the dodge on its way never counted');
    assert.equal(v(dee), 1, 'a still member out of the blow takes nothing');
    // the held body is the trail's: stand-ins up to the edge no pose can still land before, never past it
    const tr = eg.room._egTrails(R, now()).find((b) => b.sub === mac).tr;
    assert.equal(tr.at(-1)[5], 1, 'a stand-in at the trail\'s end');
    assert.ok(tr.at(-1)[0] <= now() - EG_TS_LAG_MAX_MS && tr.at(-1)[0] > now() - EG_TS_LAG_MAX_MS - 250, 'held to now less EG_TS_LAG_MAX_MS');
  });
});

test('AUDIT EG V L4-1 A LINGERING FIELD READS THE WHOLE TRAIL (section 21, "a body that steps into it while it lasts"): a member out of a charge\'s run at its landing steps into it while it lasts - one pose, sent just before the room\'s beat and arriving after it (150 ms on its way, its clock\'s delay said) - and then stands still, saying nothing: the run catches it (mutant: the field read to now, past a pose still on its way and the stand-ins after it)', async () => {
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann] = SUBS;
    await eg.raw(socks[mac], JSON.stringify({ t: 'eg', k: 'clk', c: 1, h: 150 }));
    const q = [];
    const send = (sub, x, z) => q.push([now() + 150, sub, poseAt(spec, x, z, 0, { ts: now() % POSE_TS_MOD })]);
    const step = async (ms) => { for (let k = 0; k < ms; k += 10) { q.sort((a, b) => a[0] - b[0]); while (q.length && q[0][0] <= now()) { const [, sub, p] = q.shift(); await eg.pose(socks[sub], p); } await beat(10); } };
    for (let k = 0; k < 16; k++) { send(mac, 0, cz + 7); await eg.pose(socks[ann], poseAt(spec, 7, cz + 7)); await step(100); }
    const at = now() + 1500;
    assert.ok(egAim(rec().F, spec, { o: 0, s: [shDisc(0, cz, 3)], at, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow', sp: 4000 }, [], now(), []), 'a charge\'s run said');
    let stepped = false;
    while (now() < at + 6000) {
      if (!stepped && now() >= at + 600 && eg.alarm.at - now() === 10) { send(mac, 0, cz); stepped = true; }   // into the run, just before a beat
      await step(10);
    }
    assert.ok(stepped);
    assert.equal(rec().mem[mac].bd?.v ?? 1, 0.6, 'caught by the run it stepped into');
    assert.equal(rec().mem[ann].bd?.v ?? 1, 1);
  }, { n: 2, h: 2 });
});

test('AUDIT EG V L4-1 THE DRAINS READ A HELD BODY (section 21): a soul-wisp\'s drain (seed 12345, hall 27) binds a member whose newest pose is the room\'s stand-in held EG_TS_LAG_MAX_MS short of the beat, as the held trail stands it - and one whose newest real pose is that old binds nothing (mutant: a stand-in read as a stale pose)', () => {
  const co = [['acct-0', 'M0', 1]];
  for (const held of [true, false]) {
    let s = 7;
    const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    const Bk = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
    let now = T0 + EG_SEALED_MS + 100;
    egEnter(Bk, 'acct-0', 'o'.repeat(20), 40, now);
    const spec = egHallOf(SEED, 27, 0), wisp = spec.hazards.find((q) => q.kind === 'wisp');
    assert.ok(wisp, 'hall 27 holds a soul-wisp');
    Bk.h = 27; Bk.sg = 'arrive'; Bk.wk = now; Bk.cnt = { left: 1_800_000, at: now }; Bk.pulledAt = now; Bk.su = now + 30_000;
    for (let k = 0; k < 60 && Bk.sg !== 'trial'; k++) { now += 250; egStep(Bk, now, [{ sub: 'acct-0', sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, dead: false, at: now }], rng); }
    assert.equal(Bk.sg, 'trial');
    const t0 = now;
    let took = 0;
    for (let t = t0; t <= t0 + 4000; t += 250) {
      const e0 = t - EG_TS_LAG_MAX_MS - 100, [wx, wz] = egWispAt(wisp, e0 / 1000);
      const tr = [[e0, wx + 0.5, wisp.y - 1.2, wz, Bk.h, ...(held ? [1] : [])]];
      egCount(Bk, t, [{ sub: 'acct-0', tr }], LINE);
      took = (Bk.mem['acct-0'].cs ?? [0, 0, 0, 0])[1];
    }
    if (held) assert.ok(took >= 2, `a held body drained (${took})`);
    else assert.equal(took, 0, 'a real pose that old is no body now');
  }
  assert.ok(EG_TS_LAG_MAX_MS + 100 > EG_POSE_NEAR_MS, 'the fixture\'s pose is past the near window');
  assert.ok(EG_HAZARDS.wisp.pct > 0);
});

// ── L4-2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-2 A RIDE ONLY WHERE THE POSE STANDS (section 10.8, "a pose cannot claim a piece it is not on"): egRideHolds asks the pose\'s own feet on the piece\'s top as it stood within EG_SUPPORT_LAG_S, the capsule about it, at its heights; in the room, a member on the cave floor whose pose claims a Drift is judged where its feet stand - the blow there counts, its trail never stood on the piece (mutants: the feet unasked; the lag unasked; the height unasked)', async () => {
  const spec = egHallOf(SEED, 2, 0), s0 = spec.steps.find((s) => ['drift', 'rail', 'drum'].includes(s.kind));
  assert.ok(s0, 'a ridden piece in hall 2');
  const tS = 3.3, q = egPieceAt(s0, tS), on = [s0.x + q.dx + 0.4, s0.y, s0.z + q.dz - 0.2];
  const pl = egRideOf(spec, ...on, tS);
  assert.ok(pl && egRideHolds(spec, pl, ...on, tS), 'feet on the piece: its ride');
  assert.equal(egRideHolds(spec, pl, on[0] + 30, on[1], on[2], tS), false, 'feet 30 m off: no ride');
  assert.equal(egRideHolds(spec, pl, on[0], on[1] - 4, on[2], tS), false, 'feet under it: no ride');
  // the lag: feet at the trailing edge of where the piece stood EG_SUPPORT_LAG_S ago ride it, though the piece has moved on
  // past them at tS (a pose sent as the screen drew it); twice the lag back, they do not
  const lagT = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => k * 0.37).find((tt) => Math.abs(egPieceAt(s0, tt).dx - egPieceAt(s0, tt - EG_SUPPORT_LAG_S).dx) > 0.05 && Math.abs(egPieceAt(s0, tt).dx - egPieceAt(s0, tt - 2 * EG_SUPPORT_LAG_S).dx) > Math.abs(egPieceAt(s0, tt).dx - egPieceAt(s0, tt - EG_SUPPORT_LAG_S).dx) + 0.05);
  assert.ok(lagT != null, 'a moment the piece moves along x');
  const nowQ = egPieceAt(s0, lagT), dir = Math.sign(nowQ.dx - egPieceAt(s0, lagT - EG_SUPPORT_LAG_S).dx), reach = s0.w / 2 + EG_BODY_R - 0.01;
  const trailing = (dt) => [s0.x + egPieceAt(s0, lagT - dt).dx - dir * reach, s0.y, s0.z + nowQ.dz];
  assert.ok(Math.abs(trailing(EG_SUPPORT_LAG_S)[0] - (s0.x + nowQ.dx)) > s0.w / 2 + EG_BODY_R, 'off the piece where it stands now');
  assert.ok(egRideHolds(spec, [pl[0], 0, 0, 0], ...trailing(EG_SUPPORT_LAG_S), lagT), 'within the lag: a ride');
  assert.equal(egRideHolds(spec, [pl[0], 0, 0, 0], ...trailing(2 * EG_SUPPORT_LAG_S), lagT), false, 'twice the lag back: none');
  assert.ok(egRideAt(spec, pl, tS));
  await withSpire(async ({ eg, beat, rec, spec: sp, socks, now }) => {
    const cave = sp.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann] = SUBS;
    for (let k = 0; k < 16; k++) { await eg.pose(socks[mac], poseAt(sp, 0, cz, 0, { pl: [s0.i, 0, 0, 0] })); await eg.pose(socks[ann], poseAt(sp, 7, cz)); await beat(100); }
    const at = now() + 1200;
    throwBlow(rec(), sp, shDisc(0, cz, 3), at, now());
    while (now() < at + 1200) { await eg.pose(socks[mac], poseAt(sp, 0, cz, 0, { pl: [s0.i, 0, 0, 0] })); await eg.pose(socks[ann], poseAt(sp, 7, cz)); await beat(100); }
    const e = eg.room._egTrailsBy.get(mac).tr.at(-1);
    assert.ok(Math.abs(e[1] - 0) < 1e-6 && Math.abs(e[3] - cz) < 1e-6, 'the trail stands where the feet stood');
    assert.equal(rec().mem[mac].bd?.v ?? 1, 0.6, 'the blow on the cave floor counted');
    // an honest rider: its feet on the piece a little off where its offset says (the screen drew it a frame apart) - the
    // relay stands it at the piece's place on the clock plus its offset, as the room judges a ride
    for (let k = 0; k < 6; k++) { const qq = egPieceAt(s0, now() / 1000); await eg.pose(socks[ann], poseAt(sp, s0.x + qq.dx + 0.3, s0.z + qq.dz, s0.y, { pl: [s0.i, 0.6, 0, 0] })); await beat(100); }
    const ea = eg.room._egTrailsBy.get(ann).tr.at(-1), qa = egPieceAt(s0, ea[0] / 1000);
    assert.ok(Math.abs(ea[1] - (s0.x + qa.dx + 0.6)) < 1e-6, 'a ride on its piece: the piece\'s place plus its offset, not the raw pose');
  }, { n: 2, h: 2 });
});

// ── L4-7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-7 THE COUNT MENDED ONLY BY A HEAL A CAST BACKS (sections 16.1 and 21, "the relay\'s census fells it"): a member struck 0.3 of its body a second whose page names a companion its healer each second - no cast relayed - is felled by the count; the same word with the cast seen mends it; Lifeline opens on a backed heal alone; a healer named twice in one word mends once (mutants: the mend by the word; Lifeline by the word; a healer counted twice)', () => {
  const stand = () => {
    const co = [['acct-mac', 'Mac', 1], ['acct-ann', 'Ann', 2]];
    const R = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 0, rh: 0, seed: 1, op: T0, co, site: SITE, wg: [] });
    const t = T0 + EG_SEALED_MS + 100;
    for (const [i, [sub]] of co.entries()) egEnter(R, sub, `${'o'.repeat(19)}${i}`, 20, t);
    R.h = 1; R.sg = 'trial'; R.wk = t; R.hw = t; R.cnt = { left: 1_800_000, at: t };
    return { R, t };
  };
  for (const saw of [false, true]) {
    const { R } = stand();
    let { t } = stand();
    const m = R.mem['acct-mac'];
    for (let s = 0; s < 10; s++) {
      t += 1000;
      bodyStruck(m, 0.3, t, LINE, { enforce: true });
      egHeal(R, 'acct-mac', [['acct-ann', healRef(20)]], t, LINE, true, () => saw);
    }
    if (saw) assert.ok((m.bd?.v ?? 1) > 0.5, `a heal the room saw cast mends (${m.bd?.v})`);
    else assert.equal(m.bd?.v ?? 1, 0, 'a word no cast backs mends nothing - the count fells it');
  }
  // twice in one word: once
  {
    const { R, t } = stand();
    const m = R.mem['acct-mac'];
    bodyStruck(m, 0.5, t + 10, LINE, { enforce: true });
    const before = m.bd.v;
    egHeal(R, 'acct-mac', [['acct-ann', 40], ['acct-ann', 40]], t + 20, LINE, true, () => true);
    const once = m.bd.v - before;
    const { R: R2, t: t2 } = stand();
    const m2 = R2.mem['acct-mac'];
    bodyStruck(m2, 0.5, t2 + 10, LINE, { enforce: true });
    const b2 = m2.bd.v;
    egHeal(R2, 'acct-mac', [['acct-ann', 80]], t2 + 20, LINE, true, () => true);
    assert.ok(Math.abs(once - (m2.bd.v - b2)) < 1e-9 && once > 0, 'the healer\'s believed heal, once');
  }
  // Lifeline: under its line, a Lifeline holder's heal opens the window only where it was cast
  for (const saw of [false, true]) {
    const { R, t } = stand();
    const m = R.mem['acct-mac'];
    bodyStruck(m, 1 - EG_LIFELINE_UNDER + 0.1, t + 10, LINE, { enforce: true });
    assert.ok(m.bd.v < EG_LIFELINE_UNDER, 'under Lifeline\'s line');
    R.mem['acct-ann'].vs = [[EG_VESTIGES.find((x) => x.key === 'lifeline').id, 3]];   // a healer holding Lifeline at III
    egHeal(R, 'acct-mac', [['acct-ann', healRef(20)]], t + 20, LINE, true, () => saw);
    assert.equal((m.ll ?? []).length > 0, saw, saw ? 'a backed heal opens Lifeline' : 'a word alone opens no Lifeline');
  }
});

// ── L4-8 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-8 THE FIRST RELAY THAT OPENS A BREACH IS THE ARC\'S OWN (section 23, "Versions"): EG_RELAY_MIN is the arc\'s own number - world213, every relay since it carrying the breach (WIKIMAID\'s world214) - so a client meeting main\'s world197 to world212 (no breach in them) never sends one an `eg` (mutant: the branch\'s old 197)', () => {
  assert.equal(RELAY_VERSION, 'world242', 'PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay\'s bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR\'s world224, GAUNTLET-SLAIN\'s world225 and LORD-SHARES\' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look\'s `lg`, the On foot Layered Gearing Skin; the voice pass\'s words in the relay\'s own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords\' blows fair and whole, spec law 10 THE BROKEN WAY, the ways as proven); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary) - the arc shipped under world213 (unshipped; PIN MOVED: world212 until the merge of main past REZ-BLOODLINE + GRAVE-PARTY\'s world212; world211 until the merge of main past TIDY2\'s world211; world206 until the merge of main past SERPENT5\'s world206 to HUB-PULL + DO-ASK\'s world210; world201 until the merge of main past CHAT-TRADE world201 and FIVE-ASKS world202, world203 until the merge past KG-SET world203 and KG5 world204, world205 until the merge past PVP-LOOT + QUEST-HOME world205)');
  assert.equal(EG_RELAY_MIN, 213, 'the arc\'s own relay - PIN MOVED (WIKIMAID): it was RELAY_VERSION\'s number until world214 moved the vocabulary on');
  assert.ok(Number(/^world(\d+)$/.exec(RELAY_VERSION)[1]) >= EG_RELAY_MIN, 'and the relay this client ships against carries it');
  for (const v of ['world197', 'world198', 'world199', 'world200', 'world201', 'world202', 'world203', 'world204', 'world205', 'world206', 'world207', 'world208', 'world209', 'world210', 'world211', 'world212']) assert.equal(relaySupportsEg(v), false, `${v} carries no breach`);
  assert.equal(relaySupportsEg(RELAY_VERSION), true);
});

// ── L4-9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-9 THE HOLD\'S FINDING KEPT IN THE RECORD (section 22, THE HOLD): a room woken between trials holds; woken AGAIN inside the hold (the record read from storage once more), its release still gives the gap back to what the hold found - the rest\'s deadline moves, an instant from before it slept moves, a word its member stamped during the hold stays where it was stamped (mutants: the finding taken again at the second wake; the finding not kept; the found deadline left)', () => {
  for (const twice of [false, true]) {
    const Bk = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed: 1, op: T0, co: [['a', 'A', 1]], site: SITE, wg: [] });
    const t = T0 + EG_SEALED_MS + 100;
    egEnter(Bk, 'a', 'o'.repeat(20), 20, t);
    Bk.h = 2; Bk.sg = 'rest'; Bk.wk = t; Bk.hw = 0; Bk.rdAt = t + 600_000; Bk.su = t + 700_000; Bk.cnt = { left: 1_200_000, at: 0 }; Bk.tk = t + 600_000;
    Bk.mem.a.seenAt = t + 590_000;   // before it slept
    const last = Bk.tk, wake1 = last + 60_000;
    assert.equal(egResume(Bk, wake1), 'hold');
    assert.ok(Array.isArray(Bk.hold.f) && Bk.hold.f.includes(t + 700_000), 'the hold keeps its finding in the record: the rest\'s deadline');
    const said = wake1 + 20_000;
    const word = { at: said };
    let R = Bk;
    R.mem.a.word = said;   // the member's word during the hold - relay time already
    if (twice) { R = structuredClone(Bk); assert.equal(egResume(R, said + 10_000), 'hold', 'woken again inside the hold'); }
    const rel = said + 40_000, gap = egRelease(R, rel);
    assert.equal(gap, rel - last, 'the whole gap given back');
    assert.equal(R.mem.a.word, said, `${twice ? 'woken twice' : 'woken once'}: the word stamped in the hold stays`);
    assert.equal(R.su, t + 700_000 + gap, 'the deadline the hold found moves');
    assert.equal(R.mem.a.seenAt, t + 590_000 + gap, 'an instant from before it slept moves');
    void word;
  }
});

// ── L4-10 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-10 A ROOM WOKEN MID-TRIAL HOLDS THE GONE MEMBER\'S BODY (section 22, "Storage, not memory"): a member stands in a blow and its socket closes; the room is checkpointed and woken again before the blow lands (a deploy, an eviction - its trails were memory); the body is held at the pose the record kept (`lp`) and takes the blow (mutants: the pose not kept; the kept pose not read)', async () => {
  await withSpire(async ({ eg, beat, rec, spec, socks, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann] = SUBS;
    for (let k = 0; k < 16; k++) { await eg.pose(socks[mac], poseAt(spec, 0, cz)); await eg.pose(socks[ann], poseAt(spec, 7, cz)); await beat(100); }
    const at = now() + 1200;
    throwBlow(rec(), spec, shDisc(0, cz, 3), at, now());
    await eg.drop(socks[mac]);
    await eg.room._egSave(eg.room._eg, now(), true);
    assert.equal((await eg.state.storage.get(EG_KEY))?.mem?.[mac]?.lp?.length, 5, 'the record keeps its last pose');
    eg.wake();
    await eg.room._egOf();
    assert.equal(eg.room._egTrailsBy?.get(mac), undefined, 'a woken room knows no trail in memory');
    while (now() < at + 1200) { await eg.pose(socks[ann], poseAt(spec, 7, cz)); await beat(100); }
    assert.equal(rec().mem[mac].bd?.v ?? 1, 0.6, 'the gone member\'s body held from its kept pose, and struck');
    assert.equal(rec().mem[ann].bd?.v ?? 1, 1);
  }, { n: 2, h: 2 });
});

// ── lane 4's UNVERIFIED ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V lane4 UNVERIFIED (EG_RC_KEEP; section 23 - "Receipts for a member with no socket in the room are held by the hub"): an account\'s spent marks never push an unclaimed receipt out of the hub\'s held list - EG_RC_KEEP unclaimed and EG_RC_KEEP spent are kept side by side (mutants: one bound over both; the unclaimed cut first)', () => {
  const nowS = Math.floor(T0 / 1000), e = nowS + 86_400;
  let kept = egRcFold([], [{ id: `${'a'.repeat(16)}:x:0`, r: 'v1.held-end', e }], nowS);
  for (let k = 0; k < 3 * EG_RC_KEEP; k++) {
    const id = `${String(k).padStart(16, '0')}:w:1`;
    kept = egRcFold(kept, [{ id, r: `v1.r${k}`, e }], nowS);
    kept = egRcSpent(kept, id, nowS, e);
  }
  assert.deepEqual(egRcLive(kept, nowS), ['v1.held-end'], 'the receipt its member never took is still handed');
  assert.equal(kept.filter((x) => x.spent).length, EG_RC_KEEP, 'the newest spent marks kept');
  let full = [];
  for (let k = 0; k < EG_RC_KEEP + 3; k++) full = egRcFold(full, [{ id: `${String(k).padStart(16, '0')}:x:0`, r: `v1.e${k}`, e }], nowS);
  assert.equal(egRcLive(full, nowS).length, EG_RC_KEEP, 'unclaimed: the newest EG_RC_KEEP');
  assert.equal(egRcLive(full, nowS)[0], 'v1.e3');
});

test('AUDIT EG V lane4 UNVERIFIED (section 22, "A joiner\'s fight"; settled - it cannot exceed): the whole fight\'s blows (`efs` `bl`) are never past the wire\'s bound - the fight keeps EG_BLOWS_MAX (32) at the aim, the newest, so sixty blows aimed in a breath leave 32 live and the whole fight passes validEgOut (40) whole; no other producer writes the list (mutant: the aim\'s bound past the wire\'s)', () => {
  const spec = egHallOf(SEED, 2, 0), F = egFightNew(spec, T0, [40]);
  const R = { h: 2, F, seed: SEED, egv: 7, end: null, sg: 'trial' };
  for (let k = 0; k < 60; k++) egAim(F, spec, { o: 0, s: [shDisc(0, 20 + (k % 10), 2)], at: T0 + 5000 + k * 50, wu: 2000, p: 0.1, b: 0, el: null, nm: 'Test Blow' }, [], T0, []);
  assert.equal(EG_BLOWS_MAX, 32);
  assert.equal(F.blows.length, EG_BLOWS_MAX, 'the newest EG_BLOWS_MAX kept');
  const f = egFightStateOf(R, T0);
  assert.equal(f.bl.length, EG_BLOWS_MAX, 'every one still to land said whole');
  assert.ok(validEgOut(JSON.parse(JSON.stringify(f))), 'the wire takes the whole fight');
  void POSE_TS_MOD;
});
