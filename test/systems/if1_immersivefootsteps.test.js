// IF1 - IMMERSIVE FOOTSTEPS 1.01 (Kirk.O), THE MOD, 1:1 (2026-09-16, Mac:
// "Next mod we will be adding 1:1").
//
// The mod is two MonoBehaviours whose sources the author publishes under
// MIT, restated in systems/immersiveFootsteps.js. OWN-WORK4 (2026-10-31):
// the vendored copy is retired and its clips are our own (audio/synth/), so
// the pins hold the restatement to the SOURCE as literal tables (the tile and
// archive tables as Object.cs wrote them, the settings as modsettings.json
// shipped them) and to the seams: LoadAudio's 105 names a quality, each a
// clip our synth makes at the mod's length and rate, the row, the credit; then the laws
// driven through the component with a fixed-step frame: the step and
// sway timers under walk / run / half speed, the mount, the two switches,
// the swim distance, the exterior climate ladder tile by tile, the
// building floor walk off material names, the dungeon water arms, the
// armour ladder for boots and for sway weights, the no-repeat roll, the
// three landing sounds, the 250-tick refresh and the inventory close,
// and the mod's own quirks kept verbatim (altStep never set, the chain
// and plate re-rolls writing the LEATHER interval). Then the hosts.
//
// AUDIT-IF (2026-09-16): five findings pinned below (F1 the build's inlining, F2 the off-terrain tile,
// F3 the concurrent load, F4 the null discovery record, F5 both inventory skins). Campaign:
// tools/mutants/if1.json - 30 mutants, 28 killed, 2 equivalent as recorded; the two first-run
// survivors were pins that measured a constant against itself, made literal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createImmersiveFootsteps, readFootstepSettings, clipTable, clipNames, soundKey, makeFootstepClip,
  unityMaterialName, getFormattedTextureArchiveFromMaterialName, interiorFloorType, rollRandomAudioClip, coinFlip,
  checkClimateTileTables, checkBuildingClimateFloorTypeTables, CLIMATE_TILE_TABLES, BUILDING_FLOOR_TABLES,
  isSnowyClimate, isGrassyClimate, isRockyClimate, isSandyClimate, isSwampyClimate,
  IMMERSIVE_FOOTSTEPS_VENDOR, IMMERSIVE_FOOTSTEPS_MOD, FIXED_DELTA_TIME, SWIM_INTERVAL, REFRESH_SLOTS_TICKS, SOUND_CLIP_QUALITY, FLOOR_TYPE,
  LANDING_VOLUME_SCALE, SWAY_WEIGHTS, SWAY_SLOTS, SETTING_KEYS, FOOTSTEP_SETS, logModException, EXCEPTION_DOING, reportModCompatibilityIssues,
} from '../../src/systems/immersiveFootsteps.js';
import { MOD_SETTINGS, isIntKey, isFloatKey, isChoiceKey, isTextKey, isTupleKey } from '../../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED } from '../../src/systems/features.js';
import { EQUIP_SLOTS } from '../../src/characters/paperdoll/paperdoll.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { SEASON } from '../../src/world/climateSwaps.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { equipTableOf } from '../../src/systems/equip.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole
import { immersiveFootstepsRecipe, IF_CLIP_MS, IF_RATE } from '../../src/audio/synth/clips.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ~ ${b}`);
const V = IMMERSIVE_FOOTSTEPS_VENDOR;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const boots = (material) => ({ group: 'Armor', templateIndex: 108, material });
const armor = (material) => ({ group: 'Armor', templateIndex: 102, material });

/** A component with a fixed-step frame: the store is live, the audio records, the clips are a sample of nothing, the dice are scripted. */
function rig(over = {}, { rolls = [], fetchOk = () => true } = {}) {
  const store = { ...defaults(), ...over };
  const shots = [], registered = [];
  const audio = {
    registerSamples: (k, samples) => { registered.push(k); return samples.length > 0; },
    playOneShot: (k, v) => shots.push([k, v]),
  };
  let ri = 0;
  const random = () => (ri < rolls.length ? rolls[ri++] : 0.0);
  const c = createImmersiveFootsteps({
    audio, settings: () => readFootstepSettings(() => store), random,
    makeClip: async (name) => ({ samples: new Float32Array(fetchOk(name) ? 1 : 0), rate: 22050 }),
  });
  const entity = { items: [], activeEffects: [] };
  const slots = equipTableOf(entity);
  const outdoors = (o = {}) => ({
    paused: false, entity, grounded: true, standingStill: false, isRunning: false, movingLessThanHalfSpeed: false,
    transportMode: TRANSPORT_MODES.Foot, swimming: false, pos: [0, 0, 0], inside: false, inDungeon: false,
    season: SEASON.Summer, climateIndex: CLIMATES.Woodlands, tileMapIndex: 2, waterWalking: false, ...o,
  });
  const indoors = (o = {}) => outdoors({ inside: true, inDungeon: false, centreY: 0.9, waterSurfaceY: null, ...o });
  const dungeon = (o = {}) => indoors({ inDungeon: true, ...o });
  /** n fixed ticks of one place. */
  const ticks = (n, m) => { for (let i = 0; i < n; i++) c.update(FIXED_DELTA_TIME, m); };
  const boot = async (m = outdoors()) => { c.update(0, m); await c.settle(); };
  const plays = (re) => shots.filter(([k]) => re.test(k));
  return { c, store, shots, registered, entity, slots, outdoors, indoors, dungeon, ticks, boot, plays };
}

// ═══ the settings, the assets, the seams ══════════════════════════════════

// OWN-WORK4 (2026-10-31): vendor/immersive-footsteps is retired. Its manifest and modsettings.json, as they read at
// cc44705af, are written here so a changed default, range or option still fails the pins below.
const SHIPPED_MANIFEST = Object.freeze({
  ModTitle: 'ImmersiveFootsteps', ModVersion: '1.01', ModAuthor: 'Kirk.O', DFUnity_Version: '1.0.0', GUID: '8c75cd21-ca71-4841-b637-7728433c99f1',
  clips: 210, scripts: Object.freeze(['ImmersiveFootstepsMain.cs', 'ImmersiveFootstepsObject.cs']),
});
/** modsettings.json, key by key: [section.name, $type, Value, [Min, Max] or Options]. */
const SHIPPED_SETTINGS = Object.freeze([
  ['AudioQualitySettings.SoundClipQuality', 'MultipleChoiceKey', 0, ['Low-Quality (Retro)', 'High-Quality']],
  ['FootstepSettings.AllowFootstepSounds', 'ToggleKey', true],
  ['FootstepSettings.FootstepVolumeMulti', 'SliderFloatKey', 1.0, [0, 10]],
  ['FootstepSettings.FootstepFrequency', 'SliderFloatKey', 0.6, [0.3, 3.0]],
  ['ArmorSwaySettings.AllowArmorSwaySounds', 'ToggleKey', true],
  ['ArmorSwaySettings.ArmorSwayVolumeMulti', 'SliderFloatKey', 1.0, [0, 10]],
  ['ArmorSwaySettings.ArmorSwayFrequency', 'SliderFloatKey', 0.6, [0.3, 3.0]],
  ['ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings', 'ToggleKey', true],
  ['ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging', 'ToggleKey', false],
  ['ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs', 'ToggleKey', true],
]);

test('IF1: the Mods pane entry is the shipped modsettings.json - every key, its kind, its range or options, its default, our own words; the manifest; the row; the curated keys; the licence notice', () => {
  const m = MOD_SETTINGS[V];
  assert.ok(m, 'the vendor entry');
  const manifest = SHIPPED_MANIFEST;
  assert.equal(manifest.GUID, IMMERSIVE_FOOTSTEPS_MOD.guid);
  assert.equal(manifest.ModTitle, IMMERSIVE_FOOTSTEPS_MOD.title); assert.equal(manifest.ModVersion, IMMERSIVE_FOOTSTEPS_MOD.version); assert.equal(manifest.ModAuthor, IMMERSIVE_FOOTSTEPS_MOD.author);
  assert.equal(manifest.DFUnity_Version, IMMERSIVE_FOOTSTEPS_MOD.dfunity);
  assert.equal(m.title, 'Immersive Footsteps'); assert.equal(m.author, manifest.ModAuthor);
  assert.equal(manifest.clips, 210, 'the 210 clips the manifest names - each name now a clip of ours');
  assert.equal(Object.values(IF_CLIP_MS).flat().length * 2, manifest.clips, 'OWN-WORK4: our synth answers every one, in both qualities');
  assert.equal(manifest.scripts.length, 2, 'the two scripts the manifest names, from the author\'s MIT repository');
  // PLAIN-TEXT (2026-10-19): every line the mod wrote in Title Case with "|| Default = True", said plainly for a player (the two logging keys say they do nothing here) - their words, exactly
  const PLAIN = {
    'AudioQualitySettings.SoundClipQuality': 'Quality of the footstep sounds',
    'FootstepSettings.AllowFootstepSounds': 'Your footsteps make a sound',
    'FootstepSettings.FootstepVolumeMulti': 'Volume of footstep sounds',
    'FootstepSettings.FootstepFrequency': 'How often footsteps sound. Lower is more often',
    'ArmorSwaySettings.AllowArmorSwaySounds': 'Your armor makes a sound as you move',
    'ArmorSwaySettings.ArmorSwayVolumeMulti': 'Volume of armor sounds',
    'ArmorSwaySettings.ArmorSwayFrequency': 'How often armor sounds play. Lower is more often',
    'ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings': 'Warns you when another mod clashes with this one',
    'ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging': 'Logs a caught error in full, not in one line.',
    'ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs': 'Logs only the first caught error, not every one.',
  };
  let n = 0;
  const kinds = new Set();
  for (const [name, kind, Value, range] of SHIPPED_SETTINGS) {
    {
      const k = { Value, Min: range?.[0], Max: range?.[1], Options: range };
      n += 1;
      const def = m.keys[name];
      assert.ok(def, `${name} is on the pane`);
      assert.ok(SETTING_KEYS.includes(name), `${name} is one the component reads`);
      kinds.add(kind);
      if (kind === 'ToggleKey') { assert.equal(typeof def.default, 'boolean', name); assert.equal(def.default, k.Value, `${name} defaults as shipped`); assert.ok(!isIntKey(def) && !isFloatKey(def) && !isChoiceKey(def) && !isTextKey(def) && !isTupleKey(def), name); }
      else if (kind === 'SliderFloatKey') { assert.ok(isFloatKey(def), `${name} is a float slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); assert.ok(def.step > 0 && def.step <= (k.Max - k.Min), `${name} has a stepper`); }
      else if (kind === 'MultipleChoiceKey') { assert.ok(isChoiceKey(def), `${name} is a choice`); assert.deepEqual([...def.options], k.Options, name); assert.equal(def.default, k.Value, name); }
      else assert.fail(`${name}: a key kind the mod does not ship (${kind})`);
      assert.equal(def.description, PLAIN[name], `${name}'s description is our own plain words`);
    }
  }
  assert.equal(n, 10, 'the four sections carry ten keys');
  assert.equal(Object.keys(m.keys).length, 11, 'plus the port\'s Enabled, and nothing else');
  assert.deepEqual(SETTING_KEYS.length, 11);
  assert.deepEqual([...kinds].sort(), ['MultipleChoiceKey', 'SliderFloatKey', 'ToggleKey']);
  assert.equal(m.keys.Enabled.default, true, 'MO1: every mod is on by default');
  assert.deepEqual(m.keys['AudioQualitySettings.SoundClipQuality'].options, ['Low-Quality (Retro)', 'High-Quality']);
  assert.equal(m.keys['AudioQualitySettings.SoundClipQuality'].default, SOUND_CLIP_QUALITY.Low, 'the mod ships the retro clips');
  // the home row, the curated keys, the credit, the vendor note
  const row = FEATURES.find((f) => f.id === 'mod-immersive-footsteps');
  assert.ok(row, 'FT9: a Mod Authored row over the switch');
  assert.equal(row.control.store, 'mods'); assert.equal(row.control.key, 'Enabled'); assert.match(JSON.stringify(row.control), /immersive-footsteps/);
  assert.equal(row.effect, 'Takes effect at once.'); assert.equal(row.group, 'sound');   // FT18: under Sound
  for (const k of MOD_CURATED[V]) assert.ok(m.keys[k], `curated ${k} is a real key`);
  // CREDITS-OUT (2026-11-01): no credit on a screen; the MIT notice our code owes travels in LICENSE
  assert.match(rd('LICENSE'), /Immersive Footsteps 1\.01's scripts by\nKirk\.O[\s\S]*MIT License\n\nCopyright \(C\) 2024 Kirk\.O\n/);
  // OWN-WORK4: the vendor README's four text pins left with it.
});

test('IF1: LoadAudio\'s 105 names per quality - Main is clips 1-3, Alt 4-6, four sways, two landings, one splash - and every one is a clip our synth makes (OWN-WORK4), at the mod\'s length and the quality\'s rate', () => {
  for (const q of [SOUND_CLIP_QUALITY.Low, SOUND_CLIP_QUALITY.High]) {
    const t = clipTable(q);
    const P = q === SOUND_CLIP_QUALITY.High ? 'HQ' : 'LQ';
    assert.equal(Object.keys(t).length, 14 * 2 + 3 + 4 + 1, 'the 36 arrays of Main.cs:62-117');
    assert.deepEqual(t.ChainmailFootstepsMain, [1, 2, 3].map((n) => `${P}_Chainmail_Footstep_${n}`));
    assert.deepEqual(t.ChainmailFootstepsAlt, [4, 5, 6].map((n) => `${P}_Chainmail_Footstep_${n}`));
    assert.deepEqual(t.DeepWaterFootstepsMain, [1, 2, 3].map((n) => `${P}_Deep_Water_Footstep_${n}`), 'DeepWater is Deep_Water on disk');
    assert.deepEqual(t.ShallowWaterFootstepsAlt, [4, 5, 6].map((n) => `${P}_Shallow_Water_Footstep_${n}`));
    assert.deepEqual(t.PlateSwaying, [1, 2, 3, 4].map((n) => `${P}_Plate_Swaying_${n}`));
    assert.deepEqual(t.UnarmoredHardLanding, [1, 2].map((n) => `${P}_Unarmored_Hard_Landing_${n}`));
    assert.deepEqual(t.WaterLandingSound, [`${P}_Water_Landing_1`]);
    const names = clipNames(q);
    assert.equal(names.length, 105);
    assert.equal(new Set(names).size, 105, 'no name twice');
    for (const name of names) {
      const r = immersiveFootstepsRecipe(name);
      assert.ok(r, `${name} is a clip our synth makes`);
      assert.equal(r.rate, q === SOUND_CLIP_QUALITY.High ? 44100 : 22050, `${name}: the quality's rate`);
      assert.equal(r.retro, q === SOUND_CLIP_QUALITY.Low, `${name}: Low is the retro quality`);
      assert.ok(r.seconds > 0.15 && r.seconds < 1, `${name}: the mod's own length`);
    }
  }
  assert.deepEqual(IF_RATE, { HQ: 44100, LQ: 22050 });
  assert.equal(immersiveFootstepsRecipe('HQ_Grass_Footstep_7'), null, 'a name LoadAudio never asks for is no clip');
  assert.equal(immersiveFootstepsRecipe('HQ_Unarmored_Hard_Landing_2').heavy, true, '[1] is the fall that hurt (CheckToUseHardFallSounds)');
  assert.equal(immersiveFootstepsRecipe('LQ_Unarmored_Hard_Landing_1').heavy, false);
  assert.equal(immersiveFootstepsRecipe('HQ_Wood_Footstep_2').seed, immersiveFootstepsRecipe('LQ_Wood_Footstep_2').seed, 'one sound in two qualities');
  assert.equal(makeFootstepClip('HQ_Grass_Footstep_1'), null, 'node holds no AudioContext: the default maker makes nothing');
  assert.equal(soundKey('HQ_Grass_Footstep_1'), 'if:HQ_Grass_Footstep_1', 'the engine\'s registered-buffer key');
});

// ═══ the tables, as the source wrote them ══════════════════════════════════

/** OWN-WORK4: Object.cs's tables as the author wrote them (ImmersiveFootstepsObject.cs at ac03581, read at cc44705af), by key. */
const SOURCE_TABLES = Object.freeze({
  Shallow_Water: [5, 6, 8, 20, 21, 23, 30, 31, 33, 34, 35, 36, 49],
  Path: [46, 47, 55],
  Temperate_Dirt: [1, 4, 7, 10, 13, 25, 26, 28, 37, 38, 39, 51, 52, 54],
  Temperate_Stone: [3, 14, 16, 17, 24, 27, 29, 32, 43, 44, 45, 50],
  Mountain_Dirt: [1, 4, 7, 10, 13, 25, 26, 28, 37, 38, 39, 51, 52, 54],
  Mountain_Stone: [3, 14, 16, 17, 24, 27, 29, 32, 43, 44, 45, 50],
  Desert_Gravel: [2, 9, 11, 12, 15, 18, 19, 22, 39, 40, 41, 42, 45, 53],
  Desert_Stone: [3, 14, 16, 17, 24, 26, 27, 29, 32, 38, 43, 44],
  Swamp_Bog: [1, 4, 7, 10, 13, 25, 26, 28, 37, 38, 39, 50, 51, 52, 54],
  Swamp_Grass: [3, 14, 16, 17, 24, 27, 29, 32, 43, 44, 45],
  Swamp_Snow_Alt: [1, 7, 10, 11, 13, 25, 26, 28, 37, 38, 39, 43, 48, 50, 52],
  Tile_Floor: ['111_2', '111_3', '137_3', '141_0', '141_1', '141_2', '141_3', '144_3', '16_3', '311_3', '337_3', '341_0', '341_1', '341_2', '341_3', '363_3', '37_3', '40_3', '411_3', '41_0', '41_1', '41_2', '41_3', '437_3', '440_3', '444_3', '44_3', '463_3', '63_3'],
  Stone_Floor: ['140_3', '160_3', '163_3', '340_3', '360_3', '366_3', '416_3', '460_3', '466_3', '60_3'],
  Wood_Floor: ['116_3', '128_3', '166_3', '171_3', '28_3', '316_3', '328_3', '344_3', '428_3', '66_3'],
});
const sourceTables = () => Object.fromEntries(Object.entries(SOURCE_TABLES).map(([k, v]) => [k, new Set(v)]));

test('IF1: the eleven climate tile tables and the three building floor tables are the source\'s, entry for entry', () => {
  const src = sourceTables();
  for (const key of Object.keys(CLIMATE_TILE_TABLES)) {
    assert.ok(src[key], `${key} is a table in Object.cs`);
    assert.deepEqual([...CLIMATE_TILE_TABLES[key]].sort((a, b) => a - b), [...src[key]].sort((a, b) => a - b), key);
  }
  for (const key of Object.keys(BUILDING_FLOOR_TABLES)) {
    assert.ok(src[key], `${key} is a table in Object.cs`);
    assert.deepEqual([...BUILDING_FLOOR_TABLES[key]].sort(), [...src[key]].sort(), key);
  }
  assert.equal(Object.keys(src).length, 14, 'eleven climate keys and three floor keys, nothing the port missed');
  assert.equal(checkClimateTileTables('Path', 46), true); assert.equal(checkClimateTileTables('Path', 45), false); assert.equal(checkClimateTileTables('Nope', 46), false);
  assert.equal(checkBuildingClimateFloorTypeTables('Wood_Floor', '28_3'), true); assert.equal(checkBuildingClimateFloorTypeTables('Wood_Floor', '28_2'), false);
  // the five climate classes (Object.cs:302-362): Ocean is in none of the four ladders and IS snowy
  for (const c of Object.values(CLIMATES)) {
    assert.equal(isSnowyClimate(c), ![CLIMATES.Desert, CLIMATES.Desert2, CLIMATES.Rainforest, CLIMATES.Subtropical].includes(c), `snowy ${c}`);
    assert.equal([isGrassyClimate(c), isRockyClimate(c), isSandyClimate(c), isSwampyClimate(c)].filter(Boolean).length, c === CLIMATES.Ocean ? 0 : 1, `one ladder for ${c}`);
  }
  assert.ok(isGrassyClimate(CLIMATES.HauntedWoodlands) && isRockyClimate(CLIMATES.MountainWoods) && isSandyClimate(CLIMATES.Subtropical) && isSwampyClimate(CLIMATES.Rainforest));
});

test('IF1: GetFormattedTextureArchiveFromMaterialName reads MaterialReader\'s name - leading zeros trimmed, the index kept - and the floor walk takes the FIRST material in any table, Wood before Stone before Tile at that material, Tile when none', () => {
  assert.equal(unityMaterialName(67, 14), 'TEXTURE.067 [Index=14] (Instance)');
  assert.equal(unityMaterialName(341, 3), 'TEXTURE.341 [Index=3] (Instance)');
  assert.equal(getFormattedTextureArchiveFromMaterialName('TEXTURE.067 [Index=14] (Instance)'), '67_14');
  assert.equal(getFormattedTextureArchiveFromMaterialName(unityMaterialName(28, 3)), '28_3');
  assert.equal(getFormattedTextureArchiveFromMaterialName(unityMaterialName(0, 0)), '_0', 'TrimStart(\'0\') on "000" is the empty string - verbatim');
  assert.equal(getFormattedTextureArchiveFromMaterialName('TEXTURE.067 [Index=14]'), '', 'no " (Instance)" is no match');
  assert.equal(getFormattedTextureArchiveFromMaterialName(null), '');
  assert.equal(interiorFloorType([unityMaterialName(41, 2), unityMaterialName(28, 3)]), FLOOR_TYPE.Tile, 'the first material decides');
  assert.equal(interiorFloorType([unityMaterialName(50, 0), unityMaterialName(28, 3), unityMaterialName(41, 2)]), FLOOR_TYPE.Wood, 'a material in no table is skipped');
  assert.equal(interiorFloorType([unityMaterialName(60, 3)]), FLOOR_TYPE.Stone);
  assert.equal(interiorFloorType(['junk', unityMaterialName(1, 1)]), FLOOR_TYPE.Tile, 'none -> Tile');
  assert.equal(interiorFloorType([]), FLOOR_TYPE.Tile);
});

test('IF1: the no-repeat roll - a repeat of the last clip steps up from the first, down from the last, a coin flip between (Range(0,2) == 0 is false)', () => {
  const clips = ['a', 'b', 'c', 'd'];
  const seq = (rolls) => { let i = 0; return () => rolls[i++]; };
  assert.equal(rollRandomAudioClip(clips, null, seq([0.1])), 'a');
  assert.equal(rollRandomAudioClip(clips, 'a', seq([0.1])), 'b', 'index 0 repeated steps up');
  assert.equal(rollRandomAudioClip(clips, 'd', seq([0.99])), 'c', 'the last repeated steps down');
  assert.equal(rollRandomAudioClip(clips, 'b', seq([0.3, 0.7])), 'c', 'a middle repeat: the flip lands 1 -> true -> up');
  assert.equal(rollRandomAudioClip(clips, 'b', seq([0.3, 0.2])), 'a', 'the flip lands 0 -> false -> down');
  assert.equal(coinFlip(() => 0.0), false); assert.equal(coinFlip(() => 0.6), true);
});

// ═══ the component ═════════════════════════════════════════════════════════

test('IF1: the stride owns nothing until the clips are in, then DisableVanillaFootsteps - a walk on Woodlands grass plays a Grass clip every 0.6 s at 1 x FootstepVolumeMulti; run is 1.5 x the clock at 1.25; half speed 0.7 x at 0.6; standing still, airborne and a mount play nothing; the switch off zeroes the clock', async () => {
  const r = rig();
  assert.equal(r.c.ownsStride(), false, 'before the load');
  r.c.update(FIXED_DELTA_TIME, r.outdoors());
  assert.equal(r.c.ownsStride(), false, 'the clips are still being made');
  await r.c.settle();
  assert.equal(r.c.ownsStride(), true, 'LoadAudio done, DisableVanillaFootsteps');
  assert.equal(r.registered.length, 105, 'the low-quality set registered, by name');
  assert.ok(r.registered.every((k) => k.startsWith('if:LQ_')));
  assert.equal(r.c.status().currentSet, 'PathFootstepsMain', 'Object.cs:35 - the field\'s initialiser');
  r.ticks(29, r.outdoors());
  assert.equal(r.shots.length, 0, '29 ticks = 0.58 s < 0.6');
  r.ticks(1, r.outdoors());
  assert.equal(r.shots.length, 1, 'the 30th tick crosses stepInterval');
  assert.match(r.shots[0][0], /^if:LQ_Grass_Footstep_[123]$/, 'Woodlands, tile 2: not dirt, not stone - Grass, from the Main table');
  near(r.shots[0][1], 1.0 * 1.0, 1e-9, 'volumeScale 1 x FootstepVolumeMulti 1 - SoundVolume is the master bus\'s');
  r.shots.length = 0;
  r.ticks(20, r.outdoors({ isRunning: true }));
  assert.equal(r.shots.length, 1, 'running: 1.5 x 0.02 x 20 = 0.6');
  near(r.shots[0][1], 1.25);
  r.shots.length = 0;
  r.ticks(42, r.outdoors({ movingLessThanHalfSpeed: true }));
  assert.equal(r.shots.length, 0, '0.7 x 0.02 x 42 = 0.588');
  r.ticks(1, r.outdoors({ movingLessThanHalfSpeed: true }));
  assert.equal(r.shots.length, 1); near(r.shots[0][1], 0.6);
  r.shots.length = 0;
  r.ticks(200, r.outdoors({ standingStill: true }));
  r.ticks(200, r.outdoors({ grounded: false }));
  assert.equal(r.shots.length, 0, 'still or airborne: a bare return');
  r.ticks(200, r.outdoors({ transportMode: TRANSPORT_MODES.Horse }));
  r.ticks(200, r.outdoors({ transportMode: TRANSPORT_MODES.Cart }));
  assert.equal(r.shots.length, 0, 'Horse and Cart zero the footstep clock');
  r.store['FootstepSettings.AllowFootstepSounds'] = false;
  r.ticks(200, r.outdoors());
  assert.equal(r.shots.length, 0, 'the switch off zeroes the clock every tick');
  r.store['FootstepSettings.AllowFootstepSounds'] = true;
  r.store['FootstepSettings.FootstepVolumeMulti'] = 2.5;
  r.store['FootstepSettings.FootstepFrequency'] = 1.0;
  r.ticks(49, r.outdoors());
  assert.equal(r.shots.length, 0, 'stepInterval follows FootstepFrequency');
  r.ticks(1, r.outdoors());
  assert.equal(r.shots.length, 1); near(r.shots[0][1], 2.5);
  // paused: nothing moves
  r.shots.length = 0;
  r.ticks(200, r.outdoors({ paused: true }));
  assert.equal(r.shots.length, 0, 'IsGamePaused / LoadInProgress');
  // a frame dt runs the fixed step under an accumulator: 0.1 s is five ticks, and the hosts never hand more
  r.c.update(0.1, r.outdoors());
  near(r.c.status().timers.footstep, 0.1);
  r.c.update(0.5, r.outdoors());
  near(r.c.status().timers.footstep, 0.2, 1e-9, 'a longer dt is clamped to five ticks (the residue dropped), as Unity\'s maximumDeltaTime bounds a catch-up');
});

test('IF1: the switch off hands the stride back and a quality change reloads the other set, the current table carrying over by name', async () => {
  const r = rig({ Enabled: false });
  await r.boot();
  assert.equal(r.c.ownsStride(), false); assert.equal(r.registered.length, 0, 'Enabled off: no LoadAudio');
  r.store.Enabled = true;
  await r.boot();
  assert.equal(r.c.ownsStride(), true); assert.equal(r.registered.length, 105);
  r.ticks(30, r.outdoors());
  assert.equal(r.c.status().currentSet, 'GrassFootstepsMain');
  r.store['AudioQualitySettings.SoundClipQuality'] = SOUND_CLIP_QUALITY.High;
  await r.boot();
  assert.equal(r.registered.length, 210, 'HasChanged(SoundClipQuality) -> LoadAudio again');
  assert.equal(r.c.status().quality, SOUND_CLIP_QUALITY.High);
  assert.equal(r.c.status().currentSet, 'GrassFootstepsMain', 'the set survives the reload');
  r.shots.length = 0;
  r.ticks(30, r.outdoors());
  assert.match(r.shots[0][0], /^if:HQ_Grass_Footstep_/);
  r.store.Enabled = false;
  r.c.update(FIXED_DELTA_TIME, r.outdoors());
  assert.equal(r.c.ownsStride(), false, 'off again: the classic stride plays');
  assert.equal(r.c.applyPlayerFallDamage(), false, 'and the landings are the host\'s');
  // a missing clip: LoadAudio fails, the mod stays inert (Start aborts before DisableVanillaFootsteps)
  const bad = rig({}, { fetchOk: (name) => name !== 'LQ_Mud_Footstep_2' });
  await bad.boot();
  assert.equal(bad.c.ownsStride(), false, 'Missing sound asset');
});

test('IF1: DetermineExteriorClimateFootstep, tile by tile - water, shallow water, the path, winter snow and the swamp\'s mud, the four climate ladders, the Ocean fallback - and the change gate that holds the set until the tile, the climate or the season moves', async () => {
  const r = rig();
  await r.boot();
  const setAt = (o) => { r.ticks(30, r.outdoors(o)); return r.c.status().currentSet; };
  assert.equal(setAt({ tileMapIndex: 0 }), 'DeepWaterFootstepsMain', 'tile 0 is water');
  assert.equal(setAt({ tileMapIndex: 0, waterWalking: true }), 'DeepWaterFootstepsMain', 'THE CHANGE GATE: nothing moved, so the water-walking read never happens (the mod\'s own "minor bug" note)');
  assert.equal(setAt({ tileMapIndex: 5, waterWalking: true }), 'ShallowWaterFootstepsMain');
  assert.equal(setAt({ tileMapIndex: 0, waterWalking: true }), 'ShallowWaterFootstepsMain', 'back onto tile 0 while water walking: shallow');
  assert.equal(setAt({ tileMapIndex: 46 }), 'UnarmoredFootstepsMain', 'a path tile with no boots');
  assert.equal(setAt({ tileMapIndex: 47, climateIndex: CLIMATES.Desert }), 'UnarmoredFootstepsMain', 'the path before every climate ladder');
  assert.equal(setAt({ tileMapIndex: 2, season: SEASON.Winter }), 'SnowFootstepsMain', 'winter on Woodlands');
  assert.equal(setAt({ tileMapIndex: 46, season: SEASON.Winter }), 'UnarmoredFootstepsMain', 'AUDIT-IF: the path is read BEFORE the winter arm - a snowed road is still stone');
  assert.equal(setAt({ tileMapIndex: 4, season: SEASON.Winter, climateIndex: CLIMATES.Subtropical }), 'SandFootstepsMain', 'AUDIT-IF: Subtropical is the fourth snow-free climate');
  assert.equal(setAt({ tileMapIndex: 1, season: SEASON.Winter, climateIndex: CLIMATES.Swamp }), 'MudFootstepsMain', 'winter Swamp, a Swamp_Snow_Alt tile');
  assert.equal(setAt({ tileMapIndex: 2, season: SEASON.Winter, climateIndex: CLIMATES.Swamp }), 'SnowFootstepsMain', 'winter Swamp, any other tile');
  assert.equal(setAt({ tileMapIndex: 2, season: SEASON.Winter, climateIndex: CLIMATES.Desert }), 'GravelFootstepsMain', 'no snow in the desert: the sandy ladder, and 2 is desert gravel');
  assert.equal(setAt({ tileMapIndex: 4, season: SEASON.Winter, climateIndex: CLIMATES.Desert }), 'SandFootstepsMain', 'no snow in the desert');
  assert.equal(setAt({ tileMapIndex: 2, season: SEASON.Winter, climateIndex: CLIMATES.Rainforest }), 'MudFootstepsMain', 'nor the rainforest');
  assert.equal(setAt({ tileMapIndex: 1 }), 'GravelFootstepsMain', 'Woodlands dirt');
  assert.equal(setAt({ tileMapIndex: 3 }), 'UnarmoredFootstepsMain', 'Woodlands stone -> the armour ladder');
  assert.equal(setAt({ tileMapIndex: 2, climateIndex: CLIMATES.HauntedWoodlands }), 'GrassFootstepsMain');
  assert.equal(setAt({ tileMapIndex: 4, climateIndex: CLIMATES.Mountain }), 'GravelFootstepsMain', 'Mountain dirt');
  assert.equal(setAt({ tileMapIndex: 14, climateIndex: CLIMATES.MountainWoods }), 'UnarmoredFootstepsMain', 'Mountain stone');
  assert.equal(setAt({ tileMapIndex: 2, climateIndex: CLIMATES.Mountain }), 'GrassFootstepsMain');
  assert.equal(setAt({ tileMapIndex: 2, climateIndex: CLIMATES.Desert }), 'GravelFootstepsMain', 'Desert gravel');
  assert.equal(setAt({ tileMapIndex: 26, climateIndex: CLIMATES.Desert2 }), 'UnarmoredFootstepsMain', 'Desert stone (26 is stone in the desert and dirt in the woods)');
  assert.equal(setAt({ tileMapIndex: 4, climateIndex: CLIMATES.Subtropical }), 'SandFootstepsMain');
  assert.equal(setAt({ tileMapIndex: 50, climateIndex: CLIMATES.Swamp }), 'MudFootstepsMain', 'Swamp bog');
  assert.equal(setAt({ tileMapIndex: 45, climateIndex: CLIMATES.Swamp }), 'GrassFootstepsMain', 'Swamp grass');
  assert.equal(setAt({ tileMapIndex: 2, climateIndex: CLIMATES.Rainforest }), 'MudFootstepsMain', 'else mud');
  assert.equal(setAt({ tileMapIndex: 8, climateIndex: CLIMATES.Rainforest }), 'ShallowWaterFootstepsMain', 'shallow water before the ladders');
  assert.equal(setAt({ tileMapIndex: 2, climateIndex: CLIMATES.Ocean }), 'ShallowWaterFootstepsMain', 'Ocean sits in no ladder: the gate fires and no arm writes, so the set is left as it was');
  // boots on the path: the armour ladder, through the equipment refresh
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Leather);
  r.c.onInventoryClose(r.entity);
  assert.equal(setAt({ tileMapIndex: 46 }), 'LeatherFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Chain);
  r.c.onInventoryClose(r.entity);
  assert.equal(r.c.status().currentSet, 'ChainmailFootstepsMain', 'the refresh outdoors zeroes lastTileMapIndex and re-determines off the LIVE place (the last frame\'s), so the gate fires against 0 and the new boots are heard at once');
  assert.equal(setAt({ tileMapIndex: 46 }), 'ChainmailFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Dwarven);
  r.c.onInventoryClose(r.entity);
  assert.equal(setAt({ tileMapIndex: 55 }), 'PlateFootstepsMain', '>= Iron is plate, whatever the plate');
  r.slots[EQUIP_SLOTS.Feet] = null;
  r.c.onInventoryClose(r.entity);
  assert.equal(setAt({ tileMapIndex: 55 }), 'UnarmoredFootstepsMain');
});

test('DISC29-B: the boots\' material is the class\'s NativeMaterialValue (ImmersiveFootstepsMain.cs:502-532) - Roleplay & Realism: Items\' brigandine boots walk in leather, its mail sollerets in chain', async () => {
  const r = rig();
  await r.boot();
  const setAt = (o) => { r.ticks(30, r.outdoors(o)); return r.c.status().currentSet; };
  r.slots[EQUIP_SLOTS.Feet] = { group: 'Armor', templateIndex: 523, material: ARMOR_MATERIAL.Iron };   // ItemBoots: 0x0200 - 0x0200
  r.c.onInventoryClose(r.entity);
  assert.equal(setAt({ tileMapIndex: 46 }), 'LeatherFootstepsMain', 'the raw material walked them in plate');
  r.slots[EQUIP_SLOTS.Feet] = { group: 'Armor', templateIndex: 519, material: ARMOR_MATERIAL.Daedric };   // ItemSollerets: less 0x0100
  r.c.onInventoryClose(r.entity);
  assert.equal(setAt({ tileMapIndex: 46 }), 'ChainmailFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Iron);   // a classic boot is its own material
  r.c.onInventoryClose(r.entity);
  assert.equal(setAt({ tileMapIndex: 46 }), 'PlateFootstepsMain');
});

test('IF1: the equipment refresh is the 250th tick (5 s) when either sound switch is on, and the inventory close - a change of boots is not heard until then', async () => {
  const r = rig();
  await r.boot();
  r.ticks(30, r.outdoors({ tileMapIndex: 46 }));
  assert.equal(r.c.status().currentSet, 'UnarmoredFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Iron);
  // AUDIT-IF (campaign survivor `refresh-at-249`): the count was measured against the constant it pins - a literal now
  assert.equal(REFRESH_SLOTS_TICKS, 250, 'Object.cs:71');
  r.ticks(250 - 31, r.outdoors({ tileMapIndex: 46 }));
  assert.equal(r.c.status().currentSet, 'UnarmoredFootstepsMain', 'tick 249: not yet');
  assert.equal(r.c.status().worn.boots, null);
  r.ticks(1, r.outdoors({ tileMapIndex: 46 }));
  assert.equal(r.c.status().worn.boots, r.slots[EQUIP_SLOTS.Feet], 'tick 250: RefreshEquipmentSlotReferences');
  assert.equal(r.c.status().currentSet, 'PlateFootstepsMain');
  assert.equal(r.c.status().timers.refresh, 0);
  // both switches off: the refresh is skipped (there is no point)
  r.store['FootstepSettings.AllowFootstepSounds'] = false; r.store['ArmorSwaySettings.AllowArmorSwaySounds'] = false;
  r.slots[EQUIP_SLOTS.Feet] = null;
  r.ticks(250, r.outdoors({ tileMapIndex: 46 }));
  assert.equal(r.c.status().worn.boots !== null, true, 'no refresh with both off');
  r.c.onInventoryClose(r.entity);
  assert.equal(r.c.status().worn.boots !== null, true, 'nor on the inventory close');
  r.store['ArmorSwaySettings.AllowArmorSwaySounds'] = true;
  r.c.onInventoryClose(r.entity);
  assert.equal(r.c.status().worn.boots, null, 'one switch on: the close refreshes');
  r.c.onInventoryClose(null);   // no entity: nothing to read
});

test('IF1: the building floor walk and UpdateInteriorArmorFootstepSounds - wood, stone and tile, with and without boots, by the boots\' material; a buildingType of None skips the walk; the dungeon transition is the tile floor; a building keeps its set while the stride runs', async () => {
  const r = rig();
  await r.boot();
  const walkIn = (o) => { r.ticks(30, r.indoors(o)); return r.c.status().currentSet; };
  r.c.onTransitionInterior({ buildingType: 5, materials: [unityMaterialName(41, 0), unityMaterialName(28, 3)] });
  assert.equal(r.c.status().floorType, FLOOR_TYPE.Tile, 'the first material is a tile floor');
  assert.equal(walkIn(), 'UnarmoredFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Leather);
  r.c.onInventoryClose(r.entity);
  assert.equal(walkIn(), 'TileFootstepsMain', 'leather boots on tile: the tile sound');
  r.c.onTransitionInterior({ buildingType: 5, materials: [unityMaterialName(3, 0), unityMaterialName(66, 3)] });
  assert.equal(r.c.status().floorType, FLOOR_TYPE.Wood);
  assert.equal(walkIn(), 'WoodFootstepsMain', 'leather on wood: wood');
  r.slots[EQUIP_SLOTS.Feet] = null; r.c.onInventoryClose(r.entity);
  assert.equal(walkIn(), 'WoodFootstepsMain', 'no boots on wood: wood too');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Chain); r.c.onInventoryClose(r.entity);
  assert.equal(walkIn(), 'ChainmailFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Steel); r.c.onInventoryClose(r.entity);
  assert.equal(walkIn(), 'PlateFootstepsMain');
  r.c.onTransitionInterior({ buildingType: 5, materials: [unityMaterialName(140, 3)] });
  assert.equal(r.c.status().floorType, FLOOR_TYPE.Stone);
  assert.equal(walkIn(), 'PlateFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Leather); r.c.onInventoryClose(r.entity);
  assert.equal(walkIn(), 'PathFootstepsMain', 'leather on stone: the path stone');
  r.slots[EQUIP_SLOTS.Feet] = null; r.c.onInventoryClose(r.entity);
  assert.equal(walkIn(), 'UnarmoredFootstepsMain', 'no boots on stone: unarmoured');
  r.c.onTransitionInterior({ buildingType: -1, materials: [unityMaterialName(66, 3)] });
  assert.equal(r.c.status().floorType, FLOOR_TYPE.Tile, 'BuildingTypes.None: the walk is skipped and the default lands');
  r.c.onTransitionInterior({ materials: [unityMaterialName(66, 3)] });
  assert.equal(r.c.status().floorType, FLOOR_TYPE.Wood, 'AUDIT-IF F4: no discovery record is DFU\'s default struct (buildingType 0), and the walk runs');
  r.c.onTransitionDungeonInterior();
  assert.equal(r.c.status().floorType, FLOOR_TYPE.Tile);
  assert.equal(r.c.status().currentSet, 'UnarmoredFootstepsMain');
  r.c.onTransitionExterior();
  assert.equal(r.c.status().lastTileMapIndex, 0);
  r.ticks(1, r.outdoors({ tileMapIndex: 2 }));
  assert.equal(r.c.status().currentSet, 'GrassFootstepsMain', 'OnTransitionExterior determines off the first outdoor frame');
});

test('IF1: the dungeon water arms off the LIVE capsule centre - swimming is deep water on the swim distance (1.75 units, three axes, timers zeroed, the switch NOT consulted), 0.57 under the line is shallow, above it the armour ladder, and no water level at all leaves the set', async () => {
  const r = rig();
  await r.boot();
  r.c.onTransitionDungeonInterior();
  r.ticks(30, r.dungeon({ waterSurfaceY: null }));
  assert.equal(r.c.status().currentSet, 'UnarmoredFootstepsMain', 'blockWaterLevel 10000: the interior determine says nothing');
  r.ticks(30, r.dungeon({ waterSurfaceY: 1.0, centreY: 1.6 }));
  assert.equal(r.c.status().currentSet, 'UnarmoredFootstepsMain', '1.6 - 0.57 = 1.03 < 1.0 is false: above the line');
  r.ticks(30, r.dungeon({ waterSurfaceY: 1.0, centreY: 1.5 }));
  assert.equal(r.c.status().currentSet, 'ShallowWaterFootstepsMain', '1.5 - 0.57 = 0.93 < 1.0: wading');
  r.shots.length = 0;
  // swimming: the footstep clock is zeroed every tick, and the splash rides distance
  r.ticks(100, r.dungeon({ waterSurfaceY: 1.0, centreY: 0.3, swimming: true, grounded: false, pos: [0, 0, 0] }));
  assert.equal(r.shots.length, 0, 'no distance, no splash - and no footstep clock');
  near(r.c.status().timers.footstep, 0);
  r.ticks(1, r.dungeon({ waterSurfaceY: 1.0, centreY: 0.3, swimming: true, grounded: false, pos: [1, 1, 1] }));
  near(r.c.status().distance, Math.sqrt(3), 1e-9, 'GetHorizontalPosition keeps y - all three axes');
  assert.equal(r.shots.length, 0, `${Math.sqrt(3)} < ${SWIM_INTERVAL}`);
  r.ticks(1, r.dungeon({ waterSurfaceY: 1.0, centreY: 0.3, swimming: true, grounded: false, pos: [1, 1, 2] }));
  assert.equal(r.shots.length, 1, 'past the interval: one splash');
  assert.match(r.shots[0][0], /^if:LQ_Deep_Water_Footstep_/);
  assert.equal(r.c.status().currentSet, 'DeepWaterFootstepsMain');
  near(r.c.status().distance, 0);
  r.store['FootstepSettings.AllowFootstepSounds'] = false;
  r.shots.length = 0;
  r.ticks(1, r.dungeon({ waterSurfaceY: 1.0, centreY: 0.3, swimming: true, grounded: false, pos: [1, 1, 5] }));
  assert.equal(r.shots.length, 1, '[verbatim] the swim splash is not behind AllowFootstepSounds');
  r.store['FootstepSettings.AllowFootstepSounds'] = true;
  // out of the water: the armour ladder by boots
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Chain); r.c.onInventoryClose(r.entity);
  r.ticks(30, r.dungeon({ waterSurfaceY: 1.0, centreY: 2.0 }));
  assert.equal(r.c.status().currentSet, 'ChainmailFootstepsMain', 'CheckToUseArmorFootsteps on the dry floor');
});

test('IF1: armour sway - the weights (head 2, arms and gloves 1, chest 3, legs 4; feet none) by each piece\'s material, a sway clip on its own clock at ArmorSwayVolumeMulti, a zero weight holding its clock at zero, and the mod\'s own slip kept: the chain and plate re-rolls write the LEATHER interval', async () => {
  const r = rig({ 'ArmorSwaySettings.ArmorSwayVolumeMulti': 0.5 }, { rolls: Array(400).fill(0.5) });
  await r.boot();
  r.slots[EQUIP_SLOTS.Head] = armor(ARMOR_MATERIAL.Iron);
  r.slots[EQUIP_SLOTS.ChestArmor] = armor(ARMOR_MATERIAL.Chain);
  r.slots[EQUIP_SLOTS.LegsArmor] = armor(ARMOR_MATERIAL.Leather);
  r.slots[EQUIP_SLOTS.Gloves] = armor(ARMOR_MATERIAL.Leather);
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Daedric);
  r.c.onInventoryClose(r.entity);
  assert.deepEqual(r.c.status().weights, { plate: 2, chain: 3, leather: 5 }, 'the boots carry no sway weight');
  assert.deepEqual(SWAY_WEIGHTS, [2, 1, 1, 3, 1, 4]);
  assert.deepEqual(SWAY_SLOTS, [EQUIP_SLOTS.Head, EQUIP_SLOTS.RightArm, EQUIP_SLOTS.LeftArm, EQUIP_SLOTS.ChestArmor, EQUIP_SLOTS.Gloves, EQUIP_SLOTS.LegsArmor]);
  r.shots.length = 0;
  r.ticks(30, r.outdoors({ tileMapIndex: 46 }));
  const sways = r.plays(/Swaying/);
  assert.equal(sways.length, 3, 'all three clocks reach 0.6 on the 30th tick');
  assert.deepEqual(sways.map(([k]) => k.replace(/_\d$/, '')).sort(), ['if:LQ_Chainmail_Swaying', 'if:LQ_Leather_Swaying', 'if:LQ_Plate_Swaying']);
  for (const [, v] of sways) near(v, 0.5, 1e-9, 'volumeScale 1 x ArmorSwayVolumeMulti');
  const iv = r.c.status().intervals;
  near(iv.plate, 0.6); near(iv.chain, 0.6, 1e-9, '[verbatim] the plate and chain intervals are never re-rolled');
  near(iv.leather, (0.6 + 0.1) + 0.5 * 0.3 - 5 * 0.02, 1e-9, 'Range(freq+0.1, freq+0.4) - leatherWeight x 0.02, written by the last of the three (plate)');
  // running: the sway clocks run at 1.8x
  r.shots.length = 0;
  r.ticks(17, r.outdoors({ tileMapIndex: 46, isRunning: true }));
  assert.equal(r.plays(/Plate_Swaying/).length, 1, '1.8 x 0.02 x 17 = 0.612 >= 0.6');
  // a zero weight holds its clock
  r.slots[EQUIP_SLOTS.Head] = null; r.c.onInventoryClose(r.entity);
  assert.deepEqual(r.c.status().weights, { plate: 0, chain: 3, leather: 5 });
  r.shots.length = 0;
  r.ticks(60, r.outdoors({ tileMapIndex: 46 }));
  assert.equal(r.plays(/Plate_Swaying/).length, 0, 'no plate worn: no plate sway');
  assert.ok(r.plays(/Chainmail_Swaying/).length >= 1);
  near(r.c.status().timers.plate, 0);
  // the switch off zeroes all three clocks
  r.store['ArmorSwaySettings.AllowArmorSwaySounds'] = false;
  r.shots.length = 0;
  r.ticks(200, r.outdoors({ tileMapIndex: 46 }));
  assert.equal(r.plays(/Swaying/).length, 0);
  assert.equal(r.plays(/Footstep/).length > 0, true, 'the stride goes on');
  // the -1 of an empty slot is skipped, and the seven slots read are the seven
  r.slots[EQUIP_SLOTS.RightArm] = armor(ARMOR_MATERIAL.Chain); r.slots[EQUIP_SLOTS.LeftArm] = armor(ARMOR_MATERIAL.Iron);
  r.store['ArmorSwaySettings.AllowArmorSwaySounds'] = true;
  r.c.onInventoryClose(r.entity);
  assert.deepEqual(r.c.status().weights, { plate: 1, chain: 4, leather: 5 });
});

test('IF1: the three landing sounds the mod takes over - fall damage is Hard_Landing_2 and the alert Hard_Landing_1 by the boots, the large splash Water_Landing_1, all at 4 x FootstepVolumeMulti; the sink routes applyFallLanding\'s ids and falls back when the mod owns nothing', async () => {
  const r = rig({ 'FootstepSettings.FootstepVolumeMulti': 0.5 });
  const fallback = [];
  const sink = r.c.fallSoundSink((id, vol) => fallback.push([id, vol]));
  sink(SOUND.FallDamage, 0.7);
  assert.deepEqual(fallback, [[SOUND.FallDamage, 0.7]], 'before the load: the classic sound');
  assert.equal(r.c.playLargeSplash(), false);
  await r.boot();
  fallback.length = 0;
  sink(SOUND.FallDamage, 0.7); sink(SOUND.FallHard, 0.7); sink(999, 0.3);
  assert.deepEqual(fallback, [[999, 0.3]], 'an id that is not a landing passes through');
  // AUDIT-IF (campaign survivor `landing-scale-1`): 4f x FootstepVolumeMulti (Object.cs:504), as a literal
  assert.equal(LANDING_VOLUME_SCALE, 4);
  assert.deepEqual(r.shots, [['if:LQ_Unarmored_Hard_Landing_2', 2], ['if:LQ_Unarmored_Hard_Landing_1', 2]]);
  r.shots.length = 0;
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Chain); r.c.onInventoryClose(r.entity);
  assert.equal(r.c.applyPlayerFallDamage(), true); assert.equal(r.c.hardFallAlert(), true); assert.equal(r.c.playLargeSplash(), true);
  assert.deepEqual(r.shots.map(([k]) => k), ['if:LQ_Chainmail_Hard_Landing_2', 'if:LQ_Chainmail_Hard_Landing_1', 'if:LQ_Water_Landing_1']);
  r.shots.length = 0;
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Mithril); r.c.onInventoryClose(r.entity);
  r.c.hardFallAlert();
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Leather); r.c.onInventoryClose(r.entity);
  r.c.hardFallAlert();
  assert.deepEqual(r.shots.map(([k]) => k), ['if:LQ_Plate_Hard_Landing_1', 'if:LQ_Leather_Hard_Landing_1']);
});

test('IF1: [verbatim] altStep is declared and never set - over a thousand steps across every set, no Alt clip (4-6) ever plays; and the roll never repeats the last clip', async () => {
  const rolls = []; for (let i = 0; i < 4000; i++) rolls.push(((i * 7919) % 1000) / 1000);
  const r = rig({}, { rolls });
  await r.boot();
  const places = [r.outdoors({ tileMapIndex: 2 }), r.outdoors({ tileMapIndex: 46 }), r.outdoors({ tileMapIndex: 1 }), r.outdoors({ tileMapIndex: 2, climateIndex: CLIMATES.Desert })];
  for (let i = 0; i < 40; i++) r.ticks(30, places[i % places.length]);
  const steps = r.plays(/Footstep/);
  assert.equal(steps.length, 40);
  assert.ok(steps.every(([k]) => /_Footstep_[123]$/.test(k)), 'Main tables only');
  for (let i = 1; i < steps.length; i++) assert.notEqual(steps[i][0], steps[i - 1][0], `step ${i} repeats`);
  assert.equal(FOOTSTEP_SETS.length, 14);
});

// ═══ AUDIT-IF (2026-09-16, Mac: "Lets now do a comprehensive audit on this before merging") ═══

test('AUDIT-IF F2: a tile of -1 (off terrain, StreamingWorld.PlayerTileMapIndex\'s answer) is no table\'s and lands the climate\'s own else arm - not tile 0\'s deep water', async () => {
  const r = rig();
  await r.boot();
  r.ticks(30, r.outdoors({ tileMapIndex: -1 }));
  assert.equal(r.c.status().currentSet, 'GrassFootstepsMain', 'Woodlands, no tile: grass');
  r.ticks(30, r.outdoors({ tileMapIndex: -1, climateIndex: CLIMATES.Desert }));
  assert.equal(r.c.status().currentSet, 'SandFootstepsMain');
  r.ticks(30, r.outdoors({ tileMapIndex: -1, climateIndex: CLIMATES.Swamp }));
  assert.equal(r.c.status().currentSet, 'MudFootstepsMain');
  r.ticks(30, r.outdoors({ tileMapIndex: -1, season: SEASON.Winter }));
  assert.equal(r.c.status().currentSet, 'SnowFootstepsMain');
  assert.equal(checkClimateTileTables('Shallow_Water', -1), false);
});

test('AUDIT-IF F1 (OWN-WORK4): no clip is a file any more, so none can be inlined - the module neither globs nor fetches; every clip is made', () => {
  const src = rd('src/systems/immersiveFootsteps.js');
  assert.doesNotMatch(src, /import\.meta\.glob|\bfetch\(|\.mp3/, 'no file is read for a clip');
  assert.match(src, /makeClip = makeFootstepClip/, 'the default maker is our synth\'s');
  assert.match(src, /audio\.registerSamples\(soundKey\(name\), clip\.samples, clip\.rate\)/, 'and the engine takes its PCM');
});

test('AUDIT-IF F3: LoadAudio puts every clip in flight at once, and one missing clip still fails the whole load', async () => {
  let inFlight = 0, peak = 0;
  const release = [];
  const r = rig({}, { fetchOk: () => true });
  // a maker that holds every clip until all 105 have been asked for
  const c = createImmersiveFootsteps({
    audio: { registerSamples: (k, x) => x.length > 0, playOneShot() {} }, settings: () => readFootstepSettings(() => r.store), random: () => 0,
    makeClip: (name) => new Promise((res) => { inFlight++; peak = Math.max(peak, inFlight); release.push(() => { inFlight--; res({ samples: new Float32Array(name === 'LQ_Snow_Footstep_3' ? 0 : 1), rate: 22050 }); }); }),
  });
  c.update(0, r.outdoors());
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(peak, 105, 'all 105 asked for before any answered');
  for (const f of release) f();
  await c.settle();
  assert.equal(c.ownsStride(), false, 'one empty clip: Missing sound asset, the mod stays inert');
  assert.equal(c.status().loaded, false);
});

// ═══ the hosts ═══════════════════════════════════════════════════════════════

test('IF1: the four stride hosts ask ownsStride before the classic play and drive the component each frame; the modal host raises the three transitions and the standalone dungeon its own; the three landing sinks and the dungeon context\'s three gates; the interior context lists the combined mesh\'s materials; the inventory close refreshes; the records', () => {
  const world = hostText('src/scenes/world.js'), ext = rd('src/scenes/exterior.js'), wm = rd('src/scenes/worldModes.js'), dj = rd('src/scenes/dungeon.js'), dc = rd('src/scenes/dungeonContext.js');
  for (const [name, src] of [['world', world], ['exterior', ext], ['worldModes', wm], ['dungeon', dj]]) {
    assert.match(src, /if \(_step && classicFootstepAllowed\(_step\.clip\)\) audio\.playOneShot\(_step\.clip, _step\.volume\);/, `${name}: DisableVanillaFootsteps (BA1: through the one gate both mods' DisableBuiltInFootsteps answer)`);
    assert.ok(!/if \(_step\) audio\.playOneShot\(_step\.clip, _step\.volume\);/.test(src), `${name}: no ungated classic play`);
    assert.equal((src.match(/immersiveFootsteps\.update\(dt, \{/g) ?? []).length, 1, `${name}: one FixedUpdate feed`);
    assert.match(src, /import \{ immersiveFootsteps(?:, [^}]+)? \} from '\.\.\/systems\/immersiveFootsteps\.js'/, name);   // BA1: world.js also takes reportModCompatibilityIssues
  }
  // the exterior hosts hand the exterior arm's reads; the inside hosts the water arm's
  for (const src of [world, ext]) {
    // AUDIT PRECIP (PIN MOVED): the world host's season is the snow's under the feet on the snow lane (snowCoverHost.js footSeason)
    assert.match(src, /inside: false, inDungeon: false,\s*season(?:: snowCover\.footSeason\(player\.pos, season\))?, climateIndex: [^\n]*, tileMapIndex: _surf\.tileIndex \?\? -1,[^\n]*\n\s*waterWalking: _surf\.water === ON_EXTERIOR_WATER\.WaterWalking,/, 'AUDIT-IF F2: off terrain is -1, never the water tile');
    assert.match(src, /swimming: !!player\.isPlayerSwimming, pos: player\.pos,/, 'PlayerEnterExit.IsPlayerSwimming, not the motor flag');
  }
  assert.match(wm, /inside: true, inDungeon: mode === 'dungeon',\s*centreY: player\.pos\[1\] \+ player\.height \/ 2, waterSurfaceY: mode === 'dungeon' \? \(_surf \?\? null\) : null,/);
  assert.match(dj, /inside: true, inDungeon: true,\s*centreY: player\.pos\[1\] \+ player\.height \/ 2, waterSurfaceY: surf \?\? null,/);
  // the transitions
  assert.match(wm, /immersiveFootsteps\.onTransitionInterior\(\{ buildingType: interiorBuilding\?\.buildingType \?\? null, materials: ctx\.floorMaterials \}\);/);
  assert.equal((wm.match(/immersiveFootsteps\.onTransitionExterior\(\);/g) ?? []).length, 3, 'the building exit, the dungeon exit and (AUDIT 68 X3-ba-forceexit-rain) the forced exit');
  assert.equal((wm.match(/immersiveFootsteps\.onTransitionDungeonInterior\(\);/g) ?? []).length, 1);
  assert.equal((dj.match(/immersiveFootsteps\.onTransitionDungeonInterior\(\);/g) ?? []).length, 1, 'the standalone boot is the dungeon transition');
  // the landings
  for (const [name, src] of [['world', world], ['exterior', ext], ['worldModes', wm]]) assert.match(src, /sound: immersiveFootsteps\.fallSoundSink\(\(id, vol\) => audio\.playOneShot\(id, vol\)\)/, `${name}: the sink`);
  assert.match(dc, /!immersiveFootsteps\.playLargeSplash\(\)\) audio\.playOneShot\(SOUND\.SplashLarge/);
  assert.match(dc, /if \(!immersiveFootsteps\.applyPlayerFallDamage\(\)\) audio\.playOneShot\(SOUND\.FallDamage/);
  assert.match(dc, /if \(!immersiveFootsteps\.hardFallAlert\(\)\) audio\.playOneShot\(SOUND\.FallHard/);
  // the interior's materials and the inventory close
  const ic = rd('src/scenes/interiorContext.js');
  assert.match(ic, /floorMaterials\.push\(unityMaterialName\(a, r\)\);/);
  assert.match(ic, /const swapped = texRemap\.get\(base\) \?\? base;/, 'through the climate remap - DFU names the material after the swapped archive');
  assert.match(ic, /^\s+floorMaterials,/m, 'on the context');
  assert.match(rd('src/ui/native/nativeInventory.js'), /_closeSilently\(\) \{[\s\S]{0,400}this\.done = true;[\s\S]{0,400}immersiveFootsteps\.onInventoryClose\(this\.hooks\.entity \?\? null\);/);
  // AUDIT-IF F5: BOTH skins. The enhanced pack (the default) closes through inventoryDoor's own close, not _closeSilently.
  assert.match(rd('src/ui/inventoryDoor.js'), /closeSession\(deps, \{ dropped \}\);[\s\S]{0,700}immersiveFootsteps\.onInventoryClose\(deps\.entity \?\? null\);/, 'the enhanced skin\'s close refreshes too');
  assert.equal((rd('src/systems/inventorySession.js').match(/immersiveFootsteps/g) ?? []).length, 0, 'not in closeSession: inventorySession.js is upstream of transport.js, which the component imports');
  // the records
  assert.ok(existsSync(join(root, 'bible/06-Systems/Immersive-Footsteps.md')));
  assert.match(rd('bible/01-Overview/Active-Arcs.md'), /06-Systems\/Immersive-Footsteps\.md/);
  assert.match(rd('bible/01-Overview/Page-Index.md'), /06-Systems\/Immersive-Footsteps\.md/);   // PIN MOVED (WALLET1's merge of main, 2026-10-05): Home.md's page index moved, byte for byte, to its own page
  assert.match(rd('bible/09-Testing/Testing-Rows-2026-10-19.md'), /if1_immersivefootsteps\.test\.js/);
  const m = /(\d+) modules\s*\n?\s*live under\s*\n?\s*`src\/systems\/`/.exec(rd('bible/06-Systems/Systems.md'));
  assert.equal(Number(m[1]), readdirSync(join(root, 'src/systems'), { recursive: true }).filter((f) => f.endsWith('.js')).length, 'Systems.md counts src/systems/ live - IF1 put immersiveFootsteps.js in that count');
});

// AUDIT QS6 F7's SECOND CATCH. The `host-world-ungated` mutant had been
// unapplied for waves - its anchor left `scenes/world.js` when BA1 folded
// both mods' DisableBuiltInFootsteps into ONE gate - so it reported
// neither dead nor survived, and the law it was the only killer of was
// checked by nothing. Re-aimed at the gate's real home, it SURVIVED: the
// file's only claim about that gate was a source regex over the hosts.
//
// A source pin over the CALL SITE proves the call exists, not that the
// gate answers. This drives the gate itself.
test('IF1/BA1: the one gate - Immersive Footsteps owning the stride silences EVERY classic clip, and it outranks Better Ambience (mutant: the gate ungated, so the classic step plays under the mod that replaced it)', async () => {
  const { classicFootstepAllowed, betterAmbience } = await import('../../src/systems/betterAmbience.js');
  const { immersiveFootsteps } = await import('../../src/systems/immersiveFootsteps.js');   // the gate reads it from its own home
  const owns = (mod, on) => {
    const real = mod.ownsStride;
    mod.ownsStride = () => on;
    return () => { mod.ownsStride = real; };
  };
  // NEITHER mod owns the stride: the classic clip plays, which is the
  // answer a vanilla install must get.
  assert.equal(classicFootstepAllowed('step1'), true);
  // IMMERSIVE FOOTSTEPS owns it: every clip is nulled, whatever it is -
  // DisableBuiltInFootsteps nulls them all (the mod replaces the stride).
  let undo = owns(immersiveFootsteps, true);
  try {
    for (const clip of ['step1', 'step2', 'anything', '']) {
      assert.equal(classicFootstepAllowed(clip), false, `${clip || '(empty)'} is silenced`);
    }
  } finally { undo(); }
  assert.equal(classicFootstepAllowed('step1'), true, 'and it comes back when the mod stands down');
  // AND IT OUTRANKS the other mod: Better Ambience keeps two clips, but
  // Immersive Footsteps is asked FIRST and its answer is final - the
  // order is the whole of what this gate is for.
  const undoB = owns(betterAmbience, true);
  const keep = betterAmbience.classicClipKept;
  betterAmbience.classicClipKept = () => true;
  undo = owns(immersiveFootsteps, true);
  try {
    assert.equal(classicFootstepAllowed('step1'), false,
      'Better Ambience would keep this clip; Immersive Footsteps owns the stride, so it does not play');
  } finally { undo(); undoB(); betterAmbience.classicClipKept = keep; }
});

test('OWN-WORK4 audit: the two logging keys are live - LogModException logs a caught handler\'s error in full under AllowVerboseErrorLogging and in one line otherwise, and under DoNotSpamExceptionsLogs only the first until that key is changed; a handler that throws is caught, as the mod catches it (mutants: the verbose arm ignored; the latch never set; the latch never reset)', () => {
  const store = { ...defaults() };
  const settings = () => readFootstepSettings(() => store);
  const lines = [];
  const log = { log: (l) => lines.push(['log', l]), error: (l) => lines.push(['error', l]) };
  const boom = new Error('boom');
  store['ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs'] = false;
  assert.equal(logModException(boom, 1, { settings, log }), true);
  assert.deepEqual(lines.pop(), ['log', `ImmersiveFootsteps.LogModException(${EXCEPTION_DOING[1]})`], 'one line, no stack');
  store['ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging'] = true;
  logModException(boom, 3, { settings, log });
  const [kind, line] = lines.pop();
  assert.equal(kind, 'error');
  assert.match(line, /OnTransitionDungeonInterior\): Error: boom/, 'in full');
  store['ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs'] = true;
  assert.equal(logModException(boom, 2, { settings, log }), true, 'the key changed: the next is logged');
  assert.equal(logModException(boom, 2, { settings, log }), false, 'and then no more');
  store['ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs'] = false;
  assert.equal(logModException(boom, 2, { settings, log }), true, 'changed again: logged again');
  // a handler that throws is caught: a building whose materials cannot be read
  const c = createImmersiveFootsteps({ audio: { registerSamples: () => false, playOneShot() {} }, settings, makeClip: () => null });
  const before = lines.length;
  const original = console.error;
  console.error = (l) => lines.push(['error', l]);
  try {
    assert.doesNotThrow(() => c.onTransitionInterior({ get materials() { throw new Error('unreadable'); } }));
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, before + 1, 'and logged');
  // ReportModCompatibilityIssues' two raises name their own (world.js passes 6 at a start and 5 at a load)
  const report = (errorType) => reportModCompatibilityIssues({ settings, read: () => { throw new Error('unreadable'); }, log: () => {} }, errorType);
  console.error = (l) => lines.push(['error', l]);
  try {
    assert.equal(report(6), false);
    assert.match(lines.pop()[1], /LogModException\(OnStartGame\)/);
    assert.equal(report(5), false);
    assert.match(lines.pop()[1], /LogModException\(OnLoadSave\)/);
  } finally {
    console.error = original;
  }
});
