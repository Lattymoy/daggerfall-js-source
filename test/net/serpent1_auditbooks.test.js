// AUDIT SERPENT (2026-10-04, Mac: "I definitely want to do a conprehensive audit on this and ensure its absolute
// perfection"): THE BOOKS LENS'S PINS (D7/D8 - bible/01-Overview/audits/Audit-Sea-Serpent.md). Its auditor wrote 38 more
// mutants of the serpent's books, rewards and relay paths, and 37 lived under SERPENT1's own pins; each test here was
// written to fail under them (tools/mutants/serpent1_audit.json, the `D-` records): the service's one row and its hour,
// the route's claimant, the device's carrier, the world's queue and hoard by source, the brain's level and earning, and
// the relay's kill kept first, its hub told again, its word and its fight through a wake, and the keeping's two hours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { mintSerpentReceipt } from '../../src/net/serpent/serpentReceipt.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../src/net/identityToken.js';
import { SOCIAL_ROOM, SERPENT_FIGHT_KEY, SERPENT_TELL_RETRY_MS, serpentFightId, cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_DIVE_MS, SERPENT_NATIVE_PER_M } from '../../src/net/serpent/serpentLaw.js';
import { SERPENT_TICK_MS, SERPENT_LV_MAX, SERPENT_RECEIPT_SHARE, SERPENT_PART_SHARE, newSerpentFight, joinSerpentFight, serpentEarned, serpentEarnedBy } from '../../src/net/serpent/serpentBrain.js';
import { fakeRooms } from '../fakeRoom.mjs';
import { RELAY_INTERNAL_CFG } from '../../src/net/relayCfg.js';   // SCALE5b: the beat's ask of the hub, which the failing hub lets through
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { createGuest } from '../../server-account/src/accounts.js';
import { claimSerpent } from '../../server-account/src/serpents.js';
import { RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX } from '../../src/net/renown.js';
import { createSerpentClaims, serpentClaimVerdict, SERPENT_CLAIM_RETRY_MS } from '../../src/net/serpent/serpentClaims.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const subtle = globalThis.crypto.subtle;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const keypair = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) { const stmt = db.prepare(sql); let args = []; const api = { bind(...x) { args = x; return api; }, async first() { return stmt.get(...args) ?? null; }, async all() { return { results: stmt.all(...args) }; }, async run() { const res = stmt.run(...args); return { meta: { changes: Number(res.changes) } }; }, _rows() { return stmt.all(...args); } }; return api; },
    async batch(list) { db.exec('BEGIN'); try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}
const T0S = 1_800_000_000, DAY = 363, CH = 'char-0001', CID = '0123456789abcdef', CID2 = 'fedcba9876543210';
let handles = 0;
const member = async (db) => { const id = (await createGuest({ db, subtle, rand, nowS: T0S }, { deviceLabel: null })).id; const h = `Cap${++handles}`; db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id); return { id, handle: h }; };
async function relayPair() {
  const kp = await keypair();
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }), pub, pkcs8 };
}
const serpentFor = (s, priv, d = DAY, nowS = T0S) => mintSerpentReceipt({ d, b: 'sethrakul', s, c: 99, x: 'dealt', h: 4, l: 20 }, priv, { subtle, nowS });
const trackXp = (db, id) => db._raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(id, CH)?.xp;

test('AUDIT-D books: a second receipt of the day credits nothing; the hour and the track cap bound the pay and the row says what was paid; a junk cid writes no hoard row; a receipt from the future is refused', async () => {
  const db = d1(); const ctx = { db, nowS: T0S, subtle, rand };
  const { priv, pubKey } = await relayPair();
  const m = await member(db);
  const first = await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv), character: CH, cid: CID }, pubKey);
  const xp1 = trackXp(db, m.id);
  assert.equal(xp1, first.renown.credited);
  await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY, T0S + 1), character: CH, cid: CID2 }, pubKey);
  assert.equal(trackXp(db, m.id), xp1, 'credited once a (day, account)');
  db._raw.prepare('UPDATE players SET renown_hour = ?, renown_hour_xp = ? WHERE id = ?').run(Math.floor(T0S / 3600), RENOWN_XP_HOUR_MAX - 100, m.id);
  const capped = await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY + 2), character: CH, cid: CID }, pubKey);
  assert.equal(capped.renown.credited, 100, 'what the hour has left');
  assert.equal(capped.renown.xp, xp1 + 100);
  assert.equal(db._raw.prepare('SELECT xp FROM serpent_kills WHERE account = ? AND day = ?').get(m.id, DAY + 2).xp, 100, 'the row says what was paid');
  db._raw.prepare('UPDATE renown_tracks SET xp = ? WHERE player = ? AND char_id = ?').run(RENOWN_XP_MAX - 5, m.id, CH);
  db._raw.prepare('UPDATE players SET renown_hour = 0, renown_hour_xp = 0 WHERE id = ?').run(m.id);
  const top = await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY + 4), character: CH, cid: CID }, pubKey);
  assert.deepEqual([top.renown.xp, top.renown.credited], [RENOWN_XP_MAX, 5]);
  const junk = await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY + 6), character: CH, cid: 'not-a-cid' }, pubKey);
  assert.equal(junk.spoils, false);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM serpent_spoils WHERE account = ? AND day = ?').get(m.id, DAY + 6).n, 0);
  assert.deepEqual(await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY + 8, T0S + 3600), character: CH, cid: CID }, pubKey), { error: 'receipt', why: 'future' });
});

test('AUDIT-D route: the body never names the claimant (403 not-yours); no public half is 503', async (t) => {
  let clock = T0S * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { priv, pub } = await relayPair();
  _resetKeyForTests();
  const kp = await keypair();
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const mk = (env) => async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, { method, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body) }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: pub };
  const call = mk(env);
  const reg = async (h) => { const g = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body; assert.equal((await call('POST', '/v1/auth/register', { handle: h, password: 'correct horse battery', ...ACCEPTED }, g.secret)).status, 200); return g; };
  const me = await reg('Captain'), them = await reg('Bosun');
  const theirs = await call('POST', '/v1/serpent/claim', { receipt: await serpentFor(them.id, priv), character: CH, account: them.id }, me.secret);
  assert.deepEqual([theirs.status, theirs.body.error], [403, 'not-yours']);
  _resetKeyForTests();
  const bare = mk({ ...env, GATE_PUBLIC_KEY: undefined });
  assert.equal((await bare('POST', '/v1/serpent/claim', { receipt: await serpentFor(me.id, priv), character: CH }, me.secret)).status, 503);
});

test('AUDIT-D carrier: the hoard on `spoils: true` alone; one cid a receipt across offers; another account\'s waits; unsigned never kept; expired by the relay clock never offered; renown-character settles; settled is the DEVICE\'s; no offer before the retry', async () => {
  const { priv } = await relayPair();
  const A = 'acct-aaaa', B = 'acct-bbbb';
  const rA = await serpentFor(A, priv), rB = await serpentFor(B, priv);
  const mem = new Map(); const store = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, structuredClone(v)) };
  let clock = 1_000_000, answer = { ok: true, data: { recorded: false, why: 'guest', spoils: false } };
  const asked = [], hoards = [];
  const mk = (o = {}) => createSerpentClaims({ claim: async (r, ch, nm, cid) => { asked.push([r, cid]); return answer; }, store, nowS: () => T0S, nowMs: () => clock, me: () => A, onSpoils: (e) => hoards.push(e.r), ...o });
  const c = mk();
  assert.equal(c.add(rA, CH, 'Ann', 20), true); assert.equal(c.add(rB, CH, 'Bo', 20), true);
  await c.flush(); await new Promise((r) => setTimeout(r, 10));
  assert.ok(asked.every(([r]) => r === rA), 'another account\'s receipt waits for its sign-in');
  assert.equal(hoards.length, 0, 'no hoard on spoils: false');
  c.tick(); await new Promise((r) => setTimeout(r, 10));
  const n = asked.length;
  clock += 2000;
  assert.equal(c.tick(), false, 'not before SERPENT_CLAIM_RETRY_MS'); assert.equal(asked.length, n);
  clock += SERPENT_CLAIM_RETRY_MS;
  answer = { ok: true, data: { recorded: false, why: 'guest', spoils: true } };
  assert.equal(c.tick(), true); await new Promise((r) => setTimeout(r, 10));
  assert.equal(new Set(asked.map(([, cid]) => cid)).size, 1, 'one cid for the receipt, offer after offer');
  assert.deepEqual(hoards, [rA]);
  assert.equal(c.add(await mintSerpentReceipt({ d: DAY + 2, b: 'sethrakul', s: A, c: 1, x: 'dealt', h: 4, l: 20 }, null, { subtle, nowS: T0S }), CH), false, 'unsigned is never kept');
  assert.equal(mk({ nowS: () => T0S + 8 * 24 * 3600 }).kept().length, 0, 'expired by the relay\'s clock');
  assert.equal(serpentClaimVerdict({ ok: false, error: 'renown-character' }), 'done');
  answer = { ok: true, data: { recorded: true, slain: 1, renown: { credited: 1 }, spoils: false } };
  await c.flush(); await new Promise((r) => setTimeout(r, 10));
  assert.equal(mk().add(rA, CH, 'Ann', 20), false, 'settled on the device: a reload never keeps it again');
});

test('AUDIT-D world host by source: the serpent queue\'s own guard, relay clock and store; the hoard\'s owner, lock, keys, crash door, slot save and realm hooks', () => {
  const w = src('src/scenes/world.js');
  const at = w.indexOf("const serpentClaims = params.has('online') ? createSerpentClaims({");
  const q = w.slice(at, w.indexOf('  }) : null;', at));
  assert.match(q, /nowS: relayNowS,/); assert.match(q, /store: _spoilsStore,/);
  assert.match(q, /onRecorded: \(data\) => \{\n\s+if \(data\?\.renown\?\.character !== characterIdOf\(playerEntity\)\) return;/);
  const g = w.slice(w.indexOf('function grantSerpentSpoils(entry) {'), w.indexOf('function grantSerpentSpoils(entry) {') + 1400);
  assert.match(g, /spoilsLock\(\(\) => serpentSpoils\.grant\(/); assert.match(g, /owner: entry\.ch,/);
  assert.match(w, /const serpentSpoils = createSpoilsPool\(\{[\s\S]{0,300}keys: SERPENT_SPOILS_KEYS,/);
  assert.ok(w.includes('onHanded: (rec) => serpentSpoils.adopt(rec), key: SERPENT_SPOILS_KEYS.store'));
  assert.ok(w.includes('onSlotSaved((characterId) => { try { serpentSpoils.saved(characterId);'));
  assert.ok(w.includes('...(serpentSpoils?.heldIds?.(who) ?? [])') && w.includes('serpentSpoils?.saved(who, ids)'));
});

test('AUDIT-D brain: a level is bounded at the join and kept from the first claim; a ship earns `dealt` at SERPENT_RECEIPT_SHARE of its share, and not below it - a stander\'s at SERPENT_PART_SHARE (SERPENT4)', () => {
  const f = newSerpentFight(DAY, 0, 1e9, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 's', 'S', 999, 4, 0, true);
  assert.equal(f.players.s.lv, SERPENT_LV_MAX);
  const g = newSerpentFight(DAY, 0, 1e9, 'sethrakul', 0, 0, 0);
  joinSerpentFight(g, 's', 'S', 12, 4, 0, true);
  joinSerpentFight(g, 's', 'S', 40, 4, 10, true);
  assert.equal(g.players.s.lv, 12, 'a later `in` never raises the level the hoard rolls at');
  f.fell = { at: 1000, top: [], n: 1 }; f.liveMs = 1000;
  // PIN MOVED: SERPENT4 (the players: "Rewards based on party or individual damage") - a dealer's at 6% of what its ship
  // brought, a stander's at a part of it (AUDIT SERPENT E1, Mac: "Must be in the fight" - several volleys, never one)
  assert.equal(SERPENT_RECEIPT_SHARE, 0.06);
  assert.equal(SERPENT_PART_SHARE, 0.025);
  f.players.s.dealt = SERPENT_PART_SHARE * f.players.s.share * 0.99;
  assert.ok(!serpentEarned(f, 's'), 'a hair short of its part');
  f.players.s.dealt = SERPENT_PART_SHARE * f.players.s.share;
  assert.ok(serpentEarned(f, 's') && serpentEarnedBy(f, 's') === 'stood', 'a part: a stander\'s');
  f.players.s.dealt = SERPENT_RECEIPT_SHARE * f.players.s.share * 0.99;
  assert.equal(serpentEarnedBy(f, 's'), 'stood', 'a hair short of a dealer\'s');
  f.players.s.dealt = SERPENT_RECEIPT_SHARE * f.players.s.share;
  assert.ok(serpentEarned(f, 's') && serpentEarnedBy(f, 's') === 'dealt');
});

// ═══ the relay: the hub failing, the object waking, the keeping ═══
const TT = serpentTimes(DAY);
const PX = 205, PY = 214;
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
const pos = (mx, mz) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0 });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'serpent' && (!k || m.k === k));
const IN = { k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ };
const FID = serpentFightId(DAY, serpentSiteKey(SX, SZ)), KEPT = `${SERPENT_FIGHT_KEY}:${FID}`;

test('AUDIT-D relay: the kill kept BEFORE the hub is told; a hub that fails is told again on the beat SERPENT_TELL_RETRY_MS on; the hub\'s word survives its wake; the fight survives the cell\'s wake; the receipt is handed for the keeping\'s two hours', async () => {
  const kp = await keypair();
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const realNow = Date.now; let clock = TT.riseAt + 20_000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(CELL); r.env.GATE_SIGNING_KEY = pkcs8;
    const hub = world.room(SOCIAL_ROOM);
    // PIN MOVED (SCALE5b): the cell's beat asks the hub for the relay's settings too (RELAY_INTERNAL_CFG) - the hub that
    // fails here fails the tells alone, two of them, as it did before the ask joined the beat
    let fails = 2; const get = world.ROOMS.get;
    world.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async (req) => (new URL(req.url).pathname !== RELAY_INTERNAL_CFG && fails-- > 0 ? new Response('{}', { status: 500 }) : get(id).fetch(req)) } : get(id));
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += SERPENT_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'serpent', ...o }));
    const a = r.connect(); await r.hello(a, 'peer-0001', pos(120, 0));
    await say(a, IN);
    const f = r.room._serpents.get(FID);
    await tick(1);
    f.legs = [{ k: 1, at: clock - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
    f.modes = [{ at: clock - 30_000, m: 1 }];
    f.hp = 5; f.nextAt = Infinity;
    await say(a, { k: 'hit', d: 40, z: 0 });
    const mine = words(a, 'rcpt').map((m) => m.r);
    assert.equal(mine.length, 1);
    const kept = r.store.get(KEPT);
    assert.equal(kept.said, true, 'the kill kept before anything is told');
    assert.equal(kept.rc['acct-peer-0001'], mine[0]);
    assert.ok(!r.room._serpents.get(FID).told, 'a hub that failed is not told');
    await tick(1);
    assert.ok(!r.room._serpents.get(FID).told);
    assert.ok(r.alarm.at != null && r.alarm.at <= clock + SERPENT_TELL_RETRY_MS, 'the retry armed');
    for (let i = 0; i < 40 && !r.room._serpents.get(FID).told; i++) await tick(1);
    assert.equal(r.room._serpents.get(FID).told, true, 'told again until it answers');
    hub.wake();
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    assert.equal(words(h, 'fell').length, 1, 'the hub\'s word survives its wake');
    r.wake();
    const back = r.connect(); await r.hello(back, 'peer-0001', pos(100, 0));
    await say(back, IN);
    assert.deepEqual(words(back, 'rcpt').map((m) => m.r), mine, 'handed again after the cell woke');
    clock = TT.soundAt + SERPENT_DIVE_MS + 60 * 60 * 1000;
    await r.fire();
    assert.equal(r.store.has(KEPT), true, 'kept its two hours');
    const late = r.connect(); await r.hello(late, 'peer-0001', pos(100, 0));
    await say(late, IN);
    assert.deepEqual(words(late, 'rcpt').map((m) => m.r), mine, 'an hour after the dive, handed still');
  } finally { Date.now = realNow; }
});
