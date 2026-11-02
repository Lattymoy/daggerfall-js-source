// WISPS-RETURN (2026-09-25): A WISP AS THE GAME DRAWS IT, IN NODE. The real WindWispsRenderer draws on a recording
// WebGL2 (a uniform's location is its name), and the uniforms it uploads are handed to the shaders' own main()s
// (test/glsl.mjs): the vertex stage at one corner of one wisp, its outs handed on to the fragment stage. Nothing here
// restates a uniform the renderer sets, so a pin read through it holds what the renderer and the shaders do together.
import { WISP_VS, WISP_FS, WindWispsRenderer } from '../src/render/windWisps.js';
import { glslFunctions } from './glsl.mjs';

/** The identity, so a draw's uVP leaves gl_Position the wisp's world position. */
export const I16 = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A WebGL2 that records every call and every uniform location asked for; each create answers a fresh object. */
export function recordingGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => { calls.push(['getUniformLocation', n]); return n; };
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...a) => { calls.push([k, ...a]); };
    },
  });
  return { gl, calls };
}

/** What a draw uploaded, by uniform name: a number for a scalar, an array for a vector or a matrix. */
export function uploadsOf(calls) {
  const u = {};
  for (const [k, loc, ...a] of calls) {
    if (typeof k !== 'string' || !k.startsWith('uniform')) continue;
    if (k.startsWith('uniformMatrix')) u[loc] = Array.from(a[1]);
    else if (k.endsWith('v')) u[loc] = Array.from(a[0]);
    else u[loc] = a.length === 1 ? a[0] : a;
  }
  return u;
}

/** A renderer in `look` drawing one frame of `wd` from `eye` at `seconds`, under the identity view-projection. */
export function drawOnce(look, wd, { eye = [0, 1.7, 0], seconds = 3 } = {}) {
  const { gl, calls } = recordingGl();
  const r = new WindWispsRenderer(gl, look);
  const built = calls.length;
  r.draw(wd, new Float32Array(I16), new Float32Array(I16), new Float32Array(eye), seconds);
  return { r, built: calls.slice(0, built), frame: calls.slice(built), uploads: uploadsOf(calls.slice(built)) };
}

const OUTS = [...WISP_VS.matchAll(/\bout\s+\w+\s+(\w+)\s*;/g)].map((m) => m[1]);

/** One corner of one wisp through both stages: its world position `p`, the varyings, and the fragment's alpha. */
export function shade(uploads, corner, seed, at = [5, 2, -7]) {
  const vs = glslFunctions(WISP_VS, { ...uploads, aCorner: corner, aSeed: [...at, seed] });
  vs.main();
  const vary = Object.fromEntries(OUTS.map((n) => [n, vs.globals[n]]));
  const fs = glslFunctions(WISP_FS, { ...uploads, ...vary });
  fs.main();
  return { p: vs.globals.gl_Position.slice(0, 3), vary, alpha: fs.globals.o[3] };
}
