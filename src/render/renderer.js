// WebGL2 renderer for world geometry. Presentation layer - ours, not DFU's
// (Port-Doctrine). Semantics it must honor from the data side:
//   - UVs can be negative or > 1 (DFU relies on REPEAT wrapping).
//   - Textures arrive from TextureFile.getColor32 already bottom-up, which is
//     GL's native texel order; upload as-is with flipY off.
//   - Indexed color means hard pixels: NEAREST filtering.
//   - Alpha 0 texels are palette-index cutouts; the shader discards them.

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec2 vUV;
out vec3 vWorldPos;
void main() {
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = uProj * uView * world;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform vec3 uLightDir;
uniform vec3 uEmissionColor;
uniform int uPointCount;
uniform vec4 uPointLights[16]; // xyz scene-space, w range
uniform vec3 uPointColor;
out vec4 outColor;
void main() {
  vec4 tex = texture(uTex, vUV);
  if (tex.a < 0.5) discard;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  vec3 lit = tex.rgb * (0.45 + 0.55 * diff);
  // Point lights (city lanterns): N.L with a squared linear falloff to the
  // range - documented equivalence to the Unity point light this replaces.
  float pointDiff = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointDiff += att * att * max(dot(n, L / max(d, 1e-4)), 0.0);
  }
  lit += tex.rgb * pointDiff * uPointColor;
  // Window emission: white mask from getWindowColors32, tinted by the
  // active window style (MaterialReader semantics: emission adds on top).
  vec3 emission = texture(uEmissionTex, vUV).rgb * uEmissionColor;
  outColor = vec4(lit + emission, 1.0);
}`;

const BB_VS = `#version 300 es
layout(location=0) in vec3 aCenter;
layout(location=1) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uOrigin;
uniform vec2 uSize;
out vec2 vUV;
void main() {
  // Bottom-anchored: centre sits half a height above the placement base.
  vec3 world = aCenter + uOrigin
    + uRight * (aCorner.x * uSize.x)
    + uUp * ((aCorner.y + 0.5) * uSize.y);
  // Textures are bottom-up (v=0 = image bottom), so the quad top
  // (aCorner.y = +0.5) samples v = 1 - matching the mesh path's negated-V
  // convention. The previous 0.5 - aCorner.y flipped every billboard.
  vUV = vec2(aCorner.x + 0.5, aCorner.y + 0.5);
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec4 tex = texture(uTex, vUV);
  if (tex.a < 0.5) discard;
  outColor = vec4(tex.rgb, 1.0);
}`;

const ZERO_ORIGIN = [0, 0, 0];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl) throw new Error('WebGL2 required');
    this.gl = gl;

    this.program = this._buildProgram(VS, FS);
    this.uProj = gl.getUniformLocation(this.program, 'uProj');
    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
    this.uTex = gl.getUniformLocation(this.program, 'uTex');
    this.uEmissionTex = gl.getUniformLocation(this.program, 'uEmissionTex');
    this.uEmissionColor = gl.getUniformLocation(this.program, 'uEmissionColor');
    this.uPointCount = gl.getUniformLocation(this.program, 'uPointCount');
    this.uPointLights = gl.getUniformLocation(this.program, 'uPointLights');
    this.uPointColor = gl.getUniformLocation(this.program, 'uPointColor');

    this.textures = new Map(); // "archive_record" -> WebGLTexture
    this.emissionTextures = new Map(); // "archive_record" -> window mask
    this._windowEmission = new Float32Array([0, 0, 0]);
    this._pointLights = new Float32Array(0); // vec4 per light [x,y,z,range]
    this._pointColor = new Float32Array([1, 1, 1]);
    // 1x1 black bound for every non-window submesh (branchless shader).
    this._blackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._blackTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    this.bbProgram = this._buildProgram(BB_VS, BB_FS);
    this.bbUProj = gl.getUniformLocation(this.bbProgram, 'uProj');
    this.bbUView = gl.getUniformLocation(this.bbProgram, 'uView');
    this.bbURight = gl.getUniformLocation(this.bbProgram, 'uRight');
    this.bbUUp = gl.getUniformLocation(this.bbProgram, 'uUp');
    this.bbUSize = gl.getUniformLocation(this.bbProgram, 'uSize');
    this.bbUOrigin = gl.getUniformLocation(this.bbProgram, 'uOrigin');
    this.bbUTex = gl.getUniformLocation(this.bbProgram, 'uTex');
    this._proj = null;
    this._view = null;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.53, 0.7, 0.92, 1.0); // pale Iliac Bay sky
  }

  _buildProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  /** Upload a getColor32 result as a REPEAT/NEAREST texture, keyed and cached. */
  uploadTexture(archive, record, color32) {
    const key = `${archive}_${record}`;
    if (this.textures.has(key)) return this.textures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color32.colors.buffer)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.textures.set(key, tex);
    return tex;
  }

  /** Build a VAO bundle from meshReader output. */
  createMesh(model) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buffers = [];
    const buf = (target, data) => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      buffers.push(b);
      return b;
    };
    buf(gl.ARRAY_BUFFER, model.positions);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    buf(gl.ARRAY_BUFFER, model.normals);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    buf(gl.ARRAY_BUFFER, model.uvs);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    buf(gl.ELEMENT_ARRAY_BUFFER, model.indices);

    gl.bindVertexArray(null);
    return { vao, subMeshes: model.subMeshes, buffers };
  }

  beginFrame(proj, view, lightDir) {
    const gl = this.gl;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform3fv(this.uLightDir, lightDir);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1i(this.uEmissionTex, 1);
    gl.uniform3fv(this.uEmissionColor, this._windowEmission);
    const count = this._pointLights.length / 4;
    gl.uniform1i(this.uPointCount, count);
    if (count > 0) gl.uniform4fv(this.uPointLights, this._pointLights);
    gl.uniform3fv(this.uPointColor, this._pointColor);
    gl.activeTexture(gl.TEXTURE0);
    this._proj = proj;
    this._view = view;
  }

  /** Active window style emission (windowEmissionRGB output). */
  setWindowEmission(rgb) {
    this._windowEmission = rgb;
  }

  /** Scene-space point lights as flat vec4s [x,y,z,range], max 16. */
  setPointLights(data, color) {
    this._pointLights = data.subarray ? data.subarray(0, 16 * 4) : data;
    if (color) this._pointColor = color;
  }

  /** Upload a getWindowColors32 mask for a window (archive, record). */
  uploadEmissionTexture(archive, record, color32) {
    const key = `${archive}_${record}`;
    if (this.emissionTextures.has(key)) return this.emissionTextures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color32.colors.buffer)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    this.emissionTextures.set(key, tex);
    return tex;
  }

  /**
   * One batch = all billboards of one (archive, record): 4 verts per flat
   * (center xyz + corner offsets in -0.5..0.5), indexed quads. Positions are
   * the billboard BASE; the shader lifts by half height (AlignToBase).
   */
  createBillboardBatch(archive, record, size, centers) {
    const gl = this.gl;
    const count = centers.length;
    const verts = new Float32Array(count * 4 * 5);
    const indices = new Uint32Array(count * 6);
    const corners = [
      [-0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
      [0.5, -0.5],
    ];
    for (let f = 0; f < count; f++) {
      const [cx, cy, cz] = centers[f];
      for (let c = 0; c < 4; c++) {
        const o = (f * 4 + c) * 5;
        verts[o] = cx;
        verts[o + 1] = cy;
        verts[o + 2] = cz;
        verts[o + 3] = corners[c][0];
        verts[o + 4] = corners[c][1];
      }
      const b = f * 4;
      const io = f * 6;
      indices[io] = b;
      indices[io + 1] = b + 2;
      indices[io + 2] = b + 1;
      indices[io + 3] = b;
      indices[io + 4] = b + 3;
      indices[io + 5] = b + 2;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    return { vao, indexCount: count * 6, archive, record, size, buffers: [vb, ib], origin: null };
  }

  /** Release a createMesh bundle's GPU resources. */
  destroyMesh(mesh) {
    const gl = this.gl;
    for (const b of mesh.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(mesh.vao);
  }

  /** Release a billboard batch's GPU resources. */
  destroyBatch(batch) {
    const gl = this.gl;
    for (const b of batch.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(batch.vao);
  }

  /** Draw billboard batches facing the camera. Call after solid geometry. */
  drawBillboards(batches, camRight, camUp) {
    const gl = this.gl;
    gl.useProgram(this.bbProgram);
    gl.uniformMatrix4fv(this.bbUProj, false, this._proj);
    gl.uniformMatrix4fv(this.bbUView, false, this._view);
    gl.uniform3fv(this.bbURight, camRight);
    gl.uniform3fv(this.bbUUp, camUp);
    gl.uniform1i(this.bbUTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.CULL_FACE);
    for (const b of batches) {
      const tex = this.textures.get(`${b.archive}_${b.record}`);
      if (!tex) continue;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(this.bbUSize, b.size.w, b.size.h);
      const o = b.origin || ZERO_ORIGIN;
      gl.uniform3f(this.bbUOrigin, o[0], o[1], o[2]);
      gl.bindVertexArray(b.vao);
      gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(this.program);
  }

  /** Draw one placed mesh: bind per-submesh texture, indexed draw per range. */
  /**
   * @param {Map<string,string>|null} texRemap - optional
   *   "archive_record" -> "archive_record" texture substitution (climate
   *   swaps; UVs stay original-archive, the SetDungeonTextures pattern).
   */
  drawMesh(mesh, modelMatrix, texRemap = null) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.uModel, false, modelMatrix);
    gl.bindVertexArray(mesh.vao);
    for (const sm of mesh.subMeshes) {
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      const resolved = texRemap && texRemap.has(key) ? texRemap.get(key) : key;
      const tex = this.textures.get(resolved);
      if (!tex) continue;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.emissionTextures.get(resolved) || this._blackTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
    }
    gl.bindVertexArray(null);
  }
}
