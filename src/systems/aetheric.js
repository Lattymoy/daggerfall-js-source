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
//
// ═══ RAID4b: THE RAIDING PARTIES' OWN (2026-09-28) ════════════════
//
// Mac, on World Events - Raiding Parties online: "3. We can also add
// renown and it's own atheric + armor sets". Three more Aetheric sets,
// one a raiding party (systems/sigilSets.js 'oath', 'thieftaker',
// 'orcsbane'), nine fixed records each - the nine places, a one-handed
// weapon and a shield worn together - of the party's own make: the
// knights' Mithril, the bandits' Elven, the orcs' own Orcish (the horde's
// metal turned on it). A town defended pays them (systems/raidSpoils.js,
// off the relay's receipt), never a drop, a shelf or the Broker. Their
// three affixes stand at the Legendary band's FLOOR (the Regalia's are
// its top: a boss's set over a town's thanks), and a weapon's blow at
// the Legendary band's floor too. EVERY RECORD NAMES ITS MAKE, and the
// wire's check (validSetMarks) holds each to its own.
//
// ═══ SERPENT-SET: THE OLD COIL'S OWN (2026-10-05) ═════════════════
//
// Mac: "The serpent boss needs to use the currency from oblivion gate
// and have its own equipment rewards". One more Aetheric set,
// Sethrakul's Coilscale (systems/sigilSets.js 'coilscale'): nine fixed
// records of Ebony - the deep's own black - a one-handed Katana and a
// shield among them. Its affixes and its blow stand at the Legendary
// band's MIDDLE: a world boss at sea, over a town's thanks and under
// the gate's Warden. A ship that dealt the serpent its share finds a
// piece in its hoard SERPENT_SET_CHANCE of the time
// (systems/serpentSpoils.js), rolled after everything the hoard rolled
// before; no drop, shelf or Broker carries it, as no raid set's is.
//
// SD9d (2026-10-07, the Super Dungeons arc): and THE BRASS OF NUMIDIUM
// (systems/sigilSets.js 'numidium'), what the Warp kept of the Walking
// Brass: nine fixed records of Dwarven make - the Dwemer's brass - a
// round shield and a one-handed Longsword among them, every number at
// the Legendary band's TOP, as the Regalia's (the hardest fight in the
// game). The Brass Remnant's spoils carry a piece NUMIDIUM_SET_CHANCE
// of the time, rolled after everything they rolled before.
// ═══════════════════════════════════════════════════════════════════

import { setItemFields, mintCondition, itemBaseValue } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { affixesWorth, validAffix, AFFIX_RANGES, registerAethericLore } from './lootRarity.js';
import { SKILLS } from './skills.js';
import { SIGIL_POWER_MAX, SIGIL_BANDS } from './sigil.js';
import { setPieceKind, setById, raidSetOf } from './sigilSets.js';   // AUDIT SET D6: the kinds a set counts, for the wire's cross-check

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
/** A record: its id, name, group and template, its set, its MAKE (a material's name - ARMOR_MATERIAL's and
 *  WEAPON_MATERIALS' own), a weapon's blow, its affixes and its lore. */
const record = (id, name, group, templateIndex, set, make, power, affixes, lore) => Object.freeze({
  id, name, group, templateIndex, set, make, ...(group === 'Weapons' ? { power } : {}),
  affixes: Object.freeze(affixes.map((a) => Object.freeze(a))), lore,
});
const rec = (id, name, group, templateIndex, affixes, lore) => record(id, name, group, templateIndex, REGALIA_SET, 'Daedric', SIGIL_POWER_MAX, affixes, lore);

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

// ── RAID4b: the raiding parties' own ────────────────────────────────
/** The raid sets' numbers: the Legendary band's floor, per affix kind, and a weapon's blow. */
const floor = (id) => AFFIX_RANGES[id].legendary[0];
export const RAID_SET_POWER = SIGIL_BANDS.legendary[0];
const a = (id, param) => (param === undefined ? { id, value: floor(id) } : { id, param, value: floor(id) });
const raidRec = (set, make) => (key, name, group, templateIndex, affixes, lore) => record(`${set}-${key}`, name, group, templateIndex, set, make, RAID_SET_POWER, affixes, lore);
const oath = raidRec('oath', 'Mithril'), taker = raidRec('thieftaker', 'Elven'), orcs = raidRec('orcsbane', 'Orcish');
/** THE RAIDING PARTIES' SETS, nine a set in the places' order (the body, the shield, the weapon): the Broken Oath (the
 *  knights'), the Thief-Taker's Garb (the bandits'), Orcsbane Harness (the orcs'). */
export const RAID_SET_PIECES = Object.freeze([
  oath('helm', "The Oathkeeper's Helm", 'Armor', 107, [a('armor'), a('stat', 'willpower'), a('resist', 'magic')],
    'Its visor was shut on a vow. The knight who broke it never lifted it again.'),
  oath('right-pauldron', 'Oathbound Right Pauldron', 'Armor', 106, [a('armor'), a('stat', 'strength'), a('resist', 'shock')],
    'The order\'s crest is filed away, all but one stubborn talon.'),
  oath('left-pauldron', 'Oathbound Left Pauldron', 'Armor', 105, [a('armor'), a('stat', 'endurance'), a('resist', 'frost')],
    'It still bears the dent of the blow that ended a knighthood.'),
  oath('cuirass', "The Watch-Captain's Cuirass", 'Armor', 102, [a('armor'), a('stat', 'willpower'), a('stat', 'endurance')],
    'Taken from a raider who swore to guard this town once, and came back to burn it.'),
  oath('gauntlets', 'Gauntlets of the Sworn', 'Armor', 103, [a('armor'), a('stat', 'strength'), a('skill', SKILLS.LongBlade)],
    'Clasped hands were pressed into them on the day of the oath.'),
  oath('greaves', 'Greaves of the Last Stand', 'Armor', 104, [a('armor'), a('stat', 'endurance'), a('weight')],
    'The town\'s smith hammered the mud of its square into them.'),
  oath('boots', 'Boots of the Long Watch', 'Armor', 108, [a('armor'), a('stat', 'speed'), a('resist', 'poison')],
    'They have walked every wall in the Bay, and never away from one.'),
  oath('kite-shield', 'The Last Oath', 'Armor', 111, [a('armor'), a('stat', 'willpower'), a('resist', 'magic')],
    'The words of the oath run round its rim. Someone has scratched out the last line.'),
  oath('longsword', 'Oathsunder', 'Weapons', 120, [a('damage'), a('stat', 'strength'), a('skill', SKILLS.LongBlade)],
    'The blade an oathbreaker carried into a town that trusted him. It serves the town now.'),
  taker('helm', "The Thief-Taker's Helm", 'Armor', 107, [a('armor'), a('stat', 'agility'), a('skill', SKILLS.Streetwise)],
    'Every fence in the Bay knows its shape, and leaves by the back door.'),
  taker('right-pauldron', "Warrant-Bearer's Right Pauldron", 'Armor', 106, [a('armor'), a('stat', 'speed'), a('skill', SKILLS.Archery)],
    'A reeve\'s seal is pressed into the leather beneath the plate.'),
  taker('left-pauldron', "Warrant-Bearer's Left Pauldron", 'Armor', 105, [a('armor'), a('stat', 'agility'), a('skill', SKILLS.Dodging)],
    'Light enough to run in, which is the whole of the trade.'),
  taker('cuirass', "The Thief-Taker's Cuirass", 'Armor', 102, [a('armor'), a('stat', 'speed'), a('resist', 'poison')],
    'Cut from the mail of a bandit captain who did not run fast enough.'),
  taker('gauntlets', 'Collaring Gauntlets', 'Armor', 103, [a('armor'), a('stat', 'agility'), a('skill', SKILLS.CriticalStrike)],
    'Made for a grip no cutpurse has ever twisted out of.'),
  taker('greaves', 'Chase-Greaves', 'Armor', 104, [a('armor'), a('stat', 'speed'), a('skill', SKILLS.Running)],
    'Elven work, and quiet. The quarry hears them only at the end.'),
  taker('boots', 'Boots of the Long Pursuit', 'Armor', 108, [a('armor'), a('stat', 'agility'), a('skill', SKILLS.Jumping)],
    'Their soles are worn smooth on the rooftops of three cities.'),
  taker('buckler', "The Reeve's Buckler", 'Armor', 109, [a('armor'), a('stat', 'agility'), a('resist', 'shock')],
    'Small enough to run with, stout enough to end the running.'),
  taker('saber', "The Reeve's Warrant", 'Weapons', 119, [a('damage'), a('stat', 'agility'), a('skill', SKILLS.LongBlade)],
    'Its edge is the only warrant a bandit in the Bay ever reads.'),
  orcs('helm', 'Tusk-Crest Helm', 'Armor', 107, [a('armor'), a('stat', 'endurance'), a('resist', 'poison')],
    'Crowned with the tusks of the warlord who led the raid.'),
  orcs('right-pauldron', 'Orcsbane Right Pauldron', 'Armor', 106, [a('armor'), a('stat', 'strength'), a('skill', SKILLS.BluntWeapon)],
    'Beaten from the horde\'s own blades, and heavier for it.'),
  orcs('left-pauldron', 'Orcsbane Left Pauldron', 'Armor', 105, [a('armor'), a('stat', 'endurance'), a('resist', 'frost')],
    'Its rivets are orc arrowheads, driven home.'),
  orcs('cuirass', "The Horde-Breaker's Cuirass", 'Armor', 102, [a('armor'), a('stat', 'endurance'), a('stat', 'strength')],
    'The horde broke against the one who wore it, and did not come back.'),
  orcs('gauntlets', 'Knuckle-Breaker Gauntlets', 'Armor', 103, [a('armor'), a('stat', 'strength'), a('skill', SKILLS.CriticalStrike)],
    'Orcish iron over the knuckles, and nothing gentle under it.'),
  orcs('greaves', 'Orcsbane Greaves', 'Armor', 104, [a('armor'), a('stat', 'endurance'), a('weight')],
    'Made to hold ground, not to give it.'),
  orcs('boots', 'Boots of the Held Gate', 'Armor', 108, [a('armor'), a('stat', 'willpower'), a('resist', 'fire')],
    'They stood in the town gate while it burned, and the gate held.'),
  orcs('round-shield', "The Warlord's Last Sight", 'Armor', 110, [a('armor'), a('stat', 'endurance'), a('resist', 'magic')],
    'Its boss is a warlord\'s helm, hammered flat.'),
  orcs('mace', 'The Tuskbreaker', 'Weapons', 124, [a('damage'), a('stat', 'strength'), a('skill', SKILLS.BluntWeapon)],
    'Flanged with Orcish steel. It has broken more tusks than any smith can count.'),
]);
// ── SERPENT-SET: the Old Coil's own ────────────────────────────────
/** SERPENT-SET: the Coilscale's numbers - the Legendary band's MIDDLE, per affix kind (over a town's thanks at its floor,
 *  under the gate's Warden at its top: a world boss at sea), and a weapon's blow the band's middle too. */
const mid = (id) => Math.round((AFFIX_RANGES[id].legendary[0] + AFFIX_RANGES[id].legendary[1]) / 2);
export const SERPENT_SET_POWER = Math.round((SIGIL_BANDS.legendary[0] + SIGIL_BANDS.legendary[1]) / 2);
const m = (id, param) => (param === undefined ? { id, value: mid(id) } : { id, param, value: mid(id) });
const coil = (key, name, group, templateIndex, affixes, lore) => record(`coilscale-${key}`, name, group, templateIndex, 'coilscale', 'Ebony', SERPENT_SET_POWER, affixes, lore);
/** SERPENT-SET: SETHRAKUL'S COILSCALE, nine in the places' order (the body, the shield, the weapon) - Ebony, the deep's own
 *  black; a one-handed Katana, so the shield is worn with it and all nine places fill at once. One resistance of an
 *  element at most, and never frost (Sea-Scale's tier carries it): no two pieces stack an element toward the saving
 *  throw's immunity (the Regalia's AUDIT FINAL lesson). */
export const SERPENT_SET_PIECES = Object.freeze([
  coil('crest', "Sethrakul's Crest", 'Armor', 107, [m('armor'), m('stat', 'willpower'), m('resist', 'shock')],
    'Cut from the crest the Old Coil raised before it struck. It still rises in a storm.'),
  coil('right-pauldron', 'Coilscale Right Pauldron', 'Armor', 106, [m('armor'), m('stat', 'strength'), m('skill', SKILLS.Swimming)],
    'Each scale is the size of a hand, and no two lie the same way.'),
  coil('left-pauldron', 'Coilscale Left Pauldron', 'Armor', 105, [m('armor'), m('stat', 'endurance'), m('resist', 'poison')],
    'The venom that pooled under it dried to a green glaze.'),
  coil('hide', "The Old Coil's Hide", 'Armor', 102, [m('armor'), m('stat', 'endurance'), m('stat', 'willpower')],
    'A ring of the serpent\'s shed skin, turned to plate by the sea.'),
  coil('grip', "Constrictor's Grip", 'Armor', 103, [m('armor'), m('stat', 'strength'), m('skill', SKILLS.LongBlade)],
    'They close slowly, and they do not open again until it is over.'),
  coil('greaves', 'Undertow Greaves', 'Armor', 104, [m('armor'), m('stat', 'agility'), m('weight')],
    'Heavy as the deep, and they never drag.'),
  coil('boots', 'Tide-Walker Boots', 'Armor', 108, [m('armor'), m('stat', 'speed'), m('skill', SKILLS.Running)],
    'Sailors say the one who wears them walks out of any wreck.'),
  coil('shield', "The Maelstrom's Eye", 'Armor', 111, [m('armor'), m('stat', 'endurance'), m('resist', 'magic')],
    'A whorl of scales at its boss turns a blade as the maelstrom turns a ship.'),
  coil('fang', "Sethrakul's Fang", 'Weapons', 121, [m('damage'), m('stat', 'agility'), m('skill', SKILLS.LongBlade)],
    'A fang of the Old Coil, ground to an edge by a Hammerfell smith who would not say how.'),
]);
// ── SD9d: THE BRASS OF NUMIDIUM ─────────────────────────────────────
/** SD9d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): the Brass Remnant's own,
 *  nine in the places' order - the seven body pieces, a round shield (a gear's face) and a ONE-HANDED Longsword, so all
 *  nine are worn at once - Dwarven, the Dwemer's brass. The hardest fight in the game pays what the gate's Warden does:
 *  every affix at the Legendary band's TOP (the Regalia's), the blow the sigil's greatest. One resistance of an element at
 *  most, and never magic or shock (Dwemer Brass, the set's 2-piece tier, carries those): no two pieces stack an element
 *  toward the saving throw's immunity (the Regalia's AUDIT FINAL lesson). */
const t = (id, param) => (param === undefined ? { id, value: top(id) } : { id, param, value: top(id) });
const brass = (key, name, group, templateIndex, affixes, lore) => record(`numidium-${key}`, name, group, templateIndex, 'numidium', 'Dwarven', SIGIL_POWER_MAX, affixes, lore);
export const NUMIDIUM_SET_PIECES = Object.freeze([
  brass('visage', 'The Brass Visage', 'Armor', 107, [t('armor'), t('stat', 'intelligence'), t('resist', 'fire')],
    'The face the Walking Brass turned on the Bay. Its eyes are cold now, and they still look out.'),
  brass('right-pauldron', 'Right Pauldron of the Walking Brass', 'Armor', 106, [t('armor'), t('stat', 'strength'), t('skill', SKILLS.LongBlade)],
    'Every rivet is a Dwemer smith\'s mark, and no two smiths are the same.'),
  brass('left-pauldron', 'Left Pauldron of the Walking Brass', 'Armor', 105, [t('armor'), t('stat', 'endurance'), t('resist', 'frost')],
    'It kept the cold of a thousand years under the mountain, and gave none of it back.'),
  brass('heartcage', 'The Heartcage', 'Armor', 102, [t('armor'), t('stat', 'willpower'), t('skill', SKILLS.Mysticism)],
    'It caged a heart of shattered soul-gem light. It is warm, and it beats.'),
  brass('hands', "The Tonal Architect's Hands", 'Armor', 103, [t('armor'), t('stat', 'agility'), t('skill', SKILLS.CriticalStrike)],
    'Cut to the hands of the one who sang the Brass awake.'),
  brass('greaves', 'Greaves of the Unmade Stride', 'Armor', 104, [t('armor'), t('stat', 'speed'), t('resist', 'poison')],
    'They stepped across a Dragon Break and came out on the other side.'),
  brass('boots', 'Boots of the Unmoored Step', 'Armor', 108, [t('armor'), t('stat', 'luck'), t('skill', SKILLS.Jumping)],
    'Made for a road over nothing. They never miss a step.'),
  brass('gear-face', 'The Gear-Face', 'Armor', 110, [t('armor'), t('stat', 'endurance'), t('weight')],
    'A gear of the Walking Brass, its teeth filed round. It still turns when no one is looking.'),
  brass('hour-hand', 'The Hour-Hand', 'Weapons', 120, [t('damage'), t('stat', 'strength'), t('skill', SKILLS.LongBlade)],
    'Broken from the colossus\'s heart-clock. It points at what is about to end.'),
]);
/** EVERY AETHERIC RECORD - the Regalia, then the raiding parties', then (SERPENT-SET) the Old Coil's, then (SD9d) the
 *  Walking Brass's - and the one every reader asks. */
export const AETHERIC_RECORDS = Object.freeze([...REGALIA, ...RAID_SET_PIECES, ...SERPENT_SET_PIECES, ...NUMIDIUM_SET_PIECES]);
export const aethericById = (id) => AETHERIC_RECORDS.find((r) => r.id === id) ?? null;
registerAethericLore((item) => aethericById(item?.aetheric)?.lore ?? null);   // the card's last line, as a Legendary's
/** A record's make as the item wears it: its material's id in its group's table. */
export const aethericMaterial = (r) => (r.group === 'Weapons' ? WEAPON_MATERIALS[r.make] : ARMOR_MATERIAL[r.make]);
/** Is this an Aetheric piece (its tier's own field)? */
export const isAetheric = (item) => item?.rarity === AETHERIC;

/**
 * Mint a record as an item: its make (the Regalia's Daedric; RAID4b a raid set's own) through the game's own minters
 * (a weapon's CreateWeapon, a piece of armour's SetItem and its condition), its name, its tier, its affixes (a copy),
 * KNOWN, its set's sigil fresh at Faint (a weapon's with its record's blow too - the Gatecleaver's the widest band's
 * top), and its price. A fresh item every call.
 * @param {{ id: string, name: string, group: string, templateIndex: number, set: string, make: string, power?: number, affixes: readonly any[] }} r
 * @param {{ party?: number }} [opts]
 */
export function mintAetheric(r, { party = 1 } = {}) {
  const item = r.group === 'Weapons'
    ? createWeapon(r.templateIndex, aethericMaterial(r))
    : mintCondition(setItemFields({ group: 'Armor', templateIndex: r.templateIndex, material: aethericMaterial(r), flags: 0 }));
  const affixes = r.affixes.filter(validAffix).map((a) => ({ ...a }));
  item.name = r.name;
  item.rarity = AETHERIC;
  item.aetheric = r.id;
  item.affixes = affixes;
  item.isIdentified = true;
  item.sigil = r.group === 'Weapons' ? { power: r.power, set: r.set, party, xp: 0 } : { set: r.set, party, xp: 0 };
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
 *  - RAID4b: every Aetheric set's (the raiding parties' too) only on an Aetheric piece; the piece of the record's own
 *    MAKE (a raid set's Mithril, Elven or Orcish - the Regalia's Daedric), and a set's sigil on it the record's set;
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
    if (setById(s.set)?.aetheric && item.rarity !== AETHERIC) return null;   // RAID4b: every Aetheric set's, the Regalia's too
    item.sigil = { ...(s.power !== undefined ? { power: s.power } : {}), ...(s.set !== undefined ? { set: s.set } : {}), party: s.party, xp: s.xp };
  }
  if (item.rarity === AETHERIC || item.aetheric != null) {
    const r = aethericById(item.aetheric);
    if (!r || item.rarity !== AETHERIC || r.group !== item.group || r.templateIndex !== item.templateIndex) return null;
    if (item.material !== aethericMaterial(r)) return null;
    if (item.sigil?.set !== undefined && item.sigil.set !== r.set) return null;   // RAID4b: its own set, never another's
    // AUDIT SETS L6: AND ITS AFFIXES AND BLOW ITS RECORD'S - the kinds the record's, in its order, none past the record's
    // value (the Regalia's past the band's own top alone: its fire stood at the band's top until 322370d2, and a piece
    // minted then is no forgery), and a weapon's blow the record's own. A modified client traded an oath-helm carrying
    // top-of-band affixes and every card and fold believed them.
    const want = r.affixes.filter(validAffix), have = Array.isArray(item.affixes) ? item.affixes : [];
    if (have.length !== want.length) return null;
    for (let i = 0; i < want.length; i++) {
      const a = have[i];
      if (a?.id !== want[i].id || (a.param ?? null) !== (want[i].param ?? null)) return null;
      if (r.set !== REGALIA_SET && !(a.value <= want[i].value)) return null;
    }
    if (item.sigil?.power !== undefined && item.sigil.power !== r.power) return null;
  }
  return item;
}

/** THE DROP'S ROLL, the spoils' last: null most times; else one Regalia piece, the same seed choosing which. One roll
 *  when nothing drops, two when a piece does. */
export function rollRegalia(rolls = Math.random) {
  if (!(rolls() < REGALIA_CHANCE)) return null;
  return mintAetheric(REGALIA[Math.min(REGALIA.length - 1, Math.floor(rolls() * REGALIA.length))]);
}

/** RAID4b: the share of a town's thanks that carries a piece of the raiding party's own set. */
export const RAID_SET_CHANCE = 1 / 4;
/** RAID4b: the records of the set a raiding party's raids pay (the receipt's `y`) - [] for no such party. */
export const raidSetPieces = (party) => { const set = raidSetOf(party); return set ? RAID_SET_PIECES.filter((r) => r.set === set.id) : []; };
/** RAID4b, THE THANKS' LAST ROLL (systems/raidSpoils.js): null most times; else one piece of the party's own set, the
 *  same seed choosing which. One roll when nothing drops, two when a piece does; none at all for no such party. */
export function rollRaidSetPiece(party, rolls = Math.random) {
  const recs = raidSetPieces(party);
  if (!recs.length || !(rolls() < RAID_SET_CHANCE)) return null;
  return mintAetheric(recs[Math.min(recs.length - 1, Math.floor(rolls() * recs.length))]);
}

/** SERPENT-SET: the share of a hoard - a ship that DEALT Sethrakul its share - that carries a piece of the Coilscale: a
 *  town's thanks' own share (RAID_SET_CHANCE), the set being the serpent's alone (no drop, shelf or Broker carries it). */
export const SERPENT_SET_CHANCE = RAID_SET_CHANCE;
/** SERPENT-SET, THE HOARD'S LAST ROLL (systems/serpentSpoils.js, after everything it rolled before - every earlier
 *  hoard stays what it was for its seed): null most times; else one Coilscale piece, the same seed choosing which. One
 *  roll when nothing drops, two when a piece does. */
export function rollSerpentSetPiece(rolls = Math.random) {
  if (!(rolls() < SERPENT_SET_CHANCE)) return null;
  return mintAetheric(SERPENT_SET_PIECES[Math.min(SERPENT_SET_PIECES.length - 1, Math.floor(rolls() * SERPENT_SET_PIECES.length))]);
}

/** SD9d: the share of the Brass Remnant's spoils that carries a piece of the Brass of Numidium - a third (the design's: the
 *  hardest fight, the rarest feat - a Hollow rises after a rest and falls once). */
export const NUMIDIUM_SET_CHANCE = 1 / 3;
/** SD9d, THE SPOILS' LAST ROLL (systems/sdSpoils.js, after everything they rolled before - every earlier spoils stays what
 *  it was for its seed): null most times; else one Numidium piece, the same seed choosing which. One roll when nothing
 *  drops, two when a piece does. */
export function rollNumidiumPiece(rolls = Math.random) {
  if (!(rolls() < NUMIDIUM_SET_CHANCE)) return null;
  return mintAetheric(NUMIDIUM_SET_PIECES[Math.min(NUMIDIUM_SET_PIECES.length - 1, Math.floor(rolls() * NUMIDIUM_SET_PIECES.length))]);
}
