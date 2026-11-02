// Preview freezes the ghost. The camera walks round it. Nothing is stood or paid until Place, and Back stands nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolRig, placeFrom, all } from '../../decorFakes.mjs';

const barOf = (rig) => rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
const chip = (rig, label) => all(barOf(rig), 'dfdecor-chip').find((c) => c.textContent === label);

test('preview holds the ghost while the camera moves, and Back neither stands it nor pays', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'm41000');
  rig.frame();
  const before = rig.tool.ghost().pos.map((v) => v);
  const gold = rig.w.gold;
  chip(rig, 'Preview').fire('click');
  rig.frame();
  assert.equal(chip(rig, 'Preview').getAttribute('aria-pressed'), 'true');
  rig.win.fire('keydown', { code: 'KeyW' });
  rig.frame();
  rig.frame();
  rig.win.fire('keyup', { code: 'KeyW' });
  const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
  rig.tool.cameraOverride(cam);
  assert.ok(cam.pos[2] > 10, 'the camera walked forward');
  assert.deepEqual(rig.tool.ghost().pos, before);
  chip(rig, 'Turn right').fire('click');
  rig.frame();
  assert.equal(rig.tool.ghost().rot[0], 15);
  assert.deepEqual([rig.tool.ghost().pos[0], rig.tool.ghost().pos[2]], [before[0], before[2]]);
  rig.tool.back();
  assert.equal(rig.standing.length, 0);
  assert.equal(rig.w.gold, gold);
  assert.equal(rig.tool.ghost(), null);
});

test('the middle mouse button freezes the preview the same way the bar does', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'm41000');
  rig.frame();
  const before = rig.tool.ghost().pos.map((v) => v);
  rig.win.fire('mousedown', { button: 1 });
  rig.frame();
  assert.equal(chip(rig, 'Preview').getAttribute('aria-pressed'), 'true');
  rig.win.fire('keydown', { code: 'KeyW' });
  rig.frame();
  rig.win.fire('keyup', { code: 'KeyW' });
  assert.deepEqual(rig.tool.ghost().pos, before);
  rig.win.fire('mousedown', { button: 1 });
  rig.frame();
  assert.equal(chip(rig, 'Preview').getAttribute('aria-pressed'), 'false');
});

test('placing from a frozen preview stands and pays once, and closing the flight drops the ghost', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'm41000');
  rig.frame();
  const gold = rig.w.gold;
  chip(rig, 'Preview').fire('click');
  assert.equal(await rig.tool.commit(), true);
  assert.equal(rig.standing.length, 1);
  assert.ok(rig.w.gold < gold);
  rig.tool.close();
  assert.equal(rig.tool.ghost(), null);
  assert.equal(rig.standing.length, 1);
});
