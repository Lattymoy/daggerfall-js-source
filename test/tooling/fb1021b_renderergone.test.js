// FIELD BUGS 2026-10-21b RENDERER-GONE (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md, BLACK-SCREEN; app/lib/rendererGone.cjs):
// "Crashing every minute - No message just black". A desktop page that died after its version's trial was met by nothing -
// gameStore.rollback answered null and the handler returned, the window standing on its background colour. The pure
// halves are driven by execution; the shell's wiring is pinned by source (it runs in Electron), as AUDIT INSTALL pins it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const G = require('../../app/lib/rendererGone.cjs');
const main = readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8');

test('RENDERER-GONE the page stopped is said, with why: Restart the default, Quit the cancel; a loop of stops says so', () => {
  const a = G.goneAsk('oom');
  assert.equal(a.message, 'The game stopped');
  assert.match(a.detail, /^It ran out of memory\. Your saves are kept/);
  assert.deepEqual([a.buttons[a.defaultId], a.buttons[a.cancelId]], ['Restart', 'Quit'], 'Enter restarts; Escape or the close quits');
  assert.equal(G.restarts(a.buttons.indexOf('Restart')), true);
  assert.equal(G.restarts(a.cancelId), false);
  assert.match(G.goneAsk('crashed').detail, /^It crashed\./);
  assert.match(G.goneAsk('something-new').detail, /^It closed unexpectedly\./, 'a reason Electron grows says something');
  assert.doesNotMatch(G.goneAsk('oom', G.LOOP_STOPS - 1).detail, /times in the last two minutes/);
  assert.match(G.goneAsk('oom', G.LOOP_STOPS).detail, /It has stopped 3 times in the last two minutes/);
});

test('RENDERER-GONE a page that stops answering is offered Wait (the default and the cancel - a long load is never thrown away) or Restart', () => {
  const h = G.hangAsk();
  assert.deepEqual([h.buttons[h.defaultId], h.buttons[h.cancelId]], ['Wait', 'Wait']);
  assert.equal(G.restartsHung(h.buttons.indexOf('Restart')), true);
  assert.equal(G.restartsHung(h.cancelId), false);
});

test('RENDERER-GONE the stops are counted inside the span; crash.log keeps its newest whole lines', () => {
  const c = G.createStopCount();
  assert.deepEqual([c.stop(0), c.stop(1000), c.stop(2000)], [1, 2, 3]);
  assert.equal(c.stop(2000 + G.RESTART_SPAN_MS + 1), 1, 'the old stops past the span let go');
  const line = G.goneLine('renderer', { reason: 'oom', exitCode: -536870904 }, Date.UTC(2026, 9, 21, 7, 47));
  assert.equal(line, '2026-10-21T07:47:00.000Z renderer oom exitCode=-536870904\n');
  assert.equal(G.goneLine('gpu', { reason: 'crashed', exitCode: 3, type: 'GPU' }, 0), '1970-01-01T00:00:00.000Z gpu crashed exitCode=3 type=GPU\n');
  let log = '';
  for (let i = 0; i < 2000; i++) log = G.logWith(log, `${String(i).padStart(4, '0')} ${'x'.repeat(60)}\n`);
  assert.ok(log.length <= G.CRASH_LOG_MAX, `capped (${log.length})`);
  assert.ok(log.startsWith('1') && /^\d{4} x+\n/.test(log), 'a whole line first');
  assert.ok(log.endsWith(`1999 ${'x'.repeat(60)}\n`), 'the newest kept');
});

test('RENDERER-GONE by source: the shell asks with exactly these and acts on exactly those answers - after the trial\'s rollback is no answer; a hung page\'s Restart crashes it and that stop restarts unasked', () => {
  assert.match(main, /const \{ goneAsk, restarts, hangAsk, restartsHung, createStopCount, goneLine, logWith \} = require\('\.\/lib\/rendererGone\.cjs'\);/);
  assert.match(main, /if \(!bad\) return false;/, 'giveUp answers whether the trial took the stop');
  assert.match(main, /if \(giveUp\('stopped before it came up'\) \|\| win\.isDestroyed\(\) \|\| details\?\.reason === 'clean-exit'\) return;\n\s*if \(restarting\) \{ restarting = false; win\.webContents\.reload\(\); return; \}\n\s*const \{ response \} = await dialog\.showMessageBox\(win, goneAsk\(details\?\.reason, stops\.stop\(Date\.now\(\)\)\)\);\n\s*if \(win\.isDestroyed\(\)\) return;\n\s*if \(restarts\(response\)\) win\.webContents\.reload\(\); else app\.quit\(\);/);
  assert.match(main, /win\.webContents\.on\('unresponsive', async \(\) => \{[\s\S]*?const \{ response \} = await dialog\.showMessageBox\(win, hangAsk\(\)\);[\s\S]*?if \(!restartsHung\(response\) \|\| win\.isDestroyed\(\)\) return;\n\s*restarting = true;\n\s*win\.webContents\.forcefullyCrashRenderer\(\);/);
  assert.match(main, /if \(details\?\.reason !== 'clean-exit'\) logGone\('renderer', details\);/, 'every stop kept in crash.log');
  // PIN MOVED (GPU-TRAIL-LOST, 2026-10-25): the GPU's stop is held for the page's lost sample, then logged by logGone
  assert.match(main, /app\.on\('child-process-gone', \(_e, details\) => \{ if \(details\?\.type === 'GPU'\) gpuGone\.gone\(details, Date\.now\(\)\); \}\);/);
  assert.match(main, /createGpuGoneWait\(\{ write: \(details, at\) => logGone\('gpu', details, at\) \}\)/);
  assert.equal((main.match(/'render-process-gone'/g) ?? []).length, 1, 'one door for a stopped page');
});
