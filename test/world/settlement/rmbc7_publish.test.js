// RMB-CONTRACTS RMBC7 (bible/03-World/RMB-Contracts.md RD-6, RD-19, RD-20): WHAT A REVISION MAY NOT MOVE, AND THE LAW THE
// PLANS RIDE. A town's protected keys are its homes' answer's; a published row is revised through its ledger, refused where
// a protected building would move or go; a grown town's keys are its anchors' own, refused where a protected anchor is
// gone; the ground's print reads both plans, so a change to a door's key moves GROUND_LAW. A Hammerfell settlement and a
// Skyrim town's outskirts (TAMRIEL-WIDE). Pins mutation-checked (tools/mutants/rmbc7.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anchorLedger, emptyIdLedger, ledgerProblems } from '../../../src/world/settlement/settlementIds.js';
import { protectedOfTown, revisionConflicts, protectedGone } from '../../../src/world/settlement/settlementPublish.js';
import { MINTED_KEY_MIN, MINTED_KEY_MAX } from '../../../src/world/settlement/settlementContract.js';
import { layoutSettlement } from '../../../src/world/settlement/settlementLayout.js';
import { dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { SETTLEMENT_ROWS, settlementInput } from '../../../src/world/settlement/settlementPlaces.js';
import { townGrowthJob, standTownGrowth } from '../../../src/world/settlement/townGrowth.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';
import { protectedByTown } from '../../../tools/settlementRevise.mjs';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const ROW = SETTLEMENT_ROWS.find((r) => r.province === 'Hammerfell');
const input = { ...settlementInput(ROW, 1084, 241), env: SYNTHETIC.oasis };
const L = layoutSettlement(input, SYNTHETIC.oasis);
const D = 129, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;

test('RMBC7 a grown town\'s ledger is its anchors\' own: in the band, the same in any order, a key moved by no other anchor, a taken key probed past (mutants: the hash, the probe, the order)', () => {
  const anchors = ['c1.0.p0', 'c1.0.p1', 'c1.1.p0', 'c2.3.p4'];
  const a = anchorLedger(77, anchors), b = anchorLedger(77, [...anchors].reverse());
  assert.deepEqual(a, b);
  assert.deepEqual(ledgerProblems(a), []);
  for (const k of Object.values(a.keys)) assert.ok(k >= MINTED_KEY_MIN && k <= MINTED_KEY_MAX);
  const fewer = anchorLedger(77, anchors.slice(1));
  for (const x of anchors.slice(1)) assert.equal(fewer.keys[x], a.keys[x], `${x} keeps its key with a plot gone`);
  assert.notDeepEqual(anchorLedger(78, anchors).keys, a.keys, 'another place, other keys');
  // collisions: 20,000 anchors in a band of 8.4 million meet about two dozen times - each probed past, in sorted order
  const names = Array.from({ length: 20000 }, (_, i) => `a${i}`), many = anchorLedger(5, names);
  assert.equal(new Set(Object.values(many.keys)).size, names.length, 'every anchor its own key');
  assert.deepEqual(anchorLedger(5, [...names].reverse()).keys, many.keys, 'whatever order they come in');
  assert.deepEqual(ledgerProblems(many), []);
});

test('RMBC7 a grown town dresses by its anchors: no ledger shipped, and the same keys on every client (mutant: the keys law)', () => {
  const rect = { xMin: 48, xMax: 80, yMin: 48, yMax: 80 }, s = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) s[x * D + y] = (70 + 3 * Math.sin(x / 11) + 4 * Math.cos(y / 13)) / M;
  for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) s[x * D + y] = s[64 * D + 64];
  const job = townGrowthJob({ mapTableData: { mapId: 600123, locationType: 2 }, name: 'Riverwood' }, 'Skyrim', 64);
  const g = standTownGrowth(2200, 30, s, job, rect, {});
  assert.equal(g.input.keys, 'anchored');
  const { plan } = dressSettlement(g.input, g.layout), led = anchorLedger(job.place, plan.buildings.map((b) => b.anchor));
  for (const b of plan.buildings) assert.equal(b.key, led.keys[b.anchor], `${b.anchor} its anchor's key`);
});

test('RMBC7 a town\'s protected keys are its homes\' answer\'s, and both shapes of the revision\'s file read alike (mutants: a home dropped, a key twice)', () => {
  const answer = { mapId: 270420, homes: [{ buildingKey: 0x800005 }, { buildingKey: 513, hall: {} }, { buildingKey: 0x800005 }, { owner: 'x' }] };
  assert.deepEqual(protectedOfTown(answer), { place: 270420, keys: [513, 0x800005] });
  assert.deepEqual(protectedOfTown(null), { place: 0, keys: [] });
  assert.deepEqual([...protectedByTown([answer]).entries()], [[270420, [513, 0x800005]]]);
  assert.deepEqual([...protectedByTown({ 270420: [513, 'x', 0x800005] }).entries()], [[270420, [513, 0x800005]]]);
});

test('RMBC7 a published row\'s revision refuses a protected building that would go or move, and passes one that stays (mutants: the protected keys unread, the published unread)', () => {
  const { plan, ledger } = dressSettlement(input, L);
  const held = plan.buildings[0];
  assert.deepEqual(revisionConflicts({ ...input, ledger }, L, [held.key]), [], 'it stays: nothing refused');
  // a revision whose ledger still names an anchor the plan has lost: the protected key would go
  const lost = { ...ledger, keys: { ...ledger.keys, 'gone.p9': ledger.next }, next: ledger.next + 1 };
  const gone = revisionConflicts({ ...input, ledger: lost }, L, [ledger.next]);
  assert.deepEqual(gone.map((c) => c.code), ['protected-removed']);
  // what was published stood elsewhere: the protected building moved
  const moved = revisionConflicts({ ...input, ledger }, L, [held.key], [{ ...held, at: [held.at[0] + 5, held.at[1]] }]);
  assert.deepEqual(moved.map((c) => [c.code, c.key]), [['protected-moved', held.key]]);
});

test('RMBC7 a grown town\'s revision: a protected minted key its new plan no longer holds is named; a legacy key never is (mutant: the band)', () => {
  const plan = { buildings: [{ key: 0x800001 }, { key: 0x800002 }] };
  assert.deepEqual(protectedGone(plan, [0x800001, 0x800003, 513]), [0x800003]);
  assert.deepEqual(protectedGone(plan, []), []);
  assert.equal(emptyIdLedger(1).next, MINTED_KEY_MIN);
});

test('RMBC7 the plans ride the ground\'s law (by source): the print reads both plans, so a door\'s key moved moves GROUND_LAW (RD-20; mutant: the plans unprinted)', () => {
  const print = readFileSync(new URL('../../../tools/groundPrint.mjs', import.meta.url), 'utf8');
  assert.match(print, /cells\.Plans = \[settled\.settlement, grownSettlement\]\.map\(/);
  const recorded = JSON.parse(readFileSync(new URL('../../fixtures/groundPrint.json', import.meta.url), 'utf8'));
  assert.equal(recorded.cells.Plans.length, 2);
  assert.ok(recorded.cells.Plans.every((h) => Number.isSafeInteger(h) && h > 0), 'both plans stood and printed');
});
