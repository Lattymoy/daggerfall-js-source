// ARMORY (2026-10-28, bible/04-Characters/Aura-Armory.md sections 3, 4 and 7): THE AURA ARMORY, SERVICE SIDE - the law's
// kit, the Sigil Broker's sale of the Dagonfire line and the shop's Eternal set over the REAL migrations (test/accountDb.mjs,
// migration 0191), the wear door a slot or a whole kit at a time, what is held, and the token that carries the kit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { ARENA_HONOUR_PATHS } from '../../server-account/src/arena.js';
import {
  ARMORY_SLOTS, ARMORY_PIECES, ARMORY_KEYS, ARMORY_NAME, ARMORY_SOURCE, ARMORY_SETS, armoryKitOk, armoryKitPieces, armoryKitOf,
  armoryKitWith, armoryKitHeld, armoryPieceOf, armoryPieceAt, armoryLinePieces, armoryWarePieces, armoryLineKit,
} from '../../src/net/armoryLaw.js';
import { INSIGNIA, ARMORY_BROKER_PRICE, insigniaById } from '../../src/net/insignia.js';
import { SHOP_WARES, shopWareById, shopKeysOf, shopOwns } from '../../src/net/shopLaw.js';
import { armoryHeld, armoryWorn, armoryRefusal } from '../../server-account/src/titles.js';
import { verifyToken, claimsValid } from '../../src/net/identityToken.js';

const row = (o = {}) => ({ id: 'p1', handle: 'Alice', insignia: null, shop_wares: 0, armory: null, ...o });
const DAGONFIRE = ['burningcrown', 'emberheart', 'ashbound', 'cinderstride', 'breachbrand'];
const ETERNAL = ['eternalhalo', 'eternalsigil', 'eternalarmlets', 'eternalgreaves', 'eternaledge'];
/** Breaches closed for `who`, by hand - one row a game day, as claimGate writes them (WB5b), an ember each. */
const closeGates = (/** @type {any} */ env, /** @type {any} */ who, /** @type {number} */ n, from = 1000) => {
  const ins = env.DB._raw.prepare('INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (?, ?, \'ruhn\', \'dealt\', ?)');
  for (let d = from; d < from + n; d++) ins.run(d, who.id, T0);
};

// ── THE LAW ─────────────────────────────────────────────────────────

test('ARMORY the law: five slots in the kit\'s order; ten pieces, two a slot - the Sigil Broker\'s Dagonfire, the shop\'s Eternal; a code a slot never shared (mutants: a slot dropped; two pieces one code; a line sold at the other\'s door)', () => {
  assert.deepEqual(ARMORY_SLOTS, ['head', 'torso', 'arms', 'legs', 'weapon']);
  assert.deepEqual(ARMORY_SOURCE, { dagonfire: 'broker', eternal: 'shop', guild: 'guild', crystal: 'gift' });   // THANKS-POST (PIN MOVED): the Crystal Spurs' line, a gift; GUILD-SHOP (PIN MOVED): the Insignia Armlet's line, the guild shop's
  assert.deepEqual(ARMORY_PIECES.map((p) => [p.key, p.slot, p.code, p.line, p.source]), [
    ['burningcrown', 'head', 'a', 'dagonfire', 'broker'],
    ['emberheart', 'torso', 'a', 'dagonfire', 'broker'],
    ['ashbound', 'arms', 'a', 'dagonfire', 'broker'],
    ['cinderstride', 'legs', 'a', 'dagonfire', 'broker'],
    ['breachbrand', 'weapon', 'a', 'dagonfire', 'broker'],
    ['eternalhalo', 'head', 'b', 'eternal', 'shop'],
    ['eternalsigil', 'torso', 'b', 'eternal', 'shop'],
    ['eternalarmlets', 'arms', 'b', 'eternal', 'shop'],
    ['eternalgreaves', 'legs', 'b', 'eternal', 'shop'],
    ['eternaledge', 'weapon', 'b', 'eternal', 'shop'],
    ['insigniaarmlet', 'arms', 'c', 'guild', 'guild'],   // GUILD-SHOP (PIN MOVED): the arms slot's third, the guild shop's
    ['crystalspurs', 'arms', 'd', 'crystal', 'gift'],   // THANKS-POST (PIN MOVED): the arms slot's fourth, the update's gift
  ]);
  assert.deepEqual(armoryLinePieces('dagonfire').map((p) => p.key), DAGONFIRE);
  assert.deepEqual(armoryLinePieces('eternal').map((p) => p.key), ETERNAL);
  assert.deepEqual(armoryLinePieces('nope'), []);
  for (const s of ARMORY_SLOTS) {
    const codes = ARMORY_PIECES.filter((p) => p.slot === s).map((p) => p.code);
    assert.equal(new Set(codes).size, codes.length, `${s}: a code once`);
    assert.ok(codes.every((c) => /^[1-9a-z]$/.test(c)), `${s}: a code is never the empty slot`);
  }
  assert.deepEqual(Object.keys(ARMORY_NAME), [...ARMORY_KEYS, ...Object.keys(ARMORY_SETS)], 'a name a piece, in the catalogue\'s order, then a set\'s');
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
  assert.equal(armoryLineKit('eternal'), 'bbbbb');
  assert.equal(armoryLineKit('dagonfire'), 'aaaaa');
  assert.equal(armoryLineKit('nope'), null);
});

test('ARMORY the token: a kit rides as `ak`, absent for none - present and no kit is refused (mutants: the claim unchecked)', () => {
  const base = { s: 'acct-0001', n: 'Alice', k: 'linked', i: 100, e: 200 };
  assert.ok(claimsValid(base));
  assert.ok(claimsValid({ ...base, ak: 'ab0b0' }));
  for (const bad of ['00000', 'zzzzz', '', 7]) assert.equal(claimsValid({ ...base, ak: bad }), false, String(bad));
});

// ── WHAT IS HELD ────────────────────────────────────────────────────

test('ARMORY held off the row: the Broker\'s insignia and the shop\'s bits - a set its every piece - a registered account\'s alone; worn the stored kit less what is no longer held; a wear refused for a piece not held or not of the slot (mutants: the handle guard dropped; a refunded piece still signed; a set giving nothing)', () => {
  assert.deepEqual(armoryHeld(row({ insignia: 'armory:emberheart aura:dagonfire armory:burningcrown' })), ['burningcrown', 'emberheart']);
  assert.deepEqual(armoryHeld(row({ shop_wares: 8 | 64 })), ['eternalhalo', 'eternalgreaves']);
  assert.deepEqual(armoryHeld(row({ shop_wares: 256 })), ETERNAL, 'the set holds its every piece');
  assert.deepEqual(armoryHeld(row({ shop_wares: 256 | 8 })), ETERNAL, 'a piece held twice is held once');
  assert.deepEqual(armoryHeld(row({ insignia: 'armory:burningcrown', shop_wares: 8 })), ['burningcrown', 'eternalhalo']);
  assert.deepEqual(armoryHeld(row({ insignia: 'armory:eternalhalo' })), [], 'an Eternal piece is never an insignia');
  assert.deepEqual(armoryHeld(row({ handle: null, insignia: DAGONFIRE.map((k) => `armory:${k}`).join(' '), shop_wares: 511 })), [], 'a guest holds none');
  assert.equal(armoryWorn(row({ insignia: 'armory:burningcrown', shop_wares: 16, armory: 'ab000' })), 'ab000');
  assert.equal(armoryWorn(row({ insignia: 'armory:burningcrown', shop_wares: 0, armory: 'ab000' })), 'a0000', 'the refunded sigil off the token');
  assert.equal(armoryWorn(row({ shop_wares: 256, armory: 'bbbbb' })), 'bbbbb');
  assert.equal(armoryWorn(row({ shop_wares: 0, armory: 'bbbbb' })), undefined, 'the set refunded, every piece off');
  assert.equal(armoryWorn(row({ armory: 'ab000' })), undefined);
  assert.equal(armoryWorn(row({ shop_wares: 511, armory: 'bogus' })), undefined);
  const r = row({ insignia: 'armory:emberheart' });
  assert.equal(armoryRefusal('torso', 'emberheart', r), null);
  assert.equal(armoryRefusal('torso', null, r), null, 'a slot may always be emptied');
  assert.equal(armoryRefusal('head', 'burningcrown', r), 'armory-not-held');
  assert.equal(armoryRefusal('head', 'emberheart', r), 'no-piece', 'a piece of another slot');
  assert.equal(armoryRefusal('tail', null, r), 'no-piece');
  assert.equal(armoryRefusal('torso', 'nope', r), 'no-piece');
});

// ── THE SIGIL BROKER AND THE SHOP ───────────────────────────────────

test('ARMORY the Broker\'s Dagonfire line: a piece a slot at 75 Deadlands Embers, after the title and the aura - 375 for the five, dearer than her aura; never a shop ware (mutants: a price cut; an Eternal piece at the Broker; a Dagonfire piece in the shop)', () => {
  assert.equal(ARMORY_BROKER_PRICE, 75);
  assert.deepEqual(INSIGNIA.map((r) => r.id), ['title:gatebreaker', 'aura:dagonfire', ...DAGONFIRE.map((k) => `armory:${k}`)]);
  for (const k of DAGONFIRE) assert.deepEqual({ ...insigniaById(`armory:${k}`) }, { id: `armory:${k}`, kind: 'armory', key: k, price: 75 });
  for (const k of ETERNAL) assert.equal(insigniaById(`armory:${k}`), null, `${k}: the shop's alone`);
  assert.ok(ARMORY_BROKER_PRICE > insigniaById('aura:dagonfire').price, '"very expensive": each piece dearer than her aura');
  for (const k of DAGONFIRE) assert.equal(shopWareById(`armory:${k}`), null, `${k}: never sold for money`);
});

test('ARMORY the shop\'s Eternal line: the set whole at 2,000 Aurum (bit 256) and a piece a slot at 600 (PIN MOVED, AURUM-ONLY: $20 and $6 at $1 = 100 Aurum); the set gives its five, each once; a ware is owned through the set or the singles - so neither is sold again (mutants: the set priced as the singles; a set giving one piece; a single sold over the set; the set sold over the five singles)', () => {
  const armory = SHOP_WARES.filter((w) => w.kind === 'armory');
  assert.deepEqual(armory.map((w) => [w.id, w.price, w.bit]), [   // PIN MOVED (AURUM-ONLY): each priced in Aurum
    ['armory:eternalset', 2000, 256],
    ['armory:eternalhalo', 600, 8], ['armory:eternalsigil', 600, 16], ['armory:eternalarmlets', 600, 32],
    ['armory:eternalgreaves', 600, 64], ['armory:eternaledge', 600, 128],
  ]);
  assert.ok(2000 < 5 * 600, 'the set is the cheaper way to the five');
  assert.deepEqual(armoryWarePieces('eternalset'), ETERNAL);
  assert.deepEqual(armoryWarePieces('eternaledge'), ['eternaledge']);
  assert.deepEqual(armoryWarePieces('nope'), []);
  assert.deepEqual(armoryWarePieces('toString'), [], 'a key off the prototype is no set');
  assert.deepEqual(shopKeysOf(256, 'armory'), ETERNAL);
  assert.deepEqual(shopKeysOf(256 | 8 | 128, 'armory'), ETERNAL, 'each piece once');
  assert.deepEqual(shopKeysOf(8 | 128, 'armory'), ['eternalhalo', 'eternaledge']);
  assert.equal(shopOwns(256, 'armory:eternalset'), true);
  assert.equal(shopOwns(256, 'armory:eternalhalo'), true, 'a piece the set gave is not sold again');
  assert.equal(shopOwns(8 | 16 | 32 | 64 | 128, 'armory:eternalset'), true, 'the five singles are the set');
  assert.equal(shopOwns(8 | 16 | 32 | 64, 'armory:eternalset'), false, 'four are not');
  assert.equal(shopOwns(8, 'armory:eternalhalo'), true);
  assert.equal(shopOwns(8, 'armory:eternalsigil'), false);
  assert.equal(shopOwns(4, 'aura:eternal'), true);
  assert.equal(shopOwns(0, 'aura:eternal'), false);
  assert.equal(shopOwns(511, 'armory:nope'), false);
});

test('ARMORY end to end: the Broker sells a Dagonfire piece for 75 of the account\'s own embers - short refused with the purse; held from the sale on and worn in its slot; owned refused; the five cost 375 (mutants: a piece sold short; a piece sold twice; a bought piece not held)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const me = await S.registered('Ember');
  const buy = (/** @type {string} */ id) => S.call('/v1/account/insignia', { item: id }, me.secret);
  closeGates(S.env, me, 74);
  let r = await buy('armory:emberheart');
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'short', purse: 74, price: 75 }, 'one ember short');
  closeGates(S.env, me, 1, 5000);
  r = await buy('armory:emberheart');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bought, 'armory:emberheart');
  assert.deepEqual(r.body.armoryHeld, ['emberheart'], 'held from the sale on');
  assert.equal(r.body.purse, 0);
  assert.equal((await buy('armory:emberheart')).status, 409, 'owned');
  assert.equal((await buy('armory:eternalhalo')).status, 400, 'an Eternal piece is never the Broker\'s');
  const w = await S.call('/v1/account/armory', { slot: 'torso', piece: 'emberheart' }, me.secret);
  assert.equal(w.status, 200);
  assert.equal(w.body.armory, '0a000');
  closeGates(S.env, me, 300, 6000);
  for (const k of ['burningcrown', 'ashbound', 'cinderstride', 'breachbrand']) assert.equal((await buy(`armory:${k}`)).status, 200, k);
  const after = raw.prepare('SELECT insignia, insignia_spent FROM players WHERE id = ?').get(me.id);
  assert.equal(after.insignia_spent, 375, 'the five at 75 each');
  assert.deepEqual(after.insignia.split(' '), ['armory:emberheart', 'armory:burningcrown', 'armory:ashbound', 'armory:cinderstride', 'armory:breachbrand']);
  const k = await S.call('/v1/account/armory', { kit: 'aaaaa' }, me.secret);
  assert.equal(k.status, 200, 'the whole line worn at once');
  assert.equal(k.body.armory, 'aaaaa');
});

test('ARMORY end to end: the wear door - a piece held worn in its slot, the wardrobe after it; a piece not held 403, a wrong slot 400; a whole kit at once, the set\'s, every piece asked and none half-worn; the token signs the kit as `ak` and the mint answers it; a slot emptied is gone from the next token (mutants: an unheld piece worn; a kit worn with a piece not held; the kit never signed)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const me = await S.registered('Kitted');
  assert.ok(ROUTES.has('/v1/account/armory'));
  assert.ok(ARENA_HONOUR_PATHS.has('/v1/account/armory'), 'its answer is a whole wardrobe, read with the honours');
  assert.equal((await S.call('/v1/account/armory', { slot: 'torso', piece: 'emberheart' }, me.secret)).status, 403);
  raw.prepare('UPDATE players SET insignia = \'armory:emberheart\', shop_wares = 8 WHERE id = ?').run(me.id);
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
  // A WHOLE KIT: refused whole for one piece not held (the head's halo held, the rest not), the kit worn before kept
  assert.equal((await S.call('/v1/account/armory', { kit: 'bbbbb' }, me.secret)).status, 403);
  assert.equal((await S.call('/v1/account/armory', { kit: 'zzzzz' }, me.secret)).status, 400);
  assert.equal((await S.call('/v1/account/armory', { kit: 7 }, me.secret)).status, 400);
  assert.equal(raw.prepare('SELECT armory FROM players WHERE id = ?').get(me.id).armory, 'ba000', 'nothing half-worn');
  raw.prepare('UPDATE players SET shop_wares = 256 WHERE id = ?').run(me.id);
  const set = await S.call('/v1/account/armory', { kit: 'bbbbb' }, me.secret);
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.deepEqual(set.body.armoryHeld, ['emberheart', ...ETERNAL]);
  assert.equal(set.body.armory, 'bbbbb');
  assert.equal((await S.call('/v1/account/armory', { kit: null }, me.secret)).body.armory, null, 'every slot bared at once');
  const bare = (await S.call('/v1/auth/token', {}, me.secret)).body;
  assert.equal(bare.armory, null);
  const v2 = await verifyToken(bare.token, pub, { subtle: globalThis.crypto.subtle, nowS: T0 });
  assert.equal('ak' in v2.claims, false, 'none worn, the bytes as before');
});
