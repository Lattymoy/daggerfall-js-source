// PRECIP4 (2026-10-19, the owner: "the transition should be seamless both in ground texture and everything else"): THE
// SNOW ON THE GROUND - the cover's chunk (render/snowCoverGlsl.js) run through test/glsl.mjs against the law
// (systems/weather/snowpack.js) and against its own twin on the CPU, the renderer's frame of snowlines and its draws, a
// set's twin, the host about the player (scenes/snowCoverHost.js) and its wiring: the builds' seasons (scenes/
// pixelBuild.js), the world's draws, its sweep, its grass, its feet and the Snowfall mod's surface on it. AUDIT PRECIP
// (the owner: "Audit this and ensure perfection. No band aids") re-pinned every law GROUND-1..9 and HOST-1..10 moved.
// bible/07-Rendering/Biome-Precipitation.md is the record, bible/01-Overview/audits/Audit-Precip.md the audit's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { snowCoverGlsl, snowCoreGlsl, snowCoverAt, SNOW_GROUND, TWIN_LAYERS, SNOW_LINES_UNIT, SNOW_TILE_ROW0, SNOW_TILE_M } from '../../src/render/snowCoverGlsl.js';
import { SNOW_VS, snowTerrainFs } from '../../src/render/snowfallGlsl.js';
import { ecotoneGlsl } from '../../src/render/ecotoneGlsl.js';
import { coverAtHeight, SNOWPACK, latticeKey } from '../../src/systems/weather/snowpack.js';
import { createSnowCoverHost, SNOW_COVER, twinKey, twinLayers, flatDraw } from '../../src/scenes/snowCoverHost.js';
import { SEASON } from '../../src/world/climateSwaps.js';
import { ecoOrigin, ECOTONE } from '../../src/world/ecotone.js';
import { SEA_LEVEL_M, setAirGround } from '../../src/systems/weather/airTemperature.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import * as RENDER from '../../src/render/renderer.js';
import { EL_TERRAIN_FS } from '../../src/render/enhancedLighting.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const read = (p) => readFileSync(p, 'utf8');
const PIX = 819.2;
const none = [0, 0];

/** The chunk (with the ecotone's before it: its uEcoOrigin, its weights) bound to a frame of snowlines - `lines(i, j)` the
 *  [h10, h50, h90] of the window's point (i east, j south of its first), `win` the window's first world tile. */
const chunk = ({ lines = () => [0, 0, 0], win = [0, 0], side = 11, alt = 0, on = 1, spacing = 2 * 128, origin = [0, 0, 0], u = {} } = {}) => glslFunctions('uniform highp sampler2DArray uTileArr;\n' + ecotoneGlsl('') + snowCoverGlsl(''), {
  uEcoSide: [0, 0, 0, 0], uEcoCorner: [0, 0, 0, 0], uEcoOrigin: origin, uSnowWin: [win[0], win[1], side], uSnowSet: [alt, on, spacing, 0], uSnowArr: [TWIN_LAYERS, 0, 0, 0],
  texelFetch: (smp, p) => [...lines(p[0], p[1]), 0],
  textureGrad: (smp, tl) => (tl[2] >= TWIN_LAYERS ? [1, 1, 1, 1] : [0.2, 0.4, 0.1, 1]),
  ...u,
});
const lineFn = (h10, h50, h90) => () => [h10, h50, h90];

test('PRECIP4 THE CHUNK READS THE LAW: snowAtHeight is snowpack.js coverAtHeight term for term (mutants: a piece\'s slope; the ends\' quarter span)', () => {
  const f = chunk();
  let seed = 3; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 400; i++) {
    const h50 = rnd() * 3000 - 500, line = [h50 - rnd() * 400, h50, h50 + rnd() * 400];
    for (const h of [line[0] - 300, line[0] - 20, line[0], (line[0] + line[1]) / 2, line[1], line[2] - 1, line[2] + 30, line[2] + 900]) {
      near(f.snowAtHeight(line, h), coverAtHeight(line, h), 1e-9, `line ${line.map((v) => v.toFixed(0))} at ${h.toFixed(0)}`);
    }
  }
});

test('PRECIP4 THE FRAGMENT\'S COVER: off the lane none; on it the line between the window\'s four points about it, its height (world y + the frame\'s offset) against it, a thin cover broken into patches while a bare one stays bare and a whole one whole (mutants: the switch unread; the offset\'s sign; the patches over a whole cover; the laid snow\'s footprint one axis twice)', () => {
  const [ox, oz] = ecoOrigin(200, 100);
  const f = chunk({ lines: lineFn(100, 150, 180), win: [ox, oz + 128], origin: [ox, oz, 0], alt: -34 });
  assert.equal(f.snowCover([400, 400], 2000 + 34, none, none), 1, 'whole over its 90 %');
  assert.equal(f.snowCover([400, 400], 0 + 34, none, none), 0, 'bare under its 10 %');
  const off = chunk({ lines: lineFn(100, 150, 180), on: 0 });
  assert.equal(off.snowCover([400, 400], 9000, none, none), 0, 'off the lane');
  assert.equal(off.snowLaid([400, 400], 9000, none, none), 1, 'and a snow lying on the ground the whole ground\'s (GROUND-9)');
  assert.equal(f.snowLaid([400, 400], 0 + 34, none, none), 0, 'on it, the ground\'s own');
  // AUDIT FB1021 L1-6: its footprint the fragment's own, both axes - a footprint one way only (a tile and a half a pixel
  // up the screen, none across) fades the finest patches where a square one would not
  let fades = 0;
  for (let i = 0; i < 60; i++) {
    const at = [i * 13.3 + 2, 800 - i * 11.9], wide = f.snowLaid(at, 150 + 34, none, [0, 1.5]);
    assert.equal(wide, f.snowCover(at, 150 + 34, none, [0, 1.5]), `the ground's own at ${at}`);
    if (Math.abs(wide - f.snowCover(at, 150 + 34, none, none)) > 1e-6) fades++;
  }
  assert.ok(fades > 10, `the footprint read: ${fades} of 60 changed by it`);
  let white = 0, n = 0, mixed = 0;
  for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { white += f.snowCover([i * 20.3 + 1, j * 20.3 + 1], 150 + 34, none, none); n++; }
  assert.ok(white / n > 0.3 && white / n < 0.7, `half the ground: ${(white / n).toFixed(2)}`);
  for (let i = 0; i < 400; i++) { const c = f.snowCover([i * 2.1, 3], 150 + 34, none, none); if (c > 0.05 && c < 0.95) mixed++; }
  assert.ok(mixed < 140, `patches, not a grey wash: ${mixed} of 400 between`);
});

test('PRECIP4 THE PATCHES FADE WITH THE FOOTPRINT (AUDIT PRECIP GROUND-8): an octave whose cell the fragment\'s footprint reaches is its mean, and a footprint past every cell reads the share itself - the distant snowline stands still as the eye moves (GRAIN1\'s grain was back); under half a tile a pixel, the patches whole (mutants: the fade dropped; the keep unread)', () => {
  const f = chunk({ lines: lineFn(100, 150, 180) });
  const c = coverAtHeight([100, 150, 180], 150);
  for (let i = 0; i < 50; i++) {
    const p = [i * 13.7 + 2, 400 - i * 7.1];
    near(f.snowCover(p, 150, [20, 0], [0, 20]), c, 1e-9, 'the share itself, far off');
    near(f.snowCover(p, 150, [0.3, 0], [0, 0.3]), f.snowCover(p, 150, none, none), 1e-12, 'the near field unchanged');
  }
  let spread0 = 0, spread1 = 0;
  for (let i = 0; i < 200; i++) { const p = [i * 4.1, 300]; spread0 += Math.abs(f.snowCover(p, 150, none, none) - c); spread1 += Math.abs(f.snowCover(p, 150, [3, 0], [0, 3]) - c); }
  assert.ok(spread1 < spread0, 'a middling footprint keeps the large patches alone');
  assert.deepEqual(SNOW_GROUND.fade, [2, 2]);
});

test('PRECIP4 THE CPU READS THE SAME COVER (AUDIT PRECIP GROUND-3/4, HOST-5): snowCoverAt is the chunk\'s snowCover term for term at a fragment\'s place (the grass, the feet), and the host\'s line at a field point is the shader\'s between the same four lattice points on pixel corners (mutants: a patch octave\'s salt; the corners of the lattice by the pixel\'s middle)', async () => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 900 });
  try {
    const t = (406 * 360 + 215) * 1440;
    const state = { compensation: [0, 40, 0], mapOrigin: { x: 200, y: 100 }, current: { x: 200, y: 100 }, pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 200) * PIX; out[1] = 40; out[2] = -(py - 100) * PIX; return out; } };
    const host = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => state, builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => t, place: () => ({ px: 200, py: 100 }) });
    await host.settle({ left: () => Infinity, breathe: async () => {} });
    // a field of lines that varies across the window: every point its own
    for (const [k, l] of host._lines) { const i = Math.floor(k / 16384) - 8192, j = (k % 16384) - 8192; const h = 200 + 37 * (i % 5) + 23 * (j % 7); l.shown = Float32Array.of(h, h + 60, h + 110); }
    const fr = host.frame();
    assert.ok(fr, 'a frame once read');
    const texel = (i, j) => { const s = fr.side, o = (Math.min(s - 1, Math.max(0, j)) * s + Math.min(s - 1, Math.max(0, i))) * 4; return [fr.lines[o], fr.lines[o + 1], fr.lines[o + 2]]; };
    let seed = 11; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let checked = 0;
    for (let k = 0; k < 240; k++) {   // SNOW-FACE: 240 places (the slope's draw gone, 160 held 9 between bare and whole)
      const px = 196 + Math.floor(rnd() * 9), py = 96 + Math.floor(rnd() * 9), lx = rnd() * PIX, lz = rnd() * PIX;
      const [ox, oz] = ecoOrigin(px, py), fx = px * PIX + lx, fz = (499 - py) * PIX + lz;
      const f = chunk({ lines: texel, win: fr.origin, side: fr.side, alt: fr.altitude, spacing: fr.spacing, origin: [ox, oz, 0] });
      const line = host.lineAt(fx, fz);
      for (let q = 0; q < 3; q++) near(f.snowLine([lx, lz])[q], line[q], 1e-6, `the line at ${px},${py} (${q})`);
      const alt = line[1] + (rnd() - 0.5) * 120;
      const gpu = f.snowCover([lx, lz], alt - fr.altitude, none, none);
      const cpu = snowCoverAt(host.coverAt(fx, fz, alt), lx, lz, ox, oz);
      near(gpu, cpu, 1e-6, `the cover at ${px},${py}`);
      if (cpu > 0.05 && cpu < 0.95) checked++;
    }
    assert.ok(checked > 10, `between bare and whole: ${checked}`);
    assert.equal(fr.origin[0], (host._window[0].i) * SNOW_COVER.spacing * 128, 'the window\'s first point\'s world tile');
    assert.equal(fr.origin[1], (SNOW_TILE_ROW0 + 1 - host._window[0].j * SNOW_COVER.spacing) * 128);
    assert.equal(SNOW_TILE_ROW0, ECOTONE.row0, 'the ecotone\'s frame');
    assert.deepEqual(fr.anchor, [(host._window[0].i * SNOW_COVER.spacing - 200) * PIX, -(host._window[0].j * SNOW_COVER.spacing - 100) * PIX + PIX], 'the scene point it stands at');
    assert.equal(fr.altitude, -(40 + SEA_LEVEL_M), 'world y to metres above the sea');
  } finally { setAirGround(null); }
});

test('PRECIP4 THE PATCHES ARE THE WORLD\'S: a pixel\'s east edge and its east neighbour\'s west edge read the same noise, and a snow lying on the ground (the Snowfall mod\'s surface, in the window\'s frame - GROUND-9) reads the cover the ground under it does (mutants: the origin unread; the anchor\'s frame off by a pixel)', () => {
  const [ox, oz] = ecoOrigin(200, 100), [ex] = ecoOrigin(201, 100);
  const a = chunk({ origin: [ox, oz, 0] }), b = chunk({ origin: [ex, oz, 0] });
  for (let z = 1; z < 800; z += 37) {
    for (const k of [0, 1, 2]) near(a.snowNoise([128, z / SNOW_TILE_M], SNOW_GROUND.patch[k].cell, SNOW_GROUND.salt + k), b.snowNoise([0, z / SNOW_TILE_M], SNOW_GROUND.patch[k].cell, SNOW_GROUND.salt + k), 1e-12, `cell ${k} at ${z}`);
  }
  // the window: its first point the north-west corner of pixel (196, 96) - a pixel's frame and the window's, one cover
  const win = [196 * 128, (SNOW_TILE_ROW0 + 1 - 96) * 128];
  const lines = (i, j) => [180 + 9 * i - 4 * j, 230 + 9 * i - 4 * j, 260 + 9 * i - 4 * j];
  const pix = chunk({ lines, win, origin: [ox, oz, 0] }), snow = chunk({ lines, win, origin: [win[0], win[1], 0] });
  const sw = [(200 - 196) * PIX, -(100 - 96) * PIX - PIX];   // pixel (200, 100)'s south-west corner from the window's anchor
  for (let k = 0; k < 60; k++) {
    const lx = (k * 131.3) % PIX, lz = (k * 77.7) % PIX;
    near(snow.snowCover([sw[0] + lx, sw[1] + lz], 240, none, none), pix.snowCover([lx, lz], 240, none, none), 1e-6, `one cover at ${lx.toFixed(0)},${lz.toFixed(0)}`);
  }
});

test('PRECIP4 THE GROUND\'S TEXEL: none, the bare texel; a cover, the same record\'s WINTER half of the bound array (uSnowArr - the renderer\'s own fact of the array, AUDIT PRECIP GROUND-1) in the cover\'s share; an array with no winter half (0) bare under any cover; at a border each neighbour\'s winter by the ecotone\'s own weights (mutants: the offset dropped; the neighbours\' winter unshifted)', () => {
  const tl = [0.3, 0.6, 7];
  const seen = [];
  const on = chunk({ u: { textureGrad: (smp, t) => { seen.push([smp, t[2]]); return t[2] >= TWIN_LAYERS ? [1, 1, 1, 1] : [0, 0, 0, 1]; } } });
  assert.deepEqual(on.snowGround([0.1, 0.2, 0.3], [1, 0, 0, 0], 0, tl, none, none), [0.1, 0.2, 0.3], 'none: bare, nothing read');
  assert.deepEqual(seen, []);
  assert.deepEqual(on.snowGround([0.1, 0.2, 0.3], [1, 0, 0, 0], 1, tl, none, none), [1, 1, 1], 'whole: the winter record');
  assert.deepEqual(seen, [['uTileArr', 7 + TWIN_LAYERS]], 'its own twin, the same record');
  const half = on.snowGround([0, 0, 0], [1, 0, 0, 0], 0.25, tl, none, none);
  near(half[0], 0.25, 1e-12, 'the cover\'s share');
  const summerOnly = chunk({ u: { uSnowArr: [0, 0, 0, 0], textureGrad: () => [0.9, 0.7, 0.4, 1] } });
  assert.deepEqual(summerOnly.snowGround([0.9, 0.7, 0.4], [1, 0, 0, 0], 1, tl, none, none), [0.9, 0.7, 0.4], 'no winter half: its own texel');
  const border = chunk({
    origin: [...ecoOrigin(200, 100), 1],
    u: { uEcoSide: [1, 0, 0, 0], uEcoCorner: [1, 0, 1, 0], uSnowArr: [TWIN_LAYERS, TWIN_LAYERS, 0, 0],
      textureGrad: (smp, t) => (smp === 'uEcoArr1' ? (t[2] >= TWIN_LAYERS ? [0, 0, 1, 1] : [0, 0, 0.5, 1]) : t[2] >= TWIN_LAYERS ? [1, 0, 0, 1] : [0.5, 0, 0, 1]) },
  });
  let checked = 0;
  for (let x = 0; x < 200; x += 1.7) {
    const w = border.ecoWeights([x, 400]);
    const g = border.snowGround([0, 0, 0], w, 1, tl, none, none);
    near(g[0], w[0], 1e-9, `its own winter by its weight at ${x}`); near(g[2], w[1], 1e-9, `the neighbour's winter by its at ${x}`);
    if (w[1] > 0.1 && w[0] > 0.1) checked++;
  }
  assert.ok(checked > 0, 'a seam in the band');
});

test('PRECIP4 BOTH TERRAIN PROGRAMS: the border\'s weights once, the snow\'s cover once (the bed reads it too - GROUND-5), drawn right after the border and before the bed, decoding as each program decodes; the chunk owns its uniforms (AUDIT 47); the Snowfall mod\'s surface laid where the ground wears snow - its depth by the square, its offset and its coverage by the share (GROUND-9) (mutants: the call dropped from either; the lane\'s winter undecoded; the mod\'s snow unlaid)', () => {
  const r = read('src/render/renderer.js');
  const classic = r.slice(r.indexOf('const TERRAIN_FS = `'), r.indexOf('}`;', r.indexOf('const TERRAIN_FS = `')));
  for (const [name, fs] of [['classic', classic], ['lane', EL_TERRAIN_FS]]) {
    assert.match(fs, /\n {2}vec4 ew = ecoWeights\(vLocalXZ\);[^\n]*\n {2}tex = ecotone\(tex, ew, vec3\(tuv, float\(layer\)\), gx, gy\);[^\n]*\n {2}float snowC = snowCover\(vLocalXZ, vWorldPos\.y, gx, gy\);[^\n]*\n {2}tex = snowGround\(tex, ew, snowC, vec3\(tuv, float\(layer\)\), gx, gy\);\n/, `${name}: after the border`);
    const bed = Math.max(fs.indexOf('vec2 bedK = bedCover(data, tileUV, vec3(tuv, float(layer)), gx, gy, snowC);'), fs.indexOf('${waterBedMix()}'));   // the lane's text evaluated, the classic's its source
    assert.ok(bed > 0 && fs.indexOf('tex = snowGround(') < bed, `${name}: before the bed, which reads its cover`);
  }
  assert.match(EL_TERRAIN_FS, /vec3 white = elDecode\(textureGrad\(uTileArr, vec3\(tl\.xy, tl\.z \+ float\(uSnowArr\.x\)\), gx, gy\)\.rgb\);/, 'the lane decodes its winter');
  assert.match(classic, /\$\{snowCoverGlsl\(\)\}/);
  assert.match(read('src/render/enhancedLighting.js'), /\$\{snowCoverGlsl\('elDecode'\)\}/);
  assert.match(snowCoreGlsl(), /float snowCover\(vec2 local, float y, vec2 gx, vec2 gy\) \{\n {2}if \(uSnowSet\.y < 0\.5\) return 0\.0;/);
  assert.match(ecotoneGlsl(''), /vec4 ecoWeights\(vec2 local\) \{\n {2}if \(uEcoOrigin\.z == 0\) return vec4\(1\.0, 0\.0, 0\.0, 0\.0\);/);
  assert.match(read('src/render/waterBedGlsl.js'), /if \(snowC > 0\.0\) a = mix\(a, textureGrad\(uTileArr, vec3\(tl\.xy, tl\.z \+ float\(uSnowArr\.x\)\), gx, gy\)\.a, snowC\);/, 'the bed\'s painted water the winter art\'s under snow');
  // the Snowfall mod's surface
  assert.match(SNOW_VS, /float laid = snowLaid\(xz - uSnowAnchor, ground\.y, vec2\(0\.0\), vec2\(0\.0\)\);\n {2}vDepth \*= laid \* laid;/);
  assert.match(SNOW_VS, /lifted = depth \* clamp\(st\.r \* 2\.0, 0\.0, 1\.0\) \* laid \* laid \* remain;/);
  assert.match(SNOW_VS, /cover \*= laid;\n {2}float offset = cover/);
  for (const fs of [snowTerrainFs(classic.slice(classic.indexOf('#version')) + '}'), snowTerrainFs(EL_TERRAIN_FS)]) {
    assert.match(fs, /coverage \*= snowLaid\(snowAt, vWorldPos\.y, snowGx, snowGy\);[^\n]*\n {2}if \(coverage - 0\.005 < 0\.0\) discard;/);
    assert.ok(fs.indexOf('vec2 snowGx = dFdx(') < fs.indexOf('discard;'), 'the footprint before the first discard');
  }
});

/** A recording GL: every call by name, uniforms by their location's name, binds by unit. */
function recordingGl() {
  const log = [];
  let unit = 0, ids = 0;
  const enums = new Map();
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'drawingBufferWidth') return 320;
      if (k === 'drawingBufferHeight') return 200;
      if (k.toUpperCase() === k) { if (!enums.has(k)) enums.set(k, 0x9000 + enums.size); return enums.get(k); }
      switch (k) {
        case 'getProgramParameter': case 'getShaderParameter': return () => true;
        case 'getAttribLocation': return () => 0;
        case 'getParameter': return () => new Float32Array(4);
        case 'getExtension': return () => null;
        case 'getUniformLocation': return (p, name) => ({ name });
        case 'activeTexture': return (u) => { unit = u - enums.get('TEXTURE0'); };
        case 'bindTexture': return (target, tex) => { log.push({ k, unit, target, tex }); };
        default:
          if (k.startsWith('create')) return () => ({ id: ++ids });
          if (k.startsWith('uniform')) return (loc, ...args) => { log.push({ k, name: loc?.name, args: args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a)) }); };
          return (...args) => { log.push({ k, args }); };
      }
    },
  });
  return { gl, log, enums, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const u = (log, name) => log.filter((e) => e.name === name).map((e) => e.args);
const layer = (w) => ({ width: w, height: w, colors: new Uint8Array(w * w * 4) });

test('PRECIP4 THE FRAME AND THE DRAW (AUDIT PRECIP GROUND-1/7): the frame\'s snowlines one texture, uploaded when they move, bound once a frame with the window (setSnowFrame stamps the frame\'s block); a draw sends its first world tile and the switch - shadowed, off once while it stays off - and each bound array\'s winter half read off the array the renderer made (a twin\'s 56, a set\'s 0: a released twin never reads layer 55 of a summer set) (mutants: the switch left on; the half the host\'s; the lines re-uploaded every frame)', () => {
  const rig = recordingGl();
  const r = new RENDER.Renderer(rig.canvas);
  const twin = r.uploadTileArray(twinKey(302), Array.from({ length: 2 * TWIN_LAYERS }, () => layer(8)));
  const summer = r.uploadTileArray(302, Array.from({ length: TWIN_LAYERS }, () => layer(8)));
  const frame = { lines: new Float32Array(11 * 11 * 4), side: 11, origin: [1000, 2000], anchor: [5, 6], spacing: 256, altitude: -74, gen: 1 };
  let at = rig.log.length;
  r.setSnowFrame(frame);
  assert.equal(rig.log.slice(at).filter((e) => e.k === 'texSubImage2D').length, 1, 'uploaded');
  at = rig.log.length;
  r.setSnowFrame(frame);
  assert.equal(rig.log.slice(at).filter((e) => e.k === 'texSubImage2D').length, 0, 'not again while they stand');
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  const surface = { vao: {}, indexCount: 6 };
  at = rig.log.length;
  r.drawTerrain(surface, I, twin, { id: 'tilemap' }, 6.4, false, null, Int32Array.of(30720, 42496));
  let d = rig.log.slice(at);
  assert.deepEqual(u(d, 'uSnowWin'), [[1000, 2000, 11]], 'the window once a frame');
  assert.ok(d.some((e) => e.k === 'bindTexture' && e.unit === SNOW_LINES_UNIT), 'the lines on their unit');
  assert.deepEqual(u(d, 'uEcoOrigin'), [[30720, 42496, 0]], 'its first world tile');
  assert.deepEqual(u(d, 'uSnowSet'), [[-74, 1, 256, 0]], 'on');
  assert.deepEqual(u(d, 'uSnowArr'), [[TWIN_LAYERS, 0, 0, 0]], 'its twin\'s winter half');
  at = rig.log.length;
  r.drawTerrain(surface, I, summer, { id: 'tilemap' }, 6.4, false, null, Int32Array.of(30848, 42496));
  d = rig.log.slice(at);
  assert.deepEqual(u(d, 'uSnowSet'), [], 'still on: unsent');
  assert.deepEqual(u(d, 'uSnowArr'), [[0, 0, 0, 0]], 'a set with no winter half: none - never the twin\'s offset into it');
  assert.deepEqual(u(d, 'uSnowWin'), [], 'the window once a frame');
  at = rig.log.length;
  r.drawTerrain(surface, I, summer, { id: 'tilemap' }, 6.4, false, null, null);
  r.drawTerrain(surface, I, summer, { id: 'tilemap' }, 6.4, false, null, null);
  assert.deepEqual(u(rig.log.slice(at), 'uSnowSet'), [[0, 0, 0, 0]], 'off once');
  r.setSnowFrame(null);
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  at = rig.log.length;
  r.drawTerrain(surface, I, twin, { id: 'tilemap' }, 6.4, false, null, Int32Array.of(30720, 42496));
  assert.deepEqual(u(rig.log.slice(at), 'uSnowSet'), [[0, 0, 0, 0]], 'a frame with no snow draws none, whatever the pixel hands');
  assert.equal(r.releaseTileArray(twinKey(302)), true);
  assert.equal(r.tileArrays.has(twinKey(302)), false, 'let go with its key');
});

test('PRECIP4 THE MOD\'S SURFACE ON THE FRAME (AUDIT PRECIP GROUND-9): the snow program takes the frame\'s lines, its window, its first world tile and the scene point it stands at once a frame - and off the snow lane the switch off, where snowLaid is the whole ground (mutants: the frame unsent; the anchor unsent)', () => {
  const rig = recordingGl();
  const r = new RENDER.Renderer(rig.canvas);
  const surface = { vao: {}, indexCount: 6 };
  const uni = { origin: [0, 0, 0], depths: [0.1, 0.1, 0, 0], limits: [0, 0, 0, 0], dynMap: [0, 0, 0, 0], dynTexel: [0, 0, 0, 0], statMap: [0, 0, 0, 0], farMap: null, flags: [0, 0, 0, 0], radius: [0, 0, 0, 0], inner: [0, 0, 0, 0], outer: [0, 0, 0, 0], boundaryFade: 0, darkening: 0 };
  const tex = { dynamic: {}, static: {}, context: {}, far: {}, albedo: {} };
  r.setSnowFrame({ lines: new Float32Array(11 * 11 * 4), side: 11, origin: [1000, 2000], anchor: [5, 6], spacing: 256, altitude: -74, gen: 1 });
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  let at = rig.log.length;
  r.drawSnow(surface, uni, tex);
  let d = rig.log.slice(at);
  assert.deepEqual(u(d, 'uSnowWin'), [[1000, 2000, 11]]); assert.deepEqual(u(d, 'uEcoOrigin'), [[1000, 2000, 0]]);
  assert.deepEqual(u(d, 'uSnowAnchor'), [[5, 6]]); assert.deepEqual(u(d, 'uSnowSet'), [[-74, 1, 256, 0]]);
  assert.deepEqual(u(d, 'uSnowLines'), [[SNOW_LINES_UNIT]], 'its unit, once');
  at = rig.log.length;
  r.drawSnow(surface, uni, tex);
  assert.deepEqual(u(rig.log.slice(at), 'uSnowSet'), [], 'once a frame');
  r.setSnowFrame(null);
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  at = rig.log.length;
  r.drawSnow(surface, uni, tex);
  d = rig.log.slice(at);
  assert.deepEqual(u(d, 'uSnowSet'), [[0, 0, 0, 0]], 'off the lane: the switch off');
});

test('PRECIP4 A SET\'S TWIN IS THE SET (AUDIT PRECIP GROUND-2): its summer records then its winter ones, each at the larger set\'s size (the smaller\'s texels repeated, nearest), their alphas their own; one upload, no blit, no second set (the twin was made beside its two sources: three sets\' memory a climate) (mutants: the halves swapped; the alpha dropped; a fit by the first set\'s size)', () => {
  const mk = (w, v) => { const l = layer(w); for (let i = 0; i < l.colors.length; i += 4) { l.colors[i] = v; l.colors[i + 3] = (i / 4) % 7; } return l; };
  const summer = Array.from({ length: TWIN_LAYERS }, (_, k) => mk(2, k)), winter = Array.from({ length: TWIN_LAYERS }, (_, k) => mk(4, 100 + k));
  const t = twinLayers(summer, winter);
  assert.equal(t.length, 2 * TWIN_LAYERS);
  for (const l of t) assert.deepEqual([l.width, l.height], [4, 4], 'the larger size');
  assert.equal(t[7].colors[0], 7, 'its summer record'); assert.equal(t[TWIN_LAYERS + 7].colors[0], 107, 'then its winter');
  assert.equal(t[TWIN_LAYERS + 7], winter[7], 'a set at the size kept whole');
  assert.equal(t[3].colors[(1 * 4 + 1) * 4 + 3], summer[3].colors[0 * 4 + 3], 'a texel repeated, its alpha its own');
  assert.equal(t[3].colors[(3 * 4 + 3) * 4 + 3], summer[3].colors[(1 * 2 + 1) * 4 + 3]);
  const w = read('src/scenes/groundSets.js');   // PIN MOVED (OW-HITCH): the world host's ground sets' home (HOST-SPLIT), uploading a few layers a breath
  assert.match(w, /const layers = winter == null \? own\.layers : twinLayers\(own\.layers, \(await groundLayersOf\(winter, await getTexture\(winter\)\)\)\.layers\);\n\s+await stepsBreathing\(renderer\.uploadTileArraySteps\(key, layers\), breathe\);/);
  assert.equal(typeof RENDER.Renderer.prototype.makeTwinArray, 'undefined', 'no blit');
});

/** A stream about pixel (200, 100) with its pixels `built`, and a host over it whose lines a test sets by hand. */
function hostRig({ built = new Map(), owns = true, comp = [0, 0, 0], t = NaN } = {}) {
  const lane = { on: owns };
  const marked = [], rebuilt = [];
  const clock = { t };
  const state = {
    compensation: comp, mapOrigin: { x: 200, y: 100 }, current: { x: 200, y: 100 },
    pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 200) * PIX + comp[0]; out[1] = comp[1]; out[2] = -(py - 100) * PIX + comp[2]; return out; },
  };
  const tileArrays = new Map([[302, { id: 'summer' }], [twinKey(302), { id: 'twin' }], [2, { id: 'desert' }]]);
  const host = createSnowCoverHost({ renderer: { tileArrays }, climateAt: () => 0, mapHeight: 500, stateOf: () => state, builtOf: () => built, owns: () => lane.on, markReskin: (k) => marked.push(k), markRebuild: (k) => rebuilt.push(k), now: () => clock.t });
  /** every lattice point's lines about the stream - shown, target and build - one line */
  const setAll = (line, which = ['shown', 'target', 'build']) => {
    for (let j = 40; j <= 60; j++) {
      for (let i = 90; i <= 110; i++) {
        const k = latticeKey(i, j);
        const l = host._lines.get(k) ?? { target: new Float32Array(3), shown: new Float32Array(3), build: new Float32Array(3) };
        for (const w of which) l[w] = Float32Array.from(line);
        host._lines.set(k, l);
      }
    }
  };
  return { host, marked, rebuilt, state, setAll, tileArrays, lane, clock };
}

test('PRECIP4 THE HOST: the lane asked each frame (a pixel built under the other lane built again, once - LANE-TURN: never a re-skin, which never touches its ground); the line bilinear between lattice points on pixel CORNERS (AUDIT PRECIP HOST-5); a pixel\'s draw its first world tile; its set\'s twin on the lane, the set off it; the summer archive on the lane, DFU\'s season off it; the winter a set carries, none for a desert (mutants: the corners at pixel middles; the twin off the lane; a desert\'s winter)', () => {
  const built = new Map([['200,100', { px: 200, py: 100, groundArchive: 302, _snow: { px: 200, py: 100, pixel: null, flats: new Float32Array(0) } }], ['201,100', { px: 201, py: 100, _snow: null }]]);
  const { host, marked, rebuilt, setAll, lane } = hostRig({ built });
  assert.equal(host.on, true, 'the lane known before the first frame - a boot\'s builds ask it');
  host.tick({ px: 200, py: 100 });
  assert.deepEqual(rebuilt, [], 'a pixel built off the lane: not before the window stands (no clock here - AUDIT FB1021 L1-1; fb1021_snowface.test.js turns it once it does)');
  lane.on = false; host.tick({ px: 200, py: 100 });
  assert.deepEqual(rebuilt, ['200,100'], 'the lane turned off: the one built on it, at once');   // PIN MOVED (LANE-TURN): it was sent to the skin, which refused it
  host.tick({ px: 200, py: 100 });
  assert.deepEqual(rebuilt, ['200,100'], 'once');
  assert.deepEqual(marked, [], 'and never sent to the skin');
  lane.on = true; host.tick({ px: 200, py: 100 });
  setAll([100, 200, 300]);
  for (let j = 40; j <= 60; j++) { const l = host._lines.get(latticeKey(101, j)); l.shown = Float32Array.of(300, 400, 500); }
  // lattice point i stands on pixel CORNER 2i: point 100 on pixel 200's west edge, 101 on pixel 202's
  const z = (499 - 100 + 0.5) * PIX;
  const lineNear = (got, want, msg) => want.forEach((v, q) => near(got[q], v, 1e-9, msg));
  lineNear(host.lineAt(200 * PIX, z), [100, 200, 300], 'at a point\'s corner');
  lineNear(host.lineAt(201 * PIX, z), [200, 300, 400], 'half way to the next');
  lineNear(host.lineAt(202 * PIX, z), [300, 400, 500], 'at the next');
  assert.deepEqual([...host.drawOf(built.get('200,100'))], ecoOrigin(200, 100));
  assert.equal(host.arrayOf(302).id, 'twin'); assert.equal(host.arrayOf(2).id, 'desert', 'a set with no twin: itself');
  assert.equal(host.groundArchive({ climateType: 1, groundArchive: 302 }, SEASON.Winter), 302, 'the summer set on the lane');
  assert.equal(host.winterOf({ climateType: 1, groundArchive: 302 }), 303, 'the winter its twin carries');
  assert.equal(host.winterOf({ climateType: 0, groundArchive: 2 }), null, 'a desert\'s ground wears none');
  const off = hostRig({ built, owns: false });
  off.host.tick({ px: 200, py: 100 });
  assert.equal(off.host.drawOf(built.get('200,100')), null);
  assert.equal(off.host.arrayOf(302).id, 'summer');
  assert.equal(off.host.groundArchive({ climateType: 1, groundArchive: 302 }, SEASON.Winter), 303, 'DFU\'s season off the lane');
  assert.equal(off.host.winterOf({ climateType: 1, groundArchive: 302 }), null);
  assert.equal(off.host.frame(), null);
});

test('PRECIP4 THE BUILD\'S SEASONS (AUDIT PRECIP HOST-6/8): a build keeps every season it takes - its buildings\' off the snow at its middle\'s ground, a flat\'s off the snow at its own foot against its own draw (a scatter, the same on every client) - all off the snow as it lay at the last step of the grid (the `build` lines: pure in the place and the minute), never the eased frames\'; off the lane the host\'s, and nothing kept (mutants: the shown lines for the build\'s; the draw unread; a record off the lane)', () => {
  const { host, setAll } = hostRig();
  host.tick({ px: 200, py: 100 });
  setAll([400, 500, 600], ['build']);
  setAll([3000, 3100, 3200], ['shown', 'target']);   // the frames' lines elsewhere: the build reads its own
  const rec = host.recorder(200, 100);
  const hAt = (c) => { for (let h = 300; h < 700; h += 0.25) if (coverAtHeight([400, 500, 600], h) >= c) return h; return 700; };
  assert.equal(rec.pixel(hAt(SNOW_COVER.winter) - 1, SEASON.Summer), SEASON.Summer, 'under the half: summer');
  const rec2 = host.recorder(200, 100);
  assert.equal(rec2.pixel(hAt(SNOW_COVER.winter) + 1, SEASON.Summer), SEASON.Winter, 'over it: winter');
  let winter = 0;
  for (let i = 0; i < 400; i++) {
    const lx = (i * 37) % 800, lz = (i * 91) % 800;
    const s = rec.flat(lx, lz, 500, SEASON.Summer);
    assert.equal(s === SEASON.Winter, coverAtHeight([400, 500, 600], 500) >= flatDraw(200, 100, lx, lz), 'its own draw');
    if (s === SEASON.Winter) winter++;
    assert.equal(rec.flat(lx, lz, 900, SEASON.Summer), SEASON.Winter, 'a whole cover whitens every one');
    assert.equal(rec.flat(lx, lz, 100, SEASON.Winter), SEASON.Summer, 'none whitens none');
  }
  assert.ok(winter > 100 && winter < 300, `a scatter: ${winter} of 400`);
  const kept = rec.done(true);
  assert.deepEqual([kept.px, kept.py], [200, 100]);
  assert.equal(kept.pixel.season, SEASON.Summer);
  assert.equal(kept.flats.length, 400 * 3 * 5, 'every flat\'s place, ground, draw and season');
  assert.equal(rec.done(false).pixel, null, 'no building to wear a season: the pixel\'s decision unkept');
  const off = hostRig({ owns: false });
  off.host.tick({ px: 200, py: 100 });
  const r0 = off.host.recorder(200, 100);
  assert.equal(r0.pixel(5000, SEASON.Summer), SEASON.Summer); assert.equal(r0.flat(1, 1, 5000, SEASON.Winter), SEASON.Winter);
  assert.equal(r0.done(true), null);
  for (let k = 0; k < 50; k++) { const d = flatDraw(200, 100, k * 3.7, k * 9.1); assert.ok(d >= 0.15 && d <= 0.85, 'never at the ends'); assert.equal(d, flatDraw(200, 100, k * 3.7, k * 9.1)); }
});

test('PRECIP4 THE GRASS, THE FEET AND THE MOD (AUDIT PRECIP GROUND-3/9, HOST-4): a blade is buried and a foot treads snow where the ground DRAWS it there - its cover and its patches (snowCoverAt) - at the blade\'s own height; the feet\'s footsteps follow it, the calendar\'s winter taken off; the Snowfall mod stands wherever snow lies on any ground the window holds and lays it only where the ground wears it (it laid the mod\'s snow over a green field from the player\'s white one); off the lane DFU\'s word (mutants: the feet the calendar\'s; the mod\'s gate the player\'s spot; the shift\'s sign under the blade; the feet\'s height unshifted)', () => {
  const { host, setAll, clock } = hostRig({ t: NaN });   // the blade's own height decides (AUDIT PRECIP HOST-9): the host asks the stream no height (SNOW-FACE)
  host.tick({ px: 200, py: 100 });
  setAll([-800, -700, -600]);
  const p = { px: 200, py: 100 };
  assert.equal(host.buries(p, 10, 10, SEA_LEVEL_M + 100), true, 'under a line far below');
  assert.equal(host.winterAt([PIX / 2, SEA_LEVEL_M + 100, -PIX / 2 + 10], false), true, 'snow under the feet');
  assert.equal(host.footSeason([PIX / 2, SEA_LEVEL_M + 100, -PIX / 2 + 10], SEASON.Summer), SEASON.Winter);
  setAll([3000, 3100, 3200]);
  assert.equal(host.buries(p, 10, 10, SEA_LEVEL_M + 100), false, 'a blade at 100 m under a line at 3,000 - whatever the stream\'s ground there');
  assert.equal(host.winterAt([PIX / 2, SEA_LEVEL_M + 100, -PIX / 2 + 10], true), false, 'none, whatever the calendar');
  assert.equal(host.footSeason([PIX / 2, SEA_LEVEL_M + 100, -PIX / 2 + 10], SEASON.Winter), SEASON.Summer, 'the calendar\'s winter taken off');
  // the blade's own place reads the drawn cover: a half cover buries about half, and the same blade the same way twice
  setAll([0, 100, 200]);
  let buried = 0;
  for (let i = 0; i < 400; i++) {
    const lx = (i * 53.3) % PIX, lz = (i * 31.7) % PIX, b = host.buries(p, lx, lz, SEA_LEVEL_M + 100);
    const c = snowCoverAt(coverAtHeight([0, 100, 200], 100), lx, lz, ...ecoOrigin(200, 100));
    assert.equal(b, c > 0 && c >= flatDraw(200, 100, lx, lz), 'the drawn cover against the blade\'s own draw');
    if (b) buried++;
  }
  assert.ok(buried > 40 && buried < 360, `a thinning meadow: ${buried} of 400`);
  // the mod's gate: snow on any ground the window holds - its points' zero-cover height under their ground's top
  assert.equal(host.winterNear(true), true, 'a window read: the lane decides');
  const off = hostRig({ owns: false });
  off.host.tick({ px: 200, py: 100 });
  assert.equal(off.host.winterNear(true), true); assert.equal(off.host.winterNear(false), false, 'off the lane DFU\'s season');
  assert.equal(off.host.winterAt([0, 0, 0], true), true, 'DFU\'s word');
  assert.equal(off.host.buries(p, 1, 1, 0), false);
  assert.equal(off.host.footSeason([0, 0, 0], SEASON.Winter), SEASON.Winter);
  assert.ok(Number.isNaN(clock.t));
  // AUDIT FB1021 L1-6: a scene shifted by the floating origin (compensation 1,000 m up) - the blade's and the foot's
  // height the world's, the shift taken off (every rig before stood at none, where its sign could not show)
  const up = hostRig({ comp: [0, 1000, 0] });
  up.host.tick({ px: 200, py: 100 });
  up.setAll([500, 600, 700]);
  assert.equal(up.host.buries(p, 10, 10, SEA_LEVEL_M + 100 + 1000), false, 'a blade 100 m up, under a line at 500');
  assert.equal(up.host.buries(p, 10, 10, SEA_LEVEL_M + 900 + 1000), true, 'one at 900, over it');
  assert.equal(up.host.winterAt([PIX / 2, SEA_LEVEL_M + 100 + 1000, -PIX / 2 + 10], true), false, 'a foot 100 m up: bare');
  assert.equal(up.host.winterAt([PIX / 2, SEA_LEVEL_M + 900 + 1000, -PIX / 2 + 10], false), true, 'at 900: snow');
  const w = read('src/scenes/world.js');
  assert.equal(w.split('winter: snowCover.winterNear(season === SEASON.Winter)').length - 1, 2, 'the mod indoors and out');
  assert.equal(w.split('winter: snowCover.winterAt(player.pos, season === SEASON.Winter)').length - 1, 3, 'the three footsteps');
  assert.match(w, /season: snowCover\.footSeason\(player\.pos, season\)/, 'Immersive Footsteps\' climate step');
});

test('PRECIP4 THE MOD\'S GATE ON A REAL WINDOW (AUDIT PRECIP GROUND-9): winterNear is whether any window point\'s cover begins under its ground\'s top - snow somewhere about the player - and never the player\'s own spot (mutants: the ceil unread; the zero-cover height the 10 % one)', async () => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 300 });
  try {
    const mk = (t) => createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0] }), builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => t, place: () => ({ px: 200, py: 100 }) });
    const summer = mk((406 * 360 + 215) * 1440);
    await summer.settle({ left: () => Infinity, breathe: async () => {} });
    assert.equal(summer.winterNear(true), false, 'a summer: no snow anywhere about');
    for (const [k, l] of summer._lines) if (k === [...summer._lines.keys()][7]) l.shown = Float32Array.of(250, 320, 380);
    assert.equal(summer.winterNear(false), true, 'one point whose cover begins under its top: the mod stands');
    for (const l of summer._lines.values()) l.shown = Float32Array.of(301 + 0.25 * 50, 351, 401);
    assert.equal(summer.winterNear(true), false, 'its zero-cover height over every top: none');
    for (const l of summer._lines.values()) l.shown = Float32Array.of(305, 365, 405);
    assert.equal(summer.winterNear(false), true, 'its 10 % over the top, its first flakes under it (305 - 15): snow lies');
  } finally { setAirGround(null); }
});

test('PRECIP4 THE BUILD WAITS FOR THE SNOW AT THE CLOCK\'S MINUTE (AUDIT PRECIP HOST-1/2): on the lane a build integrates the window about the player to now() in the breather\'s own slices and reads it there - and again whenever asked at another minute (a Recall after an evening indoors built in the snow of the minute they left); off the lane it waits for nothing (mutants: a window read at any minute answered; no slices)', async () => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 900 });
  try {
    const clock = { t: (406 * 360 + 215) * 1440 };
    const host = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0] }), builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => clock.t, place: () => ({ px: 200, py: 100 }) });
    let breaths = 0;
    await host.settle({ left: () => 0, breathe: async () => { breaths++; } });
    assert.ok(breaths > 0, `sliced: ${breaths} breaths`);
    assert.equal(host.ready, true);
    assert.equal(host._lines.size, (2 * SNOW_COVER.radius + 1) ** 2, 'every point of the window read');
    for (const l of host._lines.values()) assert.deepEqual([...l.shown], [...l.target], 'shown as read');
    const before = host._lattice.stepsRun + host._lattice.stepsSkipped;
    await host.settle({ left: () => Infinity, breathe: async () => { throw new Error('no breath needed'); } });
    assert.equal(host._lattice.stepsRun + host._lattice.stepsSkipped, before, 'at the same minute: nothing again');
    const first = host._lines.get([...host._lines.keys()][0]).target[0];
    // asked two minutes on - under the frames' own re-read: read there all the same, at once
    clock.t += 2;
    let spins = 0;
    await host.settle({ left: () => Infinity, breathe: async () => { if (++spins > 50) throw new Error('never read at the new minute'); } });
    assert.ok(spins < 50);
    clock.t += 5 * 1440;   // five days on - an evening and more indoors
    await host.settle({ left: () => Infinity, breathe: async () => {} });
    assert.ok(host._lattice.stepsRun + host._lattice.stepsSkipped > before, 'integrated to the new minute');
    // AUDIT PRECIP PACK-5: a point the window leaves is let go - one come back to is read as new, never shown as it stood
    const kept = new Set(host._lines.keys());
    host.tick({ px: 260, py: 100, dt: 0 });
    for (const k of host._lines.keys()) assert.ok(!kept.has(k), 'none of the old window\'s lines kept twelve pixels on');
    assert.ok(Number.isFinite(first));
    // AUDIT PRECIP DOC-7: while the world stands up the wait takes the arrival's budget - a fraction of the breaths
    const fresh = (arriving) => createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0] }), builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => clock.t, place: () => ({ px: 300, py: 240 }), arriving: () => arriving });
    const breathsOf = async (h) => { let n = 0; await h.settle({ left: () => 0, breathe: async () => { n++; } }); return n; };
    const stood = await breathsOf(fresh(false)), standing = await breathsOf(fresh(true));
    assert.ok(standing * 3 < stood, `the arrival's budget: ${standing} breaths against ${stood}`);
    const off = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => 0, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0] }), builtOf: () => new Map(), owns: () => false, markReskin: () => {}, now: () => clock.t, place: () => ({ px: 200, py: 100 }) });
    await off.settle({ left: () => Infinity, breathe: async () => { throw new Error('no breath off the lane'); } });
    assert.equal(off._lines.size, 0);
  } finally { setAirGround(null); }
  const w = read('src/scenes/world.js');
  assert.match(w, /now: \(\) => \(_snowArrival !== null && worldMinutes\(\) < _snowArrival \? _snowArrival : \(\(_snowArrival = null\), worldMinutes\(\)\)\)/, 'one clock: a trip\'s arrival minute until its own time has run');
  assert.match(w, /_snowArrival = arriveMinutes != null && Number\.isFinite\(arriveMinutes\) \? eventMinuteOfSky\(arriveMinutes\) : null;/, 'latched beside the season\'s straightening');
  assert.ok(w.indexOf('let _snowArrival = null;') < w.indexOf('const snowCover = createSnowCoverHost('), 'declared before the host that reads it');
});

test('PRECIP4 THE FRAME SWEEPS AT A STEP: once the window stands, the first frame of every new step of the grid sweeps the standing pixels, and the frames between do not (mutants: the step unread)', async () => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 900 });
  try {
    const clock = { t: (406 * 360 + 215) * 1440 + 30 }, marked = [];
    const built = new Map([['200,100', { px: 200, py: 100, _snow: { px: 200, py: 100, pixel: { altitude: 100, season: SEASON.Winter }, flats: new Float32Array(0) } }]]);
    const host = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0], current: { x: 200, y: 100 } }), builtOf: () => built, owns: () => true, markReskin: (k) => marked.push(k), now: () => clock.t, place: () => ({ px: 200, py: 100 }) });
    await host.settle({ left: () => Infinity, breathe: async () => {} });
    host.tick({ px: 200, py: 100, dt: 0 });
    assert.deepEqual(marked, ['200,100'], 'built winter in an autumn\'s bare ground: re-skinned at the step');
    host.tick({ px: 200, py: 100, dt: 0 });
    clock.t += 3;
    host.tick({ px: 200, py: 100, dt: 0 });
    assert.deepEqual(marked, ['200,100'], 'not again inside the step');
  } finally { setAirGround(null); }
});

test('PRECIP4 THE SWEEP (AUDIT PRECIP HOST-3/6): at a step of the grid every standing pixel any one of whose kept decisions the snow now takes otherwise - its buildings\' season, or any one flat\'s - is re-skinned, all of them, nearest first; one the snow still dresses as built left standing; one that stands nothing the snow dresses never due (mutants: a cap; the order reversed; a flat\'s decision unread)', () => {
  const built = new Map();
  for (let k = 7; k >= 0; k--) built.set(`${200 + k},100`, { px: 200 + k, py: 100 });
  const { host, marked, setAll } = hostRig({ built });
  host.tick({ px: 200, py: 100 });
  setAll([400, 500, 600]);
  for (const p of built.values()) { const r = host.recorder(p.px, p.py); r.pixel(100, SEASON.Summer); r.flat(400, 400, 100, SEASON.Summer); p._snow = r.done(true); }
  marked.length = 0;
  assert.deepEqual(host.sweep(), [], 'dressed as built');
  setAll([-800, -700, -600]);
  const keys = host.sweep();
  assert.deepEqual(keys, ['200,100', '201,100', '202,100', '203,100', '204,100', '205,100', '206,100', '207,100'], 'every one, nearest first');
  assert.deepEqual(marked, keys);
  // a flat's decision alone
  const one = new Map([['200,100', { px: 200, py: 100 }]]);
  const r2 = hostRig({ built: one });
  r2.host.tick({ px: 200, py: 100 });
  r2.setAll([0, 200, 400]);
  const q = one.get('200,100');
  const rec = r2.host.recorder(200, 100);
  let fx = 0;
  while (flatDraw(200, 100, fx, 10) >= 0.5) fx += 1;   // a flat whitened by half a cover
  assert.equal(rec.flat(fx, 10, 200, SEASON.Summer), SEASON.Winter);
  q._snow = rec.done(false);
  assert.deepEqual(r2.host.sweep(), [], 'as built');
  r2.setAll([400, 500, 600]);
  assert.deepEqual(r2.host.sweep(), ['200,100'], 'its one flat, bare now, decides');
  const sea = new Map([['300,100', { px: 300, py: 100, _snow: { px: 300, py: 100, pixel: null, flats: new Float32Array(0) } }]]);
  const r3 = hostRig({ built: sea });
  r3.host.tick({ px: 200, py: 100 });
  r3.setAll([-800, -700, -600]);
  assert.deepEqual(r3.host.sweep(), [], 'nothing the snow dresses: never due');
});

test('PRECIP4 THE WIRING: a build settles the snow, then keeps every season it takes through its recorder - its buildings\', its town\'s swaps\', its windmills\', its homes\' (the pixel\'s) and each flat\'s - and the summer set with the winter its twin carries for the ground and its neighbours\'; the world draws each pixel with its set as the lane holds it and its first world tile, hands the frame its lines, the sea and the shadow the lane\'s set, sweeps by the snow on the lane alone, grows no grass through it (mutants: each line reverted)', () => {
  const b = read('src/scenes/pixelBuild.js');
  assert.match(b, /if \(snowCover\?\.on\) await snowCover\.settle\(breather\);[^\n]*\n {4}const snowRec = snowCover\?\.recorder\(px, py\) \?\? null;[^\n]*\n {4}const pixelSeason = snowRec \? snowRec\.pixel\(groundMid - SEA_LEVEL_M, host\.season\) : host\.season;/);
  assert.doesNotMatch(b.slice(b.indexOf('\n', b.indexOf('const pixelSeason = snowRec')), b.indexOf('  async function reskinPixelNow(')), /host\.season\b(?!sReady|sActive)/, 'no build line reads the host\'s season past it');
  // AUDIT PRECIP HOST-7: and a re-skin reads it as the build does, once, into its recorder's pixel
  const skin = b.slice(b.indexOf('  async function reskinPixelNow('), b.indexOf('  _reskin.skinWith(reskinPixelNow);'));
  assert.match(skin, /const pixelSeason = rec\.pixel\(sk\.groundMid - SEA_LEVEL_M, host\.season\);/);
  assert.equal((skin.match(/host\.season\b(?!sReady|sActive)/g) ?? []).length, 1, 'no re-skin line reads the host\'s season past it');
  assert.match(b, /const groundArchive = snowCover \? snowCover\.groundArchive\(climate, pixelSeason\) : getTerrainGroundArchive\(climate, pixelSeason\);/);
  assert.match(b, /await loadGroundSet\(groundArchive, pipeline, snowCover\?\.winterOf\(climate\) \?\? null\);/);
  assert.match(b, /for \(const a of archives\) await loadGroundSet\(a, pipeline, snowCover\?\.winterOf\(near\[groundNear\.indexOf\(a\)\]\) \?\? null\);/);
  assert.match(b, /const fSeason = snowRec \? snowRec\.flat\(f\.x, f\.z, f\.y - SEA_LEVEL_M, pixelSeason\) : pixelSeason;/);
  assert.match(b, /const archive = getNatureArchive\(base, fSeason\);/);   // PIN MOVED (AUDIT PRECIP HOST-7): one law for every wild flat - the re-skin's own (getNatureArchive(f.wild, ...))
  assert.match(b, /const snowSeen = snowRec\?\.done\(models\.length > 0 \|\| dfLocation != null\) \?\? null;[^]*?_snow: snowSeen,/);
  const w = read('src/scenes/world.js');
  assert.match(w, /const snowCover = createSnowCoverHost\(\{ renderer, climateAt, mapHeight: MAP_H, stateOf: \(\) => state, builtOf: \(\) => built, owns: precipLawOn, markReskin: \(key\) => _reskin\.skin\(key\), markRebuild: \(key\) => _reskin\.mark\(key\), now: /);   // LANE-TURN: a lane's turn rebuilt
  assert.match(w, /snowCover\.tick\(\{ px: _sp\.x, py: _sp\.y, dt, arriving: !playerSpawned \}\); renderer\.setSnowFrame\(snowCover\.frame\(\)\);/);
  assert.match(w, /if \(refreshSeason\(\) && !snowCover\.on\) _reskin\.markAll\(\);/);
  assert.match(w, /e\.tex\[k\] = snowCover\.arrayOf\(a\);/);
  assert.equal(w.split('snowCover.drawOf(').length - 1, 4, 'both ground draws and both water lists');
  assert.equal(w.split('snowCover.arrayOf(').length - 1, 8, 'every reader of a pixel\'s set: its ground (both draws), its water (both lists), its shadow, the sea, the ring\'s sea, the border');
  assert.doesNotMatch(w, /renderer\.tileArrays\.get\(p\.groundArchive\)|renderer\.tileArrays\.get\(cell\.groundArchive\)/, 'no reader of the bare set the lane does not upload');
  assert.match(w, /if \(snowCover\.on && snowCover\.buries\(p, lx, lz, h \+ t\[1\]\)\) return null;/);
  assert.match(w, /p\._stride === 1 && p\.tilemapBytes && \(snowCover\.on \|\| p\.season !== SEASON\.Winter\)/);
  assert.match(w, /seasons, siegeFieldsByTown, snowCover, snowfall, standPixelNpcs,/);
  assert.match(b, /seasons, siegeFieldsByTown, snowCover, snowfall, standPixelNpcs,/);
  assert.equal(SNOWPACK.levels.count, 23);
});
