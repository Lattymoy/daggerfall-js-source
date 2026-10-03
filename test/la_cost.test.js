// LA-COST (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look for flickering issues, performance
// improvements and just a complete detailed overhaul to make this insanely better") - THE LANE'S FRAME, PRICED.
//
// Seven findings of the audit, each pinned where it can be proved: the frame blocks of the billboard, decal and
// character programs sent once a stamp (PERF3's terrain law) and the point colours decoded once a change - held to a
// reference renderer that re-sends every block at every draw, on a fake GL that keeps a driver's state, across every
// setter and borrow between draws, and to a law read off the source; the cutout pass's sort by bucket, held to the
// string sort's own order; the flat's sun read once a quad by the lane's billboard vertex shader, run through the GLSL
// evaluator against the fragment read it replaces; the lantern loop's eye vector, x^24 and the glow's gate, and the
// Bayer by its bits, each run against the text it replaced; the contact march eased out of its band; the sea's fog
// on the mesh program the moment it is set; a world set's uniform locations asked of GL once, held to a renderer that
// asks at every install. tools/mutants/la_cost.json is the campaign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import { Renderer, WORLD_FRAME, bbVertexShader } from '../src/render/renderer.js';
import {
  EL_LANE, EL_MESH_FS, EL_BB_FS, EL_BB_VS_EXT, EL_SPEC_GLOSS, EL_CONTACT_FADE_START, powChainGlsl, elDecodeN,
} from '../src/render/enhancedLighting.js';
import { BAYER_GLSL } from '../src/render/orderedDither.js';
import { billboardKey, keyId, sortByKey } from '../src/render/billboardKey.js';
import { AIR_CONTACT_GLSL, AIR_CONTACT_RANGE_FRACTION } from '../src/render/airPass.js';
import { SHADOW_GLSL } from '../src/render/shadowPass.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const R = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 400));
const VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);
let seed = 20260927;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

/** A recording fake GL (el1's shape): every call logged, a uniform's location its NAME. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/**
 * A fake GL that KEEPS A DRIVER'S STATE: a uniform's value belongs to its PROGRAM, set by an upload while that program
 * is bound and held until the next upload to it; a texture binding belongs to its UNIT, per target. A uniform's
 * location is its name - null where no shader attached to the program declares it, as a real GL answers, so the
 * renderer's `if (loc)` guards act as they do on one. Every draw snapshots the bound program's uniforms and the
 * textures on units 0..15: what that draw would read.
 */
function stateGl() {
  let ids = 0, cur = null, active = 33984;
  const units = new Map(), snaps = [];
  let uploads = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, drawingBufferWidth: 320, drawingBufferHeight: 200 };
  for (let u = 1; u < 32; u++) consts[`TEXTURE${u}`] = 33984 + u;
  const declares = (p, name) => (p?.shaders ?? []).some((s) => new RegExp(`^\\s*uniform\\b[^;]*\\b${name}\\b`, 'm').test(s.src ?? ''));
  const snap = () => {
    const u = cur ? [...cur.u.entries()].sort(([a], [b]) => (a < b ? -1 : 1)) : [];
    const t = [];
    for (let i = 0; i < 16; i++) { const m = units.get(33984 + i); t.push(m ? [m.get(3553)?.id ?? null, m.get(35866)?.id ?? null] : [null, null]); }
    snaps.push(JSON.stringify({ p: cur?.id ?? null, u, t }));
  };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      switch (k) {
        case 'getProgramParameter': case 'getShaderParameter': return () => true;
        case 'getAttribLocation': return () => 0;
        case 'getParameter': return () => new Float32Array(4);
        case 'shaderSource': return (sh, src) => { sh.src = src; };
        case 'attachShader': return (p, sh) => { (p.shaders ??= []).push(sh); };
        case 'getUniformLocation': return (p, n) => (declares(p, n) ? n : null);
        case 'useProgram': return (p) => { cur = p; };
        case 'activeTexture': return (u) => { active = u; };
        case 'bindTexture': return (target, tex) => { if (!units.has(active)) units.set(active, new Map()); units.get(active).set(target, tex); };
        case 'drawElements': case 'drawArrays': return () => snap();
        default:
          if (typeof k !== 'string') return undefined;
          if (k.startsWith('create')) return () => ({ id: ++ids, u: new Map() });
          if (k.startsWith('uniform')) {
            return (loc, ...args) => {
              if (loc == null || !cur) return;
              uploads++;
              cur.u.set(loc, JSON.stringify(args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))));
            };
          }
          if (k.toUpperCase() === k) return 1;
          return () => {};
      }
    },
  });
  return { gl, snaps, uploads: () => uploads, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** The point colours as the renderer decoded them before LA-COST1 - once per call, every call (the reference). */
function referencePointColorData(count, raw = false) {
  let out;
  if (this._pointColors) out = count * 3 < this._pointColors.length ? this._pointColors.subarray(0, count * 3) : this._pointColors;
  else {
    const s = this._pointColorScratch;
    for (let i = 0; i < count * 3; i += 3) { s[i] = this._pointColor[0]; s[i + 1] = this._pointColor[1]; s[i + 2] = this._pointColor[2]; }
    out = s.subarray(0, count * 3);
  }
  return this._lane && !raw ? this._lane.decodeN(out, this._pointColorDec, count) : out;
}

const lightsOf = (n, range = 9, dx = 0) => new Float32Array(n * 4).map((_, i) => (i % 4 === 3 ? range : i % 4 === 1 ? 1.5 : ((i >> 2) % 7) * 1.3 - 4 + dx));
const coloursOf = (n, k = 0) => new Float32Array(n * 3).map((_, i) => 0.15 + ((i * 7 + k) % 11) * 0.07);

test('LA-COST1: the point colours are decoded ONCE A CHANGE, not once a program a call - the memo answers exactly elDecodeN of the colours set, its prefix for fewer lights, and decodes again after setPointLights, setFlashLight and a lane swap; the raw read never touches it (mutants: the generation not moved by a setter; the memo not keyed by the count)', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  let decodes = 0;
  const lane = Object.freeze({ ...EL_LANE, decodeN: (src, out, count) => { decodes++; return elDecodeN(src, out, count); } });
  r.setLightingLane(lane);
  const colours = coloursOf(48);
  r.setPointLights(lightsOf(48), new Float32Array([1, 1, 1]), colours);
  r.setLighting(new Float32Array([0.2, 0.2, 0.2]), 0.4, new Float32Array([1, 0.9, 0.8]));
  r.textures.set('210_1', { id: 't' });
  const bb = r.createBillboardBatch(210, 1, { w: 1, h: 2 }, [[0, 0, -3]]);
  const decal = r.createDecalBatch(4), rig = { vao: { id: 'rig' }, count: 3 };
  decodes = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  for (let k = 0; k < 8; k++) r.drawBillboards([bb], R, UP);   // an interior's eight flat calls
  for (let k = 0; k < 3; k++) r.drawDecals(decal, { id: 'atlas' });   // two hung weapons and the blood pool
  for (let k = 0; k < 2; k++) r.drawCharacter(rig, I);
  r.drawTerrain({ vao: {}, indexCount: 6 }, I, {}, {}, 6.4);
  assert.equal(decodes, 1, `one decode for the frame's colours, where every upload decoded them again (${decodes})`);
  const want = elDecodeN(colours, new Float32Array(144), 48);
  assert.deepEqual([...r._pointColorData(48)], [...want], 'the memo answers the decode');
  assert.deepEqual([...r._pointColorData(10)], [...want.subarray(0, 30)], 'fewer lights: the prefix (a colour decodes alone)');
  assert.equal(decodes, 1, '...from the memo');
  // every writer of the colours moves the generation
  r.setFlashLight({ x: 1, y: 2, z: 3, range: 600, color: [0.9, 0.9, 1] });
  const flash = r._pointColorData(48);
  assert.equal(decodes, 2, 'the flash takes a slot: decoded again');
  assert.deepEqual([...flash.subarray(0, 3)], [...elDecodeN(new Float32Array([0.9, 0.9, 1]), new Float32Array(3), 1)], 'the flash first');
  assert.deepEqual([...flash.subarray(3, 6)], [...want.subarray(0, 3)], 'the host\'s after it');
  const colours2 = coloursOf(48, 5);
  r.setPointLights(lightsOf(48), null, colours2);
  assert.deepEqual([...r._pointColorData(48)], [...elDecodeN(colours2, new Float32Array(144), 48)], 'a new list: its own colours');
  assert.equal(decodes, 3);
  colours2[0] = 0.99;   // a host that writes the array in place speaks through the setter - it always had to for the mesh (beginFrame)
  r.setPointLights(lightsOf(48), null, colours2);
  assert.equal(r._pointColorData(48)[0], elDecodeN(colours2, new Float32Array(144), 48)[0], 'the same array set again is decoded again');
  assert.equal(decodes, 4);
  // the shared colour, splatted: the splat decoded
  r.setPointLights(lightsOf(20), new Float32Array([0.5, 0.25, 0.75]));
  const splat = r._pointColorData(20);
  assert.deepEqual([...splat.subarray(0, 6)], [...elDecodeN(new Float32Array([0.5, 0.25, 0.75, 0.5, 0.25, 0.75]), new Float32Array(6), 2)]);
  const before = decodes;
  r._pointColorData(20); r._pointColorData(20, true);
  assert.equal(decodes, before, 'the memo again, and the raw read decodes nothing');
  assert.deepEqual([...r._pointColorData(20, true).subarray(0, 3)], [0.5, 0.25, 0.75], 'raw: the colours as the host gave them (the water, the flat light at the eye)');
  // more lights than were decoded: decoded again
  r._pointColorData(5);
  r.setPointLights(lightsOf(4), new Float32Array([0.5, 0.25, 0.75]));
  r._pointColorData(2);
  const n2 = decodes;
  r._pointColorData(4);
  assert.equal(decodes, n2 + 1, 'a count past the decoded one decodes again');
  // the lane swapped out and back: the classic set takes the colours as given, and the lane decodes afresh
  r.setLightingLane(null);
  assert.deepEqual([...r._pointColorData(4).subarray(0, 3)], [0.5, 0.25, 0.75], 'classic: as given');
  r.setLightingLane(lane);
  const n3 = decodes;
  r._pointColorData(4);
  assert.equal(decodes, n3 + 1, 'the lane back: decoded again, not the classic answer');
  // a wider lane re-allocates the decode's buffer; back on the first lane with nothing decoded between, the memo must
  // not answer from the new, empty buffer - the swap moved the generation
  r.setPointLights(lightsOf(40), null, coloursOf(40, 3));
  const full = [...r._pointColorData(40)];
  r.setLightingLane(Object.freeze({ ...lane, key: 'wider', maxLights: 64 }));
  r.setLightingLane(lane);
  assert.deepEqual([...r._pointColorData(40)], full, 'the decode, not a stale view of a new buffer');
  // the source: every writer of the colours moves the generation, and the memo checks the count and the lane
  const src = read('src/render/renderer.js');
  const body = (name) => { const at = src.indexOf(`\n  ${name}(`); return src.slice(at, src.indexOf('\n  }\n', at)); };
  for (const m of ['setPointLights', 'setFlashLight', 'setLightingLane']) assert.match(body(m), /this\._pointColorGen\+\+;/, `${m} moves the colours' generation`);
  assert.equal((src.match(/this\._pointColors = /g) || []).length, 4, 'the colours\' writers: the constructor and the three above - a fifth must move the generation');
  assert.match(body('_pointColorData'), /this\._pointColorDecGen === this\._pointColorGen && this\._pointColorDecLane === lane && this\._pointColorDecCount >= count/);
});

test('LA-COST1: THE SECOND CALL IN A FRAME SENDS ONLY ITS OWN - a billboard call re-sends its basis, the wind, the spectral and conceal flags and its batches\' size, origin and sway; a decal call its atlas; a character call its model matrix and its ranges\' texture flags - and no unit past 7 is touched: the lane\'s block went up with the first (mutants: a gate dropped; a gate on the wrong stamp)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.setPointLights(lightsOf(48), new Float32Array([1, 0.7, 0.4]));
  r.setLighting(new Float32Array([0.2, 0.2, 0.2]), 0.5, new Float32Array([1, 1, 1]));
  r.setFog('linear', 0, 10, 60, new Float32Array([0.3, 0.3, 0.3]));
  r.textures.set('210_1', { id: 't1' }); r.textures.set('210_2', { id: 't2' });
  const bbs = [r.createBillboardBatch(210, 1, { w: 1, h: 2 }, [[0, 0, -3]]), r.createBillboardBatch(210, 2, { w: 2, h: 3 }, [[1, 0, -4]])];
  bbs[1].sway = 0.5;
  const decal = r.createDecalBatch(4), rig = { vao: { id: 'rig' }, count: 3 };
  const uniforms = () => new Set(calls.filter((c) => c[0].startsWith('uniform')).map((c) => c[1]));
  const highUnits = () => calls.filter((c) => c[0] === 'activeTexture' && c[1] >= 33984 + 8).length;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  const pairs = [
    // merged beside main's HITFLASH1 and WEAPON-MOUNT: a batch's hit flash is its own (uHitFlash), and a decal call
    // says whether it hangs a picture or lays a film (uPicture) - both the call's, beside the atlas
    ['billboards', () => r.drawBillboards(bbs, R, UP), ['uRight', 'uUp', 'uFlatWind', 'uSpectral', 'uConceal', 'uHitFlash', 'uEliteGlow', 'uSize', 'uOrigin', 'uSway']],   // ELITE FOES: a batch's glow is its own too, as the flash is
    ['decals', () => r.drawDecals(decal, { id: 'atlas' }), ['uPicture']],
    ['a character', () => r.drawCharacter(rig, I), ['uModel', 'uTex', 'uUseTex', 'uAlphaCut']],
  ];
  const counts = [];
  for (const [what, draw, own] of pairs) {
    calls.length = 0; draw();
    const first = calls.length, firstU = uniforms();
    assert.ok(firstU.has('uPointLights') && firstU.has('uELExposure') && firstU.has('uCasterOf') && firstU.has('uSunVP'), `${what}: the first call of the frame sends the block`);
    assert.ok(highUnits() > 0, `${what}: ...and binds the lane's images`);
    calls.length = 0; draw();
    assert.deepEqual([...uniforms()].sort(), [...own].sort(), `${what}: the second sends its own and nothing of the frame's`);
    assert.equal(highUnits(), 0, `${what}: ...and binds no lane image`);
    counts.push(`${what} ${first} -> ${calls.length}`);
  }
  // the numbers the bible quotes: GL calls a call, the frame's first against the rest (LA-AUDIT F5: compared, not counted)
  // TV1 (2026-09-28): +2 on every first call - the frame's focus (uFocus, render/fogGlsl.js FOCUS_GLSL) rides the fog's
  // upload, and the cascades' origin (uSunOrigin, render/shadowPass.js) the shadow block's
  // merged beside DW-F: the billboard block carries the water column's switch and sampler (two more)
  // PROF4 (bible/06-Systems/Professions-Arc.md 25): and the felled tree's tip, set standing (one more)
  // ELITE FOES: and a batch's glow (uEliteGlow, one more on the billboards' every call)
  // DISSOLVE (the 2026-10-02 audit): and the burn, set whole (one more - a reset that sends nothing left the last burning
  // flat's share live under every flat after it)
  // ARENA5: and a batch's wash, set white (one more - a washed crowd batch's colour must not ride onto the next frame's flats)
  assert.deepEqual(counts, ['billboards 103 -> 29', 'decals 85 -> 12', 'a character 86 -> 13']);
  // ...and the next frame sends them all again
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  calls.length = 0; r.drawBillboards(bbs, R, UP);
  assert.ok(uniforms().has('uPointLights'), 'a new frame, a new block');
});

test('LA-COST1: EVERY DRAW READS WHAT IT READ WHEN EVERY CALL RE-SENT THE BLOCK - on a fake GL that keeps a driver\'s state, a frame of billboard, decal, character, terrain and mesh draws with every setter, borrow and seam between them (the sea\'s fog, the water column over a flagged flat, the fog, the light, the moon, the trilight, the lamps, the flash, the indirect, the exposure, the contact and glow doors, a moved sun, the sprite pass, the viewmodel, the studio, a foreign pass on every unit, a texture upload, the air pass off and on, the resolve, a panel, the lane swapped out and in) snapshots the bound program\'s every uniform and units 0..15 at each draw - equal, draw for draw, to a renderer that re-sends every block at every draw and decodes the colours every time (mutants: any stamp site dropped)', () => {
  const run = (reference) => {
    const { gl, snaps, uploads, canvas } = stateGl();
    const r = new Renderer(canvas);
    if (reference) {
      r._pointColorData = referencePointColorData;
      for (const m of ['drawBillboards', 'drawDecals', 'drawCharacter', 'drawTerrain']) {
        const f = r[m].bind(r);
        r[m] = (...a) => { r._frameStamp++; return f(...a); };   // every block, every draw - the old calls
      }
    }
    r.setLightingLane(EL_LANE); r.setAir(true);
    const tex = (k) => { const t = gl.createTexture(); r.textures.set(k, t); return t; };
    tex('1_1'); tex('210_1'); tex('210_2'); tex('380_0');
    const atlas = gl.createTexture(), arr = gl.createTexture(), tmap = gl.createTexture();
    const mesh = { vao: gl.createVertexArray(), buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] };
    const bbA = [r.createBillboardBatch(210, 1, { w: 1, h: 2 }, [[0, 0, -3]]), r.createBillboardBatch(210, 2, { w: 2, h: 3 }, [[1, 0, -4]])];
    const bbB = [r.createBillboardBatch(380, 0, { w: 0.5, h: 0.5 }, [[-1, 1, -2]])];
    bbA[1].sway = 0.4;
    bbA[1].dwColumn = true; bbB[0].dwColumn = true;   // AUDIT PRE-MERGE 0928 M3: flats in a carved sea's column - one call ends on one and the next opens on one, so the switch a draw reads rides from call to call
    const column = { seaY: 34, topColor: [0.1, 0.3, 0.35, 0.42], topVision: 18, surfaceScroll: [0.2, 0.1], surfaceTexture: gl.createTexture(), origin: [0, 0, 0] };
    const decal = r.createDecalBatch(4), rig = { vao: gl.createVertexArray(), count: 3 };
    const surface = { vao: gl.createVertexArray(), indexCount: 6 };
    const all = () => {
      r.drawMesh(mesh, I); r.drawTerrain(surface, I, arr, tmap, 6.4); r.drawCharacter(rig, I);
      r.drawDecals(decal, atlas); r.drawBillboards(bbA, R, UP); r.drawBillboards(bbB, new Float32Array([0.8, 0, 0.6]), UP); r.drawCharacter(rig, I);
    };
    r.setPointLights(lightsOf(30), null, coloursOf(30));
    r.setLighting(new Float32Array([0.2, 0.18, 0.16]), 0.6, new Float32Array([1, 0.9, 0.8]));
    r.setFog('linear', 0, 20, 90, new Float32Array([0.3, 0.32, 0.35]));
    r.setIndirectLight([0, 1.7, 9], 6, new Float32Array([0.1, 0.1, 0.12]));
    r.setFlatWind([1.2, -0.4, 3, 0.7]);
    r.setCloudShadow({ map: gl.createTexture(), rect: [0, 0, 100, 100] });
    for (let frame = 0; frame < 2; frame++) {
      r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
      r.setWaterColumn(column);   // AUDIT PRE-MERGE 0928 M3: as the world host sets it after beginFrame (beginDeepWatersFrame)
      all(); all();
      r.setWaterFog(new Float32Array(20).map((_, i) => (i === 0 ? 1 : 0.05 * (i + frame)))); all();
      r.setFog('exp', 0.02, 0, 0, new Float32Array([0.1, 0.12, 0.2])); all();
      r.setLighting(new Float32Array([0.05, 0.05, 0.07]), 0.2, new Float32Array([0.9, 0.8, 1])); all();
      r.setMoonlight({ scale: 0.3, dir: [0.2, 0.9, 0.1], color: [0.6, 0.7, 1] }); all();
      r.setAmbientTrilight({ sky: [0.3, 0.3, 0.4], ground: [0.1, 0.08, 0.05] }); all();
      r.setPointLights(lightsOf(12, 7, 0.5), new Float32Array([1, 0.7, 0.4])); all();
      r.setFlashLight({ x: 0, y: 30, z: 0, range: 700, color: [0.8, 0.8, 1] }); all();
      r.setIndirectLight([0.5, 1.7, 8], 5, new Float32Array([0.2, 0.2, 0.1])); all();
      r.setExposure(1.7); all();
      r.setContact(false); all(); r.setContact(true); all();
      r.setVolumetrics(false); all(); r.setVolumetrics(true); all();
      r.setLightDir(new Float32Array([-0.4, 0.7, 0.3])); all();
      r.renderCharacterSprite(rig, I, PROJ, I, 8, 8, { lensLocal: true, viewmodelLight: [0.5, 0.4, 0.3] }); all();
      r.renderCharacterSprite(rig, I, PROJ, I, 8, 8); all();
      r.renderCharacterSpriteImage(rig, I, PROJ, I, 8, 8); all();   // the studio: the bare eye on its unit
      gl.useProgram(gl.createProgram());   // a foreign pass: its own program, and its own textures on every unit
      for (let u = 0; u < 16; u++) { gl.activeTexture(33984 + u); gl.bindTexture(3553, gl.createTexture()); gl.bindTexture(35866, gl.createTexture()); }
      r.markForeignPass(); all();
      r.uploadEmissionTexture(99, frame, { width: 1, height: 1, colors: new Uint8Array(4) }); all();
      r.setAir(false); all(); r.setAir(true); all();
      r.drawScreenQuad(null, { x: 0, y: 0, w: 10, h: 10 }); all();   // the resolve, and world draws after it
      r.panelFrame({ proj: PROJ, view: VIEW, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 64, h: 64 } }, () => all()); all();
      r.setLightingLane(null); all(); r.setLightingLane(EL_LANE); all();
    }
    return { snaps, uploads: uploads() };
  };
  const got = run(false), want = run(true);
  assert.equal(got.snaps.length, want.snaps.length, 'the same draws');
  assert.ok(got.snaps.length > 300, `every draw snapshotted (${got.snaps.length})`);
  for (let i = 0; i < want.snaps.length; i++) {
    if (got.snaps[i] === want.snaps[i]) continue;
    const a = JSON.parse(got.snaps[i]), b = JSON.parse(want.snaps[i]);
    const au = new Map(a.u), bu = new Map(b.u);
    const stale = [...bu.keys()].filter((k) => au.get(k) !== bu.get(k));
    const units = b.t.map((x, u) => (JSON.stringify(x) !== JSON.stringify(a.t[u]) ? u : -1)).filter((u) => u >= 0);
    assert.fail(`draw ${i} (program ${b.p}) read a stale block - uniforms ${stale.join(', ') || 'none'}, units ${units.join(', ') || 'none'}`);
  }
  assert.ok(got.uploads < want.uploads * 0.75, `and it sent far fewer uniforms to do it (${got.uploads} against ${want.uploads})`);
});

/** The text of the `{...}` block that opens at the first `{` at or after `from` in `s`, braces matched. */
function blockAt(s, from) {
  const open = s.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return s.slice(open, i + 1);
  }
  throw new Error('unbalanced');
}
/** The Renderer's methods by name - each from its two-space head to the next head - with comments taken out. */
function rendererMethods() {
  const src = read('src/render/renderer.js');
  const cls = src.slice(src.indexOf('export class Renderer {'));
  const heads = [...cls.matchAll(/^ {2}(?:(?:get|set|static|async) )?([_$A-Za-z][\w$]*)\([^)]*\)\s*\{/gm)];
  const code = (t) => t.split('\n').filter((l) => !/^\s*(\*|\/\*\*|\/\/)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
  const methods = new Map();
  heads.forEach((m, i) => methods.set(m[1], code(cls.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : cls.length))));
  return methods;
}

test('LA-COST1: THE LAW, READ OFF THE SOURCE - every field the four gated frame blocks read (the billboard\'s, the decal\'s, the character\'s, PERF3\'s terrain\'s, and the helpers they call) is a known input, and every method that writes an input moves the stamp, or calls one that does, or is a borrow that forgets the one block it draws, or runs inside beginFrame before its stamp - so a new setter cannot land without its word (mutants: a setter\'s stamp dropped; a new read not listed)', () => {
  const methods = rendererMethods();
  const gates = { drawBillboards: '_bbFrameStamp', drawDecals: '_dFrameStamp', drawCharacter: '_cFrameStamp', drawTerrain: '_tFrameStamp' };
  const blocks = Object.entries(gates).map(([m, stamp]) => {
    const body = methods.get(m);
    const at = body.indexOf(`if (this.${stamp} !== this._frameStamp) {`);
    assert.ok(at > 0, `${m} gates its block on ${stamp}`);
    const block = blockAt(body, at);
    assert.match(block, new RegExp(`^\\{\\n\\s+this\\.${stamp} = this\\._frameStamp;`), `${m}: the block takes the stamp first`);
    return block;
  });
  // the helpers the blocks call, and theirs
  const helpers = ['_uploadFog', '_uploadEl', '_c3', '_pointColorData', '_airGlows', '_scatterGain', '_uploadAdapt', '_uploadNoContact', '_uploadClusters', '_adaptOne'];
  const reads = new Set();
  for (const t of [...blocks, ...helpers.map((h) => methods.get(h))]) for (const m of t.matchAll(/this\.(_[A-Za-z]\w*)\b(?!\s*\()/g)) reads.add(m[1]);
  // THE INPUTS: the values a block uploads, and the state that decides what it binds
  const INPUTS = ['_proj', '_view', '_lightDir', '_ambient', '_ambientTri', '_sunScale', '_sunColor', '_moonDir', '_moonScale', '_moonColor', '_clockLit',
    '_pointLights', '_pointColors', '_pointColor', '_indirect', '_indirectColor', '_fogMode', '_fogDensity', '_fogRange', '_fogColor', '_camPos', '_dwFog',
    '_lane', '_exposure', '_air', '_shadows', '_contactWanted', '_volumetricsWanted', '_spriteDepth', '_studioDepth', '_panelSaved',
    '_clustersLive', '_clusterRect', '_clusterZ', '_camFwd', '_clusterTex', '_decalLights',
    '_focus',   // TV1: the point the fog measures from (setFocus stamps)
    '_dwColumn'];   // merged beside DW-F: the water column's frame (setWaterColumn stamps; beginFrame clears it)
  // NOT INPUTS: the programs' location tables (re-looked-up by _installWorldSet, which forgets the blocks), scratch the
  // block writes before it reads, the memo's own keys (the first test), the gates' stamps, the GL-state shadows - and
  // the automap's four, which _uploadFog sends only to a program that declares them: the mesh's, never these four
  // (the locations are null on every one of them, classic and lane - asked of a GL that answers as a driver does)
  const AUTOMAP = ['_clipY', '_automapMode', '_automapWaterLevel', '_automapWaterColor'];
  const NOT = ['_bbFog', '_charFog', '_terrainFog', '_decal', '_el', '_decA', '_decB', '_decC', '_pointColorDec', '_pointColorScratch',
    '_pointColorGen', '_pointColorDecGen', '_pointColorDecLane', '_pointColorDecCount', '_adaptOneTex', '_tex0Bound', '_activeUnit',
    '_bbFrameStamp', '_dFrameStamp', '_cFrameStamp', '_tFrameStamp', '_frameStamp', ...AUTOMAP,
    '_bbColumnOn', '_dwCamFwd',   // merged beside DW-F: the column switch's GL-state shadow, and the camera-forward scratch
    '_bbTipOn',   // PROF4: the felled tree's tip, the same kind of GL-state shadow
    '_bbDissolveOn',   // DISSOLVE: the burn's switch, the same kind of GL-state shadow
    '_bbTintOn'];   // ARENA5: a batch's wash (the arena crowd's half in a banner's colours), the same kind of GL-state shadow
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  for (const lane of [null, EL_LANE]) {
    r.setLightingLane(lane);
    for (const t of ['_bbFog', '_charFog', '_terrainFog', '_decal']) for (const k of ['clipY', 'amMode', 'amWaterLevel', 'amWaterColor']) assert.equal(r[t][k], null, `${lane ? 'lane' : 'classic'} ${t}.${k}: the gated programs declare no automap uniform`);
    assert.ok(r._solidFog.clipY, 'the mesh does - the question is asked of real shader text');
  }
  const unknown = [...reads].filter((f) => !INPUTS.includes(f) && !NOT.includes(f));
  assert.deepEqual(unknown, [], 'a block reads a field this law has not classed - an input (and its writers stamp) or not');
  assert.deepEqual(INPUTS.filter((f) => !reads.has(f)), [], 'every input listed is one the blocks read - the list is the source\'s, not a guess');
  // THE WRITERS
  const W = new RegExp(`this\\.(?:${INPUTS.join('|')})\\b(?:\\[[^\\]]*\\])?\\s*(?:=(?!=)|\\+\\+|--|\\+=|-=)|this\\.(?:${INPUTS.join('|')})\\.(?:set|fill)\\(`);
  const stamping = new Set([...methods].filter(([, b]) => /this\._frameStamp\+\+/.test(b)).map(([n]) => n));
  const callsStamping = (b) => [...stamping].some((n) => b.includes(`this.${n}(`));
  // the setters that must stamp themselves, by name - the list LA-COST1 wrote the word into
  for (const n of ['setExposure', 'setContact', 'setVolumetrics', '_syncAir', '_forgetTextureShadows', 'setMoonlight', 'setAmbientTrilight', 'setFog', 'setWaterFog', 'setPointLights', 'setFlashLight', 'setIndirectLight', 'setLightDir', 'beginFrame', 'endPanelFrame', 'renderCharacterSpriteImage']) {
    assert.ok(stamping.has(n), `${n} moves the stamp`);
  }
  const BIRTH = new Set(['constructor']);
  const IN_BEGIN_FRAME = new Set(['_renderPasses', '_buildClusters']);   // run inside beginFrame, before its own stamp
  const FORGETS_ITS_BLOCK = new Set(['_renderCharacterSprite', 'renderCharacterSprite']);   // borrows that draw the character program alone
  const writers = [...methods].filter(([, b]) => W.test(b)).map(([n]) => n);
  assert.ok(writers.length >= 20, `the law sees the writers (${writers.join(', ')})`);
  for (const n of writers) {
    const b = methods.get(n);
    if (BIRTH.has(n)) continue;
    if (IN_BEGIN_FRAME.has(n)) {
      const callers = [...methods].filter(([, t]) => t.includes(`this.${n}(`)).map(([c]) => c);
      assert.ok(callers.length > 0 && callers.every((c) => c === 'beginFrame' || c === '_beginLane'), `${n} runs inside beginFrame alone (${callers})`);
      continue;
    }
    if (n === '_installWorldSet') {
      assert.match(b, /this\._tFrameStamp = -1;\n\s+this\._bbFrameStamp = -1; this\._dFrameStamp = -1; this\._cFrameStamp = -1;/, 'the set\'s programs are new: all four blocks forgotten');
      assert.match(b, /this\._forgetTextureShadows\(\);/);
      continue;
    }
    if (FORGETS_ITS_BLOCK.has(n)) {
      if (n === '_renderCharacterSprite') {
        assert.equal((b.match(/this\._cFrameStamp = -1;/g) || []).length, 2, 'the sprite pass forgets the character block on the way in and on the way out');
        assert.ok(b.indexOf('this._cFrameStamp = -1;') < b.indexOf('this.drawCharacter(') && b.lastIndexOf('this._cFrameStamp = -1;') > b.indexOf('finally {'), '...in, before its draw; out, in its finally');
        assert.equal((b.match(/this\.draw[A-Z]\w*\(/g) || []).join(), 'this.drawCharacter(', 'and it draws the character program alone');
      } else {
        const t = b.indexOf('try {'), f = b.indexOf('finally {');
        assert.ok(t > 0 && b.indexOf('this._renderCharacterSprite(') > t && f > t, `${n}: its borrow wraps the sprite pass, which forgets the block`);
      }
      continue;
    }
    // stamps itself, or calls a method that does - or, a private one, runs only inside callers that do (the grid's
    // textures, made at the lane's install: no draw stands between)
    const covered = (m) => stamping.has(m) || callsStamping(methods.get(m));
    const callers = [...methods].filter(([c, t]) => c !== n && t.includes(`this.${n}(`)).map(([c]) => c);
    assert.ok(covered(n) || (n.startsWith('_') && callers.length > 0 && callers.every(covered)), `${n} writes a gated block's input and does not move the stamp`);
  }
  // ...and the only draw inside a borrow of the light is the character's (the studio's and the viewmodel's)
  for (const n of ['renderCharacterSpriteImage', 'renderCharacterSprite']) assert.doesNotMatch(methods.get(n), /this\.draw(?!Character)[A-Z]\w*\(/, `${n} draws no other gated program under its borrow`);
  assert.match(methods.get('renderCharacterSpriteImage'), /if \(studio\) this\._studioDepth--;\s*\n\s*if \(studio\) this\._frameStamp\+\+;/, 'the studio put the bare eye on a unit every lane program reads: every block binds its own again');
});

test('LA-COST2: THE CUTOUT PASS SORTS BY BUCKET, IN THE STRING SORT\'S OWN ORDER - over 300 random passes (a handful of keys or hundreds, records that carry their frame, animated frames, three archives) sortByKey leaves every batch where the stable `(a, b) => (a._bbKey < b._bbKey ? -1 : a._bbKey > b._bbKey ? 1 : 0)` sort put it - keys ascending as strings, one key\'s batches in the order they came, since an exact depth tie keeps its FIRST-drawn flat and so the order is the picture; the id is interned with the key and re-minted with it; the renderer binds each texture once, in that order (mutants: the buckets left in first-seen order; the placement unstable; the slot table not reset between passes)', () => {
  const cmp = (a, b) => (a._bbKey < b._bbKey ? -1 : a._bbKey > b._bbKey ? 1 : 0);
  for (let pass = 0; pass < 300; pass++) {
    const n = 1 + Math.floor(rnd() * (pass % 3 === 0 ? 900 : 60)), k = 1 + Math.floor(rnd() * (pass % 2 ? 8 : 300));
    const list = [];
    for (let i = 0; i < n; i++) {
      const b = { archive: 500 + Math.floor(rnd() * 3), record: rnd() < 0.2 ? `${Math.floor(rnd() * k)}#${Math.floor(rnd() * 3)}` : Math.floor(rnd() * k), frame: rnd() < 0.2 ? Math.floor(rnd() * 4) : null, i };
      billboardKey(b);
      list.push(b);
    }
    const want = [...list].sort(cmp).map((b) => b.i);
    assert.deepEqual(sortByKey(list).map((b) => b.i), want, `pass ${pass}: ${n} batches over keys of ${k} records`);
  }
  // the id: one per distinct key, minted with the key and re-minted with it
  const a = { archive: 504, record: 3 }, b = { archive: 504, record: 3 }, c = { archive: 504, record: 30 };
  billboardKey(a); billboardKey(b); billboardKey(c);
  assert.equal(a._bbKeyId, b._bbKeyId, 'one key, one id'); assert.notEqual(a._bbKeyId, c._bbKeyId);
  assert.equal(keyId('504_3'), a._bbKeyId, 'the intern table answers the same id');
  a.record = 30; billboardKey(a);
  assert.equal(a._bbKeyId, c._bbKeyId, 're-minted with the key');
  // a key minted without its id (a batch dressed by hand) interns at the sort; a pass of one is itself
  const hand = [{ _bbKey: 'zz_9', i: 0 }, { _bbKey: 'aa_1', i: 1 }, { _bbKey: 'zz_9', i: 2 }];
  assert.deepEqual(sortByKey(hand).map((x) => x.i), [1, 0, 2]);
  const one = [{ _bbKey: 'q', i: 0 }];
  assert.equal(sortByKey(one), one);
  // the renderer: each key's two textures bound once, the keys in string order
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r._bbCullOff = true;
  const made = [];
  for (const [archive, record] of [[504, 9], [504, 10], [182, 2], [504, 9], [182, 2], [380, 0]]) {
    const key = `${archive}_${record}`;
    if (!r.textures.has(key)) r.textures.set(key, { id: key });
    made.push(r.createBillboardBatch(archive, record, { w: 1, h: 2 }, [[made.length, 0, -3]]));
  }
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]));
  calls.length = 0;
  r.drawBillboards(made, R, UP);
  const bound = calls.filter((x) => x[0] === 'bindTexture' && typeof x[2]?.id === 'string').map((x) => x[2].id);
  assert.deepEqual(bound, ['182_2', '380_0', '504_10', '504_9'], 'one bind a key, in the string sort\'s order (\'504_10\' before \'504_9\')');
  assert.equal(calls.filter((x) => x[0] === 'drawElements').length, 6, 'every batch drawn');
});

test('LA-COST3: THE FLAT\'S SUN IS READ ONCE A QUAD - the lane\'s billboard vertex shader is BB_VS whole with the lane\'s additions (the head before main, the read after every line that places the corner), and run through the GLSL evaluator it hands all four corners of a quad the value the fragment read took at the flat\'s base - sunShadowSoftAt(vBBBase + (0, 0.5, 0), up), to the bit in fp32 - lit, shadowed and in a penumbra, still or leaning in the wind; at night it reads no tap; the classic set and the shadow and air passes keep BB_VS, and the lane\'s program is built from the composed text (mutants: the read at the corner, not the base; the cheap tap; the night gate gone)', () => {
  const classic = bbVertexShader(), lane = bbVertexShader(EL_BB_VS_EXT);
  assert.equal(lane.replace(`${EL_BB_VS_EXT.head}\n`, '').replace(`${EL_BB_VS_EXT.main}\n`, ''), classic, 'the classic text, whole and in order, and the two additions');
  assert.ok(lane.indexOf(EL_BB_VS_EXT.head) < lane.indexOf('void main() {') && lane.indexOf(EL_BB_VS_EXT.main) > lane.indexOf('gl_Position = uProj * uView * vec4(world, 1.0);'), 'the head before main, the read after the last line that places the corner');
  assert.match(EL_BB_VS_EXT.head, /flat out float vBBSunVis;/); assert.match(EL_BB_FS, /flat in float vBBSunVis;/);
  assert.match(EL_BB_VS_EXT.head, /precision mediump int;/, 'the int precision a fragment shader declares by default - a uniform both stages declare must agree, or a real GL will not link (the probe found it)');
  assert.ok(EL_BB_VS_EXT.head.includes(SHADOW_GLSL));
  assert.doesNotMatch(EL_BB_FS.replace(SHADOW_GLSL, ''), /sunShadow(?:Soft)?At\(/, 'the fragment reads no sun map');
  // run it: a sun map as a depth field of the texel, so a quad can land lit, dark or on an edge
  let taps = 0;
  const texture = (name, P) => {
    if (name !== 'uSunShadow') return [1, 1, 1, 1];
    taps++;
    const depth = 0.775 + 0.02 * Math.sin(P[0] * 1900) * Math.cos(P[1] * 1700);
    return P[3] <= depth ? 1 : 0;
  };
  const ortho = (s) => [1 / s, 0, 0, 0, 0, 0, 1 / s, 0, 0, 1 / s, 0, 0, 0, 0, 0.5, 1];
  const U = {
    uProj: Array.from(PROJ), uView: Array.from(VIEW), uRight: [1, 0, 0], uUp: [0, 1, 0], uSize: [1.25, 2.5], uFlatWind: [1.5, -0.5, 7, 0.8],
    uCamPos: [0, 1.7, 9], uBBSun: [0.4, 0.38, 0.3], uSunShadowParams: [12, 48, 240, 1], uSunTexel: [0.0117, 0.0469, 0.2344, 0],
    uSunVP: [ortho(12), ortho(48), ortho(240)], gl_Position: [0, 0, 0, 0], texture,
  };
  const corners = [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]];
  const fs = glslFunctions(EL_BB_FS, U, { fp32: true });
  const seen = new Set();
  for (let q = 0; q < 60; q++) {
    const aCenter = [Math.round((rnd() * 60 - 30) * 64) / 64, Math.round(rnd() * 2 * 64) / 64, Math.round((rnd() * 60 - 40) * 64) / 64];
    const uOrigin = [Math.round(rnd() * 8 * 64) / 64, 0, Math.round(rnd() * 8 * 64) / 64], uSway = q % 2 ? 0.7 : 0;
    const vis = [];
    let vBBBase = null;
    for (const aCorner of corners) {
      const f = glslFunctions(lane, { ...U, aCenter, aCorner, uOrigin, uSway }, { fp32: true });
      f.main();
      vis.push(f.globals.vBBSunVis);
      vBBBase = f.globals.vBBBase;
    }
    assert.ok(vis.every((v) => v === vis[0]), `quad ${q}: the four corners agree (${vis})`);
    const base = vBBBase.map((x, i) => Math.fround(x + [0, 0.5, 0][i]));   // EL_BB_FS's `vec3 base = vBBBase + vec3(0.0, 0.5, 0.0);`
    assert.equal(vis[0], fs.sunShadowSoftAt(base, [0, 1, 0], U.uSize[1]), `quad ${q}: the fragment's old read at the base, to the bit (AUDIT FLICKER S1: with the flat's height)`);
    seen.add(vis[0] === 1 ? 'lit' : vis[0] === 0 ? 'dark' : 'edge');
  }
  assert.deepEqual([...seen].sort(), ['dark', 'edge', 'lit'], 'the quads landed lit, dark and on an edge - the law was asked of all three');
  // night: the gate is the vertex stage's too
  taps = 0;
  const night = glslFunctions(lane, { ...U, uBBSun: [0, 0, 0], aCenter: [1, 0, -3], aCorner: [0.5, 0.5], uOrigin: [0, 0, 0], uSway: 0 }, { fp32: true });
  night.main();
  assert.equal(night.globals.vBBSunVis, 1); assert.equal(taps, 0, 'at night no map is read, at a corner or a fragment');
  // the renderer: the classic set, the shadow pass and the air pass take BB_VS; the lane's billboard program the composed text
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const sources = calls.filter((x) => x[0] === 'shaderSource').map((x) => x[2]);
  assert.equal(sources.filter((s) => s === lane).length, 1, 'the lane\'s billboard program, once');
  assert.ok(sources.filter((s) => s === classic).length >= 3, 'BB_VS for the classic set, the shadow pass\'s flats and the air pass\'s emitters');
  const src = read('src/render/renderer.js');
  assert.match(src, /bb: this\._buildProgram\(bbVertexShader\(src\.bbVs\), src\.bbFs\),/);
  assert.match(src, /vs: \{ mesh: VS, bb: BB_VS, terrain: TERRAIN_VS, char: CHAR_VS \}/, 'the shadow pass: BB_VS');
  assert.match(src, /vs: \{ mesh: VS, bb: BB_VS \}, glsl:/, 'the air pass: BB_VS');
  assert.equal(EL_LANE.bbVs, EL_BB_VS_EXT);
});

/** The lane's mesh FS with the contact march stubbed (a uniform answer, and a count of the marches run) - the march is
 *  airPass.js's and pinned there; what is pinned here is the lantern loop around it. */
const CONTACT_STUB = `
uniform float uStubContact;
float contactCalls = 0.0;
float contactShadow(vec3 wp, vec3 n, vec3 toLight, float dist) { contactCalls += 1.0; return uStubContact; }
`;
const withStub = (src) => { assert.ok(src.includes(AIR_CONTACT_GLSL)); return src.replace(AIR_CONTACT_GLSL, CONTACT_STUB); };
/** Swap one exact text for another, once - or fail, so a transform that stops matching cannot pass vacuously. */
const swap = (src, a, b) => { assert.equal(src.split(a).length, 2, `the text to swap stands once: ${a.slice(0, 60)}`); return src.replace(a, b); };
const litBindings = (lights, colours, casters, extra = {}) => ({
  uPointCount: lights.length, uPointLights: [...lights, ...Array.from({ length: 48 - lights.length }, () => [0, 0, 0, 0])],
  uPointColors: [...colours, ...Array.from({ length: 48 - colours.length }, () => [0, 0, 0])], uCasterOf: [...casters, ...Array(48 - casters.length).fill(-1)],
  uClusterOn: 0, uCamPos: [0.3, 1.7, 6], uStubContact: 0.15, uELExposure: 1.4, uELScatter: 0, uIndirect: [0, 0, 0, 0], uIndirectColor: [0, 0, 0],
  uFogColor: [0.2, 0.22, 0.25], uFogMode: 1, uFogDensity: 0, uFogRange: [4, 40], uDwFog: Array.from({ length: 5 }, () => [0, 0, 0, 0]),
  uPointShadowParams: Array.from({ length: 8 }, () => [0, 0, 0, 0]), uShadowIndex: Array(8).fill(-1), gl_FragCoord: [10.5, 20.5, 0.5, 1],
  texture: (name) => (name === 'uAdapt' ? [0.55, 0.55, 0.55, 1] : [1, 1, 1, 1]), texelFetch: () => [0, 0, 0, 0], ...extra,
});

test('LA-COST4: THE LANTERN LOOP\'S ARITHMETIC, EXACTLY - (a) x^EL_SPEC_GLOSS by repeated squaring is x^24 = x^16 * x^8, generated from the constant, within a few float32 roundings of Math.pow over [0, 1] for every gloss to 64; (b) the eye vector hoisted out of the loop gives every fragment the loop and the glint it gave with the vector inside, to the bit; (c) the glow gated on uELScatter answers what the ungated glow answered, to the bit, off and on; (d) the Bayer by its bits is the table, all sixteen cells and every pixel of a sweep, to the bit (mutants: a squaring dropped; the chain not from the gloss; the eye vector unguarded; the gate inverted; a bit of the Bayer moved)', () => {
  // (a) the chain, for every gloss a lane might set, against the true power
  assert.equal(EL_SPEC_GLOSS, 24);
  assert.equal(powChainGlsl('elSpecLobe', 24), 'float elSpecLobe(float x) { float x2 = x * x; float x4 = x2 * x2; float x8 = x4 * x4; float x16 = x8 * x8; return x16 * x8; }');
  assert.ok(EL_MESH_FS.includes(powChainGlsl('elSpecLobe', EL_SPEC_GLOSS)), 'the lane carries the gloss\'s chain');
  assert.throws(() => powChainGlsl('f', 0)); assert.throws(() => powChainGlsl('f', 2.5));
  for (let n = 1; n <= 64; n++) {
    const f64 = glslFunctions(powChainGlsl('f', n)), f32 = glslFunctions(powChainGlsl('f', n), {}, { fp32: true });
    let worst = 0;
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      assert.ok(Math.abs(f64.f(x) - x ** n) <= 1e-12 * Math.max(1, x ** n), `n ${n}, x ${x}: the chain is x^n`);
      const want = Math.pow(Math.fround(x), n);
      worst = Math.max(worst, Math.abs(f32.f(x) - want) / Math.max(want, 1e-30) * (want > 1e-30 ? 1 : 0));
    }
    // each squaring doubles the error it is handed and rounds once more: under n roundings (2^-24 each) of the true
    // power - where GLSL's pow() is only held to exp2(y * log2(x))'s, a log2 good to 2^-21 times the 24, about 8e-6
    assert.ok(worst < n * 2 ** -24, `n ${n}: within n roundings of the true power in float32 (${worst})`);
  }
  // (b) the eye vector: the loop as it stood (the vector normalised again inside, for each light) against the hoist
  const hoist = withStub(EL_MESH_FS);
  const inside = swap(swap(hoist, '  vec3 V = cellCount > 0 ? normalize(uCamPos - wp) : vec3(0.0);\n', ''), '    vec3 H = normalize(Ln + V);\n', '    vec3 V = normalize(uCamPos - wp);\n    vec3 H = normalize(Ln + V);\n');
  const lights = [[0, 2.6, -2, 9], [3, 2, 1, 7], [-4, 2.4, -1, 12], [0.5, 1.1, 2, 4]];
  const colours = [[1, 0.72, 0.42], [0.8, 0.8, 1], [1, 0.5, 0.3], [0.2, 1, 0.4]];
  let checked = 0;
  for (let k = 0; k < 40; k++) {
    const B = litBindings(lights, colours, [-1, -2, -1, -1]);
    const a = glslFunctions(hoist, B, { fp32: true }), b = glslFunctions(inside, B, { fp32: true });
    const wp = [rnd() * 10 - 5, rnd() * 3, rnd() * 8 - 5], nrm = [rnd() - 0.5, rnd(), rnd() - 0.5], wet = k % 3 === 0 ? 0.8 : 0;
    const ga = { value: [0, 0, 0] }, gb = { value: [0, 0, 0] };
    assert.deepEqual(a.elPointLitWet(wp, nrm, wet, ga), b.elPointLitWet(wp, nrm, wet, gb), `fragment ${k}: the lit sum`);
    assert.deepEqual(ga.value, gb.value, `fragment ${k}: the glint`);
    checked++;
  }
  assert.equal(checked, 40);
  // (c) the glow's gate: elFinish with the gate and without it, the fog glowing and not
  const ungated = swap(EL_MESH_FS, '  if (uELScatter > 0.0) {\n    vec3 glow = elTonemapRGB(elInScatter(wp) * ex);\n    if (glow.r + glow.g + glow.b > 0.0) col = elEncode(elDecode(col) + glow);\n  }\n',
    '  vec3 glow = elTonemapRGB(elInScatter(wp) * ex);\n  if (glow.r + glow.g + glow.b > 0.0) col = elEncode(elDecode(col) + glow);\n');
  for (const scatter of [0, 0.02]) {
    for (let k = 0; k < 20; k++) {
      const B = litBindings(lights, colours, [-1, -1, -1, -1], { uELScatter: scatter, gl_FragCoord: [k + 0.5, 3 * k + 0.5, 0.5, 1] });
      const lit = [rnd() * 2, rnd(), rnd() * 0.5], wp = [rnd() * 10 - 5, rnd() * 3, rnd() * 20 - 15];
      assert.deepEqual(glslFunctions(EL_MESH_FS, B, { fp32: true }).elFinish(lit, wp), glslFunctions(ungated, B, { fp32: true }).elFinish(lit, wp), `scatter ${scatter}, fragment ${k}`);
    }
  }
  // (d) the Bayer: the table it replaced, cell by cell and over a sweep of pixels, negative and far ones too
  const TABLE = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const OLD = `float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[i] / 16.0;
}`;
  assert.doesNotMatch(BAYER_GLSL, /float m\[16\]/, 'no table a fragment');
  const bits = glslFunctions(BAYER_GLSL, {}, { fp32: true }), table = glslFunctions(OLD, {}, { fp32: true });
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) assert.equal(bits.bayer4([x + 0.5, y + 0.5]), TABLE[y * 4 + x] / 16, `cell (${x}, ${y})`);
  for (const [px, py] of [[-7.5, 3.5], [1023.5, 767.5], [-1.25, -0.75], [4096.5, 2.5], [17.9, 33.1]]) {
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) assert.equal(bits.bayer4([px + dx, py + dy]), table.bayer4([px + dx, py + dy]), `(${px + dx}, ${py + dy})`);
  }
});

test('LA-COST5: THE CONTACT MARCH IS EASED OUT OF ITS BAND, NOT CUT AT ITS EDGE - on the lane\'s own lantern loop (the march stubbed to a shadow at the floor, and counted): inside six tenths of the range the term is what it was, to the bit; past seven tenths it is unshadowed as it was, and no march runs; between, it eases from one to the other with no step at the edge (the hard edge stepped by 0.85 of the light there); and a city lantern\'s flicker - its range stepping 0.4 at 14 Hz - moves the lit term at its worst fragment by a quarter of what the shell did (mutants: the fade dropped; the march run past the band; the fade\'s start past its end)', () => {
  assert.equal(EL_CONTACT_FADE_START, 0.6); assert.equal(AIR_CONTACT_RANGE_FRACTION, 0.7);
  assert.ok(EL_CONTACT_FADE_START < AIR_CONTACT_RANGE_FRACTION, 'the fade ends where the march does');
  const eased = withStub(EL_MESH_FS);
  const hard = swap(eased, '\n      : mix(contactShadow(wp, n, Ln, d), 1.0, smoothstep(uPointLights[i].w * 0.6, uPointLights[i].w * 0.7, d));', '\n      : contactShadow(wp, n, Ln, d);');
  const colour = [1, 0.72, 0.42];
  const at = (src, w, d, hand = false) => {
    const f = glslFunctions(src, litBindings([[0, 0, 0, w]], [colour], [hand ? -2 : -1]), { fp32: true });
    const v = f.elPointLitWet([d * 0.8, -d * 0.6, 0], [0, 1, 0], 0, { value: [0, 0, 0] });   // a floor below the lamp, facing it
    return { g: v[1], calls: f.globals.contactCalls };
  };
  for (const w of [6, 12, 18]) {
    for (let t = 0.2; t < 0.6; t += 0.037) assert.equal(at(eased, w, t * w).g, at(hard, w, t * w).g, `w ${w}, ${t.toFixed(3)} of the range: as it was`);
    for (let t = 0.705; t < 1; t += 0.041) {
      const e = at(eased, w, t * w);
      assert.equal(e.g, at(hard, w, t * w).g, `w ${w}, ${t.toFixed(3)}: unshadowed as it was`);
      assert.equal(e.calls, 0, 'and no march past the band');
    }
    // the band: between the shadowed term and the unshadowed one, rising to the unshadowed at the edge, no step
    const unshadowed = (d) => at(hard, w, d).g / 0.15;   // the stub's 0.15 is the only factor the march puts on the term
    let last = -Infinity;
    for (let t = 0.6; t <= 0.7; t += 0.005) {
      const d = t * w, e = at(eased, w, d).g, h = at(hard, w, d).g;
      assert.ok(e >= h - 1e-7 && e <= unshadowed(d) + 1e-7, `w ${w}, ${t.toFixed(3)}: eased between the two`);
      assert.ok(e / unshadowed(d) >= last - 1e-6, 'and the shadow lifts monotonically across the band');
      last = e / unshadowed(d);
    }
    const edge = AIR_CONTACT_RANGE_FRACTION * w, eps = 1e-4 * w;
    const below = at(eased, w, edge - eps).g, above = at(eased, w, edge + eps).g, hardBelow = at(hard, w, edge - eps).g;
    assert.ok(above - hardBelow > 0.8 * above, `w ${w}: where the hard edge stepped by most of the light (${hardBelow} / ${above})`);
    assert.ok(Math.abs(below - above) < 0.01 * (above - hardBelow), `w ${w}: continuous at the edge - no step, where the hard edge stepped (${below} / ${above})`);
    assert.equal(at(eased, w, 0.65 * w, true).calls, 0, 'the hand\'s light never marches');
  }
  // the flicker: CityLightAnimator walks an 18-unit lantern's range down its one-unit band in 0.4 steps, 14 a second
  let worstHard = 0, worstEased = 0;
  for (let d = 9; d < 14; d += 0.05) {
    for (const [wa, wb] of [[18, 17.6], [17.6, 17.2], [17.4, 17]]) {
      worstHard = Math.max(worstHard, Math.abs(at(hard, wa, d).g - at(hard, wb, d).g));
      worstEased = Math.max(worstEased, Math.abs(at(eased, wa, d).g - at(eased, wb, d).g));
    }
  }
  assert.ok(worstEased < worstHard / 3.5, `a step of the flicker moves the worst fragment ${worstEased.toFixed(4)}, where the shell moved it ${worstHard.toFixed(4)}`);
});

test('LA-COST6: THE SEA\'S FOG REACHES THE MESHES - setWaterFog, which the world host calls AFTER beginFrame (beginDeepWatersFrame), sends uDwFog to the mesh program at once, as setClipY sends the slice, so a building drawn after it wears the murk the ground and the flats wear; null sends it off; and the stamp moves, so the four gated blocks carry it too (mutants: the push dropped; pushed to the bound program instead of the mesh\'s)', () => {
  const { gl, snaps, canvas } = stateGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('1_1', gl.createTexture());
  const mesh = { vao: gl.createVertexArray(), buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] };
  const bb = r.createBillboardBatch(1, 1, { w: 1, h: 1 }, [[0, 0, -3]]);
  r._bbCullOff = true;
  const fog = new Float32Array(20).map((_, i) => (i === 0 ? 1 : i * 0.01));
  const dwOf = (s) => JSON.parse(new Map(JSON.parse(s).u).get('uDwFog') ?? 'null')?.[0];
  for (const lane of [EL_LANE, null]) {
    r.setLightingLane(lane);
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    r.drawBillboards([bb], R, UP);   // the flats' block goes up before the fog is set
    r.drawCharacter({ vao: gl.createVertexArray(), count: 3 }, I);   // ...and a body leaves its own program bound
    r.setWaterFog(fog);   // ...as world.js sets it: after beginFrame
    snaps.length = 0;
    r.drawMesh(mesh, I);
    assert.deepEqual(dwOf(snaps[0]), [...fog], `${lane ? 'lane' : 'classic'}: the mesh drawn after it wears the sea's fog`);
    r.drawBillboards([bb], R, UP);
    assert.deepEqual(dwOf(snaps[1]), [...fog], '...and the flats\' block carries it at their next call');
    r.setWaterFog(null);
    snaps.length = 0;
    r.drawMesh(mesh, I);
    assert.equal(dwOf(snaps[0])[0], 0, 'off is [0] = 0, at once');
  }
  const src = read('src/render/renderer.js');
  const body = src.slice(src.indexOf('  setWaterFog(u) {'), src.indexOf('\n  }\n', src.indexOf('  setWaterFog(u) {')));
  assert.match(body, /const loc = this\._solidFog\?\.dwFog;[^\n]*\n\s+if \(loc\) \{ this\._use\(this\.program\); this\.gl\.uniform4fv\(loc, this\._dwFog\); \}/, 'the mesh program, bound for it (setClipY\'s seam)');
  assert.match(read('src/scenes/world.js'), /renderer\.setWaterFog\(distanceFogUniforms\(/, 'the world host sets it in its frame');
});

/** LA-COST7: a fake GL whose uniform locations are what WebGL's are - a FRESH object every call (a table built twice
 *  is two tables), null where no shader attached to the program declares the name - and which counts every lookup,
 *  per program. */
function lookupGl() {
  let ids = 0;
  const asked = new Map();
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, drawingBufferWidth: 320, drawingBufferHeight: 200 };
  const declares = (p, name) => (p?.shaders ?? []).some((s) => new RegExp(`^\\s*uniform\\b[^;]*\\b${name}\\b`, 'm').test(s.src ?? ''));
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      switch (k) {
        case 'getProgramParameter': case 'getShaderParameter': return () => true;
        case 'getAttribLocation': return () => 0;
        case 'getParameter': return () => new Float32Array(4);
        case 'shaderSource': return (sh, src) => { sh.src = src; };
        case 'attachShader': return (p, sh) => { (p.shaders ??= []).push(sh); };
        case 'getUniformLocation': return (p, n) => { asked.set(p, (asked.get(p) ?? 0) + 1); return declares(p, n) ? { program: p.id, name: n } : null; };
        default:
          if (typeof k !== 'string') return undefined;
          if (k.startsWith('create')) return () => ({ id: ++ids });
          if (k.toUpperCase() === k) return 1;
          return () => {};
      }
    },
  });
  return { gl, asked, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('LA-COST7: A WORLD SET\'S LOCATIONS ARE ASKED OF GL ONCE - on a GL whose every lookup is a fresh object and whose undeclared names are null, a set\'s first install asks for its tables and every later one (the lane swapped out and back, a panel frame\'s classic bracket and the lane\'s return after it) asks for nothing, while the tables it installs are, field for field, the tables a renderer that asks GL at every install builds; a lane under a new key brings its own set and asks for its own (mutants: the memo off; nulls not kept; keyed by name alone; not kept on the set; the fog or decal table past it)', () => {
  const installBody = (() => { const s = read('src/render/renderer.js'), at = s.indexOf('  _installWorldSet(set) {'); return s.slice(at, s.indexOf('\n  }\n', at)); })();
  const FIELDS = [...new Set([...installBody.matchAll(/this\.(\w+)(?:\.\w+)? = /g)].map((m) => m[1]))];
  assert.ok(FIELDS.length > 80, `the install's fields, read off it (${FIELDS.length})`);
  const flat = (v, path, out) => {
    if (v && typeof v === 'object' && 'shaders' in v) out.push(`${path} = program ${v.id}`);
    else if (v && typeof v === 'object' && 'decalLights' in v) out.push(`${path} = set ${v.key}`);
    else if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) for (const k of Object.keys(v)) flat(v[k], `${path}.${k}`, out);   // _el's arrays carry their tables as keys
    else out.push(`${path} = ${JSON.stringify(v)}`);
    return out;
  };
  const OTHER = { ...EL_LANE, key: `${EL_LANE.key}+another` };
  const panel = (r) => r.panelFrame({ proj: PROJ, view: VIEW, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 64, h: 64 } }, () => {});
  const steps = [
    ['the lane in', (r) => r.setLightingLane(EL_LANE)],
    ['the classic set back', (r) => r.setLightingLane(null)],
    ['the lane again', (r) => r.setLightingLane(EL_LANE)],
    ['a panel frame', panel],
    ['a lane under a new key', (r) => r.setLightingLane(OTHER)],
    ['the classic set once more', (r) => r.setLightingLane(null)],
    ['the new key\'s lane again', (r) => r.setLightingLane(OTHER)],
    ['a second panel frame', panel],
  ];
  const run = (memo) => {
    const { gl, asked, canvas } = lookupGl();
    const r = new Renderer(canvas);
    if (!memo) r._locations = () => gl;   // the reference: every install asks GL, as every one did before LA-COST7
    const sets = [r._worldSet];
    const askedOf = (s) => [s.mesh, s.char, s.bb, s.terrain, s.decal].reduce((n, p) => n + (asked.get(p) ?? 0), 0);
    const log = [{ step: 'the constructor', asked: [askedOf(sets[0])], tables: flat(FIELDS.map((f) => r[f]), 'r', []) }];
    for (const [step, act] of steps) {
      const before = sets.map(askedOf);
      act(r);
      if (!sets.includes(r._worldSet)) { sets.push(r._worldSet); before.push(0); }
      log.push({ step, asked: sets.map((s, i) => askedOf(s) - before[i]), tables: flat(FIELDS.map((f) => r[f]), 'r', []) });
    }
    return { log, sets };
  };
  const got = run(true), want = run(false);
  for (let i = 0; i < want.log.length; i++) assert.deepEqual(got.log[i].tables, want.log[i].tables, `after ${want.log[i].step}: the tables a lookup at every install builds`);
  const perInstall = want.log[2].asked[0];   // the reference's classic set installed again: every line of the install asks
  assert.ok(perInstall > 250, `an install asks GL ${perInstall} times without the memo`);
  const [ctor, laneIn, classicBack, laneAgain, panel1, other, classicOnce, otherAgain, panel2] = got.log;
  assert.ok(ctor.asked[0] > 200, `the classic set's first install asks for its tables (${ctor.asked})`);
  assert.equal(laneIn.asked[0], 0, 'the lane\'s first install asks nothing of the classic set\'s programs...');
  assert.ok(laneIn.asked[1] > 200, `...and asks for the lane's (${laneIn.asked})`);
  for (const s of [classicBack, laneAgain, panel1, classicOnce, otherAgain, panel2]) assert.deepEqual(s.asked, s.asked.map(() => 0), `${s.step}: GL is asked for nothing (${s.asked})`);
  assert.deepEqual(other.asked.slice(0, 2), [0, 0], 'a new key\'s set asks nothing of the others\' programs...');
  assert.ok(other.asked[2] > 200, `...and asks for its own (${other.asked})`);
  assert.equal(got.sets.length, 3, 'three sets: the classic, the lane, the new key\'s');
  assert.equal(new Set(got.sets.map((s) => s.locate)).size, 3, 'each set keeps its own memo');
  // the memo stands behind the three table builders, and they ask GL for nothing else
  const src = read('src/render/renderer.js');
  for (const head of ['  _installWorldSet(set) {', '  _fogLocs(program) {', '  _decalLocs(P) {']) {
    const at = src.indexOf(head), body = src.slice(at, src.indexOf('\n  }\n', at));
    assert.match(body, /^\s+const gl = this\._locations\((?:set)?\);/m, `${head.trim()} reads through the memo`);
    assert.deepEqual([...new Set(body.match(/\bgl\.\w+/g))], ['gl.getUniformLocation'], `${head.trim()} asks the memo for locations alone`);
  }
});
