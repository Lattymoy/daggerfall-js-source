// TR4 — the trees probe: the shipped meshes drawn through the REAL
// render/treeModels.js in a real WebGL2 context, in wind, filmed.
//
// Nothing in TR1-3 had drawn through GL - every check was a software
// render or a pin. This is the GL run. It needs no ARENA2: the record
// each mesh wears is stood in for by the island the partner cut from
// the classic sprite, which is exactly the pixels the runtime will get
// from the player's own TEXTURE.<archive>. The pack is read from a
// path you give it; nothing from it is written anywhere but the frames.
//
// What it proves: the shaders compile and link; the record texture,
// the opaque-box remap and the crown-top upload go through the real
// build()/draw(); the wind lean moves the crowns and not the trunks;
// and instancing draws every tree of a record in one call.
//
// Usage: node tools/treesProbe.mjs <pack>/Models [archive] [out.mp4]

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { PNG } from 'pngjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { islands, islandFor } from './lib/treeAtlas.mjs';

const [, , packRoot, archiveArg = '500', outArg = '/mnt/user-data/outputs/daggerfall-js-trees.mp4'] = process.argv;
if (!packRoot) { console.error('usage: node tools/treesProbe.mjs <pack>/Models [archive] [out.mp4]'); process.exit(2); }
const archive = Number(archiveArg);

// ── the stand-in records: each model's island, cropped ─────────────
const dir = join(packRoot, String(archive));
const files = readdirSync(dir);
const atlasFile = files.find((f) => /^\d+_?A?_Atlas\.png$/i.test(f) || /^\d+_Atlas\.png\.001\.png$/i.test(f)) ?? files.find((f) => /\.png$/i.test(f) && !/opaque/i.test(f));
const atlasPng = PNG.sync.read(readFileSync(join(dir, atlasFile)));
const atlas = islands(atlasPng);
const shipped = JSON.parse(readFileSync(`public/trees/${archive}.json`, 'utf8'));

/** The first side card's ORIGINAL atlas UV, from the .dae (the shipped
 *  file carries only re-based UVs, by design). */
function firstSideUV(text) {
  const arr = (k) => text.match(new RegExp(`<float_array id="[^"]*${k}-array" count="\\d+">([^<]+)<`))[1].trim().split(/\s+/).map(Number);
  const nrm = arr('normals'), uv = arr('map-0');
  for (const m of text.matchAll(/<triangles ([^>]*)>([\s\S]*?)<\/triangles>/g)) {
    const inputs = [...m[2].matchAll(/<input semantic="(\w+)" source="#([^"]+)" offset="(\d+)"/g)].map((i) => ({ sem: i[1], off: Number(i[3]) }));
    const stride = Math.max(...inputs.map((i) => i.off)) + 1;
    const off = Object.fromEntries(inputs.map((i) => [i.sem, i.off]));
    const idx = m[2].match(/<p>([^<]+)<\/p>/)[1].trim().split(/\s+/).map(Number);
    for (let t = 0; t + stride * 3 <= idx.length; t += stride * 3) {
      const ni = idx[t + off.NORMAL];
      if (Math.abs(nrm[ni * 3 + 1]) > 0.7) continue;
      const ui = idx[t + off.TEXCOORD];
      return [uv[ui * 2], uv[ui * 2 + 1]];
    }
  }
  return null;
}
const standIns = {};
for (const rec of Object.keys(shipped.records)) {
  const dae = files.find((f) => f === `${archive}_${rec}.dae`);
  if (!dae) continue;
  const uv = firstSideUV(readFileSync(join(dir, dae), 'utf8'));
  if (!uv) continue;
  const b = islandFor(atlas, uv[0], uv[1]);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const crop = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((b.y0 + y) * atlasPng.width + b.x0 + x) * 4, o = (y * w + x) * 4;
    crop.data[o] = atlasPng.data[s]; crop.data[o + 1] = atlasPng.data[s + 1]; crop.data[o + 2] = atlasPng.data[s + 2]; crop.data[o + 3] = atlasPng.data[s + 3];
  }
  standIns[rec] = { w, h, png: PNG.sync.write(crop).toString('base64') };
}
console.log(`archive ${archive}: ${Object.keys(standIns).length} stand-in records from ${atlasFile}`);

// ── the harness page ───────────────────────────────────────────────
const HARNESS = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { TreeModelRenderer, opaqueBox } from '/src/render/treeModels.js';
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
if (!gl) throw new Error('no webgl2');
gl.enable(gl.DEPTH_TEST);

// a renderer stand-in: exactly the fields draw() reads, and uploadTexture
const R = {
  textures: new Map(),
  _pointLights: new Float32Array(0), _pointColorData: () => new Float32Array(0),
  _indirect: new Float32Array([0, 0, 0, 0]), _indirectColor: new Float32Array([0, 0, 0]),
  _fogColor: new Float32Array([0.62, 0.68, 0.78]), _fogMode: 2, _fogDensity: 0.006, _fogRange: new Float32Array([0, 400]),
  _camPos: new Float32Array(3),
  uploadTexture(archive, record, c32) {
    const key = archive + '_' + record;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, c32.width, c32.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, c32.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.textures.set(key, tex); return tex;
  },
};
const trees = new TreeModelRenderer(gl);
window.__trees = trees; window.__R = R;

const decode = (b64) => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
window.__setup = async (archive, standIns, layout) => {
  const json = await trees.load(archive);
  if (!json) throw new Error('no json for ' + archive);
  let built = 0;
  for (const [rec, s] of Object.entries(standIns)) {
    const m = trees.modelFor(archive, Number(rec)); if (!m) continue;
    const img = await decode(s.png);
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, img.width, img.height);
    const color32 = { width: img.width, height: img.height, data: rgba.data };
    // the DFBitmap stand-in: index 0 where the sprite is transparent
    const bm = { width: img.width, height: img.height, data: new Uint8Array(img.width * img.height) };
    for (let i = 0; i < bm.data.length; i++) bm.data[i] = rgba.data[i * 4 + 3] > 8 ? 1 : 0;
    R.uploadTexture(archive, Number(rec), color32);
    const centers = layout[rec] ?? [];
    // the billboard's height stands in as the sprite's pixel height / 6.4 (a DFU flat scale)
    const bbH = img.height / 6.4;
    const tb = trees.build(archive, Number(rec), m, centers, bbH, bm, { color32, upload: (k, raster) => R.uploadTexture(archive, k, raster) });
    if (tb) built++;
  }
  return { built, batches: trees.meshes.size };
};

// a simple camera
const perspective = (fovy, aspect, n, f) => { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
const lookAt = (e, c, up) => { const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

window.__frame = (t, eye, at, windV) => {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.62, 0.68, 0.78, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = perspective(1.05, canvas.width / canvas.height, 0.5, 600);
  const view = lookAt(eye, at, [0, 1, 0]);
  R._camPos.set(eye);
  trees.draw(R, proj, view, t, { windV }, [1, 1, 1]);
  return trees.count;
};
window.__ready = true;
</script></body></html>`;

// ── run ────────────────────────────────────────────────────────────
mkdirSync('/tmp/treeprobe', { recursive: true });
writeFileSync('public/__treeprobe.html', HARNESS);
const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('http://localhost:5199/__treeprobe.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });

  // a wood: the records scattered on a ring around the camera's look-at
  const recs = Object.keys(standIns);
  const layout = {};
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 28; i++) {
    const rec = recs[i % recs.length];
    const a = rnd() * Math.PI * 2, r = 14 + rnd() * 34;
    (layout[rec] ??= []).push([Math.cos(a) * r, 0, Math.sin(a) * r]);
  }
  const info = await page.evaluate(([a, s, l]) => window.__setup(a, s, l), [archive, standIns, layout]);
  console.log('built', info.built, 'records into', info.batches, 'batches');
  if (errors.length) console.log('page errors:', errors.slice(0, 3));

  // film: the camera orbits slowly; the wind rises from calm to a gale
  const FPS = 30, SECONDS = 12, N = FPS * SECONDS;
  let drawn = 0;
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    const ang = t * 0.12, eye = [Math.cos(ang) * 22, 6.5, Math.sin(ang) * 22], at = [0, 7, 0];
    const wind = 0.25 + 0.75 * Math.min(1, t / 8);
    drawn = await page.evaluate(([t2, e, a, w]) => window.__frame(t2, e, a, [w * 1.6, w * 0.5]), [t, eye, at, wind]);
    const png = await page.$eval('#c', (c) => c.toDataURL('image/png').split(',')[1]);
    writeFileSync(`/tmp/treeprobe/f${String(f).padStart(4, '0')}.png`, Buffer.from(png, 'base64'));
    if (f % 60 === 0) process.stderr.write(`\r  frame ${f}/${N}  trees ${drawn}`);
  }
  process.stderr.write(`\r  ${N} frames, ${drawn} trees a frame\n`);
  if (errors.length) console.log('page errors:', errors.slice(0, 5));
  const ff = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', '/tmp/treeprobe/f%04d.png',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outArg]);
  console.log(ff.status === 0 ? `wrote ${outArg}` : `ffmpeg failed: ${ff.stderr}`);
  // a contact sheet of three moments for the record
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', '/tmp/treeprobe/f0000.png', '-i', '/tmp/treeprobe/f0180.png', '-i', '/tmp/treeprobe/f0330.png',
    '-filter_complex', '[0][1][2]hstack=3', '/tmp/treeprobe/sheet.png']);
} finally {
  await browser.close();
  await server.close();
  const { unlinkSync } = await import('node:fs');
  try { unlinkSync('public/__treeprobe.html'); } catch { /* already gone */ }
}
