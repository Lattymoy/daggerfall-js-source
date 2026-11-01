// THE GROUND UNDER A SETTLEMENT AND WHERE ONE STANDS - the carve
// never stands a vertex over the paving of any cut pad near it, so the 6.4 m grid never pokes through a terrace, and leaves
// the land its own past the ease; a raised pad leaves the land alone. The published settlements, one a province past the
// Bay, each found on its pixel in its own lane of map ids; the kernel lays one out on a pixel no location holds, and a
// record written before PADS_FRAME_LAW rides the carve. Pins mutation-checked (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settlementGroundAt, carveSettlementGround, PAD_CLEAR, PAD_REACH, GROUND_EASE } from '../../../src/world/settlement/settlementGround.js';
import { generateSettlement } from '../../../src/world/settlement/settlementGen.js';
import { padAt } from '../../../src/world/settlement/settlementGeometry.js';
import { SETTLEMENT_ROWS, SETTLEMENT_LANE, settlementPlaceId, isSettlementPlaceId, settlementOnPixel, settlementPixel, settlementPlaceRows } from '../../../src/world/settlement/settlementPlaces.js';
import { standSettlementGround, SAMPLE_M } from '../../../src/world/settlement/settlementStand.js';
import { settlementMovedField, createLandforms } from '../../../src/world/landforms.js';
import { MINTED_KEY_MIN } from '../../../src/world/settlement/settlementContract.js';
import { THEATRE_KEYS, theatreAt } from '../../../src/world/worldWide/worldGrid.js';
import { isMadePlaceId } from '../../../src/world/placeIds.js';
import { isWorldRoom } from '../../../src/net/wire.js';
import { inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { CAPITAL_LANE } from '../../../src/world/capitalLane.js';
import { COUNTRY_LANE, LAIR_LANE } from '../../../src/world/tamrielCountry.js';
import { recordFrame } from '../../../src/scenes/groundFrameHost.js';
import { GROUND_FRAME_LAW, PADS_FRAME_LAW, HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE, MAX_TERRAIN_HEIGHT } from '../../../src/world/terrain/terrainSampler.js';
import { generatePixelTerrain } from '../../../src/world/terrain/terrainGen.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { groundWoods } from '../../../src/world/tamriel/tamrielGround.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';
import { syntheticWoodsBytes } from '../../landformWorld.mjs';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const PADS = [{ id: 'low', poly: sq(0, 0, 40, 40), y: 0, base: 'cut' }, { id: 'high', poly: sq(40, 0, 80, 40), y: 3, base: 'cut' }, { id: 'deck', poly: sq(100, 0, 120, 20), y: 5, base: 'raised' }];

test('RMBC3 the carve at a point: on a pad its paving less the clearance; beside a higher terrace the lower\'s; past the ease the land\'s; a deck the land\'s (mutants: the reach, the minimum, the ease, the deck)', () => {
  assert.equal(settlementGroundAt(PADS, 100, 20, 20, 140), 100 - PAD_CLEAR);
  assert.equal(settlementGroundAt(PADS, 100, 60, 20, 140), 103 - PAD_CLEAR);
  assert.equal(settlementGroundAt(PADS, 100, 42, 20, 140), 100 - PAD_CLEAR, 'on the higher terrace but within a cell of the lower: the lower\'s, so no triangle stands over it');
  assert.equal(settlementGroundAt(PADS, 100, 110, 10, 140), null, 'under a deck the land stands as it was');
  assert.equal(settlementGroundAt(PADS, 100, 20, 40 + PAD_REACH + GROUND_EASE + 1, 140), null);
  const mid = settlementGroundAt(PADS, 100, 20, 40 + PAD_REACH + GROUND_EASE / 2, 140);
  assert.ok(mid > 100 && mid < 140, `the ease between the carve and the land (${mid})`);
  assert.ok(settlementGroundAt(PADS, 100, 20, 40 + PAD_REACH + 1, 140) < mid, 'nearer the pad, nearer its carve');
});

test('RMBC3 the carve on a pixel: no vertex near a cut pad stands over its paving, so the drawn ground never pokes through; the land past the ease untouched (mutants: the reach, the clearance)', () => {
  const env = SYNTHETIC.fort, { plan, report } = generateSettlement({ place: settlementPlaceId(0), origin: { px: 1, py: 1, east: 0, north: 0 }, seed: 1, archetype: 'fort', style: 'HighRock', site: { east: 409.6, north: 409.6, radius: 90 }, env: { heightAt: (e, n) => env.heightAt(e - 9.6, n - 9.6) } });
  const D = HEIGHTMAP_DIMENSION, S = new Float64Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) S[x * D + y] = env.heightAt(x * SAMPLE_M - 9.6, y * SAMPLE_M - 9.6);
  const natural = Float64Array.from(S);
  assert.ok(carveSettlementGround(S, D, SAMPLE_M, { pads: plan.pads, origin: plan.origin }, report.datum) > 500);
  const cut = plan.pads.filter((p) => p.base === 'cut');
  // the drawn ground at points on the pads, across each quad's two triangles (terrainSurface.js's split)
  const drawn = (e, n) => {
    const lx = e / SAMPLE_M, ly = n / SAMPLE_M, ix = Math.floor(lx), iy = Math.floor(ly), fx = lx - ix, fy = ly - iy;
    const f = (a, b) => S[a * D + b], f00 = f(ix, iy), f11 = f(ix + 1, iy + 1);
    return fy >= fx ? f00 + fy * (f(ix, iy + 1) - f00) + fx * (f11 - f(ix, iy + 1)) : f00 + fx * (f(ix + 1, iy) - f00) + fy * (f11 - f(ix + 1, iy));
  };
  let checked = 0;
  for (let e = 250; e < 570; e += 1.7) for (let n = 250; n < 570; n += 1.9) {
    const pad = padAt(cut, [e, n]);
    if (!pad) continue;
    checked++;
    assert.ok(drawn(e, n) <= report.datum + pad.y - PAD_CLEAR + 1e-9, `${pad.id} at ${e},${n}`);
  }
  assert.ok(checked > 5000);
  assert.equal(S[0], natural[0], 'the pixel\'s corner, far past the town, its own');
  assert.equal(S[D * D - 1], natural[D * D - 1]);
});

test('RMBC5 the settlements\' lane: past the capitals\', a made place\'s, the relay\'s rooms take it, its ordinal read back (mutants: the lane, the flag)', () => {
  assert.equal(SETTLEMENT_LANE, 0x342);
  assert.ok(SETTLEMENT_LANE > CAPITAL_LANE && CAPITAL_LANE > LAIR_LANE && LAIR_LANE > COUNTRY_LANE);
  for (const o of [0, 8, 0x7ffff]) {
    const id = settlementPlaceId(o);
    assert.ok(isSettlementPlaceId(id) && isMadePlaceId(id) && id < 2 ** 31, `${o}`);
    assert.equal(id & 0x7ffff, o);
    assert.ok(isWorldRoom(`interior:m${id}.${MINTED_KEY_MIN}`));
  }
  assert.equal(isSettlementPlaceId(((CAPITAL_LANE << 20) | 0x80000) >>> 0), false);
  assert.equal(isSettlementPlaceId((SETTLEMENT_LANE << 20) >>> 0), false, 'the made-place flag is part of the lane');
});

test('RMBC5 the published settlements: one in each province past the Bay, inputs alone, each on its pixel and none on the Bay (TAMRIEL-WIDE; mutants: the pixel lookup, the Bay\'s guard)', () => {
  setTamrielFit(null);
  assert.deepEqual(SETTLEMENT_ROWS.map((r) => r.province).sort(), THEATRE_KEYS.slice(1).sort(), 'every province, the Bay\'s ground left to DFU\'s places');
  assert.deepEqual(SETTLEMENT_ROWS.map((r) => r.ordinal), SETTLEMENT_ROWS.map((_, i) => i));
  const json = readFileSync(new URL('../../../src/world/settlement/settlements.json', import.meta.url), 'utf8');
  assert.doesNotMatch(json, /"(y|datum|pads|natural|heights?)"/, 'nothing of the player\'s ground is published');
  for (const row of SETTLEMENT_ROWS) {
    const [px, py] = settlementPixel(row);
    assert.equal(settlementOnPixel(px, py), row, row.name);
    assert.equal(settlementOnPixel(px + 1, py), null);
    assert.ok(Object.keys(row.ledger.keys).length > 5 && row.ledger.next > MINTED_KEY_MIN, `${row.name}'s ledger`);
  }
  assert.deepEqual(settlementPlaceRows().map((r) => r.mapId), SETTLEMENT_ROWS.map((r) => settlementPlaceId(r.ordinal)));
  const r0 = SETTLEMENT_ROWS[0];   // a fit that sets the first settlement's point on the Bay's pixel 500,250: none stands there
  setTamrielFit({ ox: r0.at[0] * 18.75 - 500.5, oy: r0.at[1] * 18.75 - 250.5, ppu: 18.75 });
  assert.deepEqual(settlementPixel(r0), [500, 250]);
  assert.equal(settlementOnPixel(500, 250), null);
  assert.ok(!settlementPlaceRows().some((r) => r.mapId === settlementPlaceId(r0.ordinal)), 'nor on the registry');
  setTamrielFit(null);
});

test('RMBC3 the kernel lays out a pixel\'s settlement and carves it; a location on the pixel wins (mutants: the stand unasked, the location\'s guard)', () => {
  setTamrielFit(null);
  const w = new WoodsFile(); w.load(syntheticWoodsBytes());
  const woods = groundWoods(w), row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row);
  assert.ok(!inBay(px, py) && theatreAt(px, py) >= 0);
  const job = { woods, px, py, stride: 1, climateType: CLIMATES.Woodlands, landform: true };
  const r = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128) });
  assert.equal(r.settlement?.mapId, settlementPlaceId(row.ordinal));
  assert.ok(r.settlement.layout.pads.length > 5 && r.settlement.rect.xMin > 0);
  const pad = r.settlement.layout.pads.find((p) => p.base === 'cut');
  const [e, n] = pad.poly[0], i = Math.round(e / SAMPLE_M) * HEIGHTMAP_DIMENSION + Math.round(n / SAMPLE_M);
  assert.ok(r.samples[i] * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE <= r.settlement.layout.datum + Math.max(...r.settlement.layout.pads.map((p) => p.y)) + 1e-3);
  const held = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), hasLocation: true, locationRect: { xMin: 60, xMax: 68, yMin: 60, yMax: 68 } });
  assert.equal(held.settlement, null);
  assert.equal(standSettlementGround(px + 3, py, new Float32Array(HEIGHTMAP_DIMENSION ** 2)), null);
});

test('RMBC3 the frame\'s law: a record written before PADS_FRAME_LAW rides the carve, one stamped with it stands as written (mutants: the move dropped, taken by a stamped record)', () => {
  assert.deepEqual([GROUND_FRAME_LAW, PADS_FRAME_LAW], [6, 6]);
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  const law = recordFrame({ landform: false, liftAt: () => 0, heightAt: () => 100, state, bayAt: () => false, padsMovedAt: () => -2.5 });
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, 5), 101 - 2.5);
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, 6), 101);
  const host = readFileSync(new URL('../../../src/scenes/groundFrameHost.js', import.meta.url), 'utf8');
  assert.match(host, /moved = settlementMovedField\(host\.woods, px, py, HEIGHTMAP_DIMENSION, landformsHere\(\), landformsHere\(\{ bare: true \}\)\);/, 'off a built pixel, the kernel\'s way on the shaped ground');
  assert.match(host, /if \(stood\?\.moved \|\| liftRectAt\(px, py\)\) return settlementMovedAt\(stood, origin, x, z, heightCell\);/, 'a built pixel\'s own carve first, a grown town\'s alone');
});

test('RMBC3 a record\'s move off a built pixel is the kernel\'s own: laid out on the shaped land with no road, carved into the shaped ground - never DFU\'s plain ground (mutants: the plain ground, the moved field dropped)', () => {
  setTamrielFit(null);
  const w = new WoodsFile(); w.load(syntheticWoodsBytes());
  const woods = groundWoods(w), row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row), D = HEIGHTMAP_DIMENSION;
  const r = generatePixelTerrain({ woods, px, py, stride: 1, climateType: CLIMATES.Woodlands, landform: true, tilemap: new Uint8Array(128 * 128) });
  const field = settlementMovedField(woods, px, py, D, createLandforms({ woods }), createLandforms({ woods, roads: null }));
  const plain = settlementMovedField(woods, px, py, D);
  let worst = 0, apart = 0, n = 0;
  for (let i = 0; i < D * D; i += 7) {
    const x = Math.floor(i / D), y = i % D, k = r.settlement.moved[i];
    if (!k) continue;
    n++;
    worst = Math.max(worst, Math.abs(field(x, y) - k));
    apart = Math.max(apart, Math.abs(plain(x, y) - k));
  }
  assert.ok(n > 50, `${n} samples carved`);
  assert.ok(worst < 1e-3, `the kernel's move, within a float's noise: ${worst}`);
  assert.ok(apart > 0.05, `DFU's plain ground lays another town: ${apart}`);
  assert.equal(settlementMovedField(woods, px + 3, py, D, createLandforms({ woods })), null, 'none stands');
});
