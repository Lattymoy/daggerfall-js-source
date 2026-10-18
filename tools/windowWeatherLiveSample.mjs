// Browser-side instrumentation for the live probe. No synthetic scene or alternate renderer.
export async function installLiveSampling() {
  const { windowWeatherFor } = await import('/src/render/windowWeather.js');
  const { fallingWeather } = await import('/src/systems/weather/weatherSim.js');
  const { buildProgram } = await import('/src/render/glProgram.js');
  const r = window.__renderer, gl = r.gl, weather = windowWeatherFor(r);
  const originalFrame = weather.frame.bind(weather), originalGlass = r.setGlassView.bind(r);
  const sample = { calls: 0, last: null, frames: [], mode: null, cut: true, mask: null, wrapperError: null };
  let latest = null, baseline = null, uncut = null, tick = 0;
  const read = () => { const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const differs = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6;
  const project = (m, p) => {
    const v = [0, 0, 0, 0];
    for (let row = 0; row < 4; row++) v[row] = m[row] * p[0] + m[row + 4] * p[1] + m[row + 8] * p[2] + m[row + 12];
    return v;
  };
  // Read the REAL pane VAOs, including static-batched GLASS-ALL walls, rather than inventing a room plane.
  const panePlanes = () => {
    const savedVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING), savedArray = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const planes = [];
    try {
      for (const pane of r._rwPanes.slice(0, r._rwPaneN)) {
        if (!gl.isVertexArray(pane.vao)) continue;
        gl.bindVertexArray(pane.vao);
        const buffer = gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        const bytes = new Uint8Array(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE));
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, bytes);
        const view = new DataView(bytes.buffer), stride = gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE) || 12;
        const offset = gl.getVertexAttribOffset(0, gl.VERTEX_ATTRIB_ARRAY_POINTER);
        const indices = new Uint32Array(pane.count);
        gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, pane.start * 4, indices);
        const vertex = (i) => project(pane.m, [0, 1, 2].map((k) => view.getFloat32(offset + i * stride + k * 4, true))).slice(0, 3);
        for (let i = 0; i < indices.length; i += 3) {
          const a = vertex(indices[i]), b = vertex(indices[i + 1]), c = vertex(indices[i + 2]);
          const u = b.map((x, k) => x - a[k]), v = c.map((x, k) => x - a[k]);
          const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const len = Math.hypot(...n); if (len < 1e-5) continue;
          for (let k = 0; k < 3; k++) n[k] /= len;
          planes.push({ normal: n, point: a, center: a.map((x, k) => (x + b[k] + c[k]) / 3), vertices: 3, count: pane.count });
        }
      }
    } finally { gl.bindVertexArray(savedVao); gl.bindBuffer(gl.ARRAY_BUFFER, savedArray); }
    return planes;
  };
  let planes = [];
  const depthDiagnostics = (draw, f) => {
    if (!draw || !gl.getExtension('EXT_color_buffer_float')) return { unavailable: 'no captured rain draw or float color attachment' };
    const t = r._rwTarget, program = draw.program;
    const uniform = (name) => gl.getUniform(program, gl.getUniformLocation(program, name));
    const uniforms = Object.fromEntries(['uStreetPV', 'uVP', 'uEye', 'uTime', 'uBox', 'uFall', 'uWindOff', 'uStreetDepthOn', 'uPaneDepthOn', 'uPaneScale'].map((n) => [n, uniform(n)]));
    if (!uniforms.uStreetDepthOn) return { disabled: true };
    const saved = { vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING), buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING), program: gl.getParameter(gl.CURRENT_PROGRAM), fbo: gl.getParameter(gl.FRAMEBUFFER_BINDING), viewport: gl.getParameter(gl.VIEWPORT) };
    gl.bindVertexArray(draw.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));
    const seeds = new Float32Array(draw.count * 4); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, seeds);
    gl.activeTexture(gl.TEXTURE0); const street = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.activeTexture(gl.TEXTURE1); const pane = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.activeTexture(gl.TEXTURE0);
    const p = buildProgram(gl, `#version 300 es
      void main() { vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0, 1); }`, `#version 300 es
      precision highp float; uniform highp sampler2D source; uniform vec2 size, scale; out vec4 o;
      void main() { o = vec4(texture(source, gl_FragCoord.xy / size * scale).rrr, 1); }`);
    const outTex = gl.createTexture(), fbo = gl.createFramebuffer(), vao = gl.createVertexArray();
    const w = t.w, h = t.h;
    const stats = (pixels) => { let min = 1, max = 0, sum = 0; for (let i = 0; i < pixels.length; i += 4) { const v = pixels[i]; min = Math.min(min, v); max = Math.max(max, v); sum += v; } return { min, max, mean: sum / (w * h) }; };
    try {
      gl.bindTexture(gl.TEXTURE_2D, outTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Depth readback float framebuffer incomplete');
      gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.useProgram(p); gl.bindVertexArray(vao); gl.uniform1i(gl.getUniformLocation(p, 'source'), 0); gl.uniform2f(gl.getUniformLocation(p, 'size'), w, h);
      const readDepth = (tex, scale) => {
        gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform2fv(gl.getUniformLocation(p, 'scale'), scale); gl.drawArrays(gl.TRIANGLES, 0, 3);
        const pixels = new Float32Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels); return pixels;
      };
      const streetPixels = readDepth(street, [1, 1]), panePixels = readDepth(pane, [w / t.allocW, h / t.allocH]);
      const drops = [];
      const fract = (v) => v - Math.floor(v), mod = (v, b) => ((v % b) + b) % b;
      for (let i = 0; i < draw.count && drops.length < 8; i++) {
        const seed = Array.from(seeds.slice(i * 4, i * 4 + 4)), gust = 0.75 + fract(seed[3] * 3.7) * 0.5;
        const world = seed.slice(0, 3); world[0] += uniforms.uWindOff[0] * gust; world[2] += uniforms.uWindOff[1] * gust;
        world[1] -= uniforms.uTime * uniforms.uFall * (0.72 + fract(seed[3] * 7.3) * 0.6);
        for (let k = 0; k < 3; k++) world[k] = mod(world[k] - uniforms.uEye[k] + uniforms.uBox * 0.5, uniforms.uBox) + uniforms.uEye[k] - uniforms.uBox * 0.5;
        const clip = project(uniforms.uStreetPV, world), uv = clip.slice(0, 2).map((x) => x / clip[3] * 0.5 + 0.5), depth = clip[2] / clip[3] * 0.5 + 0.5;
        if (clip[3] <= 0 || uv.some((x) => x < 0 || x >= 1) || depth < 0 || depth > 1) continue;
        const screen = project(uniforms.uVP, world), x = Math.floor((screen[0] / screen[3] * 0.5 + 0.5) * gl.drawingBufferWidth), y = Math.floor((screen[1] / screen[3] * 0.5 + 0.5) * gl.drawingBufferHeight);
        if (window.__wwGlassMask?.[y * gl.drawingBufferWidth + x] !== 1) continue;
        const k = (Math.floor(uv[1] * h) * w + Math.floor(uv[0] * w)) * 4;
        drops.push({ index: i, seed, world, uv, depth, streetDepth: streetPixels[k], paneDepth: panePixels[k], streetReject: depth > streetPixels[k] + 0.00001, paneReject: depth <= panePixels[k] + 0.00001 });
      }
      return { street: stats(streetPixels), pane: stats(panePixels), drops, uniforms: Object.fromEntries(Object.entries(uniforms).map(([k, v]) => [k, ArrayBuffer.isView(v) ? Array.from(v) : v])), target: { w, h, allocW: t.allocW, allocH: t.allocH, attached: t.attached, paneAttached: t.paneAttached, pv: Array.from(t.pv) }, paneN: r._rwPaneN, lane: !!r._lane, panePlanes: planes, glError: gl.getError(), scope: 'entire active cropped glass rectangle; exact depth samples at rain drop centres on the cut mask' };
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, saved.fbo); gl.viewport(...saved.viewport); gl.useProgram(saved.program); gl.bindVertexArray(saved.vao); gl.bindBuffer(gl.ARRAY_BUFFER, saved.buffer);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, street); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
      gl.deleteProgram(p); gl.deleteTexture(outTex); gl.deleteFramebuffer(fbo); gl.deleteVertexArray(vao); r.markForeignPass();
    }
  };
  const overlays = () => ({ kind: window.__overlayKind?.() ?? null, notices: [...document.querySelectorAll('.notice-in')].filter((n) => n.getBoundingClientRect().width > 0).map((n) => n.textContent.slice(0, 180)), dialogs: [...document.querySelectorAll('[role="dialog"]')].filter((n) => n.getBoundingClientRect().width > 0).length });
  const poseValidity = (f) => {
    const forward = [-f.view[2], -f.view[6], -f.view[10]];
    const visible = planes.filter((p) => {
      const delta = p.center.map((x, k) => x - f.eye[k]);
      return delta.reduce((s, x, k) => s + x * forward[k], 0) > 0;
    }).map((p) => ({ ...p, distance: Math.abs(p.point.reduce((s, x, k) => s + (x - f.eye[k]) * p.normal[k], 0)), facing: Math.abs(p.normal.reduce((s, x, k) => s + x * forward[k], 0)) }));
    const wall = visible.filter((p) => p.facing > 0.8).sort((a, b) => a.distance - b.distance)[0] ?? null;
    const overlay = overlays();
    return { valid: !!wall && wall.distance >= 1.5 && !overlay.kind && overlay.notices.length === 0 && overlay.dialogs === 0, wall, overlay };
  };
  // Toggle the renderer's own cut for mask captures; the same room geometry, pose and lane draw both frames.
  r.setGlassView = (vo) => originalGlass(sample.cut ? vo : null);
  weather.frame = (f) => {
    sample.calls++; latest = f;
    sample.last = { frame: window.__frame, eye: Array.from(f.eye), rect: f.glass?.rect, view: f.glass?.view, colliderBounds: f.collider?.bounds?.(), lane: !!r._lane, paneN: r._rwPaneN, forward: [-f.view[2], -f.view[6], -f.view[10]] };
    if (r._rwPaneN && !planes.length) { try { planes = panePlanes(); } catch (e) { sample.wrapperError = String(e.stack); } }
    const validity = poseValidity(f);
    sample.last.validity = validity;
    if (sample.mode === 'mask-cut') { baseline = read(); sample.mode = null; return; }
    if (sample.mode === 'mask-uncut') { uncut = read(); sample.mode = null; return; }
    if (sample.mode === 'mask-final') {
      const again = read(), mask = new Uint8Array(again.length / 4);
      let glass = 0, noise = 0;
      for (let i = 0, k = 0; i < again.length; i += 4, k++) {
        if (differs(baseline, again, i)) { noise++; mask[k] = 2; }
        else if (differs(baseline, uncut, i)) { mask[k] = 1; glass++; }
      }
      sample.mask = { glass, wall: mask.length - glass - noise, noise, method: 'cut vs uncut room frames at the same pose, excluding unstable cut-frame pixels' };
      window.__wwGlassMask = mask;
      sample.mode = null; return;
    }
    const active = sample.mode === 'weather';
    const before = active && tick >= 8 && validity.valid && f.glass?.view ? read() : null;
    // Repeatable weather clock and wind integration after each arm, including after the depth-off reload.
    let draw = null;
    const originalDraw = gl.drawArraysInstanced;
    if (active && sample.word === 'rain' && tick === 19) gl.drawArraysInstanced = function (...args) {
      draw = { program: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING), count: args[3] };
      return originalDraw.apply(this, args);
    };
    try { originalFrame(active ? { ...f, now: 1000 + tick++ * 100, dt: 0.1 } : f); }
    finally { gl.drawArraysInstanced = originalDraw; }
    if (before && (!sample.flash || weather.flashing)) {
      const after = read(), mask = window.__wwGlassMask;
      let glassChanged = 0, wallChanged = 0, uncertainChanged = 0;
      for (let i = 0, k = 0; i < after.length; i += 4, k++) if (differs(before, after, i)) { if (mask?.[k] === 1) glassChanged++; else if (mask?.[k] === 2) uncertainChanged++; else wallChanged++; }
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      const uniform = (name) => { const loc = gl.getUniformLocation(program, name); return loc ? gl.getUniform(program, loc) : null; };
      sample.frames.push({ frame: window.__frame, tick: tick - 1, glassChanged, wallChanged, uncertainChanged, glError: gl.getError(), flashing: weather.flashing, weather: fallingWeather(), validity,
        streetOn: uniform('uStreetDepthOn'), paneOn: uniform('uPaneDepthOn'), time: uniform('uTime'), eye: Array.from(f.eye) });
      if (sample.frames.length >= (sample.flash ? 1 : 12)) {
        if (draw) { try { sample.depthReadback = depthDiagnostics(draw, f); } catch (e) { sample.wrapperError = String(e.stack); } }
        sample.mode = null;
      }
    }
  };
  window.__wwCapture = (mode, cut = true) => { sample.cut = cut; sample.mode = mode; };
  window.__wwArmSample = (word, flash = false) => { sample.mode = 'weather'; sample.word = word; sample.flash = flash; sample.frames = []; sample.depthReadback = null; tick = 0; };
  window.__wwLiveDiagnostics = () => structuredClone({ ...sample, planes, built: weather.built });
  window.__wwResetPlanes = () => { planes = []; };
  window.__wwPoseCandidates = () => planes.flatMap((p) => [-1, 1].map((sign) => {
    const eye = p.center.map((x, k) => k === 1 ? latest.eye[1] : x + p.normal[k] * sign * 3);
    const dx = p.center[0] - eye[0], dz = p.center[2] - eye[2];
    return { pos: [eye[0], eye[1] - 1.6, eye[2]], yaw: Math.atan2(dx, dz), plane: p };
  }));
}
