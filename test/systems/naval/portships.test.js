// PORT-SHIPS (2026-10-27, the owner's field report, item 8: "I went to solitude and the ships at works were inside town
// walls"; the owner: "No band aids or half assed work"; bible/03-World/Holdings.md section 7, PORT-SHIPS) - A BERTH STANDS WHERE A
// SHIP CAN (systems/naval/shipLife.js berthStands, findHarbour's `keep` and `ground`): her ship, her quay and her jetty's
// way clear of her town's walls and its landmarks over the water (systems/naval/harbourKeep.js), her approach's hull too,
// and her waterplane over ground under the sea's top. The harbour book hands both (the town's from the world host's
// harbourNear, the ground from its world). Shapes of the port's own; the freeware's ports are portships_real.test.js's.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findHarbour, berthStands, waterplaneHalf, berthSize, BERTH_HULL, BERTH_QUAY_IN, BERTH_QUAY_ENDS, KEEP_STEP, BERTH_JETTY_WALK,
  BERTH_DRY_M, BOW_TAPER, STERN_TAPER, SHORE_STEP,
} from '../../../src/systems/naval/shipLife.js';
import { createHarbourBook } from '../../../src/systems/naval/harbourBook.js';
import { harbourKeep, CAPITAL_KEEPS, CAPITAL_WALLS, inCapitalWalls, townKeepField, KEEP_SPARE, TOWN_WALL_KEEP, ARCH_FOOT, STACK_FOOT } from '../../../src/systems/naval/harbourKeep.js';
import { SOLITUDE_DOCKS } from '../../../src/world/solitudeRelief.js';
import { SOLITUDE, CAPITALS } from '../../../src/world/tamrielCapitals.js';
import { ALINOR, TORVAL } from '../../../src/world/capitalPlans.js';
import { IMPERIAL, polar, bridgeLine } from '../../../src/world/imperialCity.js';
import { registerTownWall } from '../../../src/world/townWalls.js';
import { hostText } from '../../hostText.mjs';
import { readFileSync } from 'node:fs';

/** A berth's ship (the template's footprint) and her quay, every half metre: [x, z]. */
function shipAndQuay(b) {
  const { halfWidth, bowZ, aftZ } = berthSize(BERTH_HULL), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), lx = -b.normal[0], lz = -b.normal[1], out = [];
  for (let z = aftZ - BERTH_QUAY_ENDS; z <= bowZ + BERTH_QUAY_ENDS; z += 0.5) for (let x = -halfWidth; x <= halfWidth + BERTH_QUAY_IN; x += 0.5) out.push([b.pos[0] + fx * z + lx * x, b.pos[1] + fz * z + lz * x]);
  return out;
}
/** A berth's waterplane, every half metre. */
function waterplane(b) {
  const { bowZ, aftZ } = berthSize(BERTH_HULL), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), out = [];
  for (let z = aftZ; z <= bowZ; z += 0.5) { const w = waterplaneHalf(z); for (let s = -w; s <= w + 1e-6; s += 0.5) out.push([b.pos[0] + fx * z + fz * s, b.pos[1] + fz * z - fx * s]); }
  return out;
}
const touches = (berths, at) => berths.filter((b) => shipAndQuay(b).some(([x, z]) => at(x, z))).length;

// A WALL IN THE WATER (Solitude's west wall, 7 m out in the Karth): the sea west of x = 0, the town's land east of it (its
// footprint where the shore scan meets the water half a metre out), its wall's line at x = -7 from z 100 to 500 - the wall
// and all inside it its keep.
const SEA_WEST = (x) => x < 0;
const TOWN = { minX: 11.5, maxX: 311.5, minZ: 0, maxZ: 600 };
const WALLED = (x, z) => x >= -7 - 2.5 - KEEP_SPARE && z >= 100 && z <= 500;

test('PORT-SHIPS A WALL IN THE WATER: off the water alone the berths nearest the town lie along its shore inside the wall\'s line, each ship through the wall; with the town\'s keep none touches it - the berths lie past its ends, its six still (mutants: the keep unasked; the quay\'s band unsampled; sampled coarser than a pier)', () => {
  const was = findHarbour({ rect: TOWN, isWater: SEA_WEST });
  assert.ok(touches(was.berths, WALLED) >= 3, 'off the water alone: ships through the wall');
  const now = findHarbour({ rect: TOWN, isWater: SEA_WEST, keep: WALLED });
  assert.equal(now.berths.length, 6);
  assert.equal(touches(now.berths, WALLED), 0, 'none touches it');
  assert.ok(now.berths.every((b) => b.pos[1] < 100 || b.pos[1] > 500), 'past its ends');
});

// A PIER NARROWER THAN A STATION (Torval's and Alinor's, 6 m): the sea north of z = 0, a pier out from the shore at x 0-6.
const SEA_NORTH = (x, z) => z >= 0;
const QUAY_TOWN = { minX: -200, maxX: 200, minZ: -295, maxZ: 5 };
const PIER = (x, z) => x >= -KEEP_SPARE && x <= 6 + KEEP_SPARE && z >= 0 && z <= 80 + KEEP_SPARE;

test('PORT-SHIPS A PIER: the nearest berth off the water alone lies across a pier narrower than her footprint\'s stations; with the keep her ship and her quay keep off it, and the berths flank it (mutants: the keep unasked; sampled coarser than a pier)', () => {
  const was = findHarbour({ rect: QUAY_TOWN, isWater: SEA_NORTH });
  assert.ok(touches(was.berths, PIER) >= 1, 'off the water alone: a ship through the pier');
  const now = findHarbour({ rect: QUAY_TOWN, isWater: SEA_NORTH, keep: PIER });
  assert.equal(touches(now.berths, PIER), 0);
  assert.ok(now.berths.some((b) => b.pos[0] < 0) && now.berths.some((b) => b.pos[0] > 6), 'either side of it');
  assert.ok(KEEP_STEP <= 6 / 2, 'sampled at least twice across the narrowest pier');
});

// HER JETTY'S WAY: the shore point the scan meets 11.9 m out (its grid's), so her quay's back stands 10.6 m off the land and
// her jetty crosses a wall standing in the water between them (x -6 to -4).
const JETTY_TOWN = { minX: 0.1, maxX: 300.1, minZ: 0, maxZ: 600 };
const WATER_WALL = (x) => x >= -6 && x <= -4;

test('PORT-SHIPS HER JETTY\'S WAY: a wall standing in the water between her quay and the shore is crossed by her jetty alone - her ship and her quay clear of it - and her berth is not kept (mutants: the jetty\'s way unwalked)', () => {
  const was = findHarbour({ rect: JETTY_TOWN, isWater: SEA_WEST });
  const b = was.berths[0];
  assert.ok(Math.abs(b.pos[0] + 11.9 + berthSize(BERTH_HULL).halfWidth + 4) < 1e-6, 'her shore point 11.9 m out, her berth off it');
  assert.equal(touches([b], WATER_WALL), 0, 'her ship and her quay clear of the wall');
  assert.equal(berthStands(b.pos, b.yaw, b.normal, BERTH_HULL, { keep: WATER_WALL, water: SEA_WEST }), false, 'her jetty\'s way crosses it');
  assert.ok(BERTH_JETTY_WALK >= SHORE_STEP + KEEP_STEP);
  const now = findHarbour({ rect: JETTY_TOWN, isWater: SEA_WEST, keep: WATER_WALL });
  assert.equal(now, null, 'no berth of that shore crosses it');
});

test('PORT-SHIPS HER QUAY: a wall standing in the water between her side and the shore, under her quay alone - her hull clear of it, her jetty\'s way past it - and her berth is not kept (mutants: the quay\'s band unsampled)', () => {
  const b = findHarbour({ rect: TOWN, isWater: SEA_WEST }).berths[0];
  const side = b.pos[0] + berthSize(BERTH_HULL).halfWidth, under = (x) => x >= -4.2 && x <= -2.6;
  assert.ok(side < -4.2 && side + BERTH_QUAY_IN > -2.6, 'between her side and her quay\'s back');
  assert.equal(berthStands(b.pos, b.yaw, b.normal, BERTH_HULL, { keep: under, water: SEA_WEST }), false);
  assert.equal(berthStands(b.pos, b.yaw, b.normal, BERTH_HULL, { keep: (x) => x > -40 && x < side - berthSize(BERTH_HULL).halfWidth * 2 - 0.5, water: SEA_WEST }), true, 'a wall past her seaward side is none of hers');
});

test('PORT-SHIPS HER APPROACH: a pier across the water astern of her berth, where she comes round to it, keeps her berth off that way (mutants: the approach unasked)', () => {
  const was = findHarbour({ rect: QUAY_TOWN, isWater: SEA_NORTH });
  const b = was.berths[0], a = b.approach;
  const astern = (x, z) => Math.hypot(x - a[0], z - a[1]) < 3;   // a pier's head under her approach's middle
  assert.ok(berthStands(b.pos, b.yaw, b.normal, BERTH_HULL, { keep: astern, water: SEA_NORTH }), 'her own berth clear of it');
  assert.equal(berthStands(a, b.yaw, b.normal, BERTH_HULL, { keep: astern, water: SEA_NORTH }, false), false);
  const now = findHarbour({ rect: QUAY_TOWN, isWater: SEA_NORTH, keep: astern });
  assert.ok(now.berths.every((n) => !(Math.hypot(n.approach[0] - a[0], n.approach[1] - a[1]) < 1 && n.yaw === b.yaw)), 'her berth not taken that way');
});

// THE GROUND: a town's margin of the sea lifted to its ground (a water tile over a bank 8 m up) along part of its shore.
const BANK = (x, z) => (x < 0 && x >= -12 && z >= 0 && z <= 330 ? 8 : x < 0 ? -0 : 2);

test('PORT-SHIPS THE GROUND: water tiles over a bank - off the water alone a ship\'s side lies on it; with the ground none of her waterplane stands over BERTH_DRY_M, and the harbour keeps its six (mutants: the ground unasked; its threshold; the waterplane unsampled)', () => {
  const dry = (b) => waterplane(b).some(([x, z]) => BANK(x, z) > BERTH_DRY_M);
  const was = findHarbour({ rect: TOWN, isWater: SEA_WEST });
  assert.ok(was.berths.filter(dry).length >= 3, 'off the water alone: on the bank');
  const now = findHarbour({ rect: TOWN, isWater: SEA_WEST, ground: BANK });
  assert.equal(now.berths.length, 6);
  assert.equal(now.berths.filter(dry).length, 0);
  assert.ok(now.berths.every((b) => b.pos[1] > 330 || b.pos[1] < 0), 'past the bank\'s ends');
  assert.equal(BERTH_DRY_M, 0.1);
});

test('PORT-SHIPS HER WATERPLANE: her full beam amidships, drawn in to nothing at her stem over BOW_TAPER of her length and at her stern over STERN_TAPER - the footprint\'s corners are no hull; a berth that asks no keep and no ground stands (mutants: the tapers)', () => {
  const { halfWidth, bowZ, aftZ } = berthSize(BERTH_HULL), L = bowZ - aftZ;
  assert.deepEqual([BOW_TAPER, STERN_TAPER], [0.3, 0.12]);
  assert.equal(waterplaneHalf((bowZ + aftZ) / 2), halfWidth);
  assert.equal(waterplaneHalf(bowZ), 0);
  assert.equal(waterplaneHalf(aftZ), 0);
  assert.ok(Math.abs(waterplaneHalf(bowZ - 0.15 * L) - halfWidth / 2) < 1e-9);
  assert.ok(Math.abs(waterplaneHalf(aftZ + 0.06 * L) - halfWidth / 2) < 1e-9);
  assert.equal(berthStands([0, 0], 0, [1, 0], BERTH_HULL, { water: () => false }), true);
});

test('PORT-SHIPS THE BOOK: the harbour book sounds the port near the player with its town\'s keep (harbourNear\'s `keep`) and the world\'s ground (`ground`) - the same harbour findHarbour finds with both; with neither, the water\'s alone (mutants: the keep unhanded; the ground unhanded)', () => {
  const near = { key: 'port:1', name: 'Sol', rect: TOWN, ready: () => true, keep: WALLED };
  const book = createHarbourBook({ harbourNear: () => near, isWater: (x, z) => SEA_WEST(x), ground: BANK });
  book.step(0);
  assert.deepEqual(book.get('port:1').harbour, findHarbour({ rect: TOWN, isWater: SEA_WEST, keep: WALLED, ground: BANK }));
  assert.notDeepEqual(book.get('port:1').harbour, findHarbour({ rect: TOWN, isWater: SEA_WEST, keep: WALLED }), 'the ground asked');
  assert.notDeepEqual(book.get('port:1').harbour, findHarbour({ rect: TOWN, isWater: SEA_WEST, ground: BANK }), 'the keep asked');
  const bare = createHarbourBook({ harbourNear: () => ({ ...near, keep: undefined }), isWater: (x, z) => SEA_WEST(x) });
  bare.step(0);
  assert.deepEqual(bare.get('port:1').harbour, findHarbour({ rect: TOWN, isWater: SEA_WEST }));
});

// ---------------------------------------------------------------- the towns' keeps

const K = Object.fromEntries(CAPITALS.map((c, k) => [c.key, k]));
/** A capital's slice's location and footprint, its anchor's scene point. */
const capitalPort = (key, s = 0, rect = { minX: 1000, maxX: 1819.2, minZ: -5000, maxZ: -4180.8 }) => ({ loc: { capital: { key, k: K[key], s } }, rect });

test('PORT-SHIPS SOLITUDE\'S KEEP: inside its walls and their band (its towers\' half), its two piers, its sea stack and its arch, and (SOLITUDE-RELIEF) its rock to its cliffs\' feet - never its docks\' water, their quay and its sea edge\'s row, nor the Karth below the cliff; the scene\'s point to the anchor\'s metres off its slice (mutants: the walls\' band; a pier; the stack; the arch; the rock; the quay\'s row; the anchor)', () => {
  const S = SOLITUDE, W = S.wall, law = CAPITAL_KEEPS.solitude;
  assert.equal(CAPITAL_WALLS.solitude.band, W.tower / 2 + KEEP_SPARE);
  assert.equal(law(200, 100), true, 'the city');
  assert.equal(law(W.west - W.tower / 2, 100), true, 'the west wall in the Karth');
  // PIN MOVED (SOLITUDE-RELIEF, bible/03-World/Arena-Provinces.md): the walls stand on its rock - past their band the
  // cliff to its foot, a tile of land the water meets (world/solitudeRelief.js onSolitudeRock), the Karth and the quay below
  assert.equal(law(W.west - W.tower / 2 - KEEP_SPARE - 1, 100), true, 'its cliff past it');
  assert.equal(law(-38, 100), true, 'the cliff\'s foot - the sea\'s own ground, on a tile of the land');
  assert.equal(law(-46, 100), false, 'the Karth below it');
  assert.equal(law(200, 600), false, 'the country past its pixel');
  assert.equal(law(250, W.north - W.tower / 2 - KEEP_SPARE - 1), true, 'the north gate\'s landing outside the wall');
  assert.equal(law(250, -150), false, 'the quay below it');
  assert.equal(law(250, SOLITUDE_DOCKS.edge - 6), false, 'the quay\'s sea edge\'s row');
  assert.equal(law(SOLITUDE_DOCKS.x0 - 1, -130), true, 'the cliff past the quay\'s end');
  assert.equal(law(300, -180), false, 'the docks\' water');
  for (const p of S.docks.piers) { assert.equal(law(p, -200), true, `the pier at ${p}`); assert.equal(law(p + S.docks.pierW / 2 + KEEP_SPARE + 0.5, -200), false); }
  assert.equal(law(S.docks.piers[0], S.docks.pierTo - KEEP_SPARE - 1), false, 'past its head');
  assert.deepEqual([ARCH_FOOT, STACK_FOOT], [S.arch.w / 2 + 16, S.stack.foot + 19], 'the arch\'s and the stack\'s feet at the water (capitalSolitude.js buildSolitudeArch)');
  assert.equal(law(S.stack.x, S.stack.z + STACK_FOOT), true, 'the stack\'s foot, off the arch');
  assert.equal(law(S.stack.x, S.stack.z + STACK_FOOT + KEEP_SPARE + 1), false, 'past it');
  assert.equal(law(-60, 0), true, 'under the arch');
  assert.equal(law(-60, ARCH_FOOT + KEEP_SPARE + 1), false, 'beside it');
  const { loc, rect } = capitalPort('solitude'), keep = harbourKeep(loc, rect);
  const ax = rect.minX + 2 * 102.4, az = rect.maxZ - 3 * 102.4;
  assert.equal(keep(ax + 200, az - 100), true);
  assert.equal(keep(ax + 300, az + 180), false, 'the docks, north');
  assert.equal(keep(ax + S.docks.piers[0], az + 200), true, 'a pier');
});

test('PORT-SHIPS ALINOR\'S AND TORVAL\'S KEEPS: inside their three landward walls - the river through Alinor\'s middle with them - and their band, the open side to the quay with its two end towers; their four piers; never the quay\'s water between them (mutants: the open side closed; its towers; a pier)', () => {
  for (const [key, C] of [['alinor', ALINOR], ['torval', TORVAL]]) {
    const law = CAPITAL_KEEPS[key], W = C.wall, Q = C.quay, b = CAPITAL_WALLS[key].band;
    assert.equal(CAPITAL_WALLS[key].open, 'S');
    assert.equal(law(0, (W.north + W.south) / 2), true, `${key}: the city`);
    assert.equal(law(0, Q.edge + 12), false, `${key}: the quay's water`);
    assert.equal(law(W.west + 50, W.south + 1), false, `${key}: past its open side`);
    assert.equal(law(W.east, W.south + b - 0.5), true, `${key}: its east end's tower`);
    assert.equal(law(W.west, W.south + b - 0.5), true, `${key}: its west end's`);
    for (const p of Q.piers) assert.equal(law(p, Q.edge + 30), true, `${key}: the pier at ${p}`);
    assert.equal(law((Q.piers[1] + Q.piers[2]) / 2, Q.edge + 30), false, `${key}: between them`);
  }
  assert.equal(CAPITAL_KEEPS.alinor(0, (ALINOR.river.z0 + ALINOR.river.z1) / 2), true, 'Alinor\'s river inside its walls');
  assert.equal(inCapitalWalls(CAPITAL_WALLS.alinor, 0, ALINOR.wall.south + 2), false);
  assert.equal(inCapitalWalls({ ...CAPITAL_WALLS.alinor, open: null }, 0, ALINOR.wall.south + 2), true, 'closed, its band');
});

test('PORT-SHIPS THE IMPERIAL CITY\'S KEEP: the walled city, the Waterfront\'s twenty-one piers on their bearings, Talos Bridge and the causeways - never the water between two piers; off its Waterfront slice\'s footprint (mutants: the piers; the ways; the slice)', () => {
  const law = CAPITAL_KEEPS['imperial-city'], W = IMPERIAL.waterfront;
  assert.equal(law(...polar(180, IMPERIAL.cityWall.r - 100)), true, 'the city');
  for (const b of [W.piers[0], 180, W.piers[W.piers.length - 1]]) assert.equal(law(...polar(b, (W.r1 + W.pierTo) / 2)), true, `the pier at ${b}`);
  assert.equal(law(...polar(181, (W.r1 + W.pierTo) / 2)), false, 'between two');
  const [a, c] = bridgeLine();
  assert.equal(law((a[0] + c[0]) / 2, (a[1] + c[1]) / 2), true, 'Talos Bridge');
  const cap = CAPITALS[K['imperial-city']], s = 562, sx = s % 25, sy = Math.floor(s / 25);
  const { loc, rect } = capitalPort('imperial-city', s), keep = harbourKeep(loc, rect);
  const ax = rect.minX + (cap.anchor[0] - sx * 8) * 102.4, az = rect.maxZ - (cap.anchor[1] - sy * 8) * 102.4;
  const [px, pz] = polar(180, (W.r1 + W.pierTo) / 2);
  assert.equal(keep(ax + px, az - pz), true, 'the pier at 180 off the slice\'s footprint');
  const [qx, qz] = polar(181, (W.r1 + W.pierTo) / 2);
  assert.equal(keep(ax + qx, az - qz), false);
});

test('PORT-SHIPS A WALLED TOWN\'S KEEP: inside its wall\'s line and within TOWN_WALL_KEEP of it, off its footprint\'s south-west corner (its registered wall, townWallOf); a town with no wall of its own and a capital of no harbour keep none (mutants: the inside unfilled; the band; townWallOf)', () => {
  const line = [[100, 100], [300, 100], [300, 300], [100, 300]];
  const f = townKeepField({ line }, 4, 4);
  assert.ok(f.cells.some(Boolean));
  const loc = { mapTableData: { mapId: 0xa7fffff0 }, outline: { walled: true }, exterior: { exteriorData: { width: 4, height: 4, blockNames: [] } } };
  registerTownWall(loc, [], () => null, () => ({}), { line, pieces: [], markers: [], frames: [], gates: [], middle: [200, 200] });
  const rect = { minX: 5000, maxX: 5409.6, minZ: 7000, maxZ: 7409.6 }, keep = harbourKeep(loc, rect);
  assert.equal(keep(5200, 7200), true, 'inside');
  assert.equal(keep(5100 - TOWN_WALL_KEEP + 0.9, 7200), true, 'its band');
  assert.equal(keep(5100 - TOWN_WALL_KEEP - 1.7, 7200), false, 'past it');
  assert.equal(keep(5500, 7200), false);
  assert.equal(harbourKeep({ ...loc, outline: null }, rect), null, 'no wall of its own');
  assert.equal(harbourKeep({ capital: { key: 'mournhold', k: K.mournhold, s: 0 } }, rect), null, 'no harbour');
  assert.equal(harbourKeep(null, rect), null);
});

test('PORT-SHIPS THE HOST: the world hands the harbour book the port\'s town\'s keep (harbourKeep off its location and its footprint) and the ground over the sea\'s top (surfaceAt less tvSeaY, as navalIsWater reads it); the book hands both to findHarbour (mutants: either unhanded). PIN MOVED (PORT-SHIPS) from fb1020c_harbourreach.test.js and auditcaptsea.test.js: their lines carry the keep and the ground', () => {
  const W = hostText('src/scenes/world.js');
  assert.match(W, /return \{ \.\.\.h, keep: harbourKeep\(t\.loc, h\.rect\) \};/);   // PIN MOVED (the fourth merge of main - RPT1026-WORLD FAR-QUAY): each port town near, its harbour harbourBook.js harbourOf's
  assert.match(W, /const harbourBook = createHarbourBook\(\{\n\s+harbourNear: navalHarbourNear,\n\s+isWater: navalIsWater,\n\s+ground: \(x, z\) => surfaceAt\(x, z\) - tvSeaY\(\),/);
  const book = readFileSync(new URL('../../../src/systems/naval/harbourBook.js', import.meta.url), 'utf8');
  assert.match(book, /findHarbour\(\{\n\s*rect: near\.rect,\n\s*isWater: \(x, z, h\) => deps\.isWater\(x, z, h\),\n\s*reach,\n\s*square,\n\s*keep: near\.keep \?\? null,\n\s*ground: deps\.ground \?\? null,\n\s*\}\)/);   // PIN MOVED (ALDBRUGH-QUAY): and the square reach
});
