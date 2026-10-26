// STAFF-PANEL5-FREEZE (2026-10-22, mob: "the player can only look around"; design doc "DFO Staff Panel: design", Freeze
// player, Server load leases, and their weak spots) - FREEZE PLAYER AND THE STAFF CHAT, the relay's half
// (server/src/staffFreeze.js and its hooks in server/src/index.js), over the pins' fake objects (test/fakeRoom.mjs): the
// service's signed `freeze` order through the Worker's law door to the hub and its stored book; the token's `fz` at every
// room's hello; A MODDED CLIENT that ignores its freeze screen and is still heard in nothing but its camera, its ping, its
// lease and its staff nudges; out of every fight; never a room's host; the staff channel's nudges to its members alone; a
// muted and frozen player; an old build closed with the reload words; and the bus's book over its shards. The account
// service's half: test/server/staffpanel5_freeze.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server/src/index.js';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import * as H from '../../src/net/hubShards.js';
import { CHAT_WORLD_ROOM, SAFE_LAW_PATH, CLOSE_POLICY, PIXEL_UNITS, cellRoomOfWire, CHAT_LINE_CHANNELS, parseClient } from '../../src/net/wire.js';
import { mintFreezeOrder, mintStaffLineOrder, mintOrder, verifyOrder, orderValid, claimsValid } from '../../src/net/identityToken.js';
import { leaseKeyOf, mintLease, readLease, leaseRoom, LEASE_FRAME_MIN_MS, LEASE_OLD_REASON } from '../../src/net/roomLease.js';
import { caravanRoomOf } from '../../src/net/privateInterior.js';
import { FREEZES_KEY, FREEZE_OLD_REASON, STAFF_ORDER_KINDS, frozenFrame, seatBarred } from '../../server/src/staffFreeze.js';

const { subtle } = globalThis.crypto;
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const GATE = (async () => { const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); return Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'); })();
const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const CELL = cellRoomOfWire(P0.x, P0.z);
const of = (ws, t) => ws.sent.filter((f) => f.t === t);
const RELOAD = /older than the world online/;

/** One clock for a hub, a cell and the Worker's door, the relay's secret in each room's env. */
async function stand(t) {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const secret = await GATE;
  const W = fakeRooms({ now: () => now });
  const room = (k) => { const r = W.room(k); r.env.GATE_SIGNING_KEY = secret; return r; };
  const hub = room(CHAT_WORLD_ROOM), cell = room(CELL);
  const kp = await hub.signer();
  const nowS = () => Math.floor(now / 1000);
  const join = async (R, id, extra = {}) => { const ws = R.connect(); now += 300; await quiet(() => R.hello(ws, id, R === cell ? P0 : null, { fv: 1, ...extra })); return ws; };
  const say = (R, ws, o) => quiet(() => R.raw(ws, JSON.stringify(o)));
  const door = (order, env = { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY }) => quiet(() => worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), env));
  const freeze = async (s, fz, at = nowS()) => door(await mintFreezeOrder({ s, fz }, kp.privateKey, { subtle, nowS: at }));
  const key = await leaseKeyOf(secret, { subtle });
  const lease = (o) => mintLease({ at: nowS(), mu: 0, ...o }, key, { subtle });
  return { W, room, hub, cell, kp, join, say, door, freeze, lease, key, tick: (ms) => { now += ms; }, nowS };
}

test('STAFF-PANEL5-FREEZE the law: `fz` rides a token after its issue; the `freeze` and `staffline` orders are their own kinds, a mute\'s or a ban\'s fields never on them, nor theirs on a mute; the hello says whether the build can show the freeze screen (`fv`); the staff channel is a line channel (mutants: the claim\'s bound; the kinds\' fields)', async () => {
  const base = { s: 'acct-a', n: 'A', k: 'guest', i: 1000, e: 1300 };
  assert.ok(claimsValid({ ...base, fz: 2000 }));
  for (const fz of [1000, 999, 1.5, '2000']) assert.equal(claimsValid({ ...base, fz }), false, String(fz));
  const order = { s: 'acct-a', i: 1000, e: 1060 };
  assert.ok(orderValid({ o: 'freeze', ...order, fz: 0 }), 'a lift');
  assert.ok(orderValid({ o: 'freeze', ...order, fz: 5000 }));
  assert.ok(orderValid({ o: 'staffline', ...order, sl: 7 }));
  for (const bad of [{ o: 'freeze', ...order }, { o: 'freeze', ...order, fz: -1 }, { o: 'freeze', ...order, fz: 5, mu: 5 }, { o: 'staffline', ...order, sl: 0 }, { o: 'staffline', ...order, sl: 1, fz: 1 }, { o: 'mute', ...order, mu: 5, fz: 5 }, { o: 'ban', ...order, bn: 5, sl: 5 }]) assert.equal(orderValid(bad), false, JSON.stringify(bad));
  assert.deepEqual([...STAFF_ORDER_KINDS], ['freeze', 'staffline']);
  const hello = (fv) => parseClient(JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'secret-of-mac-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, fv }), { hasHello: false });
  assert.equal(hello(1).fv, 1);
  for (const v of [undefined, 0, 2, '1', true]) assert.equal(hello(v).fv, undefined, String(v));
  assert.ok(CHAT_LINE_CHANNELS.includes('staff'));
  assert.deepEqual(parseClient('{"t":"chat","ch":"staff","text":"12"}', { hasHello: true }), { t: 'chat', text: '12', ch: 'staff' });
});

test('STAFF-PANEL5-FREEZE THE SERVICE\'S DOOR: a signed freeze reaches the hub - its account\'s sockets told `frozen` and held, an old build\'s closed with the reload words; the book is stored and outlives a wake, so a token minted before the order is frozen at its hello, and a lift newer than a token\'s freeze lets it in; a forged order wakes nothing, an older one changes nothing, and a client cannot carry one (mutants: the door\'s kinds; the hand-only kinds; the book unread at the hello; the book unsaved; the old build kept; an older order applied)', async (t) => {
  const S = await stand(t);
  const troll = await S.join(S.hub, 'trol-0001');
  const old = await S.join(S.hub, 'oldy-0001', { fv: undefined });
  const bob = await S.join(S.hub, 'bobb-0001');
  S.tick(2000);
  const until = S.nowS() + 3600;
  // a forged order: refused at the Worker, nothing woken
  const lonely = fakeRooms();
  const forged = await mintFreezeOrder({ s: 'acct-trol-0001', fz: until }, (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey, { subtle, nowS: S.nowS() });
  assert.equal((await S.door(forged, { ROOMS: lonely.ROOMS, IDENTITY_PUBLIC_KEY: S.hub.env.IDENTITY_PUBLIC_KEY })).status, 403);
  assert.equal(lonely.made.size, 0, 'a forged order wakes no room');
  // a client cannot carry a freeze in (the ban frame's door takes bans alone)
  const carried = await mintFreezeOrder({ s: 'acct-bobb-0001', fz: until }, S.kp.privateKey, { subtle, nowS: S.nowS() });
  await S.say(S.hub, troll, { t: 'ban', order: carried });
  assert.equal(S.hub.room._attach(bob).fz, undefined, 'a freeze carried by a client is no order');
  assert.equal((await S.freeze('acct-trol-0001', until)).status, 200);
  assert.deepEqual(of(troll, 'frozen'), [{ t: 'frozen', until }]);
  assert.equal(troll.att.fz, until);
  assert.equal(troll.closed, null, 'a build that shows the freeze screen stays, frozen');
  assert.equal(of(bob, 'frozen').length, 0, 'another account is not touched');
  assert.equal(S.hub.store.get(FREEZES_KEY)['acct-trol-0001'][1], until, 'the book stored');
  assert.equal((await S.freeze('acct-oldy-0001', until)).status, 200);
  assert.deepEqual(of(old, 'frozen'), [{ t: 'frozen', until }], 'an old build is told first');
  assert.match(of(old, 'error').at(-1)?.m ?? '', RELOAD, 'then the reload words');
  assert.deepEqual(old.closed, { code: CLOSE_POLICY, reason: FREEZE_OLD_REASON });
  // the hub's lease carries it
  await S.say(S.hub, troll, { t: 'lease' });
  assert.equal((await readLease(of(troll, 'lease').at(-1).l, S.key, { subtle, nowS: S.nowS() })).fz, until);
  // an older order changes nothing
  assert.equal((await S.freeze('acct-trol-0001', 0, S.nowS() - 30)).status, 200);
  assert.equal(troll.att.fz, until, 'an older lift lifts nothing');
  // a wake: the book read back, and a token minted before the order (no `fz` in it) frozen at its hello
  await quiet(() => S.hub.drop(troll));
  S.hub.wake();
  const oldBack = await S.join(S.hub, 'oldy-0002', { tokenSub: 'acct-oldy-0001', fv: undefined });
  assert.match(of(oldBack, 'error').at(-1)?.m ?? '', RELOAD, 'an old build frozen at its hello: refused');
  assert.equal(oldBack.closed?.reason, FREEZE_OLD_REASON);
  const back = await S.join(S.hub, 'trol-0003', { tokenSub: 'acct-trol-0001' });
  assert.equal(S.hub.room._attach(back).fz, until, 'a reload sheds no freeze');
  assert.deepEqual(of(back, 'frozen'), [{ t: 'frozen', until }], 'and it is told so');
  // the lift: told, held no more, and a token that still says `fz` (minted before the lift) is let in unfrozen
  S.tick(2000);
  assert.equal((await S.freeze('acct-trol-0001', 0)).status, 200);
  assert.deepEqual(of(back, 'frozen').at(-1), { t: 'frozen', until: 0 });
  assert.equal(back.att.fz, 0);
  await quiet(() => S.hub.drop(back));
  S.tick(1000);
  const stale = await S.join(S.hub, 'trol-0005', { tokenSub: 'acct-trol-0001', fz: until });
  assert.equal(stale.closed, null);
  assert.equal(S.hub.room._attach(stale).fz, undefined, 'the lift is the newer word');
  // a token's own freeze, with no order heard: frozen at its hello in any room
  const cold = await S.join(S.cell, 'cold-0001', { fz: until });
  assert.equal(S.cell.room._attach(cold).fz, until);
  const coldOld = await S.join(S.cell, 'cold-0002', { fz: until, fv: undefined });
  assert.equal(coldOld.closed?.reason, FREEZE_OLD_REASON, 'an old build\'s frozen token: refused at the hello');
});

test('STAFF-PANEL5-FREEZE A MODDED CLIENT THAT IGNORES ITS FREEZE SCREEN is heard in nothing but its camera (where it stood, its yaw new), its ping and its lease: no step, no line, no trade, no duel, no world; and every socket\'s trade or duel word aimed at a frozen one is refused, out of every fight (mutants: the gate gone; the camera kept whole; the aim unread)', async (t) => {
  const S = await stand(t);
  const ear = await S.join(S.cell, 'ear-0001');
  const ice = await S.join(S.cell, 'ice-0001');
  const bob = await S.join(S.cell, 'bob-0001');
  await S.say(S.cell, ice, { t: 'lease', l: await S.lease({ s: 'acct-ice-0001', fz: S.nowS() + 3600 }) });   // STAFF-PANEL5-FREEZE-FIX: frozen where it stands (a frozen hello stands nowhere of its own)
  S.tick(1000);
  const heard = ear.sent.length;
  await S.say(S.cell, ice, { t: 'pose', p: { ...P0, x: P0.x + 400, yaw: 1.5, pitch: 0.25, mv: 2, wd: 1, an: 9 } });
  await S.say(S.cell, ice, { t: 'chat', text: 'let me go' });
  await S.say(S.cell, ice, { t: 'trade', data: { to: 'ear-0001', k: 'ask', s: 'abcdef12' } });
  await S.say(S.cell, ice, { t: 'duel', data: { to: 'ear-0001', k: 'ask', s: 'abcdef12' } });
  await S.say(S.cell, ice, { t: 'world', data: { a: 1 } });
  const got = ear.sent.slice(heard);
  assert.deepEqual(got.map((f) => f.t), ['pose'], JSON.stringify(got));
  assert.deepEqual([got[0].p.x, got[0].p.z, got[0].p.yaw, got[0].p.pitch, got[0].p.mv ?? 0, got[0].p.wd ?? 0, got[0].p.an ?? 0], [P0.x, P0.z, 1.5, 0.25, 0, 0, 0], 'its camera alone, where it stood');
  await S.say(S.cell, ice, { t: 'ping' });
  assert.deepEqual(ice.sent.at(-1), { t: 'pong' });
  // aimed at it: refused; at anyone else: as ever
  const iceHeard = ice.sent.length;
  await S.say(S.cell, ear, { t: 'trade', data: { to: 'ice-0001', k: 'ask', s: 'abcdef12' } });
  await S.say(S.cell, ear, { t: 'duel', data: { to: 'ice-0001', k: 'ask', s: 'abcdef13' } });
  assert.deepEqual(ice.sent.slice(iceHeard).filter((f) => f.t === 'trade' || f.t === 'duel'), [], 'nothing aimed at a frozen socket reaches it');
  await S.say(S.cell, ear, { t: 'trade', data: { to: 'bob-0001', k: 'ask', s: 'abcdef14' } });
  assert.equal(of(bob, 'trade').length, 1, 'the control: a trade to anyone else goes');
  // the gate itself, an arena bout's blow while the other fighter is frozen
  const nowS = Math.floor(Date.now() / 1000);
  const fake = { _all: () => new Map([['f', { af: 1, fz: nowS + 60 }]]), _byId: () => new Map() };
  assert.equal(frozenFrame(fake, { af: 1 }, { t: 'arena', k: 'hit' }), true, 'dropped');
  assert.equal(frozenFrame({ ...fake, _all: () => new Map([['f', { af: 1 }]]) }, { af: 1 }, { t: 'arena', k: 'hit' }), false);
  assert.equal(frozenFrame(fake, { fz: nowS + 60 }, { t: 'pose', p: P0 }), true, 'a camera with no pose to stand in: nothing');
  assert.equal(frozenFrame(fake, { fz: nowS }, { t: 'chat', text: 'x' }), false, 'at its end, heard');
  assert.equal(frozenFrame(fake, { fz: nowS + 60 }, { t: 'chat', ch: 'staff', text: '1', me: true }), true, 'an action is no nudge');
});

test('STAFF-PANEL5-FREEZE NEVER THE HOST: a freeze landing on a room\'s host moves the seat on and says it, its world refused; lifted (a lease saying it run out, or lifted), the seat comes back and is said; a frozen socket alone holds no seat (mutants: the walk\'s bar; the lead\'s bar; the seat unsaid; a lapsed freeze said still standing)', async (t) => {
  const S = await stand(t);
  const ice = await S.join(S.cell, 'ice-0001', { ls: 1 });
  const ear = await S.join(S.cell, 'ear-0001', { ls: 1 });
  assert.equal(S.cell.room._hostOf(), 'ice-0001', 'the eldest');
  S.tick(1000);
  const fz = S.nowS() + 600;
  await S.say(S.cell, ice, { t: 'lease', l: await S.lease({ s: 'acct-ice-0001', fz }) });
  assert.equal(S.cell.room._hostOf(), 'ear-0001', 'the seat moved on');
  assert.deepEqual(of(ear, 'host').at(-1), { t: 'host', id: 'ear-0001' }, 'and was said');
  assert.equal(S.cell.room._leads(S.cell.room._attach(ice)), false);
  // the freeze runs out: the hub's next lease says so (fz 0 - its mint never names a freeze past its end), and the seat comes back
  S.tick(601_000);
  assert.equal(seatBarred(S.cell.room._attach(ice)), true, 'run out, but no word yet: still barred - no seat moves unsaid');
  await S.say(S.cell, ice, { t: 'lease', l: await S.lease({ s: 'acct-ice-0001', fz: 0 }) });
  assert.equal(S.cell.room._hostOf(), 'ice-0001');
  assert.deepEqual(of(ear, 'host').at(-1), { t: 'host', id: 'ice-0001' });
  // the hub's mint: a freeze past its end is said lifted
  const hubIce = await S.join(S.hub, 'ice-0001');
  S.hub.room._setAttach(hubIce, { ...S.hub.room._attach(hubIce), fz: S.nowS() - 1 });
  await S.say(S.hub, hubIce, { t: 'lease' });
  assert.equal((await readLease(of(hubIce, 'lease').at(-1).l, S.key, { subtle, nowS: S.nowS() })).fz, 0);
  // alone and frozen: no seat
  const lone = fakeRoom('dungeon:m4242');
  const w = lone.connect();
  await quiet(() => lone.hello(w, 'lone-0001', null, { fv: 1, fz: Math.floor(Date.now() / 1000) + 600 }));
  assert.equal(lone.room._hostOf(), null);
});

test('STAFF-PANEL5-FREEZE THE STAFF CHANNEL: a frozen player\'s nudge (its line\'s id, never its words) reaches the thread\'s members alone - its own sockets and the staff sockets online - never another player; a player in no thread says nothing; a staff line\'s signed order joins its player and nudges them; MUTED AND FROZEN the staff channel still opens, and only it; a roll, a line\'s words or a cell are no nudge (mutants: the members; the join; the mute\'s pass; the words carried; the cell let in)', async (t) => {
  const S = await stand(t);
  const until = S.nowS() + 3600;
  const troll = await S.join(S.hub, 'trol-0001', { fz: until, mu: until });
  const staff = await S.join(S.hub, 'staf-0001', { hd: 1, glyphs: ['mod'] });   // STAFF-PANEL5-FREEZE-FIX: a staff session's hidden token, through a real hello
  assert.deepEqual([S.hub.room._attach(staff).hid, S.hub.room._attach(staff).hd], [1, undefined], 'the relay marks it `hid`, never `hd`');
  const bob = await S.join(S.hub, 'bobb-0001');
  const amy = await S.join(S.hub, 'amyy-0001', { mu: until });
  S.tick(1000);
  const nudges = (ws) => of(ws, 'chat').filter((f) => f.ch === 'staff');
  await S.say(S.hub, troll, { t: 'chat', ch: 'staff', text: '41' });
  const [n] = nudges(staff);
  assert.deepEqual({ ...n, at: 0 }, { t: 'chat', ch: 'staff', th: 'acct-trol-0001', sl: 41, id: 'trol-0001', name: 'trol-0001', at: 0 }, 'the nudge: the thread and the line, no words');
  assert.equal(nudges(troll).length, 1, 'its own sockets hear it (the receipt)');
  assert.equal(nudges(bob).length, 0, 'nobody else');
  assert.equal(of(troll, 'muted').length, 0, 'muted and frozen: the staff channel passes the mute');
  S.tick(1000);   // each line inside the chat gate (CHAT_HZ_MAX)
  await S.say(S.hub, troll, { t: 'chat', text: 'world, help' });
  await S.say(S.hub, troll, { t: 'chat', ch: 'guild', text: 'guild, help' });
  assert.equal(of(bob, 'chat').length, 0, 'every other channel shut');
  assert.equal(of(troll, 'muted').length, 0, 'frozen: dropped at the gate, before the mute is asked');
  S.tick(1000);
  await S.say(S.hub, troll, { t: 'chat', ch: 'staff', text: 'my words' });
  await S.say(S.hub, troll, { t: 'roll', ch: 'staff', n: 1, m: 6, k: 0 });
  assert.equal(nudges(staff).length, 1, 'words or a roll are no nudge');
  // a player in no thread says nothing; a staff line's order joins them
  await S.say(S.hub, amy, { t: 'chat', ch: 'staff', text: '42' });
  assert.equal(nudges(staff).length, 1, 'no thread: nothing');
  assert.equal((await S.door(await mintStaffLineOrder({ s: 'acct-amyy-0001', sl: 43 }, S.kp.privateKey, { subtle, nowS: S.nowS() }))).status, 200);
  assert.deepEqual(nudges(amy).map((f) => [f.th, f.sl, f.st]), [['acct-amyy-0001', 43, 1]], 'the staff line\'s nudge to its player');
  assert.equal(nudges(staff).at(-1).sl, 43, 'and to staff');
  assert.equal(nudges(bob).length, 0);
  await S.say(S.hub, amy, { t: 'chat', ch: 'staff', text: '44' });
  assert.equal(nudges(staff).at(-1).sl, 44, 'joined: her nudge reaches staff - muted, all the same');
  S.tick(1000);
  await S.say(S.hub, amy, { t: 'chat', text: 'still muted elsewhere' });
  assert.equal(of(amy, 'muted').length, 1, 'and only there');
  // a cell is no place for the staff channel
  const ice = await S.join(S.cell, 'ice-0001', { fz: until });
  const had = nudges(staff).length;
  await S.say(S.cell, ice, { t: 'chat', ch: 'staff', text: '45' });
  assert.equal(nudges(staff).length, had, 'nothing from a cell');
  assert.equal(nudges(ice).length, 0, 'nor back to its own socket there');
  // the order's own shape: verified as its kind
  const so = await mintStaffLineOrder({ s: 'acct-amyy-0001', sl: 9 }, S.kp.privateKey, { subtle, nowS: S.nowS() });
  assert.ok((await verifyOrder(so, (await S.hub.room._loadKey(), S.hub.room._verifyKey), { subtle, nowS: S.nowS(), kind: 'staffline' })).ok);
  assert.equal((await S.door(await mintOrder({ s: 'acct-bobb-0001', mu: until }, S.kp.privateKey, { subtle, nowS: S.nowS() }))).status, 200, 'the door\'s own kinds as ever');
});

test('STAFF-PANEL5-FREEZE THROUGH THE SHARDS: the bus\'s freeze reaches the player\'s hub shard (SHARD_LAW_KEYS) and its lease; a shard\'s hello whose token is older than the bus\'s book is frozen by the bus, and an old build\'s refused; STAFF-PANEL5-FREEZE-FIX: a lease asked at once on a fresh shard hello is the bus\'s, frozen (mutants: the bus\'s book unread at a shard\'s hello; the shard minting its own)', async (t) => {
  let clock = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => clock);
  const secret = await GATE;
  await quiet(async () => {
    const W = fakeRooms({ now: () => clock });
    const room = (k) => { const r = W.room(k); r.env.GATE_SIGNING_KEY = secret; return r; };
    const bus = room(CHAT_WORLD_ROOM);
    const settle = async () => {
      for (let i = 0; i < 6; i++) {
        for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
        for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
        for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
      }
    };
    const sub = 'acct-p0';
    const R = room(H.hubOfSubject(sub));
    const link = async (n, extra = {}) => {
      const ws = R.connect();
      clock += 30;
      await R.hello(ws, `peer-${n}`, null, { name: n, acct: sub, asecret: `secret-of-${sub}`, fv: 1, ...extra });
      await settle();
      return ws;
    };
    try {
      const wv = await link('p0');
      // two more tabs' tokens, minted now - before the order
      const early = { b: await R.token('peer-p0b', { s: sub, n: 'p0b' }), c: await R.token('peer-p0c', { s: sub, n: 'p0c' }), d: await R.token('peer-p0d', { s: sub, n: 'p0d' }) };
      clock += 2000;
      const kp = await bus.signer();
      const until = Math.floor(clock / 1000) + 3600;
      const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: await mintFreezeOrder({ s: sub, fz: until }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) }) }) }), { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: bus.env.IDENTITY_PUBLIC_KEY });
      assert.equal(res.status, 200);
      await settle();
      assert.equal(wv.att.fz, until, 'the shard\'s socket holds the bus\'s freeze');
      assert.deepEqual(of(wv, 'frozen'), [{ t: 'frozen', until }]);
      clock += LEASE_FRAME_MIN_MS;
      await R.raw(wv, '{"t":"lease"}');
      await settle();   // STAFF-PANEL5-FREEZE-FIX: the bus's to answer
      assert.equal((await readLease(of(wv, 'lease').at(-1).l, await leaseKeyOf(secret, { subtle }), { subtle, nowS: Math.floor(clock / 1000) })).fz, until, 'and its lease');
      // another tab, its token minted before the order: the bus's book freezes it
      await R.drop(wv); await settle();
      const again = await link('p0b', { tok: early.b });
      assert.equal(again.closed, null, JSON.stringify(again.sent));
      assert.equal(again.att.fz, until, 'the bus\'s book over a shard\'s hello');
      assert.deepEqual(of(again, 'frozen'), [{ t: 'frozen', until }]);
      await R.drop(again); await settle();
      const oldTab = await link('p0c', { tok: early.c, fv: undefined });
      assert.match(of(oldTab, 'error').at(-1)?.m ?? '', RELOAD, 'an old build: the reload words');
      // STAFF-PANEL5-FREEZE-FIX (a review): a fresh hello on the shard, its token minted before the order, asks its lease at
      // once - before the bus's word on it is back down. The shard mints none of its own: the bus answers behind the hello
      // it handed up, with its book's freeze (the shard alone knew only the token's, none)
      await settle();
      const quick = R.connect();
      clock += 30;
      await R.hello(quick, 'peer-p0d', null, { name: 'p0d', acct: sub, asecret: `secret-of-${sub}`, fv: 1, tok: early.d });
      await R.raw(quick, '{"t":"lease"}');
      assert.deepEqual(of(quick, 'lease'), [], 'nothing minted on the shard\'s own word');
      await settle();
      const quickLease = of(quick, 'lease').at(-1)?.l;
      assert.ok(quickLease, 'the bus answered it');
      assert.equal((await readLease(quickLease, await leaseKeyOf(secret, { subtle }), { subtle, nowS: Math.floor(clock / 1000) })).fz, until, 'frozen, as the bus holds it');
    } finally {
      for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
    }
  });
});

const lines = (ws) => of(ws, 'chat').map((f) => f.text);

test('STAFF-PANEL5-FREEZE-FIX A SILENT BUS STOPS NO LEASE (round two, a review: a hub shard\'s lease is its bus\'s to mint, so with the bus down no shard minted one, and within a lease\'s life every bound socket in every room but the hub\'s was heard in nothing): the bus not taking a hand-up, the lease ask it carried is answered by the shard - a PASS off its own attachment, its freeze in it, once however often the hand-up is tried again - and an ask said while the bus is silent is answered at once and never handed up; with the door on, a cell hears its socket again behind a pass, its freeze held; a fresh hello\'s pass, its token from before the freeze the bus\'s book holds, lifts nothing (finding 25); and the bus back, the next ask is the bus\'s again (mutants: the shard waiting on its bus; the miss unanswered; a pass on every try; a pass unmarked; a pass the newer word; a pass read as any lease; a pass for a frame not an ask)', async (t) => {
  let clock = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => clock);
  const secret = await GATE;
  const key = await leaseKeyOf(secret, { subtle });
  const read = (l) => readLease(l, key, { subtle, nowS: Math.floor(clock / 1000) });
  await quiet(async () => {
    const W = fakeRooms({ now: () => clock });
    const room = (k) => { const r = W.room(k); r.env.GATE_SIGNING_KEY = secret; return r; };
    const bus = room(CHAT_WORLD_ROOM);
    const settle = async () => {
      for (let i = 0; i < 6; i++) {
        for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
        for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
        for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
      }
    };
    const sub = 'acct-p0';
    const R = room(H.hubOfSubject(sub));
    const cell = room(CELL);
    cell.env.LEASE_DOOR = 'on';
    const ask = async (ws) => { clock += LEASE_FRAME_MIN_MS; await R.raw(ws, '{"t":"lease"}'); };
    const hub = async (n, extra = {}) => { const ws = R.connect(); clock += 30; await R.hello(ws, `peer-${n}`, null, { name: n, acct: sub, asecret: `secret-of-${sub}`, fv: 1, ...extra }); return ws; };
    try {
      const early = await R.token('peer-p0b', { s: sub, n: 'p0b' });   // a second tab's token, minted before the freeze
      const wv = await hub('p0');
      await settle();
      const cs = cell.connect();
      clock += 30;
      await cell.hello(cs, 'peer-p0', P0, { name: 'p0', tokenSub: sub, fv: 1, ls: 1 });
      clock += 2000;
      const kp = await bus.signer();
      const until = Math.floor(clock / 1000) + 3600;
      const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: await mintFreezeOrder({ s: sub, fz: until }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) }) }) }), { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: bus.env.IDENTITY_PUBLIC_KEY });
      assert.equal(res.status, 200);
      await settle();
      await ask(wv);
      await settle();
      const L1 = of(wv, 'lease').at(-1).l;
      assert.deepEqual([(await read(L1)).fz, (await read(L1)).p], [until, undefined], 'the control: the bus\'s lease, frozen');
      await cell.raw(cs, JSON.stringify({ t: 'lease', l: L1 }));
      assert.equal(cell.room._attach(cs).fz, until, 'the cell took it');
      // THE BUS GOES SILENT
      const real = bus.room.fetch.bind(bus.room);
      bus.room.fetch = async () => new Response('down', { status: 503 });
      await R.raw(wv, JSON.stringify({ t: 'chat', text: 'lease' }));   // a line in the same hand-up, its words "lease": no ask
      await ask(wv);
      const n = of(wv, 'lease').length;
      await settle();
      assert.equal(of(wv, 'lease').length, n + 1, 'the hand-up missed: its ask answered by the shard');
      const P1 = await read(of(wv, 'lease').at(-1).l);
      assert.deepEqual([P1.p, P1.fz, P1.s], [1, until, sub], 'a pass, the freeze the shard holds in it');
      clock += 5000;
      await settle();
      clock += 5000;
      await settle();
      assert.equal(of(wv, 'lease').length, n + 1, 'tried again and again, one pass');
      await ask(wv);
      assert.equal(of(wv, 'lease').length, n + 2, 'asked while the bus is silent: a pass at once');
      assert.equal((await read(of(wv, 'lease').at(-1).l)).p, 1);
      assert.ok(!R.room._up.some((ev) => ev[1] === 'f' && ev[2] === '{"t":"lease"}'), 'and never handed up');
      // the cell, its door on: the bus's lease lapsed, its socket is heard in nothing; behind a pass, heard - frozen still
      clock += 95_000;
      cell.room._setAttach(cs, { ...cell.room._attach(cs), ld: Math.floor(clock / 1000) - 1 });   // HIBERNATE: LEASE_LIFE_S (300) outlives a token's MAX_TTL_S, so the bus's lease is lapsed by hand - the early token below must still be live
      await cell.raw(cs, JSON.stringify({ t: 'pose', p: { ...P0, yaw: 1 } }));
      assert.notEqual(cell.room._attach(cs).pose?.yaw, 1, 'the control: lapsed, unheard');
      await ask(wv);
      const P2 = of(wv, 'lease').at(-1).l;
      assert.equal((await read(P2)).p, 1);
      await cell.raw(cs, JSON.stringify({ t: 'lease', l: P2 }));
      assert.equal(cell.room._attach(cs).ld, (await read(P2)).u, 'the pass renews its life');
      clock += 1000;
      await cell.raw(cs, JSON.stringify({ t: 'pose', p: { ...P0, x: P0.x + 500, yaw: 2 } }));
      assert.equal(cell.room._attach(cs).pose?.yaw, 2, 'heard behind the pass');
      assert.equal(cell.room._attach(cs).pose?.x, P0.x, 'frozen still: its camera alone');
      // FINDING 25 KEPT: a fresh hello on the shard, its token from before the freeze, the bus's book out of reach - its pass
      // says no freeze, and lifts none (its first tab let go: one seat an account)
      await R.drop(wv);
      const fresh = await hub('p0b', { tok: early });
      assert.ok(!(fresh.att.fz > 0), 'the shard alone knows the token\'s word: no freeze');
      await ask(fresh);
      const P3 = of(fresh, 'lease').at(-1)?.l;
      assert.deepEqual([(await read(P3)).p, (await read(P3)).fz], [1, 0], 'a pass, unfrozen');
      clock += LEASE_FRAME_MIN_MS;
      await cell.raw(cs, JSON.stringify({ t: 'lease', l: P3 }));
      assert.equal(cell.room._attach(cs).fz, until, 'the pass lifts nothing the cell heard');
      // THE BUS BACK: the next ask is the bus's to answer again, from its book
      bus.room.fetch = real;
      clock += 2000;
      await settle();
      assert.equal(R.room._upRetry, null, 'the hand-up landed');
      const m = of(fresh, 'lease').length;
      await ask(fresh);
      assert.equal(of(fresh, 'lease').length, m, 'nothing minted on the shard\'s own word');
      await settle();
      const L2 = await read(of(fresh, 'lease').at(-1).l);
      assert.deepEqual([L2.p, L2.fz], [undefined, until], 'the bus\'s lease, its book\'s freeze');
    } finally {
      for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); clearTimeout(r.room._pollT); }
    }
  });
});

test('STAFF-PANEL5-FREEZE-FIX EVERY ROOM BUT THE HUB IS A LEASE ROOM (a review: a freeze or a lift never reached a home, a caravan, a siege, an arena, a gate, a breach or a Super dungeon realm): in a caravan the hub\'s lease freezes a socket already there and lifts one its token froze; with the door on, a build that hands on no lease is refused there, and a bound socket is heard in nothing until its lease (mutants: the old lease rooms)', async (t) => {
  for (const key of ['owned:0123456789abcdef0123456789abcdef', caravanRoomOf('0123456789abcdef01234567'), 'siege:7:2900', 'royal:1:2900', 'arena:hall', 'arena:b42', 'gate:20260101', 'eg:0123456789abcdef', 'sd:3', CELL, 'dungeon:m123', 'chat:trade']) assert.equal(leaseRoom(key), true, key);
  for (const key of [CHAT_WORLD_ROOM, H.hubOfSubject('acct-ice-0001'), null, undefined]) assert.equal(leaseRoom(key), false, String(key));
  const S = await stand(t);
  const VAN = /** @type {string} */ (caravanRoomOf('0123456789abcdef01234567'));
  const van = S.room(VAN);
  const ear = await S.join(van, 'ear-0001', { ls: 1 });
  const ice = await S.join(van, 'ice-0001', { ls: 1 });
  S.tick(1000);
  await S.say(van, ice, { t: 'chat', text: 'before' });
  assert.ok(lines(ear).includes('before'), 'the control: heard');
  // frozen while it stands there: the hub's next lease, handed on, holds it
  const fz = S.nowS() + 600;
  await S.say(van, ice, { t: 'lease', l: await S.lease({ s: 'acct-ice-0001', fz }) });
  assert.equal(van.room._attach(ice).fz, fz, 'the caravan took the freeze');
  S.tick(1000);
  await S.say(van, ice, { t: 'chat', text: 'frozen line' });
  assert.ok(!lines(ear).includes('frozen line'), 'and hears nothing it says');
  // the mirror: a socket its token froze, lifted by the hub's newer lease
  const icy = await S.join(van, 'icy-0001', { ls: 1, fz });
  assert.equal(van.room._attach(icy).fz, fz);
  S.tick(2000);
  await S.say(van, icy, { t: 'lease', l: await S.lease({ s: 'acct-icy-0001', fz: 0 }) });
  S.tick(1000);
  await S.say(van, icy, { t: 'chat', text: 'thawed' });
  assert.ok(lines(ear).includes('thawed'), 'a lift reaches it');
  // the door on: no lease, no caravan
  const shut = S.room(/** @type {string} */ (caravanRoomOf('fedcba9876543210fedcba98')));
  shut.env.LEASE_DOOR = 'on';
  const old = await S.join(shut, 'oldy-0001');
  assert.equal(old.closed?.reason, LEASE_OLD_REASON, 'a build that hands on no lease is turned away');
  const bound = await S.join(shut, 'bnd-0001', { ls: 1 });
  const peer = await S.join(shut, 'per-0001', { ls: 1 });
  S.tick(1000);
  await S.say(shut, bound, { t: 'chat', text: 'unleased' });
  assert.ok(!lines(peer).includes('unleased'), 'bound, with no lease: heard in nothing');
  await S.say(shut, bound, { t: 'lease', l: await S.lease({ s: 'acct-bnd-0001', fz: 0 }) });
  await S.say(shut, bound, { t: 'chat', text: 'leased' });
  assert.ok(lines(peer).includes('leased'));
});

test('STAFF-PANEL5-FREEZE-FIX A FROZEN HELLO TAKES NO STEP (a review: a frozen client that said hello again elsewhere was seen standing there): its reconnect in the cell stands where its socket there stood; its hello in another cell stands nowhere, and its camera with it; a frozen token\'s first hello the same (mutant: the hello\'s pose taken)', async (t) => {
  const S = await stand(t);
  const fz = S.nowS() + 3600;
  const ear = await S.join(S.cell, 'ear-0001');
  const ice = await S.join(S.cell, 'ice-0001');
  S.tick(1000);
  await S.say(S.cell, ice, { t: 'pose', p: { ...P0, mv: 2 } });
  assert.equal(S.cell.room._attach(ice).pose?.mv, 2, 'walking when the freeze lands');
  await S.say(S.cell, ice, { t: 'lease', l: await S.lease({ s: 'acct-ice-0001', fz }) });
  S.tick(1000);
  const back = S.cell.connect();
  S.tick(300);
  await quiet(() => S.cell.hello(back, 'ice-0001', { ...P0, x: P0.x + 1200, z: P0.z + 40 }, { fv: 1, fz }));
  assert.equal(back.closed, null);
  const pose = S.cell.room._attach(back).pose;
  assert.deepEqual([pose?.x, pose?.z, pose?.mv ?? 0], [P0.x, P0.z, 0], 'where it stood, not where its hello said');
  const joins = of(ear, 'join').filter((f) => f.id === 'ice-0001');
  assert.deepEqual([joins.at(-1)?.pose?.x, joins.at(-1)?.pose?.z], [P0.x, P0.z], 'and the room was told so');
  // another cell, where it stood nowhere: nowhere
  const far = S.room(cellRoomOfWire(P0.x + 40 * PIXEL_UNITS, P0.z));
  const farEar = far.connect();
  S.tick(300);
  await quiet(() => far.hello(farEar, 'fear-0001', { ...P0, x: P0.x + 40 * PIXEL_UNITS }, { fv: 1 }));
  const away = far.connect();
  S.tick(300);
  await quiet(() => far.hello(away, 'ice-0002', { ...P0, x: P0.x + 40 * PIXEL_UNITS + 50 }, { fv: 1, fz, tokenSub: 'acct-ice-0001' }));
  assert.equal(far.room._attach(away).pose, null, 'stands nowhere');
  assert.equal(of(farEar, 'join').find((f) => f.id === 'ice-0002')?.pose ?? null, null, 'and is said nowhere');
  S.tick(1000);
  const heard = farEar.sent.length;
  await S.say(far, away, { t: 'pose', p: { ...P0, x: P0.x + 40 * PIXEL_UNITS + 50, yaw: 1 } });
  assert.deepEqual(farEar.sent.slice(heard).filter((f) => f.t === 'pose'), [], 'its camera has no place to stand in');
  // the control: an unfrozen hello stands where it says
  const free = far.connect();
  S.tick(300);
  await quiet(() => far.hello(free, 'free-0001', { ...P0, x: P0.x + 40 * PIXEL_UNITS + 60 }, { fv: 1 }));
  assert.equal(far.room._attach(free).pose?.x, P0.x + 40 * PIXEL_UNITS + 60);
});
