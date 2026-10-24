// RESTORE (2026-09-29, Mac: "I want people to get their stuff back"; of the deeds: "Keep all, can't sell"). Customs
// used to take whole deeds off the realm's copy - a house's slot emptied, the ship gone, the pieces bought for the room
// taken out (AUDIT REALM2 T3) - and HOUSE-LOSS only narrowed when. Now:
//   A. customs never takes a deed: every one crosses, marked (a house's slot `crossed`, the ship's `shipCrossed`), its
//      bought pieces paying nothing back, and online the realm's bank buys none of it back (src/systems/banking.js
//      crossedDeedLines, sellHouse, sellShip) - so a deed carries no gold past the allowance;
//   B. what customs took before is given back: the offline character's own save on its device still owns the deed, and
//      the realm character's save still keeps the deed's room among its permanent scenes (a sale never leaves one) - the
//      two together are the evidence (src/systems/realmCustoms.js reclaimCustomsDeeds), at the realm boot (world.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { r2 } from '../realmSeat.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1 (at the merge with main): a request that makes an account carries the versions ticked
import { reclaimCustomsDeeds, reclaimFromDevice, reclaimLines, applyCustoms } from '../../src/systems/realmCustoms.js';
import { createBankAccounts, createHouses, allocateHouseToPlayer, ownsHouse, ownsShip, sellHouse, sellShip, SHIP_TYPES, SHIP_INTERIOR_MAP_IDS, CROSSED_DEED_LINES, TRANSACTION_RESULT } from '../../src/systems/banking.js';
import { interiorSceneName } from '../../src/systems/sceneCache.js';
import { BUILDING_KEY_0 } from '../../src/systems/talk/talkTopics.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../../src/ui/bankWindow.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ── the saves, as customs reads them (test/systems/auditrealm2_customs.test.js's own shapes) ──
const piece = (id, paid, own = false) => ({ id, model: 41000, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, storage: false, paid, ...(own ? { item: { g: 5 } } : {}) });
const room = (sceneName, over = {}) => ({ sceneName, lootContainers: [], droppedPiles: [], decorItems: {}, decor: [], ...over });
function holder({ level = 10, gold = 0, bank = 0, ship = SHIP_TYPES.None, houses = [], scenes = [], id = 'offline-1' }) {
  const snap = { characterId: id, level, goldPieces: gold, items: [], wagonItems: [], classicMinutes: 1_000, bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: ship,
    sceneCache: { permanentScenes: scenes.map((sc) => sc.sceneName), scenes }, dungeon: null, world: { piles: [] } };
  snap.bankAccounts[0].accountGold = bank;
  for (const [region, mapId, buildingKey, location = 'Daggerfall'] of houses) allocateHouseToPlayer(snap.houses, region, { buildingKey, mapId, location });
  return snap;
}
/** GarySoup's offline character: a furnished house in Wayrest (region 17), a Small ship with a bought chair aboard. */
const garysOffline = () => {
  const house = room(interiorSceneName(1017, 5), { decor: [...Array.from({ length: 20 }, (_, i) => piece(`p${i}`, 400)), piece('own', 0, true)] });
  const cabin = room(interiorSceneName(SHIP_INTERIOR_MAP_IDS[SHIP_TYPES.Small], BUILDING_KEY_0), { decor: [piece('chair', 300)] });
  return holder({ level: 5, gold: 10_000, bank: 60_000, ship: SHIP_TYPES.Small, houses: [[17, 1017, 5, 'Wayrest']], scenes: [house, cabin] });
};
/** What customs did to the realm's copy before RESTORE (AUDIT REALM2 T3, as its code ran): every deed off the copy - the
 *  slot to sellHouse's fresh record, the ship to None, the room's bought pieces out - and each room LEFT among the
 *  permanent scenes (only a sale drops one). */
function strippedByOldCustoms(offline) {
  const copy = JSON.parse(JSON.stringify(offline));
  copy.characterId = 'r0123456789abcdef0123';
  for (const slot of copy.houses) {
    if (!(slot.buildingKey > 0)) continue;
    const r = copy.sceneCache.scenes.find((sc) => sc.sceneName === interiorSceneName(slot.mapId, slot.buildingKey));
    if (r) r.decor = r.decor.filter((p) => p?.item);
    Object.assign(slot, { location: '', mapId: 0, buildingKey: 0 });
  }
  if (copy.ownedShip !== SHIP_TYPES.None) {
    const r = copy.sceneCache.scenes.find((sc) => sc.sceneName === interiorSceneName(SHIP_INTERIOR_MAP_IDS[copy.ownedShip], BUILDING_KEY_0));
    if (r) r.decor = r.decor.filter((p) => p?.item);
    copy.ownedShip = SHIP_TYPES.None;
  }
  return copy;
}
const roomOf = (snap, name) => snap.sceneCache.scenes.find((sc) => sc.sceneName === name);

test('RESTORE B: what customs took off a realm character comes back from its offline save - the house (marked crossed), every bought piece (paying nothing back), the ship - on the evidence of the rooms customs left behind; said once; never twice', () => {
  const offline = garysOffline();
  const realm = strippedByOldCustoms(offline);
  assert.deepEqual([ownsHouse(realm.houses, 17), ownsShip(realm), roomOf(realm, interiorSceneName(1017, 5)).decor.map((p) => p.id)], [false, false, ['own']], 'the loss, as customs left it');
  const back = reclaimCustomsDeeds(realm, offline);
  assert.deepEqual(back, { houses: ['Wayrest'], ship: true, pieces: 21 });
  assert.deepEqual(realm.houses[17], { regionIndex: 17, location: 'Wayrest', mapId: 1017, buildingKey: 5, crossed: true });
  assert.deepEqual([realm.ownedShip, realm.shipCrossed], [SHIP_TYPES.Small, true]);
  const house = roomOf(realm, interiorSceneName(1017, 5));
  assert.deepEqual([house.decor.length, house.decor.filter((p) => p.id === 'own').length], [21, 1], 'every piece back, the owner\'s own never twice');
  assert.deepEqual(house.decor.filter((p) => p.id !== 'own').map((p) => p.paid), Array(20).fill(0));
  assert.deepEqual(roomOf(realm, interiorSceneName(SHIP_INTERIOR_MAP_IDS[SHIP_TYPES.Small], BUILDING_KEY_0)).decor.map((p) => [p.id, p.paid]), [['chair', 0]]);
  assert.deepEqual(reclaimLines(back), ['Customs had kept back your ship and your house in Wayrest. They are yours again, with every piece in them. The realm\'s bank does not buy back what came through customs.']);
  // the offline character is untouched, and the realm's bank buys none of it back online
  assert.equal(offline.houses[17].crossed, undefined);
  assert.equal(sellHouse(realm.bankAccounts, realm.houses, 17, { meshRadius: 60, found: true, online: true }).kind, 'crossed');
  assert.equal(sellShip(realm.bankAccounts, 17, realm, { online: true }).kind, 'crossed');
  // once back, nothing matches it again
  assert.deepEqual(reclaimCustomsDeeds(realm, offline), { houses: [], ship: false, pieces: 0 });
  assert.deepEqual(reclaimLines({ houses: [], ship: false, pieces: 0 }), []);
  assert.deepEqual(reclaimLines({ houses: [''], ship: false, pieces: 3 }), ['Customs had kept back your house. It is yours again, with every piece in it. The realm\'s bank does not buy back what came through customs.']);
});

test('RESTORE B: only the evidence gives back - a house the realm character sold since (a sale drops its room), a region where it owns another house now, a ship it bought since, a house bought offline after customs (never in the copy), a rented room the offline character never owned: nothing comes back and nothing is taken', () => {
  // sold in the realm, before customs' mark existed: sellHouse drops the permanent room
  const offline = garysOffline();
  const realm = strippedByOldCustoms(offline);
  realm.sceneCache.permanentScenes = realm.sceneCache.permanentScenes.filter((n) => n !== interiorSceneName(1017, 5));
  realm.sceneCache.permanentScenes = realm.sceneCache.permanentScenes.filter((n) => n !== interiorSceneName(SHIP_INTERIOR_MAP_IDS[SHIP_TYPES.Small], BUILDING_KEY_0));
  assert.deepEqual(reclaimCustomsDeeds(realm, offline), { houses: [], ship: false, pieces: 0 });
  // a house of its own in that region now, and a ship of its own: kept, nothing taken, nothing doubled
  const realm2 = strippedByOldCustoms(offline);
  allocateHouseToPlayer(realm2.houses, 17, { buildingKey: 88, mapId: 2017, location: 'Wayrest' });
  realm2.ownedShip = SHIP_TYPES.Large;
  assert.deepEqual(reclaimCustomsDeeds(realm2, offline), { houses: [], ship: false, pieces: 0 });
  assert.deepEqual([realm2.houses[17].buildingKey, realm2.ownedShip, realm2.shipCrossed], [88, SHIP_TYPES.Large, undefined]);
  // bought offline AFTER customs: its room was never in the realm's copy
  const later = garysOffline();
  const realm3 = strippedByOldCustoms(later);
  allocateHouseToPlayer(later.houses, 20, { buildingKey: 7, mapId: 1020, location: 'Sentinel' });
  later.sceneCache.scenes.push(room(interiorSceneName(1020, 7)));
  later.sceneCache.permanentScenes.push(interiorSceneName(1020, 7));
  const b3 = reclaimCustomsDeeds(realm3, later);
  assert.deepEqual([b3.houses, ownsHouse(realm3.houses, 20)], [['Wayrest'], false], 'Wayrest comes back; Sentinel was never the realm\'s');
  // a rented room is a permanent interior too - but no house of the offline character's: nothing
  const tenant = holder({ id: 'offline-2' });
  const realm4 = strippedByOldCustoms(tenant);
  realm4.sceneCache.permanentScenes.push(interiorSceneName(1099, 3));
  realm4.sceneCache.scenes.push(room(interiorSceneName(1099, 3)));
  assert.deepEqual(reclaimCustomsDeeds(realm4, tenant), { houses: [], ship: false, pieces: 0 });
  // a piece of the owner's own that the realm character took back into its pack since: never put back - its item would
  // stand twice, in the room and in the pack
  const mine = garysOffline();
  const realm5 = strippedByOldCustoms(mine);
  roomOf(realm5, interiorSceneName(1017, 5)).decor = [];
  reclaimCustomsDeeds(realm5, mine);
  assert.deepEqual(roomOf(realm5, interiorSceneName(1017, 5)).decor.map((p) => p.id).includes('own'), false);
  assert.equal(roomOf(realm5, interiorSceneName(1017, 5)).decor.length, 20, 'the twenty bought pieces, and nothing of the owner\'s own');
  // and a bought piece still standing in the room is never stood twice - a room's pieces are one each by id
  const kept = garysOffline();
  const realm6 = strippedByOldCustoms(kept);
  roomOf(realm6, interiorSceneName(1017, 5)).decor.push({ ...roomOf(kept, interiorSceneName(1017, 5)).decor[0] });
  reclaimCustomsDeeds(realm6, kept);
  const ids = roomOf(realm6, interiorSceneName(1017, 5)).decor.map((p) => p.id);
  assert.deepEqual([ids.length, new Set(ids).size], [21, 21]);
  // nothing to read, nothing done
  assert.deepEqual(reclaimCustomsDeeds(null, tenant), { houses: [], ship: false, pieces: 0 });
  assert.deepEqual(reclaimCustomsDeeds(realm4, null), { houses: [], ship: false, pieces: 0 });
});

test('RESTORE B: the offline character is the one the realm character came from, on this device - its newest save, by id (saveSlots.js firstRestorable\'s walk); none without an origin or a save; and customs from now on leaves nothing to give back', () => {
  const offline = garysOffline();
  const realm = strippedByOldCustoms(offline);
  const asked = [];
  const find = (accept) => {
    for (const e of [{ snap: { characterId: 'someone-else' } }, { snap: offline }]) { asked.push(e.snap.characterId); if (accept(e)) return e; }
    return null;
  };
  assert.deepEqual(reclaimFromDevice(realm, 'offline-1', { find }).houses, ['Wayrest']);
  assert.deepEqual(asked, ['someone-else', 'offline-1']);
  assert.equal(reclaimFromDevice(realm, null, { find }), null, 'born online: no origin');
  assert.equal(reclaimFromDevice(realm, 'gone-from-this-device', { find: () => null }), null);
  // a customs run now takes no deed: the realm's copy owns them, crossed, and there is nothing left over to give back
  const fresh = garysOffline();
  const copy = JSON.parse(JSON.stringify(fresh));
  applyCustoms(copy);
  assert.deepEqual([ownsHouse(copy.houses, 17), ownsShip(copy), copy.houses[17].crossed, copy.shipCrossed], [true, true, true, true]);
  assert.deepEqual(reclaimCustomsDeeds(copy, fresh), { houses: [], ship: false, pieces: 0 });
});

test('RESTORE A: the ship\'s customs mark rides the save - a house\'s rides its slot - and a save without it restores none', () => {
  const character = { name: 'Gary', gender: 'male', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0], career: { name: 'Healer', hitPointsPerLevel: 8 },
    items: [], spells: [], activeEffects: [], bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: SHIP_TYPES.Small, shipCrossed: true };
  character.houses[17] = { regionIndex: 17, location: 'Wayrest', mapId: 1017, buildingKey: 5, crossed: true };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(character, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  assert.deepEqual([snap.shipCrossed, snap.houses[17].crossed], [true, true]);
  const loaded = { ...character, shipCrossed: undefined };
  restorePlayer(loaded, snap, new Map());
  assert.deepEqual([loaded.shipCrossed, loaded.houses[17].crossed], [true, true]);
  const plain = JSON.parse(JSON.stringify(snap));
  delete plain.shipCrossed;
  const other = { ...character };
  restorePlayer(other, plain, new Map());
  assert.equal('shipCrossed' in other, false, 'a save without the mark restores none');
});

test('RESTORE A: the bank buys a crossed deed back nowhere online - its window says why and raises no offer; a ship bought or reset, and a house bought into a crossed slot, are the buyer\'s own', async () => {
  const { assignShipToPlayer, resetShip } = await import('../../src/systems/banking.js');
  let sold = 0;
  const open = (crossed) => new BankWindow({
    accounts: () => createBankAccounts(62), regionIndex: () => 17, level: () => 5, now: () => 1000,
    player: { gold: () => 0, totalGold: () => 0, deductGold: () => 0, addGold: () => {}, wagonGold: () => 0, takeWagonGold: () => {}, takeLetter: () => null, addLetter: () => {}, carriedWeightKg: () => 0, maxEncumbranceKg: () => 1e9 },
    wagonGold: () => 0, rows: (id) => [{ text: `#${id}`, center: true }], dueDateText: () => '',
    ownsHouse: () => true, ownedHouseResolved: () => true, houseSellPrice: () => 5_000, ownsShip: () => true, ownedShip: () => SHIP_TYPES.Small,
    housesForSale: () => 0, isPortTown: () => true, onClose: () => {},
    sellHouse: () => { sold++; }, sellShip: () => { sold++; },
    crossedDeed: () => (crossed ? CROSSED_DEED_LINES : null),
  });
  const click = (w, key) => { const [x, y, rw, rh] = BANK_RECTS[key]; return w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2); };
  for (const key of ['sellHouse', 'sellShip']) {
    const w = open(true);
    click(w, key);
    assert.deepEqual([w.box.rows.map((r) => r.text), w.box.buttons, w.box.onYes], [[...CROSSED_DEED_LINES], null, null], `${key}: said, never offered`);
    const plain = open(false);
    click(plain, key);
    assert.equal(plain.box.buttons, 'YesNo', `${key}: any other deed is offered as ever`);
    assert.equal(Number(/^#(\d+)/.exec(plain.box.rows[0].text)?.[1]), key === 'sellHouse' ? TRANSACTION_RESULT.SELL_HOUSE_OFFER : TRANSACTION_RESULT.SELL_SHIP_OFFER);
  }
  assert.equal(sold, 0);
  // what the realm buys is the buyer's own: the mark goes with the deed it was on
  const p = { ownedShip: SHIP_TYPES.Small, shipCrossed: true };
  assignShipToPlayer(p, SHIP_TYPES.Large);
  assert.equal('shipCrossed' in p, false);
  const q = { ownedShip: SHIP_TYPES.Small, shipCrossed: true };
  resetShip(q);
  assert.deepEqual([q.ownedShip, 'shipCrossed' in q], [SHIP_TYPES.None, false]);
  // the host's hook is the law's (worldModes.js), in the bank's own region
  assert.match(src('src/scenes/worldModes.js'), /crossedDeed: \(kind\) => crossedDeedLines\(kind, \{ houses: playerEntity\.houses, regionIndex: bankRegion\(\), player: playerEntity \}\),/);
});

// ── the service: the join says where a customs character came from ──
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
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
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

test('RESTORE B: the join answers the offline id a customs character came from, and none for one born online; the boot hands it on, and gives back into the save before anything restores it, and says what came back once the world stands', async () => {
  _resetKeyForTests();
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body) }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  env.DB._raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(g.id, 'offline-1');
  const came = await call('/v1/realm/customs', { origin: 'offline-1', name: 'Gary', summary: { level: 5 } }, g.secret);
  const born = await call('/v1/realm/create', { name: 'Born' }, g.secret);
  assert.equal((await call('/v1/realm/join', { id: came.body.id }, g.secret)).body.origin, 'offline-1');
  assert.equal((await call('/v1/realm/join', { id: born.body.id }, g.secret)).body.origin, null);
  // the client carries it through the boot's join (systems/realmSaves.js openRealmBoot)
  const saves = src('src/systems/realmSaves.js');
  assert.match(saves, /const \{ lease, seq, bytes, origin = null \} = joined\.data \?\? \{\};/);
  assert.match(saves, /return \{ ok: true, snap, lease, seq: got\.seq \?\? seq, origin: typeof origin === 'string' \? origin : null, gzip: joined\.data\?\.gzip === true \};/);   // REALM-GZIP: and the join's word that the service opens a packed save
  // ...and world.js gives back right after the realm's one parse, before the Test Room's check reads it
  const world = src('src/scenes/world.js');
  const parse = world.indexOf('if (realmBoot) { bootSnapRead = realmBoot.snap; realmBoot.snap = null; }');
  const given = world.indexOf('const realmGiven = realmBoot?.origin ? reclaimFromDevice(bootSnapRead, realmBoot.origin) : null;');
  const testRoom = world.indexOf('const testRoomOffline = testRoomOnlineRefused(params, { snap: bootSnap });');
  assert.ok(parse > 0 && given > parse && testRoom > given, 'given back into the one parse, before anything reads it');
  assert.match(world, /for \(const line of reclaimLines\(realmGiven\)\) townTalk\.say\(line\);/);
});
