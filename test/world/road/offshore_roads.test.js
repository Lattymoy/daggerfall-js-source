// OFFSHORE-ROADS (2026-10-29, bible/03-World/Tamriel.md OFFSHORE-MARKS): a road past the Bay keeps off a square that
// touches the sea. A byte is its square's south-east corner in DFU's kernel (SEA-SQUARE, Field-Bugs-2026-10-28b), so a
// pixel whose own byte is land but whose north or west neighbour is the sea's lies half in the water; the shore's
// discount drew roads onto exactly those pixels (27 of them more than half under water on the freeware's continent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTamrielRegion, regionLattice, regionOf, squareDry } from '../../../src/world/tamrielRoads.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

const SEA_X = 1100;   // the sea west of this column, the land from it
const heightAt = (x) => (x < SEA_X ? 0 : 30);

test('OFFSHORE-ROADS a pixel\'s square is dry only with its four corners over the beach line (mutants: the own byte alone; a corner unread)', () => {
  assert.equal(squareDry(heightAt, SEA_X + 1, 50), true);
  assert.equal(squareDry(heightAt, SEA_X, 50), false, 'its own byte land, its west corners the sea\'s');
  assert.equal(squareDry((x, y) => (y < 10 ? 0 : 30), 2000, 10), false, 'its north corners the sea\'s');
  assert.equal(squareDry((x, y) => (x === 1999 && y === 9 ? 0 : 30), 2000, 10), false, 'its north-west corner alone');
  assert.equal(squareDry((x, y) => (x === 2001 || y === 11 ? 0 : 30), 2000, 10), true, 'the pixels east and south are other squares');
});

test('OFFSHORE-ROADS the road along a coast keeps to dry squares; only its towns\' own pixels may touch the sea (mutant: the routes\' water by the byte)', () => {
  const region = regionOf(regionLattice({ x0: 1000, y0: 0, w: 1600, h: 600 }), 0, 0);
  const T = LOCATION_TYPES.TownCity;
  const nodes = [{ x: SEA_X, y: 100, type: T }, { x: SEA_X, y: 160, type: T }];
  const out = buildTamrielRegion({ region, places: [], nodes, obstacles: [], gates: [], heightAt });
  assert.equal(out.stats.unrouted, 0);
  const keys = [...out.roads.keys()];
  assert.ok(keys.length > 0, 'the towns are joined');
  const own = new Set(nodes.map((n) => `${n.x},${n.y}`));
  const wet = keys.map((k) => [k % 65536 - 32768, Math.floor(k / 65536) - 32768]).filter(([x, y]) => !own.has(`${x},${y}`) && !squareDry(heightAt, x, y));
  assert.deepEqual(wet, [], 'no road pixel on a square with a sea corner');
});

test('OFFSHORE-ROADS places on the shore\'s own pixels are still joined - a place\'s square is its own, as a node\'s is (mutant: the place\'s square left wet)', () => {
  const region = regionOf(regionLattice({ x0: 1000, y0: 0, w: 1600, h: 600 }), 0, 0);
  const T = LOCATION_TYPES;
  const out = buildTamrielRegion({ region, places: [{ x: SEA_X, y: 100, type: T.TownHamlet }, { x: SEA_X, y: 160, type: T.TownHamlet }], nodes: [], obstacles: [], gates: [], heightAt });
  assert.equal(out.stats.unrouted, 0, 'the two shore hamlets joined');
  assert.ok(out.roads.size > 0);
});
