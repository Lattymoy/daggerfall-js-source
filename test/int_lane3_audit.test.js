// AUDIT INT11-INT15 (2026-10-10, the INTEGRITY arc's lane 3 audited - bible/06-Systems/Integrity-Arc.md section 6b): what
// the review of lane 3 as first built found, each pinned where it was found. The body's word on a bucket of its own (it
// took a fight's blows' and a coil's word), and said by the relay of the socket it leaves on (a halo's is its own); the
// relay's trail by SOCKET, a pose's place NOT KNOWN when every one came after the landing, and only fighters' poses kept
// while their fight lives; a ship's hull new when she comes back from her yard; an ally's heal the count's, not the
// body's own budget's; a ship the count wrecked floated by it, whatever her once-said `wr 0` met; the count's fall told
// again until its game takes it; a hull's word waking no sleeping fight; the census read once a beat; and a doc comment
// back over its constant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BODY_DEFAULT, BODY_AFTER_MS, BODY_SAY_MS, BODY_TELL_MS, BODY_TRAIL_MS, HULL_REFLOAT, bodyStruck, bodySaid, bodyHealed, bodyTellOwed, newBody } from '../src/net/bossBody.js';
import { judgeGate, posAt, posAfter } from '../src/net/bossRef.js';
import { COURT_CENTRE, ATTACKS, profileOf, BRAIN_TICK_MS, HIT_KINDS, GATE_FIGHTERS_MAX, healRef } from '../src/net/gateBrain.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import {
  GATE_BRAIN_V, GATE_HZ_MAX, SERPENT_HZ_MAX, SD_FIGHT_HZ, BODY_WORD_HZ_MAX, bodyWordGate, bodyWordRelayGate, RELAY_VERSION, BOSS_REF_RELAY_MIN,
  PIXEL_UNITS, cellRoomOfWire, serpentFightId, worldRoom,
} from '../src/net/wire.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import { SERPENT_ATTACK_TABLE, SERPENT_TICK_MS, SERPENT_ABSENT_RETIRE_MS } from '../src/net/serpentBrain.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { fakeRooms } from './fakeRoom.mjs';
import { standService } from './accountDb.mjs';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { bodiesMeasure, measure } from '../server-account/src/review.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const ENFORCE = JSON.stringify({ enforce: true });
const near = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} vs ${b}`);
const LINE = BODY_DEFAULT.body;

// ═══ THE GATE'S HARNESS (test/int12_body_relay.test.js's) ═══════════════════════════

const DAY = 200;
const TT = gateTimes(DAY);
const KEY = gateRoomKey(DAY);
const at = (x, z, extra = {}) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...extra });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
async function withGate(fn, { env = {} } = {}) {
  const realNow = Date.now; let clock = TT.openAt + 1000;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(KEY);
    Object.assign(r.env, env);
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
    await quiet(() => fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } }));
  } finally { Date.now = realNow; }
}
const lay = (f, now, a, inMs = 100) => { f.atk = { i: (f.seq = (f.seq ?? 0) + 1), a: a.id, at: now + inMs, x: 0, z: 0, yw: 0, tg: [], until: now + inMs + a.active + Math.max(a.recover, 1000) }; };

// ═══ THE SERPENT'S HARNESS ═══════════════════════════════════════════════════════════

const SDAY = 363;
const ST = serpentTimes(SDAY);
const SPX = 205, SPY = 214;
const SX = (SPX + 0.5) * PIXEL_UNITS, SZ = (499 - SPY + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
const sat = (mx, mz, extra = {}) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0, ...extra });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'serpent' && (!k || m.k === k));
const IN = (o = {}) => ({ k: 'in', d: SDAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ, ...o });
async function withSea(fn, env = {}) {
  const realNow = Date.now; let clock = ST.riseAt + 20_000;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(CELL);
    Object.assign(r.env, env);
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += SERPENT_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'serpent', ...o }));
    await quiet(() => fn({ r, tick, say, now: () => clock, set: (t) => { clock = t; } }));
  } finally { Date.now = realNow; }
}
/** Two ships at her waters, the first `A`'s; the serpent cruising round its heart (a blow from 150 m lands). */
async function twoShips({ r, say, tick, now }) {
  const a = r.connect(); await r.hello(a, 'peer-0001', sat(150, 0));
  const b = r.connect(); await r.hello(b, 'peer-0002', sat(-150, 300));
  await say(a, IN()); await say(b, IN());
  const f = r.room._serpents.get(serpentFightId(SDAY, serpentSiteKey(SX, SZ))), A = 'acct-peer-0001';
  await tick(2);
  const cruise = () => { f.legs = [{ k: 1, at: now() - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }]; f.modes = [{ at: now() - 30_000, m: 1 }]; };
  return { a, b, f, A, p: f.players[A], cruise };
}
/** Her lash, landing on (100, 0) - her helm 150 m out is deep in it. */
const lash = (f, now) => { f.atk = { i: (f.seq = (f.seq ?? 0) + 77), a: SERPENT_ATTACK_TABLE.lash.id, at: now + 100, x: 100, z: 0, yw: Math.PI / 2, tg: [[100, 0]], until: now + 3000 }; };
const LANDED = Math.ceil((100 + BODY_AFTER_MS) / SERPENT_TICK_MS) + 1;

// ═══ THE BODY'S WORD, ON ITS OWN BUCKET ═══════════════════════════════════════════════

test('AUDIT INT15 THE BODY\'S WORD ON A BUCKET OF ITS OWN: BODY_WORD_HZ_MAX a second, bodySayer\'s own pace (pinned equal); the client\'s at it, the relay\'s with a burst - and at the relay a gate\'s sixteen frames and a serpent\'s ten all taken beside four body words in the same instant (mutants: the word back on the blows\' bucket at the relay; the relay\'s burst gone)', async () => {
  assert.equal(BODY_WORD_HZ_MAX, 1000 / BODY_SAY_MS, 'the word at bodySayer\'s pace');
  let b = null, n = 0;
  for (let i = 0; i < 10; i++) { const g = bodyWordGate(b, 0); b = g.bucket; if (g.pass) n++; }
  assert.equal(n, BODY_WORD_HZ_MAX, 'the client\'s: the pace, no more');
  b = null; n = 0;
  for (let i = 0; i < 20; i++) { const g = bodyWordRelayGate(b, 0); b = g.bucket; if (g.pass) n++; }
  assert.equal(n, BODY_WORD_HZ_MAX + 4, 'the relay\'s: a burst the way bunched');
  b = null; n = 0;
  for (let t = 0; t < 10_000; t += BODY_SAY_MS) { const g = bodyWordGate(b, t); b = g.bucket; if (g.pass) n++; }
  assert.equal(n, 40, 'four a second, sustained');
  await withGate(async ({ r, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 0));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    for (let i = 0; i < BODY_WORD_HZ_MAX; i++) await say(a, { k: 'vt', v: 1000 });
    for (let i = 0; i < GATE_HZ_MAX - 1; i++) await say(a, { k: 'hit', q: i + 1, d: 1, r: HIT_KINDS.Spell });
    assert.equal(a.meters.gateDrops ?? 0, 0, 'the `in` and fifteen blows beside four body words: none refused');
    await say(a, { k: 'hit', q: 99, d: 1, r: HIT_KINDS.Spell });
    assert.equal(a.meters.gateDrops, 1, 'the seventeenth frame the gate\'s own refusal');
    for (let i = 0; i < 4; i++) await say(a, { k: 'vt', v: 1000 });
    assert.equal(a.meters.bodyDrops ?? 0, 0);
    await say(a, { k: 'vt', v: 1000 });
    assert.equal(a.meters.bodyDrops, 1, 'past its burst, the body\'s own');
  });
  await withSea(async ({ r, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', sat(150, 0));
    await say(a, IN());
    for (let i = 0; i < BODY_WORD_HZ_MAX; i++) await say(a, { k: 'vt', v: 1000 });
    for (let i = 0; i < SERPENT_HZ_MAX - 1; i++) await say(a, { k: 'hit', d: 1, z: 0 });
    assert.equal(a.meters.serpentDrops ?? 0, 0, 'her `in` and nine volleys beside four hull words: none refused');
  });
});

test('AUDIT INT15 THE CLIENT\'S WORD: a body\'s `vt` leaves on its own bucket - sixteen gate frames, and sixteen of the Hour\'s, still go beside four of it - and only to a relay that counts, BY THE SOCKET IT LEAVES ON: a serpent\'s cell on a halo whose relay is older hears none though the primary\'s counts, and one whose relay counts hears it though the primary\'s does not; a halo promoted to primary, and the primary stepped down, each keep their own (mutants: the word on the gate\'s or the Hour\'s bucket; the halo sent on the primary\'s word; the halo\'s own word never kept; either side\'s word lost at the promotion)', () => {
  const log = console.info; console.info = () => {};
  try {
    {
      const { FakeWS, sockets } = fakeSocketClass();
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
      s.join(KEY, at(0, 0));
      sockets[0].open();
      sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION });
      let vt = 0, hits = 0;
      for (let i = 0; i < BODY_WORD_HZ_MAX; i++) if (s.sendGate({ k: 'vt', v: 900 })) vt++;
      for (let i = 0; i < GATE_HZ_MAX; i++) if (s.sendGate({ k: 'hit', q: i + 1, d: 5, r: HIT_KINDS.Spell })) hits++;
      assert.deepEqual([vt, hits], [BODY_WORD_HZ_MAX, GATE_HZ_MAX], 'every blow of a second beside its body\'s words');
      assert.equal(s.sendGate({ k: 'vt', v: 900 }), false, 'the body\'s bucket its own');
    }
    {
      const { FakeWS, sockets } = fakeSocketClass();
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
      s.join(sdRoomKey(3), null);
      sockets[0].open();
      sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION });
      let vt = 0, hits = 0;
      for (let i = 0; i < BODY_WORD_HZ_MAX; i++) if (s.sendSdBlow('vt', { v: 900 })) vt++;
      for (let i = 0; i < SD_FIGHT_HZ; i++) if (s.sendSdBlow('hit', { q: i + 1, d: 5, r: HIT_KINDS.Spell })) hits++;
      assert.deepEqual([vt, hits], [BODY_WORD_HZ_MAX, SD_FIGHT_HZ], 'the Hour\'s blows beside its body\'s words');
    }
    const ON = sat(0, 0);
    const PX = Math.floor(SX / PIXEL_UNITS), PY = 499 - Math.floor(SZ / PIXEL_UNITS);
    const mine = worldRoom(PX + 16, PY);
    for (const [primary, halo, ok] of [[RELAY_VERSION, `world${BOSS_REF_RELAY_MIN - 1}`, false], [`world${BOSS_REF_RELAY_MIN - 1}`, RELAY_VERSION, true]]) {
      const { FakeWS, sockets } = fakeSocketClass();
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
      s.join(mine, ON);
      sockets[0].open();
      sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: primary });
      s.setHalo([CELL]);
      const h = sockets[1];
      h.open();
      h.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: halo });
      assert.equal(s.sendSerpent({ k: 'vt', v: 500 }, CELL), ok, `primary ${primary}, halo ${halo}`);
      assert.equal(h.sent.filter((x) => JSON.parse(x).k === 'vt').length, ok ? 1 : 0, 'down the halo\'s own socket, or none');
      assert.equal(sockets[0].sent.filter((x) => JSON.parse(x).k === 'vt').length, 0, 'never the primary\'s');
      // her cell crossed into: the halo promoted, the primary stepped down - each socket's word goes with it
      s.join(CELL, ON);
      assert.equal(s.room, CELL);
      assert.equal(s.sendSerpent({ k: 'vt', v: 500 }, CELL), ok, 'the promoted socket\'s own relay');
      assert.equal(s.sendSerpent({ k: 'vt', v: 500 }, mine), !ok, 'the stepped-down socket\'s own relay');
    }
  } finally { console.info = log; }
  const host = rd('src/scenes/serpentHost.js');
  assert.match(host, /const sayHull = bodySayer\(\(v\) => !!live && !!deps\.online\?\.send\?\.\(\{ k: 'vt', v \}/, 'the host asks no version of its own - the session asks the socket\'s');
});

// ═══ THE TRAIL ═══════════════════════════════════════════════════════════════════

test('AUDIT INT11 WHERE IT STOOD, NOT KNOWN: a trail whose every pose came after the landing (or an empty one - the relay\'s word that it does not know) says nothing of where the body stood at it, and the body is not struck; no trail is where it stands (mutants: the first pose after read as where it stood)', () => {
  const t1 = 10_000;
  const bd = (sub, x, z, o = {}) => ({ sub, x, z, dead: false, ...o });
  assert.equal(posAt(bd('q', 5, 6, { tr: [[t1 + 1, 0, 0]] }), t1), null, 'all after: not known');
  assert.equal(posAt(bd('q', 5, 6, { tr: [] }), t1), null, 'none kept, the trails younger than a trail: not known');
  assert.deepEqual(posAt(bd('q', 5, 6), t1), [5, 6], 'no trail: where it stands');
  assert.deepEqual(posAfter(bd('q', 5, 6, { tr: [] }), t1), [5, 6]);
  const f = { players: { s1: {}, s2: {} }, atk: null, bjAt: null };
  const slam = ATTACKS.slam;
  f.atk = { i: 1, a: slam.id, at: t1, x: 0, z: 0, yw: 0, tg: [] };
  const hits = judgeGate(f, [bd('s1', 0, 0, { tr: [[t1 + 50, 0, 0]] }), bd('s2', 0, 0, { tr: [[t1 - 50, 0, 0], [t1 + 50, 0, 0]] })], t1 + BODY_AFTER_MS);
  assert.deepEqual(hits.map((h) => h.sub), ['s2'], 'the one that stepped in after is not struck');
});

test('AUDIT INT11 A TRAIL A SOCKET\'S, A FIGHTER\'S, WHILE ITS FIGHT LIVES: a court\'s watcher keeps none, a fighter\'s poses each socket its own; its `in` and its hello put it where it stands from then; a room woken from its sleep knows no trail for a trail\'s span and strikes nobody it cannot place; a cell whose serpent fell keeps none (mutants: the trail by account; every socket\'s kept; the wake read as standing still)', async () => {
  await withGate(async ({ r, say, tick, now, set }) => {
    const a = r.connect(), w = r.connect();
    await r.hello(a, 'peer-0001', at(0, 0)); await r.hello(w, 'peer-0009', at(5, 0));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    await r.pose(w, at(6, 0)); await r.pose(a, at(0, 1));
    const trails = r.room._trails;
    assert.ok(trails.has(a), 'the fighter\'s socket keeps its own');
    assert.equal(trails.has(w), false, 'a watcher keeps none');
    assert.deepEqual(trails.get(a).map((p) => p[3] - COURT_CENTRE[2]), [0, 1], 'seeded at its `in` where its hello put it, then its pose');
    // a reconnect: a new socket of the same account stands where its hello put it, on a trail of its own
    const a2 = r.connect(); await r.hello(a2, 'peer-0001', at(0, 0.5));
    assert.ok(trails.has(a2) && trails.get(a2).length === 1, 'its hello on its own trail');
    await r.drop(a);
    assert.equal(trails.has(a), false, 'a socket gone takes its trail');
    // the wake: a landing just after it, the body never posed since - not struck; a trail's span later it stands still
    const f = r.room._fight, A = 'acct-peer-0001';
    r.wake();
    const f2 = await r.room._gateFightOf();
    lay(f2, now(), ATTACKS.slam);
    await tick(Math.ceil((100 + BODY_AFTER_MS) / BRAIN_TICK_MS) + 1);
    assert.equal(f2.players[A].bd?.t ?? 0, 0, 'woken: where it stood is not known');
    set(now() + BODY_TRAIL_MS + 100);
    lay(f2, now(), ATTACKS.slam);
    await tick(Math.ceil((100 + BODY_AFTER_MS) / BRAIN_TICK_MS) + 1);
    assert.ok((f2.players[A].bd?.t ?? 0) > 0, 'a trail\'s span on, it stands where its last pose put it');
    assert.ok(f, 'the fight held across the wake');
  });
  await withSea(async ({ r, say, tick, now }) => {
    const { a, f } = await twoShips({ r, say, tick, now });
    assert.ok(r.room._trails?.has(a), 'a fighter of a living fight trailed');
    f.fell = { at: now() };
    r.room._trails.clear();
    await r.pose(a, sat(151, 0));
    assert.equal(r.room._trails.has(a), false, 'a cell whose serpent fell trails nothing');
  });
});

test('AUDIT INT11 A SECOND SOCKET IS NO DECOY: a ship\'s body is judged on the trail of the socket that speaks for her (her newest here), however another of her sockets poses far off - and a volley from any but that socket lands nothing (mutants: the trail by account; a volley from any socket)', async () => {
  await withSea(async ({ r, say, tick, now, set }) => {
    const { a, f, p, cruise } = await twoShips({ r, say, tick, now });
    const decoy = r.connect(); await r.hello(decoy, 'peer-0007', sat(900, 900), { tokenSub: 'acct-peer-0001' });
    const real = r.connect(); await r.hello(real, 'peer-0008', sat(150, 0), { tokenSub: 'acct-peer-0001' });   // newest: hers
    await say(a, { k: 'vt', v: 1000 }); await say(real, { k: 'vt', v: 1000 });
    for (let i = 0; i < 6; i++) { set(now() + 50); await r.pose(decoy, sat(900, 900)); await r.pose(real, sat(150, 0)); }
    lash(f, now());
    for (let i = 0; i < LANDED; i++) { await tick(1); await r.pose(decoy, sat(900, 900)); }
    assert.ok(p.bd.t > 0, 'struck where her own socket stands, the decoy\'s poses read for nothing');
    set(now() + 1000); cruise();
    let dealt = p.dealt;
    await say(real, { k: 'hit', d: 50, z: 0 });
    assert.ok(p.dealt > dealt, 'from the socket that speaks for her, a volley lands');
    // the cheat the other way: a socket newer still, far off, speaks for her body - a volley from the near one is no one's
    const far = r.connect(); await r.hello(far, 'peer-0006', sat(900, 900), { tokenSub: 'acct-peer-0001' });
    set(now() + 1000); cruise();
    dealt = p.dealt;
    await say(real, { k: 'hit', d: 50, z: 0 });
    assert.equal(p.dealt, dealt, 'a volley from a socket that does not speak for her lands nothing, however near');
  });
});

// ═══ THE HULL ════════════════════════════════════════════════════════════════════

test('AUDIT INT13 A SHIP BACK FROM HER YARD IS A NEW HULL: back at the fight after SERPENT_ABSENT_RETIRE_MS away, the count of the hull she left with is not hers - whole, her budget full, her measure kept; a ship that never left keeps her count (mutants: the count kept across her absence; any ship made new)', async () => {
  await withSea(async ({ r, say, tick, now }) => {
    const { f, p, A } = await twoShips({ r, say, tick, now });
    await r.raw(r.sockets[0], JSON.stringify({ t: 'serpent', k: 'vt', v: 1000 }));
    bodyStruck(p, 0.8, now(), BODY_DEFAULT.hull);
    await tick(2);
    near(p.bd.v, 0.2, 'here all along: her count kept');
    p.seenAt = now() - SERPENT_ABSENT_RETIRE_MS - 1;
    await tick(1);
    assert.equal(p.bd.v, 1, 'back from away: a new hull');
    near(p.bd.t, 0.8, 'her measure kept');
    assert.equal(f.players[A], p);
  });
});

test('AUDIT INT13 A SHIP THE COUNT WRECKED, FLOATED BY IT (ENFORCED) - THE PRODUCER\'S OWN SHAPE: her game wrecks her (`wr 1`), floats her as her patches pass HULL_REFLOAT and says `wr 0` ONCE, while the count still holds her; the count\'s float a word later floats her, with no word again. And a game that missed the `bd`: told again every BODY_TELL_MS until it says its wreck, and floated by the count all the same (mutants: the held `wr 0` dropped; the count\'s float floating nobody; no telling again; telling a game that took it)', async () => {
  await withSea(async ({ r, say, tick, now }) => {
    const { a, f, p } = await twoShips({ r, say, tick, now });
    await say(a, { k: 'vt', v: 1000 });
    bodyStruck(p, 0.97, now(), BODY_DEFAULT.hull);
    lash(f, now());
    await tick(LANDED);
    assert.deepEqual([p.bd.dn, p.wreck], [true, true], 'the count wrecked her');
    assert.equal(words(a, 'bd').length, 1);
    await say(a, { k: 'wr', w: 1 });   // her game took it
    await say(a, { k: 'vt', v: 0 });
    await tick(Math.ceil(BODY_TELL_MS / SERPENT_TICK_MS) + 2);
    assert.equal(words(a, 'bd').length, 1, 'a game that said its wreck is told no more');
    // her carpenters: her game floats her past the sea's FIELD_REFLOAT and says so once - the count still holds her
    await say(a, { k: 'vt', v: Math.round(HULL_REFLOAT * 1000) + 1 });
    await say(a, { k: 'wr', w: 0 });
    assert.equal(p.wreck, true, 'unheard while the count holds her');
    for (let i = 0; i < 40 && p.bd.dn; i++) { await tick(4); await say(a, { k: 'vt', v: 300 }); }
    assert.equal(p.bd.dn, false, 'the count floated her');
    assert.equal(p.wreck, false, 'and her held word with it - no `wr 0` again');
  }, { BOSS_BODY: ENFORCE });
  await withSea(async ({ r, say, tick, now }) => {
    const { a, f, p } = await twoShips({ r, say, tick, now });
    await say(a, { k: 'vt', v: 1000 });
    bodyStruck(p, 0.97, now(), BODY_DEFAULT.hull);
    lash(f, now());
    await tick(LANDED);
    assert.equal(words(a, 'bd').length, 1);
    await tick(Math.ceil(BODY_TELL_MS / SERPENT_TICK_MS) + 1);
    assert.equal(words(a, 'bd').length, 2, 'her game never wrecked her: told again');
    assert.deepEqual(words(a, 'bd')[1], { t: 'serpent', k: 'bd', sx: f.sx, sz: f.sz }, 'with its site');
    for (let i = 0; i < 40 && p.bd.dn; i++) { await tick(4); await say(a, { k: 'vt', v: 600 }); }
    assert.equal(p.wreck, false, 'never said a wreck of her own: the count floated her');
  }, { BOSS_BODY: ENFORCE });
});

test('AUDIT INT13 A HULL\'S WORD WAKES NO SLEEPING FIGHT: heard before the fight is taken up - its beat is not moved by it, and nothing is armed (mutants: the fight taken up by the word)', async () => {
  await withSea(async ({ r, say, tick, now }) => {
    const { a, f, p } = await twoShips({ r, say, tick, now });
    f.lastTickAt = now() - 60_000;
    const alarm = r.alarm.at;
    await say(a, { k: 'vt', v: 800 });
    assert.equal(f.lastTickAt, now() - 60_000, 'still asleep');
    assert.equal(r.alarm.at, alarm);
    assert.equal(p.bd.sd, true, 'and her word heard');
  });
});

// ═══ THE COUNT'S FALL, TOLD AGAIN ═════════════════════════════════════════════════

test('AUDIT INT11 THE FALL TOLD AGAIN (bodyTellOwed): enforced, fallen by the count, no death seen since and BODY_TELL_MS on from the last telling - stamped as it answers; never unenforced, never to a body standing, never after its death (mutants: told every beat; told after its death; told unenforced)', () => {
  const T = 1_000_000;
  const p = {};
  bodyStruck(p, 1, T, LINE);
  assert.equal(bodyTellOwed(p, T, false), false, 'unenforced, nobody is told');
  assert.equal(bodyTellOwed(p, T, true), true);
  assert.equal(p.bd.ta, T);
  assert.equal(bodyTellOwed(p, T + BODY_TELL_MS - 1, true), false);
  assert.equal(bodyTellOwed(p, T + BODY_TELL_MS, true), true);
  p.bd.dd = T + 4000;
  assert.equal(bodyTellOwed(p, T + 10 * BODY_TELL_MS, true), false, 'its game took it');
  assert.equal(bodyTellOwed({ bd: newBody(T, LINE) }, T, true), false, 'a standing body');
  assert.equal(bodyTellOwed({}, T, true), false);
});

test('AUDIT INT11 A FALL ITS GAME MISSED (a court, ENFORCED): its word lost on a dying socket, the fighter\'s reconnect is told every BODY_TELL_MS until its game dies by it - then never again (mutants: told once alone; told past its death)', async () => {
  await withGate(async ({ r, say, tick, now }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 0));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    const f = r.room._fight;
    const send = a.send;
    a.send = function (x) { if (JSON.parse(x).k !== 'bd') send.call(this, x); };   // the word lost on its way
    lay(f, now(), ATTACKS.reckon);
    await tick(2);
    assert.equal(f.players['acct-peer-0001'].bd.dn, true);
    assert.equal(gates(a, 'bd').length, 0, 'its game never heard the fall');
    const a2 = r.connect(); await r.hello(a2, 'peer-0001', at(0, 0));
    assert.equal(gates(a2, 'bd').length, 0, 'not at its hello');
    await tick(Math.ceil(BODY_TELL_MS / BRAIN_TICK_MS) + 1);
    assert.deepEqual(gates(a2, 'bd'), [{ t: 'gate', k: 'bd' }], 'told again');
    await r.pose(a2, at(0, 0, { dd: 1 }));
    await tick(Math.ceil(3 * BODY_TELL_MS / BRAIN_TICK_MS));
    assert.equal(gates(a2, 'bd').length, 1, 'dead by it: told no more');
    assert.ok(now() > 0);
  }, { env: { BOSS_BODY: ENFORCE } });
});

// ═══ AN ALLY'S HEAL ══════════════════════════════════════════════════════════════

test('AUDIT INT11 AN ALLY\'S HEAL IS THE COUNT\'S (bodyHealed): after the body\'s word claimed it, the budget it paid given back and no longer the body\'s own believing; what was left unmet believed and no longer past the line; before the word, it stands the count up itself; fallen and enforced, nothing (mutants: the heal unheard; the budget not given back; past the line kept)', () => {
  const T = 1_000_000;
  // its word first: a mend of 0.4 out of the budget, then the heal that was it
  const a = {}; bodyStruck(a, 0.5, T, LINE);
  bodySaid(a, 0.9, T, LINE);
  near(a.bd.h, 0.4); near(a.bd.m, LINE.depth - 0.4);
  near(bodyHealed(a, 0.4, T, LINE), 0.4);
  near(a.bd.h, 0, 'no longer its own believing'); near(a.bd.m, LINE.depth, 'its budget given back'); near(a.bd.v, 0.9);
  // the budget short: past the line, then explained
  const b = {}; bodyStruck(b, 0.8, T, LINE);
  b.bd.m = 0.1;
  bodySaid(b, 0.8, T, LINE);
  near(b.bd.o, 0.5); near(b.bd.v, 0.3);
  bodyHealed(b, 0.6, T, LINE);
  near(b.bd.o, 0, 'no longer past the line'); near(b.bd.v, 0.8); near(b.bd.u, 0); near(b.bd.h, 0); near(b.bd.m, 0.1);
  // the heal first: the count stood up by it, the word after claiming nothing
  const c = {}; bodyStruck(c, 0.5, T, LINE);
  bodyHealed(c, 0.3, T, LINE);
  near(c.bd.v, 0.8);
  assert.equal(bodySaid(c, 0.8, T, LINE), false); near(c.bd.h, 0);
  // fallen
  const d = {}; bodyStruck(d, 1, T, LINE);
  assert.equal(bodyHealed(d, 0.5, T, LINE, { enforce: true }), 0); assert.equal(d.bd.v, 0);
  bodyHealed(d, 0.5, T, LINE); assert.equal(d.bd.dn, false, 'unenforced, it stands again');
  assert.equal(bodyHealed({}, NaN, T, LINE), 0); assert.equal(bodyHealed(null, 0.5, T, LINE), 0);
});

test('AUDIT INT11 AN ALLY\'S HEAL IN THE COURT: what the gate believed of a mate\'s heal (its own heal bucket), at the brain\'s reference health, given to the healed fighter\'s count - its own word\'s mend of it given back (mutants: the heal not counted)', async () => {
  await withGate(async ({ r, say, tick, now }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(0, 0)); await r.hello(b, 'peer-0002', at(3, 0));
    for (const ws of [a, b]) await say(ws, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    await say(a, { k: 'vt', v: 1000 });
    const f = r.room._fight, p = f.players['acct-peer-0001'];
    bodyStruck(p, 0.5, now(), LINE);
    await say(a, { k: 'vt', v: 900 });
    near(p.bd.h, 0.4);
    await say(a, { k: 'heal', h: [['peer-0002', Math.round(0.4 * healRef(10))]] });
    near(p.bd.h, 0, 'the mate\'s, not its own');
    near(p.bd.m, LINE.depth);
    assert.ok(f.players['acct-peer-0002'].healed > 0, 'the healer credited as ever');
    assert.ok(now() > 0 && tick);
  });
});

// ═══ THE BEAT ════════════════════════════════════════════════════════════════════

test('AUDIT INT11 THE BODIES READ ONCE A BEAT: the court\'s and the serpent\'s - the census run over them again for the brain, never built twice (mutants: the bodies built for each)', async () => {
  await withGate(async ({ r, say, tick }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 0));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    let n = 0;
    const real = r.room._gateBodies.bind(r.room);
    r.room._gateBodies = (f) => { n++; return real(f); };
    await tick(1);
    assert.equal(n, 1);
  });
  await withSea(async ({ r, say, tick, now }) => {
    await twoShips({ r, say, tick, now });
    let n = 0;
    const real = r.room._serpentBodies.bind(r.room);
    r.room._serpentBodies = (...x) => { n++; return real(...x); };
    await tick(1);
    assert.equal(n, 1);
  });
  assert.ok(GATE_FIGHTERS_MAX > 0 && profileOf);
});

test('AUDIT INT11 THE THREE FIGHTS ALIKE: the court\'s, the Hour\'s and the serpent\'s each put a fighter\'s socket on its trail at its `in`, read their bodies once a beat and tell a fall again; the body\'s word on its own bucket at each (mutants: one fight left out)', () => {
  const relay = rd('server/src/index.js');
  const n = (re) => (relay.match(re) ?? []).length;
  assert.equal(n(/this\._trailSeed\(ws, a, now\);   \/\/ AUDIT INT11/g), 3, 'seeded at each `in`');
  assert.equal(n(/this\._bodyTell\('(gate|sd|serpent)', f, now/g), 3, 'told again at each beat');
  assert.match(relay, /bodies = this\._sdFightBodies\(f, now\), census = \(\) => bodyCensus\(f, bodies, /, 'the Hour\'s read once');
  assert.equal(n(/m\.k === 'vt' \? !this\._spend\(ws, now, bodyWordRelayGate, 'bodyBucket', 'bodyDrops', 'too many body words'\)/g), 3, 'a body\'s word on its own bucket in each room');
});

test('AUDIT INT14 THE RANKS ONE LAW (review.js ranked): the boss fights\' measure and the wealth\'s read a quantile by its rank alike - the nearest rank at or below it (two receipts\' median the lower) (mutants: the rank rounded the other way)', async () => {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const nowS = Math.floor(Date.now() / 1000);
  const ann = await s.registered('annika'), bo = await s.registered('boris');
  const claim = async (who, m) => s.call('/v1/gate/claim', { receipt: await mintReceipt({ d: 5, b: 'ruhn', s: who.id, c: 7, x: 'dealt', l: 10, m }, s.gatePriv, { subtle: globalThis.crypto.subtle, nowS }) }, who.secret);
  await claim(ann, [0, 0, 0, 0, 1, 60]);
  await claim(bo, [0, 600, 0, 0, 1, 60]);
  const gate = (await bodiesMeasure(s.env.DB, nowS + 60, 7)).fights.find((x) => x.fight === 'gate');
  assert.deepEqual(gate.quantiles[0], [0.5, 0], 'two receipts: the median the lower');
  assert.equal(gate.most, 600);
  const wealth = await measure(s.env.DB, nowS + 60, 7);
  assert.ok(Array.isArray(wealth.bands) && wealth.bands.every((b) => b.quantiles.length === 4), 'the wealth\'s measure reads its ranks by the same');
});

// ═══ THE DOC ═════════════════════════════════════════════════════════════════════

test('AUDIT INT13 IN_RESEND_MS KEEPS ITS DOC: the constant the INT13 line was set between and its own comment, together again (mutants: none - text)', () => {
  const host = rd('src/scenes/serpentHost.js');
  assert.match(host, /\/\*\* How often an `in` is said again while I am within its waters' sight \(a reconnect, a halo come up, a share back\)\. \*\/\nexport const IN_RESEND_MS = 20_000;/);
  assert.match(host, /\/\*\* INT13: the line as the relay's count wrecks her \(`bd`\)\. \*\/\nexport const COUNT_WRECK_LINE = /);
});
