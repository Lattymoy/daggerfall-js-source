// PIXEL-KEYS (2026-10-12, a profile of a player's live client walking the overworld's coast: the sea's soundings made
// their pixel's key text anew, hundreds of times a frame; bible/07-Rendering/Performance-Priority.md PIXEL-KEYS) - A
// PIXEL'S KEY, MADE ONCE: the text it always was for every pixel - the map's, negative ones, -0, past the span, not a
// whole number - the same string each time within the span, the keeping bounded; and the sea's soundings ask it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pixelKeyText, PIXEL_KEY_SPAN, PIXEL_KEYS_KEPT } from '../../src/world/pixelKeys.js';
import { seeded } from '../navalSea.mjs';

test('PIXEL-KEYS: every pixel\'s key is the text it was - the map\'s, negative ones, -0, at and past the span, not whole numbers', () => {
  const rnd = seeded(3);
  for (let i = 0; i < 50000; i++) {
    const px = Math.floor((rnd() - 0.5) * 2.4 * PIXEL_KEY_SPAN), py = Math.floor((rnd() - 0.5) * 2.4 * PIXEL_KEY_SPAN);
    assert.equal(pixelKeyText(px, py), `${px},${py}`);
  }
  for (const [x, y] of [[0, 0], [-0, 0], [0, -0], [999, 499], [-1, -1], [PIXEL_KEY_SPAN - 1, 1 - PIXEL_KEY_SPAN], [PIXEL_KEY_SPAN, 0], [0, -PIXEL_KEY_SPAN], [1.5, 2], [NaN, 3], [Infinity, 1]]) {
    assert.equal(pixelKeyText(x, y), `${x},${y}`, `${x},${y}`);
  }
  // the pairs that would share a kept number were the span or the whole numbers not asked first
  const S = PIXEL_KEY_SPAN;
  assert.equal(pixelKeyText(1, -S), `1,${-S}`); assert.equal(pixelKeyText(0, S), `0,${S}`, 'past the span: no row of its own');
  assert.equal(pixelKeyText(2.5, -4000), '2.5,-4000'); assert.equal(pixelKeyText(2, 96), '2,96', 'a fraction: no place of its own');
});

test('PIXEL-KEYS: within the span a pixel\'s key is made once - the same string each time - and the keeping is bounded', () => {
  const a = pixelKeyText(512, 256), b = pixelKeyText(512, 256);
  assert.equal(a, b);
  // the same string object: a Map keyed by it is asked by identity first (no new string to hash)
  const seen = new Set([a]);
  assert.ok(seen.has(b));
  for (let i = 0; i < PIXEL_KEYS_KEPT + 10; i++) pixelKeyText(i % 1000, Math.floor(i / 1000));
  assert.equal(pixelKeyText(512, 256), '512,256', 'still the text after the keeping starts again');
});

test('PIXEL-KEYS: the sea\'s soundings ask the built pixels by it (scenes/world.js csaPixelAt)', () => {
  const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /const csaPixelAt = \(x, z\) => \{\n\s+const c = state\.compensation;\n\s+return built\.get\(pixelKeyText\(state\.mapOrigin\.x \+ Math\.floor\(\(x - c\[0\]\) \/ TERRAIN_SIZE\), state\.mapOrigin\.y - Math\.floor\(\(z - c\[2\]\) \/ TERRAIN_SIZE\)\)\) \?\? null;/);
  assert.match(src, /import \{ pixelKeyText \} from '\.\.\/world\/pixelKeys\.js';/);
});
