// CROWN1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE ROYAL TOURNEY IN THE RELAY, pinned
// over the real Room and its fake sockets (test/fakeRoom.mjs) - a crown's `royal:` room admits by the service's pass
// (`sn` 'royal': a contender or a spectator) all the week its Edict rules; a challenge and its accept begin a bout in
// DUEL1's ring, both whole on their marks; after the countdown the bout's two alone strike each other, every blow the
// referee's, the ring held by the step; a fall ends it - the winner handed its signed `t1` receipt, the ladder counting
// it (the same two three times a UTC day); a bout too long a draw, a fighter gone a walkover; the week's end closes it.
// bible/11-Multiplayer/Seats-Arc.md 7.6; `06-Systems/Online-Arc.md` CROWN1 (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { royalRoomKey, siegeRoomKey, SIEGE_UNITS_PER_M, ROYAL_RING, ROYAL_PAIR_DAY_MAX, ROYAL_LADDER_SHOWN, ROYAL_RC_KEEP } from '../../../src/net/siege/siegeRef.js';
import { mintSiegeOrder } from '../../../src/net/identityToken.js';
import { verifyRoyalReceipt, readRoyalReceipt, SIEGE_RECEIPT_TTL_S } from '../../../src/net/siege/siegeReceipt.js';
import { DUEL_RADIUS_M, DUEL_COUNTDOWN_MS, DUEL_MAX_MS, DUEL_ASK_TTL_MS, DUEL_GONE_MS, DUEL_OUT_SLACK_M } from '../../../src/net/duel/duelSession.js';
import worker from '../../../server/src/index.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const SK = 5023, SW = 20;
const KEY = royalRoomKey(SK, SW);
const M = SIEGE_UNITS_PER_M;
const SB = 1_800_000_000;   // the week's start, epoch seconds
const SE = SB + 7 * 86400;
const T = SB * 1000;
const at = (x, z = 0) => ({ x: x * M, y: 0, z: z * M, yaw: 0, pitch: 0 });
const SF = [[100 * M, 50 * M]];   // the ring's centre
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };   // PIN MOVED (AUDIT-SEATS): R8 - the weapon in the right hand (EquipSlots.RightHand 19); slot 0 is an amulet's, and a weapon there is held no more
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));
const signing = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') };
};

async function withTourney(fn, { start = T + 3600_000, key = KEY } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(key, { now: () => clock });
  const { kp: relayKp, pkcs8 } = await signing();
  r.env.GATE_SIGNING_KEY = pkcs8;
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd, over = {}) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'crown', sn: 'royal', sb: SB, se: SE, sf: SF, ...over }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  const enter = async (id, sd = 'duel', over = {}, pose = at(100, 50)) => { clock += 100; const ws = r.connect(); await r.hello(ws, id, pose, { lv: 10, look: LOOK, sp: await pass(id, sd, over) }); return ws; };
  const until = async (ms) => {
    let fires = 0;
    while (r.alarm.at != null && r.alarm.at <= ms) {
      if (++fires > 10_000) throw new Error('the alarm re-arms itself for ever');
      clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire();
    }
    clock = Math.max(clock, ms);
  };
  try { await fn({ r, say, pass, enter, until, relayKp, now: () => clock, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
const refused = (ws, m) => { assert.deepEqual(ws.sent.at(-1), { t: 'error', m }); assert.ok(ws.closed, m); };
/** Two contenders in, each having said `in`. */
async function two(h, a = 'peer-0001', b = 'peer-0002') {
  const wa = await h.enter(a), wb = await h.enter(b);
  for (const ws of [wa, wb]) await h.say(ws, { k: 'in' });
  return [wa, wb];
}
/** A bout begun between `wa` (the challenger) and `wb`; its countdown run. */
async function bout(h, wa, wb) {
  await h.say(wa, { k: 'ask', to: wb.att.id });
  await h.say(wb, { k: 'yes', to: wa.att.id });
  await h.until(h.now() + ROYAL_RING.countdownMs);
}
/** `wa` closes on `wb` and fells it: a step in, then a blow a second until it falls. */
async function fell(h, wa, wb) {
  const p = h.r.room._siege.fighters[wb.att.sub].pose;
  await h.until(h.now() + 1000);
  await h.r.pose(wa, { ...p, x: p.x - 1.5 * M });
  const ended = sieges(wb, 'bend').length;
  for (let i = 0; i < 12 && sieges(wb, 'bend').length === ended; i++) { await h.until(h.now() + 1000); await h.say(wa, { k: 'blow', to: wb.att.id, w: 123, m: 9, d: 500, r: 0 }); }
}

test('CROWN1 THE RING IS DUEL1\'S: the Royal Tourney\'s radius, countdown, longest bout, ask, absence and slack pinned equal to DUEL1\'s; the same two three times a day; ten rows of the ladder', () => {
  assert.deepEqual([ROYAL_RING.radiusM, ROYAL_RING.countdownMs, ROYAL_RING.boutMs, ROYAL_RING.askMs, ROYAL_RING.goneMs, ROYAL_RING.outSlackM],
    [DUEL_RADIUS_M, DUEL_COUNTDOWN_MS, DUEL_MAX_MS, DUEL_ASK_TTL_MS, DUEL_GONE_MS, DUEL_OUT_SLACK_M]);
  assert.deepEqual([ROYAL_RING.markM, ROYAL_PAIR_DAY_MAX, ROYAL_LADDER_SHOWN, ROYAL_RC_KEEP], [4, 3, 10, 20]);
});

test('CROWN1 THE TOURNEY\'S DOOR: the Worker mints no object for a made-up `royal:` key; the room admits by a Royal Tourney\'s pass alone (never a siege\'s, and a Royal Tourney\'s pass never a siege\'s room), for its own crown and week, inside its week; a contender or a spectator (mutants: the Worker\'s key; the kind; the week\'s door)', async () => {
  for (const key of ['royal:5023', 'royal:x:20', 'royal:5023:20:1']) {
    const res = await worker.fetch(new Request(`https://relay.test/room/${key}`, { headers: { Upgrade: 'websocket' } }), { ROOMS: { idFromName: () => { throw new Error('minted'); } } });
    assert.equal(res.status, 404, key);
    assert.deepEqual(await res.json(), { error: 'no such tourney' });
  }
  await withTourney(async ({ enter, set, r }) => {
    refused(await enter('peer-0001', 'attack', { sn: 'siege', st: 'palace', sb: SB, se: SB + 3600, sf: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] }), 'that pass is for another battle');
    refused(await enter('peer-0002', 'duel', { sk: SK + 1 }), 'that pass is for another battle');
    const a = await enter('peer-0003');
    assert.ok(a.sent.some((m) => m.t === 'welcome'));
    assert.equal(a.att.sd, 'duel');
    const b = r.room._siege.battle;
    assert.deepEqual([b.kind, b.startMs, b.endMs, b.field.ring], ['royal', T, SE * 1000, SF[0]]);
    assert.equal(r.alarm.at, SE * 1000, 'no bout on: the room wakes at its week\'s end');
    const eye = await enter('peer-0004', 'watch');
    assert.equal(eye.att.sd, 'watch');
    set(SE * 1000);
    refused(await enter('peer-0005'), 'the siege is not open');
  });
  await withTourney(async ({ enter }) => {
    refused(await enter('peer-0006'), 'that pass is for another battle');
  }, { key: siegeRoomKey(SK, SW) });
});

test('CROWN1 A BOUT: a challenge said to the one challenged, its accept beginning the bout - both whole on their marks, told the room; nothing lands in the countdown, nor from a third or on one; the bout\'s blows judged by the referee; a fall ends it - the winner\'s signed `t1` receipt, both whole, the ladder (mutants: the ask; the accept; the marks; the countdown; the bout\'s two; the fall\'s end; the receipt; the ladder)', async () => {
  await withTourney(async (h) => {
    const { r, say, relayKp } = h;
    const [wa, wb] = await two(h);
    const wc = await h.enter('peer-0003');
    await say(wc, { k: 'in' });
    // refusals in words
    await say(wa, { k: 'ask', to: wa.att.id });
    assert.equal(sieges(wa, 'no').at(-1).m, 'no such contender', 'never oneself');
    await say(wb, { k: 'yes', to: wa.att.id });
    assert.equal(sieges(wb, 'no').at(-1).m, 'no such challenge');
    await say(wa, { k: 'ask', to: wb.att.id });
    assert.deepEqual(sieges(wb, 'ask').at(-1), { t: 'siege', k: 'ask', id: wa.att.id }, 'the challenge said to the one challenged');
    assert.equal(sieges(wc, 'ask').length, 0, 'and to no one else');
    const t0 = h.now();
    await say(wb, { k: 'yes', to: wa.att.id });
    const bt = sieges(wc, 'bout').at(-1);
    assert.deepEqual(bt, { t: 'siege', k: 'bout', a: wa.att.id, b: wb.att.id, n: 1, s: t0 + ROYAL_RING.countdownMs, e: t0 + ROYAL_RING.countdownMs + ROYAL_RING.boutMs }, 'the bout told the room');
    const pa = sieges(wa, 'back').at(-1).p, pb = sieges(wb, 'back').at(-1).p;
    assert.deepEqual([pa.x, pa.z, pb.x, pb.z], [SF[0][0] - 4 * M, SF[0][1], SF[0][0] + 4 * M, SF[0][1]], 'each on its mark');
    // a third may neither strike nor be struck, nor challenge into the bout
    await say(wc, { k: 'ask', to: wa.att.id });
    assert.equal(sieges(wc, 'no').at(-1).m, 'a bout is on');
    await h.until(t0 + 1000);
    await r.pose(wa, { ...pa, x: pa.x + 3 * M });   // in reach, a second's walk
    await say(wa, { k: 'blow', to: wb.att.id, w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(wb, 'hp').filter((m) => m.h < m.m).length, 0, 'nothing in the countdown');
    await h.until(t0 + ROYAL_RING.countdownMs);
    await r.pose(wc, at(100, 50));
    await say(wc, { k: 'blow', to: wb.att.id, w: 123, m: 9, d: 50, r: 0 });
    await say(wa, { k: 'cast', to: wb.att.id, d: 20, h: 1 });
    assert.equal(sieges(wb, 'hp').filter((m) => m.h < m.m).length, 0, 'never a third\'s blow, never a heal between them');
    await h.until(h.now() + 1000);
    await say(wa, { k: 'blow', to: wb.att.id, w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(wc, 'hp').at(-1).h, 270, 'the bout\'s blow, judged');
    await say(wa, { k: 'cast', to: wb.att.id, d: 20, h: 1 });
    assert.equal(sieges(wc, 'hp').at(-1).h, 270, 'never a heal on the one you fight');
    await fell(h, wa, wb);
    const end = sieges(wc, 'bend').at(-1);
    assert.deepEqual(end, { t: 'siege', k: 'bend', n: 1, w: wa.att.id, l: wb.att.id, c: 1 });
    assert.deepEqual(sieges(wc, 'lad').at(-1).l, [[wa.att.id, 1, 0], [wb.att.id, 0, 1]]);
    assert.equal(r.room._siege.battle.bout, null);
    const f = r.room._siege.fighters;
    assert.deepEqual([f[wa.att.sub].hp, f[wb.att.sub].hp, f[wb.att.sub].down], [320, 320, false], 'both whole again');
    const won = sieges(wa, 'won');
    assert.equal(won.length, 1);
    assert.equal(sieges(wb, 'won').length + sieges(wc, 'won').length, 0, 'the winner\'s alone');
    const v = await verifyRoyalReceipt(won[0].rc, relayKp.publicKey, { subtle, nowS: Math.floor(h.now() / 1000) });
    assert.ok(v.ok, v.why);
    assert.deepEqual({ ...v.claims, i: 0, e: 0 }, { s: wa.att.sub, l: wb.att.sub, sk: SK, sw: SW, n: 1, i: 0, e: 0 });
    assert.equal(v.claims.e - v.claims.i, SIEGE_RECEIPT_TTL_S);
    // a reconnect finds its receipts again
    const back = await h.enter('peer-0001');
    await say(back, { k: 'in' });
    assert.equal(sieges(back, 'won').at(-1).rc, won[0].rc);
    assert.deepEqual(sieges(back, 'lad').at(-1).l[0], [back.att.id, 1, 0], 'and the ladder');
  });
});

test('CROWN1 THE RING HELD: a bout\'s fighter stepping past the ring and its slack is pulled back; anyone else walks free; one bout at a time (mutants: the ring\'s step; the ring taken)', async () => {
  await withTourney(async (h) => {
    const { r, say } = h;
    const [wa, wb] = await two(h);
    const [wc, wd] = await two(h, 'peer-0003', 'peer-0004');
    await bout(h, wa, wb);
    await say(wc, { k: 'ask', to: wd.att.id });
    await say(wd, { k: 'yes', to: wc.att.id });
    assert.equal(sieges(wd, 'no').at(-1).m, 'the ring is taken');
    const p = r.room._siege.fighters[wa.att.sub].pose;
    const steps = sieges(wa, 'back').length;
    await h.until(h.now() + 2000);
    await r.pose(wa, { ...p, x: SF[0][0] - (ROYAL_RING.radiusM + ROYAL_RING.outSlackM + 1) * M });
    assert.equal(sieges(wa, 'back').length, steps + 1, 'pulled back');
    assert.deepEqual(r.room._siege.fighters[wa.att.sub].pose, p);
    await r.pose(wc, at(118, 50));   // PIN MOVED (AUDIT-SEATS): R2 - a pose after a silence earns a second's run and the slack (18.5 m), never the silence's whole; 18 m out is still past the ring's 12 m and its 4 m slack
    assert.equal(r.room._siege.fighters[wc.att.sub].pose.x, 118 * M, 'free outside a bout');   // PIN MOVED (AUDIT-SEATS): R2, as above
  });
});

test('CROWN1 A DRAW, A WALKOVER, THE SAME TWO, THE WEEK\'S END: a bout run its length a draw (no receipt, no ladder); a fighter gone from the room ten seconds loses; the same two counted three times a UTC day, then no more; at the week\'s end any bout a draw and the room forgotten a receipt\'s week later (mutants: the draw; the walkover; the pair cap; the end)', async () => {
  await withTourney(async (h) => {
    const { r, say } = h;
    const [wa, wb] = await two(h);
    const eye = await h.enter('peer-0009', 'watch');
    await say(eye, { k: 'in' });
    await bout(h, wa, wb);
    await h.until(h.now() + ROYAL_RING.boutMs + 1000);
    assert.deepEqual(sieges(eye, 'bend').at(-1), { t: 'siege', k: 'bend', n: 1, w: '', l: '', c: 0 }, 'a draw');
    assert.equal(sieges(wa, 'won').length + sieges(wb, 'won').length, 0);
    assert.deepEqual(r.room._siege.battle.ladder, {});
    // three counted bouts, a fourth not
    for (let i = 0; i < 4; i++) { await bout(h, wa, wb); await fell(h, wa, wb); }
    assert.deepEqual(sieges(eye, 'bend').slice(-4).map((m) => m.c), [1, 1, 1, 0]);
    assert.deepEqual(r.room._siege.battle.ladder[wa.att.sub], { w: 3, l: 0 });
    assert.equal(sieges(wa, 'won').length, 4, 'a receipt for each - the service counts them by the same rule');
    // a walkover
    await bout(h, wb, wa);
    await r.drop(wa);
    await h.until(h.now() + ROYAL_RING.goneMs + 1000);
    const walk = sieges(eye, 'bend').at(-1);
    assert.equal(walk.w, wb.att.id, 'the one left wins');
    assert.equal(walk.l, '', 'the one gone named by no socket');
    assert.equal(readRoyalReceipt(sieges(wb, 'won').at(-1).rc).l, wa.att.sub, 'its receipt names the account');
    // the week's end
    const wc = await h.enter('peer-0003');
    await say(wc, { k: 'in' });
    await bout(h, wc, wb);
    await h.until(SE * 1000);
    assert.equal(sieges(eye, 'bend').at(-1).w, '', 'the bout on at the end a draw');
    assert.equal(r.room._siege.battle.result, 'over');
    await h.until(SE * 1000 + SIEGE_RECEIPT_TTL_S * 1000);
    assert.equal(r.room._siege, null, 'forgotten');
  });
});
