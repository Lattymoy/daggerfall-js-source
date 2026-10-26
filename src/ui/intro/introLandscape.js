// INTRO2: the cinematic's own, data-free landscape. One perspective camera
// replaces U65's incompatible column-renderer / orthographic-map pair.
// Geometry and texture are generated once; every moving frame stays on the GPU.
//
// INTRO4 (bible/10-UI/UI-Arc.md INTRO4): the landscape is the Imperial City and the continent. Two scales in one frame:
// THE CONTINENT (introTamriel.js's field on a grid, its sea, its painted clouds) drawn first with its own near plane,
// then the depth cleared and THE CITY (introCity.js: its ground and lake, the landmarks TESA built, the houses on its
// plan, its trees, a flock about the Tower, the cloud deck) drawn over it, its ground fading at the rim into the
// continent beneath. A shadow map from the low sun over the city, MSAA, and a last pass for the bloom, the sun's rays and
// the grade. The heavy build is the worker's (introBuild.js); the city arrives first, the continent before the ascent.
import { multiply, perspective, lookAt, ortho } from '../../world/mat4.js';
import { introCameraAt, introAtmosphereAt } from './introCue.js';
import { loseGlContext, onPageGone } from '../../render/glRelease.js';   // GL-LEAK: the intro's context let go with it
import { startPrograms, buildProgram, releasePrograms } from '../../render/glProgram.js';   // SHADER-STALL: compiled beside the gate, never on it
import { startIntroBuild } from './introBuild.js';
import { UNIT_M, BYTE_M, SHORE, IMPERIAL_CITY_AT, RIVER_SEGMENTS, CITY_POINTS, fieldColourAt } from './introTamriel.js';
import { PICTURE_W, PICTURE_H } from '../../world/tamriel/tamrielFrame.js';
import * as S from './introShaders.js';

const MAX_PIXELS = 900000;
/** The city's own ground reaches this far each way (metres); past it the continent. */
export const GROUND_REACH = 40000;
/** The flock about the Tower. */
const BIRDS = 70;
/** The shadow map's side, and the square of the city it covers (metres each way from the middle). */
const SHADOW_SIZE = 2048, SHADOW_HALF = 3600;
/** The camera heights past which the city's passes stand down (metres): the houses and trees, the shadow, the
 *  landmarks, the city's ground. */
const HOUSES_UNTIL = 60000, SHADOW_UNTIL = 40000, LANDMARKS_UNTIL = 400000, GROUND_UNTIL = 2500000;
/** The sea is drawn above this height (metres); the cloud deck within this band (the ascent climbs through it); the
 *  shadow map is drawn again when the sun has moved this far (a unit vector's step, ~0.1 degree). */
const SEA_FROM = 60000, DECK_BAND = [1400, 30000], SHADOW_STEP = 0.0018;

/** One reusable grid; Uint32 indices are native in the game's WebGL2 target. */
export function introTerrainGrid(columns = 256, rows = 160) {
  const vertices = new Float32Array((columns + 1) * (rows + 1) * 2);
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    const i = (y * (columns + 1) + x) * 2;
    vertices[i] = x / columns; vertices[i + 1] = y / rows;
  }
  const indices = new Uint32Array(columns * rows * 6);
  let n = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * (columns + 1) + x, b = a + columns + 1;
    indices.set([a, b, a + 1, a + 1, b, b + 1], n); n += 6;
  }
  return { vertices, indices };
}

/** The city's ground grid: `n` cells a side over +-reach metres, dense at the middle and wide at the rim (x = reach *
 *  |u|^power) - the hills past the lake want vertices, the flat city its shader. */
export function introGroundGrid(n = 256, reach = GROUND_REACH, power = 2.3) {
  const g = introTerrainGrid(n, n);
  for (let i = 0; i < g.vertices.length; i++) {
    const u = g.vertices[i] * 2 - 1;
    g.vertices[i] = Math.sign(u) * reach * Math.abs(u) ** power;
  }
  return g;
}

/** A house's box (no floor) and its roof, unit-sized (introShaders.js HOUSE_VERTEX scales them). */
const BOX = new Float32Array([
  -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0.5, -0.5, 1, 0.5,
  0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, -0.5, 0.5, 1, -0.5,
  0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, -0.5, 0.5, 1, 0.5,
  -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0.5, -0.5, 1, -0.5,
  -0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, -0.5, -0.5, 1, -0.5,
]);
const BOX_INDEX = new Uint16Array(Array.from({ length: 5 }, (_, f) => [0, 1, 2, 0, 2, 3].map((k) => k + f * 4)).flat());
const ROOF = new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0]);
const ROOF_INDEX = new Uint16Array([0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 3, 0, 4, 1, 2, 5]);
/** A tree: a rounded crown of two five-sided rings on a three-sided trunk (26 triangles - a city holds thirty thousand). */
const TREE = (() => {
  const rings = [[0.36, 0.72], [0.7, 0.92]], v = [0, 1, 0, 0, 0.24, 0], idx = [];
  for (const [y, r] of rings) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + y * 2; v.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  const at = (ring, i) => 2 + ring * 5 + (i % 5);
  for (let i = 0; i < 5; i++) {
    idx.push(1, at(0, i + 1), at(0, i));
    idx.push(at(0, i), at(0, i + 1), at(1, i + 1), at(0, i), at(1, i + 1), at(1, i));
    idx.push(0, at(1, i), at(1, i + 1));
  }
  const t0 = v.length / 3;
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; v.push(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07, Math.cos(a) * 0.07, 0.38, Math.sin(a) * 0.07); }
  for (let i = 0; i < 3; i++) { const a = t0 + i * 2, b = t0 + ((i + 1) % 3) * 2; idx.push(a, b, b + 1, a, b + 1, a + 1); }
  return { v: new Float32Array(v), i: new Uint16Array(idx) };
})();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** The rivers, as the continent's shader takes them (at most 32 segments). */
const RIVERS = new Float32Array(32 * 4);
RIVER_SEGMENTS.slice(0, 32).forEach((seg, i) => RIVERS.set(seg, i * 4));
/** The cities, as the continent's shader takes them (at most 80). */
const CITIES = new Float32Array(80 * 2);
CITY_POINTS.slice(0, 80).forEach((q, i) => CITIES.set(q, i * 2));
const sstep = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

export function createIntroLandscape(canvas, { build = startIntroBuild } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const allocations = [];
  let disposed = false, job = null, P = null;
  const own = (value, release) => { allocations.push(() => release.call(gl, value)); return value; };
  // the film's programs: started together, the driver compiling them beside the gate (KHR_parallel_shader_compile -
  // render/glProgram.js), taken when it says they are done; until then the landscape draws nothing
  const SOURCES = {
    sky: [S.FULLSCREEN, S.SKY], continent: [S.CONTINENT_VERTEX, S.CONTINENT_FRAGMENT], ocean: [S.PLANE_VERTEX, S.OCEAN_FRAGMENT],
    ground: [S.GROUND_VERTEX, S.GROUND_FRAGMENT], landmark: [S.LANDMARK_VERTEX, S.LANDMARK_FRAGMENT], house: [S.HOUSE_VERTEX, S.HOUSE_FRAGMENT],
    tree: [S.TREE_VERTEX, S.TREE_FRAGMENT], bird: [S.BIRD_VERTEX, S.BIRD_FRAGMENT], deck: [S.PLANE_VERTEX, S.DECK_FRAGMENT],
    post: [S.FULLSCREEN, S.POST_FRAGMENT], landmarkDepth: [S.LANDMARK_VERTEX, S.DEPTH_FRAGMENT], houseDepth: [S.HOUSE_VERTEX, S.DEPTH_FRAGMENT],
  };
  const pairs = Object.values(SOURCES);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    job?.dispose();
    if (!P) releasePrograms(gl, pairs);
    for (const release of allocations.reverse()) release();
    allocations.length = 0;
    unseat();
    loseGlContext(gl);   // GL-LEAK: its multisampled buffer goes now, not when the collector reaches the canvas
  };
  const unseat = onPageGone(dispose);
  try {
    const compiled = startPrograms(gl, pairs);
    const takePrograms = () => {
      const out = {};
      for (const [name, [vertex, fragment]] of Object.entries(SOURCES)) {
        const program = own(buildProgram(gl, vertex, fragment, `intro ${name}`), gl.deleteProgram);
        const locations = new Map();
        const u = (key) => { if (!locations.has(key)) locations.set(key, gl.getUniformLocation(program, key)); return locations.get(key); };
        out[name] = { program, u };
      }
      return out;
    };
    const wait = (fn) => (globalThis.requestAnimationFrame && !globalThis.document?.hidden ? globalThis.requestAnimationFrame(fn) : setTimeout(fn, 32));
    const programsReady = new Promise((resolve) => {
      const poll = () => {
        if (disposed) return resolve(false);
        if (!compiled()) return void wait(poll);
        try { P = takePrograms(); resolve(true); }
        catch (error) { console.warn('[intro] landscape unavailable:', error.message); dispose(); resolve(false); }
      };
      poll();
    });

    // ── buffers that need no build
    const empty = own(gl.createVertexArray(), gl.deleteVertexArray);
    const gridVao = (grid, size = 2) => {
      const vao = own(gl.createVertexArray(), gl.deleteVertexArray);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
      gl.bufferData(gl.ARRAY_BUFFER, grid.vertices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, size, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, count: grid.indices.length };
    };
    const continentGrid = gridVao(introTerrainGrid(640, 400));
    const groundGrid = gridVao(introGroundGrid());

    // ── the frame's targets: a multisampled scene, its resolve (mipmapped, for the bloom), the sun's shadow map
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    const msFbo = own(gl.createFramebuffer(), gl.deleteFramebuffer), msColour = own(gl.createRenderbuffer(), gl.deleteRenderbuffer), msDepth = own(gl.createRenderbuffer(), gl.deleteRenderbuffer);
    const resolveFbo = own(gl.createFramebuffer(), gl.deleteFramebuffer), sceneTex = own(gl.createTexture(), gl.deleteTexture);
    let targetW = 0, targetH = 0;
    const sizeTargets = (w, h) => {
      if (w === targetW && h === targetH) return;
      targetW = w; targetH = h;
      gl.bindRenderbuffer(gl.RENDERBUFFER, msColour);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
      gl.bindRenderbuffer(gl.RENDERBUFFER, msDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msColour);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msDepth);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    const shadowTex = own(gl.createTexture(), gl.deleteTexture), shadowFbo = own(gl.createFramebuffer(), gl.deleteFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    const shadowOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const texture = (w, h, internal, format, data, { filter = gl.LINEAR, mips = false } = {}) => {
      const tex = own(gl.createTexture(), gl.deleteTexture);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      return tex;
    };

    // ── the city and the continent, as they arrive - until the continent does, a field of one texel of open sea, so a
    // build that never lands leaves the sea and its clouds under the ascent, never an empty frame
    const sea = new Uint8Array([18, 46, 70, 0]);
    const scene = { city: null, field: { rgba: texture(1, 1, gl.RGBA8, gl.RGBA, sea), border: texture(1, 1, gl.R8, gl.RED, new Uint8Array(1)), placeholder: true }, farGround: [0.36, 0.44, 0.24] };
    const uploadCity = (city) => {
      if (disposed) return;
      const L = city.landmarks, Y = city.layout;
      const vao = own(gl.createVertexArray(), gl.deleteVertexArray);
      gl.bindVertexArray(vao);
      const attr = (loc, data, size, type = gl.FLOAT) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, false, 0, 0);
      };
      attr(0, L.positions, 3); attr(1, L.normals, 3); attr(2, L.uvs, 2); attr(3, L.material, 1, gl.UNSIGNED_BYTE);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, L.indices, gl.STATIC_DRAW);
      const landmarks = { vao, count: L.indices.length };
      // the houses: one instance buffer under two meshes
      const instances = own(gl.createBuffer(), gl.deleteBuffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      gl.bufferData(gl.ARRAY_BUFFER, city.buildings, gl.STATIC_DRAW);
      const houseVao = (mesh, index) => {
        const v = own(gl.createVertexArray(), gl.deleteVertexArray);
        gl.bindVertexArray(v);
        gl.bindBuffer(gl.ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
        gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, instances);
        const stride = Y.buildingFloats * 4;
        for (const [loc, size, off] of [[1, 4, 0], [2, 4, 16], [3, 4, 32], [4, 2, 48]]) {
          gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); gl.vertexAttribDivisor(loc, 1);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
        return { vao: v, count: index.length };
      };
      const body = houseVao(BOX, BOX_INDEX), roof = houseVao(ROOF, ROOF_INDEX);
      const treeVao = own(gl.createVertexArray(), gl.deleteVertexArray);
      gl.bindVertexArray(treeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
      gl.bufferData(gl.ARRAY_BUFFER, TREE.v, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
      gl.bufferData(gl.ARRAY_BUFFER, city.trees, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, Y.treeFloats * 4, 0); gl.vertexAttribDivisor(1, 1);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, TREE.i, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      // the ground's tiles one-hot (water, sand, grass, stone; the land past the lake none), filtered into a shore
      const n = Math.round(Math.sqrt(city.ground.length)), hot = new Uint8Array(n * n * 4);
      for (let i = 0; i < city.ground.length; i++) { const t = city.ground[i]; if (t < 4) hot[i * 4 + t] = 255; }
      scene.city = {
        landmarks, body, roof, houses: city.buildingCount,
        trees: { vao: treeVao, count: TREE.i.length, instances: city.trees.length / Y.treeFloats },
        ground: texture(n, n, gl.RGBA8, gl.RGBA, hot),
        plan: texture(Y.cells, Y.cells, gl.R8, gl.RED, city.plan, { filter: gl.NEAREST }),
        layout: Y, roofs: new Float32Array(Y.roofs.flatMap((c) => c.map((v) => v / 255))),
      };
    };
    const uploadField = (field) => {
      if (disposed) return;
      scene.field = {
        rgba: texture(field.w, field.h, gl.RGBA8, gl.RGBA, field.rgba, { mips: true }),
        border: texture(field.w, field.h, gl.R8, gl.RED, field.border, { mips: true }),
      };
      const c = fieldColourAt(field, IMPERIAL_CITY_AT[0] + 1.6, IMPERIAL_CITY_AT[1] + 1.6);
      scene.farGround = c.map((v) => v / 255);
    };
    job = build();
    const cityReady = job.city.then((city) => { uploadCity(city); return !disposed; }).catch((error) => { console.warn('[intro] the city did not build:', error.message); return false; });
    const ready = Promise.all([programsReady, cityReady]).then(([a, b]) => a && b && !disposed);
    job.field.then(uploadField).catch((error) => console.warn('[intro] the continent did not build:', error.message));

    // ── per frame
    const vp = new Float32Array(16), shadowVP = new Float32Array(16), basis = new Float32Array(9);
    let lastShadowSun = null;
    const frame = { vp: new Float32Array(16), eye: [0, 0, 0], width: 1, height: 1 };
    const common = (p, a, eye) => {
      gl.uniform3fv(p.u('uEye'), eye); gl.uniform3fv(p.u('uSun'), a.sun); gl.uniform3fv(p.u('uSunCol'), a.sunCol);
      gl.uniform3fv(p.u('uSkyAmb'), a.skyAmb); gl.uniform3fv(p.u('uGroundAmb'), a.groundAmb);
      gl.uniform1f(p.u('uNight'), a.night); gl.uniform1f(p.u('uMist'), a.mist); gl.uniform1f(p.u('uTime'), a.time);
      gl.uniform1f(p.u('uFogA'), a.fogA); gl.uniform1f(p.u('uFogH'), a.fogH);
    };
    const bindShadow = (p, on) => {
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.uniform1i(p.u('uShadow'), 3); gl.uniformMatrix4fv(p.u('uShadowVP'), false, shadowVP); gl.uniform1f(p.u('uShadowOn'), on ? 1 : 0);
    };
    const drawHouses = (p, part) => {
      const C = scene.city, m = part === 0 ? C.body : C.roof;
      gl.uniform1i(p.u('uPart'), part);
      gl.bindVertexArray(m.vao); gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0, C.houses);
    };

    return {
      ready,
      /** The last frame's projection of a point of the film's world into the canvas's CSS pixels: [x, y, in front]. */
      project(point) {
        const p = [point[0] - frame.eye[0], point[1] - frame.eye[1], point[2] - frame.eye[2]], m = frame.vp;
        const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
        if (w <= 0) return [0, 0, false];
        return [(x / w * 0.5 + 0.5) * frame.width, (0.5 - y / w * 0.5) * frame.height, true];
      },
      render(time, width, height, reducedMotion = false) {
        if (disposed || !P || gl.isContextLost()) return;
        const scale = Math.min(1.25, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        sizeTargets(w, h);
        const cam = introCameraAt(time, width / height, reducedMotion);
        const a = { ...introAtmosphereAt(time), time: reducedMotion ? 0 : time };
        const eye = cam.eye, alt = Math.max(1, eye[1]);
        // the view's rotation alone: every pass is drawn camera-relative
        const view = lookAt([0, 0, 0], cam.aim.map((v, k) => v - eye[k]), [0, 1, 0]);
        frame.eye = eye; frame.width = width; frame.height = height;
        basis.set([view[0], view[4], view[8], view[1], view[5], view[9], -view[2], -view[6], -view[10]]);
        const aspect = width / height, distCity = Math.hypot(...eye);

        // the sun's shadow over the city, while the city is near enough to cast one
        const shadowOn = shadowOk && scene.city && alt < SHADOW_UNTIL && a.sun[1] > 0;
        // the sun climbs a degree in two seconds: its shadow is drawn again when it has moved, not every frame
        const sunMoved = !lastShadowSun || Math.hypot(a.sun[0] - lastShadowSun[0], a.sun[1] - lastShadowSun[1], a.sun[2] - lastShadowSun[2]) > SHADOW_STEP;
        if (shadowOn && sunMoved) {
          lastShadowSun = a.sun.slice();
          const L = a.sun.map((v) => v * 30000);
          multiply(ortho(SHADOW_HALF, SHADOW_HALF, 1000, 62000), lookAt(L, [0, 0, 0], Math.abs(a.sun[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0]), shadowVP);
          gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
          gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
          gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
          gl.colorMask(false, false, false, false);
          gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
          const zero = [0, 0, 0];
          gl.useProgram(P.landmarkDepth.program); gl.uniformMatrix4fv(P.landmarkDepth.u('uVP'), false, shadowVP); gl.uniform3fv(P.landmarkDepth.u('uEye'), zero);
          gl.bindVertexArray(scene.city.landmarks.vao); gl.drawElements(gl.TRIANGLES, scene.city.landmarks.count, gl.UNSIGNED_INT, 0);
          gl.useProgram(P.houseDepth.program); gl.uniformMatrix4fv(P.houseDepth.u('uVP'), false, shadowVP); gl.uniform3fv(P.houseDepth.u('uEye'), zero);
          drawHouses(P.houseDepth, 0); drawHouses(P.houseDepth, 1);
          gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
        gl.viewport(0, 0, w, h);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(true); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.bindVertexArray(empty);
        gl.useProgram(P.sky.program); common(P.sky, a, eye);
        gl.uniform2f(P.sky.u('uRes'), w, h); gl.uniformMatrix3fv(P.sky.u('uBasis'), false, basis);
        gl.uniform2f(P.sky.u('uHalf'), Math.tan(cam.fov / 2) * aspect, Math.tan(cam.fov / 2)); gl.uniform1f(P.sky.u('uCirrus'), a.cirrus);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // THE CONTINENT, at its own scale
        gl.enable(gl.DEPTH_TEST);
        const exag = 1 + 7 * sstep(80000, 2500000, alt);
        {
          multiply(perspective(cam.fov, aspect, Math.max(3000, alt * 0.25), 4e7), view, vp);
          const F = scene.field;
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.rgba);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, F.border);
          const fieldUniforms = (p) => {
            gl.uniformMatrix4fv(p.u('uVP'), false, vp); common(p, a, eye);
            gl.uniform1i(p.u('uField'), 0); gl.uniform1i(p.u('uBorder'), 1);
            gl.uniform2f(p.u('uUnits'), PICTURE_W, PICTURE_H); gl.uniform2f(p.u('uIC'), IMPERIAL_CITY_AT[0], IMPERIAL_CITY_AT[1]);
            gl.uniform1f(p.u('uUnitM'), UNIT_M); gl.uniform1f(p.u('uByteM'), BYTE_M); gl.uniform1f(p.u('uExag'), exag); gl.uniform1f(p.u('uShore'), SHORE);
            gl.uniform1f(p.u('uClouds'), a.clouds);
          };
          if (alt > SEA_FROM) {   // the nearest sea is 800 km from the city: below this height it is past the horizon's haze
            gl.useProgram(P.ocean.program); fieldUniforms(P.ocean);
            gl.uniform1f(P.ocean.u('uAltitude'), -25 * exag); gl.uniform1f(P.ocean.u('uHalfSize'), Math.max(4e5, alt * 12));
            gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, 6);
          }
          gl.useProgram(P.continent.program); fieldUniforms(P.continent);
          gl.uniform4fv(P.continent.u('uRivers'), RIVERS); gl.uniform1i(P.continent.u('uRiverCount'), RIVER_SEGMENTS.length);
          gl.uniform2fv(P.continent.u('uCities'), CITIES); gl.uniform1i(P.continent.u('uCityCount'), Math.min(80, CITY_POINTS.length));
          gl.uniform1f(P.continent.u('uBorders'), a.borders); gl.uniform1f(P.continent.u('uMarker'), a.marker * sstep(300000, 1500000, alt));
          gl.bindVertexArray(continentGrid.vao); gl.drawElements(gl.TRIANGLES, continentGrid.count, gl.UNSIGNED_INT, 0);
        }

        // THE CITY, over it
        multiply(perspective(cam.fov, aspect, clamp(alt * 0.004, 0.25, 50000), Math.max(120000, distCity * 3)), view, vp);
        frame.vp.set(vp);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        const C = scene.city;
        if (C && alt < GROUND_UNTIL) {
          gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
          gl.useProgram(P.ground.program); common(P.ground, a, eye); bindShadow(P.ground, shadowOn);
          gl.uniformMatrix4fv(P.ground.u('uVP'), false, vp);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, C.ground); gl.uniform1i(P.ground.u('uGround'), 0);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, C.plan); gl.uniform1i(P.ground.u('uPlan'), 1);
          gl.uniform1f(P.ground.u('uSpan'), C.layout.groundSpan); gl.uniform1f(P.ground.u('uCellM'), C.layout.cellM); gl.uniform1f(P.ground.u('uCells'), C.layout.cells);
          gl.uniform3fv(P.ground.u('uFar'), scene.farGround); gl.uniform1f(P.ground.u('uRim'), GROUND_REACH);
          gl.uniform1f(P.ground.u('uClouds'), a.clouds); gl.uniform1f(P.ground.u('uHasField'), scene.field.placeholder ? 0 : 1);
          gl.uniform2f(P.ground.u('uUnits'), PICTURE_W, PICTURE_H); gl.uniform2f(P.ground.u('uIC'), IMPERIAL_CITY_AT[0], IMPERIAL_CITY_AT[1]); gl.uniform1f(P.ground.u('uUnitM'), UNIT_M);
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, scene.field.rgba); gl.uniform1i(P.ground.u('uField'), 2);
          gl.bindVertexArray(groundGrid.vao); gl.drawElements(gl.TRIANGLES, groundGrid.count, gl.UNSIGNED_INT, 0);
          gl.disable(gl.BLEND);
          if (alt < LANDMARKS_UNTIL) {
            gl.useProgram(P.landmark.program); common(P.landmark, a, eye); bindShadow(P.landmark, shadowOn);
            gl.uniformMatrix4fv(P.landmark.u('uVP'), false, vp);
            gl.bindVertexArray(C.landmarks.vao); gl.drawElements(gl.TRIANGLES, C.landmarks.count, gl.UNSIGNED_INT, 0);
          }
          if (alt < HOUSES_UNTIL) {
            gl.useProgram(P.house.program); common(P.house, a, eye); bindShadow(P.house, shadowOn);
            gl.uniformMatrix4fv(P.house.u('uVP'), false, vp); gl.uniform3fv(P.house.u('uRoofs'), C.roofs);
            drawHouses(P.house, 0); drawHouses(P.house, 1);
            gl.useProgram(P.tree.program); common(P.tree, a, eye); bindShadow(P.tree, shadowOn);
            gl.uniformMatrix4fv(P.tree.u('uVP'), false, vp);
            gl.bindVertexArray(C.trees.vao); gl.drawElementsInstanced(gl.TRIANGLES, C.trees.count, gl.UNSIGNED_SHORT, 0, C.trees.instances);
            gl.useProgram(P.bird.program); common(P.bird, a, eye); gl.uniformMatrix4fv(P.bird.u('uVP'), false, vp);
            gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, BIRDS * 6);
          }
        }
        // the cloud deck, translucent, nearest sheet last
        if (alt > DECK_BAND[0] && alt < DECK_BAND[1]) {
          gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
          gl.useProgram(P.deck.program); common(P.deck, a, eye);
          gl.uniformMatrix4fv(P.deck.u('uVP'), false, vp); gl.uniform1f(P.deck.u('uHalfSize'), 34000); gl.uniform1f(P.deck.u('uCover'), a.deck * sstep(DECK_BAND[0], DECK_BAND[0] * 1.5, alt) * (1 - sstep(9000, DECK_BAND[1], alt)));
          gl.bindVertexArray(empty);
          const sheets = [2750, 3150, 3550].sort((p, q) => Math.abs(q - eye[1]) - Math.abs(p - eye[1]));
          for (const y of sheets) { gl.uniform1f(P.deck.u('uAltitude'), y); gl.drawArrays(gl.TRIANGLES, 0, 6); }
          gl.depthMask(true); gl.disable(gl.BLEND);
        }

        // resolve, the bloom's mips, and the last pass to the screen
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFbo);
        gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.generateMipmap(gl.TEXTURE_2D);
        gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST);
        gl.useProgram(P.post.program);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.uniform1i(P.post.u('uScene'), 0);
        gl.uniform2f(P.post.u('uRes'), w, h);
        // the sun on the screen: the rays' source
        const s = a.sun, m = vp;
        const sx = m[0] * s[0] + m[4] * s[1] + m[8] * s[2], sy = m[1] * s[0] + m[5] * s[1] + m[9] * s[2], sw = m[3] * s[0] + m[7] * s[1] + m[11] * s[2];
        const front = sw > 0;
        gl.uniform2f(P.post.u('uSunUv'), front ? sx / sw * 0.5 + 0.5 : 0.5, front ? sy / sw * 0.5 + 0.5 : 0.5);
        gl.uniform1f(P.post.u('uSunVis'), front ? sstep(-0.03, 0.04, s[1]) * (1 - sstep(80000, 400000, alt)) : 0);
        gl.uniform3fv(P.post.u('uRayCol'), a.sunCol.map((v) => v * 0.33));
        gl.uniform1f(P.post.u('uFlare'), front ? a.flare : 0);
        gl.uniform1f(P.post.u('uTime'), a.time); gl.uniform1f(P.post.u('uWarm'), a.warm);
        gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    console.warn('[intro] landscape unavailable:', error.message);
    return null;
  }
}
