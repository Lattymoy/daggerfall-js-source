// WINDOW-WEATHER (2026-10-18): THE WEATHER THROUGH THE GLASS, PHOTOGRAPHED ON A REAL GPU - no ARENA2.
//
//     node tools/windowWeatherProbe.mjs            shots in tools/shots/windowweather-*.png
//     PW_CHANNEL=msedge node tools/windowWeatherProbe.mjs    an installed Edge or Chrome instead of Playwright's own
//
// realWindowsProbe.mjs's synthetic street and room, drawn through the REAL Renderer (the view out's pass, then the room
// over it), with render/windowWeather.js's frame after the room's own draws - as the interior host draws it - for each
// thing that falls, on the classic set and the Enhanced Lighting lane. Each shot is judged by numbers against the same
// room under a clear sky: the glass's pixels must change (the drops, the flakes, the sand are there), the room's own
// pixels away from the glass must NOT (nothing falls in the room), and a storm's lit frame must brighten the panes and
// the room (the window's light, renderer.setFlashLight). SwiftShader's milliseconds are not a player's and are never
// reported.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

if (!process.env.PW_CHANNEL) process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const W = 960, H = 540;
const server = await createServer({ server: { port: 5308, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  // The synthetic scene needs only this loopback server; the landing page's external fonts are irrelevant.
  await page.route((url) => /^https?:$/.test(url.protocol) && url.hostname !== 'localhost', (route) => route.fulfill({ status: 204, body: '' }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400)); });
  const missing = [];
  page.on('response', (res) => { if (res.status() === 404) missing.push(res.url()); });
  await page.goto('http://localhost:5308/play/');
  await page.evaluate(async ({ W, H }) => {
    const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
    const { EL_LANE } = await import('/src/render/enhancedLighting.js');
    const { windowEmissionRGB } = await import('/src/render/windowEmission.js');
    const { createViewOut, viewOutFrame } = await import('/src/render/realWindows.js');
    const { createWindowWeather } = await import('/src/render/windowWeather.js');
    const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    canvas.id = 'wwc'; canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.top = '0'; canvas.style.zIndex = '99999';
    document.body.style.margin = '0';
    document.body.appendChild(canvas);
    canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    const r = new Renderer(canvas);
    const gl = r.gl;

    // ---- the art, painted from numbers (realWindowsProbe.mjs's own)
    const S = 64;
    const paint = (fn) => { const colors = new Uint8Array(S * S * 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = fn(x, y); const i = (y * S + x) * 4; colors[i] = c[0]; colors[i + 1] = c[1]; colors[i + 2] = c[2]; colors[i + 3] = c[3] ?? 255; } return { colors, width: S, height: S }; };
    const n = (x, y) => (((x * 7 + y * 13) ^ (x * y)) % 9) - 4;
    const isFrame = (x, y) => x >= 16 && x < 48 && y >= 12 && y < 54;
    const isGlass = (x, y) => isFrame(x, y) && x >= 19 && x < 45 && y >= 15 && y < 51 && !(x >= 31 && x < 33) && !(y >= 32 && y < 34);
    const wall = (x, y) => { const v = 176 + n(x, y) * 3; return (y % 16 === 0) ? [118, 84, 52] : [v, v - 14, v - 34]; };
    const windowArt = paint((x, y) => (isGlass(x, y) ? [36, 48, 62] : isFrame(x, y) ? [70, 48, 30] : wall(x, y)));
    const glassMask = paint((x, y) => (isGlass(x, y) ? [255, 255, 255] : [0, 0, 0]));
    const plain = paint((x, y) => { const v = 150 + n(x, y) * 4; return [v, v - 8, v - 20]; });
    const ground = paint((x, y) => { const v = 96 + n(x, y) * 5; return [v, v + 6, v - 14]; });
    r.uploadTexture(3001, 0, windowArt, { opaque: true });
    r.uploadEmissionTexture(3001, 0, glassMask, { window: true });
    r.uploadTexture(3001, 1, plain, { opaque: true });
    r.uploadTexture(3001, 2, ground, { opaque: true });
    r.uploadTexture(3002, 0, windowArt, { opaque: true });
    r.uploadGlassMask(3002, 0, glassMask);   // the room's own glass

    const build = (fill) => {
      const P = [], N = [], UV = [], IDX = [], subs = [];
      const quad = (a, b, c, d, nrm, su, sv) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...nrm); UV.push(0, 0, su, 0, su, sv, 0, sv); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
      const sub = (archive, record, f) => { const start = IDX.length; f(quad); if (IDX.length > start) subs.push({ textureArchive: archive, textureRecord: record, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
      fill(sub);
      return r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    };
    const T = 2.5;
    const frontZ = (q, x0, z, cols, rows) => q([x0, 0, z], [x0 + cols * T, 0, z], [x0 + cols * T, rows * T, z], [x0, rows * T, z], [0, 0, 1], cols, rows);
    const frontX = (q, x, z0, cols, rows) => q([x, 0, z0 - cols * T], [x, 0, z0], [x, rows * T, z0], [x, rows * T, z0 - cols * T], [1, 0, 0], cols, rows);
    const street = build((sub) => {
      sub(3001, 0, (q) => { frontZ(q, -13, -16, 4, 3); frontZ(q, 1, -18, 5, 2); frontX(q, -15, -2, 4, 2); });
      sub(3001, 2, (q) => q([-80, 0, 80], [80, 0, 80], [80, 0, -80], [-80, 0, -80], [0, 1, 0], 40, 40));
    });
    const nearWall = build((sub) => sub(3001, 1, (q) => q([-1.5, 0, -4.5], [0.3, 0, -4.5], [0.3, 4, -4.5], [-1.5, 4, -4.5], [0, 0, 1], 1, 2)));
    // the room: inward faces round the eye, its front (looking -z) the glass; a 5 x 3 x 5 box
    const room = build((sub) => {
      sub(3002, 0, (q) => q([-2.5, 0, -2.5], [2.5, 0, -2.5], [2.5, 3, -2.5], [-2.5, 3, -2.5], [0, 0, 1], 2, 1.2));
      sub(3001, 1, (q) => {
        q([-2.5, 0, 2.5], [-2.5, 0, -2.5], [-2.5, 3, -2.5], [-2.5, 3, 2.5], [1, 0, 0], 2, 1.2);
        q([2.5, 0, -2.5], [2.5, 0, 2.5], [2.5, 3, 2.5], [2.5, 3, -2.5], [-1, 0, 0], 2, 1.2);
        q([2.5, 0, 2.5], [-2.5, 0, 2.5], [-2.5, 3, 2.5], [2.5, 3, 2.5], [0, 0, -1], 2, 1.2);
        q([-2.5, 0, 2.5], [2.5, 0, 2.5], [2.5, 0, -2.5], [-2.5, 0, -2.5], [0, 1, 0], 2, 2);
        q([-2.5, 3, -2.5], [2.5, 3, -2.5], [2.5, 3, 2.5], [-2.5, 3, 2.5], [0, -1, 0], 2, 2);
      });
    });
    // the room's collider, as the interior's: its bounds, and the front wall down a ray that meets it
    const collider = {
      bounds: () => ({ min: [-2.5, 0, -2.5], max: [2.5, 3, 2.5] }),
      raycast: (o, d) => (d[2] < -1e-6 ? (-2.5 - o[2]) / d[2] : Infinity),
    };
    const I = identity();
    const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.05, 500));
    const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    window.__ww = {
      // the room from inside, the street through its glass, and what falls past it; `flash` waits for a lit frame
      inside(word, level, lane, flash = false, mode = 'full', wall = false) {
        r.setLightingLane(lane ? EL_LANE : null);
        r.setAir?.(!!lane);
        if (r.air) r.air._now = () => 1000;
        r.setLighting(new Float32Array([0.8, 0.8, 0.85]), 0.3, new Float32Array([0.816, 0.954, 1])); r.setMoonlight(null);
        r.setIndirectLight([0, 0, 0], 0, new Float32Array(3)); r.setFog('linear', 0, 40, 300, new Float32Array([0.5, 0.55, 0.6]));
        r.setWindowEmission(windowEmissionRGB('day')); r.setClearColor([0.45, 0.5, 0.56, 1]);
        r.setPointLights(new Float32Array(0)); r.setFlashLight(null);
        const eye = [0.4, 1.6, 1.5], view = lookAt(eye, [-0.6, 1.6, -6], [0, 1, 0]);
        r.beginFrame(proj, view, new Float32Array([0.35, 0.8, 0.25]), WORLD_FRAME);
        r.setWindowRooms('full');
        r.drawMesh(street, I, null);
        if (lane) r.resolveFrame();
        const ww = createWindowWeather({ renderer: r, on: () => true, falling: () => ({ word, level }) });
        const state = createViewOut();
        const scene = { draw: ({ renderer }) => { renderer.drawMesh(street, I, null); if (wall) renderer.drawMesh(nearWall, I, null); } };
        let px = null, vo = null, now = 0, lit = false;
        for (let f = 0; f < (flash ? 400 : 3); f++) {
          now += flash ? 500 : 300; // exercise a subscribed depth refresh before the final sample
          vo = viewOutFrame(state, { renderer: r, mode, proj, view, now, scene });
          r.setLighting(new Float32Array([0.3, 0.28, 0.26]), 0); r.setMoonlight(null); r.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
          r.setWindowEmission(windowEmissionRGB('disabled'));
          r.setPointLights(new Float32Array([0, 2.6, 1.5, 6]), new Float32Array([1, 0.85, 0.6]));
          r.setFlashLight(null);
          ww.light({ dt: flash ? 0.5 : 0.016 });
          r.setClearColor([0, 0, 0, 1]);
          r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME);
          r.setGlassView(vo);
          r.drawMesh(room, I, null);
          ww.frame({ glass: vo, proj, view, eye, dt: 0.016, now, collider });
          if (lane) r.resolveFrame();
          px = read();
          if (flash && ww.flashing && ww.window) { lit = true; break; }
        }
        const result = { gl: gl.getError(), px: Array.from(px), vo, lit, window: ww.window };
        ww.release();
        return result;
      },
    };
  }, { W, H });
  const output = process.env.WINDOW_WEATHER_OUTPUT ?? 'tools/shots';
  mkdirSync(output, { recursive: true });
  const shot = async (name) => {
    const png = await page.locator('#wwc').evaluate((canvas) => canvas.toDataURL('image/png').split(',')[1]);
    writeFileSync(join(output, `windowweather-${name}.png`), Buffer.from(png, 'base64'));
  };
  const lum = (px, i) => px[i] + px[i + 1] + px[i + 2];
  const differs = (p, q, i) => Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 6;
  /** The pixels that differ from the clear shot on the glass (the mask: where the street is cut into the room) and off
   *  it (the room alone), and the mean brightness gained on each. */
  const judge = (px, clear, mask) => {
    let inDiff = 0, outDiff = 0, inN = 0, outN = 0, inLum = 0, outLum = 0;
    for (let i = 0, k = 0; i < px.length; i += 4, k++) {
      const d = differs(px, clear, i), g = lum(px, i) - lum(clear, i);
      if (mask[k]) { inN++; inLum += g; if (d) inDiff++; } else { outN++; outLum += g; if (d) outDiff++; }
    }
    return { inDiff, outDiff, inGain: +(inLum / Math.max(1, inN)).toFixed(2), outGain: +(outLum / Math.max(1, outN)).toFixed(2) };
  };
  const results = {};
  for (const lane of [false, true]) {
    const tag = lane ? '-lane' : '';
    const run = (...a) => page.evaluate((x) => window.__ww.inside(...x), [...a.slice(0, 3), a[3] ?? false, a[4] ?? 'full', a[5] ?? false]);
    const clear = await run('clear', 0, lane);
    await shot(`clear${tag}`);
    if (!clear.vo?.view) { console.log(`clear${tag}: the view out drew no street - the probe has no glass to look through`); failed = true; continue; }
    // the glass: where the street is cut in (Full) and not (Rooms only - the classic glass); the noise: clear again
    const rooms = await run('clear', 0, lane, false, 'rooms');
    const again = await run('clear', 0, lane);
    const mask = new Uint8Array(W * H);
    let glass = 0, noise = 0;
    for (let i = 0, k = 0; i < clear.px.length; i += 4, k++) { if (differs(clear.px, rooms.px, i)) { mask[k] = 1; glass++; } if (differs(clear.px, again.px, i)) noise++; }
    results[`glass${tag}`] = { glass, noise };
    if (!(glass > 5000)) { console.log(`glass${tag}: only ${glass} pixels of glass found`); failed = true; }
    for (const [name, word, level] of [['rain', 'rain', 1], ['snow', 'snow', 1], ['sand', 'sandstorm', 1]]) {
      const res = await run(word, level, lane);
      await shot(`${name}${tag}`);
      const j = judge(res.px, clear.px, mask);
      results[`${name}${tag}`] = { gl: res.gl, ...j };
      if (!(j.inDiff > noise + 200)) { console.log(`${name}${tag}: nothing seen falling through the glass (${j.inDiff} pixels changed, noise ${noise})`); failed = true; }
      if (j.outDiff > noise) { console.log(`${name}${tag}: ${j.outDiff} pixels of the room changed (noise ${noise}) - something fell in the room`); failed = true; }
    }
    if (!lane) {
      const wallClear = await run('clear', 0, false, false, 'full', true);
      const wallRain = await run('rain', 1, false, false, 'full', true);
      await shot('street-wall-rain');
      const wallMask = new Uint8Array(W * H);
      for (let k = 0; k < wallMask.length; k++) wallMask[k] = mask[k] && differs(wallClear.px, clear.px, k * 4) ? 1 : 0;
      let wallN = 0, openN = 0, wallChanged = 0, openChanged = 0;
      // Ignore the two-pixel silhouette: the cached half-size street samples its edge differently.
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
        const k = y * W + x;
        if (!mask[k]) continue;
        let boundary = false;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const n = k + dy * W + dx;
          if (!mask[n] || wallMask[n] !== wallMask[k]) boundary = true;
        }
        if (boundary) continue;
        const changed = differs(wallRain.px, wallClear.px, k * 4);
        if (wallMask[k]) { wallN++; if (changed) wallChanged++; }
        else { openN++; if (changed) openChanged++; }
      }
      const wallRate = wallChanged / wallN, openRate = openChanged / openN;
      results.streetWall = { gl: wallRain.gl, wallN, openN, wallChanged, openChanged, wallRate, openRate, ratio: wallRate / openRate };
      if (!(wallN > 500 && openN > 500 && openChanged > 200 && wallRate < openRate * 0.35)) {
        console.log('street depth did not hide rain behind the near wall sufficiently'); failed = true;
      }
    }
    const storm = await run('thunder', 0, lane, true);
    await shot(`flash${tag}`);
    const j = judge(storm.px, clear.px, mask);
    results[`flash${tag}`] = { gl: storm.gl, lit: storm.lit, window: storm.window, ...j };
    if (!storm.lit) { console.log(`flash${tag}: no lit frame with a window found`); failed = true; }
    if (!(j.inGain > 20)) { console.log(`flash${tag}: the panes did not flash (${j.inGain})`); failed = true; }
    if (!(j.outGain > 3)) { console.log(`flash${tag}: the room took no light from the window (${j.outGain})`); failed = true; }
  }
  if (missing.length) console.log(`(404s, the page's own - no ARENA2 here: ${[...new Set(missing)].map((u) => u.replace('http://localhost:5308', '')).join(', ')})`);
  console.log(JSON.stringify(results, null, 1));
  // realWindowsProbe.mjs's known messages: GPU stalls, and the lane's air-pass emission replay as it stands at HEAD
  const known = (e) => /GPU stall|Must have element array buffer bound/.test(e);
  const real = errors.filter((e) => !known(e) && !(/status of 404/.test(e) && missing.length));
  if (real.length) { console.log(`page errors:\n${real.join('\n')}`); failed = true; }
  if (errors.length > real.length) console.log(`(${errors.length - real.length} known messages: GPU stalls, and the lane's air-pass replay as it stands at HEAD)`);
  for (const [k, v] of Object.entries(results)) {
    if (v.gl === 0 || v.gl === undefined) continue;   // the glass's own row reads no GL state
    console.log(`${k}: GL error ${v.gl}${/lane/.test(k) ? ' (the air pass, realWindowsProbe.mjs says)' : ''}`);
    if (!/lane/.test(k)) failed = true;
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
