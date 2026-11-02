// OW-TOWN-ROUND (2026-10-23, the owner: "Overworld pathing always wants to walk into the middle of the town let the player
// always go around it if not clicking vaguely in the middle of the city"): THE TOWN IS GONE ROUND, AND ASKED FOR AT ITS
// MIDDLE. Three laws, each pure:
//   - travelPathMode.js pickNearPlaceMiddle: a click on a town takes the town's journey only in its middle;
//   - travelOptions.js spotOffTownFor: a spot clicked elsewhere on the town is put out on its ring (unless the
//     traveller already stands in the town - its streets are the town walk's);
//   - travelRoute.js routeLegs `start` / `end`: a spot journey's own first and last pixels are walked round the town
//     they hold, on the shorter side, whenever the straight walk would cross it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ringPassPoints, spotOffTownFor, spotOffTown, segmentCrossesRect, ringSideAt } from '../../../src/systems/travel/travelOptions.js';
import { routeLegs } from '../../../src/systems/travel/travelRoute.js';
import { pickNearPlaceMiddle, PLACE_MIDDLE_SHARE, PLACE_MIDDLE_MIN } from '../../../src/systems/travel/travelPathMode.js';

const P = 32768;
// a town in pixel (10, 10) - its middle the pixel's (native: x = px * P + P/2, z = (499 - py) * P + P/2)
const mid = { x: 10 * P + P / 2, z: 489 * P + P / 2 };
const L = { xMin: mid.x - 6000, xMax: mid.x + 6000, zMin: mid.z - 6000, zMax: mid.z + 6000 };
const B = { xMin: mid.x - 8000, xMax: mid.x + 8000, zMin: mid.z - 8000, zMax: mid.z + 8000 };
const ringAt = (x, y, from, to) => (x === 10 && y === 10 ? ringPassPoints(L, B, from, to, mid) : null);
const rel = (p) => [Math.round(p.x - mid.x), Math.round(p.z - mid.z)];
/** Every straight walk from `me` through the legs' own points - none may cross the town. */
const crosses = (me, legs) => {
  const pts = [me, ...legs.filter((l) => l.at).map((l) => l.at)];
  return pts.slice(1).some((q, k) => segmentCrossesRect(pts[k], q, L));
};

test('OW-TOWN-ROUND: a click takes the town only in its middle - PLACE_MIDDLE_SHARE of its half-width each way, never under PLACE_MIDDLE_MIN; anywhere else on it is the spot (mutants: the whole grown rect; no floor for a hamlet)', () => {
  assert.equal(PLACE_MIDDLE_SHARE, 0.4);
  assert.equal(PLACE_MIDDLE_MIN, 3072);
  const grow = 6144;
  const city = { minX: mid.x - 20000 - grow, maxX: mid.x + 20000 + grow, minZ: mid.z - 10000 - grow, maxZ: mid.z + 10000 + grow, cx: mid.x, cz: mid.z };
  assert.equal(pickNearPlaceMiddle(mid, city, grow), true, 'the middle');
  assert.equal(pickNearPlaceMiddle({ x: mid.x + 8000, z: mid.z + 4000 }, city, grow), true, 'within 40% each way');
  assert.equal(pickNearPlaceMiddle({ x: mid.x + 8100, z: mid.z }, city, grow), false, 'past 40% of its half-width');
  assert.equal(pickNearPlaceMiddle({ x: mid.x, z: mid.z + 4100 }, city, grow), false, 'past 40% of its half-depth');
  assert.equal(pickNearPlaceMiddle({ x: mid.x + 19000, z: mid.z }, city, grow), false, 'its walls');
  const hamlet = { minX: mid.x - 2048 - grow, maxX: mid.x + 2048 + grow, minZ: mid.z - 2048 - grow, maxZ: mid.z + 2048 + grow, cx: mid.x, cz: mid.z };
  assert.equal(pickNearPlaceMiddle({ x: mid.x + 2048, z: mid.z - 2048 }, hamlet, grow), true, 'a hamlet of one block is all middle');
  assert.equal(pickNearPlaceMiddle({ x: mid.x + 3100, z: mid.z }, hamlet, grow), false, 'but its grown margin is not');
  assert.equal(pickNearPlaceMiddle(null, city, grow), false);
});

test('OW-TOWN-ROUND: a spot clicked in a town is put out on its ring, on the side it stands nearest - kept where it is outside, and kept for a traveller already in the town (mutants: never moved; moved for the traveller inside; the far side)', () => {
  const rects = { locationRect: L, locationBorderRect: B };
  const outside = { x: mid.x - 12000, z: mid.z };
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 5000, z: mid.z + 1000 }, rects, outside)), [7000, 1000], 'nearest the east wall: the east band\'s middle, level with it');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x - 1000, z: mid.z - 5500 }, rects, outside)), [-1000, -7000], 'nearest the south: the south band');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 7000, z: mid.z }, rects, outside)), [7000, 0], 'on the ring already: kept');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 5000, z: mid.z }, rects, mid)), [5000, 0], 'the traveller in the town: its streets walk it');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 5000, z: mid.z }, null, outside)), [5000, 0], 'a pixel with no town');
  assert.deepEqual(spotOffTown(L, B, { x: mid.x - 9000, z: mid.z }), { x: mid.x - 9000, z: mid.z });
  assert.equal(ringSideAt(L, { x: mid.x - 9000, z: mid.z + 9000 }), 'nw');
  assert.equal(ringSideAt(L, mid), '');
});

test('OW-TOWN-ROUND: a spot journey in the town\'s own pixel walks round it the shorter way, the spot its last leg - never across the town; one that never meets the town walks no ring (mutants: no start ring; the long way round; a ring point inside the town)', () => {
  const me = { x: mid.x - 12000, z: mid.z - 3000 }, east = { x: mid.x + 12000, z: mid.z - 2000 };
  const legs = routeLegs([{ x: 10, y: 10 }], [], { ringAt }, [me, east]);
  assert.deepEqual(legs.map((l) => [rel(l.at), !!l.ring]), [[[-7000, -3000], true], [[-7000, -7000], true], [[7000, -7000], true], [[7000, -2000], true], [[12000, -2000], false]],
    'in level with the traveller, round the south (both ends stand south of the middle), out level with the spot, then the spot');
  assert.equal(crosses(me, legs), false);
  const northMe = { x: mid.x - 12000, z: mid.z + 3000 }, northEast = { x: mid.x + 12000, z: mid.z + 2000 };
  const north = routeLegs([{ x: 10, y: 10 }], [], { ringAt }, [northMe, northEast]);
  assert.deepEqual(north.slice(1, 3).map((l) => rel(l.at)), [[-7000, 7000], [7000, 7000]], 'ends north of the middle: round the north');
  assert.deepEqual(routeLegs([{ x: 10, y: 10 }], [], { ringAt }, [me, { x: mid.x - 12000, z: mid.z + 4000 }]), [], 'both on the west: no ring');
});

test('OW-TOWN-ROUND: a spot beyond its pixel\'s town is reached round the town (the spot\'s own leg carries it, so no road\'s lane runs back to the middle), and a traveller beside a town leaves round it; without ends routeLegs is what it was (mutants: no end ring; the last leg without its spot; the start ring dropped)', () => {
  const px = [{ x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }];
  const east = { x: mid.x + 12000, z: mid.z - 2000 };
  const end = routeLegs(px, ['road', 'road'], { ringAt }, [{ x: 8 * P + 100, z: mid.z }, east]);
  assert.deepEqual(end.map((l) => [l.x, l.at ? rel(l.at) : null, !!l.ring]),
    [[9, null, false], [10, [-7000, 0], true], [10, [-7000, -7000], true], [10, [7000, -7000], true], [10, [7000, -2000], true], [10, [12000, -2000], false]]);
  assert.equal(end.at(-1).kind, 'road');
  assert.equal(crosses({ x: 9 * P + P / 2, z: mid.z }, end), false);
  assert.deepEqual(routeLegs(px, ['road', 'road'], { ringAt }), [{ x: 10, y: 10, kind: 'road' }], 'no ends: the old fold, the last pixel unringed');
  assert.deepEqual(routeLegs(px, ['road', 'road'], { ringAt }, [{ x: 8 * P + 100, z: mid.z }, { x: mid.x - 12000, z: mid.z }]), [{ x: 10, y: 10, kind: 'road' }], 'a spot on the near side: no ring');
  // leaving: the traveller east of the town, bound west two pixels on
  const out = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  const me = { x: mid.x + 12000, z: mid.z + 1000 };
  const leave = routeLegs(out, ['open', 'open'], { ringAt }, [me, { x: 8 * P + 100, z: mid.z }]);
  assert.ok(leave[0].ring && leave[0].x === 10, 'the first legs are the town\'s ring');
  assert.deepEqual(rel(leave[0].at), [7000, 1000], 'in level with the traveller');
  assert.equal(crosses(me, leave), false);
  assert.deepEqual(routeLegs(out, ['sea', 'sea'], { ringAt }, [me, { x: 8 * P + 100, z: mid.z }]).filter((l) => l.ring), [], 'never a ring left under sail');
});

test('OW-TOWN-ROUND wired (by source): the click asks the middle and walks a spot outside the town; the walk hands its spot to the legs and a ring at the start joins no road (mutants: the click unasked; the spot unput)', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  // PIN MOVED (AUDIT UPDATE T1; AUDIT UPDATE II B3): the middle remembered for the ground arm; with places alone a click
  // on a place is the place's before the path mode is asked at all
  assert.match(w, /if \(place && travelOptions\?\.settings\?\.targetCoordsAllowed !== false && !pickTakesPlace\(\{ hit: \(middle = pickNearPlaceMiddle\(n, tvPlaceRect\(place\), TV_PLACE_GROW\)\),/);
  assert.match(w, /travelViewWalkTo\(hit\.point, pix, \{ outside: !middle && !fineMoveHeld\(e\) \}\)/);
  assert.match(w, /let n = outside && !water \? spotOffTownFor\(state\.worldCoords\(point\), tvTownRects\(pix\.x, pix\.y\), state\.worldCoords\(player\.pos\)\) : state\.worldCoords\(point\);/);
  assert.match(w, /let legs = tvJoinedLegs\(from, plan, roads, door \|\| water \? null : n\);/);   // PIN MOVED (AUDIT UPDATE T3): never a spot on the sea
  assert.match(w, /routeLegs\(plan\.pixels, plan\.kinds, \{ ringAt: tvRingAt \}, end && \[state\.worldCoords\(player\.pos\), end\]\)/);
});

// AUDIT UPDATE (2026-10-25, bible/01-Overview/audits/Audit-Update-2026-10-25.md): lane T's laws the pins above left loose
test('AUDIT UPDATE T6: every band of the ring is its own - the west and the north as the east and the south, a dead-centre spot to the first of w, e, s, n (mutants: a band moved to the town\'s edge)', () => {
  const rects = { locationRect: L, locationBorderRect: B }, outside = { x: mid.x - 12000, z: mid.z };
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x - 5000, z: mid.z + 1000 }, rects, outside)), [-7000, 1000], 'nearest the west wall: the west band\'s middle');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 1000, z: mid.z + 5500 }, rects, outside)), [1000, 7000], 'nearest the north: the north band\'s');
  assert.deepEqual(rel(spotOffTown(L, B, mid)), [-7000, 0], 'a tie: the west, the first asked (N1)');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 5000, z: mid.z }, rects, { x: mid.x, z: mid.z + 12000 })), [7000, 0], 'a traveller level with the town but north of it is no traveller in it (AUDIT UPDATE P3)');
});

test('AUDIT UPDATE T6: an end is ringed only where the straight walk to it meets the town - a spot on the ring reached from outside its walls walks straight (mutants: the crossing unasked; the step\'s z read the other way)', () => {
  const px = [{ x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }];
  const nw = { x: mid.x - 7000, z: mid.z + 7000 };   // the north-west band, reached from the west: the walk never meets the town
  const legs = routeLegs(px, ['road', 'road'], { ringAt }, [{ x: 8 * P + 100, z: mid.z }, nw]);
  assert.deepEqual(legs, [{ x: 10, y: 10, kind: 'road' }], 'no ring: the old fold, the spot walked to as it stands');
  // from the south, for the north band: the walk meets the town - round it, never across
  const fromSouth = [{ x: 10, y: 12 }, { x: 10, y: 11 }, { x: 10, y: 10 }];
  const north = { x: mid.x + 1000, z: mid.z + 7000 };
  const round = routeLegs(fromSouth, ['open', 'open'], { ringAt }, [{ x: mid.x, z: mid.z - 2 * P }, north]);
  assert.ok(round.some((l) => l.ring), 'ringed');
  assert.equal(crosses({ x: mid.x, z: mid.z - P }, round.filter((l) => l.x === 10 && l.y === 10)), false, 'and never across');
});

test('AUDIT UPDATE T4: a FREE plan pulled taut steps several pixels - its end ring reads the step\'s own length, so a walk that meets the town from a far pixel is ringed (mutants: the step\'s sign alone)', () => {
  const pulled = [{ x: 7, y: 9 }, { x: 10, y: 10 }];   // freePull's taut pair: three pixels west and one north in one step
  const spot = { x: mid.x + 7000, z: mid.z + 5500 };   // the east band
  const legs = routeLegs(pulled, ['open'], { ringAt }, [{ x: 7 * P + P / 2, z: 490 * P + P / 2 }, spot]);
  assert.ok(legs.some((l) => l.ring), 'the walk from (7, 9) meets the town: ringed');
  assert.equal(crosses({ x: 7 * P + P / 2, z: 490 * P + P / 2 }, legs.filter((l) => l.x === 10)), false, 'never across it');
});

test('AUDIT UPDATE T5: the start ring reads the start\'s own afloat rule - a helm whose first step is a landfall walks no ring from the water; one ashore whose first step embarks walks round the town on foot (mutants: the end\'s rule at the start; the embark\'s ring sailed)', () => {
  const out = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  const me = { x: mid.x + 12000, z: mid.z + 1000 }, west = { x: 8 * P + 100, z: mid.z };
  assert.deepEqual(routeLegs(out, ['landfall', 'open'], { ringAt }, [me, west]).filter((l) => l.ring), [], 'afloat at the start: no ring');
  const embark = routeLegs(out, ['embark', 'sea'], { ringAt }, [me, west]);
  const ring = embark.filter((l) => l.ring && l.x === 10);
  assert.ok(ring.length > 0, 'ashore at the start: round the town to the water');
  assert.deepEqual([...new Set(ring.map((l) => l.kind))], ['open'], 'walked, never sailed');
  assert.equal(crosses(me, embark.filter((l) => l.x === 10)), false);
  // the end's own rule: a town reached under sail (the step in sailed, or an embark's) is never ringed - its points stand on land
  const inn = [{ x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }], east = { x: mid.x + 12000, z: mid.z - 2000 };
  assert.deepEqual(routeLegs(inn, ['sea', 'sea'], { ringAt }, [{ x: 8 * P + 100, z: mid.z }, east]).filter((l) => l.ring), [], 'reached under sail: no ring');
  assert.equal(ringSideAt(L, { x: L.xMax, z: mid.z }), '', 'a spot on the wall is no side - as spotOffTown keeps it');
});

test('AUDIT UPDATE T6: a walk with two equal ways round goes the one way every time (mutants: the tie the other way)', () => {
  const me = { x: mid.x - 12000, z: mid.z }, east = { x: mid.x + 12000, z: mid.z };
  const legs = routeLegs([{ x: 10, y: 10 }], [], { ringAt }, [me, east]);
  assert.deepEqual(legs.map((l) => rel(l.at)), [[-7000, 0], [-7000, 7000], [7000, 7000], [7000, 0], [12000, 0]], 'round the north, the first of the two');
  assert.equal(crosses(me, legs), false);
});

// AUDIT UPDATE II (2026-10-25, bible/01-Overview/audits/Audit-Update-II-2026-10-25.md) B4
test('AUDIT UPDATE II B4: a spot in the location\'s own middle is kept - a place the map holds no plate for (an undiscovered dungeon) is asked its middle by the spot\'s own law; off the middle it is put out on the ring as before (mutants: the middle unasked)', () => {
  const rects = { locationRect: L, locationBorderRect: B }, outside = { x: mid.x - 12000, z: mid.z };
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 1000, z: mid.z - 1000 }, rects, outside)), [1000, -1000], 'the middle: kept as clicked');
  assert.deepEqual(rel(spotOffTownFor({ x: mid.x + 5000, z: mid.z - 1000 }, rects, outside)), [7000, -1000], 'off it: the east band');
});
