// AUDIT RETRO1 (lens B's, shared by the audit's two passes): a STATEFUL
// fake WebGL2 - texture units, framebuffer attachments, each texture's
// own parameters and storage, the capabilities, the viewport, the clear
// colour, the scissor - and the two draw-time rules WebGL2 enforces that
// the audit is about: a sampler reading a texture attached to the
// framebuffer it draws into (a feedback loop), and two sampler types on
// one unit. Its constants are WebGL2's own values; a constant it does
// not list is a distinct string, never 1.

export const E = {
  DEPTH_BUFFER_BIT: 0x100, STENCIL_BUFFER_BIT: 0x400, COLOR_BUFFER_BIT: 0x4000,
  POINTS: 0, LINES: 1, TRIANGLES: 4, TRIANGLE_STRIP: 5, TRIANGLE_FAN: 6, ZERO: 0, ONE: 1, NONE: 0,
  SRC_ALPHA: 0x302, ONE_MINUS_SRC_ALPHA: 0x303, FUNC_ADD: 0x8006, MIN: 0x8007, MAX: 0x8008,
  TEXTURE_2D: 0x0DE1, TEXTURE_3D: 0x806F, TEXTURE_2D_ARRAY: 0x8C1A, TEXTURE_CUBE_MAP: 0x8513,
  TEXTURE_MAG_FILTER: 0x2800, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803, TEXTURE_WRAP_R: 0x8072,
  TEXTURE_MAX_LEVEL: 0x813D, TEXTURE_BASE_LEVEL: 0x813C, TEXTURE_COMPARE_MODE: 0x884C,
  NEAREST: 0x2600, LINEAR: 0x2601, NEAREST_MIPMAP_NEAREST: 0x2700, LINEAR_MIPMAP_NEAREST: 0x2701, NEAREST_MIPMAP_LINEAR: 0x2702, LINEAR_MIPMAP_LINEAR: 0x2703,
  REPEAT: 0x2901, CLAMP_TO_EDGE: 0x812F, MIRRORED_REPEAT: 0x8370,
  RED: 0x1903, RG: 0x8227, RGB: 0x1907, RGBA: 0x1908, R8: 0x8229, RG8: 0x822B, RGB8: 0x8051, RGBA8: 0x8058,
  R16F: 0x822D, RG16F: 0x822F, RGBA16F: 0x881A, R32F: 0x822E, RGBA32F: 0x8814, R32UI: 0x8236, RGBA32UI: 0x8D70,
  RED_INTEGER: 0x8D94, RGBA_INTEGER: 0x8D99, UNSIGNED_BYTE: 0x1401, UNSIGNED_SHORT: 0x1403, INT: 0x1404, UNSIGNED_INT: 0x1405, FLOAT: 0x1406, HALF_FLOAT: 0x140B,
  DEPTH_COMPONENT: 0x1902, DEPTH_COMPONENT16: 0x81A5, DEPTH_COMPONENT24: 0x81A6, DEPTH_COMPONENT32F: 0x8CAC, DEPTH_STENCIL: 0x84F9, DEPTH24_STENCIL8: 0x88F0,
  FRAMEBUFFER: 0x8D40, READ_FRAMEBUFFER: 0x8CA8, DRAW_FRAMEBUFFER: 0x8CA9, RENDERBUFFER: 0x8D41, FRAMEBUFFER_COMPLETE: 0x8CD5,
  COLOR_ATTACHMENT0: 0x8CE0, DEPTH_ATTACHMENT: 0x8D00, DEPTH_STENCIL_ATTACHMENT: 0x821A,
  ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, UNIFORM_BUFFER: 0x8A11, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8, STREAM_DRAW: 0x88E0,
  VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
  DEPTH_TEST: 0x0B71, CULL_FACE: 0x0B44, BLEND: 0x0BE2, SCISSOR_TEST: 0x0C11, STENCIL_TEST: 0x0B90, POLYGON_OFFSET_FILL: 0x8037,
  BACK: 0x0405, FRONT: 0x0404, CW: 0x0900, CCW: 0x0901, LESS: 0x0201, EQUAL: 0x0202, LEQUAL: 0x0203, GREATER: 0x0204, GEQUAL: 0x0206, ALWAYS: 0x0207,
  UNPACK_ALIGNMENT: 0x0CF5, PACK_ALIGNMENT: 0x0D05, UNPACK_FLIP_Y_WEBGL: 0x9240, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
  TEXTURE0: 0x84C0,
};
for (let i = 1; i < 32; i++) E[`TEXTURE${i}`] = E.TEXTURE0 + i;
const TARGET_OF = (type) => (/2DArray/.test(type) ? E.TEXTURE_2D_ARRAY : /3D/.test(type) ? E.TEXTURE_3D : /Cube/.test(type) ? E.TEXTURE_CUBE_MAP : E.TEXTURE_2D);

export function stateGl(W = 1280, H = 720) {
  let ids = 0;
  const calls = [], errors = [];
  const canvas = { clientWidth: W, clientHeight: H, width: W, height: H };
  const s = {
    active: 0, units: Array.from({ length: 32 }, () => ({})), drawFb: null, readFb: null, fbos: new Map(), prog: null,
    enabled: new Set([E.DEPTH_TEST, E.CULL_FACE]), depthMask: true, viewport: [0, 0, W, H], clearColor: [0, 0, 0, 0], scissor: [0, 0, W, H],
    clears: [], draws: [], blits: [],
  };
  const obj = (kind, extra = {}) => ({ kind, id: ++ids, ...extra });
  const bound = (target) => s.units[s.active][target];
  const attach = (target, att, tex) => {
    const fb = target === E.READ_FRAMEBUFFER ? s.readFb : s.drawFb;
    if (!fb) return;
    if (!s.fbos.has(fb)) s.fbos.set(fb, {});
    s.fbos.get(fb)[att] = tex;
  };
  const draw = (what) => {
    const p = s.prog;
    s.draws.push({ what, prog: p, fb: s.drawFb, viewport: [...s.viewport], scissorOn: s.enabled.has(E.SCISSOR_TEST), units: s.units.slice(0, 5).map((u) => ({ ...u })) });
    if (!p) return;
    const onUnit = new Map();
    const att = s.drawFb ? Object.values(s.fbos.get(s.drawFb) ?? {}) : [];
    for (const smp of p.samplers) {
      if (!smp.active) continue;
      const unit = p.units[smp.name] ?? 0;
      const prev = onUnit.get(unit);
      if (prev && prev.type !== smp.type) errors.push({ what, err: 'INVALID_OPERATION: two sampler types on one unit', unit, a: prev.name, b: smp.name });
      onUnit.set(unit, smp);
      const tex = s.units[unit]?.[TARGET_OF(smp.type)];
      if (tex && att.includes(tex)) errors.push({ what, err: 'INVALID_OPERATION: feedback loop', sampler: smp.name, unit, tex: tex.id });
    }
  };
  const impl = {
    createTexture: () => obj('tex', { params: {} }), createFramebuffer: () => obj('fbo'), createRenderbuffer: () => obj('rb'),
    createBuffer: () => obj('buf'), createVertexArray: () => obj('vao'), createQuery: () => obj('q'),
    createShader: (type) => obj('sh', { type }), createProgram: () => obj('prog', { shaders: [], samplers: [], units: {}, values: {}, locs: new Map() }),
    shaderSource: (sh, text) => { sh.src = text; },
    attachShader: (p, sh) => { p.shaders.push(sh); },
    linkProgram: (p) => {
      const text = p.shaders.map((x) => x.src ?? '').join('\n');
      const re = /uniform\s+(?:(?:highp|mediump|lowp)\s+)?((?:u|i)?sampler\w+)\s+([^;]+);/g;
      let m;
      while ((m = re.exec(text))) {
        for (const raw of m[2].split(',')) {
          const name = raw.trim().replace(/\[.*$/, '');
          if (name) p.samplers.push({ name, type: m[1], active: (text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length > 1 });
        }
      }
    },
    getShaderParameter: () => true, getProgramParameter: () => true, getShaderInfoLog: () => '', getProgramInfoLog: () => '',
    getUniformLocation: (p, name) => { if (!p.locs.has(name)) p.locs.set(name, { p, name }); return p.locs.get(name); },
    getAttribLocation: () => 0, getExtension: () => null, isContextLost: () => false,
    getParameter: () => new Float32Array(4), checkFramebufferStatus: () => E.FRAMEBUFFER_COMPLETE,
    isEnabled: (cap) => s.enabled.has(cap), enable: (cap) => s.enabled.add(cap), disable: (cap) => s.enabled.delete(cap),
    depthMask: (b) => { s.depthMask = !!b; },
    viewport: (x, y, w, h) => { s.viewport = [x, y, w, h]; },
    scissor: (x, y, w, h) => { s.scissor = [x, y, w, h]; },
    clearColor: (r, g, b, a) => { s.clearColor = [r, g, b, a]; },
    clear: (bits) => { s.clears.push({ bits, fb: s.drawFb, scissorOn: s.enabled.has(E.SCISSOR_TEST), depthMask: s.depthMask, viewport: [...s.viewport], color: [...s.clearColor] }); },
    useProgram: (p) => { s.prog = p; },
    uniform1i: (loc, v) => { if (loc?.p) { loc.p.units[loc.name] = v; loc.p.values[loc.name] = [v]; } },
    uniform1f: (loc, ...v) => { if (loc?.p) loc.p.values[loc.name] = v; },
    uniform2f: (loc, ...v) => { if (loc?.p) loc.p.values[loc.name] = v; },
    uniform4f: (loc, ...v) => { if (loc?.p) loc.p.values[loc.name] = v; },
    uniform4fv: (loc, v) => { if (loc?.p) loc.p.values[loc.name] = Array.from(v); },
    uniform2fv: (loc, v) => { if (loc?.p) loc.p.values[loc.name] = Array.from(v); },
    activeTexture: (u) => { s.active = u - E.TEXTURE0; },
    bindTexture: (target, tex) => { s.units[s.active][target] = tex ?? null; },
    texParameteri: (target, pname, v) => { const t = bound(target); if (t) t.params[pname] = v; },
    texImage2D: (target, level, fmt, w, h) => { const t = bound(target); if (t && level === 0) Object.assign(t, { fmt, w, h }); },
    texStorage2D: (target, levels, fmt, w, h) => { const t = bound(target); if (t) Object.assign(t, { fmt, w, h, levels }); },
    texImage3D: (target, level, fmt, w, h, d) => { const t = bound(target); if (t && level === 0) Object.assign(t, { fmt, w, h, d }); },
    texStorage3D: (target, levels, fmt, w, h, d) => { const t = bound(target); if (t) Object.assign(t, { fmt, w, h, d, levels, layers: new Set() }); },
    texSubImage3D: (target, level, x, y, z, w, h, d) => { const t = bound(target); if (t?.layers) for (let k = 0; k < d; k++) t.layers.add(z + k); },
    deleteTexture: (tex) => { if (tex) tex.deleted = true; for (const u of s.units) for (const k of Object.keys(u)) if (u[k] === tex) u[k] = null; },
    bindFramebuffer: (target, fb) => {
      if (target === E.FRAMEBUFFER || target === E.DRAW_FRAMEBUFFER) s.drawFb = fb ?? null;
      if (target === E.FRAMEBUFFER || target === E.READ_FRAMEBUFFER) s.readFb = fb ?? null;
    },
    deleteFramebuffer: (fb) => { if (fb) fb.deleted = true; if (s.drawFb === fb) s.drawFb = null; if (s.readFb === fb) s.readFb = null; },
    framebufferTexture2D: (target, att, _tt, tex) => attach(target, att, tex),
    framebufferTextureLayer: (target, att, tex) => attach(target, att, tex),
    framebufferRenderbuffer: (target, att, _rt, rb) => attach(target, att, rb),
    blitFramebuffer: (...a) => { s.blits.push({ readFb: s.readFb, drawFb: s.drawFb, args: a }); },
    drawArrays: () => draw('drawArrays'), drawElements: () => draw('drawElements'),
    drawArraysInstanced: () => draw('drawArraysInstanced'), drawElementsInstanced: () => draw('drawElementsInstanced'),
  };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in E) return E[k];
      if (k === 'drawingBufferWidth') return canvas.width;
      if (k === 'drawingBufferHeight') return canvas.height;
      if (k === 'canvas') return canvas;
      if (typeof k === 'string' && k.toUpperCase() === k) return `GL_${k}`;   // a constant this file does not use is at least distinct
      const f = impl[k];
      return (...a) => { calls.push([k, ...a]); return f ? f(...a) : undefined; };
    },
  });
  canvas.getContext = () => gl;
  return { gl, canvas, calls, errors, s };
}

/** The present's own draw - the retro program's (it owns the one uKind). */
export const presents = (s) => s.draws.filter((d) => d.prog?.locs?.has('uKind'));
export const retroCfg = (over = {}) => ({ width: 320, height: 200, hudWidth: 320, hudHeight: 154, post: 1, lutShift: 5, mipmaps: true, ...over });
export const fakeMesh = (gl) => ({ vao: gl.createVertexArray(), subMeshes: [{ textureArchive: 1, textureRecord: 1, primitiveCount: 1, startIndex: 0 }] });

/** A RetroPass's program builder over the fake GL - the sources compiled, linked and read for their samplers. */
export const programBuilder = (gl) => (vs, fs) => {
  const p = gl.createProgram();
  const a = gl.createShader(E.VERTEX_SHADER), b = gl.createShader(E.FRAGMENT_SHADER);
  gl.shaderSource(a, vs); gl.shaderSource(b, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
  return p;
};
