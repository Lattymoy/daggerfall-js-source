// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAP3 — THE HELD POSE: the Morrowind first-person arms holding a
// sheet of paper, and the sheet itself.
//
// Mac (2026-09-18, the Held Map arc): "Morrowind will need its own
// handcrafted map with hand placement just like the sprite. Our first
// custom rig change." This is that change, and it is the FIRST pose in
// this port that is not one of Morrowind's own animations: a set of
// hand-authored rotations laid over the idle, and a paper quad placed
// in front of the eye for the hands to hold.
//
// THE MECHANISM IS THE TORCH'S. combat/fpArm.js poses the rig from a
// TRACK MAP and a SAMPLER (formats/mwFirstPerson.js poseAssembly ->
// mwSkin.js poseSkeleton, which asks `tracks.get(boneName)` and then
// `sampleTrack(track, time)` and expects `{rotation: quaternion,
// translation, scale}`). MW-D51 blended the torch clip onto the left
// arm by wrapping masked bones' tracks (`{__overlay: track}`) and
// handing a sampler that reads the wrapper on its own clock. This
// module wraps the same way (`{__delta, __base, __rest}`), and its
// sampler answers the base pose's rotation TIMES a constant delta - a
// rotation about the bone's own axes, on top of whatever the idle is
// doing. The arm keeps breathing; the hands come up.
//
// WHY DELTAS AND NOT ABSOLUTE ROTATIONS. An absolute local rotation is
// a number about ONE skeleton's rest frames; retail's xbase_anim.1st
// and the fixtures' armfp do not share them. "Bend the left forearm
// forty degrees more" means the same thing on both. The default deltas
// are ZERO: the session had the fixture arm only, and the pose is tuned
// on the retail arm through the live surface the host exposes
// (window.__heldPose - bible/10-UI/Held-Map-Arc.md, MAP3).
//
// QUATERNIONS ARE [w, x, y, z] HERE, because they are everywhere the
// rig reads them: mwAnim.js's sampler answers [w,x,y,z] and mwSkin.js's
// quatToMat33 destructures `[w, x, y, z]`. AUDIT-MAP2 found the first
// draft packed [x,y,z,w] - a 40-degree bend about X reached the rig as
// a 140-degree turn about Z.
//
// THE PAPER is a rigid piece like the weapon and the torch (a `source`
// of vertices placed by an attachment transform each frame), but its
// attachment is the RIG ROOT rather than a hand bone: it is put where
// the eye is looking, at arm's length, and the hands are posed to it,
// so the sheet is still whatever the arms do. Its picture is NOT here:
// the ink stays a DOM canvas at full resolution, laid over the quad's
// projected corners by ui/quadMap.js; the piece is the parchment under
// it - a flat, lit, parchment-coloured quad the thumbs can rest on.
// ═══════════════════════════════════════════════════════════════════

import { transformPoint } from '../world/mat4.js';

/** Morrowind's own scale: MW_UNITS_PER_METER (formats/mwFirstPerson.js). */
const UNITS_PER_METRE = 69.99;

/**
 * The pose, in DEGREES about each bone's own axes, applied after the
 * idle's rotation - and the paper, in metres from the eye. Bone names
 * are the first-person skeleton's own (formats/mwNpc.js PART_BONES),
 * lowercased as the track map keys them.
 */
export const HELD_POSE_DEFAULT = Object.freeze({
  bones: Object.freeze({
    'left upper arm': Object.freeze([0, 0, 0]),
    'left forearm': Object.freeze([0, 0, 0]),
    'left hand': Object.freeze([0, 0, 0]),
    'right upper arm': Object.freeze([0, 0, 0]),
    'right forearm': Object.freeze([0, 0, 0]),
    'right hand': Object.freeze([0, 0, 0]),
  }),
  paper: Object.freeze({
    width: 0.46,      // metres across
    forward: 0.42,    // metres in front of the eye
    drop: 0.14,       // metres below the eye
    tilt: 22,         // degrees the sheet leans back (top away from the eye)
    colour: Object.freeze([0.80, 0.68, 0.47]),   // parchment, lit by the pass
  }),
});

/** The bones a held pose may name: the two arms, hands to clavicles,
 *  in the part-attach names (mwNpc.js PART_BONES, lowercased). */
export const HELD_BONES = Object.freeze([
  'left clavicle', 'left upper arm', 'left forearm', 'left wrist', 'left hand',
  'right clavicle', 'right upper arm', 'right forearm', 'right wrist', 'right hand',
]);
/** AUDIT-MAP2: retail skeletons carry BOTH families - the animated
 *  `Bip01 L Forearm` and, under it, the part-attach node `Left Forearm`
 *  the .kf never keys. A delta on the attach node would turn the forearm
 *  mesh and leave the hand (a child of the Bip01 bone, not of the attach
 *  node) where it was. So a named bone resolves to whichever of its two
 *  spellings the CLIP keys, then to whichever the skeleton has - the
 *  fixture rig keys the attach names, retail keys the Bip01 ones. */
export const HELD_BONE_ALIASES = Object.freeze({
  'left clavicle': 'bip01 l clavicle', 'left upper arm': 'bip01 l upperarm', 'left forearm': 'bip01 l forearm', 'left hand': 'bip01 l hand',
  'right clavicle': 'bip01 r clavicle', 'right upper arm': 'bip01 r upperarm', 'right forearm': 'bip01 r forearm', 'right hand': 'bip01 r hand',
});
export function resolveHeldBone(name, base, skeleton) {
  const key = String(name).toLowerCase();
  const alias = HELD_BONE_ALIASES[key];
  const names = alias ? [key, alias] : [key];
  const has = (n) => skeleton?.byName?.get(n) != null;
  return names.find((n) => base?.has?.(n) && has(n)) ?? names.find(has) ?? null;
}

// ── QUATERNIONS ([w, x, y, z], Hamilton - the rig's own packing) ──
export const QUAT_IDENTITY = Object.freeze([1, 0, 0, 0]);
export function quatMul(a, b) {
  const [aw, ax, ay, az] = a, [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}
export function quatAxis(axis, deg) {
  const h = deg * Math.PI / 360;
  const s = Math.sin(h), c = Math.cos(h);
  return axis === 0 ? [c, s, 0, 0] : axis === 1 ? [c, 0, s, 0] : [c, 0, 0, s];
}
/** X, then Y, then Z, each about the bone's own (already rotated) axes.
 *  @param {number[]} e degrees about X, Y, Z */
export function quatFromEulerDeg(e) {
  return quatMul(quatMul(quatAxis(0, e[0] ?? 0), quatAxis(1, e[1] ?? 0)), quatAxis(2, e[2] ?? 0));
}
/** A 3x3 (row-major, as mwSkin keeps a node's rest rotation) to a
 *  [w, x, y, z] quaternion - the algebraic inverse of mwSkin's quatToMat33. */
export function mat33ToQuat(m) {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  return [w, x, y, z];
}
const isZero = (e) => !e || (Math.abs(e[0]) < 1e-9 && Math.abs(e[1]) < 1e-9 && Math.abs(e[2]) < 1e-9);

// ── THE TRACKS ───────────────────────────────────────────────────

/**
 * The idle's track map with the held bones wrapped: `{__delta, __base,
 * __rest}` per posed bone - the delta quaternion, the base track (or
 * null), and the bone's rest rotation as a quaternion for a bone the
 * clip never keys. Every other bone is the base track, untouched. One
 * Map per (base, spec, skeleton) - the caller memoises it, as the
 * torch's overlay is memoised, so a frame allocates nothing.
 * @param {Map<string, any>|null} base
 * @param {{bones?: Record<string, number[]>}} spec
 * @param {{byName?: Map<string, any>, nodes?: Map<any, any>}|null} skeleton
 */
export function deltaTracks(base, spec, skeleton) {
  const out = new Map(base ?? []);
  const bones = spec?.bones ?? {};
  for (const name of Object.keys(bones)) {
    if (isZero(bones[name])) continue;   // a zero delta leaves the idle alone
    const key = resolveHeldBone(name, base, skeleton);
    const ref = key != null ? skeleton?.byName?.get(key) : null;
    const node = ref != null ? skeleton?.nodes?.get(ref) : null;
    if (!node) continue;                 // a bone this skeleton does not have (under either name) is not posed
    out.set(key, {
      __delta: quatFromEulerDeg(bones[name]),
      __base: base?.get(key) ?? null,
      __rest: node.rest?.rotation ? mat33ToQuat(node.rest.rotation) : [...QUAT_IDENTITY],
    });
  }
  return out;
}

/**
 * The sampler: a wrapped bone answers the base rotation (the clip's at
 * `time`, or the rest) TIMES the delta - the delta turns the bone about
 * its own axes on top of the idle - with the base's translation and
 * scale; an unwrapped track is sampled as it always was.
 */
export function heldSampler(sampleTrack) {
  return (track, time) => {
    if (!track || !track.__delta) return sampleTrack(track, time);
    const base = track.__base ? sampleTrack(track.__base, time) : null;
    const q = base?.rotation ?? track.__rest;
    return { rotation: quatMul(q, track.__delta), translation: base?.translation ?? null, scale: base?.scale ?? null };
  };
}

// ── THE PAPER ────────────────────────────────────────────────────

/**
 * The sheet's four corners in RIG space (Z up, the actor faces +Y):
 * centred `forward` metres ahead of the eye and `drop` below it, `width`
 * across, `width / aspect` tall, leaning back by `tilt` about the
 * sheet's own horizontal. Order: top-left, top-right, bottom-right,
 * bottom-left, as the eye sees them (the actor's left is -X).
 * @param {number[]} eye the camera node's rig-space translation
 * @param {{width: number, forward: number, drop: number, tilt: number}} paper
 * @param {number} aspect width / height of the sheet
 */
export function paperCornersRig(eye, paper, aspect) {
  const w = paper.width * UNITS_PER_METRE;
  const h = w / (aspect > 0 ? aspect : 1.6);
  const t = (paper.tilt ?? 0) * Math.PI / 180;
  const cx = eye[0], cy = eye[1] + paper.forward * UNITS_PER_METRE, cz = eye[2] - paper.drop * UNITS_PER_METRE;
  // the sheet's up vector leans back: up = (0, sin t, cos t)
  const uy = Math.sin(t), uz = Math.cos(t);
  const at = (sx, sv) => [cx + sx * w / 2, cy + sv * (h / 2) * uy, cz + sv * (h / 2) * uz];
  return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
}

/**
 * The rigid piece the rig packs and draws: two triangles, parchment
 * coloured, attached to the rig root (`attachRef` null - the identity
 * transform), so its `source` IS its rig-space position. The UVs run
 * the sheet's way (u across, v down from the top-left) so a texture,
 * if one is ever hung on it, reads upright. ONE winding, the one whose
 * flat normal faces the eye (-Y of the sheet): the character pass draws
 * with culling off, so a second winding would only be a coplanar twin
 * fighting the first for the depth buffer with its normal turned away
 * (AUDIT-MAP2).
 */
export function paperPiece(eye, paper, aspect) {
  const c = paperCornersRig(eye, paper, aspect);
  const source = new Float32Array(12);
  c.forEach((p, i) => { source[i * 3] = p[0]; source[i * 3 + 1] = p[1]; source[i * 3 + 2] = p[2]; });
  return {
    slot: 'paper', bone: null, kind: 'rigid', mirrored: false, tag: null,
    batch: null, source, attachRef: null, boneOffset: null,
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    colors: null,
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
    material: { diffuse: [...(paper.colour ?? HELD_POSE_DEFAULT.paper.colour)], vertexColorMode: 0, textureFile: null, clampMode: 3, alphaTest: false },
    positions: new Float32Array(12),
  };
}

/** Write the sheet's corners for a new eye into a piece's source in
 *  place (the eye moves with the neck; the sheet follows it - AUDIT-MAP2).
 *  @returns {number} the farthest corner's distance from the eye, rig units */
export function refreshPaperSource(piece, eye, paper, aspect) {
  const c = paperCornersRig(eye, paper, aspect);
  let far = 0;
  c.forEach((p, i) => {
    piece.source[i * 3] = p[0]; piece.source[i * 3 + 1] = p[1]; piece.source[i * 3 + 2] = p[2];
    const d = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
    if (d > far) far = d;
  });
  return far;
}

/**
 * Where the sheet's corners land on the composite: the piece's posed
 * positions through the pass's own model, view and projection (the
 * same three the rig draws with), to NDC, to CSS pixels of the rect the
 * composite covers. Null when any corner is behind the lens.
 * @param {Float32Array} positions the piece's posed rig-space vertices (12 floats)
 * @param {{model: Float32Array, view: Float32Array, proj: Float32Array}} cam
 * @param {{x: number, y: number, w: number, h: number}} rect
 */
export function projectPaperCorners(positions, cam, rect) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = transformPoint(cam.model, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    const v = cam.view, p = cam.proj;
    const vx = v[0] * x + v[4] * y + v[8] * z + v[12];
    const vy = v[1] * x + v[5] * y + v[9] * z + v[13];
    const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    if (!(cw > 1e-6)) return null;
    const cx = (p[0] * vx + p[4] * vy + p[8] * vz + p[12]) / cw;
    const cy = (p[1] * vx + p[5] * vy + p[9] * vz + p[13]) / cw;
    out.push([rect.x + (cx * 0.5 + 0.5) * rect.w, rect.y + (1 - (cy * 0.5 + 0.5)) * rect.h]);
  }
  return out;
}

/** A pose spec merged over `base` (the pose in force, or the default):
 *  unknown bones dropped, numbers coerced, so a hand-typed tuning cannot
 *  leave the rig with a NaN - and a PARTIAL spec (one bone, or the paper
 *  alone) changes only what it names, which is how the door is used. */
export function normaliseHeldPose(spec, base = HELD_POSE_DEFAULT) {
  const bones = {};
  for (const name of HELD_BONES) {
    const e = spec?.bones?.[name] ?? base?.bones?.[name] ?? HELD_POSE_DEFAULT.bones[name];
    if (!e) continue;
    bones[name] = [0, 1, 2].map((i) => (Number.isFinite(+e[i]) ? +e[i] : 0));
  }
  const d = { ...HELD_POSE_DEFAULT.paper, ...(base?.paper ?? {}) };
  const p = spec?.paper ?? {};
  const num = (v, fb) => (Number.isFinite(+v) ? +v : fb);
  const colour = Array.isArray(p.colour) && p.colour.length === 3 ? p.colour.map((v, i) => num(v, d.colour[i])) : [...d.colour];
  return {
    bones,
    paper: { width: num(p.width, d.width), forward: num(p.forward, d.forward), drop: num(p.drop, d.drop), tilt: num(p.tilt, d.tilt), colour },
  };
}
