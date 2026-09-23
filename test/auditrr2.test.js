// AUDIT-RR2 (2026-09-23, Mac: "One more audit") - the second adversarial
// pass over the six Roleplay & Realism slices AND the first audit's own
// payments (AUDIT-RR, 0de4bd6f). Four reviewers again, the C# beside the
// port; every finding re-read against the source before it was paid. The
// findings are numbered `AUDIT-RR2 Gn` in the code comments; this suite
// pins the paid ones by execution where the law is a pure function and by
// source where the payment is a host's wiring. The record is the AUDIT-RR2
// section of Roleplay-Realism.md and Roleplay-Realism-Items.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { doEnchantedPayloads } from '../src/systems/enchantments.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { unitWeightInKg, addItem } from '../src/systems/inventory.js';
import { enemyHeavyPainVoice } from '../src/scenes/hostCombat.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';
import { pitchFloor, setPitchFloorProvider, PITCH_FLOOR } from '../src/player/lookFilter.js';
import { createRrRidingContacts } from '../src/systems/rrRidingHost.js';
import { SKILLS } from '../src/systems/skills.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { equipDelayFor } from '../src/systems/equip.js';
import { EQUIP_DELAY_TIMES } from '../src/characters/weaponStates.js';
import { groupTemplates, templateFor, registerTemplateOverrides, templateByIndex, setItemFields, ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { rriStoredWeight, RRI_TEMPLATES, RRI_VENDOR } from '../src/systems/rriItems.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { getLocationVariant, setLocationVariant, setNewLocationVariant, clearWorldDataVariants, NO_VARIANT, makeLocationKey } from '../src/systems/worldDataVariants.js';
import { getCustomMerchantServiceLabel } from '../src/systems/guildServices.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';
import { validItemField } from '../src/systems/itemFields.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { setSyntheticTimeIncrease, claimSyntheticTimeIncrease, resetSyntheticTimeIncrease } from '../src/systems/effectBroker.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { WEAPONS } from '../src/characters/weapons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = 'roleplay-realism';

installRoleplayRealism();

test('AUDIT-RR2 G1: Extra Weight quadruples the item\'s weight (ExtraWeight.cs:61) - the base is the derived read, not an unset field that wrote 0', () => {
  const sword = { group: 'Weapons', templateIndex: 113, material: 0, enchantments: [{ type: ENCHANTMENT_TYPES.ExtraWeight, param: 0 }] };
  const base = unitWeightInKg(sword);
  assert.ok(base > 0);
  doEnchantedPayloads(sword, sword.enchantments, {});
  assert.equal(sword.weightInKg, base * 4);
  assert.equal(unitWeightInKg(sword), base * 4, 'and the pack reads it');
  const feather = { group: 'Weapons', templateIndex: 113, material: 0, enchantments: [{ type: ENCHANTMENT_TYPES.FeatherWeight, param: 0 }] };
  doEnchantedPayloads(feather, feather.enchantments, {});
  assert.equal(unitWeightInKg(feather), 0.25, 'FeatherWeight.cs:61');
  assert.match(rd('src/systems/enchantments.js'), /item\.weightInKg = \(Number\.isFinite\(item\.weightInKg\) \? item\.weightInKg : unitWeightInKg\(item\)\) \* 4;/);
});

test('AUDIT-RR2 G2: the charge\'s heavy pain cry picks the gender the component does (EnhancedRiding.cs:190-194) - a monster (MobileGender.Unspecified) is FEMALE, the city watch male', () => {
  const female = enemyHeavyPainVoice({ gender: 'unspecified', mobileType: 0, entity: { isClass: false } }, () => 0.5);
  const male = enemyHeavyPainVoice({ gender: 'male', mobileType: 0, entity: { isClass: true } }, () => 0.5);
  const watch = enemyHeavyPainVoice({ gender: 'female', mobileType: KNIGHT_CITY_WATCH, entity: { isClass: true } }, () => 0.5);
  const woman = enemyHeavyPainVoice({ gender: 'female', mobileType: 0, entity: { isClass: true } }, () => 0.5);
  assert.ok(female && male && watch && woman);
  assert.notEqual(female.clip, male.clip, 'a monster cries in the female clip');
  assert.equal(female.clip, woman.clip);
  assert.equal(watch.clip, male.clip, 'Knight_CityWatch is male whatever the record says');
});

test('AUDIT-RR2 G3: a duplicate mapId or name is refused BEFORE any write to the region (the C# pushes to local lists), and one bad mod file is said, not the boot', () => {
  const s = rd('src/formats/worldDataReplacement.js');
  const fn = s.slice(s.indexOf('function addLocationToRegion('));
  const throwAt = fn.indexOf('throw new Error');
  const writeAt = fn.indexOf('dfRegion.locationCount++');
  assert.ok(throwAt > 0 && writeAt > throwAt, 'both checks stand before locationCount++');
  assert.match(s, /try \{\s+const dfLocation = locationFromJson\(json, regionIndex\);\s+locationAssignmentSuccess = addLocationToRegion\(regionIndex, dfRegion, dfLocation\) && locationAssignmentSuccess;\s+\} catch \(e\) \{ console\.error\(`\[worlddata\] \$\{name\}: \$\{e\?\.message \?\? e\}`\); locationAssignmentSuccess = false; \}/);
});

test('AUDIT-RR2 G4/G26: the docked HUD lift is `(int)` (EnhancedRiding.cs:257) and the pitch floor rests while paused (:122-131)', () => {
  const mr = rd('src/player/mountRig.js');
  assert.match(mr, /const offset = Math\.trunc\(dockedLargeHudHeight\(\)\);/);
  assert.match(mr, /setPitchFloorProvider\(\(\) => \(enhancedRiding\?\.\(\) && isRiding\(player\.transportMode\) && !paused\(\) \? _terrainAngle \+ RR_RIDING\.pitchMaxOffset : null\)\);/);
});

test('AUDIT-RR2 G5/G24/G25: the charge voice plays on the foe with EnemySounds\' pitch lift, the latch IS the foe\'s pickpocket latch (:185, :204), the foe arm knocks along the controller\'s move direction (:173)', () => {
  _resetModSettings();
  setModSetting(V, 'EnhancedRiding.TrampleCivilians', false);
  const log = [];
  const foe = { ai: { feet: [0, 0, 0.5] }, entity: { isClass: true } };
  const tried = { ai: { feet: [0.5, 0, 0] }, entity: { isClass: true, pickpocketAttempted: true } };
  const playerEntity = { fatigue: 64 * 100, skills: { [SKILLS.HandToHand]: 50 }, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, level: 5 };
  let at = [0, 0, -1];
  const rig = createRrRidingContacts({
    playerEntity, feet: () => at, yaw: () => 0, livePersons: () => [], foes: () => [foe, tried], guards: () => [], isGuardRecord: () => false,
    splashBlood: () => {}, playClip: (clip, vol) => log.push(['clip', clip, vol]), ridingVolumeScale: () => 0.6,
    spawnGuards: () => {}, spawnCityGuard: () => null, setCrime: () => {}, retire: () => {},
    hurtGuard: () => {}, damageFoe: (f) => log.push(['damageFoe', f]), voice: () => ({ clip: 7, pitchLift: 0.2 }), playVoice: (f, v) => log.push(['voice', f, v]), rolls: () => 0.5,
  });
  rig.contacts();                 // the first frame samples the feet; nothing in reach at z = -1
  at = [0.5, 0, 0.2];             // moved mostly +X: a strafe under a north look, both foes in reach
  rig.contacts();
  assert.deepEqual(log.filter((l) => l[0] === 'damageFoe').map((l) => l[1]), [foe], 'the tried foe is not charged again (G24)');
  assert.deepEqual(log.find((l) => l[0] === 'voice'), ['voice', foe, { clip: 7, pitchLift: 0.2 }], 'the voice goes through the host\'s spatial door (G5)');
  assert.ok(!log.some((l) => l[0] === 'clip' && l[1] === 7), 'not the flat one-shot');
  assert.equal(foe.entity.pickpocketAttempted, true, 'PickpocketByPlayerAttempted = true (G24)');
  assert.deepEqual(foe.ai.knockbackDir.map((v) => Math.round(v * 1000) / 1000), [0.385, 0, 0.923], 'the move direction (0.5, 1.2 normalised), not the look (G25)');
  assert.equal(rig.chargeFoe(foe, [0, 0, 1]), false, 'latched');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /playVoice: \(f, v\) => audio\.play3d\(v\.clip, \[f\.ai\.feet\[0\], f\.ai\.feet\[1\] \+ 0\.9, f\.ai\.feet\[2\]\], 1, \{ maxDistance: 16, pitch: 1 \+ v\.pitchLift \}\)/, `${h}: EnemySounds.cs:172-175`);
  _resetModSettings();
});

test('AUDIT-RR2 G6: a peer\'s negative weight is refused on the wire (a stored weight is honoured since AUDIT-RR F5)', () => {
  assert.equal(validItemField('weightInKg', -1), undefined);
  assert.equal(validItemField('weightInKg', 0), 0);
  assert.equal(validItemField('weightInKg', 1.5), 1.5);
});

test('AUDIT-RR2 G7: a fur piece folded before the weight field existed takes the fold\'s stored number on the way in - the jerkin 2 kg off (ItemJerkin.cs:43), the rest the template\'s', () => {
  _resetModSettings();
  assert.equal(rriStoredWeight({ group: 'Armor', templateIndex: 520, material: ARMOR_MATERIAL.Leather, message: 1 }), RRI_TEMPLATES.find((t) => t.index === 520).baseWeight - 2);
  assert.equal(rriStoredWeight({ group: 'Armor', templateIndex: 523, material: ARMOR_MATERIAL.Leather, message: 1 }), 1.4);
  assert.equal(rriStoredWeight({ group: 'Armor', templateIndex: 523, material: ARMOR_MATERIAL.Leather, message: 0 }), null, 'plain leather derives');
  assert.equal(rriStoredWeight({ group: 'Armor', templateIndex: 515, material: ARMOR_MATERIAL.Chain, message: 1 }), null, 'the chain set has no fold');
  const old = setItemFields({ group: 'Armor', templateIndex: 520, material: ARMOR_MATERIAL.Leather, message: 1, rriVariant: true, name: 'Fur Jerkin' });
  assert.equal(old.weightInKg, 6);
  assert.equal(unitWeightInKg(old), 6);
  const kept = setItemFields({ ...old, weightInKg: 0.25 });
  assert.equal(kept.weightInKg, 0.25, 'a stored weight (Feather Weight) is not overwritten');
});

test('AUDIT-RR2 G8: a custom weapon bills its class\'s GroupIndex equip delay (ItemArchersAxe.cs:28-31 -> 3, ItemLightFlail.cs:28-31 -> 6)', () => {
  _resetModSettings();
  assert.equal(equipDelayFor({ group: 'Weapons', templateIndex: 513 }), EQUIP_DELAY_TIMES[3]);
  assert.equal(equipDelayFor({ group: 'Weapons', templateIndex: 514 }), EQUIP_DELAY_TIMES[6]);
  assert.equal(equipDelayFor({ group: 'Weapons', templateIndex: 116 }), EQUIP_DELAY_TIMES[3], 'the classic short sword');
  setModSetting(RRI_VENDOR, 'Enabled', false);
  assert.equal(equipDelayFor({ group: 'Weapons', templateIndex: 513 }), 0, 'off, an unregistered class falls off the table as before');
  _resetModSettings();
});

test('AUDIT-RR2 G9: the group walks read the MERGED template table (ItemHelper.cs:1494) - a mod\'s rarity patch gates the shelf', () => {
  registerTemplateOverrides([]);
  const tanto = ITEM_TEMPLATES[114];
  assert.equal(groupTemplates('Weapons').find((t) => t.index === 114).rarity, tanto.rarity);
  registerTemplateOverrides([{ ...tanto, rarity: 2 }]);
  try {
    assert.equal(templateByIndex(114).rarity, 2);
    assert.equal(groupTemplates('Weapons').find((t) => t.index === 114).rarity, 2, 'the walk answers the patched row');
    assert.equal(templateFor('Weapons', 1).rarity, 2, 'GetItemTemplate(group, j) too');
  } finally { registerTemplateOverrides([]); }
});

test('AUDIT-RR2 G10: the shelf\'s add IS ItemCollection.AddItem (DaggerfallLoot.cs:250) - a stackable merges into its stack', () => {
  _resetModSettings();
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 20 }, { level: 5, gender: 'male' }, { rolls: () => 0.75 });
  const books = shelf.filter((i) => i.group === 'Books');
  assert.equal(books.length, 1);
  assert.equal(books[0].stackCount, 5);
  const list = [];
  addItem(list, { group: 'Books', templateIndex: 277, message: 3 });
  addItem(list, { group: 'Books', templateIndex: 277, message: 3 });
  addItem(list, { group: 'Books', templateIndex: 277, message: 4 });
  assert.deepEqual(list.map((b) => b.stackCount ?? 1), [2, 1], 'by message (ItemCollection.cs:710)');
  assert.match(rd('src/systems/shopStock.js'), /addItem\(items, it\);\s+\/\/ AUDIT-RR2 G10/);
});

test('AUDIT-RR2 G11/G12: the starting kit\'s armor takes CreateArmor\'s default variant (-1 -> RandomizeArmorVariant), and a custom weapon mints with its template\'s name', () => {
  assert.match(rd('src/systems/rriKits.js'), /function armor\(templateIndex, material, rolls, variant = -1\)/);
  assert.match(rd('src/combat/enemyEquipment.js'), /const name = WEAPON_BY_INDEX\[templateIndex\] \?\? templateByIndex\(templateIndex\)\?\.name;/);
});

test('AUDIT-RR2 G13: a building entry sets WorldDataVariants\' last key to THIS location (PlayerEnterExit.cs:695-696) - a streamed neighbour may have left it on itself', () => {
  assert.match(rd('src/scenes/world.js'), /setLastLocationKeyTo\(dfLoc\.regionIndex, dfLoc\.locationIndex \?\? 0\);\s+\/\/ AUDIT-RR2 G13[^\n]*\n\s+const d = buildingDataForDoor\(dfLoc\.exterior\.buildings, p\.locBlocks, \{/);
  assert.match(rd('src/scenes/exterior.js'), /setLastLocationKeyTo\(dfLocation\.regionIndex, dfLocation\.locationIndex \?\? 0\);\s+\/\/ AUDIT-RR2 G13[^\n]*\n\s+const d = buildingDataForDoor\(dfLocation\.exterior\.buildings, loc\.blocks, \{/);
});

test('AUDIT-RR2 G14/G16/G19: an RDB/RDI JSON is said and not served with a null body; the variant arm takes every asset the suffix finds (:284-292); the padded building rows are None', () => {
  const s = rd('src/formats/worldDataReplacement.js');
  assert.match(s, /if \(!blockName\.endsWith\('\.RMB'\)\) \{[^\n]*\n\s+console\.warn\(`\[worlddata\] \$\{blockName\}: RDB\/RDI block replacement is not converted by the port - ignored`\);\s+if \(variant === NO_VARIANT\) blocks\.set\(blockName, NO_REPLACEMENT\);\s+return null;\s+\}/);
  const variantArm = s.slice(s.indexOf('export function loadNewDFLocationVariant'), s.indexOf('export const getNewDFBlockIndex'));
  assert.ok(!/startsWith\('locationnew-'\)/.test(variantArm), 'no prefix test on the mod arm');
  const b = blockFromJson({ Name: 'X.RMB', Type: 'Rmb', RmbBlock: { FldHeader: { BuildingDataList: [{ FactionId: 1, BuildingType: 2 }] }, SubRecords: [] } }, 5000);
  assert.equal(b.rmbBlock.fldHeader.buildingDataList.length, 32);
  assert.equal(b.rmbBlock.fldHeader.buildingDataList[0].factionId, 1);
  assert.equal(b.rmbBlock.fldHeader.buildingDataList[1].buildingType, -1, 'BuildingTypes.None');
});

test('AUDIT-RR2 G15/G17: GetLocationVariant flags newLocation only inside the TryGetValue arm (:176-182); the merchant label\'s "?" (Services.cs:173-179)', () => {
  clearWorldDataVariants();
  const key = makeLocationKey(17, 9000);
  setNewLocationVariant(17, 'Nowhere', '_x');   // resolves to no index without a resolver - nothing set
  assert.deepEqual(getLocationVariant(key), { variant: NO_VARIANT, newLocation: false });
  setLocationVariant(17, 42, '_rr');
  assert.deepEqual(getLocationVariant(makeLocationKey(17, 42)), { variant: '_rr', newLocation: false });
  clearWorldDataVariants();
  assert.equal(getCustomMerchantServiceLabel(999999), '?');
});

test('AUDIT-RR2 G20: the encumbrance round drains nothing inside a synthetic-time window (RoleplayRealism.cs:587) - a fast travel\'s catch-up', () => {
  _resetModSettings();
  setModSetting(V, 'encumbranceEffects', true);
  const mk = () => ({ isPlayer: true, stats: { strength: 40, speed: 60 }, activeEffects: [], items: Array.from({ length: 7 }, () => mintCondition(setItemFields({ group: 'Weapons', templateIndex: WEAPONS.Claymore, material: 0 }))), health: 20, fatigue: 5000 });
  resetSyntheticTimeIncrease();
  const drained = [];
  runMagicRoundsFor(mk(), 0, 1, { sinks: { drainFatigue: (n) => drained.push(n) } });
  assert.equal(drained.length, 1, 'a live round drains');
  setSyntheticTimeIncrease(true); claimSyntheticTimeIncrease();
  try {
    const travelled = mk();
    const none = [];
    runMagicRoundsFor(travelled, 0, 1, { sinks: { drainFatigue: (n) => none.push(n) } });
    assert.deepEqual(none, [], 'a synthetic round takes none');
    assert.equal(travelled.fatigue, 5000);
  } finally { resetSyntheticTimeIncrease(); }
  assert.match(rd('src/systems/rrInstall.js'), /\|\| syntheticTimeIncrease\(\)\) return null;\s+\/\/ AUDIT-RR2 G20/);
  _resetModSettings();
});

test('AUDIT-RR2 G21/G22/G23: the five-day box answers Y and N (DaggerfallMessageBox.cs:377); the ship gate asks Travel Options\' port list when that mod is on (:635-644); PitchMaxLimit clamps to PitchMin -90', () => {
  assert.match(rd('src/ui/guildServiceWindows.js'), /if \(t\.buttonsMulti\) \{\s+if \(code === 'KeyY' && t\.buttonsMulti\.includes\(MB_BUTTONS\.Yes\)\) this\._advance\(t\.onButton\?\.\(MB_BUTTONS\.Yes\) \?\? null\);\s+else if \(code === 'KeyN' && t\.buttonsMulti\.includes\(MB_BUTTONS\.No\)\) this\._advance\(t\.onButton\?\.\(MB_BUTTONS\.No\) \?\? null\);\s+return;\s+\}/);
  assert.match(rd('src/scenes/world.js'), /portTown: \(modSetting\('travel-options', 'Enabled'\) === true \? hasPort\(loc\.mapTableData\?\.mapId\) : \(loc\.exterior\?\.exteriorData\?\.portTownAndUnknown \?\? 0\) !== 0\)/);
  setPitchFloorProvider(() => -120);
  try {
    assert.equal(pitchFloor(), (-90 * Math.PI) / 180, 'PlayerMouseLook.cs:87-90');
    setPitchFloorProvider(() => 30);
    assert.equal(pitchFloor(), Math.min((30 * Math.PI) / 180, PITCH_FLOOR));
  } finally { setPitchFloorProvider(null); }
});

test('AUDIT-RR2: the record - both bible pages carry every paid number, and the named-not-changed list', () => {
  const rr = rd('bible/06-Systems/Roleplay-Realism.md');
  const rri = rd('bible/06-Systems/Roleplay-Realism-Items.md');
  assert.match(rr, /^## AUDIT-RR2 \(2026-09-23\)/m);
  assert.match(rri, /^## AUDIT-RR2 \(2026-09-23\)/m);
  for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G13', 'G14', 'G15', 'G16', 'G17', 'G19', 'G20', 'G21', 'G22', 'G23', 'G24', 'G25', 'G26']) assert.match(rr, new RegExp(`\\*\\*${g} `), `${g} recorded`);
  for (const g of ['G7', 'G8', 'G9', 'G10', 'G11', 'G12']) assert.match(rri, new RegExp(`\\*\\*${g} `), `RRI ${g} recorded`);
  assert.match(rr, /named, not changed/i);
});
