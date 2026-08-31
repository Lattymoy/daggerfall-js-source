// TR1-TR3: THE TEST ROOM - a prebuilt character and a packed armory,
// behind a front-door rail entry. The pins here walk the ONE home
// (systems/testRoom.js) and the three doors that read it (the pane,
// the route, the boot), plus TR2's opts home in weaponRig - where the
// `!!gender` bug lived (the string 'male' is truthy, so every arms
// build asked for the FEMALE skeleton and body columns).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEST_PRESETS, testPresetById, testGearRows, testItemOf, applyTestCharacter,
} from '../src/systems/testRoom.js';
import { armBuildOptsOf } from '../src/combat/weaponRig.js';
import { RACES } from '../src/systems/races.js';
import { CLASS_CAREERS } from '../src/systems/chargen.js';
import { ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { WEAPONS_ENUM, ARMOR_ENUM, ARROW_TEMPLATE } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';

const read = (p) => readFileSync(p, 'utf8');

test('TR1: the presets cover the identity axes the body pipelines branch on', () => {
  assert.equal(TEST_PRESETS.length, 6);
  assert.equal(new Set(TEST_PRESETS.map((p) => p.id)).size, 6, 'ids are unique');
  for (const p of TEST_PRESETS) {
    assert.ok(RACES[p.race], `${p.id}: "${p.race}" is a real RACES key`);
    assert.ok(p.gender === 'male' || p.gender === 'female', `${p.id}: gender is the string convention`);
    assert.ok(p.faceIndex >= 0 && p.faceIndex <= 9, `${p.id}: faceIndex is a portrait-strip index`);
    assert.ok(p.classIndex >= 0 && p.classIndex < CLASS_CAREERS.length, `${p.id}: a real class`);
    assert.ok(p.label && p.blurb, `${p.id}: the card has words`);
  }
  // Both sexes (rule 6's skeleton column and the female body records)
  // and BOTH beast races (base_animkna, the tail row) are reachable.
  assert.ok(TEST_PRESETS.some((p) => p.gender === 'male') && TEST_PRESETS.some((p) => p.gender === 'female'));
  for (const beast of ['Khajiit', 'Argonian']) {
    assert.ok(TEST_PRESETS.some((p) => p.race === beast), `${beast} must be pickable`);
  }
  assert.equal(testPresetById('nord-warrior')?.race, 'Nord');
  assert.equal(testPresetById('no-such'), null, 'an unknown id answers null, never a guess');
});

test('TR1: the armory is total where it claims to be, and every row is a real template', () => {
  for (const gender of ['male', 'female']) {
    const rows = testGearRows(gender);
    for (const r of rows) {
      assert.ok(ITEM_TEMPLATES[r.templateIndex], `${gender}/${r.label}: template ${r.templateIndex} exists`);
    }
    // ONE OF EVERY WEAPON TYPE - each maps to its own Morrowind
    // animation class and attach bone, so a missing type is a lane
    // the room cannot exercise.
    for (const [name, t] of Object.entries(WEAPONS_ENUM)) {
      assert.ok(rows.some((r) => r.kind === 'weapon' && r.templateIndex === t && r.material === 1),
        `${gender}: steel ${name} in the pack`);
    }
    // EVERY armor slot, all four shield sizes included.
    for (const [name, t] of Object.entries(ARMOR_ENUM)) {
      assert.ok(rows.some((r) => r.kind === 'armor' && r.templateIndex === t),
        `${gender}: ${name} in the pack`);
    }
    // The material spread that changes the Morrowind record.
    for (const m of [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Ebony, ARMOR_MATERIAL.Daedric]) {
      assert.ok(rows.some((r) => r.kind === 'armor' && r.material === m), `${gender}: armor material ${m}`);
    }
    // A REAL quiver, so the bow draws loaded (hasAmmo reads the stack).
    const arrows = rows.find((r) => r.kind === 'arrows');
    assert.equal(arrows?.templateIndex, ARROW_TEMPLATE);
    assert.equal(arrows?.stackCount, 60);
    // The clothes are the SEX'S OWN templates - mens rows are 141-181,
    // womens 182-216 (itemTemplates' own split).
    for (const r of rows.filter((x) => x.kind === 'clothing')) {
      if (gender === 'female') assert.ok(r.templateIndex >= 182 && r.templateIndex <= 216, `${r.label} is a womens template`);
      else assert.ok(r.templateIndex >= 141 && r.templateIndex <= 181, `${r.label} is a mens template`);
      assert.equal(r.group, gender === 'female' ? 'WomensClothing' : 'MensClothing');
    }
  }
});

test('TR1: rows mint through the game\'s own constructors, not a second copy', () => {
  const rows = testGearRows('male');
  const sword = testItemOf(rows.find((r) => r.label === 'Steel Longsword'));
  assert.equal(sword.group, 'Weapons');
  assert.ok(sword.minDamage > 0 && sword.maxDamage > sword.minDamage, 'createWeapon minted the damage');
  assert.ok(sword.maxCondition > 0, 'and the condition');
  const arrows = testItemOf(rows.find((r) => r.kind === 'arrows'));
  assert.equal(arrows.stackCount, 60);
  assert.equal(arrows.currentCondition, 0, 'the arrow arm\'s classic zero rides through');
  const cuirass = testItemOf(rows.find((r) => r.label === 'Steel Cuirass'));
  assert.equal(cuirass.group, 'Armor');
  assert.equal(cuirass.material, ARMOR_MATERIAL.Steel);
  assert.ok(cuirass.maxCondition > 0, 'mintCondition ran');
  const robe = testItemOf(rows.find((r) => r.label === 'Plain Robes'));
  assert.equal(robe.group, 'MensClothing');
  assert.equal(robe.name, 'Plain Robes', 'the template names the item');
});

test('TR2: armBuildOptsOf reads the STRING gender - the !! that built the female skeleton for everyone is dead', () => {
  const entity = (gender) => ({
    race: 'DarkElf', gender, faceIndex: 3,
    items: [{ group: 'Weapons', templateIndex: ARROW_TEMPLATE, stackCount: 5 }],
    equip: { slots: { [EQUIP_SLOTS.RightHand]: { group: 'Weapons', templateIndex: WEAPONS_ENUM.Longsword } } },
  });
  const male = armBuildOptsOf(entity('male'));
  assert.equal(male.female, false, 'the string "male" is TRUTHY - a !! here dies');
  assert.equal(armBuildOptsOf(entity('female')).female, true);
  assert.equal(male.race, 'dark elf', 'race rides mwRaceId\'s one spelling');
  assert.equal(male.faceIndex, 3);
  assert.equal(male.weapon.templateIndex, WEAPONS_ENUM.Longsword, 'the right hand reaches the build');
  assert.equal(male.hasAmmo, true, 'the quiver reaches the build');
  assert.equal(armBuildOptsOf({ ...entity('male'), items: [] }).hasAmmo, false);
});

test('TR3: the three doors all read the one home', () => {
  // The pane shows TEST_PRESETS and fires test:<id>.
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /for \(const p of TEST_PRESETS\)/, 'the pane iterates the home, not a copy');
  assert.match(menu, /onAction\(`test:\$\{p\.id\}`\)/, 'a card press is the boot');
  assert.match(menu, /test: paneTest,/, 'the rail entry has a pane');
  // The route: set on this choice, DELETED on every other (F12's law).
  const main = read('src/main.js');
  assert.match(main, /if \(typeof choice === 'string' && choice\.startsWith\('test:'\)\) params\.set\('test', choice\.slice\(5\)\);/);
  assert.match(main, /else params\.delete\('test'\);/, 'New Game must not re-enter the room');
  // The boot: preset resolved BEFORE the branch (an unknown id falls
  // through to the wizard), the same headless seam, the armory, and
  // the arms built only when the data is attached.
  const world = read('src/scenes/world.js');
  assert.match(world, /const testPreset = !playerEntity\.chargenDone && params\.has\('test'\) \? testPresetById\(params\.get\('test'\)\) : null;/);
  assert.match(world, /await applyTestCharacter\(playerEntity, preset, \{ fetchBytes, spellsByIndex: sbi \}\)/);
  assert.match(world, /if \(morrowindDataCount\(\) > 0\)/, 'no data, no build - the classic sprite stands');
  assert.match(world, /await buildArmsFor\(playerEntity\)/, 'with data, the rigs come up without the pause-card trip');
});

// The full character - identity honored through the REAL headless
// chargen, the armory in the pack, the baseline dressed. Needs
// CLASS*.CFG, so it rides the ARENA2 gate like every chargen pin.
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 ? 'ARENA2_PATH not set - real-data validation skipped' : false;

test('TR1: a preset becomes a live character - identity, armory, dressed baseline', { skip: skipReal }, async () => {
  const fetchBytes = async (name) => new Uint8Array(readFileSync(join(ARENA2, name)));
  const entity = { gender: 'male', race: 'Breton', raceId: 1, faceIndex: 0 };
  const preset = testPresetById('argonian-barbarian');
  const { added } = await applyTestCharacter(entity, preset, { fetchBytes });
  // The identity survives applyCharacter's Breton-male defaults.
  assert.equal(entity.race, 'Argonian');
  assert.equal(entity.raceId, RACES.Argonian);
  assert.equal(entity.gender, 'female');
  assert.equal(entity.faceIndex, 5);
  assert.equal(entity.chargenDone, true);
  assert.ok(added >= 40, `the armory landed (${added} items)`);
  // The baseline is DRESSED through the real equip door.
  const slots = entity.equip?.slots ?? {};
  const worn = Object.values(slots).filter(Boolean);
  assert.ok(worn.some((it) => it.templateIndex === ARMOR_ENUM.Cuirass), 'the steel cuirass is on');
  assert.ok(worn.some((it) => it.templateIndex === WEAPONS_ENUM.Longsword), 'the longsword is in hand');
  // And the female pack carries the female clothes.
  assert.ok(entity.items.some((it) => it.templateIndex === 200), 'womens Plain Robes (200) in the pack');
});
