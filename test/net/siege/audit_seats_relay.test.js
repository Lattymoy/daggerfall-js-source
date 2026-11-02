// AUDIT-SEATS (2026-10-01, Mac: "We need to do a comprehensive audit on everything and finish the not done"): THE SEATS
// ARC'S RELAY, AUDITED - every finding reproduced here before its fix and pinned after it, over the real Room on its fake
// sockets (test/fakeRoom.mjs), the real referee (net/siege/siegeRef.js), the real receipts (net/siege/siegeReceipt.js) and, for the
// late pass, the real account Worker (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 6.1-6.8, 7.3, 7.6, 9.2, 16;
// `06-Systems/Online-Arc.md` PVP-REF, SEAT2a, CROWN1.
//
//   R1  a climb is a step, and a point has a height        R6  a fighter back past the window collects its receipt
//   R2  the step's allowance is carried, never re-earned   R7  the Watch ticks in the pose's own cell alone
//   R3  a stranger never shuts a battle's door             R8  a weapon is held in a hand
//   R4  a refused step spends the pose gate                R9  once a battle stands, the sides are kept whole
//   R5  the Royal Tourney's bound is who is in the room    R10 the ladder's tie is the service's champion rule
//   T1  `th`: the Throne reached, on every receipt         T2  a spectator is no body
//   T3  a disconnected fighter's place: kept five minutes, then a substitute's; back at camp with the next wave
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ref from '../../../src/net/siege/siegeRef.js';
import {
  siegeRoomKey, royalRoomKey, SIEGE_UNITS_PER_M, SIEGE_LENGTH_MS, SIEGE_FIGHTERS_MAX, SIEGE_SPEED,
  refereeStep, battleStep, newBattle, fieldOf, siegeHeld, royalAsk, royalAccept, royalEnd, royalLadder,
} from '../../../src/net/siege/siegeRef.js';
import { mintSiegeOrder, verifyOrder, _b64url } from '../../../src/net/identityToken.js';
import { mintSiegeReceipt, mintRoyalReceipt, readSiegeReceipt, verifySiegeReceipt, siegeReceiptValid, royalReceiptValid, SIEGE_RECEIPT_TTL_S } from '../../../src/net/siege/siegeReceipt.js';
import { royalStandings, SIEGE_SIDE_MAX, seatWeekOf, seatWeekStartMs } from '../../../src/net/townSeatLaw.js';
import { EQUIP_SLOTS } from '../../../src/characters/paperdoll/paperdoll.js';
import { cellRoomOfWire, PIXEL_UNITS, WORLD_CELL, POSE_HZ_MAX, HELLO_HZ_MAX, CLOSE_REPLACED } from '../../../src/net/wire.js';
import { fakeRoom } from '../../fakeRoom.mjs';
import { standService, T0 } from '../../accountDb.mjs';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const SK = 3021, SW = 20;
const KEY = siegeRoomKey(SK, SW);
const SB = 1_800_000_000;   // the battle's start, epoch seconds
const T = SB * 1000;
/** A pose `x`, `z` and `y` metres out (+y is up - player/motor.js's gravity takes pos[1] down). */
const at = (x, z = 0, y = 0) => ({ x: x * M, y: y * M, z: z * M, yaw: 0, pitch: 0 });
/** The field in metres: Gate, Market, Temple, the Throne, the attackers' camp, the defenders'. */
const SF = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const SF_CROWN = [...SF.slice(0, 3), [0, -30 * M], ...SF.slice(3)];
/** A Daedric Dai-Katana in the right hand. */
const HAND = { templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 };
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [HAND] };
const pad = (i) => String(i).padStart(4, '0');
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));
const refused = (ws, m) => { assert.deepEqual(ws.sent.at(-1), { t: 'error', m }); assert.ok(ws.closed, m); };
const welcomed = (ws) => ws.sent.some((m) => m.t === 'welcome') && !ws.closed;
const metres = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) / M;
const signing = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') };
};

/**
 * A battle room on the fake object, the clock the test's: `enter(id, side)` a hello by the service's pass (a siege's at a
 * palace by default, `o` laid over the pass), `dev(id)` a developer's hello with no pass (PVP-REF's ground), `until(ms)`
 * every alarm due fired, the clock walking with them.
 */
async function withRoom(key, fn, { start = T - 5 * 60_000 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(key, { now: () => clock });
  const { kp: relayKp, pkcs8 } = await signing();
  r.env.GATE_SIGNING_KEY = pkcs8;
  const royal = key.startsWith('royal:');
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd, o = {}) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: royal ? 'crown' : 'palace', sn: royal ? 'royal' : 'siege', sb: SB, se: royal ? SB + 7 * 86400 : SB + 7200, sf: royal ? [[100 * M, 50 * M]] : SF, ...o }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  /** A hello by pass `clock` + `gap` ms on (0: in this very instant); `lv` another Renown for a token of its own (the
   *  harness's signer walks one identity's issued-at back, inside a token's 300 s - a hello far later wants another). */
  const enter = async (id, sd, o = {}, { pose = at(0), gap = 100, look = LOOK, lv = 10 } = {}) => { clock += gap; const ws = r.connect(); await r.hello(ws, id, pose, { lv, look, sp: await pass(id, sd, o) }); return ws; };
  const dev = async (id, { pose = at(0), gap = 100, look = LOOK } = {}) => { clock += gap; const ws = r.connect(); await r.hello(ws, id, pose, { glyphs: ['dev'], lv: 10, look }); return ws; };
  const until = async (ms) => {
    let fires = 0;
    while (r.alarm.at != null && r.alarm.at <= ms) {
      if (++fires > 20_000) throw new Error('the alarm re-arms itself for ever');
      clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire();
    }
    clock = Math.max(clock, ms);
  };
  try { await fn({ r, say, pass, enter, dev, until, relayKp, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** Fighters (`moves`, `[ws, pose]`) walked to their points at the referee's ceiling: 18 m strides a second apart. */
async function walk({ r, until, now }, moves) {
  for (;;) {
    let more = false;
    for (const [ws, to] of moves) {
      const p = r.room._siege.fighters[ws.att.sub].pose;
      const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz) / M;
      if (d < 1e-6) continue;
      const k = Math.min(1, 18 / d);
      await r.pose(ws, { ...to, x: p.x + dx * k, z: p.z + dz * k });
      if (k < 1) more = true;
    }
    if (!more) return;
    await until(now() + 1000);
  }
}
/** A battlefield fighter for the law alone: `side` at `x`, `z` and `y` metres. */
const stander = (side, x, z, y = 0, o = {}) => ({ side, pose: { x: x * M, y: y * M, z: z * M }, down: false, here: true, ...o });
const beat = (b, fs, from, to) => { for (let t = from; t <= to; t += 1000) battleStep(b, fs, t); };
/** The socket of peer `id` in the room. */
const inRoom0 = (r, id) => r.sockets.find((ws) => ws.att.id === id);

// ─── R1 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R1 THE RISE IS JUDGED, AND A POINT HAS A HEIGHT: a climb is a step (its run and its rise together, a fall still gravity\'s) - 2,000 m up in 50 ms is pulled back; a fighter more than 8 m off the field\'s ground (the middle height of the sided fighters standing in the room) stands at no point - a floater over a banner neither raises it nor contests it for ever (mutants: the rise; the fall; the height\'s bound; the ground\'s middle; who sets the ground)', async () => {
  // the law: the climb judged with the run, the fall free
  assert.equal(refereeStep(at(0), at(0, 0, 30), 100), false, 'thirty metres up in a tenth of a second');
  assert.equal(refereeStep(at(0), at(1, 0, -30), 100), true, 'thirty down: a fall is gravity\'s');
  assert.equal(refereeStep(at(0), at(0, 0, 9), 500), true, 'a climb inside the ceiling');
  assert.equal(refereeStep(at(0), at(0, 0, 9.6), 500), false, 'and past it');
  assert.equal(refereeStep(at(0), at(6, 0, 8), 500), false, 'the run and the climb together: 10 m in half a second, past 9.5');
  // the room: a fighter rising 2,000 m in 50 ms
  await withRoom(KEY, async ({ r, enter, say, until, now }) => {
    const a = await enter('atk-0001', 'attack');
    await say(a, { k: 'in' });
    const f = r.room._siege.fighters[a.att.sub];
    const camp = { ...f.pose };
    await until(now() + 1000);
    await r.pose(a, { ...camp, y: camp.y + 2000 * M });
    assert.deepEqual(sieges(a, 'back').at(-1).p, camp, 'pulled back to its last good pose');
    assert.equal(f.pose.y, camp.y, 'and never kept');
    await until(now() + 1000);
    await r.pose(a, { ...camp, y: camp.y + 10 * M });
    assert.equal(f.pose.y, camp.y + 10 * M, 'ten metres up in a second: kept');
  });
  // the field's ground: the middle height of the standing, sided fighters here
  const g = ref.siegeGround;
  assert.equal(typeof g, 'function', 'siegeGround');
  assert.equal(g([stander('attack', 0, 0, 3), stander('defend', 0, 0, 1), stander('defend', 0, 0, 100)]), 3 * M, 'the middle of three');
  assert.equal(g([stander('attack', 0, 0, 2), stander('defend', 0, 0, 4)]), 3 * M, 'the mean of two middles');
  assert.equal(g([stander('attack', 0, 0, 2), stander('defend', 0, 0, 900, { down: true }), stander('defend', 0, 0, 900, { here: false }), stander(null, 0, 0, 900), stander('defend', 0, 0, 4)]), 3 * M, 'the fallen, the gone and the unsided set no ground');
  assert.equal(g([]), null);
  assert.equal(ref.SIEGE_HEIGHT_M, 8, 'a point is a banner\'s 8 m about its ground');
  // a floater 100 m over the Market, two defenders standing on the ground at their camp: nothing raised
  const field = fieldOf(SF, 'palace');
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  beat(b, [stander('attack', 40, 0, 100), stander('defend', 0, -60), stander('defend', 0, -60)], T, T + 25_000);
  assert.deepEqual([b.banners[1].side, b.banners[1].raise], ['defend', 0], 'a floater stands at no point');
  // seven metres up is still on the field
  const b2 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  beat(b2, [stander('attack', 40, 0, 7), stander('defend', 0, -60), stander('defend', 0, -60)], T, T + 25_000);
  assert.equal(b2.banners[1].side, 'attack', 'seven metres up: at the Market');
  const b3 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  beat(b3, [stander('attack', 40, 0, -9), stander('defend', 0, -60), stander('defend', 0, -60)], T, T + 25_000);
  assert.equal(b3.banners[1].side, 'defend', 'nine metres under it: not');
  // the Throne, open on two banners: a floater over it holds nothing, and never reaches it
  const bt = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  bt.banners[0].side = 'attack'; bt.banners[1].side = 'attack';
  beat(bt, [stander('attack', 0, -40, 50), stander('defend', 0, -60), stander('defend', 0, -60)], T, T + 10_000);
  assert.deepEqual([bt.throne, bt.reached], [0, false], 'fifty metres over the Throne');
  // CONTESTED FOR EVER, no more: a half-raise frozen by a floater no blow reaches - a defender alone on the ground now
  // takes it back
  const b4 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  const raiser = stander('attack', 40, 0);
  beat(b4, [raiser, stander('defend', 0, -60), stander('defend', 0, -60)], T, T + 10_000);
  assert.equal(b4.banners[1].raise, 10);
  raiser.pose = at(40, 0, 300);
  const fs4 = [raiser, stander('defend', 40, 0), stander('defend', 0, -60)];
  beat(b4, fs4, T + 11_000, T + 25_000);
  assert.deepEqual([b4.banners[1].side, b4.banners[1].raise], ['defend', 0], 'the half-raise falls back under the defender standing there');
});

// ─── R2 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R2 THE STEP\'S ALLOWANCE IS CARRIED: a second\'s run and the slack once, refilled at 18 m/s and spent by each kept step - a burst of poses shares it, a silence earns a second\'s run at most, and a pose the gate drops moves nobody (mutants: the carry; the window; the slack once; the refused step spending; the gate first)', async () => {
  // the law, carried on the fighter
  const f = {};
  assert.equal(refereeStep(null, at(0), 0, f), true, 'a first pose');
  assert.equal(f.stepM, SIEGE_SPEED.mps + SIEGE_SPEED.slackM, 'begins with a second\'s run and the slack');
  let p = at(0), moved = 0;
  for (let i = 1; i <= 60; i++) { const q = at(i * 0.5); if (refereeStep(p, q, 0, f)) { p = q; moved += 0.5; } }
  assert.equal(moved, 18.5, 'sixty half-metre poses in one instant: 18.5 m, never 30');
  assert.equal(refereeStep(p, at(p.x / M + 9), 500, f), true, 'half a second later, half a second\'s run');
  assert.equal(refereeStep(at(0), at(0.2), 0, { stepM: 0.1 }), false, 'an allowance spent is spent');
  assert.equal(refereeStep(at(0), at(1.8), 100, { stepM: 0 }), true, 'a tenth of a second earns 1.8 m');
  assert.equal(refereeStep(at(0), at(1.9), 100, { stepM: 0 }), false, 'and no slack on top');
  const g = { stepM: 2 };
  assert.equal(refereeStep(at(0), at(5), 100, g), false);
  assert.equal(g.stepM, 2, 'a refused step spends nothing (the relay keeps its last pose and time)');
  assert.equal(refereeStep(at(0), at(100), 10_000), false, 'a hundred metres after ten silent seconds');
  assert.equal(refereeStep(at(0), at(18.5), 10_000), true, 'a second\'s run and the slack');
  assert.equal(refereeStep(at(0), at(18.6), 10_000), false);
  assert.equal(refereeStep(at(0), at(100), 10_000, { stepM: 3 }), false, 'carried, the same');
  assert.equal(refereeStep(at(0), at(20), 1000, { stepM: 18 }), false, 'an allowance never grows past a second\'s run and the slack');
  assert.equal(refereeStep({ x: 0, z: 0 }, { x: 100 * M, z: 0 }, 100), false, 'a pose with no height climbs nothing, and still runs');
  assert.equal(ref.SIEGE_STEP_WINDOW_MS, 1000);
  await withRoom(KEY, async ({ r, dev, say, step }) => {
    // a burst: a pose every 10 ms, each 0.68 m on (the old per-pose earning: 18 m/s x 10 ms and the half metre)
    const a = await dev('dev-0001');
    await say(a, { k: 'in' });
    const f0 = r.room._siege.fighters[a.att.sub];
    const from = { ...f0.pose };
    step(1000);
    let q = { ...from };
    for (let i = 0; i < 300; i++) { step(10); q = { ...q, x: q.x + 0.68 * M }; await r.pose(a, q); }
    assert.ok(!a.closed, 'an honest gap between drops is no strike-out');
    assert.ok(metres(from, f0.pose) <= SIEGE_SPEED.mps * 3 + SIEGE_SPEED.slackM + 1e-9, `three seconds: ${metres(from, f0.pose).toFixed(1)} m (the old law let it run 204)`);
    // a silence earns a second's run at most
    step(10_000);
    const was = { ...f0.pose };
    await r.pose(a, { ...was, x: was.x + 100 * M });
    assert.deepEqual(f0.pose, was, 'a hundred metres after ten silent seconds: pulled back');
    await r.pose(a, { ...was, x: was.x + 18 * M });
    assert.equal(f0.pose.x, was.x + 18 * M, 'eighteen: kept');
    // a pose the gate drops moves nobody: a hundred in one instant, each half a metre on, after the gate's bucket is spent
    const b = await dev('dev-0002');
    await say(b, { k: 'in' });
    const f1 = r.room._siege.fighters[b.att.sub];
    step(2000);
    const start = { ...f1.pose };
    let s = { ...start };
    for (let i = 0; i < 100; i++) { s = { ...s, x: s.x + 0.5 * M }; await r.pose(b, s); }
    assert.equal(metres(start, f1.pose), POSE_HZ_MAX * 0.5, 'the gate\'s twenty judged and kept; the rest dropped whole (the old order moved the fighter 50 m)');
  });
});

// ─── R3 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R3 A STRANGER NEVER SHUTS A BATTLE\'S DOOR: a battle room spends its hello gate only once the token and the pass are verified - tokenless hellos, and a token with no pass, touch no bucket; the gate is the account\'s own (its reconnect loop waits on itself), and the stands\' besides (a fighter never waits on them) (mutants: the gate before the token; the account\'s bucket; the stands\')', async () => {
  await withRoom(KEY, async ({ r, enter, pass }) => {
    const first = await enter('atk-0000', 'attack');   // the first pass names the battle
    assert.ok(welcomed(first));
    // a flood in one instant: twelve with no token, twelve with a token and no pass
    for (let i = 0; i < 12; i++) { const ws = r.connect(); await r.hello(ws, `peer-${pad(i)}`, at(0), { tok: null, look: LOOK }); refused(ws, 'sign in to play online'); }
    for (let i = 0; i < 12; i++) { const ws = r.connect(); await r.hello(ws, `none-${pad(i)}`, at(0), { look: LOOK }); refused(ws, 'the siege is not open'); }
    const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    for (let i = 0; i < 12; i++) {
      const sp = await mintSiegeOrder({ s: `acct-fake-${pad(i)}`, sk: SK, sw: SW, sd: 'attack', st: 'palace', sn: 'siege', sb: SB, se: SB + 7200, sf: SF }, stranger.privateKey, { subtle, nowS: SB - 300 });
      const ws = r.connect(); await r.hello(ws, `fake-${pad(i)}`, at(0), { look: LOOK, sp }); refused(ws, 'that pass will not do');
    }
    assert.equal(r.store.get('hellos'), undefined, 'none of it touched the room\'s bucket');
    // the real attacker, in the same instant
    const a = r.connect(); await r.hello(a, 'atk-0001', at(0), { lv: 10, look: LOOK, sp: await pass('atk-0001', 'attack') });
    assert.ok(welcomed(a), 'admitted');
    // one account's own loop: HELLO_HZ_MAX in an instant, then busy - and another account in the same instant is not
    let last = null;
    for (let i = 0; i < HELLO_HZ_MAX; i++) { last = r.connect(); await r.hello(last, 'atk-0002', at(0), { lv: 10, look: LOOK, sp: await pass('atk-0002', 'attack') }); assert.ok(welcomed(last), `the account's hello ${i + 1}`); }
    const over = r.connect(); await r.hello(over, 'atk-0002', at(0), { lv: 10, look: LOOK, sp: await pass('atk-0002', 'attack') });
    assert.equal(over.closed?.code, 1013, 'the account\'s eleventh in the instant: busy');
    const other = r.connect(); await r.hello(other, 'def-0001', at(0), { lv: 10, look: LOOK, sp: await pass('def-0001', 'defend') });
    assert.ok(welcomed(other), 'another account waits on nobody\'s loop');
    // the stands: HELLO_HZ_MAX spectators in the instant, the next busy - a fighter in the same instant admitted
    for (let i = 0; i < HELLO_HZ_MAX; i++) { const ws = r.connect(); await r.hello(ws, `eye-${pad(i)}`, at(0), { lv: 10, look: LOOK, sp: await pass(`eye-${pad(i)}`, 'watch') }); assert.ok(welcomed(ws), `spectator ${i + 1}`); }
    const eye = r.connect(); await r.hello(eye, 'eye-0099', at(0), { lv: 10, look: LOOK, sp: await pass('eye-0099', 'watch') });
    assert.equal(eye.closed?.code, 1013, 'the stands share a bucket');
    const late = r.connect(); await r.hello(late, 'def-0002', at(0), { lv: 10, look: LOOK, sp: await pass('def-0002', 'defend') });
    assert.ok(welcomed(late), 'a fighter never waits on the stands');
    // nor its change of gear: a `look` frame's fan spends the account's own gate in a battle room, never the stands'
    await r.raw(late, JSON.stringify({ t: 'look', look: { ...LOOK, items: [{ ...HAND, material: 8 }] } }));
    assert.equal(late.closed, null, 'a fighter\'s look in the same instant: never refused busy');
    assert.equal(first.sent.filter((m) => m.t === 'join' && m.id === 'def-0002').at(-1).look.items[0].material, 8, 'and said to the room');
  });
});

// ─── R4 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R4 A REFUSED STEP SPENDS THE POSE GATE: five thousand refused poses in a millisecond are the gate\'s to drop and strike - the socket closed, never five thousand pull-backs (mutants: the gate first)', async () => {
  await withRoom(KEY, async ({ r, dev, say, step }) => {
    const a = await dev('dev-0001');
    await say(a, { k: 'in' });
    step(1000);
    const far = at(500);
    for (let i = 0; i < 5000 && !a.closed; i++) await r.pose(a, far);
    assert.equal(a.closed?.code, 1008, 'struck out');
    assert.deepEqual(a.sent.at(-1), { t: 'error', m: 'too many poses' });
    assert.ok(sieges(a, 'back').length <= POSE_HZ_MAX, `the gate's own pull-backs, no more (${sieges(a, 'back').length})`);
  });
});

// ─── R5 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R5 THE ROYAL TOURNEY\'S BOUND IS WHO IS IN THE ROOM: forty-eight contenders entering and leaving shut nobody out - the gone who hold nothing are forgotten (never a ladder row, the bout\'s two or a standing challenge); forty-eight IN the room, the next is told the field is full (mutants: the count by socket; the prune; what the prune keeps)', async () => {
  await withRoom(royalRoomKey(SK, SW), async ({ r, enter, say, until, now }) => {
    const ring = at(100, 50);
    // two contenders fight a counted bout and stay on the ladder; a third leaves a challenge standing
    const wa = await enter('duel-0001', 'duel', {}, { pose: ring }), wb = await enter('duel-0002', 'duel', {}, { pose: ring }), wc = await enter('duel-0003', 'duel', {}, { pose: ring });
    for (const ws of [wa, wb, wc]) await say(ws, { k: 'in' });
    await say(wa, { k: 'ask', to: wb.att.id }); await say(wb, { k: 'yes', to: wa.att.id });
    await until(now() + 4000);
    const p = r.room._siege.fighters[wb.att.sub].pose;
    await r.pose(wa, { ...p, x: p.x - 1.5 * M });
    for (let i = 0; i < 12 && r.room._siege.battle.bout; i++) { await until(now() + 1000); await say(wa, { k: 'blow', to: wb.att.id, w: 123, m: 9, d: 500, r: 0 }); }
    assert.equal(r.room._siege.battle.bout, null, 'the bout fought');
    // a standing challenge holds both its ends: wc's to wg (who holds nothing else)
    const wg = await enter('duel-0007', 'duel', {}, { pose: ring });
    await say(wg, { k: 'in' });
    await say(wc, { k: 'ask', to: wg.att.id });
    // a bout on, one of its two gone: kept while the ring waits on it
    const wd = await enter('duel-0004', 'duel', {}, { pose: ring }), we = await enter('duel-0005', 'duel', {}, { pose: ring });
    for (const ws of [wd, we]) await say(ws, { k: 'in' });
    await say(wd, { k: 'ask', to: we.att.id }); await say(we, { k: 'yes', to: wd.att.id });
    await r.drop(we);
    const wf = await enter('duel-0006', 'duel', {}, { pose: ring });
    await say(wf, { k: 'in' });
    assert.ok(r.room._siege.fighters[we.att.sub], 'the bout\'s fighter gone a moment is kept');
    await until(now() + 11_000);   // its walkover
    assert.equal(r.room._siege.battle.bout, null);
    for (const ws of [wa, wb, wc, wd, wf, wg]) await r.drop(ws);
    // forty-eight more come and go
    for (let i = 0; i < SIEGE_FIGHTERS_MAX; i++) { const ws = await enter(`duel-${pad(100 + i)}`, 'duel', {}, { pose: ring }); await say(ws, { k: 'in' }); await r.drop(ws); }
    const next = await enter('duel-0999', 'duel', {}, { pose: ring });
    assert.ok(welcomed(next), 'the forty-ninth comes in: the bound is who is in the room, never who ever was');
    await say(next, { k: 'in' });
    assert.ok(r.room._siege.fighters[next.att.sub], 'and fights');
    assert.deepEqual(Object.keys(r.room._siege.fighters).sort(), ['acct-duel-0001', 'acct-duel-0002', 'acct-duel-0003', 'acct-duel-0004', 'acct-duel-0005', 'acct-duel-0007', 'acct-duel-0999'],
      'the gone who hold nothing forgotten (duel-0006); the ladder\'s rows (the two bouts\' four) and both ends of a standing challenge kept');
    // the bound itself - a spectator in the stands besides, who is no contender
    const eye = await enter('eye-0001', 'watch', {}, { pose: ring });
    assert.ok(welcomed(eye));
    for (let i = 1; i < SIEGE_FIGHTERS_MAX; i++) { const ws = await enter(`duel-${pad(200 + i)}`, 'duel', {}, { pose: ring }); assert.ok(welcomed(ws), `contender ${i + 1}`); }
    refused(await enter('duel-0300', 'duel', {}, { pose: ring }), 'the field is full');
    assert.ok(r.room._siege.fighters[next.att.sub], 'a contender in the room is never pruned');
    // a contender back from a drop: its record as it was, the ladder said
    // PIN MOVED (AUDIT SEATS-3): a place made for it first - a contender back is counted as a new one is (B3: the
    // forty-ninth row was the roll call no client reads)
    await r.drop(inRoom0(r, 'duel-0201'));
    const back = await enter('duel-0001', 'duel', {}, { pose: ring, lv: 11 });
    assert.equal(back.closed, null);
    await say(back, { k: 'in' });
    assert.ok(sieges(back, 'lad').length, 'its `in` answered with the ladder');
  }, { start: T + 3600_000 });
});

// ─── R6 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R6 A FIGHTER BACK PAST THE WINDOW COLLECTS ITS RECEIPT: a crown fighter who dropped at minute 40 and came back at minute 70 (the window shut at 60) is admitted - the battle over, its receipt held - and handed it; nothing lands; a spectator, a fighter with no receipt, a fighter on another side are refused as before (mutants: the late door; its conditions)', async () => {
  await withRoom(KEY, async ({ r, enter, say, until }) => {
    const o = { st: 'crown', sf: SF_CROWN, se: SB + 3600 };
    const a = await enter('atk-0001', 'attack', o), d = await enter('def-0001', 'defend', o);
    for (const ws of [a, d]) await say(ws, { k: 'in' });
    await until(T + 40 * 60_000);
    await r.drop(a);
    await until(T + SIEGE_LENGTH_MS.crown);
    assert.equal(r.room._siege.battle.result, 'defend');
    const kept = r.room._siege.receipts['acct-atk-0001'];
    assert.equal(readSiegeReceipt(kept).s, 'acct-atk-0001');
    await until(T + 60 * 60_000);
    refused(await enter('atk-0003', 'attack', o, { gap: 0 }), 'the siege is not open');   // at the window's close itself: shut to all but a receipt's holder
    await until(T + 70 * 60_000);
    refused(await enter('atk-0001', 'defend', o, { lv: 11 }), 'the siege is not open');   // on another side than it fought
    const back = await enter('atk-0001', 'attack', o, { lv: 12 });
    assert.ok(welcomed(back), 'past the window, a fighter of the ended battle');
    const f = r.room._siege.fighters['acct-atk-0001'];
    const where = { ...f.pose };
    await say(back, { k: 'in' });
    assert.equal(sieges(back, 'end').at(-1).rc, kept, 'its own receipt handed over');
    assert.equal(sieges(back, 'st').at(-1).f.find((x) => x[0] === 'atk-0001')[3], 0, 'no wave to wait on after the end');
    assert.deepEqual([f.pose, f.down, sieges(back, 'back').length], [where, false, 0], 'and no camp');
    const hits = sieges(d, 'hp').length;
    await say(back, { k: 'blow', to: d.att.id, w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(d, 'hp').length, hits, 'and nothing lands');
    refused(await enter('eye-0001', 'watch', o), 'the siege is not open');
    refused(await enter('atk-0002', 'attack', o), 'the siege is not open');
  });
  await withRoom(KEY, async ({ r, enter, say, until }) => {
    // a battle not over has no receipt to hand: past its pass's window (one that shuts before its end) the door is shut
    const o = { se: SB + 600 };
    const a = await enter('atk-0001', 'attack', o), d = await enter('def-0001', 'defend', o);
    for (const ws of [a, d]) await say(ws, { k: 'in' });
    await until(T + 10 * 60_000 + 1000);
    await r.drop(a);
    assert.equal(r.room._siege.battle.result, null, 'not over');
    refused(await enter('atk-0001', 'attack', o, { lv: 11 }), 'the siege is not open');
  });
});

test('AUDIT-SEATS R6 THE LATE PASS (server-account/src/seatSiege.js siegePass): past the window\'s close a rostered fighter of a fought battle is signed its battle\'s own pass, `late: true`, until the receipt\'s week is out - last week\'s asked by name after the Turning; a spectator, a battle nobody fought, a week past the receipts\' are refused (mutants: the late window; its end; who; the field; the week)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const W = seatWeekOf(T0 * 1000);
  const S = Math.floor(seatWeekStartMs(W) / 1000) + 3 * 86400;   // Wednesday 18:00 of the week
  const KEY2 = 4040;
  const field = JSON.stringify(SF);
  raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at, field) VALUES (?, ?, 'siege', 'palace', 'ga', 'gd', ?, ?, ?, ?)").run(W, SK, S, S + 1800, T0, field);
  raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at) VALUES (?, ?, 'siege', 'palace', 'ga', 'gd', ?, ?, ?)").run(W, KEY2, S, S + 1800, T0);
  raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at, field) VALUES (?, ?, 'siege', 'palace', 'ga', 'gd', ?, ?, ?, ?)").run(W - 1, SK, S - 7 * 86400, S - 7 * 86400 + 1800, T0, field);
  const fighter = await svc.registered('Arden'), eye = await svc.registered('Eyvind');
  raw.prepare("INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, at) VALUES (?, ?, ?, ?, 'ga', 'attack', ?)").run(W - 1, SK, fighter.id, fighter.character, T0);
  for (const k of [SK, KEY2]) raw.prepare("INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, at) VALUES (?, ?, ?, ?, 'ga', 'attack', ?)").run(W, k, fighter.id, fighter.character, T0);
  const ask = (who, body) => svc.call('/v1/seats/siege/pass', body, who.secret);
  now = S + 7200;   // the window's close
  const late = await ask(fighter, { key: SK });
  assert.equal(late.status, 200, JSON.stringify(late.body));
  assert.deepEqual({ ...late.body, pass: !!late.body.pass }, { side: 'attack', week: W, key: SK, startsAt: S, endsAt: S + 1800, window: S + 7200, late: true, pass: true });
  const v = await verifyOrder(late.body.pass, svc.identityPublic, { subtle, nowS: now, kind: 'siege' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.sd, v.claims.sb, v.claims.se, v.claims.sf], ['attack', S, S + 7200, SF], 'the battle\'s own pass - the room knows it for its battle');
  assert.equal((await ask(eye, { key: SK })).body.error, 'pass-late', 'a spectator: the window is shut');
  assert.equal((await ask(fighter, { key: KEY2 })).body.error, 'pass-late', 'a battle whose field never settled: nobody fought it');
  now = S + 7200 - 1;
  assert.equal((await ask(fighter, { key: SK })).body.late, undefined, 'inside the window: an ordinary pass');
  assert.equal((await ask(fighter, { key: SK, week: W + 1 })).body.week, W, 'a week named that is not last week\'s is this week\'s');
  // after the Turning: last week's battle, asked by name - PIN MOVED (AUDIT-SEATS S3): fought, its result written before
  // its Turning (a battle no receipt ever reached is voided there, and its late receipt refused - seatTurning.js)
  raw.prepare("INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at) VALUES (?, ?, 'attack', 1, 'attack', 'r6-result', ?)").run(W, SK, S + 1800);
  raw.prepare("UPDATE town_seat_battles SET state = 'fought' WHERE week = ? AND key = ?").run(W, SK);
  now = Math.floor(seatWeekStartMs(W + 1) / 1000) + 3600;
  assert.equal((await ask(fighter, { key: SK })).body.error, 'battle-none', 'this week has none');
  const after = await ask(fighter, { key: SK, week: W });
  assert.deepEqual([after.status, after.body.week, after.body.late], [200, W, true], 'last week\'s, by name');
  assert.equal((await ask(fighter, { key: SK, week: W - 1 })).body.error, 'battle-none', 'never older than last week (that battle\'s receipts are out)');
  now = S + 7200 + SIEGE_RECEIPT_TTL_S - 1;
  assert.equal((await ask(fighter, { key: SK, week: W })).body.late, true, 'the receipt\'s last second');
  now = S + 7200 + SIEGE_RECEIPT_TTL_S;
  assert.equal((await ask(fighter, { key: SK, week: W })).body.error, 'pass-late', 'its week out');
});

// ─── R7 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R7 THE WATCH TICKS IN THE POSE\'S OWN CELL ALONE: a player a cell room holds for the seam (a halo - its pose in the next cell) mints no `k1` there; the one standing in it does (mutants: the cell\'s check)', async (t) => {
  let now = T;
  t.mock.method(Date, 'now', () => now);
  const px = (x, y, d = 100) => ({ x: x * PIXEL_UNITS + d, y: 0, z: (499 - y) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
  const home = px(402, 151);
  const key = cellRoomOfWire(home.x, home.z);
  const r = fakeRoom(key, { now: () => now });
  const here = r.connect(); await r.hello(here, 'peer-0001', home);
  await r.pose(here, px(402, 151, 300));
  assert.equal(here.sent.filter((m) => m.t === 'watch').length, 1, 'standing in the cell: ticked');
  const next = (Math.floor(402 / WORLD_CELL) + 1) * WORLD_CELL;
  const seam = px(next, 151);
  assert.notEqual(cellRoomOfWire(seam.x, seam.z), key, 'the next cell');
  const halo = r.connect(); await r.hello(halo, 'peer-0002', seam);
  await r.pose(halo, px(next, 151, 300));
  assert.equal(halo.sent.filter((m) => m.t === 'watch').length, 0, 'a halo\'s pose: never');
});

// ─── R8 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R8 A WEAPON IS HELD IN A HAND: the look\'s right hand (19) or left (21), DFU\'s EquipSlots - a Dai-Katana in an amulet\'s slot strikes as nothing (mutants: the hands; the slot\'s check)', async () => {
  const inSlot = (equipSlot) => ({ items: [{ ...HAND, equipSlot }] });
  for (const slot of [EQUIP_SLOTS.Amulet0, EQUIP_SLOTS.ChestArmor, EQUIP_SLOTS.Gloves, EQUIP_SLOTS.Feet]) assert.equal(siegeHeld(inSlot(slot), 123, 9), null, `slot ${slot}`);
  assert.deepEqual(siegeHeld(inSlot(EQUIP_SLOTS.RightHand), 123, 9), { w: 123, m: 9 });
  assert.deepEqual(siegeHeld(inSlot(EQUIP_SLOTS.LeftHand), 123, 9), { w: 123, m: 9 });
  assert.deepEqual([...ref.SIEGE_HAND_SLOTS], [EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand], 'pinned equal to characters/paperdoll/paperdoll.js');
  assert.equal(siegeHeld({ items: [{ templateIndex: 123, group: 'Weapons', material: 9 }] }, 123, 9), null, 'an item with no slot is in no hand');
  await withRoom(KEY, async ({ r, dev, say, step }) => {
    const a = await dev('dev-0001', { look: { ...LOOK, items: [{ ...HAND, equipSlot: EQUIP_SLOTS.Amulet0 }] } });
    const b = await dev('dev-0002', { pose: at(1) });
    for (const ws of [a, b]) await say(ws, { k: 'in' });
    step(1000);
    await say(a, { k: 'blow', to: b.att.id, w: 123, m: 9, d: 100, r: 0 });
    assert.equal(sieges(b, 'hp').length, 0, 'a blade at the throat is no blade in the hand');
    step(1000);
    await say(a, { k: 'blow', to: b.att.id, w: -1, m: 0, d: 5, r: 0 });
    assert.equal(sieges(b, 'hp').at(-1).h, 315, 'a fist is always held');
  });
});

// ─── R9 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS R9 ONCE A BATTLE STANDS, THE SIDES ARE KEPT WHOLE: a developer who entered PVP-REF\'s ground unsided before the first pass strikes nothing and is struck by nothing (no Honours bought off it), casts and heals nothing; in a Royal Tourney it challenges no one (mutants: the unsided striker; the unsided target; the contender\'s ask)', async () => {
  await withRoom(KEY, async ({ r, enter, dev, say, until, now }) => {
    const camp = at(0, 80);   // the attackers' camp, where the attacker enters
    const g = await dev('dev-0001', { pose: camp });
    await say(g, { k: 'in' });
    assert.equal(r.room._siege.fighters[g.att.sub].side, null, 'unsided');
    const a = await enter('atk-0001', 'attack');   // the first pass names the battle
    await say(a, { k: 'in' });
    await until(T + 1000);
    await say(a, { k: 'blow', to: g.att.id, w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(g, 'hp').length, 0, 'never a target');
    await until(now() + 1000);
    await say(g, { k: 'blow', to: a.att.id, w: 123, m: 9, d: 50, r: 0 });
    await say(g, { k: 'cast', to: a.att.id, d: 30 });
    assert.equal(sieges(a, 'hp').length, 0, 'never a striker');
    const d = await enter('def-0001', 'defend');
    await say(d, { k: 'in' });
    await say(d, { k: 'blow', to: a.att.id, w: 123, m: 9, d: 500, r: 0 });   // out of reach at the other camp: nothing
    await say(g, { k: 'cast', to: a.att.id, d: 30, h: 1 });
    assert.equal(sieges(a, 'hp').length, 0, 'nor a healer');
  });
  await withRoom(royalRoomKey(SK, SW), async ({ r, enter, dev, say }) => {
    const ring = at(100, 50);
    const g = await dev('dev-0001', { pose: ring });
    await say(g, { k: 'in' });
    const c = await enter('duel-0001', 'duel', {}, { pose: ring });
    await say(c, { k: 'in' });
    await say(g, { k: 'ask', to: c.att.id });
    assert.equal(sieges(c, 'ask').length, 0, 'an unsided developer challenges no one');
    assert.equal(g.meters.junk, 1, 'junk, as a frame a correct client never sends');
    await say(c, { k: 'ask', to: g.att.id });
    await say(g, { k: 'yes', to: c.att.id });
    assert.equal(r.room._siege.battle.bout, null, 'nor accepts one');
  }, { start: T + 3600_000 });
});

// ─── R10 ─────────────────────────────────────────────────────────────

test('AUDIT-SEATS R10 THE LADDER\'S TIE IS THE SERVICE\'S CHAMPION RULE: the most wins, the fewest losses, then the EARLIER last win, then the account - with b winning at t=1 and a at t=2 the room shows [b, a], as the service crowns b (net/townSeatLaw.js royalStandings) (mutants: the last win; its order; the stamp)', () => {
  const b = newBattle({ kind: 'royal', tier: 'crown', startMs: T, endMs: T + 7 * 86_400_000, field: { ring: [100 * M, 50 * M] } });
  const bout = (x, y, w, at) => { royalAsk(b, x, y, at); royalAccept(b, y, x, at); return royalEnd(b, w, at + 10_000); };
  const t1 = T + 1000, t2 = T + 60_000;
  bout('b', 'd', 'b', t1);
  bout('a', 'c', 'a', t2);
  const room = royalLadder(b).map(([sub]) => sub);
  const service = royalStandings([{ winner: 'b', loser: 'd', at: t1 + 10_000 }, { winner: 'a', loser: 'c', at: t2 + 10_000 }]).map((x) => x.account);
  assert.deepEqual(room.slice(0, 2), ['b', 'a'], 'the room: b first - its last win the earlier (the old tie by name said [a, b])');
  assert.deepEqual(service.slice(0, 2), ['b', 'a'], 'the service crowns b');
  assert.deepEqual(room, service, 'the two orders agree row for row');
  assert.deepEqual(b.wonAt, { b: t1 + 10_000, a: t2 + 10_000 }, 'each last counted win, on the room\'s clock');
  // a later win moves the stamp on; an uncounted one (the fourth between two in a UTC day) does not
  bout('b', 'd', 'b', t2 + 60_000);
  assert.equal(b.wonAt.b, t2 + 70_000);
  bout('b', 'd', 'b', t2 + 120_000);
  const fourth = bout('b', 'd', 'b', t2 + 180_000);
  assert.equal(fourth.counted, false);
  assert.equal(b.wonAt.b, t2 + 130_000, 'the uncounted fourth stamps nothing');
});

// ─── T1 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS T1 THE THRONE REACHED (Seats-Arc 7.3 "A siege held only after the Throne was reached: -5"; 9.2 "The Throne was never reached"): the battle keeps whether the attackers ever stood alone at the open Throne (its progress above nought), never undone by the decay; every `s1` carries it as `th` (1 or 0), an older receipt with none reads 0; a bout\'s receipt refuses it (mutants: the flag; its keeping; the receipt\'s field; the default; the older receipt; the disjointness)', async () => {
  const field = fieldOf(SF, 'palace');
  // the law: two banners held, an attacker alone at the Throne for a beat, then driven off
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  assert.equal(b.reached, false, 'a new battle: not reached');
  b.banners[0].side = 'attack'; b.banners[1].side = 'attack';
  const atk = stander('attack', 0, -40), def = stander('defend', 0, -60), def2 = stander('defend', 0, -60);
  battleStep(b, [atk, def, def2], T);
  battleStep(b, [atk, def, def2], T + 1000);
  assert.equal(b.reached, true, 'reached: the attackers stood alone at the open Throne');
  def.pose = at(0, -40); def2.pose = at(0, -40);
  beat(b, [atk, def, def2], T + 2000, T + 10_000);
  atk.pose = at(0, 80);
  beat(b, [atk, def, def2], T + 11_000, T + 30_000);
  assert.equal(b.throne, 0, 'its progress decayed away');
  assert.equal(b.reached, true, 'and the Throne was still reached');
  // contested from the first beat: never reached; the Throne shut (one banner): never reached
  const c = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  c.banners[0].side = 'attack'; c.banners[1].side = 'attack';
  beat(c, [stander('attack', 0, -40), stander('defend', 0, -40), stander('defend', 0, -60)], T, T + 10_000);
  assert.equal(c.reached, false, 'contested: never reached');
  const s = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field });
  s.banners[0].side = 'attack';
  beat(s, [stander('attack', 0, -40), stander('defend', 0, -60), stander('defend', 0, -60)], T, T + 10_000);
  assert.equal(s.reached, false, 'shut: never reached');
  // the receipt
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = SB;
  const what = { s: 'acct-0001', sk: SK, sw: SW, sd: 'defend', r: 'defend', a: 1, h: 1 };
  const rc = await mintSiegeReceipt({ ...what, th: 1 }, kp.privateKey, { subtle, nowS });
  assert.deepEqual((await verifySiegeReceipt(rc, kp.publicKey, { subtle, nowS })).claims, { ...what, th: 1, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S }, 'a siege held after the Throne was reached');
  assert.equal(readSiegeReceipt(rc).th, 1);
  const none = await mintSiegeReceipt(what, kp.privateKey, { subtle, nowS });
  assert.equal(JSON.parse(new TextDecoder().decode(_b64url.decode(none.split('.')[1]))).th, 0, 'minted on every receipt - 0 where the caller says none');
  // an older receipt - minted before `th` - reads as 0, signed and verified
  const body = _b64url.encode(new TextEncoder().encode(JSON.stringify({ ...what, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S })));
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, kp.privateKey, new TextEncoder().encode(`s1.${body}`)));
  const old = `s1.${body}.${_b64url.encode(sig)}`;
  const ov = await verifySiegeReceipt(old, kp.publicKey, { subtle, nowS });
  assert.ok(ov.ok, ov.why);
  assert.equal(ov.claims.th, 0, 'an older receipt reads as never reached');
  assert.equal(readSiegeReceipt(old).th, 0);
  for (const bad of [2, true, '1', -1]) assert.equal(siegeReceiptValid({ ...what, th: bad, i: nowS, e: nowS + 60 }), false, `th ${JSON.stringify(bad)}`);
  await assert.rejects(mintSiegeReceipt({ ...what, th: 2 }, kp.privateKey, { subtle, nowS }), /refused/);
  assert.equal(royalReceiptValid({ s: 'acct-0001', l: 'acct-0002', sk: SK, sw: SW, n: 1, th: 0, i: nowS, e: nowS + 60 }), false, 'a bout\'s receipt is never a siege\'s');
  assert.ok((await mintRoyalReceipt({ s: 'acct-0001', l: 'acct-0002', sk: SK, sw: SW, n: 1 }, null, { subtle, nowS })).startsWith('t1.'));
  assert.ok(rc.length <= 400, `the receipt's bound (${rc.length})`);
  // the relay: a siege held after the Throne was reached - `th` 1 on every fighter's receipt, `r` the holder's
  await withRoom(KEY, async (h) => {
    const { r, enter, say, until, relayKp } = h;
    const att = [], dfn = [];
    for (let i = 0; i < 3; i++) att.push(await enter(`atk-${pad(i)}`, 'attack'));
    for (let i = 0; i < 2; i++) dfn.push(await enter(`def-${pad(i)}`, 'defend'));
    for (const ws of [...att, ...dfn]) await say(ws, { k: 'in' });
    await walk(h, [[att[0], at(0, 40)], [att[1], at(40, 0)], [att[2], at(0, 40)]]);
    await until(T + 22_000);
    await walk(h, [[att[2], at(0, -40)]]);   // the Throne, open on two banners
    await until(r.room._siege.battle.throne > 0 ? h.now() : h.now() + 2000);
    assert.equal(r.room._siege.battle.reached, true);
    await walk(h, [[att[2], at(0, 80)]]);   // and gone home
    await until(T + SIEGE_LENGTH_MS.palace);
    const e = sieges(dfn[0], 'end').at(-1);
    const v = await verifySiegeReceipt(e.rc, relayKp.publicKey, { subtle, nowS: Math.floor(h.now() / 1000) });
    assert.deepEqual([e.r, v.claims.r, v.claims.a, v.claims.th], ['defend', 'defend', 1, 1], 'held - after the Throne was reached');
  });
  await withRoom(KEY, async ({ enter, say, until, relayKp, now }) => {
    const a = await enter('atk-0001', 'attack'), d = await enter('def-0001', 'defend');
    for (const ws of [a, d]) await say(ws, { k: 'in' });
    await until(T + SIEGE_LENGTH_MS.palace);
    const v = await verifySiegeReceipt(sieges(d, 'end').at(-1).rc, relayKp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.deepEqual([v.claims.r, v.claims.th], ['defend', 0], 'never reached');
  });
});

// ─── T2 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS T2 A SPECTATOR IS NO BODY (Seats-Arc 6.6: "no body drawn to fighters"): its pose is kept for its own camera and fanned to nobody; its join, a welcome\'s roster and a `who` answer stand it nowhere; a fighter\'s pose reaches it as ever (mutants: the fan; the join; the roster; the who)', async () => {
  await withRoom(KEY, async ({ r, enter, say, until, now }) => {
    const f = await enter('atk-0001', 'attack');
    await say(f, { k: 'in' });
    const eye = await enter('eye-0001', 'watch', {}, { pose: at(5, 5, 30) });
    assert.equal(f.sent.filter((m) => m.t === 'join' && m.id === 'eye-0001').at(-1)?.pose, null, 'its join stands it nowhere');
    await until(now() + 1000);
    await r.pose(eye, at(10, 10, 40));
    assert.deepEqual(eye.att.pose.x, at(10, 10, 40).x, 'kept for its own camera');
    assert.equal(f.sent.filter((m) => m.t === 'pose' && m.id === 'eye-0001').length, 0, 'and fanned to no fighter');
    await r.pose(f, { ...r.room._siege.fighters[f.att.sub].pose, x: r.room._siege.fighters[f.att.sub].pose.x + M });
    assert.equal(eye.sent.filter((m) => m.t === 'pose' && m.id === 'atk-0001').length, 1, 'a fighter\'s pose reaches the stands');
    // a later joiner's roster, and its ask
    const late = await enter('def-0001', 'defend');
    const peers = late.sent.find((m) => m.t === 'welcome').peers;
    assert.equal(peers.find((p) => p.id === 'eye-0001').pose, null, 'the roster stands the spectator nowhere');
    assert.ok(peers.find((p) => p.id === 'atk-0001').pose, 'and the fighter where it is');
    r.wake();   // a woken object reads who is a body before it answers
    await r.raw(late, JSON.stringify({ t: 'who', id: 'eye-0001' }));
    assert.equal(late.sent.filter((m) => m.t === 'join' && m.id === 'eye-0001').at(-1).pose, null, 'nor does a `who`');
    await r.raw(late, JSON.stringify({ t: 'who', id: 'atk-0001' }));
    assert.ok(late.sent.filter((m) => m.t === 'join' && m.id === 'atk-0001').at(-1).pose, 'a fighter\'s answer stands it');
  });
});

// ─── T3 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS T3 A DISCONNECTED FIGHTER\'S PLACE (Seats-Arc 16): back from a drop, at its camp and down until its side\'s next wave (a drop is never a way out of a fall); a reconnect that replaces its socket is no drop; a leave the room never heard is stamped at the next beat (mutants: the return; the camp; the wave; the replace; the beat\'s stamp)', async () => {
  await withRoom(KEY, async ({ r, enter, say, until, pass }) => {
    const a = await enter('atk-0001', 'attack'), d = await enter('def-0001', 'defend'), x = await enter('atk-0002', 'attack');
    for (const ws of [a, d, x]) await say(ws, { k: 'in' });
    // before the start: back at its camp, no wave
    await walk({ r, until, now: () => Date.now() }, [[x, at(0, 62)]]);
    await r.drop(x);
    const fx = r.room._siege.fighters['acct-atk-0002'];
    await until(Date.now() + 60_000);
    const xb = await enter('atk-0002', 'attack', {}, { lv: 11 });
    await say(xb, { k: 'in' });
    assert.deepEqual([fx.pose.x, fx.pose.z, fx.down], [...r.room._siege.battle.field.camps.attack, false], 'before the start: at its camp, standing');
    await walk({ r, until, now: () => Date.now() }, [[a, at(0, 62)]]);
    await until(T + 30_000);
    await r.drop(a);
    const f = r.room._siege.fighters['acct-atk-0001'];
    assert.equal(f.goneAt, T + 30_000, 'its leave stamped');
    await until(T + 65_000);
    const back = await enter('atk-0001', 'attack', {}, { gap: 0, lv: 11 });
    await say(back, { k: 'in' });
    const camp = r.room._siege.battle.field.camps.attack;
    assert.deepEqual([sieges(back, 'back').at(-1)?.p.x, sieges(back, 'back').at(-1)?.p.z], camp, 'told its camp');
    assert.deepEqual([f.down, f.upAt, f.goneAt], [true, T + 80_000, undefined], 'down until the next wave (a palace\'s 20 s)');
    assert.equal(sieges(back, 'st').at(-1).f.find((x) => x[0] === 'atk-0001')[3], 1, 'the roll call says so');
    await until(T + 80_000);
    const up = sieges(d, 'up').at(-1);
    assert.deepEqual([up.id, up.p.x, up.p.z], ['atk-0001', ...camp], 'risen whole at its camp at the wave');
    assert.deepEqual([f.down, f.hp], [false, f.max]);
    // a reconnect that replaces its socket while it is open - another tab's peer id, the same account: no drop
    await until(T + 90_000);
    const p0 = { ...f.pose };
    const again = r.connect(); await r.hello(again, 'atk-1001', at(0), { lv: 12, look: LOOK, tokenSub: 'acct-atk-0001', sp: await pass('atk-0001', 'attack') });
    assert.equal(back.closed?.code, CLOSE_REPLACED, 'the older socket replaced');
    await say(again, { k: 'in' });
    assert.deepEqual([f.down, f.goneAt, f.pose], [false, undefined, p0], 'no camp, no wave');
    // a leave the room never heard (a restarted object's sockets are gone without a close): stamped at the next beat
    const gone = r.sockets.indexOf(again);
    r.sockets.splice(gone, 1);
    await until(T + 92_000);
    assert.equal(f.goneAt, T + 91_000, 'the first beat that found it gone');
  });
});

test('AUDIT-SEATS T3 A SIDE\'S PLACES: ten at a palace (its Sellswords within them - townSeatLaw.js SIEGE_SIDE_MAX); a fighter gone keeps its own five minutes, then a substitute may take it - and the one who left, back, is told its place was taken; inside its five minutes it is kept (mutants: the places; the five minutes; the count\'s own; the substitute; the place taken)', async () => {
  await withRoom(KEY, async ({ r, enter, say, until, now }) => {
    const att = [];
    for (let i = 0; i < SIEGE_SIDE_MAX.palace; i++) { const ws = await enter(`atk-${pad(i)}`, 'attack'); await say(ws, { k: 'in' }); att.push(ws); }
    refused(await enter('atk-0099', 'attack'), 'the field is full');
    const d = await enter('def-0001', 'defend');
    assert.ok(welcomed(d), 'the other side\'s places are its own');
    await r.drop(att[0]);
    const left = now();
    await until(left + 5 * 60_000 - 1000);
    refused(await enter('atk-0099', 'attack', {}, { gap: 0, lv: 11 }), 'the field is full');
    const back = await enter('atk-0000', 'attack', {}, { gap: 0, lv: 11 });
    assert.ok(welcomed(back), 'inside its five minutes: its own place');
    await r.drop(back);
    const left2 = now();
    await until(left2 + 5 * 60_000);
    const sub = await enter('atk-0099', 'attack', {}, { gap: 0, lv: 12 });
    assert.ok(welcomed(sub), 'five minutes on: a substitute takes the place');
    await say(sub, { k: 'in' });
    assert.ok(r.room._siege.fighters['acct-atk-0099'], 'and fights');
    refused(await enter('atk-0000', 'attack', {}, { lv: 12 }), 'your place was taken');
    // the `in` holds the same law for a socket admitted before a place went
    await r.drop(att[1]);
    await until(now() + 5 * 60_000);
    const sub2 = await enter('atk-0098', 'attack', {}, { gap: 0 });
    const sub3 = await enter('atk-0097', 'attack', {}, { gap: 0 });
    await say(sub2, { k: 'in' });
    await say(sub3, { k: 'in' });
    assert.deepEqual(sieges(sub3, 'no').at(-1), { t: 'siege', k: 'no', m: 'the field is full' }, 'one place, one substitute');
    assert.equal(r.room._siege.fighters['acct-atk-0097'], undefined);
    // a leave the room has not heard yet (no stamp until the next beat) holds its place
    r.sockets.splice(r.sockets.indexOf(att[2]), 1);
    refused(await enter('atk-0096', 'attack', {}, { gap: 0 }), 'the field is full');
  });
  assert.deepEqual({ ...ref.SIEGE_PLACES }, { ...SIEGE_SIDE_MAX }, 'pinned equal to the service\'s sides');
  assert.equal(ref.SIEGE_PLACE_KEPT_MS, 5 * 60_000);
});
