// S1: THE SPELL MAKER's EFFECT CATALOG - every effect DFU offers at
// the Spell Maker station, with the group/subgroup names its pickers
// list and the three support flags that decide which spinners the
// settings editor shows (SupportDuration/SupportChance/
// SupportMagnitude, set per effect class under
// Assets/Scripts/Game/MagicAndEffects/Effects/). Keys are the port's
// own `${type},${subType}` classic law, so a picked row drops
// straight into a SPELLS.STD-shaped record.
//
// The COST components live elsewhere (EFFECT_COST_TABLE in
// spellcost.js) and are not the same question: support flags decide
// what the player may SET, cost components decide what is CHARGED.
// DFU keeps them apart too, and they do not always agree (an effect
// can support a component the cost table prices at nothing).
//
// EXCLUSIONS, each verified rather than assumed:
//  - MorphSelf (29,255) carries a classic key but AllowedCraftingStations
//    = None, so the Spell Maker never offers it. That is why 29 is the
//    gap in the sequence.
//  - MageLight is DFU's own demo custom effect - no classic key at all.
//  - Heal Spell Points is PotionMaker-only and sets no classic key.
//  - Charm (34) is CHANCE ONLY here: SupportDuration is commented out
//    in this build of CharmEffect.cs. Kept as the build has it.
//
// THE INERT RESIDUE (recorded departure). The port's effect library
// (systems/effects.js) implements a subset of the classic effects;
// the rest already cast as no-ops for the STOCK spells that use them.
// Offering the full DFU list keeps the maker 1:1, but a player can
// spend real gold on a spell that cannot do anything - so the
// catalog marks which rows the runtime actually honours and the
// window says so. DFU has no such marking; it is the port telling
// the truth about its own residue rather than taking the money quietly.

/** The 8 attributes in DFCareer.Stats order - note PERSONALITY is 5,
 *  ahead of Speed, which is the order the classic subType uses. */
export const STAT_SUBGROUPS = Object.freeze(
  ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck']);

const D = 'duration', C = 'chance', M = 'magnitude';
// [type, subType, group, subgroup, supports]
const ROWS = [
  [0, 255, 'Paralyze', '', [D, C]],
  [1, 0, 'Continuous Damage', 'Health', [D, M]],
  [1, 1, 'Continuous Damage', 'Fatigue', [D, M]],
  [1, 2, 'Continuous Damage', 'Spell Points', [D, M]],
  [2, 255, 'Create Item', '', [D]],
  [3, 0, 'Cure', 'Disease', [C]],
  [3, 1, 'Cure', 'Poison', [C]],
  [3, 2, 'Cure', 'Paralyzation', [C]],
  [4, 0, 'Damage', 'Health', [M]],
  [4, 1, 'Damage', 'Fatigue', [M]],
  [4, 2, 'Damage', 'Spell Points', [M]],
  [5, 255, 'Disintegrate', '', [C]],
  [6, 0, 'Dispel', 'Magic', [C]],
  [6, 1, 'Dispel', 'Undead', [C]],
  [6, 2, 'Dispel', 'Daedra', [C]],
  [8, 0, 'Elemental Resistance', 'Fire', [D, C]],
  [8, 1, 'Elemental Resistance', 'Frost', [D, C]],
  [8, 2, 'Elemental Resistance', 'Poison', [D, C]],
  [8, 3, 'Elemental Resistance', 'Shock', [D, C]],
  [8, 4, 'Elemental Resistance', 'Magicka', [D, C]],
  [12, 255, 'Soul Trap', '', [D, C]],
  [13, 0, 'Invisibility', 'Normal', [D]],
  [13, 1, 'Invisibility', 'True', [D]],
  [14, 255, 'Levitate', '', [D]],
  [15, 255, 'Light', '', [D]],
  [16, 255, 'Lock', '', [C]],
  [17, 255, 'Open', '', [C]],
  [18, 255, 'Regenerate', '', [D, M]],
  [19, 255, 'Silence', '', [D, C]],
  [20, 255, 'Spell Absorption', '', [D, C]],
  [21, 255, 'Spell Reflection', '', [D, C]],
  [22, 255, 'Spell Resistance', '', [D, C]],
  [23, 0, 'Chameleon', 'Normal', [D]],
  [23, 1, 'Chameleon', 'True', [D]],
  [24, 0, 'Shadow', 'Normal', [D]],
  [24, 1, 'Shadow', 'True', [D]],
  [25, 255, 'Slowfall', '', [D]],
  [26, 255, 'Free Action', '', [D]],
  [27, 255, 'Jumping', '', [D]],
  [28, 255, 'Climbing', '', [D]],
  // U42: MorphSelf is a REGISTRY row that the maker never offers -
  // see the exclusions note above. It is here because
  // SetEffectLabels reads EntityEffectBroker.GetEffectTemplate
  // (DaggerfallSpellBookWindow.cs:641), the full registry, not the
  // maker's catalogue: a spellbook holding a 29,255 effect printed
  // "<effect not found>" while it was absent. `craftable: false`
  // keeps it out of the two picker lists, which is what
  // AllowedCraftingStations = None means (MorphSelf.cs:30).
  [29, 255, 'Morph Self', '', [D], false],
  [30, 255, 'Water Breathing', '', [D]],
  [31, 255, 'Water Walking', '', [D]],
  [33, 0, 'Pacify', 'Animal', [C]],
  [33, 1, 'Pacify', 'Undead', [C]],
  [33, 2, 'Pacify', 'Humanoid', [C]],
  [33, 3, 'Pacify', 'Daedra', [C]],
  [34, 255, 'Charm', '', [C]],
  [35, 255, 'Shield', '', [D, M]],
  [39, 0, 'Detect', 'Magic', [D]],
  [39, 1, 'Detect', 'Enemy', [D]],
  [39, 2, 'Detect', 'Treasure', [D]],
  [40, 255, 'Identify', '', [C]],
  [43, 255, 'Teleport', '', []],
  [44, 255, 'Comprehend Languages', '', [D, C]],
];
// the stat/vital families, expanded exactly as DFU's per-stat classes are
const FAMILIES = [
  [7, 'Drain', STAT_SUBGROUPS, [M]],                                  // Drain{Attribute}, 0..7
  [9, 'Fortify Attribute', STAT_SUBGROUPS, [D, M]],                   // Fortify{Attribute}, 0..7
  [10, 'Heal', [...STAT_SUBGROUPS, 'Health', 'Fatigue'], [M]],        // Heal{Attribute} + Health 8 / Fatigue 9
  [11, 'Transfer', [...STAT_SUBGROUPS, 'Health', 'Fatigue'], [M]],    // Transfer{...}, same 0..9
];

/** The keys systems/effects.js really acts on (its predicate arms +
 *  the BUFF_KINDS table + the inline Teleport case). Anything else
 *  falls to that module's `skipped` counter - it casts and does
 *  nothing, for a made spell exactly as for a stock one. */
export const PORTED_KEYS = new Set([
  '0,255',                                                          // Paralyze
  '1,0', '1,1', '1,2',                                              // Continuous Damage {Health,Fatigue,SpellPoints}
  '3,0', '3,1', '3,2',                                              // Cure {Disease,Poison,Paralyzation}
  '4,0', '4,1', '4,2',                                              // Damage {Health,Fatigue,SpellPoints}
  '7,0', '7,1', '7,2', '7,3', '7,4', '7,5', '7,6', '7,7',           // Drain{Attribute}
  '9,0', '9,1', '9,2', '9,3', '9,4', '9,5', '9,6', '9,7',           // Fortify{Attribute}
  '10,0', '10,1', '10,2', '10,3', '10,4', '10,5', '10,6', '10,7', '10,8', '10,9',   // Heal{...}
  '11,0', '11,1', '11,2', '11,3', '11,4', '11,5', '11,6', '11,7', '11,8', '11,9',   // Transfer{...}
  '8,0', '8,1', '8,2', '8,3', '8,4',                                // Elemental Resistance (X1)
  '13,0', '13,1',                                                   // Invisibility (BUFF_KINDS)
  '14,255',                                                         // Levitate
  '16,255', '17,255',                                               // Lock / Open (X1 - armed at cast, fired by the door)
  '18,255',                                                         // Regenerate
  '19,255',                                                         // Silence
  '2,255',                                                          // Create Item (X11b - the picker seam + the conjured lifetime)
  '5,255',                                                          // Disintegrate (X11 - chance, then the no-magnitude save, then the kill)
  '15,255',                                                         // Light (X11 - BUFF_KINDS; the candle is scenes/magicCandle.js)
  '20,255', '21,255', '22,255',                                     // Spell Absorption / Reflection (X11) / Resistance (X1)
  '44,255',                                                         // Comprehend Languages (X11 - the pacification bonus)
  '23,0', '23,1',                                                   // Chameleon
  '24,0', '24,1',                                                   // Shadow
  '25,255',                                                         // Slowfall
  '26,255',                                                         // Free Action
  '27,255',                                                         // Jumping (X1)
  '28,255',                                                         // Climbing (X1)
  '30,255',                                                         // Water Breathing
  '31,255',                                                         // Water Walking
  '6,0', '6,1', '6,2',                                              // Dispel {Magic,Undead,Daedra} (X9 the sweeps, X10 the bundle picker)
  '12,255',                                                         // Soul Trap (X5 - the kill-time re-roll + the gem)
  '33,0', '33,1', '33,2', '33,3',                                   // Pacify {Animal,Undead,Humanoid,Daedra} (X8)
  '34,255',                                                         // Charm (X8 - Pacify Humanoid for enemy CLASSES)
  '35,255',                                                         // Shield (X1 - the damage pool)
  '39,0', '39,1', '39,2',                                           // Detect {Magic,Enemy,Treasure} (X4 - the compass markers)
  '40,255',                                                         // Identify (X7 - the window opener + the per-item roll)
  '43,255',                                                         // Teleport (the inline arm)
]);

/** Every effect the Spell Maker offers: { key, type, subType, group,
 *  subgroup, name, duration, chance, magnitude, ported }. */
export const SPELL_MAKER_EFFECTS = Object.freeze((() => {
  const out = [];
  const push = (type, subType, group, subgroup, supports, craftable = true) => out.push(Object.freeze({
    key: `${type},${subType}`, type, subType, group, subgroup,
    name: subgroup ? `${group} ${subgroup}` : group,     // DisplayName = "{GroupName} {SubGroupName}"
    duration: supports.includes(D), chance: supports.includes(C), magnitude: supports.includes(M),
    ported: PORTED_KEYS.has(`${type},${subType}`),
    // AllowedCraftingStations != None. A false row is in the REGISTRY
    // (so the spellbook can name the effect) and out of the maker's
    // two picker lists.
    craftable,
  }));
  for (const [t, s, g, sub, sup, craft] of ROWS) push(t, s, g, sub, sup, craft);
  for (const [t, g, subs, sup] of FAMILIES) subs.forEach((sub, i) => push(t, i, g, sub, sup));
  return out.sort((a, b) => (a.group === b.group ? a.subType - b.subType : a.group.localeCompare(b.group)));
})());

/** The group picker's list: de-duplicated group names, alpha-sorted
 *  (EntityEffectBroker.GetGroupNames(sortAlpha: true)). GetGroupNames
 *  filters on the crafting station, so a registry-only row (MorphSelf)
 *  is not offered. */
export const spellMakerGroups = () =>
  [...new Set(SPELL_MAKER_EFFECTS.filter((e) => e.craftable).map((e) => e.group))].sort();

/** The subgroup picker's list for one group, sorted by SubGroupName
 *  as DFU sorts before populating. A group whose single effect has
 *  no subgroup skips the picker entirely (the window's own arm). */
export const spellMakerSubgroups = (group) =>
  SPELL_MAKER_EFFECTS.filter((e) => e.group === group && e.craftable)
    .sort((a, b) => a.subgroup.localeCompare(b.subgroup));

/** EntityEffectBroker.GetEffectTemplate (:641) - the whole REGISTRY,
 *  including the rows no crafting station offers. The spellbook names
 *  effects through this; the maker's pickers go through the two
 *  functions above. */
export const effectByKey = (key) => SPELL_MAKER_EFFECTS.find((e) => e.key === key) ?? null;
