// @ts-check
// BOUNTY-FARM (2026-09-28, Mac: "can you spawn some farmhouses there it says the granary is overrun? the thing is how
// do those farmhouses despawn again"): A FARM ON A FARM BOUNTY'S PIXEL - the world host's props pool, on the gate's
// and the camps' shape (scenes/gatePool.js, scenes/camps.js): models through the host's pipeline, a collider bucket of
// its own, drawn in the host's world pass.
//
// WHAT STANDS: a real farmstead - every model of the first RMB block of one of the game's eight nearest HomeFarms
// locations to the hunt, the notice's pick (pickFarm; world/locationLayout.js layoutLocation), so it is Daggerfall's own farm, climate-dressed by the pixel it
// stands on (world/texRemap.js remapSubMeshes, the pixel's own texRemap). Where on the pixel is the bounty's id's
// roll over sixteen spots, the FLATTEST clear of roads and the sea - so everyone holding the bounty sees the same farm
// in the same place. The terrain is not flattened under it (a real location's is), so EACH MODEL sits on the ground
// under its own centre: the house, the barn and every fence run with the land instead of the whole block sinking to
// its lowest corner (the first cut's - on a hillside it buried the fences and all of the house but its roof).
//
// NOTHING HERE IS SAVED OR SENT. The farm is a function of the bounties this player holds: it is never world data,
// so nothing is left to clean up after a crash, a load or a server restart.
//
// ITS LIFE (the rule Mac agreed):
//   - it stands while THIS player holds its bounty and its pixel is built (only the holders see it - a party mate
//     who took the bounty or had it shared sees it; a passer-by sees the beasts and no farm);
//   - its pixel unloads: it comes down, and stands again when the pixel is built again while the bounty is held;
//   - its bounty ends (paid, given up, lapsed): it stays until the player is FARM_LINGER_M away - it never vanishes
//     under the player's eyes - or its pixel unloads, whichever is first;
//   - a fast travel, a dungeon, a building, a load: every farm comes down (`destroyAll`, or the mode test in sync).
//
// Not a DFU member. Ledger A (BOUNTY-FARM).
import { bountyHash } from '../systems/bountyBoard.js';
import { trs, multiply } from '../world/mat4.js';
import { onFloatingFrame } from '../player/collider.js';   // PERF-COL2 (AUDIT): a farm's bucket rides the floating origin

/** How far from a farm whose bounty is over the player must be before it comes down, metres. */
export const FARM_LINGER_M = 200;
/** The pixel's side, and the band of it a farm may stand in (clear of the edges, where the next pixel's ground joins). */
export const FARM_PIXEL_SIDE = 819.2;
const FARM_BAND = [0.25, 0.75];
/** How many spots a farm weighs on its pixel: every one clear of roads, the sea and towns is measured, and the
 *  FLATTEST wins (Mac, 2026-09-28: "the house was on hill side stuck into a ground i was able to almost only see its
 *  roof, no fences"). */
export const FARM_SPOT_TRIES = 16;
/** How far each model is sunk below the ground under its own centre, metres - enough to hide the gap on a gentle
 *  slope's downhill side, never enough to bury a fence. */
export const FARM_SINK_M = 0.25;
/** A farm whose ground was not up yet (a far pixel) tries again after this many syncs. */
export const FARM_RETRY_SYNCS = 4;
/** BOUNTY-FARM-GROUND: the most the ground may rise across a farm's block (its 3x3 over the block), metres - a spot
 *  steeper than this is a mountainside, and no farm stands there; with no spot under it the farm fails and its pack
 *  stands as any other hunt's. */
export const FARM_MAX_RISE_M = 8;
/** BOUNTY-FARM-CLEAR: how far outside a farm building's footprint a foe must stand, metres. */
export const FARM_BUILDING_CLEAR_M = 1.5;
/** The collider bucket prefix - one bucket a farm. */
export const FARM_BUCKET = 'bounty:farm:';

/** BOUNTY-FARM-PICK (Mac, 2026-09-28: "Pick from several farms ... Yes this sounds good"): a notice's farm is one of
 *  the nearest this many real farmsteads - so neighbouring hunts get different layouts - picked by the notice. */
export const FARM_PICK_NEAREST = 8;
/** A string's 32-bit hash (FNV-1a) - the same on every client. */
export function farmKeyHash(key) {
  let h = 0x811c9dc5;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
/**
 * Which farm a notice copies: the nearest FARM_PICK_NEAREST of `farms` to its pixel (distance, then position, so a
 * tie is broken alike everywhere), one of them by the notice's key. Pure.
 * @param {Array<{px:number, py:number}>} farms @param {number} px @param {number} py @param {string} key
 */
export function pickFarm(farms, px, py, key) {
  if (!farms?.length) return null;
  const near = farms.map((f) => /** @type {[number, any]} */ ([Math.hypot(f.px - px, f.py - py), f]))
    .sort((a, b) => (a[0] - b[0]) || (a[1].px - b[1].px) || (a[1].py - b[1].py))
    .slice(0, FARM_PICK_NEAREST);
  return near[bountyHash(farmKeyHash(key), 0xfa7) % near.length][1];
}

/**
 * The farm's spot in its pixel, pixel-local metres, for try `k` - a pure function of the bounty id, so every holder
 * reads the same spot.
 * @param {string} id @param {number} k
 */
export function farmSpotLocal(id, k = 0) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  const a = bountyHash(h, k, 0xfa), b = bountyHash(h, k, 0xfb);
  const span = FARM_BAND[1] - FARM_BAND[0];
  return [FARM_PIXEL_SIDE * (FARM_BAND[0] + span * ((a % 1000) / 1000)), FARM_PIXEL_SIDE * (FARM_BAND[0] + span * ((b % 1000) / 1000))];
}

/**
 * @param {{
 *   collider: () => any,                                   // the exterior collider (addMesh / removeBucket / heightAt)
 *   pixelTranslation: (px:number, py:number) => number[],  // the pixel's scene translation, live under the floating origin
 *   floatingFrame?: () => any,                             // PERF-COL2 (AUDIT): the frame it rides (player/collider.js onFloatingFrame)
 *   pixelBuilt: (px:number, py:number) => any,             // the built pixel's record (texRemap, season), or null
 *   farmBlockNear: (px:number, py:number, key:string) => ({ models: Array<{modelIdNum:number, matrix:any, enhancedOnly?:boolean}>, side:number } | null),
 *   getGpuMesh: (id:number) => Promise<any>,
 *   cpuModel: (id:number) => any,                          // { positions, indices }
 *   prepare: (gpu:any, pixel:any) => Promise<void>,        // the pixel's climate remap for the model's textures
 *   spotOk: (sceneX:number, sceneZ:number, radius:number) => boolean,   // off roads, out of the sea, out of any town
 *   feet: () => (number[] | null),                         // the player's scene feet
 *   mode: () => string,                                    // 'exterior' | 'dungeon' | 'interior'
 *   enhanced?: () => boolean,
 * }} deps
 */
export function createBountyFarms(deps) {
  /** id -> { id, px, py, lx, lz, ly, models: [{gpu, local}] | null, wanted, gen, bucket, failed } */
  const farms = new Map();
  let gen = 0;
  const _world = new Float32Array(16);

  function takeDown(f) {
    try { deps.collider()?.removeBucket?.(f.bucket); } catch { /* the collider went with the scene */ }
    farms.delete(f.id);
  }
  function destroyAll() { for (const f of [...farms.values()]) takeDown(f); }

  /** Where the farm's centre is in the scene now. */
  const centreOf = (f) => { const t = deps.pixelTranslation(f.px, f.py); return [t[0] + f.lx, t[1] + f.ly, t[2] + f.lz]; };
  /** AUDIT 28 B13: whether scene point (x, z) falls within `r` metres of a standing farm's block (not `except`) - a
   *  second farm's spot and a split hunt's trail spot keep out of one that stands. */
  const occupied = (x, z, r = 0, except = null) => {
    for (const f of farms.values()) {
      if (f === except || !f.models || !Number.isFinite(f.half)) continue;
      const c = centreOf(f);
      if (Math.abs(x - c[0]) < f.half + r && Math.abs(z - c[2]) < f.half + r) return true;
    }
    return false;
  };
  /** Where the farmhouse stands in the scene now. */
  const houseOf = (f) => { const t = deps.pixelTranslation(f.px, f.py); const h = f.house ?? [f.lx, f.ly, f.lz]; return [t[0] + h[0], t[1] + h[1], t[2] + h[2]]; };

  async function stand(f) {
    const myGen = f.gen = ++gen;
    const block = deps.farmBlockNear(f.px, f.py, f.id);   // BOUNTY-FARM-PICK: the notice picks among the nearest farms
    const pixel = deps.pixelBuilt(f.px, f.py);
    if (!block?.models?.length || !pixel) { f.failed = true; return; }
    const half = (block.side ?? 0) / 2;
    const t = deps.pixelTranslation(f.px, f.py);
    const col = deps.collider();
    if (!col?.heightAt) { f.retry = FARM_RETRY_SYNCS; return; }
    // the spot: every roll clear of roads, the sea and towns, measured on a 3x3 over the block - the flattest wins
    let spot = null, best = Infinity, unbuilt = false;
    for (let k = 0; k < FARM_SPOT_TRIES; k++) {
      const [lx, lz] = farmSpotLocal(f.id, k);
      if (!deps.spotOk(t[0] + lx, t[2] + lz, half + 4) || occupied(t[0] + lx, t[2] + lz, half + 4, f)) continue;   // AUDIT 28 B13: nor on another farm
      let lo = Infinity, hi = -Infinity;
      for (const dx of [-half, 0, half]) for (const dz of [-half, 0, half]) {
        const h = col.heightAt(t[0] + lx + dx, t[2] + lz + dz);
        if (Number.isFinite(h)) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
      }
      if (!Number.isFinite(lo)) { unbuilt = true; continue; }
      if (hi - lo > FARM_MAX_RISE_M) continue;   // BOUNTY-FARM-GROUND: a mountainside is no farmyard
      if (hi - lo < best) { best = hi - lo; spot = [lx, lz]; }
    }
    if (!spot) { if (unbuilt) f.retry = FARM_RETRY_SYNCS; else f.failed = true; return; }   // a far pixel's ground is not up yet - try again
    f.lx = spot[0]; f.lz = spot[1]; f.half = half;
    const centreGround = col.heightAt(t[0] + f.lx, t[2] + f.lz);
    f.ly = (Number.isFinite(centreGround) ? centreGround : 0) - t[1];
    // the block's own frame runs 0..side: its middle goes on the spot; each model's height is then its own ground's
    const origin = trs(f.lx - half, 0, f.lz - half, 0, 0, 0);
    const models = [];
    for (const placed of block.models) {
      if (placed.enhancedOnly && !(deps.enhanced?.() ?? false)) continue;
      let gpu = null;
      try { gpu = await deps.getGpuMesh(placed.modelIdNum); } catch { gpu = null; }
      if (farms.get(f.id) !== f || f.gen !== myGen) return;   // taken down (or stood again) while the meshes came
      if (!gpu) continue;
      try { await deps.prepare(gpu, pixel); } catch { /* an undressed wall is still a wall */ }
      if (farms.get(f.id) !== f || f.gen !== myGen) return;
      const local = multiply(origin, placed.matrix);
      const g = col.heightAt(t[0] + local[12], t[2] + local[14]);
      local[13] = (Number.isFinite(g) ? g - t[1] : f.ly) + placed.matrix[13] - FARM_SINK_M;   // on the ground under ITSELF
      models.push({ gpu, local, id: placed.modelIdNum });
    }
    if (!models.length) { f.failed = true; return; }
    const live = deps.collider();
    if (live?.addMesh) {
      const tr0 = () => deps.pixelTranslation(f.px, f.py);   // the pixel's own buckets' law: the translation rides the ray
      const tr = deps.floatingFrame ? onFloatingFrame(deps.floatingFrame(), tr0) : tr0;   // PERF-COL2 (AUDIT): filed by place, as the pixel's own
      for (const m of models) {
        const cpu = deps.cpuModel(m.id);
        if (cpu?.positions && cpu.indices) live.addMesh(f.bucket, cpu.positions, cpu.indices, m.local, tr);
      }
    }
    // the farmhouse: the model with the widest footprint - where a farm bounty's pack makes its stand
    // BOUNTY-FARM-CLEAR: and every building's footprint, pixel-local, so no foe of the pack stands inside one
    let house = null, widest = -1;
    const boxes = [];
    for (const m of models) {
      const pos = deps.cpuModel(m.id)?.positions;
      if (!pos?.length) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); y1 = Math.max(y1, pos[i + 1]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]); }
      const area = (x1 - x0) * (z1 - z0);
      if (area > widest) { widest = area; house = m; }
      // a fence or a sign is not a building: only models tall and wide enough to hold a foe
      if (y1 - y0 < 2 || Math.min(x1 - x0, z1 - z0) < 1.5) continue;
      const L = m.local;
      let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
      for (const cx of [x0, x1]) for (const cz of [z0, z1]) {
        const wx = L[0] * cx + L[8] * cz + L[12], wz = L[2] * cx + L[10] * cz + L[14];
        bx0 = Math.min(bx0, wx); bx1 = Math.max(bx1, wx); bz0 = Math.min(bz0, wz); bz1 = Math.max(bz1, wz);
      }
      boxes.push([bx0, bz0, bx1, bz1]);
    }
    f.boxes = boxes;
    f.house = house ? [house.local[12], house.local[13], house.local[14]] : [f.lx, f.ly, f.lz];
    f.models = models;
  }

  /**
   * Bring the farms in line with the bounties held. `wanted` is every held farm bounty: [{ id, px, py }].
   * Call a few times a second.
   */
  function sync(wanted) {
    if (deps.mode() !== 'exterior') { destroyAll(); return; }
    const want = new Map((wanted ?? []).map((w) => [w.id, w]));
    const feet = deps.feet();
    for (const f of [...farms.values()]) {
      f.wanted = want.has(f.id);
      if (f.retry > 0 && --f.retry === 0) { takeDown(f); continue; }   // the ground was not up: stood afresh below
      if (!deps.pixelBuilt(f.px, f.py)) { takeDown(f); continue; }   // its pixel unloaded: down, stood again on return
      if (!f.wanted && f.models) {
        const c = centreOf(f);
        if (!feet || Math.hypot(feet[0] - c[0], feet[2] - c[2]) > FARM_LINGER_M) takeDown(f);   // over, and out of sight
      } else if (!f.wanted && !f.models) takeDown(f);   // over before it ever stood
    }
    for (const w of want.values()) {
      if (farms.has(w.id) || !deps.pixelBuilt(w.px, w.py)) continue;
      const f = { id: w.id, px: w.px, py: w.py, lx: 0, lz: 0, ly: 0, models: null, wanted: true, gen: 0, bucket: FARM_BUCKET + w.id, failed: false, retry: 0 };
      farms.set(w.id, f);
      stand(f).catch(() => { f.failed = true; });
    }
  }

  /** The farms, in the host's world pass. */
  function draw(r) {
    if (!r?.drawMesh) return 0;
    let n = 0;
    for (const f of farms.values()) {
      if (!f.models) continue;
      const pixel = deps.pixelBuilt(f.px, f.py);
      const t = deps.pixelTranslation(f.px, f.py);
      const pm = trs(t[0], t[1], t[2], 0, 0, 0);
      for (const m of f.models) { r.drawMesh(m.gpu, multiply(pm, m.local, _world), pixel?.texRemap ?? null); n++; }
    }
    return n;
  }

  return {
    sync, draw, destroyAll,
    /** The farm's centre in the scene, once it stands - where a farm bounty's pack makes its stand. */
    anchorFor: (id) => { const f = farms.get(id); return f?.models ? houseOf(f) : null; },   // the farmhouse, not the block's middle
    /** Has this bounty's farm been tried and failed (no farm block, no clear spot)? Its pack then stands as any other. */
    failed: (id) => !!farms.get(id)?.failed,
    standing: () => [...farms.values()].filter((f) => f.models).map((f) => f.id),
    occupied: (x, z, r = 0) => occupied(x, z, r),
    /** BOUNTY-FARM-CLEAR: whether scene point (x, z) is inside (or within `r` metres of) any standing farm's building. */
    inBuilding: (x, z, r = FARM_BUILDING_CLEAR_M) => {
      for (const f of farms.values()) {
        if (!f.models || !f.boxes?.length) continue;
        const t = deps.pixelTranslation(f.px, f.py);
        const lx = x - t[0], lz = z - t[2];
        for (const b of f.boxes) if (lx > b[0] - r && lx < b[2] + r && lz > b[1] - r && lz < b[3] + r) return true;
      }
      return false;
    },
  };
}
