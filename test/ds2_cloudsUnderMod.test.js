// DS2 (2026-09-08, Mac: "The procedural sky mod doesn't apply our enhanced
// clouds"). VC3's design decision 1 stood the volumetric clouds on the
// port's dome ONLY - "the new clouds do not draw under it" - and the
// controller built them off `enhancedSky &&`, so under Dynamic Skies the
// player got the mod's two textured sheets and none of the port's field.
// Now the clouds ride the LANE: built under either sky, the mod's sheets
// standing down under them the way the dome's decks do, their state
// synthesised from the mod's sun, moons and horizon over the port's own
// cloud colours, and the ground's deck taking their shadow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloudsStateUnderMod, dynamicMoonState } from '../src/render/dynamicSkiesBridge.js';
import { skyState } from '../src/render/enhancedSky.js';
import { MATERIAL_DEFAULTS } from '../src/systems/dynamicSkies.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DS2: the clouds’ state under the mod - the port’s colours, the MOD’s sun, moons and horizon', () => {
  const minuteOfDay = 15 * 60, weather = 'cloudy';
  const st = { sunDir: [0.3, 0.6, 0], clearColor: [0.2, 0.3, 0.4] };
  const moons = { masser: { dir: [0, -1, 0], vis: 0, phase: 3, color: [1, 0.5, 0.2] }, secunda: { dir: [0.1, 0.9, 0], vis: 0.5, phase: 1, color: [0.6, 0.6, 0.9] } };
  const s = cloudsStateUnderMod(st, moons, { minuteOfDay, weather, seconds: 10, drift: [1, 2] });
  const base = skyState({ minuteOfDay, weather, seconds: 10, drift: [1, 2] });
  assert.deepEqual(s.sunDir, st.sunDir, 'the sun is the mod’s (SunlightManager’s direction)');
  assert.deepEqual(s.masser, moons.masser); assert.deepEqual(s.secunda, moons.secunda);
  assert.deepEqual(s.horizon, st.clearColor, 'the horizon the clouds fade to is the mod’s fog colour');
  assert.deepEqual(s.cloudLit, base.cloudLit); assert.deepEqual(s.cloudShade, base.cloudShade);
  assert.deepEqual(s.sun, base.sun, 'the port’s palette lights the cloud at the hour');
  assert.equal(s.cloudCover, base.cloudCover);
  // without moons or a clear colour the port's own stand
  const t = cloudsStateUnderMod({ sunDir: [0, 1, 0] }, null, { minuteOfDay, weather });
  assert.deepEqual(t.horizon, base.horizon); assert.deepEqual(t.masser, base.masser);
  // and the moon state the world's moonlight takes is the same object the clouds get
  const dyn = { mat: { ...MATERIAL_DEFAULTS }, _sunDir: [0, -0.5, 0], phases: null, moonDirection: (w) => (w === 'Moon' ? [0, 0.7, 0.7] : [0, -1, 0]) };
  const m = dynamicMoonState(dyn, 23 * 60, 0.5);
  assert.ok(m.masser.vis > 0 && m.secunda.vis === 0);
  assert.deepEqual(cloudsStateUnderMod(st, m, { minuteOfDay: 23 * 60, weather }).masser, m.masser);
});

test('DS2: the seam - built on the lane, the mod’s sheets stand down, the clouds and the deck under the mod', () => {
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const clouds = enhancedLane && cloudsDoor !== 'off'/);
  assert.match(shared, /if \(clouds && dynamicSky\) dynamicSky\.cloudsExternal = true;/);
  assert.match(shared, /clouds\.setState\(cloudsStateUnderMod\(st, dynamicMoons, \{ minuteOfDay, weather: weatherName, classicMinutes: nowMinutes, seconds, drift: driftXZ, row: weatherRowNow \}\),\s*\n\s*weatherRowNow, weatherName, easeDt, driftXZ, extra\?\.flash \?\? 0, extra\?\.pos \?\? null\);/, 'the same row, dt, drift, flash and position the dome path hands them');
  assert.match(shared, /if \(clouds\.shadow\) Object\.assign\(dynamicDeck, clouds\.shadow\);/, 'the ground takes the shadow map under the mod');
  assert.match(shared, /import \{ cloudsStateUnderMod, dynamicMoonState \} from '\.\.\/render\/dynamicSkiesBridge\.js';/);
  assert.doesNotMatch(shared, /^function dynamicMoonState/m, 'the moon state moved to the bridge, with the clouds’ state');
  const r = read('src/render/dynamicSkiesRenderer.js');
  assert.match(r, /this\.cloudsExternal = false;/);
  assert.match(r, /this\.cloudsExternal && \(name === '_CloudTopOpacity' \|\| name === '_CloudOpacity'\) \? 0 : \(mat\[name\] \?\? MATERIAL_DEFAULTS\[name\] \?\? 0\)/, 'opacity 0 to the shader, the material untouched - the dome’s uCloudCover law');
  const lab = read('src/tools/skyLab.js');
  assert.match(lab, /import \{ cloudsStateUnderMod, dynamicMoonState \} from '\.\.\/render\/dynamicSkiesBridge\.js';/, 'the lab takes the bridge, not the controller');
  assert.match(lab, /const cst = dynamicOn\s*\n\s*\? cloudsStateUnderMod\(sky\.state, dynamicMoonState\(dyn, minuteOfDay, row\.cover\), \{ minuteOfDay, weather: \$\('weather'\)\.value, phases, seconds, drift: labDrift \}\)\s*\n\s*: sky\.state;/);
});
