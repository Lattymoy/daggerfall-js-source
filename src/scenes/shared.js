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
import { hasActiveEffect, isBlending, isInvisible, isAShade } from '../systems/effects.js';
import { skillValue, tallySkill, SKILLS, SKILL_NAMES } from '../systems/skills.js';
import { DOOR_SPELL_TEXT } from '../systems/mysticism.js';   // X1: the door-spell alert lines
import { raiseSkills } from '../systems/advancement.js';   // AUDIT 23 (entity-1): the rest-end raise
import { tickPlayerMinutes, runMagicRoundsFor, worldMinutes, setWorldMinutes, CLASSIC_MINUTES_PER_SECOND } from '../systems/worldTick.js';
import { killIfAnyLiveStatZero } from '../systems/statMods.js';   // AUDIT 24 (wave 32): the per-entity laws a foe pool owes
import { decayEnemyAlert } from '../systems/encounters.js';   // AUDIT 24 (wave 36): PlayerEntity.Update's 8-hour decay, in every context
import { hasSpecialAbility, SPECIAL_ABILITY } from '../systems/rest.js';
import { createNearbyScan, updateNearbyObjects, detectedMarkers, hasLiveDetector } from '../systems/nearbyObjects.js';   // X4: the Detect scan
import { liveStat, maxFatigue } from '../systems/statMods.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../player/motor.js';
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage
import { SOUND } from '../systems/soundClips.js';
import { surfacePlayer, hurtPlayer } from '../characters/playerEntity.js';
import { music } from '../systems/music.js';
import { SongManager, musicEnvironment, holdEnvironment } from '../systems/songManager.js';
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
  // "index:frame" | "index:night" -> panorama, LRU-BOUNDED.
  //
  // AUDIT 24 (the seven-slice sweep): this Map had no eviction at all.
  // Each entry's `colors` is the full CPU pixel buffer -
  // SKY_FRAME_WIDTH 512 doubled by SKY_FRAME_HEIGHT 220 at RGBA, i.e.
  // 1024 * 220 * 4 = 901,120 bytes - and the key space is 32 day
  // frames plus night PER SKY INDEX, so one region's sky alone reaches
  // ~29 MB as the day advances and every weather or region change
  // starts another. DFU holds no such cache: DaggerfallSky rebuilds
  // its texture on each frame change and keeps only the current one.
  // The cache is the port's own speed trade, so it keeps a bound
  // instead of the source's zero - the day advances one frame at a
  // time and never revisits, so the only hits that matter are the
  // immediate neighbours and the night/day toggle.
  const PANORAMA_CACHE_MAX = 4;
  const panoramas = new Map();
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
        // delete-then-set refreshes the entry's place in the Map's
        // insertion order, which is the LRU order we evict from
        panoramas.delete(key);
        panoramas.set(key, pano);
        while (panoramas.size > PANORAMA_CACHE_MAX) {
          panoramas.delete(panoramas.keys().next().value);
        }
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

/** M3 CLIMBING: the ClimbingState deps every host wires the same way.
 *  inputs = CalculateClimbingChance's reads (live Climbing, live
 *  Luck, the Khajiit racial arm; the Climbing effect pends - the
 *  `enhanced` seam is here); tally = ClimbingSkillCheck's
 *  TallySkill(Climbing, 1), once per check. The pre-chargen guard
 *  mirrors motorStats (the INTERIM entity carries no stats). */
export function climbingDeps(entity, say = null) {
  return {
    inputs: () => ({
      climbing: skillValue(entity, SKILLS.Climbing),
      luck: entity.stats?.luck != null ? liveStat(entity, 'luck') : 50,
      khajiit: entity.race === 'Khajiit',
      // X1: the Climbing SPELL - "target can climb twice as well",
      // which DFU applies by DOUBLING the effective skill after the
      // racial bonus (FormulaHelper.cs:304-306) and doubling climb
      // speed (PlayerSpeedChanger.cs:428). Both ride climbing.js's
      // `enhanced`, which was hardcoded false waiting for this.
      enhanced: !!entity?.activeEffects?.some((a) => a.kind === 'climbing'),
    }),
    tally: () => tallySkill(entity, SKILLS.Climbing),
    say,
  };
}

/** X4: the DETECT feed - one nearby-objects scan per host, shared so
 *  the four hosts cannot each grow their own (which is how the port
 *  ended up with world.js's lone nearbyFoes measuring range with an
 *  INCLUSIVE `<=` where PlayerGPS is strict).
 *
 *  DFU keeps PlayerGPS's list warm unconditionally, for every system
 *  that reads it. The port gates the rebuild on a live detector: the
 *  scan has no other consumer wired yet, and a rebuild nothing reads
 *  is pure per-frame cost. The moment dispelNearby or the enchantment
 *  affinity arms are fed from here, that gate comes off - it is a
 *  performance choice, not a law, and is marked as one.
 *
 *  entities()/loot() answer the host's OWN live pools; the adapters
 *  below turn the port's standard foe and loot-pile shapes into the
 *  NearbyObject record. feet() is the player's position AT THE
 *  REBUILD, which is what PlayerGPS measures every distance from.
 */
export function createDetectFeed(entity, { entities = () => [], loot = () => [], feet = () => [0, 0, 0] } = {}) {
  const scan = createNearbyScan(() =>
    updateNearbyObjects(feet(), { entities: entities(), loot: loot() }));
  let markers = [];
  return {
    tick(dt) {
      if (!hasLiveDetector(entity)) {
        // No detector: drop the list rather than let a stale one sit.
        // DFU has no equivalent because it never stops scanning, but
        // a port that DOES stop must not resume from a stale snapshot.
        if (markers.length) { scan.reset(); markers = []; }
        return markers;
      }
      markers = detectedMarkers(entity, scan.tick(dt));
      return markers;
    },
    get markers() { return markers; },
    /** A scene transition: the previous scene's objects are gone. */
    reset() { scan.reset(); markers = []; },
    /** X9: a FRESH scan on demand, bypassing both the 0.33s cadence
     *  and the live-detector gate. Dispel is a one-shot at cast, and
     *  DFU reads PlayerGPS's list at that instant - a list the port
     *  only keeps warm while a Detect spell is running, so a dispel
     *  cast with no detector up would otherwise read an empty or
     *  stale one. Rebuilding here is the honest equivalent of DFU
     *  always having a warm list. */
    scanNow() {
      return updateNearbyObjects(feet(), { entities: entities(), loot: loot() });
    },
  };
}

/** The port's standard foe record -> a NearbyObject entity record.
 *  A DEAD foe is dropped rather than passed as inactive: DFU's
 *  GetActiveEnemyBehaviours walks live behaviours, and a corpse's
 *  loot pile is what carries the Treasure bit afterwards. */
export const foeNearbyRecord = (f) => ({
  ref: f,
  pos: f?.ai?.feet,
  mobileType: f?.mobileType ?? f?.entity?.mobileType ?? 128,
  effectCount: (f?.entity?.activeEffects ?? []).filter((a) => !a.ended).length,
});

/** A dungeon loot pile -> a NearbyObject loot record. */
export const lootNearbyRecord = (p) => ({
  ref: p,
  pos: p?.pos,
  itemCount: (p?.items ?? []).length,
});

/** X1: the ARMED Open/Lock spell a host hands to actions.activate.
 *  Answers null when nothing is armed. Open wins if both are somehow
 *  armed (it is the one that can still fail on the lock).
 *
 *  X3: the level travels LIVE. Both triggers read
 *  manager.EntityBehaviour.Entity.Level at the door (Open.cs:118,
 *  Lock.cs:116) - the HOLDER of the armed effect, whatever their level
 *  is when they touch it - and neither AddState stores anything, so
 *  there is no cast-time level to carry. Reading it here, per
 *  activation, is that read. */
export function doorSpellFor(entity) {
  const find = (k) => entity?.activeEffects?.find((a) => a.kind === k && !a.ended);
  const open = find('openArmed');
  const lock = open ? null : find('lockArmed');
  const armed = open ?? lock;
  if (!armed) return null;
  return {
    kind: open ? 'open' : 'lock',
    holderLevel: entity?.level ?? 1,
    // FLAGGED: the Skeleton's Key artifact (IsArtifact + world texture
    // 432/20, Open.cs:176-180) bypasses the level test on INTERIOR
    // doors only - the exterior arm checks the level regardless
    // (Open.cs:142). The port has no artifact identity yet, so no
    // item can claim it.
    skeletonKey: false,
  };
}

/** Drop the armed entry once a door has consumed it - DFU's
 *  CancelEffect on the trigger (Open.cs:166-170, Lock.cs:135-139). */
export function consumeDoorSpell(entity, kind) {
  const want = kind === 'open' ? 'openArmed' : 'lockArmed';
  if (!entity?.activeEffects) return;
  const i = entity.activeEffects.findIndex((a) => a.kind === want);
  if (i >= 0) entity.activeEffects.splice(i, 1);
}

/** Wire the outcome line + the consume onto one ActionSystem. */
export function wireDoorSpells(actions, entity, say) {
  actions.onDoorSpell = (_o, kind, result) => {
    if (result?.alert) say?.(DOOR_SPELL_TEXT[result.alert] ?? '');
    consumeDoorSpell(entity, kind);
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
    // AUDIT 21 (hosts lane, F6): the no-`hurt` arm went through the ONE
    // damage door now, so a fatal fall outdoors or in a building raises the
    // death screen instead of leaving you walking around at 0 HP.
    if (hurt) hurt(dmg);
    else hurtPlayer(entity, dmg);
    // AUDIT 24 (wave 39): PlayerHealth.ApplyPlayerFallDamage calls
    // RemoveHealth (:57), which is ShowPlayerDamage.Flash's only
    // trigger. A fall flashes the screen; a poison does not.
    flashPlayerDamage();
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
 *  is the host-facing name for that one seam.
 *
 *  A5: MUSIC BOOTS HERE TOO, for exactly the same reason. A separate
 *  music bootstrap would be a second thing every host has to remember,
 *  which is the gap F6 closed - so the seam that already reaches all
 *  four hosts carries both. MusicService.ensure keeps its own flag, is
 *  idempotent, and disables itself quietly if MIDI.BSA will not load. */
export function ensureAudio(fetch = fetchBytes) {
  const sound = audio.ensure(fetch);
  const songs = music.ensure(fetch);
  return Promise.all([sound, songs]);
}

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
/** AUDIT 23 (entity-1) - DaggerfallRestWindow.cs:729-732: skills raise
 *  when the rest-finished popup CLOSES, and only there (PlayerEntity.
 *  Update runs no advancement; DaggerfallTravelPopUp.cs:380 is the
 *  other site, unported). Hosts hand this to their RestWindow deps as
 *  onRestFinished. */
export function raiseAtRestEnd(entity, { say = () => {}, onLevelUp = null, rolls = Math.random } = {}) {
  const raised = raiseSkills(entity, Math.floor(worldMinutes()), rolls, onLevelUp) ?? [];
  for (const id of raised) say(`Your ${SKILL_NAMES[id]} skill has improved.`);
  return raised;
}

export function createPlayerTicker(entity, { say = () => {}, onLevelUp = null, onExhausted = null } = {}) {
  // AUDIT 21 F2: a VIEW on the one world clock, not an owner. This used to
  // close over its own accumulator, so the three hosts that build a ticker -
  // world, exterior, worldModes - each counted from zero and only while
  // their own mode ran. Walking through a door rewound time.

  const sinks = {
    // AUDIT 21 (hosts lane, F6): through the one damage door - disease,
    // poison and continuous-damage effects can kill you, and above ground
    // they used to do it silently.
    hurt: (n) => hurtPlayer(entity, n),
    heal: (n) => { if (n > 0) entity.health = Math.min(entity.maxHealth ?? Infinity, (entity.health ?? 0) + n); },
    drainMagicka: (n) => { if (n > 0) entity.magicka = Math.max(0, (entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) entity.magicka = Math.min(entity.maxMagicka ?? Infinity, (entity.magicka ?? 0) + n); },
    drainFatigue: (n) => {
      if (n <= 0) return;
      entity.fatigue = Math.max(0, (entity.fatigue ?? 0) - n);
      // AUDIT 23 (C5: hosts-5 = entity-3) - DaggerfallEntity.cs:360-366:
      // EVERY fatigue write clamps and, at 0 with health left, raises
      // OnExhausted - the collapse was dungeon-only; the host passes
      // its presenter (rest-hour-or-death via exhaustionOutcome).
      if (entity.fatigue <= 0 && (entity.health ?? 0) > 0) onExhausted?.();
    },
    restoreFatigue: (n) => { if (n > 0) entity.fatigue = Math.min(maxFatigue(entity), (entity.fatigue ?? 0) + n); },   // C5: the MaxFatigue clamp
    say,
  };
  // AUDIT 24 (wave 32) - THE BROKER'S SUBSCRIBERS. EntityEffectBroker raises
  // OnNewMagicRound and EVERY EntityEffectManager in the scene handles it, one
  // per entity; the port had a subscriber for the player and, in the dungeon
  // only, an ad-hoc loop for the foes. Above ground nothing ticked a foe's
  // effects at all. The ticker claims the window once (that is the broker) and
  // fans it out here, so a pool cannot be forgotten by a host that forgot to
  // add a line to its frame body.
  const subscribers = [];

  return {
    get classicMinutes() { return worldMinutes(); },
    /** Register a foe pool. fn(from, to, dt) - the claimed magic-round window
     *  and the real seconds this tick covered. Returns an unsubscribe. */
    subscribe(fn) {
      subscribers.push(fn);
      return () => { const i = subscribers.indexOf(fn); if (i >= 0) subscribers.splice(i, 1); };
    },
    /** AUDIT 24 (wave 30): the host's ONE set of player sinks, exposed
     *  because the tick is not their only consumer - a monster's
     *  special-attack rider (OnMonsterHit's nymph/lamia FatigueDamage)
     *  drains through exactly these doors, exhaustion presenter and
     *  all, and a pool that built its own would miss the collapse. */
    get sinks() { return sinks; },
    tick(dt, activity = { running: false, swimming: false }) {
      const r = tickPlayerMinutes({
        entity, classicMinutes: worldMinutes(), dt, sinks, activity,
        fatigueMultiplier: fatigueLossMultiplierFor(entity),
        say,
      });
      setWorldMinutes(r.classicMinutes);
      // AUDIT 24 (wave 36): PlayerEntity.Update:380-384 lowers the enemy
      // alert eight hours after it was raised, in EVERY context - it is
      // the entity update, not a dungeon law. The port called it from
      // the dungeon frame body alone, so an alert raised above ground
      // (exteriorFoes has raised one since the X-slice) never decayed,
      // and permanently armed the dungeon's random-spawn roll.
      decayEnemyAlert(entity, r.classicMinutes);
      for (const fn of subscribers) fn(r.magicRoundWindow.from, r.magicRoundWindow.to, dt);
      return r;
    },
    /** U24: DaggerfallDateTime.RaiseTime. Guild training eats three
     *  hours of the day, and a jump that only moved the counter would
     *  skip every magic round and disease day
     *  inside it. Running the SAME tick with the equivalent dt is what
     *  makes the jump real: DFU's clock and its per-minute laws are
     *  the same loop, so a rest, a training session and a fast travel
     *  all owe the world those minutes. The once-per-minute-change
     *  fatigue drain still fires once, exactly as it does in DFU
     *  across a jump, which is why the callers that need a session's
     *  worth of fatigue charge it explicitly. */
    advance(minutes) {
      if (!(minutes > 0)) return null;
      return this.tick(minutes / CLASSIC_MINUTES_PER_SECOND);
    },
  };
}

/**
 * Hand a ticker one or more foe pools, so every entity in them gets the
 * per-entity laws DFU gives it through its own EntityEffectManager:
 * the magic round (diseases, poisons, active effects) on the window the
 * broker claimed, and UpdateEntityMods' stat-zero kill on its own real-time
 * cadence.
 *
 * AUDIT 24 (wave 32). Before this, `tickActiveEffects` and `updatePoisons`
 * were called for foes in exactly ONE place in src/ - the dungeon host - so
 * above ground a foe's Continuous Damage never took a round, its poison never
 * fired, and a paralysed encounter foe stayed paralysed for good. The dungeon
 * host keeps its own inline arm because it owns its foe list inside a closure
 * that is not built by createPlayerTicker.
 *
 * @param {object} ticker      a createPlayerTicker
 * @param {Function[]} pools   each returns the pool's live list of foes
 * @param {Function} sinksFor  (foe) => that foe's damage/drain doors
 */
export function subscribeFoePools(ticker, pools, sinksFor) {
  return ticker.subscribe((from, to, dt) => {
    for (const pool of pools) {
      for (const f of pool() ?? []) {
        if (!f || f.dead || !f.entity) continue;
        const sinks = sinksFor(f);
        runMagicRoundsFor(f.entity, from, to, { sinks });
        killIfAnyLiveStatZero(f.entity, sinks, dt);
      }
    }
  });
}

/**
 * THE SENSES CONTEXT every foe pool owes its foes - EnemySenses'
 * StealthCheck (:618-657) and BlockedByIllusionEffect (:659-684), which
 * are not dungeon laws and have no dungeon gate in DFU.
 *
 * AUDIT 24 (wave 36). The dungeon host built all eight fields; the three
 * exterior call sites passed `{ playerInvisible }` and nothing else, and
 * that one object was three separate failures above ground:
 *   - `playerBlending` and `playerShade` read false, so Chameleon and
 *     Shade did nothing at all outside a dungeon;
 *   - `playerStealth` defaulted to 0, so `Dice100.FailedRoll(chance)`
 *     computed from skill 0 detected you whatever your Stealth, and no
 *     Stealth tally ever fired outdoors;
 *   - and `gameMinutes` defaulted to 0, so the per-minute equality
 *     `gameMinutes === this._lastStealthMinute` held FOREVER after the
 *     first check and every later call returned the cached `detected`.
 *     Detection froze on its first roll for the life of the foe.
 *
 * The shared-stealth box rides the PLAYER ENTITY, because that is where
 * DFU keeps it: `PlayerEntity.TimeOfLastStealthCheck` is one field on
 * one player, so the Stealth tally fires once per classic minute across
 * every foe in the game. A per-host box - which is what the dungeon had
 * - lets two hosts tally the same minute twice.
 *
 * @param {object} entity   the player
 * @param {number} gameMinutes the classic clock
 * @param {object} [activity]  { movingLessThanHalfSpeed }
 */
export function sensesContext(entity, gameMinutes, { movingLessThanHalfSpeed = true } = {}) {
  entity.stealthCheckBox = entity.stealthCheckBox ?? { minute: -1 };
  return {
    gameMinutes: Math.floor(gameMinutes),
    playerStealth: skillValue(entity, SKILLS.Stealth),
    movingLessThanHalfSpeed,
    // S21: all three illusion branches - invisible always blocks (the 13
    // seers exempt), blending 8% see-through, shade 4% - each folding
    // the normal and true powers, as DaggerfallEntity does.
    playerBlending: isBlending(entity),
    playerInvisible: isInvisible(entity),
    playerShade: isAShade(entity),
    sharedStealth: entity.stealthCheckBox,
    tallyStealth: () => tallySkill(entity, SKILLS.Stealth),
  };
}

/** PlayerEntity.cs:388-400 - Athleticism loses fatigue 10% slower. */
export function fatigueLossMultiplierFor(entity) {
  return hasSpecialAbility(entity?.career, SPECIAL_ABILITY.Athleticism) ? 0.9 : 1.0;
}

// --- THE MUSIC DIRECTOR (AUDIT 19's 1:1 pass) ------------------------
//
// DFU's SongManager is a MonoBehaviour with an Update(): it rebuilds a
// context every frame and reacts to the difference. The port had no
// equivalent - hosts called music.playFrom at moments they chose - and
// three of DFU's behaviours are unreachable that way (a new day or a new
// location re-picks even when the playlist is identical; locationIndex is
// part of the context at all; a finished song re-evaluates the context
// before the next is chosen).
//
// This is the one seam every host uses. It owns a SongManager, wires its
// play/stop sinks to the music service, and takes a context per frame.
// Hosts supply their own half of that context and nothing else - which is
// what stopped the four of them drifting apart before.

/**
 * @param {object} [opts]
 * @param {boolean} [opts.fm]  take DFU's FM playlists
 */
/**
 * AUDIT 21 (music lane, F1): THE SINKS ARE INJECTABLE NOW.
 *
 * This director is the single seam through which every host feeds SongManager,
 * and it had ZERO behavioural coverage - its only pins were source-regex
 * sweeps over the host files, and a regex cannot see whether a value is used.
 * Three mutations were run against it and the WHOLE SUITE stayed green:
 *
 *   - reversing the spread below, which makes `base` win and permanently
 *     overwrite the mode host's inside/buildingType/factionId/dungeonKey -
 *     ALL interior and dungeon music dead, i.e. the exact AUDIT 21 F1 defect
 *     re-introduced by a different edit than the one F1's pin watches;
 *   - `songEnded: false`, killing DFU's whole !IsPlaying arm;
 *   - `play: () => {}`, so no music ever plays anywhere in the game.
 *
 * The only thing standing between a node test and this function was the
 * `music` module singleton needing an AudioContext, so the sinks default to it
 * and can be replaced. Nothing in the hosts passes them.
 */
/** D1 - THE END OF A RUN. DFU's death lands on
 *  StartMethods.TitleMenuFromDeath, which DaggerfallUI turns into
 *  InitGame(deathVideo): ANIM0012.VID plays and the START MENU comes
 *  up behind it. The port's front door is the boot flow, so the menu
 *  is the bare URL - the same unwind chargen's cancel already uses.
 *  ONE seam, because all four hosts die (the four-hosts rule): each
 *  passes this to its DeathScreen as onReset.
 *
 *  NEVER TRAPS: a missing or undecodable video costs the video, not
 *  the return to the menu. */
export async function endRunToTitleMenu(renderer) {
  try {
    const { playVideo } = await import('../ui/videoPlayer.js');
    const { getBytes } = await import('./dataSource.js');
    await playVideo(renderer.canvas, renderer, await getBytes('ANIM0012.VID'));
  } catch (e) {
    console.warn('[death] ANIM0012.VID unavailable - skipping the death video:', e?.message ?? e);
  }
  exitToTitleMenu();
}

/** I3 - the pause window's EXIT door, and the death seam's last line.
 *  DFU's pause exit posts dfuiExitGame - Application.Quit on
 *  standalone - and a browser has no quit, so the door out is the
 *  title menu by the same bare-URL unwind chargen's cancel uses.
 *  Dying takes the same door AFTER its video (above). */
export function exitToTitleMenu() {
  if (typeof location !== 'undefined') location.href = location.pathname;
}

export function createMusicDirector({ fm = false, play = null, stop = null, playing = null } = {}) {
  const isPlaying = playing ?? (() => music.playing);
  let _lastEnvironment = null;
  const manager = new SongManager({
    play: play ?? ((name) => music.playFrom([name], { gameDays: 0 })),
    stop: stop ?? (() => music.stop()),
    fm,
  });
  return {
    manager,
    /** One frame. `base` is the host's half; `overlay` is the mode host's
     *  (worldModes.musicContext()), or null outdoors. */
    update(base, overlay = null) {
      const merged = { ...base, ...(overlay ?? {}) };
      // AUDIT 21 (music lane, F4): DFU's temple arm writes NOTHING when
      // GetTempleIndex returns -1, so the environment holds - walk into an
      // unresolvable temple from a city street and the city track keeps
      // playing. musicEnvironment answers null for that case; the hold is
      // here, because a pure function cannot leave a field alone.
      const environment = holdEnvironment(musicEnvironment(merged), _lastEnvironment);
      _lastEnvironment = environment;
      // Probe hook: the four scene hosts have no execution coverage in
      // node, and AUDIT 21 F1 found this director being fed exclusively on
      // frames where the overlay was guaranteed null - the whole interior
      // and dungeon music path was dead. tools/bootProbe.mjs reads this to
      // check the wiring from a real boot, which is the only place it is
      // observable at all.
      if (typeof window !== 'undefined') {
        window.__musicCtx = { environment, overlay: overlay !== null };
      }
      return manager.update({
        environment,
        weather: merged.weather ?? 'sunny',
        night: Boolean(merged.night),
        gameDays: merged.gameDays ?? 0,
        locationIndex: merged.locationIndex ?? -1,
        arrested: Boolean(merged.arrested),
        dungeonKey: merged.dungeonKey ?? null,
      }, { songEnded: !isPlaying() });
    },
  };
}

// ---- The RMB drag (AUDIT 24, wave 45) -----------------------------
/** The right button is a WEAPON control, not a look control - classic
 *  Daggerfall swings by dragging it, and `contextmenu` is suppressed
 *  in every host for exactly that reason.
 *
 *  Three answers, because the two STREAMING hosts are not the only
 *  thing listening. `world.js` and `exterior.js` each register a
 *  global `mousemove`, and so does `worldModes.js` (:1517) for the
 *  interior and dungeon modes they own. Both fire on every move.
 *
 *  The bug this replaces: the streaming hosts gated the whole swing
 *  line on `modeNow() === 'exterior'`, which READS as "am I outdoors"
 *  when its actual job is "is anybody else eating this drag". Indoors,
 *  worldModes fed the modal weapon rig and the streaming host fell
 *  through to `cam.yaw += movementX` - so every swing inside a
 *  building or a dungeon turned the camera with it.
 *
 *  `dungeon.js:198`, the standalone host, has always had the right
 *  shape: attack, then return. It has no modal sibling to share the
 *  drag with, which is why it never needed a mode in the test at all.
 *
 *  @returns 'swing'  - this host owns the drag; feed its own rig
 *           'modal'  - a mode host owns it; do nothing, and DO NOT LOOK
 *           'look'   - nobody is swinging; the drag is a look
 */
export function routeMouseDrag({ walkMode, buttons, mode = 'exterior' }) {
  if (!walkMode || !(buttons & 2)) return 'look';
  return mode === 'exterior' ? 'swing' : 'modal';
}

