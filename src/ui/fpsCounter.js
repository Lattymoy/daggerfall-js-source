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
// switch (ui prefs `showFps`, or ?fps) on every tick, so the Enhanced
// pane's row takes effect at once and costs nothing while off: the
// element is hidden and the loop only counts.
//
// The pure half (`fpsStats`) is executed by test/mwarms_fps.test.js;
// the DOM half runs against the same stub document AUDIT 62 built.

import { frameCpu } from '../systems/frameClock.js';   // PERF1: the hosts' script time

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
 * Mount the overlay. Returns { el, tick(now), dispose() }; the tick is
 * public so a test can drive it without a frame loop.
 * @param {{enabled: () => boolean, raf?: (fn) => number}} opts
 */
export function mountFpsCounter({ enabled = () => true, raf = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null), stats = null } = {}) {
  const el = document.createElement('div');
  el.id = 'fps-counter';
  el.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top, 0px));right:calc(8px + env(safe-area-inset-right, 0px));z-index:9;padding:4px 8px;border-radius:8px;'
    + 'font:600 13px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#e9e4d9;background:rgba(14,16,19,.65);pointer-events:none;'
    + '-webkit-user-select:none;user-select:none;white-space:pre;text-align:right;display:none';
  el.style.display = 'none';   // set on the property too: the cssText above is a string to a stub document
  document.body.appendChild(el);
  let stamps = [];
  let shown = false;
  let sumDraws = 0, sumBinds = 0, samples = 0;   // PERF3: the renderer's per-frame counts (beginFrame zeroes them), summed over the second
  let handle = 0;
  let live = true;
  function tick(now) {
    stamps.push(now);
    const st = stats?.();   // PERF3: one complete frame's counts, whichever side of the host's callback this tick fell
    if (st) { sumDraws += st.draws; sumBinds += st.texBinds; samples++; }
    const on = !!enabled();
    if (on !== shown) { shown = on; el.style.display = on ? 'block' : 'none'; }
    if (now - stamps[0] >= PERIOD_MS) {
      if (on) {
        const { fps, meanMs, worstMs } = fpsStats(stamps);
        const cpu = frameCpu();   // PERF1: null until a host has stamped a frame (the menu has none)
        // PERF3: the renderer's draws and texture binds, averaged per frame
        // over the second - the GL call count is the CPU side of the GPU's
        // work, and the number the culls and the sort are meant to move.
        const gpu = samples ? `\ndraws ${Math.round(sumDraws / samples)}  binds ${Math.round(sumBinds / samples)}` : '';
        el.textContent = `${fps} fps\n${meanMs.toFixed(1)} ms  worst ${worstMs.toFixed(0)}`
          + (cpu ? `\nscript ${cpu.meanMs.toFixed(1)} ms  worst ${cpu.worstMs.toFixed(0)}` : '') + gpu;
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
