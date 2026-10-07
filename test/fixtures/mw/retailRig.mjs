// MW-STEEL3 (2026-10-07) cut this rig from retail's own skeleton; MW-STEEL4 (2026-10-07, Mac: "You do it properly")
// keeps it for the plate shipped skinned. RETAIL'S SKELETON, AS THE GAME STANDS IT:
//
// - THE SKELETON is the vendored retail hierarchy (vendor/weapon-sheathing/.../xbase_anim_sh.nif): every NiNode's own
//   rest - the idle's first frame, the arms hanging, the right leg forward - and its "Tri Shadow" verbatim (`shadow`).
// - THE PART NODES base_anim carries ("Right Hand", "Right Clavicle") hang at zero under their Bip01 bones, so a part
//   claimed at one (ARMO_PART's bones) has the node bindPartsInto asks the skeleton for. A skinned part is rebound by
//   its bones' names whatever these stand at (rule 12); they are here so the binder's door is the game's.
// - `rest` turns named bones' rests (a 3x3, row-major) - another rig's rest over the same bones (the first person's) -
//   and `extra` adds nodes before every other (a camera), so the same bones stand at other refs.
//
// And THE TRUE BIND, built here from the Tri Shadow's records by hand - not by the bake's retailBind, which is under
// test: each bound bone's inverse bind undone, placed so the pelvis stands on its rest origin (the bind's own frame is
// the Tri Shadow's, its pelvis 22 units under its origin); a bone the shadow does not bind rides its parent's rest.
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/mwSkin.js';
import { writeNif } from '../../../tools/nifWrite.mjs';

export const RETAIL_SKELETON_PATH = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
export const RETAIL_SKELETON_BYTES = new Uint8Array(readFileSync(new URL(`../../../${RETAIL_SKELETON_PATH}`, import.meta.url)));
const nif = parseNif(RETAIL_SKELETON_BYTES);

/** Each part node base_anim carries, and the Bip01 bone it hangs off at zero. */
export const RETAIL_PART_NODE = Object.freeze(Object.fromEntries([
  ['Chest', 'Bip01 Spine2'], ['Groin', 'Bip01 Pelvis'], ['Neck', 'Bip01 Neck'], ['Head', 'Bip01 Head'],
  ...[['Right', 'R'], ['Left', 'L']].flatMap(([side, s]) => [
    [`${side} Clavicle`, `Bip01 ${s} Clavicle`], [`${side} Upper Arm`, `Bip01 ${s} UpperArm`], [`${side} Forearm`, `Bip01 ${s} Forearm`],
    [`${side} Wrist`, `Bip01 ${s} Hand`], [`${side} Hand`, `Bip01 ${s} Hand`],
    [`${side} Upper Leg`, `Bip01 ${s} Thigh`], [`${side} Knee`, `Bip01 ${s} Calf`], [`${side} Ankle`, `Bip01 ${s} Foot`], [`${side} Foot`, `Bip01 ${s} Foot`],
  ]),
]));

/** The skeleton file: retail's NiNodes (their rests verbatim, or `rest`'s), the part nodes, `extra` nodes first, and
 *  (`shadow`) its own Tri Shadow. */
export function retailSkeleton({ shadow = true, rest = {}, extra = [] } = {}) {
  const nodes = nif.records.map((r, i) => [r, i]).filter(([r]) => r?.type === 'NiNode');
  const off = extra.length;
  const idx = new Map(nodes.map(([, i], k) => [i, k + 1 + off]));
  const out = [{ type: 'NiNode', name: 'Rig', children: [...extra.map((_, k) => 1 + k), 1 + off] }];
  for (const name of extra) out.push({ type: 'NiNode', name, children: [] });
  for (const [r] of nodes) {
    out.push({
      type: 'NiNode', name: r.name, translation: Array.from(r.translation), rotation: rest[r.name] ? Array.from(rest[r.name]) : Array.from(r.rotation), scale: r.scale,
      children: (r.children ?? []).filter((c) => idx.has(c)).map((c) => idx.get(c)),
    });
  }
  const at = new Map(out.map((n, k) => [n.name.toLowerCase(), k]));
  for (const [part, bone] of Object.entries(RETAIL_PART_NODE)) {
    out[at.get(bone.toLowerCase())].children.push(out.length);
    out.push({ type: 'NiNode', name: part, translation: [0, 0, 0], children: [] });
  }
  if (shadow) {
    const rec = nif.records.find((r) => r?.name === 'Tri Shadow');
    const skin = nif.records[rec.skin]; const data = nif.records[skin.data];
    const k = out.length;
    out[1 + off].children.push(k);
    const xf = (t) => ({ rotation: Array.from(t.rotation), translation: Array.from(t.translation), scale: t.scale });
    out.push(
      { type: 'NiTriShape', name: 'Tri Shadow', data: k + 1, skin: k + 2 },
      { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
      { type: 'NiSkinInstance', data: k + 3, skeletonRoot: idx.get(skin.skeletonRoot), bones: skin.bones.map((b) => idx.get(b)) },
      { type: 'NiSkinData', transform: xf(data.transform), bones: data.bones.map((b) => ({ transform: xf(b.transform), indices: [0, 1, 2], weights: [0.1, 0.1, 0.1] })) },
    );
  }
  return writeNif(out, [0]);
}

/** The Tri Shadow's inverse binds, read off its records: name -> { a, t } (mesh space to bone space). */
export const SHADOW_INVERSE_BINDS = (() => {
  const rec = nif.records.find((r) => r?.name === 'Tri Shadow');
  const skin = nif.records[rec.skin]; const data = nif.records[skin.data];
  return new Map(skin.bones.map((b, i) => {
    const t = data.bones[i].transform;
    return [nif.records[b].name, { a: Array.from(t.rotation, (v) => v * t.scale), t: Array.from(t.translation) }];
  }));
})();

const invert = ({ a, t }) => {
  const r = [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
  return { a: r, t: [-(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]), -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]), -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2])] };
};
const mul = (p, q) => ({
  a: [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => p.a[r * 3] * q.a[c] + p.a[r * 3 + 1] * q.a[3 + c] + p.a[r * 3 + 2] * q.a[6 + c])),
  t: [0, 1, 2].map((r) => p.a[r * 3] * q.t[0] + p.a[r * 3 + 1] * q.t[1] + p.a[r * 3 + 2] * q.t[2] + p.t[r]),
});

/**
 * The bind pose as TRACKS on `skeletonBytes` (one of retailSkeleton's): every bone the Tri Shadow binds given the local
 * transform that stands it at its bind in graph space - the pelvis on its rest origin - for poseAssembly. Answers
 * `{ tracks, sampleTrack, frame }`, `frame` the translation from the Tri Shadow's frame to graph space.
 */
export function bindPoseTracks(skeletonBytes) {
  const sk = buildSkeleton(parseNif(skeletonBytes));
  const rest = skeletonSpaceMatrices(sk, poseSkeleton(sk, null, null, 0, {}), GRAPH_ROOT);
  const pelvis = invert(SHADOW_INVERSE_BINDS.get('Bip01 Pelvis'));
  const restPelvis = rest.get(sk.byName.get('bip01 pelvis')).t;
  const frame = [0, 1, 2].map((k) => restPelvis[k] - pelvis.t[k]);
  const graph = new Map([...SHADOW_INVERSE_BINDS].map(([n, ib]) => { const m = invert(ib); return [n.toLowerCase(), { a: m.a, t: m.t.map((v, k) => v + frame[k]) }]; }));
  const local = new Map();
  for (const [name, m] of graph) {
    const node = sk.nodes.get(sk.byName.get(name));
    const parent = sk.nodes.get(node.parent);
    const p = graph.get(parent.name.toLowerCase()) ?? rest.get(node.parent);
    local.set(name, mul(invert(p), m));
  }
  const quat = (a) => {
    const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = a; const tr = m00 + m11 + m22;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; return [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s]; }
    if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; return [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s]; }
    if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; return [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s]; }
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2; return [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4];
  };
  const tracks = new Map([...local.keys()].map((n) => [n, n]));
  return { tracks, sampleTrack: (n) => ({ rotation: quat(local.get(n).a), translation: local.get(n).t }), frame };
}
