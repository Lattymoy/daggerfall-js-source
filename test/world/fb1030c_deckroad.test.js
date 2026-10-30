// FIELD BUGS 2026-10-30c DECK-ROAD (bible/01-Overview/bugs/Field-Bugs-2026-10-30c.md): "it's clearly not on the road,
// it's still on the balcony of the house" - a piece on a house's deck was refused where the town's road tiles run under
// the house. The road is the ground's: a piece on its house's deck meets it only past the house's own ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as homeYards from '../../src/scenes/homeYards.js';
import { localAabb, transformedAabb } from '../../src/render/frustum.js';
import { trs, multiply } from '../../src/world/mat4.js';
import { layoutLocation } from '../../src/world/locationLayout.js';
import { setLocationTiles, getLocationTerrainTileOrigin } from '../../src/world/terrain/terrainTiles.js';
import { convertTilemap, TERRAIN_TILE_DIM } from '../../src/world/terrain/terrainSurface.js';
import { RMB_TILE_SIDE } from '../../src/world/locationEntrance.js';
import * as capitals from '../../src/world/tamrielCapitals.js';
import { skipReal, game } from '../lwRealTown.mjs';

const { modelFootParts, footRectsAt, footGroundAt, yardLot, yardWhyNot, yardRoadsOf, YARD_MARGIN, YARD_ON_ROAD, YARD_IN_HOUSE } = homeYards;

/** Upright quads `walls` ([x0, z0, x1, z1, y0, y1]) and flat quads `flats` ([x0, z0, x1, z1, y]) facing up - as
 *  test/world/fb1030_yarddeck.test.js builds them. */
function model(walls, flats) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (const [x0, z0, x1, z1, y0, y1] of walls) quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
  for (const [x0, z0, x1, z1, y] of flats) quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}
const ring = ([x0, z0, x1, z1], y0, y1) => [[x0, z0, x1, z0, y0, y1], [x1, z0, x1, z1, y0, y1], [x1, z1, x0, z1, y0, y1], [x0, z1, x0, z0, y0, y1]];
const CHAIR = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]];
/** A lot as pixelBuild.js frames a home: models placed by `places` (one each), the frame `at`. */
function lotOf(models, places, at) {
  const boxes = models.map((q, i) => transformedAabb(localAabb(q.positions), places[i]));
  const box = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i]))));
  const rects = models.flatMap((q, i) => footRectsAt(homeYards.modelFootRects(q.positions, q.indices), places[i]));
  const grounds = models.map((q, i) => footGroundAt(modelFootParts(q.positions, q.indices), places[i]));
  return yardLot(at, box, YARD_MARGIN, rects, { grounds });
}

test('DECK-ROAD a piece on its house\'s deck over the road stands on the house; on the ground, raised beside the house, hanging past the deck\'s edge or hung on the wall under the deck, the road is the road (mutants: the deck unread; every height a deck\'s; the whole piece let off; the deck it stands on alone the house\'s)', () => {
  // a 10 x 10 ground floor 3.22 high; its west half's roof a deck inside a parapet, its east a storey to 6.45 under a
  // pitched roof (no deck), its wall on a cell's side; two road squares across its south, under the house and past it
  const house = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([0.2, -5, 5, 5], 3.22, 6.45), [-5, -5, -5, 5, 3.22, 4.02]], [[-5, -5, 0.2, 5, 3.22]]);
  const P = Array.from(house.positions), I = Array.from(house.indices), n = P.length / 3;
  P.push(0.2, 6.45, -5, 0.2, 6.45, 5, 5, 8, 5, 5, 8, -5); I.push(n, n + 1, n + 2, n, n + 2, n + 3);
  const lot = lotOf([{ positions: new Float32Array(P), indices: new Uint32Array(I) }], [trs(0, 0, 0, 0, 0, 0)], [0, 0, 0]);
  const roads = [[-8, -9, -1.6, -2.6], [-1.6, -9, 4.8, -2.6]];
  assert.ok(roads.every((r) => r[2] - r[0] === RMB_TILE_SIDE), 'a road tile\'s side');
  assert.equal(yardWhyNot([-3.3, 3.22, -3.8], lot, [], CHAIR, roads), null, 'a chair on the deck over the road');
  assert.equal(yardWhyNot([-3.3, 3.22, 0], lot, [], CHAIR, roads), null, 'and off it');
  assert.equal(yardWhyNot([-0.05, 3.22, -3.8], lot, [], CHAIR, roads), null, 'sat into the storey\'s wall by the clip');
  assert.equal(yardWhyNot([0, 3.22, -3.8], lot, [], CHAIR, roads), YARD_IN_HOUSE, 'past it');
  assert.equal(yardWhyNot([-3.3, 0, -3.8], lot, [], CHAIR, roads), YARD_IN_HOUSE, 'under the deck');
  assert.equal(yardWhyNot([-6.5, 0, -3.8], lot, [], CHAIR, roads), YARD_ON_ROAD, 'the road beside the house');
  assert.equal(yardWhyNot([-6.5, 3.22, -3.8], lot, [], CHAIR, roads), YARD_ON_ROAD, 'raised over it to the deck\'s height');
  assert.equal(yardWhyNot([-5.1, 3.22, -3.8], lot, [], CHAIR, roads), YARD_ON_ROAD, 'on the deck, hanging past its edge');
  assert.equal(yardWhyNot([-5.1, 3.22, 0], lot, [], CHAIR, roads), null, 'hanging past it off the road');
  assert.equal(yardWhyNot([-4.98, 1.5, -3.8], lot, [], [], roads), YARD_ON_ROAD, 'a lamp hung on the wall under the deck');
  assert.equal(yardWhyNot([-4.98, 1.5, 0], lot, [], [], roads), null, 'and off the road');
  // a lot with no parts known (its box) knows no deck: the road stands as it did
  const boxed = { house: [-5, -5, 5, 5], walls: [[-5, -5, 5, 5]], lot: [-11, -11, 11, 11], y: 0 };
  assert.equal(yardWhyNot([-5.5, 3.22, -3.8], boxed, [], CHAIR, roads), YARD_ON_ROAD, 'no parts: the road');
});

/** A home of a laid-out town as pixelBuild.js frames it (its block and record), its lot, and the road under the lot from
 *  the town's own tilemap as the terrain converts it (yardRoadsOf, the producer). */
function townHome(loc, blockName, record) {
  const { maps, blocks, modelOf } = game();
  const lay = layoutLocation(loc, maps, blocks, { enhanced: true });
  const tm = new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM);
  setLocationTiles(loc, maps, blocks, tm);
  const tilePos = getLocationTerrainTileOrigin(loc), S = RMB_TILE_SIDE;
  const b = lay.blocks.find((q) => q.blockName === blockName);
  assert.ok(b, `${loc.name}: ${blockName} laid`);
  const mine = b.layout.models.filter((q) => q.recordIndex === record);
  const origin = trs(tilePos.x * S + b.originX, 0, tilePos.y * S + b.originZ, 0, 0, 0);
  const at = [tilePos.x * S + b.originX + mine[0].recordAt[0], mine[0].recordAt[1], tilePos.y * S + b.originZ + mine[0].recordAt[2]];
  const ms = mine.map((q) => modelOf(q.modelIdNum)), places = mine.map((q) => multiply(origin, q.matrix));
  const lot = lotOf(ms, places, at);
  return { ids: mine.map((q) => q.modelIdNum), lot, roads: yardRoadsOf({ tilemapBytes: convertTilemap(tm) }, at, lot) };
}
/** The deck's cells over the road, and a cell of it past the house's edge. */
function deckOverRoad({ lot, roads }) {
  const deck = lot.grounds.flatMap((g) => g.decks).find((d) => d[4] < 4 && roads.some((r) => r[0] < d[2] && r[2] > d[0] && r[1] < d[3] && r[3] > d[1]));
  assert.ok(deck, 'a deck over the road');
  const r = roads.find((q) => q[0] < deck[2] && q[2] > deck[0] && q[1] < deck[3] && q[3] > deck[1]);
  const x = (Math.max(deck[0], r[0]) + Math.min(deck[2], r[2])) / 2, z = (Math.max(deck[1], r[1]) + Math.min(deck[3], r[3])) / 2;
  return { deck, x, z };
}

test('DECK-ROAD on the game\'s own houses: Newcester\'s house in ALCHAL00 (record 3, ARCH3D 419), the report\'s town, and past the Bay Solitude\'s in BANKBL00 (record 0, ARCH3D 560) - a chair on the deck over the road stands; the road beside the house and a chair hanging past the deck\'s edge over it do not', { skip: skipReal }, () => {
  const { maps, blocks } = game();
  const newcester = maps.getLocationByName('Daggerfall', 'Newcester');
  assert.ok(newcester, 'Newcester');
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    let count = 0;
    try { count = maps.baseLocationCount(r); } catch { continue; }
    for (let i = 0; i < count; i++) { try { const l = maps.getLocation(r, i); if (l) rows.push(l); } catch { /* none */ } }
  }
  const k = capitals.CAPITALS.findIndex((c) => c.name === 'Solitude');
  const solitude = capitals.synthesizeCapitalLocation({ cap: capitals.CAPITALS[k], k, s: 0 }, { base: capitals.capitalBase(rows), names: capitals.cityBlockNames(rows), blockOf: (n) => blocks.getBlockByName(n) ?? null, px: 1000, py: 1000 });
  for (const [loc, blockName, record, id] of [[newcester, 'ALCHAL00.RMB', 3, 419], [solitude, 'BANKBL00.RMB', 0, 560]]) {
    const home = townHome(loc, blockName, record);
    assert.deepEqual(home.ids, [id], `${loc.name}: the house`);
    const { deck, x, z } = deckOverRoad(home);
    assert.equal(yardWhyNot([x, deck[4], z], home.lot, [], CHAIR, home.roads), null, `${loc.name}: a chair on the deck over the road`);
    // past the house's edge nearest that spot, on the road
    const h = home.lot.house, gaps = [x - h[0], h[2] - x, z - h[1], h[3] - z], side = gaps.indexOf(Math.min(...gaps));
    const past = (d) => (side === 0 ? [h[0] - d, z] : side === 1 ? [h[2] + d, z] : side === 2 ? [x, h[1] - d] : [x, h[3] + d]);
    const [ex, ez] = past(0.1), [gx, gz] = past(1);
    assert.ok(home.roads.some((r) => gx > r[0] && gx < r[2] && gz > r[1] && gz < r[3]), `${loc.name}: the road past the house`);
    assert.equal(yardWhyNot([gx, 0, gz], home.lot, [], CHAIR, home.roads), YARD_ON_ROAD, `${loc.name}: the road beside the house`);
    assert.equal(yardWhyNot([ex, deck[4], ez], home.lot, [], CHAIR, home.roads), YARD_ON_ROAD, `${loc.name}: hanging past the deck's edge`);
  }
});
