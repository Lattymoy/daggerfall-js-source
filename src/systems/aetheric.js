// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SET6 (2026-09-26) — AETHERIC, AND RUHN'S REGALIA.
//
// Mac: "Boss kills has the chance of dropping a rare boss themed
// weapon/armor set with the rarity Atheric (new)". Design, and the
// record of every slice: bible/11-Multiplayer/Sigil-Sets.md section 6.
//
// ═══ AETHERIC ══════════════════════════════════════════════════════
//
// The ladder's top rung under Artifact (systems/lootRarity.js RARITIES:
// rank 4, the artifact's moved to 5): a colour of its own - the aether's
// pale blue-white - a pip, a frame, a price. NOTHING ROLLS IT: the
// ladder's roll (applyRarity) takes the rolled tiers alone, so no drop,
// pile or shelf ever lands on it. It is the boss's (the drop, below)
// and the Broker's (SET7). An Aetheric piece carries no DFU enchantment
// - its affixes and its sigil are the port's own - so it drops KNOWN,
// and when it breaks it stays, repairable (PCAAO's fading module takes
// only an enchanted piece: combat/pcaao.js pcaaoFades).
//
// ═══ RUHN'S REGALIA ════════════════════════════════════════════════
//
// The set of Valkynaz Ruhn, Warden of the Burning Gate: nine pieces of
// Daedric make - the nine places a set is worn - each a FIXED RECORD
// (a name, a line of lore, three affixes at the TOP of the Legendary
// band) wearing a sigil of its own set (systems/sigilSets.js 'ruhn',
// whose tiers are the Burning Gate, Cleave and the Wrath of the
// Warden). The Gatecleaver is a set weapon and carries the widest
// band's top blow as well (SIGIL_POWER_MAX) - a BATTLE AXE, Daggerfall's
// one-handed axe (the War Axe takes both hands: characters/equipRules.js
// WEAPON_HANDS), so it and the Gate-Shield are worn together and all
// nine places can be filled at once. Each is minted fresh at
// Faint, won in a fight of one: the spoils are rolled for one player
// off their own receipt, which knows no fight's size.
//
// ═══ THE DROP ══════════════════════════════════════════════════════
//
// A kill's spoils (systems/gateSpoils.js rollSpoils) roll ONE MORE THING
// after everything they rolled before - so every earlier spoils, gold
// to the last Magic piece, stays exactly what it was for its seed: a
// Regalia piece REGALIA_CHANCE of the time, which one by the same seed.
// ═══════════════════════════════════════════════════════════════════

import { setItemFields, mintCondition, itemBaseValue } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { affixesWorth, validAffix, AFFIX_RANGES, registerAethericLore } from './lootRarity.js';
import { SKILLS } from './skills.js';
import { SIGIL_POWER_MAX } from './sigil.js';
import { setPieceKind } from './sigilSets.js';   // AUDIT SET D6: the kinds a set counts, for the wire's cross-check

/** The tier's id, as `item.rarity` wears it. */
export const AETHERIC = 'aetheric';
/** What an Aetheric piece adds to its price, over its make and its affixes - a flat sum, as a Rare's flavour's is. */
export const AETHERIC_WORTH = 2500;
/** The share of a kill's spoils that carries a Regalia piece. */
export const REGALIA_CHANCE = 1 / 6;
/** The set the Regalia wears. */
export const REGALIA_SET = 'ruhn';

/** The top of the Legendary band, per affix kind - every Regalia number is one, but the gate's fire. */
const top = (id) => AFFIX_RANGES[id].legendary[1];
/** AUDIT FINAL (Mac: "Lower per piece"): THE GATE'S FIRE, +10 A PIECE - not the band's top. At +50 an armour piece, any
 *  two worn made a fire saving throw of 100 (spellcast.js: total immunity), and the Burning Gate tier's own +15 to +45
 *  meant nothing. Eight pieces now carry +80, and the tier's fire is what takes a full Regalia past immunity. */
export const REGALIA_FIRE_RESIST = 10;
const armor = () => ({ id: 'armor', value: top('armor') });
const fire = () => ({ id: 'resist', param: 'fire', value: REGALIA_FIRE_RESIST });
const stat = (param) => ({ id: 'stat', param, value: top('stat') });
const rec = (id, name, group, templateIndex, affixes, lore) => Object.freeze({
  id, name, group, templateIndex, set: REGALIA_SET, affixes: Object.freeze(affixes.map((a) => Object.freeze(a))), lore,
});

/** THE REGALIA, in the order a card lists the places (sigilSets.js SET_PLACES: the body, the shield, the weapon). */
export const REGALIA = Object.freeze([
  rec('ruhn-horned-crown', "Ruhn's Horned Crown", 'Armor', 107, [armor(), fire(), stat('willpower')],
    'The horns are a Dremora lord\'s, who knelt too slowly.'),
  rec('ruhn-right-pauldron', "Ruhn's Right Pauldron", 'Armor', 106, [armor(), fire(), stat('strength')],
    'Blackened where the gate\'s fire licked it for an age.'),
  rec('ruhn-left-pauldron', "Ruhn's Left Pauldron", 'Armor', 105, [armor(), fire(), stat('agility')],
    'It turned a thousand blades meant for the Warden.'),
  rec('ruhn-warden-plate', "Ruhn's Warden-Plate", 'Armor', 102, [armor(), fire(), stat('endurance')],
    'Beaten in the gate\'s own heart. It is warm to the touch, always.'),
  rec('ruhn-brand-gauntlets', "Ruhn's Brand-Gauntlets", 'Armor', 103, [armor(), fire(), { id: 'skill', param: SKILLS.CriticalStrike, value: top('skill') }],
    'Mehrunes Dagon\'s brand is pressed into both palms.'),
  rec('ruhn-greaves', "Ruhn's Greaves", 'Armor', 104, [armor(), fire(), { id: 'weight', value: top('weight') }],
    'Their tread scorched the court\'s stones.'),
  rec('ruhn-cinder-boots', "Ruhn's Cinder-Boots", 'Armor', 108, [armor(), fire(), stat('speed')],
    'Ash rises where the wearer walks.'),
  rec('ruhn-gate-shield', "Ruhn's Gate-Shield", 'Armor', 112, [armor(), fire(), { id: 'resist', param: 'magic', value: top('resist') }],
    'A slab of the gate itself, hinges and all.'),
  rec('ruhn-gatecleaver', "Ruhn's Gatecleaver", 'Weapons', 127, [{ id: 'damage', value: top('damage') }, stat('strength'), { id: 'skill', param: SKILLS.Axe, value: top('skill') }],
    'The axe the Warden held the Burning Gate with. Its edge remembers the hinge.'),
]);
export const aethericById = (id) => REGALIA.find((r) => r.id === id) ?? null;
registerAethericLore((item) => aethericById(item?.aetheric)?.lore ?? null);   // the card's last line, as a Legendary's
/** Is this an Aetheric piece (its tier's own field)? */
export const isAetheric = (item) => item?.rarity === AETHERIC;

/**
 * Mint a record as an item: its Daedric make through the game's own minters (a weapon's CreateWeapon, a piece of
 * armour's SetItem and its condition), its name, its tier, its affixes (a copy), KNOWN, its set's sigil fresh at Faint
 * (the Gatecleaver's with the top blow too), and its price. A fresh item every call.
 * @param {{ id: string, name: string, group: string, templateIndex: number, set: string, affixes: readonly any[] }} r
 * @param {{ party?: number }} [opts]
 */
export function mintAetheric(r, { party = 1 } = {}) {
  const item = r.group === 'Weapons'
    ? createWeapon(r.templateIndex, WEAPON_MATERIALS.Daedric)
    : mintCondition(setItemFields({ group: 'Armor', templateIndex: r.templateIndex, material: ARMOR_MATERIAL.Daedric, flags: 0 }));
  const affixes = r.affixes.filter(validAffix).map((a) => ({ ...a }));
  item.name = r.name;
  item.rarity = AETHERIC;
  item.aetheric = r.id;
  item.affixes = affixes;
  item.isIdentified = true;
  item.sigil = r.group === 'Weapons' ? { power: SIGIL_POWER_MAX, set: r.set, party, xp: 0 } : { set: r.set, party, xp: 0 };
  item.value = itemBaseValue(item) + affixesWorth(affixes) + AETHERIC_WORTH;
  return item;
}

/**
 * AUDIT SET D6: THE MARKS AGREE WITH THE ITEM - for an item off the wire (systems/loot.js validLootItem: a shelf, a
 * chest, a body every client in the room lands). Each field's own kind is itemFields.js's; these are the checks no one
 * field can make, and a peer's forged mark failed none of them - a Regalia sigil on any Daedric cuirass was a piece of
 * Ruhn's Regalia to every card and every power:
 *  - a sigil's set only on a piece a set counts (a body piece, a shield, a weapon - sigilSets.js setPieceKind);
 *  - a sigil's power (SIGIL1's blow) only on a weapon, never ammunition - the one kind stampWonWeapons marks;
 *  - the Regalia's set only on an Aetheric piece, and an Aetheric piece only as its record mints it: a record that
 *    exists, on the record's own group and template, Daedric;
 *  - the sigil PROJECTED to its own four keys, so nothing else rides a record every card and power reads.
 * Answers the item (its sigil projected) or null: a forged mark is no item, as a forged affix is none (LR4).
 * @param {any} item an item whose fields are each their declared kind (itemFields.js validItemFields)
 */
export function validSetMarks(item) {
  if (!item || typeof item !== 'object') return null;
  const s = item.sigil;
  if (s != null) {
    const kind = setPieceKind(item);
    if (s.set !== undefined && !kind) return null;
    if (s.power !== undefined && kind !== 'weapon') return null;
    if (s.set === REGALIA_SET && item.rarity !== AETHERIC) return null;
    item.sigil = { ...(s.power !== undefined ? { power: s.power } : {}), ...(s.set !== undefined ? { set: s.set } : {}), party: s.party, xp: s.xp };
  }
  if (item.rarity === AETHERIC || item.aetheric != null) {
    const r = aethericById(item.aetheric);
    if (!r || item.rarity !== AETHERIC || r.group !== item.group || r.templateIndex !== item.templateIndex) return null;
    if (item.material !== (r.group === 'Weapons' ? WEAPON_MATERIALS.Daedric : ARMOR_MATERIAL.Daedric)) return null;
  }
  return item;
}

/** THE DROP'S ROLL, the spoils' last: null most times; else one Regalia piece, the same seed choosing which. One roll
 *  when nothing drops, two when a piece does. */
export function rollRegalia(rolls = Math.random) {
  if (!(rolls() < REGALIA_CHANCE)) return null;
  return mintAetheric(REGALIA[Math.min(REGALIA.length - 1, Math.floor(rolls() * REGALIA.length))]);
}
