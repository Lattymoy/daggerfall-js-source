// ONE-BAD-BODY LIVE PROOF (FIELD BUGS 2026-10-13b, bible/01-Overview/bugs/Field-Bugs-2026-10-13b.md): ONE BODY'S BAD MEASURE
// BLANKS NO OTHER, ON A REAL GL.
//
// test/net/peer/fb1013b_onebadbody.test.js holds the law in node over a recording GL: a picture whose size is not a number is
// refused at the batch's door, and every other picture keeps its own tile. What node cannot do is draw. This does, on
// one Renderer in a real page, under the enhanced lighting lane (EL_LANE, its shadows on): the 3D horse - the committed
// Courser, through the very skinned pass every Morrowind body takes (world/horseRig.js -> characterSprite.js
// drawRigSpriteBox) - three abreast in ONE body batch, frame after frame, as the world frame takes them (beginFrame,
// beginCharacterSpriteBatch, the draws, flushCharacterSpriteBatch, the resolve), the screen read back:
//   - all three at finite places: each draws its own picture, every frame;
//   - the middle one at a place that is not a number (a peer whose drawn pose went non-finite): the third still draws,
//     every frame - before the door it drew nothing (0 texels). (Where the tiles after the bad one land - over the first -
//     is the suite's pin, test/net/peer/fb1013b_onebadbody.test.js: a texel count cannot tell one horse's picture from another's.)
//   - no GL error, no page error, and the refusal said once on the console.
//
// What it canNOT see: a Morrowind person (their meshes are the player's own Data Files), nor where a non-finite pose
// comes from online - the console lines the fix adds are for that. SwiftShader is not a GPU.
//
// Usage: node tools/oneBadBodyProbe.mjs [frames]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const frames = Number(process.argv[2] || 12);
const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

const server = await createServer({ server: { port: 5244, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const crashes = [], said = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
page.on('console', (m) => said.push(m.text()));

try {
  await page.goto('http://localhost:5244/mw-inspect.html');
  const out = await page.evaluate(async ({ frames }) => {
    const [{ Renderer, WORLD_FRAME }, rigMod, m, el] = await Promise.all([
      import('/src/render/renderer.js'), import('/src/world/horseRig.js'), import('/src/world/mat4.js'), import('/src/render/enhancedLighting.js'),
    ]);
    const cv = document.createElement('canvas');
    cv.style.width = '640px'; cv.style.height = '480px'; cv.width = 640; cv.height = 480;
    document.body.append(cv);
    const r = new Renderer(cv);
    const rig = rigMod.horseRigFor(r);
    await rig.load();
    if (!rig.ready()) return { error: rig.failure() ?? 'not ready' };
    for (let i = 0; i < 64 && rig.kept().length < 1; i++) rig.tick();
    const hs = [rig.horse(1), rig.horse(2), rig.horse(3)];
    const gl = r.gl, W = 640, H = 480;
    const proj = m.perspective(Math.PI / 3, W / H, 0.1, 500), eye = [0, 1.7, 9];
    const view = m.lookAt(eye, [0, 1, 0], [0, 1, 0]);
    r.setLightingLane(el.EL_LANE);
    const results = {};
    for (const bad of [false, true]) {
      const series = [];
      for (let f = 0; f < frames; f++) {
        rig.tick();
        const xs = [-3.2, 0, 3.2];
        hs.forEach((h, i) => rig.step(h, { feet: [bad && i === 1 ? NaN : xs[i], 0, 0], yaw: Math.PI / 2, speed: 0, dt: 1 / 60, look: 0 }));
        r.setClearColor([0.2, 0.3, 0.6, 1]);
        r.beginFrame(proj, view, new Float32Array([0.3, 0.8, 0.5]), WORLD_FRAME);
        r.beginCharacterSpriteBatch();
        try { for (const h of hs) rig.draw(h, cv, { proj, view, eye }); } finally { r.flushCharacterSpriteBatch(); }
        r.resolveFrame?.();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const region = (x0, x1) => {
          let n = 0;
          for (let y = Math.floor(H * 0.25); y < Math.floor(H * 0.75); y++) for (let x = Math.floor(W * x0); x < Math.floor(W * x1); x++) {
            const i = (y * W + x) * 4;
            if (Math.abs(px[i] - 51) + Math.abs(px[i + 1] - 77) + Math.abs(px[i + 2] - 153) > 40) n++;
          }
          return n;
        };
        series.push({ left: region(0, 0.33), right: region(0.67, 1), err: gl.getError() });
      }
      results[bad ? 'middleNaN' : 'allFinite'] = series;
    }
    return { results };
  }, { frames });
  if (out.error) throw new Error(out.error);
  const { allFinite, middleNaN } = out.results;
  const min = (s, k) => Math.min(...s.map((x) => x[k]));
  console.log('texels, least over the frames - all finite: left', min(allFinite, 'left'), 'right', min(allFinite, 'right'), '| middle NaN: left', min(middleNaN, 'left'), 'right', min(middleNaN, 'right'));
  ok(min(allFinite, 'left') > 1000 && min(allFinite, 'right') > 1000, 'three horses at finite places: the outer two draw on every frame');
  ok(min(middleNaN, 'right') > 1000, 'the middle one at a place that is not a number: the third still draws on every frame (before the door: 0 texels)');
  ok([...allFinite, ...middleNaN].every((s) => s.err === 0), 'no GL error');
  ok(said.filter((t) => t.includes('could not be measured')).length === 1, 'the refusal said once on the console');
} catch (e) {
  fails.push(String(e?.message ?? e));
  console.log('FAIL', e?.message ?? e);
} finally {
  if (crashes.length) { console.log('pageerrors:', crashes.join(' | ')); fails.push('page errors'); }
  await browser.close();
  await server.close();
}
console.log(fails.length ? `ONE-BAD-BODY PROBE: ${fails.length} FAILURE(S)` : 'ONE-BAD-BODY PROBE: ALL GREEN');
process.exit(fails.length ? 1 : 0);
