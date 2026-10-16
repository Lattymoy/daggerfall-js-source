// AUDIT SEATS-2 (2026-10-02, Mac: "Can we do a deep comprehensive audit on everything") - THE RELAY'S LANE: the relay's
// own fighters answer whoever strikes them and are struck from nowhere they could never answer (R1); a work blow's field
// frame says them where they stand (R2); the Throne's seconds never outrun the wire's bound (R3). Over the real Room and
// its fake sockets (test/fakeRoom.mjs). `06-Systems/Online-Arc.md` AUDIT SEATS-2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { siegeRoomKey, SIEGE_UNITS_PER_M, siegeNpcAt, siegeNpcInReach, siegeNpcProvoked, siegeFieldFrame, SIEGE_NPC, SIEGE_THRONE, newBattle, fieldOf } from '../../src/net/siege/siegeRef.js';
import { validSiegeOut } from '../../src/net/wire.js';
import { mintSiegeOrder } from '../../src/net/identityToken.js';
import { fakeRoom } from '../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const SK = 5024, SW = 20, KEY = siegeRoomKey(SK, SW), M = SIEGE_UNITS_PER_M, SB = 1_800_000_000, T = SB * 1000;
const at = (x, z = 0, y = 0) => ({ x: x * M, y: y * M, z: z * M, yaw: 0, pitch: 0 });
const SF = [[0, 40], [40, 0], [-40, 0], [0, -20], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }, { templateIndex: 130, group: 'Weapons', equipSlot: 21, material: 9 }] };
async function withRevolt(fn) {
  const realNow = Date.now; let clock = T - 5 * 60_000; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'crown', sn: 'revolt', sb: SB, se: SB + 7200, sf: SF }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  const enter = async (id, sd) => { clock += 100; const ws = r.connect(); await r.hello(ws, id, at(0), { lv: 10, look: LOOK, sp: await pass(id, sd) }); await say(ws, { k: 'in' }); return ws; };
  const until = async (ms) => { while (r.alarm.at != null && r.alarm.at <= ms) { clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire(); } clock = Math.max(clock, ms); };
  const place = (ws, x, z) => { r.room._siege.fighters[ws.att.sub].pose = at(x, z); };
  try { await fn({ r, say, enter, until, place, now: () => clock }); } finally { Date.now = realNow; }
}

test('AUDIT SEATS-2 R1: a shaft from beyond the Captain\'s leash and a blow\'s reach lands on nothing (he could never answer it); from within it, it lands and he marks his striker and comes for him (mutants: the reach unasked; the provocation dropped; the leash for the aggro)', async () => {
  await withRevolt(async ({ r, say, enter, until, place, now }) => {
    const d = await enter('peer-0002', 'defend');
    await until(T + 1000);
    const cap = r.room._siege.battle.npcs[0];
    assert.equal(cap.kind, 'captain');
    const K = SIEGE_NPC.captain;
    const [cx, cz] = siegeNpcAt(cap, now());
    place(d, (cap.post[0] + 0) / M + K.leashM + K.landM + 5, cap.post[1] / M);
    for (let i = 0; i < 8; i++) await say(d, { k: 'blow', to: 'n0', w: 130, m: 9, d: 10000, r: 1 });
    assert.equal(cap.hp, cap.max, 'nothing lands from where he could never answer');
    assert.equal(cap.down, false);
    await until(now() + 2000);   // the bucket refilled
    place(d, cx / M + K.aggroM + 4, cz / M);   // past his aggro, within his leash
    assert.ok(siegeNpcInReach(cap, r.room._siege.fighters[d.att.sub].pose));
    await say(d, { k: 'blow', to: 'n0', w: 130, m: 9, d: 10000, r: 1 });
    assert.ok(cap.hp < cap.max, 'within his reach it lands');
    assert.equal(cap.tg, d.att.sub, 'and he marks whoever struck him');
  });
  const n = { kind: 'rebel', post: [0, 0], down: false };
  assert.equal(siegeNpcInReach(n, { x: (SIEGE_NPC.rebel.leashM + SIEGE_NPC.rebel.landM) * M, z: 0 }), true, 'at the edge');
  assert.equal(siegeNpcInReach(n, { x: (SIEGE_NPC.rebel.leashM + SIEGE_NPC.rebel.landM + 0.5) * M, z: 0 }), false);
  siegeNpcProvoked(n, 'acct-x', 5);
  assert.deepEqual([n.tg, n.tgAt], ['acct-x', 5]);
  const down = { ...n, down: true, tg: null };
  siegeNpcProvoked(down, 'acct-x', 5);
  assert.equal(down.tg, null, 'a fallen one marks no one');
});

test('AUDIT SEATS-2 R2, R3: a work blow\'s field frame is cut at the blow\'s moment; the Throne\'s seconds are held to its hold, so a late beat\'s last frame still passes the wire (mutants: the frame at the last beat; the clamp)', () => {
  assert.match(readFileSync(new URL('../../server/src/index.js', import.meta.url), 'utf8'), /this\._siegeFan\(\[siegeFieldFrame\(b, this\._siegeCounts\(s\), now\)\]\);   \/\/ AUDIT SEATS-2 R2/);
  const b = newBattle({ kind: 'siege', tier: 'crown', startMs: T, endMs: T + 2700_000, field: fieldOf(SF, 'crown') });
  b.throne = SIEGE_THRONE.crown.holdS + 1.5;
  const f = siegeFieldFrame(b, [1, 1, 0], T + 1000);
  assert.equal(f.th, SIEGE_THRONE.crown.holdS);
  assert.ok(validSiegeOut({ t: 'siege', ...f }), 'the final frame reaches the screens');
});
