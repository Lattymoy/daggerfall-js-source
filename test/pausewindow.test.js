// I3: the pause options window against DaggerfallPauseOptionsWindow.cs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BAR_MAX, PAUSE_PANEL_Y, PAUSE_RECTS, TICK_RECT, TOGGLE_COLOR, ARE_YOU_SURE_ID,
  barClickValue, detailBarWidth, detailClickValue, QUALITY_COUNT,
  PauseOptionsWindow,
} from '../src/ui/pauseWindow.js';
import { setValue, getFloat, _resetForTests } from '../src/systems/settings.js';
import { openPauseFlow } from '../src/ui/pauseDoor.js';
import { isEnhanced } from '../src/systems/uiSkin.js';
import { _resetForTests as _resetUiPrefs } from '../src/systems/uiPrefs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('I3: the geometry is DFU\'s, literal for literal (:28, :75, :86-141)', () => {
  assert.equal(BAR_MAX, 109.1);
  assert.equal(PAUSE_PANEL_Y, 40);
  assert.deepEqual({ ...PAUSE_RECTS }, {
    save: [4, 4, 45, 16],
    load: [52, 4, 46, 16],
    exit: [101, 4, 45, 16],
    soundBar: [6.15, 23.20, 109.1, 5.5],
    musicBar: [6.15, 30.85, 109.1, 5.5],
    detailBar: [6.15, 39, 109.1, 5.5],
    fullScreen: [5, 47, 70, 8],
    headBobbing: [76, 47, 70, 8],
    controls: [5, 60, 70, 17],
    continue: [76, 60, 70, 17],
  });
  assert.deepEqual([...TICK_RECT], [64, 3.2, 3.7, 3.2]);
  // DaggerfallUnityDefaultCheckboxToggleColor = Color32(146,12,4)
  assert.deepEqual(TOGGLE_COLOR.map((c) => Math.round(c * 255)), [146, 12, 4, 255]);
  assert.equal(ARE_YOU_SURE_ID, 1069);
});

test('I3: the bar click law - the 1%/99% snaps and two-place rounding (:230-241)', () => {
  assert.equal(barClickValue(BAR_MAX / 2), 0.5);
  assert.equal(barClickValue(BAR_MAX * 0.995), 1, 'over 99% snaps to max');
  assert.equal(barClickValue(BAR_MAX * 0.005), 0, 'under 1% snaps to zero');
  assert.equal(barClickValue(BAR_MAX * 0.337), 0.34, 'two places, rounded');
  // the snaps trigger only OUTSIDE the 1%..99% band (the exact
  // boundary is a strict float compare, unreachable through a
  // multiplication - pinned just inside instead)
  assert.equal(barClickValue(BAR_MAX * 0.98), 0.98);
  assert.equal(barClickValue(BAR_MAX * 0.02), 0.02);
});

test('I3: the detail bar lerps over the SIX quality names (:221-224, :266)', () => {
  assert.equal(QUALITY_COUNT, 6, 'Fastest..Fantastic - settingsLaw\'s own enum');
  assert.equal(detailBarWidth(0), 0);
  assert.equal(detailBarWidth(QUALITY_COUNT - 1), BAR_MAX);
  assert.equal(detailClickValue(0, BAR_MAX), 0);
  assert.equal(detailClickValue(BAR_MAX, BAR_MAX), 5);
  assert.equal(detailClickValue(BAR_MAX / 2, BAR_MAX), 3, 'round, not floor: 2.5 -> 3');
});

test('I3: continue closes, exit confirms on 1069, No keeps playing', () => {
  _resetForTests();
  let exited = 0;
  const w = new PauseOptionsWindow({ exitToMenu: () => exited++, textLines: () => ['Are you sure?'] });
  // OPTN00I0 ships 150x84; the art-less fallback centres the same -
  // panelX = round((320-150)/2) = 85
  const px = 85, py = PAUSE_PANEL_Y;
  w.click(px + 101 + 1, py + 4 + 1);   // exit
  assert.equal(w.top, 'exit');
  w.input('KeyN');
  assert.equal(w.top, null, 'No dismisses the confirm');
  assert.equal(w.done, false);
  w.click(px + 101 + 1, py + 4 + 1);
  w.input('KeyY');
  assert.equal(exited, 1, 'Yes takes the door');
  assert.equal(w.done, true);

  const w2 = new PauseOptionsWindow({});
  w2.click(px + 76 + 1, py + 60 + 1);   // continue
  assert.equal(w2.done, true);
  // and the same Escape that opened it closes it (:183-188) - on the
  // RELEASE, which is GetKeyUp (ROAD-E E1 built that edge). The bare
  // release is inert, because DFU opens this window on
  // `ActionComplete` (GameManager.cs:515-518 - the release) while every
  // host here opens on the press, so the door carries
  // DaggerfallAutomapWindow.cs:703-713's deferral and the Escape that
  // opens it cannot close it in the same breath. The host-level walk is
  // roade_up_seam.test.js's.
  const w3 = new PauseOptionsWindow({});
  w3.keyup('Escape');
  assert.equal(w3.done, false, 'a release with nothing armed closes nothing (:709)');
  w3.input('Escape');
  assert.equal(w3.done, false, 'the press is not the close - :186 reads GetKeyUp');
  w3.keyup('Escape');
  assert.equal(w3.done, true);
});

test('I3: save rides the gate - prevented answers the line, open saves and closes', () => {
  _resetForTests();
  const px = 85, py = PAUSE_PANEL_Y;
  let saved = 0, loaded = 0;
  const w = new PauseOptionsWindow({ savingPrevented: () => true, quickSave: () => saved++ });
  w.click(px + 4 + 1, py + 4 + 1);      // save
  assert.equal(w.top, 'note', 'cannotSaveNow (:296-303)');
  assert.equal(saved, 0);
  w.input('Space');                      // any key clears a note
  assert.equal(w.top, null);
  const w2 = new PauseOptionsWindow({ quickSave: () => saved++, quickLoad: () => loaded++ });
  w2.click(px + 4 + 1, py + 4 + 1);
  assert.equal(saved, 1);
  assert.equal(w2.done, true, 'the save closes the window');
  const w3 = new PauseOptionsWindow({ quickLoad: () => loaded++ });
  w3.click(px + 52 + 1, py + 4 + 1);    // load
  assert.equal(loaded, 1);
});

test('I3: the bars WRITE the settings under DFU\'s click law', () => {
  _resetForTests();
  const px = 85, py = PAUSE_PANEL_Y;
  const w = new PauseOptionsWindow({});
  const [bx, by] = [PAUSE_RECTS.soundBar[0], PAUSE_RECTS.soundBar[1]];
  w.click(px + bx + BAR_MAX / 2, py + by + 2);
  assert.equal(getFloat('Controls', 'SoundVolume', 0, 1), 0.5);
  w.click(px + bx + BAR_MAX * 0.995, py + by + 2);
  assert.equal(getFloat('Controls', 'SoundVolume', 0, 1), 1, 'the 99% snap reaches the store');
  // music too, on its own row
  const [mx, my] = [PAUSE_RECTS.musicBar[0], PAUSE_RECTS.musicBar[1]];
  w.click(px + mx + BAR_MAX * 0.25, py + my + 2);
  assert.equal(getFloat('Controls', 'MusicVolume', 0, 1), 0.25);
  _resetForTests();
  setValue('Controls', 'SoundVolume', 0.5);
});

test('I3: the wiring - four hosts, one Escape door each, art preloaded', () => {
  const code = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
  // routeKey's Escape case covers the two dungeon contexts
  assert.match(code('ui/input.js'), /case 'Escape': return ctx\.togglePause/);
  // PX26: ...and its own options after it. setPlayerPos is still the
  // first argument, which is what this pin is actually about.
  assert.match(code('scenes/dungeonContext.js'), /togglePause\(setPlayerPos = null, opts = \{\}\)/);
  // The exterior hosts hand-route. U43 moved the overlay/mode gate up
  // to cover the whole ladder at once - the same ladder the large HUD's
  // panels now reach through hudCtx - so the Escape ARM is inside that
  // gate rather than carrying its own copy, and the pin follows it.
  for (const rel of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = code(rel);
    const gate = src.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {");
    assert.ok(gate > 0, `${rel} gates its ladder on the overlay AND the mode`);
    // U51 re-aimed this: the gate is `pauseDoorReady`, which is
    // classic's art test OR the enhanced skin - whose screen needs no
    // ARENA2 at all, so gating it on OPTN00I0 would have left a player
    // with a failed art load holding a game with no pause menu, no
    // settings and no way out.
    const arm = src.indexOf("if (act === 'Escape' && pauseDoorReady()) { hudCtx.togglePause(); return; }");
    assert.ok(arm > gate, `${rel} opens on Escape, inside that gate`);
    // PX26: the door takes its own options now (the dial's north lands
    // on Stats). ONE door is the law and it is unchanged - the count
    // below is what this pin is actually counting.
    assert.equal((src.match(/togglePause: \(opts = \{\}\) => \{/g) ?? []).length, 1,
      `${rel} has exactly one pause door`);
    assert.match(src, /preloadPauseFlowArt\(/, `${rel} warms the art`);
  }
  // the interior arm rides worldModes' own overlay slot. U43 moved it
  // onto routeKey's Escape case - the SAME door the two dungeon
  // contexts use, which is what "one Escape door each" was always
  // reaching for - so this pins the ctx method the table calls rather
  // than the hand-rolled `mode === 'interior' && actionOf(e)` arm it
  // replaced.
  const modes = code('scenes/worldModes.js');
  assert.match(modes, /const interiorKeyCtx = \{/, 'the interior arm has a routeKey ctx');
  // PX26: with its own options after it - routeKey still calls it with
  // none, which is what the default is for.
  assert.match(modes, /togglePause\(opts = \{\}\) \{/, '...whose Escape door is togglePause, as routeKey calls it');
  assert.match(code('ui/input.js'), /case 'Escape': return ctx\.togglePause/, 'and routeKey calls it bare');
  assert.match(modes, /if \(routeKey\(e, interiorKeyCtx, null, keys\)\)/, '...and the table drives it');   // AUDIT 58 (f3/input): + the held-keys Set
  assert.match(modes, /preloadPauseFlowArt\(/);
  // and the door out is the ONE menu unwind (audit24_onehome watches
  // the symbol; this pins the CALL in the exit hook of each host)
  for (const rel of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.match(code(rel), /exitToMenu: exitToTitleMenu/, `${rel} exits through the shared door`);
  }
});


// ── MAC1 J ON THE CLASSIC SKIN ───────────────────────────────────

test('AUDIT 65 UI-2: the classic pause window relocks on RESUME, and only on resume', () => {
  // MAC1 J's mechanism is the enhanced door's (ui/pauseDoor.js:164-181):
  // the close runs INSIDE the Resume click or the Escape keyup - the
  // transient activation requestPointerLock needs - while the hosts'
  // look gate relocks on the NEXT frame, outside any gesture, which the
  // browser refuses. The fix was wired as `hooks.relock` and read only
  // by `enhancedPauseOverlay`, so a player on the CLASSIC skin got none
  // of it and spent the first click after every resume re-grabbing the
  // pointer (and took PlayerActivate.cs:1050-1054's SetClickDelay with
  // it). This face now reads the same hook on every RESUME exit: the
  // CONTINUE rect, the deferred Escape keyup, the two quick-verb
  // save/load fallbacks, and the PopToHUD drain of a COMPLETED pushed
  // save or load - and on none of the exits that hand over a window.
  //
  // The skin AND a document are both set: headless, the door's second
  // clause takes the classic branch whatever the skin says, and a pin
  // that only set the skin would pass for the wrong reason (the M4
  // shape test/enhancedPause.test.js names).
  _resetForTests();
  _resetUiPrefs();
  globalThis.location = { search: '?skin=classic' };
  globalThis.document = { createElement: () => ({ style: {}, remove() {} }), body: { append() {} } };
  try {
    assert.equal(isEnhanced(), false, 'this pin is about the classic skin');
    const px = 85, py = PAUSE_PANEL_Y;
    let relocked = 0;
    const open = (extra = {}) => {
      let shown = null;
      const w = openPauseFlow((win) => { shown = win; }, { relock: () => relocked++, ...extra });
      assert.equal(w?.constructor?.name, 'PauseOptionsWindow', 'the classic skin gets the canvas window');
      assert.equal(shown, w);
      return w;
    };

    // RESUME, door one: the CONTINUE rect.
    const cont = open();
    cont.click(px + 76 + 1, py + 60 + 1);
    assert.equal(cont.done, true, 'CONTINUE closes');
    assert.equal(relocked, 1, 'and relocks inside the click that closed it');

    // RESUME, door two: the deferred Escape RELEASE (ROAD-E E1).
    relocked = 0;
    const esc = open();
    esc.keyup('Escape');
    assert.equal(relocked, 0, 'a release with nothing armed closes nothing, so it relocks nothing');
    esc.input('Escape');
    esc.keyup('Escape');
    assert.equal(esc.done, true);
    assert.equal(relocked, 1, 'the close on the keyup relocks inside that keyup');

    // NOT the exit. There is no world to relock into - pauseDoor.js:176's
    // own `action !== 'exit'`.
    relocked = 0;
    const exit = open({ exitToMenu() {}, textLines: () => ['Are you sure?'] });
    exit.click(px + 101 + 1, py + 4 + 1);
    exit.input('KeyY');
    assert.equal(exit.done, true, 'Yes takes the door');
    assert.equal(relocked, 0, 'the exit leaves the pointer where the title menu can use it');

    // NOT the save or load DOORS - and driven through the bag the
    // PRODUCER mints, which is the whole point of this arm. All three
    // shipping pause hosts hand over saveAs + loadKey + pushWindow
    // (world.js:4910-4917, worldModes.js:6918-6924,
    // dungeonContext.js:4611-4617), so `saveLoadPushes` is true and the
    // door PUSHES the slot window: the pause window rides UNDER it,
    // `done` stays false and `_closeWith` is never reached at all. A
    // relock here would take away the cursor the slot window is for.
    // (A bag of `{ quickSave(){} }` alone is a shape no host mints, and
    // under it this arm would certify a law the game never runs.)
    relocked = 0;
    const pushed = [];
    const hostBag = {
      playerName: () => 'Alaric',
      saveAs: () => true,
      loadKey: () => {},
      pushWindow: (w) => pushed.push(w),
    };
    const save = open(hostBag);
    save.click(px + 4 + 1, py + 4 + 1);
    assert.equal(pushed.length, 1, 'the SAVE door PUSHES the slot window (ROAD-C C1)');
    assert.equal(save.done, false, 'the pause window rides under it - _closeWith never ran');
    assert.equal(relocked, 0, 'and nothing grabs the cursor that window is for');
    const load = open(hostBag);
    load.click(px + 52 + 1, py + 4 + 1);
    assert.equal(pushed.length, 2, 'the LOAD door pushes too');
    assert.equal(load.done, false);
    assert.equal(relocked, 0, 'nor on the load door');

    // ...but the DRAIN when one COMPLETES is a resume. PopToHUD
    // (DaggerfallUI.cs:829-836) empties the whole stack back to the
    // world inside the slot window's own click, and the enhanced twin
    // relocks on exactly it - pauseDoor.js:176 fires for 'save' and
    // 'load', not only for 'resume'. saveWindow.js:343 and :349 are the
    // two callers of this hook.
    assert.equal(typeof pushed[1].hooks.popToHUD, 'function',
      'a pushed slot window carries the drain');
    pushed[1].hooks.popToHUD();
    assert.equal(load.done, true, 'the drain closes the pause window under it');
    assert.equal(relocked, 1, 'and relocks inside the click that completed the load');

    // AND THE REPLACE FALLBACK, which is the arm that tells the two
    // candidate fixes apart. `openClassicPauseFlow` mints
    // `saveLoadPushes: !!push` and its own header documents the
    // push-less branch as supported (test/roadc_savewindow.test.js:669
    // drives it); there the SAVE door really does travel `_closeWith`
    // and STILL must not relock, because it is opening the slot window
    // in this window's place. No shipping host mints this bag today -
    // it is the seam's branch, not a host's - and it is the only
    // `_closeWith` caller that is not a resume, so a fix hung on
    // `_closeWith` instead of on the resume exits dies exactly here.
    relocked = 0;
    const replaceBag = { playerName: () => 'Alaric', saveAs: () => true, loadKey: () => {} };
    const repSave = open(replaceBag);
    repSave.click(px + 4 + 1, py + 4 + 1);
    assert.equal(repSave.done, true, 'the replace door closes this window up front');
    assert.equal(relocked, 0, 'and hands the cursor to the slot window it just opened');
    const repLoad = open(replaceBag);
    repLoad.click(px + 52 + 1, py + 4 + 1);
    assert.equal(repLoad.done, true);
    assert.equal(relocked, 0, 'the same on the load side');

    // THE QUICK-VERB FALLBACK is the other save/load shape, and it IS a
    // resume: a host with no saveAs/loadKey seam (exterior.js:2176's bag
    // carries neither, so its LOAD rect runs this today) closes straight
    // back to the world and opens no window at all.
    relocked = 0;
    const quickSave = open({ quickSave() {} });
    quickSave.click(px + 4 + 1, py + 4 + 1);
    assert.equal(quickSave.done, true, 'the one-press quicksave closes the window');
    assert.equal(relocked, 1, 'and hands the pointer back inside that click');
    const quickLoad = open({ quickLoad() {} });
    quickLoad.click(px + 52 + 1, py + 4 + 1);
    assert.equal(quickLoad.done, true);
    assert.equal(relocked, 2, 'the one-press quickload too');

    // NOT controls. That arm bypasses `_closeWith` outright and opens
    // the rebinding grid, which needs the cursor most of all. Built by
    // hand because the classic grid's own art is not loaded headless,
    // so the flow would hand this window a null openControls.
    relocked = 0;
    const ctl = new PauseOptionsWindow({ relock: () => relocked++, openControls() {} });
    ctl.click(px + 5 + 1, py + 60 + 1);
    assert.equal(ctl.done, true, 'the controls arm closes this window and opens the grid');
    assert.equal(relocked, 0, 'with the cursor intact');
  } finally {
    delete globalThis.document;
    delete globalThis.location;
    _resetUiPrefs();
  }
});
