// EL5 (2026-09-17, THE FIELD): THE LANE ON A REAL GPU.
//
// Every Enhanced Lighting pin runs on a fake GL that compiles anything and
// draws nothing. The first field report ("the lights from inside the city
// are all bleeding through, tanking my framerate") was two laws the fake
// could not see: an occlusion test in hyperbolic depth, and replays that
// drew the whole town per face. This probe draws a synthetic room through
// the real renderer on a real WebGL2 context (headless Chromium, ANGLE
// over SwiftShader) - classic and lane, dungeon and exterior - reads the
// pixels back, writes PNGs beside the numbers, and FAILS on what a frame
// must never show:
//   - a program that does not compile or link (the pins cannot know);
//   - a frame that is black, white, or the clear colour alone;
//   - a lantern behind a wall whose glare reaches the wall's pixels (the
//     bleed: the wall's region is compared with and without the lantern);
//   - a lit floor that the wall does not shadow (the caster's map);
//   - a replay that culls nothing (the record spheres are wired).
//
// Usage: node tools/enhancedLightingProbe.mjs [outDir]   (PNGs land in outDir, default scratch/el5/)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || 'scratch/el5';
mkdirSync(outDir, { recursive: true });

// ---- a PNG writer (RGBA8, bottom-up rows from readPixels flipped) --------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
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
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;   // readPixels is bottom-up
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + src, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5210, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5210/play/');

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

  // ---- textures: a stone (noise) at 1_1, a flat with an alpha disc at 210_1
  const stone = (() => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const v = 150 + ((i * 7919) % 61); colors[i * 4] = v; colors[i * 4 + 1] = v - 10; colors[i * 4 + 2] = v - 25; colors[i * 4 + 3] = 255; }
    return { width: w, height: h, colors };
  })();
  const disc = (() => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - 16, dy = y - 16, inside = dx * dx + dy * dy < 12 * 12;
      const i = (y * w + x) * 4; colors[i] = 230; colors[i + 1] = 180; colors[i + 2] = 90; colors[i + 3] = inside ? 255 : 0;
    }
    return { width: w, height: h, colors };
  })();
  r.uploadTexture(1, 1, stone);
  r.uploadTexture(210, 1, disc);

  // ---- the room: a mesh builder
  const P = [], N = [], UV = [], IDX = [];
  let subs = [];
  const quad = (a, b, c, d, n, s = 4) => {   // a b c d counter-clockwise seen from the front (the normal's side)
    const base = P.length / 3;
    for (const v of [a, b, c, d]) P.push(...v);
    for (let k = 0; k < 4; k++) N.push(...n);
    UV.push(0, 0, s, 0, s, s, 0, s);
    IDX.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const box = (x0, y0, z0, x1, y1, z1, outward = true) => {
    const f = outward ? 1 : -1;
    const q = (a, b, c, d, n) => (outward ? quad(a, b, c, d, n) : quad(d, c, b, a, [-n[0], -n[1], -n[2]]));
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1 * f / f]);   // +z
    q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);          // -z
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);           // +x
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);          // -x
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);           // +y
    q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);          // -y
  };
  const sub = (name, build) => { const start = IDX.length; build(); subs.push({ name, textureArchive: 1, textureRecord: 1, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
  sub('room', () => box(-12, 0, -12, 12, 5, 12, false));        // the room, faces inward
  sub('wall', () => box(-3, 0, -2.5, 3, 3.5, -2));              // the wall between the eye and lantern A
  sub('pillar', () => box(5.5, 0, -6.5, 6.5, 5, -5.5));
  sub('far', () => box(-11, 0, -11.5, -9, 2, -10.5));            // a far crate, out of any lantern's range
  const model = { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs.map(({ name, ...sm }) => sm) };
  const mesh = r.createMesh(model);
  // the same scene under the open sky: the room's box replaced by a ground plane (a street: the wall, the pillar, the crate)
  P.length = N.length = UV.length = IDX.length = 0; subs = [];
  sub('ground', () => quad([-60, 0, 60], [60, 0, 60], [60, 0, -60], [-60, 0, -60], [0, 1, 0], 20));
  sub('wall', () => box(-3, 0, -2.5, 3, 3.5, -2));
  sub('pillar', () => box(5.5, 0, -6.5, 6.5, 5, -5.5));
  sub('far', () => box(-11, 0, -11.5, -9, 2, -10.5));
  const open = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs.map(({ name, ...sm }) => sm) });
  const flat = r.createBillboardBatch(210, 1, { w: 1, h: 2 }, [[-6, 1, 0]]);
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  const eye = [0, 1.7, 9];
  const view = lookAt(eye, [0, 1.2, -4], [0, 1, 0]);
  const I = identity();

  // ---- the lights: A behind the wall (its glare must not reach the wall), B in the open
  const lanternA = [0, 2, -6, 12], lanternB = [7, 2.5, 2, 10];
  const lights = (withA) => new Float32Array(withA ? [...lanternA, ...lanternB] : [...lanternB]);
  const DUNGEON_LIGHT = new Float32Array([0.8, 0.8, 0.8]);

  const stats = (label) => ({ label, gl: gl.getError(), shadows: r.shadows ? { ...r.shadows.stats, kind: r.shadows.kind, casters: r.shadows.casters, index: r.shadows.shadowIndex ? [...r.shadows.shadowIndex] : r.shadows.shadowIndex } : null, air: r.air ? { ...r.air.stats } : null });
  const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };

  const frames = {};
  const scene = (label, { lane, air, sun, withA, sky = false, night = false }) => {
    r.setLightingLane(lane ? EL_LANE : null);
    r.setAir(!!air);
    const on = !!lane;
    r.setPointLights(lights(withA), lanternColor(on, DUNGEON_LIGHT));
    if (sky && night) {
      r.setClearColor([0.02, 0.02, 0.05, 1]);
      r.setLighting(new Float32Array([0.09, 0.09, 0.12]), 0, new Float32Array([1, 0.95, 0.85]));
      r.setFog('linear', 0, 40, 140, new Float32Array([0.02, 0.02, 0.05]));
    } else if (sun) {
      r.setClearColor([0.53, 0.7, 0.92, 1]);
      r.setLighting(new Float32Array([0.35, 0.35, 0.4]), 0.9, new Float32Array([1, 0.95, 0.85]));
      r.setFog(sky ? 'linear' : 'exp', 0.0, 60, 180, new Float32Array([0.6, 0.6, 0.7]));
    } else {
      r.setClearColor([0, 0, 0, 1]);
      r.setLighting(dungeonAmbient(on, new Float32Array([0.12, 0.12, 0.12])), 0);
      const fog = dungeonFog(on, DUNGEON_FOG);
      r.setFog(fog.mode, fog.density, fog.start, fog.end, new Float32Array(fog.color));
    }
    const lightDir = sun ? new Float32Array([0.35, 0.8, 0.25]) : new Float32Array([0.45, 0.8, 0.35]);
    let st = null, px = null;
    for (let f = 0; f < 4; f++) {   // frame 1 records; frame 2 replays and draws the maps; a few more settle the eye
      r.beginFrame(proj, view, lightDir, WORLD_FRAME);
      st = stats(label);
      r.drawMesh(sky ? open : mesh, I, null);
      r.drawBillboards([flat], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
      r.resolveFrame();
      px = read();
    }
    frames[label] = { px: Array.from(px), stats: st };
  };
  scene('dungeon-classic', { lane: false, air: false, sun: false, withA: true });
  scene('dungeon-lane', { lane: true, air: true, sun: false, withA: true });
  scene('dungeon-lane-noA', { lane: true, air: true, sun: false, withA: false });
  scene('dungeon-lane-noair', { lane: true, air: false, sun: false, withA: true });
  scene('exterior-classic', { lane: false, air: false, sun: true, withA: true });
  scene('exterior-lane', { lane: true, air: true, sun: true, withA: true });
  scene('street-day-classic', { lane: false, air: false, sun: true, withA: true, sky: true });
  scene('street-day-lane', { lane: true, air: true, sun: true, withA: true, sky: true });
  scene('street-night-classic', { lane: false, air: false, sun: false, withA: true, sky: true, night: true });
  scene('street-night-lane', { lane: true, air: true, sun: false, withA: true, sky: true, night: true });
  // the wall's screen rectangle and the floor patch behind it (the shadowed one) and in front (lit by B)
  const project = (p) => { const v = [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14], 1];
    const c = [proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12] * v[3], proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13] * v[3], 0, proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15] * v[3]];
    return [(c[0] / c[3] * 0.5 + 0.5) * W, (c[1] / c[3] * 0.5 + 0.5) * H]; };
  const rect = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { x0: Math.round(Math.min(...xs)), x1: Math.round(Math.max(...xs)), y0: Math.round(Math.min(...ys)), y1: Math.round(Math.max(...ys)) }; };
  const wallRect = rect([[-3, 0.6, -2], [3, 0.6, -2], [3, 3.2, -2], [-3, 3.2, -2]].map(project));
  const shadowRect = rect([[-1.5, 0, 0], [1.5, 0, 0], [1.5, 0, 1.5], [-1.5, 0, 1.5]].map(project));   // the floor just in front of the wall, A's shadow, out of B's reach? (B at x 7)
  const openRect = rect([[4, 0, -4], [8, 0, -4], [8, 0, -1], [4, 0, -1]].map(project));   // floor under B, lit
  return { frames, wallRect, shadowRect, openRect, renderer: gl.getParameter(gl.RENDERER) };
}, { W, H });

// ---- the numbers
const lum = (px, i) => (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
const regionMean = (px, R) => { let s = 0, n = 0; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) { s += lum(px, (y * W + x) * 4); n++; } return n ? s / n : 0; };
const regionDiff = (a, b, R) => { let s = 0, n = 0; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) { const i = (y * W + x) * 4; s += Math.abs(lum(a, i) - lum(b, i)); n++; } return n ? s / n : 0; };
const summary = (px) => { let s = 0, black = 0, white = 0; for (let i = 0; i < px.length; i += 4) { const l = lum(px, i); s += l; if (l < 0.02) black++; if (l > 0.98) white++; } const n = px.length / 4; return { mean: +(s / n).toFixed(4), black: +(black / n).toFixed(3), white: +(white / n).toFixed(3) }; };
const failures = [];
for (const [label, f] of Object.entries(result.frames)) {
  const px = Uint8Array.from(f.px);
  writeFileSync(`${outDir}/${label}.png`, png(W, H, px));
  const sm = summary(px);
  console.log(label.padEnd(20), JSON.stringify(sm), 'gl', f.stats.gl, 'shadows', JSON.stringify(f.stats.shadows), 'air', JSON.stringify(f.stats.air));
  if (f.stats.gl !== 0) failures.push(`${label}: gl error ${f.stats.gl}`);
  if (sm.black > 0.97) failures.push(`${label}: the frame is black`);
  if (sm.white > 0.5) failures.push(`${label}: the frame is white`);
}
console.log('renderer:', result.renderer, '| wall rect', JSON.stringify(result.wallRect), 'shadow rect', JSON.stringify(result.shadowRect));
const lane = Uint8Array.from(result.frames['dungeon-lane'].px), noA = Uint8Array.from(result.frames['dungeon-lane-noA'].px);
const classic = Uint8Array.from(result.frames['dungeon-classic'].px);
const bleed = regionDiff(lane, noA, result.wallRect);
const wallLane = regionMean(lane, result.wallRect), wallNoA = regionMean(noA, result.wallRect);
const shadowLane = regionMean(lane, result.shadowRect), openLane = regionMean(lane, result.openRect);
const shadowClassic = regionMean(classic, result.shadowRect);
console.log(`the wall between the eye and lantern A: lane ${wallLane.toFixed(4)} vs without A ${wallNoA.toFixed(4)} (mean |diff| ${bleed.toFixed(4)})`);
console.log(`the floor in A's shadow behind the wall: lane ${shadowLane.toFixed(4)} (classic, unshadowed ${shadowClassic.toFixed(4)}); the open floor under B: ${openLane.toFixed(4)}`);
if (bleed > 0.02) failures.push(`lantern A bleeds through the wall (mean |diff| ${bleed.toFixed(4)} over the wall's pixels)`);
if (!(shadowLane < shadowClassic * 0.6)) failures.push(`the wall casts no shadow from lantern A (lane ${shadowLane.toFixed(4)} vs classic ${shadowClassic.toFixed(4)})`);
const sh = result.frames['dungeon-lane'].stats.shadows;
if (!sh || sh.culled === 0) failures.push('the replays culled nothing - the record spheres are not wired');
if (!sh || sh.casters < 2) failures.push(`two lanterns in range, ${sh?.casters} caster(s)`);
if (pageErrors.length) failures.push(...pageErrors.map((e) => 'pageerror: ' + e));
await browser.close(); await server.close();
if (failures.length) { console.log('FAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('OK');
