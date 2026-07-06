// Data source: the pure key rule. The canonical ARENA2 key is the
// UPPERCASE basename - real ARENA2 ships uppercase, user-picked
// folders vary in case and carry directory prefixes.
import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeName } from '../src/scenes/dataSource.js';

test('normalizeName: uppercase basename across path styles', () => {
  assert.equal(normalizeName('body00i0.img'), 'BODY00I0.IMG');
  assert.equal(normalizeName('ARENA2/texture.001'), 'TEXTURE.001');
  assert.equal(normalizeName('C:\\games\\DF\\ARENA2\\Arch3D.BSA'), 'ARCH3D.BSA');
  assert.equal(normalizeName('MAPS.BSA'), 'MAPS.BSA');
});
