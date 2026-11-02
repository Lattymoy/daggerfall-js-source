// SEAT2b part two (b) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE WORKS IN THE RELAY'S BATTLE,
// pinned over the real Room and its fake sockets (test/fakeRoom.mjs) - the pass's works name the battle's Gatehouse,
// its Rams and its Walls; an attacker's blow batters the Gatehouse, a defender's the Ram, each at its share; the Ram's
// crew strikes every ten seconds; a destroyed Ram's successor comes at the attackers' wave; the breach unbars the
// Throne; a defender rises on the Walls' quicker wave (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5; server/src/index.js
// `_siegeWorkBlow`, net/siege/siegeRef.js). `06-Systems/Online-Arc.md` SEAT2b part two (b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_WAVE_MS, siegeNextWave } from '../../../src/net/siege/siegeRef.js';
import { mintSiegeOrder } from '../../../src/net/identityToken.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const SK = 5023, SW = 20;
const KEY = siegeRoomKey(SK, SW);
const M = SIEGE_UNITS_PER_M;
const SB = 1_800_000_000;
const T = SB * 1000;
const at = (x, z = 0) => ({ x: x * M, y: 0, z: z * M, yaw: 0, pitch: 0 });
/** A crown's field in metres: Gate, Market, Temple, Palace square, the Throne (the Gatehouse's), the camps. */
const FIELD_M = [[0, 40], [40, 0], [-40, 0], [0, -20], [0, -40], [0, 80], [0, -60]];
const SF = FIELD_M.map(([x, z]) => [x * M, z * M]);
const WORKS = [2, 1, 2, 1, 0];   // Walls 2, a tier-1 Gatehouse, two Rams, a Siegewright among the attackers, no Barracks
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));

async function withBattle(fn, { start = T - 5 * 60_000, sx = WORKS, sn = 'siege' } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd, over = {}) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'crown', sn, sb: SB, se: SB + 7200, sf: SF, ...(sx ? { sx } : {}), ...over },
    (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  const enter = async (id, sd, over = {}) => { clock += 100; const ws = r.connect(); await r.hello(ws, id, at(0), { lv: 10, look: LOOK, sp: await pass(id, sd, over) }); return ws; };
  const until = async (ms) => {
    let fires = 0;
    while (r.alarm.at != null && r.alarm.at <= ms) {
      if (++fires > 10_000) throw new Error('the alarm re-arms itself for ever');
      clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire();
    }
    clock = Math.max(clock, ms);
  };
  /** Walk fighters to their points at the referee's ceiling (seat2a_relay.test.js's walk). */
  const walk = async (moves) => {
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
      await until(clock + 1000);
    }
  };
  try { await fn({ r, say, enter, until, walk, now: () => clock }); } finally { Date.now = realNow; }
}

test('SEAT2b part two (b) THE WORKS IN THE ROOM: the first pass\'s works name the battle - a tier-1 Gatehouse at the Throne, a Siegewright\'s Ram before it and one in the camp, the Walls - and a pass that says other works is for another battle; the field\'s frame carries them (mutants: the works read; the pass\'s agreement; the frame)', async () => {
  await withBattle(async ({ r, say, enter }) => {
    const a = await enter('peer-0001', 'attack');
    const b = r.room._siege.battle;
    assert.deepEqual([b.gate, b.ram, b.ramsLeft, b.works.walls], [{ hp: 30000, max: 30000 }, { hp: 4500, max: 4500, charge: 0 }, 1, 2]);
    const other = await enter('peer-0002', 'defend', { sx: [2, 1, 1, 1, 0] });
    assert.deepEqual(other.sent.at(-1), { t: 'error', m: 'that pass is for another battle' });
    await say(a, { k: 'in' });
    const f = sieges(a, 'f').at(-1);
    assert.deepEqual([f.g, f.r, f.w], [[30000, 30000], [4500, 4500, 0, 1], 2]);
  });
});

test('SEAT2b part two (b) BLOWS ON THE WORKS: nothing before the battle is joined; an attacker\'s blow takes a tenth into the Gatehouse, a defender\'s the whole into the Ram - never the other side\'s work; out of reach nothing; a destroyed Ram\'s successor is fielded at the attackers\' wave; a blow that breaks the Gatehouse breaches it and says the field at once; a work named outside a siege is junk (mutants: the sides; the share; the reach; the Ram\'s end; the breach; the junk)', async () => {
  await withBattle(async ({ r, say, enter, until, walk }) => {
    const a = await enter('peer-0001', 'attack');
    const d = await enter('peer-0002', 'defend');
    for (const ws of [a, d]) await say(ws, { k: 'in' });
    const b = () => r.room._siege.battle;
    await until(T - 60_000);
    await walk([[a, at(0, -36)], [d, at(1, -38)]]);
    await say(a, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(b().gate.hp, 30000, 'not before the start');
    await until(T + 1000);
    await say(a, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 0 });
    const dealt = 30000 - b().gate.hp;
    assert.ok(dealt >= 1 && dealt <= 5, `a tenth of the clipped blow: ${dealt}`);
    await say(d, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(30000 - b().gate.hp, dealt, 'a defender batters no gate');
    await say(a, { k: 'blow', to: 'rm', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(b().ram.hp, 4500, 'an attacker hacks no Ram of its own');
    await say(d, { k: 'blow', to: 'rm', w: 123, m: 9, d: 20, r: 0 });
    assert.equal(b().ram.hp, 4480, 'a defender\'s blow, whole');
    await say(a, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 1 });
    assert.equal(30000 - b().gate.hp, dealt, 'a shaft batters nothing');
    // the Ram destroyed: its successor at the attackers' next wave
    await until(r.now?.() ?? Date.now() + 500);
    b().ram.hp = 5;
    await say(d, { k: 'blow', to: 'rm', w: 123, m: 9, d: 20, r: 0 });
    const was = Date.now();
    assert.deepEqual([b().ram, b().ramsLeft, b().ramAt], [null, 1, siegeNextWave(was, SIEGE_WAVE_MS.crown)]);
    assert.deepEqual(sieges(a, 'f').at(-1).r, [0, 0, 0, 1], 'said at once');
    await until(b().ramAt);
    assert.deepEqual([b().ram, b().ramsLeft], [{ hp: 4500, max: 4500, charge: 0 }, 0]);
    // the breach by a blow
    await until(Date.now() + 1000);
    b().gate.hp = 2;
    await say(a, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 0 });
    assert.deepEqual([b().gate.hp, b().breached], [0, true]);
    assert.deepEqual(sieges(d, 'f').at(-1).g, [0, 30000], 'said at once');
    await say(a, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(b().gate.hp, 0, 'a breached gate takes nothing');
    // out of reach
    await until(Date.now() + 1000);
    await walk([[d, at(0, -50)]]);
    const ramHp = b().ram.hp;
    await say(d, { k: 'blow', to: 'rm', w: 123, m: 9, d: 20, r: 0 });
    assert.equal(b().ram.hp, ramHp, 'ten metres from the Ram: nothing');
  });
  // a Tourney's room: a work named is junk
  await withBattle(async ({ r, say, enter, until }) => {
    const a = await enter('peer-0001', 'attack');
    await say(a, { k: 'in' });
    await until(T + 1000);
    await say(a, { k: 'blow', to: 'gh', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(a.meters.junk, 1, 'no works in a Tourney');
    assert.equal(r.room._siege.battle.gate ?? null, null);
  }, { sx: null, sn: 'tourney' });
});

test('SEAT2b part two (b) THE RAM\'S CREW, THE BREACH AND THE THRONE: two attackers at the gate strike it every ten seconds; at nought it is breached and the Throne, its banners held, opens and is taken; a fallen defender rises on the Walls\' quicker wave (mutants: the crew\'s stroke; the bar; the breach\'s opening; the wave)', async () => {
  await withBattle(async ({ r, say, enter, until, walk, now }) => {
    const a = await enter('peer-0001', 'attack');
    const a2 = await enter('peer-0002', 'attack');
    const d = await enter('peer-0003', 'defend');
    for (const ws of [a, a2, d]) await say(ws, { k: 'in' });
    const b = () => r.room._siege.battle;
    await until(T - 60_000);
    await walk([[a, at(0, -39)], [a2, at(1, -40)]]);
    for (const bn of b().banners.slice(0, 3)) bn.side = 'attack';
    await until(T + 10_000);
    assert.equal(b().gate.hp, 29500, 'one stroke in the first ten crewed seconds');
    assert.equal(b().throne, 0, 'three of four held, the gate standing: shut');
    b().gate.hp = 1000;
    await until(T + 30_000);
    assert.equal(b().breached, true, 'two more strokes: breached');
    const after = b().throne;
    assert.ok(after > 0, 'the Throne opened at the breach');
    await until(T + 30_000 + 181_000);
    assert.equal(b().result, 'attack', 'held its 180 seconds: taken');
    assert.ok(sieges(d, 'end').length, 'said');
  });
  await withBattle(async ({ r, say, enter, until }) => {
    const a = await enter('peer-0001', 'attack');
    const d = await enter('peer-0002', 'defend');
    for (const ws of [a, d]) await say(ws, { k: 'in' });
    await until(T + 1000);
    const f = r.room._siege.fighters['acct-peer-0002'];
    f.hp = 1; f.pose = { ...r.room._siege.fighters['acct-peer-0001'].pose };
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 50, r: 0 });
    assert.equal(f.down, true);
    assert.equal(f.upAt, siegeNextWave(Date.now(), SIEGE_WAVE_MS.crown - 2 * 3000), 'the Walls at tier 2: six seconds quicker');
  });
});
