// THE EDITOR'S SEAM. A row's controls changed within their bounds and
// its structure fixed, or refused whole; one district dressed again from its own seed while every other keeps its
// buildings, keys and services; a protected key's loss refused; what changed named by key. A Hammerfell settlement
// (TAMRIEL-WIDE: the settlements' lane past the Bay). Pins mutation-checked (tools/mutants/rmbc9.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { editSettlementRow, regenerateDistrict, planDiff, PARAM_BOUNDS } from '../../../src/world/settlement/settlementEditor.js';
import { layoutSettlement } from '../../../src/world/settlement/settlementLayout.js';
import { dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { SETTLEMENT_ROWS, settlementInput } from '../../../src/world/settlement/settlementPlaces.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const ROW = SETTLEMENT_ROWS.find((r) => r.province === 'Hammerfell');
const input = { ...settlementInput(ROW, 1084, 241), env: SYNTHETIC.oasis };
const L = layoutSettlement(input, SYNTHETIC.oasis);
const before = dressSettlement(input, L);
const districtOf = (/** @type {string} */ anchor) => `d${anchor.split('.')[1]}`;
const target = districtOf(before.plan.buildings.find((b) => /^c\d+\.\d+\.p\d+$/.test(b.anchor)).anchor);

test('RMBC9 a row\'s controls and structure: a patch inside the bounds applies, one outside them is refused whole (mutants: a bound, the layout check, the centre check, the shore\'s distance)', () => {
  const ok = editSettlementRow(ROW, { params: { density: 1.4, bands: 3 } });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual([ok.row.params.density, ok.row.params.bands], [1.4, 3]);
  assert.notEqual(ok.row, ROW, 'a new row; the published one untouched');
  for (const [k, [lo, hi]] of Object.entries(PARAM_BOUNDS)) {
    assert.equal(editSettlementRow(ROW, { params: { [k]: hi + 0.01 } }).problems.length, 1, `${k} past its most`);
    assert.equal(editSettlementRow(ROW, { params: { [k]: lo - 0.01 } }).problems.length, 1, `${k} under its least`);
  }
  const bad = editSettlementRow(ROW, { params: { density: 1.2, height: 3 }, fix: { layout: 'spiral' } });
  assert.equal(bad.row, ROW, 'refused whole');
  assert.deepEqual(bad.problems.length, 2);
  assert.deepEqual(editSettlementRow(ROW, { fix: { layout: 'ring', centre: [400, 410] } }).row.fix, { layout: 'ring', centre: [400, 410] });
  assert.equal(editSettlementRow(ROW, { fix: { layout: 'row', shore: { dir: [1, 1], at: 30 } } }).problems.length, 1, 'a shore\'s direction is a unit');
  assert.equal(editSettlementRow(ROW, { fix: { layout: 'row', shore: { dir: [1, 0], at: 0 } } }).problems.length, 1, 'and its distance past the centre');
  assert.deepEqual(editSettlementRow(ROW, { fix: { layout: 'row', shore: { dir: [1, 0], at: 30 } } }).problems, [], 'a shore that is both');
  assert.equal(editSettlementRow(ROW, { fix: { layout: 'ring', centre: [400, 'north'] } }).problems.length, 1, 'a centre is two numbers');
});

test('RMBC9 one district dressed again, every district of a Bay fort and a Hammerfell oasis: it changes, and every other keeps its buildings, keys, kinds, access and heights (mutants: the district\'s draw, a plot drawn by its global number, the services kept, a displaced service on a fresh plot, a height by its global number)', () => {
  const home = (/** @type {string} */ a) => (a === 'keep' ? 'keep' : districtOf(a));
  for (const row of [SETTLEMENT_ROWS.find((r) => r.archetype === 'fort'), ROW]) {
    const env = SYNTHETIC[row.archetype] ?? SYNTHETIC.oasis, inp = { ...settlementInput(row, 1084, 241), env }, lay = layoutSettlement(inp, env), was = dressSettlement(inp, lay);
    const districts = [...new Set(was.plan.buildings.map((b) => home(b.anchor)))].filter((d) => d !== 'keep');
    let moved = 0;
    for (const d of districts) {
      const r = regenerateDistrict(inp, lay, d, 12, { ledger: was.ledger, published: was.plan.buildings });
      const after = new Map(r.plan.buildings.map((b) => [b.anchor, b]));
      if (Object.values(r.changed).some((list) => list.length)) moved++;
      for (const b of was.plan.buildings.filter((x) => home(x.anchor) !== d)) {
        const a = after.get(b.anchor);
        assert.ok(a, `${row.name} ${d}: ${b.anchor} stands`);
        assert.deepEqual([a.key, a.type, a.access, a.storeys, a.footprint], [b.key, b.type, b.access, b.storeys, b.footprint], `${row.name} ${d}: ${b.anchor} as it was`);
      }
      for (const k of [...r.changed.added, ...r.changed.removed, ...r.changed.moved]) {
        const b = r.plan.buildings.find((x) => x.key === k) ?? was.plan.buildings.find((x) => x.key === k);
        assert.equal(home(b.anchor), d, `${k} is the district's`);
      }
      for (const b of r.plan.buildings) if (was.ledger.keys[b.anchor] !== undefined) assert.equal(b.key, was.ledger.keys[b.anchor], 'an anchor keeps its key');
    }
    assert.ok(moved > districts.length / 2, `${row.name}: ${moved} of ${districts.length} districts change under a seed of their own`);
  }
});

test('RMBC9 a protected building the regeneration would drop is refused (mutant: the protected keys unread)', () => {
  let refused = false;
  for (let seed = 1; seed < 40 && !refused; seed++) {
    const free = regenerateDistrict(input, L, target, seed, { ledger: before.ledger, published: before.plan.buildings });
    const gone = free.changed.removed.find((k) => districtOf(before.plan.buildings.find((b) => b.key === k).anchor) === target);
    if (gone === undefined) continue;
    const held = regenerateDistrict(input, L, target, seed, { ledger: before.ledger, published: before.plan.buildings, protectedKeys: [gone] });
    assert.deepEqual(held.report.conflicts.map((c) => [c.code, c.key]), [['protected-removed', gone]]);
    assert.equal(held.report.ok, false);
    refused = true;
  }
  assert.ok(refused, 'a seed that drops a building was found');
});

test('RMBC9 what changed, by key: added, removed, moved, retyped (mutant: a list crossed)', () => {
  const b = (key, at, type = 1) => ({ key, pad: 'p', at, yaw: 0, lift: 0, footprint: [], type });
  const d = planDiff({ buildings: [b(1, [0, 0]), b(2, [0, 0]), b(3, [0, 0])] }, { buildings: [b(2, [1, 0]), b(3, [0, 0], 4), b(5, [0, 0])] });
  assert.deepEqual(d, { added: [5], removed: [1], moved: [2], retyped: [3] });
});

test('RMBC9 a service keeps the plot it was published on while that plot stands (mutant: the services kept)', () => {
  const tavern = before.plan.buildings.find((b) => b.type === 15);
  const house = before.plan.buildings.find((b) => b.type !== 15 && /^c\d+\.\d+\.p\d+$/.test(b.anchor) && b.anchor !== tavern.anchor && ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(b.type));
  const published = before.plan.buildings.map((b) => (b.anchor === house.anchor ? { ...b, type: 15 } : b.anchor === tavern.anchor ? { ...b, type: house.type } : b));
  const { plan } = dressSettlement({ ...input, ledger: before.ledger, published }, L);
  assert.equal(plan.buildings.find((b) => b.type === 15).anchor, house.anchor, 'the tavern where it was published');
});

test('RMBC9 a published shore keeps its way and reads its distance from the ground: a stale distance lays the same town (mutant: the shore pinned)', () => {
  const env = SYNTHETIC.river;
  const free = layoutSettlement({ place: input.place, origin: input.origin, seed: 3, archetype: 'river', style: 'Sumurset', site: { east: 230, north: 409.6, radius: 90 } }, env);
  assert.ok(free.shore, 'a river town on the synthetic shore');
  const fixed = (at) => layoutSettlement({ place: input.place, origin: input.origin, seed: 3, archetype: 'river', style: 'Sumurset', site: { east: 230, north: 409.6, radius: 90 }, fix: { layout: 'row', shore: { dir: free.shore.dir, at } } }, env);
  const stale = fixed(free.shore.at + 30), right = fixed(free.shore.at);
  assert.equal(stale.shore.at, free.shore.at, 'the ground\'s distance, not the row\'s');
  assert.deepEqual(stale.pads, right.pads);
});
