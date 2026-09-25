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
