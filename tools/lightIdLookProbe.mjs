// LIGHT-ID (2026-10-14, Mac: "Engine fix (Recommended)" - bible/07-Rendering/Enhanced-Lighting-Arc.md LIGHT-ID): THE LOOK,
// ON A REAL GL. The court's whole frame - its own mesh, art, lights and fog on the enhanced lane, his glow walking among
// ten Eye Of The Beholder walkers, then a five-mark Hellfire's flashes - drawn twice in Chromium (SwiftShader), with
// LIGHT-ID's two laws off (render/shadowPass.js SHADOW_TUNING `moverDirect`, `loUnread`: a moved light through its
// static cache, a lo map for every light that may cast) and on, each frame read back whole and compared byte for byte,
// with the shadow pass's counts beside it. Judged: not one channel value apart, in any frame.
//
// Usage: node tools/lightIdLookProbe.mjs [frames=14]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const W = 480, H = 270, PORT = Number(process.env.PORT || 5264), FRAMES = Number(process.argv[2] ?? 14);
const server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[probe]')) console.log(t); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
try {
  await page.goto(`http://localhost:${PORT}/mw-inspect.html`);
  const out = await page.evaluate(async ({ W, H, FRAMES }) => {
    const [{ Renderer, WORLD_FRAME }, m, el, ga, gart, gb, gboss, gfx, pr, dl, sp] = await Promise.all([
      import('/src/render/renderer.js'), import('/src/world/mat4.js'), import('/src/render/enhancedLighting.js'), import('/src/world/gate/gateArena.js'),
      import('/src/world/gate/gateArt.js'), import('/src/net/gate/gateBrain.js'), import('/src/world/gate/gateBoss.js'), import('/src/render/gate/gateFx.js'),
      import('/src/net/peer/peerRiders.js'), import('/src/render/deadlands.js'), import('/src/render/shadowPass.js'),
    ]);
    const C = gb.COURT_CENTRE;
    const lens = m.mirrorProjectionX(m.perspective(60 * Math.PI / 180, W / H, 0.05, 500));
    const cam = { eye: [C[0], C[1] + 2.6, C[2] + 11.5], at: [C[0], C[1] + 1.6, C[2]] };
    cam.view = m.lookAt(cam.eye, cam.at, [0, 1, 0]);
    const cl = dl.courtLighting(null);
    const runArm = async (arm, scen) => {
      sp.SHADOW_TUNING.moverDirect = arm === 'now'; sp.SHADOW_TUNING.loUnread = arm === 'now';
      const cv = document.createElement('canvas');
      cv.style.width = `${W}px`; cv.style.height = `${H}px`; cv.width = W; cv.height = H;
      document.body.innerHTML = ''; document.body.append(cv);
      const r = new Renderer(cv);
      const gl = r.gl;
      r.setLightingLane(el.EL_LANE);
      for (const [rec, art] of gart.courtArt()) { r.uploadTexture(ga.COURT_ARCHIVE, rec, art.albedo); r.uploadEmissionTexture?.(ga.COURT_ARCHIVE, rec, art.emission, { white: true }); }
      const court = r.createMesh(ga.buildCourtModel());
      const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const walkers = pr.createPeerWalkers({ renderer: r });
      const N = 10;
      const peerAt = (i, t) => { const a = i * 0.6 + t * 0.4, d = 3 + (i % 4); return [C[0] + Math.cos(a) * d, C[1], C[2] + Math.sin(a) * d]; };
      const peers = Array.from({ length: N }, (_, i) => ({ id: `p${i}`, look: { eo: i % 4 }, shown: { x: 0, y: 0, z: 0, yw: 0, mv: 1, wd: 0, an: 0, ar: 0, cn: 0 } }));
      const place = (t) => peers.forEach((p, i) => { const q = peerAt(i, t); p.shown.x = q[0]; p.shown.y = q[1]; p.shown.z = q[2]; p.shown.yw = i * 0.5 + t; });
      const toScene = (p) => [p.x, p.y, p.z];
      for (let k = 0; k < 400; k++) { place(0); walkers.sync(peers, toScene, { eye: cam.eye, right: [1, 0, 0], dt: 0 }); if (peers.every((p) => walkers.isWalking(p.id))) break; await new Promise((res) => setTimeout(res, 25)); }
      const glow = { x: 0, y: 0, z: 0, range: 0, color: [1.2, 0.5, 0.15] };
      const flashes = [[4, 4], [8, 6], [-6, 5], [3, 8], [-5, -4]].map(([x, z]) => { const p = ga.courtToDungeon(x, gboss.LANDING_LIGHT_Y, z); return { x: p[0], y: p[1], z: p[2], range: gfx.FX_KINDS.hellfire.light[1], color: [1.2, 0.6, 0.2] }; });
      const frames = [];
      for (let k = -3; k < FRAMES; k++) {
        const s = scen(k);
        const fog = el.dungeonFog(true, ga.COURT_FOG);
        r.setLighting(new Float32Array(cl.tri.equator), 0, undefined, cl.tri);
        r.setMoonlight?.(cl.key);
        const g = ga.courtToDungeon(s.boss[0], 3.5, s.boss[1]);
        glow.x = g[0]; glow.y = g[1]; glow.z = g[2]; glow.range = gboss.GLOW_RANGE.ember;
        const lit = ga.withCourtLights({ data: new Float32Array(0), colors: new Float32Array(0) }, [glow, ...(s.flashes ? flashes : []), ...ga.courtLightsNear(cam.eye)]);
        r.setPointLights(lit.data, null, lit.colors);
        if (fog) r.setFog(fog.mode, fog.density, fog.start ?? 0, fog.end ?? 0, new Float32Array(fog.color));
        r.setClearColor([0.05, 0.01, 0.01, 1]);
        r.everyLightCasts();
        r.beginFrame(lens, cam.view, new Float32Array([0.2, -0.9, 0.3]), WORLD_FRAME);
        const st = { ...r.shadows.stats };
        r.drawMesh(court, I, null);
        place(Math.max(0, k) / 60); walkers.sync(peers, toScene, { eye: cam.eye, right: [1, 0, 0], dt: 1 / 60 }); const bb = walkers.batches(); if (bb.length) r.drawBillboards(bb, [1, 0, 0], [0, 1, 0]);
        r.resolveFrame?.();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (k >= 0) frames.push({ px, st });
      }
      walkers.destroy?.();
      r.destroy?.();
      return frames;
    };
    const scen = {
      walkCrowd: (k) => ({ boss: [Math.cos(Math.max(0, k) / 8) * 5, Math.sin(Math.max(0, k) / 8) * 5], flashes: false }),
      hellfire: (k) => ({ boss: [Math.cos(Math.max(0, k) / 8) * 5, Math.sin(Math.max(0, k) / 8) * 5], flashes: k >= 2 && k < 10 }),
    };
    const res = {};
    for (const [name, fn] of Object.entries(scen)) {
      const a = await runArm('before', fn), b = await runArm('now', fn);
      const diffs = a.map((fa, i) => { const fb = b[i]; let n = 0, maxd = 0; for (let j = 0; j < fa.px.length; j++) { const d = Math.abs(fa.px[j] - fb.px[j]); if (d) { n++; if (d > maxd) maxd = d; } } return { n, maxd, before: [fa.st.facesDrawn, fa.st.loFaces, fa.st.blits], now: [fb.st.facesDrawn, fb.st.loFaces, fb.st.blits, fb.st.moverFaces] }; });
      res[name] = diffs;
      console.log(`[probe] ${name} done`);
    }
    return res;
  }, { W, H, FRAMES });
  for (const [name, d] of Object.entries(out)) {
    console.log(name);
    d.forEach((x, i) => console.log(`  frame ${i}: ${x.n} channel values apart (max ${x.maxd}); before faces/lo/blits ${x.before.join('/')}  now faces/lo/blits/moved ${x.now.join('/')}`));
  }
  const apart = Object.values(out).flat().filter((x) => x.n > 0).length;
  console.log(apart ? `FAIL ${apart} frames apart` : 'ok   every frame byte for byte the same');
  process.exitCode = apart ? 1 : 0;
} finally {
  await browser.close();
  await server.close();
}
