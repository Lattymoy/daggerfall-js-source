// HOUSE-LOSS (2026-09-29, the field through Mac: "GarySoup lost his house and furniture. I suspect a lot of people lost a
// ton of belongings"). Two roads took them, both reproduced here first:
//   1. THE DELETE THAT TOOK WHAT CUSTOMS CARRIED. Customs carries the offline character's online home, guild place and
//      track to the realm's id in the census's own batch, before the first save is sent (CUSTOMS-CARRY). A first save
//      that failed (refused, too large, lost) left a "Never saved" tile whose one live button was Delete - and the
//      door's own word was "Delete it and make it again" - and the delete took the home, its pieces and its hidden
//      furniture (the tables' cascade) and left the census spent, so the character could never come in again. Now a
//      customs whose first save never landed is UNDONE by its delete (server-account/src/realm.js undoCustoms), and the
//      door offers "Undo bringing in" on its own route (undoRealm).
//   2. THE DEED STRIPPED FOR AN EXCESS THE GOLD COULD PAY. Customs stripped whole deeds - a house and every piece bought
//      for its room, the ship - before a coin of the bank or the purse (AUDIT REALM2 T3's order). RESTORE (Mac: "Keep
//      all, can't sell"): customs never takes a deed now - every one crosses marked, the realm's bank never buys a crossed
//      one back, and the gold alone is capped (src/systems/realmCustoms.js applyCustoms, crossDeeds).
// The service's pins drive the REAL Worker over the REAL migrations (node:sqlite behind a D1-shaped face whose batch is
// one transaction), as test/server/fb0929_customs.test.js does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { REALM_ID_RE, realmPrefix } from '../../server-account/src/realm.js';
import { ROUTES } from '../../server-account/src/service.js';
import { r2, freshSave } from '../realmSeat.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1 (at the merge with main): a request that makes an account carries the versions ticked
import { applyCustoms, liquidWealthOf, customsLines, customsAllowance, deedsOf } from '../../src/systems/realmCustoms.js';
import { realmRefusalText } from '../../src/systems/realmSaves.js';
import { createBankAccounts, createHouses, allocateHouseToPlayer, ownsHouse, ownsShip, SHIP_TYPES, SHIP_INTERIOR_MAP_IDS } from '../../src/systems/banking.js';
import { interiorSceneName, LOOT_CONTAINER_TYPES } from '../../src/systems/sceneCache.js';
import { BUILDING_KEY_0 } from '../../src/systems/talk/talkTopics.js';
import { goldStack } from '../../src/systems/inventory.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

/** The D1 face, with one seam: `hooks.beforeBatch` runs just before a batch - a write landing between a read and it. */
function d1(hooks) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      const before = hooks.beforeBatch;
      hooks.beforeBatch = null;
      before?.();
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

async function stand(vars = {}) {
  _resetKeyForTests();
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const hooks = { beforeBatch: null };
  const env = { DB: d1(hooks), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', ...vars };
  const call = async (path, body, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const put = async (id, text, secret, { lease, seq }) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) }, body: text,
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  let n = 0;
  /** A registered account (homes are a registered account's). */
  const account = async (handle = `settler${++n}x`) => {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    assert.equal((await call('/v1/auth/register', { secret: g.secret, handle, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200);
    return { id: g.id, secret: g.secret };
  };
  const rows = (sql, ...a) => env.DB._raw.prepare(sql).all(...a).map((r) => ({ ...r }));
  const exec = (sql, ...a) => env.DB._raw.prepare(sql).run(...a);
  /** A furnished online home from before the realm, under the offline id: three pieces and one hidden base piece. */
  const furnishedHome = (who, charId, key = 7) => {
    exec("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (4242, ?, ?, ?, 'Gary', 17, 'private', 40000, 1)", key, who.id, charId);
    for (const id of ['bed', 'table', 'chest']) exec("INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid) VALUES (4242, ?, ?, 41000, '{}', 1, 400)", key, id);
    exec("INSERT INTO home_hidden (map_id, building_key, keys) VALUES (4242, ?, '[\"b1\"]')", key);
  };
  const house = (key = 7) => ({
    homes: rows('SELECT char_id FROM homes WHERE building_key = ?', key).map((r) => r.char_id),
    pieces: rows('SELECT COUNT(*) AS n FROM home_decor WHERE building_key = ?', key)[0].n,
    hidden: rows('SELECT COUNT(*) AS n FROM home_hidden WHERE building_key = ?', key)[0].n,
  });
  /** Customs asked at level 5 (an allowance of 70,000), as the door asks it. */
  const customs = (who, origin) => call('/v1/realm/customs', { origin, name: 'Gary', summary: { level: 5 } }, who.secret);
  /** A first save the realm refuses: past the allowance customs was asked at - one of the ways a first save fails. */
  const refusedFirstSave = (who, came) => put(came.body.id, JSON.stringify(freshSave({ name: 'Gary', level: 5, goldPieces: 1_000_000 })), who.secret, { lease: came.body.lease, seq: 1 });
  const firstSave = (who, came) => put(came.body.id, JSON.stringify(freshSave({ name: 'Gary', level: 5 })), who.secret, { lease: came.body.lease, seq: 1 });
  return { env, hooks, call, account, rows, exec, furnishedHome, house, customs, refusedFirstSave, firstSave };
}

test('HOUSE-LOSS 1: the field\'s loss, reproduced and closed - a customs whose first save never landed, deleted from the door as it said to, gives back the home, its pieces and its hidden furniture, and the character comes in again carrying them', async () => {
  const s = await stand();
  const gary = await s.account('GarySoup');
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', gary.id, 'gary-offline');
  s.furnishedHome(gary, 'gary-offline');
  const came = await s.customs(gary, 'gary-offline');
  assert.equal(came.status, 200);
  assert.deepEqual(s.house(), { homes: [came.body.id], pieces: 3, hidden: 1 }, 'customs carried the house before any save');
  assert.deepEqual(await s.refusedFirstSave(gary, came), { status: 403, body: { error: 'customs-allowance' } }, 'and its first save failed');
  const [tile] = (await s.call('/v1/realm', {}, gary.secret)).body?.characters ?? [];
  assert.equal(tile, undefined, 'the listing is a GET - asked below as the door asks it');
  const listed = await worker.fetch(new Request('https://accounts.invalid/v1/realm', { headers: { authorization: `Bearer ${gary.secret}` } }), s.env);
  const [row] = (await listed.json()).characters;
  assert.deepEqual([row.customs, row.bytes], [true, 0], 'the door shows it "Never saved"');
  // the door's old button, as it said: "Delete it and make it again"
  assert.deepEqual(await s.call('/v1/realm/delete', { id: came.body.id }, gary.secret), { status: 200, body: { ok: true, undone: true } });
  assert.deepEqual(s.house(), { homes: ['gary-offline'], pieces: 3, hidden: 1 }, 'the house, every piece and the hidden furniture - back under the offline id, none of it deleted');
  assert.deepEqual([s.rows('SELECT * FROM realm_characters'), s.rows('SELECT spent FROM realm_census WHERE char_id = ?', 'gary-offline')], [[], [{ spent: 0 }]], 'the row gone, the census unspent');
  // ...so the character comes in again, and the house with it
  const again = await s.customs(gary, 'gary-offline');
  assert.equal(again.status, 200);
  assert.notEqual(again.body.id, came.body.id);
  assert.match(again.body.id, REALM_ID_RE);
  assert.equal((await s.firstSave(gary, again)).status, 200);
  assert.deepEqual(s.house(), { homes: [again.body.id], pieces: 3, hidden: 1 });
  assert.deepEqual(await s.customs(gary, 'gary-offline'), { status: 409, body: { error: 'customs-already' } }, 'landed, it is in once, as ever');
});

test('HOUSE-LOSS 1: the door\'s undo is its own route - it undoes a customs that never landed and nothing else: a landed one is `seq`, one born online is no customs (`body`), another account\'s is not found; a first save landing between the read and the undo keeps the character and moves nothing', async () => {
  assert.ok(ROUTES.has('/v1/realm/undo'));
  const s = await stand();
  const gary = await s.account(), other = await s.account();
  for (const o of ['o-landed', 'o-open', 'o-race']) s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', gary.id, o);
  const landed = await s.customs(gary, 'o-landed');
  assert.equal((await s.firstSave(gary, landed)).status, 200);
  assert.deepEqual(await s.call('/v1/realm/undo', { id: landed.body.id }, gary.secret), { status: 409, body: { error: 'seq' } }, 'in the realm now: no undo');
  const born = await s.call('/v1/realm/create', { name: 'Born' }, gary.secret);
  assert.deepEqual(await s.call('/v1/realm/undo', { id: born.body.id }, gary.secret), { status: 400, body: { error: 'body' } }, 'born online: no customs to undo');
  const open = await s.customs(gary, 'o-open');
  assert.equal((await s.call('/v1/realm/undo', { id: open.body.id }, other.secret)).status, 404, 'another account\'s is not found');
  const stray = `${realmPrefix(gary.id)}${open.body.id}/1-deadbeef`;
  await s.env.SAVES.put(stray, 'a write that lost its race');
  assert.deepEqual(await s.call('/v1/realm/undo', { id: open.body.id }, gary.secret), { status: 200, body: { ok: true, undone: true } });
  assert.equal(s.env.SAVES._map.has(stray), false, 'a lost write\'s bytes under its prefix go with it');
  assert.deepEqual(s.rows('SELECT id FROM realm_characters WHERE player = ? ORDER BY id', gary.id).map((r) => r.id).sort(), [landed.body.id, born.body.id].sort(), 'only the open customs went');
  // the race: its first save lands between the undo's read and its batch - the character stands, carried and spent
  s.furnishedHome(gary, 'o-race', 9);
  const racing = await s.customs(gary, 'o-race');
  s.hooks.beforeBatch = () => s.exec('UPDATE realm_characters SET seq = 1, bytes = 10 WHERE id = ?', racing.body.id);
  assert.deepEqual(await s.call('/v1/realm/undo', { id: racing.body.id }, gary.secret), { status: 409, body: { error: 'seq' } });
  assert.deepEqual(s.house(9), { homes: [racing.body.id], pieces: 3, hidden: 1 }, 'nothing moved back');
  assert.deepEqual(s.rows('SELECT spent FROM realm_census WHERE char_id = ?', 'o-race'), [{ spent: 1 }]);
  // and the delete's own lane holds the same line
  s.furnishedHome(gary, 'o-open', 11);
  const racing2 = await s.customs(gary, 'o-open');
  s.hooks.beforeBatch = () => s.exec('UPDATE realm_characters SET seq = 1, bytes = 10 WHERE id = ?', racing2.body.id);
  assert.deepEqual(await s.call('/v1/realm/delete', { id: racing2.body.id }, gary.secret), { status: 409, body: { error: 'seq' } });
  assert.deepEqual(s.house(11), { homes: [racing2.body.id], pieces: 3, hidden: 1 });
});

test('HOUSE-LOSS 1 / CUSTOMS-PASS: an undo gives back everything customs spent - on every account a copy of the character was counted on, and a developer\'s pass, whose census row goes with it, so the pass brings the character in again; an account granted another since keeps one open pass, never two', async () => {
  const s = await stand({ DEVELOPER_HANDLES: 'StaffDev' });
  const dev = await s.account('StaffDev'), a = await s.account('PassHolder'), b = await s.account();
  const grant = async () => assert.deepEqual((await s.call('/v1/mod/customs-pass', { name: 'PassHolder' }, dev.secret)).body?.open, true);
  const passes = () => s.rows('SELECT origin_id, spent_at IS NOT NULL AS spent FROM realm_passes WHERE player = ? ORDER BY id', a.id);
  await grant();
  // counted on b's account (its traces there), never on a's: a's pass brings it in, and spends b's row too
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', b.id, 'shared-o');
  const came = await s.customs(a, 'shared-o');
  assert.equal(came.status, 200);
  assert.deepEqual(s.rows('SELECT player, spent FROM realm_census WHERE char_id = ? ORDER BY player = ?', 'shared-o', a.id), [{ player: b.id, spent: 1 }, { player: a.id, spent: 1 }]);
  assert.deepEqual(passes(), [{ origin_id: 'shared-o', spent: 1 }], 'the pass spent on it');
  assert.deepEqual((await s.call('/v1/realm/undo', { id: came.body.id }, a.secret)).body, { ok: true, undone: true });
  assert.deepEqual(s.rows('SELECT player, spent FROM realm_census WHERE char_id = ?', 'shared-o'), [{ player: b.id, spent: 0 }], 'b\'s row unspent; the pass\'s row gone');
  assert.deepEqual(passes(), [{ origin_id: null, spent: 0 }], 'the pass open again');
  const again = await s.customs(a, 'shared-o');
  assert.equal(again.status, 200, 'the pass brings it in again');
  assert.deepEqual(passes(), [{ origin_id: 'shared-o', spent: 1 }]);
  // spent again, and a developer grants another: the undo opens no second - the spent one's record goes, since the
  // customs it recorded never stood, and the new one stays the account's one open pass
  await grant();
  assert.deepEqual(passes(), [{ origin_id: 'shared-o', spent: 1 }, { origin_id: null, spent: 0 }]);
  assert.deepEqual((await s.call('/v1/realm/undo', { id: again.body.id }, a.secret)).body, { ok: true, undone: true });
  assert.deepEqual(passes(), [{ origin_id: null, spent: 0 }], 'one open pass, never two');
  assert.deepEqual(s.rows('SELECT player, spent FROM realm_census WHERE char_id = ?', 'shared-o'), [{ player: b.id, spent: 0 }]);
  assert.equal((await s.customs(a, 'shared-o')).status, 200, 'and that one brings it in');
});

test('HOUSE-LOSS 1: the door - a character brought in whose first save never landed offers "Undo bringing in" on the undo\'s own route, never Delete; the never-saved word sends one brought in back to its offline tile', () => {
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /row\.customs && save\.unfinished \? \{ label: t\('menu\.realm\.undo', 'Undo bringing in'\), disabled: realmBusy, onClick: \(\) => ask\(t\('menu\.realm\.undoAsk', 'Undo bringing \{name\} in\?', \{ name: row\.name \}\), [^\n]*realmAct\(\(\) => realmUndo\(realmIoNow\(\), row\.id\)/);
  assert.match(menu, /\n\s+: \{ label: t\('menu\.realm\.delete', 'Delete character'\), disabled: realmBusy, onClick: \(\) => ask\(/, 'every other character is deleted as before');
  assert.match(src('src/systems/realmSaves.js'), /export const realmUndo = \([^)]*\) => realmAsk\(io, '\/v1\/realm\/undo', \{ method: 'POST', json: \{ id \} \}\);/);
  const said = realmRefusalText('no-data');
  assert.match(said, /If you brought it in, press Bring online on it again or undo it\./);
  assert.doesNotMatch(said, /^That online character was never saved\. Delete it and make it again\.$/);
});

// ── 2. THE DEEDS ───────────────────────────────────────────────────
const piece = (id, paid, own = false) => ({ id, model: 41000, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, storage: false, paid, ...(own ? { item: { g: 5 } } : {}) });
const room = (sceneName, over = {}) => ({ sceneName, lootContainers: [], droppedPiles: [], decorItems: {}, decor: [], ...over });
/** An offline character's save as customs reads it (test/systems/auditrealm2_customs.test.js's own). */
function holder({ level, gold = 0, bank = 0, ship = SHIP_TYPES.None, houses = [], scenes = [] }) {
  const snap = { level, goldPieces: gold, items: [], wagonItems: [], classicMinutes: 1_000, bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: ship,
    sceneCache: { permanentScenes: scenes.map((sc) => sc.sceneName), scenes }, dungeon: null, world: { piles: [] } };
  snap.bankAccounts[0].accountGold = bank;
  for (const [region, mapId, buildingKey] of houses) allocateHouseToPlayer(snap.houses, region, { buildingKey, mapId, location: 'Daggerfall' });
  return snap;
}
/** GarySoup's shape: a house in region 17 furnished with twenty bought pieces and one of his own. */
const garys = (level, { bank = 60_000, gold = 10_000 } = {}) => {
  const home = room(interiorSceneName(1017, 5), { decor: [...Array.from({ length: 20 }, (_, i) => piece(`p${i}`, 400)), piece('own', 0, true)] });
  return { snap: holder({ level, gold, bank, houses: [[17, 1017, 5]], scenes: [home] }), home };
};

test('HOUSE-LOSS 2 / RESTORE: customs never takes a deed - GarySoup\'s shape (level 10, a house of twenty bought pieces, 60,000 in the bank) brings the house and every piece, marked crossed, and the bank stands; gold past the allowance is still taken, a house chest first', () => {
  const { snap, home } = garys(10);
  const r = applyCustoms(snap);
  assert.deepEqual([r.wealth, r.allowance, r.taken, r.crossed], [70_000, 120_000, 0, ['house']]);
  assert.deepEqual([ownsHouse(snap.houses, 17), snap.houses[17].crossed, home.decor.length, snap.bankAccounts[0].accountGold, snap.goldPieces], [true, true, 21, 60_000, 10_000]);
  assert.deepEqual(home.decor.filter((p) => !p.item).map((p) => p.paid), Array(20).fill(0), 'the bought pieces pay nothing back now');
  assert.deepEqual(customsLines(r), ['Your house came with you, every piece in it; the realm\'s bank does not buy back what comes through customs.']);
  // gold past the allowance is still the allowance's: 100,000 in the house's chest makes 170,000 - the chest pays 50,000
  const { snap: stashed, home: h2 } = garys(10);
  h2.lootContainers.push({ containerType: LOOT_CONTAINER_TYPES.HouseContainers, key: 'container:0', items: [goldStack(100_000)] });
  const st = applyCustoms(stashed);
  assert.deepEqual([st.taken, ownsHouse(stashed.houses, 17), h2.lootContainers[0].items.map((i) => i.stackCount), stashed.bankAccounts[0].accountGold], [50_000, true, [50_000], 60_000]);
});

test('HOUSE-LOSS 2 / RESTORE: the low levels, where a house alone was past the allowance - level 5 keeps its house and every piece and its gold; a Large ship and a house both cross', () => {
  const { snap, home } = garys(5);
  const r = applyCustoms(snap);
  assert.deepEqual([r.taken, r.crossed, ownsHouse(snap.houses, 17), home.decor.length, snap.bankAccounts[0].accountGold, snap.goldPieces], [0, ['house'], true, 21, 60_000, 10_000]);
  assert.equal(liquidWealthOf(snap), 70_000);
  const shipRoom = room(interiorSceneName(SHIP_INTERIOR_MAP_IDS[SHIP_TYPES.Large], BUILDING_KEY_0));
  const both = holder({ level: 1, gold: 50_000, ship: SHIP_TYPES.Large, houses: [[3, 1003, 4]], scenes: [shipRoom] });
  const b = applyCustoms(both);
  assert.deepEqual([b.crossed, ownsShip(both), both.shipCrossed, ownsHouse(both.houses, 3), both.goldPieces], [['ship', 'house'], true, true, true, 30_000]);
});

test('HOUSE-LOSS 2 / RESTORE: the law, swept - whatever the level, the gold, the houses and the ship: every deed owned before customs is owned after it and marked crossed, the gold ends within the allowance, and the service takes the first save customs made', async () => {
  for (const level of [1, 3, 5, 8, 10, 15, 30]) {
    for (const [bank, gold] of [[0, 0], [5_000, 1_000], [60_000, 10_000], [400_000, 90_000]]) {
      for (const houses of [[], [[17, 1017, 5]], [[17, 1017, 5], [18, 1018, 6], [19, 1019, 7]]]) {
        for (const ship of [SHIP_TYPES.None, SHIP_TYPES.Small]) {
          const snap = holder({ level, bank, gold, ship, houses });
          const owned = deedsOf(snap).length;
          const r = applyCustoms(snap);
          const at = `level ${level}, bank ${bank}, purse ${gold}, ${houses.length} houses, ship ${ship}`;
          assert.ok(liquidWealthOf(snap) <= customsAllowance(level), at);
          assert.equal(r.crossed.length, owned, `every deed crossed - ${at}`);
          assert.equal(houses.every(([region]) => ownsHouse(snap.houses, region) && snap.houses[region].crossed === true), true, `no house taken - ${at}`);
          assert.equal(ownsShip(snap), ship !== SHIP_TYPES.None, `no ship taken - ${at}`);
          assert.equal(deedsOf(snap).length, 0, `none left for the realm's bank to buy - ${at}`);
        }
      }
    }
  }
  // end to end: the save customs made for GarySoup's shape is one the realm takes as its first
  const s = await stand();
  const gary = await s.account();
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', gary.id, 'gary-2');
  const { snap } = garys(10);
  applyCustoms(snap);
  const came = await s.call('/v1/realm/customs', { origin: 'gary-2', name: 'Gary', summary: { level: 10 } }, gary.secret);
  const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${came.body.id}/data`, {
    method: 'PUT', headers: { authorization: `Bearer ${gary.secret}`, 'x-realm-lease': came.body.lease, 'x-realm-seq': '1' }, body: JSON.stringify(snap),
  }), s.env);
  assert.equal(res.status, 200, 'the house and its pieces cross, the gold within the allowance the service measures');
});
