// PVP-REF (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE REFEREE IN THE
// RELAY, pinned over the real Room and its fake sockets (test/fakeRoom.mjs) - a siege's room admits the developers alone
// until SEAT2a opens it, makes an account a fighter at its token's Renown, judges every blow on the striker's look and
// both last good poses, clips it, says the vitality left to the whole room, fells, raises at the wave, pulls a step too
// fast back, and keeps one fighter an account. bible/11-Multiplayer/Seats-Arc.md 6.1; `06-Systems/Online-Arc.md` PVP-REF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_WAVE_MS, SIEGE_PROTECT_MS, SIEGE_FIGHTERS_MAX, siegeBlowMax } from '../../../src/net/siege/siegeRef.js';
import { CLOSE_REPLACED } from '../../../src/net/wire.js';
import worker from '../../../server/src/index.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const KEY = siegeRoomKey(3021, 20);
const M = SIEGE_UNITS_PER_M;
const at = (x, z = 0) => ({ x: x * M, y: 0, z: z * M, yaw: 0, pitch: 0 });
const where = (p) => p && [p.x, p.y, p.z];
/** A fighter's look: a Daedric Dai-Katana in hand. */
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };   // PIN MOVED (AUDIT-SEATS): R8 - the weapon in the right hand (EquipSlots.RightHand 19); slot 0 is an amulet's, and a weapon there is held no more
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));
async function withSiege(fn, start = 1_800_000_000_000) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const join = async (id, x, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, at(x), { glyphs: ['dev'], lv: 10, look: LOOK, ...extra }); return ws; };
  try { await fn({ r, say, join, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}

test('PVP-REF THE ROOM: the Worker mints no object for a siege key a client made up; a siege\'s room admits a developer\'s verified account alone until SEAT2a opens it; `in` makes the account a fighter at 300 + 2 x its token\'s Renown and answers every fighter\'s vitality; a frame before `in`, and any siege frame outside a siege\'s room, is junk (mutants: the 404; the developers\' door; the vitality; the roll call)', async () => {
  for (const key of ['siege:abc:1', 'siege:3021', 'siege:03021:20']) {
    const res = await worker.fetch(new Request(`https://relay.test/room/${key}`, { headers: { Upgrade: 'websocket' } }), { ROOMS: { idFromName: () => { throw new Error('minted'); } } });
    assert.equal(res.status, 404, key);
    assert.deepEqual(await res.json(), { error: 'no such siege' });
  }
  await withSiege(async ({ r, say, join }) => {
    const stranger = r.connect(); await r.hello(stranger, 'peer-0009', at(0), { look: LOOK });
    assert.deepEqual(stranger.sent.at(-1), { t: 'error', m: 'the siege is not open' });
    assert.ok(stranger.closed, 'a player without the developer\'s glyph is turned away');
    const a = await join('peer-0001', 0, { lv: 10 });
    const b = await join('peer-0002', 2, { lv: 50 });
    assert.ok(a.sent.some((m) => m.t === 'welcome'));
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(a.meters.junk, 1, 'a blow before `in` is junk');
    assert.equal(sieges(b, 'hp').length, 0, 'and lands nothing');
    // the fake's storage keeps the object itself, so a skipped write would read as kept: the writes are counted
    let saves = 0;
    const put = r.state.storage.put;
    r.state.storage.put = async (k, v) => { if (k === 'siege') saves++; return put(k, v); };
    await say(a, { k: 'in' });
    assert.deepEqual(sieges(a, 'st').at(-1), { t: 'siege', k: 'st', f: [['peer-0001', 320, 320, 0]] });
    await say(b, { k: 'in' });
    assert.equal(saves, 2, 'each new fighter written at once, however soon after the last');
    assert.deepEqual(sieges(b, 'st').at(-1), { t: 'siege', k: 'st', f: [['peer-0001', 320, 320, 0], ['peer-0002', 400, 400, 0]] });
    assert.equal(r.room._siege.fighters['acct-peer-0002'].max, 400);
    assert.ok(r.store.get('siege'), 'a new fighter checkpointed at once');
  });
  const town = fakeRoom('town:m9');
  const ws = town.connect(); await town.hello(ws, 'peer-0001', null, { glyphs: ['dev'] });
  await town.raw(ws, JSON.stringify({ t: 'siege', k: 'in' }));
  assert.equal(town.room._siege, undefined, 'a siege frame outside a siege\'s room touches nothing');
  assert.equal(ws.meters.junk, 1, 'and is junk');
});

test('PVP-REF THE BLOW IN THE ROOM: judged on the striker\'s look and both last good poses - clipped to the bucket, the vitality left said to every socket (a spectator too), a weapon the look does not hold and a target out of reach landing nothing; a fall said, raised whole at its wave by the alarm, then 3 s untouched (mutants: the look; the reach; the clip; the fan; the fall; the wave)', async () => {
  await withSiege(async ({ r, say, join, now, set, step }) => {
    const a = await join('peer-0001', 0);
    const b = await join('peer-0002', 2, { lv: 50 });
    const eye = r.connect(); await r.hello(eye, 'peer-0003', at(30), { glyphs: ['dev'], look: LOOK });   // a spectator: never says `in`
    await say(a, { k: 'in' }); await say(b, { k: 'in' });
    const top = siegeBlowMax(123, 9);
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 500, r: 0 });
    for (const ws of [a, b, eye]) assert.deepEqual(sieges(ws, 'hp').at(-1), { t: 'siege', k: 'hp', id: 'peer-0002', h: 400 - top, m: 400 }, 'clipped, and said to the room');
    assert.equal(r.room._siege.fighters['acct-peer-0001'].clipped, 500 - top);
    step(1000);
    await say(a, { k: 'blow', to: 'peer-0002', w: 121, m: 9, d: 10, r: 0 });
    assert.equal(sieges(b, 'hp').length, 1, 'a Katana the look does not carry lands nothing');
    await say(a, { k: 'blow', to: 'peer-0003', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(sieges(eye, 'hp').length, 1, 'a spectator is no target');
    await say(eye, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(sieges(b, 'hp').length, 1, 'and strikes nothing');
    step(1000);
    await r.pose(b, at(8)); step(1000);
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(sieges(b, 'hp').length, 1, 'out of reach at 8 m');
    await r.pose(b, at(3)); step(1000);
    for (let i = 0; i < 24 && !r.room._siege.fighters['acct-peer-0002'].down; i++) { await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 500, r: 0 }); step(500); }   // PIN MOVED (BAL8, bible/05-Combat/Balance-Arc.md section 14): the referee's harm ceiling, 180 in any 5 s - the fall takes longer than four blows
    assert.deepEqual(sieges(eye, 'fell').at(-1), { t: 'siege', k: 'fell', id: 'peer-0002', by: 'peer-0001' });
    const f = r.room._siege.fighters['acct-peer-0002'];
    assert.deepEqual([f.hp, f.down], [0, true]);
    assert.equal(f.upAt % SIEGE_WAVE_MS.palace, 0, 'at a wave');
    assert.equal(r.alarm.at, f.upAt, 'the alarm armed for it');
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(sieges(b, 'hp').at(-1).h, 0, 'the fallen take no blow');
    set(f.upAt); await r.fire();
    assert.deepEqual(sieges(eye).slice(-2), [{ t: 'siege', k: 'up', id: 'peer-0002' }, { t: 'siege', k: 'hp', id: 'peer-0002', h: 400, m: 400 }]);
    const n = sieges(b, 'hp').length;
    step(SIEGE_PROTECT_MS - 1);
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(sieges(b, 'hp').length, n, 'risen untouched');
    step(1);
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 10, r: 0 });
    assert.equal(sieges(b, 'hp').at(-1).h, 390);
    assert.ok(now() > 0);
  });
});

test('PVP-REF THE STEP AND THE SEAT: a fighter\'s step faster than the ceiling is neither kept nor relayed - the fighter told its last good pose; a spectator\'s camera is its own; one fighter an account (a second socket replaces the first); a woken room reads its fighters and the striker\'s look back (mutants: the step\'s check; the pull-back; the spectator; the seat; the checkpoint)', async () => {
  await withSiege(async ({ r, say, join, step }) => {
    const a = await join('peer-0001', 0);
    const b = await join('peer-0002', 2);
    const eye = r.connect(); await r.hello(eye, 'peer-0003', at(30), { glyphs: ['dev'], look: LOOK });
    await say(a, { k: 'in' }); await say(b, { k: 'in' });
    step(1000);
    await r.pose(a, at(10));
    assert.deepEqual(where(r.room._siege.fighters['acct-peer-0001'].pose), where(at(10)), '10 m in a second: kept');
    step(100);
    await r.pose(a, at(60));
    assert.deepEqual(where(sieges(a, 'back').at(-1)?.p), where(at(10)), 'fifty metres in a tenth: pulled back');
    assert.deepEqual(where(a.att.pose), where(at(10)), 'and never kept as its pose');
    step(100);
    await r.pose(eye, at(300));
    assert.equal(sieges(eye, 'back').length, 0, 'a spectator flies where it likes');
    assert.deepEqual(where(eye.att.pose), where(at(300)), 'and its pose is kept');
    // a woken room
    step(1000);
    r.wake();
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(sieges(b, 'hp').length, 0, 'out of reach at 10 m, after the wake as before');
    step(1000);
    await r.pose(a, at(3)); step(500);
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 7, r: 0 });
    assert.deepEqual(sieges(b, 'hp').at(-1), { t: 'siege', k: 'hp', id: 'peer-0002', h: 313, m: 320 }, 'the look read back from storage');
    // one fighter an account
    const a2 = await join('peer-0004', 3, { tokenSub: 'acct-peer-0001' });
    assert.equal(a.closed?.code, CLOSE_REPLACED, 'the older socket goes');
    await say(a2, { k: 'in' });
    assert.equal(Object.keys(r.room._siege.fighters).length, 2, 'still one fighter an account');
    assert.deepEqual(sieges(a2, 'st').at(-1).f.find((x) => x[0] === 'peer-0004'), ['peer-0004', 320, 320, 0], 'the account\'s fighter, spoken for by its newest socket');
    assert.deepEqual(sieges(a2, 'st').at(-1).f.find((x) => x[0] === 'peer-0002'), ['peer-0002', 313, 320, 0], 'the roll call says the vitality left');
  });
});

test('PVP-REF THE FIELD\'S BOUND: the room keeps SIEGE_FIGHTERS_MAX fighters; one more is told the field is full and stays a spectator (mutants: the bound)', async () => {
  await withSiege(async ({ r, say, join, step }) => {
    const all = [];
    for (let i = 0; i < SIEGE_FIGHTERS_MAX + 1; i++) { all.push(await join(`peer-${String(i + 1).padStart(4, '0')}`, i)); step(1000); }
    for (const ws of all) await say(ws, { k: 'in' });
    assert.equal(Object.keys(r.room._siege.fighters).length, SIEGE_FIGHTERS_MAX);
    assert.deepEqual(sieges(all.at(-1)).at(-1), { t: 'siege', k: 'no', m: 'the field is full' });
  });
});
