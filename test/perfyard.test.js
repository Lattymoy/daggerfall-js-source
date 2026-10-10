// PERF-YARD (2026-10-10, the owner: "performance must be highest priority now ... prob caused by placed objects by
// players"): A YARD'S PIECES ARE CULLED AS THE TOWN'S OWN MODELS ARE (bible/07-Rendering/Performance-Priority.md PERF-YARD).
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

test('PERF-YARD (AUDIT 2): a piece whose model has no box to measure - its triangles not in hand (a place the pipeline let go between the mesh and its copy) - is drawn as before, never asked of the test (mutant: the box\'s guard dropped - transformedAabb of nothing threw in the frame)', async () => {
  const drawn = [];
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ id }), cpuModels: new Map() },   // no triangles for 41001
    renderer: { drawMesh: (g, m) => drawn.push(m[12]), recordShadowMesh: () => assert.fail('a boxless piece is never cast alone') },
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => [0, 0, 0],
  });
  pool.put({ id: 'boxless', model: 41001, flat: null, item: null, pos: [0, 0, -10], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 });
  await settle(); await settle();
  let asked = 0;
  assert.equal(pool.draw(undefined, null, () => { asked++; return DECOR_SKIP; }), 1, 'drawn, whatever the test would say');
  assert.deepEqual(drawn, [0]);
  assert.equal(asked, 0, 'and the test never asked');
});

test('PERF-YARD: the world host hands the yards its view test - the frame\'s own matrices, planes made once a frame, the reach the renderer\'s - and the yards hand it to every yard\'s pool (mutants: the host\'s test unwired; the planes kept from an old frame; the matrices kept after the draw; the yards handed no test)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const y = readFileSync(new URL('../src/scenes/homeYards.js', import.meta.url), 'utf8');
  const made = w.indexOf('  const yards = homeDecor && onlineHomes ? createHomeYards({');
  assert.ok(made > 0, 'the yards made');
  assert.ok(w.slice(made, w.indexOf('}) : null;', made)).includes('    cull: (box) => yardCull(box),'), 'the host\'s test in the yards\' deps');
  const fn = w.slice(w.indexOf('  function yardCull(box) {'), w.indexOf('\n  }\n', w.indexOf('  function yardCull(box) {')));
  assert.ok(fn.includes('if (!cullOn || !_lastProj || !_lastView) return DECOR_DRAW;'), '?cull=off, and before a frame was seen: drawn');
  assert.ok(fn.includes('if (_yardPlanesOf !== _lastView) { spherePlanes(multiply(_lastProj, _lastView, _yardPv), _yardPlanes); _yardPlanesOf = _lastView; }'), 'the planes from this frame\'s matrices, once a frame - keyed on the view matrix, never on a timestamp two frames can share (AUDIT PERF-YARD 3)');
  assert.ok(fn.includes('return decorCullVerdict(_yardPlanes, box, _yardReach);'), 'the law');
  assert.ok(w.includes('  const _yardReach = (box) => renderer.shadowReach(box);'), 'the reach the renderer\'s');
  // AUDIT PERF-YARD (record 6): the frame's own line - the modes' `reportFrame` holds the same text, six spaces in, ahead of it
  const kept = w.indexOf('    _lastProj = proj; _lastView = view;   // TI1'), drawn = w.indexOf('    yards?.draw(renderer);');
  assert.ok(kept > 0 && w.indexOf('    yards?.draw(renderer);', drawn + 1) < 0, 'the frame\'s keeping, and its one yards draw');
  assert.ok(kept < drawn, 'the matrices kept before the yards draw');
  assert.ok(y.includes('        n += y.pool.draw(r, remapOf(y), cull);'), 'every yard\'s pool given it');
  // AUDIT PERF-YARD 1: ...and the test handed on is the HOST's - `cull = null` passed every pin and switched the feature off
  const yd = y.slice(y.indexOf('    draw(r = deps.renderer) {'), y.indexOf('        n += y.pool.draw(r, remapOf(y), cull);'));
  assert.ok(/\n {6}const cull = deps\.cull \?\? null;/.test(yd), 'the cull the yards hand on is the one the host gave them');
});

test('PERF-YARD (AUDIT 15): a merchant yard - its timber and its wagons on show - follows the same law under the street\'s test: in view drawn, off screen in a shadow\'s reach cast alone (a wagon part that casts nothing still casting nothing), else neither; its box holds its timber and its wagons and is made again when it moves; through a window, no test (mutants: the yards untested; the cast arm drawn; a no-shadow part cast; the box kept where the yard stood; the street\'s test unwired; a window\'s view culled by the street\'s eye)', async () => {
  const { createMerchantYards, yardToScene } = await import('../src/scenes/merchantYardsHost.js');
  const log = { drawn: [], cast: [] };
  const renderer = {
    uploadTexture: () => {}, createMesh: (m) => ({ timber: m }), destroyMesh: () => {},
    drawMesh: (mesh, m, remap, o) => log.drawn.push([mesh.wagon ?? 'timber', m[12], o?.noShadow ?? false]),
    recordShadowMesh: (mesh, m) => log.cast.push([mesh.wagon ?? 'timber', m[12]]),
    createBillboardBatch: (a, r, size, centers) => ({ a, r, size, centers }), destroyBillboardBatch: () => {},
  };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const sites = [
    { key: '7:stable', kind: 'stable', x: 100, z: 50, yaw: 0, comp: 0, regionIndex: 17, race: 'Breton', keeper: { name: 'A', sex: 'female', variant: 1 } },
    { key: '7:transport', kind: 'transport', x: 140, z: 50, yaw: 90, comp: 0, regionIndex: 17, race: 'Redguard', keeper: { name: 'B', sex: 'male', variant: 2 } },
  ];
  const boxes = new Map([['cart', [-1, 0, -2, 1, 2, 2]], ['openWagon', [-1.2, 0, -3, 1.2, 2.5, 3]], ['caravan', [-1.3, 0, -3.5, 1.3, 3.2, 3.5]]]);
  const y = createMerchantYards({
    renderer, collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), getTexture: async () => tex, uploadRecordFrame: () => {},
    sites: () => sites, groundAt: () => 2, eye: () => [100, 3, 70], feet: () => null, horseArt: () => null,
    showWagon: (r, remap, pos) => { r.drawMesh({ wagon: 'body' }, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pos[0], pos[1], pos[2], 1]); r.drawMesh({ wagon: 'room' }, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pos[0], pos[1], pos[2], 1], null, { noShadow: true }); return true; },
    wagonBox: (kind) => boxes.get(kind) ?? null,
  });
  y.frame(); y.frame();
  const asked = new Map();
  const by = (verdicts) => (box) => { const key = box[0] < 120 ? 'stable' : 'transport'; asked.set(key, [...box]); return verdicts[key]; };
  // the stable in view, the wagon yard off screen in a shadow's reach
  assert.equal(y.draw(renderer, by({ stable: DECOR_DRAW, transport: DECOR_SHADOW })), 1, 'the drawn counted - the stable\'s timber');
  assert.deepEqual(log.drawn, [['timber', 100, false]], 'only the stable on screen');
  assert.deepEqual(log.cast.map(([k]) => k), ['timber', 'body', 'body', 'body'], 'the wagon yard into the maps alone - its room, which casts nothing, not there either');
  // its box: its timber and its three wagons, where they stand in the scene
  const tb = asked.get('transport');
  const t = sites[1];
  const P = log.cast.filter(([k]) => k === 'body').map(([, x]) => x);
  for (const x of P) assert.ok(x >= tb[0] - 1e-9 && x <= tb[3] + 1e-9, `a wagon (x ${x}) inside its yard's box ${tb[0]}..${tb[3]}`);
  const mid = yardToScene([t.x, 2, t.z], t.yaw, 0, 0, 0);
  assert.ok(tb[0] < mid[0] && mid[0] < tb[3] && tb[1] <= 2 && tb[4] > 3 && tb[2] < mid[2] && mid[2] < tb[5], 'round its ground, up past its caravan');
  // neither: nothing at all
  log.drawn.length = 0; log.cast.length = 0;
  assert.equal(y.draw(renderer, by({ stable: DECOR_SKIP, transport: DECOR_SKIP })), 0);
  assert.deepEqual([log.drawn, log.cast], [[], []]);
  // the yard moves (a recentre): its box made again where it stands
  sites[1] = { ...sites[1], x: 140 - 819.2 };
  y.frame();
  const seen = [];
  y.draw(renderer, (box) => { seen.push([...box]); return DECOR_SKIP; });
  assert.ok(Math.abs(seen[1][0] - (tb[0] - 819.2)) < 1e-3 && Math.abs(seen[1][3] - (tb[3] - 819.2)) < 1e-3, `the box moved with it (${seen[1][0]} from ${tb[0]})`);
  // no test (a window's view): everything drawn
  log.drawn.length = 0;
  assert.equal(y.draw(renderer), 2 + 3, 'every timber and every wagon');
  // the world host: the street's draw hands it the yards' test; a window's, none
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes('    merchantYards?.draw(renderer, yardCull);'), 'the street\'s draw tested');
  assert.ok(w.includes('renderer.outsideViewDraws?.add(({ renderer: r }) => { merchantYards?.draw(r); });'), 'the view out of a window untested - its eye is not the street\'s');
});
