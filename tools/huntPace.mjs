#!/usr/bin/env node
// AUDIT HORIZONTAL F3 (HUNTERS-MARK, bible/06-Systems/Bounty-Boards.md 12.1): THE CLEARS AN HONEST HUNTER CAN MAKE IN A UTC
// DAY, MEASURED. The ceiling read "four held a game day", but four held is not four cleared: a hunter clears, rides to the
// next city's board and takes four more. This walks the game's own map - the 410 cities whose blocks place a bounty board,
// each day's four notices where the board posts them - at the fastest legal gallop with no time spent fighting, the next
// board ridden to or reached by carriage: a bound no hunter beats. huntLaw.js HUNT_CLEARS_DAY_MAX is set from its best
// day; test/tooling/huntpace.test.js pins the walk on a drawn map and on the game's. It writes nothing to the tree.
//
//   ARENA2_PATH=/path/to/arena2 node tools/huntPace.mjs [--json]
import { readFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import {
  BOUNTIES_PER_DAY,
  BOUNTY_ACTIVE_MAX,
  bountySites,
  bountyDungeons,
  boardPostings,
  MINUTES_PER_DAY,
} from '../src/systems/bounty/bountyBoard.js';
import { ONLINE_MINUTES_PER_MS, sharedClassicMinutes } from '../src/net/wire.js';
import { PIXEL_M } from '../src/net/gate/gateLaw.js';
import { runSpeed } from '../src/player/motor.js';
import { DF_RIDE_BASE } from '../src/systems/transport.js';
import { steedSpeedScale } from '../src/systems/steedCare.js';

/** THE FASTEST LEGAL RIDE (m/s): the motor's run on the ride base (GetRunSpeed's riding arm) at live Speed's cap and
 *  Running at its top with every buff (siegeRef.js SIEGE_SPEED's terms: 185), on the swiftest horse (steedCare.js, Speed
 *  100), with Fleetfoot III's tenth (egFair.js) - more than any hunter rides. */
export const HUNT_PACE_MPS = runSpeed(100, 185, false, DF_RIDE_BASE) * steedSpeedScale(100, { paceFloor: false }) * 1.1;
/** A pack stands 60 m out at the nearest (bountyHost.js): the ride to it, the least a clear adds past its pixel. */
export const HUNT_PACE_PACK_M = 60;
/** The boards weighed for the next ride: the nearest this many (a farther one never pays better - its ride alone is
 *  longer than a near one's ride and tour). */
const NEAREST = 24;
/** Real seconds a game day lasts online. */
const GAME_DAY_S = MINUTES_PER_DAY / ONLINE_MINUTES_PER_MS / 1000;

/** The metres from a point (map pixels, fractional) to the nearest point of pixel `[x, y]`'s square, and that point. */
export function toPixel(/** @type {[number, number]} */ at, /** @type {number} */ x, /** @type {number} */ y) {
  const nx = Math.max(x, Math.min(x + 1, at[0])),
    ny = Math.max(y, Math.min(y + 1, at[1]));
  return { m: Math.hypot(nx - at[0], ny - at[1]) * PIXEL_M, at: /** @type {[number, number]} */ ([nx, ny]) };
}
/** Every order of n targets, n up to four (a board with no open ground posts fewer). */
const PERMS = [0, 1, 2, 3, 4].map((n) => {
  const out = /** @type {number[][]} */ ([]);
  const walk = (/** @type {number[]} */ pre, /** @type {number[]} */ rest) => {
    if (!rest.length) out.push(pre);
    for (const r of rest)
      walk(
        [...pre, r],
        rest.filter((x) => x !== r),
      );
  };
  walk([], [...Array(n).keys()]);
  return out;
});
/** A board's tour: from `at`, every target in the shortest of their orders - `{ s, at, legs }` (seconds, the end, each
 *  clear's time from the start). */
export function tourOf(
  /** @type {[number, number]} */ at,
  /** @type {Array<[number, number]>} */ targets,
  /** @type {number} */ mps,
) {
  let best = null;
  for (const p of PERMS[targets.length]) {
    let pos = at,
      s = 0;
    const legs = [];
    for (const i of p) {
      const r = toPixel(pos, targets[i][0], targets[i][1]);
      s += (r.m + HUNT_PACE_PACK_M) / mps;
      pos = r.at;
      legs.push(s);
    }
    if (!best || s < best.s) best = { s, at: pos, legs };
  }
  return best ?? { s: 0, at, legs: [] };
}

/** The cities' tours from their own boards a game day, the cheapest a clear first: `[{ i, s, n }]` (kept a day). */
function toursOf(
  /** @type {Parameters<typeof huntDay>[0]} */ cities,
  /** @type {number} */ mps,
  /** @type {Map<number, any[]>} */ memo,
  /** @type {number} */ day,
) {
  if (!memo.has(day)) {
    memo.set(
      day,
      cities
        .map((c, i) => {
          const list = c.targets(day).slice(0, BOUNTY_ACTIVE_MAX);
          return { i, n: list.length, s: tourOf([c.px + 0.5, c.py + 0.5], list, mps).s };
        })
        .filter((x) => x.n > 0)
        .sort((a, b) => a.s / a.n - b.s / b.n),
    );
  }
  return /** @type {any[]} */ (memo.get(day));
}

/**
 * ONE HUNTER'S UTC DAY from `start` (a city's index): at each board the day's notices not yet taken there this game day
 * (at most four held), every one cleared in its shortest order, then the next board that pays best a clear - a near
 * one ridden to, or (`carriageS` not null) any city's, by the carriage at the nearest city's gate (Immersive Travel's
 * driver at every walled city; online a fast travel, `carriageS` its real seconds). Returns the clears made in `dayS`.
 * @param {Array<{ px: number, py: number, targets: (day: number) => Array<[number, number]> }>} cities
 * @param {{ start: number, mps?: number, dayS?: number, day0?: number, phaseS?: number, carriageS?: number|null, memo?: Map<number, any[]> }} o
 */
export function huntDay(
  cities,
  { start, mps = HUNT_PACE_MPS, dayS = 86_400, day0 = 0, phaseS = 0, carriageS = 0, memo = new Map() },
) {
  let t = 0,
    clears = 0,
    at = /** @type {[number, number]} */ ([cities[start].px + 0.5, cities[start].py + 0.5]),
    here = start;
  const taken = new Map(); // city -> the game day its notices were taken
  const dayAt = (/** @type {number} */ s) => day0 + Math.floor((s + phaseS) / GAME_DAY_S);
  for (let guard = 0; guard < 100_000; guard++) {
    const day = dayAt(t);
    if (taken.get(here) !== day) {
      const list = cities[here].targets(day).slice(0, BOUNTY_ACTIVE_MAX);
      const tour = tourOf(at, list, mps);
      for (const leg of tour.legs) if (t + leg <= dayS) clears++;
      t += tour.s;
      at = tour.at;
      taken.set(here, day);
      if (t >= dayS) break;
    }
    // the next board: the ride there and its own tour, a clear's share of them, the least
    let next = -1,
      cost = Infinity;
    const near = cities
      .map((c, i) => [Math.hypot(c.px + 0.5 - at[0], c.py + 0.5 - at[1]), i])
      .sort((a, b) => a[0] - b[0])
      .slice(0, NEAREST);
    for (const [, i] of near) {
      const ride = toPixel(at, cities[i].px, cities[i].py);
      const arrive = t + ride.m / mps;
      if (taken.get(i) === dayAt(arrive)) continue;
      const list = cities[i].targets(dayAt(arrive)).slice(0, BOUNTY_ACTIVE_MAX);
      if (!list.length) continue;
      const c = (ride.m / mps + tourOf(ride.at, list, mps).s) / list.length;
      if (c < cost) {
        cost = c;
        next = i;
      }
    }
    // or the carriage: the nearest city's gate, then the cheapest tour of the day not taken yet, anywhere
    let via = null;
    if (carriageS != null) {
      const gate = near.length ? toPixel(at, cities[near[0][1]].px, cities[near[0][1]].py) : null;
      const arrive = gate ? t + gate.m / mps + carriageS : Infinity;
      const best = gate
        ? toursOf(cities, mps, memo, dayAt(arrive)).find((x) => taken.get(x.i) !== dayAt(arrive))
        : null;
      if (gate && best) {
        const c = (gate.m / mps + carriageS + best.s) / best.n;
        if (c < cost) {
          cost = c;
          next = best.i;
          via = gate;
        }
      }
    }
    if (next < 0) break;
    if (via) {
      t += via.m / mps + carriageS;
      at = [cities[next].px + 0.5, cities[next].py + 0.5];
      here = next;
    } else {
      const ride = toPixel(at, cities[next].px, cities[next].py);
      t += ride.m / mps;
      at = ride.at;
      here = next;
    }
    if (t >= dayS) break;
  }
  return clears;
}

/** A day from each city's board (or from `starts` alone): `{ best, median, worst, perHourBest }`. */
export function huntPace(
  /** @type {Parameters<typeof huntDay>[0]} */ cities,
  /** @type {Omit<Parameters<typeof huntDay>[1], 'start'> & { starts?: number[] }} */ o = {},
) {
  const memo = new Map(); // the tours from each board, the same for every start
  const days = (o.starts ?? cities.map((_, i) => i))
    .map((start) => huntDay(cities, { memo, ...o, start }))
    .sort((a, b) => a - b);
  const best = days[days.length - 1] ?? 0;
  return {
    best,
    median: days[Math.floor(days.length / 2)] ?? 0,
    worst: days[0] ?? 0,
    perHourBest: best / ((o.dayS ?? 86_400) / 3600),
  };
}

/** The game's cities that carry a bounty board, each with its notices' targets a game day (world.js's own ground law). */
export async function huntPaceCities(/** @type {string} */ A2) {
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { MapsFile, LOCATION_TYPES, longitudeLatitudeToMapPixel } = await import('../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { layoutLocation } = await import('../src/world/locationLayout.js');
  const { boardTally } = await import('./boardCount.mjs');
  const { gateSeaPixel } = await import('../src/systems/gate/gateSite.js');
  const { spawnsDungeon, WORLD_SALT } = await import('../src/world/spawnedDungeons.js');
  const { TV_MOUNTAIN_CLIMATE } = await import('../src/systems/travel/travelRoute.js');
  const bytes = (/** @type {string} */ n) => new Uint8Array(readFileSync(`${A2}/${n}`));
  const blocks = new BlocksFile();
  blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile();
  woods.load(bytes('WOODS.WLD'));
  const locPixels = new Set(),
    dungeonPixels = new Map(),
    towns = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.exterior?.exteriorData) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      locPixels.add(`${p.x},${p.y}`);
      const lt = loc.mapTableData.locationType;
      if (
        loc.hasDungeon &&
        lt !== LOCATION_TYPES.TownCity &&
        lt !== LOCATION_TYPES.TownHamlet &&
        lt !== LOCATION_TYPES.TownVillage
      )
        dungeonPixels.set(`${p.x},${p.y}`, String(loc.name ?? ''));
      let tally = { bounty: 0 };
      try {
        if (lt === LOCATION_TYPES.TownCity)
          tally = boardTally(layoutLocation(loc, maps, blocks, { enhanced: false, windmills: false }).blocks);
      } catch {
        /* not measured */
      }
      if (tally.bounty > 0) towns.push({ px: p.x, py: p.y });
    }
  }
  const siteOk = (/** @type {number} */ x, /** @type {number} */ y) =>
    x > 0 &&
    y > 0 &&
    x < 999 &&
    y < 499 &&
    !locPixels.has(`${x},${y}`) &&
    !spawnsDungeon(WORLD_SALT, x, y) &&
    !gateSeaPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)) &&
    maps.getClimateIndex(x, y) !== TV_MOUNTAIN_CLIMATE;
  return towns.map(({ px, py }) => {
    const sites = bountySites(px, py, siteOk);
    const dungeons = bountyDungeons(px, py, (x, y) => dungeonPixels.get(`${x},${y}`) || null);
    const memo = new Map();
    const targets = (/** @type {number} */ day) => {
      if (!memo.has(day))
        memo.set(
          day,
          boardPostings({ day, px, py, level: 20, sites, dungeons }).map(
            (p) => /** @type {[number, number]} */ ([p.target.px, p.target.py]),
          ),
        );
      return memo.get(day);
    };
    return { px, py, targets };
  });
}

if (isMain(import.meta.url)) {
  const A2 = process.env.ARENA2_PATH;
  if (!A2) {
    console.error('ARENA2_PATH is not set - sh tools/fetch-data.sh, then point it at the arena2 folder.');
    process.exit(2);
  }
  const cities = await huntPaceCities(A2);
  const nowMs = Date.UTC(2026, 9, 27); // a UTC day's start: its first game day and how far into it the day began
  const minutes = sharedClassicMinutes(nowMs);
  const day0 = Math.floor(minutes / MINUTES_PER_DAY),
    phaseS = (minutes % MINUTES_PER_DAY) / ONLINE_MINUTES_PER_MS / 1000;
  const pace = huntPace(cities, { day0, phaseS });
  const out = {
    cities: cities.length,
    noticesADay: BOUNTIES_PER_DAY,
    mps: Number(HUNT_PACE_MPS.toFixed(2)),
    ...pace,
    perHourBest: Number(pace.perHourBest.toFixed(2)),
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
  else
    console.log(
      `${out.cities} cities with a bounty board; the fastest legal ride ${out.mps} m/s, no time fighting.\nA UTC day's clears from each city's board: best ${out.best} (${out.perHourBest} an hour), median ${out.median}, worst ${out.worst}.`,
    );
}
