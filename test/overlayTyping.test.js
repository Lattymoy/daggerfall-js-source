// CG2 (2026-09-08, Mac: "some bugs with character creation and being
// unable to type in your name or make selections").
//
// THE ROOT: the enhanced wizard's name boxes are real <input>s over the
// canvas. Its capture keydown steps aside for a field (the field must
// take the character) and lets the key bubble - straight into the
// host's ladder, whose first rung under any overlay was an
// unconditional preventDefault (townTalk.keydown in the two exterior
// hosts; routeKey + the dungeon host's preventDefault-on-true). No
// character was ever inserted; the name stayed empty; Continue stayed
// disabled. One definition now - isTextEntryTarget - and every ladder
// leaves a field's key to the field, consumed for the host (typing
// never walks the player) and untouched for the browser.
//
// And the wedge behind it: an enhanced wrapper whose view failed to
// import held the overlay slot for ever with no-op input/click and
// `done` false - every key and pointer eaten, nothing on screen. The
// classic wizard takes over on the same flow now.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTextEntryTarget, routeKey } from '../src/ui/input.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('CG2: a DOM text field owns its key - the dungeon route neither routes nor swallows it, and the exterior hosts\' first rung steps aside before its preventDefault', () => {
  assert.equal(isTextEntryTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTextEntryTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTextEntryTarget({ tagName: 'DIV' }), false);
  assert.equal(isTextEntryTarget({ tagName: 'CANVAS' }), false);
  assert.equal(isTextEntryTarget(null), false);
  assert.equal(isTextEntryTarget(undefined), false);
  // routeKey: under an overlay, a key aimed at a field is NOT handled (so the dungeon host does not preventDefault) and
  // the overlay's input is NOT called with it; a key aimed at the canvas still reaches the native overlay as before
  const calls = [];
  const ctx = { uiOverlayActive: true, overlayIsNative: true, overlayInput: (code, e) => calls.push([code, e?.key]) };
  assert.equal(routeKey({ code: 'KeyS', key: 'S', target: { tagName: 'INPUT' } }, ctx, null, new Set()), false, 'the field\'s key: not handled');
  assert.deepEqual(calls, [], 'and not routed to the window');
  assert.equal(routeKey({ code: 'KeyS', key: 'S', target: { tagName: 'CANVAS' } }, ctx, null, new Set()), true, 'the canvas\'s key: the window\'s, as before');
  assert.deepEqual(calls, [['KeyS', 'S']]);
  const sink = { uiOverlayActive: true, overlayIsNative: false, overlayInput: (a) => calls.push([a]) };
  assert.equal(routeKey({ code: 'Enter', key: 'Enter', target: { tagName: 'TEXTAREA' } }, sink, null, new Set()), false, 'a keyed (non-native) overlay too');
  assert.equal(calls.length, 1);
  // the exterior hosts' rung: townTalk.keydown returns true (consumed for the ladder) BEFORE its preventDefault
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /function keydown\(e\) \{\s*\n\s*if \(overlay\) \{\s*\n(\s*\/\/[^\n]*\n)*\s*if \(isTextEntryTarget\(e\.target\)\) return true;\s*\n\s*e\.preventDefault\(\);/, 'the field\'s key steps out before the preventDefault, consumed for the host');
  assert.match(tt, /import \{ overlayAction, actionOf, isTextEntryTarget \} from '\.\.\/ui\/input\.js';/);
  // the dungeon host preventDefaults on true, which is why routeKey answers false for a field
  assert.match(read('src/scenes/dungeon.js'), /if \(routeKey\(e, ctx, \(p\) => player\.spawn\(p\[0\], p\[1\], p\[2\]\), keys\)\) e\.preventDefault\(\);/);
  assert.match(read('src/ui/input.js'), /if \(ctx\.uiOverlayActive\) \{\s*\n\s*if \(isTextEntryTarget\(e\.target\)\) return false;/);
  // the wizard's own capture listener uses the one definition and lets the field's key bubble
  const wiz = read('src/ui/enhancedChargen.js');
  assert.match(wiz, /if \(isTextEntryTarget\(e\.target\)\) return;/, 'steps aside for a field');
  assert.doesNotMatch(wiz, /t\.tagName === 'INPUT'/, 'no second copy of the rule');
  // the hosts' ladders still put townTalk first, so the fix sits where the swallow was
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(h), /if \(townTalk\.keydown\(e\)\) return;/, `${h}: the rung`);
});

test('CG2: an enhanced wizard that will not mount hands the classic wizard the same flow instead of holding the slot for ever', () => {
  const cs = read('src/systems/chargenSession.js');
  assert.match(cs, /^function classicChargenWindow\(flow, \{ onDone, onCancel, hudScale = 2 \} = \{\}\) \{/m, 'the classic window is its own function');
  assert.match(cs, /return classicChargenWindow\(flow, \{ onDone, onCancel, hudScale \}\);/, 'the classic skin takes it');
  assert.match(cs, /let fallback = null;/);
  assert.match(cs, /\.catch\(\(e\) => \{[\s\S]{0,700}?fallback = classicChargenWindow\(flow, \{\s*\n\s*hudScale,\s*\n\s*onDone: \(r\) => \{ fired = true; onDone\?\.\(r\); \},\s*\n\s*onCancel: \(\) => \{ fired = true; onCancel\?\.\(\); \},\s*\n\s*\}\);/, 'built on the import\'s failure, firing the same callbacks once');
  for (const seam of ['input(code, ev) { fallback?.input(code, ev); }', 'click(vx, vy) { fallback?.click(vx, vy); }', 'hover(vx, vy, e = null) { fallback?.hover(vx, vy, e); }', 'release() { fallback?.release(); }', 'wheel(dir) { fallback?.wheel(dir); }', 'tick(dt) { fallback?.tick(dt); }', 'draw(renderer, canvas, font, scale) { fallback?.draw(renderer, canvas, font, scale); }']) {
    assert.ok(cs.includes(seam), `the wrapper delegates: ${seam}`);
  }
  assert.doesNotMatch(cs, /input\(\) \{ \/\* the view's own keydown owns the keyboard \*\/ \}/, 'no silent no-op left');
});
