// EG-ZM (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 22 - the EG-ZD departure it retires): THE RETURN'S SEED. A way back
// the device knows only from the account service's word (no seed, no opening, no hall) holds its step under the veil until
// the room's first word - a listener on my own identity (scenes/eliteGates/egClient.js egSeedListen: the real net/online.js
// OnlineSession, no presence) says hello to the breach's REAL room (test/fakeRoom.mjs - its sockets bridged to the
// session's WebSocket), and the circle stood is the one the room's `st` says, never circle 1 of seed 0. A room that refuses
// the hello lets the way back go in its words; a refusal that is not the room's keeps it; silence past
// EG_BACK_SEED_WAIT_MS opens the veil where I stood and says so; the online frame gone ends the wait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../../fakeRoom.mjs';
import { EG_INTERNAL_OPEN, validEgOut, validEgIn, EG_BRAIN_V } from '../../../src/net/wire.js';
import { egRoomKey, egStartHall, egCircleOfHall, EG_SEALED_MS, EG_TEXT, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { OnlineSession, TOKEN_WAIT_MS } from '../../../src/net/online.js';
import { createEgClient, egBackOf, egSeedListen, EG_BACK_KEY, EG_BACK_TEXT, EG_BACK_SEED_WAIT_MS } from '../../../src/scenes/eliteGates/egClient.js';
import { egGeo } from '../../../src/net/eliteGates/egBrain.js';
import { readFileSync } from 'node:fs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef';
const ME = 'acct-mac';
const SEED = 4242;
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const EW = 1;   // a breach begun at Redoubt 1 - its first hall Hall 6, circle 2 (a seedless record's own guess is circle 1)
const WG = [EG_DECREE_BY_KEY.crumbling.id];   // a Wager that moves the halls' geometry (net/eliteGates/egLaw.js egGeoOf - a record's guess is 0)
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const tick = () => new Promise((r) => setImmediate(r));
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

/**
 * THE STAGE: a breach's room opened by its own internal door (company `co`, begun at Redoubt EW with the Wager WG), and my
 * client between it and an account service whose keys answer names it live. `bridge` is the WebSocket a session opens -
 * each one a socket of the real room (its sends the room's messages in, the room's sends and closes the session's
 * events); `deaf` a WebSocket that never opens. `listener(o)` the session class the client's way back is made of.
 */
async function stage(t, { co = [[ME, 'Mac', 1], ['acct-ann', 'Ann', 2]], opener = ME, mint = null, url = 'wss://relay.test' } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });   // the session's token race (TOKEN_WAIT_MS) held, never a real eight seconds
  let clock = T0;
  t.mock.method(Date, 'now', () => clock);
  const eg = fakeRoom(egRoomKey(B), { now: () => clock });
  const said = [], asked = { enter: [], exits: 0, looks: [], admit: [] };
  const pending = [];
  const entity = { level: 20, health: 90, maxHealth: 100, magicka: 0, maxMagicka: 40, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(SITE.x, 0, SITE.z) };
  let mode = 'exterior', hall = null, ws = null, seen = 0;
  const modes = {
    get mode() { return mode; }, get stepping() { return false; },
    egHallBreach: () => (mode === 'dungeon' && hall ? hall.b : null),
    egHallCircle: () => (mode === 'dungeon' && hall ? hall.c : null),
    stepThroughFire: async (go, look) => { asked.looks.push(look); return go(); },
    enterEgHall: (r) => { if (mode !== 'exterior') return false; asked.enter.push({ ...r, socketsAt: eg.sockets.length }); mode = 'dungeon'; hall = r; player.pos = realmToDungeon(0, 0, 1.5); return true; },
    egPlace: (at) => { player.pos = [...at]; return true; },
    egLeave: () => { mode = 'exterior'; hall = null; return true; },
    egHallReturn: () => null,
    forceExitToExterior: () => { asked.exits++; mode = 'exterior'; hall = null; },
    get dungeonCtx() { return mode === 'dungeon' ? { exitDoors: [] } : null; },
  };
  // the room's sockets, bridged to a session's own WebSocket
  const bridged = [];
  class Bridge {
    constructor(url) {
      this.url = url; this.sent = []; this.closed = null;
      const rws = eg.connect(), send = rws.send.bind(rws), shut = rws.close.bind(rws);
      rws.send = (s) => { send(s); setImmediate(() => this.onmessage?.({ data: s })); };
      rws.close = (code, reason) => { shut(code, reason); setImmediate(() => this.onclose?.({ code, reason })); };
      this.rws = rws;
      bridged.push(this);
      setImmediate(() => this.onopen?.());
    }
    send(s) { this.sent.push(JSON.parse(s)); pending.push(eg.raw(this.rws, s)); }
    close(code, reason) { this.closed = { code, reason }; if (eg.sockets.includes(this.rws)) pending.push(eg.drop(this.rws)); }
  }
  const deafs = [];
  class Deaf { constructor(url) { this.url = url; this.closed = null; deafs.push(this); } send() {} close(code, reason) { this.closed = { code, reason }; } }
  let WSImpl = Bridge;
  class Listener extends OnlineSession { constructor(o) { super({ ...o, WebSocketImpl: WSImpl, now: () => clock }); } }
  let inflight = 0;
  const track = (f) => async (...a) => { inflight++; try { return await f(...a); } finally { inflight--; } };
  const mintRaw = mint ?? (async () => eg.token('peer-mac', { s: ME, n: 'Mac', k: 'linked', cl: 20 }));
  const mintToken = Object.assign(track(mintRaw), { lastWhy: mintRaw.lastWhy });
  const presence = { url, id: 'peer-mac', secret: 'secret-of-peer-mac', name: 'Mac', look: eg.look, mintToken,
    welcomes: 1, terminal: false, error: null,
    sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k, ...(k === 'in' ? { bv: EG_BRAIN_V } : {}) }); if (!w || !ws || mode !== 'dungeon') return false; pending.push(eg.raw(ws, JSON.stringify({ t: 'eg', ...w }))); return true; } };
  const account = {
    me: () => ME, guest: () => false,
    keys: track(async () => ({ ok: true, data: { keys: 1, live: { b: B, until: Math.floor(clock / 1000) + 3 * 3600 } } })),
    // PIN MOVED (AUDIT EG III, lane3 #9 - TEST THE SHAPE THE PRODUCER MINTS): the service signs an admission to its breach's
    // start (server-account/src/eg.js admitEg: the stake's `ew`), and the room now refuses another start's order
    admit: track(async (b) => { asked.admit.push(b); return { ok: true, data: { order: await mintEgOrder({ o: 'egadmit', s: ME, eb: b, ez: 'a'.repeat(20), ew: EW }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) }), b } }; }),
    claim: track(async () => ({ ok: false, error: 'server' })),
  };
  let store = memStore(), client = null;
  const makeClient = (st) => createEgClient({ modes: () => modes, online: () => presence, hub: () => null, account, now: () => clock, entity, player, cam: { pos: [0, 1.6, 0], yaw: 0 },
    say: (x) => said.push(x), site: () => ({ climateBase: 2, season: 0 }), wire: () => SITE, landAt: () => true, hurt: () => {}, store: st, Session: Listener });
  client = makeClient(store);
  const pump = () => { if (!ws) return; for (; seen < ws.sent.length; seen++) { const m = ws.sent[seen]; if (m.t === 'eg') { const v = validEgOut(m); if (v) client.word(v); } } };
  const settle = async () => { for (let q = 0, k = 0; k < 5000 && q < 4; k++) { await tick(); const busy = inflight > 0 || pending.length > 0; await Promise.all(pending.splice(0)); pump(); q = busy ? 0 : q + 1; } };
  const beat = async (ms) => { const end = clock + Math.round(ms); while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); pump(); } clock = end; };
  const frame = async (ms = 300) => { client.frame(); await settle(); if (ws && mode === 'dungeon') { const [x, y, z] = player.pos; await eg.pose(ws, { x, y, z, yaw: 0, pitch: 0 }); } await beat(ms); pump(); await settle(); };
  const enter = async () => { ws = eg.connect(); seen = 0; await eg.hello(ws, 'peer-mac', null, { kind: 'linked', tokenSub: ME, charLevel: 20 }); pump(); await settle(); };
  const reload = async (st = memStore()) => { if (ws) { await eg.drop(ws); ws = null; } seen = 0; mode = 'exterior'; hall = null; player.pos = realmToDungeon(SITE.x, 0, SITE.z); store = st; client = makeClient(st); };
  await quiet(async () => {
    const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B, ez: 'z'.repeat(20), s: opener, o: 'Mac', ew: EW, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: WG }) }));
    assert.equal(res.status, 200);
    clock += EG_SEALED_MS; await beat(1000);
  });
  return { eg, said, asked, bridged, deafs, store: () => store, client: () => client, settle, frame, enter, reload, rec: () => eg.room._eg, now: () => clock, step: (ms) => { clock += ms; }, deaf: () => { WSImpl = Deaf; },
    call: () => validEgOut({ k: 'call', b: B, o: 'Mac', os: ME, seed: SEED, op: T0, rh: 0, co, site: SITE, ew: EW, wg: WG }) };
}

test('EG-ZM THE RETURN\'S SEED, ON THE RELAY (section 22): a page whose device holds no record of my breach - the account service\'s word alone - takes the way back under the veil and holds it there until the room\'s first word: a listener on my own identity (the real session, no presence, no pose) says hello to the breach\'s real room, and the circle stood is the room\'s own - its seed, its hall\'s circle, its geometry - never circle 1 of seed 0; the listener is gone from the room before the circle stands and my own socket says hello; no order is spent and no circle is rebuilt; the record is kept from here (mutants: the room\'s word never waited for; the seed the record\'s; the circle the start\'s; the geometry the record\'s; the listener never left; the record unkept)', async (t) => {
  const P = await stage(t);
  await quiet(async () => {
    // counted by the room first: the call answered in its window, my admission, my first hello
    P.client().word(P.call());
    await P.frame(0);
    P.client().command('');
    await P.settle();
    assert.equal(P.asked.enter.length, 1);
    await P.enter();
    await P.frame(300); await P.frame(300);
    assert.equal(P.rec().mem[ME]?.in, 1, 'counted by the room');
    assert.equal(P.rec().h, egStartHall(EW), 'the company stands in Hall 6');
    const zs = P.rec().zs.length, geo = egGeo(P.rec());
    assert.notEqual(geo, 0, 'the Wager moves the geometry - a record\'s guess of 0 is wrong');
    // ANOTHER DEVICE: no record - the service's word alone
    await P.reload();
    await P.frame(0); await P.frame(0);
    assert.ok(P.said.includes(EG_BACK_TEXT.offer), 'offered on the service\'s word');
    assert.deepEqual(egBackOf(P.store().getItem(EG_BACK_KEY)), null, 'nothing kept yet: the record is the device\'s, and this one has none');
    assert.equal(P.client().useKey(), EG_BACK_TEXT.back);
    await P.settle();
    assert.equal(P.asked.enter.length, 1, 'held under the veil: no circle stands before the room has spoken');
    assert.equal(P.bridged.length, 1, 'the listener\'s one socket');
    const hello = P.bridged[0].sent.find((m) => m.t === 'hello');
    assert.equal(hello.pose, null, 'no presence: the listener stands no body in the breach');
    assert.equal(hello.id, 'peer-mac', 'on my own identity');
    await P.frame(0);
    const E = P.asked.enter.at(-1);
    assert.equal(P.asked.enter.length, 2);
    assert.deepEqual([E.b, E.seed, E.c, E.geo], [B, SEED, egCircleOfHall(egStartHall(EW)), geo], 'the room\'s circle: its seed, Hall 6\'s circle 2, the Wager\'s geometry');
    assert.equal(P.bridged[0].closed?.code, 1000, 'the listener left');
    assert.equal(E.socketsAt, 0, 'gone from the room before the circle stood - my own socket is the one to say hello there');
    assert.ok(P.said.includes(EG_BACK_TEXT.back));
    const kept = egBackOf(P.store().getItem(EG_BACK_KEY));
    assert.deepEqual([kept.b, kept.seed, kept.op, kept.geo, kept.in, kept.h], [B, SEED, T0, geo, 1, egStartHall(EW)], 'the record kept as the room said it');
    // in: no rebuild, no order spent
    await P.enter();
    await P.frame(0); await P.frame(0);
    assert.equal(P.asked.exits, 0, 'never rebuilt: the circle standing is the breach\'s own');
    assert.equal(P.asked.enter.length, 2);
    assert.equal(P.rec().zs.length, zs, 'no order spent: a hello as an entrant');
    assert.ok(P.asked.looks.length >= 2 && P.asked.looks.every((l) => ['egFall', 'egVeil', 'egCut'].includes(l)), `under the stair's veil (${P.asked.looks})`);
  });
});

test('EG-ZM THE RETURN REFUSED, OR UNANSWERED (section 22): a room that refuses the listener\'s hello in its own words lets the way back go - said, marked over on the device, never offered again - and stands no circle; a refusal that is not the room\'s (the relay\'s, for want of a sign-in) keeps the way back and says the road is shut; a room that never answers opens the veil where I stood after EG_BACK_SEED_WAIT_MS and says so, the way back kept and the listener closed; the online frame gone ends the wait at once (mutants: any refusal letting the way back go; the room\'s refusal keeping it; the wait unbounded; silence said as a shut road; the wait outliving the frame)', async (t) => {
  // REFUSED BY THE ROOM: a company I am not in
  let P = await stage(t, { co: [['acct-ann', 'Ann', 1], ['acct-bo', 'Bo', 2]], opener: 'acct-ann' });
  await quiet(async () => {
    await P.frame(0); await P.frame(0);
    assert.ok(P.said.includes(EG_BACK_TEXT.offer));
    P.client().command('');
    await P.settle(); await P.frame(0); await P.settle();
    assert.equal(P.asked.enter.length, 0, 'no circle stands');
    assert.ok(P.said.includes('The breach answers only to its company.'), 'the room\'s own words');
    assert.equal(P.store().getItem(EG_BACK_KEY), JSON.stringify({ b: B, x: 1 }), 'the way back let go, the breach marked over');
    assert.equal(P.client().returnable(), false);
    await P.frame(0);
    assert.equal(P.said.filter((x) => x === EG_BACK_TEXT.offer).length, 1, 'never offered again');
  });
  t.mock.timers.reset();
  t.mock.restoreAll();
  // REFUSED BY THE RELAY (no sign-in): the way back kept
  const noSession = Object.assign(async () => null, { lastWhy: 'no-session' });
  P = await stage(t, { mint: noSession });
  await quiet(async () => {
    await P.frame(0); await P.frame(0);
    P.client().useKey();
    await P.settle(); await P.frame(0); await P.settle();
    assert.equal(P.asked.enter.length, 0);
    assert.ok(P.said.includes(EG_TEXT.shut), 'the road is shut');
    assert.ok(!P.said.some((x) => /sign in/i.test(x)), 'the relay\'s word is not the room\'s');
    assert.equal(egBackOf(P.store().getItem(EG_BACK_KEY))?.b ?? null, null, 'nothing written for it');
    assert.equal(P.client().returnable(), true, 'the way back still offered');
  });
  t.mock.timers.reset();
  t.mock.restoreAll();
  // UNANSWERED: a socket that never opens
  P = await stage(t);
  P.deaf();
  await quiet(async () => {
    await P.frame(0); await P.frame(0);
    P.client().useKey();
    await P.settle();
    P.step(EG_BACK_SEED_WAIT_MS - 1); await P.frame(0);
    assert.equal(P.said.includes(EG_BACK_TEXT.silent), false, 'still waiting a millisecond short of the bound');
    assert.equal(P.deafs[0].closed, null);
    P.step(1); await P.frame(0);
    assert.ok(P.said.includes(EG_BACK_TEXT.silent), 'the silence said');
    assert.ok(!P.said.includes(EG_TEXT.shut), 'not as a shut road');
    assert.equal(P.asked.enter.length, 0, 'the veil opens where I stood');
    assert.ok(P.deafs[0].closed, 'the listener closed');
    assert.equal(P.client().returnable(), true, 'the way back kept - asked again, it waits again');
    assert.equal(P.client().useKey(), EG_BACK_TEXT.back);
    await P.settle();
    assert.equal(P.deafs.length, 2, 'a second listener');
    // THE FRAME GONE (away): the wait ends at once, its listener closed
    P.client().away();
    await P.settle();
    assert.ok(P.deafs[1].closed, 'closed by the frame\'s going');
    assert.equal(P.said.filter((x) => x === EG_BACK_TEXT.silent).length, 2);
    assert.equal(P.asked.enter.length, 0);
  });
  t.mock.timers.reset();
  t.mock.restoreAll();
  // NO SESSION TO LISTEN ON (no relay address): silent at once, no listener made
  P = await stage(t, { url: '' });
  await quiet(async () => {
    await P.frame(0); await P.frame(0);
    P.client().useKey();
    await P.settle();
    assert.ok(P.said.includes(EG_BACK_TEXT.silent), 'said at once, no frame waited on');
    assert.deepEqual([P.bridged.length, P.deafs.length, P.asked.enter.length], [0, 0, 0]);
  });
  // the bound: the session's own wait for its token, and four seconds more
  assert.equal(EG_BACK_SEED_WAIT_MS, TOKEN_WAIT_MS + 4000);
});

test('EG-ZM egSeedListen (scenes/eliteGates/egClient.js): a listener on the session it is handed - its url, id, secret, name, look and minter, presence off - joined to the breach\'s room alone; null while it waits; its answer once (the room\'s `st` folded, of that breach alone; the session\'s terminal word; silence at its bound), the listener left at it; a close leaves it once (mutants: another breach\'s state taken; the answer given twice; presence on; the bound off by one)', () => {
  const made = [];
  class Fake {
    constructor(o) { this.o = o; this.terminal = false; this.error = null; this.left = 0; this.ticks = 0; made.push(this); }
    join(room, pose) { this.room = room; this.pose = pose; }
    leave() { this.left++; }
    tick() { this.ticks++; }
  }
  const main = { url: 'wss://relay.test', id: 'peer-mac', secret: 's3cret', name: 'Mac', look: { race: 'Nord' }, mintToken: () => 'tok', extra: 'never' };
  const L = egSeedListen({ main, b: B, at: 1000, Session: Fake, waitMs: 50 });
  const S = made[0];
  assert.deepEqual(S.o, { url: main.url, id: main.id, secret: main.secret, name: main.name, look: main.look, mintToken: main.mintToken, presence: false });
  assert.deepEqual([S.room, S.pose], [egRoomKey(B), null]);
  assert.equal(L.frame(1049), null, 'waiting');
  assert.equal(S.ticks, 1, 'the session ticked by the frame');
  S.onEg({ k: 'st', b: 'fedcba9876543210', seed: 9, h: 3, co: [], ms: [] }, egRoomKey(B));
  S.onEg({ k: 'sg', b: B }, egRoomKey(B));
  assert.equal(L.frame(1049), null, 'another breach\'s state, and a word that is not the state: nothing');
  S.onEg({ k: 'st', b: B, seed: 7, egv: 4, op: 900, wk: 0, h: 6, sg: 'arrive', co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]], ms: [], geo: 3 }, egRoomKey(B));
  const a = L.frame(1049);
  assert.deepEqual([a.st.b, a.st.seed, a.st.h, a.st.geo, a.st.op], [B, 7, 6, 3, 900], 'the room\'s state, folded');
  assert.equal(S.left, 1, 'left at its answer');
  assert.equal(L.frame(1049), null, 'answered once');
  L.close();
  assert.equal(S.left, 1, 'a close after leaves nothing more');
  // a terminal word, then silence at the bound
  const L2 = egSeedListen({ main, b: B, at: 1000, Session: Fake, waitMs: 50 });
  made[1].terminal = true; made[1].error = 'the breach is closed';
  assert.deepEqual(L2.frame(1001), { no: 'the breach is closed' });
  const L3 = egSeedListen({ main, b: B, at: 1000, Session: Fake, waitMs: 50 });
  assert.equal(L3.frame(1049), null);
  assert.deepEqual(L3.frame(1050), { silent: true }, 'silence at its bound');
  assert.equal(made[2].left, 1);
  L3.close(); L3.close();
  assert.equal(made[2].left, 1);
  // the client's door: the shared refusal law at the room's terminal close and the listener's alike
  const src = rd('src/scenes/eliteGates/egClient.js');
  assert.match(src, /const said = roomRefused\(o\.error\);/, 'a room that refuses me in the breach, by the same law');
});
