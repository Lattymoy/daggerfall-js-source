// AUDIT DEPS1 (2026-10-15, the review of Vite 5 -> 8): THE CSS IS MINIFIED FOR THE BROWSERS THE GAME RUNS ON.
// Vite 8 minifies CSS - every page's inline <style> too - with Lightning CSS for `build.cssTarget`, which defaults to
// `build.target`; es2022 reads as Safari 16.4, and at 16.4 Lightning CSS drops a prefix that browser no longer needs.
// The game runs below 16.4 (WebGL2 is Safari 15's; SAFARI1 keeps the modules parsing there), so vite.config.js names
// the floor. Held by the build itself: a page whose style a Safari 15 needs prefixed, built by Vite through the
// config's own cssTarget - and through the default, which must still drop it, or this proves nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** build.cssTarget, as vite.config.js actually spells it - not a copy. */
function cssTarget() {
  const m = /^ {4}cssTarget: (\[[^\]\n]*\]),$/m.exec(readFileSync(join(root, 'vite.config.js'), 'utf8'));
  assert.ok(m, 'vite.config.js no longer names build.cssTarget');
  return JSON.parse(m[1].replace(/'/g, '"'));
}

const PAGE = '<!doctype html><html><head><style>.knob { -webkit-appearance: none; appearance: none; }</style></head><body></body></html>\n';

async function builtStyle(target) {
  const dir = mkdtempSync(join(tmpdir(), 'csstarget-'));
  try {
    writeFileSync(join(dir, 'index.html'), PAGE);
    await build({
      root: dir, configFile: false, logLevel: 'silent',
      build: { outDir: join(dir, 'dist'), target: 'es2022', ...(target ? { cssTarget: target } : {}) },
    });
    return /<style>([\s\S]*?)<\/style>/.exec(readFileSync(join(dir, 'dist', 'index.html'), 'utf8'))?.[1] ?? '';
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('AUDIT DEPS1 THE CSS KEEPS WHAT SAFARI 15 NEEDS: a page\'s inline style built by Vite through vite.config.js\'s own build.cssTarget keeps -webkit-appearance beside appearance - and built through the default (es2022, read as Safari 16.4) drops it, so the target is what keeps it (mutant: the floor taken out of the config)', async () => {
  const target = cssTarget();
  assert.ok(target.includes('safari15') && target.includes('ios15'), `the floor is named: ${JSON.stringify(target)}`);
  const kept = await builtStyle(target);
  assert.match(kept, /-webkit-appearance:none/, `built through the config's cssTarget: ${kept}`);
  const dropped = await builtStyle(null);
  assert.doesNotMatch(dropped, /-webkit-appearance/, `the default kept the prefix too - the pin no longer proves the target: ${dropped}`);
  assert.match(dropped, /appearance:none/, `the default build lost the rule itself: ${dropped}`);
});
