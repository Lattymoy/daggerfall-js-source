// @ts-check
// EL8 (2026-09-17): THE PERF READOUT - `?perf`. A frame's GPU time from
// beginFrame to the resolve (EXT_disjoint_timer_query_webgl2, where the
// browser has it - Chrome does, Safari and Firefox mostly do not, and then
// the line carries the counts alone) and the lane's counts, one console
// line every PERF_EVERY world frames. This session cannot see Mac's GPU;
// this is how Mac can, and how a quality setting could be tuned against
// numbers instead of guesses. A leaf: no renderer, no lane.

export const PERF_EVERY = 120;

/** The door: `?perf` anywhere in the query. */
export function perfOn(search = globalThis.location?.search ?? '') {
  try { return /[?&]perf\b/.test(search); } catch { return false; }
}

/** One line from the accumulated GPU samples and this frame's counts. */
export function perfLine(gpuMs, counts) {
  const gpu = gpuMs == null ? 'gpu n/a' : `gpu ${gpuMs.toFixed(2)}ms`;
  const c = counts || {};
  const parts = [gpu, `draws ${c.draws ?? 0}`];
  if (c.shadows) parts.push(`sun ${c.shadows.cascadesDrawn ?? 0}c/${c.shadows.sunDraws ?? 0}d`, `lanterns ${c.shadows.casters ?? 0}k/${c.shadows.facesDrawn ?? 0}f/${c.shadows.pointDraws ?? 0}d`, `culled ${c.shadows.culled ?? 0}`, `records ${c.shadows.records ?? 0}`);
  if (c.air) parts.push(`emit ${c.air.emitDraws ?? 0}`, `glares ${c.air.glares ?? 0}`, `shafts ${c.air.shafts ? 1 : 0}`);
  return `[perf] ${parts.join(' | ')}`;
}

export class PerfMeter {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2') ?? null;
    this.queries = [];
    this.active = null;
    this.samples = [];
    this.frames = 0;
  }
  begin() {
    if (!this.ext || this.active) return;
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }
  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.queries.push(this.active);
    this.active = null;
    this.poll();
  }
  /** Collect the results that are in; a disjoint interval is dropped. */
  poll() {
    const gl = this.gl;
    while (this.queries.length) {
      const q = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      this.queries.shift();
      gl.deleteQuery(q);
      if (!disjoint) this.samples.push(ns / 1e6);
    }
  }
  /** Once every PERF_EVERY frames: the mean of the samples since, as a line; null between. */
  frame(counts) {
    this.frames++;
    if (this.frames % PERF_EVERY !== 0) return null;
    const mean = this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : null;
    this.samples.length = 0;
    return perfLine(this.ext ? mean : null, counts);
  }
}
