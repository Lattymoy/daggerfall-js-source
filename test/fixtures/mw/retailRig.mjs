// MW-STEEL3 (2026-10-07, Mac: "Morrowind integration bugs. I am so tired of us not getting this right", over a
// player's screenshot of the steel gauntlets in a V over the helm): A RIG CUT FROM RETAIL'S OWN SKELETON.
//
// plateRig.mjs stands its bones unturned and its skins in the skeleton's own frame - the conditions under which the
// frame a skin's mesh is authored in and the skeleton's coincide, so a solve that confused the two passed every pin
// (the MW-D20 lesson: "every fixture's root was IDENTITY ... the exact conditions under which three spaces coincide.
// Retail data holds none of them."). This one holds what retail does, and what the game met:
//
// - THE SKELETON is the vendored retail hierarchy (vendor/weapon-sheathing/.../xbase_anim_sh.nif): every NiNode's own
//   rest, turned as Bip01 bones are (each along its own X), the arms hanging; the part nodes base_anim carries
//   ("Right Forearm") hung at zero under their bones; and the file's own "Tri Shadow", its binds verbatim.
// - THE BODY is skinned, bound in that Tri Shadow's T-pose - every inverse bind the bone's true bind undone, rotation
//   and all - and authored PART-LOCAL (`frame`: the mesh stands in its own frame, as retail's parts do - MW-D21, "a
//   torso on the ground"), each skin LISTING the pelvis beside the bones it weights (`listed`, with no vertex) - a
//   bone a skin does not weight, which a skin may list.
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/mwSkin.js';
import { affineMul, affineApply } from '../../../src/formats/mwAffine.js';
import { writeNif, boundingSphere } from '../../../tools/nifWrite.mjs';

export const RETAIL_SKELETON = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
const nif = parseNif(new Uint8Array(readFileSync(new URL(`../../../${RETAIL_SKELETON}`, import.meta.url))));
const real = buildSkeleton(nif);
const restMats = skeletonSpaceMatrices(real, poseSkeleton(real, null, null, 0, {}), GRAPH_ROOT);

const I3 = () => Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
/** An affine's inverse, for the rigid-and-uniform transforms a skeleton is made of (R^T, -R^T t). */
function rigidInverse(m) {
  const a = m.a; const t = m.t;
  const r = Float32Array.from([a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]);
  return { a: r, t: [-(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]), -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]), -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2])] };
}

/**
 * THE TRUE BIND, built here from the Tri Shadow by hand - not by the port's bindPoseMats, which is under test: within
 * the one skin P_b = F o IB_b^-1 for its mesh's frame F, and retail's Tri Shadow is authored in the skeleton's frame
 * with its pelvis on the rest's origin (mwsteel2.test.js reads the premise on this file). Bones it does not bind ride
 * their parents by their rest locals.
 */
const shadowRec = nif.records.find((r) => r?.name === 'Tri Shadow');
const shadowSkin = nif.records[shadowRec.skin];
const shadowData = nif.records[shadowSkin.data];
const tf = (t) => ({ a: Float32Array.from(t.rotation, (v) => v * t.scale), t: [...t.translation] });
const shadowIB = new Map(shadowSkin.bones.map((b, i) => [String(nif.records[b].name).toLowerCase(), tf(shadowData.bones[i].transform)]));
const pelvisRef = real.byName.get('bip01 pelvis');
const trueBind = new Map();
{
  // the frame: rotation the skeleton's, placed so the pelvis stands on its rest origin
  const pelvisInSkin = rigidInverse(shadowIB.get('bip01 pelvis'));
  const rest = restMats.get(pelvisRef).t;
  const frame = { a: I3(), t: [rest[0] - pelvisInSkin.t[0], rest[1] - pelvisInSkin.t[1], rest[2] - pelvisInSkin.t[2]] };
  const matOf = (ref) => {
    if (trueBind.has(ref)) return trueBind.get(ref);
    const node = real.nodes.get(ref);
    const ib = shadowIB.get(String(node.name).toLowerCase());
    const m = ib ? affineMul(frame, rigidInverse(ib))
      : node.parent >= 0 && real.nodes.has(node.parent) ? affineMul(matOf(node.parent), tf(node.rest)) : restMats.get(ref);
    trueBind.set(ref, m);
    return m;
  };
  for (const ref of real.nodes.keys()) matOf(ref);
}
/** A bone's true bind (graph space), by name. */
export const bindOf = (name) => trueBind.get(real.byName.get(name.toLowerCase()));

/** Each part node base_anim carries, and the Bip01 bone it hangs off at zero. */
export const RETAIL_PART_NODE = Object.freeze({
  'Chest': 'Bip01 Spine2', 'Groin': 'Bip01 Pelvis', 'Neck': 'Bip01 Neck', 'Head': 'Bip01 Head',
  'Right Upper Arm': 'Bip01 R UpperArm', 'Right Forearm': 'Bip01 R Forearm', 'Right Wrist': 'Bip01 R Hand', 'Right Hand': 'Bip01 R Hand',
  'Left Upper Arm': 'Bip01 L UpperArm', 'Left Forearm': 'Bip01 L Forearm', 'Left Wrist': 'Bip01 L Hand', 'Left Hand': 'Bip01 L Hand',
  'Right Upper Leg': 'Bip01 R Thigh', 'Left Upper Leg': 'Bip01 L Thigh',
});

/** The skeleton file: retail's NiNodes (their rests verbatim), the part nodes, and (`shadow`) its own Tri Shadow. */
export function retailSkeleton({ shadow = true } = {}) {
  const nodes = nif.records.map((r, i) => [r, i]).filter(([r]) => r?.type === 'NiNode');
  const idx = new Map(nodes.map(([, i], k) => [i, k]));
  const out = nodes.map(([r]) => ({
    type: 'NiNode', name: r.name, translation: Array.from(r.translation), rotation: Array.from(r.rotation), scale: r.scale,
    children: (r.children ?? []).filter((c) => idx.has(c)).map((c) => idx.get(c)),
  }));
  const at = new Map(out.map((n, k) => [n.name.toLowerCase(), k]));
  for (const [part, bone] of Object.entries(RETAIL_PART_NODE)) {
    out[at.get(bone.toLowerCase())].children.push(out.length);
    out.push({ type: 'NiNode', name: part, translation: [0, 0, 0], children: [] });
  }
  if (shadow) {
    const k = out.length;
    out[0].children.push(k);
    const xf = (t) => ({ rotation: Array.from(t.rotation), translation: Array.from(t.translation), scale: t.scale });
    out.push(
      { type: 'NiTriShape', name: 'Tri Shadow', data: k + 1, skin: k + 2 },
      { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
      { type: 'NiSkinInstance', data: k + 3, skeletonRoot: idx.get(shadowSkin.skeletonRoot), bones: shadowSkin.bones.map((b) => idx.get(b)) },
      { type: 'NiSkinData', transform: xf(shadowData.transform),
        bones: shadowData.bones.map((b) => ({ transform: xf(b.transform), indices: [0, 1, 2], weights: [0.1, 0.1, 0.1] })) },
    );
  }
  return writeNif(out, [0]);
}

/** A part-local frame: a quarter turn about Y and a step away - a mesh authored in its own frame, not the body's. */
export const PART_LOCAL = Object.freeze({ a: Float32Array.from([0, 0, 1, 0, 1, 0, -1, 0, 0]), t: [3, -40, 20] });

/**
 * One skinned part: rings `[centre (where the T-posed body stands), radius, { bone: weight }]` about X (an arm) or Z,
 * the right side and (`both`) its mirror on the left; authored in `frame` (each vertex frame^-1 of where it stands,
 * each inverse bind the bone's true bind undone after the frame), and listing `listed` bones with no vertex.
 */
function skinnedPart(name, rings, axis, { both = false, frame = null, listed = [], segs = 10 } = {}) {
  const fr = frame ?? { a: I3(), t: [0, 0, 0] };
  const fi = rigidInverse(fr);
  const positions = []; const indices = []; const weights = new Map();
  const emit = (side) => {
    const base = positions.length / 3;
    const sided = (n) => (side === 'left' ? n.replace(' R ', ' L ') : n);
    rings.forEach(([c0, r, w], ri) => {
      const c = side === 'left' ? [-c0[0], c0[1], c0[2]] : c0;
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * 2 * Math.PI;
        const p = axis === 'x' ? [c[0], c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)] : [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]];
        const v = positions.length / 3;
        positions.push(...affineApply(fi, ...p));
        for (const [bone, wt] of Object.entries(w)) {
          const b = sided(bone);
          if (!weights.has(b)) weights.set(b, []);
          weights.get(b).push([v, wt]);
        }
        if (ri + 1 < rings.length) {
          const q = base + ri * segs + k; const nb = base + ri * segs + ((k + 1) % segs);
          indices.push(q, nb, nb + segs, q, nb + segs, q + segs);
        }
      }
    });
  };
  emit('right');
  if (both) emit('left');
  for (const b of listed) if (!weights.has(b)) weights.set(b, []);
  const bones = [...weights.keys()];
  const xf = (m) => ({ rotation: Array.from(m.a), translation: [...m.t], scale: 1 });
  const records = [
    { type: 'NiNode', name, children: [1, ...bones.map((_, i) => 5 + i)] },
    { type: 'NiTriShape', name: '', data: 2, skin: 3 },
    { type: 'NiTriShapeData', positions, normals: null, uvs: null, indices },
    { type: 'NiSkinInstance', data: 4, skeletonRoot: 0, bones: bones.map((_, i) => 5 + i) },
    { type: 'NiSkinData', bones: bones.map((b) => {
      const list = weights.get(b);
      const sphere = boundingSphere(list.flatMap(([v]) => positions.slice(v * 3, v * 3 + 3)));
      return { transform: xf(affineMul(rigidInverse(bindOf(b)), fr)), center: sphere.center, radius: sphere.radius,
        indices: list.map(([v]) => v), weights: list.map(([, wt]) => wt) };
    }) },
    ...bones.map((b) => ({ type: 'NiNode', name: b })),
  ];
  return writeNif(records, [0]);
}

/** The body, one record a skin slot - bound in the Tri Shadow's T-pose, authored in `frame`, listing `listed`. */
export function retailBody({ frame = PART_LOCAL, listed = ['Bip01 Pelvis'] } = {}) {
  const P = (n) => bindOf(n).t;
  const mix = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
  const ONE = (b) => ({ [b]: 1 });
  const HALF = (a, b) => ({ [a]: 0.5, [b]: 0.5 });
  const o = { frame, listed };
  const neck = P('Bip01 Neck'); const head = P('Bip01 Head');
  const UA = P('Bip01 R UpperArm'); const FA = P('Bip01 R Forearm'); const HA = P('Bip01 R Hand'); const TIP = P('Bip01 R Finger11');
  return [
    { slot: 'neck', bytes: skinnedPart('Neck', [[[0, neck[1], neck[2] - 4], 3.9, HALF('Bip01 Spine2', 'Bip01 Neck')], [[0, neck[1], neck[2] + 6], 3.9, ONE('Bip01 Neck')]], 'z', o) },
    { slot: 'head', bytes: skinnedPart('Head', [[[0, head[1], head[2] - 4], 4.7, HALF('Bip01 Neck', 'Bip01 Head')], [[0, head[1], head[2] + 10], 4.7, ONE('Bip01 Head')]], 'z', o) },
    { slot: 'chest', bytes: skinnedPart('Chest', [[P('Bip01 Spine'), 11, HALF('Bip01 Spine', 'Bip01 Spine1')], [P('Bip01 Spine1'), 12, ONE('Bip01 Spine1')], [P('Bip01 Spine2'), 13, ONE('Bip01 Spine2')], [mix(P('Bip01 Spine2'), neck, 0.8), 5, ONE('Bip01 Spine2')]], 'z', o) },
    { slot: 'groin', bytes: skinnedPart('Groin', [[mix(P('Bip01 Pelvis'), P('Bip01 R Calf'), 0.3), 11, HALF('Bip01 Pelvis', 'Bip01 R Thigh')], [P('Bip01 Spine'), 11, HALF('Bip01 Pelvis', 'Bip01 Spine')]], 'z', o) },
    { slot: 'upperarm', bytes: skinnedPart('Upper Arm', [[UA, 4, HALF('Bip01 R Clavicle', 'Bip01 R UpperArm')], [FA, 3.2, ONE('Bip01 R UpperArm')]], 'x', { ...o, both: true }) },
    { slot: 'forearm', bytes: skinnedPart('Forearm', [[FA, 3.2, HALF('Bip01 R UpperArm', 'Bip01 R Forearm')], [mix(FA, HA, 0.85), 2.4, ONE('Bip01 R Forearm')]], 'x', { ...o, both: true }) },
    { slot: 'wrist', bytes: skinnedPart('Wrist', [[mix(FA, HA, 0.85), 2.4, HALF('Bip01 R Forearm', 'Bip01 R Hand')], [HA, 2.3, ONE('Bip01 R Hand')]], 'x', { ...o, both: true }) },
    { slot: 'hand', bytes: skinnedPart('Hand', [[HA, 2.6, HALF('Bip01 R Forearm', 'Bip01 R Hand')], [TIP, 2.4, ONE('Bip01 R Hand')]], 'x', { ...o, both: true }) },
    { slot: 'upperleg', bytes: skinnedPart('Upper Leg', [[P('Bip01 R Calf'), 4, HALF('Bip01 R Thigh', 'Bip01 R Calf')], [P('Bip01 R Thigh'), 6, ONE('Bip01 R Thigh')]], 'z', { ...o, both: true }) },
  ];
}
