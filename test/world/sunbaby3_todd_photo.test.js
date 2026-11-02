// SUNBABY3 — TODD'S PHOTOGRAPH, AND FASTER TURNS (2026-10-04).
//
// The ask: "Have it transition much faster and use this for todd howard", with his photograph. The faces turn in
// SUNBABY_MORPH_S = 1 s (the cycle's own pins, test/world/sunbaby2_phases.test.js, moved with it), and Todd's phase draws
// THE PHOTOGRAPH Mac supplied (src/assets/sunbaby/todd.jpg) in the face's disk inside the sun's rim - the cartoon only
// until it has loaded, or if it never does.
//
// THE PINS, BY THE DOOR THEY GUARD:
//   the file    - the bundled photograph is there, the square crop the shader maps, small; and its doctrine row
//   the look    - the GLSL maps it into the face's disk from the table, right way up, with derivatives taken before the
//                 branch, and draws the cartoon only where the photograph is not on
//   the pass    - it loads the photograph, uploads it once inside a frame (mipmapped, the unpack flip held and put
//                 back), tells the shader it is on, and frees it; a failed load keeps the cartoon
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUNBABY_GLSL, SUNBABY_TODD_PHOTO_FIT } from '../../src/world/sunbabySky.js';
import { SunbabySkyRenderer, SUNBABY_TODD_PHOTO_URL, SUNBABY_UNIFORMS, SUNBABY_FS as FS } from '../../src/render/sunbabySkyRenderer.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

/** A JPEG's frame size, from its first SOFn marker. */
function jpegSize(b) {
  assert.ok(b[0] === 0xff && b[1] === 0xd8, 'a JPEG');
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  throw new Error('no frame');
}

test('SUNBABY3 file: the photograph is bundled where the pass asks for it - a square 256 crop of the face, small - and the doctrine allow-list says whose it is', () => {
  const path = fileURLToPath(SUNBABY_TODD_PHOTO_URL);
  assert.ok(path.endsWith('src/assets/sunbaby/todd.jpg'));
  const bytes = readFileSync(path);
  assert.deepEqual(jpegSize(bytes), { w: 256, h: 256 }, 'the square the shader maps (its circle the face\'s disk)');
  assert.ok(statSync(path).size < 32 * 1024, 'a sun in the sky needs no more');
  assert.match(rd('test/tooling/doctrine.test.js'), /\['src\/assets\/sunbaby\/todd\.jpg', 'SUPPLIED - [^']+'\]/, 'SUPPLIED, with its reason');
});

test('SUNBABY3 GLSL: Todd\'s photograph fills the face\'s disk (SUNBABY_TODD_PHOTO_FIT face radii - its circle half the square), the right way up, by derivatives taken before the branch, and the cartoon is drawn only where it is not on (mutants: upside down; not drawn; the cartoon over it)', () => {
  assert.equal(SUNBABY_TODD_PHOTO_FIT, 0.9);
  const k = (0.5 / SUNBABY_TODD_PHOTO_FIT).toFixed(4);
  assert.ok(SUNBABY_GLSL.includes(`vec2 k = vec2(${k}, -${k});`), 'uv\'s up is the photograph\'s first row (no unpack flip)');
  assert.match(SUNBABY_GLSL, /vec3 ph = textureGrad\(photo, 0\.5 \+ uv \* k, duv\.xy \* k, duv\.zw \* k\)\.rgb;/);
  assert.ok(SUNBABY_GLSL.includes(`col = mix(col, ph, todd * photoOn * sbFill(r - ${SUNBABY_TODD_PHOTO_FIT.toFixed(4)}, px));`), 'in the face\'s disk, by Todd\'s weight');
  assert.match(SUNBABY_GLSL, /float cart = todd \* \(1\.0 - photoOn\);\n\s*if \(cart > 0\.0\) \{/);
  const cartoon = SUNBABY_GLSL.slice(SUNBABY_GLSL.indexOf('float cart = todd'), SUNBABY_GLSL.indexOf('vec3 sunbabySky('));
  assert.equal((cartoon.match(/\btodd \*/g) ?? []).length, 1, 'nothing of the cartoon is drawn by Todd\'s weight alone');
  assert.ok((cartoon.match(/\bcart \* sbFill/g) ?? []).length >= 9);
  assert.ok(SUNBABY_UNIFORMS.includes('uToddPhoto') && SUNBABY_UNIFORMS.includes('uToddPhotoOn'));
  assert.match(FS, /uniform sampler2D uToddPhoto;[^\n]*\nuniform float uToddPhotoOn;/);
});

/** A WebGL2 that records every call (constants answer their own names) - SUNBABY1's. */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k === 'getParameter') return a[0] === 'UNPACK_FLIP_Y_WEBGL' ? true : undefined;   // another pass left the flip on
        if (k.startsWith('create')) return { k };
        return undefined;
      };
    },
  });
  return { gl, calls };
}

/** An Image the test loads by hand. */
function withImages(fn) {
  const made = [];
  const had = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  globalThis.Image = class { constructor() { made.push(this); this.onload = null; this.onerror = null; this.src = ''; } };
  try { return fn(made); } finally { if (had) Object.defineProperty(globalThis, 'Image', had); else delete globalThis.Image; }
}

test('SUNBABY3 pass: it loads the photograph, uploads it ONCE inside a frame - mipmapped, the unpack flip held off and put back as it was - and only then tells the shader it is on; the cartoon until then (mutants: never uploaded; never on; re-uploaded every frame; the flip unguarded)', () => {
  withImages((made) => {
    const { gl, calls } = fakeGl();
    const p = new SunbabySkyRenderer(gl);
    assert.equal(made.length, 1);
    assert.equal(made[0].src, SUNBABY_TODD_PHOTO_URL);
    assert.equal(p.photoOn, 0);
    p.weight = 1; p.todd = 1;
    calls.length = 0;
    p.draw(0, 0.3, 1.1, 1.5);
    const on = () => calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uToddPhotoOn').map((c) => c[2]);
    assert.deepEqual(on(), [0], 'not loaded: the cartoon');
    assert.ok(calls.some((c) => c[0] === 'bindTexture' && c[2] === p.photoTex), 'the sampler reads a complete texture all the same');
    assert.deepEqual(calls.find((c) => c[0] === 'uniform1i'), ['uniform1i', 'uToddPhoto', 0]);
    made[0].onload();
    assert.ok(!calls.some((c) => c[0] === 'texImage2D'), 'no GL outside the frame');
    calls.length = 0;
    p.draw(0, 0.3, 1.1, 1.5);
    const up = calls.findIndex((c) => c[0] === 'texImage2D');
    assert.deepEqual(calls[up], ['texImage2D', 'TEXTURE_2D', 0, 'RGBA', 'RGBA', 'UNSIGNED_BYTE', made[0]]);
    const flips = calls.filter((c) => c[0] === 'pixelStorei' && c[1] === 'UNPACK_FLIP_Y_WEBGL').map((c) => c[2]);
    assert.deepEqual(flips, [false, true], 'held off for the photograph, then put back as it was');
    assert.ok(calls.findIndex((c) => c[0] === 'pixelStorei') < up);
    assert.ok(calls.findIndex((c) => c[0] === 'generateMipmap') > up);
    assert.deepEqual(on(), [1], 'Todd wears it');
    calls.length = 0;
    p.draw(0, 0.3, 1.1, 1.5);
    assert.ok(!calls.some((c) => c[0] === 'texImage2D'), 'once');
    assert.deepEqual(on(), [1]);
  });
});

test('SUNBABY3 pass: a photograph that never loads warns and keeps the cartoon; with no Image (Node) nothing is fetched and nothing breaks', () => {
  withImages((made) => {
    const { gl, calls } = fakeGl();
    const p = new SunbabySkyRenderer(gl);
    const warn = console.warn, said = [];
    console.warn = (...a) => said.push(a.join(' '));
    try { made[0].onerror(); } finally { console.warn = warn; }
    assert.match(said[0], /the cartoon stands in/);
    p.weight = 1;
    calls.length = 0;
    p.draw(0, 0.3, 1.1, 1.5);
    assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uToddPhotoOn').map((c) => c[2]), [0]);
  });
  assert.equal(typeof globalThis.Image, 'undefined');
  const { gl } = fakeGl();
  const p = new SunbabySkyRenderer(gl);
  p.weight = 1;
  p.draw(0, 0.3, 1.1, 1.5);
  assert.equal(p.photoOn, 0);
});
