// GRAHT1 (bible/03-World/Graht-Oaks.md) - THE GRAHT-OAKS, DRAWN WITHOUT A GPU: a small software rasteriser over the
// port's own procedural trees (world/jungle/grahtOakMesh.js, render/grahtOakArt.js) - no game data anywhere in it -
// so a change to the tree's shape is seen in seconds, not in a SwiftShader boot. A stand of trees on flat ground
// (world/jungle/grahtOaks.js's lattice, every site whole), from an eye you name; each face lit as the billboard
// program's mesh mode lights a tree (render/renderer.js BB_VS: 0.72 + 0.28 n.sun, held to 0.5..1), its texel nearest,
// the cards cut at a half, a fog over it all. Answers the share of the view's upper half that is sky.
//
//   node tools/grahtOakPreview.mjs out.png [view]      view: up (default), level, far, tree, lod1, lod2
//
// Env: W/H the picture's size (480 x 300); EYE "x,y,z", YAW, PITCH (radians), FOV (degrees) for a view of your own;
// SUN "x,y,z" toward the sun; FOG per metre (0.0012); LOD to force one LOD for every tree.
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { grahtOakMesh, GRAHT_VARIANTS, GRAHT_LODS } from '../src/world/jungle/grahtOakMesh.js';
import { barkPicture, leavesPicture, cardsPicture } from '../src/render/grahtOakArt.js';
import { grahtLodOf, GRAHT } from '../src/world/jungle/grahtOaks.js';

const out = process.argv[2] || '/tmp/graht-preview.png';
const view = process.argv[3] || 'up';
const W = Number(process.env.W || 480),
  H = Number(process.env.H || 300);
const meshes = [];
for (let v = 0; v < GRAHT_VARIANTS; v++)
  for (let l = 0; l < GRAHT_LODS; l++) meshes[v * GRAHT_LODS + l] = grahtOakMesh(v, l);
const pics = [barkPicture(), leavesPicture(), cardsPicture()];

// THE STAND: the law's lattice on flat ground, every site standing, each tree its draws
const trees = [];
const C = GRAHT.cell * 6.4;
const hash = (x, z, s) => {
  let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
for (let j = -6; j <= 6; j++)
  for (let i = -6; i <= 6; i++) {
    if (view === 'tree' && (i || j)) continue;
    const [a, b] = GRAHT.inset;
    const x = (i + a + (b - a) * hash(i, j, 1)) * C,
      z = (j + a + (b - a) * hash(i, j, 2)) * C;
    if (hash(i, j, 3) >= GRAHT.occupancy && view !== 'tree') continue;
    trees.push({
      x,
      y: 0,
      z,
      yaw: hash(i, j, 4) * 6.283,
      s: GRAHT.scale[0] + (GRAHT.scale[1] - GRAHT.scale[0]) * hash(i, j, 5),
      v: Math.floor(hash(i, j, 6) * GRAHT_VARIANTS),
    });
  }
const views = {
  up: { eye: [C * 0.0, 1.7, C * 0.0], yaw: 0.6, pitch: 1.05, fov: 75 },
  level: { eye: [C * 0.0, 1.7, C * 0.0], yaw: 0.6, pitch: 0.12, fov: 75 },
  far: { eye: [-C * 6, 300, -C * 6], yaw: 0.78, pitch: -0.2, fov: 60 },
  tree: { eye: [-170, 40, -170], yaw: 0.78, pitch: 0.28, fov: 70 },
};
const V = views[view] ?? views.up;
const eye = process.env.EYE ? process.env.EYE.split(',').map(Number) : V.eye;
// keep the eye off a trunk: step it to the first spot 40 m clear of every root
if (!process.env.EYE && eye[1] < 5) {
  for (let k = 0; k < 400; k++) {
    if (trees.every((t) => Math.hypot(t.x - eye[0], t.z - eye[2]) > 42 * t.s)) break;
    eye[0] += 9;
    eye[2] += 4;
  }
}
const yaw = Number(process.env.YAW ?? V.yaw),
  pitch = Number(process.env.PITCH ?? V.pitch),
  fov = (Number(process.env.FOV ?? V.fov) * Math.PI) / 180;
const sun = (process.env.SUN || '0.35,0.85,0.4').split(',').map(Number);
{
  const l = Math.hypot(...sun);
  sun[0] /= l;
  sun[1] /= l;
  sun[2] /= l;
}
const FOG = Number(process.env.FOG ?? 0.0012);
const fogC = [168, 186, 170],
  skyTop = [96, 150, 220],
  skyLow = [190, 210, 228];

// the camera's basis: forward by yaw (about y) and pitch, right and up
const fw = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const rt = [Math.cos(yaw), 0, -Math.sin(yaw)];
const up = [fw[1] * rt[2] - fw[2] * rt[1], fw[2] * rt[0] - fw[0] * rt[2], fw[0] * rt[1] - fw[1] * rt[0]];
const f = 1 / Math.tan(fov / 2),
  asp = W / H,
  NEAR = 0.5;
const toView = (p) => {
  const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  return [
    d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2],
    -(d[0] * up[0] + d[1] * up[1] + d[2] * up[2]),
    d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2],
  ];
};

const color = new Uint8Array(W * H * 3),
  depth = new Float32Array(W * H).fill(Infinity),
  isSky = new Uint8Array(W * H).fill(1);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    // the sky by the view ray's height, the ground under the horizon
    const vx = ((((x + 0.5) / W) * 2 - 1) * asp) / f,
      vy = -(((y + 0.5) / H) * 2 - 1) / f;
    const d = [rt[0] * vx - up[0] * -vy + fw[0], rt[1] * vx + up[1] * vy + fw[1], rt[2] * vx - up[2] * -vy + fw[2]];
    const l = Math.hypot(...d),
      dy = d[1] / l,
      o = (y * W + x) * 3;
    let c;
    if (dy > 0) {
      const t = Math.pow(dy, 0.5);
      c = skyLow.map((v, i) => v + (skyTop[i] - v) * t);
    } else {
      const dist = eye[1] / Math.max(1e-4, -dy),
        fogK = 1 - Math.exp(-FOG * dist);
      c = [72, 66, 44].map((v, i) => v + (fogC[i] - v) * fogK);
      isSky[y * W + x] = 0;
      depth[y * W + x] = dist;
    }
    color[o] = c[0];
    color[o + 1] = c[1];
    color[o + 2] = c[2];
  }
const subColor = [
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
];
let drawn = 0;
for (const t of trees) {
  const dist = Math.hypot(t.x - eye[0], t.z - eye[2]);
  const lod = process.env.LOD != null ? Number(process.env.LOD) : grahtLodOf(dist / t.s);
  const mesh = meshes[t.v * GRAHT_LODS + lod];
  const c = Math.cos(t.yaw),
    s = Math.sin(t.yaw);
  const P = mesh.positions,
    N = mesh.normals,
    UV = mesh.uvs;
  mesh.subs.forEach(([first, count], si) => {
    const pic = pics[si];
    for (let k = first; k < first + count; k += 3) {
      // the instance's turn and scale, as BB_VS's mesh mode: x' = c x + s z, z' = -s x + c z
      const vs = [0, 1, 2].map((q) => {
        const i = k + q,
          px = P[i * 3] * t.s,
          py = P[i * 3 + 1] * t.s,
          pz = P[i * 3 + 2] * t.s;
        return { w: [c * px + s * pz + t.x, py + t.y, -s * px + c * pz + t.z], uv: [UV[i * 2], UV[i * 2 + 1]] };
      });
      const nx = N[k * 3],
        ny = N[k * 3 + 1],
        nz = N[k * 3 + 2];
      const wn = [c * nx + s * nz, ny, -s * nx + c * nz];
      const faceSun = Math.min(1, Math.max(0.5, 0.72 + 0.28 * (wn[0] * sun[0] + wn[1] * sun[1] + wn[2] * sun[2])));
      raster(
        vs.map((v) => ({ v: toView(v.w), uv: v.uv })),
        pic,
        faceSun,
        si === 2,
      );
    }
  });
  drawn++;
}
function raster(tri, pic, light, cut) {
  // clip against the near plane (z > NEAR), Sutherland-Hodgman
  let poly = tri;
  const inside = (p) => p.v[2] > NEAR;
  const clipped = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (inside(a)) clipped.push(a);
    if (inside(a) !== inside(b)) {
      const tt = (NEAR - a.v[2]) / (b.v[2] - a.v[2]);
      clipped.push({ v: a.v.map((x, j) => x + (b.v[j] - x) * tt), uv: a.uv.map((x, j) => x + (b.uv[j] - x) * tt) });
    }
  }
  if (clipped.length < 3) return;
  const sc = clipped.map((p) => ({
    x: (((p.v[0] * f) / asp / p.v[2]) * 0.5 + 0.5) * W,
    y: (((p.v[1] * f) / p.v[2]) * 0.5 + 0.5) * H,
    iz: 1 / p.v[2],
    u: p.uv[0] / p.v[2],
    w: p.uv[1] / p.v[2],
  }));
  for (let i = 1; i + 1 < sc.length; i++) fill(sc[0], sc[i], sc[i + 1], pic, light, cut);
}
function fill(a, b, c, pic, light, cut) {
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 1e-9) return;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))),
    x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))),
    y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
      const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const iz = w0 * a.iz + w1 * b.iz + w2 * c.iz,
        z = 1 / iz,
        i = y * W + x;
      if (z >= depth[i]) continue;
      const u = (w0 * a.u + w1 * b.u + w2 * c.u) * z,
        v = (w0 * a.w + w1 * b.w + w2 * c.w) * z;
      const tx = ((Math.floor(u * pic.width) % pic.width) + pic.width) % pic.width;
      const ty = pic.height - 1 - (((Math.floor(v * pic.height) % pic.height) + pic.height) % pic.height); // v = 0 the picture's bottom
      const o = (ty * pic.width + tx) * 4;
      if (cut && pic.data[o + 3] < 128) continue;
      depth[i] = z;
      isSky[i] = 0;
      const fogK = 1 - Math.exp(-FOG * z),
        lit = light * 1.15;
      for (let q = 0; q < 3; q++) color[i * 3 + q] = Math.min(255, pic.data[o + q] * lit) * (1 - fogK) + fogC[q] * fogK;
    }
}
let sky = 0,
  half = 0;
for (let y = 0; y < H / 2; y++)
  for (let x = 0; x < W; x++) {
    half++;
    sky += isSky[y * W + x];
  }
const png = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) {
  png.data[i * 4] = color[i * 3];
  png.data[i * 4 + 1] = color[i * 3 + 1];
  png.data[i * 4 + 2] = color[i * 3 + 2];
  png.data[i * 4 + 3] = 255;
}
writeFileSync(out, PNG.sync.write(png));
console.log(
  `${out}: ${view}, ${drawn} trees, eye ${eye.map((v) => v.toFixed(0))}, the upper half's sky ${((100 * sky) / half).toFixed(1)}%`,
);
