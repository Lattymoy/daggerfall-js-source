// VB1 - THE VITALS INDICATORS (F148) + THE COLOUR SWAP (F149).
// HUDVitals.cs, VerticalProgressSmoother.cs, VitalsChangeDetector.cs
// (MIT, Daggerfall Workshop), ported whole into ui/hudVitals.js.
// EnableVitalsIndicators ships TRUE, so the damage trail is the
// DEFAULT look and the old three plain bars were the setting-FALSE
// path all along.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HEALTH_LOSS_COLOR, FATIGUE_LOSS_COLOR, MAGICKA_LOSS_COLOR,
  HEALTH_GAIN_COLOR, FATIGUE_GAIN_COLOR, MAGICKA_GAIN_COLOR,
  SMOOTH_TIMER_MAX, VITAL_KEYS,
  createSmoother, beginSmoothChange, cycleSmoother,
  createVitalsDetector, detectVitals,
  createVitalsRig, synchronizeImmediately, applyVitalsChange, updateAllVitals,
  updateHudVitals, _resetHudVitals, vitalsSkin, drawVitalsBars,
} from '../src/ui/hudVitals.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { drawHud } from '../src/ui/hud.js';
import { drawHudLarge } from '../src/ui/hudLarge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

const recorder = () => {
  const quads = [];
  return { quads, drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, uv, color }) };
};

// ---------------------------------------------------------------
// 1. THE SMOOTHER (VerticalProgressSmoother.cs, whole)
// ---------------------------------------------------------------

test('VB1 smoother: the first change waits half a second, a re-trigger only a quarter', () => {
  const bar = createSmoother();
  assert.equal(bar.amount, 1, 'VerticalProgress.Amount defaults to 1');
  beginSmoothChange(bar, 0.5);
  assert.equal(bar.cycleTimer, true);
  assert.equal(bar.timer, -0.5, 'cold entry: timer = -0.5 (:26)');
  beginSmoothChange(bar, 0.25);
  assert.equal(bar.timer, -0.25, 're-trigger mid-cycle: timer = -0.25 (:29)');
  assert.equal(bar.prev, 1, 'prev is captured from the CURRENT amount');
  assert.equal(bar.target, 0.25);
});

test('VB1 smoother: nothing moves until the timer climbs to zero, then a 0.4s lerp', () => {
  assert.equal(SMOOTH_TIMER_MAX, 0.4, 'timerMax (:14)');
  const bar = createSmoother();
  bar.amount = 1;
  beginSmoothChange(bar, 0);
  cycleSmoother(bar, 0.4);   // timer -0.5 -> -0.1, still negative
  assert.equal(bar.amount, 1, 'the delay holds the bar still');
  cycleSmoother(bar, 0.3);   // timer 0.2 -> t = 0.5
  assert.ok(Math.abs(bar.amount - 0.5) < 1e-9, 'halfway through the lerp at t=0.5');
  assert.equal(bar.cycleTimer, true, 'still armed before timerMax');
  cycleSmoother(bar, 0.2);   // timer 0.4 -> t = 1, disarm
  assert.equal(bar.amount, 0);
  assert.equal(bar.cycleTimer, false, 'reaching timerMax disarms (:47-48)');
  cycleSmoother(bar, 1);
  assert.equal(bar.amount, 0, 'a disarmed smoother ignores Cycle (:37-38)');
});

// ---------------------------------------------------------------
// 2. THE DETECTOR (VitalsChangeDetector.cs, whole)
// ---------------------------------------------------------------

const CUR = (health, fatigue = 100, magicka = 40) =>
  ({ health, maxHealth: 50, fatigue, maxFatigue: 200, magicka, maxMagicka: 40 });

test('VB1 detector: the first update RESETS rather than reporting the whole bar as a change', () => {
  const det = createVitalsDetector();
  const r = detectVitals(det, CUR(50));
  assert.equal(r.reset, true, "Start()'s ResetVitals");
  assert.equal(r.health, null);
  const r2 = detectVitals(det, CUR(50));
  assert.deepEqual([r2.reset, r2.health, r2.fatigue, r2.magicka], [false, null, null, null],
    'no change, no events (:104-117)');
});

test('VB1 detector: Lost = previous - current, LostPercent = Lost / max, previous advances', () => {
  const det = createVitalsDetector();
  detectVitals(det, CUR(50));
  const r = detectVitals(det, CUR(40, 150, 40));
  assert.deepEqual(r.health, { lost: 10, lostPercent: 10 / 50 });
  assert.deepEqual(r.fatigue, { lost: -50, lostPercent: -50 / 200 }, 'a GAIN is a negative Lost');
  assert.equal(r.magicka, null, 'the unchanged vital fires no event');
  const r2 = detectVitals(det, CUR(40, 150, 40));
  assert.equal(r2.health, null, 'previous = current at the tail (:120-122)');
});

test('VB1 detector: ANY max change resets and reports nothing that frame (:74-78)', () => {
  const det = createVitalsDetector();
  detectVitals(det, CUR(50));
  const r = detectVitals(det, { ...CUR(40), maxHealth: 60 });
  assert.equal(r.reset, true, 'the relative-loss calculation is not valid when Max changes');
  assert.equal(r.health, null, 'the drop from 50 to 40 is swallowed by the reset');
  const r2 = detectVitals(det, { ...CUR(35), maxHealth: 60 });
  assert.deepEqual(r2.health, { lost: 5, lostPercent: 5 / 60 }, 'and deltas resume against the new max');
});

// ---------------------------------------------------------------
// 3. THE RIG (HUDVitals.cs change handlers + Update)
// ---------------------------------------------------------------

test('VB1 rig: a LOSS drops the main bar at once and the dark trail lags behind it', () => {
  const rig = createVitalsRig();
  synchronizeImmediately(rig, CUR(50), true);
  assert.equal(rig.main.health.amount, 1);
  assert.equal(rig.loss.health.amount, 1);
  // 20 of 50 health lost in one hit
  applyVitalsChange(rig, 'health', { lost: 20, lostPercent: 0.4 }, CUR(30));
  assert.ok(Math.abs(rig.main.health.amount - 0.6) < 1e-9, 'main.Amount -= LostPercent (:304)');
  assert.equal(rig.loss.health.amount, 1, 'the loss bar still holds the OLD level - that band IS the trail');
  assert.equal(rig.gain.health.amount, 0.6, 'the gain bar snaps to the live ratio (:297)');
  assert.equal(rig.loss.health.cycleTimer, true, 'both smooth toward the target (:309-310)');
  assert.equal(rig.main.health.target, 0.6);
  assert.equal(rig.loss.health.target, 0.6);
  // the trail closes: -0.5s delay then the 0.4s lerp
  updateAllVitals(rig, CUR(30), 0.5);
  assert.equal(rig.loss.health.amount, 1, 'still delayed');
  updateAllVitals(rig, CUR(30), 0.2);
  assert.ok(Math.abs(rig.loss.health.amount - (1 + (0.6 - 1) * 0.5)) < 1e-9, 'halfway shut');
  updateAllVitals(rig, CUR(30), 0.2);
  assert.ok(Math.abs(rig.loss.health.amount - 0.6) < 1e-9, 'the trail has closed');
});

test('VB1 rig: a GAIN jumps the loss bar up (GainPercent = -LostPercent) while the main bar climbs', () => {
  const rig = createVitalsRig();
  synchronizeImmediately(rig, CUR(25), true);
  assert.equal(rig.main.health.amount, 0.5);
  // healed 15 of 50: lost = -15
  applyVitalsChange(rig, 'health', { lost: -15, lostPercent: -0.3 }, CUR(40));
  assert.ok(Math.abs(rig.loss.health.amount - 0.8) < 1e-9, 'loss.Amount += GainPercent (:306)');
  assert.equal(rig.main.health.amount, 0.5, 'the main bar holds and smooths up from here');
  assert.equal(rig.gain.health.amount, 0.8, 'the bright band leads to the new level');
  assert.equal(rig.main.health.target, 0.8);
});

test('VB1 rig: the VerticalProgress clamp - a killing blow cannot drive a bar below empty', () => {
  const rig = createVitalsRig();
  synchronizeImmediately(rig, CUR(10), true);
  applyVitalsChange(rig, 'health', { lost: 60, lostPercent: 1.2 }, { ...CUR(0), health: 0 });
  assert.equal(rig.main.health.amount, 0, 'Amount clamps 0..1 on every set (VerticalProgress.cs:30)');
});

// ---------------------------------------------------------------
// 4. THE HOST SEAM (two rigs, one detector, the pause + toggle laws)
// ---------------------------------------------------------------

test('VB1 seam: change events reach BOTH rigs; only the enabled one cycles', () => {
  _resetForTests();
  _resetHudVitals();
  updateHudVitals(false, CUR(50), 0.016);           // primes: reset -> sync both
  const small = updateHudVitals(false, CUR(30), 0.016);
  assert.ok(Math.abs(small.main.health.amount - 0.6) < 1e-9, 'the small rig took the hit');
  // the IDLE rig took the event too but never cycles: run the small
  // HUD long enough for its trail to close (0.5s delay + 0.4s lerp)
  for (let i = 0; i < 60; i++) updateHudVitals(false, CUR(30), 0.02);
  assert.ok(Math.abs(small.loss.health.amount - 0.6) < 1e-9, 'the enabled trail has closed');
  // flip to the large HUD: the toggle UNPRIMES the detector
  // (DaggerfallHUD_OnLargeHUDToggle -> ResetVitals, :160-164), so the
  // first large frame RESYNCHRONIZES the stale idle rig - without the
  // reset its trail would still be standing at the pre-hit level,
  // waiting out a delay that already elapsed on the other HUD
  const large = updateHudVitals(true, CUR(30), 0.016);
  assert.ok(Math.abs(large.loss.health.amount - 0.6) < 1e-9,
    'the idle trail is synced shut by the toggle reset, not left standing');
  assert.equal(large.main.health.amount, 0.6);
  assert.notEqual(large, small, 'HUDLarge owns its OWN HUDVitals instance (HUDLarge.cs:66)');
  _resetHudVitals();
});

test('VB1 seam: the detector is pause-gated - a paused frame defers the delta (:68-69)', () => {
  _resetForTests();
  _resetHudVitals();
  updateHudVitals(false, CUR(50), 0.016);
  const paused = updateHudVitals(false, CUR(30), 0.016, true);
  assert.equal(paused.main.health.amount, 1, 'nothing detected while paused');
  const after = updateHudVitals(false, CUR(30), 0.016);
  assert.ok(Math.abs(after.main.health.amount - 0.6) < 1e-9,
    'unpausing lands the whole deferred change as one event - the rest-heal sway DFU defers the same way');
  _resetHudVitals();
});

test('VB1 seam: with the setting OFF the rig is SynchronizeImmediately every frame (:211-214)', () => {
  _resetForTests();
  _resetHudVitals();
  setValue('GUI', 'EnableVitalsIndicators', false);
  updateHudVitals(false, CUR(50), 0.016);
  const rig = updateHudVitals(false, CUR(30), 0.016);
  assert.ok(Math.abs(rig.main.health.amount - 0.6) < 1e-9, 'the main bar snaps - no trail');
  assert.equal(rig.main.health.cycleTimer, false, 'no smoother ever arms');
  _resetForTests();
  _resetHudVitals();
});

// ---------------------------------------------------------------
// 5. THE SKIN (LoadAssets :181-202) - F149
// ---------------------------------------------------------------

test('VB1 skin: the six indicator colours are HUDVitals.cs:41-46 verbatim', () => {
  assert.deepEqual([...HEALTH_LOSS_COLOR], [0, 0.22, 0]);
  assert.deepEqual([...FATIGUE_LOSS_COLOR], [0.44, 0, 0]);
  assert.deepEqual([...MAGICKA_LOSS_COLOR], [0, 0, 0.44]);
  assert.deepEqual([...HEALTH_GAIN_COLOR], [0.60, 1, 0.60]);
  assert.deepEqual([...FATIGUE_GAIN_COLOR], [1, 0.50, 0.50]);
  assert.deepEqual([...MAGICKA_GAIN_COLOR], [0.70, 0.70, 1]);
});

test('VB1 skin: the swap exchanges health/fatigue ART and COLOURS; magicka never moves', () => {
  const art = { health: { tex: 'h' }, fatigue: { tex: 'f' }, magicka: { tex: 'm' } };
  const plain = vitalsSkin(art, false);
  assert.equal(plain.health.img.tex, 'h');
  assert.equal(plain.health.loss, HEALTH_LOSS_COLOR);
  const swapped = vitalsSkin(art, true);
  assert.equal(swapped.health.img.tex, 'f', 'healthBar.ProgressTexture = the FATIGUE art (:183)');
  assert.equal(swapped.fatigue.img.tex, 'h');
  assert.equal(swapped.health.loss, FATIGUE_LOSS_COLOR, 'healthBarLoss.Color = fatigueLossColor (:185)');
  assert.equal(swapped.health.gain, FATIGUE_GAIN_COLOR);
  assert.equal(swapped.fatigue.loss, HEALTH_LOSS_COLOR);
  assert.equal(swapped.magicka.img.tex, 'm', 'magicka is outside the swap (:199-201)');
  assert.equal(swapped.magicka.loss, MAGICKA_LOSS_COLOR);
});

// ---------------------------------------------------------------
// 6. THE DRAW (Components.Add order + the v-window)
// ---------------------------------------------------------------

test('VB1 draw: loss bars behind, gains between, art-filled mains on top (:108-119)', () => {
  const rig = createVitalsRig();
  synchronizeImmediately(rig, CUR(50), true);
  rig.main.health.amount = 0.5;   // mid-trail: main below, loss above
  const skin = vitalsSkin({ health: { tex: 'h' }, fatigue: { tex: 'f' }, magicka: { tex: 'm' } }, false);
  const rects = Object.fromEntries(VITAL_KEYS.map((k, i) => [k, { x: i * 10, y: 0, w: 4, h: 32 }]));
  const r = recorder();
  drawVitalsBars(r, rig, skin, rects, true);
  assert.equal(r.quads.length, 9);
  assert.deepEqual(r.quads.map((q) => q.tex), [null, null, null, null, null, null, 'h', 'f', 'm']);
  assert.deepEqual(r.quads[0].color, [0, 0.22, 0, 1], 'the health loss trail in its own colour');
  assert.deepEqual(r.quads[3].color, [0.60, 1, 0.60, 1], 'the health gain band');
  // the half-full main bar shows the BOTTOM half of its art,
  // bottom-anchored (VerticalProgress.DrawProgress)
  const main = r.quads[6];
  assert.equal(main.h, 16);
  assert.equal(main.y, 16);
  assert.deepEqual(main.uv, { u0: 0, v0: 0.5, u1: 1, v1: 1 });
});

test('VB1 draw: without indicators only the three mains draw - the old HUD exactly', () => {
  const rig = createVitalsRig();
  synchronizeImmediately(rig, CUR(50), false);
  const skin = vitalsSkin({ health: { tex: 'h' }, fatigue: { tex: 'f' }, magicka: { tex: 'm' } }, false);
  const rects = Object.fromEntries(VITAL_KEYS.map((k, i) => [k, { x: i * 10, y: 0, w: 4, h: 32 }]));
  const r = recorder();
  drawVitalsBars(r, rig, skin, rects, false);
  assert.deepEqual(r.quads.map((q) => q.tex), ['h', 'f', 'm']);
});

// ---------------------------------------------------------------
// 7. THE WIRING - both HUDs ride the one law
// ---------------------------------------------------------------

test('VB1 wiring: drawHud runs the rig on BOTH branches and hudLarge draws through the same law', () => {
  const hud = src('ui/hud.js');
  assert.match(hud, /updateHudVitals\(false, cur, dt, cursorActive\)/, 'the small HUD is the enabled instance');
  assert.match(hud, /updateHudVitals\(true, cur, dt, cursorActive\)/, 'the large HUD is the OTHER instance');
  assert.match(hud, /drawVitalsBars\(renderer, rig, skin, rects, indicators\)/);
  const large = src('ui/hudLarge.js');
  assert.match(large, /drawVitalsBars\(renderer, vitalsBars\.rig, vitalsBars\.skin, \{/,
    'the large HUD draws its vitals through the shared nine-bar law');
  assert.match(large, /import \{ drawVitalsBars \} from '\.\/hudVitals\.js';/);
  // Both rigs subscribe to the one detector (HUDVitals.cs:122-124 runs
  // in BOTH instances' constructors). The idle rig's copy is masked
  // from behaviour by the toggle reset - which is exactly why DFU
  // needs that reset - so the subscription is pinned at the source.
  assert.match(src('ui/hudVitals.js'),
    /applyVitalsChange\(_rigs\.small, k, c, cur\); applyVitalsChange\(_rigs\.large, k, c, cur\);/,
    'change events reach both instances');
});

test('VB1 wiring: drawHudLarge really draws the bars inside the bar rects, not just in the source', () => {
  const rig = createVitalsRig();
  synchronizeImmediately(rig, CUR(50), true);
  const skin = vitalsSkin({ health: { tex: 'h' }, fatigue: { tex: 'f' }, magicka: { tex: 'm' } }, false);
  const r = recorder();
  const bar = drawHudLarge(r, { width: 320, height: 200 }, { main: { tex: 'tex:MAIN00I0' } }, {}, 0,
    { vitalsBars: { rig, skin, indicators: true } });
  // health rect [49, 7, 4, 32] at the docked scale (320/320 = 1)
  const hq = r.quads.filter((q) => q.x === bar.x + 49 * bar.s);
  assert.equal(hq.length, 3, 'loss + gain + main all land in the health rect');
  assert.equal(hq[2].tex, 'h', 'the art-filled main is on top');
});

test('VB1 integration: one hit through drawHud leaves the dark trail standing over the dropped bar', () => {
  _resetForTests();
  _resetHudVitals();
  const art = {
    health: { tex: 'tex:MAIN03I0', w: 4, h: 32 }, fatigue: { tex: 'tex:MAIN04I0', w: 4, h: 32 },
    magicka: { tex: 'tex:MAIN05I0', w: 4, h: 32 },
    compass: { tex: 'tex:COMPASS', w: 322, h: 17 }, compassBox: { tex: 'tex:COMPBOX', w: 69, h: 17 },
  };
  const canvas = { width: 320, height: 200 };
  const vit = (health) => ({ health, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 } });
  drawHud(recorder(), canvas, art, vit(50), 0, 0.016);   // primes + syncs
  const r = recorder();
  drawHud(r, canvas, art, vit(25), 0, 0.016);            // the hit lands
  const health = r.quads.filter((q) => q.x === 10 && q.w === 4);
  // loss trail still full-height; main bar already at half
  const lossQ = health.find((q) => q.tex === null && String(q.color) === String([0, 0.22, 0, 1]));
  const mainQ = health.find((q) => q.tex === 'tex:MAIN03I0');
  assert.equal(lossQ.h, 32, 'the trail holds the old level');
  assert.equal(mainQ.h, 16, 'the main bar dropped at once');
  assert.ok(r.quads.indexOf(lossQ) < r.quads.indexOf(mainQ), 'and the trail is BEHIND the main bar');
  _resetHudVitals();
});
