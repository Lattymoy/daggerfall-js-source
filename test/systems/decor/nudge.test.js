// FIELD BUGS 2026-10-29f NUDGE (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating", items
// 12 and 14: "Just like there are buttons to move a part up and down it would be great to be able to nudge them sideways
// a little bit"; "Allow SOME clipping inside the houses"). A piece in the flight is pushed a step along the level, the
// way the eye sees it and on the world axis nearest that way, to a metre each side of where the eye sets it - after the
// wall's clearance, so the owner may sink it into a wall as far as they choose. A hung piece slides along its surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecorPlacer, decorNudgeStep, DECOR_NUDGE_STEP, DECOR_NUDGE_FINE, DECOR_NUDGE_MAX, DECOR_GRID, decorWallOffset } from '../../../src/systems/decor/decorPlacer.js';
import { DECOR_FREE_KEYS } from '../../../src/scenes/decor/decorTool.js';
import { DFICON_ROWS } from '../../../src/ui/menu/menuGlyphs.js';
import { createDecorBar, decorBarKeys } from '../../../src/ui/decorPanel.js';
import { toolRig, placeFrom, chipNamed, fakeDoc } from '../../decorFakes.mjs';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('NUDGE the step: the way the eye sees it, on the level world axis nearest that way - so a gridded piece stays on its grid (mutants: NUDGE-axis-unsnapped, NUDGE-sides-swapped)', () => {
  const s = DECOR_NUDGE_STEP;
  assert.deepEqual(['right', 'left', 'forward', 'back'].map((d) => decorNudgeStep(0, d)), [[s, 0], [-s, 0], [0, s], [0, -s]], 'facing +z');
  assert.deepEqual(['right', 'forward'].map((d) => decorNudgeStep(Math.PI / 2, d)), [[0, -s], [s, 0]], 'facing +x');
  assert.deepEqual(decorNudgeStep(Math.PI / 4 + 0.1, 'forward'), [s, 0], 'past the diagonal, the nearer axis whole');
  assert.deepEqual(decorNudgeStep(Math.PI, 'left', DECOR_NUDGE_FINE), [DECOR_NUDGE_FINE, 0], 'a fine step');
  assert.deepEqual([DECOR_NUDGE_STEP, DECOR_NUDGE_FINE, DECOR_NUDGE_MAX], [0.05, 0.01, 1]);
});

test('NUDGE the placer: the push rides every piece the eye sets, within a metre each way; on a wall it goes after the clearance, so a piece sinks into the wall as far as it is pushed; a hung piece slides along its surface, never off it (mutants: NUDGE-unbounded, NUDGE-unapplied, NUDGE-before-the-wall, NUDGE-mount-off-the-wall)', () => {
  const chair = { key: 'm41000', model: 41000, flat: null, kind: 'furniture', name: 'Chair', storage: false, light: null };
  const box = [-0.5, -0.1, -0.5, 0.5, 0.9, 0.5];
  const p = createDecorPlacer(chair, { radius: 0.8, box });
  const floor = p.pieceAt([2, 0, 3], [0, 0, 0], 'a', [0, 1, 0]);
  p.nudge(0.3, -0.2);
  const pushed = p.pieceAt([2, 0, 3], [0, 0, 0], 'a', [0, 1, 0]);
  assert.ok(near(pushed.pos[0], floor.pos[0] + 0.3) && near(pushed.pos[2], floor.pos[2] - 0.2) && near(pushed.pos[1], floor.pos[1]), 'on the floor');
  for (let i = 0; i < 40; i++) p.nudge(0.05, -0.05);
  assert.deepEqual(p.state().nudge, [DECOR_NUDGE_MAX, -DECOR_NUDGE_MAX], 'a metre each way at most');
  const w = createDecorPlacer(chair, { radius: 0.8, box });
  const clear = w.pieceAt([2, 1, 3], [0, 0, 0], 'b', [1, 0, 0]);
  assert.ok(near(clear.pos[0], 2 + decorWallOffset(0.5)), 'the wall\'s clearance first');
  w.nudge(-0.4, 0);
  const sunk = w.pieceAt([2, 1, 3], [0, 0, 0], 'b', [1, 0, 0]);
  assert.ok(near(sunk.pos[0], clear.pos[0] - 0.4) && sunk.pos[0] - 0.5 < 2 - 0.3, `its back face pushed 0.35 m into the wall (${sunk.pos[0]})`);
  const sword = { key: 'own', model: null, flat: [207, 1], kind: 'own', name: 'Sword', mount: true, light: null, storage: false };
  const m = createDecorPlacer(sword, { free: true });
  const hung = m.pieceAt([2, 1.5, 3], [0, 0, 0], 'c', [0, 0, 1]);
  m.nudge(0.2, 0.2);
  const slid = m.pieceAt([2, 1.5, 3], [0, 0, 0], 'c', [0, 0, 1]);
  assert.ok(near(slid.pos[0], hung.pos[0] + 0.2), 'along the wall');
  assert.ok(near(slid.pos[2], hung.pos[2]), 'never off it');
});

test('NUDGE the decorator: Numpad 4, 6, 8 and 2 push the piece in hand a step the way the eye looks (Shift a fine one), and so do the bar\'s four presses - each pictured; the legend names them (mutants: NUDGE-keys-unread, NUDGE-fine-unread, NUDGE-bar-unwired)', async () => {
  assert.deepEqual(['Numpad4', 'Numpad6', 'Numpad8', 'Numpad2'].map((c) => DECOR_FREE_KEYS[c]), ['nudgeLeft', 'nudgeRight', 'nudgeForward', 'nudgeBack']);
  const rig = toolRig();
  await placeFrom(rig, 'm41000');
  const at = () => rig.tool.ghost().pos;
  const start = [...at()];
  rig.win.fire('keydown', { code: 'Numpad6' });
  rig.frame();
  assert.ok(near(at()[0], start[0] + DECOR_NUDGE_STEP) && near(at()[2], start[2]), `Numpad6: right (${at()})`);
  rig.win.fire('keydown', { code: 'Numpad8', shiftKey: true });
  rig.frame();
  assert.ok(near(at()[2], start[2] + DECOR_NUDGE_FINE), 'Shift: a fine step away');
  const bar = rig.doc.body.children.find((c) => String(c.className).includes('dfdecor-bar'));
  chipNamed(bar, 'Nudge left').fire('click');
  chipNamed(bar, 'Nudge back').fire('click');
  rig.frame();
  assert.ok(near(at()[0], start[0]) && near(at()[2], start[2] + DECOR_NUDGE_FINE - DECOR_NUDGE_STEP), 'the bar\'s presses');
  const fresh = createDecorBar({ on: {}, doc: fakeDoc() });
  for (const label of ['Nudge left', 'Nudge right', 'Nudge away', 'Nudge back']) {
    const chip = chipNamed(fresh.root, label);
    assert.ok(chip && DFICON_ROWS[chip.dataset.dficon]?.length === 12, `${label}: pictured`);
  }
  assert.ok(decorBarKeys(false).some(([k, v]) => k === 'Nudge' && /Numpad 4, 6, 8 and 2/.test(v)));
});

test('AUDIT FB1029f C6: Ctrl is a fine step too (Windows lets Shift go for a numpad key under NumLock), and on the grid a step is the grid\'s, so a gridded piece stays on it (mutants: AUDITFB1029F-C6-ctrl-unread, AUDITFB1029F-C6-grid-unread)', async () => {
  const rig = toolRig();
  await placeFrom(rig, 'm41000');
  const at = () => rig.tool.ghost().pos;
  const start = [...at()];
  rig.win.fire('keydown', { code: 'Numpad6', ctrlKey: true });
  rig.frame();
  assert.ok(near(at()[0], start[0] + DECOR_NUDGE_FINE), `Ctrl: fine (${at()})`);
  rig.win.fire('keydown', { code: 'Slash' });   // the grid
  rig.frame();
  const snapped = [...at()];
  rig.win.fire('keydown', { code: 'Numpad6' });
  rig.frame();
  assert.ok(near(at()[0], snapped[0] + DECOR_GRID), `gridded: a grid step (${snapped} -> ${at()})`);
});
