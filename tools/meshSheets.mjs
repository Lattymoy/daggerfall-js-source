// THE TWO PICTURES A BAKED MESH OWES YOU.
//
//     node tools/meshSheets.mjs <mesh.json> [--uv=out.png] [--size=1024]
//                                           [--preview=out.png]
//                                           [--texture=atlas.png]
//
// FIELD-GUN-MW1. tools/fbxMesh.mjs turns an FBX into numbers, and
// numbers are exactly the wrong thing to review a MODEL in: a bake
// that silently mirrored the mesh, tore an n-gon, or landed the long
// axis on the wrong side produces a perfectly well-formed JSON. So the
// bake gets looked at, and it gets looked at two ways:
//
//   --preview   THREE ORTHOGRAPHIC VIEWS, z-buffered and Lambert-shaded
//               off the baked normals. Side (down -X), top (down -Z)
//               and front (down +Y, the direction of flight). A torn
//               fan is a shard here; an inside-out winding is a hole;
//               a wrong axis map is a bolt lying down.
//
//   --uv        THE UNWRAP, drawn at texture resolution. This one is
//               not a check, it is a DELIVERABLE: an FBX carries UVs
//               but Pellet_Shot.fbx carries no Material, Texture or
//               Video record at all, so there is no texture to bake -
//               only the layout the texture will have to fit. This
//               sheet is that layout, ready to paint on.
//
// No renderer, no GL, no browser: a 200-line rasteriser is less than
// the harness it would take to screenshot the real one, and this has
// to run in the same `node` a test does.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPng, writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';

/** An RGBA canvas, and the two operations these sheets need. */
export function canvas(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3]; }
  return { width, height, data };
}
const put = (c, x, y, rgba) => {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 4;
  // Source-over, so overlapping wireframe edges do not punch holes in
  // each other's antialiasing.
  const a = rgba[3] / 255;
  c.data[i] = c.data[i] * (1 - a) + rgba[0] * a;
  c.data[i + 1] = c.data[i + 1] * (1 - a) + rgba[1] * a;
  c.data[i + 2] = c.data[i + 2] * (1 - a) + rgba[2] * a;
  c.data[i + 3] = Math.max(c.data[i + 3], rgba[3]);
};

/** Bresenham, because a UV sheet is edges and nothing else. */
export function line(c, x0, y0, x1, y1, rgba) {
  let [x, y] = [Math.round(x0), Math.round(y0)];
  const [ex, ey] = [Math.round(x1), Math.round(y1)];
  const dx = Math.abs(ex - x); const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1; const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(c, x, y, rgba);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/**
 * THE UNWRAP SHEET. Every triangle's three UV corners, in texture
 * space, with V FLIPPED - FBX/OpenGL put v=0 at the BOTTOM and a PNG
 * puts row 0 at the top, and a sheet painted against the wrong one is
 * a texture that comes out upside down on the model.
 */
export function uvSheet(mesh, size = 1024) {
  const c = canvas(size, size, [26, 26, 30, 255]);
  // A checker, so a painter can see the scale of a texel without
  // measuring, and so an empty region is obvious.
  const cell = size / 16;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) put(c, x, y, [38, 38, 44, 255]);
    }
  }
  const { uvs, indices } = mesh;
  if (!uvs) throw new Error('this mesh carries no UVs - there is no unwrap to draw');
  const at = (i) => [uvs[i * 2] * (size - 1), (1 - uvs[i * 2 + 1]) * (size - 1)];
  for (let t = 0; t < indices.length; t += 3) {
    const p = [at(indices[t]), at(indices[t + 1]), at(indices[t + 2])];
    for (let e = 0; e < 3; e++) line(c, ...p[e], ...p[(e + 1) % 3], [120, 220, 255, 200]);
  }
  return c;
}

/** The three orthographic axes, as (right, up) pairs of the mesh's own
 *  basis (+Y forward, +Z up). Named for what the reader is looking at. */
export const VIEWS = [
  { name: 'side',  right: [0, 1, 0], up: [0, 0, 1] },
  { name: 'top',   right: [0, 1, 0], up: [1, 0, 0] },
  { name: 'front', right: [1, 0, 0], up: [0, 0, 1] },
];

/**
 * THE PREVIEW SHEET: the three views side by side, each z-buffered and
 * shaded. Orthographic on purpose - a perspective preview hides a
 * scale error behind a distance, and scale is one of the things this
 * is here to check.
 */
export function previewSheet(mesh, size = 384, texture = null) {
  const c = canvas(size * VIEWS.length, size, [18, 18, 22, 255]);
  const P = mesh.positions; const N = mesh.normals; const I = mesh.indices;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // ONE scale for all three views, from the mesh's own bounds, so the
  // views are comparable to each other rather than each fitted to its
  // own frame.
  const half = Math.max(...[0, 1, 2].map((k) => Math.max(Math.abs(mesh.bounds.min[k]), Math.abs(mesh.bounds.max[k]))));
  const pad = 0.86;

  VIEWS.forEach((view, v) => {
    const ox = v * size;
    const z = [
      view.right[1] * view.up[2] - view.right[2] * view.up[1],
      view.right[2] * view.up[0] - view.right[0] * view.up[2],
      view.right[0] * view.up[1] - view.right[1] * view.up[0],
    ];
    const depth = new Float32Array(size * size).fill(Infinity);
    const project = (i) => {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
      return [
        ox + size / 2 + (dot(p, view.right) / half) * (size / 2) * pad,
        size / 2 - (dot(p, view.up) / half) * (size / 2) * pad,
        dot(p, z),
      ];
    };
    for (let t = 0; t < I.length; t += 3) {
      const tri = [I[t], I[t + 1], I[t + 2]];
      const s = tri.map(project);
      // Lambert off the FACE's averaged vertex normal, lit from over
      // the viewer's shoulder, with a floor so a face turned away is
      // dark and not invisible - a black shard is still a shard.
      const n = [0, 1, 2].map((k) => (N[tri[0] * 3 + k] + N[tri[1] * 3 + k] + N[tri[2] * 3 + k]) / 3);
      const light = [z[0] * 0.75 + view.up[0] * 0.45 + view.right[0] * 0.35,
        z[1] * 0.75 + view.up[1] * 0.45 + view.right[1] * 0.35,
        z[2] * 0.75 + view.up[2] * 0.45 + view.right[2] * 0.35];
      const ll = Math.hypot(...light) || 1;
      // HALF-LAMBERT, not Lambert: a face turned away from the key
      // still reads as a face. This is a diagram, and a silhouette
      // that swallows a third of the model tells the reader nothing
      // about whether the bake tore it.
      const lambert = 0.5 + 0.5 * dot(n, light.map((x) => x / ll));
      const shade = 30 + 225 * Math.max(0, Math.min(1, lambert));
      // WITH A TEXTURE, the shade MODULATES the atlas instead of
      // standing in for it - which is the only way to see whether the
      // bake landed on the right islands. PER PIXEL, not per triangle:
      // one sample at the UV centroid was enough while the unwrap was
      // the factory one (every island held the same pixels anyway) and
      // became a lie the moment there was a real unwrap - a plate the
      // size of the receiver came back one flat colour, which is not
      // what the model does.
      // The textured branch keys off the SAME half-lambert but with a
      // lift, because here the shade is a light on a surface that
      // already has a colour - the untextured branch's range would
      // crush an albedo that is legitimately dark to black.
      const k = 0.42 + 0.78 * Math.max(0, Math.min(1, lambert));
      const sample = texture && mesh.uvs
        ? { texture, uv: tri.map((v) => [mesh.uvs[v * 2], mesh.uvs[v * 2 + 1]]), k }
        : null;
      fillTri(c, depth, size, ox, s, [shade, shade * 0.88, shade * 0.66, 255], sample);
    }
    // The frame, and a tick at the origin, so "centred on its bounds"
    // is a thing the eye can check.
    for (let x = 0; x < size; x++) { put(c, ox + x, 0, [70, 70, 80, 255]); put(c, ox + x, size - 1, [70, 70, 80, 255]); }
    for (let y = 0; y < size; y++) { put(c, ox, y, [70, 70, 80, 255]); put(c, ox + size - 1, y, [70, 70, 80, 255]); }
    for (let d = -6; d <= 6; d++) { put(c, ox + size / 2 + d, size / 2, [255, 90, 90, 255]); put(c, ox + size / 2, size / 2 + d, [255, 90, 90, 255]); }
  });
  return c;
}

/** A z-buffered triangle. Half-space test, top-left-ish fill. With
 *  `sample` it takes its colour from the atlas at the pixel's own
 *  interpolated UV instead of the flat `rgba`. */
function fillTri(c, depth, size, ox, s, rgba, sample = null) {
  const minX = Math.max(ox, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])));
  const maxX = Math.min(ox + size - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
  const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
  const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
  if (Math.abs(area) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5; const py = y + 0.5;
      let w0 = ((s[1][0] - s[0][0]) * (py - s[0][1]) - (px - s[0][0]) * (s[1][1] - s[0][1])) / area;
      let w1 = ((s[2][0] - s[1][0]) * (py - s[1][1]) - (px - s[1][0]) * (s[2][1] - s[1][1])) / area;
      let w2 = ((s[0][0] - s[2][0]) * (py - s[2][1]) - (px - s[2][0]) * (s[0][1] - s[2][1])) / area;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      // Barycentric depth. The weights above are opposite-edge areas,
      // so the vertex each one belongs to is the one across from it.
      const total = w0 + w1 + w2;
      w0 /= total; w1 /= total; w2 /= total;
      const zz = s[2][2] * w0 + s[0][2] * w1 + s[1][2] * w2;
      const at = y * size + (x - ox);
      if (zz >= depth[at]) continue;
      depth[at] = zz;
      if (!sample) { put(c, x, y, rgba); continue; }
      // Same opposite-edge rule as the depth above: w0 belongs to
      // vertex 2, w1 to vertex 0, w2 to vertex 1.
      const u = sample.uv[2][0] * w0 + sample.uv[0][0] * w1 + sample.uv[1][0] * w2;
      const v = sample.uv[2][1] * w0 + sample.uv[0][1] * w1 + sample.uv[1][1] * w2;
      const t = sample.texture;
      const tx = Math.min(t.width - 1, Math.max(0, Math.round(u * (t.width - 1))));
      const ty = Math.min(t.height - 1, Math.max(0, Math.round((1 - v) * (t.height - 1))));
      const ti = (ty * t.width + tx) * 4;
      put(c, x, y, [t.data[ti] * sample.k, t.data[ti + 1] * sample.k, t.data[ti + 2] * sample.k, 255]);
    }
  }
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const src = args.find((a) => !a.startsWith('--'));
  if (!src) { console.error('usage: node tools/meshSheets.mjs <mesh.json> [--uv=out.png] [--preview=out.png] [--size=N]'); process.exit(2); }
  const mesh = JSON.parse(readFileSync(src, 'utf8'));
  const size = Number(opt('size', 0)) || 0;
  const save = (path, img) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, writePng(img)); console.log(`${path}  ${img.width}x${img.height}`); };
  const texture = opt('texture') ? readPng(readFileSync(opt('texture'))) : null;
  if (opt('uv')) save(opt('uv'), uvSheet(mesh, size || 1024));
  if (opt('preview')) save(opt('preview'), previewSheet(mesh, size || 384, texture));
  if (!opt('uv') && !opt('preview')) console.error('nothing asked for: pass --uv= and/or --preview=');
}
