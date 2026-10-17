// ═══════════════════════════════════════════════════════════════════
// OH-B / OH-C (2026-09-26): THERE'S A HOLE IN THE BOTTOM OF THE OCEAN IN
// THE STREAMED WORLD. The host half of OceanHoles' tile work (jet082's
// 1.1.0): every terrain promoted is given an OceanPitTileState and queued;
// one a frame is processed (ProcessOneTerrain), and a pixel the hash picks
// (IsPitPixel) that has no location, whose Iliac Puddle No More seafloor is
// built and current, that the bake verifies is deep, carved open water at
// least MinimumEdgeDistance from the coast (PassesBakeFilter) and whose
// floor is MinimumDepth down at the pit's spot, has its seafloor cut
// (DeformSeafloor, committed through the dependency's CommitSeafloorChanges)
// and its pit stood (BuildPit): the blue-black disc on the sea and under it,
// the miasma over it, the black disc in the pit and the entrance a swimmer
// touches (OceanPitCollision). Iliac Puddle No More's own OnSeafloorBuilt
// re-evaluates a pixel the moment its floor is rebuilt, and its decorations
// ask ShouldSuppressDecoration of every placement inside the pit.
//
// THE DEPENDENCY'S API IS deepWatersHost.js's (IsSeafloorCurrent,
// GetSeafloorBuildVersion, TryGetSeafloor, CommitSeafloorChanges,
// RefreshLoadedTile, OnSeafloorBuilt) and the decorations' (RefreshLoadedTile,
// ShouldSuppressDecoration) - the members ResolveDeepWatersApi finds. The
// bake is the port's own (world/deepWater/deepWatersBake.js: IsLoaded,
// MapPixelHasWaterCells, MapPixelHasLandCells, IsCarvedWater,
// SampleEdgeDistanceMeters), so its "bake API unavailable" arm never runs
// here - and PassesBakeFilter's unverified path with it, while the bake
// has not loaded it rejects as the C# does ("bake-not-loaded").
//
// RaycastFloor is the floor mesh's own height (the MeshCollider is that
// mesh): a ray straight down meets the triangle the mesh draws there.
//
// THE PORT'S OWN (Port-Ledger, the Ocean Holes row): the pit's marker - and
// with it the decorations' exclusion - is kept pixel-local and rides the
// recentre; the C#'s OceanPitMarker holds the world X/Z it was built at,
// which DFU's FloatingOrigin leaves behind when it moves the world.
// ═══════════════════════════════════════════════════════════════════

import {
  isPitPixel, placementFraction, getScaledSliderValue, deformSeafloorVertices, raycastFloorY, findPitOpeningY, oceanSurfaceWorldY,
  MAX_FLOOR_WAIT_FRAMES, MINIMUM_DEPTH, MINIMUM_EDGE_DISTANCE, FLOOR_FLATTEN_VARIANCE, SURFACE_OUTER_RADIUS, SURFACE_MIASMA_MAX_PARTICLES,
  SURFACE_MIASMA_HEIGHT, OCEAN_HOLES_VENDOR,
} from '../world/oceanHoles.js';
import { isValidMapPixel } from '../world/deepWater/deepWatersBake.js';   // ETHER-DEEP: IsValidMapPixel - the pits' map is the Bay's
import { sampleMeshLocalY, TILE_WORLD_SIZE_F32 } from '../world/deepWater/deepWaterFloor.js';   // AUDIT PRE-MERGE 0928 H4: terrainData.size, a float
import { modSetting, modSettingsGeneration } from '../systems/modSettings.js';
import { OCEAN_CLIMATE } from '../world/terrain/terrainHelper.js';   // worldClimate 223: the unverified placement's own check

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The mod's switch (the port's Enabled), and its dependency's. */
export function oceanHolesOn(deepWatersOn) { return deepWatersOn && modSetting(OCEAN_HOLES_VENDOR, 'Enabled') === true; }

/**
 * ApplySettings: the seven sliders read as the C# reads them - the surface
 * hole's radius and the seafloor's scale and the miasma's count and height
 * scaled about their midpoints, the rate and the two abyss dials clamped.
 */
export function oceanHolesSettings() {
  const get = (k) => Number(modSetting(OCEAN_HOLES_VENDOR, `General.${k}`));
  return {
    surfaceHoleRadius: getScaledSliderValue(get('SurfaceHoleSize'), SURFACE_OUTER_RADIUS),
    seafloorHoleScale: getScaledSliderValue(get('SeafloorHoleSize'), 1),
    pitSpawnRate: f32(clamp01(f32(get('PitSpawnRate') || 0))),
    miasmaParticleCount: Math.max(0, roundHalfEven(getScaledSliderValue(get('MiasmaParticleCount'), SURFACE_MIASMA_MAX_PARTICLES))),
    miasmaHeight: getScaledSliderValue(get('MiasmaHeight'), SURFACE_MIASMA_HEIGHT),
    dungeonVisualIntensity: f32(clamp01(f32(get('DungeonVisualIntensity') || 0))),
    dungeonVisualDarkness: f32(clamp01(f32(get('DungeonVisualDarkness') || 0))),
  };
}
/** The keys whose change re-evaluates the loaded pits (LoadSettings' HasChanged five). */
export const PIT_REFRESH_KEYS = Object.freeze(['SurfaceHoleSize', 'SeafloorHoleSize', 'PitSpawnRate', 'MiasmaParticleCount', 'MiasmaHeight']);
const snapshotOf = (s) => `${s.surfaceHoleRadius}|${s.seafloorHoleScale}|${s.pitSpawnRate}|${s.miasmaParticleCount}|${s.miasmaHeight}`;

function roundHalfEven(v) {   // Mathf.RoundToInt
  const f = Math.floor(v);
  return v - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(v);
}

/**
 * @param {object} deps
 * @param {object} deps.deepWaters - createDeepWatersHost's API (the seafloor's half of the dependency)
 * @param {?object} deps.decor - createUnderwaterDecorations' API (RefreshLoadedTile, ShouldSuppressDecoration)
 * @param {Map<string, object>} deps.built - the streamed pixels, `px,py` keyed
 * @param {(px: number, py: number) => number[]} deps.pixelTranslation - the terrain's transform.position
 * @param {(entry: object) => boolean} deps.hasLocation - terrain.MapData.hasLocation
 * @param {(entry: object) => number} deps.worldClimateOf - terrain.MapData.worldClimate
 * @param {{create: (entry: object, pit: object) => any, destroy: (h: any) => void}} [deps.pits] - the pit's visuals and entrance
 * @param {(mapX: number, mapY: number) => void} [deps.onEnterPit] - OceanHoles.Instance.TryEnterPit
 * @param {() => number} [deps.now] - Time.time
 * @param {() => object} [deps.settings]
 * @param {() => boolean} [deps.inside] - PlayerEnterExit.IsPlayerInside: DisableAllParents has the ExteriorParent off
 */
export function createOceanHoles({ deepWaters, decor = null, built, pixelTranslation, hasLocation, worldClimateOf,
  pits = null, onEnterPit = () => {}, now = () => performance.now() / 1000, settings = oceanHolesSettings, warn = (m) => console.warn(m),
  inside = () => false }) {
  const pendingTerrains = [];            // Queue<DaggerfallTerrain>
  const queuedTerrains = new Set();      // HashSet<DaggerfallTerrain>
  const states = new WeakMap();          // entry -> OceanPitTileState
  let s = settings();
  let snapshot = snapshotOf(s);
  let settingsGen = modSettingsGeneration();
  let bakeApiFailed = false;

  const keyOf = (e) => `${e.px},${e.py}`;
  // gameObject.activeInHierarchy: a pooled terrain the stream still stands, under an ExteriorParent that is on - AUDIT OH-F
  // A3: indoors DisableAllParents turns it off (PlayerEnterExit.cs:1048/1083/1107), so every terrain is inactive there
  const isActive = (e) => !inside() && built.get(keyOf(e)) === e;
  const version = (e) => deepWaters.seafloorBuildVersion(e);

  function newState(mapX, mapY) {
    return { mapX, mapY, attempts: 0, appliedFloorBuildVersion: -1, evaluatedFloorBuildVersion: -1, processed: false, flattenedFloor: false, diagnostic: 'queued' };
  }
  /** OceanPitTileState.ResetState. */
  function resetState(st, mapX, mapY) { Object.assign(st, newState(mapX, mapY)); }
  /** OceanPitTileState.Reprocess. */
  function reprocess(st) { st.attempts = 0; st.evaluatedFloorBuildVersion = -1; st.processed = false; st.diagnostic = 'requeued'; }
  function markTerrainProcessed(st, buildVersion, diagnostic) { st.diagnostic = diagnostic; st.evaluatedFloorBuildVersion = buildVersion; st.processed = true; }

  function destroyPit(entry) {
    const pit = entry._ohPit;
    if (!pit) return;
    entry._ohPit = null;
    if (pit.handle) pits?.destroy(pit.handle);
  }

  /** ResetTerrainPit: the old pit destroyed, the state made (or reset) for this pixel. */
  function resetTerrainPit(entry, st) {
    destroyPit(entry);
    if (!st) { st = newState(entry.px, entry.py); states.set(entry, st); }
    resetState(st, entry.px, entry.py);
    return st;
  }

  function enqueueTerrain(entry) {
    if (entry && !queuedTerrains.has(entry)) { queuedTerrains.add(entry); pendingTerrains.push(entry); }
  }

  /** OnTerrainPromoted. */
  function promoted(entry) {
    if (!entry) return;
    const st = states.get(entry);
    const pit = entry._ohPit ?? null;
    const v = version(entry);
    const flag = !!st && st.mapX === entry.px && st.mapY === entry.py;
    if (!flag || !st.processed || st.evaluatedFloorBuildVersion !== v || (st.appliedFloorBuildVersion >= 0 && !pit)) {
      if (flag && st.appliedFloorBuildVersion === v) { reprocess(st); enqueueTerrain(entry); }
      else { resetTerrainPit(entry, st); enqueueTerrain(entry); }
    }
  }

  /** OnDeepWaterFloorBuilt: Iliac Puddle No More built this pixel's floor - evaluated now, not queued. */
  function seafloorBuilt(entry) {
    if (!entry) return;
    const st = states.get(entry);
    if (!st || st.mapX !== entry.px || st.mapY !== entry.py || st.appliedFloorBuildVersion !== version(entry)) resetTerrainPit(entry, st);
    processTerrain(entry);
  }

  /** ShouldSuppressDecoration: a placement inside the pit's exclusion radius (the marker's own pixel only). */
  function shouldSuppressDecoration(entry, worldPosition) {
    const m = entry?._ohPit?.marker;
    if (!m || m.mapX !== entry.px || m.mapY !== entry.py) return false;
    const t = pixelTranslation(entry.px, entry.py);
    const num = f32(worldPosition[0] - f32(t[0] + m.localX));
    const num2 = f32(worldPosition[2] - f32(t[2] + m.localZ));
    if (m.decorationExclusionRadius > 0) return f32(f32(num * num) + f32(num2 * num2)) <= f32(m.decorationExclusionRadius * m.decorationExclusionRadius);
    return false;
  }

  /** The floor's world height under (x, z) - RaycastFloor's collider, the floor mesh itself. */
  function floorWorldY(entry, x, z) {
    const floor = deepWaters.tryGetSeafloor(entry);
    if (!floor) return null;
    const t = pixelTranslation(entry.px, entry.py);
    const y = sampleMeshLocalY(floor, x - t[0], z - t[2]);
    return y == null ? null : f32(t[1] + y);
  }
  const raycastFloor = (entry, x, z, surfaceY) => raycastFloorY(floorWorldY(entry, x, z), surfaceY);

  /**
   * PassesBakeFilter: {ok, rejection, verified}. The bake not loaded rejects;
   * a pixel with no water cell, one with a land cell, a point that is not
   * carved water, or one nearer the coast than MinimumEdgeDistance rejects;
   * otherwise verified. A query that throws turns the bake off for good
   * (bakeApiFailed) and falls back to the unverified geometry checks.
   */
  function passesBakeFilter(mapX, mapY, fracX, fracZ) {
    if (bakeApiFailed || !('bake' in deepWaters)) return { ok: true, rejection: '', verified: false };
    try {
      const bake = deepWaters.bake;
      if (!bake || !bake.loaded) return { ok: false, rejection: 'rejected:bake-not-loaded', verified: false };
      if (!bake.mapPixelHasWaterCells(mapX, mapY)) return { ok: false, rejection: 'rejected:bake-no-water', verified: false };
      if (bake.mapPixelHasLandCells(mapX, mapY)) return { ok: false, rejection: 'rejected:bake-has-land', verified: false };
      if (!bake.isCarvedWater(mapX, mapY, fracX, fracZ)) return { ok: false, rejection: 'rejected:not-carved-water', verified: false };
      const num = bake.sampleEdgeDistanceMeters(mapX, mapY, fracX, fracZ);
      if (num < MINIMUM_EDGE_DISTANCE) return { ok: false, rejection: `rejected:edge-distance-${num.toFixed(1)}`, verified: false };
      return { ok: true, rejection: '', verified: true };
    } catch (ex) {
      bakeApiFailed = true;
      warn(`[OceanHoles] Deep Waters bake query failed; using geometry-only placement. ${ex?.message ?? ex}`);
      return { ok: true, rejection: '', verified: false };
    }
  }

  /**
   * DeformSeafloor: the floor's vertices cut once per floor build version
   * (the applied version is kept, so a re-evaluation of the same floor does
   * not cut it twice) and committed; a failed commit leaves the floor as it
   * was. {ok, flattened}.
   */
  function deformSeafloor(entry, st, fractionX, fractionZ, allowFlatten) {
    let flattened = st.flattenedFloor;
    const v = version(entry);
    if (v < 0) return { ok: false, flattened };
    if (st.appliedFloorBuildVersion === v) return { ok: true, flattened };
    try {
      const floor = deepWaters.tryGetSeafloor(entry);
      if (!floor) return { ok: false, flattened };
      // AUDIT PRE-MERGE 0928 H4: terrainData.size is 819.2f - the centre and the edges in floats (IL_20c0-IL_20e8, IL_2212-IL_2258)
      const r = deformSeafloorVertices(floor.positions, { fractionX, fractionZ, sizeX: TILE_WORLD_SIZE_F32, sizeZ: TILE_WORLD_SIZE_F32, scale: s.seafloorHoleScale, allowFlatten });
      if (!r) return { ok: false, flattened };
      flattened = r.flattened;
      if (!deepWaters.commitSeafloorChanges(entry, r.positions)) return { ok: false, flattened };   // RestoreSeafloor: nothing was taken
      st.appliedFloorBuildVersion = v;
      st.flattenedFloor = flattened;
      return { ok: true, flattened };
    } catch (ex) {
      warn(`[OceanHoles] Seafloor deformation failed. ${ex?.message ?? ex}`);
      return { ok: false, flattened };
    }
  }

  /**
   * BuildPit: the opening found (FindPitOpeningY), the marker, the three
   * discs, the miasma and the entrance - kept pixel-local (see the header) -
   * and the decorations asked again.
   */
  function buildPit(entry, mapX, mapY, worldX, worldZ, surfaceY, floorY) {
    const t = pixelTranslation(entry.px, entry.py);
    const opening = findPitOpeningY((x, z) => floorWorldY(entry, x, z), worldX, worldZ, surfaceY, floorY, s.seafloorHoleScale);
    const lx = f32(worldX - t[0]), lz = f32(worldZ - t[2]);
    const local = (y) => f32(y - t[1]);
    destroyPit(entry);   // the C# would stand a second OceanHole_Pit beside a stale one; no path here reaches BuildPit with one standing
    const scale = s.seafloorHoleScale;
    const pit = {
      marker: { mapX, mapY, localX: lx, localZ: lz, decorationExclusionRadius: f32(32 * scale) },
      core: { name: 'Blue Hole Core', y: local(f32(surfaceY + f32(0.07))), radius: s.surfaceHoleRadius },
      underside: { name: 'Blue Hole Underside', y: local(f32(surfaceY - f32(0.01))), radius: s.surfaceHoleRadius },
      miasma: { name: 'Abyss Miasma', y: local(f32(surfaceY + f32(0.12))), count: s.miasmaParticleCount, height: s.miasmaHeight, radius: Math.max(0, f32(s.surfaceHoleRadius - 1)) },
      black: { name: 'Pit Black', y: local(f32(opening + f32(0.08))), radius: f32(12 * scale) },
      entrance: { name: 'Ocean Hole Entrance', y: local(f32(opening + f32(0.22))), size: [f32(18 * scale), f32(0.35), f32(18 * scale)], mapX, mapY, nextAllowedTime: 0 },
      openingY: local(opening),
      handle: null,
    };
    entry._ohPit = pit;
    pit.handle = pits?.create(entry, pit) ?? null;
    decor?.refreshLoadedTile(entry);   // RequestDecorationRefresh
  }

  /** ProcessTerrain: the pixel's gates in the C#'s order, each rejection a diagnostic. */
  function processTerrain(entry) {
    if (!entry) return;
    const st = states.get(entry);
    if (!st || st.processed || st.mapX !== entry.px || st.mapY !== entry.py) return;
    if (!isActive(entry)) {
      st.diagnostic = 'waiting:inactive-terrain';
      if (++st.attempts < MAX_FLOOR_WAIT_FRAMES) enqueueTerrain(entry);
      else markTerrainProcessed(st, version(entry), 'rejected:inactive-terrain-timeout');
      return;
    }
    const v = version(entry);
    // ETHER-DEEP (bible/03-World/Eltheric-Ocean.md): the pits are the Bay's. The Eltheric Ocean's floors are carved now
    // (world/etherWatersBake.js), and a pit's drowned dungeon is named by its pixel's id's low twenty bits
    // (GetAbyssMapId) - the Bay's 1000 x 500 alone keeps those apart; a pit past the Veil would share a Bay pit's abyss
    if (!isValidMapPixel(st.mapX, st.mapY)) { markTerrainProcessed(st, v, 'rejected:off-the-map'); return; }
    if (!isPitPixel(st.mapX, st.mapY, s.pitSpawnRate)) { markTerrainProcessed(st, v, 'rejected:not-selected'); return; }
    if (hasLocation(entry)) { markTerrainProcessed(st, v, 'rejected:has-location'); return; }
    const flag = !!deepWaters.tryGetSeafloor(entry);   // TryGetFloorCollider
    if (!flag || !deepWaters.isSeafloorCurrent(entry)) {
      const text = flag ? 'stale-seafloor' : 'missing-seafloor';
      const text2 = `waiting:${text}`;
      const num = st.diagnostic !== text2;
      st.diagnostic = text2;
      if (num || st.attempts % 30 === 0) deepWaters.refreshLoadedTile(entry);   // RequestSeafloorRefresh
      if (!st.processed) {
        if (++st.attempts < MAX_FLOOR_WAIT_FRAMES) enqueueTerrain(entry);
        else markTerrainProcessed(st, v, `rejected:${text}-timeout`);
      }
      return;
    }
    const num2 = placementFraction(st.mapX, st.mapY, 88);
    const num3 = placementFraction(st.mapX, st.mapY, 90);
    const bake = passesBakeFilter(st.mapX, st.mapY, num2, num3);
    if (!bake.ok) { markTerrainProcessed(st, v, bake.rejection); return; }
    if (!bake.verified && worldClimateOf(entry) !== OCEAN_CLIMATE) { markTerrainProcessed(st, v, 'rejected:not-ocean-climate'); return; }
    const t = pixelTranslation(entry.px, entry.py);
    const oceanY = oceanSurfaceWorldY(t[1], deepWaters.oceanLocalY);
    // AUDIT PRE-MERGE 0928 H4: position + fraction x terrainData.size, a float 819.2f (IL_19a5-IL_19b9, IL_19bc-IL_19e0)
    const num4 = f32(t[0] + f32(num2 * TILE_WORLD_SIZE_F32));
    const num5 = f32(t[2] + f32(num3 * TILE_WORLD_SIZE_F32));
    let hit = raycastFloor(entry, num4, num5, oceanY);
    if (hit == null) { markTerrainProcessed(st, v, 'rejected:centre-raycast'); return; }
    const num6 = f32(oceanY - hit);
    if (num6 < MINIMUM_DEPTH) { markTerrainProcessed(st, v, `rejected:depth-${num6.toFixed(1)}`); return; }
    if (!bake.verified) {
      const num7 = f32(f32(32 * s.seafloorHoleScale) + 2);
      for (let i = 0; i < 4; i++) {
        const num8 = f32(f32(Math.PI / 2) * i);
        const hit2 = raycastFloor(entry, f32(num4 + f32(f32(Math.cos(num8)) * num7)), f32(num5 + f32(f32(Math.sin(num8)) * num7)), oceanY);
        if (hit2 == null || Math.abs(f32(hit2 - hit)) > FLOOR_FLATTEN_VARIANCE) { markTerrainProcessed(st, v, 'rejected:unsafe-geometry-fallback'); return; }
      }
    }
    const d = deformSeafloor(entry, st, num2, num3, bake.verified);
    if (!d.ok || (hit = raycastFloor(entry, num4, num5, oceanY)) == null) {
      st.diagnostic = 'waiting:deformation';
      if (++st.attempts < MAX_FLOOR_WAIT_FRAMES) enqueueTerrain(entry);
      else markTerrainProcessed(st, v, 'rejected:deformation-timeout');
      return;
    }
    buildPit(entry, st.mapX, st.mapY, num4, num5, oceanY, hit);
    markTerrainProcessed(st, v, d.flattened ? 'built:flattened' : 'built');
  }

  /** ProcessOneTerrain: one queued terrain a frame. */
  function processOneTerrain() {
    if (pendingTerrains.length === 0) return;
    const e = pendingTerrains.shift();
    queuedTerrains.delete(e);
    processTerrain(e);
  }

  /** RefreshLoadedPits: every loaded floor rebuilt (forced), so every pit is evaluated again on its new floor.
   *  FindObjectsOfType<DaggerfallTerrain> finds ACTIVE objects only (AUDIT OH-F A3): indoors, none. */
  function refreshLoadedPits() {
    for (const e of built.values()) if (isActive(e)) deepWaters.refreshLoadedTile(e, true);
  }

  /** LoadSettings' callback: ApplySettings on every change, RefreshLoadedPits when one of the five moved. A callback
   *  DFU raises when the settings window closes, in ANY mode (AUDIT OH-F A1): the host asks every frame, above the
   *  modal gate, so the abyss's two sliders are live inside the abyss. */
  function checkSettings() {
    const g = modSettingsGeneration();
    if (g === settingsGen) return;
    settingsGen = g;
    const next = settings();
    const snap = snapshotOf(next);
    s = next;   // ApplySettings, every change
    if (snap !== snapshot) { snapshot = snap; refreshLoadedPits(); }   // HasChanged: one of the five
  }

  const offSuppression = decor?.onShouldSuppressDecoration?.((entry, p) => shouldSuppressDecoration(entry, p)) ?? null;

  return {
    promoted,
    seafloorBuilt,
    shouldSuppressDecoration,
    checkSettings,
    /** OceanHoles.Update's queue: one terrain a frame, in every mode - indoors each one waits toward its timeout. */
    processOneTerrain,
    /** The frame's work: a settings change (LoadSettings' callback), then ProcessOneTerrain. */
    update() {
      checkSettings();
      processOneTerrain();
    },
    /** OnSaveLoaded: the queue dropped and every loaded terrain promoted again (FindObjectsOfType's: the active ones). */
    saveLoaded() {
      pendingTerrains.length = 0;
      queuedTerrains.clear();
      for (const e of built.values()) if (isActive(e)) promoted(e);
    },
    /** The pixel leaves the stream: its pit (a child of the terrain) goes with it. */
    destroyed(entry) {
      destroyPit(entry);
      queuedTerrains.delete(entry);
      const i = pendingTerrains.indexOf(entry);
      if (i >= 0) pendingTerrains.splice(i, 1);
    },
    /** The pit standing on `entry`, or null (transform.Find("OceanHole_Pit")). */
    pitOf(entry) { return entry?._ohPit ?? null; },
    /** The entrance's world centre and the top of its box (the collider's bounds.max.y), or null. */
    entranceOf(entry) {
      const pit = entry?._ohPit;
      if (!pit) return null;
      const t = pixelTranslation(entry.px, entry.py);
      const e = pit.entrance;
      const c = [f32(t[0] + pit.marker.localX), f32(t[1] + e.y), f32(t[2] + pit.marker.localZ)];
      return { position: c, topY: f32(c[1] + f32(e.size[1] / 2)), size: e.size };
    },
    /**
     * OceanPitCollision.OnCharacterCollided: the swimmer's controller touched
     * the entrance - once a second at most, and only outside, swimming.
     */
    characterCollided(entry, { inside, swimming }) {
      const e = entry?._ohPit?.entrance;
      if (!e) return false;
      const t = now();
      if (t < e.nextAllowedTime || inside || !swimming) return false;
      e.nextAllowedTime = t + 1;
      onEnterPit(e.mapX, e.mapY);
      return true;
    },
    get settings() { return s; },
    get pendingCount() { return pendingTerrains.length; },
    /** Diagnostics: the pixel's OceanPitTileState. */
    stateOf(entry) { return states.get(entry) ?? null; },
    dispose() {
      offSuppression?.();
      for (const e of built.values()) destroyPit(e);
      pendingTerrains.length = 0;
      queuedTerrains.clear();
    },
  };
}
