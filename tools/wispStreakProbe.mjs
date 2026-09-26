// WISPS-RETURN (2026-09-25): THE STREAKS, ON A REAL GPU.
//
// Mac: "I want to return to the original wind wisps before our current
// design". The pins run the shaders' own main()s in node (test/glsl.mjs), so
// the GLSL's compile and link and the picture are this probe's: the real
// WindWispsRenderer on a real WebGL2 context (headless Chromium over
// SwiftShader), a sky-coloured clear, a gale and a calm, the frame read back.
// Born as tools/wind5SwirlProbe.mjs for WIND5's flourishes; its checks are the
// streak's now.
//
//     node tools/wispStreakProbe.mjs [outDir] [--bold]
//
// It fails on: a program that will not compile or link; a draw of anything
// but one quad (six corners) a wisp, for the wind's look and the sand's; a
// gale that lays no ink; a calm whose field (four headings, three moments
// each) lays none, or more than a gale's; a field that stands still; and
// ink that does not run along the wind - with the wind
// across the view, a streak's horizontal runs of ink must be longer than its
// vertical ones. `--bold` multiplies the alpha for a picture of the SHAPE
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
  const { WindWispsRenderer, WISP_LOOK, SAND_LOOK } = await import('/src/render/windWisps.js');
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
  // looking across a wind blowing along +x (heading 0), and the other three ways round for the field's totals
  const views = [0, 1, 2, 3].map((q) => lookAt(eye, [30 * Math.sin(q * Math.PI / 2), 2.5, -30 * Math.cos(q * Math.PI / 2)], [0, 1, 0]));
  let view = views[0];
  const inkAt = (px, i) => Math.abs(px[i] - 133) + Math.abs(px[i + 1] - 168) + Math.abs(px[i + 2] - 214) > 6;
  const shot = (r, wd, t) => {
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.52, 0.66, 0.84, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    r.draw(wd, proj, view, eye, t);
    const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let ink = 0; for (let i = 0; i < px.length; i += 4) if (inkAt(px, i)) ink++;
    // the ink's grain: the mean length of its horizontal runs and of its vertical ones
    const runs = (along) => {
      let n = 0, sum = 0;
      const [outer, inner] = along === 'x' ? [H, W] : [W, H];
      for (let a = 0; a < outer; a++) {
        let run = 0;
        for (let b = 0; b <= inner; b++) {
          const on = b < inner && inkAt(px, (along === 'x' ? a * W + b : b * W + a) * 4);
          if (on) run++; else if (run) { n++; sum += run; run = 0; }
        }
      }
      return n ? sum / n : 0;
    };
    return { ink, drawn: r.drawn, px, runX: runs('x'), runY: runs('y') };
  };
  const gale = { on: true, strength01: 1, windV: [8, 0], step: [0.1, 0] };
  const calm = { on: true, strength01: 0, windV: [1, 0], step: [0.01, 0] };
  const draws = [];
  const orig = gl.drawArraysInstanced.bind(gl);
  gl.drawArraysInstanced = (m, f, n, c) => { draws.push([n, c]); return orig(m, f, n, c); };
  const g1 = shot(built, gale, 3.0), g2 = shot(built, gale, 4.2), s1 = shot(sand, { on: true, strength01: 0.8, windV: [10, 0], step: [0.1, 0] }, 3.0);
  // the field's totals: four headings at three moments each, and each wind's inkiest frame for its picture (a calm's
  // ten wisps in a 90 m box are often out of one view at one moment)
  const field = (wd) => {
    let ink = 0, best = null, at = null;
    for (let q = 0; q < 4; q++) {
      view = views[q];
      for (const t of [3.0, 5.5, 8.0]) {
        const s = shot(built, wd, t);
        ink += s.ink;
        if (!best || s.ink > best.ink) { best = s; at = `heading ${q * 90}, ${t} s`; }
      }
    }
    view = views[0];
    return { ink, best, at, drawn: best.drawn };
  };
  const gf = field(gale), cf = field(calm);
  return {
    err: gl.getError() ? `gl error ${gl.getError()}` : null, draws,
    gale: { ink: g1.ink, drawn: g1.drawn, runX: g1.runX, runY: g1.runY }, gale2: { ink: g2.ink }, sand: { ink: s1.ink, drawn: s1.drawn },
    galeField: { ink: gf.ink, best: gf.best.ink, at: gf.at, drawn: gf.drawn }, calmField: { ink: cf.ink, best: cf.best.ink, at: cf.at, drawn: cf.drawn },
    frames: { gale: Array.from(g1.px), gale2: Array.from(g2.px), 'gale-inkiest': Array.from(gf.best.px), 'calm-inkiest': Array.from(cf.best.px) },
  };
}, { W, H, bold });

if (out.err && !out.draws) { console.log('ERROR', out.err); }
check('the streaks and the sand both compile, link and draw without a GL error', !!out.draws && !out.err && pageErrors.length === 0, out.err ?? pageErrors.join(' | '));
if (out.draws) {
  check('every draw is one quad a wisp - six corners, the wind\'s look and the sand\'s', out.draws.length > 3 && out.draws.every(([n]) => n === 6), [...new Set(out.draws.map(([n, c]) => `${n}x${c}`))].join(', '));
  check('a gale lays ink', out.gale.ink > 200, `${out.gale.ink} pixels, ${out.gale.drawn} wisps`);
  check('a calm lays less than a gale over the field, and some - the floor keeps a few in the air', out.calmField.ink > 0 && out.calmField.ink < out.galeField.ink,
    `${out.calmField.ink} against ${out.galeField.ink} over twelve frames; ${out.calmField.drawn} wisps; the calm's inkiest ${out.calmField.best} px (${out.calmField.at}), the gale's ${out.galeField.best} px (${out.galeField.at})`);
  check('the streaks move: the same gale a second on is not the same picture', out.gale2.ink !== out.gale.ink, `${out.gale.ink} then ${out.gale2.ink}`);
  check('the ink runs along the wind - across the view, its horizontal runs longer than its vertical', out.gale.runX > 1.5 * out.gale.runY, `${out.gale.runX.toFixed(1)} px along, ${out.gale.runY.toFixed(1)} px up`);
  check('the sand draws its grains', out.sand.ink > 0 && out.sand.drawn > 0, `${out.sand.ink} pixels, ${out.sand.drawn} grains`);
  if (outDir) {
    for (const k of Object.keys(out.frames)) writeFileSync(`${outDir}/wisps-${k}${bold ? '-bold' : ''}.png`, png(W, H, Uint8Array.from(out.frames[k])));
    console.log('frames written to', outDir);
  }
}
await browser.close();
await server.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
