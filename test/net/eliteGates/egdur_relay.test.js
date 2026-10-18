// EG-H2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 22, slice EG8e):
// DURABILITY, PLAYED AGAINST THE REAL ROOM (test/fakeRoom.mjs - `wake()` is a fresh Room over the same storage, which is
// what a deploy's restart or an eviction wakes into): a breach restarted mid-trial gives the gap back (the count, the hall's
// clock and each member's absence do not run across it); a breach restarted between trials HOLDS until its company is back
// or 180 s have passed, then gives the whole gap back; the hub's live list, its public answer for the deploy's hold and
// drain, THE DRAIN's refusal and THE COST's cap - each refused open handing its stake straight back; THE LAW PIN (a hall in
// the breach's own law's bytes for `spec`, a given hall read before any draw, a woken room whose law is not this build's
// ending its breach as a void); the receipts' secret, deterministic seed, kept before they go out.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server/src/index.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, EG_KEY, validEgOut, validEgIn } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egCountLeft, egSpecGive, egSpecForget, EG_SPEC, EG_SEALED_MS, EG_GATHER_MS, EG_LAST_WORD_MS, EG_ARRIVE_MAX_MS, EG_ADMIT_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given
import { EG_LAWS, EG_LAW_KEEP_DAYS, EG_GAP_MS, EG_REJOIN_MS, EG_LIVE_MAX, EG_LIVE_KEY, EG_LIVE_PATH, egLawKnown, egReceiptSeed, egGiveBack, egResume, egHoldDone, egRelease, egBeatGap, egBetween, EG_DONE_KEY, EG_LIVE_SAID_MS } from '../../../src/net/eliteGates/egDurable.js';
import { egBreachNew } from '../../../src/net/eliteGates/egBrain.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { readEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { RELAY_CFG_KEYS, RELAY_CFG_VARS } from '../../../src/net/relayCfg.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const at = (sx, z) => { const [x, y, dz] = realmToDungeon(sx, 0, z); return { x, y, z: dz, yaw: 0, pitch: 0 }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

/** A hub and a breach opened by `acct-mac` (with `acct-ann` in its party when `party`) - the egplay rig. */
async function withBreach(fn, { party = false, b = B } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const mac = hub.connect(); await hub.hello(mac, 'peer-mac', null, { name: 'Mac', acct: 'acct-mac', asecret: 'secret-of-acct-mac', kind: 'linked' });
      if (party) {
        const ann = hub.connect(); await hub.hello(ann, 'peer-ann', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', kind: 'linked' });
        clock += 600; await hub.raw(mac, JSON.stringify({ t: 'social', k: 'party.invite', peer: 'peer-ann' }));
        clock += 600; await hub.raw(ann, JSON.stringify({ t: 'social', k: 'party.accept', party: mac.att.party }));
        clock += 600;
        assert.ok(hub.store.get(`party:${mac.att.party}`)?.members?.includes('acct-ann'), 'a party of two');
      }
      const openOrder = async (eb, ez) => mintEgOrder({ o: 'egopen', s: 'acct-mac', eb, ez }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      await hub.raw(mac, JSON.stringify({ t: 'eg', k: 'open', z: await openOrder(b, 'z'.repeat(20)), site: SITE }));
      const eg = world.room(egRoomKey(b));
      const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      const admit = async (sub, ez = 'a'.repeat(20)) => mintEgOrder({ o: 'egadmit', s: sub, eb: b, ez }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      /** A deploy's restart: every socket dropped (no close is heard), `ms` of nothing, a fresh Room over the storage. */
      const restart = (ms) => { eg.sockets.splice(0); clock += ms; eg.wake(); };
      /** A member in the room, admitted, standing at (sx, z) of the Spire's frame. */
      const enter = async (sub, peer, sx, z, ez) => {
        const ws = eg.connect(); await eg.hello(ws, peer, at(sx, z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await admit(sub, ez), lv: 20, bv: 2 }));
        await eg.pose(ws, at(sx, z));
        return ws;
      };
      await fn({ world, hub, mac, eg, beat, admit, restart, enter, openOrder, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
/** The breach as the room holds it now (the store is its checkpoint). */
const held = (eg) => eg.room._eg ?? eg.store.get(EG_KEY);
/** Hall 1 woken with `acct-mac` in it - the trial's first beat. */
async function toTrial({ eg, beat, enter, step }) {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the breach's first circle given at spec law 8 (test/egGive8.mjs - its
  // seed the hub's own draw): the member strikes the rifts and walks to the door straight down law 8's line
  egGive8(eg.store.get(EG_KEY).seed, [1]);
  const spec = egHallOf(eg.store.get(EG_KEY).seed, 1);
  step(EG_SEALED_MS); await beat(1000);
  const ws = await enter('acct-mac', 'peer-mac', spec.x0 + spec.arrive.x, spec.arrive.z);
  await beat(EG_GATHER_MS + 1000);
  assert.equal(held(eg).sg, 'trial');
  return { ws, spec };
}

test('EG-H2 TIME ACROSS A RESTART (section 22): a breach restarted mid-trial wakes from its storage and gives the gap since its last beat back - the count left as it was at its last save, the hall\'s wake and every instant moved by the gap, and a member gone longer than a trial\'s absence is no fall; before the first wake nothing moves (the sealed hour and the open window are the wall clock\'s), and the last word never does; a beat gap in a room that never slept is given back too (mutants: the gap not given back; the open moved; a frozen spec walked)', async () => {
  await withBreach(async (rig) => {
    const { eg, beat, restart, step } = rig;
    await toTrial(rig);
    await beat(5000);   // a checkpoint past the wake
    const saved = structuredClone(eg.store.get(EG_KEY));
    assert.ok(Number.isFinite(saved.tk), 'the beat stamped and kept');
    assert.ok(rig.now() - saved.tk <= 2500 && saved.F, 'a trial\'s checkpoint lands - its fight with it (the beat\'s closures no longer ride the record: every trial\'s save threw)');
    const left = egCountLeft(saved.cnt, saved.tk);
    restart(200_000);   // longer than a trial's absence (EG_ABSENT_TRIAL_MS 180 s)
    await beat(1000);
    const B1 = held(eg);
    assert.ok(B1.gv >= 200_000, `the gap given back (${B1.gv})`);
    assert.equal(B1.hw, saved.hw + B1.gv, 'the hall\'s wake moved by the gap');
    assert.equal(B1.wk, saved.wk + B1.gv, 'and the first wake');
    assert.equal(B1.op, saved.op, 'the open never moves: the last word is the wall clock\'s');
    assert.ok(Math.abs(egCountLeft(B1.cnt, rig.now()) - left) <= 1500, 'the count did not run across the gap');
    assert.equal(B1.mem['acct-mac'].alive, 1, 'two hundred seconds away is no fall - the absence did not run either');
    assert.equal(B1.sg, 'trial', 'mid-trial: no hold');
    step(0);
  });
  // the law by itself: nothing before the first wake; a frozen spec left; a beat gap
  const fresh = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [] });
  const su = fresh.su;
  assert.equal(egGiveBack(fresh, 60_000, T0 + 1000), 0, 'before the first wake nothing is given back');
  assert.equal(fresh.su, su, 'the sealed hour stands on the wall clock');
  assert.equal(egResume(fresh, T0 + 5000), null);
  const live = { ...fresh, wk: T0, sg: 'trial', hw: T0, cnt: { left: 1_000_000, at: T0 }, spec: Object.freeze({ at: T0 }), mem: { a: { in: 1, alive: 1, seenAt: T0 } }, tk: T0 };
  assert.equal(egBeatGap(live, T0 + EG_GAP_MS), 0, 'a beat within EG_GAP_MS is no gap');
  assert.equal(egBeatGap(live, T0 + EG_GAP_MS + 10_000), 10_000, 'a held alarm\'s gap given back');
  assert.deepEqual([live.hw, live.cnt.at, live.mem.a.seenAt, live.spec.at, live.op], [T0 + 10_000, T0 + 10_000, T0 + 10_000, T0, T0], 'the instants moved, a frozen piece and the open kept');
});

test('EG-H2 THE HOLD (section 22): a breach restarted between trials (the swap to Hall 2) holds - the count frozen where its last beat left it and the director still, the hall never waking however long the arrival waits - until its living company is back in the room, then gives the whole gap back and runs on; a hold nobody answers ends at EG_REJOIN_MS (mutants: no hold; the hold never released; the gap not given back at the release; the count left running through it)', async () => {
  await withBreach(async (rig) => {
    const { eg, beat, restart, enter, step } = rig;
    const { ws, spec } = await toTrial(rig);
    let q = 1;
    for (let guard = 0; guard < 4000 && held(eg).sg === 'trial'; guard++) {
      const live = held(eg).F.bodies.filter((t) => t.hp > 0 && !(t.fl & (2 | 16 | 128)));
      const tgt = live.find((t) => t.role === 1) ?? live[0];
      if (tgt) { const yw = tgt.yaw ?? 0; await eg.pose(ws, at(spec.x0 + tgt.x - Math.sin(yw) * 1.5, tgt.z - Math.cos(yw) * 1.5)); await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'hit', i: tgt.i, q: q++, d: 200, r: 1 })); }
      await beat(250);
    }
    // PIN MOVED (EG-H1, merged): the member WALKS to the door - THE FAIR TRAIL refuses a step through it from a teleport
    const last = eg.room._attach?.(ws)?.pose ?? ws.att.pose, [lx, , lz] = dungeonToRealm(last.x, last.y ?? 0, last.z), n = Math.ceil(Math.hypot(spec.x0 + spec.end.x - lx, spec.end.z - lz) / 2);
    for (let k = 1; k <= n; k++) { await eg.pose(ws, at(lx + ((spec.x0 + spec.end.x - lx) * k) / n, lz + ((spec.end.z - lz) * k) / n)); await beat(250); }
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'down', h: 1 }));
    await beat(500);
    assert.deepEqual([held(eg).h, held(eg).sg], [2, 'arrive'], 'the swap: between trials');
    assert.equal(egBetween(held(eg)), true);
    await beat(2500);
    const saved = structuredClone(eg.store.get(EG_KEY));
    restart(30_000);
    await beat(1000);
    const H = held(eg);
    assert.ok(H.hold && H.hold.at === saved.tk, 'held from its last beat');
    const frozen = egCountLeft(H.cnt, rig.now());
    await beat(EG_ARRIVE_MAX_MS + 20_000);
    assert.deepEqual([held(eg).h, held(eg).sg], [2, 'arrive'], 'the hall never woke while it held');
    assert.equal(egCountLeft(held(eg).cnt, rig.now()), frozen, 'the count frozen');
    // the company back
    const spec2 = egHallOf(saved.seed, 2);
    const back = await enter('acct-mac', 'peer-mac', spec2.x0 + spec2.arrive.x, spec2.arrive.z);
    await beat(1000);
    const R = held(eg);
    assert.equal(R.hold, null, 'released as its company stood in the room');
    assert.ok(R.gv >= 30_000 + EG_ARRIVE_MAX_MS, `the whole gap given back (${R.gv})`);
    assert.equal(R.pulledAt, saved.pulledAt + R.gv, 'the arrival\'s clock moved by it - the hall where they left it');
    assert.ok(egs(back).some((m) => m.k === 'st'), 'told the breach again');
    step(0);
  });
  // a hold nobody answers
  const H = { egv: EG_SPEC, wk: T0, sg: 'rest', end: null, op: T0 - 1000, cnt: { left: 600_000, at: 0 }, mem: { a: { in: 1, alive: 1, home: 0 } }, tk: T0, su: T0 + 90_000 };
  assert.equal(egResume(H, T0 + 40_000), 'hold');
  assert.equal(egHoldDone(H, T0 + 40_000 + EG_REJOIN_MS - 1, new Set()), false, 'nobody back: held');
  assert.equal(egHoldDone(H, T0 + 40_000 + 1000, new Set(['a'])), true, 'the company back: released');
  assert.equal(egHoldDone(H, T0 + 40_000 + EG_REJOIN_MS, new Set()), true, 'the hold spent: released');
  assert.equal(egRelease(H, T0 + 40_000 + EG_REJOIN_MS), 40_000 + EG_REJOIN_MS, 'the whole gap since its beat');
  assert.equal(H.su, T0 + 90_000 + 40_000 + EG_REJOIN_MS, 'the rest\'s end moved by it');
  assert.equal(EG_REJOIN_MS, 180_000);
  // a hold in a closing, its count running: frozen at the beat, and running again from the release
  const C = { egv: EG_SPEC, wk: T0 - 60_000, sg: 'closing', end: null, op: T0 - 90_000, cnt: { left: 600_000, at: T0 - 5000 }, mem: {}, tk: T0, dn: T0 - 5000 };
  assert.equal(egResume(C, T0 + 40_000), 'hold');
  assert.deepEqual(C.cnt, { left: 595_000, at: 0 }, 'frozen where its last beat left it');
  assert.equal(egRelease(C, T0 + 60_000), 60_000);
  assert.deepEqual(C.cnt, { left: 595_000, at: T0 + 60_000 }, 'running again from the release, nothing lost');
  assert.equal(C.dn, T0 - 5000 + 60_000, 'the closing\'s door moved by the gap');
});

test('EG-H2 THE LIVE LIST, THE DRAIN AND THE COST (section 22): the hub keeps each breach it opens until its last word and answers `/v1/eg/live` - how many, all between trials or not, their laws, the longest\'s last word, the road - naming none; with the road shut (the relay setting `egDrain`, a developer\'s alone, on or off) or EG_LIVE_MAX live, an open is refused in words and its stake handed straight back (a void receipt), no room opened (mutants: the drain unread; the cap unread; the stake kept; a room opened anyway; the live list never kept)', async () => {
  await withBreach(async ({ world, hub, mac, eg, openOrder, step }) => {
    const ask = async () => (await worker.fetch(new Request(`https://relay.example${EG_LIVE_PATH}`), { ROOMS: world.ROOMS })).json();
    const rec = eg.store.get(EG_KEY);
    assert.deepEqual(hub.store.get(EG_LIVE_KEY), { [B]: { egv: EG_SPEC, until: rec.op + EG_LAST_WORD_MS } }, 'kept until its last word');
    assert.deepEqual(await ask(), { live: 1, between: true, laws: [EG_SPEC], until: rec.op + EG_LAST_WORD_MS, drain: false });
    eg.room._eg.sg = 'trial';
    step(EG_LIVE_SAID_MS);   // PIN MOVED (AUDIT EG III, lane3 #19): the hub keeps its answer EG_LIVE_SAID_MS
    assert.equal((await ask()).between, false, 'a breach in a trial: not between');
    // THE DRAIN: a developer shuts the road
    const dev = hub.connect(); await hub.hello(dev, 'dev-0001', null, { glyphs: ['dev'] });
    await hub.raw(dev, JSON.stringify({ t: 'cfg', k: 'egDrain', v: 'maybe' }));
    assert.match(dev.sent.filter((f) => f.t === 'cfg').at(-1).error, /on .* or off/, 'on or off, refused in words');
    await hub.raw(dev, JSON.stringify({ t: 'cfg', k: 'egDrain', v: 'on' }));
    assert.deepEqual(dev.sent.filter((f) => f.t === 'cfg').at(-1), { t: 'cfg', k: 'egDrain', v: 'on' });
    assert.equal((await ask()).drain, true);
    const B2 = 'fedcba9876543210';
    mac.sent.length = 0;
    await hub.raw(mac, JSON.stringify({ t: 'eg', k: 'open', z: await openOrder(B2, 'y'.repeat(20)), site: SITE }));
    // PIN MOVED (EG-ZA, Elite-Gates.md section 23): the void is the ROOM's - it writes the order into its tombstone first,
    // so the order can never open a breach once the road reopens; no breach stands in it
    assert.equal(world.room(egRoomKey(B2)).store.has(EG_KEY), false, 'no breach opened on a shut road');
    assert.deepEqual(world.room(egRoomKey(B2)).store.get(EG_DONE_KEY)?.z?.map((e) => e.slice(0, 2)), [['y'.repeat(20), 'void']], 'the order spent in its tombstone');
    assert.deepEqual(egs(mac).filter((m) => m.k === 'no').map((m) => m.m), ['the road is shut']);
    const v = readEgReceipt(egs(mac).find((m) => m.k === 'rcpt')?.r);
    assert.deepEqual(v && [v.q, v.b, v.s, v.z], ['v', B2, 'acct-mac', 'y'.repeat(20)], 'the stake handed straight back');
    for (const m of egs(mac)) assert.ok(validEgOut(m), m.k);
    await hub.raw(dev, JSON.stringify({ t: 'cfg', k: 'egDrain', v: 'off' }));
    // THE COST: EG_LIVE_MAX live at once
    const full = Object.fromEntries(Array.from({ length: EG_LIVE_MAX }, (_, i) => [i.toString(16).padStart(16, '0'), { egv: EG_SPEC, until: Date.now() + 60_000 }]));
    // PIN MOVED (AUDIT EG III, lane3 #5): at the cap the hub asks each listed room and lets the ended go - so the cap's
    // breaches stand live in their rooms (the real breach's record under each id)
    for (const id of Object.keys(full)) await world.room(egRoomKey(id)).state.storage.put(EG_KEY, { ...structuredClone(rec), b: id });
    step(EG_LIVE_SAID_MS);
    await hub.state.storage.put(EG_LIVE_KEY, full);
    hub.room._egLive = undefined;
    mac.sent.length = 0;
    await hub.raw(mac, JSON.stringify({ t: 'eg', k: 'open', z: await openOrder(B2, 'x'.repeat(20)), site: SITE }));
    assert.equal(world.room(egRoomKey(B2)).store.has(EG_KEY), false, 'none past the cap');   // PIN MOVED (EG-ZA): its tombstone alone
    assert.equal(readEgReceipt(egs(mac).find((m) => m.k === 'rcpt')?.r)?.q, 'v');
    // a breach past its last word leaves the list as it is read
    await hub.state.storage.put(EG_LIVE_KEY, { [B]: { egv: EG_SPEC, until: Date.now() - 1 } });
    hub.room._egLive = undefined;
    step(EG_LIVE_SAID_MS);
    assert.equal((await ask()).live, 0);
  });
  assert.ok(RELAY_CFG_KEYS.includes('egDrain') && RELAY_CFG_VARS.egDrain === 'EG_DRAIN', 'the setting over its Worker var');
  assert.equal(EG_LIVE_MAX, 64);
});

test('EG-H2 THE LAW PIN (section 22): a member\'s `spec` answered with its hall in the breach\'s own law\'s bytes (this circle or the next, to that socket alone), which a client whose law differs takes as given - read before any draw; EG_LAWS keeps this build\'s law, seven days a law; a woken room whose law this build does not draw ends its breach as a void - the entered member\'s end receipt says `void` (its stake returned) and the opener who never entered is handed the void itself (mutants: a far hall answered; the given hall unread; the unknown law run on; the opener\'s stake kept)', async () => {
  await withBreach(async (rig) => {
    const { eg, beat } = rig;
    const { ws } = await toTrial(rig);
    const rec = held(eg);
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'spec', h: 3 }));
    const sp = egs(ws).filter((m) => m.k === 'spec');
    assert.equal(sp.length, 1);
    assert.deepEqual([sp[0].egv, sp[0].h], [EG_SPEC, 3]);
    assert.deepEqual(sp[0].sp, JSON.parse(JSON.stringify(egHallOf(rec.seed, 3))), 'the relay\'s own bytes');
    assert.ok(validEgOut(sp[0]), 'the wire takes it');
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'spec', h: 16 }));
    assert.equal(egs(ws).filter((m) => m.k === 'spec').length, 1, 'a circle beyond the next: nothing');
    assert.deepEqual(validEgIn({ k: 'spec', h: 3, x: 1 }), { k: 'spec', h: 3 });
    // the client's half: a given hall read before any draw
    const given = { ...JSON.parse(JSON.stringify(egHallOf(rec.seed, 3))), laid: 77 };
    assert.equal(egSpecGive(given), true);
    try { assert.equal(egHallOf(rec.seed, 3).laid, 77, 'the given hall, not this law\'s draw'); } finally { egSpecForget(); }
    assert.notEqual(egHallOf(rec.seed, 3).laid, 77, 'forgotten, drawn again');
    assert.equal(egSpecGive({ h: 1 }), false, 'a hall that names no seed is none');
    await beat(1000);
  }, { party: false });
  // PIN MOVED (EG-ZC): spec law 5 (the last fragments) became the law on 2026-10-12, and law 4 is kept beside it its seven days.
  // PIN MOVED (AUDIT EG III): spec law 6 (the span decrees on every span) became the law on 2026-10-13, laws 4 and 5 kept beside it
  // PIN MOVED (EG-HERO-LAY): spec law 7 (the heroes laid) became the law on 2026-10-13 too, laws 4, 5 and 6 kept beside it.
  // PIN MOVED (AUDIT EG V, f): spec law 8 (the ways laid) became the law on 2026-10-15, laws 4 to 7 kept beside it.
  // PIN MOVED (THE ASCENT - THE ROOMS): spec law 9 (the hall a way of rooms) became the law on 2026-10-16, laws 4 to 8 kept beside it
  // PIN MOVED (EG-PERFECT): spec law 10 (THE BROKEN WAY) became the law on 2026-10-18, laws 4 to 9 kept beside it
  assert.equal(EG_LAWS[EG_SPEC], '2026-10-18', 'this build draws its own law');
  assert.equal(EG_LAWS[EG_SPEC - 1], '2026-10-16', 'and the law before, kept');
  assert.equal(EG_LAWS[EG_SPEC - 2], '2026-10-15', 'and the one before it, inside its seven days');
  assert.equal(EG_LAWS[EG_SPEC - 3], '2026-10-13', 'and the one before that, inside its seven days');
  assert.equal(EG_LAWS[EG_SPEC - 4], '2026-10-13', 'and the one before that, inside its seven days');
  assert.equal(EG_LAWS[EG_SPEC - 5], '2026-10-12', 'and the one before that, inside its seven days');
  assert.equal(EG_LAWS[EG_SPEC - 6], '2026-10-11', 'and the first, inside its seven days');

  assert.equal(EG_LAW_KEEP_DAYS, 7);
  assert.deepEqual([egLawKnown(EG_SPEC), egLawKnown(EG_SPEC - 1), egLawKnown(999), egLawKnown('4')], [true, true, false, false]);
  // a woken room whose law this build does not draw: the breach a void
  await withBreach(async (rig) => {
    const { eg, beat, enter, restart, step } = rig;
    const spec = egHallOf(eg.store.get(EG_KEY).seed, 1);
    step(EG_SEALED_MS); await beat(1000);
    const annWs = await enter('acct-ann', 'peer-ann', spec.x0 + spec.arrive.x, spec.arrive.z);
    for (let t = 0; t <= EG_ADMIT_MAX_MS; t += 5000) { await eg.pose(annWs, at(spec.x0 + spec.arrive.x, spec.arrive.z)); await beat(5000); }   // the opener never comes: the hall wakes as the open window ends
    assert.equal(held(eg).sg, 'trial');
    await beat(3000);
    const old = eg.store.get(EG_KEY);
    eg.store.set(EG_KEY, { ...old, egv: 999 });
    restart(5000);
    await beat(1000);
    const V = eg.store.get(EG_KEY);
    assert.equal(V.end, 'void', 'a law this relay does not draw: the breach voided');
    const ann = (V.rc['acct-ann'] ?? []).map(readEgReceipt).find((c) => c.q === 'x');
    assert.equal(ann?.why, 'void', 'the member\'s end says void - its stake returned');
    const mac = (V.rc['acct-mac'] ?? []).map(readEgReceipt);
    // PIN MOVED (AUDIT EG IV, lane3 #11): it held the void alone - the opener the first wake found outside is owed their end
    // then ('empty', nothing cleared), and the void after it still hands the stake back (a void returns a stake held or spent)
    assert.deepEqual(mac.map((c) => [c.q, c.z, c.why ?? '', c.h ?? 0]), [['x', 'z'.repeat(20), 'empty', 0], ['v', 'z'.repeat(20), '', 0]], 'the opener who never entered handed the void itself');
  }, { party: true });
});

test('EG-H2 THE RECEIPTS\' SECRET (section 22): the room draws `rs` at the open and keeps it, and no frame ever carries it; a receipt\'s seed is HMAC(rs, sub|R|kind) - a room woken before its save mints the same roll again, never a second; the receipts are kept in storage before they go out (mutants: the seed the CSPRNG\'s; the secret said; the receipts sent before the save)', async () => {
  await withBreach(async (rig) => {
    const { eg, beat, restart } = rig;
    const { ws } = await toTrial(rig);
    await beat(2000);
    const rs = eg.store.get(EG_KEY).rs;
    assert.match(rs, /^[0-9a-f]{64}$/, 'thirty-two bytes, kept');
    for (const sock of [ws]) assert.ok(!JSON.stringify(sock.sent).includes(rs), 'no frame carries the secret');
    // a Redoubt's receipt owed, minted - and the storage holding it the moment it is sent
    const claims = { b: B, s: 'acct-mac', z: 'z'.repeat(20), q: 'w', w: 1, h: 5, t: 60, n: 1, ew: 0, l: 20 };
    const before = structuredClone(eg.store.get(EG_KEY));
    const kept = [];
    const send = eg.room._send.bind(eg.room);
    eg.room._send = (sock, s) => { if (String(s).includes('"rcpt"')) kept.push((eg.store.get(EG_KEY).rc?.['acct-mac'] ?? []).length); return send(sock, s); };
    eg.room._eg.owe.push({ sub: 'acct-mac', claims });
    await eg.room._egMint(eg.room._eg, rig.now());
    assert.deepEqual(kept, [1], 'kept before it went out');
    const r1 = readEgReceipt(egs(ws).filter((m) => m.k === 'rcpt').at(-1).r);
    assert.equal(r1.c, await egReceiptSeed(rs, 'acct-mac', 1, 'w', subtle), 'HMAC(rs, sub|R|kind)');
    // the room dies before that save landed: woken from the state before it, it owes the receipt again - and mints the same roll
    eg.store.set(EG_KEY, { ...before, owe: [{ sub: 'acct-mac', claims }] });
    restart(1000);
    const back = eg.connect(); await eg.hello(back, 'peer-mac', null, { kind: 'linked', tokenSub: 'acct-mac', charLevel: 20 });
    await eg.room._egMint(await eg.room._egOf(), rig.now());
    const all = (eg.store.get(EG_KEY).rc['acct-mac'] ?? []).map(readEgReceipt).filter((c) => c.q === 'w');
    assert.equal(all.at(-1).c, r1.c, 'the same roll, never a second');
    const key = await subtle.importKey('raw', new Uint8Array(rs.match(/../g).map((h) => parseInt(h, 16))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await subtle.sign('HMAC', key, new TextEncoder().encode('acct-mac|0|x')));
    assert.equal(await egReceiptSeed(rs, 'acct-mac', 0, 'x', subtle), ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0, 'the first four bytes, big-endian');
    await assert.rejects(egReceiptSeed('abcd', 'acct-mac', 0, 'x', subtle), /32-byte/);
  });
});
