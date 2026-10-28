// PROVINCE-FOLK (2026-10-28, bible/03-World/World-Wide.md PROVINCE-FOLK; the owner: "The world of tamriel needs to have
// their accurate races present within their respective regions"): each province past the Bay is lived in by its own
// people - its own race most of all, and the others the lore puts there. Pinned: the table and its shares, the place's
// lookups, the draw, the picture a race wears far off, the name bank; the street's walkers, the census's residents,
// the yards' and the ports' keepers and hands, the foes and the rosters where the player stands, a person of their own
// drawn as themselves anywhere, Cyrodiil's standing people as Imperials; the Bay's every answer DFU's as before, and
// the hosts' wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROVINCE_FOLK, folkOfTheatre, folkOfRegion, folkOfArea, folkRace, folkNameBank, setFolkPlace, folkHere, nativeHere } from '../../src/characters/provinceFolk.js';
import { THEATRE_KEYS, areaOfDistrict } from '../../src/world/worldWide/worldGrid.js';
import { provinceByKey } from '../../src/world/tamriel/tamrielGeography.js';
import { regionOfTheatre, CYRODIIL_REGION } from '../../src/formats/mapsTables.js';
import { RACE_KEYS, RACES } from '../../src/systems/races.js';
import { BANK_TYPES, GENDERS, fullName } from '../../src/characters/nameHelper.js';
import { getSeed, setSeed } from '../../src/formats/dfRandom.js';
import { PERSON_TEXTURES, PERSON_FACE_RECORDS, NUM_PERSON_FACE_VARIANTS, spriteRaceOf } from '../../src/characters/mobile/mobilePerson.js';
import { TownPopulation } from '../../src/systems/town/townPopulation.js';
import { folkActor, folkVariant } from '../../src/characters/folkBodies.js';
import { mintResident } from '../../src/systems/livingWorld/census.js';
import { townKeeper } from '../../src/systems/merchantYards.js';
import { raceOf } from '../../src/scenes/portHost.js';
import { foeLook, rosterLook, FOE_RACES } from '../../src/characters/foeBodies.js';
import { personLook, imperialHere } from '../../src/characters/peopleBodies.js';
import { createEquipTable } from '../../src/characters/equipTable.js';
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../../src/formats/factionFile.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: a host's pin reads it whole
import { regularLook } from '../../src/world/card/cardRegulars.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MORROWIND = regionOfTheatre(THEATRE_KEYS.indexOf('Morrowind'));
const SKYRIM = regionOfTheatre(THEATRE_KEYS.indexOf('Skyrim'));
const share = (list, race) => list.filter((r) => r === race).length / list.length;

test('PROVINCE-FOLK the table: each of the nine provinces its own people, its own race first and the most of them, out of 100; every race one a Morrowind body stands (mutants: a province\'s own race second; a share moved)', () => {
  assert.deepEqual(Object.keys(PROVINCE_FOLK), THEATRE_KEYS.slice(1), 'one a province, in the theatres\' order');
  assert.deepEqual(Object.entries(PROVINCE_FOLK).map(([k, f]) => [k, f[0][0], f[0][1]]), [
    ['HighRock', 'Breton', 82], ['Hammerfell', 'Redguard', 82], ['Skyrim', 'Nord', 84], ['Morrowind', 'DarkElf', 82],
    ['Sumurset', 'HighElf', 92], ['Valenwood', 'WoodElf', 82], ['Elsweyr', 'Khajiit', 84], ['BlackMarsh', 'Argonian', 84],
    ['Imperial', 'Imperial', 64],
  ]);
  for (const [key, folk] of Object.entries(PROVINCE_FOLK)) {
    assert.equal(folk[0][0], provinceByKey(key)?.race ?? 'Imperial', `${key}: the province's own race (tamrielGeography.js)`);
    assert.equal(folk.reduce((n, [, w]) => n + w, 0), 100, key);
    assert.ok(folk.slice(1).every(([, w]) => w > 0 && w < folk[0][1]), `${key}: its own the most`);
    assert.equal(new Set(folk.map(([r]) => r)).size, folk.length, `${key}: a race once`);
    for (const [r] of folk) assert.ok(RACE_KEYS.includes(r) || r === 'Imperial', `${key}: ${r}`);
  }
  assert.deepEqual(PROVINCE_FOLK.Skyrim.map(([r]) => r), ['Nord', 'Imperial', 'Breton', 'DarkElf', 'Khajiit', 'Redguard']);
  assert.deepEqual(PROVINCE_FOLK.Sumurset.map(([r, w]) => `${r} ${w}`), ['HighElf 92', 'WoodElf 4', 'Imperial 3', 'Breton 1']);
});

test('PROVINCE-FOLK where: a province\'s region and its districts its people; the Bay\'s regions and areas none, and none for no place (mutants: the Bay a province\'s; the region read as an area)', () => {
  for (let t = 1; t < THEATRE_KEYS.length; t++) {
    assert.equal(folkOfTheatre(t), PROVINCE_FOLK[THEATRE_KEYS[t]]);
    assert.equal(folkOfRegion(regionOfTheatre(t)), PROVINCE_FOLK[THEATRE_KEYS[t]], `region ${regionOfTheatre(t)}`);
    assert.equal(folkOfArea(areaOfDistrict(t, 90, 70)), PROVINCE_FOLK[THEATRE_KEYS[t]], `a district of ${THEATRE_KEYS[t]}`);
  }
  for (let r = 0; r < 62; r++) { assert.equal(folkOfRegion(r), null, `Bay region ${r}`); assert.equal(folkOfArea(r), null); }
  for (const none of [-1, 71, null, undefined, 1.5]) { assert.equal(folkOfRegion(/** @type {any} */ (none)), null); assert.equal(folkOfTheatre(/** @type {any} */ (none)), null); }
  assert.equal(folkOfTheatre(0), null, 'the Bay\'s theatre');
  assert.equal(folkOfRegion(CYRODIIL_REGION), PROVINCE_FOLK.Imperial);
});

test('PROVINCE-FOLK the draw: a seed one person, the shares the table\'s over many; the name bank a person\'s own people\'s (mutants: the seed unmixed; the weights ignored; the Imperial bank a Breton\'s)', () => {
  assert.equal(folkRace(null, 5), null);
  assert.equal(folkRace(PROVINCE_FOLK.Morrowind, 12345), folkRace(PROVINCE_FOLK.Morrowind, 12345), 'one seed, one person');
  for (const [key, folk] of Object.entries(PROVINCE_FOLK)) {
    const drawn = Array.from({ length: 20000 }, (_, i) => folkRace(folk, i));
    for (const [r, w] of folk) assert.ok(Math.abs(share(drawn, r) - w / 100) < 0.015, `${key} ${r}: ${share(drawn, r)} against ${w / 100}`);
  }
  const neighbours = Array.from({ length: 64 }, (_, i) => folkRace(PROVINCE_FOLK.Imperial, i));
  assert.ok(new Set(neighbours).size >= 6, 'neighbouring seeds, other people');
  assert.deepEqual(['Imperial', 'Argonian', 'Nord', 'DarkElf', 'Khajiit', 'Breton'].map(folkNameBank),
    [BANK_TYPES.Imperial, BANK_TYPES.Imperial, BANK_TYPES.Nord, BANK_TYPES.DarkElf, BANK_TYPES.Khajiit, BANK_TYPES.Breton]);
});

test('PROVINCE-FOLK the picture far off: a person\'s own race\'s where Daggerfall draws one, else the town\'s; a variant read off any race\'s picture (mutants: every race its own picture; the fallback dropped)', () => {
  assert.deepEqual(Object.keys(PERSON_TEXTURES), ['Redguard', 'Nord', 'Breton']);
  assert.deepEqual(['Nord', 'Redguard', 'Breton', 'DarkElf', 'Imperial', 'Khajiit', null, 'toString'].map((r) => spriteRaceOf(r, 'Breton')),
    ['Nord', 'Redguard', 'Breton', 'Breton', 'Breton', 'Breton', 'Breton', 'Breton']);
  assert.equal(spriteRaceOf('Argonian', 'Nord'), 'Nord');
  for (const race of Object.keys(PERSON_TEXTURES)) {
    PERSON_TEXTURES[race].male.forEach((a, v) => assert.equal(folkVariant(a, 'DarkElf'), v, `a Dark Elf in a ${race}'s picture`));
    PERSON_TEXTURES[race].female.forEach((a, v) => assert.equal(folkVariant(a, 'Imperial'), v));
  }
});

/** A walker shell as the pool rolls one (MobilePerson's setIdentity). */
const shell = () => ({ archive: 0, guard: false, setIdentity(a, g) { this.archive = a; this.guard = g; } });
/** A pool's rolls: each walker's draws counted. */
function counted(seed = 1) {
  let s = seed >>> 0, n = 0;
  const rand = () => { n++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { rand, calls: () => n };
}

test('PROVINCE-FOLK the street: past the Bay each walker one of the province\'s people - their body, their name\'s bank, their own picture where Daggerfall draws it; on the Bay RandomiseNPC\'s own draws and the town\'s race (mutants: the Bay\'s stream drawn; the walker\'s race the town\'s; the name the region\'s bank; the picture the town\'s)', () => {
  const r = counted(7);
  const pop = new TownPopulation(null, { totalBlocks: 16, race: 'Breton', folk: folkOfRegion(MORROWIND), rand: r.rand, makePerson: shell });
  const folk = [];
  for (let i = 0; i < 600; i++) {
    const p = shell(), saved = getSeed();
    pop._randomiseNPC(p);
    folk.push(p.folk);
    assert.ok(PROVINCE_FOLK.Morrowind.some(([race]) => race === p.folk), p.folk);
    const sprite = spriteRaceOf(p.folk, 'Breton');
    if (!p.guard) {
      const sex = p.gender === GENDERS.Female ? 'female' : 'male';
      const v = PERSON_TEXTURES[sprite][sex].indexOf(p.archive);
      assert.ok(v >= 0, `${p.folk}: a ${sprite}'s picture`);
      const f = p.personFaceRecordId - PERSON_FACE_RECORDS[sprite][sex][v];
      assert.ok(f >= 0 && f < NUM_PERSON_FACE_VARIANTS, 'the face of that picture');
    }
    setSeed(saved);
    assert.equal(p.nameNPC, fullName(folkNameBank(p.folk), p.gender), `${p.folk}: named from their own people's bank`);
  }
  assert.ok(share(folk, 'DarkElf') > 0.75 && share(folk, 'DarkElf') < 0.9, `Morrowind's own: ${share(folk, 'DarkElf')}`);
  assert.ok(folk.includes('Imperial') && folk.includes('Nord'), 'and its others');
  const bay = counted(7);
  const home = new TownPopulation(null, { totalBlocks: 16, race: 'Redguard', rand: bay.rand, makePerson: shell });
  for (let i = 0; i < 200; i++) {
    const p = shell(), before = bay.calls();
    home._randomiseNPC(p);
    assert.equal(p.folk, 'Redguard', 'the Bay\'s walker the town\'s race');
    assert.equal(bay.calls() - before, p.guard ? 2 : 4, 'RandomiseNPC\'s own draws: the guard, then the sex, the outfit and the face');
    if (!p.guard) assert.ok(PERSON_TEXTURES.Redguard.male.includes(p.archive) || PERSON_TEXTURES.Redguard.female.includes(p.archive));
  }
  const a = folkActor({ ...shell(), archive: PERSON_TEXTURES.Nord.male[2], gender: GENDERS.Male, folk: 'DarkElf', state: 'move', facingYaw: 0 }, [0, 0, 0], 'Nord');
  assert.equal(a.look.race, 'DarkElf', 'the body is the walker\'s own people\'s');
  assert.equal(folkActor({ ...shell(), archive: PERSON_TEXTURES.Nord.male[2], gender: GENDERS.Male, state: 'move', facingYaw: 0 }, [0, 0, 0], 'Nord').look.race, 'Nord', 'one with none, the town\'s');
});

test('PROVINCE-FOLK the census: a resident past the Bay one of the province\'s people, in their own picture where Daggerfall draws it, the face of that picture; on the Bay the town\'s as before (mutants: the resident\'s race the town\'s; the picture the town\'s)', () => {
  const area = areaOfDistrict(THEATRE_KEYS.indexOf('Morrowind'), 130, 80);
  const town = { mapId: 8101, px: 3400, py: 100, type: 0, region: -1, area, people: 3, blocks: 16 };
  const races = [];
  for (let slot = 0; slot < 300; slot++) {
    const res = mintResident(town, 'h', slot, 'townsperson');
    races.push(res.race);
    const sprite = spriteRaceOf(res.race, 'Breton');
    const v = PERSON_TEXTURES[sprite][res.sex].indexOf(res.archive);
    assert.ok(v >= 0, `${res.race}: a ${sprite}'s picture`);
    assert.equal(res.variant, v);
    assert.ok(res.face - PERSON_FACE_RECORDS[sprite][res.sex][v] >= 0 && res.face - PERSON_FACE_RECORDS[sprite][res.sex][v] < NUM_PERSON_FACE_VARIANTS);
  }
  assert.ok(share(races, 'DarkElf') > 0.72, `Morrowind's own: ${share(races, 'DarkElf')}`);
  assert.ok(races.includes('Imperial') && races.includes('Nord'), 'its others');
  assert.ok(races.filter((r) => r === 'Nord').length > 0 && races.every((r) => PROVINCE_FOLK.Morrowind.some(([x]) => x === r)));
  const sentinel = { mapId: 8102, px: 300, py: 200, type: 0, region: 20, area: 20, people: 3, blocks: 9 };
  for (let slot = 0; slot < 20; slot++) assert.equal(mintResident(sentinel, 'h', slot, 'townsperson').race, 'Redguard', 'the Bay\'s Redguard region, REGIONAL-FOLK');
  assert.equal(mintResident({ ...sentinel, region: 17, area: 17, mapId: 8103 }, 'h', 0, 'townsperson').race, 'Breton');
});

test('PROVINCE-FOLK the yards and the ports: a keeper past the Bay one of the province\'s people, named from their own bank; a hand off the place\'s key; the Bay\'s keeper the record it was (mutants: the keeper\'s race unread; the hand\'s region ignored)', () => {
  const races = [];
  for (let s = 0; s < 400; s++) {
    const k = townKeeper(s * 7919, MORROWIND);
    races.push(k.race);
    assert.ok(PROVINCE_FOLK.Morrowind.some(([r]) => r === k.race));
  }
  assert.ok(share(races, 'DarkElf') > 0.72, `Morrowind's own: ${share(races, 'DarkElf')}`);
  assert.deepEqual(Object.keys(townKeeper(99, 17)), ['name', 'gender', 'sex', 'variant'], 'the Bay\'s keeper: no race beside the town\'s');
  const site = { key: '9:shipyard', regionIndex: SKYRIM, keeper: { race: 'Imperial' }, crewmaster: { race: 'Nord' } };
  assert.equal(raceOf(site, { role: 'keeper', i: 0 }), 'Imperial');
  assert.equal(raceOf(site, { role: 'crewmaster', i: 0 }), 'Nord');
  const hands = Array.from({ length: 200 }, (_, i) => raceOf({ ...site, key: `k${i}` }, { role: 'worker', i }));
  assert.ok(share(hands, 'Nord') > 0.7 && hands.every((r) => PROVINCE_FOLK.Skyrim.some(([x]) => x === r)), `Skyrim's hands: ${share(hands, 'Nord')}`);
  assert.equal(raceOf({ ...site, regionIndex: 17 }, { role: 'worker', i: 0 }), null, 'the Bay\'s: the town\'s race');
  assert.equal(raceOf({ key: 'x', regionIndex: 17 }, { role: 'keeper', i: 0 }), null);
});

const foe = (marker, extra = {}) => ({ mobileType: 130, marker, gender: 'male', entity: { isClass: true, race: undefined, equip: createEquipTable(), items: [] }, ai: { feet: [1, 2, 3], yaw: 0 }, ...extra });

test('PROVINCE-FOLK the foes: where the player stands past the Bay a foe and a roster\'s person are its people; on the Bay its mix as before; a person of their own drawn as themselves anywhere (mutants: the place unread; a companion the place\'s)', () => {
  try {
    setFolkPlace(() => MORROWIND);
    assert.equal(folkHere(), PROVINCE_FOLK.Morrowind);
    const there = Array.from({ length: 400 }, (_, i) => foeLook(foe([i, 0, 3])).race);
    assert.ok(share(there, 'DarkElf') > 0.72, `Morrowind's bandits: ${share(there, 'DarkElf')}`);
    const crew = Array.from({ length: 300 }, (_, i) => rosterLook({}, { mobileType: 130, seed: i * 31 }).race);
    assert.ok(share(crew, 'DarkElf') > 0.72, `and its rosters: ${share(crew, 'DarkElf')}`);
    assert.equal(rosterLook({}, { mobileType: 130, seed: 5, race: 'Redguard' }).race, 'Redguard', 'a roster\'s own race kept');
    const own = Array.from({ length: 60 }, (_, i) => foeLook(foe([i, 0, 3], { person: 4000 + i })).race);
    setFolkPlace(null);
    assert.equal(folkHere(), null);
    const bay = Array.from({ length: 400 }, (_, i) => foeLook(foe([i, 0, 3])).race);
    assert.ok(share(bay, 'DarkElf') < 0.15 && share(bay, 'Breton') > 0.2, `the Bay's mix (FOE_RACES): ${share(bay, 'Breton')}`);
    assert.ok(bay.every((r) => FOE_RACES.some(([x]) => x === r)));
    assert.deepEqual(Array.from({ length: 60 }, (_, i) => foeLook(foe([i, 0, 3], { person: 4000 + i })).race), own, 'a companion the same person in Morrowind and on the Bay (ALLY-RACE)');
    setFolkPlace(() => 17);
    assert.equal(folkHere(), null, 'a Bay region: none');
  } finally { setFolkPlace(null); }
});

const data = (o = {}) => ({ race: RACES.Breton, gender: GENDERS.Male, nameSeed: 77, hash: 5, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1, ...o });
const fac = (o) => ({ type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.None, ...o });

test('PROVINCE-FOLK Cyrodiil\'s standing people: Bretons in the game\'s records (WW-R), Imperials in their body where the player stands in Cyrodiil - a named one and a quest\'s person keep their record\'s; a tavern regular of the Imperial bank the province\'s own; elsewhere as before (mutants: the Imperial everywhere; the quest\'s person lifted; the regular a Breton)', () => {
  try {
    setFolkPlace(() => CYRODIIL_REGION);
    assert.equal(nativeHere(), 'Imperial');
    assert.equal(personLook({}, data(), fac({})).race, 'Imperial', 'a commoner of Cyrodiil');
    assert.equal(personLook({}, data(), fac({ type: FACTION_TYPES.People })).race, 'Imperial', 'its People');
    assert.equal(personLook({}, data({ race: RACES.DarkElf }), fac({})).race, 'DarkElf', 'a Dark Elf there is one');
    assert.equal(personLook({}, data({ questPerson: true }), fac({})).race, 'Breton', 'a quest\'s person keeps the race its quest says');
    assert.equal(personLook({}, data(), fac({ type: FACTION_TYPES.Individual })).race, 'Breton', 'a named one keeps theirs');
    assert.equal(imperialHere('Breton'), 'Imperial');
    assert.equal(regularLook(9, BANK_TYPES.Imperial, 0).race, 'Imperial', 'a tavern regular named from the Imperial bank, in Cyrodiil');
    setFolkPlace(() => regionOfTheatre(THEATRE_KEYS.indexOf('BlackMarsh')));
    assert.equal(regularLook(9, BANK_TYPES.Imperial, 0).race, 'Argonian', 'and in Black Marsh, whose Argonians that bank names');
    assert.equal(regularLook(9, BANK_TYPES.DarkElf, 0).race, 'DarkElf', 'another bank its own race');
    setFolkPlace(() => SKYRIM);
    assert.equal(nativeHere(), 'Nord');
    assert.equal(personLook({}, data(), fac({})).race, 'Breton', 'a Breton in Skyrim is one');
    setFolkPlace(null);
    assert.equal(nativeHere(), null);
    assert.equal(personLook({}, data(), fac({})).race, 'Breton', 'the Bay\'s');
    assert.equal(imperialHere('Breton'), 'Breton');
    assert.equal(regularLook(9, BANK_TYPES.Imperial, 0).race, 'Breton', 'the Bay\'s regular as before');
  } finally { setFolkPlace(null); }
});

test('PROVINCE-FOLK THE HOSTS WIRED: the world host names the place, the street\'s pool its province\'s people; the walkers\' lane stands the walker\'s own, the census, the yards and the ports theirs (mutants: the place unset; the pool\'s folk dropped)', () => {
  assert.match(hostText('src/scenes/world.js'), /\n {2}setFolkPlace\(_questRegionIndex\);/);
  assert.match(hostText('src/scenes/world.js'), /\n {10}folk: folkOfRegion\(dfLocation\.regionIndex\),/, 'the streets\' pools (pixelBuild.js, out of the host)');
  assert.match(rd('src/characters/folkBodies.js'), /const s = spawnOf\(person, person\.folk \?\? race\);/);
  assert.match(rd('src/scenes/merchantYardsHost.js'), /race = y\.site\.keeper\?\.race \?\? y\.site\.race \?\? 'Breton'/);
  assert.match(rd('src/scenes/portHost.js'), /folk: raceOf\(site, p\)/);
  assert.doesNotMatch(hostText('src/scenes/exterior.js'), /setFolkPlace|folk: folkOf/, 'the fixed city\'s bench is the Bay\'s alone');
});
