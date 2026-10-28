// ARMORY (2026-10-28, bible/04-Characters/Aura-Armory.md sections 3, 4 and 7): THE AURA ARMORY, SERVICE SIDE - the law's
// kit, the Breach's roll in the gate claim's own batch over the REAL migrations (test/accountDb.mjs, migration 0190), the
// wear door, what is held off the row's bits (the Breach's and the shop's), and the token that carries the kit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { ARENA_HONOUR_PATHS } from '../../server-account/src/arena.js';
import {
  ARMORY_SLOTS, ARMORY_PIECES, ARMORY_KEYS, ARMORY_BREACH_PIECES, ARMORY_BREACH_BITS, ARMORY_NAME, armoryKitOk, armoryKitPieces,
  armoryKitOf, armoryKitWith, armoryKitHeld, armoryBreachHeldOf, armoryPieceOf, armoryPieceAt,
} from '../../src/net/armoryLaw.js';
import { armoryHeld, armoryWorn, armoryRefusal } from '../../server-account/src/titles.js';
import { armoryBreachPick, armoryGateRoll, armoryGateAnswer, ARMORY_BREACH_ODDS, ARMORY_BREACH_ODDS_RITE, ARMORY_BREACH_PITY } from '../../server-account/src/armory.js';
import { verifyToken, claimsValid } from '../../src/net/identityToken.js';

const HIT = (/** @type {Uint8Array} */ b) => b.fill(0);
const MISS = (/** @type {Uint8Array} */ b) => b.fill(255);
const row = (o = {}) => ({ id: 'p1', handle: 'Alice', armory_held: 0, armory_miss: 0, shop_wares: 0, armory: null, ...o });

// ── THE LAW ─────────────────────────────────────────────────────────

test('ARMORY the law: five slots in the kit\'s order; ten pieces, two a slot - the Breach\'s Dagonfire with a bit each, the shop\'s Eternal with none; a code a slot never shared (mutants: a slot dropped; two pieces one code; a shop piece given a Breach bit)', () => {
  assert.deepEqual(ARMORY_SLOTS, ['head', 'torso', 'arms', 'legs', 'weapon']);
  assert.deepEqual(ARMORY_PIECES.map((p) => [p.key, p.slot, p.code, p.line, p.source, p.bit]), [
    ['burningcrown', 'head', 'a', 'dagonfire', 'breach', 1],
    ['emberheart', 'torso', 'a', 'dagonfire', 'breach', 2],
    ['ashbound', 'arms', 'a', 'dagonfire', 'breach', 4],
    ['cinderstride', 'legs', 'a', 'dagonfire', 'breach', 8],
    ['breachbrand', 'weapon', 'a', 'dagonfire', 'breach', 16],
    ['eternalhalo', 'head', 'b', 'eternal', 'shop', 0],
    ['eternalsigil', 'torso', 'b', 'eternal', 'shop', 0],
    ['eternalarmlets', 'arms', 'b', 'eternal', 'shop', 0],
    ['eternalgreaves', 'legs', 'b', 'eternal', 'shop', 0],
    ['eternaledge', 'weapon', 'b', 'eternal', 'shop', 0],
  ]);
  for (const s of ARMORY_SLOTS) {
    const codes = ARMORY_PIECES.filter((p) => p.slot === s).map((p) => p.code);
    assert.equal(new Set(codes).size, codes.length, `${s}: a code once`);
    assert.ok(codes.every((c) => /^[1-9a-z]$/.test(c)), `${s}: a code is never the empty slot`);
  }
  assert.equal(ARMORY_BREACH_BITS, 31);
  assert.deepEqual(ARMORY_BREACH_PIECES.map((p) => p.key), ['burningcrown', 'emberheart', 'ashbound', 'cinderstride', 'breachbrand']);
  assert.deepEqual(Object.keys(ARMORY_NAME), ARMORY_KEYS, 'a name a piece, in the catalogue\'s order');
  assert.equal(armoryPieceOf('emberheart')?.slot, 'torso');
  assert.equal(armoryPieceOf('nope'), null);
  assert.equal(armoryPieceAt('legs', 'b')?.key, 'eternalgreaves');
  assert.equal(armoryPieceAt('legs', '0'), null);
});

test('ARMORY the kit: five characters, a known piece of its slot or 0, never all empty - and it reads back to its pieces, a slot changed at a time (mutants: all-empty a kit; a code read in another slot; a wrong-slot key worn)', () => {
  assert.ok(armoryKitOk('a0000'));
  assert.ok(armoryKitOk('abab0'));
  assert.ok(armoryKitOk('aaaaa') && armoryKitOk('bbbbb'));
  for (const bad of ['00000', 'a000', 'a00000', 'z0000', 'A0000', 'c0000', null, undefined, 11111, ['a', '0', '0', '0', '0']]) assert.equal(armoryKitOk(bad), false, String(bad));
  assert.deepEqual(armoryKitPieces('ab0b0'), { head: 'burningcrown', torso: 'eternalsigil', arms: null, legs: 'eternalgreaves', weapon: null });
  assert.deepEqual(armoryKitPieces('nope!'), { head: null, torso: null, arms: null, legs: null, weapon: null });
  assert.equal(armoryKitOf({ head: 'burningcrown', legs: 'eternalgreaves' }), 'a00b0');
  assert.equal(armoryKitOf(['eternaledge', 'nope']), '0000b');
  assert.equal(armoryKitOf([]), null);
  assert.equal(armoryKitWith(null, 'torso', 'emberheart'), '0a000');
  assert.equal(armoryKitWith('0a000', 'torso', null), null, 'the last piece off is no kit');
  assert.equal(armoryKitWith('0a000', 'head', 'eternalhalo'), 'ba000');
  assert.equal(armoryKitWith('0a000', 'head', 'emberheart'), '0a000', 'a torso piece on the head changes nothing');
  assert.equal(armoryKitWith('0a000', 'tail', 'emberheart'), '0a000');
  assert.equal(armoryKitHeld('ab0b0', ['burningcrown', 'eternalgreaves']), 'a00b0');
  assert.equal(armoryKitHeld('ab0b0', []), null);
  assert.deepEqual(armoryBreachHeldOf(5), ['burningcrown', 'ashbound']);
  for (const bad of [0, -1, 1.5, 'x', null]) assert.deepEqual(armoryBreachHeldOf(bad), []);
  assert.deepEqual(armoryBreachHeldOf(32), [], 'a bit no piece has holds nothing');
});

test('ARMORY the token: a kit rides as `ak`, absent for none - present and no kit is refused (mutants: the claim unchecked)', () => {
  const base = { s: 'acct-0001', n: 'Alice', k: 'linked', i: 100, e: 200 };
  assert.ok(claimsValid(base));
  assert.ok(claimsValid({ ...base, ak: 'ab0b0' }));
  for (const bad of ['00000', 'zzzzz', '', 7]) assert.equal(claimsValid({ ...base, ak: bad }), false, String(bad));
});

// ── WHAT IS HELD ────────────────────────────────────────────────────

test('ARMORY held off the row: the Breach\'s bits and the shop\'s, a registered account\'s alone; worn the stored kit less what is no longer held; a wear refused for a piece not held or not of the slot (mutants: the handle guard dropped; a refunded piece still signed)', () => {
  assert.deepEqual(armoryHeld(row({ armory_held: 3 })), ['burningcrown', 'emberheart']);
  assert.deepEqual(armoryHeld(row({ shop_wares: 8 | 64 })), ['eternalhalo', 'eternalgreaves']);
  assert.deepEqual(armoryHeld(row({ armory_held: 1, shop_wares: 8 })), ['burningcrown', 'eternalhalo']);
  assert.deepEqual(armoryHeld(row({ handle: null, armory_held: 31, shop_wares: 255 })), [], 'a guest holds none');
  assert.equal(armoryWorn(row({ armory_held: 1, shop_wares: 16, armory: 'ab000' })), 'ab000');
  assert.equal(armoryWorn(row({ armory_held: 1, shop_wares: 0, armory: 'ab000' })), 'a0000', 'the refunded sigil off the token');
  assert.equal(armoryWorn(row({ armory: 'ab000' })), undefined);
  assert.equal(armoryWorn(row({ armory_held: 31, armory: 'bogus' })), undefined);
  const r = row({ armory_held: 2 });
  assert.equal(armoryRefusal('torso', 'emberheart', r), null);
  assert.equal(armoryRefusal('torso', null, r), null, 'a slot may always be emptied');
  assert.equal(armoryRefusal('head', 'burningcrown', r), 'armory-not-held');
  assert.equal(armoryRefusal('head', 'emberheart', r), 'no-piece', 'a piece of another slot');
  assert.equal(armoryRefusal('tail', null, r), 'no-piece');
  assert.equal(armoryRefusal('torso', 'nope', r), 'no-piece');
});

// ── THE BREACH'S ROLL ───────────────────────────────────────────────

test('ARMORY the roll\'s pick: a Breach piece the account does not hold, by the die among them; none once all are held (mutants: a held piece picked; the die ignored)', () => {
  assert.equal(armoryBreachPick(0, HIT)?.key, 'burningcrown');
  assert.equal(armoryBreachPick(0, MISS)?.key, ARMORY_BREACH_PIECES[(0xffffffff % 5)].key);
  assert.equal(armoryBreachPick(1 | 2 | 4 | 8, MISS)?.key, 'breachbrand', 'the one left');
  assert.equal(armoryBreachPick(31, HIT), null);
  const seen = new Set();
  for (let v = 0; v < 5; v++) seen.add(armoryBreachPick(2, (b) => { b.fill(0); b[3] = v; return b; })?.key);
  assert.deepEqual([...seen].sort(), ['ashbound', 'breachbrand', 'burningcrown', 'cinderstride'], 'every piece not held can come, the held one never');
  assert.equal(ARMORY_BREACH_ODDS, 1 / 12);
  assert.equal(ARMORY_BREACH_ODDS_RITE, 1 / 8);
  assert.equal(ARMORY_BREACH_PITY, 10);
});

test('ARMORY the roll\'s statement: none for a guest or an account that holds every Breach piece; the rite\'s odds for a fighter who broke it or a portent night (mutants: a guest rolled; the rite\'s odds lost)', () => {
  const asked = [];
  const db = { prepare: (sql) => ({ bind: (...a) => { asked.push({ sql, a }); return { sql, a }; } }) };
  assert.equal(armoryGateRoll({ db, rand: HIT }, row({ handle: null }))({ d: 1 }), null);
  assert.equal(armoryGateRoll({ db, rand: HIT }, row({ armory_held: 31 }))({ d: 1 }), null);
  const st = armoryGateRoll({ db, rand: HIT }, row())({ d: 1 });
  assert.match(st.sql, /WHERE id = \?1 AND changes\(\) > 0 RETURNING armory_held, armory_miss/);
  assert.deepEqual(st.a, ['p1', 1, ARMORY_BREACH_PITY, 1, 'burningcrown']);
  // a draw just under the rite's odds and over the plain one's: a find only for the rite, a portent night, not a plain kill
  const between = (/** @type {Uint8Array} */ b) => { const v = Math.floor(0.1 * 4294967296); b[0] = v >>> 24; b[1] = (v >>> 16) & 255; b[2] = (v >>> 8) & 255; b[3] = v & 255; return b; };
  assert.equal(armoryGateRoll({ db, rand: between }, row())({ d: 1 }).a[1], 0);
  assert.equal(armoryGateRoll({ db, rand: between }, row())({ d: 1, r: 1 }).a[1], 1);
  assert.equal(armoryGateRoll({ db, rand: between }, row())({ d: 1, p: 2 }).a[1], 1);
  assert.equal(armoryGateAnswer(null), null);
  assert.deepEqual(armoryGateAnswer({ armory_held: 3, armory_miss: 0, piece: 'emberheart' }), { found: 'emberheart', held: ['burningcrown', 'emberheart'] });
  assert.deepEqual(armoryGateAnswer({ armory_held: 1, armory_miss: 4, piece: 'emberheart' }), { found: null, held: ['burningcrown'] });
});

test('ARMORY end to end: a recorded Breach kill rolls in the claim\'s own batch - a miss counted, the pity certain at ten, the piece held and the misses reset; a claim asked again rolls nothing; a guest rolls nothing (mutants: the pity never reached; a repeat claim rolled)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const me = await S.registered('Ember');
  const at = () => ({ ...raw.prepare('SELECT armory_held, armory_miss FROM players WHERE id = ?').get(me.id) });
  raw.prepare('UPDATE players SET armory_miss = ? WHERE id = ?').run(ARMORY_BREACH_PITY, me.id);
  const a = (await S.claim(me, 700, T0)).body;
  assert.equal(a.recorded, true);
  assert.ok(ARMORY_BREACH_PIECES.some((p) => p.key === a.armory.found), `the pity gives a piece (${JSON.stringify(a.armory)})`);
  assert.deepEqual(a.armory.held, [a.armory.found]);
  assert.equal(a.armoryRow, undefined, 'the row is the service\'s own');
  assert.deepEqual(at(), { armory_held: armoryPieceOf(a.armory.found).bit, armory_miss: 0 });
  const again = (await S.claim(me, 700, T0)).body;
  assert.equal(again.recorded, false);
  assert.equal(again.armory, undefined, 'asked again, nothing rolled');
  assert.deepEqual(at(), { armory_held: armoryPieceOf(a.armory.found).bit, armory_miss: 0 });
  const next = (await S.claim(me, 701, T0)).body;
  assert.ok(next.armory && (next.armory.found === null ? at().armory_miss === 1 : at().armory_miss === 0), 'the next kill rolled once');
  const guest = await S.guest();
  const g = (await S.call('/v1/gate/claim', { receipt: 'x' }, guest.secret)).body;
  assert.equal(g?.armory, undefined);
});

test('ARMORY end to end: the wear door - a piece held worn in its slot, the wardrobe after it; a piece not held 403, a wrong slot 400; the token signs the kit as `ak` and the mint answers it; a slot emptied is gone from the next token (mutants: an unheld piece worn; the kit never signed)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const me = await S.registered('Kitted');
  assert.ok(ROUTES.has('/v1/account/armory'));
  assert.ok(ARENA_HONOUR_PATHS.has('/v1/account/armory'), 'its answer is a whole wardrobe, read with the honours');
  assert.equal((await S.call('/v1/account/armory', { slot: 'torso', piece: 'emberheart' }, me.secret)).status, 403);
  raw.prepare('UPDATE players SET armory_held = 2, shop_wares = 8 WHERE id = ?').run(me.id);
  assert.equal((await S.call('/v1/account/armory', { slot: 'head', piece: 'emberheart' }, me.secret)).status, 400);
  const w = await S.call('/v1/account/armory', { slot: 'torso', piece: 'emberheart' }, me.secret);
  assert.equal(w.status, 200);
  assert.deepEqual(w.body.armoryHeld, ['emberheart', 'eternalhalo']);
  assert.equal(w.body.armory, '0a000');
  assert.equal((await S.call('/v1/account/armory', { slot: 'head', piece: 'eternalhalo' }, me.secret)).body.armory, 'ba000');
  const acct = await (await S.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${me.secret}` } })).json();
  assert.equal(acct.wardrobe.armory, 'ba000');
  const mint = (await S.call('/v1/auth/token', {}, me.secret)).body;
  assert.equal(mint.armory, 'ba000');
  const pub = S.identityPublic;
  const v = await verifyToken(mint.token, pub, { subtle: globalThis.crypto.subtle, nowS: T0 });
  assert.ok(v.ok);
  assert.equal(v.claims.ak, 'ba000');
  await S.call('/v1/account/armory', { slot: 'head', piece: null }, me.secret);
  await S.call('/v1/account/armory', { slot: 'torso', piece: null }, me.secret);
  const bare = (await S.call('/v1/auth/token', {}, me.secret)).body;
  assert.equal(bare.armory, null);
  const v2 = await verifyToken(bare.token, pub, { subtle: globalThis.crypto.subtle, nowS: T0 });
  assert.equal('ak' in v2.claims, false, 'none worn, the bytes as before');
});
