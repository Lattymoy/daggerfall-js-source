// @ts-check
// SD-LOOK S11 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 6): THE HANG AND
// THE WORKS ON THE PAGE - the dungeon host's set for what hangs under and around the Hour's islands, as scenes/sdHall.js is
// for the Orrery's hall. Nothing here is law (no collider, no floor, no clamp - the islands' law is world/sdRealm.js's);
// every draw carries `noShadow` - the roots and the far islands cast nothing into the lamps' cubes, and nothing that turns
// casts (LA-SHADOW3's everyLightCasts) - and a `stage` (the stage cull's tag: threshold, orrery, steps, arena; `sky` the far
// islands, `works` the Works).
//
//   STOOD once (stand): the roots, one mesh a stage (world/sdIslandModel.js buildHangModel - skirts, strata spires, gear
//     rims); the chains, one mesh an island; the far islands, one mesh; the Works, a mesh a gear (world/sdWorksModel.js).
//   EACH FRAME (frame): the realm's anchored clock read once - the chains swung on the escapement's tick about the line
//     through their anchors (chainSwing, chainMatrix), the Works turned a tooth a tick, neighbours opposite (worksMatrix),
//     the far set turned once a sky period (render/sdSky.js SD_SKY_PERIOD). Every matrix written in place: a frame makes
//     nothing (AUDIT SD II L2 F9).
//   THE PHONES' TIER (`lite`, ui/touchDevice.js isTouchDevice): one spire a root, no far islands, two Works gears, the
//     chains still (their draws stood at rest and never swung).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_HANG_ISLANDS, SD_HANG_STAGES, buildHangModel, buildChainModel, buildFarIslandsModel, chainSwing, chainMatrix, farIslandsMatrix } from '../world/sdIslandModel.js';
import { SD_WORKS, SD_HANG_NOW, buildWorksGear, worksMatrix } from '../world/sdWorksModel.js';
import { sdTick } from '../world/sdLook.js';
import { sdSkyClock, SD_SKY_PERIOD } from '../render/sdSky.js';
import { isTouchDevice } from '../ui/touchDevice.js';
import { identity } from '../world/mat4.js';

/** The far set's turns a sky period (a whole number, so the set never jumps as the clock wraps): once, backwards - time
 *  runs back inside the Hour. */
export const SD_FAR_TURNS = -1;

/**
 * THE HANG'S SET: `renderer` makes and frees its meshes; `clock()` the realm's anchored seconds (the dungeon host's
 * sdEndClock - every screen's chains and gears tick together); `lite` the phones' tier.
 * @param {{ renderer?: any, clock?: () => number, lite?: boolean }} deps
 */
export function createSdHang({ renderer = null, clock = () => performance.now() / 1000, lite = isTouchDevice() } = {}) {
  /** Every draw stood, in the order stood: `{ gpu, object: { matrix }, noShadow, stage, texRemap }` - and the moving ones. */
  const draws = [], chains = [], works = [];
  let far = null, stood = false;
  const meshes = [], now = new Float64Array(3);   // the frame's moment (SD_HANG_NOW), kept
  const make = (model) => {
    if (!renderer?.createMesh) return null;
    try { const m = renderer.createMesh(model); meshes.push(m); return m; } catch (e) { console.warn('[sd] the hang would not build', e?.message ?? e); return null; }
  };
  const drawOf = (gpu, stage) => ({ gpu, object: { matrix: identity() }, noShadow: true, stage, texRemap: null });
  return {
    /** Stand the set among the dungeon's draws (once - again is nothing). */
    stand({ dynamicDraws }) {
      if (stood) return;
      stood = true;
      for (const stage of SD_HANG_STAGES) {
        const gpu = make(buildHangModel(stage, { lite }));
        if (gpu) draws.push(drawOf(gpu, stage));
      }
      for (const isl of SD_HANG_ISLANDS) {
        const { model, axle } = buildChainModel(isl, { lite });
        const gpu = make(model);
        if (!gpu) continue;
        const d = drawOf(gpu, isl.stage);
        draws.push(d);
        if (!lite) chains.push({ d, axle });   // the phones' chains hang still
      }
      if (!lite) {
        const gpu = make(buildFarIslandsModel());
        if (gpu) { far = drawOf(gpu, 'sky'); draws.push(far); }
      }
      for (const g of SD_WORKS) {
        if (lite && !g.lite) continue;
        const gpu = make(buildWorksGear(g));
        if (!gpu) continue;
        const d = drawOf(gpu, 'works');
        draws.push(d);
        works.push({ d, g });
      }
      for (const d of draws) dynamicDraws.push(d);
      this.frame();
    },
    /** One frame: the clock read once, every moving draw's matrix set in place. Makes nothing. */
    frame() {
      if (!stood) return;
      const t = clock();
      now[SD_HANG_NOW.ticks] = sdTick(t);
      now[SD_HANG_NOW.swing] = chainSwing(now[SD_HANG_NOW.ticks]);
      now[SD_HANG_NOW.far] = (SD_FAR_TURNS * 2 * Math.PI * sdSkyClock(t)) / SD_SKY_PERIOD;
      for (let k = 0; k < chains.length; k++) chainMatrix(chains[k].axle, now, chains[k].d.object.matrix);
      for (let k = 0; k < works.length; k++) worksMatrix(works[k].g, now, works[k].d.object.matrix);
      if (far) farIslandsMatrix(now, far.object.matrix);
    },
    /** The draws stood (tests, the lab). */
    draws: () => draws,
    /** Free every mesh (the dungeon's teardown - EVERY ALLOCATION HAS AN OWNER). */
    clear() {
      for (const m of meshes) { try { renderer?.destroyMesh?.(m); } catch { /* gone */ } }
      meshes.length = 0; draws.length = 0; chains.length = 0; works.length = 0; far = null; stood = false;
    },
  };
}
