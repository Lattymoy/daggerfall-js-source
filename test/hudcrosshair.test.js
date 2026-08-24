// U38: HUDCrosshair + HUDInteractionModeIcon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ICON_STYLE_SCALE, iconStyleScale, iconReplacesCrosshair, iconResScale,
  modeIconPosition, MODE_LABEL, crosshairEnabled, interactionIconStyle,
  drawCrosshairAndModeIcon,
} from '../src/ui/hudCrosshair.js';
import { HUD_BORDER, HUD_NATIVE_BAR_WIDTH } from '../src/ui/hud.js';
import { MODES, setInteractionMode } from '../src/player/interactionMode.js';
import { setValue, _resetForTests, DEFAULTS } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('U38: the icon-style table and its default arm (:143-181)', () => {
  // classicScale 3, colourScale 1, monoScale 0.8, iconScale 0.8,
  // minimalScale 0.5 - and BOTH xhair spellings share their set's scale
  assert.equal(ICON_STYLE_SCALE.classic, 3);
  assert.equal(ICON_STYLE_SCALE.classicxhair, 3);
  assert.equal(ICON_STYLE_SCALE.colour, 1);
  assert.equal(ICON_STYLE_SCALE.colourxhair, 1);
  assert.equal(ICON_STYLE_SCALE.monochrome, 0.8);
  assert.equal(ICON_STYLE_SCALE.icon, 0.8);
  assert.equal(ICON_STYLE_SCALE.minimal, 0.5);
  // the switch is case-insensitive (DFU lowercases the setting first)
  assert.equal(iconStyleScale('CLASSIC'), 3);
  assert.equal(iconStyleScale('Minimal'), 0.5);
  // an UNKNOWN word falls to the default set at iconScale, not to zero
  assert.equal(iconStyleScale('nonsense'), 0.8);
  assert.equal(iconStyleScale(undefined), 0.8);
  assert.equal(iconStyleScale(''), 0.8);
  // and the shipped default is a real key
  assert.equal(DEFAULTS.GUI.InteractionModeIcon, 'classic');
});

test('U38: the xhair SUFFIX decides where the indicator lives (:189)', () => {
  assert.equal(iconReplacesCrosshair('classicxhair'), true);
  assert.equal(iconReplacesCrosshair('colourxhair'), true);
  assert.equal(iconReplacesCrosshair('CLASSICXHAIR'), true, 'case-insensitive');
  assert.equal(iconReplacesCrosshair('classic'), false);
  assert.equal(iconReplacesCrosshair('minimal'), false);
  assert.equal(iconReplacesCrosshair(undefined), false);
  // it is a SUFFIX test, not a substring one
  assert.equal(iconReplacesCrosshair('xhairclassic'), false);
});

test('U38: resScale scales DOWN at low resolutions, as a divisor (:107)', () => {
  // `Scale.x > 3 ? 1 : 1 / Scale.x * 3`
  assert.equal(iconResScale(4), 1, 'above 3 there is no reduction');
  // EQUIVALENT MUTANT, recorded so nobody re-hunts it: `>` -> `>=` on
  // this boundary cannot be killed. At scale exactly 3 the reduction
  // arm computes (1/3)*3, which IEEE754 rounds back to exactly 1 - the
  // same answer the early arm returns. The two branches are
  // indistinguishable at the only input that separates them.
  assert.equal(iconResScale(3), 1);
  assert.equal(iconResScale(1), 3, 'at scale 1 the divisor is 3 - a third size');
  assert.equal(iconResScale(2), 1.5);
});

test('U38: the icon sits right of the three vitals bars, on their baseline (:129)', () => {
  // (nativeBarWidth * scale) * 5 + borderSize * 2, and
  // height - borderSize - iconHeight
  const [x, y] = modeIconPosition(600, 2, 12, HUD_BORDER, HUD_NATIVE_BAR_WIDTH);
  assert.equal(x, HUD_NATIVE_BAR_WIDTH * 2 * 5 + HUD_BORDER * 2);
  assert.equal(y, 600 - HUD_BORDER - 12);
  // the constants really are the HUD's own, not a second copy
  assert.equal(HUD_BORDER, 10);
  assert.equal(HUD_NATIVE_BAR_WIDTH, 4);
  // the x really does scale with the bars (they do), the border does not
  const [x2] = modeIconPosition(600, 4, 12, HUD_BORDER, HUD_NATIVE_BAR_WIDTH);
  assert.equal(x2 - x, HUD_NATIVE_BAR_WIDTH * 5 * 2, 'the bar half doubles with the scale');
});

test('U38: every interaction mode has a label', () => {
  for (const m of MODES) {
    assert.ok(MODE_LABEL[m], `${m} shows something`);
  }
  // DFU's fourth mode is Talk; the port's fourth is named 'dialogue'
  assert.equal(MODE_LABEL.dialogue, 'TALK');
  assert.equal(Object.keys(MODE_LABEL).length, MODES.length, 'no label without a mode');
});

test('U38: the crosshair is HIDDEN while the cursor is active (:62-66)', () => {
  _resetForTests();
  setInteractionMode('grab');
  const quads = [];
  const renderer = { drawScreenQuad: (tex, r, uv, c) => quads.push({ r, c }) };
  const canvas = { width: 640, height: 400 };
  // cursorActive: a window is up and the player is pointing
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: true, scale: 2 });
  assert.equal(quads.length, 0, 'nothing at all is drawn');
  // aiming: the cross appears (two quads - the two arms)
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale: 2 });
  assert.equal(quads.length, 2, 'the two arms of the cross');
  // and GUI/Crosshair off suppresses it while the cursor is still free
  quads.length = 0;
  setValue('GUI', 'Crosshair', 'False');
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale: 2 });
  assert.equal(quads.length, 0, 'the setting is live');
  _resetForTests();
});

test('U38: in an xhair style the indicator REPLACES the cross - except in Grab (:76-91)', () => {
  _resetForTests();
  setValue('GUI', 'InteractionModeIcon', 'classicxhair');
  const quads = [];
  const renderer = { drawScreenQuad: (tex, r) => quads.push(r) };
  const canvas = { width: 640, height: 400 };
  // Grab keeps the plain crosshair - it is the mode you aim in
  setInteractionMode('grab');
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale: 2 });
  assert.equal(quads.length, 2, 'Grab draws the cross');
  // any other mode replaces it, and with no font there is nothing to
  // draw - crucially NOT the cross
  quads.length = 0;
  setInteractionMode('steal');
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale: 2 });
  assert.equal(quads.length, 0, 'Steal replaces the cross rather than adding to it');
  // ...and in a NON-xhair style the same mode keeps the cross
  quads.length = 0;
  setValue('GUI', 'InteractionModeIcon', 'classic');
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale: 2 });
  assert.equal(quads.length, 2, 'the corner style leaves the crosshair alone');
  setInteractionMode('grab');
  _resetForTests();
});

test('U38: drawHud is the ONE call - all four hosts get both components', () => {
  const code = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
  // hud.js calls it, and passes ITS OWN constants rather than letting
  // hudCrosshair import back (which would be a cycle)
  assert.match(code('ui/hud.js'), /drawCrosshairAndModeIcon\(renderer, canvas, font,/);
  assert.match(code('ui/hud.js'), /border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH/);
  assert.doesNotMatch(code('ui/hudCrosshair.js'), /from '\.\/hud\.js'/,
    'the dependency runs ONE way - hud.js -> hudCrosshair.js');
  // and the hosts hand it a font and their cursor state
  for (const rel of ['scenes/dungeonContext.js', 'scenes/exterior.js', 'scenes/world.js']) {
    assert.match(code(rel), /cursorActive:/, `${rel} reports whether the cursor is free`);
  }
  // worldModes MOUNTS the other two contexts rather than drawing its
  // own HUD - the four-hosts rule satisfied by composition, which is
  // why it is checked for the MOUNT and not for a call it should not have
  assert.match(code('scenes/worldModes.js'), /buildDungeonContext/);
});
