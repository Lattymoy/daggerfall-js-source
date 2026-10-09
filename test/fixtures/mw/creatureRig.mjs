// MWNPC9 (2026-10-09, bible/04-Characters/Morrowind-NPCs.md section 14): A CREATURE, AS MORROWIND SHIPS ONE. No
// committed fixture is a creature: every rig here is a skeleton with body parts worn on it. This writes one the way the
// retail r/x*.nif files are built (tools/nifWrite.mjs, the reader's own field order) - a model that is its own
// skeleton and its own body at once:
//
//   Creature (the file root)
//   +- Bip01            (0, 0, 10)                 - the accum root's name, its .kf walks it forward
//      +- Tri Bip01     a debug shape               - OpenMW strips "tri bip" from a creature's root
//      +- Spine         (0, 0, 5)
//         +- Tri Body   SKINNED to Spine and Bip01  - its inverse binds the bones' rests, so it stands as authored
//         +- Head       (4, 0, 2), a quarter turn about z
//         |  +- Tri Head  RIGID, (1, 0, 0) under its node
//         +- Tail       (-4, 0, 0)
//            +- Tri Tail  RIGID
//
// and its .kf: Idle, WalkForward (Bip01 forward along +y), Attack1 (start / hit / stop - Head turns), Attack2,
// Hit1, Death1 - and no RunForward, which a creature that has none walks instead.
import { writeNif } from '../../../tools/nifWrite.mjs';

export const CREATURE_MODEL = 'meshes/r/xcreature.nif';
export const CREATURE_KF = 'meshes/r/xcreature.kf';

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** a quarter turn about z, row-major (x -> y) */
export const QUARTER_Z = [0, -1, 0, 1, 0, 0, 0, 0, 1];
const tri = (o) => [o[0], o[1], o[2], o[0] + 1, o[1], o[2], o[0], o[1] + 1, o[2]];

/** The model. `bones` names the nodes (a test renames one to miss it); the triangles are each shape's own. */
export function creatureModel({ withTriBip = true } = {}) {
  const r = [];
  const add = (rec) => { r.push(rec); return r.length - 1; };
  const root = add({ type: 'NiNode', name: 'Creature', children: [] });
  const bip = add({ type: 'NiNode', name: 'Bip01', translation: [0, 0, 10], children: [] });
  r[root].children.push(bip);
  if (withTriBip) {
    const d = add({ type: 'NiTriShapeData', positions: tri([0, 0, 0]), normals: null, uvs: null, indices: [0, 1, 2] });
    r[bip].children.push(add({ type: 'NiTriShape', name: 'Tri Bip01', data: d }));
  }
  const spine = add({ type: 'NiNode', name: 'Spine', translation: [0, 0, 5], children: [] });
  r[bip].children.push(spine);
  // Tri Body: skinned, its vertices in the file root's space (Spine's at z 15, Bip01's at z 10)
  const bodyData = add({ type: 'NiTriShapeData', positions: [0, 0, 15, 1, 0, 15, 0, 0, 10], normals: null, uvs: null, indices: [0, 1, 2] });
  const body = add({ type: 'NiTriShape', name: 'Tri Body', data: bodyData, skin: -1 });
  r[spine].children.push(body);
  const head = add({ type: 'NiNode', name: 'Head', translation: [4, 0, 2], rotation: QUARTER_Z, children: [] });
  const tail = add({ type: 'NiNode', name: 'Tail', translation: [-4, 0, 0], children: [] });
  r[spine].children.push(head, tail);
  const hd = add({ type: 'NiTriShapeData', positions: tri([0, 0, 0]), normals: null, uvs: null, indices: [0, 1, 2] });
  r[head].children.push(add({ type: 'NiTriShape', name: 'Tri Head', translation: [1, 0, 0], data: hd }));
  const td = add({ type: 'NiTriShapeData', positions: tri([0, 0, 0]), normals: null, uvs: null, indices: [0, 1, 2] });
  r[tail].children.push(add({ type: 'NiTriShape', name: 'Tri Tail', data: td }));
  // the skin: Spine binds vertices 0 and 1, Bip01 vertex 2; each inverse bind the bone's rest undone
  const skinData = add({ type: 'NiSkinData', transform: { rotation: I3, translation: [0, 0, 0], scale: 1 }, bones: [
    { transform: { rotation: I3, translation: [0, 0, -15], scale: 1 }, indices: [0, 1], weights: [1, 1] },
    { transform: { rotation: I3, translation: [0, 0, -10], scale: 1 }, indices: [2], weights: [1] },
  ] });
  r[body].skin = add({ type: 'NiSkinInstance', data: skinData, skeletonRoot: root, bones: [spine, bip] });
  return writeNif(r, [root]);
}

/** The text keys, file time. */
export const CREATURE_KEYS = Object.freeze([
  [0, 'Idle: Start'], [1, 'Idle: Stop'],
  [1.1, 'WalkForward: Start'], [2.1, 'WalkForward: Stop'],
  [2.2, 'Attack1: Start'], [2.5, 'Attack1: Hit'], [2.8, 'Attack1: Stop'],
  [2.9, 'Attack2: Start'], [3.1, 'Attack2: Hit'], [3.3, 'Attack2: Stop'],
  [3.4, 'Hit1: Start'], [3.7, 'Hit1: Stop'],
  [3.8, 'Death1: Start'], [4.4, 'Death1: Stop'],
]);

/** The .kf: Bip01 walked forward along +y across WalkForward, Head turned a quarter about z across Attack1. */
export function creatureClip({ keys = CREATURE_KEYS } = {}) {
  const q = (deg) => { const h = (deg * Math.PI) / 360; return [Math.cos(h), 0, 0, Math.sin(h)]; };   // w, x, y, z
  const r = [
    { type: 'NiSequenceStreamHelper', name: 'xcreature', extra: 1, controller: 4 },
    { type: 'NiTextKeyExtraData', next: 2, keys: keys.map(([time, text]) => ({ time, text })) },
    { type: 'NiStringExtraData', next: 3, string: 'Bip01' },
    { type: 'NiStringExtraData', next: -1, string: 'Head' },
    { type: 'NiKeyframeController', next: 5, startTime: 0, stopTime: 4.4, data: 6 },
    { type: 'NiKeyframeController', next: -1, startTime: 0, stopTime: 4.4, data: 7 },
    { type: 'NiKeyframeData', rotationKeys: [], translations: { type: 1, keys: [
      { time: 0, value: [0, 0, 10] }, { time: 1.1, value: [0, 0, 10] }, { time: 2.1, value: [0, 10, 10] }, { time: 2.2, value: [0, 0, 10] }, { time: 4.4, value: [0, 0, 10] },
    ] }, scales: { keys: [] } },
    { type: 'NiKeyframeData', rotationType: 1, rotationKeys: [
      { time: 0, value: q(90) }, { time: 2.2, value: q(90) }, { time: 2.5, value: q(180) }, { time: 2.8, value: q(90) }, { time: 4.4, value: q(90) },
    ], translations: { keys: [] }, scales: { keys: [] } },
  ];
  return writeNif(r, [0]);
}
