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
import { Renderer, CLOUD_SHADOW_UNIT, SKY_CLEAR } from '../src/render/renderer.js';
import { TEXTURE_SLOTS } from '../src/systems/dynamicSkies.js';   // AUDIT 65 RS-3: the nine slots the reserved unit has to clear

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
    // GR1: the world host has a third seam, the lab's grass
    const want = host === 'src/scenes/world.js' ? 3 : 2;
    assert.equal((s.match(/renderer\.markForeignPass\(\);/g) || []).length, want,
      `${host} marks its foreign seams (the sky, the rain${want === 3 ? ', and the grass' : ''})`);
  }
});

test('EV6: both exterior hosts sort their draw lists by mesh at build', () => {
  assert.ok(readFileSync('src/scenes/exterior.js', 'utf8').includes('drawList.sort((a, b) => a.order - b.order)'));
  assert.ok(readFileSync('src/scenes/world.js', 'utf8').includes('models.sort((a, b) => a._order - b._order)'));
});

// ═══ AUDIT 65: the same stub, grown a LOG and REAL enum NUMBERS ═════
// `gl.TEXTURE0 + CLOUD_SHADOW_UNIT` is arithmetic, so the counting
// stub's `return 1` (and hudlarge's string enums) cannot say WHICH
// unit a call touched. Every other enum gets a stable unique number so
// the bit-ORed clear masks still behave like numbers.
const GL_ENUMS = { TEXTURE0: 0x84C0, FRAMEBUFFER: 0x8D40, TEXTURE_2D: 0x0DE1 };
const enumIds = new Map();
function glEnum(k) {
  if (GL_ENUMS[k] !== undefined) return GL_ENUMS[k];
  if (!enumIds.has(k)) enumIds.set(k, 0x9000 + enumIds.size);
  return enumIds.get(k);
}
function loggingRenderer(log, size = { w: 640, h: 400 }) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return size.w;
      if (k === 'drawingBufferHeight') return size.h;
      if (typeof k === 'string' && k.toUpperCase() === k) return glEnum(k);
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: size.w, clientHeight: size.h, width: size.w, height: size.h };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const LIGHT = () => new Float32Array([0, 1, 0]);

test('AUDIT 65 RS-2: the sprite pass hands back the FBO, the world rect AND the clear colour on a THROW', () => {
  // drawCharacter dereferences the mesh, so it CAN throw, and the icon
  // path swallows it (fpArm.js's `catch { img = null; }`) - so the
  // restores have to be in the finally or the session runs on over a
  // bound offscreen target, a viewport stuck at the sprite's corner,
  // and a clear colour of transparent black.
  const log = [];
  const r = loggingRenderer(log);
  const I = identity();
  r.setWorldViewport({ x: 0, y: 92 / 400, w: 1, h: 1 - 92 / 400 });   // the docked large HUD
  r.beginFrame(I, I, LIGHT());
  assert.deepEqual(r.worldViewportPx, [0, 92, 640, 308]);
  let atThrow = -1;
  r.drawCharacter = () => { atThrow = log.length; throw new Error('mesh.vao of undefined'); };

  const at = log.length;
  assert.throws(() => r.renderCharacterSprite({ vao: {}, count: 3 }, I, I, I, 200, 300),
    /mesh\.vao/, 'the throw still propagates - the finally restores, it does not swallow');
  // the draw really ran against the borrowed target and the borrowed
  // corner, so what follows is a RESTORE and not a coincidence
  assert.notEqual(log.slice(0, atThrow).filter((e) => e[0] === 'bindFramebuffer').at(-1)[2], null,
    'the sprite FBO was bound when drawCharacter threw');
  assert.deepEqual(log.slice(0, atThrow).filter((e) => e[0] === 'viewport').at(-1), ['viewport', 0, 0, 200, 300],
    'and the viewport was the sprite\'s own corner');
  assert.deepEqual(log.slice(at).slice(-3), [
    ['bindFramebuffer', GL_ENUMS.FRAMEBUFFER, null],
    ['viewport', 0, 92, 640, 308],
    ['clearColor', ...r._clearColor],
  ], 'the pass ends GL-first: the sprite FBO unbound, the world rect back, the clear colour back');

  // AND THE SHADOW IS STILL TRUE, which is the half that makes this
  // permanent rather than one frame: setClearColor is idempotent
  // against `_clearColor`, so had the finally not re-issued the
  // colour, a host asking for the sky again would issue NOTHING and GL
  // would hold transparent black for the rest of the session (AUDIT 26
  // F034's shipped bug, restored).
  r.setClearColor(SKY_CLEAR);
  const held = log.filter((e) => e[0] === 'clearColor').at(-1).slice(1);
  assert.deepEqual(held, [...r._clearColor], 'GL holds what the _clearColor shadow claims it holds');
  assert.deepEqual(held.map(Math.fround), SKY_CLEAR.map(Math.fround), 'and that is the sky, not the sprite pass\'s transparent black');

  // the read-back path's own bind is in a finally for the same reason;
  // there is no seam to make the stub's readPixels throw, so this half
  // is pinned on the source (the funnel-law idiom above).
  assert.match(readFileSync('src/render/renderer.js', 'utf8'),
    /try \{ gl\.readPixels\(0, 0, pw, ph, gl\.RGBA, gl\.UNSIGNED_BYTE, raw\); \}\s*\n\s*finally \{ gl\.bindFramebuffer\(gl\.FRAMEBUFFER, null\); \}/,
    'renderCharacterSpriteImage returns the read-back bind too');
});

test('AUDIT 65 RS-3: a foreign pass forgets the cloud-shadow uploads, and the next draw rebinds the reserved unit', () => {
  const log = [];
  const r = loggingRenderer(log);
  const I = identity();
  const unit = GL_ENUMS.TEXTURE0 + CLOUD_SHADOW_UNIT;
  const mesh = { vao: {}, count: 3 };
  r.beginFrame(I, I, LIGHT());
  r.setCloudShadow({ map: {}, rect: [0, 0, 1024, 0.5] });

  log.length = 0;
  r.drawCharacter(mesh, I);
  assert.ok(log.some((e) => e[0] === 'activeTexture' && e[1] === unit),
    'the first draw of this key uploads the map on the reserved unit');

  // the stamp is what makes the second draw free - that much is EV6's
  // own economy and must survive the fix.
  log.length = 0;
  r.drawCharacter(mesh, I);
  assert.equal(log.filter((e) => e[0] === 'activeTexture' && e[1] === unit).length, 0,
    'and holds while nothing foreign runs');

  // now the seam: a foreign pass (the Dynamic Skies sheet walks nine
  // units as TEXTURE0 + i) writes a unit behind the renderer's back,
  // and the host marks it. The stamp is a claim about a binding this
  // renderer can no longer account for.
  r.gl.activeTexture(unit);
  r.gl.bindTexture(r.gl.TEXTURE_2D, { foreign: true });
  r.markForeignPass();

  log.length = 0;
  r.drawCharacter(mesh, I);
  const i = log.findIndex((e) => e[0] === 'activeTexture' && e[1] === unit);
  assert.ok(i >= 0, 'the mark dropped the stamp: the reserved unit is re-issued');
  assert.equal(log[i + 1][0], 'bindTexture', 'and the shadow map is bound back onto it');
  assert.ok(log.some((e) => e[0] === 'uniform1i' && e[1] === r._csLoc.char[0] && e[2] === CLOUD_SHADOW_UNIT),
    'with the sampler pointed at the same unit');
});

test('AUDIT 65 RS-3: the reserved cloud-shadow unit stands clear of every slot a foreign pass binds', () => {
  // THE fix's pin: at unit 7 this read 9 <= 7 and failed. The mod
  // bases its sheet at unit 0, so its top unit is TEXTURE_SLOTS.length
  // - 1 and the reservation has to sit above it.
  assert.match(readFileSync('src/render/dynamicSkiesRenderer.js', 'utf8'), /gl\.activeTexture\(gl\.TEXTURE0 \+ i\);/,
    'the Dynamic Skies sheet is based at unit 0');
  assert.ok(TEXTURE_SLOTS.length <= CLOUD_SHADOW_UNIT,
    `the mod's ${TEXTURE_SLOTS.length} slots run 0..${TEXTURE_SLOTS.length - 1}, below the reserved ${CLOUD_SHADOW_UNIT}`);
  assert.ok(CLOUD_SHADOW_UNIT <= 15, 'and WebGL2 only guarantees MAX_TEXTURE_IMAGE_UNITS >= 16');
  const rr = readFileSync('src/render/renderer.js', 'utf8');
  assert.doesNotMatch(rr, /gl\.TEXTURE7\b/, 'the literal is gone from both sites');
  assert.match(rr, /gl\.activeTexture\(gl\.TEXTURE0 \+ CLOUD_SHADOW_UNIT\);/);
  assert.match(rr, /gl\.uniform1i\(mapLoc, CLOUD_SHADOW_UNIT\);/);
  assert.match(rr, /markForeignPass\(\) \{\s*\n\s*this\.gl\.bindVertexArray\(null\);\s*\n\s*this\._lastProgram = null;\s*\n\s*this\._lastVao = null;\s*\n\s*this\._csUploaded = \{\};\s*\n\s*\}/,
    'and the mark forgets the upload stamps with the program and the VAO');
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
  const files = ['src/render/renderer.js', 'src/render/precipitation.js', 'src/render/enhancedSky.js', 'src/render/cloudNoise.js', 'src/render/volumetricClouds.js'];   // VC2/VC3: the noise generators, the slice viewer, the march and the composite
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
    const field = (s.match(/const CLOUD_FIELD_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // VC4: the marches' shared field
    const re = /const ([A-Z_]+) = `#version 300 es([\s\S]*?)`(?:;|\.)/g;
    let m; let seen = 0;
    while ((m = re.exec(s))) {
      seen++;
      const body = m[2].replace(/\$\{CLOUD_SHADOW_GLSL\}/g, shared).replace(/\$\{CLOUD_FIELD_GLSL\}/g, field);
      const declared = new Set([...body.matchAll(/uniform\s+\w+\s+([^;]+);/g)]
        .flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
      const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
      const missing = [...used].filter((u) => !declared.has(u));
      assert.deepEqual(missing, [], `${file} ${m[1]} uses undeclared: ${missing.join(', ')}`);
    }
    assert.ok(seen > 0, `${file}: no shader templates found - the reader is broken, not the shaders`);
  }
});
