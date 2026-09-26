// AUDIT WB (2026-09-25, Mac: "A proper audit on everything"): THE SPOILS AND THE CLAIMS, pinned - a fighter outside the
// court at the kill who never got their spoils (A2), a receipt let go on a refusal the service could mend (A5), storage
// that refused writes and lost receipts and records (A6), a crash record with one slot (A7), and keys that were the
// device's when they were an account's (A9). Design: bible/11-Multiplayer/World-Bosses.md section 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSpoilsPool, spoilsList, spoilsStore, recoverSpoils, spentKey, SPOILS_STORE_KEY, SPOILS_DAY_KEY, SPOILS_TEXT,
  SPOILS_RECORDS_MAX, SPOILS_SPENT_MAX,
} from '../src/scenes/spoilsPool.js';
import { createGateClaims, gateClaimVerdict, GATE_CLAIM_MENDABLE, GATE_CLAIMS_KEY } from '../src/net/gateClaims.js';
import { accountGates, call, SESSION_KEY } from '../src/net/accountClient.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const subtle = globalThis.crypto.subtle;
const T0 = 1_800_000_000;
const WALL = 1_700_000_000_000;
const floor = (from, dir, len) => { if (dir[1] >= 0) return null; const t = from[1] / -dir[1]; return t <= len ? { dist: t, normal: [0, 1, 0] } : null; };
/** A JSON store over a Map (the pool's own shape). */
const mapStore = () => { const mem = new Map(); return { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k), mem }; };
function pool({ store = mapStore(), who = 'char-1' } = {}) {
  const pack = [], said = [];
  const w = { who };
  const p = createSpoilsPool({ ray: floor, now: () => 1000, take: (x) => pack.push(x), say: (t) => said.push(t), store, who: () => w.who, wall: () => WALL });
  return { p, pack, said, store, w };
}
async function key() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
}
const receiptFor = (s, d, k, nowS = T0) => mintReceipt({ d, b: 'ruhn', s, c: 4242, x: 'dealt' }, k, { subtle, nowS });

test('AUDIT WB A2 a receipt with no floor is its spoils straight into the pack - the same pieces the burst would throw, said once, kept as rolled against a crash, once a receipt whichever door gives them', () => {
  const h = pool();
  assert.equal(h.p.grant({ day: 700, seed: 99, level: 8, acct: 'acct-a' }), true);
  const list = spoilsList(99, 8);
  assert.deepEqual(h.pack, list, 'every piece, as rolled');
  assert.deepEqual(h.said, [SPOILS_TEXT.granted]);
  assert.deepEqual(h.store.get(SPOILS_STORE_KEY), [{ day: 700, at: WALL, who: 'char-1', pieces: JSON.parse(JSON.stringify(list)) }], 'the crash\'s record, as the burst keeps it');
  assert.equal(h.p.grant({ day: 700, seed: 99, level: 8, acct: 'acct-a' }), false, 'once');
  assert.equal(h.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3, 0], bearing: 0, acct: 'acct-a' }), false, 'and the court\'s burst gives nothing more');
  assert.equal(h.pack.length, list.length);
  const s = pool();
  assert.equal(s.p.spew({ day: 701, seed: 5, level: 3, at: [0, 3, 0], bearing: 0, acct: 'acct-a' }), true);
  assert.equal(s.p.grant({ day: 701, seed: 5, level: 3, acct: 'acct-a' }), false, 'nor a grant after a burst');
});

test('AUDIT WB A2 the seams: every receipt the link folds is offered to the pool outside its court; inside it, the burst gives them', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /onReceipt: \(r\) => \{ gateClaims\?\.add\(r\); grantSpoilsOutside\(r\); \},/);
  const fn = w.slice(w.indexOf('function grantSpoilsOutside(r) {'), w.indexOf('function grantSpoilsOutside(r) {') + 500);
  assert.match(fn, /if \(!c \|\| !spoilsPool \|\| modes\?\.gateArenaDay\?\.\(\) === c\.d\) return;/, 'in its own court the floor gives them');
  assert.match(fn, /spoilsPool\.grant\(\{ day: c\.d, seed: c\.c, level: playerEntity\.level \?\? 1, acct: c\.s \}\)/, 'the receipt\'s own seed and account');
  // WBX3: the burst's own seed and account - and, once the pieces have left him, whose they are said (they are nobody else's)
  assert.match(read('src/scenes/gateCourt.js'), /if \(spoils\.spew\(\{ day: s\.day, seed: claims\.c, level: player\(\)\?\.level \?\? 1, at, bearing, acct: claims\.s \}\)\) say\(COURT_STRIKE_TEXT\.spilled\(bossOf\(s\)\.name\)\);/);
});

test('AUDIT WB A9 a receipt spent is its day AND account: two accounts on one device each have their gate; an older build\'s spent day stays spent for anyone; the list is bounded', () => {
  const h = pool();
  assert.equal(h.p.spew({ day: 700, seed: 1, level: 1, at: [0, 3, 0], bearing: 0, acct: 'acct-a' }), true);
  assert.equal(h.p.spew({ day: 700, seed: 2, level: 1, at: [0, 3, 0], bearing: 0, acct: 'acct-b' }), true, 'another account, the same day');
  assert.deepEqual(h.store.get(SPOILS_DAY_KEY), [spentKey(700, 'acct-a'), spentKey(700, 'acct-b')]);
  const again = pool({ store: h.store });
  assert.equal(again.p.spew({ day: 700, seed: 1, level: 1, at: [0, 3, 0], bearing: 0, acct: 'acct-a' }), false, 'the device remembers');
  // an older build kept one day, spent for anyone
  const old = mapStore(); old.set(SPOILS_DAY_KEY, 705);
  const o = pool({ store: old });
  assert.equal(o.p.grant({ day: 705, seed: 1, level: 1, acct: 'acct-z' }), false);
  assert.equal(o.p.grant({ day: 706, seed: 1, level: 1, acct: 'acct-z' }), true);
  assert.deepEqual(old.get(SPOILS_DAY_KEY), [spentKey(705, '*'), spentKey(706, 'acct-z')], 'carried over as spent for anyone');
  assert.equal(pool({ store: old }).p.grant({ day: 705, seed: 1, level: 1, acct: 'acct-y' }), false, 'and still spent after the carry');
  const b = pool();
  for (let d = 0; d < SPOILS_SPENT_MAX + 5; d++) b.p.grant({ day: d, seed: d, level: 1, acct: 'a' });
  assert.equal(b.store.get(SPOILS_DAY_KEY).length, SPOILS_SPENT_MAX);
  assert.equal(b.p.grant({ day: 0, seed: 0, level: 1, acct: 'a' }), false, 'this session still knows what it spent');
});

test('AUDIT WB A7 the crash records are a list, one a day and character: a second burst no longer writes over the first; each character is handed its own, a save of its own clears only it', () => {
  const store = mapStore();
  const a = pool({ store, who: 'char-1' });
  a.p.grant({ day: 700, seed: 11, level: 2, acct: 'x' });
  a.w.who = 'char-2';
  a.p.grant({ day: 701, seed: 12, level: 2, acct: 'x' });
  const recs = store.get(SPOILS_STORE_KEY);
  assert.deepEqual(recs.map((r) => [r.day, r.who]), [[700, 'char-1'], [701, 'char-2']]);
  const info = (who, t) => ({ characterId: who, dateAndTime: { realTime: t } });
  const got = [];
  assert.equal(recoverSpoils(store, (p) => got.push(p), { who: 'char-2', saves: [info('char-1', WALL + 5)] }), 5, 'char-2\'s own, whatever char-1 saved');
  assert.equal(store.get(SPOILS_STORE_KEY).length, 2, 'both kept: no save of char-2 since');
  assert.equal(recoverSpoils(store, () => assert.fail('a save since holds them'), { who: 'char-1', saves: [info('char-1', WALL + 5)] }), 0);
  assert.deepEqual(store.get(SPOILS_STORE_KEY).map((r) => r.who), ['char-2'], 'char-1\'s cleared, char-2\'s waits');
  recoverSpoils(store, () => {}, { who: 'char-2', saves: [info('char-2', WALL + 5)] });
  assert.equal(store.get(SPOILS_STORE_KEY), null, 'the last one cleared, the key with it');
  // the same day and character replaced, not doubled; bounded
  const b = pool();
  for (let d = 0; d < SPOILS_RECORDS_MAX + 3; d++) b.p.grant({ day: d, seed: d, level: 1, acct: 'y' });
  assert.equal(b.store.get(SPOILS_STORE_KEY).length, SPOILS_RECORDS_MAX);
  assert.equal(b.store.get(SPOILS_STORE_KEY).at(-1).day, SPOILS_RECORDS_MAX + 2, 'the newest kept');
});

test('AUDIT WB A6 a storage that refuses writes keeps them in the session\'s memory: the spoils\' spent receipts and records, and the claims\' queue, read back from there', async () => {
  const disk = new Map();
  let full = true;
  const storage = { getItem: (k) => disk.get(k) ?? null, setItem: (k, v) => { if (full) throw new Error('QuotaExceededError'); disk.set(k, v); }, removeItem: (k) => disk.delete(k) };
  const st = spoilsStore(storage);
  st.set('k', { a: 1 });
  assert.deepEqual(st.get('k'), { a: 1 }, 'memory answers');
  assert.equal(disk.has('k'), false);
  full = false;
  st.set('k', { a: 2 });
  assert.equal(disk.get('k'), '{"a":2}', 'a write that lands takes over');
  assert.deepEqual(st.get('k'), { a: 2 });
  full = true;
  const h = pool({ store: st });
  assert.equal(h.p.grant({ day: 800, seed: 3, level: 1, acct: 'q' }), true);
  assert.equal(pool({ store: st }).p.grant({ day: 800, seed: 3, level: 1, acct: 'q' }), false, 'another pool of this session still knows it spent');
  assert.equal(st.get(SPOILS_STORE_KEY).length, 1, 'and the record is there to recover');
  st.remove('k');
  assert.equal(st.get('k'), null);
  assert.deepEqual(spoilsStore(null).get('x'), null);
  // the claims' queue with no store at all keeps what it is handed, and offers it
  const k = await key();
  const asked = [];
  const q = createGateClaims({ claim: async (r) => { asked.push(r); return { ok: false, error: 'offline' }; }, store: null, nowS: () => T0 + 5, me: () => 'acct-a' });
  const r = await receiptFor('acct-a', 700, k);
  assert.equal(q.add(r), true);
  await new Promise((s) => setTimeout(s, 0));
  assert.deepEqual(q.kept(), [r], 'kept in memory');
  assert.deepEqual(asked, [r], 'and offered');
  const w = read('src/scenes/world.js');
  assert.match(w, /const _spoilsStore = spoilsStore\(appStorage\(\)\);/);
  assert.equal((w.match(/spoilsStore\(appStorage\(\)\)/g) ?? []).length, 1, 'one store: its memory is every reader\'s');
});

test('AUDIT WB A5 a refusal the service can mend keeps the receipt for its week - the service\'s half not the relay\'s pair, a clock off; one it cannot is let go; the account client carries the rung', async () => {
  assert.deepEqual([...GATE_CLAIM_MENDABLE], ['signature', 'verify-threw', 'future', 'clock']);
  for (const why of GATE_CLAIM_MENDABLE) assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why }), 'keep', why);
  for (const why of ['expired', 'unsigned', 'shape', 'claims', 'version']) assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why }), 'done', why);
  const fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: 'receipt', why: 'signature' }) });
  assert.deepEqual(await call({ fetch, base: 'https://a.invalid' }, '/v1/gate/claim', { receipt: 'r' }), { ok: false, error: 'receipt', why: 'signature', status: 400 });
  const plain = async () => ({ ok: false, status: 400, json: async () => ({ error: 'receipt' }) });
  assert.deepEqual(await call({ fetch: plain, base: 'https://a.invalid' }, '/v1/gate/claim', { receipt: 'r' }), { ok: false, error: 'receipt', status: 400 }, 'no rung, no field');
  assert.match(read('server-account/src/index.js'), /if \(r\.error\) return json\(\{ error: r\.error, \.\.\.\(r\.why \? \{ why: r\.why \} : \{\}\) \}, /);
  const doc = read('bible/11-Multiplayer/World-Bosses.md');
  assert.doesNotMatch(doc, /the deploy checks the pair as it checks the identity pair/, 'no check the repo does not make is claimed');
});

test('AUDIT WB A9 the device is not the account: receipts kept one a day AND account, only the signed-in account\'s offered, another\'s kept unasked for its own sign-in; `me` is the stored session\'s id', async () => {
  const k = await key();
  const mem = new Map();
  const store = { get: (x) => (mem.has(x) ? JSON.parse(mem.get(x)) : null), set: (x, v) => mem.set(x, JSON.stringify(v)) };
  const who = { me: 'acct-a' };
  const asked = [];
  const clock = { ms: 0 };
  const q = createGateClaims({ claim: async (r) => { asked.push(r); return { ok: true, data: { recorded: true, closed: 1 } }; }, store, nowS: () => T0 + 5, nowMs: () => clock.ms, me: () => who.me });
  const ra = await receiptFor('acct-a', 700, k), rb = await receiptFor('acct-b', 700, k);
  q.add(ra); q.add(rb);
  await new Promise((s) => setTimeout(s, 0));
  assert.deepEqual(asked, [ra], 'only the signed-in account\'s offered');
  assert.deepEqual(q.kept(), [rb], 'the same day, another account: kept, unasked');
  clock.ms += 1e9;
  assert.equal(q.tick(), false, 'nothing of the signed-in account\'s to offer');
  who.me = 'acct-b';
  assert.equal(q.tick(), true, 'its own account signs in');
  await new Promise((s) => setTimeout(s, 0));
  assert.deepEqual(asked, [ra, rb]);
  assert.deepEqual(q.kept(), []);
  who.me = null;
  const rc = await receiptFor('acct-c', 701, k);
  q.add(rc);
  await new Promise((s) => setTimeout(s, 0));
  assert.deepEqual(q.kept(), [rc], 'no one signed in: nothing offered, nothing lost');
  assert.equal(JSON.parse(mem.get(GATE_CLAIMS_KEY)).length, 1);
  const smem = new Map([[SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Me', kind: 'linked', sessionId: 's', secret: 'SECRETSECRETSECRETSECRET' })]]);
  const storage = { getItem: (x) => smem.get(x) ?? null, setItem: (x, v) => smem.set(x, v), removeItem: (x) => smem.delete(x) };
  assert.equal(accountGates({ fetch: async () => null, storage }).me(), 'p_me');
  smem.clear();
  assert.equal(accountGates({ fetch: async () => null, storage }).me(), null);
});
