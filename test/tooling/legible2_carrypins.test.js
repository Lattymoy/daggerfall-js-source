// LEGIBLE 2 (bible/01-Overview/Readability-Arc.md): tools/carryPins.mjs moves the mutant records and the cites through a
// mechanical change, so a formatter or a rename does not stale the 65,940 records and the cites that quote the code.
// The change here is test/breakLines.mjs, a layout-only transform; the proofs are that a carried record reproduces the
// transformed mutant exactly and names one site, and that a carried cite names a line the cited code moved to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carryMutant, carryCites, lineMap } from '../../tools/carryPins.mjs';
import { ANCHOR, resolveAnchor, maskAnchors, trackedSets } from '../../tools/citeAnchor.mjs';
import { sameProgram } from '../../tools/sameProgram.mjs';
import { breakLines } from '../breakLines.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const occurrences = (text, find) => text.split(find).length - 1;
const applyRecord = (text, record) => {
  const at = text.indexOf(record.old);
  return text.slice(0, at) + record.new + text.slice(at + record.old.length);
};

const FIXTURE = [
  'const LIMIT = 3;   // the cap',
  'export function step(state) { if (state.n > LIMIT) { state.n = 0; } state.n++; return state; }',
  'export function twice(state) { step(state); step(state); return state; }',
  '/* A block comment',
  '   whose second line is cited */',
  "register({ name: 'one', run() { first(); } });",
  "register({ name: 'two', run() { second(); } });",
  '',
].join('\n');

/** Every record carried must name one site of the transformed file and reproduce the transformed mutant exactly. */
const assertCarried = (record, source, transform, label) => {
  const result = carryMutant(record, source, transform);
  assert.ok(result.record, `${label}: not carried - ${result.error}`);
  const transformed = transform(source);
  assert.equal(occurrences(transformed, result.record.old), 1, `${label}: the carried record names ${occurrences(transformed, result.record.old)} sites`);
  assert.equal(applyRecord(transformed, result.record), transform(applyRecord(source, record)), `${label}: the carried record does not reproduce the transformed mutant`);
  return result.record;
};

test('LEGIBLE 2 carryMutant: a record is carried by transforming the file with and without its mutant - widened to whole lines, and further until it names one site (mutants: the stretch never widened)', () => {
  const sharp = assertCarried({ name: 'a', old: 'state.n > LIMIT', new: 'state.n >= LIMIT' }, FIXTURE, breakLines, 'one comparison');
  assert.equal(sharp.old, 'if (state.n > LIMIT) {', 'carried as the whole line the comparison now stands on');
  assert.equal(sharp.new, 'if (state.n >= LIMIT) {');
  // `step(state);` stands twice once the line is split: the record widens until it names one site
  const dropped = assertCarried({ name: 'b', old: 'step(state); step(state);', new: 'step(state);' }, FIXTURE, breakLines, 'a dropped call');
  assert.ok(dropped.old.split('\n').length > 1, 'a line that stands twice is widened past itself');
  assert.equal(dropped.name, 'b', 'the rest of the record rides along');
});

test('LEGIBLE 2 carryMutant: what cannot be carried is reported, never guessed - a stale record, a mutant the transform erases, a mutant it cannot run on; a record whose text stands twice is carried at its first copy, as mutate.mjs applies it, and names that one site', () => {
  assert.match(carryMutant({ old: 'not in the file', new: 'x' }, FIXTURE, breakLines).error, /does not apply/);
  const first = assertCarried({ name: 'twice', old: 'step(state);', new: 'step(other);' }, FIXTURE, breakLines, 'a text that stands twice');
  assert.equal(applyRecord(breakLines(FIXTURE), first), breakLines(FIXTURE.replace('step(state);', 'step(other);')), 'the first copy is the one mutated');
  const dropComments = (src) => breakLines(src).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(carryMutant({ old: 'whose second line', new: 'whose 2nd line' }, FIXTURE, dropComments).error, /erases the mutant/);
  assert.match(carryMutant({ old: 'state.n++;', new: 'state.n++; "unterminated' }, FIXTURE, breakLines).error, /cannot run on the mutant/);
});

test('LEGIBLE 2 lineMap: a line maps to every line its tokens moved to, and a line inside a block comment keeps its offset in the comment (mutants: a comment\'s inner lines lost)', () => {
  const map = lineMap(FIXTURE, breakLines(FIXTURE));
  const after = breakLines(FIXTURE).split('\n');
  assert.deepEqual(map(1), [1]);
  const stepLines = map(2);
  assert.ok(stepLines.length > 3, 'the crowded line became several');
  assert.equal(after[stepLines[0] - 1], 'export function step(state) {');
  const [inner] = map(5);
  assert.equal(after[inner - 1], '   whose second line is cited */');
});

test('LEGIBLE 2 carryCites: an anchor into a changed file is carried to the line its code moved to, written by citeAnchor\'s rules; one in a code string is left for a person (mutants: only the first of a split line\'s lines tried; an anchor in code written)', () => {
  // built in pieces, so this file itself carries no anchor into a file the tree does not have (citeanchor CA1)
  const cite = (quote) => `fixture.js${':"'}${quote}"`;
  const doc = [
    `The cap is checked at ${cite('if (state.n > LIMIT)')}, and the comment at ${cite('whose second line is cited')}.`,
    `The second registration is ${cite("register({ name: 'two'")}.`,
  ].join('\n');
  const testFile = "const pinned = 'fixture.js:\"state.n++\"';\n";
  const { docs, carried, failed } = carryCites({
    docs: new Map([['bible/fixture.md', doc], ['test/fixture.test.js', testFile]]),
    oldText: () => FIXTURE,
    newText: () => breakLines(FIXTURE),
    changed: new Set(['src/fixture.js']),
    codeFiles: ['src/fixture.js'],
  });
  assert.equal(carried, 3);
  const after = breakLines(FIXTURE), lines = after.split('\n'), masked = maskAnchors(after);
  const landed = [...docs.get('bible/fixture.md').matchAll(ANCHOR)].map((m) => lines[resolveAnchor(masked, lines, m[2], m[3] ?? null).line - 1].trim());
  assert.deepEqual(landed, ['if (state.n > LIMIT) {', 'whose second line is cited */', "name: 'two', run() {"],
    'each carried anchor names the line its code moved to - the registration by its second piece, since `register({` takes no quote');
  assert.equal(docs.get('test/fixture.test.js'), testFile, 'an anchor in a code string is not rewritten');
  assert.deepEqual(failed.map((f) => [f.doc, f.why.includes('a person writes it')]), [['test/fixture.test.js', true]]);
});

test('LEGIBLE 2 on real files: every mutant record on four real files is carried through the layout-only transform, and every transformed file is the same program', () => {
  const files = ['tools/hostScope.mjs', 'test/scenes/hostceiling.test.js', 'src/systems/gambit/gambitPatrons.js', 'src/systems/smithItems.js'];
  let carried = 0;
  for (const list of readdirSync(join(ROOT, 'tools/mutants')).filter((f) => f.endsWith('.json'))) {
    for (const record of JSON.parse(read(`tools/mutants/${list}`))) {
      if (!files.includes(record.file)) continue;
      assertCarried(record, read(record.file), breakLines, `${list}::${record.name}`);
      carried++;
    }
  }
  assert.ok(carried > 200, `only ${carried} records found on the four files`);
  for (const path of files) assert.ok(sameProgram(read(path), breakLines(read(path))).same, `${path} is not the same program after the transform`);
});

test('LEGIBLE 2 on real files: every anchor in the tree into two much-cited files is carried through the layout-only transform to a line the cited code moved to, or reported', () => {
  const changedFiles = ['src/systems/notebook.js', 'src/ui/listPicker.js'];
  const { docs: docPaths, code } = trackedSets(ROOT);
  const newTexts = new Map(changedFiles.map((f) => [f, breakLines(read(f))]));
  const { docs, carried, failed } = carryCites({
    docs: new Map(docPaths.filter((d) => /\b(notebook|listPicker)\.js:"/.test(read(d))).map((d) => [d, read(d)])),
    oldText: read, newText: (f) => newTexts.get(f) ?? read(f), changed: new Set(changedFiles), codeFiles: code,
  });
  assert.ok(carried >= 30, `only ${carried} anchors carried`);
  assert.deepEqual(failed.filter((f) => !f.why.includes('a person writes it')), [], 'a cite the carrier could not place');
  for (const file of changedFiles) {
    const after = newTexts.get(file), lines = after.split('\n'), masked = maskAnchors(after);
    const map = lineMap(read(file), after);
    const base = file.slice(file.lastIndexOf('/') + 1);
    for (const [doc, text] of docs) {
      const before = read(doc);
      for (const m of text.matchAll(ANCHOR)) {
        if (!m[1].endsWith(base) || before.includes(m[0])) continue;   // carried anchors only
        const at = resolveAnchor(masked, lines, m[2], m[3] ?? null);
        assert.ok(at.line, `${doc}: ${m[0]} does not resolve in the transformed ${file} (${at.error})`);
        const candidates = new Set();
        for (let line = 1; line <= read(file).split('\n').length; line++) for (const n of map(line)) candidates.add(n);
        assert.ok(candidates.has(at.line) || [1, 2, 3].some((d) => candidates.has(at.line - d)), `${doc}: ${m[0]} names a line no code moved to`);
      }
    }
  }
});
