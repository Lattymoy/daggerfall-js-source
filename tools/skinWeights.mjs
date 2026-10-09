// A MESH WEIGHTED TO A SKELETON, AT BAKE TIME.
//
// MW-STEEL4 (2026-10-07, Mac: "I think the prior session to rig the new steel set on the morrowind model really
// fucked it up. How hard is it to switch it out?", and asked how, "You do it properly"). Retail Morrowind ships its
// armour SKINNED: each piece's NIF carries its own weights to the Bip01 bones and its own inverse binds, made once by
// the modeller, and the engine only reads them (Morrowind-Rules.md rules 12, 19, 20). The steel plate came from Mac
// as static meshes on a T-posed body, and MW-STEEL1-3 rigged it AT RUNTIME instead - each vertex copying the skin of
// the player's own body under it, solved in a bind pose recovered from the skins - three sessions of fitting a solve
// to fixtures, and the third still had the gauntlets standing off the arm in the field. This is the modeller's step,
// done here once: the weights are written into the NIF (tools/nifWrite.mjs skinnedMeshesToNif), and the game takes
// the plate on the path it takes Morrowind's own armour.
//
// ═══ THE LAW: A RIGGER'S, WRITTEN DOWN ═══════════════════════════════
//
// `bones` are the piece's own bones - the vertex groups a modeller would make - each a SEGMENT in the bind pose, in
// the mesh's frame: `from` the bone's origin, `to` where it ends (its child's origin, or a point named for a bone that
// ends in nothing - a fingertip, the toes, the crown). For each vertex:
//
//   1. Its bone is the NEAREST segment, less the bone's `bias` (units; a bone that should claim more than its
//      geometry reaches). The first listed wins a tie.
//   2. Across a JOINT it blends with the bone on the other side: with the bone's rig `parent` when it stands within
//      `blend` units past the bone's own origin, else with the nearest rig child whose origin it stands within that
//      child's `blend` of. The split is a smoothstep across the joint's plane (the child's axis), `blend` units either
//      side, so the steel keeps its shape between joints and folds across a joint's width - never a vertex pulled by
//      a bone it does not cover.
//   3. Or it HANGS (`hang`, a skirt): from `root` at the waist (`top`) to the hem (`bottom`) the legs take a growing
//      share, up to `share` at the hem, divided between the left and right leg by which side of the middle the vertex
//      stands (`centre` units either side of x = 0 split it), so the plates swing with the stride and part between
//      the legs no further than they must.
//   4. MW-EBONY1: or it hangs OVER its joints (`hang.mode` 'over' - a breastplate whose tassets reach the thighs, a
//      cloak): above `top` the joint law alone, below it the joint law's own answer keeps 1 - share and the legs
//      take the share, so the waist is one surface - nothing changes where the share is nought. The legs weigh in by
//      the hang alone: the joint law never picks them - as the nearest bone, as a child's blend, or as a parent's -
//      so a plate over the thigh is not the thigh's outright, and a bone is weighed once.
//
// Welded vertices (one position, split by a seam in the UVs or the normals) are weighted once and share the answer,
// so a seam never opens under a pose. Every list is normalised to 1; a vertex carries one bone or a joint's two (a
// hanging one three, the root and two legs; one hung over its joints four, a joint's two and two legs). Pure
// arithmetic - +, *, /, sqrt - so the bake is the same bytes on every machine.
//
// Answers one `[[boneName, weight], ...]` list per vertex, heaviest first - what skinnedMeshesToNif writes.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.sqrt(dot(a, a)); return [a[0] / l, a[1] / l, a[2] / l]; };

/** The smoothstep, 0 below 0 and 1 above 1. */
export const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** How far `p` stands from the segment a-b. */
export function segmentDistance(p, a, b) {
  const d = sub(b, a);
  const len2 = dot(d, d);
  let t = len2 > 0 ? dot(sub(p, a), d) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = p[0] - a[0] - d[0] * t, y = p[1] - a[1] - d[1] * t, z = p[2] - a[2] - d[2] * t;
  return Math.sqrt(x * x + y * y + z * z);
}

/** Each vertex's welded group: `rep[v]` the group, `first[g]` the group's first vertex. Positions match to 1e-4. */
export function weldGroups(positions) {
  const n = positions.length / 3;
  const at = new Map();
  const rep = new Int32Array(n);
  const first = [];
  for (let v = 0; v < n; v++) {
    const k = `${Math.round(positions[v * 3] * 1e4)},${Math.round(positions[v * 3 + 1] * 1e4)},${Math.round(positions[v * 3 + 2] * 1e4)}`;
    let g = at.get(k);
    if (g === undefined) { g = first.length; at.set(k, g); first.push(v); }
    rep[v] = g;
  }
  return { rep, first };
}

/**
 * The weights, by the law above. `bones`: `[{ name, from, to, parent?, blend?, bias? }]`; `hang`:
 * `{ root, legs: [left, right], top, bottom, share, centre }` or null.
 */
export function jointWeights(positions, bones, { hang = null } = {}) {
  if (!bones?.length) throw new Error('no bones to weight to');
  const index = new Map(bones.map((b, i) => [b.name, i]));
  for (const b of bones) if (b.parent && !index.has(b.parent)) throw new Error(`"${b.name}" blends with "${b.parent}", which is not one of the bones`);
  if (hang) for (const n of [hang.root, ...hang.legs]) if (!index.has(n)) throw new Error(`the hang names "${n}", which is not one of the bones`);
  const axis = bones.map((b) => unit(sub(b.to, b.from)));
  const children = bones.map((b) => bones.flatMap((c, j) => (c.parent === b.name ? [j] : [])));
  /** The joint blend across child c's origin: c's share, by where p stands along c's axis. */
  const across = (p, c) => { const L = bones[c].blend ?? 1; return smoothstep((dot(sub(p, bones[c].from), axis[c]) + L) / (2 * L)); };
  const over = hang?.mode === 'over';
  if (hang && hang.mode != null && !over) throw new Error(`a hang's mode is 'over' or none, not "${hang.mode}"`);
  const legIndex = over ? new Set(hang.legs.map((n) => index.get(n))) : null;
  const joint = (p) => {
    const d = bones.map((b) => segmentDistance(p, b.from, b.to) - (b.bias ?? 0));
    let k = legIndex?.has(0) ? -1 : 0;
    for (let i = 0; i < d.length; i++) if (!legIndex?.has(i) && (k < 0 || d[i] < d[k])) k = i;
    const b = bones[k];
    if (b.parent && !legIndex?.has(index.get(b.parent))) {   // AUDIT MW-CLOAK: over its joints, a leg is never a parent's blend either
      const L = b.blend ?? 1;
      if (dot(sub(p, b.from), axis[k]) < L) { const w = across(p, k); return [[k, w], [index.get(b.parent), 1 - w]]; }
    }
    let c = -1;
    for (const j of children[k]) {
      if (legIndex?.has(j)) continue;
      const L = bones[j].blend ?? 1;
      if (dot(sub(p, bones[j].from), axis[j]) > -L && (c < 0 || d[j] < d[c])) c = j;
    }
    if (c >= 0) { const w = across(p, c); return [[c, w], [k, 1 - w]]; }
    return [[k, 1]];
  };
  const weigh = (p) => {
    if (!hang) return joint(p);
    const legs = smoothstep((hang.top - p[2]) / (hang.top - hang.bottom)) * hang.share;
    const right = smoothstep((p[0] + hang.centre) / (2 * hang.centre));
    const shares = [[index.get(hang.legs[0]), legs * (1 - right)], [index.get(hang.legs[1]), legs * right]];
    if (!over) return [[index.get(hang.root), 1 - legs], ...shares];
    return [...joint(p).map(([i, w]) => [i, w * (1 - legs)]), ...shares];
  };
  const { rep, first } = weldGroups(positions);
  const lists = first.map((v) => {
    const kept = weigh([positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]]).filter(([, w]) => w > 1e-4);
    const sum = kept.reduce((s, [, w]) => s + w, 0);
    return kept.map(([i, w]) => [bones[i].name, w / sum]).sort((x, y) => y[1] - x[1] || index.get(x[0]) - index.get(y[0]));
  });
  return Array.from({ length: positions.length / 3 }, (_, v) => lists[rep[v]]);
}
