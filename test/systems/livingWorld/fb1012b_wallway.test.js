// FIELD BUGS 2026-10-12b WALL-WAY - "Caravan I'm supposed to be guarding walk through the city walls". A road party is
// set down on its way where the way leaves its town, and that was townTrim - a radius (half the grid's side and half a
// block). A town's walls stand on its RMB grid's square edge: a way leaving on a diagonal set the party down inside the
// walls, and it walked out through them (and in through the next town's). A long town's long axis the same. The trim is
// now where the way leaves the grid's box. bible/01-Overview/bugs/Field-Bugs-2026-10-12b.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { townTrim, townExit, wayTrims, wayOf, wayAt, NATIVE_BLOCK } from '../../../src/systems/livingWorld/trips.js';

const PIXEL = 32768;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const city = { mapId: 1, blocks: 64, w: 8, h: 8 };
// the town's own pixel (100, 200) and a way leaving it: east, then north-east on the diagonal
const diag = wayOf({ pixels: [{ x: 100, y: 200 }, { x: 101, y: 199 }, { x: 102, y: 198 }, { x: 103, y: 197 }] });
const east = wayOf({ pixels: [{ x: 100, y: 200 }, { x: 101, y: 200 }, { x: 102, y: 200 }] });
const centre = (way, end = false) => way.pts[end ? way.pts.length - 1 : 0];
const outside = (town, way, s, end = false) => {
  const p = wayAt(way, s), [cx, cz] = centre(way, end);
  const wall = (n) => (n * NATIVE_BLOCK) / 2;
  return Math.abs(p.x - cx) > wall(town.w) || Math.abs(p.z - cz) > wall(town.h);
};

test('WALL-WAY a party is set down past its town\'s walls on a diagonal way - townTrim\'s radius set it inside them (the report); along an axis a square town\'s trim is townTrim\'s own (mutants: the box\'s margin lost; an axis\'s half-extent the other\'s; the radius kept)', () => {
  assert.equal(townTrim(city), 18432);
  assert.equal(outside(city, diag, townTrim(city)), false, 'the radius on a diagonal: inside the walls');
  const t = townExit(city, diag);
  assert.ok(near(t, 18432 * Math.SQRT2, 1e-6), `the box's corner, ${t}`);
  assert.equal(outside(city, diag, t), true, 'past them');
  assert.equal(townExit(city, east), townTrim(city), 'along an axis, as it was');
  assert.equal(townExit({ mapId: 1, blocks: 16 }, diag), townTrim({ mapId: 1, blocks: 16 }), 'a town of no shape is townTrim\'s');
});

test('WALL-WAY a long town is left past its long side\'s walls, and the way\'s far end is measured from its own town (mutants: w and h swapped; the far end measured from the near)', () => {
  const long = { mapId: 2, blocks: 32, w: 8, h: 4 };   // 8 blocks east, 4 north
  assert.equal(townTrim(long), 14336, 'the radius: short of the long side\'s walls at 16384');
  assert.equal(townExit(long, east), 8 * NATIVE_BLOCK / 2 + NATIVE_BLOCK / 2, 'east: past the long side');
  const north = wayOf({ pixels: [{ x: 100, y: 200 }, { x: 100, y: 199 }, { x: 100, y: 198 }] });
  assert.equal(townExit(long, north), 4 * NATIVE_BLOCK / 2 + NATIVE_BLOCK / 2, 'north: past the short side');
  assert.equal(townExit(long, north, true), townExit(long, north), 'the far end, from its own end');
  const t1 = townExit(city, diag, true);
  assert.equal(outside(city, diag, diag.len - t1, true), true, 'arriving, set down past the far town\'s walls');
  // a way that leaves east and arrives on a diagonal: each end its own leg
  const bent = wayOf({ pixels: [{ x: 100, y: 200 }, { x: 101, y: 200 }, { x: 102, y: 200 }, { x: 103, y: 199 }] });
  assert.equal(townExit(city, bent), 18432, 'leaving along the axis');
  assert.ok(near(townExit(city, bent, true), 18432 * Math.SQRT2, 1e-6), 'arriving on the diagonal');
  assert.equal(outside(city, bent, bent.len - townExit(city, bent, true), true), true, 'past the far walls');
});

test('WALL-WAY the trims of a way: each its town\'s exit; held to 0.4 of the way each only where the two would meet; none at a wild end (mutants: the cap always; the cap never; a wild end trimmed)', () => {
  const town = { mapId: 3, blocks: 4, w: 2, h: 2 };
  assert.deepEqual(wayTrims(city, town, diag), [townExit(city, diag), townExit(town, diag, true)]);
  const one = wayOf({ pixels: [{ x: 100, y: 200 }, { x: 101, y: 200 }] });   // a one-pixel trip, 32768 long
  assert.deepEqual(wayTrims(city, town, one), [18432, 6144], 'the radius\'s cap (13107) set the city\'s party inside its walls');
  assert.deepEqual(wayTrims(city, city, one), [one.len * 0.4, one.len * 0.4], 'two cities whose grounds all but touch: as every trim was');
  assert.deepEqual(wayTrims(city, null, diag), [townExit(city, diag), 0], 'the wild end is no town\'s');
});

test('WALL-WAY every trip kind trims by wayTrims and the host gives a town its grid\'s shape (mutants: one trip left on the radius; the shape unwritten)', () => {
  const trips = readFileSync(new URL('../../../src/systems/livingWorld/trips.js', import.meta.url), 'utf8');
  assert.equal((trips.match(/Math\.min\(townTrim\(/g) ?? []).length, 0, 'no trip on the radius');
  assert.equal((trips.match(/const \[trim0, trim1\] = wayTrims\(home, /g) ?? []).length, 5, 'the market, the hunt, the trip, the pilgrimage, the dive');
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /w: Math\.max\(1, ed\?\.width \?\? 1\), h: Math\.max\(1, ed\?\.height \?\? 1\),/);
});
