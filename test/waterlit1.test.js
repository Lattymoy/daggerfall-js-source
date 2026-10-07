// WATER-LIT1 - a lamp or the torch lights water as a glint, not as mud.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterSurfaceFs } from '../src/render/waterSurface.js';

test('WATER-LIT1: the point lights\' diffuse share of the water texel is a quarter, and each light adds a highlight on the waves', () => {
  const fs = waterSurfaceFs('', '');
  // PIN MOVED (WATER-NEXT 2): one loop for the lamps' two terms, the water's colour where the classic texel was
  assert.match(fs, /lit \+= body \* pointAcc \* 0\.25;/, 'the flame no longer paints the ripples brown');
  assert.match(fs, /pointSpec \+= att \* pow\(max\(dot\(n, normalize\(Ld \+ V\)\), 0\.0\), 90\.0\) \* uPointColors\[i\];/);
  assert.match(fs, /col \+= uSunColor \* \(1\.6 \* spec\) \+ uMoonColor \* \(0\.7 \* mspec\) \+ pointSpec \* 1\.2;/, 'the glint joins the sun\'s and the moon\'s');
  assert.ok(fs.indexOf('vec3 V = toEye') < fs.indexOf('pointSpec += '), 'the view vector exists before the glint reads it');
});
