// AUDIT 39 - THE RENDER CLUSTER (F47-F56). Nine laws the renderer, the
// enhanced sky and the overworld pass either applied twice, applied in
// the wrong space, never ported at all, or measured with a counter that
// could not see them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { identity } from '../src/world/mat4.js';
import { Renderer } from '../src/render/renderer.js';
import { hash21, RETRO, sunOcclusion, skyState } from '../src/render/enhancedSky.js';
import { isEmissive, isEmissiveArchive, FIRE_WALLS_ARCHIVE } from '../src/world/emissiveTextures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

// A recording GL stub in the glstate/renderalloc Proxy precedent: every
// entry point answers, and the calls this cluster is about are logged.
function stubRenderer() {
  const log = { uniform1i: [], uniform3fv: [], draws: 0 };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'uniform1i') return (loc, v) => log.uniform1i.push([loc, v]);
      if (k === 'uniform3fv') return (loc, v) => log.uniform3fv.push([loc, [...v]]);
      if (k === 'drawArrays' || k === 'drawElements') return () => { log.draws++; };
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      return () => {};
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { r: new Renderer(canvas), log };
}

const lastUniform1i = (log, loc) => {
  for (let i = log.uniform1i.length - 1; i >= 0; i--) if (log.uniform1i[i][0] === loc) return log.uniform1i[i][1];
  return undefined;
};

// ---------------------------------------------------------------
// F47/F48: the sprite RT's fog.
// ---------------------------------------------------------------
test('audit39 F47/F48: the offscreen sprite render is drawn with the fog BORROWED OFF, and gets it back', () => {
  const { r, log } = stubRenderer();
  r.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  const mesh = { vao: {}, count: 3 };
  log.uniform1i.length = 0;
  r.renderCharacterSprite(mesh, identity(), identity(), identity(), 8, 8);
  // The RT draw ran with mode 0: the composite quad owns the world fog,
  // so fogging inside too darkened a character as f^2 against the wall
  // behind it, and the origin-space callers (the FP viewmodel, the
  // inventory figure, the item icons) were fogged by the player's
  // absolute distance from the world origin - _camPos is the WORLD
  // camera and this pass takes a private one.
  assert.equal(lastUniform1i(log, r._charFog.fogMode), 0, 'no fog inside the sprite target');
  assert.equal(r._fogMode, 2, 'and the scene fog is returned');
  // The composite quad still fogs - it is the one application.
  r.drawCharacterSpriteQuad({}, [0, 0, 0], 1, 1, [1, 0, 0]);
  assert.equal(lastUniform1i(log, r._charQuad.fogMode), 2, 'the quad carries the fog');
});

test('audit39 F47/F48: the borrow is stated in the pass, beside the clear-colour one', () => {
  const s = src('src/render/renderer.js');
  const fn = s.slice(s.indexOf('renderCharacterSprite(mesh'), s.indexOf('renderCharacterSpriteImage(mesh'));
  assert.match(fn, /const sp = this\._proj, sv = this\._view, sf = this\._fogMode;/);
  assert.match(fn, /this\._proj = proj; this\._view = view; this\._fogMode = 0;/);
  assert.match(fn, /this\._proj = sp; this\._view = sv; this\._fogMode = sf;/, 'returned after the draw');
});

// ---------------------------------------------------------------
// F49: TextureReader's auto-emissive table (TextureReader.cs:809-1023,
// IsEmissive :1047), the material law on top of it
// (MaterialReader.cs:419-423, :448-453) and the port's upload arm.
// ---------------------------------------------------------------
test('audit39 F49: the emissive table is TextureReader.emissiveTextures, verbatim - inclusions AND exclusions', () => {
  // The archives DFU self-illuminates.
  for (const a of [87, 101, 190, 200, 202, 208, 210, 253, 273, 278, 280, 281, 290, 356, 375, 376, 377, 378, 379, 380, 400, 405, 434, 473]) {
    assert.ok(isEmissiveArchive(a), `archive ${a} carries emissive records`);
  }
  assert.equal(isEmissiveArchive(9), false, 'a plain building archive does not');
  // Archive 210 - the lit-lantern archive the port's own AddLight
  // milestones scan - carries 27 records with three gaps.
  assert.ok(isEmissive(210, 0) && isEmissive(210, 6) && isEmissive(210, 29));
  for (const gap of [7, 10, 12, 30]) assert.equal(isEmissive(210, gap), false, `210/${gap} is not in the C# list`);
  // The C#'s COMMENTED-OUT entries stay out: the glass globe and the UI
  // records of the magic decorative effects.
  assert.equal(isEmissive(101, 10), false, 'the glass globe is commented out ("is glass globe a light source?")');
  assert.equal(isEmissive(380, 5), false, 'UI');
  assert.equal(isEmissive(434, 5), false, 'UI');
  assert.ok(isEmissive(380, 3) && isEmissive(434, 3));
  assert.ok(isEmissive(87, 0) && isEmissive(208, 2) && isEmissive(202, 2) && isEmissive(473, 14));
  assert.ok(isEmissive(400, 2) && isEmissive(400, 3) && isEmissive(405, 2), 'the daedra corpses ride their archives');
  assert.equal(FIRE_WALLS_ARCHIVE, 356);
  // The whole table, counted: 182 active entries in the C#.
  let total = 0;
  for (let a = 0; a < 600; a++) for (let r = 0; r < 120; r++) if (isEmissive(a, r)) total++;
  assert.equal(total, 182, 'every active TextureReader.cs:809-1023 entry, and only those');
});

test('audit39 F49: the upload arm reuses the ALBEDO, after the window arm, and skips the fire walls', () => {
  const s = src('src/scenes/dataPipeline.js');
  // TextureReader.cs:301-308 "Just reuse albedo map for basic colour
  // emission" - the same colour32 that went up as the albedo.
  assert.match(s, /} else if \(isEmissive\(archive, record\) && archive !== FIRE_WALLS_ARCHIVE\) \{/,
    'the `else` is the C#\'s own `&& !isWindow`');
  assert.match(s, /renderer\.uploadEmissionTexture\(archive, record, color32, \{ white: true \}\);/);
  // An animated flat is uploaded frame by frame and the billboard path
  // looks the mask up under that same composite key, so a torch's every
  // frame needs one.
  assert.match(s, /renderer\.uploadEmissionTexture\(archive, key, color32, \{ white: true \}\);/);
});

test('audit39 F49: an auto-emissive mask wears Color.white, a window mask wears the window style', () => {
  const { r, log } = stubRenderer();
  const px = { width: 1, height: 1, colors: new Uint8Array([255, 255, 255, 255]) };
  r.setWindowEmission(new Float32Array([0.3, 0.2, 0.1]));
  r.uploadTexture(210, 0, px);
  r.uploadEmissionTexture(210, 0, px, { white: true });
  r.uploadTexture(36, 2, px);
  r.uploadEmissionTexture(36, 2, px);            // the window arm passes no flag
  assert.ok(r.emissionWhite.has('210_0') && !r.emissionWhite.has('36_2'));
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  const lit = { vao: {}, subMeshes: [{ textureArchive: 210, textureRecord: 0, primitiveCount: 1, startIndex: 0 }] };
  const win = { vao: {}, subMeshes: [{ textureArchive: 36, textureRecord: 2, primitiveCount: 1, startIndex: 0 }] };
  const emisAt = (i) => log.uniform3fv.filter(([loc]) => loc === r.uEmissionColor)[i];
  const before = log.uniform3fv.filter(([loc]) => loc === r.uEmissionColor).length;
  r.drawMesh(lit, identity());
  assert.deepEqual(emisAt(before)[1], [1, 1, 1], 'MaterialReader.cs:448-453: EmissionColor = Color.white');
  r.drawMesh(win, identity());
  assert.deepEqual(emisAt(before + 1)[1], [...new Float32Array([0.3, 0.2, 0.1])], 'and the window keeps its style');
});

// The one shader in the file whose name is asked for, body only.
const shaderBody = (s, name) => {
  const m = new RegExp('const ' + name + ' = `([^`]*)`;').exec(s);
  assert.ok(m, `${name} still lives in renderer.js as one template`);
  return m[1];
};

test('audit39r R17: emission CANCELS the lighting it replaces, it does not ride on top of it', () => {
  // DaggerfallBillboard.shader:56-58 and DaggerfallDefault.shader:83-85 are
  // the same two lines: `o.Albedo = albedo.rgb - emission; // Emission
  // cancels out other lights` then `o.Emission = emission;`. An
  // auto-emissive record's mask IS its albedo (TextureReader.cs:301-308) and
  // wears Color.white (MaterialReader.cs:448-453), so the flat lands at
  // exactly its albedo in ANY light. F49 shipped the mask and the upload but
  // kept an ADD, which outdoors (uTint = 0.9 ambient + 0.816 sun * 0.5 at
  // noon) drew every missile, impact flash and fire daedra at ~2.3x albedo.
  const s = src('src/render/renderer.js');
  for (const name of ['FS', 'BB_FS']) {
    const body = shaderBody(s, name);
    assert.match(body, /vec3 albedo = max\(tex\.rgb - emission, vec3\(0\.0\)\);/,
      `${name} lights albedo - emission`);
    assert.ok(!/tex\.rgb \*/.test(body) && !/\* tex\.rgb/.test(body),
      `${name}: no light term multiplies the RAW albedo any more`);
    assert.match(body, /\+ emission/, `${name} adds the emission back - o.Emission = emission`);
  }
  // and the law, arithmetically: a white-masked flat at the noon tint.
  const tint = 0.9 + 0.816 * 0.5;   // EXTERIOR_NOON_AMBIENT + SUN_RIG_COLOR * 0.5
  const texel = 0.8;
  assert.equal(Math.max(texel - texel, 0) * tint + texel, texel, 'the lit flat sits at its albedo');
});

// ---------------------------------------------------------------
// F50: renderer.stats counted drawMesh alone.
// ---------------------------------------------------------------
test('audit39 F50: every draw in the file reports, not drawMesh alone', () => {
  const s = src('src/render/renderer.js');
  const drawCalls = (s.match(/gl\.draw(Elements|Arrays)\(/g) || []).length;
  const counted = (s.match(/this\.stats\.draws\+\+/g) || []).length;
  assert.equal(counted, drawCalls,
    `${drawCalls} gl.draw* sites, ${counted} counted - a draw the counter cannot see makes the terrain culling EV3 measures invisible`);
});

test('audit39 F50: a frame that mixes passes counts all of them', () => {
  const { r } = stubRenderer();
  r.textures.set('7_3', {});
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  assert.equal(r.stats.draws, 0, 'the counters reset with the frame');
  r.drawMesh({ vao: {}, subMeshes: [{ textureArchive: 7, textureRecord: 3, primitiveCount: 1, startIndex: 0 }] }, identity());
  const afterMesh = r.stats.draws, binds = r.stats.texBinds;
  assert.equal(afterMesh, 1);
  r.drawWater([{ x: 0, z: 0, size: 1, y: 0 }], [0, 0, 1, 0.5], {}, 0);
  assert.equal(r.stats.draws, afterMesh + 1, 'the water plane counts');
  r.drawBillboards([{ archive: 7, record: 3, vao: {}, indexCount: 6, size: { w: 1, h: 1 } }], [1, 0, 0], [0, 1, 0]);
  assert.equal(r.stats.draws, afterMesh + 2, 'and the billboard batch');
  assert.ok(r.stats.texBinds > binds, 'their texture binds land too');
});

// ---------------------------------------------------------------
// F51: the EV2 generation covers deletes as well as uploads.
// ---------------------------------------------------------------
test('audit39 F51: releaseTexture bumps the generation, so a stamped sub-mesh cannot bind a deleted texture', () => {
  const { r } = stubRenderer();
  const px = { width: 1, height: 1, colors: new Uint8Array([1, 2, 3, 4]) };
  r.uploadTexture('img', 'logo', px);
  const gen = r._texGen;
  assert.equal(r.releaseTexture('img', 'logo'), true);
  assert.ok(r._texGen > gen, 'the delete invalidates the sub-mesh cache the upload validated');
  const stale = r._texGen;
  assert.equal(r.releaseTexture('img', 'logo'), false, 'a second release frees nothing');
  assert.equal(r._texGen, stale, '...and bumps nothing');
});

// ---------------------------------------------------------------
// F52: the sub-mesh cache misses once per streamed pixel per shared
// archetype - the meshes are global, the texRemap is per map pixel.
// ---------------------------------------------------------------
test('audit39 F52: a cache miss re-resolves but never re-mints the key', () => {
  const { r } = stubRenderer();
  r.textures.set('7_3', {});
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  const sm = { textureArchive: 7, textureRecord: 3, primitiveCount: 1, startIndex: 0 };
  const mesh = { vao: {}, subMeshes: [sm] };
  // Two map pixels, each with its OWN remap object over the SAME mesh
  // (dataPipeline's gpuMeshes are "shared across pixels, never
  // destroyed"), which is the miss the identity stamp cannot avoid.
  r.drawMesh(mesh, identity(), new Map());
  const key = sm._evKey;
  assert.equal(key, '7_3');
  r.drawMesh(mesh, identity(), new Map());
  assert.equal(sm._evKey, key, 'the same string object, not a fresh mint per pixel per frame');
  assert.match(src('src/render/renderer.js'),
    /const key = sm\._evKey \?\? \(sm\._evKey = `\$\{sm\.textureArchive\}_\$\{sm\.textureRecord\}`\);/);
});

// ---------------------------------------------------------------
// F53: the star field's intra-cell offset was fract() of an integer.
// ---------------------------------------------------------------
test('audit39 F53: the bright star layer draws - a zero intra-cell offset could not light one pixel', () => {
  // The shader's layer-0 arithmetic against the module's own hash, over
  // a face's cells: brightness is exp(-d*d*60) at d = |f - star| with
  // star uniform in [0.15, 0.85]^2, and the retro pass posterises at
  // 1/RETRO.levels, so anything below one level is never drawn.
  const level = 1 / RETRO.levels;
  const layer0 = (fx, fy) => {
    let max = 0, lit = 0;
    for (let face = 0; face < 6; face++) {
      for (let cx = -127; cx < 127; cx += 3) {
        for (let cy = -127; cy < 127; cy += 3) {
          const a = cx + face * 977, b = cy + face * 977;
          const h = hash21(a, b);
          if (h <= 0.955) continue;
          const sx = hash21(a + 1.1, b + 1.1) * 0.7 + 0.15;
          const sy = hash21(a + 2.2, b + 2.2) * 0.7 + 0.15;
          const d = Math.hypot(fx - sx, fy - sy);
          const v = (0.35 + 0.65 * (h - 0.955) / 0.045) * 1.4 * Math.exp(-d * d * 60);
          if (v > max) max = v;
          if (v > level) lit++;
        }
      }
    }
    return { max, lit };
  };
  // THE OLD LAW: cellOut was the floored cell id, so f = fract(g) was
  // exactly (0,0) at every fragment of layer 0 - d >= 0.212 always, and
  // the whole 1.4-weight layer stayed below one posterise level.
  const dead = layer0(0, 0);
  assert.equal(dead.lit, 0, 'a zero offset lights nothing');
  assert.ok(dead.max < level, `${dead.max.toFixed(4)} never reaches one posterise level (${level.toFixed(4)})`);
  // THE LAW NOW: f is where the fragment sits inside its cell, so a
  // fragment near the star is bright.
  for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.7]]) {
    const live = layer0(fx, fy);
    assert.ok(live.lit > 300, `f=(${fx},${fy}): ${live.lit} cells draw (a ninth of the face is sampled)`);
    assert.ok(live.max > 1, `and the layer reaches full brightness (${live.max.toFixed(3)})`);
  }
  // ...which is what the continuous cellOut buys. (The shader text is
  // pinned in enhancedSky.test.js, ES1f.)
  const fs = src('src/render/enhancedSky.js');
  assert.match(fs, /cellOut = uv \* n \+ face \* 977\.0;/);
  assert.match(fs, /vec2 cell = floor\(g\), f = fract\(g\);/, 'the field still reads the id and the interior off one value');
});

// ---------------------------------------------------------------
// F54: the CPU cloud twin omitted the shader's horizon attenuation.
// ---------------------------------------------------------------
test('audit39 F54: sunOcclusion applies the shader\'s horizon term, so the ground and the disc agree', () => {
  const fs = src('src/render/enhancedSky.js');
  // The shader line the twin now mirrors, and the mirror itself.
  assert.match(fs, /float near = smoothstep\(0\.28, 0\.0, dir\.y\);/);
  assert.match(fs, /cloud = mix\(cov, cov \* uCloudCover, near\);/);
  assert.match(fs, /const near = smoothstep\(0\.28, 0, d\[1\]\);/);
  assert.match(fs, /return cov \* \(1 - near\) \+ cov \* state\.cloudCover \* near;/);
  // A LOW sun is the case that moved: below ~16.3 degrees the shader
  // thins the cover before it hides the disc, and the key light must
  // thin with it or the ground darkens under a sun that is still out.
  const low = skyState({ minuteOfDay: 6 * 60 + 40, weather: 'overcast', seconds: 40 });
  assert.ok(low.sunDir[1] > 0 && low.sunDir[1] < 0.28, `${low.sunDir[1].toFixed(3)}: inside the horizon band`);
  const occ = sunOcclusion(low);
  assert.ok(occ > 0 && occ < 1, `${occ.toFixed(3)}: thinned, not absolute`);
  assert.ok(occ >= low.cloudCover - 1e-9, 'never below the shader\'s own floor of cov * cover');
  // High sun: near is 0 and nothing moved.
  const noon = skyState({ minuteOfDay: 12 * 60, weather: 'overcast', seconds: 40 });
  assert.ok(noon.sunDir[1] > 0.28);
  assert.ok(sunOcclusion(noon) > 0.95, 'a solid deck at noon still takes the sun');
  // Below the horizon there is no sun to occlude, horizon term or not.
  assert.equal(sunOcclusion(skyState({ minuteOfDay: 2 * 60, weather: 'overcast' })), 0);
});

// ---------------------------------------------------------------
// F56: the sky header named the wrong compass point for azimuth 0.
// ---------------------------------------------------------------
test('audit39 F56: the sky header names the axis the shader actually uses', () => {
  const s = src('src/render/skyRenderer.js');
  assert.match(s, /float azimuth = atan\(dir\.x, dir\.z\);/, 'atan(x, z) is 0 at +Z');
  assert.ok(!/azimuth 0 = \+X/.test(s) && !/Azimuth 0 \(\+X/.test(s),
    'the header no longer points a reader at map east for azimuth 0');
  assert.match(s, /Azimuth 0 \(\+Z, map north\) starts the east half/);
  assert.match(s, /CENTRED on map east at u = 0\.25/, 'which is what the half actually does');
});
