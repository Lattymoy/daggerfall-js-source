// LC1 (2026-09-23, Mac: "We need to take a chance and also make some insane improvements to our lighting system.
// Its already really good, but it could be much better while also improving performance"): CLUSTERED LIGHTS.
//
// The lane's lantern loop walked every one of the frame's lights (up to 48) in every lit fragment, asking each
// "am I in your range" before any work. src/render/lightClusters.js cuts the frustum into 16 x 9 x 24 cells, writes
// each light into the cells its view-space box touches, and the shader (enhancedLighting.js EL_CLUSTER_GLSL) walks
// the fragment's own cell's list. THE GRID IS AN ACCELERATION AND NOT A LAW: conservative (a fragment inside a
// light's sphere always finds it in its cell), and off - every light, as before - inside the sprite pass, the
// studio bake, a panel bracket, an overflowed frame and behind `?clusters=off`.
//
// Pinned here: the builder's laws (the slice arithmetic, a light behind the near plane, a light off-screen, the
// box's cells, conservative containment by a thousand random points against the shader's own cell arithmetic, the
// list's layout, the overflow); the shader's text (the block in every lane program, ONE loop body with two ways
// to count, the classic programs untouched); and the renderer on the fake GL (the two integer textures made with
// the lane, uploaded once per world frame, the samplers on their units, `uClusterOn` 1 on a world draw and 0
// inside the sprite pass and on a frame that is not the world's). tools/lightClusterProbe.mjs reads the picture
// back on a real GPU against the plain loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLUSTER_X, CLUSTER_Y, CLUSTER_Z, CLUSTER_CELLS, CLUSTER_NEAR, CLUSTER_FAR, CLUSTER_Z_SCALE, CLUSTER_LIST_W, CLUSTER_LIST_ROWS, CLUSTER_LIST_CAP, CLUSTER_GRID_W, CLUSTER_GRID_H,
  CLUSTER_GRID_UNIT, CLUSTER_LIST_UNIT, clustersOn, sliceOf, clusterCellOf, createClusterSpace, cellsOfSphere, buildLightClusters, cellLights, cellOfPoint, meanListLength,
} from '../src/render/lightClusters.js';
import { EL_CLUSTER_GLSL, EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_DECAL_FS, EL_FAR_RING_FS, EL_LANE, EL_MAX_LIGHTS } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { AIR_ADAPT_UNIT, AIR_CONTACT_UNIT } from '../src/render/airPass.js';
import { SHADOW_SUN_UNIT, SHADOW_POINT_UNIT } from '../src/render/shadowPass.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.1, 400));   // the hosts' shape: an x-mirrored perspective
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -1], [0, 1, 0]);   // the eye at the origin looking down -z
const VP = [0, 0, 1920, 1080];

/** A seeded LCG, so the thousand points are the same thousand every run. */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

test('LC1: the grid - 16 x 9 x 24 cells over [0.25, 256] of depth in exponential slices (the shader\'s own arithmetic), the two textures\' shapes, the units below the air\'s and the shadows\', the door (mutants: a linear slice; a slice past the last; the units colliding with the shadow maps\')', () => {
  assert.deepEqual([CLUSTER_X, CLUSTER_Y, CLUSTER_Z, CLUSTER_CELLS], [16, 9, 24, 3456]);
  assert.deepEqual([CLUSTER_NEAR, CLUSTER_FAR], [0.25, 256]);
  assert.ok(Math.abs(CLUSTER_Z_SCALE - CLUSTER_Z / Math.log(CLUSTER_FAR / CLUSTER_NEAR)) < 1e-12);
  assert.equal(sliceOf(0), 0); assert.equal(sliceOf(0.25), 0); assert.equal(sliceOf(0.1), 0, 'inside the near: the first slice');
  assert.equal(sliceOf(CLUSTER_FAR), CLUSTER_Z - 1); assert.equal(sliceOf(1e6), CLUSTER_Z - 1, 'past the far: the last slice, never beyond the grid');
  // exponential: each slice's start is the previous times a constant ratio
  const ratio = Math.pow(CLUSTER_FAR / CLUSTER_NEAR, 1 / CLUSTER_Z);
  for (let k = 1; k < CLUSTER_Z; k++) {
    const start = CLUSTER_NEAR * Math.pow(ratio, k);
    assert.equal(sliceOf(start * 1.0001), k, `slice ${k} begins at ${start.toFixed(3)}`);
    assert.equal(sliceOf(start * 0.9999), k - 1);
  }
  const perDoubling = Math.log(2) * CLUSTER_Z_SCALE;   // about 2.4 slices, wherever the doubling starts
  for (const [a, b] of [[1, 2], [4, 8], [50, 100]]) assert.ok(Math.abs((sliceOf(b) - sliceOf(a)) - perDoubling) <= 1, `a doubling of depth from ${a} is ${sliceOf(b) - sliceOf(a)} slices - within a slice of ${perDoubling.toFixed(2)} anywhere: exponential`);
  assert.equal(clusterCellOf(1, 2, 3), 1 + 2 * 16 + 3 * 144);
  assert.deepEqual([CLUSTER_GRID_W, CLUSTER_GRID_H, CLUSTER_LIST_W, CLUSTER_LIST_ROWS, CLUSTER_LIST_CAP], [144, 24, 256, 256, 65536]);
  assert.deepEqual([CLUSTER_GRID_UNIT, CLUSTER_LIST_UNIT], [9, 10]);
  for (const u of [AIR_ADAPT_UNIT, AIR_CONTACT_UNIT, SHADOW_SUN_UNIT, SHADOW_POINT_UNIT]) assert.ok(u !== 9 && u !== 10, 'the units are the grid\'s alone');
  assert.equal(clustersOn(''), true); assert.equal(clustersOn('?clusters=off'), false); assert.equal(clustersOn('?air=off'), true);
  const sp = createClusterSpace();
  assert.equal(sp.counts.length, CLUSTER_CELLS); assert.equal(sp.grid.length, CLUSTER_CELLS * 2); assert.equal(sp.list.length, CLUSTER_LIST_CAP);
  assert.equal(sp.built, false);
});

test('LC1: a sphere\'s cells - behind the near plane none, off-screen none, straight ahead a box of tiles about the centre and the slices its depth spans, the near face clamped to the near plane when the eye is inside it (mutants: the far corner projected without the clamp, which flips behind the eye; the slices from the centre alone)', () => {
  const box = new Int16Array(7);
  assert.equal(cellsOfSphere(0, 0, 5, 1, PROJ, box, 0), false, 'wholly behind the eye (view z positive, past its radius): no cell');
  // AUDIT LC1: a sphere that ends inside the near band is slice 0, EVERY tile - the hosts' near planes (0.05, 0.2)
  // sit inside CLUSTER_NEAR, so fragments live there and read slice 0 at their own depth
  assert.equal(cellsOfSphere(0, 0, -0.1, 0.1, PROJ, box, 0), true, 'a sphere inside the near band: slice 0, every tile');
  assert.deepEqual([...box], [0, CLUSTER_X - 1, 0, CLUSTER_Y - 1, 0, 0, 1]);
  assert.equal(cellsOfSphere(200, 0, -10, 1, PROJ, box, 0), false, 'far off to the side: no cell');
  // a unit sphere ten ahead: a small box of tiles about the middle, slices spanning 9..11 of depth
  assert.equal(cellsOfSphere(0, 0, -10, 1, PROJ, box, 0), true);
  const [x0, x1, y0, y1, z0, z1] = box;
  assert.ok(x0 <= 7 && x1 >= 8 && x1 - x0 <= 3, `about the middle across: ${x0}..${x1}`);
  assert.ok(y0 <= 4 && y1 >= 4 && y1 - y0 <= 3, `about the middle down: ${y0}..${y1}`);
  assert.equal(z0, sliceOf(9)); assert.equal(z1, sliceOf(11));
  assert.equal(box[6], 0, 'ten ahead: no part of it in the near band');
  // the eye inside the sphere: the near face is the near plane, and the box is the whole screen
  assert.equal(cellsOfSphere(0, 0, -0.5, 4, PROJ, box, 0), true);
  assert.deepEqual([...box], [0, CLUSTER_X - 1, 0, CLUSTER_Y - 1, 0, sliceOf(4.5), 1], 'a light about the eye touches every tile from the first slice, and is flagged for the band');
  // an orthographic matrix (w = 1) still gives cells - the extent through the matrix, the slices off the view depth (the renderer builds no grid for a panel frame, which is where such a matrix is used; the builder itself has no opinion)
  const ortho = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]);
  assert.equal(cellsOfSphere(0, 0, -10, 1, ortho, box, 0), true);
  assert.deepEqual([box[0], box[1], box[4], box[5], box[6]], [0, CLUSTER_X - 1, sliceOf(9), sliceOf(11), 0], 'a unit sphere spans the unit clip box: every tile across');
  // a matrix that puts a corner behind the eye (w <= 0) is refused, never divided through
  const bad = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0]);
  assert.equal(cellsOfSphere(0, 0, -10, 1, bad, box, 0), false);
});

test('LC1: the build - every light into the cells its box touches, the list one flat array in cell order with (offset, count) per cell, and CONSERVATIVE: a thousand random points inside the lights\' spheres each find their light in the cell the shader would read (mutants: the box\'s far tile dropped; the slice off the centre; the list written without the offsets; the count left as the cursor)', () => {
  const lights = new Float32Array([
    0, 1.7, -10, 3,        // 0: ahead
    -6, 2, -20, 8,         // 1: left and far
    4, 1, -3, 2,           // 2: near right
    0, 1.7, 5, 4,          // 3: behind the eye - never
    30, 1, -10, 1,         // 4: off to the side - never
    0, 0, 0, 0,            // 5: no range - never
  ]);
  const sp = createClusterSpace();
  assert.equal(buildLightClusters(lights, 6, VIEW, PROJ, sp), true);
  assert.equal(sp.built, true);
  assert.equal(sp.lights, 3, 'three lights touched the grid');
  let total = 0;
  for (let c = 0; c < CLUSTER_CELLS; c++) { assert.equal(sp.grid[c * 2], total, 'the offsets are a prefix sum'); total += sp.grid[c * 2 + 1]; }
  assert.equal(total, sp.total); assert.ok(sp.total > 0);
  assert.equal(sp.rows, Math.ceil(sp.total / CLUSTER_LIST_W));
  for (let e = 0; e < sp.total; e++) assert.ok([0, 1, 2].includes(sp.list[e]), 'only the three that touch are listed');
  // the shader's read: a thousand points inside the spheres, each finding its light in its cell
  const rnd = rng(0x1c1);
  let tested = 0;
  for (let k = 0; k < 3000 && tested < 1000; k++) {
    const i = k % 3, r = lights[i * 4 + 3];
    const dx = (rnd() * 2 - 1) * r, dy = (rnd() * 2 - 1) * r, dz = (rnd() * 2 - 1) * r;
    if (dx * dx + dy * dy + dz * dz >= r * r) continue;
    const wp = [lights[i * 4] + dx, lights[i * 4 + 1] + dy, lights[i * 4 + 2] + dz];
    const cell = cellOfPoint(wp, VIEW, PROJ, VP);
    if (!cell) continue;   // behind the eye or off-screen: no fragment
    tested++;
    assert.ok(cellLights(sp, ...cell).includes(i), `light ${i} listed in cell ${cell} for point ${wp.map((v) => v.toFixed(2))}`);
  }
  assert.ok(tested >= 600, `enough points landed on screen (${tested})`);
  // a cell far from every light lists nothing
  assert.deepEqual(cellLights(sp, 15, 8, CLUSTER_Z - 1), []);
  assert.ok(meanListLength(sp) < 1, `a fragment walks under one light on average here (${meanListLength(sp).toFixed(3)}), not six`);
});

test('LC1: the overflow - forty-eight lights each about the eye would list every cell forty-eight times, past the list; the build answers false and the frame walks every light (mutant: the cap ignored and the list written past its end)', () => {
  const lights = new Float32Array(48 * 4);
  for (let i = 0; i < 48; i++) { lights[i * 4] = 0; lights[i * 4 + 1] = 1.7; lights[i * 4 + 2] = -0.5; lights[i * 4 + 3] = 200; }
  const sp = createClusterSpace();
  assert.equal(buildLightClusters(lights, 48, VIEW, PROJ, sp), false);
  assert.equal(sp.built, false); assert.equal(sp.lights, 48, 'they all touched');
  assert.ok(48 * CLUSTER_CELLS > CLUSTER_LIST_CAP);
  // ...and a frame of forty-eight modest lanterns fits with room to spare
  for (let i = 0; i < 48; i++) { lights[i * 4] = (i % 8 - 4) * 6; lights[i * 4 + 1] = 2; lights[i * 4 + 2] = -5 - Math.floor(i / 8) * 8; lights[i * 4 + 3] = 12; }
  assert.equal(buildLightClusters(lights, 48, VIEW, PROJ, sp), true);
  assert.ok(sp.total < CLUSTER_LIST_CAP / 2, `${sp.total} entries - forty-eight twelve-unit lanterns in the near field are a full grid, and still under half the list`);
  assert.ok(meanListLength(sp) < 48 / 4, `a fragment walks ${meanListLength(sp).toFixed(2)} lights on average, of 48`);
  // the list entry is a byte: a light past 255 is never listed
  assert.ok(sp.list instanceof Uint8Array);
});

test('LC1: the shader - the block in every lane program (not the far ring, which has no lanterns), ONE loop body with two ways to count (the cell\'s list, or every light with the grid off), the flat\'s loop the same, the in-scatter loop still every light (a glow along the whole ray is no one cell\'s), and the classic programs untouched (mutants: the loop on `i < uPointCount` again; the flat left on the plain loop; the classic FS given the block)', () => {
  assert.match(EL_CLUSTER_GLSL, /uniform highp usampler2D uClusterGrid;[\s\S]*uniform highp usampler2D uClusterList;[\s\S]*uniform vec4 uClusterRect;[\s\S]*uniform vec2 uClusterZ;[\s\S]*uniform vec4 uCamFwd;[\s\S]*uniform int uClusterOn;/);
  assert.match(EL_CLUSTER_GLSL, /uvec2 elCluster\(vec3 wp\) \{\n  if \(uClusterOn == 0\) return uvec2\(0u, uint\(uPointCount\)\);/, 'the grid off: every light');
  assert.match(EL_CLUSTER_GLSL, new RegExp(`ivec2\\(${CLUSTER_X - 1}, ${CLUSTER_Y - 1}\\)`), 'the tile clamped to the grid');
  assert.match(EL_CLUSTER_GLSL, /float depth = dot\(uCamFwd\.xyz, wp\) \+ uCamFwd\.w;\n  int z = clamp\(int\(log\(max\(depth \* uClusterZ\.x, 1\.0\)\) \* uClusterZ\.y\), 0, 23\);/, 'the slice: log of depth over near, scaled, clamped - sliceOf\'s own');
  assert.match(EL_CLUSTER_GLSL, new RegExp(`texelFetch\\(uClusterGrid, ivec2\\(t\\.x \\+ t\\.y \\* ${CLUSTER_X}, z\\), 0\\)\\.rg;`));
  assert.match(EL_CLUSTER_GLSL, /int elClusterLight\(uvec2 cell, int j\) \{\n  if \(uClusterOn == 0\) return j;\n  int at = int\(cell\.x\) \+ j;\n  return int\(texelFetch\(uClusterList, ivec2\(at & 255, at >> 8\), 0\)\.r\);/, 'the list: 256 to a row');
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['bb', EL_BB_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS], ['decal', EL_DECAL_FS]]) {
    assert.ok(fs.includes(EL_CLUSTER_GLSL), `${name}: the block`);
    assert.match(fs, new RegExp(`uvec2 cell = elCluster\\(wp\\);   // LC1\\n  int cellCount = int\\(cell\\.y\\);\\n  for \\(int j = 0; j < ${EL_MAX_LIGHTS}; j\\+\\+\\) \\{\\n    if \\(j >= cellCount\\) break;\\n    int i = elClusterLight\\(cell, j\\);\\n    vec3 L = uPointLights\\[i\\]\\.xyz - wp;`), `${name}: the lit loop walks the cell`);
    assert.match(fs, new RegExp(`uvec2 cell = elCluster\\(wp\\);   // LC1\\n  int cellCount = int\\(cell\\.y\\);\\n  for \\(int j = 0; j < ${EL_MAX_LIGHTS}; j\\+\\+\\) \\{\\n    if \\(j >= cellCount\\) break;\\n    int i = elClusterLight\\(cell, j\\);\\n    float d = length\\(uPointLights\\[i\\]\\.xyz - wp\\);`), `${name}: the flat loop walks the cell`);
    assert.match(fs, /vec3 elInScatter\(vec3 wp\) \{[\s\S]*?for \(int i = 0; i < 48; i\+\+\) \{\n    if \(i >= uPointCount\) break;/, `${name}: the in-scatter loop is still every light`);
    assert.equal((fs.match(/if \(i >= uPointCount\) break;/g) ?? []).length, 1, `${name}: the only "every light" loop left is the in-scatter`);
  }
  assert.ok(!EL_FAR_RING_FS.includes('uClusterGrid'), 'the far ring lights by no lantern');
  const rsrc = rd('src/render/renderer.js');
  for (const name of ['FS', 'CHAR_FS', 'BB_FS', 'TERRAIN_FS', 'DECAL_FS']) {   // the classic programs, by source: untouched
    const at = rsrc.indexOf(`const ${name} = \``);
    const body = rsrc.slice(at, rsrc.indexOf('`;', at));   // the literal's close
    assert.ok(at > 0 && !body.includes('uClusterGrid') && !body.includes('elCluster'), `the classic ${name} is untouched`);
  }
  assert.equal(EL_LANE.maxLights, EL_MAX_LIGHTS);
  assert.match(rd('src/render/enhancedLighting.js'), /renderer\.setClusters\?\.\(clustersOn\(search\)\);/, 'the door read at the lane\'s install, like the air\'s');
});

/** A recording fake GL (el2's shape). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, RG16UI: 33338, R8UI: 33330, RG_INTEGER: 33320, RED_INTEGER: 36244, UNSIGNED_SHORT: 5123, UNSIGNED_BYTE: 5121, TEXTURE_2D: 3553 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const uni = (calls, name) => calls.filter((c) => (c[0] === 'uniform1i' || c[0] === 'uniform4fv' || c[0] === 'uniform2fv') && c[1] === name);

test('LC1: the renderer on the fake GL - the two integer textures made with the lane (RG16UI 144x24, R8UI 256x256, NEAREST), the grid built and uploaded once per WORLD frame with the lights set, the samplers on units 9 and 10 and `uClusterOn` 1 in the mesh upload; a frame that is not the world\'s (no WORLD_FRAME) uploads nothing and says 0; the classic set never speaks of it (mutants: the grid built on every frame kind; the textures made per frame; `uClusterOn` left 1 outside a world frame)', () => {
  const { gl, calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  assert.equal(r._clusterTex, null, 'the classic set: no grid');
  calls.length = 0;
  r.setLightingLane(EL_LANE);
  const made = calls.filter((c) => c[0] === 'texImage2D' && (c[3] === gl.RG16UI || c[3] === gl.R8UI));   // [name, target, level, internal, w, h, border, format, type, data]
  assert.equal(made.length, 2, 'two integer textures');
  assert.deepEqual(made.map((c) => [c[3], c[4], c[5], c[7], c[8]]), [[gl.RG16UI, CLUSTER_GRID_W, CLUSTER_GRID_H, gl.RG_INTEGER, gl.UNSIGNED_SHORT], [gl.R8UI, CLUSTER_LIST_W, CLUSTER_LIST_ROWS, gl.RED_INTEGER, gl.UNSIGNED_BYTE]]);
  assert.ok(r._clusterTex && r._clusters, 'made with the lane');
  const tex = r._clusterTex;
  r.setLightingLane(null); r.setLightingLane(EL_LANE);
  assert.equal(r._clusterTex, tex, 'made once, kept across the lane going and coming');
  // a world frame with two lanterns ahead: built, uploaded, walked
  r.setPointLights(new Float32Array([0, 2, -6, 12, 4, 2.5, -3, 7]), new Float32Array([1, 1, 1]));
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
  assert.equal(r._clustersLive, true);
  const subs = calls.filter((c) => c[0] === 'texSubImage2D');
  assert.equal(subs.length, 2, 'the grid and the list rows, once');
  assert.deepEqual([subs[0][5], subs[0][6], subs[0][7]], [CLUSTER_GRID_W, CLUSTER_GRID_H, gl.RG_INTEGER]);
  assert.equal(subs[1][5], CLUSTER_LIST_W); assert.equal(subs[1][6], r._clusters.rows); assert.equal(subs[1][7], gl.RED_INTEGER);
  assert.deepEqual(uni(calls, 'uClusterGrid').map((c) => c[2]), [CLUSTER_GRID_UNIT]);
  assert.deepEqual(uni(calls, 'uClusterList').map((c) => c[2]), [CLUSTER_LIST_UNIT]);
  assert.deepEqual(uni(calls, 'uClusterOn').map((c) => c[2]), [1], 'the mesh program: walk the grid');
  const rect = uni(calls, 'uClusterRect')[0][2];
  assert.deepEqual([...rect].map((v) => +v.toFixed(6)), [0, 0, +(CLUSTER_X / 320).toFixed(6), +(CLUSTER_Y / 200).toFixed(6)], 'the canvas as the world viewport');
  const fwd = uni(calls, 'uCamFwd')[0][2];
  assert.deepEqual([...fwd].map((v) => +v.toFixed(6)), [-VIEW[2], -VIEW[6], -VIEW[10], -VIEW[14]].map((v) => +v.toFixed(6)), 'the view\'s third row negated: the depth');
  const binds = calls.filter((c) => c[0] === 'activeTexture' && (c[1] === 1000 + CLUSTER_GRID_UNIT || c[1] === 1000 + CLUSTER_LIST_UNIT));
  assert.ok(binds.length >= 2, 'the units taken');
  // a frame that is not the world's: nothing built, the shader told 0
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.45, 0.8, 0.35]));
  assert.equal(r._clustersLive, false);
  assert.equal(calls.filter((c) => c[0] === 'texSubImage2D').length, 0);
  assert.deepEqual(uni(calls, 'uClusterOn').map((c) => c[2]), [0]);
  // the door: off, a world frame builds nothing and walks every light
  r.setClusters(false);
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
  assert.equal(r._clustersLive, false);
  assert.deepEqual(uni(calls, 'uClusterOn').map((c) => c[2]), [0]);
  r.setClusters(true);
  // the sprite pass inside a world frame: the character program is told 0 while the depth is up
  r.beginFrame(PROJ, VIEW, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
  assert.equal(r._clustersLive, true);
  calls.length = 0;
  r._spriteDepth = 1;
  r._uploadEl('char');
  assert.deepEqual(uni(calls, 'uClusterOn').map((c) => c[2]), [0], 'a sprite pass is another view: every light');
  r._spriteDepth = 0;
  calls.length = 0;
  r._uploadEl('bb');
  assert.deepEqual(uni(calls, 'uClusterOn').map((c) => c[2]), [1], 'the world\'s own billboards walk the grid');
  // the classic set: no grid, and the uploads name nothing of it
  r.setLightingLane(null);
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
  assert.equal(r._clustersLive, false);
  assert.equal(uni(calls, 'uClusterOn').length, 0);
  assert.equal(calls.filter((c) => c[0] === 'texSubImage2D').length, 0);
});

test('LC1: the host wiring by source - the build sits in beginFrame after the lane\'s passes under the world-frame gate, the upload rides _uploadEl under the contact block\'s gate, the textures are made at the lane\'s install (mutants: the build before the passes, which reads last frame\'s viewport; the upload gated by nothing)', () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /this\._beginLane\(proj, view, lightDir, opts\?\.world === true\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*this\._clustersLive = !!this\._lane && opts\?\.world === true && !this\._panelSaved && this\._spriteDepth === 0 && this\._studioDepth === 0 && this\._buildClusters\(proj, view\);/);
  assert.match(r, /this\._uploadClusters\(this\._el\[key\]\.cluster, this\._clustersLive && this\._spriteDepth === 0 && this\._studioDepth === 0 && !this\._panelSaved\);/);
  assert.match(r, /if \(lane\) this\._ensureClusters\(\);/);
  assert.match(r, /const vp = this\._worldViewportPx \?\? \[0, 0, this\.canvas\.width, this\.canvas\.height\];/, 'the docked-HUD viewport (ROAD-E E5) is the rect the tiles are cut over');
});

test('AUDIT LC1: THE NEAR BAND - a fragment nearer the eye than CLUSTER_NEAR (the hosts\' near planes are 0.05 and 0.2) still finds a light whose reach passes beside the view axis: the light is written to every tile of slice 0, and the hull serves the slices beyond (mutants: the band flag dropped, so the hull computed at 0.25 falls a tile short for a fragment at 0.1; a sphere inside the band dropped whole)', () => {
  const near = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.05, 400));   // the dungeon lens
  const eye = lookAt([0, 1.7, 0], [0, 1.7, -1], [0, 1, 0]);
  // the auditor's three: a lamp beside the axis with a fragment at depth 0.2 near the axis; a lamp above with a
  // fragment at depth 0.1; a tiny light with a fragment at 54% of its range inside the band
  const lights = new Float32Array([-1.8, 1.7, -0.3, 2, 0, 3.6, 0, 2, 0.1, 1.7, -0.12, 0.1]);
  const sp = createClusterSpace();
  assert.equal(buildLightClusters(lights, 3, eye, near, sp), true);
  for (const [i, wp] of [[0, [0.19, 1.7, -0.2]], [1, [0.02, 1.69, -0.1]], [2, [0.06, 1.7, -0.1]]]) {
    const cell = cellOfPoint(wp, eye, near, VP);
    assert.ok(cell, `the fragment is on screen (${cell})`);
    assert.equal(cell[2], 0, 'inside the band: slice 0');
    assert.ok(cellLights(sp, ...cell).includes(i), `light ${i} listed in cell ${cell}`);
  }
  // the band flag does not spill past slice 0: a fragment well beyond the band still reads the hull, and the hull is right
  const far = cellOfPoint([-1.0, 1.7, -1.5], eye, near, VP);
  assert.ok(far[2] > 0 && cellLights(sp, ...far).includes(0));
  const box = new Int16Array(7);
  assert.equal(cellsOfSphere(-1.8, 0, -0.3, 2, near, box, 0), true); assert.equal(box[6], 1, 'flagged: it reaches into the band');
  assert.equal(cellsOfSphere(0, 0, -10, 1, near, box, 0), true); assert.equal(box[6], 0, 'ten ahead: not flagged');
});
