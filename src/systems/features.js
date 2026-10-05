// FT0 (2026-09-14, Mac: "merging mods, certain setting toggles and
// enhanced pane toggles into one universal place to toggle enhanceable
// features"): THE FEATURES REGISTRY - the one declared list behind the
// FEATURES home on the menu rail (ui/enhancedMenu.js paneFeatures).
//
// A feature is a ROW: a title, a note, the kinds it wears as coloured
// labels, and ONE control that names the store and key already
// backing it. The three stores stay where they are - DFU's 171-key
// settings (systems/settings.js), the port's own prefs
// (systems/uiPrefs.js), the vendored mods' modsettings
// (systems/modSettings.js) - and this list is the presentation over
// them: nothing here holds a LIVE value (RF4: a prefs row does declare
// its switch's default and its online answer, which the stores derive).
//
// A row may wear MORE THAN ONE kind (Mac, 2026-09-14): a switch that
// condenses the port's outdoors with Dynamic Skies' is Enhanced AND
// Mod Authored, and the filter shows it under either.
//
// THE LIST IS EMPTY AT FT0 AND FILLS ONE SLICE AT A TIME
// (bible/10-UI/Features-Arc.md - the inventory is the work list; a row
// is audited and fixed before it moves here). checkFeatures() is the
// registry's own law, pinned by test/features.test.js: every row's
// control must name a key its store really has, so a typo cannot ship
// a switch wired to nothing.

// RF4 (2026-09-14, Mac's refactor pass, the fourth): ONE DECLARATION.
// A new switch used to touch four places - the pref default on the
// uiPrefs shelf, the online lane's forced or player's-own list, the row
// here, and the count pins. The row is the one declaration now: a
// prefs-store control carries `initial` (the shelf's default) and
// `online` (the lane's answer: true/false forces it, 'player' leaves it
// to the player by name), and uiPrefs and onlineLane DERIVE theirs from
// FEATURE_PREF_DEFAULTS / declareOnlinePrefs. So this module sits UNDER
// the stores now and imports neither: the condensed rows' lanes (the
// land view's tiers and read/write, the outdoors') are registered by
// their own modules (registerFeatureLane) and resolved at use
// (resolveControl), which is what keeps world/landView.js -> uiPrefs ->
// features from closing a cycle on this file's constants.

import { ALL_KEYS } from './settings.js';
import { MOD_SETTINGS } from './modSettings.js';
import { declareOnlinePrefs } from './onlineLane.js';   // RF4: the lane learns its answers from the rows

/** The three kinds, in label order. `label` is what the row wears and
 *  the chip says; the colour is the skin's (ui/enhancedStyle.js .kind). */
export const KINDS = Object.freeze({
  enhanced: Object.freeze({ label: 'Enhanced', blurb: 'Built in house: the port’s own departures from Daggerfall.' }),
  mod: Object.freeze({ label: 'Mod Authored', blurb: 'Mods ported 1:1, under their authors’ names.' }),
  classic: Object.freeze({ label: 'DFU Classic', blurb: 'Daggerfall Unity’s own optional features.' }),
});
export const KIND_ORDER = Object.freeze(['enhanced', 'mod', 'classic']);

/** FT14 (2026-09-15, Mac: "get rid of the mod panel and integrate
 *  certain feature/mod adjustments into the toggle themselves and move
 *  away from the scrolling list format") - THE GROUPS.
 *
 *  A row's KIND says who wrote it; a row's GROUP says what it changes.
 *  The panel groups by the second and filters by the first, because
 *  which of them a player is looking for depends on the question they
 *  came with - "why does the grass look like that" is a group, "what
 *  is this port doing that Daggerfall Unity is not" is a kind - and
 *  only the group makes a useful heading. Twelve rows wearing
 *  "Enhanced" is not a section; nine rows about what you can SEE is.
 *
 *  In display order. Every row declares one. */
export const GROUPS = Object.freeze({
  sight: Object.freeze({ label: 'Sight' }),
  world: Object.freeze({ label: 'The world' }),
  loot: Object.freeze({ label: 'Loot & items' }),
  combat: Object.freeze({ label: 'Combat' }),
  // ORL1 (2026-09-17): the fifth group. A leveling system is not what
  // you see, where you are, what you carry or how you fight - it is
  // what you BECOME, and filing it under any of the four would have
  // been filing it under the nearest one rather than the right one.
  character: Object.freeze({ label: 'Your character' }),
  // FT18 (2026-09-25, Mac: "a comprehensive reorganize and consolidation of our mod/enhancements"): two more, because
  // Sight had grown to sixteen tiles and a third of them were not things you see in the world - the HUD's quick slots,
  // the map, the tooltips - and the sounds were spread over three groups. What is drawn OVER the world is the
  // interface; what you hear is sound.
  interface: Object.freeze({ label: 'Interface' }),
  sound: Object.freeze({ label: 'Sound' }),
});
export const GROUP_ORDER = Object.freeze(['sight', 'interface', 'sound', 'world', 'loot', 'combat', 'character']);

/** WM3: the Windmills pack's switch key. It is declared HERE with its
 *  row (RF4's law) rather than in `world/windmills.js`, because that
 *  module reads it through `uiPrefs` and `uiPrefs` reads this page's
 *  defaults - the other direction closes a cycle and the shelf loads
 *  before the row exists. */
export const WINDMILLS_KEY = 'windmills';

/** Where a control's value lives. */
export const STORES = Object.freeze(['prefs', 'settings', 'mods']);

/** FT9 (2026-09-14): A VENDORED MOD'S ROW - its own switch, its own
 *  title with the creator's name in it (Mac, 2026-09-08), its own
 *  description as the note. One source: modSettings.js, where the mod's
 *  modsettings ship - so FT15's trim of a mod's note is a trim of the
 *  description itself, and there is still no second copy. The mod's
 *  OTHER knobs open in this row's own tile drawer (MOD_CURATED, below).
 *  `effect` is the port's word on when the switch lands, per mod. */
const modFeature = (vendor, effect, group) => {
  const mod = MOD_SETTINGS[vendor];
  return Object.freeze({
    id: `mod-${vendor.toLowerCase()}`,
    group,
    title: `${mod.title} by ${mod.author}`,
    note: mod.keys.Enabled.description,
    effect,
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'mods', vendor, key: 'Enabled' }),
  });
};

/** FT14 (2026-09-15) - WHAT A MOD'S TILE SHOWS, AND WHAT IT DOES NOT.
 *
 *  The eight vendored mods carried 125 settings keys between them when
 *  this was written - Handheld Torches alone had 53 and the Weapon
 *  Widget 42, which was two thirds of the total in two mods. That is
 *  the real reason the Mods pane was a scroll, and no amount of layout
 *  fixes a list that long. So the tile shows the few a player would
 *  actually move (46 of the 125 then), and the rest keep the values the
 *  mod ships.
 *
 *  ORL1 (2026-09-17) RE-COUNTED RATHER THAN RE-WORDED: thirteen mods,
 *  227 keys, 65 shown. The ratio held as the list grew, which is the
 *  only thing the paragraph above was ever claiming - but a count in
 *  prose is a claim like any other, and leaving the old one standing
 *  would have read as the live number. The numbers are derivable
 *  (MOD_SETTINGS, modModules + modDials), so nothing here is the
 *  authority for them; they are here to be read beside the argument.
 *
 *  TWO SHAPES, because the mods have two. A key under `Modules.` is a
 *  SUB-FEATURE the mod can turn off whole (the Widget's nine: its
 *  swings, its bob, its recoil) - those are chips, and they are DERIVED
 *  rather than listed here, so a mod that gains a module gains a chip
 *  without an edit. Everything else is a DIAL, and dials are named,
 *  because that is the curation: `Swings.Speed` earns its place on the
 *  tile and `Swings.VanillaAlignmentOverride` does not.
 *
 *  A vendor absent from this table, or an empty list, shows its switch
 *  and nothing else - which is right for the mods that are one idea
 *  (Seasons of the Iliac Bay is on or it is off).
 *
 *  NOTHING IS LOST, only unlisted: the values stand as the mod's own
 *  modsettings ship them, and a key that needs to reach a player is one
 *  line here. The rows are rendered by the same `modRow` the Mods pane
 *  used, so a curated key is not a second copy of anything. */
export const MOD_CURATED = Object.freeze({
  // AUDIT FT14: Dynamic Skies has no row of its own - Enhanced environments IS its switch,
  // through FT4's three-way - so without these five its particle settings had no tile to open.
  'dynamic-skies': Object.freeze(['ActivatePixelSnow', 'densitySetting', 'MinParticleSize',
    'MaxParticleSize', 'MaxParticles']),
  // WORLD-HOVER: the mod's one knob, which is the one a player would move.
  'world-tooltips': Object.freeze(['HideDefaultInteractTooltip']),
  'weapon-widget': Object.freeze(['Swings.Speed', 'Bob.Length', 'Inertia.Scale']),
  // SW1: the three a player reaches for first - how big the shield sits,
  // where it sits, and what it does when the weapon comes out.
  'shield-widget': Object.freeze(['Shield.Scale', 'Shield.OffsetHorizontal', 'Shield.WhenAttacking']),
  // DW1: the one key besides the switch - the mod's own Weapon Widget preset, which its readme asks players to select.
  'diverse-weapons': Object.freeze(['WeaponWidgetPreset']),
  // RRI1: the three a player reaches for first - the new items, and what loot is.
  'roleplay-realism-items': Object.freeze(['newWeapons', 'newArmor', 'lootRebalance']),
  'roleplay-realism': Object.freeze(['advancedArchery', 'climbingRestriction', 'underworldExpulsion', 'shipPorts']),   // SHIP-PORTS: the boat's own switch, where a player can find it
  // KB1: a mod's KEYS are not dials. TORCH-BIND put the three TextKeys here because the hosts read them raw and
  // this was the only door left; they are the registry's actions now (systems/inputActions.js MOD_ACTIONS) and
  // are bound in Controls, under the mod's name, beside every other key - where a clash can be seen. The relaxed
  // switch rides along: 3ARMS ships it off. HT-WAIST: and the port's own lantern switch - a key the tile does not
  // draw is a key nobody can reach (TORCH-BIND's lesson).
  'handheld-torches': Object.freeze([
    'Handling.RelaxedTwoHandedWeapons', 'Handling.RememberLastLightSource', 'Handling.StowWhenSpellcasting', 'Handling.LanternsAtWaist', 'Bob.Length']),
  // HCC: the persistence switch and the distances a player reaches for (KB1: its two hotkeys are Controls').
  'horse-cart-and-cargo': Object.freeze(['Persistence.PhysicalPersistence',
    'Following.HorseFollowDistance', 'WagonAccess.InteriorAccessDistance', 'Following.AvoidCombat', 'Following.FollowFastTravel', 'Presentation.ShowTrailingWagon']),
  pcaao: Object.freeze(['equipmentDamageEnhanced', 'fadingEnchantedItems', 'armorHitFormulaRedone',
    'criticalStrikesIncreaseDamage', 'conditionBasedEffectiveness', 'softMaterialRequirements',
    'fixedStrengthDamageModifier']),
  unleveledLoot: Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril',
    'Adamantium', 'Ebony', 'Orcish', 'Daedric']),
  'roads-hazelnut': Object.freeze(['SmoothRoads', 'RiversAndStreams']),
  // DW-D: twenty-four keys in one section, and these six are what a player
  // reaches for first - how far the sea lets you see and how thick it is,
  // how much of it shows through from above, the swim's burst and speed,
  // and whether the deep is hostile. The rest stay in the mod's own pane.
  'iliac-puddle-no-more': Object.freeze(['General.UnderwaterFogDistance', 'General.UnderwaterFogStrength',
    'General.WaterSurfaceTopTransparency', 'General.EnableSwimStroke', 'General.SwimSpeedMultiplier', 'General.SpawnUnderwaterEnemies']),
  // OH-A: how many pits open, and how dark and thick the drowned dungeon under one is - the two a player
  // reaches for after the switch. The hole's size and the miasma stay in the mod's own pane.
  'ocean-holes': Object.freeze(['General.PitSpawnRate', 'General.DungeonVisualIntensity', 'General.DungeonVisualDarkness']),
  // CSA-A: fifty keys, and these four are what a player reaches for first - whether the sails trim themselves (the
  // mod's one real difficulty switch), the wind's widget, the waves and the boat's sounds. Its nine keys are
  // Controls' (KB1), and the handling, cargo and map dials stay in the mod's own pane.
  'come-sail-away': Object.freeze(['SailingAssist.AutoTrimming', 'WindDirectionWidget.Enable', 'Waves.Enable', 'Audio.SoundVolume']),
  // TO1: the mod ships FIFTY-ONE keys across twelve sections, so this
  // one is curated hard. The five are what a player reaches for first:
  // whether a cautious trip is walked, whether a ship needs a port,
  // what a location does to a journey in progress, how fast it may run
  // (RATE-LAW, 2026-10-04, Mac: "Remove travel options dials" - no longer:
  // the journey's ground sets its rate, systems/timeScale.js travelRateOf),
  // and (KB1: in Controls now, as FollowPaths) which key follows a road. Everything else - the fourteen dot
  // colours, the junction map's placement, the fare scaling - stays in
  // the mod's own pane.
  // TRAVEL-NAV1: and the port's own steering switch, on the tile so it is
  // REACHABLE (TORCH-BIND's lesson, HT-WAIST's pin) - a key the drawer does
  // not draw is a key nobody can turn.
  // OW-TOGGLE: and the port's own first-person switch, on the tile for the same reason.
  // TO-ROADS: and its roads, beside it - a first-person journey that follows them.
  // TO-LIVE (2026-10-02, Discord: "both cautious and reckless travel initiate time accelerated travel"): and Inns,
  // beside Cautiously - the other half of the mod's rule (ui/travelPopUp.js isPlayerControlledTravel). TO-FIELD2 turned
  // it on and FT14 took the pane it could be turned off in, so a trip stopping at inns - Recklessly's too - was always
  // a journey and no dial on any screen said why.
  // IT1: the four a player reaches for first - whether the carriage is the only fast travel, what the driver charges,
  // whether he crosses into another region, and whether he will put you on a ship. The rest - what he takes you to, the
  // ship captain's dials, the map's dots - stay in the mod's own pane.
  'immersive-travel': Object.freeze([
    'General.DisableNormalTravel', 'General.DailyCarriageFee', 'General.RegionLockedCarriages', 'ShipTravel.DisableShipTravelOutsideDocks',
  ]),
  'travel-options': Object.freeze([
    'CautiousTravel.PlayerControlledCautiousTravel', 'StopAtInnsTravel.PlayerControlledInnsTravel', 'ShipTravel.OnlyFromPorts',
    'GeneralOptions.LocationPause',
    'GeneralOptions.AvoidObstacles', 'GeneralOptions.FirstPersonTravel',
    'GeneralOptions.FirstPersonTravelFollowsRoads',
  ]),
  'ambient-text': Object.freeze(['textChance', 'interval', 'postTextInterval', 'textDisplayTime']),   // AT0: all four it ships - the mod is small enough that curation would only hide something
  // EOTB0: the mod ships FIFTY-FOUR keys across nine sections, so this
  // one IS curated, and the four are the ones a player reaches for
  // first: how far back the camera sits, which shoulder it sits over,
  // how fast it follows, and how big you are drawn. Everything else
  // stays in the mod's own pane.
  // KB1: its two keys (SwitchShoulder, ToggleInput) are Controls' ShoulderSwitch and AutoPerspective.
  // DISC23-B (Scratchie on Discord: "the game is not allowing us to choose between the different index slots"): the two
  // sprite sliders are NOT here. "The mod's own pane" went with FT14's Mods pane, so they were on no screen at all and
  // every player was the first set - and who you are drawn as is not a feature's dial: Mac put it on the PLAYER'S
  // PROFILE ("a choosable skin system in the menu player profile system itself instead of it being hidden in the
  // feature menu") - ui/skinCard.js, the picture of every set, in the window the door's profile mark opens.
  'eye-of-the-beholder': Object.freeze(['Camera.LongitudinalDistance', 'Camera.FrontalPlaneOffset',
    'Camera.Speed', 'Animation.BillboardScale']),
  // IF1: the clip quality and the two volumes are what a player reaches for.
  'immersive-footsteps': Object.freeze(['AudioQualitySettings.SoundClipQuality', 'FootstepSettings.FootstepVolumeMulti', 'ArmorSwaySettings.ArmorSwayVolumeMulti']),
  // BA1: the footsteps switch (off beside Immersive Footsteps), the echo, the darkness.
  'better-ambience': Object.freeze(['Better Footsteps.enable', 'Dungeon Reverb.level', 'Dungeon Lighting.dungeonDarkness']),
  // ORL1: the mod ships SEVEN knobs and `primarySkillsImpact` is the
  // port's own eighth (Daggerfall has a tier of chosen skills Morrowind
  // does not). All eight are on the tile - the
  // same call Ambient Text's row made, and for the same reason. These
  // are not presentation dials a player sets once; they are the rules
  // of the leveling system, and hiding four of them would leave a
  // player unable to see why their bar fills at the rate it does.
  'oblivion-remaster-leveling': Object.freeze(['attributePoints', 'maxUpdatableAttribute',
    'allowLuckIncrease', 'luckIncreaseCost', 'primarySkillsImpact', 'majorSkillsImpact',
    'minorSkillsImpact', 'miscSkillsImpact']),
});

/** The `Modules.` keys a vendor ships, in the mod's own order - the
 *  tile's chips. Derived, so a new module needs no edit here. */
export const modModules = (vendor) =>
  Object.keys(MOD_SETTINGS[vendor]?.keys ?? {}).filter((k) => k.startsWith('Modules.'));

/** The dials a vendor's tile shows, refused to keys the mod does not
 *  ship - a typo in the table above is a missing row, not a crash. */
export const modDials = (vendor) =>
  (MOD_CURATED[vendor] ?? []).filter((k) => MOD_SETTINGS[vendor]?.keys?.[k] !== undefined);

/** The rows. Shape:
 *    { id, title, note, effect?, kinds: [kind, ...],
 *      control: { store: 'prefs',    key, tiers?: [[value, label], ...], default?: value, read?: () => value, write?: (value) => void }
 *             | { store: 'settings', key: 'Section/Key' }
 *             | { store: 'mods',     vendor, key } }
 *  `effect` is the "takes effect when" line, if the switch has one.
 *  `read`/`write` (FT2) let a row that CONDENSES two stores show the
 *  live one and write both; absent, the row is getPref/setPref over its key.
 *  `also` (FT2) names the OTHER controls the row's write covers, so their
 *  own panes draw a pointer to this row instead of a second switch.
 *  `default` (FT4) is the tier a condensed row reads at the stores' own
 *  defaults, when its tiers are not the pref's values.
 *  `initial` and `online` (RF4) are a prefs row's declaration of its
 *  switch: the shelf's default, and the lane's answer (true/false to
 *  force it, 'player' to leave it). `lane` (RF4) names the registered
 *  lane a condensed row takes its tiers/default/read/write from. */
export const FEATURES = Object.freeze([
  // FT1 (2026-09-14): SMALLER DUNGEONS - DFU's Experimental/SmallerDungeons,
  // ported 1:1 at AUDIT 28 W4 (world/smallerDungeons.js). Mac's first
  // pick: "smaller dungeons should be a genuine enhanced feature that we
  // can build on instead of being hidden in the settings menu". DFU
  // Classic today; it wears Enhanced too the day the port builds on it.
  Object.freeze({
    id: 'smaller-dungeons',
    group: 'world',
    title: 'Smaller dungeons',
    note: 'Dungeons bigger than five blocks are cut down to five: a centre block with four around it, the same '
      + 'every visit. Main-story dungeons and dungeons a quest sends you to keep their full size, and online '
      + 'every dungeon is full size.',
    effect: 'Takes effect on the next dungeon you enter. A save made at the other size puts you at the dungeon\u2019s start.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Experimental/SmallerDungeons' }),
  }),
  // FT2 (2026-09-14): LAND VIEW DISTANCE - the first CONDENSED row. Two
  // controls for one radius: the pref (LV1, the enhanced lane's 1..6)
  // and DFU's Experimental/TerrainDistance (D1, the 1:1 lane's 1..4).
  // One row wearing both labels; it shows the lane's live radius and
  // writes both stores (world/landView.js landViewRead/landViewWrite).
  Object.freeze({
    id: 'land-view-distance',
    group: 'sight',
    title: 'Land view distance',
    note: 'How far the land around you is drawn, in map squares. Daggerfall Unity goes up to 4; the enhanced '
      + 'outdoors go up to 6. The classic UI, and the enhanced UI with the outdoors off, stop at 4.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'classic']),
    // LV1 (2026-09-12, Mac: "push the draw distance as far as we can push
    // it while keeping performance perfect"): the streamed grid's radius
    // in map pixels on the enhanced lane, 1..6; DFU's own Land View
    // Distance stays the 1:1 lane's 1..4. A dial: the player's online.
    control: Object.freeze({
      store: 'prefs', key: 'landViewDistance', initial: 5, online: 'player', lane: 'landView',   // the lane (world/landView.js) registers its tiers and its read/write
      classic: 3,   // FT18: Daggerfall's own radius, what All off sets (the row has no Off - a radius is never none)
      also: Object.freeze([Object.freeze({ store: 'settings', key: 'Experimental/TerrainDistance' })]),   // written by landViewWrite, capped at 4
    }),
  }),
  // FT4 (2026-09-14): THE OUTDOORS - Mac's own condensing example. EE1's
  // Enhanced environments (the port's) and Dynamic Skies' Enabled (the
  // mod's) decided the sky between them from two panes. One three-way
  // row: Daggerfall's outdoors, the enhanced outdoors under the port's
  // dome, or under Dynamic Skies' skybox (world/outdoors.js).
  Object.freeze({
    id: 'enhanced-environments',
    group: 'sight',
    title: 'Enhanced environments',
    note: 'A living sky with the sun, both moons and stars, clouds that build with the weather and cast '
      + 'shadows, falling rain and snow, and grass that bends in the wind. Off brings back Daggerfall’s '
      + 'painted sky and weather. The third choice uses Dynamic Skies by BadLuckBurt and carademono (included '
      + 'with permission), and its own settings open on this tile.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'mod']),
    // EE1: the outdoors as ONE switch (the sky, the ground's surfaces, the
    // cloud shadows, the grass, the weather and its evolution) because
    // they are one system; RA1 was the sky's own switch before it, and
    // the shelf's migration still reads its proceduralSky. On by
    // default; the lane forces it on.
    control: Object.freeze({
      store: 'prefs', key: 'enhancedEnvironments', initial: true, online: true, lane: 'outdoors',   // the lane (world/outdoors.js) registers its tiers, its default and its read/write
      also: Object.freeze([Object.freeze({ store: 'mods', vendor: 'dynamic-skies', key: 'Enabled' })]),   // written by outdoorsWrite while the outdoors are on
    }),
  }),
  // FT5 (2026-09-14): ENHANCED AI - the navmesh-driven enemy motor
  // (12-Enhanced-AI/Enhanced-AI-Arc.md), off by default because DFU's
  // classic motor is the 1:1 law. The words are AUDIT 59 F3's, kept
  // true by test/ft5_enhancedai.test.js against the arc's own list of
  // what is still ahead. NOT a merge with DFU's Enhancements/
  // EnhancedCombatAI ("Smarter Enemies", UNAVAILABLE in settings.js: the port runs the
  // classic path only) - a different thing that shares half a name,
  // which the note says outright so the two cannot be read as one.
  Object.freeze({
    id: 'enhanced-ai',
    group: 'combat',
    title: 'Enhanced AI',
    note: 'Enemies take turns and back off when hurt; archers keep away, cowards flee. Wound-up blows are marked on the '
      + 'ground: hit hard to stagger, dodge to punish; red, hatched iron cannot be stopped. Trees, rocks and crates block '
      + 'sight and missiles. Dungeons only for now for pathfinding: towns, interiors and doors are to come. Off keeps '
      + 'the classic movement and sight. This is not Daggerfall Unity’s “Smarter Enemies” setting, which the port does '
      + 'not run.',
    effect: 'At once - the dungeon pathfinding from the next dungeon you enter.',   // AUDIT TACT D7: the tactics, cover and blows read the switch live
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'enhancedAI', initial: false, online: true,   // OFF by default and it stays off: DFU's classic motor is the 1:1 law, this the port's departure (as EnhancedCombatAI is DFU's own opt-in)
      // TELL9 (bible/12-Enhanced-AI/Feud-Arc.md 11.3): telegraph contrast - thicker lines, a white keyline, a pattern for
      // every guard (render/foeTelegraph.js telegraphContrastOn); what THIS screen draws, so the player's online too
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'telegraphContrast', initial: false, online: 'player' })]),
      parts: Object.freeze([Object.freeze({ key: 'telegraphContrast', label: 'Telegraph contrast' })]),
    }),
  }),
  // CLIMB1 (2026-09-30, the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md):
  // the ledge sensor, the mantle and the vault (player/parkour.js). Offline
  // the enhanced skin's alone - the switch composes with it in scenes/shared.js
  // parkourSwitchOn, `?parkour=off` the kill door - and on for everyone
  // online whatever their skin, so nobody crosses a raid's rooftops a way
  // another cannot.
  Object.freeze({
    id: 'enhanced-climbing',
    group: 'world',
    title: 'Enhanced climbing',
    note: 'Press Jump at a ledge to climb onto or over it, or moving forward to vault a low wall. Jump at a high '
      + 'ledge to catch it and hang: Forward climbs up, Left and Right move along it, Crouch lets go. Hold '
      + 'Forward against any wall to climb it. Holding on wears out your grip; your Climbing skill sets how long it '
      + 'lasts, how high you reach and how fast you climb. Off keeps Daggerfall\u2019s climbing.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedClimbing', initial: true, online: true }),
  }),
  // FT6 (2026-09-14): ENHANCED WATER (WATER1) - the surface pass over the
  // terrain's water tiles on the enhanced skin; off, or the classic
  // skin, draws DFU's flat tile. The switch's composition has one home
  // now (render/waterSurface.js waterSwitchOn); `?water=off` is the kill door.
  Object.freeze({
    id: 'enhanced-water',
    group: 'sight',
    title: 'Enhanced water',
    note: 'Seas, rivers and ponds look like water: waves that grow with the wind, reflections of the sky and '
      + 'moon, rain on the surface and a soft shoreline. Off brings back Daggerfall’s flat water.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedWater', initial: true, online: true }),   // WATER1: on by default like the other enhanced visuals; `?water=off` the kill door
  }),
  // EL1 (2026-09-17, the Enhanced Lighting arc, tier one): the renderer's
  // lit world on a linear pipeline - render/enhancedLighting.js carries
  // the law; `?lighting=classic` is the kill door.
  Object.freeze({
    id: 'enhanced-lighting',
    group: 'sight',
    title: 'Enhanced lighting',
    note: 'Warmer, more natural light: lanterns and torches that glow and fade with distance, light through '
      + 'fog, shadows from the sun and your torch, darker corners, a glow on windows and flames, and rays of '
      + 'sunlight. Off is Daggerfall Unity’s flat lighting.'
      + ' Steady shadows stops shadows popping (off: more frame rate); Calmer eye slows how fast your eyes adjust.',
    effect: 'Lighting takes effect when the world next loads; steady shadows and calmer eye at once.',
    kinds: Object.freeze(['enhanced']),
    // OL-LIGHT (2026-09-24, Mac: "Can we let people disable it online"): THE PLAYER'S, ONLINE TOO. It was forced on
    // with the rest of the enhanced lane, so a player it did not suit - the interior flicker DISC15 closed, a GPU
    // that cannot carry forty-eight shadowed lanterns - had no way out online. Lighting is what THIS screen draws:
    // the room agrees on nothing through it (render/enhancedLighting.js lightingOn is its one reader, and no wire
    // field, relay law or shared roll reads the lane), the same shape as the chat's visibility and the peers'
    // sprites the lane already leaves to the player.
    // FLICKER-FIX (2026-10-02, Mac: "add it to enhanced lighting"): the steady-shadows switch is a PART of this row, as the wind's
    // wisps are (render/shadowPass.js SHADOW_TUNING.steady reads it each frame: no frame-skipping cadence, a stickier caster hold,
    // no lo-tier rebuild cap; off = EL8's schedule, cheaper but shadows can pop).
    control: Object.freeze({
      store: 'prefs', key: 'enhancedLighting', initial: true, online: 'player',
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'steadyShadows', initial: true, online: 'player' }), Object.freeze({ store: 'prefs', key: 'shadowDebug', initial: false, online: 'player' }), Object.freeze({ store: 'prefs', key: 'calmEye', initial: false, online: 'player' })]),   // FLICKER-FIX: shadowDebug prints the console log (render/shadowPass.js _debugLog); STEADY-BALANCE: calmEye, the slow eye on its own chip
      parts: Object.freeze([Object.freeze({ key: 'enhancedLighting', label: 'Lighting' }), Object.freeze({ key: 'steadyShadows', label: 'Steady shadows' }), Object.freeze({ key: 'calmEye', label: 'Calmer eye' }), Object.freeze({ key: 'shadowDebug', label: 'Shadow debug log' })]),
    }),
  }),
  // IIL1-T (2026-09-27, Mac: "add an alternative light on off option to test the modded lighting"): Improved Interior
  // Lighting off, on, or on with shadows - it only ever acts with its .dfmod attached (systems/improvedInteriorLighting.js);
  // "With shadows" runs its lights on the Enhanced Lighting lane, whose shadow maps the classic lane does not have.
  Object.freeze({
    id: 'modded-lighting',
    group: 'sight',
    title: 'Modded lighting (Improved Interior Lighting)',
    note: 'Needs the Improved Interior Lighting mod. Its warm, flickering lights replace the classic lighting, '
      + 'and with shadows on, lamps, people and monsters cast soft shadows too.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    // IIL1-T2 (Mac: "i dont want to [edit the address] thats why i wanted the options added"): the shadows the test
    // door gave, as the row's third tier
    control: Object.freeze({ store: 'prefs', key: 'moddedLighting', initial: 'on', online: 'player', tiers: Object.freeze([['off', 'Off'], ['on', 'On'], ['shadows', 'With shadows']]) }),
  }),
  // FT7 (2026-09-14): THE TWO QUALITY TIERS OF THE ENHANCED OUTDOORS
  // (PERF1) - the grass field's fraction and the clouds' march. Both
  // are inert unless the outdoors row above is on (world.js gates the
  // grass on enhancedEnvironments; the clouds ride the enhanced lane),
  // which each note now says. Enhanced, the port's own dials.
  // FT18: GRASS, ONE ROW. FT7's density and GRASS-PX's style (2026-09-21, Mac: "turn the grass into a pixel art
  // design") were two tiles over one field, and the style meant nothing until the density was above Off. The
  // density is the bar; the style is a PART, drawn in the tile's drawer. Both keys, both defaults, unchanged.
  Object.freeze({
    id: 'grass',
    group: 'sight',
    title: 'Grass',
    note: 'How much grass grows in the enhanced outdoors. Grass is the heaviest thing outdoors, so try Half '
      + 'first if the game runs slow. Pixel grass is hand-drawn tufts that match the trees and people; Smooth '
      + 'is softer, shaded blades.',
    effect: 'The amount takes effect when the world next loads; the style at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'grassDensity', initial: 1, online: 'player', tiers: Object.freeze([[1, 'Full'], [0.5, 'Half'], [0.25, 'Quarter'], [0, 'Off']]),   // PERF1: a fraction of the lab's 1.2 million blades; a dial, the player's online
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'grassStyle', initial: 'pixel', online: 'player' })]),   // GRASS-PX: a uniform in the one grass program, so it flips live
      parts: Object.freeze([Object.freeze({ key: 'grassStyle', label: 'Style', tiers: Object.freeze([['pixel', 'Pixel'], ['smooth', 'Smooth']]) })]),
    }),
  }),
  Object.freeze({
    id: 'cloud-quality',
    group: 'sight',
    title: 'Cloud quality',
    note: 'How detailed the clouds in the enhanced outdoors are. Low is lighter on your machine; High looks '
      + 'best if you have power to spare.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'cloudQuality', initial: 'default', online: 'player', tiers: Object.freeze([['default', 'Default'], ['lo', 'Low'], ['hi', 'High']]) }),   // PERF1: volumetricClouds.js QUALITY; a dial, the player's online
  }),
  // GRAIN2 (2026-09-19, Mac: "Why dont we crank it to 16?"): GROUND
  // SHARPNESS. GRAIN1 mipmapped the terrain tiles, which took the grain
  // off the distance and put a little blur in its place at a grazing
  // angle - and terrain is grazing almost everywhere. Anisotropy is the
  // one filtering term that buys that sharpness back, and how much of it
  // to ask for is a MACHINE's question, not a number to guess at once
  // for everybody: it is paid in fill rate, on the pass that covers the
  // most screen. 4x was a conservative default and nothing more. This is
  // the dial, so a machine with room can take the driver's maximum and a
  // laptop can drop to the mipmap alone. The player's own online, as the
  // cloud dial is.
  Object.freeze({
    id: 'ground-sharpness',
    group: 'sight',
    title: 'Ground sharpness',
    note: 'How sharp the ground looks into the distance. Off is the cheapest and blurs far ground; Maximum is '
      + 'the sharpest. Turn it down if the outdoors run slow.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'groundSharpness', initial: 'default', online: 'player', tiers: Object.freeze([['off', 'Off'], ['default', 'Default (4x)'], ['max', 'Maximum']]) }),
  }),
  // PERF-SCALE (2026-09-25, two players via Mac: "One user is reporting fps issues in the exterior but fine in the
  // interior ... GPU is NVIDIA GeForce RTX 4060 Ti", "me too my friend.. don't know why. I got a RX6600"): THE
  // RENDER SCALE. The world was drawn at the window's whole size with no cap, so a large window paid two to four
  // times the exterior's per-pixel work; this draws it smaller and presents it smooth (systems/renderScale.js
  // carries the law). Retro Picture Mode wins over it. A dial, the player's own online: it is this screen's pixels.
  Object.freeze({
    id: 'render-scale',
    group: 'sight',
    title: 'Render scale',
    note: 'Draws the world at a lower resolution and scales it up to fit; menus and the HUD stay sharp. Try 75% '
      + 'if the outdoors run slow on a big or high-resolution screen. Retro Picture Mode replaces this while '
      + 'it is on.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    // AUDIT BRANCH-0925 PS-A1: `classic` - the row has no Off, and Daggerfall's own frame is the whole window
    // (settings.js leaves DFU's resolution to the browser's canvas), so All off takes it to 100% (FT18's
    // "to Daggerfall's own where a row has no Off"); without it All off left the world drawn at 50%
    control: Object.freeze({ store: 'prefs', key: 'renderScale', initial: 1, online: 'player', classic: 1, tiers: Object.freeze([[1, '100%'], [0.85, '85%'], [0.75, '75%'], [0.67, '67%'], [0.5, '50%']]) }),
  }),
  // FT8 (2026-09-14): ENHANCED COMBAT VISUALS (ECV1) - what the enhanced
  // skin DRAWS for a concealed foe; the rules are DFU's either way. The
  // last row of the Enhanced category of Settings, which is a pointer
  // here now. Read once per frame by every foe host through
  // combatVisualsOn (systems/combatVisuals.js; `?combatvisuals=off` the
  // kill door), so a press takes effect at once.
  Object.freeze({
    id: 'enhanced-combat-visuals',
    group: 'sight',
    title: 'Enhanced combat visuals',
    note: 'Hidden enemies can be seen: a chameleon shimmers, a shadow is a silhouette, and an invisible enemy '
      + 'flashes when you hit it. The rules don’t change. Off hides them as the original does.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedCombatVisuals', initial: true, online: true }),   // ECV1: on by default like the other enhanced visuals; the rules are untouched either way
  }),
  // QUICK-LOOT B4 (2026-09-22, Mac: Arc B of the world-hover arcs, and
  // "How does skyrim do it" when the shape was put to him). Vanilla
  // Skyrim does not; what everyone means by it is the QuickLoot mod,
  // and this is that adapted to the port: the plaque Arc A already
  // draws under the crosshair grows a highlight the wheel moves, the
  // activate key takes the highlighted row, and a key of its own takes
  // the lot - without ever freeing the cursor or opening a window.
  //
  // It is NOT a port of anything. DFU has no quick loot and no mod in
  // vendor/ carries one, so the row says so plainly: this is the
  // port's own, and OFF is Daggerfall's loot exactly - the window the
  // activate key has always opened, untouched.
  //
  // DFU's own precedent for taking with no window is real and narrow:
  // a body holding nothing but arrows is taken whole (PlayerActivate
  // .cs:948-952). This generalises that to any row the player has
  // picked out, which is the departure and is recorded as one.
  //
  // It sits with LR1 in the `loot` group and AHEAD of it, because
  // WIND3 pins its wisps row to the seat directly after LR1's - so
  // the two loot rows stay together without moving a pinned one.
  Object.freeze({
    id: 'quick-loot',
    group: 'loot',
    title: 'Quick loot',
    note: 'Loot without opening a window: the mouse wheel moves through the list, Activate takes one item and '
      + 'one key takes everything, so you never stop aiming. Off uses the inventory window.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'quickLoot', initial: true, online: 'player' }),   // the player's own: it stands nothing, rolls nothing and is not on the wire - the same category chatHidden is (OL1)
  }),
  // LR1 (2026-09-14): LOOT RARITY - the port's own item ladder
  // (systems/lootRarity.js): Common, Magic, Rare, Legendary, with
  // DFU's artifacts as the ceiling. Enhanced, and ON (LR5, 2026-09-15,
  // Mac: "I want to mod on by default"). It shipped off beside
  // enhancedAI on the reasoning that a row changing the RULES waits to
  // be asked for; Mac's call is that this one is the port's own game
  // and should be what a player meets. The 1:1 lane is not lost - the
  // row is one press away, and off is DFU's loot exactly, field for
  // field.
  Object.freeze({
    id: 'loot-rarity',
    group: 'loot',
    title: 'Loot rarity',
    note: 'Weapons, armour and jewellery can drop as Magic, Rare or Legendary, with extra bonuses you can read '
      + 'and compare. The odds depend on what you killed, where, and your luck, never your level. Rare and '
      + 'Legendary items drop unidentified. Off is Daggerfall’s loot exactly. Online, some weapons carry a '
      + 'sigil that grows with your Renown.',   // SIGIL1
    effect: 'Takes effect on the next drop; items you wear update within a few seconds.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'lootRarity', initial: true, online: true }),   // LR5: ON by default (Mac) - the ladder is the port's own game, not an opt-in; the lane forces it on online as it always did
  }),
  // WIND3 (2026-09-14, Mac: wisps that show the wind, a quiet wind, the
  // trees moving with it): THE WIND SEEN AND HEARD - three rows over the
  // one wind (systems/windDrive.js), each the player's own online (a
  // look and a sound, nothing the room shares), each read every frame
  // by the exterior hosts. Kill doors `?wisps=off`, `?windaudio=off`,
  // `?sway=off`.
  // FT18: THE WIND SEEN, ONE ROW. WIND3's wisps and its sway were two tiles over one wind (the third, its sound, is
  // Enhanced sounds since ES1). The bar is both at once (systems/featureLanes.js 'wind'); each opens on its own in
  // the drawer. Both keys, both defaults, both kill doors (`?wisps=off`, `?sway=off`) unchanged.
  Object.freeze({
    id: 'wind',
    group: 'sight',
    title: 'Wind',
    note: 'See the wind in the enhanced outdoors: trees and plants lean and sway with it, and faint streaks of '
      + 'air show which way it blows and how hard.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'floraSway', initial: true, online: 'player', lane: 'wind',   // WIND3: systems/windDrive.js floraSwayOn; render/renderer.js BB_VS uSway
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'windWisps', initial: true, online: 'player' })]),   // WIND3: render/windWisps.js wispsOn
      parts: Object.freeze([Object.freeze({ key: 'floraSway', label: 'Trees sway' }), Object.freeze({ key: 'windWisps', label: 'Wisps' })]),
    }),
  }),
  // ES1 (2026-09-16, Mac: "lump this in as a new enhanced toggle. Enhanced
  // Sounds, add the wind noise to it"): WIND3's `wind-sound` row IS this
  // row now - one switch over the port's own sounds (systems/
  // enhancedSounds.js): the wind loop, the enhanced inventory's
  // transfer cues (MAC-O6), and (CLIMB4) the climb's hands and boots. The
  // kill door `?windaudio=off` still silences the wind alone.
  Object.freeze({
    id: 'enhanced-sounds',
    group: 'sound',   // FT18: was world
    title: 'Enhanced sounds',
    note: 'New sounds on the enhanced UI: a steady wind outdoors that rises and falls with its strength and '
      + 'goes quiet indoors, a coin clink when you take or store items in the enhanced inventory, and your hands '
      + 'and boots on stone when you climb.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'soundEnhancements', initial: true, online: 'player' }),   // ES1: systems/enhancedSounds.js enhancedSoundsOn; windAudio.js windSoundOn rides it
  }),
  // MAC-I + MAC-P (2026-09-17, Mac: "The classic sprite should react to
  // lighting (first person)" and "morrowind's first person view also
  // doesn't receive lighting and is consistently dark"): the viewmodel
  // takes the room's light, in BOTH lanes. FPSWeapon.Tint is DFU's own
  // channel for the sprite and DFU core never writes it (FPSWeapon.cs:108,
  // :182) - that is the First-Person Lighting mod's job there; the
  // Morrowind arms had a fixed STUDIO light, right for a UI picture and
  // wrong for a thing standing in the world. One answer feeds both
  // (render/renderer.js flatLightAt, the FLAT's own four terms at the
  // camera). On by default, because a hand that ignores the dark is the
  // thing that was reported; off returns the white DFU draws and the
  // studio the arms had.
  Object.freeze({
    id: 'first-person-lighting',
    group: 'sight',
    title: 'First-person lighting',
    note: 'What you hold in first person takes the light of where you stand: your weapon, your spellcasting '
      + 'hands, the torch in your off hand and the Morrowind arms.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'firstPersonLighting', initial: true, online: 'player' }),   // MAC-I: combat/weaponRig.js fpLightingOn
  }),
  // MAP-TOGGLE (2026-09-22, Mac: "is the enhanced map a toggle?" - "Yes
  // needs to be a toggle"): the held sheet was the enhanced skin's alone,
  // with no way to keep the skin and take DFU's own maps back. The three
  // map doors read this beside the skin now (ui/mapSkin.js heldMapWorn).
  Object.freeze({
    id: 'enhanced-map',
    group: 'interface',   // FT18: was sight
    title: 'Enhanced map',
    note: 'One hand-drawn parchment map for the world, towns and dungeons, held in your hands, that you can pan '
      + 'and zoom. Off uses Daggerfall’s three map windows.',
    effect: 'Takes effect the next time a map is opened.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'heldMap', initial: true, online: 'player' }),   // the player's own: what THEIR map looks like
  }),
  // EM3-3D (2026-09-27, Mac: "The dungeon map becomes the new default option, the current 2d enhanced becomes an
  // option, not removed"): the held map's dungeon sheet in the round (ui/inkDungeonSolid.js, ui/inkDungeonGL.js) -
  // turned, tilted and zoomed as DFU's 3D automap is - is the default; off is EM3's flat plan, whole. Read where the
  // sheet is built (ui/mapSkin.js dungeonMap3dOn), so a change takes the next map opened; `?dungeonmap=flat` stays
  // the kill door. The held map's own row above still decides whether there is a held map at all.
  Object.freeze({
    id: 'dungeon-map-3d',
    group: 'interface',
    title: '3D dungeon map',
    note: 'The enhanced map shows dungeons in 3D, hand-drawn: turn, tilt and zoom it, with every floor you’ve '
      + 'explored at its own height. Off shows one flat floor at a time.',
    effect: 'Takes effect the next time a map is opened.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'dungeonMap3d', initial: true, online: 'player' }),   // the player's own, as the held map's is
  }),
  // WEATHER2b (2026-09-14, Mac: "a dynamic world space event system where
  // weather can be traveled out of and into"): THE WEATHER FIELD - the
  // day's words as places (systems/weatherField.js), read by the sim
  // every exterior frame (weatherSim.js weatherFieldOn). FORCED ON
  // ONLINE: one field for every player under the shared day's roll.
  // `?wxfield=off` the kill door.
  Object.freeze({
    id: 'weather-events',
    group: 'world',
    title: 'Weather as places',
    note: 'Rain, storms and snow move across the land with the wind, so you can see a storm coming, walk into '
      + 'it and out the other side. Off uses Daggerfall’s weather, the same everywhere in the region.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'weatherEvents', initial: true, online: true }),   // WEATHER2b: weatherSim.js weatherFieldOn; forced on online - one sky
  }),
  // FOREST1 (2026-10-01, the Discord's "Real Forests" thread): REAL
  // FORESTS - the wilderness's trees gathered into woods with open land
  // between them, in place of DFU's even scatter (world/terrainNature.js
  // layoutForests). FORCED ON ONLINE: the woods are where Logging's trees
  // stand (scenes/treeHost.js standTrees), so a room has one forest.
  // `?forests=off` the kill door; scenes/shared.js realForestsOn composes it.
  Object.freeze({
    id: 'real-forests',
    group: 'world',
    title: 'Real forests',
    note: 'Trees grow together in forests, with open grassland between them. Dungeons, ruins, shrines and camps '
      + 'are often hidden in the woods, and towns and farms stand in cleared fields. Deserts are unchanged. '
      + 'Off spreads the trees evenly, as Daggerfall does.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'realForests', initial: true, online: true }),
  }),
  // NEARBY-QUESTS (2026-10-04, Discord: "quests of the game you take from guilds and so on need to be near you on
  // overworld map"): a remote quest site is drawn near the player, within a reach that grows with level
  // (systems/quest/questReach.js; systems/quest/place.js reads it as each new quest picks its sites). The player's own
  // online too: a quest's sites are its taker's, and no wire field or shared roll reads the switch.
  Object.freeze({
    id: 'nearby-quests',
    group: 'world',
    title: 'Nearby quests',
    note: 'Quests from guilds, temples, nobles and townsfolk send you to towns and dungeons near where you took them, a '
      + 'day or two away at first and farther as you level, until by level fifteen or so anywhere in the region will do. '
      + 'Off picks anywhere in the region from the start, as Daggerfall does.',
    effect: 'Takes effect on the next quest you take; quests you already have keep their places.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'nearbyQuests', initial: true, online: 'player' }),
  }),
  // LW2 (2026-10-04, Mac: "NPCs are no longer just random walking entities"): THE LIVING WORLD
  // (bible/06-Systems/Living-World.md) - a town's people are its residents, each with a name, a home, a trade and a
  // day (systems/livingWorld/livingTown.js stands them where DFU's wandering pool stood). The player's own online: every
  // resident is a pure function of the town and the sky's clock, so nothing anyone shares reads the switch; off, and on
  // the classic skin, DFU's PopulationManager walkers 1:1.
  Object.freeze({
    id: 'living-world',
    group: 'world',
    title: 'Living world',
    note: 'Townsfolk are residents with names, homes, trades and days of their own - they open their shops, meet at '
      + 'the square and the tavern, talk among themselves, sleep at night and remember how you treated them, and '
      + "everyone online sees the same people. Off, the streets fill with Daggerfall's wandering strangers, gone at dusk.",
    effect: 'Takes effect when a town next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'livingWorld', initial: true, online: 'player' }),
  }),
  // FT9 (2026-09-14): THE PACKS WITH A SWITCH (Dynamic Skies' is the
  // outdoors row's, FT4). The order is the old Mods pane's.
  //
  // WM3 (2026-09-15, Mac: "the windmills of daggerfall is missing from
  // credits and the feature menu"): AND WINDMILLS, WHICH HAD NO ROW
  // BECAUSE IT HAD NO SWITCH. This note used to say exactly that - "a
  // row needs a control" - which described the machinery correctly and
  // answered the wrong question. It only became visible at FT14, which
  // retired the Mods pane: that pane had listed every vendored pack
  // whether or not it had a knob, and it was the only place Kamer's
  // name appeared outside the About page's credits. A mod with no
  // switch is a mod a player cannot turn off OR find; the switch is
  // the fix for both.
  //
  // It is a PREF and not a `modFeature`, because `modFeature` builds a
  // row out of a vendor's own `Enabled` setting key and this pack has
  // no shipped settings file to carry one - the port bakes its meshes
  // from the author's source. The row is the declaration (RF4), and
  // `world/windmills.js` reads it beside the turn it gates.
  Object.freeze({
    id: 'mod-windmills-kamer',
    group: 'world',
    title: 'Windmills of Daggerfall by Kamer',
    note: 'Windmills with turning sails on seven farms, with machinery inside and a look for every climate and '
      + 'season. Off leaves the farms as Daggerfall has them.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: WINDMILLS_KEY, initial: true, online: 'player' }),
  }),
  modFeature('seasons-iliac-bay', 'Takes effect when the world next loads.', 'sight'),   // FT18: was world
  modFeature('low-poly-trees', 'Takes effect when the world next loads.', 'sight'),   // LPT1: read once, as the world loads
  modFeature('roads-hazelnut', 'Takes effect when the world next loads.', 'world'),
  // TO1 (2026-09-17): TRAVEL OPTIONS - `world`, because what it changes
  // is how you cross it. The effect line is the SWITCH's (FT9: when each
  // switch lands), and the switch is read once at world load (AUDIT
  // PRE-MERGE 0928 U7), as are the mod's own "won't take effect without
  // restarting DFU" keys (its roads integration and its junction map).
  // TO-LIVE (2026-10-02): its other dials are read again as they change
  // (scenes/world.js refreshTravelOptionsSettings).
  modFeature('travel-options', 'Takes effect when the world next loads.', 'world'),
  // IT1 (2026-10-04): IMMERSIVE TRAVEL - `world`, the carriages at the city gates. Its gate blocks and its two factions
  // are laid when the game loads (the world-data door latches its blocks, the faction dictionary is built at the load);
  // its fares and its rules are read as a driver's map opens.
  modFeature('immersive-travel', 'Takes effect when the game is next started (an in-game Load keeps what it started with); its fares and rules at the next map.', 'world'),
  // WOD1 (2026-09-23): WORLD OF DAGGERFALL - `world`, because it is the
  // wilderness itself. Read at the world's mount, like the roads it
  // consults: the loader's list is built once per world.
  modFeature('world-of-daggerfall', 'Takes effect when the world next loads.', 'world'),
  // AS1 (2026-09-25): AQUATIC SPRITES - `world`, three flooded dungeon
  // blocks. The door caches a block once it is served, so a switch flipped
  // mid-session reaches the next load, not the dungeon you stand in.
  modFeature('aquatic-sprites', 'Takes effect when the game next loads.', 'world'),
  // DS1 (2026-09-25): DETAILED SHIPS - `world`, the two ships you can own.
  // Their building records are read through the door once per load.
  modFeature('detailed-ships', 'Takes effect when the game next loads.', 'world'),
  // WD3 (2026-10-01): BEAUTIFUL VILLAGES and BEAUTIFUL CITIES - `world`, the towns themselves. The world-data
  // loader reads each switch once, when the game loads (scenes/modWorldData.js latches it), so a town never moves
  // under the player; online the room owns both.
  modFeature('beautiful-villages', 'Takes effect when the game is next started (an in-game Load keeps the towns it started with). Offline it also needs Replace Game Artwork.', 'world'),   // AUDIT WD3 B9
  modFeature('beautiful-cities', 'Takes effect when the game is next started (an in-game Load keeps the towns it started with). Offline it also needs Replace Game Artwork.', 'world'),   // AUDIT WD3 B9
  // WA1 (2026-09-25): WARM ASHES - SHIPS - `world`, the sea voyage. The travel
  // hook reads the switch as a journey starts; an ambush already at sea
  // finishes either way.
  modFeature('warm-ashes-ships', 'Takes effect on your next sea voyage.', 'world'),
  // RAID1 (2026-09-27): WORLD EVENTS - RAIDING PARTIES - `world`, the towns'
  // raids. The runner reads the switch every frame: off, nothing is rolled,
  // announced or stood, and a raider already standing fights on uncounted.
  modFeature('world-events-raiding-parties', 'Takes effect at once.', 'world'),
  // DW-A to DW-D (2026-09-25): ILIAC PUDDLE NO MORE - `world`, the sea itself. The
  // world host builds the deep bay (its host, its renderer, its swimmer) at
  // the world's mount, so the switch reaches the next world; its looks and
  // its swim read their dials every frame.
  modFeature('iliac-puddle-no-more', 'Takes effect when the world next loads.', 'world'),
  // OH-A (2026-09-26): THERE'S A HOLE IN THE BOTTOM OF THE OCEAN - `world`, a pit in
  // the sea. Its pits are stood as the world builds the seafloor, so the switch
  // reaches the next world; its sliders re-evaluate the loaded pits (its own
  // LoadSettings callback) and the abyss's two read on the frame.
  modFeature('ocean-holes', 'Takes effect when the world next loads.', 'world'),
  // CSA-A (2026-09-27): COME SAIL AWAY - `world`, a boat you own and sail. Its
  // two item templates (1320, 1321) merge when the game loads
  // (ItemHelper.LoadItemTemplates), so the switch reaches the next load.
  modFeature('come-sail-away', 'Takes effect when the game next loads.', 'world'),
  // FORAGE1 (2026-09-28): FORAGING - `world`, the wilderness's work. A tool
  // and a food read the switch as they are used; the quest pack is offered
  // while it is on. AUDIT 28 F4: the pack is read once, when the quest lists
  // are built (questLists.js) - so the row says the two halves apart.
  modFeature('foraging', 'Takes effect at once; its quests when the game next loads.', 'world'),
  modFeature('meanerMonsters', 'Takes effect on monsters that appear after the change.', 'combat'),
  modFeature('pcaao', 'Takes effect at once.', 'combat'),
  modFeature('unleveledLoot', 'Takes effect on the next drop or shop restock.', 'loot'),
  modFeature('weapon-widget', 'Takes effect at once.', 'combat'),   // WW1: the widget reads its switches every frame
  modFeature('shield-widget', 'Takes effect at once.', 'combat'),   // SW1: the same - every switch is read on the frame
  modFeature('diverse-weapons', 'Takes effect when a weapon is next drawn.', 'combat'),
  modFeature('roleplay-realism-items', 'Takes effect when the game next loads.', 'loot'),   // RRI1: the template patches are merged at load (ItemHelper.LoadItemTemplates); the classes read their switches live; RRI2: the nine modules read theirs at each roll (a corpse, a shelf, a price), the starting kit and spellbook at the next character   // DW1: the atlas name is chosen at the weapon's load (FPSWeapon.cs:637-644), and the rig's cache key carries it
  modFeature('roleplay-realism', 'Takes effect when the game next loads.', 'loot'),   // RR1: the class enemies' appearance is written into the basics at load (RoleplayRealism.cs:186-189); every other arm reads its switch at the roll
  modFeature('handheld-torches', 'Takes effect at once.', 'loot'),   // HT1: the component reads its switches every frame
  // AT0 (2026-09-15): AMBIENT TEXT - `world`, because what it talks
  // about is where you are. Its effect line is the mod's own pacing:
  // off falls silent at once, and on hands the mod back a clock that
  // has been running the whole time (AT1 - the interval keeps running
  // while the mod is quiet, exactly as it does while you are indoors).
  modFeature('ambient-text', 'Takes effect at once.', 'interface'),   // FT18: was world
  // EOTB0 (2026-09-15): EYE OF THE BEHOLDER - third person for a
  // player with no Morrowind data (Mac: "This is moreso for those who
  // opt out of using morrowind"). Filed under `world` rather than
  // `combat`: it changes where you see the whole game from, not how a
  // blow lands. The effect line is honest about the one thing that is
  // not immediate - the view itself is the WHEEL's now (EOTB4), so
  // turning the row on does not move the camera until the player
  // scrolls.
  modFeature('eye-of-the-beholder', 'Takes effect at once. Scroll out to leave first person.', 'sight'),   // FT18: was world
  // IF1 (2026-09-16): IMMERSIVE FOOTSTEPS - the component reads its
  // switches every frame; the stride is the mod's the moment its clips are
  // decoded (a fetch here, where the mod's LoadAudio is synchronous).
  modFeature('immersive-footsteps', 'Takes effect at once.', 'sound'),   // FT18: was world
  modFeature('world-tooltips', 'Takes effect at once.', 'interface'),   // FT18: was world   // WORLD-HOVER: the hover reads the switch on the frame it draws
  // BA1 (2026-09-16): BETTER AMBIENCE - read every frame; the dungeon's fog
  // and light are rolled at the door, so those two land on the next dungeon.
  modFeature('better-ambience', 'Takes effect at once; a dungeon\u2019s fog and light from the next one you enter.', 'world'),
  // HCC (2026-09-23): HORSE CART AND CARGO - `world`, because what it
  // changes is what stands in it: your horse and wagon as physical things.
  // The runtime reads its switches every frame (HandleSettingsChanged is
  // the mod's own listener); turning it off recalls the pair to you.
  modFeature('horse-cart-and-cargo', 'Takes effect at once.', 'world'),
  // WS1 (2026-09-17): WEAPON SHEATHING - Greatness7's scabbards and the
  // OpenMW mechanism, on the port's Morrowind third-person body. The
  // switch is the port's own pref (the mod ships no settings of its own);
  // RF4: declared here, once, the shelf's default and the online answer
  // riding the row.
  //
  // MODS-ONLINE-3 (2026-09-22, Mac): THE PLAYER'S, like every other mod
  // row. It was forced "so every body a peer sees wears its blade the
  // same way" - which is a claim about how MY machine DRAWS someone
  // else, not about anything the room agrees on. That is the same
  // category as `peerClassSprites`, which this lane has always left
  // alone for exactly this reason. A scabbard stands no object, rolls
  // nothing, writes nothing and never reaches the wire; the pose's `wd`
  // carries whether a peer's weapon is drawn either way.
  Object.freeze({
    id: 'mod-weapon-sheathing',
    group: 'combat',
    title: 'Weapon Sheathing',
    note: 'With the Morrowind body, a sheathed weapon stays on you, on your hip or back in a scabbard, with a '
      + 'quiver for a bow. Off, a put-away weapon disappears, as in Morrowind.',
    effect: 'Takes effect at once with the Morrowind body.',   // FT18: the Mods page it named is gone - the tile rebuilds it (enhancedMenu.js TILE_AFTER)
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: 'mwSheathing', initial: true, online: 'player' }),
  }),
  // ORL1 (2026-09-17): OBLIVION-REMASTER-LIKE LEVELING - the first
  // Morrowind mod, and the only row whose effect line has to say NEXT
  // CHARACTER. Every other mod's switch lands on the running game; this
  // one decides whether a character is ASKED the question at creation,
  // and the answer then rides that character's save. Turning it off
  // does not convert a character who is already levelling by virtues,
  // and saying so on the tile is the honest line - the alternative is a
  // player flipping the switch mid-game and wondering why nothing moved.
  modFeature('oblivion-remaster-leveling', 'Takes effect on the next character you make; a character keeps the system they were created with.', 'character'),
  // FT10 (2026-09-14): DFU'S OWN DUNGEON ENHANCEMENTS - three of the
  // Enhancements section's switches, each read by the port at the point
  // of use as DFU reads it. DFU Classic: Daggerfall Unity's departures
  // from classic Daggerfall, ported 1:1, shipping at DFU's own defaults.
  // The titles are the settings pane's (settingsCopy.js LABELS), so the
  // pointer rows there and the rows here say one name.
  Object.freeze({
    id: 'enemy-infighting',
    group: 'combat',
    title: 'Enemies Fight Each Other',
    note: 'Monsters attack anything they aren’t allied with, not just you: a bear fights a spider, a Daedra '
      + 'fights a knight. On by default in Daggerfall Unity.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/EnemyInfighting' }),
  }),
  Object.freeze({
    id: 'varied-dungeon-monsters',
    group: 'world',
    title: 'Varied Dungeon Monsters',
    note: 'Random monsters are picked from the dungeon’s full list around your level, so a dungeon has more '
      + 'variety instead of the same few. Off by default in Daggerfall Unity.',
    effect: 'Takes effect on the next dungeon you enter.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/AlternateRandomEnemySelection' }),
  }),
  Object.freeze({
    id: 'torches-from-items',
    group: 'loot',
    title: 'Torches Light Your Way',
    note: 'Your light in dungeons comes from a torch, lantern or candle you carry, and it burns down, instead '
      + 'of a light you always have. Off by default in Daggerfall Unity.',
    effect: 'Takes effect at once; new characters and shop stock follow it.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/PlayerTorchFromItems' }),
  }),
  // FT11 (2026-09-14): THE REST OF DFU'S SWITCHES - the four booleans
  // left in the Enhancements section and the one choice (Video's
  // RandomDungeonTextures, an enum the settings law already draws). The
  // numeric tunings of the section (the wait limit, the light scales)
  // are settings, not features, and stay in Settings.
  Object.freeze({
    id: 'combat-voices',
    group: 'sound',   // FT18: was combat
    title: 'Combat Voices',
    note: 'You and your enemies grunt when swinging and cry out when hit. The sounds are in Daggerfall but '
      + 'never used. On by default in Daggerfall Unity.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/CombatVoices' }),
  }),
  Object.freeze({
    id: 'near-death-warning',
    group: 'interface',   // FT18: was combat
    title: 'Near Death Warning',
    note: 'The screen pulses as your health gets low: slowly below 40%, fast below 20%. On by default in '
      + 'Daggerfall Unity.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/NearDeathWarning' }),
  }),
  Object.freeze({
    id: 'bows-left-hand',
    group: 'combat',
    title: 'Bows In Left Hand',
    note: 'Bows go in your left hand only, so you can keep a one-handed weapon in your right and switch between '
      + 'them. Off by default in Daggerfall Unity.',
    effect: 'Takes effect on the next weapon you equip.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/BowLeftHandWithSwitching' }),
  }),
  Object.freeze({
    id: 'choose-guild-jobs',
    group: 'interface',   // FT18: was world
    title: 'Choose Guild Jobs',
    note: 'Guilds show you a list of the jobs you can take instead of giving you one at random. Off by default '
      + 'in Daggerfall Unity.',
    effect: 'Takes effect the next time a guild offers you work.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/GuildQuestListBox' }),
  }),
  Object.freeze({
    id: 'dungeon-wall-style',
    group: 'sight',
    title: 'Dungeon Wall Style',
    note: 'Which textures dungeon walls use: Daggerfall’s own (Classic), the region’s climate (Climate), or '
      + 'random (Random). Climate and Random keep main-story dungeons classic; Climate Only and Random Only '
      + 'change them too. Classic by default in Daggerfall Unity.',
    effect: 'Takes effect on the next dungeon you enter.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Video/RandomDungeonTextures', classic: 0 }),   // FT18: Classic, what All off sets - a choice with no Off
  }),
  // QS (2026-09-17, Mac: the Demon's Souls diamond, "slots for the
  // mainhand/secondhand, consumable"): THE QUICKSLOT DIAMOND's switch.
  // The switch hides the DIAMOND alone - the three keys and the tooltip's
  // slot buttons keep working, because a player who turns the picture off
  // has not asked to lose the presses. Enhanced skin only; the classic HUD
  // never drew one.
  // FT18: QUICK SLOTS, ONE ROW. QS's diamond switch and HB1's quickbar-or-hotbar were two tiles over one corner of
  // the HUD, and the diamond's switch did nothing while the hotbar was up (HB1 puts the diamond away). Three states,
  // one bar (systems/featureLanes.js 'quickSlots'): Off is QS's - the diamond hidden, its keys still working.
  // HB-LYCFREE (2026-09-30, Mac: "want to make the hotbar the default on option"): Hotbar is the default; a shelf that
  // chose Off before it keeps Off (systems/uiPrefs.js loadPrefs, shelf rev 2).
  Object.freeze({
    id: 'quick-slots',
    group: 'interface',
    title: 'Quick slots',
    note: 'Diamond puts your weapon, off hand and two quick items in a diamond at the bottom left, set from the '
      + 'inventory. Hotbar puts ten slots above your health bars on keys 1 to 0, filled by dragging from your '
      + 'pack and spellbook. Off hides the diamond, but its keys still work.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'quickbarStyle', initial: 'hotbar', online: 'player', lane: 'quickSlots',   // HB1: ui/enhancedHotbar.js HOTBAR_PREF
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'quickslots', initial: true, online: 'player' })]),   // QS: ui/enhancedHud.js hides the diamond on false
    }),
  }),
  // LOAD1 (2026-10-05, Mac: "add loading screens where needed for the game in an enhanced UI type fashion, maybe make
  // it where people can also use screenshots for the loading screen and a way to access them in the menu"): THE
  // LOADING SCREEN (ui/loadingScreen.js) - the place, the step and a running bar over one of the player's own
  // screenshots (systems/shotGallery.js; the menu's Screenshots pane decides which) or the menu's night sky. DFU has
  // none - its loads are the fade - so Off is Daggerfall's. The player's own online: it is a picture, nobody else's.
  Object.freeze({
    id: 'loading-screen',
    group: 'interface',
    title: 'Loading screens',
    note: 'While the world loads - starting a game, a dungeon\u2019s door, a fast travel, a save - a screen shows where '
      + 'you are going over one of your screenshots (chosen under Screenshots in the menu) or the menu\u2019s night sky. '
      + 'Off is Daggerfall\u2019s, with no screen.',
    effect: 'Takes effect at the next load.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'loadingScreen', initial: 'shots', online: 'player',   // ui/loadingScreen.js LOADING_PREF
      tiers: Object.freeze([['shots', 'Your screenshots'], ['art', 'Night sky'], ['off', 'Off']]),
    }),
  }),
  // GUIDE3 (2026-09-29, Mac: "...make it more accessible", then "This is your baby"): THE HERALD - a quest's news as
  // a notice in the enhanced stack (ui/questHerald.js), fed by the quest bridge's tick. On by default (the arc's
  // DECISIONS: the silence it answers is DISC6's report); the player's own online, since news is no one else's.
  Object.freeze({
    id: 'quest-herald',
    group: 'interface',
    title: 'Quest news',
    note: 'A notice slides in when a quest begins, when its journal gains an entry, when a deadline it gave you has '
      + 'under a day left, and when it ends. Off is Daggerfall’s silence: the journal changes without a word.',   // AUDIT GUIDE H1
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questHerald', initial: true, online: 'player' }),   // ui/questHerald.js HERALD_PREF
  }),
  // GUIDE4 (2026-09-29): THE TRACKER - the quest you follow as a card at the HUD's right-upper edge (ui/questTracker.js),
  // fed by the same look. On by default but quiet (DECISIONS 2): it follows the quest the journal last changed until
  // the player tracks one from the journal, and shows nothing with no quest to follow. The player's own online.
  Object.freeze({
    id: 'quest-tracker',
    group: 'interface',
    title: 'Quest tracker',
    note: 'A card at the top right shows the quest your journal last changed - its newest entry, where it points and '
      + 'the time left - or the one you track from the journal. Off is Daggerfall’s HUD, which says nothing of quests.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questTracker', initial: true, online: 'player' }),   // ui/questTracker.js TRACKER_PREF
  }),
  // GUIDE5 (2026-09-29): THE MARKS - where a quest points, on the held map and the enhanced compass (ui/questMarks.js):
  // only a place the player's map already holds, never the quest debugger's knowledge. On by default (DECISIONS 7).
  Object.freeze({
    id: 'quest-marks',
    group: 'interface',
    title: 'Quest marks',
    note: 'Your quests\u2019 places are marked on the map, and the one you follow on the compass - only places your map '
      + 'already holds. Off is Daggerfall\u2019s map and compass, which mark nothing for a quest.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questMarks', initial: true, online: 'player' }),   // ui/questMarks.js MARKS_PREF
  }),
  // CAMP1 (2026-09-17, Mac: camps and roaming packs in the wilderness):
  // an original addition, not a DFU classic feature - the classic game
  // spawns wandering monsters one at a time. This is a second roll
  // (systems/campEncounters.js) that places a small group instead. Off
  // returns the wilderness to lone wanderers; nothing about the
  // single-encounter roll changes either way.
  Object.freeze({
    id: 'wilderness-camps',
    group: 'world',
    title: 'Wilderness camps & packs',
    note: 'Out in the wilds you sometimes meet a small group of enemies, a camp or a roaming pack, instead of '
      + 'only one at a time. Off keeps the classic single encounters.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'wildernessCamps', initial: true, online: 'player' }),
  }),
  // WILD-ROAD (FIELD BUGS 2026-10-04e, Discord: "having to completely halt my travel because 1 rat chose today to die
  // can be quite the interruption"): systems/roadEncounters.js - the port's own. On a journey or the Overworld, a
  // wanderer far beneath the traveller is passed by and the rest bring company now and then. Off is DFU's wanderer.
  Object.freeze({
    id: 'road-encounters',
    group: 'world',
    title: 'Encounters on the road',
    note: 'While you travel, an enemy far below your level is passed by instead of stopping you, and the rest sometimes '
      + 'come as a patrol. Off stops for every encounter, as Daggerfall does.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'roadEncounters', initial: true, online: 'player' }),
  }),
  // DISC19-F (2026-09-24, Discord through Mac: "enhance guard
  // interaction"): THE WATCH DEFENDS THE TOWN (systems/townWatch.js) -
  // the port's own. DFU's combat watch exists only for a crime; this
  // brings it, as the player's ally, when a monster hunts the player
  // inside a town. Off is DFU's watch alone.
  Object.freeze({
    id: 'town-watch',
    group: 'world',   // FT18: was combat
    title: 'The watch defends the town',
    note: 'When a monster attacks you in a town and you’re not wanted, the town guard comes to help, then '
      + 'leaves once it’s safe. Commit a crime and they come for you as usual. Off keeps the classic guard, '
      + 'which only shows up for crimes.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'townWatch', initial: true, online: 'player' }),
  }),
  // SURV2 (2026-09-18, Mac: "All on by default"): THE SURVIVAL ARC -
  // an overhaul of Ralzar's Climates & Calories (vendor/climates-
  // calories/README.md), not a port. The one switch for the whole of
  // it: the felt temperature and the five needs on the world minute,
  // the food, water and camping items the store shelves and a new
  // character carries, camps and campfires, the costed rest.
  // Off is the classic game: no needs, no provisions minted.
  // SURV-TIERS (2026-09-23): the one switch is three tiers now - Off,
  // Casual (the default: the needs only borrow stamina, and a rest,
  // a meal or a drink never costs more than it gives) and Hard (the arc
  // as above, the costed rest with it); survival/difficulty.js.
  // BLOOD1 (2026-09-19, Mac: "I really want to try and build our own
  // version as close to 1:1 as possible" / "read in how their module
  // works so we can achieve our own type of parity") - THE PORT'S OWN
  // blood, and an ENHANCED row rather than a mod row because no mod is
  // vendored for it. DaggerBlood is the reference for the feel and
  // nothing else: no code, no art, no Mod-Registry row
  // (bible/05-Combat/Blood-Arc.md carries the whole of that reasoning),
  // so there is no author's name to put in the title the way every
  // `modFeature` row carries one.
  //
  // ON by default: the splash has always played, and the mark is what a
  // player expects to still be there when they walk back through.
  Object.freeze({
    id: 'blood',
    group: 'combat',
    title: 'Blood',
    note: 'Stains stay on floors and walls where blood lands. A big killing blow sprays it further, and a heavy '
      + 'hit on you splashes a few drops on the screen. The slider sets how much, from Light to Abattoir; Off '
      + 'keeps the classic splash that fades away.',
    effect: 'Takes effect at once; how many marks stay, when the game next loads or you enter a dungeon.',
    kinds: Object.freeze(['enhanced']),
    // FT18: BLOOD, ONE ROW. BLOOD1's marks, BLOOD1b's overkill, BLOOD2e's lens and BLOOD2g's gore were four tiles over
    // one system, and the gore dial had no Off: the one question a player asks - blood or no blood - took three
    // presses. The bar is the gore dial with an Off in front (systems/featureLanes.js 'blood'); the three switches
    // are PARTS, each its own in the drawer. ONLINE THEY ARE THE PLAYER'S: a mark is a local picture with no
    // gameplay in it, so every player answers for themselves.
    control: Object.freeze({
      store: 'prefs', key: 'blood-gore', initial: 'normal', online: 'player', lane: 'blood',   // BLOOD2g: combat/bloodSwitch.js GORE_TIERS
      also: Object.freeze([
        Object.freeze({ store: 'prefs', key: 'blood-marks', initial: true, online: 'player' }),
        Object.freeze({ store: 'prefs', key: 'blood-overkill', initial: true, online: 'player' }),
        Object.freeze({ store: 'prefs', key: 'blood-screen', initial: true, online: 'player' }),
      ]),
      parts: Object.freeze([
        Object.freeze({ key: 'blood-marks', label: 'Marks stay' }),
        Object.freeze({ key: 'blood-overkill', label: 'Overkill' }),
        Object.freeze({ key: 'blood-screen', label: 'On the lens' }),
      ]),
    }),
  }),
  Object.freeze({
    id: 'mod-climates-calories',   // a mod-row id: WM3's law reaches the credits' vendor through it
    group: 'character',
    title: 'Climates & Calories by Ralzar',   // AUDIT SURV E: the author's name, as every mod row carries it
    note: 'Heat, cold, rain and travel wear you down, so eat, drink, sleep, dress for the weather and rest by a '
      + 'campfire or in a bed. On Casual, unmet needs only drain some stamina (never more than half) and it '
      + 'comes back once you’ve seen to them; on Hard they cost attributes and health and can make you sick; '
      + 'Off is the classic game.',
    effect: 'Takes effect at once. Online, each player picks their own.',
    kinds: Object.freeze(['mod', 'enhanced', 'classic']),   // AUDIT SURV E: a mod row, under the MOD AUTHORED filter
    // MODS-ONLINE-3 (2026-09-22, Mac): THIS IS A MOD ROW AND IT IS THE
    // PLAYER'S. The lane forced it because the system is the PORT's code
    // rather than a vendored mod - a distinction that exists nowhere a
    // player can see it. It sits in the Mods pane under Ralzar's name,
    // beside sixteen rows that are all the player's now, and it was the
    // only one still locked.
    //
    // It passes the same reading they did. The system is resolved
    // entirely on the machine that owns the actor: hunger, thirst,
    // exposure and the temperature are computed fresh each tick from MY
    // climate, MY clothes and MY race, onto MY entity; a camp is local
    // (the braziers are scenery the terrain already carries either way);
    // a shop's stock is its own. The one thing that leaves this machine
    // is a corpse's food, minted by the KILLER in the enemy-death
    // handler - and a corpse's pile is already the owner's word, granted
    // to peers as it stands (WORLD6b-iii(c)). That is the same shape as
    // Unleveled Loot, which is the player's: whoever swings rolls what
    // falls. A room where one player's kills carry meat and another's do
    // not is two players playing their own game, not two worlds.
    //
    // SURV-TIERS (2026-09-23, Mac: "Off, Casual, Hard" - Casual on by
    // default, "but still let it be able to be turned off for online"):
    // THREE TIERS ON THE ONE KEY, and the same reading holds for each -
    // a tier decides only what MY body pays (survival/difficulty.js), so
    // every tier, Off included, stays the player's online. The segments
    // write difficulty.js SURVIVAL_STORED - Off as the old switch's own
    // `false` (AUDIT SURV-TIERS: an older build reading the same shelf
    // still sees Off as off), Casual and Hard by name - and the default
    // is its SURVIVAL_DEFAULT (test/survtiers.test.js holds the row to
    // them, as the Gore row is held to GORE_TIERS).
    control: Object.freeze({
      store: 'prefs', key: 'survival', initial: 'casual', online: 'player',
      tiers: Object.freeze([[false, 'Off'], ['casual', 'Casual'], ['hard', 'Hard']]),
    }),
  }),
  // NAV (2026-09-28, Mac: "proper naval combat with a huge reference to assassins creed black flag ... directly integrate
  // into online mode"): THE SEA FIGHT (bible/03-World/Naval-Combat.md) - the port's own, on Come Sail Away's hulls, so
  // it stands nothing without that mod. ONE SWITCH, FORCED ON ONLINE: the ships at sea are the room's world (one player
  // stands the sea for everyone near - scenes/navalHost.js), and a room where one player sees the pirate boarding another
  // and the other does not is two worlds. The rest is each player's own: the traffic the sea they stand is filled with,
  // whether pirates grapple THEIR boat, and whether THEIR voyage's beaten raiders leave a hold to plunder.
  Object.freeze({
    id: 'naval-combat',
    group: 'combat',
    title: 'Naval Combat',
    note: 'Ship battles on Come Sail Away\u2019s boats: at the helm, look to one side and hold Attack to aim a broadside, '
      + 'then let go to fire. Pirates, merchant ships and navies sail the Bay; batter a ship until she surrenders, board '
      + 'her, take her cargo, then sink her or let her go. Piracy is a crime, and pirates who board you bring Warm '
      + 'Ashes\u2019 raids. Online, everyone in the room shares one sea.',
    effect: 'Takes effect at once; Ship handling, the next time you take the helm. Online, the sea is on for everyone.',   // AUDIT NAV2 F14: the helm takes the handling once a session (comeSailAway.js responsive)
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'naval', initial: true, online: true,   // scenes/world.js navalOn: the host stands down and empties the sea
      also: Object.freeze([
        Object.freeze({ store: 'prefs', key: 'naval-ships', initial: 'some', online: 'player' }),   // systems/naval/navalDirector.js DENSITY
        Object.freeze({ store: 'prefs', key: 'naval-boarders', initial: true, online: 'player' }),   // navalHost.js: a pirate's grapple on MY boat
        Object.freeze({ store: 'prefs', key: 'naval-raid-prize', initial: true, online: 'player' }),   // navalHost.js leaveShipGate: the voyage raiders' hold
        Object.freeze({ store: 'prefs', key: 'naval-aim-camera', initial: true, online: 'player' }),   // navalHost.js aimEye: the broadside camera (AUDIT NAV1)
        Object.freeze({ store: 'prefs', key: 'naval-handling', initial: 'responsive', online: 'player' }),   // systems/helmWay.js: HELM-WAY's responsive helm, or Come Sail Away's own
        Object.freeze({ store: 'prefs', key: 'naval-auto-repair', initial: true, online: 'player' }),   // navalHost.js: QUICK-REPAIRS' own repairs once a fight is over
      ]),
      parts: Object.freeze([
        Object.freeze({ key: 'naval-ships', label: 'Ships at sea', tiers: Object.freeze([['few', 'Few'], ['some', 'Some'], ['many', 'Many']]) }),
        Object.freeze({ key: 'naval-boarders', label: 'Pirates board you' }),
        Object.freeze({ key: 'naval-raid-prize', label: 'Raiders\u2019 plunder' }),
        Object.freeze({ key: 'naval-aim-camera', label: 'Broadside camera' }),
        Object.freeze({ key: 'naval-handling', label: 'Ship handling', tiers: Object.freeze([['responsive', 'Responsive'], ['classic', 'Classic']]) }),
        Object.freeze({ key: 'naval-auto-repair', label: 'Crew repairs on their own' }),
      ]),
    }),
  }),
]);

// ── RF4: the lanes, and what the stores derive ────────────────────
const _lanes = new Map();
/** A condensed row's LANE - its tiers, its `default` in the tiers'
 *  vocabulary, its read/write over two stores - registered by the
 *  module that owns them (world/landView.js, world/outdoors.js) at its
 *  own load, so this registry imports nothing above the stores. */
export function registerFeatureLane(name, lane) { _lanes.set(name, Object.freeze({ ...lane })); }
export const featureLane = (name) => _lanes.get(name) ?? null;
/** A row's control with its lane's fields folded in - what the menu
 *  and the checks read. */
export function resolveControl(f) {
  const c = f?.control;
  if (!c || typeof c !== 'object' || !c.lane) return c;
  return { ...c, ...(_lanes.get(c.lane) ?? {}) };
}
/** Every prefs-store switch a row declares: its own control, and (FT18) the prefs a condensed row covers - a
 *  covered pref is declared on the row that covers it, `initial` and `online` beside its key, because the row it had
 *  of its own is gone and RF4's law is that the row is the one declaration. */
const declaredPrefs = (list) => list.flatMap((f) => [f.control, ...(f.control?.also ?? [])])
  .filter((c) => c?.store === 'prefs' && c.initial !== undefined);
/** The prefs-store keys the rows declare: key -> the shelf's default. */
export const FEATURE_PREF_DEFAULTS = Object.freeze(Object.fromEntries(declaredPrefs(FEATURES).map((c) => [c.key, c.initial])));
/** ...and key -> the online lane's answer (true/false forced, 'player'). */
export const FEATURE_PREF_ONLINE = Object.freeze(Object.fromEntries(declaredPrefs(FEATURES).map((c) => [c.key, c.online])));
declareOnlinePrefs(FEATURE_PREF_ONLINE);

/** The row whose control is this store's key, or null. The settings
 *  pane asks it for every key it draws: a key that lives on the home
 *  is drawn there as a pointer, not as a second switch (one home per
 *  idea). */
export function featureForControl(store, key, vendor = null) {
  const is = (k) => k.store === store && k.key === key && (store !== 'mods' || k.vendor === vendor);
  return FEATURES.find((f) => is(f.control) || (f.control.also ?? []).some(is)) ?? null;   // FT2: a covered control points here too
}

/** Does this store hold this key? The three stores answer differently
 *  and this is the one place that knows how. */
function storeHas(control) {
  switch (control.store) {
    case 'prefs': return typeof control.key === 'string' && !!control.key;   // RF4: the row IS the shelf's declaration of the key
    case 'settings': return ALL_KEYS.includes(control.key);
    case 'mods': return !!MOD_SETTINGS[control.vendor]?.keys?.[control.key];
    default: return false;
  }
}

/** Everything wrong with one row, as sentences; [] when it is sound. */
export function checkFeature(f) {
  const out = [];
  if (!f || typeof f !== 'object') return ['not an object'];
  if (typeof f.id !== 'string' || !f.id) out.push('no id');
  if (typeof f.title !== 'string' || !f.title) out.push('no title');
  if (!GROUPS[f?.group]) out.push(`unknown group '${f?.group}'`);   // FT14: every row says what it changes, not only who wrote it
  if (!Array.isArray(f.kinds) || !f.kinds.length) out.push('no kinds');
  else {
    for (const k of f.kinds) if (!KINDS[k]) out.push(`unknown kind '${k}'`);
    if (new Set(f.kinds).size !== f.kinds.length) out.push('a kind repeated');
  }
  const c = resolveControl(f);   // RF4: the lane's fields count as the row's
  if (!c || typeof c !== 'object') out.push('no control');
  else if (!STORES.includes(c.store)) out.push(`unknown store '${c.store}'`);
  else if (!storeHas(c)) out.push(`${c.store} has no key '${c.store === 'mods' ? `${c.vendor}/` : ''}${c.key}'`);
  else if (c.store === 'prefs') {
    // RF4: a prefs row is the ONE declaration of its switch - the shelf's default and the lane's answer ride it
    if (c.initial === undefined) out.push('a prefs row declares its initial value');
    if (!(c.online === true || c.online === false || c.online === 'player')) out.push("a prefs row declares its online answer: true, false or 'player'");
    if (c.lane && !_lanes.has(c.lane)) out.push(`lane '${c.lane}' is not registered`);
    if (c.tiers !== undefined) {
      if (!Array.isArray(c.tiers) || !c.tiers.length) out.push('tiers is not a list');
      else {
        // FT4: a condensed row's tiers are its own vocabulary, so it names its default itself
        const def = c.default ?? c.initial;
        if (!c.tiers.some(([v]) => String(v) === String(def))) out.push(`tiers do not include the default ${def}`);
      }
    }
  }
  if (c && typeof c === 'object' && c.also !== undefined) {
    // FT2: every control the row ALSO covers is a real key of its store
    if (!Array.isArray(c.also)) out.push('also is not a list');
    else for (const a of c.also) {
      if (!a || !STORES.includes(a.store)) out.push(`also: unknown store '${a?.store}'`);
      else if (!storeHas(a)) out.push(`also: ${a.store} has no key '${a.store === 'mods' ? `${a.vendor}/` : ''}${a.key}'`);
      else if (a.store === 'prefs') {
        // FT18: a covered pref is declared where it is covered - RF4's law, one row over
        if (a.initial === undefined) out.push(`also: the covered pref '${a.key}' declares its initial value`);
        if (!(a.online === true || a.online === false || a.online === 'player')) out.push(`also: the covered pref '${a.key}' declares its online answer`);
      }
    }
  }
  if (c && typeof c === 'object' && c.parts !== undefined) {
    // FT18: a PART is one of the row's own prefs, drawn in its tile's drawer - the row's key or one it covers, a
    // label, and tiers when it is a choice rather than a switch
    const own = new Set([c.key, ...(Array.isArray(c.also) ? c.also.filter((a) => a?.store === 'prefs').map((a) => a.key) : [])]);
    if (c.store !== 'prefs') out.push('parts are prefs, on a prefs row');
    if (!Array.isArray(c.parts) || !c.parts.length) out.push('parts is not a list');
    else for (const pt of c.parts) {
      if (!pt || !own.has(pt.key)) out.push(`part '${pt?.key}' is not the row's key or one it covers`);
      if (typeof pt?.label !== 'string' || !pt.label) out.push(`part '${pt?.key}' has no label`);
      if (pt?.tiers !== undefined && (!Array.isArray(pt.tiers) || pt.tiers.length < 2)) out.push(`part '${pt?.key}': tiers is not a list`);
    }
  }
  if (c && typeof c === 'object' && c.classic !== undefined) {
    // FT18: the value that is Daggerfall's own, on a row with no Off - one of its own tiers, or an index of its enum
    const ok = c.store === 'prefs' ? Array.isArray(c.tiers) && c.tiers.some(([v]) => String(v) === String(c.classic))
      : c.store === 'settings' && Number.isInteger(c.classic) && c.classic >= 0;
    if (!ok) out.push(`classic '${c.classic}' is not one of the row's values`);
  }
  if (c && typeof c === 'object') {
    // FT2: a condensed row's read and write are functions or absent - never one without the other
    if (c.read !== undefined && typeof c.read !== 'function') out.push('read is not a function');
    if (c.write !== undefined && typeof c.write !== 'function') out.push('write is not a function');
    if ((c.read === undefined) !== (c.write === undefined)) out.push('read and write come together');
  }
  return out;
}

/** Everything wrong with the list: per-row problems, prefixed by id,
 *  plus a repeated id or a repeated control (two rows over one switch). */
export function checkFeatures(list) {
  const out = [];
  const ids = new Set();
  const controls = new Set();
  list.forEach((f, i) => {
    const name = f?.id ?? `#${i}`;
    for (const p of checkFeature(f)) out.push(`${name}: ${p}`);
    if (ids.has(f?.id)) out.push(`${name}: id repeated`);
    ids.add(f?.id);
    const c = f?.control;
    if (c && typeof c === 'object') {
      for (const k of [c, ...(Array.isArray(c.also) ? c.also : [])]) {   // FT2: a covered control is a control
        const sig = `${k.store}:${k.vendor ?? ''}:${k.key}`;
        if (controls.has(sig)) out.push(`${name}: control repeated (${sig})`);
        controls.add(sig);
      }
    }
  });
  return out;
}

/** FT18 (Mac: "Add search bar to mods/enhancements in the ingame pause menu"): the words a row is found by - its
 *  title, its note, its labels and group, its parts, and a mod's vendor and author - folded to lower case with the
 *  accents and curly quotes a player will not type taken out. */
const fold = (t) => String(t ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'").toLowerCase();
export function featureSearchText(f) {
  const c = f?.control ?? {};
  const mod = c.store === 'mods' ? MOD_SETTINGS[c.vendor] : null;
  return fold([f?.title, f?.note, GROUPS[f?.group]?.label, ...(f?.kinds ?? []).map((k) => KINDS[k]?.label),
    ...(c.parts ?? []).map((pt) => pt.label), mod?.title, mod?.author, c.vendor].filter(Boolean).join(' \n '));
}
/** Does a row answer this query? Every word must be found (in any order); an empty query finds everything. */
export function matchesFeatureQuery(f, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = featureSearchText(f);
  return words.every((w) => text.includes(w));
}

/** The rows wearing `kind`; every row when kind is null. */
export function filterFeatures(list, kind) {
  return kind == null ? list.slice() : list.filter((f) => f.kinds.includes(kind));
}

/** The chip counts: every row, then per kind (a two-kind row counts
 *  under both, because the filter shows it under both). */
export function featureCounts(list) {
  const out = { all: list.length };
  for (const k of KIND_ORDER) out[k] = 0;
  for (const f of list) for (const k of f.kinds) if (out[k] !== undefined) out[k] += 1;
  return out;
}
