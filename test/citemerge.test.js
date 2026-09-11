// CS2 (AUDIT 65 integration) - THE CITE MERGE, tools/citeMerge.mjs: a
// merge of two sides that each ran citeShift carries lines at THEIR
// numbers and at OURS, and one base fits neither. The pure half is
// pinned here: a line is mapped from the side it came from, the bare
// continuations after a cite move with it (content-checked), and a
// continuation after ANOTHER file's cite is not this file's to move -
// the exact mis-attribution the first integration run made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLine, provenance } from '../tools/citeMerge.mjs';

const T = 'src/scenes/world.js';
// the target gained one line at the top: every old line N is new line N+1
const oldLines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const newLines = ['NEW', ...oldLines];
const shifted = { map: (n) => (n <= 10 ? n + 1 : null), oldLines, newLines };

test('citeMerge: the primary cite and the continuations after it move by the map, under the content check (mutant: a continuation left at the old number)', () => {
  const r = mapLine('// world.js:3/:5 and `:7` gate it (world\\.js:2-4)', T, shifted);
  assert.equal(r.out, '// world.js:4/:6 and `:8` gate it (world\\.js:3-5)');
  assert.equal(r.moved, 4);
  assert.deepEqual(r.held, []);
});

test('citeMerge: a continuation after ANOTHER file\'s cite is not this target\'s (mutant: the region runs to the end of the line)', () => {
  // `/:5` belongs to talk.js - world.js must leave it alone, whatever the map says
  const r = mapLine('// world.js:3, then talk.js:2/:5 and `:2`', T, shifted);
  assert.equal(r.out, '// world.js:4, then talk.js:2/:5 and `:2`');
  assert.equal(r.moved, 1);
});

test('citeMerge: a cite whose content moved away is HELD, not renumbered; inside an edited hunk likewise (mutant: the check dropped)', () => {
  const drifted = { ...shifted, newLines: ['NEW', 'a', 'b', 'X', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] };
  const r = mapLine('// world.js:3 and world.js:4', T, drifted);
  assert.equal(r.out, '// world.js:3 and world.js:5', 'the drifted one stays for a person, the other moves');
  assert.deepEqual(r.held.map((h) => [h.status, h.text, h.to]), [['mismatch', 'world.js:3', 4]]);
  const inside = mapLine('// world.js:3', T, { ...shifted, map: () => null });
  assert.equal(inside.out, '// world.js:3');
  assert.deepEqual(inside.held.map((h) => h.status), ['inside']);
});

test('citeMerge: a path before the basename must be the target\'s own, and the Ledger-row spellings move as primaries (mutant: another file\'s path taken, or the row form missed)', () => {
  assert.equal(mapLine('// ui/world.js:3', T, shifted).out, '// ui/world.js:3', 'another world.js');
  assert.equal(mapLine('// src/scenes/world.js:3', T, shifted).out, '// src/scenes/world.js:4', 'this one');
  const L = 'bible/01-Overview/Port-Ledger.md';
  const r = mapLine('| world.js:3 - Ledger rows `:5` and `:6` |', L, { map: (n) => n + 1, oldLines, newLines: ['NEW', ...oldLines] });
  assert.equal(r.out, '| world.js:3 - Ledger rows `:6` and `:7` |', 'the Ledger-row spelling is a primary here too, and the bare one after it follows; world.js is not this target');
  assert.equal(r.moved, 2);
});

test('citeMerge: provenance is theirs first, then ours, else the merge\'s own (mutant: ours first, or a new line claimed)', () => {
  const theirs = new Set(['shared', 'only theirs']), ours = new Set(['shared', 'only ours']);
  assert.equal(provenance('shared', theirs, ours), 'theirs');
  assert.equal(provenance('only theirs', theirs, ours), 'theirs');
  assert.equal(provenance('only ours', theirs, ours), 'ours');
  assert.equal(provenance('written by the merge', theirs, ours), null);
  assert.equal(provenance('only ours', null, ours), 'ours', 'a file new on our side');
});
