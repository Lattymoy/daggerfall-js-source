// SWING-LABEL (2026-09-22, Mac: "Can you also please look into why some
// players arent able to attack and ensure this isnt an issue with
// keybindings"). The controls screens named the three mouse buttons by
// Unity's KeyCode - Mouse0 left, Mouse1 RIGHT, Mouse2 middle - so Swing
// Weapon read "MOUSE1" and Auto Run "MOUSE2". Nearly every PC game names
// MOUSE1 the LEFT button and MOUSE2 the right, so the screen told players
// "attack is left click", and the left button is Activate. The codes are
// unchanged; the words say which button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buttonText, swingHint, MAX_BUTTON_TEXT } from '../src/systems/controlsConfig.js';
import { mouseCode } from '../src/ui/input.js';
import { DEFAULT_BINDINGS } from '../src/systems/inputActions.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// MouseEvent.button, the browser's own numbering of the PHYSICAL button
const DOM_SIDE = ['LEFT', 'MIDDLE', 'RIGHT'];

test('SWING-LABEL: every mouse button is named for the physical button it is, never by number', () => {
  for (let b = 0; b < 3; b++) {
    const code = mouseCode(b);   // the one table that maps the DOM to the stored code
    const full = buttonText(code, true);
    const short = buttonText(code);
    assert.equal(full, `${DOM_SIDE[b]} CLICK`, `DOM button ${b} is stored as ${code} and must read as the ${DOM_SIDE[b].toLowerCase()} button`);
    assert.equal(short, `${DOM_SIDE[b][0]} CLICK`);
    assert.ok(short.length <= MAX_BUTTON_TEXT, 'the classic window’s ten-character cap still holds');
    assert.doesNotMatch(full + short, /MOUSE\d/, 'no Unity number reaches a player');
  }
});

test('SWING-LABEL: the default attack reads RIGHT CLICK, activate LEFT CLICK, auto-run MIDDLE CLICK', () => {
  const codeOf = (action) => DEFAULT_BINDINGS.find(([, a]) => a === action)[0];
  assert.equal(buttonText(codeOf('SwingWeapon'), true), 'RIGHT CLICK');
  assert.equal(buttonText(codeOf('ActivateCenterObject'), true), 'LEFT CLICK');
  assert.equal(buttonText(codeOf('AutoRun'), true), 'MIDDLE CLICK');
});

test('SWING-LABEL: the Swing Weapon line says what the gesture code actually does', () => {
  // Gesture (0), the default: a held press with NO travel is no swing -
  // which is what the line tells the player - and travel past the
  // threshold is one.
  const still = new PlayerWeapon({ weapon: null, liveSpeed: 50 });
  assert.equal(still.gesture(0, 0, true, 1 / 60, 1000, { swingMode: 0, attackThreshold: 0.005 }), null, 'a press without moving does nothing');
  const moved = new PlayerWeapon({ weapon: null, liveSpeed: 50 });
  assert.notEqual(moved.gesture(0, 40, true, 1 / 60, 1000, { swingMode: 0, attackThreshold: 0.005 }), null, 'a press with a drag swings');
  assert.match(swingHint('Mouse1', 0, 'KeyZ'), /^Hold the right mouse button and move the mouse to swing.*A press without moving does nothing\. Draw your weapon first with Z \(Ready Weapon\)\.$/);
  // Click (1): the press alone swings, and the line says so
  const click = new PlayerWeapon({ weapon: null, liveSpeed: 50 });
  assert.notEqual(click.gesture(0, 0, true, 1 / 60, 1000, { swingMode: 1, rolls: () => 0 }), null, 'Click mode swings on the press');
  assert.equal(swingHint('Mouse1', 1, 'KeyZ'), 'Press the right mouse button to swing. Draw your weapon first with Z (Ready Weapon).');
  assert.equal(swingHint('Mouse1', 2, null), 'Press or hold the right mouse button to swing.');
  // the player's own bindings, not the defaults
  assert.match(swingHint('KeyK', 0, 'KeyR'), /^Hold K and move the mouse.*with R \(Ready Weapon\)\.$/);
  assert.equal(swingHint(null, 0, 'KeyZ'), 'Unbound - nothing can swing your weapon.');
});

test('SWING-LABEL: the enhanced pane shows the line under Swing Weapon, from the live swing style and Ready Weapon key', () => {
  const src = read('src/ui/enhancedControls.js');
  assert.match(src, /if \(action === 'SwingWeapon' && unsaved\.usingPrimary\) main\.append\(el\('div', 'row-sub', swingHint\(code \?\? null, swingMode\(\), dict\.get\('ReadyWeapon'\) \?\? null\)\)\);/);
  assert.match(read('src/ui/input.js'), /export function swingMode\(\) \{ return getInt\('Controls', 'WeaponSwingMode', 0, 2\); \}/, 'the one reader of the style');
});
