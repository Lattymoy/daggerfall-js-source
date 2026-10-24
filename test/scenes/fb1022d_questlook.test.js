// AUDIT FB1022d E8 (bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md, report 5 - the quest marks): the quest lens's
// look, a tick at 10 Hz, asks the walk for no window rows (questBridge.js `bridge.questLog({ windows: false })`, AUDIT
// QUESTLINES LAW-11) - and world.js's BOUNTY1 wrapper, which lays the bounties, the hunts and the death quests on the
// walk, took no argument: every look walked the questlines' and the ladders' rows the law leaves out. Not the report's
// loss of the marks (that was not reproduced); the law's cost, paid again. Driven over world.js's own wrapper, its text
// run as the host runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

test('AUDIT FB1022d E8: world.js\'s quest log wrapper hands the lens\'s `{ windows: false }` to the walk, and lays its rows on either walk (mutants: the argument dropped)', () => {
  const m = /\n( +)questBridge\.questLog = [\s\S]*?\n\1\};/.exec(world);
  assert.ok(m, 'the wrapper');
  const wrap = new Function('questBridge', 'baseQuestLog', 'bountyHost', 'revenantHuntEntries', 'rumorHere', 'legacyHost', m[0]);
  const asked = [];
  const bridge = {};
  const base = (o) => { asked.push(o); return { active: [{ id: 'q1' }], lines: o?.windows === false ? [] : ['a line'] }; };
  wrap(bridge, base, { questLogEntries: () => [{ id: 'bounty' }] }, () => [{ id: 'hunt' }], () => null, { questLogEntries: () => [] });
  const look = bridge.questLog({ windows: false });
  assert.deepEqual(asked, [{ windows: false }], 'the look\'s word reaches the walk');
  assert.deepEqual(look.lines, [], 'no window rows walked');
  assert.deepEqual(look.active.map((q) => q.id), ['q1', 'bounty', 'hunt'], 'the bounties and the hunts laid on it still');
  const windows = bridge.questLog();
  assert.deepEqual(windows.lines, ['a line'], 'the windows\' walk has them');
});
