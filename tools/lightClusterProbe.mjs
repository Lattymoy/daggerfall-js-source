// LC1 (2026-09-23, Mac: "make some insane improvements to our lighting system ... while also improving
// performance"): THE CLUSTERED LOOP ON A REAL GPU - is it the SAME PICTURE, and how much less does it walk.
//
// The pins (test/lc1_clusters.test.js) prove the grid's laws on the CPU and the shader's text; what only a GPU
// can prove is that the shader READS the grid the CPU wrote and lights the same pixels the plain loop lit. This
// probe draws enhancedLightingProbe's room through the real renderer on a real WebGL2 context (headless
// Chromium, ANGLE over SwiftShader) twice - the grid on, and `setClusters(false)` - and reads both back:
//   - the two frames must agree pixel for pixel to within the dither's byte (a summation-order difference at
//     most); a cell that lost a light shows as a dark patch, and the probe FAILS on it;
//   - the grid's mean list length is printed against the light count - what a fragment walks now.
// A second scene, a night street with forty lanterns, is the case the grid exists for.
//
// Usage: node tools/lightClusterProbe.mjs [outDir]   (PNGs land in outDir, default scratch/lc1/)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || 'scratch/lc1';
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

const server = await createServer({ server: { port: 5211, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5211/play/');

const W = 640, H = 400;
const result = await page.evaluate(async ({ W, H }) => {
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE, lanternColor, dungeonAmbient, dungeonFog } = await import('/src/render/enhancedLighting.js');
  const { meanListLength, CLUSTER_CELLS } = await import('/src/render/lightClusters.js');
  const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
  const { DUNGEON_FOG } = await import('/src/render/underwaterFog.js');

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  document.body.appendChild(canvas);
  const r = new Renderer(canvas);
  const gl = r.gl;
  const stone = (() => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const v = 150 + ((i * 7919) % 61); colors[i * 4] = v; colors[i * 4 + 1] = v - 10; colors[i * 4 + 2] = v - 25; colors[i * 4 + 3] = 255; }
    return { width: w, height: h, colors };
  })();
  const disc = (() => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x - 16, dy = y - 16, inside = dx * dx + dy * dy < 12 * 12; const i = (y * w + x) * 4; colors[i] = 230; colors[i + 1] = 180; colors[i + 2] = 90; colors[i + 3] = inside ? 255 : 0; }
    return { width: w, height: h, colors };
  })();
  r.uploadTexture(1, 1, stone);
  r.uploadTexture(210, 1, disc);
  const P = [], N = [], UV = [], IDX = [];
  let subs = [];
  const quad = (a, b, c, d, n, s = 4) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, s, 0, s, s, 0, s); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
  const box = (x0, y0, z0, x1, y1, z1, outward = true) => {
    const q = (a, b, c, d, n) => (outward ? quad(a, b, c, d, n) : quad(d, c, b, a, [-n[0], -n[1], -n[2]]));
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  };
  const sub = (name, build) => { const start = IDX.length; build(); subs.push({ name, textureArchive: 1, textureRecord: 1, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
  sub('room', () => box(-12, 0, -12, 12, 5, 12, false));
  sub('wall', () => box(-3, 0, -2.5, 3, 3.5, -2));
  sub('pillar', () => box(5.5, 0, -6.5, 6.5, 5, -5.5));
  sub('far', () => box(-11, 0, -11.5, -9, 2, -10.5));
  const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs.map(({ name, ...sm }) => sm) });
  P.length = N.length = UV.length = IDX.length = 0; subs = [];
  sub('ground', () => quad([-60, 0, 60], [60, 0, 60], [60, 0, -60], [-60, 0, -60], [0, 1, 0], 20));
  sub('wall', () => box(-3, 0, -2.5, 3, 3.5, -2));
  sub('pillar', () => box(5.5, 0, -6.5, 6.5, 5, -5.5));
  for (let k = 0; k < 12; k++) sub('crate' + k, () => box(-30 + k * 5, 0, -20 - (k % 3) * 8, -29 + k * 5, 1.5, -19 - (k % 3) * 8));
  const open = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs.map(({ name, ...sm }) => sm) });
  const flat = r.createBillboardBatch(210, 1, { w: 1, h: 2 }, [[-6, 1, 0]]);
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  const eye = [0, 1.7, 9];
  const view = lookAt(eye, [0, 1.2, -4], [0, 1, 0]);
  const I = identity();
  const DUNGEON_LIGHT = new Float32Array([0.8, 0.8, 0.8]);
  const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const frames = {};
  const scene = (label, { lights, sky, clusters }) => {
    r.setLightingLane(EL_LANE); r.setAir(true); r.setContact(true); r.setClusters(clusters);
    if (r.air) r.air._now = () => 1000;
    r.setPointLights(lights, lanternColor(true, DUNGEON_LIGHT));
    if (sky) {
      r.setClearColor([0.02, 0.02, 0.05, 1]);
      r.setLighting(new Float32Array([0.09, 0.09, 0.12]), 0, new Float32Array([1, 0.95, 0.85]));
      r.setFog('linear', 0, 40, 140, new Float32Array([0.02, 0.02, 0.05]));
    } else {
      r.setClearColor([0, 0, 0, 1]);
      r.setLighting(dungeonAmbient(true, new Float32Array([0.12, 0.12, 0.12])), 0);
      const fog = dungeonFog(true, DUNGEON_FOG);
      r.setFog(fog.mode, fog.density, fog.start, fog.end, new Float32Array(fog.color));
    }
    const lightDir = new Float32Array([0.45, 0.8, 0.35]);
    let px = null, live = null, mean = null, err = 0;
    for (let f = 0; f < 3; f++) {
      r.beginFrame(proj, view, lightDir, WORLD_FRAME);
      live = r._clustersLive; mean = r._clusters ? meanListLength(r._clusters) : null;
      r.drawMesh(sky ? open : mesh, I, null);
      r.drawBillboards([flat], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
      r.resolveFrame();
      err = gl.getError();
      px = read();
    }
    frames[label] = { px: Array.from(px), live, mean, err, count: lights.length / 4, cells: CLUSTER_CELLS, total: r._clusters?.total ?? 0 };
  };
  const room = new Float32Array([0, 2, -6, 12, 4, 2.5, 1, 7, -5, 2, 3, 9]);
  scene('room-grid', { lights: room, sky: false, clusters: true });
  scene('room-plain', { lights: room, sky: false, clusters: false });
  // the street: forty lanterns on a lattice around the eye, the case the grid exists for
  const street = [];
  for (let k = 0; k < 40; k++) { const a = k * 0.77, d = 6 + (k % 7) * 4; street.push(eye[0] + Math.cos(a) * d, 2.2, eye[2] - 4 - Math.abs(Math.sin(a)) * d, 12); }
  scene('street-grid', { lights: new Float32Array(street), sky: true, clusters: true });
  scene('street-plain', { lights: new Float32Array(street), sky: true, clusters: false });
  return { frames, renderer: gl.getParameter(gl.RENDERER) };
}, { W, H });

console.log('renderer:', result.renderer);
const compare = (a, b) => {
  let maxd = 0, sum = 0, over = 0;
  for (let i = 0; i < a.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(a[i] - b[i]); sum += d; if (d > maxd) maxd = d; if (d > 2) over++; }
  return { maxd, mean: sum / (a.length * 0.75), over };
};
for (const pair of [['room-grid', 'room-plain'], ['street-grid', 'street-plain']]) {
  const g = result.frames[pair[0]], p = result.frames[pair[1]];
  const gp = Uint8Array.from(g.px), pp = Uint8Array.from(p.px);
  writeFileSync(`${outDir}/${pair[0]}.png`, png(W, H, gp));
  writeFileSync(`${outDir}/${pair[1]}.png`, png(W, H, pp));
  const c = compare(gp, pp);
  console.log(`${pair[0]}: ${g.count} lights, grid live ${g.live}, mean list ${g.mean?.toFixed(2)} per cell (${g.total} entries over ${g.cells} cells) | vs plain: max |diff| ${c.maxd}, mean ${c.mean.toFixed(4)}, ${c.over} channels over 2`);
  check(`${pair[0]}: no GL error`, g.err === 0 && p.err === 0, `${g.err}/${p.err}`);
  check(`${pair[0]}: the grid was built and walked`, g.live === true && p.live === false);
  check(`${pair[0]}: the same picture as the plain loop (a dither byte at most)`, c.maxd <= 2 && c.over === 0, `max ${c.maxd}, ${c.over} over`);
  check(`${pair[0]}: a fragment walks fewer lights than the count`, g.mean < g.count, `${g.mean?.toFixed(2)} of ${g.count}`);
  let dark = 0; for (let i = 0; i < gp.length; i += 4) if (gp[i] + gp[i + 1] + gp[i + 2] < 6) dark++;
  check(`${pair[0]}: the frame is not black`, dark / (gp.length / 4) < 0.9);
}
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'LIGHT CLUSTER PROBE: ALL GREEN' : `LIGHT CLUSTER PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
