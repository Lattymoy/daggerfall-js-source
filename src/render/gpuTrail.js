// @ts-check
// GPU-TRAIL (2026-10-24): THE GPU'S LAST TEN MINUTES, KEPT BESIDE A CRASH.
//
// Players report the desktop app's page stopping after a while of play, and the box says "It ran out of memory" - which
// is only Electron's reason for the stop, in the player's words (app/lib/rendererGone.cjs GONE_WHY). One reporter's
// kernel log (RDNA3, Linux, Mesa) showed the GPU itself hang and reset, not an allocation that failed. Nobody here has
// that hardware and nobody asks a reporter for more, so crash.log has to carry the evidence: the page samples what it
// holds on the GPU and what its frames cost, keeps the last GPU_TRAIL_KEEP samples, and hands them to the shell with
// each one (app/preload.cjs gpuTrail), which writes them under the stop's own line (app/main.cjs logGone).
//
// A sample: the renderer's own context's live objects by kind (its create* and delete* counted), the fps counter's
// last second (ui/fpsCounter.js: frames, mean and worst ms, draws and binds, the minute's worst hitch), the JS heap
// where Chromium tells it, whether the page is hidden, whether the context is lost, and whether this is the sample taken
// as it came back (restored). No byte estimate: a texture
// re-uploaded at a level and a buffer filled again would make a running byte total mislead on the very question asked.
// Nothing runs in the frame - no getError, no getParameter: the counts are a wrapped call on each create and delete, and
// the rest is read once a sample.

/** How often a sample is taken, and how soon the first: a page that stops in its first half-minute still says something. */
export const GPU_TRAIL_MS = 30_000;
export const GPU_TRAIL_FIRST_MS = 5_000;
/** The samples kept - ten minutes at GPU_TRAIL_MS. The shell keeps as many (app/lib/rendererGone.cjs TRAIL_KEEP). */
export const GPU_TRAIL_KEEP = 20;

/** The kinds counted: WebGL's own name for each, and the sample's. */
export const GL_KINDS = Object.freeze([['Texture', 'textures'], ['Buffer', 'buffers'], ['VertexArray', 'vaos'], ['Framebuffer', 'framebuffers'], ['Program', 'programs']]);

/** @typedef {{ textures: number, buffers: number, vaos: number, framebuffers: number, programs: number }} GlLive */

/** @returns {GlLive} */
const noneLive = () => ({ textures: 0, buffers: 0, vaos: 0, framebuffers: 0, programs: 0 });

/**
 * Count `gl`'s live objects from now on, into `live`. A delete counts only an object this counted alive: WebGL takes
 * null, an object already deleted and one made before the count without complaint, and a bare counter would drift below
 * what the context holds over a long session - the very drift a leak is read from.
 * @param {WebGL2RenderingContext} gl
 * @param {GlLive} [live]
 * @returns {GlLive}
 */
export function countGlObjects(gl, live = noneLive()) {
  const g = /** @type {any} */ (gl), n = /** @type {Record<string, number>} */ (live);
  for (const [kind, key] of GL_KINDS) {
    const create = g[`create${kind}`], remove = g[`delete${kind}`];
    const held = new WeakSet();
    g[`create${kind}`] = function () { const o = create.call(gl); if (o) { held.add(o); n[key]++; } return o; };
    g[`delete${kind}`] = function (o) { if (o && held.delete(o)) n[key]--; return remove.call(gl, o); };
  }
  return live;
}

/**
 * The canvas's WebGL2 context counted from its first object. The renderer asks for its context in its constructor and
 * builds its programs there, so the count must stand before `new Renderer(canvas)`: the canvas's getContext is
 * shadowed until its first webgl2 answer, which is counted, and then the canvas's own is given back.
 * @param {HTMLCanvasElement} canvas
 * @returns {GlLive}
 */
export function countCanvasGl(canvas) {
  const live = noneLive();
  const c = /** @type {any} */ (canvas);
  const own = c.getContext;
  c.getContext = function (type, attrs) {
    const ctx = own.call(canvas, type, attrs);
    if (ctx && type === 'webgl2') { delete c.getContext; countGlObjects(ctx, live); }
    return ctx;
  };
  return live;
}

/** The last `keep` samples, oldest first: `push` answers them, the new one last. */
export function createTrail(keep = GPU_TRAIL_KEEP) {
  /** @type {object[]} */
  const ring = [];
  return {
    /** @param {object} s */
    push(s) { ring.push(s); if (ring.length > keep) ring.splice(0, ring.length - keep); return ring.slice(); },
  };
}

const whole = (v) => (Number.isFinite(v) ? Math.round(v) : null);

/**
 * The minute's worst hitch in ms: 0 when the fps counter kept none (it answers `hitch: null` then - a number it has),
 * null with no second to read it from.
 * @param {any} frame
 */
const hitchOf = (frame) => (frame ? (frame.hitch ? whole(frame.hitch.ms) : 0) : null);

/**
 * One sample. Pure. `frame` is the fps counter's last second (ui/fpsCounter.js mountFpsCounter `last`), or null - before
 * its first second, and when it is the second the sample before had (no frame has been drawn since: the page hidden, or
 * the frames stopped); `heap` the JS heap's used bytes, or null where the browser does not say; `restored` the sample
 * taken as the context came back.
 * @param {{ at: number, upMs: number, live: GlLive, frame: any, heap: number|null, hidden: boolean, lost: boolean, restored?: boolean }} o
 */
export function gpuSample({ at, upMs, live, frame, heap, hidden, lost, restored = false }) {
  return {
    at, upS: whole(upMs / 1000),
    textures: live.textures, buffers: live.buffers, vaos: live.vaos, framebuffers: live.framebuffers, programs: live.programs,
    fps: whole(frame?.fps), frameMs: Number.isFinite(frame?.meanMs) ? Math.round(frame.meanMs * 10) / 10 : null, worstMs: whole(frame?.worstMs),
    hitchMs: hitchOf(frame), draws: whole(frame?.draws), binds: whole(frame?.binds), viewDraws: whole(frame?.viewDraws), shadowDraws: whole(frame?.shadowDraws),
    heapMB: heap == null ? null : whole(heap / 1048576), hidden: !!hidden, lost: !!lost, restored: !!restored,
  };
}

/**
 * The trail, running: a sample GPU_TRAIL_FIRST_MS after the start, one every GPU_TRAIL_MS after that, and one the moment
 * the context is lost or given back - each handed to `send` with the samples before it. The shell keeps the newest it was
 * handed, so a page that stops between samples has said everything up to its last. A `send` that throws costs the trail
 * nothing. `stop` is for a test: the game's trail runs as long as its page.
 * @param {{ canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, live: GlLive, frames: () => any, gpu?: string|null,
 *   send: (trail: { gpu: string|null, samples: object[] }) => void, timers?: any }} o
 */
export function startGpuTrail({ canvas, gl, live, frames, gpu = null, send, timers = globalThis }) {
  const trail = createTrail();
  let lastFrame = null;
  const sample = (restored = false) => {
    const frame = frames?.() ?? null;
    const s = gpuSample({
      at: Date.now(), upMs: globalThis.performance?.now?.() ?? 0, live, frame: frame === lastFrame ? null : frame,
      heap: /** @type {any} */ (globalThis.performance)?.memory?.usedJSHeapSize ?? null, hidden: !!globalThis.document?.hidden, lost: gl.isContextLost(),
      restored,
    });
    lastFrame = frame;
    try { send({ gpu, samples: trail.push(s) }); } catch { /* the shell gone first: the next sample tries again */ }
  };
  // A timer and the lost event would hand their own argument to `sample`; each says what it is instead.
  const sampleNow = () => sample(false);
  const sampleRestored = () => sample(true);
  const first = timers.setTimeout(sampleNow, GPU_TRAIL_FIRST_MS);
  const every = timers.setInterval(sampleNow, GPU_TRAIL_MS);
  canvas.addEventListener('webglcontextlost', sampleNow);
  canvas.addEventListener('webglcontextrestored', sampleRestored);
  return {
    sample: sampleNow,
    stop() {
      timers.clearTimeout(first); timers.clearInterval(every);
      canvas.removeEventListener('webglcontextlost', sampleNow); canvas.removeEventListener('webglcontextrestored', sampleRestored);
    },
  };
}

/**
 * The entry's one door (src/main.js boot): the canvas counted now, before the renderer is made, and the trail started
 * once the renderer and the fps counter stand. `send` is the shell's (daggerShell.gpuTrail).
 * @param {HTMLCanvasElement} canvas
 * @param {(trail: { gpu: string|null, samples: object[] }) => void} send
 */
export function gpuTrailOn(canvas, send) {
  const live = countCanvasGl(canvas);
  return {
    /** @param {{ gl: WebGL2RenderingContext, gpuName?: string|null }} renderer @param {() => any} frames */
    start: (renderer, frames) => startGpuTrail({ canvas, gl: renderer.gl, live, frames, gpu: renderer.gpuName ?? null, send }),
  };
}
