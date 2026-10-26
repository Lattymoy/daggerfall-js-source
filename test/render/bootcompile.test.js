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
import { startPrograms } from '../../src/render/glProgram.js';
import { VolumetricClouds, CLOUD_PROGRAMS } from '../../src/render/volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from '../../src/render/cloudNoise.js';
import { DynamicSkiesRenderer, DYNAMIC_SKIES_PROGRAMS } from '../../src/render/dynamicSkiesRenderer.js';
import { LabGrassRenderer, labGrassPrograms } from '../../src/render/labGrass.js';
import { outdoorPasses } from '../../src/render/bootPrograms.js';
import { playPrograms } from '../../src/render/playPrograms.js';
import { SNOW_VS, snowTerrainFs } from '../../src/render/snowfallGlsl.js';

const COMPLETION_STATUS_KHR = 0x91B1;

/** stateGl's context, with every link recorded and every LINK_STATUS read marked; `parallel` gives it
 *  KHR_parallel_shader_compile, whose compiles are always done. */
function recordingGl({ parallel = true } = {}) {
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
          if (name === COMPLETION_STATUS_KHR) return true;
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
  const listed = r.laneBootPrograms(EL_LANE, { air: true, clip: true });
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
  assert.deepEqual(r.laneBootPrograms(EL_LANE, { air: true, clip: true }), [], 'nothing left to start once the lane is installed');
});

test('BOOT-COMPILE: the classic page lists only the clip, and the air only with its door open', () => {
  const r = new Renderer(recordingGl().canvas);
  assert.equal(r.laneBootPrograms(null, { air: true, clip: false }).length, 0);
  assert.equal(r.laneBootPrograms(null, { air: true, clip: true }).length, 1);
  const withAir = r.laneBootPrograms(EL_LANE, { air: true }).length;
  const withoutAir = r.laneBootPrograms(EL_LANE, { air: false }).length;
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
