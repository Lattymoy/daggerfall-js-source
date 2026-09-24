// AUDIT 68 (2026-09-24), the whole-tree sweep - found by its tooling lane
// (X5) and paid before the fix wave, because every fix in the wave leans on
// this tool. tools/citeShift.mjs read the base copy of each target through
// execFileSync's default 1 MiB buffer; src/scenes/world.js had crossed
// 1 MiB, the read threw ENOBUFS, and the catch meant for a NEW file (no
// base copy) swallowed it - so no cite into the tree's largest file ever
// moved, and the run still said "0 cite(s) to move". Pinned on a scratch
// repo carrying a target past 1 MiB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('AUDIT 68 X5-citeshift-enobufs: a target past 1 MiB still has its cites moved', () => {
  const dir = mkdtempSync(join(tmpdir(), 'audit68-citeshift-'));
  try {
    const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '-q');
    mkdirSync(join(dir, 'tools'));
    mkdirSync(join(dir, 'src'));
    mkdirSync(join(dir, 'bible'));
    copyFileSync(join(ROOT, 'tools/citeShift.mjs'), join(dir, 'tools/citeShift.mjs'));
    // 1.2 MiB of target: line 5 is the one the doc cites.
    const body = Array.from({ length: 40000 }, (_, i) => `const line${i + 1} = ${'x'.repeat(20)};`);
    body[4] = 'export const cited = 1;';
    writeFileSync(join(dir, 'src/big.js'), body.join('\n') + '\n');
    assert.ok(readFileSync(join(dir, 'src/big.js')).length > (1 << 20), 'the fixture is past 1 MiB');
    writeFileSync(join(dir, 'bible/doc.md'), 'The export lives at `src/big.js:5`.\n');
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
    writeFileSync(join(dir, 'src/big.js'), '// one line above\n' + body.join('\n') + '\n');
    execFileSync(process.execPath, [join(dir, 'tools/citeShift.mjs'), '--apply'], { cwd: dir, encoding: 'utf8' });
    assert.equal(readFileSync(join(dir, 'bible/doc.md'), 'utf8'), 'The export lives at `src/big.js:6`.\n',
      'mutants: the default 1 MiB buffer back - the target is skipped and the cite stays on :5');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
