// BETTER AMBIENCE 0.1.4 (Joshua Steinhauer / joshcamas), THE MOD, 1:1
// (BA1, 2026-09-16, Mac: "Next mod to integrate 1:1 ensuring compatibility").
//
// "Adds camera shaking, better footsteps, and dungeon fog + reverb." Six
// modules, sixteen sources - every one of them carried INSIDE the shipped
// bundle as a TextAsset (vendor/better-ambience/Scripts/, byte for byte),
// under the author's MIT licence (vendor/better-ambience/LICENSE, from the
// author's repository, which carries the 0.1.3 sources and the WAV clips):
//
//   BetterFootstepsMod + BetterFootstepsComponent(Player)  - the player's stride,
//       a SoundList per ground with a random clip at a random pitch and an
//       ARMOUR clank over it when the chest or legs are not leather; the
//       NPC and Enemy components exist in the bundle and NOTHING adds them
//       (the two hooks are commented out in Start, :37-38) - dead, not ported
//   ReverbMod            - an AudioReverbZone on the player, on inside a dungeon
//   CameraShakeMod / CameraShaker / CameraShakeInstance / DamageShaker
//                        - EZ Camera Shake on the camera's parent, fed by RemoveHealth
//   FoggyDungeonsMod     - a dungeon's own fog colour and trilight ambient, seeded by its name
//   BetterRainMod        - Unity ParticleSystem tweaks (NO TWIN: the port's precipitation is
//                          its own presentation, Port-Doctrine) and the indoor rain loop
//                          (InteriorAmbientSoundSource), which IS ported
//   DungeonSoundsMod     - empty (Start and Update with no body)
//
// COMPATIBILITY WITH IMMERSIVE FOOTSTEPS (Mac's brief). The two mods both
// own the player's stride, and Immersive Footsteps' own author says which
// wins: its ModCompatibilityChecking reads THIS mod's "Better Footsteps"
// switch and posts a warning box at every game start while it is on
// ("you should always have Better Ambience's 'Better Footsteps' setting
// disabled, otherwise you will be constantly hearing overlapping footstep
// sounds"). So this port ships `Better Footsteps.enable` OFF - the one
// departure from the shipped keys, recorded in modSettings.js - and ports
// the warning itself (immersiveFootsteps.js reportModCompatibilityIssues),
// so a player who turns both on is told exactly what a DFU player is told.
// Every other module is on, as the mod ships it.
//
// THE CLIPS. The bundle's 51 clips are Unity's Vorbis imports (FSB5 in the
// AssetBundle's .resource, undecodable here); the author's repository
// ships the WAVs they were imported from, and the 29 this mod actually
// asks for are vendored from it (vendor/better-ambience/Sound/). The
// water list asks for six and the bundle carries five (there is no
// sfx_footstep_water_001 anywhere): TryImportAudioClips skips the miss
// and the list plays five, verbatim.

import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { equipTableOf } from './equip.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { modSettingsOf } from './modSettings.js';
import { audio as defaultAudio } from './audio.js';
import { FOOTSTEP } from './footsteps.js';
import { multiply, trs } from '../world/mat4.js';
import { currentWeather } from './weatherSim.js';
import { immersiveFootsteps } from './immersiveFootsteps.js';
import { isSnowFreeClimate } from '../world/weather.js';
import { perlinNoise } from '../world/perlin.js';   // Mathf.PerlinNoise's one home   // WeatherManager.IsSnowFreeClimate
import { setRemoveHealthListener } from '../ui/damageFlash.js';   // the SendMessage("RemoveHealth", amount) edge
import { playerEntity } from '../characters/playerEntity.js';

export const BETTER_AMBIENCE_VENDOR = 'better-ambience';
export const BETTER_AMBIENCE_MOD = Object.freeze({
  title: 'Better Ambience', version: '0.1.4', author: 'Joshua Steinhauer',
  guid: 'd5655077-ba38-4dbc-a41f-2b358cb1d680', dfunity: '0.13',
  nexusFile: '0.1.5',   // the Nexus archive is labelled 0.1.5; the manifest inside it says 0.1.4
});

// --- Settings (each module's LoadSettings) ----------------------------------

export const BA_SETTING_KEYS = Object.freeze([
  'Enabled',
  'Better Footsteps.enable', 'Better Footsteps.armorVolume', 'Better Footsteps.footstepVolume',
  'Dungeon Reverb.level',
  'Camera Shake.shakeAmountAdd', 'Camera Shake.shakeAmountMultiplier', 'Camera Shake.maxShake', 'Camera Shake.roughness', 'Camera Shake.fadeInTime', 'Camera Shake.fadeOutTime',
  'Dungeon Fog.enableFog', 'Dungeon Fog.maxFogDistance', 'Dungeon Fog.minFogDistance', 'Dungeon Fog.maxFogStart', 'Dungeon Fog.minFogStart',
  'Dungeon Lighting.enableFogAmbientEffect', 'Dungeon Lighting.dungeonDarkness', 'Dungeon Lighting.fogAmbientEffect',
  'Better Rain.enableBetterRain', 'Better Rain.enableBetterSnow',
]);

export function readBetterAmbienceSettings(read = () => modSettingsOf(BETTER_AMBIENCE_VENDOR)) {
  let s;
  try { s = read() ?? {}; } catch { s = {}; }
  const g = (k, d) => (s[k] === undefined ? d : s[k]);
  return {
    Enabled: s.Enabled !== false,
    footstepsEnable: g('Better Footsteps.enable', false), armorVolume: g('Better Footsteps.armorVolume', 1), footstepVolume: g('Better Footsteps.footstepVolume', 1),
    reverbLevel: g('Dungeon Reverb.level', 1),
    shakeAmountAdd: g('Camera Shake.shakeAmountAdd', 0), shakeAmountMultiplier: g('Camera Shake.shakeAmountMultiplier', 10), maxShake: g('Camera Shake.maxShake', 10),
    roughness: g('Camera Shake.roughness', 10), fadeInTime: g('Camera Shake.fadeInTime', 0.3), fadeOutTime: g('Camera Shake.fadeOutTime', 0.5),
    enableFog: g('Dungeon Fog.enableFog', true), maxFogDistance: g('Dungeon Fog.maxFogDistance', 100), minFogDistance: g('Dungeon Fog.minFogDistance', 80),
    maxFogStart: g('Dungeon Fog.maxFogStart', 10), minFogStart: g('Dungeon Fog.minFogStart', 0),
    enableAmbientLighting: g('Dungeon Lighting.enableFogAmbientEffect', true), dungeonDarkness: g('Dungeon Lighting.dungeonDarkness', 1), ambientLerp: g('Dungeon Lighting.fogAmbientEffect', 0.2),
    enableBetterRain: g('Better Rain.enableBetterRain', true), enableBetterSnow: g('Better Rain.enableBetterSnow', true),
  };
}
const sameSettings = (a, b) => a && b && Object.keys(a).every((k) => a[k] === b[k]);

// --- The clips (SoundUtility.TryImportAudioClips: `name_000`.. `name_00N`) ----

/** ApplyFootsteps (BetterFootstepsMod.cs:74-91): each list's asset stem and count. */
export const CLIP_LISTS = Object.freeze({
  FootstepSoundBuilding: Object.freeze({ stem: 'sfx_footstep_wood', count: 4, pitch: [0.8, 1.2] }),
  FootstepSoundDungeon: Object.freeze({ stem: 'sfx_footstep_stone', count: 4, pitch: [0.8, 1.2] }),
  FootstepsArmor: Object.freeze({ stem: 'sfx_footstep_armor_light', count: 11, pitch: [1, 1.2] }),
  FootstepSoundOutside: Object.freeze({ stem: 'sfx_footstep_crunchy-grass', count: 4, pitch: [0.8, 1.2] }),
  FootstepSoundShallow: Object.freeze({ stem: 'sfx_footstep_water', count: 6, pitch: [0.8, 1.2] }),
});
/** The two lists that are CLASSIC clips (AddSoundClip): the splash and the snow pair. */
export const CLASSIC_LISTS = Object.freeze({
  FootstepSoundSubmerged: Object.freeze({ clips: [FOOTSTEP.Submerged], pitch: [0.8, 1.2] }),   // SoundClips.SplashSmall
  FootstepSoundSnow: Object.freeze({ clips: [FOOTSTEP.Snow1, FOOTSTEP.Snow2], pitch: [0.8, 1.2] }),
});
/** LoadSettings (BetterFootstepsMod.cs:61-73): each list's own volume, times the switch's multiplier. */
export const LIST_VOLUME = Object.freeze({
  FootstepsArmor: ['armorVolume', 0.4], FootstepSoundDungeon: ['footstepVolume', 0.3], FootstepSoundBuilding: ['footstepVolume', 0.4],
  FootstepSoundShallow: ['footstepVolume', 0.4], FootstepSoundOutside: ['footstepVolume', 0.15], FootstepSoundSubmerged: ['footstepVolume', 1], FootstepSoundSnow: ['footstepVolume', 1],
});
export const AMBIENT_RAIN_CLIP = 'AmbientRaining';
export const AMBIENT_RAIN_LOWPASS_HZ = 4236;   // InteriorAmbientSoundSource.cs:27
export const baClipName = (stem, i) => `${stem}_${String(i).padStart(3, '0')}`;   // SoundUtility.cs:64
/** Every name TryImportAudioClips asks for (29 present in the bundle; water_001 is asked for and never was). */
export function baClipNames() {
  const out = [];
  for (const l of Object.values(CLIP_LISTS)) for (let i = 0; i < l.count; i++) out.push(baClipName(l.stem, i));
  out.push(AMBIENT_RAIN_CLIP);
  return out;
}
export const MISSING_CLIPS = Object.freeze(['sfx_footstep_water_001']);   // not in the bundle, not in the repository
export const baClipPath = (name) => `vendor/better-ambience/Sound/${name}.wav`;
const IN_BROWSER = typeof window !== 'undefined';
const URLS = IN_BROWSER
  ? import.meta.glob('../../vendor/better-ambience/Sound/*.wav', { eager: true, query: '?url', import: 'default' })
  : {};
export const baClipUrl = (name) => URLS[`../../${baClipPath(name)}`] ?? null;
export const baSoundKey = (name) => `ba:${name}`;
async function defaultFetchClip(name) {
  const url = baClipUrl(name);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** DisableBuiltInFootsteps (BetterFootstepsMod.cs:92-105), VERBATIM: the
 *  mod nulls Dungeon1 TWICE and Outside1 TWICE, so the classic component
 *  keeps FootstepSoundDungeon2 and FootstepSoundOutside2 - every second
 *  classic step on stone and outdoors still plays under the mod's own. */
export const CLASSIC_CLIPS_KEPT = Object.freeze(new Set([FOOTSTEP.Stone2, FOOTSTEP.Outside2]));

// --- SoundList (SoundList.cs:11-55) ------------------------------------------

/** UnityEngine.Random.Range(int, int): max exclusive; (float, float): inclusive. */
const rangeInt = (random, min, max) => min + Math.floor(random() * (max - min));
const rangeFloat = (random, min, max) => min + random() * (max - min);

export class SoundList {
  constructor() { this.soundClips = []; this.audioClips = []; this.pitchMin = 1; this.pitchMax = 1; this.volume = 1; }
  setVolume(v) { this.volume = v; }
  setPitchRange(min, max) { this.pitchMin = min; this.pitchMax = max; }
  /** PlayRandomClip (:27-31): the source's pitch is rolled, then PlayOneShot at this.volume x volume. */
  playRandomClip(audio, volume, random) {
    const pitch = rangeFloat(random, this.pitchMin, this.pitchMax);
    const clip = this.getRandomClip(random);
    if (clip == null) return null;
    audio.playOneShot(clip, this.volume * volume, pitch);
    return { clip, pitch, volume: this.volume * volume };
  }
  /** GetRandomClip (:32-42). [verbatim] `audioClips[rand]` for a roll past the
   *  classic entries indexes the mod clips by the UNSHIFTED roll - it cannot
   *  bite, since no list of the mod's mixes the two kinds. */
  getRandomClip(random) {
    const max = this.soundClips.length + this.audioClips.length;
    if (max === 0) return null;
    const rand = rangeInt(random, 0, max);
    if (rand < this.soundClips.length) return this.soundClips[rand];
    return this.audioClips[rand] ?? null;
  }
  addAudioClip(c) { this.audioClips.push(c); }
  addAudioClips(cs) { this.audioClips.push(...cs); }
  addSoundClip(c) { this.soundClips.push(c); }
}

// --- Better Footsteps (BetterFootstepsComponent.cs + ComponentPlayer.cs) --------

export const BA_WALK_STEP_INTERVAL = 2.5;   // :12-13 "Matched to classic"
export const BA_RUN_STEP_INTERVAL = 2.5;
export const BA_FOOTSTEP_VOLUME_SCALE = 0.7;   // :14
export const SHALLOW_ENTER = 0.55;          // :129 - NOT PlayerFootsteps' 0.57
export const SHALLOW_LEAVE = 0.95;          // :137

/** HasArmor (:211-220): chest or legs worn and not leather. `item.material` IS NativeMaterialValue. */
export function hasArmor(entity) {
  let slots;
  try { slots = entity ? equipTableOf(entity) : null; } catch { slots = null; }
  if (!slots) return false;
  const chest = slots[EQUIP_SLOTS.ChestArmor], legs = slots[EQUIP_SLOTS.LegsArmor];
  if (chest && (chest.material ?? ARMOR_MATERIAL.Leather) !== ARMOR_MATERIAL.Leather) return true;
  if (legs && (legs.material ?? ARMOR_MATERIAL.Leather) !== ARMOR_MATERIAL.Leather) return true;
  return false;
}

/**
 * BetterFootstepsComponentPlayer, one instance on the player.
 *   update(m): the frame (Update, not FixedUpdate); m is
 *     { loadInProgress, season (SEASON), climateIndex, inside, inBuilding, inDungeon,
 *       onExteriorWater (Swimming || WaterWalking), onExteriorPath, onStaticGeometry,
 *       waterSurfaceY (null = blockWaterLevel 10000), centreY (transform.position.y),
 *       swimming (IsPlayerSwimming), motorSwimming (playerMotor.IsSwimming), levitating,
 *       onFoot, onExteriorWaterAny (OnExteriorWater != None), grounded, standingStill,
 *       isRunning, movingLessThanHalfSpeed, pos [x,y,z], entity }
 */
export function createBetterFootsteps({ audio = defaultAudio, random = Math.random, snowFree = () => false } = {}) {
  const lists = {
    FootstepSoundDungeon: new SoundList(), FootstepSoundOutside: new SoundList(), FootstepSoundSnow: new SoundList(),
    FootstepSoundBuilding: new SoundList(), FootstepSoundShallow: new SoundList(), FootstepSoundSubmerged: new SoundList(), FootstepsArmor: new SoundList(),
  };
  let lastPosition = null;      // Start: GetHorizontalPosition (x, 0, z)
  let lostGrounding = false;
  let distance = 0;
  let ignoreLostGrounding = true;
  let currentFootstepSoundList = lists.FootstepSoundDungeon;   // Start :58
  let currentSeason = 0, currentClimateIndex = 0, isInside = false, isInOutsideWater = false, isInOutsidePath = false, isOnStaticGeometry = false;
  const played = [];
  const nameOf = (l) => Object.keys(lists).find((k) => lists[k] === l) ?? null;

  /** ApplyFootsteps (Mod.cs:74-91): the clips into the lists, by key (`ba:<name>`) for the mod's, by index for the classic. */
  function applyFootsteps(present) {
    for (const [k, l] of Object.entries(CLIP_LISTS)) {
      const clips = [];
      for (let i = 0; i < l.count; i++) { const n = baClipName(l.stem, i); if (present.has(n)) clips.push(baSoundKey(n)); }   // TryImportAudioClips skips a miss
      lists[k].addAudioClips(clips);
      lists[k].setPitchRange(l.pitch[0], l.pitch[1]);
    }
    for (const [k, l] of Object.entries(CLASSIC_LISTS)) { for (const c of l.clips) lists[k].addSoundClip(c); lists[k].setPitchRange(l.pitch[0], l.pitch[1]); }
  }
  /** LoadSettings (Mod.cs:61-73). */
  function loadSettings(s) {
    for (const [k, [key, base]] of Object.entries(LIST_VOLUME)) lists[k].setVolume(base * s[key]);
  }
  function playFootstep(volume, entity) {
    if (!currentFootstepSoundList) return;
    const p = currentFootstepSoundList.playRandomClip(audio, volume, random);
    if (p) played.push({ list: nameOf(currentFootstepSoundList), ...p });
    if (currentFootstepSoundList !== lists.FootstepSoundSubmerged && hasArmor(entity)) {
      const a = lists.FootstepsArmor.playRandomClip(audio, volume, random);
      if (a) played.push({ list: 'FootstepsArmor', ...a });
    }
    if (played.length > 12) played.splice(0, played.length - 12);
  }
  const horizontal = (pos) => [pos[0], 0, pos[2]];   // GetHorizontalPosition (:203-206): y is ZERO here (Immersive Footsteps keeps it)

  /** Update (:60-192), the player's overrides in place (ComponentPlayer.cs). */
  function update(m) {
    // FootstepsEnabled: Travel Options' accelerated travel is not vendored - the callback never answers, so never disabled
    if (m.loadInProgress) { ignoreLostGrounding = true; return; }
    if (lastPosition === null) lastPosition = horizontal(m.pos);
    const playerSeason = m.winter ? 1 : 0;   // DaggerfallDateTime.Seasons.Winter is the one value the selection reads; the hosts hand the calendar's winter
    const climateIndex = m.climateIndex ?? 0;
    const inside = !!m.inside;
    const inBuilding = !!m.inBuilding;
    const onExteriorWater = !!m.onExteriorWater;
    const pnExteriorPath = !!m.onExteriorPath;
    const onStaticGeometry = !!m.onStaticGeometry;
    if (playerSeason !== currentSeason || climateIndex !== currentClimateIndex || isInside !== inside || onExteriorWater !== isInOutsideWater || pnExteriorPath !== isInOutsidePath || onStaticGeometry !== isOnStaticGeometry) {
      currentSeason = playerSeason; currentClimateIndex = climateIndex; isInside = inside; isInOutsideWater = onExteriorWater; isInOutsidePath = pnExteriorPath; isOnStaticGeometry = onStaticGeometry;
      if (!isInside && !onStaticGeometry) {
        if (m.winter && !snowFree(currentClimateIndex)) currentFootstepSoundList = lists.FootstepSoundSnow;
        else currentFootstepSoundList = lists.FootstepSoundOutside;
      } else if (inBuilding) currentFootstepSoundList = lists.FootstepSoundBuilding;
      else currentFootstepSoundList = lists.FootstepSoundDungeon;
    }
    if (onExteriorWater) currentFootstepSoundList = lists.FootstepSoundSubmerged;
    if (pnExteriorPath) currentFootstepSoundList = lists.FootstepSoundDungeon;
    if (m.inDungeon && m.waterSurfaceY != null) {
      if (currentFootstepSoundList !== lists.FootstepSoundSubmerged && m.swimming) currentFootstepSoundList = lists.FootstepSoundSubmerged;
      else if (currentFootstepSoundList !== lists.FootstepSoundShallow && !m.swimming && (m.centreY - SHALLOW_ENTER) < m.waterSurfaceY) currentFootstepSoundList = lists.FootstepSoundShallow;
    }
    if (!onExteriorWater
      && (currentFootstepSoundList === lists.FootstepSoundSubmerged || currentFootstepSoundList === lists.FootstepSoundShallow)
      && (m.waterSurfaceY == null || (m.centreY - SHALLOW_LEAVE) >= m.waterSurfaceY)) {
      currentFootstepSoundList = lists.FootstepSoundDungeon;   // :139 - the DUNGEON list, wherever you are
    }
    // :142 - `IsLevitating() || !IsOnFoot && OnExteriorWater == None` (C#'s && binds tighter)
    if (m.levitating || (m.onFoot === false && !m.onExteriorWaterAny)) { distance = 0; return; }
    if (!m.motorSwimming) {
      if (!m.grounded) { distance = 0; lostGrounding = true; return; }
      if (lostGrounding) {
        distance = 0;
        lastPosition = horizontal(m.pos);
        lostGrounding = false;
        if (ignoreLostGrounding) ignoreLostGrounding = false;
        else if (currentFootstepSoundList) playFootstep(BA_FOOTSTEP_VOLUME_SCALE, m.entity);   // SoundVolume is the master bus's
        return;
      }
    }
    if (m.standingStill) return;
    const position = horizontal(m.pos);
    distance += Math.hypot(position[0] - lastPosition[0], position[1] - lastPosition[1], position[2] - lastPosition[2]);
    lastPosition = position;
    const threshold = m.isRunning ? BA_RUN_STEP_INTERVAL : BA_WALK_STEP_INTERVAL;
    if (distance > threshold && currentFootstepSoundList) {
      let volumeScale = BA_FOOTSTEP_VOLUME_SCALE;
      if (m.movingLessThanHalfSpeed) volumeScale *= 0.5;
      playFootstep(volumeScale, m.entity);
      distance = 0;
    }
  }
  return {
    applyFootsteps, loadSettings, update,
    /** EV1: the floating origin moved the world, not the feet (footsteps.js rebase). */
    rebase() { lastPosition = null; },
    lists,
    status() { return { list: nameOf(currentFootstepSoundList), distance, lostGrounding, ignoreLostGrounding, played: played.slice() }; },
  };
}

// --- Camera shake (CameraShakeInstance.cs, CameraShaker.cs, DamageShaker.cs) ----

// Mathf.PerlinNoise: the port's one home is world/perlin.js (Ken Perlin's improved noise on the
// z = 0 plane, remapped to 0..1 - the same statistical character as Unity's, not its table).

export class CameraShakeInstance {
  /** (magnitude, roughness, fadeInTime, fadeOutTime) - :39-56; (magnitude, roughness) - :62-68. */
  constructor(magnitude, roughness, fadeInTime = undefined, fadeOutTime = undefined, random = Math.random) {
    this.Magnitude = magnitude; this.Roughness = roughness;
    this.PositionInfluence = [0, 0, 0]; this.RotationInfluence = [0, 0, 0];
    this.DeleteOnInactive = true;
    this.roughMod = 1; this.magnMod = 1;
    this.fadeOutDuration = 0; this.fadeInDuration = 0; this.sustain = false; this.currentFadeTime = 0;
    this.amt = [0, 0, 0];
    if (fadeInTime === undefined) { this.sustain = true; }
    else {
      this.fadeOutDuration = fadeOutTime; this.fadeInDuration = fadeInTime;
      if (fadeInTime > 0) { this.sustain = true; this.currentFadeTime = 0; } else { this.sustain = false; this.currentFadeTime = 1; }
    }
    this.tick = rangeInt(random, -100, 100);   // Random.Range(-100, 100), an int
  }
  /** UpdateShake (:69-88). */
  updateShake(dt) {
    this.amt[0] = perlinNoise(this.tick, 0) - 0.5;
    this.amt[1] = perlinNoise(0, this.tick) - 0.5;
    this.amt[2] = perlinNoise(this.tick, this.tick) - 0.5;
    if (this.fadeInDuration > 0 && this.sustain) {
      if (this.currentFadeTime < 1) this.currentFadeTime += dt / this.fadeInDuration;
      else if (this.fadeOutDuration > 0) this.sustain = false;
    }
    if (!this.sustain) this.currentFadeTime -= dt / this.fadeOutDuration;
    if (this.sustain) this.tick += dt * this.Roughness * this.roughMod;
    else this.tick += dt * this.Roughness * this.roughMod * this.currentFadeTime;
    const k = this.Magnitude * this.magnMod * this.currentFadeTime;
    return [this.amt[0] * k, this.amt[1] * k, this.amt[2] * k];
  }
  startFadeOut(t) { if (t === 0) this.currentFadeTime = 0; this.fadeOutDuration = t; this.fadeInDuration = 0; this.sustain = false; }
  startFadeIn(t) { if (t === 0) this.currentFadeTime = 1; this.fadeInDuration = t; this.fadeOutDuration = 0; this.sustain = true; }
  get isShaking() { return this.currentFadeTime > 0 || this.sustain; }
  get isFadingOut() { return !this.sustain && this.currentFadeTime > 0; }
  get isFadingIn() { return this.currentFadeTime < 1 && this.sustain && this.fadeInDuration > 0; }
  /** CurrentState (:143-155): 0 fading in, 1 fading out, 2 shaking, 3 inactive. */
  get currentState() { return this.isFadingIn ? 0 : this.isFadingOut ? 1 : this.isShaking ? 2 : 3; }
}

export const DEFAULT_POS_INFLUENCE = Object.freeze([0.15, 0.15, 0.15]);   // CameraShaker.cs:16
export const DEFAULT_ROT_INFLUENCE = Object.freeze([1, 1, 1]);            // :20
const mulVec = (v, w) => [v[0] * w[0], v[1] * w[1], v[2] * w[2]];        // CameraUtilities.MultiplyVectors

export class CameraShaker {
  constructor(random = Math.random) { this.random = random; this.instances = []; this.posAddShake = [0, 0, 0]; this.rotAddShake = [0, 0, 0]; }
  /** Update (:30-52) - VERBATIM, UpdateShake is called TWICE per instance per frame (once for the position
   *  term, once for the rotation), so the fade and the noise clock advance twice; EZ Camera Shake's own. */
  update(dt) {
    let pos = [0, 0, 0], rot = [0, 0, 0];
    for (let i = 0; i < this.instances.length; i++) {
      const c = this.instances[i];
      if (c.currentState === 3 && c.DeleteOnInactive) { this.instances.splice(i, 1); i--; }
      else if (c.currentState !== 3) {
        const p = mulVec(c.updateShake(dt), c.PositionInfluence);
        const r = mulVec(c.updateShake(dt), c.RotationInfluence);
        pos = [pos[0] + p[0], pos[1] + p[1], pos[2] + p[2]];
        rot = [rot[0] + r[0], rot[1] + r[1], rot[2] + r[2]];
      }
    }
    this.posAddShake = pos; this.rotAddShake = rot;   // localPosition = shake + initial (0); localEulerAngles = rot
  }
  /** ShakeOnce (:84-93). */
  shakeOnce(magnitude, roughness, fadeInTime, fadeOutTime) {
    if (magnitude === 0) return null;
    const shake = new CameraShakeInstance(magnitude, roughness, fadeInTime, fadeOutTime, this.random);
    shake.PositionInfluence = [...DEFAULT_POS_INFLUENCE]; shake.RotationInfluence = [...DEFAULT_ROT_INFLUENCE];
    this.instances.push(shake);
    return shake;
  }
  get active() { return this.instances.length > 0; }
}

/** DamageShaker.RemoveHealth (:20-27): the SendMessage("RemoveHealth", amount) receiver. */
export function damageShake(shaker, s, amount, maxHealth) {
  if (!shaker || !(maxHealth > 0)) return;
  let shakeAmount = s.shakeAmountAdd + (s.shakeAmountMultiplier * amount / maxHealth);
  shakeAmount = Math.max(0, Math.min(s.maxShake, shakeAmount));
  shaker.shakeOnce(shakeAmount, s.roughness, s.fadeInTime, s.fadeOutTime);
}

/** The inverse of a rigid 4x4 (column-major): [R | t]^-1 = [R^T | -R^T t]. */
export function rigidInverse(m) {
  const r = new Float32Array(16);
  r[0] = m[0]; r[1] = m[4]; r[2] = m[8];
  r[4] = m[1]; r[5] = m[5]; r[6] = m[9];
  r[8] = m[2]; r[9] = m[6]; r[10] = m[10];
  r[12] = -(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]);
  r[13] = -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]);
  r[14] = -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14]);
  r[15] = 1;
  return r;
}
/** The shaker is the camera's PARENT (SetUpPlayer :41-49): a local offset and a local euler on the
 *  camera's own frame. In the port that is a rigid transform in VIEW space, folded into the view
 *  matrix the frame is drawn with; Unity's local +z is forward, the view's is -z. */
export function shakeView(view, pos, rotDeg) {
  if (!pos || (pos[0] === 0 && pos[1] === 0 && pos[2] === 0 && rotDeg[0] === 0 && rotDeg[1] === 0 && rotDeg[2] === 0)) return view;
  const local = trs(pos[0], pos[1], -pos[2], rotDeg[0], rotDeg[1], rotDeg[2]);
  return multiply(rigidInverse(local), view);
}

// --- Foggy dungeons (FoggyDungeonsMod.cs) -------------------------------------

/** System.Random (the .NET reference: Knuth's subtractive generator), as the
 *  mod seeds it with the dungeon's name. NextDouble is InternalSample / Int32.MaxValue. */
export class SystemRandom {
  constructor(seed) {
    const MBIG = 2147483647, MSEED = 161803398;
    this.seedArray = new Int32Array(56);
    const subtraction = seed === -2147483648 ? 2147483647 : Math.abs(seed | 0);
    let mj = (MSEED - subtraction) | 0;
    this.seedArray[55] = mj;
    let mk = 1;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this.seedArray[ii] = mk;
      mk = (mj - mk) | 0;
      if (mk < 0) mk = (mk + MBIG) | 0;
      mj = this.seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this.seedArray[i] = (this.seedArray[i] - this.seedArray[1 + (i + 30) % 55]) | 0;
        if (this.seedArray[i] < 0) this.seedArray[i] = (this.seedArray[i] + MBIG) | 0;
      }
    }
    this.inext = 0; this.inextp = 21;
  }
  internalSample() {
    const MBIG = 2147483647;
    let locINext = this.inext, locINextp = this.inextp;
    if (++locINext >= 56) locINext = 1;
    if (++locINextp >= 56) locINextp = 1;
    let retVal = (this.seedArray[locINext] - this.seedArray[locINextp]) | 0;
    if (retVal === MBIG) retVal--;
    if (retVal < 0) retVal = (retVal + MBIG) | 0;
    this.seedArray[locINext] = retVal;
    this.inext = locINext; this.inextp = locINextp;
    return retVal;
  }
  nextDouble() { return this.internalSample() * (1.0 / 2147483647); }
}

/** string.GetHashCode as Mono's corlib computes it (h = (h << 5) - h + c over
 *  the chars, two at a time, int32). Unity's runtime hash is not something the
 *  port can verify from outside; the colours are DETERMINISTIC per dungeon
 *  here as there, and may differ from a DFU player's for the same dungeon. */
export function monoStringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
/** DaggerfallDungeon's GameObject name (GameObjectHelper.CreateDaggerfallDungeonGameObject). */
export const dungeonGameObjectName = (regionName, name) => `DaggerfallDungeon [Region=${regionName}, Name=${name}]`;
const GREY = Object.freeze({ sky: [0.433, 0.433, 0.433], equator: [0.396, 0.396, 0.396], ground: [0.254, 0.254, 0.254] });   // :107-109
const lerp = (a, b, t) => a + t * (b - a);
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];   // Color.Lerp (t is 0..1 from the slider)
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** EnableDungeonFog (:86-114) as a pure function of the seed and the settings:
 *  { fog: {mode:'linear', density:0, start, end, color} | null, ambient: {sky, equator, ground} | null }. */
export function dungeonFogFor(dungeonName, s, { totalRandom = false, now = 0 } = {}) {
  const rnd = new SystemRandom(totalRandom ? monoStringHash(String(now)) : monoStringHash(dungeonName));
  const fogColor = [rnd.nextDouble(), rnd.nextDouble(), rnd.nextDouble()];
  let fog = null, ambient = null;
  if (s.enableFog) {
    const start = rnd.nextDouble() * (s.maxFogStart - s.minFogStart) + s.minFogStart;
    const end = rnd.nextDouble() * (s.maxFogDistance - s.minFogDistance) + s.minFogDistance + start;
    fog = { mode: 'linear', density: 0, start, end, color: scale3(fogColor, s.dungeonDarkness) };
  }
  if (s.enableAmbientLighting) {
    ambient = {
      sky: scale3(lerp3(GREY.sky, fogColor, s.ambientLerp), s.dungeonDarkness),
      equator: scale3(lerp3(GREY.equator, fogColor, s.ambientLerp), s.dungeonDarkness),
      ground: scale3(lerp3(GREY.ground, fogColor, s.ambientLerp), s.dungeonDarkness),
    };
  }
  return { fogColor, fog, ambient };
}

// --- Reverb (ReverbMod.cs) ------------------------------------------------------

/** UpdateReverbZone (:34-47): the level's AudioReverbPreset. */
export const REVERB_PRESETS = Object.freeze(['Cave', 'Stoneroom', 'Quarry']);   // level 0 Low, 1 Medium, 2 High
export const reverbPresetFor = (level) => REVERB_PRESETS[level] ?? null;

// --- The component ---------------------------------------------------------------

/**
 * The six modules as one component, driven by the four hosts.
 *   frame(dt, m) - once a frame; m = { inDungeon, inBuilding, entity, ...the footsteps' fields }
 *   view(view) - the camera shake folded into the frame's view matrix (after frame())
 *   removeHealth(amount, maxHealth) - the SendMessage("RemoveHealth") receiver
 *   onStartGame / onLoad / onTransition({ dungeon: {regionName, name, inCastle, exitPos} | null, building: bool })
 *   dungeonFog() / dungeonAmbient() - what FoggyDungeons set, or null
 *   classicClipKept(clip) / ownsStride() - DisableBuiltInFootsteps' answer for the classic component
 */
export const TRANSITION_WAIT_FRAMES = 4;   // "Wait some frames XD" - four yields in UpdateDungeonFog and UpdateAmbientSoundSources

export function createBetterAmbience({ audio = defaultAudio, settings = readBetterAmbienceSettings, random = Math.random, fetchClip = defaultFetchClip, weather = currentWeather, snowFree = isSnowFreeClimate } = {}) {
  let s = null;
  const footsteps = createBetterFootsteps({ audio, random, snowFree });
  const shaker = new CameraShaker(random);
  let clipsLoaded = false, loading = null, loadGen = 0;
  const present = new Set();
  let place = { dungeon: null, building: false };
  let fogState = null;            // FoggyDungeons' { fog, ambient } while inside a dungeon that is not a castle
  let reverbOn = null;            // the preset name the bus carries, or null
  let rainLoop = null;            // InteriorAmbientSoundSource's AudioSource
  let rainKind = null;            // 'interior' (2D) or 'exit' (3D at the dungeon exit)
  let rainWeather = null;         // currentWeatherType - UpdateSource on a change
  let waitFrames = -1;            // the coroutines' four-frame wait after a start, a load or a transition; -1 is nothing owed

  async function loadAudio() {
    const gen = ++loadGen;
    await Promise.all(baClipNames().map(async (name) => {
      if (present.has(name)) return;
      try {
        const bytes = await fetchClip(name);
        if (bytes && await audio.registerSound(baSoundKey(name), bytes)) present.add(name);
      } catch { /* TryImportAudioClip answers false */ }
    }));
    if (gen !== loadGen) return;
    footsteps.applyFootsteps(present);   // Start: DisableBuiltInFootsteps, AddComponent, ApplyFootsteps
    clipsLoaded = true;
  }
  const settle = () => (loading ? loading.then(() => undefined) : Promise.resolve());
  function syncSettings() {
    const next = settings();
    if (sameSettings(s, next)) return;
    s = next;
    footsteps.loadSettings(s);
    if (s.Enabled && !clipsLoaded && !loading) loading = loadAudio().finally(() => { loading = null; });
  }

  // ReverbMod.Update: on the inside-dungeon edge, UpdateReverbZone
  function updateReverb(inDungeon) {
    const want = s.Enabled && inDungeon ? reverbPresetFor(s.reverbLevel) : null;
    if (want === reverbOn) return;
    reverbOn = want;
    audio.setReverb?.(want);
  }
  // InteriorAmbientSoundSource: Start adds the source (2D in a building, 3D at the exit), Update follows the weather
  function stopRain() { if (rainLoop) { rainLoop.stop?.(); rainLoop = null; } rainWeather = null; }
  function updateAmbientSoundSources() {
    stopRain();
    if (!s.Enabled) { rainKind = null; return; }
    if (place.dungeon) rainKind = place.dungeon.exitPos ? 'exit' : null;   // GameObject.Find("DungeonExit") - none, no source
    else if (place.building) rainKind = 'interior';
    else rainKind = null;
  }
  function updateSource() {
    const w = weather();
    rainWeather = w;
    if (w === 'rain' || w === 'thunder') {   // WeatherType.Rain / Rain_Normal / Thunder
      if (!rainLoop && present.has(AMBIENT_RAIN_CLIP)) {
        rainLoop = rainKind === 'interior'
          ? audio.loop(baSoundKey(AMBIENT_RAIN_CLIP), 1, { lowpass: AMBIENT_RAIN_LOWPASS_HZ })
          : audio.loop3d(baSoundKey(AMBIENT_RAIN_CLIP), place.dungeon.exitPos, 1, { refDistance: 1, maxDistance: 500, distanceModel: 'inverse', lowpass: AMBIENT_RAIN_LOWPASS_HZ });
      }
    } else stopRain();
  }
  // FoggyDungeonsMod.UpdateDungeonFog: the settings re-read, then Enable or Disable
  function updateDungeonFog() {
    s = settings();
    const d = place.dungeon;
    const inCastle = typeof d?.inCastle === 'function' ? !!d.inCastle() : !!d?.inCastle;   // IsPlayerInsideDungeonCastle, read after the wait
    if (!s.Enabled || !d || inCastle) { fogState = null; return; }   // DisableDungeonFog: PlayerAmbientLight back on, flat ambient
    fogState = dungeonFogFor(dungeonGameObjectName(d.regionName ?? '', d.name ?? ''), s);
  }
  /** OnStartGame / OnLoad / the four transitions all StartCoroutine the same two waits; the frame pays them. */
  function owe() { waitFrames = TRANSITION_WAIT_FRAMES; }
  function settle4() { updateDungeonFog(); updateAmbientSoundSources(); }

  const api = {
    frame(dt, m) {
      syncSettings();
      if (waitFrames >= 0 && --waitFrames < 0) settle4();   // the fourth yield lands
      if (!s.Enabled) { if (reverbOn) updateReverb(false); if (rainLoop) stopRain(); fogState = null; return; }
      updateReverb(!!m.inDungeon);
      if (rainKind && rainWeather !== weather()) updateSource();
      shaker.update(Math.max(0, Number(dt) || 0));   // CameraShaker.Update
      if (s.footstepsEnable && clipsLoaded) footsteps.update(m);   // BetterFootstepsComponentPlayer.Update
    },
    view(view) { return s?.Enabled ? shakeView(view, shaker.posAddShake, shaker.rotAddShake) : view; },
    removeHealth(amount, maxHealth) { syncSettings(); if (s.Enabled) damageShake(shaker, s, amount, maxHealth); },
    onStartGame() { syncSettings(); owe(); },
    onLoad() { syncSettings(); owe(); },
    onTransition(next) { syncSettings(); place = { dungeon: next?.dungeon ?? null, building: !!next?.building }; fogState = null; stopRain(); owe(); footsteps.rebase(); },
    /** For the pins: the wait, paid at once. */
    settleTransition() { waitFrames = -1; settle4(); },
    dungeonFog() { return fogState?.fog ?? null; },
    dungeonAmbient() { return fogState?.ambient ?? null; },
    rebase() { footsteps.rebase(); },
    /** DisableBuiltInFootsteps has run: the classic stride is the mod's - except the two clips it forgot. */
    ownsStride() { return !!(s?.Enabled && s.footstepsEnable && clipsLoaded); },
    classicClipKept(clip) { return CLASSIC_CLIPS_KEPT.has(clip); },
    settle,
    footsteps, shaker,
    status() {
      return { enabled: !!s?.Enabled, footstepsOn: !!s?.footstepsEnable, clipsLoaded, present: [...present], place, fog: fogState, reverb: reverbOn, rain: rainLoop ? rainKind : null, rainWeather, shake: { pos: shaker.posAddShake, rot: shaker.rotAddShake, instances: shaker.instances.length } };
    },
  };
  return api;
}

/** One component, every host (HT1's shape). */
export const betterAmbience = createBetterAmbience();
// DamageShaker on the player object: the same RemoveHealth message the flash rides (DamageShaker.cs:20-27)
setRemoveHealthListener((amount) => betterAmbience.removeHealth(amount, playerEntity.maxHealth ?? 0));

/** The classic PlayerFootsteps' clip, gated by BOTH mods' DisableBuiltInFootsteps:
 *  Immersive Footsteps nulls every clip; Better Ambience nulls all but two. */
export function classicFootstepAllowed(clip) {
  if (immersiveFootsteps.ownsStride()) return false;
  if (betterAmbience.ownsStride()) return betterAmbience.classicClipKept(clip);
  return true;
}
