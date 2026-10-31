// WG2 THE SEAM (bible/03-World/World-2-Canon.md, "The seam"): a published region's ground through the world's own
// readers - tamrielGround.js's byte and climate, landforms.js's shaper (gen2Units), terrainGen.js's water paint - and
// nothing at all with none installed. A bake made on another fit is refused, the region's edge eases into the world's
// ground, and a pixel outside it is the world's own. A pixel past the Bay (Black Marsh) beside the Bay's untouched.
// Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { gen2Install, gen2Byte, gen2Climate, gen2Units, gen2Stamp, gen2Regions, paintGen2Waters, gen2Shipped } from '../../../src/world/gen2/gen2Ground.js';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { kernelUnits, REGION_BLEND_PX } from '../../../src/world/gen2/regionSampler.js';
import { worldManifest } from '../../../src/world/gen2/manifest.js';
import { tamrielHeightByte, tamrielClimateAt, dropGroundCache } from '../../../src/world/tamriel/tamrielGround.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { HEIGHTMAP_DIMENSION } from '../../../src/world/terrain/terrainSampler.js';

const bytes = readBake(`${BAKE_DIR}/blackmarsh-test.wg2.gz`), decoded = decodeBake(bytes), R = decoded.header.rect, fit = worldManifest().fit;
const lawAt = (x, y) => { gen2Install([], fit); dropGroundCache(); return [tamrielHeightByte(x, y), tamrielClimateAt(x, y)]; };

test('WG2 SEAM: with no region installed every hook answers nothing and the ground is the world\'s own, on the Bay and past it (mutants: a hook that answers outside a region)', () => {
  setTamrielFit(fit);
  gen2Install([], fit);
  assert.equal(gen2Regions().length, 0); assert.equal(gen2Stamp(), ''); assert.deepEqual(gen2Shipped(), []);
  for (const [x, y] of [[R.x + 40, R.y + 40], [500, 250]]) {
    assert.equal(gen2Byte(x, y, 9), undefined); assert.equal(gen2Climate(x, y), undefined); assert.equal(gen2Units(x + 0.5, y + 0.5, 99), undefined);
  }
});

test('WG2 SEAM: a region installed on its own fit stands its bytes, climate and ground inside, eases across its edge band and leaves the world outside; on another fit it is refused (mutants: the fit check, the blend, the climate\'s half, the units)', () => {
  setTamrielFit(fit);
  const inner = [R.x + 40, R.y + 40], edge = [R.x, R.y + 40], out = [R.x - 3, R.y + 40];
  const [lawIn] = lawAt(...inner), [lawEdge] = lawAt(...edge), [lawOut, climOut] = lawAt(...out);
  // a pixel whose climate the bake changes (the zone's and the bake's differ there)
  let other = null;
  for (let y = R.y + 10; y < R.y + R.h - 10 && !other; y += 3) for (let x = R.x + 10; x < R.x + R.w - 10 && !other; x += 3) if (lawAt(x, y)[1] !== decoded.climates[(y - R.y) * R.w + x - R.x]) other = [x, y];
  assert.ok(other, 'the bake moves some pixel\'s climate');
  assert.equal(gen2Install([bytes], { ...fit, ox: fit.ox + 1 }).length, 0, 'another fit: refused');
  assert.equal(gen2Install([bytes], fit).length, 1);
  dropGroundCache();
  const own = decoded.bytes[(inner[1] - R.y) * R.w + inner[0] - R.x];
  assert.equal(tamrielHeightByte(...inner), own, 'inside: the bake\'s byte');
  assert.notEqual(own, lawIn, 'and not the law\'s');
  assert.equal(tamrielClimateAt(...inner), decoded.climates[(inner[1] - R.y) * R.w + inner[0] - R.x]);
  assert.equal(tamrielClimateAt(...other), decoded.climates[(other[1] - R.y) * R.w + other[0] - R.x], 'the bake\'s climate, not the zone\'s');
  const ease = (t) => t * t * (3 - 2 * t), ownEdge = decoded.bytes[(edge[1] - R.y) * R.w], w = ease(0.5 / REGION_BLEND_PX);
  assert.equal(tamrielHeightByte(...edge), Math.round(lawEdge + (ownEdge - lawEdge) * w), 'the edge pixel eased from the world\'s');
  assert.equal(tamrielHeightByte(...out), lawOut, 'outside: the world\'s own');
  assert.equal(tamrielClimateAt(...out), climOut);
  const r = gen2Regions()[0], p = [R.x + 30.3, R.y + 50.7];
  assert.equal(gen2Units(...p, 0), kernelUnits(r.heightAt(...p)));
  assert.equal(gen2Units(R.x - 0.1, R.y + 10, 77), undefined);
  assert.match(gen2Stamp(), /^blackmarsh-test:[0-9a-f]{8}$/);
  gen2Install([], fit); dropGroundCache();
});

test('WG2 SEAM: the region\'s lakes are water to the marching squares, a location\'s rect keeps its ground, and none is painted with no region (mutants: the paint\'s water test, the rect)', () => {
  setTamrielFit(fit);
  gen2Install([bytes], fit);
  const r = gen2Regions()[0], lake = decoded.fields.lake;
  let px = null;
  for (let k = 0; k < lake.data.length && !px; k++) {
    const x = R.x + Math.floor((k % lake.w) / decoded.header.res), y = R.y + Math.floor(((k / lake.w) | 0) / decoded.header.res);
    if (lake.data[k] && r.weight(x, y) >= 1 && r.waterAt(x + 0.5, y + 0.5)) px = [x, y];
  }
  assert.ok(px, 'a lake pixel inside');
  const D = HEIGHTMAP_DIMENSION, td = new Uint8Array(D * D).fill(1);
  const n = paintGen2Waters(td, px[0], px[1], null, D, null, 0);
  assert.ok(n > 0 && td.includes(0));
  const kept = new Uint8Array(D * D).fill(1);
  assert.ok(paintGen2Waters(kept, px[0], px[1], { xMin: -1, xMax: D, yMin: -1, yMax: D }, D, null, 0) < n, 'the rect kept');
  gen2Install([], fit);
  const none = new Uint8Array(D * D).fill(1);
  assert.equal(paintGen2Waters(none, px[0], px[1], null, D, null, 0), 0);
});

test('WG2 SEAM: a bake is fetched under the app\'s root, never under the page\'s /play/ (an SPA fallback answers that with a page, not a bake) (mutants: the root)', async () => {
  const { bakeUrl } = await import('../../../src/scenes/gen2Host.js');
  const { APP_ROOT } = await import('../../../src/systems/appRoot.js');
  assert.equal(bakeUrl('hammerfell-test.wg2'), new URL('worldgen2/hammerfell-test.wg2.gz', APP_ROOT).href);
  assert.doesNotMatch(bakeUrl('hammerfell-test.wg2'), /\/play\/worldgen2\//);
});
