// PY1 - THE PARITY PINS WERE BLIND (2026-08-28). Fourteen pins across
// eight files REGENERATE a port table from Daggerfall Unity's own C#
// and compare it cell for cell - ENEMY_BASICS off EnemyBasics.cs,
// LOOT_MATRICES off LootTables.cs, the ingredient ITEM_GROUPS and the
// artifact/ItemEnums rows, MAGIC_ONLY_KEYS off the effect classes, the
// race templates, PlayerActivate's ladder, the two enemy-motor waves,
// DaggerfallInterior, and MacroHelper's whole %-table. They are the
// only pins that can catch the port drifting from a DFU nobody re-read.
//
// Every one resolved the checkout as a HARDCODED '../tools/parity/dfu/'
// and skipped when it was absent - which is every environment where the
// reference tree lives elsewhere, including the one this project is
// developed in. The suite printed `# skipped 14`, which at a glance
// reads exactly like `# pass 14`.
//
// tools/parity/prepare.sh has honoured DFU_PATH since AUDIT 18; the
// tests simply never learned the convention. test/dfuRoot.mjs is the
// one home now, and this file keeps it one: a SOURCE SWEEP, because
// the rule "resolve the checkout through the helper" is the kind that
// gets forgotten by the next person who needs a C# file - the same
// shape R6's bare-`this` sweep and AUDIT 17i's `new ChargenFlow(`
// sweep take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DFU_ROOT, dfuFile, missingDfu } from './dfuRoot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

test('PY1: no test resolves the DFU checkout by hand - dfuRoot.mjs is the one home', () => {
  const offenders = [];
  for (const f of readdirSync(HERE)) {
    if (!f.endsWith('.test.js')) continue;
    // this file is exempt from its own sweep: the next test ASSERTS the
    // fallback literal against dfuRoot.mjs, so the path has to appear
    // here in code. The same self-reference every source sweep in this
    // suite carries, named rather than silently pattern-dodged.
    if (f === 'parityroot.test.js') continue;
    const src = strip(readFileSync(join(HERE, f), 'utf8'));
    // the literal path, in code rather than prose
    if (/tools\/parity\/dfu/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [],
    'these tests spell the checkout path themselves; they will skip silently wherever\n'
    + 'the reference tree is not at tools/parity/dfu. Resolve it with dfuFile()/missingDfu()\n'
    + "from './dfuRoot.mjs', which honours DFU_PATH exactly as tools/parity/prepare.sh does.");
});

test('PY1: the resolver is prepare.sh\'s own precedence - DFU_PATH, then the in-tree clone', () => {
  const sh = readFileSync(join(HERE, '..', 'tools', 'parity', 'prepare.sh'), 'utf8');
  assert.match(sh, /DFU_PATH="\$\{DFU_PATH:-\$D\/dfu\}"/,
    'prepare.sh still takes DFU_PATH first and its own ./dfu second - the helper mirrors it');
  const helper = readFileSync(join(HERE, 'dfuRoot.mjs'), 'utf8');
  assert.match(helper, /'\.\.\/tools\/parity\/dfu\/', import\.meta\.url/, 'the in-tree sparse clone is the fallback');
  // THE ENV ARM IS PINNED BY BEHAVIOUR, NOT BY GREP. DFU_ROOT is
  // computed once at module load, so the honest test spawns a child
  // with the variable set and asks it where the root landed. The
  // campaign proved the grep worthless on its own: disabling the arm
  // with `false ?` left the matched text - and the pin - intact.
  const probe = "import('./test/dfuRoot.mjs').then(m => console.log(m.DFU_ROOT.href))";
  const out = execFileSync(process.execPath, ['-e', probe], {
    cwd: join(HERE, '..'),
    env: { ...process.env, DFU_PATH: '/tmp/__py1_probe_root' },
    encoding: 'utf8',
  }).trim();
  assert.equal(out, 'file:///tmp/__py1_probe_root/',
    'DFU_PATH must WIN over the in-tree clone, with the trailing slash supplied');
  // a trailing slash is load-bearing: `new URL('Assets/...', root)` against
  // a root with no trailing slash silently drops the last segment
  assert.ok(DFU_ROOT.href.endsWith('/'), 'the root URL ends in a slash or every path loses a segment');
  assert.match(dfuFile('Assets/Scripts/SoundClips.cs').href, /Assets\/Scripts\/SoundClips\.cs$/);
});

test('PY1: with no checkout the pins still skip - the reference stays EXTERNAL', () => {
  // Port-Doctrine keeps DFU out of the repo (as ARENA2 is), so absence
  // must remain a clean skip and never a failure. missingDfu answers
  // truthfully for a path that cannot exist.
  assert.equal(missingDfu('Assets/Scripts/__no_such_file__.cs'), true);
  // ...and honestly for one that does, when a checkout is present.
  if (existsSync(dfuFile('Assets/Scripts/SoundClips.cs'))) {
    assert.equal(missingDfu('Assets/Scripts/SoundClips.cs'), false);
  }
});
