// LADEN-REST (FIELD BUGS 2026-10-29b, "sometimes i cant moove, sometimes my bnoat begins to spin, sometimes it takes a
// direction and slowly waddles there"): the load slows her way and her helm, never her coming to rest. Come Sail Away
// scaled the rate a swing and a way are taken off by the load too, so a load at twice her hold (a mod of 0) kept the
// swing and the way she had when it was weighed, for good. The real runtime (test/csaScene.mjs). Mutants:
// tools/mutants/laden_rest.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';

const way = (s) => Math.hypot(...s.rt.state.MoveVectorCurrent);

test('LADEN-REST a swing and a way the load stopped dead are taken off - the rudder let go, the oars at rest - and she says why every round', () => {
  const s = scene();
  const b = s.helm(s.place(0));
  s.held.add('MoveRight');
  s.frame({ press: ['MoveForwards'] });
  for (let i = 0; i < 8; i++) s.frame();
  assert.ok(s.rt.state.TurnCurrent > 1, 'she swings to the rudder');
  assert.ok(way(s) > 0.5, 'and makes way at her oars');
  // weighed again with the pack past twice her hold: the mod's rates go to 0
  s.deps.entity.carriedWeight = () => 5000;
  const said = s.out.mid.length;
  s.rt.OnNewMagicRound();
  assert.equal(s.rt.state.boatCargoMod, 0);
  s.held.delete('MoveRight');
  s.frame({ press: ['MoveBackwards'] });   // the oars to rest
  for (let i = 0; i < 40; i++) s.frame();
  assert.equal(Math.abs(s.rt.state.TurnCurrent), 0, 'the rudder let go, her swing comes off');
  assert.equal(way(s), 0, 'the oars at rest, her way comes off');
  // and the load holds her: no way gathered, no swing
  s.held.add('MoveLeft');
  s.frame({ press: ['MoveForwards'] });
  for (let i = 0; i < 8; i++) s.frame();
  assert.equal(Math.abs(s.rt.state.TurnCurrent), 0, 'dead in the water: no swing gathered');
  assert.equal(way(s), 0, 'and no way');
  s.rt.OnNewMagicRound();
  assert.deepEqual(s.out.mid.slice(said).map(([t]) => t), ["You're going to need a bigger boat", "You're going to need a bigger boat"], 'said every round she lies dead');
  assert.ok(b);
});

test('LADEN-REST a light load is the mod to the letter: her swing comes off at the loaded rate', () => {
  const s = scene();
  s.helm(s.place(0));
  s.held.add('MoveRight');
  for (let i = 0; i < 8; i++) s.frame();
  s.deps.entity.carriedWeight = () => 0;
  s.rt.OnNewMagicRound();
  assert.equal(s.rt.state.boatCargoMod, 1);
  const before = s.rt.state.TurnCurrent;
  s.held.delete('MoveRight');
  s.frame();
  assert.ok(s.rt.state.TurnCurrent < before && s.rt.state.TurnCurrent >= 0, 'coming off');
});

test('LADEN-REST a laden helm still comes over at the load\'s rate - her swing\'s first step is the mod\'s share of a light one', () => {
  const step = (carried) => {
    const s = scene();
    s.deps.entity.carriedWeight = () => carried;
    s.helm(s.place(0));
    s.held.add('MoveRight');
    s.frame();
    return { turn: s.rt.state.TurnCurrent, mod: s.rt.state.boatCargoMod };
  };
  const light = step(0), laden = step(200);
  assert.equal(light.mod, 1);
  assert.ok(laden.mod > 0 && laden.mod < 1, `a part-laden hull (${laden.mod})`);
  assert.ok(Math.abs(laden.turn - light.turn * laden.mod) < 1e-4, `${laden.turn} is ${laden.mod} of ${light.turn}`);
});
