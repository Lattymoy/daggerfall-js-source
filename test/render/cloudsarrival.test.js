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
import { VolumetricClouds, CLOUD_PROGRAMS, QUALITY } from '../../src/render/volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from '../../src/render/cloudNoise.js';
import { createSkyController } from '../../src/scenes/shared.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../../src/systems/uiSkin.js';

const COMPLETION_STATUS_KHR = 0x91B1;

/** stateGl's context with KHR_parallel_shader_compile (unless `parallel` is false), whose compiles are done once
 *  `driver.done` is set; every link and every LINK_STATUS read counted, and `failLinks` makes every link fail. */
function compilingGl({ parallel = true } = {}) {
  const { canvas, gl: inner, s: state } = stateGl();
  const driver = { done: false, linkReads: 0, links: 0, failLinks: false };
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
      if (key === 'linkProgram') {
        return (program) => {
          driver.links++;
          return target.linkProgram(program);
        };
      }
      if (key === 'getShaderParameter' && driver.failLinks) return () => false;
      return target[key];
    },
  });
  canvas.getContext = () => gl;
  return { gl, driver, state };
}

test('CLOUD-COMPILE: the door lists every program the clouds\' constructor builds', () => {
  assert.deepEqual([...CLOUDS_ARRIVAL_PROGRAMS], [...CLOUD_NOISE_PROGRAMS, ...CLOUD_PROGRAMS]);
});

test('CLOUD-COMPILE: no clouds and no link read while the driver compiles; built at the first ask after, once', () => {
  const { gl, driver } = compilingGl();
  const arrival = createCloudsArrival(gl, 'default', null);
  assert.equal(arrival.poll([0, 0, 1280, 720]), null);
  assert.equal(arrival.poll([0, 0, 1280, 720]), null);
  assert.equal(arrival.shown(), null);
  assert.equal(driver.linkReads, 0, 'nothing waited on a link while the driver compiled');
  driver.done = true;
  const clouds = arrival.poll([0, 0, 1280, 720]);
  assert.ok(clouds instanceof VolumetricClouds);
  assert.equal(driver.linkReads, CLOUDS_ARRIVAL_PROGRAMS.length, 'the build read each of its links once');
  assert.equal(arrival.poll([0, 0, 1280, 720]), clouds, 'built once');
  assert.equal(arrival.shown(), null, 'not shown before its first sweep');
});

test('CLOUD-COMPILE: the build hands back the viewport it is given - the sky goes on drawing in the world rect', () => {
  const { gl, driver, state } = compilingGl();
  const arrival = createCloudsArrival(gl, 'default', null);
  driver.done = true;
  arrival.poll([40, 30, 900, 500]);
  assert.deepEqual(state.viewport, [40, 30, 900, 500]);
});

test('CLOUD-COMPILE: the programs start at the sky controller\'s mount where the driver compiles beside the page, and nowhere else', () => {
  const parallel = compilingGl();
  createCloudsArrival(parallel.gl, 'default', null);
  assert.equal(parallel.driver.links, CLOUDS_ARRIVAL_PROGRAMS.length, 'every program started at the mount');
  assert.equal(parallel.driver.linkReads, 0, 'none waited on');
  const inline = compilingGl({ parallel: false });
  createCloudsArrival(inline.gl, 'default', null);
  assert.equal(inline.driver.links, 0, 'nothing queued where the compile would hold the next read');
});

test('CLOUD-COMPILE: where the driver cannot compile beside the page, the clouds are built at the first ask', () => {
  const { gl } = compilingGl({ parallel: false });
  assert.ok(createCloudsArrival(gl, 'lo', 'rain').poll([0, 0, 1280, 720]) instanceof VolumetricClouds);
});

test('CLOUD-COMPILE: a recenter before the build is handed to the clouds, so their field stands where a boot build\'s would', () => {
  const { gl, driver } = compilingGl();
  const arrival = createCloudsArrival(gl, 'default', 'thunder,3000');
  arrival.offsetOrigin([1200, 5, -300]);
  arrival.offsetOrigin([-50, 0, 800]);
  driver.done = true;
  const late = arrival.poll([0, 0, 1280, 720]);
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
    assert.equal(arrival.poll([0, 0, 1280, 720]), null);
    assert.equal(arrival.poll([0, 0, 1280, 720]), null);
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
    const ctl = createSkyController(gl, new URLSearchParams('sky=enhanced&weather=overcast&cloudcell=rain'));
    const extra = { classicMinutes: 9 * 60, pos: [0, 0, 0], weather: 'overcast', cells: [] };
    const frame = (minute) => {
      extra.classicMinutes = minute;
      ctl.use(16, minute % 1440, true, extra);
      ctl.draw(0, 0.3, 1.1, 16 / 9);
    };
    for (let m = 600; m < 610; m++) frame(m);
    assert.equal(ctl.renderer.cloudsExternal, false, 'the dome draws its own decks while the clouds compile');
    assert.equal(ctl.drawnCells(), null, 'no cells drawn - the curtains take the field\'s, as with the clouds off');
    assert.ok(ctl.sunFactor() < 1, 'the key light takes the dome\'s occlusion under the overcast');
    assert.equal(ctl.renderer.cloudShadow.map, undefined, 'the ground takes the dome\'s deck, with no shadow map');
    driver.done = true;
    let frames = 0;
    for (; ctl.renderer.cloudsExternal === false && frames < 64; frames++) {
      frame(610 + frames);
      if (ctl.renderer.cloudsExternal === false) {
        assert.equal(ctl.renderer.cloudShadow.map, undefined, 'no cloud map under the dome\'s decks');
        assert.ok(ctl.sunFactor() < 1, 'and the dome\'s occlusion on the key light, until the clouds\' map takes it');
      }
    }
    assert.ok(frames > 1, 'the clouds take over only after their first sweep, not the frame they are built');
    assert.ok(Array.isArray(ctl.drawnCells()), 'the cells the clouds draw');
    assert.equal(ctl.sunFactor(), 1, 'the key light\'s shadow is the clouds\' map');
    frame(700);
    assert.ok(ctl.renderer.cloudShadow.map, 'the ground reads the clouds\' shadow map');
  } finally {
    setUiSkin(skin);
    setPref('enhancedEnvironments', pref);
  }
});

test('CLOUD-COMPILE: a compile done before the sky\'s first frame costs no frame - the clouds are built on that first ask and take the sky over at once, their composite drawn in the frame their first sweep completes, as a build at the mount was (mutant: shown only after a sweep)', () => {
  const skin = uiSkin();
  const pref = getPref('enhancedEnvironments');
  setUiSkin('enhanced');
  setPref('enhancedEnvironments', true);
  try {
    const { gl, driver, state } = compilingGl();
    driver.done = true;
    const ctl = createSkyController(gl, new URLSearchParams('sky=enhanced&weather=overcast'));
    const extra = { classicMinutes: 600, pos: [0, 0, 0], weather: 'overcast', cells: [] };
    const marches = (draws) => draws.filter((d) => d.prog?.locs?.has('uLightSteps'));
    const composites = (draws) => draws.filter((d) => d.prog?.locs?.has('uBoltCos'));
    const mapHeight = QUALITY.default.height;
    let firstComposite = null;
    for (let f = 0; f < 40 && firstComposite === null; f++) {
      const from = state.draws.length;
      extra.classicMinutes = 600 + f;
      ctl.use(16, extra.classicMinutes, true, extra);
      if (f === 0) {
        assert.equal(ctl.renderer.cloudsExternal, true, 'the dome\'s decks down from the first frame, as with a build at the mount');
        assert.equal(ctl.sunFactor(), 1, 'the key light\'s shadow the clouds\' from the first frame');
        assert.ok(Array.isArray(ctl.drawnCells()), 'the cells the clouds draw from the first frame');
      }
      ctl.draw(0, 0.3, 1.1, 16 / 9);
      const frameDraws = state.draws.slice(from);
      if (f === 0) assert.ok(marches(frameDraws).length > 0, 'the first stripe marched in the first frame');
      if (composites(frameDraws).length > 0) firstComposite = frameDraws;
    }
    assert.ok(firstComposite, 'the clouds are drawn once their first sweep is marched');
    const [x, y, , h] = marches(firstComposite)[0].viewport;
    assert.ok(x === 0 && y > 0 && y + h === mapHeight, `the composite first draws in the frame of the sweep's last stripe (rows ${y}-${y + h} of ${mapHeight}), not a frame later`);
  } finally {
    setUiSkin(skin);
    setPref('enhancedEnvironments', pref);
  }
});

test('CLOUD-COMPILE option D: `?cloudsweep=whole` marches the clouds\' first sweep in their first frame and draws them in it; later sweeps keep their stripes; off by default (mutant: the door ignored)', () => {
  const skin = uiSkin();
  const pref = getPref('enhancedEnvironments');
  setUiSkin('enhanced');
  setPref('enhancedEnvironments', true);
  try {
    const run = (query) => {
      const { gl, driver, state } = compilingGl();
      driver.done = true;
      const ctl = createSkyController(gl, new URLSearchParams(query));
      const extra = { classicMinutes: 600, pos: [0, 0, 0], weather: 'overcast', cells: [] };
      const frames = [];
      for (let f = 0; f < 3; f++) {
        const from = state.draws.length;
        extra.classicMinutes = 600 + f;
        ctl.use(16, extra.classicMinutes, true, extra);
        ctl.draw(0, 0.3, 1.1, 16 / 9);
        const draws = state.draws.slice(from);
        frames.push({
          marches: draws.filter((d) => d.prog?.locs?.has('uLightSteps')).map((d) => d.viewport),
          composites: draws.filter((d) => d.prog?.locs?.has('uBoltCos')).length,
        });
      }
      return frames;
    };
    const height = QUALITY.default.height;
    const whole = run('sky=enhanced&weather=overcast&cloudsweep=whole');
    assert.deepEqual(whole[0].marches, [[0, 0, QUALITY.default.width, height]], 'the whole map marched in the first frame');
    assert.equal(whole[0].composites, 1, 'and the clouds drawn in it');
    assert.ok(whole[1].marches.every(([, , , h]) => h < height), 'the next sweep striped again');
    const striped = run('sky=enhanced&weather=overcast');
    assert.ok(striped[0].marches[0][3] < height && striped[0].composites === 0, 'off by default: a stripe, and nothing drawn yet');
  } finally {
    setUiSkin(skin);
    setPref('enhancedEnvironments', pref);
  }
});
