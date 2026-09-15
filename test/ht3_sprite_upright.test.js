// HT3 (2026-09-15, Mac: "The player held torch mod shows the sprite
// upside down when held").
//
// It did, and the reason is that the port has TWO right answers and the
// door took the wrong one.
//
// `toColor32` is a FLIP. It is right for a Unity texture, because Unity
// stores its rows bottom-up: flipped, row 0 becomes the picture's top.
// It is wrong for a decoded PNG, whose row 0 already IS the top.
//
// Which one a sprite wants depends on WHERE IT IS DRAWN:
//   - a WORLD BILLBOARD samples v with 0 at the bottom, so it wants the
//     port's bottom-up color32 order;
//   - a SCREEN QUAD does not. `drawScreenQuad` places its rect in
//     top-left pixels and gives p.y = 0 - the rect's TOP - the source
//     rect's `v0`, and nothing flips at upload (UNPACK_FLIP_Y_WEBGL is
//     false at every call site), so row 0 of `colors` lands at the top
//     of the sprite.
//
// The held torch is a screen quad fed from a vendored PNG, so the flip
// put the flame under the hand. The weapon widget's loose-PNG arm had
// the identical fault and had never been seen, because in play the
// widget takes its BUNDLE arm - a Unity texture, where the flip is
// right. `toScreenOrder` is the same shape without the flip, and the
// two screen doors take it.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toColor32, toColor32Order, toScreenOrder } from '../src/formats/color32Order.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// one 1x2 picture, TOP row first as every PNG decodes it: top red, bottom blue
const TOP_FIRST = { width: 1, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]) };

test('HT3 the two orders, executed: one keeps the rows, the other turns them over, and both answer the same SHAPE', () => {
  const screen = toScreenOrder(TOP_FIRST);
  const world = toColor32(TOP_FIRST);
  // the same shape - TEX1's law, untouched
  assert.deepEqual(Object.keys(screen).sort(), ['colors', 'height', 'width']);
  assert.deepEqual(Object.keys(world).sort(), ['colors', 'height', 'width']);
  assert.equal(screen.colors.constructor, Uint8ClampedArray);
  assert.deepEqual([screen.width, screen.height], [1, 2]);
  // ...and opposite rows
  assert.deepEqual([...screen.colors], [255, 0, 0, 255, 0, 0, 255, 255], 'row 0 is the picture\'s TOP - what a screen quad wants');
  assert.deepEqual([...world.colors], [0, 0, 255, 255, 255, 0, 0, 255], 'row 0 is the picture\'s BOTTOM - what a billboard wants');
  // a taller picture, so the pin is not passing on a two-row accident
  const H = 5, tall = { width: 1, height: H, data: new Uint8Array(H * 4) };
  for (let y = 0; y < H; y++) tall.data[y * 4] = y + 1;                 // row y marked by its own index
  assert.deepEqual([...toScreenOrder(tall).colors].filter((_, i) => i % 4 === 0), [1, 2, 3, 4, 5]);
  assert.deepEqual([...toColor32(tall).colors].filter((_, i) => i % 4 === 0), [5, 4, 3, 2, 1]);
  // toScreenOrder refuses a raster whose bytes do not match its size,
  // exactly as the flip does - a wrong size is a wrong picture either way
  assert.throws(() => toScreenOrder({ width: 4, height: 4, data: new Uint8Array(3) }), /4x4 carries 3 bytes/);
  // the flip-only function is unchanged and still answers a PNG's shape
  assert.deepEqual(Object.keys(toColor32Order(TOP_FIRST)).sort(), ['data', 'height', 'width']);
});

test('HT3 the SCREEN doors keep their rows; the WORLD doors still flip', () => {
  // the two that draw on a screen quad
  assert.match(read('src/systems/handheldTorches.js'), /return toScreenOrder\(await decodePng\(bytes\)\);/, 'the held torch');
  assert.match(read('src/combat/weaponWidgetAssets.js'), /return toScreenOrder\(await decodePng\(bytes\)\);/, 'the widget\'s loose PNG');
  // the widget's BUNDLE arm flips, because a Unity texture is bottom-up
  assert.match(read('src/combat/weaponWidgetAssets.js'), /try \{ return toColor32\(tex\.rgba\(\)\); \}/);
  // the ones that draw in the world are untouched
  assert.match(read('src/scenes/droppedTorches.js'), /return toColor32\(await decodePng\(new Uint8Array\(await res\.arrayBuffer\(\)\)\)\);/, 'the dropped torches are billboards');
  assert.match(read('src/systems/seasonsIliacBayAssets.js'), /const image = toColor32\(await decode\(bytes\)\);/, 'seasons: terrain');
  assert.match(read('src/systems/textureReplacement.js'), /toColor32\(await decode\(bytes\)\)/, 'M-TEX: world textures');
  // and TEX1's law still holds: the flip-only conversion has no importers
  assert.ok(!/import[^;]*\btoColor32Order\b[^;]*from/.test(read('src/systems/handheldTorches.js')));
  assert.ok(!/import[^;]*\btoColor32Order\b[^;]*from/.test(read('src/combat/weaponWidgetAssets.js')));
});

test('HT3 the convention is written down where the two answers live', () => {
  const conv = read('src/formats/color32Order.js');
  assert.match(conv, /export function toScreenOrder\(image\) \{/);
  assert.match(conv, /Unity stores its rows bottom-up/);
  assert.match(conv, /a SCREEN QUAD does not/);
  // the screen-quad convention this rests on, at its own source
  const r = read('src/render/renderer.js');
  assert.match(r, /vUV = mix\(uSrc\.xy, uSrc\.zw, vec2\(p\.x, p\.y\)\);/, 'v0 is the rect\'s top');
  assert.match(r, /uniform vec4 uDst;\s*\/\/ x, y, w, h in pixels \(top-left origin\)/);
  assert.ok(!/UNPACK_FLIP_Y_WEBGL, true/.test(r), 'and nothing flips at upload');
});
