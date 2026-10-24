// FIELD BUGS 2026-09-29 (the sea) #4 - "Water flickers from a distance". A synthetic coast drawn by the port's own
// passes on a real GL pipeline (SwiftShader): Iliac Puddle No More's floor and surface top (render/deepWatersRender.js)
// and Come Sail Away's waves (render/comeSailAwayRender.js, its mesh from systems/comeSailAway/comeSailAwayWaves.js buildWaveMesh,
// the author's own two paints from vendor/come-sail-away), under the world's lens (0.2 to 6000). The camera bobs by
// centimetres, as a deck carries it; a pixel whose colour changes between two bobs of a still scene is a flicker.
//     node tools/fbseaWaterProbe.mjs [--solid] [--time]   (--solid: the waves painted flat - their depth alone, no texels;
//                                                          --time: the frame's cost, the strip over half the screen)
//     PROBE_ROOT=<another checkout> serves that tree's src in this one's place (the numbers before a change)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const solid = process.argv.includes('--solid');
// PROBE_ROOT: another checkout's tree served in this one's place (the numbers before a change, from its parent commit)
const server = await createServer({ root: process.env.PROBE_ROOT ?? fileURLToPath(new URL('..', import.meta.url)), server: { port: 5246, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5246/menu.html', { waitUntil: 'domcontentloaded' });
if (process.env.PROBE_DUMP) await page.evaluate((m) => { window.__dump = m; }, process.env.PROBE_CASE ?? '');
if (process.env.PROBE_SAMPLES) await page.evaluate(() => { window.__samples = true; });
if (process.argv.includes('--time')) await page.evaluate(() => { window.__time = true; });
const out = await page.evaluate(async (solidWaves) => {
  document.body.innerHTML = '';
  window.__shots = [];
  const W = 1280, H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  document.body.append(canvas);
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW);   // the renderer's own (renderer.js, the mirrored lens)
  const { DeepWatersRenderer } = await import('/src/render/deepWatersRender.js');
  const { ComeSailAwayRenderer } = await import('/src/render/comeSailAwayRender.js');
  const { buildWaveMesh, waveDitherOf, WAVE_SCALE } = await import('/src/systems/comeSailAway/comeSailAwayWaves.js');
  const { perspective, lookAt, multiply, mirrorProjectionX } = await import('/src/world/mat4.js');
  // the renderer's frame, as the two passes read it
  const r = {
    gl, _proj: null, _view: null, _camPos: new Float32Array(3), _dwFog: new Float32Array(20), _focus: new Float32Array(4),
    _fogColor: [0.62, 0.7, 0.78], _fogMode: 0, _fogDensity: 0, _fogRange: [0, 1],
    _ambient: [0.55, 0.55, 0.55], _sunColor: [1, 0.96, 0.9], _sunScale: 0.6, _lightDir: [0.35, 0.85, 0.25], markForeignPass() {},
  };
  const dw = new DeepWatersRenderer(r);
  const csa = new ComeSailAwayRenderer(r);
  // the ground: the shallow shelf's floor (33.95, the carve's own clearance under the sea) west of the beach line, the
  // beach at the sea's own 34.00 east of it - the floor program for both (opaque, depth written, as the ground is)
  const SEA = 34, BEACH_X = 919.2;
  const quad = (x0, x1, z0, z1, y) => ({ p: [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1] });
  /** A plane as the game lays its ground and its sea: tiles no larger than a quarter pixel (204.8 m), never one 7 km
   *  triangle (SwiftShader's clipper drops such a one whole at some poses - a probe's artefact, not the game's). */
  const tiles = (x0, x1, z0, z1, y) => {
    const out = [], T = 204.8;
    for (let x = x0; x < x1; x += T) for (let z = z0; z < z1; z += T) out.push(quad(x, Math.min(x + T, x1), z, Math.min(z + T, z1), y));
    return out;
  };
  const mesh = (quads) => {
    const positions = [], colors = [], uvs = [], indices = [];
    for (const q of quads) {
      const b = positions.length / 3;
      positions.push(...q.p);
      for (let k = 0; k < 4; k++) { colors.push(0.5, 0.5, 0.5, 0); uvs.push(0, 0); }
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return { positions: new Float32Array(positions), colors: new Float32Array(colors), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
  };
  const shelf = dw.create({ floor: mesh(tiles(-2600, BEACH_X, -2400, 2400, SEA - 0.05)) });
  const beach = dw.create({ floor: mesh(tiles(BEACH_X, 3000, -2400, 2400, SEA)) });
  const top = dw.create({ surface: { ...mesh(tiles(-2600, 1400, -2400, 2400, 0)) } });   // the top feathered over the beach's first 480 m
  const palette = (c) => ({ sand: c, mid: c, deep: c, swamp: c });
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // the waves: the player's pixel and every pixel west of X 101 water, land east of it - a coast running north-south
  const X = 100, Y = 100;
  const built = buildWaveMesh({
    heightMapValue: (x) => (x >= X + 1 ? 10 : 0),
    raycast: (o) => ({ point: [o[0], o[0] >= 819.2 ? SEA + 6 : SEA, o[2]] }),
    mapPixel: { X, Y }, worldCompensation: [0, 0, 0], waveDistance: 2, waterLevel: SEA,
  });
  const img = async (src) => {
    const im = new Image();
    im.src = src;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    return { width: im.width, height: im.height, data: new Uint8Array(g.getImageData(0, 0, im.width, im.height).data.buffer) };
  };
  const derived = await (await fetch('/vendor/come-sail-away/Textures/derived.json')).json();
  const paints = [await img('/vendor/come-sail-away/Textures/112395_2-base0.paint.png'), await img('/vendor/come-sail-away/Textures/112395_2-base1.paint.png')];
  if (solidWaves) for (const p of paints) for (let i = 0; i < p.data.length; i += 4) { p.data[i] = 230; p.data[i + 1] = 235; p.data[i + 2] = 240; p.data[i + 3] = 255; }
  const snow = { width: 64, height: 64, data: new Uint8Array(64 * 64 * 4) };
  let s = 12345;
  for (let i = 0; i < snow.data.length; i += 4) { s = (s * 1103515245 + 12345) >>> 0; const v = 200 + (s >>> 27); snow.data[i] = v; snow.data[i + 1] = v; snow.data[i + 2] = v + 4; snow.data[i + 3] = 255; }   // a soft white, as the record is
  const specs = [];
  for (let i = 0; i < 32; i++) { const d = derived[`112395_2-${i}`]; specs.push({ paint: d.paint.includes('base1') ? 1 : 0, scroll: d.scroll, tile: d.tile, size: d.size }); }
  csa.setWaveFrames({ paints, snow, specs });
  const waves = { position: built.position, scale: WAVE_SCALE, mesh: built.mesh, frame: 5 };
  const dither = waveDitherOf(10, 0.5);
  const P = mirrorProjectionX(perspective((60 * Math.PI) / 180, W / H, 0.2, 6000));
  r._proj = P;
  const frame = (eye, pitch) => {
    const fwd = [Math.cos(pitch), -Math.sin(pitch), 0];   // east, toward the coast
    r._view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
    r._camPos.set(eye);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.62, 0.7, 0.78, 1);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    const col = { sceneTint: [1, 1, 1, 0], columnOn: false, seaY: SEA, topColor: [0.1, 0.35, 0.55, 0.51], topVision: 36, surfaceScroll: [0, 0], surfaceTexture: white };
    const one = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);   // a read waits for the raster; finish does not (SwiftShader)
    const lap = (k) => { if (!window.__laps) return; sync(); const t = performance.now(); window.__laps[k] = (window.__laps[k] ?? 0) + t - window.__lapT; window.__lapT = t; };
    if (window.__laps) { sync(); window.__lapT = performance.now(); }
    dw.drawFloors([
      { h: shelf, model: identity, origin: [0, 0, 0], material: { texture: null, strength: 0, palette: palette([0.85, 0.2, 0.2]), ambientBoost: 1 } },
      { h: beach, model: identity, origin: [0, 0, 0], material: { texture: null, strength: 0, palette: palette([0.2, 0.85, 0.2]), ambientBoost: 1 } },
    ], col);
    lap('clear+floors');
    csa.drawWaves(waves, dither);
    lap('waves');
    dw.drawSurfaces([{ h: top, model: identity }], { underwater: false, liftY: SEA + 0.03, surfaceScroll: [0, 0], surfaceTexture: white, topColor: [0.1, 0.35, 0.55, 0.51], topDepthWrite: false });
    lap('surfaces');
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  };
  // the world's own place for each pixel row: where the ray meets the sea, and what lies there
  const rowsOf = (eye, pitch) => {
    const out = [];
    const t = Math.tan((60 * Math.PI) / 360);
    for (let y = 0; y < H; y++) {
      const ny = ((y + 0.5) / H) * 2 - 1;   // readPixels row 0 is the bottom
      const dy = -Math.sin(pitch) + t * ny * Math.cos(pitch), dx = Math.cos(pitch) + t * ny * Math.sin(pitch);
      out.push(dy < -1e-6 ? eye[0] + (dx * (SEA - eye[1])) / dy : Infinity);
    }
    return out;
  };
  const results = [];
  if (window.__time) {   // --time: the frame's cost (gl.finish after each), the strip filling the lower half of the screen
    const eye = [700, SEA + 12, 0.37], pitch = Math.atan2(12, 300);
    for (let i = 0; i < 10; i++) frame(eye, pitch);
    const ms = [];
    for (let i = 0; i < 60; i++) { const t0 = performance.now(); frame(eye, pitch); gl.finish(); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b);
    window.__laps = {};
    for (let i = 0; i < 30; i++) frame(eye, pitch);
    const laps = Object.fromEntries(Object.entries(window.__laps).map(([k, v]) => [k, +(v / 30).toFixed(2)]));
    return { depthBits: gl.getParameter(gl.DEPTH_BITS), timing: { median: +ms[30].toFixed(2), p10: +ms[6].toFixed(2), p90: +ms[54].toFixed(2) }, laps };
  }
  const cases = [];
  for (const [label, height] of [['the helm, eye on deck', 5], ['third person', 12], ['sea zoom, Small Ship', 66], ['sea zoom, galley', 140]]) {
    for (const D of [300, 700, 1500]) cases.push([`${label} (${height} m), the coast ${D} m off`, height, Math.atan2(height, D), 1000 - D]);
  }
  for (const [label, height, pitch, x] of cases) {
    const bobs = [[0, 0], [0.004, 0.00004], [0.009, -0.00003], [0.013, 0.00006], [0.018, -0.00005]];
    const shots = bobs.map(([dy, dp]) => {
      const px = frame([x, SEA + height + dy, 0.37], pitch + dp);
      if (window.__dump && label.includes(window.__dump)) window.__shots.push(canvas.toDataURL('image/png'));
      return px;
    });
    const rowX = rowsOf([x, SEA + height, 0.37], pitch);
    const bands = { shelf: [0, 0], beachUnderTop: [0, 0], wavesFar: [0, 0], wavesNear: [0, 0] };
    for (let y = 0; y < H; y++) {
      const wx = rowX[y];
      if (!Number.isFinite(wx)) continue;
      // by where the row meets the sea: the shelf under the top short of the waves, the wave strip (the fans from the
      // water pixel's inner quarter, 614.4, to the land pixel's centre, 1228.8), the beach under the top past them
      // (the strip split at 150 m from the eye: under it the strip is magnified pixel art the bob moves - the mod's own)
      const band = wx < 590 && wx > x + 40 ? 'shelf' : wx > 640 && wx < 1200 ? (wx - x >= 150 ? 'wavesFar' : 'wavesNear') : wx > 1250 && wx < 1380 ? 'beachUnderTop' : null;
      for (let xx = 0; xx < W; xx++) {
        const i = (y * W + xx) * 4;
        let changed = false;
        for (let k = 1; k < shots.length && !changed; k++) {
          const a = shots[0], b = shots[k];
          changed = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24;
        }
        const key = band;
        if (!key) continue;
        bands[key][1]++;
        if (changed) { bands[key][0]++; if ((bands[key].samples ??= []).length < 3) { const k = shots.findIndex((sh) => Math.abs(sh[i] - shots[0][i]) + Math.abs(sh[i + 1] - shots[0][i + 1]) + Math.abs(sh[i + 2] - shots[0][i + 2]) > 24); bands[key].samples.push({ xx, y, wx: Math.round(wx), a: [...shots[0].slice(i, i + 3)], b: [...shots[k].slice(i, i + 3)], k }); } }
      }
    }
    results.push({ label, ...Object.fromEntries(Object.entries(bands).map(([k, [c, n]]) => [k, `${c} of ${n} flicker (${n ? ((100 * c) / n).toFixed(1) : '0.0'}%)`])), samples: window.__samples ? Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, v.samples])) : undefined });
  }
  return { depthBits: gl.getParameter(gl.DEPTH_BITS), renderer: gl.getParameter(gl.RENDERER), results, shots: window.__shots, mesh: built.mesh ? built.mesh.indices.length : null, pos: built.position };
}, solid);
const dumpDir = process.env.PROBE_DUMP;
if (dumpDir) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(dumpDir, { recursive: true });
  out.shots.forEach((d, k) => writeFileSync(`${dumpDir}/shot${k}${solid ? '-solid' : ''}.png`, Buffer.from(d.split(',')[1], 'base64')));
}
delete out.shots;
console.log(JSON.stringify(out, null, 2));
await browser.close();
await server.close();
// the judgement (the fixed tree's law): the sheets under the top hold still wherever they span more than one row of
// pixels, and the breakers from 150 m out change in no more than a fifth of their pixels from bob to bob
const band = (s) => { const m = /^(\d+) of (\d+) flicker \(([\d.]+)%\)/.exec(s); return { n: Number(m[2]), pct: Number(m[3]) }; };
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
for (const r of out.results ?? []) {
  for (const k of ['shelf', 'beachUnderTop']) { const b = band(r[k]); if (b.n > 1280 && b.pct > 0) fail(`${r.label}: ${k} ${r[k]}`); }
  const w = band(r.wavesFar);
  if (!solid && w.n > 3 * 1280 && w.pct > 20) fail(`${r.label}: the breakers ${r.wavesFar}`);
  if (solid && w.n > 3 * 1280 && w.pct > 1) fail(`${r.label}: the breakers' depth ${r.wavesFar}`);
}
