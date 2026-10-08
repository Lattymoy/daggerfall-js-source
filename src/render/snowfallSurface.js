// @ts-check
// SNOWFALL1 (2026-10-08): THE SNOW'S MESHES AND PICTURES ON THE GPU - the three tiers systems/snowfallRuntime.js keeps
// as arrays, uploaded as they change (a track mask by the rectangle its new pixels cover - Texture2D.SetPixel's part;
// the ring's history at most every 0.1 s, as the mod's HistoryUploadInterval), and drawn through the renderer's snow
// program (renderer.drawSnow: the ground's own light on the mod's snow). The pictures are the mod's: its albedo
// (snow_albedo.png, Point-filtered and repeated), its masks as it makes them (Bilinear, clamped; the blanket's static
// mask Point). Owned by scenes/snowfallHost.js, disposed with it.

import { SNOW_ATTR } from './snowfallGlsl.js';
import { MID, BLANKET } from '../systems/snowfallRuntime.js';

/** The generic values a tier's absent channels read: the local window has no contexts of its own (Excluded), no tier
 *  but the ring has a blanket target. */
const EXCLUDED = [-1, 0, 0, 0];
const LOCAL_GENERIC = [[SNOW_ATTR.ctxA, EXCLUDED], [SNOW_ATTR.blanket, [0, 0, 1, 0]], [SNOW_ATTR.ctxB, EXCLUDED], [SNOW_ATTR.ctxC, EXCLUDED], [SNOW_ATTR.blanketNormal, [0, 1, 0, 0]]];
const BLANKET_GENERIC = [[SNOW_ATTR.blanket, [0, 0, 1, 0]], [SNOW_ATTR.ctxB, EXCLUDED], [SNOW_ATTR.ctxC, EXCLUDED], [SNOW_ATTR.blanketNormal, [0, 1, 0, 0]]];

export class SnowfallSurface {
  /** @param {WebGL2RenderingContext} gl @param {any} renderer - render/renderer.js (drawSnow) */
  constructor(gl, renderer) {
    this.gl = gl;
    this.renderer = renderer;
    this._seam();
    this.white = this._texture(1, 1, gl.NEAREST, new Uint8Array([255, 255, 255, 255]));
    this.albedo = null;
    this.local = null;
    this.mid = null;
    this.far = null;
    /** @type {Map<any, any>} a blanket overlay's GPU half */
    this.tiles = new Map();
    this.nextHistoryUpload = 0;
    this.drawn = 0;
    this.localUploads = 0;   // UploadDynamicMask's count (snow_status)
    this._og = [0, 0, 0];
    this._box = new Float32Array(6);   // a blanket tile's bounds, local to its origin (the cull's)
  }

  /** The mod's albedo (snow_albedo.png, 64 x 64, its seven levels - m_MipCount 7): Point, repeated - the level nearest
   *  the footprint, no blend between two (FilterMode.Point; AUDIT ENVIRONS G4). `image` decoded bottom row first
   *  (scenes/snowfallHost.js: an ImageBitmap takes no UNPACK_FLIP_Y_WEBGL), so its first row is Unity's v = 0. */
  setAlbedo(image) {
    const gl = this.gl;
    this._seam();
    if (this.albedo) gl.deleteTexture(this.albedo);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.albedo = tex;
  }

  /** AUDIT ENVIRONS G1: the seam a GL user outside the renderer owes it before it binds a buffer or a picture - the 2D
   *  run the last frame left open closed (an index buffer bound under its vertex array would become that array's: the
   *  HUD's quads drew nothing after the first blanket tile), the vertex array unbound for real, every shadow forgotten
   *  (EV6). */
  _seam() {
    this.renderer?.endUiRun?.();
    this.renderer?.markForeignPass?.();
  }

  _texture(w, h, filter, data = null) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }
  /** A mask's pixels up: the whole, or the rectangle `part` names. */
  _upload(tex, res, pixels, part = { full: true }) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (part.full) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    else {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, res); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, part.x); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, part.z);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, part.x, part.z, part.w, part.h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  /** A VAO over `channels` [location, size, Float32Array], and its indices. */
  _mesh(channels, index) {
    const gl = this.gl, vao = gl.createVertexArray(), buffers = [];
    gl.bindVertexArray(vao);
    for (const [loc, size, data, shared] of channels) {
      const b = shared ?? gl.createBuffer();
      if (!shared) { buffers.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); } else gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    const ib = index.shared ?? gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    if (!index.shared) { buffers.push(ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index.data, gl.STATIC_DRAW); }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { vao, buffers, indexCount: index.count };
  }
  _rewrite(buffer, data) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); gl.bindBuffer(gl.ARRAY_BUFFER, null); }
  _dropMesh(m) { if (!m) return; const gl = this.gl; gl.deleteVertexArray(m.vao); for (const b of m.buffers) gl.deleteBuffer(b); }

  /**
   * Upload what the runtime changed since the last frame. `now` real seconds (the history's upload interval).
   * @param {any} rt - systems/snowfallRuntime.js SnowfallRuntime
   */
  sync(rt, now) {
    const gl = this.gl, L = rt.local, M = rt.mid, B = rt.blanket, F = rt.far;
    this._seam();
    // the local window - rebuilt whole when its resolution changes
    if (!this.local || this.local.res !== L.res || this.local.mres !== L.mres || this.local.sres !== L.sres || rt.dirty.gridRebuilt) {
      rt.dirty.gridRebuilt = false;
      this._dropLocal();
      const mesh = this._mesh([[SNOW_ATTR.pos, 3, L.pos], [SNOW_ATTR.normal, 3, L.nrm], [SNOW_ATTR.uv, 2, L.uv]], { data: L.index, count: L.index.length });
      this.local = { res: L.res, mres: L.mres, sres: L.sres, mesh: { ...mesh, generic: LOCAL_GENERIC },
        dynamic: this._texture(L.mres, L.mres, gl.LINEAR, L.dynamic), statics: this._texture(L.sres, L.sres, gl.LINEAR, L.statics), context: this._texture(L.sres, L.sres, gl.LINEAR, L.context) };
      rt.dirty.localMesh = false; rt.dirty.localStatic = false; rt.rects.local.take();
    }
    if (rt.dirty.localMesh) { rt.dirty.localMesh = false; this._rewrite(this.local.mesh.buffers[0], L.pos); this._rewrite(this.local.mesh.buffers[1], L.nrm); }
    if (rt.dirty.localStatic) { rt.dirty.localStatic = false; this._upload(this.local.statics, L.sres, L.statics); this._upload(this.local.context, L.sres, L.context); }
    const lp = rt.rects.local.take();
    if (lp) { this._upload(this.local.dynamic, L.mres, L.dynamic, lp); this.localUploads++; }
    // the middle ring
    if (!this.mid) {
      const mesh = this._mesh([[SNOW_ATTR.pos, 3, M.pos], [SNOW_ATTR.normal, 3, M.nrm], [SNOW_ATTR.uv, 2, M.uv], [SNOW_ATTR.ctxA, 4, M.ctxA], [SNOW_ATTR.blanket, 4, M.heights],
        [SNOW_ATTR.ctxB, 4, M.ctxB], [SNOW_ATTR.ctxC, 4, M.ctxC], [SNOW_ATTR.blanketNormal, 3, M.bnrm]], { data: M.index, count: M.index.length });
      this.mid = { mesh, history: this._texture(MID.history, MID.history, gl.LINEAR, M.history), statics: this._texture(MID.staticRes, MID.staticRes, gl.LINEAR), context: this._texture(MID.staticRes, MID.staticRes, gl.LINEAR) };
    }
    if (rt.dirty.mid) {
      rt.dirty.mid = false;
      const b = this.mid.mesh.buffers;
      for (const [i, data] of [M.pos, M.nrm, M.uv, M.ctxA, M.heights, M.ctxB, M.ctxC, M.bnrm].entries()) if (i !== 2) this._rewrite(b[i], data);
      this._upload(this.mid.statics, MID.staticRes, M.statics); this._upload(this.mid.context, MID.staticRes, M.context);
      this._upload(this.mid.history, MID.history, M.history); rt.rects.mid.take();
    }
    if (rt.rects.mid.full || now >= this.nextHistoryUpload) {
      const mp = rt.rects.mid.take();
      if (mp) { this._upload(this.mid.history, MID.history, M.history, mp); this.nextHistoryUpload = now + MID.historyUpload; }
    }
    // the far track mask
    if (!this.far) this.far = this._texture(641, 641, gl.LINEAR, F.pixels);
    const fp = rt.rects.far.take();
    if (fp) this._upload(this.far, 641, F.pixels, fp);
    // the blanket's tiles
    for (const o of rt.dirty.blanket) {
      let g = this.tiles.get(o);
      if (o.dead) { if (g) { this._dropMesh(g.mesh); gl.deleteTexture(g.statics); this.tiles.delete(o); } continue; }
      if (!g) {
        this._blanketShared ??= this._sharedBlanket(B);
        const mesh = this._mesh([[SNOW_ATTR.pos, 3, o.pos], [SNOW_ATTR.normal, 3, o.nrm], [SNOW_ATTR.uv, 2, null, this._blanketShared.uv], [SNOW_ATTR.ctxA, 4, o.ctx]],
          { shared: this._blanketShared.index, count: B.index.length });
        g = { mesh: { ...mesh, generic: BLANKET_GENERIC }, statics: this._texture(BLANKET.staticRes, BLANKET.staticRes, gl.NEAREST, o.statics) };
        this.tiles.set(o, g);
      } else {
        this._rewrite(g.mesh.buffers[0], o.pos); this._rewrite(g.mesh.buffers[1], o.nrm); this._rewrite(g.mesh.buffers[2], o.ctx);
        this._upload(g.statics, BLANKET.staticRes, o.statics);
      }
    }
    rt.dirty.blanket.clear();
  }
  _sharedBlanket(B) {
    const gl = this.gl, uv = gl.createBuffer(), index = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, B.uv, gl.STATIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, B.index, gl.STATIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return { uv, index };
  }

  /**
   * Draw the tiers the runtime stands this frame, nearest first. Answers whether any was drawn (the host marks the
   * seam on it). `outside(box, x, y, z)` (or null: none culled) answers whether a box at a place is outside the
   * frame's frustum - each blanket tile is its own renderer in the mod, culled by its bounds (AUDIT ENVIRONS G6).
   * @param {any} rt
   * @param {((box: Float32Array, x: number, y: number, z: number) => boolean)|null} [outside]
   */
  draw(rt, outside = null) {
    this.drawn = 0;
    if (!this.albedo || !this.local) return false;
    const R = this.renderer, tiers = rt.visibleTiers(), depth = rt.depthUniforms();
    const distant = tiers.far;
    const farTex = distant ? this.far : this.white;
    if (tiers.local) {
      R.drawSnow(this.local.mesh, { ...rt.localUniforms(), ...depth }, { dynamic: this.local.dynamic, static: this.local.statics, context: this.local.context, far: this.white, albedo: this.albedo });
      this.drawn++;
    }
    if (tiers.mid && this.mid) {
      R.drawSnow(this.mid.mesh, { ...rt.midUniforms(), ...depth }, { dynamic: this.mid.history, static: this.mid.statics, context: this.mid.context, far: farTex, albedo: this.albedo });
      this.drawn++;
    }
    if (tiers.blanket) {
      const rise = outside ? rt.blanketRise() : 0, box = this._box;
      for (const [o, g] of this.tiles) {
        if (!o.ready || !rt.blanket.live.has(o.t)) continue;
        if (outside) {
          const og = o.t.origin(this._og);
          box[0] = 0; box[1] = o.minY; box[2] = 0; box[3] = o.t.size; box[4] = o.maxY + rise; box[5] = o.t.size;
          if (outside(box, og[0], og[1], og[2])) continue;
        }
        R.drawSnow(g.mesh, { ...rt.blanketUniforms(o, distant), ...depth }, { dynamic: distant ? this.far : this.white, static: g.statics, context: this.white, far: this.white, albedo: this.albedo });
        this.drawn++;
      }
    }
    return this.drawn > 0;
  }

  _dropLocal() {
    if (!this.local) return;
    const gl = this.gl;
    this._dropMesh(this.local.mesh);
    for (const t of [this.local.dynamic, this.local.statics, this.local.context]) gl.deleteTexture(t);
    this.local = null;
  }
  dispose() {
    const gl = this.gl;
    this._dropLocal();
    if (this.mid) { this._dropMesh(this.mid.mesh); for (const t of [this.mid.history, this.mid.statics, this.mid.context]) gl.deleteTexture(t); this.mid = null; }
    for (const g of this.tiles.values()) { this._dropMesh(g.mesh); gl.deleteTexture(g.statics); }
    this.tiles.clear();
    if (this._blanketShared) { gl.deleteBuffer(this._blanketShared.uv); gl.deleteBuffer(this._blanketShared.index); this._blanketShared = null; }
    for (const t of [this.far, this.albedo, this.white]) if (t) gl.deleteTexture(t);
    this.far = this.albedo = this.white = null;
  }
}
