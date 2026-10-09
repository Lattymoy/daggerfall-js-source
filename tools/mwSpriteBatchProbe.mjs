// MWNPC2 LIVE PROOF: ONE BIND FOR EVERY BODY DRAWS THE FRAME THE LONE PASSES DREW - IN A REAL BROWSER.
//
// test/mwnpc2_onepass.test.js holds the batch's calls on a recording GL: two binds for three bodies, a tile each, a
// quad sampling its tile. What a recording GL cannot say is that the PICTURE is the same. This draws three fixture
// bodies (the GPU-skinned rig of MWNPC1) into one frame the old way - each its own pass of the sprite target - reads
// the frame back, draws the same frame again through the batch, reads it back, and compares texel by texel. A tile
// drawn under the wrong camera, a quad sampling the wrong tile, a tile left uncleared: each is a different frame.
//
// Usage: node tools/mwSpriteBatchProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({ server: { port: 5232, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

try {
  await page.goto('http://localhost:5232/mw-inspect.html');
  const boot = await page.evaluate(async () => {
    const [{ Renderer }, fp, mat4, rig] = await Promise.all([
      import('/src/render/renderer.js'), import('/src/combat/fpArm.js'), import('/src/world/mat4.js'), import('/test/fixtures/mw/bodyRigBrowser.mjs'),
    ]);
    const cv = document.createElement('canvas');
    cv.style.width = '640px'; cv.style.height = '480px'; cv.width = 640; cv.height = 480;
    document.body.append(cv);
    const renderer = new Renderer(cv);
    const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
    const rigs = [];
    for (let i = 0; i < 3; i++) {
      const r = fp.createFpArm(); r.attach(renderer, cam);
      const res = await r.build({ race: 'fprace', deps: await rig.fixtureBodyDepsBrowser() });
      if (!res.ok) return { ok: false, error: res.error };
      r.setViewMode('third'); r.update(0.016 * (i + 1));
      rigs.push(r);
    }
    Object.assign(window, { __r: renderer, __rigs: rigs, __mat4: mat4, __cv: cv });
    return { ok: true, skins: rigs.map((r) => r.status().third.skin) };
  });
  ok(boot.ok, `three fixture bodies build (${boot.error ?? boot.skins.join(', ')})`);

  const frame = (batched) => page.evaluate((batched) => {
    const r = window.__r, m = window.__mat4, cv = window.__cv;
    const proj = m.mirrorProjectionX(m.perspective(0.9, 640 / 480, 0.05, 100));
    const eye = [0, 0.4, 2.2];
    const view = m.lookAt(eye, [0, 0.3, 0], [0, 1, 0]);
    r.beginFrame(proj, view, new Float32Array([0.3, -0.8, 0.4]));
    if (batched) r.beginCharacterSpriteBatch();
    const drew = window.__rigs.map((rig, i) => rig.drawThird(cv, { proj, view, eye, feet: [(i - 1) * 0.5, 0, -0.2 * i], yaw: 0.6 * i, grow: 30 }));
    const binds0 = r.stats.spriteBinds;
    if (batched) r.flushCharacterSpriteBatch();
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, r._frameFbo ?? null);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { drew, w, h, px: Array.from(px), binds: r.stats.spriteBinds - binds0 };
  }, batched);

  const lone = await frame(false);
  const batch = await frame(true);
  ok(lone.drew.every(Boolean) && batch.drew.every(Boolean), 'every body drew both ways');
  ok(batch.binds === 1, `the batch took one bind of the sprite target (${batch.binds})`);
  let differ = 0, maxd = 0, inked = 0;
  const clear = [lone.px[0], lone.px[1], lone.px[2]];
  for (let i = 0; i < lone.px.length; i += 4) {
    const d = Math.max(Math.abs(lone.px[i] - batch.px[i]), Math.abs(lone.px[i + 1] - batch.px[i + 1]), Math.abs(lone.px[i + 2] - batch.px[i + 2]));
    if (d > 0) differ++;
    if (d > maxd) maxd = d;
    if (lone.px[i] !== clear[0] || lone.px[i + 1] !== clear[1] || lone.px[i + 2] !== clear[2]) inked++;
  }
  ok(inked > 300, `the lone frame shows the bodies (${inked} texels off the clear)`);
  ok(differ === 0, `the batched frame is the lone frame, texel for texel (${differ} differ, max ${maxd})`);
  ok(crashes.length === 0, `no page errors (${crashes.join(' | ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nMWNPC2 PROBE: ${fails.length} FAILED` : '\nMWNPC2 PROBE: ALL GREEN');
process.exit(fails.length ? 1 : 0);
