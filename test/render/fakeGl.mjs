// A WebGL2 context that keeps the state a pass leaves behind, for the passes' own pins: every method a pass calls is a
// recorder, the capability switches, the depth mask, the bound vertex array and buffer, each attribute's offset and
// every uniform by its name are read back, and the compile and link always succeed. Not a renderer: nothing is drawn.
export function fakeGl() {
  const st = { on: new Set(), depthMask: true, vao: null, buffer: null, attribs: new Map(), uniforms: new Map(), draws: [], blend: [], deleted: [] };
  let id = 0;
  const C = { BLEND: 0x0be2, CULL_FACE: 0x0b44, DEPTH_TEST: 0x0b71, ARRAY_BUFFER: 0x8892, TRIANGLES: 4, FLOAT: 0x1406, ONE: 1, ZERO: 0,
    SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303, VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30, STATIC_DRAW: 0x88e4, DYNAMIC_DRAW: 0x88e8,
    COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82 };
  const methods = {
    enable: (c) => st.on.add(c), disable: (c) => st.on.delete(c), depthMask: (m) => { st.depthMask = m; },
    bindVertexArray: (v) => { st.vao = v; }, bindBuffer: (_t, b) => { st.buffer = b; },
    vertexAttribPointer: (i, size, type, norm, stride, offset) => st.attribs.set(i, { size, stride, offset }),
    getUniformLocation: (_p, name) => ({ name }),
    drawArraysInstanced: (mode, first, count, n) => st.draws.push({ mode, first, count, n, depthMask: st.depthMask, blend: st.on.has(C.BLEND), glow: st.uniforms.get('uGlowPass') }),
    blendFunc: (a, b) => st.blend.push([a, b]), blendFuncSeparate: (a, b, c, d) => st.blend.push([a, b, c, d]),
    getShaderParameter: () => true, getProgramParameter: () => true, getExtension: () => null, isContextLost: () => false,
    deleteProgram: (p) => st.deleted.push(p), deleteBuffer: (b) => st.deleted.push(b), deleteVertexArray: (v) => st.deleted.push(v),
  };
  const uniform = (loc, ...v) => { if (loc) st.uniforms.set(loc.name, v.length === 1 ? v[0] : v); };
  const gl = new Proxy({}, {
    get(_t, k) {
      if (k === 'state') return st;
      if (k in C) return C[k];
      if (k in methods) return methods[k];
      if (typeof k === 'string' && k.startsWith('uniform')) return uniform;
      if (typeof k === 'string' && /^[a-z]/.test(k)) return () => ({ id: ++id });
      return undefined;
    },
  });
  return gl;
}
