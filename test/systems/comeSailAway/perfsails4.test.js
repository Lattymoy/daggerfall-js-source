// PERF-SAILS4 (2026-10-14, the owner's client online in a port after PERF-SAILS3: a ship's animators 0.31 ms of the
// frame and her running rope's holders 0.45; bible/07-Rendering/Performance-Crowd.md PERF-SAILS4) - A CLIP'S CURVES
// BOUND ONCE AND A STILL CLIP POSED ONCE (world/unityAnimator.js), AND A ROPE'S BONES READ OFF THE FRAME'S WALK
// (scenes/comeSailAway/comeSailAwayPool.js worldOf) - every pose the animators write and every bake the ropes make what it was.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readyPool } from '../../navalSea.mjs';
import { Boat, boatAnimators } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { PrefabNode, resolveNodePointer } from '../../../src/world/prefabNode.js';
import { bakeSkinnedMesh } from '../../../src/world/skinnedBake.js';

const bits = (arr) => Buffer.from(Float64Array.from(arr).buffer).toString('base64');
const nodesOf = (b) => [...b.GameObject.walk()];

test('PERF-SAILS4: every pose the sea\'s animators write is the one they wrote before - ten ships of every hull and rig, 900 frames of their parameters turned (the rowing blend trees\' clips, the ones that move, among them), crossfades, plays at a time, a frame held, animators switched off and on (mutant: every clip taken as still)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const anims = [];
  for (let i = 0; i < 10; i++) anims.push(...boatAnimators(pool.spawnSeaNow(new Boat(i % 5, i % 3))));
  assert.equal(anims.length, 118, 'her rudders, sails, doors, hatches and gunports');
  const h = createHash('sha256');
  const states = (a) => [...a._internals.stateByName.keys()];
  let k = 0;
  for (let f = 0; f < 900; f++) {
    for (const a of anims) {
      k++;
      if (f % 97 === (k % 97)) for (const n of ['Opened', 'Sailing', 'Stowed']) a.SetBool(n, ((f + k) >> 2) % 2 === 0);   // the controllers' own parameters
      if (f % 13 === (k % 13)) ['TurnAngle', 'RowX', 'RowZ', 'RowSpeed', 'Wind'].forEach((n, j) => a.SetFloat(n, Math.sin(f * 0.13 + k + j * 1.7)));   // the blend trees turned - the rowing clips, which move
      if (f % 131 === (k % 131)) { const s = states(a); if (s.length) a.CrossFade(s[(f + k) % s.length], 0.3); }
      if (f % 211 === (k % 211)) { const s = states(a); if (s.length) a.Play(s[(f * 7 + k) % s.length], -1, ((f + k) % 10) / 10); }
      if (f === 450 && k % 5 === 0) a.component.m_Enabled = false;
      if (f === 470 && k % 5 === 0) a.component.m_Enabled = true;
      a.update(f % 11 === 0 ? 0 : 1 / 60 * (1 + (k % 3) * 0.1));
      for (const p of a.props) h.update(bits(p.attr === 'position' ? p.node.localPosition : p.attr === 'rotation' ? p.node.localRotation : p.node.localScale));
      h.update(`${a.stateName}|${a.nextStateName}|`);
    }
  }
  // and every rudder rowing a second, its blend tree leaned - the clips that move, sampled frame after frame
  const rudders = anims.filter((a) => /Rudder/.test(a.controllerName));
  rudders.forEach((a, j) => { a.component.m_Enabled = true; a.SetBool('Sailing', false); a.CrossFade('Rowing', 0); a.SetFloat('RowX', 0.3 - j * 0.07); a.SetFloat('RowZ', 0.8); });
  for (let f = 0; f < 60; f++) for (const a of rudders) { a.update(1 / 60); for (const p of a.props) h.update(bits(p.node.localRotation)); h.update(`${a.stateName}|`); }
  assert.ok(rudders.filter((a) => a.stateName === 'Rowing').length >= 8, 'rowing');
  pool.destroyAll();
  // the same run on the animator before PERF-SAILS4 (origin/main d8ccf7fd6)
  assert.equal(h.digest('hex'), 'ccc3a6ec4eff35a2cb9a5cb045fda1476d0d9b3e258d5cd06ed0a5e19905c4e1');
});

test('PERF-SAILS4: a still clip is posed once - a standing animator hands out the one pose frame after frame, and an animated one a new pose each frame (mutant: a still clip posed every frame)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const anims = boatAnimators(pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)));
  for (let f = 0; f < 5; f++) for (const a of anims) a.update(1 / 60);
  const still = anims.filter((a) => a.lastPose && a.current?.state.motion?.length && !a.transition);   // a state with a clip, standing (one with no motion poses its defaults afresh, as before)
  assert.ok(still.length > 3, 'her animators, standing');
  const before = new Map(still.map((a) => [a, a.lastPose]));
  for (const a of still) a.update(1 / 60);
  assert.ok(still.every((a) => a.lastPose === before.get(a)), 'the same pose handed out');
  pool.destroyAll();
});

test('PERF-SAILS4: a rope\'s bones and its renderer read the frame\'s walk - its kept matrices, the same bits as the nodes\' own - and a boat hung under a turned node reads the nodes\' own, so every bake is the one its worldMatrix makes (mutants: the walk read for a hung root; the walk never read)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const fixOf = (n) => n.children.map((c) => c.getComponent('FixDeformations')).find(Boolean) ?? null;
  const ropesOf = (boat) => nodesOf(boat).filter((n) => /Line$/.test(n.name) && n.getComponent('SkinnedMeshRenderer')).map((n) => ({ n, smr: n.getComponent('SkinnedMeshRenderer'), fix: fixOf(n) }));
  /** The bake its holder makes, made here from the nodes' own matrices and pose - the holder's arithmetic before. */
  const reference = (r) => {
    const g = pool.models.geometry(r.smr.m_Mesh.mesh);
    const bones = r.smr.m_Bones.map((b) => resolveNodePointer(r.n, b)).map((b) => (b ? b.worldMatrix() : null));
    return bakeSkinnedMesh(g, bones, g.bindPoses, { position: r.n.position, rotation: r.n.rotation });
  };
  // a boat at the root of her tree: the walk's matrices read, and the same bits
  const free = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [3, 0, 7], rotation: [0, Math.sin(0.4), 0, Math.cos(0.4)] });
  for (let i = 0; i < 3; i++) pool.frame(1 / 60);
  const fr = ropesOf(free);
  assert.equal(fr.length, 11, 'her running rope');
  const w = pool.walkOf(free);
  for (const r of fr) {
    const k = r.fix.bakedMesh;
    assert.ok(k?.boneWorld?.length, 'baked');
    k.boneWorld.forEach((m, b) => { if (m) assert.ok(w.mats.includes(m), `${r.n.name} bone ${b}: the walk's own matrix`); });
    assert.deepEqual([...k.positions], [...reference(r)], `${r.n.name}: the bake its nodes make`);
  }
  // a boat hung under a turned and moved node: her nodes' own matrices carry it, the walk's do not
  const holder = new PrefabNode('PERF-SAILS4 holder', { position: [40, 2, -9], rotation: [0.1, Math.sin(0.7), 0.05, Math.cos(0.7)] });
  const hung = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  hung.GameObject.setParent(holder);
  for (let i = 0; i < 3; i++) pool.frame(1 / 60);
  for (const r of ropesOf(hung)) assert.deepEqual([...r.fix.bakedMesh.positions], [...reference(r)], `${r.n.name}, hung: the bake its nodes make`);
  pool.destroyAll();
});
