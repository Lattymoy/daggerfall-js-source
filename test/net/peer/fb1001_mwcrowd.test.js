// MW-CROWD (FIELD BUGS 2026-10-01 #8 - "Culling performance issues when using the morrowind model and around a large
// group of players"). WB9h capped the crowd's skins at SKIN_BUDGET a frame and culled them by the view; what was left:
//   - THE TURN. The skins are decided on the LAST body pass's view with a 2 m margin, so a body the view swung onto past
//     it arrived stale and was posed in the draw, outside the budget - a crowd turned onto posed whole in one frame.
//     The margin leads the turn now (turnLeadMargin): the bodies about to come into view are skinned on the budget.
//   - DEAD WORK AT EVERY POSE. updateCharacterMesh walked every corner of a body's skin twice for a sphere only the
//     shadow recorder reads - and a body drawn through the sprite target never casts. The third-person mesh has none.
//   - GARBAGE EVERY FRAME. peerWeaponOf built a whole stand-in (an entity, a 27-slot equip table, its items) for every
//     stepped body every frame. One a look.
//   - REBUILDS. A weapon drawn tore down a built body after BODY_REBUILD_MS and queued a whole build, though setWeapon
//     had already put it in the hand; and a lingering body's rig was unloaded, so a peer who mounted or dropped out of
//     the list a moment came back to a whole build. A person's body key is its look less its weapons, and a lingering
//     body is kept as a spare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PeerBodies, peerBodyKey, peerWeaponOf, turnLeadMargin, CULL_MARGIN_M, TURN_LEAD_FRAMES, TURN_LEAD_MAX, BODY_REBUILD_MS, SPARE_MAX, BODIES_MAX,
  SWAP_DWELL_MS, SWAP_EVERY_MS,
} from '../../../src/net/peer/peerBodies.js';
import { lookKey } from '../../../src/net/remotePlayers.js';
import { Renderer } from '../../../src/render/renderer.js';
import { perspective, lookAt, mirrorProjectionX } from '../../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };
const toScene = (p) => [p.x, p.y, p.z];
const peer = (id, x, z, items = [], race = 'Nord') => ({ id, name: id, told: true, look: { race, gender: 'male', faceIndex: 0, items },
  shown: { x, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 1, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 } });
const deg = (d) => (d * Math.PI) / 180;
/** the game's own lens (mirrored in x), the eye at head height looking `yaw` from -z */
const lens = (yaw) => { const eye = [0, 1.6, 0]; return { proj: mirrorProjectionX(perspective(deg(70), 16 / 9, 0.1, 2000)), view: lookAt(eye, [-10 * Math.sin(yaw), 1.6, -10 * Math.cos(yaw)], [0, 1, 0]), eye }; };
function rigs() {
  const made = [];
  const factory = () => {
    const r = { mode: 'first', steps: [], weapons: [], skinned: false, unloaded: false, builds: 0,
      attach() {}, async build() { r.builds++; await flush(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.skinned,
      update(dt, o) { r.steps.push(o?.pose !== false); if (o?.pose !== false) r.skinned = true; },
      setSheathed() {}, upperBodyReady: () => true, setWeapon(w) { r.weapons.push(w); return true; },
      drawThird() { return r.thirdActive(); }, unload() { r.unloaded = true; r.skinned = false; },
    };
    made.push(r);
    return r;
  };
  return { made, factory };
}
async function stand(pb, peers, sync) {
  for (let i = 0; i < 30 && !peers.every((p) => pb.has(p.id)); i++) { sync(); await settle(); }
  for (const p of peers) assert.equal(pb.has(p.id), true, `${p.id} stands`);
}

test('MW-CROWD: the skins\' margin leads a turning eye - a body the turn is swinging toward is skinned on the budget before it is seen; a still eye keeps WB9h\'s margin (mutants: the turn unmeasured; the lead dropped)', async () => {
  assert.equal(turnLeadMargin(10, 0), CULL_MARGIN_M, 'still: WB9h\'s margin');
  assert.ok(Math.abs(turnLeadMargin(10, deg(10)) - (CULL_MARGIN_M + 10 * Math.tan(deg(10) * TURN_LEAD_FRAMES))) < 1e-12, 'TURN_LEAD_FRAMES frames of the turn, at the distance');
  assert.ok(turnLeadMargin(20, deg(10)) > turnLeadMargin(10, deg(10)), 'farther, more');
  assert.equal(turnLeadMargin(10, 3), CULL_MARGIN_M + 10 * Math.tan(TURN_LEAD_MAX), 'never past TURN_LEAD_MAX');
  // a body 10 m off, 86 degrees round from the view's heading once the view has turned 10 degrees away from it - outside
  // the 70-degree lens's side by 35 degrees, and its 2 m margin with it
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => 1000 });
  const p = peer('side', 10 * Math.sin(deg(76)), -10 * Math.cos(deg(76)));
  const sync = () => pb.sync([p], toScene, 1 / 60, [0, 0, 0]);
  await stand(pb, [p], sync);
  const still = lens(deg(10));
  pb.draw({}, still); pb.draw({}, still);
  sync();
  assert.equal(pb._bodies.get('side').inView, false, 'a still eye: out of the view, skinned nothing (WB9h)');
  pb.draw({}, lens(0)); pb.draw({}, lens(deg(10)));
  assert.ok(Math.abs(pb._turn - deg(10)) < 1e-6, `the turn measured off the two passes' forwards (${pb._turn})`);
  sync();
  assert.equal(pb._bodies.get('side').inView, true, 'turning at ten degrees a frame: led into the skins');
});

test('MW-CROWD: the third-person mesh walks no sphere at its poses - only the shadow recorder reads one, and the sprite target never casts; a mesh that may cast keeps it (mutants: the opt ignored; the third mesh given one)', () => {
  const calls = [];
  const gl = { ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, createVertexArray: () => ({}), createBuffer: () => ({}), bindBuffer() {}, bufferData() {},
    enableVertexAttribArray() {}, vertexAttribPointer() {}, bufferSubData: () => calls.push('sub') };
  const r = { gl, _bindVao() {} };
  const packed = new Float32Array(14 * 6).map((_, i) => (i % 14 < 3 ? i * 0.01 : 0));
  const sprite = Renderer.prototype.createCharacterMesh.call(r, packed, { uv: true, bounds: false });
  assert.equal(sprite.bounds, null, 'no sphere');
  Renderer.prototype.updateCharacterMesh.call(r, sprite, packed);
  assert.deepEqual(calls, ['sub'], 'the pose uploads, and walks nothing');
  assert.equal(sprite.bounds, null);
  const casts = Renderer.prototype.createCharacterMesh.call(r, packed, { uv: true });
  assert.ok(casts.bounds && casts.bounds.length === 4, 'a mesh that may cast keeps its sphere (EL7)');
  const before = Array.from(casts.bounds);
  const moved = packed.map((v, i) => (i % 14 === 0 ? v + 5 : v));
  Renderer.prototype.updateCharacterMesh.call(r, casts, moved);
  assert.notDeepEqual(Array.from(casts.bounds), before, '...and follows its pose');
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /thirdMesh = renderer\.createCharacterMesh\(thirdPacked\.packed, \{ uv: true, bounds: false \}\);/, 'the third-person body: the sprite target\'s alone');
  assert.match(fp, /mesh = renderer\.createCharacterMesh\(packed\.packed, \{ uv: true \}\);/, 'the first-person arm keeps its sphere');
  assert.match(rd('src/render/renderer.js'), /if \(this\._casting && this\._spriteDepth === 0 && this\._studioDepth === 0\) this\._shadows\.recordCharacter\(mesh, modelMatrix\);/, 'the recorder reads it only off the sprite target');
});

test('MW-CROWD: a look\'s stand-in once - the weapon the arm asks for every frame is one object a look; and a person\'s body is its look less its weapons (mutants: the memo; weapons back in the key)', () => {
  const sword = { templateIndex: 120, group: 'Weapons', equipSlot: 19 }, axe = { templateIndex: 125, group: 'Weapons', equipSlot: 19 };
  const coat = { templateIndex: 102, group: 'Armor', material: 0, equipSlot: 2 };
  const a = peer('a', 0, -5, [coat, sword]).look, b = { ...a, items: [coat, axe] }, c = { ...a, items: [{ ...coat, material: 3 }, sword] };
  const w = peerWeaponOf(a, { lh: 0 });
  assert.equal(w?.templateIndex, 120);
  assert.equal(peerWeaponOf(a, { lh: 0 }), w, 'the same object, every frame - no stand-in rebuilt');
  assert.equal(peerWeaponOf(b, { lh: 0 })?.templateIndex, 125, 'a new look its own');
  assert.equal(peerBodyKey(a), peerBodyKey(b), 'a sword for an axe: the same body');
  assert.notEqual(peerBodyKey(a), peerBodyKey(c), 'another coat: another body');
  assert.equal(peerBodyKey(a), lookKey({ ...a, items: [coat] }), 'the look\'s own key, less its weapons');
  assert.equal(peerBodyKey(a, { wb: 1 }).startsWith('wolf|'), true, 'the wolf\'s key as it was');
  assert.equal(peerBodyKey(null), lookKey(null));
});

test('MW-CROWD: a weapon drawn is no new body - the arm takes it, nothing is built; a body whose peer left a moment is kept, and stands again at once on its return (mutants: the key; the lingering body unloaded)', async () => {
  let now = 1000;
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => now });
  const sword = { templateIndex: 120, group: 'Weapons', equipSlot: 19 }, axe = { templateIndex: 125, group: 'Weapons', equipSlot: 19 };
  const p = peer('p', 0, -6, [sword]);
  const sync = (list = [p]) => pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  await stand(pb, [p], () => sync());
  const rig = pb._bodies.get('p').rig;
  now += BODY_REBUILD_MS + 1;
  p.look = { ...p.look, items: [axe] };
  sync(); await settle(); sync();
  assert.equal(pb._bodies.get('p').rig, rig, 'the body stands');
  assert.equal(rig.unloaded, false); assert.equal(R.made.length, 1, 'nothing built');
  assert.equal(rig.weapons.at(-1)?.templateIndex, 125, 'the axe in the hand, through the arm\'s own door');
  // the pool full round p; then p leaves the list (mounts, say): its body lingers, and a stranger takes the slot at once
  const crowd = Array.from({ length: BODIES_MAX - 1 }, (_, i) => peer(`s${i}`, 1 + i, -8 - i, [], `look${i}`));   // each their own body, so no spare is anyone else's
  await stand(pb, crowd, () => sync([p, ...crowd]));
  sync(crowd);
  assert.notEqual(pb._bodies.get('p')?.goneAt ?? null, null, 'p lingers');
  const late = peer('late', 0, -3, [], 'Breton');
  sync([...crowd, late]);
  assert.equal(pb._bodies.has('late'), true, 'the slot given at once');
  assert.equal(rig.unloaded, false, 'and p\'s body kept, not thrown away');
  assert.ok(pb._spares.some((x) => x.rig === rig) && pb._spares.length <= SPARE_MAX);
  // p dismounts: once it has wanted a slot as long as any stranger must, it takes the farthest's - and its own body back
  const builds = R.made.length;
  const back = [...crowd, late, p];
  sync(back); now += SWAP_DWELL_MS + SWAP_EVERY_MS; sync(back);
  assert.equal(pb._bodies.get('p')?.rig, rig, 'its own body again');
  assert.equal(pb._bodies.get('p').state, 'ok', 'standing at once');
  assert.equal(R.made.length, builds, 'nothing built for it');
});
