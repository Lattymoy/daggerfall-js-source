// LOOT-SCROLL (FIELD BUGS 2026-10-11g #4, the Discord's "Can't scroll loot pile / corpse": "this problem appeared about
// 2 or 3 days ago. I can't scroll the item list with mouse wheel for some reason. I can still take items from list one by
// one to get to the bottom of it", a screenshot of an Elite Daedra Seducer's body - six rows and "and 3 more"). The wheel
// was never broken: the plaque showed six rows (systems/worldHover.js HOVER_MAX, "a pile is a glance") and the rest were
// a count the wheel and the take could not reach - and BAL4 (2026-10-10) brought an elite's grant, appended past the
// sixth row, to every game with the rarity tiers on. The frame carries every row now; the plaque draws a window of six
// about the lit one (plaqueWindow), and the classic panel the same window. Driven through the real plaque in
// test/systems/worldhover.test.js; here, the window's law and the classic panel's words. bible/01-Overview/bugs/Field-Bugs-2026-10-11g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plaqueWindow, resolveHover, hoverItemAt, HOVER_MAX } from '../../src/systems/worldHover.js';
import { lootPanelLines } from '../../src/ui/classicLootPanel.js';

const items = (n) => Array.from({ length: n }, (_, i) => ({ name: `Thing ${i}`, group: 'Weapons', templateIndex: 121 }));
const pile = (n) => resolveHover({ key: 'corpse:1', distance: 1, reach: 3.2 }, { contents: () => items(n), name: () => ({ title: 'Body' }) });
const names = (f) => f.rows.map((r) => r.name);

test('LOOT-SCROLL: the window - six rows that keep the lit one in view; a light inside it moves nothing, past its edge moves it one row; what it leaves above and below counted; a pile of six or fewer is drawn whole (mutants: the window still; it jumps a page; the counts)', () => {
  const f = pile(HOVER_MAX + 3);
  assert.equal(f.rows.length, HOVER_MAX + 3, 'the frame carries every row');
  let w = plaqueWindow(f, 0, 0);
  assert.deepEqual([w.from, names(w.frame), w.frame.above, w.frame.rest], [0, ['Thing 0', 'Thing 1', 'Thing 2', 'Thing 3', 'Thing 4', 'Thing 5'], 0, 3]);
  w = plaqueWindow(f, 5, 0);
  assert.equal(w.from, 0, 'the last row of the window lit: the window holds');
  w = plaqueWindow(f, 6, w.from);
  assert.deepEqual([w.from, names(w.frame)[0], names(w.frame)[5], w.frame.above, w.frame.rest], [1, 'Thing 1', 'Thing 6', 1, 2], 'one past its edge: one row on');
  w = plaqueWindow(f, 8, w.from);
  assert.deepEqual([w.from, w.frame.above, w.frame.rest], [3, 3, 0], 'the end of the pile');
  w = plaqueWindow(f, 5, w.from);
  assert.equal(w.from, 3, 'back up inside the window: it holds');
  w = plaqueWindow(f, 1, w.from);
  assert.deepEqual([w.from, w.frame.above], [1, 1], 'up past its top: it follows');
  assert.equal(plaqueWindow(f, -1, 99).from, HOVER_MAX + 3 - HOVER_MAX, 'a top past the end is clamped');
  const six = pile(HOVER_MAX);
  assert.equal(plaqueWindow(six, 5, 0).frame, six, 'six or fewer: the frame as it is');
  assert.equal(plaqueWindow(null).frame, null);
  const door = { key: 'door:1', kind: 'name', rows: [], rest: 0 };
  assert.equal(plaqueWindow(door, -1).frame, door, 'a name is no list');
});

test('LOOT-SCROLL: the take reaches every row - the lit row is the pile\'s, not the window\'s (mutants: the take bounded by the window)', () => {
  const list = items(HOVER_MAX + 3);
  assert.equal(hoverItemAt(list, HOVER_MAX + 2, Infinity)?.name, `Thing ${HOVER_MAX + 2}`);
  assert.equal(hoverItemAt(list, HOVER_MAX + 3, Infinity), null, 'past the pile: nothing');
  assert.match(readFileSync(new URL('../../src/systems/quickLoot.js', import.meta.url), 'utf8'), /return hoverItemAt\(items, _sel\.row, Infinity\);/, 'the take asks the whole pile');
});

test('LOOT-SCROLL: the classic panel draws the same window - its foot line says what is above and below in one line, so its parchment keeps its one foot (mutants: the rows above unsaid)', () => {
  const f = pile(HOVER_MAX + 3);
  assert.equal(lootPanelLines(plaqueWindow(f, 0, 0).frame).more, 'and 3 more');
  assert.equal(lootPanelLines(plaqueWindow(f, 6, 0).frame).more, '1 above, 2 more');
  assert.equal(lootPanelLines(plaqueWindow(f, 8, 0).frame).more, '3 more above');
  assert.equal(lootPanelLines(pile(3)).more, null);
  assert.deepEqual(lootPanelLines(plaqueWindow(f, 8, 0).frame).rows, ['Thing 3', 'Thing 4', 'Thing 5', 'Thing 6', 'Thing 7', 'Thing 8']);
});
