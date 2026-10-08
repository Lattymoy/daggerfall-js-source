// SNOWFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These should be
// on by default and integrate into our enhanced environments seamlessly") - SNOWFALL 1.0.5 (demifiend000's Dynamic
// Snow, vendored at vendor/snowfall/), ported off its assembly: the law the snow lies by, pure. The runtime that stands
// it round the player is systems/snowfallRuntime.js (DynamicSnowController, MidDetailSnowRing, StreamedSnowBlanket-
// Prototype, FarTrackMask) and the surface it draws is render/snowfallSurface.js (the mod's shader).
//
// What is here, each its class or member whole:
//   - DynamicSnowSettings and DynamicSnowMod.ReadSettings - the mod's settings as it clamps them;
//   - SnowpackState - the depth the snow builds to in a snowfall (0.1 m every 3 hours) and melts from (0.1 m every 72
//     clear hours), between a minimum and a maximum, the location's and the wild's;
//   - SnowDepthRules.Resolve - the depth at a place: the wild's lerped to the location's by the settlement weight, a
//     road's berm risen, the authored locations' cap and the path's;
//   - SnowCoverageData - the mod's surface masks (56 records of 64 x 64 coverage bytes for each winter archive), read
//     with the tile's turn, and the main roads' distance fields;
//   - SnowContactRamp, CorpseImpressions, PersistentTrackField (the tracks kept in the save, 0.5 m cells), the track
//     rasterizer the three masks share, and the Basic Roads classifier the context reads roads with;
//   - SnowContextData's pure members (OutsideWeight, IsVanillaLocation) and BlanketSurfaceSamples.InterpolateQuad.
// Single precision where the C# computes in float (Math.fround at every float operation), double where it computes
// in double - pinned against the reference harness's traces (test/snowfall1_model.test.js).

import { modSetting } from './modSettings.js';
import { roundToInt, lerpF } from './mathf.js';   // Mathf.RoundToInt (banker's), Mathf.Lerp in float
import { bytesToBase64, base64ToBytes } from './saveTransfer.js';   // Convert.ToBase64String / FromBase64String
import { deflateRaw, inflateRaw } from '../formats/rawDeflate.js';   // DeflateStream

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampF = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const floorToInt = (v) => Math.floor(v);
const ceilToInt = (v) => Math.ceil(v);

/** The mod's SmoothStep (DynamicSnowController, MidDetailSnowRing, PersistentTrackField, FarTrackMask), in float. */
export function smoothStepF(edge0, edge1, value) {
  const t = clamp01(f32(f32(value - edge0) / f32(edge1 - edge0)));
  return f32(f32(t * t) * f32(3 - f32(2 * t)));
}
/** Vector2.Distance, as Unity computes it: the squares summed in float, the root in double, cast to float. */
const distanceF = (ax, ay, bx, by) => { const dx = f32(ax - bx), dy = f32(ay - by); return f32(Math.sqrt(f32(f32(dx * dx) + f32(dy * dy)))); };

// ---- DynamicSnowSettings and ReadSettings -------------------------------------------------------------------------
export const SNOWFALL_VENDOR = 'snowfall';
/** DynamicSnowMod.MeshResolutions and MaskResolutions - the Surface options' values. */
export const MESH_RESOLUTIONS = Object.freeze([97, 129, 161]);
export const MASK_RESOLUTIONS = Object.freeze([128, 256, 512]);
/** DynamicSnowSettings' field initialisers: the built-in values, and the three the mod gives no setting (the corpses'). */
export const SNOWFALL_BUILT_IN = Object.freeze({
  corpseImpressionsEnabled: true, corpseRemainingSnowDepth: f32(0.1), corpseImpressionWidth: f32(1.5),
  enabled: true, activationOverride: 0, debugSnowDepthOverride: 0,
  settlementMinimumDepth: f32(0.2), settlementMaximumDepth: f32(0.4), wildernessMinimumDepth: f32(0.4), wildernessMaximumDepth: f32(0.8),
  snowfallDepthStep: f32(0.1), snowfallDepthHours: 3, meltDepthStep: f32(0.1), meltDepthHours: 72,
  settlementBoundaryFeather: 8, locationLoaderIntegration: true, locationLoaderMaximumDepth: f32(0.1), locationLoaderBoundaryFeather: 4,
  basicRoadsIntegration: true, pathMaximumDepth: f32(0.1), pathBoundaryFeather: 1, roadBermsEnabled: true, roadBermRise: f32(0.05), roadBermWidth: 2,
  snowRadius: 32, meshResolution: 161, maskResolution: 256, recenterDistance: 6, maxSnowSlope: 55,
  textureWorldSize: 4, compressionDarkening: f32(0.18), trackImpressionStrength: 1, impressionShoulderWidth: f32(0.5),
  playerTrackWidth: f32(0.7), playerRemainingSnow: f32(0.18), playerStampSpacing: f32(0.25),
  npcTracksEnabled: true, npcTrackWidth: f32(0.55), npcRemainingSnow: f32(0.28), npcStampSpacing: f32(0.5),
  passiveRefillHours: 12, snowfallRefillHours: f32(1.5),
  streamedBlanketPrototype: true, distantTracksEnabled: true,
});

/** DynamicSnowMod.FiniteRoadValue. */
const finiteRoadValue = (value, fallback, min, max) => (Number.isFinite(value) ? clampF(value, min, max) : fallback);

/**
 * DynamicSnowMod.ReadSettings: the mod's settings, clamped as it clamps them. `read(key)` answers a declared key
 * (systems/modSettings.js, vendor `snowfall`: General.Enabled is `Enabled`, every other key `Section.Key`).
 * @param {(key: string) => any} [read]
 */
export function snowfallSettings(read = (k) => modSetting(SNOWFALL_VENDOR, k)) {
  const num = (k) => f32(Number(read(k)));
  const s = { ...SNOWFALL_BUILT_IN };
  s.enabled = read('Enabled') === true;
  s.activationOverride = clampI(Math.trunc(Number(read('General.ActivationOverride'))) || 0, 0, 2);
  s.debugSnowDepthOverride = clampF(num('Snowpack.DebugSnowDepthOverride'), 0, f32(0.8));
  s.settlementMinimumDepth = clampF(num('Snowpack.SettlementMinimumDepth'), f32(0.1), 1);
  s.settlementMaximumDepth = clampF(num('Snowpack.SettlementMaximumDepth'), s.settlementMinimumDepth, 1);
  s.wildernessMinimumDepth = clampF(num('Snowpack.WildernessMinimumDepth'), f32(0.1), 1);
  s.wildernessMaximumDepth = clampF(num('Snowpack.WildernessMaximumDepth'), s.wildernessMinimumDepth, 1);
  s.snowfallDepthStep = clampF(num('Snowpack.SnowfallDepthStep'), f32(0.01), f32(0.2));
  s.snowfallDepthHours = clampF(num('Snowpack.SnowfallDepthHours'), f32(0.25), 24);
  s.meltDepthStep = clampF(num('Snowpack.MeltDepthStep'), f32(0.01), f32(0.2));
  s.meltDepthHours = clampF(num('Snowpack.MeltDepthHours'), 1, 240);
  s.settlementBoundaryFeather = clampF(num('Context.SettlementBoundaryFeather'), 0, 32);
  s.locationLoaderIntegration = read('Context.LocationLoaderIntegration') === true;
  s.locationLoaderMaximumDepth = clampF(num('Context.LocationLoaderMaximumDepth'), f32(0.1), 1);
  s.locationLoaderBoundaryFeather = clampF(num('Context.LocationLoaderBoundaryFeather'), 0, 32);
  s.basicRoadsIntegration = read('Basic Roads.Enabled') === true;
  s.pathMaximumDepth = finiteRoadValue(num('Basic Roads.PathMaximumDepth'), f32(0.1), f32(0.1), 1);
  s.pathBoundaryFeather = finiteRoadValue(num('Basic Roads.PathFeather'), 1, 0, 4);
  s.roadBermsEnabled = read('Basic Roads.BermsEnabled') === true;
  s.roadBermRise = finiteRoadValue(num('Basic Roads.BermRise'), f32(0.05), 0, f32(0.1));
  s.roadBermWidth = finiteRoadValue(num('Basic Roads.BermWidth'), 2, 0, 4);
  s.snowRadius = clampF(num('Surface.SnowRadius'), 16, 64);
  s.meshResolution = MESH_RESOLUTIONS[clampI(Math.trunc(Number(read('Surface.MeshResolution'))) || 0, 0, 2)];
  s.maskResolution = MASK_RESOLUTIONS[clampI(Math.trunc(Number(read('Surface.MaskResolution'))) || 0, 0, 2)];
  s.recenterDistance = clampF(num('Surface.RecenterDistance'), 2, 12);
  s.maxSnowSlope = clampF(num('Surface.MaxSnowSlope'), 30, 75);
  s.textureWorldSize = clampF(num('Visual.TextureWorldSize'), 1, 12);
  s.compressionDarkening = clamp01(num('Visual.CompressionDarkening'));
  s.trackImpressionStrength = clamp01(num('Visual.ImpressionStrength'));
  s.impressionShoulderWidth = clampF(num('Visual.ImpressionShoulderWidth'), 0, 1);
  s.playerTrackWidth = clampF(num('Player.TrackWidth'), f32(0.3), f32(1.4));
  s.playerRemainingSnow = clampF(num('Player.RemainingSnow'), f32(0.05), f32(0.8));
  s.playerStampSpacing = clampF(num('Player.StampSpacing'), f32(0.1), f32(0.8));
  s.npcTracksEnabled = read('NPC Tracks.Enabled') === true;
  s.npcTrackWidth = clampF(num('NPC Tracks.TrackWidth'), f32(0.3), f32(1.4));
  s.npcRemainingSnow = clampF(num('NPC Tracks.RemainingSnow'), f32(0.05), f32(0.8));
  s.npcStampSpacing = clampF(num('NPC Tracks.StampSpacing'), f32(0.2), f32(1.5));
  s.passiveRefillHours = clampF(num('Refill.PassiveRefillHours'), 0, 48);
  s.snowfallRefillHours = clampF(num('Refill.SnowfallRefillHours'), f32(0.1), 12);
  s.streamedBlanketPrototype = read('Distance Prototype.Enabled') === true;
  s.distantTracksEnabled = read('Distance Prototype.DistantTracks') === true;
  return Object.freeze(s);
}

// ---- SnowpackState ------------------------------------------------------------------------------------------------
const SECONDS_PER_HOUR = 3600;
/** Clamp(double), the snowpack's: a non-finite value is the minimum. */
const clampD = (value, minimum, maximum) => (Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum);

/** SnowpackState: the two depths (vanilla locations' and the wild's), the phase the weather is in and how far through
 *  its interval - in double, as the mod keeps it; game seconds are DaggerfallDateTime.ToSeconds(). */
export class SnowpackState {
  constructor() {
    this.settlementMin = 0; this.settlementMax = 0; this.wildernessMin = 0; this.wildernessMax = 0;
    this.snowfallStep = 0; this.meltStep = 0; this.snowfallInterval = 0; this.meltInterval = 0;
    this.lastObservedGameSeconds = 0; this.hasTimeAnchor = false; this.hasConfiguration = false;
    this.hasSeasonObservation = false; this.wasWinter = false; this.preserveRestoredWinter = false;
    this.settlementDepth = 0; this.wildernessDepth = 0; this.phaseProgressSeconds = 0; this.phaseWasSnowing = false;
  }

  /** Configure(settings, resetProgress). */
  configure(s, resetProgress) {
    this.settlementMin = s.settlementMinimumDepth;
    this.settlementMax = Math.max(this.settlementMin, s.settlementMaximumDepth);
    this.wildernessMin = s.wildernessMinimumDepth;
    this.wildernessMax = Math.max(this.wildernessMin, s.wildernessMaximumDepth);
    this.snowfallStep = s.snowfallDepthStep;
    this.meltStep = s.meltDepthStep;
    this.snowfallInterval = s.snowfallDepthHours * SECONDS_PER_HOUR;
    this.meltInterval = s.meltDepthHours * SECONDS_PER_HOUR;
    if (!this.hasConfiguration) {
      this.settlementDepth = this.settlementMin;
      this.wildernessDepth = this.wildernessMin;
      this.hasConfiguration = true;
    } else {
      this.settlementDepth = clampD(this.settlementDepth, this.settlementMin, this.settlementMax);
      this.wildernessDepth = clampD(this.wildernessDepth, this.wildernessMin, this.wildernessMax);
    }
    if (resetProgress) this.phaseProgressSeconds = 0;
  }

  /** Restore(data): a record of SnowpackFormatVersion 1 is taken back, clamped; anything else starts the pack over. */
  restore(data) {
    this.settlementDepth = this.settlementMin;
    this.wildernessDepth = this.wildernessMin;
    this.phaseProgressSeconds = 0;
    this.phaseWasSnowing = false;
    this.preserveRestoredWinter = false;
    if (data != null && data.SnowpackFormatVersion === 1) {
      this.settlementDepth = clampD(Number(data.SettlementDepth), this.settlementMin, this.settlementMax);
      this.wildernessDepth = clampD(Number(data.WildernessDepth), this.wildernessMin, this.wildernessMax);
      const wasSnowing = data.PhaseWasSnowing === true;
      const interval = wasSnowing ? this.snowfallInterval : this.meltInterval;
      const p = Number(data.PhaseProgressSeconds);
      if (Number.isFinite(p) && p >= 0 && p < interval) this.phaseProgressSeconds = p;
      this.phaseWasSnowing = wasSnowing;
      this.preserveRestoredWinter = true;
    }
    this.hasSeasonObservation = false;
    this.hasTimeAnchor = false;
  }

  /** Write(data). The depths go into the record as floats, as the record's fields are. */
  write(data) {
    data.SnowpackFormatVersion = 1;
    data.SettlementDepth = f32(this.settlementDepth);
    data.WildernessDepth = f32(this.wildernessDepth);
    data.PhaseProgressSeconds = this.phaseProgressSeconds;
    data.PhaseWasSnowing = this.phaseWasSnowing;
  }

  /** ResetClock(now). */
  resetClock(now) {
    this.lastObservedGameSeconds = now;
    this.hasTimeAnchor = now !== 0;
  }

  /** Advance(now, winter, desert, snowing): true when a depth changed. */
  advance(now, winter, desert, snowing) {
    let changed = false;
    if (!this.hasSeasonObservation) {
      this.hasSeasonObservation = true;
      this.wasWinter = winter;
      if (!winter || !this.preserveRestoredWinter) changed = this._resetDepths() || changed;
      this.preserveRestoredWinter = false;
    } else if (winter !== this.wasWinter) {
      this.wasWinter = winter;
      changed = this._resetDepths() || changed;
      this.resetClock(now);
      this.phaseWasSnowing = snowing;
      return changed;
    }
    if (!this.hasTimeAnchor || now <= this.lastObservedGameSeconds) {
      this.resetClock(now);
      if (snowing !== this.phaseWasSnowing) { this.phaseWasSnowing = snowing; this.phaseProgressSeconds = 0; }
      return changed;
    }
    const elapsed = now - this.lastObservedGameSeconds;
    this.lastObservedGameSeconds = now;
    if (!winter || desert) {
      if (snowing !== this.phaseWasSnowing) { this.phaseWasSnowing = snowing; this.phaseProgressSeconds = 0; }
      return changed;
    }
    changed = this._applyElapsed(elapsed) || changed;
    if (snowing !== this.phaseWasSnowing) { this.phaseWasSnowing = snowing; this.phaseProgressSeconds = 0; }
    return changed;
  }

  /** At the end the phase is driving toward: the maximums in a snowfall, the minimums out of one. */
  _atLimit() {
    return this.phaseWasSnowing
      ? this.settlementDepth >= this.settlementMax && this.wildernessDepth >= this.wildernessMax
      : this.settlementDepth <= this.settlementMin && this.wildernessDepth <= this.wildernessMin;
  }

  /** ApplyElapsed(elapsed): whole intervals step both depths, the remainder carried; at the limit the phase's progress
   *  is dropped. */
  _applyElapsed(elapsed) {
    if (this._atLimit()) { this.phaseProgressSeconds = 0; return false; }
    const interval = this.phaseWasSnowing ? this.snowfallInterval : this.meltInterval;
    this.phaseProgressSeconds += elapsed;
    const steps = Math.floor(this.phaseProgressSeconds / interval);
    if (steps < 1) return false;
    this.phaseProgressSeconds -= steps * interval;
    const delta = (this.phaseWasSnowing ? this.snowfallStep : -this.meltStep) * steps;
    const settlement = this.settlementDepth, wilderness = this.wildernessDepth;
    this.settlementDepth = clampD(this.settlementDepth + delta, this.settlementMin, this.settlementMax);
    this.wildernessDepth = clampD(this.wildernessDepth + delta, this.wildernessMin, this.wildernessMax);
    if (this._atLimit()) this.phaseProgressSeconds = 0;
    return settlement !== this.settlementDepth || wilderness !== this.wildernessDepth;
  }

  /** ResetDepths(): both to their minimums, the progress dropped; true when either moved. */
  _resetDepths() {
    const moved = this.settlementDepth !== this.settlementMin || this.wildernessDepth !== this.wildernessMin;
    this.settlementDepth = this.settlementMin;
    this.wildernessDepth = this.wildernessMin;
    this.phaseProgressSeconds = 0;
    return moved;
  }
}

// ---- SnowDepthRules -----------------------------------------------------------------------------------------------
/** SnowDepthRules.Excluded: a context that stands no snow. */
export const SNOW_EXCLUDED = Object.freeze([-1, 0, 0, 0]);

/**
 * SnowDepthRules.Resolve(context, wilderness, settlement, locationCap, settings), in float: the context's x the
 * settlement weight, y the authored locations' cap weight, z the path's, w the berm's (each byte / 255).
 * @param {ArrayLike<number>} ctx
 */
export function resolveSnowDepth(ctx, wilderness, settlement, locationCap, s) {
  if (ctx[0] < 0) return 0;
  let depth = lerpF(wilderness, settlement, ctx[0]);
  const ceiling = lerpF(s.wildernessMaximumDepth, s.settlementMaximumDepth, ctx[0]);
  const rise = s.roadBermsEnabled && s.basicRoadsIntegration ? s.roadBermRise : 0;
  depth = f32(depth + Math.min(Math.max(0, f32(ceiling - depth)), f32(rise * ctx[3])));
  const capped = lerpF(depth, Math.min(depth, locationCap), ctx[1]);
  const path = lerpF(depth, Math.min(depth, s.pathMaximumDepth), ctx[2]);
  return Math.min(depth, Math.min(capped, path));
}
/** A Color32 context as the shader and Resolve read it: each byte / 255 in float. */
export const contextOf = (r, g, b, a) => [f32(r / 255), f32(g / 255), f32(b / 255), f32(a / 255)];

// ---- SnowCoverageData ---------------------------------------------------------------------------------------------
export const SNOW_MASK_ARCHIVES = Object.freeze([103, 303, 403]);
const MASK_RECORDS = 56, MASK_TILE = 64, MASK_PIXELS = 4096;
/** The byte count of one archive's masks (DynamicSnowMod.SurfaceMaskByteCount). */
export const SNOW_MASK_BYTES = MASK_RECORDS * MASK_PIXELS;
const ROAD_RECORDS = Object.freeze([46, 47, 55]);
const SQRT2_F = f32(1.4142135);

/** A tile's turn applied to its (u, v), as TrySample and RoadDistance read a mask (the TileMap byte's two low bits). */
function turnUv(tile, u, v) {
  switch (tile & 3) {
    case 1: return [v, f32(1 - u)];
    case 2: return [f32(1 - u), f32(1 - v)];
    case 3: return [f32(1 - v), u];
    default: return [u, v];
  }
}

/** SnowCoverageData: the three winter archives' surface masks, which records are snow from edge to edge, and the main
 *  roads' (records 46, 47 and 55) distance fields in tile pixels. */
export class SnowCoverage {
  /** @param {ArrayLike<Uint8Array>} masks - the three archives' bytes, in SNOW_MASK_ARCHIVES' order */
  constructor(masks) {
    if (!masks || masks.length !== SNOW_MASK_ARCHIVES.length) throw new Error('Three winter surface-mask arrays are required.');
    /** @type {Map<number, { pixels: Uint8Array, full: boolean[], roads: Map<number, Float32Array> }>} */
    this.archives = new Map();
    SNOW_MASK_ARCHIVES.forEach((archive, i) => {
      const pixels = masks[i];
      if (!pixels || pixels.length !== SNOW_MASK_BYTES) throw new Error('A winter surface-mask asset has an invalid size.');
      const full = [];
      for (let j = 0; j < MASK_RECORDS; j++) {
        let all = true;
        const o = j * MASK_PIXELS;
        for (let k = 0; k < MASK_PIXELS; k++) if (pixels[o + k] !== 255) { all = false; break; }
        full.push(all);
      }
      const roads = new Map();
      for (const record of ROAD_RECORDS) roads.set(record, roadDistanceField(pixels, record));
      this.archives.set(archive, { pixels, full, roads });
    });
  }

  /** RoadDistance(archive, tile, u, v): tile widths from the road's bare edge, Infinity off a road record. */
  roadDistance(archive, tile, u, v) {
    const a = this.archives.get(archive);
    const field = a?.roads.get(tile >> 2);
    if (!field) return Infinity;
    let [x, y] = turnUv(tile, u, v);
    y = f32(1 - y);
    const cx = clamp01(x), cy = clamp01(y);
    const px = f32(cx * 63), py = f32(cy * 63);
    const x0 = floorToInt(px), y0 = floorToInt(py);
    const x1 = Math.min(x0 + 1, 63), y1 = Math.min(y0 + 1, 63);
    const fx = f32(px - x0), fy = f32(py - y0);
    const along = lerpF(lerpF(field[y0 * 64 + x0], field[y0 * 64 + x1], fx), lerpF(field[y1 * 64 + x0], field[y1 * 64 + x1], fx), fy);
    const ox = f32(x - cx), oy = f32(y - cy);
    return f32(f32(along / 63) + f32(Math.sqrt(f32(f32(ox * ox) + f32(oy * oy)))));
  }

  /** TrySample(archive, tileData, u, v, out coverage): the coverage 0..1, or null when the archive or record is none
   *  of the masks'. */
  sample(archive, tile, u, v) {
    const record = tile >> 2;
    const a = this.archives.get(archive);
    if (!a || record < 0 || record >= MASK_RECORDS) return null;
    const [x, y] = turnUv(tile, u, v);
    const px = f32(clamp01(x) * 63), py = f32(f32(1 - clamp01(y)) * 63);
    const x0 = floorToInt(px), y0 = floorToInt(py);
    const x1 = Math.min(x0 + 1, 63), y1 = Math.min(y0 + 1, 63);
    const fx = f32(px - x0), fy = f32(py - y0);
    const o = record * MASK_PIXELS, p = a.pixels;
    const top = lerpF(p[o + y0 * MASK_TILE + x0], p[o + y0 * MASK_TILE + x1], fx);
    const bottom = lerpF(p[o + y1 * MASK_TILE + x0], p[o + y1 * MASK_TILE + x1], fx);
    return f32(lerpF(top, bottom, fy) / 255);
  }

  /** IsFullySnowCovered(archive, tileData). */
  isFullySnowCovered(archive, tile) {
    const record = tile >> 2;
    const a = this.archives.get(archive);
    return !!a && record >= 0 && record < MASK_RECORDS && a.full[record];
  }
}

/** A road record's distance field: 0 on a bare pixel, else the chamfer distance (1 and 1.4142135) to one - two
 *  passes, forward and back, in float. */
function roadDistanceField(pixels, record) {
  const d = new Float32Array(MASK_PIXELS);
  for (let m = 0; m < MASK_PIXELS; m++) d[m] = pixels[record * MASK_PIXELS + m] === 0 ? 0 : 10000;
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < 64; r++) {
      for (let c = 0; c < 64; c++) {
        const x = pass === 0 ? c : 63 - c;
        const y = pass === 0 ? r : 63 - r;
        const step = pass !== 0 ? 1 : -1;
        const i = y * 64 + x;
        const nx = x + step, ny = y + step;
        if (nx >= 0 && nx < 64) d[i] = Math.min(d[i], f32(d[y * 64 + nx] + 1));
        if (ny >= 0 && ny < 64) {
          d[i] = Math.min(d[i], f32(d[ny * 64 + x] + 1));
          if (x > 0) d[i] = Math.min(d[i], f32(d[ny * 64 + x - 1] + SQRT2_F));
          if (x < 63) d[i] = Math.min(d[i], f32(d[ny * 64 + x + 1] + SQRT2_F));
        }
      }
    }
  }
  return d;
}

/** SnowCoverageData.GetWinterArchive: the climate's ground archive, plus one (its winter set) off the desert. */
export const winterArchiveOf = (climateSettings) => (!climateSettings ? 0
  : climateSettings.climateType === 0 ? climateSettings.groundArchive : climateSettings.groundArchive + 1);

// ---- the static snow a place takes --------------------------------------------------------------------------------
/** EncodeStaticSnow(depthMultiplier, coverage): the multiplier over two in r and b, the coverage in g. */
export function encodeStaticSnow(depthMultiplier, coverage, out = new Uint8Array(4), o = 0) {
  const b = roundToInt(f32(clamp01(f32(depthMultiplier / 2)) * 255));
  out[o] = b; out[o + 1] = roundToInt(f32(clamp01(coverage) * 255)); out[o + 2] = b; out[o + 3] = 255;
  return out;
}
/** TrySampleStaticSnow's depth multiplier: coverage squared, tapered over the last ten degrees below the slope limit. */
export function staticSnowMultiplier(coverage, steepness, maxSnowSlope) {
  if (!(coverage > 0)) return 0;
  const edge = Math.max(0, f32(maxSnowSlope - 10));
  return f32(f32(coverage * coverage) * f32(1 - smoothStepF(edge, maxSnowSlope, steepness)));
}

/** SnapToGrid(position, spacing, origin), in float (Mathf.Round: banker's). */
export function snapToGrid(x, z, spacing, ox, oz) {
  return [f32(ox + f32(roundToInt(f32(f32(x - ox) / spacing)) * spacing)), f32(oz + f32(roundToInt(f32(f32(z - oz) / spacing)) * spacing))];
}

// ---- the track masks ----------------------------------------------------------------------------------------------
/** A mask of `res` x `res` RGBA bytes, every pixel full snow (FillFullSnow). */
export const fullSnowMask = (res) => new Uint8Array(res * res * 4).fill(255);

/**
 * The segment rasterizer the three masks share (DynamicSnowController.RasterizeSegment, MidDetailSnowRing.Rasterize-
 * History, FarTrackMask.StampSegment): a capsule of the track's width from `start` to `end` (scene metres) pressed into
 * the mask's red channel, its floor `remaining` x 255 at the centre and rising to full by a SmoothStep from a quarter
 * of the half-width out; a pixel only ever goes down. The mask's pixel (0, 0) is at `origin`, `scale` pixels a metre,
 * the half-width at least `minRadius` pixels. `onPixel(x, z)` hears each pixel changed (Texture2D.SetPixel); answers
 * the count.
 */
export function rasterizeTrack(pixels, res, originX, originZ, scale, minRadius, sx, sz, ex, ez, width, remaining, onPixel = null) {
  const ax = f32(f32(sx - originX) * scale), az = f32(f32(sz - originZ) * scale);
  const bx = f32(f32(ex - originX) * scale), bz = f32(f32(ez - originZ) * scale);
  const radius = Math.max(minRadius, f32(f32(width * 0.5) * scale));
  const last = res - 1;
  const x0 = clampI(floorToInt(f32(Math.min(ax, bx) - radius)), 0, last), x1 = clampI(ceilToInt(f32(Math.max(ax, bx) + radius)), 0, last);
  const z0 = clampI(floorToInt(f32(Math.min(az, bz) - radius)), 0, last), z1 = clampI(ceilToInt(f32(Math.max(az, bz) + radius)), 0, last);
  const dx = f32(bx - ax), dz = f32(bz - az);
  const sqr = f32(f32(dx * dx) + f32(dz * dz));
  const floor = roundToInt(f32(clamp01(remaining) * 255));
  let changed = 0;
  for (let i = z0; i <= z1; i++) {
    for (let j = x0; j <= x1; j++) {
      const t = sqr > f32(0.0001) ? clamp01(f32(f32(f32(f32(j - ax) * dx) + f32(f32(i - az) * dz)) / sqr)) : 0;
      const dist = distanceF(j, i, f32(ax + f32(dx * t)), f32(az + f32(dz * t)));
      if (dist > radius) continue;
      const v = roundToInt(lerpF(floor, 255, smoothStepF(0.25, 1, f32(dist / radius))));
      const k = (i * res + j) * 4;
      if (v < pixels[k]) { pixels[k] = v; onPixel?.(j, i); changed++; }
    }
  }
  return changed;
}

/** The scroll the masks make when their centre moves (ScrollDynamicMask, ScrollHistory, ScrollPixels): the pixels
 *  move by (-dx, -dz) into `scratch`, the uncovered edge full snow; answers the new pixels (the old array is the next
 *  scratch) or null when the move is a whole mask or more (the caller fills it). */
export function scrollMask(pixels, scratch, res, dx, dz) {
  if (Math.abs(dx) >= res || Math.abs(dz) >= res) return null;
  const lead = dx < 0 ? -dx : 0;
  const span = res - Math.abs(dx);
  for (let i = 0; i < res; i++) {
    const src = i + dz;
    const row = i * res;
    if (src < 0 || src >= res) { scratch.fill(255, row * 4, (row + res) * 4); continue; }
    scratch.fill(255, row * 4, (row + lead) * 4);
    scratch.set(pixels.subarray((src * res + lead + dx) * 4, (src * res + lead + dx + span) * 4), (row + lead) * 4);
    scratch.fill(255, (row + lead + span) * 4, (row + res) * 4);
  }
  return scratch;
}
/** ContainsDeformation: any pixel's red below full. */
export function containsDeformation(pixels) {
  for (let k = 0; k < pixels.length; k += 4) if (pixels[k] < 255) return true;
  return false;
}

// ---- SnowContactRamp ----------------------------------------------------------------------------------------------
/**
 * SnowContactRamp.Apply(pixels, width, height, radius): where full snow (g at or over 250) meets bare ground the
 * snow's static depth ramps up over `radius` pixels - a two-pass chamfer distance in the alpha channel from every
 * pixel that is not full snow, the depth (b into r) scaled by it.
 */
export function snowContactRamp(pixels, width, height, radius) {
  if (!pixels || width < 2 || height < 2 || pixels.length !== width * height * 4 || radius < 1) return;
  for (let k = 0; k < pixels.length; k += 4) { pixels[k] = pixels[k + 2]; pixels[k + 3] = pixels[k + 1] > 1 ? 255 : 0; }
  for (let j = 0; j < height; j++) {
    for (let x = 0; x < width; x++) {
      const i = j * width + x;
      let a = pixels[i * 4 + 3];
      if (x > 0) a = Math.min(a, pixels[(i - 1) * 4 + 3] + 1);
      if (j > 0) {
        a = Math.min(a, pixels[(i - width) * 4 + 3] + 1);
        if (x > 0) a = Math.min(a, pixels[(i - width - 1) * 4 + 3] + 1);
        if (x + 1 < width) a = Math.min(a, pixels[(i - width + 1) * 4 + 3] + 1);
      }
      pixels[i * 4 + 3] = Math.min(a, 255);
    }
  }
  for (let j = height - 1; j >= 0; j--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = j * width + x;
      let a = pixels[i * 4 + 3];
      if (x + 1 < width) a = Math.min(a, pixels[(i + 1) * 4 + 3] + 1);
      if (j + 1 < height) {
        a = Math.min(a, pixels[(i + width) * 4 + 3] + 1);
        if (x > 0) a = Math.min(a, pixels[(i + width - 1) * 4 + 3] + 1);
        if (x + 1 < width) a = Math.min(a, pixels[(i + width + 1) * 4 + 3] + 1);
      }
      pixels[i * 4 + 3] = Math.min(a, 255);
    }
  }
  for (let k = 0; k < pixels.length; k += 4) {
    const a = pixels[k + 3];
    if (pixels[k + 1] >= 250 && a <= radius) {
      const t = radius === 1 ? 0 : clamp01(f32(f32(a - 1) / f32(radius - 1)));
      pixels[k] = roundToInt(f32(pixels[k + 2] * t));
      pixels[k + 3] = roundToInt(f32(255 * t));
    } else if (pixels[k + 1] > 1) {
      pixels[k + 3] = 255;
    }
  }
}

// ---- PersistentTrackField -----------------------------------------------------------------------------------------
export const TRACK_CELL_SIZE = 0.5;
export const TRACK_MAX_CELLS = 65536;
const BUCKET = 64;
const MAX_PACKED_CHARACTERS = 2097152;
const KEY_BIAS = 1 << 25, KEY_SPAN = 1 << 26;
/** MakeKey(x, z): one number for a cell (C#'s long (x << 32) | (uint)z, as a JS-safe integer). */
const makeKey = (x, z) => (x + KEY_BIAS) * KEY_SPAN + (z + KEY_BIAS);
const keyX = (k) => Math.floor(k / KEY_SPAN) - KEY_BIAS;
const keyZ = (k) => (k % KEY_SPAN) - KEY_BIAS;
/** FloorDivide. */
const floorDivide = (v, d) => Math.floor(v / d);

/**
 * C#'s Dictionary and HashSet as they ENUMERATE: entries live in slots in the order they were added, a removal frees
 * its slot and the next add takes the slot freed last. The track field's save writes its cells in this order (and a
 * load re-sequences them in it - which cells a full field evicts first), and a mask's stamp walks a bucket's cells in
 * it; JS's Map, which moves a re-added key to the end, would not.
 */
export class SlotMap {
  constructor() {
    /** @type {Map<number, number>} */ this.index = new Map();
    /** @type {any[]} */ this.keys = [];
    /** @type {any[]} */ this.vals = [];
    /** @type {boolean[]} */ this.live = [];
    /** @type {number[]} */ this.free = [];
  }
  get size() { return this.index.size; }
  has(key) { return this.index.has(key); }
  get(key) { const i = this.index.get(key); return i === undefined ? undefined : this.vals[i]; }
  set(key, value) {
    let i = this.index.get(key);
    if (i === undefined) {
      i = this.free.length ? /** @type {number} */ (this.free.pop()) : this.keys.length;
      this.index.set(key, i); this.keys[i] = key; this.live[i] = true;
    }
    this.vals[i] = value;
    return this;
  }
  delete(key) {
    const i = this.index.get(key);
    if (i === undefined) return false;
    this.index.delete(key); this.live[i] = false; this.keys[i] = undefined; this.vals[i] = undefined; this.free.push(i);
    return true;
  }
  clear() { this.index.clear(); this.keys = []; this.vals = []; this.live = []; this.free = []; }
  *[Symbol.iterator]() { for (let i = 0; i < this.keys.length; i++) if (this.live[i]) yield [this.keys[i], this.vals[i]]; }
  *keysInOrder() { for (let i = 0; i < this.keys.length; i++) if (this.live[i]) yield this.keys[i]; }
}

/**
 * PersistentTrackField: the tracks in 0.5 m cells of the land (global metres), each the least snow left in it, at most
 * 65,536 (the oldest written go first), in buckets of 64 x 64 cells; kept in the save. `toGlobal(x, z)` turns a scene
 * point into global metres (SceneToGlobalMetres: the GPS's world place over SceneMapRatio, plus the point's offset
 * from the player).
 */
export class PersistentTrackField {
  constructor(toGlobal) {
    this.toGlobal = toGlobal;
    /** @type {SlotMap} - key -> { remaining, sequence }, in the Dictionary's order */
    this.cells = new SlotMap();
    /** @type {Map<number, SlotMap>} - a bucket's cells, in the HashSet's order (the key -> itself) */
    this.buckets = new Map();
    /** @type {{ key: number, sequence: number }[]} */
    this.order = [];
    this.orderHead = 0;
    this.nextSequence = 0;
    this.lastSaveRawBytes = 0; this.lastSaveCompressedBytes = 0; this.lastSaveBase64Characters = 0;
    this.evictedCells = 0;
  }
  get count() { return this.cells.size; }
  get hasDeformation() { return this.cells.size > 0; }
  get _orderCount() { return this.order.length - this.orderHead; }

  /** StampSegment(start, end, width, remainingSnow): the capsule pressed into the cells, in double. */
  stampSegment(sx, sz, ex, ez, width, remainingSnow) {
    if (width <= 0 || remainingSnow >= 1) return;
    let [x1, z1] = this.toGlobal(sx, sz);
    let [x2, z2] = this.toGlobal(ex, ez);
    x1 /= TRACK_CELL_SIZE; z1 /= TRACK_CELL_SIZE; x2 /= TRACK_CELL_SIZE; z2 /= TRACK_CELL_SIZE;
    const radius = Math.max(0.75, width * 0.5 / 0.5);
    const minX = Math.floor(Math.min(x1, x2) - radius), maxX = Math.ceil(Math.max(x1, x2) + radius);
    const minZ = Math.floor(Math.min(z1, z2) - radius), maxZ = Math.ceil(Math.max(z1, z2) + radius);
    const dx = x2 - x1, dz = z2 - z1;
    const sqr = dx * dx + dz * dz;
    const floor = roundToInt(f32(clamp01(remainingSnow) * 255));
    for (let i = minZ; i <= maxZ; i++) {
      for (let j = minX; j <= maxX; j++) {
        const cx = j + 0.5, cz = i + 0.5;
        const t = sqr > 0.0001 ? Math.max(0, Math.min(1, ((cx - x1) * dx + (cz - z1) * dz) / sqr)) : 0;
        const ox = cx - (x1 + dx * t), oz = cz - (z1 + dz * t);
        const dist = Math.sqrt(ox * ox + oz * oz);
        if (dist > radius) continue;
        const k = smoothStepF(0.25, 1, f32(dist / radius));
        this._setCellMinimum(j, i, roundToInt(lerpF(floor, 255, k)));
      }
    }
  }

  /** ApplyToMask(pixels, resolution, sceneCenter, diameter, preserved...): every cell in the mask's square stamped as a
   *  disc into its red (StampMaskPoint), except inside the preserved pixel rectangle (the part a scroll kept). */
  applyToMask(pixels, res, centerX, centerZ, diameter, pMinX = 0, pMaxX = -1, pMinZ = 0, pMaxZ = -1) {
    if (!pixels || pixels.length !== res * res * 4 || res < 2 || diameter <= 0 || this.cells.size === 0) return 0;
    const [wx, wz] = this.toGlobal(centerX, centerZ);
    const half = diameter * 0.5;
    const minX = Math.floor((wx - half) / 0.5) - 1, maxX = Math.ceil((wx + half) / 0.5) + 1;
    const minZ = Math.floor((wz - half) / 0.5) - 1, maxZ = Math.ceil((wz + half) / 0.5) + 1;
    const bx0 = floorDivide(minX, BUCKET), bx1 = floorDivide(maxX, BUCKET), bz0 = floorDivide(minZ, BUCKET), bz1 = floorDivide(maxZ, BUCKET);
    const scale = f32(f32(res - 1) / diameter);
    const radius = Math.max(0.75, f32(0.3 * scale));
    let changed = 0;
    for (let bz = bz0; bz <= bz1; bz++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const bucket = this.buckets.get(makeKey(bx, bz));
        if (!bucket) continue;
        for (const key of bucket.keysInOrder()) {
          const cell = this.cells.get(key);
          if (!cell) continue;
          const x = keyX(key), z = keyZ(key);
          if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
          const gx = (x + 0.5) * 0.5, gz = (z + 0.5) * 0.5;
          const px = f32((gx - (wx - half)) * scale), pz = f32((gz - (wz - half)) * scale);
          changed += stampMaskPoint(pixels, res, px, pz, radius, cell.remaining, pMinX, pMaxX, pMinZ, pMaxZ);
        }
      }
    }
    return changed;
  }

  /** Refill(byteStep): every cell rises by the step; a cell that reaches full is gone. */
  refill(byteStep) {
    if (byteStep <= 0 || this.cells.size === 0) return;
    for (const key of [...this.cells.keysInOrder()]) {
      const cell = this.cells.get(key);
      if (!cell) continue;
      const v = Math.min(255, cell.remaining + byteStep);
      if (v >= 255) { this._removeCell(key); continue; }
      cell.remaining = v;
    }
    this._compact();
  }

  /** Clear(). */
  clear() {
    this.cells.clear(); this.buckets.clear(); this.order = []; this.orderHead = 0; this.nextSequence = 0;
    this.lastSaveRawBytes = 0; this.lastSaveCompressedBytes = 0; this.lastSaveBase64Characters = 0; this.evictedCells = 0;
  }

  /** WriteSaveData(data): nine bytes a cell (x and z little-endian, the snow left), deflated, base64 - into the record. */
  writeSaveData(data) {
    if (!data) return;
    data.FormatVersion = 1;
    data.CellCount = this.cells.size;
    this.lastSaveRawBytes = this.cells.size * 9;
    if (this.cells.size === 0) { data.PackedCells = ''; this.lastSaveCompressedBytes = 0; this.lastSaveBase64Characters = 0; return; }
    const raw = new Uint8Array(this.cells.size * 9);
    const view = new DataView(raw.buffer);
    let o = 0;
    for (const [key, cell] of this.cells) {
      view.setInt32(o, keyX(key), true); view.setInt32(o + 4, keyZ(key), true); raw[o + 8] = cell.remaining;
      o += 9;
    }
    const packed = deflateRaw(raw);
    this.lastSaveCompressedBytes = packed.length;
    data.PackedCells = bytesToBase64(packed);
    this.lastSaveBase64Characters = data.PackedCells.length;
  }

  /** RestoreSaveData(data): true when the record was taken (or held nothing); a malformed one leaves the field empty. */
  restoreSaveData(data) {
    this.clear();
    if (!data || !data.CellCount || !data.PackedCells) return true;
    const count = data.CellCount;
    if (data.FormatVersion !== 1 || !Number.isInteger(count) || count < 0 || count > TRACK_MAX_CELLS || data.PackedCells.length > MAX_PACKED_CHARACTERS) return false;
    try {
      if (/[^A-Za-z0-9+/=]/.test(data.PackedCells)) throw new Error('not base64');
      const raw = inflateRaw(base64ToBytes(data.PackedCells));
      if (raw.length !== count * 9) throw new Error('the cells are not the count');
      const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      for (let j = 0; j < raw.length; j += 9) {
        const b = raw[j + 8];
        if (b < 255) this._setCellMinimum(view.getInt32(j, true), view.getInt32(j + 4, true), b);
      }
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  /** SetCellMinimum(x, z, remaining): a cell keeps the least snow it was left; a new or deeper one is the newest
   *  written; past the limit the oldest go. */
  _setCellMinimum(x, z, remaining) {
    if (remaining >= 255) return;
    const key = makeKey(x, z);
    const cell = this.cells.get(key);
    if (cell) {
      if (remaining < cell.remaining) {
        this._compact(1);
        cell.remaining = remaining;
        cell.sequence = ++this.nextSequence;
        this.order.push({ key, sequence: cell.sequence });
        this._compact();
      }
      return;
    }
    this._compact(1);
    const fresh = { remaining, sequence: ++this.nextSequence };
    this.cells.set(key, fresh);
    this.order.push({ key, sequence: fresh.sequence });
    const bucketKey = makeKey(floorDivide(x, BUCKET), floorDivide(z, BUCKET));
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) { bucket = new SlotMap(); this.buckets.set(bucketKey, bucket); }
    bucket.set(key, key);
    while (this.cells.size > TRACK_MAX_CELLS && this._orderCount > 0) {
      const ref = this.order[this.orderHead++];
      const c = this.cells.get(ref.key);
      if (c && c.sequence === ref.sequence) { this._removeCell(ref.key); this.evictedCells++; }
    }
    this._compact();
  }

  /** CompactInsertionOrder(pendingAppend): the queue keeps only live references once it is over twice the cells. */
  _compact(pendingAppend = 0) {
    if (this.cells.size === 0) { if (this._orderCount !== 0) { this.order = []; this.orderHead = 0; } return; }
    if (this._orderCount + pendingAppend <= Math.max(1024, 2 * this.cells.size)) return;
    const live = [];
    for (let i = this.orderHead; i < this.order.length; i++) {
      const ref = this.order[i];
      const c = this.cells.get(ref.key);
      if (c && c.sequence === ref.sequence) live.push(ref);
    }
    this.order = live; this.orderHead = 0;
  }

  /** RemoveCell(key). */
  _removeCell(key) {
    this.cells.delete(key);
    const bucketKey = makeKey(floorDivide(keyX(key), BUCKET), floorDivide(keyZ(key), BUCKET));
    const bucket = this.buckets.get(bucketKey);
    if (bucket) { bucket.delete(key); if (bucket.size === 0) this.buckets.delete(bucketKey); }
  }
}

/** StampMaskPoint: a disc of `radius` pixels at (cx, cz) lowering the red to `target`, outside the preserved
 *  rectangle; answers the pixels changed. */
function stampMaskPoint(pixels, res, cx, cz, radius, target, pMinX, pMaxX, pMinZ, pMaxZ) {
  const x0 = clampI(floorToInt(f32(cx - radius)), 0, res - 1), x1 = clampI(ceilToInt(f32(cx + radius)), 0, res - 1);
  const z0 = clampI(floorToInt(f32(cz - radius)), 0, res - 1), z1 = clampI(ceilToInt(f32(cz + radius)), 0, res - 1);
  let changed = 0;
  for (let i = z0; i <= z1; i++) {
    for (let j = x0; j <= x1; j++) {
      if (!(j < pMinX || j > pMaxX || i < pMinZ || i > pMaxZ)) continue;
      if (distanceF(j, i, cx, cz) > radius) continue;
      const k = (i * res + j) * 4;
      if (target < pixels[k]) { pixels[k] = target; changed++; }
    }
  }
  return changed;
}

// ---- CorpseImpressions --------------------------------------------------------------------------------------------
/** CorpseImpressions.Rasterize: a body's hollow - a rounded square of `radius` pixels at (x, z) lowering the green to
 *  `refilled` at its middle 40%, rising by a SmoothStep to full at its edge. */
export function rasterizeCorpse(pixels, res, x, z, radius, refilled) {
  const reach = f32(radius + 0.5);
  if (radius <= 0 || f32(x + reach) < 0 || f32(z + reach) < 0 || f32(x - reach) > res - 1 || f32(z - reach) > res - 1) return false;
  const x0 = Math.max(0, floorToInt(f32(x - reach))), x1 = Math.min(res - 1, ceilToInt(f32(x + reach)));
  const z0 = Math.max(0, floorToInt(f32(z - reach))), z1 = Math.min(res - 1, ceilToInt(f32(z + reach)));
  let changed = false;
  for (let i = z0; i <= z1; i++) {
    for (let j = x0; j <= x1; j++) {
      const ox = Math.max(0, f32(Math.abs(f32(j - x)) - 0.5)), oz = Math.max(0, f32(Math.abs(f32(i - z)) - 0.5));
      const d = f32(Math.sqrt(f32(f32(ox * ox) + f32(oz * oz))));
      const t = clamp01(f32(f32(f32(d / radius) - f32(0.4)) / f32(0.6)));
      const s = f32(f32(t * t) * f32(3 - f32(2 * t)));
      const v = roundToInt(lerpF(refilled, 255, s));
      const k = (i * res + j) * 4 + 1;
      if (v < pixels[k]) { pixels[k] = v; changed = true; }
    }
  }
  return changed;
}

/**
 * CorpseImpressions: the bodies lying in the snow outdoors, each kept at its global place; a body gone (looted away,
 * its pile cleared) refills over the refill's hours and is then forgotten. `register(corpse)` takes `{ alive(),
 * x, z }` - its global metres as it fell - and `project` stamps them into a mask's green.
 */
export class CorpseImpressions {
  constructor(toGlobal) {
    this.toGlobal = toGlobal;
    /** @type {{ corpse: any, x: number, z: number, refilled: number }[]} */
    this.impressions = [];
    this.enabled = true;
    this.width = f32(1.5);
  }
  get hasImpressions() { return this.enabled && this.impressions.length > 0; }
  get activeCount() { let n = 0; for (const i of this.impressions) if (i.corpse.alive()) n++; return n; }

  /** Register(corpse): a body not yet held, in the exterior; false when it is not one or is held already. */
  register(corpse) {
    if (!this.enabled || !corpse || !corpse.alive()) return false;
    if (this.impressions.some((i) => i.corpse === corpse || (corpse.id != null && i.corpse.id === corpse.id))) return false;
    this.impressions.push({ corpse, x: corpse.x, z: corpse.z, refilled: 0 });
    return true;
  }
  clear() { this.impressions.length = 0; }

  /** Refill(byteStep): a body gone fills back by the step and is forgotten at full; true when any was gone. */
  refill(byteStep) {
    let any = false;
    for (let n = this.impressions.length - 1; n >= 0; n--) {
      const i = this.impressions[n];
      if (i.corpse.alive()) continue;
      any = true;
      i.refilled = Math.min(255, i.refilled + byteStep);
      if (i.refilled === 255) this.impressions.splice(n, 1);
    }
    return any;
  }

  /** Project(pixels, resolution, center, diameter): the mask's green reset to full and every body stamped into it;
   *  true when any green changed. */
  project(pixels, res, centerX, centerZ, diameter) {
    if (!pixels || diameter <= 0) return false;
    let changed = false;
    for (let k = 1; k < pixels.length; k += 4) { if (pixels[k] !== 255) changed = true; pixels[k] = 255; }
    if (!this.enabled || this.impressions.length === 0) return changed;
    const [gx, gz] = this.toGlobal(centerX, centerZ);
    const ox = gx - diameter * 0.5, oz = gz - diameter * 0.5;
    const scale = f32(f32(res - 1) / diameter);
    const radius = f32(f32(f32(this.width * 0.5)) * scale);
    for (const i of this.impressions) {
      changed = rasterizeCorpse(pixels, res, f32((i.x - ox) * scale), f32((i.z - oz) * scale), radius, i.refilled) || changed;
    }
    return changed;
  }
}

// ---- SnowContextData's own law ------------------------------------------------------------------------------------
/** SnowContextData.OutsideWeight(outside, feather): 255 inside, falling by a smoothstep to 0 at the feather. */
export function outsideWeight(outside, feather) {
  if (outside <= 0) return 255;
  if (feather <= 0 || outside >= feather) return 0;
  const t = outside / feather;
  const s = t * t * (3 - 2 * t);
  return roundToInt(f32((1 - s) * 255));
}
/** SnowContextData.IsVanillaLocation: DFRegion.LocationTypes up to HiddenLocation (13). */
export const isVanillaLocation = (type) => type <= 13;
/** SnowContextData.LocationRect(mapX, mapY, location): a location's block grid in global metres - its pixel's corner
 *  (MapsFile.MapPixelToWorldCoord), its tile origin (TerrainHelper.GetLocationTerrainTileOrigin, 256 world units a
 *  tile) and 4096 world units a block, over StreamingWorld.SceneMapRatio. */
export function locationRect(mapX, mapY, tileOrigin, width, height) {
  const x = mapX * 32768 + tileOrigin.x * 2 * 128, z = (499 - mapY) * 32768 + tileOrigin.y * 2 * 128;
  return { minX: x / 40, minZ: z / 40, maxX: (x + width * 4096) / 40, maxZ: (z + height * 4096) / 40 };
}
/** The distance from (x, z) to a rectangle `{ minX, minZ, maxX, maxZ }`, 0 inside (SampleSettlement's own, kept in this module). */
function rectDistance(r, x, z) {
  const ox = Math.max(Math.max(r.minX - x, x - r.maxX), 0), oz = Math.max(Math.max(r.minZ - z, z - r.maxZ), 0);
  return Math.sqrt(ox * ox + oz * oz);
}
/** SampleSettlement / SampleLocationCap: the nearest rectangle's outside weight (255 inside one), 0 with none. */
export function rectWeight(rects, x, z, feather) {
  if (!rects.length) return 0;
  let best = Number.MAX_VALUE;
  for (const r of rects) {
    const d = rectDistance(r, x, z);
    if (d < best) best = d;
    if (best === 0) return 255;
  }
  return outsideWeight(best, feather);
}

// ---- BlanketSurfaceSamples.InterpolateQuad ------------------------------------------------------------------------
/** InterpolateQuad(a, right, top, c, fx, fz): a grid cell's two triangles' barycentrics (the diagonal from a to c),
 *  the height and normal blended, the three corners' contexts carried for the shader to resolve and blend. */
export function interpolateQuad(a, right, top, c, fx, fz) {
  const mid = fz >= fx ? top : right;
  const wa = f32(1 - Math.max(fx, fz)), wm = Math.abs(f32(fz - fx)), wc = Math.min(fx, fz);
  const blend = (p, q, r) => f32(f32(f32(p * wa) + f32(q * wm)) + f32(r * wc));
  return {
    height: blend(a.height, mid.height, c.height),
    normal: [0, 1, 2].map((k) => blend(a.normal[k], mid.normal[k], c.normal[k])),
    contextA: a.contextA, contextB: mid.contextA, contextC: c.contextA,
    blend: [wa, wm, wc],
    offset: blend(a.offset, mid.offset, c.offset),
  };
}

// ---- BasicRoadsClassifier and BasicRoadsTerrain -------------------------------------------------------------------
/** BasicRoadsClassifier.Kind. */
export const ROAD_KIND = Object.freeze({ none: 0, road: 1, path: 2 });
const ROAD_EDGE = [47, 47, 55, 55];
const TRACK_STRAIGHT = [0, 99, 11, 26];
const TRACK_DIAGONAL = [0, 99, 51, 52];
const TRACK_EDGE = [0, 99, 12, 27];
const TRACK_CORNER = [0, 99, 10, 25];
const PATH_POLYGONS = [
  [[0.5, 0], [1, 0], [1, 1], [0.5, 1]],
  [[0, 0], [1, 0], [1, 1], [0.5, 1], [0, 0.5]],
  [[0.5, 0], [1, 0], [1, 0.5]],
  [[0, 0], [0.5, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 0.5]],
];
const HALF_SQRT2_F = f32(0.70710677);
/** The road records Basic Roads paints: its road and the tracks' four sets (BasicRoadsTerrain's classification set). */
export const PAINTED_ROAD_RECORDS = Object.freeze([46, 47, 55, 10, 11, 12, 25, 26, 27, 51, 52]);

/** PathUV: a path tile's (u, v) under its turn. */
function pathUv(tile, u, v) {
  switch (tile & 3) {
    case 1: return [v, f32(1 - u)];
    case 2: return [f32(1 - u), f32(1 - v)];
    case 3: return [f32(1 - v), u];
    default: return [u, v];
  }
}
/** BasicRoadsClassifier.PathEdgeDistance(tile, u, v): signed distance in tile widths to a track's painted edge -
 *  0 or less on the track; Infinity for a tile that is no track. */
export function pathEdgeDistance(tile, u, v) {
  const [x, y] = pathUv(tile, u, v);
  switch (tile >> 2) {
    case 11: case 26: return f32(0.5 - x);
    case 10: case 25: return f32(f32(f32(y - x) - 0.5) * HALF_SQRT2_F);
    case 12: case 27: return f32(f32(f32(y - x) + 0.5) * HALF_SQRT2_F);
    case 51: case 52: return f32(f32(Math.abs(f32(x - y)) - 0.5) * HALF_SQRT2_F);
    default: return Infinity;
  }
}
/** BasicRoadsClassifier.PathOutsideDistance(tile, u, v): tile widths from (u, v) to the track's painted polygon, 0 on
 *  it, Infinity for a tile that is no track. */
export function pathOutsideDistance(tile, u, v) {
  let poly;
  switch (tile >> 2) {
    case 11: case 26: poly = 0; break;
    case 10: case 25: poly = 1; break;
    case 12: case 27: poly = 2; break;
    case 51: case 52: poly = 3; break;
    default: return Infinity;
  }
  const [x, y] = pathUv(tile, u, v);
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1 && pathEdgeDistance(tile, u, v) <= 0) return 0;
  const pts = PATH_POLYGONS[poly];
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const ex = f32(bx - ax), ey = f32(by - ay);
    const t = clamp01(f32(f32(f32(f32(x - ax) * ex) + f32(f32(y - ay) * ey)) / f32(f32(ex * ex) + f32(ey * ey))));
    const dx = f32(f32(x - ax) - f32(t * ex)), dy = f32(f32(y - ay) - f32(t * ey));
    best = Math.min(best, f32(f32(dx * dx) + f32(dy * dy)));
  }
  return f32(Math.sqrt(best));
}
/** BasicRoadsClassifier.Corners(west, east): the diagonal bits a pixel's neighbours carry into its corners. */
export const roadCorners = (west, east) => ((east & 5) | (west & 0x50)) & 255;

/**
 * BasicRoadsClassifier.Predict(x, y, flags, corners, ground, road, locationRect): the tile Basic Roads paints at (x, y)
 * of a pixel whose network bits are `flags` (and `corners`) - a road's, or a track's on ground set `ground` - or -1.
 * A road inside a location's rectangle is 184 (the location's own paving stands there).
 */
export function predictRoadTile(x, y, flags, corners, ground, road, rect) {
  if (x < 0 || x >= 128 || y < 0 || y >= 128 || ground < 0 || ground > 3) return -1;
  let tile = -1;
  const paint = (record, rotate, flip, overwrite = true) => {
    if ((!overwrite && tile >= 0) || record === 99) return false;
    tile = (record << 2) | (rotate ? 1 : 0) | (flip ? 2 : 0);
    return true;
  };
  let painted = false;
  const straight = road ? 46 : TRACK_STRAIGHT[ground];
  const diagonal = road ? 46 : TRACK_DIAGONAL[ground];
  const edge = road ? ROAD_EDGE[ground] : TRACK_EDGE[ground];
  if (flags !== 0) {
    const mid = x === 63 || x === 64, midY = y === 63 || y === 64;
    if (((flags & 0x80) && mid && y > 63) || ((flags & 8) && mid && y < 64)) painted = paint(straight, false, x === 64) || painted;
    if (((flags & 0x80) && mid && y === 63) || ((flags & 8) && mid && y === 64)) painted = paint(edge, x === y, x === 64, false) || painted;
    if (((flags & 0x20) && midY && x > 63) || ((flags & 2) && midY && x < 64)) painted = paint(straight, true, y === 64) || painted;
    if (((flags & 0x20) && midY && x === 63) || ((flags & 2) && midY && x === 64)) painted = paint(edge, x === y, x === 64, false) || painted;
    if (((flags & 0x40) && x === y && x > 63) || ((flags & 4) && x === y && x < 64)) painted = paint(diagonal, false, false) || painted;
    if (!painted && (((flags & 0x40) && ((x === y + 1 && x > 63) || (x + 1 === y && y > 63))) || ((flags & 4) && ((x === y + 1 && x <= 64) || (x + 1 === y && y <= 64))))) {
      painted = paint(edge, false, x === y + 1) || painted;
    }
    const nx = 127 - x;
    if (((flags & 1) && nx === y && x < 64) || ((flags & 0x10) && nx === y && x > 63)) painted = paint(diagonal, true, false) || painted;
    if (!painted && (((flags & 1) && ((nx === y + 1 && x < 64) || (nx + 1 === y && y > 63))) || ((flags & 0x10) && ((nx === y + 1 && x >= 63) || (nx + 1 === y && y <= 64))))) {
      painted = paint(edge, true, nx !== y + 1) || painted;
    }
    if (!road) {
      if ((flags & 0x80) && (flags & 2) && x === 63 && y === 64) paint(TRACK_CORNER[ground], false, false);
      if ((flags & 0x80) && (flags & 0x20) && x === 64 && y === 64) paint(TRACK_CORNER[ground], true, true);
      if ((flags & 8) && (flags & 2) && x === 63 && y === 63) paint(TRACK_CORNER[ground], true, false);
      if ((flags & 8) && (flags & 0x20) && x === 64 && y === 63) paint(TRACK_CORNER[ground], false, true);
    }
    if (road && x > rect.xMin && x < rect.xMax && y > rect.yMin && y < rect.yMax) return 184;
  }
  if ((corners & 1) && x === 127 && y === 127) paint(edge, true, false);
  if ((corners & 4) && x === 127 && y === 0) paint(edge, false, false);
  if ((corners & 0x10) && x === 0 && y === 0) paint(edge, true, true);
  if ((corners & 0x40) && x === 0 && y === 127) paint(edge, false, true);
  return tile;
}

/** BasicRoadsClassifier.Classify: a painted tile is the network's road when a road's prediction on any ground set is
 *  it, a track's when (on the two track sets, where no road is) a track's is; an authored location tile is neither. */
export function classifyRoadTile(x, y, actual, net, rect, authored) {
  if (authored) return ROAD_KIND.none;
  for (let g = 0; g <= 3; g++) if (predictRoadTile(x, y, net.roads, net.roadCorners, g, true, rect) === actual) return ROAD_KIND.road;
  for (let g = 2; g <= 3; g++) {
    if (predictRoadTile(x, y, net.roads, net.roadCorners, g, true, rect) < 0 && predictRoadTile(x, y, net.paths, net.pathCorners, g, false, rect) === actual) return ROAD_KIND.path;
  }
  return ROAD_KIND.none;
}

/** BasicRoadsTerrain.MarkAuthoredBlock(authored, ground, originX, originZ): a block's own ground - each tile whose
 *  record is under 56, the tiles TerrainHelper.SetLocationTiles stamps - marked authored, row 0 south. `ground` is the
 *  block's RmbGroundTiles[16, 16] ([x][y], y from the north). */
export function markAuthoredBlock(authored, ground, originX, originZ) {
  if (!authored || authored.length !== 16384 || !ground || ground.length !== 16 || ground.some((c) => !c || c.length !== 16) || originX < 0 || originZ < 0 || originX + 16 > 128 || originZ + 16 > 128) {
    throw new Error('Malformed authored exterior ground block.');
  }
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if (ground[j][15 - i].textureRecord < 56) authored[(originZ + i) * 128 + originX + j] = 1;
}

/** BasicRoadsTerrain: one pixel's painted tiles, each road record classified as the network's road or track. */
export class BasicRoadsTerrain {
  /**
   * @param {ArrayLike<number>} tiles - the pixel's 128 x 128 TileMap bytes (record << 2 | turn), row 0 south
   * @param {ArrayLike<boolean>} authored - the tiles a location's own blocks lay
   * @param {{ roads: number, roadCorners: number, paths: number, pathCorners: number }} net
   * @param {{ xMin: number, xMax: number, yMin: number, yMax: number }} rect - the location's rectangle in tiles
   */
  constructor(mapX, mapY, tiles, authored, net, rect) {
    if (!tiles || tiles.length !== 16384 || !authored || authored.length !== tiles.length) throw new Error('Expected 128 by 128 promoted and authored tile arrays.');
    this.mapX = mapX; this.mapY = mapY;
    this.tiles = Uint8Array.from(tiles);
    this.kinds = new Uint8Array(16384);
    this.roadTiles = 0; this.pathTiles = 0;
    for (let z = 0; z < 128; z++) {
      for (let x = 0; x < 128; x++) {
        const i = z * 128 + x;
        if (!PAINTED_ROAD_RECORDS.includes(this.tiles[i] >> 2)) continue;
        const k = classifyRoadTile(x, z, this.tiles[i], net, rect, authored[i]);
        this.kinds[i] = k;
        if (k === ROAD_KIND.road) this.roadTiles++;
        if (k === ROAD_KIND.path) this.pathTiles++;
      }
    }
  }
  at(x, z) { return x >= 0 && z >= 0 && x < 128 && z < 128 ? this.kinds[z * 128 + x] : ROAD_KIND.none; }
  /** PathTile(x, z): the tile byte where a track lies, else 0. */
  pathTile(x, z) { return this.at(x, z) === ROAD_KIND.path ? this.tiles[z * 128 + x] : 0; }
  /** SamplePath(x, z, tileMetres, featherMetres): the track weight at (x, z) in tiles - 255 on a track, falling over
   *  the feather outside. */
  samplePath(x, z, tileMetres, featherMetres) {
    if (this.pathTiles === 0 || tileMetres <= 0 || featherMetres < 0 || featherMetres > tileMetres) return 0;
    const fx = floorToInt(x), fz = floorToInt(z);
    let best = Infinity;
    for (let i = Math.max(0, fz - 1); i <= Math.min(127, fz + 1); i++) {
      for (let j = Math.max(0, fx - 1); j <= Math.min(127, fx + 1); j++) {
        const k = i * 128 + j;
        if (this.kinds[k] !== ROAD_KIND.path) continue;
        best = Math.min(best, f32(pathOutsideDistance(this.tiles[k], f32(x - j), f32(z - i)) * tileMetres));
        if (best === 0) return 255;
      }
    }
    return outsideWeight(best, featherMetres);
  }
  /** SampleBerm(x, z, tileMetres, width, archive, coverage): the road shoulder's weight - a bell over `width` metres
   *  out from a main road's bare edge. */
  sampleBerm(x, z, tileMetres, width, archive, coverage) {
    if (this.roadTiles === 0 || width <= 0 || width > tileMetres) return 0;
    const fx = floorToInt(x), fz = floorToInt(z);
    let best = Infinity;
    for (let i = Math.max(0, fz - 1); i <= Math.min(127, fz + 1); i++) {
      for (let j = Math.max(0, fx - 1); j <= Math.min(127, fx + 1); j++) {
        const k = i * 128 + j;
        if (this.kinds[k] === ROAD_KIND.road) best = Math.min(best, f32(coverage.roadDistance(archive, this.tiles[k], f32(x - j), f32(z - i)) * tileMetres));
      }
    }
    if (best <= 0 || best >= width) return 0;
    const t = f32(best / width);
    const bell = f32(f32(4 * t) * f32(1 - t));
    return roundToInt(f32(f32(bell * bell) * 255));
  }
}
