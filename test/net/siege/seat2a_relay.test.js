// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE BATTLE IN THE
// RELAY, pinned over the real Room and its fake sockets (test/fakeRoom.mjs) - a siege's room admits by the account
// service's pass (the hello's `sp`), keeps the sides, raises the fallen at their camp on the tier's wave, beats the battle
// each second and fans its field, and at its end hands each fighter its own signed `s1` receipt. The slice's gate (Seats-Arc
// 13): "A headless 10v10 siege runs to both endings". bible/11-Multiplayer/Seats-Arc.md 6.2-6.8, 17;
// `06-Systems/Online-Arc.md` SEAT2a (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_WAVE_MS, SIEGE_OPENS_MS, SIEGE_FORFEIT_MS, SIEGE_LENGTH_MS, SIEGE_SPECTATORS_MAX } from '../../../src/net/siege/siegeRef.js';
import { mintSiegeOrder } from '../../../src/net/identityToken.js';
import { readSiegeReceipt, verifySiegeReceipt, SIEGE_RECEIPT_TTL_S } from '../../../src/net/siege/siegeReceipt.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const SK = 3021, SW = 20;
const KEY = siegeRoomKey(SK, SW);
const M = SIEGE_UNITS_PER_M;
const SB = 1_800_000_000;   // the battle's start, epoch seconds
const T = SB * 1000;
const at = (x, z = 0) => ({ x: x * M, y: 0, z: z * M, yaw: 0, pitch: 0 });
/** The field in metres: Gate, Market, Temple, the Throne, the attackers' camp, the defenders'. */
const FIELD_M = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]];
const SF = FIELD_M.map(([x, z]) => [x * M, z * M]);
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };   // PIN MOVED (AUDIT-SEATS): R8 - the weapon in the right hand (EquipSlots.RightHand 19); slot 0 is an amulet's, and a weapon there is held no more
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));
const signing = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') };
};

async function withBattle(fn, { start = T - 5 * 60_000 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const { kp: relayKp, pkcs8 } = await signing();
  r.env.GATE_SIGNING_KEY = pkcs8;
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  /** A pass, signed by the key the room verifies with (the service's), or `by` another. */
  const pass = async (id, sd, over = {}, by = null) => {
    const kp = by ?? await r.signer();
    return mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'palace', sn: 'siege', sb: SB, se: SB + 7200, sf: SF, ...over }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  };
  // each hello a tenth of a second after the last: the room's hello gate (HELLO_HZ_MAX) is not this test's subject
  const enter = async (id, sd, extra = {}, over = {}) => { clock += 100; const ws = r.connect(); await r.hello(ws, id, at(0), { lv: 10, look: LOOK, sp: await pass(id, sd, over), ...extra }); return ws; };
  /** Fire every alarm due up to `ms`, the clock walking with them; then the clock at `ms`. */
  const until = async (ms) => {
    let fires = 0;
    while (r.alarm.at != null && r.alarm.at <= ms) {
      if (++fires > 10_000) throw new Error('the alarm re-arms itself for ever');   // a room that never settles fails here, never hangs
      clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire();   // a fired alarm is spent, as the runtime's
    }
    clock = Math.max(clock, ms);
  };
  try { await fn({ r, say, pass, enter, until, relayKp, now: () => clock, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
const refused = (ws, m) => { assert.deepEqual(ws.sent.at(-1), { t: 'error', m }); assert.ok(ws.closed, m); };
/** AUDIT-SEATS R2: walk fighters (`moves`, `[ws, pose]`) to their points at the referee's ceiling - strides of 18 m a
 *  second apart, the room's alarms fired on the way: a pose after a silence earns a second's run and the slack, never
 *  the silence's whole, so these pins' one-pose teleports from a camp (40 to 100 m after minutes standing) walk now. */
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

test('SEAT2a THE DOOR: a siege\'s room admits by its pass - the service\'s signature, over the hello\'s own account, this room\'s seat and week, inside its door; the first pass names the battle and every later one must agree; a fighter is always a fighter, on the side it signed; sixty spectators; the developers\' ground only while no battle stands (mutants: each refusal; the battle named by the first pass; the side on the attachment)', async () => {
  await withBattle(async ({ r, pass, enter, set }) => {
    // before the door opens
    set(T - SIEGE_OPENS_MS - 1000);
    refused(await enter('peer-0001', 'attack'), 'the siege is not open');
    set(T - 5 * 60_000);
    const bare = r.connect(); await r.hello(bare, 'peer-0002', at(0), { look: LOOK });
    refused(bare, 'the siege is not open');
    const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const forged = r.connect(); await r.hello(forged, 'peer-0003', at(0), { look: LOOK, sp: await pass('peer-0003', 'attack', {}, stranger) });
    refused(forged, 'that pass will not do');
    const borrowed = r.connect(); await r.hello(borrowed, 'peer-0004', at(0), { look: LOOK, sp: await pass('peer-0005', 'attack') });
    refused(borrowed, 'that pass is for another battle');
    refused(await enter('peer-0006', 'attack', {}, { sk: SK + 1 }), 'that pass is for another battle');
    refused(await enter('peer-0007', 'attack', {}, { sw: SW + 1 }), 'that pass is for another battle');
    assert.equal(r.room._siege ?? null, null, 'no refused pass names a battle');
    // the first good pass names the battle
    const a = await enter('peer-0010', 'attack');
    assert.ok(a.sent.some((m) => m.t === 'welcome'));
    assert.equal(a.att.sd, 'attack', 'the side rides the attachment');
    const b = r.room._siege.battle;
    assert.deepEqual([b.kind, b.tier, b.startMs, b.endMs], ['siege', 'palace', T, T + SIEGE_LENGTH_MS.palace]);
    assert.deepEqual(b.field.camps.attack, SF[4]);
    assert.equal(r.alarm.at, Date.now() + 1000, 'the battle\'s beat armed');
    refused(await enter('peer-0011', 'defend', {}, { sb: SB - 60, se: SB + 7000 }), 'that pass is for another battle');
    refused(await enter('peer-0012', 'defend', {}, { sf: SF.map(([x, z]) => [x + 1, z]) }), 'that pass is for another battle');
    const dev = r.connect(); await r.hello(dev, 'peer-0013', at(0), { glyphs: ['dev'], look: LOOK });
    refused(dev, 'the siege is not open');
    // a fighter is always a fighter, on its own side
    await r.raw(a, JSON.stringify({ t: 'siege', k: 'in' }));
    assert.ok(r.room._siege.fighters['acct-peer-0010']);
    refused(await enter('peer-0010', 'watch'), 'a fighter is always a fighter');
    refused(await enter('peer-0010', 'defend'), 'that pass is for another side');
    // sixty spectators
    const eyes = [];
    for (let i = 0; i < SIEGE_SPECTATORS_MAX; i++) eyes.push(await enter(`peer-${String(100 + i).padStart(4, '0')}`, 'watch'));
    assert.ok(eyes.every((e) => !e.closed && e.att.sd === 'watch'));
    refused(await enter('peer-0999', 'watch'), 'the stands are full');
    // the window closed
    set(T + 7200 * 1000);
    refused(await enter('peer-0020', 'defend'), 'the siege is not open');
  });
});

test('SEAT2a THE SIDES: a fighter enters at its side\'s camp; nothing lands before the battle is joined; never a blow on a side-mate, never a heal on a foe; the fallen rise at their camp on the tier\'s wave (mutants: the camp; the start; the friendly blow; the foe\'s heal; the tier\'s wave; the rise at camp)', async () => {
  await withBattle(async ({ r, say, enter, until, now }) => {   // PIN MOVED (AUDIT-SEATS): R2 - `now`, for the walk below
    const a = await enter('peer-0001', 'attack', {}, { st: 'crown', sf: [...SF.slice(0, 3), [0, -30].map((v) => v * M), ...SF.slice(3)] });
    const a2 = await enter('peer-0002', 'attack', {}, { st: 'crown', sf: [...SF.slice(0, 3), [0, -30].map((v) => v * M), ...SF.slice(3)] });
    const d = await enter('peer-0003', 'defend', {}, { st: 'crown', sf: [...SF.slice(0, 3), [0, -30].map((v) => v * M), ...SF.slice(3)] });
    for (const ws of [a, a2, d]) await say(ws, { k: 'in' });
    const camp = (side) => r.room._siege.battle.field.camps[side];
    assert.deepEqual([sieges(a, 'back').at(-1).p.x, sieges(a, 'back').at(-1).p.z], camp('attack'), 'told its camp');
    assert.deepEqual([r.room._siege.fighters['acct-peer-0003'].pose.x, r.room._siege.fighters['acct-peer-0003'].pose.z], camp('defend'));
    assert.deepEqual(sieges(a, 'st').at(-1).f.find((x) => x[0] === 'peer-0001'), ['peer-0001', 320, 320, 0, 1], 'the roll call names the side');
    // everyone to one spot, the battle not yet joined
    await until(T - 60_000);
    await walk({ r, until, now }, [a, a2, d].map((ws) => [ws, at(0, 10)]));   // PIN MOVED (AUDIT-SEATS): R2 - 70 m from either camp, walked at the ceiling (one pose after a minute's silence may land 18.5 m away at most)
    await say(a, { k: 'blow', to: 'peer-0003', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(d, 'hp').length, 0, 'not before the start');
    await until(T + 1000);
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(a2, 'hp').length, 0, 'never a side-mate');
    await say(a, { k: 'cast', to: 'peer-0002', d: 30 });
    assert.equal(sieges(a2, 'hp').length, 0, 'nor a harmful cast on one');
    await say(a, { k: 'blow', to: 'peer-0003', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(d, 'hp').at(-1).h, 270, 'a foe');
    await say(a, { k: 'cast', to: 'peer-0003', d: 30, h: 1 });
    assert.equal(sieges(d, 'hp').at(-1).h, 270, 'never a heal on a foe');
    await say(a2, { k: 'cast', to: 'peer-0002', d: 30, h: 1 });   // whole already: a heal of nothing says nothing
    await say(d, { k: 'blow', to: 'peer-0001', w: 123, m: 9, d: 50, r: 0 });
    await say(a2, { k: 'cast', to: 'peer-0001', d: 30, h: 1 });
    assert.equal(sieges(a, 'hp').at(-1).h, 300, 'a side-mate healed');
    // a fall, risen at the camp on a crown's wave
    for (let i = 0; i < 6; i++) { await until(Date.now() + 1000); await say(d, { k: 'blow', to: 'peer-0001', w: 123, m: 9, d: 500, r: 0 }); }
    const f = r.room._siege.fighters['acct-peer-0001'];
    assert.equal(f.down, true);
    assert.equal(f.upAt % SIEGE_WAVE_MS.crown, 0, 'a crown\'s wave');
    assert.equal(r.room._siege.fighters['acct-peer-0003'].felled, 1, 'the feller credited');
    await until(f.upAt);
    const up = sieges(d, 'up').at(-1);
    assert.equal(up.id, 'peer-0001');
    assert.deepEqual([up.p.x, up.p.z], camp('attack'), 'risen at its camp, said to the room');
    assert.deepEqual([f.pose.x, f.pose.z], camp('attack'), 'and judged from there');
  });
});

/** Ten a side in the room at their camps, each having said `in`; a spectator besides. */
async function tenAside({ r, say, enter }) {
  const att = [], def = [];
  for (let i = 0; i < 10; i++) att.push(await enter(`atk-${String(i).padStart(4, '0')}`, 'attack'));
  for (let i = 0; i < 10; i++) def.push(await enter(`def-${String(i).padStart(4, '0')}`, 'defend'));
  const eye = await enter('eye-0001', 'watch');
  for (const ws of [...att, ...def, eye]) await say(ws, { k: 'in' });
  return { att, def, eye };
}
const subOf = (ws) => ws.att.sub;

test('SEAT2a A HEADLESS 10v10 SIEGE, THE ATTACKERS\' ENDING: two banners raised by attackers alone open the Throne, held 120 s it is theirs - the field fanned each second; each fighter handed its own signed `s1` receipt (the result, a banner raised, its Honours: a defender gone at the start earns none), a spectator the result alone; a fighter returning finds its receipt kept, and the room forgets the siege after a receipt\'s week (mutants: the beat; the fan; the receipt\'s fields; the Honours; the keeping; the forgetting)', async () => {
  await withBattle(async (h) => {
    const { r, say, until, enter, relayKp } = h;
    const { att, def, eye } = await tenAside(h);
    await walk(h, [...att.slice(0, 5).map((ws) => [ws, at(0, 40)]), ...att.slice(5).map((ws) => [ws, at(40, 0)])]);   // PIN MOVED (AUDIT-SEATS): R2 - to the Gate and the Market before the start, walked (the poses at T + 1 s below then move nobody)
    await until(T + 1000);
    await r.drop(def[9]);   // gone at the start, felling nobody
    for (let i = 0; i < 5; i++) await r.pose(att[i], at(0, 40));   // the Gate
    for (let i = 5; i < 10; i++) await r.pose(att[i], at(40, 0));   // the Market
    await until(T + 22_000);
    const f = sieges(eye, 'f').at(-1);
    assert.deepEqual(f.b, [[1, 0, 0], [1, 0, 0], [2, 0, 0]], 'the Gate and the Market raised by the attackers, the Temple the holder\'s');
    assert.deepEqual(f.n, [10, 9, 1], 'who is in');
    assert.deepEqual([f.s, f.e], [T, T + SIEGE_LENGTH_MS.palace]);
    assert.ok(sieges(eye, 'f').length >= 300, 'a frame a second while it is in');
    await walk(h, att.map((ws) => [ws, at(0, -40)]));   // the Throne, from either banner   // PIN MOVED (AUDIT-SEATS): R2 - walked at the ceiling, 80 m and 57 m, from T + 22 s
    await until(T + 60_000);
    assert.equal(sieges(eye, 'f').at(-1).th, 60 - 24, 'the Throne\'s seconds: held from the beat after the attackers reached it');   // PIN MOVED (AUDIT-SEATS): R2 - walked, the Market's five are within its 8 m from T + 24 s
    await until(T + 200_000);
    const end = sieges(eye, 'end');
    assert.deepEqual(end, [{ t: 'siege', k: 'end', r: 'attack', a: 1 }], 'the result said once, a spectator\'s without a receipt');
    const b = r.room._siege.battle;
    assert.equal(b.result, 'attack');
    const nowS = Math.floor(Date.now() / 1000);
    for (const ws of [...att, ...def.slice(0, 9)]) {
      const e = sieges(ws, 'end');
      assert.equal(e.length, 1);
      const v = await verifySiegeReceipt(e[0].rc, relayKp.publicKey, { subtle, nowS });
      assert.ok(v.ok, v.why);
      assert.deepEqual({ ...v.claims, i: 0, e: 0 }, { s: subOf(ws), sk: SK, sw: SW, sd: ws.att.sd, r: 'attack', a: 1, h: 1, th: 1, i: 0, e: 0 });   // PIN MOVED (AUDIT-SEATS): T1 - and the Throne reached
      assert.equal(v.claims.e - v.claims.i, SIEGE_RECEIPT_TTL_S);
    }
    // the defender gone at the start: its receipt kept, its Honours none
    const kept = r.room._siege.receipts['acct-def-0009'];
    assert.deepEqual([readSiegeReceipt(kept).h, readSiegeReceipt(kept).r, readSiegeReceipt(kept).signed], [0, 'attack', true]);
    const back = await enter('def-0009', 'defend', { lv: 11 });   // a later token (the harness's signer walks one identity's issued-at back)
    await say(back, { k: 'in' });
    assert.equal(sieges(back, 'end').at(-1).rc, kept, 'a fighter returning finds its own receipt');
    assert.equal(Object.keys(r.room._siege.fighters).length, 20, 'and no new fighter is made');
    const n = sieges(eye, 'f').length;
    await until(Date.now() + 10_000);
    assert.equal(sieges(eye, 'f').length, n, 'the beat stops at the end');
    const dropAt = r.room._siege.dropAt;
    assert.equal(r.alarm.at, dropAt);
    assert.equal(dropAt, (readSiegeReceipt(kept).i + SIEGE_RECEIPT_TTL_S) * 1000, 'kept a receipt\'s week from the end');
    await until(dropAt);
    assert.equal(r.room._siege, null, 'forgotten after a receipt\'s week');
    assert.equal(r.store.has('siege'), false);
  });
});

test('SEAT2a A HEADLESS 10v10 SIEGE, THE HOLDER\'S ENDING: banners contested by both sides freeze, nothing is raised, and at thirty minutes the holder keeps it - `a` 0 on every receipt (a siege nobody fought is not a victory); THE NO-SHOWS: no attacker by ten minutes is a forfeit, nobody at all is `absent` (mutants: the freeze; the clock; the raised flag; the forfeit; the absence)', async () => {
  await withBattle(async (h) => {
    const { r, say, until, relayKp } = h;
    const { att, def, eye } = await tenAside(h);
    await walk(h, [...att, ...def].map((ws) => [ws, at(0, 40)]));   // PIN MOVED (AUDIT-SEATS): R2 - walked to the Gate before the start (the poses at T + 1 s below then move nobody)
    await until(T + 1000);
    for (const ws of [...att, ...def]) await r.pose(ws, at(0, 40));   // all at the Gate
    await until(T + 60_000);
    assert.deepEqual(sieges(eye, 'f').at(-1).b, [[2, 0, 0], [2, 0, 0], [2, 0, 0]], 'contested: frozen, nothing raised');
    await until(T + SIEGE_LENGTH_MS.palace - 2000);
    assert.equal(r.room._siege.battle.result, null, 'not before its time');
    await until(T + SIEGE_LENGTH_MS.palace);
    assert.deepEqual(sieges(eye, 'end'), [{ t: 'siege', k: 'end', r: 'defend', a: 0 }]);
    const hits = sieges(def[0], 'hp').length;
    await say(att[0], { k: 'blow', to: 'def-0000', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(sieges(def[0], 'hp').length, hits, 'nothing lands once it is over');
    const v = await verifySiegeReceipt(sieges(att[0], 'end')[0].rc, relayKp.publicKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.deepEqual([v.claims.r, v.claims.a, v.claims.h, v.claims.sd], ['defend', 0, 1, 'attack']);
  });
  await withBattle(async ({ r, say, enter, until }) => {
    const d = await enter('def-0001', 'defend');
    await say(d, { k: 'in' });
    await until(T + SIEGE_FORFEIT_MS - 1000);
    assert.equal(r.room._siege.battle.result, null);
    await until(T + SIEGE_FORFEIT_MS);
    assert.deepEqual(sieges(d, 'end').map((e) => [e.r, readSiegeReceipt(e.rc).h]), [['forfeit', 1]], 'a forfeit, the defender honoured for standing');
  });
  await withBattle(async ({ r, enter, until }) => {
    const eye = await enter('eye-0001', 'watch');
    await until(T + SIEGE_FORFEIT_MS);
    assert.deepEqual(sieges(eye, 'end'), [{ t: 'siege', k: 'end', r: 'absent', a: 0 }], 'nobody came: absent');
    assert.deepEqual(r.room._siege.receipts, {}, 'and no fighter to hand a receipt');
  });
});
