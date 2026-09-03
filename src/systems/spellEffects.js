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
//    = None, so the Spell Maker never offers it. U42 put it in the
//    REGISTRY all the same (the spellbook names effects through
//    GetEffectTemplate, not through the maker's catalogue), marked
//    `craftable: false` - so 29 is no longer a gap in the sequence, it
//    is a row the two picker lists filter out.
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
  // AUDIT 54: NO support flag. MorphSelf.SetProperties
  // (MorphSelf.cs:24-33) assigns Key, ClassicKey, AllowedTargets,
  // AllowedElements, AllowedCraftingStations, ShowSpellIcon and
  // MagicSkill and NOTHING else, so BaseEntityEffect's ctor defaults
  // (EntityEffect.cs:293-297) leave all three Support* false. It is a
  // ZERO-COMPONENT effect - which is exactly why
  // CalculateEffectCosts reaches the `!activeComponents` fudge for it
  // (FormulaHelper.cs:2330-2334) and why SetDuration leaves
  // roundsRemaining at 0 (EntityEffect.cs:920-932). The port's own
  // cost row agrees (spellcost.js, `'29,255': row(SKILLS.Illusion, {})`),
  // as does the identically shaped Teleport row below.
  [29, 255, 'Morph Self', '', [], false],
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
  '29,255',                                                         // Morph Self (V2a - the arm calls the racial override)
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

/** AUDIT 54: EntityEffect.DisplayName (EntityEffect.cs:385-387) is
 *  `GetDisplayName()` by default, which manufactures
 *  `string.Format("{0} {1}", groupName, subGroupName)` -
 *  UNPARENTHESISED - and whose own comment says "Effects can override
 *  DisplayName property to set a custom display name"
 *  (EntityEffect.cs:906-918). SIX effect classes do, all six in
 *  Illusion, all six at :41, all six identical:
 *  `public override string DisplayName => string.Format("{0} ({1})",
 *  GroupName, SubGroupName);` - InvisibilityNormal.cs, InvisibilityTrue.cs,
 *  ChameleonNormal.cs, ChameleonTrue.cs, ShadowNormal.cs, ShadowTrue.cs
 *  (a grep for `override string DisplayName` over Assets/Scripts finds
 *  exactly these six). DisplayName's one reader is the Spell Maker's
 *  filled effect slot, `UpdateSlotText(slot,
 *  effectEditor.EffectTemplate.DisplayName)`
 *  (DaggerfallSpellMakerWindow.cs:461), so those six slots read
 *  "Invisibility (Normal)" where the port printed "Invisibility Normal".
 *  Nothing else changes: the two pickers take SubGroupName/GetGroupNames
 *  (:947, :732) and the spellbook takes GroupName/SubGroupName into two
 *  labels (DaggerfallSpellBookWindow.cs:646-647). */
const PAREN_DISPLAY_NAME = new Set([
  '13,0', '13,1',   // InvisibilityNormal / InvisibilityTrue
  '23,0', '23,1',   // ChameleonNormal / ChameleonTrue
  '24,0', '24,1',   // ShadowNormal / ShadowTrue
]);

/** Every effect the Spell Maker offers: { key, type, subType, group,
 *  subgroup, name, duration, chance, magnitude, ported }. */
export const SPELL_MAKER_EFFECTS = Object.freeze((() => {
  const out = [];
  const push = (type, subType, group, subgroup, supports, craftable = true) => out.push(Object.freeze({
    key: `${type},${subType}`, type, subType, group, subgroup,
    // DisplayName: GetDisplayName's default arm, or the six
    // concealment classes' `"{0} ({1})"` override (see above).
    name: subgroup
      ? (PAREN_DISPLAY_NAME.has(`${type},${subType}`) ? `${group} (${subgroup})` : `${group} ${subgroup}`)
      : group,
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

/** QG1: DFU's effect-template REGISTRY key for a classic pair. Every
 *  DFU effect class carries a per-class EffectKey literal, and the
 *  literals follow one convention across the classic set: the group
 *  name with its spaces removed, then `-SubGroup` (spaces removed)
 *  where a subgroup exists - "ContinuousDamage-SpellPoints",
 *  "WaterBreathing", "Levitate", "Drain-Strength". CastEffectDo
 *  matches quest-source keys against readied bundles by exactly these
 *  strings (CastEffectDo.cs:71), so this is the port's one derivation
 *  of that vocabulary. Byte-folded lookup, because spell records
 *  spell the no-subtype value as -1 and the registry as 255 - the
 *  same fold MakeClassicKey's byte casts perform. Null for a pair the
 *  registry does not carry. */
export function dfuEffectKeyOf(type, subType) {
  const t = (type ?? 0) & 0xff;
  const s = (subType ?? 0) & 0xff;
  const row = SPELL_MAKER_EFFECTS.find((e) => (e.type & 0xff) === t && (e.subType & 0xff) === s);
  if (!row) return null;
  const g = row.group.replace(/ /g, '');
  return row.subgroup ? `${g}-${row.subgroup.replace(/ /g, '')}` : g;
}

/** ROAD-D D10 - SpellBookDescription (IEntityEffect, EntityEffect.cs
 *  :78, default null at :395-398), the TEXT.RSC record each effect
 *  class overrides it with. DaggerfallSpellBookWindow.ShowEffectPopup
 *  (:651-660) is its only reader: it puts THOSE tokens in a
 *  click-anywhere message box, and nothing else - not the group name,
 *  not the subgroup.
 *
 *  In DFU the id is a per-CLASS property rather than a catalogue
 *  column, so it lives here as its own table keyed by the port's
 *  classic key. 87 effect classes carry one; the two VARIANT families
 *  compute theirs from the variant index instead of declaring one per
 *  subgroup, and both are expanded below at their own base:
 *  ElementalResistance is `1227 + currentVariant`
 *  (ElementalResistance.cs:94, key 8,v) and PacifyEffect is
 *  `1285 + currentVariant` (PacifyEffect.cs:79, key 33,v).
 *
 *  MorphSelf keeps its 1279 even though the maker never offers it -
 *  the spellbook reads the whole registry, the same reason its ROWS
 *  entry exists. */
export const SPELLBOOK_DESCRIPTION_IDS = new Map([
  ['0,255', 1202],                                       // Paralyze
  ['1,0', 1204], ['1,1', 1205], ['1,2', 1206],           // Continuous Damage
  ['2,255', 1207],                                       // Create Item
  ['3,0', 1209], ['3,1', 1210], ['3,2', 1211],           // Cure
  ['4,0', 1212], ['4,1', 1213], ['4,2', 1214],           // Damage
  ['5,255', 1215],                                       // Disintegrate
  ['6,0', 1216], ['6,1', 1217], ['6,2', 1218],           // Dispel
  ['7,0', 1219], ['7,1', 1220], ['7,2', 1221], ['7,3', 1222],
  ['7,4', 1223], ['7,5', 1225], ['7,6', 1224], ['7,7', 1226],   // Drain{Attribute} - Personality 1225 BEFORE Speed 1224, the classic subType order
  ['8,0', 1227], ['8,1', 1228], ['8,2', 1229], ['8,3', 1230], ['8,4', 1231],   // Elemental Resistance, 1227 + variant
  ['9,0', 1232], ['9,1', 1233], ['9,2', 1234], ['9,3', 1235],
  ['9,4', 1236], ['9,5', 1237], ['9,6', 1238], ['9,7', 1239],   // Fortify Attribute
  ['10,0', 1240], ['10,1', 1241], ['10,2', 1242], ['10,3', 1243], ['10,4', 1244],
  ['10,5', 1245], ['10,6', 1246], ['10,7', 1247], ['10,8', 1248], ['10,9', 1249],   // Heal{...}, Health 8 / Fatigue 9
  ['11,0', 1250], ['11,1', 1251], ['11,2', 1252], ['11,3', 1253], ['11,4', 1254],
  ['11,5', 1255], ['11,6', 1256], ['11,7', 1257], ['11,8', 1258], ['11,9', 1259],   // Transfer{...}
  ['12,255', 1303],                                      // Soul Trap
  ['13,0', 1260], ['13,1', 1261],                        // Invisibility
  ['14,255', 1262],                                      // Levitate
  ['15,255', 1263],                                      // Light
  ['16,255', 1264], ['17,255', 1265],                    // Lock / Open
  ['18,255', 1266],                                      // Regenerate
  ['19,255', 1267],                                      // Silence
  ['20,255', 1268], ['21,255', 1269], ['22,255', 1270],  // Absorption / Reflection / Resistance
  ['23,0', 1271], ['23,1', 1272],                        // Chameleon
  ['24,0', 1273], ['24,1', 1274],                        // Shadow
  ['25,255', 1275],                                      // Slowfall
  ['26,255', 1276],                                      // Free Action
  ['27,255', 1277], ['28,255', 1278],                    // Jumping / Climbing
  ['29,255', 1279],                                      // Morph Self (registry only)
  ['30,255', 1282], ['31,255', 1283],                    // Water Breathing / Walking
  ['33,0', 1285], ['33,1', 1286], ['33,2', 1287], ['33,3', 1288],   // Pacify, 1285 + variant
  ['34,255', 1289],                                      // Charm
  ['35,255', 1290],                                      // Shield
  ['39,0', 1296], ['39,1', 1297], ['39,2', 1298],        // Detect
  ['40,255', 1299],                                      // Identify
  ['43,255', 1302],                                      // Teleport
  ['44,255', 1305],                                      // Comprehend Languages
]);

/** The record ShowEffectPopup would read for this classic key, or
 *  null where the effect class declares none (EntityEffect's default
 *  is a null token array, and the box is then empty). */
export const spellBookDescriptionId = (key) => SPELLBOOK_DESCRIPTION_IDS.get(key) ?? null;

/** ROAD-E E8 - SpellMakerDescription, the record the SETTINGS EDITOR
 *  puts on its parchment (DaggerfallEffectSettingsEditorWindow.cs
 *  :262-267). Every effect class in DFU declares BOTH properties, and
 *  across all 85 of them the spell-maker record is the spellbook's
 *  PLUS 300 - including the two variant families, which compute both
 *  from a base (ElementalResistance 1527+variant against 1227+variant,
 *  PacifyEffect 1585+variant against 1285+variant). So this reads the
 *  table above rather than repeating it.
 *
 *  TWO EXCEPTIONS, and they are the classic Personality/Speed swap
 *  seen from the other side. The table above carries the SPELLBOOK
 *  order DFU's classes declare - DrainPersonality 1225 and DrainSpeed
 *  1224 (DrainPersonality.cs:41, DrainSpeed.cs:41), Personality's id
 *  ABOVE Speed's - while their spell-maker records are in plain
 *  ascending order, 1524 and 1525 (DrainPersonality.cs:40,
 *  DrainSpeed.cs:40). +300 would swap them, so the two are named. */
export const SPELLMAKER_DESCRIPTION_OFFSET = 300;
const SPELLMAKER_DESCRIPTION_EXCEPTIONS = new Map([
  ['7,5', 1524],   // Drain Personality
  ['7,6', 1525],   // Drain Speed
]);
export const spellMakerDescriptionId = (key) => {
  const named = SPELLMAKER_DESCRIPTION_EXCEPTIONS.get(key);
  if (named != null) return named;
  const book = spellBookDescriptionId(key);
  return book == null ? null : book + SPELLMAKER_DESCRIPTION_OFFSET;
};
