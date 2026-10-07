// CACHE-COPY (2026-10-07, Mac: "I want to fix the flickering issue properly"): A TAVERN THROUGH THE STATIC SHADOW CACHE
// ON A REAL GPU, frame by frame against the full replay - what the anti-flicker patch's player saw blink, built the way
// they described it (bible/07-Rendering/Enhanced-Lighting-Arc.md CACHE-COPY).
//
// tools/shadowCacheProbe.mjs proves the cache on one room with a walker. This is the room the reports were about:
// fourteen lamps (twelve full maps, the rest DISC15's lo tier - the host's everyLightCasts), townsfolk with an ORIGIN
// whose idle swaps their picture and nudges them a hair on a beat (in and out of the static set: every lamp in reach
// rebuilt at once), an animated flat with its centre in its vertices, and the player's own card. Two renderers, the
// cache on and `setShadowCache(false)`, drawn in lockstep through the real renderer on SwiftShader and read back:
//   - every frame must agree to within the dither's byte, but for ONE kind, recorded: the frame a flat that stood still
//     first changes its picture - the full replay reads the batch's live picture, the cache's movers take it a frame
//     later (the classification is the record's). Those frames are named and allowed;
//   - the static caches must rebuild (the beat reaches them) and the copies must run, or the probe proved nothing.
// SwiftShader is ANGLE over Vulkan: it never ran the Direct3D blit CACHE-COPY replaced. What this holds is that the
// copy by a draw is the full replay's picture, through every rebuild a tavern's idlers cause.
//
// Usage: node tools/shadowTavernProbe.mjs [frames=200] [period=100]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const FRAMES = Number(process.argv[2] || 200);
const PERIOD = Number(process.argv[3] || 100);
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };

const server = await createServer({ server: { port: 5213, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5213/play/');

const rows = await page.evaluate(async ({ FRAMES, PERIOD }) => {
  const W = 320, H = 200;
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE, lanternColor, dungeonAmbient, dungeonFog } = await import('/src/render/enhancedLighting.js');
  const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
  const { DUNGEON_FOG } = await import('/src/render/underwaterFog.js');
  const tex = (fill) => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const c = fill(x, y, i / 4); colors[i] = c[0]; colors[i + 1] = c[1]; colors[i + 2] = c[2]; colors[i + 3] = c[3]; }
    return { width: w, height: h, colors };
  };
  const stone = tex((x, y, i) => { const v = 150 + ((i * 7919) % 61); return [v, v - 10, v - 25, 255]; });
  const standing = tex((x) => [120, 90, 70, x > 8 && x < 24 ? 255 : 0]);
  const turned = tex((x, y) => [120, 90, 70, x > 6 && x < 26 && y > 4 ? 255 : 0]);
  const flicker = (k) => tex((x, y) => [200, 100, 50, ((x + y + k * 4) % 16) < 10 ? 255 : 0]);
  const build = (cache) => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    document.body.appendChild(canvas);
    const r = new Renderer(canvas);
    r.uploadTexture(1, 1, stone);
    r.uploadTexture(201, 1, standing); r.uploadTexture(201, 2, turned);
    for (let k = 0; k < 4; k++) r.uploadTexture(202, `1#${k}`, flicker(k));
    r.uploadTexture(203, 1, standing);
    const P = [], N = [], UV = [], IDX = [], subs = [];
    const quad = (a, b, c, d, n) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, 4, 0, 4, 4, 0, 4); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
    const box = (x0, y0, z0, x1, y1, z1, outward = true) => {
      const q = (a, b, c, d, n) => (outward ? quad(a, b, c, d, n) : quad(d, c, b, a, [-n[0], -n[1], -n[2]]));
      q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    };
    const sub = (draw) => { const start = IDX.length; draw(); subs.push({ textureArchive: 1, textureRecord: 1, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
    sub(() => box(-14, 0, -14, 14, 6, 14, false));   // the hall
    sub(() => box(-3, 0, -2.5, 3, 3.5, -2));          // a wall
    sub(() => box(5.5, 0, -6.5, 6.5, 6, -5.5));        // pillars
    sub(() => box(-7, 0, 1, -6, 6, 2));
    sub(() => box(-2, 0.8, 3, 2, 1.0, 5));             // a table top
    sub(() => box(8, 0, 2, 14, 6, 2.4));               // a partition
    const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    // the townsfolk: one batch each with an ORIGIN (a stood person), idling on the beat below
    const folk = [[-3, 0, -5], [3.5, 0, -4], [-5, 0, 4]].map((at) => { const b = r.createBillboardBatch(201, 1, { w: 1, h: 1.8 }, [[0, 0, 0]]); b.origin = at.slice(); b.home = at.slice(); return b; });
    const flame = r.createBillboardBatch(202, 1, { w: 0.8, h: 1.2 }, [[2, 0.3, -8]]); flame.frame = 0;   // FA1: its centre in its vertices
    const self = r.createBillboardBatch(203, 1, { w: 0.8, h: 1.8 }, [[0, 0, 0]]); self.origin = [0, 0, 8.4]; self.selfCard = true;   // DISC24-C
    r.setLightingLane(EL_LANE); r.setAir(true); r.setContact(true); r.setShadowCache(cache);
    if (r.air) r.air._now = () => 1000;
    return { r, gl: r.gl, mesh, folk, flame, self };
  };
  const lights = new Float32Array([
    0, 3, -6, 14, 4, 3.5, 1, 15, -5, 3, 3, 16, -10, 4, -10, 15, 10, 4, -10, 15, -10, 4, 10, 15, 10, 4, 10, 16,
    0, 5, 0, 18, 0, 3, 8, 12, -12, 3, 0, 14, 12, 3, 0, 14, 0, 3, -12, 14, 6, 2.5, 6, 12, -6, 2.5, -6, 12,
  ]);
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  const view = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);
  const I = identity();
  const lightDir = new Float32Array([0.45, 0.8, 0.35]);
  const read = (S) => { const px = new Uint8Array(W * H * 4); S.gl.readPixels(0, 0, W, H, S.gl.RGBA, S.gl.UNSIGNED_BYTE, px); return px; };
  // the beat: the first person idles in every period, the others from the second on - a picture swapped and the
  // person nudged 2 mm every fourth frame for the period's first twenty frames, then still
  const idling = (n, f) => f % PERIOD < 20 && (n === 0 || f >= PERIOD);
  const step = (S, f) => {
    const r = S.r;
    r.setPointLights(lights, lanternColor(true, new Float32Array([0.8, 0.8, 0.8])));
    r.setClearColor([0, 0, 0, 1]);
    r.setLighting(dungeonAmbient(true, new Float32Array([0.12, 0.12, 0.12])), 0);
    const fog = dungeonFog(true, DUNGEON_FOG);
    r.setFog(fog.mode, fog.density, fog.start, fog.end, new Float32Array(fog.color));
    for (const [n, b] of S.folk.entries()) {
      const turn = idling(n, f) && ((f % PERIOD >> 2) & 1) === 1;
      b.record = turn ? 2 : 1; b.origin[0] = b.home[0] + (turn ? 0.002 : 0);
    }
    S.flame.frame = (f >> 3) & 3;
    r.everyLightCasts();   // DISC15: a room drawn whole
    r.beginFrame(proj, view, lightDir, WORLD_FRAME);
    const st = { ...r.shadows.stats };
    r.drawMesh(S.mesh, I, null);
    r.drawBillboards([...S.folk, S.flame, S.self], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    r.resolveFrame();
    return { px: read(S), st, err: S.gl.getError() };
  };
  // the frames a still flat first changes its picture: a person's first turn after standing (frames 4 of a period it
  // idles in, whoever was still before it), the flame's first frame (8)
  const firstChange = (f) => f === 8 || (f % PERIOD === 4 && [0, 1, 2].some((n) => idling(n, f) && !(f >= 5 && idling(n, f - 5))));
  const A = build(true), B = build(false);
  const out = [];
  for (let f = 0; f < FRAMES; f++) {
    const a = step(A, f), b = step(B, f);
    let maxd = 0, over = 0;
    for (let i = 0; i < a.px.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(a.px[i] - b.px[i]); if (d > maxd) maxd = d; if (d > 2) over++; }
    out.push({ f, maxd, over, err: a.err || b.err, firstChange: firstChange(f), staticFaces: a.st.staticFaces, copies: a.st.blits, loFaces: a.st.loFaces });
  }
  return out;
}, { FRAMES, PERIOD });

let lagFrames = 0, rebuilds = 0, copies = 0;
for (const r of rows) {
  rebuilds += r.staticFaces; copies += r.copies;
  const same = r.maxd <= 2 && r.over === 0;
  if (r.err) check(`frame ${r.f}: no GL error`, false, String(r.err));
  if (r.f < 1) continue;   // the first frame replays nothing: its records are the next frame's
  if (!same && r.firstChange) { lagFrames++; console.log(`     frame ${r.f}: a still flat's first new picture, a frame late in the cache (recorded) - max ${r.maxd}, ${r.over} channels`); continue; }
  if (!same) check(`frame ${r.f}: the cache's picture is the full replay's`, false, `max ${r.maxd}, ${r.over} channels over 2 (static faces ${r.staticFaces}, copies ${r.copies})`);
}
check(`every other frame of ${rows.length} the full replay's picture, to a dither byte`, fails === 0);
check('the beat reached the caches: static faces rebuilt after the first replay', rows.slice(2).some((r) => r.staticFaces > 0), `${rebuilds} static faces in all`);
check('and the copies ran (the movers drawn over them every frame)', copies > 0, `${copies} faces copied`);
console.log(`     ${lagFrames} frame(s) of a still flat's first picture a frame late`);
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'SHADOW TAVERN PROBE: ALL GREEN' : `SHADOW TAVERN PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
