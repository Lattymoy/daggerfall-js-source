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
// PASS-COUNT (FIELD BUGS 2026-10-18, MADMAN0037: "The Mouse and Fawn tavern in Sentinel ... Gpu fans turn into jet
// turbines", over a counter that read 198 fps and "draws 67"): THE PASSES THE DRAW COUNT MISSED, AND THE PACE. The
// renderer's `draws` is the frame's own pass; a building's view out through its windows (the street, drawn first) and
// the shadow maps' replays were counted nowhere, so the screenshot said 67 draws over a frame that drew a city through
// the glass. `view` and `shadow` (Renderer.stats viewDraws / shadowDraws) ride the draws line when a second's mean is half a draw a frame or more.
// And what holds the frame rate: `vsync off` where the desktop shell lifted the display's wait (daggerShell.framesLifted -
// the VSync setting off), and the Frame Rate Cap (systems/frameCap.js) - 198 fps is a display's or a cap's or neither's,
// and the counter now says which (`paceLine` is the pure half). The line stands only when one of them is not the default:
// no line is the display's own pace, uncapped (the browser always waits for the display).
//
// FB1018D HITCH-KEEP (FIELD BUGS 2026-10-18d, Awesomenout: "Normally, my game runs at a stable 144 FPS, but sometimes my
// FPS suddenly drops dramatically, going as low as 30 FPS or even 0 FPS ... I've also tried changing the graphics
// settings, but it doesn't seem to make any difference"): THE MINUTE'S WORST FRAME, KEPT. The worst frame above is its
// second's, gone a second later - a hitch that comes and goes is over before a screenshot can catch it, and `?perf=cpu`
// averages its zones over PERF_EVERY frames. A frame of HITCH_MS or more is a hitch, and the counter keeps the worst of
// the last HITCH_KEEP_MS: how long it was, how long ago, how many the minute held, and the main thread's script in its
// frame in SCRIPT-SPLIT's three parts (the frame that opened the gap - systems/frameClock.js frameSampleAt, asked the tick
// after it; AUDIT FB1018D L2-1: the second's worst sample was another frame's when a heavy frame that was no hitch shared
// its second). A hitch whose script is
// about its length is the main thread's (`frame` the game's own callback, `before` whatever ran first - a timer, a
// message, a collection - `stream` the world's build); one whose script is small is not script at all. The line stands
// only while the minute holds one. And a page put away draws no frames (the browser holds its animation frames), so the
// gap across it is none of the player's: put away for nine seconds, the second it came back in read "8 fps" ("0 fps"
// put away early in a second) and "worst 9007", and would have been the minute's hitch. The second starts again at the
// first frame shown (`keptHitch`, `hitchLine` the pure half).
//
// The pure half (`fpsStats`) is executed by test/ui/enhanced/mwarms_fps.test.js;
// the DOM half runs against the same stub document AUDIT 62 built.

import { frameCpu, frameSampleAt } from '../systems/frameClock.js';   // PERF1: the hosts' script time; FB1018D HITCH-KEEP: one frame's
import { frameCapSkip, frameCapFps } from '../systems/frameCap.js';   // FPS-CAP1: the frames the cap held back are not counted; PASS-COUNT: and the cap said

const PERIOD_MS = 1000;
/** FB1018D HITCH-KEEP: a frame this long is a hitch - three of a 60 Hz screen's frames, seven of a 144's. */
export const HITCH_MS = 50;
/** FB1018D HITCH-KEEP: how long the counter keeps a second that held one. */
export const HITCH_KEEP_MS = 60_000;

/** FB1018D HITCH-KEEP: the second's frames of HITCH_MS or more. Pure. @param {number[]} stamps as fpsStats's */
export function hitchCount(stamps) {
  let n = 0;
  for (let i = 1; i < stamps.length; i++) if (stamps[i] - stamps[i - 1] >= HITCH_MS) n++;
  return n;
}

/**
 * FB1018D HITCH-KEEP: the kept seconds' worst frame - its ms, how many seconds before `now` its second closed, the
 * hitches they held between them, and that frame's own script (frameSampleAt's, or null where no host stamped it) - or
 * null with none kept. Pure. @param {{at:number, worstMs:number, hitches:number, cpu:any}[]} kept the seconds that held a
 * hitch, in order
 */
export function keptHitch(kept, now) {
  let worst = null, count = 0;
  for (const s of kept) { count += s.hitches; if (!worst || s.worstMs > worst.worstMs) worst = s; }
  if (!worst) return null;
  const c = worst.cpu;
  return { ms: worst.worstMs, agoS: Math.round((now - worst.at) / 1000), count,
    scriptMs: c ? c.ms : null, inFrameMs: c ? c.inFrameMs : null, beforeMs: c ? c.beforeMs : null, streamMs: c ? c.streamMs : null };
}

/** FB1018D HITCH-KEEP: the hitch lines from `keptHitch`'s answer - '' with none, the script's only with a clock, under
 *  it, `frame` SCRIPT-SPLIT's `in frame` (labels and numbers, as the draws line is). Pure. */
export function hitchLine(h) {
  if (!h) return '';
  return `\nhitch ${h.ms.toFixed(0)} ms  ${h.agoS} s ago  ${h.count} a minute`
    + (h.scriptMs != null ? `\nscript ${h.scriptMs.toFixed(0)}  frame ${h.inFrameMs.toFixed(0)}  before ${h.beforeMs.toFixed(0)}  stream ${h.streamMs.toFixed(0)}` : '');
}

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

/** PASS-COUNT: what holds the frame rate - `lifted` the desktop shell runs without the display's wait (VSync off), `cap`
 *  the Frame Rate Cap's fps (0: off) - or '' for the defaults (the display's pace, no cap). Pure. */
export function paceLine(lifted, cap) {
  if (!lifted && !(cap > 0)) return '';
  return `\n${lifted ? 'vsync off' : 'vsync'}  ${cap > 0 ? `cap ${cap}` : 'no cap'}`;
}

/** PASS-COUNT: the draws line - the frame's own draws and binds, then the view out's and the shadow maps' where the second
 *  held any (each a per-frame mean). Pure. */
export function drawsLine(draws, binds, view, shadow) {
  return `\ndraws ${Math.round(draws)}  binds ${Math.round(binds)}` + (view >= 0.5 ? `  view ${Math.round(view)}` : '') + (shadow >= 0.5 ? `  shadow ${Math.round(shadow)}` : '');
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
    + 'font:600 13px/1.3 ui-monospace,Menlo,Consolas,monospace;-webkit-font-smoothing:antialiased;letter-spacing:normal;color:#e9e4d9;background:rgba(14,16,19,.65);pointer-events:none;'
    + '-webkit-user-select:none;user-select:none;white-space:pre-wrap;overflow-wrap:anywhere;text-align:right;display:none';
  el.style.display = 'none';   // set on the property too: the cssText above is a string to a stub document
  document.body.appendChild(el);
  let stamps = [];
  let shown = false;
  let sumDraws = 0, sumBinds = 0, samples = 0;   // PERF3: the renderer's per-frame counts (beginFrame zeroes them), summed over the second
  let sumView = 0, sumShadow = 0;   // PASS-COUNT: the view out's and the shadow maps'
  let last = null;   // PERF9: the last second's numbers, for the probe
  const kept = [];   // FB1018D HITCH-KEEP: the seconds of the last HITCH_KEEP_MS that held a hitch
  let gapMs = 0, gapCpu = null;   // FB1018D HITCH-KEEP (AUDIT FB1018D L2-1): the second's longest gap of HITCH_MS or more, and the script of the frame that opened it
  // FB1018D HITCH-KEEP: the page was put away (or shown again) since its last frame - the gap is no frame of the
  // player's. The browser sends visibilitychange both ways, and holds every animation frame between the two.
  let hid = false;
  const onVisibility = () => { hid = true; };
  if (typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', onVisibility);
  // PERF-SCALE: the GPU and the frame's size ride the probe's read, asked for when it asks - never on a hidden tick
  const described = () => { const i = info?.(); return i ? { gpu: i.gpu ?? null, world: i.world ?? null, canvas: i.canvas ?? null, dpr: i.dpr ?? null, scale: i.scale ?? null, retro: !!i.retro } : null; };
  if (typeof globalThis.window !== 'undefined' && globalThis.window) globalThis.window.__fpsStats = () => (last && info ? { ...last, ...described() } : last);
  let handle = 0;
  let live = true;
  function tick(now) {
    if (hid) { hid = false; stamps = []; sumDraws = 0; sumBinds = 0; samples = 0; sumView = 0; sumShadow = 0; gapMs = 0; gapCpu = null; }   // FB1018D HITCH-KEEP: a second starts at the first frame shown
    // FPS-CAP1: a callback the Frame Rate Cap held back drew nothing, so it is not a frame. The host asked the same
    // question with the same stamp (one decision per stamp, systems/frameCap.js), so this counts what the game drew.
    if (frameCapSkip(now)) { if (live && raf) handle = raf(tick); return; }
    const prev = stamps.length ? stamps[stamps.length - 1] : null;
    stamps.push(now);
    if (prev != null && now - prev >= HITCH_MS && now - prev > gapMs) { gapMs = now - prev; gapCpu = frameSampleAt(prev); }   // FB1018D HITCH-KEEP: asked while that frame's sample is the clock's newest
    const st = stats?.();   // PERF3: one complete frame's counts, whichever side of the host's callback this tick fell
    if (st) { sumDraws += st.draws; sumBinds += st.texBinds; sumView += st.viewDraws ?? 0; sumShadow += st.shadowDraws ?? 0; samples++; }
    const on = !!enabled();
    if (on !== shown) { shown = on; el.style.display = on ? 'block' : 'none'; }
    if (now - stamps[0] >= PERIOD_MS) {
      {   // PERF9: computed every second whether or not the overlay shows; written only while it does
        const { fps, meanMs, worstMs } = fpsStats(stamps);
        const cpu = frameCpu();   // PERF1: null until a host has stamped a frame (the menu has none)
        // PERF3: the renderer's draws and texture binds, averaged per frame
        // over the second - the GL call count is the CPU side of the GPU's
        // work, and the number the culls and the sort are meant to move.
        const gpu = samples ? drawsLine(sumDraws / samples, sumBinds / samples, sumView / samples, sumShadow / samples) : '';
        const i = on ? info?.() : null;   // PERF-SCALE: the GPU and the size, while shown
        const size = sizeLine(i);
        // FB1018D HITCH-KEEP: a second that held a hitch is kept for HITCH_KEEP_MS, its own frame's script beside it
        const hitches = hitchCount(stamps);
        if (hitches) kept.push({ at: now, worstMs, hitches, cpu: gapCpu });
        while (kept.length && now - kept[0].at > HITCH_KEEP_MS) kept.shift();
        const hitch = keptHitch(kept, now);
        if (on) el.textContent = `${fps} fps\n${meanMs.toFixed(1)} ms  worst ${worstMs.toFixed(0)}`
          + (cpu ? `\nscript ${cpu.meanMs.toFixed(1)} ms  worst ${cpu.worstMs.toFixed(0)}` : '') + scriptSplitLine(cpu) + gpu
          + hitchLine(hitch)   // FB1018D HITCH-KEEP
          + paceLine(!!globalThis.window?.daggerShell?.framesLifted, frameCapFps())   // PASS-COUNT
          + (i ? `\ngpu ${i.gpu ?? 'unknown'}` : '') + (size ? `\n${size}` : '');
        // PERF9: the same numbers for a probe (tools/perfProbe.mjs) - the
        // last second's, as an object, whether or not the overlay shows.
        last = { fps, meanMs, worstMs, scriptMs: cpu?.meanMs ?? null, scriptWorstMs: cpu?.worstMs ?? null, draws: samples ? sumDraws / samples : null, binds: samples ? sumBinds / samples : null,
          viewDraws: samples ? sumView / samples : null, shadowDraws: samples ? sumShadow / samples : null,   // PASS-COUNT
          scriptInFrameMs: cpu?.inFrameMs ?? null, scriptBeforeMs: cpu?.beforeMs ?? null, scriptStreamMs: cpu?.streamMs ?? null,   // SCRIPT-SPLIT
          hitch };   // FB1018D HITCH-KEEP: the minute's worst frame (keptHitch), or null
      }
      stamps = [now];
      gapMs = 0; gapCpu = null;   // FB1018D HITCH-KEEP
      sumDraws = 0; sumBinds = 0; samples = 0;   // PERF3
      sumView = 0; sumShadow = 0;   // PASS-COUNT
    }
    if (live && raf) handle = raf(tick);
  }
  if (raf) handle = raf(tick);
  return {
    el,
    tick,
    dispose() {
      live = false; if (handle && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle); el.remove();
      if (typeof document.removeEventListener === 'function') document.removeEventListener('visibilitychange', onVisibility);   // FB1018D HITCH-KEEP
    },
  };
}
