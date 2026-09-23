// CS2 (AUDIT 65 integration) - THE CITE MERGE, tools/citeMerge.mjs: a
// merge of two sides that each ran citeShift carries lines at THEIR
// numbers and at OURS, and one base fits neither. The pure half is
// pinned here: a line is mapped from the side it came from, the bare
// continuations after a cite move with it (content-checked), and a
// continuation after ANOTHER file's cite is not this file's to move -
// the exact mis-attribution the first integration run made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLine, provenance, mapSides } from '../tools/citeMerge.mjs';

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

test('citeMerge: provenance names the side that carries the line - both, theirs, ours - else the merge\'s own (mutant: one side first, or a new line claimed)', () => {
  const theirs = new Set(['shared', 'only theirs']), ours = new Set(['shared', 'only ours']);
  assert.equal(provenance('shared', theirs, ours), 'both');
  assert.equal(provenance('only theirs', theirs, ours), 'theirs');
  assert.equal(provenance('only ours', theirs, ours), 'ours');
  assert.equal(provenance('written by the merge', theirs, ours), null);
  assert.equal(provenance('only ours', null, ours), 'ours', 'a file new on our side');
});

// THE SHARED LINE (the contributor drop's merge, 2026-09-23): a comment
// both sides carry verbatim, citing a target the two sides moved
// differently. 'theirs' first walked nine such cites through the drop's
// diff (`spellcost.js:182` -> :181). Its number was read off ONE side's
// target and the line cannot say which - so it moves only where both
// maps land it on the same line, and is held otherwise.
test('citeMerge: a line both sides carry moves only where both maps agree, else it is AMBIGUOUS and untouched (mutant: theirs taken, or ours)', () => {
  const l = '// the floor (world.js:3)';
  const same = mapSides(l, 'both', () => [[T, shifted]]);
  assert.equal(same.ambiguous, undefined);
  assert.equal(same.out, '// the floor (world.js:4)', 'two maps that agree move the cite');
  // ours' target never moved at that line: its map keeps :3, theirs' says :4
  const still = { map: (n) => n, oldLines: newLines, newLines };
  const parted = mapSides(l, 'both', (side) => [[T, side === 'theirs' ? shifted : still]]);
  assert.deepEqual(parted.ambiguous, { theirs: '// the floor (world.js:4)', ours: l });
  assert.equal(parted.out, l, 'a line the two sides read differently is left for a person');
  assert.equal(parted.n, 0);
  // a one-sided line is that side's alone, as before
  assert.equal(mapSides(l, 'theirs', (side) => [[T, side === 'theirs' ? shifted : still]]).out, '// the floor (world.js:4)');
  assert.equal(mapSides(l, 'ours', (side) => [[T, side === 'theirs' ? shifted : still]]).out, l);
});

// ── THE STRUCK LAW, 2026-09-15 ────────────────────────────────────────
//
// citeShift has held struck lines since RF3 and citeMerge never took the
// rule over - the same law in one tool and not its sibling, which is this
// codebase's measured failure mode wearing a different hat. It cost two
// hand repairs inside one hour during the HARD-branch merges: each run
// moved citedrift.test.js's `world\.js:4117-4120`, the escaped literal
// that has to MATCH a struck Ledger row naming a seam FX1 deleted, away
// from the row it matches. A number whose subject is gone is a record of
// where the thing used to be, and moving it makes the record say
// something that was never true.
test('citeMerge: a STRUCK line holds its cites, and --struck moves them anyway (mutant: the strike ignored)', () => {
  const struck = '| ~~**GONE** (F207)~~ FIXED - `world.js:3` and its twin, both DELETED |';
  const r = mapLine(struck, T, shifted);
  assert.equal(r.out, struck, 'a struck row keeps the numbers its subject had');
  assert.equal(r.moved, 0);
  assert.deepEqual(r.held.map((h) => h.status), ['struck']);
  assert.equal(mapLine(struck, T, { ...shifted, moveStruck: true }).out,
    '| ~~**GONE** (F207)~~ FIXED - `world.js:4` and its twin, both DELETED |',
    'and --struck moves them, as citeShift\'s does');
});

test('citeMerge: an escaped literal quoting a struck-only number is PINNED to it (mutant: the pin quotes a row that no longer exists)', () => {
  // the shape that bit twice: a pin in citedrift.test.js whose whole job
  // is to match a struck Ledger row verbatim.
  const pin = "  [/`world\\.js:3` and its `exterior\\.js` twin, both DELETED by FX1/, 'no loot'],";
  assert.equal(mapLine(pin, T, shifted).out.includes('world\\.js:4'), true,
    'with no holdEscaped it moves - which is the bug this rule fixes');
  const r = mapLine(pin, T, { ...shifted, holdEscaped: new Set([3]) });
  assert.equal(r.out, pin, 'held: the literal is a quote of the struck row, not a reference to a live line');
  assert.deepEqual(r.held.map((h) => h.status), ['pinned-struck']);
  // a number the docs DO carry live is not pinned, whatever else quotes it
  assert.equal(mapLine(pin, T, { ...shifted, holdEscaped: new Set([9]) }).out.includes('world\\.js:4'), true);
});

test('citeMerge: mapLine REPORTS what it saw, which is how the caller learns the struck-only numbers (mutant: pass one blind)', () => {
  // pass one reads `seen` over every doc to find the numbers that appear
  // on struck lines and nowhere live; escaped spellings are excluded from
  // that census, because a quote is not evidence of where a line is.
  const seen = mapLine('| ~~x~~ `world.js:3` (world\\.js:3) |', T, shifted).seen;
  assert.deepEqual(seen, [{ a: 3, status: 'struck', escaped: false }, { a: 3, status: 'struck', escaped: true }]);
  const live = mapLine('// world.js:3 and world\\.js:5', T, shifted).seen;
  assert.deepEqual(live.map((s) => [s.a, s.status, s.escaped]), [[3, 'move', false], [5, 'move', true]]);
});
