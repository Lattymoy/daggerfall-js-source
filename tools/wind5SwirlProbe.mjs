// WIND5 (2026-09-23): THE FLOURISHES, ON A REAL GPU.
//
// Mac: "lets reduce the amount of wind streaks and change their design to
// be more swirly like the image". The pins run on a fake GL that compiles
// anything and draws nothing, so the ribbon's GLSL and its shape are this
// probe's: the real WindWispsRenderer on a real WebGL2 context (headless
// Chromium over SwiftShader), a sky-coloured clear, a gale and a calm, the
// frame read back.
//
//     node tools/wind5SwirlProbe.mjs [outDir] [--bold]
//
// It fails on: a program that will not compile or link; a draw that is not
// the ribbon's vertex count; a gale that lays no ink; a calm that lays more
// than a gale; and the sandstorm's look drawing anything but its one straight
// quad per grain. `--bold` multiplies the alpha for a picture of the SHAPE
// alone (never for the checks).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const args = process.argv.slice(2);
const bold = args.includes('--bold');
const outDir = args.find((a) => !a.startsWith('--')) || null;
if (outDir) mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

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
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5271, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5271/play/');

const W = 800, H = 450;
const out = await page.evaluate(async ({ W, H, bold }) => {
  const { WindWispsRenderer, WISP_LOOK, SAND_LOOK, ribbon } = await import('/src/render/windWisps.js');
  const { perspective, lookAt } = await import('/src/world/mat4.js');
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  const look = bold ? Object.freeze({ ...WISP_LOOK, alpha: Object.freeze([WISP_LOOK.alpha[0] * 5, WISP_LOOK.alpha[1] * 5]) }) : WISP_LOOK;
  let built = null, err = null;
  try { built = new WindWispsRenderer(gl, look); } catch (e) { err = String(e.message); }
  let sand = null;
  try { sand = new WindWispsRenderer(gl, SAND_LOOK); } catch (e) { err = (err ?? '') + String(e.message); }
  if (!built || !sand) return { err };
  const proj = perspective(Math.PI / 3, W / H, 0.1, 400);
  const eye = new Float32Array([0, 1.7, 0]);
  const view = lookAt(eye, [0, 2.5, -30], [0, 1, 0]);   // looking across a wind blowing along +x
  const shot = (r, wd, t) => {
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.52, 0.66, 0.84, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    r.draw(wd, proj, view, eye, t);
    const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let ink = 0; for (let i = 0; i < px.length; i += 4) { const d = Math.abs(px[i] - 133) + Math.abs(px[i + 1] - 168) + Math.abs(px[i + 2] - 214); if (d > 6) ink++; }
    return { ink, drawn: r.drawn, px };
  };
  const gale = { on: true, strength01: 1, windV: [8, 0], step: [0.1, 0] };
  const calm = { on: true, strength01: 0, windV: [1, 0], step: [0.01, 0] };
  const draws = [];
  const orig = gl.drawArraysInstanced.bind(gl);
  gl.drawArraysInstanced = (m, f, n, c) => { draws.push([n, c]); return orig(m, f, n, c); };
  const g1 = shot(built, gale, 3.0), g2 = shot(built, gale, 4.2), c1 = shot(built, calm, 3.0), s1 = shot(sand, { on: true, strength01: 0.8, windV: [10, 0], step: [0.1, 0] }, 3.0);
  return {
    err: gl.getError() ? `gl error ${gl.getError()}` : null, draws, verts: [built.verts, sand.verts], ribbon: [ribbon(WISP_LOOK).length / 2, ribbon(SAND_LOOK).length / 2],
    gale: { ink: g1.ink, drawn: g1.drawn }, gale2: { ink: g2.ink }, calm: { ink: c1.ink, drawn: c1.drawn }, sand: { ink: s1.ink, drawn: s1.drawn },
    frames: { gale: Array.from(g1.px), gale2: Array.from(g2.px), calm: Array.from(c1.px) },
  };
}, { W, H, bold });

if (out.err && !out.draws) { console.log('ERROR', out.err); }
check('the flourish and the sand both compile, link and draw without a GL error', !!out.draws && !out.err && pageErrors.length === 0, out.err ?? pageErrors.join(' | '));
if (out.draws) {
  check('a flourish draws its whole ribbon - WISP_SEGMENTS x 6 vertices a wisp', out.draws[0][0] === out.verts[0] && out.verts[0] === out.ribbon[0] && out.verts[0] > 6, `${out.draws[0][0]} vertices`);
  check('the sand keeps its one straight quad a grain', out.verts[1] === 6 && out.draws.at(-1)[0] === 6, `${out.verts[1]} vertices`);
  check('a gale lays ink', out.gale.ink > 200, `${out.gale.ink} pixels`);
  check('a calm lays less than a gale, and some - the floor keeps the direction readable', out.calm.ink > 0 && out.calm.ink < out.gale.ink, `${out.calm.ink} against ${out.gale.ink}`);
  check('the flourishes move: the same gale a second on is not the same picture', out.gale2.ink !== out.gale.ink, `${out.gale.ink} then ${out.gale2.ink}`);
  if (outDir) {
    for (const k of ['gale', 'gale2', 'calm']) writeFileSync(`${outDir}/wind5-${k}${bold ? '-bold' : ''}.png`, png(W, H, Uint8Array.from(out.frames[k])));
    console.log('frames written to', outDir);
  }
}
await browser.close();
await server.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
