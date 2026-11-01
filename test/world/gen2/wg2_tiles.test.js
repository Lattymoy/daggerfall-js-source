// WG2 PROVINCES IN TILES ("Tiles"): each of the nine provinces cut into tiles on one
// world lattice that hold all its land; two neighbouring tiles baked apart crossfade across their overlap - their
// shares sum to one, the ground runs on without a step, a lone region's overlap is still refused - and the manifest
// takes tiles of one tiling over each other's bands alone. Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonReady, canonTheatre, worldToPicture, pictureToWorld } from '../../../src/world/gen2/canon.js';
import { provinceTiles } from '../../../src/world/gen2/tiling.js';
import { bakeRegion, BAKE_GENERATOR } from '../../../src/world/gen2/regionBake.js';
import { encodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { gen2Install, gen2Units, gen2Regions } from '../../../src/world/gen2/gen2Ground.js';
import { worldManifest, manifestProblems } from '../../../src/world/gen2/manifest.js';
import { PROVINCE_OF_ID } from '../../../src/world/tamriel/tamrielLand.js';

await canonReady();
const m = worldManifest(), fit = m.fit;

test('WG2 TILES: every province of the nine is cut on the one lattice into tiles that hold all its land, each a core grown by its overlap (mutants: a tile left out, the lattice\'s anchor)', () => {
  for (const [t, key] of Object.entries(PROVINCE_OF_ID)) {
    const tiles = provinceTiles(fit, Number(t), key, { seed: m.worldSeed });
    assert.ok(tiles.length > 0, key);
    for (const s of tiles) {
      assert.ok(s.core.x % 128 === 0 && s.core.y % 128 === 0, `${s.id} on the lattice`);
      assert.deepEqual(s.rect, { x: s.core.x - 12, y: s.core.y - 12, w: 152, h: 152 });
    }
    const cores = new Set(tiles.map((s) => `${s.core.x},${s.core.y}`));
    for (let py = 0.25; py < 200; py += 2) for (let px = 0.25; px < 320; px += 2) {
      if (canonTheatre(px, py) !== Number(t)) continue;
      const [x, y] = pictureToWorld(fit, px, py);
      const cx = Math.floor(x / 128) * 128, cy = Math.floor(y / 128) * 128;
      // a land point is in a tile, or its cell held land too thin for the core's samples to meet
      if (!cores.has(`${cx},${cy}`)) {
        let any = false;
        for (let b = 0; b < 8 && !any; b++) for (let a = 0; a < 8 && !any; a++) any = canonTheatre(...worldToPicture(fit, cx + (a + 0.5) * 16, cy + (b + 0.5) * 16)) === Number(t);
        assert.ok(!any, `${key}: land at ${x},${y} in no tile`);
      }
    }
  }
});

test('WG2 TILES: two neighbouring tiles baked apart crossfade across their overlap - their shares sum to one and the ground runs on without a step; a lone region over a tile is refused (mutants: the partition, the tiles\' overlap allowed)', () => {
  const mk = (i) => ({ id: `law-tile-${i}`, rect: { x: 1060 + i * 24 - 4, y: 400 - 4, w: 32, h: 32 }, res: 1, seed: m.worldSeed, fit, springs: [], erosion: { steps: 10 }, tiling: 'law', blend: 4, core: { x: 1060 + i * 24, y: 400, w: 24, h: 24 } });
  const a = encodeBake(bakeRegion(mk(0))), b = encodeBake(bakeRegion(mk(1)));
  assert.equal(gen2Install([a, b], fit).length, 2, 'tiles of one tiling stand together');
  const [ra, rb] = gen2Regions();
  for (const s of [-3.5, -1.2, 0, 0.7, 2.9]) {
    const x = 1084 + s, y = 412;
    assert.ok(Math.abs(ra.weight(x, y) + rb.weight(x, y) - 1) < 1e-12, `the shares at ${s} sum to one`);
  }
  // across the seam the ground's steps are no larger than within either tile
  let seam = 0, inner = 0;
  const step = 0.02;
  for (let x = 1078; x < 1090; x += step) seam = Math.max(seam, Math.abs(gen2Units(x + step, 412, 0) - gen2Units(x, 412, 0)));
  for (let x = 1064; x < 1076; x += step) inner = Math.max(inner, Math.abs(gen2Units(x + step, 412, 0) - gen2Units(x, 412, 0)));
  assert.ok(seam < 3 * inner + 0.5, `a step at the seam ${seam} against ${inner} inside`);
  const lone = encodeBake(bakeRegion({ ...mk(1), id: 'law-lone', tiling: undefined, blend: undefined, core: undefined }));
  assert.equal(gen2Install([a, lone], fit).length, 1, 'a lone region over a tile is refused');
  gen2Install([], fit);
});

test('WG2 TILES IN THE MANIFEST: tiles of one tiling may overlap in their bands; their cores may not, nor two tilings (mutants: the core test)', () => {
  const row = (i, tiling = 'hammerfell', dx = 0) => ({ id: `t${i}`, rect: { x: 1100 + i * 128 - 12 + dx, y: 600, w: 152, h: 152 }, bake: `t${i}.wg2`, print: 'abcdef01', generator: BAKE_GENERATOR, revision: 1, tiling, core: { x: 1100 + i * 128 + dx, y: 612, w: 128, h: 128 } });
  assert.deepEqual(manifestProblems({ ...m, published: [row(0), row(1)] }), []);
  assert.deepEqual(manifestProblems({ ...m, published: [row(0), row(1, 'skyrim')] }), ['published t1: overlaps t0']);
  assert.deepEqual(manifestProblems({ ...m, published: [row(0), row(1, 'hammerfell', -20)] }), ['published t1: overlaps t0']);
});

test('WG2 LEAN: a published tile\'s cut carries the runtime planes alone - the same ground to the bit at a third of the bytes or less (mutants: a runtime plane dropped)', async () => {
  const { RUNTIME, decodeBake } = await import('../../../src/world/gen2/bakeCodec.js');
  const { regionSampler } = await import('../../../src/world/gen2/regionSampler.js');
  const { gzipSync } = await import('node:zlib');
  const spec = { id: 'law-lean', rect: { x: 3230, y: 1270, w: 24, h: 24 }, res: 2, seed: m.worldSeed, fit, springs: [], erosion: { steps: 10 } };
  const bake = bakeRegion(spec), full = encodeBake(bake), lean = encodeBake(bake, { lean: true });
  assert.deepEqual(Object.keys(decodeBake(lean).fields).sort(), [...RUNTIME].sort());
  assert.ok(gzipSync(lean).length * 3 < gzipSync(full).length, 'smaller');
  const a = regionSampler(decodeBake(full)), b = regionSampler(decodeBake(lean));
  for (let i = 0; i < 400; i++) {
    const x = 3232 + (i * 0.0517) % 20, y = 1272 + (i * 0.0733) % 20;
    assert.equal(b.heightAt(x, y), a.heightAt(x, y));
    assert.deepEqual(b.waterAt(x, y), a.waterAt(x, y));
  }
});
