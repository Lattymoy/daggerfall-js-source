// MW-BOW1 (FIELD BUGS 2026-10-09f, the owner: "the arrow on the morrowind weapon isnt shown be drawn and shot, or it's
// misalligned"; then "Im tired of you avoiding the morrowind arrow case"): A MORROWIND BOW DRAWS ON ITS OWN CLOCK. The
// retail bow mesh carries its limbs and string morphing and its ArrowBone keyframed through the BowAndArrow group
// (OpenMW issues 5642 and 9322), on WeaponAnimationTime: the weapon group's playhead, from the group's first key for a
// ranged weapon. The port flattened the bow once at rest and baked the ArrowBone's rest into the arrow - so the bow
// never drew and the arrow sat wherever the mesh's rest left the node. Pinned on bowClip.mjs, a fixture bow that
// carries both controllers, through the pure clock and through a real arm's shot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { nodeTransformOf } from '../src/formats/mwCharacter.js';
import { partClockOf, nodeAffineAt, posePartBatch, batchMoves } from '../src/formats/mwPartClock.js';
import { posePartClocks, MW_WEAPON_TYPE, ARROW_FALLBACK_NODE } from '../src/formats/mwFirstPerson.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY } from '../src/combat/fpArm.js';
import { bowClip, ARROW_REST, ARROW_DRAWN, LIMB_BEND, T } from './fixtures/mw/bowClip.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const round = (v) => [...v].map((x) => +x.toFixed(4) + 0);
const BOW_MID = [1, 0, 0];   // bowmesh.nif: BowRoot > BowMid (1, 0, 0) > ArrowBone - the arrow's node sits under BowMid
const at = (p) => [p[0] + BOW_MID[0], p[1] + BOW_MID[1], p[2] + BOW_MID[2]];

test('MW-BOW1: the part clock reads a bow\'s own motion - the ArrowBone\'s keys and the limb\'s morph, on the group\'s time', () => {
  const nif = parseNif(bowClip());
  const pc = partClockOf(nif);
  assert.equal(pc.animated, true);
  assert.deepEqual([...pc.tracks.keys()].map((r) => r.name), ['ArrowBone'], 'one keyframed node');
  assert.deepEqual([...pc.morphs.keys()].map((r) => r.name), ['Limb'], 'one morphing shape');
  // the node, through its chain, at the clock's times: at rest through the attach, drawn by max attack, held to the
  // release, back by the follow - and the controller's window clamps either side (Constant extrapolation)
  const arrowAt = (t) => round(nodeAffineAt(nif, ARROW_FALLBACK_NODE, t).t);
  assert.deepEqual(arrowAt(0), at(ARROW_REST), 'before the window: the first key');
  assert.deepEqual(arrowAt(T.attach), at(ARROW_REST));
  assert.deepEqual(arrowAt((T.attach + T.maxAttack) / 2), at([0, 6, -2.5]), 'half drawn, half way');
  assert.deepEqual(arrowAt(T.maxAttack), at(ARROW_DRAWN), 'drawn to the string');
  assert.deepEqual(arrowAt(T.release), at(ARROW_DRAWN), 'held to the release');
  assert.deepEqual(arrowAt(T.followStart), at(ARROW_REST), 'and back');
  assert.deepEqual(arrowAt(5), at(ARROW_REST), 'past the window: the last key');
  // its rotation is the rest's (no rotation keys - [B]), the node's own quarter turn under BowMid
  assert.deepEqual(round(nodeAffineAt(nif, ARROW_FALLBACK_NODE, T.maxAttack).a), round(nodeTransformOf(nif, ARROW_FALLBACK_NODE).a));
  // the limb: base + weight x the bend, the base never weighted
  const limb = flattenNif(nif).find((b) => b.name === 'Limb');
  const base = [...limb.positions];
  const pose = (t) => { const out = new Float32Array(base.length); assert.equal(posePartBatch(nif, limb, t, out), true); return round(out); };
  assert.deepEqual(pose(T.attach), round(base), 'unbent before the draw');
  assert.deepEqual(pose(T.maxAttack), round(base.map((v, i) => v + LIMB_BEND[i])), 'bent at full draw');
  assert.deepEqual(pose((T.attach + T.maxAttack) / 2), round(base.map((v, i) => v + LIMB_BEND[i] / 2)), 'half bent half way');
  assert.deepEqual(pose(T.followStart), round(base), 'straight again');
});

test('MW-BOW1: the controller\'s own function, an AutoPlay node\'s frame clock, and the morph\'s three refusals', () => {
  const fresh = () => parseNif(bowClip());
  const ctrlOf = (nif, type) => nif.records.find((r) => r.type === type);
  // ControllerFunction: time = frequency * value + phase - a phase of -0.3 reads max attack at a value of 1.0
  const phased = fresh();
  ctrlOf(phased, 'NiKeyframeController').phase = -0.3;
  assert.deepEqual(round(nodeAffineAt(phased, ARROW_FALLBACK_NODE, T.followStart).t), at(ARROW_DRAWN), 'the phase moves the clock');
  // an AutoPlay animation node above: its controllers run on FRAME time, not the weapon's (nifloader setupController)
  const auto = fresh();
  const root = auto.records[auto.roots[0]];
  root.type = 'NiBSAnimationNode'; root.flags = (root.flags | 0) | 0x20;
  assert.deepEqual(round(nodeAffineAt(auto, ARROW_FALLBACK_NODE, 0, T.maxAttack).t), at(ARROW_DRAWN), 'the node on frame time');
  const autoLimb = flattenNif(auto).find((b) => b.name === 'Limb');
  assert.equal(autoLimb.animFlags & 0x20, 0x20, 'the walk carries the flag down');
  const out = new Float32Array(12);
  posePartBatch(auto, autoLimb, 0, out, null, T.maxAttack);
  assert.deepEqual(round(out), round(base(auto).map((v, i) => v + LIMB_BEND[i])), 'and the shape too');
  // the WHOLE chain from the file root: a turned, scaled, moved root - posed where nothing bends, the shape lands
  // exactly where flattenNif's rest bake has it
  const moved = fresh();
  const top = moved.records[moved.roots[0]];
  top.translation = [3, -1, 2]; top.rotation = [0, -1, 0, 1, 0, 0, 0, 0, 1]; top.scale = 2;
  const movedLimb = flattenNif(moved).find((b) => b.name === 'Limb');
  const rest = new Float32Array(12);
  posePartBatch(moved, movedLimb, T.attach, rest);
  assert.deepEqual(round(rest), round(movedLimb.positions), 'the clock\'s composition is the bake\'s');
  // handleMorphGeometry: a base of another vertex count, a skinned shape, a base alone - no morph
  const short = fresh();
  ctrlOf(short, 'NiMorphData').morphs[0].vectors = new Float32Array(9);
  assert.equal(partClockOf(short).morphs.size, 0, 'a base that is not this shape\'s');
  const skinned = fresh();
  skinned.records.find((r) => r.name === 'Limb').skin = 0;
  assert.equal(partClockOf(skinned).morphs.size, 0, 'a skinned shape');
  const alone = fresh();
  ctrlOf(alone, 'NiMorphData').morphs.length = 1;
  assert.equal(partClockOf(alone).morphs.size, 0, 'a base alone');
});

test('MW-BOW1: a bow that does not move keeps its rest - nothing posed, nothing copied', () => {
  const nif = parseNif(f('bowmesh.nif'));
  assert.equal(partClockOf(nif).animated, false);
  assert.equal(nodeAffineAt(nif, ARROW_FALLBACK_NODE, T.maxAttack), null, 'the rest nodeTransformOf baked stands');
  const limb = flattenNif(nif)[0];
  assert.equal(batchMoves(nif, limb), false);
  assert.equal(posePartBatch(nif, limb, T.maxAttack, new Float32Array(12)), false);
  // the per-frame door over an assembly of such pieces moves none and leaves each source as it was
  const source = Float32Array.from(limb.positions);
  const piece = { kind: 'rigid', slot: 'weapon', source, clip: { nif, batch: limb } };
  assert.equal(posePartClocks({ pieces: [piece] }, T.maxAttack), 0);
  assert.equal(piece.source, source, 'the same buffer');
  // and only the weapon clock's slots are posed: a moving file in another slot is not this clock's
  const moving = parseNif(bowClip());
  const other = { kind: 'rigid', slot: 'shield', source: Float32Array.from(base(moving)), clip: { nif: moving, batch: flattenNif(moving)[0] } };
  assert.equal(posePartClocks({ pieces: [other] }, T.maxAttack), 0, 'a shield is the lower body\'s clock in the reference, not this one');
});
const base = (nif) => flattenNif(nif)[0].positions;

// --- through a real arm ------------------------------------------------------------------------------------------

const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};
function bowDeps(bowBytes) {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', new Uint8Array(bowBytes)],
    ['meshes/w/arrow.nif', f('arrow.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = Uint8Array.from([
    ...wpdt('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
    ...wpdt('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
  ]);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
}
async function drawnBow(bowBytes) {
  const arm = createFpArm();
  arm.attach({
    gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  const res = await arm.build({ race: 'fprace', weapon: { templateIndex: 130 }, hasAmmo: true, deps: bowDeps(bowBytes) });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  return { arm, res };
}
const pieceOf = (res, slot) => res.arm.pieces.find((p) => p.slot === slot);
/** Where the arrow's vertices sit with the ArrowBone at `p` (its rest rotation, the node's chain under BowMid). */
function arrowWith(nif, translation) {
  const pre = nodeTransformOf(nif, ARROW_FALLBACK_NODE);
  const local = flattenNif(parseNif(f('arrow.nif')))[0].positions;
  const t = at(translation);
  const out = [];
  for (let v = 0; v < local.length; v += 3) {
    const x = local[v]; const y = local[v + 1]; const z = local[v + 2];
    out.push(pre.a[0] * x + pre.a[1] * y + pre.a[2] * z + t[0], pre.a[3] * x + pre.a[4] * y + pre.a[5] * z + t[1], pre.a[6] * x + pre.a[7] * y + pre.a[8] * z + t[2]);
  }
  return round(out);
}

test('MW-BOW1: through a real shot the bow draws - the arrow rides the ArrowBone to the string and back, the limb bends', async () => {
  const bytes = bowClip();
  const nif = parseNif(bytes);
  const { arm, res } = await drawnBow(bytes);
  // THE CLOCK: the BowAndArrow group's playhead from its first key (5.5) - the equip left it at its stop (5.7)
  assert.equal(+arm.status().weaponClock.toFixed(4), 0.2, 'held where the equip left it');
  const arrow = pieceOf(res, 'arrow');
  const limb = pieceOf(res, 'weapon');
  assert.ok(arrow && limb);
  const restLimb = round(base(nif));
  assert.deepEqual(round(arrow.source), arrowWith(nif, ARROW_REST), 'at rest the arrow sits where the rest pose has it');
  assert.equal(arm.attack('StrikeDown'), 'shoot');
  // shoot start 5.8 -> max attack 6.2: step into the release section (6.2 -> 6.4), the draw's full extent
  for (let i = 0; i < 40 && arm.status().upper !== UPPER_BODY.AttackRelease; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.AttackRelease);
  const clock = arm.status().weaponClock;
  assert.ok(clock >= T.maxAttack - 1e-6 && clock <= T.release + 1e-6, `the clock in the draw (${clock})`);
  assert.equal(arm.status().arrowShown, true, 'the arrow on the string');
  assert.deepEqual(round(arrow.source), arrowWith(nif, ARROW_DRAWN), 'DRAWN BACK - the ArrowBone\'s keys, not its rest');
  assert.deepEqual(round(limb.source), round(base(nif).map((v, i) => v + LIMB_BEND[i])), 'and the limb bent with it');
  // through the follow: back to rest, the clock held where the follow left it
  for (let i = 0; i < 60 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(+arm.status().weaponClock.toFixed(4), 1.2, 'held at the follow\'s stop (6.7)');
  assert.deepEqual(round(arrow.source), arrowWith(nif, ARROW_REST), 'the next arrow back at rest');
  assert.deepEqual(round(limb.source), restLimb, 'the limb straight');
  // and the clock belongs to its group: sheathed, the stance's group is no longer the bow's and the clock reads 0
  arm.setSheathed(true);
  for (let i = 0; i < 60 && arm.status().upper !== UPPER_BODY.None; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.None);
  assert.equal(arm.status().weaponClock, 0, 'no state for the group in hand');
});

test('MW-BOW1: a bow with no motion of its own is posed as it always was', async () => {
  const bytes = f('bowmesh.nif');
  const nif = parseNif(bytes);
  const { arm, res } = await drawnBow(bytes);
  const arrow = pieceOf(res, 'arrow');
  const before = arrow.source;
  assert.equal(arm.attack('StrikeDown'), 'shoot');
  for (let i = 0; i < 40 && arm.status().upper !== UPPER_BODY.AttackRelease; i++) arm.update(0.05);
  assert.equal(arrow.source, before, 'the same rest buffer, never re-posed');
  assert.deepEqual(round(arrow.source), arrowWith(nif, ARROW_REST));
});

test('MW-BOW1: both views pose the weapon on its clock before the pose - the first-person arm and the third-person body', () => {
  // the third-person body is one machine with the arm (fpArm update): the same clock, ahead of its own poseAssembly
  const src = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');
  const third = /posePartClocks\(t\.arm, weaponClockValue\(\), \{ frameTime: partClock \}\);[^\n]*\n\s*poseAssembly\(t\.arm, \{/;
  const first = /posePartClocks\(built\.arm, weaponClockValue\(\), \{ frameTime: partClock \}\);[^\n]*\n\s*poseAssembly\(built\.arm, \{\n\s*tracks: fTracks,/;
  assert.match(src, third, 'the body');
  assert.match(src, first, 'the arm');
});
