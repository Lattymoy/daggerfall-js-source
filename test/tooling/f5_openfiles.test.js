// FOUNDATION F5 (bible/03-World/Foundation-Arc.md): THE BUILD'S OPEN FILES HELD (scripts/openFileLimit.mjs) - Vite reads
// each asset through the shared node:fs/promises object, so its readFile, wrapped once, holds every read the build makes
// under OPEN_FILES_MAX, and a read refused for want of a file handle is asked again. The Vite config installs it. Pins
// mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limitOpenFiles, OPEN_FILES_MAX } from '../../scripts/openFileLimit.mjs';

const fake = ({ failFirst = 0 } = {}) => {
  let open = 0, most = 0, calls = 0;
  return {
    readFile: async (name) => {
      calls++;
      open++; most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 1));
      open--;
      if (calls <= failFirst) throw Object.assign(new Error('EMFILE: too many open files'), { code: 'EMFILE' });
      if (name === 'missing') throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return `bytes of ${name}`;
    },
    most: () => most,
  };
};

test('F5 thousands of reads at once: never more than the cap open, every one answered in its own order (mutants: the cap unheld, the queue unrun)', async () => {
  const fs = fake();
  const tally = limitOpenFiles(fs, 64);
  const names = Array.from({ length: 3000 }, (_, i) => `art${i}.png`);
  const got = await Promise.all(names.map((n) => fs.readFile(n)));
  assert.deepEqual(got, names.map((n) => `bytes of ${n}`));
  assert.ok(fs.most() <= 64 && tally.most() === 64, `${fs.most()} open at most`);
  assert.equal(limitOpenFiles(fs, 8), tally, 'wrapped once');
});

test('F5 a read refused with EMFILE is asked again and lands; any other failure is the caller\'s (mutant: the busy read failed)', async () => {
  const fs = fake({ failFirst: 5 });
  const tally = limitOpenFiles(fs, 4);
  assert.deepEqual(await Promise.all(['a', 'b', 'c'].map((n) => fs.readFile(n))), ['bytes of a', 'bytes of b', 'bytes of c']);
  assert.ok(tally.retried() >= 3);
  await assert.rejects(fs.readFile('missing'), /ENOENT/);
});

test('F5 the build installs it - the Vite config wraps the shared fs/promises before anything is read; the cap is far under Windows\' 8,192 (mutant: the config without it)', async () => {
  assert.match(readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8'), /\nlimitOpenFiles\(\);\n/);
  assert.ok(OPEN_FILES_MAX >= 64 && OPEN_FILES_MAX <= 1024);
  const fsp = (await import('node:fs/promises')).default;
  const { createRequire } = await import('node:module');
  assert.equal(createRequire(import.meta.url)('node:fs').promises, fsp, 'the object Vite reads its assets through');
});
