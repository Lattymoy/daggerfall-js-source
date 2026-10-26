// CLOUD-COMPILE (2026-10-26; bible/07-Rendering/Performance-Priority.md CLOUD-COMPILE): THE VOLUMETRIC CLOUDS ARRIVE
// WHEN THEIR PROGRAMS ARE DONE, AND THE SKY STANDS WITHOUT THEM UNTIL THEY HAVE MARCHED THEIR FIRST SWEEP.
//
// Over a stub context whose driver answers "still compiling" until the test says otherwise: the door builds nothing
// and reads no link while the driver compiles, builds the clouds at the first ask after, hands them the origin
// offsets they missed, and a build that fails leaves the sky without clouds instead of failing the scene. The sky
// controller draws the clouds-off sky (the dome's own decks, the dome's own sun occlusion, no cells drawn) until the
// clouds' first sweep is marched, then the clouds' sky, and never both in one frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateGl, E } from '../retroGl.mjs';
import { createCloudsArrival, CLOUDS_ARRIVAL_PROGRAMS } from '../../src/render/cloudsArrival.js';
import { VolumetricClouds, CLOUD_PROGRAMS } from '../../src/render/volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from '../../src/render/cloudNoise.js';
import { createSkyController } from '../../src/scenes/shared.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../../src/systems/uiSkin.js';

const COMPLETION_STATUS_KHR = 0x91B1;

/** stateGl's context with KHR_parallel_shader_compile (unless `parallel` is false), whose compiles are done once
 *  `driver.done` is set; every LINK_STATUS read counted, and `failLinks` makes every link fail. */
function compilingGl({ parallel = true } = {}) {
  const { canvas, gl: inner } = stateGl();
  const driver = { done: false, linkReads: 0, failLinks: false };
  const gl = new Proxy(inner, {
    get(target, key) {
      if (key === 'getExtension') {
        return (name) => (parallel && name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR } : target.getExtension(name));
      }
      if (key === 'getProgramParameter') {
        return (program, name) => {
          if (name === COMPLETION_STATUS_KHR) return driver.done;
          if (name === E.LINK_STATUS) {
            driver.linkReads++;
            if (driver.failLinks) return false;
          }
          return target.getProgramParameter(program, name);
        };
      }
      if (key === 'getShaderParameter' && driver.failLinks) return () => false;
      return target[key];
    },
  });
  canvas.getContext = () => gl;
  return { gl, driver };
}

test('CLOUD-COMPILE: the door lists every program the clouds\' constructor builds', () => {
  assert.deepEqual([...CLOUDS_ARRIVAL_PROGRAMS], [...CLOUD_NOISE_PROGRAMS, ...CLOUD_PROGRAMS]);
});

test('CLOUD-COMPILE: no clouds and no link read while the driver compiles; built at the first ask after, once', () => {
  const { gl, driver } = compilingGl();
  const arrival = createCloudsArrival(gl, 'default', null);
  assert.equal(arrival.poll(), null);
  assert.equal(arrival.poll(), null);
  assert.equal(arrival.shown(), null);
  assert.equal(driver.linkReads, 0, 'nothing waited on a link while the driver compiled');
  driver.done = true;
  const clouds = arrival.poll();
  assert.ok(clouds instanceof VolumetricClouds);
  assert.equal(driver.linkReads, CLOUDS_ARRIVAL_PROGRAMS.length, 'the build read each of its links once');
  assert.equal(arrival.poll(), clouds, 'built once');
  assert.equal(arrival.shown(), null, 'not shown before its first sweep');
});

test('CLOUD-COMPILE: where the driver cannot compile beside the page, the clouds are built at the first ask', () => {
  const { gl } = compilingGl({ parallel: false });
  assert.ok(createCloudsArrival(gl, 'lo', 'rain').poll() instanceof VolumetricClouds);
});

test('CLOUD-COMPILE: a recenter before the build is handed to the clouds, so their field stands where a boot build\'s would', () => {
  const { gl, driver } = compilingGl();
  const arrival = createCloudsArrival(gl, 'default', 'thunder,3000');
  arrival.offsetOrigin([1200, 5, -300]);
  arrival.offsetOrigin([-50, 0, 800]);
  driver.done = true;
  const late = arrival.poll();
  const early = new VolumetricClouds(gl, 'default');
  early.offsetOrigin([1200, 5, -300]);
  early.offsetOrigin([-50, 0, 800]);
  assert.deepEqual(late.shift, early.shift);
  assert.equal(late.testCellSpec, 'thunder,3000');
  arrival.offsetOrigin([10, 0, 10]);
  assert.deepEqual(late.shift, [early.shift[0] - 10, early.shift[1] - 10], 'after the build, the clouds take each recenter themselves');
});

test('CLOUD-COMPILE: a build that fails leaves no clouds for good, and does not throw', () => {
  const { gl, driver } = compilingGl();
  const warn = console.warn;
  const warned = [];
  console.warn = (...a) => warned.push(a);
  try {
    const arrival = createCloudsArrival(gl, 'default', null);
    driver.done = true;
    driver.failLinks = true;
    assert.equal(arrival.poll(), null);
    assert.equal(arrival.poll(), null);
    assert.equal(warned.length, 1);
  } finally { console.warn = warn; }
});

test('CLOUD-COMPILE: the sky stands as with the clouds off until the clouds have marched a sweep, then they take it over', () => {
  const skin = uiSkin();
  const pref = getPref('enhancedEnvironments');
  setUiSkin('enhanced');
  setPref('enhancedEnvironments', true);
  try {
    const { gl, driver } = compilingGl();
    const ctl = createSkyController(gl, new URLSearchParams('sky=enhanced&weather=cloudy&cloudcell=rain'));
    const extra = { classicMinutes: 9 * 60, pos: [0, 0, 0], weather: 'cloudy', cells: [] };
    const frame = (minute) => {
      extra.classicMinutes = minute;
      ctl.use(16, minute % 1440, true, extra);
      ctl.draw(0, 0.3, 1.1, 16 / 9);
    };
    for (let m = 600; m < 610; m++) frame(m);
    assert.equal(ctl.renderer.cloudsExternal, false, 'the dome draws its own decks while the clouds compile');
    assert.equal(ctl.drawnCells(), null, 'no cells drawn - the curtains take the field\'s, as with the clouds off');
    assert.ok(ctl.sunFactor() <= 1);
    assert.equal(ctl.renderer.cloudShadow.map, undefined, 'the ground takes the dome\'s deck, with no shadow map');
    const offSun = ctl.sunFactor();
    driver.done = true;
    let frames = 0;
    for (; ctl.renderer.cloudsExternal === false && frames < 64; frames++) {
      frame(610 + frames);
      if (ctl.renderer.cloudsExternal === false) assert.equal(ctl.renderer.cloudShadow.map, undefined, 'no cloud map under the dome\'s decks');
    }
    assert.ok(frames > 1, 'the clouds take over only after their first sweep, not the frame they are built');
    assert.ok(Array.isArray(ctl.drawnCells()), 'the cells the clouds draw');
    assert.equal(ctl.sunFactor(), 1, 'the key light\'s shadow is the clouds\' map');
    frame(700);
    assert.ok(ctl.renderer.cloudShadow.map, 'the ground reads the clouds\' shadow map');
    assert.ok(offSun <= 1);
  } finally {
    setUiSkin(skin);
    setPref('enhancedEnvironments', pref);
  }
});
