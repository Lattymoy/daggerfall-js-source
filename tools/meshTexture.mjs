// THE TEXTURE, BAKED OFF THE MODEL RATHER THAN PAINTED BLIND.
//
//     node tools/meshTexture.mjs <mesh.json> <out.dds> [--size=512]
//                                [--rays=64] [--preview=out.png]
//
// FIELD-GUN-MW2 (2026-09-20). Mac asked for "texturing and rigging", and
// the FBX he sent carries a UV unwrap and NO Material, Texture or Video
// record at all - so there is nothing to bake FROM and no image to ship.
// Painting one by hand into a 1024x1024 atlas, sight unseen, is guessing
// where the barrel is; every stroke would be a claim about an island
// whose shape nobody here can see.
//
// ═══ SO THE GEOMETRY PAINTS IT ════════════════════════════════════
//
// A texel is not a blank square: the mesh says exactly which point of
// which triangle it covers. Rasterise the model INTO its own UV space
// and every texel knows its 3D position, its normal and how enclosed it
// is - and those three answer the questions a metal texture asks:
//
//   WHERE ON THE GUN AM I?   The long axis is the gun (+Y forward after
//     the MW1 bake), so position along it separates muzzle from barrel
//     from receiver from grip, and each takes its own base colour. No
//     island has to be identified by eye.
//
//   HOW ENCLOSED AM I?       Ambient occlusion, cast for real: rays over
//     the cosine hemisphere against the mesh's own triangles. This is
//     the one shading term that belongs in a texture at all - it is
//     view- and light-independent, where a baked highlight would fight
//     the renderer's own lighting and follow the gun around the room.
//
//   WHICH WAY DO I FACE?     The normal, for the lengthwise brushing on
//     a turned barrel and for keeping the top plates cleaner than the
//     undersides, which is where a carried weapon actually wears.
//
// Everything here is DETERMINISTIC - a fixed integer hash, no seeded
// RNG, no clock - so the same mesh bakes the same bytes and a change in
// the output is a change somebody made.
//
// ═══ THIS IS A FIRST TEXTURE, NOT A FINISHED ONE ══════════════════
//
// Said plainly: it is a material, not artwork. It gives the model
// believable dwemer bronze with its own occlusion so the gun reads as a
// solid object in the hand, and `tools/meshSheets.mjs --uv` still draws
// the unwrap for painting over. When Mac paints one, his file replaces
// this one at the same name and nothing else moves.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { writePng } from './pngIO.mjs';

// ── the palette, along the gun ───────────────────────────────────────
//
// Four bands by FRACTION BACK FROM THE MUZZLE, and the direction is
// stated because getting it backwards is the bug this file already
// had: `along` was measured from the minimum of the long axis, which
// after the MW1 bake is the BUTT - so the sooted-muzzle band painted
// the grip and the matte-grip band painted the barrel. It looked
// plausible on screen, because both ends are dark and only the two
// middle bands were actually swapped.
//
// The boundaries are the model's own: sliced along the long axis, the
// forward half is a uniform 0.12 x 0.14 tube for its whole length
// (the barrel) and the rear carries everything 0.21 and 0.26 deep
// (the receiver, then the grip).
//
// THE NUMBERS ARE LINEAR, and that is why they look so low: linear
// 0.30 encodes to sRGB 0.59, so a palette typed as though these were
// screen values comes out of the encode pale and chalky - which is
// exactly what the first bake of this file did.
export const BANDS = [
  { at: 0.00, name: 'muzzle',   colour: [0.070, 0.045, 0.026], rough: 0.90 },   // scorched, sooted
  { at: 0.07, name: 'barrel',   colour: [0.305, 0.148, 0.036], rough: 0.55 },   // turned bronze
  { at: 0.50, name: 'receiver', colour: [0.205, 0.112, 0.034], rough: 0.50 },   // the same alloy, cast
  { at: 0.76, name: 'grip',     colour: [0.055, 0.034, 0.022], rough: 0.95 },   // dark, matte
];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The band colour at a fraction of the long axis, interpolated so the
 *  parts meet instead of banding. */
export function bandAt(t) {
  const x = clamp01(t);
  let i = 0;
  while (i + 1 < BANDS.length && BANDS[i + 1].at <= x) i++;
  const a = BANDS[i];
  const b = BANDS[Math.min(i + 1, BANDS.length - 1)];
  const span = b.at - a.at;
  // A SHORT blend, not a ramp across the whole band: a gun is machined
  // parts bolted together, and a smooth gradient from muzzle to butt
  // would read as one dipped rod.
  const k = span > 0 ? clamp01((x - a.at) / span) : 0;
  const s = k * k * (3 - 2 * k);
  return {
    name: s < 0.5 ? a.name : b.name,
    colour: [0, 1, 2].map((c) => lerp(a.colour[c], b.colour[c], s)),
    rough: lerp(a.rough, b.rough, s),
  };
}

/** A deterministic 3D value hash: no seed, no clock, same bytes every
 *  run. Cheap integer mixing, then a trilinear blend so it is noise and
 *  not static. */
function hash3(x, y, z) {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function valueNoise(x, y, z) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const xf = x - xi; const yf = y - yi; const zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf); const sy = yf * yf * (3 - 2 * yf); const sz = zf * zf * (3 - 2 * zf);
  let out = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1; const dy = (k >> 1) & 1; const dz = (k >> 2) & 1;
    const w = (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz);
    out += w * hash3(xi + dx, yi + dy, zi + dz);
  }
  return out;
}

// ── ambient occlusion, cast against the real triangles ───────────────

/** Moller-Trumbore, returning the hit distance or Infinity. */
function rayTri(o, d, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  // NOT one-sided: this mesh is an open shell with two-sided faces
  // (the NIF carries DrawMode Both), so a back face still occludes.
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const t = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const u = (t[0] * p[0] + t[1] * p[1] + t[2] * p[2]) * inv;
  if (u < 0 || u > 1) return Infinity;
  const q = [t[1] * e1[2] - t[2] * e1[1], t[2] * e1[0] - t[0] * e1[2], t[0] * e1[1] - t[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const dist = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return dist > 1e-5 ? dist : Infinity;
}

/**
 * PER VERTEX, not per texel, and that is a decision rather than a
 * shortcut: 539 vertices against 295 triangles is five million ray
 * tests, where a 512x512 atlas would be a thousand times that for a
 * term that varies smoothly over a face anyway. The texels interpolate
 * it barycentrically, exactly as a renderer would.
 *
 * `range` bounds the occluder distance so the far side of the weapon
 * does not shade the near side into a tube of mud - AO is about
 * crevices, and on a mesh normalised to a longest axis of 1 a crevice
 * is a few hundredths.
 */
export function vertexAO(mesh, { rays = 64, range = 0.12 } = {}) {
  const P = mesh.positions; const N = mesh.normals; const I = mesh.indices;
  const n = P.length / 3;
  const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    tris.push([
      [P[I[t] * 3], P[I[t] * 3 + 1], P[I[t] * 3 + 2]],
      [P[I[t + 1] * 3], P[I[t + 1] * 3 + 1], P[I[t + 1] * 3 + 2]],
      [P[I[t + 2] * 3], P[I[t + 2] * 3 + 1], P[I[t + 2] * 3 + 2]],
    ]);
  }
  const out = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const nrm = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    // An orthonormal frame about the normal, branchlessly stable.
    const s = nrm[2] >= 0 ? 1 : -1;
    const a = -1 / (s + nrm[2]);
    const b = nrm[0] * nrm[1] * a;
    const tx = [1 + s * nrm[0] * nrm[0] * a, s * b, -s * nrm[0]];
    const ty = [b, s + nrm[1] * nrm[1] * a, -nrm[1]];
    const origin = [P[v * 3] + nrm[0] * 1e-4, P[v * 3 + 1] + nrm[1] * 1e-4, P[v * 3 + 2] + nrm[2] * 1e-4];
    let open = 0;
    for (let r = 0; r < rays; r++) {
      // A GOLDEN-RATIO SPIRAL, cosine-weighted: deterministic, evenly
      // spread, and no two vertices share a pattern of jitter that
      // could print itself into the atlas.
      const u1 = (r + 0.5) / rays;
      const u2 = (r * 0.6180339887498949 + v * 0.7548776662466927) % 1;
      const sinT = Math.sqrt(u1);
      const cosT = Math.sqrt(1 - u1);
      const phi = 2 * Math.PI * u2;
      const d = [
        tx[0] * sinT * Math.cos(phi) + ty[0] * sinT * Math.sin(phi) + nrm[0] * cosT,
        tx[1] * sinT * Math.cos(phi) + ty[1] * sinT * Math.sin(phi) + nrm[1] * cosT,
        tx[2] * sinT * Math.cos(phi) + ty[2] * sinT * Math.sin(phi) + nrm[2] * cosT,
      ];
      let hit = Infinity;
      for (const tri of tris) {
        const dist = rayTri(origin, d, tri[0], tri[1], tri[2]);
        if (dist < hit) hit = dist;
        if (hit < 1e-4) break;
      }
      // A hit beyond `range` is the other side of the gun, not a crevice.
      open += hit >= range ? 1 : hit / range;
    }
    out[v] = open / rays;
  }
  return out;
}

// ── the UV-space bake ────────────────────────────────────────────────

/**
 * Rasterise every triangle into UV space, keeping the interpolated
 * position, normal and AO per texel. V is flipped to image rows here,
 * the same way tools/meshSheets.mjs draws the unwrap, so the sheet a
 * painter works over and the sheet this writes are the same sheet.
 */
export function bakeAttributes(mesh, size, ao) {
  const P = mesh.positions; const N = mesh.normals; const U = mesh.uvs; const I = mesh.indices;
  if (!U) throw new Error('this mesh has no UVs - there is nothing to bake into');
  const pos = new Float32Array(size * size * 3);
  const nrm = new Float32Array(size * size * 3);
  const occ = new Float32Array(size * size);
  const covered = new Uint8Array(size * size);
  const uvAt = (i) => [U[i * 2] * (size - 1), (1 - U[i * 2 + 1]) * (size - 1)];

  for (let t = 0; t < I.length; t += 3) {
    const idx = [I[t], I[t + 1], I[t + 2]];
    const s = idx.map(uvAt);
    const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
    if (Math.abs(area) < 1e-12) continue;
    // CONSERVATIVE by one texel in each direction: a triangle thinner
    // than a texel covers no pixel centre at all, and an island that
    // bakes to nothing is a hole in the atlas that the dilation below
    // would then fill with its neighbour's colour.
    const minX = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])) - 1);
    const maxX = Math.min(size - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])) + 1);
    const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])) - 1);
    const maxY = Math.min(size - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])) + 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5; const py = y + 0.5;
        let w0 = ((s[1][0] - s[0][0]) * (py - s[0][1]) - (px - s[0][0]) * (s[1][1] - s[0][1])) / area;
        let w1 = ((s[2][0] - s[1][0]) * (py - s[1][1]) - (px - s[1][0]) * (s[2][1] - s[1][1])) / area;
        let w2 = ((s[0][0] - s[2][0]) * (py - s[2][1]) - (px - s[2][0]) * (s[0][1] - s[2][1])) / area;
        // Clamped rather than rejected, which is what makes the
        // one-texel margin above land ON the triangle's edge instead of
        // extrapolating past it.
        const outside = w0 < 0 || w1 < 0 || w2 < 0;
        if (outside && covered[y * size + x]) continue;
        const sum = Math.abs(w0) + Math.abs(w1) + Math.abs(w2);
        if (outside) {
          w0 = clamp01(w0); w1 = clamp01(w1); w2 = clamp01(w2);
          const k = w0 + w1 + w2;
          if (k <= 0) continue;
          w0 /= k; w1 /= k; w2 /= k;
        } else if (sum > 0) { w0 /= sum; w1 /= sum; w2 /= sum; }
        // The weights are opposite-edge areas, so each belongs to the
        // vertex ACROSS from it: w0 -> idx[2], w1 -> idx[0], w2 -> idx[1].
        const [c, a, b] = [idx[2], idx[0], idx[1]];
        const at = y * size + x;
        for (let k = 0; k < 3; k++) {
          pos[at * 3 + k] = P[c * 3 + k] * w0 + P[a * 3 + k] * w1 + P[b * 3 + k] * w2;
          nrm[at * 3 + k] = N[c * 3 + k] * w0 + N[a * 3 + k] * w1 + N[b * 3 + k] * w2;
        }
        occ[at] = ao[c] * w0 + ao[a] * w1 + ao[b] * w2;
        covered[at] = outside ? (covered[at] || 2) : 1;   // 1 = real, 2 = margin
      }
    }
  }
  return { pos, nrm, occ, covered, size };
}

/** How far back from the MUZZLE a point is, 0 at the muzzle and 1 at
 *  the butt. One home, because the bands and the pins both ask it. */
export function muzzleFraction(y, bounds) {
  const span = bounds.max[1] - bounds.min[1] || 1;
  return clamp01((bounds.max[1] - y) / span);
}

/** Shade one baked texel. Linear RGB out. */
export function shadeTexel(p, n, ao, bounds) {
  // WHERE ON THE GUN: FORWARD IS +Y after the MW1 bake, so the muzzle
  // is the axis MAXIMUM and the fraction runs back from it. Measured
  // from the minimum - the obvious way round - this paints the gun
  // back to front.
  const band = bandAt(muzzleFraction(p[1], bounds));
  let [r, g, b] = band.colour;

  // BRUSHING, along the barrel. The frequency is high across the gun
  // and low along it, which is what a turned surface looks like: rings
  // and lengthwise drag, not blobs.
  const brush = valueNoise(p[0] * 220, p[1] * 26, p[2] * 220) - 0.5;
  const grain = valueNoise(p[0] * 60, p[1] * 60, p[2] * 60) - 0.5;
  const tone = 1 + brush * 0.34 * band.rough + grain * 0.16;

  // WHICH WAY DO I FACE: the top plates of a carried weapon are
  // polished by handling and the undersides are not. +Z is up.
  const up = clamp01(n[2] * 0.5 + 0.5);
  const wear = 0.88 + 0.26 * up * (1 - band.rough);

  // HOW ENCLOSED: the occlusion, with a floor so a crevice is dark and
  // not black - the renderer still has to light this surface, and a
  // texel baked to zero can never be lit.
  const occ = 0.22 + 0.78 * clamp01(ao);

  const k = tone * wear * occ;
  r *= k; g *= k; b *= k;
  // NO VERDIGRIS. Two versions of it were tried and both are gone: a
  // green tint keyed on occlusion fired over most of the gun (this
  // mesh's mean AO is 0.60, so "the deepest crevices" was nearly all
  // of it), and tightening the threshold moved the blotches without
  // removing them - the recessed plates along the barrel are exactly
  // the places that are both occluded AND the most visible surface on
  // the weapon. A patina that lands on the parts a player looks at all
  // day is worse than no patina, and there is no threshold that
  // distinguishes "a crevice" from "a machined channel" out of
  // occlusion alone. If the gun should go green it should go green
  // where an artist puts it, not where a number happens to dip.
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/** sRGB encode - the texture is colour, and a linear buffer written
 *  straight out is the classic too-dark asset. */
const toSrgb = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * (v ** (1 / 2.4)) - 0.055));

/**
 * DILATE the covered texels outward. Bilinear filtering and every mip
 * level sample ACROSS an island's edge, so an atlas whose background is
 * left empty draws a dark rim around every seam on the model - and it
 * gets worse the further away you stand, because each mip mixes in more
 * of the background.
 */
export function dilate(rgba, covered, size, passes) {
  const have = Uint8Array.from(covered);
  for (let pass = 0; pass < passes; pass++) {
    const next = Uint8Array.from(have);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const at = y * size + x;
        if (have[at]) continue;
        let r = 0; let g = 0; let b = 0; let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx; const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const s = ny * size + nx;
            if (!have[s]) continue;
            r += rgba[s * 4]; g += rgba[s * 4 + 1]; b += rgba[s * 4 + 2]; n++;
          }
        }
        if (!n) continue;
        rgba[at * 4] = r / n; rgba[at * 4 + 1] = g / n; rgba[at * 4 + 2] = b / n; rgba[at * 4 + 3] = 255;
        next[at] = 1;
      }
    }
    have.set(next);
  }
}

/** Bake one mesh to an RGBA atlas. */
export function bakeTexture(mesh, { size = 512, rays = 64, dilatePasses = 8 } = {}) {
  const ao = vertexAO(mesh, { rays });
  const { pos, nrm, occ, covered } = bakeAttributes(mesh, size, ao);
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    if (!covered[i]) continue;
    const c = shadeTexel(
      [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]],
      [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]],
      occ[i], mesh.bounds,
    );
    rgba[i * 4] = toSrgb(c[0]); rgba[i * 4 + 1] = toSrgb(c[1]); rgba[i * 4 + 2] = toSrgb(c[2]); rgba[i * 4 + 3] = 255;
  }
  dilate(rgba, covered, size, dilatePasses);
  return { width: size, height: size, data: rgba, covered };
}

// ── the DDS container ────────────────────────────────────────────────

/** Box-filter one level down. The chain matters more here than on most
 *  textures: a first-person weapon spends its life at a few hundred
 *  pixels and its atlas is a thousand. */
export function halve({ width, height, data }) {
  const w = Math.max(1, width >> 1); const h = Math.max(1, height >> 1);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0; let n = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(width - 1, x * 2 + dx); const sy = Math.min(height - 1, y * 2 + dy);
            sum += data[(sy * width + sx) * 4 + c]; n++;
          }
        }
        out[(y * w + x) * 4 + c] = sum / n;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * An uncompressed 32-bit DDS with a full mip chain, in the A8R8G8B8
 * layout the format's masks describe (bytes B, G, R, A). Uncompressed
 * rather than DXT1 on purpose: the port's decoder reads both, DXT's
 * 4x4 blocks smear a metal gradient, and the size difference on one
 * weapon does not buy anything a player would notice.
 */
export function writeDds(levels) {
  const HEADER = 128;
  let bytes = 0;
  for (const m of levels) bytes += m.width * m.height * 4;
  const buf = Buffer.alloc(HEADER + bytes);
  buf.writeUInt32LE(0x20534444, 0);            // 'DDS '
  buf.writeUInt32LE(124, 4);                   // header size
  // CAPS | HEIGHT | WIDTH | PITCH | PIXELFORMAT | MIPMAPCOUNT
  buf.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x8 | 0x1000 | 0x20000, 8);
  buf.writeUInt32LE(levels[0].height, 12);
  buf.writeUInt32LE(levels[0].width, 16);
  buf.writeUInt32LE(levels[0].width * 4, 20);  // pitch
  buf.writeUInt32LE(0, 24);                    // depth
  buf.writeUInt32LE(levels.length, 28);
  buf.writeUInt32LE(32, 76);                   // pixel format size
  buf.writeUInt32LE(0x1 | 0x40, 80);           // ALPHAPIXELS | RGB
  buf.writeUInt32LE(0, 84);                    // no fourCC
  buf.writeUInt32LE(32, 88);                   // bits per pixel
  buf.writeUInt32LE(0x00ff0000, 92);           // R
  buf.writeUInt32LE(0x0000ff00, 96);           // G
  buf.writeUInt32LE(0x000000ff, 100);          // B
  buf.writeUInt32LE(0xff000000, 104);          // A
  buf.writeUInt32LE(0x1000 | 0x8 | 0x400000, 108);   // TEXTURE | COMPLEX | MIPMAP
  let off = HEADER;
  for (const m of levels) {
    for (let i = 0; i < m.width * m.height; i++) {
      buf[off++] = m.data[i * 4 + 2];          // B
      buf[off++] = m.data[i * 4 + 1];          // G
      buf[off++] = m.data[i * 4];              // R
      buf[off++] = m.data[i * 4 + 3];          // A
    }
  }
  return buf;
}

/** The whole chain, down to 1x1. */
export function mipChain(top) {
  const levels = [top];
  let cur = top;
  while (cur.width > 1 || cur.height > 1) { cur = halve(cur); levels.push(cur); }
  return levels;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) {
    console.error('usage: node tools/meshTexture.mjs <mesh.json> <out.dds> [--size=512] [--rays=64] [--preview=out.png]');
    process.exit(2);
  }
  const mesh = JSON.parse(readFileSync(files[0], 'utf8'));
  const size = Number(opt('size', 512));
  const top = bakeTexture(mesh, { size, rays: Number(opt('rays', 64)) });
  const levels = mipChain({ width: top.width, height: top.height, data: top.data });
  const dds = writeDds(levels);
  mkdirSync(dirname(files[1]), { recursive: true });
  writeFileSync(files[1], dds);
  const coveredCount = top.covered.reduce((a, v) => a + (v ? 1 : 0), 0);
  console.log(`${files[0]} -> ${files[1]}  ${dds.length} bytes, ${levels.length} mip levels`);
  console.log(`  ${size}x${size}, ${(100 * coveredCount / (size * size)).toFixed(1)}% of the atlas is the model`);
  if (opt('preview')) {
    mkdirSync(dirname(opt('preview')), { recursive: true });
    writeFileSync(opt('preview'), writePng({ width: top.width, height: top.height, data: top.data }));
    console.log(`  ${opt('preview')}`);
  }
}
