// @ts-check
// BOOT-COMPILE (2026-10-25; bible/07-Rendering/Performance-Priority.md BOOT-COMPILE): THE BOOT'S PROGRAMS, STARTED
// TOGETHER AT THE FIRST CHANCE. On a cold shader cache the boot froze 24-35 s on D3D11, nearly all of it the main
// thread waiting for program links, one pass after another. KHR_parallel_shader_compile (render/glProgram.js
// SHADER-STALL) lets the driver compile on its own threads, so this module starts every program the boot will build
// as soon as the renderer exists. Each pass's constructor is unchanged: its buildProgram takes the started program.
// Only what the boot will build is started, by the switches its hosts read: a program started and never built costs
// driver threads and memory, never a frame. Where the driver cannot compile beside the page, nothing is started.
import { parallelCompile, startPrograms } from './glProgram.js';
import { EL_LANE, enhancedLightingOn } from './enhancedLighting.js';
import { airOn, airPassPrograms, airVolLinear } from './airPass.js';
import { worldSetPrograms, terrainClipFs, MESH_VS, BB_VS, TERRAIN_VS, TERRAIN_FS } from './renderer.js';
import { WATER_SURFACE_VS, waterSurfaceFs } from './waterSurface.js';
import { CLOUD_SHADOW_GLSL } from './cloudShadow.js';
import { SHADOW_GLSL } from './shadowPass.js';
import { CLOUD_PROGRAMS } from './volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from './cloudNoise.js';
import { DYNAMIC_SKIES_PROGRAMS } from './dynamicSkiesRenderer.js';
import { labGrassPrograms } from './labGrass.js';
import { deepWatersOn } from '../scenes/deepWater/deepWatersSwitch.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { modSetting } from '../systems/modSettings.js';
import { pageParam, pageHas } from '../systems/pageQuery.js';

/** @typedef {object} OutdoorPasses  The outdoor host's passes that the page's switches build: the clouds and their
 *  noise (scenes/shared.js), the Dynamic Skies sky (same controller), the grass and the terrain clip (scenes/world.js).
 *  @property {boolean} clouds @property {boolean} dynamicSky @property {boolean} grass @property {boolean} terrainClip */

/** The outdoor host's passes for the page's query. Each answer restates the switch its host reads at mount; a change
 *  to one of those lines must change the answer here. A wrong answer costs time, never a picture.
 *  @param {string} search @returns {OutdoorPasses} */
export function outdoorPasses(search) {
  const indoorDoor = pageHas('interior', search) || pageHas('dungeon', search);
  if (indoorDoor) return { clouds: false, dynamicSky: false, grass: false, terrainClip: false };
  // scenes/shared.js:"const enhancedLane = isEnhanced() && params.get('sky') !== 'classic' && getPref('enhancedEnvironments');"
  const skyDoor = pageParam('sky', search);
  const enhancedSky = isEnhanced() && skyDoor !== 'classic' && !!getPref('enhancedEnvironments');
  // scenes/shared.js:"const dynamicOn = enhancedLane && (skyDoor === 'dynamic' || (skyDoor === null && modSetting('dynamic-skies', 'Enabled')));"
  const dynamicSky = enhancedSky && (skyDoor === 'dynamic' || (skyDoor === null && !!modSetting('dynamic-skies', 'Enabled')));
  // scenes/shared.js:"const cloudArrival = enhancedLane && cloudsDoor !== 'off'"
  const clouds = enhancedSky && pageParam('clouds', search) !== 'off';
  // scenes/world.js:"const labGrass = isEnhanced() && getPref('enhancedEnvironments') && grassDensity > 0 && pageParam('grass') !== 'off'"
  const grass = isEnhanced() && !!getPref('enhancedEnvironments') && Number(getPref('grassDensity')) > 0 && pageParam('grass', search) !== 'off';
  // scenes/world.js:"if (dwRender) renderer.prepareTerrainClip();"
  const terrainClip = deepWatersOn();
  return { clouds, dynamicSky, grass, terrainClip };
}

/** @typedef {object} BootRenderer  The renderer's state the lane's list reads.
 *  @property {any} gl @property {any} _airPass @property {any} waterSurfaceProgramLane
 *  @property {{ key: string, terrainClip: any } | null} _laneSet @property {{ terrainClip: any }} _classicSet */

/** The programs that installing `lane` builds (null: the classic set, built already): its world set, water surface,
 *  air pass (`air`) and terrain clip (`clip`). A program already built is not listed: it would compile twice.
 *  A plain function, not a Renderer method, so the class does not grow (bible/01-Overview/Host-Split.md).
 *  @param {BootRenderer} renderer @param {any} lane @param {{ air?: boolean, clip?: boolean }} [o]
 *  @returns {Array<[string, string]>} */
export function laneBootPrograms(renderer, lane, { air = false, clip = false } = {}) {
  /** @type {Array<[string, string]>} */
  const programs = [];
  const laneSetBuilt = !!lane && renderer._laneSet?.key === lane.key;
  if (lane && !laneSetBuilt) programs.push(...worldSetPrograms(lane));
  if (lane?.shadows && !renderer.waterSurfaceProgramLane) programs.push([WATER_SURFACE_VS, waterSurfaceFs(CLOUD_SHADOW_GLSL, SHADOW_GLSL)]);
  if (lane?.shadows && lane.air && air && !renderer._airPass) {
    // _syncAir's options, as syncLightingLane installs the lane and then opens the air
    const airOptions = { vs: { mesh: MESH_VS, bb: BB_VS }, glsl: { shadow: SHADOW_GLSL, tonemap: lane.tonemapGlsl, scatter: lane.scatterGlsl }, maxLights: lane.maxLights };
    programs.push(...airPassPrograms(airOptions, airVolLinear(renderer.gl)));
  }
  const clipSet = lane ? (laneSetBuilt ? renderer._laneSet : null) : renderer._classicSet;
  if (clip && !clipSet?.terrainClip) programs.push([TERRAIN_VS, terrainClipFs(lane ? lane.terrainFs : TERRAIN_FS)]);
  return programs;
}

/** Every program the boot will build after the renderer's constructor, for the page's query. The cloud march comes
 *  first: it is the longest single compile (6.6 s cold on D3D11 here), and the driver starts programs in the order
 *  they are handed over, so the longest one must not wait behind the others.
 *  @param {BootRenderer} renderer
 *  @param {string} search @returns {Array<readonly [string, string]>} */
export function bootPrograms(renderer, search) {
  const lane = enhancedLightingOn(search) ? EL_LANE : null;
  const outdoor = outdoorPasses(search);
  const sky = [
    ...(outdoor.clouds ? CLOUD_PROGRAMS : []),
    ...(outdoor.clouds ? CLOUD_NOISE_PROGRAMS : []),
    ...(outdoor.dynamicSky ? DYNAMIC_SKIES_PROGRAMS : []),
  ];
  const laneAndTerrain = laneBootPrograms(renderer, lane, { air: airOn(search), clip: outdoor.terrainClip });
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
