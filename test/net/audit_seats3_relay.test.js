// AUDIT SEATS-3 (2026-10-02, Mac: "Audit everything") - THE RELAY'S LANE: a fighter is
// held to the field's ground - its steps, its blows and casts, and a blow on the relay's own fighters (B1); a fighter back
// from a drop is put at its camp at the door, never only at its `in` (B2); a contender back is counted with the room's
// contenders (B3); an `in` answered once each SIEGE_IN_MS a socket, the roll call one pass over the sockets (B4); a
// fighter whose place was taken still collects its held receipt after the result (B5). Over the real Room and its fake
// sockets (test/fakeRoom.mjs). `06-Systems/Online-Arc.md` AUDIT SEATS-3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_HEIGHT_M, SIEGE_NPC, SIEGE_FIGHTERS_MAX, siegeNpcAt, siegeNpcInReach, siegeOffGround, siegeStepLevel, siegeGroundOf, royalLevel, royalMarks, siegeCampPose } from '../../src/net/siege/siegeRef.js';
import { validSiegeOut, SIEGE_IN_MS } from '../../src/net/wire.js';
import { mintSiegeOrder } from '../../src/net/identityToken.js';
import { fakeRoom } from '../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const SK = 5024, SW = 20, M = SIEGE_UNITS_PER_M, SB = 1_800_000_000, T = SB * 1000;
const at = (x, z = 0, y = 0) => ({ x: x * M, y: y * M, z: z * M, yaw: 0, pitch: 0 });
const SF = [[0, 40], [40, 0], [-40, 0], [0, -20], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const SF_PALACE = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const RING = [[100 * M, 100 * M]];
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }, { templateIndex: 130, group: 'Weapons', equipSlot: 21, material: 9 }] };
async function withBattle({ sn = 'siege', st = 'crown', se = SB + 7200, sf = SF, prefix = 'siege', start = T - 5 * 60_000 } = {}, fn) {
  const KEY = prefix === 'royal' ? `royal:${SK}:${SW}` : siegeRoomKey(SK, SW);
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st, sn, sb: SB, se, sf }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  const hello = async (id, sd, pose = at(0)) => { clock += 100; const ws = r.connect(); await r.hello(ws, id, pose, { lv: 10, look: LOOK, sp: await pass(id, sd) }); return ws; };
  const enter = async (id, sd, pose = at(0)) => { const ws = await hello(id, sd, pose); await say(ws, { k: 'in' }); return ws; };
  const until = async (ms) => { while (r.alarm.at != null && r.alarm.at <= ms) { clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire(); } clock = Math.max(clock, ms); };
  const place = (ws, x, z, y = 0) => { r.room._siege.fighters[ws.att.sub].pose = at(x, z, y); };
  const tick = (ms) => { clock += ms; };
  try { await fn({ r, say, hello, enter, until, place, tick, now: () => clock }); } finally { Date.now = realNow; }
}
const backs = (ws, from = 0) => ws.sent.slice(from).filter((x) => x.t === 'siege' && x.k === 'back');
const refusal = (ws) => ws.sent.find((x) => x.t === 'error')?.m ?? null;

test('AUDIT SEATS-3 B1: a defender climbing over a revolt is pulled back at SIEGE_HEIGHT_M off the field\'s ground, the rising strikes it there; one 45 m over the Rebel Captain lands nothing on him and walks back down; on the ground it is struck as before (mutants: the step\'s height; the striker\'s; the walk back)', async () => {
  await withBattle({ sn: 'revolt' }, async ({ r, say, enter, until, place, tick, now }) => {
    const d1 = await enter('peer-0001', 'defend'), d2 = await enter('peer-0002', 'defend'), d3 = await enter('peer-0003', 'defend');
    const f3 = () => r.room._siege.fighters[d3.att.sub];
    await until(T + 1000);
    place(d1, 0, 80); place(d2, 2, 80);
    assert.equal(r.room._siege.battle.ground, 0, 'the field\'s ground, the fighters\' middle height');
    // d3 climbs from its camp at the referee's own pace: 1.8 m up every 100 ms
    let p = { ...f3().pose }; const n0 = d3.sent.length;
    for (let i = 0; i < 25; i++) { tick(100); p = { ...p, y: p.y + 1.8 * M }; await r.pose(d3, p); }
    assert.ok(backs(d3, n0).length > 0, 'the climb past the field\'s height pulled back');
    assert.ok(f3().pose.y / M <= SIEGE_HEIGHT_M, `held within ${SIEGE_HEIGHT_M} m of the ground (stood at ${f3().pose.y / M} m)`);
    const hp0 = f3().hp;
    await until(now() + 30_000);
    assert.ok(f3().hp < hp0, 'within the field\'s height the rising reaches it');
    // 45 m over the Captain's post (a pose the room held before this law): its shafts land on nothing
    await until(now() + 60_000);   // whatever felled it has risen it
    const cap = r.room._siege.battle.npcs.find((n) => n.kind === 'captain');
    const [cx, cz] = siegeNpcAt(cap, now());
    place(d3, cx / M, cz / M, 45);
    for (let i = 0; i < 6; i++) { tick(300); await say(d3, { k: 'blow', to: cap.id, w: 130, m: 9, d: 10000, r: 1 }); }
    assert.equal(cap.hp, cap.max, 'nothing lands from 45 m over the field');
    // a step back toward the ground is kept, though it is still off it; a step further off is not
    const up = { ...f3().pose }, n1 = d3.sent.length;
    tick(100); await r.pose(d3, { ...up, y: up.y + 1 * M });
    assert.equal(backs(d3, n1).length, 1, 'further off: pulled back');
    tick(100); await r.pose(d3, { ...up, y: up.y - 1.5 * M });
    assert.equal(f3().pose.y, up.y - 1.5 * M, 'nearer the ground: kept');
    // on the ground beside him it lands
    place(d3, cx / M + 1.5, cz / M, 0);
    tick(1000); await say(d3, { k: 'blow', to: cap.id, w: 123, m: 9, d: 10000, r: 0 });
    assert.ok(cap.hp < cap.max, 'on the field\'s ground it lands');
  });
});

test('AUDIT SEATS-3 B1: a Tourney\'s bout holds its two to its marks\' ground - a contender rising 30 m is pulled back at SIEGE_HEIGHT_M, one 30 m up strikes nothing; a bout is not begun between two standing more than SIEGE_HEIGHT_M apart in height (mutants: the bout\'s ground; the striker\'s height; the level ring)', async () => {
  await withBattle({ sn: 'royal', prefix: 'royal', se: SB + 6 * 24 * 3600, sf: RING, start: T + 1000 }, async ({ r, say, enter, place, tick }) => {
    const a = await enter('peer-000a', 'duel', at(100, 100)), b = await enter('peer-000b', 'duel', at(101, 100));
    const F = (ws) => r.room._siege.fighters[ws.att.sub];
    await say(a, { k: 'ask', to: 'peer-000b' }); await say(b, { k: 'yes', to: 'peer-000a' });
    const bt = r.room._siege.battle.bout;
    assert.ok(bt, 'the bout begun');
    assert.equal(bt.y, 0, 'its marks\' ground recorded');
    tick(3100);
    let p = { ...F(a).pose }; const n0 = a.sent.length;
    for (let i = 0; i < 17; i++) { tick(100); p = { ...p, y: p.y + 1.8 * M }; await r.pose(a, p); }
    assert.ok(backs(a, n0).length > 0, 'pulled back');
    assert.ok(F(a).pose.y / M <= SIEGE_HEIGHT_M, `held within ${SIEGE_HEIGHT_M} m (stood at ${F(a).pose.y / M} m)`);
    place(a, 100, 100, 30);
    for (let i = 0; i < 6; i++) { tick(300); await say(a, { k: 'blow', to: 'peer-000b', w: 130, m: 9, d: 10000, r: 1 }); }
    assert.equal(F(b).hp, F(b).max, 'nothing lands from 30 m over the ring');
    assert.equal(a.sent.some((x) => x.k === 'won'), false);
  });
  await withBattle({ sn: 'royal', prefix: 'royal', se: SB + 6 * 24 * 3600, sf: RING, start: T + 1000 }, async ({ r, say, enter, place }) => {
    const a = await enter('peer-000a', 'duel', at(100, 100)), b = await enter('peer-000b', 'duel', at(101, 100));
    place(a, 100, 100, 30);
    await say(a, { k: 'ask', to: 'peer-000b' }); await say(b, { k: 'yes', to: 'peer-000a' });
    assert.equal(r.room._siege.battle.bout, null, 'no bout from 30 m up');
    assert.equal(b.sent.filter((x) => x.k === 'no').pop()?.m, 'the ring is not level');
  });
});

test('AUDIT SEATS-3 B1: a fighter sinking 100 m under the field is pulled back, a step at a time or in one fall; the law - the height off the ground, the step\'s, the ground a fighter is held to, a blow on the relay\'s own fighters from above, the bout\'s marks and the level ring (mutants: the sink; each law)', async () => {
  await withBattle({ sn: 'siege' }, async ({ r, enter, until, tick }) => {
    const d1 = await enter('peer-0001', 'defend'), d2 = await enter('peer-0002', 'defend');
    await until(T + 1000);
    const f = r.room._siege.fighters[d2.att.sub], was = { ...f.pose }, n0 = d2.sent.length;
    tick(50); await r.pose(d2, { ...was, y: was.y - 100 * M });
    assert.deepEqual([backs(d2, n0).length, f.pose.y], [1, was.y], 'a 100 m fall in 50 ms refused');
    let p = { ...was };
    for (let i = 0; i < 20; i++) { tick(100); p = { ...p, y: p.y - 1 * M }; await r.pose(d2, p); }
    assert.ok(Math.abs(f.pose.y - r.room._siege.battle.ground) / M <= SIEGE_HEIGHT_M, 'a slow sink held at the field\'s height');
    assert.ok(d1);
  });
  assert.equal(siegeOffGround(null, at(0, 0, 50)), 0, 'no ground judges no height');
  assert.equal(siegeOffGround(0, { x: 0, z: 0 }), 0, 'nor a pose without one');
  assert.equal(siegeOffGround(2 * M, at(0, 0, -3)), 5);
  assert.equal(siegeStepLevel(0, at(0), at(0, 0, SIEGE_HEIGHT_M)), true, 'at the edge');
  assert.equal(siegeStepLevel(0, at(0), at(0, 0, SIEGE_HEIGHT_M + 0.5)), false);
  assert.equal(siegeStepLevel(0, at(0), at(0, 0, -SIEGE_HEIGHT_M - 0.5)), false, 'below as above');
  assert.equal(siegeStepLevel(0, at(0, 0, 40), at(0, 0, 39)), true, 'walking back toward it');
  assert.equal(siegeStepLevel(0, at(0, 0, 40), at(0, 0, 40)), false, 'standing off it');
  assert.equal(siegeStepLevel(0, null, at(0, 0, 40)), true, 'a first pose');
  assert.equal(siegeStepLevel(null, at(0), at(0, 0, 400)), true, 'no ground');
  assert.equal(siegeGroundOf({ kind: 'siege', ground: 3 }, 'x'), 3);
  assert.equal(siegeGroundOf({ kind: 'revolt', ground: null }, 'x'), null);
  const royal = { kind: 'royal', field: { ring: [0, 0] }, bout: { a: 'a', b: 'b' } };
  royalMarks(royal, { y: 2 * M }, { y: 4 * M });
  assert.equal(royal.bout.y, 3 * M, 'the marks\' middle height');
  assert.deepEqual([siegeGroundOf(royal, 'a'), siegeGroundOf(royal, 'b'), siegeGroundOf(royal, 'c'), siegeGroundOf({ kind: 'royal', bout: null }, 'a')], [3 * M, 3 * M, null, null]);
  assert.deepEqual([royalLevel(at(0), at(0, 0, SIEGE_HEIGHT_M)), royalLevel(at(0), at(0, 0, SIEGE_HEIGHT_M + 1)), royalLevel(null, at(0, 0, 99))], [true, false, true]);
  const n = { kind: 'rebel', post: [0, 0], down: false };
  assert.equal(siegeNpcInReach(n, at(1, 0, 40), 0), false, 'from 40 m over its post');
  assert.equal(siegeNpcInReach(n, at(1, 0, 4), 0), true);
  assert.equal(siegeNpcInReach(n, at(1, 0, 40)), true, 'no ground judges no height');
  assert.ok(SIEGE_NPC.rebel.leashM > 1);
});

test('AUDIT SEATS-3 B2: a fighter back from a drop is at its camp and down until its side\'s wave at the door - one that never says `in` stands nowhere it dropped and strikes nothing; its `in` says the camp, its wave unmoved (mutants: the return at the door; its stamp kept for the `in`)', async () => {
  for (const sayIn of [false, true]) {
    await withBattle({ sn: 'siege', st: 'palace', sf: SF_PALACE }, async ({ r, say, hello, enter, until, place, tick }) => {
      const a = await enter('peer-000a', 'attack'), d = await enter('peer-000d', 'defend');
      await until(T + 2000);
      place(a, 10, 10); place(d, 12, 10);
      const f = r.room._siege.fighters[a.att.sub];
      f.hp = 30;
      await r.drop(a);
      tick(1500);
      const a2 = await hello('peer-000a', 'attack', at(10, 10));
      assert.equal(a2.closed, null);
      const camp = siegeCampPose(r.room._siege.battle, 'attack', at(10, 10));
      assert.deepEqual([f.pose.x, f.pose.z, f.down], [camp.x, camp.z, true], 'at its camp and down, its `in` unsaid');
      const upAt = f.upAt;
      assert.ok(upAt > Date.now(), 'until its side\'s wave');
      assert.ok(Number.isFinite(f.goneAt), 'its leave\'s stamp kept for its `in`');
      if (sayIn) {
        await say(a2, { k: 'in' });
        assert.deepEqual(backs(a2).map((x) => [x.p.x, x.p.z]), [[camp.x, camp.z]], 'its `in` says the camp');
        assert.deepEqual([f.goneAt, f.upAt, f.down], [undefined, upAt, true], 'its wave unmoved');
      }
      tick(300);
      const n = d.sent.length;
      await say(a2, { k: 'blow', to: 'peer-000d', w: 123, m: 9, d: 10000, r: 0 });
      assert.equal(d.sent.slice(n).some((x) => x.k === 'hp' && x.id === 'peer-000d'), false, 'nothing lands from where it dropped');
    });
  }
});

test('AUDIT SEATS-3 B3: a Royal Tourney\'s contender back from a drop is counted with the contenders in the room - with forty-eight in, the field is full; with a place, it comes in and its roll call is one a client reads (mutants: the count skipped for a contender the room holds)', async () => {
  await withBattle({ sn: 'royal', prefix: 'royal', se: SB + 6 * 24 * 3600, sf: RING, start: T + 1000 }, async ({ r, enter, hello, say }) => {
    const x = await enter('peer-xxxx', 'duel', at(100, 100));
    r.room._siege.battle.ladder[x.att.sub] = { w: 1, l: 0 };   // a ladder row: a record the room keeps through its leave
    await r.drop(x);
    const ws = [];
    for (let i = 0; i < SIEGE_FIGHTERS_MAX; i++) ws.push(await enter(`peer-${String(i).padStart(4, '0')}`, 'duel', at(100, 100)));
    assert.ok(r.room._siege.fighters['acct-peer-xxxx'], 'its record kept');
    assert.equal(refusal(await hello('peer-xxxx', 'duel', at(100, 100))), 'the field is full');
    await r.drop(ws[0]);
    const back = await hello('peer-xxxx', 'duel', at(100, 100));
    assert.equal(back.closed, null);
    await say(back, { k: 'in' });
    const st = back.sent.filter((m) => m.t === 'siege' && m.k === 'st').pop();
    assert.ok(st.f.length <= SIEGE_FIGHTERS_MAX);
    assert.ok(validSiegeOut(st), 'the client reads its roll call');
  });
});

test('AUDIT SEATS-3 B4: a socket\'s `in` answered once each SIEGE_IN_MS - a spectator\'s repeats inside it are nothing, no strike; its roll call asks the sockets once, never once a fighter (mutants: the `in` unmetered; the scan a fighter)', async () => {
  await withBattle({ sn: 'siege' }, async ({ r, say, enter, until, tick }) => {
    for (let i = 0; i < 10; i++) await enter(`peer-f${String(i).padStart(3, '0')}`, i % 2 ? 'attack' : 'defend');
    const w = await enter('peer-w000', 'watch');
    const sts = () => w.sent.filter((m) => m.t === 'siege' && m.k === 'st').length;
    assert.equal(sts(), 1, 'its first `in` answered');
    await until(T + 2000);
    await say(w, { k: 'in' });
    const n0 = sts();
    assert.equal(n0, 2, 'answered again once SIEGE_IN_MS has run');
    for (let i = 0; i < 8; i++) { tick(125); await say(w, { k: 'in' }); }   // one second at the siege gate's 8 Hz
    assert.equal(sts(), n0, 'its repeats inside SIEGE_IN_MS are nothing');
    assert.equal(w.closed, null);
    assert.equal(r.room._meterOf(w).siegeDrops ?? 0, 0, 'and no strike');
    tick(SIEGE_IN_MS);
    let scans = 0; const real = r.room._siegeSocketOf.bind(r.room);
    r.room._siegeSocketOf = (sub) => { scans++; return real(sub); };
    await say(w, { k: 'in' });
    assert.equal(sts(), n0 + 1, 'after SIEGE_IN_MS, answered again');
    const st = w.sent.filter((m) => m.t === 'siege' && m.k === 'st').pop();
    assert.equal(st.f.length, 10, 'every fighter in the room');
    assert.equal(scans, 0, 'the roll call one pass over the sockets');
  });
});

test('AUDIT SEATS-3 B5: a fighter whose place a substitute took, back after the result and before the window\'s close, is admitted for its held receipt and handed it; one with no receipt is still told its place was taken (mutants: the place asked of a receipt\'s holder)', async () => {
  await withBattle({ sn: 'siege', st: 'palace', sf: SF_PALACE }, async ({ r, say, hello, enter, until }) => {
    const as = [];
    for (let i = 0; i < 10; i++) as.push(await enter(`peer-a${String(i).padStart(3, '0')}`, 'attack'));
    await enter('peer-d000', 'defend');
    await until(T + 60_000);
    await r.drop(as[0]);
    await until(T + 7 * 60_000);
    const sub = await enter('peer-sub0', 'attack');
    assert.equal(sub.closed, null, 'the substitute takes the place');
    // before the result, the place is still the substitute's
    assert.equal(refusal(await hello('peer-a000', 'attack', at(0, 80))), 'your place was taken');
    await until(T + 31 * 60_000);
    const s = r.room._siege;
    assert.ok(s.battle.result && Date.now() < SB * 1000 + 7200_000, 'over, the window still open');
    assert.ok(s.receipts['acct-peer-a000'], 'its receipt held');
    const back = await hello('peer-a000', 'attack', at(0, 80));
    assert.equal(back.closed, null, 'admitted for its receipt');
    await say(back, { k: 'in' });
    const end = back.sent.find((m) => m.t === 'siege' && m.k === 'end');
    assert.deepEqual(end?.rc, s.receipts['acct-peer-a000'], 'and handed it');
  });
});
