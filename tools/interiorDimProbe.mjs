// INTERIOR-DIM (2026-10-11, Mac: "I want to improve interior lighting to be more like this and less bright"): A ROOM
// LIT BY DAGGERFALL'S OWN INTERIOR LAMPS ON THE ENHANCED LIGHTING LANE, BEFORE AND AFTER, through the real renderer on
// SwiftShader (bible/07-Rendering/Enhanced-Lighting-Arc.md INTERIOR-DIM).
//
// No game data: the room is boxes under flat synthetic textures (dark green walls, brown floor, wood above), its lamps
// AddLight's second switch's own (world/interior/interiorLights.js interiorLightProperties) at DaggerfallInterior's ambient. Two
// rooms - a tavern (four hung lanterns, two candles, a mounted torch and a prefab-white lamp) and a hall (two hung
// lanterns, the screenshot Mac sent) - each drawn twice: BEFORE (the colour x intensity the hosts uploaded, the lane's
// default eye) and AFTER (interiorLightColor and interiorGrade, as both interior hosts now call them). Each runs eight
// seconds of the eye's clock so the adaptation settles, then reads the frame back.
//   - prints each frame's display-luminance percentiles (p5..p99) - the numbers the screenshot was measured by;
//   - checks AFTER is darker than BEFORE at the median, in both rooms, and that no GL error or page error occurred;
//   - writes the four pictures as PNG to the directory given (default: the OS temp directory). They are synthetic -
//     no ARENA2 texel - so they may be looked at anywhere.
//
// Usage: node tools/interiorDimProbe.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.argv[2] || tmpdir();
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };

const server = await createServer({ server: { port: 5214, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 700, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5214/play/');

const shots = await page.evaluate(async () => {
  const W = 480, H = 270;
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE, EL_EXPOSURE, interiorLightColor, interiorGrade } = await import('/src/render/enhancedLighting.js');
  const { INTERIOR_AMBIENT, INTERIOR_LIGHT_DIR, interiorLightProperties } = await import('/src/world/interior/interiorLights.js');
  const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
  const tex = (base, spread) => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const n = ((i * 7919) % 97) / 97 - 0.5;
      for (let k = 0; k < 3; k++) colors[i * 4 + k] = Math.max(0, Math.min(255, Math.round(base[k] + n * spread)));
      colors[i * 4 + 3] = 255;
    }
    return { width: w, height: h, colors };
  };
  const ROOMS = {
    tavern: [
      [25, -6, 4.2, -4], [25, 6, 4.2, -4], [25, -6, 4.2, 5], [25, 6, 4.2, 5],   // lanterns with a medium chain
      [3, -3, 1.3, 1], [3, 4, 1.3, 2],                                          // candles on the tables
      [17, 11.6, 2.5, 0],                                                       // a mounted torch
      [16, -11.6, 2.5, -2],                                                     // a "todo" record: the prefab's white
    ],
    hall: [[25, -5, 4.6, -3], [25, 5, 4.6, -3]],
  };
  const build = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    document.body.appendChild(canvas);
    const r = new Renderer(canvas);
    r.uploadTexture(1, 1, tex([46, 62, 50], 18));   // the walls: dark green
    r.uploadTexture(1, 2, tex([92, 74, 52], 22));   // the floor: brown stone
    r.uploadTexture(1, 3, tex([70, 46, 28], 16));   // the ceiling and the furniture: wood
    const P = [], N = [], UV = [], IDX = [], subs = [];
    const quad = (a, b, c, d, n) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, 4, 0, 4, 4, 0, 4); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
    const sub = (record, draw) => { const start = IDX.length; draw(); subs.push({ textureArchive: 1, textureRecord: record, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
    // shadowTavernProbe.mjs's box: outward faces, or (outward false) each turned in - a room seen from inside
    const box = (x0, y0, z0, x1, y1, z1, faces = 'xyz', outward = true) => {
      const q = (a, b, c, d, n) => (outward ? quad(a, b, c, d, n) : quad(d, c, b, a, [-n[0], -n[1], -n[2]]));
      if (faces.includes('z')) { q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]); }
      if (faces.includes('x')) { q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]); }
      if (faces.includes('t')) q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
      if (faces.includes('b')) q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
      if (faces === 'xyz') { q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]); }
    };
    sub(1, () => box(-12, 0, -10, 12, 6, 10, 'xz', false));   // the walls
    sub(2, () => box(-12, 0, -10, 12, 6, 10, 'b', false));    // the floor
    sub(3, () => {
      box(-12, 0, -10, 12, 6, 10, 't', false);        // the ceiling
      box(-8, 0, -7, 8, 1.1, -6);                     // the counter
      box(-4, 0.9, 0, -2, 1.05, 2); box(3, 0.9, 1, 5, 1.05, 3);   // two tables
      box(-9.5, 0, 2.5, -9, 6, 3); box(9, 0, 2.5, 9.5, 6, 3);     // pillars
    });
    const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    r.setLightingLane(EL_LANE); r.setExposure(EL_EXPOSURE); r.setAir(true); r.setContact(true);
    return { r, gl: r.gl, mesh, canvas };
  };
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 200));
  const view = lookAt([0, 1.7, 9.4], [0, 1.6, -6], [0, 1, 0]);
  const I = identity();
  const out = [];
  for (const [room, lamps] of Object.entries(ROOMS)) {
    for (const mode of ['before', 'after']) {
      const S = build();
      const { r, gl } = S;
      let t = 1000;
      if (r.air) r.air._now = () => t;
      const data = new Float32Array(lamps.length * 4), colors = new Float32Array(lamps.length * 3);
      lamps.forEach(([record, x, y, z], i) => {
        const L = interiorLightProperties(record);
        data.set([x, y, z, L.range], i * 4);
        colors.set(mode === 'after' ? interiorLightColor(true, L.color, L.intensity) : [L.color[0] * L.intensity, L.color[1] * L.intensity, L.color[2] * L.intensity], i * 3);
      });
      let px = null, err = 0;
      for (let f = 0; f < 80; f++) {   // eight seconds of the eye's clock, a tenth of a second a frame (its bound)
        t += 100;
        r.setPointLights(data, null, colors);
        r.setClearColor([0, 0, 0, 1]);
        r.setLighting(new Float32Array(INTERIOR_AMBIENT), 0);
        r.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
        r.everyLightCasts();
        if (mode === 'after') r.setSceneGrade(interiorGrade(true));
        r.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);
        r.drawMesh(S.mesh, I, null);
        r.resolveFrame();
        if (f === 79) { px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); }
        err ||= gl.getError();
      }
      // the picture, upright, as a PNG
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
      const ctx = c2.getContext('2d'), img = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      ctx.putImageData(img, 0, 0);
      out.push({ room, mode, err, px: Array.from(px), png: c2.toDataURL('image/png').split(',')[1] });
      S.canvas.remove();
    }
  }
  return out;
});

const dec = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const stats = {};
mkdirSync(OUT, { recursive: true });
for (const s of shots) {
  const lums = [];
  for (let i = 0; i < s.px.length; i += 4) lums.push(0.2126 * dec(s.px[i] / 255) + 0.7152 * dec(s.px[i + 1] / 255) + 0.0722 * dec(s.px[i + 2] / 255));
  lums.sort((a, b) => a - b);
  const at = (p) => enc(lums[Math.min(lums.length - 1, Math.floor((p / 100) * lums.length))]);
  stats[`${s.room}/${s.mode}`] = { p5: at(5), p25: at(25), p50: at(50), p75: at(75), p95: at(95), p99: at(99) };
  const file = join(OUT, `interior-dim-${s.room}-${s.mode}.png`);
  writeFileSync(file, Buffer.from(s.png, 'base64'));
  const st = stats[`${s.room}/${s.mode}`];
  console.log(`     ${s.room.padEnd(6)} ${s.mode.padEnd(6)} display luminance p5 ${st.p5.toFixed(3)} p25 ${st.p25.toFixed(3)} p50 ${st.p50.toFixed(3)} p75 ${st.p75.toFixed(3)} p95 ${st.p95.toFixed(3)} p99 ${st.p99.toFixed(3)}  -> ${file}`);
  check(`${s.room} ${s.mode}: no GL error`, !s.err, String(s.err));
}
for (const room of ['tavern', 'hall']) {
  const b = stats[`${room}/before`], a = stats[`${room}/after`];
  check(`${room}: the room is darker after at the median`, a.p50 < b.p50, `${b.p50.toFixed(3)} -> ${a.p50.toFixed(3)}`);
  check(`${room}: and still lit - the lamps' pools stand above the dark`, a.p99 > a.p25 * 2, `p25 ${a.p25.toFixed(3)}, p99 ${a.p99.toFixed(3)}`);
}
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'INTERIOR DIM PROBE: ALL GREEN' : `INTERIOR DIM PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
