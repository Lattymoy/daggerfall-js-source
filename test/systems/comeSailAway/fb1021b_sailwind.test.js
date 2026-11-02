// FIELD BUGS 2026-10-21b SAIL-WIND (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md; src/systems/comeSailAway/csaLoadWind.js):
// "Sailing Vessels Sometimes Have No Propulsion" - "This is only with sails. Oars work fine." A save made below ground keeps
// the indoors' wind (none), and a load that lands outdoors - online a dungeon save wakes at a temple or town - restored it
// on the open sea: under sail a Small Ship crept 0.12 knots and a Large Boat made nothing, while her oars rowed as ever, until
// the game's next hour. Driven on the real runtime (test/csaScene.mjs, the real SpawnBoat and Animators), each save
// through JSON as the game's own save carries it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';
import { windStaleOutdoors } from '../../../src/systems/comeSailAway/csaLoadWind.js';

const mag = (v) => Math.hypot(...v);
const KN = 3600 / 1852;
const mk = (inside) => { const s = scene(); s.deps.handling = () => 'responsive'; s.world.inside = inside; return s; };
/** The save a runtime below ground makes - its door's OnTransition laid the indoors' none. */
function savedBelowGround() {
  const a = mk(true);
  a.rt.OnTransition();
  const save = JSON.parse(JSON.stringify(a.rt.getSaveData()));
  assert.deepEqual(save.windVector, { x: 0, y: 0, z: 0 }, 'the save keeps the indoors\' none');
  return save;
}
/** The save loaded into a fresh runtime standing `inside` - the restore, then OnLoad, as the world's mod loop runs them. */
function loaded(save, inside) {
  const s = mk(inside);
  s.rt.restoreSaveData(JSON.parse(JSON.stringify(save)));
  s.rt.OnLoad();
  return s;
}

test('SAIL-WIND: a save made below ground and loaded outdoors lays the outdoors\' wind - a Small Ship under sail makes way', () => {
  const s = loaded(savedBelowGround(), false);
  assert.ok(mag(s.rt.state.windVectorCurrent) > 0.05, 'a wind outdoors');
  const boat = s.helm(s.place(2, 0));   // the Small Ship
  s.frame();
  s.frame({ press: ['MoveForwards'] });   // W, W: a quarter second at the oars, then sail
  s.frame({ press: ['MoveForwards'] });
  for (let t = 0; t < 10; t += 0.25) s.frame();
  assert.equal(s.rt.helmPanelState().sailsUp, true);
  assert.ok(s.rt.helmPanelState().way * KN > 2, `under sail at ${(s.rt.helmPanelState().way * KN).toFixed(2)} kn (it held 0.12)`);
  assert.ok(mag(boat.GameObject.position) > 0);
});

test('SAIL-WIND: the Large Boat raised from rest makes way (it made nothing)', () => {
  const s = loaded(savedBelowGround(), false);
  s.helm(s.place(1, 0));
  s.frame();
  s.rt.ToggleSails();
  for (let t = 0; t < 10; t += 0.25) s.frame();
  assert.equal(s.rt.helmPanelState().sailsUp, true);
  assert.ok(s.rt.helmPanelState().way * KN > 1, `${(s.rt.helmPanelState().way * KN).toFixed(2)} kn`);
});

test('SAIL-WIND: a load that stands indoors keeps the indoors\' none, and a load outdoors keeps the wind its save carried', () => {
  assert.deepEqual(loaded(savedBelowGround(), true).rt.state.windVectorCurrent, [0, 0, 0], 'indoors: none, as the mod\'s');
  const out = mk(false);
  out.rt.OnNewHour();
  const save = JSON.parse(JSON.stringify(out.rt.getSaveData()));
  const kept = [save.windVector.x, save.windVector.y, save.windVector.z];
  assert.ok(mag(kept) > 0);
  assert.deepEqual(loaded(save, false).rt.state.windVectorCurrent, kept, 'a wind restored outdoors stands - no roll over it');
});

test('SAIL-WIND: the stale wind is the outdoors\' nought alone', () => {
  assert.equal(windStaleOutdoors(false, [0, 0, 0]), true);
  assert.equal(windStaleOutdoors(true, [0, 0, 0]), false, 'indoors none is the law');
  assert.equal(windStaleOutdoors(false, [0.1, 0, 0]), false, 'a fog\'s least wind stands');
  assert.equal(windStaleOutdoors(false, [0, 0, -0.2]), false);
});
