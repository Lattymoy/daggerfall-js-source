// MWNPC2 (2026-10-09, the MW-NPC arc's second slice - bible/04-Characters/Morrowind-NPCs.md section 7): ONE
// OFFSCREEN BIND FOR EVERY SEEN BODY. Every Morrowind body's picture took its own pass of the shared sprite target -
// two framebuffer switches, a scissored clear and the character block a body a frame. A host opens a batch around its
// body pass now: drawRigSpriteBox measures and QUEUES each picture, and the flush draws them all in one bind, each in
// its own tile, then every quad sampling its tile. Pinned on the real Renderer over a recording GL: N bodies are two
// framebuffer binds, not 2N; each tile is cleared and drawn under its own camera and block; each quad samples its own
// tile; a batch the target cannot hold takes as many binds as it needs and no more; the lone path is untouched; the
// packer's shelves never overlap and keep inside the target; and every body pass in the hosts the game boots opens one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, packSpriteTiles, CHAR_SPRITE_RT_SIZE } from '../src/render/renderer.js';
import { drawRigSpriteBox } from '../src/render/characterSprite.js';
import { lookAt, perspective } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'checkFramebufferStatus') return () => 36053;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 640, clientHeight: 480, width: 640, height: 480 } };
}

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const PROJ = perspective(1.1, 640 / 480, 0.1, 500);
const VIEW = lookAt([0, 1.6, 6], [0, 1, 0], [0, 1, 0]);
const mesh = (id) => ({ vao: { id }, count: 3 });
const body = (renderer, canvas, m, x) => drawRigSpriteBox(renderer, canvas, m, I, { center: [x, 1, 0], halfW: 0.4, halfH: 0.9, anchor: [x, 1, 0] }, PROJ, VIEW, [0, 1.6, 6]);

test('MWNPC2a three bodies in a batch are TWO framebuffer binds - into the target and back - where alone they were six; each tile cleared and drawn under its own camera', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]));
  const binds = () => calls.filter((c) => c[0] === 'bindFramebuffer').length;
  body(r, canvas, mesh('warm'), 0);   // the target is made by the first picture (its own bind) - counted from the second
  calls.length = 0;
  for (const [i, x] of [-2, 0, 2].entries()) body(r, canvas, mesh(`lone${i}`), x);
  assert.equal(binds(), 6, 'alone: two binds a body');
  calls.length = 0;
  r.beginCharacterSpriteBatch();
  assert.equal(r.characterSpriteBatchOpen, true);
  for (const [i, x] of [-2, 0, 2].entries()) body(r, canvas, mesh(`b${i}`), x);
  assert.equal(binds(), 0, 'queued, not drawn');
  assert.equal(r.flushCharacterSpriteBatch(), 1, 'one bind of the target');
  assert.equal(r.characterSpriteBatchOpen, false);
  assert.equal(binds(), 2, 'into the target, and back');
  const vps = calls.filter((c) => c[0] === 'viewport').map((c) => c.slice(1));
  const tiles = vps.filter((v) => v.every((n) => typeof n === 'number'));   // the frame's own viewport, put back once, reads the drawing buffer
  assert.equal(tiles.length, 3, 'a viewport a tile');
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const [ax, ay, aw, ah] = tiles[i], [bx, by, bw, bh] = tiles[j];
    assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `tiles ${i} and ${j} do not overlap`);
  }
  const clears = calls.filter((c) => c[0] === 'clear').length;
  assert.equal(clears, 3, 'each tile\'s depth cleared');
  const colours = calls.filter((c) => c[0] === 'clearBufferfv').map((c) => c[3]);
  assert.deepEqual(colours, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'and its colour, to transparent, by value - the clear colour never borrowed');
  assert.equal(calls.filter((c) => c[0] === 'clearColor').length, 0, 'not once');
  const draws = calls.filter((c) => c[0] === 'bindVertexArray').map((c) => c[1]?.id).filter((id) => /^b\d$/.test(id));
  assert.deepEqual(draws, ['b0', 'b1', 'b2'], 'each body drawn into its tile, in order');
  const origins = calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uOrigin').map((c) => [c[2], c[3]]);
  assert.equal(origins.length, 3, 'a quad a body');
  assert.deepEqual(origins, tiles.map(([x, y]) => [x / CHAR_SPRITE_RT_SIZE, y / CHAR_SPRITE_RT_SIZE]), 'each quad samples its own tile');
  assert.equal(r.stats.spriteBinds, 1);
});

test('MWNPC2b the packer: shelves left to right, a texel of gutter, inside the target, and as many binds as a batch needs and no more', () => {
  const items = [{ pw: 600, ph: 500 }, { pw: 400, ph: 300 }, { pw: 500, ph: 600 }, { pw: 1024, ph: 1024 }, { pw: 10, ph: 10 }];
  assert.equal(packSpriteTiles(items, 0, 1024), 2, 'the first two side by side; the third does not fit under them');
  assert.deepEqual(items.slice(0, 2).map((i) => [i.tx, i.ty]), [[0, 0], [601, 0]]);
  assert.equal(packSpriteTiles(items, 2, 1024), 1, 'the third alone: the full target does not fit beside it');
  assert.equal(packSpriteTiles(items, 3, 1024), 1, 'a full-target picture fits alone, always');
  assert.deepEqual([items[3].tx, items[3].ty], [0, 0]);
  assert.equal(packSpriteTiles(items, 4, 1024), 1);
  const many = Array.from({ length: 60 }, () => ({ pw: 100, ph: 200 }));
  assert.equal(packSpriteTiles(many, 0, 1024), 50, 'pictures of 100x200: ten a row (101 apiece), five rows (the fifth from 804 to 1004)');
  let at = 0, binds = 0;
  while (at < many.length) { at += packSpriteTiles(many, at, 1024); binds++; }
  assert.equal(binds, 2, 'sixty: fifty, then ten');
  for (const it of many) assert.ok(it.tx >= 0 && it.ty >= 0 && it.tx + it.pw <= 1024 && it.ty + it.ph <= 1024, 'inside the target');
});

test('MWNPC2c the lone path is as it was: a call outside a batch draws in its own pass, the quad sampling the corner', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]));
  calls.length = 0;
  body(r, canvas, mesh('lone'), 0);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uOrigin').map((c) => [c[2], c[3]]), [[0, 0]]);
  assert.equal(r.flushCharacterSpriteBatch(), 0, 'a flush with no batch open draws nothing');
});

test('MWNPC2d every body pass of the hosts the game boots opens a batch around its bodies and flushes it', () => {
  const world = rd('src/scenes/world.js');
  const modes = rd('src/scenes/worldModes.js');
  const between = (src, from, to) => { const a = src.indexOf(from); return a >= 0 ? src.slice(a, src.indexOf(to, a)) : ''; };
  const ext = between(world, 'renderer.beginCharacterSpriteBatch?.();', '} finally { renderer.flushCharacterSpriteBatch?.(); }');
  assert.ok(ext.includes('mwViewDrawBody(canvas,') && ext.includes('drawPeerBodies(proj, view, mwv.eye'), 'the street: the player and the others in one batch, flushed whatever throws');
  const opens = modes.split('renderer.beginCharacterSpriteBatch?.();').slice(1);
  assert.equal(opens.length, 2, 'the dungeon and the building');
  for (const o of opens) {
    const pass = o.slice(0, o.indexOf('} finally { renderer.flushCharacterSpriteBatch?.(); }'));
    assert.ok(pass.includes('mwViewDrawBody(canvas,') && pass.includes('host.drawPeerBodies?.('), 'each: the player and the others, flushed in a finally');
  }
});
