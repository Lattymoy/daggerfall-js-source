// AUDIT 64, lane HUD. Seven laws of DaggerfallHUD the port had drawn
// around: the mid-screen text label (a whole second text surface), the
// window rule that stops the small HUD painting under an open window,
// the two shortcut arms of DaggerfallHUD.Update, the escort column's
// screen anchoring, VerticalProgress' rounding on the breath bar, and
// HUDLarge's click sound. Every pin here asserts the REFERENCE's
// value and was mutation-proven against the fix it covers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MidScreenText, midScreenText, setMidScreenText,
  MID_SCREEN_TEXT_DEFAULT_Y, MID_SCREEN_TEXT_DEFAULT_DELAY,
} from '../src/ui/midScreenText.js';
import { HudText, HUD_TEXT_POP_DELAY } from '../src/ui/hudText.js';
import {
  hudRenderEnabled, toggleHudRender, hudShortcutKey, _resetHudRender,
} from '../src/ui/hudShortcuts.js';
import { drawHud, hudScale, HUD_BORDER, BREATH_BAR_LEFT, BREATH_BAR_BOTTOM, BREATH_BAR_WIDTH } from '../src/ui/hud.js';
import {
  initEscortFaces, restoreEscortFacesSaveData, clearEscortFaces, drawEscortFaces,
  ESCORT_SPECIAL_FACE_SIZE, ESCORT_START_X, ESCORT_START_Y,
} from '../src/ui/hudEscortFaces.js';
import { routeLargeHudClick, LARGE_HUD_W, LARGE_HUD_H } from '../src/ui/hudLarge.js';
import { makeWindowStack, paintsPreviousWindow } from '../src/ui/windowStack.js';
import { ActionTextBox, ActionInputBox } from '../src/ui/actionText.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { setCursorActive } from '../src/player/pointerLock.js';
import { isEnhanced } from '../src/systems/uiSkin.js';
import { getBool, setValue, _resetForTests } from '../src/systems/settings.js';
import { playerDamageFlash } from '../src/ui/damageFlash.js';

const src = (p) => readFileSync(`src/${p}`, 'utf8');
const recorder = () => ({
  quads: [],
  uploadTexture: () => 'tex',
  drawScreenQuad(tex, rect, uv, color) { this.quads.push({ tex, ...rect, color }); },
});
const font = () => ({ fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 } });
const hudArt = () => ({
  health: { tex: 'tex:MAIN03I0', w: 4, h: 32 },
  fatigue: { tex: 'tex:MAIN04I0', w: 4, h: 32 },
  magicka: { tex: 'tex:MAIN05I0', w: 4, h: 32 },
  compass: { tex: 'tex:COMPASS', w: 258 + 64, h: 17 },
  compassBox: { tex: 'tex:COMPBOX', w: 69, h: 17 },
  breathNormal: { tex: 'tex:breath-normal', w: 1, h: 1 },
  breathShort: { tex: 'tex:breath-short', w: 1, h: 1 },
});
const vitals = (over = {}) => ({
  health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400,
  stats: { strength: 50, endurance: 50 }, ...over,
});

// ── F34  DaggerfallHUD's SECOND text surface ─────────────────────

test('AUDIT 64 F34: the mid-screen label REPLACES and blanks at midScreenTextDelay, where the popup queue stacks', () => {
  const label = new MidScreenText();
  // DaggerfallHUD.cs:50-51 - the -1 sentinel and the 1.5 s default.
  assert.equal(label.timer, -1);
  assert.equal(MID_SCREEN_TEXT_DEFAULT_DELAY, 1.5);
  assert.equal(MID_SCREEN_TEXT_DEFAULT_Y, 146);
  // a label at rest does not accumulate dt (the sentinel gate, :260)
  label.tick(0.5);
  assert.equal(label.timer, -1, 'an unarmed timer is not stepped');

  // :367-369 - text, timer 0, delay. Then :262-266 blanks it once the
  // timer passes the delay, and NOT before.
  label.set('You are too far away...');
  assert.equal(label.timer, 0);
  label.tick(1.4);
  assert.equal(label.text, 'You are too far away...', '1.4 s is inside the 1.5 s delay');
  label.tick(0.2);
  assert.equal(label.text, '', '1.6 s is past it');
  assert.equal(label.timer, -1, 'and the sentinel is re-armed');

  // The popup queue is a DIFFERENT surface: PopupText.popDelay is 1.0
  // where midScreenTextDelay is 1.5, and AddText QUEUES where the
  // label replaces. Four presses of a mode key build a four-row column
  // at the top of the panel; the label shows the last one, alone.
  assert.notEqual(HUD_TEXT_POP_DELAY, MID_SCREEN_TEXT_DEFAULT_DELAY);
  const popup = new HudText();
  const label2 = new MidScreenText();
  for (const m of ['steal', 'grab', 'info', 'talk']) {
    popup.add(`Interaction is now in ${m} mode.`);
    label2.set(`Interaction is now in ${m} mode.`);
  }
  assert.equal(popup.lines.length, 4, 'PopupText.AddText queues unconditionally');
  assert.equal(label2.text, 'Interaction is now in talk mode.', 'the label holds ONE line');

  // A second write REPLACES and re-arms; nothing stacks (:367-369).
  const label3 = new MidScreenText();
  label3.set('first');
  label3.tick(1.4);
  label3.set('second');
  assert.equal(label3.text, 'second');
  assert.equal(label3.timer, 0, 'the timer is re-armed, not continued');
  label3.tick(1.4);
  assert.equal(label3.text, 'second', 'a queue would have shown "first" for 1.5 s of its own');

  // the delay is a FIELD (:51, :370), overwritten per message
  const label4 = new MidScreenText();
  label4.set('brief', 0.5);
  label4.tick(0.6);
  assert.equal(label4.text, '');

  // :371 Notebook.AddMessage(message) - the same tail PopupText.AddText
  // carries at PopupText.cs:123.
  const filed = [];
  const label5 = new MidScreenText();
  label5.onMessage = (t) => filed.push(t);
  label5.set('You have no arrows.');
  label5.set('You have no arrows.');
  assert.deepEqual(filed, ['You have no arrows.', 'You have no arrows.'], 'once per set, not once per frame');
});

test('AUDIT 64 F34: the large-HUD reposition is guarded by the SETTING, clamped below 146 and truncated', () => {
  // DaggerfallHUD.cs:356-365 verbatim:
  //   float offset = Screen.height - LargeHUD.ScreenHeight;
  //   float localY = (offset / LocalScale.y) - 7;
  //   if (localY < midScreenTextDefaultY) Position = (0, (int)localY);
  //   else                                Position = (0, midScreenTextDefaultY);
  const label = new MidScreenText();

  // The whole block is behind `DaggerfallUnity.Settings.LargeHUD`
  // (:357): with the setting off the label never leaves 146.
  label.observe(1080, 5, null);
  label.set('x');
  assert.equal(label.y, 146);

  // A SHORT bar leaves localY ABOVE 146, and the clamp keeps the label
  // at 146 rather than letting it drop with the bar: (1080-100)/5 - 7
  // = 189, which is not < 146.
  label.observe(1080, 5, 100);
  label.set('x');
  assert.equal(label.y, 146, 'the < 146 clamp - an unclamped lift would read 189');

  // A TALL bar lifts it: (1080-400)/5 - 7 = 129.
  label.observe(1080, 5, 400);
  label.set('x');
  assert.equal(label.y, 129);

  // ...and the assignment is `(int)localY` - TRUNCATION, not rounding:
  // (1080-401)/5 - 7 = 128.8.
  label.observe(1080, 5, 401);
  label.set('x');
  assert.equal(label.y, 128, 'Math.round would give 129');

  // The position is computed inside set() and PERSISTS - a later frame
  // with a different bar does not move a message already on screen.
  label.observe(1080, 5, 100);
  assert.equal(label.y, 128);
});

test('AUDIT 64 F34: drawHud draws the label centred over the native panel at y=146, and hides it under a window', () => {
  midScreenText._reset();
  const canvas = { width: 1920, height: 1080 };
  const f = font();
  setMidScreenText('AB');
  const r = recorder();
  drawHud(r, canvas, hudArt(), vitals(), 0, 0, { font: f });
  // nativeMetrics at 1920x1080: s = 5, ox = 160, oy = 40. The label is
  // a NativePanel child (DaggerfallHUD.cs:177) with
  // HorizontalAlignment.Center (:175) at Position.y 146 (:176).
  const glyphs = r.quads.filter((q) => q.y === 40 + 146 * 5);
  assert.ok(glyphs.length > 0, 'the label drew on the native panel row 146');

  // ...and under a window that CUTS the previousWindow chain it does
  // not draw at all: it is a component of the HUD window
  // (DaggerfallUI.cs:483-491 over DaggerfallPopupWindow.cs:76-84).
  midScreenText._reset();
  setMidScreenText('AB');
  const r2 = recorder();
  drawHud(r2, canvas, hudArt(), vitals(), 0, 0, { font: f, cursorActive: true, windowCoversHud: true });
  assert.equal(r2.quads.some((q) => q.y === 40 + 146 * 5), false);
  midScreenText._reset();
});

test('AUDIT 64 F34: drawHud feeds SetMidScreenText the LIVE screen, so a real large bar lifts the label', () => {
  // DaggerfallHUD.cs:356-365 reads `Screen.height`,
  // `midScreenTextLabel.LocalScale.y` and `LargeHUD.ScreenHeight` at
  // SET time - values only the frame has. drawHud is the one call that
  // has them, so its `observe` IS the wiring; without it the label
  // never leaves 146 whatever the bar does.
  _resetForTests();
  midScreenText._reset();
  setValue('GUI', 'LargeHUD', true);
  setValue('GUI', 'LargeHUDDocked', true);
  try {
    // 2560x1080: nativeMetrics s = 5 (min(8, 5.4) floored), oy = 40;
    // the DOCKED bar is the screen's full width, so its height is
    // 46 * 2560/320 = 368 (HUDLarge 320x46, AutoSizeModes.ScaleToFit).
    const canvas = { width: 2560, height: 1080 };
    const f = font();
    const large = { art: { main: { tex: 'tex:MAIN00I0' } }, docked: true, undockedScale: 1, alignment: 0, mode: 'info' };
    // two frames: the first paints the bar, the second observes it
    drawHud(recorder(), canvas, hudArt(), vitals(), 0, 0, { font: f, largeHud: large });
    drawHud(recorder(), canvas, hudArt(), vitals(), 0, 0, { font: f, largeHud: large });
    setMidScreenText('AB');
    // (1080 - 368)/5 - 7 = 135.4, which IS < 146, so (int) 135.
    assert.equal(midScreenText.y, 135, 'the label lifted over the live bar');
    const r = recorder();
    drawHud(r, canvas, hudArt(), vitals(), 0, 0, { font: f, largeHud: large });
    assert.ok(r.quads.some((q) => q.y === 40 + 135 * 5), 'and it is DRAWN on the lifted row');
    assert.equal(r.quads.some((q) => q.y === 40 + 146 * 5), false, 'not on the default row');
  } finally {
    midScreenText._reset();
    _resetForTests();
  }
});

test('AUDIT 64 F34: the label TIMER is dead under any window - Update runs for the top window alone', () => {
  // DaggerfallUI.cs:429-433 updates `uiManager.TopWindow` and nothing
  // else, so DaggerfallHUD.Update - and with it the midScreenTextTimer
  // tail at :259-267 - stops the moment any window is pushed over the
  // HUD. The LargeHUD repaint at :483-491 is Draw, not Update, so the
  // freeze holds with the large HUD on, where the label is still
  // PAINTED.
  _resetForTests();
  midScreenText._reset();
  setValue('GUI', 'LargeHUD', true);
  try {
    const canvas = { width: 1920, height: 1080 };
    const f = font();
    const large = { art: { main: { tex: 'tex:MAIN00I0' } }, docked: true, undockedScale: 1, alignment: 0, mode: 'info' };
    setMidScreenText('AB');
    // ten frames of a third of a second - more than twice the 1.5 s
    // delay - with a window open over the large HUD.
    for (let i = 0; i < 10; i++) {
      drawHud(recorder(), canvas, hudArt(), vitals(), 0, 1 / 3,
        { font: f, cursorActive: true, windowCoversHud: false, largeHud: large });
    }
    assert.equal(midScreenText.text, 'AB', 'the timer never advanced under the window');
    assert.equal(midScreenText.timer, 0);
    // ...and it expires again the moment the window goes.
    for (let i = 0; i < 10; i++) {
      drawHud(recorder(), canvas, hudArt(), vitals(), 0, 1 / 3, { font: f, largeHud: large });
    }
    assert.equal(midScreenText.text, '', 'and resumes when the HUD is the top window again');
  } finally {
    midScreenText._reset();
    _resetForTests();
  }
});

test('AUDIT 64 F34: every SetMidScreenText caller speaks to the label, and the two PopupMessage siblings do not', () => {
  // PlayerActivate.cs:1424 - the mode line, in BOTH hosts that own one
  // (one C# call site, so one surface everywhere).
  assert.match(src('scenes/townTalk.js'), /setMidScreenText\(`Interaction is now in \$\{m\} mode\.`\)/);
  assert.match(src('scenes/dungeon.js'), /setMidScreenText\(`Interaction is now in \$\{im\} mode\.`\)/);
  // :780/:790/:834 - the youAreTooFarAway refusals.
  assert.equal((src('scenes/townTalk.js').match(/setMidScreenText\(TOO_FAR_AWAY_TEXT\)/g) ?? []).length, 3);
  assert.match(src('scenes/worldModes.js'), /setMidScreenText\(TOO_FAR_AWAY_TEXT\)/);   // :711, the bulletin board
  assert.match(src('player/mobileEnemyActivate.js'), /midScreen\?\.\(TOO_FAR_AWAY_TEXT\)/);   // :834
  // :996-1007 - LookAtInteriorLock, in both hosts that carry a lock.
  assert.match(src('scenes/dungeonContext.js'), /setMidScreenText\(lookAtLockText\(/);
  assert.equal((src('scenes/worldModes.js').match(/setMidScreenText\(lookAtLockText\(/g) ?? []).length, 2);
  // FPSWeapon.cs:365
  assert.match(src('combat/weaponRig.js'), /setMidScreenText\('You have no arrows\.'\)/);
  // ...and the siblings that are PopupMessage in the reference stay on
  // the popup queue: PlayerActivate.cs:527 (lockedExteriorDoor, one
  // line above LookAtInteriorLock) and :553/:564 with
  // DaggerfallActionDoor.cs:170/:175/:189 (the pick outcomes).
  assert.match(src('scenes/worldModes.js'), /townTalk\?\.say\?\.\(LOCKED_EXTERIOR_DOOR_TEXT\)/);
  assert.match(src('scenes/dungeonContext.js'), /hudText\.add\(success \? LOCKPICKING_SUCCESS_TEXT : LOCKPICKING_FAILURE_TEXT\)/);
  // ...and mobileEnemyActivate's pickpocket RESULT keeps the popup sink
  // it always had (:838 -> :1611), which is why the refusal took a
  // second sink instead of re-pointing the first.
  assert.match(src('player/mobileEnemyActivate.js'), /if \(r\.modal\) modal\?\.\(r\.message\); else hud\?\.\(r\.message\);/);
  // the notebook tail is wired wherever HudText's is
  assert.match(src('scenes/townTalk.js'), /midScreenText\.onMessage = fn;/);
  assert.match(src('scenes/dungeonContext.js'), /midScreenText\.onMessage = \(t\) => opts\.hudMessageSink\?\.\(t\);/);
});

// ── F35  the HUD is not painted under a window ───────────────────

test('AUDIT 64 F35: with the small HUD an open window paints no HUD; with the large HUD it repaints', () => {
  const canvas = { width: 1920, height: 1080 };
  const bar = { art: { main: { tex: 'tex:MAIN00I0' } } };

  // DaggerfallUI.cs:483-491 draws `uiManager.TopWindow.Draw()` alone
  // and repaints dfHUD BEFORE it only under Settings.LargeHUD. The
  // window here is one of the null-previousWindow instances DaggerfallUI
  // pushes from play (:512-530) - the inventory, the pause options -
  // which is what the host's `windowCoversHud` answers.
  const open = recorder();
  drawHud(open, canvas, hudArt(), vitals(), 0, 0, { font: font(), cursorActive: true, windowCoversHud: true });
  const texes = (r) => r.quads.map((q) => String(q.tex));
  for (const gone of ['tex:MAIN03I0', 'tex:MAIN04I0', 'tex:MAIN05I0', 'tex:COMPBOX', 'tex:COMPASS']) {
    assert.equal(texes(open).includes(gone), false, `${gone} is not painted under a window`);
  }

  // the same frame with no window paints them all
  const shut = recorder();
  drawHud(shut, canvas, hudArt(), vitals(), 0, 0, { font: font() });
  for (const there of ['tex:MAIN03I0', 'tex:COMPBOX', 'tex:COMPASS']) {
    assert.ok(texes(shut).includes(there), `${there} paints with no window up`);
  }

  // ...and the LargeHUD arm of :485-486 still repaints under a window -
  // this is the half a bare "return when cursorActive" would break.
  const large = recorder();
  drawHud(large, canvas, hudArt(), vitals(), 0, 0,
    { font: font(), cursorActive: true, windowCoversHud: true, largeHud: bar });
  assert.ok(texes(large).includes('tex:MAIN00I0'), 'the large bar repaints before the window');
});

test('AUDIT 64 F35: a MESSAGE BOX paints the whole small HUD under it - previousWindow is the then-top HUD', () => {
  // DaggerfallUI.MessageBox builds every box as `new
  // DaggerfallMessageBox(Instance.uiManager, Instance.uiManager
  // .TopWindow, ...)` (DaggerfallUI.cs:1330/:1339/:1348/:1357), and
  // during play that TopWindow IS dfHUD (:407-408). DaggerfallPopupWindow
  // .Draw then runs `previousWindow.Draw()` BEFORE its own
  // (DaggerfallPopupWindow.cs:76-84), so the HUD is painted under the
  // box - with `ScreenDimColor` = Color.clear (:27/:34) over it, i.e.
  // nothing.
  const canvas = { width: 1920, height: 1080 };
  const r = recorder();
  drawHud(r, canvas, hudArt(), vitals(), 0, 0,
    { font: font(), cursorActive: true, windowCoversHud: false });
  const texes = r.quads.map((q) => String(q.tex));
  for (const there of ['tex:MAIN03I0', 'tex:MAIN04I0', 'tex:MAIN05I0', 'tex:COMPBOX', 'tex:COMPASS']) {
    assert.ok(texes.includes(there), `${there} is painted under a message box`);
  }
});

test('AUDIT 64 F35: the stack answers it - one null previousWindow anywhere cuts the chain', () => {
  // DaggerfallPopupWindow.Draw (:76-84) recurses while previousWindow
  // is set and stops where it is null, so the HUD at the bottom of the
  // stack (DaggerfallUI.cs:407-408) is reached only when EVERY window
  // over it paints its own previous.
  const box = () => new ActionTextBox(['x']);          // DaggerfallUI.MessageBox: previous = TopWindow
  const nulled = () => ({});                            // :512-530's instances: previous = null

  const empty = makeWindowStack({});
  assert.equal(empty.hudCovered(), false, 'nothing open, nothing covering');

  const one = makeWindowStack({});
  one.pushWindow(box());
  assert.equal(one.hudCovered(), false, 'a message box carries the HUD under it');

  const win = makeWindowStack({});
  win.pushWindow(nulled());
  assert.equal(win.hudCovered(), true, 'an inventory/pause/automap instance does not');

  // ...and a box laid OVER such a window cannot splice the chain back:
  // its previous is that window, whose own previous is null.
  const both = makeWindowStack({});
  both.pushWindow(nulled());
  both.pushWindow(box());
  assert.equal(both.hudCovered(), true, 'the cut is anywhere in the chain, not just at the top');
  // and the other order - a window pushed over a box - cuts at the top
  const other = makeWindowStack({});
  other.pushWindow(box());
  other.pushWindow(nulled());
  assert.equal(other.hudCovered(), true);

  // the host's slot mirror counts before `reconcile` has pushed it
  const slotOnly = makeWindowStack({});
  assert.equal(slotOnly.hudCovered(nulled()), true);
  assert.equal(slotOnly.hudCovered(box()), false);

  // DaggerfallAction's own two boxes are the exception that passes null
  // (Internal/DaggerfallAction.cs:536/:565).
  assert.equal(paintsPreviousWindow(new ActionTextBox(['x'], { previousWindow: null })), false);
  assert.equal(paintsPreviousWindow(new ActionInputBox(['x'], () => {})), false);
  assert.match(src('scenes/dungeonContext.js'),
    /new ActionTextBox\(lines, \{ previousWindow: null \}\)/);

  // ALL FOUR HOSTS ask their own stack rather than their pause flag.
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /windowCoversHud: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\)/, host);
  }
  assert.match(src('scenes/dungeonContext.js'),
    /windowCoversHud: !!activeOverlay && dungeonWindows\.hudCovered\(activeOverlay\)/);
  assert.match(src('scenes/worldModes.js'),
    /windowCoversHud: !!townTalk\?\.hudCovered \|\| modeHudCovered\(\)/);
});

test('AUDIT 64 F35/F37: on the enhanced skin the hide door is reached, and the escort column dies with the window', async () => {
  // The enhanced skin is a persistent DOM overlay, so "not drawn" has
  // to be TOLD to it rather than skipped past - and the two laws it
  // must be told are the reference's, not the skin's:
  //   - DaggerfallHUD.cs:47/:314-318/:347-351 - `public override void
  //     Draw() { if (renderHUD) base.Draw(); }`, the whole window.
  //   - DaggerfallHUD.cs:183-185 - escortingFaces is a ParentPanel
  //     component of that same window, so it goes with it, and with
  //     the window that covers it.
  const mkEl = () => ({
    className: '', textContent: '', id: '', rel: '', href: '', children: [], dataset: {},
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute() {}, removeAttribute() {}, remove() {},
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  globalThis.document = { createElement: mkEl, getElementById: () => null, head: mkEl(), body: mkEl() };
  _resetHudRender();
  const canvas = { width: 1920, height: 1080 };
  const bytes = new Uint8Array(64 * 64);
  initEscortFaces({
    fetchBytes: async () => bytes,
    palette: { get: (i) => ({ r: i, g: i, b: i }) },
    renderer: { uploadTexture: () => 'tex:face' },
  });
  restoreEscortFacesSaveData([{ factionFaceIndex: 0, questUID: 1, targetName: 'x' }]);
  await new Promise((res) => setTimeout(res, 0));
  try {
    assert.equal(isEnhanced(), true, 'the enhanced skin is the default this pin needs');
    const faces = (r) => r.quads.filter((q) => q.tex === 'tex:face').length;

    // nothing open, renderHUD on: the overlay is shown and the column draws
    const openHud = recorder();
    drawHud(openHud, canvas, hudArt(), vitals(), 0, 0, { font: font() });
    const overlay = document.body.children.find((n) => n.className === 'hud');
    assert.ok(overlay, 'the enhanced overlay was built');
    assert.equal(overlay.style.display, '', 'shown');
    assert.equal(faces(openHud), 1, 'the escort column draws');

    // Shift-F10: renderHUD off. The overlay must be TOLD to hide, and
    // the escort quad must not be drawn.
    toggleHudRender();
    assert.equal(hudRenderEnabled(), false);
    const off = recorder();
    drawHud(off, canvas, hudArt(), vitals(), 0, 0, { font: font() });
    assert.equal(overlay.style.display, 'none', 'DaggerfallHUD.cs:347-351 hides the whole window');
    assert.equal(faces(off), 0, 'and escortingFaces is one of its components (:183-185)');
    toggleHudRender();
    assert.equal(hudRenderEnabled(), true);

    // ...and a window that cuts the previousWindow chain takes the
    // column with it, while a message box leaves it painted.
    const covered = recorder();
    drawHud(covered, canvas, hudArt(), vitals(), 0, 0,
      { font: font(), cursorActive: true, windowCoversHud: true });
    assert.equal(faces(covered), 0, 'a null-previous window blanks the column');
    const box = recorder();
    drawHud(box, canvas, hudArt(), vitals(), 0, 0,
      { font: font(), cursorActive: true, windowCoversHud: false });
    assert.equal(faces(box), 1, 'a message box paints the HUD, column and all');
  } finally {
    clearEscortFaces();
    _resetHudRender();
    delete globalThis.document;
  }
});

test('AUDIT 64 F35: ShowPlayerDamage survives the covering window - it is not a HUD component', () => {
  // Game/ShowPlayerDamage.cs:20 is its own MonoBehaviour with its own
  // OnGUI, outside the UI stack, so it flashes whatever window is top.
  const canvas = { width: 1920, height: 1080 };
  playerDamageFlash.flash();
  const r = recorder();
  drawHud(r, canvas, hudArt(), vitals(), 0, 0.001, { font: font(), cursorActive: true });
  const flash = r.quads.find((q) => q.tex === null && q.w === canvas.width && q.color?.[0] === 1);
  assert.ok(flash, 'the damage flash quad is drawn under a window');
  playerDamageFlash.tick(10);
});

// ── F36 / F37  the two shortcut arms of DaggerfallHUD.Update ─────

test('AUDIT 64 F36: F10 flips Settings.LargeHUD live; Shift-F10 does not, and an autorepeat is dropped', () => {
  _resetForTests();
  _resetHudRender();
  const before = getBool('GUI', 'LargeHUD');
  // DaggerfallHUD.cs:309-311, over DialogShortcuts' `LargeHUDToggle, F10`.
  assert.equal(hudShortcutKey({ code: 'F10' }), true);
  assert.equal(getBool('GUI', 'LargeHUD'), !before);
  assert.equal(hudShortcutKey({ code: 'F10' }), true);
  assert.equal(getBool('GUI', 'LargeHUD'), before, 'it is a flip, not a set');

  // CheckSetModifiers (:158-162 in DFU's HotkeySequence) keeps
  // Shift-F10 off F10: the shifted press is HUDToggle's, not this one.
  assert.equal(hudShortcutKey({ code: 'F10', shiftKey: true }), true);
  assert.equal(getBool('GUI', 'LargeHUD'), before, 'Shift-F10 did not touch the setting');
  assert.equal(hudRenderEnabled(), false, '...it hid the HUD instead');
  toggleHudRender();

  // IsDownWith is GetKeyDown - ONE edge per press.
  assert.equal(hudShortcutKey({ code: 'F10', repeat: true }), false);
  assert.equal(getBool('GUI', 'LargeHUD'), before);
  // an unbound key is not ours
  assert.equal(hudShortcutKey({ code: 'F9' }), false);
  _resetForTests();
  _resetHudRender();
});

test('AUDIT 64 F36/F37: the arm is in every host that dispatches keys - routeKey and the two that run their own ladder', () => {
  // ui/input.js's routeKey covers scenes/dungeon.js and both of
  // scenes/worldModes.js's modal arms; scenes/world.js and
  // scenes/exterior.js never call it and carry the arm themselves.
  assert.match(src('ui/input.js'), /if \(hudShortcutKey\(e, keys\)\) return true;/);
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /if \(hudShortcutKey\(e, keys\)\) \{ e\.preventDefault\(\); return; \}/, `${host} takes the keys`);
  }
  // ...and routeKey takes them BELOW its overlay return, because
  // DaggerfallUI.cs:429-433 updates only the top window.
  const input = src('ui/input.js');
  assert.ok(input.indexOf('if (hudShortcutKey(e, keys)) return true;') > input.indexOf('if (ctx.uiOverlayActive) {'));
  // the write is the in-memory setting DFU assigns (:311) - not a save
  assert.match(src('ui/hudShortcuts.js'), /setValue\('GUI', 'LargeHUD', !getBool\('GUI', 'LargeHUD'\)\)/);
  assert.equal(/saveSettings/.test(src('ui/hudShortcuts.js')), false, 'DaggerfallHUD.cs:311 assigns, it does not persist');
});

test('AUDIT 64 F37: renderHUD suppresses the whole Draw, and Update keeps running', () => {
  _resetHudRender();
  const canvas = { width: 1920, height: 1080 };
  assert.equal(hudRenderEnabled(), true, 'DaggerfallHUD.cs:47 - the flag starts true');
  const on = recorder();
  drawHud(on, canvas, hudArt(), vitals(), 0, 0, { font: font() });
  assert.ok(on.quads.some((q) => String(q.tex) === 'tex:MAIN03I0'));

  toggleHudRender();
  assert.equal(hudRenderEnabled(), false);
  const off = recorder();
  drawHud(off, canvas, hudArt(), vitals(), 0, 0, { font: font() });
  // :349 `if (renderHUD) base.Draw();` - the whole window, so every
  // ParentPanel and NativePanel component goes.
  for (const gone of ['tex:MAIN03I0', 'tex:MAIN04I0', 'tex:MAIN05I0', 'tex:COMPBOX', 'tex:COMPASS']) {
    assert.equal(off.quads.map((q) => String(q.tex)).includes(gone), false, `${gone} is suppressed`);
  }
  // the large HUD goes with it - DaggerfallUI.cs:485-486's repaint runs
  // through the SAME overridden Draw.
  const offLarge = recorder();
  drawHud(offLarge, canvas, hudArt(), vitals(), 0, 0,
    { font: font(), largeHud: { art: { main: { tex: 'tex:MAIN00I0' } } } });
  assert.equal(offLarge.quads.map((q) => String(q.tex)).includes('tex:MAIN00I0'), false);

  // ...but ShowPlayerDamage is not a HUD component and still draws.
  playerDamageFlash.flash();
  const flash = recorder();
  drawHud(flash, canvas, hudArt(), vitals(), 0, 0.001, { font: font() });
  assert.ok(flash.quads.some((q) => q.tex === null && q.w === canvas.width && q.color?.[0] === 1),
    'the damage flash is outside the suppressed window');
  playerDamageFlash.tick(10);

  toggleHudRender();
  assert.equal(hudRenderEnabled(), true);
  _resetHudRender();
});

test('AUDIT 64 F37: the popup column is a HUD component too, so its DRAW is gated and its tick is not', () => {
  for (const host of ['scenes/townTalk.js', 'scenes/dungeonContext.js']) {
    const s = src(host);
    assert.match(s, /hudRenderEnabled\(\)\) hud(Text)?\.draw\(/, `${host} gates the popup draw`);
  }
  // the tick keeps draining - PopupText.Update is DaggerfallHUD.Update's
  // work, which renderHUD does not touch (:347-351 overrides Draw only).
  assert.match(src('scenes/dungeonContext.js'), /\n {4}hudText\.tick\(dt\);\n/);
  assert.match(src('scenes/townTalk.js'), /\n {6}hud\.tick\(dt\);\n/);
});

// ── F38  the escort column is anchored to the screen ─────────────

test('AUDIT 64 F38: the escort faces sit at 8*scale, 36*scale from the SCREEN origin, not the letterboxed panel', async () => {
  // DaggerfallHUD.cs:183-185 adds escortingFaces to the PARENT panel,
  // whose rect is the whole viewport at LocalScale (1,1), with both
  // alignments left at BaseScreenComponent.cs:46-47's default None -
  // so BaseScreenComponent.cs:1207-1209 / :1224-1226 put its origin at
  // screen (0,0). ScaleToFit scales, it does not centre.
  const canvas = { width: 1920, height: 1080 };   // 16:9: nativeMetrics would add ox 160, oy 40
  const r = recorder();
  // one 64x64 FACES.CIF record (the RCI grid), which the panel draws at
  // the special 48x48
  const bytes = new Uint8Array(64 * 64);
  initEscortFaces({
    fetchBytes: async () => bytes,
    palette: { get: (i) => ({ r: i, g: i, b: i }) },
    renderer: { uploadTexture: () => 'tex:face' },
  });
  restoreEscortFacesSaveData([{ factionFaceIndex: 0, questUID: 1, targetName: 'x' }]);
  await new Promise((res) => setTimeout(res, 0));
  drawEscortFaces(r, canvas);
  const s = hudScale(canvas.width, canvas.height);
  assert.equal(s, 5);
  const face = r.quads.find((q) => q.tex === 'tex:face');
  assert.ok(face, 'the face drew');
  assert.deepEqual([face.x, face.y, face.w, face.h], [
    ESCORT_START_X * s, ESCORT_START_Y * s,
    ESCORT_SPECIAL_FACE_SIZE * s, ESCORT_SPECIAL_FACE_SIZE * s,
  ], 'the letterbox offset (160, 40) belongs to the NativePanel, not to this one');
  assert.deepEqual([face.x, face.y], [40, 180]);
  clearEscortFaces();
});

// ── F39  VerticalProgress rounds the drawn height ────────────────

test('AUDIT 64 F39: the breath bar rounds its drawn height with Mathf.Round, half-to-even', () => {
  // VerticalProgress.cs:72-74: `float scaledAmount = Mathf.Round(
  // dstRect.height * amount); dstRect.y += dstRect.height -
  // scaledAmount; dstRect.height = scaledAmount;` - the breath bar is
  // a VerticalProgress (HUDBreathBar.cs:26/:54) like the three vitals
  // bars beside it.
  const canvas = { width: 320, height: 200 };     // s = 1
  const s = hudScale(canvas.width, canvas.height);
  assert.equal(s, 1);
  // LiveEndurance 41 -> MaxBreath trunc(41/2) = 20, so 10 breath is
  // 41 * 10/20 = 20.5 - the exact tie Mathf.Round sends DOWN to 20
  // where JS's Math.round (and the raw float) give 21 / 20.5.
  const r = recorder();
  drawHud(r, canvas, hudArt(), vitals({ stats: { strength: 50, endurance: 41 }, currentBreath: 10 }), 0, 0,
    { font: font() });
  const breath = r.quads.find((q) => String(q.tex).startsWith('tex:breath'));
  assert.ok(breath);
  assert.equal(breath.h, 20, 'Mathf.Round(20.5) = 20 (half-to-even), not 20.5 and not 21');
  // ...and the rect is still bottom-anchored off the UNrounded height:
  // dstRect.y += dstRect.height - scaledAmount.
  const bBottom = canvas.height + HUD_BORDER - BREATH_BAR_BOTTOM * s;
  assert.equal(breath.y, bBottom - 20);
  assert.equal(breath.x, HUD_BORDER + BREATH_BAR_LEFT * s);
  assert.equal(breath.w, BREATH_BAR_WIDTH * s);

  // the other side of the tie-break, so the fix is not just a floor:
  // at s = 2 the rect is 82 tall and 15/20 of it is 61.5, whose floor
  // is ODD, so Mathf.Round goes UP to 62.
  const wide = { width: 640, height: 400 };
  assert.equal(hudScale(wide.width, wide.height), 2);
  const r2 = recorder();
  drawHud(r2, wide, hudArt(), vitals({ stats: { strength: 50, endurance: 41 }, currentBreath: 15 }), 0, 0,
    { font: font() });
  assert.equal(r2.quads.find((q) => String(q.tex).startsWith('tex:breath')).h, 62);
});

// ── F42  every large-HUD panel clicks ────────────────────────────

test('AUDIT 64 F42: a panel hit plays SoundClips.ButtonClick before the action; a miss and a closed bar play nothing', () => {
  _resetForTests();
  setValue('GUI', 'LargeHUD', true);
  setValue('GUI', 'LargeHUDDocked', true);
  const played = [];
  const real = audio.playOneShot;
  audio.playOneShot = (i, v) => { played.push([i, v]); return 0.1; };
  try {
    // the bar has to be on screen for largeHudBar() to answer, so draw
    // one frame of it first
    const canvas = { width: 1280, height: 800 };
    drawHud(recorder(), canvas, hudArt(), vitals(), 0, 0,
      { font: font(), largeHud: { art: { main: { tex: 'tex:MAIN00I0' } }, docked: true, undockedScale: 1, alignment: 0, mode: 'info' } });
    setCursorActive(true);
    const s = hudScale(canvas.width, canvas.height);
    assert.equal(s, 4);
    const barX = (canvas.width - LARGE_HUD_W * s) / 2;
    const barY = canvas.height - LARGE_HUD_H * s;
    // the head panel's own rect - any point inside a panel will do
    const ctx = { toggleCharSheet: () => played.push('action') };
    const hit = routeLargeHudClick(barX + 20 * s, barY + 20 * s, 0, ctx);   // inside head [7,8,33,30]
    assert.equal(hit, true, 'the bar took the click');
    // HUDLarge.cs:445 - the click is the FIRST statement of the
    // handler, before the PostMessage the panel exists to send.
    assert.deepEqual(played, [[SOUND.ButtonClick, 1], 'action'],
      'one ButtonClick, played before the action');
    assert.equal(SOUND.ButtonClick, 360);

    // a point on the bar that is inside no panel makes no sound
    played.length = 0;
    routeLargeHudClick(barX + 1, barY + 1, 0, { toggleCharSheet: () => played.push('action') });
    assert.deepEqual(played, [], 'no panel, no handler, no sound');

    // ...and IsLargeHUDInteractable (:392-395) is the guard the sound
    // sits inside: with the cursor captured nothing answers at all.
    setCursorActive(false);
    routeLargeHudClick(barX + 20 * s, barY + 20 * s, 0, {});
    assert.deepEqual(played, [], 'a captured cursor is a swing, not a button press');
  } finally {
    audio.playOneShot = real;
    setCursorActive(false);
    _resetForTests();
  }
});
