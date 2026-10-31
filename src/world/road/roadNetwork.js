// ROADS 1: THE NETWORK IS OURS.
//
// Mac, 2026-09-01: "recreate it using it as a resource and avoiding the
// legal stuff altogether... be as faithful as possible without crossing
// the line." The resource is Hazelnut's Basic Roads (MIT code; hand-
// authored path data of unstated license). THE LINE: its DESIGN is free
// to learn from and is credited here as prior art; its DATA - which
// pixels carry a road and where each leaves - is authored work and none
// of it enters this port. Every byte this module emits is derived from
// the player's own MAPS.BSA and WOODS.WLD at runtime.
//
// WHAT IS KEPT FROM THE DESIGN, because it is what makes roads work:
//   - one byte per map pixel on the 1000x500 world, an 8-direction
//     compass mask of the edges a path leaves through (N=128 clockwise
//     to NW=1). A rose is the natural encoding and this layout means
//     any tool speaking it reads ours; the LAYOUT is not the data.
//   - two grades: ROADS join the settlements that matter, TRACKS reach
//     the rest. The painter draws them differently.
//   - a path is a chain of neighbouring pixels; the mask on each end of
//     a step is the direction of the other, so junctions are free.
//
// WHAT IS OURS: the graph and the routes. Settlements come from the map
// table; the graph is nearest-neighbour edges plus a spanning tree so
// every road-grade town is reachable; each edge is routed across the
// pixel grid by A* over the small heightmap, refusing water and paying
// for climb, so roads follow valleys the way a road-builder would. It
// will be straighter and worse-judged than a hand-drawn network at
// first. That is iteration on our own thing, and the cost function is
// the dial.
//
// PURE. No archive access here: the caller hands in the settlements and
// two samplers, which is what makes this pinnable on a synthetic map in
// a container with no game data.

import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../formats/woodsFile.js';

// The world's size comes from the one place that owns it.
export { MAP_WIDTH as MAP_W, MAP_HEIGHT as MAP_H };

/** The compass mask. Map Y runs SOUTH (mapsFile: y = 499 - lat/128), so
 *  N is (x, y-1). Kept as one table with its deltas so the encoder and
 *  the painter cannot disagree about which bit is which. */
export const DIR = Object.freeze({
  N: 128, NE: 64, E: 32, SE: 16, S: 8, SW: 4, W: 2, NW: 1,
});
export const DIR_DELTA = Object.freeze([
  [DIR.N, 0, -1], [DIR.NE, 1, -1], [DIR.E, 1, 0], [DIR.SE, 1, 1],
  [DIR.S, 0, 1], [DIR.SW, -1, 1], [DIR.W, -1, 0], [DIR.NW, -1, -1],
]);
const OPPOSITE = Object.freeze({
  [DIR.N]: DIR.S, [DIR.NE]: DIR.SW, [DIR.E]: DIR.W, [DIR.SE]: DIR.NW,
  [DIR.S]: DIR.N, [DIR.SW]: DIR.NE, [DIR.W]: DIR.E, [DIR.NW]: DIR.SE,
});

/** Which settlements get which grade. Cities and hamlets are the
 *  ROAD-grade nodes - Daggerfall's walled cities and its market towns.
 *  Villages, farms, taverns and temples are TRACK-grade: they hang off
 *  the road network by a dirt track to the nearest road node. Dungeons,
 *  graveyards, covens, cults and the player's ship get nothing, which
 *  is a choice: a road to a labyrinth tells the player where it is. */
export const ROAD_TYPES = Object.freeze(new Set([
  LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet,
]));
export const TRACK_TYPES = Object.freeze(new Set([
  LOCATION_TYPES.TownVillage, LOCATION_TYPES.Tavern, LOCATION_TYPES.ReligionTemple,
  LOCATION_TYPES.HomeWealthy, LOCATION_TYPES.ReligionCult, LOCATION_TYPES.Coven,
]));
// ROADS 16: THE SET IS THE ANSWER KEY'S, measured on the real map. Share
// of each class within one pixel of a Basic Roads TRACK: villages 84%,
// taverns 76%, wealthy homes 74%, covens 71%, temples 67%, cults 63% -
// all well above the ~47% a random location gets from the web's density
// alone. Farms sit AT that baseline (47%): incidental, not tracked, and
// Audit 45 F1's exclusion stands. Dungeons sit BELOW it (24-29%):
// avoided. HomeWealthy was wrongly excluded by F1 and is back.
// AUDIT ROADS F1: HomeFarms and HomeWealthy were track-grade in the
// first draft. Farms are the single most numerous location type on the
// map - thousands of them - and a dirt track to every one blankets the
// countryside and costs a thousand A* runs at boot. A farm sits in the
// fields it works; the track stops at the village. Wealthy homes are
// estates off the road, likewise. Both are deliberately NOT here and
// this comment is the reason, so the next reader does not "complete"
// the set.

/** THE DIALS. All of them, in one place, because "the roads climb that
 *  mountain" is a cost-function complaint and the answer should be one
 *  number away. */
export const ROAD_DIALS = Object.freeze({
  neighbours: 2,          // ROADS 16: 3 made junctions at 14% of road pixels; his are 4.4%. 2 gives 9%
  roadReach: 70,          // max pixel distance for a road edge
  trackLink: 24,          // ROADS 21: a track node links to neighbours this close (his tracks average 14 px a run)
  trackNeighbours: 2,     // ROADS 21: how many
  trackReach: 20,         // ROADS 15/16: his track ends sit within 9 px of a road at the 95th percentile,
                          // but his tracks average 14 px and web together; 14 gave stubs, 20 gives 23k px to his 30k
  climbCost: 80,          // ROADS 16: his roads follow the ground harder than 40 made ours
  descentCost: 10,        // downhill is cheaper but not free (percent)
  highCost: 0.08,         // per unit of height above `highAbove`, per step
  highAbove: 40,          // small-heightmap value where terrain starts to cost
  roadDiscount: 0.5,      // stepping onto an existing road costs half - roads merge
  mergeNear: 3,           // ROADS 17: a road reaching an existing road this close to its town joins it
  joinAngle: 3,           // ROADS 18: compass points a new road must sit from a town's existing ones - 3 (135 degrees); 2 gave 9.9% right angles, his 1.7
  turnCost: 0.4,          // ROADS 16: squared per 45 degrees (ROADS 14); 0.7 held bends at 18%, his are 30%
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * @param {object} p
 * @param {Array<{x:number,y:number,type:number}>} p.locations - map pixels.
 * @param {(x:number,y:number)=>number} p.heightAt - small heightmap value.
 * @param {(x:number,y:number)=>boolean} p.isWater - impassable.
 * @param {object} [p.dials]
 * @param {?((node: {x:number,y:number}) => boolean)} [p.owns] - TESA14 (world/tamrielRoads.js): a region's own nodes. A road
 *   edge is routed when the first of its ends (north first, then west) is one, a spanning-tree edge no neighbours' edge
 *   when either end is, a track link when its first end is, a track's spur when its node is - so two regions that see
 *   the same nodes route each edge once. Null: every node, the Bay's build.
 * @param {?Array<{x:number,y:number}>} [p.obstacles] - TESA14: pixels no route may cross, as a location that is no node
 *   (a capital's own pixels).
 * @param {?{ step: Function, d: { shoreCost: number, widenAbove: number } }} [p.terrain] - VOYAGER1: the land's law every
 *   route pays (world/road/roadLand.js landForRoutes' answer: its `step`, landStep, and its dials) in place of the
 *   climb, descent and height dials; null, those dials (OWN-WORK2: the Bay's build takes the land's law too). Its own
 *   module, so this builder - which the account Worker bundles - carries none of it.
 * @param {?Array<Array<{x:number,y:number}>>} [p.trunks] - VOYAGER-CYRODIIL (world/road/cyrodiilRoads.js): the named roads'
 *   legs, each [a, b] - routed as roads after the towns' road edges, each whole to its end (taking the towns' roads at the
 *   road discount where they run its way), before the tracks; a leg whose first end is the region's (`owns`); a leg with
 *   no way by land is unrouted as any pair.
 * @returns {{ roads: Uint8Array, tracks: Uint8Array, stats: object }}
 */
export function buildRoadNetwork(p) {
  return drainSteps(roadNetworkSteps(p));
}

/**
 * AUDIT TESA II R8: THE BUILD A ROUTE AT A TIME - buildRoadNetwork's own body, a generator that yields after the land's
 * components and after each route it runs, and returns what buildRoadNetwork answers. A caller with no worker to spare
 * (world/tamrielRoadsClient.js, a region built on the page's thread) steps it a frame's budget at a time; every other
 * caller drains it whole, so the network is the one law's to the byte. Its parameters are buildRoadNetwork's.
 * @param {Parameters<typeof buildRoadNetwork>[0]} p
 * @returns {Generator<void, ReturnType<typeof buildRoadNetwork>, void>}
 */
export function* roadNetworkSteps({ locations, heightAt, isWater, dials = {}, owns = null, obstacles = null, terrain = null, trunks = null }) {
  const d = { ...ROAD_DIALS, ...dials };
  const roads = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  const tracks = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);

  const roadNodes = locations.filter((l) => ROAD_TYPES.has(l.type) && inMap(l));
  const trackNodes = locations.filter((l) => TRACK_TYPES.has(l.type) && inMap(l));

  // ROADS 6: A SETTLEMENT'S PIXEL IS NEVER A STEP ON THE WAY SOMEWHERE
  // ELSE. The hand-drawn network rings the towns it passes - measured on
  // it: five-neighbour ARCS around a location are everywhere (890) and
  // full loops essentially never (none of eight) - and a through-road
  // that cut across a village's pixel would paint through its fields.
  // So every location, of every type, is blocked as an INTERMEDIATE;
  // a route may still start or end on one. A* then arcs around a town
  // by itself, and a town on the line between two others gets the arc
  // plus its own two spurs, which IS the ring.
  // ROADS 18 CORRECTS ROADS 6, on the real map. His roads go THROUGH the
  // towns: 92% of his 1,610 city and hamlet pixels carry road bits -
  // 55% two bits (half of those straight through), 29% junctions AT the
  // town - and only 122 are empty. The 890 "arcs" ROADS 6 measured were
  // around empty pixels that were not towns at all; his map holds three
  // ringed towns in total. So a ROAD-GRADE town is a waypoint a route
  // may pass through and junction at. Everything else - villages,
  // dungeons, farms, temples - stays blocked: villages sit at the
  // baseline for roads (39% within a pixel, chance) and dungeons below
  // it (avoided).
  const occupied = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  for (const l of locations) if (inMap(l) && !ROAD_TYPES.has(l.type)) occupied[l.y * MAP_WIDTH + l.x] = 1;
  for (const o of obstacles ?? []) if (inMap(o)) occupied[o.y * MAP_WIDTH + o.x] = 1;   // TESA14
  // TESA14: whose edges these are - every one, unless a region says which nodes are its own
  const owned = (n) => !owns || owns(n);
  const firstOf = (a, b) => (a.y < b.y || (a.y === b.y && a.x <= b.x) ? a : b);

  // AUDIT 52 (was 49) A1: AN ISLAND IS NOT A ROUTE THAT FAILED, IT IS A ROUTE
  // THAT WAS NEVER THERE. On the real map 44 pairs were unrouted, all
  // but one with water between them, and each paid all three A* boxes
  // - the 120-pixel one at eight headings - before giving up: 3.5 of
  // the build's 7.3 seconds spent proving the sea is wet. Land is
  // flood-filled once into components (4-connected, the conservative
  // match for a router that will not cut a water corner), and a pair on
  // different components is named unrouted without a search.
  const component = landComponents(isWater);
  yield;   // AUDIT TESA II R8: a step
  const sameLand = (a, b) => component[a.y * MAP_WIDTH + a.x] === component[b.y * MAP_WIDTH + b.x];
  const towns = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  for (const l of roadNodes) towns[l.y * MAP_WIDTH + l.x] = 1;

  // THE ROAD GRAPH: k-nearest within reach, then a spanning tree over
  // ALL road nodes so nothing is stranded - the tree may add long
  // edges, and that is the point; a town with no road is a bug.
  const edges = new Map();   // "i,j" i<j -> [i,j]
  const addEdge = (i, j) => { if (i !== j) edges.set(i < j ? `${i},${j}` : `${j},${i}`, i < j ? [i, j] : [j, i]); };
  const roadNear = nearestWithin(roadNodes, d.roadReach, d.neighbours), near = new Set();
  for (let i = 0; i < roadNodes.length; i++) {
    for (const o of roadNear[i]) {
      near.add(i < o.j ? `${i},${o.j}` : `${o.j},${i}`);
      if (owned(firstOf(roadNodes[i], roadNodes[o.j]))) addEdge(i, o.j);
    }
  }
  // TESA14: a region's thousands of towns are millions of pairs to sort - its tree is Prim's, the Bay's Kruskal's as ever.
  // A tree edge that is a neighbours' edge is the first end's, as above; a longer one (a bridge between two webs) either
  // end's, so no region strands a town for want of the other's view - the one pair two regions may both route.
  // OWN-WORK2: the Bay's tree is one a land - an edge across the sea strands the towns its own land would have joined
  for (const [i, j] of (owns ? primEdges(roadNodes) : kruskal(roadNodes, sameLand))) {
    if (!near.has(i < j ? `${i},${j}` : `${j},${i}`) && (owned(roadNodes[i]) || owned(roadNodes[j]))) addEdge(i, j);
  }

  // ROUTE the road edges, shortest first, so later routes find and
  // merge into earlier ones through the discount.
  const routed = [...edges.values()].sort((a, b) => dist(roadNodes[a[0]], roadNodes[a[1]]) - dist(roadNodes[b[0]], roadNodes[b[1]]));
  // AUDIT 45 F7: `unrouted` is a LIST of the pairs that found no path,
  // each end as {x, y, region}, so the boot log can say WHICH town has
  // no road rather than how many do. `stats.unrouted` stays a count for
  // the log line; `stats.unroutedPairs` carries the names.
  const stats = { roadNodes: roadNodes.length, trackNodes: trackNodes.length, roadEdges: routed.length, trackEdges: 0, unrouted: 0, unroutedPairs: [], islands: 0, trackLinks: 0 };
  if (trunks) { stats.trunkLegs = 0; stats.trunkPath = []; }   // VOYAGER-CYRODIIL: the named roads' pixels, x then y (the map's, the tools'); the Bay's stats as they were
  const miss = (a, b) => { stats.unrouted++; stats.unroutedPairs.push([{ x: a.x, y: a.y, region: a.region, name: a.name ?? null }, { x: b.x, y: b.y, region: b.region, name: b.name ?? null }]); };
  for (const [i, j] of routed) {
    if (!sameLand(roadNodes[i], roadNodes[j])) { stats.islands++; miss(roadNodes[i], roadNodes[j]); continue; }
    const path = route(roadNodes[i], roadNodes[j], { heightAt, isWater, existing: roads, d, blocked: occupied, mergeNear: d.mergeNear, towns, terrain });
    if (path) stamp(roads, path); else miss(roadNodes[i], roadNodes[j]);
    yield;   // AUDIT TESA II R8: a step
  }
  // VOYAGER-CYRODIIL: THE NAMED ROADS AFTER THE TOWNS' ROADS, each leg whole to its end (no merge short of it): a leg takes
  // the towns' roads at half price where they run its way, so a named road threads the towns on its course as a road
  // between cities does, where laid first it cut a ruler-straight line across a plain and the towns' roads merged into it
  for (const [a, b] of trunks ?? []) {
    if (!inMap(a) || !inMap(b) || !owned(firstOf(a, b))) continue;
    if (!sameLand(a, b)) { stats.islands++; miss(a, b); continue; }
    const path = route(a, b, { heightAt, isWater, existing: roads, d, blocked: occupied, towns, terrain });
    if (path) { stamp(roads, path); stats.trunkLegs++; for (const p of path) stats.trunkPath.push(p.x, p.y); } else miss(a, b);
    yield;   // AUDIT TESA II R8: a step
  }

  // TRACKS: each track node to its nearest road NODE within reach (not
  // the nearest road pixel - a track that joins mid-road is fine, but
  // aiming at a town keeps tracks reading as "the way to town").
  // AUDIT ROADS F6: a track stops on ANY path, road or track, and gets
  // the merge discount on both - two villages a mile apart share the
  // last mile instead of wearing parallel ruts. `paths` is the union,
  // kept in step as each track lands.
  const paths = new Uint8Array(roads);
  // ROADS 21: THE TRACKS ARE A WEB, NOT A FIELD OF STUBS. Measured on
  // his map: 84% of villages sit ON a track, his tracks average 14 px
  // per dead-end and junction at 6.9%, ours were 3.6 px stubs at 29%
  // dead-ends. His tracks pass THROUGH the places they serve, chaining
  // village to village to road. So: a track may cross a track-grade
  // pixel (a road may not), and each track node also links to its
  // nearest track neighbours within reach, routed shortest-first so the
  // web grows outward from the roads and every later link lands on an
  // earlier one.
  const trackBlocked = new Uint8Array(occupied);
  for (const t of trackNodes) trackBlocked[t.y * MAP_WIDTH + t.x] = 0;
  // ROADS 21: the web's "towns" for the wide-join rule are its nodes -
  // a village is entered wide or not at all, as a town is (ROADS 18).
  const trackTowns = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  for (const t of trackNodes) trackTowns[t.y * MAP_WIDTH + t.x] = 1;
  const links = [];
  const trackNear = nearestWithin(trackNodes, d.trackLink, d.trackNeighbours);
  for (let i = 0; i < trackNodes.length; i++) {
    for (const o of trackNear[i]) if (owned(firstOf(trackNodes[i], trackNodes[o.j]))) links.push([Math.min(i, o.j), Math.max(i, o.j), o.dd]);
  }
  const seen = new Set();
  links.sort((a, b) => a[2] - b[2]);
  for (const [i, j] of links) {
    const key = i * trackNodes.length + j; if (seen.has(key)) continue; seen.add(key);
    // A link commits to B's side: it may end on any path that is closer
    // to B than to A, never on A's own track at step one.
    const A = trackNodes[i], B = trackNodes[j];
    // ...and only where the join is WIDE (ROADS 18's rule, for tracks):
    // arriving with heading h, the bit stamped on the existing pixel is
    // the way back, and every bit already there must sit joinAngle
    // compass points from it. A sharp join is walked past.
    const path = route(A, B, { heightAt, isWater, existing: paths, d, stopOn: paths, blocked: trackBlocked, towns: trackTowns, terrain,
      stopIf: (x, y, h) => Math.hypot(x - B.x, y - B.y) < Math.hypot(x - A.x, y - A.y)
        && wideEnough(paths[y * MAP_WIDTH + x], DIR_DELTA[(h + 4) % 8][0], d) });
    if (path) { stamp(tracks, path); stamp(paths, path); stats.trackLinks++; }
    yield;   // AUDIT TESA II R8: a step
  }
  for (const t of trackNodes) {
    if (!owned(t)) continue;   // TESA14: another region's
    // ROADS 15: A TRACK JOINS THE ROAD WHERE THE ROAD PASSES, not at the
    // next town. Measured on the hand-drawn network, a track dead-end
    // sits within 9 pixels of a road at the 95th percentile - his spurs
    // are short because they meet the road wherever it is. The first
    // draft aimed every track at the nearest road NODE and called it
    // "the way to town"; it was the way to a town thirty pixels off
    // when the road ran eight pixels away. The target is the nearest
    // path pixel within reach; the route stops the moment it touches
    // any path, so the join lands wherever the terrain says.
    const best = nearestPath(paths, t, d.trackReach);
    if (!best) continue;
    if (paths[t.y * MAP_WIDTH + t.x]) continue;   // ROADS 21: already on the web
    const path = route(t, best, { heightAt, isWater, existing: paths, d, stopOn: paths, blocked: trackBlocked, towns: trackTowns, terrain });
    if (path) { stamp(tracks, path); stamp(paths, path); stats.trackEdges++; } else miss(t, { ...best, region: t.region, name: null });
    yield;   // AUDIT TESA II R8: a step
  }
  return { roads, tracks, stats };
}

/** ROADS 17/18: may a new bit join an existing mask without a hairpin
 *  or a right angle? A bit already present is fine (riding the road);
 *  otherwise every existing bit must be at least three compass points
 *  away. His towns: 55% two bits, 29% three - junctions, but wide ones. */
function wideEnough(have, bit, d) {
  if (!have || (have & bit)) return true;
  const bi = DIR_DELTA.findIndex(([b]) => b === bit);
  for (let j = 0; j < 8; j++) {
    if (!(have & DIR_DELTA[j][0])) continue;
    const dd = Math.abs(j - bi); if (Math.min(dd, 8 - dd) < d.joinAngle) return false;
  }
  return true;
}

/** AUDIT 52 (was 49) A1: label every land pixel with its 4-connected component.
 *  One pass over the map; water is 0, land gets 1, 2, 3... */
export function landComponents(isWater) {
  const comp = new Int32Array(MAP_WIDTH * MAP_HEIGHT);
  const stack = new Int32Array(MAP_WIDTH * MAP_HEIGHT);
  let next = 0;
  for (let start = 0; start < comp.length; start++) {
    if (comp[start] || isWater(start % MAP_WIDTH, (start / MAP_WIDTH) | 0)) continue;
    next++; let sp = 0; stack[sp++] = start; comp[start] = next;
    while (sp) {
      const i = stack[--sp]; const x = i % MAP_WIDTH, y = (i / MAP_WIDTH) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
        const j = ny * MAP_WIDTH + nx;
        if (comp[j] || isWater(nx, ny)) continue;
        comp[j] = next; stack[sp++] = j;
      }
    }
  }
  return comp;
}

/** The nearest set pixel of a mask within `reach` of (x, y), or null. */
function nearestPath(mask, at, reach) {
  let best = null; let bd = Infinity;
  const x0 = Math.max(0, at.x - reach), x1 = Math.min(MAP_WIDTH - 1, at.x + reach);
  const y0 = Math.max(0, at.y - reach), y1 = Math.min(MAP_HEIGHT - 1, at.y + reach);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!mask[y * MAP_WIDTH + x]) continue;
    const dd = Math.hypot(x - at.x, y - at.y);
    if (dd <= reach && dd < bd) { bd = dd; best = { x, y }; }
  }
  return best;
}

/** AUDIT TESA II R8: a step generator run to its end - its answer. */
export function drainSteps(it) {
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

function inMap(l) { return l.x >= 0 && l.x < MAP_WIDTH && l.y >= 0 && l.y < MAP_HEIGHT; }

/**
 * TESA14: each node's `k` nearest others within `reach`, nearest first, ties in the nodes' own order - the very lists the
 * brute force answered (every pair's distance, the ones in reach, a stable sort) - over a grid of cells `reach` wide, each
 * node asking the nine about it: a region's ten thousand villages were a hundred million pairs.
 * @param {Array<{x:number,y:number}>} nodes @param {number} reach @param {number} k
 * @returns {Array<Array<{ j: number, dd: number }>>}
 */
export function nearestWithin(nodes, reach, k) {
  const cell = Math.max(1, Math.ceil(reach));
  const grid = new Map();
  nodes.forEach((n, j) => {
    const key = `${Math.floor(n.x / cell)},${Math.floor(n.y / cell)}`;
    let list = grid.get(key);
    if (!list) grid.set(key, (list = []));
    list.push(j);
  });
  return nodes.map((a, i) => {
    const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell), out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (j === i) continue;
          const dd = dist(a, nodes[j]);
          if (dd <= reach) out.push({ j, dd });
        }
      }
    }
    return out.sort((p, q) => p.dd - q.dd || p.j - q.j).slice(0, k);
  });
}

/** TESA14: a minimum spanning tree over the nodes by Prim's walk from the first - O(n^2) time and O(n) room, no list of
 *  pairs to sort. Of equal edges it takes the one the walk meets first. */
export function primEdges(nodes) {
  const n = nodes.length;
  if (n < 2) return [];
  const inTree = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), out = [];
  let cur = 0;
  inTree[0] = 1;
  for (let step = 1; step < n; step++) {
    let next = -1, bd = Infinity;
    for (let j = 0; j < n; j++) {
      if (inTree[j]) continue;
      const dd = dist(nodes[cur], nodes[j]);
      if (dd < best[j]) { best[j] = dd; from[j] = cur; }
      if (best[j] < bd) { bd = best[j]; next = j; }
    }
    inTree[next] = 1;
    out.push([from[next], next]);
    cur = next;
  }
  return out;
}

/** Kruskal over the complete graph of road nodes - O(n^2 log n) edges,
 *  fine for the few hundred towns Daggerfall has. OWN-WORK2: a pair
 *  `together` refuses (two lands) is no edge - a tree for each land. */
function kruskal(nodes, together = () => true) {
  const all = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (together(nodes[i], nodes[j])) all.push([dist(nodes[i], nodes[j]), i, j]);
  all.sort((a, b) => a[0] - b[0]);
  const parent = nodes.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const out = [];
  for (const [, i, j] of all) { const a = find(i), b = find(j); if (a !== b) { parent[a] = b; out.push([i, j]); } }
  return out;
}

/** Write a path's steps into a mask array: each end of a step gets the
 *  bit toward the other. */
export function stamp(mask, path) {
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k], b = path[k + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const step = DIR_DELTA.find(([, ex, ey]) => ex === dx && ey === dy);
    if (!step) throw new Error(`stamp: non-adjacent step (${a.x},${a.y})->(${b.x},${b.y})`);
    mask[a.y * MAP_WIDTH + a.x] |= step[0];
    mask[b.y * MAP_WIDTH + b.x] |= OPPOSITE[step[0]];
  }
}

/**
 * A* on the pixel grid, 8-connected. Cost: step length x (1 + climb or
 * descent x height cost), water refused, existing road half price so
 * routes converge. `stopOn` lets a track end the moment it touches the
 * road network rather than walking into town beside it. Bounded to the
 * endpoints' box plus a margin so a 500k-cell grid is never scanned.
 */
export function route(from, to, opts) {
  // A caller's dial object may predate a dial; missing ones take the
  // default rather than poisoning the cost with NaN (ROADS 5 found the
  // pins' own dials doing exactly that).
  opts = { ...opts, d: { ...ROAD_DIALS, ...(opts.d ?? {}) } };
  // THE BOX GROWS ON FAILURE. A bay or a range taller than the margin
  // walls the search in and A* reports no route, so the first answer is
  // tried in a tight box for speed and widened twice before giving up.
  // The pin puts a lake across the whole first box.
  // VOYAGER1: AND, ON THE LAND'S LAW, A DEAR ROAD ASKS THE WIDER BOX. A range's pass or a lake's end past the tight box
  // is never seen while a costly climb over the ridge inside it answers, so a road that costs more than `widenAbove`
  // times its straight length is searched again in the next box, and the cheaper of the two kept. A road on easy ground
  // never pays it, nor does a track (`stopOn`: a village's way may climb - in the mountains its searches were most of a
  // region's build); the Bay's law answers its first box's route as ever.
  let best = null;
  for (const margin of [12, 40, 120]) {
    const cost = { g: 0 };
    const p = routeInBox(from, to, opts, margin, cost);
    if (p && (!best || cost.g < best.g)) best = { p, g: cost.g };
    if (best && !(opts.terrain && !opts.stopOn && best.g > opts.terrain.d.widenAbove * Math.hypot(to.x - from.x, to.y - from.y))) return best.p;
  }
  if (best) return best.p;
  // ROADS 17: a town that can be neither entered nor joined outside
  // (its only road runs off the wrong way and nothing of it lies within
  // reach) is still a town that needs its road - the through rule gives
  // way rather than stranding it.
  if (opts.mergeNear || opts.d.joinAngle) return route(from, to, { ...opts, mergeNear: 0, d: { ...opts.d, joinAngle: 0 } });
  return null;
}

/**
 * ROADS 5 (Mac, first real-data look: "the roads are extremely jagged"):
 * THE STATE IS THE CELL AND THE HEADING. Plain A* on an 8-connected grid
 * draws a 1-in-10 slope as nine E steps and one NE, over and over, and
 * the painter turns every one of those changes into a 135-degree kink
 * at a pixel centre - a staircase, which is what Mac saw. A road-builder
 * lays STRAIGHT STRETCHES and turns rarely, so each step now pays
 * turnCost per 45 degrees of heading change, and the search carries
 * the heading in its state (cell x 8) so the price is paid where the
 * turn happens. The result prefers "E for a while, then NE for a while"
 * to alternating, which is the same length and far fewer corners.
 */
function routeInBox(from, to, { heightAt, isWater, existing, d, stopOn = null, stopIf = null, blocked = null, mergeNear = 0, towns = null, terrain = null }, margin, cost = null) {
  const x0 = Math.max(0, Math.min(from.x, to.x) - margin), x1 = Math.min(MAP_WIDTH - 1, Math.max(from.x, to.x) + margin);
  const y0 = Math.max(0, Math.min(from.y, to.y) - margin), y1 = Math.min(MAP_HEIGHT - 1, Math.max(from.y, to.y) + margin);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cells = bw * bh;
  const idx = (x, y) => (y - y0) * bw + (x - x0);
  // state = cell * 8 + heading; heading 8 = "no heading yet" lives on the start alone
  const g = new Float32Array(cells * 8).fill(Infinity);
  const came = new Int32Array(cells * 8).fill(-1);
  const closed = new Uint8Array(cells * 8);
  const turnOf = (a, b) => (a < 0 ? 0 : Math.min((a - b + 8) % 8, (b - a + 8) % 8));
  // AUDIT ROADS F3: the cheapest step is a discounted one onto an
  // existing path, so the heuristic is scaled by the discount to stay
  // admissible - an overestimating h makes A* skip the merge it exists
  // to find, and the routes stop converging on shared roads.
  // VOYAGER1: and by the shore's price, the land's law's cheapest step
  const hScale = d.roadDiscount * (terrain ? Math.min(1, terrain.d.shoreCost) : 1);
  const h = (x, y) => Math.hypot(x - to.x, y - to.y) * hScale;
  const open = new MinHeap();
  const sc = idx(from.x, from.y);
  // the start has no heading: seed every heading at 0 so the first step is free to choose
  for (let k = 0; k < 8; k++) { g[sc * 8 + k] = 0; open.push(h(from.x, from.y), sc * 8 + k); }
  const goal = idx(to.x, to.y);
  let end = -1;
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cell = (cur / 8) | 0, heading = cur % 8;
    const cx = x0 + (cell % bw), cy = y0 + Math.floor(cell / bw);
    if (cell === goal || (stopOn && cell !== sc && stopOn[cy * MAP_WIDTH + cx] !== 0 && (!stopIf || stopIf(cx, cy, heading)))) { end = cur; break; }
    // ROADS 17: A TOWN IS ENTERED ONCE. Measured on the real map, every
    // hairpin in our network was a town pixel with two spurs arriving
    // from adjacent directions; his towns are entered by one road that
    // passes through. So a route that reaches an EXISTING road within
    // mergeNear pixels of its destination stops there and shares that
    // road's last stretch, instead of laying a second spur beside it.
    if (mergeNear && cell !== sc && existing[cy * MAP_WIDTH + cx] !== 0
      && Math.hypot(cx - to.x, cy - to.y) <= mergeNear) { end = cur; break; }
    const hc = heightAt(cx, cy);
    const atStart = cell === sc;
    for (let k = 0; k < 8; k++) {
      const [, dx, dy] = DIR_DELTA[k];
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const ni = idx(nx, ny) * 8 + k;
      if (closed[ni] || isWater(nx, ny)) continue;
      // ROADS 17: THE THROUGH-ROAD RULE. Once a town has a road, a later
      // road may enter it only from the direction that CONTINUES that
      // road - the town's one existing bit must be the very direction
      // we are heading, so the town ends up with opposite bits, a road
      // passing through. Seventy percent of his town pixels are that.
      // From any other direction the route cannot enter and must end
      // on the existing road outside the town (the mergeNear stop), so
      // the junction sits outside the walls rather than in them.
      // The bit this step would put on the goal points back at us; on
      // the start it points the way we go. Either must sit at least 135
      // degrees from every bit already there: straight through and a
      // wide T pass, a hairpin or a right angle into town does not.
      // ROADS 18: AT EVERY TOWN THE ROUTE TOUCHES, not only its two ends.
      // A route riding one road and passing THROUGH a town onto another
      // stamps that town's bits like any step, and a first draft checked
      // only the goal and the start - the through-route put a right
      // angle on the crossroads town in the fixture and on 20 of 266 on
      // the real map. Entering a town: the bit it would get must sit
      // wide of what it has. Leaving one: likewise for the bit we take.
      if (d.joinAngle && towns) {
        if (towns[ny * MAP_WIDTH + nx] && !wideEnough(existing[ny * MAP_WIDTH + nx], OPPOSITE[DIR_DELTA[k][0]], d)) continue;
        if (towns[cy * MAP_WIDTH + cx] && !wideEnough(existing[cy * MAP_WIDTH + cx], DIR_DELTA[k][0], d)) continue;
      }
      // ROADS 6: an occupied pixel is passable only as the destination
      const isBlockedAt = (bx, by) => (blocked && blocked[by * MAP_WIDTH + bx]) || isWater(bx, by);
      if (blocked && blocked[ny * MAP_WIDTH + nx] && idx(nx, ny) !== goal) continue;
      // ROADS 6: NO CORNER CUTTING. A diagonal step passes between two
      // pixels; if either is a town or water the road cannot squeeze
      // through the gap. This is what makes a through-road ARC around a
      // town - the hand-drawn five-neighbour shape - instead of kissing
      // its corner in one diagonal, and it keeps a road off a coast's
      // diagonal seams.
      if (dx && dy && (isBlockedAt(cx + dx, cy) || isBlockedAt(cx, cy + dy))) continue;
      let cost = (dx && dy) ? Math.SQRT2 : 1;
      if (terrain) cost = terrain.step(terrain, cx, cy, nx, ny, cost);   // VOYAGER1: the land's law (world/road/roadLand.js landStep) - OWN-WORK2: on the Bay too
      else {
        const hn = heightAt(nx, ny);
        const rise = hn - hc;
        cost *= 1 + (rise > 0 ? rise * d.climbCost : -rise * d.descentCost) * 0.01;
        if (hn > d.highAbove) cost *= 1 + (hn - d.highAbove) * d.highCost;
      }
      if (existing[ny * MAP_WIDTH + nx]) cost *= d.roadDiscount;
      // ROADS 14 (calibrated against the hand-drawn network): A ROAD
      // TURNS ONE COMPASS POINT AT A TIME. Of 6,076 bends in Basic
      // Roads' road data, 5,975 are 45-degree heading changes, 101 are
      // right angles (1.7%), and none double back; tracks are the same
      // shape. A linear turn cost prices a right angle at exactly two
      // 45s, which is why ours took them; squaring the step count makes
      // a right angle four 45s and a hairpin nine, and A* lays two
      // single-point bends instead - the hand's own habit.
      if (!atStart) { const t = turnOf(heading, k); cost += t * t * d.turnCost; }
      const ng = g[cur] + cost;
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push(ng + h(nx, ny), ni); }
    }
  }
  if (end < 0) return null;
  if (cost) cost.g = g[end];   // VOYAGER1: what it cost, for route()'s wider box
  const path = [];
  for (let c = end; c >= 0; c = came[c]) {
    const cell = (c / 8) | 0;
    const pt = { x: x0 + (cell % bw), y: y0 + Math.floor(cell / bw) };
    if (!path.length || path[path.length - 1].x !== pt.x || path[path.length - 1].y !== pt.y) path.push(pt);
  }
  return path.reverse();
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v; const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
}
