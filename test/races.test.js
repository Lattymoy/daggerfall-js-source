// S3c/U9: the race table (DFU RaceTemplate verbatim) + the identity
// the paperdoll reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RACES, RACE_TEMPLATES, RACE_KEYS, FACES_PER_RACE, raceArt, raceByKey, raceById } from '../src/systems/races.js';
import { paperdollItemImage } from '../src/ui/paperDoll.js';
import { armorArchive } from '../src/systems/armorMaterials.js';

test('races: all eight RaceTemplates pinned against the DFU literals', () => {
  // RaceTemplate.cs:172-345. The art tables are GENERATED from the
  // scheme (n = zero-based art index) because the Races enum is
  // 1-BASED - the off-by-one that makes hand-typed tables drift - so
  // this pins the generated output against DFU's actual filenames.
  assert.deepEqual([...RACE_KEYS], ['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf', 'WoodElf', 'Khajiit', 'Argonian']);
  assert.deepEqual(RACE_TEMPLATES.map((r) => r.id), [1, 2, 3, 4, 5, 6, 7, 8], 'EntityEnums.Races is 1-based');
  const expect = {
    Breton: ['SCBG00I0.IMG', 'BODY00I0.IMG', 'BODY00I1.IMG', 'BODY10I0.IMG', 'BODY10I1.IMG', 'FACE00I0.CIF', 'FACE10I0.CIF', 'Human'],
    Redguard: ['SCBG01I0.IMG', 'BODY01I0.IMG', 'BODY01I1.IMG', 'BODY11I0.IMG', 'BODY11I1.IMG', 'FACE01I0.CIF', 'FACE11I0.CIF', 'Human'],
    Nord: ['SCBG02I0.IMG', 'BODY02I0.IMG', 'BODY02I1.IMG', 'BODY12I0.IMG', 'BODY12I1.IMG', 'FACE02I0.CIF', 'FACE12I0.CIF', 'Human'],
    DarkElf: ['SCBG03I0.IMG', 'BODY03I0.IMG', 'BODY03I1.IMG', 'BODY13I0.IMG', 'BODY13I1.IMG', 'FACE03I0.CIF', 'FACE13I0.CIF', 'Elf'],
    HighElf: ['SCBG04I0.IMG', 'BODY04I0.IMG', 'BODY04I1.IMG', 'BODY14I0.IMG', 'BODY14I1.IMG', 'FACE04I0.CIF', 'FACE14I0.CIF', 'Elf'],
    WoodElf: ['SCBG05I0.IMG', 'BODY05I0.IMG', 'BODY05I1.IMG', 'BODY15I0.IMG', 'BODY15I1.IMG', 'FACE05I0.CIF', 'FACE15I0.CIF', 'Elf'],
    Khajiit: ['SCBG06I0.IMG', 'BODY06I0.IMG', 'BODY06I1.IMG', 'BODY16I0.IMG', 'BODY16I1.IMG', 'FACE06I0.CIF', 'FACE16I0.CIF', 'Khajiit'],
    Argonian: ['SCBG07I0.IMG', 'BODY07I0.IMG', 'BODY07I1.IMG', 'BODY17I0.IMG', 'BODY17I1.IMG', 'FACE07I0.CIF', 'FACE17I0.CIF', 'Argonian'],
  };
  for (const r of RACE_TEMPLATES) {
    const [bg, mU, mC, fU, fC, hM, hF, morph] = expect[r.key];
    assert.deepEqual([r.background, ...r.bodyMale, ...r.bodyFemale, r.headsMale, r.headsFemale, r.morphology],
      [bg, mU, mC, fU, fC, hM, hF, morph], r.key);
  }
  // display names split the camel case (DFU's localized strings)
  assert.equal(raceByKey('DarkElf').name, 'Dark Elf');
  assert.equal(raceById(RACES.Khajiit).key, 'Khajiit');
  assert.equal(FACES_PER_RACE, 10, 'each FACE*.CIF carries 10 head records');
});

test('races: raceArt picks the gendered set, and morphology drives the ARMOR archive', () => {
  const kf = raceArt('Khajiit', 'female');
  assert.deepEqual(kf.body, ['BODY16I0.IMG', 'BODY16I1.IMG']);
  assert.equal(kf.heads, 'FACE16I0.CIF');
  const km = raceArt('Khajiit', 'male');
  assert.deepEqual(km.body, ['BODY06I0.IMG', 'BODY06I1.IMG']);
  assert.equal(raceArt('nonsense', 'male').race.key, 'Breton', 'unknown races fall back, never throw');

  // ItemBuilder.ApplyArmorSettings: gender picks the archive family,
  // race adds the body morphology (Argonian 0, Elf 1, Human 2,
  // Khajiit 3). The paperdoll hardcoded Human before chargen existed.
  const cuirass = { group: 'Armor', templateIndex: 102, material: 0x0200, variant: 1 };
  const human = paperdollItemImage(cuirass, { gender: 'male', race: 'Breton' });
  const khajiit = paperdollItemImage(cuirass, { gender: 'male', race: 'Khajiit' });
  const argonian = paperdollItemImage(cuirass, { gender: 'female', race: 'Argonian' });
  assert.equal(human.archive, armorArchive('male', 2));
  assert.equal(khajiit.archive, armorArchive('male', 3));
  assert.equal(argonian.archive, armorArchive('female', 0));
  assert.notEqual(human.archive, khajiit.archive, 'morphology actually moves the archive');
  assert.equal(khajiit.archive - human.archive, 1, 'Khajiit is one past Human');
});
