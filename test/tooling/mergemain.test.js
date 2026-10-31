// AUDIT RELEASE R3 (2026-10-26, bible/01-Overview/audits/Audit-Release-R3.md "Merging main"): tools/mergeMain.mjs's pure
// half - the rules every merge of main into a long branch applies by hand, held so the redo of the merge takes minutes.
// tools/mutants/mergemain.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hunksOf, joinHunks, mergePinLine, mergePinHunk, mergeVersionHunk, mergeImportHunk, mergeNumbersHunk, mergeTable, sweepLine, renumberNote, renumbered } from '../../tools/mergeMain.mjs';

const H = (ours, theirs, base = []) => ({ ours, base, theirs, head: '<<<<<<< ours', tail: '>>>>>>> theirs' });

test('MERGE-MAIN the hunks: a file split into its plain runs and its conflicts, and joined back - resolved as written, unresolved as it was (mutants: the base dropped from an unresolved hunk)', () => {
  const text = ['a', '<<<<<<< ours', 'o', '||||||| base', 'b', '=======', 't', '>>>>>>> theirs', 'z'].join('\n');
  const parts = hunksOf(text);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts[1].ours, ['o']);
  assert.deepEqual(parts[1].base, ['b']);
  assert.deepEqual(parts[1].theirs, ['t']);
  assert.equal(joinHunks(parts), text, 'unresolved, the hunk as it was - its base kept');
  parts[1].lines = ['o', 't'];
  assert.equal(joinHunks(parts), 'a\no\nt\nz');
  assert.throws(() => hunksOf('<<<<<<< ours\nx'), /unterminated/);
});

test('MERGE-MAIN a pin: main\'s line, its version the next past main\'s, the branch\'s own clause first in its history and noted where it stood - an asserted value, a regex, a comment (mutants: the version left at main\'s; the branch\'s clause lost; the note missing; one number both sides left alone)', () => {
  const ours = "  assert.equal(RELAY_VERSION, 'world260', 'PIN MOVED: world260, TESA (#1184; a gate past the Bay); PIN MOVED: world259, ASK-LONGER (x)');";
  const theirs = "  assert.equal(RELAY_VERSION, 'world265', 'PIN MOVED: world265, GATE-COURTS (courts); PIN MOVED: world264, REWARD-KILLS (y)');";
  assert.equal(mergePinLine(ours, theirs, 'world', 266),
    `  assert.equal(RELAY_VERSION, 'world266', 'PIN MOVED: world266, TESA (${renumberNote('world', 260, 265)}; #1184; a gate past the Bay); PIN MOVED: world265, GATE-COURTS (courts); PIN MOVED: world264, REWARD-KILLS (y)');`);
  assert.equal(renumberNote('world', 260, 265), 'world260 on its branch, renumbered past world260-world265 on main at the merge');
  assert.doesNotMatch(renumberNote('acct', 189, 193), /'/, 'no quote - the note lands inside quoted strings');
  const toml = mergePinLine('  assert.match(toml, /ACCOUNT_VERSION = "acct189"/);   // PIN MOVED: acct189, TESA (a)', '  assert.match(toml, /ACCOUNT_VERSION = "acct193"/);   // PIN MOVED: acct193, COPY-LIFT (c)', 'acct', 194);
  assert.equal(toml, `  assert.match(toml, /ACCOUNT_VERSION = "acct194"/);   // PIN MOVED: acct194, TESA (${renumberNote('acct', 189, 193)}; a); PIN MOVED: acct193, COPY-LIFT (c)`);
  const rx = mergePinLine('  assert.match(ACCOUNT_VERSION, /^acct189$/   /* PIN MOVED: acct189, TESA (a) */);', '  assert.match(ACCOUNT_VERSION, /^acct193$/   /* PIN MOVED: acct193, COPY-LIFT (c) */);', 'acct', 194);
  assert.match(rx, /^  assert\.match\(ACCOUNT_VERSION, \/\^acct194\$\//, 'a regex literal\'s version moved too (the trial missed three: prof9, prof10, prof12)');
  assert.equal(mergePinLine('a line', 'another', 'world', 266), null, 'no pin, no rule');
  assert.equal(mergePinLine("x('world260')", "x('world260')", 'world', 266), null, 'one version both sides is no renumber');
  const same = mergePinLine("  assert.equal(RELAY_VERSION, 'world268', 'PIN MOVED: world268, TESA (a)');", "  assert.equal(RELAY_VERSION, 'world268', 'PIN MOVED: world268, NIRNROOT-SAGE (n)');", 'world', 269);
  assert.equal(same, `  assert.equal(RELAY_VERSION, 'world269', 'PIN MOVED: world269, TESA (${renumberNote('world', 268, 268)}; a); PIN MOVED: world268, NIRNROOT-SAGE (n)');`,
    'one number both sides took, on two lines, is a renumber - main took the branch\'s own (the second merge: world268 both)');
  assert.equal(renumberNote('world', 268, 268), 'world268 on its branch, renumbered past world268 on main at the merge');
  assert.deepEqual(mergePinHunk(H(['same', ours], ['same', theirs]), 'world', 266), ['same', mergePinLine(ours, theirs, 'world', 266)]);
  assert.equal(mergePinHunk(H(['x', ours], ['y', theirs]), 'world', 266), null, 'a line that is neither shared nor a pin leaves the hunk to a person');
});

test('MERGE-MAIN the version line: the branch\'s declaration at the next number, its notes after, main\'s line a comment and its notes after that; the toml twin (mutants: main\'s line dropped; the toml rule on the relay)', () => {
  const h = H(
    ["export const RELAY_VERSION = 'world260';   // world260: TESA's", '// (world260, WW2) a lane', '// world259: shared'],
    ["export const RELAY_VERSION = 'world265';   // world265: GATE-COURTS", '// world264: REWARD', '// world259: shared'],
    ["export const RELAY_VERSION = 'world259';   // world259: shared"],
  );
  assert.deepEqual(mergeVersionHunk(h, 'world', 266), [
    `export const RELAY_VERSION = 'world266';   // world266: (${renumberNote('world', 260, 265)}) TESA's`,
    '// (world266, WW2) a lane',
    '// world265: GATE-COURTS',
    '// world264: REWARD',
    '// world259: shared',
  ]);
  const toml = H(['ACCOUNT_VERSION = "acct189"'], ['ACCOUNT_VERSION = "acct193"']);
  assert.deepEqual(mergeVersionHunk(toml, 'acct', 194), ['ACCOUNT_VERSION = "acct194"']);
  assert.equal(mergeVersionHunk(toml, 'world', 266), null, 'the account\'s toml is no relay line');
});

test('MERGE-MAIN imports: each module\'s names unioned, main\'s order then the branch\'s extras, a module either side added kept, both notes (mutants: the branch\'s extras dropped)', () => {
  const h = H(
    ["import { a, b, lane } from './gate.js';   // WW2: a lane"],
    ["import { a, b, court } from './gate.js';", "import { book } from './courts.js';   // GATE-COURTS"],
  );
  assert.deepEqual(mergeImportHunk(h), ["import { a, b, court, lane } from './gate.js';   // WW2: a lane", "import { book } from './courts.js';   // GATE-COURTS"]);
  assert.equal(mergeImportHunk(H(['const x = 1;'], ["import { a } from './a.js';"])), null);
  assert.deepEqual(mergeImportHunk(H(["import { a } from './x.js';   // N"], ["import { a, b } from './x.js';   // N; more"])), ["import { a, b } from './x.js';   // N; more"], 'a note one side only lengthened is that side\'s, never said twice');
});

test('MERGE-MAIN a line number both sides moved: ours + theirs - base, where the three are one text but their numbers (mutants: theirs alone; no base asked)', () => {
  assert.deepEqual(mergeNumbersHunk(H(['the row `Port-Ledger.md:859`, and :864'], ['the row `Port-Ledger.md:864`, and :869'], ['the row `Port-Ledger.md:854`, and :859'])), ['the row `Port-Ledger.md:869`, and :874']);
  assert.equal(mergeNumbersHunk(H(['row :855 here'], ['row :860 there'], ['row :850 here'])), null, 'words changed too: a person');
  assert.equal(mergeNumbersHunk(H(['row :855'], ['row :860'])), null, 'no base, no arithmetic');
});

test('MERGE-MAIN a keyed table, three ways: added either side kept, deleted where the other left it, one side\'s change taken, main\'s where both changed (mutants: a deletion resurrected; the branch\'s change lost)', () => {
  const m = (o) => new Map(Object.entries(o));
  const { table, clashes } = mergeTable(m({ a: 1, b: 1, c: 1, d: 1 }), m({ a: 2, b: 1, d: 3, x: 9 }), m({ a: 1, c: 1, d: 4, y: 8 }));
  assert.deepEqual(Object.fromEntries(table), { a: 2, d: 4, x: 9, y: 8 }, 'a: the branch\'s change; b: main deleted it; c: the branch deleted it; d: both changed - main\'s');
  assert.deepEqual(clashes, ['d']);
});

test('MERGE-MAIN the sweep: a pin outside the conflicts that still names an old version moved, with its clause; any other line untouched (mutants: an unnamed version swept)', () => {
  assert.equal(sweepLine("  assert.equal(RELAY_VERSION, 'world265');", 'world', [260, 265], 266, 'the merge'), "  assert.equal(RELAY_VERSION, 'world266');   // PIN MOVED: world266, the merge");
  assert.equal(sweepLine("  assert.equal(RELAY_VERSION, 'world250');", 'world', [260, 265], 266, 'the merge'), "  assert.equal(RELAY_VERSION, 'world250');");
});

test('MERGE-MAIN (AUDIT FB1029g) what a merge renumbers: a kind the branch bumped that main reached or passed - never one the branch left at the base, whose pins are main\'s (mutants: the base unread; a branch ahead of main renumbered)', () => {
  assert.deepEqual(renumbered({ world: { base: 286, ours: 286, theirs: 288 }, acct: { base: 220, ours: 221, theirs: 222 } }), ['acct'], 'the relay never bumped here: main\'s world288 stands');
  assert.deepEqual(renumbered({ world: { base: 286, ours: 287, theirs: 287 }, acct: { base: 220, ours: 220, theirs: 220 } }), ['world'], 'both took 287: the branch\'s goes past');
  assert.deepEqual(renumbered({ world: { base: 286, ours: 288, theirs: 287 }, acct: { base: 220, ours: 220, theirs: 223 } }), [], 'ahead of main: nothing moves');
});
