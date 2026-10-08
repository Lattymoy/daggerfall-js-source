// SNOWFALL1 (2026-10-08): THE SNOW, STOOD ROUND THE PLAYER - DynamicSnowController, MidDetailSnowRing, StreamedSnow-
// BlanketPrototype, FarTrackMask, SnowContextData and BlanketSurfaceSamples, ported off the assembly over the law in
// systems/snowfall.js. GL-free: it keeps the meshes and the masks as arrays and says what changed; render/snowfall-
// Surface.js uploads and draws them, and scenes/snowfallHost.js hands it the frame and the world.
//
// THE TIERS, as the mod stands them:
//   - THE LOCAL WINDOW: a grid of MeshResolution (161) vertices a side over (SnowRadius + 12) x 2 metres (88 m)
//     round the player, snapped to its own lattice, recentred off-screen (progressively, a budget of terrain samples a
//     frame) when the player is RecenterDistance (6 m) from its centre; its masks - the tracks (MaskResolution 256 a
//     side), the ground's static snow and the context - scroll with it. It draws only while the middle ring is not
//     ready round the player.
//   - THE MIDDLE RING: 257 vertices a side over 320 m, rebuilt round the player (snapped to 10 m) when the player is
//     20 m from its centre, its tracks a 641-pixel history at 0.5 m; it draws to 128 m and morphs toward the blanket's
//     surface over its outer band.
//   - THE BLANKET: 65 x 65 vertices over every loaded terrain tile, its context sampled at its vertices and its
//     coverage a tile's, with a hole round the nearer tier; the far track mask (641 pixels at 1 m, 320 m round) darkens
//     the tracks on it.
// THE TRACKS: the player's every StampSpacing (0.25 m) while grounded, out of water and off a levitation; every
// grounded foe's and every townsperson's within 320 m every 0.1 s; a body's hollow where a foe fell outdoors. Pressed
// into the persistent field (the save's) and the three masks; refilled by the game hours (12, 1.5 in a snowfall).
//
// The world it reads is the host's (`world`): the loaded terrain tiles (their TileMap, the drawn ground's height and
// normal, the winter archive, their Basic Roads classification), the locations round a point and the scene's global
// metres - see `SnowWorld` below.

import {
  SnowpackState, resolveSnowDepth, encodeStaticSnow, staticSnowMultiplier, snapToGrid, fullSnowMask, rasterizeTrack,
  scrollMask, containsDeformation, snowContactRamp, PersistentTrackField, CorpseImpressions, contextOf, SNOW_EXCLUDED,
  outsideWeight, rectWeight, pathEdgeDistance, interpolateQuad, snowfallSettings,
} from './snowfall.js';
import { roundToInt } from './mathf.js';
import { dateFromClassicMinutes, seasonValue, SEASONS } from './gameDate.js';
import { getWorldClimateSettings, CLIMATE_BASE_TYPES } from '../formats/mapsFile.js';

const f32 = Math.fround;

// ---- the constants the assembly carries ---------------------------------------------------------------------------
export const SNOW_SURFACE_OFFSET = f32(0.008);
export const SNOW_GUARD_BAND = 12;   // LocalGuardBand: the window's grid reaches 12 m past the snow radius
const TERRAIN_RETRY_SECONDS = 0.25;
const REFILL_INTERVAL_SECONDS = 0.5;
const MAX_STATIC_MASK = 192;
const RECENTER_SAMPLES = 1024, FULL_REBUILD_SAMPLES = 3072, CATCH_UP_SAMPLES = 4096;
/** THE PORT'S PACE (Port-Ledger A, SNOWFALL1): the progressive builds - the window's recentre, the ring's, a blanket
 *  tile's - stop for the frame once the frame's snow has spent this many milliseconds, under the mod's own sample
 *  budgets (never faster than the mod, slower where JavaScript is): the mod's per-frame counts cost a C# frame a
 *  millisecond or two and a JavaScript one up to ten, and a build a frame late is a frame the old tier still stands. */
export const SNOW_FRAME_BUDGET_MS = 2;
const BUDGET_CHECK = 127;   // the clock asked every 128 samples
const clockMs = () => globalThis.performance?.now?.() ?? Date.now();
const RETARGET_DELAY_SECONDS = 0.05;
const MAX_PENDING_TRACKS = 256;
const HARD_BOUNDARY_CONTACT_WIDTH = 3;
const NPC_SAMPLE_INTERVAL_SECONDS = 0.1;
const MAX_NPC_SEGMENT = 4;
const MAX_NPC_TRACK_DISTANCE_SQ = 102400;   // 320 m
/** MidDetailSnowRing. */
export const MID = Object.freeze({ radius: 160, visible: 128, overlap: 24, mesh: 257, staticRes: 321, samples: 4096, catchUp: 8192, recenter: 20, snap: 10, history: 641, pendingMax: 512, historyUpload: 0.1, clipStart: 104 });
/** StreamedSnowBlanketPrototype. */
export const BLANKET = Object.freeze({ mesh: 65, staticRes: 128, samplesPerFrame: 1024, pruneSeconds: 5 });
/** FarTrackMask. */
export const FAR = Object.freeze({ res: 641, radius: 320, recenter: 48, snap: 16 });

/**
 * @typedef {object} SnowTerrain - one loaded terrain tile (a map pixel's ground) as the snow reads it
 * @property {number} mapX
 * @property {number} mapY
 * @property {number} size - metres a side (819.2)
 * @property {Uint8Array} tileMap - DaggerfallTerrain.TileMap's bytes (record << 2 | turn), 128 x 128, row 0 south
 * @property {number} winterArchive - SnowCoverageData.GetWinterArchive
 * @property {(out: number[]) => number[]} origin - the tile's scene origin [x, y, z] now (its south-west corner)
 * @property {(lx: number, lz: number) => number} height - the drawn ground's y in the tile's frame
 * @property {(lx: number, lz: number, out: number[]) => number[]} normal - the ground's unit normal there
 * @property {(lx: number, lz: number) => boolean} [bare] - a place the port stands no snow whatever its tile (the carved sea)
 * @property {any} roads - its BasicRoadsTerrain (systems/snowfall.js) or null
 * @property {any} [stamp] - changes when the tile's ground is rebuilt (DaggerfallTerrain.OnPromoteTerrainData)
 */
/**
 * @typedef {object} SnowWorld
 * @property {(x: number, z: number) => (SnowTerrain|null)} terrainAt - the loaded tile under a scene point
 * @property {(ring: number) => SnowTerrain[]} terrainsNear - the loaded tiles within `ring` pixels of the player's, nearest ring first
 * @property {(minX: number, minZ: number, maxX: number, maxZ: number) => SnowTerrain[]} terrainsIn - the loaded tiles on the map pixels a global box (metres) touches, row by row (SnowContextData.Prepare's scan: StreamingWorld.GetTerrainFromPixel on each)
 * @property {(x: number, z: number) => number[]} toGlobal - a scene point in global metres (WorldX / SceneMapRatio)
 * @property {(minX: number, minZ: number, maxX: number, maxZ: number) => {minX:number,minZ:number,maxX:number,maxZ:number}[]} settlements - the vanilla locations' rectangles (global metres) on the map pixels the box touches
 * @property {(gx: number, gz: number, radius: number) => any[]} [footprints] - Location Loader's authored footprints near a global point
 * @property {number} [terrainDistance] - StreamingWorld.TerrainDistance
 */

const v3 = () => [0, 0, 0];
/** Vector2.Distance, in float. */
const distanceF = (ax, ay, bx, by) => { const dx = f32(ax - bx), dy = f32(ay - by); return f32(Math.sqrt(f32(f32(dx * dx) + f32(dy * dy)))); };
const steepnessOf = (n) => Math.acos(Math.max(-1, Math.min(1, n[1]))) * (180 / Math.PI);   // TerrainData.GetSteepness: the normal's angle to up

// ---- SnowContextData's sampling ------------------------------------------------------------------------------------
/** SnowContextData: the vanilla locations, the authored footprints and the Basic Roads tiles round a centre, and the
 *  four weights a place takes from them (settlement, location cap, path, berm). */
export class SnowContext {
  /** @param {SnowWorld} world */
  constructor(world, coverage) {
    this.world = world;
    this.coverage = coverage;
    this.settlements = [];
    this.locations = [];
    this.roads = [];
    this.settings = null;
    this.settlementFeather = 0;
    this.locationFeather = 0;
  }

  /** Prepare(sceneCenter, radius, feather, loaderFeather, settings). */
  prepare(cx, cz, radius, feather, loaderFeather, s) {
    this.settlements = []; this.roads = [];
    this.settings = s;
    this.settlementFeather = feather;
    this.locationFeather = loaderFeather;
    const [gx, gz] = this.world.toGlobal(cx, cz);
    this.locations = s?.locationLoaderIntegration && this.world.footprints ? this.world.footprints(gx, gz, radius + loaderFeather) : [];
    const reach = s?.basicRoadsIntegration ? Math.max(s.pathBoundaryFeather, s.roadBermWidth) : 0;
    const span = Math.ceil((radius + Math.max(feather, reach)) * 40) / 40;
    const minGX = Math.max(0, gx - span), minGZ = Math.max(0, gz - span), maxGX = Math.min(819200, gx + span), maxGZ = Math.min(409600, gz + span);
    if (s?.basicRoadsIntegration) {
      for (const t of this.world.terrainsIn(minGX, minGZ, maxGX, maxGZ)) {   // AUDIT ENVIRONS S1: the box's own map pixels, wherever the player stands
        const roads = t.roads;
        if (!roads || (roads.pathTiles === 0 && roads.roadTiles === 0)) continue;
        const o = t.origin(v3());
        const [ox, oz] = this.world.toGlobal(o[0], o[2]);
        this.roads.push({ data: roads, x: ox, z: oz, tileMetres: f32(t.size / 128), archive: t.winterArchive, mapX: t.mapX, mapY: t.mapY });
      }
    }
    this.settlements = this.world.settlements(minGX, minGZ, maxGX, maxGZ);
  }

  /** Sample(scenePosition): Color32(settlement, location cap, path, berm). */
  sample(x, z, out = new Uint8Array(4), o = 0) {
    let path = 0, berm = 0;
    const s = this.settings;
    if (this.roads.length && s) {
      const [gx, gz] = this.world.toGlobal(x, z);
      for (const r of this.roads) {
        const tx = f32((gx - r.x) / r.tileMetres), tz = f32((gz - r.z) / r.tileMetres);
        if (tx < -1 || tz < -1 || tx > 129 || tz > 129) continue;
        path = Math.max(path, r.data.samplePath(tx, tz, r.tileMetres, s.pathBoundaryFeather));
        if (s.roadBermsEnabled && this.coverage) berm = Math.max(berm, r.data.sampleBerm(tx, tz, r.tileMetres, s.roadBermWidth, r.archive, this.coverage));
      }
    }
    out[o] = this.sampleSettlement(x, z); out[o + 1] = this.sampleLocationCap(x, z); out[o + 2] = path; out[o + 3] = berm;
    return out;
  }

  /** PathTile(scenePosition, out tileUv): the track tile under a point, and the point's place in it. */
  pathTile(x, z) {
    if (!this.roads.length) return null;
    const [gx, gz] = this.world.toGlobal(x, z);
    for (const r of this.roads) {
      const tx = f32((gx - r.x) / r.tileMetres), tz = f32((gz - r.z) / r.tileMetres);
      if (tx < 0 || tz < 0 || tx >= 128 || tz >= 128) continue;
      const ix = Math.floor(tx), iz = Math.floor(tz);
      return { tile: r.data.pathTile(ix, iz), u: f32(tx - ix), v: f32(tz - iz) };
    }
    return null;
  }
  /** PathLandCoverage: 1 on a track's painted ground. */
  pathLandCoverage(x, z) {
    const p = this.pathTile(x, z);
    return p && p.tile !== 0 && pathEdgeDistance(p.tile, p.u, p.v) <= 0 ? 1 : 0;
  }
  /** PathTile(mapX, mapY, tileX, tileZ). */
  pathTileAt(mapX, mapY, tx, tz) {
    for (const r of this.roads) if (r.mapX === mapX && r.mapY === mapY) return r.data.pathTile(tx, tz);
    return 0;
  }
  sampleSettlement(x, z) {
    if (!this.settlements.length) return 0;
    const [gx, gz] = this.world.toGlobal(x, z);
    return rectWeight(this.settlements, gx, gz, this.settlementFeather);
  }
  sampleLocationCap(x, z) {
    if (!this.locations.length) return 0;
    const [gx, gz] = this.world.toGlobal(x, z);
    return rectWeight(this.locations, gx, gz, this.locationFeather);
  }
}

// ---- the static snow a terrain sample takes ------------------------------------------------------------------------
/** TrySampleStaticSnow: the tile's coverage (its mask under its turn; a record off the masks is snow unless it is
 *  record 0), raised to 1 on a track's painted ground, and the depth multiplier the slope leaves - encoded into `out`
 *  at `o`. False where no loaded terrain holds the point. */
function sampleStaticSnow(world, coverage, context, s, x, z, out, o) {
  const t = world.terrainAt(x, z);
  if (!t || !t.tileMap || t.tileMap.length < 16384) return false;
  const og = t.origin(_o);
  const lx = x - og[0], lz = z - og[2];
  const u = Math.max(0, Math.min(1, f32(lx / t.size))), v = Math.max(0, Math.min(1, f32(lz / t.size)));
  const fx = f32(128 * u), fz = f32(128 * v);
  const ix = Math.max(0, Math.min(127, Math.trunc(fx))), iz = Math.max(0, Math.min(127, Math.trunc(fz)));
  const tile = t.tileMap[iz * 128 + ix];
  let cov = t.bare?.(lx, lz) ? 0 : coverage.sample(t.winterArchive, tile, Math.max(0, Math.min(1, f32(fx - ix))), Math.max(0, Math.min(1, f32(fz - iz))));
  if (cov === null) cov = tile >> 2 !== 0 ? 1 : 0;
  cov = Math.max(cov, context.pathLandCoverage(x, z));
  const mult = cov > 0 ? staticSnowMultiplier(cov, f32(steepnessOf(t.normal(lx, lz, _n))), s.maxSnowSlope) : 0;
  encodeStaticSnow(mult, cov, out, o);
  return true;
}
const _o = v3(), _n = v3();

/** The pixels of a mask a frame changed, for a partial upload (Texture2D.SetPixel before Apply): a rectangle grown by
 *  each pixel written; `full` when the whole mask changed (a scroll, a refill, a projection). */
export class DirtyRect {
  constructor() { this.full = true; this.x0 = Infinity; this.z0 = Infinity; this.x1 = -1; this.z1 = -1; }
  all() { this.full = true; }
  add(x, z) { if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (z < this.z0) this.z0 = z; if (z > this.z1) this.z1 = z; }
  get any() { return this.full || this.x1 >= 0; }
  /** What to upload, and the rectangle cleared: null for nothing. */
  take() {
    if (!this.any) return null;
    const out = this.full ? { full: true } : { full: false, x: this.x0, z: this.z0, w: this.x1 - this.x0 + 1, h: this.z1 - this.z0 + 1 };
    this.full = false; this.x0 = Infinity; this.z0 = Infinity; this.x1 = -1; this.z1 = -1;
    return out;
  }
}

// ---- the runtime ---------------------------------------------------------------------------------------------------
export class SnowfallRuntime {
  /**
   * @param {object} o
   * @param {SnowWorld} o.world
   * @param {any} o.coverage - systems/snowfall.js SnowCoverage over the mod's three masks
   * @param {any} [o.settings] - systems/snowfall.js snowfallSettings()
   * @param {number} [o.frameBudgetMs] - SNOW_FRAME_BUDGET_MS (Infinity: the mod's sample budgets alone)
   * @param {() => number} [o.clock] - milliseconds, for the budget
   */
  constructor({ world, coverage, settings = snowfallSettings(), frameBudgetMs = SNOW_FRAME_BUDGET_MS, clock = clockMs }) {
    this.world = world;
    this.frameBudgetMs = frameBudgetMs;
    this.clock = clock;
    this.frameStart = 0;
    this.coverage = coverage;
    this.settings = settings;
    const toGlobal = (x, z) => world.toGlobal(x, z);
    this.snowpack = new SnowpackState();
    this.snowpack.configure(settings, false);
    this.tracks = new PersistentTrackField(toGlobal);
    this.corpses = new CorpseImpressions(toGlobal);
    this.corpses.enabled = settings.corpseImpressionsEnabled;
    this.corpses.width = settings.corpseImpressionWidth;
    this.context = new SnowContext(world, coverage);
    this.corpseScanPending = true;
    this.corpseProjectionPending = false;
    this.lastGameSeconds = 0;
    this.nextRefillTime = 0;
    this.refillRemainder = 0;
    this.isSnowing = false;
    this.hasEnvironmentEligibility = false;
    this.lastEnvironmentEligible = false;
    this.npcTargets = new Map();
    this.nextNpcSampleTime = 0;
    this.npcSegmentsWritten = 0; this.npcSamplePasses = 0;
    this.stampAttempts = 0; this.stampsWritten = 0; this.lastStampChanged = 0; this.lastStampStatus = 'not evaluated';
    this.staleCancellations = 0;
    this.local = this._newLocal();
    this.mid = this._newMid();
    this.blanket = this._newBlanket();
    this.far = this._newFar();
    this.snowpack.resetClock(0);
    /** what changed since the GL layer last asked (render/snowfallSurface.js) */
    this.dirty = { localMesh: true, localStatic: true, mid: true, blanket: new Set(), depths: true };
    /** the three track masks' changed pixels */
    this.rects = { local: new DirtyRect(), mid: new DirtyRect(), far: new DirtyRect() };
  }

  // ---- the settings ----
  get gridRadius() { return f32(this.settings.snowRadius + SNOW_GUARD_BAND); }
  get gridDiameter() { return f32(this.gridRadius * 2); }
  get maskTexel() { return f32(this.gridDiameter / (this.settings.maskResolution - 1)); }
  get staticRes() { return Math.min(Math.min(this.settings.maskResolution, this.settings.meshResolution), MAX_STATIC_MASK); }
  get staticTexel() { return f32(this.gridDiameter / (this.staticRes - 1)); }
  get meshCell() { return f32(this.gridDiameter / (this.settings.meshResolution - 1)); }
  get renderedDepth() { return this.settings.debugSnowDepthOverride > 0 ? this.settings.debugSnowDepthOverride : f32(this.snowpack.wildernessDepth); }
  get renderedSettlementDepth() { return this.settings.debugSnowDepthOverride > 0 ? this.settings.debugSnowDepthOverride : f32(this.snowpack.settlementDepth); }
  get renderedLocationDepth() { return this.settings.debugSnowDepthOverride > 0 ? this.settings.debugSnowDepthOverride : this.settings.locationLoaderMaximumDepth; }

  /**
   * DynamicSnowMod.LoadSettings / ApplySettings: the change's rebuilds, as the mod decides them from the keys that
   * changed.
   */
  applySettings(next) {
    const prev = this.settings;
    if (!next || next === prev) return;
    const changed = (...keys) => keys.some((k) => prev[k] !== next[k]);
    const rebuildGrid = changed('snowRadius', 'meshResolution', 'maskResolution');
    const rebuildStatic = changed('maxSnowSlope', 'basicRoadsIntegration');
    const rebuildContext = changed('settlementBoundaryFeather', 'locationLoaderIntegration', 'locationLoaderBoundaryFeather', 'basicRoadsIntegration', 'pathBoundaryFeather', 'roadBermsEnabled', 'roadBermWidth');
    const reevaluate = changed('activationOverride');
    const resetPhase = changed('snowfallDepthStep', 'snowfallDepthHours', 'meltDepthStep', 'meltDepthHours');
    const L = this.local;
    if (rebuildGrid || rebuildStatic || reevaluate) { L.recentering = false; L.fullRebuild = false; }
    this.settings = next;
    if (this.corpses.enabled !== next.corpseImpressionsEnabled && next.corpseImpressionsEnabled) this.corpseScanPending = true;
    this.corpses.enabled = next.corpseImpressionsEnabled;
    this.corpses.width = next.corpseImpressionWidth;
    if (!this.corpses.enabled) this.corpses.clear();
    this.corpseProjectionPending = true;
    this.snowpack.configure(next, resetPhase);
    if (rebuildGrid) L.resourceRebuild = true;
    if (rebuildStatic || reevaluate) L.staticRebuild = true;
    if (rebuildContext && !rebuildGrid && !rebuildStatic && !reevaluate) this._rebuildCommittedContext();
    if (rebuildContext) this.blanket.contextRevision++;
    if (rebuildStatic || reevaluate) this.mid.rebuildPending = true;
    else if (rebuildContext) { this.mid.rebuildPending = true; this.mid.building = false; }
  }

  // ---- the local window (DynamicSnowController) ----
  _newLocal() {
    const s = this.settings, res = s.meshResolution, mres = s.maskResolution, sres = this.staticRes;
    const n = res * res;
    const L = {
      res, mres, sres,
      pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), uv: new Float32Array(n * 2),
      nextPos: new Float32Array(n * 3), nextNrm: new Float32Array(n * 3),
      index: null,
      dynamic: fullSnowMask(mres), scroll: fullSnowMask(mres),
      statics: new Uint8Array(sres * sres * 4), nextStatics: new Uint8Array(sres * sres * 4),
      context: new Uint8Array(sres * sres * 4), nextContext: new Uint8Array(sres * sres * 4),
      center: [0, 0], dynCenter: [0, 0], statCenter: [0, 0], lattice: [0, 0], baseY: 0,
      hasCenter: false, meshReady: false, staticReady: false,
      heightRebuild: true, staticRebuild: true, resourceRebuild: false,
      requiresFullProjection: true, hasDeformation: false,
      recentering: false, fullRebuild: false, nextCenter: [0, 0], nextDyn: [0, 0], nextStat: [0, 0],
      meshDelta: [0, 0], statDelta: [0, 0], meshCursor: 0, statCursor: 0, nextRetry: 0,
      lastStamp: [0, 0], hasLastStamp: false,
      pending: [],
      visible: false,
    };
    const normal = encodeStaticSnow(1, 1);
    for (let k = 0; k < sres * sres; k++) L.statics.set(normal, k * 4);
    L.context.fill(0);
    for (let i = 0; i < res; i++) {
      const v = f32(i / (res - 1));
      for (let j = 0; j < res; j++) { const k = i * res + j; L.uv[k * 2] = f32(j / (res - 1)); L.uv[k * 2 + 1] = v; }
    }
    L.index = gridIndices(res);
    return L;
  }

  // ---- the frame ----
  /**
   * DynamicSnowController.Update. `f`: { now (real seconds), frame, inside, enabled (the host: the enhanced lane and the
   * mod's switch), player { x, y, z, grounded, swimming, levitating } (scene metres, feet), winter, desert, snowing,
   * gameSeconds, npcs [{ id, x, z, active, grounded, radius, citizen }] (a foe's controller radius; a townsperson is a
   * citizen), corpses [{ id, x, z, alive() }] (the scan: every body lying outdoors, global metres) }.
   */
  frame(f) {
    const s = this.settings;
    let L = this.local;
    this.frameStart = this.clock();
    if (L.resourceRebuild) { this._rebuildGrid(); L = this.local; }   // AUDIT ENVIRONS S3: CreateGridResources - the frame goes on with the new window
    this._updateEligibility(f);
    if (this.corpseScanPending) {
      this.corpseScanPending = false;
      if (this.corpses.enabled) for (const c of f.corpses ?? []) this.corpses.register(c);
      this.corpseProjectionPending = true;
    }
    this._processSnowpack(f);
    this._processRefill(f);
    if (!s.enabled || !this.lastEnvironmentEligible || f.inside || !f.player) {
      this._midTick(false, null, f, false);
      this._blanketTick(false, null, f, false, s.snowRadius);
      L.visible = false;
      L.hasLastStamp = false;
      this._resetNpcAnchors();
      return this.visibleTiers();
    }
    const px = f.player.x, pz = f.player.z;
    this.outerCenter = [px, pz];   // ApplyVisibleHandoff: the window's outer clip rides the player
    if (!L.hasCenter) {
      L.center = snapToGrid(px, pz, this.meshCell, L.lattice[0], L.lattice[1]);
      L.dynCenter = snapToGrid(px, pz, this.maskTexel, L.lattice[0], L.lattice[1]);
      L.statCenter = snapToGrid(px, pz, this.staticTexel, L.lattice[0], L.lattice[1]);
      L.hasCenter = true;
      L.heightRebuild = true; L.staticRebuild = true;
    }
    if (L.recentering && Math.hypot(px - L.nextCenter[0], pz - L.nextCenter[1]) > Math.max(s.recenterDistance * 1.5, 9)) this._cancelForRetarget(f);
    if (!L.recentering && (L.heightRebuild || L.staticRebuild) && f.now >= L.nextRetry) this._beginRecenter(px, pz, true);
    else if (!L.recentering && L.meshReady && L.staticReady && f.now >= L.nextRetry && Math.hypot(px - L.center[0], pz - L.center[1]) > s.recenterDistance) this._beginRecenter(px, pz, false);
    if (L.recentering) this._processRecenter(px, pz, f);
    L.visible = L.meshReady && L.staticReady;
    if (L.meshReady && L.staticReady) { this._stampPlayer(f); this._stampNpcs(f); } else this._resetNpcAnchors();
    if (this.corpseProjectionPending) {
      this.corpseProjectionPending = false;
      this._projectCorpsesLocal();
      this._midProjectCorpses();
      this._farProjectCorpses();
    }
    const distant = s.streamedBlanketPrototype && s.distantTracksEnabled;
    this._farTick(distant, px, pz);
    const allowBuild = !L.recentering && !L.heightRebuild && !L.staticRebuild;
    const midShown = this._midTick(true, [px, pz], f, allowBuild);
    L.visible = L.meshReady && L.staticReady && !midShown;
    this._blanketTick(true, [px, pz], f, allowBuild && !this.mid.building, midShown ? MID.visible : s.snowRadius);
    return this.visibleTiers();
  }

  /** What the GL layer draws this frame, and each tier's uniforms. */
  visibleTiers() {
    return { local: this.local.visible, mid: this.mid.visible, blanket: this.blanket.active, far: this.far.ready && this.settings.streamedBlanketPrototype && this.settings.distantTracksEnabled };
  }

  // UpdateEnvironmentEligibility
  _updateEligibility(f) {
    const s = this.settings;
    const eligible = s.activationOverride === 1 || (s.activationOverride !== 2 && !f.desert && f.winter);
    if (!this.hasEnvironmentEligibility) { this.hasEnvironmentEligibility = true; this.lastEnvironmentEligible = eligible; return; }
    if (eligible === this.lastEnvironmentEligible) return;
    this.lastEnvironmentEligible = eligible;
    const L = this.local;
    L.recentering = false; L.fullRebuild = false;
    if (!eligible) this.clearDynamicMask();
    L.staticReady = false; L.staticRebuild = true;
  }

  // ProcessSnowpack / HandleWeatherChange
  _processSnowpack(f) {
    if (f.snowing !== this.isSnowing) {
      if (this.snowpack.advance(f.gameSeconds, f.winter, f.desert, f.snowing)) this.dirty.depths = true;
      this.isSnowing = f.snowing;
      return;
    }
    if (this.snowpack.advance(f.gameSeconds, f.winter, f.desert, this.isSnowing)) this.dirty.depths = true;
  }

  // ProcessRefill
  _processRefill(f) {
    if (f.now < this.nextRefillTime) return;
    this.nextRefillTime = f.now + REFILL_INTERVAL_SECONDS;
    const now = f.gameSeconds;
    if (this.lastGameSeconds === 0 || now < this.lastGameSeconds) { this.lastGameSeconds = now; this.refillRemainder = 0; return; }
    const elapsed = now - this.lastGameSeconds;
    this.lastGameSeconds = now;
    const L = this.local;
    const deformed = L.hasDeformation || this.mid.hasDeformation || this.tracks.hasDeformation;
    if ((!deformed && !this.corpses.hasImpressions) || elapsed === 0) return;
    const hours = this.isSnowing ? this.settings.snowfallRefillHours : this.settings.passiveRefillHours;
    const all = () => { if (deformed) this.clearDynamicMask(); this.corpseProjectionPending = this.corpses.refill(255) || this.corpseProjectionPending; };
    if (hours <= 0) { all(); return; }
    const share = f32(f32(elapsed) / f32(hours * 3600));
    if (share >= 1) { all(); return; }
    this.refillRemainder = f32(this.refillRemainder + f32(share * 255));
    const step = Math.floor(this.refillRemainder);
    if (step <= 0) return;
    this.refillRemainder = f32(this.refillRemainder - step);
    if (deformed) {
      let any = false;
      const px = L.dynamic;
      for (let k = 0; k < px.length; k += 4) { const r = px[k]; if (r === 255) continue; const v = r + step; if (v >= 255) px[k] = 255; else { px[k] = v; any = true; } }   // a full pixel stays full: skipped
      this.rects.local.all();
      L.hasDeformation = any;
      this._midRefill(step);
      this.tracks.refill(step);
      this._farRefill(step);
    }
    this.corpseProjectionPending = this.corpses.refill(step) || this.corpseProjectionPending;
    if (!L.hasDeformation && !this.mid.hasDeformation && !this.tracks.hasDeformation && !this.corpses.hasImpressions) this.refillRemainder = 0;
  }

  /** ClearDynamicMask(clearPersistent). */
  clearDynamicMask(clearPersistent = true) {
    const L = this.local;
    L.dynamic.fill(255);
    this.rects.local.all();
    L.hasDeformation = false;
    L.hasLastStamp = false;
    this.refillRemainder = 0;
    L.pending.length = 0;
    this._midClearHistory();
    this._farClear();
    if (clearPersistent) this.tracks.clear(); else L.requiresFullProjection = true;
    this.corpseProjectionPending = true;
  }

  _rebuildGrid() {
    const lattice = this.local.lattice;
    this.local = this._newLocal();
    this.local.lattice = lattice;
    this.refillRemainder = 0;   // AUDIT ENVIRONS S8: CreateGridResources' own
    this.dirty.localMesh = this.dirty.localStatic = true; this.rects.local.all();
    this.dirty.gridRebuilt = true;
  }

  // BeginRecenter / BeginFullLocalRebuild
  _beginRecenter(px, pz, full) {
    const L = this.local, s = this.settings;
    L.fullRebuild = full;
    L.nextCenter = snapToGrid(px, pz, this.meshCell, L.lattice[0], L.lattice[1]);
    L.nextDyn = snapToGrid(px, pz, this.maskTexel, L.lattice[0], L.lattice[1]);
    L.nextStat = snapToGrid(px, pz, this.staticTexel, L.lattice[0], L.lattice[1]);
    this.context.prepare(L.nextStat[0], L.nextStat[1], this.gridRadius, s.settlementBoundaryFeather, s.locationLoaderBoundaryFeather, s);
    if (full) { L.meshDelta = [L.res, L.res]; L.statDelta = [L.sres, L.sres]; }
    else {
      L.meshDelta = [roundToInt(f32(f32(L.nextCenter[0] - L.center[0]) / this.meshCell)), roundToInt(f32(f32(L.nextCenter[1] - L.center[1]) / this.meshCell))];
      L.statDelta = [roundToInt(f32(f32(L.nextStat[0] - L.statCenter[0]) / this.staticTexel)), roundToInt(f32(f32(L.nextStat[1] - L.statCenter[1]) / this.staticTexel))];
    }
    L.meshCursor = 0; L.statCursor = 0;
    L.recentering = true;
  }

  // ProcessRecenter
  _processRecenter(px, pz, f) {
    const L = this.local, s = this.settings;
    let budget = L.fullRebuild ? FULL_REBUILD_SAMPLES : RECENTER_SAMPLES;
    if (Math.hypot(px - L.center[0], pz - L.center[1]) > s.snowRadius * 0.65) budget = Math.max(budget, CATCH_UP_SAMPLES);
    const res = L.res, n = res * res, dia = this.gridDiameter;
    while (L.meshCursor < n && budget > 0) {
      const k = L.meshCursor++;
      const i = Math.floor(k / res), j = k - i * res;
      const sj = j + L.meshDelta[0], si = i + L.meshDelta[1];
      const lx = f32(f32(f32(j / (res - 1)) - 0.5) * dia), lz = f32(f32(f32(i / (res - 1)) - 0.5) * dia);
      if (sj >= 0 && sj < res && si >= 0 && si < res) {
        const from = si * res + sj;
        L.nextPos[k * 3] = lx; L.nextPos[k * 3 + 1] = L.pos[from * 3 + 1]; L.nextPos[k * 3 + 2] = lz;
        L.nextNrm.set(L.nrm.subarray(from * 3, from * 3 + 3), k * 3);
        continue;
      }
      const wx = f32(L.nextCenter[0] + lx), wz = f32(L.nextCenter[1] + lz);
      const t = this.world.terrainAt(wx, wz);
      if (!t) { this._cancelForRetry(f); return; }
      const og = t.origin(_o);
      L.nextPos[k * 3] = lx; L.nextPos[k * 3 + 1] = og[1] + t.height(wx - og[0], wz - og[2]) - L.baseY; L.nextPos[k * 3 + 2] = lz;
      const nr = t.normal(wx - og[0], wz - og[2], _n);
      L.nextNrm[k * 3] = nr[0]; L.nextNrm[k * 3 + 1] = nr[1]; L.nextNrm[k * 3 + 2] = nr[2];
      budget--;
      if ((budget & BUDGET_CHECK) === 0 && this._spent()) return;
    }
    if (L.meshCursor < n) return;
    const sres = L.sres, sn = sres * sres;
    while (L.statCursor < sn && budget > 0) {
      const k = L.statCursor++;
      const i = Math.floor(k / sres), j = k - i * sres;
      const sj = j + L.statDelta[0], si = i + L.statDelta[1];
      if (sj >= 0 && sj < sres && si >= 0 && si < sres) {
        const from = (si * sres + sj) * 4;
        L.nextStatics.set(L.statics.subarray(from, from + 4), k * 4);
        L.nextContext.set(L.context.subarray(from, from + 4), k * 4);
        continue;
      }
      const wx = f32(L.nextStat[0] + f32(f32(f32(j / (sres - 1)) - 0.5) * dia));
      const wz = f32(L.nextStat[1] + f32(f32(f32(i / (sres - 1)) - 0.5) * dia));
      if (!sampleStaticSnow(this.world, this.coverage, this.context, s, wx, wz, L.nextStatics, k * 4)) { this._cancelForRetry(f); return; }
      this.context.sample(wx, wz, L.nextContext, k * 4);
      budget--;
      if ((budget & BUDGET_CHECK) === 0 && this._spent()) return;
    }
    if (L.statCursor >= sn) this._commitRecenter();
  }

  // CommitRecenter
  _commitRecenter() {
    const L = this.local;
    const dx = roundToInt(f32(f32(L.nextDyn[0] - L.dynCenter[0]) / this.maskTexel)), dz = roundToInt(f32(f32(L.nextDyn[1] - L.dynCenter[1]) / this.maskTexel));
    if (dx !== 0 || dz !== 0) this._scrollDynamic(dx, dz);
    [L.pos, L.nextPos] = [L.nextPos, L.pos];
    [L.nrm, L.nextNrm] = [L.nextNrm, L.nrm];
    [L.statics, L.nextStatics] = [L.nextStatics, L.statics];
    [L.context, L.nextContext] = [L.nextContext, L.context];
    L.center = [...L.nextCenter]; L.dynCenter = [...L.nextDyn]; L.statCenter = [...L.nextStat];   // copies: the mod's Vector2s are values, and offsetOrigin shifts each array once
    this._restorePersistentTracks(dx, dz);
    snowContactRamp(L.statics, L.sres, L.sres, Math.max(1, Math.ceil(HARD_BOUNDARY_CONTACT_WIDTH / this.staticTexel)));
    L.meshReady = true; L.staticReady = true;
    L.heightRebuild = false; L.staticRebuild = false;
    L.fullRebuild = false; L.recentering = false;
    L.nextRetry = 0;
    this.dirty.localMesh = true; this.dirty.localStatic = true;
    this._replayPendingTracks();
  }

  _rebuildCommittedContext() {
    const L = this.local;
    if (!L.hasCenter) return;
    this._fillContext(L.context, L.statCenter, L.sres * L.sres);
    this.dirty.localStatic = true;
    if (L.recentering) this._fillContext(L.nextContext, L.nextStat, L.statCursor);
  }
  _fillContext(px, center, count) {
    const s = this.settings, L = this.local, dia = this.gridDiameter;
    this.context.prepare(center[0], center[1], this.gridRadius, s.settlementBoundaryFeather, s.locationLoaderBoundaryFeather, s);
    for (let k = 0; k < count; k++) {
      const i = Math.floor(k / L.sres), j = k - i * L.sres;
      this.context.sample(f32(center[0] + f32(f32(f32(j / (L.sres - 1)) - 0.5) * dia)), f32(center[1] + f32(f32(f32(i / (L.sres - 1)) - 0.5) * dia)), px, k * 4);
    }
  }

  _cancelForRetry(f) {
    const L = this.local;
    L.recentering = false; L.fullRebuild = false;
    L.nextRetry = f.now + TERRAIN_RETRY_SECONDS;
  }
  _cancelForRetarget(f) {
    const L = this.local;
    if (L.fullRebuild) { L.heightRebuild = true; L.staticRebuild = true; }
    this.staleCancellations++;
    L.recentering = false; L.fullRebuild = false;
    L.nextRetry = f.now + RETARGET_DELAY_SECONDS;
  }

  // ScrollDynamicMask
  _scrollDynamic(dx, dz) {
    const L = this.local;
    const out = scrollMask(L.dynamic, L.scroll, L.mres, dx, dz);
    this.rects.local.all();
    if (!out) { L.dynamic.fill(255); L.hasDeformation = false; this.refillRemainder = 0; return; }
    L.scroll = L.dynamic; L.dynamic = out;
    L.hasDeformation = containsDeformation(L.dynamic);
    if (!L.hasDeformation && !this.mid.hasDeformation && !this.corpses.hasImpressions) this.refillRemainder = 0;
  }

  // RestorePersistentTracksToLocalMask
  _restorePersistentTracks(dx, dz) {
    const L = this.local;
    if (!L.hasCenter) return;
    let p = [0, -1, 0, -1];
    const r = L.mres;
    if (!L.requiresFullProjection && Math.abs(dx) < r && Math.abs(dz) < r) p = [Math.max(0, -dx), Math.min(r - 1, r - 1 - dx), Math.max(0, -dz), Math.min(r - 1, r - 1 - dz)];
    const n = this.tracks.applyToMask(L.dynamic, r, L.dynCenter[0], L.dynCenter[1], this.gridDiameter, p[0], p[1], p[2], p[3]);
    L.requiresFullProjection = false;
    this._projectCorpsesLocal();
    if (n > 0) { L.hasDeformation = true; this.rects.local.all(); }
  }
  _projectCorpsesLocal() {
    const L = this.local;
    if (L.hasCenter && this.corpses.project(L.dynamic, L.mres, L.dynCenter[0], L.dynCenter[1], this.gridDiameter)) this.rects.local.all();
  }

  // ---- the tracks ----
  // StampPlayer
  _stampPlayer(f) {
    const L = this.local, s = this.settings, p = f.player;
    if (!p.grounded || p.swimming || p.levitating) { this.lastStampStatus = 'not grounded'; L.hasLastStamp = false; return; }
    if (!L.hasLastStamp) { L.lastStamp = [p.x, p.z]; L.hasLastStamp = true; this.lastStampStatus = 'grounded anchor established'; return; }
    const d = distanceF(L.lastStamp[0], L.lastStamp[1], p.x, p.z);
    if (d < s.playerStampSpacing) { this.lastStampStatus = `waiting for spacing: ${d.toFixed(3)}m`; return; }
    this.stampAttempts++;
    if (d > Math.max(2, s.snowRadius * 1.25)) { L.lastStamp = [p.x, p.z]; this.lastStampChanged = 0; this.lastStampStatus = `rejected teleport-sized segment: ${d.toFixed(2)}m`; return; }
    const hit = { inside: false };
    this.lastStampChanged = this._stampTrack(L.lastStamp[0], L.lastStamp[1], p.x, p.z, s.playerTrackWidth, s.playerRemainingSnow, hit);
    if (this.lastStampChanged > 0) this.stampsWritten++;
    this.lastStampStatus = hit.inside ? `segment ${d.toFixed(2)}m changed ${this.lastStampChanged} mask pixels` : `segment ${d.toFixed(2)}m queued until local window catches up`;
    L.lastStamp = [p.x, p.z];
  }

  // StampTrackSegment
  _stampTrack(sx, sz, ex, ez, width, remaining, hit) {
    const L = this.local;
    width = f32(width + f32(this.settings.impressionShoulderWidth * 2));
    this.tracks.stampSegment(sx, sz, ex, ez, width, remaining);
    this._farStamp(sx, sz, ex, ez, width, remaining);
    this._midStamp(sx, sz, ex, ez, width, remaining);
    const R = this.gridRadius;
    const reach = f32(R + f32(width * 0.5));
    const c = L.dynCenter;
    hit.inside = Math.max(sx, ex) >= f32(c[0] - reach) && Math.min(sx, ex) <= f32(c[0] + reach) && Math.max(sz, ez) >= f32(c[1] - reach) && Math.min(sz, ez) <= f32(c[1] + reach);
    const inner = Math.max(0, f32(R - f32(width * 0.5)));
    const fully = Math.abs(f32(sx - c[0])) <= inner && Math.abs(f32(sz - c[1])) <= inner && Math.abs(f32(ex - c[0])) <= inner && Math.abs(f32(ez - c[1])) <= inner;
    if (!fully) { while (L.pending.length >= MAX_PENDING_TRACKS) L.pending.shift(); L.pending.push([sx, sz, ex, ez, width, remaining]); }
    if (!hit.inside) return 0;
    return this._rasterizeLocal(sx, sz, ex, ez, width, remaining);
  }
  _rasterizeLocal(sx, sz, ex, ez, width, remaining) {
    const L = this.local, R = this.gridRadius;
    const rect = this.rects.local;
    const n = rasterizeTrack(L.dynamic, L.mres, f32(L.dynCenter[0] - R), f32(L.dynCenter[1] - R), f32((L.mres - 1) / this.gridDiameter), 0.5, sx, sz, ex, ez, width, remaining, (x, z) => rect.add(x, z));
    if (n > 0) L.hasDeformation = true;
    return n;
  }
  // ReplayPendingTracks
  _replayPendingTracks() {
    const L = this.local, R = this.gridRadius, c = L.dynCenter;
    const list = L.pending.splice(0);
    let total = 0;
    for (const [sx, sz, ex, ez, w, rem] of list) {
      const reach = f32(R + f32(w * 0.5));
      const inside = Math.max(sx, ex) >= f32(c[0] - reach) && Math.min(sx, ex) <= f32(c[0] + reach) && Math.max(sz, ez) >= f32(c[1] - reach) && Math.min(sz, ez) <= f32(c[1] + reach);
      if (!inside) continue;
      const n = this._rasterizeLocal(sx, sz, ex, ez, w, rem);
      total += n;
      if (n > 0) this.stampsWritten++;
    }
    if (total > 0) this.lastStampChanged = total;
  }

  // StampNpcs
  _stampNpcs(f) {
    const s = this.settings;
    if (!s.npcTracksEnabled) { this._resetNpcAnchors(); return; }
    if (f.now < this.nextNpcSampleTime) return;
    this.nextNpcSampleTime = f.now + NPC_SAMPLE_INTERVAL_SECONDS;
    this.npcSamplePasses++;
    const seen = new Set();
    for (const n of f.npcs ?? []) {
      seen.add(n.id);
      let t = this.npcTargets.get(n.id);
      if (!t) { t = { hasAnchor: false, last: [0, 0] }; this.npcTargets.set(n.id, t); }
      if (!n.active) { t.hasAnchor = false; continue; }
      if (!(n.citizen || n.grounded) || (n.x - f.player.x) ** 2 + (n.z - f.player.z) ** 2 > MAX_NPC_TRACK_DISTANCE_SQ) { t.hasAnchor = false; continue; }
      if (!t.hasAnchor) { t.last = [n.x, n.z]; t.hasAnchor = true; continue; }
      const d = distanceF(t.last[0], t.last[1], n.x, n.z);
      if (d < s.npcStampSpacing) continue;
      if (d > MAX_NPC_SEGMENT) { t.last = [n.x, n.z]; continue; }
      let width = s.npcTrackWidth;
      if (!n.citizen && n.radius > 0) width = Math.max(f32(0.3), Math.min(f32(1.4), Math.max(width, f32(n.radius * 1.2))));
      const hit = { inside: false };
      if (this._stampTrack(t.last[0], t.last[1], n.x, n.z, width, s.npcRemainingSnow, hit) > 0 || !hit.inside) this.npcSegmentsWritten++;
      t.last = [n.x, n.z];
    }
    for (const id of this.npcTargets.keys()) if (!seen.has(id)) this.npcTargets.delete(id);
  }
  _resetNpcAnchors() {
    for (const t of this.npcTargets.values()) t.hasAnchor = false;
    this.nextNpcSampleTime = 0;
  }

  /** HandleEnemyDeath: a foe fallen outdoors leaves its body's hollow. */
  enemyDied(corpse) {
    if (this.corpses.register(corpse)) this.corpseProjectionPending = true;
  }

  // ---- the middle ring (MidDetailSnowRing) ----
  _newMid() {
    const n = MID.mesh * MID.mesh, sn = MID.staticRes * MID.staticRes;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < MID.mesh; i++) for (let j = 0; j < MID.mesh; j++) { const k = i * MID.mesh + j; uv[k * 2] = f32(j / 256); uv[k * 2 + 1] = f32(i / 256); }
    return {
      uv, index: gridIndices(MID.mesh),
      pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3),
      nextPos: new Float32Array(n * 3), nextNrm: new Float32Array(n * 3),
      ctxA: new Float32Array(n * 4), ctxB: new Float32Array(n * 4), ctxC: new Float32Array(n * 4), heights: new Float32Array(n * 4), bnrm: new Float32Array(n * 3),
      statics: new Uint8Array(sn * 4), nextStatics: new Uint8Array(sn * 4), context: new Uint8Array(sn * 4), nextContext: new Uint8Array(sn * 4),
      history: fullSnowMask(MID.history), scroll: fullSnowMask(MID.history),
      context0: new SnowContext(this.world, this.coverage),
      center: [0, 0], buildCenter: [0, 0], lattice: [0, 0], localCenter: [0, 0], baseY: 0,
      active: false, ready: false, building: false, rebuildPending: false, hasDeformation: false, visible: false, lastHistoryChanged: 0,
      meshCursor: 0, staticCursor: 0, nextRetry: 0, nextHistoryUpload: 0, historyDirty: false,
      pending: [], completed: 0, cancelled: 0, blankets: new Map(),
    };
  }
  _midTick(shouldBeActive, player, f, allowBuild) {
    const M = this.mid, s = this.settings;
    M.active = shouldBeActive && s.streamedBlanketPrototype;
    if (!M.active || !player) { M.visible = false; return false; }
    M.localCenter = player;
    if (M.building && Math.hypot(player[0] - M.buildCenter[0], player[1] - M.buildCenter[1]) > 112) { M.building = false; M.cancelled++; M.nextRetry = f.now; }
    const far = !M.ready || Math.hypot(player[0] - M.center[0], player[1] - M.center[1]) > MID.recenter;
    if (!M.building && (M.rebuildPending || far) && f.now >= M.nextRetry) this._midBegin(player);
    if (M.building && allowBuild) this._midProcess(player, f);
    M.visible = M.ready && Math.hypot(player[0] - M.center[0], player[1] - M.center[1]) <= 32;
    return M.visible;
  }
  _midBegin(player) {
    const M = this.mid, s = this.settings;
    M.buildCenter = snapToGrid(player[0], player[1], MID.snap, M.lattice[0], M.lattice[1]);
    M.context0.prepare(M.buildCenter[0], M.buildCenter[1], 176, s.settlementBoundaryFeather, s.locationLoaderBoundaryFeather, s);
    M.meshCursor = 0; M.staticCursor = 0;
    M.blankets = new Map();
    M.building = true;
  }
  _midProcess(player, f) {
    const M = this.mid, s = this.settings, n = MID.mesh * MID.mesh, sn = MID.staticRes * MID.staticRes;
    let budget = Math.hypot(player[0] - M.center[0], player[1] - M.center[1]) > 80 ? MID.catchUp : MID.samples;
    const dia = 320;
    while (M.meshCursor < n && budget > 0) {
      const k = M.meshCursor++;
      const i = Math.floor(k / 257);
      const lx = f32(f32(f32((k - i * 257) / 256) - 0.5) * dia), lz = f32(f32(f32(i / 256) - 0.5) * dia);
      const wx = f32(M.buildCenter[0] + lx), wz = f32(M.buildCenter[1] + lz);
      const t = this.world.terrainAt(wx, wz);
      if (!t) { this._midFail(f); return; }
      const og = t.origin(_o);
      const ground = og[1] + t.height(wx - og[0], wz - og[2]);
      M.nextPos[k * 3] = lx; M.nextPos[k * 3 + 1] = ground; M.nextPos[k * 3 + 2] = lz;
      const nr = t.normal(wx - og[0], wz - og[2], _n);
      M.nextNrm[k * 3] = nr[0]; M.nextNrm[k * 3 + 1] = nr[1]; M.nextNrm[k * 3 + 2] = nr[2];
      const b = this._blanketSamplesFor(t, M.blankets, M.context0).at(f32((wx - og[0]) / t.size), f32((wz - og[2]) / t.size), ground - og[1], nr);
      M.ctxA.set(b.contextA, k * 4); M.ctxB.set(b.contextB, k * 4); M.ctxC.set(b.contextC, k * 4);
      M.heights[k * 4] = b.height + og[1]; M.heights[k * 4 + 1] = b.offset; M.heights[k * 4 + 2] = b.blend[0]; M.heights[k * 4 + 3] = b.blend[1];
      M.bnrm[k * 3] = b.normal[0]; M.bnrm[k * 3 + 1] = b.normal[1]; M.bnrm[k * 3 + 2] = b.normal[2];
      budget--;
      if ((budget & BUDGET_CHECK) === 0 && this._spent()) return;
    }
    while (M.meshCursor >= n && M.staticCursor < sn && budget > 0) {
      const k = M.staticCursor++;
      const i = Math.floor(k / 321), j = k - i * 321;
      const wx = f32(M.buildCenter[0] + f32(f32(f32(j / 320) - 0.5) * dia)), wz = f32(M.buildCenter[1] + f32(f32(f32(i / 320) - 0.5) * dia));
      if (!sampleStaticSnow(this.world, this.coverage, M.context0, s, wx, wz, M.nextStatics, k * 4)) { this._midFail(f); return; }
      M.context0.sample(wx, wz, M.nextContext, k * 4);
      budget--;
      if ((budget & BUDGET_CHECK) === 0 && this._spent()) return;
    }
    if (M.staticCursor >= sn) this._midCommit();
  }
  _midFail(f) { this.mid.building = false; this.mid.nextRetry = f.now + TERRAIN_RETRY_SECONDS; }
  /** The frame's snow has spent its time (SNOW_FRAME_BUDGET_MS): a progressive build stops where it stands. */
  _spent() { return this.clock() - this.frameStart > this.frameBudgetMs; }
  _midCommit() {
    const M = this.mid;
    const wasReady = M.ready, old = M.center;
    [M.pos, M.nextPos] = [M.nextPos, M.pos];
    [M.nrm, M.nextNrm] = [M.nextNrm, M.nrm];
    [M.statics, M.nextStatics] = [M.nextStatics, M.statics];
    [M.context, M.nextContext] = [M.nextContext, M.context];
    M.center = [...M.buildCenter];   // a copy (a Vector2 is a value): offsetOrigin shifts each array once
    M.baseY = 0;
    let p = [0, -1, 0, -1];
    if (wasReady) {
      const dx = roundToInt(f32((M.center[0] - old[0]) / 0.5)), dz = roundToInt(f32((M.center[1] - old[1]) / 0.5));
      this._midScroll(dx, dz);
      if (Math.abs(dx) < 641 && Math.abs(dz) < 641) p = [Math.max(0, -dx), Math.min(640, 640 - dx), Math.max(0, -dz), Math.min(640, 640 - dz)];
    }
    if (this.tracks.applyToMask(M.history, 641, M.center[0], M.center[1], 320, p[0], p[1], p[2], p[3]) > 0) { M.hasDeformation = true; M.historyDirty = true; }
    snowContactRamp(M.statics, 321, 321, Math.max(1, Math.ceil(HARD_BOUNDARY_CONTACT_WIDTH / 1)));
    M.ready = true;
    this._midProjectCorpses();
    M.building = false; M.rebuildPending = false;
    M.completed++;
    this.dirty.mid = true; this.rects.mid.all();
    const list = M.pending.splice(0);
    for (const seg of list) if (this._midInside(seg) && this._midRasterize(seg) > 0) M.historyDirty = true;
  }
  _midInside([sx, sz, ex, ez, w]) {
    const c = this.mid.center, lim = f32(160 - f32(w * 0.5));
    return Math.abs(f32(sx - c[0])) <= lim && Math.abs(f32(sz - c[1])) <= lim && Math.abs(f32(ex - c[0])) <= lim && Math.abs(f32(ez - c[1])) <= lim;
  }
  _midRasterize([sx, sz, ex, ez, w, rem]) {
    const M = this.mid;
    const rect = this.rects.mid;
    const n = rasterizeTrack(M.history, 641, f32(M.center[0] - 160), f32(M.center[1] - 160), 2, 0.75, sx, sz, ex, ez, w, rem, (x, z) => rect.add(x, z));
    if (n > 0) { M.hasDeformation = true; M.historyDirty = true; }
    return n;
  }
  _midStamp(sx, sz, ex, ez, width, remaining) {
    const M = this.mid;
    if (!M.active || width <= 0) return;
    const seg = [sx, sz, ex, ez, width, remaining];
    if (!M.ready || !this._midInside(seg)) { while (M.pending.length >= MID.pendingMax) M.pending.shift(); M.pending.push(seg); return; }
    M.lastHistoryChanged = this._midRasterize(seg);
  }
  _midRefill(step) {
    const M = this.mid;
    if (!M.hasDeformation || step <= 0) return;
    let any = false;
    const h = M.history;
    for (let k = 0; k < h.length; k += 4) { const r = h[k]; if (r === 255) continue; const v = r + step; if (v >= 255) h[k] = 255; else { h[k] = v; any = true; } }
    M.hasDeformation = any;
    M.historyDirty = true; this.rects.mid.all();
  }
  _midClearHistory() {
    const M = this.mid;
    M.history.fill(255); M.hasDeformation = false; M.historyDirty = true; M.pending.length = 0; M.lastHistoryChanged = 0;
    this.rects.mid.all();
  }
  _midProjectCorpses() {
    const M = this.mid;
    if (M.ready && this.corpses.project(M.history, 641, M.center[0], M.center[1], 320)) { M.historyDirty = true; this.rects.mid.all(); }
  }
  _midScroll(dx, dz) {
    const M = this.mid;
    const out = scrollMask(M.history, M.scroll, 641, dx, dz);
    if (!out) { this._midClearHistory(); return; }
    M.scroll = M.history; M.history = out;
    M.hasDeformation = containsDeformation(M.history);
    M.historyDirty = true; this.rects.mid.all();
  }

  /** BlanketSurfaceSamples for one terrain tile, kept for the build. */
  _blanketSamplesFor(t, cache, context) {
    let b = cache.get(t);
    if (!b) { b = new BlanketSamples(t, this.coverage, context); cache.set(t, b); }
    return b;
  }

  // ---- the blanket (StreamedSnowBlanketPrototype) ----
  _newBlanket() {
    const n = BLANKET.mesh * BLANKET.mesh;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < BLANKET.mesh; i++) for (let j = 0; j < BLANKET.mesh; j++) { const k = i * BLANKET.mesh + j; uv[k * 2] = f32(j / 64); uv[k * 2 + 1] = f32(i / 64); }
    return { uv, index: gridIndices(BLANKET.mesh), overlays: new Map(), live: new Set(), queue: [], queued: new Set(), building: null, active: false, contextRevision: 0, lastPixel: null, completed: 0, failed: 0, innerRadius: 0, handoff: [0, 0], context0: new SnowContext(this.world, this.coverage) };
  }
  _blanketTick(shouldBeActive, handoff, f, allowBuild, innerRadius) {
    const B = this.blanket, s = this.settings;
    const was = B.active;
    B.active = shouldBeActive && s.streamedBlanketPrototype && !!handoff;
    if (!B.active) return;
    if (!was) B.lastPixel = null;   // AUDIT ENVIRONS S4: SetActive(true) - the visible tiles queue again, a tile rebuilt while it was off among them
    B.handoff = handoff;
    B.innerRadius = innerRadius;
    for (const o of B.overlays.values()) if (o.ready && o.contextRevision !== B.contextRevision) { this._blanketContext(o); break; }
    const near = this.world.terrainsNear(Math.max(1, Math.min(4, this.world.terrainDistance ?? 3)));
    B.live = new Set(near);   // the tiles drawn: an overlay whose tile left the ring stands undrawn until it is pruned
    const key = near.length ? `${near[0].mapX},${near[0].mapY}` : null;
    if (key !== B.lastPixel) {
      B.lastPixel = key;
      for (const t of near) this._blanketQueue(t);
    }
    if (allowBuild) this._blanketProcess();
    // PruneDestroyedTerrains (every 5 s in the mod): a tile no longer loaded is let go
    if (!B.nextPrune || f.now >= B.nextPrune) {
      B.nextPrune = f.now + BLANKET.pruneSeconds;
      const live = new Set(near);
      for (const [t, o] of B.overlays) if (!live.has(t)) { B.overlays.delete(t); this.dirty.blanket.add(o); o.dead = true; }
    }
  }
  _blanketQueue(t) {
    const B = this.blanket;
    const o = B.overlays.get(t);
    if (o && o.ready && o.stamp === t.stamp) return;
    if (!B.queued.has(t)) { B.queued.add(t); B.queue.push(t); }
  }
  /** HandleTerrainPromoted: a tile's ground was rebuilt - its blanket is again to make, and the nearer tiers' builds
   *  that overlap it start over. */
  terrainPromoted(t, now = 0, replaced = null) {
    const B = this.blanket;
    if (B.building?.t === t || (replaced && B.building?.t === replaced)) B.building = null;
    const o = B.overlays.get(t);
    if (o) o.ready = false;
    const old = replaced && B.overlays.get(replaced);   // the tile's old ground: its overlay goes with it
    if (old) { B.overlays.delete(replaced); old.dead = true; this.dirty.blanket.add(old); }
    if (B.active) this._blanketQueue(t);
    const og = t.origin(v3());
    const overlaps = (cx, cz, r) => og[0] <= cx + r && og[0] + t.size >= cx - r && og[2] <= cz + r && og[2] + t.size >= cz - r;
    const M = this.mid;
    if ((M.ready || M.building) && overlaps(...(M.building ? M.buildCenter : M.center), MID.radius)) { M.building = false; M.rebuildPending = true; M.nextRetry = now; }
    const L = this.local;
    if (L.hasCenter && overlaps(L.center[0], L.center[1], this.gridRadius)) {
      L.recentering = false; L.fullRebuild = false; L.heightRebuild = true; L.staticRebuild = true; L.nextRetry = now + RETARGET_DELAY_SECONDS;
    }
  }
  _blanketProcess() {
    const B = this.blanket;
    while (!B.building && B.queue.length) {
      const t = B.queue.shift();
      B.queued.delete(t);
      if (!B.live.has(t)) continue;   // AUDIT ENVIRONS S7: ProcessBuildQueue - a tile no longer standing in the drawn rings is not built (activeInHierarchy)
      if (!t.tileMap || t.tileMap.length < 16384) { B.failed++; continue; }
      let o = B.overlays.get(t);
      if (!o) { o = { t, ready: false, pos: new Float32Array(BLANKET.mesh * BLANKET.mesh * 3), nrm: new Float32Array(BLANKET.mesh * BLANKET.mesh * 3), ctx: new Float32Array(BLANKET.mesh * BLANKET.mesh * 4), statics: new Uint8Array(BLANKET.staticRes * BLANKET.staticRes * 4), contextRevision: -1, stamp: null, minY: 0, maxY: 0 }; B.overlays.set(t, o); }
      B.building = { t, o, cursor: 0, pos: new Float32Array(o.pos.length), nrm: new Float32Array(o.nrm.length), stamp: t.stamp };
    }
    const b = B.building;
    if (!b) return;
    const t = b.t, end = Math.min(BLANKET.mesh * BLANKET.mesh, b.cursor + BLANKET.samplesPerFrame);
    while (b.cursor < end) {
      if ((b.cursor & BUDGET_CHECK) === 0 && b.cursor > 0 && this._spent()) break;
      const k = b.cursor++;
      const i = Math.floor(k / 65);
      const u = f32((k - i * 65) / 64), v = f32(i / 64);
      const lx = f32(u * t.size), lz = f32(v * t.size);
      b.pos[k * 3] = lx; b.pos[k * 3 + 1] = t.height(lx, lz); b.pos[k * 3 + 2] = lz;
      const nr = t.normal(lx, lz, _n);
      b.nrm[k * 3] = nr[0]; b.nrm[k * 3 + 1] = nr[1]; b.nrm[k * 3 + 2] = nr[2];
    }
    if (b.cursor >= BLANKET.mesh * BLANKET.mesh) {
      const o = b.o;
      o.pos = b.pos; o.nrm = b.nrm; o.stamp = b.stamp;
      let lo = Infinity, hi = -Infinity;   // ApplyMeshBounds: the tile's ground's span (its renderer's bounds, the frustum's cull)
      for (let k = 1; k < b.pos.length; k += 3) { const y = b.pos[k]; if (y < lo) lo = y; if (y > hi) hi = y; }
      o.minY = lo; o.maxY = hi;
      this._blanketContext(o);
      o.ready = true;
      B.completed++;
      B.building = null;
      this.dirty.blanket.add(o);
    }
  }
  /** UpdateTileContext: the tile's static mask (a tile is snow edge to edge or not, and its track tile in blue) and
   *  its vertices' contexts (excluded off the snow). */
  _blanketContext(o) {
    const B = this.blanket, s = this.settings, t = o.t;
    const og = t.origin(v3());
    B.context0.prepare(og[0] + t.size * 0.5, og[2] + t.size * 0.5, t.size * 0.5, s.settlementBoundaryFeather, s.locationLoaderBoundaryFeather, s);
    const px = o.statics;
    for (let k = 0; k < 16384; k++) {
      const full = this.coverage.isFullySnowCovered(t.winterArchive, t.tileMap[k]);
      px[k * 4] = full ? 128 : 0; px[k * 4 + 1] = full ? 255 : 0;
      px[k * 4 + 2] = B.context0.pathTileAt(t.mapX, t.mapY, k % 128, Math.floor(k / 128));
      px[k * 4 + 3] = 255;
    }
    const tmp = new Uint8Array(4);
    for (let k = 0; k < 4225; k++) {
      const u = this.blanket.uv[k * 2], v = this.blanket.uv[k * 2 + 1];
      const ix = Math.min(Math.trunc(u * 128), 127), iz = Math.min(Math.trunc(v * 128), 127);
      let covered = this.coverage.isFullySnowCovered(t.winterArchive, t.tileMap[iz * 128 + ix]);
      const b = px[(iz * 128 + ix) * 4 + 2];
      covered = covered || (b !== 0 && pathEdgeDistance(b, f32(f32(u * 128) - ix), f32(f32(v * 128) - iz)) <= 0);
      if (covered && t.bare?.(f32(u * t.size), f32(v * t.size))) covered = false;
      const c = covered ? contextOf(...B.context0.sample(f32(og[0] + f32(u * t.size)), f32(og[2] + f32(v * t.size)), tmp)) : SNOW_EXCLUDED;
      o.ctx.set(c, k * 4);
    }
    o.contextRevision = B.contextRevision;
    this.dirty.blanket.add(o);
  }

  // ---- the far track mask (FarTrackMask) ----
  _newFar() { return { pixels: fullSnowMask(FAR.res), scroll: fullSnowMask(FAR.res), center: [0, 0], lattice: [0, 0], ready: false, rebuilds: 0, lastChanged: 0 }; }
  _farTick(active, px, pz) {
    const F = this.far;
    if (!active) return;
    if (!F.ready) {
      F.center = snapToGrid(px, pz, FAR.snap, F.lattice[0], F.lattice[1]);
      F.pixels.fill(255);
      F.lastChanged = this.tracks.applyToMask(F.pixels, 641, F.center[0], F.center[1], 640);
      F.ready = true;
      this._farProjectCorpses();
      F.rebuilds++;
      this.rects.far.all();
    } else if (Math.hypot(px - F.center[0], pz - F.center[1]) > FAR.recenter) {
      const old = F.center;
      F.center = snapToGrid(px, pz, FAR.snap, F.lattice[0], F.lattice[1]);
      const dx = roundToInt(f32(F.center[0] - old[0])), dz = roundToInt(f32(F.center[1] - old[1]));
      let p = [0, -1, 0, -1];
      const out = scrollMask(F.pixels, F.scroll, 641, dx, dz);
      if (!out) F.pixels.fill(255);
      else { F.scroll = F.pixels; F.pixels = out; p = [Math.max(0, -dx), Math.min(640, 640 - dx), Math.max(0, -dz), Math.min(640, 640 - dz)]; }
      F.lastChanged = this.tracks.applyToMask(F.pixels, 641, F.center[0], F.center[1], 640, p[0], p[1], p[2], p[3]);
      this._farProjectCorpses();
      F.rebuilds++;
      this.rects.far.all();
    }
  }
  _farStamp(sx, sz, ex, ez, width, remaining) {
    const F = this.far;
    if (!F.ready || width <= 0) return;
    const reach = f32(320 + f32(width * 0.5)), c = F.center;
    if (!(Math.max(sx, ex) >= c[0] - reach && Math.min(sx, ex) <= c[0] + reach && Math.max(sz, ez) >= c[1] - reach && Math.min(sz, ez) <= c[1] + reach)) return;
    const rect = this.rects.far;
    const n = rasterizeTrack(F.pixels, 641, f32(c[0] - 320), f32(c[1] - 320), 1, 0.75, sx, sz, ex, ez, width, remaining, (x, z) => rect.add(x, z));
    if (n > 0) F.lastChanged = n;
  }
  _farRefill(step) {
    const F = this.far;
    if (!F.ready || step <= 0) return;
    let any = false;
    const p = F.pixels;
    for (let k = 0; k < p.length; k += 4) { const r = p[k]; if (r !== 255) { p[k] = r + step >= 255 ? 255 : r + step; any = true; } }
    if (any) this.rects.far.all();
  }
  _farClear() { this.far.pixels.fill(255); this.far.lastChanged = 0; this.rects.far.all(); }
  _farProjectCorpses() {
    const F = this.far;
    if (F.ready && this.corpses.project(F.pixels, 641, F.center[0], F.center[1], 640)) this.rects.far.all();
  }

  // ---- the floating origin, the world's resets, the save ----
  /** HandleFloatingOrigin: everything the snow holds in the scene moves with it. */
  offsetOrigin(offset) {
    const [ox, oy, oz] = offset;
    const L = this.local, M = this.mid, F = this.far;
    for (const p of [L.lattice, L.center, L.dynCenter, L.statCenter, L.nextCenter, L.nextDyn, L.nextStat, L.lastStamp, M.lattice, M.center, M.buildCenter, M.localCenter, F.center, F.lattice]) { p[0] = f32(p[0] + ox); p[1] = f32(p[1] + oz); }
    L.baseY += oy;
    M.baseY += oy;
    for (const seg of L.pending) { seg[0] += ox; seg[1] += oz; seg[2] += ox; seg[3] += oz; }
    for (const seg of M.pending) { seg[0] += ox; seg[1] += oz; seg[2] += ox; seg[3] += oz; }
    for (const t of this.npcTargets.values()) if (t.hasAnchor) { t.last[0] += ox; t.last[1] += oz; }
    if (oy !== 0) { M.building = false; M.rebuildPending = true; }
  }
  /** HandleTransitionInterior / HandleTransitionExterior / InvalidateSessionPresentation: the world the snow stood on
   *  is gone (a door, a load, a fast travel) - every tier is built again where the player next stands outside. */
  worldReset({ session = false } = {}) {
    const L = this.local, M = this.mid, B = this.blanket, F = this.far;
    B.queue.length = 0; B.queued.clear(); B.building = null; B.lastPixel = null;   // the overlays are kept, undrawn until their tiles are asked again
    this._midClearHistory(); M.ready = false; M.building = false; M.rebuildPending = true; M.nextRetry = 0; M.visible = false;
    F.ready = false; F.lastChanged = 0;
    L.meshReady = false; L.staticReady = false; L.recentering = false; L.fullRebuild = false; L.heightRebuild = true; L.staticRebuild = true; L.nextRetry = 0; L.visible = false;
    L.hasLastStamp = false;
    this._resetNpcAnchors();
    if (session) {
      this.clearDynamicMask(false);
      L.hasCenter = false;
      this.hasEnvironmentEligibility = false;
    }
  }
  /** BeginSession: a new game or a load starting. */
  beginSession() {
    this.tracks.clear();
    this.snowpack.restore(null);
    this.npcTargets.clear();
    this.corpses.clear();
    this.corpseScanPending = false;
    this.lastGameSeconds = 0;
    this.nextRefillTime = 0;
    this.isSnowing = false;
    this.worldReset({ session: true });
    this.corpseProjectionPending = false;
  }
  /** CompleteSession: the game is in - the clocks start from now (AUDIT ENVIRONS S8: `now` real seconds, ResetRefillClock's
   *  first tick half a second on; `snowing` the weather's now, WeatherManager.IsSnowing). */
  completeSession(gameSeconds, snowing = false, now = 0) {
    this.worldReset({ session: true });
    this.corpseScanPending = true;
    this.lastGameSeconds = gameSeconds; this.nextRefillTime = now + REFILL_INTERVAL_SECONDS; this.refillRemainder = 0; this.isSnowing = snowing;
    this.snowpack.resetClock(gameSeconds);
    this.dirty.depths = true;
  }
  /** WriteTrackData: the persistent cells and the snowpack into the mod's record. */
  writeSaveData(data) {
    this.tracks.writeSaveData(data);
    this.snowpack.write(data);
    return data;
  }
  /** RestoreTrackData. */
  restoreSaveData(data, gameSeconds) {
    this.snowpack.restore(data);
    this.snowpack.resetClock(gameSeconds);
    this.dirty.depths = true;
    const ok = this.tracks.restoreSaveData(data);
    this.local.hasLastStamp = false;
    this._resetNpcAnchors();
    this.far.ready = false;
    return ok;
  }

  // ---- what the shader is told, each tier ----
  /** The depths and the limits every tier's material carries (SnowDepthRules.Apply and SetSnowDepth). */
  depthUniforms() {
    const s = this.settings;
    return {
      depths: [this.renderedDepth, this.renderedSettlementDepth, this.renderedLocationDepth, s.pathMaximumDepth],
      limits: [s.roadBermsEnabled && s.basicRoadsIntegration ? s.roadBermRise : 0, s.wildernessMaximumDepth, s.settlementMaximumDepth, s.corpseRemainingSnowDepth],
    };
  }
  /** The local window's material (ApplyMaterialSettings and ApplyMaskMappings). */
  localUniforms() {
    const L = this.local, s = this.settings, R = this.gridRadius, mt = this.maskTexel, st = this.staticTexel;
    return {
      origin: [L.center[0], L.baseY, L.center[1]],
      dynMap: [f32(f32(L.dynCenter[0] - R) - f32(mt * 0.5)), f32(f32(L.dynCenter[1] - R) - f32(mt * 0.5)), f32(1 / f32(mt * L.mres)), 0],
      dynTexel: [1 / L.mres, 1 / L.mres, L.mres, L.mres],
      statMap: [f32(f32(L.statCenter[0] - R) - f32(st * 0.5)), f32(f32(L.statCenter[1] - R) - f32(st * 0.5)), f32(1 / f32(st * L.sres)), 0],
      flags: [1, 0, 0, s.trackImpressionStrength],
      radius: [R, 0, SNOW_SURFACE_OFFSET, s.textureWorldSize],
      inner: [0, 0, 0, 0],
      outer: [this.outerCenter?.[0] ?? 0, this.outerCenter?.[1] ?? 0, Math.max(0, s.snowRadius - 12), s.snowRadius],
      boundaryFade: s.streamedBlanketPrototype ? 0 : 1,
      darkening: s.compressionDarkening,
    };
  }
  /** The middle ring's (its ApplyMaterialSettings, ApplyHandoffSettings and ApplyMaskMapping). */
  midUniforms() {
    const M = this.mid, s = this.settings;
    const o = [M.center[0] - 160, M.center[1] - 160];
    return {
      origin: [M.center[0], M.baseY, M.center[1]],
      dynMap: [f32(o[0] - 0.25), f32(o[1] - 0.25), f32(1 / (0.5 * 641)), 0],
      dynTexel: [1 / 641, 1 / 641, 641, 641],
      statMap: [f32(o[0] - 0.5), f32(o[1] - 0.5), f32(1 / 321), 0],
      farMap: this.farMapping(),
      flags: [1, 0, 1, s.trackImpressionStrength],
      radius: [160, 24, SNOW_SURFACE_OFFSET, s.textureWorldSize],
      inner: [M.localCenter[0], M.localCenter[1], 0, 0],
      outer: [M.localCenter[0], M.localCenter[1], MID.clipStart, MID.visible],
      boundaryFade: 0,
      darkening: s.compressionDarkening,
    };
  }
  /** FarTrackMask.Mapping. */
  farMapping() { const c = this.far.center; return [c[0] - 320, c[1] - 320, 0.0015625, 1]; }
  /** The blanket's (its ApplyMaterialSettings, SetDistantTrackMask and Tick; a tile's static mapping its own). */
  blanketUniforms(o, distant) {
    const s = this.settings, B = this.blanket, og = o.t.origin(v3());
    return {
      origin: og,
      dynMap: distant ? this.farMapping() : [0, 0, 1, 0],
      dynTexel: [1 / 641, 1 / 641, 641, 641],
      statMap: [og[0], og[2], 1 / Math.max(o.t.size, 0.001), 0],
      flags: [0, 1, 0, s.trackImpressionStrength],
      radius: [1, 0, SNOW_SURFACE_OFFSET, s.textureWorldSize],
      inner: [B.handoff[0], B.handoff[1], Math.max(0, B.innerRadius - 0.5), B.innerRadius],
      outer: [0, 0, 0, 0],
      boundaryFade: 0,
      darkening: distant ? s.compressionDarkening : 0,
    };
  }

  /** The most the blanket stands over the ground it lies on: the deepest depth any context resolves (the snowpack's,
   *  the caps', the ceilings', a debug override) and the surface offset - a tile's bounds over its ground's span. */
  blanketRise() {
    const s = this.settings;
    return Math.max(this.renderedDepth, this.renderedSettlementDepth, this.renderedLocationDepth, s.wildernessMaximumDepth, s.settlementMaximumDepth) + SNOW_SURFACE_OFFSET;
  }

  /** The console's snow_status. */
  status(f = null, x = {}) {
    const L = this.local, s = this.settings, M = this.mid, B = this.blanket, F = this.far;
    const b = (v) => (v ? 'True' : 'False');   // a C# bool's ToString
    let min = 255, deformed = 0;
    for (let k = 0; k < L.dynamic.length; k += 4) { min = Math.min(min, L.dynamic[k]); if (L.dynamic[k] < 255) deformed++; }
    const p = f?.rawPlayer ?? null;   // the motor's, whatever the switch (the frame's own player is the switch's)
    let terrain = 'unavailable';
    if (x.climate != null && f) {   // PlayerGPS.ClimateSettings and the calendar's season (WorldTime.Now.SeasonValue)
      const cs = getWorldClimateSettings(x.climate), season = seasonValue(dateFromClassicMinutes(Math.floor(f.gameSeconds / 60)));
      const type = Object.keys(CLIMATE_BASE_TYPES).find((k) => CLIMATE_BASE_TYPES[k] === cs.climateType) ?? String(cs.climateType);
      const seasonName = Object.keys(SEASONS).find((k) => SEASONS[k] === season);
      terrain = `climateIndex=${x.climate} climateType=${type} season=${seasonName} expectedArchive=${cs.groundArchive + (cs.climateType !== CLIMATE_BASE_TYPES.Desert && season === SEASONS.Winter ? 1 : 0)} bundledWinterArchives=103,303,403`;
    }
    const amb = x.ambient ?? [0, 0, 0];
    const at = p ? [p.x, p.z] : null;
    const midProgress = `${M.meshCursor}/${MID.mesh * MID.mesh}+${M.staticCursor}/${MID.staticRes * MID.staticRes}`;
    let ready = 0;
    for (const o of B.overlays.values()) if (o.ready) ready++;
    const visible = B.active ? [...B.overlays.values()].filter((o) => o.ready && B.live.has(o.t)).length : 0;
    const building = B.building ? `${B.building.cursor}/${BLANKET.mesh * BLANKET.mesh}` : '0/0';
    const roads = !s.basicRoadsIntegration ? 'basicRoads=disabled'
      : !at || f?.inside ? 'basicRoads=exterior context unavailable'
        : (() => {   // RoadStatus: the context's read at the player, before the coverage and the tracks
          const c = this.context.sample(at[0], at[1]);
          const depth = resolveSnowDepth(contextOf(c[0], c[1], c[2], c[3]), this.renderedDepth, this.renderedSettlementDepth, this.renderedLocationDepth, s);
          return `basicRoads=${x.roads ?? 'not sampled'} pathWeight=${(c[2] / 255).toFixed(2)} pathCap=${s.pathMaximumDepth.toFixed(2)}m bermWeight=${(c[3] / 255).toFixed(2)} contextDepth=${depth.toFixed(3)}m (before coverage/tracks)`;
        })();
    return [   // AUDIT ENVIRONS S6: GetRuntimeStatus, line for line
      'Dynamic Snow runtime',
      `active=${b(s.enabled && this.lastEnvironmentEligible)} exterior=${b(!!f && !f.inside)} meshReady=${b(L.meshReady)} staticReady=${b(L.staticReady)}`,
      `playerGrounded=${b(p?.grounded)} controllerGrounded=${b(p?.grounded)} swimming=${b(p?.swimming)} levitating=${b(p?.levitating)}`,
      `stampAttempts=${this.stampAttempts} stampSegmentsWritten=${this.stampsWritten} lastPixelsChanged=${this.lastStampChanged}`,
      `maskMinimum=${min}/255 deformedPixels=${deformed} dirty=${b(this.rects.local.any)} hasDeformation=${b(L.hasDeformation)} fullUpload=${b(this.rects.local.full)} pendingSegments=${L.pending.length}`,
      `localBuild=${!L.recentering ? 'idle' : L.fullRebuild ? 'full' : 'recenter'} progress=${L.meshCursor + L.statCursor}/${L.res * L.res + L.sres * L.sres} staleRetargets=${this.staleCancellations}`,
      `terrain=${terrain}`,
      `lighting=ambient(${amb[0].toFixed(3)},${amb[1].toFixed(3)},${amb[2].toFixed(3)}) probes=${x.surface ? 'Off' : 'unavailable'}`,
      `npcTargets=${this.npcTargets.size} npcSegmentsWritten=${this.npcSegmentsWritten} npcSamplePasses=${this.npcSamplePasses}`,
      `persistentTrackCells=${this.tracks.count}/65536`,
      `savePayload=v1 raw=${this.tracks.lastSaveRawBytes}B compressed=${this.tracks.lastSaveCompressedBytes}B base64=${this.tracks.lastSaveBase64Characters}chars evictions=${this.tracks.evictedCells} (last save)`,
      `farTracks=ready=${b(F.ready)} center=(${F.center[0].toFixed(1)},${F.center[1].toFixed(1)}) radius=320m cells=${this.tracks.count} changed=${F.lastChanged} rebuilds=${F.rebuilds}`,
      `midDetail=active=${b(M.active)} ready=${b(M.ready)} building=${b(M.building)} center=(${M.center[0].toFixed(1)},${M.center[1].toFixed(1)}) progress=${midProgress} builds=${M.completed} retargets=${M.cancelled} history=${b(M.hasDeformation)}px=${M.lastHistoryChanged} pending=${M.pending.length} vertices=${MID.mesh * MID.mesh}`,
      `streamedBlanket=enabled=${b(s.streamedBlanketPrototype)} active=${b(B.active)} readyTiles=${ready} visibleTiles=${visible} queued=${B.queue.length} mesh=${BLANKET.mesh} building=${building} builds=${B.completed} failures=${B.failed}`,
      `localVertices=${L.res * L.res} localMaskUploads=${x.uploads ?? 0}`,
      `snowpack=vanillaLocation:${this.snowpack.settlementDepth.toFixed(2)}m wilderness:${this.snowpack.wildernessDepth.toFixed(2)}m phase:${this.snowpack.phaseWasSnowing ? 'snow' : 'clear'} progress:${(this.snowpack.phaseProgressSeconds / 3600).toFixed(2)}h renderedWilderness:${this.renderedDepth.toFixed(2)}m`,
      `context=vanillaLocations:${this.context.settlements.length} playerWeight:${(at ? this.context.sampleSettlement(at[0], at[1]) / 255 : 0).toFixed(2)} vanillaLocationDepth:${this.renderedSettlementDepth.toFixed(2)}m locationLoader:absent locations:${this.context.locations.length} playerCapWeight:${(at ? this.context.sampleLocationCap(at[0], at[1]) / 255 : 0).toFixed(2)}`,
      `lastStamp=${this.lastStampStatus === 'not grounded' ? `rejected: grounded=${b(p?.grounded)}, controllerGrounded=${b(p?.grounded)}, swimming=${b(p?.swimming)}, levitating=${b(p?.levitating)}` : this.lastStampStatus}`,
      `corpses active=${this.corpses.activeCount}`,
      roads,
    ].join('\n');
  }
}

/** A grid's two triangles a cell, as the mod's meshes wind them (a cell's lower-left, its upper-left, its upper-right;
 *  its lower-left, its upper-right, its lower-right). */
export function gridIndices(res) {
  const out = new Uint32Array((res - 1) * (res - 1) * 6);
  let o = 0;
  for (let i = 0; i < res - 1; i++) {
    for (let j = 0; j < res - 1; j++) {
      const a = i * res + j, b = a + res;
      out[o++] = a; out[o++] = b; out[o++] = b + 1;
      out[o++] = a; out[o++] = b + 1; out[o++] = a + 1;
    }
  }
  return out;
}

/** BlanketSurfaceSamples: one tile's 65 x 65 blanket vertices, sampled once each as the middle ring asks for them -
 *  where its tile is snow edge to edge (or a track's painted ground) its context, else Excluded - and their
 *  barycentric blend under a point (At). */
export class BlanketSamples {
  constructor(t, coverage, context) {
    this.t = t; this.coverage = coverage; this.context = context;
    this.samples = new Map();
  }
  /** Covered(u, v). */
  covered(u, v) {
    const t = this.t;
    const ix = Math.max(0, Math.min(127, Math.trunc(u * 128))), iz = Math.max(0, Math.min(127, Math.trunc(v * 128)));
    if (t.bare?.(f32(u * t.size), f32(v * t.size))) return false;
    if (this.coverage.isFullySnowCovered(t.winterArchive, t.tileMap[iz * 128 + ix])) return true;
    const b = this.context.pathTileAt(t.mapX, t.mapY, ix, iz);
    return b !== 0 && pathEdgeDistance(b, f32(f32(u * 128) - ix), f32(f32(v * 128) - iz)) <= 0;
  }
  /** Vertex(x, z). */
  vertex(x, z) {
    const key = z * 65 + x;
    let s = this.samples.get(key);
    if (s) return s;
    const t = this.t, u = f32(x / 64), v = f32(z / 64);
    const lx = f32(u * t.size), lz = f32(v * t.size);
    const og = t.origin(v3());
    const covered = this.covered(u, v);
    s = {
      height: t.height(lx, lz),
      normal: [...t.normal(lx, lz, v3())],
      contextA: covered ? contextOf(...this.context.sample(f32(og[0] + lx), f32(og[2] + lz))) : SNOW_EXCLUDED,
      offset: covered ? SNOW_SURFACE_OFFSET : 0,
    };
    this.samples.set(key, s);
    return s;
  }
  /** At(u, v, groundHeight, groundNormal). */
  at(u, v, groundHeight, groundNormal) {
    if (!this.covered(u, v)) return { height: groundHeight, normal: groundNormal, contextA: SNOW_EXCLUDED, contextB: SNOW_EXCLUDED, contextC: SNOW_EXCLUDED, blend: [1, 0, 0], offset: 0 };
    const x = f32(Math.max(0, Math.min(1, u)) * 64), z = f32(Math.max(0, Math.min(1, v)) * 64);
    const ix = Math.min(Math.floor(x), 63), iz = Math.min(Math.floor(z), 63);
    return interpolateQuad(this.vertex(ix, iz), this.vertex(ix + 1, iz), this.vertex(ix, iz + 1), this.vertex(ix + 1, iz + 1), f32(x - ix), f32(z - iz));
  }
}

/** SnowDepthRules.Resolve over a context's four bytes, for the status line and the tests. */
export const resolveContextBytes = (bytes, wild, settle, cap, s) => resolveSnowDepth(contextOf(bytes[0], bytes[1], bytes[2], bytes[3]), wild, settle, cap, s);
export { outsideWeight };
