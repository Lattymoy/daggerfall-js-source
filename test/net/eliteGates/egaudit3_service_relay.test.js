// AUDIT EG III (2026-10-13, the audit of the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 6.1, 21, 22 and
// 23) - THE SERVICE GROUP, THE RELAY'S HALF: the end's word that the breach is over with no Redoubt taken, which the first
// breach's mercy waits for (lane3 #6, net/eliteGates/egBrain.js oweEnd); a closed socket's body held at its last pose for the census
// (#3); the room checking an admission's start (#9); the hub's live list letting ended breaches go at the cap (#5) and its
// public door's answer kept (#19); THE HOLD giving the gap back to what it found, never to its company's own stamps, and a
// beat gap the same (#8, net/eliteGates/egDurable.js). Played against the real Room (test/fakeRoom.mjs) and the director's own law.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server/src/index.js';
import { fakeRoom, fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, EG_KEY, EG_INTERNAL_OPEN, POSE_TS_MOD } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, EG_SEALED_MS, EG_GATHER_MS, EG_ABSENT_TRIAL_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_LIVE_MAX, EG_LIVE_KEY, EG_LIVE_PATH, EG_LIVE_SAID_MS, egResume, egRelease, egBeatGap } from '../../../src/net/eliteGates/egDurable.js';
import { egBreachNew, egEnter, egFall, egForsake, egEnd, egWord } from '../../../src/net/eliteGates/egBrain.js';
import { egGive8 } from '../../egGive8.mjs';
import { egAim } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (a cave's floor at the
// plate's height, a blow thrown on it) and stand on it still - the halls they read are law 8's, given as a breach of law 8's
// are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's.
// Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1]);
});

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const B = 'feedfacecafe0a3c';
const SEED = 12345;
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const SUBS = ['acct-mac', 'acct-ann', 'acct-bob'];
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const poseAt = (spec, x, z, y = 0) => { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0 }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');

/** A breach's room with `n` members at hall `h`'s arrival plate and its trial begun (test/net/eliteGates/egint_relay.test.js `withSpire`). */
async function withSpire(fn, { n = 2, h = 2, ew = 0, admitOnly = false } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const eg = fakeRoom(egRoomKey(B), { now: () => clock });
  try {
    await quiet(async () => {
      const co = SUBS.slice(0, n).map((s, i) => [s, `M${i}`, i + 1]);
      const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew, rh: 0, seed: SEED, op: T0, co, site: SITE }) }));
      assert.equal(res.status, 200);
      const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      clock += EG_SEALED_MS; await beat(1000);
      const rec = () => eg.room._eg;
      const order = async (sub, i, w = ew) => mintEgOrder({ o: 'egadmit', s: sub, eb: B, ez: `${'a'.repeat(19)}${i}`, ew: w }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      const spec = egHallOf(SEED, h, 0), first = egHallOf(SEED, 1, 0);
      const socks = {};
      const join = async (sub) => { const ws = eg.connect(); await eg.hello(ws, `peer-${sub}`, poseAt(first, first.arrive.x, first.arrive.z), { kind: 'linked', tokenSub: sub, charLevel: 20 }); return ws; };
      if (admitOnly) { await fn({ eg, beat, rec, order, join, now: () => clock }); return; }
      for (const [i, [sub]] of co.entries()) {
        const ws = await join(sub);
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await order(sub, i), lv: 20, bv: 2 }));
        socks[sub] = ws;
      }
      if (h > 1) { const R = rec(); R.h = h; R.sg = 'arrive'; R.wk = clock; R.cnt = { left: 1_800_000, at: clock }; R.pulledAt = clock; R.su = clock + 30_000; }
      for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
      await beat(EG_GATHER_MS + 1000);
      assert.equal(rec().sg, 'trial', 'the hall woke');
      await fn({ eg, beat, rec, spec, socks, join, order, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
/** A plain blow thrown into the room's live fight now, its landing `at` (test/net/eliteGates/egint_relay.test.js `throwBlow`). */
const throwBlow = (R, spec, s, at, now, p = 0.4) => egAim(R.F, spec, { o: 0, s: [s], at, wu: at - now, p, b: 0, el: null, nm: 'Test Blow' }, [], now, []);
/** A breach as the director keeps it: `co` entered in the open window and its first hall woken. */
function director(n, { rh = 0 } = {}) {
  const co = SUBS.slice(0, n).map((s, i) => [s, `M${i}`, i + 1]);
  const R = egBreachNew({ b: B, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh, seed: SEED, op: T0, co, site: SITE, wg: [] });
  const t = T0 + EG_SEALED_MS + 100;
  co.forEach(([sub], i) => assert.equal(egEnter(R, sub, `${'o'.repeat(19)}${i}`, 20, t), null));
  R.h = 1; R.sg = 'trial'; R.wk = t; R.hw = t; R.cnt = { left: 1_800_000, at: t };
  return { R, t, owed: () => { const o = R.owe; R.owe = []; return o.map((x) => x.claims); } };
}

test('AUDIT EG III (lane3 #6, the relay\'s half): AN END SAYS WHEN THE BREACH IS OVER WITH NO REDOUBT TAKEN (`nr`) - an end the breach\'s end owes, or the end of the last member living (nobody left to take one); never an end while another member lives, never after a Redoubt, never a Rehearsal\'s (mutants: the word on every end; the word after a Redoubt; the last living member\'s end unsaid; a Rehearsal\'s said)', () => {
  const [mac, ann, bob] = SUBS;
  // a company of three: the opener forsakes while two live; then a fall; then the last falls and the end comes
  const A = director(3);
  egFall(A.R, mac, A.t + 10_000, [], null);
  egForsake(A.R, mac, A.t + 11_000, []);
  assert.deepEqual(A.owed().map((c) => [c.s, c.why, c.nr]), [[mac, 'forsake', undefined]], 'two live: the breach goes on');
  egFall(A.R, ann, A.t + 20_000, [], null);
  egForsake(A.R, ann, A.t + 21_000, []);
  assert.deepEqual(A.owed().map((c) => [c.s, c.why, c.nr]), [[ann, 'forsake', undefined]], 'one lives');
  egFall(A.R, bob, A.t + 30_000, [], null);
  egForsake(A.R, bob, A.t + 31_000, []);
  assert.deepEqual(A.owed().map((c) => [c.s, c.why, c.nr]), [[bob, 'forsake', 1]], 'the last living: the breach is over');
  // the end's own ends
  const E = director(2);
  egEnd(E.R, 'tear', E.t + 60_000, []);
  assert.deepEqual(E.owed().map((c) => [c.why, c.nr]), [['tear', 1], ['tear', 1]]);
  // after a Redoubt: nothing to give back
  const W = director(1);
  W.R.rd = 1;   // net/eliteGates/egBrain.js redoubt(): the Redoubt taken
  egEnd(W.R, 'tear', W.t + 60_000, []);
  assert.deepEqual(W.owed().map((c) => c.nr), [undefined]);
  // a Rehearsal held no key
  const H = director(1, { rh: 1 });
  egEnd(H.R, 'wipe', H.t + 60_000, []);
  assert.deepEqual(H.owed().map((c) => [c.rh, c.nr]), [[1, undefined]]);
});

test('AUDIT EG III (lane3 #3; sections 6.1 and 22): A TAB CLOSED BEFORE A BLOW IS NOT A LIFE SAVED - a member whose socket closes keeps its body at its last pose on its trail (the trail its account\'s, never its socket\'s), so a blow landing there is counted on it; the member beside it never; back on a new socket, its real poses take the trail over from the held stand-ins (mutants: the census of the sockets alone; the held pose never kept; the trail by socket; a reload\'s poses refused)', async () => {
  await withSpire(async ({ eg, beat, rec, spec, socks, join, now }) => {
    const cave = spec.fl[0], cz = (cave.az + cave.bz) / 2;
    const [mac, ann] = SUBS;
    for (let k = 0; k < 16; k++) { await eg.pose(socks[mac], poseAt(spec, 0, cz)); await eg.pose(socks[ann], poseAt(spec, 7, cz)); await beat(100); }
    const at = now() + 1200;
    throwBlow(rec(), spec, shDisc(0, cz, 3), at, now());
    await eg.drop(socks[mac]);   // the tab closed under the blow's wind-up
    while (now() < at + 1200) { await eg.pose(socks[ann], poseAt(spec, 7, cz)); await beat(100); }
    assert.equal(rec().mem[mac].alive, 1);
    assert.equal(rec().mem[mac].bd?.v, 0.6, 'counted where its body stood');
    assert.equal(rec().mem[ann].bd?.v ?? 1, 1, 'the member beside the blow never counted');
    const held = eg.room._egTrailsBy.get(mac);
    assert.ok(held.tr.at(-1)[5] === 1 && held.tr.at(-1)[3] === cz, 'its last pose held on its trail');
    assert.ok(EG_ABSENT_TRIAL_MS === 180_000);
    // back: a new socket's poses take the trail over - its first placed before the last held stand-in (its clock says a
    // 300 ms way), which yields to it
    await eg.fire();   // a beat now: the body held to within a stand-in's step of this instant
    assert.ok(eg.room._egTrailsBy.get(mac).tr.at(-1)[0] > now() - 300);
    const ws = await join(mac);
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'clk', c: 1, h: 300 }));
    await eg.pose(ws, { ...poseAt(spec, 2, cz), ts: now() % POSE_TS_MOD });
    const back = eg.room._egTrailsBy.get(mac);
    assert.deepEqual([back.ws === ws, back.tr.at(-1)[5], back.tr.at(-1)[1], back.tr.at(-1)[0]], [true, undefined, 2, now() - 300], 'its own pose, placed 300 ms back - the stand-ins after it gone');
  });
});

test('AUDIT EG III (lane3 #9; section 23 - "The room checks ... `ew` against the breach\'s"): AN ADMISSION FOR ANOTHER START IS NOT THIS BREACH\'S - a room opened at Hall 1 refuses an order the service signed for Redoubt 3, and admits its own (mutants: `ew` unread)', async () => {
  await withSpire(async ({ eg, rec, order, join }) => {
    const [mac] = SUBS;
    const ws = await join(mac);
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await order(mac, 0, 3), lv: 20, bv: 2 }));
    assert.deepEqual(egs(ws).filter((m) => m.k === 'no').map((m) => m.m), ['the order is not yours'], 'another start\'s order refused');
    assert.equal(rec().mem[mac]?.in ?? 0, 0);
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await order(mac, 1, 0), lv: 20, bv: 2 }));
    assert.equal(rec().mem[mac].in, 1, 'its own start admitted');
  }, { n: 1, h: 1, admitOnly: true });
});

/** The hub, Mac hello'd and able to sign his opens, over a world of rooms (test/net/eliteGates/egdur_relay.test.js `withBreach`). */
async function withHub(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const mac = hub.connect(); await hub.hello(mac, 'peer-mac', null, { name: 'Mac', acct: 'acct-mac', asecret: 'secret-of-acct-mac', kind: 'linked' });
      const openOrder = async (eb, ez) => mintEgOrder({ o: 'egopen', s: 'acct-mac', eb, ez }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      const open = async (eb, ez) => hub.raw(mac, JSON.stringify({ t: 'eg', k: 'open', z: await openOrder(eb, ez), site: SITE }));
      const ask = async () => (await worker.fetch(new Request(`https://relay.example${EG_LIVE_PATH}`), { ROOMS: world.ROOMS })).json();
      await fn({ world, hub, mac, open, ask, step: (ms) => { clock += ms; } });
    });
  } finally { Date.now = realNow; }
}

test('AUDIT EG III (lane3 #5; section 22, THE COST): AN ENDED BREACH GIVES ITS SLOT BACK - at EG_LIVE_MAX on the hub\'s list the hub asks each listed room where it stands and lets the ended go before it refuses, so sixty-four breaches that ended an hour ago shut nobody\'s road; sixty-four live ones still do (mutants: the cap read off the list alone)', async () => {
  await withHub(async ({ world, hub, mac, open }) => {
    const ended = Object.fromEntries(Array.from({ length: EG_LIVE_MAX }, (_, i) => [i.toString(16).padStart(16, '0'), { egv: 5, until: Date.now() + 2 * 3_600_000 }]));
    await hub.state.storage.put(EG_LIVE_KEY, ended);   // rooms that hold no live breach now (their breaches ended)
    hub.room._egLive = undefined;
    await open(B, 'z'.repeat(20));
    assert.equal(world.room(egRoomKey(B)).store.get(EG_KEY)?.b, B, 'the breach opened');
    assert.deepEqual(Object.keys(hub.store.get(EG_LIVE_KEY)), [B], 'the ended let go, the new one kept');
    assert.equal(egs(mac).filter((m) => m.k === 'no').length, 0, 'no road shut');
  });
});

test('AUDIT EG III (lane3 #19; section 22): THE LIVE DOOR\'S ANSWER KEPT - `/v1/eg/live` is public and asks every listed room; the hub keeps its answer EG_LIVE_SAID_MS, and asks that come together are one asking (coalesced, none refused); past it the rooms are asked again; a breach the hub adds is counted at once (mutants: never kept; never coalesced; kept for ever; the kept answer outliving an open)', async () => {
  await withHub(async ({ world, open, ask, step }) => {
    assert.equal((await ask()).live, 0, 'none yet - and that answer kept');
    await open(B, 'z'.repeat(20));
    assert.equal((await ask()).live, 1, 'a breach added: the kept answer forgotten at once');
    step(EG_LIVE_SAID_MS);
    const room = world.room(egRoomKey(B)).room;
    let asked = 0;
    const real = room._egStageInternal.bind(room);
    room._egStageInternal = () => { asked++; return real(); };
    const many = await Promise.all(Array.from({ length: 6 }, () => ask()));
    assert.ok(many.every((a) => a.live === 1), 'every ask answered');
    assert.equal(asked, 1, 'six asks together: one round of the rooms');
    step(EG_LIVE_SAID_MS - 1);
    await ask();
    assert.equal(asked, 1, 'kept');
    step(1);
    await ask();
    assert.equal(asked, 2, 'asked again past EG_LIVE_SAID_MS');
    assert.equal(EG_LIVE_SAID_MS, 2000);
  });
});

test('AUDIT EG III (lane3 #8; section 22, THE HOLD - "A member who returns finds the hall where they left it"): THE GAP GIVEN BACK TO WHAT THE HOLD FOUND - a member who comes back during the hold and pings stamps relay time, and the release leaves it where it stands (moved by the whole gap it stood a hundred seconds ahead and refused every ping until the clock caught it); what the hold found moves - the rest\'s end however far into the hold it fell, a ping before it; a beat gap in a room that never slept gives back what came before it and what lies past it, never a word stamped inside it (mutants: the finding unread; the finding never taken; a re-wake finding nothing; the beat gap moving its own stamps)', () => {
  const [mac] = SUBS;
  const D = director(1);
  const R = D.R, last = D.t + 600_000;
  R.h = 5; R.sg = 'rest'; R.rdAt = last - 20_000; R.su = last + 60_000; R.tk = last; R.cnt = { left: 900_000, at: 0 };
  R.mem[mac].pingAt = last - 5000;
  const wake = last + 60_000;
  assert.equal(egResume(R, wake), 'hold');
  const during = wake + 30_000, release = wake + 40_000, gap = release - last;
  assert.equal(egWord(R, mac, { k: 'lping', x: 0, z: 0, w: 0 }, null, during, () => 0.5).length, 1, 'heard during the hold');
  assert.equal(egRelease(R, release), gap);
  assert.equal(R.mem[mac].pingAt, during, 'its own ping where it stands');
  assert.equal(R.su, last + 60_000 + gap, 'the rest\'s end moved by the whole gap - the minute it had left still left');
  assert.equal(R.rdAt, last - 20_000 + gap, 'the hold\'s found instants moved');
  assert.equal(egWord(R, mac, { k: 'lping', x: 0, z: 0, w: 0 }, null, during + 3000, () => 0.5).length, 1, 'a ping three seconds on is heard');
  // woken AGAIN inside its hold (the record read from storage once more): the hold finds afresh what it reads
  const D2 = director(1), R2 = D2.R, last2 = D2.t + 600_000;
  R2.h = 5; R2.sg = 'rest'; R2.rdAt = last2 - 20_000; R2.su = last2 + 60_000; R2.tk = last2; R2.cnt = { left: 900_000, at: 0 };
  assert.equal(egResume(R2, last2 + 60_000), 'hold');
  const again = structuredClone(R2);
  assert.equal(egResume(again, last2 + 70_000), 'hold', 'still held');
  egWord(again, mac, { k: 'lping', x: 0, z: 0, w: 0 }, null, last2 + 80_000, () => 0.5);
  assert.equal(egRelease(again, last2 + 90_000), 90_000);
  assert.deepEqual([again.mem[mac].pingAt, again.su], [last2 + 80_000, last2 + 150_000], 'its own ping kept, the rest\'s end moved');
  // a beat gap: the room awake, its alarm held 10 s, a ping stamped inside it
  const G = director(1).R;
  G.tk = T0 + 900_000; G.su = G.tk + 5000; G.mem[mac].seenAt = G.tk - 100;
  G.mem[mac].pingAt = G.tk + 6000;
  assert.equal(egBeatGap(G, G.tk + 10_000), 10_000);
  assert.deepEqual([G.mem[mac].seenAt, G.mem[mac].pingAt], [T0 + 900_000 - 100 + 10_000, T0 + 906_000], 'before it moved; inside it kept');
  assert.equal(G.su, T0 + 905_000, 'a deadline that fell inside the gap is the gap\'s own - it fires at the beat');
});
