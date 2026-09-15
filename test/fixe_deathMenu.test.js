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
  let ready;
  const gate = new Promise((r) => { release = r; });
  // DEATH1: the hold is taken when the video says it is READY, not when the
  // death begins - so the play seam is handed the signal and calls it.
  const p = endRunToTitleMenu({ canvas: null }, { play: (_r, r) => { ready = r; return gate; }, watchdogMs: 60000, setTimer: () => 0 });
  assert.equal(frameHeld(), false, 'DEATH1: NOT held while the video is still loading - the host keeps drawing the death screen');
  ready();
  assert.equal(frameHeld(), true, 'held while the video plays - not claimed: the loop is alive and idle, as under the infection videos');
  release(true);
  await p;
  assert.equal(frameHeld(), false, 'released before the navigation');
  // a video that REJECTS costs the video, not the return - and one that
  // rejects BEFORE it was ready never held the frame at all
  await endRunToTitleMenu({ canvas: null }, { play: () => Promise.reject(new Error('no VID')), setTimer: () => 0 });
  assert.equal(frameHeld(), false);
});

// DEATH1 (2026-09-15, Mac: "Black screen after death and pressing enter").
// holdFrame stops the host drawing, and it was taken FIRST - then two
// dynamic imports and an archive read of ANIM0012.VID ran before the video
// painted anything. Every frame of that load was black: the host held, the
// death screen it had been drawing stopped, the video not yet begun. On a
// cold cache that is seconds of nothing, and the last thing drawn was the
// death fade, so it reads as a hang.
test('DEATH1: nothing is held until the video is loaded - the load is not a black screen', () => {
  const src = read('src/scenes/shared.js');
  const fn = src.slice(src.indexOf('async function playDeathVideo('), src.indexOf('export async function endRunToTitleMenu('));
  // the ready signal fires AFTER the bytes are in hand, never before
  assert.match(fn, /const bytes = await getBytes\('ANIM0012\.VID'\);\s*\n\s*ready\(\);/,
    'the signal is raised once the bytes are read, not at the top of the load');
  assert.ok(fn.indexOf('ready()') > fn.indexOf('await import'), 'and after the dynamic imports');
  const body = src.slice(src.indexOf('export async function endRunToTitleMenu('), src.indexOf('export async function endRunToTitleMenu(') + 1200);
  assert.match(body, /const ready = \(\) => \{ releaseFrame \?\?= holdFrame\(\); \};/, 'the hold is the signal, taken once');
  assert.match(body, /play\(renderer, ready\)/, 'and the player is handed it');
  // the watchdog still covers the LOAD as well as the play - a read that
  // never settles is a return to the menu, not a trap on the death screen
  assert.match(body, /Promise\.race\(\[\s*\n\s*play\(renderer, ready\),\s*\n\s*new Promise/,
    'the load and the play are inside the one bounded race');
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
  assert.match(body, /releaseFrame \?\?= holdFrame\(\);/, 'the hold, not the claim (DEATH1: taken when the video is ready)');
  assert.doesNotMatch(body, /claimFrame\(\)/, 'no claim before the awaits');
  assert.match(body, /\} finally \{\s*\n\s*releaseFrame\?\.\(\);\s*\n\s*exitToTitleMenu\(\);\s*\n\s*\}/, 'the return is in a finally (DEATH1: and a hold never taken is nothing to release)');
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
