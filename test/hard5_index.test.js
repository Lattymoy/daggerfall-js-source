// HARD5 - HOME.MD BACK TO AN INDEX (2026-09-15).
//
// It was 291 KB and carried the architecture, the postmortems, the
// policy, the changelog and the project index at once. Two sections were
// 254 KB of that - `## Active arcs` (172 KB in 89 lines, an index whose
// entries had grown into essays) and `## Audits` (82 KB) - and they now
// live on their own pages. Home.md is 30 KB.
//
// WHAT THE RECORD SAID WAS ATTACHED, AND WHAT ACTUALLY WAS.
// `Hardening.md` warned of two attachments: "a tool rewrites a section
// of it (regenOpenFlags.mjs), and tests pin line numbers inside it".
//
//   The tool is real, and its section (`## Open flags`) STAYED in
//   Home.md for exactly that reason.
//
//   THE LINE-NUMBER PINS DO NOT EXIST. Not one test indexes Home.md by
//   line. The line numbers those tests handle are the ones INSIDE each
//   open-flag entry, pointing at `src/` - a different thing entirely.
//   That is the second stale claim found on this page in one day (the
//   first was "the five-host save envelope assembly", which is two),
//   and it is worth naming as a class: **a warning is a claim, and an
//   unchecked warning rots exactly like an unchecked citation.**
//
// The real attachment was the one the record did NOT name: four gates
// asking "does Home.md name every record / every arc plan", which a
// split breaks while the index stays complete. And behind those, the
// hazard this file exists for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexPages, indexText } from './bibleIndex.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('HARD5: Home.md is an index, and its delegates exist', () => {
  const home = read('bible/Home.md');
  // The number is a CEILING, not a pin on today's size: the point is
  // that this file cannot grow back into a 291 KB everything-page
  // without someone noticing. Generous enough that ordinary additions
  // never touch it.
  assert.ok(home.length < 80 * 1024,
    `bible/Home.md is ${Math.round(home.length / 1024)} KB. It was 291 KB before HARD5 and the split put it at 30.\n`
    + 'If a section has grown back into an essay, give it a page and leave a `Moved to \`...\`` stub here.');
  // indexPages() throws on a stub naming a page that is not there.
  const pages = indexPages();
  assert.ok(pages.length >= 2, 'Home.md hands off no section - the split has been undone');
  assert.deepEqual(pages[0], 'bible/Home.md');
});

test('HARD5: the moved sections are still ONE place each - a split must not leave a copy', () => {
  // A relocation that leaves the original behind is worse than no
  // relocation: two texts, one of which will be edited and one of which
  // will be read. Each delegate's own H1 must appear exactly once
  // across the whole index.
  const seen = new Map();
  for (const p of indexPages()) {
    for (const m of read(p).matchAll(/^## (.+)$/gm)) {
      const h = m[1].trim();
      seen.set(h, (seen.get(h) ?? 0) + 1);
    }
  }
  const twice = [...seen].filter(([, n]) => n > 1).map(([h]) => h);
  assert.deepEqual(twice, [], `a section heading appears more than once across the index:\n${twice.join('\n')}`);
});

test('HARD5: no bible pin reads Home.md ALONE for a claim that could move', () => {
  // THE HAZARD, GATED. `assert.doesNotMatch(read('bible/Home.md'), ...)`
  // says "this stale claim is gone". Move the section it guards to
  // another page and the pin goes VACUOUSLY TRUE - it passes for ever,
  // for the wrong reason, and nothing goes red. Three such pins were
  // live when this split landed (auditworld, auditworld2, ledger); they
  // read the whole index now.
  //
  // A POSITIVE match on Home.md is fine and stays allowed: it asserts
  // something IS there, so it fails honestly if the text moves.
  const bad = [];
  for (const f of readdirSync(join(root, 'test')).filter((n) => n.endsWith('.test.js'))) {
    if (f === 'hard5_index.test.js') continue;
    read(`test/${f}`).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (!/bible\/Home\.md/.test(line)) return;
      if (/doesNotMatch\s*\(/.test(line) || /!\s*\/[^/]+\/[a-z]*\.test\s*\(/.test(line)) {
        bad.push(`test/${f}:${i + 1} - a negative pin reading Home.md alone`);
      }
    });
  }
  assert.deepEqual(bad, [],
    'a "this claim is gone" pin aimed at ONE page stops meaning anything the day the claim moves to another.\n'
    + "Read the whole index instead: `import { indexText } from './bibleIndex.mjs'`.");
});

test('HARD5: the open-flags section STAYED, because a tool owns it', () => {
  // tools/regenOpenFlags.mjs finds its section by heading in
  // bible/Home.md and rewrites it in place; test/citedrift.test.js and
  // test/flagsites.test.js read the list there too. That is why this
  // one section did not move, and the reason belongs next to the fact.
  const home = read('bible/Home.md');
  assert.match(home, /^## Open flags/m, 'the tool rewrites this section BY HEADING in this file');
  assert.match(read('tools/regenOpenFlags.mjs'), /const HOME = join\(root, 'bible\/Home\.md'\);/);
  assert.match(read('tools/regenOpenFlags.mjs'), /const HEADING = '## Open flags';/);
  // ...and the list itself is still here, not on a delegate page, or
  // flagsites.test.js's count reads an empty file and passes.
  assert.ok(home.split('\n').filter((l) => /^- `src\//.test(l)).length >= 5,
    'the open-flags entries are no longer in Home.md - regenOpenFlags.mjs and two gates read them here');
});

test('HARD5: "tests pin line numbers inside Home.md" was never true', () => {
  // The warning that shaped this slice's risk assessment. Checking it
  // cost one grep and it was false - so it is checked here from now on,
  // and if a line-number pin into Home.md is ever added, this goes red
  // and the warning becomes true and earns its place in the record.
  const pins = [];
  for (const f of readdirSync(join(root, 'test')).filter((n) => n.endsWith('.test.js'))) {
    if (f === 'hard5_index.test.js') continue;
    for (const m of read(`test/${f}`).matchAll(/Home\.md['"`]?\s*\)?\s*\[\s*(\d+)/g)) pins.push(`test/${f} indexes Home.md at ${m[1]}`);
    for (const m of read(`test/${f}`).matchAll(/Home\.md:(\d+)/g)) pins.push(`test/${f} cites Home.md:${m[1]}`);
  }
  assert.deepEqual(pins, [],
    'Hardening.md warned that tests pin line numbers inside Home.md. They did not. If that changes, the split\n'
    + 'is riskier than it was and the record should say so - starting with this list.');
});

test('HARD5: the split moved text, it did not rewrite it', () => {
  // A rewrite and a relocation in one commit is a diff nobody can read,
  // so each delegate says in its own header that nothing below was
  // re-worded, and the shortening of Active-Arcs' essay-length entries
  // is named as its own later pass rather than smuggled in here.
  for (const p of indexPages().slice(1)) {
    assert.match(read(p), /MOVED HERE FROM `Home\.md`, BYTE FOR BYTE/,
      `${p} does not say it is a verbatim move - if it was edited in the move, say so instead`);
  }
  // and the whole index still carries what the one file did
  assert.ok(indexText().length > 250 * 1024, 'the index lost content in the split');
});
