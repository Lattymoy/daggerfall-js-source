// LEGIBLE 5 (bible/01-Overview/Readability-Arc.md, bible/01-Overview/Glossary.md): a binding of one or two characters,
// or an abbreviation the glossary retires, is counted a file at a time by tools/shortNames.mjs and held to
// tools/shortNamesBaseline.json, which only goes down. A name the glossary allows is not counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BASELINE, glossary, shortIn, measure, verdict, lowered, carried } from '../../tools/shortNames.mjs';

const base = JSON.parse(readFileSync(new URL(`../../${BASELINE}`, import.meta.url), 'utf8'));
const words = glossary();
const names = (src) => shortIn(src, words).map((b) => b.name);

test('LEGIBLE 5 the glossary: its first list is the short names code may use, its last the abbreviations being retired (mutants: a list unread)', () => {
  for (const n of ['i', 'j', 'k', 'x', 'y', 'z', 'dt', 'px', 'py', 'id', 'e', '_', 'at', 'to']) assert.ok(words.allowed.has(n), n);
  for (const n of ['p', 'r', 's', 'dw', 'Daggerfall']) assert.ok(!words.allowed.has(n), n);
  assert.deepEqual([...words.retired], ['dw', 'csa', 'wod', 'lpt', 'hcc', 'mwv']);
});

test('LEGIBLE 5 every way to bind a name is counted - a variable, a destructured one, a function, its parameters, a class, a catch - and a key, a member or a long name is not (mutants: each binding kind unread)', () => {
  assert.deepEqual(names('const p = 1;'), ['p']);
  assert.deepEqual(names('let { a: q, r = 2, ...s } = o; const [u, , v] = w;'), ['q', 'r', 's', 'u', 'v']);
  assert.deepEqual(names('function fx(m, [h]) {} const g = (c) => c; class K {}'), ['fx', 'm', 'h', 'g', 'c', 'K']);
  assert.deepEqual(names("const W = class Q {}; import { t } from './x.js';"), ['W', 'Q'], 'AUDIT (2026-10-31): a class expression\'s name counted, an import\'s not');
  assert.deepEqual(names('try { f(); } catch (er) {}'), ['er']);
  assert.deepEqual(names('const csa = 1; const deepWaters = 2; const dwOn = 3;'), ['csa'], 'a retired abbreviation exactly, never a longer name');
  assert.deepEqual(names('const pixel = { p: 1 }; pixel.q = 2; for (let i = 0; i < n; i++) {} xs.sort((a, b) => a - b); el.on(\'x\', (e) => e);'), []);
});

test('LEGIBLE 5 the verdict: a file past its count, or unlisted with any, is over; a count fallen is stale until lowered, and lowering never raises (mutants: an unlisted file let through; the stale side unread; a lowered entry raised)', () => {
  assert.deepEqual(verdict({ 'src/a.js': 3, 'src/b.js': 1 }, { 'src/a.js': 2 }).over, ['src/a.js: 3 (allowed 2)', 'src/b.js: 1 (allowed 0)']);
  assert.deepEqual(verdict({ 'src/a.js': 1 }, { 'src/a.js': 2, 'src/c.js': 4 }).stale, ['src/a.js: 1 (baseline 2)', 'src/c.js: 0 (baseline 4)']);
  assert.deepEqual(lowered({ 'src/a.js': 2, 'src/c.js': 4 }, { 'src/a.js': 5, 'src/c.js': 0 }), { 'src/a.js': 2 });
});

test('LEGIBLE 5 a host move carries its names: the new module admitted at its count and the host lowered, only while the two hold no more than the host did (mutants: the host left high; a grown pair admitted)', () => {
  const base = { 'src/scenes/world.js': 10, 'src/a.js': 1 };
  assert.deepEqual(carried(base, 'src/scenes/world.js', 'src/scenes/m.js', { 'src/scenes/world.js': 6, 'src/scenes/m.js': 4 }),
    { 'src/a.js': 1, 'src/scenes/m.js': 4, 'src/scenes/world.js': 6 });
  assert.equal(carried(base, 'src/scenes/world.js', 'src/scenes/m.js', { 'src/scenes/world.js': 7, 'src/scenes/m.js': 4 }), base, 'a move invents no name');
  // AUDIT (2026-10-31): the module unpacking one of the host's own short names binds it twice and invents none
  assert.deepEqual(carried(base, 'src/scenes/world.js', 'src/scenes/m.js', { 'src/scenes/world.js': 7, 'src/scenes/m.js': 4 }, 1),
    { 'src/a.js': 1, 'src/scenes/m.js': 4, 'src/scenes/world.js': 7 }, 'the rebound name discounted');
});

test('LEGIBLE 5 the tree: no file holds more short names than the baseline says, and the baseline is no higher than the tree (node tools/shortNames.mjs --lower after a rename)', () => {
  const { over, stale } = verdict(measure(), base);
  assert.deepEqual(over, [], 'a new short name - spell what it holds, or use one the glossary allows');
  assert.deepEqual(stale, [], `the tree holds fewer - lower ${BASELINE}`);
});
