// FIRST-USE (#1144, bible/07-Rendering/Performance-Priority.md): THE PASSES STILL BUILT AT FIRST USE, THROUGH SHADER-STALL'S
// DOOR. Each was built behind a try-once latch the first frame it was wanted, and its LINK_STATUS read held that frame for
// the whole compile: Starfall's sky (at its idle warm), the rite's smoke, the Steps' and the Spans' ghosts, and the Elite
// Breach's look - its lines, sky, mist, motes, lights and halos. Each now lists its programs beside its constructor and is
// built once they are done (render/glProgram.js compiledPass); the ones the game is played by (the look's lines, the ghosts)
// are asked as needed and started at their owner's load, the rest stand a few frames late.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPrograms } from '../../src/render/glProgram.js';
import { StarfallPassRenderer, STARFALL_PROGRAMS } from '../../src/render/starfall/starfallPass.js';
import { RiteSmokeRenderer, RITE_SMOKE_PROGRAMS } from '../../src/render/riteSmoke.js';
import { SdStepsPass, sdStepsPrograms } from '../../src/render/superDungeon/sdStepsPass.js';
import { EgLinePass, EG_LINE_PROGRAMS } from '../../src/render/eliteGates/egLinePass.js';
import { EgSkyPass, EG_SKY_PROGRAMS } from '../../src/render/eliteGates/egSkyPass.js';
import { EgMistPass, EG_MIST_PROGRAMS } from '../../src/render/eliteGates/egMistPass.js';
import { EgMotesPass, EG_MOTES_PROGRAMS } from '../../src/render/eliteGates/egMotes.js';
import { EgLightPass, EG_LIGHT_PROGRAMS } from '../../src/render/eliteGates/egLightPass.js';
import { SdHaloRenderer, SD_HALO_PROGRAMS } from '../../src/render/superDungeon/sdHalo.js';
import { KtGaugeRenderer, KT_GAUGE_PROGRAMS } from '../../src/render/ketch/ktGaugePass.js';
import { GATE_PASS_PROGRAMS } from '../../src/render/gate/gatePass.js';
import { createEgLookDraw, startEgLookPrograms, EG_LOOK_PROGRAMS } from '../../src/scenes/eliteGates/egLookDraw.js';
import { EG_GHOSTS_MAX } from '../../src/scenes/eliteGates/egSpan.js';
import { createSdSteps } from '../../src/scenes/superDungeon/sdSteps.js';
import { EG_FOG_FLOOR } from '../../src/world/eliteGates/egLook.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A context whose driver finishes its compiles when the test says (`finish`), with or without the extension that can say
 *  so; `count(name)` the calls made - `link?` the LINK_STATUS read (the one that waits). */
function fakeGl({ parallel = true } = {}) {
  let next = 0;
  const log = [], progs = [], done = new Set();
  const ext = parallel ? { COMPLETION_STATUS_KHR: 0x91B1 } : null;
  const base = { VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82 };
  const gl = new Proxy(base, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      if (k in t) return t[k];
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      switch (k) {
        case 'getExtension': return (n) => (n === 'KHR_parallel_shader_compile' ? ext : null);
        case 'isContextLost': return () => false;
        case 'createProgram': return () => { const p = { id: next++ }; progs.push(p); log.push(['createProgram']); return p; };
        case 'getProgramParameter': return (p, pn) => {
          if (pn === base.LINK_STATUS) { log.push(['link?']); return true; }
          if (ext && pn === ext.COMPLETION_STATUS_KHR) return done.has(p);
          return null;
        };
        case 'getShaderParameter': return () => true;
        case 'getUniformLocation': return (p, n) => n;
        case 'getParameter': return () => 16;
        default: return (...a) => { log.push([k, ...a]); return { id: next++ }; };
      }
    },
  });
  return { gl, finish: () => { for (const p of progs) done.add(p); }, count: (name) => log.filter((x) => x[0] === name).length };
}

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('FIRST-USE every pass compiles nothing its list did not start: each constructor reads its programs from the list its owner starts and its door waits on - the Steps\' ghosts\' by their options (mutants: a constructor off its list; the ghosts\' options not the list\'s)', () => {
  const egGhosts = { max: EG_GHOSTS_MAX, slab: true, fogFloor: EG_FOG_FLOOR };
  for (const [name, programs, make] of [
    ['Starfall\'s sky', STARFALL_PROGRAMS, (gl) => new StarfallPassRenderer(gl)],
    ['the rite\'s smoke', RITE_SMOKE_PROGRAMS, (gl) => new RiteSmokeRenderer(gl)],
    ['the Steps\' ghosts', sdStepsPrograms(), (gl) => new SdStepsPass(gl)],
    ['the Spans\' ghosts', sdStepsPrograms(egGhosts), (gl) => new SdStepsPass(gl, [], egGhosts)],
    ['the look\'s lines', EG_LINE_PROGRAMS, (gl) => new EgLinePass(gl)],
    ['the look\'s sky', EG_SKY_PROGRAMS, (gl) => new EgSkyPass(gl)],
    ['the look\'s mist', EG_MIST_PROGRAMS, (gl) => new EgMistPass(gl)],
    ['the look\'s motes', EG_MOTES_PROGRAMS, (gl) => new EgMotesPass(gl)],
    ['the look\'s lights', EG_LIGHT_PROGRAMS, (gl) => new EgLightPass(gl)],
    ['the look\'s halos', SD_HALO_PROGRAMS, (gl) => new SdHaloRenderer(gl)],
    ['the Ketch\'s gauges', KT_GAUGE_PROGRAMS, (gl) => new KtGaugeRenderer(gl)],
  ]) {
    const f = fakeGl();
    startPrograms(f.gl, programs);
    f.finish();
    const started = f.count('createProgram');
    assert.equal(started, programs.length, `${name}: its programs started`);
    make(f.gl);
    assert.equal(f.count('createProgram'), started, `${name}: compiled nothing its list did not start`);
    assert.equal(f.count('link?'), programs.length, `${name}: one read a program`);
  }
  assert.deepEqual(STARFALL_PROGRAMS[0], GATE_PASS_PROGRAMS[1], 'Starfall\'s beacon is the gate\'s own, started with the passes play meets');
  assert.notDeepEqual(sdStepsPrograms(egGhosts), sdStepsPrograms(), 'the Spans\' options are sources of their own');
});

test('FIRST-USE the Elite Breach\'s look: its six programs started as the hall loads where the driver compiles beside the frames, and nothing where it cannot; its lines asked as needed (built the frame the circle is set, whatever the driver says), its sky and the rest only once their programs are done (mutants: started without the extension; a program left out; the lines not needed; the rest needed)', () => {
  assert.deepEqual(EG_LOOK_PROGRAMS, [...EG_LINE_PROGRAMS, ...EG_SKY_PROGRAMS, ...EG_MIST_PROGRAMS, ...EG_MOTES_PROGRAMS, ...EG_LIGHT_PROGRAMS, ...SD_HALO_PROGRAMS]);
  const on = fakeGl();
  assert.equal(startEgLookPrograms(on.gl), true);
  assert.equal(on.count('createProgram'), EG_LOOK_PROGRAMS.length, 'each started');
  assert.equal(on.count('link?'), 0, 'nothing waited on');
  const off = fakeGl({ parallel: false });
  assert.equal(startEgLookPrograms(off.gl), false);
  assert.equal(off.count('createProgram'), 0, 'no compile queued where none can be asked after');
  assert.equal(startEgLookPrograms(null), false);
  // the look over a driver still compiling
  const f = fakeGl();
  const look = createEgLookDraw({ gl: f.gl, lite: false });
  look.setCircle(12345, 1, 0);
  assert.equal(look.state().passes.lines, true, 'the lines: built the frame the circle is set');
  assert.equal(f.count('link?'), 1, 'and that frame waited for them alone');
  look.drawSky(I, I, 0, null, 1);
  assert.equal(look.state().passes.sky, false, 'the sky: none while its program compiles');
  assert.equal(f.count('link?'), 1, 'and no read that waits');
  f.finish();
  look.drawSky(I, I, 0, null, 1);
  assert.equal(look.state().passes.sky, true, 'built the first frame after its program is done');
  assert.equal(f.count('link?'), 2);
});

test('FIRST-USE the ghosts: the Steps\' program started as the realm loads, the Spans\' and the look\'s as the hall does, where the driver compiles beside the frames; each drawn pass asked as needed through its door, made again after a clear; the rite\'s smoke through a door never asked as needed; Starfall\'s idle warm a step that names its programs (mutants: no start at the load; the ghosts not needed; the look not started with the hall; the smoke needed; the warm a bare step)', () => {
  const f = fakeGl();
  createSdSteps({ renderer: { gl: f.gl } });
  assert.equal(f.count('createProgram'), sdStepsPrograms().length, 'the Steps\' ghosts started with the realm');
  assert.equal(f.count('link?'), 0, 'nothing waited on');
  const off = fakeGl({ parallel: false });
  createSdSteps({ renderer: { gl: off.gl } });
  assert.equal(off.count('createProgram'), 0, 'nothing started where the driver cannot say');
  const steps = read('src/scenes/superDungeon/sdSteps.js'), span = read('src/scenes/eliteGates/egSpan.js');
  for (const [name, src] of [['the Steps', steps], ['the Spans', span]]) {
    assert.match(src, /const ghostsDoor = \(\) => \(renderer\?\.gl \? compiledPass\(renderer\.gl, sdStepsPrograms\(/, `${name}: through the door`);
    assert.match(src, /pass \?\?= passOf\?\.\(true\) \?\? null;/, `${name}: asked as needed`);
    assert.match(src, /pass = null; passOf = ghostsDoor\(\);/, `${name}: a fresh door after a clear`);
    assert.doesNotMatch(src, /passTried/, `${name}: no latch of its own`);
  }
  assert.match(span, /if \(renderer\?\.gl && parallelCompile\(renderer\.gl\)\) \{ startPrograms\(renderer\.gl, sdStepsPrograms\(ghostOpts\)\); startEgLookPrograms\(renderer\.gl\); \}/, 'the Spans\' and the look\'s started with the hall');
  const rite = read('src/scenes/riteHost.js');
  assert.match(rite, /const smokeOf = gl \? compiledPass\(gl, RITE_SMOKE_PROGRAMS, \(\) => new RiteSmokeRenderer\(gl\),/);
  assert.match(rite, /if \(!smokePass && smokeOf && smokeFade\(t\) > 0\) smokePass = smokeOf\(\);/, 'never asked as needed');
  assert.match(read('src/scenes/starfall/starfallHost.js'), /void warmPrograms\(\[\{ start: \(\) => startPrograms\(renderer\.gl, STARFALL_PROGRAMS\), run: ensurePass, need: \(\) => !pass && !passTried \}\]\);/);
});
