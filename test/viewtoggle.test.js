// VIEW-TOGGLE (2026-09-28, Mac: "Also add a force first person/third person toggle") - ONE PRESS, THE OTHER VIEW.
//
// Pinned here: the seam (player/mwView.js mwViewTogglePerspective - the EOTB lane flips the mod's own ToggleOffset both
// ways; nothing to show refuses; the travel view's hold refuses it), the Morrowind lane's doors by source, the action
// (a port action on the mouse's forward side button, drawn in the Movement group), and the world host's poll.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, PORT_ACTIONS, DEFAULT_BINDINGS, ACTION_GROUPS } from '../src/systems/inputActions.js';
import { mouseCode } from '../src/ui/input.js';
import { isBindableKeyCode } from '../src/systems/keyCodes.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('VIEW-TOGGLE seam: the sprite lane flips first to third and back, one press each; no body to show refuses; the travel view\'s hold refuses it and keeps the body', async () => {
  const mv = await import('../src/player/mwView.js');
  const { eotbCamera } = await import('../src/player/eotbCamera.js');
  assert.equal(mv.eotbLane(), false);
  assert.equal(mv.mwViewTogglePerspective(), false, 'no sprite, no Morrowind body: nothing to show, nothing moves');
  mv.setEotbBodyReady(() => true);
  try {
    if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
    assert.equal(mv.mwViewTogglePerspective(), true);
    assert.equal(eotbCamera.thirdPerson(), true, 'out of the head');
    assert.equal(mv.mwViewTogglePerspective(), true);
    assert.equal(eotbCamera.thirdPerson(), false, 'and back in');
    mv.mwViewHoldThird(true);
    assert.equal(mv.mwViewTogglePerspective(), false, 'the travel view holds the body - the key does not take it');
    assert.equal(eotbCamera.thirdPerson(), true, 'still held out');
    mv.mwViewHoldThird(false);
    assert.equal(eotbCamera.thirdPerson(), false, 'handed back as found');
  } finally { mv.setEotbBodyReady(() => false); if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false); }
  const src = rd('src/player/mwView.js');
  assert.match(src, /export function mwViewTogglePerspective\(\) \{\n\s*if \(heldThird\) return false;\n\s*if \(eotbLane\(\)\) \{ eotbCamera\.toggleOffset\(!eotbCamera\.thirdPerson\(\)\); return true; \}\n\s*if \(mwCamera\.thirdPerson\(\)\) return mwIntoHead\(\);\n\s*if \(!fpArm\.canThirdPerson\(\) \|\| mounted\) return false;\n\s*mwCamera\.restore\(\{ firstPerson: false, baseDistance: mwCamera\.baseDistance\(\) \}\);\n\s*fpArm\.setViewMode\('third'\);/,
    'the Morrowind lane: in by the head\'s own door, out by the restore door, never in the saddle (RIDE-POV)');
});

test('VIEW-TOGGLE action: a port action, appended, on the mouse\'s forward side button (a binding code since VOICE1, kept when voice was reverted - and never the browser\'s Forward), drawn in Movement; the world host polls its press edge under no window and hands it to the seam before the view frame', () => {
  assert.deepEqual(ACTIONS.slice(-7), ['TogglePerspective', 'ActChoice', 'BoatSailUp', 'BoatSailDown', 'Professions', 'LegacyFamily', 'ModeWheel'], 'appended - MERGE 2: the professions branch\'s act choice after it, main\'s shipped first; HELM-KEYS\' two after them; CLASSIC-PAGES\' key; LEGACY1\'s family tree; MODE-WHEEL\'s wheel last');
  assert.ok(PORT_ACTIONS.includes('TogglePerspective'));
  assert.deepEqual(DEFAULT_BINDINGS.filter(([, a]) => a === 'TogglePerspective'), [['Mouse4', 'TogglePerspective']]);
  assert.equal(DEFAULT_BINDINGS.filter(([k]) => k === 'Mouse4').length, 1, 'nothing else on it');
  assert.equal(mouseCode(4), 'Mouse4', 'the forward side button is a binding code');
  assert.ok(isBindableKeyCode('Mouse4'), 'and a key the controls pane can name');
  assert.ok(ACTION_GROUPS.find((g) => g.title === 'Movement').rows.some((r) => r.action === 'TogglePerspective' && r.label === 'First / third person'));
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(hccActionPressed\('TogglePerspective'\)\) mwViewTogglePerspective\(\);\n(?:\s*\/\/[^\n]*\n)*\s*const csaHelm = [^\n]*\n\s*const camFilter = [^\n]*\n\s*const mwv0 = mwViewFrame\(\{/);   // FIELD BUGS 2026-09-29 (the sea) #3: the helm's reach and filter between, nothing else
  assert.match(w, /for \(const kind of \['mousedown', 'mouseup'\]\) addEventListener\(kind, \(e\) => \{ if \(e\.button === 3 \|\| e\.button === 4\) e\.preventDefault\(\); \}\);/, 'the side buttons are never the browser\'s Back and Forward in the world');
  assert.match(w, /const hccActionPressed = \(action\) => !gamePaused\(\) && !pointerSurfaces\.size && !_loading && pressed\(latch\.edge, keys, action\);/, 'the gate it rides');
});
