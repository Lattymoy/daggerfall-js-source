// DLV4 (bible/03-World/Delve-II.md section 5): THE CRYSTALS AT A ROOM'S SIZE - the Court's crystal pass
// (render/courtCrystals.js) takes each crystal's `scale`, the Court's and the Spire's 1 unchanged: the shader scales the
// cluster before it turns, and its floor's glow with it. Held to fail under tools/mutants/dlv4.json's DLV4-crystal-scale-ignored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CRYSTAL_VS } from '../../src/render/courtCrystals.js';

const src = readFileSync(new URL('../../src/render/courtCrystals.js', import.meta.url), 'utf8');

test('DLV4 THE CRYSTAL\'S SCALE: the cluster scaled before it turns, by the crystal\'s own `scale` (1 the Court\'s), its glow\'s pool with it (mutants: the scale ignored)', () => {
  assert.match(CRYSTAL_VS, /uniform float uScale;/);
  assert.match(CRYSTAL_VS, /p \*= uScale;\n {2}float cy = cos\(uYaw\)/, 'scaled, then turned and placed');
  assert.match(src, /gl\.uniform1f\(U\.uScale, q\.scale > 0 \? q\.scale : 1\);/, 'a crystal with no scale is the Court\'s');
  assert.match(src, /gl\.uniform1f\(G\.uW, CRYSTAL_POOL_R \* \(q\.scale > 0 \? q\.scale : 1\)\);/, 'its pool the same size');
});
