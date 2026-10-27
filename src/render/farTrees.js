// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-TREES (2026-10-26, the owner: "on top of distant view, no flora/trees show ... No band aids for any of this"; the
// coordinator: the billboard band from the game's own tree art, the tree line at the grid's edge gone;
// bible/06-Systems/Travel-View.md FAR-TREES): THE BAND - THE NEAR TREES CARRIED PAST THE STREAMED GRID.
//
// WHAT IT IS. The streamed grid stands every Tree of its pixels (world/terrain/terrainNature.js layoutNature; past its
// two nearest rings only the tall flats draw, world/flatDistance.js - every Tree), out to its edge, and past it stood the
// far views' canopy alone (render/farFlora.js): a line where the trees stopped. The band is the next ring of pixels past
// the grid, and every pixel of the grid the stream has not built yet, standing THE SAME TREES: each pixel's own layout run
// on the terrain worker (world/terrain/floraCover.js bandTreesPixel - its kernel, its tiles, the nature's own dice), so a
// tree of the band stands where the built pixel's will, with its record and its size. Where the stream builds the pixel,
// its ground (and its own flats) cover the band's by depth - the band is drawn in the far ring's pass, at the far plane,
// which shows only where nothing nearer drew - so the hand-off moves nothing. Over the band's outer half its trees are
// dithered out (BAND_FADE, a hash a tree) onto the canopy, whose colour is theirs.
//
// HOW IT IS DRAWN. One draw of points: a tree is a screen-square sprite the side of its billboard's larger extent
// (projected, in pixels), its picture the record's own - the climate's Tree art (a replacement's where one is decoded,
// else the classic record: farFlora.js pipelinePictures) laid bottom-centred into a layer of one array texture
// (TREE_LAYER texels square, mipmapped) - cut out at the flats' own 0.5, lit as a flat is (renderer.js BB_FS: the ambient
// and half the moon, half the sun under the clouds' shadow), hazed as the far ring is. A tree under a pixel is drawn by its
// share of one (a hash against its area), so a far wood keeps its coverage, never a blot of one-pixel points.
//
// THE COST. Its trees are the near law's own count (some 3,900 a pixel on the synthetic world): Land View 5's band ring of
// 48 pixels some 190,000 points, 16 bytes each (3 MB); one draw. On the worker some 40 ms a pixel, kept by the pixel; on
// this thread the instances are interleaved a pixel a step (the far ring's HORIZON_BUDGET_MS) into a second buffer, which
// is uploaded a slice a step and swapped in whole, so the frame never waits on it.
// ═══════════════════════════════════════════════════════════════════

import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { TREE_RECORDS } from '../world/terrain/terrainNature.js';
import { getWorldClimateSettings } from '../formats/mapsFile.js';
import { buildProgram } from './glProgram.js';
import { RING_CLOUD_GLSL } from './cloudShadow.js';
import { HORIZON_HAZE_GLSL, FLORA_LIGHT_GLSL } from './horizonHaze.js';
import { RING_HAZE_GLSL } from './hazeGlsl.js';
import { EL_GLSL } from './enhancedLighting.js';
import { BAYER_MEAN } from './orderedDither.js';
import { classicLook } from './classicShadowLane.js';
import { pipelinePictures } from './farFlora.js';

/** The band's reach past the streamed grid's radius (map pixels, Chebyshev from the traveller's pixel). */
export const BAND_RING = 1;
/** Where the band's trees dither out onto the canopy (and the canopy comes in under them): from `0` to `1` pixels past the
 *  grid's radius, Chebyshev from the centre of the pixel the band was laid round - the band ring whole, from the grid's
 *  edge to inside its own (the ring spans radius + 0.5 to radius + 1.5 from that centre). */
export const BAND_FADE = Object.freeze([0.5, 1.45]);
/** An atlas layer's side (texels) and the layers it holds. */
export const TREE_LAYER = 64;
export const TREE_LAYERS = 48;
/** The texture unit the atlas rides for the pass (inside the host's sky-to-markForeignPass span: render/farRing.js
 *  RING_SEA_UNIT's note). */
export const TREES_UNIT = 13;
/** Bytes an instance: x, y, z (float32), its layer and hash (bytes), and its pixel's slot in the band's grid (two bytes -
 *  FLORA-GROUND, below). */
export const TREE_STRIDE = 16;
/**
 * FLORA-GROUND (FIELD BUGS 2026-10-27, the owner: "floating flora ... can be seen off the ground in first person"): A
 * BUILT PIXEL'S BAND TREES STAND DOWN THE FRAME IT IS BUILT. The band's pixels were read at each pixel the traveller
 * crossed, so a pixel of the grid the stream built after that read kept its band trees until the next crossing - after a
 * load or a teleport, the whole grid's. The band is drawn at the far plane, so the built ground and its flats covered a
 * band tree wherever it stood in front of them, but not where it stood against the sky: a crown with no trunk over a
 * town's roofs, on a road, in a clearing (the band's layout keeps none of them - bandTreesPixel), and the band's flat
 * sprite beside the 3D tree that stands in its place. Each instance carries its pixel's slot (`BAND_REACH` pixels either
 * way of the base pixel, a byte each way), and the program drops an instance whose slot the stream has built
 * (`uBuilt`, a bit a slot, written whenever the built map changes). The reach covers the Land View's six and the ring.
 */
export const BAND_REACH = 8;
/** The band's grid of slots a side, and the 32-bit words its built bits take. */
export const BAND_SIDE = 2 * BAND_REACH + 1;
export const BAND_BUILT_WORDS = Math.ceil((BAND_SIDE * BAND_SIDE) / 32);
/** A slot no pixel of the reach holds: never built. */
export const BAND_NO_SLOT = 255;
/** FLORA-GROUND: pixel (px, py)'s slot about base (baseX, baseY) - [i east, j south], or BAND_NO_SLOT each past the
 *  reach. Pure. */
export function bandSlot(px, py, baseX, baseY) {
  const i = px - baseX + BAND_REACH, j = baseY - py + BAND_REACH;
  return i >= 0 && j >= 0 && i < BAND_SIDE && j < BAND_SIDE ? [i, j] : [BAND_NO_SLOT, BAND_NO_SLOT];
}
/** FLORA-GROUND: the built bits about base (baseX, baseY) - slot (i, j)'s bit j * BAND_SIDE + i, set where `built` (the
 *  host's pixel map, keyed "x,y") holds its pixel - written into `out` (BAND_BUILT_WORDS words). Pure but for `out`. */
export function bandBuiltBits(baseX, baseY, built, out = new Int32Array(BAND_BUILT_WORDS)) {
  out.fill(0);
  if (!built) return out;
  for (let j = 0; j < BAND_SIDE; j++) {
    for (let i = 0; i < BAND_SIDE; i++) {
      if (!built.has(`${baseX - BAND_REACH + i},${baseY + BAND_REACH - j}`)) continue;
      const k = j * BAND_SIDE + i;
      out[k >> 5] |= 1 << (k & 31);
    }
  }
  return out;
}
/** Bytes of the instance buffer uploaded a step. */
export const UPLOAD_SLICE = 512 * 1024;

/** ?fartrees=off - the band's kill door (the canopy alone past the grid). */
export function farTreesDisabled(search = globalThis.location?.search) {
  try { return /[?&]fartrees=off\b/.test(search ?? ''); }
  catch { return false; }
}

/**
 * THE BAND'S PIXELS round the traveller's (cx, cy) with the streamed grid's `radius`: every pixel of the ring BAND_RING
 * past it, and every pixel of the grid the stream has not built (`built`: its map, keyed "x,y"), row by row from the
 * north-west. Pure.
 * @returns {Array<[number, number]>}
 */
export function bandPixels(cx, cy, radius, built = null, ring = BAND_RING) {
  const out = [], r = radius + ring;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const c = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      if (c > radius || !built?.has(`${x},${y}`)) out.push([x, y]);
    }
  }
  return out;
}

/** A tree's dither byte: an integer hash of its pixel and its place in the pixel's list (murmur3's finaliser) - the same
 *  number every assembly. Pure. */
export function treeHash(px, py, k) {
  let h = Math.imul(px | 0, 0x9e3779b1) ^ Math.imul(py | 0, 0x85ebca77) ^ Math.imul((k | 0) + 0x27d4eb2f, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) & 255;
}

/**
 * A record's picture laid into an atlas layer: `pic` top-down rgba ({ width, height, data }), scaled so its larger side is
 * the layer's, bottom-centred, nearest texel; the rest clear. Answers the layer's rgba (top-down: row 0 the top - a point
 * sprite's coordinate runs down from its top, gl_PointCoord). Pure.
 */
export function layerPicture(pic, side = TREE_LAYER) {
  const out = new Uint8Array(side * side * 4), s = Math.max(pic.width, pic.height) / side;
  const w = pic.width / s, h = pic.height / s, x0 = (side - w) / 2, y0 = side - h;
  for (let j = 0; j < side; j++) {
    const sy = Math.floor((j - y0 + 0.5) * s);
    if (sy < 0 || sy >= pic.height) continue;
    for (let i = 0; i < side; i++) {
      const sx = Math.floor((i - x0 + 0.5) * s);
      if (sx < 0 || sx >= pic.width) continue;
      const a = (sy * pic.width + sx) * 4, b = (j * side + i) * 4;
      out[b] = pic.data[a]; out[b + 1] = pic.data[a + 1]; out[b + 2] = pic.data[a + 2]; out[b + 3] = pic.data[a + 3];
    }
  }
  return out;
}

/**
 * THE INSTANCES, a pixel a step: each pixel's trees (`{ px, py, archive, trees }`, trees `[x, y, z, record]` in the
 * pixel's own frame) at their place in the band's frame - x east and z north from base pixel (baseX, baseY)'s south-west
 * corner - with their layer (`layerOf(archive, record)`, or undefined: not drawn) and their dither byte. The generator's
 * answer: `{ data: ArrayBuffer, count }`.
 */
export function* bandInstanceSteps(pixels, baseX, baseY, layerOf) {
  let total = 0;
  for (const p of pixels) total += p.trees.length >> 2;
  const data = new ArrayBuffer(total * TREE_STRIDE), f = new Float32Array(data), u = new Uint8Array(data);
  let k = 0;
  for (const p of pixels) {
    yield;
    const ox = (p.px - baseX) * TERRAIN_SIZE, oz = (baseY - p.py) * TERRAIN_SIZE, t = p.trees;
    const [si, sj] = bandSlot(p.px, p.py, baseX, baseY);   // FLORA-GROUND: its pixel's slot - stood down once built
    for (let i = 0; i < t.length; i += 4) {
      const layer = layerOf(p.archive, t[i + 3]);
      if (layer === undefined) continue;
      const o = k * (TREE_STRIDE / 4);
      f[o] = ox + t[i]; f[o + 1] = t[i + 1]; f[o + 2] = oz + t[i + 2];
      u[k * TREE_STRIDE + 12] = layer; u[k * TREE_STRIDE + 13] = treeHash(p.px, p.py, i >> 2);
      u[k * TREE_STRIDE + 14] = si; u[k * TREE_STRIDE + 15] = sj;
      k++;
    }
  }
  return { data, count: k };
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aMeta;   // the tree's layer and its dither byte
layout(location=2) in vec2 aSlot;   // FLORA-GROUND: its pixel's slot in the band's grid (BAND_NO_SLOT past it)
uniform highp int uBuilt[${BAND_BUILT_WORDS}];   // FLORA-GROUND: a bit a slot, set where the stream has built the pixel
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uOrigin;
uniform float uSides[${TREE_LAYERS}];   // a layer's square side, world units (its billboard's larger extent)
uniform vec4 uBand;       // x, y: the rim's dither (metres, Chebyshev from uBandFrom); z: the viewport's height (px); w: the lens's y scale
uniform vec3 uBandFrom;   // the traveller's pixel's centre
uniform vec4 uHazeFrom;   // the far ring's: the point its haze is measured from (w 1), else the eye
out vec3 vWorld;
out float vDist;
flat out float vLayer;
void main() {
  float side = uSides[int(aMeta.x)];
  vec3 world = aPos + uOrigin + vec3(0.0, 0.5 * side, 0.0);
  vWorld = world;
  vLayer = aMeta.x;
  vec4 view = uView * vec4(world, 1.0);
  vDist = uHazeFrom.w > 0.5 ? length(world - uHazeFrom.xyz) : length(view.xyz);
  gl_Position = uProj * view;
  float px = side * uBand.w * uBand.z * 0.5 / max(gl_Position.w, 1.0);
  vec2 d = abs(world.xz - uBandFrom.xz);
  float keep = min(px * px, 1.0) * (1.0 - smoothstep(uBand.x, uBand.y, max(d.x, d.y)));
  if ((aMeta.y + 0.5) / 256.0 > keep) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // not drawn: outside the clip volume
  int slot = aSlot.x < ${BAND_NO_SLOT - 0.5} ? int(aSlot.y) * ${BAND_SIDE} + int(aSlot.x) : -1;
  if (slot >= 0 && ((uBuilt[slot >> 5] >> (slot & 31)) & 1) != 0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // FLORA-GROUND: its pixel the stream's now
  gl_PointSize = clamp(px, 1.0, 64.0);
}`;

const NO_HAZE = new Float32Array(8);   // AUDIT BANTHA1 HAZE-3: uJungleHaze off ([1].x 0)

const FS_HEAD = `#version 300 es
precision highp float;
in vec3 vWorld;
in float vDist;
flat in float vLayer;
uniform highp sampler2DArray uTrees;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uRimStart;
uniform float uRimEnd;
uniform float uHazeHold;
${RING_CLOUD_GLSL}
${HORIZON_HAZE_GLSL}
${RING_HAZE_GLSL}
${FLORA_LIGHT_GLSL}`;

/** The flats' light (render/renderer.js BB_FS: uTint the ambient and half the moon, uBBSun half the sun, under the
 *  clouds' shadow) on the tree's texel `t`. */
const TREE_LIGHT = 'floraLight(uAmbient, uSunColor, ringSun(), uMoonColor, uMoonScale)';

const FS = `${FS_HEAD}
out vec4 outColor;
void main() {
  vec4 tex = texture(uTrees, vec3(gl_PointCoord, vLayer));
  if (tex.a < 0.5) discard;   // the flats' own cutout
  vec3 lit = tex.rgb * (${TREE_LIGHT});
  outColor = vec4(mix(lit, uFogColor, ringHaze(horizonHaze(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold))), 1.0);
}`;

/** The lighting lane's (render/enhancedLighting.js EL_FAR_RING_FS's law): decoded, lit, through the eye and the
 *  tonemap, hazed in display space, dithered at the byte. */
export const TREES_LANE_FS = `${FS_HEAD}
${EL_GLSL}
out vec4 outColor;
void main() {
  vec4 tex = texture(uTrees, vec3(gl_PointCoord, vLayer));
  if (tex.a < 0.5) discard;
  vec3 lit = elDecode(tex.rgb) * (${TREE_LIGHT});
  vec3 shown = elEncode(elTonemapRGB(lit * uELExposure * elAdapt()));
  vec3 col = mix(shown, uFogColor, ringHaze(horizonHaze(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold)));
  outColor = vec4(col + (bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0, 1.0);
}`;
export const TREES_FS = FS;
export const TREES_VS = VS;

/** The band's program text for a lane: none the classic's, the lighting lane's own, the classic-shadow lane's look over it. */
export const treesFsFor = (lane) => (!lane ? FS : lane.key === 'classic-shadows' ? classicLook(TREES_LANE_FS) : TREES_LANE_FS);

/**
 * THE BAND'S GL SIDE AND ITS BOOK: the trees kept by the pixel, the atlas, the instance buffers (one drawn, one being laid),
 * the program. `source.floraBand(job)` the terrain's client (world/terrain/terrainGenClient.js); `read()` the pictures
 * (farFlora.js pipelinePictures). Owns every GL object it makes (dispose).
 */
export class FarTreesBand {
  /** @param {WebGL2RenderingContext} gl @param {{ source: any, lane?: any, read?: () => any }} o */
  constructor(gl, { source, lane = null, read = pipelinePictures }) {
    this.gl = gl;
    this.source = source;
    this.read = read;
    this.lane = lane;
    this.program = buildProgram(gl, VS, treesFsFor(lane), 'far trees');
    this.u = {};
    for (const name of ['uProj', 'uView', 'uOrigin', 'uSides', 'uBand', 'uBandFrom', 'uHazeFrom', 'uTrees', 'uAmbient', 'uSunScale', 'uSunColor',
      'uMoonScale', 'uMoonColor', 'uFogColor', 'uFogStart', 'uFogEnd', 'uRimStart', 'uRimEnd', 'uHazeHold', 'uCloudShadowMap', 'uCloudShadowRect',
      'uCloudShadowFar', 'uCloudFar', 'uJungleHaze', 'uHazeEye', 'uELExposure', 'uAdapt', 'uBuilt']) this.u[name] = gl.getUniformLocation(this.program, name);
    this.builtBits = new Int32Array(BAND_BUILT_WORDS);   // FLORA-GROUND: the drawn base's built slots
    this._builtKey = '';
    this._groundEpoch = source?.groundEpoch ?? 0;   // FLORA-GROUND: the ground the kept trees were laid on
    /** @type {Map<string, { px: number, py: number, archive: number, trees: Float32Array }>} */ this.kept = new Map();
    this.layers = new Map();   // "archive,record" -> layer
    this.sides = new Float32Array(TREE_LAYERS);
    this.arts = new Map();     // archive -> 'asking' | 'ready' | 'none'
    this.version = 0;          // the arts read: an assembly before one landed is laid again
    this.tex = null;
    this.drawn = null;         // { buffer, vao, count, baseX, baseY }
    this._laying = null;       // { buffer, vao, ... } being filled
    this._asking = false;
    this._want = [];
    this._setKey = '';
    this._laidKey = '';
    this.fade = BAND_FADE;   // the rim's dither (pixels past the grid's radius)
    this.canopyFade = BAND_FADE;   // where the far ring lays its canopy back over the ground (the same metres: a crossfade)
  }

  /** The pixels the band stands (bandPixels; a probe's bench may stand others). */
  pixelsFor(cx, cy, radius, built) { return bandPixels(cx, cy, radius, built); }

  /**
   * The band's turn of a frame (render/farRing.js punchHole's): its pixels asked again when the traveller's pixel or the
   * grid's radius moved; the pixels it lacks asked of the worker (one ask at a time); and, once every pixel it wants is
   * kept (and their art read), an assembly queued on `work` (the far ring's stepped queue). `climateOf(x, y)` a pixel's
   * climate; `forests` the Real forests switch; `landform` the Landforms row.
   */
  frame({ curX, curY, radius, built, climateOf, forests, landform, work }) {
    this._builtNow(built);   // FLORA-GROUND: a pixel built since the last crossing stands its band trees down at once
    this._groundNow();   // FLORA-GROUND: the ground moved - every kept pixel's trees laid again on it
    const key = `${curX},${curY},${radius}`;
    if (key !== this._setKey) { this._setKey = key; this._want = this.pixelsFor(curX, curY, radius, built); this._wantAt = [curX, curY]; this._failed = false; }
    const missing = this._want.filter(([x, y]) => !this.kept.has(`${x},${y}`));
    if (missing.length && !this._asking && !this._failed) this._ask(missing, climateOf, forests, landform);
    for (const [x, y] of this._want) {
      const k = this.kept.get(`${x},${y}`);
      if (k) this._art(k.archive);
    }
    const laidKey = `${key}|${this.version}`;
    if (missing.length || this._laying || laidKey === this._laidKey) return;
    if (this._want.some(([x, y]) => this.arts.get(this.kept.get(`${x},${y}`).archive) === 'asking')) return;   // its art still being read
    this._laidKey = laidKey;
    this._lay(work, curX, curY);
  }

  /** FLORA-GROUND: the drawn instances' built bits (bandBuiltBits about the drawn base), written again when the built map
   *  or the drawn base moves - a plain Map (no `changes`) by its size. */
  _builtNow(built) {
    const d = this.drawn, key = d ? `${d.baseX},${d.baseY},${built ? (built.changes ?? built.size) : -1}` : '';
    if (key === this._builtKey) return;
    this._builtKey = key;
    if (d) bandBuiltBits(d.baseX, d.baseY, built, this.builtBits);
  }

  /** FLORA-GROUND: a band's trees stand on the ground the kernel stood them on, so when the ground's inputs move (the
   *  terrain client's `groundEpoch`: the roads, the landforms' tables, the continent's trace and its relief) every kept
   *  pixel is let go and asked again - an answer on its way is dropped - and the band is laid anew on what comes back.
   *  The drawn buffer stands until then: a tree is never taken away for a ground it has not been laid on yet. */
  _groundNow() {
    const epoch = this.source?.groundEpoch ?? 0;
    if (epoch === this._groundEpoch) return;
    this._groundEpoch = epoch;
    this.kept.clear();
    this._gen = (this._gen ?? 0) + 1;
    this._asking = false;
    this._failed = false;
    this._laidKey = '';
  }

  _ask(missing, climateOf, forests, landform) {
    const pixels = new Int32Array(missing.length * 4), archives = [];
    missing.forEach(([x, y], k) => {
      const c = getWorldClimateSettings(climateOf(x, y));
      pixels[k * 4] = x; pixels[k * 4 + 1] = y; pixels[k * 4 + 2] = c.natureArchive; pixels[k * 4 + 3] = c.climateType;
      archives.push(c.natureArchive);
    });
    this._asking = true;
    const gen = (this._gen = (this._gen ?? 0) + 1);
    Promise.resolve(this.source?.floraBand?.({ pixels, forests: !!forests, landform: !!landform }) ?? null).then((trees) => {
      if (gen !== this._gen) return;
      this._asking = false;
      if (!trees) { this._failed = true; return; }   // no worker, or it failed: the band stands down until the set moves
      missing.forEach(([x, y], k) => this.kept.set(`${x},${y}`, { px: x, py: y, archive: archives[k], trees: trees[k] ?? new Float32Array(0) }));
      this._forget();
    }, () => { if (gen === this._gen) this._asking = false; });
  }

  /** The kept pixels past twice the band's reach of the traveller let go (the book holds the band and a crossing's worth). */
  _forget() {
    const [cx, cy] = this._wantAt ?? [0, 0], keep = Math.sqrt(this._want.length) + 4;
    for (const [k, p] of this.kept) if (Math.max(Math.abs(p.px - cx), Math.abs(p.py - cy)) > keep) this.kept.delete(k);
  }

  /** An archive's Tree pictures read into the atlas, once (`arts`: 'asking', then 'ready' or 'none'). */
  _art(archive) {
    if (this.arts.has(archive)) return;
    const records = TREE_RECORDS[archive], read = this.read();
    if (!records || !read) { if (!records) this.arts.set(archive, 'none'); return; }
    this.arts.set(archive, 'asking');
    Promise.all(records.map((r) => Promise.all([read.picture(archive, r).catch(() => null), read.size(archive, r).catch(() => null)]))).then((got) => {
      if (!this.gl) return;
      let any = false;
      got.forEach(([pic, size], i) => {
        if (!pic?.width || !(size?.h > 0) || this.layers.size >= TREE_LAYERS) return;
        const layer = this.layers.size;
        this._upload(layer, layerPicture(pic));
        this.layers.set(`${archive},${records[i]}`, layer);
        this.sides[layer] = Math.max(size.w, size.h);
        any = true;
      });
      if (any) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); gl.bindTexture(gl.TEXTURE_2D_ARRAY, null); }
      this.arts.set(archive, any ? 'ready' : 'none');
      this.version++;
    }, () => this.arts.set(archive, 'none'));
  }

  _upload(layer, rgba) {
    const gl = this.gl;
    if (!this.tex) {
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(TREE_LAYER) + 1, gl.RGBA8, TREE_LAYER, TREE_LAYER, TREE_LAYERS);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, TREE_LAYER, TREE_LAYER, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }

  /** The wanted pixels' instances laid round the traveller's pixel a step at a time, uploaded a slice a step into a buffer
   *  of their own, and swapped in whole when the last slice is up. */
  _lay(work, baseX, baseY) {
    const pixels = this._want.map(([x, y]) => this.kept.get(`${x},${y}`));
    const it = bandInstanceSteps(pixels, baseX, baseY, (a, r) => this.layers.get(`${a},${r}`));
    const self = this;
    function* steps() {
      const v = yield* it;
      const gl = self.gl, buffer = gl.createBuffer(), bytes = v.count * TREE_STRIDE;   // the trees drawn: a record with no layer was left out
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, Math.max(TREE_STRIDE, bytes), gl.DYNAMIC_DRAW);
      for (let at = 0; at < bytes; at += UPLOAD_SLICE) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, at, new Uint8Array(v.data, at, Math.min(UPLOAD_SLICE, bytes - at)));
        yield;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return { buffer, count: v.count };
    }
    this._laying = { gen: this._gen };
    work.push({ it: steps(), done: ({ buffer, count }) => {
      this._laying = null;
      if (!this.gl) return;
      this._swap(buffer, count, baseX, baseY);
    } });
  }

  _swap(buffer, count, baseX, baseY) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, TREE_STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.UNSIGNED_BYTE, false, TREE_STRIDE, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.UNSIGNED_BYTE, false, TREE_STRIDE, 14);   // FLORA-GROUND: its pixel's slot
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._free(this.drawn);
    this.drawn = { buffer, vao, count, baseX, baseY };
  }

  _free(d) {
    if (!d) return;
    this.gl.deleteBuffer(d.buffer);
    this.gl.deleteVertexArray(d.vao);
  }

  /** The instances drawn now (the probes' read and the pins'). */
  get count() { return this.drawn?.count ?? 0; }

  /**
   * Drawn inside the far ring's pass (its depth state: at the far plane, tested, never written): `s` the pass's - the lens,
   * the view, the band's origin in the scene (`origin`: base pixel's south-west corner), the frame's light (decoded for the
   * lane as the far ring's is), its haze and its clouds' map; `radius` the grid's, for the rim's dither.
   */
  draw(s) {
    if (!this.drawn?.count || !this.tex) return;
    const gl = this.gl, u = this.u;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(u.uProj, false, s.proj);
    gl.uniformMatrix4fv(u.uView, false, s.view);
    gl.uniform3f(u.uOrigin, s.origin[0], s.origin[1], s.origin[2]);
    gl.uniform1fv(u.uSides, this.sides);
    gl.uniform1iv(u.uBuilt, this.builtBits);   // FLORA-GROUND: the built pixels' trees stood down
    gl.uniform4f(u.uBand, (s.radius + this.fade[0]) * TERRAIN_SIZE, (s.radius + this.fade[1]) * TERRAIN_SIZE, s.viewportH, s.proj[5]);
    gl.uniform3f(u.uBandFrom, s.origin[0] + 0.5 * TERRAIN_SIZE, 0, s.origin[2] + 0.5 * TERRAIN_SIZE);
    gl.uniform4fv(u.uHazeFrom, s.hazeFrom);
    gl.uniform3fv(u.uAmbient, s.ambient);
    gl.uniform1f(u.uSunScale, s.sunScale);
    gl.uniform3fv(u.uSunColor, s.sunColor);
    gl.uniform1f(u.uMoonScale, s.moonScale);
    gl.uniform3fv(u.uMoonColor, s.moonColor);
    gl.uniform3fv(u.uFogColor, s.fogColor);
    gl.uniform1f(u.uFogStart, s.fogStart);
    gl.uniform1f(u.uFogEnd, s.fogEnd);
    gl.uniform1f(u.uRimStart, s.rimStart);
    gl.uniform1f(u.uRimEnd, s.rimEnd);
    gl.uniform1f(u.uHazeHold, s.hold);
    const { haze } = s;
    gl.uniform4fv(u.uJungleHaze, haze ?? NO_HAZE);   // BANTHA1: the frame's haze, as the ring's - off when none is handed
    gl.uniform3fv(u.uHazeEye, s.hazeEye);
    gl.uniform1f(u.uCloudFar, s.cloudFar);
    gl.uniform2f(u.uCloudShadowFar, s.cloudFar, 1);
    gl.uniform4fv(u.uCloudShadowRect, s.cloudRect);
    gl.uniform1i(u.uCloudShadowMap, s.cloudUnit);
    if (this.lane) { gl.uniform1f(u.uELExposure, s.exposure); gl.uniform1i(u.uAdapt, 11); }
    gl.activeTexture(gl.TEXTURE0 + TREES_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.uTrees, TREES_UNIT);
    gl.bindVertexArray(this.drawn.vao);
    gl.drawArrays(gl.POINTS, 0, this.drawn.count);
    gl.bindVertexArray(null);
  }

  /** Every GL object it made (EVERY ALLOCATION HAS AN OWNER); an answer still out let go. */
  dispose() {
    const gl = this.gl;
    this._gen = (this._gen ?? 0) + 1;
    this._free(this.drawn);
    this.drawn = null;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = null;
    if (this.program) gl.deleteProgram(this.program);
    this.program = null;
    this.kept.clear();
  }
}
