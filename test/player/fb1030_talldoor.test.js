// FIELD BUGS 2026-10-30b TALL-DOOR (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 6): Torval's castle - "on
// exiting the place it teleports you in the air on one or both of the doors". DFU's way out stands the body's centre at
// the lowest dungeon door's centre (StreamingWorld.PositionPlayerToDungeonExit, RepositionPlayer); the Mane's palace door
// is 9 m tall, so its centre less half a body stood the feet 3.6 m over the plaza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeonExitFeet, dungeonEntranceLanding, repositionFeetY } from '../../src/player/enterExit.js';
import { getStaticDoors } from '../../src/world/staticDoors.js';
import { buildManePalace } from '../../src/world/capitalTorval.js';
import { northward } from '../../src/world/capitalModels.js';
import { trs } from '../../src/world/mat4.js';

/** An exterior collider: the terrain at `ground`, and a level floor (a plaza's, a step's) over [x0, z0, x1, z1] at `deck`. */
const collider = (ground, deck = null) => ({
  heightAt: () => ground,
  raycast: (o, d, max) => (deck && o[0] >= deck[0] && o[0] <= deck[2] && o[2] >= deck[1] && o[2] <= deck[3] && o[1] >= deck[4] && o[1] - deck[4] <= max ? o[1] - deck[4] : Infinity),
});

test('TALL-DOOR the way out of a dungeon lands on the floor before its door: before a 9 m door (Torval\'s castle, past the Bay) the feet stand on the street, not 3.6 m over it; before a classic door on the Bay as DFU stands them, a hand over the street; never under the terrain (mutants: DFU\'s centre law alone; the floor unread)', () => {
  // the Mane's own palace and its door, turned north as the capital stands it, at a plaza 1 m over the terrain at 0
  const palace = northward(buildManePalace());
  const at = trs(100, 1, 200, 0, 0, 0);
  const doors = getStaticDoors(palace, 0, 0, at).map((d) => ({ ...d, doorType: d.doorType }));
  const landing = dungeonEntranceLanding(doors);
  assert.ok(landing.pos[1] > 5, `the door's centre stands high (${landing.pos[1].toFixed(2)} m)`);
  const plaza = collider(0, [0, 0, 400, 400, 1]);
  assert.ok(repositionFeetY(0, landing.pos[1]) > 4, 'DFU\'s law: 3.6 m over the plaza (the report)');
  assert.equal(dungeonExitFeet(plaza, landing), 1, 'on the plaza');
  // a classic door 2.3 m tall on the Bay, on bare terrain: DFU's own hand over the street
  const classic = { pos: [0, 1.15, 0.45], normal: [0, 0, 1] };
  assert.equal(dungeonExitFeet(collider(0), classic), 0.15, 'the terrain\'s floor, as RepositionPlayer will not let a body under it');
  assert.ok(Math.abs(dungeonExitFeet(collider(0, [-5, -5, 5, 5, 0.1]), classic) - 0.15) < 1e-9, 'a sill under the classic door changes nothing');
  assert.equal(dungeonExitFeet(collider(3), classic), 3.15, 'never under the terrain');
});
