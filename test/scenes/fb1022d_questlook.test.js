// AUDIT FB1022d E8 (bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md, report 5 - the quest marks): the quest lens's
// look, a tick at 10 Hz, asks the walk for no window rows (questBridge.js `bridge.questLog({ windows: false })`, AUDIT
// QUESTLINES LAW-11) - and world.js's BOUNTY1 wrapper, which lays the bounties, the hunts and the death quests on the
// walk, took no argument: every look walked the questlines' and the ladders' rows the law leaves out. Not the report's
// loss of the marks (that was not reproduced); the law's cost, paid again. Driven over world.js's own wrapper, its text
// run as the host runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQuestBridge } from '../../src/scenes/quest/questBridge.js';
import { loadTables, questSource } from '../qlSources.mjs';

const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

test('AUDIT FB1022d E8 (QUEST-AUDIT IV JOURNAL-2, PIN MOVED: the host\'s rows ride the bridge\'s own walk through addQuestRows - no wrapper stands between the lens and it): the lens\'s `{ windows: false }` walks no window rows, and the bounties and the hunts lie on either walk (mutants: the argument dropped; the rows off a walk)', () => {
  assert.match(world, /questBridge\.addQuestRows\(\(\) => \[/, 'the world host lays its rows through the seam');
  assert.doesNotMatch(world, /questBridge\.questLog = /, 'no wrapper');
  loadTables();
  const bridge = createQuestBridge({ data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n) }, classicSeconds: () => 0, skySeconds: () => 0, worldSeconds: () => 0 }, { label: 'e8' });
  bridge.addQuestRows(() => [{ id: 'bounty:1', name: 'Bounty', messages: [[{ formatting: 'text', text: 'Slain: 0 of 5.' }]] }, { id: 'hunt:1', name: 'Hunt', messages: [[{ formatting: 'text', text: 'Orc.' }]] }]);
  const look = bridge.questLog({ windows: false });
  assert.deepEqual(look.lines, [], 'no window rows walked');
  assert.deepEqual(look.active.map((q) => q.id), ['bounty:1', 'hunt:1'], 'the bounties and the hunts laid on it');
  assert.deepEqual(bridge.questLog().active.map((q) => q.id), ['bounty:1', 'hunt:1'], 'and on the windows\' walk');
});
