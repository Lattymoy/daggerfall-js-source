// @ts-check
// MWNPC1 (2026-10-09, Mac: "I wanna do everything and ensure that performance isnt affected"): THE SKIN ON THE
// GPU. Every Morrowind body in the world - the player's third-person body, every other player's, the family's, the
// card table's, and the NPCs the MW-NPC arc stands after it (bible/04-Characters/Morrowind-NPCs.md) - was skinned
// on the CPU per body per posed frame: poseAssembly blended every vertex of every skinned piece and placed every
// rigid one (mwSkin.js skinBatch, mwFirstPerson.js placeAtBone), packFpArm de-indexed the whole stream with a cross
// product per face, and updateCharacterMesh re-uploaded all of it. PERF-RIG1 costed that at ~0.3 ms a body at
// 3,000 vertices on the fixture rig, more on a clothed retail body, and paid per body; every page of
// 07-Rendering/Performance-Rig.md since ends on the same open item - "the real answer is GPU skinning (bone
// matrices as uniforms, the blend in the vertex shader, the static stream uploaded once)". This is that.
//
// THE SPLIT. What never changes for the life of a built body is laid out ONCE (skinLayout, packSkinStream): the
// corner stream in packFpArm's own order - the authored vertex, its diffuse, UV and emission (the pack's static
// lanes, through the pass's own colour laws: `lanesOf` IS fpArm.js pieceLanes), and its INFLUENCES: which palette
// entries blend it and by how much, and which entry is its post. What a pose changes is the PALETTE alone
// (writeSkinPalette): an affine per bone a skinned piece names, one per rigid placement, one post per skinned
// piece - kilobytes, where the CPU path re-uploaded the whole stream.
//
// THE LAW IS THE CPU SKIN'S, entry for entry, so a body drawn either way stands in the same place:
//   - a skinned vertex is post o (SUM w_b * (skelMat_b o invBind_b)) applied once (MW-D31): the per-bone product is
//     the same affineMulInto skinBatch calls, the blend accumulates in BONE order (the order skinBatch's loop adds
//     in), and the post is mwSkin.js skinPost - one home for both;
//   - an influence naming a MISSING bone (rule 40) is skipped and nothing is renormalised (rule 39); a vertex
//     touched only by missing bones (or by weights of zero) blends to zero and lands on the post's translation - the
//     reference's collapse, skinBatch's `collapse`; a vertex no bone touches keeps its authored position, which is
//     an influence of one on entry 0 (the identity) with an identity post;
//   - a rigid piece's mirror and BoneOffset (rule 13, rule 14) are facts about the FILE, fixed at bind, so they are
//     baked into its stream positions here, and its entry is the placement placeAtBone applies - the bone's
//     attachment affine, or hangAffine's for a part that hangs (HT-WAIST). The products are placeAtBone's own.
// The face normal is NOT in the stream: packFpArm writes each triangle's cross product of the POSED corners, which
// a vertex cannot know. The fragment shader takes it off the triangle's own screen derivatives instead
// (renderer.js skinFaceFs) - the same plane, exactly, because a position varying is linear across its triangle.
//
// WHAT THE CPU SKIN STILL DOES. The first-person arm keeps it (one body, drawn lens-local, its held sheet and
// its muzzle read posed vertices every frame), and so does any body this layout refuses: a vertex blended by more
// influences than the shader carries (SKIN_MAX_INFLUENCES), which rule 39 forbids trimming. The refusal is a
// sentence, kept on the rig's notes.
//
// THE BOXES. The sprite law frames a body by its posed boxes (fpArm.js drawThird, PR-BOW1), and with no CPU skin
// there are no posed vertices to fold. Rule 42 is the reference's own answer - a skinned mesh's bounds come from its
// BONES, never from posed vertices - and writeSkinPalette takes it: each piece keeps, per palette entry, the box of
// the authored vertices that entry moves, and a pose carries those boxes through their entries (a box through an
// affine is a box, centre and extent). The blend of points inside boxes lies inside their hull, scaled by the
// weights' sum, so the union is a CONSERVATIVE box - never smaller than the fold it replaces. The box is the
// sprite's window, never its size (PR-BOW1: a texel stays MW_ARM_PIXEL screen pixels however large the window), so
// a looser box draws the same picture with more margin. A portrait that frames ITSELF by the box (fpArm.js
// figure) poses on the CPU for its exact fold, once, and draws through the palette.

import { skinPost, affineMulInto } from './mwSkin.js';
import { hangAffine } from './mwFirstPerson.js';
import { SKIN_PAL_ROW } from '../render/skinPalette.js';   // the palette's shape, one home

export { SKIN_PAL_ROW };

/** The influences a vertex may carry: two vec4 pairs. More is refused, never trimmed (rule 39). */
export const SKIN_MAX_INFLUENCES = 8;
/** The corner's static floats: position 3, diffuse 3, UV 2, emission 3 - packFpArm's lanes less its normal. */
export const SKIN_STATIC_FLOATS = 11;
/** Floats a corner for `pairs` influence pairs: the static eleven, four indices and four weights a pair, the post. */
export const skinStreamFloats = (pairs) => SKIN_STATIC_FLOATS + 8 * pairs + 1;

const IDENTITY = Object.freeze({ a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: Object.freeze([0, 0, 0]) });

/** The pieces a stream draws, in packFpArm's order and by its test (positions AND indices). */
const drawable = (p) => !!(p && p.positions && p.indices);

/**
 * THE LAYOUT: every palette entry a body's pieces name, and every vertex's influences in them. Pure, and made once
 * per built body (a weapon or torch swap that hands the rig new pieces makes a new one - skinSamePieces).
 *
 * Entry 0 is the identity. Then per drawable piece, in order: a skinned piece takes its POST, then one entry per
 * bone its skin names (a missing bone - ref null - takes none); a rigid piece takes its PLACEMENT.
 *
 * @returns {{ok:true, entries:number, pairs:number, most:number, width:number, height:number,
 *   rows:object[], pieces:object[], byPiece:Map<object, object>, palette:Float32Array}
 *   | {ok:false, reason:string}}
 */
export function skinLayout(pieces) {
  let next = 1;
  let most = 1;
  const rows = [];
  const list = [];
  for (const p of pieces ?? []) {
    if (!drawable(p)) continue;
    list.push(p);
    if (p.kind === 'skinned') {
      const batch = p.batch;
      const skin = batch && batch.skin;
      if (!skin || !batch.positions) return { ok: false, reason: `${p.slot}: a skinned piece with no skin to blend` };
      const n = batch.positions.length / 3;
      const post = next++;
      const boneEntry = new Int32Array(skin.bones.length).fill(-1);
      for (let j = 0; j < skin.bones.length; j++) if (skin.bones[j].ref != null) boneEntry[j] = next++;
      // pass 1: per vertex, the influences that blend (a live bone, a weight that is not zero) and whether any
      // influence touched it at all - the two cases skinBatch tells apart (rule 39's untouched, rule 40's collapse)
      const count = new Uint8Array(n);
      const touched = new Uint8Array(n);
      let negative = false;
      for (let j = 0; j < skin.bones.length; j++) {
        const bone = skin.bones[j];
        for (let k = 0; k < bone.indices.length; k++) {
          const v = bone.indices[k];
          touched[v] = 1;
          if (boneEntry[j] < 0 || bone.weights[k] === 0) continue;
          if (bone.weights[k] < 0) negative = true;
          if (count[v] < 255) count[v]++;
        }
      }
      let k8 = 1;
      for (let v = 0; v < n; v++) if (count[v] > k8) k8 = count[v];
      if (k8 > SKIN_MAX_INFLUENCES) {
        return { ok: false, reason: `${p.slot}: a vertex blended by ${k8} bones - the shader carries ${SKIN_MAX_INFLUENCES}, and rule 39 forbids trimming` };
      }
      if (k8 > most) most = k8;
      // pass 2: the influences, in BONE order - the order skinBatch's loop accumulates in
      const infE = new Int32Array(n * SKIN_MAX_INFLUENCES);
      const infW = new Float32Array(n * SKIN_MAX_INFLUENCES);
      const postE = new Int32Array(n);
      const fill = new Uint8Array(n);
      const wsum = new Float64Array(n);
      for (let j = 0; j < skin.bones.length; j++) {
        if (boneEntry[j] < 0) continue;
        const bone = skin.bones[j];
        for (let k = 0; k < bone.indices.length; k++) {
          const w = bone.weights[k];
          if (w === 0) continue;
          const v = bone.indices[k];
          const s = v * SKIN_MAX_INFLUENCES + fill[v]++;
          infE[s] = boneEntry[j];
          infW[s] = w;
          wsum[v] += w;
        }
      }
      // the boxes rule 42 carries: per bone entry, the authored vertices it moves; the untouched ones on entry 0
      const pos = batch.positions;
      const boxes = new Map();
      const untouched = emptyBox();
      let collapse = false;
      let wMin = Infinity, wMax = -Infinity;
      for (let v = 0; v < n; v++) {
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        if (!touched[v]) {
          infE[v * SKIN_MAX_INFLUENCES] = 0;
          infW[v * SKIN_MAX_INFLUENCES] = 1;
          postE[v] = 0;
          grow(untouched, x, y, z);
          continue;
        }
        postE[v] = post;
        if (fill[v] === 0) { collapse = true; continue; }
        if (wsum[v] < wMin) wMin = wsum[v];
        if (wsum[v] > wMax) wMax = wsum[v];
        for (let s = 0; s < fill[v]; s++) {
          const e = infE[v * SKIN_MAX_INFLUENCES + s];
          let b = boxes.get(e);
          if (!b) boxes.set(e, (b = emptyBox()));
          grow(b, x, y, z);
        }
      }
      rows.push({ piece: p, kind: 'skinned', n, post, boneEntry, pos, infE, infW, postE,
        boxes, untouched: untouched.minX <= untouched.maxX ? untouched : null, collapse, negative,
        wMin: Number.isFinite(wMin) ? wMin : 1, wMax: Number.isFinite(wMax) ? wMax : 1 });
    } else {
      const src = p.source;
      if (!src) return { ok: false, reason: `${p.slot}: a rigid piece with no authored positions` };
      const n = src.length / 3;
      const entry = next++;
      // rule 13 + rule 14, baked: placeAtBone's own (mirror ? -x : x) + offset, in its order
      const o = p.boneOffset;
      const ox = o ? o[0] : 0, oy = o ? o[1] : 0, oz = o ? o[2] : 0;
      const pos = new Float32Array(src.length);
      const box = emptyBox();
      for (let v = 0; v < src.length; v += 3) {
        pos[v] = (p.mirrored ? -src[v] : src[v]) + ox;
        pos[v + 1] = src[v + 1] + oy;
        pos[v + 2] = src[v + 2] + oz;
        grow(box, pos[v], pos[v + 1], pos[v + 2]);
      }
      const infE = new Int32Array(n * SKIN_MAX_INFLUENCES);
      const infW = new Float32Array(n * SKIN_MAX_INFLUENCES);
      for (let v = 0; v < n; v++) { infE[v * SKIN_MAX_INFLUENCES] = entry; infW[v * SKIN_MAX_INFLUENCES] = 1; }
      rows.push({ piece: p, kind: 'rigid', n, entry, pos, infE, infW, postE: new Int32Array(n),
        boxes: new Map(n ? [[entry, box]] : []), untouched: null, collapse: false, negative: false, wMin: 1, wMax: 1 });
    }
  }
  if (!list.length) return { ok: false, reason: 'no drawable piece' };
  const entries = next;
  const width = 3 * Math.min(entries, SKIN_PAL_ROW);
  const height = Math.ceil(entries / SKIN_PAL_ROW);
  const palette = new Float32Array(width * height * 4);
  const byPiece = new Map(rows.map((r) => [r.piece, r]));
  return { ok: true, entries, pairs: most > 4 ? 2 : 1, most, width, height, rows, pieces: list, byPiece, palette };
}

/** True when `layout` was laid out of exactly these drawable pieces, in order - packFpArm's sameRanges question. */
export function skinSamePieces(layout, pieces) {
  if (!layout || !layout.ok) return false;
  let k = 0;
  for (const p of pieces ?? []) {
    if (!drawable(p)) continue;
    if (layout.pieces[k++] !== p) return false;
  }
  return k === layout.pieces.length;
}

/**
 * THE STATIC STREAM, once per layout: packFpArm's corner order (every triangle of every drawable piece, its three
 * corners in index order) and its ranges, one per piece, in the same shape - so hangRangeTextures, the rule 57
 * flags, foldRangeBoxes and every reader of a range read this mesh as they read the packed one. `lanesOf(piece)`
 * answers the eight static floats a corner (fpArm.js pieceLanes - the colour laws' one home).
 *
 * A corner: position 3, diffuse 3, UV 2, emission 3, then per influence pair four entry indices and four weights,
 * then the post's entry. Indices travel as floats - exact below 2^24, far past any palette.
 */
export function packSkinStream(layout, lanesOf) {
  const floats = skinStreamFloats(layout.pairs);
  const slots = 4 * layout.pairs;
  let corners = 0;
  for (const r of layout.rows) corners += Math.floor(r.piece.indices.length / 3) * 3;
  const stream = new Float32Array(corners * floats);
  const ranges = [];
  let o = 0;
  let first = 0;
  for (const r of layout.rows) {
    const p = r.piece;
    const idx = p.indices;
    const lanes = lanesOf(p);
    const textured = !!(p.uvs && p.material && p.material.textureFile);
    let l = 0;
    for (let i = 0; i + 2 < idx.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = idx[i + k];
        stream[o++] = r.pos[v * 3]; stream[o++] = r.pos[v * 3 + 1]; stream[o++] = r.pos[v * 3 + 2];
        stream[o++] = lanes[l]; stream[o++] = lanes[l + 1]; stream[o++] = lanes[l + 2];
        stream[o++] = lanes[l + 3]; stream[o++] = lanes[l + 4];
        stream[o++] = lanes[l + 5]; stream[o++] = lanes[l + 6]; stream[o++] = lanes[l + 7];
        l += 8;
        const base = v * SKIN_MAX_INFLUENCES;
        for (let pr = 0; pr < layout.pairs; pr++) {
          for (let s = 0; s < 4; s++) stream[o++] = r.infE[base + pr * 4 + s];
          for (let s = 0; s < 4; s++) stream[o++] = r.infW[base + pr * 4 + s];
        }
        stream[o++] = r.postE[v];
      }
    }
    const count = Math.floor(idx.length / 3) * 3;   // the corners written - a whole triangle list, as every retail piece is
    ranges.push({ first, count, slot: p.slot, piece: p, textureFile: textured ? p.material.textureFile : null, tex: null, hidden: false });
    first += count;
  }
  if (o !== stream.length) throw new Error(`MWNPC1: the skin stream wrote ${o} of ${stream.length} floats (${slots} slots a corner)`);
  return { stream, floats, ranges };
}

/** Write one affine into palette entry `e`: three texels, rows [a0 a1 a2 t0] [a3 a4 a5 t1] [a6 a7 a8 t2]. */
function putEntry(pal, e, m) {
  const o = e * 12;
  const a = m.a, t = m.t;
  pal[o] = a[0]; pal[o + 1] = a[1]; pal[o + 2] = a[2]; pal[o + 3] = t[0];
  pal[o + 4] = a[3]; pal[o + 5] = a[4]; pal[o + 6] = a[5]; pal[o + 7] = t[1];
  pal[o + 8] = a[6]; pal[o + 9] = a[7]; pal[o + 10] = a[8]; pal[o + 11] = t[2];
}

/** Read palette entry `e` back as an affine (into `out`). */
function getEntry(pal, e, out) {
  const o = e * 12;
  out.a[0] = pal[o]; out.a[1] = pal[o + 1]; out.a[2] = pal[o + 2]; out.t[0] = pal[o + 3];
  out.a[3] = pal[o + 4]; out.a[4] = pal[o + 5]; out.a[5] = pal[o + 6]; out.t[1] = pal[o + 7];
  out.a[6] = pal[o + 8]; out.a[7] = pal[o + 9]; out.a[8] = pal[o + 10]; out.t[2] = pal[o + 11];
  return out;
}

const _bone = { a: new Float32Array(9), t: [0, 0, 0] };

/**
 * THE POSE: every entry of the layout's palette for the skeleton `assembly` was last posed in (poseAssembly, with or
 * without its CPU skin - `assembly.pose` and `assembly.mats` are this frame's either way). When the CPU did NOT skin
 * this pose (`assembly.cpuSkinned === false`), each drawn piece's `box` and the assembly's `bounds` are written off
 * the palette (rule 42, the header); when it did, its exact fold stands. Answers the palette.
 */
export function writeSkinPalette(layout, assembly, pal = layout.palette) {
  const { skeleton, pose, mats, fns } = assembly;
  putEntry(pal, 0, IDENTITY);
  for (const r of layout.rows) {
    const p = r.piece;
    if (r.kind === 'skinned') {
      const skin = p.batch.skin;
      putEntry(pal, r.post, skinPost(skin, skeleton, pose));
      for (let j = 0; j < skin.bones.length; j++) {
        if (r.boneEntry[j] < 0) continue;
        const bone = skin.bones[j];
        putEntry(pal, r.boneEntry[j], affineMulInto(mats.get(bone.ref), bone.invBind, _bone));
      }
    } else {
      const at = fns.attachmentTransform(mats, p.attachRef);
      putEntry(pal, r.entry, p.hang ? hangAffine(at, p.hang) : at);
    }
  }
  if (assembly.cpuSkinned === false) assembly.bounds = skinBoxes(layout, pal);
  return pal;
}

// ---- the boxes (rule 42) -------------------------------------------------

function emptyBox() { return { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity }; }
function grow(b, x, y, z) {
  if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
  if (z < b.minZ) b.minZ = z; if (z > b.maxZ) b.maxZ = z;
}
function unionInto(out, b) {
  if (b.minX < out.minX) out.minX = b.minX; if (b.maxX > out.maxX) out.maxX = b.maxX;
  if (b.minY < out.minY) out.minY = b.minY; if (b.maxY > out.maxY) out.maxY = b.maxY;
  if (b.minZ < out.minZ) out.minZ = b.minZ; if (b.maxZ > out.maxZ) out.maxZ = b.maxZ;
}
/** A box through an affine: its centre through the affine, its half-extent through the affine's absolute 3x3. */
function boxThrough(m, b, out) {
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, cz = (b.minZ + b.maxZ) / 2;
  const hx = (b.maxX - b.minX) / 2, hy = (b.maxY - b.minY) / 2, hz = (b.maxZ - b.minZ) / 2;
  const a = m.a, t = m.t;
  const x = a[0] * cx + a[1] * cy + a[2] * cz + t[0];
  const y = a[3] * cx + a[4] * cy + a[5] * cz + t[1];
  const z = a[6] * cx + a[7] * cy + a[8] * cz + t[2];
  const ex = Math.abs(a[0]) * hx + Math.abs(a[1]) * hy + Math.abs(a[2]) * hz;
  const ey = Math.abs(a[3]) * hx + Math.abs(a[4]) * hy + Math.abs(a[5]) * hz;
  const ez = Math.abs(a[6]) * hx + Math.abs(a[7]) * hy + Math.abs(a[8]) * hz;
  out.minX = x - ex; out.maxX = x + ex; out.minY = y - ey; out.maxY = y + ey; out.minZ = z - ez; out.maxZ = z + ez;
  return out;
}
/** The blend's hull scaled by every weight sum in [lo, hi]: a linear function of the scale is extreme at its ends. */
function scaleHull(b, lo, hi) {
  const out = emptyBox();
  for (const s of [lo, hi]) {
    grow(out, b.minX * s, b.minY * s, b.minZ * s);
    grow(out, b.maxX * s, b.maxY * s, b.maxZ * s);
  }
  return out;
}

const _m = { a: new Float32Array(9), t: [0, 0, 0] };
const _post = { a: new Float32Array(9), t: [0, 0, 0] };
const _tb = emptyBox();

/** Each drawn piece's posed box off the palette, written to `piece.box` (the object foldPieceBounds keeps there);
 *  answers their union, or null when nothing is drawn. */
function skinBoxes(layout, pal) {
  const all = emptyBox();
  for (const r of layout.rows) {
    let hull = emptyBox();
    for (const [e, b] of r.boxes) unionInto(hull, boxThrough(getEntry(pal, e, _m), b, _tb));
    const box = emptyBox();
    if (r.kind === 'skinned') {
      if (hull.minX <= hull.maxX) {
        if (r.negative) {
          // a negative weight leaves the hull: every coordinate is within (sum |w|) x the farthest corner. Bounded by
          // eight influences of at most |w| each, read off the corners' own magnitude - loose, and never smaller.
          const reach = Math.max(Math.abs(hull.minX), Math.abs(hull.maxX), Math.abs(hull.minY), Math.abs(hull.maxY),
            Math.abs(hull.minZ), Math.abs(hull.maxZ)) * SKIN_MAX_INFLUENCES * Math.max(Math.abs(r.wMin), Math.abs(r.wMax), 1);
          hull = { minX: -reach, minY: -reach, minZ: -reach, maxX: reach, maxY: reach, maxZ: reach };
        } else if (r.wMin !== 1 || r.wMax !== 1) {
          hull = scaleHull(hull, Math.min(r.wMin, 1), Math.max(r.wMax, 1));
        }
        unionInto(box, boxThrough(getEntry(pal, r.post, _post), hull, _tb));
      }
      if (r.collapse) { getEntry(pal, r.post, _post); grow(box, _post.t[0], _post.t[1], _post.t[2]); }
      if (r.untouched) unionInto(box, r.untouched);
    } else {
      unionInto(box, hull);
    }
    const p = r.piece;
    const out = p.box || (p.box = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 });
    out.minX = box.minX; out.minY = box.minY; out.minZ = box.minZ; out.maxX = box.maxX; out.maxY = box.maxY; out.maxZ = box.maxZ;
    if (box.minX <= box.maxX) unionInto(all, box);
  }
  return all.minX <= all.maxX ? { minX: all.minX, minY: all.minY, minZ: all.minZ, maxX: all.maxX, maxY: all.maxY, maxZ: all.maxZ } : null;
}

// ---- the shader's law, in JS ---------------------------------------------

const _acc = new Float32Array(12);
const _cmp = new Float32Array(12);

/**
 * ONE vertex by the vertex shader's law (renderer.js CHAR_SKIN_VS skinned()): the influences' rows accumulated in
 * slot order, the post composed onto the sum, the result applied to the stream position. For the readers that ask
 * for ONE posed point of a GPU-skinned body - the third-person muzzle (fpArm.js weaponMuzzle) - and for the pins,
 * which hold this law against skinBatch and placeAtBone. Null when the piece is not in the layout.
 */
export function skinnedVertex(layout, piece, v, pal = layout.palette, out = [0, 0, 0]) {
  const r = layout.byPiece.get(piece);
  if (!r || v < 0 || v >= r.n) return null;
  const base = v * SKIN_MAX_INFLUENCES;
  const slots = new Array(SKIN_MAX_INFLUENCES);
  for (let s = 0; s < SKIN_MAX_INFLUENCES; s++) slots[s] = [r.infE[base + s], r.infW[base + s]];
  return skinPoint(pal, slots, r.postE[v], r.pos[v * 3], r.pos[v * 3 + 1], r.pos[v * 3 + 2], out);
}

/**
 * The stream's corner `c` by the shader's law - read off the STREAM exactly as the vertex attributes are, so a pin
 * holds the packing and the law together.
 */
export function skinStreamCorner(stream, floats, pairs, c, pal, out = [0, 0, 0]) {
  const o = c * floats;
  const slots = [];
  for (let pr = 0; pr < pairs; pr++) {
    for (let s = 0; s < 4; s++) slots.push([stream[o + SKIN_STATIC_FLOATS + pr * 8 + s], stream[o + SKIN_STATIC_FLOATS + pr * 8 + 4 + s]]);
  }
  return skinPoint(pal, slots, stream[o + floats - 1], stream[o], stream[o + 1], stream[o + 2], out);
}

function skinPoint(pal, slots, postEntry, x, y, z, out) {
  _acc.fill(0);
  for (const [e, w] of slots) {
    const o = Math.round(e) * 12;
    for (let i = 0; i < 12; i++) _acc[i] += pal[o + i] * w;
  }
  // composed = post o acc: rows [a | t], the post's 3x3 times the accumulated rows, its translation added once
  const q = Math.round(postEntry) * 12;
  for (let row = 0; row < 3; row++) {
    const p0 = pal[q + row * 4], p1 = pal[q + row * 4 + 1], p2 = pal[q + row * 4 + 2], pt = pal[q + row * 4 + 3];
    for (let col = 0; col < 4; col++) {
      _cmp[row * 4 + col] = p0 * _acc[col] + p1 * _acc[4 + col] + p2 * _acc[8 + col] + (col === 3 ? pt : 0);
    }
  }
  out[0] = _cmp[0] * x + _cmp[1] * y + _cmp[2] * z + _cmp[3];
  out[1] = _cmp[4] * x + _cmp[5] * y + _cmp[6] * z + _cmp[7];
  out[2] = _cmp[8] * x + _cmp[9] * y + _cmp[10] * z + _cmp[11];
  return out;
}
