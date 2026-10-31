// WG2 PHASE 4 (bible/03-World/World-2-Arc.md): THE WORLD EDITOR'S MODEL - edits as data in named layers over a bake,
// never in it; undo and redo; what an edit makes stale; the road from draft to published with its gates (validation, a
// second pair of eyes, staging, protected property) and an atomic publication a rollback restores; packages that refuse
// a change on the way; the artist's prefabs held to their budgets. Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { regionSampler } from '../../../src/world/gen2/regionSampler.js';
import { newDoc, addOp, addLayer, withLayer, editedSampler, docStale, opProblems } from '../../../src/world/gen2/edit/editLayers.js';
import { historyOf, commit, undo, redo } from '../../../src/world/gen2/edit/editHistory.js';
import { newHistory, saveDraft, advance, published, rollback, docDiff } from '../../../src/world/gen2/edit/revisions.js';
import { propertyConflicts } from '../../../src/world/gen2/edit/propertyGuard.js';
import { exportPackage, importPackage } from '../../../src/world/gen2/edit/contentPackage.js';
import { prefabProblems, gltfProblems } from '../../../src/world/gen2/edit/prefabCheck.js';
import { PREFABS } from '../../../src/world/gen2/settle/settlementGen.js';

const D = decodeBake(readBake(`${BAKE_DIR}/blackmarsh-test.wg2.gz`)), S = regionSampler(D), R = D.header.rect;
const P = [R.x + 40.5, R.y + 40.5], FAR = [R.x + 70.5, R.y + 70.5];

test('WG2 EDIT: a brush is data over the bake - it raises its circle by its strength at the heart and nothing past its radius; a flatten levels what the raise left; a hidden layer is the bake again (mutants: the falloff, the order, the visibility)', () => {
  let doc = newDoc(D.header.id, D.print);
  doc = addOp(doc, 0, { kind: 'raise', x: P[0], y: P[1], r: 2400, strength: 12, falloff: 'smooth' });
  const E = editedSampler(S, doc);
  assert.ok(Math.abs(E.heightAt(...P) - S.heightAt(...P) - 12) < 1, 'the heart raised by its strength (to the bake\'s cell)');
  assert.equal(E.heightAt(...FAR), S.heightAt(...FAR), 'nothing past the radius');
  const flat = addOp(addLayer(doc, 'levels'), 1, { kind: 'flatten', x: P[0], y: P[1], r: 300, level: 50, falloff: 'flat' });
  assert.ok(Math.abs(editedSampler(S, flat).heightAt(...P) - (S.heightAt(...P) - S.fields.elev.cubicAt(...P)) - 50) < 1.5, 'levelled over the raise');
  const hidden = withLayer(flat, 0, { ...flat.layers[0], visible: false });
  const Q = [P[0] + 0.8, P[1]];
  assert.equal(editedSampler(S, hidden).heightAt(...Q), S.heightAt(...Q), 'the raise hidden, past the flatten');
  assert.ok(editedSampler(S, flat).heightAt(...Q) > S.heightAt(...Q) + 5);
  assert.equal(editedSampler(S, withLayer(hidden, 1, { ...hidden.layers[1], visible: false })).heightAt(...P), S.heightAt(...P));
  assert.throws(() => addOp(withLayer(doc, 0, { ...doc.layers[0], locked: true }), 0, { kind: 'raise', x: 1, y: 1, r: 10, strength: 1 }), /locked/);
  assert.deepEqual(opProblems({ kind: 'raise', x: 1, y: 1, r: 0, strength: 1 }), ['radius']);
  assert.deepEqual(opProblems({ kind: 'teleport' }), ['kind']);
});

test('WG2 EDIT: undo and redo walk frozen documents; a change after an undo drops the steps undone; what an edit makes stale is its stages downstream - a biome\'s paint never re-erodes (mutants: the redo drop, the stale stages)', () => {
  const a = newDoc('r', 'p'), b = addOp(a, 0, { kind: 'raise', x: P[0], y: P[1], r: 100, strength: 1 }), c = addOp(b, 0, { kind: 'lower', x: P[0], y: P[1], r: 100, strength: 1 });
  let h = commit(commit(historyOf(a), b), c);
  h = undo(h); assert.equal(h.now, b); h = undo(h); assert.equal(h.now, a); h = redo(h); assert.equal(h.now, b);
  const d = addOp(b, 0, { kind: 'noise', x: P[0], y: P[1], r: 100, strength: 1 });
  h = commit(h, d); assert.equal(h.now, d); assert.deepEqual(h.future, []); assert.equal(redo(h), h);
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.layers[0].ops));
  const stale = docStale(b, R);
  assert.ok(stale.has('erosion') && stale.has('hydrology') && stale.has('biome') && !stale.has('geology'));
  const paint = docStale(addOp(a, 0, { kind: 'biome', x: P[0], y: P[1], r: 100, biome: 9 }), R);
  assert.ok(stale.has('erosion') && !paint.has('erosion') && !paint.has('hydrology') && paint.has('vegetation'));
});

test('WG2 PUBLISHING: draft, review, staging, published - each gate holds (clean, another\'s approval, staged, no protected property in the way); a publication retires the last; a rollback publishes the one before; a diff names what changed (mutants: each gate, the retire, the rollback)', () => {
  const a = addOp(newDoc('r', 'p'), 0, { kind: 'raise', x: 1, y: 1, r: 10, strength: 1 }), b = addOp(a, 0, { kind: 'lower', x: 2, y: 2, r: 10, strength: 1 });
  let h = saveDraft(newHistory(), a, { author: 'ana', note: 'a hill', at: '2026-10-31' });
  assert.deepEqual(advance(h, 1, { by: 'ana', at: 't', problems: ['road 2 is cut off'] }).refused, ['invalid: road 2 is cut off']);
  h = advance(h, 1, { by: 'ana', at: 't', problems: [] }).history;
  assert.deepEqual(advance(h, 1, { by: 'ana', at: 't' }).refused, ['a revision is approved by someone other than its author']);
  h = advance(h, 1, { by: 'bo', at: 't' }).history;
  assert.deepEqual(advance(h, 1, { by: 'bo', at: 't', staged: false }).refused, ['its staging checks have not passed']);
  assert.deepEqual(advance(h, 1, { by: 'bo', at: 't', staged: true, conflicts: [{ why: 'home of Cy stands under a raise' }] }).refused, ['protected: home of Cy stands under a raise']);
  h = advance(h, 1, { by: 'bo', at: 't', staged: true, conflicts: [] }).history;
  assert.equal(published(h).n, 1);
  h = saveDraft(h, b, { author: 'ana', note: 'a dale', at: 't' });
  for (const step of [{ by: 'ana', problems: [] }, { by: 'bo' }, { by: 'bo', staged: true }]) h = advance(h, 2, { at: 't', ...step }).history;
  assert.equal(published(h).n, 2); assert.equal(h.revisions[0].state, 'retired');
  h = rollback(h, { by: 'bo', at: 't' }).history;
  assert.equal(published(h).n, 3); assert.equal(published(h).print, h.revisions[0].print, 'the first one\'s ground again');
  assert.deepEqual(docDiff(a, b), [{ layer: 'Base edits', added: [{ kind: 'lower', x: 2, y: 2, r: 10, strength: 1 }], removed: [], layerAdded: false, layerRemoved: false }]);
});

test('WG2 PROTECTED PROPERTY: a home under a brush, a protected building moved or retired is a conflict, past the Bay as on it; a brush elsewhere is none (mutants: the reach, the legacy id, the retire)', () => {
  const home = { kind: 'home', owner: 'Cy', at: { x: P[0], y: P[1] }, mapId: 1234, key: 66051, layout: 'classic' };
  const doc = addOp(newDoc('r', 'p'), 0, { kind: 'raise', x: P[0] + 0.3, y: P[1], r: 400, strength: 2 });
  assert.equal(propertyConflicts(doc, [home]).length, 1);
  assert.deepEqual(propertyConflicts(addOp(newDoc('r', 'p'), 0, { kind: 'raise', x: FAR[0], y: FAR[1], r: 400, strength: 2 }), [home]), []);
  const moved = addOp(newDoc('r', 'p'), 0, { kind: 'building', id: 'rmb:1234:66051@classic', at: { x: 0, y: 0 } });
  assert.match(propertyConflicts(moved, [home])[0].why, /moved/);
  assert.match(propertyConflicts(newDoc('r', 'p'), [{ kind: 'room', owner: 'Di', building: 'set-tava-wells/b4' }], { retired: ['set-tava-wells/b4'] })[0].why, /retires/);
});

test('WG2 PACKAGES AND PREFABS: a package round-trips, and is refused changed on the way or against another bake; every shipped prefab is whole, and an artist\'s glTF over its budgets or without a licence is refused (mutants: the print, the base, a budget)', () => {
  const doc = addOp(newDoc(D.header.id, D.print), 0, { kind: 'biome', x: P[0], y: P[1], r: 200, biome: 9 });
  const pkg = exportPackage(doc);
  assert.deepEqual(importPackage(JSON.parse(JSON.stringify(pkg)), D.print).doc, JSON.parse(JSON.stringify(doc)));
  assert.ok(importPackage({ ...pkg, doc: { ...pkg.doc, revision: 9 } }, D.print).refused.includes('its print does not match: changed on the way'));
  assert.ok(importPackage(pkg, 'ffffffff').refused.includes('made against another bake of the region'));
  for (const p of PREFABS) assert.deepEqual(prefabProblems(p), [], p.id);
  const gltf = (tris, licence) => ({ asset: { extras: licence ? { licence: 'CC-BY 4.0, Ana' } : {} }, materials: [{}], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], accessors: [{ count: 8, min: [-4, 0, -4], max: [4, 6, 4] }, { count: tris * 3 }] });
  assert.deepEqual(gltfProblems(gltf(1200, true), PREFABS.find((p) => p.id === 'house-small')), []);
  assert.deepEqual(gltfProblems(gltf(9000, false), PREFABS.find((p) => p.id === 'house-small')), ['9000 triangles, over 6000', 'no licence in asset.extras']);
});

test('WG2 ROADS AND RIVERS: a road eases the ground to its level across its width and shoulder; a hand-drawn river cuts a channel under a surface that never rises and is water; nothing past their reach moves (mutants: the ease, the surface\'s hold, the channel)', () => {
  const a = [P[0] - 3, P[1]], b = [P[0] + 3, P[1] + 1];
  const road = editedSampler(S, addOp(newDoc('r', 'p'), 0, { kind: 'road', pts: [a, b], width: 6 }));
  const n = road.ways.roads[0], mid = n.pts[Math.floor(n.pts.length / 2)];
  assert.ok(Math.abs(road.heightAt(mid[0], mid[1]) - mid[2]) < 1e-9, 'on its level at the centre line');
  assert.equal(road.heightAt(P[0], P[1] + 5), S.heightAt(P[0], P[1] + 5), 'untouched past the shoulder');
  const river = editedSampler(S, addOp(newDoc('r', 'p'), 0, { kind: 'river', pts: [a, b], width: 12, depth: 2 }));
  const rv = river.ways.rivers[0];
  for (let i = 1; i < rv.pts.length; i++) assert.ok(rv.pts[i][2] <= rv.pts[i - 1][2], 'its surface never rises');
  const at = rv.pts[Math.floor(rv.pts.length / 2)];
  assert.equal(river.waterAt(at[0], at[1])?.kind, 'river');
  assert.ok(river.heightAt(at[0], at[1]) <= at[2] - 1.99, 'its bed under its surface by its depth');
  assert.deepEqual(opProblems({ kind: 'river', pts: [a, b], width: 12 }), ['width or depth']);
});

test('WG2 AUTHORED OVERRIDES: a bake made with a document stands its hand river as a river, its paint as the biome, its roads in the file, its document\'s print in its header - and the same document bakes the same bytes (mutants: the forced cells, the paint, the brushes unapplied)', async () => {
  const { canonReady } = await import('../../../src/world/gen2/canon.js');
  const { bakeRegion } = await import('../../../src/world/gen2/regionBake.js');
  const { encodeBake, decodeBake: decode, bakePrint } = await import('../../../src/world/gen2/bakeCodec.js');
  const { docPrint } = await import('../../../src/world/gen2/edit/revisions.js');
  await canonReady();
  const spec = { id: 'law-edits', rect: { x: R.x + 20, y: R.y + 20, w: 32, h: 32 }, res: 1, seed: D.header.seed, fit: D.header.fit, springs: [], erosion: { steps: 10 } };
  let doc = newDoc('law-edits', 'base');
  doc = addOp(doc, 0, { kind: 'river', pts: [[R.x + 24.5, R.y + 30.5], [R.x + 44.5, R.y + 34.5]], width: 10, depth: 2 });
  doc = addOp(doc, 0, { kind: 'biome', x: R.x + 30, y: R.y + 46, r: 1500, biome: 12 });
  doc = addOp(doc, 0, { kind: 'raise', x: R.x + 40, y: R.y + 45, r: 2000, strength: 40 });
  doc = addOp(doc, 0, { kind: 'road', pts: [[R.x + 26, R.y + 40], [R.x + 46, R.y + 41]], width: 6 });
  const plain = bakeRegion(spec), edited = bakeRegion(spec, { doc });
  const cellAt = (x, y) => (Math.floor(y - spec.rect.y)) * 32 + Math.floor(x - spec.rect.x);
  assert.ok(edited.fields.water.data[cellAt(R.x + 34.5, R.y + 32.5)] & 1, 'the hand river is a river');
  assert.equal(edited.fields.biome.data[cellAt(R.x + 30.5, R.y + 46.5)], 12, 'the paint stands');
  assert.ok(edited.fields.elev.data[cellAt(R.x + 40.5, R.y + 45.5)] > plain.fields.elev.data[cellAt(R.x + 40.5, R.y + 45.5)] + 20, 'the brush raised the worked land');
  const bytes = encodeBake(edited), back = decode(bytes);
  assert.equal(back.header.edits, docPrint(doc));
  assert.equal(back.header.roads.length, 1);
  assert.equal(bakePrint(bytes), bakePrint(encodeBake(bakeRegion(spec, { doc }))));
  const S2 = regionSampler(back), rd = back.header.roads[0].pts[3];
  assert.ok(Math.abs(S2.heightAt(rd[0], rd[1]) - rd[2]) < 0.5, 'the sampler eases the ground to the road');
});
