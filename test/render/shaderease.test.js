// THE SEA'S WARM STARTS ITS PROGRAMS, THEN BUILDS. Deep Waters' seven programs, Ocean Holes'
// two and the rain's one to three were warmed by a bare step: every compile and its LINK_STATUS read inside one idle
// callback. Each now names its programs, so the build runs once the driver says they are done. LINK-WAIT
// keeps each slow LINK_STATUS read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPrograms, buildProgram, linkWaits, LINK_WAIT_MS, LINK_WAIT_KEEP } from '../../src/render/glProgram.js';
import { warmPrograms } from '../../src/render/warmPrograms.js';
import { DeepWatersRenderer, DEEP_WATERS_PROGRAMS } from '../../src/render/deepWatersRender.js';
import { OceanHolesRenderer, OCEAN_HOLES_PROGRAMS } from '../../src/render/oceanHolesRender.js';
import { PrecipitationRenderer, precipPrograms, precipWarmStep } from '../../src/render/precipitation.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A context whose driver finishes its compiles when the test says (`finish`); `count('link?')` is the LINK_STATUS
 *  read, `onLink` runs inside it (a slow read). */
function fakeGl({ parallel = true, onLink = () => {} } = {}) {
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
          if (pn === base.LINK_STATUS) { log.push(['link?']); onLink(); return true; }
          if (ext && pn === ext.COMPLETION_STATUS_KHR) { log.push(['done?']); return done.has(p); }
          return null;
        };
        case 'getShaderParameter': return () => true;
        case 'getUniformLocation': return (p, n) => n;
        default: return (...a) => { log.push([k, ...a]); return { id: next++ }; };
      }
    },
  });
  return { gl, finish: () => { for (const p of progs) done.add(p); }, count: (name) => log.filter((x) => x[0] === name).length };
}

const deepWaters = (gl) => new DeepWatersRenderer({ gl, markForeignPass() {} });
const oceanHoles = (gl) => new OceanHolesRenderer(deepWaters(gl));
const LANES = [{}, { enhanced: true }, { enhanced: true, pixelSnow: { minParticleSize: 1, maxParticleSize: 4 } }, { pixelSnow: { minParticleSize: 1, maxParticleSize: 4 } }];

test('SHADER-EASE WARM-POLL every list is its build: the pairs started are the ones the build reads - none compiled again, one read each; the rain\'s gated per lane as its constructor gates them (mutants: a Deep Waters pair missed; an Ocean Holes pair missed; pixel snow started off the enhanced lane; the lab never started)', () => {
  const cases = [
    ['Deep Waters', DEEP_WATERS_PROGRAMS, (gl) => deepWaters(gl)._ensure()],
    ['Ocean Holes', OCEAN_HOLES_PROGRAMS, (gl) => oceanHoles(gl)._ensure()],
    ...LANES.map((opts) => [`the rain ${JSON.stringify(opts)}`, precipPrograms(opts), (gl) => new PrecipitationRenderer(gl, opts)]),
  ];
  for (const [name, programs, make] of cases) {
    const f = fakeGl();
    startPrograms(f.gl, programs);
    f.finish();
    const started = f.count('createProgram');
    assert.equal(started, programs.length, `${name}: its programs started`);
    make(f.gl);
    assert.equal(f.count('createProgram'), started, `${name}: compiled nothing its list did not start`);
    assert.equal(f.count('link?'), programs.length, `${name}: one read a program`);
  }
  assert.equal(DEEP_WATERS_PROGRAMS.length, 7);
  assert.equal(OCEAN_HOLES_PROGRAMS.length, 2);
  assert.deepEqual(LANES.map((o) => precipPrograms(o).length), [1, 3, 4, 1]);
});

test('SHADER-EASE WARM-POLL the sea\'s warm: built only once the driver says done, asked at each idle; a pass a draw built first is stood down; without the extension it builds at its first idle as the bare step did (mutants: the Deep Waters step built at once; its need never false; the Ocean Holes step built at once)', async () => {
  for (const make of [deepWaters, oceanHoles]) {
    const f = fakeGl();
    const r = make(f.gl);
    const idles = [];
    const warm = warmPrograms(r.warmSteps(), { idle: (fn) => idles.push(fn) });
    const tick = async () => { idles.shift()?.(); await new Promise((res) => setImmediate(res)); };
    await tick(); await tick(); await tick();
    assert.equal(f.count('link?'), 0, 'nothing read while the driver compiles');
    f.finish();
    await tick();
    assert.equal(await warm, 1);
    assert.ok(f.count('link?') > 0, 'built once done');
    assert.equal(f.count('createProgram'), f.count('link?'), 'on the programs it started');

    const g = fakeGl();
    const s = make(g.gl);
    const later = [];
    const stood = warmPrograms(s.warmSteps(), { idle: (fn) => later.push(fn) });
    later.shift()(); await new Promise((res) => setImmediate(res));
    s._ensure();   // the first coast drawn mid-compile
    const made = g.count('createProgram');
    later.shift()(); await new Promise((res) => setImmediate(res));
    assert.equal(await stood, 0, 'stood down');
    assert.equal(g.count('createProgram'), made, 'no second compile');

    const h = fakeGl({ parallel: false });
    const t = make(h.gl);
    let waits = 0;
    assert.equal(await warmPrograms(t.warmSteps(), { idle: (fn) => { waits++; fn(); } }), 1);
    assert.equal(waits, 1, 'one idle, as the bare step');
    assert.equal(h.count('createProgram'), h.count('link?'));
  }
});

test('SHADER-EASE WARM-POLL the rain\'s step: built once its programs are done, never over a renderer the weather made, stood down when one stands (mutants: the step built over the weather\'s; its need never false)', async () => {
  const f = fakeGl();
  let precip = null;
  const step = precipWarmStep(f.gl, { enhanced: true }, () => precip, (made) => { precip = made; });
  assert.equal(step.need(), true);
  const ready = step.start();
  assert.equal(ready(), false);
  f.finish();
  assert.equal(ready(), true);
  step.run();
  assert.ok(precip instanceof PrecipitationRenderer);
  assert.equal(f.count('createProgram'), 3, 'the three it started (the classic pass, the lab, Better Ambience\'s fall), no more');
  const first = precip;
  step.run();
  assert.equal(precip, first, 'not built twice');
  assert.equal(step.need(), false);
});

test('SHADER-EASE the wiring: the world\'s Deep Waters and Ocean Holes warm by their named steps, both hosts\' rain by precipWarmStep - no bare step left for them', () => {
  const world = read('src/scenes/world.js'), exterior = read('src/scenes/exterior.js');
  assert.match(world, /if \(dwRender\) void warmPrograms\(dwRender\.warmSteps\(\)\);/);
  assert.match(world, /if \(ohRender\) void warmPrograms\(ohRender\.warmSteps\(\)\);/);
  for (const host of [world, exterior]) {
    assert.match(host, /precipWarmStep\(renderer\.gl, precipOpts, \(\) => precip, \(made\) => \{ precip = made; \}\),/);
    assert.ok(!host.includes('() => { if (!precip) precip = new PrecipitationRenderer(renderer.gl, precipOpts); }'));
  }
  assert.ok(!world.includes('() => dwRender._ensure()') && !world.includes('() => ohRender._ensure()'));
});

test('SHADER-EASE LINK-WAIT a LINK_STATUS read past LINK_WAIT_MS is kept - the label, the ms, whether a start had it ahead; a quick one is not; the last LINK_WAIT_KEEP kept; no performance, no record and no throw (mutants: nothing kept; a quick read kept; started never true; the ring unbounded)', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let t = 0;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => t }, configurable: true, writable: true });
  try {
    const before = linkWaits().length;
    const slow = fakeGl({ parallel: true, onLink: () => { t += LINK_WAIT_MS + 30; } });
    buildProgram(slow.gl, 'v', 'f', 'cold one');
    let w = linkWaits();
    assert.equal(w.length, before + 1);
    assert.deepEqual(w.at(-1), { label: 'cold one', ms: LINK_WAIT_MS + 30, started: false });
    startPrograms(slow.gl, [['v2', 'f22']]);
    buildProgram(slow.gl, 'v2', 'f22');
    assert.deepEqual(linkWaits().at(-1), { label: '2+3 chars', ms: LINK_WAIT_MS + 30, started: true }, 'unlabelled: its sizes; started ahead');
    const quick = fakeGl({ onLink: () => { t += LINK_WAIT_MS - 10; } });
    const n = linkWaits().length;
    buildProgram(quick.gl, 'v', 'f', 'warm one');
    assert.equal(linkWaits().length, n, 'a quick read is not kept');
    for (let i = 0; i < LINK_WAIT_KEEP + 5; i++) buildProgram(slow.gl, 'v', 'f', `cold ${i}`);
    w = linkWaits();
    assert.equal(w.length, LINK_WAIT_KEEP);
    assert.equal(w.at(-1).label, `cold ${LINK_WAIT_KEEP + 4}`);
    w.length = 0;
    assert.equal(linkWaits().length, LINK_WAIT_KEEP, 'a copy');
    Object.defineProperty(globalThis, 'performance', { value: undefined, configurable: true, writable: true });
    assert.ok(buildProgram(slow.gl, 'v', 'f', 'no clock'));
    assert.notEqual(linkWaits().at(-1).label, 'no clock');
  } finally {
    if (had) Object.defineProperty(globalThis, 'performance', had);
  }
});
