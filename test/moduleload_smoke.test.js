import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// THE MODULE-BODY SMOKE (2026-08-31, after the boot failure). Every
// pin in this suite that covers a host is a TEXT pin, because nothing
// EXECUTED those module bodies - which is how `const useHooks = {
// ...useHooks }` shipped and killed the site. This test does the one
// thing that catches that whole class: it imports every module under
// src/ and fails if any throws.
//
// Eleven cannot be imported under bare node, and the list is asserted
// EXACTLY so the blind spot cannot silently grow:
//   - three use Vite's `import.meta.glob`, which is a compile-time
//     transform and simply absent outside the bundler;
//   - eight are browser tools that touch `document`/`location` at module
//     scope.
// For those eleven, tdz_selfreference.test.js is the standing guard.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
};

/** The known-unimportable ELEVEN, with the reason each is excluded. */
export const NOT_IMPORTABLE = Object.freeze({
  'src/main.js': 'addEventListener/document at module scope',   // BOOT1: it used to reject at LINK time, through world.js's import.meta.glob - the hosts are behind doors now, its body runs, and the crash listeners at its module scope are what node lacks
  'src/scenes/questData.js': 'import.meta.glob',
  'src/scenes/world.js': 'import.meta.glob',
  'src/tools/enhancedChargen.js': 'document at module scope',
  'src/tools/enhancedMenu.js': 'document at module scope',
  'src/tools/enhancedUI.js': 'document at module scope',
  'src/tools/mwViewer.js': 'document at module scope',
  'src/tools/paperdollViewer.js': 'document at module scope',
  'src/tools/skyLab.js': 'location at module scope',
  'src/tools/waterLab.js': 'location at module scope',   // WATER1: the water lab
  'src/tools/levelUpLab.js': 'document at module scope',   // LV1: the level-up lab
});

test('every module under src/ loads - its body RUNS, not just parses', async () => {
  const files = walk(join(root, 'src')).map((f) => relative(root, f).split('\\').join('/'));
  const failures = [];
  const unexpectedlyFine = [];
  for (const f of files) {
    const excluded = f in NOT_IMPORTABLE;
    let threw = null;
    try {
      await import(new URL(`../${f}`, import.meta.url).href);
    } catch (e) {
      threw = String(e?.message ?? e);
    }
    if (threw && !excluded) failures.push(`${f}: ${threw.slice(0, 120)}`);
    if (!threw && excluded) unexpectedlyFine.push(f);
  }
  assert.deepEqual(failures, [], `modules whose body throws on load:\n  ${failures.join('\n  ')}`);
  // A module that LEAVES the list is good news, but the list must be
  // trimmed so it never covers for a real break.
  assert.deepEqual(unexpectedlyFine, [], `these import fine now - remove them from NOT_IMPORTABLE:\n  ${unexpectedlyFine.join('\n  ')}`);
});

test('the blind spot is exactly eleven modules, each with a reason', () => {
  const files = walk(join(root, 'src')).map((f) => relative(root, f).split('\\').join('/'));
  for (const f of Object.keys(NOT_IMPORTABLE)) {
    assert.ok(files.includes(f), `${f} is on the exclusion list and no longer exists`);
  }
  assert.equal(Object.keys(NOT_IMPORTABLE).length, 11);   // WATER1: the water lab joined the sky lab; LV1: the level-up lab joined both
  // The three that matter are the hosts: they carry the most edits and
  // the least coverage, which is exactly the combination that produced
  // the boot failure. Recorded here so the next reader sees the cost.
  const globbed = Object.entries(NOT_IMPORTABLE).filter(([, why]) => why === 'import.meta.glob');
  // BOOT1 (2026-09-20): two, not three. main.js was the third only by
  // inheritance - it statically imported world.js, so world.js's glob
  // rejected the entry at link time before a line of it ran. With the
  // hosts behind dynamic doors the entry's body runs in node, and what
  // it is excluded for is its own: the crash listeners at module scope.
  // The count is held at two so the next static import of a host into
  // the entry (which would put the glob back in front of it) reads as
  // the regression it is, here as well as in test/boot1.test.js.
  assert.equal(globbed.length, 2);
  assert.equal(NOT_IMPORTABLE['src/main.js'], 'addEventListener/document at module scope');
});
