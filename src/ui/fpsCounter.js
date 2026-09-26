// FPS1 - THE FPS COUNTER (2026-09-11, RookieG via Mac: "we need an
// ingame fps counter"; the same report said "the outside still has
// optimization issues", and a number is the first thing that work
// needs). A DOM overlay over the canvas, driven by its own
// requestAnimationFrame so it measures the browser's frame cadence and
// not any one host's loop - every host, every skin, the menu too.
//
// What it shows, once a second: the frames the last second held, the
// mean frame in milliseconds, and the WORST frame of that second - a
// steady 60 with a 90 ms worst is the stutter a mean hides. PERF1 adds
// the SCRIPT line under it (systems/frameClock.js, stamped by the
// hosts): the main thread's share of the frame, so a slow frame can be
// read as the GPU's or ours.
// switch (ui prefs `showFps`, or ?fps) on every tick, so the row in
// Settings > Interface takes effect at once and costs nothing while off:
// the element is hidden and the loop only counts.
//
// PERF-SCALE (2026-09-25, two players via Mac: "fps issues in the
// exterior but fine in the interior ... GPU is NVIDIA GeForce RTX 4060
// Ti", "me too ... I got a RX6600"): TWO MORE LINES, so one screenshot of
// the counter answers the two questions such a report opens with -
// WHICH GPU the browser draws on (the renderer reads it once at
// creation, Renderer.gpuName; a laptop on its integrated chip or a
// software rasterizer shows here) and HOW MANY PIXELS the world costs
// (the world image, the canvas, devicePixelRatio and the render scale,
// Renderer.frameInfo). Read once a second and only while the overlay
// shows; __fpsStats adds them when a probe asks, so hidden they cost
// nothing (`sizeLine` is the pure half).
//
// The pure half (`fpsStats`) is executed by test/mwarms_fps.test.js;
// the DOM half runs against the same stub document AUDIT 62 built.

import { frameCpu } from '../systems/frameClock.js';   // PERF1: the hosts' script time
import { frameCapSkip } from '../systems/frameCap.js';   // FPS-CAP1: the frames the cap held back are not counted

const PERIOD_MS = 1000;

/**
 * The second's numbers from its frame stamps.
 * @param {number[]} stamps frame times in ms, ascending, the second's own
 * @returns {{fps:number, meanMs:number, worstMs:number}}
 */
export function fpsStats(stamps) {
  const n = stamps.length;
  if (n < 2) return { fps: n, meanMs: 0, worstMs: 0 };
  let worst = 0;
  for (let i = 1; i < n; i++) worst = Math.max(worst, stamps[i] - stamps[i - 1]);
  const span = stamps[n - 1] - stamps[0];
  return { fps: Math.round(((n - 1) * 1000) / span), meanMs: span / (n - 1), worstMs: worst };
}

/**
 * PERF-SCALE: the size line - the world image, the canvas, the page's
 * devicePixelRatio and the scale ("retro" when Retro Picture Mode draws
 * the world instead). Null without an answer.
 * @param {{world?: number[], canvas?: number[], dpr?: number, scale?: number, retro?: boolean}|null} i
 */
export function sizeLine(i) {
  if (!i || !i.world || !i.canvas) return null;
  const dpr = Math.round((Number(i.dpr) || 1) * 100) / 100;
  return `world ${i.world[0]}x${i.world[1]}  canvas ${i.canvas[0]}x${i.canvas[1]}  dpr ${dpr}  scale ${i.retro ? 'retro' : `${Math.round((i.scale ?? 1) * 100)}%`}`;
}

/**
 * SCRIPT-SPLIT (2026-09-26, two players via Mac: "script 107.5 ms" of a
 * 104.3 ms frame on a GTX 1650, "script 203.6 ms" of 201.6 on an RTX 4090
 * Laptop - outdoors, every frame, both ANGLE Direct3D11): THE SCRIPT LINE'S
 * THREE PARTS, so one screenshot says whose milliseconds they are. The
 * script time is measured from the rAF's stamp, and Chrome stamps a frame
 * at the display's beat - so a main thread busy with anything else first
 * (the browser's own work for the last frame, a message, a timer, a
 * collection) is in it before the game's frame has run a line. `in frame`
 * is the game's own callback (a stall inside a GL call included), `before`
 * the time between the stamp and that callback, `stream` the world build's
 * slices lent to the frame (PERF-EXT24). Pure; null with no clock.
 * @param {{inFrameMs?: number, beforeMs?: number, streamMs?: number}|null} cpu
 */
export function scriptSplitLine(cpu) {
  if (!cpu || !Number.isFinite(cpu.inFrameMs)) return '';
  return `\nin frame ${cpu.inFrameMs.toFixed(1)}  before ${cpu.beforeMs.toFixed(1)}  stream ${cpu.streamMs.toFixed(1)}`;
}

/**
 * Mount the overlay. Returns { el, tick(now), dispose() }; the tick is
 * public so a test can drive it without a frame loop.
 * @param {{enabled: () => boolean, raf?: (fn) => number, stats?: () => any, info?: () => any}} opts
 * `info` (PERF-SCALE): the renderer's frameInfo - { gpu, world, canvas, dpr, scale, retro }.
 */
export function mountFpsCounter({ enabled = () => true, raf = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null), stats = null, info = null } = {}) {
  const el = document.createElement('div');
  el.id = 'fps-counter';
  // AUDIT BRANCH-0925 PS-A4: capped at the window less its margins, and a long line WRAPS inside it - a Windows ANGLE
  // GPU name made an unwrapped box 728px wide, off a phone's left edge, cutting off the start of the "gpu" line
  // (tools/fpsCounterProbe.mjs measures it in Chromium)
  el.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top, 0px));right:calc(8px + env(safe-area-inset-right, 0px));z-index:9;padding:4px 8px;border-radius:8px;'
    + 'max-width:calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));box-sizing:border-box;'
    + 'font:600 13px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#e9e4d9;background:rgba(14,16,19,.65);pointer-events:none;'
    + '-webkit-user-select:none;user-select:none;white-space:pre-wrap;overflow-wrap:anywhere;text-align:right;display:none';
  el.style.display = 'none';   // set on the property too: the cssText above is a string to a stub document
  document.body.appendChild(el);
  let stamps = [];
  let shown = false;
  let sumDraws = 0, sumBinds = 0, samples = 0;   // PERF3: the renderer's per-frame counts (beginFrame zeroes them), summed over the second
  let last = null;   // PERF9: the last second's numbers, for the probe
  // PERF-SCALE: the GPU and the frame's size ride the probe's read, asked for when it asks - never on a hidden tick
  const described = () => { const i = info?.(); return i ? { gpu: i.gpu ?? null, world: i.world ?? null, canvas: i.canvas ?? null, dpr: i.dpr ?? null, scale: i.scale ?? null, retro: !!i.retro } : null; };
  if (typeof globalThis.window !== 'undefined' && globalThis.window) globalThis.window.__fpsStats = () => (last && info ? { ...last, ...described() } : last);
  let handle = 0;
  let live = true;
  function tick(now) {
    // FPS-CAP1: a callback the Frame Rate Cap held back drew nothing, so it is not a frame. The host asked the same
    // question with the same stamp (one decision per stamp, systems/frameCap.js), so this counts what the game drew.
    if (frameCapSkip(now)) { if (live && raf) handle = raf(tick); return; }
    stamps.push(now);
    const st = stats?.();   // PERF3: one complete frame's counts, whichever side of the host's callback this tick fell
    if (st) { sumDraws += st.draws; sumBinds += st.texBinds; samples++; }
    const on = !!enabled();
    if (on !== shown) { shown = on; el.style.display = on ? 'block' : 'none'; }
    if (now - stamps[0] >= PERIOD_MS) {
      {   // PERF9: computed every second whether or not the overlay shows; written only while it does
        const { fps, meanMs, worstMs } = fpsStats(stamps);
        const cpu = frameCpu();   // PERF1: null until a host has stamped a frame (the menu has none)
        // PERF3: the renderer's draws and texture binds, averaged per frame
        // over the second - the GL call count is the CPU side of the GPU's
        // work, and the number the culls and the sort are meant to move.
        const gpu = samples ? `\ndraws ${Math.round(sumDraws / samples)}  binds ${Math.round(sumBinds / samples)}` : '';
        const i = on ? info?.() : null;   // PERF-SCALE: the GPU and the size, while shown
        const size = sizeLine(i);
        if (on) el.textContent = `${fps} fps\n${meanMs.toFixed(1)} ms  worst ${worstMs.toFixed(0)}`
          + (cpu ? `\nscript ${cpu.meanMs.toFixed(1)} ms  worst ${cpu.worstMs.toFixed(0)}` : '') + scriptSplitLine(cpu) + gpu
          + (i ? `\ngpu ${i.gpu ?? 'unknown'}` : '') + (size ? `\n${size}` : '');
        // PERF9: the same numbers for a probe (tools/perfProbe.mjs) - the
        // last second's, as an object, whether or not the overlay shows.
        last = { fps, meanMs, worstMs, scriptMs: cpu?.meanMs ?? null, scriptWorstMs: cpu?.worstMs ?? null, draws: samples ? sumDraws / samples : null, binds: samples ? sumBinds / samples : null,
          scriptInFrameMs: cpu?.inFrameMs ?? null, scriptBeforeMs: cpu?.beforeMs ?? null, scriptStreamMs: cpu?.streamMs ?? null };   // SCRIPT-SPLIT
      }
      stamps = [now];
      sumDraws = 0; sumBinds = 0; samples = 0;   // PERF3
    }
    if (live && raf) handle = raf(tick);
  }
  if (raf) handle = raf(tick);
  return {
    el,
    tick,
    dispose() { live = false; if (handle && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle); el.remove(); },
  };
}
