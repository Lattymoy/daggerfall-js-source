// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.6 and 11.9 - what
// EG-D still owed: `world/eliteGates/meshKit.js`, the moving pieces' pass, the cull and the measured budgets): THE MESH KIT, and THE
// PIECES BATCHED AND CULLED (scenes/eliteGates/egPieceBatch.js, scenes/eliteGates/egSpan.js). The kit: every shape's faces out whichever way it
// was listed, packed a sub-mesh a record with Uint32 indices, written a slice at a time past its first room. The batch: one
// draw a kind holding a copy a piece, each copy where its slot stands it, a hidden or culled copy put away, a kind with
// none seen not drawn, the vertices sent only when a copy moved. The spans: every circle's pieces in a handful of draws
// (the budget, measured against a draw a piece), the law's own pose in the copies, the other halls culled from a hall's
// eye; the cull runs before the dungeon's draws on this frame's frustum (the hosts' text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMeshKit, meshKitBounds, MESH_KIT_START } from '../../../src/world/eliteGates/meshKit.js';
import { createEgPieceBatch, EG_BATCH_HIDE_Y } from '../../../src/scenes/eliteGates/egPieceBatch.js';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { egCircleSpecs } from '../../../src/net/eliteGates/egLaw.js';
import { EG_HERO_FRAGS } from '../../../src/net/eliteGates/egHeroFrags.js';
import { egPieceAt } from '../../../src/net/eliteGates/egSpanLaw.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { spherePlanes } from '../../../src/render/bounds.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): law 8's circles given

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Each triangle of a packed model: its three corners and its stored normal. */
function tris(m) {
  const out = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const v = [0, 1, 2].map((k) => [...m.positions.subarray(m.indices[i + k] * 3, m.indices[i + k] * 3 + 3)]);
    out.push({ v, n: [...m.normals.subarray(m.indices[i] * 3, m.indices[i] * 3 + 3)], c: [0, 1, 2].map((k) => (v[0][k] + v[1][k] + v[2][k]) / 3) });
  }
  return out;
}
/** A view and projection looking from `eye` toward `at` (column-major, the port's camera's). */
function camera(eye, at, fov = 1.2, aspect = 16 / 9, near = 0.1, far = 2000) {
  const f = (() => { const d = sub(at, eye), l = Math.hypot(...d); return d.map((x) => x / l); })();
  const r = (() => { const c = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const l = Math.hypot(...c) || 1; return c.map((x) => x / l); })();
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const view = new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1]);
  const t = 1 / Math.tan(fov / 2);
  const proj = new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
  return { view, proj };
}
const near3 = (a, b, what) => { assert.ok(a && a.every((v, i) => Math.abs(v - b[i]) < 1e-4), `${what}: ${a} against ${b}`); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
/** A renderer that counts what the batch asks of it. */
function fakeRenderer() {
  const r = { made: [], moved: 0, destroyed: 0 };
  r.createMesh = (m) => { const g = { model: m, subMeshes: m.subMeshes, positions: Float32Array.from(m.positions) }; r.made.push(g); return g; };
  r.updateMeshVertices = (g, p) => { r.moved++; g.positions.set(p); };
  r.destroyMesh = () => { r.destroyed++; };
  return r;
}

test('EG-G2 THE MESH KIT (section 11.6): a box, a prism, an extrusion, a lathe and a sweep, each face out whichever way it was listed (its stored normal its winding\'s, pointing away from the solid); a box with its bottom left off; packed a sub-mesh a record, lowest first, contiguous, with Uint32 indices; a kit written past its first room keeps everything it held; the bounds\' sphere holds every vertex (mutants: a face wound in; the pack\'s records out of order; the growth losing a bucket)', () => {
  const k = createMeshKit();
  k.box(1, [0, 0, 0], [2, 1, 3]);
  let m = k.pack(38241);
  assert.equal(m.indices.length / 3, 12);
  for (const t of tris(m)) {
    const wound = (() => { const a = sub(t.v[1], t.v[0]), b = sub(t.v[2], t.v[0]); return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; })();
    assert.ok(dot(wound, t.n) > 0, 'the normal is the winding\'s');
    assert.ok(dot(t.n, sub(t.c, [1, 0.5, 1.5])) > 0, 'out of the box');
  }
  const kb = createMeshKit(); kb.box(0, [0, 0, 0], [1, 1, 1], { skip: ['bottom'] });
  assert.equal(kb.triangleCount, 10, 'the underside left off');
  // a prism, an extrusion, a lathe, a sweep: every face away from its solid's axis or middle
  const kp = createMeshKit(); kp.prism(0, [[0, 0], [2, 0], [2, 1], [0, 1]], 0, 1, { top: true, bottom: true });
  for (const t of tris(kp.pack(1))) assert.ok(dot(t.n, sub(t.c, [1, 0.5, 0.5])) > 0, 'the prism out');
  const ke = createMeshKit(); ke.extrude(0, [[-0.2, 0], [0.2, 0], [0.2, 0.3], [-0.2, 0.3]], [0, 1, 0], [0, 1, 4]);
  for (const t of tris(ke.pack(1))) assert.ok(dot(t.n, sub(t.c, [0, 1.15, t.c[2] < 0.01 ? 1 : t.c[2] > 3.99 ? 3 : t.c[2]])) > 0, 'the extrusion out');
  const kl = createMeshKit(); kl.lathe(0, [[0, 0], [0.5, 0], [0.5, 2], [0.3, 2.2], [0, 2.2]], 16);
  const lt = tris(kl.pack(1));
  assert.equal(lt.length, 16 * (1 + 2 + 2 + 1));
  for (const t of lt) assert.ok(dot(t.n, sub(t.c, [0, 1.1, 0])) > 0, 'the lathe out');
  const ks = createMeshKit(); ks.sweep(0, [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]], [[0, 0, 0], [0, 0, 2], [1, 0, 4], [3, 0.5, 5]]);
  const st = tris(ks.pack(1));
  assert.equal(st.length, 3 * 4 * 2);
  const near = (c) => { const P = [[0, 0, 0], [0, 0, 2], [1, 0, 4], [3, 0.5, 5]]; let best = null, bd = Infinity; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1], ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(c, a), ab) / dot(ab, ab))), q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t], d = Math.hypot(...sub(c, q)); if (d < bd) { bd = d; best = q; } } return best; };
  for (const t of st) assert.ok(dot(t.n, sub(t.c, near(t.c))) > 0, 'the sweep out of its path');
  // the pack: records lowest first, contiguous; growth past the first room
  const kg = createMeshKit({ start: 6 });
  for (let i = 0; i < 40; i++) kg.box(i % 3 === 0 ? 7 : 2, [i, 0, 0], [i + 0.5, 1, 1]);
  m = kg.pack(38261);
  assert.ok(MESH_KIT_START > 6);
  assert.ok(m.indices instanceof Uint32Array);
  assert.deepEqual(m.subMeshes.map((s) => s.textureRecord), [2, 7]);
  assert.equal(m.subMeshes[0].startIndex, 0); assert.equal(m.subMeshes[1].startIndex, m.subMeshes[0].primitiveCount * 3);
  assert.equal(m.subMeshes.reduce((a, s) => a + s.primitiveCount, 0), 40 * 12);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === 38261));
  const xs = new Set(); for (const t of tris(m)) xs.add(Math.floor(Math.min(...t.v.map((v) => v[0]))));
  assert.equal(xs.size, 40, 'every box kept through the growth');
  const b = meshKitBounds(m.positions);
  for (let i = 0; i < m.positions.length; i += 3) assert.ok(Math.hypot(m.positions[i] - b.centre[0], m.positions[i + 1] - b.centre[1], m.positions[i + 2] - b.centre[2]) <= b.r + 1e-6);
});

test('EG-G2 THE BATCH (section 11.9): one draw a kind holding a copy a piece - its indices offset a copy\'s vertices on, its sub-meshes a record each over every copy; each copy written where its slot stands it, a hidden one (or a pose\'s zeros) put away under every floor, a kind with none seen not drawn; the vertices sent only when a copy moved, came or went; cleared, every mesh freed (mutants: a copy written at the origin; a hidden copy drawn; every frame re-sent)', () => {
  const R = fakeRenderer(), batch = createEgPieceBatch({ renderer: R });
  const kitA = createMeshKit(); kitA.box(0, [-1, 0, -1], [1, 0.3, 1]); kitA.box(32, [-1, 0.3, -1], [1, 0.32, 1], { skip: ['bottom'] });
  const kitB = createMeshKit(); kitB.box(1, [-0.2, 0, -0.2], [0.2, 2, 0.2]);
  const A = kitA.pack(38241), B = kitB.pack(38241);
  const slot = (x, y, z) => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; m[13] = y; m[14] = z; return { object: { matrix: m }, hidden: false }; };
  const a = [slot(0, 0, 0), slot(10, 1, 5), slot(-4, 2, 30)], b = [slot(3, 0, 3), slot(6, 0, 6)];
  for (const s of a) batch.add('slab', A, s);
  for (const s of b) batch.add('post', B, s);
  const draws = [];
  assert.equal(batch.build(draws), 2, 'two kinds, two draws');
  assert.equal(draws.length, 2);
  assert.ok(draws.every((d) => d.noShadow && d.hidden), 'no shadow; hidden until the first cull');
  const gA = R.made[0];
  assert.equal(gA.model.positions.length, A.positions.length * 3);
  assert.deepEqual(gA.subMeshes.map((s) => [s.textureRecord, s.primitiveCount]), A.subMeshes.map((s) => [s.textureRecord, s.primitiveCount * 3]));
  const V = A.positions.length / 3;
  assert.equal(Math.max(...gA.model.indices), 3 * V - 1, 'the last copy\'s last vertex');
  assert.equal(batch.cull(null), 2);
  assert.ok(draws.every((d) => !d.hidden));
  for (const [i, s] of a.entries()) near3(batch.copyAt('slab', i), [s.object.matrix[12], s.object.matrix[13], s.object.matrix[14]], `copy ${i} where its slot stands it`);
  assert.equal(R.moved, 2, 'each kind sent once');
  batch.cull(null);
  assert.equal(R.moved, 2, 'nothing moved: nothing sent');
  a[1].object.matrix[12] = 12;
  batch.cull(null);
  assert.equal(R.moved, 3, 'one copy moved: its kind sent');
  near3(batch.copyAt('slab', 1), [12, 1, 5], 'moved');
  a[2].hidden = true;
  batch.cull(null);
  assert.equal(R.made[0].positions[2 * V * 3 + 1], EG_BATCH_HIDE_Y, 'a hidden copy put away');
  b[0].object.matrix.fill(0); b[1].hidden = true;
  assert.equal(batch.cull(null), 1, 'a kind with none seen');
  assert.ok(draws[1].hidden);
  const st = batch.stats();
  assert.deepEqual([st.kinds, st.copies, st.drawn, st.hidden], [2, 5, 1, 3]);
  assert.equal(st.glDraws, A.subMeshes.length, 'its sub-meshes the GL draws');
  batch.clear();
  assert.equal(R.destroyed, 2);
});

test('EG-G2 THE CULL (section 11.9): against this frame\'s frustum, a copy behind the eye or past the far plane is put away and one in view written; a kind wholly out of view not drawn (mutants: the planes ignored; the pad dropped so a copy on the edge flickers)', () => {
  const R = fakeRenderer(), batch = createEgPieceBatch({ renderer: R });
  const k = createMeshKit(); k.box(0, [-1, 0, -1], [1, 0.3, 1]);
  const M = k.pack(1), slot = (x, z) => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; m[14] = z; return { object: { matrix: m }, hidden: false }; };
  const ahead = slot(0, -20), behind = slot(0, 20), far = slot(0, -3000), edge = slot(0, 1.0);
  for (const s of [ahead, behind, far, edge]) batch.add('k', M, s);
  batch.build([]);
  const { view, proj } = camera([0, 1, 0], [0, 1, -1], 1.2, 16 / 9, 0.1, 2000);
  const planes = spherePlanes(mul(proj, view));
  batch.cull(planes);
  near3(batch.copyAt('k', 0), [0, 0, -20], 'ahead: drawn');
  assert.equal(batch.copyAt('k', 1)[1] + M.positions[1], EG_BATCH_HIDE_Y, 'behind: put away');
  assert.equal(batch.copyAt('k', 2)[1] + M.positions[1], EG_BATCH_HIDE_Y, 'past the far plane: put away');
  near3(batch.copyAt('k', 3), [0, 0, 1.0], 'a copy whose sphere still reaches the near plane: kept');
  assert.equal(batch.stats().culled, 2);
});

test('EG-G2 THE BUDGET, MEASURED (section 11.9): over every circle of three seeds, the spans\' pieces stand in a handful of batched draws where they stood a draw a piece - the batched GL draws at most 48 a circle, the dynamic draws at most a tenth of a draw a piece, and one, on the Falling Walls\' circles; the copies the law\'s own pose (a Drift where egPieceAt swings it); from Hall 1\'s plate looking down its course the other halls\' pieces culled; the cull of a whole circle well under a millisecond (mutants: a kind a piece; the pose not written; the cull skipped)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): measured over spec law 8's circles, each given as a breach of law 8's
  // is (test/egGive8.mjs) - the Stacks' hero, the Falling Wall's circle, Grath's isles where law 8 lays them; a LAW 9 circle's
  // budget (its rooms beside its pieces) is THE DRESS's to measure
  let worstGl = 0, sumPieces = 0, sumKinds = 0, fw = null;
  for (const seed of [7, 99, 12345]) for (let c = 1; c <= 20; c += 1) {
    egGive8(seed, [c]);
    const plain = createEgSpan({ renderer: { createMesh: (m) => ({ subMeshes: m.subMeshes }), destroyMesh: () => {} }, seed, c });
    const plainDraws = [];
    plain.stand({ dynamicDraws: plainDraws, collider: null });
    const glPlain = plainDraws.reduce((a, d) => a + d.gpu.subMeshes.length, 0);
    const R = fakeRenderer(), span = createEgSpan({ renderer: R, seed, c }), draws = [];
    span.stand({ dynamicDraws: draws, collider: null });
    span.ride(1000, 0.016, null, false);
    span.cull(null, null);
    const st = span.batchStats();
    assert.ok(st && st.kinds <= st.copies);
    worstGl = Math.max(worstGl, st.glDraws);
    sumPieces += plainDraws.length; sumKinds += draws.length;
    assert.ok(draws.length <= plainDraws.length, `circle ${c}: never more draws`);
    assert.ok(st.glDraws <= glPlain, `circle ${c}: never more GL draws (${st.glDraws} of ${glPlain})`);
    // PIN MOVED (AUDIT EG IV, the Fallen Stacks laid since): a hero's inner course is pieces of its own sizes, a draw each
    // (seed 7's circle 3 lays the Stacks: 23 draws where 204 stood) - so the Falling Walls' tenth is held with a draw a hero
    // piece beside it
    // (THE ASCENT, LAW 9: a room is a hero of no course - net/eliteGates/egRoomLaw.js - and lays no piece)
    const heroPieces = egCircleSpecs(seed, c, 0).reduce((n, s) => n + (s.heroes ?? []).filter((q) => !q.room).reduce((k, q) => k + EG_HERO_FRAGS[q.id].course.length, 0), 0);
    if (!fw && egCircleSpecs(seed, c, 0).some((s) => s.variant === 'fallingwall')) fw = { plain: plainDraws.length, batched: draws.length, heroPieces };
  }
  assert.ok(worstGl <= 48, `the worst circle: ${worstGl} batched GL draws`);
  assert.ok(sumKinds * 3 <= sumPieces, `${sumKinds} draws where ${sumPieces} stood`);
  // the batched kinds wear their band's dress (the Shade's, circle 11)
  egGive8(7, [11]);
  const RS = fakeRenderer(), shade = createEgSpan({ renderer: RS, seed: 7, c: 11 });
  shade.stand({ dynamicDraws: [], collider: null });
  const dressed = RS.made.filter((g) => g.subMeshes.some((sm) => sm.textureRecord === 0));
  assert.ok(dressed.length && dressed.every((g) => g.subMeshes.filter((sm) => [0, 1, 32].includes(sm.textureRecord)).every((sm) => sm.textureArchive === 38261)), 'the batched slabs in the Shade\'s dress');
  // Grath's islands and the false walls: their own draws, culled outside the frustum
  egGive8(7, [1]);
  const RG = fakeRenderer(), gs = createEgSpan({ renderer: RG, seed: 7, c: 1 }), gd = [];
  gs.stand({ dynamicDraws: gd, collider: null });
  gs.ride(1, 0.016, null, false);
  const court = egCircleSpecs(7, 1, 0)[4], isleDraws = gd.filter((d) => d.sphere);
  assert.ok(isleDraws.length >= 3, 'Grath\'s islands stood as draws');
  const away = camera(egToDungeon(court, 0, 5, -60), egToDungeon(court, 0, 5, -120));
  gs.cull(away.proj, away.view);
  assert.ok(isleDraws.every((d) => d.culled), 'looking away: every island culled');
  const toward = camera(egToDungeon(court, 0, 20, -40), egToDungeon(court, 0, 0, 60));
  gs.cull(toward.proj, toward.view);
  assert.ok(isleDraws.some((d) => !d.culled), 'looking at them: drawn');
  assert.ok(fw && fw.batched * 10 <= fw.plain + 10 + 10 * fw.heroPieces, `a Falling Wall's circle: ${fw?.batched} draws where ${fw?.plain} stood (${fw?.heroPieces} a hero's)`);
  assert.equal(fw.heroPieces, 2, 'the Stacks\' two shelves');
  // the copies are the law's pose, and the other halls are culled from Hall 1's plate
  let found = null;
  for (let c = 1; c <= 20 && !found; c++) { egGive8(7, [c]); for (const s of egCircleSpecs(7, c, 0)) { const d = s.steps.find((q) => q.kind === 'drift' && q.amp > 0); if (d) { found = { c, s, d }; break; } } }

  const R = fakeRenderer(), span = createEgSpan({ renderer: R, seed: 7, c: found.c });
  span.stand({ dynamicDraws: [], collider: null });
  const t = 3.21;
  span.ride(t, 0.016, null, false);
  span.cull(null, null);
  const at = egPieceAt(found.d, t), want = realmToDungeon(found.s.x0 + found.d.x + at.dx, found.d.y, found.d.z + at.dz);
  // PIN MOVED (EG-LOOK, the spans' pieces): a Drift is the band's slab now (world/eliteGates/egPlatformModel.js), in the movers' kind -
  // its copy found by its top's own corner (the Steps' 3 x 2.4 box), where the law swings it; it was the Steps' record 60
  const corner = [want[0] - 1.5, want[1], want[2] - 1.2];
  let hit = false;
  for (const g of R.made) { const ps = g.positions; for (let i = 0; i < ps.length && !hit; i += 3) if (Math.abs(ps[i] - corner[0]) < 1e-3 && Math.abs(ps[i + 1] - corner[1]) < 1e-3 && Math.abs(ps[i + 2] - corner[2]) < 1e-3) hit = true; }
  assert.ok(hit, 'a Drift\'s copy where the law swings it');
  const specs = egCircleSpecs(7, found.c, 0), first = specs[0];
  const eye = egToDungeon(first, 0, 1.7, first.arrive.z), look = egToDungeon(first, 0, 1.7, first.arrive.z + 30);
  const { view, proj } = camera(eye, look);
  span.cull(proj, view);
  const culled = span.batchStats().culled;
  const otherPieces = specs.slice(1).reduce((a, s) => a + s.steps.length, 0);
  assert.ok(culled >= otherPieces * 0.9, `from Hall 1's plate: ${culled} copies culled of the other halls' ${otherPieces}`);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) { span.ride(t + i * 0.016, 0.016, null, false); span.cull(proj, view); }
  const ms = (performance.now() - t0) / 200;
  assert.ok(ms < 1.5, `a frame's ride and cull: ${ms.toFixed(3)} ms`);
});

test('EG-G2 THE HOSTS: the dungeon arm culls the Spire\'s pieces on this frame\'s view and projection right before its dynamic draws (scenes/worldModes.js), through the dungeon context\'s egSpanCull (scenes/dungeonContext.js); the spans batch only for a renderer that moves vertices (mutants: the cull after the draws; the batch without the seam)', () => {
  const W = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const cull = W.indexOf('if (isEgHall(dungeonLoc)) dungeonCtx.egSpanCull?.(proj, view);'), drawsAt = W.indexOf('for (const d of dungeonCtx.dynamicDraws) if (!d.hidden && !d.culled) renderer.drawMesh(');
  assert.ok(cull > 0 && drawsAt > cull && drawsAt - cull < 800, 'the cull, then the draws (the level\'s static batch and draw list between - PERF5\'s pins hold those two to the movers)');
  const D = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(D, /egSpanCull\(proj, view\) \{ return egSpan\?\.cull\(proj, view\) \?\? 0; \}/);
  const S = readFileSync(new URL('../../../src/scenes/eliteGates/egSpan.js', import.meta.url), 'utf8');
  assert.match(S, /batch = renderer\?\.createMesh && renderer\?\.updateMeshVertices \? createEgPieceBatch\(\{ renderer \}\) : null;/);
  const plain = createEgSpan({ renderer: { createMesh: (m) => ({ subMeshes: m.subMeshes }) }, seed: 7, c: 1 });
  plain.stand({ dynamicDraws: [], collider: null });
  assert.equal(plain.batchStats(), null, 'no seam, no batch');
});
