// AUDIT QUESTLINES (2026-10-19, the owner: "Audit everything built. Ensure perfection"; bible/01-Overview/audits/
// Audit-Questlines.md): THE LAW'S OWN PINS (systems/questlines/qlLaw.js) - what the lane DOC's probes showed no test
// read: a foe never placed is no foe dead (DOC-15, W1), the catch-all failure yields to DFU's word that the quest
// succeeded (DOC-16, W2), and the success fallback is the sheet's own - `success`, else `done` - never a guess (LAW-1:
// "the first non-failure outcome" filed a loyal M0B11Y18 as `betrayed`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holds, observe, fallbackOutcome, freshState } from '../../../src/systems/questlines/qlLaw.js';

/** A quest as the law reads it: its state stamped, its resources by inner name, its end. */
const questOf = ({ success = false, complete = false, resources = {} } = {}) => ({
  ql: freshState(), questSuccess: success, questComplete: complete, ticksToEnd: 0,
  tasks: new Map(), resources: new Map(Object.entries(resources)),
});

test('AUDIT QUESTLINES DOC-15: a foe never placed is no foe dead - its kills must reach its spawns, and at least one (mutants: the Math.max(1, ...))', () => {
  const q = (killCount, spawnCount) => questOf({ resources: { beast: { isFoe: true, killCount, spawnCount } } });
  assert.equal(holds(q(0, 0), { foeDead: '_beast_' }), false, 'not yet placed');
  assert.equal(holds(q(1, 2), { foeDead: '_beast_' }), false);
  assert.equal(holds(q(2, 2), { foeDead: '_beast_' }), true);
  assert.equal(holds(q(1, 0), { foeDead: '_beast_' }), true, 'one slain of a foe the script never counted');
});

test('AUDIT QUESTLINES DOC-16, LAW-1: at the end, the catch-all failure yields to DFU\'s success - to the sheet\'s own success fallback (`success`, else `done`), never the first outcome that is no failure; a failed quest keeps its failure (mutants: the yield; the first non-failure)', () => {
  const sheet = (extra = {}) => ({
    quest: 'TEST', objectives: [], branches: [], ...extra,
    outcomes: [
      { id: 'betrayed', text: 'Sold the letter.', on: { task: '_sold_' }, pay: 'betrayal' },
      { id: 'loyal', text: 'Kept faith.', on: { task: '_kept_' }, pay: 'standard' },
      ...(extra.done ? [{ id: 'done', text: 'Done.', on: { task: '_never_' }, pay: 'standard' }] : []),
      { id: 'failed', text: 'It failed.', on: { ended: true }, pay: 'none', failure: true },
    ],
  });
  const settle = (s, success) => { const q = questOf({ success, complete: true }); observe(q, s, {}, { settle: true, ending: true }); return q.ql.outcome; };
  assert.equal(settle(sheet({ success: 'loyal' }), true), 'loyal', 'the sheet\'s `success`');
  assert.equal(settle(sheet({ done: true }), true), 'done', 'else its `done`');
  assert.equal(settle(sheet(), true), 'failed', 'neither: never a guess - never `betrayed`, the first non-failure');
  assert.equal(settle(sheet({ success: 'loyal' }), false), 'failed', 'a failed quest keeps its failure');
  assert.equal(fallbackOutcome({ questSuccess: true }, sheet({ success: 'failed' })), null, 'a `success` naming a failure is none');
});
