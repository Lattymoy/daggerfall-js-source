// WINDFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - WINDFALL IN A HOST: the one runtime both exterior hosts (scenes/world.js, scenes/exterior.js) build -
// WindMod's model (systems/windfall.js), its presentation (systems/windfallEffects.js) on three sources of the port's
// bus, its particles (render/windfallParticles.js), the floating origin's anchor for its sway (render/windfallSway.js),
// its save record and its console command. A host calls `frame` once a frame, outdoors and in (WindMod.Update runs
// wherever the player is: indoors its gust eases out and its sources fade), hands `law` to the renderer's
// setFlatWind beside WIND3's wind, and draws the particles once the opaque world stands.
//
// THE FOUR HOSTS RULE (bible/Home.md): world.js and exterior.js build it; worldModes.js (the interiors) and
// dungeonContext.js (the dungeons) do not - indoors and underground the host's own frame calls `frame` with
// `outside: false`, which is all the mod does there (WindEnvironmentEffects: the sources fade, the particles stop).

import { audio as defaultAudio } from '../systems/audio.js';
import { modSettingsGeneration } from '../systems/modSettings.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { registerCommand, gateConsoleCommand } from '../systems/consoleCommands.js';
import { createWindfall, windfallOn, windfallSettings, windfallStatusText, windfallWeather, WINDFALL_COMMAND, WINDFALL_VENDOR, DEBUG_MODE } from '../systems/windfall.js';
import { createWindfallEffects, windfallAudio } from '../systems/windfallEffects.js';
import { WindfallParticles, WINDFALL_PICTURES } from '../render/windfallParticles.js';
import { windfallUniforms, windfallAnchorAfterShift } from '../render/windfallSway.js';
import { dateFromClassicMinutes, seasonValue, SEASONS } from '../systems/gameDate.js';
import { getNatureArchive, SEASON as CLIMATE_SEASON } from '../world/climateSwaps.js';
import { getWorldClimateSettings } from '../formats/mapsFile.js';

const MODE_OF = Object.freeze({ auto: DEBUG_MODE.auto, normal: DEBUG_MODE.normal, windy: DEBUG_MODE.windy, storm: DEBUG_MODE.storm });

// The mod's three pictures (vendor/windfall/Textures/), served - Vite's compile-time glob, none in node.
const IN_BROWSER = typeof window !== 'undefined';
const PICTURE_URLS = IN_BROWSER ? import.meta.glob('../../vendor/windfall/Textures/*.png', { eager: true, query: '?url', import: 'default' }) : {};
async function defaultPicture(name) {
  const url = PICTURE_URLS[`../../vendor/windfall/Textures/${name}.png`];
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  const { decodePng } = await import('../systems/textureReplacement.js');
  return decodePng(new Uint8Array(await r.arrayBuffer()));
}

/**
 * The runtime. `gl` the renderer's context (the particles' - none: no particles), `enhanced` the host's lane (the
 * mod is the enhanced outdoors' - off it, `frame` answers no law and does nothing), `engine` the audio engine,
 * `random` UnityEngine.Random's stand-in, `picture(name)` a picture's decoded RGBA (a test's stand-in).
 */
export function createWindfallHost({ gl = null, enhanced = false, engine = defaultAudio, random = Math.random, picture = defaultPicture } = {}) {
  let gen = -1, settings = null, settingsOff = null;
  const model = createWindfall({ settings: windfallSettings() });
  const sound = windfallAudio(engine);
  const effects = createWindfallEffects({ sources: sound.sources, random });
  const particles = enhanced && gl ? new WindfallParticles(gl, { random }) : null;
  let anchor = [0, 0];
  const law = new Float32Array(8);
  const right = new Float32Array(3), up = new Float32Array(3);   // the camera's plane, a draw's scratch
  let last = null;   // the last frame's model answer and the player's centre (the console's)
  let picturesAsked = false;
  let natureKey = -1, natureArchive = 0;   // AUDIT ENVIRONS W7: the climate's nature set for the season, read when either changes
  let broken = false;   // AUDIT ENVIRONS I5: a frame threw - the wind stops there (the sources faded out), the host's frame never with it

  /** The settings, read again only when one was written (modSettingsGeneration) - LoadSettings is a callback. */
  function readSettings() {
    const g = modSettingsGeneration();
    if (g !== gen || !settings) {
      gen = g;
      settings = windfallSettings();
      settingsOff = { ...settings, enabled: false };
      effects.configure(settings.presentation);
    }
    return settings;
  }
  function loadPictures() {
    if (picturesAsked || !particles) return;
    picturesAsked = true;
    for (const [key, name] of Object.entries(WINDFALL_PICTURES)) {
      Promise.resolve().then(() => picture(name)).then((img) => { if (img) particles.setImage(key, img); }).catch(() => { /* a missing picture: that system draws nothing */ });
    }
  }

  registerModSaveData(WINDFALL_VENDOR, { newSaveData: model.newSaveData, getSaveData: model.getSaveData, restoreSaveData: model.restoreSaveData });
  registerCommand(WINDFALL_COMMAND.name, WINDFALL_COMMAND.description, WINDFALL_COMMAND.usage, (args) => command(args ?? []));
  gateConsoleCommand(WINDFALL_COMMAND.name, () => enhanced && windfallOn());

  /** ExecuteDebugCommand. */
  function command(args) {
    if (!enhanced) return 'Windfall runtime is unavailable.';
    if (!args || args.length !== 1) return `Usage: ${WINDFALL_COMMAND.usage}`;
    const a = String(args[0]).toLowerCase();
    if (a in MODE_OF) { model.setDebugMode(MODE_OF[a]); return `Wind test mode set to ${a}. DFU weather itself was not changed.`; }
    if (a === 'gust') {
      if (!last?.outside) return 'Go outside before triggering a wind gust.';
      const g = model.triggerGust();
      for (const e of model.takeEvents()) effects.playWindEvent(e.peak, e.windy, e.storm);
      return `Triggered a ${g.peak.toFixed(2)}-peak ${g.normal ? 'normal-day breeze' : 'gust'} for ${g.duration.toFixed(1)} seconds.`;
    }
    if (a === 'bright') return effects.triggerBrightWindTest();
    if (a === 'ruffle') return effects.triggerRuffleTest();
    if (a === 'leaves') {
      if (!last?.outside) return 'Go outside before testing wind leaves.';
      if (!particles) return 'Leaf renderer is unavailable; check Player.log for missing particle assets.';
      return effects.triggerLeafTest(last.center, last.wf.direction);
    }
    if (a === 'status') return windfallStatusText(model.status());
    return `Usage: ${WINDFALL_COMMAND.usage}`;
  }

  /** The frame's work (WindMod.Update's). */
  function tick(f) {
    const s = readSettings();
    const on = s.enabled && windfallOn();
    const dt = Math.max(0, Number(f.dt) || 0);
    const minutes = Math.floor(f.minutes ?? 0);
    const date = dateFromClassicMinutes(minutes);
    const season = seasonValue(date);
    const climate = f.climate ?? 0;
    const wf = model.tick({
      dt, outside: !!f.outside, weather: f.weather, date, minuteOfDay: date.hour * 60 + date.minute, absoluteDay: Math.floor(minutes / 1440),
      season, climate, mapPixel: f.mapPixel ?? { x: 0, y: 0 }, heading: f.heading ?? null, settings: on ? s : settingsOff,
    });
    const feet = f.feet ?? [0, 0, 0];
    const center = [feet[0], feet[1] + (f.height ?? 1.8) / 2, feet[2]];   // DFU's PlayerObject: the controller's centre
    last = { wf, center, outside: !!f.outside };
    if (!wf.on) {   // WindMod.Update's else: the strength and the gust 0, the presentation suppressed
      effects.suppress(dt, true);
      particles?.step(effects.flows, dt);
      return null;
    }
    for (const e of wf.events) effects.playWindEvent(e.peak, e.windy, e.storm);
    const winter = season === SEASONS.Winter, nk = climate * 2 + (winter ? 1 : 0);
    if (nk !== natureKey) { natureKey = nk; natureArchive = getNatureArchive(getWorldClimateSettings(climate)?.natureArchive, winter ? CLIMATE_SEASON.Winter : CLIMATE_SEASON.Summer); }
    effects.update({
      outside: !!f.outside, weather: windfallWeather(f.weather), natureArchive, season, climate,
      windyDay: wf.windyDay, storm: wf.storm, gust: wf.currentGust, windDirection: wf.direction, dt, playerPos: center,
    });
    if (f.outside) {
      if (s.presentation.audioEnabled) sound.load();
      loadPictures();
    }
    particles?.step(effects.flows, dt);
    return f.outside ? windfallUniforms(wf, anchor, law) : null;
  }

  const host = {
    model, effects, particles,
    /**
     * The frame. `f` { dt (the frame's game seconds - WindMod.Update's Time.deltaTime: none while the game is paused, the
     * travel's time scale over them), outside, weather (the port's word), minutes (the world clock's classic minutes), climate
     * (the map's climate index at the player), mapPixel { x, y }, heading (the outdoors' wind's unit direction - systems/
     * windDrive.js `dir` - or null), feet [x, y, z] (the player's), height (the player's, for the centre DFU's
     * PlayerObject stands at) }. Answers the law the flats lean by this frame (render/windfallSway.js's eight
     * numbers), or null where the mod's law does not stand (off the lane, the mod off, indoors).
     */
    frame(f) {
      if (!enhanced || broken) return null;
      try { return tick(f); } catch (e) {
        broken = true;
        try { effects.suppress(1, true); sound.dispose(); } catch { /* the wind is gone either way */ }
        console.warn('[windfall] a wind frame threw - the wind stops here:', e?.stack ?? e);
        return null;
      }
    },
    /** The particles, drawn: the leaves in the season's sheet, then the snow - billboards in the camera's own plane
     *  (Unity's Billboard mode: its right and its up, read off `view`). `light` the flats' light at the player
     *  (renderer.flatLightAt). Answers whether it drew (the host marks the foreign pass). */
    draw(proj, view, light) {
      if (!particles || broken) return false;
      right[0] = view[0]; right[1] = view[4]; right[2] = view[8];
      up[0] = view[1]; up[1] = view[5]; up[2] = view[9];
      return particles.draw(effects.leafSeason, proj, view, right, up, light);
    },
    /** The floating origin moved the scene by `offset`: the sway's place on the land and the particles keep theirs. */
    offsetOrigin(offset) {
      anchor = windfallAnchorAfterShift(anchor, offset);
      particles?.offsetOrigin(offset);
    },
    get anchor() { return anchor; },
    command,
    /** EVERY ALLOCATION HAS AN OWNER: the particles' GL and the sources. */
    dispose() { particles?.dispose(); sound.dispose(); },
  };
  return host;
}
