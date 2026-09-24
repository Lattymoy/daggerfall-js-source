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
import { PrecipitationRenderer } from '../src/render/precipitation.js';
import { warmPrograms } from '../src/render/warmPrograms.js';
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

/**
 * A method's body, by MATCHING ITS BRACES.
 *
 * FIELD-GUN19: this used to be `slice(at, at + 2600)` - a window in
 * characters - and a ONE-LINE addition inside beginFrame pushed the
 * last thing it looks for out the far end, reddening a gate about
 * program binds for a change that touched none. A window measured in
 * characters is a rule enforced by a magic number: it fails when the
 * function grows and, worse, it passes when the function grows PAST
 * something it should still have been reading.
 */
function bodyOf(src, signature) {
  const at = src.indexOf(signature);
  if (at < 0) throw new Error(`glstate: renderer.js no longer declares \`${signature}\``);
  let depth = 0;
  for (let i = at + signature.length - 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(`glstate: \`${signature}\` never closes`);
}

test('EV6: every program and VAO bind in renderer.js funnels through the shadows', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  // exactly ONE raw useProgram (inside _use) and TWO raw
  // bindVertexArray (inside _bindVao and markForeignPass) survive -
  // a third of either is a bind the shadows cannot see
  assert.equal((r.match(/gl\.useProgram\(/g) || []).length, 1, 'only _use touches useProgram');
  assert.equal((r.match(/gl\.bindVertexArray\(/g) || []).length, 2, 'only _bindVao and markForeignPass touch bindVertexArray');
  // the element-buffer upload that owns no VAO unbinds first, or it
  // would capture its buffer into whatever drawMesh left bound
  const ti = bodyOf(r, '_terrainIndices(indices) {');
  assert.ok(ti.indexOf('this._bindVao(null);') > 0 && ti.indexOf('this._bindVao(null);') < ti.indexOf('ELEMENT_ARRAY_BUFFER'),
    '_terrainIndices unbinds before touching the element buffer');
  // AUDIT EV F-DOC5: beginFrame's internal ORDER - shadow reset, then
  // the real bind, then the uniform uploads. Uniforms uploaded before
  // _use would land in whatever foreign program the sky or the ring
  // left bound, and the counting stub's uniform no-ops would never see
  // it.
  const bf = bodyOf(r, 'beginFrame(proj, view, lightDir, opts = null) {');   // AUDIT-EL F5: the world flag
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
    // GR1: the world host has a third seam, the lab's grass; WIND3: both
    // hosts one more, the wisps (drawn after the rain, on their own program)
    // WEATHER2d: and the sand, one more in both; BOLT: and the lightning's channels, one more in both
    const want = host === 'src/scenes/world.js' ? 6 : 5;
    assert.equal((s.match(/renderer\.markForeignPass\(\);/g) || []).length, want,
      `${host} marks its foreign seams (the sky, the rain, the sand, the wisps, the bolts${want === 6 ? ', and the grass' : ''})`);
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
    /try \{ gl\.readPixels\(0, 0, pw, ph, gl\.RGBA, gl\.UNSIGNED_BYTE, raw\); \}\s*\n\s*finally \{ gl\.bindFramebuffer\(gl\.FRAMEBUFFER, this\._frameFbo \?\? null\); \}/,   // EL4: the frame image while the lane draws into one, the canvas otherwise
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
  assert.match(rr, /this\._activeTexture\(gl\.TEXTURE0 \+ CLOUD_SHADOW_UNIT\);/);   // PERF-TEX3: through the selector's funnel
  assert.match(rr, /gl\.uniform1i\(mapLoc, CLOUD_SHADOW_UNIT\);/);
  // PERF-TEX joined the texture shadows to this list, so the pin is what
  // the mark must DO rather than the whole of its body; the additions have
  // their own test above, and RS-3's law is these three.
  {
    const mark = rr.split('  markForeignPass(')[1].split('\n  }')[0];
    assert.match(mark, /this\.gl\.bindVertexArray\(null\);/);
    assert.match(mark, /this\._lastProgram = null;/);
    assert.match(mark, /this\._lastVao = null;/);
    assert.match(mark, /this\._csUploaded = \{\};/, 'the mark forgets the upload stamps with the program and the VAO');
  }
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
  const files = ['src/render/renderer.js', 'src/render/waterSurface.js', 'src/render/precipitation.js', 'src/render/enhancedSky.js', 'src/render/cloudNoise.js', 'src/render/volumetricClouds.js', 'src/render/enhancedLighting.js', 'src/render/farRing.js', 'src/render/shadowPass.js', 'src/render/airPass.js'];   // VC2/VC3: the noise generators, the slice viewer, the march and the composite; EL1: the lighting lane's five, and the far ring; EL2: the depth programs
  const shadowGlsl = (readFileSync('src/render/shadowPass.js', 'utf8').match(/export const SHADOW_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // EL2: the receiver block another file composes in
  const cloudShadowGlsl = (readFileSync('src/render/cloudShadow.js', 'utf8').match(/export const CLOUD_SHADOW_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // VC6c: and the cloud shadow's, once TWO passes needed it
  const aoGlsl = (readFileSync('src/render/airPass.js', 'utf8').match(/export const AIR_AO_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // EL3: and the AO's
  const adaptGlsl = (readFileSync('src/render/airPass.js', 'utf8').match(/export const AIR_ADAPT_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // EL4: and the eye's
  const fogGlsl = (readFileSync('src/render/fogGlsl.js', 'utf8').match(/export const FOG_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // AUDIT 68 S17-fog-glsl-dup: and the fog's, which nine programs share
  assert.match(fogGlsl, /uFogMode/, 'the fog block is where the sweep reads it');
  // AUDIT 49: labGrass.js composes its stages as HEAD + FIELD + body, so
  // the reader composes them the same way before it looks
  {
    const src = readFileSync('src/render/labGrass.js', 'utf8');
    const tpl = (name) => { const i = src.indexOf(`export const ${name} = \``); return src.slice(i + `export const ${name} = \``.length, src.indexOf('`;', i)); };
    const vs = tpl('LAB_GRASS_HEAD') + tpl('GAME_GRASS_FIELD') + tpl('LAB_GRASS_VS');
    const fs = tpl('LAB_GRASS_HEAD') + tpl('LAB_GRASS_FS');
    for (const [label, body] of [['labGrass VS', vs], ['labGrass FS', fs]]) {
      const declared = new Set([...body.matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+([^;]+);/g)].flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
      const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
      const missing = [...used].filter((u) => !declared.has(u));
      assert.deepEqual(missing, [], `${label} uses undeclared: ${missing.join(', ')}`);
      assert.ok(/terrain\(/.test(body) === (label === 'labGrass VS'), `${label}: terrain() belongs to the vertex stage`);
    }
    // GRASS5: the root height is no longer an attribute of its own - it
    // is a lane of the packed A stream, decoded in main() into a global
    // that terrain() reads. Still the baked height; no longer a baked
    // ATTRIBUTE, which is the whole point of the pack.
    assert.ok(/float terrain\(vec2 p\)\{ return gRootY; \}/.test(vs), 'the game’s terrain() is the baked root height');
    assert.ok(/gRootY = uCellFrame\.z \+ aPA\.z \* uCellFrame\.w;/.test(vs), '...unpacked from the cell’s own frame');
    assert.ok(!/in float aRootY;/.test(vs), 'and it costs no attribute of its own');
  }
  for (const file of files) {
    const s = readFileSync(file, 'utf8');
    assert.ok(!/`\.replace\('uniform /.test(s), `${file}: a uniform must be declared in the template, not injected after it`);
    // VC6c: the cloud shadow block moved to its own leaf when a SECOND
    // pass (the air's shafts) needed it, so the sweep follows it there -
    // a file that interpolates an imported block must still be swept, or
    // the move would have silently taken two shaders out of the net.
    const shared = (s.match(/const CLOUD_SHADOW_GLSL = `([\s\S]*?)`;/) || [, ''])[1]
      || (/\$\{CLOUD_SHADOW_GLSL\}/.test(s) ? cloudShadowGlsl : '');
    const field = (s.match(/const CLOUD_FIELD_GLSL = `([\s\S]*?)`;/) || [, ''])[1];   // VC4: the marches' shared field
    const re = /const ([A-Z_]+) = `#version 300 es([\s\S]*?)`(?:;|\.)/g;
    let m; let seen = 0;
    while ((m = re.exec(s))) {
      seen++;
      // EL1: a file's OTHER interpolated blocks (`const NAME = \`...\`` with no #version) expand the same way - the
      // lighting lane composes EL_GLSL + EL_FOG_GLSL + EL_POINT_LIT_GLSL into each of its shaders
      const body = m[2].replace(/\$\{CLOUD_SHADOW_GLSL\}/g, shared).replace(/\$\{CLOUD_FIELD_GLSL\}/g, field).replace(/\$\{SHADOW_GLSL\}/g, shadowGlsl).replace(/\$\{AIR_AO_GLSL\}/g, aoGlsl).replace(/\$\{AIR_ADAPT_GLSL\}/g, adaptGlsl).replace(/\$\{(?:EL_)?FOG_GLSL\}/g, fogGlsl)
        .replace(/\$\{([A-Z_]+)\}/g, (all, name) => { const b = s.match(new RegExp(`const ${name} = \`([^\`]*)\``)); return b ? b[1] : all; });
      const declared = new Set([...body.matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+([^;]+);/g)]
        .flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
      const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
      const missing = [...used].filter((u) => !declared.has(u));
      assert.deepEqual(missing, [], `${file} ${m[1]} uses undeclared: ${missing.join(', ')}`);
    }
    assert.ok(seen > 0, `${file}: no shader templates found - the reader is broken, not the shaders`);
  }
});

// ═══ PERF-TEX: THE EMISSION UNIT GETS EV6's TREATMENT ═══════════════
//
// Mac, 2026-09-18: "maximum performance with maximum quality. No
// exceptions." So: not a setting, not a tier - deleted work.
//
// MEASURED, not guessed, over a real `Renderer` on a logging GL stub
// (PERF-ON's precedent). The batched static mesh path - what PERF4/5/6
// built, and the bulk of any scene's draws - bound TWO textures and
// switched the active unit twice for every sub-mesh. But `_evEmis` is
// `_blackTex` for everything that is not a window or an auto-emissive
// record, so over 240 draws, 239 of its 481 bindTexture calls set a
// unit to the texture it already held. `drawBillboards` had skipped
// exactly this on `lastKey` since it was written; the mesh loop never
// did.
//
// Binding a texture that is already bound is a no-op BY DEFINITION, so
// this cannot move a pixel - which is what the equality test below
// exists to prove rather than assert.
const glLogRig = (size = { w: 640, h: 400 }) => {
  const log = [];
  const ids = new Map();
  const glEnum = (k) => { if (!ids.has(k)) ids.set(k, 0x9000 + ids.size); return ids.get(k); };
  const stub = new Proxy({}, { get: (o, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, name) => ({ name });
    if (k === 'getAttribLocation') return () => 0;
    if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
      || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer'
      || k === 'createRenderbuffer' || k === 'createQuery') return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
    if (k === 'getExtension') return () => null;
    if (k === 'drawingBufferWidth') return size.w;
    if (k === 'drawingBufferHeight') return size.h;
    if (typeof k === 'string' && k.toUpperCase() === k) return glEnum(k);
    return (...args) => { log.push([k, ...args.map((v) => (ArrayBuffer.isView(v) ? v.slice() : v))]); };
  } });
  const canvas = { getContext: () => stub, clientWidth: size.w, clientHeight: size.h, width: size.w, height: size.h };
  const r = new Renderer(canvas);
  log.length = 0;
  return { r, log };
};

/** What the GPU would actually see at every draw: the program, the VAO
 *  and the texture on each unit, replayed through the GL state machine. */
const effectiveDraws = (log) => {
  let unit = 0, prog = null, vao = null;
  const units = new Map();
  const out = [];
  const id = (t) => (t && t.id) ? t.id : String(t);
  for (const [k, ...a] of log) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture') units.set(unit, a[1]);
    else if (k === 'useProgram') prog = a[0];
    else if (k === 'bindVertexArray') vao = a[0];
    else if (k === 'drawElements') out.push([id(prog), id(vao), id(units.get(0)), id(units.get(1)), a[1], a[3]].join('|'));
  }
  return out;
};

/** A scene whose emission maps really do change between sub-meshes - a
 *  constant black would prove nothing about the shadow's correctness. */
const meshScene = (r, log) => {
  const M = () => new Float32Array(identity());
  for (let i = 0; i < 8; i++) r.textures.set(`${100 + i}_0`, { id: `albedo${i}` });
  r.emissionTextures.set('102_0', { id: 'emisWindow' });
  r.emissionTextures.set('105_0', { id: 'emisLamp' });
  r.emissionWhite.add('105_0');
  r.beginFrame(M(), M(), new Float32Array([0, -1, 0]));
  const from = log.length;
  for (let i = 0; i < 20; i++) {
    r.drawMesh({
      vao: { id: `vao${i}` },
      subMeshes: Array.from({ length: 4 }, (_, k) => ({
        startIndex: k * 300, primitiveCount: 100, textureArchive: 100 + ((k + i) % 8), textureRecord: 0,
      })),
    }, M());
  }
  return log.slice(from);
};

test('PERF-TEX: no draw in the mesh path binds a texture to the unit that already holds it', () => {
  const { r, log } = glLogRig();
  const slice = meshScene(r, log);
  let unit = 0, redundant = 0, total = 0;
  const held = new Map();
  for (const [k, ...a] of slice) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture') { total++; if (held.get(unit) === a[1]) redundant++; held.set(unit, a[1]); }
  }
  assert.equal(r.stats.draws, 80, 'the scene really drew');
  assert.ok(total > 0, 'and really bound textures');
  assert.equal(redundant, 0, `${redundant} of ${total} binds set a unit to what it already held`);
});

test('PERF-TEX: the shadow is EV6’s, so the saving is real - fewer GL calls for the same draws', () => {
  const { r, log } = glLogRig();
  const slice = meshScene(r, log);
  const draws = slice.filter((e) => e[0] === 'drawElements').length;
  assert.equal(draws, 80);
  // Before the shadow this path spent 2 activeTexture + 2 bindTexture a
  // sub-mesh, unconditionally: 4 texture-state calls a draw, always.
  const texState = slice.filter((e) => e[0] === 'activeTexture' || e[0] === 'bindTexture').length;
  // Unshadowed this path spent exactly 4 a draw. This scene is
  // deliberately adversarial - its emission map changes every few
  // sub-meshes, where a real one is `_blackTex` for nearly all of them -
  // so the floor here is well above what a street or a dungeon sees.
  assert.ok(texState < draws * 4, `texture state is still ${texState} for ${draws} draws - the shadow is not skipping`);
  assert.ok(texState < draws * 3, `${(texState / draws).toFixed(2)} texture calls a draw, against 4 unshadowed`);
});

test('PERF-TEX: it moves NO PIXEL - the effective GPU state at every draw is what the unshadowed path produced', () => {
  // THE PIN THAT MATTERS, and the reason this is a performance change
  // and not a rendering change. The unshadowed path is reconstructed
  // here rather than remembered: every sub-mesh binds both units, which
  // is exactly what the loop did before. If the shadow ever skips a bind
  // it should not have, these two sequences diverge.
  const { r, log } = glLogRig();
  const shadowed = effectiveDraws(meshScene(r, log));

  const { r: r2, log: log2 } = glLogRig();
  const raw = [];
  {
    const M = () => new Float32Array(identity());
    for (let i = 0; i < 8; i++) r2.textures.set(`${100 + i}_0`, { id: `albedo${i}` });
    r2.emissionTextures.set('102_0', { id: 'emisWindow' });
    r2.emissionTextures.set('105_0', { id: 'emisLamp' });
    r2.emissionWhite.add('105_0');
    r2.beginFrame(M(), M(), new Float32Array([0, -1, 0]));
    // the same scene, with the shadow defeated before every draw
    for (let i = 0; i < 20; i++) {
      const from = log2.length;
      r2._tex1Bound = null;   // "always bind", i.e. the path as it was
      r2.drawMesh({
        vao: { id: `vao${i}` },
        subMeshes: Array.from({ length: 4 }, (_, k) => ({
          startIndex: k * 300, primitiveCount: 100, textureArchive: 100 + ((k + i) % 8), textureRecord: 0,
        })),
      }, M());
      raw.push(...log2.slice(from));
    }
  }
  assert.deepEqual(shadowed, effectiveDraws(raw), 'the shadow changed what a draw sees');
  assert.equal(shadowed.length, 80);
});

test('PERF-TEX: the shadow is cleared wherever something else can own unit 1', () => {
  const src = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  // Every bind of unit 1 in the renderer either goes THROUGH the helper
  // or clears the shadow - otherwise it can speak for a unit it no
  // longer owns, which is a wrong texture, which is a visual bug.
  const body = src.split('_bindEmission(tex) {')[1].split('\n  }')[0];
  assert.match(body, /if \(this\._tex1Bound === tex\) return;/, 'the helper is a shadow, not a wrapper');
  // PERF-TEX3: through the funnel now - 97% of this file's activeTexture
  // calls selected the unit already selected, so the raw call lives in
  // _activeTexture alone and everything else asks it.
  assert.match(body, /this\._activeTexture\(gl\.TEXTURE0\);/, 'and it leaves unit 0 active, as every draw path expects');
  // AUDIT-AIR1: ...through the ONE HOME now. The clear was hand-copied at
  // five seams and missing at the sixth (the air resolve), which is the
  // bug that made it a function - so what these sites must show is the
  // CALL, and the helper's own contents are pinned where it lives.
  for (const site of ['beginFrame', 'endWorldPass']) {
    const fn = src.split(`  ${site}(`)[1]?.split('\n  }')[0] ?? '';
    assert.match(fn, /this\._forgetTextureShadows\(\);/, `${site} does not forget the shadows`);
  }
  assert.match(src, /_forgetTextureShadows\(\) \{[\s\S]{0,240}?this\._tex1Bound = null;/, 'and the one home clears unit 1');
  // and no site binds TEXTURE_2D to unit 1 outside the helper without clearing it
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/activeTexture\(gl\.TEXTURE1\)/.test(lines[i])) continue;
    const window = lines.slice(i, i + 4).join('\n');
    // AUDIT-AIR1: `_forgetTextureShadows()` is a third way to answer -
    // and a stronger one, since it clears the whole set. It only counts
    // because the assertion above proves the helper really clears
    // `_tex1Bound`; without that this arm would be a name, not a law.
    assert.match(window, /_tex1Bound|_bindEmission|_forgetTextureShadows/, `renderer.js:${i + 1} binds unit 1 without answering to the shadow`);
  }
});

// ═══ PERF-TEX2: THE TERRAIN'S ATLAS AND ITS TILE SIZE ══════════════
//
// The same sweep over drawTerrain, which runs once per streamed pixel -
// 121 of them at the default land view. Measured over 121 pixels with a
// model matrix and a tilemap of their own (as the streamer gives them)
// and the world's single tile atlas shared between them: 1239 GL calls,
// of which 120 bindTexture and 120 uniform1f set a value to the one it
// already held. The tilemap is the pixel's; the ATLAS and the TILE SIZE
// are the world's, and PERF3 left the latter outside its frame-constant
// block as "per-pixel" when it is per-WORLD.
//
// Shadowed, never hoisted: a caller that really does change either still
// uploads, so this cannot be wrong - only cheaper.
const terrainScene = (r, log, { atlas = { id: 'atlas' }, tileSize = 128, n = 121 } = {}) => {
  const M = () => new Float32Array(identity());
  const from = log.length;
  for (let i = 0; i < n; i++) {
    const m = M(); m[12] = i * 1024;
    r.drawTerrain({ vao: { id: `t${i}` }, indexCount: 768 }, m, atlas, { id: `tm${i}` }, tileSize);
  }
  return log.slice(from);
};

test('PERF-TEX2: the terrain pixel loop re-binds no atlas and re-uploads no tile size it already holds', () => {
  const { r, log } = glLogRig();
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const slice = terrainScene(r, log);
  assert.equal(r.stats.draws, 121, 'the pixels really drew');
  let unit = 0, redundant = 0;
  const held = new Map();
  for (const [k, ...a] of slice) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture') { if (held.get(unit) === a[1]) redundant++; held.set(unit, a[1]); }
  }
  assert.equal(redundant, 0, 'a texture was bound to the unit that already held it');
  const tileUploads = slice.filter((e) => e[0] === 'uniform1f' && e[1] === r.tUTileSize).length;
  assert.equal(tileUploads, 1, `the tile size went up ${tileUploads} times for one world`);
});

test('PERF-TEX2: a world that really DOES change its atlas or tile size still uploads - the shadow is not a hoist', () => {
  const { r, log } = glLogRig();
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  terrainScene(r, log, { n: 3 });
  const from = log.length;
  terrainScene(r, log, { atlas: { id: 'other' }, tileSize: 64, n: 3 });
  const after = log.slice(from);
  assert.equal(after.filter((e) => e[0] === 'uniform1f' && e[1] === r.tUTileSize).length, 1,
    'the new tile size never reached the GPU');
  assert.ok(after.some((e) => e[0] === 'bindTexture' && e[2]?.id === 'other'), 'the new atlas was never bound');
});

test('PERF-TEX: every texture shadow is forgotten when a foreign pass takes the context', () => {
  // THE ONE THAT MATTERS FOR CORRECTNESS. The skies and precipitation
  // draw outside this renderer and bind their own textures on their own
  // units; EV6 already forgets the program and VAO shadows for them, and
  // a texture shadow that did not join them would speak for a unit it no
  // longer owns - a wrong texture on screen, which is the one thing a
  // performance change may never cost.
  const { r } = glLogRig();
  r._tex1Bound = { id: 'emis' }; r._tArrayTex = { id: 'atlas' }; r._tTileSize = 128;
  r.markForeignPass();
  assert.equal(r._tex1Bound, null, 'the emission unit still thinks it knows what is bound');
  assert.equal(r._tArrayTex, null, 'the tile atlas still thinks it knows what is bound');
  assert.equal(r._tTileSize, null, 'the tile size shadow survived a foreign pass');
  const src = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  const fn = src.split('  markForeignPass(')[1].split('\n  }')[0];
  assert.match(fn, /this\._forgetTextureShadows\(\);/, 'markForeignPass forgets them through the one home (AUDIT-AIR1)');
  const home = src.split('_forgetTextureShadows() {')[1].split('\n  }')[0];
  for (const shadow of ['_tex1Bound', '_tArrayTex', '_tTileSize']) {
    assert.match(home, new RegExp(`${shadow} = null`), `the one home does not clear ${shadow}`);
  }
});

// ═══ PERF-UI: THE SCREEN QUAD'S FOUR THAT ARE NOT A QUAD'S OWN ══════
//
// `drawScreenQuad` is the UI arc's primitive, and the HUD draws a
// hundred-odd of them a frame in EVERY scene there is - a dungeon and a
// building interior included, which is where "across the game" lands.
// Measured at 17.1 GL calls a quad, of which more than half set state
// that was already set: the canvas size (the FRAME's), the sampler
// binding (a CONSTANT - uTex is unit 0 and never anything else), and
// useTex / blendTex / rotOn / colour, which are the same for every quad
// of a run - a row of icons, a bar, a panel's backdrop.
//
// PERF-ON gave the TEXT case one draw a string. This is the same saving
// for every quad that is not text, and it needs no new API: the sampler
// goes up once with the program, and the rest are shadowed ON VALUE, so
// a caller that really changes one still uploads.
const uiScene = (r, log) => {
  const from = log.length;
  const A = { id: 'iconsheet' }, B = { id: 'bars' };
  for (let i = 0; i < 20; i++) r.drawScreenQuad(A, { x: i * 8, y: 4, w: 8, h: 8 });
  for (let i = 0; i < 10; i++) r.drawScreenQuad(B, { x: i, y: 20, w: 40, h: 4 }, { u0: 0, v0: 0, u1: 1, v1: 1 }, [1, 0.2, 0.2, 1]);
  for (let i = 0; i < 5; i++) r.drawScreenQuad(null, { x: i, y: 30, w: 60, h: 20 }, undefined, [0, 0, 0, 0.5]);
  for (let i = 0; i < 5; i++) r.drawScreenQuad(A, { x: i, y: 60, w: 16, h: 16 }, undefined, [1, 1, 1, 1], { blend: true });
  for (let i = 0; i < 5; i++) r.drawScreenQuad(B, { x: i, y: 80, w: 8, h: 8 }, undefined, [1, 1, 1, 1], { rotate: { rad: i, px: 4, py: 4 } });
  for (let i = 0; i < 10; i++) r.drawScreenQuad(A, { x: i, y: 100, w: 8, h: 8 });
  return log.slice(from);
};

/** Every uniform and texture the quad program would be drawing WITH, at
 *  each draw - the only thing that decides the pixels. */
const uiEffective = (r, slice) => {
  const U = r._screenQuad;
  const nameOf = (loc) => Object.keys(U).find((k) => U[k] === loc) ?? '?';
  let unit = 0; const units = new Map(); const uni = new Map(); const out = [];
  for (const [k, ...a] of slice) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture') units.set(unit, a[1]);
    else if (k.startsWith('uniform')) uni.set(nameOf(a[0]), a.slice(1).join(','));
    else if (k === 'drawElements') out.push(JSON.stringify({ t: units.get(0)?.id ?? null, u: Object.fromEntries([...uni].sort()) }));
  }
  return out;
};

test('PERF-UI: the screen quad stops re-uploading the frame’s canvas, the constant sampler, and a run’s shared flags', () => {
  const { r, log } = glLogRig();
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const slice = uiScene(r, log);
  const quads = slice.filter((e) => e[0] === 'drawElements').length;
  assert.equal(quads, 55, 'the scene really drew');
  const U = r._screenQuad;
  const count = (loc) => slice.filter((e) => e[0].startsWith('uniform') && e[1] === loc).length;
  assert.equal(count(U.canvas), 1, `the canvas size went up ${count(U.canvas)} times for one frame`);
  // Once, with the program - which is built lazily inside the first
  // drawScreenQuad, so that one upload falls inside this slice. Never again.
  assert.ok(count(U.tex) <= 1, `the sampler binding went up ${count(U.tex)} times - it is the program's, not a quad's`);
  // dst and src ARE a quad's own and must still go up every time
  assert.equal(count(U.dst), quads, 'the destination rect is per-quad and must never be shadowed');
  assert.equal(count(U.src), quads, 'nor the source rect');
  // ...and the shared ones go up only when they change
  assert.ok(count(U.color) < quads, `the colour went up ${count(U.color)} times for ${quads} quads`);
  assert.ok(count(U.useTex) < quads && count(U.rotOn) < quads && count(U.blendTex) < quads);
});

test('PERF-UI: it moves NO PIXEL - every uniform and texture at every quad is what the unshadowed path produced', () => {
  // The colour and flag shadows are the ones that could bite: skip an
  // upload the caller meant and the quad draws in the last one's colour.
  // So the scene above deliberately changes each of them at least twice,
  // and the two sequences are compared field for field.
  const { r: a, log: la } = glLogRig();
  a.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const shadowed = uiEffective(a, uiScene(a, la));

  const { r: b, log: lb } = glLogRig();
  b.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  // the path as it was: nothing remembered between quads
  const raw = [];
  const from = lb.length;
  const orig = b.drawScreenQuad.bind(b);
  b.drawScreenQuad = (...args) => { b._sq = {}; return orig(...args); };
  uiScene(b, lb);
  raw.push(...lb.slice(from));
  assert.deepEqual(shadowed, uiEffective(b, raw), 'a shadow skipped an upload the caller meant');
  assert.equal(shadowed.length, 55);
});

// PERF-WARM - the compile that no longer happens mid-frame. The stub
// does not compile shaders, so nothing here measures the win; what it
// pins is the STRUCTURE the win rests on: that the five on-demand
// programs each have an idempotent step, that warming builds them all
// before any draw does, that the draw path still builds on demand for
// a renderer nobody warmed, and that a failing step does not take the
// rest of the warm with it.

/** Run warmPrograms with a synchronous scheduler, so a test does not
 *  wait on requestIdleCallback (there is none in node). */
const runWarm = (steps, opts = {}) => warmPrograms(steps, { idle: (fn) => fn(), ...opts });

test('PERF-WARM: warmSteps names the five on-demand programs, and warming builds every one', async () => {
  const r = countingRenderer({});
  const names = ['screenQuadProgram', 'screenQuadRunProgram', 'charQuadProgram', 'particleProgram', 'overlayProgram'];
  for (const n of names) assert.ok(!r[n], `${n} is not built before the warm`);

  const steps = r.warmSteps();
  assert.equal(steps.length, names.length, 'one step per on-demand program');
  const done = await runWarm(steps);
  assert.equal(done, names.length, 'every step ran');
  for (const n of names) assert.ok(r[n], `${n} was built by the warm`);
});

test('PERF-WARM: the steps are idempotent - a second warm rebuilds nothing', async () => {
  const r = countingRenderer({});
  await runWarm(r.warmSteps());
  const first = {
    sq: r.screenQuadProgram, run: r.screenQuadRunProgram, cq: r.charQuadProgram,
    p: r.particleProgram, ov: r.overlayProgram,
  };
  await runWarm(r.warmSteps());
  assert.equal(r.screenQuadProgram, first.sq, 'the screen quad kept its program');
  assert.equal(r.screenQuadRunProgram, first.run);
  assert.equal(r.charQuadProgram, first.cq);
  assert.equal(r.particleProgram, first.p);
  assert.equal(r.overlayProgram, first.ov);
});

test('PERF-WARM: an unwarmed renderer still builds on the draw, and a warmed one does not build again', () => {
  // the draw path is what it always was for anyone who never warms
  const cold = countingRenderer({});
  cold.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  // a REAL quad: drawScreenQuad's signature is (tex, dst, src, color, opts)
  // and a pin that feeds it numbers is only passing because the stub
  // swallows them - `src.u0`, `color[0]` and `opts.blend` would all be
  // undefined, which is not the call the draw path actually gets.
  const QUAD = [{ x: 4, y: 8, w: 32, h: 16 }, { u0: 0, v0: 0, u1: 1, v1: 1 }, [1, 1, 1, 1], {}];
  cold.drawScreenQuad({ fake: true }, ...QUAD);
  assert.ok(cold.screenQuadProgram, 'the draw built it, exactly as before');

  // and a warmed one does not pay a second time on the frame
  const warm = countingRenderer({});
  warm._ensureScreenQuadProgram();
  const built = warm.screenQuadProgram;
  warm.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  warm.drawScreenQuad({ fake: true }, ...QUAD);
  assert.equal(warm.screenQuadProgram, built, 'the frame found it already there');
});

test('PERF-WARM: a step that throws is swallowed, and the steps after it still run', async () => {
  const ran = [];
  const done = await runWarm([
    () => ran.push('a'),
    () => { throw new Error('a driver that would not link'); },
    () => ran.push('c'),
  ]);
  assert.deepEqual(ran, ['a', 'c'], 'the throw did not stop the warm');
  assert.equal(done, 2, 'and it is not counted as done');
});

test('PERF-WARM: the warm stops when its host is gone, and never on a step it already passed', async () => {
  const ran = [];
  let alive = true;
  const done = await runWarm([
    () => { ran.push('a'); alive = false; },
    () => ran.push('b'),
  ], { alive: () => alive });
  assert.deepEqual(ran, ['a'], 'the second step was not run');
  assert.equal(done, 1);
});

test('PERF-WARM: the pixel-snow program is built with the renderer on the lane that can draw it', () => {
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return () => ({});
      if (k === 'createProgram' || k === 'createShader' || k === 'createBuffer'
        || k === 'createVertexArray' || k === 'createTexture') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const opts = { pixelSnow: { minParticleSize: 1, maxParticleSize: 4 } };   // no textureUrl: setPixelSnow takes the config and loads nothing
  // the enhanced lane can reach drawPixelSnow, so its program is the
  // constructor's - along with the lab's, which drawPixelSnow shares
  const on = new PrecipitationRenderer(gl, { ...opts, enhanced: true });
  assert.ok(on.pixelProgram, 'the enhanced lane compiled it up front');
  assert.ok(on.labProgram, 'and the lab it borrows its instances from');

  // the classic lane cannot: drawPixelSnow is only reachable through
  // drawLab. AUDIT 58's rule holds - it compiles neither.
  const off = new PrecipitationRenderer(gl, opts);
  assert.equal(off.pixelProgram, null, 'the classic lane compiled nothing it cannot bind');
  assert.equal(off.labProgram, null);
});

// ═══ PERF-2D - THE BRACKET THAT WAS PER QUAD ════════════════════════
// Every screen quad disabled DEPTH_TEST and CULL_FACE, bound its VAO,
// drew, then re-enabled both and unbound. Against a dungeon frame that
// is otherwise 3 batched level meshes and 25 loose models, that bracket
// alone was 43% of every GL call in the frame. It is a RUN's state, so
// it opens once and closes on demand.

/** The full effective state at every draw - the caps too, which is the
 *  new thing that can go wrong: a world draw with no depth test and no
 *  culling is the 2026-08-23 "sky-blue screen" wearing the other face. */
const effectiveWithCaps = (log) => {
  const CAPS = ['DEPTH_TEST', 'CULL_FACE', 'BLEND'];
  const on = new Map();          // enum -> bool
  const named = new Map();       // enum -> name, learned from the rig's own enums
  let unit = 0, prog = null, vao = null;
  const units = new Map(); const out = [];
  // glLogRig mints object ids with Math.random, so the raw value differs
  // between two runs of the same scene. Canonicalise by ORDER OF FIRST
  // APPEARANCE: same object still means same slot, which is the only
  // thing the comparison is about, and a different object still differs.
  const slot = new Map();
  const id = (t) => {
    if (t === null || t === undefined) return String(t);
    const raw = (t.id !== undefined) ? t.id : String(t);
    if (!slot.has(raw)) slot.set(raw, '#' + slot.size);
    return slot.get(raw);
  };
  return { rows: out, feed(r) {
    // glLogRig clears the log after construction, so the constructor's
    // own `enable(DEPTH_TEST)`/`enable(CULL_FACE)` are not in it. Seed
    // the baseline they establish, or every draw reads as caps-off and
    // the comparison below compares two piles of zeroes.
    on.set(r.gl.DEPTH_TEST, true); on.set(r.gl.CULL_FACE, true); on.set(r.gl.BLEND, false);
    for (const c of CAPS) named.set(r.gl[c], c);
    for (const [k, ...a] of log) {
      if (k === 'enable') on.set(a[0], true);
      else if (k === 'disable') on.set(a[0], false);
      else if (k === 'activeTexture') unit = a[0];
      else if (k === 'bindTexture') units.set(unit, a[1]);
      else if (k === 'useProgram') prog = a[0];
      else if (k === 'bindVertexArray') vao = a[0];
      else if (k.startsWith('draw')) out.push([
        k, id(prog), id(vao), id(units.get(0)), id(units.get(1)),
        CAPS.map((c) => c + '=' + (on.get(r.gl[c]) ? 1 : 0)).join(' '),
        a.slice(1).map(String).join(','),
      ].join('|'));
    }
    return out;
  } };
};

/** The scene the proof runs on: UI runs interleaved with every 3D pass
 *  the renderer has, because the transition OUT of an open run is the
 *  only thing this change can break. `eager` closes the run after every
 *  quad, which is exactly the per-quad bracket that stood before. */
const mixedScene = (r, { eager = false } = {}) => {
  const m = identity();
  // drawMesh SKIPS a sub-mesh whose texture is not in the cache, so
  // without this the meshes below draw nothing and the whole proof is
  // a row of quads. (The non-vacuity assertions at the end exist
  // because this is exactly the way such a scene goes quietly hollow.)
  for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) r.textures.set(`${a}_${b}`, { id: `t${a}_${b}` });
  const mesh = (n, tag) => ({ vao: { id: 'vao_' + tag }, subMeshes: Array.from({ length: n }, (_, i) => ({ textureArchive: i % 7, textureRecord: (i * 3) % 7, primitiveCount: 40, startIndex: i * 40 })) });
  const q = (i) => {
    r.drawScreenQuad(i % 7 === 0 ? null : { id: i % 3 ? 'A' : 'B' },
      { x: i * 3, y: 4 + (i % 40), w: 8, h: 8 }, { u0: 0, v0: 0, u1: 1, v1: 1 },
      i % 11 ? [1, 1, 1, 1] : [1, 0.2, 0.2, 1], i % 17 ? {} : { blend: true });
    if (eager) r._close2D();
  };
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  r.drawMesh(mesh(7, 'lvl'), m);
  r.markForeignPass();
  r.drawMesh(mesh(3, 'b'), m);
  for (let i = 0; i < 20; i++) q(i);
  r.drawMesh(mesh(4, 'after2d'), m);          // 3D straight out of an open run
  for (let i = 20; i < 30; i++) q(i);
  r.drawCharacterSpriteQuad({ id: 'sprite' }, [1, 2, 3], 0.5, 1, [1, 0, 0], 1, 1);
  for (let i = 30; i < 40; i++) q(i);
  r.endUiRun(); r.markForeignPass();          // a foreign seam out of an open run, the way a host would take it
  for (let i = 40; i < 50; i++) q(i);
  r.drawScreenQuadRun({ id: 'font' }, [{ dst: { x: 1, y: 2, w: 3, h: 4 }, src: { u0: 0, v0: 0, u1: 1, v1: 1 } }], [1, 1, 1, 1]);
  for (let i = 50; i < 60; i++) q(i);
  r.drawScreenOverlayQuad({ id: 'ovl' }, 1, 1);   // a third VAO inside one run
  for (let i = 60; i < 70; i++) q(i);
  r.drawMesh(mesh(2, 'tail'), m);
  for (let i = 70; i < 80; i++) q(i);
};

test('PERF-2D: the run opens once and closes on demand - the per-quad bracket is gone', () => {
  const { r, log } = glLogRig();
  const from0 = 0;
  mixedScene(r);
  const slice = log.slice(from0);
  const caps = slice.filter(([k, a]) => (k === 'enable' || k === 'disable') && (a === r.gl.DEPTH_TEST || a === r.gl.CULL_FACE)).length;
  const quads = slice.filter(([k]) => k === 'drawElements' || k === 'drawElementsInstanced' || k === 'drawArrays').length;
  assert.ok(quads > 80, `the scene really drew (${quads})`);
  // Four transitions out of an open run (a mesh, a sprite quad, a
  // foreign mark, a mesh) plus the opens: nowhere near one a quad.
  assert.ok(caps <= 30, `the cap bracket ran ${caps} times for ${quads} draws - it is a run's, not a quad's`);
  // and the same for the VAO: the three 2D primitives share the run
  const vaoBinds = slice.filter(([k]) => k === 'bindVertexArray').length;
  assert.ok(vaoBinds <= 40, `${vaoBinds} VAO binds for ${quads} draws`);
});

test('PERF-2D: every draw sees exactly the state it saw when the bracket was per quad', () => {
  const { r: rRun, log: logRun } = glLogRig();
  mixedScene(rRun);
  const run = effectiveWithCaps(logRun).feed(rRun);

  const { r: rEager, log: logEager } = glLogRig();
  mixedScene(rEager, { eager: true });          // the bracket, closed after every quad, as it stood
  const eager = effectiveWithCaps(logEager).feed(rEager);

  assert.equal(run.length, eager.length, 'the same draws happened');
  assert.deepEqual(run, eager, 'the deferred restore changed what a draw sees');
  // and the claim is not vacuous: the caps really are off at a quad and
  // on at a mesh, so the comparison above has something to compare
  assert.ok(run.some((d) => d.includes('DEPTH_TEST=0 CULL_FACE=0')), 'quads draw with the caps off');
  assert.ok(run.some((d) => d.includes('DEPTH_TEST=1 CULL_FACE=1')), 'meshes draw with the caps on');
});

test('PERF-2D: the source law - every draw in renderer.js is a 2D primitive or closes the run first', () => {
  const src = readFileSync('src/render/renderer.js', 'utf8').split('\n');
  const TWO_D = new Set(['drawScreenQuad', 'drawScreenQuadRun', 'drawScreenOverlayQuad',
    '_ensureScreenQuadProgram', '_ensureScreenQuadRunProgram', '_ensureOverlayProgram']);
  let method = null; const seen = new Map();   // method -> {closed, drew}
  for (const line of src) {
    const m = /^  (_?[A-Za-z][A-Za-z0-9_]*)\(.*\)\s*\{\s*$/.exec(line);
    if (m) { method = m[1]; seen.set(method, { closed: false, drew: false }); continue; }
    if (!method) continue;
    const e = seen.get(method);
    if (line.includes('this._close2D()')) e.closed = true;
    if (/gl\.draw(Arrays|Elements)/.test(line) && !e.drew) e.drew = !e.closed;   // drew BEFORE any close
  }
  const offenders = [...seen].filter(([name, e]) => e.drew && !TWO_D.has(name)).map(([n]) => n);
  assert.deepEqual(offenders, [], `these draw before handing the baseline back: ${offenders.join(', ')}`);
  // and the seams where FOREIGN gl runs close it too - the hosts call
  // these, and a sky or a rain pass assumes the baseline
  for (const seam of ['beginFrame', 'endWorldPass', 'markForeignPass', 'beginPanelFrame', 'endPanelFrame']) {
    assert.ok(seen.get(seam)?.closed, `${seam} does not close the 2D run, and foreign GL runs after it`);
  }
});

test('PERF-2D: _compositeAir closes AFTER its early return, or the saving is handed straight back', () => {
  const src = readFileSync('src/render/renderer.js', 'utf8');
  const i = src.indexOf('_compositeAir() {');
  const body = src.slice(i, i + 700);
  const ret = body.indexOf("if (!this._air?.pending) return;");
  const close = body.indexOf('this._close2D();');
  assert.ok(ret > 0 && close > ret,
    'drawScreenQuad calls _compositeAir at the head of EVERY quad - a close before its early return is the per-quad bracket again');
});

test('PERF-2D: a foreign pass inside an open run is the one gap, and it SPEAKS', () => {
  // The sky, the rain, the wisps and the grass are not in renderer.js -
  // the hosts hold `renderer.gl` and call them directly, so no guard in
  // that file can stand in front of them, and they assume the baseline.
  // Today they cannot collide (every foreign pass runs in the world
  // section and the first screen quad is what ENDS it), but that is the
  // hosts' order and not a law, and both regressions this bracket has
  // already caused were silent ones.
  const { r } = glLogRig();
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const said = [];
  const warn = console.warn;
  console.warn = (...a) => said.push(a.join(' '));
  try {
    r.markForeignPass();                    // no run open: nothing to say
    assert.deepEqual(said, [], 'a foreign pass outside a run is ordinary and silent');
    r.drawScreenQuad({ id: 'A' }, { x: 0, y: 0, w: 8, h: 8 });
    r.markForeignPass();                    // a run WAS open: that is the bug
    assert.equal(said.length, 1, 'a foreign pass inside an open run says so');
    assert.match(said[0], /DEPTH_TEST and CULL_FACE off/);
    assert.match(said[0], /endUiRun/, 'and names the remedy rather than just the fault');
    r.drawScreenQuad({ id: 'A' }, { x: 0, y: 0, w: 8, h: 8 });
    r.markForeignPass();
    assert.equal(said.length, 1, 'once a session, not once a frame - a warning in a frame loop is a second bug');
  } finally { console.warn = warn; }
  // and the remedy really is one: it closes the run, so the next mark is quiet
  const { r: r2 } = glLogRig();
  r2.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const said2 = [];
  console.warn = (...a) => said2.push(a.join(' '));
  try {
    r2.drawScreenQuad({ id: 'A' }, { x: 0, y: 0, w: 8, h: 8 });
    r2.endUiRun();
    r2.markForeignPass();
    assert.deepEqual(said2, [], 'endUiRun closes the run, so the foreign pass is ordinary again');
  } finally { console.warn = warn; }
});

// ═══ PERF-TEX3 - THE UNIT THAT WAS ALREADY ACTIVE ══════════════════
// Measured over a frame of 25 loose models, 3 batched meshes, 20 terrain
// pixels and a hundred-odd HUD quads: 97% of every activeTexture call
// selected the unit already selected (117 of 121), and 55% of every
// bindTexture re-bound the texture already on the unit (111 of 202).

test('PERF-TEX3: the selector funnel - exactly one raw gl.activeTexture survives', () => {
  const src = readFileSync('src/render/renderer.js', 'utf8');
  // The same law EV6 wrote for useProgram and bindVertexArray, for the
  // same reason: a shadow that one raw call can walk past is a shadow
  // that will one day speak for a unit it does not own.
  assert.equal((src.match(/gl\.activeTexture\(/g) || []).length, 1,
    'only _activeTexture may touch activeTexture');
  const body = src.split('_activeTexture(unit) {')[1].split('\n  }')[0];
  assert.match(body, /if \(this\._activeUnit === unit\) return;/, 'it is a shadow, not a wrapper');
  // and it is cleared wherever unit 1's shadow is - the two go together,
  // which AUDIT-AIR1 made literal: one helper clears the pair and every
  // seam calls it. The path sites (a draw that OWNS unit 0 for its own
  // bind) still clear `_tex0Bound` alone, and there are many.
  const clears = (src.match(/this\._tex0Bound = null/g) || []).length;
  assert.ok(clears >= 5, `unit 0's shadow is cleared at only ${clears} sites - _tex1Bound's every site is the floor`);
  for (const site of ['beginFrame', 'endWorldPass', 'markForeignPass']) {
    const fn = src.split(`  ${site}(`)[1]?.split('\n  }')[0] ?? '';
    assert.match(fn, /this\._forgetTextureShadows\(\);/, `${site} does not forget the unit-0 shadow`);
  }
  const home = src.split('_forgetTextureShadows() {')[1].split('\n  }')[0];
  assert.match(home, /this\._tex0Bound = null; this\._activeUnit = null;/, 'the one home clears unit 0 AND the selector');
});

test('PERF-TEX3: the shadows skip what is already there, and a real change still binds', () => {
  const { r, log } = glLogRig();
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const A = { id: 'sheet' }, B = { id: 'panel' };
  const from = log.length;
  for (let i = 0; i < 10; i++) r.drawScreenQuad(A, { x: i, y: 0, w: 8, h: 8 });
  let slice = log.slice(from);
  assert.equal(slice.filter(([k]) => k === 'bindTexture').length, 1, 'ten quads off one sheet bind it once');
  assert.equal(slice.filter(([k]) => k === 'activeTexture').length, 0, 'and re-select nothing - unit 0 was already active');
  assert.equal(slice.filter(([k]) => k === 'drawElements').length, 10, 'all ten still drew');

  // a real change still binds - the shadow is not a hoist
  const from2 = log.length;
  r.drawScreenQuad(B, { x: 0, y: 0, w: 8, h: 8 });
  r.drawScreenQuad(A, { x: 0, y: 0, w: 8, h: 8 });
  slice = log.slice(from2);
  assert.equal(slice.filter(([k]) => k === 'bindTexture').length, 2, 'two different sheets, two binds');

  // and a foreign pass takes the shadow's word away
  const from3 = log.length;
  r.markForeignPass();
  r.drawScreenQuad(A, { x: 0, y: 0, w: 8, h: 8 });
  assert.equal(log.slice(from3).filter(([k]) => k === 'bindTexture').length, 1,
    'a foreign pass owns the units; the next quad re-binds rather than trusting a stale shadow');
});

test('PERF-TEX3: a mesh bundle whose sub-meshes repeat an archive binds each texture once', () => {
  const { r, log } = glLogRig();
  r.textures.set('4_4', { id: 'tA' });
  r.textures.set('5_5', { id: 'tB' });
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const sub = (a, b) => ({ textureArchive: a, textureRecord: b, primitiveCount: 4, startIndex: 0 });
  const from = log.length;
  // A A A B B A - the shape a real bundle has, and the reason the naive
  // loop re-bound: consecutive repeats, not a sorted run
  r.drawMesh({ vao: { id: 'v' }, subMeshes: [sub(4, 4), sub(4, 4), sub(4, 4), sub(5, 5), sub(5, 5), sub(4, 4)] }, identity());
  // count binds on UNIT 0 only - _bindEmission's unit-1 traffic is
  // PERF-TEX's business and would make this read 5 for the wrong reason
  let unit = r.gl.TEXTURE0, binds = 0;
  for (const [k, ...a] of log.slice(from)) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture' && a[0] === r.gl.TEXTURE_2D && unit === r.gl.TEXTURE0) binds++;
  }
  assert.equal(log.slice(from).filter(([k]) => k === 'drawElements').length, 6, 'all six sub-meshes drew');
  assert.equal(binds, 3, `six sub-meshes over two textures bound ${binds} times - one a RUN, not one a sub-mesh`);
});

test('PERF-TEX3 AUDIT: no site binds TEXTURE_2D to unit 0 outside the helper without clearing the shadow', () => {
  // PERF-TEX wrote exactly this law for unit 1 and it is why that slice
  // never shipped a wrong texture. Writing its twin was skipped when the
  // unit-0 shadow went in, and the audit found what that cost: a model
  // drawn after a CHARACTER came out untextured, because drawCharacter
  // binds unit 0 raw, ends on `bindTexture(TEXTURE_2D, null)`, and the
  // shadow went on claiming the texture it had before.
  const src = readFileSync('src/render/renderer.js', 'utf8');
  const lines = src.split('\n');
  let unit = 'TEXTURE0', method = null;
  const offenders = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^  (_?[A-Za-z][A-Za-z0-9_]*)\(.*\)\s*\{\s*$/.exec(lines[i]);
    if (m) { method = m[1]; unit = 'TEXTURE0'; }       // unit 0 is the baseline every method opens on
    const am = /_activeTexture\(gl\.(TEXTURE\d+|TEXTURE0 \+ \w+)\)/.exec(lines[i]);
    if (am) unit = am[1];
    if (!/gl\.bindTexture\(gl\.TEXTURE_2D,/.test(lines[i])) continue;
    if (unit !== 'TEXTURE0' || method === '_bindTex0') continue;
    const window = lines.slice(i, i + 4).join('\n');
    if (!/_tex0Bound|_bindTex0/.test(window)) offenders.push(`renderer.js:${i + 1} (${method})`);
  }
  assert.deepEqual(offenders, [], `these bind unit 0 without answering to the shadow: ${offenders.join(', ')}`);
});

test('PERF-TEX3 AUDIT: a model drawn after a character still has its texture', () => {
  // The repro, kept: drawCharacter owns unit 0 while it runs and hands it
  // back EMPTY. A mesh either side of it shares the shadow, so a shadow
  // that survived the character would skip the bind and draw nothing.
  const { r, log } = glLogRig();
  r.textures.set('4_4', { id: 'MESH_TEX' });
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const bundle = { vao: { id: 'v' }, subMeshes: [{ textureArchive: 4, textureRecord: 4, primitiveCount: 4, startIndex: 0 }] };
  r.drawMesh(bundle, identity());
  r.drawCharacter({ vao: { id: 'cv' }, ranges: [{ start: 0, count: 3, tex: { id: 'CHAR_TEX' } }] }, identity());
  r.drawMesh(bundle, identity());

  let unit = r.gl.TEXTURE0; const on = new Map(); const sawAt = [];
  for (const [k, ...a] of log) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture') on.set(unit + '/' + a[0], a[1]);
    else if (k === 'drawElements') sawAt.push(on.get(r.gl.TEXTURE0 + '/' + r.gl.TEXTURE_2D));
  }
  assert.ok(sawAt.length >= 2, 'both meshes drew');
  assert.equal(sawAt[sawAt.length - 1]?.id, 'MESH_TEX',
    'the model after the character drew with ' + JSON.stringify(sawAt[sawAt.length - 1]) + ' on unit 0');
});

// ── AUDIT-AIR1: THE RESOLVE IS A FOREIGN PASS ──────────────────────
//
// Mac, 2026-09-19: "the screenshot shows a bug where sometimes
// unsheathing, it spawns a weird water texture".
//
// It was not water. `airPass.composite()` binds units 0..3 and leaves
// its own unit selected; `_compositeAir` forgot the PROGRAM and VAO
// shadows after it and not the TEXTURE ones - the only one of six
// seams that did not. So the first screen quad after a resolve found
// `_activeUnit` still claiming TEXTURE0 and `_tex0Bound` still naming
// the sprite it wanted: it skipped the bind, or bound to unit 3, and
// sampled the RESOLVED FRAME BUFFER. On an unsheathe that is the
// weapon sprite painted with a blurred picture of the room.
//
// Pinned by REPLAY, not by grep: the real Renderer over the logging
// stub, with an air pass that binds what the real one binds, and the
// question asked of the GL state machine - what is on unit 0, and
// which unit is selected, at the draw.
const airRig = () => {
  const { r, log } = glLogRig();
  const FRAME = { id: 'airResolvedFrame' };
  r._air = {
    pending: true,
    setCloudShadow() {}, beginFrameTarget: () => null,
    composite() {
      const gl = r.gl;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FRAME);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, { id: 'bloom' });
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, { id: 'shaft' });
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, { id: 'ao' });
    },
  };
  return { r, log, FRAME };
};
/** Unit 0's texture and the selected unit as the GPU would have them at
 *  the first draw in `log`. */
const atFirstDraw = (log, TEXTURE0) => {
  let unit = null; const units = new Map();
  for (const [k, ...a] of log) {
    if (k === 'activeTexture') unit = a[0];
    else if (k === 'bindTexture') units.set(unit, a[1]);
    else if (typeof k === 'string' && k.startsWith('draw')) return { tex0: units.get(TEXTURE0) ?? null, unit };
  }
  return null;
};

test('AUDIT-AIR1: the first screen quad after the air resolve draws its OWN texture, on unit 0', () => {
  const { r, log, FRAME } = airRig();
  const WEAPON = { id: 'weaponSprite' };
  // the frame drew this sprite already, so the shadow honestly held it -
  // and then the resolve happened underneath it
  r._tex0Bound = WEAPON; r._activeUnit = r.gl.TEXTURE0;
  log.length = 0;
  r.drawScreenQuad(WEAPON, { x: 0, y: 0, w: 100, h: 100 });
  const seen = atFirstDraw(log, r.gl.TEXTURE0);
  assert.ok(seen, 'the quad drew');
  assert.equal(seen.tex0, WEAPON, 'unit 0 holds the sprite, NOT the air pass’s resolved frame');
  assert.notEqual(seen.tex0, FRAME, 'the "weird water texture" is the resolved frame buffer');
  assert.equal(seen.unit, r.gl.TEXTURE0, 'and the selected unit is 0, not whatever the resolve left');
});

test('AUDIT-AIR1: the resolve forgets every texture shadow, exactly as a foreign pass does', () => {
  const { r } = airRig();
  r._tex0Bound = { id: 'x' }; r._tex1Bound = { id: 'y' }; r._activeUnit = r.gl.TEXTURE3;
  r._tArrayTex = { id: 'arr' }; r._tTileSize = 64; r._sq = { r: 1 };
  r.resolveFrame();
  for (const k of ['_tex0Bound', '_tex1Bound', '_activeUnit', '_tArrayTex', '_tTileSize']) {
    assert.equal(r[k], null, `${k} may not speak for a unit the resolve took`);
  }
  assert.deepEqual(r._sq, {}, 'and the screen quad knows none of its uniforms');
});

test('AUDIT-AIR1: the shadow reset is ONE HOME - six copies of a rule is five chances to miss one', () => {
  // The bug WAS the sixth copy that never got written. A source pin, so
  // a seventh seam cannot be added with its own hand-copied block.
  const src = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  assert.match(src, /_forgetTextureShadows\(\) \{\s*\n\s*this\._tex1Bound = null;\s*\n\s*this\._tex0Bound = null; this\._activeUnit = null;\s*\n\s*this\._sq = \{\};\s*\n\s*this\._tArrayTex = null;\s*\n\s*this\._tTileSize = null;\s*\n\s*\}/,
    'the one home exists and clears all six');
  // nobody clears them by hand any more
  const decl = src.indexOf('_forgetTextureShadows() {');
  const after = src.slice(src.indexOf('\n  }', decl));
  assert.doesNotMatch(after, /this\._tex0Bound = null; this\._activeUnit = null;/,
    'no site outside the helper clears the pair by hand');
  // and every seam that can lose the units calls it
  // RETRO1: an eighth - the retro present binds units 0..2, a program and a VAO of its own (render/retroPass.js), and
  // it runs as the classic lane's resolve as well as after the air's, so it forgets for itself
  assert.equal((src.match(/this\._forgetTextureShadows\(\);/g) || []).length, 8,
    'the constructor, endWorldPass, _installWorldSet, markForeignPass, beginFrame, uploadEmissionTexture, the air resolve and the retro present');
  // the air resolve's call sits AFTER the composite, because the
  // composite is what invalidates them
  const air = src.slice(src.indexOf('_compositeAir() {'));
  // (the comment between them carries the reason - VC6c/VC6d pin
  // `setCloudShadow` and `composite` as adjacent, so it cannot go above)
  assert.match(air.slice(0, air.indexOf('\n  }')), /this\._air\.composite\(\);[\s\S]{0,900}?this\._forgetTextureShadows\(\);/,
    'the forget follows the composite - the composite is what invalidates them');
  assert.doesNotMatch(air.slice(0, air.indexOf('this._air.composite();')), /_forgetTextureShadows/,
    '...and never precedes it, which would forget shadows the resolve then invalidates again');
});
