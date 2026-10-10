// FIELD BUGS 2026-10-10 (bible/01-Overview/Field-Bugs-2026-10-10.md), REGIONAL-FOLK - the Discord's "Add Regional NPCs":
// DFU dresses a town's walkers by the climate's People and names them by the region (FALL.EXE's REGION_RACES), so
// Sentinel and the Dragontail Mountains walked Breton and Nord bodies under Redguard names. A Redguard region's walkers
// are Redguards now - on the street (both exterior hosts), in the living world's census, and in Roleplay & Realism's
// houses; every other region keeps DFU's climate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { walkerRace, raceOfPeople, redguardRegion, RACE_OF_PEOPLE, PERSON_TEXTURES, PERSON_FACE_RECORDS, GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { REGION_NAMES, REGION_RACES } from '../src/formats/mapsTables.js';
import { FACTION_RACES, CLIMATES } from '../src/formats/mapsFile.js';
import { mintResident } from '../src/systems/livingWorld/census.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { rrVariantPerson } from '../src/systems/rrVariants.js';
import { _resetFlatFaceOverrides } from '../src/characters/staticNpc.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const region = (name) => { const i = REGION_NAMES.indexOf(name); assert.ok(i >= 0, name); return i; };
const PEOPLES = [FACTION_RACES.Nord, FACTION_RACES.Redguard, FACTION_RACES.Breton, FACTION_RACES.Khajiit, undefined];

test('REGIONAL-FOLK: a walker wears the region\'s race where FALL.EXE calls it Redguard, the climate\'s everywhere else', () => {
  assert.equal(walkerRace(FACTION_RACES.Breton, region('Sentinel')), 'Redguard', 'Sentinel\'s temperate streets');
  assert.equal(walkerRace(FACTION_RACES.Nord, region('Dragontail Mountains')), 'Redguard', 'the Dragontails\' mountain towns');
  assert.equal(walkerRace(FACTION_RACES.Breton, region('Daggerfall')), 'Breton');
  assert.equal(walkerRace(FACTION_RACES.Nord, region('Wrothgarian Mountains')), 'Nord', 'High Rock\'s mountains keep DFU\'s Nords');
  assert.equal(walkerRace(FACTION_RACES.Redguard, region('Alik\'r Desert')), 'Redguard');
  assert.equal(walkerRace(FACTION_RACES.Nord, null), 'Nord', 'no region known: DFU\'s climate');
  assert.equal(walkerRace(FACTION_RACES.Nord, 999), 'Nord', 'a region past the table: DFU\'s climate');
  // the whole table, both ways: every region and every People
  const want = REGION_RACES.flatMap((r) => PEOPLES.map((p) => (r === 1 ? 'Redguard' : raceOfPeople(p))));
  assert.deepEqual(REGION_RACES.flatMap((_, i) => PEOPLES.map((p) => walkerRace(p, i))), want);
  assert.deepEqual(REGION_RACES.map((_, i) => redguardRegion(i)), REGION_RACES.map((r) => r === 1));
  assert.deepEqual(RACE_OF_PEOPLE, { 0: 'Nord', 2: 'Redguard', 3: 'Breton' }, 'DFU\'s climate table, FactionFile\'s numbering');
});

test('REGIONAL-FOLK: the living world\'s residents of a Redguard region wear Redguard bodies and faces; High Rock\'s keep the climate\'s', () => {
  const town = (name, people) => ({ mapId: 777, name: 'T', px: 10, py: 10, type: 0, region: region(name), people, blocks: 16, port: false });
  for (let slot = 0; slot < 12; slot++) {
    const r = mintResident(town('Sentinel', FACTION_RACES.Breton), 'h', slot, 'keeper');
    assert.equal(r.race, 'Redguard');
    assert.ok(PERSON_TEXTURES.Redguard[r.sex].includes(r.archive), 'a Redguard outfit');
    assert.ok(PERSON_FACE_RECORDS.Redguard[r.sex].some((f) => r.face >= f && r.face < f + 24), 'and a Redguard face');
    const b = mintResident(town('Daggerfall', FACTION_RACES.Breton), 'h', slot, 'keeper');
    assert.equal(b.race, 'Breton');
  }
  assert.equal(mintResident(town('Sentinel', FACTION_RACES.Breton), 'w', 0, 'guard').archive, GUARD_TEXTURE, 'the watch is the watch');
});

test('REGIONAL-FOLK: Roleplay & Realism\'s house residents follow the street - a Redguard region\'s are Redguards', () => {
  installRoleplayRealism();
  _resetModSettings(); _resetFlatFaceOverrides();
  for (const k of ['Enabled', 'variantResidents']) setModSetting('roleplay-realism', k, true);
  const resident = { textureArchive: 182, textureRecord: 10, factionID: 0 };
  const at = (r) => rrVariantPerson(resident, { buildingType: BUILDING_TYPES.House2, quality: 10, nameSeed: 5, worldClimate: CLIMATES.Woodlands, region: r });
  assert.deepEqual(at(region('Sentinel')), { textureArchive: PERSON_TEXTURES.Redguard.female[1], textureRecord: 5 });
  assert.deepEqual(at(region('Daggerfall')), { textureArchive: PERSON_TEXTURES.Breton.female[1], textureRecord: 5 }, 'R&R\'s own GetClimateRace elsewhere');
  assert.deepEqual(at(null), { textureArchive: PERSON_TEXTURES.Breton.female[1], textureRecord: 5 });
  _resetModSettings(); _resetFlatFaceOverrides();
});

test('REGIONAL-FOLK: every population asks the one rule - both street hosts, the census, the interior host\'s R&R swap; the table is written once', () => {
  assert.match(read('src/scenes/world.js'), /race: walkerRace\(climate\?\.people, dfLocation\.regionIndex\),/);
  assert.match(read('src/scenes/exterior.js'), /const populationRace = walkerRace\(dfLocation\.climate\?\.people, dfLocation\.regionIndex\);/);
  assert.match(read('src/systems/livingWorld/census.js'), /const race = walkerRace\(town\.people, town\.region\);/);
  assert.match(read('src/scenes/worldModes.js'), /region: hit\.dfLocation\?\.regionIndex \?\? null,/);
  const literal = /\{ 0: 'Nord', 2: 'Redguard', 3: 'Breton' \}/;
  const holders = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js') && literal.test(read(p))) holders.push(p);
    }
  };
  walk('src');
  assert.deepEqual(holders, ['src/characters/mobilePerson.js'], 'ONE DFU MEMBER, ONE EXPORT: the climate\'s table');
});
