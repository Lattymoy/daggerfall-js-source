// IF1 - IMMERSIVE FOOTSTEPS 1.01 (Kirk.O), THE MOD, 1:1 (2026-09-16, Mac:
// "Next mod we will be adding 1:1").
//
// The mod is two MonoBehaviours whose sources the author publishes under
// MIT (vendored under vendor/immersive-footsteps/Scripts/), restated in
// systems/immersiveFootsteps.js. The pins here hold the restatement to
// the SOURCE - the tile and archive tables are parsed OUT OF THE .cs and
// compared, not retyped - and to the seams: the Mods pane entry against
// the shipped modsettings.json, the 210 clips against LoadAudio's asset
// names and the manifest, the row, the credit, the README; then the laws
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
  createImmersiveFootsteps, readFootstepSettings, clipTable, clipNames, clipFolder, clipPath, soundKey,
  unityMaterialName, getFormattedTextureArchiveFromMaterialName, interiorFloorType, rollRandomAudioClip, coinFlip,
  checkClimateTileTables, checkBuildingClimateFloorTypeTables, CLIMATE_TILE_TABLES, BUILDING_FLOOR_TABLES,
  isSnowyClimate, isGrassyClimate, isRockyClimate, isSandyClimate, isSwampyClimate,
  IMMERSIVE_FOOTSTEPS_VENDOR, IMMERSIVE_FOOTSTEPS_MOD, FIXED_DELTA_TIME, SWIM_INTERVAL, REFRESH_SLOTS_TICKS, SOUND_CLIP_QUALITY, FLOOR_TYPE,
  LANDING_VOLUME_SCALE, SWAY_WEIGHTS, SWAY_SLOTS, SETTING_KEYS, FOOTSTEP_SETS,
} from '../src/systems/immersiveFootsteps.js';
import { MOD_SETTINGS, isIntKey, isFloatKey, isChoiceKey, isTextKey, isTupleKey } from '../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED } from '../src/systems/features.js';
import { CREDITS } from '../src/ui/credits.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { SEASON } from '../src/world/climateSwaps.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { SOUND } from '../src/systems/soundClips.js';
import { equipTableOf } from '../src/systems/equip.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ~ ${b}`);
const V = IMMERSIVE_FOOTSTEPS_VENDOR;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const boots = (material) => ({ group: 'Armor', templateIndex: 108, material });
const armor = (material) => ({ group: 'Armor', templateIndex: 102, material });

/** A component with a fixed-step frame: the store is live, the audio records, the clips are bytes of nothing, the dice are scripted. */
function rig(over = {}, { rolls = [], fetchOk = () => true } = {}) {
  const store = { ...defaults(), ...over };
  const shots = [], registered = [];
  const audio = {
    registerSound: async (k, b) => { registered.push(k); return b.length > 0; },
    playOneShot: (k, v) => shots.push([k, v]),
  };
  let ri = 0;
  const random = () => (ri < rolls.length ? rolls[ri++] : 0.0);
  const c = createImmersiveFootsteps({
    audio, settings: () => readFootstepSettings(() => store), random,
    fetchClip: async (name) => (fetchOk(name) ? new Uint8Array([1]) : new Uint8Array(0)),
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

test('IF1: the Mods pane entry is the shipped modsettings.json - every key, its kind, its range or options, its default, the mod\'s own words; the manifest; the row; the curated keys; the credit; the README', () => {
  const m = MOD_SETTINGS[V];
  assert.ok(m, 'the vendor entry');
  const manifest = JSON.parse(rd('vendor/immersive-footsteps/immersive-footsteps.dfmod.json'));
  assert.equal(manifest.GUID, IMMERSIVE_FOOTSTEPS_MOD.guid);
  assert.equal(manifest.ModTitle, IMMERSIVE_FOOTSTEPS_MOD.title); assert.equal(manifest.ModVersion, IMMERSIVE_FOOTSTEPS_MOD.version); assert.equal(manifest.ModAuthor, IMMERSIVE_FOOTSTEPS_MOD.author);
  assert.equal(manifest.DFUnity_Version, IMMERSIVE_FOOTSTEPS_MOD.dfunity);
  assert.equal(m.title, 'Immersive Footsteps'); assert.equal(m.author, manifest.ModAuthor);
  assert.equal(manifest.Files.filter((f) => /\.mp3$/i.test(f)).length, 210, 'the 210 clips the manifest names');
  assert.equal(manifest.Files.filter((f) => /\.cs$/.test(f)).length, 2, 'the two scripts the manifest names - vendored from the author\'s MIT repository');
  for (const f of manifest.Files.filter((f) => /\.cs$/.test(f))) assert.ok(rd(`vendor/immersive-footsteps/Scripts/${f.split('/').pop()}`).length > 10000, `${f} is vendored`);
  assert.match(rd('vendor/immersive-footsteps/Scripts/ImmersiveFootstepsMain.cs'), /License:\s+MIT License/, 'the main script carries the author\'s MIT header (the object script has none; the README says so)');
  const shipped = JSON.parse(rd('vendor/immersive-footsteps/modsettings.json'));
  let n = 0;
  const kinds = new Set();
  for (const section of shipped.Sections) {
    for (const k of section.Keys) {
      n += 1;
      const name = `${section.Name}.${k.Name}`;
      const def = m.keys[name];
      assert.ok(def, `${name} is on the pane`);
      assert.ok(SETTING_KEYS.includes(name), `${name} is one the component reads`);
      const kind = k.$type.slice(k.$type.lastIndexOf('.') + 1);
      kinds.add(kind);
      if (kind === 'ToggleKey') { assert.equal(typeof def.default, 'boolean', name); assert.equal(def.default, k.Value, `${name} defaults as shipped`); assert.ok(!isIntKey(def) && !isFloatKey(def) && !isChoiceKey(def) && !isTextKey(def) && !isTupleKey(def), name); }
      else if (kind === 'SliderFloatKey') { assert.ok(isFloatKey(def), `${name} is a float slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); assert.ok(def.step > 0 && def.step <= (k.Max - k.Min), `${name} has a stepper`); }
      else if (kind === 'MultipleChoiceKey') { assert.ok(isChoiceKey(def), `${name} is a choice`); assert.deepEqual([...def.options], k.Options, name); assert.equal(def.default, k.Value, name); }
      else assert.fail(`${name}: a key kind the mod does not ship (${kind})`);
      assert.equal(def.description, k.Description, `${name}'s description is the mod's own`);
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
  const credit = CREDITS.mods.find((c) => c.vendor.includes(V));
  assert.ok(credit, 'credited on the About screen');
  assert.equal(credit.title, 'Immersive Footsteps'); assert.equal(credit.version, '1.01'); assert.equal(credit.author, 'Kirk.O');
  assert.match(credit.terms, /MIT/); assert.match(credit.terms, /210/);
  const readme = rd('vendor/immersive-footsteps/README.md');
  assert.match(readme, /Immersive Footsteps 1\.01/); assert.match(readme, /Kirk\.O/); assert.match(readme, /MIT/); assert.match(readme, /Permission/);
  assert.ok(!readme.includes('kirkoliveri'), 'the manifest\'s ContactInfo stays out of the note (HT1\'s precedent)');
});

test('IF1: LoadAudio\'s 105 names per quality - Main is clips 1-3, Alt 4-6, four sways, two landings, one splash - and every one is a vendored file the manifest names, in the folder the bundle keeps it', () => {
  const manifest = JSON.parse(rd('vendor/immersive-footsteps/immersive-footsteps.dfmod.json'));
  const named = new Set(manifest.Files.filter((f) => /\.mp3$/i.test(f)).map((f) => f.split('/').pop()));
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
      assert.ok(named.has(`${name}.mp3`), `${name} is a file the manifest names`);
      assert.ok(existsSync(join(root, clipPath(name))), `${name} is vendored at ${clipPath(name)}`);
    }
  }
  // the folders are the author's: HQ Armor_Footsteps / Climate_Footsteps / Armor_Swaying / Fall_Landing, LQ Armor / Climate / Armor_Swaying / Fall_Landing
  assert.equal(clipFolder('HQ_Plate_Footstep_1'), 'High_Quality/Armor_Footsteps'); assert.equal(clipFolder('LQ_Plate_Footstep_1'), 'Low_Quality/Armor');
  assert.equal(clipFolder('HQ_Snow_Footstep_6'), 'High_Quality/Climate_Footsteps'); assert.equal(clipFolder('LQ_Deep_Water_Footstep_2'), 'Low_Quality/Climate');
  assert.equal(clipFolder('HQ_Leather_Swaying_4'), 'High_Quality/Armor_Swaying'); assert.equal(clipFolder('LQ_Water_Landing_1'), 'Low_Quality/Fall_Landing');
  // and nothing else is vendored under Audio/: 210 files, all named
  let count = 0;
  for (const q of ['High_Quality', 'Low_Quality']) {
    for (const d of readdirSync(join(root, 'vendor/immersive-footsteps/Audio', q))) {
      for (const f of readdirSync(join(root, 'vendor/immersive-footsteps/Audio', q, d))) { count++; assert.ok(named.has(f), `${f} is the bundle's`); }
    }
  }
  assert.equal(count, 210);
  assert.equal(soundKey('HQ_Grass_Footstep_1'), 'if:HQ_Grass_Footstep_1', 'the engine\'s registered-buffer key');
});

// ═══ the tables, parsed out of the source ══════════════════════════════════

/** The `static Dictionary<byte, bool> nameTileLookup = new ... { {5,true}, ... };` blocks of Object.cs, by their key string. */
function sourceTables() {
  const src = rd('vendor/immersive-footsteps/Scripts/ImmersiveFootstepsObject.cs');
  const byVar = {};
  for (const m of src.matchAll(/static Dictionary<(?:byte|string), bool> (\w+) = new Dictionary<(?:byte|string), bool>\s*\{([\s\S]*?)\};/g)) {
    byVar[m[1]] = new Set([...m[2].matchAll(/\{\s*"?([^",\s]+)"?\s*,\s*true\s*\}/g)].map((x) => (/^\d+$/.test(x[1]) ? Number(x[1]) : x[1])));
  }
  const keyed = {};
  for (const m of src.matchAll(/\{"([A-Za-z_]+)",(\w+Lookup)\}/g)) keyed[m[1]] = byVar[m[2]];
  return keyed;
}

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
  assert.equal(r.c.ownsStride(), false, 'the fetch is in flight');
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

test('AUDIT-IF F1: the build never inlines a clip as base64 - the vite rule covers this vendor (since INLINE1, every vendor) and falls through outside vendor/', () => {
  const viteConfig = rd('vite.config.js');
  const m = /assetsInlineLimit: \(filePath\) => \((.*?)\),/.exec(viteConfig);
  assert.ok(m, 'the callback');
  const rule = new Function('filePath', `return (${m[1]});`);
  assert.equal(rule('/x/vendor/immersive-footsteps/Audio/Low_Quality/Climate/LQ_Grass_Footstep_1.mp3'), false, 'never inline a clip');
  assert.equal(rule('C:\\x\\vendor\\immersive-footsteps\\Audio\\High_Quality\\Fall_Landing\\HQ_Water_Landing_1.mp3'), false, 'and on a Windows path');
  assert.equal(rule('/x/vendor/eye-of-the-beholder/Textures/112364/112364_0-0.png'), false, 'EOTB5\'s rule still holds');
  assert.equal(rule('/x/vendor/handheld-torches/Textures/112359_0-0.png'), false, 'INLINE1: every vendor asset is a file - this pin held handheld-torches OUT until Shield Widget\'s 275 sprites showed the allow-list was the bug');
  assert.equal(rule('/x/src/ui/icons/diamond.png'), undefined, 'everything outside vendor/ keeps the default');
  // the measurement that found it: 123 of the 210 clips are under Vite's 4 KB default and were inlined (250 KB of base64)
  let small = 0;
  for (const q of [SOUND_CLIP_QUALITY.Low, SOUND_CLIP_QUALITY.High]) for (const name of clipNames(q)) if (readFileSync(join(root, clipPath(name))).length < 4096) small++;
  assert.ok(small > 100, `${small} clips sit under the inline limit - the rule is not academic`);
});

test('AUDIT-IF F3: LoadAudio puts every clip in flight at once, and one missing clip still fails the whole load', async () => {
  let inFlight = 0, peak = 0;
  const release = [];
  const r = rig({}, { fetchOk: () => true });
  // a fetch that holds every clip until all 105 have been asked for
  const c = createImmersiveFootsteps({
    audio: { registerSound: async (k, b) => b.length > 0, playOneShot() {} }, settings: () => readFootstepSettings(() => r.store), random: () => 0,
    fetchClip: (name) => new Promise((res) => { inFlight++; peak = Math.max(peak, inFlight); release.push(() => { inFlight--; res(name === 'LQ_Snow_Footstep_3' ? new Uint8Array(0) : new Uint8Array([1])); }); }),
  });
  c.update(0, r.outdoors());
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(peak, 105, 'all 105 asked for before any answered');
  for (const f of release) f();
  await c.settle();
  assert.equal(c.ownsStride(), false, 'one empty clip: Missing sound asset, the mod stays inert');
});

// ═══ the hosts ═══════════════════════════════════════════════════════════════

test('IF1: the four stride hosts ask ownsStride before the classic play and drive the component each frame; the modal host raises the three transitions and the standalone dungeon its own; the three landing sinks and the dungeon context\'s three gates; the interior context lists the combined mesh\'s materials; the inventory close refreshes; the records', () => {
  const world = rd('src/scenes/world.js'), ext = rd('src/scenes/exterior.js'), wm = rd('src/scenes/worldModes.js'), dj = rd('src/scenes/dungeon.js'), dc = rd('src/scenes/dungeonContext.js');
  for (const [name, src] of [['world', world], ['exterior', ext], ['worldModes', wm], ['dungeon', dj]]) {
    assert.match(src, /if \(_step && classicFootstepAllowed\(_step\.clip\)\) audio\.playOneShot\(_step\.clip, _step\.volume\);/, `${name}: DisableVanillaFootsteps (BA1: through the one gate both mods' DisableBuiltInFootsteps answer)`);
    assert.ok(!/if \(_step\) audio\.playOneShot\(_step\.clip, _step\.volume\);/.test(src), `${name}: no ungated classic play`);
    assert.equal((src.match(/immersiveFootsteps\.update\(dt, \{/g) ?? []).length, 1, `${name}: one FixedUpdate feed`);
    assert.match(src, /import \{ immersiveFootsteps(?:, [^}]+)? \} from '\.\.\/systems\/immersiveFootsteps\.js'/, name);   // BA1: world.js also takes reportModCompatibilityIssues
  }
  // the exterior hosts hand the exterior arm's reads; the inside hosts the water arm's
  for (const src of [world, ext]) {
    assert.match(src, /inside: false, inDungeon: false,\s*season, climateIndex: [^\n]*, tileMapIndex: _surf\.tileIndex \?\? -1,[^\n]*\n\s*waterWalking: _surf\.water === ON_EXTERIOR_WATER\.WaterWalking,/, 'AUDIT-IF F2: off terrain is -1, never the water tile');
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
  assert.match(rd('src/ui/nativeInventory.js'), /_closeSilently\(\) \{\s*this\.done = true;[\s\S]{0,400}immersiveFootsteps\.onInventoryClose\(this\.hooks\.entity \?\? null\);/);
  // AUDIT-IF F5: BOTH skins. The enhanced pack (the default) closes through inventoryDoor's own close, not _closeSilently.
  assert.match(rd('src/ui/inventoryDoor.js'), /closeSession\(deps, \{ dropped \}\);[\s\S]{0,700}immersiveFootsteps\.onInventoryClose\(deps\.entity \?\? null\);/, 'the enhanced skin\'s close refreshes too');
  assert.equal((rd('src/systems/inventorySession.js').match(/immersiveFootsteps/g) ?? []).length, 0, 'not in closeSession: inventorySession.js is upstream of transport.js, which the component imports');
  // the records
  assert.ok(existsSync(join(root, 'bible/06-Systems/Immersive-Footsteps.md')));
  assert.match(rd('bible/01-Overview/Active-Arcs.md'), /06-Systems\/Immersive-Footsteps\.md/);
  assert.match(rd('bible/Home.md'), /06-Systems\/Immersive-Footsteps\.md/);
  assert.match(rd('bible/09-Testing/Testing.md'), /if1_immersivefootsteps\.test\.js/);
  const m = /(\d+) modules\s*\n?\s*live under\s*\n?\s*`src\/systems\/`/.exec(rd('bible/06-Systems/Systems.md'));
  assert.equal(Number(m[1]), readdirSync(join(root, 'src/systems')).filter((f) => f.endsWith('.js')).length, 'Systems.md counts src/systems/ live - IF1 put immersiveFootsteps.js in that count');
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
  const { classicFootstepAllowed, betterAmbience } = await import('../src/systems/betterAmbience.js');
  const { immersiveFootsteps } = await import('../src/systems/immersiveFootsteps.js');   // the gate reads it from its own home
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
