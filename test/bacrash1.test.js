// BA-CRASH1 (2026-09-20, Mac's screenshot: CRASH TypeError: Cannot read properties of null (reading 'exitPos') at
// betterAmbience's frame). LEAVING A DUNGEON INTO RAIN CRASHED THE TAB.
//
// `onTransition` replaced the place and stopped the rain loop, but `rainKind` - 'exit', the answer for the dungeon
// just left - stayed until settle4() recomputed it four frames later. In those four frames `frame()` saw a kind, a
// weather that differed from the stopped loop's (null), and asked updateSource() for the 3D source at
// `place.dungeon.exitPos` with `place.dungeon` already null. The kind goes with the place now; settle makes it again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBetterAmbience, readBetterAmbienceSettings, TRANSITION_WAIT_FRAMES, BETTER_AMBIENCE_VENDOR } from '../src/systems/betterAmbience.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[BETTER_AMBIENCE_VENDOR].keys).map(([k, d]) => [k, d.default]));

function rig(weather) {
  const store = { ...defaults() };
  const loops = [], loops3d = [];
  const audio = {
    registerSound: async () => true, playOneShot: () => {},
    loop: (k, v, o) => { const l = { k, v, o, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; },
    loop3d: (k, pos, v, o) => { const l = { k, pos, v, o, stopped: false, stop() { this.stopped = true; } }; loops3d.push(l); return l; },
    setReverb: () => true,
  };
  const w = { word: weather };
  const c = createBetterAmbience({ audio, settings: () => readBetterAmbienceSettings(() => store), random: () => 0, weather: () => w.word, fetchClip: async () => new Uint8Array([1]), snowFree: () => false });
  const entity = { items: [], activeEffects: [], maxHealth: 100 };
  const m = (o) => ({ entity, inside: false, inBuilding: false, inDungeon: false, grounded: true, standingStill: true, isRunning: false, movingLessThanHalfSpeed: true, levitating: false, swimming: false, motorSwimming: false, pos: [0, 0, 0], centreY: 0.9, waterSurfaceY: null, onExteriorWater: false, onExteriorWaterAny: false, onExteriorPath: false, onStaticGeometry: false, onFoot: true, winter: false, climateIndex: 231, loadInProgress: false, ...o });
  return { c, w, loops, loops3d, outdoors: () => m({}), dungeon: () => m({ inside: true, inDungeon: true }), building: () => m({ inside: true, inBuilding: true }) };
}

test('BA-CRASH1: out of a dungeon into rain - the four wait frames neither throw nor start a source, and after the wait outdoors has no rain source at all (mutant: the kind not dropped with the place, which is the crash verbatim)', async () => {
  const r = rig('rain');
  r.c.frame(0, r.outdoors()); await r.c.settle();
  const d = { regionName: 'Daggerfall', name: 'Privateer\'s Hold', inCastle: () => false, exitPos: [1, 2, 3] };
  r.c.onTransition({ dungeon: d }); r.c.settleTransition();
  r.c.frame(0.016, r.dungeon());
  assert.equal(r.loops3d.length, 1, 'in the dungeon, raining: the 3D source at the exit'); assert.deepEqual(r.loops3d[0].pos, [1, 2, 3]);
  // THE STEP OUT: the host says the place is the country now (no dungeon, no building); it is still raining
  r.c.onTransition({ dungeon: null, building: false });
  assert.equal(r.loops3d[0].stopped, true, 'the dungeon\'s source stopped with the place');
  for (let i = 0; i < TRANSITION_WAIT_FRAMES + 1; i++) assert.doesNotThrow(() => r.c.frame(0.016, r.outdoors()), `frame ${i} after the step out`);
  assert.equal(r.loops3d.length, 1, 'no second 3D source - there is no exit to put one at');
  assert.equal(r.loops.length, 0, 'and no 2D one - outdoors is not a building');
  assert.equal(r.c.status().rain, null);
  // the weather turning while outdoors changes nothing either
  r.w.word = 'sunny'; r.c.frame(0.016, r.outdoors()); r.w.word = 'thunder'; r.c.frame(0.016, r.outdoors());
  assert.equal(r.loops3d.length, 1); assert.equal(r.loops.length, 0);
  // and the kind is made again at the next place: a building in the rain has its 2D source
  r.c.onTransition({ dungeon: null, building: true }); r.c.settleTransition(); r.c.frame(0.016, r.building());
  assert.equal(r.loops.length, 1, 'a building: the interior source'); assert.equal(r.loops[0].k, 'ba:AmbientRaining');
  // and a dungeon again: the 3D source, at ITS exit
  r.c.onTransition({ dungeon: { ...d, exitPos: [7, 8, 9] } }); r.c.settleTransition(); r.c.frame(0.016, r.dungeon());
  assert.equal(r.loops3d.length, 2); assert.deepEqual(r.loops3d[1].pos, [7, 8, 9]);
  assert.equal(r.loops[0].stopped, true, 'the building\'s source stopped with the place');
});

test('BA-CRASH1: the same step out through the LOAD path - onLoad keeps the place, so a stale kind cannot come from there; a transition that lands in a dungeon with no exit starts nothing', async () => {
  const r = rig('rain');
  r.c.frame(0, r.outdoors()); await r.c.settle();
  r.c.onTransition({ dungeon: { regionName: 'x', name: 'y', inCastle: () => false, exitPos: null } }); r.c.settleTransition();
  for (let i = 0; i < 3; i++) assert.doesNotThrow(() => r.c.frame(0.016, r.dungeon()));
  assert.equal(r.loops3d.length, 0, 'GameObject.Find("DungeonExit") found none: no source');
  r.c.onLoad();
  for (let i = 0; i < TRANSITION_WAIT_FRAMES + 1; i++) assert.doesNotThrow(() => r.c.frame(0.016, r.dungeon()));
  assert.equal(r.loops3d.length, 0);
});
