// Helpers shared across scenes: data fetch, texture archive names,
// season parsing, the time-aware sky controller (R4/R5), and the
// FOUR-HOST SEAMS (AUDIT 18). The host-gap rule: any law a motor host
// needs is EXTRACTED here and called by name from every host, so a
// feature can never land in one host and miss its three siblings -
// the shape that has recurred at every audit since 17h.

import { DFPalette } from '../formats/dfPalette.js';
import { ImgFile } from '../formats/imgFile.js';
import { SkyFile } from '../formats/skyFile.js';
import { SkyRenderer, buildDaySkyPanorama, buildNightSkyPanorama, buildFallbackSkyPanorama, nightSkyImageName } from '../render/skyRenderer.js';
import { SEASON } from '../world/climateSwaps.js';
import { skyFrameForTime } from '../world/worldClock.js';
import { hasActiveEffect } from '../systems/effects.js';
import { skillValue, SKILLS, SKILL_NAMES } from '../systems/skills.js';
import { tickPlayerMinutes } from '../systems/worldTick.js';
import { hasSpecialAbility, SPECIAL_ABILITY } from '../systems/rest.js';
import { liveStat } from '../systems/statMods.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../player/motor.js';
import { SOUND } from '../systems/soundClips.js';
import { surfacePlayer } from '../characters/playerEntity.js';
import { audio } from '../systems/audio.js';

import { getBytes } from './dataSource.js';


/** The data seam every scene uses - delegates to the ARENA2 data
 *  source (memory -> IndexedDB -> network); signature unchanged. */
export async function fetchBytes(name) {
  return getBytes(name);
}

export function parseSeason(params) {
  const s = (params.get('season') || 'summer').toLowerCase();
  if (s === 'winter') return SEASON.Winter;
  if (s === 'rain') return SEASON.Rain;
  return SEASON.Summer;
}

export function texName(archive) {
  return `TEXTURE.${String(archive).padStart(3, '0')}`;
}

/** DaggerfallSky.ApplyTimeAndSpace (:363-388) + LoadCurrentSky
 *  (:389-394), verbatim: "Disable clear night sky for bad weather" -
 *  showNightSky is false whenever WeatherStyle != Normal (WeatherManager
 *  .cs:235/:237 Rain1/Rain2, :286/:288 Snow1/Snow2), SkyFrame is 0 at
 *  night, and LoadCurrentSky then takes the DAY branch. The port showed
 *  NITE for every night minute with no weather test, so a rainy or
 *  snowy night drew a clear starfield DFU never shows.
 *  @returns {number|null} the day-sky frame, or null for the night sky. */
export function skyFrameForWeatherTime(minuteOfDay, showNightSky = true) {
  const frame = skyFrameForTime(minuteOfDay);
  if (frame === null && !showNightSky) return 0;   // SkyFrame = 0, day branch
  return frame;
}

// Time-aware sky controller: swaps the panorama when the (skyIndex, frame or
// night) key changes. Explicit ?skyframe / ?window override the clock
// (R2/R4 demo compatibility); otherwise the world clock decides.
export function createSkyController(gl, params) {
  const sky = new SkyRenderer(gl);
  const panoramas = new Map(); // "index:frame" | "index:night" -> panorama
  const skyFiles = new Map();
  let activeKey = '';
  let pending = null;
  // DaggerfallSky.cs:74 - ONE System.Random(0) for the component's
  // life, so a second night sky continues the same star sequence.
  const starRandom = new NetRandom(0);

  async function buildPanorama(skyIndex, frame) {
    if (frame === null) {
      const name = nightSkyImageName(skyIndex);
      const img = new ImgFile();
      img.load(await fetchBytes(name), name);
      const pal = new DFPalette();
      pal.load(await fetchBytes(img.paletteName), img.paletteName);
      img.palette = pal;
      // LoadVanillaNightSky's star pass runs on the palette-INDEX
      // bitmap, BETWEEN GetDFBitmap and GetColor32 (DaggerfallSky.cs
      // :586-603) - ShowStars defaults true.
      return buildNightSkyPanorama(
        img.getColor32(applyNightStars(img.getDFBitmap(0, 0), starRandom), -1));
    }
    if (!skyFiles.has(skyIndex)) {
      const name = SkyFile.indexToFileName(skyIndex);
      try {
        const f = new SkyFile();
        f.load(await fetchBytes(name), name);
        skyFiles.set(skyIndex, f);
      } catch {
        // The mobile lean diet excludes the 247MB sky set - a missing
        // SKY??.DAT degrades to the gradient, never to a crash
        // (2026-08-14; full desktop sets never hit this).
        console.warn(`${name} unavailable - gradient sky fallback`);
        skyFiles.set(skyIndex, null);
      }
    }
    const sf = skyFiles.get(skyIndex);
    return sf ? buildDaySkyPanorama(sf, frame) : buildFallbackSkyPanorama();
  }

  return {
    renderer: sky,
    /** Ensure the panorama for (skyIndex, minuteOfDay); async, frame-late. */
    use(skyIndex, minuteOfDay, showNightSky = true) {
      let frame = params.has('window')
        ? (params.get('window') === 'night' ? null : Number(params.get('skyframe') ?? 31))
        : skyFrameForWeatherTime(minuteOfDay, showNightSky);
      if (params.has('skyframe')) frame = Number(params.get('skyframe'));
      const key = `${skyIndex}:${frame === null ? 'night' : frame}`;
      if (key === activeKey || key === pending) return;
      pending = key;
      const cached = panoramas.get(key);
      const apply = (pano) => {
        if (pending !== key) return;
        panoramas.set(key, pano);
        sky.setPanorama(pano);
        activeKey = key;
        pending = null;
      };
      if (cached) apply(cached);
      else buildPanorama(skyIndex, frame).then(apply);
    },
    draw(yaw, pitch, fovY, aspect) {
      sky.draw(yaw, pitch, fovY, aspect);
    },
  };
}


// =====================================================================
// THE FOUR-HOST SEAMS (AUDIT 18)
// world.js (?world streaming), exterior.js (?exterior), dungeon.js
// (?dungeon) and worldModes.js (the modal machine both exterior hosts
// mount) are parallel motor hosts. Every law below used to live in ONE
// of them; each omission was a live bug. They are extracted so a host
// cannot half-apply them again - test/audit18_hosts_outer.test.js
// source-sweeps the hosts for each call by name.
// =====================================================================

/** PlayerMotor's stats seam, LIVE (PlayerSpeedChanger.cs:389/:400/:418).
 *  DFU reads player.Stats.LiveSpeed and GetLiveSkillValue(Running /
 *  Swimming) on EVERY GetWalkSpeed/GetRunSpeed/GetSwimSpeed call, and
 *  PlayerMotor.UpdateSpeed calls GetBaseSpeed every FixedUpdate - so a
 *  rolled, fortified or drained Speed moves the player immediately.
 *  Every host passed `undefined` here, which took the motor's
 *  hardcoded 50/30/30 default for the whole session.
 *
 *  The pre-chargen guard is load-bearing: playerEntity's INTERIM
 *  entity carries no `speed` key (characters/playerEntity.js), and an
 *  unguarded liveStat() would walk a fresh boot at (0 + 150 - 35)/39.5
 *  instead of the documented SPD-50 stand-in. */
export function motorStats(entity) {
  return {
    get speed() { return entity.stats?.speed != null ? liveStat(entity, 'speed') : 50; },
    get running() { return skillValue(entity, SKILLS.Running); },
    get swimming() { return skillValue(entity, SKILLS.Swimming); },
  };
}

/** The effect-driven motor flags OUTSIDE a dungeon (Levitate.cs:131/:136
 *  sets LevitateMotor.IsLevitating on the effect's Start AND End, so
 *  the EFFECT owns the flag - it survives every transition and clears
 *  when the spell expires, indoors or out). Swimming is the exception:
 *  PlayerEnterExit.IsPlayerSwimming is recomputed from the block water
 *  level, and an exterior/interior shell has none, so it is false.
 *
 *  Before this, all four flags were written only inside the dungeon
 *  branch and never cleared: leaving a dungeon while levitating left
 *  the motor in its no-gravity branch forever. */
export function applyMotorEffectFlags(player, entity, { waterSurfaceY = null } = {}) {
  player.waterSurfaceY = waterSurfaceY;
  player.swimming = false;
  player.levitating = hasActiveEffect(entity, 'levitate');
  player.waterWalking = hasActiveEffect(entity, 'waterWalking');
  player.slowFalling = hasActiveEffect(entity, 'slowfall');
}

/** Platform riding (DFU's MoveWithMovingPlatform shape): standing on a
 *  mover applies its frame delta through the resolver BEFORE the
 *  player's own move. Was wired only into the standalone ?dungeon
 *  scene, so a world/exterior-hosted dungeon dropped the delta and the
 *  lift penetrated the capsule (the out-of-bounds ejection report). */
export function ridePlatform(player, actions) {
  const gk = player.groundKey;
  if (!gk || gk === 'dungeon') return;
  const d = actions?.objects?.get(gk)?.frameDelta;
  if (d && (d[0] || d[1] || d[2])) player.collider.move(player.pos, d[0], d[1], d[2]);
}

/** AcrobatMotor.AdjustFallStart (:231-237), called by
 *  FloatingOrigin.OffsetPlayerController (:176-181) in the same breath
 *  as the position shift: "Call this when floating origin ticks on Y
 *  to ensure player doesn't die by jumping right at threshold". The
 *  `falling` guard is verbatim - an unconditional add would corrupt a
 *  grounded motor's stale fallStart. */
export function adjustFallStart(player, y) {
  if (player.falling) player.fallStart += y;
}

/** FloatingOrigin.OnPositionUpdate / PositionUpdate.cs: anything
 *  holding a WORLD position must follow the origin. ArrowFlight has no
 *  offsetAll of its own, and the host's `arrows.offsetAll?.(offset)`
 *  was a permanent no-op that stranded every in-flight arrow 819.2
 *  units behind the world. */
export function offsetArrows(arrows, offset) {
  for (const a of arrows.arrows) {
    a.pos[0] += offset[0]; a.pos[1] += offset[1]; a.pos[2] += offset[2];
  }
}

/** StreamingWorld.cs:771-781 adds PopulationManager to exactly seven
 *  LocationTypes (DFRegion.cs:66-86): TownCity 0, TownHamlet 1,
 *  TownVillage 2, HomeFarms 3, ReligionTemple 5, Tavern 6,
 *  HomeWealthy 8. The streaming host had the table inline; the
 *  ?exterior host had no gate at all and gave graveyards, covens,
 *  keeps and ruins a wandering population DFU never creates. */
export const POPULATED_LOCATION_TYPES = Object.freeze(new Set([0, 1, 2, 3, 5, 6, 8]));

export const populatesWanderingNpcs = (locationType) => POPULATED_LOCATION_TYPES.has(locationType);

// --- The night-sky star pass (DaggerfallSky.cs:565-600) --------------

// .NET System.Random, the seeded Knuth subtractive generator, ported
// byte-exact. DaggerfallSky holds `new System.Random(0)` (:74) and the
// star placement is a pure function of that sequence, so substituting
// a different generator paints different stars - this is a DATA law,
// not an engine detail, and the Ledger's engine-PRNG row (which covers
// UnityEngine.Random) does not cover it.
const MBIG = 2147483647;   // int.MaxValue
const MSEED = 161803398;

export class NetRandom {
  constructor(seed = 0) {
    this._seedArray = new Int32Array(56);
    const subtraction = seed === -2147483648 ? MBIG : Math.abs(seed);
    let mj = MSEED - subtraction;
    this._seedArray[55] = mj;
    let mk = 1;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this._seedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += MBIG;
      mj = this._seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this._seedArray[i] -= this._seedArray[1 + ((i + 30) % 55)];
        if (this._seedArray[i] < 0) this._seedArray[i] += MBIG;
      }
    }
    this._inext = 0;
    this._inextp = 21;
  }

  /** Random.InternalSample */
  _internalSample() {
    let locINext = this._inext;
    let locINextp = this._inextp;
    if (++locINext >= 56) locINext = 1;
    if (++locINextp >= 56) locINextp = 1;
    let retVal = this._seedArray[locINext] - this._seedArray[locINextp];
    if (retVal === MBIG) retVal--;
    if (retVal < 0) retVal += MBIG;
    this._seedArray[locINext] = retVal;
    this._inext = locINext;
    this._inextp = locINextp;
    return retVal;
  }

  /** Random.Sample / Random.NextDouble */
  nextDouble() {
    return this._internalSample() * (1.0 / MBIG);
  }

  /** Random.Next(minValue, maxValue), small-range arm. */
  next(minValue, maxValue) {
    const range = maxValue - minValue;
    return Math.trunc(this.nextDouble() * range) + minValue;
  }
}

/** DaggerfallSky.cs:78-79 */
export const STAR_CHANCE = 0.004;
export const STAR_COLOR_INDICES = Object.freeze([16, 32, 74, 105, 112, 120]);

/** LoadVanillaNightSky's star pass (DaggerfallSky.cs:588-600), verbatim.
 *  Runs on the palette-INDEX bitmap between GetDFBitmap and GetColor32:
 *  a texel is a star candidate only where `index > 16 && index < 32`
 *  ("clear sky indices"). NITE02I0.IMG has ~89.6k eligible texels, so
 *  DFU paints a few hundred stars per night sky and the port painted
 *  none. Mutates in place exactly as DFU does (the port's ImgFile
 *  decodes into a fresh Uint8Array per instance, and the controller
 *  builds a new ImgFile per panorama, so nothing cached is touched). */
export function applyNightStars(bmp, random) {
  const data = bmp.data;
  if (!data) return bmp;   // emptyBitmap() - getColor32 already tolerates it
  for (let i = 0; i < data.length; i++) {
    const index = data[i];
    if (index > 16 && index < 32) {
      if (random.nextDouble() < STAR_CHANCE) {
        data[i] = STAR_COLOR_INDICES[random.next(0, STAR_COLOR_INDICES.length)];
      }
    }
  }
  return bmp;
}

/** AcrobatMotor.CheckFallingDamage (:214-222) + PlayerHealth
 *  .ApplyPlayerFallDamage, verbatim: past fallingDamageThreshold the
 *  fall bills HPPerMetre * (distance - threshold), truncated; past
 *  half the threshold it is only a BadFallDetected alert.
 *
 *  This law was written out three times (world.js, exterior.js,
 *  dungeonContext.js) and MISSING from the interior mode of
 *  worldModes, whose flag claimed "single-story shells cannot fall
 *  2.5+" - false on the real corpus (1701 interiors carry ladder
 *  markers 2.5-3.2 m apart). `hurt` is injected because the dungeon
 *  host routes damage through hurtPlayer (which mints the death
 *  screen) while the exterior hosts assign health directly - that
 *  difference is preserved, not unified. */
export function applyFallLanding(entity, distance, { hurt = null, sound = null } = {}) {
  if (distance > FALL_DAMAGE_THRESHOLD) {
    const dmg = Math.trunc(FALL_HP_PER_METRE * (distance - FALL_DAMAGE_THRESHOLD));
    if (hurt) hurt(dmg);
    else { entity.health = Math.max(0, entity.health - dmg); surfacePlayer(); }
    sound?.(SOUND.FallDamage);
  } else if (distance > FALL_DAMAGE_THRESHOLD / 2) {
    sound?.(SOUND.FallHard);   // BadFallDetected
  }
}

// --- The audio bootstrap ---------------------------------------------

/** AUDIT 18 HOST GAP: `audio` is a module singleton whose `enabled`
 *  flag is set ONLY inside init(), and every play call is a silent
 *  no-op until then. init() was called from exactly one place -
 *  buildDungeonContext - so ?world and ?exterior were completely
 *  silent (swings, fall damage, animal ambience, rain, guards) until
 *  the player entered a dungeon, after which the exterior suddenly had
 *  sound. DFU has no per-scene sound bootstrap: DaggerfallAudioSource
 *  and SoundReader are global, and AmbientEffectsPlayer.Start (:77-88)
 *  runs on the exterior prefab, so the exterior is audible from frame
 *  one. Idempotent, so a host may call it unconditionally.
 *
 *  The booted flag lives on the ENGINE (AudioEngine.ensure), not here:
 *  AUDIT 18 fixed this gap twice independently, and two bootstraps with
 *  two flags is the duplicate-port shape this project keeps catching. This
 *  is the host-facing name for that one seam. */
export function ensureAudio(fetch = fetchBytes) { return audio.ensure(fetch); }

// --- The outdoor fog COLOUR (DaggerfallSky.SetSkyFogColor) -----------

/** WeatherManager.RainyFogSettings.density (:0.003f) - the threshold
 *  DaggerfallSky.cs:322 compares against. */
export const RAINY_FOG_DENSITY = 0.003;

/** Unity's Color.gray. */
export const GRAY_FOG_COLOR = Object.freeze([0.5, 0.5, 0.5]);

/** DaggerfallSky.SetSkyFogColor (:310-330), verbatim:
 *    if (currentFogSettings.fogMode == FogMode.Exponential &&
 *        currentFogSettings.density > rainyFogSettings.density)
 *      RenderSettings.fogColor = Color.gray;
 *    else
 *      RenderSettings.fogColor = cameraClearColor;
 *  i.e. "gray fog for anything denser than heavy rain". That covers
 *  Snowy (0.005) and Heavy/fog (0.05) but NOT Rainy (0.003, which is
 *  not > itself) or the linear sunny/overcast settings. Both exterior
 *  hosts passed the sky colour unconditionally, so a blizzard and a
 *  pea-souper fogged to a blue sky tint. */
export function outdoorFogColor(fogSettings, skyClearColor) {
  if (fogSettings.mode === 'exp' && fogSettings.density > RAINY_FOG_DENSITY) {
    return GRAY_FOG_COLOR;
  }
  return skyClearColor;
}

// --- The player's world clock, for every host (AUDIT 18) --------------

/**
 * AUDIT 18 HOST GAP: the per-classic-minute player tick ran ONLY inside
 * dungeonContext's frame body. Above ground nothing aged - magic effects
 * never expired, diseases never advanced a day, poisons never fired a
 * round, fatigue never drained, and raiseSkills never ran, so a
 * character who stayed out of dungeons NEVER ADVANCED A SKILL OR GAINED
 * A LEVEL. DFU splits none of this by scene: EntityEffectBroker raises
 * MagicRound on a global interval and PlayerEntity.Update runs the
 * fatigue and advancement path wherever the player is.
 *
 * The law itself lives in systems/worldTick.js, where it is testable.
 * This is the per-host carrier: it owns the minute accumulator and the
 * sink set, so a host adds the whole tick with one call.
 */
export function createPlayerTicker(entity, { say = () => {}, onLevelUp = null } = {}) {
  let classicMinutes = 0;
  const sinks = {
    hurt: (n) => { if (n > 0) entity.health = Math.max(0, (entity.health ?? 0) - n); },
    heal: (n) => { if (n > 0) entity.health = Math.min(entity.maxHealth ?? Infinity, (entity.health ?? 0) + n); },
    drainMagicka: (n) => { if (n > 0) entity.magicka = Math.max(0, (entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) entity.magicka = Math.min(entity.maxMagicka ?? Infinity, (entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) entity.fatigue = Math.max(0, (entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) entity.fatigue = (entity.fatigue ?? 0) + n; },
    say,
  };
  return {
    get classicMinutes() { return classicMinutes; },
    tick(dt, activity = { running: false, swimming: false }) {
      const r = tickPlayerMinutes({
        entity, classicMinutes, dt, sinks, activity,
        fatigueMultiplier: fatigueLossMultiplierFor(entity),
        say, onLevelUp,
      });
      classicMinutes = r.classicMinutes;
      for (const id of r.raised) say(`Your ${SKILL_NAMES[id]} skill has improved.`);
      return r;
    },
  };
}

/** PlayerEntity.cs:388-400 - Athleticism loses fatigue 10% slower. */
export function fatigueLossMultiplierFor(entity) {
  return hasSpecialAbility(entity?.career, SPECIAL_ABILITY.Athleticism) ? 0.9 : 1.0;
}
