// EG-ZA (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 20-23): A KEY IS NEVER
// LOST AND THE RECEIPTS SAY EVERYTHING, played against the relay's real Room (test/fakeRoom.mjs - a hub and a breach's room
// over fake objects, the binding between them a fetch this file can refuse): the hub retries the room's open, told once its
// call went out; an open the room never took is voided BY THE ROOM, its tombstone first, the same receipt asked again; a
// client's void of a stake no call answered; an end with no hall woken a void, never the opener's 'empty' unless the call
// went out; every receipt held at the hub until its account says it is counted, a member offline at the end handed theirs
// on return; a `force` deploy's void; the tick a second outside a trial. And the receipts' table whole - `td` on an end,
// `sh` and `m` on a Redoubt, `co` on both, inside the 640-byte bound - read by the account service (test/accountDb.mjs):
// the share and the measures kept, the Descent's company by `co`. And this screen's half (scenes/eliteGates/egClient.js, net/online.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { standService, T0 as T0S } from '../../accountDb.mjs';
import { SOCIAL_ROOM, EG_KEY, EG_INTERNAL_OPEN, EG_KINDS, EG_NO_WORDS, validEgIn, validEgOut, parseClient, RELAY_VERSION } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egTimes, EG_SEALED_MS, EG_GATHER_MS, EG_ADMIT_MAX_MS, EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { EG_VOID_MAX_S, EG_DONE_KEY, EG_OPEN_HUB_TRIES, EG_INTERNAL_VOID, EG_INTERNAL_CALLED, EG_INTERNAL_RCPT, EG_RC_KEEP, EG_RC_TELL_MS, EG_BEAT_TRIAL_MS, EG_BEAT_SLOW_MS, EG_GAP_MS,
  egRcKey, egRcId, egRcFold, egRcSpent, egRcLive, egDoneWith, egDoneOf, egVoidable, egForceVoided, egTrialRuns, egTickAt } from '../../../src/net/eliteGates/egDurable.js';
import { egBreachNew, egEnter, egStep, egBlow, egDown, egWord, egEnd, egPoseIn } from '../../../src/net/eliteGates/egBrain.js';
import { mintEgReceipt, readEgReceipt, verifyEgReceipt, egReceiptValid, egCompanyTag, egCompanyValid, egMeasuresValid, EG_RECEIPT_MAX, EG_SHARE_WHOLE, EG_MEASURE_MAX } from '../../../src/net/eliteGates/egReceipt.js';
import { egFairNew } from '../../../src/net/eliteGates/egFair.js';
import { mintEgOrder, verifyEgOpenAnyAge } from '../../../src/net/identityToken.js';
import { BRAIN_TICK_MS } from '../../../src/net/gate/gateBrain.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egDescentCompanies } from '../../../server-account/src/egHonours.js';
import { createEgClient, EG_STAKES_KEY, EG_VOID_WAIT_MS, EG_VOID_ASK_MS, EG_VOID_TEXT, EG_OPEN_TRIES, EG_OPEN_RETRY_MS } from '../../../src/scenes/eliteGates/egClient.js';
import { OnlineSession } from '../../../src/net/online.js';
import { weirKeysHeld } from '../../../src/systems/eliteGates/weirKey.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef', B2 = 'fedcba9876543210', B3 = '00112233445566ff';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const at = (sx, z) => { const [x, y, dz] = realmToDungeon(sx, 0, z); return { x, y, z: dz, yaw: 0, pitch: 0 }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');
const rcpts = (ws) => [...new Set(egs(ws).filter((m) => m.k === 'rcpt').map((m) => m.r))];
const nos = (ws) => egs(ws).filter((m) => m.k === 'no').map((m) => m.m);
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

/**
 * A hub and the breach rooms over a driven clock - `acct-mac` on the hub (`ann` too, in his party, when `party`) - the
 * binding between objects a fetch `refuseIf` can make unreachable (`calls` every one asked: `[object, door]`).
 */
async function withRelay(fn, { party = false } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const calls = [];
  let refuse = () => false;
  const realGet = world.ROOMS.get;
  world.ROOMS.get = (id) => ({ fetch: async (request) => { const path = new URL(request.url).pathname; calls.push([id, path]); if (refuse(id, path)) throw new Error('unreachable'); return realGet(id).fetch(request); } });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const mac = hub.connect(); await hub.hello(mac, 'peer-mac', null, { name: 'Mac', acct: 'acct-mac', asecret: 'secret-of-acct-mac', kind: 'linked' });
      let ann = null;
      if (party) {
        ann = hub.connect(); await hub.hello(ann, 'peer-ann', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', kind: 'linked' });
        clock += 600; await hub.raw(mac, JSON.stringify({ t: 'social', k: 'party.invite', peer: 'peer-ann' }));
        clock += 600; await hub.raw(ann, JSON.stringify({ t: 'social', k: 'party.accept', party: mac.att.party }));
        clock += 600;
        assert.ok(hub.store.get(`party:${mac.att.party}`)?.members?.includes('acct-ann'), 'a party of two');
      }
      const order = async (eb, ez, s = 'acct-mac') => mintEgOrder({ o: 'egopen', s, eb, ez }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      const say = (ws, w) => hub.raw(ws, JSON.stringify({ t: 'eg', ...w }));
      const room = (b) => world.room(egRoomKey(b));
      const beat = async (eg, ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      const admit = async (eg, b, sub, ez) => mintEgOrder({ o: 'egadmit', s: sub, eb: b, ez }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      /** A member in breach `b`'s room, admitted, standing at (sx, z) of the Spire's frame. */
      const enter = async (b, sub, peer, sx, z, ez = 'a'.repeat(20)) => {
        const eg = room(b), ws = eg.connect(); await eg.hello(ws, peer, at(sx, z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await admit(eg, b, sub, ez), lv: 20, bv: 2 }));
        await eg.pose(ws, at(sx, z));
        return ws;
      };
      await fn({ world, hub, mac, ann, calls, refuseIf: (f) => { refuse = f; }, order, say, room, beat, admit, enter, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
/** Breach `b` opened by Mac and its first hall woken with `acct-mac` in it - the trial's first beat. */
async function toTrial(rig, b = B) {
  const { say, order, room, beat, enter, step } = rig;
  await say(rig.mac, { k: 'open', z: await order(b, 'z'.repeat(20)), site: SITE });
  const eg = room(b), spec = egHallOf(eg.store.get(EG_KEY).seed, 1);
  step(EG_SEALED_MS); await beat(eg, 1000);
  const ws = await enter(b, 'acct-mac', 'peer-mac', spec.x0 + spec.arrive.x, spec.arrive.z);
  await beat(eg, EG_GATHER_MS + 1000);
  assert.equal(eg.room._eg.sg, 'trial');
  return { eg, ws, spec };
}

test('EG-ZA THE OPEN RETRIED, AND A VOID BY THE ROOM (section 23, steps 3 and 5; section 22 "A key\'s loss"): the hub tells the room its open EG_OPEN_HUB_TRIES times (idempotent on `ez`) and then tells it its call went out; a room that never answers leaves the open unsaid and nothing minted; a room that took another order, or a client\'s void of a stake no call answered, has the ROOM void it - the order written into its tombstone first, the `v` minted once and handed again the same, held at the hub for the opener, and the order never opening a breach after (mutants: one try; no void at a refused open; the call never told; the tombstone unread at the open; a second void minted; the void past the tombstone)', async () => {
  await withRelay(async ({ hub, mac, calls, refuseIf, order, say, room, step }) => {
    // the room drops the first two tells of the open: the hub's third opens it, its call said, the room told the call is out
    let dropped = 0;
    refuseIf((id, path) => id === egRoomKey(B) && path === EG_INTERNAL_OPEN && dropped++ < 2);
    await say(mac, { k: 'open', z: await order(B, 'z'.repeat(20)), site: SITE });
    assert.equal(EG_OPEN_HUB_TRIES, 3);
    assert.equal(calls.filter(([id, p]) => id === egRoomKey(B) && p === EG_INTERNAL_OPEN).length, 3, 'told three times');
    const R = room(B);
    assert.equal(R.store.get(EG_KEY)?.ez, 'z'.repeat(20), 'opened by the third');
    assert.equal(R.store.get(EG_KEY).called, 1, 'and told its call went out');
    assert.ok(egs(mac).some((m) => m.k === 'call' && m.b === B), 'the call said');
    assert.deepEqual(rcpts(mac), [], 'no void: the room took it');
    // a room that never answers: its void asked as often, unanswered too - the breach said closed, nothing minted
    mac.sent.length = 0; calls.length = 0;
    refuseIf((id) => id === egRoomKey(B2));
    const z2 = await order(B2, 'y'.repeat(20));
    await say(mac, { k: 'open', z: z2, site: SITE });
    assert.deepEqual(calls.filter(([id]) => id === egRoomKey(B2)).map(([, p]) => p), [EG_INTERNAL_OPEN, EG_INTERNAL_OPEN, EG_INTERNAL_OPEN, EG_INTERNAL_VOID, EG_INTERNAL_VOID, EG_INTERNAL_VOID]);
    assert.deepEqual(egs(mac).map((m) => m.k), ['no'], 'no call, no receipt: the stake waits for the client\'s ask');
    // the room back, the order long past its minute: the opener's client asks the void - the ROOM mints it
    refuseIf(() => false);
    step(10 * 60_000);
    mac.sent.length = 0;
    await say(mac, { k: 'void', z: z2 });
    const [r] = rcpts(mac), v = readEgReceipt(r);
    assert.deepEqual([v.q, v.b, v.s, v.z], ['v', B2, 'acct-mac', 'y'.repeat(20)], 'the stake handed back');
    const R2 = room(B2);
    assert.equal(R2.store.has(EG_KEY), false, 'no breach stands in it');
    assert.deepEqual(egDoneOf(R2.store.get(EG_DONE_KEY), 'y'.repeat(20)), ['y'.repeat(20), 'void', r], 'the order in its tombstone, with its void');
    assert.equal(R2.store.get(EG_DONE_KEY).until, Math.floor(Date.now() / 1000) + EG_VOID_MAX_S, 'kept a week');
    assert.equal(R2.alarm.at, R2.store.get(EG_DONE_KEY).until * 1000, 'its one alarm: the tombstone\'s end (section 22, "Unknown rooms")');
    assert.deepEqual(egRcLive(hub.store.get(egRcKey('acct-mac')), Math.floor(Date.now() / 1000)), [r], 'held at the hub for the opener\'s hellos');
    // asked again, a while on: the same receipt, never a second
    step(5000);
    mac.sent.length = 0;
    await say(mac, { k: 'void', z: z2 });
    assert.deepEqual(rcpts(mac), [r], 'the same void');
    // the order never opens a breach after (the service's re-ask mints the same ids again within its minute)
    mac.sent.length = 0;
    await say(mac, { k: 'open', z: await order(B2, 'y'.repeat(20)), site: SITE });
    assert.equal(R2.store.has(EG_KEY), false, 'the tombstone refuses it');
    assert.deepEqual(egs(mac).map((m) => (m.k === 'rcpt' ? m.r : m.k)), [r, 'no'], 'its void handed again, the breach closed');
    // SPENT FIRST: a room whose signing fails writes the order into its tombstone before any void - the order never opens
    // after, and the void asked again once it can sign is minted then
    const R3 = room(B3), z3 = await order(B3, 'v'.repeat(20));
    R3.room._receiptKeyOf = async () => { throw new Error('no key'); };
    mac.sent.length = 0;
    await say(mac, { k: 'void', z: z3 });
    assert.deepEqual(rcpts(mac), [], 'nothing signed');
    assert.deepEqual(egDoneOf(R3.store.get(EG_DONE_KEY), 'v'.repeat(20)), ['v'.repeat(20), 'void', ''], 'the order spent all the same');
    await say(mac, { k: 'open', z: z3, site: SITE });
    assert.equal(R3.store.has(EG_KEY), false, 'and never opened');
    delete R3.room._receiptKeyOf;
    mac.sent.length = 0;
    await say(mac, { k: 'void', z: z3 });
    assert.deepEqual(rcpts(mac).map(readEgReceipt).map((c) => [c.q, c.z]), [['v', 'v'.repeat(20)]], 'its void minted once it can be');
    // a room another order holds: this order it never took - voided for it, the breach left alone
    mac.sent.length = 0;
    await say(mac, { k: 'open', z: await order(B, 'x'.repeat(20)), site: SITE });
    const vx = readEgReceipt(rcpts(mac)[0]);
    assert.deepEqual([vx?.q, vx?.z], ['v', 'x'.repeat(20)]);
    assert.deepEqual([R.store.get(EG_KEY).ez, R.store.get(EG_KEY).end], ['z'.repeat(20), null], 'the breach that holds the room untouched');
  });
});

test('EG-ZA THE VOID OF A BREACH THE ROOM TOOK (section 22): while nothing has begun - no call told out, no hall woken, no member in - its opener\'s void ends it as a void (the `v` its own); once the call is out the void is refused in words (the breach\'s receipts settle the stake); another\'s order is not theirs to void; past EG_VOID_MAX_S since its issue it is too old, at the hub and at the room\'s own door; an open order verified whatever its age, never another kind (mutants: a called breach voided; an entered one; the age unread; the account unread)', async () => {
  await withRelay(async ({ mac, ann, calls, refuseIf, order, say, room, step, now }) => {
    refuseIf((id, path) => path === EG_INTERNAL_CALLED);   // the hub's word that the call went out, lost
    const zOld = await order(B3, 'w'.repeat(20));   // an open that will be a week old
    const z = await order(B, 'z'.repeat(20));
    await say(mac, { k: 'open', z, site: SITE });
    const R = room(B);
    assert.equal(R.store.get(EG_KEY).called, undefined, 'never told');
    mac.sent.length = 0;
    await say(mac, { k: 'void', z });
    assert.equal(R.store.get(EG_KEY).end, 'void', 'the breach ended a void');
    assert.deepEqual(rcpts(mac).map(readEgReceipt).map((c) => [c.q, c.z]), [['v', 'z'.repeat(20)]], 'the opener\'s stake back');
    refuseIf(() => false);
    const z2 = await order(B2, 'y'.repeat(20));
    await say(mac, { k: 'open', z: z2, site: SITE });
    assert.equal(room(B2).store.get(EG_KEY).called, 1);
    mac.sent.length = 0;
    await say(mac, { k: 'void', z: z2 });
    assert.deepEqual(egs(mac).map((m) => (m.k === 'no' ? m.m : m.k)), ['the breach took the key'], 'its call is out: the company may answer');
    assert.equal(room(B2).store.get(EG_KEY).end, null);
    // Ann may not void Mac's order
    ann.sent.length = 0;
    await say(ann, { k: 'void', z: z2 });
    assert.deepEqual(nos(ann), ['the order is not yours']);
    // too old, at the hub
    step(EG_VOID_MAX_S * 1000 + 1000);
    mac.sent.length = 0;
    calls.length = 0;
    await say(mac, { k: 'void', z: zOld });
    assert.deepEqual(nos(mac), ['the void is too old']);
    assert.deepEqual(calls.filter(([id]) => id === egRoomKey(B3)), [], 'never asked of its room');
    // and at the room's own door
    const door = await room(B3).room.fetch(new Request(`https://relay.internal${EG_INTERNAL_VOID}`, { method: 'POST', body: JSON.stringify({ s: 'acct-mac', eb: B3, ez: 'w'.repeat(20), i: Math.floor(now() / 1000) - EG_VOID_MAX_S - 1 }) }));
    assert.deepEqual(await door.json(), { ok: false, no: 'old' });
    assert.equal(room(B3).store.has(EG_DONE_KEY), false, 'nothing written for it at its own door either');
  }, { party: true });
  // the law
  const fresh = () => egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [] });
  assert.equal(egVoidable(fresh()), true);
  assert.equal(egVoidable({ ...fresh(), called: 1 }), false, 'the call out');
  assert.equal(egVoidable({ ...fresh(), wk: T0 }), false, 'a hall woken');
  assert.equal(egVoidable({ ...fresh(), mem: { 'acct-0': { in: 1 } } }), false, 'a member in');
  assert.equal(egVoidable({ ...fresh(), end: 'tear' }), false, 'ended');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const old = await mintEgOrder({ o: 'egopen', s: 'acct-0', eb: B, ez: 'z'.repeat(20) }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyEgOpenAnyAge(old, kp.publicKey, { subtle })).ok, true, 'long past its minute, still the opener\'s');
  const adm = await mintEgOrder({ o: 'egadmit', s: 'acct-0', eb: B, ez: 'z'.repeat(20) }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyEgOpenAnyAge(adm, kp.publicKey, { subtle })).ok, false, 'an admission is no stake');
  // a forged one: one whole character of the signature changed (its last two carry pad bits - an 'AA' there was the same
  // bytes one key in 256, a flake seen in AUDIT EG III's merge)
  const forged = old.slice(0, -3) + (old.at(-3) === 'A' ? 'B' : 'A') + old.slice(-2);
  assert.equal((await verifyEgOpenAnyAge(forged, kp.publicKey, { subtle })).ok, false, 'a forged one');
});

test('EG-ZA EMPTY OR VOID (section 22): a breach nobody answers is the opener\'s \'empty\' only when its room was told its call went out - otherwise, with no hall ever woken, a void and its opener handed the `v`; the room\'s end is held at the hub for the opener (mutants: the void rule gone; the call ignored; the opener owed nothing)', async () => {
  for (const called of [0, 1]) {
    const Bx = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1], ['acct-1', 'M1', 2]], site: SITE, wg: [] });
    if (called) Bx.called = 1;
    const T = egTimes({ openedAt: T0 });
    egStep(Bx, T.openAt, [], () => 0.5);
    assert.equal(Bx.sg, 'arrive');
    const out = egStep(Bx, T.admitUntil + 1, [], () => 0.5);
    assert.equal(Bx.end, called ? 'empty' : 'void', called ? 'the call was out' : 'no call out, no hall woken');
    assert.ok(out.some((f) => f.k === 'end' && f.why === Bx.end));
    assert.deepEqual(Bx.owe.map((o) => [o.sub, o.claims.q, o.claims.why ?? null]), [['acct-0', called ? 'x' : 'v', called ? 'empty' : null]], 'the opener owed its end, or its stake straight back');
  }
  // a woken breach ends as it says (a void is never forced on it)
  const W = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [] });
  egEnter(W, 'acct-0', 'o'.repeat(20), 30, T0 + EG_SEALED_MS + 1);
  W.wk = T0 + EG_SEALED_MS + 2; W.h = 1;
  egEnd(W, 'tear', T0 + EG_SEALED_MS + 3, []);
  assert.equal(W.end, 'tear');
  // the room: its call-out word lost - nobody answers, the opener has the void at the hub
  await withRelay(async ({ hub, mac, refuseIf, order, say, room, beat, step }) => {
    refuseIf((id, path) => path === EG_INTERNAL_CALLED);
    await say(mac, { k: 'open', z: await order(B, 'z'.repeat(20)), site: SITE });
    refuseIf(() => false);
    const R = room(B);
    step(EG_SEALED_MS); await beat(R, 1000);
    await beat(R, EG_ADMIT_MAX_MS + 2000);
    assert.equal(R.store.get(EG_KEY).end, 'void');
    const held = egRcLive(hub.store.get(egRcKey('acct-mac')), Math.floor(Date.now() / 1000)).map(readEgReceipt);
    assert.deepEqual(held.map((c) => [c.q, c.b, c.z]), [['v', B, 'z'.repeat(20)]], 'held at the hub, and handed to him there');
    assert.ok(rcpts(mac).includes(hub.store.get(egRcKey('acct-mac'))[0].r));
  });
});

test('EG-ZA THE RECEIPTS HELD AT THE HUB (section 23, step 5): every receipt a room mints is told the hub and kept under `egrc:<sub>`; a member online elsewhere has theirs at once, one offline at their next hello, again at every hello until their account says the service counted it (`claimed`) - then remembered as spent, a tell after it reviving nothing; a hub that did not answer is told again EG_RC_TELL_MS on, the ended breach beating on for it, and then its one alarm is its tombstone\'s; the sweep forgets an account\'s once every one has expired (mutants: never told; told while the hub refused, never again; handed to a member in the room by the hub too; the hello unhanded; `claimed` unread; a spent copy revived; the sweep unwidened)', async () => {
  await withRelay(async ({ hub, mac, ann, refuseIf, order, say, room, beat, enter, step }) => {
    await say(mac, { k: 'open', z: await order(B, 'z'.repeat(20)), site: SITE });
    const R = room(B), spec = egHallOf(R.store.get(EG_KEY).seed, 1);
    step(EG_SEALED_MS); await beat(R, 1000);
    const annWs = await enter(B, 'acct-ann', 'peer-ann', spec.x0 + spec.arrive.x, spec.arrive.z);
    for (let t = 0; t <= EG_ADMIT_MAX_MS && R.room._eg.sg !== 'trial'; t += 5000) { await R.pose(annWs, at(spec.x0 + spec.arrive.x, spec.arrive.z)); await beat(R, 5000); }
    assert.equal(R.room._eg.sg, 'trial', 'Mac never came: the hall woke for Ann');
    await R.raw(annWs, JSON.stringify({ t: 'eg', k: 'fell' }));
    R.drop(annWs);   // her room's socket gone: she is online at the hub alone
    refuseIf((id, path) => path === EG_INTERNAL_RCPT);   // the hub does not take the room's tell
    ann.sent.length = 0;
    await beat(R, 1000);
    const E = R.room._eg;
    assert.equal(E.end, 'wipe');
    assert.equal(E.rq.length, 1, 'owed to the hub, kept with the breach');
    assert.equal(hub.store.get(egRcKey('acct-ann')), undefined, 'the hub has nothing yet');
    assert.ok(R.alarm.at <= Date.now() + EG_RC_TELL_MS && R.alarm.at > Date.now(), 'the ended breach beats on, to tell it again');
    refuseIf(() => false);
    await beat(R, EG_RC_TELL_MS + 1000);
    const [r] = egRcLive(hub.store.get(egRcKey('acct-ann')), Math.floor(Date.now() / 1000));
    const c = readEgReceipt(r);
    assert.deepEqual([c.q, c.why, c.s], ['x', 'wipe', 'acct-ann'], 'held for her');
    assert.deepEqual(rcpts(ann), [r], 'online at the hub, out of the room: handed at once');
    assert.deepEqual(R.room._eg.rq, [], 'told');
    assert.equal(R.alarm.at, R.store.get(EG_DONE_KEY).until * 1000, 'now its one alarm is its tombstone\'s');
    // she goes offline and comes back: handed again at her hello, and at the next, until counted
    hub.drop(ann);
    for (let k = 0; k < 2; k++) {
      const back = hub.connect(); await hub.hello(back, 'peer-ann', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', kind: 'linked' });
      assert.deepEqual(rcpts(back), [r], `hello ${k + 1}: handed`);
      if (k === 1) {
        await say(back, { k: 'claimed', b: B, q: 'x', w: 0 });
        assert.deepEqual(hub.store.get(egRcKey('acct-ann')).map((x) => [x.id, x.spent ?? 0]), [[egRcId(c), 1]], 'remembered as spent');
      }
      hub.drop(back);
    }
    const after = hub.connect(); await hub.hello(after, 'peer-ann', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', kind: 'linked' });
    assert.deepEqual(rcpts(after), [], 'counted: never handed again');
    // the room's tell again (a woken room's own retry) revives nothing
    await hub.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_RCPT}`, { method: 'POST', body: JSON.stringify({ b: B, rc: [['acct-ann', r]], here: [] }) }));
    assert.equal(egRcLive(hub.store.get(egRcKey('acct-ann')), Math.floor(Date.now() / 1000)).length, 0, 'the spent mark stands over it');
    // a tell naming another's receipt, or another breach's, is kept for nobody
    await hub.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_RCPT}`, { method: 'POST', body: JSON.stringify({ b: B2, rc: [['acct-ann', r], ['acct-mac', r]], here: [] }) }));
    // PIN MOVED (AUDIT EG IV, lane3 #11): it held `undefined` - Mac, the opener who never stepped in, is owed his own end at
    // the first wake now ('empty'), so the hub holds his; Ann's receipt is held for him still never
    assert.ok(!(hub.store.get(egRcKey('acct-mac')) ?? []).some((x) => x.r === r), 'another\'s receipt kept for nobody');
    assert.deepEqual(egRcLive(hub.store.get(egRcKey('acct-mac')), Math.floor(Date.now() / 1000)).map((x) => [readEgReceipt(x).q, readEgReceipt(x).why, readEgReceipt(x).h]), [['x', 'empty', 0]], 'the opener\'s own end, nothing cleared');
    // the sweep: past every receipt's life, the account's key forgotten
    step(8 * 24 * 3600 * 1000);
    await hub.room._sweepHub(Date.now());
    assert.equal(hub.store.has(egRcKey('acct-ann')), false, 'swept');
  }, { party: true });
  // the law
  const nowS = 1000;
  const e = (id, r, x = nowS + 100) => ({ id, r, e: x });
  assert.deepEqual(egRcFold([e('a', 'r1')], [e('a', 'r2'), e('b', 'r3')], nowS).map((x) => x.r), ['r2', 'r3'], 'one an identity, the newer kept');
  assert.deepEqual(egRcFold([e('a', 'r1', nowS)], [], nowS), [], 'the expired dropped');
  assert.equal(egRcFold([], Array.from({ length: EG_RC_KEEP + 3 }, (_, i) => e(`k${i}`, `r${i}`)), nowS).length, EG_RC_KEEP, 'bounded');
  const spent = egRcSpent([e('a', 'r1')], 'a', nowS, nowS + 100);
  assert.deepEqual(egRcFold(spent, [e('a', 'r9')], nowS).map((x) => [x.id, x.spent ?? 0]), [['a', 1]], 'never over a spent mark');
  assert.deepEqual(egRcLive(spent, nowS), []);
  assert.equal(egRcId({ b: B, q: 'w', w: 3 }), `${B}:w:3`);
  assert.equal(egRcId({ b: B, q: 'x' }), `${B}:x:0`);
});

test('EG-ZA THE FORCE VOID (section 22): a `force` relay deploy stamps the Worker (`EG_VOID_BEFORE`); a breach\'s room woken under it whose breach opened before the stamp ends it as a void - the entered member\'s end says `void` (its stake returned), the Redoubts taken kept - and a breach opened after it runs on; the deploy\'s force path sets the stamp, and only it (mutants: the stamp unread; every breach voided; the stamp on every deploy)', async () => {
  await withRelay(async (rig) => {
    // first, a member in the room at the end: the room hands it, the hub holds it and hands it nowhere else
    const w3 = await toTrial(rig, B3);
    await w3.eg.raw(w3.ws, JSON.stringify({ t: 'eg', k: 'fell' }));
    rig.mac.sent.length = 0;
    await rig.beat(w3.eg, 1000);
    assert.equal(w3.eg.room._eg.end, 'wipe');
    const r3 = rcpts(w3.ws);
    assert.equal(r3.length, 1, 'the room handed it');
    assert.deepEqual(rcpts(rig.mac), [], 'in the room: the hub hands it nowhere else');
    assert.deepEqual(egRcLive(rig.hub.store.get(egRcKey('acct-mac')), Math.floor(Date.now() / 1000)), r3, 'held all the same');
    const { eg } = await toTrial(rig);
    await rig.beat(eg, 3000);
    eg.env.EG_VOID_BEFORE = String(Date.now());
    eg.sockets.splice(0); rig.step(5000); eg.wake();
    await rig.beat(eg, 1000);
    const V = eg.store.get(EG_KEY);
    assert.equal(V.end, 'void', 'opened before the stamp: voided as it woke');
    assert.deepEqual((V.rc['acct-mac'] ?? []).map(readEgReceipt).map((c) => [c.q, c.why]), [['x', 'void']], 'the member\'s end says void');
    // a breach opened after the stamp: woken under it, it runs on
    rig.step(60_000);
    await rig.say(rig.mac, { k: 'open', z: await rig.order(B2, 'y'.repeat(20)), site: SITE });
    const E2 = rig.room(B2);
    E2.env.EG_VOID_BEFORE = eg.env.EG_VOID_BEFORE;
    E2.wake(); rig.step(1000);
    await rig.beat(E2, 1000);
    assert.equal(E2.store.get(EG_KEY).end, null, 'opened after it: untouched');
  });
  const L = { op: T0, end: null };
  assert.deepEqual([egForceVoided(L, T0 + 1), egForceVoided(L, T0), egForceVoided(L, 0), egForceVoided({ ...L, end: 'tear' }, T0 + 1)], [true, false, false, false]);
  const wf = rd('.github/workflows/relay-deploy.yml'), step = wf.slice(wf.indexOf('- name: Deploy\n'), wf.indexOf('- name: Verify /health'));
  assert.match(step, /FORCE: \$\{\{ github\.event\.inputs\.force \}\}/);
  assert.match(step, /if \[ "\$FORCE" = "true" \]; then\n\s+stamp=\$\(date \+%s%3N\)\n[^\n]*\n\s+npx --yes wrangler@4 deploy --var "EG_VOID_BEFORE:\$\{stamp\}"\n\s+else\n\s+npx --yes wrangler@4 deploy\n\s+fi/, 'the stamp on a force deploy alone');
});

test('EG-ZA THE TICK (section 22, THE COST): a breach\'s beat is BRAIN_TICK_MS only while a trial runs with its company in the room, a second otherwise (never past the stage\'s own end), and none while the arch rises - its first beat the open; no gap of the run passes EG_GAP_MS, so nothing is given back for it (mutants: the trial\'s beat always; the slow beat past the stage\'s end; beats while the arch rises; a closing\'s foe unseen)', async () => {
  assert.equal(EG_BEAT_TRIAL_MS, BRAIN_TICK_MS, 'pinned equal');
  assert.ok(EG_BEAT_SLOW_MS < EG_GAP_MS, 'a slow beat is no gap');
  const now = T0 + 10_000;
  const b = (o) => ({ sg: 'trial', su: 0, end: null, F: null, ...o });
  assert.equal(egTickAt(b({ sg: 'wait', su: now + 200_000 }), now, true), now + 200_000, 'none while the arch rises');
  assert.equal(egTickAt(b({ sg: 'wait', su: now + 10 }), now, true), now + EG_BEAT_TRIAL_MS);
  assert.equal(egTickAt(b({}), now, true), now + EG_BEAT_TRIAL_MS, 'a trial with its company here');
  assert.equal(egTickAt(b({}), now, false), now + EG_BEAT_SLOW_MS, 'nobody here');
  assert.equal(egTickAt(b({ sg: 'rest', su: now + 60_000 }), now, true), now + EG_BEAT_SLOW_MS, 'a rest');
  assert.equal(egTickAt(b({ sg: 'arrive', su: now + 400 }), now, true), now + 400, 'never past the stage\'s end');
  assert.equal(egTickAt(b({ sg: 'arrive', su: now + 100 }), now, true), now + EG_BEAT_TRIAL_MS, 'never sooner than a trial\'s beat');
  const foe = (o) => ({ role: 1, hp: 10, fl: 0, ...o });
  assert.equal(egTickAt(b({ sg: 'closing', su: now + 30_000, F: { bodies: [foe({ hp: 0 }), foe({ role: 2 }), foe({ fl: 2 }), foe({ fl: 512 })] } }), now, true), now + EG_BEAT_SLOW_MS, 'a closing with no living foe');
  assert.equal(egTrialRuns(b({ sg: 'closing', F: { bodies: [foe()] } })), true, 'a Kyn Mimic\'s Lurker in the closing');
  assert.equal(egTrialRuns(b({ end: 'tear' })), false);
  await withRelay(async (rig) => {
    await rig.say(rig.mac, { k: 'open', z: await rig.order(B, 'z'.repeat(20)), site: SITE });
    const eg = rig.room(B);
    assert.equal(eg.alarm.at, eg.store.get(EG_KEY).su, 'no beat until the open');
    rig.step(EG_SEALED_MS); await rig.beat(eg, 1000);
    const spec = egHallOf(eg.store.get(EG_KEY).seed, 1);
    const ws = await rig.enter(B, 'acct-mac', 'peer-mac', spec.x0 + spec.arrive.x, spec.arrive.z);
    await rig.beat(eg, EG_GATHER_MS + 1000);
    assert.equal(eg.room._eg.sg, 'trial');
    let last = Date.now();
    const gaps = [];
    for (let k = 0; k < 12; k++) { const at0 = eg.alarm.at; gaps.push(at0 - last); last = at0; rig.step(at0 - Date.now()); await eg.fire(); await eg.pose(ws, at(spec.x0 + spec.arrive.x, spec.arrive.z)); }
    assert.ok(gaps.slice(1).every((g) => g === EG_BEAT_TRIAL_MS), `the trial's beat with Mac here: ${gaps}`);
    eg.drop(ws);
    rig.step(eg.alarm.at - Date.now()); await eg.fire();
    assert.equal(eg.alarm.at - Date.now(), EG_BEAT_SLOW_MS, 'nobody in the room: a second');
    for (let k = 0; k < 20; k++) { rig.step(eg.alarm.at - Date.now()); await eg.fire(); }
    assert.equal(eg.room._eg.gv ?? 0, 0, 'no gap past EG_GAP_MS - nothing given back for the slow beat');
  });
});

/** A breach of `n` begun at Court hall `start`, played by test/net/eliteGates/egeco_herald.test.js's auto-player until `until`; `each`
 *  runs every step before the director's (the director's own record, its own beat). */
function play({ n = 2, seed = 77, start = 5, until = () => false, each = () => {}, maxMs = 40 * 60_000 } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}000`, `M${i}`, i + 1]);
  const Bx = egBreachNew({ b: B, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  const pos = {};
  for (const [sub] of co) { assert.equal(egEnter(Bx, sub, `ord${sub}`.padEnd(20, 'x').slice(0, 20), 40, now), null); pos[sub] = { sx: 0, z: 0 }; }
  Bx.h = start; Bx.sg = 'arrive'; Bx.wk = now; Bx.cnt = { left: 1_800_000, at: now }; Bx.pulledAt = now; Bx.su = now + 30_000;
  while (now < T0 + maxMs && !Bx.end && !until(Bx)) {
    now += 250;
    const spec = egHallOf(Bx.seed, Bx.h, 0), F = Bx.F;
    for (const [sub, m] of Object.entries(Bx.mem)) {
      if (!m.alive) continue;
      const p = pos[sub], x0 = spec.x0;
      const live = F ? F.bodies.filter((t) => t.hp > 0 && !(t.fl & (2 | 16 | 128))) : [];
      const tgt = live.filter((t) => t.role === 1)[0] ?? live.sort((a, c) => Math.hypot(a.x - (p.sx - x0), a.z - p.z) - Math.hypot(c.x - (p.sx - x0), c.z - p.z))[0];
      if (Bx.sg === 'arrive') { p.sx = x0 + spec.arrive.x + (m.n - 1) * 0.5; p.z = spec.arrive.z; }
      else if (Bx.sg === 'trial') {
        if (spec.kind === 'court' && F && !F.bodies.some((t) => t.role === 0 && t.up2)) { p.sx = x0 + spec.ring.x; p.z = spec.ring.z; }
        else if (tgt) { const yw = tgt.yaw ?? 0, sd = m.n % 2 ? 1 : -1; p.sx = x0 + tgt.x - Math.sin(yw) * 1.5 + sd * 0.3; p.z = tgt.z - Math.cos(yw) * 1.5; }
      }
    }
    each(Bx, now, pos);
    egStep(Bx, now, Object.entries(Bx.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: now })), rng);
    for (const [sub, m] of Object.entries(Bx.mem)) {
      if (!m.alive || Bx.sg !== 'trial' || !Bx.F) { if (m.alive && Bx.sg === 'closing') egDown(Bx, sub, Bx.h, pos[sub], now); continue; }
      const p = pos[sub], sp = egHallOf(Bx.seed, Bx.h, 0);
      const live = Bx.F.bodies.filter((t) => t.hp > 0 && !(t.fl & (2 | 16 | 128)));
      const tgt = live.filter((t) => t.role === 1)[0] ?? live.sort((a, c) => Math.hypot(a.x - (p.sx - sp.x0), a.z - p.z) - Math.hypot(c.x - (p.sx - sp.x0), c.z - p.z))[0];
      if (tgt) egBlow(Bx, sub, { k: 'hit', i: tgt.i, q: Math.floor(now / 250), d: sub === co[0][0] ? 300 : 20, r: 1 }, { sx: p.sx, z: p.z }, now);   // PIN MOVED (AUDIT EG V, b: NEW-1 - a lord no longer stands frozen by a company inside its body, so the lighter hand is one the bucket never caps: 100 a blow was capped as 300 was, the shares even within a thousandth)
    }
  }
  return { B: Bx, now: () => now, co };
}

test('EG-ZA THE RECEIPTS SAY EVERYTHING (section 23\'s table; sections 20 and 21): a Redoubt\'s `w` carries `sh` (the member\'s share of the circle\'s damage, thousandths), `m` (THE FAIR TRAIL\'s measures over the circle - each trail folded as it closes, the Court\'s own at the fall, begun again after) and `co` (the company: its entrants\' count and a 48-bit tag of their accounts, sorted); an end\'s `x` carries `td` (the seconds from Hall 1\'s wake to the deepest hall\'s door, once one is cleared) and `co`; the law reads each and refuses another shape; the worst case of every field still inside EG_RECEIPT_MAX, only the optional lists trimmed (mutants: no `td`; no `co`; no share; the measures never folded; a trail folded twice; the share unbounded; a field on the wrong kind)', async () => {
  // the company's tag: FNV-1a 64 over the accounts sorted and comma-joined, its first twelve hex
  assert.deepEqual(egCompanyTag([]), [0, 'cbf29ce48422'], 'the offset basis');
  assert.deepEqual(egCompanyTag(['a']), [1, 'af63dc4c8601'], 'FNV-1a 64 of "a"');
  assert.deepEqual(egCompanyTag(['acct-b', 'acct-a']), egCompanyTag(['acct-a', 'acct-b']), 'in no order');
  assert.notDeepEqual(egCompanyTag(['acct-a', 'acct-b']), egCompanyTag(['acct-a', 'acct-c']));
  // a closed trail folded into the circle's measures, at the Court
  let injected = false;
  const fold = { span: 10_000, blind: 1000, cross: 9000, cblind: 0.2, cmin: 6000, brks: 1, fast: 870, wake: 1 };
  const { B: Bx, now, co } = play({
    until: (x) => x.sg === 'rest',
    each: (x, t, pos) => {
      if (injected || x.sg !== 'trial') return;
      injected = true;
      const lead = x.co[0].sub, m = x.mem[lead];
      const closed = { ...egFairNew(4), k: '4:0', ...fold };   // hall 4's trail, closed
      m.fair = closed;
      egPoseIn(x, lead, { sx: pos[lead].sx, y: 0, z: pos[lead].z }, t);   // the Court's first pose opens its own
      assert.deepEqual(m.mz, [1, 150, 20, 1, 870, 1], 'folded: one crossing at 150% of its bound, 20% blind, a break, 8.7 m/s, the wake\'s door');
      m.fair = closed;   // the same closed trail met again
      egPoseIn(x, lead, { sx: pos[lead].sx, y: 0, z: pos[lead].z }, t);
      egPoseIn(x, lead, { sx: pos[lead].sx, y: 0, z: pos[lead].z }, t + 1);
      assert.deepEqual(m.mz, [1, 150, 20, 1, 870, 1], 'and never twice');
    },
  });
  assert.equal(Bx.sg, 'rest', 'the Court fell');
  const ws = Bx.owe.filter((o) => o.claims.q === 'w');
  assert.deepEqual(ws.map((o) => o.sub).sort(), co.map((c) => c[0]).sort(), 'both earned');
  const tag = egCompanyTag(co.map((c) => c[0]));
  for (const o of ws) assert.deepEqual(o.claims.co, tag, 'the company');
  const sh = Object.fromEntries(ws.map((o) => [o.sub, o.claims.sh]));
  assert.ok(sh[co[0][0]] > sh[co[1][0]] && sh[co[0][0]] > 500, `the heavier hand's share the larger: ${JSON.stringify(sh)}`);
  assert.ok(Math.abs(sh[co[0][0]] + sh[co[1][0]] - EG_SHARE_WHOLE) <= 1, 'thousandths of the whole');
  const m0 = ws.find((o) => o.sub === co[0][0]).claims.m, m1 = ws.find((o) => o.sub === co[1][0]).claims.m;
  const court = Bx.mem[co[0][0]].fair;   // the Court's own trail, folded at the fall (its first pose off the plate: a break)
  assert.equal(court.mzd, 1, 'folded once, marked');
  assert.deepEqual(m0, [1, 150, 20, 1 + court.brks, 870, 1], 'the circle\'s measures: hall 4\'s crossing and the Court\'s trail');
  assert.deepEqual(m1, [0, 0, 0, 0, 0, 0], 'none judged');
  assert.ok(Object.values(Bx.mem).every((m) => m.mz == null), 'begun again for the next circle');
  // the end: its seconds to the deepest hall's door, its company
  egEnd(Bx, 'last', now() + 1000, []);
  const xs = Bx.owe.filter((o) => o.claims.q === 'x');
  assert.equal(xs.length, 2);
  for (const o of xs) { assert.equal(o.claims.td, Bx.td); assert.ok(o.claims.td > 0); assert.deepEqual(o.claims.co, tag); }
  const fresh = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [] });
  egEnter(fresh, 'acct-0', 'o'.repeat(20), 30, T0 + EG_SEALED_MS + 1);
  fresh.wk = T0 + EG_SEALED_MS + 2; fresh.h = 1;
  egEnd(fresh, 'tear', T0 + EG_SEALED_MS + 3, []);
  assert.equal(fresh.owe[0].claims.td, undefined, 'no hall cleared: no seconds said');
  // signed and verified as the relay and the service do it
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(T0 / 1000);
  for (const o of [...ws, ...xs]) {
    const v = await verifyEgReceipt(await mintEgReceipt({ ...o.claims, c: 7 }, kp.privateKey, { subtle, nowS }), kp.publicKey, { subtle, nowS });
    assert.ok(v.ok, v.why);
  }
  // the law
  const base = { q: 'w', b: B, s: 'acct-1234', z: 'z'.repeat(16), c: 1, w: 1, h: 5, t: 10, n: 1, ew: 0, l: 3, i: 1, e: 2 };
  const xb = { ...base, q: 'x', w: undefined, why: 'tear' };
  delete xb.w;
  assert.ok(egReceiptValid({ ...base, sh: 1000, m: [0, 0, 0, 0, 0, 0], co: [1, 'a'.repeat(12)] }));
  assert.ok(egReceiptValid({ ...xb, td: 99, co: [8, '0123456789ab'] }));
  for (const [bad, why] of [[{ ...base, sh: 1001 }, 'a share past the whole'], [{ ...base, sh: -1 }, 'a negative share'], [{ ...xb, sh: 5 }, 'a share on an end'],
    [{ ...base, td: 5 }, 'seconds on a Redoubt'], [{ ...xb, td: 7 * 24 * 3600 + 1 }, 'seconds past a week'], [{ ...base, m: [0, 0, 0, 0, 0] }, 'five measures'],
    [{ ...base, m: [0, 0, 0, 0, 0, EG_MEASURE_MAX + 1] }, 'a measure past its bound'], [{ ...xb, m: [0, 0, 0, 0, 0, 0] }, 'measures on an end'],
    [{ ...base, co: [9, 'a'.repeat(12)] }, 'a company of nine'], [{ ...base, co: [0, 'a'.repeat(12)] }, 'a company of none'], [{ ...base, co: [2, 'A'.repeat(12)] }, 'a tag not hex'], [{ ...base, co: [2, 'a'.repeat(11)] }, 'a short tag']]) {
    assert.equal(egReceiptValid(bad), false, why);
  }
  assert.equal(egCompanyValid(tag), true);
  assert.equal(egMeasuresValid([1, 2, 3, 4, 5, 6]), true);
  // the worst case of every field: still inside the bound, the lists alone trimmed
  const ids = { b: 'f'.repeat(16), s: 'A'.repeat(40), z: 'z'.repeat(32) }, ns = 4_000_000_000;
  const vs = Array.from({ length: 32 }, (_, i) => [i % 27, 1 + (i % 3)]);
  const w = { q: 'w', ...ids, c: 0xffffffff, w: 19_999, h: 99_999, t: 7 * 24 * 3600, n: 8, ew: 999, l: 999, vs, fl: 2, lb: 1, wg: [31, 30, 29], lk: 'q'.repeat(16), ft: 7, sh: EG_SHARE_WHOLE, m: new Array(6).fill(EG_MEASURE_MAX), co: [8, 'f'.repeat(12)] };
  const rw = await mintEgReceipt(w, kp.privateKey, { subtle, nowS: ns });
  assert.ok(rw.length <= EG_RECEIPT_MAX, `${rw.length}`);
  const cw = (await verifyEgReceipt(rw, kp.publicKey, { subtle, nowS: ns })).claims;
  assert.ok(cw.vs.length > 0 && cw.vs.length < 32, `${cw.vs.length} Vestiges kept`);
  for (const k of ['q', 'b', 's', 'z', 'c', 'w', 'h', 't', 'n', 'ew', 'l', 'fl', 'lb', 'wg', 'lk', 'ft', 'sh', 'm', 'co']) assert.deepEqual(cw[k], w[k], `${k} whole`);
  const x = { q: 'x', ...ids, c: 0xffffffff, h: 99_999, t: 7 * 24 * 3600, n: 8, ew: 999, l: 999, why: 'home', rl: Array.from({ length: 64 }, (_, i) => i + 1), fl: 1, wg: [31, 30, 29], an: 2 ** 30 - 1, td: 7 * 24 * 3600, co: [8, 'f'.repeat(12)] };
  const rx = await mintEgReceipt(x, kp.privateKey, { subtle, nowS: ns });
  assert.ok(rx.length <= EG_RECEIPT_MAX, `${rx.length}`);
  const cx = (await verifyEgReceipt(rx, kp.publicKey, { subtle, nowS: ns })).claims;
  for (const k of ['q', 'b', 's', 'z', 'c', 'h', 't', 'n', 'ew', 'l', 'why', 'fl', 'wg', 'an', 'td', 'co']) assert.deepEqual(cx[k], x[k], `${k} whole`);
  assert.ok(cx.rl.length > 0 && cx.rl.length < 64);
  assert.deepEqual(validEgOut({ k: 'rcpt', r: rw }), { k: 'rcpt', r: rw }, 'the wire carries it');
});

test('EG-ZA THE SERVICE READS THEM (sections 20 and 23): a Redoubt\'s claim keeps its share and its measures on its row (an old receipt\'s none), an end\'s its company; the Descent is one row a company by the receipt\'s `co` - the same company one row whoever of it claimed, two companies sharing their claimers two, its size the company\'s - and THE SEAL\'s runs rank by their seconds (mutants: the share unkept; the measures unkept; the company unkept; the Descent by its claimers still)', async (t) => {
  let clock = T0S * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService();
  const reg = async (h) => S.registered(h);
  const [A, Bq, C, D] = [await reg('Avel'), await reg('Brin'), await reg('Cass'), await reg('Dare')];
  const db = S.env.DB._raw, nowS = () => Math.floor(clock / 1000);
  const claim = async (who, claims) => { const r = await mintEgReceipt({ s: who.id, z: 'z'.repeat(16), c: 5, ew: 0, l: 10, ...claims }, S.gatePriv, { subtle, nowS: nowS() }); const a = await S.call('/v1/eg/claim', { receipt: r }, who.secret); clock += 1000; return a.body; };
  // a Redoubt's share and measures
  const b1 = '1000000000000001';
  assert.equal((await claim(A, { q: 'w', b: b1, w: 1, h: 5, t: 900, n: 2, sh: 640, m: [3, 112, 8, 0, 812, 0], co: egCompanyTag([A.id, Bq.id]) })).recorded, true);
  assert.deepEqual({ ...db.prepare('SELECT sh, m FROM eg_redoubts WHERE b = ? AND account = ?').get(b1, A.id) }, { sh: 640, m: '[3,112,8,0,812,0]' });
  await claim(Bq, { q: 'w', b: b1, w: 1, h: 5, t: 900, n: 2 });
  assert.deepEqual({ ...db.prepare('SELECT sh, m FROM eg_redoubts WHERE b = ? AND account = ?').get(b1, Bq.id) }, { sh: null, m: null }, 'a receipt from before: nothing');
  // an end's company
  const co1 = egCompanyTag([A.id, Bq.id, C.id]);
  assert.equal((await claim(A, { q: 'x', b: b1, h: 20, t: 2000, td: 1800, n: 3, why: 'home', co: co1 })).recorded, true);
  assert.deepEqual({ ...db.prepare('SELECT co_n, co_h FROM eg_runs WHERE b = ? AND account = ?').get(b1, A.id) }, { co_n: 3, co_h: co1[1] });
  // the same company, another breach, other members claiming: one row, its best
  const b2 = '1000000000000002';
  await claim(C, { q: 'x', b: b2, h: 25, t: 3000, td: 2500, n: 2, why: 'home', co: co1 });   // its entrants' count the company's
  // two companies sharing their claimers (A and D) - different entrants, different tags: two rows
  const b3 = '1000000000000003', b4 = '1000000000000004';
  const coX = egCompanyTag([A.id, D.id, 'acct-x0000']), coY = egCompanyTag([A.id, D.id, 'acct-y0000']);
  for (const who of [A, D]) await claim(who, { q: 'x', b: b3, h: 12, t: 800, td: 700, n: 3, why: 'home', co: coX });
  for (const who of [A, D]) await claim(who, { q: 'x', b: b4, h: 11, t: 800, td: 700, n: 3, why: 'home', co: coY });
  const board = (await S.call('/v1/eg/board', {}, A.secret)).body;
  const few = board.descent.few.rows.map((r) => [r.h, r.t, r.n, r.players.length]);
  assert.deepEqual(few, [[25, 2500, 3, 1], [12, 700, 3, 2], [11, 700, 3, 2]], 'one row for the company of three (its best breach), two for the two companies of A and D');
  // the pure law: an end from before the company (no tag) keyed by its claimers, as it was
  const rows = [{ b: 'p', account: 'u1', h: 5, secs: 10, n: 1, fl: 0, at: 1 }, { b: 'q', account: 'u1', h: 6, secs: 10, n: 1, fl: 0, at: 2 }];
  assert.equal(egDescentCompanies(rows).length, 1, 'the same claimer, no tag: one company');
  // THE SEAL: sealed runs stand at the sealed Redoubt's hall, their seconds the order
  const sealed = egDescentCompanies([{ b: 's1', account: 'u1', h: 100, secs: 9000, n: 1, fl: 0, at: 1, co_n: 1, co_h: 'a'.repeat(12) }, { b: 's2', account: 'u2', h: 100, secs: 8000, n: 1, fl: 0, at: 2, co_n: 1, co_h: 'b'.repeat(12) }]);
  assert.deepEqual(sealed.map((c) => c.players[0]), ['u2', 'u1'], 'the fewer seconds to the sealed Redoubt first');
  assert.match(rd('server-account/migrations/0124_elite_breach.sql'), /ALTER TABLE eg_runs ADD COLUMN co_n INTEGER NOT NULL DEFAULT 0;\nALTER TABLE eg_runs ADD COLUMN co_h TEXT;\nALTER TABLE eg_redoubts ADD COLUMN sh INTEGER;\nALTER TABLE eg_redoubts ADD COLUMN m TEXT;/);
});

test('EG-ZA THIS SCREEN\'S HALF (scenes/eliteGates/egClient.js, net/online.js): the stake an open takes is kept on the device; its open unanswered past EG_VOID_WAIT_MS, its void is asked of the hub - the room\'s `v` heard, claimed, the key restacked and the stake let go; a stake a call answers is never voided, one the room refuses to void let go; every receipt the service counted said to the hub (`claimed`); the hub\'s receipts heard by the presence link, `void` and `claimed` said to the hub alone (mutants: the stake never kept; the void never asked; asked before its wait; the call ignored; a refusal kept; a void receipt keeping the stake; `claimed` never said; the hub\'s receipt dropped by the link; `void` sent to a breach\'s room)', async () => {
  await withRelay(async ({ hub, mac, refuseIf, room, step, now }) => {
    const pending = [], said = [];
    const send = (w) => { pending.push(hub.raw(mac, JSON.stringify({ t: 'eg', ...w }))); return true; };
    const kinds = [];
    const hubLink = { get egOk() { return true; }, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); if (w) kinds.push(k); return w ? send(w) : false; } };
    let inflight = 0, keys = 1;
    const track = (fn) => async (...a) => { inflight++; try { return await fn(...a); } finally { inflight--; } };
    const claimed = [];
    const account = {
      me: () => 'acct-mac', guest: () => false,
      keys: track(async () => ({ ok: true, data: { keys } })),
      open: track(async (rq, rh) => { keys = 0; return { ok: true, data: { order: await mintEgOrder({ o: 'egopen', s: 'acct-mac', eb: B, ez: 'z'.repeat(20), ...(rh ? { rh: 1 } : {}) }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(now() / 1000) }), b: B, ez: 'z'.repeat(20), keys: 0, until: 0, rh: 0 } }; }),
      claim: track(async (r) => { const c = readEgReceipt(r); claimed.push(c); if (c.q === 'v') keys = 1; return { ok: true, data: { recorded: true, q: c.q, b: c.b, keys } }; }),
    };
    const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; })();
    const entity = { level: 20, health: 60, maxHealth: 100, items: [] };
    const client = createEgClient({ modes: () => ({ mode: 'exterior', egHallBreach: () => null }), online: () => ({ sendEg: () => false }), hub: () => hubLink, account, now, entity, player: { pos: [0, 0, 0] }, cam: { pos: [0, 0, 0] },
      say: (t) => said.push(t), site: () => ({}), wire: () => SITE, landAt: () => true, hurt: () => {}, store });
    let seen = 0;
    const settle = async () => {
      for (let q = 0, k = 0; k < 4000 && q < 3; k++) {
        await new Promise((r) => setImmediate(r));
        const busy = inflight > 0 || pending.length > 0;
        await Promise.all(pending.splice(0));
        for (; seen < mac.sent.length; seen++) { const m = mac.sent[seen]; if (m.t === 'eg') { const w = validEgOut(m); if (w) client.word(w, SOCIAL_ROOM); } }
        q = busy ? 0 : q + 1;
      }
    };
    const frame = async (ms) => { step(ms); client.frame(); await settle(); };
    // THE ROOM UNREACHABLE: the open's tries spent, the stake kept on the device
    refuseIf((id) => id === egRoomKey(B));
    assert.equal(client.useKey(), EG_TEXT.opening);
    await settle();
    const kept = () => JSON.parse(store.getItem(EG_STAKES_KEY) ?? '[]');
    assert.deepEqual(kept().map((s) => [s.b, typeof s.z]), [[B, 'string']], 'kept the moment it is staked');
    for (let k = 0; k < EG_OPEN_TRIES + 4; k++) await frame(EG_OPEN_RETRY_MS);   // its tries, and its giving up, and on
    assert.ok(!mac.sent.some((m) => m.t === 'eg' && m.k === 'rcpt'), 'nothing minted: the room never answered');
    assert.equal(kept().length, 1, 'still held');
    assert.ok(!kinds.includes('void'), 'no void before EG_VOID_WAIT_MS - the hub\'s own tries are its first');
    // the room back: past EG_VOID_WAIT_MS its void asked, the `v` heard and claimed, the key restacked, the stake let go
    refuseIf(() => false);
    await frame(EG_VOID_WAIT_MS);
    const v = claimed.find((c) => c.q === 'v');
    assert.deepEqual(v && [v.b, v.z], [B, 'z'.repeat(20)], 'the void claimed');
    assert.deepEqual(kept(), [], 'let go');
    assert.ok(said.includes(EG_VOID_TEXT), 'said');
    assert.equal(weirKeysHeld(entity.items), 1, 'the key restacked into the pack');
    assert.deepEqual(hub.store.get(egRcKey('acct-mac')).filter((x) => x.spent).map((x) => x.id), [egRcId(v)], 'the hub told it counted - its copy forgotten');
    assert.equal(room(B).store.has(EG_KEY), false, 'and no breach opened');
    // a stake the call answers is never voided; one the room refuses to void is let go
    store.setItem(EG_STAKES_KEY, JSON.stringify([{ b: B2, z: 'v1.x.y', at: Math.floor(now() / 1000) - 3600 }]));
    client.word({ k: 'call', b: B2, o: 'Mac', os: 'acct-mac', seed: 1, op: now(), rh: 0, co: [['acct-mac', 'Mac', 1]], site: SITE, ew: 0, wg: [], sg: '' }, SOCIAL_ROOM);
    assert.deepEqual(kept(), [], 'the room took it: its own receipts settle it');
    // a breach the room took and told its call - the call itself never reached this screen: its void refused, the stake let go
    const R3 = room(B3), tell = { b: B3, ez: 'w'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 0, rh: 0, seed: 9, op: now(), co: [['acct-mac', 'Mac', 1]], site: SITE, wg: [] };
    assert.equal((await (await R3.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify(tell) }))).json()).ok, true);
    assert.equal((await (await R3.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_CALLED}`, { method: 'POST', body: JSON.stringify({ ez: 'w'.repeat(20) }) }))).json()).ok, true);
    store.setItem(EG_STAKES_KEY, JSON.stringify([{ b: B3, z: await mintEgOrder({ o: 'egopen', s: 'acct-mac', eb: B3, ez: 'w'.repeat(20) }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(now() / 1000) - 3600 }), at: Math.floor(now() / 1000) - 3600 }]));
    await frame(EG_VOID_ASK_MS);
    assert.ok(mac.sent.some((m) => m.t === 'eg' && m.k === 'no' && m.m === 'the breach took the key'), 'its call is out: refused');
    assert.deepEqual(kept(), [], 'and let go');
    assert.ok(!said.some((t) => /took the key/i.test(t)), 'a background ask: nothing said');
  });
  // the presence link: the hub's receipt heard; `void` and `claimed` to the hub alone
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const heard = []; s.onEg = (w, r) => heard.push([w.k, r]);
  await quiet(() => s.join(SOCIAL_ROOM, null));
  const ws = sockets[0]; ws.open();
  await quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION }));
  ws.receive({ t: 'eg', k: 'rcpt', r: 'e1.e30.' });
  assert.deepEqual(heard, [['rcpt', SOCIAL_ROOM]], 'the hub\'s receipt heard');
  assert.equal(s.sendEg('void', { z: 'v1.abc.def' }), true);
  assert.equal(s.sendEg('claimed', { b: B, q: 'x', w: 0 }), true);
  assert.deepEqual(ws.sent.filter((x) => x.startsWith('{"t":"eg"')).map((x) => JSON.parse(x)), [{ t: 'eg', k: 'void', z: 'v1.abc.def' }, { t: 'eg', k: 'claimed', b: B, q: 'x', w: 0 }]);
  assert.equal(s.sendEg('hit', { i: 1, q: 1, d: 5, r: 1 }), false, 'a blow is the breach room\'s');
  // the wire: the two words, to the hub; their refusals
  assert.ok(EG_KINDS.includes('void') && EG_KINDS.includes('claimed'));
  assert.ok(EG_NO_WORDS.includes('the breach took the key') && EG_NO_WORDS.includes('the void is too old'));
  assert.deepEqual(validEgIn({ k: 'claimed', b: B, q: 'w', w: 3, x: 1 }), { k: 'claimed', b: B, q: 'w', w: 3 });
  assert.equal(validEgIn({ k: 'claimed', b: 'nope', q: 'w', w: 3 }), null);
  assert.equal(validEgIn({ k: 'claimed', b: B, q: 'k', w: 3 }), null);
  assert.equal(validEgIn({ k: 'void', z: 'not an order' }), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'eg', k: 'void', z: 'v1.abc.def' }), { hasHello: true }), { t: 'eg', k: 'void', z: 'v1.abc.def' });
  assert.equal(egDoneWith(null, 'a'.repeat(16), 'void', 'r', 100).until, 100 + EG_VOID_MAX_S);
});
