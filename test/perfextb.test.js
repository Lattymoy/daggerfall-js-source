// PERF-EXT (2026-09-25, two players via Mac: "fps issues in the exterior
// but fine in the interior", "me too my friend.. don't know why. I got a
// RX6600"; Mac: "I am not getting another player to do the work that youre
// suppose to do"). The flats and the frame's CPU - the pass the hunters
// measured on the synthetic town and the provers measured again. Each slice
// here is a cost the frame paid in JavaScript or in GL calls for a value
// that could not change, and each pin is on the thing that made it cheaper:
// one shape, one upload, no object, one block - never on a clock (a timing
// assertion on a shared runner is what broke this repo's deploy, STREAM1).
// The record is `bible/07-Rendering/Performance-Exterior.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { waterUniforms } from '../src/render/waterSurface.js';
import * as flatDistance from '../src/world/flatDistance.js';   // a namespace: on the base the positional form is missing, and only its pins fail

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, TEXTURE1: 1001, TEXTURE2: 1002, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
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

// ── PERF-EXT10: one shape ─────────────────────────────────────────────

/** The field names createBillboardBatch's literal mints, read off the source the way HARD3 reads them. */
function mintedFields() {
  const r = rd('src/render/renderer.js');
  const at = r.indexOf('createBillboardBatch(archive, record, size, centers');
  assert.ok(at > 0, 'the factory is where this pin thinks');
  const mint = r.slice(at);
  const lit = mint.slice(mint.indexOf('return {'), mint.indexOf('\n  }'));
  return new Set(lit.slice(lit.indexOf('{') + 1, lit.lastIndexOf('}'))
    .split(/,(?![^[\]]*\])/).map((part) => /^\s*(\w+)/.exec(part)?.[1]).filter(Boolean));
}

/** Every producer shape the game has, minted through the real factory and dressed the way its host dresses it. */
function producers(r) {
  const tree = r.createBillboardBatch(504, 1, { w: 2, h: 6 }, [[1, 0, 1], [3, 0, 2]]);
  tree._box = [0, 0, 0, 4, 6, 3]; tree.sway = 0.5; tree.origin = [0, 0, 0];   // world.js: a flora batch (EV3, WIND3)
  const npc = r.createBillboardBatch(182, 2, { w: 1, h: 2 }, [[0.2, 0, -0.2]]);
  npc._box = [0, 0, -1, 1, 2, 0]; npc.origin = [0, 0, 0];   // world.js: a town flat - a box, no sway
  const walker = r.createBillboardBatch(357, '0#1', { w: 1, h: 1.8 }, [[0, 0, 0]]);
  walker.origin = [0.3, 0, 0.3]; walker.conceal = null;   // cityGuards / exteriorFoes: a mobile, concealment answered
  const loot = r.createBillboardBatch(216, 3, { w: 0.6, h: 0.4 }, [[0, 0, 0]]);
  loot.origin = [0.1, 0, 0.1]; loot.noShadow = true;   // droppedLoot: on the ground, casts nothing
  const card = r.createBillboardBatch(357, '0#1', { w: 1, h: 1.8 }, [[0, 0, 0]]);
  card.origin = [0, 0, 0]; card.selfCard = true;   // eotbBody: the player's own card
  const gib = r.createBillboardBatch(380, 0, { w: 0.3, h: 0.3 }, [[0, 0, 0], [0.1, 0, 0]], { dynamic: true });   // BLOOD1b: a gib's chunks
  const cast = r.createBillboardBatch(504, 1, { w: 2, h: 6 }, [[0.5, 0, 0.5]]);
  cast.origin = [0, 0, 0];   // SHADOW-REACH: off screen, recorded for the maps alone
  const freed = r.createBillboardBatch(504, 1, { w: 2, h: 6 }, [[0, 0, 0]]);
  return { tree, npc, walker, loot, card, gib, cast, freed };
}

test('PERF-EXT10: every batch of every producer carries ONE key list, the one it was born with, through a night of frames - the draw\'s key, the shadow record\'s memory, the signature\'s id, a move, a gib\'s scratch and a free add no field (the base: a tree gains _box and sway at the host, then ten _sh*, four _bbKey*, _shId and _shMovedAt in the frame)', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['504_1', '182_2', '357_0#1', '216_3', '380_0']) r.textures.set(k, { id: k });
  const born = Object.keys(r.createBillboardBatch(504, 1, { w: 1, h: 1 }, [[0, 0, 0]])).join(',');
  const b = producers(r);
  const all = Object.values(b);
  for (const [name, x] of Object.entries(b)) assert.equal(Object.keys(x).join(','), born, `${name}: dressed by its host, still the birth list`);
  const lights = new Float32Array(8 * 4);
  for (let k = 0; k < 8; k++) { lights[k * 4] = k * 0.25 - 1; lights[k * 4 + 1] = 0.5; lights[k * 4 + 2] = 0.2; lights[k * 4 + 3] = 12; }
  for (let f = 0; f < 4; f++) {
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
    r.beginFrame(I, I, new Float32Array([0.3, -0.5, 0.2]), WORLD_FRAME);
    r.drawBillboards([b.tree, b.npc, b.loot, b.gib], RIGHT, UP);
    b.walker.origin[0] += 0.05;
    r.drawBillboards([b.walker, b.card], RIGHT, UP);
    r.moveBillboardBatch(b.gib, [[0, 0.05 * f, 0], [0.1, 0.05 * f, 0]]);
    r.recordShadowBillboards([b.cast], RIGHT, UP);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  }
  r.destroyBillboardBatch(b.freed);
  // the frame really reached every writer - or this pin says nothing
  assert.equal(typeof b.tree._bbKey, 'string', 'the draw keyed it');
  assert.equal(b.tree._shSeen, true, 'the shadow pass recorded it');
  assert.equal(typeof b.tree._shId, 'number', 'a lantern\'s static signature gave it an identity');
  assert.equal(typeof b.walker._shMovedAt, 'number', 'the walker moved');
  assert.equal(b.cast._shSeen, true, 'the cast-only batch was recorded');
  assert.ok(b.gib._moveScratch instanceof Float32Array, 'the gib moved');
  assert.equal(b.freed._dead, true, 'the free marked it');
  for (const [name, x] of Object.entries(b)) assert.equal(Object.keys(x).join(','), born, `${name}: after the frames, still the birth list`);
  assert.equal(new Set(all.map((x) => Object.keys(x).join(','))).size, 1);
});

test('PERF-EXT10: V8 agrees - after a frame, a flora batch, a town flat, a walker, a loot pile, the player\'s card and a gib share ONE hidden class (%HaveSameMap in a child with --allow-natives-syntax; on the base the other five are each off the tree\'s map)', () => {
  const url = (p) => pathToFileURL(join(ROOT, p)).href;
  const script = `
    const { Renderer, WORLD_FRAME } = await import(${JSON.stringify(url('src/render/renderer.js'))});
    const { EL_LANE } = await import(${JSON.stringify(url('src/render/enhancedLighting.js'))});
    let ids = 0;
    const gl = new Proxy({}, { get(o, k) { if (k in o) return o[k]; if (typeof k !== 'string') return undefined; let v;
      if (k === 'getProgramParameter' || k === 'getShaderParameter') v = () => true; else if (k === 'getUniformLocation') v = (_p, n) => n;
      else if (k === 'getParameter') v = () => new Float32Array(4); else if (k.startsWith('create')) v = () => ({ id: ++ids });
      else if (k.toUpperCase() === k) v = 1; else v = () => {}; o[k] = v; return v; } });
    const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
    r.setLightingLane(EL_LANE);
    for (const k of ['504_1', '182_2', '357_0#1', '216_3', '380_0']) r.textures.set(k, {});
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), R = new Float32Array([1, 0, 0]), U = new Float32Array([0, 1, 0]);
    const tree = r.createBillboardBatch(504, 1, { w: 2, h: 6 }, [[0.1, 0, 0.1]]); tree._box = [0, 0, 0, 1, 6, 1]; tree.sway = 0.5; tree.origin = [0, 0, 0];
    const npc = r.createBillboardBatch(182, 2, { w: 1, h: 2 }, [[0.2, 0, -0.2]]); npc._box = [0, 0, -1, 1, 2, 0]; npc.origin = [0, 0, 0];
    const walker = r.createBillboardBatch(357, '0#1', { w: 1, h: 1.8 }, [[0, 0, 0]]); walker.origin = [0.3, 0, 0.3]; walker.conceal = null;
    const loot = r.createBillboardBatch(216, 3, { w: 0.6, h: 0.4 }, [[0, 0, 0]]); loot.origin = [0.1, 0, 0.1]; loot.noShadow = true;
    const card = r.createBillboardBatch(357, '0#1', { w: 1, h: 1.8 }, [[0, 0, 0]]); card.origin = [0, 0, 0]; card.selfCard = true;
    const gib = r.createBillboardBatch(380, 0, { w: 0.3, h: 0.3 }, [[0, 0, 0]], { dynamic: true });
    const lights = new Float32Array([0, 0.5, 0.2, 12, 0.5, 0.5, 0.2, 12]);
    for (let f = 0; f < 3; f++) {
      r.setPointLights(lights, new Float32Array([1, 1, 1])); r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
      r.beginFrame(I, I, new Float32Array([0.3, -0.5, 0.2]), WORLD_FRAME);
      r.drawBillboards([tree, npc, loot, gib], R, U); walker.origin[0] += 0.05; r.drawBillboards([walker, card], R, U);
      r.moveBillboardBatch(gib, [[0, 0.05 * f, 0]]);
      r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    }
    const same = new Function('a', 'b', 'return %HaveSameMap(a, b)');
    const all = { tree, npc, walker, loot, card, gib };
    for (const x of Object.values(all)) Object.keys(x);   // touch each once, so a deprecated map is migrated before it is compared
    console.log(JSON.stringify(Object.entries(all).filter(([, x]) => !same(tree, x)).map(([n]) => n)));
  `;
  const out = spawnSync(process.execPath, ['--allow-natives-syntax', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout.trim().split('\n').pop()), [], 'every batch on the tree\'s map');
});

test('PERF-EXT10: every field src/ writes on a billboard batch is one the factory mints - by name for the renderer\'s own memory (_bbKey*, _sh*, _box, sway, conceal, noShadow, selfCard, _dead, _moveScratch) and by receiver for every host (`batch.`, `x.batch.`, `xBatch.`); a new field written after birth splits the shape again', () => {
  const minted = mintedFields();
  assert.ok(minted.size > 10 && minted.has('vao') && minted.has('_dyn'), 'the literal the sweep reads (HARD3 pins its count)');
  const files = [];
  const walk = (d) => { for (const e of readdirSync(join(ROOT, d))) { const p = `${d}/${e}`; if (statSync(join(ROOT, p)).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk('src');
  const WRITE = String.raw`\s*(?:=(?!=)|\?\?=|\+=|-=|\|\|=)`;
  // the renderer's own memory and the hosts' dress, on any receiver but `this` (a window's `_box`, the pass's `_shadows`)
  const byName = new RegExp(String.raw`(?<!\bthis)\.(_bbKey\w*|_sh(?!Inst)\w+|_box|sway|conceal|noShadow|selfCard|_dead|_moveScratch)` + WRITE, 'g');
  // any field on a receiver named for a batch - formats/ holds the Morrowind MESH batches, which are not these
  const byReceiver = new RegExp(String.raw`(?<![\w.])(?:batch|\w+\.batch|\w*[a-z]Batch)\.(\w+)` + WRITE, 'g');
  const stray = [];
  let seen = 0;
  for (const f of files) {
    const s = rd(f);
    for (const m of s.matchAll(byName)) { seen++; if (!minted.has(m[1])) stray.push(`${f}: .${m[1]}`); }
    if (f.startsWith('src/formats/')) continue;
    for (const m of s.matchAll(byReceiver)) { seen++; if (!minted.has(m[1])) stray.push(`${f}: .${m[1]}`); }
  }
  assert.ok(seen > 100, `only ${seen} batch writes found - the sweep stopped matching`);
  assert.deepEqual([...new Set(stray)], [], 'written on a batch after birth, and not minted in createBillboardBatch\'s literal');
});

test('PERF-EXT10 (the review): the shadow record writes every batch\'s fractional origin every frame and ALLOCATES NOTHING for it - `_shOx`/`_shOy`/`_shOz` are born NaN, a double slot written in place; born undefined they were a tagged slot, and every store a fresh heap number (the tip before the review: ~42 bytes a batch a frame in this child, where the base\'s fields, born with their first double, made none). Measured in a child with a 64 MB young space against a control of the same stores into undefined-born fields, which must allocate - or this pin says nothing', () => {
  const url = (p) => pathToFileURL(join(ROOT, p)).href;
  const script = `
    const { Renderer } = await import(${JSON.stringify(url('src/render/renderer.js'))});
    const { EL_LANE } = await import(${JSON.stringify(url('src/render/enhancedLighting.js'))});
    let ids = 0;
    const gl = new Proxy({}, { get(o, k) { if (k in o) return o[k]; if (typeof k !== 'string') return undefined; let v;
      if (k === 'getProgramParameter' || k === 'getShaderParameter') v = () => true; else if (k === 'getUniformLocation') v = (_p, n) => n;
      else if (k === 'getParameter') v = () => new Float32Array(4); else if (k.startsWith('create')) v = () => ({ id: ++ids });
      else if (k.toUpperCase() === k) v = 1; else v = () => {}; o[k] = v; return v; } });
    const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
    r.setLightingLane(EL_LANE);
    // a streamed town's flats as world.js dresses them: 121 pixels 819.2 m apart, one origin ARRAY a pixel, ten batches each
    const batches = [], control = [];
    for (let p = 0; p < 121; p++) {
      const t = [((p % 11) - 5.5) * 819.2, 0.25, (Math.floor(p / 11) - 5.5) * 819.2];
      for (let i = 0; i < 10; i++) {
        const b = r.createBillboardBatch(504, i, { w: 2, h: 6 }, [[i, 0, i]]);
        b._box = [0, 0, 0, 1, 6, 1]; b.sway = 0.5; b.origin = t;
        batches.push(b);
        control.push({ o: t, x: undefined, y: undefined, z: undefined });
      }
    }
    const sp = r.shadows, wind = new Float32Array(4), R = new Float32Array([1, 0, 0]), U = new Float32Array([0, 1, 0]);
    const record = () => { sp.recordBillboards(batches, wind, R, U); sp.discard(); };
    const store = () => { for (const c of control) { const o = c.o; c.x = o[0]; c.y = o[1]; c.z = o[2]; } };
    const bytes = (fn) => {
      for (let f = 0; f < 300; f++) fn();
      globalThis.gc(); globalThis.gc();
      const h0 = process.memoryUsage().heapUsed;
      for (let f = 0; f < 100; f++) fn();
      return (process.memoryUsage().heapUsed - h0) / 100 / batches.length;
    };
    const perControl = bytes(store), perBatch = bytes(record);
    const b = batches[batches.length - 1];
    console.log(JSON.stringify({ perControl, perBatch, seen: b._shSeen, at: [b._shOx, b._shOy, b._shOz], origin: b.origin }));
  `;
  const out = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const m = JSON.parse(out.stdout.trim().split('\n').pop());
  // the record really wrote the triple, and wrote the origin
  assert.equal(m.seen, true, 'the shadow pass recorded the batch');
  assert.deepEqual(m.at, m.origin, 'the triple holds the origin it was recorded at');
  // the control is three stores of the same fractional values into fields born undefined: a heap number each (12 bytes
  // compressed, 16 not; node here reads ~42) - if it shows less, the measure cannot see this garbage, and a pass below
  // would mean nothing
  assert.ok(m.perControl >= 20, `the control allocated ${m.perControl.toFixed(2)} bytes an object a frame - the measure is blind`);
  assert.ok(m.perBatch < 2, `the shadow record allocated ${m.perBatch.toFixed(2)} bytes a batch a frame (the control: ${m.perControl.toFixed(2)})`);
});

// ── PERF-EXT11: one upload ────────────────────────────────────────────

/** Walk the recorded calls as GL would: uniforms are held PER PROGRAM until the next upload to that program. At every
 *  drawElements under a billboard program - the main pass's (classic or the lane's) or the shadow replay's - the held
 *  uSize and uOrigin must be the drawn batch's own. Returns how many draws it checked. */
function assertEveryFlatDrawSeesItsOwn(calls, programs, batches) {
  const byVao = new Map(batches.map((b) => [b.vao, b]));
  const held = new Map();
  let cur = null, vao = null, checked = 0;
  const bad = [];
  for (const c of calls) {
    if (c[0] === 'useProgram') { cur = c[1]; if (!held.has(cur)) held.set(cur, new Map()); }
    else if (c[0] === 'uniform2f' || c[0] === 'uniform3f') held.get(cur)?.set(c[1], c.slice(2));
    else if (c[0] === 'bindVertexArray') vao = c[1];
    else if (c[0] === 'drawElements' && programs.includes(cur) && byVao.has(vao)) {
      const b = byVao.get(vao), u = held.get(cur), o = b.origin || [0, 0, 0];
      checked++;
      const size = u.get('uSize'), origin = u.get('uOrigin');
      if (!size || size[0] !== b.size.w || size[1] !== b.size.h) bad.push(`${b.archive}_${b.record}: drew with uSize ${size} for ${b.size.w},${b.size.h}`);
      if (!origin || origin[0] !== o[0] || origin[1] !== o[1] || origin[2] !== o[2]) bad.push(`${b.archive}_${b.record}: drew with uOrigin ${origin} for ${[...o]}`);
    }
  }
  assert.deepEqual(bad, [], 'a flat drew with another flat\'s size or origin');
  return checked;
}

/** A town's flats in the world.js shape: five pixels, one origin ARRAY a pixel, shared by its four batches. Pixel 3
 *  differs from pixel 2 in z alone and pixel 4 from pixel 3 in y alone. */
function town(r) {
  const ts = [[-0.2, 0, 0], [-0.1, 0, 0], [0, 0, 0], [0, 0, 0.1], [0, 0.05, 0.1]];
  const out = [];
  for (const t of ts) {
    for (let k = 0; k < 4; k++) {
      const b = r.createBillboardBatch(504, 1, { w: 1, h: 2 }, [[0, 0, 0]]);
      b.origin = t;
      out.push(b);
    }
  }
  return out;
}

test('PERF-EXT11: the main pass uploads a flat\'s size when it changes and its origin when it changes - twenty batches of one record from five pixels: ONE uSize and FIVE uOrigin (the base: twenty of each), the draws unchanged', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.textures.set('504_1', { id: 't' });
  r.setLighting(new Float32Array([0.3, 0.3, 0.3]), 1);
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  const batches = town(r);
  calls.length = 0;
  r.drawBillboards(batches, RIGHT, UP);
  const n = (name, loc) => calls.filter((c) => c[0] === name && c[1] === loc).length;
  assert.equal(n('uniform2f', 'uSize'), 1, 'one record, one size');
  assert.equal(n('uniform3f', 'uOrigin'), 5, 'five pixels, five origins');
  assert.equal(calls.filter((c) => c[0] === 'drawElements').length, 20, 'every flat still drawn');
  assert.equal(assertEveryFlatDrawSeesItsOwn(calls, [r.bbProgram], batches), 20);
});

test('PERF-EXT11: the shadow replay uploads a flat\'s origin and size when they change - twenty flats of one pixel\'s origin array, recorded, then replayed into the sun\'s cascades: one uOrigin and one uSize a record a cascade (the base: twenty) - the replay half of the shadow lens\'s origin dedupe', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('504_1', { id: 't' });
  r.setLighting(new Float32Array([0.3, 0.3, 0.3]), 1);
  const t = [0, 0, 0];
  const batches = [];
  for (let k = 0; k < 20; k++) { const b = r.createBillboardBatch(504, 1, { w: 1, h: 3 }, [[k * 0.02, 0, 0]]); b.origin = t; batches.push(b); }
  const sun = new Float32Array([0.45, 0.8, 0.35]);
  r.beginFrame(I, I, sun, WORLD_FRAME);
  r.drawBillboards(batches, RIGHT, UP);
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  calls.length = 0;
  r.beginFrame(I, I, sun, WORLD_FRAME);   // the replay of the frame just drawn
  const P = r.shadows.programs.bb;
  let inBb = false, origins = 0, sizes = 0, records = 0, draws = 0;
  for (const c of calls) {
    if (c[0] === 'useProgram') inBb = c[1] === P.p;
    else if (inBb && c[0] === 'uniform3f' && c[1] === 'uOrigin') origins++;
    else if (inBb && c[0] === 'uniform2f' && c[1] === 'uSize') sizes++;
    else if (inBb && c[0] === 'uniform4fv' && c[1] === 'uFlatWind') records++;   // once a record a replay
    else if (inBb && c[0] === 'drawElements') draws++;
  }
  assert.ok(records >= 1 && draws >= 20 * records, `the record was replayed (${records} replays, ${draws} flat draws)`);
  assert.equal(origins, records, 'one origin a record a replay');
  assert.equal(sizes, records, 'one size a record a replay');
  assert.ok(assertEveryFlatDrawSeesItsOwn(calls, [P.p], batches) >= 20);
});

test('PERF-EXT11: no flat ever draws with a stale size or origin - GL walked as GL holds uniforms (per program), over two calls in a frame, the opaque and the blended phase, a flipped walker (the sign of w), records that differ only in h, pixels that differ only in y or z, a lane swapped between two calls (a new program owes its own uploads), and the sun\'s and eight lanterns\' replays', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  for (const k of ['504_1', '504_2', '357_0#1']) r.textures.set(k, { id: k });
  r.setLighting(new Float32Array([0.3, 0.3, 0.3]), 1);
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  const flats = town(r);
  const tall = r.createBillboardBatch(504, 2, { w: 1, h: 3 }, [[0, 0, 0]]);   // the same w as 504_1, sorted right after it
  tall.origin = flats[flats.length - 1].origin;
  const walker = r.createBillboardBatch(357, '0#1', { w: 0.9, h: 1.8 }, [[0, 0, 0]]);
  walker.origin = [0.1, 0, 0.1];
  const turned = r.createBillboardBatch(357, '0#1', { w: 0.9, h: 1.8 }, [[0, 0, 0]]);
  turned.size = { w: -0.9, h: 1.8 }; turned.origin = [0.1, 0, 0.1];   // the walker turned about: the flip is the sign
  const ghost = r.createBillboardBatch(357, '0#1', { w: 0.9, h: 1.8 }, [[0, 0, 0]]);
  ghost.origin = [0.2, 0, 0.1]; ghost.conceal = { mode: 1, alpha: 0.5, t: 0, phase: 0 };   // the blended phase
  const all = [...flats, tall, walker, turned, ghost];
  calls.length = 0;
  r.drawBillboards([...flats, tall, ghost], RIGHT, UP);
  r.drawBillboards([walker, turned], RIGHT, UP);   // a second call: its lasts start over
  r.drawBillboards([turned, walker], RIGHT, UP);
  const classic = r.bbProgram;
  r.setLightingLane(EL_LANE);   // a new program between two calls holds none of the old one's values
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.drawBillboards([walker, ...flats, tall], RIGHT, UP);   // recorded in this order for the replays: z alone, y alone, h alone
  const lane = r.bbProgram;
  assert.notEqual(lane, classic);
  // and the replays: the sun's, and eight lanterns' faces (the basis turns to each lantern flat by flat)
  const lights = new Float32Array(8 * 4);
  for (let k = 0; k < 8; k++) { lights[k * 4] = k * 0.25 - 1; lights[k * 4 + 1] = 0.5; lights[k * 4 + 2] = 0.2; lights[k * 4 + 3] = 12; }
  r.setPointLights(lights, new Float32Array([1, 1, 1]));
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  const checked = assertEveryFlatDrawSeesItsOwn(calls, [classic, lane, r.shadows.programs.bb.p], all);
  assert.ok(checked >= 2 * (flats.length + 4), `the walk checked ${checked} flat draws`);
  // ...with the skip really on across all of it (the base uploads both, every draw)
  const draws = calls.filter((c) => c[0] === 'drawElements').length;
  for (const loc of ['uSize', 'uOrigin']) {
    const ups = calls.filter((c) => (c[0] === 'uniform2f' || c[0] === 'uniform3f') && c[1] === loc).length;
    assert.ok(ups * 2 < checked, `${loc}: ${ups} uploads for ${checked} flat draws (${draws} draws in all)`);
  }
});

// ── PERF-EXT12: no object ─────────────────────────────────────────────

test('PERF-EXT12: the streaming host asks the far-flat rule POSITIONALLY - no `{ ring, height, animated }` built for every flat batch of every pixel in sight or reach, every frame (the base: an object literal at the call); nothing in src/ builds one for it', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!farFlatVisibleAt\(ring, b\.size\?\.h \?\? 0, b\.frame != null\)\) continue;/, 'the pixel walk\'s call');
  assert.match(w, /import \{ farFlatVisibleAt \} from '\.\.\/world\/flatDistance\.js'/);
  const objectCalls = [];
  const walk = (d) => { for (const e of readdirSync(join(ROOT, d))) { const p = `${d}/${e}`; if (statSync(join(ROOT, p)).isDirectory()) walk(p); else if (p.endsWith('.js') && /(?<!function )farFlatVisible\(\s*\{/.test(rd(p))) objectCalls.push(p); } };
  walk('src');
  assert.deepEqual(objectCalls, [], 'an object built to ask the rule');
});

test('PERF-EXT12: the positional rule IS the rule - over rings 0..6, heights 0 / 0.4 / 1.8 / 2.49 / 2.5 / 6 and animated false / true / left out, farFlatVisibleAt answers what farFlatVisible({...}) answers, and the object form is only a call to it (one home: the MAC1 pins, which speak the object form, hold the positional one)', () => {
  const { farFlatVisibleAt, farFlatVisible } = flatDistance;
  assert.equal(typeof farFlatVisibleAt, 'function', 'the positional home exists');
  let asked = 0, drawn = 0;
  for (let ring = 0; ring <= 6; ring++) {
    for (const height of [0, 0.4, 1.8, 2.49, 2.5, 6]) {
      for (const animated of [false, true, undefined]) {
        const p = animated === undefined ? farFlatVisibleAt(ring, height) : farFlatVisibleAt(ring, height, animated);
        const o = animated === undefined ? farFlatVisible({ ring, height }) : farFlatVisible({ ring, height, animated });
        assert.equal(p, o, `ring ${ring}, height ${height}, animated ${animated}`);
        asked++; if (p) drawn++;
      }
    }
  }
  assert.equal(asked, 126);
  assert.equal(drawn, 2 * 18 + 5 * (6 + 2 * 2), 'the two near rings draw all; beyond them the moving and the tall (2.5, 6)');
  const home = rd('src/world/flatDistance.js');
  assert.match(home, /export function farFlatVisible\(\{ ring, height, animated = false \}\) \{\n\s*return farFlatVisibleAt\(ring, height, animated\);\n\}/, 'the object form is a call to the one home');
});

// ── PERF-EXT13: one block ─────────────────────────────────────────────

/** A fake GL that HOLDS state as GL does - the program, each program's uniforms, each unit's binding per target, the
 *  VAO, the caps, depth mask and func, blend func and polygon offset - and snapshots all of it at every draw. */
function stateGl() {
  let ids = 0, calls = 0;
  const S = { prog: null, vao: null, unit: 0, tex: new Map(), caps: new Map(), depthMask: true, depthFunc: 'LESS', blend: '', poly: '' };
  const byName = {};
  const draws = [];
  const ser = (v) => (v && typeof v === 'object' && 'length' in v ? `[${Array.from(v).join(',')}]` : v && typeof v === 'object' ? `#${v.id}` : String(v));
  const held = () => {
    const p = S.prog;
    const u = p ? [...p.u.entries()].sort().map(([k, v]) => `${k}=${v}`).join(';') : '';
    const t = [...S.tex.entries()].sort().map(([k, v]) => `${k}:${ser(v)}`).join(',');
    const caps = [...S.caps.entries()].sort().map(([k, v]) => `${k}${v ? '+' : '-'}`).join('');
    return `prog=${p?.id}|vao=${ser(S.vao)}|caps=${caps}|dm=${S.depthMask}|df=${S.depthFunc}|bl=${S.blend}|po=${S.poly}|tex=${t}|u=${u}`;
  };
  const snap = (args) => { draws.push(`${held()}|args=${args.map(ser).join(',')}`); };
  const impl = {
    createProgram: () => ({ id: ++ids, u: new Map() }),
    useProgram: (p) => { S.prog = p; },
    bindVertexArray: (v) => { S.vao = v; },
    activeTexture: (unit) => { S.unit = unit; },
    bindTexture: (target, t) => { S.tex.set(`${S.unit}/${target}`, t); byName[`bindTexture:${S.unit}/${target}`] = (byName[`bindTexture:${S.unit}/${target}`] ?? 0) + 1; },
    enable: (c) => S.caps.set(c, true), disable: (c) => S.caps.set(c, false),
    depthMask: (b) => { S.depthMask = !!b; }, depthFunc: (f) => { S.depthFunc = f; },
    blendFunc: (a, b) => { S.blend = `${a},${b}`; }, polygonOffset: (a, b) => { S.poly = `${a},${b}`; },
    drawElements: (...a) => snap(a),
  };
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k === 'string' && /^TEXTURE\d+$/.test(k)) return 1000 + Number(k.slice(7));
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, n) => ({ p, n });
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.startsWith('create') && k !== 'createProgram') return () => ({ id: ++ids });
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      if (typeof k === 'string' && k.startsWith('uniform')) {
        return (loc, ...a) => { calls++; byName[k] = (byName[k] ?? 0) + 1; if (loc?.p) { loc.p.u.set(loc.n, (k.startsWith('uniformMatrix') ? a.slice(1) : a).map(ser).join(',')); (byName[`${k}:${loc.n}`] = (byName[`${k}:${loc.n}`] ?? 0) + 1); } };
      }
      const f = impl[k];
      return (...a) => { calls++; byName[k] = (byName[k] ?? 0) + 1; return f ? f(...a) : undefined; };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { canvas, draws, byName, count: () => calls, state: () => `unit=${S.unit}|${held()}`, reset() { calls = 0; draws.length = 0; for (const k of Object.keys(byName)) delete byName[k]; } };
}

/** Ten water pixels the way the streaming host hands them over: each its own surface, matrix and tilemap; the ground
 *  array in runs (two climates), the first pixel's array missing (unit 0 must still be bound for it, to nothing). */
function waterScene(lane) {
  const H = stateGl();
  const r = new Renderer(H.canvas);
  if (lane) r.setLightingLane(EL_LANE);
  const P = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]), N = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), IX = new Uint32Array([0, 2, 1, 1, 2, 3]);
  const arrA = { id: 'arrA' }, arrB = { id: 'arrB' };
  const arrays = [null, arrA, arrA, arrB, arrB, arrB, arrA, arrA, arrB, arrA];
  const rows = arrays.map((arr, i) => {
    const m = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, i * 819.2, 0, 0, 1]);
    return [r.createWaterSurface(r.createTerrainSurface(P, N, IX), IX), m, arr, { id: `tilemap${i}` }];
  });
  r.setLighting(new Float32Array([0.3, 0.3, 0.35]), 0.8, new Float32Array([1, 0.9, 0.8]));
  const lights = new Float32Array(20 * 4); for (let i = 0; i < 20; i++) lights.set([i, 3, -i, 12], i * 4);
  r.setPointLights(lights, new Float32Array([1, 0.8, 0.5]));
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.drawTerrain(r.createTerrainSurface(P, N, IX), I, { id: 'terrainArr' }, { id: 'terrainMap' }, 6.4);   // the ground before: unit 0 holds ITS array
  const wu = waterUniforms({ seconds: 3, wind: [2, 1], rain: 0.2, sky: { zenith: [0.2, 0.3, 0.6], horizon: [0.6, 0.7, 0.8] } });
  return { H, r, rows, wu };
}

test('PERF-EXT13: every visible pixel\'s water in ONE call - ten water pixels through drawWaterSurfaces upload uView, uProj, uTime, uLift, uSunScale and uOpacity ONCE each, set the polygon offset once, and uModel ten times, in at most 150 GL calls (the base: no list at all, and the one-surface path 70 a pixel)', () => {
  assert.equal(typeof Renderer.prototype.drawWaterSurfaces, 'function', 'the list door exists');
  for (const lane of [false, true]) {
    const { H, r, rows, wu } = waterScene(lane);
    H.reset();
    r.drawWaterSurfaces(rows, rows.length, 6.4, wu);
    const n = (k) => H.byName[k] ?? 0;
    for (const u of ['uView', 'uProj']) assert.equal(n(`uniformMatrix4fv:${u}`), 1, `${lane ? 'lane' : 'classic'}: ${u} once`);
    for (const u of ['uTime', 'uLift', 'uSunScale', 'uOpacity']) assert.equal(n(`uniform1f:${u}`), 1, `${lane ? 'lane' : 'classic'}: ${u} once`);
    assert.equal(n('polygonOffset'), 1, 'the offset once');
    assert.equal(n('uniformMatrix4fv:uModel'), 10, 'a matrix a pixel');
    assert.equal(H.draws.length, 10, 'a draw a pixel');
    assert.equal(n('bindTexture:1000/TEXTURE_2D_ARRAY'), 6, 'the ground array on unit 0 once a run of one climate (none, A A, B B B, A A, B, A)');
    assert.equal(n('bindTexture:1002/TEXTURE_2D'), 10, 'a tilemap a pixel, on unit 2');
    assert.ok(H.count() <= 150, `${lane ? 'lane' : 'classic'}: ${H.count()} GL calls for ten water pixels`);
    H.reset();
    r.drawWaterSurfaces(rows, 0, 6.4, wu);
    assert.equal(H.count(), 0, 'no water in sight: not one GL call, as when no pixel called');
  }
  // and the host hands them over so: collected in the walk, ONE call after it, none inside it
  const w = rd('src/scenes/world.js');
  const pass = w.slice(w.indexOf('    if (waterOn) {\n      const wu = waterUniforms('), w.indexOf('renderer.drawBillboards(allBatches, camRight, UP_Y);'));
  assert.equal((pass.match(/renderer\.drawWaterSurfaces\(/g) || []).length, 1, 'one list call a frame');
  assert.doesNotMatch(pass, /renderer\.drawWaterSurface\(/, 'no pixel draws its own');
  assert.match(pass, /for \(const p of built\.values\(\)\) \{[\s\S]*?\}\s*\n\s*renderer\.drawWaterSurfaces\(_waterRows, n, 6\.4, wu\);/, 'after the walk, not in it');
});

test('PERF-EXT13: the list draws what the pixels drew one by one - draw for draw, the same program, every uniform the program holds, every unit\'s texture, the VAO, the caps, the depth, blend and offset state and the arguments, in the same order; two climates\' arrays in runs and a first pixel with none (unit 0 bound for it all the same); classic and the lane (its shadow maps); and the state closed as before (the base: no list)', () => {
  for (const lane of [false, true]) {
    const one = waterScene(lane), list = waterScene(lane);
    one.H.reset(); list.H.reset();
    for (const w of one.rows) one.r.drawWaterSurface(w[0], w[1], w[2], w[3], 6.4, one.wu);
    const before = one.H.draws.slice();
    list.r.drawWaterSurfaces(list.rows, list.rows.length, 6.4, list.wu);
    const after = list.H.draws.slice();
    assert.equal(after.length, 10);
    assert.deepEqual(after, before, `${lane ? 'lane' : 'classic'}: every water draw sees what it saw`);
    assert.ok(list.H.count() * 4 < one.H.count(), `${lane ? 'lane' : 'classic'}: ${list.H.count()} calls against ${one.H.count()}`);
    // what follows the pass finds the state it found before - the unit, the VAO, the caps, depth and blend closed
    assert.equal(list.H.state(), one.H.state(), 'the pass leaves what it left');
    // ...which is what the one-pixel draw always left: unit 0 selected, no VAO, blend and offset off, cull on, depth written and LESS
    const closed = list.H.state();
    assert.match(closed, /^unit=1000\|prog=\d+\|vao=null\|/,`${lane ? 'lane' : 'classic'}: unit 0 and no VAO - ${closed.slice(0, 40)}`);
    assert.match(closed, /BLEND-/); assert.match(closed, /CULL_FACE\+/); assert.match(closed, /POLYGON_OFFSET_FILL-/); assert.match(closed, /\|dm=true\|df=LESS\|/);
    const tail = (sc) => { sc.H.reset(); sc.r.drawBillboards([], RIGHT, UP); sc.r.drawTerrain(sc.rows[1][0], I, { id: 'next' }, { id: 'nextMap' }, 6.4); return sc.H.draws[0]; };
    assert.equal(tail(list), tail(one), 'and the next draw after it sees the same state');
    assert.deepEqual(one.r._waterOne, [[null, null, null, null]], 'the one-row door keeps no surface alive');
  }
});
