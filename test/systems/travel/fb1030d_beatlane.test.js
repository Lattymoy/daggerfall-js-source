// BEAT-LANE (bible/01-Overview/bugs/Field-Bugs-2026-10-30d.md; a player: sailing in the Eltheric "will try to have my
// ship steer 40 million miles off screen to move an inch forward"). Under the Classic helm the journey's hand beats up
// to a mark in the wind's eye and went about only when the mark's bearing swung 20 degrees past the eye. SEA-TAUT made a
// voyage's sea legs long - 29 to 43 km past Veilhaven - so a tack's lane was 23% of the leg: 9.4 km off the line.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seaHelmStep, createSeaHelm, SEA_HELM } from '../../../src/systems/seaHelm.js';
import { planSeaLanes } from '../../../src/systems/travel/travelRoute.js';
import { etherHeightByte, veilhaven, inEther } from '../../../src/world/ethericSea.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';
import { sailTo } from '../../csaCrossing.mjs';

const PIXEL_M = 819.2;
/** The longest sea leg of a voyage from off Veilhaven to the port 49 pixels west of it, metres - the ground the
 *  planner reads (routeGround: water at WATER_BYTE or under), all of it the Eltheric Ocean's own law. */
function etherLongestLeg() {
  const isWater = (x, y) => !inEther(x, y) || etherHeightByte(x, y) <= WATER_BYTE;
  const h = veilhaven(), from = { x: h.px - 3, y: h.py }, to = { x: 8017, y: -5196 };
  const plan = planSeaLanes(from, to, { isWater, sea: { start: 'sea', goal: 'land' } });
  assert.ok(plan, 'a voyage there');
  let most = 0;
  for (let k = 1; k < plan.pixels.length; k++) {
    if (plan.kinds[k - 1] === 'sea') most = Math.max(most, Math.hypot(plan.pixels[k].x - plan.pixels[k - 1].x, plan.pixels[k].y - plan.pixels[k - 1].y));
  }
  return most * PIXEL_M;
}

test('BEAT-LANE the Eltheric Ocean: a voyage\'s sea leg is tens of km, and the Large Boat beats dead to windward up it within the lane of the line (mutant: the lane an angle alone - 8.8 km off)', () => {
  const leg = etherLongestLeg();
  assert.ok(leg > 25000, `SEA-TAUT's long leg: ${Math.round(leg)} m`);
  const r = sailTo(2, 180, 0, { dist: leg, maxS: 20000 });
  assert.ok(r, 'she reaches the mark');
  assert.equal(SEA_HELM.laneM, 400);
  assert.ok(r.off <= 450, `${Math.round(r.off)} m off the line`);
});

test('BEAT-LANE the Bay\'s pixel leg: a mark 800 m dead to windward is beaten up to as before - the angle goes about first (mutant: the lane in metres alone, 400 m past the eye)', () => {
  const r = sailTo(2, 180, 0, { dist: 800, maxS: 1500 });
  assert.ok(r, 'she reaches the mark');
  assert.ok(r.off > 150 && r.off < 250, `${Math.round(r.off)} m off the line`);
});

test('BEAT-LANE the step: on a tack she holds while within the lane and goes about once past it; a mark with no distance keeps the angle\'s law', () => {
  // the wind blows toward the south, its eye due north; the mark 40 km north and a hair west: past the line on tack 1
  const dist = 40000, ask = (pastM, d = dist) => {
    const st = createSeaHelm();
    st.tack = 1;
    const off = (-Math.asin(pastM / dist) * 180) / Math.PI;
    return seaHelmStep(st, { heading: SEA_HELM.noGoFore, bearing: off, dist: d, wind: [0, -1.5], hasSails: true, sailsUp: true, canSail: true, way: 3, dt: 0.25 }).course;
  };
  assert.equal(Math.round(ask(SEA_HELM.laneM - 50)), SEA_HELM.noGoFore, 'within the lane: the tack held');
  assert.equal(Math.round(ask(SEA_HELM.laneM + 50)), -SEA_HELM.noGoFore, 'past it: about');
  assert.equal(Math.round(ask(SEA_HELM.laneM + 50, null)), SEA_HELM.noGoFore, 'no distance: the angle alone');
});

test('BEAT-LANE by source: the journey\'s hand is told the metres to its mark (mutant: none told)', () => {
  const src = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /const cmd = seaHelmStep\(tvSea\.helm, \{\n\s+heading: seaHeadingOf\(fw\[0\], fw\[2\]\), bearing: seaHeadingOf\(mark\[0\] - p\[0\], mark\[2\] - p\[2\]\), dist, /);
  assert.match(src, /const dist = Math\.hypot\(mark\[0\] - p\[0\], mark\[2\] - p\[2\]\);/);
});
