// INT11-INT15 (2026-10-10, the INTEGRITY arc's lane 3 - bible/06-Systems/Integrity-Arc.md section 6; Mac: "Measure, then
// enforce"): THE BODY COUNTED, DRIVEN. The relay over the real Room (test/fakeRoom.mjs): a gate's court, an Abyss
// Dungeon's realm and a serpent's cell each judge the boss's blows on the poses they hold and keep each fighter's count;
// the fighter's word (`vt`) believed as a mend; the count's measure on each receipt (`m`); under the default line nothing
// enforced, under an enforcing one the count's fall a fall - `bd` to the fallen, its blows landing nothing, the Hour's one
// life taken, a ship wrecked. The receipts each way, the account service keeping the measure and staff reading it, and
// the client's glue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BODY_DEFAULT, BODY_AFTER_MS, bodyStruck, bodyMeasure, bodyMeasureValid, HULL_REFLOAT } from '../src/net/bossBody.js';
import { COURT_CENTRE, ATTACKS, profileOf, BRAIN_TICK_MS, earned, HIT_KINDS } from '../src/net/gateBrain.js';
import { mintReceipt, readReceipt, verifyReceipt, receiptValid, importReceiptKey } from '../src/net/gateReceipt.js';
import { mintSdReceipt, readSdReceipt, sdReceiptValid } from '../src/net/sdReceipt.js';
import { mintSerpentReceipt, readSerpentReceipt, serpentReceiptValid } from '../src/net/serpentReceipt.js';
import { gateTimes, gateRoomKey, PIXEL_M } from '../src/net/gateLaw.js';
import {
  GATE_BRAIN_V, GATE_KINDS, GATE_OUT_KINDS, SD_KINDS, SD_OUT_KINDS, SERPENT_KINDS, SERPENT_OUT_KINDS, BODY_WORD_MAX, BOSS_REF_RELAY_MIN,
  relaySupportsBossRef, validGateIn, validGateOut, validSdIn, validSdOut, validSerpentIn, validSerpentOut, RELAY_VERSION, SOCIAL_ROOM, SD_KEY, worldRoom, PIXEL_UNITS,
  SD_BRAIN_V, cellRoomOfWire, serpentFightId,
} from '../src/net/wire.js';
import { realmToDungeon, SD_ARENA } from '../src/net/sdBrain.js';
import { SD_BLOWS, SD_END_PCT } from '../src/net/sdRemnant.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import { SERPENT_ATTACK_TABLE, SERPENT_TICK_MS } from '../src/net/serpentBrain.js';
import { fakeRooms } from './fakeRoom.mjs';
import { standService } from './accountDb.mjs';
import { claimGate } from '../server-account/src/accounts.js';
import { reviewAct, bodiesMeasure, BODY_TABLES } from '../server-account/src/review.js';
import { reviewRequest } from '../tools/realmReview.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { relayVersionAtLeast } from './relayVersion.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const ENFORCE = JSON.stringify({ enforce: true });

// ═══ THE WIRE ═══════════════════════════════════════════════════════════════════

test('INT11 THE WIRE: a body\'s word (`vt`, thousandths of its whole) a new kind of the gate\'s, the Abyss Dungeon\'s and the serpent\'s, bounded; the count\'s fall (`bd`) a new kind back, with no fields of its own (the serpent\'s with its site); the client says it to a relay at BOSS_REF_RELAY_MIN or later, which this tree builds (mutants: a word past the whole; a fall carrying fields; an older relay told)', () => {
  for (const kinds of [GATE_KINDS, SD_KINDS, SERPENT_KINDS]) assert.ok(kinds.includes('vt'));
  for (const kinds of [GATE_OUT_KINDS, SD_OUT_KINDS, SERPENT_OUT_KINDS]) assert.ok(kinds.includes('bd'));
  for (const valid of [validGateIn, validSdIn, validSerpentIn]) {
    assert.deepEqual(valid({ k: 'vt', v: 500, x: 1 }), { k: 'vt', v: 500 });
    assert.deepEqual(valid({ k: 'vt', v: 0 }), { k: 'vt', v: 0 });
    for (const v of [BODY_WORD_MAX + 1, -1, 0.5, '500', undefined]) assert.equal(valid({ k: 'vt', v }), null, `${v}`);
  }
  assert.deepEqual(validGateOut({ k: 'bd', h: 3 }), { k: 'bd' });
  assert.deepEqual(validSdOut({ k: 'bd', x: 1 }), { k: 'bd' });
  assert.deepEqual(validSerpentOut({ k: 'bd', sx: 10, sz: 20, q: 1 }), { k: 'bd', sx: 10, sz: 20 }, 'the serpent\'s with its site (the client folds its own - serpentHost wrecked)');
  assert.equal(relaySupportsBossRef(`world${BOSS_REF_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsBossRef(`world${BOSS_REF_RELAY_MIN}`), true);
  assert.equal(relaySupportsBossRef('nonsense'), false);
  assert.ok(relayVersionAtLeast(BOSS_REF_RELAY_MIN), 'the relay this tree builds counts');
  assert.equal(BOSS_REF_RELAY_MIN, 188, 'world188 the first that counts (world186 on its branch, renumbered at the merge of main)');
  assert.equal(relaySupportsBossRef('world187'), false, 'the relay before it counts nothing - its gate words know no `vt`');
  assert.equal(RELAY_VERSION, 'world188');
});

// ═══ THE GATE ═══════════════════════════════════════════════════════════════════

const DAY = 200;
const TT = gateTimes(DAY);
const KEY = gateRoomKey(DAY);
const at = (x, z, extra = {}) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...extra });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
async function withGate(fn, { env = {} } = {}) {
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(KEY);
    Object.assign(r.env, env);
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
    await quiet(() => fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } }));
  } finally { Date.now = realNow; }
}
/** His blow laid in flight by hand - a plain one (the slam) or Dagon's - landing `inMs` on. */
const lay = (f, now, a, inMs = 100) => { f.atk = { i: (f.seq = (f.seq ?? 0) + 1), a: a.id, at: now + inMs, x: 0, z: 0, yw: 0, tg: [], until: now + inMs + a.active + Math.max(a.recover, 1000) }; };

test('INT11 THE GATE\'S COUNT, MEASURED: a fighter in the court struck by his plain blow on the relay\'s count, its word a mend out of its budget, a word from one no fight counts never junk; the default line ENFORCES NOTHING - a fall by the count leaves the fighter fighting, its blows landing, no `bd`; and the kill\'s receipt carries the measure, a silent fighter\'s none (mutants: the beat judging nothing; the word junk; the default enforcing; the measure dropped from the receipt)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  await withGate(async ({ r, tick, say, now, set }) => {
    r.env.GATE_SIGNING_KEY = pkcs8;
    const a = r.connect(), b = r.connect(), stranger = r.connect();
    await r.hello(a, 'peer-0001', at(0, 0)); await r.hello(b, 'peer-0002', at(30, 0)); await r.hello(stranger, 'peer-0003', at(0, 0));
    await say(stranger, { k: 'vt', v: 500 });
    assert.equal(stranger.meters.junk ?? 0, 0, 'a body\'s word before `in` is not heard - never junk');
    for (const ws of [a, b]) await say(ws, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    await say(a, { k: 'vt', v: 1000 });
    const f = r.room._fight, A = 'acct-peer-0001', B = 'acct-peer-0002';
    const slam = Math.min(1, ATTACKS.slam.pct * profileOf(f).dmgX);
    lay(f, now(), ATTACKS.slam);
    await tick(Math.ceil((100 + BODY_AFTER_MS) / BRAIN_TICK_MS) + 1);
    assert.ok(Math.abs(f.players[A].bd.v - (1 - slam)) < 1e-9, 'struck where it stands');
    assert.equal(f.players[B].bd?.t ?? 0, 0, 'thirty metres off, untouched');
    await say(a, { k: 'vt', v: 1000 });
    assert.ok(Math.abs(f.players[A].bd.h - slam) < 1e-9, 'its word a mend, believed');
    // THE TRAIL: struck where it stood as he landed, and away before the beat that judged it - the relay's poses as they came
    const T1 = now() + 600;
    lay(f, now(), ATTACKS.slam, 600);
    set(T1 - 50); await r.pose(a, at(0, 0.2));
    set(T1 + 50); await r.pose(a, at(0, 0.4));
    set(T1 + 300); await r.pose(a, at(25, 0));
    const before = f.players[A].bd.t;
    await tick(1);
    assert.ok(Math.abs(f.players[A].bd.t - before - slam) < 1e-9, 'struck by its trail, though it stands clear now');
    await r.pose(a, at(0, 0));
    await say(a, { k: 'vt', v: 1000 });
    // the count felled - and nothing enforced
    lay(f, now(), ATTACKS.reckon);
    await tick(2);
    assert.equal(f.players[A].bd.dn, true); assert.equal(f.players[A].bd.w, 1);
    assert.equal(gates(a, 'bd').length, 0, 'no fall told');
    const hp = f.hp;
    await say(a, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
    assert.ok(f.hp < hp, 'its blows still land');
    const stood = f.players[A].stoodMs;
    f.atk = null;
    await tick(4);
    assert.ok(f.players[A].stoodMs > stood, 'it still stands its time');
    // the kill: the measure on the receipt of the one that said its body, none on the silent one's
    f.players[B].dealt = f.players[B].share;   // B earned by dealing
    f.hp = 5;
    await say(a, { k: 'hit', q: 2, d: 40, r: HIT_KINDS.Spell });
    const mine = readReceipt(f.rc[A]), theirs = readReceipt(f.rc[B]);
    assert.ok(bodyMeasureValid(mine.m));
    assert.deepEqual(mine.m, bodyMeasure(f.players[A], (q) => earned({ ...f, players: { ...f.players, [A]: q } }, A)));
    assert.equal(mine.m[3], 1, 'one fall by the count');
    assert.equal(theirs.m, undefined, 'its game never said its body (B was struck by Dagon too)');
    assert.ok(f.players[B].bd.t > 0);
    const ok = await verifyReceipt(f.rc[A], kp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.equal(ok.ok, true, 'signed with its measure');
  });
});

test('INT11 THE GATE\'S COUNT, ENFORCED (BOSS_BODY {"enforce": true}): the count\'s fall is a fall - `bd` to the fallen\'s sockets, its blows land nothing, it stands no time and is chosen no more; dead by its own `dd`, alive again only BODY_RISE_MS on (mutants: no word to the fallen; its blows landing; its time standing; the rise at once)', async () => {
  await withGate(async ({ r, tick, say, now }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 0));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    const f = r.room._fight, A = 'acct-peer-0001';
    lay(f, now(), ATTACKS.reckon);
    await tick(2);
    assert.deepEqual(gates(a, 'bd'), [{ t: 'gate', k: 'bd' }], 'told');
    const hp = f.hp;
    await say(a, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
    assert.equal(f.hp, hp, 'the fallen strike nothing');
    f.atk = null;
    const stood = f.players[A].stoodMs;
    await tick(4);
    assert.equal(f.players[A].stoodMs, stood, 'it stands no time');
    assert.equal(f.players[A].down, true, 'down, as a `dd` makes it');
    await say(a, { k: 'vt', v: 1000 });
    assert.equal(f.players[A].bd.v, 0, 'a fallen body mends no more');
    // its death, its rise
    await r.pose(a, at(0, 0, { dd: 1 }));
    await tick(1);
    await r.pose(a, at(0, 2));
    await tick(1);
    assert.equal(f.players[A].down, true, 'no rise at once');
    for (let i = 0; i < 70; i++) await tick(1);
    assert.equal(f.players[A].down, false, 'risen BODY_RISE_MS on');
    assert.deepEqual([f.players[A].bd.dd, f.players[A].bd.w], [null, 1], 'a new life, its measure kept');
  }, { env: { BOSS_BODY: ENFORCE } });
  await withGate(async ({ r }) => {
    assert.equal(r.room._bodyLine(), BODY_DEFAULT, 'a mistyped line is the default - it enforces nothing');
  }, { env: { BOSS_BODY: '{"enforce": "yes"}' } });
});

// ═══ THE ABYSS DUNGEON ══════════════════════════════════════════════════════════

const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const sds = (ws, k) => ws.sent.filter((m) => m.t === 'sd' && (!k || m.k === k));
async function withRealm(fn, env = {}) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room('chat:r17'); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      Object.assign(realm.env, env);
      { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      await fn({ realm, rec, beat, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('INT12 THE ABYSS DUNGEON\'S COUNT: the Hour\'s own blow on the realm\'s count of each fighter in the arena; its word a mend; measured, nothing more; ENFORCED, the count\'s fall takes the Hour\'s one life as a `dd` does (the realm\'s dead) and tells the fallen; a body\'s word from one the fight does not count is never junk (mutants: the realm judging nothing; the one life kept; no word to the fallen)', async () => {
  for (const enforce of [false, true]) {
    await withRealm(async ({ realm, beat, now }) => {
      const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
      await realm.raw(ann, JSON.stringify({ t: 'sd', k: 'vt', v: 900 }));
      assert.equal(ann.meters.junk ?? 0, 0, 'a word before `in`, unheard and no junk');
      await realm.raw(ann, JSON.stringify({ t: 'sd', k: 'in', lv: 30, bv: SD_BRAIN_V }));
      await realm.raw(ann, JSON.stringify({ t: 'sd', k: 'vt', v: 1000 }));
      const f = realm.room._sdFight, A = 'acct-peer-ann', p = f.players[A];
      assert.equal(p.bd.sd, true, 'its word heard');
      bodyStruck(p, 0.05, now(), BODY_DEFAULT.body);
      f.clock = { i: 99, a: SD_BLOWS.end.id, at: now() + 100, x: 0, z: 0, yw: 0, tg: [], until: now() + 100 };
      await beat(600);
      assert.ok(Math.abs(p.bd.t - (0.05 + SD_END_PCT)) < 1e-9, 'the Hour\'s End on the count');
      assert.equal(p.bd.w, 1, 'the count fell');
      const realmDead = (await realm.room._sdRealmOf(f.s)).dead;
      if (!enforce) {
        assert.equal(sds(ann, 'bd').length, 0); assert.equal(realmDead.includes(A), false, 'measured alone');
      } else {
        assert.deepEqual(sds(ann, 'bd'), [{ t: 'sd', k: 'bd' }], 'told');
        assert.equal(realmDead.includes(A), true, 'the one life taken');
      }
    }, enforce ? { BOSS_BODY: ENFORCE } : {});
  }
});

// ═══ THE SERPENT ════════════════════════════════════════════════════════════════

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
    await quiet(() => fn({ r, tick, say, now: () => clock }));
  } finally { Date.now = realNow; }
}

test('INT13 THE SERPENT\'S COUNT, ON HER HULL: its lash on the cell\'s count of her hull; her word a patch out of the hull\'s budget; ENFORCED, the count\'s wreck is a wreck - her share out, `bd` to her with its site, her `wr 0` unheard and her blows landing nothing until the count floats her again past HULL_REFLOAT (mutants: the hull never judged; her own word refloating her; her blows landing wrecked)', async () => {
  await withSea(async ({ r, tick, say, now }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', sat(150, 0));
    const b = r.connect(); await r.hello(b, 'peer-0002', sat(-150, 300));   // a second ship: the serpent keeps her share's health when the first's is wrecked out
    await say(a, IN()); await say(b, IN());
    const f = r.room._serpents.get(serpentFightId(SDAY, serpentSiteKey(SX, SZ))), A = 'acct-peer-0001', p = f.players[A];
    await tick(2);
    // the serpent cruising round its waters' heart (SERPENT1 relay's own): a blow from 150 m lands
    const cruise = () => { f.legs = [{ k: 1, at: now() - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }]; f.modes = [{ at: now() - 30_000, m: 1 }]; };
    cruise();
    await say(a, { k: 'hit', d: 50, z: 0 });
    assert.equal(p.dealt, 50, 'afloat, her volley lands');
    await say(a, { k: 'vt', v: 1000 });
    bodyStruck(p, 0.97, now(), BODY_DEFAULT.hull);
    const L = SERPENT_ATTACK_TABLE.lash;
    f.atk = { i: 77, a: L.id, at: now() + 100, x: 100, z: 0, yw: Math.PI / 2, tg: [[100, 0]], until: now() + 3000 };
    await tick(Math.ceil((100 + BODY_AFTER_MS) / SERPENT_TICK_MS) + 1);
    assert.equal(p.bd.dn, true, 'the count wrecked her');
    assert.equal(p.wreck, true, 'wrecked by the relay\'s word');
    assert.deepEqual(words(a, 'bd'), [{ t: 'serpent', k: 'bd', sx: f.sx, sz: f.sz }]);
    await say(a, { k: 'wr', w: 0 });
    assert.equal(p.wreck, true, 'her own word floats her not');
    assert.ok(f.hp > 0, 'the other ship\'s share stands');
    f.atk = null;
    for (let i = 0; i < 4; i++) { cruise(); await say(a, { k: 'hit', d: 50, z: 0 }); await tick(1); }
    assert.equal(p.dealt, 50, 'a wreck fires nothing');
    // her carpenters' patches, out of the budget, past the line
    await say(a, { k: 'vt', v: 300 });
    assert.ok(p.bd.v > 0 && p.bd.v <= BODY_DEFAULT.hull.depth + 1e-9, 'a patch believed out of the budget');
    for (let i = 0; i < 60; i++) { await tick(4); await say(a, { k: 'vt', v: 300 }); }
    assert.ok(p.bd.v > HULL_REFLOAT); assert.equal(p.bd.dn, false, 'afloat by the count');
    await say(a, { k: 'wr', w: 0 });
    assert.equal(p.wreck, false, 'and so by her word');
  }, { BOSS_BODY: ENFORCE });
});

// ═══ THE RECEIPTS AND THE SERVICE ═══════════════════════════════════════════════

test('INT14 THE RECEIPTS: a gate\'s, an Hour\'s and a serpent\'s each carry the measure as `m` when there is one, signed with the rest - read back whole, and a receipt with a malformed measure refused by every reader; one minted before INT14 carries none and reads as it did (mutants: `m` dropped by a minter; a bad `m` read)', async () => {
  const k = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(await subtle.exportKey('pkcs8', k.privateKey)).toString('base64'), { subtle });
  const m = [600, 400, 100, 1, 0, 300], nowS = 1_800_000_000;
  const g = readReceipt(await mintReceipt({ d: 9, b: 'ruhn', s: 'acct-a', c: 1, x: 'stood', l: 10, m }, priv, { subtle, nowS }));
  const h = readSdReceipt(await mintSdReceipt({ d: 4, s: 'acct-a', c: 1, x: 'dealt', l: 10, m }, priv, { subtle, nowS }));
  const l = readSerpentReceipt(await mintSerpentReceipt({ d: 9, b: 'sethrakul', s: 'acct-a', c: 1, x: 'dealt', h: 4, l: 10, m }, priv, { subtle, nowS }));
  for (const c of [g, h, l]) assert.deepEqual(c.m, m);
  assert.equal(readReceipt(await mintReceipt({ d: 9, b: 'ruhn', s: 'acct-a', c: 1, x: 'stood', l: 10 }, priv, { subtle, nowS })).m, undefined);
  const base = { s: 'acct-a', c: 1, x: 'dealt', l: 10, i: nowS, e: nowS + 60 };
  for (const bad of [[1, 2, 3], [1, 2, 3, 4, 5, 6], 'm']) {
    assert.equal(receiptValid({ ...base, d: 9, b: 'ruhn', m: bad }), false);
    assert.equal(sdReceiptValid({ ...base, d: 4, b: 'remnant', m: bad }), false);
    assert.equal(serpentReceiptValid({ ...base, d: 9, b: 'sethrakul', h: 4, m: bad }), false);
  }
});

test('INT14 THE SERVICE KEEPS IT, STAFF READ IT: each claim keeps its receipt\'s measure on its kill\'s row (`body`, migration 0105), none from a receipt without one; /v1/mod/realm-bodies answers each fight\'s receipts, the mends claimed a minute stood by quantile, how many claimed past the line, fell by the count, and would have lost their receipt - a developer\'s alone; tools/realmReview.mjs `bodies [days]` asks it (mutants: the measure not kept; the review open to anyone; a fight left out)', async () => {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const nowS = Math.floor(Date.now() / 1000);
  const ann = await s.registered('annika'), bo = await s.registered('boris'), carla = await s.registered('carla'), mac = await s.registered('mac');
  const claim = async (who, d, m) => s.call('/v1/gate/claim', { receipt: await mintReceipt({ d, b: 'ruhn', s: who.id, c: 7, x: 'dealt', l: 10, ...(m ? { m } : {}) }, s.gatePriv, { subtle, nowS }) }, who.secret);
  assert.equal((await claim(ann, 5, [600, 1200, 300, 1, 0, 120])).body.recorded, true);
  assert.equal((await claim(bo, 5, [100, 0, 0, 0, 1, 600])).body.recorded, true);
  assert.equal((await claim(ann, 6, null)).body.recorded, true);
  assert.equal((await claim(carla, 5, [0, 0, 0, 0, 1, 60])).body.recorded, true);
  const rows = raw.prepare('SELECT account, day, body FROM gate_kills ORDER BY day, account').all();
  assert.deepEqual(rows.map((x) => [x.day, x.body && JSON.parse(x.body)]).sort(), [[5, [0, 0, 0, 0, 1, 60]], [5, [100, 0, 0, 0, 1, 600]], [5, [600, 1200, 300, 1, 0, 120]], [6, null]].sort());
  for (const [, table] of BODY_TABLES) assert.ok(raw.prepare(`SELECT body FROM ${table} LIMIT 1`), `${table} keeps one`);
  // the Hour's and the serpent's claims keep theirs too
  const hRec = await mintSdReceipt({ d: 3, s: ann.id, c: 1, x: 'stood', l: 10, m: [1, 2, 3, 0, 1, 60] }, s.gatePriv, { subtle, nowS });
  assert.equal((await s.call('/v1/sd/claim', { receipt: hRec }, ann.secret)).body.recorded, true);
  assert.equal(raw.prepare('SELECT body FROM sd_kills WHERE account = ?').get(ann.id).body, '[1,2,3,0,1,60]');
  const lRec = await mintSerpentReceipt({ d: 9, b: 'sethrakul', s: ann.id, c: 1, x: 'dealt', h: 4, l: 10, m: [4, 5, 6, 0, 1, 60] }, s.gatePriv, { subtle, nowS });
  assert.equal((await s.call('/v1/serpent/claim', { receipt: lRec, character: ann.character }, ann.secret)).status, 200);
  assert.equal(raw.prepare('SELECT body FROM serpent_kills WHERE account = ?').get(ann.id).body, '[4,5,6,0,1,60]');
  // the review
  assert.equal((await s.call('/v1/mod/realm-bodies', { days: 7 }, ann.secret)).status, 403, 'a developer\'s alone');
  const got = await s.call('/v1/mod/realm-bodies', { days: 7 }, mac.secret);
  assert.equal(got.status, 200);
  const gate = got.body.fights.find((x) => x.fight === 'gate');
  assert.deepEqual(got.body.fights.map((x) => x.fight), BODY_TABLES.map(([fight]) => fight), 'every fight');
  assert.deepEqual([gate.receipts, gate.over, gate.fell, gate.lost], [3, 1, 1, 1], 'one of three would have lost its receipt');
  // ann's: 1500 thousandths claimed over 120 s - 750 a minute; bo's and carla's: none
  assert.deepEqual(gate.quantiles.map(([, r]) => r), [0, 750, 750, 750]);
  assert.equal(gate.most, 750);
  const direct = await bodiesMeasure(s.env.DB, nowS + 60, 7);
  assert.deepEqual(direct.fights.map((x) => x.receipts), [3, 1, 1]);
  assert.deepEqual(await reviewAct({ db: s.env.DB, nowS }, { id: ann.id, handle: 'annika' }, s.env, 'bodies', {}), { error: 'not-developer' });
  // the tool
  assert.deepEqual(reviewRequest(['bodies']), { path: '/v1/mod/realm-bodies', body: { days: 7 } });
  assert.deepEqual(reviewRequest(['bodies', '14']), { path: '/v1/mod/realm-bodies', body: { days: 14 } });
  assert.ok('usage' in reviewRequest(['bodies', '31']));
});

// ═══ THE CLIENT ═════════════════════════════════════════════════════════════════

test('INT15 THE CLIENT: a session notes a relay that counts (`bossOk`, off its welcome\'s version); the court says my body through `sendBody` to such a relay alone, the Hour\'s fight through my realm\'s socket while it answered me, the serpent my hull through her cell; the count\'s fall (`bd`) is a death by the relay\'s word in the fight it came from - the zone referee\'s door - and a ship\'s wreck as her whole hull taken (mutants: said to an older relay; the fall turned aside by a death save; heard outside its fight)', () => {
  const Sock = fakeSocketClass();
  const s = new OnlineSession({ url: 'ws://x', WebSocketImpl: Sock });
  assert.equal(s.bossOk, false, 'nothing said before a relay says it counts');
  const world = rd('src/scenes/world.js'), court = rd('src/scenes/gateCourt.js'), host = rd('src/scenes/serpentHost.js'), online = rd('src/net/online.js');
  assert.match(online, /if \(primary\) this\.bossOk = relaySupportsBossRef\(relayV\);/);
  assert.match(world, /sendBody: \(v\) => !!online\?\.bossOk && !!online\?\.sendGate\?\.\(\{ k: 'vt', v \}\)/);
  assert.match(court, /if \(alive && healLive\(s\) && e\?\.maxHealth > 0\) sayBody\(e\.health \/ e\.maxHealth, t\);/);
  assert.match(world, /if \(!sdFightLink \|\| modes\?\.sdRealmSlot\?\.\(\) == null \|\| !online\?\.bossOk\) return;\n    if \(playerEntity\.health > 0 && playerEntity\.maxHealth > 0 && sdFightLink\.joined\(\)\) _sdSayBody\(/);
  assert.match(world, /sdFightFrame\(\); sdBodyFrame\(\); sdVoiceFrame\(\);/, 'each frame of the Hour');
  assert.match(host, /const sayHull = bodySayer\(\(v\) => !!live && !!deps\.online\?\.bossOk\?\.\(\) && !!deps\.online\?\.send\?\.\(\{ k: 'vt', v \}/);
  assert.match(world, /online\.onGate = \(g\) => \{ if \(g\?\.k === 'bd'\) bossCountFell\(modes\?\.gateArenaDay\?\.\(\) != null\); else gateLink\?\.word\(g\); \};/);
  assert.match(world, /if \(w\?\.k === 'bd'\) \{ bossCountFell\(slot != null\); return; \}/);
  assert.match(world, /function bossCountFell\(inFight\) \{\n    if \(!inFight \|\| !\(playerEntity\.health > 0\)\) return;\n    setMidScreenText\(BOSS_COUNT_FELL_TEXT\);\n    forcePlayerDeath\(playerEntity\);/);
  assert.match(world, /online\.onSerpent = \(w\) => \{ if \(w\?\.k === 'bd'\) serpentHost\?\.wrecked\?\.\(w\); else serpentLink\?\.word\(w\); \};/);
  assert.match(host, /deps\.strike\?\.\(ship\.boat, \{ hull: Math\.ceil\(ship\.maxHull \* 2\) \+ 1, sail: 0, crew: 0 \}/);
});
