// @ts-check
// BOOT-COMPILE (2026-10-25; bible/07-Rendering/Performance-Priority.md BOOT-COMPILE): THE BOOT'S PROGRAMS, STARTED
// TOGETHER AT THE FIRST CHANCE. On a cold shader cache the boot froze for 24-35 s on D3D11, nearly all of it waiting
// for program links: each pass linked in its own constructor, one after another. KHR_parallel_shader_compile
// (render/glProgram.js SHADER-STALL) lets the driver compile on threads of its own, so this module starts every
// program the boot will build, by the switches its hosts read, as soon as the renderer exists. Each constructor is
// unchanged: buildProgram takes the started program. A program started and never built costs a compile and memory,
// never a frame. Without the extension nothing is started: a link queued ahead would hold the next GL read.
import { parallelCompile, startPrograms, startedDone } from './glProgram.js';
import { idleTurn } from './idleTurn.js';
import { EL_LANE, enhancedLightingOn } from './enhancedLighting.js';
import { airOn, airPassPrograms, airVolLinear } from './airPass.js';
import {
  worldSetPrograms,
  terrainClipFs,
  MESH_VS,
  BB_VS,
  TERRAIN_VS,
  TERRAIN_FS,
  CHAR_VS,
  CHAR_SKIN_VS,
} from './renderer.js';
import { WATER_SURFACE_VS, waterSurfaceFs } from './waterSurface.js';
import { CLOUD_SHADOW_GLSL } from './cloudShadow.js';
import { SHADOW_GLSL, shadowDepthPrograms } from './shadowPass.js';
import { CLOUD_PROGRAMS } from './volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from './cloudNoise.js';
import { DYNAMIC_SKIES_PROGRAMS } from './dynamicSkiesRenderer.js';
import { labGrassPrograms } from './labGrass.js';
import { deepWatersOn } from '../scenes/deepWater/deepWatersSwitch.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { modSetting } from '../systems/modSettings.js';
import { pageParam, pageHas } from '../systems/pageQuery.js';

/** @typedef {object} OutdoorPasses  The outdoor host's passes that the page's switches build.
 * @property {boolean} clouds  The volumetric clouds and their noise (scenes/shared.js createSkyController).
 * @property {boolean} dynamicSky  The Dynamic Skies mod's sky (the same controller).
 * @property {boolean} grass  The meadow's grass (scenes/world.js bootWorld).
 * @property {boolean} terrainClip  The terrain's clip program, built when Deep Waters stands (scenes/world.js bootWorld).
 * @property {boolean} outdoors  An outdoor host mounts (no indoor door). @property {boolean} enhancedSky  The sky's lane, `sky.enhanced`. */
/** The passes for the page's query. Each answer restates the switch its host reads at mount: change one, change the
 *  other. A wrong answer costs time, never a picture. @param {string} search @returns {OutdoorPasses} */
export function outdoorPasses(search) {
  const indoorDoor = pageHas('interior', search) || pageHas('dungeon', search);
  if (indoorDoor)
    return { clouds: false, dynamicSky: false, grass: false, terrainClip: false, outdoors: false, enhancedSky: false };
  // scenes/shared.js:"const enhancedLane = isEnhanced() && params.get('sky') !== 'classic' && getPref('enhancedEnvironments');"
  const skyDoor = pageParam('sky', search);
  const enhancedSky = isEnhanced() && skyDoor !== 'classic' && !!getPref('enhancedEnvironments');
  // scenes/shared.js:"const dynamicOn = enhancedLane && (skyDoor === 'dynamic' || (skyDoor === null && modSetting('dynamic-skies', 'Enabled')));"
  const dynamicSky =
    enhancedSky && (skyDoor === 'dynamic' || (skyDoor === null && !!modSetting('dynamic-skies', 'Enabled')));
  // scenes/shared.js:"const cloudArrival = enhancedLane && cloudsDoor !== 'off'"
  const clouds = enhancedSky && pageParam('clouds', search) !== 'off';
  // scenes/world.js:"const labGrass = isEnhanced() && getPref('enhancedEnvironments') && grassDensity > 0 && pageParam('grass') !== 'off'"
  const grass =
    isEnhanced() &&
    !!getPref('enhancedEnvironments') &&
    Number(getPref('grassDensity')) > 0 &&
    pageParam('grass', search) !== 'off';
  // scenes/world.js:"if (dwRender) renderer.prepareTerrainClip();"
  const terrainClip = deepWatersOn();
  return { clouds, dynamicSky, grass, terrainClip, outdoors: true, enhancedSky };
}

/** @typedef {{ gl: any, _laneSet: { key: string, terrainClip: any } | null, _classicSet: { terrainClip: any }, waterSurfaceProgramLane: any, _airPass: any, _shadowPass?: any }} BootRenderer  The renderer state the lane list reads. */
/** The shadow pass's vertex shaders, as setLightingLane hands them over:
 *  renderer.js:"vs: { mesh: VS, bb: BB_VS, terrain: TERRAIN_VS, char: CHAR_VS, charSkin: CHAR_SKIN_VS }". */
export const SHADOW_PASS_VS = Object.freeze({
  mesh: MESH_VS,
  bb: BB_VS,
  terrain: TERRAIN_VS,
  char: CHAR_VS,
  charSkin: CHAR_SKIN_VS,
});

/** The programs that installing `lane` builds (null: the classic set, built already): its world set, its shadow pass's
 *  depth programs and its water surface (a lane with shadows), its air pass (`air`: the page's door) and the installed
 *  set's terrain clip (`clip`: Deep Waters stands), in the order the install builds them. A program already built is not
 *  listed: started again, it would compile twice and the second would never be taken. A plain function over the
 *  renderer's state, not a Renderer method: bible/01-Overview/Host-Split.md keeps that class from growing.
 *  @param {BootRenderer} renderer @param {any} lane @param {{ air?: boolean, clip?: boolean }} [o]
 *  @returns {Array<[string, string]>} */
export function laneBootPrograms(renderer, lane, { air = false, clip = false } = {}) {
  /** @type {Array<[string, string]>} */
  const programs = [];
  const laneSetBuilt = !!lane && renderer._laneSet?.key === lane.key;
  if (lane && !laneSetBuilt) programs.push(...worldSetPrograms(lane));
  if (lane?.shadows && !renderer._shadowPass) programs.push(...shadowDepthPrograms(SHADOW_PASS_VS)); // SHADER-EASE MOUNT-START
  if (lane?.shadows && !renderer.waterSurfaceProgramLane)
    programs.push([WATER_SURFACE_VS, waterSurfaceFs(CLOUD_SHADOW_GLSL, SHADOW_GLSL)]);
  if (lane?.shadows && lane.air && air && !renderer._airPass) {
    // _syncAir's options, as syncLightingLane installs the lane and then opens the air
    const airOptions = {
      vs: { mesh: MESH_VS, bb: BB_VS },
      glsl: { shadow: SHADOW_GLSL, tonemap: lane.tonemapGlsl, scatter: lane.scatterGlsl },
      maxLights: lane.maxLights,
    };
    programs.push(...airPassPrograms(airOptions, airVolLinear(renderer.gl)));
  }
  const clipSet = lane ? (laneSetBuilt ? renderer._laneSet : null) : renderer._classicSet;
  if (clip && !clipSet?.terrainClip) programs.push([TERRAIN_VS, terrainClipFs(lane ? lane.terrainFs : TERRAIN_FS)]);
  return programs;
}

/** Every program the boot will build after the renderer's constructor, for the page's query. The driver starts programs
 *  in the order they are handed over. SHADER-EASE MOUNT-START (2026-10-29): the builds that read their link at mount come
 *  first - the lane's, the mod's sky, the grass - and the clouds last: their door (CLOUD-COMPILE) waits for its compile,
 *  so a late march is a late cloud, never a frozen frame.
 *  @param {BootRenderer} renderer
 *  @param {string} search @returns {Array<readonly [string, string]>} */
export function bootPrograms(renderer, search) {
  const lane = enhancedLightingOn(search) ? EL_LANE : null;
  const outdoor = outdoorPasses(search);
  const laneAndTerrain = laneBootPrograms(renderer, lane, { air: airOn(search), clip: outdoor.terrainClip });
  const blocking = [
    ...(outdoor.dynamicSky ? DYNAMIC_SKIES_PROGRAMS : []),
    ...(outdoor.grass ? labGrassPrograms() : []),
  ];
  const behindDoors = outdoor.clouds ? [...CLOUD_PROGRAMS, ...CLOUD_NOISE_PROGRAMS] : [];
  return [...laneAndTerrain, ...blocking, ...behindDoors];
}

/** The turns the mount set waits at most for the boot's blocking batch: a driver that never says done still gets it. */
export const MOUNT_WAIT_TURNS = 300;
let settled = false;
/** SHADER-EASE GFX-BAR: true once the mount set is queued, or once none will be (ui/gfxPrepBar.js reads it). */
export const mountSettled = () => settled;

/** Start the boot's programs on the renderer's context, where its driver compiles beside the page. Answers whether
 *  it started any. main.js calls this once, right after the renderer is made.
 *  @param {Parameters<typeof bootPrograms>[0]} renderer @param {string} search
 *  @param {() => Promise<unknown>} [mount] the mount set's start (render/mountPrograms.js)
 *  @param {() => Promise<unknown>} [wait] the wait between asks */
export function startBootPrograms(
  renderer,
  search,
  mount = () =>
    import('./mountPrograms.js').then((m) => {
      const queue = m.startMountPrograms(renderer, search);
      settled = true;
      return queue;
    }),
  wait = idleTurn,
) {
  settled = false;
  if (!parallelCompile(renderer.gl)) {
    settled = true;
    return false;
  }
  const programs = bootPrograms(renderer, search);
  startPrograms(renderer.gl, programs);
  // SHADER-EASE MOUNT-START (2026-10-29): then the passes the outdoor hosts build at mount, queued one at a time - once
  // the batch ahead of the clouds is done, so they never take the driver's threads from it. An indoor door mounts none.
  const outdoor = outdoorPasses(search);
  if (outdoor.outdoors) {
    const blocking = programs.slice(
      0,
      programs.length - (outdoor.clouds ? CLOUD_PROGRAMS.length + CLOUD_NOISE_PROGRAMS.length : 0),
    );
    void (async () => {
      for (let turn = 0; turn < MOUNT_WAIT_TURNS && !startedDone(renderer.gl, blocking); turn++) await wait();
      await mount();
    })()
      .catch((err) => console.warn("[boot] the mount's programs could not be started early:", err?.message ?? err))
      .finally(() => {
        settled = true;
      });
  } else settled = true;
  return programs.length > 0;
}
