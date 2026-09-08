// FIX-E (2026-09-08, Mac: "When dying and returning to the main menu, the
// game bugs and you're unable to make selections"). The death seam killed
// the host loop FIRST and then waited, unbounded, on a video and a fetch
// before it navigated - a promise that never settles (a backgrounded tab's
// rAF, a stalled audio clock, a fetch with no timeout) left a frozen frame
// under a modal overlay whose keys the dead host's ladder still ate, with
// the pointer still locked and no menu ever coming. And the death screen's
// own two choices were half dead: "F11 load" reached nothing above ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endRunToTitleMenu, frameHeld, DEATH_VIDEO_WATCHDOG_MS } from '../src/scenes/shared.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('FIX-E: the death seam HOLDS the frame (the host waits, and lives), and releases it on every path out', async () => {
  assert.equal(frameHeld(), false);
  let release;
  const gate = new Promise((r) => { release = r; });
  const p = endRunToTitleMenu({ canvas: null }, { play: () => gate, watchdogMs: 60000, setTimer: () => 0 });
  assert.equal(frameHeld(), true, 'held while the video plays - not claimed: the loop is alive and idle, as under the infection videos');
  release(true);
  await p;
  assert.equal(frameHeld(), false, 'released before the navigation');
  // a video that REJECTS costs the video, not the return
  await endRunToTitleMenu({ canvas: null }, { play: () => Promise.reject(new Error('no VID')), setTimer: () => 0 });
  assert.equal(frameHeld(), false);
});

test('FIX-E: a video that never settles is a BOUNDED wait - the watchdog navigates', async () => {
  let armed = null;
  const p = endRunToTitleMenu({ canvas: null }, { play: () => new Promise(() => {}), watchdogMs: 1234, setTimer: (fn, ms) => { armed = ms; fn(); return 0; } });
  await p;
  assert.equal(armed, 1234, 'the watchdog is armed for the given wait');
  assert.equal(frameHeld(), false, 'and the hold is released when it fires');
  assert.ok(DEATH_VIDEO_WATCHDOG_MS >= 15000 && DEATH_VIDEO_WATCHDOG_MS <= 60000, `a real death video ends well inside it (${DEATH_VIDEO_WATCHDOG_MS} ms)`);
  const src = read('src/scenes/shared.js');
  const body = src.slice(src.indexOf('export async function endRunToTitleMenu('), src.indexOf('export async function endRunToTitleMenu(') + 900);
  assert.match(body, /const releaseFrame = holdFrame\(\);/, 'the hold, not the claim');
  assert.doesNotMatch(body, /claimFrame\(\)/, 'no claim before the awaits');
  assert.match(body, /\} finally \{\s*\n\s*releaseFrame\(\);\s*\n\s*exitToTitleMenu\(\);\s*\n\s*\}/, 'the return is in a finally');
});

test('FIX-E: F11 reaches the world host’s quickload from UNDER the death screen, above the rung that eats every key', () => {
  const w = read('src/scenes/world.js');
  const arm = w.indexOf("if (townTalk.overlayActive && !isTextEntryTarget(e.target) && (modes?.mode ?? 'exterior') === 'exterior' && actionForCode(bindings(), e.code) === 'QuickLoad') { e.preventDefault(); hudCtx.quickLoad(); return; }");
  const gate = w.indexOf('if (townTalk.keydown(e)) return;');
  assert.ok(arm > 0 && gate > arm, 'the arm stands above the townTalk rung');
  // the same law routeKey has carried for the dungeon and interior hosts
  assert.match(read('src/ui/input.js'), /if \(actionOf\(e, keys\) === 'QuickLoad'\) \{ ctx\.quickLoad\?\.\(setPlayerPos\); return true; \}/);
});

test('FIX-E: the interior slot releases what it overwrites, and the fixed city offers no F11 it cannot honour', () => {
  assert.match(read('src/scenes/worldModes.js'), /if \(!\(interiorOverlay instanceof DeathScreen\)\) \{[\s\S]{0,600}?interiorOverlay\?\.dispose\?\.\(\);\s*\n\s*interiorOverlay = new DeathScreen\(/, 'dispose before the overwrite, as dungeonContext has always done');
  assert.match(read('src/scenes/exterior.js'), /new DeathScreen\(\{[^\n]*hint: 'ENTER end' \}\)/, 'no save path, no F11 hint');
  assert.match(read('src/scenes/world.js'), /new DeathScreen\(\{ eyeHeight: player\.eye\[1\] - player\.pos\[1\], capsuleHeight: player\.height, onReset: \(\) => endRunToTitleMenu\(renderer\) \}\)/, 'the world keeps the full hint - its F11 is real now');
  const ds = read('src/ui/deathScreen.js');
  assert.match(ds, /hint = 'ENTER end   F11 load'/, 'the default hint is the full one');
  assert.match(ds, /drawText\(renderer, font, this\.hint,/, 'and the screen draws the hint it was given');
});
