// @ts-check
// AUDIT 68 S17-gl-program-dup (2026-09-24): ONE COMPILE AND LINK. The
// renderer and eleven foreign passes (the sky, the rain, the wisps, the
// clouds and their noise, the far ring, the bolts, Dynamic Skies, the grass,
// the enhanced sky) each wrote the same createShader / compile / check /
// attach / link / check out by hand, and had drifted only in their error
// prefixes. A leaf with no imports.

/** Compile `vsSrc` and `fsSrc` and link them into a program, in the order
 *  every pass wrote it: createProgram, then per stage createShader,
 *  shaderSource, compileShader, the COMPILE_STATUS check and attachShader,
 *  then linkProgram and the LINK_STATUS check; both shaders deleted after
 *  (AUDIT EG V - they go with the program). A fault throws the driver's
 *  log - a constructor fault the boot probe sees - prefixed, when `label` is
 *  given, `${label} shader: ` or `${label} link: `. */
export function buildProgram(gl, vsSrc, fsSrc, label = '') {
  // PERF-COMPILE1 (2026-10-10, stutter): ONE SYNC POINT, NOT THREE. A status query is a round trip that waits for the
  // driver to finish - asked after each compile, it made the vertex stage finish before the fragment stage was even
  // handed over, and the link wait a third. Both stages go in, the link goes in, and the one LINK_STATUS read waits
  // once; the drivers that compile in parallel (ANGLE's worker threads) overlap the stages. A failure still throws the
  // log it threw: a stage that did not compile is read only when the link failed (a compile fault always fails the
  // link), and its log comes first, prefixed `${label} shader: `.
  const prog = gl.createProgram();
  const stage = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(prog, sh);
    return sh;
  };
  const vs = stage(gl.VERTEX_SHADER, vsSrc);
  const fs = stage(gl.FRAGMENT_SHADER, fsSrc);
  gl.linkProgram(prog);
  let fault = /** @type {string|null} */ (null);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    for (const sh of [vs, fs]) if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { fault = `${label ? `${label} shader: ` : ''}${gl.getShaderInfoLog(sh)}`; break; }
    fault ??= `${label ? `${label} link: ` : ''}${gl.getProgramInfoLog(prog)}`;
  }
  // AUDIT EG V (lane 6's shader objects; EVERY ALLOCATION HAS AN OWNER): the two stages flagged for deletion once the link
  // is read - attached, they live as long as the program and go with its deleteProgram. Kept, every pass rebuilt (the
  // Spire's look each breach, the spans' ghosts each circle) left its two behind. A build that throws frees its program too.
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (fault != null) { gl.deleteProgram(prog); throw new Error(fault); }
  return prog;
}
