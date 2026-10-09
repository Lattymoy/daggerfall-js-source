// PERMADEATH-HOUSES (2026-10-09, the owner: "now all that needs to be looked at is what happens to houses owned by dead
// permadeath characters and I can go back to playing my family"; asked, he chose "Heir inherits"): A DEAD MEMBER'S
// HOUSE PASSES TO WHOEVER CARRIES THE LINE (bible/06-Systems/Legacy-Arc.md section 10c). Until it did, a fallen
// member's deed stayed in a save the line refuses to play: the family lived in the house, and the heir found its door
// locked at night, no bed of theirs and no cupboard - online a tombstone held the building out of the world for good.
// The law (systems/legacy/household.js deedsDue, syncHouses' `taken`) and the host (scenes/legacyHost.js takeDeeds)
// through the real save records; the scene handed on (systems/sceneCache.js graftPermanentScene); the account service's
// inheritance (server-account/src/homes.js inheritHome) through the real Worker on every migration; the world host's
// wiring and the House page's words by source and by their own functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost, mergeFamily, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { foundFamily, readFamily, addChild, personOf, familyRng, MODELS, recordDeath, LEGACY_MOD } from '../src/systems/legacy/family.js';
import { rekeyClashes, MEMBER_SAVE_FIELDS } from '../src/systems/legacy/store.js';
import { syncHouses, deedsDue, houseKeyOf, heldByDead, familyResId } from '../src/systems/legacy/household.js';
import { createSceneCache, cacheScene, snapshotSceneCache, graftPermanentScene, interiorSceneName, layoutSceneName, LOOT_CONTAINER_TYPES } from '../src/systems/sceneCache.js';
import { deedLine } from '../src/ui/familyPages.js';
import { modSaveRecords, restoreModSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { inheritHome } from '../server-account/src/homes.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const HOUSE_A = Object.freeze({ regionIndex: 17, mapId: 5001, buildingKey: 0x10203, location: 'Gothway Garden' });
const HOUSE_B = Object.freeze({ regionIndex: 20, mapId: 7002, buildingKey: 0x20304, location: 'Sentinel' });
const KEY_A = houseKeyOf(HOUSE_A);
const KEY_B = houseKeyOf(HOUSE_B);

function person(cid, name = 'Ysolde Hlaalu') {
  return {
    name, gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
  };
}

/** One world: the host over shared storage, the entity swappable (a load), the game's saves by character id, and the
 *  world's inheritance answered by `w.answer` (the world host's own is pinned by source below). */
function world({ model = MODELS.bloodline } = {}) {
  _resetModSaveData();
  _resetModSettings();
  const storage = mem(), tab = mem();
  const w = { said: [], held: [], here: null, saved: new Map(), asked: [], answer: () => 'given', storage, tab };
  w.e = person('c-ysolde');
  w.host = createLegacyHost({
    get entity() { return w.e; },
    storage: () => storage, tab: () => tab, on: () => true, online: () => false, now: () => 100, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, mapId: 5001, world: { x: 0, z: 0 } }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => 1000, say: (l) => w.said.push(l), boot: () => {}, search: () => '?world',
    loadCharacter: (cid) => w.saved.has(cid),
    saveNow: () => { w.saved.set(String(w.e.characterId), JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy))); return true; },
    hasSave: (cid) => w.saved.has(cid), inFight: () => false, rng: familyRng(7),
    heldHouses: () => w.held, houseHere: () => w.here, livingWorld: () => true,
    inheritHouse: (row, fallen) => { w.asked.push([houseKeyOf(row), row.by, fallen?.characterId ?? null]); return w.answer(row, fallen); },
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(model);
  _resetModSettings();
  w.save = () => { w.saved.set(String(w.e.characterId), JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy))); return w.saved.get(String(w.e.characterId)); };
  w.save();
  return w;
}
/** The born page: the boot's takeBorn, finishChargen's entity, onBorn. */
function bear(w, id, cid) {
  const b = w.host.takeBorn(id);
  w.e = person(cid, `${b.person.given} ${b.person.surname}`);
  w.host.onBorn();
  return b.person;
}
/** A load: the save's record restored with `entity` as the one in the slot. */
function load(w, rec, entity) { w.e = entity; restoreModSaveRecords({ ProjectLegacy: JSON.parse(JSON.stringify(rec)) }); }

// ---- the law -----------------------------------------------------------------------------------------------------------

/** A line of three: the founder (1, to fall), their child (the heir) and a living sibling - each a member of the blood. */
function line() {
  const f = foundFamily(person('c-1'), { rng: familyRng(1), seat: { region: 'Daggerfall', loc: 'Gothway Garden', mapId: 5001 } });
  const heir = addChild(f, 1, { rng: familyRng(2) }).person;
  const sib = addChild(f, 1, { rng: familyRng(3) }).person;
  return { f, heir, sib };
}

test('PERMADEATH-HOUSES: a house whose holder is dead is DUE to whoever carries the line - until their save took it; a living or retired holder\'s never is', () => {
  const { f, heir, sib } = line();
  f.houses = [{ ...HOUSE_A, by: 1 }, { ...HOUSE_B, by: sib.id }];
  assert.deepEqual(deedsDue(f, heir), [], 'the founder lives: nothing is due');
  recordDeath(f, 1, { at: 5, cause: 'fell' });
  assert.equal(heldByDead(f, f.houses[0]), true);
  assert.equal(heldByDead(f, f.houses[1]), false);
  assert.deepEqual(deedsDue(f, heir), [{ ...HOUSE_A, by: 1 }], 'the fallen\'s house, and only theirs');
  assert.notEqual(deedsDue(f, heir)[0], f.houses[0], 'a copy - the record\'s row is never handed out');
  assert.deepEqual(deedsDue(f, sib), [{ ...HOUSE_A, by: 1 }], 'whoever carries the line - a sibling too');
  heir.deedsTaken = [KEY_A];
  assert.deepEqual(deedsDue(f, heir), [], 'taken by their save: due no more');
  sib.retired = 9;
  assert.deepEqual(deedsDue(f, { ...heir, deedsTaken: [] }).map(houseKeyOf), [KEY_A], 'a retired elder keeps their house (Legacy-Arc 6): never due');
  assert.deepEqual(deedsDue(f, personOf(f, 1)), [], 'the dead carry nothing');
});

test('PERMADEATH-HOUSES: the save that holds a taken deed makes it the taker\'s, in its place, naming who left it; sold before that save, it goes; a save that never took it hands it back to the dead', () => {
  const { f, heir, sib } = line();
  f.houses = [{ ...HOUSE_A, by: 1 }, { ...HOUSE_B, by: sib.id }];
  recordDeath(f, 1, { at: 5, cause: 'fell' });
  // held but never taken (the heir bought the same building in their own world): the dead's row stands, never doubled
  assert.equal(syncHouses(f, heir.id, [HOUSE_A], []), false);
  assert.deepEqual(f.houses, [{ ...HOUSE_A, by: 1 }, { ...HOUSE_B, by: sib.id }]);
  // taken and held: theirs, in the row's own place (AUDIT LEGACY II A5), left by the fallen
  assert.equal(syncHouses(f, heir.id, [HOUSE_A], [KEY_A]), true);
  assert.deepEqual(f.houses, [{ ...HOUSE_A, by: heir.id, from: 1 }, { ...HOUSE_B, by: sib.id }]);
  assert.equal(syncHouses(f, heir.id, [HOUSE_A], [KEY_A]), false, 'unchanged');
  // a save that never took it (an older one loaded): back to the dead, theirs to take up again
  assert.equal(syncHouses(f, heir.id, [], []), true);
  assert.deepEqual(f.houses, [{ ...HOUSE_A, by: 1 }, { ...HOUSE_B, by: sib.id }]);
  assert.deepEqual(deedsDue(f, { ...heir, deedsTaken: [] }).map(houseKeyOf), [KEY_A]);
  // taken, then sold before the save: gone - never handed again
  assert.equal(syncHouses(f, heir.id, [], [KEY_A]), true);
  assert.deepEqual(f.houses, [{ ...HOUSE_B, by: sib.id }]);
  // and once theirs, sold with a save that took it: gone too
  f.houses = [{ ...HOUSE_A, by: heir.id, from: 1 }];
  assert.equal(syncHouses(f, heir.id, [], [KEY_A]), true);
  assert.deepEqual(f.houses, []);
  // a living sibling's row is never another's to take, whatever a save names
  f.houses = [{ ...HOUSE_B, by: sib.id }];
  assert.equal(syncHouses(f, heir.id, [HOUSE_B], [KEY_B]), false);
  assert.deepEqual(f.houses, [{ ...HOUSE_B, by: sib.id }]);
});

test('PERMADEATH-HOUSES: a row keeps the layout its deed names the building in, and who left it; a member\'s taken deeds are their save\'s - read to their shape, merged by the save that wrote them, moved with a clash', () => {
  const { f, heir } = line();
  assert.equal(syncHouses(f, heir.id, [{ ...HOUSE_A, layout: 'bt-1' }, { ...HOUSE_B, layout: '' }]), true);
  assert.deepEqual(f.houses, [{ ...HOUSE_A, layout: 'bt-1', by: heir.id }, { ...HOUSE_B, by: heir.id }], 'Daggerfall\'s own layout writes none');
  f.houses[1].from = 1;
  heir.deedsTaken = [KEY_B, KEY_B, 'junk', 7, '-5:9'];
  const back = readFamily(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(back.houses, [{ ...HOUSE_A, layout: 'bt-1', by: heir.id }, { ...HOUSE_B, by: heir.id, from: 1 }]);
  assert.deepEqual(personOf(back, heir.id).deedsTaken, [KEY_B, '-5:9'], 'house keys alone, once each');
  assert.deepEqual(personOf(back, 1).deedsTaken, [], 'a record written before it reads none');
  assert.ok(MEMBER_SAVE_FIELDS.includes('deedsTaken'), 'the copy that saved them last says what they took (store.js mergeFacts)');
  // the save's word, as the estate's is (mergeFamily): the store's copy newer, the save's taken deeds still the save's
  const stored = JSON.parse(JSON.stringify(back));
  stored.rev += 5;
  personOf(stored, heir.id).characterId = 'c-heir';
  personOf(stored, heir.id).deedsTaken = [KEY_A, KEY_B];
  const saved = JSON.parse(JSON.stringify(back));
  personOf(saved, heir.id).characterId = 'c-heir';
  personOf(saved, heir.id).deedsTaken = [KEY_B];
  assert.deepEqual(personOf(mergeFamily(readFamily(stored), readFamily(saved), 'c-heir'), heir.id).deedsTaken, [KEY_B]);
  // AUDIT LEGACY III A3/P3's clash: a person moved to an id of their own takes the houses they left with them
  const mine = readFamily(JSON.parse(JSON.stringify(back)));
  const other = readFamily(JSON.parse(JSON.stringify(back)));
  personOf(other, 1).born = 999;   // the other copy's 1 is someone else
  const moved = rekeyClashes(mine, other);
  assert.ok(moved.has(1));
  assert.equal(mine.houses[1].from, moved.get(1), 'who left it, moved with them');
});

// ---- the host: a fall, the heir, the deed -----------------------------------------------------------------------------

test('PERMADEATH-HOUSES: a Bloodline fall hands every house the fallen held - the live ones - to the newborn heir once they land, said, never twice; the save that holds them makes them the heir\'s', () => {
  const w = world();
  const f = w.host.family;
  w.held = [HOUSE_A];
  w.save();
  assert.deepEqual(f.houses, [{ ...HOUSE_A, by: 1 }]);
  w.held = [HOUSE_A, HOUSE_B];   // bought since the last save: the gold it cost left the estate with it
  assert.equal(w.host.deathOutcome().kind, 'fall');
  assert.deepEqual(f.houses.map((h) => [houseKeyOf(h), h.by]), [[KEY_A, 1], [KEY_B, 1]], 'the deeds they die holding, the line\'s');
  w.host.tick();
  assert.deepEqual(w.asked, [], 'the Succession waits: nobody takes up a deed');
  w.host.succeed({ newborn: true });
  w.held = [];
  const heir = bear(w, w.host.current().id, 'c-heir');
  const first = w.saved.get('c-heir');
  assert.deepEqual(w.asked, [], 'never at the birth - online the first save is held to a newborn\'s purse (realm.js firstSaveRefusal)');
  w.host.tick();
  assert.deepEqual(w.asked, [[KEY_A, 1, 'c-ysolde'], [KEY_B, 1, 'c-ysolde']], 'each, with the fallen whose save holds what they kept there');
  assert.deepEqual(heir.deedsTaken, [KEY_A, KEY_B]);
  assert.ok(w.said.includes(LEGACY_TEXT.deed('Gothway Garden', 'Ysolde')) && w.said.includes(LEGACY_TEXT.deed('Sentinel', 'Ysolde')), 'said');
  w.host.tick();
  assert.equal(w.asked.length, 2, 'never twice');
  // the world gave them: the next save holds them, and the rows are the heir's - left by the fallen
  w.held = [HOUSE_A, HOUSE_B];
  w.save();
  const g = w.host.family;   // the born page's record (takeBorn reads the store's)
  assert.deepEqual(g.houses.map((h) => [houseKeyOf(h), h.by, h.from]), [[KEY_A, heir.id, 1], [KEY_B, heir.id, 1]]);
  assert.equal(deedLine(g, g.houses[0]), `${heir.given} ${heir.surname}'s deed, left by Ysolde Hlaalu`, 'the House page names who left it');
  // A REWIND: the heir's first save - from before the deeds were taken - loaded: handed again, as an estate is paid again
  w.held = [];
  w.asked.length = 0;
  load(w, first, person('c-heir', `${heir.given} ${heir.surname}`));
  const again = w.host.current();
  assert.deepEqual(again.deedsTaken, [], 'the save\'s word');
  assert.deepEqual(w.host.family.houses.map((h) => [houseKeyOf(h), h.by]), [[KEY_A, 1], [KEY_B, 1]], 'the load gave them back to the dead');
  w.host.tick();
  assert.deepEqual(w.asked.map((a) => a[0]), [KEY_A, KEY_B], 'taken up again');
});

test('PERMADEATH-HOUSES: a house the one played cannot take yet WAITS - said once a page, taken up the tick the region is free; one the dead hold no more goes; one still asked is asked again', () => {
  const w = world();
  w.held = [HOUSE_A, HOUSE_B];
  w.save();
  w.host.deathOutcome();
  w.host.succeed({ newborn: true });
  w.held = [];
  const heir = bear(w, w.host.current().id, 'c-heir');
  const f = w.host.family;
  w.answer = (row) => (houseKeyOf(row) === KEY_A ? 'waits' : 'asking');
  w.said.length = 0;
  w.host.tick();
  w.host.tick();
  assert.deepEqual(w.said, [LEGACY_TEXT.deedWaits('Gothway Garden', 'Ysolde')], 'once a page');
  assert.deepEqual(heir.deedsTaken, []);
  assert.equal(w.asked.filter((a) => a[0] === KEY_B).length, 2, 'the service still asked: asked again');
  assert.equal(f.houses.length, 2, 'the family lives on in both meanwhile');
  assert.equal(deedLine(f, f.houses[0]), 'The late Ysolde Hlaalu\'s deed - it passes to whoever carries the line');
  w.answer = (row) => (houseKeyOf(row) === KEY_A ? 'given' : 'gone');
  w.host.tick();
  assert.deepEqual(heir.deedsTaken, [KEY_A], 'the region free: taken');
  assert.deepEqual(f.houses.map(houseKeyOf), [KEY_A], 'the one the dead held no more is no house of the line\'s');
});

test('PERMADEATH-HOUSES: one of the line killed in the street - a member parked in their own house - leaves it to the one played', () => {
  const w = world();
  const f = w.host.family;
  const sib = addChild(f, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0; sib.characterId = 'c-sib';
  f.houses = [{ ...HOUSE_B, by: sib.id }];
  sib.parked = { mapId: HOUSE_B.mapId, buildingKey: HOUSE_B.buildingKey };
  w.host.tick();
  assert.deepEqual(w.asked, [], 'they live: their house is theirs');
  assert.equal(w.host.kinKilled({ id: familyResId(f.id, sib.id), legacy: { familyId: f.id, personId: sib.id } }), true);
  w.host.tick();
  assert.deepEqual(w.asked, [[KEY_B, sib.id, 'c-sib']]);
  assert.deepEqual(w.host.current().deedsTaken, [KEY_B]);
});

test('PERMADEATH-HOUSES: an Enduring member who rises keeps their house; one who dies of their years leaves it, as a Bloodline\'s fall does', () => {
  const w = world({ model: MODELS.enduring });
  const f = w.host.family;
  w.held = [HOUSE_A];
  w.save();
  assert.equal(w.host.deathOutcome().kind, 'rise');
  assert.deepEqual(f.houses, [{ ...HOUSE_A, by: 1 }]);
  assert.deepEqual(deedsDue(f, personOf(f, 1)), []);
  personOf(f, 1).toll = 10_000;   // the span spent
  w.host.tick();
  assert.equal(w.host.deathOutcome().kind, 'fall');
  assert.equal(heldByDead(f, f.houses[0]), true, 'the line\'s to hand on');
});

// ---- the scene handed on ----------------------------------------------------------------------------------------------

test('PERMADEATH-HOUSES: the house as its owner left it - its scene and its other layouts\' visits out of the fallen\'s save, permanent, sans corpses; nothing else of theirs', () => {
  const theirs = createSceneCache();
  const name = interiorSceneName(HOUSE_A.mapId, HOUSE_A.buildingKey);
  const chest = { containerType: LOOT_CONTAINER_TYPES.HouseContainers, items: [{ name: 'Ebony Dagger' }] };
  const corpse = { containerType: LOOT_CONTAINER_TYPES.CorpseMarker, items: [{ name: 'Rat corpse' }] };
  cacheScene(theirs, name, { lootContainers: [chest, corpse], decorOwn: { p1: { name: 'Painting' } }, decorItems: { c1: [{ name: 'Gold ring' }] } });
  cacheScene(theirs, layoutSceneName(name, 'bt-1'), { lootContainers: [chest] });
  cacheScene(theirs, interiorSceneName(HOUSE_B.mapId, HOUSE_B.buildingKey), { lootContainers: [chest] });
  cacheScene(theirs, `${name}0`, { lootContainers: [chest] });   // a name that only begins with it is another building
  const snap = snapshotSceneCache(theirs);
  const mine = createSceneCache();
  assert.equal(graftPermanentScene(mine, snap, name), 2);
  assert.deepEqual([...mine.scenes.keys()], [name, layoutSceneName(name, 'bt-1')]);
  assert.deepEqual([...mine.permanent], [name, layoutSceneName(name, 'bt-1')], 'kept across the world\'s moves, as a bought house is');
  const got = mine.scenes.get(name);
  assert.deepEqual(got.lootContainers.map((c) => c.containerType), [LOOT_CONTAINER_TYPES.HouseContainers], 'a body left in the house is not handed on');
  assert.deepEqual(got.decorOwn, { p1: { name: 'Painting' } });
  assert.deepEqual(got.decorItems, { c1: [{ name: 'Gold ring' }] });
  got.decorItems.c1[0].name = 'x';
  assert.equal(snap.scenes[0].decorItems.c1[0].name, 'Gold ring', 'a copy - the fallen\'s save is never written');
  // a fallen member who never set foot in it: the house stands as Daggerfall furnished it, and is theirs all the same
  const bare = createSceneCache();
  assert.equal(graftPermanentScene(bare, null, name), 0);
  assert.deepEqual([...bare.permanent], [name]);
  assert.equal(bare.scenes.size, 0);
});

// ---- the account service ----------------------------------------------------------------------------------------------

test('PERMADEATH-HOUSES: online a fallen realm character\'s home is taken up by a LIVING realm character of its line, its pieces with it - never a living holder\'s, a retired elder\'s, another line\'s or a guild\'s; one answer however often asked', async () => {
  const S = await standService();
  const A = await S.registered('Ysolde');
  const raw = S.env.DB._raw;
  const home = { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey, region: HOUSE_A.regionIndex, price: 5000 };
  const claimed = await S.seatHome(A, home);
  assert.equal(claimed.status, 200, 'the founder\'s home');
  const dead = claimed.character;
  const heir = (await seatRealm(S.env, A.secret, 'Heir')).id;
  const stranger = (await seatRealm(S.env, A.secret, 'Stranger')).id;
  raw.prepare("UPDATE realm_characters SET lineage_id = 'L1', person_id = ? WHERE id = ?").run(1, dead);
  raw.prepare("UPDATE realm_characters SET lineage_id = 'L1', person_id = ? WHERE id = ?").run(2, heir);
  raw.prepare("UPDATE realm_characters SET lineage_id = 'L2', person_id = ? WHERE id = ?").run(1, stranger);
  raw.prepare("INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at) VALUES (?, ?, 'piece1', 41000, '{}', 1)").run(home.mapId, home.buildingKey);
  const ask = (body, who = A) => S.call('/v1/homes/inherit', { mapId: home.mapId, buildingKey: home.buildingKey, ...body }, who.secret);
  const owner = () => raw.prepare('SELECT char_id FROM homes WHERE map_id = ? AND building_key = ?').get(home.mapId, home.buildingKey)?.char_id;
  assert.deepEqual((await ask({ character: heir, from: dead })).body, { error: 'not-heir' }, 'the holder lives');
  raw.prepare("UPDATE realm_characters SET dead_at = 5, dead_why = 'retired' WHERE id = ?").run(dead);
  assert.equal((await ask({ character: heir, from: dead })).status, 403, 'a retired elder keeps their house');
  raw.prepare("UPDATE realm_characters SET dead_why = 'fell' WHERE id = ?").run(dead);
  assert.deepEqual((await ask({ character: stranger, from: dead })).body, { error: 'not-heir' }, 'another line\'s');
  assert.equal(owner(), dead);
  const r = await ask({ character: heir, from: dead });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.home.character, heir);
  assert.equal(r.body.repeat, undefined);
  assert.equal(owner(), heir, 'the heir\'s');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE map_id = ? AND building_key = ?').get(home.mapId, home.buildingKey).n, 1, 'its pieces stand where they stood');
  const again = await ask({ character: heir, from: dead });
  assert.equal(again.status, 200);
  assert.equal(again.body.repeat, true, 'asked again: the same answer');
  const mine = await S.call('/v1/homes/mine', {}, A.secret);
  assert.deepEqual(mine.body.homes.map((h) => h.character), [heir]);
  // the tombstone gate: a dead `character` asks nothing
  assert.equal((await ask({ character: dead, from: heir })).status, 410);
  assert.deepEqual((await ask({ character: heir, from: heir })).body, { error: 'realm-only' });
  assert.deepEqual((await S.call('/v1/homes/inherit', { mapId: 1, buildingKey: 2, character: heir, from: dead }, A.secret)).body, { error: 'no-home' }, 'the fallen hold no such house');
  // another account never reaches it
  const B = await S.registered('Brynn');
  assert.deepEqual((await ask({ character: heir, from: dead }, B)).body, { error: 'not-heir' });
  // a guild's hall is its guild's - its row's character is the guild, never a realm character's to leave
  raw.exec('PRAGMA foreign_keys = OFF');   // a hall's row by hand - its guild is no part of this law
  raw.prepare("UPDATE homes SET char_id = ?, guild_id = 7 WHERE map_id = ? AND building_key = ?").run(dead, home.mapId, home.buildingKey);
  raw.exec('PRAGMA foreign_keys = ON');
  assert.deepEqual(await inheritHome({ db: S.env.DB }, { id: A.id, handle: 'Ysolde' }, { mapId: home.mapId, buildingKey: home.buildingKey, character: heir, from: dead }), { error: 'no-home' });
  assert.equal(owner(), dead, 'the hall\'s row unmoved');
  assert.deepEqual(await inheritHome({ db: S.env.DB }, { id: A.id, handle: null }, { mapId: home.mapId, buildingKey: home.buildingKey, character: heir, from: dead }), { error: 'homes-need-account' });
  assert.deepEqual(await inheritHome({ db: S.env.DB }, { id: A.id, handle: 'Ysolde' }, { mapId: -1, buildingKey: home.buildingKey, character: heir, from: dead }), { error: 'bad-home' });
});

// ---- the wiring --------------------------------------------------------------------------------------------------------

test('PERMADEATH-HOUSES: the world host hands the house on - offline the bank\'s deed (one a region) and the fallen\'s own newest save\'s scene, online the service\'s home and the fallen\'s realm record\'s cupboards', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /inheritHouse: legacyInheritHouse,/);
  assert.match(w, /if \(\(slot\.buildingKey \| 0\) > 0\) return \(slot\.mapId >>> 0\) === \(row\.mapId >>> 0\) && \(slot\.buildingKey \| 0\) === \(row\.buildingKey \| 0\) \? 'given' : 'waits';/);
  assert.match(w, /graftPermanentScene\(playerEntity\.sceneCache \?\?= createSceneCache\(\), scenes\(\), interiorSceneName\(row\.mapId, row\.buildingKey \| 0\)\);/);
  assert.match(w, /return legacyInheritDeed\(row, \(\) => \(at >= 0 \? loadSlot\(at\)\?\.sceneCache \?\? null : null\)\);/);
  assert.match(w, /const r = await homesApi\.inherit\(\{ mapId: row\.mapId >>> 0, buildingKey: row\.buildingKey \| 0, character: me, from \}\);/);
  assert.match(w, /const rec = await realmFetch\(realmIoNow\(\), from\);/);
  assert.match(rd('src/net/accountClient.js'), /inherit: \(\{ mapId, buildingKey, character, from \}\) => post\('\/v1\/homes\/inherit', \{ mapId, buildingKey, character, from \}\),/);
  assert.match(rd('server-account/src/index.js'), /if \(path === '\/v1\/homes\/inherit'\) \{\n[^]*?const r = await inheritHome\(hctx, who\.player, body\);/);
});
