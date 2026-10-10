// MW-BOW1 (2026-10-10): A BOW THAT DRAWS. No committed fixture bow carries the motion a retail Morrowind bow does - its
// limbs and string morphing as the string is pulled, and its ArrowBone keyframed from where the arrow is fetched to the
// string and back (OpenMW issues 5642 and 9322: "arrow fetching animation is baked into bow mesh"). This is bowmesh.nif
// - its every record written back by tools/nifWrite.mjs - with the two controllers a retail bow carries added, timed in
// the BowAndArrow group's own time (armfpweapon.kf's group starts at 5.5, "BowAndArrow: Equip Start"; shoot start 5.8,
// shoot attach 5.9, max attack 6.2, release 6.4, follow start 6.5, follow stop 6.7 - so 0.3, 0.4, 0.7, 0.9, 1.0, 1.2):
//   ArrowBone  NiKeyframeController, translation keys: at rest (0, 6, 0) through the attach, drawn back to
//              ARROW_DRAWN by max attack, held to the release, back at rest by the follow's start
//   Limb       NiGeomMorpherController over NiMorphData: the base, and one morph LIMB_BEND that bends the limb, its
//              weight 0 at the attach, 1 at max attack and the release, 0 again by the follow's start
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/mwNifFile.js';
import { writeNif } from '../../../tools/nifWrite.mjs';

export const ARROW_REST = Object.freeze([0, 6, 0]);
export const ARROW_DRAWN = Object.freeze([0, 6, -5]);
export const LIMB_BEND = Object.freeze([0, 0, -2, 0, 0, -2, 0, 0, -1, 0, 0, -1]);
/** The clock's own times (the group's playhead less its first key). */
export const T = Object.freeze({ attach: 0.4, maxAttack: 0.7, release: 0.9, followStart: 1.0 });

const ACTIVE_CONSTANT = 0x8 | 0x4;   // CONTROLLER_FLAG_ACTIVE | EXTRAPOLATION.Constant

/** bowmesh.nif with the two controllers (either left off by its switch). */
export function bowClip({ arrow = true, limb = true } = {}) {
  const nif = parseNif(new Uint8Array(readFileSync(new URL('./bowmesh.nif', import.meta.url))));
  // the reader's geometry fields under the writer's names (tools/nifWrite.mjs NiTriShapeData)
  const records = nif.records.map((r) => (r.type === 'NiTriShapeData'
    ? { ...r, positions: r.vertices, uvs: r.uvSets?.[0] ?? null, indices: r.triangles }
    : { ...r }));
  const byName = (n) => records.findIndex((r) => r.name === n);
  if (arrow) {
    const bone = byName('ArrowBone');
    const data = records.length;
    records.push({
      type: 'NiKeyframeData', rotationKeys: [], rotationType: 0,
      translations: { type: 1, keys: [
        { time: T.attach, value: [...ARROW_REST] }, { time: T.maxAttack, value: [...ARROW_DRAWN] },
        { time: T.release, value: [...ARROW_DRAWN] }, { time: T.followStart, value: [...ARROW_REST] },
      ] },
      scales: { type: 1, keys: [] },
    });
    const ctrl = records.length;
    records.push({ type: 'NiKeyframeController', next: -1, flags: ACTIVE_CONSTANT, frequency: 1, phase: 0, startTime: T.attach, stopTime: T.followStart, target: bone, data });
    records[bone] = { ...records[bone], controller: ctrl };
  }
  if (limb) {
    const shape = byName('Limb');
    const base = [...records[records[shape].data].vertices];
    const data = records.length;
    records.push({
      type: 'NiMorphData', numVertices: base.length / 3, relativeTargets: 1,
      morphs: [
        { keys: { type: 1, keys: [] }, vectors: Float32Array.from(base) },
        { keys: { type: 1, keys: [
          { time: T.attach, value: 0 }, { time: T.maxAttack, value: 1 }, { time: T.release, value: 1 }, { time: T.followStart, value: 0 },
        ] }, vectors: Float32Array.from(LIMB_BEND) },
      ],
    });
    const ctrl = records.length;
    records.push({ type: 'NiGeomMorpherController', next: -1, flags: ACTIVE_CONSTANT, frequency: 1, phase: 0, startTime: T.attach, stopTime: T.followStart, target: shape, data, alwaysUpdate: 0 });
    records[shape] = { ...records[shape], controller: ctrl };
  }
  return writeNif(records, nif.roots);
}
