// PVP-LINGER (;
// bible/11-Multiplayer/PvP-Rework.md PVP-LINGER): a fighter whose socket closes inside its PvP lock leaves its body in the
// zone - struck and killed under the referee's law, its fall signed for its killer to carry - until the lock runs out. A
// close outside the lock is a leave at once; a log-in takes the body back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { PVP_FLAG } from '../../src/systems/wild/pvpFlag.js';
import { WILD_REF } from '../../src/net/wild/wildRef.js';
import { PVP_LINGER, LINGER_AWAY, lingerUntil, lingerOver, lingerAwayWord } from '../../src/net/wild/wildLinger.js';
import { validWildRefOut } from '../../src/net/wire.js';
import { createWildRejoin } from '../../src/systems/wild/wildRejoin.js';
import { setWildDeath, wildDeath, wildDeathLines, wildDeathSlain } from '../../src/systems/wild/wildZone.js';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000;
const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const RC = 'r00000000000000000a01', RC2 = 'r00000000000000000a02', RC3 = 'r00000000000000000a03';
const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));
const leaves = (ws, id) => ws.sent.filter((m) => m.t === 'leave' && m.id === id);

async function withZone(fn) {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  const r = fakeRoom(CELL, { now: () => clock });
  const relayKp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', relayKp.privateKey)).toString('base64');
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
  const join = async (id, x, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci: RC3, ...extra }); await say(ws, { k: 'zone', z: 1 }); return ws; };
  const step = (ms) => { clock += ms; };
  const hit = async (a, to, n) => { step(300); await say(a, { k: 'strike', to, n, by: 'melee', p: W(-1), d: 999 }); };
  try { await fn({ r, say, join, step, hit, relayKp }); } finally { Date.now = realNow; }
}

test('PVP-LINGER THE LAW: a body stays only in the zone, standing, inside the lock of its last PvP blow given or taken; it goes when the lock runs out, its fall is signed, or PVP_LINGER.maxMs after its close (mutants: the lock unread; a villain kept for good; a fall kept standing)', () => {
  const x = { zone: true, down: false, fightAt: 1_000, struckAt: -Infinity, downAt: -Infinity };
  assert.equal(lingerUntil(x, 1_000 + PVP_FLAG.lockMs - 1), 1_000 + PVP_FLAG.lockMs, 'inside the lock: until its end');
  assert.equal(lingerUntil(x, 1_000 + PVP_FLAG.lockMs), 0, 'the lock run out: a leave at once');
  assert.equal(lingerUntil({ ...x, fightAt: -Infinity, flag: true, vi: 9_999 }, 5_000), 0, 'a villain with no blow in the lock: a leave at once');
  assert.equal(lingerUntil({ ...x, zone: false }, 2_000), 0, 'out of the zone');
  assert.equal(lingerUntil({ ...x, down: true }, 2_000), 0, 'down already');
  const rec = { at: 2_000 };
  assert.equal(lingerOver(rec, x, 2_000), false);
  assert.equal(lingerOver(rec, x, 1_000 + PVP_FLAG.lockMs), true, 'its lock run out');
  assert.equal(lingerOver(rec, { ...x, struckAt: 1_000 + PVP_FLAG.lockMs }, 1_000 + PVP_FLAG.lockMs), false, 'a blow on it renews the lock');
  assert.equal(lingerOver(rec, { ...x, fightAt: 2_000 + PVP_LINGER.maxMs }, 2_000 + PVP_LINGER.maxMs), true, 'never past maxMs');
  assert.equal(lingerOver(rec, { ...x, down: true, downAt: 2_000 }, 2_000 + WILD_REF.pickMs), false, 'a fall lies until it is signed');
  assert.equal(lingerOver(rec, { ...x, down: true, downAt: 2_000 }, 2_001 + WILD_REF.pickMs), true);
  assert.ok(PVP_LINGER.sayMs * 4 <= 80_000, 'its pose said again inside a peer\'s silence law (net/online.js PEER_TIMEOUT_MS)');
});

test('PVP-LINGER THE RELAY: a close in the lock keeps the body (no leave said), a flagged peer strikes and kills it, its fall signed for its killer to carry at once (`g` 1), and its leave said when the fall is signed (mutants: the hold unread; the blow\'s target by socket alone; the leave said at the close)', () => withZone(async ({ r, say, join, step, hit, relayKp }) => {
  const a = await join('peer-0001', -1, { ci: RC2 }), b = await join('peer-0002', 1, { ci: RC }), c = await join('peer-0003', 30);
  await hit(a, 'peer-0002', 1);
  assert.equal(refs(a, 'hp').length, 1, 'a blow landed: both in the lock');
  await r.drop(b);
  assert.equal(leaves(c, 'peer-0002').length, 0, 'the body stays: no leave');
  const late = r.connect();
  await r.hello(late, 'peer-0004', P(20), { lv: 10, look: LOOK, rc: 1, ci: RC3 });
  assert.ok(late.sent.some((m) => m.t === 'join' && m.id === 'peer-0002' && m.pose), 'one who enters sees the body');
  step(PVP_LINGER.sayMs);
  await say(c, { k: 'zone', z: 1 });
  assert.ok(c.sent.some((m) => m.t === 'pose' && m.id === 'peer-0002'), 'its pose said again, so no peer hides it');
  let f = null;
  for (let n = 2; n < 40 && !f; n++) { await hit(a, 'peer-0002', n); f = refs(c, 'fell')[0]; }
  assert.ok(f, 'the body falls to a flagged peer');
  assert.deepEqual([f.id, f.by], ['peer-0002', 'peer-0001']);
  assert.equal(leaves(c, 'peer-0002').length, 0, 'it lies while its fall waits to be signed');
  step(WILD_REF.pickMs + 1);
  await say(c, { k: 'zone', z: 1 });
  const rc = refs(a, 'rc').find((w) => w.r === f.r);
  assert.ok(rc, 'the fall signed and handed to its killer');
  const v = await verifyWildReceipt(rc.rc, relayKp.publicKey, { subtle, nowS: T + 120 });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.f, v.claims.c, v.claims.k, v.claims.g], ['acct-peer-0002', RC, 'acct-peer-0001', 1], 'its fallen away: the killer carries it at once (wildReceipt.js wildFallGraceS)');
  assert.equal(leaves(c, 'peer-0002').length, 1, 'then it goes, as a leave');
  assert.equal(r.room._lingers.size, 0);
}));

test('PVP-LINGER THE LOCK RUNS OUT, AND OUTSIDE IT: a body left alone goes when its lock ends; a close with no blow in the lock is a leave at once (mutants: the end unread; every close held)', () => withZone(async ({ r, say, join, step, hit }) => {
  const a = await join('peer-0001', -1, { ci: RC2 }), b = await join('peer-0002', 1, { ci: RC }), c = await join('peer-0003', 30);
  await hit(a, 'peer-0002', 1);
  await r.drop(b);
  step(PVP_FLAG.lockMs - 1_000);
  await say(c, { k: 'zone', z: 1 });
  assert.equal(leaves(c, 'peer-0002').length, 0, 'inside the lock it stands');
  step(1_000);
  await say(c, { k: 'zone', z: 1 });
  assert.equal(leaves(c, 'peer-0002').length, 1, 'the lock run out: a normal leave');
  assert.equal(r.room._wildRef.fighters.get('acct-peer-0002').zone, false, 'out of the zone');
  const d = await join('peer-0005', 5);
  await r.drop(d);
  assert.equal(leaves(c, 'peer-0005').length, 1, 'no fight: the leave at once');
  await hit(c, 'peer-0001', 1);
  step(PVP_FLAG.lockMs);
  await r.drop(a);
  assert.equal(leaves(c, 'peer-0001').length, 1, 'a blow older than the lock: the leave at once');
}));

test('PVP-LINGER A LOG-IN TAKES THE BODY BACK: the same account\'s hello here ends the body (its old id said gone, never two bodies), the fighter its own with the health the referee kept, and its next close in no fight a leave at once (mutants: the hello unread; the old id kept)', () => withZone(async ({ r, say, join, step, hit }) => {
  const a = await join('peer-0001', -1, { ci: RC2 }), b = await join('peer-0002', 1, { ci: RC }), c = await join('peer-0003', 30);
  await hit(a, 'peer-0002', 1);
  const hpLeft = r.room._wildRef.fighters.get('acct-peer-0002').f.hp;
  await r.drop(b);
  step(5_000);
  const b2 = r.connect();
  await r.hello(b2, 'peer-0012', P(1), { lv: 10, look: LOOK, rc: 1, ci: RC, tokenSub: 'acct-peer-0002' });
  assert.equal(leaves(c, 'peer-0002').length, 1, 'its old body said gone');
  assert.equal(r.room._lingers.size, 0);
  assert.equal(b2.sent.filter((m) => m.t === 'join' && m.id === 'peer-0002').length, 0, 'it is never shown its own old body');
  const x = r.room._wildRef.fighters.get('acct-peer-0002');
  assert.equal(x.id, 'peer-0012');
  assert.equal(x.f.hp, hpLeft, 'the bar it left with');
  assert.equal(x.zone, true, 'still in the zone - no entry, no safe passage');
  await say(b2, { k: 'zone', z: 1 });
  await hit(a, 'peer-0012', 2);
  assert.ok(refs(b2, 'hp').length >= 1, 'struck as itself');
  step(PVP_FLAG.lockMs);
  await r.drop(b2);
  assert.equal(leaves(c, 'peer-0012').length, 1, 'out of the lock: its leave at once');
}));

test('PVP-LINGER A LOG-IN IN ANOTHER ROOM: the hub\'s carry names the room the account stands in now, and the body here goes on its next ask (mutants: the ask unread; the own room\'s carry read as another\'s)', async () => {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r1 = world.room(CELL), r2 = world.room(worldRoom(PX + 40, PY));
    const settle = () => new Promise((res) => setTimeout(res, 5));
    const join = async (room, id, x, extra = {}) => { const ws = room.connect(); await room.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci: RC3, ...extra }); await room.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } })); await settle(); return ws; };
    const a = await join(r1, 'peer-0001', -1, { ci: RC2 }), b = await join(r1, 'peer-0002', 1, { ci: RC }), c = await join(r1, 'peer-0003', 30);
    clock += 300;
    await r1.raw(a, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: W(-1), d: 999 } }));
    await settle();
    await r1.drop(b);
    clock += 300;
    await r1.raw(a, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0002', n: 2, by: 'melee', p: W(-1), d: 999 } }));   // a blow on the body: its carry at the hub, this room's
    await settle();
    clock += PVP_LINGER.askMs;
    await r1.raw(c, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } }));
    await settle();
    assert.equal(leaves(c, 'peer-0002').length, 0, 'its own room\'s carry: the body stays');
    clock += 1_000;
    await join(r2, 'peer-0012', 1, { ci: RC, tokenSub: 'acct-peer-0002' });
    clock += PVP_LINGER.askMs;
    await r1.raw(c, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } }));
    await settle();
    assert.equal(leaves(c, 'peer-0002').length, 1, 'it stands in another room: the body here goes');
  } finally { Date.now = realNow; }
});

test('PVP-LINGER-RISE THE RELAY: a body slain while its player was away is kept in the room\'s storage; the player\'s next word that it stands in the zone - a day later, the room woken anew - is a death, its killer named, said once (mutants: the slain unkept; the word unsaid; said twice)', () => withZone(async ({ r, say, join, step, hit }) => {
  const a = await join('peer-0001', -1, { ci: RC2 }), b = await join('peer-0002', 1, { ci: RC });
  await join('peer-0003', 30);
  await hit(a, 'peer-0002', 1);
  await r.drop(b);
  let f = null;
  for (let n = 2; n < 40 && !f; n++) { await hit(a, 'peer-0002', n); f = refs(a, 'fell')[0]; }
  assert.ok(f, 'the body fell');
  assert.deepEqual(r.store.get(`${LINGER_AWAY.prefix}acct-peer-0002`)?.n, 'peer-0001', 'kept in storage, its killer named');
  step(24 * 3_600_000);
  r.wake();
  const b2 = r.connect();
  await r.hello(b2, 'peer-0012', P(1), { lv: 10, look: LOOK, rc: 1, ci: RC, tokenSub: 'acct-peer-0002' });
  await say(b2, { k: 'zone', z: 1 });
  const downs = refs(b2, 'down');
  assert.deepEqual(downs, [{ t: 'wref', k: 'down', ms: LINGER_AWAY.downMs, aw: 1, n: 'peer-0001' }], 'a death, slain while away');
  assert.ok(validWildRefOut(downs[0]).aw === 1, 'the wire keeps it');
  await say(b2, { k: 'zone', z: 1 });
  assert.equal(refs(b2, 'down').length, 1, 'said once');
  assert.equal(r.store.has(`${LINGER_AWAY.prefix}acct-peer-0002`), false, 'and forgotten');
}));

test('PVP-LINGER-RISE THE WORD AND THE PAGE: the word lies out at least LINGER_AWAY.downMs (the referee\'s own wait where it is still down), never past LINGER_AWAY.keepMs; a living page that hears it is dead - its screen names the killer and says it was slain while away, then the zone\'s rise (mutants: the keep unread; the wait unread; the line unsaid)', () => {
  const rec = { at: 1_000, n: 'Borin' };
  assert.deepEqual(lingerAwayWord(rec, null, 2_000), { t: 'wref', k: 'down', ms: LINGER_AWAY.downMs, aw: 1, n: 'Borin' });
  assert.equal(lingerAwayWord(rec, { down: true, downAt: 1_000 }, 2_000).ms, Math.max(LINGER_AWAY.downMs, WILD_REF.riseMs - 1_000), 'still down: the referee\'s wait, the word\'s least');   // PIN MOVED (DEATH-10): the rise is 10 s, the word's least
  assert.equal(lingerAwayWord(rec, { down: true, downAt: 1_000 }, 1_500).ms, WILD_REF.riseMs, 'never past the rise');
  assert.equal(lingerAwayWord(rec, null, 1_000 + LINGER_AWAY.keepMs), null, 'kept a week at most');
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'down', ms: 10_000, aw: 1, n: 'Borin' }), { k: 'down', ms: 10_000, aw: 1, n: 'Borin' });
  let presented = 0;
  const rejoin = createWildRejoin({ now: () => 500_000, present: () => { presented++; } });
  setWildDeath(null);
  assert.ok(rejoin.heard({ ms: 10_000, aw: 1, n: 'Borin' }, { alive: true }));
  assert.equal(presented, 1, 'put down');
  assert.deepEqual([wildDeath().away, wildDeath().killer, wildDeath().kill], [true, 'Borin', true]);
  assert.equal(wildDeathLines()[0], 'Slain by Borin while you were away.');
  assert.equal(wildDeathSlain(), '', 'away: PVP-HUD\'s "Slain by" head stands down, the away line says it once');
  setWildDeath(null);
});

test('PVP-LINGER THE WIRING: the relay holds the body in `_leave`, finds a blow\'s target in it, beats it, and shows it at a hello - in pvpLinger.js, never `_message`', () => {
  const relay = rd('server/src/index.js');
  assert.ok(relay.includes('const lingers = wildLast && !last && await this._lingerHold(a, Date.now());'));
  assert.ok(relay.includes('const target = this._idFirst(d.to) ?? lingerTarget(this, d.to);'));
  assert.ok(relay.includes('    await lingerStep(this, now);'));
  assert.ok(relay.includes('    await lingerHello(this, ws, now);'));
});
