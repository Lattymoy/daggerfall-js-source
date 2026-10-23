// GATE-MIX (2026-10-20): a frame already on the GPU is not decoded again - render/renderer.js heldTexture, asked by
// scenes/dataPipeline.js uploadRecordFrame. Design: bible/11-Multiplayer/World-Bosses.md section 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Renderer } from '../../src/render/renderer.js';
import { createDataPipeline } from '../../src/scenes/dataPipeline.js';

const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'TEXTURE.380'));

test('GATE-MIX heldTexture: the plain key\'s real picture is held for the place asking (PLACE-LRU, as an uploadTexture hit) and answered true; a stand-in\'s placeholder, an option\'s variant or no picture answers false and holds nothing (mutants: the placeholder taken as real; the hold not asked)', () => {
  const held = [];
  const r = { textures: new Map([['380_0#2', {}], ['380_0#3', {}], ['380_1#ui', {}]]), _placeholders: new Set(['380_0#3']), _uploadSink: (emission, key) => held.push([emission, key]) };
  const heldTexture = Renderer.prototype.heldTexture.bind(r);
  assert.equal(heldTexture(380, '0#2'), true);
  assert.deepEqual(held, [[false, '380_0#2']], 'held as an albedo hit is');
  assert.equal(heldTexture(380, '0#3'), false, 'a placeholder is no picture - the real one is decoded and replaces it');
  assert.equal(heldTexture(380, 1), false, 'the UI variant is another key');
  assert.equal(heldTexture(380, '0#9'), false);
  assert.equal(held.length, 1, 'nothing held but the hit');
  r._placeholders = undefined;
  assert.equal(heldTexture(380, '0#3'), true, 'a renderer that never stood a placeholder');
});

test('GATE-MIX uploadRecordFrame on the freeware\'s blood (TEXTURE.380): a splash\'s frames are decoded the first time and never again - every hit asked them all again before (mutants: the check unasked)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const ups = [];
  const renderer = {
    textures: new Map(),
    uploadTexture(a, r) { const k = `${a}_${r}`; ups.push(k); if (!this.textures.has(k)) this.textures.set(k, {}); },
    uploadEmissionTexture() {},
    heldTexture: Renderer.prototype.heldTexture,
  };
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => new Uint8Array(readFileSync(join(A, n))) });
  const t = await pipe.getTexture(380);
  let decodes = 0;
  const own = t.getDFBitmap.bind(t);
  t.getDFBitmap = (...x) => { decodes++; return own(...x); };
  const n = t.getFrameCount(0);
  assert.ok(n > 1, `a splash of ${n} frames`);
  for (let f = 0; f < n; f++) pipe.uploadRecordFrame(380, 0, f);
  assert.deepEqual([decodes, ups.length], [n, n], 'the first hit: each frame decoded and uploaded');
  for (let hit = 0; hit < 3; hit++) for (let f = 0; f < n; f++) pipe.uploadRecordFrame(380, 0, f);
  assert.deepEqual([decodes, ups.length], [n, n], 'three more hits: nothing decoded, nothing uploaded');
});
