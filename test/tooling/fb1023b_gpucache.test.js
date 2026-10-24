// FIELD BUGS 2026-10-23b GPU-CACHE (bible/01-Overview/bugs/Field-Bugs-2026-10-23b.md): the desktop app froze the first
// time a player opened a window, entered a dungeon, a city or a Dagon Breach, every launch, where the browser did not.
// Chromium's kept WebGL programs - in memory and in <userData>/GPUCache - are capped at 6 MiB, and ANGLE's D3D11
// binaries for the game's programs pass that in the first town, so every launch compiled them again.
//
//   GPUC1  the shell sizes Chromium's program cache to 128 MiB - ONE gpu-disk-cache-size-kb switch, after the storage
//          root is pinned and before the app is ready, where Chromium reads its switches
//   GPUC2  and nothing in the shell turns the shader cache off
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');

test('GPUC1: the desktop shell sizes Chromium\'s kept programs to 128 MiB - one gpu-disk-cache-size-kb switch, after the storage root is pinned and before the app is ready (mutants: the switch dropped; the size Chromium\'s own 6 MiB; the switch misspelt; set after ready)', () => {
  const from = main.indexOf("\nif (process.env.DAGGER_USER_DATA) app.setPath('userData'"), to = main.indexOf('\napp.whenReady()');
  assert.ok(from > 0 && to > from, 'the storage root is pinned, then the app is readied');
  assert.equal([...main.matchAll(/'gpu-disk-cache-size-kb'/g)].length, 1, 'one cache-size switch in the shell');
  const before = main.slice(from, to);
  assert.match(before, /\nconst GPU_CACHE_KB = 128 \* 1024;\n/);
  assert.match(before, /\napp\.commandLine\.appendSwitch\('gpu-disk-cache-size-kb', String\(GPU_CACHE_KB\)\);/);
});

test('GPUC2: nothing in the shell turns Chromium\'s shader cache off - a launch links the programs the last one kept', () => {
  for (const off of ['disable-gpu-shader-disk-cache', 'disable-gpu-program-cache', 'disable_gpu_shader_disk_cache']) {
    assert.ok(!main.includes(off), `the shell asks for ${off}`);
  }
});
