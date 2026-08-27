// R2 — THE BAKE. Pins for systems/roadBake.js.
//
// Two properties carry this file. The envelope must REFUSE anything it
// does not fully recognise, because a subtly wrong road network is
// worse than an absent one - the map would draw roads to nowhere and
// R4 would route travel over them with nothing throwing. And the
// polyline tracer must walk every edge EXACTLY once, because the
// segments list is not cached and this is the only thing that answers
// the drawing question.

import { test } from 'node:test';
import assert from 'node:assert';

import {
  ROADS_V, checksumBytes, serializeRoads, deserializeRoads,
  tracePolylines, traceNetwork, bakeRoads, loadOrBakeRoads,
} from '../src/systems/roadBake.js';
import {
  createNetwork, linkPixels, DIRS, ROAD_TRUNK, ROAD_TRACK, hasRoad,
} from '../src/systems/roads.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

// ── fixtures ─────────────────────────────────────────────────────

/** A cross with a spur: one junction of degree 4 plus a dead end. */
function crossNetwork() {
  const n = createNetwork(11, 11);
  for (let x = 2; x < 8; x++) linkPixels(n.trunkExits, 11, x, 5, x + 1, 5);
  for (let y = 2; y < 8; y++) linkPixels(n.trunkExits, 11, 5, y, 5, y + 1);
  for (let y = 5; y < 8; y++) linkPixels(n.trackExits, 11, 8, y, 8, y + 1);
  return n;
}

function province(size = 60) {
  const W = size, H = size;
  const hb = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - W / 2, y - H / 2);
      hb[y * W + x] = Math.max(0, Math.min(255, Math.round(35 + 140 * Math.exp(-(d * d) / 70))));
    }
  }
  return {
    heightBytes: hb, width: W, height: H,
    climateAt: () => CLIMATES.Woodlands,
    isWater: (_c, b) => b <= 3,
    locations: [
      { x: 5, y: 5, locationType: LOCATION_TYPES.TownCity },
      { x: W - 6, y: 5, locationType: LOCATION_TYPES.TownCity },
      { x: W - 6, y: H - 6, locationType: LOCATION_TYPES.TownCity },
      { x: 5, y: H - 6, locationType: LOCATION_TYPES.TownHamlet },
      { x: W >> 1, y: 4, locationType: LOCATION_TYPES.TownHamlet },
      { x: 12, y: 26, locationType: LOCATION_TYPES.TownVillage },
      { x: 40, y: 40, locationType: LOCATION_TYPES.HomeFarms },
      { x: 14, y: 42, locationType: LOCATION_TYPES.ReligionTemple },
    ],
  };
}

// ── the envelope ─────────────────────────────────────────────────

test('a serialized network round-trips to the same bytes', () => {
  const n = crossNetwork();
  const round = deserializeRoads(serializeRoads(n));
  assert.ok(round);
  assert.equal(round.width, n.width);
  assert.equal(round.height, n.height);
  assert.deepEqual([...round.trunkExits], [...n.trunkExits]);
  assert.deepEqual([...round.trackExits], [...n.trackExits]);
});

test('segments are deliberately NOT restored - the tracer answers instead', () => {
  const n = crossNetwork();
  n.segments.push({ kind: ROAD_TRUNK, points: [{ x: 0, y: 0 }] });
  const round = deserializeRoads(serializeRoads(n));
  assert.deepEqual(round.segments, []);
  assert.ok(traceNetwork(round).trunk.length > 0, 'but the lines are still recoverable');
});

test('the envelope refuses every shape it does not fully recognise', () => {
  const good = serializeRoads(crossNetwork());
  assert.ok(deserializeRoads(good), 'the good one must load or the rest proves nothing');

  assert.equal(deserializeRoads(null), null);
  assert.equal(deserializeRoads(new Uint8Array(4)), null, 'too short');

  const badMagic = Uint8Array.from(good); badMagic[0] ^= 0xff;
  assert.equal(deserializeRoads(badMagic), null, 'wrong magic');

  const badVersion = Uint8Array.from(good);
  new DataView(badVersion.buffer).setUint16(4, ROADS_V + 1, true);
  assert.equal(deserializeRoads(badVersion), null, 'a future version must WIPE, not misread');

  assert.equal(deserializeRoads(good.subarray(0, good.length - 10)), null, 'a torn write');

  // the one that matters most: intact length, intact header, one
  // flipped payload byte. Without the checksum this loads and quietly
  // draws a road that is not there.
  const corrupt = Uint8Array.from(good);
  corrupt[corrupt.length - 30] ^= 0x08;
  assert.equal(deserializeRoads(corrupt), null, 'a silently corrupted payload');
});

test('the checksum covers the payload and cannot cover itself', () => {
  const good = serializeRoads(crossNetwork());
  const reserved = Uint8Array.from(good);
  new DataView(reserved.buffer).setUint16(18, 0xbeef, true);
  assert.ok(deserializeRoads(reserved), 'the checksum should not cover reserved header space');

  // Offsets computed from the REAL length: an out-of-range index on a
  // typed array is SILENTLY DROPPED in JS, so a hardcoded offset past
  // the end of a small fixture flips nothing and the assertion passes
  // by writing into the void.
  const first = 20, mid = (20 + good.length) >> 1, last = good.length - 1;
  for (const at of [first, mid, last]) {
    assert.ok(at < good.length, 'the fixture must actually reach this byte');
    const bad = Uint8Array.from(good);
    bad[at] ^= 0x01;
    assert.equal(deserializeRoads(bad), null, `flipped payload byte ${at} was accepted`);
  }
});

test('checksumBytes distinguishes, honours its range, and is ORDER-SENSITIVE', () => {
  const a = Uint8Array.from([1, 2, 3, 4, 5]);
  assert.notEqual(checksumBytes(a), checksumBytes(Uint8Array.from([1, 2, 3, 4, 6])));
  assert.equal(checksumBytes(a), checksumBytes(Uint8Array.from(a)));
  assert.notEqual(checksumBytes(a, 0, 5), checksumBytes(a, 1, 5), 'the range must be honoured');
  // Strip FNV's prime and the hash collapses to a plain XOR of every
  // byte, which still catches any SINGLE flipped byte - so a fixture
  // that only ever flips one byte cannot see the difference. A torn or
  // interleaved write reorders blocks, so the mixing step has to be
  // pinned by a permutation.
  assert.notEqual(checksumBytes(a), checksumBytes(Uint8Array.from([1, 2, 4, 3, 5])),
    'a permutation must change the checksum - this is what the prime buys');
  assert.notEqual(checksumBytes(a), checksumBytes(Uint8Array.from([1, 1, 3, 4, 5])));
});

// ── the tracer ───────────────────────────────────────────────────

function edgeCount(exits, width, height) {
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bits = exits[y * width + x];
      for (let d = 0; d < 8; d++) if (bits & DIRS[d].bit) n++;
    }
  }
  assert.equal(n % 2, 0, 'an odd half-edge means the plane is not symmetric');
  return n / 2;
}

function tracedEdges(lines) {
  const seen = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      seen.push((a.y * 10000 + a.x) < (b.y * 10000 + b.x)
        ? `${a.x},${a.y}|${b.x},${b.y}` : `${b.x},${b.y}|${a.x},${a.y}`);
    }
  }
  return seen;
}

test('the tracer walks every edge EXACTLY once', () => {
  // Both halves matter. A lost edge drops road off the map; a doubled
  // one double-draws, which on a translucent line layer is visible.
  const n = crossNetwork();
  for (const [plane, exits] of [['trunk', n.trunkExits], ['track', n.trackExits]]) {
    const lines = tracePolylines(exits, n.width, n.height);
    const edges = tracedEdges(lines);
    assert.equal(edges.length, new Set(edges).size, `${plane}: an edge was walked twice`);
    assert.equal(new Set(edges).size, edgeCount(exits, n.width, n.height), `${plane}: edges lost`);
  }
});

test('a crossroads becomes lines that MEET, not one line doubling back', () => {
  const n = crossNetwork();
  const lines = tracePolylines(n.trunkExits, n.width, n.height);
  assert.equal(lines.length, 4, `expected four arms, got ${lines.length}`);
  assert.equal(lines.filter((l) => l.some((p) => p.x === 5 && p.y === 5)).length, 4,
    'every arm should reach the junction');
  for (const l of lines) assert.ok(l.length >= 2);
});

test('every traced step is a single move', () => {
  const n = crossNetwork();
  const { trunk, track } = traceNetwork(n);
  for (const line of [...trunk, ...track]) {
    for (let i = 1; i < line.length; i++) {
      const dx = Math.abs(line[i].x - line[i - 1].x);
      const dy = Math.abs(line[i].y - line[i - 1].y);
      assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0, 'traced a step that is not one move');
    }
  }
});

test('a closed ring still gets traced - it has no junction to start at', () => {
  // The first sweep anchors on degree != 2 and a ring has no such
  // pixel, so without the second sweep a ring road is simply invisible.
  const n = createNetwork(9, 9);
  const ring = [[3, 3], [4, 3], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [3, 4]];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    linkPixels(n.trunkExits, 9, a[0], a[1], b[0], b[1]);
  }
  const lines = tracePolylines(n.trunkExits, 9, 9);
  assert.equal(lines.length, 1, 'a ring is one line');
  assert.equal(tracedEdges(lines).length, 8, 'all eight edges walked');
  assert.deepEqual(lines[0][0], lines[0][lines[0].length - 1], 'and it closes');
});

test('an empty plane traces to nothing rather than throwing', () => {
  assert.deepEqual(tracePolylines(new Uint8Array(25), 5, 5), []);
});

test('the tracer is deterministic', () => {
  const n = crossNetwork();
  assert.deepEqual(tracePolylines(n.trunkExits, n.width, n.height),
    tracePolylines(n.trunkExits, n.width, n.height));
});

// ── the bake, end to end ─────────────────────────────────────────

test('bakeRoads wires the field and the builder over injected readers', () => {
  const p = province();
  const { network, stats } = bakeRoads(p);
  assert.ok(stats.trunkLaid >= 4);
  assert.equal(stats.orphans, 0);
  for (const l of p.locations) assert.ok(hasRoad(network, l.x, l.y));
});

test('a baked network survives the cache and traces to the same lines', () => {
  // The end-to-end property the whole slice exists for: what comes
  // back off disk must draw exactly what was generated.
  const { network } = bakeRoads(province());
  const restored = deserializeRoads(serializeRoads(network));
  assert.deepEqual(traceNetwork(restored), traceNetwork(network));
  const lines = traceNetwork(network);
  assert.ok(lines.trunk.length > 0 && lines.track.length > 0);
});

test('loadOrBakeRoads takes the cache when it is good and rebakes when it is not', () => {
  const p = province();
  let bakes = 0;
  const bake = () => { bakes++; return bakeRoads(p); };

  const cold = loadOrBakeRoads(null, bake);
  assert.equal(bakes, 1);
  assert.equal(cold.fromCache, false);
  assert.ok(cold.bytes, 'a cold load must hand back bytes to store');
  assert.ok(cold.stats, 'and the stats it built');

  const warm = loadOrBakeRoads(cold.bytes, bake);
  assert.equal(bakes, 1, 'a good cache must not rebake');
  assert.equal(warm.fromCache, true);
  assert.equal(warm.bytes, null, 'and has nothing new to store');
  assert.deepEqual([...warm.network.trunkExits], [...cold.network.trunkExits]);

  const torn = Uint8Array.from(cold.bytes);
  torn[torn.length - 5] ^= 0x02;
  assert.equal(loadOrBakeRoads(torn, bake).fromCache, false, 'a corrupt cache must rebake');
  assert.equal(bakes, 2);
});

test('the bake reports progress through every phase', () => {
  const phases = new Set();
  let last = null;
  bakeRoads({
    ...province(),
    onProgress: ({ phase, done, total }) => {
      phases.add(phase);
      assert.ok(done >= 0 && done <= total, `${phase}: ${done}/${total}`);
      last = phase;
    },
  });
  for (const want of ['candidates', 'trunk', 'spurs']) {
    assert.ok(phases.has(want), `never reported ${want}`);
  }
  assert.equal(last, 'spurs', 'spurs are the last phase and the longest');
});

test('ROAD_TRUNK and ROAD_TRACK re-export as roads.js means them', () => {
  assert.notEqual(ROAD_TRUNK, ROAD_TRACK);
  const n = crossNetwork();
  assert.ok(n.trunkExits.some((v) => v !== 0));
  assert.ok(n.trackExits.some((v) => v !== 0));
});
