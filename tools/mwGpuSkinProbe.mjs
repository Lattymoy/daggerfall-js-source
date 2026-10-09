// MWNPC1 LIVE PROOF: THE SKIN IN THE VERTEX SHADER DRAWS THE BODY THE CPU SKIN DREW - IN A REAL BROWSER.
//
// test/mwnpc1_gpuskin.test.js holds the GPU skin's law to the CPU skin in node: the stream, the palette and the
// shader's law in JS (formats/mwGpuSkin.js skinStreamCorner) against poseAssembly + packFpArm, the fragment's face
// normal in JS against the packed path's lit normal, and the GLSL's TEXT against both. What node cannot do is run
// the GLSL. This does: the same fixture body built twice in one page on one Renderer - one rig on the renderer
// itself (the GPU skin), one on a view of it with the skinned path hidden (gpuSkinOn answers false: the CPU skin) -
// posed at the same clock, each mesh rendered through the SAME sprite pass under the same model, ortho camera and
// light, and the two pictures read back and compared texel by texel. A wrong sign in the blend, a post composed per
// bone, a mirrored piece's flip lost, a face normal from the wrong side of the winding: each is a different picture.
//
// What it canNOT see, stated so nobody mistakes green for finished: the fixture body is an arm's worth of pieces,
// not a retail body, and SwiftShader is not a GPU - the probe proves the law, not the frame time.
//
// Usage: node tools/mwGpuSkinProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

try {
  await page.goto('http://localhost:5231/mw-inspect.html');
  const boot = await page.evaluate(async () => {
    const [{ Renderer }, fp, mat4, mwfp, rig] = await Promise.all([
      import('/src/render/renderer.js'),
      import('/src/combat/fpArm.js'),
      import('/src/world/mat4.js'),
      import('/src/formats/mwFirstPerson.js'),
      import('/test/fixtures/mw/bodyRigBrowser.mjs'),
    ]);
    const cv = document.createElement('canvas');
    cv.style.width = '800px'; cv.style.height = '600px'; cv.width = 800; cv.height = 600;
    document.body.append(cv);
    const renderer = new Renderer(cv);
    // the CPU rig's renderer: the same one, with the skinned path out of sight
    const plain = new Proxy(renderer, {
      get(t, k) {
        if (k === 'createSkinnedCharacterMesh') return undefined;
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
    const deps = await rig.fixtureBodyDepsBrowser();
    const gpu = fp.createFpArm(); gpu.attach(renderer, cam);
    const cpu = fp.createFpArm(); cpu.attach(plain, cam);
    const a = await gpu.build({ race: 'fprace', deps });
    const b = await cpu.build({ race: 'fprace', deps });
    gpu.setViewMode('third'); cpu.setViewMode('third');
    Object.assign(window, { __r: renderer, __gpu: gpu, __cpu: cpu, __mat4: mat4, __fp: fp, __mwfp: mwfp });
    return { a: { ok: a.ok, error: a.error }, b: { ok: b.ok, error: b.error } };
  });
  ok(boot.a.ok && boot.b.ok, `both rigs build the fixture body (${boot.a.error ?? ''}${boot.b.error ?? ''})`);

  /** pose both rigs `dt` on, then render each one's third mesh through the same sprite pass and read both back */
  const shot = (dt, yawDeg, light) => page.evaluate(({ dt, yawDeg, light }) => {
    const r = window.__r, m = window.__mat4, fp = window.__fp;
    window.__gpu.update(dt); window.__cpu.update(dt);
    const gm = window.__gpu.thirdMesh(), cm = window.__cpu.thirdMesh();
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    r.beginFrame(I, I, new Float32Array(light));
    const u = 1 / window.__mwfp.MW_UNITS_PER_METER * 40;   // the fixture is an arm: grown so it fills the picture
    const model = m.multiply(m.trs(0, 0, 0, 0, yawDeg + 180, 0, -u, u * 1.1, u * 0.95), fp.NIF_TO_PASS);   // drawThird's mirrored, unequal model
    // frame on the CPU rig's exact fold, in the world
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const rg of cm.ranges) {
      const b = rg.box; if (!b) continue;
      for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
        const p = m.transformPoint(model, x, y, z);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      }
    }
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const half = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 * 1.15 + 1e-3;
    const eye = [c[0] + half * 0.6, c[1] + half * 0.4, c[2] + half * 3];
    const view = m.lookAt(eye, c, [0, 1, 0]);
    const proj = m.ortho(half, half, 0.01, half * 8);
    const pw = 256, ph = 256;
    const read = (mesh) => {
      r.renderCharacterSprite(mesh, model, proj, view, pw, ph);
      const gl = r.gl, cs = r._charSpriteRT();
      gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
      const px = new Uint8Array(pw * ph * 4);
      gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px;
    };
    const G = read(gm), C = read(cm);
    let covG = 0, covC = 0, both = 0, cover = 0, maxd = 0, sumd = 0, lum = new Set();
    for (let i = 0; i < pw * ph; i++) {
      const ga = G[i * 4 + 3] > 8, ca = C[i * 4 + 3] > 8;
      if (ga) covG++; if (ca) covC++;
      if (ga !== ca) { cover++; continue; }
      if (!ga) continue;
      both++;
      lum.add(C[i * 4] + C[i * 4 + 1] + C[i * 4 + 2]);
      for (let k = 0; k < 3; k++) { const d = Math.abs(G[i * 4 + k] - C[i * 4 + k]); if (d > maxd) maxd = d; sumd += d; }
    }
    return { gpuSkin: !!gm.skin, cpuSkin: !cm.skin, covG, covC, cover, both, maxd, meand: both ? sumd / (both * 3) : 0, shades: lum.size,
      gStatus: window.__gpu.status().third.skin, cStatus: window.__cpu.status().third.skin };
  }, { dt, yawDeg, light });

  for (const [i, [dt, yaw, light]] of [[0.016, 0, [0.3, -0.9, 0.2]], [0.41, 37, [-0.6, -0.5, 0.4]], [0.73, 140, [0.2, -0.3, -0.9]], [1.2, 260, [0.7, -0.2, 0.1]]].entries()) {
    const s = await shot(dt, yaw, light);
    ok(s.gpuSkin && s.cpuSkin && s.gStatus === 'gpu' && s.cStatus === 'cpu', `shot ${i}: one body on each skin (${s.gStatus} / ${s.cStatus})`);
    // the fixture is a pair of boxy limbs: two faces of it turn to the light at once, so two shades is a lit body -
    // and enough to see a face normal from the wrong side (the sign mutant reads a max difference of 132)
    ok(s.covC > 200 && s.shades >= 2, `shot ${i}: the CPU picture is a lit body (${s.covC} texels, ${s.shades} shades)`);
    ok(s.cover <= Math.max(4, s.covC * 0.01), `shot ${i}: the GPU skin covers the same texels (${s.cover} of ${s.covC} differ)`);
    ok(s.maxd <= 6 && s.meand < 0.5, `shot ${i}: and lights them alike - the face normal off the derivatives (max ${s.maxd}, mean ${s.meand.toFixed(3)})`);
  }
  ok(crashes.length === 0, `no page errors (${crashes.join(' | ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nMWNPC1 PROBE: ${fails.length} FAILED` : '\nMWNPC1 PROBE: ALL GREEN');
process.exit(fails.length ? 1 : 0);
