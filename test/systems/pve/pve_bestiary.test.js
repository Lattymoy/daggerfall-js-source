// FIXED-PVE STAGE 5 (bible/05-Combat/Fixed-PvE.md section 7): where a species lives - by province, region, climate,
// dungeon type, faction and need - the same list for every player, and never a body the game cannot draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BESTIARY, BESTIARY_BY_SPECIES, DISTRIBUTION, PROVINCE_KEYS, ORSINIUM_REGION, distributionProblems, speciesStandingAt,
  regionalSpecies, regionalTemplates } from '../../../src/systems/pve/pveBestiary.js';
import { CANDIDATE_SPECIES } from '../../../src/systems/pve/pveSpecies.js';
import { MOB_TEMPLATES } from '../../../src/systems/pve/pveTemplates.js';
import { CLIMATES, REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';

const at = (species, place) => speciesStandingAt(BESTIARY_BY_SPECIES.get(species), place);
const holds = (place) => regionalSpecies(place).map((x) => x.species);

test('STAGE 5: every record stands, every template\'s species has one, and the nine provinces are the game\'s', () => {
  for (const r of BESTIARY) assert.deepEqual(distributionProblems(r), [], r.species);
  for (const t of MOB_TEMPLATES) assert.ok(BESTIARY_BY_SPECIES.has(t.species), t.species);
  assert.deepEqual(PROVINCE_KEYS, ['HighRock', 'Hammerfell', 'Skyrim', 'Morrowind', 'Imperial', 'BlackMarsh', 'Elsweyr', 'Valenwood', 'Sumurset']);
});

test('STAGE 5: the spec\'s orcs - Wrothgar first, a stronghold in High Rock and Skyrim, elsewhere only through a clan, and never where no clan is', () => {
  const clan = { factions: ['orc-clans'], climate: CLIMATES.Mountain };
  assert.equal(REGION_NAMES[ORSINIUM_REGION], 'Orsinium Area', 'FACTION.TXT counts regions from 1; the map from 0');
  assert.equal(at('orc', { province: 'HighRock', region: ORSINIUM_REGION, ...clan }), 'primary');
  assert.equal(at('orc', { province: 'HighRock', ...clan }), 'secondary');
  assert.equal(at('orc', { province: 'Skyrim', ...clan }), 'secondary');
  assert.equal(at('orc', { province: 'Morrowind', ...clan }), 'conditional');
  assert.equal(at('orc', { province: 'Sumurset', ...clan }), 'unavailable');
  assert.equal(at('orc', { province: 'HighRock', region: ORSINIUM_REGION, climate: CLIMATES.Mountain }), 'unavailable', 'no clan holds the place');
  assert.equal(at('orc', { province: 'Skyrim', dungeon: DUNGEON_TYPES.OrcStronghold, factions: ['orc-clans'] }), 'secondary');
});

test('STAGE 5: a dungeon holds its own dead and beasts; the wilds never hold a lich, a crypt never a bear', () => {
  const crypt = holds({ province: 'Imperial', dungeon: DUNGEON_TYPES.Crypt });
  for (const s of ['skeletal-warrior', 'zombie', 'lich', 'rat']) assert.ok(crypt.includes(s), s);
  assert.ok(!crypt.includes('grizzly-bear'));
  assert.ok(!holds({ province: 'Imperial', climate: CLIMATES.Woodlands }).includes('lich'));
  assert.ok(holds({ province: 'Hammerfell', dungeon: DUNGEON_TYPES.ScorpionNest }).includes('giant-scorpion'));
});

test('STAGE 5: a need is met or the species stays away - the werewolf by night, the Daedra in an incursion', () => {
  const woods = { province: 'HighRock', climate: CLIMATES.Woodlands };
  assert.equal(at('werewolf', woods), 'unavailable');
  assert.equal(at('werewolf', { ...woods, met: ['night'] }), 'secondary');
  const temple = { province: 'Imperial', dungeon: DUNGEON_TYPES.DesecratedTemple };
  assert.equal(at('daedroth', temple), 'unavailable');
  assert.equal(at('daedroth', { ...temple, met: ['incursion'] }), 'conditional');
});

test('STAGE 5: each province keeps a signature species of the spec\'s matrix, drawn from the bodies the game has', () => {
  assert.equal(at('harpy', { province: 'HighRock', climate: CLIMATES.Mountain }), 'primary');
  assert.equal(at('giant', { province: 'Skyrim', climate: CLIMATES.Mountain }), 'primary');
  assert.equal(at('giant-scorpion', { province: 'Hammerfell', climate: CLIMATES.Desert }), 'primary');
  assert.equal(at('lamia', { province: 'BlackMarsh', climate: CLIMATES.Ocean }), 'primary', 'REGIONAL-PVE: a water body stands in water');
  assert.equal(at('lamia', { province: 'BlackMarsh', climate: CLIMATES.Swamp }), 'unavailable', 'never on the swamp\'s land');
  assert.equal(at('spriggan', { province: 'Valenwood', climate: CLIMATES.Rainforest }), 'primary');
  assert.equal(at('giant-scorpion', { province: 'Skyrim', climate: CLIMATES.Desert }), 'unavailable', 'not by climate alone');
});

test('STAGE 5: a creature the spec names with no art never spawns, and the validator refuses a record that would make it', () => {
  for (const c of CANDIDATE_SPECIES) assert.equal(at(c.key, { province: 'Skyrim', climate: CLIMATES.Mountain }), 'unavailable', c.key);
  const draugr = { species: 'draugr', provinces: { Skyrim: 'primary' }, climates: [CLIMATES.Mountain], lore: 'established' };
  assert.deepEqual(distributionProblems(draugr), ['draugr has no art and cannot spawn']);
  assert.equal(speciesStandingAt(draugr, { province: 'Skyrim', climate: CLIMATES.Mountain }), 'unavailable', 'and a record that slips past spawns it nowhere');
  assert.deepEqual(distributionProblems({ species: 'harpy', provinces: { Elsweyr: 'primary' }, climates: [CLIMATES.Desert], lore: 'proposed' }), ['a proposed record may not be primary or secondary']);
  assert.deepEqual(distributionProblems({ species: 'harpy', provinces: { Elsweyr: 'conditional' }, climates: [CLIMATES.Desert], lore: 'inferred' }), ['a conditional record names no condition']);
  assert.deepEqual(distributionProblems({ species: 'harpy', provinces: { Atmora: 'secondary' }, climates: [CLIMATES.Desert], lore: 'inferred' }), ['unknown province Atmora']);
  assert.deepEqual(distributionProblems({ species: 'harpy', provinces: { [`*`]: 'exceptional' }, climates: [CLIMATES.Desert], lore: 'inferred' }), ['an exceptional record says no reason']);
});

test('STAGE 5: the list is the place\'s alone - no player in it, the same twice, by key, each at its standing\'s share', () => {
  assert.equal(regionalSpecies.length, 1);
  const place = { province: 'HighRock', region: ORSINIUM_REGION, climate: CLIMATES.Mountain, factions: ['orc-clans'] };
  const a = regionalSpecies(place), b = regionalSpecies(place);
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((x) => x.species), [...a.map((x) => x.species)].sort());
  for (const x of a) assert.equal(x.weight, DISTRIBUTION[x.standing]);
  const tpl = regionalTemplates(place).map((x) => x.template);
  for (const k of ['orc-grunt', 'orc-merchant', 'orc-shaman', 'orc-stronghold-guard', 'grizzly']) assert.ok(tpl.includes(k), k);
  assert.ok(!tpl.includes('crypt-lich'));
  const ancient = { province: 'HighRock', climate: null, dungeon: DUNGEON_TYPES.VampireHaunt };
  assert.ok(!regionalTemplates(ancient).some((x) => x.template === 'night-court-ancient'), 'RAID-AREAS: no area, no raid boss');
  assert.ok(regionalTemplates({ ...ancient, area: 'HighRock' }).some((x) => x.template === 'night-court-ancient'));
  assert.ok(!regionalTemplates({ ...ancient, area: 'Skyrim' }).some((x) => x.template === 'night-court-ancient'));
});
