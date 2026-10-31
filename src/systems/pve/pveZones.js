// @ts-check
// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): THE FIXED-LEVEL ZONES. Every place in Tamriel has a level
// band set by where it stands - its ring round its area's hot spot, wider toward the Imperial City (REGION-HOTSPOT,
// CENTER-HARDEST), the 96-pixel district and what the place is - and never by who walks there. A rare district is a high-level enclave
// with a warning, a road keeps its band, a town is safe and a dungeon is a step harder. The recommendation is advice
// only: it changes no foe and bars no one. Ledger A (FIXED-PVE).
import { BAY_REGION_COUNT, REGION_NAMES } from '../../formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';
import { hotspotCandidates } from './pveHotspots.js';
import { districtOf } from '../../world/worldWide/worldGrid.js';
import { CITIES } from '../../world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../world/tamriel/tamrielFrame.js';
import { STARTS } from '../starts/starts.js';
import { placeRng } from './pveEncounter.js';
import { BUILD_KIND_KEYS, buildAt } from './pveBuilds.js';
import { combatScore } from './pveProfile.js';

/** The six fixed bands, each overlapping the next so a zone's edge is never a wall. */
export const ZONE_BANDS = Object.freeze([[1, 8], [6, 15], [12, 22], [20, 30], [28, 38], [36, 45]].map((b) => Object.freeze(b)));
const TOP = ZONE_BANDS.length - 1;

/** CENTER-HARDEST (2026-10-30, every area scales from where players spawn to the center, the hardest): each area - the Bay and the nine provinces - is lowest where a new
 *  character wakes (systems/starts/starts.js STARTS: a province's start near its capital, else the Bay's Privateer's
 *  Hold) and climbs band by band toward the Imperial City, the top. Cyrodiil is the heart: its start is the center
 *  itself, so it reads its distance against the other areas' mean reach and all of it stands high. */
export const ZONE_CENTER = 'Imperial';   // the heart's province: its capital, the Imperial City, is the center
/** BAY-OWN: Privateer's Hold's own pixel in MAPS.BSA (the Daggerfall region), where the Bay's start wakes. */
const BAY_START_PX = Object.freeze([109, 158]);
/** Each province's region (62..70, REGION_NAMES) to its key in PROVINCES. */
const PROVINCE_OF_REGION = Object.freeze({ 'High Rock': 'HighRock', Hammerfell: 'Hammerfell', Skyrim: 'Skyrim', Morrowind: 'Morrowind',
  'Sumurset Isle': 'Sumurset', Valenwood: 'Valenwood', Elsweyr: 'Elsweyr', 'Black Marsh': 'BlackMarsh', Cyrodiil: 'Imperial' });

/** The area a region belongs to: 'IliacBay' for the Bay's 62, a province's key past it, null for none. @param {number} region */
export function zoneAreaOf(region) {
  if (!Number.isInteger(region) || region < 0 || region >= REGION_NAMES.length) return null;
  return region < BAY_REGION_COUNT ? 'IliacBay' : PROVINCE_OF_REGION[REGION_NAMES[region]] ?? null;
}
/** A town of CITIES on the world's pixels (read each call: the picture's fit can move). */
const cityPx = (c) => (c ? pictureToBay(c.at[0], c.at[1]) : null);
/** The town each area's new characters wake near: its start's capital, or the Bay's for an area with no start of its own. */
export const ZONE_STARTS = Object.freeze(Object.fromEntries(['IliacBay', ...Object.values(PROVINCE_OF_REGION)].map((area) => {
  const start = STARTS.find((s) => s.province === area);
  return [area, start ? CITIES.find((c) => c.capital && c.province === area)?.name ?? null : "Privateer's Hold"];
})));
/** The world pixel an area starts at; null for the heart, whose start is the center. @param {string} area */
export function zoneStartPx(area) {
  if (ZONE_STARTS[area] === "Privateer's Hold") return BAY_START_PX;
  return area === 'Imperial' ? null : cityPx(CITIES.find((c) => c.name === ZONE_STARTS[area]));
}
export const zoneCenterPx = () => cityPx(CITIES.find((c) => c.capital && c.province === ZONE_CENTER));
const reachOf = (s, c) => Math.hypot(s[0] - c[0], s[1] - c[1]);
/** An area's reach: its start's distance to the center; the heart's, the mean of the others'. @param {string} area */
export function zoneReach(area) {
  const c = /** @type {number[]} */ (zoneCenterPx()), s = zoneStartPx(area);
  if (s) return reachOf(s, c);
  const all = Object.keys(ZONE_STARTS).filter((a) => a !== 'Imperial').map((a) => reachOf(/** @type {number[]} */ (zoneStartPx(a)), c));
  return all.reduce((a, b) => a + b, 0) / all.length;
}

/** How far (`px`, `py`) has come on the road from its area's start to the center: its distance from the start over
 *  that and its distance to the center - 0 at the start, 1 at the center, the back country between. The heart has no
 *  start: its distance to the center against the others' mean reach. */
export function zoneProgress(px, py, area) {
  const c = /** @type {number[]} */ (zoneCenterPx()), s = zoneStartPx(area), toC = Math.hypot(px - c[0], py - c[1]);
  if (!s) return Math.max(0, 1 - toC / zoneReach(area));
  const fromS = Math.hypot(px - s[0], py - s[1]);
  return fromS + toC > 0 ? fromS / (fromS + toC) : 0;
}
/** The base band at (`px`, `py`) in `area`: its progress cut into six even steps, the center the top. */
export const zoneBaseTier = (px, py, area) => Math.min(TOP, Math.floor(zoneProgress(px, py, area) * ZONE_BANDS.length));

/** REGION-HOTSPOT (2026-10-30 and 10-31, foes for every level in each region, around three level 45 hot spots that
 *  ring out to the low bands, leaving most land free for low levels): EACH AREA HAS THREE HOT SPOTS, each as far from the
 *  start and from the others as its land allows (the heart's first is the center). A place's rung is 1 on a hot spot
 *  and 0 at its reach: 36-45 there, a band lower each sixth out, and 1-8 everywhere outside. Toward the center the rings
 *  widen. Daggerfall Unity has no zones: it scales every foe to the player. */
export const AREA_HOTSPOTS = 3;
/** How far a hot spot's rings reach, in world pixels. */
export const HOTSPOT_REACH = 120;
export const LADDER_RUNGS = Object.freeze([1, 2, 3, 4, 5].map((k) => k / 6));
/** How much the center widens the rings: the rung r reads 1 - (1 - r)^(1 + LEAN x progress). */
export const LADDER_LEAN = 0.5;
/** A place's rung: 1 on its area's nearest hot spot, falling to 0 at its reach. @param {number} px @param {number} py @param {ReadonlyArray<readonly number[]>} hots */
export function hotspotRung(px, py, hots) {
  let best = 0;
  for (const h of hots) best = Math.max(best, 1 - Math.hypot(px - h[0], py - h[1]) / HOTSPOT_REACH);
  return best;
}
const _hots = new Map();
/** An area's hot spots: the first farthest from its start (the heart's, its center), each next farthest from the start
 *  and those before it. @param {string} area @returns {ReadonlyArray<readonly number[]>} */
export function areaHotspots(area) {
  if (_hots.has(area)) return _hots.get(area);
  const cands = hotspotCandidates(area), start = zoneStartPx(area);
  /** @type {Array<readonly number[]>} */ const out = start ? [] : [zoneCenterPx()];
  const from = start ? [start] : [];
  while (out.length < AREA_HOTSPOTS && out.length < cands.length) {
    let pick = null, far = -1;
    for (const c of cands) {
      const d = Math.min(...[...from, ...out].map((p) => Math.hypot(c[0] - p[0], c[1] - p[1])));
      if (d > far) { far = d; pick = c; }
    }
    out.push(/** @type {readonly number[]} */ (pick));
  }
  const hots = Object.freeze(out.map((h) => Object.freeze([h[0], h[1]])));
  _hots.set(area, hots);
  return hots;
}
/** The band a rung stands on at `progress` toward the center. @param {number} rung @param {number} progress */
export function ladderTier(rung, progress) {
  const r = 1 - (1 - rung) ** (1 + LADDER_LEAN * Math.max(0, Math.min(1, progress)));
  let t = 0;
  while (t < TOP && r >= LADDER_RUNGS[t]) t++;
  return t;
}

/** The base band at (`px`, `py`) in `region`: its ring round its area's hot spots (REGION-HOTSPOT), else its progress.
 *  @param {number} px @param {number} py @param {number} region */
export function zoneBase(px, py, region) {
  const area = /** @type {string} */ (zoneAreaOf(region)), hots = areaHotspots(area);
  return hots.length ? ladderTier(hotspotRung(px, py, hots), zoneProgress(px, py, area)) : zoneBaseTier(px, py, area);
}

/** SAFE-ROAD (2026-10-30, roads out of the PvP zone are safe and foes avoid them): the Imperial start wakes at the center, so Cyrodiil's roads are safe - no hostile population, and a foe
 *  keeps off them - and a new character walks out of the heart on them. Its wild is the PvP zone's and stands high. */
export const SAFE_ROAD_AREAS = Object.freeze(['Imperial']);

/** GROUP-PARTY (2026-10-30, an area above the top band for parties): the heart's inner ring - this far
 *  on the road to the Imperial City and more, on the top band - is the party zone: its groups stand whole (pveGrant.js packShare passed
 *  by), weighing a party of their level, where everywhere else a group is one player's pack. */
export const PARTY_ZONE_FROM = 0.9;

/** Of each hundred districts: the first ENCLAVE are high-level enclaves (three bands up), the next FARMING farming
 *  grounds (a dense, steady population at the band). */
export const ZONE_SHARE = Object.freeze({ enclave: 4, farming: 10 });
/** Dungeon types one band deeper still than any dungeon: the old, the undead and the great beasts. */
export const DEEP_DUNGEONS = /** @type {readonly number[]} */ (Object.freeze([DUNGEON_TYPES.VampireHaunt, DUNGEON_TYPES.DragonsDen, DUNGEON_TYPES.Laboratory,
  DUNGEON_TYPES.DesecratedTemple, DUNGEON_TYPES.GiantStronghold, DUNGEON_TYPES.VolcanicCaves]));
/** What a place can be. */
export const ZONE_PLACES = Object.freeze(['wild', 'road', 'town', 'dungeon']);

const clampTier = (t) => Math.max(0, Math.min(TOP, t));

/** The district's draw: one number in [0, 100) from its key alone. @param {number} px @param {number} py */
export function districtRoll(px, py) {
  const [cx, cy] = districtOf(px, py);
  return Math.floor(placeRng(`district|${cx}|${cy}`)() * 100);
}

/**
 * The zone at world pixel (`px`, `py`) in `region`, for a place of kind `place` (dungeon: its `dungeon` type). Every
 * machine reads the same zone: nothing here knows a player.
 * @param {{ px: number, py: number, region: number, place?: string, dungeon?: number|null }} at
 */
export function pveZoneAt({ px, py, region, place = 'wild', dungeon = null }) {
  const area = zoneAreaOf(region);
  if (area == null || !ZONE_PLACES.includes(place)) return null;
  const base = zoneBase(px, py, region);
  const roll = districtRoll(px, py);
  const enclave = place === 'wild' && roll < ZONE_SHARE.enclave;
  const farming = place === 'wild' && !enclave && roll < ZONE_SHARE.enclave + ZONE_SHARE.farming;
  let tier = base;
  if (enclave) tier = clampTier(base + 3);
  else if (place === 'town') tier = 0;
  else if (place === 'dungeon') tier = clampTier(tier + 1 + (DEEP_DUNGEONS.includes(/** @type {number} */ (dungeon)) ? 1 : 0));
  const party = area === 'Imperial' && (place === 'wild' || place === 'dungeon') && zoneProgress(px, py, area) >= PARTY_ZONE_FROM && base === TOP;
  const band = ZONE_BANDS[tier], safeRoad = place === 'road' && SAFE_ROAD_AREAS.includes(area);   // SAFE-ROAD below
  return Object.freeze({ region, name: REGION_NAMES[region], area, pastBay: region >= BAY_REGION_COUNT, place, tier, band,
    safe: place === 'town' || safeRoad, enclave, farming, party, warning: enclave || party || tier >= base + 2 });
}

/** The Combat Score a band's foes ask (advice only): the middle of the six reference builds at the band's floor. @param {readonly number[]} band */
export function recommendedScore(band) {
  const scores = BUILD_KIND_KEYS.map((k) => combatScore(buildAt(k, band[0]))).sort((a, b) => a - b);
  return scores[Math.floor(scores.length / 2)];
}
