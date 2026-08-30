import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HudFlicker, HudFlickerController, playerCondition, INJURED_THRESHOLD, WOUNDED_THRESHOLD } from '../src/ui/hudFlicker.js';
import { LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W2d: THE NEAR-DEATH WARNING (HUDFlickerController.cs + the
// three HUDFlicker*.cs), a default-ON DFU feature the port had nothing
// behind: below 40% health a fast red flicker on every new loss, seven
// reversals and out; below 20% a slow throb between bursts. The colour
// is the HUD's parent-panel background, so it draws as a quad under the
// bars. Pure, with dt and the roll injected.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const never = () => 1;   // Random.Range(0,1) < chance never true

test('AUDIT 28 W2d: GetPlayerCondition - Dead at <= 0, then the two thresholds on percent, strictly below', () => {
  assert.equal(INJURED_THRESHOLD, 0.4); assert.equal(WOUNDED_THRESHOLD, 0.2);
  assert.equal(playerCondition(0, 100), 'Dead');
  assert.equal(playerCondition(-5, 100), 'Dead');
  assert.equal(playerCondition(19, 100), 'Wounded');
  assert.equal(playerCondition(20, 100), 'Injured', '20% is NOT below 0.2');
  assert.equal(playerCondition(39, 100), 'Injured');
  assert.equal(playerCondition(40, 100), 'Normal', '40% is NOT below 0.4');
  assert.equal(playerCondition(100, 100), 'Normal');
});

test('AUDIT 28 W2d: the Init tables are HUDFlickerFast / HUDFlickerSlow verbatim', () => {
  const f = new HudFlicker('fast');
  assert.deepEqual([f.alphaSpeed, f.alphaLower, f.alphaUpper, f.redValue, f.alphaValue, f.reversalCountThreshold], [7.0, 0.0, 0.4, 0.3984, 0.0, 7]);
  const s = new HudFlicker('slow');
  assert.deepEqual([s.alphaSpeed, s.alphaLower, s.alphaUpper, s.redValue, s.alphaValue, s.reversalCountThreshold], [0.2, 0.1, 0.4, 0.0, 0.1, -1]);
  assert.equal(f.isTimedOut, false); assert.equal(s.isTimedOut, false);
});

test('AUDIT 28 W2d: the fast flicker climbs at 7/s to 0.4, reverses at the bounds, and times out after seven reversals', () => {
  const f = new HudFlicker('fast');
  f.cycle(0.02, never);
  assert.ok(Math.abs(f.alphaValue - 0.14) < 1e-9, `first step 7 * 0.02 = 0.14, got ${f.alphaValue}`);
  f.cycle(0.02, never); f.cycle(0.02, never);
  assert.equal(f.alphaValue, 0.4, 'clamped to alphaUpper');
  assert.equal(f.reversalCount, 0, 'the reversal is checked BEFORE the step, so the clamp frame does not reverse');
  f.cycle(0.02, never);
  assert.equal(f.reversalCount, 1, 'at the upper bound the next cycle reverses');
  assert.ok(f.alphaValue < 0.4, 'and steps down');
  // Run it out: seven reversals -> timed out -> alpha 0 and stays.
  let n = 0;
  while (!f.isTimedOut && n++ < 10000) f.cycle(0.02, never);
  assert.equal(f.isTimedOut, true);
  // Cycle sets IsTimedOut and STILL runs CheckReverseAlphaDirection on
  // that frame (:92-97), so the count can land on 8 - the eighth being
  // the bound reversal of the timing-out frame. Verbatim, not a bug.
  assert.ok(f.reversalCount >= 7 && f.reversalCount <= 8, `reversals ${f.reversalCount}`);
  f.cycle(0.02, never);
  assert.equal(f.alphaValue, 0, 'a timed-out flicker is SetAlphaValue(0)');
});

test('AUDIT 28 W2d: the slow throb never times out on its own, and the random reversal waits then fires', () => {
  const s = new HudFlicker('slow');
  for (let i = 0; i < 5000; i++) s.cycle(0.02, never);
  assert.equal(s.isTimedOut, false);
  assert.ok(s.reversalCount > 10, 'it has been bouncing between 0.1 and 0.4');
  // RandomlyReverseAlphaDirection: chance starts at 0 and climbs 0.008/s;
  // a roll of 0 fires the moment the chance is positive, and the chance
  // resets to -0.01 so it cannot fire again at once.
  const r = new HudFlicker('slow');
  r.alphaValue = 0.25;   // inside the band, so the random arm runs
  r.cycle(0.5, () => 0);
  assert.equal(r.reversalCount, 1, 'fired');
  assert.equal(r.chanceReverseState, -0.01);
  r.cycle(0.5, () => 0);
  assert.equal(r.reversalCount, 1, 'not again until the chance climbs back past zero');
  r.cycle(1.0, () => 0);   // -0.01 + 0.008 * 1.5 total = 0.002 > 0
  assert.equal(r.reversalCount, 2);
  // SetAlphaValue clamps to [0, alphaUpper] - NOT to alphaLower - so a
  // decreasing step may overshoot the lower bound by one frame before
  // the bound check reverses it (0.101 - 0.2 * 0.02 = 0.097).
  const o = new HudFlicker('slow');
  o.alphaValue = 0.101; o.alphaDirection = 1;   // Decreasing
  o.cycle(0.02, never);
  assert.ok(Math.abs(o.alphaValue - 0.097) < 1e-9, `overshoot below alphaLower, got ${o.alphaValue}`);
});

test('AUDIT 28 W2d: NextCycle - the setting gates it, Normal clears, Injured runs the fast flicker on a loss, Wounded hands over to the slow throb', () => {
  const c = new HudFlickerController();
  assert.equal(c.nextCycle({ health: 10, maxHealth: 100, healthLost: 5, dt: 0.02, enabled: false, rolls: never }), null, 'setting off: no write');
  assert.equal(c.nextCycle({ health: 10, maxHealth: 100, healthLost: 5, dt: 0.02, fadeInProgress: true, rolls: never }), null);
  assert.equal(c.nextCycle({ health: 10, maxHealth: 100, healthLost: 5, dt: 0.02, parentAlpha: 0.95, rolls: never }), null);
  assert.deepEqual(c.nextCycle({ health: 90, maxHealth: 100, healthLost: 0, dt: 0.02, rolls: never }), [0, 0, 0, 0], 'Normal: the default arm clears');
  // Injured: fast red, alpha climbing.
  const inj = c.nextCycle({ health: 30, maxHealth: 100, healthLost: 3, dt: 0.02, rolls: never });
  assert.equal(inj[0], 0.3984); assert.ok(inj[3] > 0);
  // Run the fast flicker out, then a fresh loss restarts it (HealthLost > 0 && IsTimedOut -> Init).
  for (let i = 0; i < 400; i++) c.nextCycle({ health: 30, maxHealth: 100, healthLost: 0, dt: 0.02, rolls: never });
  assert.equal(c.fast.isTimedOut, true);
  assert.deepEqual(c.backColor, [0.3984, 0, 0, 0], 'timed out: red at alpha 0');
  c.nextCycle({ health: 25, maxHealth: 100, healthLost: 5, dt: 0.02, rolls: never });
  assert.equal(c.fast.isTimedOut, false, 'a new loss restarts the fast flicker');
  // Wounded: while the fast burst runs the colour is the fast one; once it times out, the slow throb's.
  const w = new HudFlickerController();
  const first = w.nextCycle({ health: 10, maxHealth: 100, healthLost: 5, dt: 0.02, rolls: never });
  assert.equal(first[0], 0.3984, 'fast burst first');
  assert.equal(w.slow.isTimedOut, true, 'the slow throb is held while the fast one runs');
  for (let i = 0; i < 400; i++) w.nextCycle({ health: 10, maxHealth: 100, healthLost: 0, dt: 0.02, rolls: never });
  const later = w.backColor;
  assert.equal(later[0], 0.0, 'then the slow throb (red 0)');
  assert.ok(later[3] >= 0.1 - 1e-9 && later[3] <= 0.4 + 1e-9, `throbbing in [0.1, 0.4], got ${later[3]}`);
  // A gain while NOT Wounded times the slow throb out; while Wounded it does not.
  w.nextCycle({ health: 12, maxHealth: 100, healthLost: -2, dt: 0.02, rolls: never });
  assert.equal(w.slow.isTimedOut, false, 'Wounded: a gain does not stop the throb');
  // Dead: nothing is written, the last colour stands.
  const before = [...w.backColor];
  assert.equal(w.nextCycle({ health: 0, maxHealth: 100, healthLost: 12, dt: 0.02, rolls: never }), null);
  assert.deepEqual(w.backColor, before);
});

test('AUDIT 28 W2d: drawn as the parent panel\'s tint UNDER the bars in both HUD branches, off the detector\'s HealthLost', () => {
  const hud = read('src/ui/hud.js');
  const large = hud.indexOf('const largeRig = updateHudVitals(true, cur, dt, cursorActive);');
  const largeFlicker = hud.indexOf('drawNearDeathFlicker(renderer, canvas, cur, cursorActive ? 0 : dt);', large);
  const largeDraw = hud.indexOf('lastLargeHudBar = drawHudLarge(', large);
  assert.ok(large > 0 && largeFlicker > large && largeDraw > largeFlicker, 'large HUD: detector, tint, then the bar');
  const small = hud.indexOf('const rig = updateHudVitals(false, cur, dt, cursorActive);');
  const smallFlicker = hud.indexOf('drawNearDeathFlicker(renderer, canvas, cur, cursorActive ? 0 : dt);', small);
  assert.ok(small > 0 && smallFlicker > small && smallFlicker - small < 200, 'small HUD: the tint right after the detector, before the bars');
  assert.match(hud, /healthLost: lastHealthLost\(\)/);
  // F-A6: a paused frame steps the flicker with dt 0, as Time.timeScale
  // holds DFU's - both branches.
  assert.equal((hud.match(/drawNearDeathFlicker\(renderer, canvas, cur, cursorActive \? 0 : dt\)/g) || []).length, 2);
  assert.match(hud, /enabled: getBool\('Enhancements', 'NearDeathWarning'\)/);
  assert.match(read('src/ui/hudVitals.js'), /_lastHealthLost = ev\.health\?\.lost \?\? 0;/);
  assert.equal(LIVE['Enhancements/NearDeathWarning'], 'src/ui/hud.js');
});
