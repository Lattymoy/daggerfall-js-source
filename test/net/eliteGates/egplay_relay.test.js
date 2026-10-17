// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 23): THE ELITE BREACH ON THE
// RELAY - the hub opening a breach on the service's signed order (the company frozen from the opener's party, the seed
// drawn, the room opened, the call said), the breach's room admitting its company alone with each member's own signed
// admission (spent once), and its director's beat on the room's alarm: the first hall waking once the company stands on
// its plate, the rifts broken by blows the gate's purse judges, the door, the step through it and the pull to the next
// hall, a death's fall and its end receipt, the wipe. The real Room over fake objects (test/fakeRoom.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../../../server/src/index.js';
import worker from '../../../server/src/index.js';
import { fakeRooms, fakeRoom } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, EG_KEY, egCallKey, validEgOut, validEgIn, EG_KINDS, EG_OUT_KINDS, relaySupportsEg, EG_RELAY_MIN, parseClient } from '../../../src/net/wire.js';
import { EG_VOID_MAX_S } from '../../../src/net/eliteGates/egDurable.js';   // EG-ZA: the tombstone's life
import { egRoomKey, egHallOf, EG_SEALED_MS, EG_GATHER_MS, EG_SPEC } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { readEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
/** A Spire-frame point as a pose in the dungeon's frame. */
const at = (sx, z, extra = {}) => { const [x, y, dz] = realmToDungeon(sx, 0, z); return { x, y, z: dz, yaw: 0, pitch: 0, ...extra }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

/** A hub and a breach opened by `acct-mac` (alone, or with `acct-ann` in its party). */
async function withBreach(fn, { party = false } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const mac = hub.connect(); await hub.hello(mac, 'peer-mac', null, { name: 'Mac', acct: 'acct-mac', asecret: 'secret-of-acct-mac', kind: 'linked' });
      let ann = null;
      if (party) {
        ann = hub.connect(); await hub.hello(ann, 'peer-ann', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', kind: 'linked' });
        await hub.raw(mac, JSON.stringify({ t: 'social', act: 'invite', to: 'acct-ann' }));
        const inv = hub.store.get('acct:acct-ann')?.invites?.[0];
        if (inv) await hub.raw(ann, JSON.stringify({ t: 'social', act: 'join', party: inv.party }));
      }
      const order = await mintEgOrder({ o: 'egopen', s: 'acct-mac', eb: B, ez: 'z'.repeat(20) }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      await hub.raw(mac, JSON.stringify({ t: 'eg', k: 'open', z: order, site: SITE }));
      const eg = world.room(egRoomKey(B));
      const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      const admit = async (sub, ez = 'a'.repeat(20)) => mintEgOrder({ o: 'egadmit', s: sub, eb: B, ez }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      await fn({ world, hub, mac, ann, eg, beat, admit, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('EG-PLAY THE WIRE (EG-FULL): a breach\'s words each way, projected and bounded - the open (its order and the landing), the admission, the door, the way home, a blow on a body by its number, a Vestige picked, a vote, a Cantrip, the Sutler, a ping, a bequest, forsaking, the Orrery\'s turn, a fall said; the call, the state, a stage, the company of ten fields, a fall, a Redoubt, a receipt, the end, a refusal; the fight in the Spire\'s own words (a body\'s eighteen, a blow\'s FULL shape stamp, a zone, a tether, a mark) and the run\'s; a relay before it is sent nothing (mutants: an open with no landing; a company of nine; a stamp out of bounds; a body\'s row cut short)', () => {
  assert.deepEqual([...EG_KINDS], ['open', 'in', 'down', 'home', 'hit', 'pick', 'surplus', 'vote', 'cant', 'buy', 'lping', 'ping', 'bequest', 'forsake', 'pz', 'fell', 'use', 'vt', 'clk', 'spec', 'void', 'claimed', 'heal', 'tonic', 'mast', 'wkpaid']);   // PIN MOVED (AUDIT EG III, lane2 #1): `wkpaid` a Redoubt the service paid already this week (test/net/eliteGates/egaudit3_count.test.js pins it); PIN MOVED (AUDIT EG III lane1 #5): `tonic` a Spire Tonic drunk (test/net/eliteGates/egaudit3_client_tonic.test.js pins it); PIN MOVED (AUDIT EG III): `mast` - Spirebridge asked (test/net/eliteGates/egaudit3_law.test.js pins it); EG-FULL LAYER THREE: `use` - an engine worked; PIN MOVED (EG-H1): `vt` a member's word of its body and `clk` the shared clock's ping (test/net/eliteGates/egint_relay.test.js pins them); PIN MOVED (EG-H2): `spec` - a hall of the breach's own law asked (Elite-Gates.md section 22); PIN MOVED (EG-ZA): `void` a stake no call answered and `claimed` a held receipt counted, both to the hub (test/net/eliteGates/egz_keys.test.js pins them)   // PIN MOVED (EG-ZF, merged): `heal`
  for (const k of ['call', 'st', 'efs', 'ead', 'eb', 'ez', 'etx', 'emk', 'offer', 'ask', 'rise', 'eheal']) assert.ok(EG_OUT_KINDS.includes(k), k);
  assert.equal(validEgIn({ k: 'open', z: 'v1.abc.def' }), null, 'an open names where its company answers from');
  assert.deepEqual(validEgIn({ k: 'open', z: 'v1.abc.def', site: SITE, junk: 1 }), { k: 'open', z: 'v1.abc.def', site: SITE });
  assert.deepEqual(validEgIn({ k: 'in', z: 'v1.a.b', lv: 20, bv: 2 }), { k: 'in', z: 'v1.a.b', lv: 20, bv: 2 });
  assert.deepEqual(validEgIn({ k: 'hit', i: 7, q: 1, d: 40, r: 0, x: 1 }), { k: 'hit', i: 7, q: 1, d: 40, r: 0 });
  assert.equal(validEgIn({ k: 'hit', i: 7, q: 1, d: -1, r: 0 }), null);
  assert.equal(validEgIn({ k: 'hit', q: 1, d: 40, r: 0 }), null, 'a blow names its body');
  assert.deepEqual(validEgIn({ k: 'pick', v: 12 }), { k: 'pick', v: 12 });
  assert.deepEqual(validEgIn({ k: 'vote', q: 'dec:wrath', y: 2 }), { k: 'vote', q: 'dec:wrath', y: 2 });
  assert.equal(validEgIn({ k: 'vote', q: 'DROP TABLE', y: 0 }), null);
  assert.deepEqual(validEgIn({ k: 'lping', x: 3, z: 40, w: 1 }), { k: 'lping', x: 3, z: 40, w: 1 });
  assert.equal(validEgIn({ k: 'lping', x: 3000, z: 40, w: 1 }), null);
  assert.deepEqual(validEgIn({ k: 'pz', i: 2, a: -1 }), { k: 'pz', i: 2, a: -1 });
  assert.deepEqual(validEgIn({ k: 'fell' }), { k: 'fell' });
  const co = (n) => Array.from({ length: n }, (_, i) => [`acct-m${i}`, `M${i}`, (i % 8) + 1]);
  assert.ok(validEgOut({ k: 'call', b: B, o: 'Mac', os: 'acct-mac', seed: 7, op: T0, rh: 0, co: co(8), site: SITE }));
  assert.equal(validEgOut({ k: 'call', b: B, o: 'Mac', os: 'acct-mac', seed: 7, op: T0, rh: 0, co: co(9), site: SITE }), null, 'a company of nine');
  assert.ok(validEgOut({ k: 'co', co: [['acct-mac', 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]] }));
  assert.equal(validEgOut({ k: 'co', co: [['acct-mac', 'Mac', 1, 1, 0, 1]] }), null, 'the company\'s full row is ten');
  const body = [1, 0, 3, 0, 2.5, 40, 900, 1000, 1, 2.5, 40, 0, T0, 2.3, 2.3, 1, T0, 0, 0];   // PIN MOVED (EG-ZJ): a body's feet, its walk's end's height, its state and since when - seventeen; PIN MOVED (EG-ZQ): its size, eighteen; PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  assert.ok(validEgOut({ k: 'efs', h: 3, wk: T0, b: [body], bl: [], tx: [], mk: [], pg: {} }));
  assert.equal(validEgOut({ k: 'efs', h: 3, wk: T0, b: [body.slice(0, 18)], bl: [], tx: [], mk: [], pg: {} }), null, 'a body\'s row cut short');
  const blow = { k: 'eb', i: 4, o: 1, s: [['d', 2, 40, 3]], at: T0 + 1500, wu: 1500, p: 0.2, b: 4, el: 'fire', nm: 'Fire-fall', ch: 0, pu: 0, sp: 0 };
  assert.ok(validEgOut(blow));
  assert.equal(validEgOut({ ...blow, s: [['d', 2, 999, 3]] }), null, 'a stamp past the hall\'s bound');
  assert.equal(validEgOut({ ...blow, s: [['q', 1, 1]] }), null, 'a shape the Spire does not draw');
  assert.ok(validEgOut({ k: 'ez', i: 2, kind: 'burn', s: ['d', 0, 30, 4], from: T0, until: T0 + 8000, p: 0.04, b: 0, el: 'fire' }));
  assert.ok(validEgOut({ k: 'etx', t: [[1, 'acct-mac', 0, 8]] }));
  assert.ok(validEgOut({ k: 'emk', m: [['acct-mac', 6, T0 + 9000, 0]] }));
  assert.ok(validEgOut({ k: 'offer', v: [0, 5, 12], n: 1 }));
  assert.ok(validEgOut({ k: 'rise', s: 'acct-mac', p: 0.5, x: 1, z: 20, h: 6 }));
  assert.equal(validEgOut({ k: 'end', why: 'tear', at: T0 }).why, 'tear');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'eg', k: 'home' }), { hasHello: true }), { t: 'eg', k: 'home' });
  assert.equal(relaySupportsEg(`world${EG_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsEg(`world${EG_RELAY_MIN}`), true);
});

test('EG-PLAY THE OPEN AND THE CALL: the hub verifies the service\'s order (its own account\'s), freezes the company, opens the breach\'s room and says the call - kept for the account\'s next hello; an order of another account opens nothing (mutants: the order unverified; the call never kept)', async () => {
  await withBreach(async ({ hub, mac, eg }) => {
    const rec = eg.store.get(EG_KEY);
    assert.equal(rec.b, B);
    assert.deepEqual(rec.co, [{ sub: 'acct-mac', name: 'Mac', n: 1 }]);
    const call = egs(mac).find((m) => m.k === 'call');
    assert.ok(call, 'the opener hears the call');
    assert.deepEqual([call.b, call.os, call.seed, call.op], [B, 'acct-mac', rec.seed, rec.op]);
    assert.ok(hub.store.get(egCallKey('acct-mac')), 'kept for its next hello');
    assert.ok(validEgOut(call));
  });
  // another account's order: nothing opened
  const realNow = Date.now;
  try {
    const world = fakeRooms();
    const hub = world.room(SOCIAL_ROOM);
    await quiet(async () => {
      const ws = hub.connect(); await hub.hello(ws, 'peer-x', null, { name: 'X', acct: 'acct-xxxx', asecret: 'secret-of-acct-xxxx', kind: 'linked' });
      const order = await mintEgOrder({ o: 'egopen', s: 'acct-other', eb: B, ez: 'z'.repeat(20) }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
      await hub.raw(ws, JSON.stringify({ t: 'eg', k: 'open', z: order, site: SITE }));
      assert.equal(world.made.has(egRoomKey(B)), false, 'no room opened for an order that is not its sender\'s');
      assert.equal(egs(ws).at(-1)?.k, 'no');
    });
  } finally { Date.now = realNow; }
});

test('EG-PLAY THE ROOM: it admits its company alone, inside the open window - a stranger refused, the opener\'s admission spent once; the first hall wakes EG_GATHER_MS after the company stands on its plate and the count runs from thirty minutes; the rifts break under blows from the floor, the door opens, a step through it pulls the company to the next hall (mutants: a stranger admitted; an order spent twice; the hall woken before the gather)', async () => {
  await withBreach(async ({ eg, beat, admit, step }) => {
    // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the breach's first circle given at spec law 8 (test/egGive8.mjs - its
    // seed the hub's own draw): the company strikes the rifts of a yard laid where law 8 lays it
    egGive8(eg.store.get(EG_KEY).seed, [1]);
    const spec = egHallOf(eg.store.get(EG_KEY).seed, 1);
    // before the open: closed
    const early = eg.connect(); await eg.hello(early, 'peer-mac', at(spec.x0 + spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: 'acct-mac', charLevel: 20 });
    assert.equal(early.closed?.reason, 'the breach is closed', 'sealed: nobody yet');
    step(EG_SEALED_MS); await beat(1000);
    assert.equal(eg.store.get(EG_KEY).sg, 'arrive');
    const stranger = eg.connect(); await eg.hello(stranger, 'peer-st', at(0, 0), { kind: 'linked', tokenSub: 'acct-strange' });
    assert.equal(stranger.closed?.reason, 'the breach answers only to its company');
    const ws = eg.connect(); await eg.hello(ws, 'peer-mac', at(spec.x0 + spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: 'acct-mac', charLevel: 20 });
    assert.equal(ws.closed, null);
    const z = await admit('acct-mac');
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
    assert.equal(eg.store.get(EG_KEY).mem['acct-mac'].in, 1);
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
    assert.equal(eg.store.get(EG_KEY).zs.length, 1, 'a counted member asked again (a reload, a new circle) spends nothing more');
    assert.notEqual(egs(ws).at(-1).m, 'the order is spent', 'and is never refused');
    // the gather
    await eg.pose(ws, at(spec.x0 + spec.arrive.x, spec.arrive.z));
    await beat(EG_GATHER_MS - 1000);
    assert.equal(eg.store.get(EG_KEY).sg, 'arrive', 'not before the gather is done');
    await eg.pose(ws, at(spec.x0 + spec.arrive.x, spec.arrive.z));
    await beat(2000);
    const rec = eg.store.get(EG_KEY);
    assert.equal(rec.sg, 'trial');
    assert.equal(rec.cnt.left, 1_800_000);
    assert.ok(rec.cnt.at > 0, 'the count runs');
    const efs = egs(ws).find((m) => m.k === 'efs');
    assert.ok(efs && efs.b.some((t) => t[1] === 2), 'the rifts said as the Spire\'s own bodies (role 2, an object)');
    assert.ok(validEgOut(efs));
    // strike every body that can be struck from behind it - the rifts and the legion that rises from them
    /** The breach as the room holds it now (the store is its checkpoint). */
    const held = () => eg.room._eg ?? eg.store.get(EG_KEY);
    let q = 1;
    for (let guard = 0; guard < 4000 && held().sg === 'trial'; guard++) {
      const cur = held();
      const live = cur.F.bodies.filter((t) => t.hp > 0 && !(t.fl & (2 | 16 | 128)));
      const tgt = live.find((t) => t.role === 1) ?? live[0];   // the legion first (a Sapper reopens a closed rift), then the rifts
      if (tgt) {
        const yw = tgt.yaw ?? 0;
        await eg.pose(ws, at(spec.x0 + tgt.x - Math.sin(yw) * 1.5, tgt.z - Math.cos(yw) * 1.5));
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'hit', i: tgt.i, q: q++, d: 200, r: 1 }));
      }
      await beat(250);
    }
    assert.equal(held().sg, 'closing', 'the last rift closed opens the door');
    assert.ok(egs(ws).some((m) => m.k === 'edie'), 'the bodies\' falls said');
    for (const m of egs(ws)) assert.ok(validEgOut(m), `a room word the wire refuses: ${m.k}`);
    // PIN MOVED (EG-H1): the member WALKS to the door - THE FAIR TRAIL refuses a step through it from a teleport
    // (test/net/eliteGates/egint_relay.test.js pins the refusal)
    const last = eg.room._attach?.(ws)?.pose ?? ws.att.pose, [lx, , lz] = dungeonToRealm(last.x, last.y ?? 0, last.z), n = Math.ceil(Math.hypot(spec.x0 + spec.end.x - lx, spec.end.z - lz) / 2);
    for (let k = 1; k <= n; k++) { await eg.pose(ws, at(lx + ((spec.x0 + spec.end.x - lx) * k) / n, lz + ((spec.end.z - lz) * k) / n)); await beat(250); }
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'down', h: 1 }));
    await beat(500);
    const after = held();
    assert.deepEqual([after.h, after.sg], [2, 'arrive'], 'the step through pulls the company to Hall 2');
    assert.equal(after.cnt.at, 0, 'the pull holds the count');
  });
});

test('EG-PLAY ONE LIFE (EG-FULL, section 16.5): a death in the breach is the member\'s fall, said by their own word (`fell` - the death save turned it aside) - said to all with whether it is final (a solo member\'s is: nobody living is left to recall it), the member a witness; no member living, the breach ends a wipe, the end receipt (`e1`, kind x, why wipe) minted to its socket, and its room beats no more (mutants: a death that costs nothing; the end never said; the last living member\'s fall said first)', async () => {
  await withBreach(async ({ eg, beat, admit, step }) => {
    // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the breach's first circle given at spec law 8 (test/egGive8.mjs - its
    // seed the hub's own draw): the company strikes the rifts of a yard laid where law 8 lays it
    egGive8(eg.store.get(EG_KEY).seed, [1]);
    const spec = egHallOf(eg.store.get(EG_KEY).seed, 1);
    step(EG_SEALED_MS); await beat(1000);
    const ws = eg.connect(); await eg.hello(ws, 'peer-mac', at(spec.x0, 0), { kind: 'linked', tokenSub: 'acct-mac', charLevel: 20 });
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await admit('acct-mac'), lv: 20, bv: 2 }));
    await eg.pose(ws, at(spec.x0, 0));
    await beat(EG_GATHER_MS + 1000);
    assert.equal(eg.store.get(EG_KEY).sg, 'trial');
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'fell' }));
    await beat(1000);
    const rec = eg.store.get(EG_KEY);
    assert.deepEqual([rec.mem['acct-mac'].alive, rec.mem['acct-mac'].falls, rec.mem['acct-mac'].wit], [0, 1, 1]);
    assert.equal(rec.end, 'wipe');
    const fall = egs(ws).find((m) => m.k === 'fall' && m.s === 'acct-mac');
    // PIN MOVED (AUDIT EG V, a2 - L3-15; section 16.5 "Solo stays literally one life"): a fall that leaves nobody living is said
    // final - the breach's wipe follows on the same beat, and no recall or Memento can undo it (it read `fin` 0, *The next
    // Redoubt can call you back.*); a company's first fall is still not final (test/net/eliteGates/egaudit5_a2.test.js)
    assert.ok(fall && fall.fin === 1, 'said - final: nobody living is left to recall it');
    assert.ok(egs(ws).some((m) => m.k === 'end' && m.why === 'wipe'));
    const r = egs(ws).find((m) => m.k === 'rcpt');
    assert.ok(r, 'the end receipt minted to its socket');
    const c = readEgReceipt(r.r);
    assert.deepEqual([c.q, c.why, c.b, c.s, c.z], ['x', 'wipe', B, 'acct-mac', 'z'.repeat(20)]);
    eg.alarm.at = null;
    // PIN MOVED (EG-ZA, Elite-Gates.md section 23 "The tombstone"): an ended breach's director beats no more - its room's one
    // alarm is its tombstone's end, a week on (EG_VOID_MAX_S), when the breach is forgotten
    const before = structuredClone(eg.store.get(EG_KEY));
    assert.equal(await eg.room._egTick(), true, 'an ended breach keeps its tombstone');
    assert.ok(eg.alarm.at >= Date.now() + EG_VOID_MAX_S * 1000 - 5000, 'its alarm the tombstone\'s end, a week on - no beat');
    assert.deepEqual(eg.store.get(EG_KEY), before, 'and the director never stepped');
  });
});

test('EG-PLAY THE WORKER: an `eg:` key that is not a breach\'s mints no object (404); the room\'s internal door opens one breach and answers the same order again with its record, another order 409 (mutants: the prefix gate gone; a second open over the first)', async () => {
  const res = await worker.fetch(new Request('https://relay.invalid/room/eg:nothex', { headers: { Upgrade: 'websocket' } }), { ROOMS: null });
  assert.equal(res.status, 404);
  const r = fakeRoom(egRoomKey(B));
  const tell = { b: B, ez: 'z'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 0, rh: 0, seed: 9, op: T0, co: [['acct-mac', 'Mac', 1]], site: SITE };
  const post = (body) => r.room.fetch(new Request('https://relay.internal/internal/eg/open', { method: 'POST', body: JSON.stringify(body) }));
  const a = await post(tell);
  assert.equal(a.status, 200);
  // PIN MOVED (EG-H2): the room answers the law it opened under - the hub's live list keeps it (Elite-Gates.md section 22).
  // PIN MOVED (AUDIT EG IV, lane3 #12): it held `{ ok, seed, op, egv }` - the room answers the company and the site it froze
  // too, and a retried open calls them, never the party as the retry finds it
  assert.deepEqual(await (await post({ ...tell, co: [['acct-mac', 'Mac', 1], ['acct-ann', 'Ann', 2]] })).json(), { ok: true, seed: 9, op: T0, egv: EG_SPEC, co: [['acct-mac', 'Mac', 1]], site: SITE });
  assert.equal((await post({ ...tell, ez: 'y'.repeat(20) })).status, 409);
  assert.equal((await post({ ...tell, co: [] })).status, 400);
  assert.ok(Room);
});
