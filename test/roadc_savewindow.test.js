// ROAD TO 1:1, WAVE C / C1 - THE SAVE-LOAD WINDOW'S SECOND PASS.
//
// SAV4 ported DaggerfallUnitySaveGameWindow.cs and landed the shape:
// the geometry, the (character, save name) identity, the overwrite and
// delete confirms, the rename input, the character picker, the classic
// switch. C1 walked the SAME C# line by line against what landed and
// found six behaviours the first pass paraphrased or skipped. Each one
// below fails on a revert of its own half, and none of them needs a
// byte of ARENA2 - they are the un-gated law tests the art halves of
// this window do not have.
//
// THE SIX, with the C# line beside each:
//   1. LoadGame is DEFERRED (:313-315, :516-520) - "Allow loading text
//      to draw before loading".
//   2. The strings are TextManager's, not the port's paraphrases
//      (Internal_Strings.csv).
//   3. UpdateSelectedSaveInfo CLEARS on an empty box or no selection
//      (:374-385), rather than on "the name resolves to a slot".
//   4. rename goes green with a selection (:415), as delete goes red.
//   5. Outline.Enabled is OFF unless the C# turns it on (Panel.cs:91;
//      :241, :259 turn rename's and delete's off outright).
//   6. Enabled=false is NOT DRAWN (:436-437, :449-452).
//
// ...and the seventh, on the door rather than the window: the pause
// menu PUSHES the slot window over itself (DaggerfallPauseOptionsWindow
// .cs:302, :308) and Cancel pops back onto it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SaveWindow, MAIN_PANEL, SW_RECTS, SW_COLORS, SW_TEXT,
  saveLoadPrompt, LOADING_FRAMES,
} from '../src/ui/saveWindow.js';
import { saveSlot } from '../src/systems/saveSlots.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';
import { openClassicPauseFlow, PAUSE_RECTS, PAUSE_PANEL_Y } from '../src/ui/pauseWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── the harness ───────────────────────────────────────────────────

function mockStorage(entries = {}) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function withStorage(fn) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = mockStorage();
  try { return fn(globalThis.localStorage); }
  finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
}

const snapOf = (name, minutes = 10) => ({ v: 1, name, classicMinutes: minutes });

/** Two Alaric saves (key 0 'Old' at t=100, key 1 'New' at t=300) plus
 *  one of Brisa's, so CharacterCount is 2 and the descending order has
 *  something to earn. */
function seedSaves(s) {
  saveSlot('Alaric', 'Old', snapOf('Alaric', 10), { storage: s, now: 100 });
  saveSlot('Alaric', 'New', snapOf('Alaric', 20), { storage: s, now: 300 });
  saveSlot('Brisa', 'Hers', snapOf('Brisa', 30), { storage: s, now: 200 });
}

/** A 320x200 canvas puts nativeMetrics at scale 1, origin 0 - every
 *  recorded quad is then in native pixels exactly as the C# rects are. */
const CANVAS = { width: 320, height: 200 };

/** Records every drawScreenQuad. `rects` are the untextured ones (the
 *  panels, the outlines, the row highlights); `drawn` is the text, off
 *  the glyphWidth-records-its-index trick the crafting pins use. */
function probe() {
  const rects = [];
  const chars = [];
  const shots = [];
  const renderer = {
    drawScreenQuad: (tex, r, uv, color) => { if (!tex) rects.push({ ...r, color }); },
    uploadTexture: () => ({}),
    releaseTexture: () => {},
  };
  const font = {
    tex: 'atlas',
    fnt: {
      fixedHeight: 6,
      fixedWidth: 4,
      glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; },
    },
  };
  return {
    renderer, font, rects, shots,
    get drawn() { return chars.join(''); },
    /** DaggerfallFont.DrawText advances a SPACE without emitting a
     *  quad (:328, the asymmetry AUDIT 23 recorded), so the glyph
     *  recorder never sees one - both sides drop spaces to compare. */
    saw(text) { return chars.join('').includes(text.replace(/ /g, '')); },
    /** The window's screenshot seam, as a recorder: it is asked ONLY
     *  for a slot UpdateSelectedSaveInfo did not clear. */
    screenshotTexture: (key) => { shots.push(key); return null; },
  };
}

const at = (rect) => [MAIN_PANEL[0] + rect[0], MAIN_PANEL[1] + rect[1], rect[2], rect[3]];
const near = (a, b) => Math.abs(a - b) < 0.001;
const sameColor = (c, want) => !!c && want.every((v, i) => near(c[i], v));

/** Was this exact rect filled, in this colour? */
function filled(rects, rect, color) {
  const [x, y, w, h] = at(rect);
  return rects.some((r) => near(r.x, x) && near(r.y, y) && near(r.w, w) && near(r.h, h)
    && sameColor(r.color, color));
}
/** Was anything at all drawn over this rect's own footprint? */
function anyAt(rects, rect) {
  const [x, y, w, h] = at(rect);
  return rects.some((r) => near(r.x, x) && near(r.y, y) && near(r.w, w) && near(r.h, h));
}
/** The `panel` helper's outline is four 1px strips in [1,1,1,0.35];
 *  the top one is the witness. */
function outlined(rects, rect) {
  const [x, y, w] = at(rect);
  return rects.some((r) => near(r.x, x - 1) && near(r.y, y - 1) && near(r.w, w + 2)
    && near(r.h, 1) && sameColor(r.color, [1, 1, 1, 0.35]));
}

// ═══════════ 1. THE LOADING DEFER (:48, :313-315, :516-520) ═══════════

test('C1: the Load button does NOT load - it raises the label and spends two Update ticks', () => {
  withStorage((s) => {
    seedSaves(s);
    const loaded = [];
    const win = new SaveWindow('load', { playerName: () => 'Alaric', loadKey: (k) => loaded.push(k) });
    assert.equal(win.nameText, 'New', 'the top save autoselects (:291-292)');

    // The go button (:164-165), pressed.
    win.click(MAIN_PANEL[0] + SW_RECTS.go[0] + 1, MAIN_PANEL[1] + SW_RECTS.go[1] + 1);
    assert.deepEqual(loaded, [], 'PromptLoadGame does not load - it hands back a callback (:516-520)');
    assert.equal(win.loading, true, 'the label is up');
    assert.equal(win.loadingCountdown, LOADING_FRAMES);
    assert.equal(win.done, false, 'and the window is STILL OPEN to draw it');

    win.update();                                  // :313 - --2 is 1, not 0
    assert.deepEqual(loaded, [], 'the loading text gets its frame - DFU\'s own comment');
    win.update();                                  // --1 is 0: LoadGame()
    assert.deepEqual(loaded, [1], 'the RIGHT key, through the (char,name) identity');
    assert.equal(win.done, true, 'LoadGame -> PopToHUD (:428)');
    assert.equal(win.loading, false);

    // A revert to SAV4's `done = true; loadKey(key)` fails the two
    // assertions above the ticks: the load landed on the press.
  });
});

test('C1: the loading label DRAWS on the frame the countdown buys, in white on Color.gray', () => {
  withStorage((s) => {
    seedSaves(s);
    const p = probe();
    const win = new SaveWindow('load', { playerName: () => 'Alaric', loadKey: () => {}, screenshotTexture: p.screenshotTexture });
    // Nothing is drawn while the window is idle (:48 - an empty
    // TextLabel draws nothing at all).
    win.draw(p.renderer, CANVAS, p.font);
    assert.equal(p.saw(SW_TEXT.loading), false, 'no label before the press');
    const grayBefore = p.rects.filter((r) => sameColor(r.color, [0.5, 0.5, 0.5, 1])).length;
    assert.equal(grayBefore, 0);

    win.click(MAIN_PANEL[0] + SW_RECTS.go[0] + 1, MAIN_PANEL[1] + SW_RECTS.go[1] + 1);
    const q = probe();
    win.draw(q.renderer, CANVAS, q.font);          // this draw also spends tick 1
    assert.ok(q.saw(SW_TEXT.loading), 'the label is on screen');
    const gray = q.rects.filter((r) => sameColor(r.color, [0.5, 0.5, 0.5, 1]));
    assert.equal(gray.length, 1, 'loadingLabel.BackgroundColor = Color.gray (:246)');
    // Center + Middle put it in the main panel's middle both ways
    // (alignment overrides the declared position per axis).
    assert.ok(Math.abs((gray[0].x + gray[0].w / 2) - (MAIN_PANEL[0] + MAIN_PANEL[2] / 2)) <= 2,
      'centred horizontally in the main panel');
    assert.ok(Math.abs((gray[0].y + gray[0].h / 2) - (MAIN_PANEL[1] + MAIN_PANEL[3] / 2)) <= 2,
      'and vertically (:250)');
    assert.equal(win.done, false, 'still open - the load is one tick away');
  });
});

test('C1: draw() IS the Update tick - a host that only draws still finishes the load', () => {
  withStorage((s) => {
    seedSaves(s);
    let loaded = null;
    const win = new SaveWindow('load', { playerName: () => 'Alaric', loadKey: (k) => { loaded = k; } });
    win.input('Enter');                            // the Return go key (:311-312)
    assert.equal(win.loading, true);
    const p = probe();
    win.draw(p.renderer, CANVAS, p.font);
    assert.equal(loaded, null);
    win.draw(p.renderer, CANVAS, p.font);
    assert.equal(loaded, 1, 'two draws are two Updates - Unity runs Update BEFORE Draw');
  });
});

// ═══════════ 2. THE STRINGS (Internal_Strings.csv) ═══════════

test('C1: the strings are TextManager\'s own, not the port\'s paraphrases', () => {
  // Internal_Strings.csv, verbatim - the five SAV4 got wrong first.
  assert.equal(SW_TEXT.saveLoadPromptFormat, "{0} for '{1}'", ':1580 - the name is QUOTED');
  assert.equal(SW_TEXT.noSavesFound, 'No saves found. Load a Classic save?', ':934');
  assert.equal(SW_TEXT.confirmDeleteSave, 'Are you sure you want to delete save?', ':930');
  assert.equal(SW_TEXT.switchChar, 'Switch Char', ':923');
  assert.equal(SW_TEXT.loading, 'Please wait...', ':918');
  // ...and the ones it had right, pinned so they cannot drift back.
  assert.equal(SW_TEXT.savePrompt, 'Save Game');
  assert.equal(SW_TEXT.loadPrompt, 'Load Game');
  assert.equal(SW_TEXT.enterSaveName, 'Enter save name');
  assert.equal(SW_TEXT.selectSaveName, 'Select a save');
  assert.equal(SW_TEXT.confirmOverwriteSave, 'Overwrite this save?');
  assert.equal(SW_TEXT.youMustEnterASaveName, 'You must enter a save name.');
  assert.equal(SW_TEXT.youMustSelectASaveName, 'You must select a save name.');
  assert.equal(saveLoadPrompt('Load Game', 'Alaric'), "Load Game for 'Alaric'");
});

test('C1: the drawn prompt QUOTES the character, and the no-saves arm is the classic offer', () => {
  withStorage((s) => {
    seedSaves(s);
    const p = probe();
    const win = new SaveWindow('save', { playerName: () => 'Alaric', screenshotTexture: p.screenshotTexture });
    win.draw(p.renderer, CANVAS, p.font);
    assert.ok(p.saw("Save Game for 'Alaric'"), 'saveLoadPromptFormat (:369)');
    assert.equal(p.saw('Save Game for Alaric.'), false, 'the quotes are not decoration');
    // The go button says "Save" here and "Load" in load mode (:439, :445).
    assert.ok(p.saw(SW_TEXT.saveButton));

    const q = probe();
    const empty = new SaveWindow('load', { playerName: () => 'Nobody', screenshotTexture: q.screenshotTexture });
    assert.equal(empty.noSaves, false, 'Nobody has no saves but the STORE does (:328)');
    const r = probe();
    withStorage(() => {
      const none = new SaveWindow('load', { playerName: () => 'Nobody', screenshotTexture: r.screenshotTexture });
      assert.equal(none.noSaves, true);
      none.draw(r.renderer, CANVAS, r.font);
      assert.ok(r.saw(SW_TEXT.noSavesFound), 'the :331 prompt, verbatim');
    });
  });
});

test('C1: the confirm boxes carry the CSV text - the delete confirm is not "this save"', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    win.click(...[MAIN_PANEL[0] + SW_RECTS.del[0] + 1, MAIN_PANEL[1] + SW_RECTS.del[1] + 1]);
    assert.equal(win.top, 'delete');
    const p = probe();
    win.draw(p.renderer, CANVAS, p.font);
    assert.ok(p.saw(SW_TEXT.confirmDeleteSave));
    assert.equal(p.saw('delete this save'), false, 'the port\'s old wording is gone');

    const save = new SaveWindow('save', { playerName: () => 'Alaric', saveAs: () => true });
    save._onType('Old');                            // an existing pair
    save.input('Enter');
    assert.equal(save.top, 'overwrite');
    const q = probe();
    save.draw(q.renderer, CANVAS, q.font);
    assert.ok(q.saw(SW_TEXT.confirmOverwriteSave));
  });
});

// ═══ 3. UpdateSelectedSaveInfo's CLEAR arm (:374-385) ═══

test('C1: no selection clears the info panel WHOLE - the screenshot is not even asked for', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    assert.equal(win.selectedIndex, 0);

    const p = probe();
    win.hooks.screenshotTexture = p.screenshotTexture;
    win.draw(p.renderer, CANVAS, p.font);
    assert.deepEqual(p.shots, [1], 'a selected slot draws its shot (:402-406)');
    assert.ok(p.drawn.includes('SAVE1'), 'the folder label (:412)');
    assert.ok(p.drawn.includes('V1'), 'the version label (:411)');

    // SelectNone (:548): the box still holds the name, the list does
    // not hold the row. THE C# CLEARS ANYWAY - SAV4 kept drawing,
    // because the name still resolved to a slot.
    win.selectedIndex = -1;
    const q = probe();
    win.hooks.screenshotTexture = q.screenshotTexture;
    win.draw(q.renderer, CANVAS, q.font);
    assert.deepEqual(q.shots, [], 'screenshotPanel.BackgroundTexture = null (:377)');
    assert.equal(q.drawn.includes('SAVE1'), false, 'saveFolderLabel.Text = string.Empty (:379)');
    assert.equal(q.drawn.includes('V1'), false, 'saveVersionLabel.Text = string.Empty (:378)');

    // ...and the same for an empty box with a live index, the other
    // half of the :375 test.
    win.selectedIndex = 0;
    win.nameText = '';
    const r = probe();
    win.hooks.screenshotTexture = r.screenshotTexture;
    win.draw(r.renderer, CANVAS, r.font);
    assert.deepEqual(r.shots, [], 'saveNameTextBox.Text.Length == 0 clears too');
  });
});

test('C1: a typed non-match deselects, and the info goes with it (:539-551)', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('save', { playerName: () => 'Alaric', saveAs: () => true });
    win._onType('New');
    assert.equal(win.selectedIndex, 0, 'FindIndex hit -> SelectedIndex (:541-545)');
    const p = probe();
    win.hooks.screenshotTexture = p.screenshotTexture;
    win.draw(p.renderer, CANVAS, p.font);
    assert.deepEqual(p.shots, [1]);

    win._onType('Newer');
    assert.equal(win.selectedIndex, -1, 'SelectNone (:548)');
    const q = probe();
    win.hooks.screenshotTexture = q.screenshotTexture;
    win.draw(q.renderer, CANVAS, q.font);
    assert.deepEqual(q.shots, [], 'UpdateSelectedSaveInfo() right after it (:549)');
  });
});

// ═══ 4 + 5. THE BUTTON COLOURS AND THE OUTLINES ═══

test('C1: rename goes GREEN and delete RED with a selection, and both fall back together', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    const p = probe();
    win.draw(p.renderer, CANVAS, p.font);
    assert.ok(filled(p.rects, SW_RECTS.rename, SW_COLORS.save),
      'renameSaveButton.BackgroundColor = saveButtonBackgroundColor (:415)');
    assert.ok(filled(p.rects, SW_RECTS.del, SW_COLORS.cancel),
      'deleteSaveButton.BackgroundColor = cancelButtonBackgroundColor (:416)');

    win.selectedIndex = -1;
    const q = probe();
    win.draw(q.renderer, CANVAS, q.font);
    assert.ok(filled(q.rects, SW_RECTS.rename, SW_COLORS.namePanel), ':382');
    assert.ok(filled(q.rects, SW_RECTS.del, SW_COLORS.namePanel), ':383');
    assert.equal(filled(q.rects, SW_RECTS.rename, SW_COLORS.save), false,
      'the green does not survive the clear');
  });
});

test('C1: Outline.Enabled is OFF unless the C# turns it on (Panel.cs:91)', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('load', {
      playerName: () => 'Alaric', onSwitchClassic: () => {},
    });
    const p = probe();
    win.draw(p.renderer, CANVAS, p.font);
    // Turned ON, by name: mainPanel (:114), namePanel (:127),
    // savesPanel (:141), screenshotPanel (:199), go (:168),
    // switchClassic (:179), cancel (:190).
    for (const [name, rect] of [
      ['namePanel', SW_RECTS.namePanel], ['savesPanel', SW_RECTS.savesPanel],
      ['screenshot', SW_RECTS.screenshot], ['go', SW_RECTS.go],
      ['switchClassic', SW_RECTS.switchClassic], ['cancel', SW_RECTS.cancel],
    ]) assert.ok(outlined(p.rects, rect), `${name} keeps its outline`);
    // Turned OFF outright: rename (:241) and delete (:259). Never asked
    // for: switchChar, and the list and scroller SAV4 already had right.
    for (const [name, rect] of [
      ['rename', SW_RECTS.rename], ['delete', SW_RECTS.del],
      ['switchChar', SW_RECTS.switchChar], ['savesList', SW_RECTS.savesList],
      ['scroller', SW_RECTS.scroller],
    ]) assert.equal(outlined(p.rects, rect), false, `${name} draws NO outline`);
  });
});

// ═══ 6. Enabled=false IS NOT DRAWN (:436-437, :449-452) ═══

test('C1: SetMode HIDES the two load-only buttons in save mode - it does not dim them', () => {
  withStorage((s) => {
    seedSaves(s);
    const p = probe();
    const save = new SaveWindow('save', {
      playerName: () => 'Alaric', saveAs: () => true, onSwitchClassic: () => {},
    });
    save.draw(p.renderer, CANVAS, p.font);
    assert.equal(anyAt(p.rects, SW_RECTS.switchClassic), false,
      'switchClassicButton.Enabled = false (:437) - a disabled component is not drawn');
    assert.equal(anyAt(p.rects, SW_RECTS.switchChar), false, 'switchCharButton.Enabled = false (:436)');
    assert.equal(p.saw(SW_TEXT.classicSave), false);
    assert.equal(p.saw(SW_TEXT.switchChar), false);
    // The click follows the draw: a press where the button is not.
    let classic = 0;
    save.hooks.onSwitchClassic = () => classic++;
    save.click(MAIN_PANEL[0] + SW_RECTS.switchClassic[0] + 1, MAIN_PANEL[1] + SW_RECTS.switchClassic[1] + 1);
    assert.equal(classic, 0);

    // Load mode draws both.
    const q = probe();
    const load = new SaveWindow('load', { playerName: () => 'Alaric', onSwitchClassic: () => {} });
    load.draw(q.renderer, CANVAS, q.font);
    assert.ok(anyAt(q.rects, SW_RECTS.switchClassic));
    assert.ok(q.saw(SW_TEXT.switchChar), 'the label is "Switch Char" (:923)');
    assert.equal(q.saw('Character'), false, 'not the port\'s old word');
  });
});

test('C1: switchChar needs CharacterCount >= 1 (:449-452)', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    assert.equal(win.characterCount, 2, 'Alaric and Brisa');
    const p = probe();
    win.draw(p.renderer, CANVAS, p.font);
    assert.ok(anyAt(p.rects, SW_RECTS.switchChar));
  });
  // An empty store: no characters, so the button is disabled - and a
  // disabled button is not drawn.
  withStorage(() => {
    const win = new SaveWindow('load', { playerName: () => 'Nobody' });
    assert.equal(win.characterCount, 0);
    const p = probe();
    win.draw(p.renderer, CANVAS, p.font);
    assert.equal(anyAt(p.rects, SW_RECTS.switchChar), false, 'CharacterCount 0 -> Enabled = false');
  });
});

// ═══ 6b. THE WHEEL (ListBox.cs:513-525 -> :791-812) ═══

test('C1: the wheel scrolls the list ONE ROW a notch, clamped at both ends', () => {
  withStorage((s) => {
    // 20 saves for one character: 16 rows displayed, so four to scroll.
    for (let i = 0; i < 20; i++) {
      saveSlot('Alaric', `S${i}`, snapOf('Alaric', i), { storage: s, now: 100 + i });
    }
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    assert.equal(win.rows.length, 20);
    assert.equal(win.scrollIndex, 0);
    assert.equal(win.wheel(1), true, 'the window owns the wheel');
    assert.equal(win.scrollIndex, 1, 'ScrollDown moves ONE row (:801-805), not a page');
    win.wheel(1); win.wheel(1); win.wheel(1);
    assert.equal(win.scrollIndex, 4, 'listItems.Count - rowsDisplayed');
    win.wheel(1);
    assert.equal(win.scrollIndex, 4, 'and it clamps there');
    for (let i = 0; i < 10; i++) win.wheel(-1);
    assert.equal(win.scrollIndex, 0, 'ScrollUp clamps at 0 (:793-794)');

    // A stacked box is the top window - the list is not scrolled under it.
    win.top = 'delete';
    win.wheel(1);
    assert.equal(win.scrollIndex, 0);
  });
});

test('C1: a list that fits does not scroll at all (count - rowsDisplayed is 0)', () => {
  withStorage((s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    win.wheel(1);
    assert.equal(win.scrollIndex, 0, 'two rows in sixteen have nowhere to go');
  });
});

// ═══ 7. THE DOOR: the pause menu PUSHES the slot window ═══

/** The stack shape the three hosts hand over, in miniature: a slot
 *  mirror plus the push and drop doors townTalk/mountInterior/
 *  pushDungeonWindow are. */
function stubHost() {
  const stack = [];
  return {
    stack,
    get top() { return stack.length ? stack[stack.length - 1] : null; },
    show(win) { stack.length = 0; stack.push(win); },
    push(win) { stack.push(win); },
    /** The hosts' `if (overlay?.done) dropOverlay()` frame line. */
    tick() { while (stack.length && stack[stack.length - 1].done) stack.pop(); },
  };
}

test('C1: SAVE and LOAD push the slot window OVER the pause window, and Cancel pops back onto it', () => {
  withStorage((s) => {
    seedSaves(s);
    const host = stubHost();
    const pause = openClassicPauseFlow((w) => host.show(w), {
      playerName: () => 'Alaric',
      saveAs: () => true,
      loadKey: () => {},
      pushWindow: (w) => host.push(w),
    });
    assert.equal(host.top, pause);

    // The LOAD button (52,4,46,16) in panel space.
    const R = PAUSE_RECTS;
    pause.click(160 - 74 + R.load[0] + 1, PAUSE_PANEL_Y + R.load[1] + 1);
    assert.equal(pause.done, false,
      'PushWindow(..., this, ...) leaves the pause window standing as `previous` (:308)');
    assert.equal(host.stack.length, 2, 'the slot window is laid OVER it');
    const slot = host.top;
    assert.ok(slot instanceof SaveWindow);
    assert.equal(slot.mode, 'load');

    // CloseWindow() (:526) - the pop uncovers the pause window ITSELF,
    // not a rebuilt copy, so onBack must not rebuild one.
    slot.input('Escape');
    assert.equal(slot.done, true);
    host.tick();
    assert.equal(host.top, pause, 'the SAME window comes back');
    assert.equal(host.stack.length, 1);

    // ...and SAVE takes the same door (:302).
    pause.click(160 - 74 + R.save[0] + 1, PAUSE_PANEL_Y + R.save[1] + 1);
    assert.equal(pause.done, false);
    assert.equal(host.stack.length, 2);
    assert.equal(host.top.mode, 'save');
  });
});

test('C1: a host with NO push door keeps the replace-and-rebuild posture, and says which it is', () => {
  withStorage((s) => {
    seedSaves(s);
    const host = stubHost();
    const pause = openClassicPauseFlow((w) => host.show(w), {
      playerName: () => 'Alaric',
      loadKey: () => {},
      // no pushWindow
    });
    const R = PAUSE_RECTS;
    pause.click(160 - 74 + R.load[0] + 1, PAUSE_PANEL_Y + R.load[1] + 1);
    assert.equal(pause.done, true, 'the replace fallback closes the pause window first');
    assert.equal(host.stack.length, 1, 'and the slot window took its place');
    const slot = host.top;
    assert.ok(slot instanceof SaveWindow);
    assert.ok(slot.hooks.onBack, 'so onBack has to REBUILD a pause window');
    slot.input('Escape');
    host.tick();
    assert.ok(host.top && host.top !== pause, 'a NEW pause window, which is the cost this records');
  });
});

test('C1: the flow marks which door it took, and the three hosts that have the seams hand one over', () => {
  const pauseSrc = read('src/ui/pauseWindow.js');
  assert.match(pauseSrc, /const push = hooks\.pushWindow \?\? null;/);
  assert.match(pauseSrc, /saveLoadPushes: !!push/);
  // The pause window's two buttons read the flag rather than closing
  // unconditionally - the U24 done-first law does NOT apply to a push.
  assert.equal((pauseSrc.match(/if \(!this\.hooks\.saveLoadPushes\) this\._closeWith\(\);/g) || []).length, 2,
    'SAVE and LOAD both');
  // The three hosts with saveAs/loadKey seams, each through its own
  // PushWindow (the fourth, exterior.js, has savingPrevented: () => true
  // and mounts no slot window at all).
  assert.match(read('src/scenes/world.js'), /pushWindow: \(w\) => townTalk\.pushOverlay\(w\),/);
  assert.match(read('src/scenes/worldModes.js'), /pushWindow: mountInterior,/);
  assert.match(read('src/scenes/dungeonContext.js'), /pushWindow: \(w\) => pushDungeonWindow\(w\),/);
  assert.equal(read('src/scenes/exterior.js').includes('pushWindow:'), false,
    'the probe host has no save seams to push for');
});
