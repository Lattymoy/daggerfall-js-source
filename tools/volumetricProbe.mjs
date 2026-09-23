// VOL1 (2026-09-23, Mac: "Continue" - the second arc's last step): THE LANTERNS' GLOW THROUGH THEIR SHADOWS, on a
// real GPU. A crate stands on a floor between the eye and a lantern behind it. The air between the eye and the
// crate's front face is in the crate's shadow, so the marched glow (airPass.js VOL_FS, through the lantern's cube
// map) must put LESS light on the crate's front than the lane's old closed-form glow did (which knew nothing of
// the crate); the floor beside the crate, whose air is lit on both, must read alike either way.
//
// The two are read on the same scene: the door open (renderer.setVolumetrics(true), the air pass marches) and shut
// (the lane's analytic glow per fragment, as before EL1..HQ1 drew it).
//
// Usage: node tools/volumetricProbe.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || 'scratch/vol';
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
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5215, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
await page.goto('http://localhost:5215/play/');

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
  const stone = (() => { const w = 32, h = 32, colors = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { colors[i * 4] = 110; colors[i * 4 + 1] = 105; colors[i * 4 + 2] = 100; colors[i * 4 + 3] = 255; } return { width: w, height: h, colors }; })();
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
  sub(() => box(-1.5, 0, -1, 1.5, 2.5, 1));   // the crate, tall, between the eye and the lantern
  const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  // the eye stands OFF the crate's shadow volume (which spreads from the crate away from the lantern, toward +z),
  // so a ray to the crate's front ends inside the shadow and a ray to the floor on the eye's own side never enters it
  const eye = [5, 1.6, 7];
  const view = lookAt(eye, [0, 1.0, 0], [0, 1, 0]);
  const I = identity();
  r.setLightingLane(EL_LANE); r.setAir(true); r.setContact(false);
  if (r.air) r.air._now = () => 1000;
  r.setClearColor([0.02, 0.02, 0.03, 1]);
  r.setLighting(new Float32Array([0.05, 0.05, 0.06]), 0, new Float32Array([1, 1, 1]));   // night: no sun
  r.setFog('exp', 0.03, 60, 180, new Float32Array([0.02, 0.02, 0.03]));   // a dense enough air to glow
  const lightDir = new Float32Array([0.2, 0.9, 0.3]);
  const lantern = new Float32Array([0, 1.2, -4, 14]);   // behind the crate, toward the far floor
  const draw = () => { r.setPointLights(lantern, new Float32Array([1, 0.8, 0.5])); r.beginFrame(proj, view, lightDir, WORLD_FRAME); r.drawMesh(mesh, I, null); r.resolveFrame(); };
  const grab = () => { const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const project = (p) => {
    const v = [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14]];
    const cx = proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12], cy = proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13], cw = proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15];
    return [(cx / cw * 0.5 + 0.5) * W, (cy / cw * 0.5 + 0.5) * H];
  };
  const lum = (img, pts) => { let s = 0, n = 0; for (const p of pts) { const [px, py] = project(p); if (!(px >= 0 && px < W && py >= 0 && py < H)) continue; const i = (Math.round(py) * W + Math.round(px)) * 4; s += (0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2]) / 255; n++; } return n ? s / n : NaN; };
  const grid = (pts) => pts;
  const front = []; for (let x = -1.2; x <= 1.2; x += 0.3) for (let y = 0.4; y <= 2.2; y += 0.3) front.push([x, y, 1]);   // the crate's front face
  const beside = []; for (let x = 2; x <= 3.5; x += 0.5) for (let z = -5; z <= -2; z += 1) beside.push([x, 0, z]);   // the floor on the eye's side of the crate, between it and the lantern: its air lit, the rays to it clear of the shadow (which spreads toward +z)
  r.setVolumetrics(true);
  for (let f = 0; f < 4; f++) draw();
  const on = grab();
  const volStats = { ...r.air.stats };
  r.setVolumetrics(false);
  for (let f = 0; f < 4; f++) draw();
  const off = grab();
  const offStats = { ...r.air.stats };
  return {
    w: W, h: H, on: Array.from(on), off: Array.from(off), err: gl.getError(), volStats, offStats,
    frontOn: lum(on, grid(front)), frontOff: lum(off, grid(front)),
    besideOn: lum(on, grid(beside)), besideOff: lum(off, grid(beside)),
  };
}, { W, H });

writeFileSync(`${outDir}/on.png`, png(result.w, result.h, Uint8Array.from(result.on)));
writeFileSync(`${outDir}/off.png`, png(result.w, result.h, Uint8Array.from(result.off)));
console.log(`crate front: marched ${result.frontOn.toFixed(4)} vs analytic ${result.frontOff.toFixed(4)}; floor beside: ${result.besideOn.toFixed(4)} vs ${result.besideOff.toFixed(4)}; stats ${JSON.stringify(result.volStats)} / ${JSON.stringify(result.offStats)}`);
check('no GL error', result.err === 0, `${result.err}`);
check('the glow was marched with the door open, and not with it shut', result.volStats.vol === true && result.offStats.vol === false);
check('the crate\'s front, its air in the crate\'s own shadow, is DARKER through the march than under the analytic glow (a tenth at least)', result.frontOn < result.frontOff * 0.9, `${result.frontOn.toFixed(4)} vs ${result.frontOff.toFixed(4)}`);
check('the floor on the eye\'s side, its air lit either way, reads alike within a twentieth (the march sums the closed form\'s own integrand)', Math.abs(result.besideOn - result.besideOff) < 0.05 * result.besideOff, `${result.besideOn.toFixed(4)} vs ${result.besideOff.toFixed(4)}`);
check('the lit air glows at all', result.besideOff > 0.03, result.besideOff.toFixed(4));
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'VOLUMETRIC PROBE: ALL GREEN' : `VOLUMETRIC PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
