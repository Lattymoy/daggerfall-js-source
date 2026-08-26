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
// The ALLOWED TARGETS column is the same kind of per-class datum:
// properties.AllowedTargets, set beside the support flags in each
// effect class's SetProperties, and the set the Spell Maker window
// intersects to decide which of the five target buttons live
// (DaggerfallSpellMakerWindow.cs:586). Every class in the tree names
// one of three of EntityEffectBroker's sets - TargetFlags_All (43
// keys), TargetFlags_Other (32), TargetFlags_Self (16, of which six
// classes - Levitate, Slowfall, Identify and the three Detects -
// spell the same value as the bare TargetTypes.CasterOnly it is
// defined as). No class carries any other combination.
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

/** TargetTypes as FLAGS (MagicAndEffectsEnums.cs:21-29) - CasterOnly
 *  1, ByTouch 2, SingleTargetAtRange 4, AreaAroundCaster 8,
 *  AreaAtRange 16, which is 1 << the rangeType index the record
 *  stores, and EntityEffectBroker's three target sets (:42-44).
 *  TargetFlags_Self IS TargetTypes.CasterOnly (:42). */
export const targetFlag = (index) => 1 << index;
export const TARGET_FLAGS_SELF = targetFlag(0);
export const TARGET_FLAGS_OTHER = targetFlag(1) | targetFlag(2) | targetFlag(3) | targetFlag(4);
export const TARGET_FLAGS_ALL = TARGET_FLAGS_SELF | TARGET_FLAGS_OTHER;

const D = 'duration', C = 'chance', M = 'magnitude';
const S = TARGET_FLAGS_SELF, O = TARGET_FLAGS_OTHER, A = TARGET_FLAGS_ALL;
// [type, subType, group, subgroup, supports, allowedTargets]
const ROWS = [
  [0, 255, 'Paralyze', '', [D, C], O],
  [1, 0, 'Continuous Damage', 'Health', [D, M], O],
  [1, 1, 'Continuous Damage', 'Fatigue', [D, M], O],
  [1, 2, 'Continuous Damage', 'Spell Points', [D, M], O],
  [2, 255, 'Create Item', '', [D], S],
  [3, 0, 'Cure', 'Disease', [C], A],
  [3, 1, 'Cure', 'Poison', [C], A],
  [3, 2, 'Cure', 'Paralyzation', [C], A],
  [4, 0, 'Damage', 'Health', [M], O],
  [4, 1, 'Damage', 'Fatigue', [M], O],
  [4, 2, 'Damage', 'Spell Points', [M], O],
  [5, 255, 'Disintegrate', '', [C], O],
  [6, 0, 'Dispel', 'Magic', [C], S],
  [6, 1, 'Dispel', 'Undead', [C], S],
  [6, 2, 'Dispel', 'Daedra', [C], S],
  [8, 0, 'Elemental Resistance', 'Fire', [D, C], A],
  [8, 1, 'Elemental Resistance', 'Frost', [D, C], A],
  [8, 2, 'Elemental Resistance', 'Poison', [D, C], A],
  [8, 3, 'Elemental Resistance', 'Shock', [D, C], A],
  [8, 4, 'Elemental Resistance', 'Magicka', [D, C], A],
  [12, 255, 'Soul Trap', '', [D, C], O],
  [13, 0, 'Invisibility', 'Normal', [D], A],
  [13, 1, 'Invisibility', 'True', [D], A],
  [14, 255, 'Levitate', '', [D], S],
  [15, 255, 'Light', '', [D], S],
  [16, 255, 'Lock', '', [C], S],
  [17, 255, 'Open', '', [C], S],
  [18, 255, 'Regenerate', '', [D, M], A],
  [19, 255, 'Silence', '', [D, C], A],
  [20, 255, 'Spell Absorption', '', [D, C], A],
  [21, 255, 'Spell Reflection', '', [D, C], A],
  [22, 255, 'Spell Resistance', '', [D, C], A],
  [23, 0, 'Chameleon', 'Normal', [D], A],
  [23, 1, 'Chameleon', 'True', [D], A],
  [24, 0, 'Shadow', 'Normal', [D], A],
  [24, 1, 'Shadow', 'True', [D], A],
  [25, 255, 'Slowfall', '', [D], S],
  [26, 255, 'Free Action', '', [D], A],
  [27, 255, 'Jumping', '', [D], A],
  [28, 255, 'Climbing', '', [D], A],
  // U42: MorphSelf is a REGISTRY row that the maker never offers -
  // see the exclusions note above. It is here because
  // SetEffectLabels reads EntityEffectBroker.GetEffectTemplate
  // (DaggerfallSpellBookWindow.cs:641), the full registry, not the
  // maker's catalogue: a spellbook holding a 29,255 effect printed
  // "<effect not found>" while it was absent. `craftable: false`
  // keeps it out of the two picker lists, which is what
  // AllowedCraftingStations = None means (MorphSelf.cs:30).
  [29, 255, 'Morph Self', '', [D], S, false],
  [30, 255, 'Water Breathing', '', [D], A],
  [31, 255, 'Water Walking', '', [D], A],
  [33, 0, 'Pacify', 'Animal', [C], O],
  [33, 1, 'Pacify', 'Undead', [C], O],
  [33, 2, 'Pacify', 'Humanoid', [C], O],
  [33, 3, 'Pacify', 'Daedra', [C], O],
  [34, 255, 'Charm', '', [C], O],
  [35, 255, 'Shield', '', [D, M], A],
  [39, 0, 'Detect', 'Magic', [D], S],
  [39, 1, 'Detect', 'Enemy', [D], S],
  [39, 2, 'Detect', 'Treasure', [D], S],
  [40, 255, 'Identify', '', [C], S],
  [43, 255, 'Teleport', '', [], S],
  [44, 255, 'Comprehend Languages', '', [D, C], S],
];
// the stat/vital families, expanded exactly as DFU's per-stat classes are
const FAMILIES = [
  [7, 'Drain', STAT_SUBGROUPS, [M], O],                               // Drain{Attribute}, 0..7
  [9, 'Fortify Attribute', STAT_SUBGROUPS, [D, M], A],                // Fortify{Attribute}, 0..7
  [10, 'Heal', [...STAT_SUBGROUPS, 'Health', 'Fatigue'], [M], A],     // Heal{Attribute} + Health 8 / Fatigue 9
  [11, 'Transfer', [...STAT_SUBGROUPS, 'Health', 'Fatigue'], [M], O], // Transfer{...}, same 0..9
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
 *  subgroup, name, duration, chance, magnitude, ported, targets }. */
export const SPELL_MAKER_EFFECTS = Object.freeze((() => {
  const out = [];
  const push = (type, subType, group, subgroup, supports, targets, craftable = true) => out.push(Object.freeze({
    key: `${type},${subType}`, type, subType, group, subgroup,
    name: subgroup ? `${group} ${subgroup}` : group,     // DisplayName = "{GroupName} {SubGroupName}"
    duration: supports.includes(D), chance: supports.includes(C), magnitude: supports.includes(M),
    ported: PORTED_KEYS.has(`${type},${subType}`),
    // properties.AllowedTargets - what the maker's five target
    // buttons intersect down to (DaggerfallSpellMakerWindow.cs:586).
    targets,
    // AllowedCraftingStations != None. A false row is in the REGISTRY
    // (so the spellbook can name the effect) and out of the maker's
    // two picker lists.
    craftable,
  }));
  for (const [t, sT, g, sub, sup, tgt, craft] of ROWS) push(t, sT, g, sub, sup, tgt, craft);
  for (const [t, g, subs, sup, tgt] of FAMILIES) subs.forEach((sub, i) => push(t, i, g, sub, sup, tgt));
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
