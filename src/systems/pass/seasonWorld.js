// @ts-check
// STOREFRONT (2026-10-29, the brief: "world changes with new dwemer enemies/boss/weapon"; bible/06-Systems/Battle-Pass.md
// section 6): THE SEASON IN THE WORLD, ITS LAW - the same on every machine from the shared clock and the map files. The
// tremor: the first seconds of each hour of an open stage. The fissures: a few a Bay region each stage, on the gate's
// suitable pixels (systems/gate/gateSite.js gateScanner), drawn by hash, apart; the third stage's first its Heart
// Fissure; one beside the day's gate gives way. Their camps stand on the camp law's brass sites (wodShared.js
// brassSiteId) - no relay change. Pure. Not a DFU member. Ledger A (STOREFRONT).
import { passSeasonAt, passStageAt, PASS_SEASONS } from '../../net/battlePassLaw.js';
import { gateHash, PIXEL_M, GATE_SPOT_SPREAD_M } from '../../net/gate/gateLaw.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { brassSiteId } from '../../world/worldOfDaggerfall/wodShared.js';

const W = 1000;
/** The season's own salt on the gate's hash. */
export const SEASON_SALT = 0x5ea50;
/** The tremor: once an hour on the shared clock, the ground shaking this long, its force by the stage (the camera's kick,
 *  systems/betterAmbience.js weaponKick - a gun's shot is 3, a star landing beside you 4). */
export const TREMOR_EVERY_MS = 3_600_000;
export const TREMOR_MS = 6000;
export const TREMOR_KICK = Object.freeze([1.5, 2.5, 4]);
/** How many fissures stand in each region, by the stage. */
export const FISSURES_BY_STAGE = Object.freeze([2, 3, 3]);
/** The stage whose first fissure in each region is its Heart Fissure. */
export const HEART_STAGE = 2;
/** How far apart a region's fissures stand, map pixels (Chebyshev) - about three km - and how many draws each is given. */
export const FISSURE_APART_PX = 4;
export const FISSURE_DRAWS = 24;
/** A fissure keeps this far off the day's gate, map pixels (Chebyshev): the gate's pixel and its neighbours. */
export const FISSURE_GATE_PX = 1;

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

/** A fissure's roll `j` - the gate's hash under the season's salt. */
export const fissureRoll = (/** @type {number} */ n, /** @type {number} */ stage, /** @type {number} */ region, /** @type {number} */ k, /** @type {number} */ j) => gateHash(SEASON_SALT, n, stage, region, k, j);
const unit = (n, stage, region, k, j) => fissureRoll(n, stage, region, k, j) / 4294967296;
/** A fissure's heart inside its pixel, metres from its south-west corner ([east, north]) - the gate's frame and spread. */
export function fissureSpotLocal(n, stage, region, k) {
  const a = unit(n, stage, region, k, 1) * 2 * Math.PI, r = Math.sqrt(unit(n, stage, region, k, 2)) * GATE_SPOT_SPREAD_M;
  return [PIXEL_M / 2 + Math.cos(a) * r, PIXEL_M / 2 + Math.sin(a) * r];
}

/**
 * @typedef {{ key: string, n: number, stage: number, region: number, k: number, heart: boolean, px: number, py: number,
 *   town: any, near: string, regionName: string, spot: number[], yaw: number, site: string, hSite: string|null }} Fissure
 */
const apart = (a, px, py, d) => Math.max(Math.abs(a.px - px), Math.abs(a.py - py)) >= d;
/**
 * A REGION'S FISSURES for season `n`'s stage `stage`: up to FISSURES_BY_STAGE[stage], each `{ key, n, stage, region, k,
 * heart, px, py, town, near, regionName, spot, yaw, site, hSite }` - `site` its constructs' camp, `hSite` its Colossus's
 * (the Heart Fissure's alone). Drawn from the gate's scan's pixels for the region; a region too small gives fewer.
 * @param {number} n @param {number} stage @param {number} region @param {any} scan
 * @returns {Fissure[]}
 */
export function regionFissures(n, stage, region, scan) {
  const pixels = scan?.byRegion?.get(region);
  if (!pixels?.length) return [];
  /** @type {Fissure[]} */ const out = [];
  for (let k = 0; k < (FISSURES_BY_STAGE[stage] ?? 0); k++) {
    let pick = -1;
    for (let d = 0; d < FISSURE_DRAWS && pick < 0; d++) {
      const id = pixels[fissureRoll(n, stage, region, k, 100 + d) % pixels.length];
      if (out.every((f) => apart(f, id % W, Math.floor(id / W), FISSURE_APART_PX))) pick = id;
    }
    if (pick < 0) continue;
    const px = pick % W, py = Math.floor(pick / W), heart = stage === HEART_STAGE && k === 0;
    const town = scan.towns?.[scan.townAt?.[pick]] ?? null, regionName = REGION_NAMES[region] ?? '';
    out.push({
      key: `${n}.${stage}.${region}.${k}`, n, stage, region, k, heart, px, py, town, near: town?.name || regionName, regionName,
      spot: fissureSpotLocal(n, stage, region, k), yaw: unit(n, stage, region, k, 3) * 2 * Math.PI,
      site: brassSiteId(px, py, stage, k), hSite: heart ? brassSiteId(px, py, stage, k, 'h') : null,
    });
  }
  return out;
}
/** Every region's fissures for a season's stage, region by region in the scan's order. Pure over the scan. */
export function stageFissures(/** @type {number} */ n, /** @type {number} */ stage, /** @type {any} */ scan) {
  /** @type {Fissure[]} */ const out = [];
  for (const region of scan?.byRegion?.keys?.() ?? []) out.push(...regionFissures(n, stage, region, scan));
  return out;
}
/** Whether a fissure stands beside the day's gate (`gate` its `{ px, py }`, or null) - it gives way to it. */
export const fissureUnderGate = (/** @type {Fissure} */ f, /** @type {any} */ gate) => !!gate && !apart(f, gate.px, gate.py, FISSURE_GATE_PX + 1);
/** The camp a fissure stands, by its stage: its constructs, and for a Heart Fissure its escort (the Colossus is its own). */
export const fissureRoster = (/** @type {Fissure} */ f) => (f.heart ? HEART_ESCORT : FISSURE_ROSTER[f.stage] ?? FISSURE_ROSTER[0]);
