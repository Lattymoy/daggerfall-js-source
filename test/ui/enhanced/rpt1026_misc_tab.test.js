// RPT1026-MISC TAB-REPEAT (a private report: the quick menu vanished when its key was held a little over half a second).
// The dial is raised on Tab's press; the key is still down when the system's auto-repeat starts (about half
// a second on, Windows' and most desktops' default delay), and every repeat reached the overlay stack's own Tab listener
// (ui/enhanced/enhancedOverlays.js onTab), which put the top overlay - the dial itself - away. The dial's own listener
// already let a repeat go (`if (!e.repeat) close()`), but its stopPropagation leaves the stack's listener on the same
// window to run. Driven through the real dial door, the real registry and the shipped key table.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keydown, byClass } from '../../chargenDom.mjs';
import { createBindings, resetDefaults } from '../../../src/systems/inputActions.js';
import { setBindings } from '../../../src/ui/input.js';
import { openPixelDial } from '../../../src/ui/pixelDial.js';
import { overlayOpen, clearOverlays } from '../../../src/ui/enhanced/enhancedOverlays.js';

console.warn = () => {};
globalThis.window ??= globalThis;   // the overlay stack's Tab listener is the window's (enhancedOverlays.js listen) - the fake DOM's window is its global

test('RPT1026-MISC TAB-REPEAT: the held Tab that raised the dial does not put it away on its auto-repeat; its next press does (mutant: rpt1026-misc-tab-repeat-closes)', () => {
  const store = createBindings();
  resetDefaults(store);
  setBindings(store);
  try {
    const opened = [];
    assert.equal(openPixelDial([{ dir: 'n', label: 'Items', open: () => opened.push('items') }]), true, 'the dial rises (the enhanced skin is the default)');
    const dials = () => byClass(globalThis.document.body, 'px-dial').length;
    assert.equal(dials(), 1);
    assert.equal(overlayOpen(), true, 'the dial is on the overlay stack');
    for (let i = 0; i < 5; i++) {
      const rep = keydown('Tab', undefined, { repeat: true });
      assert.equal(rep.defaultPrevented, true, 'a repeat is still swallowed - the browser never walks the focus');
    }
    assert.equal(dials(), 1, 'five auto-repeats: the dial stands');
    assert.equal(overlayOpen(), true);
    keydown('Tab');
    assert.equal(dials(), 0, 'the next press puts it away');
    assert.equal(overlayOpen(), false);
    assert.deepEqual(opened, [], 'and opened nothing');
  } finally { clearOverlays(); setBindings(null); }
});
