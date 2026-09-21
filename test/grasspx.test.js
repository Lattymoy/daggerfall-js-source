// GRASS-PX (2026-09-21, Mac: "with the grass model, is there a way we can
// turn the grass into a pixel art design ... Let's see how detailed you
// can be"): THE TUFT IS A SPRITE. The sheet is built from a seed and
// held byte for byte; the two compiled stages are the lab's text under
// a DECLARED list of edits, each landing exactly once; the renderer
// uploads the sheet with its coverage mip chain on its own unit and the
// style as one uniform; the host reads the row live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTuftSheet, buildTuftMips, downsampleCoverage, coverageOf, layTuft, paintTuft, toneAt, toneByte, isHighlightRow, mulberry32, pixelGrass,
  PX_VARIANTS, PX_TUFT_W, PX_TUFT_H, PX_TONES, PX_RAMP_STEPS, PX_STEP_HZ, PX_LEAN_STEPS, PX_TINT_BANDS, PX_BLADES_PER_TUFT } from '../src/render/grassPixelArt.js';
import { LAB_GRASS_HEAD, GAME_GRASS_FIELD, LAB_GRASS_VS, LAB_GRASS_FS, GAME_GRASS_VS, GAME_GRASS_FS, GRASSPX_VS_EDITS, GRASSPX_FS_EDITS, applyGrassEdits, LabGrassRenderer, GRASS_CELL } from '../src/render/labGrass.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TONE_BYTES = [0, 64, 128, 192, 255];
/** the shader's own decode of the tone byte */
const decode = (r) => Math.floor((r / 255) * 4 + 0.5);

test('GRASS-PX: the sheet is eight 16x32 tufts, hard-edged, four-toned, and the same on every build', () => {
  const a = buildTuftSheet(), b = buildTuftSheet();
  assert.equal(a.width, PX_VARIANTS * PX_TUFT_W); assert.equal(a.height, PX_TUFT_H); assert.equal(a.variants, 8);
  assert.deepEqual(a.data, b.data, 'a function of the seed and nothing else');
  let blade = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const [r, g, , al] = [a.data[i], a.data[i + 1], a.data[i + 2], a.data[i + 3]];
    assert.ok(al === 0 || al === 255, `alpha is 0 or 255, never ${al} - a pixel sprite has no soft edge`);
    assert.ok(TONE_BYTES.includes(r), `the tone byte is one of five, never ${r}`);
    assert.equal(r === 0, al === 0, 'a texel is a blade exactly when it has a tone');
    if (al) { blade++; assert.equal(decode(r), TONE_BYTES.indexOf(r), 'the shader\'s decode reads the tone back'); }
    if (al && r === 255) assert.ok(g >= 242, `the highlight is the top two texels of a tall blade, so its height is at least 19/20 (${g})`);
  }
  assert.ok(blade > 400 && blade < a.data.length / 4 * 0.6, `a sheet that is mostly air, with ${blade} blade texels`);
  const at = (v, x, y) => a.data[((y * a.width) + v * PX_TUFT_W + x) * 4 + 3];
  const seen = new Set();
  for (let v = 0; v < a.variants; v++) {
    let base = 0;
    for (let x = 0; x < PX_TUFT_W; x++) if (at(v, x, 0)) base++;   // GRASS AUDIT 1: the edge-column law is the loop below, over every row; the old clause here was `false !== 0` waiting for a 32-texel blade
    for (let y = 0; y < PX_TUFT_H; y++) { assert.equal(at(v, 0, y), 0); assert.equal(at(v, PX_TUFT_W - 1, y), 0); }
    assert.ok(base >= 3, `tuft ${v} stands on at least three base texels (${base})`);
    for (let x = 0; x < PX_TUFT_W; x++) if (at(v, x, 0)) assert.equal(a.data[((0 * a.width) + v * PX_TUFT_W + x) * 4 + 1], 0, 'a base texel is height 0');
    const key = Array.from({ length: PX_TUFT_H }, (_, y) => Array.from({ length: PX_TUFT_W }, (_, x) => at(v, x, y) ? 1 : 0).join('')).join('|');
    assert.ok(!seen.has(key), `tuft ${v} is its own shape`); seen.add(key);
  }
  assert.equal(PX_TONES, 4);
});

test('GRASS-PX: the tone law and its byte', () => {
  assert.deepEqual([0, 0.34, 0.35, 0.74, 0.75, 1].map((f) => toneAt(f, false, 32)), [1, 1, 2, 2, 3, 3], 'root, mid, tip by thirds of the stalk');
  assert.equal(toneAt(1, true, 20), 4, 'the tip of a blade tall enough to clear the sward is the highlight');
  assert.equal(toneAt(1, true, 19), 3, '...and a short blade\'s tip is plain tip');
  assert.deepEqual([0, 1, 2, 3, 4].map(toneByte), TONE_BYTES);
  for (let t = 0; t <= 4; t++) assert.equal(decode(toneByte(t)), t, `tone ${t} round-trips through the shader's floor(R*4+0.5)`);
});

test('GRASS-PX: a tuft\'s blades - three to five, never on the edge, the tip inside the tuft, the stalk\'s travel as height squared', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const blades = layTuft(mulberry32(seed));
    assert.ok(blades.length >= 3 && blades.length <= 5, `${blades.length} blades`);
    for (const bl of blades) {
      assert.ok(bl.x0 >= 3 && bl.x0 <= PX_TUFT_W - 4, `root column ${bl.x0}`);
      assert.ok(bl.height >= 8 && bl.height <= PX_TUFT_H, `height ${bl.height}`);
      const tip = bl.x0 + Math.round(bl.lean);
      assert.ok(tip >= 1 && tip <= PX_TUFT_W - 2, `the tip lands at column ${tip} of the tuft, inside it`);
      assert.ok(bl.ordinal >= 0 && bl.ordinal <= 1);
    }
    assert.equal(blades[0].ordinal, 0); assert.equal(blades[blades.length - 1].ordinal, 1);
  }
  // the seed is the sheet: two streams of the same seed lay the same tuft
  assert.deepEqual(layTuft(mulberry32(7)), layTuft(mulberry32(7)));
  assert.notDeepEqual(layTuft(mulberry32(7)), layTuft(mulberry32(8)));
});

test('GRASS-PX / GRASS AUDIT 1: the mip chain PRESERVES COVERAGE and carries the TIP - a far tuft is as dense as a near one, tip-toned, never nothing and never a wall', () => {
  // a 2x2 block with one blade texel and three of air averages to a
  // quarter and fails the alpha test; with a target of a quarter the
  // block is kept whole, tone and all
  const one = (data, targetFrac, variants = 1) => downsampleCoverage({ width: 2, height: 2, data: new Uint8Array(data) }, { targetFrac, variants });
  assert.deepEqual([...one([0, 0, 0, 0, 192, 255, 30, 255, 0, 0, 0, 0, 0, 0, 0, 0], 0.25).data], [192, 255, 30, 255], 'the block IS its one blade texel');
  // two blade texels: the block takes the HIGHER one (by height along the blade), a tip over a root
  assert.deepEqual([...one([0, 0, 0, 0, 64, 0, 0, 255, 192, 255, 0, 255, 0, 0, 0, 0], 0.5).data], [192, 255, 0, 255], 'the tip carries the block, not the first in row order');
  // ...and on equal height the LOWER tone: the tip beats the highlight, so a far field does not sparkle
  assert.deepEqual([...one([0, 0, 0, 0, 255, 255, 0, 255, 192, 255, 0, 255, 0, 0, 0, 0], 0.5).data], [192, 255, 0, 255]);
  // coverage: a 4x2 level of two tufts, every texel covered, at a target of a quarter keeps two blocks... and the per-tuft floor keeps one per tuft
  const full = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4).fill(255) };
  const down = downsampleCoverage(full, { targetFrac: 0.25, variants: 1 });
  assert.equal(coverageOf(down), 0.5, 'two of two blocks: round(0.25 * 2) = 1 kept, then the one-per-tuft floor... the tuft is 2 texels wide and already has one');
  const sheet = buildTuftSheet();
  const chain = buildTuftMips(sheet);
  assert.equal(chain.length, 8, '128x32 halves to 1x1 in seven steps - a chain that stops short is an incomplete texture, which samples black');
  assert.deepEqual(chain.map((l) => `${l.width}x${l.height}`), ['128x32', '64x16', '32x8', '16x4', '8x2', '4x1', '2x1', '1x1']);
  const base = coverageOf(sheet);
  assert.ok(base > 0.15 && base < 0.25, `the sheet is mostly air (${base})`);
  for (const [k, l] of chain.entries()) {
    for (let i = 3; i < l.data.length; i += 4) assert.ok(l.data[i] === 0 || l.data[i] === 255, 'hard alpha at every level');
    const frac = coverageOf(l);
    assert.ok(frac > 0, 'no level is empty');
    const perTuft = l.width / sheet.variants;
    if (perTuft >= 2) assert.ok(Math.abs(frac - base) < 0.03, `level ${k} keeps the base coverage (${frac.toFixed(3)} against ${base.toFixed(3)}) - the old max chain was 88% by level 3`);
    else if (perTuft < 1) assert.equal(frac, 1, `level ${k}: a texel that spans tufts is always grass`);
    let root = 0, n = 0;
    for (let i = 0; i < l.data.length; i += 4) if (l.data[i + 3]) { n++; if (Math.floor((l.data[i] / 255) * 4 + 0.5) === 1) root++; }
    if (k >= 3) assert.ok(root <= n * 0.2, `level ${k}: a far tuft is its tips, not its roots (${root} of ${n} root-toned) - the old chain was ALL root from level 5`);
  }
  assert.equal(chain[7].data[3], 255, 'the last pixel is grass');
  assert.ok(Math.floor((chain[7].data[0] / 255) * 4 + 0.5) >= 2, '...and not the ground\'s colour');
  // every tuft keeps at least a texel while it is a texel wide
  for (const l of chain.slice(1, 5)) {
    const perTuft = l.width / sheet.variants;
    for (let v = 0; v < sheet.variants; v++) {
      let any = 0;
      for (let y = 0; y < l.height; y++) for (let x = Math.floor(v * perTuft); x < Math.floor((v + 1) * perTuft); x++) if (l.data[(y * l.width + x) * 4 + 3]) any++;
      assert.ok(any > 0, `tuft ${v} survives at ${l.width}x${l.height}`);
    }
  }
});

test('GRASS AUDIT 1: the rim has somewhere to land - the highlight is the top two texels of a tall blade, and a seed head goes UNDER its stalk', () => {
  assert.deepEqual([[31, 31, 32], [30, 31, 32], [29, 31, 32], [19, 19, 20], [18, 19, 20], [19, 19, 19]].map(([r, top, h]) => isHighlightRow(r, top, h)), [true, true, false, true, true, false]);
  const sheet = buildTuftSheet();
  let hl = 0; for (let i = 0; i < sheet.data.length; i += 4) if (sheet.data[i] === 255) hl++;
  assert.ok(hl >= 30, `a sheet with ${hl} highlight texels - the first sheet had twelve, and half of those under a seed head`);
  // a headed blade, painted alone: its tip texel is the highlight, not the head's mid tone
  const w = PX_TUFT_W, h = PX_TUFT_H;
  const out = new Uint8Array(w * h * 4);
  paintTuft(out, w, 0, [{ x0: 8, height: 32, lean: 0, wide: false, head: true, ordinal: 0 }], w, h);
  const at = (x, y) => out[(y * w + x) * 4];
  assert.equal(at(8, 31), 255, 'the tip is the highlight'); assert.equal(at(8, 30), 255, '...and the texel under it');
  assert.equal(at(9, 31), toneByte(2), 'the head\'s other column is the head\'s mid tone');
  paintTuft(out.fill(0), w, 0, [{ x0: 8, height: 12, lean: 0, wide: false, head: false, ordinal: 0 }], w, h);
  assert.equal(at(8, 11), toneByte(3), 'a short blade\'s tip is plain tip');
});

test('GRASS-PX: the compiled stages are the lab\'s text under the declared edits, each landing exactly once, and the lab\'s text is untouched', () => {
  assert.equal(GRASSPX_VS_EDITS.length, 6); assert.equal(GRASSPX_FS_EDITS.length, 6);
  assert.equal(GAME_GRASS_VS, applyGrassEdits(LAB_GRASS_VS, GRASSPX_VS_EDITS));
  assert.equal(GAME_GRASS_FS, applyGrassEdits(LAB_GRASS_FS, GRASSPX_FS_EDITS));
  for (const [lab, edits] of [[LAB_GRASS_VS, GRASSPX_VS_EDITS], [LAB_GRASS_FS, GRASSPX_FS_EDITS]]) {
    for (const e of edits) {
      assert.equal(lab.split(e.from).length - 1, 1, `the lab carries the line once: ${e.why}`);
      assert.ok(typeof e.why === 'string' && e.why.length > 20, 'every edit says why');
    }
  }
  assert.throws(() => applyGrassEdits('abc', [{ why: 'x', from: 'zz', to: '' }]), /not found/, 'a lab line that moved is an error, not a shrug');
  assert.throws(() => applyGrassEdits('abab', [{ why: 'x', from: 'ab', to: '' }]), /twice/, 'an edit that would land twice is an error too');
  for (const word of ['uPixel', 'uPxSheet', 'vUV', 'vVar', 'bayer4']) {
    assert.ok(!LAB_GRASS_VS.includes(word) && !LAB_GRASS_FS.includes(word), `the lab's text does not know ${word}`);
    assert.ok(GAME_GRASS_VS.includes(word) || GAME_GRASS_FS.includes(word), `the game's does`);
  }
  // every uniform used is declared (the shader audit glstate.test.js runs over the lab's stages, here over the game's)
  const vs = LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS, fs = LAB_GRASS_HEAD + GAME_GRASS_FS;
  for (const [label, body] of [['VS', vs], ['FS', fs]]) {
    const declared = new Set([...body.matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
    const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
    assert.deepEqual([...used].filter((u) => !declared.has(u)), [], `${label} uses an undeclared uniform`);
    // `flat` is a qualifier here and never a name (VC6 took the sky down with an identifier named flat), and `patch` is reserved
    const code = body.split('\n').map((l) => l.split('//')[0]).join('\n');   // the comments are prose and say "flat" as a word
    assert.equal((code.match(/\bflat\b/g) || []).length, (code.match(/\bflat (in|out) float vVar\b/g) || []).length, `${label}: flat only as the varying's qualifier`);
    assert.ok(!/\bpatch\b/.test(code), `${label}: no identifier named patch`);
  }
  // the pixel terms, by their exact lines: with the switch at zero every one of them is the lab's arithmetic
  for (const line of [
    'float tq = mix(uTime, floor(uTime * uPxStepHz) / uPxStepHz, uPixel);',
    'float gust = sin(tq*1.7 - along*0.35 + aInst.w*0.6) * 0.5 + 0.5;',
    'lean = mix(lean, floor(lean * uPxLeanSteps + 0.5) / uPxLeanSteps, uPixel);',
    'p.xz += side * (aCorner.x-0.5) * mix(aInst2.w * (1.0 - vT*0.75), h * 0.5, uPixel);',
    'vUV = aCorner;',
    'vVar = min(floor(hash(root * 0.37) * uPxVariants), uPxVariants - 1.0);',
  ]) assert.ok(GAME_GRASS_VS.includes(line), `VS: ${line}`);
  for (const line of [
    'vec4 px = texture(uPxSheet, vec2((vVar + vUV.x) / uPxVariants, vUV.y));',
    'if (px.a < 0.5 || vFade < bayer4(gl_FragCoord.xy)) discard;',
    'pxTone = floor(px.r * 4.0 + 0.5); t = px.g; pxBlade = px.b;',
    'if (uPixel > 0.5) c = (pxTone < 1.5 ? root : (pxTone < 2.5 ? mid : tip)) * (0.92 + pxBlade * 0.16);',
    'c *= 0.80 + mix(vTint, floor(vTint * (uPxTintBands - 1.0) + 0.5) / (uPxTintBands - 1.0), uPixel) * 0.42;',
    'c *= (uAmb * 1.25 * (0.42 + 0.58*t) + uSunCol',
    'mix(smoothstep(0.86,1.0,t), step(3.5, pxTone), uPixel) * vLam;',
    'if (uPixel > 0.5) { float l = max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4); float g = max(1.0, floor(pow(l, 1.0 / 2.2) * uPxSteps + 0.5)) / uPxSteps; c *= pow(g, 2.2) / l; }',
    'o = vec4(c, mix(vFade * smoothstep(0.0, 0.30, vT), 1.0, uPixel));',
  ]) assert.ok(GAME_GRASS_FS.includes(line), `FS: ${line}`);
  assert.ok(!/smoothstep\(0\.0,0\.55,vT\)/.test(GAME_GRASS_FS) && !/0\.58\*vT/.test(GAME_GRASS_FS), 'the gradient and the sward shade read the drawn stalk, not the quad');
  assert.ok(!GAME_GRASS_VS.includes('aPC.a * uPxVariants'), 'GRASS AUDIT 1: the sprite is not the gust phase, or every tuft of one sprite hops in unison');
  // GRASS AUDIT 1: the ramp and the band, EVALUATED from the shader's own text
  const ramp = GAME_GRASS_FS.match(/float g = (max\(1\.0, floor\(pow\(l, 1\.0 \/ 2\.2\) \* uPxSteps \+ 0\.5\)\)) \/ uPxSteps;/);
  assert.ok(ramp, 'the ramp\'s rung, as one expression');
  const rung = new Function('l', 'uPxSteps', `const max = Math.max, floor = Math.floor, pow = Math.pow; return ${ramp[1]} / uPxSteps;`);
  const out = (l) => Math.pow(rung(l, PX_RAMP_STEPS), 2.2);
  for (const l of [0.0383, 0.0265, 0.0838, 0.183, 0.372, 0.001]) assert.ok(out(l) > 0, `a luminance of ${l} is never crushed to zero (it was, for everything under 1/16: the mid tone at night, the whole sward in a storm)`);
  assert.ok(out(0.0383) < out(0.183) && out(0.183) < out(0.372), 'the rungs climb with the light - a moonlit midnight is darker than noon');
  assert.ok(out(0.0383) / 0.0383 < 1.6 && out(0.0383) / 0.0383 > 0.6, `a night mid tone stays within a step of itself (x${(out(0.0383) / 0.0383).toFixed(2)})`);
  const band = GAME_GRASS_FS.match(/mix\(vTint, (floor\(vTint \* \(uPxTintBands - 1\.0\) \+ 0\.5\) \/ \(uPxTintBands - 1\.0\)), uPixel\)/);
  assert.ok(band, 'the band, as one expression');
  const banded = new Function('vTint', 'uPxTintBands', `const floor = Math.floor; return ${band[1]};`);
  const bands = new Set(); let sum = 0, N = 0;
  for (let t = 0; t <= 1.0001; t += 0.001) { const b = banded(t, PX_TINT_BANDS); bands.add(Number(b.toFixed(6))); sum += b; N++; }
  assert.deepEqual([...bands].sort(), [0, 1 / 3, 2 / 3, 1].map((v) => Number(v.toFixed(6))).sort(), 'four bands, and the top one reaches 1 - the old floor(x*4)/4 never did');
  assert.ok(Math.abs(sum / N - 0.5) < 0.01, `the banding keeps the mean tint (${(sum / N).toFixed(3)}) - truncation dragged it to 0.375`);
});

test('GRASS-PX: the shader\'s bayer4 is the classic 4x4 matrix, evaluated from the text', () => {
  const m = GAME_GRASS_FS.match(/int m = (.*);/);
  assert.ok(m, 'the closed form is on one line');
  assert.match(GAME_GRASS_FS, /int x = q\.x \^ q\.y;/);
  const f = new Function('x', 'q', `return ${m[1]};`);
  const classic = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) assert.equal(f(x ^ y, { x, y }), classic[y][x], `bayer(${x},${y})`);
  assert.match(GAME_GRASS_FS, /return \(float\(m\) \+ 0\.5\) \/ 16\.0;/, 'centred on the cell, so a fade of 1 passes every pixel and a fade of 0 none');
});

/** a WebGL2 deep enough for the constructor and one draw, with the calls kept */
function stubGl() {
  const calls = [];
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, NEAREST: 14, TEXTURE0: 100, TEXTURE3: 103, TEXTURE4: 104, BLEND: 20, SRC_ALPHA: 21, ONE_MINUS_SRC_ALPHA: 22, TRIANGLES: 23, CULL_FACE: 24, UNSIGNED_SHORT: 25, NEAREST_MIPMAP_NEAREST: 26, LINEAR: 27, CLAMP_TO_EDGE: 28, TEXTURE_WRAP_S: 29, TEXTURE_WRAP_T: 30 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in C) return C[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls, C };
}

test('GRASS-PX: the renderer compiles the game\'s stages, uploads the sheet with every mip level on unit 4, nearest and clamped, and the style is one uniform', () => {
  const { gl, calls, C } = stubGl();
  const r = new LabGrassRenderer(gl);
  const sources = calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]);
  assert.deepEqual(sources, [LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS, LAB_GRASS_HEAD + GAME_GRASS_FS], 'what is compiled is the game\'s text');
  let bound = null; const sheetUploads = [];
  for (const c of calls) { if (c[0] === 'bindTexture') bound = c[2]; else if (c[0] === 'texImage2D' && bound === r.pxSheet) sheetUploads.push(c); }
  assert.deepEqual(sheetUploads.map((c) => [c[2], c[4], c[5]]), [[0, 128, 32], [1, 64, 16], [2, 32, 8], [3, 16, 4], [4, 8, 2], [5, 4, 1], [6, 2, 1], [7, 1, 1]], 'eight levels, by hand - generateMipmap would average the sprite away');
  assert.equal(r.pxVariants, PX_VARIANTS);
  const binds = calls.map((c, i) => [i, c]).filter(([, c]) => c[0] === 'bindTexture' && c[2] === r.pxSheet);
  assert.ok(binds.length >= 1);
  const params = calls.slice(binds[0][0]).filter((c) => c[0] === 'texParameteri').slice(0, 4).map((c) => [c[2], c[3]]);
  assert.deepEqual(params, [[C.TEXTURE_MIN_FILTER, C.NEAREST_MIPMAP_NEAREST], [C.TEXTURE_MAG_FILTER, C.NEAREST], [C.TEXTURE_WRAP_S, C.CLAMP_TO_EDGE], [C.TEXTURE_WRAP_T, C.CLAMP_TO_EDGE]], 'a pixel sprite is never filtered, and the sheet never wraps');
  const light = { sunDir: [0, 1, 0], amb: [1, 1, 1], sunCol: [1, 1, 1], dim: 1 }, wind = { dir: [1, 0], speed: 0, windV: [0, 0] };
  const uploads = (style) => {
    calls.length = 0; r.count = 1;
    r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind, 300, style);
    const u = {}; for (const c of calls) if (c[0] === 'uniform1f' || c[0] === 'uniform1i') u[c[1]] = c[2];
    return u;
  };
  const px = uploads('pixel');
  assert.equal(px.uPixel, 1); assert.equal(uploads('smooth').uPixel, 0);
  // GRASS AUDIT 1: the step counts go up in EVERY style - a zero count is a divide by zero in the pixel arm and mix(lab, NaN, 0) is NaN, which drew nothing
  const sm = uploads('smooth');
  assert.deepEqual([sm.uPxStepHz, sm.uPxLeanSteps, sm.uPxVariants, sm.uPxSteps, sm.uPxTintBands], [PX_STEP_HZ, PX_LEAN_STEPS, PX_VARIANTS, PX_RAMP_STEPS, PX_TINT_BANDS], 'the smooth draw still uploads every count');
  assert.equal(sm.uPxSheet, undefined, '...but never binds the sheet');
  calls.length = 0; r.count = 1; r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind, 300, 'smooth');
  assert.ok(!calls.some((c) => c[0] === 'bindTexture' && c[2] === r.pxSheet) && !calls.some((c) => c[0] === 'activeTexture' && c[1] === C.TEXTURE4), 'the smooth style never touches unit 4');
  calls.length = 0; r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind);
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uPixel')[2], 0, 'a draw that names no style is the lab\'s');
  assert.equal(uploads('junk').uPixel, 1, 'a stored value that is no tier is the row\'s default, pixel - the same fallback the pane draws');
  assert.deepEqual([px.uPxStepHz, px.uPxLeanSteps, px.uPxVariants, px.uPxSteps, px.uPxTintBands, px.uPxSheet], [PX_STEP_HZ, PX_LEAN_STEPS, PX_VARIANTS, PX_RAMP_STEPS, PX_TINT_BANDS, 4]);
  assert.deepEqual([PX_STEP_HZ, PX_LEAN_STEPS, PX_RAMP_STEPS, PX_TINT_BANDS, PX_BLADES_PER_TUFT], [8, 24, 8, 4, 2]);
  // GRASS AUDIT 1: the lab's one-scatter path draws the pixel tuft too - one quad, half the blades
  calls.length = 0; r.count = 7; r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind, 300, 'pixel');
  let dr = calls.find((c) => c[0] === 'drawArraysInstanced');
  assert.deepEqual([dr[3], dr[4], r.drawn.farSlots, r.drawn.blades, r.drawn.kept], [r.vertsFar, 4, 1, 4, 7], 'the scatter path: the one-quad blade, ceil(7/2) instances, and the stats say so');
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSlotN')[2], 4, 'the fade fraction runs over the half');
  calls.length = 0; r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind, 300, 'smooth');
  dr = calls.find((c) => c[0] === 'drawArraysInstanced');
  assert.deepEqual([dr[3], dr[4], r.drawn.farSlots], [r.verts, 7, 0]);
  // GRASS AUDIT 1: the constructor takes the LAB's stages, so the probe can draw the same field through the lab's own text
  const { gl: gl2, calls: calls2 } = stubGl();
  new LabGrassRenderer(gl2, { stages: { vs: LAB_GRASS_VS, fs: LAB_GRASS_FS } });
  assert.deepEqual(calls2.filter((c) => c[0] === 'shaderSource').map((c) => c[2]), [LAB_GRASS_HEAD + GAME_GRASS_FIELD + LAB_GRASS_VS, LAB_GRASS_HEAD + LAB_GRASS_FS]);
  calls.length = 0; r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind, 300, 'pixel');
  const at4 = calls.findIndex((c) => c[0] === 'activeTexture' && c[1] === C.TEXTURE4);
  assert.ok(at4 >= 0 && calls[at4 + 1][0] === 'bindTexture' && calls[at4 + 1][2] === r.pxSheet, 'the sheet is bound on unit 4');
  assert.ok(calls.slice(at4).some((c) => c[0] === 'activeTexture' && c[1] === C.TEXTURE0), '...and the active unit is handed back to 0');
  calls.length = 0; r.destroy();
  assert.ok(calls.some((c) => c[0] === 'deleteTexture' && c[1] === r.pxSheet), 'the sheet goes with the renderer');
});

test('GRASS-PX: the row, its default, and the host reading it live', () => {
  const ids = FEATURES.map((f) => f.id);
  assert.equal(ids.indexOf('grass-style'), ids.indexOf('grass-density') + 1, 'beside the density dial');
  const world = read('src/scenes/world.js');
  const row = FEATURES.find((f) => f.id === 'grass-style');
  assert.deepEqual({ ...row.control, tiers: row.control.tiers.map((t) => [...t]) }, { store: 'prefs', key: 'grassStyle', initial: 'pixel', online: 'player', tiers: [['pixel', 'Pixel'], ['smooth', 'Smooth']] });
  assert.equal(row.group, 'sight'); assert.deepEqual([...row.kinds], ['enhanced']); assert.equal(row.effect, 'Takes effect at once.');
  assert.ok(row.note.includes('unless the enhanced outdoors are on and Grass density is above Off'), 'GRASS AUDIT 1: the row says what it is inert without, as FT7\'s law has its sibling say');
  assert.ok(world.includes('vertsPerBlade: labGrass._oneQuad ? labGrass.vertsFar : labGrass.verts'), 'GRASS AUDIT 1: the stats say which blade the frame drew');
  assert.equal(FEATURE_PREF_DEFAULTS.grassStyle, 'pixel', 'the shelf\'s default is the row\'s');
  assert.deepEqual(['pixel', 'smooth', undefined, 'junk'].map(pixelGrass), [true, false, true, true]);
  const at = world.indexOf('labGrass.draw(proj, view, new Float32Array(cam.pos), now / 1000,');
  assert.ok(at > 0);
  const call = world.slice(at, world.indexOf(');', at) + 2);
  assert.ok(call.endsWith("LAB_GRASS.range, getPref('grassStyle'));"), 'the draw\'s last word is the row\'s, read every frame - a uniform, so no reload');
  // the probe drives the pixel style on a real GL and counts its colours
  const probe = read('tools/grassFieldProbe.mjs');
  assert.ok(probe.includes("frame(200, 'pixel')") && probe.includes('out.pixel.tones < out.at200.tones * 0.5'), 'the probe draws the pixel style and holds that it takes fewer colours');
  assert.ok(probe.includes('out.pxSheet.soft === 0'), '...and reads the sheet back off the GPU with a hard alpha');
});

/** a cell's blades as the placer shapes them, for the slot rig (perf2's own) */
function cellPlaced(cx, cz, perCell, { h = 50, y = 10, cell = GRASS_CELL } = {}) {
  const inst = new Float32Array(perCell * 4), inst2 = new Float32Array(perCell * 4), rootY = new Float32Array(perCell), ground = new Float32Array(perCell * 3);
  for (let i = 0; i < perCell; i++) {
    inst[i * 4] = cx * cell + (i % 7) / 7 * cell; inst[i * 4 + 1] = cz * cell + Math.floor(i / 7) % 7 / 7 * cell; inst[i * 4 + 2] = h; inst[i * 4 + 3] = i / perCell;
    rootY[i] = y;
  }
  return { inst, inst2, rootY, ground, count: perCell, perCell };
}

test('GRASS-PX2: in the pixel style every cell draws the ONE-QUAD blade - the sprite carries its own curve, so the near cells drop to a fifth of their vertices', () => {
  const { gl, calls } = stubGl();
  const r = new LabGrassRenderer(gl);
  const perCell = 49;
  r.allocSlots(perCell, 4);
  const eye = [0, 12, 0];
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt(eye, [0, 12, 1], [0, 1, 0]);
  r.writeSlot(0, cellPlaced(0, 3, perCell));   // 90..120 m ahead: NEAR against a 300 m range
  const light = { sunDir: [0, 1, 0], amb: [0.2, 0.2, 0.2], sunCol: [1, 1, 1], dim: 1 }, wind = { dir: [1, 0], speed: 0, windV: [0, 0] };
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, light, wind, 300, 'smooth');
  assert.equal(r.drawn.slots, 1); assert.equal(r.drawn.farSlots, 0, 'smooth: a near cell is the five-quad blade');
  assert.equal(r.drawn.verts, r.drawn.blades * r.verts);
  assert.ok(!calls.some((c) => c[0] === 'bindVertexArray' && c[1] === r.vaoFar), 'the far array is never bound for it');
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, light, wind, 300, 'pixel');
  assert.equal(r.drawn.slots, 1); assert.equal(r.drawn.farSlots, 1, 'pixel: the same near cell is the one-quad blade');
  assert.equal(r.drawn.verts, r.drawn.blades * r.vertsFar, 'a fifth of the vertices');
  assert.ok(calls.some((c) => c[0] === 'bindVertexArray' && c[1] === r.vaoFar), 'the one-quad array is bound');
  // GRASS AUDIT 1: a tuft stands in for two blades, so the cell submits HALF (the first half of a random order is a uniform half), the fade fraction over that half, and the cell still HOLDS all of them
  assert.equal(r.drawn.blades, Math.ceil(perCell / PX_BLADES_PER_TUFT), `${r.drawn.blades} of ${perCell}`);
  assert.equal(r.drawn.kept, perCell);
  assert.equal(calls.filter((c) => c[0] === 'uniform1f' && c[1] === r.u.uSlotN).pop()[2], Math.ceil(perCell / PX_BLADES_PER_TUFT), 'uSlotN is the half, so the index fraction is over the half');
  assert.equal(r.vertsFar * 5, r.verts);
  // and back: the style is read every draw, not latched
  r.draw(proj, view, new Float32Array(eye), 0, light, wind, 300, 'smooth');
  assert.equal(r.drawn.farSlots, 0);
  // the probe counts it on a real GL
  const probe = read('tools/grassFieldProbe.mjs');
  assert.ok(probe.includes('out.pixelShipped.drawn.verts < out.shipped.drawn.verts * 0.5'), 'the probe holds the pixel frame under half the smooth frame\u2019s vertices');
});
