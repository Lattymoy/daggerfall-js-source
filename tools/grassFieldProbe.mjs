// GRASS2 (2026-09-18, Mac: "improve grass, improve grass performance, and
// also have it be seen at long ranges"): THE FIELD ON A REAL GPU.
//
// Every grass pin runs on a fake GL that compiles anything and draws
// nothing, and this container has no ARENA2, so the real exterior cannot
// be booted here at all. What CAN be driven is the thing the work
// changes: `LabGrassRenderer` and `createGrassField` over a SYNTHETIC
// ground - a flat plane where every point is grass - on a real WebGL2
// context. That is enough to answer the two questions that matter:
//
//   1. HOW MANY BLADES reach the GPU, exactly, per frame. This is the
//      number every optimisation here moves, and it is counted rather
//      than estimated.
//   2. DOES THE PICTURE CHANGE. Each optimisation is meant to be
//      invisible; the frame is read back and compared against the
//      baseline the same seed drew before it.
//
// SwiftShader is a software rasteriser, so the milliseconds are NOT
// Mac's milliseconds and this probe never claims they are. Blade counts
// are exact and deterministic, and they are what is reported.
//
//     node tools/grassFieldProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5298, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
await page.goto('http://localhost:5298/play/');

const out = await page.evaluate(async () => {
  const { LabGrassRenderer, createGrassField, LAB_GRASS, grassPerCell, GRASS_CELL, LAB_GRASS_VS, LAB_GRASS_FS } = await import('/src/render/labGrass.js');
  const { perspective, lookAt } = await import('/src/world/mat4.js');
  const W = 640, H = 400;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  document.body.append(canvas);
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return { error: 'no webgl2' };
  gl.enable(gl.DEPTH_TEST);

  const grass = new LabGrassRenderer(gl);
  // THE SYNTHETIC GROUND: a flat plane at y=0 where every point is grass,
  // so the placer keeps every candidate and the cell is FULL. That is the
  // worst case for the pad and the best case for a like-for-like count.
  const keep = () => 0;
  const ground = () => [0.10, 0.145, 0.065];
  const field = createGrassField(grass, { keep, ground, perFrame: 1e9 });
  const eye = [0, 1.7, 0];
  field.update(eye[0], eye[2], keep, ground);

  const proj = perspective(Math.PI / 3, W / H, 0.1, 4000);
  const view = lookAt(eye, [0, 1.2, -100], [0, 1, 0]);
  const light = { sunDir: [0.3, 0.8, 0.5], amb: [0.35, 0.38, 0.35], sunCol: [1, 0.97, 0.9], dim: 1, sunScale: 1 };
  const wind = { dir: [1, 0], speed: 70, windV: [0.01, 0] };

  // GRASS AUDIT 1: the lab's own program beside the game's, over the
  // SAME field, so the smooth style can be held byte-identical to it
  const lab = new LabGrassRenderer(gl, { stages: { vs: LAB_GRASS_VS, fs: LAB_GRASS_FS } });
  const labField = createGrassField(lab, { keep, ground, perFrame: 1e9 });
  labField.update(eye[0], eye[2], keep, ground);
  const DAY_SKY = [0.35, 0.5, 0.75], NIGHT_SKY = [0.03, 0.04, 0.08];   // GRASS AUDIT 1: a night frame clears to a night sky, or the smooth blades' translucent bases let a noon sky through and the comparison is the sky's
  const bayer = (x, y) => { const q = x & 3, r = y & 3, xx = q ^ r; return ((xx & 1) << 3) | ((r & 1) << 2) | (xx & 2) | ((r & 2) >> 1); };
  const frame = (range, style = 'smooth', { r = grass, lit = light, sky = DAY_SKY } = {}) => {
    const SKY = sky.map((v) => Math.round(v * 255));
    gl.viewport(0, 0, W, H);
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.draw(proj, view, new Float32Array(eye), 2.0, lit, wind, range, style);   // GRASS-PX: the style is the draw's last word
    gl.finish();
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let green = 0, sum = 0, nonSky = 0, black = 0, lum = 0;
    const tones = new Set();
    const ranks = new Array(16).fill(0), rankAll = new Array(16).fill(0);
    const bands = new Array(8).fill(0), bandAll = new Array(8).fill(0);   // GRASS AUDIT 1: coverage by screen band, bottom (near) to top
    const topRow = new Int32Array(W).fill(-1), botRow = new Int32Array(W).fill(-1), nearTop = new Int32Array(W).fill(-1);
    for (let i = 0; i < px.length; i += 4) {
      const p = i >> 2, x = p % W, y = (p / W) | 0;
      const isSky = px[i] === SKY[0] && px[i + 1] === SKY[1] && px[i + 2] === SKY[2];
      // a blade pixel: greener than the sky it covers
      if (px[i + 1] > px[i] && px[i + 1] > px[i + 2]) { green++; tones.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]); }
      sum = (sum + px[i] * 3 + px[i + 1] * 5 + px[i + 2] * 7) >>> 0;
      rankAll[bayer(x, y)]++; bandAll[(y * 8 / H) | 0]++;
      if (!isSky) {
        nonSky++; ranks[bayer(x, y)]++; bands[(y * 8 / H) | 0]++;
        lum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        if (px[i] === 0 && px[i + 1] === 0 && px[i + 2] === 0) black++;   // EXACT black: the ramp's zero rung, not a dark root at night
        if (y > topRow[x]) topRow[x] = y;
        if (y < H / 8) { if (y < botRow[x] || botRow[x] < 0) botRow[x] = y; if (y > nearTop[x]) nearTop[x] = y; }
      }
    }
    // the NEAREST band (the bottom eighth of the screen, where a tuft is
    // tens of pixels tall): per column, its lowest grass pixel is a root
    // and its highest is up a blade - the sheet is the right way up when
    // the highest is the brighter
    let topLum = 0, lowLum = 0, cols = 0;
    for (let x = 0; x < W; x++) {
      if (botRow[x] < 0 || nearTop[x] <= botRow[x] + 4) continue;
      const a = (nearTop[x] * W + x) * 4, b = (botRow[x] * W + x) * 4;
      topLum += px[a] * 0.299 + px[a + 1] * 0.587 + px[a + 2] * 0.114; lowLum += px[b] * 0.299 + px[b + 1] * 0.587 + px[b + 2] * 0.114; cols++;
    }
    return { green, sum, tones: tones.size, nonSky, black, meanLum: nonSky ? lum / nonSky : 0,
      rankFrac: ranks.map((n, k) => n / rankAll[k]), bandFrac: bands.map((n, k) => n / bandAll[k]),
      topLum: cols ? topLum / cols : 0, lowLum: cols ? lowLum / cols : 0, drawn: { ...r.drawn } };
  };

  const at200 = frame(200);
  const at110 = frame(110);
  const shipped = frame(LAB_GRASS.range);   // GRASS2: and the config a player actually gets
  const sweep = [200, 250, 280, 300, 320, 350].map((r) => ({ r, ...frame(r) }));
  // GRASS-PX: the same field in the pixel style - the same program, one
  // uniform flipped - and then the sheet itself read back off the GPU
  const pixel = frame(200, 'pixel');
  const pixelShipped = frame(LAB_GRASS.range, 'pixel');
  // GRASS AUDIT 1: the executed pins - the lab's program over the same
  // field, a night light, a dithered range, the far band
  const labFrame = frame(200, 'smooth', { r: lab });
  const night = { sunDir: [0.3, 0.8, 0.5], amb: [0.25, 0.25, 0.30], sunCol: [1, 0.97, 0.9], dim: 1, sunScale: 0, moonDir: [0.2, 0.9, 0.3], moonScale: 0.2, moonCol: [0.7, 0.75, 0.9] };
  const nightSmooth = frame(200, 'smooth', { lit: night, sky: NIGHT_SKY }), nightPixel = frame(200, 'pixel', { lit: night, sky: NIGHT_SKY });
  const storm = { ...light, dim: 0.46, sunScale: 0.3 };
  const stormSmooth = frame(200, 'smooth', { lit: storm }), stormPixel = frame(200, 'pixel', { lit: storm });
  const dithered = frame(60, 'pixel'), undithered = frame(300, 'pixel');
  const pxSheet = (() => {
    const w = grass.pxVariants * 16, h = 32;
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, grass.pxSheet, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    const buf = new Uint8Array(w * h * 4);
    if (ok) gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
    let soft = 0, blade = 0;
    for (let i = 3; i < buf.length; i += 4) { if (buf[i] !== 0 && buf[i] !== 255) soft++; if (buf[i] === 255) blade++; }
    return { ok, soft, blade, w, h };
  })();
  return {
    pixel, pixelShipped, pxSheet, labFrame, nightSmooth, nightPixel, stormSmooth, stormPixel, dithered, undithered,
    perCell: grassPerCell(), cell: GRASS_CELL, slots: field.slots, verts: grass.verts,
    labRange: LAB_GRASS.range, labHeight: LAB_GRASS.height, density: LAB_GRASS.density,
    liveCells: field.live.size, at200, at110, shipped, sweep, glError: gl.getError(),
  };
});

if (out.error) { console.log('FAIL', out.error); await browser.close(); await server.close(); process.exit(1); }
console.log(`  cell ${out.cell}m, ${out.perCell} blades/slot, ${out.slots} slots, ${out.verts} verts/blade, lab range ${out.labRange}m height ${out.labHeight}`);
console.log(`  cells filled ${out.liveCells}`);
for (const [k, f] of [[`SHIPPED (range ${out.labRange})`, out.shipped], ['range 200', out.at200], ['range 110', out.at110]]) {
  const cap = f.drawn.slotCapacity ?? f.drawn.slots * out.perCell;
  const verts = f.drawn.verts ?? f.drawn.blades * out.verts;
  console.log(`  ${k}: ${f.drawn.slots} slots (${f.drawn.farSlots ?? 0} on the one-quad blade), ${f.drawn.blades} blades submitted (slot-sized would be ${cap}), ${(verts / 1e6).toFixed(2)}M verts, ${f.green} green px`);
  console.log(`         a five-quad blade for every held blade would have been ${(f.drawn.kept * out.verts / 1e6).toFixed(2)}M verts`);
}
console.log('\n  RANGE AGAINST COST, on this flat test ground:');
for (const w of out.sweep ?? []) {
  console.log(`    ${String(w.r).padStart(3)} m: ${(w.drawn.verts / 1e6).toFixed(2).padStart(5)}M verts, ${String(w.green).padStart(6)} lit px`);
}
check('no page errors and no GL error', pageErrors.length === 0 && out.glError === 0, `${pageErrors.join(' | ')} gl=${out.glError}`);
// GRASS-PX: the pixel style, on the same field through the same program
console.log(`  PIXEL (range 200): ${out.pixel.green} green px in ${out.pixel.tones} colours; smooth had ${out.at200.green} in ${out.at200.tones}`);
console.log(`  PIXEL (shipped range ${out.labRange}): ${out.pixelShipped.green} green px in ${out.pixelShipped.tones} colours; ${out.pixelShipped.drawn.blades} blades submitted`);
console.log(`  the sheet on the GPU: ${out.pxSheet.w}x${out.pxSheet.h}, ${out.pxSheet.blade} blade texels, ${out.pxSheet.soft} soft-alpha texels`);
check('the pixel style draws grass through the same program', out.pixel.green > 500, `${out.pixel.green} green px`);
// GRASS-PX2: the tuft is one quad everywhere, so the pixel frame's vertex work is the far blade's for every cell
console.log(`  PIXEL vertex work at the shipped range: ${(out.pixelShipped.drawn.verts / 1e6).toFixed(2)}M against smooth's ${(out.shipped.drawn.verts / 1e6).toFixed(2)}M (${(100 * (1 - out.pixelShipped.drawn.verts / out.shipped.drawn.verts)).toFixed(0)}% off)`);
check('the pixel frame submits under half the smooth frame\'s vertices - one quad a tuft', out.pixelShipped.drawn.verts < out.shipped.drawn.verts * 0.5, `${out.pixelShipped.drawn.verts} against ${out.shipped.drawn.verts}`);
check('and a different picture from the smooth one', out.pixel.sum !== out.at200.sum, `sum ${out.pixel.sum} vs ${out.at200.sum}`);
check('the pixel field takes FEWER colours than the gradient field - the ramp and the four tones', out.pixel.tones < out.at200.tones * 0.5, `${out.pixel.tones} against ${out.at200.tones}`);
check('the sheet reached the GPU with a hard alpha - no texel between 0 and 255', out.pxSheet.ok && out.pxSheet.soft === 0 && out.pxSheet.blade > 100, JSON.stringify(out.pxSheet));
// GRASS AUDIT 1: THE EXECUTED PINS. Each of these is a picture read back,
// not a line of source matched.
const pc = (v) => `${(100 * v).toFixed(1)}%`;
console.log(`  SMOOTH against the LAB's own program, same field: sum ${out.at200.sum} vs ${out.labFrame.sum}, green ${out.at200.green} vs ${out.labFrame.green}`);
check('the smooth style is the lab\'s program, byte for byte - the switch at zero is the lab\'s arithmetic', out.at200.sum === out.labFrame.sum && out.at200.green === out.labFrame.green, `${out.at200.sum} vs ${out.labFrame.sum}`);
console.log(`  DAY   pixel: ${out.pixel.nonSky} grass px, ${out.pixel.black} black, mean lum ${out.pixel.meanLum.toFixed(1)}; smooth: ${out.at200.nonSky} px, mean lum ${out.at200.meanLum.toFixed(1)}`);
console.log(`  NIGHT pixel: ${out.nightPixel.nonSky} grass px, ${out.nightPixel.black} black, mean lum ${out.nightPixel.meanLum.toFixed(1)}; smooth: ${out.nightSmooth.nonSky} px, mean lum ${out.nightSmooth.meanLum.toFixed(1)}`);
console.log(`  STORM pixel: ${out.stormPixel.nonSky} grass px, ${out.stormPixel.black} black, mean lum ${out.stormPixel.meanLum.toFixed(1)}; smooth: mean lum ${out.stormSmooth.meanLum.toFixed(1)}`);
for (const [name, f] of [['day', out.pixel], ['night', out.nightPixel], ['storm', out.stormPixel]]) check(`the pixel field is never crushed to black (${name})`, f.black < f.nonSky * 0.01, `${f.black} of ${f.nonSky}`);
check('the pixel field is as bright as the smooth one by day (within 20%)', out.pixel.meanLum > out.at200.meanLum * 0.8 && out.pixel.meanLum < out.at200.meanLum * 1.25, `${out.pixel.meanLum.toFixed(1)} vs ${out.at200.meanLum.toFixed(1)}`);
check('...and at night, so the field still goes dark with the sky (WIND4)', out.nightPixel.meanLum > out.nightSmooth.meanLum * 0.7 && out.nightPixel.meanLum < out.nightSmooth.meanLum * 1.4, `${out.nightPixel.meanLum.toFixed(1)} vs ${out.nightSmooth.meanLum.toFixed(1)}`);
check('night is darker than day in the pixel style', out.nightPixel.meanLum < out.pixel.meanLum * 0.6, `${out.nightPixel.meanLum.toFixed(1)} vs ${out.pixel.meanLum.toFixed(1)}`);
console.log(`  TIPS (nearest band, per column): highest grass pixel lum ${out.pixel.topLum.toFixed(1)}, lowest ${out.pixel.lowLum.toFixed(1)} (smooth ${out.at200.topLum.toFixed(1)} / ${out.at200.lowLum.toFixed(1)})`);
check('the tuft\'s tips are the pixels against the sky - the sheet is the right way up', out.pixel.topLum > out.pixel.lowLum * 1.2, `${out.pixel.topLum.toFixed(1)} vs ${out.pixel.lowLum.toFixed(1)}`);
const farBand = out.at200.bandFrac.reduce((k, v, i) => (v > 0.01 ? i : k), 0);   // the highest screen band with grass in it: the band under the horizon
console.log(`  WALL: pixel ${out.pixel.nonSky} grass px against smooth ${out.at200.nonSky}; band ${farBand} (under the horizon) coverage ${pc(out.pixel.bandFrac[farBand])} vs ${pc(out.at200.bandFrac[farBand])}, bands ${out.pixel.bandFrac.map(pc).join(' ')} vs ${out.at200.bandFrac.map(pc).join(' ')}`);
check('the pixel field is not a solid wall - no denser than the smooth one', out.pixel.nonSky < out.at200.nonSky * 1.1, `${out.pixel.nonSky} vs ${out.at200.nonSky}`);
check('...and the band under the horizon is no denser than the smooth one\'s', out.pixel.bandFrac[farBand] < out.at200.bandFrac[farBand] * 1.1, `${pc(out.pixel.bandFrac[farBand])} vs ${pc(out.at200.bandFrac[farBand])}`);
console.log(`  DITHER at range 60: kept by Bayer rank ${out.dithered.rankFrac.map(pc).join(' ')}; at 300 (no fade in view) ${out.undithered.rankFrac.map(pc).join(' ')}`);
check('the dither fires where the fade does - rank 0 keeps more than rank 15 at range 60, and nothing at 300', out.dithered.rankFrac[0] > out.dithered.rankFrac[15] * 1.03 && Math.abs(out.undithered.rankFrac[0] - out.undithered.rankFrac[15]) < 0.01, `${pc(out.dithered.rankFrac[0])} vs ${pc(out.dithered.rankFrac[15])}`);
check('the field grew and the frame has grass in it', out.liveCells > 0 && out.at200.green > 500, `${out.liveCells} cells, ${out.at200.green} green px`);
// THE PAD. On a plane that is grass everywhere the placer keeps nearly
// every candidate, so `kept` and the slot size agree here BY
// CONSTRUCTION - the pad's saving is a real terrain's to give (roads,
// water, shorelines, the tiles the archive does not call grass). What is
// checked here is the seam that gives it: the draw is instanced on a
// count the host chose, never on the slot's size.
check('the field submits FEWER blades than it holds - the fade is paid on the host, not in the vertex shader',
  out.at200.drawn.blades < out.at200.drawn.kept, JSON.stringify(out.at200.drawn));
// THE SHIPPED CONFIG, stated on its own line: the two measurements above
// it are a controlled comparison against the lab's old 200 m range, and
// this is what the player's frame actually submits.
check('the shipped range submits less vertex work than a five-quad blade for every held blade would',
  out.shipped.drawn.verts < out.shipped.drawn.kept * out.verts * 0.55,
  `${(out.shipped.drawn.verts / 1e6).toFixed(2)}M against ${(out.shipped.drawn.kept * out.verts / 1e6).toFixed(2)}M at range ${out.labRange}`);
check('the far cells drop to the one-quad blade', (out.at200.drawn.farSlots ?? 0) > 0 && out.at200.drawn.farSlots < out.at200.drawn.slots,
  `${out.at200.drawn.farSlots} of ${out.at200.drawn.slots} slots`);
{
  const was = out.at200.drawn.kept * out.verts, now = out.at200.drawn.verts;
  check('and the two together take most of the vertex work off the frame', now < was * 0.55, `${(now / 1e6).toFixed(2)}M against ${(was / 1e6).toFixed(2)}M, ${(100 * (1 - now / was)).toFixed(0)}% off`);
}
{
  const held = out.at200.drawn.kept, sent = out.at200.drawn.blades;
  console.log(`  the prefix: ${sent} of ${held} blades submitted, ${(100 * (1 - sent / held)).toFixed(1)}% of the transform work declined before it started`);
  console.log(`  NOTE: range 200 covers ${(Math.PI * 200 * 200 / 1e4).toFixed(1)} ha and range 110 ${(Math.PI * 110 * 110 / 1e4).toFixed(1)} ha; the band between them is ${(100 * (1 - 110 * 110 / (200 * 200))).toFixed(0)}% of the area`);
}

await browser.close();
await server.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
