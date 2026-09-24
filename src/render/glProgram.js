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
 *  then linkProgram and the LINK_STATUS check. A fault throws the driver's
 *  log - a constructor fault the boot probe sees - prefixed, when `label` is
 *  given, `${label} shader: ` or `${label} link: `. */
export function buildProgram(gl, vsSrc, fsSrc, label = '') {
  const prog = gl.createProgram();
  const stage = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`${label ? `${label} shader: ` : ''}${gl.getShaderInfoLog(sh)}`);
    gl.attachShader(prog, sh);
  };
  stage(gl.VERTEX_SHADER, vsSrc);
  stage(gl.FRAGMENT_SHADER, fsSrc);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`${label ? `${label} link: ` : ''}${gl.getProgramInfoLog(prog)}`);
  return prog;
}
