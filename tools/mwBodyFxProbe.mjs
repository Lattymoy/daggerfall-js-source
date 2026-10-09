// MWNPC5 LIVE PROOF: A FOE'S TELLS ON ITS BODY - IN A REAL BROWSER.
//
// test/mwnpc5_bodyfx.test.js holds the uniforms each quad sends and the box's padding on a recording GL. What it cannot
// say is that the shader compiles and that the picture changes the way the billboards' does. This draws one fixture body
// (the GPU-skinned rig of MWNPC1) plain, then with each tell, reads the frame back each time and compares with the plain:
//   - the glint: texels OFF the plain silhouette lit (the outline) and the body lifted toward the colour;
//   - the elite: an outline too, and over a second of its clock, embers above the head;
//   - the dissolve at a half: body texels gone;
//   - none of them: the plain frame exactly;
//   - and batched beside two neighbours, the frame each body's own pass draws, texel for texel: no outline or ember
//     reads a neighbour's tile (the tile clamp).
//
// Usage: node tools/mwBodyFxProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({ server: { port: 5233, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') crashes.push(m.text()); });
const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

try {
  await page.goto('http://localhost:5233/mw-inspect.html');
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
      r.setViewMode('third'); r.update(0.016);
      rigs.push(r);
    }
    Object.assign(window, { __r: renderer, __rigs: rigs, __mat4: mat4, __cv: cv });
    return { ok: true };
  });
  ok(boot.ok, `the fixture bodies build (${boot.error ?? 'ok'})`);

  /** one frame: body 0 at the centre with `fx`; `others` also draws bodies 1 and 2 beside it (batched when `batched`) */
  const frame = (fx, { batched = false, others = false } = {}) => page.evaluate(({ fx, batched, others }) => {
    const r = window.__r, m = window.__mat4, cv = window.__cv;
    const proj = m.mirrorProjectionX(m.perspective(0.9, 640 / 480, 0.05, 100));
    const eye = [0, 0.4, 2.2];
    const view = m.lookAt(eye, [0, 0.3, 0], [0, 1, 0]);
    r.beginFrame(proj, view, new Float32Array([0.3, -0.8, 0.4]));
    if (batched) r.beginCharacterSpriteBatch();
    const at = [[0, 0, 0], [-0.55, 0, 0], [0.55, 0, 0]];
    const drew = [];
    // yaw a quarter turn: the fixture's arm meshes are flat, and side-on they are a line
    for (let i = 0; i < (others ? 3 : 1); i++) drew.push(window.__rigs[i].drawThird(cv, { proj, view, eye, feet: at[i], yaw: 1.57, grow: 30, fx: i === 0 ? fx : null }));
    if (batched) r.flushCharacterSpriteBatch();
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, r._frameFbo ?? null);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { drew, w, h, px: Array.from(px) };
  }, { fx, batched, others });

  await frame(null, { others: true });   // warm: the sprite target and every program made before a frame is compared
  const plain = await frame(null);
  ok(plain.drew.every(Boolean), 'the body drew');
  const clear = [plain.px[0], plain.px[1], plain.px[2]];
  const isClear = (px, i) => px[i] === clear[0] && px[i + 1] === clear[1] && px[i + 2] === clear[2];
  const compare = (a, b) => {
    let outside = 0, inside = 0, gone = 0, same = 0, body = 0;
    for (let i = 0; i < a.px.length; i += 4) {
      const pa = isClear(a.px, i), pb = isClear(b.px, i);
      if (!pa) body++;
      if (pa && !pb) outside++;   // b lit a texel a left clear: an outline, an ember
      else if (!pa && pb) gone++;   // b cleared a texel a drew: dissolved
      else if (!pa && !pb) { if (a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1] || a.px[i + 2] !== b.px[i + 2]) inside++; else same++; }
    }
    return { outside, inside, gone, same, body };
  };
  ok(compare(plain, plain).body > 150, `the plain frame shows the body (${compare(plain, plain).body} texels)`);

  const none = await frame({ glint: null, elite: 0, time: 0, dissolve: null });
  const n = compare(plain, none);
  ok(n.outside === 0 && n.inside === 0 && n.gone === 0, `no tell: the plain frame exactly (${JSON.stringify(n)})`);

  const glint = await frame({ glint: [1, 0.2, 0.1, 1], elite: 0, time: 0, dissolve: null });
  const g = compare(plain, glint);
  ok(g.outside > 40, `the glint draws an outline off the silhouette (${g.outside} texels)`);
  ok(g.inside > g.body * 0.5, `and lifts the body toward its colour (${g.inside} of ${g.body} changed)`);

  const elite = await frame({ glint: null, elite: 1, time: 0.3, dissolve: null });
  const e = compare(plain, elite);
  ok(e.outside > 40, `the elite draws its outline (${e.outside} texels)`);
  let embers = 0;
  for (const t of [0.4, 0.9, 1.4, 1.9, 2.4]) {
    const f = await frame({ glint: null, elite: 1, time: t, dissolve: null });
    embers = Math.max(embers, compare(plain, f).outside - e.outside);
  }
  ok(embers !== 0, `and embers come and go over its clock (${embers} texels' difference at most)`);

  const corpse = await frame({ glint: null, elite: -0.5, time: 0.3, dissolve: null });
  const c = compare(plain, corpse);
  ok(c.outside > 40 && c.inside === 0, `an elite's corpse: the outline alone, no warmth (${JSON.stringify(c)})`);

  const half = await frame({ glint: [1, 0.2, 0.1, 1], elite: 1, time: 0.3, dissolve: [0.5, 1, 0.5, 0.1] });
  const d = compare(plain, half);
  ok(d.gone > d.body * 0.2, `the dissolve at a half takes the body away (${d.gone} of ${d.body} gone)`);
  ok(d.outside === 0, `and draws no outline while it burns (${d.outside})`);

  // the tile clamp: a body drawn alone takes its own pass, its picture in the corner with nothing beside it - so the
  // batched frame, the glinting body's tile packed against its neighbours', must be that frame texel for texel
  const G = { glint: [1, 0.2, 0.1, 1], elite: 1, time: 0.7, dissolve: null };
  const loneFx = await frame(G, { others: true });
  const batchFx = await frame(G, { others: true, batched: true });
  let differ = 0;
  for (let i = 0; i < loneFx.px.length; i += 4) if (loneFx.px[i] !== batchFx.px[i] || loneFx.px[i + 1] !== batchFx.px[i + 1] || loneFx.px[i + 2] !== batchFx.px[i + 2]) differ++;
  const lit = compare(await frame(null, { others: true }), loneFx).outside;
  ok(lit > 40, `three bodies, the centre one glinting and elite: its outline drawn (${lit} texels)`);
  ok(differ === 0, `and batched, the frame drawn alone texel for texel - no outline or ember read off a neighbour's tile (${differ} differ)`);
  // THE CLAMP ITSELF: a tile of nothing ringed by ink. The sprite target filled opaque, a 64-texel square at (100, 100)
  // cleared to nothing, and a glinting, elite quad drawn over that square alone. Clamped to its tile, every fragment
  // finds nothing within two texels and nothing below it: no outline, no ember - nothing drawn. Reading the target
  // past the tile, the square's border would ring with the outline off its neighbour's ink.
  const ringed = await page.evaluate(() => {
    const r = window.__r, m = window.__mat4, gl = r.gl;
    const proj = m.mirrorProjectionX(m.perspective(0.9, 640 / 480, 0.05, 100));
    const view = m.lookAt([0, 0.4, 2.2], [0, 0.3, 0], [0, 1, 0]);
    r.beginFrame(proj, view, new Float32Array([0.3, -0.8, 0.4]));
    const cs = r._charSpriteRT();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearBufferfv(gl.COLOR, 0, new Float32Array([0.8, 0.1, 0.1, 1]));
    gl.enable(gl.SCISSOR_TEST); gl.scissor(100, 100, 64, 64);
    gl.clearBufferfv(gl.COLOR, 0, new Float32Array([0, 0, 0, 0]));
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, r._frameFbo ?? null);
    const S = 1024;
    const draw = (fx) => {
      r.beginFrame(proj, view, new Float32Array([0.3, -0.8, 0.4]));
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      r.drawCharacterSpriteQuad(cs.tex, [0, 0.3, 0], 0.5, 0.5, [1, 0, 0], 64 / S, 64 / S, 0, null, null, [100 / S, 100 / S], fx);
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let ink = 0; for (let i = 0; i < px.length; i += 4) if (px[i] || px[i + 1] || px[i + 2]) ink++;
      return ink;
    };
    // the control: the same quad one texel into the ink - its own tile now holds ink, and the outline must show
    const glint = { glint: [1, 1, 0, 1], elite: 1, time: 0.7, dissolve: null };
    const empty = draw(glint);
    const ctl = (() => {
      r.beginFrame(proj, view, new Float32Array([0.3, -0.8, 0.4]));
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      r.drawCharacterSpriteQuad(cs.tex, [0, 0.3, 0], 0.5, 0.5, [1, 0, 0], 66 / S, 66 / S, 0, null, null, [99 / S, 99 / S], glint);
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let ink = 0; for (let i = 0; i < px.length; i += 4) if (px[i] || px[i + 1] || px[i + 2]) ink++;
      return ink;
    })();
    return { empty, ctl };
  });
  ok(ringed.ctl > 0, `control: a tile holding a ring of ink draws its body and the outline round it (${ringed.ctl} texels)`);
  ok(ringed.empty === 0, `a tile of nothing ringed by ink draws nothing - the outline reads its own tile alone (${ringed.empty} texels)`);
  ok(crashes.length === 0, `no page errors (${crashes.join(' | ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nMWNPC5 FX PROBE: ${fails.length} FAILED` : '\nMWNPC5 FX PROBE: ALL GREEN');
process.exit(fails.length ? 1 : 0);
