// @ts-check
// STOREFRONT (2026-10-29, the brief: "world changes with new dwemer enemies/boss/weapon"; bible/06-Systems/Battle-Pass.md
// section 6): THE SEASON IN THE WORLD, ITS LAW - the same on every machine from the shared clock and the map files. The
// tremor: the first seconds of each hour of an open stage. The fissures: a few an AREA each stage (a Bay region, a
// province's district - W14, TAMRIEL-WIDE), on the gate's suitable pixels of each theatre's scan (systems/gate/gateSite.js,
// theatreGateSite.js), drawn by hash, apart, off the roads; the third stage's first its Heart Fissure; one beside its
// theatre's gate of the day gives way. Their camps stand on the camp law's brass sites (wodShared.js brassSiteId, the
// world's pixel in them) - no relay change. Pure. Not a DFU member. Ledger A (STOREFRONT).
import { passSeasonAt, passStageAt, PASS_SEASONS } from '../../net/battlePassLaw.js';
import { gateHash, PIXEL_M, GATE_SPOT_SPREAD_M } from '../../net/gate/gateLaw.js';
import { siteEventLaneOpen } from '../../net/wire.js';   // W14: the theatres a site-bound world event stands in (Cyrodiil's none)
import { worldPixelOfKey, areaName, isBayArea, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';
import { regionOfTheatre } from '../../formats/mapsTables.js';
import { brassSiteId } from '../../world/worldOfDaggerfall/wodShared.js';
import { UNITS_PER_METRE } from '../../world/road/roadClearance.js';
import { nearRoad } from '../../world/road/roadBand.js';   // W14: Basic Roads' arms on the Bay, the curves past it

// BAY-OWN: the Bay's gate scan lists a region's pixels by MapsFile's id, y * 1000 + x (systems/gate/gateSite.js gateScanner)
const W = 1000;
/** The season's own salt on the gate's hash. */
export const SEASON_SALT = 0x5ea50;
/** The tremor: once an hour on the shared clock, the ground shaking this long, its force by the stage (the camera's kick,
 *  systems/betterAmbience.js weaponKick - a gun's shot is 3, a star landing beside you 4). */
export const TREMOR_EVERY_MS = 3_600_000;
export const TREMOR_MS = 6000;
export const TREMOR_KICK = Object.freeze([1.5, 2.5, 4]);
/** How many fissures stand in each area (a Bay region, a province's district), by the stage. */
export const FISSURES_BY_STAGE = Object.freeze([2, 3, 3]);
/** The stage whose first fissure in each area is its Heart Fissure. */
export const HEART_STAGE = 2;
/** How far apart an area's fissures stand, map pixels (Chebyshev) - about three km - and how many draws each is given. */
export const FISSURE_APART_PX = 4;
export const FISSURE_DRAWS = 24;
/** A fissure keeps this far off its theatre's gate of the day, map pixels (Chebyshev): the gate's pixel and its neighbours. */
export const FISSURE_GATE_PX = 1;
/** STOREFRONT (AUDIT LANE 5): a fissure's heart keeps this far past a road's or a track's band, metres - its scorch and
 *  wreckage (world/fissureModel.js FISSURE_BARE_R, 10) and a step more: 7 of the season's 344 had stood their solid
 *  slabs on a road. */
export const FISSURE_ROAD_M = 12;

/**
 * THE CONSTRUCTS a fissure's camp stands, by the stage (Daggerfall Enemy Expansion's: 289 the Centurion Sphere, 270 the
 * Iron Golem, 290 the Steam Centurion), and the Heart Fissure's escort beside its Colossus (a Steam Centurion).
 */
export const FISSURE_ROSTER = Object.freeze([
  Object.freeze([289, 289, 270]),
  Object.freeze([289, 270, 290]),
  Object.freeze([289, 270, 290, 290]),
]);
export const HEART_ESCORT = Object.freeze([289, 289, 270]);
export const COLOSSUS_MOBILE = 290;

/** The season's number: its place in the law's list, from 1 (0: none). */
export const seasonNumber = (/** @type {any} */ season) => (season ? PASS_SEASONS.indexOf(season) + 1 : 0);
/** The season and its stage at `nowMs` on the shared clock: `{ season, n, stage }`, or null outside every season. */
export function seasonStageAt(/** @type {number} */ nowMs) {
  const season = passSeasonAt(nowMs);
  const stage = passStageAt(season, nowMs);
  return season && stage >= 0 ? { season, n: seasonNumber(season), stage } : null;
}

/**
 * THE TREMOR at `nowMs`: `{ hour, since, stage, share, kick }` while the ground shakes - the first TREMOR_MS of each hour
 * inside an open stage - else null. `share` how far through it is, `kick` the camera's force now: a swell to its peak a
 * fifth of the way in, then dying away.
 */
export function tremorAt(/** @type {number} */ nowMs) {
  const at = seasonStageAt(nowMs);
  if (!at) return null;
  const hour = Math.floor(nowMs / TREMOR_EVERY_MS), since = nowMs - hour * TREMOR_EVERY_MS;
  if (since >= TREMOR_MS) return null;
  const share = since / TREMOR_MS;
  const swell = share < 0.2 ? share / 0.2 : (1 - share) / 0.8;
  return { hour, since, stage: at.stage, share, kick: TREMOR_KICK[at.stage] * swell };
}

/** A fissure's roll `j` - the gate's hash under the season's salt, by its area (a Bay region is its own area, so the Bay's
 *  rolls are what they were before W14). */
export const fissureRoll = (/** @type {number} */ n, /** @type {number} */ stage, /** @type {number} */ area, /** @type {number} */ k, /** @type {number} */ j) => gateHash(SEASON_SALT, n, stage, area, k, j);
const unit = (n, stage, area, k, j) => fissureRoll(n, stage, area, k, j) / 4294967296;
/** A fissure's heart inside its pixel, metres from its south-west corner ([east, north]) - the gate's frame and spread. */
export function fissureSpotLocal(n, stage, area, k) {
  const a = unit(n, stage, area, k, 1) * 2 * Math.PI, r = Math.sqrt(unit(n, stage, area, k, 2)) * GATE_SPOT_SPREAD_M;
  return [PIXEL_M / 2 + Math.cos(a) * r, PIXEL_M / 2 + Math.sin(a) * r];
}

/**
 * @typedef {{ key: string, n: number, stage: number, region: number, area: number, theatre: number, k: number, heart: boolean,
 *   px: number, py: number, town: any, near: string, regionName: string, spot: number[], yaw: number, site: string,
 *   hSite: string|null }} Fissure
 */
const apart = (a, px, py, d) => Math.max(Math.abs(a.px - px), Math.abs(a.py - py)) >= d;
/** Whether a heart at `spot` in pixel (px, py) reaches a road's or a track's band, FISSURE_ROAD_M past it (null roads:
 *  none) - Basic Roads' arms on the Bay, past it the roads as the terrain draws them (world/road/roadBand.js nearRoad). */
const onRoad = (paths, px, py, spot) => !!paths && nearRoad(paths, px, py, spot[0] * UNITS_PER_METRE, spot[1] * UNITS_PER_METRE, FISSURE_ROAD_M * UNITS_PER_METRE);
/**
 * AN AREA'S FISSURES for season `n`'s stage `stage`: up to FISSURES_BY_STAGE[stage], each `{ key, n, stage, region, area,
 * theatre, k, heart, px, py, town, near, regionName, spot, yaw, site, hSite }` - `site` its constructs' camp, `hSite` its
 * Colossus's (the Heart Fissure's alone). Drawn from `pixels` (`at(id)` a pixel, `townOf(id)` its nearest town); an area
 * too small gives fewer. AUDIT LANE 5: a draw whose heart reaches `paths` (the room's roads and tracks) is passed over, as
 * one too near. `where` its region (0..70), its theatre and its region's name.
 */
function drawFissures(n, stage, area, pixels, at, townOf, where, paths) {
  if (!pixels?.length) return [];
  /** @type {Fissure[]} */ const out = [];
  for (let k = 0; k < (FISSURES_BY_STAGE[stage] ?? 0); k++) {
    let pick = -1, px = 0, py = 0;
    const spot = fissureSpotLocal(n, stage, area, k);
    for (let d = 0; d < FISSURE_DRAWS && pick < 0; d++) {
      const id = pixels[fissureRoll(n, stage, area, k, 100 + d) % pixels.length], [x, y] = at(id);
      if (out.every((f) => apart(f, x, y, FISSURE_APART_PX)) && !onRoad(paths, x, y, spot)) { pick = id; px = x; py = y; }
    }
    if (pick < 0) continue;
    const heart = stage === HEART_STAGE && k === 0;
    const town = townOf(pick);
    out.push({
      key: `${n}.${stage}.${area}.${k}`, n, stage, region: where.region, area, theatre: where.theatre, k, heart, px, py, town,
      near: town?.name || where.regionName, regionName: where.regionName, spot, yaw: unit(n, stage, area, k, 3) * 2 * Math.PI,
      site: brassSiteId(px, py, stage, k), hSite: heart ? brassSiteId(px, py, stage, k, 'h') : null,
    });
  }
  return out;
}
// BAY-OWN: a Bay scan's pixel by MapsFile's id, the Bay's own rows (systems/gate/gateSite.js gateScanner)
const bayPixel = (/** @type {number} */ id) => [id % W, Math.floor(id / W)];
/**
 * A BAY REGION'S FISSURES (drawFissures over the Bay's gate scan, MAPS.BSA's rows): the region is its own area, so its
 * keys, rolls, pixels and sites are what they were before W14.
 * @param {number} n @param {number} stage @param {number} region @param {any} scan @param {any} [paths] @returns {Fissure[]}
 */
export function regionFissures(n, stage, region, scan, paths = null) {
  return drawFissures(n, stage, region, scan?.byRegion?.get(region), bayPixel, (id) => scan.towns?.[scan.townAt?.[id]] ?? null,
    { region, theatre: BAY_THEATRE, regionName: areaName(region) }, paths);
}
/**
 * W14 (TAMRIEL-WIDE): AN AREA'S FISSURES PAST THE BAY - drawFissures over its theatre's scan (systems/gate/theatreGateSite.js:
 * the registry's places, a pixel by the world's key), a province's district its area as a Bay region is its own. Its region
 * is its province's (formats/mapsTables.js regionOfTheatre), its name the province's. None in a theatre that stands no
 * site-bound world event (net/wire.js SITE_EVENT_LANES: Cyrodiil's open zone, as the Starfall's coven nights).
 * @param {number} n @param {number} stage @param {number} area @param {any} scan @param {any} [paths] @returns {Fissure[]}
 */
export function areaFissures(n, stage, area, scan, paths = null) {
  const t = scan?.theatre;
  if (!(t > BAY_THEATRE) || !siteEventLaneOpen(t) || isBayArea(area)) return [];
  const townOf = (/** @type {number} */ key) => { const i = scan.townOf?.get(key); return i == null ? null : scan.towns?.[i] ?? null; };
  return drawFissures(n, stage, area, scan.byArea?.get(area), worldPixelOfKey, townOf, { region: regionOfTheatre(t), theatre: t, regionName: areaName(area) }, paths);
}
/** W14: a theatre's fissures past the Bay for a season's stage, its areas ascending - those `ready(area)` says whose
 *  roads are known (scenes/seasonHost.js). Pure over the scan and the roads. */
export function theatreFissures(/** @type {number} */ n, /** @type {number} */ stage, /** @type {any} */ scan, /** @type {any} */ paths = null, ready = (/** @type {number} */ area) => area >= 0) {
  /** @type {Fissure[]} */ const out = [];
  for (const area of [...(scan?.byArea?.keys?.() ?? [])].sort((a, b) => a - b)) if (ready(area)) out.push(...areaFissures(n, stage, area, scan, paths));
  return out;
}
/** W14: the box of world pixels an area's pixels lie in, `[x0, y0, x1, y1)` - a heart keeps within GATE_SPOT_SPREAD_M of
 *  its pixel's middle, so the roads it keeps off are its own pixel's. Null for none. */
export function areaBox(/** @type {any} */ scan, /** @type {number} */ area) {
  const keys = scan?.byArea?.get(area);
  if (!keys?.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of keys) { const [x, y] = worldPixelOfKey(k); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  return [x0, y0, x1, y1];
}
/** Every Bay region's fissures for a season's stage, region by region in the scan's order (`paths` the roads they keep
 *  off). Pure over the scan and the roads. */
export function stageFissures(/** @type {number} */ n, /** @type {number} */ stage, /** @type {any} */ scan, /** @type {any} */ paths = null) {
  /** @type {Fissure[]} */ const out = [];
  for (const region of scan?.byRegion?.keys?.() ?? []) out.push(...regionFissures(n, stage, region, scan, paths));
  return out;
}
/** Whether a fissure stands beside its theatre's gate of the day (`gate` its `{ px, py }`, or null) - it gives way to it. */
export const fissureUnderGate = (/** @type {Fissure} */ f, /** @type {any} */ gate) => !!gate && !apart(f, gate.px, gate.py, FISSURE_GATE_PX + 1);
/** The camp a fissure stands, by its stage: its constructs, and for a Heart Fissure its escort (the Colossus is its own). */
export const fissureRoster = (/** @type {Fissure} */ f) => (f.heart ? HEART_ESCORT : FISSURE_ROSTER[f.stage] ?? FISSURE_ROSTER[0]);
