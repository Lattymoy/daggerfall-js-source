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
import { resurrectionSpell } from './resurrect.js';   // RESURRECT1: the sorceress carries one, to test with
import { applyHeadlessChargen } from './chargenSession.js';
import { addItem } from './inventory.js';
import { equipItem } from './equip.js';
import { mintCondition, templateByIndex, itemBaseValue, setItemFields } from './itemTemplates.js';   // MAC-N1: SetItem's name + value, the one export
import { WEAPONS_ENUM, ARMOR_ENUM, createWeapon, ARROW_TEMPLATE } from '../combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { TRANSPORT_HORSE_TEMPLATE, hasHorse } from './inventorySession.js';   // TSR4: the mount is the pack's own question
import { BOOK_TEMPLATE, createBook } from './books.js';   // EB3: books in the pack, for the reader
import { BOOK_ID_TITLES } from './booksData.js';
import { setPref } from './uiPrefs.js';   // LR3: the loot door turns the ladder on for the session
import { applyRarity, LEGENDARIES, ROLLED_TIERS } from './lootRarity.js';   // LR3: one of everything the ladder can mint
import { createThunderlock, createPellets, THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from './thunderlock.js';   // TSR-GUN: the port's own weapon, and the import IS its registration

/** The prebuilt characters. `race` is the DF race key (races.js RACES
 *  spelling - mwRaceId derives the Morrowind id from it), `classIndex`
 *  indexes CLASS_CAREERS (chargen.js), `faceIndex` is the classic
 *  portrait pick the Morrowind head/hair law also reads. */
export const TEST_PRESETS = Object.freeze([
  { id: 'nord-warrior', label: 'Nord Warrior', race: 'Nord', gender: 'male', faceIndex: 0, classIndex: 16,
    blurb: 'The plain human male baseline - steel and a longsword.' },
  { id: 'breton-sorceress', label: 'Breton Sorceress', race: 'Breton', gender: 'female', faceIndex: 2, classIndex: 3,
    blurb: 'The female body and animation column, robes in the pack - and a Fireball and a Healing Bolt to throw.' },
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
 *  both skins show the CFA mount. One entry, so the pane, the route and
 *  the boot all agree
 *  what `test=ride` is. */
export const TEST_RIDE = Object.freeze({
  id: 'ride', label: 'Ride out', preset: 'nord-warrior',
  blurb: 'The Nord Warrior on a horse, outside the town - the riding sprite. Press T to dismount.',
});

/** LR3 (loot rarity): THE LOOT LADDER - a door that opens with one of
 *  everything the ladder can mint in the pack: a Magic and a Rare of
 *  each of ten base items, and every Legendary on a fitting base. The
 *  switch is turned ON for the session at the door, so the colours,
 *  the lines and the folds show; the Nord Warrior carries it. */
export const TEST_LOOT = Object.freeze({
  id: 'loot', label: 'The loot ladder', preset: 'nord-warrior',
  blurb: 'The Nord Warrior with a Magic and a Rare of ten base items and every Legendary in the pack, IDENTIFIED so their names and affix lines read - plus one unidentified Rare and one unidentified Legendary, which is what the two top tiers look like on the floor. The tier colours, the affix lines and the folds on the paperdoll. Turns Loot rarity on.',
});

/** The one door for a `test=` id: a preset (ride false), the ride
 *  entry (its preset, ride true), the loot ladder (loot true), or null
 *  - an unknown id resolves to NOTHING so the boot falls through to
 *  the wizard, never a guess. */
export function testEntryById(id) {
  if (id === TEST_RIDE.id) return { preset: testPresetById(TEST_RIDE.preset), ride: true };
  if (id === TEST_LOOT.id) return { preset: testPresetById(TEST_LOOT.preset), ride: false, loot: true };
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
  // TSR-GUN (Mac, 2026-09-19: "Put this weapon and ammo inside the
  // test characters"). The Dwarven Thunderlock is the ONE weapon the
  // armory could not reach any other way: it is not in WEAPONS_ENUM
  // (that enum is DFU's table and this weapon is the port's own), it
  // is off the shops entirely and its find is the rarest roll in the
  // game - so without a row here the only way to hold one is to be
  // lucky. It rides with a stack of pellets for the same reason the
  // bow rides with a quiver: a ranged weapon with no ammunition
  // tests the refusal, not the weapon.
  rows.push({ kind: 'thunderlock', label: 'Dwarven Thunderlock', templateIndex: THUNDERLOCK_TEMPLATE });
  rows.push({ kind: 'pellets', label: 'Dwemer Pellets (30)', templateIndex: PELLET_TEMPLATE, stackCount: 30 });
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
  // EB3 (Mac, 2026-09-12: "For testing in the test character
  // inventories. Give them books."): a shelf's worth, by the classic
  // mapping's ids, so the reader - and the enhanced book over it - can
  // be opened from the pack without a shelf or a shop. A short one, a
  // long one, a title page in the large face, and one with a poem.
  for (const id of TEST_BOOKS) rows.push({ kind: 'book', label: BOOK_ID_TITLES.get(id), templateIndex: BOOK_TEMPLATE, message: id });
  return rows;
}

/** EB3: the test pack's books, by ID in the classic mapping
 *  (booksData.js). */
export const TEST_BOOKS = Object.freeze([28, 5, 1, 25]);   // Brief History of the Empire I; Ark'ay The God; A Tale of Kieran; Legal Basics

/** A gear row to a real inventory item, through the SAME constructors
 *  the game's own loot uses - createWeapon for weapons (condition and
 *  damage minted there), the armor/clothing literal shapes the loot
 *  factories mint, condition through mintCondition. */
export function testItemOf(row) {
  if (row.kind === 'weapon') return createWeapon(row.templateIndex, row.material);
  if (row.kind === 'book') return createBook(row.message);   // EB3: ItemBuilder.CreateBook, the named path
  if (row.kind === 'arrows') return { ...createWeapon(ARROW_TEMPLATE, 0), stackCount: row.stackCount };
  // TSR-GUN: through the weapon's OWN constructors, the same two the
  // find and the legendary mint with - a second literal here is how
  // the test character's gun and the found one drift apart.
  if (row.kind === 'thunderlock') return createThunderlock();
  if (row.kind === 'pellets') return createPellets(row.stackCount);
  if (row.kind === 'armor') {
    // MAC-N1: through SetItem's value write - this armor was minted
    // with a name and NO value, the corpse's shape exactly.
    return mintCondition(setItemFields({
      group: 'Armor', templateIndex: row.templateIndex, material: row.material,
      name: row.label, flags: 0,
    }));
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

/** LR3: the ladder's bases - ten items across the three groups the
 *  ladder rolls, each minted the way the loot factories mint them. */
export const TEST_LOOT_BASES = Object.freeze([
  { kind: 'weapon', label: 'Steel Longsword', templateIndex: WEAPONS_ENUM.Longsword, material: 1 },
  { kind: 'weapon', label: 'Steel Dagger', templateIndex: WEAPONS_ENUM.Dagger, material: 1 },
  { kind: 'weapon', label: 'Steel Battle Axe', templateIndex: WEAPONS_ENUM['Battle Axe'] ?? 127, material: 1 },
  { kind: 'weapon', label: 'Steel Long Bow', templateIndex: WEAPONS_ENUM['Long Bow'] ?? 130, material: 1 },
  { kind: 'armor', label: 'Steel Cuirass', templateIndex: ARMOR_ENUM.Cuirass, material: ARMOR_MATERIAL.Steel },
  { kind: 'armor', label: 'Steel Helm', templateIndex: ARMOR_ENUM.Helm, material: ARMOR_MATERIAL.Steel },
  { kind: 'armor', label: 'Steel Boots', templateIndex: ARMOR_ENUM.Boots, material: ARMOR_MATERIAL.Steel },
  { kind: 'armor', label: 'Steel Kite Shield', templateIndex: ARMOR_ENUM.Kite_Shield ?? 111, material: ARMOR_MATERIAL.Steel },
  { kind: 'jewellery', label: 'Ring', templateIndex: 135, group: 'Jewellery' },
  { kind: 'jewellery', label: 'Amulet', templateIndex: 133, group: 'Jewellery' },
]);

/** LR3: the loot ladder's pack - a Magic and a Rare of every base, then
 *  every Legendary on the first base its record fits (a record with no
 *  fitting base here mints on its own group's first template). Pure
 *  over `rolls`; turns the switch on. Returns what it added.
 *
 *  LR6 (2026-09-15, Mac: "when I open the loot test character, nothing
 *  on the character has rarity in the inventory"): THE SHOWCASE WAS
 *  HIDING WHAT IT SHOWCASES, and it was DFU's own law doing it. A Rare
 *  and a Legendary carry a real DFU enchantment, so `itemIsIdentified`
 *  reads them as UNIDENTIFIED - and an unidentified item gives up its
 *  name to the bare template (ItemHelper.cs:265-292, through
 *  `itemInfo.itemNameParts`) and its affix lines with it. So twenty of
 *  the thirty items this door minted read as `Longsword`, `Dagger`,
 *  `Battle Axe` - indistinguishable from the forty-nine plain armory
 *  pieces `seedTestGear` puts in the pack AHEAD of them, with nothing
 *  but a name COLOUR between them. Wyrmbane, Nightwhisper and
 *  Graveward were all in there, all called "Longsword".
 *
 *  That law is right for a real drop and this page does not touch it.
 *  It is wrong for the ROOM, whose whole job is to show the ladder,
 *  and whose own blurb had been promising the affix lines it hid. So
 *  the ladder mints IDENTIFIED here - and then mints ONE unidentified
 *  Rare and ONE unidentified Legendary beside it, because the
 *  unidentified reading is half of what the room exists to show and
 *  dropping it would trade one missing half for the other. */
export function seedTestLoot(entity, rolls = Math.random) {
  setPref('lootRarity', true);
  const added = [];
  const base = (row) => (row.kind === 'jewellery'
    ? mintCondition({ group: 'Jewellery', templateIndex: row.templateIndex, name: templateByIndex(row.templateIndex)?.name ?? row.label, flags: 0 })
    : testItemOf(row));
  /** Into the pack. `identified` is LR6's arm: the flag DFU's own
   *  `itemIsIdentified` reads, set so the room can be READ. It is
   *  inert on a Magic - an unenchanted item is always identified - so
   *  it may be set uniformly rather than by tier. */
  const put = (it, { identified = true } = {}) => {
    if (identified) it.isIdentified = true;
    addItem(entity.items, it);
    added.push(it);
    return it;
  };
  /** One Legendary record, on the base its own `templates` allow. */
  const legendaryItem = (rec) => {
    const row = TEST_LOOT_BASES.find((r) => (r.group ?? (r.kind === 'weapon' ? 'Weapons' : 'Armor')) === rec.group && (!rec.templates || rec.templates.includes(r.templateIndex)))
      ?? TEST_LOOT_BASES.find((r) => (r.group ?? (r.kind === 'weapon' ? 'Weapons' : 'Armor')) === rec.group);
    const it = base(rec.templates && !rec.templates.includes(row.templateIndex) ? { ...row, templateIndex: rec.templates[0], label: templateByIndex(rec.templates[0])?.name ?? row.label } : row);
    // the record is CHOSEN, not rolled: a one-record pool through the same door
    return applyRarity(it, 'legendary', () => 0, [rec]);
  };
  for (const tier of ROLLED_TIERS.filter((t) => t !== 'legendary')) {
    for (const row of TEST_LOOT_BASES) put(applyRarity(base(row), tier, rolls));
  }
  for (const rec of LEGENDARIES) put(legendaryItem(rec));
  // ...and the law itself, once each: what a Rare and a Legendary look
  // like on the floor, before the Mages Guild has been paid.
  put(applyRarity(base(TEST_LOOT_BASES[0]), 'rare', rolls), { identified: false });
  if (LEGENDARIES.length) put(legendaryItem(LEGENDARIES[0]), { identified: false });
  return added;
}

/** SPELLFX1 (2026-09-23): THE SORCERESS GETS MISSILES. The Mage set she
 *  starts with has nothing that flies, and the co-op spell work needs
 *  two things to throw at a friend in the test room: a FIREBALL (the
 *  hostile missile - a peer must see it fly and it must pass through
 *  them) and a HEALING BOLT (the friendly one - it must land on them
 *  through ALLY-CAST's cast frame, a party mate). Fireball is SPELLS.STD's own record when the
 *  loaded file has one by that name, and a made one otherwise; the bolt
 *  is always made - Heal Health at range, the Balm's shape. Fixed
 *  negative indices below the Healer's touch (-1000), so a re-apply
 *  does not double them. */
const TEST_MISSILE_EFFECT = (type, subType, lo, hi) => ({
  type, subType,
  durationBase: 0, durationMod: 0, durationPerLevel: 1,
  chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  magnitudeBaseLow: lo, magnitudeBaseHigh: hi, magnitudeLevelBase: 1, magnitudeLevelHigh: 2, magnitudePerLevel: 1,
});
export const TEST_FIREBALL_INDEX = -1001;
export const TEST_HEAL_BOLT_INDEX = -1002;
export function testMissileSpells(spellsByIndex = null) {
  let fireball = null;
  for (const sp of spellsByIndex?.values?.() ?? []) {
    if (String(sp?.name ?? '').trim().toLowerCase() === 'fireball' && sp.rangeType >= 2) { fireball = sp; break; }
  }
  fireball ??= {
    name: 'Fireball', element: 0, rangeType: 4, icon: 0, cost: 0, index: TEST_FIREBALL_INDEX, custom: true,
    effects: [TEST_MISSILE_EFFECT(4, 0, 10, 20)],   // Damage Health, fire, a burst at range
  };
  const healBolt = {
    name: 'Healing Bolt', element: 4, rangeType: 2, icon: 0, cost: 0, index: TEST_HEAL_BOLT_INDEX, custom: true,
    effects: [TEST_MISSILE_EFFECT(10, 8, 5, 10)],   // Heal Health, a single target at range
  };
  return [fireball, healBolt];
}
export function addTestMissileSpells(entity, spellsByIndex = null) {
  entity.spells ??= [];
  // RESURRECT1 (2026-09-23): and a Resurrection, to raise a fallen party mate in the test room
  for (const sp of [...testMissileSpells(spellsByIndex), resurrectionSpell()]) {
    if (!entity.spells.some((k) => k === sp || (k?.index === sp.index && k?.name === sp.name))) entity.spells.push(sp);
  }
  return entity.spells;
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
  if (preset.id === 'breton-sorceress') addTestMissileSpells(playerEntity, spellsByIndex);   // SPELLFX1: something that FLIES, to test with
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
