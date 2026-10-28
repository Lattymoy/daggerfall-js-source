// RPT1026-MISC GIANT-ROCK (a private report, the second sighting: giants of the open zone standing inside rocks). A Greater
// Giant is stood on the ground when the player comes near its walk (world.js wildGiantsFrame), on the flattest open spot
// GIANT-FIELDS finds (giantFieldSpot) - chosen by the height map alone, so the zone's rocks (World of Daggerfall's landform
// pieces, each a mesh in the world collider, standing on flat ground as often as not) were never seen, and a giant four
// times its size was stood inside one; the ten its call brings (greaterGiantCall) the same. The spot is asked of the
// collider now (systems/wild/wildGiants.js giantGroundBlocked - its open-space test, sphereOverlaps, and insideSolid). Driven on the REAL
// Collider with a rock filed as the pixel build files World of Daggerfall's pieces (one small model scaled up); the two
// stand sites of bootWorld pinned by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../../src/player/collider.js';
import { trs } from '../../../src/world/mat4.js';
import { giantGroundBlocked, GIANT_CLEAR_R, GIANT_CLEAR_LIFT } from '../../../src/systems/wild/wildGiants.js';
import { hostText } from '../../hostText.mjs';

function box([x0, y0, z0], [x1, y1, z1]) {
  return {
    positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
  };
}
const PEBBLE = box([-0.5, 0, -0.5], [0.5, 1, 0.5]);

test('RPT1026-MISC GIANT-ROCK: a spot inside a rock, or with a rock\'s face at the giant\'s side, is no ground to stand a giant on; open ground beside it is (mutants: rpt1026-misc-giant-rock-inside-unseen, rpt1026-misc-giant-rock-face-unseen)', () => {
  const col = new Collider(() => 0);
  col.addMesh('rocks', PEBBLE.positions, PEBBLE.indices, trs(0, 0, 0, 0, 0, 0, 12, 8, 12));   // a rock 12 m across, 8 m tall, on flat ground at the origin
  assert.equal(giantGroundBlocked(col, 0, 0, 0), true, 'its middle: a giant stood here stands inside it');
  assert.equal(giantGroundBlocked(col, 6 + GIANT_CLEAR_R - 0.5, 0, 0), true, 'beside its face, nearer than the giant\'s body is wide');
  assert.equal(giantGroundBlocked(col, 6 + GIANT_CLEAR_R + 0.5, 0, 0), false, 'a step farther: clear');
  assert.equal(giantGroundBlocked(col, 40, 0, 40), false, 'the open field');
  assert.equal(giantGroundBlocked(col, 0, 8 + 0.1, 0), false, 'on top of it, its body over the rock, not in it (a slope and crest test owns that)');
  assert.ok(GIANT_CLEAR_LIFT > GIANT_CLEAR_R, 'the test is of the body above the feet - the ground itself is never a solid');
  assert.equal(giantGroundBlocked(null, 0, 0, 0), false, 'no collider (a host with none): nothing refused');
});

test('RPT1026-MISC GIANT-ROCK by source: both doors that stand a giant ask the ground - the Greater Giant\'s field and its call\'s ring (mutant: rpt1026-misc-giant-rock-unasked)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(slope > 1\.6 \|\| crest > 4 \|\| giantGroundBlocked\(collider, x, h, z\)\) continue;/, 'giantFieldSpot');
  assert.match(w, /if \(!wildInside\(mask, mx, my\) \|\| giantGroundBlocked\(collider, x, h, z\)\) continue;[^\n]*\n\s*stood\+\+;/, 'greaterGiantCall');
});
