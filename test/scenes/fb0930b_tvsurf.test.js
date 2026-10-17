// FIELD BUGS 2026-09-30b (TV-SURF) - a screenshot, no words: the Overworld (the travel view, TV1) over a coast, the sea
// laid over with light-blue rectangles, straight-edged, pixel-aligned, over open water and low shore.
//
// They are Come Sail Away's breakers (CSA-F): from each water pixel the mod lays a flat strip toward every land
// neighbour, a quarter-pixel inside the water out to the land pixel's centre, 0.1 m over the sea, within Waves.Distance
// pixels of the player - surf from a ground eye (DFU has no raised camera), the strip seen edge-on. From the travel view's
// 150-450 m it is seen whole: its texels minified, the 29 sea #4 Bayer dither makes it a half-tone sheet - the
// screenshot's checker over the plain sea. The travel view waits the surf for the traveller's eye, as it waits the grass;
// the waves' state (the currents, the helm's neighbours) is untouched - only the drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

test('TV-SURF: the breakers are drawn only while the travel view is not (its frame, `tvf`, the grass\'s own gate)', () => {
  const calls = [...W.matchAll(/csaDrawWaves\(\);/g)];
  assert.equal(calls.length, 1, 'one draw of the breakers in the frame');
  assert.match(W, /\n {4}if \(!tvf\) csaDrawWaves\(\);\n/);
  assert.match(W, /\n {4}if \(labGrass && !tvf\) \{/, 'the grass waits the same way (TV1)');
  // the gate reads the frame's own travel view - declared in the same frame, above the draw
  const tvfAt = W.indexOf('    const tvf = travelView?.frame(dt, { eye: tvHeadEye, fwd }) ?? null;');
  const at = W.indexOf('    if (!tvf) csaDrawWaves();');
  assert.ok(tvfAt > 0 && at > tvfAt, 'tvf is the frame\'s, above the draw');
});

test('TV-SURF: the waves\' state is not gated - the runtime still steps its waves, whatever the view', () => {
  const draw = W.slice(W.indexOf('function csaDrawWaves('), W.indexOf('function csaDrawWaves(') + 1500);
  assert.ok(draw.length > 0 && !/tvf|travelView/.test(draw), 'the draw function itself knows nothing of the view');
});
