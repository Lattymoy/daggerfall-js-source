// RMB-CONTRACTS RMBC1 (bible/03-World/RMB-Contracts.md): THE KEY LEDGER - a new building's key minted once and kept by
// its anchor through every regeneration, a gone anchor's key retired and never minted again, a protected building neither
// removed nor moved. A village past the Bay (a made place's id) and a town on it (its MAPS id). Pins mutation-checked
// (tools/mutants/rmbc1.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyIdLedger, reconcileBuildingIds, ledgerProblems } from '../../../src/world/settlement/settlementIds.js';
import { MINTED_KEY_MIN, MINTED_KEY_MAX } from '../../../src/world/settlement/settlementContract.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { isMadePlaceId } from '../../../src/world/placeIds.js';
import { arenaPlaceId } from '../../../src/world/arenaLocations.js';

const PAST_BAY = arenaPlaceId({ provinceIndex: 1, id: 3 }), BAY = 1;   // a Hammerfell town's lane
const K = MINTED_KEY_MIN;
const b = (anchor, at = [0, 0], extra = {}) => ({ key: 0, source: 'procedural', anchor, pad: 'p', at, yaw: 0, lift: 0, footprint: [[0, 0], [1, 0], [1, 1]], ...extra });
const keysOf = (r) => Object.fromEntries(r.buildings.map((x) => [x.anchor, x.key]));

test('RMBC1 the places: the village past the Bay is a made place, the town on it a MAPS id', () => {
  assert.equal(isMadePlaceId(PAST_BAY), true);
  assert.equal(isMadePlaceId(BAY), false);
});

test('RMBC1 first plan: keys minted from the band\'s foot in the plan\'s order; the ledger frozen, the inputs untouched (mutants: next not advanced, the band\'s foot moved)', () => {
  const proposed = [b('a'), b('b'), b('c')];
  const before = structuredClone(proposed);
  const r = reconcileBuildingIds(emptyIdLedger(PAST_BAY), proposed);
  assert.equal(r.ok, true);
  assert.deepEqual(keysOf(r), { a: K, b: K + 1, c: K + 2 });
  assert.deepEqual(r.minted, [K, K + 1, K + 2]);
  assert.deepEqual(r.ledger, { place: PAST_BAY, next: K + 3, keys: { a: K, b: K + 1, c: K + 2 }, retired: [] });
  assert.ok(Object.isFrozen(r.ledger) && Object.isFrozen(r.ledger.keys));
  assert.deepEqual(proposed, before);
});

test('RMBC1 regenerated: every anchor keeps its key whatever the order; a new anchor takes the next (mutant: the kept key unread)', () => {
  const first = reconcileBuildingIds(emptyIdLedger(PAST_BAY), [b('a'), b('b'), b('c')]);
  const again = reconcileBuildingIds(first.ledger, [b('c', [5, 5]), b('new'), b('a'), b('b')]);
  assert.equal(again.ok, true);
  assert.deepEqual(keysOf(again), { c: K + 2, new: K + 3, a: K, b: K + 1 });
  assert.deepEqual(again.minted, [K + 3]);
});

test('RMBC1 retired: a gone anchor\'s key leaves the ledger and is never minted again, even for its own name (mutants: the retire skipped, next reset)', () => {
  const first = reconcileBuildingIds(emptyIdLedger(BAY), [b('a'), b('b')]);
  const dropped = reconcileBuildingIds(first.ledger, [b('a')]);
  assert.deepEqual(dropped.retired, [K + 1]);
  assert.deepEqual(dropped.ledger.keys, { a: K });
  assert.deepEqual(dropped.ledger.retired, [K + 1]);
  const back = reconcileBuildingIds(dropped.ledger, [b('a'), b('b')]);
  assert.deepEqual(keysOf(back), { a: K, b: K + 2 }, 'the old key may still name a deed somewhere');
  assert.deepEqual(back.ledger.retired, [K + 1]);
});

test('RMBC1 protected: a protected building is not removed, and not moved without a migration; an unprotected one moves freely (mutants: either guard gone)', () => {
  const first = reconcileBuildingIds(emptyIdLedger(PAST_BAY), [b('home', [10, 10]), b('shed', [20, 20])]);
  const published = first.buildings;
  const gone = reconcileBuildingIds(first.ledger, [b('shed', [20, 20])], { protectedKeys: [K], published });
  assert.equal(gone.ok, false);
  assert.deepEqual(gone.conflicts.map((c) => [c.code, c.key]), [['protected-removed', K]]);
  assert.deepEqual(gone.ledger.keys, { home: K, shed: K + 1 }, 'the key stays kept');
  const moved = reconcileBuildingIds(first.ledger, [b('home', [11, 10]), b('shed', [20, 20])], { protectedKeys: [K], published });
  assert.deepEqual(moved.conflicts.map((c) => [c.code, c.key]), [['protected-moved', K]]);
  const shedMoved = reconcileBuildingIds(first.ledger, [b('home', [10, 10]), b('shed', [25, 20])], { protectedKeys: [K], published });
  assert.equal(shedMoved.ok, true);
  const lifted = reconcileBuildingIds(first.ledger, [b('home', [10, 10], { lift: 0.5 }), b('shed', [20, 20])], { protectedKeys: [K], published });
  assert.deepEqual(lifted.conflicts.map((c) => c.code), ['protected-moved'], 'a floor raised is a move');
});

test('RMBC1 legacy keys pass untouched; two buildings on one anchor and a spent band are refused (mutants: the legacy pass, the dup and spent checks)', () => {
  const legacy = { ...b('rmb:1,2.3'), key: makeBuildingKey(1, 2, 3), source: 'legacy' };
  const r = reconcileBuildingIds(emptyIdLedger(BAY), [legacy, b('a')]);
  assert.equal(r.buildings[0], legacy);
  assert.deepEqual(r.minted, [K]);
  assert.deepEqual(r.ledger.keys, { a: K }, 'a legacy key is its record\'s, never the ledger\'s');
  assert.deepEqual(reconcileBuildingIds(emptyIdLedger(BAY), [b('a'), b('a')]).conflicts.map((c) => c.code), ['anchor-dup']);
  const full = { place: BAY, next: MINTED_KEY_MAX + 1, keys: {}, retired: [] };
  assert.deepEqual(ledgerProblems(full), []);
  assert.deepEqual(reconcileBuildingIds(full, [b('late')]).conflicts.map((c) => c.code), ['keys-spent']);
});

test('RMBC1 a ledger that lies is refused: next behind a key, a key outside the band, a key kept and retired (mutants: each ledger check)', () => {
  assert.deepEqual(ledgerProblems(emptyIdLedger(BAY)), []);
  assert.equal(ledgerProblems({ place: BAY, next: K + 1, keys: { a: K + 1 }, retired: [] }).length, 1);
  assert.equal(ledgerProblems({ place: BAY, next: K + 2, keys: { a: 5 }, retired: [] }).length, 1);
  assert.equal(ledgerProblems({ place: BAY, next: K + 2, keys: { a: K }, retired: [K] }).length, 1);
  assert.equal(ledgerProblems({ place: BAY, next: K - 1, keys: {}, retired: [] }).length, 1);
  assert.equal(reconcileBuildingIds({ place: BAY, next: K, keys: { a: K }, retired: [] }, [b('a')]).ok, false);
});
