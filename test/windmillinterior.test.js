import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WINDMILL_INTERIOR } from '../src/world/windmillInterior.js';
import { attachWindmillRecord } from '../src/world/rmbLayout.js';
import { layoutInterior } from '../src/world/interiorLayout.js';

// WM2g - THE MILL HAS AN INSIDE.
//
// Mac, having been asked twice whether to do it: "Put it in". So the
// interior of the subrecord Kamer adds to each farm block is vendored
// and attached, and the door his building carries now leads somewhere.
//
// The bake pins are the bakeBooks shape - baked against vendored - and
// the one that matters is the last: the interior is driven through the
// port's REAL layoutInterior, because a data blob that satisfies a
// shape check and then throws on the path that consumes it is worth
// nothing, and that path is GL-free.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('WM2g: the baked interior is what the vendored file says', () => {
  const src = JSON.parse(readFileSync(join(root, 'vendor/windmills-kamer/interior.json'), 'utf8')).interior;
  assert.equal(WINDMILL_INTERIOR.block3dObjectRecords.length, src.Block3dObjectRecords.length);
  assert.equal(WINDMILL_INTERIOR.blockFlatObjectRecords.length, src.BlockFlatObjectRecords.length);
  assert.equal(WINDMILL_INTERIOR.blockSection3Records.length, src.BlockSection3Records.length);
  WINDMILL_INTERIOR.block3dObjectRecords.forEach((o, i) => {
    const v = src.Block3dObjectRecords[i];
    assert.equal(o.modelIdNum, v.ModelIdNum, `model ${i} drifted from the vendored source`);
    assert.equal(o.xPos, v.XPos); assert.equal(o.yPos, v.YPos); assert.equal(o.zPos, v.ZPos);
    assert.equal(o.yRotation, v.YRotation ?? 0);
  });
});

test('WM2g: the interior BUILDS through the port\'s own layoutInterior', () => {
  // The pin that would have caught a shape mistake the others cannot.
  // layoutInterior is pure but for the model getter, so it runs here
  // with a stand-in: every model resolves to a one-triangle mesh, and
  // the build must produce a placement for each record it did not
  // deliberately drop.
  const block = {
    name: 'FARMAA00.RMB',
    index: 704,
    rmbBlock: { subRecords: [{ exterior: { block3dObjectRecords: [] }, interior: {} }] },
  };
  const recordIndex = attachWindmillRecord(block);
  const model = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2]),
    subMeshes: [{ textureArchive: 67, textureRecord: 1, startIndex: 0, primitiveCount: 1 }],
    doors: [],
  };
  const out = layoutInterior(block, block.index, recordIndex, () => model);
  assert.ok(out.placements.length > 0, 'the mill interior built nothing');
  assert.ok(out.flats.length > 0, 'the mill interior lost its flats');
  assert.ok(out.markers.length > 0, 'the mill interior lost its markers');
  for (const p of out.placements) {
    assert.equal(p.matrix.length, 16, 'a placement without a matrix');
    for (const v of p.matrix) assert.ok(Number.isFinite(v), 'a placement matrix carries NaN');
  }
});

test('WM2g: a model the player\'s ARCH3D lacks drops its placement, not the interior', () => {
  // The interior names 41601 - Kamer's own mill machinery - and his
  // replacement for it is NOT vendored, so it resolves out of the
  // player's own ARCH3D or not at all. layoutInterior already drops a
  // missing model rather than failing the build; this holds that,
  // because this interior is the first one in the port that can name a
  // model an ARCH3D might not carry.
  const block = {
    name: 'FARMAA00.RMB',
    index: 704,
    rmbBlock: { subRecords: [{ exterior: { block3dObjectRecords: [] }, interior: {} }] },
  };
  const recordIndex = attachWindmillRecord(block);
  const model = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2]),
    subMeshes: [{ textureArchive: 67, textureRecord: 1, startIndex: 0, primitiveCount: 1 }],
    doors: [],
  };
  const whole = layoutInterior(block, block.index, recordIndex, () => model);
  const missing = layoutInterior(block, block.index, recordIndex,
    (id) => (id === 41601 ? null : model));
  assert.ok(missing.placements.length > 0, 'one absent model took the whole interior down');
  assert.ok(missing.placements.length < whole.placements.length,
    'the fixture no longer drops anything - it proves nothing');
});
