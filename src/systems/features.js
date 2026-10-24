// FT0 (2026-09-14, Mac: "merging mods, certain setting toggles and
// enhanced pane toggles into one universal place to toggle enhanceable
// features"): THE FEATURES REGISTRY - the one declared list behind the
// FEATURES home on the menu rail (ui/enhanced/enhancedMenu.js paneFeatures).
//
// A feature is a ROW: a title, a note, the kinds it wears as coloured
// labels, and ONE control that names the store and key already
// backing it. The three stores stay where they are - DFU's 171-key
// settings (systems/settings/settings.js), the port's own prefs
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
// registry's own law, pinned by test/systems/features.test.js: every row's
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

import { ALL_KEYS } from './settings/settings.js';
import { MOD_SETTINGS } from './modSettings.js';
import { declareOnlinePrefs } from './online/onlineLane.js';   // RF4: the lane learns its answers from the rows
import { t, localizedText } from './textManager.js';   // L10N4: the screen's words in the player's language, read as they are read

/** The three kinds, in label order. `label` is what the row wears and
 *  the chip says; the colour is the skin's (ui/enhanced/enhancedStyle.js .kind).
 *  L10N4: every word on this page is a getter over t(), so a reader reads
 *  the player's language at the moment it reads - never English frozen at
 *  load, before the boot has chosen the language. */
export const KINDS = Object.freeze({
  enhanced: Object.freeze({
    get label() { return t('features.kind.enhanced', 'Enhanced'); },
    get blurb() { return t('features.kind.enhanced.blurb', 'This game’s own changes and additions to the original.'); },
  }),
  mod: Object.freeze({
    get label() { return t('features.kind.mod', 'Mod Authored'); },
    get blurb() { return t('features.kind.mod.blurb', 'Mods by other authors, credited by name.'); },
  }),
  classic: Object.freeze({
    get label() { return t('features.kind.classic', 'DFU Classic'); },
    get blurb() { return t('features.kind.classic.blurb', 'Daggerfall Unity’s own optional features.'); },
  }),
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
  sight: Object.freeze({ get label() { return t('features.group.sight', 'Sight'); } }),
  world: Object.freeze({ get label() { return t('features.group.world', 'The world'); } }),
  loot: Object.freeze({ get label() { return t('features.group.loot', 'Loot & items'); } }),
  combat: Object.freeze({ get label() { return t('features.group.combat', 'Combat'); } }),
  // ORL1 (2026-09-17): the fifth group. A leveling system is not what
  // you see, where you are, what you carry or how you fight - it is
  // what you BECOME, and filing it under any of the four would have
  // been filing it under the nearest one rather than the right one.
  character: Object.freeze({ get label() { return t('features.group.character', 'Your character'); } }),
  // FT18 (2026-09-25, Mac: "a comprehensive reorganize and consolidation of our mod/enhancements"): two more, because
  // Sight had grown to sixteen tiles and a third of them were not things you see in the world - the HUD's quick slots,
  // the map, the tooltips - and the sounds were spread over three groups. What is drawn OVER the world is the
  // interface; what you hear is sound.
  interface: Object.freeze({ get label() { return t('features.group.interface', 'Interface'); } }),
  sound: Object.freeze({ get label() { return t('features.group.sound', 'Sound'); } }),
});
export const GROUP_ORDER = Object.freeze(['sight', 'interface', 'sound', 'world', 'loot', 'combat', 'character']);

/** WM3: the Windmills pack's switch key. It is declared HERE with its
 *  row (RF4's law) rather than in `world/windmills.js`, because that
 *  module reads it through `uiPrefs` and `uiPrefs` reads this page's
 *  defaults - the other direction closes a cycle and the shelf loads
 *  before the row exists. */
export const WINDMILLS_KEY = 'windmills';
/** KG3: The King's Gambit's switch key - declared here with its row, as the Windmills' is (the game reads it through
 *  `uiPrefs`, which reads this page's defaults). */
export const KINGS_GAMBIT_KEY = 'kingsGambit';

/** Where a control's value lives. */
export const STORES = Object.freeze(['prefs', 'settings', 'mods']);

/** FT9 (2026-09-14): A VENDORED MOD'S ROW - its own switch, its own
 *  title with the creator's name in it (Mac, 2026-09-08), its own
 *  description as the note. One source: modSettings.js, where the mod's
 *  modsettings ship - so FT15's trim of a mod's note is a trim of the
 *  description itself, and there is still no second copy. The mod's
 *  OTHER knobs open in this row's own tile drawer (MOD_CURATED, below).
 *  `effect` is the port's word on when the switch lands, per mod: a
 *  function answering it in the player's language (L10N4). */
const modFeature = (vendor, effect, group) => {
  const mod = MOD_SETTINGS[vendor];
  return Object.freeze({
    id: `mod-${vendor.toLowerCase()}`,
    group,
    get title() { return t('features.mod.title', '{title} by {author}', { title: mod.title, author: mod.author }); },
    get note() { return mod.keys.Enabled.description; },   // L10N4: read as it is read, so the description is in whatever language modSettings answers
    get effect() { return effect(); },   // L10N4: a function - each call site's t()
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'mods', vendor, key: 'Enabled' }),
  });
};

/** L10N4: A TIER - [value, label] - whose label is read in the player's
 *  language as it is read. The pair keeps its shape (`[v, l]` destructures,
 *  `tiers[i][0]` is the value), so every reader keeps working; the value is
 *  the identity the stores hold and is never translated. `Off`, `Low` and
 *  `High` are Daggerfall Unity's own settings words (localizedText). */
const tier = (value, label) => Object.freeze(Object.defineProperty([value], 1, { enumerable: true, get: label }));
const OFF = () => localizedText('off', 'Off');

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
  // LEGACY1: the mod's three Family dials and the port's own Legacy ones - all a player's choice (LEGACY-HOME: the
  // family in the world, Mac's "can be toggled off").
  'project-legacy': Object.freeze(['Family.Descendants', 'Family.Max Siblings', 'Family.Siblings Probability', 'Legacy.Model', 'Legacy.Toll', 'Legacy.Heirloom Chance', 'Legacy.Family In World']),
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
  // WOD-PEAKS: the port's own switch for the mod's mountain spires - off, the landforms' rounded peaks stand instead.
  'world-of-daggerfall': Object.freeze(['Mountains']),
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
  // beside Cautiously - the other half of the mod's rule (ui/travel/travelPopUp.js isPlayerControlledTravel). TO-FIELD2 turned
  // it on and FT14 took the pane it could be turned off in, so a trip stopping at inns - Recklessly's too - was always
  // a journey and no dial on any screen said why.
  // IT1: the four a player reaches for first - whether the carriage is the only fast travel, what the driver charges,
  // whether he crosses into another region, and whether he will put you on a ship. The rest - what he takes you to, the
  // ship captain's dials, the map's dots - stay in the mod's own pane.
  'immersive-travel': Object.freeze([
    'General.DisableNormalTravel', 'General.DailyCarriageFee', 'General.RegionLockedCarriages', 'ShipTravel.DisableShipTravelOutsideDocks',
  ]),
  // HAZE1: how strong the shimmer is, and whether the subtropics shimmer too.
  'heat-haze': Object.freeze(['Heat Haze.Intensity', 'Heat Haze.AllowSubtropical']),
  // WINDFALL1: what a player reaches for first - the sound and how loud, the leaves and the snow off the boughs, and how
  // often the wind gets up. The profiles, the frequencies by season, region and weather stay in the mod's own pane.
  windfall: Object.freeze(['Presentation.AudioEnabled', 'Presentation.AudioVolume', 'Presentation.LeavesEnabled', 'Presentation.SnowFlurriesEnabled', 'General.OverallWindyPeriodFrequency', 'General.GustFrequency']),
  // SNOWFALL1: how deep the snow lies in the wild and in towns, whether the townsfolk and the foes leave tracks, whether
  // it reaches the distance, and how fast a track fills back. The mesh, the masks, the feathers and the roads' dials stay
  // in the mod's own pane.
  snowfall: Object.freeze(['Snowpack.WildernessMaximumDepth', 'Snowpack.SettlementMaximumDepth', 'NPC Tracks.Enabled', 'Distance Prototype.Enabled', 'Refill.PassiveRefillHours']),
  // PI1: the four a player reaches for first - whether a body's gear lands round it, how hard it is thrown out, and the
  // two sizes most read (a weapon's and an armour piece's). The categories and the per-piece sizes stay in the mod's pane.
  'physical-items': Object.freeze(['Enemy Loot.Physical Enemy Drops', 'Enemy Loot.Impulse Strength', 'Item Sizes.Weapons', 'Item Sizes.Armor']),
  // DEX0: the mod's one key - whether a fallen troll gets back up.
  'daggerfall-enemy-expansion': Object.freeze(['Cheat.DisableTrollRespawn']),
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
    get title() { return t('features.smallerDungeons.title', 'Smaller dungeons'); },
    get note() { return t('features.smallerDungeons.note', 'Dungeons bigger than five blocks are cut down to five: a center block with four around it, the same '
      + 'every visit. Main-story dungeons keep full size; a quest keeps the size it was set up at. Online every '
      + 'dungeon has its own size instead.'); },
    get effect() { return t('features.smallerDungeons.effect', 'Takes effect on the next dungeon you enter. A save made at the other size puts you at the dungeon\u2019s start.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Experimental/SmallerDungeons' }),
  }),
  // DSIZE1 (2026-10-05, the delve arc): MEDIUM DUNGEONS - the size tier the smaller-dungeons row's note left open
  // (Features-Arc.md: "a size tier ... would earn the Enhanced label"): over eight blocks, two interior blocks side by
  // side closed by six (AUDIT DELVE: the first cut's thirteen-block cross is struck), by GenerateSmallerDungeon's own
  // law (world/smallerDungeons.js generateMediumDungeon). Its own row because the row above is DFU's switch, kept whole;
  // that switch wins when both are on. Off by default; online every dungeon has the world's own size (the row below),
  // so the lane forces it off there.
  Object.freeze({
    id: 'medium-dungeons',
    group: 'world',
    title: 'Medium dungeons',
    note: 'Dungeons over eight blocks are cut to eight: two side by side with six around them, the same every visit. If '
      + 'Smaller dungeons is on too, it wins. Main-story dungeons keep full size; a quest keeps the size it was set up at. '
      + 'Online every dungeon has its own size instead.',
    effect: 'Takes effect on the next dungeon you enter. A save made at another size puts you at the dungeon\u2019s start.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mediumDungeons', initial: false, online: false }),   // world/smallerDungeons.js MEDIUM_DUNGEONS_PREF
  }),
  // SD-ONLINE (2026-10-05, Mac: "So medium dungeons will be the new by default option thats on (online only)", then "On
  // second thought. Large, medium and small should all play into account online" - "World mixes sizes"): THE WORLD'S
  // DUNGEON SIZES. Online every dungeon is built at the size one seeded draw on its map id gives it - small, medium or
  // large, half of them medium, the same for every player (world/smallerDungeons.js onlineDungeonSize) - which is the
  // room's law there, so the lane forces this row ON online and the sync copies it home: offline it asks for the same
  // sizes. Below DFU's switch (Smaller wins when both are on), above the medium one.
  Object.freeze({
    id: 'world-dungeon-sizes',
    group: 'world',
    title: 'Dungeon sizes as online',
    note: 'Every dungeon takes the size it has online (small, medium or large, half of them medium), the same every '
      + 'visit. If Smaller dungeons is on too, it wins; this row wins over Medium dungeons. A quest keeps the size it '
      + 'was set up at. Online it is always on.',
    effect: 'Takes effect on the next dungeon you enter. A save made at another size puts you at the dungeon\u2019s start.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'worldDungeonSizes', initial: false, online: true }),   // world/smallerDungeons.js WORLD_DUNGEON_SIZES_PREF; forced on online, the room's sizes
  }),
  // STEED1 (2026-10-11, the owner: "Horse should have stamina, feeding them grows your bond and improves their stats.
  // Every horse should have different stats"): HORSE CARE (bible/06-Systems/Horse-Care.md, systems/steedCare.js).
  // HORSE-WALK (2026-10-12): its horse walks unless the run gallops it.
  // HORSE-TIERS (2026-10-15, Mac: "Allow turn off. Rework this system to be more in line with how we handle climates and
  // calories boons."): TIERS ON THE ONE KEY, as Climates & Calories' row has them - Off (DFU's horse, stored as the old
  // switch's own `false`), Boons (the default, never stored - BOONS-DEFAULT's way) and Hard (the system as it stood, by
  // name); systems/upkeep/upkeepTiers.js HORSE_CARE_STORED and HORSE_CARE_DEFAULT, which test/systems/horsetiers.test.js holds the
  // row to. The player's online, every tier, as every Climates & Calories tier is (MODS-ONLINE-3's reading: a tier
  // decides only what THIS player's horse pays) - the lane forced it on there until Mac's word.
  Object.freeze({
    id: 'horse-care',
    group: 'world',
    get title() { return t('features.horseCare.title', 'Horse care'); },   // HORSE-TIERS: the row's words in the player's language (L10N4's ratchet)
    get note() { return t('features.horseCare.note', 'Every horse has its own Speed, Stamina, Endurance and Strength. It walks unless you hold Run to gallop, '
      + 'which tires it, and feeding it builds a bond that makes it better. On Boons neglect costs nothing and it is '
      + 'never slower than the classic horse; on Hard a hungry horse is weaker; Off is the classic horse.'); },
    get effect() { return t('features.horseCare.effect', 'Takes effect at once. Online, each player picks their own.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'horseCare', initial: 'boons', online: 'player',   // systems/upkeep/upkeepSwitch.js HORSE_CARE_PREF; HORSE-TIERS: upkeepTiers.js HORSE_CARE_DEFAULT
      tiers: Object.freeze([tier(false, OFF), tier('boons', () => t('features.horseCare.boons', 'Boons')), tier('hard', () => t('features.horseCare.hard', 'Hard'))]),
      // UI-CALM (2026-10-14): when the saddle panel stands (ui/enhanced/enhancedSaddle.js saddleShown) - the player's own, offline
      // and online: When needed (its key, F2; a need; the first seconds in the saddle), Always (STEED-UI's), Off
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'saddlePanel', initial: 'auto', online: 'player' })]),
      parts: Object.freeze([Object.freeze({
        key: 'saddlePanel', get label() { return t('features.horseCare.saddlePanel', 'Saddle panel'); },
        get tiers() { return [['auto', t('features.horseCare.saddleAuto', 'When needed')], ['always', t('features.horseCare.saddleAlways', 'Always')], ['off', OFF()]]; },
      })]),
    }),
  }),
  // WAGONS4 (2026-10-11, the owner: "Wagons have durability and require upkeep to keep from breaking down and becoming
  // unusable"): WAGON UPKEEP (bible/06-Systems/Wagon-Upkeep.md, systems/wagon/wagonUpkeep.js).
  // WAGON-TIERS (2026-10-15, Mac: "Yes, same tiers"): horse care's model on its own key - Off (DFU's plain wagon, stored
  // as the old switch's own `false`), Boons (the default, never stored: it wears and is mended, and wear costs nothing)
  // and Hard (the system as it stood, by name); systems/upkeep/upkeepTiers.js WAGON_UPKEEP_STORED and WAGON_UPKEEP_DEFAULT,
  // which test/systems/wagontiers.test.js holds the row to. The player's online, every tier (MODS-ONLINE-3's reading).
  Object.freeze({
    id: 'wagon-upkeep',
    group: 'world',
    get title() { return t('features.wagonUpkeep.title', 'Wagon upkeep'); },
    get note() { return t('features.wagonUpkeep.note', 'Your wagon wears as it rolls and on long journeys, and a Wagon Yard or a Wagon Repair Kit mends it. '
      + 'On Boons wear costs nothing; on Hard a worn wagon is slower and sells for less; Off is the classic wagon.'); },
    get effect() { return t('features.wagonUpkeep.effect', 'Takes effect at once. Online, each player picks their own.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'wagonUpkeep', initial: 'boons', online: 'player',   // systems/upkeep/upkeepSwitch.js WAGON_UPKEEP_PREF; WAGON-TIERS: upkeepTiers.js WAGON_UPKEEP_DEFAULT
      tiers: Object.freeze([tier(false, OFF), tier('boons', () => t('features.wagonUpkeep.boons', 'Boons')), tier('hard', () => t('features.wagonUpkeep.hard', 'Hard'))]),
    }),
  }),
  // FT2 (2026-09-14): LAND VIEW DISTANCE - the first CONDENSED row. Two
  // controls for one radius: the pref (LV1, the enhanced lane's 1..6)
  // and DFU's Experimental/TerrainDistance (D1, the 1:1 lane's 1..4).
  // One row wearing both labels; it shows the lane's live radius and
  // writes both stores (world/landView.js landViewRead/landViewWrite).
  Object.freeze({
    id: 'land-view-distance',
    group: 'sight',
    get title() { return t('features.landViewDistance.title', 'Land view distance'); },
    get note() { return t('features.landViewDistance.note', 'How far the land around you is drawn, in map squares: up to 6 with the enhanced outdoors, and up to 4 '
      + 'on the classic UI or with the outdoors off.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
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
    get title() { return t('features.enhancedEnvironments.title', 'Enhanced environments'); },
    get note() { return t('features.enhancedEnvironments.note', 'A living sky with the sun, both moons and stars, clouds that build with the weather and cast '
      + 'shadows, falling rain and snow, and grass that bends in the wind. Off brings back the classic '
      + 'painted sky and weather. The third choice uses Dynamic Skies by BadLuckBurt and carademono, included '
      + 'with permission; its settings open on this tile.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
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
  // classic motor is the 1:1 law - until BAL4 (2026-10-10,
  // 05-Combat/Balance-Arc.md section 6; Mac: "Do everything", of
  // "smarter AI and elites offline") turned it ON offline as it always
  // was online: the port's game is the one it plays, the classic motor
  // one choice away and All off's. The words are AUDIT 59 F3's, kept
  // true by test/systems/ft5_enhancedai.test.js against the arc's own list of
  // what is still ahead. NOT a merge with DFU's Enhancements/
  // EnhancedCombatAI ("Smarter Enemies", UNAVAILABLE in settings.js: the port runs the
  // classic path only) - a different thing that shares half a name,
  // which the note says outright so the two cannot be read as one.
  Object.freeze({
    id: 'enhanced-ai',
    group: 'combat',
    get title() { return t('features.enhancedAi.title', 'Enhanced AI'); },
    get note() { return t('features.enhancedAi.note', 'Enemies take turns, back off when hurt, and archers keep their distance. Big attacks are marked on the '
      + 'ground: hit hard to stagger them or dodge. Red, hatched attacks can’t be stopped. Trees, rocks and crates block '
      + 'sight and missiles. Pathfinding works in dungeons only for now; towns, interiors and doors come later. Off keeps '
      + 'the classic behavior.'); },
    get effect() { return t('features.enhancedAi.effect', 'Takes effect at once; pathfinding from the next dungeon you enter.'); },   // AUDIT TACT D7: the tactics, cover and blows read the switch live
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'enhancedAI', initial: true, online: true,   // BAL4: ON by default (it was off - DFU's classic motor the 1:1 law); the lane forces it on online as it always did; an unstamped shelf adopts it (uiPrefs.js PREF1_ADOPT_NEW_DEFAULT)
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
    get title() { return t('features.enhancedClimbing.title', 'Enhanced climbing'); },
    get note() { return t('features.enhancedClimbing.note', 'Press Jump at a ledge to climb onto or over it, or while moving forward to vault a low wall. Jump at a high '
      + 'ledge to catch it and hang: Forward climbs up, Left and Right move along it, Crouch lets go. Hold '
      + 'Forward against any wall to climb it. Holding on wears out your grip; your Climbing skill sets how long it '
      + 'lasts, how high you reach and how fast you climb. Off keeps the classic climbing.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
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
    get title() { return t('features.enhancedWater.title', 'Enhanced water'); },
    get note() { return t('features.enhancedWater.note', 'Seas, rivers and ponds you can see into: waves that grow with the wind, foam where they meet the shore, '
      + 'ripples where things move, the sky and the moon on the surface. Off brings back the classic flat water.'); },   // WATER-NEXT: what the water is now
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['enhanced']),
    // WATER-OFF (FIELD BUGS 2026-10-08, SylviaBun: "an option to disable Enhanced Water would be nice (I prefer the
    // textured water over 'realistic' water anyway)", the frame rate falling round Gothway Garden): THE PLAYER'S, ONLINE
    // TOO - OL-LIGHT's shape. The water is what THIS screen draws: no wire field, relay law or shared roll reads it
    // (swimming and feet read WATER_MASK_TABLE either way; the one other reader, the townsfolk's paths, is no one's but
    // this page's), so off online brings back Daggerfall's flat tile and the Deep Waters sea's own scrolling texture.
    control: Object.freeze({ store: 'prefs', key: 'enhancedWater', initial: true, online: 'player' }),   // WATER1: on by default like the other enhanced visuals; `?water=off` the kill door
  }),
  // WATER-NEXT (2026-10-07, the overhaul's plan: "a cheaper setting for a weak GPU"): HOW MUCH THE WATER DRAWS. Full
  // copies the frame under the water once a frame (the look through it, the depth it measures) and keeps the ripple
  // field; Simple does neither - the bed, the swell, the foam and the body stand, the blend does the looking-through.
  Object.freeze({
    id: 'water-quality',
    group: 'sight',
    get title() { return t('features.waterQuality.title', 'Water quality'); },
    get note() { return t('features.waterQuality.note', 'How detailed the enhanced water is. Full shows what lies under the surface and ripples where '
      + 'things move; Simple is lighter on your machine.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'waterQuality', initial: 'full', online: 'player', tiers: Object.freeze([tier('full', () => t('features.waterQuality.full', 'Full')), tier('simple', () => t('features.waterQuality.simple', 'Simple'))]) }),   // WATER-NEXT: render/renderer.js waterSimple
  }),
  // EL1 (2026-09-17, the Enhanced Lighting arc, tier one): the renderer's
  // lit world on a linear pipeline - render/enhancedLighting.js carries
  // the law; `?lighting=classic` is the kill door.
  Object.freeze({
    id: 'enhanced-lighting',
    group: 'sight',
    get title() { return t('features.enhancedLighting.title', 'Enhanced lighting'); },
    get note() { return t('features.enhancedLighting.note', 'Warmer, more natural light: lanterns and torches that glow and fade with distance, light through '
      + 'fog, shadows from the sun and your torch, darker corners, a glow on windows and flames, and rays of '
      + 'sunlight. Off is the classic flat lighting.'
      + ' Steady shadows stops shadows flickering, at some cost to frame rate; Calmer eye slows how fast your eyes adjust to light and dark.'); },
    get effect() { return t('features.enhancedLighting.effect', 'Lighting takes effect when the world next loads; steady shadows and calmer eye at once.'); },
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
      parts: Object.freeze([Object.freeze({ key: 'enhancedLighting', label: 'Lighting' }), Object.freeze({ key: 'steadyShadows', label: 'Steady shadows' }), Object.freeze({ key: 'calmEye', label: 'Calmer eye' }), Object.freeze({ key: 'shadowDebug', label: 'Shadow debug log' })]),   // CACHE-COPY (2026-10-07): CACHE-OFF's "Shadow cache (faster, may flicker)" part is gone - the cache is on, and its blink was its copy's, a draw now (render/shadowPass.js _blitSlot)
    }),
  }),
  // IIL1-T (2026-09-27, Mac: "add an alternative light on off option to test the modded lighting"): Improved Interior
  // Lighting off, on, or on with shadows - it only ever acts with its .dfmod attached (systems/improvedInteriorLighting.js);
  // "With shadows" runs its lights on the Enhanced Lighting lane, whose shadow maps the classic lane does not have.
  Object.freeze({
    id: 'modded-lighting',
    group: 'sight',
    get title() { return t('features.moddedLighting.title', 'Modded lighting ({mod})', { mod: 'Improved Interior Lighting' }); },
    get note() { return t('features.moddedLighting.note', 'Needs the Improved Interior Lighting mod. Its warm, flickering lights replace the classic lighting, '
      + 'and with shadows on, lamps, people and monsters cast soft shadows too.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    // IIL1-T2 (Mac: "i dont want to [edit the address] thats why i wanted the options added"): the shadows the test
    // door gave, as the row's third tier
    control: Object.freeze({ store: 'prefs', key: 'moddedLighting', initial: 'on', online: 'player', tiers: Object.freeze([
      tier('off', OFF), tier('on', () => t('features.moddedLighting.on', 'On')), tier('shadows', () => t('features.moddedLighting.shadows', 'With shadows'))]) }),
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
    get title() { return t('features.grass.title', 'Grass'); },
    get note() { return t('features.grass.note', 'How much grass grows in the enhanced outdoors. Grass is the heaviest thing outdoors, so try Half '
      + 'first if the game runs slow. Meadow is hand-drawn tufts, flowers and bushes; Pixel is finer, older '
      + 'tufts; Smooth is soft, shaded blades.'); },
    get effect() { return t('features.grass.effect', 'The amount takes effect when the world next loads; the style at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'grassDensity', initial: 1, online: 'player', tiers: Object.freeze([tier(1, () => t('features.grass.full', 'Full')), tier(0.5, () => t('features.grass.half', 'Half')), tier(0.25, () => t('features.grass.quarter', 'Quarter')), tier(0, OFF)]),   // PERF1: a fraction of the lab's 1.2 million blades; a dial, the player's online; GRASS-ON (2026-10-07, Mac: "Can you please turn grass on by default"): Full by default again, where AUDIT MEADOW1 had it Off
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'grassStyle', initial: 'meadow', online: 'player' })]),   // GRASS-PX: a uniform in the one grass program, so it flips live; MEADOW1: the meadow the default
      parts: Object.freeze([Object.freeze({ key: 'grassStyle', get label() { return t('features.grass.style', 'Style'); },
        tiers: Object.freeze([tier('meadow', () => t('features.grass.style.meadow', 'Meadow')), tier('pixel', () => t('features.grass.style.pixel', 'Pixel')), tier('smooth', () => t('features.grass.style.smooth', 'Smooth'))]) })]),
    }),
  }),
  Object.freeze({
    id: 'cloud-quality',
    group: 'sight',
    get title() { return t('features.cloudQuality.title', 'Cloud quality'); },
    get note() { return t('features.cloudQuality.note', 'How detailed the clouds in the enhanced outdoors are. Low is lighter on your machine; High looks '
      + 'best if you have power to spare.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'cloudQuality', initial: 'default', online: 'player', tiers: Object.freeze([tier('default', () => t('features.cloudQuality.default', 'Default')), tier('lo', () => localizedText('low', 'Low')), tier('hi', () => localizedText('high', 'High'))]) }),   // PERF1: volumetricClouds.js QUALITY; a dial, the player's online
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
    get title() { return t('features.groundSharpness.title', 'Ground sharpness'); },
    get note() { return t('features.groundSharpness.note', 'How sharp the ground looks into the distance. Off is the cheapest and blurs far ground; Maximum is '
      + 'the sharpest. Turn it down if the outdoors run slow.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'groundSharpness', initial: 'default', online: 'player', tiers: Object.freeze([tier('off', OFF), tier('default', () => t('features.groundSharpness.default', 'Default (4x)')), tier('max', () => t('features.groundSharpness.max', 'Maximum'))]) }),
  }),
  // RW1 (2026-10-09, Mac: "allowing players to see inside/outside of house windows"): REAL WINDOWS - from the street a
  // room behind every house window, from inside the real world through the glass (render/realWindows.js carries the
  // law; `?windows=off|rooms|full` the kill door). Rooms only drops the costly half - the view out is a second pass over
  // the street. The player's own online: it is this screen's pixels. A preset row (systems/graphicsPresets.js).
  Object.freeze({
    id: 'real-windows',
    group: 'sight',
    title: 'Real windows',
    note: 'From the street, house windows show the rooms behind them, warmly lit at night; from inside, you can see '
      + 'out through them. Rooms only is lighter on your machine; Off is the classic flat glass.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'realWindows', initial: 'full', online: 'player', tiers: Object.freeze([['full', 'Full'], ['rooms', 'Rooms only'], ['off', 'Off']]) }),   // RW1: render/realWindows.js realWindowsMode reads it
  }),
  // PERF-SCALE (2026-09-25, two players via Mac: "One user is reporting fps issues in the exterior but fine in the
  // interior ... GPU is NVIDIA GeForce RTX 4060 Ti", "me too my friend.. don't know why. I got a RX6600"): THE
  // RENDER SCALE. The world was drawn at the window's whole size with no cap, so a large window paid two to four
  // times the exterior's per-pixel work; this draws it smaller and presents it smooth (systems/renderScale.js
  // carries the law). Retro Picture Mode wins over it. A dial, the player's own online: it is this screen's pixels.
  Object.freeze({
    id: 'render-scale',
    group: 'sight',
    get title() { return t('features.renderScale.title', 'Render scale'); },
    get note() { return t('features.renderScale.note', 'Draws the world at a lower resolution and scales it up to fit; menus and the HUD stay sharp. Try 75% '
      + 'if the outdoors run slow on a big or high-resolution screen. Retro Picture Mode replaces this while '
      + 'it is on.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
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
    get title() { return t('features.enhancedCombatVisuals.title', 'Enhanced combat visuals'); },
    get note() { return t('features.enhancedCombatVisuals.note', 'Hidden enemies can be seen: a chameleon shimmers, a shadow is a silhouette, and an invisible enemy '
      + 'flashes when you hit it. The rules don’t change. Off hides them as the original does.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedCombatVisuals', initial: true, online: true }),   // ECV1: on by default like the other enhanced visuals; the rules are untouched either way
  }),
  // WEAPON-GLOW1 (2026-10-16, Mac: "designed our own sort of animated outline for each element ... the same, more
  // detailed design for the morrowind weapons"): WHAT A WEAPON'S ELEMENT LOOKS LIKE IN THE HAND - systems/weaponGlow.js
  // the law, render/weaponGlowGlsl.js the drawing, bible/05-Combat/Weapon-Glow.md the page. A look, read every frame
  // (weaponGlowOn; `?weaponglow=off` the kill door), so a press takes effect at once; the player's own online - a
  // peer's weapon glows on my screen by MY switch, off the word their look carries.
  Object.freeze({
    id: 'weapon-glow',
    group: 'sight',
    get title() { return t('features.weaponGlow.title', 'Weapon glow'); },
    get note() { return t('features.weaponGlow.note', 'A weapon with a fire, frost or shock damage bonus wears a moving outline of its element, '
      + 'brighter the stronger it is, and an enchanted Morrowind weapon glows. Off draws weapons as before.'); },   // AUDIT WEAPON-GLOW DOC-2: a bonus (a Legendary's power and a cast-when-strikes spell deal elemental damage and show none), and "as before" (the original - OpenMW - glows an enchanted part; off, the port draws it bare)
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'weaponGlow', initial: true, online: 'player' }),   // WEAPON-GLOW1: systems/weaponGlow.js WEAPON_GLOW_PREF
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
    get title() { return t('features.quickLoot.title', 'Quick loot'); },
    get note() { return t('features.quickLoot.note', 'Loot without opening a window: the mouse wheel moves through the list, Activate takes one item, and the Take '
      + 'everything key takes all but junk (Take gear sets which gear). Off uses the inventory window.'); },   // LOOT18: the take-all's tier and the junk, in the FT15 budget
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'quickLoot', initial: true, online: 'player',   // the player's own: it stands nothing, rolls nothing and is not on the wire - the same category chatHidden is (OL1)
      // LOOT18 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 10): the take-all's tier - a part, the player's own
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'quickLootTier', initial: 'all', online: 'player' })]),
      parts: Object.freeze([Object.freeze({ key: 'quickLootTier', label: 'Take gear', tiers: Object.freeze([['all', 'All'], ['magic', 'Magic+'], ['rare', 'Rare+']]) })]),
    }),
  }),
  // LR1 (2026-09-14): LOOT RARITY - the port's own item ladder
  // (systems/loot/lootRarity.js): Common, Magic, Rare, Legendary, with
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
    get title() { return t('features.lootRarity.title', 'Loot rarity'); },
    get note() { return t('features.lootRarity.note', 'Weapons, armor and jewelry can drop as Magic, Rare or Legendary, with extra bonuses you can read '
      + 'and compare. The odds depend on what you killed, where, and your luck, never your level. Rare and '
      + 'Legendary items drop unidentified. Off is the classic loot. Online, some weapons carry a '
      + 'sigil that grows with your Renown.'); },   // SIGIL1
    get effect() { return t('features.lootRarity.effect', 'Takes effect on the next drop; items you wear update within a few seconds.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'lootRarity', initial: true, online: true }),   // LR5: ON by default (Mac) - the ladder is the port's own game, not an opt-in; the lane forces it on online as it always did
  }),
  // WIND3 (2026-09-14, Mac: wisps that show the wind, a quiet wind, the
  // trees moving with it): THE WIND SEEN AND HEARD - three rows over the
  // one wind (systems/wind/windDrive.js), each the player's own online (a
  // look and a sound, nothing the room shares), each read every frame
  // by the exterior hosts. Kill doors `?wisps=off`, `?windaudio=off`,
  // `?sway=off`.
  // FT18: THE WIND SEEN, ONE ROW. WIND3's wisps and its sway were two tiles over one wind (the third, its sound, is
  // Enhanced sounds since ES1). The bar is both at once (systems/featureLanes.js 'wind'); each opens on its own in
  // the drawer. Both keys, both defaults, both kill doors (`?wisps=off`, `?sway=off`) unchanged.
  Object.freeze({
    id: 'wind',
    group: 'sight',
    get title() { return t('features.wind.title', 'Wind'); },
    get note() { return t('features.wind.note', 'See the wind in the enhanced outdoors: trees and plants lean and sway with it, and faint streaks of '
      + 'air show which way it blows and how hard.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'floraSway', initial: true, online: 'player', lane: 'wind',   // WIND3: systems/wind/windDrive.js floraSwayOn; render/renderer.js BB_VS uSway
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'windWisps', initial: true, online: 'player' })]),   // WIND3: render/windWisps.js wispsOn
      parts: Object.freeze([Object.freeze({ key: 'floraSway', get label() { return t('features.wind.sway', 'Sway'); } }),   // AUDIT MEADOW1: the sway is the grass's too (labGrass.js draw), so the part is not the trees' alone
        Object.freeze({ key: 'windWisps', get label() { return t('features.wind.wisps', 'Wisps'); } })]),
    }),
  }),
  // ES1 (2026-09-16, Mac: "lump this in as a new enhanced toggle. Enhanced
  // Sounds, add the wind noise to it"): WIND3's `wind-sound` row IS this
  // row now - one switch over the port's own sounds (systems/
  // enhancedSounds.js): the wind loop, the enhanced inventory's
  // transfer cues (MAC-O6), (CLIMB4) the climb's hands and boots, and
  // (GATHER-FEEL) the gathering's acts. The kill door `?windaudio=off`
  // still silences the wind alone.
  Object.freeze({
    id: 'enhanced-sounds',
    group: 'sound',   // FT18: was world
    get title() { return t('features.enhancedSounds.title', 'Enhanced sounds'); },
    get note() { return t('features.enhancedSounds.note', 'New sounds on the enhanced UI: wind outdoors that rises and falls with its strength and goes quiet '
      + 'indoors, a coin clink when you take or store items in the enhanced inventory, your hands and boots on stone '
      + 'when you climb, and the axe, the pick, the leaves, the knife and the net when you gather.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
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
    get title() { return t('features.firstPersonLighting.title', 'First-person lighting'); },
    get note() { return t('features.firstPersonLighting.note', 'What you hold in first person takes the light of where you stand: your weapon, your spellcasting '
      + 'hands, the torch in your off hand and the Morrowind arms.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'firstPersonLighting', initial: true, online: 'player' }),   // MAC-I: combat/weapon/weaponRig.js fpLightingOn
  }),
  // MAP-TOGGLE (2026-09-22, Mac: "is the enhanced map a toggle?" - "Yes
  // needs to be a toggle"): the held sheet was the enhanced skin's alone,
  // with no way to keep the skin and take DFU's own maps back. The three
  // map doors read this beside the skin now (ui/map/mapSkin.js heldMapWorn).
  Object.freeze({
    id: 'enhanced-map',
    group: 'interface',   // FT18: was sight
    get title() { return t('features.enhancedMap.title', 'Enhanced map'); },
    get note() { return t('features.enhancedMap.note', 'One hand-drawn parchment map for the world, towns and dungeons, held in your hands, that you can pan '
      + 'and zoom. Off uses the classic three map windows.'); },
    get effect() { return t('features.effect.nextMap', 'Takes effect the next time a map is opened.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'heldMap', initial: true, online: 'player' }),   // the player's own: what THEIR map looks like
  }),
  // EM3-3D (2026-09-27, Mac: "The dungeon map becomes the new default option, the current 2d enhanced becomes an
  // option, not removed"): the held map's dungeon sheet in the round (ui/ink/inkDungeonSolid.js, ui/ink/inkDungeonGL.js) -
  // turned, tilted and zoomed as DFU's 3D automap is - is the default; off is EM3's flat plan, whole. Read where the
  // sheet is built (ui/map/mapSkin.js dungeonMap3dOn), so a change takes the next map opened; `?dungeonmap=flat` stays
  // the kill door. The held map's own row above still decides whether there is a held map at all.
  Object.freeze({
    id: 'dungeon-map-3d',
    group: 'interface',
    get title() { return t('features.dungeonMap3d.title', '3D dungeon map'); },
    get note() { return t('features.dungeonMap3d.note', 'The enhanced map shows dungeons in 3D, hand-drawn: turn, tilt and zoom it, with every floor you’ve '
      + 'explored at its own height. Off shows one flat floor at a time.'); },
    get effect() { return t('features.effect.nextMap', 'Takes effect the next time a map is opened.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'dungeonMap3d', initial: true, online: 'player' }),   // the player's own, as the held map's is
  }),
  // TAMRIEL1 (2026-10-08, Mac: "building the entirety of tamriel that connects accurately to Daggerfall. Not actually
  // traversalable but used and connected as a gigantic map ... seen by players ingame"): the held map's world sheet
  // zooms out past the Bay onto the whole continent, authored in the same hand (ui/tamrielInk.js,
  // world/tamriel/tamrielGeography.js, bible/03-World/Tamriel.md). Read where the window is built (ui/map/mapSkin.js
  // tamrielMapOn), so a change takes the next map opened; `?tamriel=off` is the kill door.
  Object.freeze({
    id: 'tamriel-map',
    group: 'interface',
    title: 'Tamriel on the map',
    note: 'The enhanced map zooms out past the Iliac Bay to show all of Tamriel: its provinces, capitals, mountains and '
      + 'seas, hand-drawn and joined to the Bay’s own coast. You can’t travel beyond the Bay.',
    effect: 'Takes effect the next time a map is opened.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'tamrielMap', initial: true, online: 'player' }),
  }),
  // TAMRIEL2 (2026-10-08, Mac: "only implement the land mass"): the streamed world goes on past the Bay's edge over the
  // authored continent - its ground, its climate's textures and trees, nothing built on it (world/tamriel/tamrielGround.js;
  // scenes/shared.js tamrielLandOn, read once as the world mounts). `?tamrielland=off` the kill door.
  Object.freeze({
    id: 'tamriel-land',
    group: 'world',
    title: 'Land beyond the Bay',
    note: 'The land goes on past the edge of the Iliac Bay, with the hills, mountains, coasts, sky and trees of each '
      + 'province. There are no towns, roads or dungeons there yet.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'tamrielLand', initial: true, online: 'player' }),
  }),
  // WEATHER2b (2026-09-14, Mac: "a dynamic world space event system where
  // weather can be traveled out of and into"): THE WEATHER FIELD - the
  // day's words as places (systems/weather/weatherField.js), read by the sim
  // every exterior frame (weatherSim.js weatherFieldOn). FORCED ON
  // ONLINE: one field for every player under the shared day's roll.
  // `?wxfield=off` the kill door.
  Object.freeze({
    id: 'weather-events',
    group: 'world',
    get title() { return t('features.weatherEvents.title', 'Weather as places'); },
    get note() { return t('features.weatherEvents.note', 'Rain, storms and snow move across the land with the wind, so you can see a storm coming, walk into '
      + 'it and out the other side. Off uses the classic weather, the same everywhere in the region.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'weatherEvents', initial: true, online: true }),   // WEATHER2b: weatherSim.js weatherFieldOn; forced on online - one sky
  }),
  // FOREST1 (2026-10-01, the Discord's "Real Forests" thread): REAL
  // FORESTS - the wilderness's trees gathered into woods with open land
  // between them, in place of DFU's even scatter (world/terrain/terrainNature.js
  // layoutForests). FORCED ON ONLINE: the woods are where Logging's trees
  // stand (scenes/treeHost.js standTrees), so a room has one forest.
  // `?forests=off` the kill door; scenes/shared.js realForestsOn composes it.
  Object.freeze({
    id: 'real-forests',
    group: 'world',
    get title() { return t('features.realForests.title', 'Real forests'); },
    get note() { return t('features.realForests.note', 'Trees grow together in forests, with open grassland between them. Dungeons, ruins, shrines and camps '
      + 'are often hidden in the woods, and towns and farms stand in cleared fields. Deserts are unchanged. '
      + 'Off spreads the trees evenly, like the original.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'realForests', initial: true, online: true }),
  }),
  // BANTHA1 (2026-10-18, the owner: "Bantha, north of daggerfall is going to be the first region in the continent to
  // recieve a biome expansion"): THE JUNGLE - since BANTHA2 (2026-10-19, the owner: "The area is red in bantha and should be
  // the jungle biome") the area the owner painted on Hammerfell's shore of the Bay (world/jungle/banthaArea.js; BANTHA1
  // stood it on Glenpoint), grown over with the owner's jungle trees in storeys,
  // under its own humid haze (bible/03-World/Bantha-Jungle.md). FORCED ON ONLINE: its trees are where Logging's trees
  // stand there (scenes/treeHost.js standTrees), so a room has one jungle. `?jungle=off` the kill door; scenes/shared.js
  // jungleOn composes it.
  Object.freeze({
    id: 'bantha-jungle',
    group: 'world',
    get title() { return t('features.banthaJungle.title', 'Jungle of Bantha'); },
    get note() { return t('features.banthaJungle.note', 'Bantha, from Lainlyn to Mournoth, becomes dense jungle: giant trees overhead, palms, ferns and broad '
      + 'leaves underfoot, and a humid haze that is thickest at dawn and in rain. Off keeps its original woods.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'banthaJungle', initial: true, online: true }),
  }),
  // LANDFORM1-3 (2026-10-06, Mac: "Can we adjust the heightmap to be more of this? and allow roads to carve through
  // terrian and caverns without breaking anything and rivers to actually have depth"): LANDFORMS - the small heightmap
  // stands taller, roads are graded into the land, rivers lie in channels (world/landforms.js, inside the terrain's
  // kernel). FORCED ON ONLINE: it is the ground the room stands on. `?landforms=off` the kill door, offline;
  // scenes/shared.js landformsOn composes it.
  Object.freeze({
    id: 'landforms',
    group: 'world',
    title: 'Landforms',
    note: 'Mountains and high ground stand taller, as the map draws them. Roads are cut level into hillsides and built up '
      + 'over hollows, and rivers run in channels below their banks. Off keeps the classic ground.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'landforms', initial: true, online: true }),
  }),
  // VERGE1 (2026-10-07, Mac: "Making sure objects, like trees, avoid pathways and roads. Currently they slightly
  // overlap"): THE VERGE - a wilderness flat stands only where nothing of it reaches over a road or a track: the disc of
  // its widest picture, a Low Poly tree's crown among them, against the painted network (world/road/roadVerge.js). FORCED ON
  // ONLINE: where the wild's flats stand is the room's ground - Logging's trees, the herbs, the veins. `?verges=off` the
  // kill door, offline; scenes/shared.js roadVergesOn composes it.
  Object.freeze({
    id: 'road-verges',
    group: 'world',
    title: 'Clear roadsides',
    note: 'Trees, bushes, rocks and herbs keep off the roads and tracks, and no branch hangs over them. Off lets them '
      + 'grow up to the edge of the road, like the original.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'roadVerges', initial: true, online: true }),
  }),
  // ECOTONE1 (2026-10-07, Mac: "Making it where bione transitions are insta t and instead fade and transition
  // naturally into each other"): THE ECOTONE - where map pixels of two climates meet, the ground, the grass and the
  // wild's flats follow one wandering, patchy border (world/ecotone.js) in place of the pixel's straight edge. FORCED ON
  // ONLINE: the flats it moves are the room's ground, as the forests' are. `?ecotone=off` the kill door, offline;
  // scenes/shared.js climateBlendOn composes it.
  Object.freeze({
    id: 'climate-blend',
    group: 'world',
    title: 'Blended climates',
    note: 'Where two climates meet, their ground, grass and trees mix across a wide, uneven border instead of changing '
      + 'along a straight line. Off changes them at a straight edge, like the original.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'climateBlend', initial: true, online: true }),
  }),
  // NEARBY-QUESTS (2026-10-04, Discord: "quests of the game you take from guilds and so on need to be near you on
  // overworld map"): a remote quest site is drawn near the player, within a reach that grows with level
  // (systems/quest/questReach.js; systems/quest/place.js reads it as each new quest picks its sites). The player's own
  // online too: a quest's sites are its taker's, and no wire field or shared roll reads the switch.
  Object.freeze({
    id: 'nearby-quests',
    group: 'world',
    title: 'Nearby quests',
    note: 'Quests from guilds, temples, nobles and townsfolk send you to towns and dungeons near where you took them: a '
      + 'day or two away at first, farther as you level, and anywhere in the region by about level 15. '
      + 'Off sends you anywhere in the region from the start, like the original.',
    effect: 'Takes effect on the next quest you take; quests you already have keep their places.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'nearbyQuests', initial: true, online: 'player' }),
  }),
  // QL1 (2026-10-19, the owner: "modernize the questing system to be more in line with the mainline games ... This would
  // be toggled for online and not be able to be changed"): QUESTLINES (bible/06-Systems/Questlines-Arc.md) - every quest's
  // objectives, branches whose choices end it differently, outcomes that pay gear, and the questlines. A rule, so the lane
  // forces it on online (the owner: locked); offline the player's, on by default (the owner's answer). Read when a quest
  // STARTS and stamped on it for life (systems/questlines/qlLaw.js startStamp), so turning it off strands nothing.
  Object.freeze({
    id: 'questlines',
    group: 'world',
    get title() { return t('features.questlines.title', 'Questlines'); },
    // AUDIT QUESTLINES VOICE-QL: since UI-4/REWARD-6 only a quest whose sheet pays gear offers a piece (qlLayer.js rowOf
    // `gear`, which qlJournal.js qlObjectivesBlock reads) - "each one finished offers" was no longer true. Still two
    // sentences and no longer than it was (FT15's note budget)
    get note() { return t('features.questlines.note', 'Every quest shows its objectives, some let you choose how they end, some offer a piece of gear '
      + 'fitted to you when done, and questlines lead to the Breaches, the Battlespire and the Abyss. Off is the classic journal '
      + 'and its rewards, and online it is always on.'); },
    get effect() { return t('features.questlines.effect', 'Takes effect on the next quest you take; quests you already have keep the rules they began with.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questlines', initial: true, online: true }),   // systems/questlines/qlLaw.js QUESTLINES_PREF
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
    note: 'Townsfolk have names, homes, trades and daily routines. They open their shops, meet and talk at the square '
      + 'and the tavern, sleep at night and remember how you treated them. Everyone online sees the same people. '
      + 'Off fills the streets with the classic wandering strangers, who vanish at dusk.',
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
    get title() { return t('features.mod.title', '{title} by {author}', { title: 'Windmills of Daggerfall', author: 'Kamer' }); },
    get note() { return t('features.mod.windmillsKamer.note', 'Windmills with turning sails on seven farms, with machinery inside and a look for every climate and '
      + 'season. Off leaves the farms as they were.'); },
    get effect() { return t('features.effect.worldLoads', 'Takes effect when the world next loads.'); },
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: WINDMILLS_KEY, initial: true, online: 'player' }),
  }),
  // KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md section 10.7): THE KING'S GAMBIT, the card table's third game.
  // The bundle ships no settings file, so the row is declared for the mod by id, as the Windmills' is; on by default (MO1,
  // "All mods should be enabled by default"); off, no card table offers it. In the world's group: the record's "Gameplay
  // tab" is a settings tab, no Features group (FOUND AT KG3). Read as a table's panel is painted - at once.
  Object.freeze({
    id: 'mod-kings-gambit',
    group: 'world',
    // the mod's own name and its author, as every mod row carries them (AUDIT SURV E) - the bundle names none, so the
    // credits' own unnamed form (ui/credits.js), as Oblivion Remaster Like Leveling's row names its source
    get title() { return t('features.mod.title', '{title} by {author}', { title: 'The King\u2019s Gambit', author: t('credits.author.unnamed', 'Unnamed ({source})', { source: 'thekingsgambit.dfmod' }) }); },
    get note() { return t('features.mod.kingsGambit.note', 'A game of armies and kings at a tavern\'s card table, against a regular or another player, for gold or for fun. Off, the tables offer only Hold\'em and Iliac Hand.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: KINGS_GAMBIT_KEY, initial: true, online: 'player' }),
  }),
  modFeature('seasons-iliac-bay', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'sight'),   // FT18: was world
  modFeature('low-poly-trees', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'sight'),   // LPT1: read once, as the world loads
  modFeature('heat-haze', () => t('features.effect.atOnce', 'Takes effect at once.'), 'sight'),   // HAZE1: the exterior hosts read its switch every frame (the enhanced outdoors')
  modFeature('windfall', () => t('features.effect.atOnce', 'Takes effect at once.'), 'sight'),   // WINDFALL1: the same - and every flora batch carries its mask from its build, so the law turns on and off with it
  modFeature('snowfall', () => t('features.effect.atOnce', 'Takes effect at once.'), 'sight'),   // SNOWFALL1: the same - its switch read every frame; off hides the snow, and the snowpack keeps its clock
  modFeature('roads-hazelnut', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'world'),
  // TO1 (2026-09-17): TRAVEL OPTIONS - `world`, because what it changes
  // is how you cross it. The effect line is the SWITCH's (FT9: when each
  // switch lands), and the switch is read once at world load (AUDIT
  // PRE-MERGE 0928 U7), as are the mod's own "won't take effect without
  // restarting DFU" keys (its roads integration and its junction map).
  // TO-LIVE (2026-10-02): its other dials are read again as they change
  // (scenes/world.js refreshTravelOptionsSettings).
  modFeature('travel-options', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'world'),
  // IT1 (2026-10-04): IMMERSIVE TRAVEL - `world`, the carriages at the city gates. Its gate blocks and its two factions
  // are laid when the game loads (the world-data door latches its blocks, the faction dictionary is built at the load);
  // its fares and its rules are read as a driver's map opens.
  modFeature('immersive-travel', () => t('features.mod.immersiveTravel.effect', 'Takes effect the next time you start the game; loading a save is not enough. Fares and rules change at the next map.'), 'world'),
  // WOD1 (2026-09-23): WORLD OF DAGGERFALL - `world`, because it is the
  // wilderness itself. Read at the world's mount, like the roads it
  // consults: the loader's list is built once per world.
  modFeature('world-of-daggerfall', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'world'),
  // AS1 (2026-09-25): AQUATIC SPRITES - `world`, three flooded dungeon
  // blocks. The door caches a block once it is served, so a switch flipped
  // mid-session reaches the next load, not the dungeon you stand in.
  modFeature('aquatic-sprites', () => t('features.effect.gameLoads', 'Takes effect when the game next loads.'), 'world'),
  // DS1 (2026-09-25): DETAILED SHIPS - `world`, the two ships you can own.
  // Their building records are read through the door once per load.
  modFeature('detailed-ships', () => t('features.effect.gameLoads', 'Takes effect when the game next loads.'), 'world'),
  // WD3 (2026-10-01): BEAUTIFUL VILLAGES and BEAUTIFUL CITIES - `world`, the towns themselves. The world-data
  // loader reads each switch once, when the game loads (scenes/modWorldData.js latches it), so a town never moves
  // under the player; online the room owns both.
  modFeature('beautiful-villages', () => t('features.mod.beautifulTowns.effect', 'Takes effect the next time you start the game; loading a save is not enough. Offline it also needs Replace Game Artwork.'), 'world'),   // AUDIT WD3 B9
  modFeature('beautiful-cities', () => t('features.mod.beautifulTowns.effect', 'Takes effect the next time you start the game; loading a save is not enough. Offline it also needs Replace Game Artwork.'), 'world'),   // AUDIT WD3 B9
  // WA1 (2026-09-25): WARM ASHES - SHIPS - `world`, the sea voyage. The travel
  // hook reads the switch as a journey starts; an ambush already at sea
  // finishes either way.
  modFeature('warm-ashes-ships', () => t('features.mod.warmAshesShips.effect', 'Takes effect on your next sea voyage.'), 'world'),
  // RAID1 (2026-09-27): WORLD EVENTS - RAIDING PARTIES - `world`, the towns'
  // raids. The runner reads the switch every frame: off, nothing is rolled,
  // announced or stood, and a raider already standing fights on uncounted.
  modFeature('world-events-raiding-parties', () => t('features.effect.atOnce', 'Takes effect at once.'), 'world'),
  // DW-A to DW-D (2026-09-25): ILIAC PUDDLE NO MORE - `world`, the sea itself. The
  // world host builds the deep bay (its host, its renderer, its swimmer) at
  // the world's mount, so the switch reaches the next world; its looks and
  // its swim read their dials every frame.
  modFeature('iliac-puddle-no-more', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'world'),
  // OH-A (2026-09-26): THERE'S A HOLE IN THE BOTTOM OF THE OCEAN - `world`, a pit in
  // the sea. Its pits are stood as the world builds the seafloor, so the switch
  // reaches the next world; its sliders re-evaluate the loaded pits (its own
  // LoadSettings callback) and the abyss's two read on the frame.
  modFeature('ocean-holes', () => t('features.effect.worldLoads', 'Takes effect when the world next loads.'), 'world'),
  // CSA-A (2026-09-27): COME SAIL AWAY - `world`, a boat you own and sail. Its
  // two item templates (1320, 1321) merge when the game loads
  // (ItemHelper.LoadItemTemplates), so the switch reaches the next load.
  modFeature('come-sail-away', () => t('features.effect.gameLoads', 'Takes effect when the game next loads.'), 'world'),
  // FORAGE1 (2026-09-28): FORAGING - `world`, the wilderness's work. A tool
  // and a food read the switch as they are used; the quest pack is offered
  // while it is on. AUDIT 28 F4: the pack is read once, when the quest lists
  // are built (questLists.js) - so the row says the two halves apart.
  modFeature('foraging', () => t('features.mod.foraging.effect', 'Takes effect at once; its quests when the game next loads.'), 'world'),
  modFeature('meanerMonsters', () => t('features.mod.meanerMonsters.effect', 'Takes effect on monsters that appear after the change. With Daggerfall Enemy Expansion on, it takes effect when the game next loads.'), 'combat'),
  // DEX0: DAGGERFALL ENEMY EXPANSION - `combat`, beside the other bestiary mod. Loaded for the game or not, as DFU loads
  // a mod (its rows, its tables and its hooks written at its install - modSettings.js latchModLoaded), so a switch
  // flipped mid-game waits for the next load, as Roleplay & Realism's enemy appearance does.
  modFeature('daggerfall-enemy-expansion', () => t('features.effect.gameLoads', 'Takes effect when the game next loads.'), 'combat'),
  modFeature('pcaao', () => t('features.effect.atOnce', 'Takes effect at once.'), 'combat'),
  modFeature('unleveledLoot', () => t('features.mod.unleveledLoot.effect', 'Takes effect on the next drop or shop restock.'), 'loot'),
  modFeature('weapon-widget', () => t('features.effect.atOnce', 'Takes effect at once.'), 'combat'),   // WW1: the widget reads its switches every frame
  modFeature('shield-widget', () => t('features.effect.atOnce', 'Takes effect at once.'), 'combat'),
  modFeature('readied-spellcasting-hands', () => t('features.effect.atOnce', 'Takes effect at once.'), 'combat'),   // RSH1: the rig reads its switch on the frame it draws   // SW1: the same - every switch is read on the frame
  modFeature('diverse-weapons', () => t('features.mod.diverseWeapons.effect', 'Takes effect when a weapon is next drawn.'), 'combat'),
  modFeature('roleplay-realism-items', () => t('features.effect.gameLoads', 'Takes effect when the game next loads.'), 'loot'),   // RRI1: the template patches are merged at load (ItemHelper.LoadItemTemplates); the classes read their switches live; RRI2: the nine modules read theirs at each roll (a corpse, a shelf, a price), the starting kit and spellbook at the next character   // DW1: the atlas name is chosen at the weapon's load (FPSWeapon.cs:637-644), and the rig's cache key carries it
  modFeature('roleplay-realism', () => t('features.effect.gameLoads', 'Takes effect when the game next loads.'), 'loot'),   // RR1: the class enemies' appearance is written into the basics at load (RoleplayRealism.cs:186-189); every other arm reads its switch at the roll
  modFeature('handheld-torches', () => t('features.effect.atOnce', 'Takes effect at once.'), 'loot'),   // HT1: the component reads its switches every frame
  // AT0 (2026-09-15): AMBIENT TEXT - `world`, because what it talks
  // about is where you are. Its effect line is the mod's own pacing:
  // off falls silent at once, and on hands the mod back a clock that
  // has been running the whole time (AT1 - the interval keeps running
  // while the mod is quiet, exactly as it does while you are indoors).
  modFeature('ambient-text', () => t('features.effect.atOnce', 'Takes effect at once.'), 'interface'),   // FT18: was world
  // EOTB0 (2026-09-15): EYE OF THE BEHOLDER - third person for a
  // player with no Morrowind data (Mac: "This is moreso for those who
  // opt out of using morrowind"). Filed under `world` rather than
  // `combat`: it changes where you see the whole game from, not how a
  // blow lands. The effect line is honest about the one thing that is
  // not immediate - the view itself is the WHEEL's now (EOTB4), so
  // turning the row on does not move the camera until the player
  // scrolls.
  modFeature('eye-of-the-beholder', () => t('features.mod.eyeOfTheBeholder.effect', 'Takes effect at once. Scroll out to leave first person.'), 'sight'),   // FT18: was world
  // IF1 (2026-09-16): IMMERSIVE FOOTSTEPS - the component reads its
  // switches every frame; the stride is the mod's the moment its clips are
  // decoded (a fetch here, where the mod's LoadAudio is synchronous).
  modFeature('immersive-footsteps', () => t('features.effect.atOnce', 'Takes effect at once.'), 'sound'),   // FT18: was world
  modFeature('world-tooltips', () => t('features.effect.atOnce', 'Takes effect at once.'), 'interface'),   // FT18: was world   // WORLD-HOVER: the hover reads the switch on the frame it draws
  // BA1 (2026-09-16): BETTER AMBIENCE - read every frame; the dungeon's fog
  // and light are rolled at the door, so those two land on the next dungeon.
  modFeature('better-ambience', () => t('features.mod.betterAmbience.effect', 'Takes effect at once; a dungeon\u2019s fog and light from the next one you enter.'), 'world'),
  // HCC (2026-09-23): HORSE CART AND CARGO - `world`, because what it
  // changes is what stands in it: your horse and wagon as physical things.
  // The runtime reads its switches every frame (HandleSettingsChanged is
  // the mod's own listener); turning it off recalls the pair to you.
  modFeature('horse-cart-and-cargo', () => t('features.effect.atOnce', 'Takes effect at once.'), 'world'),
  // PI1 (2026-10-07): PHYSICAL ITEMS - `world`, as Horse Cart and Cargo: what it changes is what lies in it. The layer
  // reads its switch and its settings every frame (scenes/physicalItemsLayer.js); a size lands on the items that stand
  // after it (the mod's "Applies to newly created visuals").
  modFeature('physical-items', () => t('features.mod.physicalItems.effect', 'Takes effect at once; a size change applies to items that drop after it.'), 'world'),
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
    get note() { return t('features.mod.weaponSheathing.note', 'With the Morrowind body, a put-away weapon hangs in a scabbard on your hip or back, and a bow gets a '
      + 'quiver. Off, a put-away weapon disappears, as in Morrowind.'); },
    get effect() { return t('features.mod.weaponSheathing.effect', 'Takes effect at once with the Morrowind body.'); },   // FT18: the Mods page it named is gone - the tile rebuilds it (enhancedMenu.js TILE_AFTER)
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: 'mwSheathing', initial: true, online: 'player' }),
  }),
  // MW-STEEL1 (2026-10-06, Mac: "the armor replacement of the morrowind steel armor with a varient to toggle the helmet
  // type"): the steel plate's helm, two ways - closed (a visor and a plume) or open (a nasal helm, the face showing).
  // Mac's answers: a switch here beside Weapon Sheathing, closed by default. The VIEWER'S, as the sheathing is: it is
  // how this machine draws a steel helm - the player's and every peer's - and it never reaches the wire. Read where the
  // worn set is composed (combat/fpArm.js); the tile rebuilds the body at once (ui/enhanced/enhancedMenu.js TILE_AFTER).
  Object.freeze({
    id: 'steel-helm',
    group: 'combat',
    title: 'Steel Helm',
    note: 'With the Morrowind body, choose how a Steel Helm looks: Closed has a visor and a plume; Open is a nasal helm that shows the face.',
    effect: 'Takes effect at once with the Morrowind body.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mwSteelHelm', initial: 'closed', online: 'player', tiers: Object.freeze([['closed', 'Closed'], ['open', 'Open']]) }),
  }),
  // MW-SPELLFX1 (2026-10-07, Mac: "We need to implement morrowind spell casting effects and animations"): Morrowind's
  // spell effects - the casting effects and the glowing hands as a cast starts, the bolt it flies as, the hit and the
  // burst - off the player's own masters (scenes/mwMagicFx.js). On by default, the Morrowind body's own look. The
  // VIEWER'S, as the sheathing is: it is how this machine draws a spell - mine and every peer's - and it never reaches
  // the wire. Read at every effect's spawn; off clears the effects running.
  Object.freeze({
    id: 'mw-spell-effects',
    group: 'combat',
    title: 'Morrowind Spell Effects',
    note: 'With Morrowind data, spells look as they do in Morrowind: a swirl and glowing hands as you cast, the bolt in flight, the hit and the burst. Off shows only the classic spell missiles.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mwSpellEffects', initial: true, online: 'player' }),
  }),
  // BODY-MOTION (2026-10-18, Mac: "I want to build improved animations for the morrowind rig (3rd person)"; bible/04-Characters/
  // Body-Motion.md): the Morrowind body's own motion in third person - its walk, run and sneak paced to its speed and its
  // race's leg, each weapon carried its own way, a blow thrown with the whole body while the legs keep moving
  // (characters/bodyMotion/) - over Morrowind's clips. On by default. The VIEWER'S, as the Steel Helm is: how this machine
  // draws a body - mine, a peer's, the people's - never the wire. Read every frame where each rig builds its word
  // (characters/bodyMotion/bodyMotion.js motionWord), so it eases in or out at once.
  Object.freeze({
    id: 'mw-body-motion',
    group: 'combat',
    get title() { return t('features.mwBodyMotion.title', 'Morrowind Body Motion'); },
    get note() { return t('features.mwBodyMotion.note', 'In third person a Morrowind body walks at the pace you move, carries each weapon its own way, and '
      + 'swings with its whole body while its legs keep moving. Off plays Morrowind\u2019s own animations.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mwBodyMotion', initial: true, online: 'player' }),
  }),
  // MWNPC5b (2026-10-09, Mac: "I wanna do everything and ensure that performance isnt affected"): THE PEOPLE IN
  // MORROWIND BODIES - the NPC lanes (characters/npcBodies.js) under ONE frame budget (MWNPC11, NPC_FRAME_TIERS): Off, the
  // classic sprites; Near, the nearest 24 a frame within a street's width, whoever they are; All, 48 across a square. The
  // VIEWER'S, as the Steel Helm is: how this machine draws the people, never the wire. Read every frame by each host's
  // lane (npcBodiesOn and its tier), so it lands at once. AUDIT MW-NPC II P6: the note said "foes first" and "the closest
  // dozen" - MWNPC11's budget ranks every lane alike and stands up to 24.
  Object.freeze({
    id: 'mw-npc-bodies',
    group: 'world',
    title: 'Morrowind People',
    note: 'With the Morrowind body, the people around you get Morrowind bodies too, nearest first. Near shows up to 24; All shows up to 48 but costs more.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mwNpcBodies', initial: 'near', online: 'player', tiers: Object.freeze([['off', 'Off'], ['near', 'Near'], ['all', 'All']]) }),
  }),
  // NPC-MARKS (2026-10-21, the owner: "vendors and quests npcs are hard to find due to everyone looking the same. Could we
  // make a bobbing icon above their character for morrowind specifically?"): a bobbing mark over a Morrowind body whose
  // click is a quest's (a yellow "!"), a merchant's (an amber coin) or a guild's or the arena's (a blue gem) - scenes/npcMarksHost.js. On by
  // default. The VIEWER'S: how this machine draws the people, never the wire. Read every frame by each host's marks, so
  // it lands at once; under the classic sprites nothing is drawn (the picture is the mark).
  Object.freeze({
    id: 'npc-marks',
    group: 'world',
    get title() { return t('features.npcMarks.title', 'Morrowind People Marks'); },
    get note() { return t('features.npcMarks.note', 'With Morrowind People on, a small icon bobs over the people worth finding: a yellow mark over someone a '
      + 'quest needs, a coin over a merchant, and a blue gem over guild trainers, guild quest givers and the arena\u2019s officers.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'npcMarks', initial: true, online: 'player' }),
  }),
  // BODY-CARD (2026-10-14, the owner: "Reimplement the billboard morrowind look as a toggle"; asked, the upright card
  // BODY-LEAN replaced): every Morrowind body and 3D horse - the player's, a peer's, the people's - stands on an UPRIGHT
  // card, as Daggerfall's flats do; since BODY-FLAT (2026-10-23) its picture is taken level, as a flat's art is drawn, so
  // it stands its true height at any distance (it drew cos(pitch) of it, and a sliver up close). Off, since BODY-CROP the
  // body is the main camera's own picture of it, true from any eye however near. The VIEWER'S: how this machine draws a
  // body, never on the wire. Read where the picture is taken (render/characterSprite.js drawBodyPicture, drawRigSpriteBox),
  // so it takes effect at once.
  Object.freeze({
    id: 'mw-billboard-look',
    group: 'world',
    get title() { return t('features.mwBillboardLook.title', 'Billboard Look'); },
    get note() { return t('features.mwBillboardLook.note', 'With the Morrowind body, bodies and horses stand as flat upright pictures, like the '
      + 'classic sprites. Off, they are drawn as the camera sees them in 3D.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mwBillboardLook', initial: false, online: 'player' }),
  }),
  // MW-DETAIL (2026-10-22, a player's report: "morrowind 3d models are always pixelated ... this should probably be
  // optional"): every Morrowind picture - the bodies, the 3D horses, the first-person arm - is drawn at MW_ARM_PIXEL
  // screen pixels a texel, the owner's look; Sharp draws them a texel a pixel, at the screen's own resolution. Pixelated
  // stays the default. The VIEWER'S: how this machine draws a body, never on the wire. Read where each picture is sized
  // (render/characterSprite.js mwModelPixel), so it takes effect at once. Sharp grows the sprite target to the screen's
  // size where a picture needs it (render/renderer.js charSpriteRoom, CHAR_SPRITE_RT_MAX).
  Object.freeze({
    id: 'mw-model-detail',
    group: 'world',
    get title() { return t('features.mwModelDetail.title', 'Morrowind Model Detail'); },
    get note() { return t('features.mwModelDetail.note', 'With the Morrowind body, Pixelated draws bodies, horses and your arms in large pixels '
      + 'like the classic sprites. Sharp draws them at your screen’s full resolution and uses more video memory.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'mwModelDetail', initial: 'pixel', online: 'player', tiers: Object.freeze([tier('pixel', () => t('features.mwModelDetail.pixel', 'Pixelated')), tier('sharp', () => t('features.mwModelDetail.sharp', 'Sharp'))]) }),
  }),
  // ORL1 (2026-09-17): OBLIVION-REMASTER-LIKE LEVELING - the first
  // Morrowind mod, and the only row whose effect line has to say NEXT
  // CHARACTER. Every other mod's switch lands on the running game; this
  // one decides whether a character is ASKED the question at creation,
  // and the answer then rides that character's save. Turning it off
  // does not convert a character who is already levelling by virtues,
  // and saying so on the tile is the honest line - the alternative is a
  // player flipping the switch mid-game and wondering why nothing moved.
  modFeature('oblivion-remaster-leveling', () => t('features.mod.oblivionRemasterLeveling.effect', 'Takes effect on the next character you make; a character keeps the system they were created with.'), 'character'),
  // LEGACY1 (2026-10-05, bible/06-Systems/Legacy-Arc.md): PROJECT LEGACY - Mac's own mod. A family is founded around
  // the character played when the mod is on (at creation, or at the first load of a character made before it), and its
  // model is the family's for good - so the switch lands at once for the tree and the key, and a family keeps its model.
  modFeature('project-legacy', () => t('features.mod.projectLegacy.effect', 'Takes effect at once; a family keeps the model it was founded with.'), 'character'),
  // FT10 (2026-09-14): DFU'S OWN DUNGEON ENHANCEMENTS - three of the
  // Enhancements section's switches, each read by the port at the point
  // of use as DFU reads it. DFU Classic: Daggerfall Unity's departures
  // from classic Daggerfall, ported 1:1, shipping at DFU's own defaults.
  // The titles are the settings pane's (settingsCopy.js LABELS), so the
  // pointer rows there and the rows here say one name.
  Object.freeze({
    id: 'enemy-infighting',
    group: 'combat',
    get title() { return t('features.enemyInfighting.title', 'Enemies Fight Each Other'); },
    get note() { return t('features.enemyInfighting.note', 'Monsters attack anything they aren’t allied with, not just you: a bear fights a spider, a Daedra '
      + 'fights a knight. On by default in Daggerfall Unity.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/EnemyInfighting' }),
  }),
  Object.freeze({
    id: 'varied-dungeon-monsters',
    group: 'world',
    get title() { return t('features.variedDungeonMonsters.title', 'Varied Dungeon Monsters'); },
    get note() { return t('features.variedDungeonMonsters.note', 'Random monsters are picked from the dungeon’s full list around your level, so a dungeon has more '
      + 'variety instead of the same few. Off by default in Daggerfall Unity.'); },
    get effect() { return t('features.effect.nextDungeon', 'Takes effect on the next dungeon you enter.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/AlternateRandomEnemySelection' }),
  }),
  Object.freeze({
    id: 'torches-from-items',
    group: 'loot',
    get title() { return t('features.torchesFromItems.title', 'Torches Light Your Way'); },
    get note() { return t('features.torchesFromItems.note', 'Your light in dungeons comes from a torch, lantern or candle you carry, and it burns down, instead '
      + 'of a light you always have. Off by default in Daggerfall Unity.'); },
    get effect() { return t('features.torchesFromItems.effect', 'Takes effect at once; new characters and shop stock follow it.'); },
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
    get title() { return t('features.combatVoices.title', 'Combat Voices'); },
    get note() { return t('features.combatVoices.note', 'You and your enemies grunt when swinging and cry out when hit. The sounds are in the original game but '
      + 'go unused. On by default in Daggerfall Unity.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/CombatVoices' }),
  }),
  // UI-CALM (2026-10-14, a player: "Not everything needs to be visible constantly. Show information when it's
  // relevant."): THE CALM HUD (ui/enhanced/enhancedHud.js HUD_CALM_PREF) - the vitals rest while full and untouched, and come
  // back with the first point lost or spent. On by default; the player's own, online too.
  Object.freeze({
    id: 'calm-hud',
    group: 'interface',
    get title() { return t('features.calmHud.title', 'Calm HUD'); },
    get note() { return t('features.calmHud.note', 'Your health, fatigue and magicka bars fade away while all three are full, and come back the moment one changes.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'hudCalm', initial: true, online: 'player' }),
  }),
  Object.freeze({
    id: 'near-death-warning',
    group: 'interface',   // FT18: was combat
    get title() { return t('features.nearDeathWarning.title', 'Near Death Warning'); },
    get note() { return t('features.nearDeathWarning.note', 'The screen pulses as your health gets low: slowly below 40%, fast below 20%. On by default in '
      + 'Daggerfall Unity.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/NearDeathWarning' }),
  }),
  Object.freeze({
    id: 'bows-left-hand',
    group: 'combat',
    get title() { return t('features.bowsLeftHand.title', 'Bows In Left Hand'); },
    get note() { return t('features.bowsLeftHand.note', 'Bows go in your left hand only, so you can keep a one-handed weapon in your right and switch between '
      + 'them. Off by default in Daggerfall Unity.'); },
    get effect() { return t('features.bowsLeftHand.effect', 'Takes effect on the next weapon you equip.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/BowLeftHandWithSwitching' }),
  }),
  Object.freeze({
    id: 'choose-guild-jobs',
    group: 'interface',   // FT18: was world
    get title() { return t('features.chooseGuildJobs.title', 'Choose Guild Jobs'); },
    get note() { return t('features.chooseGuildJobs.note', 'Guilds show you a list of the jobs you can take instead of giving you one at random. Off by default '
      + 'in Daggerfall Unity.'); },
    get effect() { return t('features.chooseGuildJobs.effect', 'Takes effect the next time a guild offers you work.'); },
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/GuildQuestListBox' }),
  }),
  Object.freeze({
    id: 'dungeon-wall-style',
    group: 'sight',
    get title() { return t('features.dungeonWallStyle.title', 'Dungeon Wall Style'); },
    get note() { return t('features.dungeonWallStyle.note', 'Which textures dungeon walls use: Classic, the region’s climate (Climate) or random (Random).'
      + ' Climate and Random keep main-story dungeons classic; Climate Only and Random Only '
      + 'change them too. Classic by default in Daggerfall Unity.'); },
    get effect() { return t('features.effect.nextDungeon', 'Takes effect on the next dungeon you enter.'); },
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
    get title() { return t('features.quickSlots.title', 'Quick slots'); },
    get note() { return t('features.quickSlots.note', 'Diamond puts 4 slots in a diamond at the bottom left, on keys 1 to 4. Hotbar puts 10 above your '
      + 'health bars on keys 1 to 0; Diamonds makes them diamonds. Drag an item or spell onto a slot, or point at it '
      + 'and press the key. Off hides them, but their keys still work.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'quickbarStyle', initial: 'hotbar', online: 'player', lane: 'quickSlots',   // HB1: ui/enhanced/enhancedHotbar.js HOTBAR_PREF
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'quickslots', initial: true, online: 'player' }),   // QS: ui/enhanced/enhancedHud.js hides the diamond on false
        Object.freeze({ store: 'prefs', key: 'hotbarShape', initial: 'square', online: 'player' })]),   // DIAMOND-HB: ui/enhanced/enhancedHotbar.js HOTBAR_SHAPE_PREF
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
    note: 'While the world loads, a screen shows where you are going over one of your screenshots or the menu\u2019s '
      + 'night sky. Choose the screenshots under Screenshots in the menu. '
      + 'Off keeps the classic load, with no screen.',
    effect: 'Takes effect at the next load.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({
      store: 'prefs', key: 'loadingScreen', initial: 'shots', online: 'player',   // ui/loadingScreen.js LOADING_PREF
      tiers: Object.freeze([['shots', 'Your screenshots'], ['art', 'Night sky'], ['off', 'Off']]),
    }),
  }),
  // EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
  // detailed way to handle them"): THE EVENT BOARD - the shared events a player can still reach, at the HUD's left edge,
  // and the news at its head that announces them and carries their lines (ui/eventBoard.js, bible/10-UI/Event-Board.md). On by default;
  // off, the events' lines go back to the chat (systems/eventNotices.js). Every skin draws it (the lines left the chat on
  // every skin). The player's own online.
  Object.freeze({
    id: 'event-board',
    group: 'interface',
    get title() { return t('features.eventBoard.title', 'Event board'); },
    // AUDIT EVENTS1 W5: WB13b's rules (no dash aside, no rhythm of three), and the switch's truth (a raid's news goes back to
    // the HUD's line, not the chat)
    get note() { return t('features.eventBoard.note', 'A board at the left of the screen lists the world events you can still reach, with how far away each one '
      + 'is and the time left. Their news opens at the top of the board and is kept in your journal. Off, the news goes back to the chat and the screen\'s message line.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'eventBoard', initial: true, online: 'player' }),   // systems/eventNotices.js EVENT_BOARD_PREF
  }),
  // GUIDE3 (2026-09-29, Mac: "...make it more accessible", then "This is your baby"): THE HERALD - a quest's news as
  // a notice in the enhanced stack (ui/quest/questHerald.js), fed by the quest bridge's tick. On by default (the arc's
  // DECISIONS: the silence it answers is DISC6's report); the player's own online, since news is no one else's.
  Object.freeze({
    id: 'quest-herald',
    group: 'interface',
    get title() { return t('features.questHerald.title', 'Quest news'); },
    get note() { return t('features.questHerald.note', 'A notice slides in when a quest begins, when its journal gains an entry, when one of its deadlines is '
      + 'less than a day away, and when it ends. Off updates the journal without a notice.'); },   // AUDIT GUIDE H1
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questHerald', initial: true, online: 'player' }),   // ui/quest/questHerald.js HERALD_PREF
  }),
  // GUIDE4 (2026-09-29): THE TRACKER - the quest you follow as a card at the HUD's right-upper edge (ui/quest/questTracker.js),
  // fed by the same look. On by default but quiet (DECISIONS 2): it follows the quest the journal last changed until
  // the player tracks one from the journal, and shows nothing with no quest to follow. The player's own online.
  Object.freeze({
    id: 'quest-tracker',
    group: 'interface',
    get title() { return t('features.questTracker.title', 'Quest tracker'); },
    get note() { return t('features.questTracker.note', 'A card at the top right shows the quest you track from the journal, or else the one it last updated: its '
      + 'newest entry, where it points and the time left. Off keeps the classic screen, with no quest card.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questTracker', initial: true, online: 'player' }),   // ui/quest/questTracker.js TRACKER_PREF
  }),
  // GUIDE5 (2026-09-29): THE MARKS - where a quest points, on the held map and the enhanced compass (ui/quest/questMarks.js):
  // only a place the player's map already holds, never the quest debugger's knowledge. On by default (DECISIONS 7).
  Object.freeze({
    id: 'quest-marks',
    group: 'interface',
    get title() { return t('features.questMarks.title', 'Quest marks'); },
    get note() { return t('features.questMarks.note', 'Places your quests send you to are marked on the map once your map knows them, and the quest you follow is '
      + 'marked on the compass. Off is the classic map and compass, which mark nothing for a quest.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questMarks', initial: true, online: 'player' }),   // ui/quest/questMarks.js MARKS_PREF
  }),
  // GUIDE8 (2026-10-05, the delve arc - Quest-Guide-Arc.md DECISIONS 3, "a player who cannot read a dungeon should be
  // able to ask for it"): THE GUIDANCE TIERS. Journal is GUIDE5's law; Exact is the quest debugger's knowledge - every
  // quest resource in a dungeon on its map (its floor on the strip) and the followed one on the compass
  // (systems/quest/questGuidance.js, read by scenes/worldModes.js for scenes/dungeonContext.js), and AUDIT DELVE inside
  // buildings too; Town between them - the building an entry names, ringed on the town map and on the compass while the
  // player is in its town (scenes/world.js). Exact is the one tier that can spoil: off by default, its own row.
  Object.freeze({
    id: 'quest-guidance',
    group: 'interface',
    title: 'Quest guidance',
    note: 'Journal marks only places your map already knows. Town also circles the building your journal names, on the '
      + 'Enhanced town map and your compass. Exact also marks a quest\u2019s item, person or foe in dungeons and buildings, '
      + 'which can spoil the search.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'questGuidance', initial: 'journal', online: 'player', classic: 'journal', tiers: Object.freeze([['journal', 'Journal'], ['town', 'Town'], ['exact', 'Exact']]) }),   // systems/quest/questGuidance.js GUIDANCE_PREF, GUIDANCE_TIERS
  }),
  // SENSE1 (2026-10-05, the delve arc - bible/03-World/Delve-Arc.md): THE LOOK ROUND. Asking for Info mode underground
  // lights what is near, in sight, and named by the plaque (systems/dungeon/dungeonSense.js, read by scenes/dungeonContext.js
  // at the ask). On by default: it lights nothing a press or the plaque would not reach. The secrets tier lights what
  // nothing else names - a wall only a lever moves - so it is the player's own ask.
  Object.freeze({
    id: 'dungeon-sense',
    group: 'interface',
    title: 'Look around',
    note: 'In a dungeon, selecting Info mode makes the levers, doors and containers near you and in sight glow for '
      + 'a few seconds. With secrets, walls that only a lever moves glow too.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'dungeonSense', initial: 'on', online: 'player', tiers: Object.freeze([['off', 'Off'], ['on', 'On'], ['secrets', 'With secrets']]) }),   // systems/dungeon/dungeonSense.js SENSE_PREF
  }),
  // ECHO1 (2026-10-05, the delve arc): THE CHAIN'S ECHO - a press that moves something out of sight says which way, marks
  // it on the dungeon map and lights it when it is reached; and in Info mode a lever's plaque says which way its work
  // lies (systems/dungeon/dungeonEcho.js, read by scenes/dungeonContext.js). On by default: it says only what the press itself
  // set going - the sound a room away the classic game never gives a direction to.
  Object.freeze({
    id: 'dungeon-echoes',
    group: 'interface',
    title: 'Lever echoes',
    note: 'When a lever or a plate moves something out of sight, a message says which way, the Enhanced map marks it, and '
      + 'it glows when you reach it. In Info mode, a lever\u2019s World Tooltips label says which way it works.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'dungeonEchoes', initial: true, online: 'player' }),   // systems/dungeon/dungeonEcho.js ECHO_PREF
  }),
  // WAYOUT1 (2026-10-05, the delve arc): THE WAY OUT ON THE COMPASS - the walked trail walked back to the way in, once
  // the way in has been found (systems/wayOut.js, read by scenes/dungeonContext.js). On by default: it points only
  // along where the player has already stood, toward the door they came in by - the held map's own beacon, said on the
  // compass.
  Object.freeze({
    id: 'dungeon-way-out',
    group: 'interface',
    title: 'Way out',
    note: 'In a dungeon, an arrow on the compass leads you back the way you came, to the entrance.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'dungeonWayOut', initial: true, online: 'player' }),   // systems/wayOut.js WAY_PREF
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
    get title() { return t('features.wildernessCamps.title', 'Wilderness camps & packs'); },
    get note() { return t('features.wildernessCamps.note', 'Out in the wilds you sometimes meet a small group of enemies, a camp or a roaming pack, instead of '
      + 'only one at a time. Off keeps the classic single encounters.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
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
    note: 'While you travel, enemies far below your level no longer stop you, and others sometimes come as a '
      + 'patrol. Off stops for every encounter, like the original.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'roadEncounters', initial: true, online: 'player' }),
  }),
  // DISC19-F (2026-09-24, Discord through Mac: "enhance guard
  // interaction"): THE WATCH DEFENDS THE TOWN (systems/town/townWatch.js) -
  // the port's own. DFU's combat watch exists only for a crime; this
  // brings it, as the player's ally, when a monster hunts the player
  // inside a town. Off is DFU's watch alone.
  Object.freeze({
    id: 'town-watch',
    group: 'world',   // FT18: was combat
    get title() { return t('features.townWatch.title', 'The watch defends the town'); },
    get note() { return t('features.townWatch.note', 'When a monster attacks you in a town and you’re not wanted, the town guard comes to help, then '
      + 'leaves once it’s safe. Commit a crime and they come for you as usual. Off keeps the classic guard, '
      + 'which only shows up for crimes.'); },
    get effect() { return t('features.effect.atOnce', 'Takes effect at once.'); },
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
  // SURV-TIERS (2026-09-23): the one switch is tiers - Off, Boons
  // (SURV-BOONS, 2026-10-12: neglect costs nothing, a need met earns a bonus),
  // Casual (the needs only borrow stamina, and a rest,
  // a meal or a drink never costs more than it gives) and Hard (the arc
  // as above, the costed rest with it); survival/difficulty.js. The default
  // is Boons since BOONS-DEFAULT (2026-10-13, Mac: "make boons the default"), Casual before it.
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
    get title() { return t('features.blood.title', 'Blood'); },
    get note() { return t('features.blood.note', 'Stains stay on floors and walls where blood lands. A big killing blow sprays it further, and a heavy '
      + 'hit on you splashes a few drops on the screen. The slider sets how much, from Light to Abattoir; Off '
      + 'keeps the classic splash that fades away.'); },
    get effect() { return t('features.blood.effect', 'Takes effect at once; the number of marks that stay changes when the game next loads or you enter a dungeon.'); },
    kinds: Object.freeze(['enhanced']),
    // FT18: BLOOD, ONE ROW. BLOOD1's marks, BLOOD1b's overkill, BLOOD2e's lens and BLOOD2g's gore were four tiles over
    // one system, and the gore dial had no Off: the one question a player asks - blood or no blood - took three
    // presses. The bar is the gore dial with an Off in front (systems/featureLanes.js 'blood'); the three switches
    // are PARTS, each its own in the drawer. ONLINE THEY ARE THE PLAYER'S: a mark is a local picture with no
    // gameplay in it, so every player answers for themselves.
    control: Object.freeze({
      store: 'prefs', key: 'blood-gore', initial: 'normal', online: 'player', lane: 'blood',   // BLOOD2g: combat/blood/bloodSwitch.js GORE_TIERS
      also: Object.freeze([
        Object.freeze({ store: 'prefs', key: 'blood-marks', initial: true, online: 'player' }),
        Object.freeze({ store: 'prefs', key: 'blood-overkill', initial: true, online: 'player' }),
        Object.freeze({ store: 'prefs', key: 'blood-screen', initial: true, online: 'player' }),
      ]),
      parts: Object.freeze([
        Object.freeze({ key: 'blood-marks', get label() { return t('features.blood.marks', 'Marks stay'); } }),
        Object.freeze({ key: 'blood-overkill', get label() { return t('features.blood.overkill', 'Overkill'); } }),
        Object.freeze({ key: 'blood-screen', get label() { return t('features.blood.screen', 'On the lens'); } }),
      ]),
    }),
  }),
  Object.freeze({
    id: 'mod-climates-calories',   // a mod-row id: WM3's law reaches the credits' vendor through it
    group: 'character',
    get title() { return t('features.mod.title', '{title} by {author}', { title: 'Climates & Calories', author: 'Ralzar' }); },   // AUDIT SURV E: the author's name, as every mod row carries it
    get note() { return t('features.mod.climatesCalories.note', 'Hunger, thirst, sleep and the weather come into play: eat, drink, dress for the climate and rest by a '
      + 'campfire or in a bed. On Boons neglect costs nothing, and staying fed, watered and rested in a bed or by '
      + 'a fire gives bonuses; on Casual, unmet needs only drain some stamina (never more than half) and it '
      + 'comes back once you’ve seen to them; on Hard they cost attributes and health and can make you sick; '
      + 'Off is the classic game.'); },
    get effect() { return t('features.mod.climatesCalories.effect', 'Takes effect at once. Online, each player picks their own.'); },
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
    // TIERS ON THE ONE KEY - three then, four since SURV-BOONS (below) -
    // and the same reading holds for each -
    // a tier decides only what MY body pays (survival/difficulty.js), so
    // every tier, Off included, stays the player's online. The segments
    // write difficulty.js SURVIVAL_STORED - Off as the old switch's own
    // `false` (AUDIT SURV-TIERS: an older build reading the same shelf
    // still sees Off as off), Casual and Hard by name - and the default
    // is its SURVIVAL_DEFAULT (test/systems/survival/survtiers.test.js holds the row to
    // them, as the Gore row is held to GORE_TIERS).
    //
    // SURV-BOONS (2026-10-12, the owner: "Players would still be able to switch between CAC versions"): A FOURTH SEGMENT ON
    // THE SAME KEY - Boons, stored by name, between Off and Casual (the gentlest first). The default stayed Casual until
    // BOONS-DEFAULT (2026-10-13, Mac: "make boons the default"), and
    // the same reading holds: a boon is MY body's, so the tier is the player's online.
    //
    // TEMP-UI (2026-10-12, the owner: "add a temperature widget to the UI"): THE TEMPERATURE PLATE IS A PART - shown by
    // default beside the compass (ui/enhanced/enhancedHud.js), a picture with no gameplay in it, so each player's own online.
    control: Object.freeze({
      store: 'prefs', key: 'survival', initial: 'boons', online: 'player',   // BOONS-DEFAULT: difficulty.js SURVIVAL_DEFAULT
      tiers: Object.freeze([tier(false, OFF), tier('boons', () => t('features.mod.climatesCalories.boons', 'Boons')), tier('casual', () => t('features.mod.climatesCalories.casual', 'Casual')), tier('hard', () => t('features.mod.climatesCalories.hard', 'Hard'))]),
      also: Object.freeze([Object.freeze({ store: 'prefs', key: 'survivalTempHud', initial: true, online: 'player' })]),
      parts: Object.freeze([Object.freeze({ key: 'survivalTempHud', get label() { return t('features.mod.climatesCalories.tempHud', 'Temperature on the HUD'); } })]),
    }),
  }),
  // NAV (2026-09-28, Mac: "proper naval combat with a huge reference to assassins creed black flag ... directly integrate
  // into online mode"): THE SEA FIGHT (bible/03-World/Naval-Combat.md) - the port's own, on Come Sail Away's hulls, so
  // it stands nothing without that mod. ONE SWITCH, FORCED ON ONLINE: the ships at sea are the room's world (one player
  // stands the sea for everyone near - scenes/naval/navalHost.js), and a room where one player sees the pirate boarding another
  // and the other does not is two worlds. The rest is each player's own: the traffic the sea they stand is filled with,
  // whether pirates grapple THEIR boat, and whether THEIR voyage's beaten raiders leave a hold to plunder.
  Object.freeze({
    id: 'naval-combat',
    group: 'combat',
    get title() { return t('features.navalCombat.title', 'Naval Combat'); },
    get note() { return t('features.navalCombat.note', 'Ship battles on Come Sail Away\u2019s boats: at the helm, look to one side and hold Attack to aim a broadside, '
      + 'then let go to fire. Pirates, merchant ships and navies sail the Bay; batter a ship until it surrenders, board '
      + 'it, take its cargo, then sink it or let it go. Piracy is a crime, and pirates can board your ship and '
      + 'fight you on deck. Online, everyone in the room shares one sea.'); },
    get effect() { return t('features.navalCombat.effect', 'Takes effect at once; Ship handling, the next time you take the helm. Online it is always on.'); },   // AUDIT NAV2 F14: the helm takes the handling once a session (comeSailAway.js responsive)
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
        Object.freeze({ key: 'naval-ships', get label() { return t('features.navalCombat.ships', 'Ships at sea'); },
          tiers: Object.freeze([tier('few', () => t('features.navalCombat.ships.few', 'Few')), tier('some', () => t('features.navalCombat.ships.some', 'Some')), tier('many', () => t('features.navalCombat.ships.many', 'Many'))]) }),
        Object.freeze({ key: 'naval-boarders', get label() { return t('features.navalCombat.boarders', 'Pirates board you'); } }),
        Object.freeze({ key: 'naval-raid-prize', get label() { return t('features.navalCombat.raidPrize', 'Raiders\u2019 plunder'); } }),
        Object.freeze({ key: 'naval-aim-camera', get label() { return t('features.navalCombat.aimCamera', 'Broadside camera'); } }),
        Object.freeze({ key: 'naval-handling', get label() { return t('features.navalCombat.handling', 'Ship handling'); },
          tiers: Object.freeze([tier('responsive', () => t('features.navalCombat.handling.responsive', 'Responsive')), tier('classic', () => t('features.navalCombat.handling.classic', 'Classic'))]) }),
        Object.freeze({ key: 'naval-auto-repair', get label() { return t('features.navalCombat.autoRepair', 'Crew repairs on their own'); } }),
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
