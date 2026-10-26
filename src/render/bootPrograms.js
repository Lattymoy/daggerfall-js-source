// @ts-check
// BOOT-COMPILE (2026-10-25; bible/07-Rendering/Performance-Priority.md BOOT-COMPILE): THE BOOT'S PROGRAMS, STARTED
// TOGETHER AT THE FIRST CHANCE.
//
// On a cold shader cache (a first launch, and every launch after an update that changes a shader) the boot froze for
// 24-35 s on D3D11, nearly all of it the main thread waiting for program links. Each pass compiled its programs in its
// own constructor, one after another, and each LINK_STATUS read waited for its link. Meanwhile the boot spent many
// seconds on its own CPU work with no compile running at all.
//
// KHR_parallel_shader_compile lets the driver compile on threads of its own (render/glProgram.js SHADER-STALL). This
// module starts every program the boot will build as soon as the renderer exists, so the compiles run during the
// boot's CPU work and side by side. Each pass's constructor is unchanged: its buildProgram takes the started program
// for the same sources, and its read then finds the link made or nearly made.
//
// Only what the boot will build is started, by the same switches its hosts read. A program started and never built
// costs a compile on the driver's threads and its memory; it never costs a frame. Where the driver cannot compile
// beside the page, nothing is started: a link queued ahead would hold the next GL read on the page's thread.
import { parallelCompile, startPrograms } from './glProgram.js';
import { EL_LANE, enhancedLightingOn } from './enhancedLighting.js';
import { airOn } from './airPass.js';
import { CLOUD_PROGRAMS } from './volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from './cloudNoise.js';
import { DYNAMIC_SKIES_PROGRAMS } from './dynamicSkiesRenderer.js';
import { labGrassPrograms } from './labGrass.js';
import { deepWatersOn } from '../scenes/deepWater/deepWatersSwitch.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { modSetting } from '../systems/modSettings.js';
import { pageParam } from '../systems/pageQuery.js';

/**
 * @typedef {object} OutdoorPasses  The outdoor host's passes that the page's switches build.
 * @property {boolean} clouds  The volumetric clouds and their noise (scenes/shared.js createSkyController).
 * @property {boolean} dynamicSky  The Dynamic Skies mod's sky (the same controller).
 * @property {boolean} grass  The meadow's grass (scenes/world.js bootWorld).
 * @property {boolean} terrainClip  The terrain's clip program, built when Deep Waters stands (scenes/world.js bootWorld).
 */

/** The outdoor host's passes for the page's query. Each answer restates the switch its host reads at mount - a change
 *  to one of those lines must change the answer here too. A wrong answer here costs time, never a picture: a pass not
 *  started compiles in its constructor as before, and a pass started for nothing compiles on the driver's threads.
 *  @param {string} search @returns {OutdoorPasses} */
export function outdoorPasses(search) {
  const params = new URLSearchParams(search);
  const indoorDoor = params.has('interior') || params.has('dungeon');
  if (indoorDoor) return { clouds: false, dynamicSky: false, grass: false, terrainClip: false };
  // scenes/shared.js:"const enhancedLane = isEnhanced() && params.get('sky') !== 'classic'"
  const enhancedSky = isEnhanced() && params.get('sky') !== 'classic' && !!getPref('enhancedEnvironments');
  const skyDoor = params.get('sky');
  // scenes/shared.js:"const dynamicOn = enhancedLane && (skyDoor === 'dynamic'"
  const dynamicSky = enhancedSky && (skyDoor === 'dynamic' || (skyDoor === null && !!modSetting('dynamic-skies', 'Enabled')));
  // scenes/shared.js:"const clouds = enhancedLane && cloudsDoor !== 'off'"
  const clouds = enhancedSky && params.get('clouds') !== 'off';
  // scenes/world.js:"const labGrass = isEnhanced() && getPref('enhancedEnvironments') && grassDensity > 0"
  const grass = isEnhanced() && !!getPref('enhancedEnvironments') && Number(getPref('grassDensity')) > 0 && pageParam('grass', search) !== 'off';
  // scenes/world.js:"if (dwRender) renderer.prepareTerrainClip();"
  const terrainClip = deepWatersOn();
  return { clouds, dynamicSky, grass, terrainClip };
}

/** Every program the boot will build after the renderer's constructor, for the page's query. The cloud march comes
 *  first: it is the longest single compile (6.6 s cold on D3D11 here), and the driver starts programs in the order
 *  they are handed over, so the longest one must not wait behind the others.
 *  @param {{ gl: any, laneBootPrograms: (lane: any, o: { air: boolean, clip: boolean }) => Array<[string, string]> }} renderer
 *  @param {string} search @returns {Array<readonly [string, string]>} */
export function bootPrograms(renderer, search) {
  const lane = enhancedLightingOn(search) ? EL_LANE : null;
  const outdoor = outdoorPasses(search);
  const sky = [
    ...(outdoor.clouds ? CLOUD_PROGRAMS : []),
    ...(outdoor.clouds ? CLOUD_NOISE_PROGRAMS : []),
    ...(outdoor.dynamicSky ? DYNAMIC_SKIES_PROGRAMS : []),
  ];
  const laneAndTerrain = renderer.laneBootPrograms(lane, { air: airOn(search), clip: outdoor.terrainClip });
  const grass = outdoor.grass ? labGrassPrograms() : [];
  return [...sky, ...laneAndTerrain, ...grass];
}

/** Start the boot's programs on the renderer's context, where its driver compiles beside the page. Answers whether
 *  it started any. main.js calls this once, right after the renderer is made.
 *  @param {Parameters<typeof bootPrograms>[0]} renderer @param {string} search */
export function startBootPrograms(renderer, search) {
  if (!parallelCompile(renderer.gl)) return false;
  const programs = bootPrograms(renderer, search);
  startPrograms(renderer.gl, programs);
  return programs.length > 0;
}
