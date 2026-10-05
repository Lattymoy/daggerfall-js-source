// LW3 (bible/06-Systems/Living-World.md): A SYNTHETIC MAP for the roads' pins - towns on a grid of map pixels (the
// MAPS row's own columns: mapId, px, py, blocks, people, region, type, port), the planner's way between two as the
// straight run of pixels between them, and the census's own traveller rosters. No game data.
import { travellerRoster, mintResident } from '../src/systems/livingWorld/census.js';
import { townTrips, placeCycle, handsOn, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { placeAt, turnKey } from '../src/systems/livingWorld/lives.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { rollGroupComposition } from '../src/systems/campEncounters.js';
import { chooseRandomEnemy } from '../src/systems/encounters.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

/** Towns every `step` pixels on a `n` x `n` grid from (x0, y0); each town's blocks off its place - LW6: and, `dives`,
 *  a dungeon in each square of four for the adventurers to dive; LW5b: and, `sea`, the first row's towns ports, a
 *  chain of lanes along it and a far haven a lane away (beyond TRIP_REACH_PX of any town), each lane its length in
 *  metres (a map pixel 819.2 m). */
export function synthMap({ x0 = 100, y0 = 100, n = 9, step = 5, dives = false, sea = false } = {}) {
  const towns = [];
  let id = 1000;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * step, y = y0 + j * step;
    towns.push({ mapId: id++, px: x, py: y, blocks: 4 + ((x * 7 + y * 3) % 30), region: 17, people: 3, type: 0, name: `T${x}_${y}`, port: false });
  }
  const rosters = new Map();
  let asked = 0;
  const world = {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      asked++;
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
  };
  // LW6: a dungeon between each four towns (the grid's cell centres), each its type
  const dungeons = [];
  let did = 5000;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const x = x0 + i * step + Math.floor(step / 2), y = y0 + j * step + Math.floor(step / 2);
    dungeons.push({ mapId: did++, px: x, py: y, blocks: 1, name: `D${x}_${y}`, dungeon: true, dungeonType: (i + j) % 17 });
  }
  if (dives) world.dungeonsNear = (px, py, r) => dungeons.filter((d) => Math.max(Math.abs(d.px - px), Math.abs(d.py - py)) <= r).sort((a, b) => a.mapId - b.mapId);
  /** @type {{ key: string, a: any, b: any, len: number }[]} */
  const lanes = [];
  if (sea) {
    const row = towns.filter((t) => t.py === y0).sort((a, b) => a.px - b.px);
    for (const t of row) t.port = true;
    const haven = { mapId: 9000, px: x0 - 25, py: y0, blocks: 24, region: 17, people: 3, type: 0, name: 'FarHaven', port: true };
    towns.push(haven);
    const lane = (a, b) => lanes.push({ key: `${Math.min(a.mapId, b.mapId)}-${Math.max(a.mapId, b.mapId)}`, a, b, len: Math.hypot(a.px - b.px, a.py - b.py) * 819.2 * 1.15 });
    for (let i = 1; i < row.length; i++) lane(row[i - 1], row[i]);
    lane(haven, row[0]);
    world.lanesFrom = (t) => (!t.port ? [] : lanes.filter((l) => l.a === t || l.b === t).map((l) => ({ to: l.a === t ? l.b : l.a, len: l.len, key: l.key })));
  }
  return { towns, world, dungeons, lanes, asked: () => asked };
}

// LW4: the map with the lives and the trouble on it, as the host composes them (world.js) - for the trouble's pins and
// the live fight's.
/** The synthetic map with the lives and the trouble on it, as the host composes them (world.js). */
export function livingMap({ turns = null, climate = 230, dives = false, sea = false } = {}) {
  const m = synthMap({ dives, sea });
  const { towns, world } = m;
  const byId = new Map(towns.map((t) => [t.mapId, t]));
  const book = new Map();
  const placeOf = (res, k) => {
    const key = turnKey(res, k);
    let g = book.get(key);
    if (!g) {
      const pl = placeAt(res, k, turns);
      g = { holder: pl.vacant ? null : pl.holder == null ? res : mintResident(byId.get(res.town), 't', res.slot, res.job, { gen: pl.holder }), dies: !pl.vacant && pl.dies, diced: !pl.vacant && pl.diced, hand: pl.hand };
      book.set(key, g);
    }
    return g;
  };
  const trouble = {
    climateAt: () => climate,
    foesOf: ({ climateIndex, dungeonType, minute, level, size, rolls }) => (dungeonType != null
      ? Array.from({ length: size }, () => chooseRandomEnemy({ dungeonType, playerLevel: level }, rolls)).filter((x) => x >= 0)
      : rollGroupComposition({ climateIndex, skyMinutes: minute, inLocationRect: false, playerLevel: level, size }, rolls)?.mobileTypes ?? null),
    foeLevel: (type, level) => (type >= 128 ? level : ENEMY_BASICS[type]?.level ?? level),
    dies: (res, trip) => { const roster = world.rosterOf(byId.get(res.town)); const place = roster.find((r) => r.slot === res.slot) ?? res; const g = placeOf(place, placeCycle(place, roster, Math.floor(trip.outT0 / DAY_MIN), 1)); return g.dies && g.hand == null; },   // LW7: a hand's dead the trouble never takes
    diced: (res, trip) => { const roster = world.rosterOf(byId.get(res.town)); const place = roster.find((r) => r.slot === res.slot) ?? res; return placeOf(place, placeCycle(place, roster, Math.floor(trip.outT0 / DAY_MIN), 1)).diced; },   // AUDIT-B1: the trouble's shape the dice's
    turnOf: (id) => (turns?.won?.has(id) ? 'won' : turns?.lost?.has(id) ? 'lost' : null),
  };
  world.holderOf = (res, k) => placeOf(res, k).holder;
  world.fated = (res, k) => placeOf(res, k).diced;   // AUDIT-B1: a fated trip the dice's
  // LW7: a trip's hand deaths, gone from their minute (the member's place at the trip's cycle)
  const handOf = (m, trip) => { const roster = world.rosterOf(byId.get(m.town)); const place = roster.find((r) => r.slot === m.slot) ?? m; return placeOf(place, placeCycle(place, roster, Math.floor(trip.outT0 / DAY_MIN), 1)).hand; };
  world.fate = (trip) => handsOn(troubledTrip(trip, troubleOf(trip, trouble)), (m) => handOf(m, trip));
  return { ...m, byId, placeOf, trouble };
}

/** Every party of every town over a run of days, each once, troubled as the host troubles them. */
export function partiesOver(map, d0, d1, o = { mpm: CALENDAR_MPM, memo: new Map() }) {
  const seen = new Map();
  for (let day = d0; day < d1; day++) for (const town of map.towns) for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o)) seen.set(tr.id, tr);
  return [...seen.values()];
}
