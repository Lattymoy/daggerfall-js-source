// THE DWARVEN THUNDERLOCK, and the Dwemer Pellet it eats.
//
// Mac, 2026-09-19: "The weapon itself will be called Dwarven
// Thunderlock. Ammo: Dwemer Pellet. Im ready to integrate this as a
// new weapon type. Should work with the archery skill."
//
// THIS IS A DEPARTURE, AND IT IS THE FIRST ONE OF ITS KIND. Every
// other weapon in this port is a translation of a Daggerfall weapon;
// this one is ours. It was prototyped before it was built - the gun
// lab (gun-proto.html, bible/05-Combat/Gun-Lab.md) settled the pose,
// the cadence, the recoil and the sounds while combat/ was untouched -
// and only what survived that is here.
//
// WHAT IT BORROWS, AND WHY. It is an ARCHERY weapon, by Mac's call and
// by its own nature: it is fired rather than swung, it spends
// ammunition, and its cooldown is the bow's. So every law that reads
// "which skill did this hit use" already answers Archery the moment
// weaponSkillUsed names it, and the port's existing ranged lane
// carries the rest.
//
// WHAT IT DOES NOT BORROW: `isBow`. A bow DRAWS - StrikeUp winds up,
// the string holds at frame 3, StrikeDown looses - and a gun does
// none of that; it has a trigger. So the machine runs the melee
// one-shot (six frames, hit on frame 1) with the BOW's cooldown
// bolted on, which is the shape the lab proved and the shape the art
// has. The skill is not the machine.
//
// THE INDICES are 560 and 561, which are past DFU's 288 and past
// Climates & Calories' 530-541 (systems/survival/items.js), so
// registerCustomTemplates takes them and the frozen DFU table stays
// what it is. Nothing here writes to itemTemplates.json.

import { registerCustomTemplates, templateByIndex, mintCondition, setItemFields } from './itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from './textureReplacement.js';
import { registerUniqueFind, registerLegendary } from './lootRarity.js';
import { SKILLS } from './skills.js';
// The indices live in a LEAF (characters/thunderlockIds.js) because
// characters/weapons.js needs them too and importing this file from
// there would close a cycle through systems/itemTemplates.js. Said out
// loud on the leaf itself.
import {
  THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE, THUNDERLOCK_ARCHIVE, PELLET_ARCHIVE,
} from '../characters/thunderlockIds.js';

/** The two indices, from the leaf that holds them - re-exported so
 *  this file is still the weapon's one front door. NOT wrapped in a
 *  `TEMPLATE` object: systems/survival/food.js already exports that
 *  name with other numbers in it, and one name meaning two things is
 *  what test/audit24_onehome.test.js's ratchet is for. */
export { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE };

/** The group a weapon must be in for equip, the paperdoll and the
 *  damage laws to treat it as one (ItemGroups.Weapons). */
export const WEAPON_GROUP = 'Weapons';

/** The archives its art is registered under - its own, not 234's.
 *  A classic weapon's paperdoll art lives in TEXTURE.234 (233 for
 *  female characters, ApplyWeaponMaterial's tail); this one has no
 *  entry there and no female variant to be off by one from, which is
 *  why characters/paperdollArt.js exempts a custom template from that
 *  subtraction rather than this file pretending to be classic. */
export const ART = Object.freeze({ weaponArchive: THUNDERLOCK_ARCHIVE, ammoArchive: PELLET_ARCHIVE });

/**
 * The rows. Columns are DFU's ItemTemplates.txt's, so every reader
 * that already knows how to read a weapon reads these.
 *
 * `basePrice` 480 puts it above a Long Bow's 20 by two orders - it is
 * a Dwemer machine, not a bent stick - and the pellet at 4 is twice an
 * arrow's 2. `hitPoints` 90 is a shade under a bow's 100: the thing
 * has a firing chamber. `isOneHanded` false, because both hands are on
 * it in the art the lab settled.
 */
export const THUNDERLOCK_TEMPLATES = Object.freeze([
  {
    index: THUNDERLOCK_TEMPLATE,
    name: 'Dwarven Thunderlock',
    baseWeight: 6.0,
    hitPoints: 90,
    basePrice: 480,
    enchantmentPoints: 400,
    rarity: 20,
    drawOrderOrEffect: 100,     // BlitItems' layer - weapons draw last, over the hand
    isBluntWeapon: false,
    isOneHanded: false,
    worldTextureArchive: ART.weaponArchive,
    worldTextureRecord: 0,
    playerTextureArchive: ART.weaponArchive,
    playerTextureRecord: 0,
  },
  {
    index: PELLET_TEMPLATE,
    name: 'Dwemer Pellet',
    baseWeight: 0.2,
    hitPoints: 1,
    basePrice: 4,
    enchantmentPoints: 150,
    rarity: 10,
    drawOrderOrEffect: 0,
    stackable: true,
    isNotRepairable: true,
    hasNoEncumbrance: false,    // an arrow weighs nothing in classic; a lead ball does not
    worldTextureArchive: ART.ammoArchive,
    worldTextureRecord: 0,
    playerTextureArchive: 0,    // ammunition is never worn - the arrow's own 0
    playerTextureRecord: 0,
  },
]);
registerCustomTemplates(THUNDERLOCK_TEMPLATES);

export const isThunderlock = (item) => item?.templateIndex === THUNDERLOCK_TEMPLATE;
export const isPellet = (item) => item?.templateIndex === PELLET_TEMPLATE;

/** THE AMMUNITION LINK lives on the leaf (see the file) - inventory.js
 *  is upstream of everything here and asks it too. Re-exported so this
 *  file stays the weapon's front door. */
export { ammoTemplateFor } from '../characters/thunderlockIds.js';

/** The skill a hit with it is scored on - Mac's call, and the reason
 *  characters/weapons.js names this template in WEAPON_SKILL_USED. */
export const THUNDERLOCK_SKILL = SKILLS.Archery;

/**
 * Its damage span, in the shape CalculateWeaponMin/MaxDamage answers.
 *
 * A Long Bow is 4-18 and a Dai-Katana 3-21, which are the ceilings
 * classic sets. This sits at 7-26: harder than anything classic per
 * shot, and paid for everywhere else - it is the heaviest weapon in
 * the game at 6kg, it spends ammunition that costs twice an arrow, and
 * its cycle is the bow's cooldown plus a reload the eye can see. A
 * weapon that hits like this and fired like a dagger would not be a
 * new weapon type, it would be the end of the others.
 */
export const THUNDERLOCK_DAMAGE = Object.freeze({ min: 7, max: 26 });

/** Mint one. Material rides the classic weapon ladder (the dye and
 *  the damage modifier both read it), defaulting to Dwarven because
 *  that is what it is. */
export function createThunderlock({ material = 4, condition = null } = {}) {
  const item = mintCondition(setItemFields({
    group: WEAPON_GROUP, templateIndex: THUNDERLOCK_TEMPLATE,
    material, flags: 0, variant: 0, message: 0, stackCount: 1,
  }));
  if (condition != null) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? condition, condition));
  return item;
}

/** Mint a stack of pellets. Material None (0), as CreateWeapon's arrow
 *  arm does - ammunition takes no metal ladder. */
export function createPellets(stackCount = 20) {
  return mintCondition(setItemFields({
    group: WEAPON_GROUP, templateIndex: PELLET_TEMPLATE,
    material: 0, flags: 0, variant: 0, message: 0,
    stackCount: Math.max(1, stackCount | 0),
  }));
}

/** How many pellets a pack is carrying. */
export function pelletCount(items) {
  let n = 0;
  for (const it of items ?? []) if (isPellet(it)) n += Math.max(0, it.stackCount ?? 1);
  return n;
}

/** Spend one. Answers whether there was one to spend, so a caller can
 *  refuse the shot on false rather than firing a blank. */
export function spendPellet(items) {
  const list = items ?? [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (!isPellet(it)) continue;
    const n = Math.max(0, it.stackCount ?? 1);
    if (n <= 0) continue;
    it.stackCount = n - 1;
    if (it.stackCount <= 0) list.splice(i, 1);
    return true;
  }
  return false;
}

/** The art: our own PNGs, through the same vendor-texture door the
 *  survival mod's icons come in by. Record 0 of each archive.
 *
 *  ONE SPRITE, TWO JOBS (characters/paperdollArt.js): the paperdoll
 *  layer and the inventory icon are the same record, which is why
 *  gun-paperdoll.png carries the hand gap and why the icon has a notch
 *  in it - it is a doll layer being shown in a list. */
export const ICON_FILES = Object.freeze([
  { archive: ART.weaponArchive, record: 0, frame: 0, file: 'gun-paperdoll.png' },
  { archive: ART.ammoArchive, record: 0, frame: 0, file: 'gun-ammo.png' },
]);

export const iconUrl = (file) => new URL(`art/${file}`, globalThis.document?.baseURI ?? 'http://localhost/').href;

let _installed = false;
/** Register the icons once. `fetchBytes` is the test's door. */
export function installThunderlockIcons({ fetchBytes = null } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;
  _installed = true;
  const load = fetchBytes ?? (async (name) => {
    const r = await fetch(iconUrl(name));
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  return addVendorTextures(ICON_FILES.map(({ archive, record, frame, file }) => ({
    archive, record, frame, fileName: file, load: () => load(file),
  })));
}

// ── HOW YOU GET ONE ─────────────────────────────────────────────────
//
// Mac: "This weapon wont be available for purchase and should be one
// of the rarest items to find in the game."
//
// NOT FOR SALE, and that takes no code: a shop's shelf is built from
// GROUP_TEMPLATE_INDICES, which is DFU's own enum table, and a custom
// template is not in it. The survival mod had to ADD its provisions to
// the shelves deliberately; this one simply never appears there.
// test/thunderlock.test.js pins that as a law rather than an accident.
//
// FOUND, THEN, and by the port's own loot ladder (systems/lootRarity.js
// LR1-LR5). It registers as a UNIQUE FIND, which is a different
// question from a rarity tier: a tier decorates an item DFU's loot
// roll already produced, and no DFU roll can produce this weapon at
// all. So it is its own roll - once per loot list, adding rather than
// promoting - and it begins at NOTHING below source tier 4. A rat in a
// shallow crypt cannot drop it at any luck; the Daedra Lord at the
// bottom of a Volcanic Cave is what the number is for.
//
// IT ARRIVES LOADED. A gun found with no ammunition is a gun the
// player cannot fire and cannot buy shot for, which reads as a broken
// drop rather than a rare one. The find mints a handful of pellets
// with it - few enough that the weapon still sends you looking.
export const FIND_MIN_TIER = 4;
export const FIND_PELLETS = Object.freeze({ min: 6, max: 18 });

registerUniqueFind({
  id: 'dwarven-thunderlock',
  minTier: FIND_MIN_TIER,
  weight: 1,
  mint: (rolls = Math.random) => {
    const n = FIND_PELLETS.min + Math.floor(rolls() * (FIND_PELLETS.max - FIND_PELLETS.min + 1));
    return [createThunderlock(), createPellets(n)];
  },
});

/** And its LEGENDARY record, for the roll that finds one and then
 *  rolls it up: the named, storied one. The affixes are the weapon's
 *  own case - it is already the hardest hitter, so its signature is
 *  what it does to the user rather than more damage. */
registerLegendary({
  id: 'the-last-lock', name: 'The Last Lock', group: WEAPON_GROUP, templates: [THUNDERLOCK_TEMPLATE],
  exclusive: true,   // a gun does not roll up as a blade forged for a dragon hunt
  affixes: [
    { id: 'damage', value: 20 },
    { id: 'stat', param: 'agility', value: 10 },
    { id: 'skill', param: 33, value: 30 },   // Archery
  ],
  enchantment: { type: 3, param: 20 },   // CastWhenStrikes - the shot carries a spell
  lore: 'The Dwemer left no instructions and no second one.',
});
