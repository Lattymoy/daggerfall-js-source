// IC-PROPS (2026-10-27, the owner: "Random placements on the wagon/other vendors all over the Imperial city", then "the
// issues I mentioned for the imperial city for stables/doors/etc are a world wide issue. They have no logical
// placements"; bible/03-World/Merchant-Yards.md IC-PROPS) - EACH YARD WHERE ITS KIND BELONGS, ON THE TOWN'S OWN GROUND:
// never on a way, past the town or in a house's garden while the town has room elsewhere; its gate onto a way; the Stable
// at the town's edge by the road out, the Wagon Yard and the joinery on a street's side nearest the middle; and the
// Imperial City - one town over 625 slices - its own yards at its gates, none on any slice by the law
// (world/merchantYards/merchantYardSites.js yardLaw, yardSite; world/imperialYards.js; world/merchantYards/townYards.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  YARD_FRONT_COST, EDGE_LAND_CELLS, YARD_LAW_STEPS, FRONT_ROAD_CELLS, YARD_GAP_M, yardSite, yardSitesOn, craftYardSitesOn, townGroundOf, exitField, frontStrip,
} from '../../src/world/merchantYards/merchantYardSites.js';
import { FABRIC, FABRIC_KIND, isPortCell } from '../../src/world/urban/townFabric.js';
import { NAV_CELL } from '../../src/world/city/cityNavigation.js';
import {
  IMPERIAL_YARD_GATES, IMPERIAL_YARD_LANE, IMPERIAL_YARD_WALL, IMPERIAL_YARD_REACH, imperialYardSites, imperialSliceYards,
} from '../../src/world/imperialYards.js';
import { IMPERIAL, IMPERIAL_SECTORS, IMPERIAL_SPAN, polar, imperialLand, imperialDistrictAt } from '../../src/world/imperialCity.js';
import { CAPITALS, portBlockJson, startMarkerAt, miscModelAt } from '../../src/world/tamrielCapitals.js';
import { imperialBlockJson, imperialOwnName } from '../../src/world/imperialBlocks.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { collectBlockFlats } from '../../src/world/rmbFlats.js';
import { CityNavigation } from '../../src/world/city/cityNavigation.js';
import { yardGround } from '../../src/world/merchantYards/merchantYardSites.js';
import { townYardsOf } from '../../src/world/merchantYards/townYards.js';
import { hostText } from '../hostText.mjs';

const C = 64;
/** A block of a laid-out town: its name, its town map (`house(ax, ay)`: a building's byte there) and its ground tiles
 *  (`tile(tx, ty)`: a record - 2 grass, 1 dirt, 46 road), in the block's own frame (CityNavigation.setBlockData's). */
function block(x, y, name, { house = () => false, tile = () => 1 } = {}) {
  const auto = new Uint8Array(C * C);
  for (let ay = 0; ay < C; ay++) for (let ax = 0; ax < C; ax++) if (house(ax, ay)) auto[ay * C + ax] = 18;   // House2's byte
  const groundTiles = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: tile(tx, ty) })));
  return { x, y, blockName: name, dfBlock: { name, rmbBlock: { fldHeader: { autoMapData: auto, groundData: { groundTiles } } } } };
}
/** A walk grid's cell (x east, y north) of a block-frame cell (ax, ay): the grid's own flip. */
const gridCell = (b, ax, ay) => [b.x * C + ax, b.y * C + (C - 1 - ay)];
const cellsOf = (s) => { const out = []; for (let gy = s.gy; gy < s.gy + s.nz; gy++) for (let gx = s.gx; gx < s.gx + s.nx; gx++) out.push([gx, gy]); return out; };
const mid = (s) => [s.gx + s.nx / 2, s.gy + s.nz / 2];

test('IC-PROPS NO YARD ON A WAY, AND ITS GATE ONTO ONE - where the town\'s plan lays a main street the yards\' law shuts it to every yard\'s own ground and opens a front onto it; the Wagon Yard and the joinery beside it nearest the middle, the Stable at the town\'s edge where the street leaves it (mutants: the plan\'s streets unread; a front onto nothing as good as one onto the street; the Stable nearest the middle)', () => {
  // one block of open dirt; the plan's main street across it, grid rows 30-33, with its pavements a row either side
  const b = block(0, 0, 'RESIAM00.RMB');
  const kind = new Uint8Array(C * C).fill(FABRIC_KIND.open);
  for (let x = 0; x < C; x++) { for (let y = 30; y <= 33; y++) kind[y * C + x] = FABRIC_KIND.main; kind[29 * C + x] = FABRIC_KIND.pave; kind[34 * C + x] = FABRIC_KIND.pave; }
  const loc = { width: 1, height: 1, blocks: [b] };
  const g = townGroundOf(loc, {}, null, { plan: { W: C, H: C, kind }, fixed: null });
  for (let y = 29; y <= 34; y++) assert.equal(g.shut[y * C + 10], 1, `row ${y} the street's - shut`);
  assert.equal(g.street[31 * C + 10], 1, 'a way a yard opens onto');
  const sites = [...yardSitesOn(g), ...craftYardSitesOn(g)];
  assert.deepEqual(sites.map((s) => s.kind), ['stable', 'transport', 'carpenter']);
  for (const s of sites) {
    for (const [, gy] of cellsOf(s)) assert.ok(gy < 29 || gy > 34, `${s.kind} off the street`);
    const f = frontStrip(s.gx, s.gy, s.nx, s.nz, s.turn);
    let way = 0;
    for (let gy = Math.max(0, f[1]); gy < Math.min(C, f[3]); gy++) for (let gx = Math.max(0, f[0]); gx < Math.min(C, f[2]); gx++) way += g.street[gy * C + gx];
    assert.ok(way > 0, `${s.kind}'s gate onto the street`);
  }
  const [stable, wagons, joinery] = sites;
  assert.ok(Math.min(stable.gx, C - stable.gx - stable.nx) <= 1, `the Stable at the town's edge by the street's end (${stable.gx})`);
  assert.ok(Math.abs(mid(wagons)[0] - C / 2) < Math.abs(mid(stable)[0] - C / 2), 'the Wagon Yard nearer the middle than the Stable');
  assert.ok(Math.abs(mid(joinery)[0] - C / 2) < C / 2 - joinery.nx, 'the joinery off the edge');
  assert.ok(YARD_FRONT_COST >= C * C, 'a front onto a way outweighs any distance across a town');
  // the exits' field: nought on the street at the town's edge, rising inward
  const toExit = exitField(g);
  assert.equal(toExit[31 * C + 0], 0);
  assert.ok(toExit[31 * C + 32] > toExit[31 * C + 8]);
});

test('IC-PROPS NO YARD IN A HOUSE\'S GARDEN while the town has room elsewhere - a piece of open grass a house backs onto (URBANIZER\'s FABRIC.yard law) is the law\'s last step, and a town with nothing else stands its yard there still (YARD_LAW_STEPS) (mutants: the garden unread; no last step)', () => {
  // a house at cells 20-27 of the block's x, 16-47 of its y; its garden of grass east of it, 28-43 by 16-47, over the
  // middle; open dirt round both
  const garden = (ax, ay) => ax >= 28 && ax < 44 && ay >= 16 && ay < 48;
  const b = block(0, 0, 'RESIAM00.RMB', { house: (ax, ay) => ax >= 20 && ax < 28 && ay >= 16 && ay < 48, tile: (tx, ty) => (garden(tx * 4, ty * 4) ? 2 : 1) });
  const g = townGroundOf({ width: 1, height: 1, blocks: [b] });
  const [gx, gy] = gridCell(b, 32, 30);
  assert.equal(g.garden[gy * C + gx], 1, 'the grass behind the house a garden');
  let n = 0; for (const v of g.garden) n += v;
  assert.equal(n, 16 * 32);
  assert.ok(n >= FABRIC.yard[0] && n <= FABRIC.yard[1]);
  const sites = yardSitesOn(g);
  assert.equal(sites.length, 2);
  for (const s of sites) for (const [x, y] of cellsOf(s)) assert.equal(g.garden[y * C + x], 0, `${s.kind} out of the garden`);
  // the whole block a garden but for its house: the last step stands the yards in it rather than none
  const all = block(0, 0, 'RESIAM00.RMB', { house: (ax, ay) => ax >= 20 && ax < 28 && ay >= 16 && ay < 48, tile: () => 2 });
  const shut = (nav) => { for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (x < 14 || x > 44 || y < 10 || y > 54) nav.grid[y * C + x] = 0; };
  const g2 = townGroundOf({ width: 1, height: 1, blocks: [all] }, {}, shut);
  assert.ok(g2.garden.some(Boolean), 'the grass left a garden');
  assert.deepEqual(yardSitesOn(g2).map((s) => s.kind), ['stable', 'transport'], 'stood in the garden, the town\'s only ground');
  assert.deepEqual(YARD_LAW_STEPS.at(-1), { edge: true, garden: true, square: true });
});

test('IC-PROPS NEVER PAST THE TOWN, BUT BY ITS EDGE - the open land a town\'s outline leaves (TESAOPEN, its wall\'s carrier) is the yards\' only within EDGE_LAND_CELLS of the town\'s own blocks, a port\'s garden or lake none of theirs; the Stable takes the edge land, the Wagon Yard only when the town has no room inside (mutants: every outline cell the town\'s; the edge land unbounded)', () => {
  // the town's block wholly built but for a lane along its east side too narrow for a yard; the outline's open block east
  // of it, a garden's block of the capital's past that
  const town = block(0, 0, 'RESIAM00.RMB', { house: (ax) => ax < 56 });
  const open = block(1, 0, 'TESAOPEN.RMB'), park = block(2, 0, 'TESG0001.RMB');
  const g = townGroundOf({ width: 3, height: 1, blocks: [town, open, park] });
  const W = 3 * C;
  assert.ok(isPortCell('TESAOPEN.RMB') && isPortCell('TESG0001.RMB') && !isPortCell('RESIAM00.RMB'));
  for (const x of [C, C + EDGE_LAND_CELLS - 1]) assert.equal(g.edgeLand[10 * W + x], 1, `${x} within reach of the town`);
  assert.equal(g.edgeLand[10 * W + C + EDGE_LAND_CELLS + 2], 0, 'past EDGE_LAND_CELLS none');
  for (const x of [C + EDGE_LAND_CELLS + 2, 2 * C + 5]) assert.equal(g.shut[10 * W + x], 1, `${x} shut to the yards`);
  const sites = yardSitesOn(g);
  assert.deepEqual(sites.map((s) => s.kind), ['stable', 'transport']);
  for (const s of sites) {
    for (const [x] of cellsOf(s)) assert.ok(x > 56 && x < C + EDGE_LAND_CELLS, `${s.kind} within the edge land's reach`);
    assert.ok(s.gx + s.nx > C, `${s.kind} on the edge land - the town's lane too narrow`);
  }
});

test('IC-PROPS A CAPITAL THAT NAMES ITS OWN - a ground handed `fixed` sites stands those and no other, none over ground closed since; the Imperial City\'s slices hand theirs (townYardsOf), every other town none, and the world host hands the town\'s ways and yards to the one ground its yards and its port are placed on (mutants: the law placing on a capital\'s slice; a fixed site over a closed cell)', () => {
  const b = block(0, 0, 'TESAI0001.RMB');
  const at = { kind: 'stable', gx: 10, gy: 10, nx: 9, nz: 7, turn: 0 };
  const g = townGroundOf({ width: 1, height: 1, blocks: [b] }, {}, null, { plan: null, fixed: [at] });
  const sites = [...yardSitesOn(g), ...craftYardSitesOn(g)];
  assert.deepEqual(sites.map((s) => [s.kind, s.gx, s.gy, s.nx, s.nz, s.turn]), [['stable', 10, 10, 9, 7, 0]], 'its own, and no Wagon Yard or joinery by the law');
  assert.deepEqual([sites[0].x, sites[0].z], [(10 + 4.5) * NAV_CELL, (10 + 3.5) * NAV_CELL]);
  const none = townGroundOf({ width: 1, height: 1, blocks: [b] }, {}, null, { plan: null, fixed: [] });
  assert.deepEqual(yardSitesOn(none), [], 'a slice the city names none for stands none');
  const shut = (nav) => { nav.grid[12 * C + 12] = 0; };
  assert.deepEqual(yardSitesOn(townGroundOf({ width: 1, height: 1, blocks: [b] }, {}, shut, { plan: null, fixed: [at] })), [], 'never over a closed cell');
  // the Imperial City's slices: their share of the gates' yards; a town of the Bay none
  const IC = CAPITALS.findIndex((c) => c.family);
  const s = imperialYardSites()[0].s;
  assert.deepEqual(townYardsOf({ capital: { k: IC, s } }).fixed, imperialSliceYards(s));
  assert.equal(townYardsOf({ name: 'Daggerfall', mapTableData: { mapId: 1 } }).fixed, null);
  assert.match(hostText('src/scenes/world.js'), /const g = townGroundOf\(yl, measures, shut, townYardsOf\(dfLocation\)\);/);
});

test('IC-PROPS THE IMPERIAL CITY\'S YARDS AT ITS GATES - a Stable, a Wagon Yard and a joinery outside each district\'s avenue gate in the city wall: on City Isle\'s own land past the wall\'s towers, off the way out, within IMPERIAL_YARD_REACH of the gate, each wholly in one slice, the Stable nearest, none on another (mutants: the way out unread; the wall\'s reach unread; the kinds placed over one another)', () => {
  const all = imperialYardSites();
  assert.deepEqual([...IMPERIAL_YARD_GATES], IMPERIAL_SECTORS.map(([, b]) => b + 30));
  assert.equal(all.length, 3 * IMPERIAL_YARD_GATES.length, `${all.length} yards`);
  for (const b of IMPERIAL_YARD_GATES) {
    const at = all.filter((t) => t.gate === b);
    assert.deepEqual(at.map((t) => t.kind), ['stable', 'transport', 'carpenter'], `gate ${b}`);
    const foot = polar(b, IMPERIAL_YARD_WALL), [ux, uz] = polar(b, 1);
    const d = at.map((t) => Math.hypot(t.at[0] - foot[0], t.at[1] - foot[1]));
    assert.ok(d[0] <= d[1] && d[0] <= d[2], `gate ${b}: the Stable nearest`);
    for (const [k, t] of at.entries()) {
      assert.ok(d[k] <= IMPERIAL_YARD_REACH + 12, `gate ${b} ${t.kind} within reach (${d[k].toFixed(0)} m)`);
      // its corners: on the isle's land past the wall, off the way's lane
      const S = 8 * 102.4, sx = t.s % IMPERIAL_SPAN, sy = Math.floor(t.s / IMPERIAL_SPAN), ox = sx * S - IMPERIAL_SPAN * S / 2, oz = (sy + 1) * S - IMPERIAL_SPAN * S / 2;
      for (const [cx, cz] of [[t.gx, t.gy], [t.gx + t.nx - 1, t.gy], [t.gx, t.gy + t.nz - 1], [t.gx + t.nx - 1, t.gy + t.nz - 1]]) {
        const x = ox + (cx + 0.5) * NAV_CELL, z = oz - (cz + 0.5) * NAV_CELL;   // its corner cells' middles
        assert.ok(Math.hypot(x, z) >= IMPERIAL_YARD_WALL - 1, `gate ${b} ${t.kind} past the wall`);
        assert.ok(imperialLand(x, z) && imperialDistrictAt(x, z) === 'City Isle', `gate ${b} ${t.kind} on the isle`);
        const across = Math.abs((x - foot[0]) * -uz + (z - foot[1]) * ux), along = (x - foot[0]) * ux + (z - foot[1]) * uz;
        assert.ok(along <= -IMPERIAL_YARD_LANE || across >= IMPERIAL_YARD_LANE - 0.01, `gate ${b} ${t.kind} off the way`);
      }
    }
    // apart: YARD_GAP_M between any two
    const gap = Math.ceil(YARD_GAP_M / NAV_CELL - 1e-9);
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
      const p = at[i], q = at[j];
      if (p.s !== q.s) continue;
      assert.ok(q.gx >= p.gx + p.nx + gap || p.gx >= q.gx + q.nx + gap || q.gy >= p.gy + p.nz + gap || p.gy >= q.gy + q.nz + gap, `gate ${b}: ${p.kind} and ${q.kind} apart`);
    }
  }
  // each slice its share, and the centre (the palace's) none
  for (const t of all) assert.ok(imperialSliceYards(t.s).includes(t));
  assert.deepEqual(imperialSliceYards((IMPERIAL_SPAN * IMPERIAL_SPAN - 1) / 2), []);
  assert.ok(IMPERIAL.cityWall.r < IMPERIAL_YARD_WALL && FRONT_ROAD_CELLS > 0);
});

test('IC-PROPS THE GATE YARDS ON THE GROUND THEIR BLOCKS BUILD - each of the eighteen\'s cells open on its slice\'s own blocks as the host measures them (their automap and tiles - the walkers\' grid - and every flat\'s foot, the isle\'s trees at their tiles\' corners as Daggerfall stands them), so the yards\' law stands every one (merchantYardSites.js fixedSite stands none over a closed cell: the Elven Gardens\' Wagon Yard did not, under a tree read a tile off) (mutant: the trees read at their tiles\' middles)', () => {
  const DEPS = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: [], noGround: 255, rim: () => false };
  for (const t of imperialYardSites()) {
    const sx = t.s % IMPERIAL_SPAN, sy = Math.floor(t.s / IMPERIAL_SPAN);
    // the slice's blocks under the yard and a block round it, as layoutLocation lays them (x east, y north)
    const bx0 = Math.max(0, Math.floor(t.gx / 64) - 1), bx1 = Math.min(7, Math.floor((t.gx + t.nx) / 64) + 1);
    const by0 = Math.max(0, Math.floor(t.gy / 64) - 1), by1 = Math.min(7, Math.floor((t.gy + t.nz) / 64) + 1);
    const nav = new CityNavigation(8, 8), blocks = [];
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      const r = sy * 8 + (7 - by), c = sx * 8 + bx, json = imperialBlockJson(imperialOwnName(r, c), DEPS);
      if (!json) continue;
      const dfBlock = blockFromJson(json, 0), fld = dfBlock.rmbBlock.fldHeader, tiles = fld.groundData.groundTiles;
      nav.setBlockData(bx, by, fld.autoMapData, (tx, ty) => tiles[tx][ty].textureRecord, { enhancedWater: true });
      blocks.push({ bx, by, dfBlock });
    }
    const flats = blocks.flatMap(({ bx, by, dfBlock }) => collectBlockFlats(dfBlock, 0).map((f) => [bx * 102.4 + f.x, by * 102.4 + f.z]));
    const g = yardGround(nav, { flats });
    for (const [x, y] of cellsOf(t)) assert.equal(g.blocked[y * g.width + x], 0, `gate ${t.gate} ${t.kind}: its cell ${x},${y} open on its blocks' ground`);
  }
});
