// THE TEST ROOM (TR1, 2026-08-31, Mac's ask: "a menu option that leads
// to a sort of test environment where I can pick a prebuilt character
// and loot armor, weapons, etc").
//
// ONE HOME for everything the room is made of: the prebuilt characters,
// the armory they walk in with, and the seeding that turns a preset
// into a live entity. The door (enhancedMenu's Test Room pane), the
// route (main.js) and the boot (world.js) all read THIS module - a
// second copy of a preset in any of them is how two rooms drift apart.
//
// WHAT THE ROOM IS NOT: a new scene. It boots the same streaming world
// every other door boots, through the same headless-chargen seam
// ?class= has used since AUDIT 17f - the room is a CHARACTER and a
// PACK, not a place. That is deliberate: the point is to see the real
// game's rigs (classic paperdoll + sprite weapons, and the Morrowind
// arms/body when that data is attached) wearing real equipment through
// the real equip table, and a bespoke scene would be testing itself.
//
// THE PRESETS exercise the identity axes the body pipelines branch on:
// both sexes, human and elf and BOTH beast races (rule 6 picks the
// skeleton by sex and beast; rules 1-3 pick body records by race;
// playerBodyRows' face law reads faceIndex). The class picks the
// starting kit and skills, which the room does not care about beyond
// "a real character" - the armory below supersedes it.

import { RACES } from './races.js';
import { applyHeadlessChargen } from './chargenSession.js';
import { addItem } from './inventory.js';
import { equipItem } from './equip.js';
import { mintCondition, templateByIndex, itemBaseValue } from './itemTemplates.js';
import { WEAPONS_ENUM, ARMOR_ENUM, createWeapon, ARROW_TEMPLATE } from '../combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { TRANSPORT_HORSE_TEMPLATE, hasHorse } from './inventorySession.js';   // TSR4: the mount is the pack's own question

/** The prebuilt characters. `race` is the DF race key (races.js RACES
 *  spelling - mwRaceId derives the Morrowind id from it), `classIndex`
 *  indexes CLASS_CAREERS (chargen.js), `faceIndex` is the classic
 *  portrait pick the Morrowind head/hair law also reads. */
export const TEST_PRESETS = Object.freeze([
  { id: 'nord-warrior', label: 'Nord Warrior', race: 'Nord', gender: 'male', faceIndex: 0, classIndex: 16,
    blurb: 'The plain human male baseline - steel and a longsword.' },
  { id: 'breton-sorceress', label: 'Breton Sorceress', race: 'Breton', gender: 'female', faceIndex: 2, classIndex: 3,
    blurb: 'The female body and animation column, robes in the pack.' },
  { id: 'redguard-archer', label: 'Redguard Archer', race: 'Redguard', gender: 'female', faceIndex: 4, classIndex: 13,
    blurb: 'Bows and a full quiver - the drawn arrow rides the string.' },
  { id: 'darkelf-nightblade', label: 'Dark Elf Nightblade', race: 'DarkElf', gender: 'male', faceIndex: 1, classIndex: 5,
    blurb: 'The elf body records, daggers and short blades.' },
  { id: 'khajiit-monk', label: 'Khajiit Monk', race: 'Khajiit', gender: 'male', faceIndex: 3, classIndex: 12,
    blurb: 'A beast race - its own skeleton, and the tail is part of the body.' },
  { id: 'argonian-barbarian', label: 'Argonian Barbarian', race: 'Argonian', gender: 'female', faceIndex: 5, classIndex: 15,
    blurb: 'The other beast race, female - both hard axes at once.' },
]);

export const testPresetById = (id) => TEST_PRESETS.find((p) => p.id === id) ?? null;

/** TSR4 (2026-09-03, Mac: "an option that spawns you into the outside
 *  world with a mount to test"). The ride is a SPAWN, not a character:
 *  the baseline preset, a horse already in the pack, the landing at the
 *  location's EDGE (the fast-travel arrival law - outside the walls,
 *  facing in), and the mode set through the one transport door. The
 *  classic skin shows the CFA mount; the enhanced skin the Pegas horse
 *  (MW-D50). One entry, so the pane, the route and the boot all agree
 *  what `test=ride` is. */
export const TEST_RIDE = Object.freeze({
  id: 'ride', label: 'Ride out', preset: 'nord-warrior',
  blurb: 'The Nord Warrior on a horse, outside the town - the riding sprite in the classic skin, the Pegas horse in the enhanced. Press T to dismount.',
});

/** The one door for a `test=` id: a preset (ride false), the ride
 *  entry (its preset, ride true), or null - an unknown id resolves to
 *  NOTHING so the boot falls through to the wizard, never a guess. */
export function testEntryById(id) {
  if (id === TEST_RIDE.id) return { preset: testPresetById(TEST_RIDE.preset), ride: true };
  const preset = testPresetById(id);
  return preset ? { preset, ride: false } : null;
}

/** TSR4: put a horse in the pack, minted the way the general store's
 *  shelf mints one (shopStock's add: mintCondition over the template's
 *  own name and base value) - so the T window, the travel card and the
 *  pack all answer hasHorse the way they would for a bought one. Once:
 *  a pack that already carries a horse is left alone. */
export function seedTestMount(entity) {
  if (hasHorse(entity.items)) return false;
  const horse = mintCondition({
    group: 'Transportation', templateIndex: TRANSPORT_HORSE_TEMPLATE,
    name: templateByIndex(TRANSPORT_HORSE_TEMPLATE)?.name ?? 'Horse', flags: 0,
  });
  horse.value = itemBaseValue(horse);
  addItem(entity.items, horse);
  return true;
}

/**
 * THE ARMORY. One of every weapon TYPE the game has (each maps to its
 * own Morrowind animation class and attach bone - rule 8's whole
 * column gets exercised), a material spread on the pieces where
 * material picks a different Morrowind record (steel as the baseline,
 * leather -> netch, chain -> imperial chain, ebony/daedric for the
 * high rows), every armor SLOT including all four shield sizes, and a
 * change of clothes per sex (robes drape, the reference's priority
 * law hides the limbs under them). Arrows come in a real stack so the
 * bow draws loaded.
 *
 * Data, not calls, so the pane can COUNT it and a pin can walk every
 * row against ITEM_TEMPLATES without booting a world.
 */
export function testGearRows(gender) {
  const female = gender === 'female';
  const W = WEAPONS_ENUM; const A = ARMOR_ENUM; const M = ARMOR_MATERIAL;
  const rows = [];
  // Every weapon type once, in steel (weapon material 1).
  for (const [name, t] of Object.entries(W)) rows.push({ kind: 'weapon', label: `Steel ${name}`, templateIndex: t, material: 1 });
  // The material spread - each is a DIFFERENT Morrowind record.
  rows.push({ kind: 'weapon', label: 'Iron Dagger', templateIndex: W.Dagger, material: 0 });
  rows.push({ kind: 'weapon', label: 'Ebony Longsword', templateIndex: W.Longsword, material: 7 });
  rows.push({ kind: 'weapon', label: 'Daedric Dai-Katana', templateIndex: W['Dai-Katana'], material: 9 });
  rows.push({ kind: 'arrows', label: 'Arrows (60)', templateIndex: ARROW_TEMPLATE, stackCount: 60 });
  // The full steel suit - every armor slot.
  for (const [name, t] of Object.entries(A)) rows.push({ kind: 'armor', label: `Steel ${name.replace(/_/g, ' ')}`, templateIndex: t, material: M.Steel });
  // Material rows that change the Morrowind mapping.
  rows.push({ kind: 'armor', label: 'Leather Cuirass', templateIndex: A.Cuirass, material: M.Leather });
  rows.push({ kind: 'armor', label: 'Leather Gauntlets', templateIndex: A.Gauntlets, material: M.Leather });
  rows.push({ kind: 'armor', label: 'Chain Cuirass', templateIndex: A.Cuirass, material: M.Chain });
  rows.push({ kind: 'armor', label: 'Chain Greaves', templateIndex: A.Greaves, material: M.Chain });
  rows.push({ kind: 'armor', label: 'Ebony Cuirass', templateIndex: A.Cuirass, material: M.Ebony });
  rows.push({ kind: 'armor', label: 'Daedric Helm', templateIndex: A.Helm, material: M.Daedric });
  // A change of clothes, the sex's own templates (itemTemplates rows).
  const clothes = female
    ? [[200, 'Plain Robes'], [184, 'Peasant Blouse'], [190, 'Casual Pants'], [186, 'Shoes'], [191, 'Casual Cloak'], [212, 'Long Skirt']]
    : [[163, 'Plain Robes'], [165, 'Short Shirt'], [151, 'Casual Pants'], [147, 'Shoes'], [154, 'Casual Cloak'], [158, 'Short Tunic']];
  for (const [t, label] of clothes) {
    rows.push({ kind: 'clothing', label, templateIndex: t, group: female ? 'WomensClothing' : 'MensClothing' });
  }
  return rows;
}

/** A gear row to a real inventory item, through the SAME constructors
 *  the game's own loot uses - createWeapon for weapons (condition and
 *  damage minted there), the armor/clothing literal shapes the loot
 *  factories mint, condition through mintCondition. */
export function testItemOf(row) {
  if (row.kind === 'weapon') return createWeapon(row.templateIndex, row.material);
  if (row.kind === 'arrows') return { ...createWeapon(ARROW_TEMPLATE, 0), stackCount: row.stackCount };
  if (row.kind === 'armor') {
    return mintCondition({
      group: 'Armor', templateIndex: row.templateIndex, material: row.material,
      name: row.label, flags: 0,
    });
  }
  return mintCondition({
    group: row.group, templateIndex: row.templateIndex, dye: 0, variant: 0,
    name: templateByIndex(row.templateIndex)?.name ?? row.label, flags: 0,
  });
}

/** Fill the pack. Runs AFTER the class kit so the spellbook stays
 *  first (AUDIT 17f's collection-order law); returns what it added so
 *  the boot can say so. */
export function seedTestGear(entity) {
  const rows = testGearRows(entity.gender);
  const added = [];
  for (const row of rows) {
    const item = testItemOf(row);
    addItem(entity.items, item);
    added.push(item);
  }
  return added;
}

/**
 * A preset to a live character: the identity FIRST, because
 * applyCharacter honors pre-seeded race/gender/faceIndex over its
 * Breton-male defaults (`?? playerEntity.x` - chargen.js), THEN the
 * same headless chargen ?class= boots through - one construction
 * seam, not a third copy of it. The armory lands last, on top of the
 * class kit.
 */
export async function applyTestCharacter(playerEntity, preset, { fetchBytes, spellsByIndex = null } = {}) {
  playerEntity.race = preset.race;
  playerEntity.raceId = RACES[preset.race] ?? 1;
  playerEntity.gender = preset.gender;
  playerEntity.faceIndex = preset.faceIndex | 0;
  playerEntity.name = preset.label;
  await applyHeadlessChargen(playerEntity, preset.classIndex, { fetchBytes, spellsByIndex });
  const added = seedTestGear(playerEntity);
  // Dress the baseline so the room opens with something ON: the steel
  // suit's cuirass and a longsword in hand - through the real equip
  // door, the same press the inventory window makes.
  const cuirass = added.find((it) => it.group === 'Armor' && it.templateIndex === ARMOR_ENUM.Cuirass && it.material === ARMOR_MATERIAL.Steel);
  const sword = added.find((it) => it.group === 'Weapons' && it.templateIndex === WEAPONS_ENUM.Longsword && it.material === 1);
  if (cuirass) equipItem(playerEntity, cuirass);
  if (sword) equipItem(playerEntity, sword);
  return { added: added.length };
}
