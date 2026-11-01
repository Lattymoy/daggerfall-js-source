// WINDFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - WINDFALL's WindEnvironmentEffects, ported off its assembly: the three sounds (a gust's one-shot, the
// windy day's intermittent passages, the canopy's ruffle) and the three particle flows (the gust's leaves, the
// ambient leaves, the winter boughs' snow) the wind drives. Pure: the host hands it the frame and three sources
// (systems/audio.js AudioEngine.source - Unity's AudioSource: a live volume and pitch, one-shots on it, isPlaying,
// Stop), and render/windfallParticles.js runs the flows it answers.
//
// THE LAW, WindEnvironmentEffects.UpdatePresentation (every outdoor frame):
//   - SOUND: a windy or stormy day plays a passage whenever the last has run out and its gap is spent (0.2 of the
//     mod's volume, 0.28 in a storm); a gust plays a gust clip (0.18 up to 0.40, 0.44 in a storm, by its peak) - on a
//     normal day a soft passage (0.14) instead; the canopy ruffles on a gust's onset and on its own clock (35-75 s,
//     16-35 windy, 10-24 a storm) where there are leaves to ruffle: not in snow, not under a winter nature set, not in
//     a climate or season without leaves (LeafAvailability x LeafSeasonMultiplier). Indoors every source fades at 0.8
//     a second and stops at nothing. A clip is never the one before it (NextNonRepeatingIndex); each is pitched a
//     little (0.96-1.06 a gust, 1.02-1.08 a passage, 0.94-1.07 a ruffle).
//   - LEAVES: the gust's leaves blow from 13 m upwind and 7 up, at the gust's particle response (a smoothstep of the
//     gust past 0.3) times the canopy (32 a second, 48 in a storm, times LeafAmount); the ambient leaves fall from 4 m
//     upwind and 8 up at a steady 0.25 a second (1.3 windy, 2.6 a storm); the season picks the sheet (spring and
//     summer green, fall and winter the fall sheet).
//   - SNOW: off the boughs in winter under a winter nature set - a quarter a second steady (0.8 windy, 1.4 a storm)
//     and 160 (220 a storm) times the gust's response, from up to 13 m upwind.
// UnityEngine.Random draws the clips, the pitches, the gaps and the clocks - the engine's own generator, which no port
// can share; `random` is the host's (Math.random), injected for the tests.
//
// DaggerfallUnity.Settings.SoundVolume: the mod multiplies it into each source's volume; the port's bus carries it
// (systems/audio.js `_out`), so a source here takes the mod's product without it - the same loudness.

/** The clips Windfall 1.0.0's WindMod.CreateEnvironmentalEffects loads, by pool, from WINDFALL_CLIP_TABLE below - their
 *  names, rates, frame counts and lengths; the sounds are our own (systems/windfall/windfallSynth.js, OWN-WORK4). */
import { WEATHER_TYPES } from '../world/weather.js';
import { SEASONS } from './gameDate.js';

/** Every clip the mod plays: [name, rate, frames], its length Unity's AudioClip.length (the frames over the rate). */
export const WINDFALL_CLIP_TABLE = Object.freeze(
  /** @type {Array<[string, number, number]>} */ ([
    ['wind_gust_01', 22050, 61740],
    ['wind_gust_02', 22050, 79380],
    ['wind_gust_03', 22050, 97020],
    ['wind_gust_04', 22050, 114660],
    ['wind_gust_05', 22050, 132300],
    ['wind_gust_06', 22050, 68355],
    ['wind_gust_07', 22050, 85995],
    ['wind_gust_08', 22050, 103635],
    ['wind_gust_09', 22050, 121275],
    ['wind_gust_10', 22050, 138915],
    ['wind_gust_11', 22050, 90405],
    ['wind_gust_12', 22050, 127890],
    ['wind_blowing_01_ultrasoft', 44100, 793800],
    ['wind_blowing_02_ultrasoft', 44100, 793800],
    ['wind_blowing_03_ultrasoft', 44100, 793800],
    ['whistling_wind_01_ultrasoft', 44100, 610986],
    ['whistling_wind_02_ultrasoft', 44100, 610986],
    ['whistling_wind_03_ultrasoft', 44100, 610986],
    ['open_wind_01_ultrasoft', 44100, 633381],
    ['open_wind_02_ultrasoft', 44100, 633381],
    ['open_wind_03_ultrasoft', 44100, 633381],
    ['leaf_ruffle_01', 22050, 30870],
    ['leaf_ruffle_02', 22050, 37485],
    ['leaf_ruffle_03', 22050, 44100],
    ['leaf_ruffle_04', 22050, 35280],
    ['leaf_ruffle_05', 22050, 48510],
    ['leaf_ruffle_06', 22050, 41895],
  ]).map(([name, rate, samples]) => Object.freeze({ name, rate, samples, length: Math.fround(samples / rate) })),
);
const clipOf = (name) => WINDFALL_CLIP_TABLE.find((c) => c.name === name);
const poolOf = (prefix) =>
  Object.freeze(
    WINDFALL_CLIP_TABLE.filter((c) => prefix.test(c.name)).map((c) =>
      Object.freeze({ name: c.name, length: c.length }),
    ),
  );
export const WINDFALL_CLIPS = Object.freeze({
  gust: poolOf(/^wind_gust_/),
  ambient: Object.freeze(
    [
      'wind_blowing_01_ultrasoft',
      'wind_blowing_02_ultrasoft',
      'wind_blowing_03_ultrasoft',
      'whistling_wind_01_ultrasoft',
      'whistling_wind_02_ultrasoft',
      'whistling_wind_03_ultrasoft',
      'open_wind_01_ultrasoft',
      'open_wind_02_ultrasoft',
      'open_wind_03_ultrasoft',
    ].map((n) => Object.freeze({ name: n, length: clipOf(n).length })),
  ),
  ruffle: poolOf(/^leaf_ruffle_/),
});

/** CreateLeaves / CreateSnow / CreateParticleSystem: the three systems' fixed shape. */
export const WINDFALL_PARTICLE_SYSTEMS = Object.freeze({
  leaves: Object.freeze({ maxParticles: 800, lifetime: [4, 8], size: [0.16, 0.34], spin: [-4, 4], sheet: [8, 8] }),
  ambientLeaves: Object.freeze({
    maxParticles: 300,
    lifetime: [5, 10],
    size: [0.14, 0.3],
    spin: [-4, 4],
    sheet: [8, 8],
  }),
  snow: Object.freeze({ maxParticles: 1800, lifetime: [3, 7], size: [0.05, 0.14], spin: [-2, 2], sheet: null }),
});
/** CreateParticleSystem: a box emitter 30 x 10 x 20 about the system, no start speed, a start rotation 0..2pi, and the
 *  noise module at frequency 0.35, scrolling 0.25. */
export const WINDFALL_EMITTER = Object.freeze({
  box: Object.freeze([30, 10, 20]),
  noiseFrequency: 0.35,
  noiseScroll: 0.25,
});

const WEATHER_SNOW = WEATHER_TYPES.indexOf('snow'); // DFU's WeatherType.Snow (world/weather.js, its one home)
const SEASON_SPRING = SEASONS.Spring,
  SEASON_SUMMER = SEASONS.Summer,
  SEASON_WINTER = SEASONS.Winter; // DFU's Seasons (systems/gameDate.js)
/** The winter nature sets (505, 507, 509, 511) - a canopy under snow. */
export const WINTER_NATURE = Object.freeze(new Set([505, 507, 509, 511]));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
const moveTowards = (c, t, d) => (Math.abs(t - c) <= d ? t : c + Math.sign(t - c) * d);

/** LeafAvailability: the canopy a climate has to lose. */
export function leafAvailability(climate) {
  switch (climate - 223) {
    case 0:
      return 0.9;
    case 1:
    case 2:
      return 0;
    case 3:
      return 0.2;
    case 4:
      return 1;
    case 5:
      return 0.75;
    case 6:
      return 0.85;
    case 7:
      return 0.8;
    case 8:
      return 1;
    case 9:
      return 0.9;
    default:
      return 0;
  }
}
/** LeafSeasonMultiplier. */
export const leafSeasonMultiplier = (season) => ({ 1: 0.6, 2: 0.75, 0: 1, 3: 0.35 })[season] ?? 0;
/** GustParticleResponse: a smoothstep of the gust past 0.3. */
export function gustParticleResponse(gust) {
  const t = clamp01((gust - 0.3) / 0.7);
  return t * t * (3 - 2 * t);
}

/** A flow the renderer runs: where the system stands, how many a second it emits, the velocity over lifetime, the
 *  noise's strength - and a clear or an emit owed (StopParticles' Clear, TriggerLeafTest's Emit). */
const newFlow = () => ({
  position: [0, 0, 0],
  rate: 0,
  velocity: [0, 0, 0],
  noiseStrength: 0.5,
  clear: false,
  emit: 0,
  emitAt: null,
});

/**
 * WindEnvironmentEffects. `sources` { gust, ambient, ruffle } - Unity AudioSources (`volume`, `pitch`, `isPlaying`,
 * `playOneShot(name)`, `stop()`), or none (no sound); `clips` the pools (WINDFALL_CLIPS); `random` 0..1.
 */
export function createWindfallEffects({ sources = null, clips = WINDFALL_CLIPS, random = Math.random } = {}) {
  const src = sources ?? { gust: null, ambient: null, ruffle: null };
  const range = (lo, hi) => lo + (hi - lo) * random(); // Random.Range(float, float)
  const rangeInt = (lo, hi) => (hi > lo ? lo + Math.min(hi - lo - 1, Math.floor(random() * (hi - lo))) : lo); // Random.Range(int, int)
  const nextNonRepeating = (count, previous) => {
    const n = rangeInt(0, count - 1);
    return n < previous ? n : n + 1;
  };
  let lastGust = -1,
    lastAmbient = -1,
    lastRuffle = -1;
  let presentationTime = 0,
    nextAmbientTime = 0,
    nextRuffleTime = 0,
    wasGusting = false,
    suppressed = false;
  let cfg = {
    audioEnabled: false,
    audioVolume: 0,
    regularWindVolume: 1,
    gustVolume: 1,
    ruffleVolume: 1,
    leavesEnabled: false,
    leafAmount: 0,
    ambientLeafAmount: 0,
    snowFlurriesEnabled: false,
    snowFlurryAmount: 0,
  };
  let leafSeason = 'springSummer'; // the leaf material's sheet - spring_summer_leaves until a fall or winter frame
  const flows = { leaves: newFlow(), ambientLeaves: newFlow(), snow: newFlow() };

  const fadeSource = (s, dt) => {
    if (!s) return;
    s.volume = moveTowards(s.volume, 0, Math.max(0, dt) * 0.8);
    if (s.volume <= 0 && s.isPlaying) s.stop();
  };
  function fadeAudio(dt) {
    fadeSource(src.gust, dt);
    fadeSource(src.ambient, dt);
    fadeSource(src.ruffle, dt);
    nextAmbientTime = 0;
    nextRuffleTime = 0;
    wasGusting = false;
  }
  function stopAudio() {
    src.gust?.stop();
    src.ambient?.stop();
    src.ruffle?.stop();
    nextAmbientTime = 0;
    nextRuffleTime = 0;
    wasGusting = false;
  }
  function playAmbientWind(level, gap) {
    const s = src.ambient,
      pool = clips.ambient;
    if (!s || !pool.length || s.isPlaying) return;
    const i = (lastAmbient = pool.length !== 1 ? nextNonRepeating(pool.length, lastAmbient) : 0);
    s.pitch = range(1.02, 1.08);
    s.volume = cfg.audioVolume * cfg.regularWindVolume * level;
    s.playOneShot(pool[i].name);
    nextAmbientTime = presentationTime + pool[i].length / s.pitch + Math.max(0, gap);
  }
  function updateAmbientWindAudio(windyDay, storm) {
    if (!cfg.audioEnabled || !(windyDay || storm) || !src.ambient || !clips.ambient.length) {
      nextAmbientTime = 0;
      return;
    }
    if (!src.ambient.isPlaying && (nextAmbientTime <= 0 || presentationTime >= nextAmbientTime)) {
      const level = storm ? 0.28 : 0.2;
      const gap = storm ? range(0, 0.75) : range(0.75, 2.5);
      playAmbientWind(level, gap);
    }
  }
  const scheduleNextRuffle = (windyDay, storm) => {
    nextRuffleTime = presentationTime + (storm ? range(10, 24) : windyDay ? range(16, 35) : range(35, 75));
  };
  function playRuffle(density, withGust, gust) {
    const s = src.ruffle,
      pool = clips.ruffle;
    if (s.isPlaying) return;
    const i = (lastRuffle = pool.length !== 1 ? nextNonRepeating(pool.length, lastRuffle) : 0);
    s.pitch = range(0.94, 1.07);
    const level = withGust ? lerp(0.16, 0.26, clamp01(gust)) : range(0.09, 0.15);
    s.volume = cfg.audioVolume * cfg.ruffleVolume * level * clamp01(density);
    s.playOneShot(pool[i].name);
  }
  function updateRuffleAudio(eligible, density, windyDay, storm, gust) {
    const gusting = gust > 0.03;
    if (!eligible || !src.ruffle || !clips.ruffle.length) {
      nextRuffleTime = 0;
      wasGusting = gusting;
      return;
    }
    if (nextRuffleTime <= 0) scheduleNextRuffle(windyDay, storm);
    if (gusting && !wasGusting) {
      playRuffle(density, true, gust);
      scheduleNextRuffle(windyDay, storm);
    } else if (presentationTime >= nextRuffleTime) {
      if (!src.ruffle.isPlaying) playRuffle(density, false, gust);
      scheduleNextRuffle(windyDay, storm);
    }
    wasGusting = gusting;
  }
  const flowTo = (f, x, y, z, wind, rate, horizontal, vertical, gust) => {
    // AUDIT ENVIRONS W7: the place written in place, no array a flow a frame
    f.position[0] = x;
    f.position[1] = y;
    f.position[2] = z;
    f.rate = Math.max(0, rate);
    f.velocity[0] = wind[0] * horizontal;
    f.velocity[1] = vertical;
    f.velocity[2] = wind[1] * horizontal;
    f.noiseStrength = 0.5 + gust * 1.8;
  };
  const stopFlow = (f, clear) => {
    f.rate = 0;
    if (clear) f.clear = true;
  };
  function stopParticles(clear) {
    const c = clear && !suppressed;
    stopFlow(flows.leaves, c);
    stopFlow(flows.ambientLeaves, c);
    stopFlow(flows.snow, c);
    suppressed = true;
  }

  return {
    flows,
    get leafSeason() {
      return leafSeason;
    },
    /** Configure: the presentation's settings (windfall.js windfallSettings().presentation). */
    configure(p) {
      cfg = { ...p };
      if (!cfg.audioEnabled) {
        stopAudio();
        return;
      }
      if (cfg.regularWindVolume <= 0) src.ambient?.stop();
      if (cfg.gustVolume <= 0) src.gust?.stop();
      if (cfg.ruffleVolume <= 0) src.ruffle?.stop();
    },
    /**
     * UpdatePresentation. `f` { hasPlayer, outside, weather (DFU's number), natureArchive, season, climate, windyDay,
     * storm, gust, windDirection: [x, z], dt, playerPos: [x, y, z] - the player's centre, PlayerObject's transform }.
     */
    update(f) {
      const dt = f.dt ?? 0;
      if (f.hasPlayer === false) {
        this.suppress(dt, true);
        return flows;
      }
      if (!f.outside) {
        fadeAudio(dt);
        stopParticles(true);
        return flows;
      }
      suppressed = false;
      presentationTime += Math.max(0, dt);
      updateAmbientWindAudio(f.windyDay, f.storm);
      const [wx, wz] = f.windDirection,
        p = f.playerPos;
      // SetSeasonalLeafTexture: the sheet the season wears - and a change of sheet clears both leaf systems
      // (ConfigureLeafSheet's Clear), so no green leaf blows on into the fall
      const sheet = f.season === SEASON_SPRING || f.season === SEASON_SUMMER ? 'springSummer' : 'fall';
      if (sheet !== leafSeason) {
        leafSeason = sheet;
        flows.leaves.clear = true;
        flows.ambientLeaves.clear = true;
      }
      const canopy = leafAvailability(f.climate),
        seasonal = leafSeasonMultiplier(f.season);
      const winterSet = WINTER_NATURE.has(f.natureArchive);
      const leavesOn = cfg.leavesEnabled && f.weather !== WEATHER_SNOW && !winterSet;
      const ruffleOn = cfg.audioEnabled && f.weather !== WEATHER_SNOW && !winterSet && canopy > 0 && seasonal > 0;
      updateRuffleAudio(ruffleOn, canopy * seasonal, f.windyDay, f.storm, f.gust);
      const response = gustParticleResponse(f.gust);
      flowTo(
        flows.leaves,
        p[0] - wx * 13,
        p[1] + 7,
        p[2] - wz * 13,
        f.windDirection,
        leavesOn ? response * canopy * seasonal * (f.storm ? 48 : 32) * cfg.leafAmount : 0,
        5.5 + f.gust * 7,
        -0.35,
        f.gust,
      );
      const ambientBase = f.storm ? 2.6 : f.windyDay ? 1.3 : 0.25;
      flowTo(
        flows.ambientLeaves,
        p[0] - wx * 4,
        p[1] + 8,
        p[2] - wz * 4,
        f.windDirection,
        leavesOn ? ambientBase * canopy * seasonal * cfg.ambientLeafAmount : 0,
        (f.storm ? 3 : f.windyDay ? 1.6 : 0.55) + f.gust * 1.5,
        -0.65,
        0.15 + f.gust * 0.35,
      );
      const snowOn = cfg.snowFlurriesEnabled && f.season === SEASON_WINTER && winterSet && canopy > 0;
      const steady = f.storm ? 1.4 : f.windyDay ? 0.8 : 0.25;
      const upwind = lerp(4, 13, response);
      flowTo(
        flows.snow,
        p[0] - wx * upwind,
        p[1] + 7,
        p[2] - wz * upwind,
        f.windDirection,
        snowOn ? (steady + response * (f.storm ? 220 : 160)) * canopy * cfg.snowFlurryAmount : 0,
        (f.storm ? 2.8 : f.windyDay ? 1.5 : 0.45) + f.gust * 8.5,
        -0.8,
        0.15 + f.gust * 0.85,
      );
      return flows;
    },
    /** PlayWindEvent: a gust's sound - a soft passage on a normal day, a gust clip on a windy one. */
    playWindEvent(peak, windyDay, storm) {
      if (!cfg.audioEnabled || peak <= 0) return;
      if (!windyDay && !storm) {
        playAmbientWind(0.14, 0);
        return;
      }
      const s = src.gust,
        pool = clips.gust;
      if (!s || !pool.length) return;
      const i = (lastGust = pool.length !== 1 ? nextNonRepeating(pool.length, lastGust) : 0);
      s.pitch = range(0.96, 1.06);
      s.volume = cfg.audioVolume * cfg.gustVolume * lerp(0.18, storm ? 0.44 : 0.4, clamp01(peak));
      s.playOneShot(pool[i].name);
    },
    /** Suppress: the sources fade; the particles stop (cleared once, on the first such frame). */
    suppress(dt, clearParticles) {
      fadeAudio(dt);
      if (clearParticles) stopParticles(true);
    },
    // ---- the console's ----
    triggerBrightWindTest() {
      if (!cfg.audioEnabled) return 'Wind sound is off in the settings.';
      if (!clips.ambient.length || !src.ambient) return 'No wind clip is ready yet.';
      if (src.ambient.isPlaying) src.ambient.stop();
      playAmbientWind(0.2, 0);
      return `A long wind clip plays at volume ${cfg.audioVolume.toFixed(2)}.`;
    },
    triggerRuffleTest() {
      if (!cfg.audioEnabled) return 'Wind sound is off in the settings.';
      if (!src.ruffle || !clips.ruffle.length) return 'No leaf clip is ready yet.';
      if (src.ruffle.isPlaying) src.ruffle.stop();
      playRuffle(1, true, 1);
      return `A leaf clip plays at volume ${cfg.audioVolume.toFixed(2)}.`;
    },
    /** TriggerLeafTest: sixty leaves from 8 m upwind and 4 up, blown at 8 m/s - Emit(60) at the test's place, where they
     *  stand however the next frame's UpdatePresentation moves the flow (AUDIT ENVIRONS W5: the burst keeps its own place,
     *  `emitAt`). */
    triggerLeafTest(playerPos, dir) {
      suppressed = false;
      const l = flows.leaves;
      flowTo(l, playerPos[0] - dir[0] * 8, playerPos[1] + 4, playerPos[2] - dir[1] * 8, dir, 0, 8, -0.25, 1);
      l.emitAt = [l.position[0], l.position[1], l.position[2]];
      l.emit += 60;
      return 'Sixty test leaves blow past.';
    },
    /** For the tests. */
    _peek: () => ({
      presentationTime,
      nextAmbientTime,
      nextRuffleTime,
      wasGusting,
      suppressed,
      lastGust,
      lastAmbient,
      lastRuffle,
    }),
  };
}

// ---- the clips, on the port's bus ---------------------------------------------------------------------------------
// OWN-WORK4: the clips are made here, not fetched - systems/windfall/windfallSynth.js, loaded on the first frame the
// mod's sound is wanted and never for a player who has it off. A slice of a clip is made a turn, so no frame holds them.
/** The key a clip registers under (systems/audio.js registerSamples). */
export const windfallClipKey = (name) => `windfall:${name}`;
/** The samples made a turn: half a second at the passages' rate, a millisecond or two of work. */
export const WINDFALL_CLIP_SLICE = 22050;
const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));
/** The clips each engine holds already: a host built again (the world's, then a city's) makes none twice. */
const heldBy = new WeakMap();
async function makeClip(clip) {
  const { windfallClipMaker } = await import('./windfall/windfallSynth.js');
  const maker = windfallClipMaker(clip);
  while (!maker.step(WINDFALL_CLIP_SLICE)) await nextTurn();
  return maker.samples;
}

/**
 * The mod's three AudioSources on `engine` (systems/audio.js AudioEngine), each playing its clips by name, and the
 * clips' one load. `make(clip)` -> the clip's samples at its rate (our synthesizer; a test's stand-in).
 */
export function windfallAudio(engine, { make = makeClip } = {}) {
  const wrap = (s) => ({
    get volume() {
      return s.volume;
    },
    set volume(v) {
      s.volume = v;
    },
    get pitch() {
      return s.pitch;
    },
    set pitch(p) {
      s.pitch = p;
    },
    get isPlaying() {
      return s.isPlaying;
    },
    playOneShot: (name) => s.playOneShot(windfallClipKey(name)),
    stop: () => s.stop(),
    dispose: () => s.dispose?.(),
  });
  const sources = { gust: wrap(engine.source()), ambient: wrap(engine.source()), ruffle: wrap(engine.source()) };
  let loading = null;
  return {
    sources,
    /** Every clip, made and registered once, one after another; a clip that cannot be made or taken is a missing clip
     *  (the mod's LoadAudioClips leaves it out of its pool - here its shot plays nothing). An engine with no context
     *  takes none, so the rest are not made. */
    load() {
      loading ??= (async () => {
        if (typeof engine.registerSamples !== 'function') return;
        const held = heldBy.get(engine) ?? new Set();
        heldBy.set(engine, held);
        for (const clip of WINDFALL_CLIP_TABLE) {
          if (held.has(clip.name)) continue;
          try {
            const samples = await make(clip);
            if (!samples) continue;
            if (!engine.registerSamples(windfallClipKey(clip.name), samples, clip.rate)) return;
            held.add(clip.name);
          } catch {
            /* a missing clip */
          }
        }
      })();
      return loading;
    },
    get loading() {
      return loading;
    },
    dispose() {
      for (const s of Object.values(sources)) s.dispose();
    },
  };
}
