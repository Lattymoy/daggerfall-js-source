// THE GROUND UNDER A SETTLEMENT AND WHERE ONE STANDS - the carve
// never stands a vertex over the paving of any cut pad near it, so the 6.4 m grid never pokes through a terrace, and leaves
// the land its own past the ease; a raised pad leaves the land alone. The published settlements, one a province past the
// Bay, each found on its pixel in its own lane of map ids; the kernel lays one out on a pixel no location holds, and no
// record's height carries the carve. Pins mutation-checked (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settlementGroundAt, carveSettlementGround, PAD_CLEAR, PAD_REACH, GROUND_EASE, SEA_SHORE } from '../../../src/world/settlement/settlementGround.js';
import { generateSettlement } from '../../../src/world/settlement/settlementGen.js';
import { padAt, edgeDistance } from '../../../src/world/settlement/settlementGeometry.js';
import { SETTLEMENT_ROWS, SETTLEMENT_LANE, settlementPlaceId, isSettlementPlaceId, settlementOnPixel, settlementPixel, settlementPlaceRows } from '../../../src/world/settlement/settlementPlaces.js';
import { standSettlementGround, settlementTreeFlats, SAMPLE_M, SEA_M } from '../../../src/world/settlement/settlementStand.js';
import { MINTED_KEY_MIN } from '../../../src/world/settlement/settlementContract.js';
import { THEATRE_KEYS, theatreAt } from '../../../src/world/worldWide/worldGrid.js';
import { isMadePlaceId } from '../../../src/world/placeIds.js';
import { isWorldRoom } from '../../../src/net/wire.js';
import { inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { CAPITAL_LANE } from '../../../src/world/capitalLane.js';
import { COUNTRY_LANE, LAIR_LANE } from '../../../src/world/tamrielCountry.js';
import { recordFrame } from '../../../src/scenes/groundFrameHost.js';
import { GROUND_FRAME_LAW, HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE, MAX_TERRAIN_HEIGHT } from '../../../src/world/terrain/terrainSampler.js';
import { generatePixelTerrain } from '../../../src/world/terrain/terrainGen.js';
import { isTreeRecord } from '../../../src/world/terrain/terrainNature.js';
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
  // its yard trees are the pixel's own nature, at the dressing's points (mutant: the trees left out)
  const yard = settlementTreeFlats(r.settlement);
  assert.ok(yard.length > 5 && yard.every((t) => r.nature.some((f) => f.record === t.record && f.x === t.x && f.y === t.y && f.z === t.z)));
  // with its climate's archive the kernel's yard trees are that pixel's own live trees (mutant: the archive unhanded)
  const woodland = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), natureArchive: 504 });
  const spots = new Set(settlementTreeFlats(woodland.settlement).map((t) => `${t.x},${t.z}`));
  const planted = woodland.nature.filter((f) => spots.has(`${f.x},${f.z}`));
  assert.ok(planted.length === spots.size && planted.every((f) => isTreeRecord(f.archive ?? 504, f.record) && !(f.archive === undefined && f.record === 30)), 'live trees of the woodlands, never its dead oak');
  assert.ok(new Set(planted.map((f) => f.record)).size >= 2, 'the pixel\'s own several kinds, not one stand-in');
  assert.match(readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8'), /\n {6}natureArchive: climate\.natureArchive,/);
  const pad = r.settlement.layout.pads.find((p) => p.base === 'cut');
  const [e, n] = pad.poly[0], i = Math.round(e / SAMPLE_M) * HEIGHTMAP_DIMENSION + Math.round(n / SAMPLE_M);
  assert.ok(r.samples[i] * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE <= r.settlement.layout.datum + Math.max(...r.settlement.layout.pads.map((p) => p.y)) + 1e-3);
  const held = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), hasLocation: true, locationRect: { xMin: 60, xMax: 68, yMin: 60, yMax: 68 } });
  assert.equal(held.settlement, null);
  assert.equal(standSettlementGround(px + 3, py, new Float32Array(HEIGHTMAP_DIMENSION ** 2)), null);
});

test('RMBC3 the frame\'s law: no record carries the carve - written less its move under it, the row on or off, stood again plus its build\'s, whatever its law (mutants: the move left on, taken off with the row on alone, not put back, put back by law)', () => {
  assert.equal(GROUND_FRAME_LAW, 5, 'the stamp main writes: a record of either build reads on the other');
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  const asked = [];
  for (const landform of [false, true]) {
    const law = recordFrame({ landform, liftAt: () => 4, heightAt: () => 100, state, bayAt: () => true, padsMovedAt: (x, z, owe = true) => { asked.push(owe); return -2.5; } });
    assert.equal(law.groundFrameHeight(101, 0, 0), 101 + 2.5 - (landform ? 4 : 0), `written, the row ${landform ? 'on' : 'off'}`);
    assert.equal(law.groundFrameNative(0, 0, 101), 101 + 2.5 - (landform ? 4 : 0), 'a record in natives too');
    for (const frame of [GROUND_FRAME_LAW, GROUND_FRAME_LAW - 1, null]) assert.equal(law.restandHeight(103.5 - (landform ? 4 : 0), 0, 0, STREAMING_TERRAIN_SCALE, frame), 101, `read, stamped ${frame}`);
  }
  assert.ok(asked.length === 10 && asked.filter((owe) => !owe).length === 4, 'a write never owes a pixel, a re-stand may');
  const host = readFileSync(new URL('../../../src/scenes/groundFrameHost.js', import.meta.url), 'utf8');
  assert.match(host, /return settlementMovedAt\(stood\.settlement, origin, x, z, heightCell\);/, 'a built pixel\'s own carve');
});

test('RMBC3 a published quay meets its sea: the pixel\'s carve leaves the sea\'s bed off its pads, its docks run out over the water (mutant: the sea unread by the stand)', () => {
  const row = SETTLEMENT_ROWS.find((r) => r.archetype === 'river'), [px, py] = settlementPixel(row), D = HEIGHTMAP_DIMENSION, dir = row.fix.shore.dir;
  const seaward = (e, n) => (e - row.site.east) * dir[0] + (n - row.site.north) * dir[1] > row.fix.shore.at;
  const metres = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, before = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) before[x * D + y] = (seaward(x * SAMPLE_M, y * SAMPLE_M) ? SEA_M : SEA_M + 4) / metres;   // the kernel's sea floor: the sea's line, a float a hair over it
  const after = Float32Array.from(before), stood = standSettlementGround(px, py, after);
  assert.ok(stood);
  const pads = stood.layout.pads;
  let near = 0;
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
    const p = [x * SAMPLE_M, y * SAMPLE_M], i = x * D + y;
    if (before[i] * metres >= SEA_M + SEA_SHORE || padAt(pads, p)) continue;
    assert.equal(after[i], before[i], `the bed at ${x}, ${y}`);
    if (pads.some((pad) => edgeDistance(p, pad.poly) < PAD_REACH)) near++;
  }
  assert.ok(near > 3, `${near} of its bed within a pad's hold`);
});

test('RMBC3 the carve hands back its own move: the build\'s `moved` is each sample carved less the sample it was, in the frame\'s units, and nothing off the pads\' reach (mutants: the moved field unfilled, its units)', () => {
  setTamrielFit(null);
  const w = new WoodsFile(); w.load(syntheticWoodsBytes());
  const woods = groundWoods(w), row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row), D = HEIGHTMAP_DIMENSION;
  const r = generatePixelTerrain({ woods, px, py, stride: 1, climateType: CLIMATES.Woodlands, landform: true, tilemap: new Uint8Array(128 * 128) });
  const was = Float32Array.from(r.samples, (v, i) => v - r.settlement.moved[i] / MAX_TERRAIN_HEIGHT);   // the ground before the carve
  const again = Float32Array.from(was), stood = standSettlementGround(px, py, again, () => Float32Array.from(was));
  let carved = 0;
  for (let i = 0; i < D * D; i++) {
    assert.ok(Math.abs(again[i] - was[i] - stood.moved[i] / MAX_TERRAIN_HEIGHT) < 1e-6, `sample ${i}`);
    if (stood.moved[i]) carved++;
  }
  assert.ok(carved > 50 && carved < D * D / 2, `${carved} samples carved, the rest left`);
});

test('RMBC3 the carve never raises the sea\'s bed off its pads: a quay meets its harbour\'s water, a pad\'s own ground is still raised to it, the land above the sea as ever (mutants: the sea, the pad\'s own ground)', () => {
  const sea = 99;
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, 95, sea), null, 'beside the quay, under the sea: left');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, 95), 100 - PAD_CLEAR, 'with no sea, raised as ever');
  assert.equal(settlementGroundAt(PADS, 100, 20, 20, 95, sea), 100 - PAD_CLEAR, 'under the pad itself: its ground');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, sea + 1e-6, sea), null, 'the kernel\'s sea floor, clamped a hair over the sea\'s line: water still');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, sea + SEA_SHORE - 0.01, sea), null, 'a wet beach the generator calls water');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, sea + SEA_SHORE + 0.01, sea), 100 - PAD_CLEAR, 'dry land over the shore raised to it');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, 105, sea), 100 - PAD_CLEAR, 'higher land cut down to it');
  const S = Float64Array.from({ length: 129 * 129 }, (_, i) => (Math.floor(i / 129) * SAMPLE_M < 38 ? 95 : 101));   // its bed within the hold of the quay
  const kept = Float64Array.from(S);
  carveSettlementGround(kept, 129, SAMPLE_M, { pads: [{ id: 'quay', poly: sq(40, 0, 80, 800), y: 0, base: 'cut' }], origin: { east: 0, north: 0 } }, 101, undefined, sea);
  for (let i = 0; i < S.length; i++) if (Math.floor(i / 129) * SAMPLE_M < 38) assert.equal(kept[i], 95, 'the harbour\'s bed');
  const raised = Float64Array.from(S);
  carveSettlementGround(raised, 129, SAMPLE_M, { pads: [{ id: 'quay', poly: sq(40, 0, 80, 800), y: 0, base: 'cut' }], origin: { east: 0, north: 0 } }, 101);
  assert.equal(raised[5 * 129 + 10], 101 - PAD_CLEAR, 'with no sea the hold fills it');
});

test('RMBC3 the carve asks each sample only the pads that can touch it, and lays the ground every pad would (mutant: the reach the index grows by)', () => {
  const D = 129, step = SAMPLE_M;
  for (const archetype of ['fort', 'wetland']) {
    const { plan } = generateSettlement({ place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 3, archetype, style: 'Skyrim', site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC[archetype] });
    const base = Float64Array.from({ length: D * D }, (_, i) => 40 + Math.sin(i / 50) * 9), indexed = Float64Array.from(base);
    carveSettlementGround(indexed, D, step, plan, 30, undefined, 38);
    let moved = 0;
    for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
      const i = x * D + y, h = settlementGroundAt(plan.pads, 30, x * step, y * step, base[i], 38);
      assert.equal(indexed[i], h === null ? base[i] : h, `${archetype} ${x},${y}`);
      if (h !== null && h !== base[i]) moved++;
    }
    assert.ok(moved > 100, `${archetype}: ${moved} moved`);
  }
});
