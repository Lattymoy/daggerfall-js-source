// RMB-CONTRACTS RMBC1 (bible/03-World/RMB-Contracts.md): THE SETTLEMENT PLAN - the key bands, the pads a settlement's
// heights stand on, and every way validateSettlement refuses a plan. A terraced village past the Bay (Hammerfell's) stands
// beside an authored square on the Bay (TAMRIEL-WIDE). Pins mutation-checked (tools/mutants/rmbc1.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTLEMENT_CONTRACT_VERSION, RMB_KEY_LIMIT, MINTED_KEY_MIN, MINTED_KEY_MAX, STEP_MAX, PITCH_MAX, APPROACH,
  keyBandOf, rmbPartsOfKey, buildingIdText, groundAt, floorOf, settlementPrint, validateSettlement,
} from '../../../src/world/settlement/settlementContract.js';
import { ringsOverlap, ringOk, ringWithin, ringArea2 } from '../../../src/world/settlement/settlementGeometry.js';
import { makeBuildingKey, BUILDING_KEY_0 } from '../../../src/systems/talk/talkTopics.js';
import { HOME_KEY_MAX, homeBuildingKeyOk } from '../../../src/net/homeLaw.js';
import { FABRIC_HOME_KEY_MIN } from '../../../src/world/imperialHomes.js';
import { YARD_KEY_BASE } from '../../../src/systems/merchantYards.js';
import { isWorldRoom } from '../../../src/net/wire.js';
import { theatreAt } from '../../../src/world/worldWide/worldGrid.js';
import { regionOfTheatre } from '../../../src/formats/mapsTables.js';
import { inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { arenaPlaceId } from '../../../src/world/arenaLocations.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const HAMMERFELL = [1000, 200];
const PAST_BAY = arenaPlaceId({ provinceIndex: 1, id: 3 });   // a Hammerfell town's lane
const K = MINTED_KEY_MIN;
const house = (key, anchor, pad, ring, door, facing, extra = {}) => ({
  key, source: 'procedural', anchor, pad, at: [(ring[0][0] + ring[2][0]) / 2, (ring[0][1] + ring[2][1]) / 2], yaw: 0, lift: 0,
  footprint: ring, storeys: 2, exterior: { kind: 'procedural', style: 'hammerfell' }, interior: { kind: 'generated', plan: anchor },
  entrances: [{ n: 0, at: door, facing }], type: 2, factionId: 0, quality: 5, nameSeed: key & 0xffff, access: 'public', ...extra,
});
/** An oasis village on two terraces: the well's square below, a row of houses on the terrace 3 m up, stairs between. */
const village = () => ({
  contract: SETTLEMENT_CONTRACT_VERSION, place: PAST_BAY, source: 'procedural', generator: { id: 'oasis', version: 1, seed: 7 }, revision: 0,
  origin: { px: HAMMERFELL[0], py: HAMMERFELL[1], east: 200, north: 300 },
  footprint: sq(0, 0, 120, 100),
  pads: [{ id: 'square', poly: sq(0, 0, 120, 50), y: 0, rim: 'grade' }, { id: 'terrace', poly: sq(0, 50, 120, 100), y: 3, rim: 'wall' }],
  links: [{ id: 'steps', kind: 'stairs', from: 'square', to: 'terrace', a: [60, 45], b: [60, 55], width: 3 }],
  gates: [{ id: 'south', pad: 'square', at: [60, 1] }],
  streets: [{ id: 'main', rank: 'main', width: 6, pad: 'square', path: [[60, 0], [60, 45]] }, { id: 'row', rank: 'side', width: 4, pad: 'terrace', path: [[5, 56], [115, 56]] }],
  districts: [{ id: 'well', purpose: 'market', poly: sq(30, 10, 90, 40) }],
  buildings: [
    house(K, 'row.0', 'terrace', sq(10, 60, 30, 80), [20, 60], 180),
    house(K + 1, 'row.1', 'terrace', sq(30, 60, 50, 80), [40, 60], 180),   // shares a wall with row.0: touching is not overlap
    house(K + 2, 'inn', 'square', sq(80, 10, 100, 30), [80, 20], 270, { type: 15 }),
  ],
});
/** An authored square on the Bay, in Daggerfall's region: one pad, one shop. */
const baySquare = () => ({
  ...village(), place: 1, source: 'authored', generator: null, origin: { px: 207, py: 213, east: 10, north: 10 },
  footprint: sq(0, 0, 60, 60), pads: [{ id: 'g', poly: sq(0, 0, 60, 60), y: 0 }], links: [], gates: [{ id: 'w', pad: 'g', at: [1, 30] }],
  streets: [], districts: [], buildings: [{ ...house(K, 'shop', 'g', sq(20, 20, 40, 40), [20, 30], 270), source: 'authored' }],
});
const codes = (plan) => [...new Set(validateSettlement(plan).map((p) => p.code))].sort();
const edit = (fn) => { const p = structuredClone(village()); fn(p); return p; };

test('RMBC1 the frames: Hammerfell is past the Bay and Daggerfall\'s pixel on it (TAMRIEL-WIDE)', () => {
  assert.equal(inBay(...HAMMERFELL), false);
  assert.equal(regionOfTheatre(theatreAt(...HAMMERFELL)), 63);
  assert.equal(inBay(207, 213), true);
});

test('RMBC1 the bands: every RMB key under RMB_KEY_LIMIT or BUILDING_KEY_0, read back whole; the minted band past them and under BUILDING_KEY_0 (mutants: a band edge moved, key 0 not read)', () => {
  assert.deepEqual([RMB_KEY_LIMIT, MINTED_KEY_MIN, MINTED_KEY_MAX], [0x80000, 0x800000, 0xffffff]);
  assert.equal(RMB_KEY_LIMIT, FABRIC_HOME_KEY_MIN, 'one law: imperialHomes.js reads the same edge');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let r = 0; r < 256; r++) {
    const key = makeBuildingKey(x, y, r);
    assert.equal(keyBandOf(key), 'rmb', `${x},${y}.${r}`);
    assert.deepEqual(rmbPartsOfKey(key), { x, y, record: r });
  }
  assert.equal(makeBuildingKey(0, 0, 0), BUILDING_KEY_0);
  assert.equal(BUILDING_KEY_0, HOME_KEY_MAX);
  for (const k of [MINTED_KEY_MIN, MINTED_KEY_MIN + 12345, MINTED_KEY_MAX]) {
    assert.equal(keyBandOf(k), 'minted');
    assert.equal(rmbPartsOfKey(k), null, 'a minted key names no block cell');
    assert.ok(homeBuildingKeyOk(k), 'every home check takes a minted key');
    assert.ok(isWorldRoom(`interior:m${PAST_BAY}.${k}`), 'the relay has a room for its interior');
  }
  for (const k of [RMB_KEY_LIMIT, MINTED_KEY_MIN - 1, YARD_KEY_BASE, 0, -1, 1.5, HOME_KEY_MAX + 1]) assert.equal(keyBandOf(k), 'none', String(k));
  assert.equal(keyBandOf(MINTED_KEY_MAX + 1), 'rmb', 'one past the band is BUILDING_KEY_0, the RMB key 0');
  assert.equal(buildingIdText(PAST_BAY, K), `b:${PAST_BAY}.${K}`);
});

test('RMBC1 both plans keep the contract: a terraced village past the Bay, an authored square on it', () => {
  assert.deepEqual(validateSettlement(village()), []);
  assert.deepEqual(validateSettlement(baySquare()), []);
});

test('RMBC1 heights: the pad under a point is its ground; a building\'s floor is its pad and its lift (mutants: a pad\'s y unread, the lift dropped)', () => {
  const v = village();
  assert.deepEqual(groundAt(v, 60, 10), { pad: 'square', y: 0 });
  assert.deepEqual(groundAt(v, 60, 90), { pad: 'terrace', y: 3 });
  assert.equal(groundAt(v, 60, 130), null);
  assert.equal(floorOf(v, v.buildings[0]), 3);
  assert.equal(floorOf(v, { ...v.buildings[2], lift: 0.3 }), 0.3);
  assert.equal(floorOf(v, { ...v.buildings[2], pad: 'gone' }), null);
});

test('RMBC1 the print: the same plan with its keys in another order prints the same; a terrace 10 cm higher does not (mutant: the canonical order dropped)', () => {
  const v = village();
  const shuffled = Object.fromEntries(Object.entries(v).reverse());
  assert.equal(settlementPrint(shuffled), settlementPrint(v));
  assert.notEqual(settlementPrint(edit((p) => { p.pads[1].y = 3.1; })), settlementPrint(v));
});

test('RMBC1 floating, buried and crowded: a footprint over the terrace rim, two houses on one plot (mutants: the pad or the overlap check gone)', () => {
  assert.deepEqual(codes(edit((p) => { p.buildings[0].footprint = sq(10, 45, 30, 65); p.buildings[0].entrances[0].at = [20, 65]; p.buildings[0].entrances[0].facing = 0; })), ['off-pad']);
  assert.deepEqual(codes(edit((p) => { p.buildings[1].footprint = sq(25, 60, 45, 80); p.buildings[1].entrances[0].at = [35, 60]; })), ['overlap']);
  assert.deepEqual(codes(edit((p) => { p.buildings[1].footprint = sq(10, 60, 30, 80); p.buildings[1].entrances[0].at = [20, 60]; })), ['overlap'], 'one plot, two houses');
});

test('RMBC1 the way in: a door to a pad no link reaches, too steep a stair, a grade link past a step (mutants: the walk, the pitch, the step)', () => {
  assert.deepEqual(codes(edit((p) => { p.links = []; })), ['unreachable']);
  assert.deepEqual(codes(edit((p) => { p.pads[1].y = 10; })), ['link-steep']);
  assert.ok(10 > PITCH_MAX.stairs * 10 && 3 <= PITCH_MAX.stairs * 10, 'the stair runs 10 m: 3 m of rise passes, 10 m does not');
  assert.deepEqual(codes(edit((p) => { p.links[0].kind = 'grade'; })), ['link-steep']);
  assert.deepEqual(codes(edit((p) => { p.links[0].kind = 'grade'; p.pads[1].y = STEP_MAX; for (const b of p.buildings) b.lift = 0; })), []);
  assert.deepEqual(codes(edit((p) => { p.links[0].kind = 'ramp'; })), ['link-steep'], 'a ramp of 10 m rises 2.5 at most');
  assert.deepEqual(codes(edit((p) => { p.links[0].b = [60, 49]; })), ['link-end']);
  assert.deepEqual(codes(edit((p) => { p.gates = []; })), ['unreachable']);
});

test('RMBC1 doors: none on a public house, one off the wall, one that opens into the house or onto a drop (mutants: each door check gone)', () => {
  assert.deepEqual(codes(edit((p) => { p.buildings[2].entrances = []; })), ['no-entrance']);
  assert.deepEqual(codes(edit((p) => { p.buildings[2].entrances = []; p.buildings[2].access = 'none'; })), [], 'a shut store needs no door');
  assert.deepEqual(codes(edit((p) => { p.buildings[2].entrances[0].at = [77, 20]; })), ['entrance-off-wall']);
  assert.deepEqual(codes(edit((p) => { p.buildings[2].entrances[0].facing = 90; })), ['entrance-blocked'], 'facing east from its west wall opens into the house');
  assert.deepEqual(codes(edit((p) => { p.buildings[0].lift = 1; })), ['entrance-blocked'], 'a floor 1 m over its street');
  assert.ok(APPROACH > 0.25);
});

test('RMBC1 ground has one height: pads that overlap, a pad past the footprint, a street over a rim (mutants: each check gone)', () => {
  assert.deepEqual(codes(edit((p) => { p.pads[1].poly = sq(0, 40, 120, 100); })), ['pad-overlap']);
  assert.deepEqual(codes(edit((p) => { p.pads[1].poly = sq(0, 50, 130, 100); })), ['outside']);
  assert.deepEqual(codes(edit((p) => { p.streets[0].path = [[60, 0], [60, 70]]; })), ['street-off-pad']);
});

test('RMBC1 identity: a new building\'s key minted, a legacy one RMB; no two alike; an RMB record only for legacy (mutants: the band check, the dup check)', () => {
  assert.deepEqual(codes(edit((p) => { p.buildings[0].key = makeBuildingKey(1, 2, 3); })), ['key-band']);
  assert.deepEqual(codes(edit((p) => { p.buildings[1].key = K; })), ['id-dup']);
  assert.deepEqual(codes(edit((p) => { p.buildings[0].source = 'legacy'; p.buildings[0].exterior = { kind: 'rmb', block: 'AAA.RMB', record: 0 }; })), ['key-band']);
  assert.deepEqual(codes(edit((p) => { p.buildings[0].exterior = { kind: 'rmb', block: 'AAA.RMB', record: 0 }; })), ['asset']);
  assert.deepEqual(codes(edit((p) => { p.buildings[0].footprint = null; })), ['poly']);
  assert.deepEqual(codes(edit((p) => { p.buildings[0].anchor = ''; })), ['anchor']);
});

test('RMBC1 the frame: a contract it does not know is refused alone; an origin off the world, a bow-tie footprint (mutants: the version check, the origin bound)', () => {
  assert.deepEqual(validateSettlement({ ...village(), contract: 2 }).map((p) => p.code), ['contract']);
  assert.deepEqual(codes(edit((p) => { p.origin.px = 9000; })), ['origin']);
  assert.deepEqual(codes(edit((p) => { p.buildings[2].footprint = [[80, 10], [100, 30], [100, 10], [80, 30]]; })), ['poly']);
  assert.deepEqual(codes(edit((p) => { p.place = 0; })), ['place']);
  const why = validateSettlement(edit((p) => { p.links = []; }))[0];
  assert.match(why.at, /^building:\d+\/e0$/);
  assert.match(why.why, /terrace/, 'the reason names the pad');
});

test('RMBC1 the geometry: touching is not overlap, one plot is; a figure-eight with an area is no ring; an edge across a notch is not within (mutants: the probes, the self-cross, the edge-cross)', () => {
  assert.equal(ringsOverlap(sq(0, 0, 10, 10), sq(10, 0, 20, 10)), false, 'a shared wall');
  assert.equal(ringsOverlap(sq(0, 0, 10, 10), sq(0, 0, 10, 10)), true, 'one plot');
  assert.equal(ringsOverlap(sq(0, 0, 10, 10), sq(9, 9, 20, 20)), true);
  const eight = [[0, 0], [30, 0], [0, 10], [10, 10]];
  assert.notEqual(ringArea2(eight), 0);
  assert.equal(ringOk(eight), false);
  assert.equal(ringOk(sq(0, 0, 1, 1)), true);
  const notched = [[0, 0], [10, 0], [10, 10], [3, 10], [3, 8], [2, 8], [2, 10], [0, 10]];
  assert.equal(ringWithin(sq(1, 1, 9, 9), notched), false, 'its top edge crosses the notch');
  assert.equal(ringWithin(sq(1, 1, 9, 7), notched), true);
});
