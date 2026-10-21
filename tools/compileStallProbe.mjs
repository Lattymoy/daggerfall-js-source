// SHADER-STALL (2026-10-20, a player via the owner: "the load problem is a bunch if fucking shaders ive stripped out like 5
// diffrent shader and i dont lag oon load up" - "Gate shader initialization: 11.43-second stall", "Node-outline shader
// initialization: 5.65-second stall"): WHERE THE MAIN THREAD WAITS ON THE DRIVER, IN THE REAL GAME. A program's build
// asks the driver whether it linked (render/glProgram.js buildProgram), and that question is a round trip that waits
// until the GPU process has compiled and linked it - and everything queued ahead of it. This boots a scene over the
// freeware ARENA2 with every such question timed where the page asks it (`getProgramParameter`'s LINK_STATUS and
// COMPLETION_STATUS_KHR, and each program's first `getUniformLocation`), each named by the pass whose build asked it (the
// first frame of its stack outside glProgram.js), and splits them at the first world frame - a wait before it is the
// loading screen's, a wait after it a frame the player saw freeze.
//
// `passes` builds the passes a scene here never stands (a gate's fire, the court's telegraph and blows, the veil, the
// nodes' glint) each in a context of its own, as a host builds it: at once (`new`), and - where the tree has it - by
// SHADER-STALL's door (glProgram.js startPrograms: the compile started, the build made when the driver says it is done).
//
// The browser is the probes' SwiftShader, with ANGLE's parallel compile on (`enableParallelCompileAndLink`, what ANGLE
// runs on a GPU's D3D11, Metal and Vulkan - and so what exposes KHR_parallel_shader_compile to a player's Chromium);
// PARALLEL=0 runs without it, the browsers that cannot say when a compile is done. The waits are this machine's CPU
// compiling for SwiftShader, read as relative: the driver a player runs has its own compiler (D3D11's is the slow one).
//
// Run:  ARENA2_PATH=/path/to/arena2 node tools/compileStallProbe.mjs knight     (scenes: tools/frameProbe.mjs SCENES)
//       node tools/compileStallProbe.mjs passes
//   TREE=<dir> serve another worktree (an A/B's base);  SECONDS=60 after the first frame;  PARALLEL=0;  PORT=5245
//   PROFILE=<file>: the run under a CPU profile, and its long tasks after the first frame by their own time
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { SCENES, SWIFTSHADER_ARGS } from './frameProbe.mjs';
import { FIRST_FRAME_MARK, longTasks } from './bootFreezeProbe.mjs';
import { writeFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5245);
const SECONDS = Number(process.env.SECONDS || 60);
const PROFILE = process.env.PROFILE || null;   // a file: the run under a CPU profile, its long tasks after the first frame printed
const W = Number(process.env.W || 480), H = Number(process.env.H || 270);
export const PARALLEL_ARGS = ['--enable-angle-features=enableParallelCompileAndLink'];

/** Every question that waits on the driver for a program, timed and named. `__glWaits` holds
 *  `{ at, kind, ms, site }` - `at` the page's clock, `site` the pass that asked. */
export const GL_WAITS = `(() => {
  const P = WebGL2RenderingContext.prototype;
  const waits = window.__glWaits = [];
  const asked = new WeakSet();
  const siteOf = () => {
    const at = [];
    for (const l of String(new Error().stack).split('\\n').slice(3)) {
      const m = l.match(/at (?:new )?([^ ]+) \\(.*?\\/(src\\/[^?:)]+)[^:)]*:(\\d+)/) || l.match(/at .*?\\/(src\\/[^?:)]+)[^:)]*:(\\d+)/);
      if (!m) continue;
      const [fn, file, line] = m.length === 4 ? [m[1], m[2], m[3]] : ['(anon)', m[1], m[2]];
      if (/glProgram\\.js$/.test(file)) continue;
      at.push(fn + ' ' + file + ':' + line);
      if (at.length === 2) break;   // the pass's own frame, and who asked it - a renderer's _buildProgram names its caller
    }
    return at.join(' < ') || '?';
  };
  const timed = (name, asks) => {
    const f = P[name];
    P[name] = function (...a) {
      if (!asks(this, a)) return f.apply(this, a);
      const t = performance.now();
      const r = f.apply(this, a);
      waits.push({ at: t, kind: name === 'getProgramParameter' ? (a[1] === this.LINK_STATUS ? 'link' : 'done?') : 'uniforms', ms: performance.now() - t, site: siteOf() });
      return r;
    };
  };
  timed('getProgramParameter', (gl, a) => a[1] === gl.LINK_STATUS || a[1] === 0x91B1);
  timed('getUniformLocation', (gl, a) => { if (asked.has(a[0])) return false; asked.add(a[0]); return true; });
})();`;

/** The waits summed by site and kind, split at the first world frame (`firstAt`, the page's clock; null: all before). */
export function waitsBySite(waits, firstAt) {
  const rows = new Map();
  for (const w of waits) {
    const when = firstAt != null && w.at >= firstAt ? 'after' : 'before';
    const k = `${when}\t${w.kind}\t${w.site}`;
    const r = rows.get(k) ?? { when, kind: w.kind, site: w.site, n: 0, ms: 0, worst: 0 };
    r.n++; r.ms += w.ms; r.worst = Math.max(r.worst, w.ms);
    rows.set(k, r);
  }
  const all = [...rows.values()].sort((a, b) => b.ms - a.ms);
  const sum = (when) => all.filter((r) => r.when === when).reduce((s, r) => s + r.ms, 0);
  return { rows: all, beforeMs: sum('before'), afterMs: sum('after') };
}

async function runScene(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(FIRST_FRAME_MARK);
  await ctx.addInitScript(GL_WAITS);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = PROFILE ? await ctx.newCDPSession(page) : null;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}${SCENES[name]}`);
  await page.waitForFunction(() => (window.__frame | 0) > 0, null, { timeout: 1200000, polling: 250 });
  console.log(`  [${name}] first world frame after ${((Date.now() - t0) / 1000).toFixed(0)}s; ${SECONDS}s more`);
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  const got = await page.evaluate(() => ({ waits: window.__glWaits, first: window.__bootFreezeFrames[0] ?? null, frames: window.__frame | 0,
    ext: !!document.createElement('canvas').getContext('webgl2')?.getExtension('KHR_parallel_shader_compile') }));
  const profile = cdp ? (await cdp.send('Profiler.stop')).profile : null;
  if (profile) writeFileSync(PROFILE, JSON.stringify(profile));
  await ctx.close();
  return { name, errors, ...got, ...waitsBySite(got.waits, got.first), tasks: profile ? longTasks(profile).long.filter((k) => k.fromFirstMs >= 0) : null };
}

/** The passes no scene here stands, built in a context each: at once, and by the started door where the tree has it. */
const PASSES = `async (started) => {
  const { startPrograms } = await import('/src/render/glProgram.js');
  if (started && !startPrograms) return { none: 'this tree has no startPrograms' };
  const out = {};
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const build = async (name, programsOf, make) => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const from = window.__glWaits.length, t = performance.now();
    let frames = 0;
    if (started) { const ready = startPrograms(gl, programsOf()); while (!ready()) { frames++; await frame(); } }
    make(gl);
    const waits = window.__glWaits.slice(from);
    out[name] = { waitMs: +waits.reduce((s, w) => s + w.ms, 0).toFixed(1), worstMs: +Math.max(0, ...waits.map((w) => w.ms)).toFixed(1), frames, wallMs: +(performance.now() - t).toFixed(0) };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  const gp = await import('/src/render/gate/gatePass.js'), gm = await import('/src/world/gate/gateModel.js');
  const gt = await import('/src/render/gate/gateTelegraph.js'), gf = await import('/src/render/gate/gateFx.js');
  const gv = await import('/src/render/gate/gateVeil.js'), no = await import('/src/render/nodeGlint.js');
  const profile = gm.gateArchProfile(gm.buildGateModel());
  await build('gate fire', () => gp.GATE_PASS_PROGRAMS, (gl) => new gp.GatePassRenderer(gl, profile));
  await build('gate telegraph', () => gt.telegraphPrograms(false), (gl) => new gt.GateTelegraphRenderer(gl));
  await build('spire telegraph', () => gt.telegraphPrograms(true), (gl) => new gt.GateTelegraphRenderer(gl, { spire: true }));
  await build('gate blows', () => gf.GATE_FX_PROGRAMS, (gl) => new gf.GateFxRenderer(gl));
  await build('gate veil', () => gv.GATE_VEIL_PROGRAMS, (gl) => new gv.GateVeilRenderer(gl));
  await build('node glint', () => no.NODE_GLINT_PROGRAMS, (gl) => new no.NodeGlintRenderer(gl));
  return out;
}`;

async function runPasses(browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(GL_WAITS);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/src/render/glProgram.js`);
  const r = {};
  for (const started of [false, true]) r[started ? 'started' : 'new'] = await page.evaluate(`(${PASSES})(${started})`);
  r.ext = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2')?.getExtension('KHR_parallel_shader_compile'));
  await ctx.close();
  return r;
}

if (isMain(import.meta.url)) {
  const names = process.argv.slice(2);
  if (!names.length || names.some((n) => n !== 'passes' && !SCENES[n])) throw new Error(`compileStallProbe: name passes, or scenes of ${Object.keys(SCENES).join(', ')}`);
  const server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ args: [...SWIFTSHADER_ARGS, ...(process.env.PARALLEL === '0' ? [] : PARALLEL_ARGS)] });
  const failed = [];
  try {
    for (const name of names) {
      if (name === 'passes') {
        const r = await runPasses(browser);
        console.log(`== passes (KHR_parallel_shader_compile ${r.ext ? 'on' : 'off'})`);
        for (const [arm, rows] of Object.entries(r)) {
          if (arm === 'ext') continue;
          if (rows.none) { console.log(`  ${arm}: ${rows.none}`); continue; }
          for (const [pass, x] of Object.entries(rows)) console.log(`  ${arm.padEnd(7)} ${pass.padEnd(16)} the main thread waited ${String(x.waitMs).padStart(8)} ms (worst ${x.worstMs}), ${x.frames} frames polled, ${x.wallMs} ms to built`);
        }
        continue;
      }
      const r = await runScene(browser, name);
      console.log(`== ${name} (KHR_parallel_shader_compile ${r.ext ? 'on' : 'off'}): ${r.frames} frames; the main thread waited on programs ${r.beforeMs.toFixed(0)} ms before the first world frame, ${r.afterMs.toFixed(0)} ms after; errors ${r.errors.length}`);
      for (const k of r.tasks ?? []) console.log(`  task ${k.fromFirstMs} ms after the first frame: ${k.ms} ms - ${k.self.slice(0, 4).map(([f, ms]) => `${f} ${ms}`).join('; ')}`);
      for (const x of r.rows.filter((x) => x.ms >= 5)) console.log(`  ${x.when.padEnd(6)} ${x.kind.padEnd(8)} ${x.ms.toFixed(0).padStart(7)} ms in ${String(x.n).padStart(3)} (worst ${x.worst.toFixed(0)})  ${x.site}`);
      // a run is a measurement when the first world frame was seen and the page threw nothing
      const why = r.first == null ? 'no world frame' : r.errors[0] ?? null;
      if (why) failed.push(`${name} (${why})`);
    }
  } finally { await browser.close(); await server.close(); }
  if (failed.length) throw new Error(`compileStallProbe: no measurement for ${failed.join('; ')}`);
}
