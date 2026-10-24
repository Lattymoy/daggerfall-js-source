// FIRM2 (2026-10-15): every star counts - no channel of any sign sums past its cap - and the sky's attributes may stand
// past the 100 ceiling by what the sky adds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRM_NODES, SIGNS } from '../../../src/net/firmament/firmamentTree.js';
import { statDef } from '../../../src/net/firmament/firmamentLaw.js';
import { liveStat } from '../../../src/systems/statMods.js';

test('FIRM2: over one sign\'s whole sky no channel sums past its cap', () => {
  for (const s of SIGNS) {
    const sum = {};
    for (const n of FIRM_NODES.values()) if (n.sector === s.id) for (const [k, v] of Object.entries(n.stats)) sum[k] = (sum[k] ?? 0) + v;
    for (const [k, v] of Object.entries(sum)) { const d = statDef(k); assert.ok(d, `${s.id} ${k}: no channel`); assert.ok(v <= d.max, `${s.id} ${k} sums to ${v}, cap ${d.max}`); }
  }
});

test('FIRM2: a small star\'s attribute share is one for one', () => {
  assert.deepEqual({ ...FIRM_NODES.get('mg.s1').stats }, { 'pct.intelligence': 2 });
  assert.deepEqual({ ...FIRM_NODES.get('wr.g').stats }, { 'pct.strength': 2, 'pct.endurance': 2 });
});

test('FIRM2: the sky lifts an attribute past 100 by what it adds', () => {
  const e = { stats: { strength: 100 }, activeEffects: [], _mods: { stats: { strength: 9 }, statMax: { strength: 9 } } };
  assert.equal(liveStat(e, 'strength'), 109);
  const plain = { stats: { strength: 100 }, activeEffects: [], _mods: { stats: { strength: 9 } } };
  assert.equal(liveStat(plain, 'strength'), 100);
});
