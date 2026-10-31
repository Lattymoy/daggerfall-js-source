// CAPITAL-TREES (bible/03-World/Arena-Provinces.md CAPITAL-TREES) - THE CAPITALS' TREES, DRAWN WITHOUT A GPU: a small
// software rasteriser over the capitals' own models as installCapitals installs them (world/capitalModels.js northward,
// vanillaTexels) and their own pictures (capitalArt) - no game data anywhere in it - so a change to a capital's tree is
// seen in seconds, not in a SwiftShader boot past the Bay (#1184's J6). Each face lit as the model program lights a model
// (an ambient and the sun's diffuse on its normal), its texel nearest from a mip chain at its own minification (the
// renderer's NEAREST_MIPMAP_NEAREST), a tree's flats cut at half alpha (their coverage kept through the chain), back
// faces culled, a fog over it all, flat ground under a sky.
//
//   node tools/capitalTreePreview.mjs out.png [models] [view]
//     models: oak, gardens, plaza, fane, hist - joined by + (default oak)
//     view:   oak-far, oak-mid, oak-base, oak-tier, oak-deck, mh-plaza, mh-walk, mh-court (default oak-mid)
//
// Env: W/H the picture's size (900 x 600); EYE "x,y,z" (the world's frame: +x east, +z north, the capital's anchor at the
// origin), YAW (radians, 0 north, clockwise), PITCH (radians), FOV (degrees) for a view of your own; FOG per metre.
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { capitalArt, vanillaTexels, northward } from '../src/world/capitalModels.js';
import { CAPITAL_CUT_RECORDS } from '../src/world/capitalShapes.js';
import { buildGrahtOak } from '../src/world/capitalFalinesti.js';
import { buildMournholdGardens, buildMournholdPlaza, buildHighFane } from '../src/world/capitalMournhold.js';
import { buildHist } from '../src/world/capitalHelstrom.js';

const out = process.argv[2] || 'capital-trees.png';
const which = (process.argv[3] || 'oak').split('+');
const BUILDS = {
  oak: buildGrahtOak,
  gardens: buildMournholdGardens,
  plaza: buildMournholdPlaza,
  fane: buildHighFane,
  hist: buildHist,
};
const VIEWS = {
  'oak-far': { eye: [-330, 70, -330], yaw: 0.785, pitch: 0.2, fov: 60 },
  'oak-mid': { eye: [-200, 40, -160], yaw: 0.9, pitch: 0.38, fov: 70 },
  'oak-base': { eye: [95, 8, -75], yaw: -0.95, pitch: 0.32, fov: 70 },
  'oak-tier': { eye: [-75, 40, -40], yaw: 0.6, pitch: 0.15, fov: 70 },
  'oak-deck': { eye: [-14, 63.7, 26], yaw: 2.6, pitch: 0.12, fov: 75 },
  'mh-plaza': { eye: [-70, 14, -280], yaw: 0.75, pitch: -0.05, fov: 70 },
  'mh-walk': { eye: [-20, 1.7, -250], yaw: 0.55, pitch: 0.12, fov: 70 },
  'mh-court': { eye: [0, 1.7, 100], yaw: 0, pitch: 0.1, fov: 75 },
};
const V = VIEWS[process.argv[4] || 'oak-mid'];
if (!V) throw new Error(`no view ${process.argv[4]} - ${Object.keys(VIEWS).join(', ')}`);
const W = Number(process.env.W || 900),
  H = Number(process.env.H || 600);
const eye = process.env.EYE ? process.env.EYE.split(',').map(Number) : V.eye;
const yaw = Number(process.env.YAW ?? V.yaw),
  pitch = Number(process.env.PITCH ?? V.pitch),
  fov = (Number(process.env.FOV ?? V.fov) * Math.PI) / 180;
const FOG = Number(process.env.FOG ?? 0.0009),
  fogC = [170, 186, 200];
const sun = (() => {
  const s = [0.4, 0.8, -0.45],
    l = Math.hypot(...s);
  return s.map((v) => v / l);
})();

const models = which.map((k) => {
  if (!BUILDS[k]) throw new Error(`no model ${k}`);
  return vanillaTexels(northward(BUILDS[k]()));
});
const art = capitalArt(),
  cut = new Set(CAPITAL_CUT_RECORDS);
/** A picture's mip chain - each level the box of the four under it, a cut picture's colour weighted by its coverage
 *  and its alpha the coverage (cut at a half as the renderer cuts it). */
const chains = new Map();
function chain(pic, isCut) {
  if (chains.has(pic)) return chains.get(pic);
  const levels = [pic];
  let cur = pic;
  while (cur.width > 1 && cur.height > 1) {
    const w = cur.width >> 1,
      h = cur.height >> 1,
      d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const o = ((y * 2 + dy) * cur.width + x * 2 + dx) * 4,
              al = isCut ? cur.data[o + 3] : 255;
            r += cur.data[o] * al;
            g += cur.data[o + 1] * al;
            b += cur.data[o + 2] * al;
            a += al;
          }
        const o = (y * w + x) * 4;
        if (a > 0) {
          d[o] = r / a;
          d[o + 1] = g / a;
          d[o + 2] = b / a;
        }
        d[o + 3] = a / 4;
      }
    cur = { width: w, height: h, data: d };
    levels.push(cur);
  }
  chains.set(pic, levels);
  return levels;
}

// the camera: forward by yaw (0 north, +z; clockwise to east, +x) and pitch; right, up
const fw = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const rt = [Math.cos(yaw), 0, -Math.sin(yaw)];
const up = [fw[1] * rt[2] - fw[2] * rt[1], fw[2] * rt[0] - fw[0] * rt[2], fw[0] * rt[1] - fw[1] * rt[0]];
const f = 1 / Math.tan(fov / 2),
  asp = W / H,
  NEAR = 0.3;
const toView = (p) => {
  const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  return [
    d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2],
    -(d[0] * up[0] + d[1] * up[1] + d[2] * up[2]),
    d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2],
  ];
};
const color = new Uint8Array(W * H * 3),
  depth = new Float32Array(W * H).fill(Infinity);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    // the sky by the view ray's height, the ground under the horizon
    const vx = ((((x + 0.5) / W) * 2 - 1) * asp) / f,
      vy = -(((y + 0.5) / H) * 2 - 1) / f;
    const d = [rt[0] * vx + up[0] * vy + fw[0], rt[1] * vx + up[1] * vy + fw[1], rt[2] * vx + up[2] * vy + fw[2]];
    const l = Math.hypot(...d),
      dy = d[1] / l,
      o = (y * W + x) * 3;
    let c;
    if (dy >= 0 || eye[1] <= 0) {
      const t = Math.sqrt(Math.max(0, dy));
      c = [176, 196, 214].map((v, i) => v + ([92, 136, 196][i] - v) * t);
    } else {
      const dist = eye[1] / -dy,
        fogK = 1 - Math.exp(-FOG * dist),
        gx = eye[0] + (d[0] / l) * dist,
        gz = eye[2] + (d[2] / l) * dist;
      const chk = (Math.floor(gx / 6.4) + Math.floor(gz / 6.4)) & 1 ? 1 : 0.94;
      c = [86, 92, 58].map((v, i) => v * chk + (fogC[i] - v * chk) * fogK);
      depth[y * W + x] = dist;
    }
    color[o] = c[0];
    color[o + 1] = c[1];
    color[o + 2] = c[2];
  }
let drawn = 0;
for (const m of models) {
  for (const sm of m.subMeshes) {
    const pic = art.get(sm.textureRecord) ?? { width: 1, height: 1, data: new Uint8Array([200, 0, 200, 255]) },
      isCut = cut.has(sm.textureRecord),
      mips = chain(pic, isCut);
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]],
        P = ix.map((v) => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]]);
      const n = [m.normals[ix[0] * 3], m.normals[ix[0] * 3 + 1], m.normals[ix[0] * 3 + 2]];
      const c = [0, 1, 2].map((k) => (P[0][k] + P[1][k] + P[2][k]) / 3 - eye[k]);
      if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] > 0) continue; // a back face
      const light = 0.5 + 0.62 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      const vs = P.map(toView),
        U = ix.map((v) => [m.uvs[v * 2] * pic.width, m.uvs[v * 2 + 1] * pic.height]);
      let lod = 0; // the level: the face's texels over its pixels
      if (vs.every((v) => v[2] > NEAR)) {
        const S = vs.map((v) => [((v[0] * f) / asp / v[2]) * 0.5 * W, ((v[1] * f) / v[2]) * 0.5 * H]);
        const sa = Math.abs((S[1][0] - S[0][0]) * (S[2][1] - S[0][1]) - (S[2][0] - S[0][0]) * (S[1][1] - S[0][1]));
        const ta = Math.abs((U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1]));
        lod = Math.max(
          0,
          Math.min(mips.length - 1, Math.round(0.5 * Math.log2(Math.max(1e-9, ta) / Math.max(1e-9, sa)))),
        );
      }
      raster(
        vs.map((v, k) => ({ v, uv: [m.uvs[ix[k] * 2], m.uvs[ix[k] * 2 + 1]] })),
        mips[lod],
        light,
        isCut,
      );
      drawn++;
    }
  }
}
function raster(tri, pic, light, isCut) {
  const inside = (p) => p.v[2] > NEAR,
    clipped = [];
  for (let i = 0; i < tri.length; i++) {
    // the near plane, Sutherland-Hodgman
    const a = tri[i],
      b = tri[(i + 1) % tri.length];
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
  for (let i = 1; i + 1 < sc.length; i++) fill(sc[0], sc[i], sc[i + 1], pic, light, isCut);
}
function fill(a, b, c, pic, light, isCut) {
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
      const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area,
        w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area,
        w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = 1 / (w0 * a.iz + w1 * b.iz + w2 * c.iz),
        i = y * W + x;
      if (z >= depth[i]) continue;
      const u = (w0 * a.u + w1 * b.u + w2 * c.u) * z,
        v = (w0 * a.w + w1 * b.w + w2 * c.w) * z;
      const tx = ((Math.floor(u * pic.width) % pic.width) + pic.width) % pic.width;
      const ty = pic.height - 1 - (((Math.floor(v * pic.height) % pic.height) + pic.height) % pic.height); // v 0 the picture's bottom row
      const o = (ty * pic.width + tx) * 4;
      if (isCut && pic.data[o + 3] < 128) continue;
      depth[i] = z;
      const fogK = 1 - Math.exp(-FOG * z);
      for (let q = 0; q < 3; q++)
        color[i * 3 + q] = Math.min(255, pic.data[o + q] * light) * (1 - fogK) + fogC[q] * fogK;
    }
}
const png = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) {
  png.data[i * 4] = color[i * 3];
  png.data[i * 4 + 1] = color[i * 3 + 1];
  png.data[i * 4 + 2] = color[i * 3 + 2];
  png.data[i * 4 + 3] = 255;
}
writeFileSync(out, PNG.sync.write(png));
console.log(`${out}: ${which.join('+')}, ${drawn} faces drawn, eye ${eye.map((v) => v.toFixed(0))}`);
