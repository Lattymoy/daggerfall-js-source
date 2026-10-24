// NAV-B (2026-09-28, Mac: "proper naval combat with a huge reference to assassins creed black flag ... extremely
// detailed, authentic") - THE PICTURE: the smoke, flame, spray and splinters of a sea fight as numbers
// (systems/naval/navalEffects.js), the one pass that draws them with the balls in flight, what floats and the aim
// (render/navalRender.js), a burning deck on Daggerfall's own fire flat (scenes/naval/navalFlames.js), and a sea ship's
// colours on her flag (render/comeSailAwayRender.js flagRuns) - bible/03-World/Naval-Combat.md NAV-B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavalEffects, PARTICLE_BUDGET } from '../../../src/systems/naval/navalEffects.js';
import {
  NAVAL_STRIDE, NAVAL_MAX_QUADS, NAVAL_TEX_SIZE, NAVAL_FS, NAVAL_TEXTURES, navalSmokeTexture, pictureOf, writeQuad, viewAxes, particleAxes,
  writeRibbon, NavalRenderer, ARC_WIDTH_VH, ARC_DASH_DIM,
} from '../../../src/render/navalRender.js';
import { createNavalFlames, FLAME_SCALE } from '../../../src/scenes/naval/navalFlames.js';
import { FIRE_FLAT } from '../../../src/systems/survival/camp.js';
import { GLOBAL_SCALE } from '../../../src/player/activate.js';
import { flagRuns } from '../../../src/render/comeSailAwayRender.js';
import { NAVAL_FACTIONS } from '../../../src/systems/naval/navalShips.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
/** A seeded draw, so a law's numbers are the same every run. */
const seeded = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const kinds = (fx) => fx.drawList().reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] ?? 0) + 1 }), {});

// ── the effects ─────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-B a gun fires: two tongues of flame added onto the frame at the muzzle and down the shot, and a puff of smoke that comes up out of nothing, SWELLS as it thins and fades - more of it for a bigger gun (mutants: the smoke born opaque, its swell linear, the flash blended)', () => {
  const fx = createNavalEffects({ random: seeded(3) });
  fx.muzzle([0, 5, 0], [1, 0, 0], 1);
  assert.deepEqual(kinds(fx), { flash: 2, smoke: 8 });
  assert.ok(fx.drawList().filter((p) => p.kind === 'flash').every((p) => p.blend === 'add'));
  const big = createNavalEffects({ random: seeded(3) });
  big.muzzle([0, 5, 0], [2, 0, 0], 1.6);
  assert.equal(kinds(big).smoke, Math.round(5 + 3 * 1.6), 'a bigger gun, more smoke');
  const smoke0 = fx.drawList().filter((p) => p.kind === 'smoke');
  assert.ok(smoke0.every((p) => p.color[3] === 0 && p.blend === 'alpha'), 'born clear - it comes up');
  fx.step(0.5);
  const smoke1 = fx.drawList().filter((p) => p.kind === 'smoke');
  assert.ok(smoke1.every((p) => p.color[3] > 0), 'in a moment it stands');
  assert.equal(kinds(fx).flash ?? 0, 0, 'the flame is gone in a tenth of a second');
  const before = smoke1.map((p) => p.size);
  fx.step(2);
  const after = fx.drawList().filter((p) => p.kind === 'smoke').map((p) => p.size);
  assert.ok(after.every((s, i) => s > before[i]), 'it swells as it thins');
  // the swell's shape: the square root of its age - quick at first, then slower
  const one = createNavalEffects({ random: () => 0.5 });
  one.smoke([0, 0, 0], [0, 0, 1], 1, 1);
  const life = 4 + 0.5 * 4.5, s0 = 1.1, s1 = 5 + 0.5 * 3;
  one.step(life / 4);
  near(one.drawList()[0].size, s0 + (s1 - s0) * Math.sqrt(0.25), 1e-9);
});

test('NAV-B the smoke hangs and drifts: it slows in the air, rises a little and goes where the wind blows; spray is thrown up and falls back; a hull struck throws splinters along the shot under gravity; the sea takes a ball with a column of spray and a ring of foam laid FLAT on it (mutants: the wind ignored, the spray weightless, the foam upright)', () => {
  const calm = createNavalEffects({ random: () => 0.5 });
  const windy = createNavalEffects({ random: () => 0.5, wind: () => [4, 0, 0] });
  calm.smoke([0, 0, 0], [0, 0, 1], 1, 1); windy.smoke([0, 0, 0], [0, 0, 1], 1, 1);
  for (let i = 0; i < 20; i++) { calm.step(0.1); windy.step(0.1); }
  assert.ok(windy.drawList()[0].pos[0] > calm.drawList()[0].pos[0] + 0.5, 'downwind');
  assert.ok(calm.drawList()[0].pos[1] > 0, 'it rises');
  const sea = createNavalEffects({ random: seeded(9) });
  sea.splash([0, 0, 0]);
  assert.deepEqual(kinds(sea), { spray: 12, foam: 1 });
  const foam = sea.drawList().find((p) => p.kind === 'foam');
  assert.equal(foam.flat, true);
  sea.step(0.3);
  const up = sea.drawList().filter((p) => p.kind === 'spray').map((p) => p.pos[1]);
  sea.step(0.4);
  const down = sea.drawList().filter((p) => p.kind === 'spray').map((p) => p.pos[1]);
  assert.ok(up.every((y) => y > 0) && down.some((y, i) => y < up[i]), 'thrown up, and falling back');
  const heavy = createNavalEffects({ random: seeded(9) });
  heavy.splash([0, 0, 0], true);
  assert.deepEqual(kinds(heavy), { spray: 22, foam: 1 });
  const hull = createNavalEffects({ random: seeded(5) });
  hull.hit([0, 3, 0], [0, 0, 5]);
  const k = kinds(hull);
  assert.equal(k.debris, 10);
  assert.equal(k.flash, 1);
  assert.equal(k.smoke, 3);
  assert.ok(hull.drawList().filter((p) => p.kind === 'debris').every((p) => p.solid));
  hull.step(0.3);
  const chips = hull.drawList().filter((p) => p.kind === 'debris');
  assert.ok(chips.reduce((s, p) => s + p.pos[2], 0) / chips.length > 0.3, 'thrown along the shot');
  const boom = createNavalEffects({ random: seeded(2) });
  boom.blast([0, 0, 0]);
  const b = kinds(boom);
  assert.ok(b.flash >= 10 && b.smoke >= 12 && b.debris === 16 && b.spray === 22 && b.foam === 1, JSON.stringify(b));
});

test('NAV-B a burning ship breathes embers and smoke at a rate per second whatever the frame; a founder foams where she goes under; the field never holds more than PARTICLE_BUDGET - the spray of a splash going before the smoke; the origin\'s move carries them; a clear empties them (mutants: the rate per frame, the newest dropped)', () => {
  const count = (dt, frames) => {
    const fx = createNavalEffects({ random: seeded(11) });
    for (let i = 0; i < frames; i++) fx.burn([0, 0, 0], dt);
    return fx.count;
  };
  const fast = count(1 / 120, 1200), slow = count(1 / 30, 300);   // ten seconds either way
  assert.ok(fast > 100 && slow > 100, `${fast}, ${slow}`);
  assert.ok(Math.abs(fast - slow) / slow < 0.2, `the same fire at 120 and 30 frames a second: ${fast} vs ${slow}`);
  const fx = createNavalEffects({ random: seeded(4) });
  for (let i = 0; i < 400; i++) fx.founder([0, 0, 0], 0.1);
  assert.ok(fx.drawList().every((p) => (p.kind === 'foam' && p.flat) || p.kind === 'spray'));   // PIN MOVED (COMBAT-FEEL FOUNDER-BOIL: her air boiling up, small drops popping)
  assert.ok(fx.drawList().some((p) => p.kind === 'spray') && fx.drawList().some((p) => p.kind === 'foam'));
  const full = createNavalEffects({ random: seeded(7) });
  full.smoke([0, 0, 0], [1, 0, 0], 1, 10);
  const first = full.drawList()[0].pos;
  for (let i = 0; i < 200; i++) full.splash([100, 0, 0]);
  full.step(0.01);
  assert.equal(full.count, PARTICLE_BUDGET);
  // AUDIT NAV1 (the frame's cost, #13): past the budget the splashes' spray and foam went first, never the smoke
  // before them (navalEffects.js EVICT_RANK) - it went first when the oldest did
  assert.ok(full.drawList().some((p) => p.pos === first), 'the first puff of smoke kept');
  assert.equal(full.drawList().filter((p) => p.kind === 'smoke').length, 10, 'every puff kept');
  const late = createNavalEffects({ random: seeded(7) });
  for (let i = 0; i < 200; i++) late.splash([100, 0, 0]);
  late.smoke([0, 0, 0], [1, 0, 0], 1, 10);
  late.step(0.01);
  assert.equal(late.count, PARTICLE_BUDGET);
  assert.equal(late.drawList().filter((p) => p.kind === 'smoke').length, 10, 'the newest smoke kept too - never the newest dropped');
  const o = createNavalEffects({ random: () => 0.5 });
  o.flash([1, 2, 3], [1, 0, 0]);
  o.offsetAll([10, 0, -5]);
  assert.deepEqual(o.drawList()[0].pos, [11, 2, -2]);
  o.clear();
  assert.equal(o.count, 0);
});

// ── the pass ────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-B the pictures, made at load and never shipped: white, their shape in alpha - a soft dot falling to nothing at its rim, a lumpy smoke puff (the same bytes every boot), a foam ring bright at seven tenths of its radius, a hard disc; each kind wears its own (mutants: a texel coloured, the ring\'s peak, an unseeded puff)', () => {
  const at = (pic, u, v) => { const x = Math.round((u + 1) / 2 * pic.width - 0.5), y = Math.round((v + 1) / 2 * pic.height - 0.5); return pic.data[(y * pic.width + x) * 4 + 3]; };
  for (const [name, make] of Object.entries(NAVAL_TEXTURES)) {
    const pic = make();
    assert.deepEqual([pic.width, pic.height], [NAVAL_TEX_SIZE, NAVAL_TEX_SIZE], name);
    for (let i = 0; i < pic.data.length; i += 4) assert.ok(pic.data[i] === 255 && pic.data[i + 1] === 255 && pic.data[i + 2] === 255, `${name}: white`);
    assert.equal(at(pic, 0.999, 0.999), 0, `${name}: nothing in the corner`);
  }
  const soft = NAVAL_TEXTURES.soft();
  assert.ok(at(soft, 0, 0) > 240 && at(soft, 0.5, 0) < 80);
  const ring = NAVAL_TEXTURES.ring();
  assert.ok(at(ring, 0.7, 0) > 230 && at(ring, 0, 0) === 0, 'bright at 0.7, clear in the middle');
  const disc = NAVAL_TEXTURES.disc();
  assert.ok(at(disc, 0.8, 0) === 255 && at(disc, 0, 0) === 255, 'solid to its edge');
  assert.deepEqual(navalSmokeTexture().data, navalSmokeTexture().data);
  // AUDIT NAV1 (the presentation, #4): the arcs' line - solid across its middle, nothing at its edge, the same along
  // each half, the second half dimmed, repeated along
  const line = NAVAL_TEXTURES.line();
  assert.ok(at(line, -0.5, 0) === 255 && at(line, -0.5, 0.5) === 255, 'solid across its middle');
  assert.equal(at(line, -0.5, 0.99), 0, 'nothing at its edge');
  assert.ok(at(line, -0.9, 0) === at(line, -0.1, 0), 'the same along it');
  assert.equal(at(line, 0.5, 0), Math.round(255 * ARC_DASH_DIM), 'the dash\'s dim half');
  assert.equal(line.repeatS, true);
  assert.equal(pictureOf({ kind: 'smoke' }), 'smoke');
  assert.equal(pictureOf({ kind: 'foam' }), 'ring');
  assert.equal(pictureOf({ kind: 'debris', solid: true }), 'disc');
  assert.equal(pictureOf({ kind: 'spray' }), 'soft');
  // the shader premultiplies what it is handed: colour times coverage, and the added pass writes no alpha
  assert.match(NAVAL_FS, /outColor = vec4\(col \* a, a\);/);
  assert.match(NAVAL_FS, /outColor = vec4\(dwWaterFogAdd\(c \* a \* f, vWorldPos\), 0\.0\);/);
});

test('NAV-B the quads: six vertices of place, picture corner, colour and the lit flag; a particle faces the eye along the view\'s own right and up, turned by its roll - or lies flat on the sea; a ribbon\'s segments turn about their own length toward the eye, every other dash dimmed (mutants: the uv flipped, a flat particle upright, the ribbon across the arc)', () => {
  const out = new Float32Array(6 * NAVAL_STRIDE * 4);
  assert.equal(writeQuad(out, 0, [10, 0, 0], [1, 0, 0], [0, 2, 0], [0.1, 0.2, 0.3, 0.4], true), 6);
  const vtx = (i) => Array.from(out.subarray(i * NAVAL_STRIDE, (i + 1) * NAVAL_STRIDE)).map((x) => +x.toFixed(6));
  assert.deepEqual(vtx(0), [9, -2, 0, 0, 1, 0.1, 0.2, 0.3, 0.4, 1]);
  assert.deepEqual(vtx(2), [11, 2, 0, 1, 0, 0.1, 0.2, 0.3, 0.4, 1]);
  assert.equal(writeQuad(out, 6, [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1, 1], false), 12);
  assert.equal(out[6 * NAVAL_STRIDE + 9], 0, 'unlit');
  // the view's axes (a column-major matrix: its rows are the camera's axes)
  const view = new Float32Array(16); view[0] = 1; view[5] = 1; view[10] = 1; view[15] = 1;
  assert.deepEqual(viewAxes(view), { right: [1, 0, 0], up: [0, 1, 0] });
  const axes = { right: [1, 0, 0], up: [0, 1, 0] };
  const faced = particleAxes({ size: 2, rot: 0 }, axes);
  assert.deepEqual(faced, { ax: [1, 0, 0], ay: [0, 1, 0] });
  const rolled = particleAxes({ size: 2, rot: Math.PI / 2 }, axes);
  near(rolled.ax[1], 1, 1e-12, 'its roll turns it in the view');
  const flat = particleAxes({ size: 4, rot: 0, flat: true }, axes);
  assert.deepEqual(flat, { ax: [2, 0, 0], ay: [-0, 0, 2] });
  assert.ok(flat.ax[1] === 0 && flat.ay[1] === 0, 'on the sea');
  // AUDIT NAV1 (the presentation, #15): a plank - `aspect` times as long as it is wide, along its turn
  const plank = particleAxes({ size: 2, rot: Math.PI / 2, flat: true, aspect: 4 }, axes);
  near(Math.hypot(...plank.ax), 4, 1e-12, 'long');
  near(Math.hypot(...plank.ay), 1, 1e-12, 'narrow');
  near(plank.ax[2], 4, 1e-12, 'along its turn');
  // a quad's u from u0 to u1 along its first axis (a line repeated along its length)
  writeQuad(out, 0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1, 1], false, 2.5, 4);
  assert.deepEqual([out[3], out[NAVAL_STRIDE + 3]], [2.5, 4]);
  // a ribbon along x, seen from above: its width runs across the arc (z), never along it
  const rib = new Float32Array(6 * NAVAL_STRIDE * 8);
  const pts = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0]];
  assert.equal(writeRibbon(rib, 0, pts, [3, 50, 0], 0.5, [1, 1, 1, 0.8], { period: 4, offset: 1 }), 18);
  const zs = [0, 1, 2, 3, 4, 5].map((i) => rib[i * NAVAL_STRIDE + 2]);
  near(Math.max(...zs) - Math.min(...zs), 0.5, 1e-6, 'its width across');
  near(rib[8], 0.8, 1e-6, 'its colour whole - the dash is the picture\'s');
  // AUDIT NAV1 (the presentation, #4): the dash by the metres flown - each segment's u the metres over the period
  const u = (quad, corner) => rib[(quad * 6 + corner) * NAVAL_STRIDE + 3];
  assert.deepEqual([u(0, 0), u(0, 1), u(1, 0), u(1, 1), u(2, 1)].map((x) => +x.toFixed(6)), [-0.25, 0.25, 0.25, 0.75, 1.25], 'continuous along the arc');
  // ...and one width on the screen: a share of the view's height at each segment's own distance
  const vh = 2 / 1.5;
  writeRibbon(rib, 0, [[-10, 0, -30], [10, 0, -30]], [0, 0, 0], ARC_WIDTH_VH, [1, 1, 1, 1], { vh });
  const ys = [0, 1, 2, 3, 4, 5].map((i) => rib[i * NAVAL_STRIDE + 1]);
  near(Math.max(...ys) - Math.min(...ys), ARC_WIDTH_VH * vh * 30, 1e-6, 'at 30 m, as wide as the view\'s share there');
  writeRibbon(rib, 0, [[-10, 0, -300], [10, 0, -300]], [0, 0, 0], ARC_WIDTH_VH, [1, 1, 1, 1], { vh });
  const far = [0, 1, 2, 3, 4, 5].map((i) => rib[i * NAVAL_STRIDE + 1]);
  near(Math.max(...far) - Math.min(...far), ARC_WIDTH_VH * vh * 300, 1e-5, 'ten times as far, ten times as wide - the same on the screen');
  assert.equal(writeRibbon(rib, 0, [[0, 0, 0], [0, 0, 0]], [0, 5, 0], 1, [1, 1, 1, 1]), 0, 'a segment of no length draws nothing');
});

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { ARRAY_BUFFER: 'ARRAY_BUFFER', TRIANGLES: 'TRIANGLES', ONE: 'ONE', ONE_MINUS_SRC_ALPHA: 'ONE_MINUS_SRC_ALPHA', BLEND: 'BLEND', DEPTH_TEST: 'DEPTH_TEST', CULL_FACE: 'CULL_FACE', TEXTURE_2D: 'TEXTURE_2D', LEQUAL: 'LEQUAL', LESS: 'LESS' };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => { calls.push([k]); return { id: ++ids }; };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}
function fakeRenderer(gl) {
  const view = new Float32Array(16); view[0] = 1; view[5] = 1; view[10] = 1; view[15] = 1;
  const r = {
    gl, _proj: new Float32Array(16), _view: view, _camPos: [0, 0, 0], _ambient: [0.3, 0.3, 0.3], _sunColor: [1, 1, 1], _sunScale: 1,
    _lightDir: [0, 1, 0], _fogColor: [0.5, 0.5, 0.6], _fogMode: 1, _fogDensity: 0.001, _fogRange: [10, 900], _dwFog: new Float32Array(4),
    _focus: new Float32Array([7, 8, 9, 1]), marked: 0, markForeignPass() { r.marked++; },
  };
  return r;
}
const puff = (pos, o = {}) => ({ pos, size: 2, color: [0.8, 0.8, 0.8, 0.5], rot: 0, blend: 'alpha', flat: false, solid: false, kind: 'smoke', ...o });

test('NAV-B the pass draws what the frame holds in one buffer: the blended layers back to front - smoke, spray, the balls and what floats - then the added ones over them, the aim\'s zone flat on the sea and its arcs as ribbons; the world\'s depth tested and none written; the travel view\'s focus sent; the renderer told; nothing to draw touches no GL (mutants: the blends swapped, front to back, depth written, the focus not sent)', () => {
  const { gl, calls } = recordingGl();
  const r = fakeRenderer(gl);
  const pass = new NavalRenderer(r);
  pass.draw({});
  assert.deepEqual(calls, [], 'nothing: no program, no draw');
  assert.equal(r.marked, 0);
  const near1 = puff([0, 0, -10]), far1 = puff([0, 0, -100]);
  pass.draw({
    particles: [near1, far1, { ...puff([0, 0, -20]), kind: 'flash', blend: 'add' }],
    balls: [{ pos: [0, 5, -30], gun: 'long' }],
    floaters: [{ kind: 'barrel', pos: [0, 0, -40] }],
    aim: { arcs: [[[0, 5, 0], [0, 6, -10], [0, 5, -20]]], zone: [[0, 0, -60], [1, 0, -60]], hot: true, radius: 2 },
  });
  assert.equal(pass.drawn, 4 + 2 + 1 + 2, 'four blended, two zone marks, one flash, two ribbon segments');
  assert.equal(r.marked, 1);
  const first = [pass.data[0], pass.data[1], pass.data[2]];
  near(first[2], -100, 2.5, 'the farthest laid first');
  const blends = calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1).join('/'));
  assert.deepEqual(blends, ['ONE/ONE_MINUS_SRC_ALPHA', 'ONE/ONE'], 'blended, then added');
  const depth = calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]);
  assert.deepEqual(depth, [false, true], 'no depth written, and the mask put back');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uFocus' && [...c[2]].join() === '7,8,9,1'), 'the traveller\'s focus');
  const drawsOf = calls.filter((c) => c[0] === 'drawArrays');
  assert.equal(drawsOf.reduce((s, c) => s + c[3], 0), pass.drawn * 6, 'every laid vertex drawn once');
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 1);
  calls.length = 0;
  pass.draw({ particles: [near1] });
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 0, 'built once');
  // the budget: a frame past it lays what fits and no more
  const many = Array.from({ length: NAVAL_MAX_QUADS + 50 }, (_, i) => puff([i, 0, -5]));
  pass.draw({ particles: many });
  assert.equal(pass.drawn, NAVAL_MAX_QUADS);
  assert.equal(r.marked, 3);
  pass.draw({ particles: many.map((p) => ({ ...p, kind: 'flash', blend: 'add' })) });
  assert.equal(pass.drawn, NAVAL_MAX_QUADS, 'an added layer past it too - none laid past the buffer');
  // AUDIT 2026-10-17: the aim's room kept first - a full frame cuts the effects, the farthest blended first, never the lay
  const arc = Array.from({ length: 30 }, (_, i) => [0, 5, -i]);
  const aim = { arcs: [arc], zone: [[0, 0, -60], [1, 0, -60]], strikes: [[0, 1, -50]], posts: true, hot: true, radius: 2 };
  const aimOnly = new NavalRenderer(fakeRenderer(recordingGl().gl));
  aimOnly.draw({ aim });
  const laid = aimOnly.drawn;
  assert.ok(laid >= 2 * 2 + 1 + arc.length - 1, `the aim alone: ${laid}`);
  pass.draw({ particles: many, aim });
  assert.equal(pass.drawn, NAVAL_MAX_QUADS - (2 * 2 + 1 + arc.length) + laid, 'the aim laid whole, the effects the rest');
  near(pass.data[0], NAVAL_MAX_QUADS - (2 * 2 + 1 + arc.length) - 1, 2.5, 'the farthest let go: the first laid is the farthest kept');
});

// ── a burning deck ──────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-B a burning deck is Daggerfall\'s own fire flat - the camp\'s TEXTURE.210, FLAME_SCALE its size - one batch a flame placed by its origin, carried with her as she moves, animated on the frame\'s clock, retired with her fire; a flame asked for before the art is in stands when it arrives (mutants: a batch a frame, a retired flame left burning, the scale)', async () => {
  const made = [], destroyed = [], uploads = [];
  const renderer = { createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers }; made.push(b); return b; }, destroyBillboardBatch: (b) => destroyed.push(b) };
  let release;
  const art = new Promise((r) => { release = r; });
  const texture = { getFrameCount: () => 5, getSize: () => ({ width: 32, height: 48 }) };
  const flames = createNavalFlames({ renderer, getTexture: () => art, uploadRecordFrame: (a, r, f) => uploads.push([a, r, f]) });
  const one = flames.flame([1, 2, 3]);
  assert.equal(made.length, 0, 'the art is not in yet');
  assert.equal(flames.count, 1);
  release(texture);
  await art; await new Promise((r) => setTimeout(r, 0));
  assert.equal(made.length, 1, 'it stands when the art arrives');
  assert.deepEqual(uploads, [0, 1, 2, 3, 4].map((f) => [FIRE_FLAT.archive, FIRE_FLAT.record, f]), 'every frame uploaded');
  const b = made[0];
  assert.deepEqual([b.archive, b.record], [FIRE_FLAT.archive, FIRE_FLAT.record]);
  near(b.size.w, 32 * GLOBAL_SCALE * FLAME_SCALE, 1e-9);
  near(b.size.h, 48 * GLOBAL_SCALE * FLAME_SCALE, 1e-9);
  assert.deepEqual(b.origin, [1, 2, 3]);
  one.move([4, 5, 6]);
  assert.deepEqual(b.origin, [4, 5, 6], 'the same batch, moved - never a new one');
  const two = flames.flame([0, 0, 0]);
  assert.equal(made.length, 2);
  assert.deepEqual(flames.batches(), [made[0], made[1]]);
  const f0 = b.frame;
  flames.tick(1);
  assert.notEqual(b.frame, f0, 'the fire burns');
  flames.offsetAll([10, 0, 0]);
  assert.deepEqual(b.origin, [14, 5, 6]);
  one.retire();
  assert.deepEqual(destroyed, [b]);
  assert.deepEqual(flames.batches(), [made[1]]);
  flames.clear();
  assert.equal(flames.count, 0);
  assert.deepEqual(destroyed, [b, made[1]]);
  two.retire();
  assert.equal(destroyed.length, 2, 'retired once');
  // no art door: no fire drawn, and nothing thrown
  const bare = createNavalFlames({ renderer });
  bare.flame([0, 0, 0]);
  assert.deepEqual(bare.batches(), []);
});

test('NAV-B a sea ship flies her colours: the flags drawn in runs of one colour, each colour\'s run in the order it first flies - the player\'s own boats FlagMaterial\'s orange (no colour), a pirate\'s black, a merchantman\'s gold, a navy\'s red (mutants: one run for all, the order by colour)', () => {
  const pirate = NAVAL_FACTIONS.pirate.flag, navy = NAVAL_FACTIONS.navy.flag;
  const runs = flagRuns([{ id: 1 }, { id: 2, color: pirate }, { id: 3 }, { id: 4, color: navy }, { id: 5, color: pirate }]);
  assert.deepEqual(runs.map((r) => [r.color, r.list.map((q) => q.id)]), [[null, [1, 3]], [pirate, [2, 5]], [navy, [4]]]);
  assert.deepEqual(flagRuns([]), []);
  assert.ok(NAVAL_FACTIONS.pirate.flag.every((c) => c < 0.2), 'black');
  assert.ok(NAVAL_FACTIONS.merchant.flag[0] > 0.8 && NAVAL_FACTIONS.merchant.flag[2] < 0.4, 'gold');
  assert.ok(NAVAL_FACTIONS.navy.flag[0] > 0.5 && NAVAL_FACTIONS.navy.flag[1] < 0.2, 'red');
});
