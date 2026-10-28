// BOOT-COMPILE (2026-10-25; bible/07-Rendering/Performance-Priority.md BOOT-COMPILE): THE BOOT'S PROGRAMS START
// TOGETHER, AND EVERY ONE STARTED IS TAKEN BY ITS BUILD.
//
// A program started for sources its build does not compile is never taken: it compiles for nothing, and the build
// waits on a compile of its own as before. So each list is held to the builds it stands for, over a stub context that
// says its compiles are done: after the start and the builds, every program linked had its LINK_STATUS read (the build
// took it), and the builds linked nothing the list did not name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateGl, E } from '../retroGl.mjs';
import { Renderer } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { warmPrograms } from '../../src/render/warmPrograms.js';
import { startPrograms, buildProgram } from '../../src/render/glProgram.js';
import { VolumetricClouds, CLOUD_PROGRAMS } from '../../src/render/volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from '../../src/render/cloudNoise.js';
import { DynamicSkiesRenderer, DYNAMIC_SKIES_PROGRAMS } from '../../src/render/dynamicSkiesRenderer.js';
import { LabGrassRenderer, labGrassPrograms } from '../../src/render/labGrass.js';
import { outdoorPasses, startBootPrograms, laneBootPrograms } from '../../src/render/bootPrograms.js';
import { FOE_TELEGRAPH_PROGRAMS } from '../../src/render/foeTelegraph.js';
import { createSkyController } from '../../src/scenes/shared.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';
import { playPrograms } from '../../src/render/playPrograms.js';
import { SNOW_VS, snowTerrainFs } from '../../src/render/snowfallGlsl.js';

const COMPLETION_STATUS_KHR = 0x91B1;

/** stateGl's context, with every link recorded and every LINK_STATUS read marked; `parallel` gives it
 *  KHR_parallel_shader_compile, whose compiles are done when `complete()` says (always, by default). */
function recordingGl({ parallel = true, complete = () => true } = {}) {
  const { canvas, gl: inner } = stateGl();
  const linked = [];
  const read = new Set();
  const gl = new Proxy(inner, {
    get(target, key) {
      if (key === 'getExtension') {
        return (name) => (parallel && name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR } : target.getExtension(name));
      }
      if (key === 'linkProgram') {
        return (program) => {
          linked.push({ program, vs: program.shaders[0]?.src, fs: program.shaders[1]?.src, byShadowPass: /new ShadowPass/.test(new Error().stack ?? '') });
          return target.linkProgram(program);
        };
      }
      if (key === 'getProgramParameter') {
        return (program, name) => {
          if (name === COMPLETION_STATUS_KHR) return complete();
          if (name === E.LINK_STATUS) read.add(program);
          return target.getProgramParameter(program, name);
        };
      }
      return target[key];
    },
  });
  canvas.getContext = () => gl;
  const pairsFrom = (from) => linked.slice(from).map(({ vs, fs }) => [vs, fs]);
  const untaken = () => linked.filter(({ program }) => !read.has(program)).length;
  const wasRead = (program) => read.has(program);
  return { canvas, gl, linked, pairsFrom, untaken, wasRead };
}

/** A renderer made over recordingGl: how many programs were linked when the constructor read its first link. */
function constructRecorded({ parallel }) {
  const rec = recordingGl({ parallel });
  let linksBeforeFirstRead = null;
  const getParameter = rec.gl.getProgramParameter;
  const gl = new Proxy(rec.gl, {
    get(target, key) {
      if (key === 'getProgramParameter') {
        return (program, name) => {
          if (name === E.LINK_STATUS) linksBeforeFirstRead ??= rec.linked.length;
          return getParameter(program, name);
        };
      }
      return target[key];
    },
  });
  rec.canvas.getContext = () => gl;
  new Renderer(rec.canvas);
  return { rec, linksBeforeFirstRead };
}

test('BOOT-COMPILE: the constructor starts its seven programs before it reads the first link, and builds each from its start', () => {
  const { rec, linksBeforeFirstRead } = constructRecorded({ parallel: true });
  assert.ok(linksBeforeFirstRead >= 7, `the classic set's five and the water's two are compiling before the first read (${linksBeforeFirstRead})`);
  assert.equal(rec.untaken(), 0, 'every program the constructor started was taken by its build');
});

test('BOOT-COMPILE: without the extension the constructor builds as before - each program read as it is linked', () => {
  const { rec, linksBeforeFirstRead } = constructRecorded({ parallel: false });
  assert.equal(linksBeforeFirstRead, 1);
  assert.equal(rec.untaken(), 0);
});

test('BOOT-COMPILE: laneBootPrograms names what installing the lane builds - the set, the water, the air and the clip - and each start is taken', () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  const from = rec.linked.length;
  const listed = laneBootPrograms(r, EL_LANE, { air: true, clip: true });
  startPrograms(rec.gl, listed);
  assert.deepEqual(rec.pairsFrom(from), listed, 'started in the list\'s order');
  const afterStart = rec.linked.length;
  r.setLightingLane(EL_LANE);
  r.setAir(true);
  r.prepareTerrainClip();
  assert.equal(rec.untaken(), 0, 'every started program was taken by its build');
  const builtUnlisted = rec.linked.slice(afterStart);
  assert.ok(builtUnlisted.length > 0);
  assert.ok(builtUnlisted.every((link) => link.byShadowPass), 'only the shadow pass\'s depth programs compile on their own');
  assert.deepEqual(laneBootPrograms(r, EL_LANE, { air: true, clip: true }), [], 'nothing left to start once the lane is installed');
});

test('BOOT-COMPILE: the classic page lists only the clip, and the air only with its door open', () => {
  const r = new Renderer(recordingGl().canvas);
  assert.equal(laneBootPrograms(r, null, { air: true, clip: false }).length, 0);
  assert.equal(laneBootPrograms(r, null, { air: true, clip: true }).length, 1);
  const withAir = laneBootPrograms(r, EL_LANE, { air: true }).length;
  const withoutAir = laneBootPrograms(r, EL_LANE, { air: false }).length;
  assert.ok(withAir > withoutAir + 10, 'the air pass\'s programs ride its door');
});

test('BOOT-COMPILE: the sky\'s and the grass\'s lists are what their constructors build', () => {
  const rec = recordingGl();
  const clouds = new VolumetricClouds(rec.gl, 'default', [0, 0, 1280, 720]);
  assert.ok(clouds.marchProgram);
  assert.deepEqual(rec.pairsFrom(0), [...CLOUD_NOISE_PROGRAMS, ...CLOUD_PROGRAMS]);
  let from = rec.linked.length;
  new DynamicSkiesRenderer(rec.gl);
  assert.deepEqual(rec.pairsFrom(from), DYNAMIC_SKIES_PROGRAMS);
  from = rec.linked.length;
  new LabGrassRenderer(rec.gl);
  assert.deepEqual(rec.pairsFrom(from), labGrassPrograms());
});

test('BOOT-COMPILE: an indoor door starts none of the outdoor passes', () => {
  for (const search of ['?interior', '?dungeon', '?dungeon&world']) {
    assert.deepEqual(outdoorPasses(search), { clouds: false, dynamicSky: false, grass: false, terrainClip: false }, search);
  }
});

test('BOOT-COMPILE (P2): every idle warm step starts its programs and builds from them - no warm waits on a link it started', async () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  r.setRetroSource(() => ({ width: 320, height: 200, hudWidth: 320, hudHeight: 154, post: 1, lutShift: 5, mipmaps: true }));
  const steps = [...r.warmSteps(), ...r.lazyWarmSteps()];
  assert.equal(steps.filter((s) => typeof s === 'function').length, 1, 'only the play passes\' start is a bare step - it starts, and builds nothing');
  // a macrotask idle: the telegraph's start waits on its module's import
  const done = await warmPrograms(steps, { idle: (fn) => setImmediate(fn) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(done, steps.length);
  for (const name of ['screenQuadProgram', 'screenQuadRunProgram', 'charQuadProgram', 'particleProgram', 'overlayProgram', 'weaponGlowMeshProgram', 'weaponGlowQuadProgram', 'weaponGlowFieldProgram']) assert.ok(r[name], name);
  assert.ok(r.retro?.P && r._rwBg && r._foeTelegraph, 'the retro present, the windows\' background and the foes\' telegraph');
  // the play passes' and the snow's starts stay untaken here - play takes them (render/playPrograms.js); every other
  // start was taken by its step's build
  const keyOf = (vs, fs) => `${vs}\0${fs}`;
  const playedLater = new Set([...playPrograms(), [SNOW_VS, snowTerrainFs(r._worldSet.terrainFs)]].map(([vs, fs]) => keyOf(vs, fs)));
  const untakenWarm = rec.linked.filter((l) => !playedLater.has(keyOf(l.vs, l.fs)) && !rec.wasRead(l.program));
  assert.deepEqual(untakenWarm.map((l) => l.fs.slice(0, 80)), [], 'every warm start was taken by its build');
  const warmBuilt = ['screenQuadProgram', 'screenQuadRunProgram', 'charQuadProgram', 'particleProgram', 'overlayProgram', 'weaponGlowMeshProgram', 'weaponGlowQuadProgram', 'weaponGlowFieldProgram'].map((n) => r[n]);
  warmBuilt.push(r.retro.P.p, r._rwBg.p, r._foeTelegraph.program);
  for (const program of warmBuilt) {
    assert.equal(rec.linked.filter((l) => l.program === program).length, 1, 'built from its one start, never compiled twice');
  }
  const pairsOf = (program) => { const l = rec.linked.find((x) => x.program === program); return `${l.vs}\0${l.fs}`; };
  const builtKeys = new Set(warmBuilt.map(pairsOf));
  const compiledTwice = rec.linked.filter((l) => builtKeys.has(`${l.vs}\0${l.fs}`)).length - builtKeys.size;
  assert.equal(compiledTwice, 0, 'no warm step started sources its build did not take');
});

test('BOOT-COMPILE (P2): a step whose program a draw built first stands down - its start never compiles it again', async () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  r._ensureCharQuadProgram();
  const before = rec.linked.length;
  const step = r.warmSteps()[2];
  assert.equal(step.need(), false);
  await warmPrograms([step], { idle: (fn) => fn() });
  assert.equal(rec.linked.length, before, 'nothing compiled');
});

test('BOOT-COMPILE: the boot starts nothing where the driver cannot compile beside the page', () => {
  const rec = recordingGl({ parallel: false });
  const r = new Renderer(rec.canvas);
  const before = rec.linked.length;
  assert.equal(startBootPrograms(r, '?world'), false);
  assert.equal(rec.linked.length, before, 'no compile issued ahead of its build');
  const withExtension = recordingGl();
  const r2 = new Renderer(withExtension.canvas);
  const constructorLinks = withExtension.linked.length;
  assert.equal(startBootPrograms(r2, '?world'), true);
  assert.ok(withExtension.linked.length > constructorLinks);
});

/** What the sky controller builds for a query, read off the programs it links. The mod's sky throws past the passes
 *  here (it parses a fetched asset node has not got) - its passes are built by then. */
function skyBuilt(search) {
  const rec = recordingGl();
  try { createSkyController(rec.gl, new URLSearchParams(search)); } catch { /* the mod's own data, after the passes */ }
  const fragments = new Set(rec.linked.map((l) => l.fs));
  return { clouds: fragments.has(CLOUD_PROGRAMS[0][1]), dynamicSky: fragments.has(DYNAMIC_SKIES_PROGRAMS[0][1]) };
}

test('BOOT-COMPILE: outdoorPasses answers the sky as the sky controller builds it - the clouds and the mod\'s sky, by every door and the environments switch', () => {
  const kept = getPref('enhancedEnvironments');
  try {
    for (const environments of [true, false]) {
      setPref('enhancedEnvironments', environments);
      for (const q of ['', 'sky=classic', 'clouds=off', 'sky=dynamic', 'sky=enhanced', 'sky=enhanced&clouds=off', 'sky=classic&clouds=off', 'sky=dynamic&clouds=off']) {
        const { clouds, dynamicSky } = outdoorPasses(`?${q}`);
        assert.deepEqual({ clouds, dynamicSky }, skyBuilt(q), `environments ${environments}, ?${q}`);
      }
    }
  } finally { setPref('enhancedEnvironments', kept); }
});

test('BOOT-COMPILE: the grass starts by the world host\'s own three switches - the environments, the density and the door', () => {
  const keptEnvironments = getPref('enhancedEnvironments');
  const keptDensity = getPref('grassDensity');
  try {
    setPref('enhancedEnvironments', true);
    setPref('grassDensity', 1);
    assert.equal(outdoorPasses('').grass, true);
    assert.equal(outdoorPasses('?grass=off').grass, false);
    setPref('grassDensity', 0);
    assert.equal(outdoorPasses('').grass, false);
    setPref('grassDensity', 1);
    setPref('enhancedEnvironments', false);
    assert.equal(outdoorPasses('').grass, false);
  } finally {
    setPref('enhancedEnvironments', keptEnvironments);
    setPref('grassDensity', keptDensity);
  }
});

test('BOOT-COMPILE (P2): a step whose pass a draw builds while the warm polls stands down - one compile, taken by the draw', async () => {
  let compiled = false;
  const rec = recordingGl({ complete: () => compiled });
  const r = new Renderer(rec.canvas);
  const charQuad = r.warmSteps()[2];
  let polls = 0;
  const warm = warmPrograms([charQuad], {
    idle: (fn) => setImmediate(() => {
      polls++;
      if (polls === 3) r._ensureCharQuadProgram();   // the first classic sprite drawn mid-compile
      if (polls === 5) compiled = true;
      fn();
    }),
  });
  assert.equal(await warm, 0, 'the warm built nothing');
  const charQuadLinks = rec.linked.filter((l) => l.program === r.charQuadProgram);
  assert.equal(charQuadLinks.length, 1, 'the draw took the started program');
  assert.equal(rec.linked.filter((l) => l.fs === charQuadLinks[0].fs).length, 1, 'and nothing compiled it twice');
});

test('BOOT-COMPILE (P2): the retro step is not needed while retro and the scale are off - its program is not started', async () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  r.setRetroSource(() => null);
  const retro = r.warmSteps().at(-1);
  assert.equal(retro.need(), false);
  const before = rec.linked.length;
  await warmPrograms([retro], { idle: (fn) => fn() });
  assert.equal(rec.linked.length, before, 'nothing compiled for a present nobody draws');
});

test('BOOT-COMPILE (P2): without the extension the telegraph\'s warm issues no compile ahead of its build', async () => {
  const rec = recordingGl({ parallel: false });
  const r = new Renderer(rec.canvas);
  const telegraph = r.lazyWarmSteps()[1];
  const ready = telegraph.start();
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ready(), true, 'the module is in');
  const telegraphFs = FOE_TELEGRAPH_PROGRAMS[0][1];
  assert.equal(rec.linked.filter((l) => l.fs === telegraphFs).length, 0, 'nothing compiled before the build');
  telegraph.run();
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.ok(r._foeTelegraph, 'built');
  assert.equal(rec.linked.filter((l) => l.fs === telegraphFs).length, 1, 'compiled once, by its build');
});

test('BOOT-COMPILE (P2): a telegraph a fight built before the warm\'s module arrived is not started again', async () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  await r._loadFoeTelegraph();
  assert.ok(r._foeTelegraph);
  const ready = r.lazyWarmSteps()[1].start();
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ready(), true);
  assert.equal(rec.linked.filter((l) => l.fs === FOE_TELEGRAPH_PROGRAMS[0][1]).length, 1, 'the fight\'s compile alone');
});

test('BOOT-COMPILE: a started program is taken only by a build of the same two sources - a changed shader compiles its own, never the stale start', () => {
  const rec = recordingGl();
  const vs = '#version 300 es\nvoid main() {}';
  const before = '#version 300 es\nprecision highp float;\nout vec4 c;\nvoid main() { c = vec4(0.0); }';
  const after = '#version 300 es\nprecision highp float;\nout vec4 c;\nvoid main() { c = vec4(1.0); }';
  startPrograms(rec.gl, [[vs, before]]);
  const started = rec.linked.at(-1).program;
  const built = buildProgram(rec.gl, vs, after);
  assert.notEqual(built, started, 'the changed source compiled its own program');
  assert.equal(rec.linked.at(-1).fs, after);
  assert.equal(buildProgram(rec.gl, vs, before), started, 'the start answers only its own sources');
});
