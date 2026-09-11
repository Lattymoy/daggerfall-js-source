// PERF3 (2026-09-11, Mac: "just do your job and look for opportunities").
// Three more that change no pixel: the terrain program's frame-constant
// uniforms uploaded once a frame instead of once a pixel, the cutout
// billboard pass sorted by texture with repeated binds skipped, and the
// counter showing the renderer's own draw and bind counts. The counter
// EXECUTES against a stub document; the renderer is text-pinned (its
// constructor needs a real GL). Every pin names its mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountFpsCounter } from '../src/ui/fpsCounter.js';
import { _resetFrameClock } from '../src/systems/frameClock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('PERF3 fpsCounter: the draws/binds line is the per-frame mean of the renderer\'s per-frame counts, and absent without a renderer (mutant: cumulative deltas, or the sums not reset)', () => {
  const prev = { d: globalThis.document };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  try {
    _resetFrameClock();
    let frame = { draws: 0, programBinds: 0, vaoBinds: 0, texBinds: 0 };
    const c = mountFpsCounter({ enabled: () => true, raf: null, stats: () => frame });
    let t = 0;
    for (let i = 0; i <= 61; i++) { frame = { draws: 300, programBinds: 4, vaoBinds: 200, texBinds: 120 }; c.tick(t); t += 1000 / 60; }   // one past the second's boundary
    assert.match(c.el.textContent, /\ndraws 300  binds 120$/, `the second's mean: ${JSON.stringify(c.el.textContent)}`);
    for (let i = 0; i <= 61; i++) { frame = { draws: i % 2 ? 100 : 200, programBinds: 4, vaoBinds: 200, texBinds: 50 }; c.tick(t); t += 1000 / 60; }
    assert.match(c.el.textContent, /\ndraws 1[45]\d  binds 50$/, `a new second, its own mean: ${JSON.stringify(c.el.textContent)}`);
    c.dispose();
    const bare = mountFpsCounter({ enabled: () => true, raf: null });
    t = 0; for (let i = 0; i <= 61; i++) { bare.tick(t); t += 1000 / 60; }
    assert.doesNotMatch(bare.el.textContent, /draws/, 'no renderer, no line');
    bare.dispose();
  } finally { globalThis.document = prev.d; _resetFrameClock(); }
});

test('PERF3 pins: the terrain block goes up once per frame stamp; the cutout billboards are sorted by key and a repeated key binds nothing; the stamp moves with beginFrame, a state restore and a moved light (mutant: the guard dropped, the sort dropped, or a stamp site missed)', () => {
  const r = read('src/render/renderer.js');
  assert.match(r, /this\._frameStamp = 0;/); assert.match(r, /this\._tFrameStamp = -1;/);
  assert.equal((r.match(/this\._frameStamp\+\+;/g) || []).length, 3, 'beginFrame, the restore, setLightDir');
  assert.match(r, /this\._lightDir = lightDir;\n\s+this\._frameStamp\+\+;/, 'beginFrame stamps after it takes the light');
  assert.match(r, /if \(this\._tFrameStamp !== this\._frameStamp\) \{\n\s+this\._tFrameStamp = this\._frameStamp;\n\s+gl\.uniformMatrix4fv\(this\.tUProj, false, this\._proj\);/, 'the block is behind the stamp');
  const block = r.slice(r.indexOf('if (this._tFrameStamp !== this._frameStamp) {'), r.indexOf('gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrayTex);'));
  for (const u of ['tUView', 'tULightDir', 'tUAmbient', 'tUSunScale', 'tUSunColor', 'tUMoonDir', 'tUMoonScale', 'tUMoonColor', 'tUPointCount', 'tUIndirect', 'tUIndirectColor', 'tUTileArr', 'tUTilemap']) {
    assert.ok(block.includes(`this.${u}`), `${u} is inside the once-a-frame block`);
  }
  assert.match(r, /gl\.uniformMatrix4fv\(this\.tUModel, false, modelMatrix\);\n\s+gl\.uniform1f\(this\.tUTileSize, tileSize\);\n\s+\/\/ EE5/, 'the per-pixel two stay outside it');
  assert.match(r, /this\._uploadCloudShadow\('terrain'\);\n\s+\/\/ PERF3/, 'the deck keeps its own stamp, outside the block');
  // the billboards
  assert.match(r, /const keyOf = \(b\) => \{[\s\S]{0,400}b\._bbKeyFrame !== b\.frame/, 'the key is cached per frame value (FA1 animates b.frame)');
  assert.match(r, /if \(key !== lastKey\) \{\n\s+gl\.activeTexture\(gl\.TEXTURE0\);\n\s+gl\.bindTexture\(gl\.TEXTURE_2D, tex\);/, 'a repeated key binds nothing');
  assert.match(r, /opaque\.sort\(\(a, b\) => \(a\._bbKey < b\._bbKey \? -1 : a\._bbKey > b\._bbKey \? 1 : 0\)\);\n\s+for \(const b of opaque\) drawOne\(b\);/, 'the cutout pass is sorted by key');
  assert.match(r, /blended\.sort\(\(a, b\) => d2\(b\) - d2\(a\)\);/, 'the blended pass keeps its back-to-front order');
  assert.match(r, /this\.stats\.texBinds \+= 2;\n\s+lastKey = key;/, 'the stat counts the binds that happen');
});
