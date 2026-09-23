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
});
export const GROUP_ORDER = Object.freeze(['sight', 'world', 'loot', 'combat', 'character']);

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
  'weapon-widget': Object.freeze(['Swings.Speed', 'Bob.Length', 'Inertia.Scale']),
  // SW1: the three a player reaches for first - how big the shield sits,
  // where it sits, and what it does when the weapon comes out.
  'shield-widget': Object.freeze(['Shield.Scale', 'Shield.OffsetHorizontal', 'Shield.WhenAttacking']),
  // DW1: the one key besides the switch - the mod's own Weapon Widget preset, which its readme asks players to select.
  'diverse-weapons': Object.freeze(['WeaponWidgetPreset']),
  // RRI1: the three a player reaches for first - the new items, and what loot is.
  'roleplay-realism-items': Object.freeze(['newWeapons', 'newArmor', 'lootRebalance']),
  'handheld-torches': Object.freeze(['Handling.RememberLastLightSource', 'Handling.StowWhenSpellcasting', 'Bob.Length']),
  pcaao: Object.freeze(['equipmentDamageEnhanced', 'fadingEnchantedItems', 'armorHitFormulaRedone',
    'criticalStrikesIncreaseDamage', 'conditionBasedEffectiveness', 'softMaterialRequirements',
    'fixedStrengthDamageModifier']),
  unleveledLoot: Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril',
    'Adamantium', 'Ebony', 'Orcish', 'Daedric']),
  'roads-hazelnut': Object.freeze(['SmoothRoads', 'RiversAndStreams']),
  // TO1: the mod ships FIFTY-ONE keys across twelve sections, so this
  // one is curated hard. The five are what a player reaches for first:
  // whether a cautious trip is walked, whether a ship needs a port,
  // what a location does to a journey in progress, how fast it may run,
  // and which key follows a road. Everything else - the fourteen dot
  // colours, the junction map's placement, the fare scaling - stays in
  // the mod's own pane.
  'travel-options': Object.freeze([
    'CautiousTravel.PlayerControlledCautiousTravel', 'ShipTravel.OnlyFromPorts',
    'GeneralOptions.LocationPause', 'TimeAcceleration.AccelerationLimit',
    'RoadsIntegration.FollowPathsKey',
  ]),
  'ambient-text': Object.freeze(['textChance', 'interval', 'postTextInterval', 'textDisplayTime']),   // AT0: all four it ships - the mod is small enough that curation would only hide something
  // EOTB0: the mod ships FIFTY-FOUR keys across nine sections, so this
  // one IS curated, and the four are the ones a player reaches for
  // first: how far back the camera sits, which shoulder it sits over,
  // how fast it follows, and how big you are drawn. Everything else
  // stays in the mod's own pane.
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
    note: 'Any dungeon over five blocks is rebuilt as a fixed cross of five - a central block with four around it, the same '
      + 'five every visit. Main-story dungeons never shrink, a dungeon a quest sent you to keeps the size it had, and '
      + 'online every dungeon is full size.',
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
    note: 'How far the land streams around you, in map pixels each way. Daggerfall Unity stops at 4; the enhanced outdoors '
      + 'reach 6, drawing the far rings coarse with the haze as far. The classic skin, and the enhanced skin with the '
      + 'outdoors off, read it capped at Daggerfall Unity\u2019s 4.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'classic']),
    // LV1 (2026-09-12, Mac: "push the draw distance as far as we can push
    // it while keeping performance perfect"): the streamed grid's radius
    // in map pixels on the enhanced lane, 1..6; DFU's own Land View
    // Distance stays the 1:1 lane's 1..4. A dial: the player's online.
    control: Object.freeze({
      store: 'prefs', key: 'landViewDistance', initial: 5, online: 'player', lane: 'landView',   // the lane (world/landView.js) registers its tiers and its read/write
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
    note: 'The enhanced outdoors: a live sky with the sun, both moons and a star field, volumetric clouds that build with '
      + 'the weather and shadow the land, rain and snow falling around you, and grass bending in the wind. Off returns '
      + 'Daggerfall\u2019s SKY*.DAT panorama and its own weather. The third choice hands the sky to Dynamic Skies '
      + '(BadLuckBurt and carademono, carried with permission), whose own knobs open on this tile.',
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
    note: 'Enemies find their way on a navmesh baked from each dungeon, pathing around pillars and down corridors instead '
      + 'of walking into walls. Senses, decisions and attacks stay classic. Dungeons for now - towns, interiors and doors '
      + 'are still to come, and enemies bunch up until the crowd slice lands. Off keeps the 1:1 classic motor. It is not '
      + 'Daggerfall Unity\u2019s \u201cSmarter Enemies\u201d setting (EnhancedCombatAI), which the port does not run.',
    effect: 'Takes effect on the next dungeon you enter.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedAI', initial: false, online: true }),   // OFF by default and it stays off: DFU's classic motor is the 1:1 law, this the port's departure (as EnhancedCombatAI is DFU's own opt-in)
  }),
  // FT6 (2026-09-14): ENHANCED WATER (WATER1) - the surface pass over the
  // terrain's water tiles on the enhanced skin; off, or the classic
  // skin, draws DFU's flat tile. The switch's composition has one home
  // now (render/waterSurface.js waterSwitchOn); `?water=off` is the kill door.
  Object.freeze({
    id: 'enhanced-water',
    group: 'sight',
    title: 'Enhanced water',
    note: 'Oceans, rivers and ponds drawn as water: waves that rise with the wind, the sky and sun reflected, the '
      + 'moon\u2019s glint at night, rain pocking the surface, a feathered shore. Off returns Daggerfall\u2019s flat '
      + 'water tile.',
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
    note: 'Light that adds the way light does: textures and lights in linear colour under a tonemap, forty-eight lanterns '
      + 'with a flame\u2019s warmth falling off by the inverse square, fog that glows where their light crosses it, the '
      + 'sun\u2019s and the nearest torch\u2019s shadows, ambient occlusion in the corners, bloom on windows and flames, and '
      + 'shafts of sunlight. Off is Daggerfall Unity\u2019s flat shading.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedLighting', initial: true, online: true }),
  }),
  // FT7 (2026-09-14): THE TWO QUALITY TIERS OF THE ENHANCED OUTDOORS
  // (PERF1) - the grass field's fraction and the clouds' march. Both
  // are inert unless the outdoors row above is on (world.js gates the
  // grass on enhancedEnvironments; the clouds ride the enhanced lane),
  // which each note now says. Enhanced, the port's own dials.
  Object.freeze({
    id: 'grass-density',
    group: 'sight',
    title: 'Grass density',
    note: 'How much of the meadow grows under the enhanced outdoors. The heaviest thing outdoors - try Half first if the '
      + 'FPS counter says the frame is the GPU\u2019s.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'grassDensity', initial: 1, online: 'player', tiers: Object.freeze([[1, 'Full'], [0.5, 'Half'], [0.25, 'Quarter'], [0, 'Off']]) }),   // PERF1: a fraction of the lab's 1.2 million blades; a dial, the player's online
  }),
  Object.freeze({
    id: 'cloud-quality',
    group: 'sight',
    title: 'Cloud quality',
    note: 'How finely the volumetric clouds over the enhanced outdoors are marched. Low is a coarser sky with fewer steps; '
      + 'High is for a machine with room to spare.',
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
    note: 'How sharply the ground reads into the distance, where a mipmapped tile would otherwise soften. '
      + 'Off is the mipmap alone; Maximum is whatever the driver allows.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'groundSharpness', initial: 'default', online: 'player', tiers: Object.freeze([['off', 'Off'], ['default', 'Default (4x)'], ['max', 'Maximum']]) }),
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
    note: 'A concealed enemy is drawn rather than hidden: a chameleon shimmers, a shadow spell is a silhouette, and a hit '
      + 'flashes an unseen enemy - an invisible one included. Nothing about the rules changes. Off keeps the 1:1 draw.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedCombatVisuals', initial: true, online: true }),   // ECV1: on by default like the other enhanced visuals; the rules are untouched either way
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
    note: 'A Diablo-style ladder over Daggerfall\u2019s loot: a weapon, a piece of armour or a piece of jewellery may roll '
      + 'Magic, Rare or Legendary, with affixes you can read and compare. The odds follow the source - the dead '
      + 'thing\u2019s level, the dungeon\u2019s kind, your luck - never your level. A Rare or Legendary drops '
      + 'unidentified until it is read. Off is Daggerfall\u2019s loot exactly.',
    effect: 'Takes effect on the next roll; worn affixes follow within a magic round.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'lootRarity', initial: true, online: true }),   // LR5: ON by default (Mac) - the ladder is the port's own game, not an opt-in; the lane forces it on online as it always did
  }),
  // WIND3 (2026-09-14, Mac: wisps that show the wind, a quiet wind, the
  // trees moving with it): THE WIND SEEN AND HEARD - three rows over the
  // one wind (systems/windDrive.js), each the player's own online (a
  // look and a sound, nothing the room shares), each read every frame
  // by the exterior hosts. Kill doors `?wisps=off`, `?windaudio=off`,
  // `?sway=off`.
  Object.freeze({
    id: 'wind-wisps',
    group: 'sight',
    title: 'Wind wisps',
    note: 'Faint streaks of air riding the wind across the land under the enhanced outdoors, so you can see which way it '
      + 'blows and how hard.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'windWisps', initial: true, online: 'player' }),   // WIND3: render/windWisps.js wispsOn
  }),
  // ES1 (2026-09-16, Mac: "lump this in as a new enhanced toggle. Enhanced
  // Sounds, add the wind noise to it"): WIND3's `wind-sound` row IS this
  // row now - one switch over the port's own sounds (systems/
  // enhancedSounds.js): the wind loop, and the enhanced inventory's
  // transfer cues (MAC-O6). The kill door `?windaudio=off` still silences
  // the wind alone.
  Object.freeze({
    id: 'enhanced-sounds',
    group: 'world',
    title: 'Enhanced sounds',
    note: 'The sounds the port adds under the enhanced skin: a quiet wind outdoors from Daggerfall\u2019s own clips, '
      + 'rising and falling with its strength and silent indoors, and the gold clink and click when you take or '
      + 'store items in the enhanced inventory.',
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
    note: 'What you hold in first person takes the light of the room you are in: the classic weapon sprite, the '
      + 'casting hands and the torch in your off hand, and the Morrowind arms, which were lit by a fixed studio '
      + 'and read dark everywhere.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({ store: 'prefs', key: 'firstPersonLighting', initial: true, online: 'player' }),   // MAC-I: combat/weaponRig.js fpLightingOn
  }),
  Object.freeze({
    id: 'flora-sway',
    group: 'sight',
    title: 'Trees sway',
    note: 'Trees and plants lean with the wind under the enhanced outdoors, and a gust crosses a wood as one wave. Only the '
      + 'flora: people, signs and lights stand still.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'floraSway', initial: true, online: 'player' }),   // WIND3: systems/windDrive.js floraSwayOn; render/renderer.js BB_VS uSway
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
    note: 'Rain, storm and snow stand in cells over the land and drift on the day\u2019s wind, so you can see a storm on '
      + 'the horizon and walk into it and out the other side. Off is Daggerfall\u2019s own: the climate\u2019s word to '
      + 'the horizon.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'weatherEvents', initial: true, online: true }),   // WEATHER2b: weatherSim.js weatherFieldOn; forced on online - one sky
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
    note: 'The windmill towers and their turning sails on the seven farms Kamer chose to stand them on, with the '
      + 'machinery inside and a skin for every climate and season. Off is Daggerfall\u2019s own farms.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: WINDMILLS_KEY, initial: true, online: 'player' }),
  }),
  modFeature('seasons-iliac-bay', 'Takes effect when the world next loads.', 'world'),
  modFeature('roads-hazelnut', 'Takes effect when the world next loads.', 'world'),
  // TO1 (2026-09-17): TRAVEL OPTIONS - `world`, because what it changes
  // is how you cross it. The effect line is honest about the one half
  // that is not immediate: the settings are read ONCE at world load
  // (the mod's own "won't take effect without restarting DFU" keys are
  // its roads integration and its junction map), so a switch flipped
  // mid-session reaches the NEXT world.
  modFeature('travel-options', 'Takes effect when the world next loads.', 'world'),
  modFeature('meanerMonsters', 'Takes effect on monsters spawned after the switch.', 'combat'),
  modFeature('pcaao', 'Takes effect at once.', 'combat'),
  modFeature('unleveledLoot', 'Takes effect on the next roll.', 'loot'),
  modFeature('weapon-widget', 'Takes effect at once.', 'combat'),   // WW1: the widget reads its switches every frame
  modFeature('shield-widget', 'Takes effect at once.', 'combat'),   // SW1: the same - every switch is read on the frame
  modFeature('diverse-weapons', 'Takes effect when a weapon is next drawn.', 'combat'),
  modFeature('roleplay-realism-items', 'Takes effect when the game next loads.', 'loot'),   // RRI1: the template patches are merged at load (ItemHelper.LoadItemTemplates); the classes read their switches live; RRI2: the nine modules read theirs at each roll (a corpse, a shelf, a price), the starting kit and spellbook at the next character   // DW1: the atlas name is chosen at the weapon's load (FPSWeapon.cs:637-644), and the rig's cache key carries it
  modFeature('handheld-torches', 'Takes effect at once.', 'loot'),   // HT1: the component reads its switches every frame
  // AT0 (2026-09-15): AMBIENT TEXT - `world`, because what it talks
  // about is where you are. Its effect line is the mod's own pacing:
  // off falls silent at once, and on hands the mod back a clock that
  // has been running the whole time (AT1 - the interval keeps running
  // while the mod is quiet, exactly as it does while you are indoors).
  modFeature('ambient-text', 'Takes effect at once. The mod then speaks on its own clock.', 'world'),
  // EOTB0 (2026-09-15): EYE OF THE BEHOLDER - third person for a
  // player with no Morrowind data (Mac: "This is moreso for those who
  // opt out of using morrowind"). Filed under `world` rather than
  // `combat`: it changes where you see the whole game from, not how a
  // blow lands. The effect line is honest about the one thing that is
  // not immediate - the view itself is the WHEEL's now (EOTB4), so
  // turning the row on does not move the camera until the player
  // scrolls.
  modFeature('eye-of-the-beholder', 'Takes effect at once. Scroll out to leave first person.', 'world'),
  // IF1 (2026-09-16): IMMERSIVE FOOTSTEPS - the component reads its
  // switches every frame; the stride is the mod's the moment its clips are
  // decoded (a fetch here, where the mod's LoadAudio is synchronous).
  modFeature('immersive-footsteps', 'Takes effect at once.', 'world'),
  // BA1 (2026-09-16): BETTER AMBIENCE - read every frame; the dungeon's fog
  // and light are rolled at the door, so those two land on the next dungeon.
  modFeature('better-ambience', 'Takes effect at once. A dungeon\u2019s fog and light are rolled at its door.', 'world'),
  // WS1 (2026-09-17): WEAPON SHEATHING - Greatness7's scabbards and the
  // OpenMW mechanism, on the port's Morrowind third-person body. The
  // switch is the port's own pref (the mod ships no settings of its own);
  // RF4: declared here, once, the shelf's default and the online answer
  // riding the row. Forced on online as the arms are (mwArms), so every
  // body a peer sees wears its blade the same way.
  Object.freeze({
    id: 'mod-weapon-sheathing',
    group: 'combat',
    title: 'Weapon Sheathing',
    note: 'With Morrowind assets on, a sheathed weapon stays on the body - on the hip or the back, in the scabbard Greatness7\u2019s Weapon '
      + 'Sheathing ships for it, with a quiver for a bow. Off, a lowered weapon vanishes as in vanilla Morrowind.',
    effect: 'Takes effect when the Morrowind body next builds; the Mods page\u2019s switch rebuilds it at once.',
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'prefs', key: 'mwSheathing', initial: true, online: true }),
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
    note: 'A monster attacks whatever it is not allied with - a bear a spider, a Daedra a knight - and not only you. '
      + 'Daggerfall Unity ships it on.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/EnemyInfighting' }),
  }),
  Object.freeze({
    id: 'varied-dungeon-monsters',
    group: 'world',
    title: 'Varied Dungeon Monsters',
    note: 'Each random monster is drawn from the dungeon\u2019s table around your level, so a dungeon mixes its monsters '
      + 'instead of repeating the same few. Daggerfall Unity ships it off.',
    effect: 'Takes effect on the next dungeon you enter.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/AlternateRandomEnemySelection' }),
  }),
  Object.freeze({
    id: 'torches-from-items',
    group: 'loot',
    title: 'Torches Light Your Way',
    note: 'Your light in a dungeon comes from a torch, lantern or candle you carry and use, which burns down, instead of a '
      + 'light you always have. Daggerfall Unity ships it off.',
    effect: 'Takes effect at once; a new character\u2019s starting gear and a shop\u2019s next stocking follow it.',
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
    group: 'combat',
    title: 'Combat Voices',
    note: 'You and the people you fight grunt on a swing and cry out when hit - sounds Daggerfall carries but never plays. '
      + 'Daggerfall Unity ships it on.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/CombatVoices' }),
  }),
  Object.freeze({
    id: 'near-death-warning',
    group: 'combat',
    title: 'Near Death Warning',
    note: 'The screen throbs as your health falls - slow under two fifths, a fast burst under a fifth. Daggerfall Unity '
      + 'ships it on.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/NearDeathWarning' }),
  }),
  Object.freeze({
    id: 'bows-left-hand',
    group: 'combat',
    title: 'Bows In Left Hand',
    note: 'A bow equips in the left hand only, so a one-handed weapon can stay in the right and you switch between them. '
      + 'Daggerfall Unity ships it off.',
    effect: 'Takes effect on the next weapon you equip.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/BowLeftHandWithSwitching' }),
  }),
  Object.freeze({
    id: 'choose-guild-jobs',
    group: 'world',
    title: 'Choose Guild Jobs',
    note: 'A guild\u2019s quest-giver offers the jobs you are eligible for as a list, instead of one drawn at random. '
      + 'Daggerfall Unity ships it off.',
    effect: 'Takes effect the next time a guild offers you work.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Enhancements/GuildQuestListBox' }),
  }),
  Object.freeze({
    id: 'dungeon-wall-style',
    group: 'sight',
    title: 'Dungeon Wall Style',
    note: 'Which textures a dungeon\u2019s walls wear: Daggerfall\u2019s own table (Classic), the region\u2019s Climate, or '
      + 'the dungeon\u2019s seed (Random). Climate and Random leave the main-story dungeons classic; Climate Only and '
      + 'Random Only do not. Daggerfall Unity ships it Classic.',
    effect: 'Takes effect on the next dungeon you enter.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Video/RandomDungeonTextures' }),
  }),
  // QS (2026-09-17, Mac: the Demon's Souls diamond, "slots for the
  // mainhand/secondhand, consumable"): THE QUICKSLOT DIAMOND's switch.
  // The switch hides the DIAMOND alone - the three keys and the tooltip's
  // slot buttons keep working, because a player who turns the picture off
  // has not asked to lose the presses. Enhanced skin only; the classic HUD
  // never drew one.
  Object.freeze({
    id: 'quickslot-diamond',
    group: 'sight',
    title: 'Quickslot diamond',
    note: 'The enhanced HUD\u2019s bottom-left diamond: weapon, off hand and two consumable slots filled from the '
      + 'inventory tooltip, each with its key. Off hides the diamond; the keys still work.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'quickslots', initial: true, online: 'player' }),
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
    note: 'Travelling outdoors, a small group of enemies instead of a lone wanderer - a settled camp or a looser '
      + 'pack crossing your path. Off keeps only the classic one-at-a-time encounters.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'wildernessCamps', initial: true, online: 'player' }),
  }),
  // SURV2 (2026-09-18, Mac: "All on by default"): THE SURVIVAL ARC -
  // an overhaul of Ralzar's Climates & Calories (vendor/climates-
  // calories/README.md), not a port. The one switch for the whole of
  // it: the felt temperature and the five needs on the world minute,
  // the food, water and camping items the store shelves and a new
  // character carries, camps and campfires, the costed rest, hunting.
  // Off is the classic game: no needs, no provisions minted.
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
    id: 'blood-marks',
    group: 'combat',
    title: 'Blood stays',
    note: 'Blood marks the floor and the walls where it landed, and stays there. A glancing blow leaves a spatter and a '
      + 'near-lethal one a pool; a bloodless foe leaves nothing. The marks are a fixed set that recycles oldest-first, so '
      + 'they cost the same whether you have fought once or all day. Off keeps the classic splash, which plays and goes.',
    effect: 'Takes effect at once. The marks already laid stay until the room changes.',
    kinds: Object.freeze(['enhanced']),
    // ONLINE IT IS THE PLAYER'S. A mark is a local picture with no
    // gameplay in it - nobody else's floor changes - so unlike the
    // survival row, which the room has to agree on, this one every
    // player answers for themselves.
    control: Object.freeze({ store: 'prefs', key: 'blood-marks', initial: true, online: 'player' }),
  }),
  // BLOOD1b: the killing blow's own row. 175% of a body's health in
  // one hit is a blow an ordinary fight never lands, so what this
  // really turns off is the spectacle - which is why it is its own
  // row and not a second meaning for the one above.
  Object.freeze({
    id: 'blood-overkill',
    group: 'combat',
    title: 'Overkill',
    note: 'A blow that takes nearly twice a body\u2019s whole health throws blood far wider than an ordinary kill, and a '
      + 'warhammer throws it wider still. Off, a killing blow bleeds like any other hit. The marks it leaves are the same '
      + 'set as every other mark, so this costs nothing extra to keep on.',
    effect: 'Takes effect at once. Blood already thrown stays where it landed.',
    kinds: Object.freeze(['enhanced']),
    // the same reading as the row above: a mark is a local picture
    // with no gameplay in it, so every player answers for themselves.
    control: Object.freeze({ store: 'prefs', key: 'blood-overkill', initial: true, online: 'player' }),
  }),
  Object.freeze({
    id: 'mod-climates-calories',   // a mod-row id: WM3's law reaches the credits' vendor through it
    group: 'character',
    title: 'Climates & Calories by Ralzar',   // AUDIT SURV E: the author's name, as every mod row carries it
    note: 'Heat, cold, rain and the road wear you down - eat, drink, sleep and dress for the weather, and rest at a '
      + 'campfire or a bed. Off is the classic game, with no needs at all.',
    effect: 'Takes effect at once. Online the room decides.',
    kinds: Object.freeze(['mod', 'enhanced', 'classic']),   // AUDIT SURV E: a mod row, under the MOD AUTHORED filter
    control: Object.freeze({ store: 'prefs', key: 'survival', initial: true, online: true }),
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
/** The prefs-store keys the rows declare: key -> the shelf's default. */
export const FEATURE_PREF_DEFAULTS = Object.freeze(Object.fromEntries(
  FEATURES.filter((f) => f.control?.store === 'prefs').map((f) => [f.control.key, f.control.initial])));
/** ...and key -> the online lane's answer (true/false forced, 'player'). */
export const FEATURE_PREF_ONLINE = Object.freeze(Object.fromEntries(
  FEATURES.filter((f) => f.control?.store === 'prefs').map((f) => [f.control.key, f.control.online])));
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
    }
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
