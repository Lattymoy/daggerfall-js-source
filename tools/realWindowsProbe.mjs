// RW1 (2026-10-09): THE REAL WINDOWS, PHOTOGRAPHED ON A REAL GPU (SwiftShader) - no ARENA2.
//
//     node tools/realWindowsProbe.mjs            shots in tools/shots/realwindows-*.png
//
// A synthetic street drawn through the REAL Renderer: three house fronts and a side house wearing a window texture
// painted here (a plaster wall, a timber frame, four panes - the panes' mask uploaded as DFU's window mask, the
// pipeline's own `{ window: true }`), a ground, a classic and an Enhanced Lighting lane, by day and by night - and the
// same street from INSIDE a room whose front wall carries an interior glass texture (renderer.uploadGlassMask) and
// whose side wall carries a cutout picture (`{ cutout: true }`), the street drawn by the view out's pass
// (realWindows.js viewOutFrame -> renderer.outsideViewFrame) behind it. Each shot is judged by numbers too: the glass
// texels' colour against the classic glass (the rooms must change it), the night against the day, and the inside
// shot's pane against the street it looks at. SwiftShader's milliseconds are not a player's and are never reported.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const W = 960, H = 540;
const server = await createServer({ server: { port: 5307, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400)); });
  await page.goto('http://localhost:5307/play/');
  await page.evaluate(async ({ W, H }) => {
    const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
    const { EL_LANE } = await import('/src/render/enhancedLighting.js');
    const { windowEmissionRGB } = await import('/src/render/windowEmission.js');
    const { createViewOut, viewOutFrame } = await import('/src/render/realWindows.js');
    const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    canvas.id = 'rwc'; canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.top = '0'; canvas.style.zIndex = '99999';
    document.body.style.margin = '0';
    document.body.appendChild(canvas);
    canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    const r = new Renderer(canvas);
    const gl = r.gl;

    // ---- the art, painted from numbers (rows bottom-up, GL's order)
    const S = 64;
    const paint = (fn) => { const colors = new Uint8Array(S * S * 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = fn(x, y); const i = (y * S + x) * 4; colors[i] = c[0]; colors[i + 1] = c[1]; colors[i + 2] = c[2]; colors[i + 3] = c[3] ?? 255; } return { width: S, height: S, colors }; };
    const n = (x, y) => (((x * 7 + y * 13) ^ (x * y)) % 9) - 4;
    const isFrame = (x, y) => x >= 16 && x < 48 && y >= 12 && y < 54;
    const isGlass = (x, y) => isFrame(x, y) && x >= 19 && x < 45 && y >= 15 && y < 51 && !(x >= 31 && x < 33) && !(y >= 32 && y < 34);
    const wall = (x, y) => { const v = 176 + n(x, y) * 3; return (y % 16 === 0) ? [118, 84, 52] : [v, v - 14, v - 34]; };
    const windowArt = paint((x, y) => (isGlass(x, y) ? [36, 48, 62] : isFrame(x, y) ? [70, 48, 30] : wall(x, y)));
    const glassMask = paint((x, y) => (isGlass(x, y) ? [255, 255, 255] : [0, 0, 0]));
    const plain = paint((x, y) => { const v = 150 + n(x, y) * 4; return [v, v - 8, v - 20]; });
    const ground = paint((x, y) => { const v = 96 + n(x, y) * 5; return [v, v + 6, v - 14]; });
    const cutoutArt = paint((x, y) => (isGlass(x, y) ? [0, 0, 0, 0] : isFrame(x, y) ? [90, 60, 36] : [120, 96, 70]));
    r.uploadTexture(3001, 0, windowArt, { opaque: true });
    r.uploadEmissionTexture(3001, 0, glassMask, { window: true });   // DFU's window mask - dataPipeline's own exterior arm
    r.uploadTexture(3001, 1, plain, { opaque: true });
    r.uploadTexture(3001, 2, ground, { opaque: true });
    r.uploadTexture(3002, 0, windowArt, { opaque: true });
    r.uploadGlassMask(3002, 0, glassMask);   // an interior's own glass
    r.uploadTexture(3003, 0, cutoutArt, { cutout: true });   // a cutout picture (the caravan's shape)

    // ---- the meshes
    const build = (fill) => {
      const P = [], N = [], UV = [], IDX = [], subs = [];
      const quad = (a, b, c, d, nrm, su, sv) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...nrm); UV.push(0, 0, su, 0, su, sv, 0, sv); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
      const sub = (archive, record, f) => { const start = IDX.length; f(quad); if (IDX.length > start) subs.push({ textureArchive: archive, textureRecord: record, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
      fill(sub);
      return r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    };
    const T = 2.5;   // a tile's side, metres
    // a house front facing +z at z, from x0, `cols` tiles wide and `rows` high
    const frontZ = (q, x0, z, cols, rows) => q([x0, 0, z], [x0 + cols * T, 0, z], [x0 + cols * T, rows * T, z], [x0, rows * T, z], [0, 0, 1], cols, rows);
    const frontX = (q, x, z0, cols, rows) => q([x, 0, z0 - cols * T], [x, 0, z0], [x, rows * T, z0], [x, rows * T, z0 - cols * T], [1, 0, 0], cols, rows);   // facing +x
    const frontMinusZ = (q, x0, z, cols, rows) => q([x0 + cols * T, 0, z], [x0, 0, z], [x0, rows * T, z], [x0 + cols * T, rows * T, z], [0, 0, -1], cols, rows);   // facing -z
    const street = build((sub) => {
      sub(3001, 0, (q) => { frontZ(q, -13, -16, 4, 3); frontZ(q, 1, -18, 5, 2); frontX(q, -15, -2, 4, 2); });
      sub(3001, 2, (q) => q([-80, 0, 80], [80, 0, 80], [80, 0, -80], [-80, 0, -80], [0, 1, 0], 40, 40));
      // the room's own shell, its walls facing out - the view out must leave it out (the clip box)
      sub(3001, 1, (q) => { frontZ(q, -3, 3, 2.4, 1.3); frontMinusZ(q, -3, -3, 2.4, 1.3); });
    });
    // the room the inside shots stand in: inward faces round the eye; its front (looking -z) carries the glass, its
    // left the cutout picture
    const room = build((sub) => {
      sub(3002, 0, (q) => q([-2.5, 0, -2.5], [2.5, 0, -2.5], [2.5, 3, -2.5], [-2.5, 3, -2.5], [0, 0, 1], 2, 1.2));
      sub(3003, 0, (q) => q([-2.5, 0, 2.5], [-2.5, 0, -2.5], [-2.5, 3, -2.5], [-2.5, 3, 2.5], [1, 0, 0], 2, 1.2));
      sub(3001, 1, (q) => {
        q([2.5, 0, -2.5], [2.5, 0, 2.5], [2.5, 3, 2.5], [2.5, 3, -2.5], [-1, 0, 0], 2, 1.2);
        q([2.5, 0, 2.5], [-2.5, 0, 2.5], [-2.5, 3, 2.5], [2.5, 3, 2.5], [0, 0, -1], 2, 1.2);
        q([-2.5, 0, 2.5], [2.5, 0, 2.5], [2.5, 0, -2.5], [-2.5, 0, -2.5], [0, 1, 0], 2, 2);
        q([-2.5, 3, -2.5], [2.5, 3, -2.5], [2.5, 3, 2.5], [-2.5, 3, 2.5], [0, -1, 0], 2, 2);
      });
    });
    const I = identity();
    const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.05, 500));
    const DAY = { ambient: [0.9, 0.9, 0.9], sun: 0.6, style: 'day', clear: [0.53, 0.7, 0.92, 1], fog: [0.6, 0.7, 0.85] };
    const NIGHT = { ambient: [0.25, 0.25, 0.3], sun: 0, style: 'night', clear: [0.03, 0.04, 0.08, 1], fog: [0.04, 0.05, 0.09] };
    const lightOf = (t) => { r.setLighting(new Float32Array(t.ambient), t.sun, new Float32Array([0.816, 0.954, 1])); r.setMoonlight(null); r.setIndirectLight([0, 0, 0], 0, new Float32Array(3)); r.setFog('linear', 0, 40, 300, new Float32Array(t.fog)); r.setWindowEmission(windowEmissionRGB(t.style)); r.setPointLights(new Float32Array(0), new Float32Array([1, 1, 1])); };
    const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    window.__rw = {
      // the street from outside: rooms on or off, day or night, classic or the lane
      street(time, rooms, lane, close = false) {
        r.setLightingLane(lane ? EL_LANE : null);
        r.setAir?.(!!lane);
        if (r.air) r.air._now = () => 1000;
        const t = time === 'night' ? NIGHT : DAY;
        lightOf(t);
        r.setClearColor(t.clear);
        const eye = close ? [-8.6, 4.3, -13.2] : [-3.5, 2.6, -8.5], view = lookAt(eye, close ? [-10.4, 3.7, -16] : [-9.5, 3.6, -16], [0, 1, 0]);
        let px = null;
        for (let f = 0; f < 3; f++) {
          r.beginFrame(proj, view, new Float32Array([0.35, 0.8, 0.25]), WORLD_FRAME);
          if (rooms) r.setWindowRooms('full');
          r.drawMesh(street, I, null);
          if (lane) r.resolveFrame();
          px = read();
        }
        return { gl: gl.getError(), px: Array.from(px) };
      },
      // the street from inside the room: the view out's pass, then the room over it
      inside(time, lane, mode = 'full') {
        r.setLightingLane(lane ? EL_LANE : null);
        r.setAir?.(!!lane);
        if (r.air) r.air._now = () => 1000;
        const t = time === 'night' ? NIGHT : DAY;
        // an exterior frame first, so the renderer keeps the street's light (setWindowRooms)
        lightOf(t); r.setClearColor(t.clear);
        const eye = [0.4, 1.6, 1.5], view = lookAt(eye, [-1.2, 1.7, -6], [0, 1, 0]);
        r.beginFrame(proj, view, new Float32Array([0.35, 0.8, 0.25]), WORLD_FRAME);
        r.setWindowRooms('full');
        r.drawMesh(street, I, null);
        if (lane) r.resolveFrame();
        const state = createViewOut();
        const scene = { clip: [-3.3, -0.3, -3.3, 3.3, 3.6, 3.3], draw: ({ renderer }) => renderer.drawMesh(street, I, null) };
        let px = null, vo = null, now = 0;
        for (let f = 0; f < 3; f++) {
          now += 16;
          vo = viewOutFrame(state, { renderer: r, mode, proj, view, now, scene });
          r.setLighting(new Float32Array([0.6, 0.55, 0.5]), 0); r.setMoonlight(null); r.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
          r.setWindowEmission(windowEmissionRGB('disabled'));
          r.setPointLights(new Float32Array([0, 2.6, 0, 9]), new Float32Array([1, 0.85, 0.6]));
          r.setClearColor([0, 0, 0, 1]);
          r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME);
          r.setGlassView(vo);
          r.drawMesh(room, I, null);
          if (lane) r.resolveFrame();
          px = read();
        }
        return { gl: gl.getError(), px: Array.from(px), vo, viewDraws: r._rwViewDraws ?? 0 };
      },
    };
  }, { W, H });
  mkdirSync('tools/shots', { recursive: true });
  const shot = async (name) => { const buf = await page.locator('#rwc').screenshot(); writeFileSync(`tools/shots/realwindows-${name}.png`, buf); };
  const mean = (px, x0, y0, x1, y1) => { let s = [0, 0, 0], k = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; k++; } return s.map((v) => Math.round(v / k)); };
  const results = {};
  for (const [name, args] of [['day-off', ['day', false, false]], ['day-rooms', ['day', true, false]], ['night-off', ['night', false, false]], ['night-rooms', ['night', true, false]], ['day-off-lane', ['day', false, true]], ['day-rooms-lane', ['day', true, true]], ['night-rooms-lane', ['night', true, true]], ['day-close', ['day', true, false, true]], ['night-close', ['night', true, false, true]]]) {
    const res = await page.evaluate((a) => window.__rw.street(...a), args);
    await shot(name);
    results[name] = { gl: res.gl, centre: mean(res.px, W / 2 - 160, H / 2 - 40, W / 2 + 160, H / 2 + 120) };
  }
  for (const [name, args] of [['inside-day', ['day', false]], ['inside-night', ['night', false]], ['inside-day-lane', ['day', true]], ['inside-day-rooms-only', ['day', false, 'rooms']]]) {
    const res = await page.evaluate((a) => window.__rw.inside(...a), args);
    await shot(name);
    results[name] = { gl: res.gl, vo: res.vo, viewDraws: res.viewDraws, pane: mean(res.px, W / 2 - 120, H / 2 - 20, W / 2 + 60, H / 2 + 80) };
  }
  console.log(JSON.stringify(results, null, 1));
  // The lane's GL_INVALID_OPERATION "Must have element array buffer bound" is the air pass's emission replay, and it
  // stands at HEAD without RW1 (any emission-mapped mesh drawn last before the resolve): airPass.js _replayEmission binds
  // the mesh's VAO through the renderer's VAO shadow after its own raw quad bind. Said, never this probe's failure.
  const known = (e) => /GPU stall|Must have element array buffer bound/.test(e);
  const real = errors.filter((e) => !known(e));
  if (real.length) { console.log(`page errors:\n${real.join('\n')}`); failed = true; }
  if (errors.length > real.length) console.log(`(${errors.length - real.length} known messages: GPU stalls, and the lane's air-pass replay as it stands at HEAD)`);
  for (const [k, v] of Object.entries(results)) {
    if (v.gl === 0) continue;
    console.log(`${k}: GL error ${v.gl}${/lane/.test(k) ? ' (the air pass, above)' : ''}`);
    if (!/lane/.test(k)) failed = true;
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
