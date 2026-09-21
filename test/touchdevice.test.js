// TI3 (2026-09-17, Mac: "Some desktop users are reportably recieving the
// mobile UI instead of desktop"). THE TOUCH-DEVICE LAW: a finger as the
// PRIMARY pointer - `(pointer: coarse)` and `(hover: none)` - with the
// old sniff (ontouchstart / maxTouchPoints) as the fallback where the
// media queries are absent or unknown, and `?touch=on|off` the door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTouchDevice, touchDoor, TOUCH_DOOR } from '../src/ui/touchDevice.js';
import { isTouchDevice as fromTouch } from '../src/ui/touch.js';

/** A window-like: `touch` sets the sniff, `media` the queries it answers (absent = no matchMedia). */
const win = ({ touch = true, media = null, search = '' } = {}) => ({
  ...(touch ? { ontouchstart: null } : {}),
  navigator: { maxTouchPoints: touch ? 5 : 0 },
  location: { search },
  ...(media ? { matchMedia: (q) => ({ matches: !!media[q] }) } : {}),
});
const PHONE = { '(pointer: coarse)': true, '(hover: none)': true };
const TOUCH_LAPTOP = { '(pointer: fine)': true, '(hover: hover)': true };   // a mouse is the primary pointer; the screen also takes a finger
const IPAD_TRACKPAD = { '(pointer: fine)': true, '(hover: hover)': true };
const UNKNOWN = {};   // a browser that answers neither pointer query

test('TI3: a phone is a touch device, a touchscreen laptop is not - the primary pointer decides (mutant: the sniff alone)', () => {
  assert.equal(isTouchDevice(win({ media: PHONE })), true);
  assert.equal(isTouchDevice(win({ media: TOUCH_LAPTOP })), false, 'maxTouchPoints 5 and ontouchstart present, but the mouse is primary');
  assert.equal(isTouchDevice(win({ media: IPAD_TRACKPAD })), false, 'an iPad with a trackpad is desktop here (the door puts the layer back)');
  assert.equal(isTouchDevice(win({ touch: false, media: PHONE })), false, 'no touch at all: never, whatever the queries say');
  assert.equal(isTouchDevice(win({ media: { '(pointer: coarse)': true, '(hover: hover)': true } })), false, 'coarse but hovering (a stylus tablet with a mouse): not a finger');
});

test('TI3: the fallbacks - no matchMedia or an unknown query keeps the sniff; a throwing matchMedia too; no window is never', () => {
  assert.equal(isTouchDevice(win({ media: null })), true, 'AUDIT 62\'s stub: ontouchstart and no matchMedia');
  assert.equal(isTouchDevice(win({ touch: false, media: null })), false);
  assert.equal(isTouchDevice(win({ media: UNKNOWN })), true, 'neither coarse nor fine answers: the query is unknown, the sniff stands');
  assert.equal(isTouchDevice({ ontouchstart: null, matchMedia: () => { throw new Error('no'); } }), true);
  assert.equal(isTouchDevice(null), false);
  assert.equal(isTouchDevice(undefined), false);
});

test('TI3: ?touch=on / ?touch=off outranks the heuristic; anything else is no answer', () => {
  assert.equal(touchDoor('?touch=on'), true); assert.equal(touchDoor('?a=1&touch=off'), false);
  assert.equal(touchDoor('?touch=maybe'), null); assert.equal(touchDoor(''), null); assert.equal(touchDoor(undefined), null);
  assert.equal(touchDoor('?touchy=on'), null, 'the key is exact');
  assert.ok(TOUCH_DOOR instanceof RegExp);
  assert.equal(isTouchDevice(win({ media: TOUCH_LAPTOP, search: '?touch=on' })), true, 'the laptop player who wants the layer');
  assert.equal(isTouchDevice(win({ media: PHONE, search: '?touch=off' })), false, 'the phone player who does not');
  assert.equal(isTouchDevice(win({ touch: false, search: '?touch=on' })), true, 'the door needs no touch points at all');
});

test('TI3: one home - touch.js hands out the same function, and the data diet reads it (mutant: a second sniff in dataSource.js)', () => {
  assert.equal(fromTouch, isTouchDevice);
  const ds = readFileSync(new URL('../src/scenes/dataSource.js', import.meta.url), 'utf8');
  assert.match(ds, /import \{ isTouchDevice \} from '\.\.\/ui\/touchDevice\.js'/);
  assert.match(ds, /const LEAN = typeof window !== 'undefined' && !window\.daggerShell && isTouchDevice\(\);/, 'the shell still outranks the law');
  assert.ok(!/maxTouchPoints/.test(ds), 'no sniff of its own');
  const td = readFileSync(new URL('../src/ui/touchDevice.js', import.meta.url), 'utf8');
  assert.ok(!/import /.test(td), 'a leaf');
});
