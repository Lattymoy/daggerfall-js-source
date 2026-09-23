// HQ1 AUDIT (2026-09-23, Mac: "can we audit everything so far"): THE OCCLUSION ON A REAL GPU - is it SYMMETRIC.
//
// The horizon-based occlusion (airPass.js AO_FS) marches screen-space slices both ways from a pixel and clamps the
// horizons to the projected normal's hemisphere. The hosts render through an x-MIRRORED projection
// (mirrorProjectionX: proj[0] < 0), so screen +x is view -x: any place the shader assumes "screen right is view
// +x" - the slice direction's sign against the marched side, the radius's sign - shows up as an occlusion that
// leans to one side. This probe draws a crate on a floor in the middle of the view and reads the AO image back:
//   - the floor strip just LEFT of the crate and the strip just RIGHT must occlude alike (within a few percent);
//   - both must be darker than the open floor far from the crate (a little: the flanks are seen edge-on, so the
//     screen-space march barely meets them), and the floor in FRONT of the crate, whose wall faces the eye, much more;
//   - the open floor must be 1 at EVERY depth (a flat surface occludes itself nowhere - the audit's first cut read
//     0.73 far off from a half-texel reconstruction error, then 0.97 from clamping each pixel before the blur);
//   - the crate's top face must be near 1.
//
// Usage: node tools/aoProbe.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || 'scratch/ao';
mkdirSync(outDir, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { const src = (h - 1 - y) * w * 4; raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + src, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5213, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
await page.goto('http://localhost:5213/play/');

const W = 640, H = 400;
const result = await page.evaluate(async ({ W, H }) => {
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE } = await import('/src/render/enhancedLighting.js');
  const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  document.body.appendChild(canvas);
  const r = new Renderer(canvas);
  const gl = r.gl;
  const stone = (() => { const w = 32, h = 32, colors = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { colors[i * 4] = 170; colors[i * 4 + 1] = 160; colors[i * 4 + 2] = 150; colors[i * 4 + 3] = 255; } return { width: w, height: h, colors }; })();
  r.uploadTexture(1, 1, stone);
  const P = [], N = [], UV = [], IDX = [];
  const subs = [];
  const quad = (a, b, c, d, n, s = 4) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, s, 0, s, s, 0, s); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
  const box = (x0, y0, z0, x1, y1, z1) => {
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
  };
  const sub = (build) => { const start = IDX.length; build(); subs.push({ textureArchive: 1, textureRecord: 1, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
  sub(() => quad([-20, 0, 20], [20, 0, 20], [20, 0, -20], [-20, 0, -20], [0, 1, 0], 10));   // the floor
  sub(() => box(-1, 0, -1, 1, 1.5, 1));   // the crate, centred
  const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  const eye = [0, 3, 6];
  const view = lookAt(eye, [0, 0.5, 0], [0, 1, 0]);
  const I = identity();
  r.setLightingLane(EL_LANE); r.setAir(true); r.setContact(false);
  if (r.air) r.air._now = () => 1000;
  r.setPointLights(new Float32Array(0), new Float32Array([1, 1, 1]));
  r.setClearColor([0.3, 0.4, 0.6, 1]);
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.9, new Float32Array([1, 1, 1]));
  r.setFog('exp', 0, 60, 180, new Float32Array([0.3, 0.4, 0.6]));
  const lightDir = new Float32Array([0.2, 0.9, 0.3]);
  const readTarget = (T) => { gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); const a = new Uint8Array(T.w * T.h * 4); gl.readPixels(0, 0, T.w, T.h, gl.RGBA, gl.UNSIGNED_BYTE, a); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return a; };
  for (let f = 0; f < 3; f++) { r.beginFrame(proj, view, lightDir, WORLD_FRAME); r.drawMesh(mesh, I, null); r.resolveFrame(); }
  const T = r.air.targets.aoBlur;
  const ao = readTarget(T);
  let floorByDepth;
  {
    const projectS = (p) => {
      const v = [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14]];
      const cx = proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12], cy = proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13], cw = proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15];
      return [(cx / cw * 0.5 + 0.5) * T.w, (cy / cw * 0.5 + 0.5) * T.h];
    };
    const rowMean = (img, z) => { let s = 0, n = 0; for (let x = -4; x <= 4; x += 0.5) { if (Math.abs(x) < 1.6 && Math.abs(z) < 1.6) continue; const [px, py] = projectS([x, 0, z]); const i = (Math.round(py) * T.w + Math.round(px)) * 4; if (i >= 0 && i < img.length) { s += img[i] / 255; n++; } } return n ? +(s / n).toFixed(3) : null; };
    floorByDepth = [2, 0, -2, -4, -8, -12].map((z) => rowMean(ao, z));   // the open floor's rows, near to far (the crate's own columns skipped)
  }
  const frame = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, frame);
  // world points to AO-image pixels (the AO image is the world rect at AIR_AO_SCALE; here the whole canvas)
  const project = (p) => {
    const v = [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14]];
    const cx = proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12], cy = proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13], cw = proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15];
    return [(cx / cw * 0.5 + 0.5) * T.w, (cy / cw * 0.5 + 0.5) * T.h];
  };
  const meanAt = (pts) => { let s = 0; for (const p of pts) { const [px, py] = project(p); const i = (Math.round(py) * T.w + Math.round(px)) * 4; s += ao[i] / 255; } return s / pts.length; };
  const strip = (x0, x1, z0, z1, n = 12) => { const out = []; for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) out.push([x0 + (x1 - x0) * (i + 0.5) / n, 0, z0 + (z1 - z0) * (j + 0.5) / 3]); return out; };
  return {
    w: T.w, h: T.h, ao: Array.from(ao), frame: Array.from(frame), err: gl.getError(), floorByDepth,
    left: meanAt(strip(-1.35, -1.05, -0.8, 0.8)),     // the floor just left of the crate (view: crate's -x side)
    right: meanAt(strip(1.05, 1.35, -0.8, 0.8)),       // just right
    front: meanAt(strip(-0.8, 0.8, 1.05, 1.35)),       // just in front (toward the eye)
    open: meanAt(strip(3, 5, -1, 1)),                  // the open floor, beside the crate but past the radius
    top: meanAt([[0, 1.5, 0], [0.4, 1.5, 0.3], [-0.4, 1.5, -0.3]]),
  };
}, { W, H });

writeFileSync(`${outDir}/ao.png`, png(result.w, result.h, Uint8Array.from(result.ao)));
writeFileSync(`${outDir}/frame.png`, png(W, H, Uint8Array.from(result.frame)));
console.log('the open floor by depth (z 2 .. -12):', result.floorByDepth.join(' '));
console.log(`AO ${result.w}x${result.h}: left ${result.left.toFixed(3)}, right ${result.right.toFixed(3)}, front ${result.front.toFixed(3)}, open ${result.open.toFixed(3)}, crate top ${result.top.toFixed(3)}`);
check('no GL error', result.err === 0, `${result.err}`);
check('the open floor is unoccluded', result.open > 0.95, result.open.toFixed(3));
check('the crate top is unoccluded', result.top > 0.9, result.top.toFixed(3));
check('the open floor is unoccluded at EVERY depth', result.floorByDepth.every((v) => v != null && v > 0.98), result.floorByDepth.join(' '));
check('the floor beside the crate is darker than the open floor, both sides (the flanks edge-on: a little)', result.left < result.open - 0.02 && result.right < result.open - 0.02, `${result.left.toFixed(3)} / ${result.right.toFixed(3)} vs ${result.open.toFixed(3)}`);
check('the floor in front of the crate, whose wall faces the eye, is darker by a tenth', result.front < result.open - 0.1, `${result.front.toFixed(3)} vs ${result.open.toFixed(3)}`);
check('the occlusion is SYMMETRIC - left and right of the crate within 0.04 (a mirror-sign fault leans to one side)', Math.abs(result.left - result.right) < 0.04, `left ${result.left.toFixed(3)}, right ${result.right.toFixed(3)}`);
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'AO PROBE: ALL GREEN' : `AO PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
