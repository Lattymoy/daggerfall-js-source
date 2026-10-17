// SEAT2b part two (c) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE RELAY'S OWN FIGHTERS IN ITS ROOM,
// pinned over the real Room and its fake sockets (test/fakeRoom.mjs) - the pass's Barracks fields the guards and the field's
// frame carries them; a fighter's blow on one is the referee's, the sides kept, its fall said and credited; a guard's own
// blow lands on the room's held vitality at its beat and its fall is said by it; a revolt's room raises its Captain and
// rebels, and his fall ends it, the receipts carrying no Honours (bible/11-Multiplayer/Seats-Arc.md 7.5, 7.7;
// server/src/index.js `_siegeNpcBlow`, `_siegeTick`; net/siege/siegeRef.js). `06-Systems/Online-Arc.md` SEAT2b part two (c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, siegeNpcAt } from '../../../src/net/siege/siegeRef.js';
import { mintSiegeOrder } from '../../../src/net/identityToken.js';
import { readSiegeReceipt } from '../../../src/net/siege/siegeReceipt.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const SK = 5024, SW = 20;
const KEY = siegeRoomKey(SK, SW);
const M = SIEGE_UNITS_PER_M;
const SB = 1_800_000_000;
const T = SB * 1000;
const at = (x, z = 0) => ({ x: x * M, y: 0, z: z * M, yaw: 0, pitch: 0 });
/** A crown's field in metres: Gate, Market, Temple, Palace square, the Throne, the camps. */
const FIELD_M = [[0, 40], [40, 0], [-40, 0], [0, -20], [0, -40], [0, 80], [0, -60]];
const SF = FIELD_M.map(([x, z]) => [x * M, z * M]);
const WORKS = [0, 0, 0, 0, 2];   // a crown's own Gatehouse, no Rams, a tier-2 Barracks: four guards
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));

async function withBattle(fn, { start = T - 5 * 60_000, sx = WORKS, sn = 'siege' } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'crown', sn, sb: SB, se: SB + 7200, sf: SF, ...(sx ? { sx } : {}) },
    (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  const enter = async (id, sd) => { clock += 100; const ws = r.connect(); await r.hello(ws, id, at(0), { lv: 10, look: LOOK, sp: await pass(id, sd) }); await say(ws, { k: 'in' }); return ws; };
  const until = async (ms) => {
    let fires = 0;
    while (r.alarm.at != null && r.alarm.at <= ms) {
      if (++fires > 20_000) throw new Error('the alarm re-arms itself for ever');
      clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire();
    }
    clock = Math.max(clock, ms);
  };
  const place = (ws, x, z) => { r.room._siege.fighters[ws.att.sub].pose = at(x, z); };
  try { await fn({ r, say, enter, until, place, now: () => clock }); } finally { Date.now = realNow; }
}

test('SEAT2b part two (c) THE GUARDS IN THE ROOM: the pass\'s Barracks fields four at a tier-2 crown, said in the field\'s frame at an `in`; an attacker\'s blow on one in reach is the referee\'s and fanned, a defender\'s and a heal nothing, a number the battle never fielded junk; a guard felled is said at once with its striker and credited to its Honours; one down takes nothing more (mutants: the guards fielded; the sides; the heal; the junk; the fall; the credit)', async () => {
  await withBattle(async ({ r, say, enter, until, place }) => {
    const a = await enter('peer-0001', 'attack');
    const d = await enter('peer-0002', 'defend');
    const b = () => r.room._siege.battle;
    assert.deepEqual(b().npcs.map((n) => [n.id, n.kind]), [['n0', 'guard'], ['n1', 'guard'], ['n2', 'guard'], ['n3', 'guard']]);
    assert.deepEqual(sieges(a, 'f').at(-1).np.map((row) => row.slice(0, 4)), [['n0', 1, 360, 360], ['n1', 1, 360, 360], ['n2', 1, 360, 360], ['n3', 1, 360, 360]]);
    await until(T + 1000);
    const g = b().npcs[1];   // at the Palace square, (0, -20)
    const [gx, gz] = siegeNpcAt(g, Date.now());
    place(a, gx / M, gz / M + 1.5); place(d, gx / M + 1, gz / M);
    await say(a, { k: 'blow', to: 'n1', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(g.hp, 310);
    assert.deepEqual(sieges(d, 'hp').at(-1), { t: 'siege', k: 'hp', id: 'n1', h: 310, m: 360 });
    await say(d, { k: 'blow', to: 'n1', w: 123, m: 9, d: 50, r: 0 });
    await say(d, { k: 'cast', to: 'n1', d: 30, h: 1 });
    await say(a, { k: 'cast', to: 'n1', d: 30, h: 1 });
    assert.equal(g.hp, 310, 'a defender strikes no guard, and no heal reaches one - an attacker\'s heal neither mends nor harms it');
    await say(a, { k: 'blow', to: 'n9', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(a.meters.junk, 1, 'n9 was never fielded');
    await until(Date.now() + 1000);
    g.hp = 10;
    const [hx, hz] = siegeNpcAt(g, Date.now());
    place(a, hx / M, hz / M + 1);
    await say(a, { k: 'blow', to: 'n1', w: 123, m: 9, d: 50, r: 0 });
    assert.deepEqual([g.down, g.hp, r.room._siege.fighters[a.att.sub].felled], [true, 0, 1]);
    assert.deepEqual(sieges(d, 'fell').at(-1), { t: 'siege', k: 'fell', id: 'n1', by: 'peer-0001' });
    assert.equal(sieges(d, 'f').at(-1).np[1][8], 1, 'the field said at once, it down');
    await say(a, { k: 'blow', to: 'n1', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(a.meters.junk, 1, 'one down: the honest race, nothing');
  });
  // a Tourney fields none: a number named is junk
  await withBattle(async ({ say, enter, until }) => {
    const a = await enter('peer-0001', 'attack');
    await until(T + 1000);
    await say(a, { k: 'blow', to: 'n0', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(a.meters.junk, 1);
  }, { sx: null, sn: 'tourney' });
});

test('SEAT2b part two (c) A GUARD\'S BLOW AT THE BEAT: an attacker standing at a guard is struck for 20 on the room\'s vitality a beat after its wind-up, fanned to the room; felled, its fall is said by the guard and it rises at the attackers\' wave (mutants: the beat\'s blow; the fan; the fall; its wave)', async () => {
  await withBattle(async ({ r, enter, until, place }) => {
    const a = await enter('peer-0001', 'attack');
    const d = await enter('peer-0002', 'defend');
    await until(T);
    const g = r.room._siege.battle.npcs[0];   // at the Throne
    place(a, g.x / M, g.z / M + 1.5);
    const me = r.room._siege.fighters[a.att.sub];
    await until(T + 1000);
    assert.deepEqual(g.atk, { at: T + 2000, to: a.att.sub });
    await until(T + 2000);
    assert.equal(me.hp, 300);
    assert.deepEqual(sieges(d, 'hp').at(-1), { t: 'siege', k: 'hp', id: 'peer-0001', h: 300, m: 320 });
    me.hp = 5;
    await until(T + 4000);
    assert.deepEqual([me.down, me.hp], [true, 0]);
    assert.deepEqual(sieges(d, 'fell').at(-1), { t: 'siege', k: 'fell', id: 'peer-0001', by: 'n0' });
    await until(me.upAt);
    assert.equal(me.down, false, 'risen at its wave');
  });
});

test('SEAT2b part two (c) A REVOLT\'S ROOM: the holder\'s defender enters on a revolt\'s pass; its Captain and twelve rebels stand at the palace door, said in the field\'s frame (`v`, no banners); the Captain felled ends it `defend` at the next beat and every defender\'s receipt says so with no Honours (mutants: the rising; the frame; the end; Honours)', async () => {
  await withBattle(async ({ r, say, enter, until, place }) => {
    const d = await enter('peer-0002', 'defend');
    const b = () => r.room._siege.battle;
    assert.deepEqual([b().kind, b().npcs.length, b().banners.length], ['revolt', 13, 0]);
    const f = sieges(d, 'f').at(-1);
    assert.deepEqual([f.v, f.b, f.np.length, f.np[0].slice(0, 4)], [1, [], 13, ['n0', 3, 400, 400]]);
    await until(T + 1000);
    const cap = b().npcs[0];
    cap.hp = 10;
    const [cx, cz] = siegeNpcAt(cap, Date.now());
    place(d, cx / M, cz / M + 1);
    await say(d, { k: 'blow', to: 'n0', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(cap.down, true);
    await until(Date.now() + 1000);
    const end = sieges(d, 'end').at(-1);
    assert.equal(end.r, 'defend');
    assert.deepEqual([readSiegeReceipt(end.rc).r, readSiegeReceipt(end.rc).h], ['defend', 0]);
  }, { sx: null, sn: 'revolt' });
});
