// DECOR-FLIP (2026-09-27, Discord: "Some sprites flipped (allow rotation)").
//
// A FLAT TURNED HALF ROUND FACES THE OTHER WAY. A billboard turns to the eye whatever its record says, so a placed
// picture's turn did nothing: a sprite that faced the wrong way for the room stood that way for good. Now the one turn a
// picture has is which way it faces - turned more than a quarter either way (the placement's own yaw, kept in the
// record as a model's is), it is drawn mirrored, the ghost as it will stand (net/decorLaw.js decorFlatMirrored; the
// renderer's flip is the sign of a batch's width). A mount hangs by its own frame and a model turns in earnest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorFlatMirrored } from '../src/net/decorLaw.js';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { settle, toolRig, placeFrom } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flat = (yaw, over = {}) => ({ id: 'p1', model: null, flat: [209, 0], pos: [0, 0, 0], rot: [yaw, 0, 0], scale: 1, light: null, storage: false, paid: 20, ...over });

test('DECOR-FLIP the law: a flat turned past a quarter either way is mirrored; up to a quarter, as it came; a model and a hung mount never (mutants: the quarter taken as a half; a mount mirrored)', () => {
  assert.deepEqual([0, 15, 90, 105, 180, -90, -105, -180].map((y) => decorFlatMirrored(flat(y))), [false, false, false, true, true, false, true, true]);
  assert.equal(decorFlatMirrored({ ...flat(180), model: 41000, flat: null }), false, 'a model turns in earnest');
  assert.equal(decorFlatMirrored(flat(180, { item: { t: 113, g: 3 } })), false, 'a hung weapon spins on its wall, never mirrors');
  assert.equal(decorFlatMirrored(null), false);
});

test('DECOR-FLIP the room: a turned picture stands mirrored - its batch\'s width negative - while the eye\'s box keeps its whole width (mutants: the flip dropped; the box read off the drawn size)', async () => {
  const made = [];
  const room = createDecorRoom({
    meshes: null, collider: () => null, origin: () => [0, 0, 0],
    renderer: { createBillboardBatch: (a, r, size, centers) => { const b = { a, r, size, centers }; made.push(b); return b; }, destroyBillboardBatch() {} },
    getTexture: async () => ({ recordCount: 8, getSize: () => ({ width: 20, height: 30 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 }),
    uploadRecord() {},
  });
  room.put(flat(180));
  room.put(flat(0, { id: 'p2' }));
  await settle(); await settle();
  assert.equal(made.length, 2);
  assert.ok(made[0].size.w < 0 && made[0].size.h > 0, `turned half round: mirrored (${made[0].size.w})`);
  assert.ok(made[1].size.w > 0, 'as it came');
  assert.equal(-made[0].size.w, made[1].size.w, 'the same picture, the same size');
  const [t1] = room.targets().filter((t) => t.key === 'decor:p1');
  assert.ok(t1.aabb.max[0] > t1.aabb.min[0], 'the box the eye points at keeps its width');
});

test('DECOR-FLIP the ghost: turned past a quarter while it is placed, the picture being placed is mirrored as it will stand (mutant: the ghost unflipped)', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'f209.0');
  rig.frame(); await settle(); rig.frame();
  const ghost = () => rig.tool.batches()[0];
  assert.ok(ghost(), 'a ghost stands');
  assert.ok(ghost().size.w > 0, 'as it came');
  for (let i = 0; i < 8; i++) rig.win.fire('keydown', { code: 'ArrowRight' });   // eight steps of fifteen: 120 degrees
  rig.frame();
  assert.ok(ghost().size.w < 0, `turned: mirrored (${ghost().size.w})`);
  assert.equal(await rig.tool.commit(), true);
  assert.equal(decorFlatMirrored(rig.standing.at(-1)), true, 'and it stands so');
  assert.match(src('src/ui/decorPanel.js'), /Turn: wheel or Turn Left\/Right \(Shift: fine; a picture turned half round faces the other way\)/, 'the bar says what a turn does to a picture');
});
