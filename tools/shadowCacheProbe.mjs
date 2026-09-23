// SC1 (2026-09-23, Mac: "make some insane improvements to our lighting system ... while also improving
// performance"): THE STATIC SHADOW CACHE ON A REAL GPU - the same picture, and the draws it no longer makes.
//
// The pins (test/sc1_shadowcache.test.js) prove the cache's laws on the fake GL; what only a GPU can prove is that
// a depth BLIT of the cached faces into the live layers, with the movers drawn on top, lights the same pixels the
// full replay lit. This probe draws enhancedLightingProbe's room through the real renderer on SwiftShader with a
// walker (a flat whose origin moves a step a frame) crossing it, six frames, the cache on and `setShadowCache(false)`,
// and reads both back frame by frame:
//   - every frame must agree pixel for pixel to within the dither's byte;
//   - the cache's point draws must fall to the walker alone after the first replay, while the old path's stay at
//     the room's every frame;
//   - with the walker gone, the cache's draws must be ZERO.
//
// Usage: node tools/shadowCacheProbe.mjs [outDir]   (PNGs land in outDir, default scratch/sc1/)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || 'scratch/sc1';
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

const server = await createServer({ server: { port: 5212, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5212/play/');

const W = 640, H = 400;
const result = await page.evaluate(async ({ W, H }) => {
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE, lanternColor, dungeonAmbient, dungeonFog } = await import('/src/render/enhancedLighting.js');
  const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
  const { DUNGEON_FOG } = await import('/src/render/underwaterFog.js');
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  document.body.appendChild(canvas);
  const r = new Renderer(canvas);
  const gl = r.gl;
  const stone = (() => { const w = 32, h = 32, colors = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const v = 150 + ((i * 7919) % 61); colors[i * 4] = v; colors[i * 4 + 1] = v - 10; colors[i * 4 + 2] = v - 25; colors[i * 4 + 3] = 255; } return { width: w, height: h, colors }; })();
  const body = (() => { const w = 32, h = 32, colors = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const inside = x > 8 && x < 24; const i = (y * w + x) * 4; colors[i] = 120; colors[i + 1] = 90; colors[i + 2] = 70; colors[i + 3] = inside ? 255 : 0; } return { width: w, height: h, colors }; })();
  r.uploadTexture(1, 1, stone);
  r.uploadTexture(201, 1, body);
  const P = [], N = [], UV = [], IDX = [];
  const subs = [];
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
  const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs.map(({ name, ...sm }) => sm) });
  const walker = r.createBillboardBatch(201, 1, { w: 1, h: 2 }, [[0, 0, 0]]);
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  const eye = [0, 1.7, 9];
  const view = lookAt(eye, [0, 1.2, -4], [0, 1, 0]);
  const I = identity();
  const lights = new Float32Array([0, 2, -6, 12, 4, 2.5, 1, 7, -5, 2, 3, 9]);
  const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const run = (cache) => {
    r.setLightingLane(EL_LANE); r.setAir(true); r.setContact(true); r.setShadowCache(cache);
    if (r.air) r.air._now = () => 1000;
    r.setPointLights(lights, lanternColor(true, new Float32Array([0.8, 0.8, 0.8])));
    r.setClearColor([0, 0, 0, 1]);
    r.setLighting(dungeonAmbient(true, new Float32Array([0.12, 0.12, 0.12])), 0);
    const fog = dungeonFog(true, DUNGEON_FOG);
    r.setFog(fog.mode, fog.density, fog.start, fog.end, new Float32Array(fog.color));
    const lightDir = new Float32Array([0.45, 0.8, 0.35]);
    const frames = [];
    // the cache's memory is on the objects and the slots: a fresh start for each run
    if (r.shadows) { r.shadows._slotLight.fill(NaN); r.shadows._slotCached.fill(0); r.shadows._slotLiveDyn.fill(0); }
    delete mesh._shMat; delete walker._shSeen;
    for (let f = 0; f < 9; f++) {
      const walking = f < 6;
      walker.origin = [2 - f * 0.6, 0, -3];
      r.beginFrame(proj, view, lightDir, WORLD_FRAME);
      const st = { ...r.shadows.stats, casters: r.shadows.casters };
      r.drawMesh(mesh, I, null);
      if (walking) r.drawBillboards([walker], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
      r.resolveFrame();
      frames.push({ px: Array.from(read()), st, err: gl.getError(), walking });
    }
    return frames;
  };
  return { on: run(true), off: run(false), renderer: gl.getParameter(gl.RENDERER) };
}, { W, H });

console.log('renderer:', result.renderer);
const compare = (a, b) => { let maxd = 0, over = 0; for (let i = 0; i < a.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(a[i] - b[i]); if (d > maxd) maxd = d; if (d > 2) over++; } return { maxd, over }; };
for (let f = 0; f < result.on.length; f++) {
  const on = result.on[f], off = result.off[f];
  const a = Uint8Array.from(on.px), b = Uint8Array.from(off.px);
  if (f === 3 || f === 8) { writeFileSync(`${outDir}/frame${f}-cache.png`, png(W, H, a)); writeFileSync(`${outDir}/frame${f}-plain.png`, png(W, H, b)); }
  const c = compare(a, b);
  console.log(`frame ${f}${on.walking ? ' (walker)' : ' (still)   '}: cache on - point draws ${on.st.pointDraws} (static faces ${on.st.staticFaces}, dyn faces ${on.st.dynFaces}, blits ${on.st.blits}, cached slots ${on.st.cachedSlots}); off - point draws ${off.st.pointDraws} | max |diff| ${c.maxd}, ${c.over} channels over 2`);
  check(`frame ${f}: no GL error`, on.err === 0 && off.err === 0, `${on.err}/${off.err}`);
  if (f >= 1) check(`frame ${f}: the same picture as the full replay (a dither byte at most)`, c.maxd <= 2 && c.over === 0, `max ${c.maxd}, ${c.over} over`);
}
const on = result.on, off = result.off;
check('the first replay draws the caches (three casters, eighteen static faces)', on[1].st.staticFaces === 18, `${on[1].st.staticFaces}`);
// frame 1 replays the first records (the walker's first sight is still: everything into the caches); frame 2 sees its
// first step (the caches drawn again without it, the walker on top); from frame 3 the caches stand and the walker alone is drawn
check('with the walker crossing, the cache draws the walker alone - a fraction of the full replay - every frame once its step is seen', on.slice(3, 6).every((f, i) => f.st.staticFaces === 0 && f.st.pointDraws < off[i + 3].st.pointDraws / 3), on.slice(3, 6).map((f, i) => `${f.st.pointDraws} vs ${off[i + 3].st.pointDraws}`).join(', '));
check('with the walker gone, one blit puts the caches back (the frame its absence is seen), and then NOTHING - no draw, no blit', on[7].st.pointDraws === 0 && on[7].st.blits === 18 && on[8].st.pointDraws === 0 && on[8].st.blits === 0, `frame 7: ${on[7].st.pointDraws} draws, ${on[7].st.blits} blits; frame 8: ${on[8].st.pointDraws} draws, ${on[8].st.blits} blits`);
check('...while the old path still draws the room', off[8].st.pointDraws > 0, `${off[8].st.pointDraws}`);
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'SHADOW CACHE PROBE: ALL GREEN' : `SHADOW CACHE PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
