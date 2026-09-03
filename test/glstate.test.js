// EV6 - GL STATE SHADOWING, pinned against a COUNTING stub (the
// audit26/renderalloc Proxy-GL precedent, grown eyes): the program and
// VAO shadows skip redundant binds, the sorted draw lists are what
// make consecutive same-mesh draws free, the shadows reset at
// beginFrame and at markForeignPass (the three passes that change
// programs behind the renderer's back: both skies and precipitation,
// which no longer save/restore or query CURRENT_PROGRAM at all), and
// every bind in renderer.js funnels through the shadow helpers so
// nothing can desynchronize them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { identity } from '../src/world/mat4.js';
import { Renderer } from '../src/render/renderer.js';

function countingRenderer(counts) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'useProgram' || k === 'bindVertexArray') {
        return () => { counts[k] = (counts[k] || 0) + 1; };
      }
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      return () => {};
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return new Renderer(canvas);
}

const fakeMesh = () => ({
  vao: {},
  subMeshes: [{ textureArchive: 7, textureRecord: 3, primitiveCount: 2, startIndex: 0 }],
});

test('EV6: the shadows skip redundant binds; a foreign pass and beginFrame reset them', () => {
  const counts = {};
  const r = countingRenderer(counts);
  r.textures.set('7_3', { fake: true });
  const a = fakeMesh(), b = fakeMesh();
  const m = identity();
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));

  // three draws of the SAME mesh: beginFrame already bound the solid
  // program, so drawMesh's _use never touches GL again, and the VAO
  // binds once - this is the collapse the sorted draw lists buy.
  counts.useProgram = 0; counts.bindVertexArray = 0;
  const vb0 = r.stats.vaoBinds, pb0 = r.stats.programBinds;
  r.drawMesh(a, m); r.drawMesh(a, m); r.drawMesh(a, m);
  assert.equal(counts.useProgram, 0, 'the program shadow held through all three');
  assert.equal(counts.bindVertexArray, 1, 'one VAO bind for three same-mesh draws');
  assert.equal(r.stats.vaoBinds - vb0, 1, 'and the counter agrees');
  assert.equal(r.stats.programBinds - pb0, 0);
  assert.equal(r.stats.draws, 3, 'all three drew');

  // a different mesh rebinds; coming back rebinds again (why the
  // hosts SORT: interleaving pays per switch)
  r.drawMesh(b, m);
  r.drawMesh(a, m);
  assert.equal(counts.bindVertexArray, 3);

  // the foreign seam: the skies and precipitation change programs
  // behind the renderer's back and no longer restore - markForeignPass
  // forgets the shadows and unbinds the VAO for real
  counts.useProgram = 0;
  r.markForeignPass();
  r.drawMesh(a, m);
  assert.equal(counts.useProgram, 1, 'the program rebinds after a foreign pass');

  // beginFrame starts every frame untrusting
  counts.useProgram = 0;
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  assert.equal(counts.useProgram, 1, 'the frame opens with a real bind');
});

test('EV6: every program and VAO bind in renderer.js funnels through the shadows', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  // exactly ONE raw useProgram (inside _use) and TWO raw
  // bindVertexArray (inside _bindVao and markForeignPass) survive -
  // a third of either is a bind the shadows cannot see
  assert.equal((r.match(/gl\.useProgram\(/g) || []).length, 1, 'only _use touches useProgram');
  assert.equal((r.match(/gl\.bindVertexArray\(/g) || []).length, 2, 'only _bindVao and markForeignPass touch bindVertexArray');
  // the element-buffer upload that owns no VAO unbinds first, or it
  // would capture its buffer into whatever drawMesh left bound
  const ti = r.slice(r.indexOf('_terrainIndices(indices) {'), r.indexOf('_terrainIndices(indices) {') + 900);
  assert.ok(ti.indexOf('this._bindVao(null);') > 0 && ti.indexOf('this._bindVao(null);') < ti.indexOf('ELEMENT_ARRAY_BUFFER'),
    '_terrainIndices unbinds before touching the element buffer');
  // AUDIT EV F-DOC5: beginFrame's internal ORDER - shadow reset, then
  // the real bind, then the uniform uploads. Uniforms uploaded before
  // _use would land in whatever foreign program the sky or the ring
  // left bound, and the counting stub's uniform no-ops would never see
  // it.
  const bfStart = r.indexOf('beginFrame(proj, view, lightDir) {');
  const bf = r.slice(bfStart, bfStart + 2600);
  const reset = bf.indexOf('this._lastProgram = null;');
  const use = bf.indexOf('this._use(this.program);');
  const firstUniform = bf.indexOf('gl.uniformMatrix4fv(this.uProj');
  assert.ok(reset > 0 && use > reset && firstUniform > use,
    'beginFrame: forget the shadows, bind for real, THEN upload');
});

test('EV6: the skies neither query CURRENT_PROGRAM nor restore - the hosts mark the seams', () => {
  for (const f of ['src/render/skyRenderer.js', 'src/render/enhancedSky.js', 'src/render/precipitation.js']) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!s.includes('CURRENT_PROGRAM'), `${f}: the per-frame driver query is gone`);
    assert.ok(!s.includes('previousProgram'), `${f}: and the restore with it`);
  }
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = readFileSync(host, 'utf8');
    // GR1: the world host has a third seam, the lab's grass; TR1 a
    // fourth, the trees - another program drawn behind the shadows' back
    const want = host === 'src/scenes/world.js' ? 4 : 2;
    assert.equal((s.match(/renderer\.markForeignPass\(\);/g) || []).length, want,
      `${host} marks its foreign seams (the sky, the rain${want === 4 ? ', the grass, and the trees' : ''})`);
  }
});

test('EV6: both exterior hosts sort their draw lists by mesh at build', () => {
  assert.ok(readFileSync('src/scenes/exterior.js', 'utf8').includes('drawList.sort((a, b) => a.order - b.order)'));
  assert.ok(readFileSync('src/scenes/world.js', 'utf8').includes('models.sort((a, b) => a._order - b._order)'));
});

// ═══ AUDIT 47: every shader declares what it uses, statically ═══════
test('AUDIT 47: no shader in the tree uses a uniform it did not declare in its own compilation unit', () => {
  // The fault class that black-screened the first Enhanced Environments
  // attempt: a use with no declaration, invisible to eslint, node and
  // vite, fatal at link. Checked here on every template in the three
  // shader files, with the shared block expanded the way the template
  // expands it. An injected declaration - a string replace after the
  // template - does not count, because it hides from this reader as it
  // hid from the last one (AUDIT 47 F1).
  const files = ['src/render/renderer.js', 'src/render/precipitation.js', 'src/render/enhancedSky.js'];
  // AUDIT 49: labGrass.js composes its stages as HEAD + FIELD + body, so
  // the reader composes them the same way before it looks
  {
    const src = readFileSync('src/render/labGrass.js', 'utf8');
    const tpl = (name) => { const i = src.indexOf(`export const ${name} = \``); return src.slice(i + `export const ${name} = \``.length, src.indexOf('`;', i)); };
    const vs = tpl('LAB_GRASS_HEAD') + tpl('GAME_GRASS_FIELD') + tpl('LAB_GRASS_VS');
    const fs = tpl('LAB_GRASS_HEAD') + tpl('LAB_GRASS_FS');
    for (const [label, body] of [['labGrass VS', vs], ['labGrass FS', fs]]) {
      const declared = new Set([...body.matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
      const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
      const missing = [...used].filter((u) => !declared.has(u));
      assert.deepEqual(missing, [], `${label} uses undeclared: ${missing.join(', ')}`);
      assert.ok(/terrain\(/.test(body) === (label === 'labGrass VS'), `${label}: terrain() belongs to the vertex stage`);
    }
    assert.ok(/float terrain\(vec2 p\)\{ return aRootY; \}/.test(vs), 'the game’s terrain() is the baked root height');
  }
  for (const file of files) {
    const s = readFileSync(file, 'utf8');
    assert.ok(!/`\.replace\('uniform /.test(s), `${file}: a uniform must be declared in the template, not injected after it`);
    const shared = (s.match(/const CLOUD_SHADOW_GLSL = `([\s\S]*?)`;/) || [, ''])[1];
    const re = /const ([A-Z_]+) = `#version 300 es([\s\S]*?)`(?:;|\.)/g;
    let m; let seen = 0;
    while ((m = re.exec(s))) {
      seen++;
      const body = m[2].replace(/\$\{CLOUD_SHADOW_GLSL\}/g, shared);
      const declared = new Set([...body.matchAll(/uniform\s+\w+\s+([^;]+);/g)]
        .flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
      const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
      const missing = [...used].filter((u) => !declared.has(u));
      assert.deepEqual(missing, [], `${file} ${m[1]} uses undeclared: ${missing.join(', ')}`);
    }
    assert.ok(seen > 0, `${file}: no shader templates found - the reader is broken, not the shaders`);
  }
});
