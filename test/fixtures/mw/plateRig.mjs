// MW-STEEL1 (2026-10-06): A T-POSED BODY TO WEAR THE STEEL PLATE ON. Mac's scene stands a Morrowind Breton in a T-pose,
// and the plate was fitted on it; the pins stand this fixture in for a player's archives. Bip01 bones carry the part
// nodes, as base_anim's do; every body part is a RIGID tube at its part node, authored once on the RIGHT and bound at
// both sides (the left mirrored in X, rule 13) as some mods' limb records are. It is laid to the scene's proportions
// MOVED BY `delta`, with the neck and the head built to the scene's measured bounds exactly (ownArmorModels.js
// STEEL_PLATE_SCENE) - so on this body every piece of the plate must land moved by `delta` and by nothing else.
//
// MW-STEEL2 (2026-10-07): THE REST IS NOT THE BIND. MW-STEEL1 built this rig's rest as a T-pose because it took
// base_anim to rest in one; retail's does not - its node transforms are the idle's first frame, the arms hanging, and
// the T-pose is only its skins' bind (formats/mwSkinTransfer.js bindPoseMats). A rigid T-posed rest cannot tell the two
// apart, which is how "The new steel armor T-poses ingame" passed every pin. So the rig can now hang its arms at rest
// (ARMS_DOWN, the `rotations` it always took), carry the skeleton file's own shadow skin (`shadow`), and stand a
// SKINNED body bound in the T-pose (skinnedPlateBody) - retail's shape: the rest one pose, the bind another.
import { writeNif, meshToNif, boundingSphere } from '../../../tools/nifWrite.mjs';
import { STEEL_PLATE_SCENE } from '../../../src/characters/ownArmorModels.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Each bone's rest position, in the scene's numbers moved by `delta`. */
export function bonesAt(delta) {
  const D = (p) => add(p, delta);
  return {
    'Bip01': [0, 0, 0],
    'Bip01 Pelvis': D([0, 0, 72]), 'Bip01 Spine': D([0, 0, 80]), 'Bip01 Spine1': D([0, 0, 92]), 'Bip01 Spine2': D([0, 0, 104]),
    'Bip01 Neck': D([0, -0.2, 110]), 'Bip01 Head': D([0, 0, 118]),
    'Bip01 R Clavicle': D([2, 0, 108]), 'Bip01 R UpperArm': D([12, 0, 111]), 'Bip01 R Forearm': D([31, 0, 111]), 'Bip01 R Hand': D([48, 0, 111]),
    'Bip01 L Clavicle': D([-2, 0, 108]), 'Bip01 L UpperArm': D([-12, 0, 111]), 'Bip01 L Forearm': D([-31, 0, 111]), 'Bip01 L Hand': D([-48, 0, 111]),
    'Bip01 R Thigh': D([6, 0, 70]), 'Bip01 R Calf': D([6, 0, 40]), 'Bip01 R Foot': D([6, 0, 6]),
    'Bip01 L Thigh': D([-6, 0, 70]), 'Bip01 L Calf': D([-6, 0, 40]), 'Bip01 L Foot': D([-6, 0, 6]),
  };
}
const PARENT = {
  'Bip01 Pelvis': 'Bip01', 'Bip01 Spine': 'Bip01 Pelvis', 'Bip01 Spine1': 'Bip01 Spine', 'Bip01 Spine2': 'Bip01 Spine1',
  'Bip01 Neck': 'Bip01 Spine2', 'Bip01 Head': 'Bip01 Neck',
  'Bip01 R Clavicle': 'Bip01 Spine2', 'Bip01 R UpperArm': 'Bip01 R Clavicle', 'Bip01 R Forearm': 'Bip01 R UpperArm', 'Bip01 R Hand': 'Bip01 R Forearm',
  'Bip01 L Clavicle': 'Bip01 Spine2', 'Bip01 L UpperArm': 'Bip01 L Clavicle', 'Bip01 L Forearm': 'Bip01 L UpperArm', 'Bip01 L Hand': 'Bip01 L Forearm',
  'Bip01 R Thigh': 'Bip01 Pelvis', 'Bip01 R Calf': 'Bip01 R Thigh', 'Bip01 R Foot': 'Bip01 R Calf',
  'Bip01 L Thigh': 'Bip01 Pelvis', 'Bip01 L Calf': 'Bip01 L Thigh', 'Bip01 L Foot': 'Bip01 L Calf',
};
/** Each part node, and the Bip01 bone it hangs off at zero offset. */
export const PART_NODE = {
  'Chest': 'Bip01 Spine2', 'Groin': 'Bip01 Pelvis', 'Neck': 'Bip01 Neck', 'Head': 'Bip01 Head',
  'Right Clavicle': 'Bip01 R Clavicle', 'Right Upper Arm': 'Bip01 R UpperArm', 'Right Forearm': 'Bip01 R Forearm', 'Right Wrist': 'Bip01 R Hand', 'Right Hand': 'Bip01 R Hand',
  'Left Clavicle': 'Bip01 L Clavicle', 'Left Upper Arm': 'Bip01 L UpperArm', 'Left Forearm': 'Bip01 L Forearm', 'Left Wrist': 'Bip01 L Hand', 'Left Hand': 'Bip01 L Hand',
  'Right Upper Leg': 'Bip01 R Thigh', 'Right Knee': 'Bip01 R Calf', 'Right Ankle': 'Bip01 R Calf', 'Right Foot': 'Bip01 R Foot',
  'Left Upper Leg': 'Bip01 L Thigh', 'Left Knee': 'Bip01 L Calf', 'Left Ankle': 'Bip01 L Calf', 'Left Foot': 'Bip01 L Foot',
};

/** The skeleton, T-posed at rest; `rotations` (node name -> row-major 3x3) turns bones for a different rest, and
 *  `extra` names nodes hung under the root FIRST - so every other node's record, and its ref, moves, as a first-person
 *  rig's nodes stand at other refs than the third person's. MW-STEEL2: `shadow` hangs retail's "Tri Shadow" under the
 *  root - a skin over every Bip01 bone, bound in the T-pose whatever the rest, never drawn (rule 59). */
export function plateSkeleton(delta, { rotations = {}, extra = [], shadow = false } = {}) {
  const B = bonesAt(delta);
  const all = ['Bip01', ...extra, ...Object.keys(B).filter((n) => n !== 'Bip01'), ...Object.keys(PART_NODE)];
  const idx = new Map(all.map((n, i) => [n, i]));
  const records = all.map((n) => {
    const parent = PARENT[n] ?? PART_NODE[n] ?? (extra.includes(n) ? 'Bip01' : null);
    const at = B[n] ?? B[PART_NODE[n]] ?? B.Bip01;
    return {
      type: 'NiNode', name: n,
      translation: PART_NODE[n] ? [0, 0, 0] : (parent ? sub(at, B[parent]) : at),
      ...(rotations[n] ? { rotation: rotations[n] } : {}),
      children: all.filter((m) => (PARENT[m] ?? PART_NODE[m] ?? (extra.includes(m) ? 'Bip01' : null)) === n).map((m) => idx.get(m)),
    };
  });
  if (shadow) {
    const bones = Object.keys(B).filter((n) => n !== 'Bip01');
    const at = records.length;
    records[0].children.push(at);
    records.push(
      { type: 'NiTriShape', name: 'Tri Shadow', data: at + 1, skin: at + 2 },
      { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
      { type: 'NiSkinInstance', data: at + 3, skeletonRoot: 0, bones: bones.map((n) => idx.get(n)) },
      { type: 'NiSkinData', bones: bones.map((n) => ({ transform: { translation: sub([0, 0, 0], B[n]) }, indices: [0, 1, 2], weights: [1 / bones.length, 1 / bones.length, 1 / bones.length] })) },
    );
  }
  return writeNif(records, [0]);
}

/** MW-STEEL2: RETAIL'S REST - the upper arms hanging at the sides (base_anim's node transforms are the idle's first
 *  frame), turned 80 degrees down about the forward axis from the T-pose their skins are bound in. */
const turnY = (deg) => { const a = (deg * Math.PI) / 180; const c = Math.cos(a); const s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const ARMS_DOWN = Object.freeze({ 'Bip01 R UpperArm': turnY(80), 'Bip01 L UpperArm': turnY(-80) });

/** A closed tube through rings `[centre, rx, ry]`, about Z (or X along an arm), local to `at`. */
function tube(name, rings, at, axis = 'z', segs = 12) {
  const positions = []; const indices = [];
  for (const [c, rx, ry] of rings) for (let s = 0; s < segs; s++) {
    const a = (s / segs) * 2 * Math.PI;
    const p = axis === 'z' ? [c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a), c[2]] : [c[0], c[1] + rx * Math.cos(a), c[2] + ry * Math.sin(a)];
    positions.push(...sub(p, at));
  }
  for (let r = 0; r + 1 < rings.length; r++) for (let s = 0; s < segs; s++) {
    const a = r * segs + s; const b = r * segs + ((s + 1) % segs);
    indices.push(a, b, b + segs, a, b + segs, a + segs);
  }
  return meshToNif({ name, positions, normals: null, uvs: null, indices }, { node: name });
}

/** The body: `{ slot, bytes }` per skin slot - what playerBodyRows resolves, one record a slot. */
export function plateBody(delta) {
  const B = bonesAt(delta);
  const D = (p) => add(p, delta);
  const at = (n) => B[PART_NODE[n]];
  const N = STEEL_PLATE_SCENE.neck; const H = STEEL_PLATE_SCENE.head;
  const mid = (b, k) => (b.min[k] + b.max[k]) / 2; const half = (b, k) => (b.max[k] - b.min[k]) / 2;
  const box = (name, b, node) => tube(name, [[D([mid(b, 0), mid(b, 1), b.min[2]]), half(b, 0), half(b, 1)], [D([mid(b, 0), mid(b, 1), b.max[2]]), half(b, 0), half(b, 1)]], at(node));
  return [
    { slot: 'neck', bytes: box('Neck', N, 'Neck') },
    { slot: 'head', bytes: box('Head', H, 'Head') },
    { slot: 'chest', bytes: tube('Chest', [[D([0, 0, 80]), 11, 8], [D([0, 0, 96]), 12, 9], [D([0, 0, 108]), 13, 8], [D([0, 0, 112]), 5, 4]], at('Chest')) },
    { slot: 'groin', bytes: tube('Groin', [[D([0, 0, 64]), 11, 8], [D([0, 0, 80]), 11, 8]], at('Groin')) },
    { slot: 'upperarm', bytes: tube('Upper Arm', [[D([12, 0, 111]), 4, 4], [D([31, 0, 111]), 3.2, 3.2]], at('Right Upper Arm'), 'x') },
    { slot: 'forearm', bytes: tube('Forearm', [[D([31, 0, 111]), 3.2, 3.2], [D([46, 0, 111]), 2.4, 2.2]], at('Right Forearm'), 'x') },
    { slot: 'wrist', bytes: tube('Wrist', [[D([46, 0, 111]), 2.4, 2.2], [D([49, 0, 111]), 2.3, 1.6]], at('Right Wrist'), 'x') },
    { slot: 'hand', bytes: tube('Hand', [[D([49, 0, 111]), 2.6, 1.4], [D([57, 0, 110.5]), 2.4, 1.0]], at('Right Hand'), 'x') },
    { slot: 'upperleg', bytes: tube('Upper Leg', [[D([6, 1, 42]), 4, 4], [D([6, 1, 72]), 6, 6]], at('Right Upper Leg')) },
    { slot: 'knee', bytes: tube('Knee', [[D([6, 1, 34]), 3.6, 3.6], [D([6, 1, 44]), 4, 4]], at('Right Knee')) },
    { slot: 'ankle', bytes: tube('Ankle', [[D([6, 0.5, 8]), 2.6, 2.6], [D([6, 0.5, 34]), 3.6, 3.6]], at('Right Ankle')) },
    // the foot's sole at the boots' sole, the scene's ground
    { slot: 'foot', bytes: tube('Foot', [[D([6, -4, -0.21]), 2.6, 0.01], [D([6, 2, -0.21]), 3, 0.01], [D([6, 2, 6]), 3, 2], [D([6, 11, 2]), 2.8, 1.4]], at('Right Foot')) },
  ];
}

/**
 * MW-STEEL2: A SKINNED BODY BOUND IN THE T-POSE - retail's shape, where plateBody's rigid tubes are a mod's. Each part
 * is one nameless skinned shape (taken once for both sides, as the binder takes a nameless skin), its vertices
 * authored where the T-posed body stands and every bone's inverse bind that bone's T-pose place undone - so drawn in
 * the bind pose it is the T-posed body whatever rest its skeleton stores. The same rings as plateBody's; each ring
 * weighted to the bone it sits on, the ring where two meet split between them, so the parts' skins share bones and the
 * bind runs from one to the next.
 */
export function skinnedPlateBody(delta) {
  const B = bonesAt(delta);
  const D = (p) => add(p, delta);
  const N = STEEL_PLATE_SCENE.neck; const H = STEEL_PLATE_SCENE.head;
  const mid = (b, k) => (b.min[k] + b.max[k]) / 2; const half = (b, k) => (b.max[k] - b.min[k]) / 2;
  const mirror = (p) => [-p[0], p[1], p[2]];
  const left = (n) => n.replace(' R ', ' L ');
  /** rings `[centre, rx, ry, { bone: weight }]` about `axis`, on the right and (`both`) mirrored on the left */
  const part = (name, rings, axis = 'z', both = false, segs = 10) => {
    const positions = []; const indices = []; const weights = new Map();
    const emit = (side) => {
      const base = positions.length / 3;
      rings.forEach(([c, rx, ry, w], r) => {
        for (let k = 0; k < segs; k++) {
          const a = (k / segs) * 2 * Math.PI;
          let p = axis === 'z' ? [c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a), c[2]] : [c[0], c[1] + rx * Math.cos(a), c[2] + ry * Math.sin(a)];
          if (side === 'left') p = mirror(p);
          const v = positions.length / 3;
          positions.push(...p);
          for (const [bone, wt] of Object.entries(w)) {
            const b = side === 'left' ? left(bone) : bone;
            if (!weights.has(b)) weights.set(b, []);
            weights.get(b).push([v, wt]);
          }
          if (r + 1 < rings.length) {
            const q = base + r * segs + k; const nb = base + r * segs + ((k + 1) % segs);
            indices.push(q, nb, nb + segs, q, nb + segs, q + segs);
          }
        }
      });
    };
    emit('right');
    if (both) emit('left');
    const bones = [...weights.keys()];
    const records = [
      { type: 'NiNode', name, children: [1, ...bones.map((_, i) => 5 + i)] },
      { type: 'NiTriShape', name: '', data: 2, skin: 3 },
      { type: 'NiTriShapeData', positions, normals: null, uvs: null, indices },
      { type: 'NiSkinInstance', data: 4, skeletonRoot: 0, bones: bones.map((_, i) => 5 + i) },
      { type: 'NiSkinData', bones: bones.map((b) => {
        const list = weights.get(b);
        const sphere = boundingSphere(list.flatMap(([v]) => positions.slice(v * 3, v * 3 + 3)));
        return { transform: { translation: sub([0, 0, 0], B[b]) }, center: sphere.center, radius: sphere.radius, indices: list.map(([v]) => v), weights: list.map(([, wt]) => wt) };
      }) },
      ...bones.map((b) => ({ type: 'NiNode', name: b })),
    ];
    return writeNif(records, [0]);
  };
  const ONE = (b) => ({ [b]: 1 });
  const HALF = (a, b) => ({ [a]: 0.5, [b]: 0.5 });
  return [
    { slot: 'neck', bytes: part('Neck', [[D([mid(N, 0), mid(N, 1), N.min[2]]), half(N, 0), half(N, 1), HALF('Bip01 Spine2', 'Bip01 Neck')], [D([mid(N, 0), mid(N, 1), N.max[2]]), half(N, 0), half(N, 1), ONE('Bip01 Neck')]]) },
    { slot: 'head', bytes: part('Head', [[D([mid(H, 0), mid(H, 1), H.min[2]]), half(H, 0), half(H, 1), HALF('Bip01 Neck', 'Bip01 Head')], [D([mid(H, 0), mid(H, 1), H.max[2]]), half(H, 0), half(H, 1), ONE('Bip01 Head')]]) },
    { slot: 'chest', bytes: part('Chest', [[D([0, 0, 80]), 11, 8, HALF('Bip01 Spine', 'Bip01 Spine1')], [D([0, 0, 96]), 12, 9, ONE('Bip01 Spine1')], [D([0, 0, 108]), 13, 8, HALF('Bip01 Spine2', 'Bip01 R Clavicle')], [D([0, 0, 112]), 5, 4, ONE('Bip01 Spine2')]]) },
    { slot: 'groin', bytes: part('Groin', [[D([0, 0, 64]), 11, 8, HALF('Bip01 Pelvis', 'Bip01 R Thigh')], [D([0, 0, 80]), 11, 8, HALF('Bip01 Pelvis', 'Bip01 Spine')]]) },
    { slot: 'upperarm', bytes: part('Upper Arm', [[D([12, 0, 111]), 4, 4, HALF('Bip01 R Clavicle', 'Bip01 R UpperArm')], [D([31, 0, 111]), 3.2, 3.2, ONE('Bip01 R UpperArm')]], 'x', true) },
    { slot: 'forearm', bytes: part('Forearm', [[D([31, 0, 111]), 3.2, 3.2, HALF('Bip01 R UpperArm', 'Bip01 R Forearm')], [D([46, 0, 111]), 2.4, 2.2, ONE('Bip01 R Forearm')]], 'x', true) },
    { slot: 'wrist', bytes: part('Wrist', [[D([46, 0, 111]), 2.4, 2.2, HALF('Bip01 R Forearm', 'Bip01 R Hand')], [D([49, 0, 111]), 2.3, 1.6, ONE('Bip01 R Hand')]], 'x', true) },
    { slot: 'hand', bytes: part('Hand', [[D([49, 0, 111]), 2.6, 1.4, HALF('Bip01 R Forearm', 'Bip01 R Hand')], [D([57, 0, 110.5]), 2.4, 1.0, ONE('Bip01 R Hand')]], 'x', true) },
    { slot: 'upperleg', bytes: part('Upper Leg', [[D([6, 1, 42]), 4, 4, HALF('Bip01 R Thigh', 'Bip01 R Calf')], [D([6, 1, 72]), 6, 6, ONE('Bip01 R Thigh')]], 'z', true) },
    { slot: 'knee', bytes: part('Knee', [[D([6, 1, 34]), 3.6, 3.6, ONE('Bip01 R Calf')], [D([6, 1, 44]), 4, 4, HALF('Bip01 R Thigh', 'Bip01 R Calf')]], 'z', true) },
    { slot: 'ankle', bytes: part('Ankle', [[D([6, 0.5, 8]), 2.6, 2.6, HALF('Bip01 R Calf', 'Bip01 R Foot')], [D([6, 0.5, 34]), 3.6, 3.6, ONE('Bip01 R Calf')]], 'z', true) },
    { slot: 'foot', bytes: part('Foot', [[D([6, -4, -0.21]), 2.6, 0.01, ONE('Bip01 R Foot')], [D([6, 2, -0.21]), 3, 0.01, ONE('Bip01 R Foot')], [D([6, 2, 6]), 3, 2, HALF('Bip01 R Calf', 'Bip01 R Foot')], [D([6, 11, 2]), 2.8, 1.4, ONE('Bip01 R Foot')]], 'z', true) },
  ];
}
