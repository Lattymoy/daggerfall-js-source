// MAC4 (2026-09-11, Mac: "enemy animations are completely broken").
// PERF3 cached each billboard batch's texture key and re-minted it on
// a change of `frame` only - the field FA1's animated flats tick. The
// mobiles never touch `frame`: a foe, a guard or a townsperson
// animates by writing the RECORD, `record#frame` (uploadRecordFrame's
// own key, the orientation record and the frame folded into one), in
// exteriorFoes.js, dungeonContext.js, cityGuards.js and the two hosts'
// people. Their key was minted once, on the first draw, and every one
// of them stood on that first texture for the rest of the session -
// no walk, no swing, no turn. The key follows every field it is made
// of now. EXECUTES: the billboard pass driven over a stub context
// records its texture binds; a batch whose record changes between two
// frames binds the new record's texture (mutant: the record dropped
// from the condition - the second draw binds nothing new). The five
// producers are pinned to the shape that broke it, so a sixth cannot
// slip past a frame-only cache again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Renderer } from '../src/render/renderer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A renderer over a stub context: every GL call is a no-op that
 *  records texture binds; every constant is its own name. */
function stubRenderer() {
  const binds = [];
  const gl = new Proxy({}, {
    get: (_, k) => {
      if (typeof k !== 'string') return undefined;
      if (k === 'bindTexture') return (target, tex) => { binds.push(tex); };
      if (k === k.toUpperCase()) return k;   // gl.TEXTURE_2D and friends
      return () => 0;
    },
  });
  const r = Object.create(Renderer.prototype);
  r.gl = gl;
  r.textures = new Map(); r.emissionTextures = new Map();
  r.stats = { draws: 0, programBinds: 0, vaoBinds: 0, texBinds: 0 };
  r._pointLights = []; r._proj = new Float32Array(16); r._view = new Float32Array(16);
  r._camPos = new Float32Array(3); r._indirect = new Float32Array(4); r._indirectColor = new Float32Array(3);
  r._fogColor = new Float32Array(3); r._fogMode = 0; r._fogDensity = 0; r._fogRange = new Float32Array(2);
  r._clockLit = false; r._bbFog = {}; r.bbProgram = {};
  return { r, binds };
}

test('MAC4: a batch that animates by its RECORD binds the new record\'s texture on the next frame - the key follows record, frame and archive (mutant: the record dropped from the condition)', () => {
  const { r, binds } = stubRenderer();
  const T0 = { name: 'orc 0#0' }, T1 = { name: 'orc 0#1' }, T2 = { name: 'orc 5#0' }, F0 = { name: 'torch 210#0' }, F1 = { name: 'torch 210#1' };
  r.textures.set('264_0#0', T0); r.textures.set('264_0#1', T1); r.textures.set('264_5#0', T2);
  r.textures.set('210_100#0', F0); r.textures.set('210_100#1', F1);
  // the mobile's shape (exteriorFoes.js et al.): record carries `record#frame`, frame is never set
  const foe = { archive: 264, record: '0#0', size: { w: 1, h: 1 }, origin: [0, 0, 0], vao: {}, indexCount: 6 };
  // FA1's shape: record alone, frame ticks
  const torch = { archive: 210, record: 100, frame: 0, size: { w: 1, h: 1 }, origin: [0, 0, 0], vao: {}, indexCount: 6 };
  // the cutout pass draws in KEY order (PERF3's sort), so the binds are read as a sorted set
  const bound = () => binds.filter((t) => t && t.name).map((t) => t.name).sort();
  r.drawBillboards([foe, torch], [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(bound(), ['orc 0#0', 'torch 210#0'].sort(), 'the first frame binds each batch\'s first texture');
  binds.length = 0;
  foe.record = '0#1';   // the walk's next frame
  torch.frame = 1;      // the torch's next frame
  r.drawBillboards([foe, torch], [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(bound(), ['orc 0#1', 'torch 210#1'].sort(), 'the next frame binds the NEXT textures - the foe by its record, the torch by its frame');
  binds.length = 0;
  foe.record = '5#0';   // a turn: another orientation record
  r.drawBillboards([foe, torch], [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(bound(), ['orc 5#0', 'torch 210#1'].sort(), 'a turn is a record change and binds the turned record');
  // PERF3's skip is WITHIN a pass: two batches wearing the same key bind once
  binds.length = 0; r.stats.texBinds = 0;
  const twin = { ...foe, vao: {} };
  r.drawBillboards([foe, twin, torch], [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(bound(), ['orc 5#0', 'torch 210#1'].sort(), 'the twin wore the key the foe before it wore and bound nothing');
  assert.equal(r.stats.texBinds, 4, 'two binds (albedo and emission) per distinct key, three batches');
  binds.length = 0;
  foe.archive = 471;   // a transformed seducer swaps archives
  r.textures.set('471_5#0', { name: 'seducer 5#0' });
  r.drawBillboards([foe], [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(bound(), ['seducer 5#0'], 'an archive change rebinds too');
});

test('MAC4: the five mobile producers write the record as `record#frame` and never the frame, and the key is minted from all three fields (the shape that a frame-only cache broke)', () => {
  const producers = [
    ['src/scenes/exteriorFoes.js', /const rkey = `\$\{o\.record\}#\$\{o\.frame\}`;[\s\S]{0,400}?f\.batch\.record = rkey;/],
    ['src/scenes/dungeonContext.js', /const rkey = `\$\{out\.record\}#\$\{out\.frame\}`;[\s\S]{0,600}?f\.batch\.record = rkey;/],
    ['src/scenes/cityGuards.js', /const rkey = `\$\{o\.record\}#\$\{o\.frame\}`;[\s\S]{0,400}?g\.batch\.record = rkey;/],
    ['src/scenes/world.js', /const rkey = `\$\{out\.record\}#\$\{out\.frame\}`;[\s\S]{0,400}?batch\.record = rkey;/],
    ['src/scenes/exterior.js', /const rkey = `\$\{out\.record\}#\$\{out\.frame\}`;[\s\S]{0,400}?batch\.record = rkey;/],
  ];
  for (const [file, shape] of producers) {
    const src = rd(file);
    assert.match(src, shape, `${file}: the mobile's record carries its frame`);
    const m = shape.exec(src);
    assert.doesNotMatch(m[0], /batch\.frame\s*=/, `${file}: ...and the frame field is never written (the key must follow the record)`);
  }
  const r = rd('src/render/renderer.js');
  assert.match(r, /if \(b\._bbKey == null \|\| b\._bbKeyRecord !== b\.record \|\| b\._bbKeyFrame !== b\.frame \|\| b\._bbKeyArchive !== b\.archive\) \{\s*\n\s*b\._bbKeyRecord = b\.record; b\._bbKeyFrame = b\.frame; b\._bbKeyArchive = b\.archive;/, 'the key follows every field it is made of');
});
