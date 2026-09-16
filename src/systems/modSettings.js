// ROADS 24: A VENDORED MOD'S OWN SWITCHES. DFU's settings model is its
// 171 keys and nothing else (settings.test.js pins the count), and a
// mod's switches are not DFU's - in DFU they live in the mod's own
// modsettings, under the Mods menu. So they live here: one small store,
// keyed by the vendor folder, with the mod's own names, defaults and
// descriptions exactly as its modsettings ships them. localStorage-
// backed through the port's ONE storage seam where there is storage,
// in-memory where there is not, so the worker and node both read
// defaults without a DOM.

import { appStorage } from './appStorage.js';   // the one storage seam - localStorage lives there alone
import { onlineForcedModSetting } from './onlineLane.js';   // OL1: online, every mod is enabled

const STORE_KEY = 'dfjs-mod-settings';

/** Every vendored mod that has switches, by vendor key. Names, defaults
 *  and descriptions are the mod's own (Basic Roads 1.3.1 modsettings).
 *  `author` is the manifest's ModAuthor (Basic Roads: its README's),
 *  and the Mods pane puts it IN THE TITLE (Mac, 2026-09-08: "place each
 *  creator's name in the mod title"). */
export const MOD_SETTINGS = Object.freeze({
  // DS1: DYNAMIC SKIES 2.3.4 (BadLuckBurt and carademono). Its own two
  // sections, names and descriptions as modsettings.json ships them
  // (FogDensity/densitySetting; SnowSizeAndNumberOfParticles/*), plus
  // `Enabled`, which is the port's: DFU enables a mod by listing it, and
  // the port has no mod list, so the whole sky is one switch here. A
  // key with `min`/`max` is a SliderIntKey and reads as an integer.
  // VC1 (2026-09-07, Mac: "remove the pixelated sky look"): OFF by
  // default. The mod's look - 512-pixel cloud sheets drawn nearest and
  // its own colour posterise - is the pixelation Mac named, and it is
  // the mod's to keep; the port's own dome is the enhanced lane's sky
  // and the mod is a choice in the Mods pane (Ledger row DS1).
  // MO1 (2026-09-12, Mac: "All mods should be enabled by default"):
  // every mod's `Enabled` defaults TRUE - this one, Meaner Monsters,
  // the Physical Combat And Armor Overhaul and Unleveled Loot alike -
  // and the Mods pane is where a player turns one off. While this one
  // is on the mod's skybox is the enhanced lane's sky, as DS1 shipped
  // it - with the volumetric clouds over it (DS2) and the Pixelated sky
  // switch on it (PS2); the port's own dome draws while it is off.
  'dynamic-skies': Object.freeze({
    title: 'Dynamic Skies',
    author: 'BadLuckBurt and carademono',
    keys: Object.freeze({
      Enabled: Object.freeze({ default: true, description: 'Dynamic Skies\u2019 procedural skybox in place of the port\u2019s own dome, under the enhanced environments: its sun and scattering, textured cloud layers per weather, twinkling stars, both moons on their orbits, its fog colours and distances, its longer sunrise and sunset, and a lightning flash under thunder. Off returns the port\u2019s own procedural sky.' }),
      densitySetting: Object.freeze({ default: 1, min: 1, max: 10, description: 'Makes fog thicker' }),
      ActivatePixelSnow: Object.freeze({ default: false, description: 'Turn the pixel snow replacement on or off' }),
      MinParticleSize: Object.freeze({ default: 100, min: 100, max: 800, description: 'Minimum snow particle size' }),
      MaxParticleSize: Object.freeze({ default: 300, min: 100, max: 800, description: 'Maximum snow particle size' }),
      // AUDIT 61: the description is the mod's, verbatim - the pane shows it as the author wrote it. (The value is read and logged by the mod and never applied; carried as it ships.)
      MaxParticles: Object.freeze({ default: 20, min: 15, max: 20, description: 'Maximum number of snow flake particles (multiplied by 1000)' }),
    }),
  }),
  'seasons-iliac-bay': Object.freeze({
    title: 'Seasons of the Iliac Bay',
    author: 'RosyTheRascal',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'RosyTheRascal\u2019s seasonal repaints of the woodland, hills, haunted and mountain trees, rocks and plants '
          + '- autumn, spring and winter, at the mod\u2019s 3.1x size. The textures come from your own copy of the mod '
          + 'through the Your own textures pick; without them the classic flats draw.',
      }),
    }),
  }),
  // AUDIT BASIC ROADS (BR3, 2026-09-13, Mac: "can you do an audit on
  // basic roads, I dont think its working"). THIS MOD HAD NO `Enabled`
  // AND NO GATE - the only one of the six. MO1 gave every mod the
  // switch and defaulted it TRUE; this one was missed, so Basic Roads
  // was not enabled-by-default, it was UNCONDITIONAL: world.js called
  // loadModRoads() with nothing to ask, and a player could neither see
  // that it was on nor turn it off. OFF does not mean a roadless map -
  // the port has had its OWN network since ROADS 3 and it is the
  // fallback for a map his arrays cannot load. So the switch reads the
  // way Dynamic Skies' does: on, the mod's network 1:1; off, the
  // port's own, generated from the player's map.
  'roads-hazelnut': Object.freeze({
    title: 'Basic Roads',
    author: 'Hazelnut',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Hazelnut\u2019s Basic Roads, 1:1: his own road, track, river and stream network for the whole Iliac Bay, '
          + 'painted onto the terrain as the mod paints it. Off draws the port\u2019s own network instead - generated '
          + 'from the settlements on your map - so the world keeps its roads either way.',
      }),
      SmoothRoads: Object.freeze({ default: true, description: 'Enables light smoothing of road surfaces, disable for minor extra performance.' }),
      RiversAndStreams: Object.freeze({ default: false, description: 'Enables rendering of rivers and streams on terrain' }),
    }),
  }),
  // MM1: MEANER MONSTERS 1.5.2 (Ralzar). No modsettings of its own -
  // `Enabled` alone (DFU enables a mod by listing it). Listed BEFORE
  // the overhaul because the overhaul names it as a dependency and so
  // Awakes after it in DFU.
  'meanerMonsters': Object.freeze({
    title: 'Meaner Monsters',
    author: 'Ralzar',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Ralzar\u2019s Meaner Monsters 1.5.2, 1:1: \"Buffs many monsters. Debuffs rats, bats and zombies.\" Twenty '
          + 'monsters\u2019 damage, health, level and armour rewritten, the werebeasts and the dragonling drawn larger. '
          + 'With Physical Combat And Armor Overhaul also on, its own edit of these numbers takes over.',
      }),
    }),
  }),
  // PCO1: PHYSICAL COMBAT AND ARMOR OVERHAUL 1.44 (Kirk.O). Its seven
  // Modules keys, names and descriptions as modsettings.json ships them
  // (all seven on, as shipped), plus the port's `Enabled` (DFU enables
  // a mod by listing it). MM1 (Mac: "there shouldn't be compatibility
  // switches between mods"): the two arms DFU derives from OTHER mods
  // being loaded - Roleplay Realism's advancedArchery and the presence
  // of Meaner Monsters - are no longer switches here; combat/pcaao.js
  // reads the other mod's own switch, as DFU asks ModManager.
  'pcaao': Object.freeze({
    title: 'Physical Combat And Armor Overhaul',
    author: 'Kirk.O',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Kirk.O\u2019s Physical Combat And Armor Overhaul 1.44, 1:1: armour reduces the damage you take instead of '
          + 'your chance to be hit, skills decide the hit, weapons and shields wear and block by their material, and '
          + 'critical strikes multiply damage. Off returns Daggerfall Unity\u2019s own combat formulas.',
      }),
      equipmentDamageEnhanced: Object.freeze({ default: true, description: 'Equipment condition damage is increased significantly, the amount of wear your equipment takes is based on many different factors; Material, Damage Source, Etc' }),
      fadingEnchantedItems: Object.freeze({ default: true, description: 'Enchanted Weapons and Armor will be destroyed upon breaking from physical combat. !!!! This Module Is Dependent On Equipment Damage Enhanced' }),
      fixedStrengthDamageModifier: Object.freeze({ default: true, description: 'Fixes a bug in DFU 0.10.21, the strength modifier for damage is double what classic had. This module fixes that, so 10 points = +1, instead of 10 points = +2' }),
      armorHitFormulaRedone: Object.freeze({ default: true, description: 'Armor no longer increases your chance to avoid damage, but instead reduces the damage that you do take in physical combat. The readme and mod-page provided goes into great detail if desired' }),
      criticalStrikesIncreaseDamage: Object.freeze({ default: true, description: 'Critical Strikes Increase Damage, not just hit-chance. !!!! This Module Is Dependent On Armor Hit Formula Redone' }),
      conditionBasedEffectiveness: Object.freeze({ default: true, description: 'Weapons and Armor Effectiveness is influenced by current Condition Value. !!!! This Module Is Dependent On Armor Hit Formula Redone' }),
      softMaterialRequirements: Object.freeze({ default: true, description: 'Weapon Material Requirements are relaxed, large damage penalty for being below required material. !!!! This Module Is Dependent On Armor Hit Formula Redone' }),
    }),
  }),
  // UL1: UNLEVELED LOOT 1.1.2 (Ralzar). Its one section, MaterialSwitching,
  // ten MultipleChoiceKeys named for the ten materials, each defaulting
  // to itself, as modsettings.json ships them, plus the port's `Enabled`.
  // Listed AFTER the overhaul: its manifest orders it after Roleplay
  // Realism, and its two overrides register last.
  'unleveledLoot': Object.freeze({
    title: 'Unleveled Loot',
    author: 'Ralzar',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Ralzar\u2019s Unleveled Loot 1.1.2, 1:1: \"Makes loot and shop stock materials not scale to your level.\" '
          + 'Materials roll by your luck, the shop\u2019s quality and the dungeon\u2019s kind; a corpse\u2019s gold '
          + 'follows your luck rather than your level. Off returns Daggerfall Unity\u2019s own rolls.',
      }),
      ...Object.fromEntries(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric'].map((name, i) => [name, Object.freeze({
        default: i,
        options: Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']),
        description: 'Whenever this material would drop, change it to the selected material.',
      })])),
    }),
  }),
  // WW1 (2026-09-14, Mac: "This is our next mod I want to add 1:1 while
  // also having it work with morrowind's first person view"): WEAPON
  // WIDGET 1.6 (RedRoryOTheGlen). Its nine sections as modsettings.json
  // ships them - Modules' nine toggles, then each module's own knobs -
  // the key named section-dot-name because four names repeat across
  // sections (Speed, Length, Offset, Condition). A key with `float`
  // is a SliderFloatKey and reads as a number on its range; `step` is
  // the Mods pane's stepper for it. Descriptions are the mod's own where
  // it wrote one. Plus the port's `Enabled` (MO1: on).
  'weapon-widget': Object.freeze({
    title: 'Weapon Widget',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'RedRoryOTheGlen\u2019s Weapon Widget 1.6, 1:1: the first-person weapon sprite handled anew - swings that '
          + 'wind up and recover, the sprite in the hand you swing with, a sheathe, a walking bob, look inertia and a '
          + 'recoil on a hit or a parry. The same channels move the Morrowind arms.',
      }),
      'Modules.Swings': Object.freeze({ default: true, description: 'Swings: the strike winds up from the idle pose, plays at its own speed, and recovers - in reverse after a hit.' }),
      'Modules.Ambidexterity': Object.freeze({ default: true, description: 'Ambidexterity: the sprite is drawn in the hand you are swinging with (H), mirrored for the left.' }),
      'Modules.Offset': Object.freeze({ default: true, description: 'Offset: sheathing slides the sprite off the screen and drawing slides it back; a swing returns from below.' }),
      'Modules.Bob': Object.freeze({ default: true, description: 'Bob: the sprite sways as you walk.' }),
      'Modules.Inertia': Object.freeze({ default: false, description: 'Inertia: the sprite lags the look and your movement. Requires double-scaled weapon textures.' }),
      'Modules.Step': Object.freeze({ default: false, description: 'Step: the sprite\u2019s position is rounded so it moves in steps.' }),
      'Modules.DoubleScaleTextures': Object.freeze({ default: false, description: 'DoubleScaleTextures: the idle pose is drawn at double size from the mod\u2019s own textures (attach the mod\u2019s .dfmod through the textures pick).' }),
      'Modules.TrueTextureSize': Object.freeze({ default: false, description: 'TrueTextureSize: a custom texture is drawn at its own pixel size, divided by the scale factor below.' }),
      'Modules.Recoil': Object.freeze({ default: false, description: 'Recoil: the swing recoils on a hit, a parry or a miss, by the condition below.' }),
      'Swings.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 5.0, float: true, step: 0.25, description: 'Speed of the swing\u2019s frames.' }),
      'Swings.Windup': Object.freeze({ default: 1, options: Object.freeze(['Hide', 'Idle', 'First Frame']), description: 'What shows while the swing winds up.' }),
      'Swings.Recovery': Object.freeze({ default: 0, options: Object.freeze(['Hide', 'Last Frame']), description: 'What shows while the swing recovers.' }),
      'Swings.VanillaAlignmentOverride': Object.freeze({ default: true, description: 'Centres the down and up strikes of the vanilla weapons at the screen\u2019s middle edge.' }),
      'Swings.VanillaRecoveryOverride': Object.freeze({ default: true, description: 'Plays the StrikeUp animation in reverse during recovery for some vanilla weapons' }),
      'Swings.NoDaggerMirroredStrikes': Object.freeze({ default: true, description: 'Prevents Daggers from using the opposite hand animations' }),
      'Offset.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 5.0, float: true, step: 0.25, description: 'Speed of the slide on and off the screen.' }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, description: 'Amount of bobs in a single stride' }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.1, description: 'Advances the bob timing. For use with weapon bob.' }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of horizontal movement when bobbing' }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of vertical movement when bobbing' }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between stationary and moving' }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between movement states' }),
      'Bob.Shape': Object.freeze({ default: 0, options: Object.freeze(['U', 'Sideways 8', 'Inverted U']), description: 'Shape of bob' }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, description: 'Whether the shield will slightly bob while stationary' }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, description: 'The number (x8) whose multiples will be used for snapping' }),
      'Step.Condition': Object.freeze({ default: 0, options: Object.freeze(['Sheathe/Attack Only', 'All Transforms']), description: 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil' }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The maximum distance that the sprite will be offset' }),
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will move at towards the target offset' }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Multiplier for the change in scale when moving forward or backward' }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will scale towards the target depth' }),
      'TrueTextureSize.TextureScaleFactor': Object.freeze({ default: 1, min: 1, max: 8, description: 'A custom texture\u2019s pixels per screen pixel of the 320x200 surface.' }),
      'Recoil.Condition': Object.freeze({ default: 0, options: Object.freeze(['Hits Only', 'Hits and Parries', 'Parries Only', 'Parries and Misses', 'Misses Only', 'All Attacks']), description: 'When the swing recoils.' }),
      'Recoil.Chance': Object.freeze({ default: 100, min: 0, max: 100, description: '% chance of recoil happening when condition is met' }),
      'Recoil.PlayEntityMissEffects': Object.freeze({ default: true, description: 'A clang or a thud at a foe that parried or was missed.' }),
      'Recoil.DetectEnvironment': Object.freeze({ default: true, description: 'A swing into a wall or a door within reach recoils too.' }),
      'Recoil.PlayEnvironmentMissEffects': Object.freeze({ default: true, description: 'A thud where the swing met the wall.' }),
      'Recoil.MissEffectPlacement': Object.freeze({ default: 0, options: Object.freeze(['Target', 'Crosshair']), description: 'Where the clang or thud is drawn.' }),
      'Miscellaneous.MirrorBows': Object.freeze({ default: false, description: 'Draws the bow mirrored.' }),
      'Miscellaneous.MirrorTwoHandedSwords': Object.freeze({ default: false, description: 'Draws a two-handed sword mirrored in the right hand.' }),
      'Miscellaneous.MirrorTwoHandedAxes': Object.freeze({ default: false, description: 'Draws a two-handed axe mirrored in the right hand.' }),
      'Miscellaneous.MirrorTwoHandedBlunts': Object.freeze({ default: false, description: 'Draws a two-handed staff, hammer or flail mirrored in the right hand.' }),
    }),
  }),
  // HT1 (2026-09-14): HANDHELD TORCHES 1.4.1 (RedRoryOTheGlen), ported
  // 1:1 - the shipped modsettings.json (vendor/handheld-torches/) key
  // for key, section and name joined with a dot. Two kinds are new
  // here: a TextKey (a Unity KeyCode name - `text`), and the two Tuple
  // keys (`tuple: 'int' | 'float'`, the value a pair). Where the mod
  // wrote a description it is the pane's; where it wrote none the port
  // did.
  'handheld-torches': Object.freeze({
    title: 'Handheld Torches',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'RedRoryOTheGlen\u2019s Handheld Torches 1.4.1, 1:1: a lit torch, candle or lantern needs a free hand, with '
          + 'keys to ignite, drop or throw one (a thrown torch can set a foe alight). A first-person hand holds the '
          + 'light, and a dropped torch burns on the ground, lights the room and can be picked up.',
      }),
      // SOC5 (2026-09-16, Mac: "Players should be able to interact with others
      // in the world upon encountering them by pressing F on their body"): THE
      // SECOND DEPARTURE FROM THE MOD'S SHIPPED KEYS, and the same shape as
      // HT4's below. Handheld Torches ships F, and in Daggerfall Unity that is
      // free. It is not free here any more: SOC5 spends F on the port's own
      // SocialInteract action (systems/inputActions.js DEFAULT_BINDINGS), the
      // key Mac named, and online forces every vendored mod ON
      // (systems/onlineLane.js) - so one press would both open the F-menu on a
      // player and light a torch, for every player online, by default. O is
      // unbound in DFU's own defaults and unused by this mod's other two keys
      // and by every other vendored mod, and it says what it does: on and off.
      // The player may still bind it wherever they like; this is about what
      // SHIPS. test/ht1_handheldtorches.test.js HT4 is the gate that caught it.
      'Handling.ToggleLightInput': Object.freeze({ default: "O", text: true, description: 'Button used to quickly ignite or douse your light source' }),
      'Handling.RememberLastLightSource': Object.freeze({ default: true, description: 'Igniting with the key re-lights the light you last doused, if you still carry one.' }),
      // HT4 (2026-09-15, Mac: "Pressing tab drops torches, tab is reserved
      // for the menu"): THE ONE DEPARTURE FROM THE MOD'S SHIPPED KEYS.
      // Handheld Torches ships Tab, and in Daggerfall Unity that is free.
      // It is not free here: PX15 gave Tab to the port's own pixel dial
      // (ui/input.js, the radial menu DFU has not got), so the mod's
      // default landed on a key the port had already spent and one press
      // both opened the dial and dropped the light. The mod could not
      // have known; the port has to answer for it. G is unbound in DFU's
      // own defaults (inputActions.js DEFAULT_BINDINGS) and unused by the
      // mod's other two keys, and it stays the player's to rebind.
      'Handling.ManualDropInput': Object.freeze({ default: "G", text: true, description: 'Button used to manually drop a light source' }),
      'Handling.OnStow': Object.freeze({ default: 1, options: Object.freeze(["Unequip", "Drop"]), description: 'Behavior when forced to stow a light source' }),
      'Handling.OnPick': Object.freeze({ default: 1, options: Object.freeze(["Store", "Equip", "Force Equip"]), description: 'Behavior when picking up a light source' }),
      'Handling.StowWhenSpellcasting': Object.freeze({ default: true, description: 'Casting, or holding a readied spell, stows the light: no free hand.' }),
      'Handling.StowWhenClimbing': Object.freeze({ default: true, description: 'Climbing stows the light: no free hand.' }),
      'Handling.StowWhenSwimming': Object.freeze({ default: true, description: 'Swimming stows the light: no free hand.' }),
      'Handling.RelaxedTwoHandedWeapons': Object.freeze({ default: true, description: 'Two-handed weapons will only occupy your off-hand when attacking' }),
      'Handling.RelaxedLanterns': Object.freeze({ default: false, description: 'If enabled, will not stow lanterns when both hands are occupied' }),
      'Throwing.ThrowTorchInput': Object.freeze({ default: "X", text: true, description: 'Hold to wind up a throw, release to throw a torch.' }),
      'Throwing.ThrowStrength': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, description: 'Multiplier on the throw\u2019s speed (25 at full Strength).' }),
      'Throwing.GravityStrength': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, description: 'Multiplier on the thrown torch\u2019s fall.' }),
      'Throwing.ThrowAngleOffset': Object.freeze({ default: 15.0, min: 0.0, max: 45.0, float: true, step: 0.25, description: 'Degrees above the look the torch leaves at.' }),
      'Throwing.ThrowDispersion': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.1, description: 'Degrees of random spread on the throw.' }),
      'Throwing.ThrowScaleSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, description: 'How fast the wind-up charges while the key is held.' }),
      'Throwing.ShowTrajectory': Object.freeze({ default: true, description: 'Draws the throw\u2019s arc while the key is held (DFU only; the port has no world-space line to draw it with \u2014 AUDIT 66 F9).' }),
      'Throwing.Bounciness': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'How much speed a thrown torch keeps when it bounces.' }),
      'Throwing.Combustion': Object.freeze({ default: true, description: 'A thrown torch that strikes a foe can set it alight.' }),
      'Throwing.Accuracy': Object.freeze({ default: 50, min: 0, max: 100, description: 'The to-hit modifier of the thrown torch.' }),
      'Throwing.Duration': Object.freeze({ default: 3, min: 0, max: 60, description: 'Rounds the fire burns on a struck foe.' }),
      'Throwing.Chance': Object.freeze({ default: 50, min: 0, max: 100, description: '% chance the fire takes on a struck foe.' }),
      'Throwing.Magnitude': Object.freeze({ default: Object.freeze([1, 2]), tuple: 'int', description: 'Fire damage a round, least and most.' }),
      'Throwing.Emission': Object.freeze({ default: true, description: 'A burning foe carries a light.' }),
      'Throwing.EmissionShadows': Object.freeze({ default: false, description: 'A burning foe\u2019s light casts shadows (DFU only; no twin here).' }),
      // MODS-ON (2026-09-14, Mac: "all mods should be on by default"): the
      // shipped modsettings.json carries `Sprite = False`, so the mod itself
      // ships its first-person hand switched off - and the hand is the mod's
      // whole subject. The HT2 audit measured what that costs: everything
      // works (all eight sprites decode and upload, the hand is free, the
      // torch is lit) and `draw()` still answers false, so a player lights a
      // torch and sees nothing. This ONE default departs; Ledger A row MODS-ON.
      'Modules.Sprite': Object.freeze({ default: true, description: 'Sprite: a first-person hand holding the lit torch or lantern.' }),
      'Modules.Bob': Object.freeze({ default: false, description: 'Bob: the sprite sways as you walk.' }),
      'Modules.Inertia': Object.freeze({ default: false, description: 'Inertia: the sprite lags the look and your movement.' }),
      'Modules.Step': Object.freeze({ default: false, description: 'Step: the sprite\u2019s position is rounded so it moves in steps.' }),
      'Presentation.Tint': Object.freeze({ default: true, description: 'Matches the weapon sprite\'s tint when using First-Person-Lighting.' }),
      'Presentation.Ambidexterity': Object.freeze({ default: false, description: 'Mirror the first-person graphic depending on the free hand. Recommended when using Shield Widget.' }),
      'Presentation.Scale': Object.freeze({ default: 0.8, min: 0.8, max: 1.2, float: true, step: 0.05, description: 'Size of the first-person sprite.' }),
      'Presentation.Offset': Object.freeze({ default: Object.freeze([0.5, 0.5]), tuple: 'float', description: 'Where the sprite rests: in from the side (of half the screen) and up from the bottom (of a quarter).' }),
      'Presentation.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'How fast the sprite slides on and off the screen.' }),
      'Presentation.LockAspectRatio': Object.freeze({ default: true, description: 'The sprite scales by the screen\u2019s width alone, keeping its proportions.' }),
      'Presentation.PlayerTorchAudio': Object.freeze({ default: true, description: 'Plays a looping burning SFX when you have a torch equipped' }),
      'Presentation.AudioVolume': Object.freeze({ default: 0.5, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Volume of the burning loop and the torch sounds.' }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, description: 'Amount of bobs in a single stride' }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Advances the bob timing. For use with weapon bob.' }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of horizontal movement when bobbing' }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of vertical movement when bobbing' }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between stationary and moving' }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between movement states' }),
      'Bob.Shape': Object.freeze({ default: 0, options: Object.freeze(["U", "Sideways 8", "Inverted U"]), description: 'Shape of bob' }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, description: 'Whether the shield will slightly bob while stationary' }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The maximum distance that the sprite will be offset' }),
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will move at towards the target offset' }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Multiplier for the change in scale when moving forward or backward' }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will scale towards the target depth' }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, description: 'The number (x8) whose multiples will be used for snapping' }),
      'Step.Condition': Object.freeze({ default: 0, options: Object.freeze(["Sheathe/Attack Only", "All Transforms"]), description: 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil' }),
      'Compatibility.TextureScaleFactor': Object.freeze({ default: 1, min: 0, max: 8, description: 'A custom texture\u2019s pixels per screen pixel of the 320x200 surface.' }),
    }),
  }),
  // AT0: AMBIENT TEXT 1.8 (Regnier). Its one section, `AmbientText`,
  // and its four SliderIntKeys, names, bounds and defaults exactly as
  // modsettings.json ships them, plus the port's own `Enabled`.
  // `interval` keeps the mod's own name and not the field's
  // (`stdInterval`) - the pane shows the player what the author called
  // it. All four are REAL-TIME SECONDS, not game time: the mod ticks on
  // Unity's `Time.unscaledTime`, so its pace is the same whether you
  // are standing still or riding a horse at 14x.
  'ambient-text': Object.freeze({
    title: 'Ambient Text',
    author: 'Regnier',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Regnier\u2019s Ambient Text 1.8, 1:1: an unobtrusive line about where you are, now and then, in the '
          + 'corner of the screen - what a crypt smells of, what a village sounds like at night, what the desert does '
          + 'to the light. It reads where you stand, the hour and the weather, and says nothing at all indoors. Off is '
          + 'silence.',
      }),
      textChance: Object.freeze({ default: 33, min: 0, max: 100, description: 'Chance % of selecting any ambient text each interval' }),
      interval: Object.freeze({ default: 200, min: 60, max: 600, description: 'Interval length between checking ambient text in real time seconds' }),
      postTextInterval: Object.freeze({ default: 500, min: 60, max: 600, description: 'Interval length after displaying a message in real time seconds' }),
      textDisplayTime: Object.freeze({ default: 3, min: 1, max: 10, description: 'Length of time text messages are displayed in seconds' }),
    }),
  }),
  // ── EYE OF THE BEHOLDER 2.1 (EOTB) ──────────────────────────────
  // RedRoryOTheGlen's third-person camera and player sprite, every key
  // the bundle's modsettings.json ships, under its own section name, as
  // it ships them - plus the port's own `Enabled`. Mac's ruling on why
  // a port that already has third person carries a second one
  // (2026-09-15): "This is moreso for those who opt out of using
  // morrowind." The Morrowind body needs Morrowind data; this one does
  // not, and `player/mwView.js` says in its own head that a player
  // without it "has no third person at all". Three defaults depart from
  // the bundle, each marked at its key.
  'eye-of-the-beholder': Object.freeze({
    title: 'Eye Of The Beholder',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'RedRoryOTheGlen\u2019s Eye Of The Beholder 2.1 (the camera and the sprite; its attack and death animations are not ported): third person without Morrowind data. Scroll out '
          + 'and the camera swings behind your shoulder, clearing walls on its own; you are drawn as the mod\u2019s own '
          + 'sprite, eight ways round, with idle, walk, attack and spell states on foot and in the saddle. Off keeps '
          + 'you in first person unless you have the Morrowind body.',
      }),
      'Camera.StartInThirdPerson': Object.freeze({ default: true, description: 'Determines the POV when starting or loading a game' }),
      'Camera.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'Camera.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'Camera.MinimumDistance': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, description: 'Prevents the camera from moving too close to the player. Value is a fraction of the Z offset.' }),
      'Camera.RidingOffset': Object.freeze({ default: 1.0, min: 0, max: 2, float: true, description: 'Additional scaling offset to Y and Z axes when riding.' }),
      'Camera.Speed': Object.freeze({ default: 10.0, min: 1, max: 20, float: true, description: 'How fast the camera catches up to where it should be.' }),
      'Camera.Dampen': Object.freeze({ default: 1.0, min: 0, max: 5, float: true, description: 'How much the camera lags behind a sudden move.' }),
      'Camera.Auto-Switch': Object.freeze({ default: true, description: 'X offset will be automatically mirrored if there is not enough space for the camera' }),
      'Camera.SwitchResetTime': Object.freeze({ default: 3.0, min: 0, max: 6, float: true, description: 'Time before the auto-switch is reverted. Set to 0 to disable' }),
      // EOTB4 (2026-09-15, Mac: "instead of numpad being used to change
      // views, I want it scrollable like how we handle morrowind").
      // THE MOD'S OWN KEY, KEPT AND SUPERSEDED. The wheel is the only
      // way in and out now, so this binding does nothing - listed all
      // the same, because the pane is a record of what the mod ships
      // and a key quietly deleted is a key nobody can ask about (the
      // shape HT's `Throwing.ShowTrajectory` is kept in).
      'Camera.TogglePerspective': Object.freeze({ default: 'KeypadEnter', text: true, description: 'The mod\u2019s own view key. The port takes the WHEEL instead \u2014 scroll out of first person and on out, as the Morrowind camera already does \u2014 so this binding is inert here.' }),
      // HT4's finding again, same author, same key: the mod ships Tab,
      // which is free in Daggerfall Unity and SPENT here - PX15 gave it
      // to the port's own pixel dial (ui/input.js). B is unbound in
      // DFU's defaults and unused by the port and by this mod's other
      // keys, and it stays the player's to rebind.
      'Camera.SwitchShoulder': Object.freeze({ default: 'B', text: true, description: 'Mirrors the camera\u2019s X offset if it is non-zero (the mod ships Tab; the port had already spent it on the pixel dial).' }),
      'CameraOverrideWeapon.Enable': Object.freeze({ default: false, description: 'Use this section\u2019s offsets while a weapon or spell is readied.' }),
      'CameraOverrideWeapon.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'CameraOverrideWeapon.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'CameraOverrideMount.Enable': Object.freeze({ default: false, description: 'Use this section\u2019s offsets while riding.' }),
      'CameraOverrideMount.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'CameraOverrideMount.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'CameraOverrideBoat.Enable': Object.freeze({ default: false, description: 'Use this section\u2019s offsets while sailing.' }),
      'CameraOverrideBoat.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.0]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'CameraOverrideBoat.LongitudinalDistance': Object.freeze({ default: 2.0, min: 0, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'CameraOverrideBoat.Target': Object.freeze({ default: 1, options: Object.freeze(['Hull', 'Masthead']), description: 'What the camera looks at while sailing.' }),
      // MODS-ON, and Mac's own ask. The mod ships this OFF, and it is
      // the arm the port's whole view seam is built on - with it off
      // there is no way into third person at all, because the key
      // above is inert here. Ledger A row MODS-ON, as HT's
      // `Modules.Sprite` is.
      'CameraScrolling.ScrollableZOffset': Object.freeze({ default: true, description: 'Move the camera closer to or further from the player with an axis' }),
      'CameraScrolling.ScrollIncrement': Object.freeze({ default: 0.2, min: 0.1, max: 1, float: true, description: 'Amount of distance travelled with every scroll' }),
      // `axis`, not `text`: this names a Unity input AXIS, not a
      // KeyCode, and the two are different kinds wearing the same
      // JSON type (TextKey). Declaring it as a key told HT4's
      // spent-key gate to resolve "Mouse ScrollWheel" as a binding,
      // which it is not and never could be. The port's wheel is the
      // DOM's, so this is informational here.
      'CameraScrolling.ScrollableZOffsetAxis': Object.freeze({ default: 'Mouse ScrollWheel', text: true, axis: true, description: 'The axis the mod reads to move the camera offset. The port takes the browser\u2019s own wheel, so this names the input rather than choosing it.' }),
      'AutoTogglePerspective.ToggleInput': Object.freeze({ default: 'KeypadPlus', text: true, description: 'Button that arms or disarms the automatic view changes below.' }),
      'AutoTogglePerspective.OnFoot': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot, with nothing readied.' }),
      'AutoTogglePerspective.OnFootMelee': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot with a weapon readied.' }),
      'AutoTogglePerspective.OnFootRanged': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot with a bow readied.' }),
      'AutoTogglePerspective.OnFootSpell': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot with a spell readied.' }),
      'AutoTogglePerspective.OnHorse': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take in the saddle.' }),
      'AutoTogglePerspective.OnHorseReady': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take in the saddle with something readied.' }),
      'AutoTogglePerspective.OnLycan': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take transformed.' }),
      'AutoTogglePerspective.OnTransitionInterior': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on stepping indoors.' }),
      'AutoTogglePerspective.OnTransitionExterior': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on stepping back outside.' }),
      'Graphics.Enable': Object.freeze({ default: true, description: 'Toggle the player graphic' }),
      'Graphics.OnFoot': Object.freeze({ default: 0, min: 0, max: 15, description: 'Sprite when on foot' }),
      'Graphics.OnHorse': Object.freeze({ default: 0, min: 0, max: 4, description: 'Sprite when riding a horse' }),
      'Graphics.ReadyStance': Object.freeze({ default: 2, options: Object.freeze(['Never', 'When Idle', 'When Idle or Moving']), description: 'Whether the sprite will change states when readying a weapon or spell' }),
      'Graphics.TurnToView': Object.freeze({ default: 2, options: Object.freeze(['Never', 'Only When Animating', 'When Weapon Readied', 'Always']), description: 'Configure when the sprite turns to face the view' }),
      'Graphics.AttackStrings': Object.freeze({ default: 3, options: Object.freeze(['None', 'Mirror', 'PingPong', 'Mixed']), description: 'Optional attack animations' }),
      'Graphics.MirrorTime': Object.freeze({ default: 3.0, min: 1, max: 5, float: true, description: 'Time before reverting the mirrored state. Set to 0 to disable.' }),
      'Graphics.PingPongOffset': Object.freeze({ default: 1, min: -3, max: 3, description: 'Adjusts the point in the animation where it starts playing backwards' }),
      'Graphics.FirstPersonBillboard': Object.freeze({ default: 1, options: Object.freeze(['None', 'Shadows Only', 'Visible']), description: 'Visibility of the player billboard in first-person' }),
      'Graphics.ShowCart': Object.freeze({ default: true, description: 'A 3D cart will follow your billboard when using the Cart Transport Mode' }),
      'Graphics.TorchOffset': Object.freeze({ default: 1, options: Object.freeze(['Vanilla', 'Billboard', 'Selfie']), description: 'Whether the torch follows the orientation of the sprite' }),
      'Animation.WalkCycleSpeed': Object.freeze({ default: 1.0, min: 0.5, max: 1.5, float: true, description: 'Multiplier on how fast the walk cycle plays.' }),
      'Animation.SyncFootsteps': Object.freeze({ default: true, description: 'Footstep sounds fire on the sprite\u2019s own footfalls.' }),
      'Animation.BillboardScale': Object.freeze({ default: 1.0, min: 0, max: 10, float: true, description: 'Size of the player sprite.' }),
      'Animation.FineBillboardScale': Object.freeze({ default: 0.0, min: 0, max: 1, float: true, description: 'Added to BillboardScale, for a finer adjustment.' }),
      'Animation.GlobalOffsetScale': Object.freeze({ default: 1.0, min: 0, max: 10, float: true, description: 'Multiplier on every sprite offset. INERT in the mod itself: its assembly reads the dial into a field nothing consumes (get_scaleOffset has no caller), and the port keeps that.' }),
      'Animation.FineGlobalOffsetScale': Object.freeze({ default: 0.0, min: 0, max: 1, float: true, description: 'Added to GlobalOffsetScale, for a finer adjustment - inert, as that is.' }),
      'Compatibility.Don\'tHideWeapon': Object.freeze({ default: false, description: 'Stops the FPV Weapon graphic from being hidden or shown' }),
      'Compatibility.Don\'tHideHorse': Object.freeze({ default: false, description: 'Stops the FPV Horse graphic from being hidden or shown' }),
      'Compatibility.Don\'tOffsetAttacks': Object.freeze({ default: false, description: 'Stops the attack-from-body code from running for melee and ranged' }),
      'Debug.ShowMessages': Object.freeze({ default: true, description: 'Print the mod\u2019s own status lines when the view or the shoulder changes.' }),
    }),
  }),
});

let memory = null;
function load() {
  if (memory) return memory;
  memory = {};
  try {
    const raw = appStorage()?.getItem(STORE_KEY);
    if (raw) memory = JSON.parse(raw) ?? {};
  } catch { memory = {}; }
  return memory;
}
function save() {
  try { appStorage()?.setItem(STORE_KEY, JSON.stringify(memory ?? {})); } catch { /* no storage */ }
}

/** DS1: a SliderIntKey (declared with min/max) reads as an integer
 *  clamped to its range; every other key is a ToggleKey and reads as a
 *  boolean, exactly as before. */
export function isIntKey(def) { return def && typeof def.min === 'number' && typeof def.max === 'number' && !def.float; }
/** WW1: a SliderFloatKey (Weapon Widget's speeds and sizes) - `float`
 *  declared, min/max its range, `step` the pane's stepper. */
export function isFloatKey(def) { return def && def.float === true && typeof def.min === 'number' && typeof def.max === 'number'; }
/** UL1: a MultipleChoiceKey - `options` is the list, the value its index. */
export function isChoiceKey(def) { return def && Array.isArray(def.options); }
/** HT1: a TextKey (Handheld Torches' three key bindings) - a Unity
 *  KeyCode name, `text` declared; the pane captures a key for it. */
export function isTextKey(def) { return def && def.text === true; }
/** HT1: a TupleIntKey / TupleFloatKey - `tuple` names the pair's kind,
 *  the value `[first, second]`. */
export function isTupleKey(def) { return def && (def.tuple === 'int' || def.tuple === 'float'); }
function coerce(def, v) {
  if (isTextKey(def)) {
    const t = typeof v === 'string' ? v.trim() : '';
    return t.length ? t : def.default;
  }
  if (isTupleKey(def)) {
    if (!Array.isArray(v) || v.length !== 2) return def.default;
    const pair = v.map((x) => (def.tuple === 'int' ? Math.trunc(Number(x)) : Math.round(Number(x) * 1000) / 1000));
    return pair.every(Number.isFinite) ? Object.freeze(pair) : def.default;
  }
  if (isChoiceKey(def)) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(def.options.length - 1, n)) : def.default;
  }
  if (isFloatKey(def)) {
    const f = Number(v);
    return Number.isFinite(f) ? Math.max(def.min, Math.min(def.max, Math.round(f * 1000) / 1000)) : def.default;   // WW1: on its range, to a thousandth
  }
  if (!isIntKey(def)) return !!v;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.max(def.min, Math.min(def.max, n)) : def.default;
}

/** MM1: a read across mods - `ModManager.GetMod(...)` / another mod's
 *  ModSettings - that answers undefined for a mod the port has not
 *  vendored (DFU: the mod is not loaded) instead of throwing. */
export function modSettingIfDeclared(vendor, key) {
  return MOD_SETTINGS[vendor]?.keys?.[key] ? modSetting(vendor, key) : undefined;
}

export function modSetting(vendor, key) {
  const def = MOD_SETTINGS[vendor]?.keys?.[key];
  if (!def) throw new Error(`modSetting: ${vendor}/${key} is not a declared switch`);
  const forced = onlineForcedModSetting(vendor, key);   // OL1: online is the enhanced lane, whole - `Enabled` reads true and the store is not written
  if (forced !== undefined) return forced;
  const v = load()[vendor]?.[key];
  return v === undefined ? def.default : coerce(def, v);
}

/** DS1: every key of one vendored mod, resolved - what a mod reads its
 *  ModSettings as, in one object. */
export function modSettingsOf(vendor) {
  const keys = MOD_SETTINGS[vendor]?.keys;
  if (!keys) throw new Error(`modSettingsOf: ${vendor} is not a vendored mod with switches`);
  const out = {};
  for (const k of Object.keys(keys)) out[k] = modSetting(vendor, k);
  return out;
}

export function setModSetting(vendor, key, value) {
  const def = MOD_SETTINGS[vendor]?.keys?.[key];
  if (!def) throw new Error(`setModSetting: ${vendor}/${key} is not a declared switch`);
  const m = load();
  const v = coerce(def, value);
  (m[vendor] ??= {})[key] = v;
  save();
  return v;
}

/** For tests: forget everything. */
export function _resetModSettings() { memory = null; try { appStorage()?.removeItem(STORE_KEY); } catch { /* none */ } }
