// @ts-check
// EL8 (2026-09-17): THE PERF READOUT - `?perf`. A frame's GPU time from
// beginFrame to the resolve (EXT_disjoint_timer_query_webgl2, where the
// browser has it - Chrome does, Safari and Firefox mostly do not, and then
// the line carries the counts alone) and the lane's counts, one console
// line every PERF_EVERY world frames. This session cannot see Mac's GPU;
// this is how Mac can, and how a quality setting could be tuned against
// numbers instead of guesses. A leaf: no renderer, no lane.
//
// VC6d (2026-09-18, Mac: "overall enhancing performance on the outside
// due to all our new additions"): `?perf=zones` breaks that one number
// into the PASSES that make it. A frame's total is the only thing the
// meter could say, and "14 ms" does not tell anyone which of the year's
// additions to go after - the shadow cascades, the cloud march, the
// grass, the air pass. The extension allows exactly ONE elapsed-time
// query open at a time, so the zones cannot nest and cannot overlap;
// they TILE instead. `mark(name)` closes whatever span is open and
// opens the next, `stop()` closes the last, and because every span is
// end-to-end with its neighbour the zones add up to the frame. Nothing
// is guessed and nothing is double-counted.
//
// The meter is kept per GL context (`meterFor`) so a pass that is not
// the renderer's - the sky and its cloud march run from scenes/shared.js
// - can mark its own span without the renderer being threaded to it.

export const PERF_EVERY = 120;

/** The door: `?perf` anywhere in the query. */
export function perfOn(search = globalThis.location?.search ?? '') {
  try { return /[?&]perf\b/.test(search); } catch { return false; }
}

/** VC6d: `?perf=zones` - the same door, per pass instead of per frame. */
export function perfZones(search = globalThis.location?.search ?? '') {
  try { return /[?&]perf=zones\b/.test(search); } catch { return false; }
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

/** VC6d: the zone line - the passes, heaviest first, and their total.
 *  `zones` is a Map of name to mean milliseconds. */
export function perfZoneLine(zones, counts) {
  const rows = [...zones.entries()].filter(([, ms]) => ms != null).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return perfLine(null, counts);
  const total = rows.reduce((a, [, ms]) => a + ms, 0);
  const parts = [`gpu ${total.toFixed(2)}ms`, ...rows.map(([n, ms]) => `${n} ${ms.toFixed(2)}`), `draws ${counts?.draws ?? 0}`];
  return `[perf] ${parts.join(' | ')}`;
}

export class PerfMeter {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl, zones = false) {
    this.gl = gl;
    this.ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2') ?? null;
    this.queries = [];
    this.active = null;
    this.samples = [];
    this.frames = 0;
    // VC6d: the zone mode - the frame's own clock stands down, because
    // the extension will not have two elapsed-time queries open at once
    // and the zones are what tile the frame in its place.
    this.zones = !!zones;
    this.zoneQueries = [];      // [name, query], in the order they were opened
    this.zoneSamples = new Map();
    this.openZone = null;
  }
  begin() {
    if (!this.ext || this.active || this.zones) return;
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
  /** VC6d, DRAW PATH: close the span that is open and open `name`'s.
   *  The spans tile - each begins where the last ended - so their sum is
   *  the frame and no GPU time is counted twice or lost between them. */
  mark(name) {
    if (!this.ext || !this.zones) return;
    this._closeZone();
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.openZone = [name, q];
  }
  /** VC6d, DRAW PATH: close the last span of the frame. */
  stop() { this._closeZone(); }
  _closeZone() {
    if (!this.openZone) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.zoneQueries.push(this.openZone);
    this.openZone = null;
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
    while (this.zoneQueries.length) {
      const [name, q] = this.zoneQueries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      this.zoneQueries.shift();
      gl.deleteQuery(q);
      if (disjoint) continue;
      const bucket = this.zoneSamples.get(name);
      if (bucket) bucket.push(ns / 1e6);
      else this.zoneSamples.set(name, [ns / 1e6]);
    }
  }
  /** Once every PERF_EVERY frames: the mean of the samples since, as a line; null between. */
  frame(counts) {
    this.frames++;
    if (this.zones) this.poll();   // VC6d: no end() to poll from - the zones are closed by mark/stop
    if (this.frames % PERF_EVERY !== 0) return null;
    if (this.zones) {
      // VC6d: the mean PER FRAME, not per sample - a zone marked twice
      // in a frame (the world draws either side of the sky) must read as
      // the time that frame spent in it, or it would look half as heavy.
      const means = new Map();
      for (const [name, list] of this.zoneSamples) {
        means.set(name, list.length ? list.reduce((a, b) => a + b, 0) / PERF_EVERY : null);
        list.length = 0;
      }
      return this.ext ? perfZoneLine(means, counts) : perfLine(null, counts);
    }
    const mean = this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : null;
    this.samples.length = 0;
    return perfLine(this.ext ? mean : null, counts);
  }
}

// VC6d: ONE METER PER CONTEXT. The renderer builds it; a pass that draws
// from somewhere else - the sky and its cloud march, from
// scenes/shared.js - finds it by the GL it already holds, and marks its
// own span. A WeakMap, so a dropped context takes its meter with it.
const METERS = new WeakMap();
/** Register `meter` as the one for `gl` (the renderer, at boot). */
export function setMeter(gl, meter) { if (meter) METERS.set(gl, meter); return meter; }
/** The meter for `gl`, or null where `?perf` is not on. */
export function meterFor(gl) { return METERS.get(gl) ?? null; }
