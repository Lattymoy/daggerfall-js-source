// PERF-CROWD (2026-10-10, Dudey: "big problems are caused by many players causing severe stutter" - with ~500 online):
// THE PEER LAB - the layers that draw other players, under a crowd, in a minute and without the relay.
//
// tools/onlineFrameProbe.mjs measures the whole online frame and boots the real game first (a quarter of an hour on
// SwiftShader). This stands only the layers that scale with the players round you - RemotePlayers (the class sprites,
// the dolls, the steps' and swings' sounds), the walkers in Eye Of The Beholder's sets (net/peer/peerRiders.js), the name
// layer (ui/nameLayer.js) - over the REAL renderer, the REAL data pipeline over the player's ARENA2 (/play/arena2/, the
// dev server's door), the REAL audio engine, and drives them with N peers who ARRIVE TOGETHER (a welcome's roster)
// while the camera turns, then walk about. It reports, a frame at a time:
//   - each layer's JavaScript inside the frame (sync, names, the billboard draw),
//   - the time BETWEEN frames that is not the browser idling: the microtasks and tasks the frame's own asks set off
//     (a doll's compose, a sprite's decode and upload) - which is where an arrival's hitch lands,
//   - the long tasks the browser saw (PerformanceObserver 'longtask').
// A stall is the worst of these. SwiftShader's GPU is not measured: the canvas is small and the lane off.
//
// Usage: node tools/peerLab.mjs [peers=40] [frames=240]
//   LOOKS=mixed|same   every peer a different race/class/set (default), or one look for all
//   EOTB=0.5           the share of peers wearing an Eye Of The Beholder set (the rest the class sprite)
//   SPRITES=1          'Other players: animated sprite' (0: the paperdoll for everyone)
//   OUT=file.json      the per-frame rows
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PEERS = Number(process.argv[2] || 40);
const FRAMES = Number(process.argv[3] || 240);
const PORT = Number(process.env.PORT || 5295);
const LOOKS = process.env.LOOKS || 'mixed';
const EOTB = Number(process.env.EOTB ?? 0.5);
const SPRITES = process.env.SPRITES !== '0';
const NAMES = process.env.NAMES !== '0';
const CHURN = Number(process.env.CHURN || 0);   // CHURN=n: n waves of NEW peers (new ids) arrive and leave; what each wave leaves behind is printed   // NAMES=0: the name layer left out (its DOM's share, by difference)

const server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', ...(process.env.JSFLAGS ? [`--js-flags=${process.env.JSFLAGS}`] : [])] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });
// a blank page under /play/, so the data door's relative './arena2/' is the dev server's
await page.route('**/play/peer-lab.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body style="margin:0;background:#000"></body></html>' }));
await page.goto(`http://localhost:${PORT}/play/peer-lab.html`);
// PROFILE=1: a CPU profile over the whole run, its self time by function printed (the arrival's stalls attributed)
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const m0 = await metrics();
if (process.env.TRACE) await page.context().tracing?.start?.({ screenshots: false, snapshots: false }).catch(() => {});
if (process.env.TRACE) await browser.startTracing(page, { path: process.env.TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink', 'gpu', 'cc'] });
if (process.env.HEAP) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
if (process.env.PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start'); }

const out = await page.evaluate(async ({ PEERS, FRAMES, LOOKS, EOTB, SPRITES, NAMES, CHURN }) => {
  const longTasks = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push({ at: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch { /* none */ }
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { perspective, lookAt, mirrorProjectionX } = await import('/src/world/mat4.js');
  const { DFPalette } = await import('/src/formats/dfPalette.js');
  const { getBytes } = await import('/src/scenes/dataSource.js');
  const { createDataPipeline } = await import('/src/scenes/dataPipeline.js');
  const { RemotePlayers } = await import('/src/net/remotePlayers.js');
  const { createEotbArt, createPeerWalkers } = await import('/src/net/peer/peerRiders.js');
  const { createNameLayer } = await import('/src/ui/nameLayer.js');
  const { audio } = await import('/src/systems/audio.js');
  const { setPref } = await import('/src/systems/uiPrefs.js');
  setPref('peerClassSprites', SPRITES);
  { const live = window.__glLive = { tex: 0, buf: 0, vao: 0 }; const P = WebGL2RenderingContext.prototype;
    const wrap = (c, d, k) => { const oc = P[c], od = P[d]; P[c] = function (...a) { live[k]++; return oc.apply(this, a); }; P[d] = function (...a) { if (a[0]) live[k]--; return od.apply(this, a); }; };
    wrap('createTexture', 'deleteTexture', 'tex'); wrap('createBuffer', 'deleteBuffer', 'buf'); wrap('createVertexArray', 'deleteVertexArray', 'vao'); }
  const W = 320, H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  document.body.appendChild(canvas);
  const renderer = new Renderer(canvas);
  const palette = new DFPalette();
  palette.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const pipeline = createDataPipeline({ renderer, arch: { getRecordIndex: () => -1, getMesh: () => null }, palette, fetch: getBytes });
  await audio.ensure(getBytes);
  try { await audio.ctx?.resume?.(); } catch { /* headless */ }
  const deps = { fetchBytes: getBytes, palette, getTexture: pipeline.getTexture, uploadRecordFrame: pipeline.uploadRecordFrame, audio };
  const rp = new RemotePlayers({ renderer, deps });
  const art = createEotbArt({ renderer });
  const walkers = createPeerWalkers({ renderer, art, enabled: () => SPRITES });
  const names = createNameLayer({ doc: document });

  const RACES = ['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf', 'WoodElf', 'Khajiit', 'Argonian'];
  const CLASSES = ['Warrior', 'Mage', 'Thief', 'Knight', 'Archer', 'Rogue', 'Battlemage', 'Spellsword', 'Healer', 'Nightblade', 'Bard', 'Burglar', 'Ranger', 'Barbarian', 'Monk', 'Assassin', 'Acrobat', 'Sorcerer'];
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const peers = Array.from({ length: PEERS }, (_, i) => {
    const same = LOOKS === 'same';
    const look = { race: same ? 'Nord' : RACES[i % RACES.length], gender: same || i % 3 ? 'male' : 'female', faceIndex: same ? 0 : (i * 7) % 10, class: same ? 'Warrior' : CLASSES[(i * 5) % CLASSES.length], items: [] };
    if (rnd() < EOTB) look.eo = same ? 0 : i % 5;
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * 24;
    return { id: `peer${i}`, name: `Player ${i}`, lv: 1 + (i % 40), told: true, look, cx: Math.cos(a) * r, cz: Math.sin(a) * r, ph: rnd() * 6.28, sp: 0.4 + rnd() * 0.6, walking: rnd() < 0.7,
      shown: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, an: 0, fk: 0, wd: 1 } };
  });
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.1, 500));
  const camRight = new Float32Array(3), camUp = new Float32Array([0, 1, 0]);
  const rows = [];
  const counters = { composes: 0, uploads: 0, sounds: 0 };
  const realCompose = rp._compose; rp._compose = async (...a) => { counters.composes++; return realCompose(...a); };
  const realUpload = renderer.uploadTexture.bind(renderer); renderer.uploadTexture = (...a) => { counters.uploads++; return realUpload(...a); };
  const real3d = audio.play3d.bind(audio); audio.play3d = (...a) => { counters.sounds++; return real3d(...a); };
  let t = 0, arrived = false, lastEnd = performance.now();
  return await new Promise((resolve) => {
    const tick = () => {
      const start = performance.now();
      const between = start - lastEnd;   // the frame's asks' async tails, and the browser's own work, since the last frame
      const f = rows.length;
      const dt = 1 / 60; t += dt;
      if (f === 10) arrived = true;
      // CHURN: every 60 frames a wave - frames 0-39 of it with the crowd (new ids each wave), 40-59 empty
      let list = arrived ? peers : [];
      if (CHURN) {
        const wave = Math.floor(f / 60), inWave = f % 60;
        if (wave !== window.__wave) { window.__wave = wave; for (const p of peers) p.id = `w${wave}-${p.id.replace(/^w\d+-/, '')}`; }
        list = wave < CHURN && inWave < 40 ? peers : [];
        if (inWave === 59) (window.__leftover ??= []).push({ wave, dom: document.getElementsByTagName('*').length, textures: renderer.textures.size, batches: rp._batches.size + walkers.batches().length,
          dolls: rp._dolls.size, mobiles: rp._mobiles.size, footsteps: rp._footsteps.size, attackAn: rp._attackAn.size, riding: rp._riding.size, climb: rp._climbSounds.peers.size, names: names.tagCount(),
          heap: performance.memory?.usedJSHeapSize ?? 0, glTex: window.__glLive?.tex ?? null, glBuf: window.__glLive?.buf ?? null });
      }
      for (const p of list) {
        const a = p.ph + (p.walking ? t * p.sp : 0);
        p.shown.x = p.cx + Math.cos(a) * 2; p.shown.z = p.cz + Math.sin(a) * 2; p.shown.yaw = a + Math.PI / 2; p.shown.mv = p.walking ? 1 : 0;
        if (rnd() < 0.01) p.shown.an++;   // a swing now and then
      }
      const yaw = t * 1.2;   // the camera turns, so the crowd shows every face
      const eye = [0, 1.7, 0];
      const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
      camRight[0] = Math.cos(yaw); camRight[1] = 0; camRight[2] = -Math.sin(yaw);
      const view = lookAt(eye, [eye[0] + fwd[0], 1.6, eye[2] + fwd[2]], [0, 1, 0]);
      audio.setListener?.(eye, fwd);
      const toScene = (s) => [s.x, s.y, s.z];
      const c0 = { ...counters };
      const t0 = performance.now();
      walkers.sync(list, toScene, { eye, right: [camRight[0], 0, camRight[2]], dt });
      const t1 = performance.now();
      rp.sync(list, toScene, { bodyHeight: (id) => walkers.heightOf(id), dt, eye });
      const t2 = performance.now();
      renderer.beginFrame(proj, view, new Float32Array([0.3, 0.8, 0.5]), WORLD_FRAME);
      renderer.drawBillboards([...rp.batches(), ...walkers.batches()], camRight, camUp);
      const t3 = performance.now();
      if (NAMES) rp.nameFrame({ proj, view, w: 960, h: 540, eye, toScene, layer: names, viewport: 540 });
      const t4 = performance.now();
      renderer.resolveFrame?.();
      lastEnd = performance.now();
      rows.push({ f, between, walkers: t1 - t0, remote: t2 - t1, draw: t3 - t2, names: t4 - t3, total: lastEnd - start,
        composes: counters.composes - c0.composes, uploads: counters.uploads - c0.uploads, sounds: counters.sounds - c0.sounds });
      if (rows.length < FRAMES) requestAnimationFrame(tick);
      else setTimeout(() => resolve({ leftover: window.__leftover ?? null, rows, longTasks, counters, dom: document.getElementsByTagName('*').length, dolls: rp._dolls.size, batches: rp._batches.size + walkers.batches().length }), 50);
    };
    requestAnimationFrame(tick);
  });
}, { PEERS, FRAMES, LOOKS, EOTB, SPRITES, NAMES, CHURN });

const rows = out.rows;
if (process.env.TRACE) {
  await browser.stopTracing();
  const { readFileSync: rf } = await import('node:fs');
  const tr = JSON.parse(rf(process.env.TRACE, 'utf8'));
  const ev = tr.traceEvents ?? tr;
  const main = ev.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const by = new Map();
  for (const e of ev) if (e.ph === 'X' && main && e.pid === main.pid && e.tid === main.tid && e.dur) by.set(e.name, (by.get(e.name) ?? 0) + e.dur / 1000);
  console.log('  main thread (trace, ms, inclusive):', [...by].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | '));
}
const m1 = await metrics();
console.log(`  browser: recalc style ${((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(0)} ms (${m1.RecalcStyleCount - m0.RecalcStyleCount}x), layout ${((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(0)} ms (${m1.LayoutCount - m0.LayoutCount}x), script ${((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0)} ms, task ${((m1.TaskDuration - m0.TaskDuration) * 1000).toFixed(0)} ms, js heap ${(m1.JSHeapUsedSize / 1e6).toFixed(1)} MB`);
if (process.env.HEAP) {
  const { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
  const self = new Map();
  const walk = (n) => { const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${(cf.url || '').replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + n.selfSize); for (const c of n.children || []) walk(c); };
  walk(heap.head);
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(`  allocated over the run: ${(total / 1e6).toFixed(1)} MB; top:`);
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    ${(v / 1e6).toFixed(2).padStart(8)} MB  ${k}`);
}
if (process.env.PROFILE) {
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dts = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]); const cf = n.callFrame;
    const k = `${cf.functionName || '(anon)'} ${(cf.url || '').replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${cf.lineNumber + 1}`;
    self.set(k, (self.get(k) || 0) + (dts[i + 1] ?? 0) / 1000);
  }
  console.log('  cpu self (ms over the run):');
  for (const [k, v] of [...self].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.PROFILE) > 1 ? Number(process.env.PROFILE) : 25)) console.log(`    ${v.toFixed(1).padStart(8)}  ${k}`);
  if (process.env.CPUPROFILE) writeFileSync(process.env.CPUPROFILE, JSON.stringify(profile));
}
const stat = (k, from = 0, to = rows.length) => { const v = rows.slice(from, to).map((r) => r[k]).sort((a, b) => a - b); return { mean: v.reduce((a, b) => a + b, 0) / v.length, p95: v[Math.floor(v.length * 0.95)], max: v[v.length - 1] }; };
const fmt = (s) => `mean ${s.mean.toFixed(2)} p95 ${s.p95.toFixed(2)} max ${s.max.toFixed(1)}`;
console.log(`peerLab ${PEERS} peers, ${FRAMES} frames, looks ${LOOKS}, eotb ${EOTB}, sprites ${SPRITES}`);
for (const k of ['walkers', 'remote', 'draw', 'names', 'total']) console.log(`  ${k.padEnd(8)} arrival(10-70) ${fmt(stat(k, 10, 70))} | steady(${Math.min(120, rows.length - 1)}-) ${fmt(stat(k, Math.min(120, rows.length - 1)))}`);
const worstBetween = [...rows].sort((a, b) => b.between - a.between).slice(0, 5).map((r) => `f${r.f}:${r.between.toFixed(0)}ms`);
console.log(`  between frames: worst ${worstBetween.join(' ')}`);
console.log(`  long tasks: ${out.longTasks.length}, total ${out.longTasks.reduce((a, b) => a + b.ms, 0).toFixed(0)} ms, worst ${Math.max(0, ...out.longTasks.map((l) => l.ms)).toFixed(0)} ms`);
console.log(`  composes ${out.counters.composes}, uploads ${out.counters.uploads}, 3d sounds ${out.counters.sounds}, dolls ${out.dolls}, batches ${out.batches}, dom ${out.dom}`);
if (out.leftover) for (const l of out.leftover) console.log(`  after wave ${l.wave}: dom ${l.dom}, textures ${l.textures}, batches ${l.batches}, dolls ${l.dolls}, mobiles ${l.mobiles}, footsteps ${l.footsteps}, swings ${l.attackAn}, rides ${l.riding}, climbs ${l.climb}, names ${l.names}, gl tex/buf live ${l.glTex}/${l.glBuf}, heap ${(l.heap / 1e6).toFixed(1)} MB`);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));
if (errors.length) console.log('errors:', errors.slice(0, 6).join('\n  '));
// the lab judges its run (test/tooling/probehygiene.test.js T3): a page that threw, or no frame measured, is no measure
if (errors.length || !rows.length || !rows.every((r) => Number.isFinite(r.total))) process.exitCode = 1;
await browser.close(); await server.close();
