// R1 — THE ROAD NETWORK. Pins for systems/roads.js.
//
// The module has no DFU original (classic has no roads), so these pins
// assert STRUCTURE and the laws it borrows - never the skin constants
// it chose. A pin reading `assert.equal(GRADIENT_WEIGHT, 2.8)` would
// assert my own tuning back at itself.
//
// Several fixtures below carry a note about what they must contain to
// mean anything. Those are not decoration: each records a fixture that
// could not reach the state its assertion guarded, and passed while
// the law it named was broken.

import { test } from 'node:test';
import assert from 'node:assert';

import {
  ROAD_NONE, ROAD_TRACK, ROAD_TRUNK, DIRS, oppositeDir,
  terrainStepCost, buildCostField, octile, routeRoad, pathCost,
  createNetwork, linkPixels, layPath, roadExitsAt, roadKindAt, hasRoad,
  buildRoadNetwork, roadPolylines, groundHash, ROAD_REUSE_COST,
} from '../src/systems/roads.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

// ── fixtures ─────────────────────────────────────────────────────

const flat = (w, h, byte = 40) => new Uint8Array(w * h).fill(byte);
const woodland = () => CLIMATES.Woodlands;
const noWater = () => false;

function field(w, h, { heightBytes = flat(w, h), climateAt = woodland, isWater = noWater, wander = 0 } = {}) {
  return buildCostField({ heightBytes, width: w, height: h, climateAt, isWater, wander });
}

/** A wall of high ground from the north edge down to `gapY`, one pixel
 *  wide at x = `wallX`. The only way past is south of the gap. */
function ridgeMap(w, h, wallX, gapY, peak = 200, base = 40) {
  const hb = new Uint8Array(w * h).fill(base);
  for (let y = 0; y < gapY; y++) hb[y * w + wallX] = peak;
  return hb;
}

// ── the borrowed law ─────────────────────────────────────────────

test('terrainStepCost IS the travel calculator\'s own cost numerator', () => {
  // Derived BY HAND from TravelTimeCalculator.cs's two tables, not by
  // re-running the port's expression: CLIMATE_INDICES[climate-223]
  // picks TERRAIN_MOVEMENT_MODIFIERS and the calculator charges
  // (256 - MOD + 256). Woodlands idx 5 -> 250 -> 262; Swamp idx 3 ->
  // 200 -> 312; Mountain idx 1 -> 220 -> 292; Desert idx 0 -> 240 -> 272.
  assert.equal(terrainStepCost(CLIMATES.Woodlands), 262);
  assert.equal(terrainStepCost(CLIMATES.Swamp), 312);
  assert.equal(terrainStepCost(CLIMATES.Mountain), 292);
  assert.equal(terrainStepCost(CLIMATES.Desert), 272);
  assert.equal(terrainStepCost(CLIMATES.MountainWoods), 262);
  // and the ORDERING the law implies: a road prefers exactly the
  // ground the game already calls quick to cross.
  assert.ok(terrainStepCost(CLIMATES.Woodlands) < terrainStepCost(CLIMATES.Mountain));
  assert.ok(terrainStepCost(CLIMATES.Mountain) < terrainStepCost(CLIMATES.Swamp));
});

test('terrainStepCost clamps rather than reading past the table', () => {
  assert.ok(Number.isFinite(terrainStepCost(0)));
  assert.ok(Number.isFinite(terrainStepCost(9999)));
});

// ── the cost field ───────────────────────────────────────────────

test('the water law is INJECTED, never restated in this module', () => {
  // A deliberately wrong predicate: "water" is anything above byte 100.
  // If roads.js carried its own Ocean/height test these pixels would
  // be passable and the assert would fail.
  const hb = new Uint8Array(16).fill(50);
  hb[7] = 150;
  const f = buildCostField({
    heightBytes: hb, width: 4, height: 4,
    climateAt: woodland, isWater: (_c, byte) => byte > 100,
  });
  assert.equal(f.cost[7], Infinity);
  assert.ok(Number.isFinite(f.cost[6]));
  const g = buildCostField({
    heightBytes: hb, width: 4, height: 4,
    climateAt: (x) => (x === 0 ? CLIMATES.Ocean : CLIMATES.Woodlands),
    isWater: (c) => c === CLIMATES.Ocean,
  });
  assert.equal(g.cost[0], Infinity);
  assert.ok(Number.isFinite(g.cost[1]));
});

test('buildCostField refuses to run without the water law', () => {
  assert.throws(() => buildCostField({
    heightBytes: flat(4, 4), width: 4, height: 4, climateAt: woodland,
  }), /isWater is required/);
});

test('minStep is the field\'s REAL floor, read back out of the Float32Array', () => {
  const f = field(8, 8, { wander: 0.5 });
  let lowest = Infinity;
  for (const c of f.cost) if (c < lowest) lowest = c;
  // Taking minStep from the computed double instead puts it a hair
  // ABOVE this, because the Float32Array store truncates - and h then
  // overestimates by that hair and A* stops being admissible.
  assert.equal(f.minStep, lowest);
  // ...and the jitter is CENTRED, so the cheapest ground really is
  // cheaper than its climate's nominal cost.
  assert.ok(f.minStep < terrainStepCost(CLIMATES.Woodlands),
    `centred jitter should dip below nominal: ${f.minStep}`);
  let highest = 0;
  for (const c of f.cost) if (c > highest) highest = c;
  assert.ok(highest > terrainStepCost(CLIMATES.Woodlands), 'and rise above it');
});

test('groundHash is deterministic and bounded', () => {
  assert.equal(groundHash(17, 41), groundHash(17, 41));
  assert.notEqual(groundHash(17, 41), groundHash(41, 17));
  for (let i = 0; i < 500; i++) {
    const v = groundHash(i * 7, i * 13);
    assert.ok(v >= 0 && v < 1, `hash out of range: ${v}`);
  }
});

// ── the router ───────────────────────────────────────────────────

test('octile is the exact 8-connected walk length', () => {
  assert.equal(octile(0, 0, 3, 0), 3);
  assert.equal(octile(0, 0, 0, 3), 3);
  assert.equal(octile(0, 0, 3, 3), 3 * Math.SQRT2);
  assert.equal(octile(0, 0, 5, 3), 2 + 3 * Math.SQRT2);
  assert.equal(octile(5, 3, 0, 0), octile(0, 0, 5, 3));
});

test('A* is admissible - it returns the SAME cost Dijkstra does', () => {
  // goalTest forces h = 0 (Dijkstra), so any inflation of the
  // heuristic shows up as a cheaper-looking but WRONG A* answer.
  // Equality is the pin.
  const hb = new Uint8Array(40 * 40);
  for (let i = 0; i < hb.length; i++) hb[i] = 30 + ((i * 37) % 23);
  const f = field(40, 40, { heightBytes: hb, wander: 0.2 });
  const a = routeRoad(f, { x: 2, y: 3 }, { x: 35, y: 30 }, { heightBytes: hb });
  const d = routeRoad(f, { x: 2, y: 3 }, null, {
    heightBytes: hb, goalTest: (x, y) => x === 35 && y === 30,
  });
  assert.ok(a && d);
  assert.ok(Math.abs(a.cost - d.cost) < 1e-9, `A* ${a.cost} vs Dijkstra ${d.cost}`);
});

test('the path includes both endpoints and every step is one move', () => {
  const f = field(20, 20);
  const r = routeRoad(f, { x: 1, y: 1 }, { x: 15, y: 9 }, { heightBytes: flat(20, 20) });
  assert.deepEqual(r.path[0], { x: 1, y: 1 });
  assert.deepEqual(r.path[r.path.length - 1], { x: 15, y: 9 });
  for (let i = 1; i < r.path.length; i++) {
    const dx = Math.abs(r.path[i].x - r.path[i - 1].x);
    const dy = Math.abs(r.path[i].y - r.path[i - 1].y);
    assert.ok(dx <= 1 && dy <= 1 && (dx + dy) > 0, `bad step at ${i}`);
  }
});

test('routing is symmetric - A to B costs what B to A costs', () => {
  const hb = new Uint8Array(30 * 30);
  for (let i = 0; i < hb.length; i++) hb[i] = 20 + (i % 31);
  // THE CLIMATE HAS TO VARY, AND SO DO THE ENDPOINTS. Charging the
  // destination pixel alone instead of the mean makes A->B and B->A
  // differ by exactly cost(start) - cost(end); over one climate, or
  // between two endpoints of the same climate, that cancels perfectly
  // and the fixture sees nothing.
  const climateAt = (x, y) => ((x + y) % 3 === 0 ? CLIMATES.Swamp
    : (x % 5 === 0 ? CLIMATES.Mountain : CLIMATES.Woodlands));
  const f = field(30, 30, { heightBytes: hb, climateAt });
  const A = { x: 3, y: 3 }, B = { x: 26, y: 24 };
  assert.notEqual(climateAt(A.x, A.y), climateAt(B.x, B.y),
    'the fixture only tests what it means to if the endpoints differ');
  const ab = routeRoad(f, A, B, { heightBytes: hb });
  const ba = routeRoad(f, B, A, { heightBytes: hb });
  assert.ok(Math.abs(ab.cost - ba.cost) < 1e-6, `${ab.cost} vs ${ba.cost}`);
});

test('a road refuses a ridge and takes the gap - and the gradient term is what does it', () => {
  // THE CLAIM OF THE WHOLE SLICE. One climate everywhere, so only the
  // HEIGHT differs: any avoidance is the gradient term's doing.
  const W = 60, H = 40, WALL = 30, GAP = 26;
  const hb = ridgeMap(W, H, WALL, GAP);
  const start = { x: 5, y: 8 }, goal = { x: 55, y: 8 };

  const r = routeRoad(field(W, H, { heightBytes: hb }), start, goal, { heightBytes: hb });
  assert.ok(r, 'no route found');
  assert.equal(r.path.filter((p) => p.x === WALL && p.y < GAP).length, 0,
    'the road climbed the ridge');
  assert.ok(r.path.some((p) => p.x === WALL && p.y >= GAP), 'the road did not use the gap');

  // ...and the SAME map with the gradient term switched off crosses
  // it, which is what proves the term load-bearing rather than the map
  // merely unreachable.
  const flatRoute = routeRoad(field(W, H, { heightBytes: hb }), start, goal,
    { heightBytes: hb, gradientWeight: 0 });
  assert.ok(flatRoute.path.some((p) => p.x === WALL && p.y < GAP),
    'with no gradient penalty the road should take the short way over the top');
});

test('equal-cost ties break toward the straight line, not toward an axis', () => {
  // The state this guards only exists on ground with EXACT ties, so
  // the fixture kills the jitter. With the tie-break on node index the
  // router may emit all its diagonals first and all its axis steps
  // after, bowing about ten pixels off the direct line; hugging the
  // line keeps it under eight. Measured both ways before the bound was
  // chosen.
  const W = 120, H = 120;
  const hb = flat(W, H);
  const f = field(W, H, { heightBytes: hb, wander: 0 });
  const start = { x: 5, y: 5 }, goal = { x: 110, y: 70 };
  const r = routeRoad(f, start, goal, { heightBytes: hb });
  const dx = goal.x - start.x, dy = goal.y - start.y, L = Math.hypot(dx, dy);
  let maxDev = 0;
  for (const p of r.path) {
    const d = Math.abs((p.x - start.x) * dy - (p.y - start.y) * dx) / L;
    if (d > maxDev) maxDev = d;
  }
  assert.ok(maxDev < 8, `path bowed ${maxDev.toFixed(2)} off the direct line`);
});

test('water is impassable and an unroutable pair answers null, not a throw', () => {
  const W = 20, H = 10;
  const f = field(W, H);
  for (let y = 0; y < H; y++) f.cost[y * W + 10] = Infinity;   // a full-height channel
  assert.equal(routeRoad(f, { x: 2, y: 2 }, { x: 18, y: 5 }, { heightBytes: flat(W, H) }), null);
});

test('pathCost re-prices a path under a given array and agrees with the router', () => {
  // The loop test leans on these two step laws being the SAME law.
  const hb = new Uint8Array(25 * 25);
  for (let i = 0; i < hb.length; i++) hb[i] = 25 + (i % 17);
  const f = field(25, 25, { heightBytes: hb });
  const r = routeRoad(f, { x: 1, y: 1 }, { x: 22, y: 20 }, { heightBytes: hb });
  const priced = pathCost(f.cost, f.width, r.path, hb);
  assert.ok(Math.abs(priced - r.cost) < 1e-6, `${priced} vs ${r.cost}`);
});

// ── the packed network ───────────────────────────────────────────

test('every exit has its mirror - linkPixels sets both halves', () => {
  const n = createNetwork(6, 6);
  linkPixels(n.trunkExits, 6, 2, 2, 3, 1);   // NE
  assert.equal(roadExitsAt(n, 2, 2).trunk, DIRS[1].bit, 'NE not set on the origin');
  assert.equal(roadExitsAt(n, 3, 1).trunk, DIRS[oppositeDir(1)].bit, 'SW not set on the target');
});

test('oppositeDir round-trips every direction', () => {
  for (let d = 0; d < 8; d++) {
    assert.equal(oppositeDir(oppositeDir(d)), d);
    assert.equal(DIRS[d].dx, -DIRS[oppositeDir(d)].dx);
    assert.equal(DIRS[d].dy, -DIRS[oppositeDir(d)].dy);
  }
});

test('linkPixels refuses a step that is not one move', () => {
  assert.throws(() => linkPixels(createNetwork(6, 6).trunkExits, 6, 1, 1, 4, 4), /not one step/);
});

test('roadKindAt gives trunk precedence over track, and off-map reads clean', () => {
  const n = createNetwork(5, 5);
  linkPixels(n.trackExits, 5, 1, 1, 2, 1);
  assert.equal(roadKindAt(n, 1, 1), ROAD_TRACK);
  linkPixels(n.trunkExits, 5, 1, 1, 1, 2);
  assert.equal(roadKindAt(n, 1, 1), ROAD_TRUNK);
  assert.equal(roadKindAt(n, 4, 4), ROAD_NONE);
  assert.equal(roadKindAt(n, -1, 0), ROAD_NONE);
  assert.equal(roadKindAt(n, 0, 99), ROAD_NONE);
  assert.ok(hasRoad(n, 1, 1));
  assert.ok(!hasRoad(n, 4, 4));
});

test('a laid road discounts the ground so the NEXT route merges onto it', () => {
  // Convergence is what makes a generated network read as designed.
  const W = 40, H = 40;
  const hb = flat(W, H);
  const f = field(W, H, { heightBytes: hb });
  const first = routeRoad(f, { x: 2, y: 20 }, { x: 37, y: 20 }, { heightBytes: hb });
  const n = createNetwork(W, H);
  layPath(n, f, first.path, ROAD_TRUNK);

  const second = routeRoad(f, { x: 2, y: 26 }, { x: 37, y: 14 }, { heightBytes: hb });
  const laid = new Set(first.path.map((p) => `${p.x},${p.y}`));
  const shared = second.path.filter((p) => laid.has(`${p.x},${p.y}`)).length;
  assert.ok(shared > 10, `expected the second route to join the road, shared ${shared}`);
  assert.ok(f.minStep <= ROAD_REUSE_COST, 'minStep must follow the discount or h overestimates');
});

// ── the builder ──────────────────────────────────────────────────

/** A ring of hubs around a central massif, plus spurs.
 *
 *  THE CLUSTERS ARE LOad-BEARING. Spurs this close merge onto each
 *  other's tracks, which is the only condition under which the order
 *  they are routed in changes the result - and therefore the only
 *  condition under which the byPixelId sort is observable at all.
 *  Without them the determinism pin passes with the sort deleted. */
function province() {
  const W = 70, H = 70;
  const hb = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 35, y - 35);
      hb[y * W + x] = Math.max(0, Math.min(255, Math.round(35 + 150 * Math.exp(-(d * d) / 90))));
    }
  }
  const locations = [
    { x: 6, y: 6, locationType: LOCATION_TYPES.TownCity },
    { x: 62, y: 6, locationType: LOCATION_TYPES.TownCity },
    { x: 62, y: 62, locationType: LOCATION_TYPES.TownCity },
    { x: 6, y: 62, locationType: LOCATION_TYPES.TownHamlet },
    { x: 34, y: 5, locationType: LOCATION_TYPES.TownHamlet },
    { x: 34, y: 64, locationType: LOCATION_TYPES.TownHamlet },
    { x: 18, y: 30, locationType: LOCATION_TYPES.TownVillage },
    { x: 50, y: 44, locationType: LOCATION_TYPES.HomeFarms },
    { x: 12, y: 48, locationType: LOCATION_TYPES.ReligionTemple },
    { x: 58, y: 24, locationType: LOCATION_TYPES.DungeonRuin },
    { x: 20, y: 14, locationType: LOCATION_TYPES.HomeFarms },
    { x: 22, y: 16, locationType: LOCATION_TYPES.HomeFarms },
    { x: 19, y: 17, locationType: LOCATION_TYPES.TownVillage },
    { x: 23, y: 12, locationType: LOCATION_TYPES.Tavern },
    { x: 45, y: 55, locationType: LOCATION_TYPES.HomeFarms },
    { x: 47, y: 57, locationType: LOCATION_TYPES.Graveyard },
    { x: 43, y: 58, locationType: LOCATION_TYPES.HomePoor },
  ];
  return { W, H, hb, locations };
}

function buildProvince(extra = {}) {
  const { W, H, hb, locations } = province();
  const f = field(W, H, { heightBytes: hb, wander: 0.16 });
  return { ...buildRoadNetwork({ field: f, heightBytes: hb, locations, ...extra }), W, H, hb, locations };
}

test('the builder lays a connected trunk skeleton over the hubs', () => {
  const { network, stats } = buildProvince();
  assert.equal(stats.hubs, 6);
  assert.ok(stats.trunkLaid >= 5, `a spanning tree over 6 hubs is 5 edges, got ${stats.trunkLaid}`);
  assert.equal(stats.orphans, 0);
  assert.ok(network.segments.some((s) => s.kind === ROAD_TRUNK));
});

test('every location ends up ON the network', () => {
  const { network, locations } = buildProvince();
  for (const l of locations) {
    assert.ok(hasRoad(network, l.x, l.y), `${l.x},${l.y} never joined the network`);
  }
});

test('the whole network is CONNECTED - every location can walk to every other', () => {
  // hasRoad only says a road TOUCHES the pixel. A spur laid to nowhere
  // satisfies that and connects nothing, and R4 routes over these
  // exits - an island of track would be a destination the traveller
  // can see and never reach.
  const { network, locations, W, H } = buildProvince();
  const seen = new Uint8Array(W * H);
  const start = locations[0].y * W + locations[0].x;
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const i = queue.pop();
    const x = i % W, y = (i - x) / W;
    const { trunk, track } = roadExitsAt(network, x, y);
    const bits = trunk | track;
    for (let d = 0; d < 8; d++) {
      if (!(bits & DIRS[d].bit)) continue;
      const ni = (y + DIRS[d].dy) * W + (x + DIRS[d].dx);
      if (seen[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  for (const l of locations) {
    assert.ok(seen[l.y * W + l.x],
      `${l.x},${l.y} (type ${l.locationType}) sits on a road that reaches nothing`);
  }
});

test('the finished network is exit-symmetric everywhere', () => {
  // Swept, not spot-checked: a one-sided exit is a road you can leave
  // and not enter.
  const { network, W, H } = buildProvince();
  for (const key of ['trunkExits', 'trackExits']) {
    const ex = network[key];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const bits = ex[y * W + x];
        if (!bits) continue;
        for (let d = 0; d < 8; d++) {
          if (!(bits & DIRS[d].bit)) continue;
          const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
          assert.ok(nx >= 0 && ny >= 0 && nx < W && ny < H,
            `${key} exit off the map at ${x},${y} ${DIRS[d].name}`);
          assert.ok(ex[ny * W + nx] & DIRS[oppositeDir(d)].bit,
            `${key} one-sided exit ${x},${y} ${DIRS[d].name}`);
        }
      }
    }
  }
});

test('the skeleton is a tree PLUS loops - a ring of hubs gets its ring closed', () => {
  // The pin that catches the loop test being DEAD ON ARRIVAL: compare
  // a discounted reroute's cost against the virgin direct cost and it
  // can never fire, because discounting can only lower a cost. This
  // returns 0 the moment the virgin re-pricing is dropped.
  const { stats } = buildProvince();
  assert.ok(stats.loopsLaid > 0,
    'a ring of six hubs around a massif should close at least one loop');
  assert.ok(stats.trunkLaid + stats.loopsLaid > stats.hubs - 1,
    'more trunk edges than a bare spanning tree');
});

test('the bake is reproducible and independent of input order', () => {
  const a = buildProvince();
  const b = buildProvince();
  assert.deepEqual([...a.network.trunkExits], [...b.network.trunkExits]);
  assert.deepEqual([...a.network.trackExits], [...b.network.trackExits]);

  const { W, H, hb, locations } = province();
  const f = field(W, H, { heightBytes: hb, wander: 0.16 });
  const c = buildRoadNetwork({ field: f, heightBytes: hb, locations: [...locations].reverse() });
  assert.deepEqual([...a.network.trunkExits], [...c.network.trunkExits],
    'shuffling the location list changed the roads');
  assert.deepEqual([...a.network.trackExits], [...c.network.trackExits]);
});

test('an unreachable location is counted as an orphan, not a crash', () => {
  const W = 30, H = 30;
  const hb = flat(W, H);
  const f = field(W, H, { heightBytes: hb });
  for (let y = 0; y < H; y++) f.cost[y * W + 20] = Infinity;   // a strait
  const { stats } = buildRoadNetwork({
    field: f, heightBytes: hb,
    locations: [
      { x: 3, y: 3, locationType: LOCATION_TYPES.TownCity },
      { x: 3, y: 25, locationType: LOCATION_TYPES.TownCity },
      { x: 27, y: 14, locationType: LOCATION_TYPES.HomeFarms },   // marooned
    ],
  });
  assert.equal(stats.orphans, 1);
});

test('the trunk skeleton goes AROUND the massif it rings', () => {
  const { network, hb, W } = buildProvince();
  for (const seg of network.segments) {
    if (seg.kind !== ROAD_TRUNK) continue;
    for (const p of seg.points) {
      assert.ok(hb[p.y * W + p.x] < 150,
        `a trunk road stands on the peak at ${p.x},${p.y} (byte ${hb[p.y * W + p.x]})`);
    }
  }
});

test('roadPolylines separates the classes', () => {
  const { network } = buildProvince();
  const { trunk, track } = roadPolylines(network);
  assert.ok(trunk.length > 0 && track.length > 0);
  assert.equal(trunk.length + track.length, network.segments.length);
});

test('the builder reports progress through every phase', () => {
  const phases = new Set();
  buildProvince({
    onProgress: ({ phase, done, total }) => {
      phases.add(phase);
      assert.ok(done >= 0 && done <= total, `${phase}: ${done}/${total}`);
    },
  });
  for (const want of ['candidates', 'trunk', 'spurs']) {
    assert.ok(phases.has(want), `never reported ${want}`);
  }
});
