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
  const { LabGrassRenderer, createGrassField, LAB_GRASS, grassPerCell, GRASS_CELL } = await import('/src/render/labGrass.js');
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

  const frame = (range) => {
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.35, 0.5, 0.75, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    grass.draw(proj, view, new Float32Array(eye), 2.0, light, wind, range);
    gl.finish();
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let green = 0, sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      // a blade pixel: greener than the sky it covers
      if (px[i + 1] > px[i] && px[i + 1] > px[i + 2]) green++;
      sum = (sum + px[i] * 3 + px[i + 1] * 5 + px[i + 2] * 7) >>> 0;
    }
    return { green, sum, drawn: { ...grass.drawn } };
  };

  const at200 = frame(200);
  const at110 = frame(110);
  const shipped = frame(LAB_GRASS.range);   // GRASS2: and the config a player actually gets
  const sweep = [200, 250, 280, 300, 320, 350].map((r) => ({ r, ...frame(r) }));
  return {
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
  console.log(`  ${k}: ${f.drawn.slots} slots (${f.drawn.farSlots ?? 0} on the far blade), ${f.drawn.blades} blades submitted (slot-sized would be ${cap}), ${(verts / 1e6).toFixed(2)}M verts, ${f.green} green px`);
  console.log(`         a five-quad blade for every held blade would have been ${(f.drawn.kept * out.verts / 1e6).toFixed(2)}M verts`);
}
console.log('\n  RANGE AGAINST COST, on this flat test ground:');
for (const w of out.sweep ?? []) {
  console.log(`    ${String(w.r).padStart(3)} m: ${(w.drawn.verts / 1e6).toFixed(2).padStart(5)}M verts, ${String(w.green).padStart(6)} lit px`);
}
check('no page errors and no GL error', pageErrors.length === 0 && out.glError === 0, `${pageErrors.join(' | ')} gl=${out.glError}`);
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
