// BA1 - BETTER AMBIENCE 0.1.4 (Joshua Steinhauer), THE MOD, 1:1 (2026-09-16,
// Mac: "Next mod to integrate 1:1 ensuring compatibility").
//
// Six modules whose sixteen sources ride INSIDE the shipped bundle (vendored
// under vendor/better-ambience/Scripts/), restated in systems/betterAmbience.js
// with two engine seams (audio.js's reverb bus and low-pass loops, renderer.js's
// trilight ambient) and the RemoveHealth amount on ui/damageFlash.js. The pins
// hold the restatement to the sources: the SoundList's roll and pitch, the
// player stride's ladder and its 0.55 / 0.95 water arms, the armour clank by
// chest and legs, the partial DisableBuiltInFootsteps (two classic clips kept),
// the shake instance's fade and noise clock (UpdateShake called twice a frame,
// EZ Camera Shake's own), the damage shake's clamp, the view-space fold, the
// seeded fog and trilight off System.Random and the dungeon's GameObject name,
// the reverb preset per level, the indoor rain source and its weather edge,
// the four-frame wait; then the seams: the Mods pane against the shipped
// modsettings (the one recorded departure), the manifest, the clips against
// TryImportAudioClips' names, the row, the credit, the README, the registry,
// and the hosts. And the COMPATIBILITY brief: Immersive Footsteps' warning
// box fires exactly when its author says, and the classic stride's one gate
// answers for both mods' DisableBuiltInFootsteps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBetterAmbience, createBetterFootsteps, readBetterAmbienceSettings, SoundList, hasArmor,
  CameraShakeInstance, CameraShaker, damageShake, rigidInverse, shakeView, DEFAULT_POS_INFLUENCE, DEFAULT_ROT_INFLUENCE,
  SystemRandom, monoStringHash, dungeonGameObjectName, dungeonFogFor, REVERB_PRESETS, reverbPresetFor,
  CLIP_LISTS, CLASSIC_LISTS, LIST_VOLUME, CLASSIC_CLIPS_KEPT, MISSING_CLIPS, AMBIENT_RAIN_CLIP, AMBIENT_RAIN_LOWPASS_HZ,
  baClipNames, baClipName, baClipPath, baSoundKey, BA_SETTING_KEYS, BA_WALK_STEP_INTERVAL, BA_RUN_STEP_INTERVAL, BA_FOOTSTEP_VOLUME_SCALE, SHALLOW_ENTER, SHALLOW_LEAVE,
  TRANSITION_WAIT_FRAMES, BETTER_AMBIENCE_VENDOR, BETTER_AMBIENCE_MOD, classicFootstepAllowed, betterAmbience,
} from '../src/systems/betterAmbience.js';
import { REVERB_PRESET, reverbImpulseSamples, mbToGain } from '../src/systems/reverbPresets.js';
import { modCompatibilityChecking, reportModCompatibilityIssues, COMPAT_WARNING_LINES, COMPAT_WARNING_LOG, BETTER_AMBIENCE_GUID, immersiveFootsteps } from '../src/systems/immersiveFootsteps.js';
import { MOD_SETTINGS, isFloatKey, isChoiceKey, isIntKey, isTextKey, isTupleKey, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED } from '../src/systems/features.js';
import { CREDITS } from '../src/ui/credits.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { FOOTSTEP } from '../src/systems/footsteps.js';
import { equipTableOf } from '../src/systems/equip.js';
import { lookAt, multiply, trs } from '../src/world/mat4.js';
import { flashPlayerDamage, setRemoveHealthListener } from '../src/ui/damageFlash.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ~ ${b}`);
const V = BETTER_AMBIENCE_VENDOR;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const seq = (rolls, tail = 0) => { let i = 0; return () => (i < rolls.length ? rolls[i++] : tail); };

/** A component with recording audio, clips of one byte, scripted dice and a settable weather. */
function rig(over = {}, { rolls = [], weather = 'sunny', fetchOk = () => true } = {}) {
  const store = { ...defaults(), ...over };
  const shots = [], loops = [], loops3d = [], reverbs = [];
  const audio = {
    registerSound: async (k, b) => b.length > 0,
    playOneShot: (k, v, p) => shots.push([k, v, p]),
    loop: (k, v, o) => { const l = { k, v, o, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; },
    loop3d: (k, pos, v, o) => { const l = { k, pos, v, o, stopped: false, stop() { this.stopped = true; } }; loops3d.push(l); return l; },
    setReverb: (p) => { reverbs.push(p); return true; },
  };
  const w = { word: weather };
  const c = createBetterAmbience({
    audio, settings: () => readBetterAmbienceSettings(() => store), random: seq(rolls, 0), weather: () => w.word,
    fetchClip: async (name) => (fetchOk(name) ? new Uint8Array([1]) : null), snowFree: (ci) => ci === 224,
  });
  const entity = { items: [], activeEffects: [], maxHealth: 100 };
  const slots = equipTableOf(entity);
  const outdoors = (o = {}) => ({
    entity, inside: false, inBuilding: false, inDungeon: false, grounded: true, standingStill: false, isRunning: false, movingLessThanHalfSpeed: false,
    levitating: false, swimming: false, motorSwimming: false, pos: [0, 0, 0], centreY: 0.9, waterSurfaceY: null,
    onExteriorWater: false, onExteriorWaterAny: false, onExteriorPath: false, onStaticGeometry: false, onFoot: true, winter: false, climateIndex: 231, loadInProgress: false, ...o,
  });
  const dungeon = (o = {}) => outdoors({ inside: true, inDungeon: true, ...o });
  const building = (o = {}) => outdoors({ inside: true, inBuilding: true, ...o });
  const boot = async (m = outdoors()) => { c.frame(0, m); await c.settle(); };
  const walk = (n, m, step = 0.5) => { for (let i = 0; i < n; i++) { m.pos = [m.pos[0] + step, m.pos[1], m.pos[2]]; c.frame(0.016, m); } };
  return { c, store, shots, loops, loops3d, reverbs, entity, slots, outdoors, dungeon, building, boot, walk, w };
}
const armor = (material) => ({ group: 'Armor', templateIndex: 102, material });

// ═══ the settings, the assets, the seams ═════════════════════════════════

test('BA1: the Mods pane entry is the shipped modsettings.json - six sections, twenty keys, the kinds and ranges, the mod\'s own words - with ONE recorded departure: Better Footsteps ships off beside Immersive Footsteps; the manifest, the row, the curated keys, the credit, the README, the registry', () => {
  const m = MOD_SETTINGS[V];
  assert.ok(m, 'the vendor entry');
  const manifest = JSON.parse(rd('vendor/better-ambience/better-ambience.dfmod.json'));
  assert.equal(manifest.GUID, BETTER_AMBIENCE_MOD.guid); assert.equal(manifest.GUID, BETTER_AMBIENCE_GUID, 'the GUID Immersive Footsteps asks ModManager for');
  assert.equal(manifest.ModTitle, BETTER_AMBIENCE_MOD.title); assert.equal(manifest.ModVersion, BETTER_AMBIENCE_MOD.version); assert.equal(manifest.ModAuthor, BETTER_AMBIENCE_MOD.author);
  assert.equal(m.title, manifest.ModTitle); assert.equal(m.author, manifest.ModAuthor);
  assert.equal(manifest.Files.filter((f) => /\.cs$/.test(f)).length, 16, 'the sixteen sources the manifest names');
  for (const f of manifest.Files.filter((f) => /\.cs$/.test(f))) assert.ok(rd(`vendor/better-ambience/Scripts/${f.split('/').pop()}`).length > 200, `${f} is vendored`);
  assert.equal(manifest.Files.filter((f) => /\.wav$/i.test(f)).length, 51, 'the 51 clips the manifest names');
  assert.match(rd('vendor/better-ambience/LICENSE'), /^MIT License/);
  const shipped = JSON.parse(rd('vendor/better-ambience/modsettings.json'));
  const PORT_DEFAULT = Object.freeze({ 'Better Footsteps.enable': false, 'Dungeon Lighting.enableFogAmbientEffect': false });   // the two departures (modSettings.js says why; BA2 the second)
  let n = 0; const kinds = new Set();
  for (const section of shipped.Sections) {
    for (const k of section.Keys) {
      n += 1;
      const name = `${section.Name}.${k.Name}`;
      const def = m.keys[name];
      assert.ok(def, `${name} is on the pane`);
      assert.ok(BA_SETTING_KEYS.includes(name), `${name} is one the component reads`);
      const kind = k.$type.slice(k.$type.lastIndexOf('.') + 1);
      kinds.add(kind);
      if (kind === 'ToggleKey') { assert.equal(typeof def.default, 'boolean', name); assert.equal(def.default, PORT_DEFAULT[name] ?? k.Value, `${name} defaults as shipped`); assert.ok(!isIntKey(def) && !isFloatKey(def) && !isChoiceKey(def) && !isTextKey(def) && !isTupleKey(def), name); }
      else if (kind === 'SliderFloatKey') { assert.ok(isFloatKey(def), `${name} is a float slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); assert.ok(def.step > 0 && def.step <= (k.Max - k.Min), `${name} has a stepper`); }
      else if (kind === 'MultipleChoiceKey') { assert.ok(isChoiceKey(def), `${name} is a choice`); assert.deepEqual([...def.options], k.Options, name); assert.equal(def.default, k.Value, name); }
      else assert.fail(`${name}: a key kind the mod does not ship (${kind})`);
      if (k.Description) assert.equal(def.description, k.Description, `${name}'s description is the mod's own`);
      else assert.ok(def.description?.length > 8, `${name}: the mod wrote no description, the port did`);
    }
  }
  assert.equal(n, 20, 'six sections, twenty keys');
  assert.equal(Object.keys(m.keys).length, 21, 'plus the port\'s Enabled');
  assert.equal(BA_SETTING_KEYS.length, 21);
  assert.deepEqual([...kinds].sort(), ['MultipleChoiceKey', 'SliderFloatKey', 'ToggleKey']);
  assert.equal(m.keys.Enabled.default, true, 'MO1');
  assert.equal(m.keys['Better Footsteps.enable'].default, false, 'the departure: Immersive Footsteps\' author says so');
  assert.equal(JSON.parse(rd('vendor/better-ambience/modsettings.json')).Sections[0].Keys[0].Value, true, 'and the mod ships it on');
  // BA2 (2026-09-17, Mac: the dungeons were "properly dark" before the mod): the mod's Trilight ambient ships OFF - the classic flat 0.12 stays the dungeon's dark; the fog and the reverb ship on
  assert.equal(m.keys['Dungeon Lighting.enableFogAmbientEffect'].default, false, 'BA2: the mod\'s dungeon ambient ships off');
  assert.equal(JSON.parse(rd('vendor/better-ambience/modsettings.json')).Sections[4].Keys[0].Value, true, 'and the mod ships it on');
  assert.equal(m.keys['Dungeon Fog.enableFog'].default, true); assert.equal(m.keys['Dungeon Lighting.dungeonDarkness'].default, 1.0);
  assert.equal(readBetterAmbienceSettings(() => defaults()).enableAmbientLighting, false, 'the component reads the shipped default');
  assert.equal(readBetterAmbienceSettings(() => defaults()).enableFog, true);
  assert.deepEqual(m.keys['Dungeon Reverb.level'].options, ['Low', 'Medium', 'High']);
  const row = FEATURES.find((f) => f.id === 'mod-better-ambience');
  assert.ok(row); assert.equal(row.control.store, 'mods'); assert.equal(row.control.key, 'Enabled'); assert.match(row.effect, /^Takes effect at once/); assert.equal(row.group, 'world');
  for (const k of MOD_CURATED[V]) assert.ok(m.keys[k], `curated ${k}`);
  const credit = CREDITS.mods.find((c) => c.vendor.includes(V));
  assert.ok(credit); assert.equal(credit.version, '0.1.4'); assert.equal(credit.author, 'Joshua Steinhauer'); assert.match(credit.terms, /MIT/); assert.match(credit.terms, /no twin/);
  const readme = rd('vendor/better-ambience/README.md');
  assert.match(readme, /Better Ambience 0\.1\.4/); assert.match(readme, /MIT/); assert.match(readme, /Permission/); assert.match(readme, /0\.1\.5/, 'the Nexus label');
  assert.match(rd('bible/01-Overview/Mod-Registry.md'), /\| `better-ambience` \|/);
});

test('BA1: TryImportAudioClips\' names - wood 4, stone 4, armour 11, crunchy-grass 4, water 6 asked and FIVE present (water_001 never existed), the rain loop - every present name a vendored WAV the manifest names; the two classic lists; the per-list volumes and pitch ranges', () => {
  const manifest = JSON.parse(rd('vendor/better-ambience/better-ambience.dfmod.json'));
  const named = new Set(manifest.Files.filter((f) => /\.wav$/i.test(f)).map((f) => f.split('/').pop().replace(/\.wav$/i, '')));
  const names = baClipNames();
  assert.equal(names.length, 4 + 4 + 11 + 4 + 6 + 1);
  assert.equal(baClipName('sfx_footstep_wood', 0), 'sfx_footstep_wood_000', 'PadLeft(3, \'0\')');
  let present = 0;
  for (const name of names) {
    const there = existsSync(join(root, baClipPath(name)));
    if (MISSING_CLIPS.includes(name)) { assert.equal(there, false, `${name} is the known miss`); assert.equal(named.has(name), false, 'and the manifest never had it'); }
    else { assert.ok(there, `${name} vendored`); assert.ok(named.has(name), `${name} is the bundle's`); present++; }
  }
  assert.equal(present, 29);
  assert.equal(readdirSync(join(root, 'vendor/better-ambience/Sound')).filter((f) => f.endsWith('.wav')).length, 29, 'and nothing else');
  assert.deepEqual(CLASSIC_LISTS.FootstepSoundSubmerged.clips, [FOOTSTEP.Submerged], 'SoundClips.SplashSmall');
  assert.deepEqual(CLASSIC_LISTS.FootstepSoundSnow.clips, [FOOTSTEP.Snow1, FOOTSTEP.Snow2]);
  assert.deepEqual(CLIP_LISTS.FootstepsArmor.pitch, [1, 1.2]); assert.deepEqual(CLIP_LISTS.FootstepSoundWood?.pitch ?? CLIP_LISTS.FootstepSoundBuilding.pitch, [0.8, 1.2]);
  assert.deepEqual(LIST_VOLUME.FootstepSoundOutside, ['footstepVolume', 0.15]); assert.deepEqual(LIST_VOLUME.FootstepsArmor, ['armorVolume', 0.4]); assert.deepEqual(LIST_VOLUME.FootstepSoundDungeon, ['footstepVolume', 0.3]);
  assert.equal(baSoundKey('x'), 'ba:x'); assert.equal(AMBIENT_RAIN_LOWPASS_HZ, 4236);
  // the WAV header of the rain loop: the author's own 44.1 kHz stereo 16-bit file
  const wav = readFileSync(join(root, baClipPath(AMBIENT_RAIN_CLIP)));
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF'); assert.equal(wav.readUInt32LE(24), 44100); assert.equal(wav.readUInt16LE(22), 2);
});

// ═══ the laws ═══════════════════════════════════════════════════════════════

test('BA1: SoundList - the pitch is rolled inclusive, the clip exclusive, a classic index and a mod key both play, the empty list plays nothing; [verbatim] GetRandomClip indexes the mod clips by the unshifted roll', () => {
  const l = new SoundList();
  const shots = [];
  const audio = { playOneShot: (k, v, p) => shots.push([k, v, p]) };
  assert.equal(l.playRandomClip(audio, 1, () => 0.5), null, 'empty');
  l.addAudioClips(['ba:a', 'ba:b', 'ba:c']); l.setPitchRange(0.8, 1.2); l.setVolume(0.4);
  const p = l.playRandomClip(audio, 0.7, seq([0.5, 0.99]));
  near(p.pitch, 1.0); assert.equal(p.clip, 'ba:c'); near(p.volume, 0.28, 1e-9, 'this.volume x volume');
  assert.equal(shots[0][0], 'ba:c'); near(shots[0][1], 0.28, 1e-9); near(shots[0][2], 1.0, 1e-9);
  const s = new SoundList(); s.addSoundClip(FOOTSTEP.Snow1); s.addSoundClip(FOOTSTEP.Snow2);
  assert.equal(s.getRandomClip(() => 0.6), FOOTSTEP.Snow2, 'a classic index');
  const mixed = new SoundList(); mixed.addSoundClip(9); mixed.addAudioClips(['ba:x']);
  assert.equal(mixed.getRandomClip(() => 0.9), null, '[verbatim] rand 1 indexes audioClips[1], which is not there - the mod mixes no list');
});

test('BA1: the player stride - starts on the dungeon list; outdoors on grass (crunchy-grass) at 0.15 x volume, snow in winter unless the climate is snow-free, wood in a building, stone in a dungeon and on a PATH; a step every 2.5 units at 0.7 (half speed 0.35); the armour clank rides every non-submerged step when chest or legs are not leather', async () => {
  const r = rig({ 'Better Footsteps.enable': true }, { rolls: Array(200).fill(0.5) });
  await r.boot();
  assert.equal(r.c.status().clipsLoaded, true); assert.equal(r.c.ownsStride(), true);
  assert.equal(r.c.footsteps.status().list, 'FootstepSoundDungeon', 'Start :58');
  const m = r.outdoors();
  r.walk(5, m);   // the first frame seeds lastPosition (Start's GetHorizontalPosition); four moves = 2 units: nothing
  assert.equal(r.shots.length, 0);
  r.walk(2, m);   // 3 units > 2.5
  assert.equal(r.shots.length, 1);
  assert.match(r.shots[0][0], /^ba:sfx_footstep_crunchy-grass_/, 'outdoors, not winter: the outside list');
  near(r.shots[0][1], 0.15 * 1 * 0.7, 1e-9, 'list 0.15 x footstepVolume x FootstepVolumeScale');
  near(r.shots[0][2], 1.0, 1e-9, 'pitch 0.8..1.2 at the roll 0.5');
  r.shots.length = 0;
  r.walk(6, m); assert.equal(r.shots.length, 1, 'and every 2.5 units after');
  r.shots.length = 0;
  const half = r.outdoors({ pos: m.pos, movingLessThanHalfSpeed: true });
  r.walk(6, half); near(r.shots[0][1], 0.15 * 0.35, 1e-9, 'IsMovingLessThanHalfSpeed halves the scale');
  r.shots.length = 0;
  const winter = r.outdoors({ pos: half.pos, winter: true });
  r.walk(6, winter); assert.ok([FOOTSTEP.Snow1, FOOTSTEP.Snow2].includes(r.shots[0][0]), 'winter: the classic snow pair'); near(r.shots[0][1], 1 * 0.7);
  r.shots.length = 0;
  const desert = r.outdoors({ pos: winter.pos, winter: true, climateIndex: 224 });
  r.walk(6, desert); assert.match(r.shots[0][0], /crunchy-grass/, 'a snow-free climate in winter: outside');
  r.shots.length = 0;
  const path = r.outdoors({ pos: desert.pos, onExteriorPath: true });
  r.walk(6, path); assert.match(r.shots[0][0], /sfx_footstep_stone_/, 'a path tile takes the DUNGEON list'); near(r.shots[0][1], 0.3 * 0.7);
  r.shots.length = 0;
  const b = r.building({ pos: path.pos });
  r.walk(6, b); assert.match(r.shots[0][0], /sfx_footstep_wood_/); near(r.shots[0][1], 0.4 * 0.7);
  r.shots.length = 0;
  // the armour clank: a chain cuirass
  r.slots[EQUIP_SLOTS.ChestArmor] = armor(ARMOR_MATERIAL.Chain);
  r.walk(6, b);
  assert.equal(r.shots.length, 2, 'the step and the clank');
  assert.match(r.shots[1][0], /sfx_footstep_armor_light_/); near(r.shots[1][1], 0.4 * 0.7, 1e-9, 'armour 0.4 x armorVolume x scale'); near(r.shots[1][2], 1.1, 1e-9, 'pitch 1..1.2');
  r.shots.length = 0;
  r.slots[EQUIP_SLOTS.ChestArmor] = armor(ARMOR_MATERIAL.Leather); r.slots[EQUIP_SLOTS.LegsArmor] = armor(ARMOR_MATERIAL.Iron);
  r.walk(6, b); assert.equal(r.shots.length, 2, 'iron greaves clank');
  r.shots.length = 0;
  r.slots[EQUIP_SLOTS.LegsArmor] = armor(ARMOR_MATERIAL.Leather);
  r.walk(6, b); assert.equal(r.shots.length, 1, 'leather is silent');
  assert.equal(hasArmor(null), false);
  assert.equal(BA_WALK_STEP_INTERVAL, 2.5); assert.equal(BA_RUN_STEP_INTERVAL, 2.5); assert.equal(BA_FOOTSTEP_VOLUME_SCALE, 0.7);
});

test('BA1: the stride\'s gates - levitating or mounted off water zeroes the distance; airborne is lost grounding, the landing step swallowed once then played; standing still holds; exterior water is the submerged splash with NO clank; a dungeon\'s water at 0.55 under the line is shallow, 0.95 over it back to stone; the running interval is the walking one', async () => {
  const r = rig({ 'Better Footsteps.enable': true }, { rolls: Array(300).fill(0.5) });
  await r.boot();
  const m = r.outdoors();
  r.walk(7, m); r.shots.length = 0;
  const lev = r.outdoors({ pos: m.pos, levitating: true }); r.walk(10, lev); assert.equal(r.shots.length, 0, 'levitating');
  const horse = r.outdoors({ pos: lev.pos, onFoot: false }); r.walk(10, horse); assert.equal(r.shots.length, 0, 'mounted off water');
  const horseWater = r.outdoors({ pos: horse.pos, onFoot: false, onExteriorWaterAny: true, onExteriorWater: true }); r.walk(6, horseWater); assert.equal(r.shots.length, 1, 'mounted IN water: the splash plays'); assert.equal(r.shots[0][0], FOOTSTEP.Submerged);
  r.shots.length = 0;
  r.slots[EQUIP_SLOTS.ChestArmor] = armor(ARMOR_MATERIAL.Chain);
  r.walk(6, horseWater); assert.equal(r.shots.length, 1, 'submerged: no clank');
  r.shots.length = 0;
  const air = r.outdoors({ pos: horseWater.pos, grounded: false }); r.walk(10, air); assert.equal(r.shots.length, 0, 'airborne');
  const land = r.outdoors({ pos: air.pos }); r.c.frame(0.016, land);
  assert.equal(r.shots.length, 0, 'the FIRST landing is swallowed (ignoreLostGrounding, :167-168)');
  r.walk(10, r.outdoors({ pos: land.pos, grounded: false })); r.c.frame(0.016, r.outdoors({ pos: land.pos }));
  assert.equal(r.shots.length, 2, 'the second landing plays the step - and the clank');
  near(r.shots[0][1], 0.15 * 0.7, 1e-9, 'FootstepVolumeScale, no half-speed halving on the landing');
  r.shots.length = 0;
  const still = r.outdoors({ pos: land.pos, standingStill: true }); r.walk(10, still); assert.equal(r.shots.length, 0, 'IsStandingStill');
  const run = r.outdoors({ pos: still.pos, isRunning: true }); r.walk(6, run); assert.equal(r.shots.length, 2, 'running: the same 2.5');
  r.shots.length = 0;
  // the dungeon's water
  const d = r.dungeon({ pos: run.pos, waterSurfaceY: 1.0, centreY: 1.5 });
  r.walk(6, d); assert.match(r.shots[0][0], /sfx_footstep_water_/, '1.5 - 0.55 < 1.0: shallow'); near(r.shots[0][1], 0.4 * 0.7);
  r.shots.length = 0;
  const d2 = r.dungeon({ pos: d.pos, waterSurfaceY: 1.0, centreY: 1.9 });
  r.walk(6, d2); assert.match(r.shots[0][0], /sfx_footstep_water_/, '1.9 - 0.95 < 1.0: still shallow (the latch)');
  r.shots.length = 0;
  const d3 = r.dungeon({ pos: d2.pos, waterSurfaceY: 1.0, centreY: 2.0 });
  r.walk(6, d3); assert.match(r.shots[0][0], /sfx_footstep_stone_/, '2.0 - 0.95 >= 1.0: back to stone');
  r.shots.length = 0;
  const swim = r.dungeon({ pos: d3.pos, waterSurfaceY: 1.0, centreY: 0.3, swimming: true, motorSwimming: true, grounded: false });
  r.walk(6, swim); assert.equal(r.shots[0][0], FOOTSTEP.Submerged, 'swimming: submerged, and IsSwimming skips the grounding arm'); assert.equal(r.shots.length, 1, 'no clank submerged');
  assert.equal(SHALLOW_ENTER, 0.55); assert.equal(SHALLOW_LEAVE, 0.95);
  // the switch off: the mod owns nothing, the classic stride plays every clip
  r.store['Better Footsteps.enable'] = false;
  r.shots.length = 0; r.walk(10, r.outdoors({ pos: swim.pos })); assert.equal(r.shots.length, 0); assert.equal(r.c.ownsStride(), false);
});

test('BA1: DisableBuiltInFootsteps [verbatim] nulls Dungeon1 twice and Outside1 twice - Stone2 and Outside2 stay, so the classic component plays every second step under the mod\'s; the one gate answers for both mods', () => {
  assert.deepEqual([...CLASSIC_CLIPS_KEPT].sort(), [FOOTSTEP.Stone2, FOOTSTEP.Outside2].sort());
  assert.match(rd('vendor/better-ambience/Scripts/BetterFootstepsMod.cs'), /FootstepSoundDungeon1 = SoundClips\.None;\s*oldFootsteps\.FootstepSoundDungeon1 = SoundClips\.None;/, 'the slip, in the source');
  assert.match(rd('vendor/better-ambience/Scripts/BetterFootstepsMod.cs'), /FootstepSoundOutside1 = SoundClips\.None;\s*oldFootsteps\.FootstepSoundOutside1 = SoundClips\.None;/);
  // neither mod owns: every clip; Immersive Footsteps owns: none; Better Ambience owns: the two
  _resetModSettings();
  setModSetting('immersive-footsteps', 'Enabled', false);
  setModSetting('better-ambience', 'Better Footsteps.enable', false);
  assert.equal(classicFootstepAllowed(FOOTSTEP.Stone1), true);
  assert.equal(immersiveFootsteps.ownsStride(), false); assert.equal(betterAmbience.ownsStride(), false, 'the singleton has no clips under node');
  _resetModSettings();
});

test('BA1: CameraShakeInstance - the fade in over fadeInTime, the sustain, the fade out over fadeOutTime, the noise clock at Roughness (x the fade while fading out), the state ladder; CameraShaker calls UpdateShake TWICE an instance a frame [verbatim, EZ Camera Shake\'s own] and drops the inactive; ShakeOnce at 0 makes nothing', () => {
  const c = new CameraShakeInstance(2, 10, 0.5, 1, () => 0.5);
  assert.equal(c.tick, 0, 'Range(-100, 100) at the roll 0.5');
  assert.equal(c.currentState, 0, 'fading in');
  c.updateShake(0.25); near(c.currentFadeTime, 0.5); near(c.tick, 2.5, 1e-9, 'dt x Roughness');
  c.updateShake(0.25); near(c.currentFadeTime, 1.0); assert.equal(c.currentState, 2, 'shaking, sustained');
  c.updateShake(0.1); assert.equal(c.sustain, false, 'fadeInDuration > 0 and the fade at 1: sustain drops'); near(c.currentFadeTime, 0.9, 1e-9, 'and the SAME call already fades out by dt / fadeOutTime');
  assert.equal(c.currentState, 1, 'fading out');
  near(c.tick, 5 + 0.1 * 10 * 0.9, 1e-9, 'the clock scaled by the fade while fading out');
  for (let i = 0; i < 20; i++) c.updateShake(0.1);
  assert.equal(c.currentState, 3, 'inactive');
  const v = new CameraShakeInstance(3, 1, 0, 1, () => 0).updateShake(0);
  assert.equal(v.length, 3); assert.ok(v.every((x) => Math.abs(x) <= 1.5), 'amt (noise - 0.5) x Magnitude x fade');
  const sustained = new CameraShakeInstance(1, 1, undefined, undefined, () => 0); assert.equal(sustained.sustain, true); assert.equal(sustained.currentState, 2);
  const sh = new CameraShaker(() => 0.5);
  assert.equal(sh.shakeOnce(0, 10, 0.3, 0.5), null, 'magnitude 0');
  const inst = sh.shakeOnce(4, 10, 0.3, 0.5);
  assert.deepEqual(inst.PositionInfluence, [...DEFAULT_POS_INFLUENCE]); assert.deepEqual(inst.RotationInfluence, [...DEFAULT_ROT_INFLUENCE]);
  sh.update(0.1);
  near(inst.currentFadeTime, 0.2 / 0.3, 1e-9, 'TWO UpdateShake calls a frame: the fade advanced twice');
  assert.deepEqual(sh.posAddShake, [0, 0, 0], 'the FIRST frame is still: the clock starts on an integer (Range(-100, 100)) and the port\'s Perlin noise is exactly 0.5 on the lattice (Unity\'s is not - recorded)');
  sh.update(0.016);
  assert.ok(sh.posAddShake.some((x) => x !== 0) || sh.rotAddShake.some((x) => x !== 0), 'a shake, once the clock leaves the lattice');
  for (let i = 0; i < 60; i++) sh.update(0.1);
  assert.equal(sh.instances.length, 0, 'DeleteOnInactive');
  assert.deepEqual(sh.posAddShake, [0, 0, 0]);
});

test('BA1: DamageShaker.RemoveHealth - add + multiplier x amount / MaxHealth, clamped to maxShake; the flash edge carries the amount to it; the view fold is a rigid inverse in camera space and the identity when still', () => {
  const sh = new CameraShaker(() => 0.5);
  const s = { shakeAmountAdd: 1, shakeAmountMultiplier: 10, maxShake: 5, roughness: 10, fadeInTime: 0.3, fadeOutTime: 0.5 };
  damageShake(sh, s, 20, 100); near(sh.instances[0].Magnitude, 1 + 10 * 20 / 100); assert.equal(sh.instances[0].Roughness, 10);
  damageShake(sh, s, 90, 100); near(sh.instances[1].Magnitude, 5, 1e-9, 'clamped');
  damageShake(sh, s, 5, 0); assert.equal(sh.instances.length, 2, 'no MaxHealth: nothing');
  damageShake(sh, { ...s, shakeAmountAdd: 0, shakeAmountMultiplier: 0 }, 5, 100); assert.equal(sh.instances.length, 2, 'magnitude 0 makes nothing');
  // the RemoveHealth edge
  const heard = [];
  setRemoveHealthListener((a) => heard.push(a));
  flashPlayerDamage(7); flashPlayerDamage();
  assert.deepEqual(heard, [7, 0]);
  setRemoveHealthListener(null);
  // the fold
  const view = lookAt([1, 2, 3], [1, 2, 4], [0, 1, 0]);
  assert.equal(shakeView(view, [0, 0, 0], [0, 0, 0]), view, 'still: the same matrix');
  const m = trs(0.1, -0.2, 0.3, 5, -3, 2);
  const inv = rigidInverse(m);
  const id = multiply(m, inv);
  for (let i = 0; i < 16; i++) near(id[i], i % 5 === 0 ? 1 : 0, 1e-5, `identity[${i}]`);
  const shaken = shakeView(view, [0.1, 0, 0], [0, 0, 0]);
  assert.notDeepEqual([...shaken], [...view]);
  // the fold IS the inverse: the shaker's local transform, applied to the shaken view, gives the view back (campaign survivor `view-not-inverted`)
  const local = trs(0.1, -0.05, -0.2, 3, -2, 1);
  const back = multiply(local, shakeView(view, [0.1, -0.05, 0.2], [3, -2, 1]));
  for (let i = 0; i < 16; i++) near(back[i], view[i], 1e-5, `local x shaken = view [${i}]`);
  // a component with a hit: the frame after RemoveHealth shakes the view
  const r = rig();
  r.c.frame(0.016, r.outdoors());
  r.c.removeHealth(50, 100);
  r.c.frame(0.016, r.outdoors());
  assert.ok(r.c.status().shake.instances === 1);
  const v2 = r.c.view(view);
  assert.notDeepEqual([...v2], [...view], 'the shaker sits between the follower and the camera');
});

test('BA1: System.Random is the .NET reference (seed 42 opens 0.6681064659115423) and the dungeon\'s seed is Mono\'s hash of its GameObject name; EnableDungeonFog rolls colour, start and end in that order, scales by darkness, and the trilight lerps the three greys toward the colour; a castle or the switches off give nothing', () => {
  const r42 = new SystemRandom(42);
  near(r42.nextDouble(), 0.6681064659115423, 1e-15); near(r42.nextDouble(), 0.14090729837348093, 1e-15);
  assert.equal(new SystemRandom(0).nextDouble(), new SystemRandom(0).nextDouble(), 'deterministic');
  assert.equal(monoStringHash('abc'), 96354); assert.equal(monoStringHash(''), 0);
  assert.equal(dungeonGameObjectName('Daggerfall', 'Privateer\'s Hold'), 'DaggerfallDungeon [Region=Daggerfall, Name=Privateer\'s Hold]');
  const s = { enableFog: true, maxFogStart: 10, minFogStart: 0, maxFogDistance: 100, minFogDistance: 80, enableAmbientLighting: true, dungeonDarkness: 1, ambientLerp: 0.2 };
  const name = dungeonGameObjectName('Daggerfall', 'Privateer\'s Hold');
  const f = dungeonFogFor(name, s);
  const rnd = new SystemRandom(monoStringHash(name));
  const c = [rnd.nextDouble(), rnd.nextDouble(), rnd.nextDouble()];
  assert.deepEqual(f.fogColor, c, 'the colour is the first three rolls');
  const start = rnd.nextDouble() * 10, end = rnd.nextDouble() * 20 + 80 + start;
  assert.equal(f.fog.mode, 'linear'); near(f.fog.start, start); near(f.fog.end, end); assert.deepEqual(f.fog.color, c);
  near(f.ambient.sky[0], (0.433 + (c[0] - 0.433) * 0.2)); near(f.ambient.equator[1], (0.396 + (c[1] - 0.396) * 0.2)); near(f.ambient.ground[2], (0.254 + (c[2] - 0.254) * 0.2));
  const dark = dungeonFogFor(name, { ...s, dungeonDarkness: 0.5 });
  near(dark.fog.color[0], c[0] * 0.5); near(dark.ambient.sky[0], f.ambient.sky[0] * 0.5);
  assert.deepEqual(dungeonFogFor(name, s), f, 'the same dungeon, the same fog, every visit');
  assert.notDeepEqual(dungeonFogFor(dungeonGameObjectName('Daggerfall', 'Castle Daggerfall'), s).fogColor, c);
  assert.equal(dungeonFogFor(name, { ...s, enableFog: false }).fog, null); assert.equal(dungeonFogFor(name, { ...s, enableAmbientLighting: false }).ambient, null);
  const noFog = dungeonFogFor(name, { ...s, enableFog: false });
  near(noFog.ambient.sky[0], f.ambient.sky[0], 1e-12, 'the ambient rolls do not move when the fog\'s two rolls are skipped? NO - :92-93 are inside `if (enableFog)`, so the ambient uses the same colour and no later roll');
});

test('BA1: the component - a dungeon transition owes the four-frame wait, then the fog and trilight stand for the frames the host draws (and a castle clears them), the reverb bus takes the level\'s preset on the inside-dungeon edge and comes off outside, the rain source is 2D and low-passed in a building and 3D at the dungeon exit, follows the weather word, and stops on the transition; Enabled off takes everything down', async () => {
  const r = rig({ 'Dungeon Lighting.enableFogAmbientEffect': true }, { weather: 'sunny' });   // BA2: the ambient module on, as the mod ships it - this pin is the mod's behaviour
  await r.boot();
  const d = { regionName: 'Daggerfall', name: 'Privateer\'s Hold', inCastle: () => false, exitPos: [1, 2, 3] };
  r.c.onTransition({ dungeon: d });
  assert.equal(r.c.dungeonFog(), null, 'nothing before the wait');
  assert.equal(TRANSITION_WAIT_FRAMES, 4, 'four yields (campaign survivor `wait-three-frames`: the count was measured against itself)');
  for (let i = 0; i < 4; i++) { r.c.frame(0.016, r.dungeon()); assert.equal(r.c.dungeonFog(), null, `frame ${i}`); }
  r.c.frame(0.016, r.dungeon());
  assert.ok(r.c.dungeonFog(), 'the fifth frame: EnableDungeonFog');
  assert.equal(r.c.dungeonFog().mode, 'linear'); assert.ok(r.c.dungeonAmbient().sky.length === 3);
  { const r0 = rig({}, { weather: 'sunny' }); r0.c.onTransition({ dungeon: d }); r0.c.settleTransition(); assert.ok(r0.c.dungeonFog(), 'BA2: the port\'s defaults - the fog'); assert.equal(r0.c.dungeonAmbient(), null, 'and no ambient: the host keeps the classic flat 0.12'); }
  assert.deepEqual(r.reverbs, ['Stoneroom'], 'level 1 Medium, on the edge into the dungeon');
  assert.equal(r.c.status().rain, null, 'sunny: the source is there, silent');
  r.w.word = 'rain'; r.c.frame(0.016, r.dungeon());
  assert.equal(r.loops3d.length, 1); assert.deepEqual(r.loops3d[0].pos, [1, 2, 3]); assert.equal(r.loops3d[0].k, 'ba:AmbientRaining'); assert.equal(r.loops3d[0].o.lowpass, 4236); assert.equal(r.loops3d[0].o.maxDistance, 500);
  r.w.word = 'thunder'; r.c.frame(0.016, r.dungeon()); assert.equal(r.loops3d.length, 1, 'thunder is rain too: no restart'); assert.equal(r.loops3d[0].stopped, false, 'and no stop (campaign survivor `thunder-not-rain`)');
  r.w.word = 'overcast'; r.c.frame(0.016, r.dungeon()); assert.equal(r.loops3d[0].stopped, true, 'dry: Stop');
  // a castle: DisableDungeonFog
  r.c.onTransition({ dungeon: { ...d, inCastle: () => true } }); r.c.settleTransition();
  assert.equal(r.c.dungeonFog(), null); assert.equal(r.c.dungeonAmbient(), null);
  // a building: the 2D source
  r.w.word = 'rain';
  r.c.onTransition({ building: true }); r.c.settleTransition(); r.c.frame(0.016, r.building());
  assert.equal(r.loops.length, 1); assert.equal(r.loops[0].o.lowpass, 4236); assert.equal(r.loops[0].v, 1);
  assert.deepEqual(r.reverbs, ['Stoneroom', null], 'off the dungeon: the zone off');
  // outside: no source at all, whatever the weather
  r.c.onTransition(null); r.c.settleTransition(); r.c.frame(0.016, r.outdoors());
  assert.equal(r.loops[0].stopped, true); assert.equal(r.c.status().rain, null);
  // a dungeon with no exit marker: no source
  r.c.onTransition({ dungeon: { ...d, exitPos: null } }); r.c.settleTransition(); r.c.frame(0.016, r.dungeon());
  assert.equal(r.loops3d.length, 1, 'GameObject.Find("DungeonExit") found nothing');
  // the level
  r.store['Dungeon Reverb.level'] = 2; r.c.onTransition(null); r.c.frame(0.016, r.outdoors()); r.c.onTransition({ dungeon: d }); r.c.frame(0.016, r.dungeon());
  assert.equal(r.reverbs[r.reverbs.length - 1], 'Quarry');
  assert.deepEqual(REVERB_PRESETS, ['Cave', 'Stoneroom', 'Quarry']); assert.equal(reverbPresetFor(0), 'Cave'); assert.equal(reverbPresetFor(7), null);
  // Enabled off
  r.store.Enabled = false; r.c.frame(0.016, r.dungeon());
  assert.equal(r.reverbs[r.reverbs.length - 1], null); assert.equal(r.c.dungeonFog(), null);
  const someView = lookAt([0, 0, 0], [0, 0, 1], [0, 1, 0]); assert.equal(r.c.view(someView), someView, 'off: the view untouched');
});

test('BA1: the reverb presets are the I3DL2 numbers Unity\'s AudioReverbPreset carries, and the impulse built from each decays over its decayTime with its early reflections at their delay', () => {
  assert.deepEqual(Object.keys(REVERB_PRESET), ['Cave', 'Stoneroom', 'Quarry']);
  assert.equal(REVERB_PRESET.Cave.decayTime, 2.91); assert.equal(REVERB_PRESET.Stoneroom.decayTime, 2.31); assert.equal(REVERB_PRESET.Quarry.decayTime, 1.49);
  assert.equal(REVERB_PRESET.Quarry.reflections, -10000, 'the quarry has no early reflections');
  near(mbToGain(-1000), Math.pow(10, -0.5)); near(mbToGain(0), 1);
  for (const [name, p] of Object.entries(REVERB_PRESET)) {
    const [l, r] = reverbImpulseSamples(p, 44100);
    assert.equal(l.length, Math.ceil((p.reverbDelay + p.decayTime) * 44100), `${name}: the length is the delay plus the decay`);
    assert.equal(r.length, l.length);
    const at = (t) => Math.abs(l[Math.floor(t * 44100)]);
    const early = Math.floor(p.reflectionsDelay * 44100);
    if (p.reflections > -10000) assert.ok(Math.abs(l[early]) > 0, `${name}: a reflection at reflectionsDelay`);
    else assert.ok(mbToGain(p.reflections) < 1e-4, `${name}: the reflections are 100 dB down - nothing to hear`);
    // the tail decays: the mean magnitude over 2000 samples late in the tail is well under the same window early (campaign survivor `reverb-tail-no-decay`: one sample against one sample was a coin toss)
    const mean = (t) => { const i0 = Math.floor(t * 44100); let s = 0; for (let i = i0; i < i0 + 2000; i++) s += Math.abs(l[i] ?? 0); return s / 2000; };
    const a = mean(p.reverbDelay + 0.05), b = mean(p.reverbDelay + p.decayTime * 0.85);
    assert.ok(a > 0 && b < a * 0.2, `${name}: the tail decays (${a.toExponential(2)} -> ${b.toExponential(2)})`);
    void at;
    let peak = 0; for (const v of l) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak < 1, `${name}: under full scale`);
    // AUDIT-BA F1: the whole impulse carries the LEVEL's energy and no more - a wet signal never louder than the dry
    let energy = 0; for (const v of l) energy += v * v;
    const tailGain = mbToGain(p.reverb) * mbToGain(p.room), reflGain = mbToGain(p.reflections) * mbToGain(p.room);
    near(energy, tailGain * tailGain + reflGain * reflGain * (1 + 0.75 ** 2 + 0.75 ** 4 + 0.75 ** 6 + 0.75 ** 8), 1e-2, `${name}: energy ${energy.toFixed(4)} is the tail's gain squared plus the five taps' (the first draft carried ${name === 'Cave' ? '134' : 'hundreds'})`);
    assert.ok(energy < 1, `${name}: under the dry`);
  }
});

test('AUDIT-BA F2 + F3: the floating origin\'s rebase is IsRepositioningPlayer - the next landing is swallowed like a load\'s; and the shake clock is Time.deltaTime, zero under a pause', async () => {
  const r = rig({ 'Better Footsteps.enable': true }, { rolls: Array(300).fill(0.5) });
  await r.boot();
  const m = r.outdoors();
  r.walk(7, m); r.shots.length = 0;
  // two air/land cycles land a step each once the boot's swallow is spent
  r.walk(3, r.outdoors({ pos: m.pos, grounded: false })); r.c.frame(0.016, r.outdoors({ pos: m.pos }));
  r.walk(3, r.outdoors({ pos: m.pos, grounded: false })); r.c.frame(0.016, r.outdoors({ pos: m.pos }));
  assert.equal(r.shots.length, 1, 'the second landing plays');
  r.shots.length = 0;
  r.c.rebase();   // the world shifted under the feet
  r.walk(3, r.outdoors({ pos: m.pos, grounded: false })); r.c.frame(0.016, r.outdoors({ pos: m.pos }));
  assert.equal(r.shots.length, 0, 'F2: the landing after a reposition is swallowed (StreamingWorld.IsRepositioningPlayer -> ignoreLostGrounding)');
  r.walk(3, r.outdoors({ pos: m.pos, grounded: false })); r.c.frame(0.016, r.outdoors({ pos: m.pos }));
  assert.equal(r.shots.length, 1, 'and the one after plays');
  // F3
  r.c.removeHealth(50, 100);
  r.c.frame(0.1, r.outdoors({ pos: m.pos, paused: true }));
  r.c.frame(0.1, r.outdoors({ pos: m.pos, paused: true }));
  near(r.c.shaker.instances[0].currentFadeTime, 0, 1e-9, 'paused: the fade has not moved');
  assert.deepEqual(r.c.status().shake.pos, [0, 0, 0], 'and the camera has not');
  r.c.frame(0.1, r.outdoors({ pos: m.pos }));
  assert.ok(r.c.shaker.instances[0].currentFadeTime > 0, 'unpaused: it runs');
});

// ═══ the compatibility brief ═══════════════════════════════════════════════════

test('BA1 + IF1: ModCompatibilityChecking reads Better Ambience\'s switch through the settings (GetModFromGUID answers the vendored mod), and ReportModCompatibilityIssues posts the four log lines and the box only when Immersive Footsteps is on, its warnings are on, and Better Footsteps is on - so the shipped defaults post nothing', () => {
  _resetModSettings();
  assert.deepEqual(modCompatibilityChecking(), { betterAmbienceCheck: true, betterAmbienceFootstepsModuleCheck: false, temperedInteriorsCheck: false, travelOptionsCheck: false }, 'shipped: the mod is there, its footsteps are off');
  const boxes = [], logs = [];
  assert.equal(reportModCompatibilityIssues({ showText: (l) => boxes.push(l), log: (l) => logs.push(l) }), false, 'shipped defaults: no warning');
  setModSetting('better-ambience', 'Better Footsteps.enable', true);
  assert.equal(modCompatibilityChecking().betterAmbienceFootstepsModuleCheck, true);
  assert.equal(reportModCompatibilityIssues({ showText: (l) => boxes.push(l), log: (l) => logs.push(l) }), true, 'both strides on: the warning');
  assert.deepEqual(boxes[0], [...COMPAT_WARNING_LINES]); assert.equal(logs.length, 4); assert.deepEqual(logs, [...COMPAT_WARNING_LOG]);
  assert.equal(COMPAT_WARNING_LINES[0], '! WARNING !'); assert.match(COMPAT_WARNING_LINES[4], /Disable the 'Better Footsteps' setting/);
  setModSetting('immersive-footsteps', 'ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings', false);
  assert.equal(reportModCompatibilityIssues({ showText: (l) => boxes.push(l), log: () => {} }), false, 'AllowModCompatWarnings off');
  setModSetting('immersive-footsteps', 'ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings', true);
  setModSetting('immersive-footsteps', 'Enabled', false);
  assert.equal(reportModCompatibilityIssues({ showText: (l) => boxes.push(l), log: () => {} }), false, 'Immersive Footsteps off: nothing to overlap');
  setModSetting('immersive-footsteps', 'Enabled', true);
  setModSetting('better-ambience', 'Enabled', false);
  assert.equal(modCompatibilityChecking().betterAmbienceCheck, false, 'Better Ambience off: GetModFromGUID answers null');
  assert.equal(reportModCompatibilityIssues({ showText: (l) => boxes.push(l), log: () => {} }), false);
  assert.equal(boxes.length, 1);
  _resetModSettings();
});

// ═══ the hosts ══════════════════════════════════════════════════════════════════

test('BA1: the four hosts gate the classic stride through the one gate, drive the component each frame, fold the shake into the view, the two dungeon hosts hand FoggyDungeons\' fog as the base the water murk overrides and its trilight to setLighting, the modal host and the standalone dungeon raise the transitions, the outer host raises OnStartGame and OnLoad with the compatibility box, every RemoveHealth sender hands its amount, and the engine seams exist; the records', () => {
  const world = rd('src/scenes/world.js'), ext = rd('src/scenes/exterior.js'), wm = rd('src/scenes/worldModes.js'), dj = rd('src/scenes/dungeon.js');
  for (const [name, src] of [['world', world], ['exterior', ext], ['worldModes', wm], ['dungeon', dj]]) {
    assert.match(src, /if \(_step && classicFootstepAllowed\(_step\.clip\)\) audio\.playOneShot\(_step\.clip, _step\.volume\);/, `${name}: the one gate`);
    assert.equal((src.match(/betterAmbience\.frame\(dt, \{/g) ?? []).length, 1, `${name}: one frame`);
    assert.equal((src.match(/betterAmbience\.view\(lookAt\(/g) ?? []).length, 1, `${name}: the view fold`);
    assert.match(src, /import \{ betterAmbience, classicFootstepAllowed \} from '\.\.\/systems\/betterAmbience\.js'/, name);
    assert.match(src, /swimming: !!player\.isPlayerSwimming, motorSwimming: !!player\.swimming,/, `${name}: PlayerEnterExit.IsPlayerSwimming AND playerMotor.IsSwimming, the two the source reads`);
  }
  for (const src of [world, ext]) assert.match(src, /onExteriorWater: _onWater, onExteriorWaterAny: _onWater, onExteriorPath: !!_surf\.path, onStaticGeometry: !!_surf\.staticGeometry, onFoot: isOnFoot\(player\.transportMode\),/);
  assert.match(world, /loadInProgress: false, paused: _overlayHeld \|\| _seasonHeld,/, 'AUDIT-BA F2/F3: no debug key is a load; a held frame is paused');
  assert.match(ext, /paused: _overlayHeld,/); assert.match(wm, /paused: overlayHeld,/); assert.match(dj, /paused: overlayHeld,/);
  for (const [name, src] of [['worldModes', wm], ['dungeon', dj]]) {
    assert.match(src, /const _fog = dungeonFog\((?:lightingOn|!!renderer\.lightingLane), betterAmbience\.dungeonFog\(\) \?\? DUNGEON_FOG\); applyFog\(renderer, [a-zA-Z]+\.underwaterFogSettings\?\.\(cam\.pos\[1\], player\.pos, _fog\) \?\? _fog\);/, `${name}: the fog base (AUDIT-EL F6: through the lane's dark)`);
    assert.match(src, /const _tri = dungeonTrilight\((?:lightingOn|_on), betterAmbience\.dungeonAmbient\(\)\); renderer\.setLighting\(new Float32Array\(_tri \? _tri\.equator : dungeonAmbient\((?:lightingOn|_on), [a-zA-Z]+\.ambient\)\), 0, undefined, _tri\);/, `${name}: the trilight (EL4: through the lane's dark, scaled once)`);
    assert.match(src, /betterAmbience\.onTransition\(\{ dungeon: \{ regionName: dfLocation\.regionName, name: dfLocation\.name, inCastle: \(\) => !!ctx\.insideDungeonCastle\?\.\(\), exitPos: ctx\.enterMarker \? \[ctx\.enterMarker\.x, ctx\.enterMarker\.y, ctx\.enterMarker\.z\] : null \} \}\);/, `${name}: the dungeon transition`);
  }
  assert.equal((wm.match(/betterAmbience\.onTransition\(null\);/g) ?? []).length, 2, 'the two exits');
  assert.equal((wm.match(/betterAmbience\.onTransition\(\{ building: true \}\);/g) ?? []).length, 1);
  assert.match(world, /betterAmbience\.onStartGame\(\);\s*reportModCompatibilityIssues\(\{ showText: \(lines\) => townTalk\.pushOverlay\(new ChoiceWindow\(\{ lines \}\)\) \}\);/, 'OnStartGame - a push, B5\'s law');
  assert.match(world, /betterAmbience\.onLoad\(\);\s*reportModCompatibilityIssues\(\{ showText: \(lines\) => townTalk\.pushOverlay\(new ChoiceWindow\(\{ lines \}\)\) \}\);/, 'OnLoad');
  assert.match(world, /footsteps\.rebase\(\);\s*betterAmbience\.rebase\(\);/, 'the floating origin');
  // every RemoveHealth sender hands its amount
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/shared.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js', 'src/world/actionSystem.js']) {
    assert.equal((rd(f).match(/flashPlayerDamage\(\)/g) ?? []).length, 0, `${f}: no bare flash`);
    assert.ok((rd(f).match(/flashPlayerDamage\((dmg|_fallDmg)\)/g) ?? []).length >= 1, `${f}: the amount rides`);
  }
  assert.match(rd('src/systems/betterAmbience.js'), /setRemoveHealthListener\(\(amount\) => betterAmbience\.removeHealth\(amount, playerEntity\.maxHealth \?\? 0\)\);/);
  // the engine seams
  const audio = rd('src/systems/audio.js');
  assert.match(audio, /setReverb\(preset\) \{/); assert.match(audio, /loop\(index, volume = 1, \{ lowpass = 0 \} = \{\}\)/); assert.match(audio, /send\.connect\(conv\)\.connect\(wet\)\.connect\(this\.ctx\.destination\);/, 'wet beside dry, off the send');
  // AUDIT-BA F4: the zone takes the music too - the send every bus feeds, both song players
  assert.match(audio, /this\._master\.connect\(this\._reverbIn\);/, 'the sound master feeds the send'); assert.match(audio, /reverbSend\(\) \{ return this\._out\(\) \? this\._reverbIn : null; \}/);
  const music = rd('src/systems/music.js');
  assert.match(music, /new SongPlayer\(audio\.ctx, null, audio\.reverbSend\?\.\(\) \?\? null\)/, 'the MIDI player hands its master to the send');
  assert.match(music, /new AudioSongPlayer\(audio\.ctx, null, audio\.reverbSend\?\.\(\) \?\? null\)/, 'and the streamed one');
  assert.equal((rd('src/systems/songPlayer.js').match(/if \(this\._reverbSend\) this\._master\.connect\(this\._reverbSend\);/g) ?? []).length, 2, 'both players\' masters');
  const renderer = rd('src/render/renderer.js');
  assert.match(renderer, /uniform vec3 uAmbientSky;/); assert.match(renderer, /mix\(uAmbient, uAmbientSky, n\.y\) : mix\(uAmbient, uAmbientGround, -n\.y\)/, 'Trilight by the normal');
  assert.match(renderer, /setLighting\(ambient, sunScale, sunColor, trilight = null\) \{[\s\S]{0,400}this\.setAmbientTrilight\(trilight\);/, 'every flat caller clears it');
  // the records
  assert.ok(existsSync(join(root, 'bible/06-Systems/Better-Ambience.md')));
  assert.match(rd('bible/01-Overview/Active-Arcs.md'), /06-Systems\/Better-Ambience\.md/);
  assert.match(rd('bible/Home.md'), /06-Systems\/Better-Ambience\.md/);
  assert.match(rd('bible/09-Testing/Testing.md'), /ba1_betterambience\.test\.js/);
  const m = /(\d+) modules\s*\n?\s*live under\s*\n?\s*`src\/systems\/`/.exec(rd('bible/06-Systems/Systems.md'));
  assert.equal(Number(m[1]), readdirSync(join(root, 'src/systems')).filter((f) => f.endsWith('.js')).length, 'Systems.md counts src/systems/ live - BA1 put two modules in that count');
});
