// SHADER-STALL (2026-10-20, a player via the owner: "Gate shader initialization: 11.43-second stall", "Node-outline shader
// initialization: 5.65-second stall"): A PASS BUILT IN PLAY NEVER WAITS ON ITS COMPILE. render/glProgram.js starts a
// pass's programs and asks the driver whether they are done without waiting (KHR_parallel_shader_compile); the build that
// follows takes each started program, so its one read waits on nothing. The world's gate fire, the courts' passes, the
// nodes' glint (the outline's before NODE-GLINT) and the sea's warm are built through it (bible/07-Rendering/Performance-Priority.md SHADER-STALL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPrograms, buildProgram, compiledPass } from '../../src/render/glProgram.js';
import { warmPrograms } from '../../src/render/warmPrograms.js';
import { GatePassRenderer, GATE_PASS_PROGRAMS } from '../../src/render/gate/gatePass.js';
import { GateTelegraphRenderer, telegraphPrograms } from '../../src/render/gate/gateTelegraph.js';
import { GateFxRenderer, GATE_FX_PROGRAMS } from '../../src/render/gate/gateFx.js';
import { GateVeilRenderer, GATE_VEIL_PROGRAMS } from '../../src/render/gate/gateVeil.js';
import { CourtCrystalRenderer, CRYSTAL_PROGRAMS } from '../../src/render/courtCrystals.js';
import { NodeGlintRenderer, NODE_GLINT_PROGRAMS, createNodeGlintPass } from '../../src/render/nodeGlint.js';   // NODE-GLINT (main, 2026-10-20) moved the nodes' outline to their glint: the same two-program pass
import { ComeSailAwayRenderer, CSA_PART_PROGRAMS, CSA_WAVE_PROGRAMS } from '../../src/render/comeSailAwayRender.js';
import { SpellImpactPass, SPELL_IMPACT_PROGRAMS } from '../../src/render/spellImpactFx.js';
import { AuraRingRenderer, AURA_PROGRAMS, AURA_KINDS, auraPrograms } from '../../src/render/auraRing.js';   // AURA-STALL (#1137), AURA-SPLIT (#1143): the auras' looks, each through a door of its own
import { startPlayPrograms } from '../../src/render/playPrograms.js';
import { buildGateModel, gateArchProfile } from '../../src/world/gate/gateModel.js';
import { createGatePool } from '../../src/scenes/gate/gatePool.js';
import { createGateCourt } from '../../src/scenes/gate/gateCourt.js';
import { GATE_STATE_EMPTY } from '../../src/net/gate/gateLink.js';
import { gateTimes, GATE_RISE_MS } from '../../src/net/gate/gateLaw.js';
import { createGateVeil } from '../../src/ui/gate/gateVeil.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A context whose driver finishes its compiles when the test says (`finish`), with or without the extension that can
 *  say so; `count(name)` the calls made - `link?` the LINK_STATUS read (the one that waits), `done?` the asking. */
function fakeGl({ parallel = true, fails = [] } = {}) {
  let next = 0, lost = false;
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
        case 'isContextLost': return () => lost;
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
  return { gl, progs, finish: () => { for (const p of progs) done.add(p); }, lose: () => { lost = true; }, count: (name) => log.filter((x) => x[0] === name).length };
}

test('SHADER-STALL the door (glProgram.js startPrograms): the programs started with nothing read back, asked whether done without the read that waits, and the build after takes each started program - its one read, no second compile; taken once (mutants: the started program never taken; a read at the start; done before the driver says)', () => {
  const f = fakeGl();
  const ready = startPrograms(f.gl, [['v1', 'f1'], ['v2', 'f2']]);
  assert.equal(f.count('createProgram'), 2);
  assert.equal(f.count('linkProgram'), 2, 'both compiled and linked');
  assert.equal(f.count('link?'), 0, 'nothing read back at the start');
  assert.equal(ready(), false, 'not done until the driver says');
  assert.equal(f.count('link?'), 0, 'asking is not the read that waits');
  assert.ok(f.count('done?') > 0);
  f.finish();
  assert.equal(ready(), true);
  const p = buildProgram(f.gl, 'v1', 'f1', 'one');
  assert.equal(p, f.progs[0], 'the started program, taken');
  assert.equal(f.count('createProgram'), 2, 'no second compile');
  assert.equal(f.count('link?'), 1, 'its one read');
  assert.equal(f.count('deleteShader'), 2, 'its two stages flagged with it (AUDIT EG V)');
  const again = buildProgram(f.gl, 'v1', 'f1');
  assert.notEqual(again, p);
  assert.equal(f.count('createProgram'), 3, 'taken once: a second build compiles its own');
  assert.equal(buildProgram(f.gl, 'v2', 'f2'), f.progs[1]);
});

test('SHADER-STALL the door where the driver cannot say: no extension, or a lost context - done at once, and the build waits as it always did, on the started program; a fault still throws its stage\'s log and frees the program (mutants: a browser without the extension never done)', () => {
  const f = fakeGl({ parallel: false });
  const ready = startPrograms(f.gl, [['a', 'b']]);
  assert.equal(ready(), true, 'no extension: done at once');
  assert.equal(buildProgram(f.gl, 'a', 'b'), f.progs[0], 'and the started program taken');
  const g = fakeGl();
  const lost = startPrograms(g.gl, [['a', 'b']]);
  g.lose();
  assert.equal(lost(), true, 'a lost context: the build is the one that says why');
  const h = fakeGl({ fails: ['bad'] });
  startPrograms(h.gl, [['v', 'bad']]);
  h.finish();
  assert.throws(() => buildProgram(h.gl, 'v', 'bad', 'gate membrane'), { message: 'gate membrane shader: ERROR: 0:1: boom' });
  assert.equal(h.count('deleteProgram'), 1, 'a build that throws frees its program');
});

test('SHADER-STALL the door shared: sources started twice are one start; a program another build took is started again for the one still waiting, and that one takes it (mutants: the waiting one handed a program taken from under it)', () => {
  const f = fakeGl();
  const a = startPrograms(f.gl, [['v', 'f']]), b = startPrograms(f.gl, [['v', 'f']]);
  assert.equal(f.count('createProgram'), 1, 'one start');
  f.finish();
  assert.equal(a(), true);
  assert.equal(buildProgram(f.gl, 'v', 'f'), f.progs[0]);
  assert.equal(b(), false, 'its program taken: started again, and not done yet');
  assert.equal(f.count('createProgram'), 2);
  f.finish();
  assert.equal(b(), true);
  assert.equal(buildProgram(f.gl, 'v', 'f'), f.progs[1], 'the one started for it');
  assert.equal(f.count('createProgram'), 2);
});

test('SHADER-STALL compiledPass: the pass built the first time it is asked for AND its programs are done - null until then, the same pass after; a build that throws is told once and answers null for good; no GL, no pass (mutants: built while compiling; built twice)', () => {
  const f = fakeGl();
  let made = 0;
  const get = compiledPass(f.gl, [['v', 'f']], () => { made++; return { prog: buildProgram(f.gl, 'v', 'f') }; });
  assert.equal(get(), null);
  assert.equal(get(), null);
  assert.equal(made, 0, 'never built while compiling');
  assert.equal(f.count('link?'), 0, 'and never waited');
  f.finish();
  const pass = get();
  assert.equal(pass?.prog, f.progs[0], 'built on the started program');
  assert.equal(get(), pass);
  assert.equal(made, 1, 'once');
  const told = [];
  let n = 0;
  const bad = compiledPass(fakeGl({ parallel: false }).gl, [['v', 'f']], () => { n++; throw new Error('no'); }, (e) => told.push(e.message));
  assert.equal(bad(), null);
  assert.equal(bad(), null);
  assert.equal(n, 1);
  assert.deepEqual(told, ['no']);
  assert.equal(compiledPass(null, [['v', 'f']], () => ({}))(), null, 'no GL: none');
});

test('SHADER-STALL every pass built through the door compiles nothing its list did not start: each constructor reads its programs from the list the host starts (mutants: a list that misses a program)', () => {
  const profile = gateArchProfile(buildGateModel());
  for (const [name, programs, make] of [
    ['the gate\'s fire', GATE_PASS_PROGRAMS, (gl) => new GatePassRenderer(gl, profile)],
    ['the court\'s telegraph', telegraphPrograms(false), (gl) => new GateTelegraphRenderer(gl)],
    ['the Spire\'s telegraph', telegraphPrograms(true), (gl) => new GateTelegraphRenderer(gl, { spire: true })],
    ['his blows', GATE_FX_PROGRAMS, (gl) => new GateFxRenderer(gl)],
    ['the crystals', CRYSTAL_PROGRAMS, (gl) => new CourtCrystalRenderer(gl)],
    ['the veil', GATE_VEIL_PROGRAMS, (gl) => new GateVeilRenderer(gl)],
    ['the nodes\' glint', NODE_GLINT_PROGRAMS, (gl) => new NodeGlintRenderer(gl)],
    ['the sea\'s particles', CSA_PART_PROGRAMS, (gl) => new ComeSailAwayRenderer({ gl })._ensurePart()],
    ['the sea\'s waves', CSA_WAVE_PROGRAMS, (gl) => new ComeSailAwayRenderer({ gl })._ensureWave()],
    ['the spells\' impacts', SPELL_IMPACT_PROGRAMS, (gl) => new SpellImpactPass(gl)],
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
});

test('SHADER-STALL the world\'s gate: its fire is built the first frame its programs are done - not the frame it first stands, and never a read that waits before (mutants: the fire built at its first stand)', () => {
  const f = fakeGl();
  const t = gateTimes(700);
  const clock = { now: t.riseAt + GATE_RISE_MS + 1000 };
  const pool = createGatePool({
    renderer: null, gl: f.gl, collider: () => null,
    standing: () => ({ day: 700, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham', phase: 'sealed' }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 12, now: () => clock.now,
  });
  assert.ok(pool.frame(0.016), 'it stands');
  assert.equal(f.count('createProgram'), GATE_PASS_PROGRAMS.length, 'its programs started');
  pool.frame(0.016);
  assert.equal(f.count('link?'), 0, 'not built, never waited, while they compile');
  f.finish();
  pool.frame(0.016);
  assert.equal(f.count('link?'), GATE_PASS_PROGRAMS.length, 'built the frame they are done');
  assert.equal(f.count('createProgram'), GATE_PASS_PROGRAMS.length, 'on the started programs');
  pool.frame(0.016);
  assert.equal(f.count('link?'), GATE_PASS_PROGRAMS.length, 'once');
});

test('SHADER-STALL the court: its telegraph started with the court (the boot, online) and built in the first draw after its program is done - the court\'s creation reads nothing back (mutants: the telegraph built with the court)', () => {
  const f = fakeGl();
  const c = createGateCourt({ renderer: null, gl: f.gl, link: { state: () => GATE_STATE_EMPTY }, now: () => 0, say: () => {} });
  assert.equal(f.count('createProgram'), 1, 'the telegraph\'s program started');
  assert.equal(f.count('link?'), 0, 'and nothing waited on');
  const m = new Float32Array(16);
  c.drawPass(m, m, [0, 0, 0], 0);
  assert.equal(f.count('link?'), 0, 'not built while it compiles');
  f.finish();
  c.drawPass(m, m, [0, 0, 0], 0);
  assert.equal(f.count('link?'), 1, 'built the first draw after');
  assert.equal(f.count('createProgram'), 1, 'on the started program');
});

test('SHADER-STALL the veil: its warm (the first frame a gate stands, at idle) makes its context and STARTS its program - nothing waited on; the step\'s build takes it compiled (mutants: the warm builds the veil whole)', () => {
  const f = fakeGl();
  const canvas = { style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => f.gl };
  const doc = { body: { appendChild() {} }, createElement: () => canvas };
  const veil = createGateVeil({ doc, raf: () => {}, now: () => 1000, engine: { soundIndexForId: () => -1, playOneShot() {} }, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 } });
  assert.equal(veil.warm(), true);
  assert.equal(f.count('createProgram'), GATE_VEIL_PROGRAMS.length, 'its program started');
  assert.equal(f.count('link?'), 0, 'and nothing waited on');
  f.finish();
  void veil.cover();
  assert.equal(f.count('link?'), GATE_VEIL_PROGRAMS.length, 'the step builds it');
  assert.equal(f.count('createProgram'), GATE_VEIL_PROGRAMS.length, 'on the started program');
  veil.destroy();
});

test('SHADER-STALL the nodes\' glint (the outline before NODE-GLINT): the first node lit starts its programs, and the build waits at idle only once they are done (mutants: the idle build asked while they compile)', () => {
  const renderer = { gl: {}, _camPos: new Float32Array([0, 1.6, 0]), markForeignPass: () => {} };
  const idled = [];
  let done = false, started = 0, builds = 0;
  const pass = createNodeGlintPass(renderer, { glow: { draw: () => 0 }, now: () => 1, build: () => { builds++; return /** @type {any} */ ({ draw: () => 0, dispose() {} }); },
    start: () => { started++; return () => done; }, idle: (fn) => idled.push(fn), reduced: () => false });
  const herb = { key: 'herb:1', profession: 'herbalism', at: [0, 0, -5], w: 2, h: 1, pictures: [{ batch: {}, first: 0, count: 1 }] };
  pass.draw([herb]);
  pass.draw([herb]);
  assert.equal(started, 1, 'started once, at the first node lit');
  assert.equal(idled.length, 0, 'no build asked while they compile');
  done = true;
  pass.draw([herb]);
  assert.equal(idled.length, 1, 'the build at idle once they are done');
  idled[0]();
  assert.equal(builds, 1);
});

test('SHADER-STALL the warm\'s named steps (warmPrograms): a step that names its programs runs only once the driver says they are done, asked again at each idle wait; a bare step runs as it did; a warm that ends while one compiles runs nothing more (mutants: the named step run at its first idle)', async () => {
  const ran = [];
  let polls = 0;
  const done = await warmPrograms([
    () => ran.push('bare'),
    { start: () => () => ++polls >= 3, run: () => ran.push('named') },
  ], { idle: (fn) => fn() });
  assert.deepEqual(ran, ['bare', 'named']);
  assert.equal(done, 2);
  assert.equal(polls, 3, 'asked until done');
  let alive = true, idles = 0;
  const cut = await warmPrograms([{ start: () => () => false, run: () => ran.push('never') }], { idle: (fn) => { if (++idles === 3) alive = false; fn(); }, alive: () => alive });
  assert.equal(cut, 0);
  assert.ok(!ran.includes('never'), 'a warm that ends runs nothing more');
});

test('SHADER-STALL the wiring: the world\'s sea warm and the spells\' impact pass by their named steps; the Elite Gates\' telegraphs and crystals through the door, made again for each breach', () => {
  assert.match(read('src/scenes/world.js'), /if \(csaRender\) void warmPrograms\(csaRender\.warmSteps\(\)\);/);
  // PIN MOVED (AUDIT SHADER-STALL, 2026-10-20): and its `need` - a spell's draw built the pass first, the warm stands down
  assert.match(read('src/scenes/hostMagic.js'), /void warmPrograms\(\[\{ start: \(\) => startPrograms\(renderer\.gl, SPELL_IMPACT_PROGRAMS\), run: \(\) => \{ if \(!fxPass && !fxBroken\) fxPass = new SpellImpactPass\(renderer\.gl\); \}, need: \(\) => !fxPass && !fxBroken \}\]/);
  const eg = read('src/scenes/eliteGates/egFight.js');
  assert.match(eg, /const telegraphDoor = \(\) => compiledPass\(gl, telegraphPrograms\(true\), \(\) => new GateTelegraphRenderer\(gl, \{ spire: true \}\)/);
  assert.match(eg, /const crystalDoor = \(\) => compiledPass\(gl, CRYSTAL_PROGRAMS, \(\) => new CourtCrystalRenderer\(gl\)/);
  assert.match(eg, /pass = null; crystalPass = null; telegraphOf = telegraphDoor\(\); crystalsOf = crystalDoor\(\);/);
  assert.doesNotMatch(eg, /new GateTelegraphRenderer\(gl, \{ spire: true \}\); \}/, 'no build outside the door');
});

// AURA-STALL (#1137) and AURA-SPLIT (#1143, bible/07-Rendering/Performance-Priority.md): the auras' one program was 81 KB
// of fragment shader, and its build at the first wearer in range held the main thread 8.5-11 s on D3D11 - met on the frame
// the travel view came down near a crowd, since the view draws no aura. Each look is now a program of its own (67 ms to
// 1.65 s alone on the same machine), started at the boot's idle and built at its own door the first time its look is drawn.
test('AURA-SPLIT the auras\' looks: one program a look - the whole source with `uAura` a constant - every one started at the boot\'s idle with the passes play meets; the pass compiles nothing at its build; a look\'s program built the first draw after its compile is done, on the started program, a wearer of a look still compiling standing without it, and bound again only where the look changes; without the extension a look is built at its first draw; the world builds the pass through a door that waits on no program (mutants: left out of the boot\'s start; a look off its list; a look asked as needed in the draw; bound for every wearer; the world\'s door waiting on the looks; built outside the door)', () => {
  assert.equal(AURA_PROGRAMS.length, AURA_KINDS.length, 'a program a look');
  for (const k of AURA_KINDS) {
    const [[vs, fs]] = auraPrograms(k);
    assert.ok(vs.includes(`const int uAura = ${k};`) && fs.includes(`const int uAura = ${k};`), `look ${k}: its kind a constant`);
    assert.ok(!vs.includes('uniform int uAura;') && !fs.includes('uniform int uAura;'), `look ${k}: no uniform for it`);
  }
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const two = [{ at: [1, 0, 1] }, { at: [5, 0, 5], aura: 'oblivionward' }];
  const f = fakeGl();
  assert.equal(startPlayPrograms(f.gl), true);
  const started = f.count('createProgram');
  const r = new AuraRingRenderer(f.gl);
  assert.equal(f.count('createProgram'), started, 'the pass compiles nothing at its build');
  r.draw(two, I, I, [0, 0, 0], 1);
  assert.equal(r.drawn, 0, 'compiling: no wearer drawn this frame');
  assert.equal(f.count('link?'), 0, 'and no read that waits');
  f.finish();
  r.draw(two, I, I, [0, 0, 0], 1);
  assert.equal(r.drawn, 2, 'both drawn the first frame after their programs are done');
  assert.equal(f.count('link?'), 2, 'one read a look, of a link already made');
  assert.equal(f.count('createProgram'), started, 'on the started programs');
  const binds = f.count('useProgram');
  r.draw([{ at: [1, 0, 1] }, { at: [2, 0, 2] }], I, I, [0, 0, 0], 1);
  assert.equal(f.count('useProgram') - binds, 1, 'two wearers of one look: bound once');
  for (const k of AURA_KINDS) assert.ok(r.programOf(k), `look ${k} built`);
  assert.equal(f.count('createProgram'), started, 'every look on its started program');
  const g = fakeGl({ parallel: false });
  assert.equal(startPlayPrograms(g.gl), false);
  const rg = new AuraRingRenderer(g.gl);
  rg.draw(two, I, I, [0, 0, 0], 1);
  assert.equal(rg.drawn, 2, 'no extension: each look built at its first draw');
  assert.equal(g.count('createProgram'), 2, 'the looks drawn alone');
  const w = read('src/scenes/world.js');
  assert.match(w, /const auraPassOf = compiledPass\(renderer\.gl, \[\], \(\) => new AuraRingRenderer\(renderer\.gl\),/, 'the world\'s door waits on no program');
  assert.match(w, /const _auraPass = auraPassOf\(\);/);
  assert.equal(w.split('\n').filter((l) => l.split('//')[0].includes('new AuraRingRenderer(')).length, 1, 'built nowhere outside its door (a comment that names the build is no build)');
  assert.match(read('src/render/auraRing.js'), /const P = this\.programOf\(look\.kind\);/, 'a look never asked as needed in the draw');
  // a look that will not build: told once, its wearers stand without it, and the other looks are drawn
  const bad = fakeGl({ parallel: false, fails: [auraPrograms(1)[0][1]] });
  const rb = new AuraRingRenderer(bad.gl), warns = [], warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    rb.draw([{ at: [1, 0, 1] }, { at: [5, 0, 5], aura: 'oblivionward' }, { at: [9, 0, 9], aura: 'radiance' }], I, I, [0, 0, 0], 1);
    assert.equal(rb.drawn, 2, 'the fire and the radiance drawn, the ward not');
    rb.draw([{ at: [5, 0, 5], aura: 'oblivionward' }], I, I, [0, 0, 0], 1);
    assert.equal(rb.drawn, 0);
  } finally { console.warn = warn; }
  assert.equal(warns.length, 1, 'told once');
  assert.match(warns[0], /\[aura\] look 1 would not build/);
});
