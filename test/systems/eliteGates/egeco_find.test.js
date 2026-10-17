// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 5, "The dungeon's
// find"): A DUNGEON ELITE'S WEIR KEY. The service (server-account/src/eg.js findEg over the real Worker and every
// migration - test/accountDb.mjs): who may ask (a handle, and a gate closed or a Redoubt taken), its own die at the
// tier's odds (1 in 60 an Abyss Dungeon's elite, 1 in 150 an Elite Dungeon's, 1 in 400 a Regular's), six asks a tier an
// account a real day, two keys a week from finds. The client (systems/eliteGates/egFind.js): who asks - the owner for its own kill,
// the joiner its record names for theirs, one ask a body - and a yes thrown from the body as a card is, the pack
// restacked to the balance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { findEg, EG_FIND_ODDS, EG_FIND_PER_DAY, EG_FIND_KEYS_PER_WEEK } from '../../../server-account/src/eg.js';
import { ARENA_WEEK_S, ARENA_SEASON_EPOCH_S } from '../../../src/net/arena/arenaLaw.js';
import { DUNGEON_TIERS } from '../../../src/systems/dungeon/dungeonTier.js';
import { registerEgFind, egFindThrow, egFindAsks, egFindKill, egFindStruck, EG_FIND_HANDLER, EG_FIND_TEXT } from '../../../src/systems/eliteGates/egFind.js';
import { readFileSync } from 'node:fs';
import { raiseEnemyDeath, registerEnemyDeathHandler } from '../../../src/scenes/corpseMarker.js';
import { weirKeys, weirKeysHeld, isWeirKey } from '../../../src/systems/eliteGates/weirKey.js';
import { accountEg } from '../../../src/net/accountClient.js';

/** A service, a registered account, the clock at T0, and the die (`die.v` a byte the 4-byte draws are filled with). */
async function stood(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const die = { v: null };
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => (b.length === 4 && die.v != null ? b.fill(die.v) : real(b)));
  const S = await standService();
  const me = await S.registered('Finder');
  return { S, me, die, at: (s) => { clock = s * 1000; } };
}
const keysOf = (S, id) => S.env.DB._raw.prepare('SELECT eg_keys AS k FROM players WHERE id = ?').get(id).k;

test('EG-E3 THE FIND, WHO MAY ASK: a guest, a fresh account (no gate closed, no Redoubt taken) and a word that is no tier are refused; a proven account asks and is answered `{ found, keys, asks }`; a Redoubt taken proves an account as a gate does; the tiers are the port\'s own (mutants: the handle unasked; the proof unasked; a tier of another name)', async (t) => {
  const { S, me, die } = await stood(t);
  assert.deepEqual(Object.keys(EG_FIND_ODDS).sort(), [...DUNGEON_TIERS].sort(), 'systems/dungeon/dungeonTier.js names them');
  const g = await S.guest();
  assert.deepEqual([(await S.call('/v1/eg/find', { tier: 'elite' }, g.secret)).status, (await S.call('/v1/eg/find', { tier: 'elite' }, g.secret)).body], [403, { error: 'guest' }]);
  const fresh = await S.call('/v1/eg/find', { tier: 'elite' }, me.secret);
  assert.deepEqual([fresh.status, fresh.body], [403, { error: 'unproven' }]);
  assert.equal((await S.call('/v1/eg/find', { tier: 'elite' })).status, 401, 'no session, no find');
  await S.claim(me, 700, T0);   // a gate closed (its key certain - the first)
  die.v = 0xff;
  for (const tier of ['abyss', 'Elite', '', null]) assert.deepEqual((await S.call('/v1/eg/find', { tier }, me.secret)).body, { error: 'tier' }, String(tier));
  assert.deepEqual((await S.call('/v1/eg/find', { tier: 'super' }, me.secret)).body, { found: false, keys: 1, asks: EG_FIND_PER_DAY - 1 });
  // a Redoubt taken proves an account
  const other = await S.registered('Climber');
  S.env.DB._raw.prepare('INSERT INTO eg_redoubts (b, account, w, h, t, at) VALUES (?, ?, 1, 5, 60, ?)').run('0123456789abcdef', other.id, T0);
  assert.deepEqual((await S.call('/v1/eg/find', { tier: 'regular' }, other.secret)).body, { found: false, keys: 0, asks: EG_FIND_PER_DAY - 1 });
  // and the client's door asks the route
  const asked = [];
  const client = accountEg({ fetch: async (url, init) => { asked.push([new URL(url).pathname, JSON.parse(init.body)]); return new Response('{}', { status: 200 }); }, storage: { getItem: () => JSON.stringify({ id: 'x', secret: 's', kind: 'linked' }), setItem() {}, removeItem() {} } });
  await client.find('elite');
  assert.deepEqual(asked.at(-1), ['/v1/eg/find', { tier: 'elite' }]);
});

test('EG-E3 THE FIND\'S ODDS: the service\'s own die, at 1 in 60 for an Abyss Dungeon\'s elite, 1 in 150 an Elite Dungeon\'s, 1 in 400 a Regular\'s - a draw just under each threshold finds, one at it does not; a yes adds one to the balance (mutants: a tier\'s odds moved; the die\'s edge inclusive; the key never added)', async (t) => {
  const { S, die } = await stood(t);
  die.v = null;
  assert.deepEqual([EG_FIND_ODDS.super, EG_FIND_ODDS.elite, EG_FIND_ODDS.regular], [1 / 60, 1 / 150, 1 / 400]);
  for (const [tier, n] of [['super', 60], ['elite', 150], ['regular', 400]]) {
    const who = await S.registered(`Odds${n}`);
    await S.claim(who, 700, T0);
    const edge = Math.ceil(4294967296 / n);   // the first draw at or past the odds
    const draw = (v) => (b) => { b[0] = v >>> 24; b[1] = (v >>> 16) & 0xff; b[2] = (v >>> 8) & 0xff; b[3] = v & 0xff; return b; };
    const player = { id: who.id, handle: who.handle };
    const no = await findEg({ db: S.env.DB, nowS: T0, rand: draw(edge) }, player, { tier });
    assert.deepEqual(no, { found: false, keys: 1, asks: EG_FIND_PER_DAY - 1 }, `${tier}: at the edge, no key`);
    const yes = await findEg({ db: S.env.DB, nowS: T0, rand: draw(edge - 1) }, player, { tier });
    assert.deepEqual(yes, { found: true, keys: 2, asks: EG_FIND_PER_DAY - 2 }, `${tier}: under it, a key`);
    assert.equal(keysOf(S, who.id), 2);
  }
  // no die (a harness's context): never a key
  const who = await S.registered('NoDie');
  await S.claim(who, 700, T0);
  assert.equal((await findEg({ db: S.env.DB, nowS: T0 }, { id: who.id, handle: who.handle }, { tier: 'super' })).found, false);
});

test('EG-E3 THE FIND\'S CAPS: six asks a tier an account a real UTC day - the seventh refused `capped` (409, the balance with it) while another tier still asks, and a new day asks again; finds pay two keys an arena week whatever the tier - a third yes finds nothing until the next week (mutants: the day\'s cap off by one; the cap shared by every tier; the day never turning; the week\'s cap off; the week never turning; a capped yes paid)', async (t) => {
  const { S, me, die, at } = await stood(t);
  await S.claim(me, 700, T0);
  die.v = 0xff;
  const asks = [];
  for (let k = 0; k < EG_FIND_PER_DAY; k++) asks.push((await S.call('/v1/eg/find', { tier: 'elite' }, me.secret)).body.asks);
  assert.deepEqual(asks, [5, 4, 3, 2, 1, 0]);
  const capped = await S.call('/v1/eg/find', { tier: 'elite' }, me.secret);
  assert.deepEqual([capped.status, capped.body], [409, { error: 'capped', keys: 1 }]);
  assert.equal((await S.call('/v1/eg/find', { tier: 'regular' }, me.secret)).body.asks, 5, 'each tier its own six');
  at(T0 + 86_400 - (T0 % 86_400));   // the next UTC day
  assert.equal((await S.call('/v1/eg/find', { tier: 'elite' }, me.secret)).body.asks, 5, 'a new day');
  // the week: two keys from finds, across the tiers
  const wk0 = ARENA_SEASON_EPOCH_S + ARENA_WEEK_S * Math.floor((T0 - ARENA_SEASON_EPOCH_S) / ARENA_WEEK_S + 1);   // a week's first second
  at(wk0);
  die.v = 0;
  const yes = [];
  for (const tier of ['super', 'elite', 'regular', 'super']) yes.push((await S.call('/v1/eg/find', { tier }, me.secret)).body);
  assert.deepEqual(yes.map((r) => [r.found, r.keys]), [[true, 2], [true, 3], [false, 3], [false, 3]], 'two a week');
  assert.equal(EG_FIND_KEYS_PER_WEEK, 2);
  assert.equal(S.env.DB._raw.prepare('SELECT SUM(found) AS n FROM eg_finds WHERE account = ?').get(me.id).n, 2, 'a capped yes marks nothing');
  at(wk0 + ARENA_WEEK_S - 1);
  assert.equal((await S.call('/v1/eg/find', { tier: 'elite' }, me.secret)).body.found, false, 'the week\'s last second');
  at(wk0 + ARENA_WEEK_S);
  assert.deepEqual((await S.call('/v1/eg/find', { tier: 'elite' }, me.secret)).body, { found: true, keys: 4, asks: 5 }, 'a new week');
});

test('EG-E3 THE FIND ON THE CLIENT, WHO ASKS: an elite foe dying in a dungeon online - the owner asks for its own kill (the striker null, or its own id) and leaves a joiner\'s to the joiner, whose record door asks; one ask a body; nothing for a plain foe, outside a dungeon or offline; a yes throws a Weir Key onto the body and restacks the pack to the balance less it, and says so (mutants: the owner asking a joiner\'s kill; a body asked twice; a plain foe asked; the key not thrown)', async () => {
  const asks = [], thrown = [], said = [];
  const doors = { tier: 'elite', online: true, answer: { ok: true, data: { found: false, keys: 3, asks: 5 } } };
  const F = registerEgFind({
    ask: async (tier) => { asks.push(tier); return doors.answer; },
    tierNow: () => doors.tier, selfId: () => 'peer-host', online: () => doors.online,
    say: (l) => said.push(l), throwKey: (entity, keys) => thrown.push([entity, keys]),
  });
  const elite = () => ({ eliteFoe: true, items: [], mobileType: 1 });
  const tick = () => new Promise((r) => setImmediate(r));
  // the owner's death raise: its own blow, and a joiner's
  const mine = elite(), theirs = elite(), self = elite();
  raiseEnemyDeath(mine, { by: null });
  raiseEnemyDeath(theirs, { by: 'peer-joiner' });
  raiseEnemyDeath(self, { by: 'peer-host' });
  await tick();
  assert.deepEqual(asks, ['elite', 'elite'], 'the owner asks for its own kills, never a joiner\'s');
  // the joiner's door: the record names it
  assert.equal(await F.struck(theirs), false);
  assert.equal(asks.length, 3);
  assert.equal(await F.struck(theirs), false, 'once a body');
  assert.equal(asks.length, 3);
  // nothing for a plain foe, outside a dungeon, offline
  raiseEnemyDeath({ items: [] }, { by: null });
  doors.tier = null; raiseEnemyDeath(elite(), { by: null });
  doors.tier = 'super'; doors.online = false; raiseEnemyDeath(elite(), { by: null });
  await tick();
  assert.equal(asks.length, 3);
  assert.deepEqual([egFindAsks(elite(), 'regular', true), egFindAsks(elite(), 'super', true), egFindAsks(elite(), 'abyss', true), egFindAsks({ elite: true }, 'elite', true), egFindAsks(elite(), 'elite', 1)], [true, true, false, false, false]);
  // a yes
  doors.online = true; doors.answer = { ok: true, data: { found: true, keys: 4, asks: 2 } };
  const lucky = elite();
  assert.equal(await F.death(lucky, null), true);
  assert.deepEqual(asks.at(-1), 'super', 'the dungeon\'s tier asked');
  assert.deepEqual(thrown, [[lucky, 4]]);
  assert.deepEqual(said, [EG_FIND_TEXT.found]);
  // a refusal (capped, a guest) and a throw that fails are nothing
  doors.answer = { ok: false, status: 409, data: { error: 'capped' } };
  assert.equal(await F.death(elite(), null), false);
  const R = registerEgFind({ ask: async () => { throw new Error('down'); }, tierNow: () => 'elite', selfId: () => 'p', online: () => true, throwKey: () => {} });
  assert.equal(await R.death(elite(), null), false, 'the service down: nothing');
  // THE THROW: one key onto the body (as a card is), the pack the balance less it
  const body = { items: [] }, pack = [weirKeys(1)];
  egFindThrow(body, pack, 4);
  assert.equal(body.items.length, 1);
  assert.ok(isWeirKey(body.items[0]));
  assert.deepEqual([weirKeysHeld(body.items), weirKeysHeld(pack)], [1, 3], 'the body\'s key taken up makes the pack the balance');
  egFindThrow({ items: [] }, pack, 1);
  assert.equal(weirKeysHeld(pack), 0);
  R.dispose(); F.dispose();
  const before = asks.length;
  raiseEnemyDeath(elite(), { by: null });
  await tick();
  assert.equal(asks.length, before, 'disposed: the handler gone');
  assert.equal(EG_FIND_HANDLER, 'eg-find');
  registerEnemyDeathHandler(EG_FIND_HANDLER, null);
});

test('EG-E3 x PARTY-LOOT A ROOM\'S BODY (the merge of main into PR #800; Elite-Gates.md section 5): online a dungeon body is the room\'s base, every client rolling its death on the room\'s dice - so the find never answers that raise (`room`), the kill asks it at the host (egFindKill: the owner for its own kill, never a joiner\'s) and the joiner\'s door as before, and a key found on a room\'s body goes to the pack whole - none on a copy nobody sees; the room\'s base marks its raise and the dungeon host asks at the kill and at the joiner\'s door (mutants: the room\'s raise answered; the key thrown on the copy; a joiner\'s kill asked by the owner; the joiner\'s room flag lost; the pack short a key; the room\'s raise unmarked; the host\'s kill never asks; the joiner\'s door unflagged)', async () => {
  const asks = [], thrown = [];
  const F = registerEgFind({
    ask: async (tier) => { asks.push(tier); return { ok: true, data: { found: true, keys: 4, asks: 1 } }; },
    tierNow: () => 'elite', selfId: () => 'peer-host', online: () => true, throwKey: (entity, keys) => thrown.push([entity, keys]),
  });
  const elite = () => ({ eliteFoe: true, items: [], mobileType: 1 });
  const tick = () => new Promise((r) => setImmediate(r));
  try {
    // the room's base: every client's roll of the death - no ask
    raiseEnemyDeath(elite(), { room: true, luck: 50, level: 20 });
    await tick();
    assert.deepEqual(asks, [], 'the room\'s raise asks nothing');
    // the kill at the host: its own, and a joiner's left to the joiner
    const mine = elite();
    assert.equal(await egFindKill(mine, null), true);
    assert.equal(await egFindKill(elite(), 'peer-joiner'), false, 'a joiner\'s kill is the joiner\'s');
    assert.deepEqual(asks, ['elite']);
    assert.deepEqual(thrown, [[null, 4]], 'its key to the pack, none on the copy');
    assert.deepEqual(mine.items, []);
    // the joiner's door, a room's body
    const theirs = elite();
    assert.equal(await egFindStruck(theirs, true), true);
    assert.deepEqual(thrown.at(-1), [null, 4]);
    assert.equal(await egFindStruck(elite()), true, 'a body of no room');
    assert.equal(thrown.at(-1)[0] != null, true, 'thrown on its body as before');
    // the pack whole
    const pack = [];
    egFindThrow(null, pack, 4);
    assert.equal(weirKeysHeld(pack), 4);
  } finally { F.dispose(); registerEnemyDeathHandler(EG_FIND_HANDLER, null); }
  // the room's base marks its raise; the dungeon host asks at the kill and at the joiner's door
  const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
  assert.match(rd('src/scenes/roomLootHost.js'), /raiseEnemyDeath\(e, \{ \.\.\.o, level: terms\.lv, room: true \}\);/);
  const DC = rd('src/scenes/dungeonContext.js');
  assert.match(DC, /if \(!_roomBody\) raiseEnemyDeath\(foe\.entity, \{ luck: liveStat\(playerEntity, 'luck'\), by: foe\._killedBy \?\? null \}\); else egFindKill\(foe\.entity, foe\._killedBy \?\? null\)\.catch\(\(\) => \{\}\);/);
  assert.match(DC, /egFindStruck\(f\.entity, roomLootOn\(\) && roomCanonOfFoe\(f\) != null\)\.catch\(\(\) => \{\}\);/);
});
