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
      Enabled: Object.freeze({ default: true, description: 'RosyTheRascal\u2019s seasonal nature flats: autumn, spring and winter repaints of the woodland, hills, haunted and mountain trees, rocks and plants, drawn at the mod\u2019s 3.1x size. The textures come from your own copy of the mod (its .dfmod, or its Textures folders) through the Your own textures pick; without them the classic flats draw. Off leaves the classic flats in every season.' }),
    }),
  }),
  'roads-hazelnut': Object.freeze({
    title: 'Basic Roads',
    author: 'Hazelnut',
    keys: Object.freeze({
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
      Enabled: Object.freeze({ default: true, description: 'Ralzar\u2019s Meaner Monsters 1.5.2, 1:1: "Buffs many monsters. Debuffs rats, bats and zombies." - twenty monsters\u2019 damage, health, level and armour rewritten, werewolves and wereboars drawn a fifth larger, the dragonling two and a half times its size. Takes effect on monsters spawned after the switch. With Physical Combat And Armor Overhaul also on, its own edit of these numbers takes over, as in Daggerfall Unity.' }),
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
      Enabled: Object.freeze({ default: true, description: 'Kirk.O\u2019s Physical Combat And Armor Overhaul 1.44, 1:1: armour reduces the damage you take instead of your chance to be hit, skills decide the hit, weapons wear by their kind and material, shields block by their material and your stats, critical strikes multiply damage. Off returns Daggerfall Unity\u2019s own combat formulas.' }),
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
      Enabled: Object.freeze({ default: true, description: 'Ralzar\u2019s Unleveled Loot 1.1.2, 1:1: "Makes loot and shop stock materials not scale to your level." Weapon and armour materials roll by your luck, the shop\u2019s quality and the dungeon\u2019s kind instead of your level; a corpse\u2019s gold is divided by your level and multiplied by your luck; Daedra and Orcs may drop their own metal. Off returns Daggerfall Unity\u2019s own rolls.' }),
      ...Object.fromEntries(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric'].map((name, i) => [name, Object.freeze({
        default: i,
        options: Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']),
        description: 'Whenever this material would drop, change it to the selected material.',
      })])),
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
export function isIntKey(def) { return def && typeof def.min === 'number' && typeof def.max === 'number'; }
/** UL1: a MultipleChoiceKey - `options` is the list, the value its index. */
export function isChoiceKey(def) { return def && Array.isArray(def.options); }
function coerce(def, v) {
  if (isChoiceKey(def)) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(def.options.length - 1, n)) : def.default;
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
