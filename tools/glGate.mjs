// ═══════════════════════════════════════════════════════════════════
// THE GAME'S RENDER GATE.
//
// AUDIT 46: a black world shipped, and every gate said pass. The lab's
// render gate loads grass-proto.html, which needs no game data - the
// GAME page needs ARENA2 and so was never gated at all. That gap is
// what let EE8's fault through: an unsized texture format made
// generateMipmap fail, the sampler was mipmap-incomplete, and an
// incomplete sampler returns BLACK for every tile. Nothing in eslint,
// the node suite or a vite build can see a GL state error, because
// none of them has a GL context.
//
// This runs the renderer's REAL upload path against a real WebGL2
// context and fails on:
//   - a GL error raised by any upload, in either ground mode;
//   - a program that did not link;
//   - a texture that came back null.
//
// It needs no game data: the layers are synthetic, because the fault
// class here is about FORMATS and COMPLETENESS, which do not care what
// the pixels are.
//
//   node tools/glGate.mjs
//
// Requires the dev server:  (setsid npx vite --port 5199 &)
import { chromium } from 'playwright';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5199/grass-proto.html';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
const fails = [];
page.on('pageerror', (e) => fails.push(`pageerror: ${e.message}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const out = [];
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const { Renderer } = await import('/src/render/renderer.js');
  let r;
  try { r = new Renderer(canvas); } catch (e) { return [`Renderer failed to construct: ${e.message}`]; }
  const gl = r.gl;
  // drain anything the constructor left, so what follows is ours
  while (gl.getError() !== gl.NO_ERROR) { /* drain */ }

  const layer = (n) => {
    const c = new Uint8ClampedArray(64 * 64 * 4);
    for (let k = 0; k < 64 * 64; k++) {
      c[k * 4] = (n * 37) & 255; c[k * 4 + 1] = (n * 91) & 255;
      c[k * 4 + 2] = (n * 143) & 255; c[k * 4 + 3] = 255;
    }
    return { width: 64, height: 64, colors: c };
  };
  const layers = Array.from({ length: 56 }, (_, i) => layer(i));

  for (const enhanced of [false, true]) {
    r.enhancedGround = enhanced;
    const label = enhanced ? 'enhanced' : 'classic';
    let tex = null;
    try { tex = r.uploadTileArray(`gate-${label}`, layers); } catch (e) {
      out.push(`${label}: uploadTileArray threw: ${e.message}`); continue;
    }
    if (!tex) out.push(`${label}: no texture came back`);
    const err = gl.getError();
    if (err !== gl.NO_ERROR) out.push(`${label}: GL error 0x${err.toString(16)} after upload`);
    // MIPMAP COMPLETENESS, which is the fault that shipped: a texture
    // whose MIN_FILTER wants mips and has none samples BLACK, and the
    // only way to see that without drawing is to ask the driver.
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const min = gl.getTexParameter(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER);
    const wantsMips = min === gl.LINEAR_MIPMAP_LINEAR || min === gl.NEAREST_MIPMAP_LINEAR
      || min === gl.LINEAR_MIPMAP_NEAREST || min === gl.NEAREST_MIPMAP_NEAREST;
    if (wantsMips) {
      // if the chain is missing, generating it again raises; if it is
      // present, this is a no-op that costs nothing
      while (gl.getError() !== gl.NO_ERROR) { /* drain */ }
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      const e2 = gl.getError();
      if (e2 !== gl.NO_ERROR) {
        out.push(`${label}: MIN_FILTER wants mipmaps but the chain cannot be built (0x${e2.toString(16)}) - this samples BLACK`);
      }
    }
  }
  return out;
});

await browser.close();
for (const f of [...fails, ...result]) { console.error(`GL GATE FAIL: ${f}`); process.exitCode = 1; }
if (!process.exitCode) console.log('gl gate ok - both ground modes upload clean and complete');
