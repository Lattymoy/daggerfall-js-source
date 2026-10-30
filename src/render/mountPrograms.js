// @ts-check
// SHADER-EASE MOUNT-START (2026-10-29: in Chrome the game froze for the first 30-60 s in the world after each update):
// THE PASSES THE OUTDOOR HOSTS BUILD AT MOUNT, STARTED AT PAGE LOAD. Each builds in its constructor and reads its link
// at once (glProgram.js buildProgram), so on a fresh cache every one was a cold compile in a row. Started here, one at a
// time (startProgramsInTurn, COMPILE-QUEUE's "hitch 13064 ms": a whole batch at once holds the next read behind all of
// it), each constructor takes its started program. Loaded behind bootPrograms.js's door: these modules are the world
// host's graph (main.js warms it behind the menu), never the entry's. Each switch restates its host's: change one,
// change the other. A wrong answer costs a compile, never a picture.
import { parallelCompile, startProgramsInTurn } from './glProgram.js';
import { EL_LANE, enhancedLightingOn } from './enhancedLighting.js';
import { outdoorPasses, SHADOW_PASS_VS } from './bootPrograms.js';
import { shadowBodyPrograms } from './shadowPass.js';
import { farRingPrograms, ringDisabled } from './farRing.js';
import { farTreesPrograms, farTreesDisabled } from './farTrees.js';
import { floraDisabled } from './farFlora.js';
import { SKY_PROGRAMS } from './skyRenderer.js';
import { ENHANCED_SKY_PROGRAMS } from './enhancedSky.js';
import { WISP_PROGRAMS } from './windWisps.js';
import { HEAT_HAZE_PROGRAMS } from './heatHaze.js';
import { WINDFALL_PARTICLE_PROGRAMS } from './windfallParticles.js';
import { BOLT_PROGRAMS } from './lightningBolts.js';
import { DUEL_WALL_PROGRAMS } from './duelWall.js';
import { BANNER_PROGRAMS } from './bannerPass.js';
import { FLAG_PROGRAMS } from './shipFlagPass.js';
import { CURTAIN_PROGRAMS } from './rainCurtains.js';
import { SPOILS_GLOW_PROGRAMS } from './spoilsGlow.js';
import { NPC_MARK_PROGRAMS } from './npcMarkPass.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { pageHas } from '../systems/pageQuery.js';
import { idleTurn } from './idleTurn.js';

/** The passes an outdoor host builds at mount, in its order, for the page's query (none behind an indoor door), and
 *  last the shadow pass's three body programs, built at the first body that casts.
 *  @param {{ _shadowPass?: any }} renderer @param {string} search @returns {Array<readonly [string, string]>} */
export function mountPrograms(renderer, search) {
  const o = outdoorPasses(search);
  if (!o.outdoors) return [];
  // main.js:"if (params.has('exterior') || params.has('region') || params.has('loc'))" - the fixed city, behind ?world;
  // it builds the sky and the marks, never the world host's ring, duels, sea, rain or spoils
  const world = pageHas('world', search) || !['exterior', 'region', 'loc'].some((k) => pageHas(k, search));
  // the far ring's lane: scenes/world.js mounts the lane first (syncLightingLane), and the ring reads renderer.lightingLane
  const lane = enhancedLightingOn(search) ? EL_LANE : null;
  // scenes/world.js:"const farRing = (isEnhanced() && !ringDisabled())"
  const ring = world && isEnhanced() && !ringDisabled(search);
  // farRing.js:"this._band = this._flora && opts.mid && !farTreesDisabled()"
  const trees = ring && !floraDisabled(search) && !farTreesDisabled(search);
  const sky = o.enhancedSky; // the sky controller's `enhanced`: the wisps, the sand, the haze, Windfall and the bolts ride it
  const bodies = lane?.shadows && !renderer._shadowPass?._bodyBuilt ? shadowBodyPrograms(SHADOW_PASS_VS) : [];
  return [
    ...(ring ? farRingPrograms(lane) : []),
    ...(trees ? farTreesPrograms(lane) : []),
    ...SKY_PROGRAMS, // scenes/shared.js:"const sky = new SkyRenderer(gl);"
    ...(sky && !o.dynamicSky ? ENHANCED_SKY_PROGRAMS : []),
    ...(sky ? [...WISP_PROGRAMS, ...HEAT_HAZE_PROGRAMS, ...WINDFALL_PARTICLE_PROGRAMS, ...BOLT_PROGRAMS] : []),
    ...(world ? [...DUEL_WALL_PROGRAMS, ...BANNER_PROGRAMS, ...FLAG_PROGRAMS] : []), // every skin
    ...(world && isEnhanced() ? CURTAIN_PROGRAMS : []),
    ...(world ? SPOILS_GLOW_PROGRAMS : []),
    ...NPC_MARK_PROGRAMS, // the loot lines and the street's marks, every skin
    ...bodies,
  ];
}

/** Queue them on the renderer's context where its driver compiles beside the page; answers the queue (it resolves when
 *  the last is done). Nothing is queued without KHR_parallel_shader_compile.
 *  @param {{ gl: any, _shadowPass?: any }} renderer @param {string} search @param {() => Promise<unknown>} [wait] */
export function startMountPrograms(renderer, search, wait = idleTurn) {
  if (!parallelCompile(renderer.gl)) return Promise.resolve();
  return startProgramsInTurn(renderer.gl, mountPrograms(renderer, search), wait);
}
