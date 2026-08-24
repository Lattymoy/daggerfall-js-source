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
  // and the same Escape that opened it closes it (:186-190)
  const w3 = new PauseOptionsWindow({});
  w3.input('Escape');
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
  assert.match(code('scenes/dungeonContext.js'), /togglePause\(setPlayerPos = null\)/);
  // The exterior hosts hand-route. U43 moved the overlay/mode gate up
  // to cover the whole ladder at once - the same ladder the large HUD's
  // panels now reach through hudCtx - so the Escape ARM is inside that
  // gate rather than carrying its own copy, and the pin follows it.
  for (const rel of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = code(rel);
    const gate = src.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {");
    assert.ok(gate > 0, `${rel} gates its ladder on the overlay AND the mode`);
    const arm = src.indexOf("if (act === 'Escape' && pauseArtLoaded()) { hudCtx.togglePause(); return; }");
    assert.ok(arm > gate, `${rel} opens on Escape, inside that gate`);
    assert.match(src, /togglePause: \(\) => \{/, `${rel} has exactly one pause door`);
    assert.match(src, /preloadPauseFlowArt\(/, `${rel} warms the art`);
  }
  // the interior arm rides worldModes' own overlay slot
  assert.match(code('scenes/worldModes.js'), /mode === 'interior' && !interiorOverlay && actionOf\(e\) === 'Escape'/);
  assert.match(code('scenes/worldModes.js'), /preloadPauseFlowArt\(/);
  // and the door out is the ONE menu unwind (audit24_onehome watches
  // the symbol; this pins the CALL in the exit hook of each host)
  for (const rel of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.match(code(rel), /exitToMenu: exitToTitleMenu/, `${rel} exits through the shared door`);
  }
});
