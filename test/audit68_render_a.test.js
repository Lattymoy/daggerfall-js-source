// AUDIT 68 (2026-09-24, Mac: "a deep comprehensive audit across the entirety of the codebase ... No band aids"):
// cluster render_a - src/render from airPass to perfMeter. Each pin names its finding's key, and each failed on the
// code it fixes: the billboard key re-minted by the replays too, the AO mixed only into a frame the pass prepared,
// the ?perf frame closed without an air pass, the flat clock that keeps every owed advance, the JS scatter on the
// GLSL's chord, the cloud reader and the batch sphere in their one homes, and the dead code gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS, EL_DECAL_FS, EL_TERRAIN_FS, EL_CHAR_FS, elScatter } from '../src/render/enhancedLighting.js';
import { CLOUD_SHADOW_GLSL } from '../src/render/cloudShadow.js';
import { FlatAnim, LIGHT_FPS } from '../src/render/flatAnimation.js';
import { LabGrassRenderer, GRASS_CELL } from '../src/render/labGrass.js';
import { PERF_EVERY } from '../src/render/perfMeter.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const near = (a, b, eps) => Math.abs(a - b) <= eps;

/** A recording WebGL2 deep enough for the renderer, its lane, its shadow pass and its air pass (the shadowreach and
 *  audit_el rigs'); `extra` answers named members first. */
function recordingGl(extra = {}) {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160, TRIANGLE_STRIP: 5, ONE: 1 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in extra) return extra[k];
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const boundIds = (calls) => calls.filter((c) => c[0] === 'bindTexture' && c[2]?.id).map((c) => c[2].id);

test('AUDIT 68 S16-bbkey-stale-shadow-reach: a walker recorded for the maps WITHOUT being drawn (SHADOW-REACH\'s recordShadowBillboards) casts and blooms his CURRENT frame - both replays re-key the batch, not only the draw', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.textures.set('385_0#0', { id: 'rec0' }); r.textures.set('385_4#0', { id: 'rec4' });
  r.emissionTextures.set('385_0#0', { id: 'em0' }); r.emissionTextures.set('385_4#0', { id: 'em4' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0, new Float32Array([1, 1, 1]));
  // the mobile's own shape (MAC4): the record carries `record#frame`, the frame field is never set
  const walker = { archive: 385, record: '0#0', vao: { id: 'vao-walker' }, indexCount: 6, buffers: [], origin: [0, 0, 0], bounds: new Float32Array([0, 0, 0, 2]), size: { w: 1, h: 2 } };
  const lightDir = new Float32Array([0, 1, 0]);
  const frame = (draw) => {
    r.setPointLights(new Float32Array([0, 2, 0, 10]), new Float32Array([1, 1, 1]));
    r.beginFrame(I, I, lightDir, WORLD_FRAME);
    draw();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  };
  frame(() => r.drawBillboards([walker], [1, 0, 0], [0, 1, 0]));   // on screen: drawn, and keyed by the draw
  walker.record = '4#0';   // he walks off screen and his walk goes on: the host view-culls him, and records him for the maps alone
  calls.length = 0;
  frame(() => r.recordShadowBillboards([walker], [1, 0, 0], [0, 1, 0]));
  frame(() => r.recordShadowBillboards([walker], [1, 0, 0], [0, 1, 0]));
  const ids = boundIds(calls);
  assert.ok(ids.includes('rec4'), `the shadow replay binds his current frame: ${ids.join(',')}`);
  assert.ok(ids.includes('em4'), `and so does the air pass's emission replay: ${ids.join(',')}`);
  assert.ok(!ids.includes('rec0') && !ids.includes('em0'), `never the frame he left the view on: ${ids.join(',')}`);
  assert.equal(walker._bbKey, '385_4#0');
});

test('AUDIT 68 S16-bbkey-stale-shadow-reach: the key has ONE home - billboardKey.js - and the draw and both replays call it (no `b._bbKey ??` fallback that trusts a stale key)', async () => {
  const { billboardKey } = await import('../src/render/billboardKey.js');
  const b = { archive: 385, record: '0#0' };
  assert.equal(billboardKey(b), '385_0#0');
  b.record = '4#0'; assert.equal(billboardKey(b), '385_4#0', 'the record moved, the key follows');
  b.frame = 2; assert.equal(billboardKey(b), '385_4#0#2', 'FA1: an animated flat keys its frame');
  b.archive = 471; assert.equal(billboardKey(b), '471_4#0#2');
  for (const f of ['src/render/renderer.js', 'src/render/shadowPass.js', 'src/render/airPass.js']) {
    const src = rd(f);
    assert.match(src, /import \{ billboardKey \} from '\.\/billboardKey\.js';/, `${f} imports the one home`);
    assert.doesNotMatch(src, /b\._bbKey \?\?|b\._bbKey = /, `${f} neither trusts nor mints a key of its own`);
  }
});

test('AUDIT 68 S16-air-stale-ao-unprepared: a frame the air pass was NOT prepared for (a menu, a video, the travel map) resolves with the AO mixed at 0 - not the last world frame\'s crevices at 0.75', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.textures.set('1_1', {});
  const world = () => { r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME); r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 }); };
  world(); world();
  const mixes = () => calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uAOMix').map((c) => c[2]);
  assert.ok(mixes().pop() > 0, 'a world frame takes its AO');
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));   // no WORLD_FRAME: the frame image is bound, nothing prepared it
  r.drawScreenQuad({ id: 'menu' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(r.air.fresh, false);
  assert.deepEqual(mixes(), [0], 'the resolve of an unprepared frame multiplies in no AO');
  // and a world frame after it takes its own again
  calls.length = 0;
  world();
  assert.ok(mixes().pop() > 0);
  // release(): a prepare the resolve never took is no frame's when the door reopens
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.equal(r.air.fresh, true);
  r.air.release();
  assert.equal(r.air.fresh, false, 'the door closed mid-frame: the prepare is dropped with the target');
});

test('AUDIT 68 S16-perf-no-resolve-leak: `?perf=zones` with NO air pass (the classic lane; `?air=off`) closes every world frame - the line prints, and the zone queries are read and deleted instead of piling up', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const lines = [];
  const info = console.info;
  let created = 0, deleted = 0;
  const ext = { TIME_ELAPSED_EXT: 35007, GPU_DISJOINT_EXT: 36795 };
  const { canvas } = recordingGl({
    getExtension: (n) => (n === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    createQuery: () => { created++; return { q: created }; },
    deleteQuery: () => { deleted++; },
    getQueryParameter: () => 1,
    getParameter: (p) => (p === ext.GPU_DISJOINT_EXT ? false : new Float32Array(4)),
  });
  try {
    Object.defineProperty(globalThis, 'location', { value: { search: '?perf=zones' }, configurable: true, writable: true });
    console.info = (l) => { lines.push(String(l)); };
    const r = new Renderer(canvas);   // the classic lane: no AirPass, no resolve
    assert.ok(r._perf, 'the meter is on');
    assert.equal(r.air, null);
    for (let i = 0; i < PERF_EVERY * 2 + 1; i++) {
      r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
      r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });
    }
    assert.equal(r._perf.frames, PERF_EVERY * 2 + 1, 'every frame closed at its first screen draw, as the resolve closes it');
    assert.equal(r._perfOpen, false);
    assert.equal(lines.filter((l) => l.startsWith('[perf]')).length, 2, `a line every ${PERF_EVERY} frames: ${lines.length}`);
    assert.ok(r._perf.zoneQueries.length <= 4, `the queries are polled: ${r._perf.zoneQueries.length} pending`);
    assert.ok(created - deleted <= 4, `and deleted: ${created} made, ${deleted} deleted`);
    // a world frame that draws no screen quad is closed by the next frame's start
    const before = r._perf.frames;
    r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);   // draws no screen quad
    r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
    assert.equal(r._perf.frames, before + 1, 'the frame that drew no screen quad is closed, once, by the next one\'s start');
    assert.equal(r._perfOpen, true, 'and the new one is open, owed its own close');
  } finally {
    console.info = info;
    if (saved) Object.defineProperty(globalThis, 'location', saved); else delete globalThis.location;
  }
});

test('AUDIT 68 S16-flatanim-stall-guard: the fixed step keeps EVERY owed advance - a two-frame flame at 10 Hz shows the fixed clock\'s frame on every tick, and a one-shot hitched past its length ends', () => {
  const a = new FlatAnim(210, 2);   // the lights archive: 12 fps, two frames
  assert.equal(a.fps, LIGHT_FPS);
  for (let i = 1; i <= 100; i++) {
    a.tick(0.1);
    if (i % 5 === 0) continue;   // 1.2 i periods: a whole number every fifth tick, a float coin-toss - skipped
    const owed = Math.floor(i * 1.2);   // advances since the first frame
    assert.equal(a.frame, owed % 2, `tick ${i}: ${owed} advances owed`);
  }
  // the one-shot impact flash (15 fps, four frames, 0.267 s): one 0.3 s hitch plays it out
  const flash = new FlatAnim(380, 4, true, 15);
  flash.tick(0.3);
  assert.equal(flash.done, true, 'a gap longer than the animation ends it');
  // a long stall still costs a cycle at most, and lands where the whole gap would
  const b = new FlatAnim(210, 4), c = new FlatAnim(210, 4);
  b.tick(60.04);
  for (let i = 0; i < 1501; i++) c.tick(0.04);
  assert.equal(b.frame, c.frame, 'a minute in one tick and a minute in 1501 land on the same frame');
});

test('AUDIT 68 S16-elscatter-twin-drift: the JS scatter is the GLSL\'s, term for term - the ray\'s chord through the light\'s sphere, and nothing for a ray that misses it', () => {
  const dir = [0, 0, 1];
  assert.equal(elScatter([5, 0, 6], 4, dir, 20, 0.05), 0, 'five off the ray, range four: the ray misses the sphere');
  const chord = Math.sqrt(4 * 4 - 2 * 2);
  assert.ok(near(elScatter([2, 0, 6], 4, dir, 20, 0.05), 0.05 * (Math.atan(chord / 2) - Math.atan(-chord / 2)) / 2, 1e-12), 'the window is t0 -+ sqrt(r^2 - h^2)');
  assert.ok(near(elScatter([2, 0, 6], 30, dir, 20, 0.05), 0.05 * (Math.atan(14 / 2) - Math.atan(-6 / 2)) / 2, 1e-12), 'a sphere wider than the ray: the ray itself clips it');
});

test('AUDIT 68 S16-el-cloudshadow-dup: every lane shader takes the cloud reader from its one home, CLOUD_SHADOW_GLSL - no hand copy', () => {
  for (const [name, fs] of Object.entries({ EL_MESH_FS, EL_BB_FS, EL_DECAL_FS, EL_TERRAIN_FS, EL_CHAR_FS })) {
    assert.ok(fs.includes(CLOUD_SHADOW_GLSL), `${name} interpolates the leaf`);
    assert.equal(fs.split('float cloudShadowAt(vec3 wp)').length, 2, `${name} declares the reader once`);
  }
  assert.doesNotMatch(rd('src/render/enhancedLighting.js'), /float cloudShadowAt\(vec3 wp\) \{/, 'no copy left in the lane\'s source');
});

test('AUDIT 68 S16-batch-sphere-dup: the batch sphere\'s half-height lift has one home, batchSphere - shadowReachBatch and the SC1 scans take it, as batchVisible does', async () => {
  const { batchSphere } = await import('../src/render/bounds.js');
  assert.equal(typeof batchSphere, 'function');
  const out = new Float64Array(4);
  assert.deepEqual([...batchSphere({ bounds: [1, 2, 3, 0.5], origin: [10, 20, 30], size: { w: 1, h: 4 } }, out)], [11, 24, 33, 0.5], 'the lift is half the height');
  assert.equal(batchSphere({ origin: [0, 0, 0] }, out), null, 'no bounds, no sphere');
  for (const f of ['src/render/renderer.js', 'src/render/shadowPass.js']) {
    assert.doesNotMatch(rd(f), /\(b\.size\?\.h \?\? 0\) \* 0\.5/, `${f} writes no lift of its own`);
    assert.match(rd(f), /batchSphere\(b, this\._/, `${f} asks batchSphere`);
  }
});

/** the grass rig's GL (perf2's) */
function grassGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, NEAREST: 14, TRIANGLES: 15, BLEND: 16, SRC_ALPHA: 17, ONE_MINUS_SRC_ALPHA: 18, CULL_FACE: 19, TEXTURE0: 20, TEXTURE3: 23, UNSIGNED_SHORT: 25 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}

test('AUDIT 68 S16-grass-set-broken-dead: the lab\'s whole-scatter set() is gone (it uploaded floats into the packed lanes and a fourth buffer that no longer exists), and a draw with no field touches no GL', () => {
  assert.equal(typeof LabGrassRenderer.prototype.set, 'undefined');
  const { gl, calls } = grassGl();
  const r = new LabGrassRenderer(gl);
  r.count = 7;   // whatever a caller wrote, there are no slots
  calls.length = 0;
  r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, { sunDir: [0, 1, 0], amb: [1, 1, 1], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] }, 300, 'pixel');
  assert.deepEqual(calls, [], 'no program, no uniform, no draw');
});

test('AUDIT 68 S16-grass-point-alloc: _point moves the pointers off the constructor\'s ONE lane table - no array literal per drawn slot per frame, and the VAOs and writeSlot read the same table', () => {
  const src = rd('src/render/labGrass.js');
  const pt = src.slice(src.indexOf('  _point(slot) {'), src.indexOf('  _drawVisibleSlots(vp'));
  assert.doesNotMatch(pt, /\[\[|of \[/, 'no table literal in the per-slot call');
  const { gl, calls } = grassGl();
  const r = new LabGrassRenderer(gl);
  assert.ok(Object.isFrozen(r._lanes) && r._lanes.length === 3, 'the table, frozen');
  const perCell = 49;
  r.allocSlots(perCell, 4);
  calls.length = 0;
  r._point(3);
  const ptrs = calls.filter((c) => c[0] === 'vertexAttribPointer');
  assert.deepEqual(ptrs.map((c) => [c[1], c[3], c[4], c[6]]), r._lanes.map((L) => [L.loc, L.type, true, 3 * perCell * L.bytes]), 'each lane: its attribute, its type, normalised, at the slot\'s byte offset');
  assert.deepEqual(ptrs.map((c) => c[3]), [25, 11, 11], 'u16 then two u8');
  // writeSlot uploads each lane at the same stride
  const cell = { inst: new Float32Array(perCell * 4), inst2: new Float32Array(perCell * 4), rootY: new Float32Array(perCell), ground: new Float32Array(perCell * 3), count: perCell };
  for (let i = 0; i < perCell; i++) { cell.inst[i * 4] = (i % 7) / 7 * GRASS_CELL; cell.inst[i * 4 + 2] = 50; }
  calls.length = 0;
  r.writeSlot(2, cell);
  assert.deepEqual(calls.filter((c) => c[0] === 'bufferSubData').map((c) => c[2]), r._lanes.map((L) => 2 * perCell * L.bytes));
});

test('AUDIT 68 S16-sky-dead-uniforms / S16-classic-max-lights-dup / S16-facesbounds-dead / S16-air-dead-fields: the dead surface is gone', async () => {
  const sky = rd('src/render/enhancedSky.js');
  assert.doesNotMatch(sky, /uniform vec2 uWind;|uCloudSoft, uTime;|u\.uTime|u\.uWind\b|'uTime'|'uWind'/, 'the sky declares, looks up and uploads no time or wind - WIND2\'s uDrift moves the decks');
  assert.match(sky, /gl\.uniform2f\(u\.uDrift, /);
  assert.equal((await import('../src/render/enhancedLighting.js')).EL_CLASSIC_MAX_LIGHTS, undefined, 'the restated cap nothing read');
  assert.equal('facesBounds' in (await import('../src/render/characterMesh.js')), false, 'a bounds nothing called');
  const air = rd('src/render/airPass.js');
  assert.doesNotMatch(air, /this\._black = |this\._zeroWind = /, 'two fields nothing read');
  assert.match(air, /gl\.bindTexture\(gl\.TEXTURE_2D, this\.frame \? this\.frame\.prevDepth : null\);/, 'the contact unit: one binding, on or off');
});
