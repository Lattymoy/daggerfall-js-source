// REGION-NAMES (2026-10-29, bible/04-Characters/Region-Names.md; the owner: "Introduce new dynamic namegen for each
// region to be hugely diverse and lore accurate"): a person's name by their people's customs and their region's.
// Pinned: one seed one name; each culture's own shapes; the region's families and fashions; the Bay keeping DFU's own
// draw as one custom and the provinces seldom; the Reach's Bretons as Reachmen; the seams; DFRandom left where DFU's
// FullName leaves it, and a key name of its bank alone; the game's doors wired by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  regionName, regionFamilies, cultureOfRace, cultureOfBank, cultureAt, provinceOfHome, nameHash, mixSeed,
  NAME_CULTURES, BAY_REGIONS, REGION_FAMILIES, REGION_FAMILY_SHARE,
} from '../../src/characters/regionNames.js';
import { personName, seededPersonName, randomPersonName } from '../../src/characters/personNames.js';
import { fullName, BANK_TYPES, GENDERS } from '../../src/characters/nameHelper.js';
import { srand, getSeed } from '../../src/formats/dfRandom.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SKYRIM = 65, MORROWIND = 66;
/** `n` people of a culture: their names, seeds 1.. on, the genders alternating. */
const names = (culture, n, o = {}) => Array.from({ length: n }, (_, i) => regionName({ culture, gender: i & 1, seed: i * 7919 + 1, classic: 'Classic Name', ...o }));
const share = (list, pred) => list.filter(pred).length / list.length;
const male = (list) => list.filter((_, i) => !(i & 1));
const female = (list) => list.filter((_, i) => i & 1);

test('REGION-NAMES one seed one name: the same culture, gender, seed, region and home name the same person on every call; another seed, another name (mutants: the stream unseeded)', () => {
  const o = { culture: 'nord', gender: GENDERS.Female, seed: 4242, region: SKYRIM, home: 'Skyrim', classic: 'Classic Name' };
  assert.equal(regionName(o), regionName({ ...o }));
  const many = new Set(Array.from({ length: 50 }, (_, i) => regionName({ ...o, seed: i + 1 })));
  assert.ok(many.size >= 45, `fifty seeds, ${many.size} names`);
});

test('REGION-NAMES hugely diverse: two thousand of each people are at least 1,400 names, none empty, each capitalized, no letter three times and no doubled space (mutants: a culture\'s parts cut to one)', () => {
  const homes = { breton: 'HighRock', redguard: 'Hammerfell', nord: 'Skyrim', dunmer: 'Morrowind', altmer: 'Sumurset', bosmer: 'Valenwood', khajiit: 'Elsweyr', argonian: 'BlackMarsh', imperial: 'Imperial', orc: null, reach: 'skyrimReach' };
  assert.deepEqual([...NAME_CULTURES].sort(), Object.keys(homes).sort(), 'eleven peoples, each of its own customs');
  for (const c of NAME_CULTURES) {
    const list = names(c, 2000, { region: 63 + (nameHash(c) % 5), home: homes[c] });
    const distinct = new Set(list).size;
    assert.ok(distinct >= 1400, `${c}: ${distinct} of 2000`);
    for (const n of list) {
      assert.ok(n.length >= 3 && /^[A-Z]/.test(n), `${c}: "${n}"`);
      assert.ok(!/(.)\1\1/i.test(n) && !/ {2}/.test(n), `${c}: "${n}"`);
    }
  }
});

test('REGION-NAMES the Orcs: every one gro- (a son) or gra- (a daughter) of a forebear, one given name before it (UESP Lore:Orc Names) (mutants: gro and gra swapped)', () => {
  const list = names('orc', 400, { region: 67 });
  assert.ok(male(list).every((n) => /^[A-Z][a-z]+ gro-[A-Z][a-z]+$/.test(n)), male(list).find((n) => !/ gro-/.test(n)));
  assert.ok(female(list).every((n) => /^[A-Z][a-z]+ gra-[A-Z][a-z]+$/.test(n)), female(list).find((n) => !/ gra-/.test(n)));
});

test('REGION-NAMES the Nords of Skyrim: a clan\'s two words (Battle-Born), a father\'s name and -sen, -son or -sdottir, an epithet ("the Bold") - each a share; a daughter never a -son (mutants: the clan\'s share, the patronym\'s ends, the epithet)', () => {
  const list = names('nord', 1500, { region: SKYRIM, home: 'Skyrim' });
  const clan = share(list, (n) => / [A-Z][a-z]+-[A-Z][a-z]+$/.test(n));
  const patronym = share(list, (n) => /^[A-Z][a-z]+ [A-Z][a-z]+(sen|son|sdottir)$/.test(n));
  const epithet = share(list, (n) => / the [A-Z][a-z]+$/.test(n));
  assert.ok(clan > 0.25 && clan < 0.6, `clans ${clan}`);
  assert.ok(patronym > 0.1 && patronym < 0.45, `patronyms ${patronym}`);
  assert.ok(epithet > 0.04 && epithet < 0.3, `epithets ${epithet}`);
  assert.ok(!female(list).some((n) => /son$/.test(n)), 'a daughter is -sdottir or -sen');
  assert.ok(male(list).every((n) => !/sdottir$/.test(n)));
});

test('REGION-NAMES the Dunmer: a family name most of all; the old style, the house before the person (Hlaalu Helseth, Indoril Nerevar), rare and of three houses only; the Ashlanders\' one name in Morrowind alone (mutants: the house after the person, Redoran a house, the Ashlanders abroad)', () => {
  const home = names('dunmer', 3000, { region: MORROWIND, home: 'Morrowind' });
  const houseFirst = home.filter((n) => /^(Hlaalu|Indoril|Dres) /.test(n));
  assert.ok(houseFirst.length > 0 && houseFirst.length / home.length < 0.08, `house first ${houseFirst.length}`);
  assert.ok(!home.some((n) => / (Hlaalu|Indoril|Dres|Redoran|Telvanni)$/.test(n) || /^(Redoran|Telvanni) /.test(n)), 'never after the person, never Redoran or Telvanni');
  const single = (n) => !n.includes(' ');
  assert.ok(share(home, single) > 0.04, `Ashlanders at home ${share(home, single)}`);
  const abroad = names('dunmer', 1500, { region: SKYRIM, home: 'Skyrim', classic: '' });
  assert.equal(abroad.filter(single).length, 0, 'an Ashlander is of Morrowind');
});

test('REGION-NAMES the Redguards: at- a direct forebear (Hosni at-Tura), al- the place of Hammerfell one comes from, never ra- (Lawrence Schick, UESP General:ZOS_Correspondence) (mutants: at- spelt ra-, al- before a family)', () => {
  const list = names('redguard', 2000, { region: 63, home: 'Hammerfell' });
  assert.ok(share(list, (n) => / at-[A-Z][a-z']+$/.test(n)) > 0.05, 'at-');
  const al = list.filter((n) => / al-/.test(n));
  assert.ok(al.length > 40, `al- ${al.length}`);
  const places = new Set(['Sentinel', 'Rihad', 'Taneth', 'Gilane', 'Elinhir', 'Skaven', 'Dragonstar', 'Hegathe', 'Bergama', 'Kozanset', 'Satakalaam', 'Lainlyn', 'Totambu', 'Ayasofya', 'Myrkwasa']);
  assert.ok(al.every((n) => places.has(n.split(' al-')[1])), al.find((n) => !places.has(n.split(' al-')[1])));
  assert.ok(!list.some((n) => / ra-/.test(n)));
});

test('REGION-NAMES the Khajiit, the Argonians, the Altmer: an honorific before the apostrophe (Ri\'saad, J\'zargo); a Jel name or its gloss (Hides-In-Mud); a family or "of" a city of the Isles (mutants: the titled share, the gloss\'s dashes, the cities)', () => {
  const k = names('khajiit', 1500, { region: 68, home: 'Elsweyr' });
  assert.ok(share(k, (n) => /^[A-Z][a-z]*'[a-z]+$/.test(n)) > 0.3, 'titled');
  const a = names('argonian', 1500, { region: 69, home: 'BlackMarsh' });
  const gloss = a.filter((n) => /^[A-Z][a-z]+-[A-Z][a-z]+-[A-Z][a-z]+$/.test(n));
  assert.ok(gloss.length / a.length > 0.2, `glosses ${gloss.length}`);
  assert.ok(gloss.some((n) => /-(His|Her)-/.test(n)));
  const al = names('altmer', 1500, { region: 70, home: 'Sumurset' });
  const of = al.filter((n) => / of /.test(n)).map((n) => n.split(' of ')[1]);
  assert.ok(of.length > 30 && of.every((c) => ['Alinor', 'Lillandril', 'Cloudrest', 'Skywatch', 'Shimmerene', 'Firsthold', 'Sunhold', 'Dusk', 'Rellenthil', 'Errinorne'].includes(c)), of.find((c) => !c));
});

test('REGION-NAMES each region its own families, REGION_FAMILIES of them, the same for every reader; about REGION_FAMILY_SHARE of its people of one (mutants: the region left out of the families\' seed, the share)', () => {
  const sky = regionFamilies('nord', SKYRIM), other = regionFamilies('nord', 71);
  assert.equal(sky.length, REGION_FAMILIES);
  assert.deepEqual(regionFamilies('nord', SKYRIM), sky);
  assert.ok(sky.filter((f) => other.includes(f)).length < REGION_FAMILIES / 2, 'two regions, their own families');
  const list = names('nord', 3000, { region: SKYRIM, home: 'Skyrim' });
  const clans = list.filter((n) => / [A-Z][a-z]+-[A-Z][a-z]+$/.test(n)).map((n) => n.split(' ').pop());
  const kept = share(clans, (f) => sky.includes(f));
  assert.equal(REGION_FAMILY_SHARE, 0.45);
  assert.ok(Math.abs(kept - 0.45) < 0.1, `of the region's families ${kept.toFixed(2)}`);
});

test('REGION-NAMES a region\'s fashion: a third of its sounds favoured three to one - two crowds of one region favour the same, two regions do not (mutants: the fashion unseeded by region)', () => {
  /** The twelve openings an Orc region's men are most given, of 4,000 of them from `from` on. */
  const favoured = (region, from) => {
    const counts = new Map();
    for (let i = 0; i < 4000; i++) {
      const g = regionName({ culture: 'orc', gender: GENDERS.Male, seed: from + i, region }).slice(0, 3);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([g]) => g);
  };
  const a = favoured(70, 1), again = favoured(70, 50001), b = favoured(140, 1);
  const shared = (x, y) => x.filter((g) => y.includes(g)).length;
  assert.ok(shared(a, again) >= 9, `one region, two crowds: ${shared(a, again)} of 12`);
  assert.ok(shared(a, b) <= 8, `two regions: ${shared(a, b)} of 12`);
});

test('REGION-NAMES the Bay keeps Daggerfall\'s own draw as one custom of its peoples, the provinces seldom; with no Daggerfall name it is never chosen (mutants: the Bay\'s weight, BAY_REGIONS, the classic unguarded)', () => {
  const bay = names('breton', 2000, { region: 17 });
  const far = names('breton', 2000, { region: 64, home: 'HighRock' });
  const keyed = names('breton', 2000);
  assert.ok(share(bay, (n) => n === 'Classic Name') > 0.15, `the Bay ${share(bay, (n) => n === 'Classic Name')}`);
  assert.ok(share(far, (n) => n === 'Classic Name') < 0.12, `High Rock ${share(far, (n) => n === 'Classic Name')}`);
  assert.ok(share(keyed, (n) => n === 'Classic Name') > 0.15, 'a key name (no region, no home) is the Bay\'s');
  assert.equal(names('breton', 500, { region: 17, classic: '' }).filter((n) => n === '').length, 0);
  assert.equal(BAY_REGIONS, 62);
  assert.ok(share(names('nord', 2000, { region: BAY_REGIONS - 1 }), (n) => n === 'Classic Name') > 0.15);
  assert.ok(share(names('nord', 2000, { region: BAY_REGIONS, home: 'Skyrim' }), (n) => n === 'Classic Name') < 0.12);
});

test('REGION-NAMES the Reach: a Breton of the Reach a Reachman most of the time (UESP Lore:Reachmen), one name, an epithet or a clan; elsewhere a Breton (mutants: the Reach\'s share)', () => {
  const at = Array.from({ length: 2000 }, (_, i) => cultureAt('breton', 'skyrimReach', i + 1));
  const reach = share(at, (c) => c === 'reach');
  assert.ok(reach > 0.62 && reach < 0.78, `${reach}`);
  assert.equal(cultureAt('breton', 'Skyrim', 9), 'breton');
  assert.equal(cultureAt('nord', 'skyrimReach', 9), 'nord');
  const list = names('reach', 600, { region: SKYRIM, home: 'skyrimReach' });
  assert.ok(!list.includes('Classic Name'), 'the Reachmen keep no Daggerfall draw');
  assert.equal(provinceOfHome('skyrimReach'), 'Skyrim');
  assert.equal(provinceOfHome('cyrodiilBlackwood'), 'Imperial');
  assert.equal(provinceOfHome('Morrowind'), 'Morrowind');
  assert.equal(provinceOfHome(null), null);
});

test('REGION-NAMES the seams: two consonant sounds met by a consonant are drawn again (no Astrdra, no Ogrga); a letter met at a seam before a consonant, or a vowel met there, once (mutants: the cluster rule, the vowel seam)', () => {
  const nords = names('nord', 3000, { region: SKYRIM, home: 'Skyrim', classic: '' }).map((n) => n.split(' ')[0]);
  assert.ok(!nords.some((n) => /^(Astr|Ingr|Sigr|Ulf|Bjorn|Hrong)[bcdfgjklmnpqrstvwxz]/.test(n)), nords.find((n) => /^(Astr|Ingr|Sigr|Ulf|Bjorn|Hrong)[bcdfgjklmnpqrstvwxz]/.test(n)));
  const orcs = names('orc', 3000).map((n) => n.split(' ')[0]);
  assert.ok(!orcs.some((n) => /^(Ogr|Mazg|Sharn|Lurb|Borg|Ugr)[bcdfgjklmnpqrstvwxz]/.test(n)), orcs.find((n) => /^(Ogr|Mazg|Sharn|Lurb|Borg|Ugr)[bcdfgjklmnpqrstvwxz]/.test(n)));
  const bosmer = names('bosmer', 3000, { region: 67, home: 'Valenwood' });
  assert.ok(!bosmer.some((n) => /ii/.test(n)), bosmer.find((n) => /ii/.test(n)));
});

test('REGION-NAMES the cultures of the game\'s keys: a race its people, a DFU bank its own (the Imperial bank 7), any other Breton (mutants: a race moved, a bank moved)', () => {
  assert.deepEqual(['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf', 'WoodElf', 'Khajiit', 'Argonian', 'Imperial', 'Orc', 'Reachman'].map(cultureOfRace),
    ['breton', 'redguard', 'nord', 'dunmer', 'altmer', 'bosmer', 'khajiit', 'argonian', 'imperial', 'orc', 'reach']);
  assert.equal(cultureOfRace('Vampire'), null);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 99].map(cultureOfBank), ['breton', 'redguard', 'nord', 'dunmer', 'altmer', 'bosmer', 'khajiit', 'imperial', 'breton', 'breton']);
  assert.equal(BANK_TYPES.Imperial, 7);
  assert.notEqual(mixSeed(1, 2), mixSeed(2, 1));
});

test('REGION-NAMES DFRandom stands where DFU\'s FullName leaves it: personName draws FullName first and reads no more of the stream; seededPersonName puts the stream back; randomPersonName draws the gender\'s coin first (mutants: a second draw, the seed not put back)', () => {
  for (const bank of [0, 2, 3, 6, 7]) {
    srand(1234 + bank); fullName(bank, GENDERS.Male); const want = getSeed();
    srand(1234 + bank); personName(bank, GENDERS.Male, { region: SKYRIM, home: 'Skyrim', race: 'Nord' });
    assert.equal(getSeed(), want, `bank ${bank}`);
  }
  srand(99); const before = getSeed();
  const a = seededPersonName(555, BANK_TYPES.Nord, GENDERS.Female, { region: SKYRIM, home: 'Skyrim' });
  assert.equal(getSeed(), before, 'the stream put back');
  assert.equal(seededPersonName(555, BANK_TYPES.Nord, GENDERS.Female, { region: SKYRIM, home: 'Skyrim' }), a, 'one seed, one person');
  srand(77); const r1 = randomPersonName(BANK_TYPES.Redguard);
  srand(77); assert.equal(randomPersonName(BANK_TYPES.Redguard), r1);
});

test('REGION-NAMES a key name is its bank\'s alone: two readers of one DFRandom state name one person whatever else they know (TalkManager.cs:3159 compares them); a race names by its own people, not its bank (mutants: the race unread)', () => {
  srand(31337); const npc = personName(BANK_TYPES.Breton, GENDERS.Female);
  srand(31337); const quest = personName(BANK_TYPES.Breton, GENDERS.Female, {});
  assert.equal(quest, npc);
  const orcs = Array.from({ length: 40 }, (_, i) => { srand(i + 1); return personName(BANK_TYPES.Breton, GENDERS.Male, { race: 'Orc' }); });
  assert.ok(orcs.every((n) => / gro-/.test(n)), 'an Orc of the Breton bank is named an Orc');
});

test('REGION-NAMES the game\'s doors wired by source: the census, the street, a standing NPC, a quest Person, the foes, the crews, the ports\' keepers and the macros name through personNames.js; the key doors without a region', () => {
  const doors = {
    'src/systems/livingWorld/census.js': 'seededPersonName(',
    'src/systems/town/townPopulation.js': 'personName(',
    'src/characters/staticNpc.js': 'const drawn = personName(bank, data.gender);',
    'src/systems/quest/person.js': 'personName(',
    'src/systems/quest/foe.js': 'personName(',
    'src/systems/quest/questMacros.js': 'randomPersonName(',
    'src/systems/naval/shipCrew.js': 'personName(',
    'src/systems/merchantYards.js': 'PersonName(',
    'src/systems/crewHall.js': 'PersonName(',
    'src/systems/livingWorld/outlaws.js': 'PersonName(',
  };
  for (const [file, text] of Object.entries(doors)) {
    const src = rd(file);
    assert.ok(src.includes(text), `${file} names through ${text}`);
    assert.ok(/from '[./]+(characters\/)?personNames\.js'/.test(src), `${file} imports personNames.js`);
  }
});
