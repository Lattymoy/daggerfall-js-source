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
import { endRunToTitleMenu, frameHeld, DEATH_VIDEO_WATCHDOG_MS, playDeathVideo } from '../src/scenes/shared.js';   // AUDIT DEATH1 F2: the real function is driven now

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
test('DEATH1: nothing is held until the video is loaded - the load is not a black screen', async () => {
  // AUDIT DEATH1 F2: this pin was GREP-ONLY. playDeathVideo was never
  // executed by anything - every behavioural test injects its own `play`
  // seam - so the law lived in two regexes, and a regex cannot see an
  // await. Driven proof of the gap: one more `await import(...)` placed
  // AFTER ready() restored Mac's black screen and passed the whole
  // suite. The real function is DRIVEN here now.
  const order = [];
  let loadDone = null;
  const load = () => new Promise((r) => {
    loadDone = () => { order.push('loaded'); r({ playVideo: (...a) => { order.push(`play:${a[2]}`); return 'played'; }, bytes: 'BYTES' }); };
  });
  const ready = () => order.push('ready');
  const p = playDeathVideo({ canvas: null }, ready, load);
  await Promise.resolve();
  assert.deepEqual(order, [], 'nothing is signalled while the load is still out');
  loadDone();
  assert.equal(await p, 'played');
  // THE LAW: loaded, THEN the hold, THEN the video - and the bytes the
  // load returned are the bytes played.
  assert.deepEqual(order, ['loaded', 'ready', 'play:BYTES'],
    'the hold is raised after everything is loaded and before anything is drawn');

  const src = read('src/scenes/shared.js');
  const fn = src.slice(src.indexOf('export async function playDeathVideo('), src.indexOf('export async function endRunToTitleMenu('));
  // AND NOTHING AWAITS AFTER THE SIGNAL. This is the half the drive
  // above cannot see: an added load after ready() is still "loaded,
  // ready, play" in order, just with black frames in between.
  const afterReady = fn.slice(fn.indexOf('ready();')).replace(/\/\/[^\n]*/g, '');   // the CODE, not the prose about it
  assert.equal(/\bawait\b/.test(afterReady), false,
    'no load may follow the hold - every await after ready() is a black frame (AUDIT DEATH1 F2)');
  const body = src.slice(src.indexOf('export async function endRunToTitleMenu('), src.indexOf('export async function endRunToTitleMenu(') + 1200);
  assert.match(body, /const ready = \(\) => \{ if \(!closed\) releaseFrame \?\?= holdFrame\(\); \};/, 'the hold is the signal, taken once - and only while the seam is open (AUDIT DEATH1 F7)');
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
  assert.match(body, /\} finally \{\s*\n\s*closed = true;[^\n]*\n\s*releaseFrame\?\.\(\);\s*\n\s*exitToTitleMenu\(\);\s*\n\s*\}/, 'the return is in a finally (DEATH1: and a hold never taken is nothing to release)');
});

// AUDIT DEATH1 F7 (2026-09-15): THE WATCHDOG IS A RACE, NOT A CANCEL.
// Every DEATH1 assertion above either injects a `play` that settles or
// reads the source as text; none drove the one order that matters -
// the watchdog fires, the seam returns, and THEN the load settles and
// calls ready(). Before the `closed` latch that took a hold whose only
// release closure had already been read as null: frameHeld() true with
// nothing left to release it, world.js and exterior.js skipping every
// frame forever. Mac's black screen, re-made by its own fix. Driven:
test('AUDIT DEATH1 F7: a load that settles AFTER the watchdog cannot take a hold nobody can release', async () => {
  assert.equal(frameHeld(), false, 'clean start');
  let ready = null;
  // the play never settles, and hands out its ready() the way the real
  // playDeathVideo does - the load is still out when the race is lost
  const p = endRunToTitleMenu({ canvas: null }, {
    play: (_r, r) => { ready = r; return new Promise(() => {}); },
    watchdogMs: 5, setTimer: (fn) => { fn(); return 0; },
  });
  await p;
  assert.equal(frameHeld(), false, 'the watchdog navigated and nothing is held');
  // ...and NOW the archive read finally lands:
  ready();
  assert.equal(frameHeld(), false,
    'a late ready() past the closed seam takes NO hold - a hold taken here has no release and the host never draws again');
});

test('FIX-E: F11 reaches the world host’s quickload from UNDER the death screen, above the rung that eats every key', () => {
  const w = read('src/scenes/world.js');
  // D-ONLINE1 (2026-09-17): the arm grew a respawn door for an online death - F11 on the death screen respawns
  // where it used to quickload - and kept its place above the rung; test/donline1_respawn.test.js holds the door.
  const arm = w.indexOf("if (townTalk.overlayActive && !isTextEntryTarget(e.target) && (modes?.mode ?? 'exterior') === 'exterior' && actionForCode(bindings(), e.code) === 'QuickLoad') {\n      e.preventDefault();");
  assert.ok(w.slice(arm, arm + 900).includes('else hudCtx.quickLoad();'), 'and quickload is still what F11 does when the death was not online');
  const gate = w.indexOf('if (townTalk.keydown(e, keys)) return;');   // KB1: the rung hands its mode keys the held Set
  assert.ok(arm > 0 && gate > arm, 'the arm stands above the townTalk rung');
  // the same law routeKey has carried for the dungeon and interior hosts
  assert.match(read('src/ui/input.js'), /if \(actionOf\(e, keys\) === 'QuickLoad'\) \{ ctx\.quickLoad\?\.\(setPlayerPos\); return true; \}/);
});

test('FIX-E: the interior slot releases what it overwrites, and the fixed city offers no F11 it cannot honour', () => {
  assert.match(read('src/scenes/worldModes.js'), /if \(!\(interiorOverlay instanceof DeathScreen\)\) \{[\s\S]{0,600}?interiorOverlay\?\.dispose\?\.\(\);\s*\n\s*interiorOverlay = new DeathScreen\(/, 'dispose before the overwrite, as dungeonContext has always done');
  assert.match(read('src/scenes/exterior.js'), /new DeathScreen\(\{[^\n]*hint: 'ENTER end' \}\)/, 'no save path, no F11 hint');
  assert.match(read('src/scenes/world.js'), /new DeathScreen\(\{ eyeHeight: player\.eye\[1\] - player\.pos\[1\], capsuleHeight: player\.height, onReset: \(\) => \(_deathWasOnline \? respawnOnlinePlayer\(\) : endRunToTitleMenu\(renderer\)\) \}\)/, 'the world keeps the full hint - its F11 is real now (D-ONLINE1: and its reset respawns when the death was online)');
  const ds = read('src/ui/deathScreen.js');
  assert.match(ds, /hint = 'ENTER end   F11 load'/, 'the default hint is the full one');
  assert.match(ds, /const hint = this\.online \? `RISING IN \$\{this\.respawnIn\}   ENTER now` : this\.hint;[^\n]*\n\s*drawText\(renderer, font, hint,/, 'and the screen draws the hint it was given (AUDIT CONTRIB A5: online, the hold\'s count in its place)');
});
