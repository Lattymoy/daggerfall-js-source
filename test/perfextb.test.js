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
