// FIX-F (2026-09-08, Mac: "Changing keybinds in classic/enhanced do not
// work"). Two defects, neither in the rebinding law itself (which
// round-trips): the enhanced skin - the default - had NO door to it
// (ui/enhancedControls.js, pinned in its own file), and on the classic
// skin the controls window offered rows that nothing read: the swing was
// the raw right button in every host while the registry carried
// Mouse1 -> SwingWeapon; TurnLeft/TurnRight/LookUp/LookDown had no
// consumer; RecastSpell/AbortSpell had none; a bound F8 was eaten by the
// debug arm above the registry read; the interior host read a raw M for
// the automap. Slide and CenterView have no consumer in DFU either
// (only the enum names them) and stay as they are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindings, keyboardLook, isSwingButton, swingButton, swingHeld, mouseCode } from '../src/ui/input.js';
import { setBinding, clearBindingByCode, resetDefaults } from '../src/systems/inputActions.js';
import { keyboardLookRate, KEYBOARD_LOOK_UNITS_PER_SECOND } from '../src/ui/lookSettings.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('FIX-F: the keyboard look reads the four turn/look actions off the registry (InputManager.cs:1854-1865)', () => {
  const b = bindings(); resetDefaults(b, true);
  assert.deepEqual(keyboardLook(new Set()), { x: 0, y: 0 });
  assert.deepEqual(keyboardLook(new Set(['ArrowLeft'])), { x: -1, y: 0 }, 'TurnLeft');
  assert.deepEqual(keyboardLook(new Set(['ArrowRight'])), { x: 1, y: 0 }, 'TurnRight');
  assert.deepEqual(keyboardLook(new Set(['Insert'])), { x: 0, y: 1 }, 'LookUp');
  assert.deepEqual(keyboardLook(new Set(['Delete'])), { x: 0, y: -1 }, 'LookDown');
  assert.deepEqual(keyboardLook(new Set(['ArrowLeft', 'ArrowRight'])), { x: 0, y: 0 }, 'both cancel');
  // REBOUND: the read follows the registry, which is the whole point
  clearBindingByCode(b, 'ArrowLeft'); setBinding(b, 'KeyJ', 'TurnLeft');
  assert.deepEqual(keyboardLook(new Set(['KeyJ'])), { x: -1, y: 0 }, 'a rebound TurnLeft turns');
  assert.deepEqual(keyboardLook(new Set(['ArrowLeft'])), { x: 0, y: 0 }, 'and the old key does not');
  resetDefaults(b, true);
  // the rate: one look unit a frame at 60 fps, a unit a degree per sensitivity point
  assert.equal(KEYBOARD_LOOK_UNITS_PER_SECOND, 60);
  assert.ok(keyboardLookRate() > 0);
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    assert.match(read(h), /else lookFilter\.tick\(dt, cam\);\s*\n(?:\s*\/\/[^\n]*\n)*\s*const kb = keyboardLook\(keys\);\s*\n\s*if \(kb\.x \|\| kb\.y\) lookFilter\.add\(kb\.x \* keyboardLookRate\(\) \* dt, kb\.y \* keyboardLookRate\(\) \* dt \* lookInvert\(\)\);/, `${h}: the keyboard look feeds the same filter the mouse does, every frame, owed to the next tick`);
  }
});

test('FIX-F: the swing button is the registry’s - rebind SwingWeapon and the hosts follow', () => {
  const b = bindings(); resetDefaults(b, true);
  assert.equal(mouseCode(2), 'Mouse1', 'the right button is Unity’s Mouse1');
  assert.equal(swingButton(), 2);
  assert.equal(isSwingButton(2), true); assert.equal(isSwingButton(0), false);
  assert.equal(swingHeld(2), true, 'buttons bit 2 is the right button');
  assert.equal(swingHeld(1), false); assert.equal(swingHeld(3), true, 'held with the left too');
  clearBindingByCode(b, 'Mouse1'); setBinding(b, 'Mouse0', 'SwingWeapon');
  assert.equal(swingButton(), 0, 'rebound to the left button');
  assert.equal(isSwingButton(0), true); assert.equal(isSwingButton(2), false);
  assert.equal(swingHeld(1), true); assert.equal(swingHeld(2), false);
  clearBindingByCode(b, 'Mouse0'); setBinding(b, 'KeyX', 'SwingWeapon');
  assert.equal(swingButton(), -1, 'a swing on a KEY is no mouse button');
  assert.equal(swingHeld(2), false);
  resetDefaults(b, true);
  // every host reads it - no raw right-button swing survives
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = read(h);
    assert.ok(!/e\.button === 2 && !townTalk\.overlayActive|e\.button === 2 && !ctx\.uiOverlayActive|e\.button === 2 && !modalWindowUp/.test(s), `${h}: no raw right-button swing`);
    assert.ok(!/\(e\.buttons & 2\)/.test(s), `${h}: no raw right-button drag`);
  }
  assert.match(read('src/scenes/shared.js'), /if \(!walkMode \|\| !swingHeld\(buttons\)\) return 'look';/, 'routeMouseDrag reads the registry');
  // the window's own right-click (the remove gesture) is still the right button - a UI gesture, not an action
  assert.match(read('src/scenes/dungeon.js'), /overlayClick\?\.\(v\[0\], v\[1\], e\.button === 2, e\.button === 1\)/);
});

test('FIX-F: RecastSpell and AbortSpell reach the cast engine in all four hosts, F8 yields to a binding, the interior automap key is the registry’s', () => {
  const inp = read('src/ui/input.js');
  assert.match(inp, /case 'RecastSpell': return ctx\.recastSpell \? \(ctx\.recastSpell\(\), true\) : false;/);
  assert.match(inp, /case 'AbortSpell': return ctx\.abortSpell \? \(ctx\.abortSpell\(\), true\) : false;/);
  assert.match(inp, /if \(e\.code === 'F8' && !actionOf\(e, keys\)\) \{ ctx\.toggleDebugHud\?\.\(\); return true; \}/, 'a bound F8 is the binding’s');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /if \(act === 'RecastSpell'\) \{ e\.preventDefault\(\); magic\.recastSpell\(\); return; \}\s*\n\s*if \(act === 'AbortSpell'\) \{ e\.preventDefault\(\); magic\.abortReadySpell\(\); return; \}/, `${h}: the two arms in the host’s own ladder`);
  }
  assert.match(read('src/scenes/worldModes.js'), /recastSpell\(\) \{ magic\?\.recastSpell\(\); \},[^\n]*\n\s*abortSpell\(\) \{ magic\?\.abortReadySpell\(\); \},/, 'the interior ctx');
  assert.match(read('src/scenes/dungeonContext.js'), /recastSpell\(\) \{ magic\.recastSpell\(\); \},\s*\n\s*abortSpell\(\) \{ magic\.abortReadySpell\(\); \},/, 'the dungeon ctx');
  const hm = read('src/scenes/hostMagic.js');
  assert.match(hm, /lastSpell = sp; onCastReadySpell\?\.\(sp\); readiedSpell = null;/, 'lastSpell is set where CastReadySpell sets it (:2136), before the raise and the clear');
  assert.match(hm, /if \(!lastSpell \|\| castInProgress\) return false;\s*\n\s*if \(!hasSpellbook\(playerEntity\)\) \{ say\(NO_SPELLBOOK_TEXT\); return false; \}\s*\n\s*readySpell\(lastSpell\);/, 'RecastSpell: the last spell, no animation playing, the book in the pack (:257-266)');
  assert.match(hm, /abortReadySpell\(\) \{\s*\n\s*if \(!readiedSpell\) return false;\s*\n\s*readiedSpell = null; readiedFree = false; readiedCost = 0;/, 'AbortReadySpell (:361-365) only with a spell readied (:268)');
  assert.match(read('src/scenes/interior.js'), /if \(actionOf\(e, keys\) === 'AutoMap'\) \{ toggleAutomap\(\); e\.preventDefault\(\); return; \}/);
  assert.doesNotMatch(read('src/scenes/interior.js'), /e\.code === 'KeyM'/);
});
