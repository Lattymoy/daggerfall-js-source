// OWN-AUDIT (2026-11-01; bible/03-World/Come-Sail-Away.md): THE THREE KEYS COME SAIL AWAY SHIPPED AND NEVER READ, MADE
// OURS - the bad tack (Handling.BadTack, BadTackMultiplier) and the gaff sails' assist (SailingAssist.AutoStowGaffSails),
// comeSailAway/sailAssist.js under the runtime - and the fourth, Compatibility.AnimatedWaterVertexWaves, retired.
// Mutants: tools/mutants/ownaudit_keys.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animatorOf } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { badTackShare, gaffFoul, BAD_TACK, GAFF_FOUL_DEG } from '../../../src/systems/comeSailAway/sailAssist.js';
import { MOD_SETTINGS, RETIRED_KEYS } from '../../../src/systems/modSettings.js';
import { quatRotate, quatAngleAxis } from '../../../src/world/quat.js';
import { scene } from '../../csaScene.mjs';

const near = (a, b, eps = 1e-5, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const stowed = (sail) => animatorOf(sail).GetBool('Stowed');
/** The wind blowing `deg` degrees off her bow's own way (0 a run, 180 dead into her teeth), at strength 1. */
const windOff = (deg) => quatRotate(quatAngleAxis(deg, [0, 1, 0]), [0, 0, 1]);

test('OWN-AUDIT BadTack: her way under sail keeps all of it to a beam reach, the multiplier close-hauled and past it, a line between - nothing with the switch off', () => {
  assert.deepEqual([BAD_TACK.fromDeg, BAD_TACK.fullDeg], [90, 135]);
  assert.equal(badTackShare(170, false, 0.8), 1, 'off: the mod to the letter');
  assert.equal(badTackShare(0, true, 0.8), 1, 'a run');
  assert.equal(badTackShare(90, true, 0.8), 1, 'a beam reach');
  near(badTackShare(112.5, true, 0.8), 0.9, 1e-12, 'half way: half the loss');
  near(badTackShare(135, true, 0.8), 0.8, 1e-12, 'close-hauled');
  near(badTackShare(-160, true, 0.5), 0.5, 1e-12, 'past it, either side');
  assert.equal(badTackShare(150, true, 3), 1, 'the multiplier held to 0..1');
});

test('OWN-AUDIT BadTack in the runtime: a boat close-hauled makes less way with the switch on, by its multiplier, and as much on a run - under the classic helm and the responsive one', () => {
  for (const handling of [undefined, 'responsive']) {
    const way = (deg, settings) => {
      const s = scene({ settings: { 'SailingAssist.AutoStowSquareSails': false, 'SailingAssist.AutoStowGaffSails': false, ...settings } });
      if (handling) s.deps.handling = () => handling;   // the helm's hand, taken as she is helmed (helmway.test.js's own)
      const boat = s.helm(s.place(1, 4));   // two gaffs and a staysail: fore-and-aft canvas that draws close-hauled
      s.rt.state.windVectorCurrent = windOff(deg);
      return s.rt.sailWayOf(boat);
    };
    const off = way(140, {});
    const on = way(140, { 'Handling.BadTack': true, 'Handling.BadTackMultiplier': 0.5 });
    assert.ok(off > 0, `${handling ?? 'classic'}: she makes way close-hauled`);
    near(on / off, 0.5, 1e-4, `${handling ?? 'classic'}: close-hauled, half her way`);
    near(way(20, { 'Handling.BadTack': true, 'Handling.BadTackMultiplier': 0.5 }), way(20, {}), 1e-6, `${handling ?? 'classic'}: on a run, all of it`);
  }
});

test('OWN-AUDIT AutoStowGaffSails: a gaff sail the wind would lay aback is not raised, is stowed while the wind is foul and set again when it frees - and with the assist off it is the mod\'s', () => {
  assert.equal(GAFF_FOUL_DEG, 150);
  assert.deepEqual([gaffFoul(149), gaffFoul(151), gaffFoul(-170)], [false, true, true]);
  const s = scene({ settings: { 'SailingAssist.AutoTrimming': false } });
  const boat = s.helm(s.place(1, 2));   // a large square and a gaff
  const gaff = boat.SailsGaff[0];
  assert.ok(gaff, 'the hull carries a gaff');
  s.rt.state.windVectorCurrent = windOff(175);   // nearly dead ahead: the gaff's angle to the wind past 150
  s.rt.RaiseSails();
  assert.equal(s.rt.state.sailPosition, 1, 'the sails are up');
  assert.equal(stowed(gaff), true, 'the gaff stays stowed in a foul wind');
  s.rt.state.windVectorCurrent = windOff(60);
  s.frame();
  assert.equal(stowed(gaff), false, 'the wind frees: the assist sets it');
  s.rt.state.windVectorCurrent = windOff(178);
  s.frame();
  assert.equal(stowed(gaff), true, 'and stows it again when it turns foul');
  const s2 = scene({ settings: { 'SailingAssist.AutoTrimming': false, 'SailingAssist.AutoStowGaffSails': false } });
  const b2 = s2.helm(s2.place(1, 2));
  s2.rt.state.windVectorCurrent = windOff(175);
  s2.rt.RaiseSails();
  s2.frame();
  assert.equal(stowed(b2.SailsGaff[0]), false, 'the assist off: the gaff is set and laid aback, as the mod leaves it');
});

test('OWN-AUDIT: the three keys say what they do, and Compatibility.AnimatedWaterVertexWaves - a mod the game has not got - is retired and let go from a saved file', () => {
  const keys = MOD_SETTINGS['come-sail-away'].keys;
  for (const k of ['Handling.BadTack', 'Handling.BadTackMultiplier', 'SailingAssist.AutoStowGaffSails']) assert.doesNotMatch(keys[k].description, /no effect/i, k);
  assert.equal(keys['Compatibility.AnimatedWaterVertexWaves'], undefined);
  assert.ok(RETIRED_KEYS.some((r) => r.vendor === 'come-sail-away' && r.key === 'Compatibility.AnimatedWaterVertexWaves'));
});
