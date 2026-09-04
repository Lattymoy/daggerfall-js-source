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
import { createWindModel, FRONT_LEAD_MIN } from '../systems/wind.js';   // WIND1
import { EnhancedSkyRenderer, skyState, easeWeather, weatherRow, CLOUD_SHADOW, moonlightTerm, retroFor, WEATHER_EASE_SECONDS } from '../render/enhancedSky.js';   // ES1: the enhanced sky, behind the skin; EV5: its moons light the world
import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';   // RA1: the Enhanced pane's sky switch
import { hasActiveEffect, isBlending, isInvisible, isAShade } from '../systems/effects.js';
import { skillValue, tallySkill, SKILLS, SKILL_NAMES } from '../systems/skills.js';
import { DOOR_SPELL_TEXT, castBySkeletonKey } from '../systems/mysticism.js';   // X1: the door-spell alert lines; D9: Open.CheckCastByItem
import { raiseSkills } from '../systems/advancement.js';   // AUDIT 23 (entity-1): the rest-end raise
import { tickPlayerMinutes, runMagicRoundsFor, worldMinutes, setWorldMinutes, advanceWorldMinutes, MINUTES_PER_DAY, CLASSIC_MINUTES_PER_SECOND } from '../systems/worldTick.js';
import { setInfectionHost, vampireClanForFaction } from '../systems/infection.js';   // V1: the host seam for the dream/death videos and the turn's clock raise
import { findFactions } from '../systems/talk.js';   // V1: GetRegionFaction's FindFactions(Province, region)
import { FACTION_TYPES } from '../formats/factionFile.js';
import { killIfAnyLiveStatZero } from '../systems/statMods.js';   // AUDIT 24 (wave 32): the per-entity laws a foe pool owes
import { hasSpecialAbility, SPECIAL_ABILITY, healthRecoveryRate, fatigueRecoveryRate, spellPointRecoveryRate } from '../systems/rest.js';
import { entityImprovedAthleticism } from '../systems/enchantments.js';   // AUDIT 26 F044: the ImprovesTalents fatigue arm   // the rested hour's three rates, one home for every host (V5 + S40, same line from two lanes)
import { getPreventedRestMessage } from '../systems/restSession.js';   // ROAD-B B5: TickRest's per-frame poll (:357-360, :407-410)
import { createNearbyScan, updateNearbyObjects, detectedMarkers, hasLiveDetector } from '../systems/nearbyObjects.js';   // X4: the Detect scan
import { liveStat, maxFatigue } from '../systems/statMods.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../player/motor.js';
import { FOOTSTEP_VOLUME } from '../systems/footsteps.js';   // AUDIT 58: PlayerFootsteps.FootstepVolumeScale (:30), which its one-shots carry too
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage
import { SOUND } from '../systems/soundClips.js';
import { surfacePlayer, hurtPlayer } from '../characters/playerEntity.js';
import { readSpellsStd } from '../formats/spellsStd.js';   // G4: the two magic registries, one home
import { readMagicDef } from '../formats/magicDef.js';
import { setMagicItemTemplates, setSpellRecordsByIndex } from '../systems/loot.js';
import { PaintFile } from '../formats/paintFile.js';   // F156: PAINT.DAT, the painting descriptions' file
import { setPaintFile } from '../systems/itemInfo.js';
import { music } from '../systems/music.js';
import { setMusicReplacements } from '../systems/musicReplacement.js';   // M-EXT: SoundReplacement's registry
import { setTextureReplacements } from '../systems/textureReplacement.js';   // M-TEX: TextureReplacement's registry
import { getBool } from '../systems/settings.js';   // M-FM: Audio/AlternateMusic, read once for all three hosts
import { SongManager, musicEnvironment, holdEnvironment } from '../systems/songManager.js';
import { audio } from '../systems/audio.js';

import { getBytes, storedMusicNames, loadMusicFile, storedTextureNames, loadTextureFile, registerMorrowindData } from './dataSource.js';   // M-EXT/M-TEX: the player's own packs


/** The data seam every scene uses - delegates to the ARENA2 data
 *  source (memory -> IndexedDB -> network); signature unchanged. */
export async function fetchBytes(name) {
  return getBytes(name);
}

/**
 * AUDIT 39 F156 - PAINT.DAT, the third file-backed registry, and it
 * rides this call for exactly the reason the two below share it: one
 * boot per host, THE FOUR HOSTS RULE, and a reader with nowhere else
 * to be threaded (the info panel is handed an item and a TEXT.RSC
 * reader, nothing more). It had no host at all: `setPaintFile` was
 * called from no src module and formats/paintFile.js was imported by
 * none, so every painting in the game showed TEXT.RSC 250 with its
 * five macros - subject, adjective, both prefixes and the artist -
 * expanded to the empty string. DFU always resolves it: GetItemInfo's
 * painting arm returns `item.InitPaintingInfo(paintingTextId)`
 * (ItemHelper.cs:788-789) over a PaintFileReader the ContentReader
 * builds unconditionally.
 *
 * Its own try block: a bad or absent PAINT.DAT must not take the
 * magic registries down with it, which is AUDIT 18's lesson below.
 *
 * G4 - THE TWO MAGIC REGISTRIES, in ONE place. THE FOUR HOSTS RULE:
 * these were set only in dungeonContext's boot, so a magic item
 * minted from the EXTERIOR host - shop loot, a city corpse, and as of
 * this slice the guild's Buy Magic Items shelf - found no templates
 * and was silently skipped. The guild shelf is what made it visible:
 * it came back holding a spellbook and nothing else.
 *
 * TWO TRY BLOCKS, still (AUDIT 18): they shared one, and a bad
 * MAGIC.DEF nulled the whole spell table with it.
 *
 * SPELLS.STD carries DUPLICATE indices and DFU keeps the FIRST - a
 * straight `new Map(entries)` keeps the LAST, so classic spell 58
 * would ready Holy Touch where DFU readies Holy Word.
 */
export async function loadMagicRegistries(fetch = fetchBytes) {
  let spellsByIndex = null;
  let magicItemTemplates = null;
  try {
    const byIndex = new Map();
    for (const sp of readSpellsStd(await fetch('SPELLS.STD'))) {
      if (!byIndex.has(sp.index)) byIndex.set(sp.index, sp);
    }
    spellsByIndex = byIndex;
    setSpellRecordsByIndex(byIndex);
  } catch { /* data absent: casts no-op, and a CastWhen* slot prices at 0 - DFU's own answer */ }
  try {
    magicItemTemplates = readMagicDef(await fetch('MAGIC.DEF'));
    setMagicItemTemplates(magicItemTemplates);
  } catch { /* data absent: the loot MI category and the guild shelf stay empty */ }
  let paintFile = null;
  try {
    paintFile = new PaintFile(await fetch('PAINT.DAT'));
    setPaintFile(paintFile);
  } catch { /* data absent: a painting reads record 250 with blank macros */ }
  return { spellsByIndex, magicItemTemplates, paintFile };
}

/** A1: ?season IS A DEBUG OVERRIDE NOW, NOT THE SOURCE.
 *  The texture season is the calendar's (climateSeasonFromMinutes,
 *  world/climateSwaps.js - the reference's own one-line test at
 *  ClimateSwaps.cs:382-386 and friends). This reads the URL and
 *  answers null when nothing pinned it, the ?cull=off shape: a shot or
 *  a probe can still nail winter in Second Seed, and a real session
 *  gets winter when Evening Star arrives and not before.
 *  @returns {number|null} a SEASON value, or null for "ask the clock". */
export function seasonOverride(params) {
  const s = (params.get('season') || '').toLowerCase();
  if (s === 'winter') return SEASON.Winter;
  if (s === 'rain') return SEASON.Rain;
  if (s === 'summer') return SEASON.Summer;
  return null;
}

// U54: ONE HOME - it moved to formats/textureFile.js, beside the
// reader, so ui/textureCanvas.js can have it without importing this
// module and everything it drags along. Re-exported because thirty
// call sites read it from here.
export { texName } from '../formats/textureFile.js';

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
  // ES1 (2026-08-27, Mac's call): under the ENHANCED skin the sky is the
  // port's own procedural dome - sun, moons on DFU's phases, stars,
  // clouds, weather - and the classic panorama pass is never built for.
  // `?sky=classic` keeps the painted sky under the enhanced skin (a
  // probe's pin); the classic skin never takes the enhanced sky. RA1
  // made the player's own door real: the Enhanced pane's Procedural
  // sky switch (uiPrefs, default on), read here at mount like the
  // roads pref is at the world host - the sky pass is built once per
  // scene, so a flip takes effect when the world next loads. ONE
  // `renderer` field either way: the hosts read clearColor / set
  // fogMix and fogColor on it without knowing which pass it is.
  // EE1: one switch for the whole outdoors. ?sky=classic stays the URL
  // door and still forces the panorama, so every probe riding it works.
  const enhancedSky = isEnhanced() && params.get('sky') !== 'classic' && getPref('enhancedEnvironments')
    ? new EnhancedSkyRenderer(gl) : null;
  if (enhancedSky) enhancedSky.retro = retroFor(params.toString());   // ES1e: retro unless ?sky=smooth - one door, shared with the lab
  const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
  let weatherRowNow = null;   // ES1c: the eased weather, walked toward the sim's row
  const windModel = createWindModel({ seed: Number(params.get('wseed')) || 7 });   // WIND1: the wind, a state of its own (enhanced only - the classic sky never reaches it); WX2a: ?wseed replays its rolls too
  const driftXZ = [0, 0];   // WIND2: the clouds' integrated offset, in the row's units x seconds
  let weatherAt = null;
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
      try {
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
      } catch {
        // The SAME posture as the day sibling below, which this branch
        // never had: DaggerfallSky reads local files and cannot fail
        // this way at all, so a missing or unreadable NITE??I0.IMG
        // degrades to the gradient. Un-caught it rejected the promise
        // use() hangs its one-shot `pending` guard on, and the sky
        // froze on the last day frame for the whole night.
        console.warn(`${name} unavailable - gradient sky fallback`);
        return buildFallbackSkyPanorama();
      }
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
    renderer: enhancedSky ?? sky,
    enhanced: Boolean(enhancedSky),
    /** GR3 (Mac: "the wind still isn't working ingame"): THE CLOUD
     *  SHADOW DECK, off the dome. EE5 publishes `cloudShadow` on the
     *  EnhancedSkyRenderer - cover, softness, WIND, time - "from the
     *  same state the dome is drawn from, so no host can feed them
     *  different numbers". Then three readers in world.js read it off
     *  THIS object - `sky.cloudShadow` - and this object never carried
     *  it: the dome sits one key down, under `renderer`. So every one
     *  of them read undefined. The grass took wind [0,0] and a slider
     *  of 0, the rain fell un-enhanced, and the ground's cloud shadows
     *  were set to null - three features dead from one missing key,
     *  and the suite green throughout, because nothing pinned the
     *  VALUE that reached the shader. GR2 measured a million blades
     *  placed and never a blade moving.
     *
     *  A getter, so it is live: the dome rebuilds the deck every draw
     *  and this always answers with the current one. null under the
     *  classic sky, as `wind()` above is null - "no deck is known",
     *  which is what the three readers' `?? null`/`?? [0, 0]` arms
     *  were written for. */
    get cloudShadow() {
      return enhancedSky?.cloudShadow ?? null;
    },
    /** WM2b: THE EASED WIND, and the ONE place anything but the sky can
     *  read it. `easeWeather` walks this row toward the sim's over
     *  WEATHER_EASE_SECONDS, and the cloud deck is drawn with it - so a
     *  consumer that takes the same vector is not merely correlated with
     *  the sky, it is driven by the same number. The windmills' rotor
     *  rate is the first (src/world/windmills.js).
     *
     *  null until the first enhanced draw, and null forever under the
     *  classic sky, which has no cloud field and eases nothing. Callers
     *  treat null as "no wind is known" rather than "the wind is zero" -
     *  the two differ, and only one of them should stop a mill. */
    wind() {
      return weatherRowNow ? weatherRowNow.wind : null;
    },
    /** WIND1: the wind's gust multiplier now, shaped by its strength. */
    gustAt(tsec) { return windModel.gust(tsec); },
    /** WIND1: 0..1 - the front's height, for anything that wants to
     *  arrive behind the wind. */
    frontProgress() { return windModel.frontProgress(); },
    /** WX2: 0..1 - how far the incoming weather has ARRIVED (1 from the
     *  front's landing on, and 1 with no front up), for the ground's
     *  terms and the drops to cross on. Under the classic sky the model
     *  never ticks and this answers 1: no front, nothing to cross. */
    frontArrival() { return windModel.arrival(); },
    /** WX2a (AUDIT 57): the sim's word changed by a JUMP - a load, a
     *  travel landing, a respawn roll, a stale drain - not by weather
     *  arriving. The eased row is dropped so the next use() takes the
     *  new row whole (the first-call law), and the wind builds no front.
     *  A no-op under the classic sky, which eases nothing. */
    weatherJump() {
      weatherRowNow = null;
      windModel.jump();
    },
    /** ES1d: how much the world's KEY light is taken by the cloud that
     *  is in front of the sun this frame - the number the shader uses to
     *  hide the disc, handed to the light so the two agree. 1 under a
     *  clear sky and under the classic sky, which has no cloud field. */
    sunFactor() {
      const occ = enhancedSky?.state?.sunOcclusion ?? 0;
      return 1 - CLOUD_SHADOW * occ;
    },
    /** EV5: the world light's MOON term, derived from the same state
     *  the dome is drawn with (the masser's direction, phase and
     *  cloud-dimmed visibility; secunda's ambient lift). null under
     *  the classic sky - which has no moon state, so the 1:1 lane
     *  keeps DFU's hard-off night - and null by day. */
    moonlight() {
      return enhancedSky?.state ? moonlightTerm(enhancedSky.state) : null;
    },
    /** Ensure the panorama for (skyIndex, minuteOfDay); async, frame-late.
     *  ES1: the enhanced sky takes the same call and needs the weather
     *  and the classic clock too (`extra`), for the clouds and the moons;
     *  it is synchronous - numbers into uniforms, nothing to load. */
    use(skyIndex, minuteOfDay, showNightSky = true, extra = null) {
      if (enhancedSky) {
        const now = (typeof performance !== 'undefined' ? performance.now() : 0);
        const seconds = (now - t0) / 1000;
        // ES1c: the weather EASES. The sim flips its type between two
        // ticks; the sky walks its numbers toward the new row over
        // WEATHER_EASE_SECONDS instead of changing in one frame. The
        // first call takes the row whole - a boot into rain is rain.
        // EE5: ?weather=<type> is a probe door, like ?window and ?skyframe
        // are for the panorama - the world render gate uses it to put
        // the sky under overcast and read the ground beneath.
        const weatherName = params.get('weather') ?? extra?.weather ?? 'sunny';
        const want = weatherRow(weatherName);
        const dt = weatherAt === null ? 0 : Math.min(1, Math.max(0, seconds - weatherAt));
        weatherAt = seconds;
        // WIND1: THE WIND IS ITS OWN STATE, and the sky's row takes it
        // rather than carrying a fixed vector per weather. The model
        // ticks on the game clock; a weather change is a FRONT and the
        // wind leads it - so the clouds' drift below, the ground's
        // shadows, the grass, the rain and the mills all rise with the
        // wind before the sky finishes turning, and fall after it
        // clears. One seam (WM2b), one vector, everything together.
        //
        // And the SKY'S OWN EASE follows the front: a mild change still
        // crosses in the old fourteen seconds, but a violent arrival
        // takes the front's lead to build, so from the ground the wind
        // gets up first and the sky darkens behind it - the storm
        // rolling in. `dt` is stretched or shrunk to make the ease's
        // own walk land on the front's clock.
        windModel.tick(extra?.classicMinutes ?? 0, weatherName);
        // WIND2 (AUDIT 56): the ease stretches for the WHOLE lead, from
        // the change itself. WIND1 stretched it only while the front's
        // factor was strictly between 0 and 1 - and at the change the
        // factor is exactly 0, so the sky crossed in its old fourteen
        // seconds and THEN the wind rose over three hours: the storm
        // arrived and the wind followed it, the reverse of what was
        // asked for and of what the record claimed. `inLead()` is true
        // from the change until the front's arrival.
        const easeDt = windModel.inLead() ? dt * (WEATHER_EASE_SECONDS / (FRONT_LEAD_MIN * 60 / 12)) : dt;
        weatherRowNow = easeWeather(weatherRowNow, want, easeDt);
        weatherRowNow.wind = windModel.vector();
        // WIND2: the cloud DRIFT is integrated here, once, in real
        // seconds - the one place the wind and the clock meet. Every deck
        // reads this offset instead of multiplying wind by time, which
        // with a wind that moves every frame made the clouds stream.
        driftXZ[0] += weatherRowNow.wind[0] * dt;
        driftXZ[1] += weatherRowNow.wind[1] * dt;
        enhancedSky.setState(skyState({
          minuteOfDay,
          weather: weatherName,
          classicMinutes: extra?.classicMinutes ?? 0,
          seconds,
          drift: driftXZ,   // WIND2
          row: weatherRowNow,
        }));
        return;
      }
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
      // `pending` is a ONE-SHOT guard: the early return above refuses
      // every later use() for the same key, and only apply() clears it.
      // A rejected build therefore wedged the controller on that key
      // for good (DFU has no such guard to wedge - DaggerfallSky
      // rebuilds from local files each frame change). Releasing it here
      // makes the next frame retry, which is the reference's behaviour.
      else {
        buildPanorama(skyIndex, frame).then(apply).catch((e) => {
          if (pending === key) pending = null;
          console.warn(`sky ${key} failed to build - retrying next frame:`, e?.message ?? e);
        });
      }
    },
    draw(yaw, pitch, fovY, aspect) {
      (enhancedSky ?? sky).draw(yaw, pitch, fovY, aspect);
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
 *  RECORDED, not a gap: the pre-chargen guard is load-bearing, and
 *  what it guards is a state DFU never has. The pre-chargen literal
 *  (characters/playerEntity.js:28) is `stats: { strength: 50,
 *  agility: 50, luck: 50 }` with no `speed` key, so an unguarded
 *  liveStat() would walk a fresh boot at (0 + 150 - 35)/39.5 instead
 *  of the documented SPD-50 stand-in. DFU builds its stats from the
 *  CharacterDocument and always has a Speed, so for any chargen'd or
 *  loaded entity the LIVE arm is the only one taken - and that arm is
 *  :389/:400/:418 verbatim. Nothing diverges here. */
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
 *  TallySkill(Climbing, 1), once per check.
 *
 *  RECORDED, not a gap, and the old reason here was wrong: the luck
 *  ternary below LOOKS like motorStats' `speed` guard and is not one.
 *  The pre-chargen entity does carry luck (characters/playerEntity.js
 *  :28 `stats: { strength: 50, agility: 50, luck: 50 }`), so the
 *  fallback arm is unreachable and both paths hand back 50. Nothing
 *  diverges from CalculateClimbingChance's GetLiveStatValue(Luck)
 *  (FormulaHelper.cs:300); the ternary is kept for shape with its
 *  sibling, not for need. */
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

/** DT1: the CORPSE containers, as NearbyObject loot records.
 *
 *  A killed enemy's corpse marker IS a DaggerfallLoot
 *  (GameObjectHelper.CreateEnemyCorpseMarker :836-839), so
 *  UpdateNearbyObjects' `GetActiveLoot()` walk (PlayerGPS.cs:765-776)
 *  includes it with no scene gate and no item test - an EMPTY corpse
 *  is in the list, GetLootFlags (:822-836) simply gives it no Treasure
 *  bit. That is why this maps every corpse rather than filtering on
 *  items the way the ACTIVATION walks do: a corpse with nothing in it
 *  is not a detect target, but it is still a nearby object.
 *
 *  The two foe pools name the same fact differently: `corpse` is the
 *  flag exteriorFoes raises beside `corpseMarker`, `corpseBatch` is
 *  the dungeon's own handle, and a foe that died with NEITHER is the
 *  cull's "gone, no corpse" arm, which mints no container in DFU
 *  either. */
export const corpseNearbyRecords = (foes) => (foes ?? [])
  .filter((f) => !!f?.entity && !!(f.corpse ?? f.corpseBatch))
  .map((f) => lootNearbyRecord({
    pos: f.corpseMarker?.pos ?? f.ai?.feet ?? null,
    items: f.entity.items ?? [],
  }));

/** DT1: a furniture container (a shop shelf or a house container) ->
 *  a NearbyObject loot record. Its position is the model matrix's own
 *  translation, which is what `loot.transform.position` reads off the
 *  GameObject DaggerfallInterior.AddFurnitureAction (:780-841) hung
 *  the DaggerfallLoot on.
 *
 *  `items: null` is a container the player has never opened. It counts
 *  as EMPTY, and that is DFU's answer rather than a port limit:
 *  AddFurnitureAction adds the component with no items and
 *  PlayerActivate.cs:881-886 stocks it on FIRST ACCESS, so
 *  `Items.Count > 0` is false until then and GetLootFlags withholds
 *  the Treasure bit. */
export const containerNearbyRecord = (c) => lootNearbyRecord({
  pos: c?.matrix ? [c.matrix[12], c.matrix[13], c.matrix[14]] : null,
  items: c?.items ?? [],
});

/** DT1: THE ONE LOOT WALK behind every host's Detect scan.
 *
 *  DFU has exactly one: `foreach (DaggerfallLoot loot in
 *  ActiveGameObjectDatabase.GetActiveLoot())` (PlayerGPS.cs:765-776),
 *  no scene gate and no kind gate. The port had FOUR hosts each
 *  deciding for itself which of its own loot kinds counted, and
 *  three of the four were short:
 *
 *    world.js / exterior.js  dropped piles + corpses (right, at FX1)
 *    dungeonContext.js       RDB piles ONLY - no corpses, no drops
 *    worldModes.js interior  NOTHING at all
 *
 *  so the same F207 defect survived in the two hosts where Detect
 *  Treasure is actually cast. Each host now names its own kinds and
 *  this walk does the rest, which is the only shape in which "every
 *  active loot container" can be one sentence again. */
export const nearbyLootRecords = ({ piles = [], containers = [], foes = [] } = {}) => [
  ...piles.map(lootNearbyRecord),
  ...containers.map(containerNearbyRecord),
  ...corpseNearbyRecords(foes),
];

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
    // D9: the Skeleton's Key. Open.CheckCastByItem asks the ARMED
    // BUNDLE's castByItem whether it is the artifact with world
    // texture 432/20 (Open.cs:176-180) and, if it is, the interior
    // trigger skips the level test entirely - "Skeleton's Key can open
    // even magical locks" (:117). The EXTERIOR arm still checks the
    // level regardless, and says so in as many words
    // (TriggerExteriorOpenEffect's summary: "for the classic effect,
    // the player's level is always checked, even for the Skeleton
    // Key"), so triggerExteriorOpen is not passed this at all.
    //
    // What used to be missing was the identity, not the law: the mint
    // dropped SetArtifact's texture indices and the armed entry
    // carried no casting item. Both ship at D9, so the key is a key.
    skeletonKey: castBySkeletonKey(armed.castByItem),
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
export function applyFallLanding(entity, distance, { hurt = null, sound = null, inOutdoorWater = false } = {}) {
  // FD1 - CheckFallingDamage's FIRST statement after clearing `falling`
  // (AcrobatMotor.cs:212-214): "don't take damage if landing in outdoor
  // water", `if (StreamingWorld.PlayerTileMapIndex == 0) return;`.
  //
  // It returns BEFORE fallDistance is computed, so the exemption
  // suppresses the BadFallDetected half too - a water landing costs
  // neither HP nor the hard-fall grunt. Putting the test after the
  // distance, or inside only the damage arm, would leave the player
  // splashing into a lake and still hearing the ground-impact sound,
  // which is the kind of half-port that reads as done.
  //
  // Hosts pass this from isOutdoorWaterTile(the tile under the
  // player); it defaults FALSE, which is DFU's own answer for the
  // -1 the streaming world reports off terrain (indoors, dungeons).
  if (inOutdoorWater) return;
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
    // AUDIT 58: at FootstepVolumeScale, not full. ApplyPlayerFallDamage
    // is `PlayOneShot((int)FallDamageSound, 0, FootstepVolumeScale)`
    // (PlayerFootsteps.cs:307-311) and HardFallAlert the same for
    // FallHardSound (:315-319) - the 0.7 is CHOSEN on these, not an
    // inherited default: PlayWeaponHitSound in the same component
    // (:331-337) deliberately passes 1f. The stride already carried it
    // (footsteps.js:26); its three siblings rang 43% too loud.
    sound?.(SOUND.FallDamage, FOOTSTEP_VOLUME);
  } else if (distance > FALL_DAMAGE_THRESHOLD / 2) {
    sound?.(SOUND.FallHard, FOOTSTEP_VOLUME);   // BadFallDetected, PlayerFootsteps.cs:315-319
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
  // M-EXT: the player's own music pack registers on the SAME seam, for
  // the third time and the same reason - a separate bootstrap is a
  // fourth thing every host has to remember. Registration is a name
  // list and a loader, not the audio: nothing is read off disk until a
  // song that has a replacement is actually asked for.
  //
  // NEVER TRAPS. No IndexedDB (private mode), no pick, a store that
  // will not open - all of them mean "no replacements", which is the
  // state DFU is in when StreamingAssets/Sound is empty. The built-in
  // songs play and the player is never told about a subsystem they did
  // not ask for.
  const replacements = storedMusicNames()
    .then((names) => setMusicReplacements(names, loadMusicFile))
    .catch(() => 0);
  // M-TEX: textures register on the SAME seam, for the same reason.
  // Registration is a name list and a loader - no PNG is read until an
  // archive that has replacements is actually loaded.
  const textures = storedTextureNames()
    .then((names) => setTextureReplacements(names, loadTextureFile))
    .catch(() => 0);
  // MW-IMPORT: same seam, same never-traps rule - no data means the
  // opt-in layer stays inert, which is its resting state anyway.
  const morrowind = registerMorrowindData().catch(() => 0);
  return Promise.all([sound, songs, replacements, textures, morrowind]);
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
/** PlayerEntity.RaiseSkills(), the port's one home for it.
 *
 *  AUDIT 23 (entity-1) established that PlayerEntity.Update runs NO
 *  advancement - DFU calls RaiseSkills from exactly two places, and
 *  they are both a window closing: DaggerfallRestWindow.cs:729-732
 *  when the rest-finished popup closes, and DaggerfallTravelPopUp.cs
 *  :380 when a fast-travel arrival tears its windows down.
 *
 *  TP1 renamed this from `raiseAtRestEnd`. That name was true while
 *  rest was the only caller and became a small lie the moment travel
 *  used it - and a name that misleads the next reader is the same
 *  defect as a stale comment, which this run has now found four of.
 *  It is DFU's member name instead. */
export const MASTERY_TEXT_ID = 4020;   // youAreNowAMasterOfTextID (PlayerEntity.cs:1361)

export function raisePlayerSkills(entity, { say = () => {}, onLevelUp = null, rolls = Math.random,
  // THE MASTERY BOX (RaiseSkills :1390-1407). `lines` is the host's
  // TEXT.RSC reader (townTalk.lines), `box` its click-anywhere
  // presenter. A host that hands neither still gets the fanfare, the
  // way DFU plays it outside the `tokens != null` gate.
  lines = null, box = null } = {}) {
  // ROAD-Ar R12 - THE PRESENTATION RUNS IN THE LOOP, NOT AFTER IT.
  // RaiseSkills (:1371-1414) pops skillImprove and builds the mastery
  // box inside the skill loop and posts dfuiOpenCharacterSheetWindow
  // AFTER it, so DFU's sheet arrives on top of the box and both live.
  // This used to batch both into a post-loop pass over `raised`, which
  // put the box after `onLevelUp` - and every host but dungeonContext
  // presents into ONE overlay slot (the b1-window-stack narrowing), so
  // the box replaced the freshly-mounted CharSheet. The sheet had
  // already committed the Level++ and cleared readyToLevelUp in its
  // constructor but writes `working` back to entity.stats only when it
  // closes, and it has no dispose - so the level's 4-6 attribute
  // points were dropped on the floor and never re-offered. Firing in
  // DFU's order fixes that at the cost the narrowing already records:
  // on a pass that both masters a skill and levels the player, the box
  // is the window the single slot loses, not the sheet.
  //
  // Interleaved, not batched: DFU pops the skillImprove message and
  // then, for that same skill, the master box - so a pass that raises
  // two skills reads in the source's order.
  return raiseSkills(entity, Math.floor(worldMinutes()), rolls, onLevelUp,
    () => {
      const rows = plainLines(lines?.(MASTERY_TEXT_ID));
      if (rows?.length) box?.(rows);
      audio.playOneShot(SOUND.ArenaFanfareLevelUp, 1);
    },
    (id) => say(`Your ${SKILL_NAMES[id]} skill has improved.`)) ?? [];
}

/**
 * V5 - TEXT.RSC ROWS ARE NOT STRINGS, and the two shapes are easy to
 * hand to the wrong window. `textRsc.linesById` (:216-247) answers
 * `{ text, center }` records, because the record's own bytes carry
 * justification; dungeonContext's local `rscLines` (:851) flattens
 * them to plain strings, which is what RestWindow, ActionTextBox and
 * ChoiceWindow all iterate.
 *
 * V5's first cut handed `townTalk.lines(id)` straight to a RestWindow
 * and the rested night ended in `TypeError: text is not iterable` from
 * drawText - a real page error, in a draw path no unit test walks, and
 * the first-hour probe's own zero-page-errors gate is what caught it.
 * So the flattening is a shared function now rather than a habit one
 * host happens to have.
 */
export const plainLines = (rows) => (rows?.length
  ? rows.map((r) => (typeof r === 'string' ? r : (r?.text ?? ''))).filter((l) => l !== null)
  : null);

/**
 * V5's REST DEPS retired into S40's, which is the same idea with the
 * same author's-note - resting worked in a dungeon and nowhere else
 * because dungeonContext built the deps by hand and no other host had
 * a copy - and three things that lane's version did not have: the
 * pass-through (a host dep the composition does not name still
 * reaches the window), the IsResting/IsLoitering writes, and
 * IsPlayerFullyHealed's NoRegenSpellPoints clause. See createRestDeps
 * below. What came the OTHER way is `plainLines`, above: TEXT.RSC
 * answers ROWS and this window iterates strings, which V5b's
 * first-hour probe caught as a TypeError at draw time and no unit
 * test in either lane could have.
 */
export function createPlayerTicker(entity, { say = () => {}, onLevelUp = null, onExhausted = null,
  // CG2: PlayerEnterExit.IsPlayerInside, for the crime-guild letter's
  // outside-only gate. Defaults to "inside" - the REFUSING answer -
  // because a host that has not said where the player stands must not
  // deliver a letter it cannot place, and the dungeon host is inside
  // by construction anyway.
  isInside = () => true } = {}) {
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
    tick(dt, activity = { running: false, swimming: false }, realSeconds = dt) {
      const r = tickPlayerMinutes({
        entity, classicMinutes: worldMinutes(), dt, sinks, activity, realSeconds,
        fatigueMultiplier: fatigueLossMultiplierFor(entity),
        say, inside: isInside(),
      });
      setWorldMinutes(r.classicMinutes);
      // PlayerEntity.Update:380-384's 8-hour alert decay used to be
      // called here. It is part of the player's per-minute update, so
      // it moved INTO tickPlayerMinutes above - this ticker is only
      // three of the four hosts, and the dungeon calls that function
      // directly.
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
      // T1 (AUDIT 39): the dt below is FABRICATED game time - a jump
      // costs no REAL seconds, because DFU's RaiseTime does not advance
      // Time.deltaTime. The third argument is what the two real-time
      // timers inside the tick (the torch's 20-second burn, refreshMods'
      // 0.2s) are fed, and a rested night must burn neither.
      return this.tick(minutes / CLASSIC_MINUTES_PER_SECOND, undefined, 0);
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
export function sensesContext(entity, gameMinutes, { movingLessThanHalfSpeed = true, candidates = null, playerEntity = null, insideDungeonCastle = false } = {}) {
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
    // MT-ii: the target-machine seam. A host that owns a pool passes
    // `candidates` (a live getter over every ACTIVE enemy record, the
    // ActiveGameObjectDatabase join) and the pools arm each foe's own
    // targeting closure over it. ABSENT = the player-only path, which
    // is both the headless charter and DFU's own behaviour with no
    // other enemy in the scene.
    candidates,
    // ROAD-B: PlayerEnterExit.IsPlayerInsideDungeonCastle, the FIRST
    // statement of EnemySenses.StealthCheck (:619-621) - a
    // non-hostile enemy in a castle never stealth-detects. It is a
    // SCENE fact, so it rides the context with the rest of them; only
    // the dungeon host can answer it true, and only from the block
    // the player is standing in.
    insideDungeonCastle,
    playerEntity: playerEntity ?? entity,
  };
}

/** PlayerEntity.cs:388-400 - Athleticism loses fatigue 10% slower,
 *  20% with the Improved Athleticism enchantment. AUDIT 26 F044: the
 *  enchantment arm is nested INSIDE the career check at :398-399
 *
 *      if (career.Athleticism)
 *          fatigueLossMultiplier = (ImprovedAthleticism) ? 0.8f : 0.9f;
 *
 *  so the item does nothing at all for a character without the career
 *  advantage, and halves the loss again for one who has it. The port
 *  decoded ImprovesTalents into _enchantMods.improvedAthleticism and
 *  then nothing read it - a law computed and thrown away. This is the
 *  ONE home: dungeonContext kept a second copy whose comment said the
 *  port had no source for the flag, which had stopped being true. */
export function fatigueLossMultiplierFor(entity) {
  if (!hasSpecialAbility(entity?.career, SPECIAL_ABILITY.Athleticism)) return 1.0;
  return entityImprovedAthleticism(entity) ? 0.8 : 0.9;
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
  claimFrame();   // P0: the death video owns the canvas - the host loop stops here
  try {
    const { playVideo } = await import('../ui/videoPlayer.js');
    const { getBytes } = await import('./dataSource.js');
    await playVideo(renderer.canvas, renderer, await getBytes('ANIM0012.VID'));
  } catch (e) {
    console.warn('[death] ANIM0012.VID unavailable - skipping the death video:', e?.message ?? e);
  }
  exitToTitleMenu();
}

/**
 * V1 - THE INFECTION'S HOST SEAM, registered once per host boot.
 *
 * The lifecycle runs in the magic round (systems/worldTick.js), which
 * has no renderer and no faction dictionary. This hands it the three
 * things only a host can give: the video player, the clock raise and
 * the popup. infection.js's null object still runs the lifecycle
 * without them, so a host that forgets this loses the DREAM, not the
 * disease - which is why the four-hosts pin greps for the call.
 *
 * ENDONANYKEY IS FALSE for all three (VampirismInfection.cs:126,
 * :136): the dream and the death play to the end and cannot be
 * skipped, unlike the splash and the death-screen video.
 *
 * NEVER TRAPS, the endRunToTitleMenu rule: a missing or undecodable
 * VID costs the video and the infection still progresses, because the
 * close callback is what carries the lifecycle forward and it runs on
 * every path out.
 */
export function wireInfectionVideos(renderer, { textAt = null, showText = null, factionDict = null, transferToCemetery = null } = {}) {
  // AUDIT 39 (#37): answers the host it replaced. A context that mounts
  // over an outer one (the dungeon over worldModes) hands this back on
  // teardown - the leaner set it registers has no FACTION.TXT and no
  // cemetery, and above ground those are not optional.
  return setInfectionHost({
    // V2e: DeployFullBlownVampirism's cemetery transfer (:164-175).
    // Only the WORLD host can arrive at another location (the same
    // single-location reality that makes travel's V world-host only),
    // so everywhere else this stays null and the new vampire wakes
    // where they fell - recorded, not silent: the deploy still runs.
    transferToCemetery,
    playVideo(name, onClose) {
      // Off the tick's own frame: playVideo OWNS the frame loop for
      // its lifetime, and pushing it from inside a frame body is the
      // re-entrancy DaggerfallUI avoids by pushing a WINDOW.
      //
      // AUDIT 39 (#160): and OWNING it means the host stops. The
      // microtask defers past this frame's body, but the host has
      // already re-armed itself, so without the hold the world walked,
      // fought and could die under an unskippable full-screen video.
      // DFU's vid window pauses the game outright (pauseWhileOpened);
      // the hold is that pause, and unlike claimFrame it gives the
      // world back.
      const releaseFrame = holdFrame();
      Promise.resolve().then(async () => {
        try {
          const { playVideo } = await import('../ui/videoPlayer.js');
          const { getBytes } = await import('./dataSource.js');
          // endOnAnyKey false is DFU's own for these
          // (VampirismInfection.cs:126/:136,
          // LycanthropyInfection.cs:114) - but it does NOT make them
          // unskippable, as AUDIT 26 F151 found this lane claiming:
          // Escape is a separate disjunct in Update (:140-142) and
          // closes any video, whatever this flag says.
          const played = await playVideo(renderer.canvas, renderer, await getBytes(name), { endOnAnyKey: false });
          if (typeof window !== 'undefined') (window.__infectionVideos ??= []).push({ name, played });
        } catch (e) {
          console.warn(`[infection] ${name} unavailable - skipping the video:`, e?.message ?? e);
        } finally {
          // The world is running again BEFORE the lifecycle moves: the
          // close carries the turn, whose popup lands in a host slot
          // that only a live loop draws.
          releaseFrame();
        }
        onClose();
      });
    },
    // DaggerfallDateTime.RaiseTime + `SyntheticTimeIncrease = true`
    // (:161-162): the fortnight is a CLOCK MOVE, not fourteen days of
    // magic rounds - the broker is told to sit the jump out, so a
    // new vampire does not wake up starved and diseased. The port's
    // advanceWorldMinutes is that same bare move.
    raiseTime: (seconds) => advanceWorldMinutes(seconds / 60),
    // "Death is not eternal" (:187-188) - a DaggerfallMessageBox on
    // TEXT.RSC 401. The LINES are shared; the BOX is the host's, the
    // same split D1's DeathScreen mount uses, because the dungeon
    // draws an ActionTextBox where the town hosts draw a
    // ChoiceWindow and neither is the other's overlay.
    messageBox: (id) => {
      // V5: plainLines, and it is a FIX rather than tidying. Three of
      // the four textAt providers hand back TEXT.RSC ROWS - world.js,
      // exterior.js and worldModes.js all pass `townTalk.lines(id)`,
      // which answers { text, center } records - while dungeonContext
      // passes `textRsc.plainText(id)`, which answers strings. Both
      // windows this reaches iterate the STRING (ChoiceWindow
      // talkWindow.js:58-59, ActionTextBox likewise), so "Death is not
      // eternal" threw `TypeError: text is not iterable` on draw
      // everywhere above ground and worked only in a dungeon: the
      // four-hosts divergence this project keeps meeting. Flattened
      // HERE, at the one consumer, so no provider has to be right.
      const lines = plainLines(textAt?.(id));
      if (lines?.length) showText?.(lines);
    },
    // GetVampireClan's region read (:400-427), assembled from the
    // host's FACTION.TXT: the Province faction of the region the
    // infection was CAUGHT in, not the one the player turns in. A
    // getter because FACTION.TXT loads after boot.
    clanOf: (regionIndex) => {
      const dict = typeof factionDict === 'function' ? factionDict() : factionDict;
      const province = dict ? findFactions(dict, { type: FACTION_TYPES.Province, region: regionIndex })[0] : null;
      return vampireClanForFaction(province);
    },
    hourNow: () => Math.floor((worldMinutes() % MINUTES_PER_DAY) / 60),
  });
}

/** I3 - the pause window's EXIT door, and the death seam's last line.
 *  DFU's pause exit posts dfuiExitGame - Application.Quit on
 *  standalone - and a browser has no quit, so the door out is the
 *  title menu by the same bare-URL unwind chargen's cancel uses.
 *  Dying takes the same door AFTER its video (above). */
// P0 (Mac 2026-08-28, the crash under the wizard): THE FRAME OWNER.
// Each scene host's requestAnimationFrame loop had NO owner - nothing
// could stop one once started, so any unwind that failed to navigate
// (or any path that boots a second host) left an old frame updating
// foes against torn state. The token is a generation counter: a host
// claims it at boot, checks it at the top of every frame, and stops
// recursing the moment anyone claims after it - a later boot, or the
// two unwinds below, which claim BEFORE they act so the old loop is
// dead even if navigation stalls. The fix is this owner, not a null
// check: guarding feet?.[0] would draw foes against a dead world and
// call it working.
let _frameGeneration = 0;
export function claimFrame() { return ++_frameGeneration; }
export const frameAlive = (token) => token === _frameGeneration;

// AUDIT 39 (#160): THE HOLD - claimFrame's other half. A full-screen
// VID is DFU's DaggerfallVidPlayerWindow, and its inherited
// pauseWhileOpened stops the game for the window's lifetime
// (UserInterfaceManager.AddWindow -> PauseGame(true)). claimFrame ENDS
// a loop, which is right for the two unwinds and wrong for a video the
// world is meant to survive: the host must neither simulate nor draw
// while the video owns the canvas, and must still be there afterwards.
// So the hold is a counter, taken by the seam and released on every
// path out, and the hosts wait on it instead of dying.
let _frameHold = 0;
export function holdFrame() {
  _frameHold++;
  let released = false;   // release once, however many paths call it
  return () => { if (released) return; released = true; _frameHold = Math.max(0, _frameHold - 1); };
}
export const frameHeld = () => _frameHold > 0;

export function exitToTitleMenu() {
  claimFrame();   // P0: the old loop dies before the navigation
  if (typeof location !== 'undefined') location.href = location.pathname;
}

export function createMusicDirector({ fm = null, play = null, stop = null, playing = null } = {}) {
  const isPlaying = playing ?? (() => music.playing);
  let _lastEnvironment = null;
  // M-FM: Audio/AlternateMusic, and it is read HERE rather than at the
  // three host call sites. Every FM playlist has been ported since A5,
  // outdoorPlaylist and playlistFor have branched on `fm` all along,
  // SongManager has taken it, and this factory has accepted and
  // forwarded it - and all three hosts called createMusicDirector()
  // with no arguments, so the setting the menu offers reached nothing.
  // Three call sites are three chances to forget; one read is none,
  // which is the same lesson ensureAudio's own header records.
  //
  // DFU swaps the nineteen playlist fields ONCE, in SongManager.Start
  // (:169-190), so a mid-session toggle does not move the music until
  // the scene reboots. Read at construction here for the same reason
  // and with the same consequence - a director is built once per host
  // boot. Verbatim, not an oversight.
  //
  // `null` means ask the setting; an explicit true/false is an
  // override, which is what the pins drive.
  const useFm = fm === null ? getBool('Audio', 'AlternateMusic') : fm;
  const manager = new SongManager({
    play: play ?? ((name) => music.playFrom([name], { gameDays: 0 })),
    stop: stop ?? (() => music.stop()),
    fm: useFm,
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


// --- S40: the rested HOUR, one home for all four hosts ---------------

/** DaggerfallRestWindow.TickVitals (:509-522) and the FullRest
 *  completion test it returns, IsPlayerFullyHealed (:524-537) - the
 *  same two facts
 *  every host needs and which three of the four did not have at all -
 *  rest lived only in the dungeon. `day`/`inside` are
 *  CalculateHealthRecoveryRate's, and they matter: RapidHealing
 *  InLight heals faster outdoors by daylight, and InDarkness
 *  everywhere else - which is the ONE place the two flags change the
 *  answer (rest.js' healthRecoveryRate). */
export function restVitals(entity, { day = false, inside = true } = {}) {
  entity.health = Math.min(entity.maxHealth, entity.health + healthRecoveryRate(entity, { day, inside }));
  entity.fatigue = Math.min(maxFatigue(entity), (entity.fatigue ?? 0) + fatigueRecoveryRate(maxFatigue(entity)));
  entity.magicka = Math.min(entity.maxMagicka ?? Infinity, (entity.magicka ?? 0) + spellPointRecoveryRate(entity));
  tallySkill(entity, SKILLS.Medical);
  surfacePlayer();
  return restFullyHealed(entity);
}

/** IsPlayerFullyHealed (:524-537) - health AND fatigue at max, and
 *  magicka at max UNLESS the career cannot regenerate it at all. */
export const restFullyHealed = (entity) =>
  entity.health === entity.maxHealth
  && (entity.fatigue ?? 0) === maxFatigue(entity)
  && ((entity.magicka ?? 0) === (entity.maxMagicka ?? 0)
    || hasSpecialAbility(entity.career, SPECIAL_ABILITY.NoRegenSpellPoints));

/**
 * The RestWindow deps every host shares, so a host adds rest with one
 * call and the dungeon - which owned this composition privately,
 * being the only host that could rest - reads it too rather than
 * keeping a second body of the same five closures. THE FOUR HOSTS
 * RULE, which is exactly the drift a second body invites.
 *
 * The host still supplies what only it knows:
 *   advanceMinutes(n)  its clock jump - the dungeon's also runs
 *                      IntermittentEnemySpawn's catch-up, which is a
 *                      dungeon law and stays there
 *   onRentExpired()    RemoveExpiredRentedRooms, for the host that can
 *                      actually be standing in a rented room
 * (setResting/setLoitering are written HERE, not by the hosts: they
 *  are entity flags with one meaning everywhere.)
 *   enemiesNearby()    the RESTING variant over ITS foe list
 *   place()            canRest()'s argument bag for where it stands
 *   commitCrime(c,sg)  CrimeCommitted + SpawnCityGuards
 *   moveToBed(marker)  PlayerMotor.transform.position
 *   endLines(id)       its TEXT.RSC reader
 *   say / onLevelUp    its presenters
 */
export function createRestDeps(entity, opts = {}) {
  const {
    say = () => {}, onLevelUp = null, day = () => false, inside = () => true,
    // The mastery box's presenter (RaiseSkills :1390-1407). The rows
    // come from the host's `endLines`, which is already its TEXT.RSC
    // reader - one host dep, not a second one that could disagree.
    box = null,
    place = null, ...rest
  } = opts;
  return {
    // PlayerEntity.IsResting / IsLoitering (:268, :284, :789, :285).
    // Every host owes these identically - they are entity flags, not
    // host state - so the composition writes them rather than asking
    // four hosts to remember. A host may still override via the
    // spread if it needs to observe the edge.
    setResting: (b) => { entity.isResting = !!b; },
    setLoitering: (b) => { entity.isLoitering = !!b; },
    // THE PASS-THROUGH IS LOAD BEARING, and it is here because a review
    // round caught the shape without it: worldModes handed this
    // function an `onRentExpired` closure and the closed destructure
    // silently dropped it on the floor, so RemoveExpiredRentedRooms
    // never ran and the source-text pin beside it still passed. Any
    // dep a host supplies reaches the window; only the five this
    // function COMPOSES are written below, and they win over a
    // same-named key so a host cannot half-override the composition.
    ...rest,
    // U39's rental record is named `restPlace` on the window and
    // `place` here, which is the one rename - so it cannot ride the
    // spread.
    restPlace: place ?? rest.restPlace ?? undefined,
    enemiesNearby: rest.enemiesNearby ?? (() => false),
    // ROAD-B B5: GameManager.GetPreventedRestMessage, polled by
    // TickRest every frame of a running rest. It is a GameManager
    // member, not a host one - the registry is one module singleton -
    // so it is COMPOSED here beside setResting rather than asked of
    // four hosts, and the same read feeds each host's open gate.
    preventedRestMessage: getPreventedRestMessage,
    onRestFinished: () => raisePlayerSkills(entity, { say, onLevelUp, lines: rest.endLines, box }),
    tickVitals: () => restVitals(entity, { day: day(), inside: inside() }),
    fullyHealed: () => restFullyHealed(entity),
    dead: () => entity.health <= 0,
    vitals: () => ({
      health: entity.health, maxHealth: entity.maxHealth,
      fatigue: Math.round((entity.fatigue ?? 0) / 64), magicka: entity.magicka ?? 0,
    }),
    // V5b, and this lane had the same bug unshipped: TEXT.RSC answers
    // `{ text, center }` ROWS - the record's own bytes carry
    // justification - while RestWindow, ActionTextBox and ChoiceWindow
    // all iterate the STRING. Handing `townTalk.lines(id)` straight to
    // a rest window ends the rested night in `TypeError: text is not
    // iterable` from drawText. Nothing in either lane's suite DRAWS,
    // so no unit test could catch it; their first-hour probe did, at
    // the last stage of the walk. Flatten here, once, for every host.
    endLines: (id) => plainLines(rest.endLines?.(id)),
  };
}

// ---- EC1: THE LIVE ENCHANT FOE POOL ----
//
// DFU has NO scene gate on the enemies an enchantment can reach.
// PlayerGPS.UpdateNearbyObjects (PlayerGPS.cs:747-777) walks
// ActiveGameObjectDatabase.GetActiveEnemyBehaviours() - every active
// enemy in the scene - and CastWhenStrikes does not look a foe up at
// all (CastWhenStrikes.cs:105): it assigns the bundle straight to the
// entity behaviour the strike handed it.
//
// The port needs a lookup because it needs the foe RECORD to reach
// that foe's damage/heal sinks, and the streaming host's lookup read
// an EXTERIOR-ONLY pool. Inside a dungeon it found nothing, so a
// CastWhenStrikes weapon returned without landing, and the vampiric
// drain and both artifact affinity scans saw an empty room - silently,
// in the mode the player actually fights in.
//
// These two live here rather than inline in the host because the law
// is small, exact and worth testing on its own: which pool is live,
// and which host's sinks a record from that pool must go through.

/** The foes an enchantment can reach right now - ONE ARM PER LIVE
 *  MODE, because DFU has one database per scene and every one of the
 *  three is a scene.
 *
 *  AUDIT 58 (hosts-consistency): the INTERIOR arm was `[]`, on a
 *  stated premise - "the port stands no foe pool inside a building" -
 *  that stopped being true when the IF slice mounted `interiorFoes`
 *  and ROAD-B mounted `interiorGuards` beside it. The gap was the
 *  original EC1 defect, left standing for the third mode: a
 *  CastWhenStrikes weapon (paralysis, Wizard's Fire, the other classic
 *  strike spells), the vampiric drain and both artifact affinity scans
 *  did nothing inside a shop, silently. The interior host answers the
 *  same "whole active enemy database" question for its own two pools
 *  (worldModes' insideFoes), so the arm is a pool it already had. */
export function liveEnchantFoes(mode, dungeonCtx, exteriorPool, insidePool) {
  if (mode === 'dungeon') return dungeonCtx?.foes ?? [];
  if (mode === 'interior') return insidePool?.() ?? [];
  if (mode === 'exterior') return exteriorPool?.() ?? [];
  return [];
}

/** The sinks for a record liveEnchantFoes handed out.
 *  Routed by POOL MEMBERSHIP ALONE. A dungeon record sent through the
 *  exterior pool's damage door would knock back and kill against the
 *  wrong host's collider, and the mode is one refactor away from
 *  letting that happen quietly - so the question asked is "whose
 *  record is this", which has exactly one right answer and does not
 *  need to know where the player is standing.
 *
 *  This took the MODE as well until the campaign called the bluff: no
 *  record is in both pools, so the mode term could not change an
 *  answer, and a mutant dropping it SURVIVED. An unfalsifiable term is
 *  not caution, it is a second law that no test is holding.
 *
 *  AUDIT 58: the INSIDE pool joins by the same rule, and it is not an
 *  unfalsifiable term - an interior record sent through the exterior
 *  door would knock back and kill against the STREET's collider and
 *  through the street's death chain, which is exactly the failure the
 *  paragraph above describes for the dungeon. Asked SECOND, after the
 *  dungeon: `insideFoes()` answers the dungeon's own pool when a
 *  dungeon is mounted, and that record belongs to the dungeon's
 *  sinks. */
export function liveEnchantFoeSinks(foe, dungeonCtx, exteriorSinks, insidePool, insideSinks) {
  const host = enchantFoeHost(foe, dungeonCtx, insidePool);
  if (host === 'dungeon') return dungeonCtx.foeSinksFor(foe);
  if (host === 'inside') return insideSinks(foe);
  return exteriorSinks(foe);
}

/** WHOSE RECORD IS THIS - the membership question by itself, because
 *  the sinks are not the only door the enchant ctx opens over a foe.
 *
 *  AUDIT 58 (review): the Wabbajack's `replaceFoe` REMOVES the struck
 *  record and stands its replacement, and the host was answering that
 *  question by not asking it - both reaches were the exterior pool's,
 *  over a getter that had just been widened to hand out dungeon and
 *  interior records. A record removed through the wrong pool is
 *  destroyed with no corpse, no loot and no death chain, and its
 *  replacement stands in a world the player is not in.
 *
 *  Asked in HOST ORDER, dungeon first, and the order is load-bearing
 *  rather than defensive: `insideFoes()` answers the DUNGEON's own
 *  pool while a dungeon is mounted, so a membership test that asked
 *  the inside pool first would hand every dungeon record to the
 *  interior host's doors.
 *
 *  DFU asks nothing, because it has nothing to ask: every enemy is a
 *  DaggerfallEntityBehaviour in ONE scene, and WabbajackEffect
 *  (:85-88) re-parents the new career under the struck enemy's own
 *  transform. The port needs the question only because it keeps one
 *  pool per host. */
export function enchantFoeHost(foe, dungeonCtx, insidePool) {
  if (dungeonCtx?.foes?.includes(foe)) return 'dungeon';
  if (insidePool?.()?.includes(foe)) return 'inside';
  return 'exterior';
}
