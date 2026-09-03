// ═══════════════════════════════════════════════════════════════════
// TR1 — the trees: our partner's meshes, wearing the player's own
// sprite, moving in the sky's wind.
//
// TR6 (2026-09-03, Mac: "add the trees back from the revert and properly
// integrate them with no rushing") — THE INTEGRATION, REBUILT. Reading
// the host's draw loop beside this file found four faults, each of which
// alone hid every tree in the game, and none of which the probe could
// see because its harness was not the host:
//
//   1. THE FLAT'S SIZE IS AN OBJECT. scaledBillboardSize answers {w, h};
//      the host read `size[1]` - undefined - so every base was NaN and
//      the scale was NaN. No tree ever had a position.
//   2. THE INSTANCES WERE PIXEL-LOCAL, DRAWN AS WORLD. The streaming world
//      keeps every pixel's content in its own frame and hands the flat
//      batches the pixel's translation each frame (`b.origin = t`, under
//      the floating origin's compensation). The tree shader took aInst as
//      world, so every pixel's trees stood on the ORIGIN pixel, and moved
//      with each recentre. `uOrigin` now, per batch, per frame.
//   3. ONE BATCH PER RECORD, FOR THE WHOLE WORLD. build() keyed on
//      archive_record and disposed the previous batch first, so a
//      neighbouring pixel with the same record REPLACED the player's
//      pixel's trees with its own, and a pixel leaving disposed the key
//      and took every other pixel's trees of that record with it. The
//      GEOMETRY is per record and shared; the INSTANCES are per pixel,
//      keyed `${pixelKey}|${archive}_${record}`, freed with their pixel.
//   4. THE PIXEL BUFFERS WORE THE WRONG NAMES. getColor32 answers
//      {colors, width, height}; the crown-top read `.data` - undefined,
//      so every alpha read as 0 and the raster came out empty - and the
//      raster it returned carried `.data`, which uploadTexture (reading
//      `.colors`) could not upload, so the try/catch dropped every top.
//      Both ends speak `colors` now, the shape the pipeline speaks.
//
// The gust travels on WORLD-FIXED coordinates (uGustOrigin: the pixel's
// grid translation without the compensation), so a recentre does not
// twitch every crown, and a gust crosses a pixel border as one wave.
//
// A tree here is a mesh of leaf-cards from public/trees/<archive>.json
// (tools/treesConvert.mjs), drawn INSTANCED at every position the flat
// stood, sampling the record's own texture - the very upload the
// billboard path makes (dataPipeline.uploadRecord). The mesh's UVs are
// on the sprite's OPAQUE box; the record has transparent margins the
// converter could not see, so uploadRecord's bitmap is measured once
// for its opaque box and the shader maps between the two.
//
// ── PARITY WITH THE FLAT IT REPLACES ─────────────────────────────
//
// The mesh is scaled so its height is the billboard's height
// (scaledBillboardSize, the record's own scale byte) and its base sits
// where the flat's bottom edge sat, so a switch from flat to mesh
// changes what a tree IS and not how big it is or where. The fragment
// law is the billboard's, taken from BB_FS: the time-of-day tint, the
// point-light loop, the indirect term, the fog, and the 0.5 cutout.
//
// ── THE WIND IS THE GRASS'S ──────────────────────────────────────
//
// labGrass.js's lean, term for term: the wind VECTOR (uWindV), a gust
// that travels across the field as a wave whose phase carries the
// tree's position along the wind, so a gust is one thing moving
// through the wood rather than every tree wobbling alone. The lean is
// weighted by the square of the height above the base - trunks stand,
// crowns sway - and a per-tree phase off its position keeps twins from
// swaying in step. TREE_LEAN is the one number that is ours: a trunk
// bends far less than a blade.
//
// ── NEVER TRAPS ──────────────────────────────────────────────────
//
// No JSON for an archive, no model for a record, a record that fails
// to upload, a fetch that fails: the flat stays a billboard. The host
// asks `modelFor(archive, record)` and gets null for every one of
// those, and null means "draw it as you always did".
// ═══════════════════════════════════════════════════════════════════

/** How far a crown leans per unit of wind.
 *
 *  CALIBRATED TO THE SKY'S OWN RANGE, not to the grass's 0.055. The
 *  sky's wind vector runs 0.0046..0.0308 (wind.js WIND_ROW_CALM +
 *  strength * WIND_ROW_SPAN); labWindSlider makes that 30..200, and the
 *  host's windV is the slider * 0.16, so |windV| is 4.8 calm, ~11 on a
 *  sunny day, 32 in a storm - and push is 0.55..1.3 of it with the
 *  gust. The lean in world units is push * TREE_LEAN * height, so at
 *  0.018 a 16 m crown moved 2.9 m on a sunny day and 12 m in a storm:
 *  a forest in permanent collapse, found by the probe at TR4 when its
 *  own wind was driven ten times too gently to notice. 0.003 puts a
 *  sunny day at half a metre and a storm at two - a crown that sways,
 *  a trunk that stands. */
export const TREE_LEAN = 0.003;

/** Cards whose normal is this close to vertical are crown-tops: views
 *  Daggerfall never drew. TR2 synthesises them from the sprite. */
export const TOP_VIEW_DOT = 0.7;

// ── TR2: THE CROWN FROM ABOVE ──────────────────────────────────────
//
// A horizontal card is what a crown looks like from underneath - from
// the ground, looking up - and Daggerfall drew no such view. Our
// partner painted one per record into the atlas: the side sprite's
// crown, turned four times about its own centre into a pinwheel. That
// picture is game data by the doctrine (it is the sprite, rotated), so
// it is not shipped; it is REMADE here, at runtime, from the record the
// player supplied, by the same construction. The tree's crown from
// above is the tree's own crown, four ways.
//
// The crown is the sprite above the trunk. The trunk is found by
// width: scanning up from the bottom of the opaque box, the first row
// at least CROWN_WIDTH_FRACTION as wide as the widest row is where the
// crown begins. A bush with no trunk is all crown.

export const CROWN_WIDTH_FRACTION = 0.45;
export const CROWN_TURNS = 4;
export const CROWN_MAX_SIZE = 256;

/**
 * Synthesise the crown-top raster from a record's RGBA (getColor32's
 * { colors, width, height }) and its opaque box. Returns
 * { width, height, colors: Uint8ClampedArray } - the shape uploadTexture
 * takes - or null for a record with nothing opaque.
 * Pure, and pinned: four-fold symmetric, alpha where the crown is.
 */
export function synthesizeCrownTop(color32, box) {
  if (!box) return null;
  // TR6: getColor32's shape - `colors`, RGBA bytes - in and out
  const W = color32.width, H = color32.height, src = color32.colors;
  if (!src) return null;
  const x0 = Math.round(box[0] * W), y0 = Math.round(box[1] * H);
  const x1 = Math.round(box[2] * W), y1 = Math.round(box[3] * H);
  const bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return null;
  // the crown's first row, by width
  const widths = new Int32Array(bh);
  let maxW = 0;
  for (let y = 0; y < bh; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < bw; x++) {
      if (src[((y0 + y) * W + x0 + x) * 4 + 3] < 128) continue;
      if (l < 0) l = x; r = x;
    }
    widths[y] = l < 0 ? 0 : r - l + 1;
    if (widths[y] > maxW) maxW = widths[y];
  }
  let crownEnd = bh;                                        // exclusive row, from the top
  for (let y = bh - 1; y >= 0; y--) { if (widths[y] >= maxW * CROWN_WIDTH_FRACTION) { crownEnd = y + 1; break; } }
  const ch = Math.max(1, crownEnd);
  // the pinwheel: the crown turned CROWN_TURNS times about its centre
  const S = Math.min(CROWN_MAX_SIZE, Math.max(bw, ch) + 2);
  const out = new Uint8ClampedArray(S * S * 4);
  const cx = bw / 2, cy = ch / 2, ox = S / 2, oy = S / 2;
  const scale = (S - 2) / Math.max(bw, ch);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const dx = (px + 0.5 - ox) / scale, dy = (py + 0.5 - oy) / scale;
      let best = 0, o = (py * S + px) * 4;
      for (let k = 0; k < CROWN_TURNS; k++) {
        const a = (k * Math.PI * 2) / CROWN_TURNS, c = Math.cos(a), sn = Math.sin(a);
        const sx = Math.floor(cx + dx * c - dy * sn), sy = Math.floor(cy + dx * sn + dy * c);
        if (sx < 0 || sy < 0 || sx >= bw || sy >= ch) continue;
        const si = ((y0 + sy) * W + x0 + sx) * 4;
        const al = src[si + 3];
        if (al > best) { best = al; out[o] = src[si]; out[o + 1] = src[si + 1]; out[o + 2] = src[si + 2]; out[o + 3] = al; }
      }
    }
  }
  return { width: S, height: S, colors: out };   // TR6: the shape uploadTexture takes
}

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;      // model space, y up, metres
layout(location=1) in vec2 aUV;       // on the sprite's OPAQUE box
layout(location=2) in vec4 aInst;     // xyz PIXEL-LOCAL base, w phase
uniform mat4 uProj, uView;
uniform vec3 uOrigin;                 // TR6: the pixel's translation this frame (with the floating origin's compensation)
uniform vec2 uGustOrigin;             // TR6: the pixel's grid translation WITHOUT the compensation - world-fixed, for the gust's wave
uniform float uScale, uBase, uHeight; // model -> world height match, model base y, model height
uniform float uTime;
uniform vec2 uWindV;
uniform vec4 uBox;                    // opaque box on the record: u0 v0 u1 v1
out vec2 vUV;
out vec3 vWorld;
void main() {
  float t = clamp((aPos.y - uBase) / max(uHeight, 1e-3), 0.0, 1.0);
  vec3 base = aInst.xyz + uOrigin;
  vec3 p = base + vec3(aPos.x, aPos.y - uBase, aPos.z) * uScale;
  // the grass's lean, term for term (labGrass.js), weighted t^2
  vec2 wdir = length(uWindV) > 1e-4 ? normalize(uWindV) : vec2(1.0, 0.0);
  float along = dot(aInst.xz + uGustOrigin, wdir);
  float gust = sin(uTime*1.7 - along*0.35 + aInst.w*0.6) * 0.5 + 0.5;
  float push = length(uWindV) * (0.55 + gust * 0.75);
  p.xz += wdir * push * ${TREE_LEAN.toFixed(4)} * t * t * uHeight * uScale;
  vWorld = p;
  vUV = vec2(mix(uBox.x, uBox.z, aUV.x), mix(uBox.y, uBox.w, aUV.y));
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;
/** BB_FS's law for an opaque flat, minus the spectral and emission arms
 *  a tree does not have. */
const FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorld;
uniform sampler2D uTex;
uniform vec3 uTint;
uniform int uPointCount;
uniform vec4 uPointLights[16];
uniform vec3 uPointColors[16];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  return exp(-uFogDensity * d);
}
void main() {
  vec4 tex = texture(uTex, vUV);
  if (tex.a < 0.5) discard;
  vec3 pointAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    float d = length(uPointLights[i].xyz - vWorld);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointAcc += att * att * uPointColors[i];
  }
  vec3 ind = vec3(0.0);
  if (uIndirect.w > 0.0) {
    float d = length(uIndirect.xyz - vWorld);
    float att = clamp(1.0 - d / uIndirect.w, 0.0, 1.0);
    ind = att * att * uIndirectColor;
  }
  vec3 lit = tex.rgb * (uTint + pointAcc + ind);
  float f = fogFactorAt(vWorld);
  outColor = vec4(mix(uFogColor, lit, f), 1.0);
}`;

/**
 * The opaque box of a record's bitmap, as UV on its full texture.
 * Measured once per record from the same DFBitmap uploadRecord
 * uploads - index 0 is the transparent palette entry, so the box is
 * the rows and columns holding any other index.
 * Pure, and pinned.
 */
export function opaqueBox(bitmap) {
  const { width: w, height: h, data } = bitmap;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] === 0) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;                                  // a fully transparent record
  return [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h];
}

/** A deterministic phase in 0..2pi from a world position, so a tree's
 *  sway is the same every visit and its twin's differs. */
export function phaseAt(x, z) {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * Math.PI * 2;
}

/**
 * Split a converted record into the vertex stream TR1 draws: side cards
 * only. Returns { verts: Float32Array(n*5), count } or null when the
 * record has no side cards.
 */
export function sideStream(rec) {
  const pos = rec.side?.pos ?? [], uv = rec.side?.uv ?? [];
  const n = pos.length / 3;
  if (!n) return null;
  const verts = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    verts[i * 5] = pos[i * 3]; verts[i * 5 + 1] = pos[i * 3 + 1]; verts[i * 5 + 2] = pos[i * 3 + 2];
    verts[i * 5 + 3] = uv[i * 2]; verts[i * 5 + 4] = uv[i * 2 + 1];
  }
  return { verts, count: n };
}

/** The crown-top cards' vertex stream, or null when there are none. */
export function topStream(rec) {
  const pos = rec.top?.pos ?? [], uv = rec.top?.uv ?? [];
  const n = pos.length / 3;
  if (!n) return null;
  const verts = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    verts[i * 5] = pos[i * 3]; verts[i * 5 + 1] = pos[i * 3 + 1]; verts[i * 5 + 2] = pos[i * 3 + 2];
    verts[i * 5 + 3] = uv[i * 2]; verts[i * 5 + 4] = uv[i * 2 + 1];
  }
  return { verts, count: n };
}

/** The mesh's scale so its height equals the billboard's. */
export function scaleFor(rec, billboardHeight) {
  return rec.height > 1e-3 ? billboardHeight / rec.height : 1;
}

/**
 * Where an archive's models live, from the page that wants them.
 *
 * Vite copies public/ to the build's ROOT, and the game page sits one
 * directory down at /play/ - so a relative 'trees/500.json' from the
 * page asks for /play/trees/500.json, which is a 404 in production
 * (TR5: Mac saw no trees; every load answered null and every flat
 * stayed a billboard). The site root is the page's path with its
 * trailing /play/ removed, which also holds under a project-pages
 * prefix and for a probe page served at the root.
 * Pure, and pinned on the production shapes.
 */
export function treesUrl(archive, base = globalThis.document?.baseURI ?? 'http://localhost/') {
  const u = new URL(base);
  u.pathname = u.pathname.replace(/\/play\/[^/]*$/, '/');
  u.search = ''; u.hash = '';
  return new URL(`trees/${archive}.json`, u).href;
}

export class TreeModelRenderer {
  constructor(gl) {
    this.gl = gl;
    this.prog = build(gl, VS, FS);
    const u = (n) => gl.getUniformLocation(this.prog, n);
    this.u = {
      proj: u('uProj'), view: u('uView'), origin: u('uOrigin'), gustOrigin: u('uGustOrigin'),
      scale: u('uScale'), base: u('uBase'), height: u('uHeight'),
      time: u('uTime'), windV: u('uWindV'), box: u('uBox'), tex: u('uTex'), tint: u('uTint'),
      pointCount: u('uPointCount'), pointLights: u('uPointLights'), pointColors: u('uPointColors'),
      indirect: u('uIndirect'), indirectColor: u('uIndirectColor'),
      fogColor: u('uFogColor'), fogMode: u('uFogMode'), fogDensity: u('uFogDensity'), fogRange: u('uFogRange'), camPos: u('uCamPos'),
    };
    /** TR6: the GEOMETRY, per record and shared by every pixel:
     *  `${archive}_${record}` -> { key, archive, record, rec, vbo, count, top: { vbo, count } | null, topKey, box, scale } */
    this.geometry = new Map();
    /** TR6: the INSTANCES, per pixel and record: `${pixelKey}|${archive}_${record}` -> batch */
    this.batches = new Map();
    this.byPixel = new Map();    // pixelKey -> Set of batch keys, for disposePixel
    this.archives = new Map();   // archive -> parsed json | null (null = none, never ask again)
    this.count = 0;              // instances drawn last frame, for the probe
    this._sorted = [];           // draw's scratch
  }

  /** Load an archive's models once. Resolves to the json or null. */
  async load(archive, fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null))) {
    if (this.archives.has(archive)) return this.archives.get(archive);
    let json = null;
    try { json = await fetchJson(treesUrl(archive)); } catch { json = null; }
    this.archives.set(archive, json && json.records ? json : null);
    return this.archives.get(archive);
  }

  /** The converted record, or null: no archive, no model, no side cards. */
  modelFor(archive, record) {
    const a = this.archives.get(archive);
    const rec = a?.records?.[record];
    return rec && rec.side?.pos?.length ? rec : null;
  }

  /**
   * TR6: the record's geometry - the side cards' buffer, the crown-top's
   * buffer and raster, the opaque box and the height match - made ONCE
   * and shared by every pixel that stands this record. `bitmap` is the
   * record's DFBitmap (the opaque box), `color32` its RGBA and `upload`
   * the pipeline's texture upload (the crown-top, TR2). Returns the
   * geometry or null when there is nothing to draw.
   */
  geometryFor(archive, record, rec, billboardHeight, bitmap, { color32 = null, upload = null } = {}) {
    const key = `${archive}_${record}`;
    const have = this.geometry.get(key);
    if (have) return have;
    const gl = this.gl;
    const stream = sideStream(rec);
    const box = bitmap ? opaqueBox(bitmap) : [0, 0, 1, 1];
    if (!stream || !box) return null;
    const vboFor = (verts) => {
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      return vbo;
    };
    const vbo = vboFor(stream.verts);
    // TR2: the crown-top cards, in a texture remade from the record.
    // Any failure here costs the tops, never the tree.
    let top = null, topKey = null;
    const ts = topStream(rec);
    if (ts && color32 && upload) {
      try {
        const raster = synthesizeCrownTop(color32, box);
        if (raster) { topKey = `${record}#top`; upload(topKey, raster); top = { vbo: vboFor(ts.verts), count: ts.count }; }
      } catch (e) { top = null; topKey = null; console.warn('[trees] no crown top:', key, e?.message ?? e); }
    }
    const geom = {
      key, archive, record, rec, vbo, count: stream.count, top, topKey: topKey ? `${archive}_${topKey}` : null,
      box, scale: scaleFor(rec, billboardHeight),
    };
    this.geometry.set(key, geom);
    return geom;
  }

  /**
   * TR6: the instances of one record in one pixel. `pixelKey` is the
   * host's `${px},${py}`; `bases` are the flats' bottom centres in the
   * PIXEL'S frame (the host adds the translation at draw); the rest is
   * geometryFor's. Returns the batch, or null if there is nothing to draw.
   */
  build(pixelKey, archive, record, rec, bases, billboardHeight, bitmap, opts = {}) {
    if (!bases.length) return null;
    const geom = this.geometryFor(archive, record, rec, billboardHeight, bitmap, opts);
    if (!geom) return null;
    const gl = this.gl;
    const key = `${pixelKey}|${geom.key}`;
    this.dispose(key);
    const inst = new Float32Array(bases.length * 4);
    for (let i = 0; i < bases.length; i++) {
      const [x, y, z] = bases[i];
      inst[i * 4] = x; inst[i * 4 + 1] = y; inst[i * 4 + 2] = z; inst[i * 4 + 3] = phaseAt(x, z);
    }
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    const vaoFor = (vbo) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      gl.bindBuffer(gl.ARRAY_BUFFER, ibo);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
      return vao;
    };
    const batch = {
      key, pixelKey, geom, ibo, vao: vaoFor(geom.vbo), topVao: geom.top ? vaoFor(geom.top.vbo) : null,
      instances: bases.length,
      origin: null,          // the host sets the pixel's translation each frame it draws the batch
      gustOrigin: null,      // ...and the grid translation without the compensation
      _box: null,            // the host's EV3 bounds, pixel-local, like a flat batch's
    };
    this.batches.set(key, batch);
    if (!this.byPixel.has(pixelKey)) this.byPixel.set(pixelKey, new Set());
    this.byPixel.get(pixelKey).add(key);
    return batch;
  }

  /** Free one batch's instances. The record's geometry stays for the next pixel. */
  dispose(key) {
    const b = this.batches.get(key);
    if (!b) return;
    const gl = this.gl;
    gl.deleteVertexArray(b.vao); if (b.topVao) gl.deleteVertexArray(b.topVao); gl.deleteBuffer(b.ibo);
    this.batches.delete(key);
    this.byPixel.get(b.pixelKey)?.delete(key);
  }

  /** TR6: a pixel leaving frees its trees and nothing else's. */
  disposePixel(pixelKey) {
    const keys = this.byPixel.get(pixelKey);
    if (!keys) return;
    for (const k of [...keys]) this.dispose(k);
    this.byPixel.delete(pixelKey);
  }

  /**
   * Draw the batches the host found visible this frame, each carrying its
   * pixel's `origin` and `gustOrigin`. `r` is the renderer, for the textures
   * and the scene state the billboard draw reads (tint, lights, fog); `wind`
   * is the object the grass draw receives. Grouped by record so a texture
   * binds once per record.
   */
  draw(r, proj, view, timeSeconds, wind, tint, batches) {
    const gl = this.gl, u = this.u;
    const list = this._sorted; list.length = 0;
    for (const b of batches) if (b.origin) list.push(b);
    if (!list.length) { this.count = 0; return; }
    list.sort((a, b) => (a.geom.key < b.geom.key ? -1 : a.geom.key > b.geom.key ? 1 : 0));
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(u.proj, false, proj);
    gl.uniformMatrix4fv(u.view, false, view);
    gl.uniform1f(u.time, timeSeconds);
    gl.uniform2f(u.windV, wind?.windV?.[0] ?? 0, wind?.windV?.[1] ?? 0);
    gl.uniform3fv(u.tint, tint);
    const n = r._pointLights.length >> 2;
    gl.uniform1i(u.pointCount, n);
    if (n > 0) { gl.uniform4fv(u.pointLights, r._pointLights); gl.uniform3fv(u.pointColors, r._pointColorData(n)); }
    gl.uniform4fv(u.indirect, r._indirect);
    gl.uniform3fv(u.indirectColor, r._indirectColor);
    gl.uniform3fv(u.fogColor, r._fogColor); gl.uniform1i(u.fogMode, r._fogMode);
    gl.uniform1f(u.fogDensity, r._fogDensity); gl.uniform2fv(u.fogRange, r._fogRange);
    gl.uniform3fv(u.camPos, r._camPos);
    gl.uniform1i(u.tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    // a tree is opaque geometry in the world's depth: tested and written,
    // like a mesh, whatever the pass before left behind
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);           // a leaf-card is seen from both sides
    // one RUN per record: the sides of every pixel in the record's texture,
    // then the tops of every pixel in the crown raster - two binds a record
    // however many pixels stand it
    let drawn = 0;
    const perBatch = (b) => {
      gl.uniform3fv(u.origin, b.origin);
      gl.uniform2f(u.gustOrigin, b.gustOrigin?.[0] ?? 0, b.gustOrigin?.[1] ?? 0);
    };
    for (let i = 0; i < list.length;) {
      const g = list[i].geom;
      let j = i; while (j < list.length && list[j].geom === g) j++;
      const tex = r.textures.get(g.key) ?? null;
      if (tex) {                        // never traps: no upload, no tree this frame
        gl.uniform1f(u.scale, g.scale); gl.uniform1f(u.base, g.rec.base); gl.uniform1f(u.height, g.rec.height);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform4fv(u.box, g.box);
        for (let k = i; k < j; k++) {
          const b = list[k];
          perBatch(b);
          gl.bindVertexArray(b.vao);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, g.count, b.instances);
          drawn += b.instances;
        }
        // TR2: the crown-tops, in the synthesised raster (a whole texture,
        // so the box is the unit square)
        const topTex = g.top && g.topKey ? r.textures.get(g.topKey) ?? null : null;
        if (topTex) {
          gl.bindTexture(gl.TEXTURE_2D, topTex);
          gl.uniform4f(u.box, 0, 0, 1, 1);
          for (let k = i; k < j; k++) {
            const b = list[k];
            if (!b.topVao) continue;
            perBatch(b);
            gl.bindVertexArray(b.topVao);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, g.top.count, b.instances);
          }
        }
      }
      i = j;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    this.count = drawn;
  }
}

function build(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('trees shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('trees program: ' + gl.getProgramInfoLog(p));
  return p;
}
