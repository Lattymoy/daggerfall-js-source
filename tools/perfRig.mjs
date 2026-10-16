// PERF-RIG (2026-10-10, Dudey: "the game has huge performance issues in almost all departments, it needs huge
// optimizations without quality decrease"): THE RENDERER'S FRAME, MEASURED WITHOUT ARENA2.
//
// tools/frameProbe.mjs measures the real game and needs the freeware ARENA2; a session that cannot fetch it could only
// read the frame. This builds the frame's PASSES instead - the real Renderer, the Enhanced Lighting lane, the air pass,
// the shadow pass, contact shadows and the light clusters - over a synthetic scene of the shapes a town has: a streamed
// ground (a tile array, a tilemap, mips), a few hundred textured houses, a thousand cut-out flats in batches, and
// lanterns. Three scenes: `night` (a town after dark: lanterns, the moon), `day` (the sun's cascades) and `dungeon` (a
// lit hall, every light casting - DISC15).
//
// Each frame is timed twice in the page: SCRIPT (beginFrame to the resolve, the JavaScript and the GL calls submitted)
// and FRAME (the same plus a 1-pixel readback - the GPU's work finished). On SwiftShader the frame is the software
// GPU's and only RELATIVE; the script is the renderer's own JavaScript. The last frame's pixels are written to OUT_DIR
// (if set) so two trees can be compared pixel for pixel.
//
// Usage: node tools/perfRig.mjs [scene=night] [frames=12]
//   W=640 H=360        the canvas
//   FLAGS=air-off,contact-off,lane-off,clusters-off,cache-off   the passes' doors, for attribution
//   OUT_DIR=/tmp/x     write <scene>.rgba (raw RGBA, bottom-up) of the last frame
//   PORT=5291
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCENE = process.argv[2] || 'night';
const FRAMES = Number(process.argv[3] || 12);
const W = Number(process.env.W || 640), H = Number(process.env.H || 360);
const FLAGS = (process.env.FLAGS || '').split(',').filter(Boolean);
const PORT = Number(process.env.PORT || 5291);
const ZONES = process.env.ZONES === '1';   // per-group GPU time (syncs between groups)
const SKIP = (process.env.SKIP || '').split(',').filter(Boolean);   // meshes,terrain,flats - leave a draw group out

const server = await createServer({ root: ROOT, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W + 20, height: H + 20 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text().slice(0, 300)}`); });
await page.goto(`http://localhost:${PORT}/src/render/bounds.js`);   // a page on the server's origin that boots nothing

const out = await page.evaluate(async ({ ORDER, SCENE, FRAMES, W, H, FLAGS, SKIP, ZONES }) => {
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE, lanternColor, dungeonAmbient, dungeonFog } = await import('/src/render/enhancedLighting.js');
  const { perspective, lookAt, mirrorProjectionX, translation } = await import('/src/world/mat4.js');
  const { DUNGEON_FOG } = await import('/src/render/underwaterFog.js');
  // a seeded generator - both trees build the same scene
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const img = (w, h, fill) => {
    const colors = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const c = fill(x, y); colors[i] = c[0]; colors[i + 1] = c[1]; colors[i + 2] = c[2]; colors[i + 3] = c[3]; }
    return { width: w, height: h, colors };
  };
  document.body.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  document.body.appendChild(canvas);
  const r = new Renderer(canvas);
  const lane = !FLAGS.includes('lane-off');
  r.setLightingLane(lane ? EL_LANE : null);
  r.setAir(!FLAGS.includes('air-off'));
  r.setContact(!FLAGS.includes('contact-off'));
  r.setShadowCache(!FLAGS.includes('cache-off'));
  if (FLAGS.includes('clusters-off')) r._clustersOff = true;
  if (r.air) r.air._now = () => 1000;
  const gl = r.gl;

  // ── textures: walls, roofs, flats ──
  for (let a = 0; a < 12; a++) {
    const base = [90 + a * 11, 70 + a * 7, 60 + a * 5];
    r.uploadTexture(400 + a, 0, img(64, 64, (x, y) => { const n = ((x * 7 + y * 13 + a * 31) % 23) * 3; const mortar = (y % 16 === 0 || (x + (y >> 4) * 8) % 32 === 0) ? -40 : 0; return [base[0] + n + mortar, base[1] + n + mortar, base[2] + n + mortar, 255]; }));
  }
  for (let a = 0; a < 20; a++) {
    // a tree-like cut-out: a trunk and a crown
    r.uploadTexture(500 + a, 0, img(64, 128, (x, y) => {
      const dx = x - 32, cy = 80 - (a % 5) * 4, dy = y - cy;
      const crown = dx * dx + dy * dy * 0.6 < 900 - (a % 7) * 40;
      const trunk = Math.abs(dx) < 4 && y < 60;
      if (crown) return [30 + (x * y) % 40, 90 + (x + y) % 60, 30, 255];
      if (trunk) return [80, 60, 40, 255];
      return [0, 0, 0, 0];
    }));
  }
  const groundLayers = [];
  for (let l = 0; l < 56; l++) groundLayers.push(img(64, 64, (x, y) => { const n = ((x * 31 + y * 17 + l * 7) % 29); return [70 + l + n, 90 + (l % 7) * 6 + n, 50 + n, 255]; }));
  const tileArr = r.uploadTileArray(302, groundLayers);

  // ── the scene ──
  const P = [], N = [], UV = [], IDX = [];
  const subs = [];
  const quad = (a, b, c, d, n, u = 1, v = 1) => { const base = P.length / 3; for (const p of [a, b, c, d]) P.push(...p); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, u, 0, u, v, 0, v); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
  const box = (x0, y0, z0, x1, y1, z1, outward = true) => {
    const q = (a, b, c, d, n) => (outward ? quad(a, b, c, d, n, 2, 2) : quad(d, c, b, a, [-n[0], -n[1], -n[2]], 2, 2));
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); if (!outward) q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  };
  const meshes = [];
  const flush = () => {
    if (!IDX.length) return;
    meshes.push(r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs.splice(0) }));
    P.length = 0; N.length = 0; UV.length = 0; IDX.length = 0;
  };
  const sub = (arch, draw) => { const start = IDX.length; draw(); subs.push({ textureArchive: arch, textureRecord: 0, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
  const batches = [];
  let lights;
  let proj, view, lightDir, terrain = null, tilemap = null;
  const dungeon = SCENE === 'dungeon';
  if (!dungeon) {
    // the ground: one streamed pixel's grid (128 x 6.4 units), gently rolling
    const G = 64, SPAN = 128 * 6.4;
    const pos = new Float32Array((G + 1) * (G + 1) * 3), nor = new Float32Array((G + 1) * (G + 1) * 3);
    const hgt = (x, z) => 3 * Math.sin(x * 0.011) * Math.cos(z * 0.013) + 1.5 * Math.sin(x * 0.05 + z * 0.03);
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const x = i / G * SPAN, z = j / G * SPAN, k = (j * (G + 1) + i) * 3;
      pos[k] = x; pos[k + 1] = hgt(x, z); pos[k + 2] = z;
      const dx = hgt(x + 1, z) - hgt(x - 1, z), dz = hgt(x, z + 1) - hgt(x, z - 1), l = Math.hypot(dx, 2, dz);
      nor[k] = -dx / l; nor[k + 1] = 2 / l; nor[k + 2] = -dz / l;
    }
    const idx = new Uint32Array(G * G * 6);
    for (let j = 0, o = 0; j < G; j++) for (let i = 0; i < G; i++) { const a = j * (G + 1) + i, b = a + 1, c = a + G + 1, d = c + 1; idx.set([a, c, b, b, c, d], o); o += 6; }
    terrain = r.createTerrainSurface(pos, nor, idx);
    const tm = new Uint8Array(128 * 128);
    for (let i = 0; i < tm.length; i++) tm[i] = (Math.floor(rnd() * 56) << 2) | Math.floor(rnd() * 4);
    tilemap = r.uploadTilemapTexture(tm, 128);
    // the houses: a town's worth in a square about the eye (the eye at the pixel's middle)
    const C = SPAN / 2;
    for (let b = 0; b < 260; b++) {
      const ang = rnd() * Math.PI * 2, dist = 12 + rnd() * 260;
      const x = C + Math.cos(ang) * dist, z = C + Math.sin(ang) * dist;
      if (Math.abs(x - C) < 5) continue;   // the street the eye looks down
      const w = 4 + rnd() * 8, d = 4 + rnd() * 8, h = 4 + rnd() * 9;
      sub(400 + (b % 12), () => box(x - w / 2, -1, z - d / 2, x + w / 2, h, z + d / 2));
      sub(400 + ((b + 5) % 12), () => box(x - w / 2 - 0.4, h, z - d / 2 - 0.4, x + w / 2 + 0.4, h + 1.2, z + d / 2 + 0.4));
      if (ORDER ? true : b % 20 === 19) { flush(); meshes[meshes.length - 1].d = Math.hypot(x - C, z - (C - 40)); }   // a model each twenty houses - the town's static batches (ORDER=near|far: one a house, sorted)
    }
    flush();
    if (ORDER) meshes.sort((a, b) => (ORDER === 'near' ? 1 : -1) * ((a.d ?? 1e9) - (b.d ?? 1e9)));
    // the flats: trees and clutter, 50 batches of 24
    for (let k = 0; k < 50; k++) {
      const centers = [];
      for (let f = 0; f < 24; f++) { const ang = rnd() * Math.PI * 2, dist = 6 + rnd() * 380; centers.push([C + Math.cos(ang) * dist, 0, C + Math.sin(ang) * dist]); }
      batches.push(r.createBillboardBatch(500 + (k % 20), 0, { w: 4 + (k % 3), h: 8 + (k % 4) }, centers));
    }
    // the lanterns: along the houses, 36 of them
    const L = [];
    for (let i = 0; i < 36; i++) { const ang = rnd() * Math.PI * 2, dist = 6 + rnd() * 120; L.push(C + Math.cos(ang) * dist, 3, C + Math.sin(ang) * dist, 10 + rnd() * 8); }
    lights = new Float32Array(L);
    proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 2500));
    view = lookAt([C, 3.5, C - 40], [C, 2, C + 200], [0, 1, 0]);
    lightDir = new Float32Array(SCENE === 'day' ? [0.35, 0.8, 0.48] : [0.2, 0.6, 0.77]);
  } else {
    // a dungeon hall with pillars and rooms
    sub(400, () => box(-40, 0, -40, 40, 8, 40, false));
    for (let i = 0; i < 60; i++) { const x = -36 + (i % 10) * 8, z = -36 + Math.floor(i / 10) * 12; sub(401 + (i % 6), () => box(x, 0, z, x + 1.2, 8, z + 1.2)); }
    for (let i = 0; i < 8; i++) { const z = -30 + i * 8; sub(407, () => box(-20, 0, z, 20, 4, z + 0.5)); }
    flush();
    for (let k = 0; k < 10; k++) {
      const centers = [];
      for (let f = 0; f < 12; f++) centers.push([-34 + rnd() * 68, 0, -34 + rnd() * 68]);
      batches.push(r.createBillboardBatch(500 + k, 0, { w: 1, h: 1.8 }, centers));
    }
    const L = [];
    for (let i = 0; i < 40; i++) L.push(-36 + (i % 8) * 10, 4, -36 + Math.floor(i / 8) * 16, 10 + (i % 3) * 3);
    lights = new Float32Array(L);
    proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 400));
    view = lookAt([0, 1.7, 30], [0, 1.4, -20], [0, 1, 0]);
    lightDir = new Float32Array([0.45, 0.8, 0.35]);
  }
  const I = translation ? translation(0, 0, 0) : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const camRight = new Float32Array([1, 0, 0]), camUp = new Float32Array([0, 1, 0]);
  const lampColors = lanternColor(lane, new Float32Array([0.9, 0.75, 0.5]));
  const frame = () => {
    r.setPointLights(lights, lampColors);
    r.setClearColor([0.3, 0.4, 0.6, 1]);
    if (dungeon) {
      r.setLighting(dungeonAmbient(lane, new Float32Array([0.12, 0.12, 0.12])), 0);
      const fog = dungeonFog(lane, DUNGEON_FOG);
      r.setFog(fog.mode, fog.density, fog.start, fog.end, new Float32Array(fog.color));
      r.everyLightCasts();
    } else if (SCENE === 'day') {
      r.setLighting(new Float32Array([0.35, 0.36, 0.4]), 1, new Float32Array([1, 0.95, 0.85]));
      r.setFog('linear', 0, 200, 2200, new Float32Array([0.6, 0.65, 0.75]));
    } else {
      r.setLighting(new Float32Array([0.08, 0.08, 0.12]), 0);
      r.setMoonlight?.({ dir: new Float32Array([-0.3, 0.7, 0.2]), scale: 0.25, color: new Float32Array([0.6, 0.65, 0.8]) });
      r.setFog('linear', 0, 100, 900, new Float32Array([0.05, 0.06, 0.1]));
    }
    zone('begin');
    r.beginFrame(proj, view, lightDir, WORLD_FRAME);
    zone('meshes');
    if (!SKIP.includes('meshes')) for (const m of meshes) r.drawMesh(m, I, null);
    zone('terrain');
    if (terrain && !SKIP.includes('terrain')) r.drawTerrain(terrain, I, tileArr, tilemap, 6.4);
    zone('flats');
    if (!SKIP.includes('flats')) r.drawBillboards(batches, camRight, camUp);
    zone('resolve');
    r.resolveFrame();
    zone(null);
  };
  // ZONES: each group's GPU work finished before the next starts (a 1-pixel readback) - the wall time between marks.
  // SwiftShader here exposes no timer query; the sync costs the frame a few readbacks, the same in every arm.
  let open = null, openAt = 0, counting = false; const zoneSum = {}; const zoneN = {};
  const zone = (name) => {
    if (!ZONES) return;
    if (open) { finish(); const t = performance.now(); if (counting) { zoneSum[open] = (zoneSum[open] ?? 0) + (t - openAt); zoneN[open] = (zoneN[open] ?? 0) + 1; } }
    open = name; openAt = performance.now();
  };
  const collect = (count) => { counting = count; };
  const finish = () => { const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const rows = [];
  for (let f = 0; f < FRAMES; f++) {
    const t0 = performance.now();
    frame();
    const t1 = performance.now();
    finish();
    const t2 = performance.now();
    collect(f + 1 >= Math.min(3, FRAMES - 1));
    rows.push({ script: t1 - t0, frame: t2 - t0, draws: r.stats.draws });
  }
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let hash = 2166136261;
  for (let i = 0; i < px.length; i++) hash = Math.imul(hash ^ px[i], 16777619) >>> 0;
  const zones = Object.fromEntries(Object.keys(zoneSum).map((k) => [k, +(zoneSum[k] / zoneN[k]).toFixed(1)]));
  return { zones, rows, hash, err: gl.getError(), px: Array.from(px), shadowStats: r.shadows ? { ...r.shadows.stats } : null };
}, { SCENE, FRAMES, W, H, FLAGS, SKIP, ZONES, ORDER: process.env.ORDER });

const warm = Math.min(3, out.rows.length - 1);   // the first frames compile and fill the caches
const tail = out.rows.slice(warm);
const med = (k) => { const v = tail.map((x) => x[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
const mean = (k) => tail.reduce((a, x) => a + x[k], 0) / tail.length;
console.log(`${SCENE.padEnd(8)} ${FLAGS.join(',') || '-'}  frame med ${med('frame').toFixed(1)} ms (mean ${mean('frame').toFixed(1)})  script med ${med('script').toFixed(2)} ms (mean ${mean('script').toFixed(2)})  draws ${tail[0]?.draws}  hash ${out.hash.toString(16)}  glErr ${out.err}`);
console.log('  gpu zones ms:', JSON.stringify(out.zones));
if (process.env.VERBOSE) console.log(JSON.stringify(out.rows.map((x) => [x.script.toFixed(2), x.frame.toFixed(1)])), JSON.stringify(out.shadowStats));
if (process.env.OUT_DIR) { mkdirSync(process.env.OUT_DIR, { recursive: true }); writeFileSync(`${process.env.OUT_DIR}/${SCENE}${FLAGS.length ? `.${FLAGS.join('_')}` : ''}.rgba`, Buffer.from(out.px)); }
if (errors.length) console.log('errors:', errors.slice(0, 8).join('\n  '));
// the rig judges its run (test/tooling/probehygiene.test.js T3): a page that threw, a GL error, or no frame drawn is no measure
if (errors.length || out.err !== 0 || !tail.length) process.exitCode = 1;
await browser.close(); await server.close();
