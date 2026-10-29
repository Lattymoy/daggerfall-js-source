// LADEN-REST (FIELD BUGS 2026-10-29b, "sometimes i cant moove, sometimes my bnoat begins to spin, sometimes it takes a
// direction and slowly waddles there"): the load slows her way and her helm, never her coming to rest. Come Sail Away
// scaled the rate a swing and a way are taken off by the load too, so a load at twice her hold (a mod of 0) kept the
// swing and the way she had when it was weighed, for good. The real runtime (test/csaScene.mjs). AUDIT FB1029B S1, S2,
// S5, S6: a helm put against her swing, the Responsive helm, her canvas, a slide, and an empty Carrack under Classic.
// Mutants: tools/mutants/laden_rest.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';
import { BOAT_ACTIONS } from '../../../src/systems/comeSailAway/comeSailAway.js';

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

/** A hull swinging at her light rate, then weighed to `carried` - the frames it takes her swing to come to 0. */
function swingOff(carried, { against = false, handling = null } = {}) {
  const s = scene();
  if (handling) s.deps.handling = () => handling;
  s.helm(s.place(0));
  s.held.add('MoveRight');
  for (let i = 0; i < 12; i++) s.frame();
  s.deps.entity.carriedWeight = () => carried;
  s.rt.OnNewMagicRound();
  s.held.delete('MoveRight');
  if (against) s.held.add('MoveLeft');
  let n = 0;
  while (s.rt.state.TurnCurrent > 0 && n < 400) { s.frame(); n++; }
  return { n, mod: s.rt.state.boatCargoMod };
}

test('LADEN-REST (AUDIT FB1029B S1) a laden swing comes off as fast as a light one - let go or with the helm put against it, part laden and dead, Classic and Responsive', () => {
  for (const handling of [null, 'responsive']) {
    const light = { go: swingOff(0, { handling }).n, counter: swingOff(0, { against: true, handling }).n };
    for (const carried of [250, 5000]) {
      const go = swingOff(carried, { handling }), counter = swingOff(carried, { against: true, handling });
      assert.ok(go.mod < 0.5, `laden (${go.mod})`);
      assert.ok(go.n <= light.go, `${handling ?? 'classic'} at ${go.mod}: let go in ${go.n} frames, light ${light.go}`);
      assert.ok(counter.n <= light.counter, `${handling ?? 'classic'} at ${go.mod}: counter-rudder in ${counter.n} frames, light ${light.counter}`);
    }
  }
});

test('LADEN-REST (AUDIT FB1029B S1) past 0 the swing the other way gathers at the load\'s rate - the light rate takes her to 0 and no further', () => {
  const step = (carried) => {
    const s = scene();
    s.helm(s.place(0));
    s.held.add('MoveRight');
    for (let i = 0; i < 12; i++) s.frame();
    s.deps.entity.carriedWeight = () => carried;
    s.rt.OnNewMagicRound();
    s.held.delete('MoveRight');
    s.frame();   // let go a frame: her swing off the counter's own steps, so the last one crosses 0
    s.held.add('MoveLeft');
    while (s.rt.state.TurnCurrent > 0) s.frame();
    const at = s.rt.state.TurnCurrent;
    s.frame();
    return { at, next: -s.rt.state.TurnCurrent };
  };
  const light = step(0), laden = step(250);
  assert.equal(Math.abs(laden.at), 0, 'the light rate stops at 0');
  assert.ok(laden.next > 0 && laden.next < light.next, `then the other way at the load's rate: ${laden.next} against a light ${light.next}`);
});

test('LADEN-REST under her canvas on the Responsive helm: a way the load stopped dead comes off, her sails still set', () => {
  const s = scene();
  s.deps.handling = () => 'responsive';
  const b = s.helm(s.place(2));
  const wind = () => { s.rt.state.windVectorCurrent = [1.5, 0, 0]; s.rt.state.windVectorTarget = [1.5, 0, 0]; };
  wind();
  s.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s.rt.state.sailPosition, 1, 'her sail set');
  for (let i = 0; i < 40; i++) { wind(); s.frame(); }
  assert.ok(way(s) > 0.5, `she makes way under sail (${way(s)})`);
  s.deps.entity.carriedWeight = () => 50000;
  s.rt.OnNewMagicRound();
  assert.equal(s.rt.state.boatCargoMod, 0);
  for (let i = 0; i < 200; i++) { wind(); s.frame(); }
  assert.equal(s.rt.state.sailPosition, 1, 'her canvas still set');
  assert.equal(way(s), 0, 'and her way off');
  assert.ok(b);
});

test('LADEN-REST (AUDIT FB1029B S5) a slide wanted across her way gathers at the load\'s rate, never the light one', () => {
  const slide = (carried) => {
    const s = scene();
    s.helm(s.place(0));
    s.frame({ press: ['MoveForwards'] });
    for (let i = 0; i < 20; i++) s.frame();
    s.deps.entity.carriedWeight = () => carried;
    s.rt.OnNewMagicRound();
    s.held.add('Run'); s.held.add('MoveRight');
    const v0 = [...s.rt.state.MoveVectorCurrent];
    s.frame();
    return { gain: Math.hypot(...s.rt.state.MoveVectorCurrent.map((v, i) => v - v0[i])), mod: s.rt.state.boatCargoMod };
  };
  const light = slide(0), laden = slide(250);
  assert.ok(light.gain > 0 && laden.mod > 0 && laden.mod < 1, `${light.gain} ${laden.mod}`);
  assert.ok(laden.gain <= light.gain * laden.mod + 1e-4, `her way's step into the slide, ${laden.gain}, is no more than ${laden.mod} of a light one (${light.gain})`);
});

test('LADEN-REST (AUDIT FB1029B S2) the dead hull\'s word is said again only while she is asked to move, and never for a hull with no hold', () => {
  const words = (hull, { ahead }) => {
    const s = scene();
    s.deps.entity.carriedWeight = () => (hull === 4 ? 0 : 5000);
    s.helm(s.place(hull));
    if (ahead) s.frame({ press: ['MoveForwards'] });
    const from = s.out.mid.length;
    for (let i = 0; i < 4; i++) s.rt.OnNewMagicRound();
    return s.out.mid.slice(from).length;
  };
  assert.equal(words(0, { ahead: true }), 4, 'asked to move: every round');
  assert.equal(words(0, { ahead: false }), 0, 'at rest: once, at the helm');
  assert.equal(words(4, { ahead: true }), 0, 'the Carrack under Classic has no hold - the mod\'s own, never said every round');
});

test('LADEN-REST her oars still pulling ahead when the load stops her dead: her way comes off all the same', () => {
  const s = scene();
  s.helm(s.place(0));
  s.frame({ press: ['MoveForwards'] });
  for (let i = 0; i < 20; i++) s.frame();
  assert.ok(way(s) > 0.5);
  s.deps.entity.carriedWeight = () => 5000;
  s.rt.OnNewMagicRound();
  assert.equal(s.rt.state.oarThrottle, 1, 'the oars still at their rung');
  for (let i = 0; i < 40; i++) s.frame();
  assert.equal(way(s), 0);
});

test('LADEN-REST under her canvas a laden hull comes on at the load\'s rate - her way and her helm (AUDIT FB1029B T3)', () => {
  const under = (carried) => {
    const s = scene();
    s.deps.handling = () => 'responsive';
    s.deps.entity.carriedWeight = () => carried;
    s.helm(s.place(2));
    const wind = () => { s.rt.state.windVectorCurrent = [1.5, 0, 0]; s.rt.state.windVectorTarget = [1.5, 0, 0]; };
    wind();
    s.frame({ press: [BOAT_ACTIONS.toggleSail] });
    const w0 = way(s);
    wind(); s.frame();
    const wayStep = way(s) - w0;
    s.held.add('MoveRight');
    const t0 = s.rt.state.TurnCurrent;
    wind(); s.frame();
    return { wayStep, turnStep: s.rt.state.TurnCurrent - t0, mod: s.rt.state.boatCargoMod };
  };
  const light = under(0), laden = under(1300);
  assert.ok(laden.mod > 0 && laden.mod < 1 && light.wayStep > 0 && light.turnStep > 0, JSON.stringify({ light, laden }));
  assert.ok(laden.wayStep <= light.wayStep * laden.mod + 1e-4, `her way comes on at ${laden.wayStep}, no more than ${laden.mod} of ${light.wayStep}`);
  assert.ok(laden.turnStep <= light.turnStep * laden.mod + 1e-4, `her helm comes over at ${laden.turnStep}, no more than ${laden.mod} of ${light.turnStep}`);
});
