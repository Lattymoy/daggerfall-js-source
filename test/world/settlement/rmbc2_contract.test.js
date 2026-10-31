// RMB-CONTRACTS RMBC2 (bible/03-World/RMB-Contracts.md): WHAT RMBC2 ADDED TO THE PLAN - a pad inside another (a raised square,
// a keep's mound) is the ground where it stands; a pad's base, cut into the ground or raised on posts; plots, a building's
// ground or open land; features. A Hammerfell village past the Bay, as in rmbc1_contract.test.js. Pins mutation-checked
// (tools/mutants/rmbc2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSettlement, groundAt, padAt, MINTED_KEY_MIN, SETTLEMENT_CONTRACT_VERSION, FEATURE_KINDS, PAD_BASES } from '../../../src/world/settlement/settlementContract.js';
import { arenaPlaceId } from '../../../src/world/arenaLocations.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const K = MINTED_KEY_MIN;
/** A square with a raised platform in its middle and a temple on it, a house on its own plot, a well and a wall. */
const plan = () => ({
  contract: SETTLEMENT_CONTRACT_VERSION, place: arenaPlaceId({ provinceIndex: 1, id: 3 }), source: 'authored', generator: null, revision: 0,
  origin: { px: 1000, py: 200, east: 0, north: 0 }, footprint: sq(0, 0, 100, 100),
  pads: [{ id: 'square', poly: sq(0, 0, 100, 100), y: 0 }, { id: 'dais', poly: sq(40, 40, 60, 60), y: 1.5, rim: 'wall', base: 'raised' }],
  links: [{ id: 'steps', kind: 'stairs', from: 'square', to: 'dais', a: [50, 37], b: [50, 42], width: 3 }],
  gates: [{ id: 'g', pad: 'square', at: [50, 1] }], streets: [], districts: [],
  plots: [{ id: 'house', pad: 'square', poly: sq(5, 70, 25, 90) }, { id: 'yard', pad: 'square', poly: sq(25, 70, 40, 90) }],
  features: [{ id: 'well', kind: 'well', pad: 'square', at: [20, 20] }, { id: 'wall', kind: 'wall', path: [[0, 0], [100, 0]] }],
  buildings: [
    { key: K, source: 'authored', anchor: 'temple', pad: 'dais', at: [50, 52], yaw: 180, lift: 0, footprint: sq(44, 46, 56, 58), storeys: 2, exterior: { kind: 'prefab', id: 'temple' }, interior: null,
      entrances: [{ n: 0, at: [50, 46], facing: 180 }], type: 14, factionId: 33, quality: 10, nameSeed: 1, access: 'public' },
    { key: K + 1, source: 'authored', anchor: 'house', pad: 'square', at: [15, 80], yaw: 180, lift: 0, footprint: sq(8, 74, 22, 86), storeys: 1, exterior: { kind: 'prefab', id: 'house' }, interior: null,
      entrances: [{ n: 0, at: [15, 74], facing: 180 }], type: 17, factionId: 0, quality: 5, nameSeed: 2, access: 'private' },
  ],
});
const codes = (p) => [...new Set(validateSettlement(p).map((x) => x.code))].sort();
const edit = (fn) => { const p = structuredClone(plan()); fn(p); return p; };

test('RMBC2 the plan with a raised dais in its square keeps the contract; the dais is the ground where it stands (mutants: the smallest pad, the nesting)', () => {
  assert.deepEqual(validateSettlement(plan()), []);
  assert.deepEqual(groundAt(plan(), 50, 50), { pad: 'dais', y: 1.5 });
  assert.deepEqual(groundAt(plan(), 10, 10), { pad: 'square', y: 0 });
  assert.equal(padAt(plan().pads, [50, 41])?.id, 'dais');
  const reversed = edit((p) => { p.pads.reverse(); });
  assert.deepEqual(groundAt(reversed, 50, 50), { pad: 'dais', y: 1.5 }, 'the order the pads are listed in does not matter');
  assert.deepEqual(validateSettlement(reversed), []);
});

test('RMBC2 nesting is whole or nothing: a pad half over the square\'s rim, two pads of one ring, a building over the dais\'s rim (mutants: the nested test, the onePad test)', () => {
  assert.deepEqual(codes(edit((p) => { p.pads[1].poly = sq(90, 40, 110, 60); p.links = []; p.buildings.shift(); })), ['outside', 'pad-overlap']);
  assert.deepEqual(codes(edit((p) => { p.pads[1].poly = sq(0, 0, 100, 100); p.links = []; p.buildings.shift(); })), ['pad-overlap']);
  assert.deepEqual(codes(edit((p) => { p.buildings[1].footprint = sq(30, 40, 42, 52); p.buildings[1].entrances[0].at = [36, 40]; p.plots = []; })), ['off-pad']);
  assert.deepEqual(codes(edit((p) => { p.gates[0].at = [50, 50]; })), ['gate', 'unreachable'], 'a gate on the dais is not the square\'s');
  assert.deepEqual(codes(edit((p) => { p.links[0].b = [50, 39]; })), ['link-end']);
});

test('RMBC2 a pad\'s base is cut or raised (mutant: the base unchecked)', () => {
  assert.deepEqual([...PAD_BASES], ['cut', 'raised']);
  assert.deepEqual(codes(edit((p) => { p.pads[1].base = 'floating'; })), ['pad']);
});

test('RMBC2 plots: a building keeps to its own; plots do not overlap and lie on one pad (mutants: off-plot, the plot overlap, the plot\'s pad)', () => {
  assert.deepEqual(codes(edit((p) => { p.buildings[1].footprint = sq(8, 74, 30, 86); p.plots[1].poly = sq(32, 70, 40, 90); })), ['off-plot']);
  assert.deepEqual(codes(edit((p) => { p.plots[1].poly = sq(20, 70, 40, 90); })), ['overlap']);
  assert.deepEqual(codes(edit((p) => { p.plots[1].poly = sq(35, 50, 45, 70); })), ['off-pad']);
  assert.deepEqual(codes(edit((p) => { p.plots[1].pad = 'gone'; })), ['pad-missing']);
  assert.deepEqual(codes(edit((p) => { p.plots[1].id = 'house'; })), ['id-dup']);
});

test('RMBC2 features: a kind the contract knows, standing on its pad or inside the footprint (mutants: the kind, the pad, the path)', () => {
  assert.ok(FEATURE_KINDS.includes('dock') && FEATURE_KINDS.includes('wall'));
  assert.deepEqual(codes(edit((p) => { p.features[0].kind = 'dragon'; })), ['feature']);
  assert.deepEqual(codes(edit((p) => { p.features[0].at = [50, 50]; })), ['feature'], 'the well is the square\'s, not the dais\'s');
  assert.deepEqual(codes(edit((p) => { p.features[1].path = [[0, 0], [130, 0]]; })), ['feature']);
  assert.deepEqual(codes(edit((p) => { delete p.features[0].pad; p.features[0].at = [120, 20]; })), ['feature']);
  assert.deepEqual(codes(edit((p) => { p.features[1].id = 'well'; })), ['id-dup']);
});
