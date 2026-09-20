// @ts-check
// Daggerfall Unity's enums and effect keys, AS THE SAVE WRITES THEM
// (DFUSAVE2, 2026-09-20). Full Serializer prints an enum by NAME, so a
// DFU save carries "Female", "Exterior", "Weapons", "Fog" where the port
// stores a number (or, for a few, its own string). These are the name
// -> value tables the import reads through `enumValue`
// (formats/dfuSave.js), one per C# enum, each with its declaration
// cited. Every name carries the DFU_ prefix: the port has its OWN
// RACES, SKILLS, WORLD_CONTEXT and the rest (its runtime values - a
// string, an index, a table), and the audit24 one-home gate is right
// that a second `RACES` would be a second home. These are not the
// port's enums; they are what a DFU save PRINTS. A table here must stay the C# one: test/dfusave_import.test.js
// regenerates every one of them from the reference clone under PY1's
// DFU_PATH convention and fails on a member added, dropped or renumbered.
//
// Aliases are real: WeatherType names two values twice (None = Sunny,
// Rain_Normal = Rain, Snow_Normal = Snow) and DyeColors names 18 four
// times (Chain, Unchanged, SilverOrElven, Silver). .NET's ToString()
// emits the FIRST declared name for a value, and a save written by
// another build may carry a later one, so every alias is in its table.

/** Game/Entities/EntityEnums.cs:23 */
export const DFU_GENDERS = Object.freeze({ Male: 0, Female: 1 });

/** Game/Entities/EntityEnums.cs:32 - no 0; Vampire/Werewolf/Wereboar are
 *  compound races a birth race never is. */
export const DFU_RACES = Object.freeze({
  None: -1, Breton: 1, Redguard: 2, Nord: 3, DarkElf: 4, HighElf: 5, WoodElf: 6,
  Khajiit: 7, Argonian: 8, Vampire: 9, Werewolf: 10, Wereboar: 11,
});

/** Game/Entities/EntityEnums.cs:171 */
export const DFU_PLAYER_REFLEXES = Object.freeze({ VeryHigh: 0, High: 1, Average: 2, Low: 3, VeryLow: 4 });

/** DaggerfallUnityEnums.cs:582 */
export const DFU_WORLD_CONTEXT = Object.freeze({ Nothing: 0, Exterior: 1, Interior: 2, Dungeon: 3 });

/** Game/Weather/Weather.cs:18 - three aliases. */
export const DFU_WEATHER_TYPE = Object.freeze({
  Sunny: 0, None: 0, Cloudy: 1, Overcast: 2, Fog: 3, Rain: 4, Rain_Normal: 4,
  Thunder: 5, Snow: 6, Snow_Normal: 6,
});

/** Game/TransportManager.cs:23 */
export const DFU_TRANSPORT_MODES = Object.freeze({ Foot: 0, Horse: 1, Cart: 2, Ship: 3 });

/** Game/Items/ItemEnums.cs:27 - the classic group ids; the NAMES are the
 *  port's own group strings, so a name-carrying save maps by identity. */
export const DFU_ITEM_GROUPS = Object.freeze({
  None: -1, Drugs: 0, UselessItems1: 1, Armor: 2, Weapons: 3, MagicItems: 4,
  Artifacts: 5, MensClothing: 6, Books: 7, Furniture: 8, UselessItems2: 9,
  ReligiousItems: 10, Maps: 11, WomensClothing: 12, Paintings: 13, Gems: 14,
  PlantIngredients1: 15, PlantIngredients2: 16, CreatureIngredients1: 17,
  CreatureIngredients2: 18, CreatureIngredients3: 19, MiscellaneousIngredients1: 20,
  MetalIngredients: 21, MiscellaneousIngredients2: 22, Transportation: 23,
  Deeds: 24, Jewellery: 25, QuestItems: 26, MiscItems: 27, Currency: 28,
});

/** DaggerfallUnityEnums.cs:369 - four names on 18. */
export const DFU_DYE_COLORS = Object.freeze({
  Blue: 0, Grey: 1, Red: 2, DarkBrown: 3, Purple: 4, LightBrown: 5, White: 6,
  Aquamarine: 7, Yellow: 8, Green: 9, Iron: 15, Steel: 16,
  Chain: 18, Unchanged: 18, SilverOrElven: 18, Silver: 18,
  Elven: 19, Dwarven: 20, Mithril: 21, Adamantium: 22, Ebony: 23, Orcish: 24, Daedric: 25,
});

/** Game/Entities/PlayerEntity.cs:2263 */
export const DFU_CRIMES = Object.freeze({
  None: 0, Attempted_Breaking_And_Entering: 1, Trespassing: 2, Breaking_And_Entering: 3,
  Assault: 4, Murder: 5, Tax_Evasion: 6, Criminal_Conspiracy: 7, Vagrancy: 8,
  Smuggling: 9, Piracy: 10, High_Treason: 11, Pickpocketing: 12, Theft: 13,
  Treason: 14, LoanDefault: 15,
});

/** DaggerfallUnityEnums.cs:670 - the values are the clan factions' ids. */
export const DFU_VAMPIRE_CLANS = Object.freeze({
  None: 0, Vraseth: 150, Haarvenu: 151, Thrafey: 152, Lyrezi: 153,
  Montalion: 154, Khulari: 155, Garlythi: 156, Anthotis: 157, Selenu: 158,
});

/** DaggerfallUnityEnums.cs:660 */
export const DFU_LYCANTHROPY_TYPES = Object.freeze({ None: 0, Werewolf: 1, Wereboar: 2 });

/** Game/Items/ItemEnums.cs:64 */
export const DFU_WEAPON_MATERIAL_TYPES = Object.freeze({
  None: -1, Iron: 0, Steel: 1, Silver: 2, Elven: 3, Dwarven: 4,
  Mithril: 5, Adamantium: 6, Ebony: 7, Orcish: 8, Daedric: 9,
});

/** Game/Items/ItemEnums.cs:155 */
export const DFU_POISONS = Object.freeze({
  None: -1, Nux_Vomica: 128, Arsenic: 129, Moonseed: 130, Drothweed: 131,
  Somnalius: 132, Pyrrhic_Acid: 133, Magebane: 134, Thyrwort: 135,
  Indulcet: 136, Sursum: 137, Quaesto_Vil: 138, Aegrotat: 139,
});

/** Game/Items/ItemEnums.cs:105 - the equip table's 27 slots. */
export const DFU_EQUIP_SLOTS = Object.freeze({
  None: -1, Amulet0: 0, Amulet1: 1, Bracelet0: 2, Bracelet1: 3, Ring0: 4, Ring1: 5,
  Bracer0: 6, Bracer1: 7, Mark0: 8, Mark1: 9, Crystal0: 10, Crystal1: 11,
  Head: 12, RightArm: 13, Cloak1: 14, LeftArm: 15, Cloak2: 16,
  ChestClothes: 17, ChestArmor: 18, RightHand: 19, Gloves: 20, LeftHand: 21,
  Unknown1: 22, LegsArmor: 23, LegsClothes: 24, Unknown2: 25, Feet: 26,
});

/** Game/MagicAndEffects/MagicAndEffectsEnums.cs:78 */
export const DFU_BUNDLE_TYPES = Object.freeze({ None: 0, Spell: 1, Disease: 2, Poison: 3, HeldMagicItem: 4, Potion: 5 });

/** Game/MagicAndEffects/MagicAndEffectsEnums.cs:21 - [Flags]; the port's
 *  rangeType is the bit's INDEX (CasterOnly 0 .. AreaAtRange 4). */
export const DFU_TARGET_TYPES = Object.freeze({ None: 0, CasterOnly: 1, ByTouch: 2, SingleTargetAtRange: 4, AreaAroundCaster: 8, AreaAtRange: 16 });

/** Game/MagicAndEffects/MagicAndEffectsEnums.cs:36 - [Flags]; the port's
 *  element is the bit's INDEX (Fire 0 .. Magic 4). */
export const DFU_ELEMENT_TYPES = Object.freeze({ None: 0, Fire: 1, Cold: 2, Poison: 4, Shock: 8, Magic: 16 });

/** DaggerfallUnityEnums.cs:487 */
export const DFU_ENTITY_TYPES = Object.freeze({ None: 0, Player: 1, CivilianNPC: 2, StaticNPC: 3, EnemyMonster: 4, EnemyClass: 5 });

/** API/DFCareer.cs:448 - DFCareer.Skills, the port's SKILLS order. */
export const DFU_SKILLS = Object.freeze({
  None: -1, Medical: 0, Etiquette: 1, Streetwise: 2, Jumping: 3, Orcish: 4,
  Harpy: 5, Giantish: 6, Dragonish: 7, Nymph: 8, Daedric: 9, Spriggan: 10,
  Centaurian: 11, Impish: 12, Lockpicking: 13, Mercantile: 14, Pickpocket: 15,
  Stealth: 16, Swimming: 17, Climbing: 18, Backstabbing: 19, Dodging: 20,
  Running: 21, Destruction: 22, Restoration: 23, Illusion: 24, Alteration: 25,
  Thaumaturgy: 26, Mysticism: 27, ShortBlade: 28, LongBlade: 29, HandToHand: 30,
  Axe: 31, BluntWeapon: 32, Archery: 33, CriticalStrike: 34, Count: 35,
});

/** API/DFCareer.cs:429 */
export const DFU_STATS = Object.freeze({
  None: -1, Strength: 0, Intelligence: 1, Willpower: 2, Agility: 3,
  Endurance: 4, Personality: 5, Speed: 6, Luck: 7,
});

/** API/DFCareer.cs sub-enums, all inside `careerTemplate` (:229-:518). */
export const DFU_TOLERANCE = Object.freeze({ Normal: 0, Immune: 1, Resistant: 2, LowTolerance: 3, CriticalWeakness: 4 });
export const DFU_PROFICIENCY = Object.freeze({ Normal: 0, Forbidden: 1, Expert: 2 });
export const DFU_ATTACK_MODIFIER = Object.freeze({ Normal: 0, Bonus: 1, Phobia: 2 });
export const DFU_MATERIAL_FLAGS = Object.freeze({ Iron: 1, Steel: 2, Silver: 4, Elven: 8, Dwarven: 16, Mithril: 32, Adamantium: 64, Ebony: 128, Orcish: 256, Daedric: 512 });
export const DFU_SHIELD_FLAGS = Object.freeze({ Buckler: 1, RoundShield: 2, KiteShield: 4, TowerShield: 8 });
export const DFU_ARMOR_FLAGS = Object.freeze({ Leather: 1, Chain: 2, Plate: 4 });
export const DFU_PROFICIENCY_FLAGS = Object.freeze({ ShortBlades: 1, LongBlades: 2, HandToHand: 4, Axes: 8, BluntWeapons: 16, MissileWeapons: 32 });
export const DFU_DARKNESS_MAGERY_FLAGS = Object.freeze({ Normal: 0, UnableToCastInLight: 1, ReducedPowerInLight: 2 });
export const DFU_LIGHT_MAGERY_FLAGS = Object.freeze({ Normal: 0, UnableToCastInDarkness: 1, ReducedPowerInDarkness: 2 });
export const DFU_SPELL_ABSORPTION_FLAGS = Object.freeze({ None: 0, InLight: 1, InDarkness: 2, Always: 4 });
export const DFU_REGENERATION_FLAGS = Object.freeze({ None: 0, InLight: 1, InDarkness: 2, InWater: 4, Always: 8 });
export const DFU_RAPID_HEALING_FLAGS = Object.freeze({ None: 0, InLight: 1, InDarkness: 2, Always: 4 });
export const DFU_EFFECT_FLAGS = Object.freeze({ None: 0, Paralysis: 1, Magic: 2, Poison: 4, Fire: 8, Frost: 16, Shock: 32, Disease: 64 });
export const DFU_SPECIAL_ABILITY_FLAGS = Object.freeze({ None: 0, AcuteHearing: 1, Athleticism: 2, AdrenalineRush: 4, NoRegenSpellPoints: 8, SunDamage: 16, HolyDamage: 32 });
export const DFU_SPELL_POINT_MULTIPLIERS = Object.freeze({ Times_3_00: 0, Times_2_00: 4, Times_1_75: 8, Times_1_50: 12, Times_1_00: 16, Times_0_50: 20 });

/** API/FactionFile.cs:552 */
export const DFU_SOCIAL_GROUPS = Object.freeze({
  None: -1, Commoners: 0, Merchants: 1, Scholars: 2, Nobility: 3, Underworld: 4,
  SGroup5: 5, SupernaturalBeings: 6, GuildMembers: 7, SGroup8: 8, SGroup9: 9, SGroup10: 10,
});

/** DaggerfallUnityEnums.cs:758 */
export const DFU_QUEST_SMALLER_DUNGEONS_STATE = Object.freeze({ NotSet: 0, Disabled: 1, Enabled: 2 });

/** Game/MagicAndEffects/MagicAndEffectsEnums.cs:116 */
export const DFU_DISEASES = Object.freeze({
  None: -1, WitchesPox: 0, Plague: 1, YellowFever: 2, StomachRot: 3, Consumption: 4,
  BrainFever: 5, SwampRot: 6, CalironsCurse: 7, Cholera: 8, Leprosy: 9, WoundRot: 10,
  RedDeath: 11, BloodRot: 12, TyphoidFever: 13, Dementia: 14, Chrondiasis: 15, WizardFever: 16,
});

/** Game/MagicAndEffects/Effects/Poisons/PoisonEffect.cs:41 */
export const DFU_POISON_STATES = Object.freeze({ Waiting: 0, Active: 1, Complete: 2 });

/** DaggerfallUnityEnums.cs:611 */
export const DFU_SITE_TYPES = Object.freeze({ None: 0, Town: 1, Dungeon: 2, Building: 3 });
/** DaggerfallUnityEnums.cs:624 */
export const DFU_MARKER_TYPES = Object.freeze({ None: -1, QuestSpawn: 11, QuestItem: 18 });
/** Game/Questing/Place.cs:52 */
export const DFU_PLACE_SCOPES = Object.freeze({ None: 0, Fixed: 1, Remote: 2, Local: 3 });
/** Game/Questing/Task.cs:107 */
export const DFU_TASK_TYPES = Object.freeze({ Headless: 0, Standard: 1, PersistUntil: 2, Variable: 3, GlobalVarLink: 4 });
/** Game/Utility/NameHelper.cs:41 */
export const DFU_BANK_TYPES = Object.freeze({
  Breton: 0, Redguard: 1, Nord: 2, DarkElf: 3, HighElf: 4, WoodElf: 5, Khajiit: 6,
  Imperial: 7, Monster1: 8, Monster2: 9, Monster3: 10,
});
/** Game/StaticNPC.cs:113 */
export const DFU_NPC_CONTEXT = Object.freeze({ Custom: 0, Dungeon: 1, Building: 2 });
/** Game/TalkManager.cs:285 */
export const DFU_QUEST_INFO_RESOURCE_TYPE = Object.freeze({ NotSet: 0, Location: 1, Person: 2, Thing: 3 });
/** Game/TalkManager.cs:341 */
export const DFU_RUMOR_TYPE = Object.freeze({ CommonRumor: 0, QuestProgressRumor: 1, QuestRumorMill: 2 });
/** Game/TalkManager.cs:297 */
export const DFU_BUILDING_LOCATION_HINT = Object.freeze({ None: 0, ReceivedDirectionalHints: 1, LocationWasMarkedOnMap: 2 });
/** DaggerfallUnityEnums.cs:293 */
export const DFU_MOBILE_GENDER = Object.freeze({ Unspecified: 0, Female: 1, Male: 2 });

/** API/DFLocation.cs:106 */
export const DFU_BUILDING_TYPES = Object.freeze({
  None: -1, Alchemist: 0, HouseForSale: 1, Armorer: 2, Bank: 3, Town4: 4,
  Bookseller: 5, ClothingStore: 6, FurnitureStore: 7, GemStore: 8, GeneralStore: 9,
  Library: 10, GuildHall: 11, PawnShop: 12, WeaponSmith: 13, Temple: 14, Tavern: 15,
  Palace: 16, House1: 17, House2: 18, House3: 19, House4: 20, House5: 21, House6: 22,
  Town23: 23, Ship: 24, Special1: 116, Special2: 223, Special3: 249, Special4: 250,
  AnyShop: 65533, AnyHouse: 65534, AllValid: 65535,
});

/** API/TextFile.cs:98 - the token formatting names the talk and
 *  notebook files carry; two aliases on 0. */
export const DFU_TEXT_FORMATTING = Object.freeze({
  Text: -1, TextHighlight: -2, TextQuestion: -3, TextAnswer: -4,
  NewLineOffset: 0, NewLine: 0, SameLineOffset: 1, PullPreceeding: 2,
  FirstCharacter: 32, LastCharacter: 127,
  FontPrefix: 249, PositionPrefix: 251, JustifyLeft: 252, JustifyCenter: 253,
  EndOfPage: 246, InputCursorPositioner: 248, EndOfRecord: 254, SubrecordSeparator: 255,
  Color: 256, Scale: 257, Image: 258, Nothing: 65535,
});

/** DaggerfallUnityEnums.cs:142 - monsters 0-42, humanoids 128-146,
 *  None = 0xffff. Only the two sentinels the import needs. */
export const DFU_MOBILE_TYPES_NONE = 65535;

/**
 * THE EFFECT KEY TABLE - every effect class's `EffectKey` and the
 * classic `(group, subGroup)` its `ClassicKey = MakeClassicKey(g, s)`
 * names (Game/MagicAndEffects/EntityEffect.cs:999: `(family << 16) +
 * (g << 8) + s`, every caller on the Spells family). `null` is an
 * effect with no classic key: a disease, a poison, a curse, an
 * artifact power, an enchantment, a modded custom effect. A made spell
 * in a DFU spellbook names its effects by these keys; the port's
 * spell record wants the classic pair.
 *
 * Regenerated from the reference clone by the pin: every
 * `EffectKey = "..."` / `MakeClassicKey(a, b)` pair under Effects/**.
 */
export const DFU_EFFECT_CLASSIC_KEYS = Object.freeze({
  'ContinuousDamage-Health': [1, 0], 'ContinuousDamage-Fatigue': [1, 1], 'ContinuousDamage-SpellPoints': [1, 2],
  'Damage-Health': [4, 0], 'Damage-Fatigue': [4, 1], 'Damage-SpellPoints': [4, 2],
  'Disintegrate': [5, 255],
  'Drain-Strength': [7, 0], 'Drain-Intelligence': [7, 1], 'Drain-Willpower': [7, 2], 'Drain-Agility': [7, 3],
  'Drain-Endurance': [7, 4], 'Drain-Personality': [7, 5], 'Drain-Speed': [7, 6], 'Drain-Luck': [7, 7],
  'Transfer-Strength': [11, 0], 'Transfer-Intelligence': [11, 1], 'Transfer-Willpower': [11, 2], 'Transfer-Agility': [11, 3],
  'Transfer-Endurance': [11, 4], 'Transfer-Personality': [11, 5], 'Transfer-Speed': [11, 6], 'Transfer-Luck': [11, 7],
  'Transfer-Health': [11, 8], 'Transfer-Fatigue': [11, 9],
  'Cure-Disease': [3, 0], 'Cure-Poison': [3, 1], 'Cure-Paralyzation': [3, 2],
  'Fortify-Strength': [9, 0], 'Fortify-Intelligence': [9, 1], 'Fortify-Willpower': [9, 2], 'Fortify-Agility': [9, 3],
  'Fortify-Endurance': [9, 4], 'Fortify-Personality': [9, 5], 'Fortify-Speed': [9, 6], 'Fortify-Luck': [9, 7],
  'Heal-Strength': [10, 0], 'Heal-Intelligence': [10, 1], 'Heal-Willpower': [10, 2], 'Heal-Agility': [10, 3],
  'Heal-Endurance': [10, 4], 'Heal-Personality': [10, 5], 'Heal-Speed': [10, 6], 'Heal-Luck': [10, 7],
  'Heal-Health': [10, 8], 'Heal-Fatigue': [10, 9], 'Heal-SpellPoints': null,
  'FreeAction': [26, 255], 'Regenerate': [18, 255], 'SpellAbsorption': [20, 255],
  'Paralyze': [0, 255],
  'ElementalResistance-Fire': [8, 0], 'ElementalResistance-Frost': [8, 1], 'ElementalResistance-Poison': [8, 2],
  'ElementalResistance-Shock': [8, 3], 'ElementalResistance-Magicka': [8, 4],
  'Slowfall': [25, 255], 'Jumping': [27, 255], 'Climbing': [28, 255], 'WaterBreathing': [30, 255], 'Shield': [35, 255],
  'Invisibility-Normal': [13, 0], 'Invisibility-True': [13, 1], 'Light': [15, 255],
  'Chameleon-Normal': [23, 0], 'Chameleon-True': [23, 1], 'Shadow-Normal': [24, 0], 'Shadow-True': [24, 1],
  'MorphSelf': [29, 255],
  'MageLight-Inferno': null, 'MageLight-Rime': null, 'MageLight-Venom': null, 'MageLight-Storm': null, 'MageLight-Arcane': null,
  'CreateItem': [2, 255], 'Dispel-Magic': [6, 0], 'Dispel-Undead': [6, 1], 'Dispel-Daedra': [6, 2],
  'SoulTrap': [12, 255], 'Lock': [16, 255], 'Open': [17, 255], 'Silence': [19, 255],
  'Teleport-Effect': [43, 255], 'ComprehendLanguages': [44, 255],
  'Levitate': [14, 255], 'SpellReflection': [21, 255], 'SpellResistance': [22, 255], 'WaterWalking': [31, 255],
  'Pacify-Animal': [33, 0], 'Pacify-Undead': [33, 1], 'Pacify-Humanoid': [33, 2], 'Pacify-Daedra': [33, 3],
  'Charm': [34, 255], 'Detect-Magic': [39, 0], 'Detect-Enemy': [39, 1], 'Detect-Treasure': [39, 2], 'Identify': [40, 255],
});

/** The keys that are not spells: the bundle they ride tells the import
 *  what they are (DiseaseEffect.cs:260, PoisonEffect.cs:166, the two
 *  infections' and curses' own keys). */
export const DFU_DISEASE_KEY_PREFIX = 'Disease-';
export const DFU_POISON_KEY_PREFIX = 'Poison-';
export const DFU_VAMPIRISM_INFECTION_KEY = 'Vampirism-Infection';
export const DFU_WEREWOLF_INFECTION_KEY = 'Werewolf-Infection';
export const DFU_WEREBOAR_INFECTION_KEY = 'Wereboar-Infection';
export const DFU_VAMPIRISM_CURSE_KEY = 'Vampirism-Curse';
export const DFU_LYCANTHROPY_CURSE_KEY = 'Lycanthropy-Curse';
export const DFU_DRAIN_KEY_PREFIX = 'Drain-';
