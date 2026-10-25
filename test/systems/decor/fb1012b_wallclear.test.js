// FIELD BUGS 2026-10-12b WALL-CLEAR - "a lot of stuff just clips through walls, even with grid on and changing size"
// (a Mounted torch, catalogue flat 210.17, set on an interior wall). A piece the eye sets on a wall stood its origin on
// the wall's point: half a model's box and half a turning flat's width inside the wall, the more the bigger it was
// scaled, and the grid rounded world x and z - into the wall as often as out of it. bible/01-Overview/bugs/Field-Bugs-2026-10-12b.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDecorPlacer, DECOR_WALL_GAP, DECOR_WALL_CLIP, decorWallOffset, DECOR_GRID } from '../../../src/systems/decor/decorPlacer.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const origin = [10, 0, 10];
const chair = { key: 'm41000', model: 41000, flat: null, name: 'Chair', kind: 'furniture', storage: false, light: null };
const box = [-0.5, -0.2, -0.3, 0.5, 1.8, 0.3];
const torch = { key: 'f210.17', model: null, flat: [210, 17], name: 'Mounted torch', kind: 'light', storage: false, light: null };

test('WALL-CLEAR a model set on a wall stands out from it by how far its box, turned and scaled, reaches into it - and a hair more; its height the eye\'s (mutants: the reach unread, the wrong side of the box, the turn ignored, the scale ignored, the gap lost)', () => {
  assert.equal(DECOR_WALL_GAP, 0.02);
  assert.equal(DECOR_WALL_CLIP, 0.05);
  assert.equal(decorWallOffset(0.3), 0.25, 'five centimetres into the wall');
  assert.equal(decorWallOffset(0.04), 0.02, 'a thin piece clips only half its reach');
  assert.equal(decorWallOffset(0), DECOR_WALL_GAP);
  assert.equal(decorWallOffset(0.3, { door: true }), 0.32, 'a door stays clear');
  // a wall facing -z (the eye stands at lower z): the box's +z half (0.3) reaches into it
  const pl = createDecorPlacer(chair, { radius: 1, box });
  const p = pl.pieceAt([12, 1.5, 13], origin, 'a', [0, 0, -1], 0);
  assert.deepEqual(p.pos, [2, 1.7, 3 - decorWallOffset(0.3)], 'five centimetres into the wall, lifted by its bottom');
  // a wall facing +x: the box's -x half (0.5) reaches into it
  const side = createDecorPlacer(chair, { radius: 1, box }).pieceAt([12, 1.5, 13], origin, 'b', [1, 0, 0], 0);
  assert.deepEqual(side.pos, [2 + decorWallOffset(0.5), 1.7, 3], 'a wall facing +x');
  // turned a quarter, its long side faces the -z wall
  const turned = createDecorPlacer(chair, { radius: 1, box });
  for (let i = 0; i < 6; i++) turned.turn(15);
  assert.ok(near(turned.pieceAt([12, 1.5, 13], origin, 'c', [0, 0, -1], 0).pos[2], 3 - decorWallOffset(0.5), 1e-3), 'turned, its reach is its turned box\'s');
  // grown, it reaches further
  const grown = createDecorPlacer(chair, { radius: 1, box });
  grown.rescale(true);
  assert.ok(near(grown.pieceAt([12, 1.5, 13], origin, 'd', [0, 0, -1], 0).pos[2], 3 - decorWallOffset(0.3 * 1.1), 1e-3), 'scaled, its reach is scaled');
  // a model whose origin sits near its back (z -0.1 to 0.6): to a -z wall its front's 0.6 reaches, never its back's 0.1
  const lopsided = createDecorPlacer(chair, { radius: 1, box: [-0.5, -0.2, -0.1, 0.5, 1.8, 0.6] });
  assert.ok(near(lopsided.pieceAt([12, 1.5, 13], origin, 'g', [0, 0, -1], 0).pos[2], 3 - decorWallOffset(0.6), 1e-6), 'the side of it that faces the wall');
  const door = createDecorPlacer({ ...chair, kind: 'door' }, { radius: 1, box }).pieceAt([12, 1.5, 13], origin, 'door', [0, 0, -1], 0);
  assert.deepEqual(door.pos, [2, 1.7, 3 - decorWallOffset(0.3, { door: true })], 'a door is not let into the wall');
  const thin = createDecorPlacer(chair, { radius: 1, box: [-0.04, 0, -0.04, 0.04, 0.2, 0.04] }).pieceAt([12, 1.5, 13], origin, 'thin', [0, 0, -1], 0);
  assert.ok(thin.pos[2] < 3 && thin.pos[2] + 0.04 > 3 && thin.pos[2] + 0.04 < 3 + 0.04, 'a thin piece clips, and does not pass through');
  const large = createDecorPlacer(chair, { radius: 1, box: [-2, 0, -2, 2, 3, 2] }).pieceAt([12, 1.5, 13], origin, 'big', [0, 0, -1], 0);
  assert.ok(near(large.pos[2], 3 - decorWallOffset(2), 1e-6) && large.pos[2] + 2 - 3 <= DECOR_WALL_CLIP + 1e-9, 'a large piece clips five centimetres');
  // a slanted wall still within DECOR_HANG_NY of level is a wall; the normal's length is not its reach
  const slant = createDecorPlacer(chair, { radius: 1, box }).pieceAt([12, 1.5, 13], origin, 'e', [0, 0.6, -1.6], 0);
  assert.ok(near(slant.pos[2], 3 - decorWallOffset(0.3), 1e-3), 'a leaning wall is a wall');
});

test('WALL-CLEAR a flat (it turns to the eye) stands out from a wall by half its scaled width; the size reaches the placer from the tool (mutants: the width unread, the scale ignored, the tool\'s size unpassed)', () => {
  const pl = createDecorPlacer(torch, { radius: 0.2, flat: { w: 0.4, h: 0.8 } });
  assert.deepEqual(pl.pieceAt([12, 1.5, 13], origin, 't', [0, 0, -1], 0).pos, [2, 1.5, 3 - decorWallOffset(0.2)], 'half its width, five centimetres into the wall, its base at the eye\'s height');
  pl.rescale(true); pl.rescale(true);
  assert.ok(near(pl.pieceAt([12, 1.5, 13], origin, 't', [0, 0, -1], 0).pos[2], 3 - decorWallOffset(0.2 * 1.21), 1e-3), 'grown, further off');
  const src = readFileSync(new URL('../../../src/scenes/decor/decorTool.js', import.meta.url), 'utf8');
  const builds = src.match(/p\.placer = createDecorPlacer\(entry, \{[^}]*\}\);/g) ?? [];
  assert.equal(builds.length, 3, 'the three flat ghosts build their placers');
  for (const b of builds) assert.ok(b.includes('flat: p.flatSize'), `a flat's placer knows its size: ${b}`);
});

test('WALL-CLEAR the grid snaps a piece along the wall, never into it; a floor and a ceiling are as they were (mutants: the grid off the wall, a floor pushed, a ceiling pushed)', () => {
  const pl = createDecorPlacer(torch, { radius: 0.2, flat: { w: 0.4, h: 0.8 } });
  pl.toggleSnap();
  const s = pl.pieceAt([12.13, 1.37, 13.07], origin, 's', [0, 0, -1], 0);
  assert.deepEqual(s.pos, [2.25, 1.37, 2.92], 'snapped along the wall (x), five centimetres into it');
  assert.equal(s.pos[0] % DECOR_GRID, 0);
  const sx = pl.pieceAt([12.07, 1.37, 13.13], origin, 's', [-1, 0, 0], 0);
  assert.deepEqual(sx.pos, [1.92, 1.37, 3.25], 'a wall facing -x: snapped along z');
  // a floor: as DECOR1d had it
  const floor = createDecorPlacer(chair, { radius: 1, box });
  floor.toggleSnap();
  assert.deepEqual(floor.pieceAt([12.13, 0, 13.07], origin, 'f', [0, 1, 0], 0).pos, [2.25, 0.2, 3], 'a floor snaps across it and pushes nothing');
  assert.deepEqual(createDecorPlacer(chair, { radius: 1, box }).pieceAt([12.13, 0, 13.07], origin, 'f').pos, [2.13, 0.2, 3.07], 'no normal, no wall');
  // a ceiling: hung, as DECOR-SHELL had it
  assert.deepEqual(createDecorPlacer(chair, { radius: 1, box }).pieceAt([12, 3, 13], origin, 'h', [0, -1, 0], 0).pos, [2, 3 - 1.8, 3], 'hung from a ceiling, unpushed');
});
