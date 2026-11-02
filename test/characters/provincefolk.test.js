// PROVINCE-FOLK (2026-10-28, bible/03-World/World-Wide.md PROVINCE-FOLK; the owner: "The world of tamriel needs to have
// their accurate races present within their respective regions"): each province past the Bay is lived in by its own
// people - its own race most of all, and the others the lore puts there. Pinned: the table and its shares, the place's
// lookups, the draw, the picture a race wears far off, the name bank; the street's walkers, the census's residents,
// the yards' and the ports' keepers and hands, the foes where they stand and the rosters, a person of their own drawn
// as themselves anywhere, Cyrodiil's standing people as Imperials; the Bay's every answer DFU's as before, and the
// hosts' wiring by source. AUDIT PROVINCE-FOLK (bible/01-Overview/audits/Audit-Province-Folk.md) C4-C13 tightened them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROVINCE_FOLK, folkOfTheatre, folkOfRegion, folkOfArea, folkRace, folkNameBank, setFolkPlace, folkHere, nativeHere } from '../../src/characters/provinceFolk.js';
import { THEATRE_KEYS, areaOfDistrict } from '../../src/world/worldWide/worldGrid.js';
import { provinceByKey } from '../../src/world/tamriel/tamrielGeography.js';
import { regionOfTheatre, CYRODIIL_REGION, REGION_RACES } from '../../src/formats/mapsTables.js';
import { RACE_KEYS, RACES } from '../../src/systems/races.js';
import { BANK_TYPES, GENDERS, fullName } from '../../src/characters/nameHelper.js';
import { getSeed, setSeed } from '../../src/formats/dfRandom.js';
import { PERSON_TEXTURES, PERSON_FACE_RECORDS, NUM_PERSON_FACE_VARIANTS, GUARD_TEXTURE, spriteRaceOf } from '../../src/characters/mobile/mobilePerson.js';
import { TownPopulation } from '../../src/systems/town/townPopulation.js';
import { folkActor, folkVariant } from '../../src/characters/folkBodies.js';
import { mintResident } from '../../src/systems/livingWorld/census.js';
import { personName, seededPersonName } from '../../src/characters/personNames.js';   // REGION-NAMES: PIN MOVED - a name off its own bank's draw, by its people's customs
import { townKeeper } from '../../src/systems/merchantYards.js';
import { raceOf, peopleOf } from '../../src/scenes/portHost.js';
import { foeLook, rosterLook, FOE_RACES } from '../../src/characters/foeBodies.js';
import { personLook, figureLook } from '../../src/characters/peopleBodies.js';
import { createEquipTable } from '../../src/characters/equipTable.js';
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../../src/formats/factionFile.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: a host's pin reads it whole
import { regularLook } from '../../src/world/card/cardRegulars.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MORROWIND = regionOfTheatre(THEATRE_KEYS.indexOf('Morrowind'));
const SKYRIM = regionOfTheatre(THEATRE_KEYS.indexOf('Skyrim'));
const share = (list, race) => list.filter((r) => r === race).length / list.length;
/** The world host's doors, for a player standing in `region` on no zone of its own (provinceFolk.js setFolkPlace). */
const standIn = (region) => setFolkPlace(() => ({ x: NaN, y: NaN }), () => region);

test('PROVINCE-FOLK the table: each of the nine provinces its own people, its own race first and the most of them, out of 100; every race one a Morrowind body stands - the whole table as the record prints it (mutants: a province\'s own race second; a share moved; two weights swapped; a race swapped)', () => {
  assert.deepEqual(Object.keys(PROVINCE_FOLK), THEATRE_KEYS.slice(1), 'one a province, in the theatres\' order');
  // AUDIT PROVINCE-FOLK C5: every row, as bible/03-World/World-Wide.md PROVINCE-FOLK's table prints it
  assert.deepEqual(Object.fromEntries(Object.entries(PROVINCE_FOLK).map(([k, f]) => [k, f.map(([r, w]) => `${r} ${w}`).join(', ')])), {
    HighRock: 'Breton 82, Redguard 5, Nord 4, Imperial 4, HighElf 3, WoodElf 2',
    Hammerfell: 'Redguard 82, Breton 6, Imperial 5, Khajiit 3, Nord 2, DarkElf 2',
    Skyrim: 'Nord 84, Imperial 5, Breton 4, DarkElf 4, Khajiit 2, Redguard 1',
    Morrowind: 'DarkElf 82, Imperial 6, Argonian 4, Nord 3, Breton 3, Khajiit 2',
    Sumurset: 'HighElf 92, WoodElf 4, Imperial 3, Breton 1',
    Valenwood: 'WoodElf 82, HighElf 6, Khajiit 5, Imperial 5, Breton 2',
    Elsweyr: 'Khajiit 84, WoodElf 6, Imperial 5, Argonian 3, Redguard 2',
    BlackMarsh: 'Argonian 84, Imperial 7, DarkElf 5, Khajiit 2, Breton 2',
    Imperial: 'Imperial 64, Breton 6, Nord 6, Redguard 6, DarkElf 4, WoodElf 4, Khajiit 4, HighElf 3, Argonian 3',
  });
  for (const [key, folk] of Object.entries(PROVINCE_FOLK)) {
    assert.equal(folk[0][0], provinceByKey(key)?.race ?? 'Imperial', `${key}: the province's own race (tamrielGeography.js)`);
    assert.equal(folk.reduce((n, [, w]) => n + w, 0), 100, key);
    assert.ok(folk.slice(1).every(([, w]) => w > 0 && w < folk[0][1]), `${key}: its own the most`);
    assert.equal(new Set(folk.map(([r]) => r)).size, folk.length, `${key}: a race once`);
    for (const [r] of folk) assert.ok(RACE_KEYS.includes(r) || r === 'Imperial', `${key}: ${r}`);
  }
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

test('PROVINCE-FOLK the draw: a seed one person, the shares the table\'s within half a point and every race drawn; a seed\'s person as it was minted; the name bank a person\'s own people\'s (mutants: the seed unmixed; the weights ignored; the last weight lost; the salt moved; the Imperial bank a Breton\'s)', () => {
  assert.equal(folkRace(null, 5), null);
  assert.equal(folkRace(PROVINCE_FOLK.Morrowind, 12345), folkRace(PROVINCE_FOLK.Morrowind, 12345), 'one seed, one person');
  for (const [key, folk] of Object.entries(PROVINCE_FOLK)) {
    const drawn = Array.from({ length: 20000 }, (_, i) => folkRace(folk, i));
    for (const [r, w] of folk) {
      assert.ok(Math.abs(share(drawn, r) - w / 100) < 0.006, `${key} ${r}: ${share(drawn, r)} against ${w / 100}`);   // AUDIT PROVINCE-FOLK C4: under one weight point
      assert.ok(drawn.includes(r), `${key}: ${r} drawn`);
    }
  }
  const neighbours = Array.from({ length: 64 }, (_, i) => folkRace(PROVINCE_FOLK.Imperial, i));
  assert.ok(new Set(neighbours).size >= 6, 'neighbouring seeds, other people');
  // AUDIT PROVINCE-FOLK C13: the draw as it shipped - a moved salt re-races everyone past the Bay
  assert.deepEqual([1, 2, 3, 12345, 99999].map((s) => folkRace(PROVINCE_FOLK.Imperial, s)), ['Imperial', 'Nord', 'Imperial', 'HighElf', 'DarkElf']);
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

test('PROVINCE-FOLK the street: past the Bay each walker one of the province\'s people - their body, their name\'s bank, their own picture and its face where Daggerfall draws it, a guard\'s too; on the Bay RandomiseNPC\'s own draws and the town\'s race (mutants: the Bay\'s stream drawn; the walker\'s race the town\'s; the name the region\'s bank; the picture the town\'s; the guard\'s face the town\'s)', () => {
  const r = counted(7);
  const pop = new TownPopulation(null, { totalBlocks: 16, race: 'Breton', folk: folkOfRegion(MORROWIND), rand: r.rand, makePerson: shell });
  const folk = [];
  let guards = 0;
  for (let i = 0; i < 1500; i++) {
    const p = shell(), saved = getSeed();
    pop._randomiseNPC(p);
    folk.push(p.folk);
    assert.ok(PROVINCE_FOLK.Morrowind.some(([race]) => race === p.folk), p.folk);
    const sprite = spriteRaceOf(p.folk, 'Breton');
    const sex = p.gender === GENDERS.Female ? 'female' : 'male';
    const v = p.guard ? 0 : PERSON_TEXTURES[sprite][sex].indexOf(p.archive);
    assert.ok(v >= 0, `${p.folk}: a ${sprite}'s picture`);
    const f = p.personFaceRecordId - PERSON_FACE_RECORDS[sprite][sex][v];
    assert.ok(f >= 0 && f < NUM_PERSON_FACE_VARIANTS, 'the face of that picture');   // AUDIT PROVINCE-FOLK C9: a guard's too
    if (p.guard && sprite === 'Nord') guards++;
    setSeed(saved);
    assert.equal(p.nameNPC, personName(folkNameBank(p.folk), p.gender, { race: p.folk }), `${p.folk}: named from their own people's bank`);
  }
  assert.ok(guards > 0, 'a Nord of Morrowind on the watch\'s arm, his face a Nord\'s');
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

test('PROVINCE-FOLK the census: a resident past the Bay one of the province\'s people, in their own picture where Daggerfall draws it - else the town\'s, a Nord town\'s a Nord\'s - the face of that picture; the census as it shipped; on the Bay the town\'s as before (mutants: the resident\'s race the town\'s; the picture the town\'s; the picture a Breton\'s; the salt moved)', () => {
  const area = areaOfDistrict(THEATRE_KEYS.indexOf('Morrowind'), 130, 80);
  for (const [people, climate] of [[3, 'Breton'], [0, 'Nord']]) {
    const town = { mapId: 8101 + people, px: NaN, py: NaN, type: 0, region: -1, area, people, blocks: 16 };
    const races = [];
    for (let slot = 0; slot < 300; slot++) {
      const res = mintResident(town, 'h', slot, 'townsperson');
      races.push(res.race);
      const sprite = spriteRaceOf(res.race, climate);   // AUDIT PROVINCE-FOLK C8: Ebonheart's people are the Nords' (0) - a Dark Elf there wears a Nord's picture
      const v = PERSON_TEXTURES[sprite][res.sex].indexOf(res.archive);
      assert.ok(v >= 0, `${res.race}: a ${sprite}'s picture`);
      assert.equal(res.variant, v);
      assert.ok(res.face - PERSON_FACE_RECORDS[sprite][res.sex][v] >= 0 && res.face - PERSON_FACE_RECORDS[sprite][res.sex][v] < NUM_PERSON_FACE_VARIANTS);
    }
    assert.ok(share(races, 'DarkElf') > 0.72, `Morrowind's own: ${share(races, 'DarkElf')}`);
    assert.ok(races.includes('Imperial') && races.includes('Nord'), 'its others');
    assert.ok(races.every((r) => PROVINCE_FOLK.Morrowind.some(([x]) => x === r)));
  }
  const abbr = { DarkElf: 'D', Imperial: 'I', Argonian: 'A', Nord: 'N', Breton: 'B', Khajiit: 'K' };
  const town = { mapId: 8101, px: NaN, py: NaN, type: 0, region: -1, area, people: 3, blocks: 16 };
  assert.equal(Array.from({ length: 40 }, (_, s) => abbr[mintResident(town, 'h', s, 'townsperson').race]).join(''), 'DDDDDDDDDDDDDDIDDIDDKNDIDDDIDDDDIDDDDDDD', 'the census as it shipped (AUDIT PROVINCE-FOLK C13)');
  const sentinel = { mapId: 8102, px: 300, py: 200, type: 0, region: 20, area: 20, people: 3, blocks: 9 };
  for (let slot = 0; slot < 20; slot++) assert.equal(mintResident(sentinel, 'h', slot, 'townsperson').race, 'Redguard', 'the Bay\'s Redguard region, REGIONAL-FOLK');
  assert.equal(mintResident({ ...sentinel, region: 17, area: 17, mapId: 8103 }, 'h', 0, 'townsperson').race, 'Breton');
});

test('PROVINCE-FOLK the yards and the ports: a keeper past the Bay one of the province\'s people, named from their own bank, as minted; a port\'s hands off its key, each their own; the Bay\'s keeper the record it was (mutants: the keeper\'s race unread; the keeper named by the region; the hand\'s region ignored; one hand a port)', () => {
  const races = [];
  for (let s = 0; s < 400; s++) {
    const k = townKeeper(s * 7919, MORROWIND);
    races.push(k.race);
    assert.ok(PROVINCE_FOLK.Morrowind.some(([r]) => r === k.race));
    assert.equal(k.name, seededPersonName(s * 7919, folkNameBank(k.race), k.gender, { race: k.race, region: MORROWIND, home: 'Morrowind' }), 'named from their own people\'s bank (AUDIT PROVINCE-FOLK C6)');
    assert.equal(k.home, 'Morrowind', 'and whose people they are');
  }
  assert.ok(share(races, 'DarkElf') > 0.72, `Morrowind's own: ${share(races, 'DarkElf')}`);
  const abbr = { DarkElf: 'D', Imperial: 'I', Argonian: 'A', Nord: 'N', Breton: 'B', Khajiit: 'K' };
  assert.equal(Array.from({ length: 40 }, (_, s) => abbr[townKeeper(s * 7919, MORROWIND).race]).join(''), 'DDDAKDDDDDDBDDDDDDDDDDDDDDIADDDDBDIDDDDI', 'the keepers as they shipped (AUDIT PROVINCE-FOLK C13)');
  assert.deepEqual(Object.keys(townKeeper(99, 17)), ['name', 'gender', 'sex', 'variant'], 'the Bay\'s keeper: no race beside the town\'s');
  const site = { key: '9:shipyard', kind: 'shipyard', regionIndex: SKYRIM, keeper: { race: 'Imperial' }, crewmaster: { race: 'Nord' } };
  assert.equal(raceOf(site, { role: 'keeper', i: 0 }), 'Imperial');
  assert.equal(raceOf(site, { role: 'crewmaster', i: 0 }), 'Nord');
  const hands = Array.from({ length: 200 }, (_, i) => raceOf({ ...site, key: `k${i}` }, { role: 'worker', i }));
  assert.ok(share(hands, 'Nord') > 0.7 && hands.every((r) => PROVINCE_FOLK.Skyrim.some(([x]) => x === r)), `Skyrim's hands: ${share(hands, 'Nord')}`);
  // AUDIT PROVINCE-FOLK C10: one port's own hands, as peopleOf stands them - over many ports, some port holds two peoples
  const mixed = Array.from({ length: 60 }, (_, n) => { const s = { ...site, key: `${n}:shipyard` }; return new Set(peopleOf(s).filter((p) => p.role === 'worker').map((p) => raceOf(s, p))).size; });
  assert.ok(peopleOf(site).filter((p) => p.role === 'worker').length > 1, 'a shipyard stands more than one worker');
  assert.ok(mixed.some((n) => n > 1), 'a port\'s hands are each their own - two of one trade two people');
  assert.equal(raceOf({ ...site, regionIndex: 17, keeper: {} }, { role: 'worker', i: 0 }), null, 'the Bay\'s: the town\'s race');
  assert.equal(raceOf({ key: 'x', regionIndex: 17 }, { role: 'keeper', i: 0 }), null);
});

const foe = (marker, extra = {}) => ({ mobileType: 130, marker, gender: 'male', entity: { isClass: true, race: undefined, equip: createEquipTable(), items: [] }, ai: { feet: [1, 2, 3], yaw: 0 }, ...extra });

test('PROVINCE-FOLK the foes: where the player stands past the Bay a foe and a roster\'s person are its people; on the Bay its mix as before; a person of their own drawn as themselves anywhere, a companion and a sworn revenant (mutants: the place unread; a companion the place\'s; a revenant\'s person unread)', () => {
  try {
    standIn(MORROWIND);
    assert.equal(folkHere(), PROVINCE_FOLK.Morrowind);
    const there = Array.from({ length: 400 }, (_, i) => foeLook(foe([i, 0, 3])).race);
    assert.ok(share(there, 'DarkElf') > 0.72, `Morrowind's bandits: ${share(there, 'DarkElf')}`);
    const crew = Array.from({ length: 300 }, (_, i) => rosterLook({}, { mobileType: 130, seed: i * 31 }).race);
    assert.ok(share(crew, 'DarkElf') > 0.72, `and its rosters: ${share(crew, 'DarkElf')}`);
    assert.equal(rosterLook({}, { mobileType: 130, seed: 5, race: 'Redguard' }).race, 'Redguard', 'a roster\'s own race kept');
    const own = Array.from({ length: 60 }, (_, i) => foeLook(foe([i, 0, 3], { person: 4000 + i })).race);
    const sworn = Array.from({ length: 60 }, (_, i) => foeLook(foe([i, 0, 3], { entity: { isClass: true, equip: createEquipTable(), items: [], revenant: { person: 5000 + i } } })).race);   // AUDIT PROVINCE-FOLK C12
    setFolkPlace(null, null);
    assert.equal(folkHere(), null);
    const bay = Array.from({ length: 400 }, (_, i) => foeLook(foe([i, 0, 3])).race);
    assert.ok(share(bay, 'DarkElf') < 0.15 && share(bay, 'Breton') > 0.2, `the Bay's mix (FOE_RACES): ${share(bay, 'Breton')}`);
    assert.ok(bay.every((r) => FOE_RACES.some(([x]) => x === r)));
    assert.deepEqual(Array.from({ length: 60 }, (_, i) => foeLook(foe([i, 0, 3], { person: 4000 + i })).race), own, 'a companion the same person in Morrowind and on the Bay (ALLY-RACE)');
    assert.deepEqual(Array.from({ length: 60 }, (_, i) => foeLook(foe([i, 0, 3], { entity: { isClass: true, equip: createEquipTable(), items: [], revenant: { person: 5000 + i } } })).race), sworn, 'and a sworn revenant by its record\'s person');
    standIn(17);
    assert.equal(folkHere(), null, 'a Bay region: none');
  } finally { setFolkPlace(null, null); }
});

const data = (o = {}) => ({ race: RACES.Breton, gender: GENDERS.Male, nameSeed: 77, hash: 5, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1, ...o });
const fac = (o) => ({ type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.None, race: -1, region: -1, ...o });
const FLATS = { getFlatData: () => ({ gender: '1', caption: 'old fisherman' }) };

test('PROVINCE-FOLK Cyrodiil\'s standing people: Bretons in the game\'s records (WW-R), Imperials in their body where the player stands in Cyrodiil - a named one keeps their record\'s; a placed figure the same; a tavern regular of the Imperial bank the province\'s own; elsewhere as before (mutants: the Imperial everywhere; the figure the region\'s; the regular a Breton)', () => {
  try {
    standIn(CYRODIIL_REGION);
    assert.equal(nativeHere(), 'Imperial');
    assert.equal(personLook({}, data(), fac({})).race, 'Imperial', 'a commoner of Cyrodiil');
    assert.equal(personLook({}, data(), fac({ type: FACTION_TYPES.People, race: 3, region: CYRODIIL_REGION })).race, 'Imperial', 'its People');
    assert.equal(personLook({}, data({ race: RACES.DarkElf }), fac({ race: 7 })).race, 'DarkElf', 'a Dark Elf of a Dark Elves\' faction there is one');
    assert.equal(personLook({}, data(), fac({ type: FACTION_TYPES.Individual, race: 3, region: 17 })).race, 'Breton', 'a named one keeps theirs - a Bay lord\'s own in a building past the Bay');
    // AUDIT PROVINCE-FOLK C11: a figure a player placed in a home of Cyrodiil is one of its people too
    assert.equal(figureLook({ piece: { id: 'f1', flat: [182, 3] } }, { flats: FLATS, race: REGION_RACES[CYRODIIL_REGION] + 1 }).race, 'Imperial');
    assert.equal(regularLook(9, BANK_TYPES.Imperial, 0).race, 'Imperial', 'a tavern regular named from the Imperial bank, in Cyrodiil');
    standIn(regionOfTheatre(THEATRE_KEYS.indexOf('BlackMarsh')));
    assert.equal(regularLook(9, BANK_TYPES.Imperial, 0).race, 'Argonian', 'and in Black Marsh, whose Argonians that bank names');
    assert.equal(regularLook(9, BANK_TYPES.DarkElf, 0).race, 'DarkElf', 'another bank its own race');
    standIn(SKYRIM);
    assert.equal(nativeHere(), 'Nord');
    assert.equal(personLook({}, data({ race: RACES.Breton }), fac({ race: 3 })).race, 'Breton', 'a Breton of a Bretons\' faction in Skyrim is one');
    setFolkPlace(null, null);
    assert.equal(nativeHere(), null);
    assert.equal(personLook({}, data(), fac({})).race, 'Breton', 'the Bay\'s');
    assert.equal(figureLook({ piece: { id: 'f2', flat: [182, 3] } }, { flats: FLATS, race: 3 }).race, 'Nord', 'the Bay\'s figure the region\'s');
    assert.equal(regularLook(9, BANK_TYPES.Imperial, 0).race, 'Breton', 'the Bay\'s regular as before');
  } finally { setFolkPlace(null, null); }
});

test('PROVINCE-FOLK THE HOSTS WIRED: the world host names the place, the street\'s pool its place\'s people; the walkers\' lane stands the walker\'s own, the census, the yards and the ports theirs - a port\'s people their bodies and pictures, a yard keeper his (mutants: the place unset; the pool\'s folk dropped; the port\'s body the town\'s; the port\'s picture the town\'s; the keeper\'s picture the town\'s)', () => {
  assert.match(hostText('src/scenes/world.js'), /\n {2}setFolkPlace\(\(feet\) => \(feet && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? worldCoordToMapPixel\(state\.worldCoords\(feet\)\.x, state\.worldCoords\(feet\)\.z\) : playerTravelPixel\(\)\), \(x, y\) => maps\.getRegionIndexAt\(x, y\)\);/);
  assert.match(hostText('src/scenes/world.js'), /\n {10}folk: folkOfLocation\(dfLocation\),/, 'the streets\' pools (pixelBuild.js, out of the host)');
  assert.match(rd('src/characters/folkBodies.js'), /const s = spawnOf\(person, person\.folk \?\? race\);/);
  assert.match(rd('src/scenes/merchantYardsHost.js'), /race = y\.site\.keeper\?\.race \?\? y\.site\.race \?\? 'Breton'/);
  assert.match(rd('src/scenes/merchantYardsHost.js'), /const T = PERSON_TEXTURES\[spriteRaceOf\(site\.keeper\?\.race, site\.race\)\] \?\? PERSON_TEXTURES\.Breton;/, 'AUDIT PROVINCE-FOLK C7');
  assert.match(rd('src/scenes/portHost.js'), /folk: raceOf\(site, p\)/);
  assert.match(rd('src/scenes/portHost.js'), /race = p\.folk \?\? pl\.site\.race \?\? 'Breton', key = /, 'AUDIT PROVINCE-FOLK C7');
  assert.match(rd('src/scenes/portHost.js'), /const T = PERSON_TEXTURES\[spriteRaceOf\(p\.folk, site\.race\)\] \?\? PERSON_TEXTURES\.Breton;/, 'AUDIT PROVINCE-FOLK C7');
  assert.doesNotMatch(hostText('src/scenes/exterior.js'), /setFolkPlace|folk: folkOf/, 'the fixed city\'s bench is the Bay\'s alone');
  assert.ok(GUARD_TEXTURE);
});
