// KETCH-LOOK KL3 (bible/11-Multiplayer/Sky-Ketch-Look.md "The PVS"): THE STEPS FOLLOW THE SHIP'S PVS (scenes/superDungeon/
// sdSteps.js `cull`): out of the eye's sight every draw they stood is `culled` - the dungeon loop's own flag, no draw and
// no shadow's record - and their ghosts draw nothing; back in it, every one drawn again; the law rides on whatever the eye
// sees. The ride takes the PVS's word (`seen`); a ride without one leaves it as it was, and the Hour never gives one.
// tools/mutants/ketch_look_law.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSdSteps } from '../../src/scenes/superDungeon/sdSteps.js';
import { KT_COURSE } from '../../src/net/ketch/ketchDeck.js';

const renderer = { createMesh: (m) => ({ m }), destroyMesh: () => {}, uploadTexture: () => {}, uploadEmissionTexture: () => {} };

test('KETCH-LOOK KL3 THE STEPS\' CULL: the Sailwalk out of sight culls every draw the Steps stood and none of anyone else\'s, its ghosts draw nothing, and its steps move, carry and stand as they did; back in sight every one drawn; a ride with no word keeps the last; a clear forgets it (mutants: a draw left out of the cull; the ghosts drawn while culled; the law stopped while culled)', () => {
  const theirs = { gpu: {}, object: { matrix: new Float32Array(16) } };
  const draws = [theirs];
  let asked = 0;   // the ghosts' pass is reached through the renderer's context: a culled Steps never asks for it
  const counting = { ...renderer, get gl() { asked++; return null; } };
  const a = createSdSteps({ renderer: counting, course: KT_COURSE, lite: false }), b = createSdSteps({ renderer, course: KT_COURSE, lite: false });
  a.stand({ dynamicDraws: draws, collider: null });
  b.stand({ dynamicDraws: [], collider: null });
  const mine = draws.slice(1);
  assert.ok(mine.length > 10, 'the Steps stood their draws');
  assert.ok(mine.every((d) => d.culled === undefined), 'nothing carries the flag until a PVS speaks');
  for (let t = 0; t < 30; t += 0.25) {
    a.ride(t, 0.25, null, true, t < 10 || t >= 20);
    b.ride(t, 0.25, null, true);
    const out = t >= 10 && t < 20;
    assert.equal(a.culled, out);
    assert.ok(mine.every((d) => !!d.culled === out), `every draw ${out ? 'culled' : 'drawn'} at ${t}`);
    assert.equal(theirs.culled, undefined, 'none of anyone else\'s');
    assert.deepEqual(a.steps.map((s) => [s.T, s.solid, s.matrix]), b.steps.map((s) => [s.T, s.solid, s.matrix]), `the law rides on at ${t}`);
  }
  a.ride(31, 0.25, null, true, false);
  a.ride(32, 0.25, null, true);
  assert.equal(a.culled, true, 'a ride with no word keeps the last');
  const I = new Float32Array(16), before = asked;
  assert.equal(a.drawPass(I, I), false);
  assert.equal(asked, before, 'no ghosts while culled');
  a.cull(false);
  a.drawPass(I, I);
  assert.ok(asked > before, 'the ghosts asked for once seen');
  a.cull(true);
  a.clear();
  assert.equal(a.culled, false, 'a clear forgets it');
  const again = [];
  a.stand({ dynamicDraws: again, collider: null });
  assert.ok(again.every((d) => !d.culled), 'stood again, all drawn');
  a.cull(true);
  assert.ok(again.every((d) => d.culled === true), 'the method itself');
});
