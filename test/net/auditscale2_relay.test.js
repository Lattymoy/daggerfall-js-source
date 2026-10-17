// AUDIT SCALE II (2026-10-11, the audit of pull request #757 - Mac: "Lets do an audit on everything. Ensure perfection."):
// THE RELAY'S HALF - SCALE5b's second wire, its settings and its referee word, and SCALE5d's layers. Each finding was
// reproduced on the real Room over the pins' fake object (test/fakeRoom.mjs) against the pull request's head (e729cea7)
// and each pin below fails there:
//   R1-1  a hello's welcome overwrote the cell's record of its last `rf` word - a referee begun before it went unsaid
//   R1-2  every boss beat awaited the hub for the relay's settings (ROOM_CALL_MS a minute)
//   R1-3  slimPose wrote an admitted pitch as `null` - the second wire's readers refused the whole pose
//   R1-4  a relay setting was stored unvalidated and answered as in force
//   R1-5  double13 counted every full layer the Worker's walk passed, not the sockets refused `room full`
//   R3-3  any page had a private empty layer on demand (`?ly=`), and a layer stood its own serpent and raid ledger
//   R3-8  a team parked in a layer was never dropped from it
//   R3-9  the hub's wipe of a zone hall reached the place alone
//   R3-3 (c) the law made one - a layer holds no event state: a layer stood its own rite, its own overworld ledger and
//         its own card tables, their stakes spent where the place never heard of them
//   D-8   the batches' numbers the record states (POSE_BATCH_MS, ROSTER_BATCH_MS) had no pin
// tools/mutants/auditscale2_relay.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import worker from '../../server/src/index.js';
import { layerWalk } from '../../server/src/relayScale.js';
import {
  validPose, slimPose, PIXEL_UNITS, POSE_HZ_MAX, POSE_BATCH_MS, ROSTER_BATCH_MS, RELAY_VERSION, SOCKETS_MAX, LAYERS_MAX,
  LAYER_HEADER, layerName, cellRoomOfWire, serpentFightId,
  SOCIAL_ROOM, parkKeyOf, parkKey, parkRegistryRoom, wdunRoomKey, worldRoom, wallMsForClassicMinutes, raidLedgerKey,
} from '../../src/net/wire.js';
import { RELAY_CFG_TTL_MS } from '../../src/net/relayCfg.js';
import { newWildRef } from '../../src/net/wild/wildRef.js';
import * as SL from '../../src/net/serpent/serpentLaw.js';
import { raidDaySlots, raidLedgerId, RAID_DAY_MINUTES } from '../../src/net/raid/raidLaw.js';
import * as wire from '../../src/net/wire.js';
import { webcrypto } from 'node:crypto';
import { mintStakeOrder, mintDeckOrder, deckDigest } from '../../src/net/identityToken.js';
import { readCardReceipt } from '../../src/net/card/cardReceipt.js';
import { HOLDEM_REFUSALS } from '../../src/ui/card/cardTableHud.js';
import { SIT_REFUSALS } from '../../src/systems/card/cardRemoteTable.js';
import { ILIAC_ONLINE_REFUSALS } from '../../src/scenes/iliacTableGame.js';
import { STARTER_DECK } from '../../src/net/iliac/iliacCards.js';
import { BAND_LIFE_MS } from '../../src/systems/travel/travelBands.js';
import { riteNativeOf, RITE_UNITS_PER_M } from '../../src/net/gate/gateRite.js';
import { gateTimes } from '../../src/net/gate/gateLaw.js';

/** The walk's three new headers by their names (held to wire.js's own in R3-3 (a)), so each pin here reads against the
 *  code as it stood before them. */
const LAYER_ASK_HEADER = 'x-df-ask', LAYER_EMPTY_HEADER = 'x-df-empty', LAYER_LAST_HEADER = 'x-df-last';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
async function onClock(start, fn) {
  const realNow = Date.now;
  let clock = start;
  Date.now = () => clock;
  try { return await quiet(() => fn({ now: () => clock, tick: (ms) => { clock += ms; }, set: (t) => { clock = t; } })); } finally { Date.now = realNow; }
}
/** The runtime's socket pair, for a Room's door: Node will not build its 101, so the walk's harness reads an admission
 *  off the throw (the socket is in the object's list by then, as the runtime's is). */
async function withPair(fn) {
  const had = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { this[0] = {}; this[1] = { serializeAttachment() {}, deserializeAttachment() { return {}; } }; } };
  try { return await fn(); } finally { globalThis.WebSocketPair = had; }
}
/** A world of real Rooms behind the Worker's ROOMS binding, each admission answered `admitted <object>`. */
function walkWorld(now) {
  const W = fakeRooms({ now });
  const ROOMS = { idFromName: (n) => n, get: (n) => ({ fetch: async (req) => { try { return await W.room(n).room.fetch(req); } catch { return new Response(`admitted ${n}`, { status: 200 }); } } }) };
  const fill = (name) => { const R = W.room(name); for (let i = 0; i < SOCKETS_MAX; i++) { const ws = R.connect(); ws.att.at = now() - 1; ws.att.id = `p${i}`; } return R; };
  const page = (path, headers = {}) => worker.fetch(new Request(`https://relay.test${path}`, { headers: { Upgrade: 'websocket', ...headers } }), { ROOMS });
  return { W, ROOMS, fill, page };
}
const said = async (res) => (res.status === 200 ? res.text() : `${res.status} ${await res.text()}`);

// ═══ R1-1: THE REFEREE WORD, WHAT EVERY SOCKET WAS LAST TOLD ═══════════════════════════════════════════════════════════

const BX = 13 * 16 + 8, BY = 13 * 16 + 8;
const CELL = `world:${Math.floor(BX / 16)},${Math.floor(BY / 16)}`;
const standing = (dx = 0) => validPose({ x: (BX + 0.5) * PIXEL_UNITS + dx, y: 0, z: (499 - BY + 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0, mv: 1, ts: 0 });

test('AUDIT SCALE II R1-1 a hello\'s welcome tells its own socket alone: a referee begun since the last pose, then a hello, is said at once to every socket of the second wire already here, once, and its end the same (mutants: the welcome\'s word written over the cell\'s record; the moved word left to the next pose)', async () => {
  await onClock(1_800_000_000_000, async ({ tick }) => {
    const R = fakeRoom(CELL);
    const join = async (id, extra = {}) => { const ws = R.connect(); tick(200); await R.hello(ws, id, standing(), extra); assert.equal(ws.closed, null); return ws; };
    const rf = (ws) => ws.sent.filter((f) => f.t === 'rf');
    const halo = await join('halo-0001', { w2: 1 });   // a halo of a player whose own cell is next door - the second wire
    const old = await join('old-0001');                  // the first wire hears no such word
    const fighter = await join('duel-000a', { w2: 1 });
    const speak = async (ws) => { tick(Math.ceil(1000 / POSE_HZ_MAX) + 1); await R.pose(ws, standing(40)); };
    await speak(fighter);
    assert.deepEqual(rf(halo), [], 'nothing judges yet');
    // a referee begins here (the Wild zone's fighters - the scale5b pin's own way of standing one up) ...
    R.room._wildRef = newWildRef();
    R.room._wildRef.fighters.set('acct-duel-000a', { id: 'duel-000a' });
    // ... and before anyone poses again, someone says hello (a walker's halo opening, a reconnect)
    const late = await join('late-0001', { w2: 1 });
    assert.equal(late.sent.find((f) => f.t === 'welcome').rf, 1, 'the newcomer\'s welcome says it');
    assert.deepEqual(rf(halo), [{ t: 'rf', on: 1 }], 'and the halo already here is told at the hello - not left thinning for a fight');
    assert.deepEqual(rf(fighter), [{ t: 'rf', on: 1 }]);
    assert.deepEqual(rf(old), []);
    for (let i = 0; i < 6; i++) { await speak(fighter); await speak(halo); }
    assert.deepEqual(rf(halo), [{ t: 'rf', on: 1 }], 'said once');
    // its end, the same way
    R.room._wildRef.fighters.clear();
    const late2 = await join('late-0002', { w2: 1 });
    assert.equal(late2.sent.find((f) => f.t === 'welcome').rf, undefined);
    assert.deepEqual(rf(halo), [{ t: 'rf', on: 1 }, { t: 'rf', on: 0 }], 'its end said at the hello too');
    for (let i = 0; i < 4; i++) await speak(fighter);
    assert.equal(rf(halo).length, 2);
    R.room._flushOwed();
  });
});

// ═══ R1-2: A BEAT NEVER AWAITS THE HUB ═══════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R1-2 a boss\'s beat asks the hub for the relay\'s settings and goes on: the gate\'s, a serpent\'s and a Remnant\'s beat each settle while the hub has not answered; the answer, when it lands, is in force; asked once a RELAY_CFG_TTL_MS (mutants: each of the three beats awaiting it)', async () => {
  await quiet(async () => {
    const pending = [];
    let asked = 0;
    const ROOMS = { idFromName: (n) => n, get: () => ({ fetch: () => { asked++; return new Promise((resolve) => pending.push(resolve)); } }) };   // a hub that holds every call
    const settles = (p) => Promise.race([p.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 150))]);
    const answer = async (cfg) => { for (const r of pending.splice(0)) r(new Response(JSON.stringify(cfg), { status: 200 })); for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };
    // the gate's court, its fight past its end - the beat's time is the ask's alone
    const G = fakeRoom('gate:20000', { ROOMS });
    G.room._fight = { day: 0 };
    assert.equal(await settles(G.room._gateTick()), true, 'the gate\'s beat settles with the hub silent');
    assert.equal(asked, 1, 'and it asked');
    assert.equal(G.room._bodyLine().enforce, false, 'the line it holds meanwhile');
    await answer({ bossBody: '{"enforce":true}' });
    assert.equal(G.room._bodyLine().enforce, true, 'the answer, once it lands, is the next beat\'s');
    G.room._fight = { day: 0 };
    assert.equal(await settles(G.room._gateTick()), true);
    assert.equal(asked, 1, 'asked once a RELAY_CFG_TTL_MS, however many beats');
    // a serpent's cell, its one fight past its keeping
    const S = fakeRoom(CELL, { ROOMS });
    S.room._serpents = new Map([['363@1,1', { soundAt: 0, players: {} }]]);
    assert.equal(await settles(S.room._serpentTick()), true, 'the serpent\'s beat settles with the hub silent');
    assert.equal(asked, 2);
    // an Abyss realm's Remnant
    const D = fakeRoom('sd:1', { ROOMS });
    D.room._sdFight = { s: 1, players: {} };
    assert.equal(await settles(D.room._sdFightTick()), true, 'the Remnant\'s beat settles with the hub silent');
    assert.equal(asked, 3);
    await answer({});
    assert.ok(RELAY_CFG_TTL_MS > 0);
  });
});

// ═══ R1-3: A SLIM POSE KEEPS WHAT ITS ROUNDING CANNOT HOLD ═══════════════════════════════════════════════════════════

test('AUDIT SCALE II R1-3 slimPose keeps a value its rounding overflows: a pitch the relay admits past 1.8e304 rides the second wire as itself, and a reader of the second wire stands its sender where the first wire\'s reader does (mutant: the rounding\'s Infinity written as null)', async () => {
  for (const pitch of [1.8e304, -1e305, Number.MAX_VALUE]) {
    const p = validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch });
    assert.ok(p, 'the relay admits it');
    const back = validPose(JSON.parse(JSON.stringify(slimPose(p))));
    assert.ok(back, `the second wire's reader takes it (${pitch})`);
    assert.equal(back.pitch, pitch);
  }
  assert.equal(slimPose(validPose({ x: 0.4, y: 0, z: 0, yaw: 0.00004, pitch: 1.23456 })).pitch, 1.2346, 'an ordinary pitch still rounded');
  // end to end: a sender with that pitch walking 200 m, heard by a reader of each wire
  await onClock(1_800_000_000_000, async ({ tick }) => {
    const R = fakeRoom(CELL);
    const join = async (id, extra = {}) => { const ws = R.connect(); tick(200); await R.hello(ws, id, standing(), extra); return ws; };
    const lOld = await join('lsn-old0'), lW2 = await join('lsn-w200', { w2: 1 }), cheat = await join('cht-0001');
    for (const ws of [lOld, lW2]) ws.sent.length = 0;
    for (let i = 1; i <= 20; i++) { tick(Math.ceil(1000 / POSE_HZ_MAX) + 1); await R.pose(cheat, { x: (BX + 0.5) * PIXEL_UNITS + i * 400, y: 0, z: (499 - BY + 0.5) * PIXEL_UNITS, yaw: 0, pitch: 1.8e304, mv: 1 }); }   // 200 m
    R.room._flushOwed();
    const reader = (wire2, frames) => {
      const { FakeWS, sockets } = fakeSocketClass();
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'R', id: 'rdr-0001', secret: 'secret-of-rdr-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand: () => 0, wire2 });
      s.join(CELL, standing());
      sockets[0].open();
      sockets[0].receive({ t: 'welcome', id: 'rdr-0001', peers: [], n: 1, v: RELAY_VERSION, now: 1_000_000 });
      for (const f of frames) sockets[0].receive(f);
      return s.peers.get('cht-0001')?.pose?.x;
    };
    const at = R.room._attach(cheat).pose.x;
    assert.equal(reader(false, lOld.sent), at, 'the first wire\'s reader');
    assert.ok(lW2.sent.some((f) => f.t === 'poses'), 'the second wire\'s batches carried it');
    assert.equal(reader(true, lW2.sent), at, 'the second wire\'s reader stands it in the same place - never unseen');
  });
});

// ═══ R1-4: A RELAY SETTING BY ITS CONSUMERS' LAW ═════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R1-4 the hub takes a relay setting only as its consumers read it - a role is a Discord id (heraldRole), the line bodyConfig\'s whole with no key it would ignore - and refuses anything else in words /relay shows, keeping nothing (mutants: the refusal unsaid; a role unread; a key unknown taken; a part unknown taken; a line bodyConfig reads as its default taken)', async () => {
  await onClock(1_800_000_000_000, async ({ tick }) => {
    const W = fakeRooms();
    const H = W.room(SOCIAL_ROOM);
    H.env.GATE_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-x';
    H.env.GATE_DISCORD_ROLE = '111111111111111111';
    const dev = H.connect(); tick(300); await H.hello(dev, 'dev-0001', null, { glyphs: ['dev'] });
    assert.equal(dev.closed, null);
    const say = async (k, v) => { tick(5000); await H.raw(dev, JSON.stringify({ t: 'cfg', k, v })); return dev.sent.filter((f) => f.t === 'cfg').at(-1); };
    const refused = async (k, v) => {
      const before = JSON.stringify(await H.state.storage.get('relaycfg'));
      const a = await say(k, v);
      assert.equal(typeof a.error, 'string', `${k} ${v} refused`);
      assert.equal(a.v, undefined);
      assert.ok(a.error.length <= 120, 'within the answer\'s bound (validRelayCfgOut)');
      assert.equal(JSON.stringify(await H.state.storage.get('relaycfg')), before, 'nothing kept');
      return a.error;
    };
    for (const k of ['gateRole', 'serpentRole', 'sdRole']) {
      assert.match(await refused(k, '<@&111111111111111111>'), /Discord role's id/, 'a role pasted as its mention');
      await refused(k, 'Gate Watchers');
      await refused(k, '12345');
    }
    assert.equal(H.room._heraldOf().role, '111111111111111111', 'the herald pings the role it pinged');
    assert.deepEqual(await say('gateRole', '222222222222222222'), { t: 'cfg', k: 'gateRole', v: '222222222222222222' }, 'an id is taken');
    assert.equal(H.room._heraldOf().role, '222222222222222222');
    for (const v of [
      '{"enforce": true, "body": {"depth": 1.5}}',                      // a part without its perS: bodyConfig's default whole
      '{"enfroce": true}',                                              // a key bodyConfig would ignore
      '{"enforce": true, "body": {"depth": 1, "perS": 0.1, "per": 2}}', // a part's key it would ignore
      '{"enforce": "yes"}', '{"body": {"depth": 11, "perS": 0}}', 'enforce', '[]', 'null', '7',
    ]) assert.match(await refused('bossBody', v), /bossBody is JSON/);
    const body = '{"enforce": true, "body": {"depth": 0.5, "perS": 0.02}, "hull": {"depth": 0.1, "perS": 0.01}}';
    assert.deepEqual(await say('bossBody', body), { t: 'cfg', k: 'bossBody', v: body }, 'a whole line is taken');
    assert.deepEqual(await say('bossBody', '{"enforce": false}'), { t: 'cfg', k: 'bossBody', v: '{"enforce": false}' }, 'and a part of one');
    assert.deepEqual(await say('bossBody', null), { t: 'cfg', k: 'bossBody', v: '' }, 'and handed back to the var');
    // the boss's room runs what the hub answered as in force
    await say('bossBody', body);
    const G = W.room('gate:20000');
    await G.room._relayCfgFresh(Date.now());
    assert.equal(G.room._bodyLine().enforce, true);
    assert.equal(G.room._bodyLine().body.depth, 0.5);
  });
});

// ═══ R1-5 AND R3-3 (a): THE WORKER'S WALK ════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R1-5 double13 is the sockets refused `room full`: a full layer the walk passes counts nothing, the walk\'s last try counts its one refusal, and the page\'s own word of a last try is not believed (mutants: every full layer counted; the last try unmarked; the page\'s header passed on)', async () => {
  await withPair(() => onClock(1_800_000_000_000, async ({ now }) => {
    const { W, fill, page } = walkWorld(now);
    const KEY = 'world:5,5';
    fill(KEY); fill(layerName(KEY, 1));
    assert.equal(await said(await page(`/room/${KEY}`)), `admitted ${layerName(KEY, 2)}`);
    const counts = () => Object.fromEntries([...W.made].map(([n, r]) => [n, r.room._metrics.c.full]));
    assert.deepEqual(counts(), { [KEY]: 0, [layerName(KEY, 1)]: 0, [layerName(KEY, 2)]: 0 }, 'one socket seated next door: nobody refused');
    assert.equal(await said(await page(`/room/${KEY}`, { [LAYER_LAST_HEADER]: '1' })), `admitted ${layerName(KEY, 2)}`);
    assert.equal(W.room(KEY).room._metrics.c.full, 0, 'the page\'s word of a last try is not believed');
    for (let ly = 2; ly < LAYERS_MAX; ly++) fill(layerName(KEY, ly));
    for (const [, r] of W.made) r.room._metrics.c.full = 0;
    const res = await page(`/room/${KEY}`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'room full' });
    assert.deepEqual(Object.values(counts()).reduce((n, c) => n + c, 0), 1, 'every layer full: one socket refused, counted once');
    assert.equal(W.room(layerName(KEY, LAYERS_MAX - 1)).room._metrics.c.full, 1, 'at the walk\'s last try');
    // a room no walk reaches counts every refusal (scale5b's pin, held here beside it)
    const town = W.room('town:m8');
    for (let i = 0; i < SOCKETS_MAX; i++) { const ws = town.connect(); ws.att.at = now() - 1; }
    assert.equal((await town.room.fetch(new Request('https://relay.test/room/town:m8', { headers: { Upgrade: 'websocket' } }))).status, 503);
    assert.equal(town.room._metrics.c.full, 1);
  }));
});

test('AUDIT SCALE II R3-3 (a) an asked layer is a page\'s only while someone stands in it: an empty one asked is walked from the place, admitted only when that walk reaches it in turn; one holding a socket is the page\'s (a party\'s, a reconnect\'s own) (mutants: the empty layer admitted; the ask unsaid; the empty answer answered; the walk again from the asked layer; a layer with a socket refused as empty)', async () => {
  await withPair(() => onClock(1_800_000_000_000, async ({ now }) => {
    assert.deepEqual([wire.LAYER_ASK_HEADER, wire.LAYER_EMPTY_HEADER, wire.LAYER_LAST_HEADER], [LAYER_ASK_HEADER, LAYER_EMPTY_HEADER, LAYER_LAST_HEADER], 'one home for the walk\'s words');
    const { W, fill, page } = walkWorld(now);
    const KEY = 'world:5,5';
    assert.equal(await said(await page(`/room/${KEY}?ly=3`)), `admitted ${KEY}`, 'an empty layer asked: the place, which has room');
    assert.equal(W.room(layerName(KEY, 3)).sockets.length, 0, 'and the layer opened nobody');
    fill(KEY); fill(layerName(KEY, 1));
    assert.equal(await said(await page(`/room/${KEY}?ly=5`)), `admitted ${layerName(KEY, 2)}`, 'the walk from the place, the first layer with room - never the asked one');
    const party = W.room(layerName(KEY, 6)); party.connect();   // a party's layer holds its leader
    assert.equal(await said(await page(`/room/${KEY}?ly=6`)), `admitted ${layerName(KEY, 6)}`, 'a layer someone stands in is the page\'s');
    // the asked layer's own door: the Worker's ask on the first try alone
    const asked = [];
    const spy = { idFromName: (n) => n, get: (n) => ({ fetch: async (req) => { asked.push([n, req.headers.get(LAYER_ASK_HEADER), req.headers.get(LAYER_LAST_HEADER)]); const r = new Response('{}', { status: 503 }); if (asked.length === 1) r.headers.set(LAYER_EMPTY_HEADER, '1'); else r.headers.set('x-df-full', '1'); return r; } }) };
    await layerWalk(spy, KEY, new Request(`https://relay.test/room/${KEY}`, { headers: { Upgrade: 'websocket', [LAYER_ASK_HEADER]: '1' } }), 4);
    assert.deepEqual(asked[0], [layerName(KEY, 4), '1', null], 'the ask rides the first try');
    assert.deepEqual(asked.slice(1).map(([n]) => n), Array.from({ length: LAYERS_MAX }, (_, ly) => layerName(KEY, ly)), 'then the walk from the place, each once');
    assert.ok(asked.slice(1).every(([, ask]) => ask === null), 'never the ask again - nor the page\'s');
    assert.deepEqual(asked.map(([, , last]) => last), [...Array(LAYERS_MAX).fill(null), '1'], 'the last try marked, it alone');
    // the object's answer: empty, asked, past the place - and nothing else
    const L5 = W.room(layerName(KEY, 5));
    const knock = (ly, ask) => L5.room.fetch(new Request(`https://relay.test/room/${KEY}`, { headers: { Upgrade: 'websocket', [LAYER_HEADER]: String(ly), ...(ask ? { [LAYER_ASK_HEADER]: '1' } : {}) } })).catch(() => null);
    const r = await knock(5, true);
    assert.equal(r.status, 503); assert.equal(r.headers.get(LAYER_EMPTY_HEADER), '1');
    assert.equal(L5.sockets.length, 0);
    assert.equal(await knock(5, false), null, 'walked to in turn, it admits');
    assert.equal(L5.sockets.length, 1);
  }));
});

// ═══ R3-3 (b): NO EVENT IN A LAYER ═══════════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R3-3 (b) a layer of the serpent\'s cell stands no serpent: its `in` is the waters\' own refusal, nothing stood or kept, while the place\'s fight stands; a layer of a raided town keeps no raid ledger, while the place\'s does (mutants: a layer\'s serpent; its refusal unsaid; a layer\'s raid ledger)', async () => {
  // the serpent (the serpent1 pins' site: day 363 at map pixel 205,214)
  const DAY = 363, TT = SL.serpentTimes(DAY);
  const SX = (205 + 0.5) * PIXEL_UNITS, SZ = (499 - 214 + 0.5) * PIXEL_UNITS, SCELL = cellRoomOfWire(SX, SZ);
  const at = (mx) => ({ x: SX + mx * SL.SERPENT_NATIVE_PER_M, y: 0, z: SZ, yaw: 0, pitch: 0 });
  const IN = JSON.stringify({ t: 'serpent', k: 'in', d: DAY, bv: SL.SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ });
  const FID = serpentFightId(DAY, SL.serpentSiteKey(SX, SZ));
  await onClock(TT.riseAt + 20_000, async () => {
    const W = fakeRooms();
    const L0 = W.room(SCELL), L3 = W.room(layerName(SCELL, 3));
    const a = L0.connect(); await L0.hello(a, 'peer-0001', at(120));
    const b = L3.connect(); b.att.key = SCELL; b.att.ly = 3; await L3.hello(b, 'peer-0002', at(120));
    assert.equal(b.sent[0].ly, 3, 'a layer of the cell');
    await L3.raw(b, IN);
    assert.deepEqual(b.sent.filter((m) => m.t === 'serpent'), [{ t: 'serpent', k: 'no', m: 'the waters are full' }], 'the layer\'s `in`: the waters\' own refusal');
    assert.equal((await L3.room._serpentFights()).size, 0, 'no fight stood in the layer');
    assert.equal([...L3.store.keys()].some((k) => k.startsWith('serpent')), false, 'nothing kept');
    assert.equal(L3.room._meterOf(b).junk ?? 0, 0, 'nobody struck - an honest client says it there');
    await L3.raw(b, JSON.stringify({ t: 'serpent', k: 'hit', d: 40, z: 0 }));
    assert.equal(b.sent.filter((m) => m.t === 'serpent').length, 1, 'its every other word nothing');
    await L0.raw(a, IN);
    assert.ok((await L0.room._serpentFights()).has(FID), 'the place\'s fight stands');
  });
  // the raid (the raid3 pins' raid: day 600, a town at map pixel 100,200)
  const D = 600, PX = 100, PY = 200, RCELL = worldRoom(PX, PY);
  const slot = [...raidDaySlots(D)].map((x) => { const [st, tg, ty] = x.split('.').map(Number); return { st, tg, ty }; }).find((x) => x.st === D * RAID_DAY_MINUTES + 587);
  assert.ok(slot);
  const word = { t: 'raid', k: 'w', key: `3:7:${D}`, st: slot.st, tg: slot.tg, ty: slot.ty, px: PX, py: PY, n: 1, s: 1 };
  const ON = { x: PX * PIXEL_UNITS + 16384, y: 0, z: (499 - PY) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };
  const LED = raidLedgerKey(raidLedgerId(word));
  await onClock(wallMsForClassicMinutes(slot.st + 10), async () => {
    const W = fakeRooms();
    const L0 = W.room(RCELL), L2 = W.room(layerName(RCELL, 2));
    const b = L2.connect(); b.att.key = RCELL; b.att.ly = 2; await L2.hello(b, 'peer-0002', ON);
    await L2.raw(b, JSON.stringify(word));
    assert.equal(L2.store.has(LED), false, 'no ledger in the layer');
    assert.deepEqual(b.sent.filter((m) => m.t === 'raid'), [], 'and nothing said');
    assert.equal(L2.room._meterOf(b).junk ?? 0, 0, 'nobody struck');
    const a = L0.connect(); await L0.hello(a, 'peer-0001', ON);
    await L0.raw(a, JSON.stringify(word));
    assert.equal(L0.store.has(LED), true, 'the place\'s ledger');
  });
});

// ═══ R3-8: A PARKED TEAM'S LAYER ═════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R3-8 the park registry keeps the layer a team is kept in: parked in a layer, then elsewhere - another cell, or the place of its own - the layer drops it; a word naming a cell it does not hold leaves that cell\'s layer\'s record standing; a record from before it is the place (mutants: the layer unsaid; the layer unkept; the drop to the place; the same cell\'s layer never compared; a word with no layer read as the place)', async () => {
  await quiet(async () => {
    const AX = 100 * PIXEL_UNITS + 1000, AZ = (499 - 150) * PIXEL_UNITS + 1000;
    const X = cellRoomOfWire(AX, AZ), YX = AX + 16 * PIXEL_UNITS, Y = cellRoomOfWire(YX, AZ);
    const WG = (x) => [2, x, 1, AZ, 0, 0, 0, 1, 50, 0];
    const CA = 'char-ann-0001';
    const w = fakeRooms();
    const k = await parkKeyOf('acct-ann1', CA);
    const park = (name, ws, data) => { const r = w.room(name); r.room._meterOf(ws).parkBucket = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data })); };
    const join = async (name, id, ly = 0) => { const r = w.room(name); const ws = r.connect(); if (ly) { ws.att.key = name.split('#')[0]; ws.att.ly = ly; } await r.hello(ws, id, null); return ws; };
    const holds = (name) => w.room(name).store.has(parkKey(k));
    const reg = () => w.room(parkRegistryRoom(k)).store.get('reg');
    const X2 = layerName(X, 2), Y3 = layerName(Y, 3);
    // parked in X's layer 2, then in Y's place
    const ann = await join(X2, 'ann1', 2);
    await park(X2, ann, { c: CA, a: [AX, AZ], r: { w: WG(AX) } });
    assert.equal(holds(X2), true);
    assert.deepEqual(reg(), { cell: X, at: reg().at, ly: 2 }, 'the registry keeps its layer');
    const annY = await join(Y, 'ann1');
    await park(Y, annY, { c: CA, a: [YX, AZ], r: { w: WG(YX) } });
    assert.equal(holds(Y), true);
    assert.equal(holds(X2), false, 'the layer drops it - no ghost wagon there for 72 h');
    const bob = await join(X2, 'bob1', 2);
    assert.deepEqual(bob.sent.find((f) => f.t === 'parks').data, [], 'a stranger in that layer is handed none');
    // parked in Y's layer 3, then in Y's place: the same cell, another object
    const annY3 = await join(Y3, 'ann1', 3);
    await park(Y3, annY3, { c: CA, a: [YX, AZ], r: { w: WG(YX) } });
    assert.equal(holds(Y), false, 'the place dropped it');
    assert.equal(holds(Y3), true);
    // ann walks to X's place and her client says the team stands in Y: X holds no record of it, so names no layer
    const annX = await join(X, 'ann1');
    await park(X, annX, { c: CA, a: [YX, AZ] });
    assert.equal(holds(Y3), true, 'Y\'s layer 3 still holds her team - a word naming no layer leaves the kept one standing');
    assert.deepEqual(reg(), { cell: Y, at: reg().at, ly: 3 });
    await park(Y, annY, { c: CA, a: [YX, AZ], r: { w: WG(YX) } });
    assert.equal(holds(Y3), false, 'parked again in Y\'s place: the layer drops it');
    assert.equal(holds(Y), true);
    // a registry record from before it names no layer: the place, as it always was
    const k2 = await parkKeyOf('acct-cid1', CA);
    const cid = await join(X, 'cid1', 0);
    const cidPark = (name, ws, x) => { const r = w.room(name); r.room._meterOf(ws).parkBucket = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data: { c: CA, a: [x, AZ], r: { w: WG(x) } } })); };
    await cidPark(X, cid, AX);
    w.room(parkRegistryRoom(k2)).store.set('reg', { cell: X, at: 1 });
    const cidY = await join(Y, 'cid1');
    await cidPark(Y, cidY, YX);
    assert.equal(w.room(X).store.has(parkKey(k2)), false, 'the old record\'s place dropped');
  });
});

// ═══ R3-9: A HALL WIPED IN EVERY LAYER ═══════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R3-9 the hub\'s wipe of a zone hall reaches every layer: each one nobody stands in forgets its memory, a layer someone stands in keeps its own and answers the hall occupied (mutants: the place alone; an occupied layer answered wiped)', async () => {
  await quiet(async () => {
    const h = '120,80', key = wdunRoomKey(h);
    const W = fakeRooms();
    const hub = W.room(SOCIAL_ROOM);
    const layers = Array.from({ length: LAYERS_MAX }, (_, ly) => W.room(layerName(key, ly)));
    for (const R of [layers[0], layers[2], layers[LAYERS_MAX - 1]]) { await R.state.storage.put('world:meta', { at: 1, by: 'x' }); await R.state.storage.put('world:0', '{"piles":"looted"}'); }
    const memory = (R) => [...R.store.keys()].filter((k) => k.startsWith('world:'));
    const p2 = layers[2].connect(); p2.att.key = key; p2.att.ly = 2; await layers[2].hello(p2, 'peer-0001', null);
    assert.equal(await hub.room._wdunWipe(h), false, 'a layer someone stands in: the hall is occupied');
    assert.deepEqual(memory(layers[0]), [], 'the place, empty, wiped');
    assert.deepEqual(memory(layers[LAYERS_MAX - 1]), [], 'and the last layer');
    assert.deepEqual(memory(layers[2]).sort(), ['world:0', 'world:meta'], 'the occupied layer keeps its own');
    await layers[2].drop(p2);
    assert.equal(await hub.room._wdunWipe(h), true, 'nobody in any layer: wiped whole');
    assert.deepEqual(memory(layers[2]), []);
  });
});

// ═══ R3-3 (c): EVERY EVENT IS THE PLACE'S ═══════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R3-3 (c) a layer stands no circle and keeps no overworld ledger: a layer\'s rite word tells the hub nothing and keeps nothing, its ledger word writes and says nothing - nobody struck - while the place keeps both (mutants: a layer\'s circle told the hub; a layer\'s ledger)', async () => {
  // the rite (the wb12d pins' circle: day 200 at map pixel 300,200)
  const DAY = 200, TT = gateTimes(DAY), PX = 300, PY = 200, RCELL = worldRoom(PX, PY);
  const [rx, rz] = riteNativeOf(DAY, PX, PY);
  const AT = { x: rx + 3 * RITE_UNITS_PER_M, y: 0, z: rz, yaw: 0, pitch: 0 };
  const rite = JSON.stringify({ t: 'rite', d: DAY, px: PX, py: PY, s: 1, f: 1 });
  await onClock(TT.omenAt + 60_000, async ({ tick }) => {
    const W = fakeRooms();
    const hub = W.room(SOCIAL_ROOM), L0 = W.room(RCELL), L3 = W.room(layerName(RCELL, 3));
    const told = [];
    const get = W.ROOMS.get;
    W.ROOMS.get = (id) => { const o = get(id); return { fetch: (req) => { told.push([id, new URL(req.url).pathname]); return o.fetch(req); } }; };
    const b = L3.connect(); b.att.key = RCELL; b.att.ly = 3; await L3.hello(b, 'peer-0002', AT);
    tick(1000);
    await L3.raw(b, rite);
    assert.equal(L3.store.has('rite'), false, 'no circle kept in the layer');
    assert.deepEqual(told.filter(([, path]) => path === wire.RITE_INTERNAL_BROKEN), [], 'and the hub never told the rite broken');
    assert.equal(hub.store.has('rite'), false);
    assert.equal(L3.room._meterOf(b).junk ?? 0, 0, 'nobody struck');
    const a = L0.connect(); await L0.hello(a, 'peer-0001', AT);
    tick(1000);
    await L0.raw(a, rite);
    assert.ok(L0.store.get('rite')?.c?.[`${PX},${PY}`]?.f, 'the place\'s circle broken');
    assert.ok(told.some(([id, path]) => id === SOCIAL_ROOM && path === wire.RITE_INTERNAL_BROKEN), 'and the hub told');
  });
  // the overworld ledger (the ow6 pins' cell: map pixel 100,200 at a moment past the keep's own length)
  const T0 = Date.UTC(2027, 3, 1, 12, 0, 0), OCELL = worldRoom(100, 200);
  const ON = { x: 100 * PIXEL_UNITS + 16384, y: 0, z: (499 - 200) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };
  const band = `b44.142.${Math.floor(T0 / BAND_LIFE_MS)}`;
  const spent = JSON.stringify({ t: 'ow', k: 'sp', ids: [band] });
  await onClock(T0, async () => {
    const W = fakeRooms();
    const L0 = W.room(OCELL), L2 = W.room(layerName(OCELL, 2));
    const b = L2.connect(); b.att.key = OCELL; b.att.ly = 2; await L2.hello(b, 'peer-0002', ON);
    const c = L2.connect(); c.att.key = OCELL; c.att.ly = 2; await L2.hello(c, 'peer-0003', ON);
    await L2.raw(b, spent);
    assert.equal(L2.store.has(wire.OW_LEDGER_KEY), false, 'no ledger written in the layer');
    assert.deepEqual([b, c].map((ws) => ws.sent.filter((m) => m.t === 'ow').length), [0, 0], 'and nothing said');
    assert.equal(L2.room._meterOf(b).junk ?? 0, 0, 'nobody struck');
    const late = L2.connect(); late.att.key = OCELL; late.att.ly = 2; await L2.hello(late, 'peer-0004', ON);
    assert.equal(late.sent.find((m) => m.t === 'welcome').ow, undefined, 'a later welcome in the layer carries none - the band stands again there');
    const a = L0.connect(); await L0.hello(a, 'peer-0001', ON);
    await L0.raw(a, spent);
    assert.deepEqual(L0.store.get(wire.OW_LEDGER_KEY)?.sp?.map((e) => e[0]), [band], 'the place\'s ledger');
  });
});

test('AUDIT SCALE II R3-3 (c) a layer deals no cards and spends no stake: a sit there - staked, for chips, ranked or not - and a top-up are refused before anything is spent, in the client\'s own words; a void there is spent by the place, once for every layer, its receipt handed over in the layer and owed in both; what a layer owes it keeps telling (mutants: a layer\'s staked sit; its chips sit; its top-up; its Iliac sit; its void spent in the layer; the place\'s spend unremembered)', async () => {
  const { subtle } = webcrypto;
  const gateKey = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'));
  const ROOM = 'interior:m100.200';
  await onClock(1e12, async ({ tick, now }) => {
    const W = fakeRooms();
    const P = W.room(ROOM), L = W.room(layerName(ROOM, 2));
    P.env.GATE_SIGNING_KEY = L.env.GATE_SIGNING_KEY = gateKey;
    const a = L.connect(); a.att.key = ROOM; a.att.ly = 2; await L.hello(a, 'peer-a', null, { name: 'peer-a' });
    P.env.IDENTITY_PUBLIC_KEY = L.env.IDENTITY_PUBLIC_KEY;   // one service key, as every object of the deploy holds it
    const kp = await L.signer(), nowS = () => Math.floor(now() / 1000);
    let n = 0;
    const order = async (o = {}) => { const cj = (0xb0000000 + ++n).toString(16).padEnd(20, '0'); return { cj, stake: await mintStakeOrder({ s: 'acct-peer-a', cj, cr: ROOM, ct: 1, ca: 500, cb: 10, ...o }, kp.privateKey, { subtle, nowS: nowS() }) }; };
    const holdem = (o) => { tick(300); return L.raw(a, JSON.stringify({ t: 'holdem', ...o })); };
    const said = (t) => a.sent.filter((m) => m.t === t);
    const receipts = () => said('holdem').filter((m) => m.cashout).map((m) => readCardReceipt(m.cashout)).map((x) => [x.j, x.r, x.w]);
    const spentIn = (R) => [...R.store.keys()].filter((k) => k.startsWith('cstake:')).sort();
    // a staked sit, a chips sit and a top-up: refused, nothing spent, no table
    const oa = await order();
    await holdem({ op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10, stake: oa.stake });
    assert.equal(said('holdem').at(-1).error, 'stakes closed');
    await holdem({ op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10 });
    assert.equal(said('holdem').at(-1).error, 'bad table');
    await holdem({ op: 'topup', table: 1, stake: oa.stake });
    assert.equal(said('holdem').at(-1).error, 'stakes closed');
    for (const w of ['stakes closed', 'bad table']) { assert.ok(HOLDEM_REFUSALS[w], `${w}: in the client's words`); assert.ok(SIT_REFUSALS.includes(w), `${w}: a chair the client lets go`); }
    assert.equal((await L.room._holdemOf()).size, 0, 'no table in the layer');
    assert.deepEqual([spentIn(L), spentIn(P), receipts()], [[], [], []], 'no order spent anywhere');
    // Iliac: a ranked sit and a friendly one
    const deck = [...STARTER_DECK];
    const dorder = await mintDeckOrder({ s: 'acct-peer-a', dh: await deckDigest(deck, { subtle }) }, kp.privateKey, { subtle, nowS: nowS() });
    tick(300); await L.raw(a, JSON.stringify({ t: 'iliac', op: 'sit', table: 2, chair: 0, chairs: 2, deck, order: dorder }));
    assert.equal(said('iliac').at(-1).error, 'ranked closed');
    tick(300); await L.raw(a, JSON.stringify({ t: 'iliac', op: 'sit', table: 2, chair: 0, chairs: 2, deck }));
    assert.equal(said('iliac').at(-1).error, 'busy');
    for (const w of ['ranked closed', 'busy']) assert.ok(ILIAC_ONLINE_REFUSALS[w], `${w}: in the client's words`);
    assert.equal((await L.room._iliacOf()).size, 0, 'no Iliac table in the layer');
    // the stake the service holds for that refused sit comes home: the device voids it, and the place spends it
    await holdem({ op: 'void', table: 1, stake: oa.stake });
    assert.deepEqual(receipts(), [[oa.cj, 500, 'void']], 'the whole stake back, handed over in the layer');
    assert.deepEqual([spentIn(L), spentIn(P)], [[], [`cstake:${oa.cj}`]], 'spent by the place, never the layer');
    assert.equal(P.store.get('cashout:acct-peer-a')?.length, 1, 'owed by the place');
    assert.equal(L.store.get('cashout:acct-peer-a')?.length, 1, 'and by the layer that handed it over');
    await holdem({ op: 'void', table: 1, stake: oa.stake });
    assert.equal(said('holdem').at(-1).error, 'stake spent', 'voided once, for every layer');
    // an order the place already spent (a seat there) is never handed back by a layer
    const ob = await order();
    P.store.set(`cstake:${ob.cj}`, nowS());
    await holdem({ op: 'void', table: 1, stake: ob.stake });
    assert.equal(said('holdem').at(-1).error, 'stake spent');
    assert.equal(receipts().length, 1, 'no second receipt');
    // what the layer owes, it keeps telling at a look - as any room does
    const before = receipts().length;
    await holdem({ op: 'look', table: 1 });
    assert.equal(receipts().length, before + 1, 'told again at a look in the layer');
    await holdem({ op: 'ack', table: 1, j: oa.cj });
    assert.equal(L.store.has('cashout:acct-peer-a'), false, 'and kept until the device holds it');
  });
});

// ═══ D-8: THE BATCHES' NUMBERS THE RECORD STATES ═════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II D-8 the second wire\'s batches are the record\'s: a room\'s poses twenty times a second (POSE_BATCH_MS 50), a channel\'s roster once a second (ROSTER_BATCH_MS 1000) (mutants: either doubled)', () => {
  assert.equal(POSE_BATCH_MS, 50);
  assert.equal(ROSTER_BATCH_MS, 1000);
});
