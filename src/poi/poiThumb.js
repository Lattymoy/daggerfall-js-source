// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-4b (2026-10-14) - A LIBRARY ENTRY'S PICTURE: ITS PARTS DRAWN SMALL, AND WRITTEN AS A PNG.
//
// Mac: "the ability to import models ... I want this to be a tool my developers can use without having to access the
// codebase" (bible/06-Systems/POI-Editor-Arc.md POI-4b). The library's shelf shows each model as a picture, made by the
// editor as the model is shelved - from the meshes and pictures it already holds - and stored as a texture asset by its
// hash. Drawn here in software, not by the game's renderer: no GL context to borrow, and the same numbers draw the same
// picture in a test and in every browser.
//
//   - `renderThumb(pieces, { size })`: every piece (a part's mesh, its place in the model - T * R * S, Unity's order,
//     world/quat.js - and its materials) seen from the model's front, a little to its right and above, ORTHOGRAPHIC, framed
//     on what is drawn; a depth buffer; the faces turned away culled (a two-sided material's kept, lit from its own side);
//     each pixel its material's colour times its picture (sampled where its UVs fall, wrapped as the material wraps, its
//     UV transform applied - poi/gltfImport.js applyTextureTransform, as poi/poiRuntime.js draws it) lit by a key and a
//     fill light over an ambient; a cutout's pixels below its cut dropped, a see-through material laid over what is
//     behind it. Drawn at twice the size and averaged down (alpha-weighted), so an edge is smooth. The background clear.
//   - `encodePng({ width, height, data })`: RGBA, top row first, as a PNG (RFC 2083): IHDR, one IDAT (zlib - deflate by
//     formats/rawDeflate.js, the Adler-32 after it), IEND, each chunk's CRC by systems/save/saveTransfer.js crc32.
//
// Pure - typed arrays in, typed arrays out. Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { applyTextureTransform } from './gltfImport.js';
import { mat4FromQuatPosScale } from '../world/quat.js';   // Unity's T * R(q) * S, column-major
import { deflateRaw } from '../formats/rawDeflate.js';
import { crc32 } from '../systems/save/saveTransfer.js';

/** The library's picture side, in pixels. */
export const POI_THUMB_SIZE = 128;
/** Drawn at this many times the side, then averaged down. */
const SUPER = 2;
/** The view: from the model's front (+Z, the way an imported model faces), 30 degrees round to its right, 25 above. */
const VIEW_YAW = (30 * Math.PI) / 180, VIEW_PITCH = (25 * Math.PI) / 180;
const AMBIENT = 0.32, KEY_K = 0.62, FILL_K = 0.22;
/** The share of the side left clear round the model. */
const PAD = 0.06;

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The eye's frame: `f` the way it looks, `right` and `up` its screen's axes (left-handed: right = up x f, up = f x right). */
export function thumbEye() {
  const d = [Math.sin(VIEW_YAW) * Math.cos(VIEW_PITCH), Math.sin(VIEW_PITCH), Math.cos(VIEW_YAW) * Math.cos(VIEW_PITCH)];
  const f = [-d[0], -d[1], -d[2]];
  const right = norm(cross([0, 1, 0], f));
  const up = norm(cross(f, right));
  return { f, right, up };
}

/** A light's direction TOWARDS it, given in the eye's own frame: `r` along its right, `u` its up, `b` back towards it (-f). */
function fromEye(r, u, b) {
  const e = thumbEye();
  return norm([0, 1, 2].map((a) => r * e.right[a] + u * e.up[a] - b * e.f[a]));
}
/** The lights, as directions TOWARDS them: a key from above the eye's left shoulder, a fill from its right, low.
 *  AUDIT POI M8: written as numbers in the model's frame they stood mirrored - the key on the eye's right, the fill on its
 *  left - a right-handed reading of a left-handed frame (the eye looks back at the model's front, so its right is the
 *  model's -X); set in the eye's frame, the words are what they say. */
export const THUMB_KEY = fromEye(-0.45, 0.8, 0.55), THUMB_FILL = fromEye(0.7, 0.2, 0.4);

/** A picture's texel where (u, v) falls - v down from its top row, as the mesh keeps UVs - wrapped as the material says. */
function wrapCoord(x, mode) {
  if (mode === 'clamp') return Math.min(1, Math.max(0, x));
  if (mode === 'mirror') { const k = ((x % 2) + 2) % 2; return k > 1 ? 2 - k : k; }
  return x - Math.floor(x);
}
function sample(img, wrap, u, v, out) {
  const x = Math.min(img.width - 1, Math.floor(wrapCoord(u, wrap?.[0]) * img.width));
  const y = Math.min(img.height - 1, Math.floor(wrapCoord(v, wrap?.[1]) * img.height));
  const i = (y * img.width + x) * 4;
  out[0] = img.data[i] / 255; out[1] = img.data[i + 1] / 255; out[2] = img.data[i + 2] / 255; out[3] = img.data[i + 3] / 255;
}

/**
 * @typedef {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray }} ThumbImage RGBA, top row first
 * @typedef {{ color?: number[], picture?: ThumbImage | null, alpha?: string, cutoff?: number, twoSided?: boolean,
 *   wrap?: string[], uv?: { offset: number[], scale: number[], rotation: number } }} ThumbMaterial
 * @typedef {{ mesh: { positions: ArrayLike<number>, normals: ArrayLike<number>, uvs: ArrayLike<number>,
 *   indices: ArrayLike<number>, submeshes: { start: number, count: number }[] }, t?: number[], r?: number[], s?: number[],
 *   materials: ThumbMaterial[] }} ThumbPiece
 */

/**
 * The model's picture: RGBA, `size` square, top row first; the background clear.
 * @param {ThumbPiece[]} pieces @param {{ size?: number }} [opts] @returns {{ width: number, height: number, data: Uint8Array }}
 */
export function renderThumb(pieces, { size = POI_THUMB_SIZE } = {}) {
  const W = size * SUPER;
  const eye = thumbEye();
  // every vertex into the model's frame, then onto the eye's screen: its x, y and depth, and its normal in the model
  const placed = pieces.map((p) => {
    const m = mat4FromQuatPosScale(p.r ?? [0, 0, 0, 1], p.t ?? [0, 0, 0], p.s ?? [1, 1, 1]);
    const s = p.s ?? [1, 1, 1];
    const mirrored = s[0] * s[1] * s[2] < 0;
    const n = p.mesh.positions.length / 3;
    const sx = new Float64Array(n), sy = new Float64Array(n), sz = new Float64Array(n), nor = new Float64Array(n * 3);
    for (let v = 0; v < n; v++) {
      const x = p.mesh.positions[v * 3], y = p.mesh.positions[v * 3 + 1], z = p.mesh.positions[v * 3 + 2];
      const w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
      sx[v] = dot(w, eye.right); sy[v] = dot(w, eye.up); sz[v] = dot(w, eye.f);
      // a normal by the inverse-transpose: divided by the scale, then turned (the scale's columns are in m already)
      const a = p.mesh.normals[v * 3] / (s[0] * s[0]), b = p.mesh.normals[v * 3 + 1] / (s[1] * s[1]), c = p.mesh.normals[v * 3 + 2] / (s[2] * s[2]);
      const nn = norm([m[0] * a + m[4] * b + m[8] * c, m[1] * a + m[5] * b + m[9] * c, m[2] * a + m[6] * b + m[10] * c]);
      nor[v * 3] = nn[0]; nor[v * 3 + 1] = nn[1]; nor[v * 3 + 2] = nn[2];
    }
    return { p, sx, sy, sz, nor, mirrored };
  });
  // framed on what is drawn: the screen box of every vertex a submesh draws
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of placed) for (const sm of q.p.mesh.submeshes) for (let k = sm.start; k < sm.start + sm.count; k++) {
    const v = q.p.mesh.indices[k];
    if (q.sx[v] < x0) x0 = q.sx[v]; if (q.sx[v] > x1) x1 = q.sx[v];
    if (q.sy[v] < y0) y0 = q.sy[v]; if (q.sy[v] > y1) y1 = q.sy[v];
  }
  const rgba = new Float32Array(W * W * 4);   // premultiplied while drawn
  const depth = new Float32Array(W * W).fill(Infinity);
  if (Number.isFinite(x0)) {
    const span = Math.max(x1 - x0, y1 - y0, 1e-6);
    const k = (W * (1 - 2 * PAD)) / span;
    const cx = W / 2 - ((x0 + x1) / 2) * k, cy = W / 2 + ((y0 + y1) / 2) * k;
    const toPx = (q, v) => [cx + q.sx[v] * k, cy - q.sy[v] * k];
    // the opaque and the cut first, writing depth; the see-through after, over them
    for (const pass of ['solid', 'blend']) {
      for (const q of placed) {
        q.p.mesh.submeshes.forEach((sm, i) => {
          const mat = q.p.materials[i] ?? {};
          if ((mat.alpha === 'blend') !== (pass === 'blend')) return;
          for (let t = sm.start; t + 3 <= sm.start + sm.count; t += 3) drawTriangle(q, mat, t, toPx, rgba, depth, W, pass === 'blend');
        });
      }
    }
  }
  return downsample(rgba, W, size);
}

/**
 * The pixels a triangle covers on a `W`-square buffer, by their centres, either winding: `visit(x, y, w0, w1, w2)` with
 * its barycentres (w0 a's). A centre inside it, or on an edge that is its TOP or its LEFT. AUDIT POI M12: a centre on an
 * edge was every triangle's on it, so a centre on an edge two triangles share was drawn twice - a see-through surface
 * laid twice along its own seams. The top-left rule gives it to the one whose inside lies to the edge's right (or, the
 * edge level, below it - the screen's y runs down): each edge function is the exact negative of its twin's, so exactly
 * one of the two takes it.
 */
export function thumbRaster(ax, ay, bx, by, cx, cy, W, visit) {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (!(Math.abs(area) > 1e-12)) return;
  const sg = area > 0 ? 1 : -1;
  // an edge's inward gradient (gx, gy): does a centre exactly on it belong to this triangle?
  const owns = (gx, gy) => gx > 0 || (gx === 0 && gy > 0);
  const own0 = owns(sg * (by - cy), sg * (cx - bx)), own1 = owns(sg * (cy - ay), sg * (ax - cx)), own2 = owns(sg * (ay - by), sg * (bx - ax));
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(W - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      // each corner's weight times the area: the edge opposite it, as cross(P - p, Q - p) - its twin's exact negative
      const e0 = (bx - px) * (cy - py) - (by - py) * (cx - px);
      const e1 = (cx - px) * (ay - py) - (cy - py) * (ax - px);
      const e2 = (ax - px) * (by - py) - (ay - py) * (bx - px);
      const s0 = sg * e0, s1 = sg * e1, s2 = sg * e2;
      if (s0 < 0 || s1 < 0 || s2 < 0) continue;
      if ((s0 === 0 && !own0) || (s1 === 0 && !own1) || (s2 === 0 && !own2)) continue;
      visit(x, y, e0 / area, e1 / area, e2 / area);
    }
  }
}

/** One triangle into the buffers: culled when it faces away (unless two-sided), its pixels by their barycentres. */
function drawTriangle(q, mat, t, toPx, rgba, depth, W, blend) {
  const idx = q.p.mesh.indices;
  const va = idx[t], vb = idx[t + 1], vc = idx[t + 2];
  // its facing from its winding: n = (b - a) x (c - a) is its outward normal as the import leaves a model (a mirroring
  // scale turns it). On the screen (x right, y DOWN) its area is -(n . f) - right x up is f - so a face toward the eye
  // (n . f < 0) has a positive area here
  const [ax, ay] = toPx(q, va), [bx, by] = toPx(q, vb), [cx, cy] = toPx(q, vc);
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (!(Math.abs(area) > 1e-12)) return;
  const front = (area > 0) !== q.mirrored;
  if (!front && !mat.twoSided) return;
  const side = front ? 1 : -1;
  const base = mat.color ?? [1, 1, 1, 1];
  const uvs = q.p.mesh.uvs;
  const tt = mat.uv && (mat.uv.rotation || mat.uv.offset[0] || mat.uv.offset[1] || mat.uv.scale[0] !== 1 || mat.uv.scale[1] !== 1) ? mat.uv : null;
  const tex = [1, 1, 1, 1];
  thumbRaster(ax, ay, bx, by, cx, cy, W, (x, y, w0, w1, w2) => {
    const z = w0 * q.sz[va] + w1 * q.sz[vb] + w2 * q.sz[vc];
    const at = y * W + x;
    if (z >= depth[at]) return;
    let a = base[3] ?? 1, r = base[0], g = base[1], b = base[2];
    if (mat.picture) {
      let u = w0 * uvs[va * 2] + w1 * uvs[vb * 2] + w2 * uvs[vc * 2], v = w0 * uvs[va * 2 + 1] + w1 * uvs[vb * 2 + 1] + w2 * uvs[vc * 2 + 1];
      if (tt) [u, v] = applyTextureTransform(tt, u, v);
      sample(mat.picture, mat.wrap, u, v, tex);
      r *= tex[0]; g *= tex[1]; b *= tex[2]; a *= tex[3];
    }
    if (mat.alpha === 'cutout' && a < (mat.cutoff ?? 0.5)) return;
    if (mat.alpha !== 'blend') a = 1;
    // the normal across the face, from its own side
    const n = norm([0, 1, 2].map((c) => side * (w0 * q.nor[va * 3 + c] + w1 * q.nor[vb * 3 + c] + w2 * q.nor[vc * 3 + c])));
    const lit = AMBIENT + KEY_K * Math.max(0, dot(n, THUMB_KEY)) + FILL_K * Math.max(0, dot(n, THUMB_FILL));
    r = Math.min(1, r * lit); g = Math.min(1, g * lit); b = Math.min(1, b * lit);
    const o = at * 4;
    if (blend) {
      // laid over what is behind it, premultiplied; it writes no depth (what is behind still shows through)
      rgba[o] = r * a + rgba[o] * (1 - a); rgba[o + 1] = g * a + rgba[o + 1] * (1 - a); rgba[o + 2] = b * a + rgba[o + 2] * (1 - a);
      rgba[o + 3] = a + rgba[o + 3] * (1 - a);
    } else {
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 1;
      depth[at] = z;
    }
  });
}

/** The drawn buffer averaged down by SUPER - alpha-weighted (it is premultiplied), so a clear pixel tints no edge. */
function downsample(rgba, W, size) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SUPER; j++) for (let i = 0; i < SUPER; i++) {
      const o = ((y * SUPER + j) * W + (x * SUPER + i)) * 4;
      r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; a += rgba[o + 3];
    }
    const o = (y * size + x) * 4;
    if (a > 0) { out[o] = Math.round((r / a) * 255); out[o + 1] = Math.round((g / a) * 255); out[o + 2] = Math.round((b / a) * 255); }
    out[o + 3] = Math.round((a / (SUPER * SUPER)) * 255);
  }
  return { width: size, height: size, data: out };
}

// ── THE PNG ────────────────────────────────────────────────────────

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const be32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
function chunk(type, body) {
  const head = new Uint8Array(4 + body.length);
  for (let i = 0; i < 4; i++) head[i] = type.charCodeAt(i);
  head.set(body, 4);
  return [...be32(body.length), ...head, ...be32(crc32(head))];
}

/**
 * An RGBA image as a PNG: 8 bits a channel, colour type 6, every row filtered None, one IDAT.
 * @param {ThumbImage} img @returns {Uint8Array}
 */
export function encodePng({ width, height, data }) {
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const deflated = deflateRaw(raw);
  // zlib (RFC 1950): CMF 0x78 (deflate, a 32 KiB window), FLG 0x01 (its check bits; no dictionary), then the Adler-32
  const z = new Uint8Array(2 + deflated.length + 4);
  z[0] = 0x78; z[1] = 0x01;
  z.set(deflated, 2);
  z.set(be32(adler32(raw)), 2 + deflated.length);
  const ihdr = new Uint8Array([...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
  return Uint8Array.from([...PNG_SIGNATURE, ...chunk('IHDR', ihdr), ...chunk('IDAT', z), ...chunk('IEND', new Uint8Array(0))]);
}
