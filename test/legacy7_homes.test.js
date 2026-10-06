// LEGACY7 part five (2026-10-06, bible/06-Systems/Legacy-Arc.md section 10b; Mac, LEGACY-HOME: "if a house is owned
// should live in the house"): THE LINE LIVES IN ITS ONLINE HOMES. The code's last "until LEGACY7": online the realm's
// homes were the account service's and no house of the line's. The realm keeps the line now, and a realm character's
// online homes (HOME1) are its houses - learned with the save as a deed is offline, a list not read yet learning nothing
// and dropping nothing; the registry tells the world when a home of mine changed (systems/onlineHomes.js onWrote); the
// world host reads this realm character's homes and hands them to the house (scenes/world.js, by source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { familyRng, MODELS, LEGACY_MOD } from '../src/systems/legacy/family.js';
import { familyHome } from '../src/systems/legacy/household.js';
import { createOnlineHomes } from '../src/systems/onlineHomes.js';
import { _resetModSaveData, modSaveRecords } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (cid) => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});
const HOME = Object.freeze({ regionIndex: 17, mapId: 5001, buildingKey: 0x10203, location: 'Gothway Garden' });
const HALL = Object.freeze({ regionIndex: 20, mapId: 7002, buildingKey: 0x20304, location: 'Sentinel' });

function online() {
  _resetModSaveData();
  _resetModSettings();
  const w = { held: null, here: null, storage: mem() };
  w.host = createLegacyHost({
    entity: ent('r0123456789abcdef0123'), storage: () => w.storage, tab: () => mem(), on: () => true, online: () => true, now: () => 100, own: () => 0,
    here: () => null, town: () => null, nearestTown: () => null, gold: () => 0, say: () => {}, boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(5),
    heldHouses: () => w.held, houseHere: () => w.here, livingWorld: () => true,
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(MODELS.bloodline);
  _resetModSettings();
  return w;
}

test('LEGACY7 part five online, the realm\'s homes are the line\'s houses - learned with the save, the one played parked in the one saved in, the family home among them; a list not read learns nothing and drops nothing; a home sold leaves with the next save', () => {
  const w = online();
  const f = w.host.family;
  modSaveRecords();
  assert.deepEqual(f.houses, [], 'the realm\'s homes not read yet: nothing learned');
  w.held = [HOME, HALL];
  w.host.tick();
  assert.deepEqual(f.houses, [], 'never a tick - the save that holds them');
  w.here = { mapId: HOME.mapId, buildingKey: HOME.buildingKey };
  modSaveRecords();
  assert.deepEqual(f.houses.map((h) => [h.location, h.by]), [['Gothway Garden', f.currentId], ['Sentinel', f.currentId]]);
  assert.deepEqual(w.host.current().parked, { mapId: HOME.mapId, buildingKey: HOME.buildingKey }, 'saved in their own home: they stand in it while another is played');
  assert.equal(w.host.isFamilyHouse({ mapId: HOME.mapId, buildingKey: HOME.buildingKey }), true, 'its rooms hold the line');
  assert.ok(w.host.markHome({ mapId: HALL.mapId, buildingKey: HALL.buildingKey }));
  assert.equal(familyHome(f).location, 'Sentinel', 'the family home, marked on the House page');
  // the list unread again (a new page): nothing dropped
  w.held = null;
  modSaveRecords();
  assert.equal(f.houses.length, 2);
  // one sold: gone with the next save
  w.held = [HALL];
  modSaveRecords();
  assert.deepEqual(f.houses.map((h) => h.location), ['Sentinel']);
});

test('LEGACY7 part five the registry tells when a home of mine changed - a claim, a release - and a listener\'s fault is never the registry\'s', async () => {
  const told = [];
  const api = {
    town: async () => ({ ok: true, data: { homes: [] } }),
    claim: async () => ({ ok: true, data: { home: { entry: 'private' } } }),
    release: async () => ({ ok: true, data: {} }),
  };
  const homes = createOnlineHomes({ api, character: () => 'r0123456789abcdef0123', onWrote: (id, key) => told.push([id, key]) });
  assert.equal((await homes.claim({ mapId: HOME.mapId, buildingKey: HOME.buildingKey, region: 17, price: 1000 })).ok, true);
  assert.deepEqual(told, [[HOME.mapId, HOME.buildingKey]]);
  await homes.release(HOME.mapId, HOME.buildingKey);
  assert.equal(told.length, 2);
  const loud = createOnlineHomes({ api, character: () => 'r1', onWrote: () => { throw new Error('a listener\'s fault'); } });
  assert.equal((await loud.claim({ mapId: HALL.mapId, buildingKey: HALL.buildingKey, region: 20, price: 1000 })).ok, true, 'the claim stands');
});

test('LEGACY7 part five the world host reads this realm character\'s homes - named by their towns - at the boot and after each change of mine, and hands them to the house online; offline, the deeds as before', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /createOnlineHomes\(\{ api: homesApi, character: \(\) => characterIdOf\(playerEntity\), onWrote: \(\) => legacyOnlineHomesRead\(\) \}\)/);
  assert.match(w, /_legacyOnlineHomes = r\.data\.homes\.filter\(\(h\) => h\?\.character === me\)\.map\(\(h\) => \(\{/);
  assert.match(w, /location: \[\.\.\.livingTownsIndex\(\)\.values\(\)\]\.find\(\(t\) => \(t\.mapId >>> 0\) === \(h\.mapId >>> 0\)\)\?\.name \?\? '',/);
  assert.match(w, /heldHouses: \(\) => \(isOnlinePage\(\) \? \(realmSession \? _legacyOnlineHomes : null\) : \(playerEntity\.houses \?\? \[\]\)\.filter\(\(h\) => \(h\?\.buildingKey \| 0\) > 0 && deedStands\(h\)\)\),/);
  assert.match(w, /if \(legacyRealmLine\) legacyOnlineHomesRead\(\);/);
  assert.match(rd('src/scenes/legacyHost.js'), /const held = deps\.heldHouses\?\.\(\) \?\? null;\n\s*if \(held == null\) return false;\n\s*return syncHouses\(family, p\.id, held\);/);
});
