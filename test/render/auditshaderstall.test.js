// AUDIT SHADER-STALL (2026-10-20, the owner: "I need you to audit this and ensure this is perfect and fidelity isnt lost";
// bible/07-Rendering/Performance-Priority.md SHADER-STALL, the audit): A PASS THE GAME IS PLAYED BY IS NEVER SKIPPED FOR A
// COMPILE. SHADER-STALL built a pass in play once the driver said its compile was done; the audit found the Elite Breach's
// telegraphs and crystals could be missing for a whole compile (seconds on D3D11) while a lord's first blow wound up and
// landed. Held here: a door asked with `true` builds its pass that frame whatever the driver says, and the fights' doors
// ask so when a telegraph, a crystal, a blow or a way out must be seen; the passes play meets are started at the boot's
// idle where the driver compiles beside the frames, and nowhere else; a warm whose pass the draw built stands down (no
// second compile); a pass whose build threw lets its other started programs go; the court's warm skips a pass already
// built; the veil's warm builds it at an idle once its program is done.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPrograms, buildProgram, compiledPass, releasePrograms } from '../../src/render/glProgram.js';
import { warmPrograms } from '../../src/render/warmPrograms.js';
import { playPrograms, startPlayPrograms } from '../../src/render/playPrograms.js';
import { GATE_PASS_PROGRAMS } from '../../src/render/gate/gatePass.js';
import { telegraphPrograms } from '../../src/render/gate/gateTelegraph.js';
import { GATE_FX_PROGRAMS } from '../../src/render/gate/gateFx.js';
import { CRYSTAL_PROGRAMS } from '../../src/render/courtCrystals.js';
import { NODE_GLINT_PROGRAMS } from '../../src/render/nodeGlint.js';
import { GATE_VEIL_PROGRAMS } from '../../src/render/gate/gateVeil.js';
import { createGateCourt } from '../../src/scenes/gate/gateCourt.js';
import { createGateVeil } from '../../src/ui/gate/gateVeil.js';
import { GATE_STATE_EMPTY } from '../../src/net/gate/gateLink.js';
import { ATTACKS } from '../../src/net/gate/gateBrain.js';
import { courtToDungeon } from '../../src/world/gate/gateArena.js';
import { destroyGateBossBar } from '../../src/ui/gate/gateBossBar.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** test/render/shaderstall.test.js's context: a driver that finishes its compiles when told (`finish`), with or without
 *  the extension that can say so; `count(name)` the calls - `link?` the LINK_STATUS read that waits, `done?` the asking. */
function fakeGl({ parallel = true, fails = [] } = {}) {
  let next = 0;
  const log = [], progs = [], done = new Set(), sources = new Map(), attached = new Map();
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
        case 'createProgram': return () => { const p = { id: next++ }; progs.push(p); attached.set(p, []); log.push(['createProgram']); return p; };
        case 'shaderSource': return (s, src) => { sources.set(s, src); };
        case 'attachShader': return (p, s) => { attached.get(p).push(s); };
        case 'getProgramParameter': return (p, pn) => {
          if (pn === base.LINK_STATUS) { log.push(['link?']); return !attached.get(p).some((s) => fails.includes(sources.get(s))); }
          if (ext && pn === ext.COMPLETION_STATUS_KHR) { log.push(['done?']); return done.has(p); }
          return null;
        };
        case 'getShaderParameter': return (s) => !fails.includes(sources.get(s));
        case 'getShaderInfoLog': return () => 'ERROR: 0:1: boom';
        case 'getProgramInfoLog': return () => 'link boom';
        case 'getUniformLocation': return (p, n) => n;
        default: return (...a) => { log.push([k, ...a]); return { id: next++ }; };
      }
    },
  });
  return { gl, finish: () => { for (const p of progs) done.add(p); }, count: (name) => log.filter((x) => x[0] === name).length };
}

test('AUDIT SHADER-STALL the door: asked with `true` it builds the pass now whatever the driver says - on the program it started, its one read the old wait - and then it is settled; asked bare while the compile runs, nothing (mutants: the need unread; settled never)', () => {
  const f = fakeGl();
  let builds = 0;
  const door = compiledPass(f.gl, [['v', 'f']], () => { builds++; return { prog: buildProgram(f.gl, 'v', 'f', 'x') }; });
  assert.equal(door(), null, 'compiling: not yet');
  assert.equal(door.settled, false);
  assert.equal(f.count('link?'), 0);
  const p = door(true);
  assert.ok(p, 'needed: built');
  assert.equal(f.count('createProgram'), 1, 'on the started program');
  assert.equal(f.count('link?'), 1, 'its one read');
  assert.equal(door.settled, true);
  assert.equal(door(true), p, 'once');
  assert.equal(builds, 1);
  const none = compiledPass(null, [['v', 'f']], () => ({}));
  assert.equal(none(true), null, 'no context: nothing, needed or not');
});

test('AUDIT SHADER-STALL a pass whose build threw lets its other started programs go - before the slice the first fault threw before the second was made; started, it stayed for good (mutants: the release skipped)', () => {
  const f = fakeGl({ parallel: false, fails: ['bad'] });
  const told = [];
  const door = compiledPass(f.gl, [['v', 'bad'], ['v2', 'f2']], () => { buildProgram(f.gl, 'v', 'bad', 'one'); buildProgram(f.gl, 'v2', 'f2', 'two'); }, (e) => told.push(e.message));
  assert.equal(door(), null);
  assert.deepEqual(told, ['one shader: ERROR: 0:1: boom'], 'the same word as ever');
  assert.equal(f.count('createProgram'), 2, 'both started');
  assert.equal(f.count('deleteProgram'), 2, 'the failed one by its build, the other let go');
  assert.equal(door.settled, true, 'tried once');
  // let go means gone: a later build of the second compiles its own
  buildProgram(f.gl, 'v2', 'f2', 'two');
  assert.equal(f.count('createProgram'), 3);
  releasePrograms(f.gl, [['nothing', 'here']]);   // a pair never started: nothing
  assert.equal(f.count('deleteProgram'), 2);
});

test('AUDIT SHADER-STALL a warm whose pass the draw built meanwhile stands down - its poll never starts a second compile of the programs the build took, and its run is not asked (mutants: the need unread)', async () => {
  const f = fakeGl();
  let taken = false, ran = 0;
  const idles = [];
  const warm = warmPrograms([{ start: () => startPrograms(f.gl, [['a', 'b']]), run: () => { ran++; }, need: () => !taken }], { idle: (fn) => idles.push(fn) });
  const step = async () => { idles.shift()(); await new Promise((r) => setImmediate(r)); };
  await step();   // the first idle: started, still compiling
  assert.equal(f.count('createProgram'), 1);
  buildProgram(f.gl, 'a', 'b', 'draw');   // the draw path needed it first and took it
  taken = true;
  await step();   // the poll's idle
  assert.equal(await warm, 0, 'no step ran');
  assert.equal(ran, 0);
  assert.equal(f.count('createProgram'), 1, 'never a second compile');
});

test('AUDIT SHADER-STALL the passes play meets are started at the boot\'s idle where the driver compiles beside the frames - every one a fight or a gate or a node draws - and nothing is started where it cannot (mutants: started without the extension; a pass left out)', () => {
  const want = [...GATE_PASS_PROGRAMS, ...telegraphPrograms(false), ...telegraphPrograms(true), ...GATE_FX_PROGRAMS, ...CRYSTAL_PROGRAMS, ...NODE_GLINT_PROGRAMS];
  assert.deepEqual(playPrograms(), want);
  const on = fakeGl();
  assert.equal(startPlayPrograms(on.gl), true);
  assert.equal(on.count('createProgram'), want.length, 'each started');
  assert.equal(on.count('link?'), 0, 'nothing waited on');
  const off = fakeGl({ parallel: false });
  assert.equal(startPlayPrograms(off.gl), false);
  assert.equal(off.count('createProgram'), 0, 'no compile queued where none can be asked after');
  assert.equal(startPlayPrograms(null), false);
  const r = read('src/render/renderer.js');
  assert.match(r, /\(\) => \{ if \(parallelCompile\(this\.gl\)\) \{ void import\('\.\/playPrograms\.js'\)\.then\(\(m\) => m\.startPlayPrograms\(this\.gl\)\)\.catch\(\(\) => \{\}\); this\.startTerrainSnow\(\); \} \},/, 'the renderer\'s idle warm, off the boot\'s graph, the snow\'s surface with them');
  assert.ok(!/^import [^\n]*playPrograms/m.test(r), 'never a static import');
});

test('AUDIT SHADER-STALL the fights ask their passes NEEDED when a telegraph, a crystal, a blow or a way out must be seen - the Elite Breach\'s and the court\'s (mutants: each need dropped)', () => {
  const eg = read('src/scenes/eliteGates/egFight.js');
  assert.match(eg, /crystalPass = crystalsOf\(true\);/);
  assert.match(eg, /pass = telegraphOf\(_shapes\.length > 0\);/);
  const court = read('src/scenes/gate/gateCourt.js');
  assert.match(court, /const crystalPass = crystalPassOf\(true\);/);
  assert.match(court, /const pass = telegraphPass\(!!\(mark \|\| shape \|\| poolDraw\.length\)\);/);
  assert.match(court, /const fxPass = fxPassOf\(true\);/);
  assert.match(court, /const fire = _fires\.length \? portalPass\(true\) : null;/);
});

test('AUDIT SHADER-STALL the court: a blow\'s telegraph is drawn the first frame it is wanted, the driver still compiling - built then, never skipped (mutants: the telegraph\'s need dropped)', () => {
  destroyGateBossBar();
  const f = fakeGl();
  const clock = { t: 0 };
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const c = createGateCourt({
    renderer: null, gl: f.gl, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20),
    audio: { play3d() {}, play3dId() {} }, feet: () => courtToDungeon(1, 0, 1), player: () => ({ health: 500, maxHealth: 500 }), save: () => 0,
    strike: () => {}, rng: () => 0.5, send: () => true,
  });
  link.st = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, atk: { i: 1, a: ATTACKS.slam.id, at: 10_000, x: 0, z: 0, yw: 0, tg: [] } };
  clock.t = 9000; c.frame();
  const before = f.count('link?');
  const m = new Float32Array(16);
  const drew = c.drawPass(m, m, courtToDungeon(0, 1.7, 20), 0);
  assert.ok(f.count('link?') > before, 'the telegraph built while the driver compiles');
  assert.equal(drew, true, 'and drawn');
  c.destroy?.();
});

test('AUDIT SHADER-STALL the court\'s warm: where the driver cannot say, one pass a frame - and a pass the draw already built is no frame\'s (GATE-MIX\'s own skip, lost in the merge) (mutants: the settled skip dropped)', () => {
  const court = read('src/scenes/gate/gateCourt.js');
  assert.match(court, /const warmDoors = \[fxPassOf, crystalPassOf, portalPass\];/, 'the doors themselves - each one\'s `settled` readable');
  assert.match(court, /while \(warmed < warmDoors\.length && warmDoors\[warmed\]\.settled\) warmed\+\+;/);
});

test('AUDIT SHADER-STALL the veil: its warm starts its program and, at an idle once the driver says it is done, BUILDS it - its link read, its uniforms found - so the step\'s frame builds nothing (AUDIT WB D5\'s warm, kept); a veil destroyed meanwhile is never built (mutants: the warm only starts it)', async () => {
  const f = fakeGl();
  const canvas = { style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => f.gl };
  const doc = { body: { appendChild() {} }, createElement: () => canvas };
  const idles = [];
  const prev = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = (fn) => idles.push(fn);
  try {
    const veil = createGateVeil({ doc, raf: () => {}, now: () => 1000, engine: { soundIndexForId: () => -1, playOneShot() {} }, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 } });
    assert.equal(veil.warm(), true);
    assert.equal(f.count('createProgram'), GATE_VEIL_PROGRAMS.length, 'started');
    const step = async () => { idles.shift()?.(); await new Promise((r) => setImmediate(r)); };
    await step(); await step();
    assert.equal(f.count('link?'), 0, 'not built while it compiles');
    f.finish();
    await step();
    assert.equal(f.count('link?'), GATE_VEIL_PROGRAMS.length, 'built at the idle after it is done');
    void veil.cover();
    assert.equal(f.count('link?'), GATE_VEIL_PROGRAMS.length, 'and the step builds nothing');
    assert.equal(f.count('createProgram'), GATE_VEIL_PROGRAMS.length, 'on the started program');
    veil.destroy();
    // a second veil destroyed before its compile is done: never built
    const g = fakeGl();
    const canvas2 = { ...canvas, getContext: () => g.gl };
    const veil2 = createGateVeil({ doc: { body: { appendChild() {} }, createElement: () => canvas2 }, raf: () => {}, now: () => 1000, engine: { soundIndexForId: () => -1, playOneShot() {} }, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 } });
    veil2.warm();
    veil2.destroy();
    g.finish();
    for (let i = 0; i < 4; i++) await step();
    assert.equal(g.count('link?'), 0, 'destroyed: never built');
  } finally { globalThis.requestIdleCallback = prev; }
});
