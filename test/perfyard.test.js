// PERF-YARD (2026-10-10, the owner: "performance must be highest priority now ... prob caused by placed objects by
// players"): A YARD'S PIECES ARE CULLED AS THE TOWN'S OWN MODELS ARE (bible/07-Rendering/Performance-V8.md PERF-YARD).
//
// Every model piece of every yard within YARD_DRAW_M was a draw a frame, behind the eye or not, and a caster recorded
// for every shadow walk. The pixel walk's law (scenes/world.js - EV3 and SHADOW-REACH) now holds for them: inside the
// view, drawn; outside it, cast into the maps alone where a shadow reaches the piece, else nothing at all.
//
// ONE: decorCullVerdict is that law over real planes from a real projection. TWO: the pool draws by its host's verdict,
// over each piece's box IN THE WORLD - and a recentre's restand moves that box with the piece. THREE: the world host
// hands the yards its test, made from the frame's own matrices once a frame, and a room's host hands none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDecorRoom, decorCullVerdict, DECOR_DRAW, DECOR_SHADOW, DECOR_SKIP } from '../src/scenes/decorRoom.js';
import { spherePlanes } from '../src/render/bounds.js';
import { lookAt, multiply, perspective, mirrorProjectionX } from '../src/world/mat4.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
/** A view from the origin, 1.7 up, looking down +z (yaw 0) - the host's own matrices and plane extraction. */
function viewPlanes() {
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt([0, 1.7, 0], [0, 1.7, 1], [0, 1, 0]);
  return spherePlanes(multiply(proj, view, new Float32Array(16)), new Float32Array(24));
}
const box = (x, z, h = 1) => [x - 0.5, 0, z - 0.5, x + 0.5, h, z + 0.5];

test('PERF-YARD: decorCullVerdict is the pixel walk\'s law - a box in the view drawn, one behind the eye cast alone where a shadow reaches it and nothing where none does (mutants: the shadow arm dropped; every box drawn)', () => {
  const planes = viewPlanes();
  const reachAll = () => true, reachNone = () => false;
  assert.equal(decorCullVerdict(planes, box(0, 10), reachNone), DECOR_DRAW, 'ahead: drawn');
  assert.equal(decorCullVerdict(planes, box(0, 10), reachAll), DECOR_DRAW, 'ahead: drawn, whatever reaches it');
  assert.equal(decorCullVerdict(planes, box(0, -10), reachAll), DECOR_SHADOW, 'behind, in a shadow\'s reach: the maps alone');
  assert.equal(decorCullVerdict(planes, box(0, -10), reachNone), DECOR_SKIP, 'behind, out of every reach: nothing');
  assert.equal(decorCullVerdict(planes, box(200, 10), reachNone), DECOR_SKIP, 'far off to the side: nothing');
  assert.equal(decorCullVerdict(planes, box(0, 0, 3), reachNone), DECOR_DRAW, 'a box the eye stands in: drawn');
  const asked = [];
  decorCullVerdict(planes, box(0, -10), (b) => { asked.push(b); return false; });
  decorCullVerdict(planes, box(0, 10), (b) => { asked.push(b); return false; });
  assert.equal(asked.length, 1, 'the reach is asked only of a box outside the view');
});

function rig() {
  const cube = { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint16Array([0, 1, 0]) };
  const drawn = [], cast = [];
  let o = [0, 0, 0];
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ id }), cpuModels: new Map([[41000, cube]]) },
    renderer: { drawMesh: (g, m) => drawn.push([m[12], m[14]]), recordShadowMesh: (g, m) => cast.push([m[12], m[14]]) },
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => o,
  });
  const piece = (id, x, z) => ({ id, model: 41000, flat: null, item: null, pos: [x, 0, z], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 });
  return { pool, drawn, cast, piece, move: (to) => { o = to; } };
}

test('PERF-YARD: the pool draws by its host\'s verdict over each piece\'s box in the world - drawn, cast alone or neither; with no verdict every piece is drawn as before (mutants: the verdict unread; the cast arm drawn)', async () => {
  const r = rig();
  r.pool.put(r.piece('ahead', 0, 10));
  r.pool.put(r.piece('behind', 0, -10));
  r.pool.put(r.piece('aside', 300, 10));
  await settle(); await settle();
  assert.equal(r.pool.draw(), 3, 'no verdict: every piece drawn');
  assert.deepEqual(r.drawn.length, 3);
  r.drawn.length = 0;
  const planes = viewPlanes();
  const seen = [];
  const cull = (b) => { seen.push([...b]); return decorCullVerdict(planes, b, (bb) => bb[2] < 0); };   // a shadow reaches what stands behind
  assert.equal(r.pool.draw(undefined, null, cull), 1, 'one drawn');
  assert.deepEqual(r.drawn, [[0, 10]], 'the piece ahead drawn');
  assert.deepEqual(r.cast, [[0, -10]], 'the piece behind cast into the maps alone');
  assert.deepEqual(seen.map((b) => b.map((v) => Math.round(v * 10) / 10 + 0)), [box(0, 10), box(0, -10), box(300, 10)], 'each piece\'s box asked where it stands in the world');
});

test('PERF-YARD: a recentre\'s restand moves the box the verdict reads with the piece - a piece carried into the view is drawn the same frame (mutant: the world box kept from where it stood)', async () => {
  const r = rig();
  r.pool.put(r.piece('a', 0, -10));
  await settle(); await settle();
  const planes = viewPlanes();
  const cull = (b) => decorCullVerdict(planes, b, () => false);
  assert.equal(r.pool.draw(undefined, null, cull), 0, 'behind the eye: nothing');
  r.move([0, 0, 20]);
  r.pool.restand();
  assert.equal(r.pool.draw(undefined, null, cull), 1, 'carried ahead by the recentre: drawn');
  assert.deepEqual(r.drawn, [[0, 10]]);
});

test('PERF-YARD: the world host hands the yards its view test - the frame\'s own matrices, planes made once a frame, the reach the renderer\'s - and the yards hand it to every yard\'s pool (mutants: the host\'s test unwired; the planes kept from an old frame)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const y = readFileSync(new URL('../src/scenes/homeYards.js', import.meta.url), 'utf8');
  const made = w.indexOf('  const yards = homeDecor && onlineHomes ? createHomeYards({');
  assert.ok(made > 0, 'the yards made');
  assert.ok(w.slice(made, w.indexOf('}) : null;', made)).includes('    cull: (box) => yardCull(box),'), 'the host\'s test in the yards\' deps');
  const fn = w.slice(w.indexOf('  function yardCull(box) {'), w.indexOf('\n  }\n', w.indexOf('  function yardCull(box) {')));
  assert.ok(fn.includes('if (!cullOn || !_lastProj || !_lastView) return DECOR_DRAW;'), '?cull=off, and before a frame was seen: drawn');
  assert.ok(fn.includes('if (_yardPlanesAt !== last) { spherePlanes(multiply(_lastProj, _lastView, _yardPv), _yardPlanes); _yardPlanesAt = last; }'), 'the planes from this frame\'s matrices, once a frame');
  assert.ok(fn.includes('return decorCullVerdict(_yardPlanes, box, _yardReach);'), 'the law');
  assert.ok(w.includes('  const _yardReach = (box) => renderer.shadowReach(box);'), 'the reach the renderer\'s');
  assert.ok(w.indexOf('    _lastProj = proj; _lastView = view;') < w.indexOf('    yards?.draw(renderer);'), 'the matrices kept before the yards draw');
  assert.ok(y.includes('        n += y.pool.draw(r, remapOf(y), cull);'), 'every yard\'s pool given it');
});
