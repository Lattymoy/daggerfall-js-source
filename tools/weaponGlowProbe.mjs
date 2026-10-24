// WEAPON-GLOW1 probe (bible/05-Combat/Weapon-Glow.md): renders the element glows through the REAL renderer, headless,
// on art that is NOT game data - a pixel sword drawn here, and a sword mesh built here - so the looks can be seen and
// tuned without ARENA2 or the Morrowind archives. Top row: the classic sprite's outline (drawScreenQuadGlow), fire,
// frost, shock, and fire again on the same sword painted at three texels a pixel (an HD frame); bottom row: the Morrowind pass (drawCharacter's _drawWeaponGlow in the sprite
// target), fire, frost, shock and arcane. One PNG per clock time asked.
// Usage: node tools/weaponGlowProbe.mjs [outDir] [seconds...]   (starts its own vite server; needs Chromium)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? 'weapon-glow-probe';
const times = process.argv.slice(3).map(Number).filter(Number.isFinite);
if (!times.length) times.push(10, 10.2, 10.4);
mkdirSync(outDir, { recursive: true });

const PORT = 5207;
const server = await createServer({ server: { port: PORT, strictPort: true, cors: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.setContent(`<!doctype html><body style="margin:0;background:#000"><canvas id="c" width="1600" height="900" style="width:1600px;height:900px"></canvas>
<script type="module">
import { Renderer } from 'http://localhost:${PORT}/src/render/renderer.js';
import { glowSpec } from 'http://localhost:${PORT}/src/systems/weaponGlow.js';

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);
const I = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

// the pixel sword: 48 x 112 texels, tip up
const SW = 48, SH = 112;
const px = new Uint8Array(SW * SH * 4);
const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
for (let y = 2; y < 80; y++) {
  const half = y < 14 ? Math.floor((y - 2) / 3) : 4;
  for (let x = 24 - half; x <= 24 + half; x++) {
    const edge = x === 24 - half || x === 24 + half;
    const shade = x < 24 ? 205 : 160;
    put(x, y, edge ? 120 : shade, edge ? 124 : shade + 4, edge ? 132 : shade + 10);
  }
}
for (let y = 80; y < 87; y++) for (let x = 8; x < 40; x++) put(x, y, 170 - (y - 80) * 10, 128 - (y - 80) * 8, 40);
for (let y = 87; y < 104; y++) for (let x = 21; x < 28; x++) put(x, y, 90 + ((y % 3) * 12), 52, 30);
for (let y = 104; y < 111; y++) for (let x = 18; x < 31; x++) put(x, y, 175, 135, 45);
const sword = renderer.uploadTexture('img', 'glowprobe:sword', { width: SW, height: SH, colors: px });   // screen order, row 0 the top - as a CIF frame's (fpsWeapon.js frameToColor32)
// the same sword painted at three texels a pixel - an HD replacer's frame (AUDIT WEAPON-GLOW SPR-4: its outline must be
// the classic one's size, measured in the frame's own pixels)
const HD = 3, hd = new Uint8Array(SW * HD * SH * HD * 4);
for (let y = 0; y < SH * HD; y++) for (let x = 0; x < SW * HD; x++) hd.set(px.subarray(((Math.floor(y / HD) * SW) + Math.floor(x / HD)) * 4, ((Math.floor(y / HD) * SW) + Math.floor(x / HD)) * 4 + 4), (y * SW * HD + x) * 4);
const swordHd = renderer.uploadTexture('img', 'glowprobe:swordhd', { width: SW * HD, height: SH * HD, colors: hd });

// the sword mesh: a blade (a flat diamond prism), a guard and a grip, 14 floats a corner (pos, colour, normal, uv, emission)
const tris = [];
const quad = (a, b, c, d, col, uvs) => { tri(a, b, c, col, [uvs[0], uvs[1], uvs[2]]); tri(a, c, d, col, [uvs[0], uvs[2], uvs[3]]); };
function tri(a, b, c, col, uv) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  for (const [p, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]]]) tris.push(...p, ...col, n[0] / l, n[1] / l, n[2] / l, t[0], t[1], 0, 0, 0);
}
function box(x0, y0, z0, x1, y1, z1, col) {
  const P = (x, y, z) => [x, y, z];
  const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
  quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col, U);
  quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), col, U);
  quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), col, U);
  quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), col, U);
  quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), col, U);
  quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), col, U);
}
const steel = [0.75, 0.77, 0.8];
const tip = [0, 3.4, 0], base = 0.0, w = 0.22, th = 0.05;
const ring = [[-w, 0.3, 0], [0, 0.3, th], [w, 0.3, 0], [0, 0.3, -th]];
for (let i = 0; i < 4; i++) {
  const a = ring[i], b = ring[(i + 1) % 4];
  tri(a, b, tip, steel, [[0, 0], [1, 0], [0.5, 1]]);
  quad([a[0], base, a[2]], [b[0], base, b[2]], b, a, steel, [[0, 0], [1, 0], [1, 0.1], [0, 0.1]]);
}
box(-0.75, -0.12, -0.1, 0.75, 0.0, 0.1, [0.62, 0.48, 0.18]);
box(-0.08, -1.0, -0.08, 0.08, -0.12, 0.08, [0.35, 0.2, 0.12]);
const packed = new Float32Array(tris);
const mesh = renderer.createCharacterMesh(packed, { uv: true, bounds: false });
mesh.ranges = [{ first: 0, count: mesh.count, slot: 'weapon', tex: null, hidden: false }];

function perspective(fovy, aspect, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
}
function model(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, -1.1, -7, 1]);
}

const LOOKS = ['fire', 'frost', 'shock'];
window.__draw = (seconds, level) => {
  Object.defineProperty(performance, 'now', { value: () => seconds * 1000, configurable: true });
  renderer.beginFrame(I, I, new Float32Array([0.3, -1, 0.2]));
  renderer.setLighting(new Float32Array([1, 1, 1]), 0);
  const bg = [[0.09, 0.08, 0.1, 1], [0.42, 0.5, 0.6, 1], [0.2, 0.18, 0.12, 1], [0.12, 0.12, 0.14, 1]];
  for (let i = 0; i < 4; i++) {
    renderer.drawScreenQuad(null, { x: i * 400, y: 0, w: 400, h: 450 }, undefined, bg[i]);
    renderer.drawScreenQuad(null, { x: i * 400, y: 450, w: 400, h: 450 }, undefined, bg[(i + 2) % 4]);
  }
  // the classic sprite, 3x, standing on the panel's floor (its bottom row the arm's cut, as every first-person frame's);
  // the fourth the HD sword with fire, its outline the first's size
  for (let i = 0; i < 4; i++) {
    const dst = { x: i * 400 + 200 - SW * 1.5, y: 430 - SH * 3, w: SW * 3, h: SH * 3 };
    const tex = i === 3 ? swordHd : sword;
    renderer.drawScreenQuad(tex, dst, undefined, [1, 1, 1, 1]);
    renderer.drawScreenQuadGlow(tex, dst, undefined, glowSpec(LOOKS[i % 3], level), { art: [SW, SH], view: [1600, 900] });
  }
  // the Morrowind pass, a 400 x 450 picture each
  const proj = perspective(Math.PI / 4, 400 / 450, 0.5, 40);
  for (let i = 0; i < 4; i++) {
    const look = [...LOOKS, 'arcane'][i];
    mesh.weaponGlow = glowSpec(look, look === 'arcane' ? 2 : level);
    const tex = renderer.renderCharacterSprite(mesh, model(-0.5 + i * 0.12), proj, I, 400, 450);
    renderer.drawScreenQuad(tex, { x: i * 400, y: 450, w: 400, h: 450 }, { u0: 0, v0: 450 / 1024, u1: 400 / 1024, v1: 0 });
  }
  renderer.gl.finish();
  return true;
};
window.__ready = true;
</script>`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const level of [1, 3]) {
  for (const t of times) {
    await page.evaluate(([s, l]) => window.__draw(s, l), [t, level]);
    const file = `${outDir}/glow-l${level}-t${t.toFixed(2)}.png`;
    await page.screenshot({ path: file });
    console.log('wrote', file);
  }
}
await browser.close();
await server.close();
