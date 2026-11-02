// FIELD BUGS 2026-10-21c (a player's CPU profile online: the Come Sail Away pool's frame 11% of the frame, 6% with the
// peers' boats not loaded - scenes/comeSailAway/comeSailAwayPool.js frame -> walkBoat, lateUpdateHolder, syncFlats - and
// rendererModelKey, through partKey, 2.6%, the key made again most frames; bible/07-Rendering/Performance-Priority.md
// BOAT-STAMP and BOAT-FAR).
//
// BOAT-STAMP: EACH TREE ITS OWN SHAPE STAMP (world/prefabNode.js prefabShapeStamp) - a boat built, re-dressed or fitted
// anywhere made every boat's plan, bones, still chains, Animators and colliders again the next frame, because the stamp
// was one count for every tree in the game. BOAT-FAR: A FAR BOAT LIVES BY NAVALHOST'S LAW (scenes/comeSailAway/
// farLife.js) - walked, baked and lit one frame in FAR_LIFE_EVERY past NEAR_LIFE_M on the time she missed, her last
// walk held for the flats and the draw and carried to where she stands; and a peer's boat's Animators by the same law.
// Its audit (the same day): a held walk kept no longer than her tree's switches stand (world/prefabNode.js
// prefabSwitchStamp); each drawn mesh matched to its own part; a part outside her hull's frame; setParent's refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool, STILL_FRAMES } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { NEAR_LIFE_M, FAR_LIFE_EVERY, farLife, farLifeStep } from '../../../src/scenes/comeSailAway/farLife.js';
import * as navalHost from '../../../src/scenes/naval/navalHost.js';
import { Boat, boatAnimators, setLights } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { collidersOf } from '../../../src/world/prefabColliders.js';
import { freshPool } from '../../navalSea.mjs';

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
const standInPipeline = () => ({ textureFiles: { get: () => texture() }, cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) });
const settle = () => new Promise((r) => setTimeout(r, 5));

/** A pool over a renderer that records each draw (its mesh and matrix) and each flat it stands. */
async function recordingPool() {
  const log = { drawn: [], flats: [] };
  const renderer = {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }),
    drawMesh: (mesh, matrix) => log.drawn.push({ mesh, matrix }), updateMeshVertices() {},
    createBillboardBatch: (a, rec, size) => { const b = { a, rec, size }; log.flats.push(b); return b; }, destroyBillboardBatch() {}, destroyMesh() {},
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return { pool, log };
}
/** How often each boat's root's children are read while `fn` runs - a walk of her reads them, nothing else the frame
 *  and the draw do (AUDIT PRE-MERGE 0928 R5's own count). */
function childReads(boats, fn) {
  const reads = new Map(boats.map((b) => [b, 0]));
  const kids = new Map(boats.map((b) => [b, b.GameObject.children]));
  for (const b of boats) Object.defineProperty(b.GameObject, 'children', { configurable: true, get() { reads.set(b, reads.get(b) + 1); return kids.get(b); } });
  try { fn(); } finally { for (const b of boats) { delete b.GameObject.children; b.GameObject.children = kids.get(b); } }
  return reads;
}
const bonesOf = (b) => [...b.GameObject.walk()].flatMap((n) => n.getComponents('FixDeformations')).map((f) => f.bakedMesh?.bones).filter(Boolean);
const near = (a, b, eps = 1e-3) => a.length === b.length && [...a].every((v, i) => Math.abs(v - b[i]) < eps);
/** Each of `drawnList` (her meshes drawn but her batch) matched to a part of her plan of its own: drawn with that
 *  part's mesh (`gpu`, the draw's record of what it drew the part with) at the matrix that part's node stands at now -
 *  no part matched twice, so a mesh drawn where some OTHER node of hers stands matches nothing. Answers the parts. */
function eachAtItsPart(drawnList, plan, what) {
  const free = plan.parts.filter((e) => e.gpu);
  const matched = [];
  for (const d of drawnList) {
    const k = free.findIndex((e) => e.gpu === d.mesh && near(d.matrix, e.node.worldMatrix()));
    assert.ok(k >= 0, `${what}: a mesh drawn where no part of hers drawn with it stands (at ${[...d.matrix].slice(12, 15).map((v) => v.toFixed(2))})`);
    matched.push(...free.splice(k, 1));
  }
  return matched;
}

test('BOAT-STAMP: a boat built, re-dressed, reshaped or given a component makes her own plan, Animators and colliders again and no other boat\'s - each tree its own shape stamp (mutants: one stamp for every tree; the tree a node left, or the one it joined, unstamped)', async () => {
  const { pool } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const sea = [HULL.SmallShip, HULL.LargeGalley, HULL.Carrack].map((h, i) => { const b = pool.spawnSeaNow(new Boat(h, 0)); b.GameObject.position = [i * 60, 0, -80]; return b; });
  const peer = pool.spawnPeerNow(new Boat(HULL.LargeBoat, 0));
  peer.GameObject.position = [0, 0, 80];
  const all = [...sea, peer];
  const frame = async () => { pool.frame(1 / 60, world); pool.draw(); await settle(); };
  for (let i = 0; i < 30; i++) await frame();
  const kept = () => new Map(all.map((b) => [b, { plan: pool.walkOf(b).plan, animators: boatAnimators(b), bones: bonesOf(b) }]));
  for (const b of all) collidersOf(b.GameObject);   // each tree's colliders indexed
  /** After `fn` and a frame: the boats in `moved` have made theirs again, every other keeps what it had. */
  const only = async (what, moved, fn) => {
    const had = kept();
    fn();
    for (let i = 0; i < 8; i++) await frame();   // past every sail's tick (a holder finds its bones again only when it bakes)
    const reads = childReads(all, () => { for (const b of all) collidersOf(b.GameObject); });
    for (const b of all) {
      const was = had.get(b), now = pool.walkOf(b).plan;
      if (moved.includes(b)) {
        assert.notEqual(now, was.plan, `${what}: her own plan made again`);
        assert.ok(reads.get(b) > 0, `${what}: her colliders indexed again`);
        continue;
      }
      assert.equal(now, was.plan, `${what}: hull ${b.hull}'s plan kept - no model key of hers made again`);
      assert.equal(boatAnimators(b), was.animators, `${what}: hull ${b.hull}'s Animators kept`);
      assert.deepEqual(bonesOf(b).map((x, i) => x === was.bones[i]), was.bones.map(() => true), `${what}: hull ${b.hull}'s bones kept`);
      assert.equal(reads.get(b), 0, `${what}: hull ${b.hull}'s colliders not indexed again`);
    }
  };
  assert.ok(bonesOf(sea[0]).length > 0, 'her sails baked, their bones found');
  let built = null;
  await only('a sea ship built elsewhere', [], () => { built = pool.spawnSeaNow(new Boat(HULL.Rowboat, 0)); built.GameObject.position = [500, 0, 500]; });
  await only('a tree built anywhere', [], () => { new PrefabNode('Elsewhere').setParent(new PrefabNode('OtherTree')); });
  await only('a peer\'s boat re-dressed', [peer], () => pool.setVariant(peer, 2));
  const hung = new PrefabNode('BoatStampProbe');
  await only('a node hung under one', [sea[0]], () => hung.setParent(sea[0].MeshObject));
  await only('the node taken out of her', [sea[0]], () => hung.setParent(null));
  await only('a node of one hung under another', [sea[1], sea[2]], () => hung.setParent(sea[1].MeshObject).setParent(sea[2].MeshObject));
  await only('a component added to one', [sea[1]], () => sea[1].MeshObject.addComponent({ type: 'BoatStampProbe' }));
  pool.remove(built);
});

test('BOAT-STAMP (its audit): a node is never hung under itself or a node of its own - setParent refuses it, as Unity\'s SetParent does, by a throw before anything moves; the tree stands as it stood, its stamp too (every climb to a tree\'s top would never end) - in a child, so the mutant hangs that child, not the suite (mutant: the refusal gone)', () => {
  const url = new URL('../../../src/world/prefabNode.js', import.meta.url).href;
  const script = `
    const { PrefabNode, prefabShapeStamp } = await import(${JSON.stringify(url)});
    const top = new PrefabNode('Top'), mid = new PrefabNode('Mid').setParent(top), leaf = new PrefabNode('Leaf').setParent(mid);
    const stamp = prefabShapeStamp(leaf), out = [];
    for (const [node, under] of [[mid, leaf], [top, leaf], [leaf, leaf]]) {
      try { node.setParent(under); out.push('hung'); } catch (e) { out.push(e.message); }
    }
    out.push({ stands: mid.parent === top && leaf.parent === mid && top.parent === null, children: [top.children.length, mid.children.length, leaf.children.length], stamp: prefabShapeStamp(leaf) === stamp });
    console.log(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, `the child ran to its end (${r.signal ?? r.stderr})`);
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.deepEqual(out.slice(0, 3).map((m) => /cannot hang under itself or a node of its own/.test(m)), [true, true, true], `each refused (${out.slice(0, 3)})`);
  assert.deepEqual(out[3], { stands: true, children: [1, 1, 0], stamp: true }, 'the tree as it stood');
});

/** Each frame's walks, timers and draws of the boats while `steps` frames run. */
async function watched(pool, log, boats, steps, world, each = () => {}) {
  const frames = [];
  for (let f = 0; f < steps; f++) {
    each(f);
    const timers = (b) => ({ lantern: b.Lights[0]?.node.getComponent('DungeonLightHandler').timer, holder: holderOf(b)?.timer });
    const before = new Map(boats.map((b) => [b, timers(b)]));
    log.drawn.length = 0;
    const reads = childReads(boats, () => { pool.frame(1 / 60, world); pool.draw(); });
    frames.push({ reads, before, after: new Map(boats.map((b) => [b, timers(b)])), drawn: [...log.drawn] });
    await settle();
  }
  return frames;
}
/** A sail's holder of hers (a FixDeformations on its timer, not an every-frame rope). */
const holderOf = (b) => [...b.GameObject.walk()].flatMap((n) => n.getComponents('FixDeformations')).find((f) => !f.everyFrame && f.skinnedMeshRenderer) ?? null;
/** One step of a timer the frame ran on `dt`: Math.fround's sum, or back to nought where it ran over. */
const stepped = (t0, t1, dt) => t1 === 0 || Math.abs(t1 - t0 - dt) < 1e-5;

test(`BOAT-FAR: past NEAR_LIFE_M a boat is walked, her sails baked and her lanterns decided one frame in FAR_LIFE_EVERY on the time she missed, each boat on her own frame of the stride; a near one every frame; between, her last walk is the flats' and the draw's - never walked again - her still batch drawn at her hull's matrix as it stands and every other part (each drawn mesh matched to a part of its own, a part turned out of her batch among them) and flat where she stands now, a move between the frame and its draw included (mutants: the far law unread; the bake's or the lanterns' missed time dropped; the held walk walked again; held matrices unshifted; shifted by her root's move, not her hull's; her batch at the held hull; the shift kept past a move; her parts, or those out of her batch, drawn at her hull's matrix)`, async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const nearBoat = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)); nearBoat.GameObject.position = [0, 0, -50];
  const far = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)); far.GameObject.position = [0, 0, -1000];
  const far2 = pool.spawnSeaNow(new Boat(HULL.LargeGalley, 0)); far2.GameObject.position = [400, 0, -1500];
  setLights(nearBoat, true); setLights(far, true);
  const boats = [nearBoat, far, far2];
  assert.ok(far.Lights.length && holderOf(far), 'she carries lanterns and sails');
  for (let i = 0; i < STILL_FRAMES * 2; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  assert.ok(pool.stillOf(far), 'her still parts merged');
  // she sails on and rolls further as she goes, every frame
  const sail = (f) => {
    const p = far.GameObject.position;
    far.GameObject.position = [p[0] + 0.5, p[1], p[2]];
    const a = 0.01 * f;
    far.MeshObject.localRotation = [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
  };
  const frames = await watched(pool, log, boats, FAR_LIFE_EVERY * 3, world, sail);
  const walked = (b) => frames.map((fr, f) => (fr.reads.get(b) > 0 ? f : -1)).filter((f) => f >= 0);
  assert.equal(walked(nearBoat).length, frames.length, 'near: walked every frame');
  for (const b of [far, far2]) {
    const on = walked(b);
    assert.equal(on.length, 3, `hull ${b.hull} far: one frame in ${FAR_LIFE_EVERY} (${on})`);
    assert.ok(on.every((f, i) => i === 0 || f - on[i - 1] === FAR_LIFE_EVERY), 'on her stride');
  }
  assert.notEqual(walked(far)[0], walked(far2)[0], 'each far boat on her own frame of the stride');
  for (let f = 0; f < frames.length; f++) {
    const { before, after, reads } = frames[f];
    const n0 = before.get(nearBoat), n1 = after.get(nearBoat);
    assert.ok(stepped(n0.lantern, n1.lantern, 1 / 60) && stepped(n0.holder, n1.holder, 1 / 60), `near (${f}): her lanterns and sails on this frame's time`);
    const f0 = before.get(far), f1 = after.get(far);
    if (reads.get(far) > 0) {
      assert.ok(stepped(f0.lantern, f1.lantern, FAR_LIFE_EVERY / 60), `far (${f}): her lanterns on the time she missed (${f0.lantern} -> ${f1.lantern})`);
      assert.ok(stepped(f0.holder, f1.holder, FAR_LIFE_EVERY / 60), `far (${f}): her sails on the time she missed (${f0.holder} -> ${f1.holder})`);
    } else assert.deepEqual(f1, f0, `far (${f}): held - her lanterns and sails as they were`);
  }
  // held: what is drawn of her and her flats stand where she is now - a part of her hull's frame turned once before her
  // next walk among them (a door opened): it leaves her batch, and is drawn on its own while it calms
  let sailed = frames.length;   // her sailing's frame
  const turned = pool.walkOf(far).plan.parts.find((e) => pool.stillOf(far).nodes.has(e.node) && !e.node.children.length && !near(e.node.worldMatrix(), far.MeshObject.worldMatrix()))?.node;
  assert.ok(turned, 'a part of her batch, standing off her hull\'s own matrix');
  turned.localRotation = [0, Math.sin(0.2), 0, Math.cos(0.2)];
  let last = null, walkedSince = false;
  for (let i = 0; i < FAR_LIFE_EVERY * 2 && !last; i++) {
    const [fr] = await watched(pool, log, [far], 1, world, () => sail(sailed++));
    if (fr.reads.get(far) > 0) walkedSince = true;
    else if (walkedSince) last = fr;
  }
  assert.ok(last, 'a frame that held her, walked since the turn');
  const w = pool.walkOf(far), still = pool.stillOf(far);
  const hers = (d) => Math.hypot(d.matrix[12] - far.GameObject.position[0], d.matrix[14] - far.GameObject.position[2]) < 150;
  const drawnOfHers = last.drawn.filter(hers);
  const batch = drawnOfHers.filter((d) => d.mesh === still.mesh);
  assert.equal(batch.length, 1, 'her batch drawn once');
  assert.ok([...batch[0].matrix].every((v, i) => Object.is(v, far.MeshObject.worldMatrix()[i])), 'at her hull\'s matrix as it stands now, to the bit');
  assert.equal(still.nodes.has(turned), false, 'the part turned out of it');
  const own = eachAtItsPart(drawnOfHers.filter((d) => d.mesh !== still.mesh), w.plan, 'held');
  assert.ok(own.some((e) => !e.chain), 'her parts in no still chain (her sails) drawn on their own, each where its own node stands now');
  assert.ok(own.some((e) => e.node === turned), 'and the part turned, drawn on its own where it stands now');
  const flatsOfHers = pool.batches().filter((b) => Math.hypot(b.origin[0] - far.GameObject.position[0], b.origin[2] - far.GameObject.position[2]) < 150);
  assert.ok(flatsOfHers.length > 0, 'her flats stand');
  const flatNodes = w.plan.flats.map((e) => e.node.worldMatrix());
  for (const b of flatsOfHers) assert.ok(flatNodes.some((m) => near([b.origin[0], b.origin[1] + b.size.h / 2, b.origin[2]], [m[12], m[13], m[14]])), 'each flat where its node stands now');
  // moved between a frame that held her and its draw: the draw stands her where she is at the draw, batch and parts alike
  let between = false;
  for (let i = 0; i < FAR_LIFE_EVERY && !between; i++) {
    const reads = childReads([far], () => pool.frame(1 / 60, world));
    if (reads.get(far) > 0) { pool.draw(); await settle(); continue; }
    between = true;
    sail(sailed++);
    log.drawn.length = 0;
    pool.draw();
    const now = log.drawn.filter(hers), hull = far.MeshObject.worldMatrix(), mesh = pool.stillOf(far).mesh;
    assert.ok(now.some((d) => d.mesh === mesh && [...d.matrix].every((v, k) => Object.is(v, hull[k]))), 'her batch at her hull as she stands at the draw');
    assert.ok(eachAtItsPart(now.filter((x) => x.mesh !== mesh), pool.walkOf(far).plan, 'moved before the draw').length > 0, 'every other part with it, each at its own node');
    await settle();
  }
  assert.ok(between, 'a frame that held her, and a move before its draw');
  // reshaped while far (a fitting stood, a part hung): walked that frame, her range whatever
  const afterWalk = await watched(pool, log, [far], FAR_LIFE_EVERY, world);
  const at = afterWalk.findIndex((fr) => fr.reads.get(far) > 0);
  assert.ok(at >= 0 && at < FAR_LIFE_EVERY, 'walked on her stride');
  const probe = new PrefabNode('BoatFarProbe');
  const reshaped = await watched(pool, log, [far], 1, world, () => probe.setParent(far.MeshObject));
  assert.ok(reshaped[0].reads.get(far) > 0, 'reshaped: walked the next frame');
  assert.ok(pool.walkOf(far).nodes.includes(probe), 'the new node in her walk');
  // a boat with no frame's walk to hold - new, or re-dressed - is walked whatever her range
  const late = pool.spawnSeaNow(new Boat(HULL.Rowboat, 0)); late.GameObject.position = [-300, 0, 2000];
  const first = await watched(pool, log, [late], 1, world);
  assert.ok(first[0].reads.get(late) > 0, 'a new far boat: walked on her first frame');
  pool.remove(late);
});

test('BOAT-FAR: a boat of mine past NEAR_LIFE_M is walked again the frame after the origin moves her (a draw between) or her variant changes, whatever her stride (mutant: a draw\'s walk held)', async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const mine = pool.spawnNow(new Boat(HULL.LargeBoat, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  mine.GameObject.position = [0, 0, 1500];   // SetBoatPositionAndDirection's, a mile out
  for (let i = 0; i < 12; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  const until = async () => { for (let i = 0; i < FAR_LIFE_EVERY; i++) { const [fr] = await watched(pool, log, [mine], 1, world); if (fr.reads.get(mine) > 0) return; } assert.fail('never walked'); };
  await until();
  const [next] = await watched(pool, log, [mine], 1, world);
  assert.equal(next.reads.get(mine), 0, 'far: the frame after her walk holds her');
  await until();
  pool.offsetAll([10, 0, 0]);
  pool.draw();   // a draw before her next frame walks her for itself - a walk kept for nobody, never one to hold
  const [moved] = await watched(pool, log, [mine], 1, world);
  assert.ok(moved.reads.get(mine) > 0, 'the origin moved her: walked');
  assert.ok(Math.abs(pool.walkOf(mine).mats[0][12] - mine.GameObject.position[0]) < 1e-3, 'where she stands');
  await until();
  pool.setVariant(mine, 3);
  const [dressed] = await watched(pool, log, [mine], 1, world);
  assert.ok(dressed.reads.get(mine) > 0, 're-dressed: walked');
});

test('BOAT-FAR (its audit): a far boat switched off is drawn no more from the next frame, and switched on is drawn whole from the next, on every frame of her stride - her root (a peer\'s look \'hidden\', UpdateBoatVisibility) and a node of hers (her helm taken: IdleObject off, ActiveObject on); a switch that sets what a node already reads holds her as before (mutants: the switches unread; setActive unstamped; the node stamped, not its tree; every setActive a switch; one switch stamp)', async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const b = pool.spawnPeerNow(new Boat(HULL.Carrack, 0));
  b.GameObject.position = [0, 0, 1000];
  for (let i = 0; i < STILL_FRAMES * 2; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  /** One frame and its draw: what of hers it drew and the flats it stands (she is the pool's one boat). */
  const step = () => { log.drawn.length = 0; pool.frame(1 / 60, world); pool.draw(); return { drawn: log.drawn.length, flats: pool.batches().length }; };
  const whole = step();
  assert.ok(whole.drawn > 1 && whole.flats > 0, `she is drawn, her flats stand (${JSON.stringify(whole)})`);
  const helm = () => { const nodes = pool.walkOf(b).nodes; return { idle: nodes.includes(b.IdleObject), active: nodes.includes(b.ActiveObject) }; };
  assert.deepEqual(helm(), { idle: true, active: false }, 'her helm idle');
  for (let phase = 0; phase < FAR_LIFE_EVERY; phase++) {
    for (let k = 0; k <= phase; k++) step();   // each switch on another frame of her stride
    b.GameObject.setActive(false);
    assert.deepEqual(step(), { drawn: 0, flats: 0 }, `switched off (${phase}): nothing of hers the next frame`);
    for (let k = 0; k < phase; k++) step();
    b.GameObject.setActive(true);
    assert.deepEqual(step(), whole, `switched on (${phase}): whole the next frame`);
    for (let k = 0; k <= phase; k++) step();
    b.IdleObject.setActive(false); b.ActiveObject.setActive(true);
    step();
    assert.deepEqual(helm(), { idle: false, active: true }, `her helm taken (${phase}): her walk the next frame the manned one`);
    b.ActiveObject.setActive(false); b.IdleObject.setActive(true);
    step();
    assert.deepEqual(helm(), { idle: true, active: false }, `her helm let go (${phase}): idle again the next frame`);
  }
  // a switch that sets what it reads, every frame (her look asked again, her helm as it was): held as before
  const frames = await watched(pool, log, [b], FAR_LIFE_EVERY * 2, world, () => { b.GameObject.setActive(true); b.IdleObject.setActive(true); b.ActiveObject.setActive(false); });
  assert.equal(frames.filter((fr) => fr.reads.get(b) > 0).length, 2, `walked one frame in ${FAR_LIFE_EVERY}, as before`);
});

test('BOAT-FAR (its audit): a part hung on her root, outside her hull\'s frame (as the Rowboat\'s and the galley\'s Plane hang outside theirs), is never in her batch and is drawn where it stands; and her hull switched off, a held boat is carried by her root\'s move, not by a hull her walk did not reach - nothing else of hers drawn (mutants: a still chain kept past a reshape; a held boat shifted by a hull not walked)', async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const far = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0));
  far.GameObject.position = [0, 0, -1000];
  const sail = () => { const p = far.GameObject.position; far.GameObject.position = [p[0] + 0.5, p[1], p[2] + 0.25]; };   // under way, her hull steady in her frame
  for (let i = 0; i < STILL_FRAMES * 2; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  const part = pool.walkOf(far).plan.parts.find((e) => pool.stillOf(far)?.nodes.has(e.node) && !e.node.children.length)?.node;
  assert.ok(part, 'a part of her batch');
  part.setParentKeepWorld(far.GameObject);
  await watched(pool, log, [far], STILL_FRAMES + FAR_LIFE_EVERY * 2, world, sail);
  assert.equal(pool.stillOf(far)?.nodes.has(part) ?? false, false, 'hung outside her hull\'s frame: never in her batch, however long it stands still');
  /** The next frame that holds her, walked since `fn` - its draws, read as it drew them. */
  const heldAfter = async (fn) => {
    fn();
    let walked = false;
    for (let i = 0; i < FAR_LIFE_EVERY * 2; i++) {
      const [fr] = await watched(pool, log, [far], 1, world, sail);
      if (fr.reads.get(far) > 0) walked = true;
      else if (walked) return fr;
    }
    return assert.fail('never walked, then held');
  };
  const held = await heldAfter(() => {});
  const batch = pool.stillOf(far)?.mesh;
  assert.ok(eachAtItsPart(held.drawn.filter((d) => d.mesh !== batch), pool.walkOf(far).plan, 'held').some((e) => e.node === part), 'held: the part drawn on its own where it stands');
  const off = await heldAfter(() => far.MeshObject.setActive(false));
  assert.equal(off.drawn.length, 1, 'her hull off: the part alone drawn');
  assert.deepEqual(eachAtItsPart(off.drawn, pool.walkOf(far).plan, 'her hull off, held').map((e) => e.node), [part], 'where it stands now');
  far.MeshObject.setActive(true);
  assert.ok((await watched(pool, log, [far], 1, world, sail))[0].drawn.length > 1, 'her hull on: drawn the next frame');
});

const Q = [0, 0, 0, 1];
const word = (o = {}) => [o.hull ?? 2, 0, o.x ?? 0, 0, o.z ?? 0, ...Q, 0, o.helm ?? 0, 0];

test('BOAT-FAR: a peer\'s boat past NEAR_LIFE_M of the eye - the pool\'s last frame\'s, or the one the frame is handed - steps her Animators one frame in FAR_LIFE_EVERY on the time she missed; a near one every frame; none past the eye with no eye (mutants: the range unread, the missed time dropped, the pool\'s eye unread)', async () => {
  const pool = await freshPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me', log: { warn() {} } });
  peers.applyOwner('ann', { b: [word({ z: 30 })] }, (p) => p, 0);
  peers.applyOwner('bob', { b: [word({ z: 1500 })] }, (p) => p, 0);
  for (let i = 0; i < 8 && pool.peerBoats.length < 2; i++) peers.frame(1 / 60);
  const nb = peers.boatAt('ann', 0), fb = peers.boatAt('bob', 0);
  assert.ok(nb && fb, 'both built');
  assert.equal(pool.lifeEye(), null, 'no frame yet: no eye');
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.deepEqual(pool.lifeEye(), [0, 0, 0], 'the pool\'s eye: its frame\'s player');
  for (let i = 0; i < FAR_LIFE_EVERY; i++) peers.frame(1 / 60);   // the far one on her stride (her first far step banks the frames since she lived near)
  const spy = (b) => { const dts = []; for (const a of boatAnimators(b)) { const up = a.update.bind(a); a.update = (dt) => { dts.push(dt); up(dt); }; } return dts; };
  const nd = spy(nb), fd = spy(fb), per = (b) => boatAnimators(b).length;
  assert.ok(per(nb) > 0 && per(fb) > 0, 'they carry Animators');
  const N = FAR_LIFE_EVERY * 2;
  for (let i = 0; i < N; i++) peers.frame(1 / 60);
  assert.equal(nd.length, N * per(nb), 'near: every frame');
  assert.ok(nd.every((dt) => dt === 1 / 60), 'on its own time');
  assert.equal(fd.length, 2 * per(fb), `far: one frame in ${FAR_LIFE_EVERY}`);
  assert.ok(fd.every((dt) => Math.abs(dt - FAR_LIFE_EVERY / 60) < 1e-9), `on the time she missed (${fd.slice(0, 2)})`);
  fd.length = 0;
  for (let i = 0; i < N; i++) peers.frame(1 / 60, null);
  assert.equal(fd.length, N * per(fb), 'no eye: every boat near, every frame');
});

test('BOAT-FAR: THE LAW, ONE - farLifeStep lives a ship within NEAR_LIFE_M on the ground plane (or with no eye, or nowhere to stand) every frame on its own time, past it one frame in FAR_LIFE_EVERY on her own frame of the stride with the time she missed, kept across her coming near; navalHost\'s constants are its own (mutants: the distance through the sky, the missed time dropped, the stride\'s frame another)', () => {
  assert.equal(navalHost.NEAR_LIFE_M, NEAR_LIFE_M);
  assert.equal(navalHost.FAR_LIFE_EVERY, FAR_LIFE_EVERY);
  assert.deepEqual([NEAR_LIFE_M, FAR_LIFE_EVERY], [600, 4]);
  const eye = [0, 0, 0], dt = 0.02;
  const nearL = farLife(1);
  for (const pos of [[0, 0, 599], [0, 5000, 500], null]) assert.equal(farLifeStep(nearL, dt, pos, eye), dt, `near ${pos}: this frame's time`);
  assert.equal(farLifeStep(farLife(1), dt, [0, 0, 700], eye), null, 'just past it: held');
  assert.equal(farLifeStep(nearL, dt, [0, 0, 5000], null), dt, 'no eye: near');
  const a = farLife(0), b = farLife(1), far = [0, 0, 2000];
  const lived = (l) => Array.from({ length: 8 }, () => farLifeStep(l, dt, far, eye));
  const la = lived(a), lb = lived(b);
  assert.deepEqual(la.map((v) => v !== null), [false, false, false, true, false, false, false, true], 'her stride');
  assert.deepEqual(lb.map((v) => v !== null), [false, false, true, false, false, false, true, false], 'another\'s frame of it');
  assert.ok(Math.abs(la[3] - 4 * dt) < 1e-12 && Math.abs(lb[2] - 3 * dt) < 1e-12, 'the time she missed');
  const c = farLife(0);
  farLifeStep(c, dt, far, eye); farLifeStep(c, dt, far, eye);
  assert.ok(Math.abs(farLifeStep(c, dt, [0, 0, 10], eye) - 3 * dt) < 1e-12, 'come near: the time she missed with it');
  assert.equal(farLifeStep(c, dt, [0, 0, 10], eye), dt, 'and her own after');
});
