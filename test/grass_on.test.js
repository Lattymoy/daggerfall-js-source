// GRASS-ON (2026-10-07, Mac: "Can you please turn grass on by default", then "People are also saying it really has bad
// performance"; `07-Rendering/Rendering.md` GRASS-ON): THE GRASS IS FULL BY DEFAULT AGAIN, AND CHEAPER TO DRAW.
// The field draws under the first-vertex convention where the browser offers WEBGL_provoking_vertex - each triangle
// listed with its provoking corner first, so the corner the vertex stage reads its flats in is the one that provokes
// under either convention - and its cells in view go nearest first in the opaque sprite styles. The stage's provoking
// corner is held on its own compiled text through test/glsl.mjs; the draws on a fake GL that records them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LAB_GRASS_HEAD, GAME_GRASS_FIELD, GAME_GRASS_VS, LabGrassRenderer, labBladeCorners, provokeFirst, packHeightSlope, heightFloor, heightSpan, GRASS_CELL, GRASS_FAR_SEGMENTS } from '../src/render/labGrass.js';
import { meadowCardIndices, MEADOW_CARDS, MEADOW_CARDS_FAR } from '../src/render/grassMeadow.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { glslFunctions } from './glsl.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LIGHT = { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 1, 1], dim: 1 };
const WIND = { dir: [1, 0], speed: 0, windV: [0, 0] };
const FIRST = 0x8E4D, LAST = 0x8E4E;   // WEBGL_provoking_vertex's two conventions
const identity = (n) => Uint16Array.from({ length: n }, (_, i) => i);

/** a recording WebGL2 that draws nothing; `provoking` hands the renderer WEBGL_provoking_vertex (recording it) */
function stubGl({ provoking = true } = {}) {
  const calls = [];
  const C = { ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, BLEND: 20, TRIANGLES: 23, CULL_FACE: 24, UNSIGNED_SHORT: 25, ELEMENT_ARRAY_BUFFER: 31, TEXTURE0: 100 };
  const ext = { FIRST_VERTEX_CONVENTION_WEBGL: FIRST, LAST_VERTEX_CONVENTION_WEBGL: LAST, PROVOKING_VERTEX_WEBGL: 0x8E4F, provokingVertexWEBGL: (m) => { calls.push(['provokingVertexWEBGL', m]); } };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in C) return C[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (k === 'getExtension') return (n) => { calls.push(['getExtension', n]); return n === 'WEBGL_provoking_vertex' && provoking ? ext : null; };
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls, C };
}
/** each vertex array the constructor builds -> the index list it bound (null: none) */
function arrayIndices(calls, C) {
  const out = new Map();
  let cur = null;
  for (const c of calls) {
    if (c[0] === 'bindVertexArray') { cur = c[1]; if (cur !== null && !out.has(cur)) out.set(cur, null); continue; }
    if (cur !== null && c[0] === 'bufferData' && c[1] === C.ELEMENT_ARRAY_BUFFER) out.set(cur, [...c[2]]);
  }
  return out;
}
/** a cell's blades as the placer shapes them (perf2's rig): perCell roots over a 7x7 grid from (x, z) */
function cellPlaced(perCell, { x, z, h = 0.7, y = 10, span = GRASS_CELL }) {
  const inst = new Float32Array(perCell * 4), inst2 = new Float32Array(perCell * 4), rootY = new Float32Array(perCell), ground = new Float32Array(perCell * 3);
  for (let i = 0; i < perCell; i++) {
    inst[i * 4] = x + (i % 7) / 7 * span; inst[i * 4 + 1] = z + Math.floor(i / 7) % 7 / 7 * span; inst[i * 4 + 2] = h; inst[i * 4 + 3] = i / perCell;
    rootY[i] = y;
  }
  return { inst, inst2, rootY, ground, count: perCell, perCell };
}
const EYE = [0, 12, 0];
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const VIEW = lookAt(EYE, [0, 12, 1], [0, 1, 0]);

test('GRASS-ON (Mac: "Can you please turn grass on by default"): the grass row is Full by default again, its tiers and its style unchanged (mutant: the grass off by default)', () => {
  const grass = FEATURES.find((f) => f.id === 'grass');
  assert.deepEqual([grass.control.key, grass.control.initial, grass.control.tiers.map(([v]) => v)], ['grassDensity', 1, [1, 0.5, 0.25, 0]]);
  assert.equal(FEATURE_PREF_DEFAULTS.grassDensity, 1);
  assert.equal(PREF_DEFAULTS.grassDensity, 1, 'the shelf takes its default off the row (RF4)');
  assert.equal(FEATURE_PREF_DEFAULTS.grassStyle, 'meadow', 'the meadow is still the style a player gets');
  assert.match(grass.note, /try Half first if the game runs slow/, 'the row still says where the escape is');
});

test('GRASS-ON: a triangle turned to begin where it ended - the same winding - and in every list the field draws, the corner the stage reads its flats in ends each triangle as GL lists it and begins it turned (mutants: the turn the wrong way, the blades\' list unturned)', () => {
  assert.deepEqual([...provokeFirst(Uint16Array.from([0, 1, 2, 3, 0, 2]))], [2, 0, 1, 2, 3, 0]);
  const lists = { near: identity(labBladeCorners(5).length / 2), far: identity(labBladeCorners(GRASS_FAR_SEGMENTS).length / 2), cards: meadowCardIndices(MEADOW_CARDS), cardsFar: meadowCardIndices(MEADOW_CARDS_FAR) };
  for (const [name, last] of Object.entries(lists)) {
    const first = provokeFirst(last);
    assert.equal(first.length, last.length);
    for (let t = 0; t < last.length; t += 3) {
      const a = [...last.subarray(t, t + 3)], b = [...first.subarray(t, t + 3)];
      assert.deepEqual(b, [a[2], a[0], a[1]], `${name} ${t / 3}: a turn, so the winding holds`);
      assert.deepEqual(a.map((v) => v % 3 === 2), [false, false, true], `${name} ${t / 3}: GL's list ends on the corner the stage reads, and only there`);
      assert.deepEqual(b.map((v) => v % 3 === 2), [true, false, false], `${name} ${t / 3}: the turned list begins on it`);
    }
  }
});

test('GRASS-ON: the vertex stage, run on its own text, hands the root\'s sun down from the one corner that provokes under either convention - the first of each turned triangle, the last of each as GL lists it (mutant: the stage reads another corner)', () => {
  const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS, {
    aCorner: [0.5, 0.5], aPA: [0.5, 0.5, 0, Math.fround(packHeightSlope(0.5, 0, 0, 0) * Math.fround(1 / 65535))], aPB: [0.5, 0.5, 0.5, 0.5], aPC: [0.2, 0.3, 0.1, 0], aCard: 0,
    uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uTime: 0, uWind: 0, uRange: 300, uEye: [0, 1, 0], uSunDir: [0, 1, 0], uMoonDir: [0, 1, 0], uWindDir: [1, 0],
    uSnowFull: 1.1, uSlotN: 0, uCellFrame: [0, 0, 0, 1], uBladeScale: [heightFloor(), heightSpan(), 0.05, 0.05], uCellSize: 30, uPixel: 0, uPxVariants: 8,
    uGFieldOrigin: [0, 0], uGFieldM: 1, uSnowGlobal: 0, uWindV: [0, 0], uSunScale: 0.6, uCamPos: [0, 0, 0], uIndirect: [0, 0, 0, 0], uIndirectColor: [0, 0, 0],
    uCloudShadowRect: [0, 0, 0, 0], uSunShadowParams: [0, 0, 0, 0], uPointCount: 0,
    gl_VertexID: 0, gl_InstanceID: 0,
    texture: () => [0, 0, 0, 0],
  });
  const vSunOf = (vertexId) => { f.globals.gl_VertexID = vertexId; f.main(); return f.globals.vSun; };
  // no deck and no map: the provoking corner's sun is the whole sun, every other corner's nothing
  for (const last of [identity(labBladeCorners(GRASS_FAR_SEGMENTS).length / 2), meadowCardIndices(MEADOW_CARDS)]) {
    const first = provokeFirst(last);
    for (let t = 0; t < last.length; t += 3) {
      assert.deepEqual([...last.subarray(t, t + 3)].map(vSunOf), [0, 0, 1], `GL's convention: the last corner of triangle ${t / 3}`);
      assert.deepEqual([...first.subarray(t, t + 3)].map(vSunOf), [1, 0, 0], `the first-vertex convention: the first corner of triangle ${t / 3}`);
    }
  }
});

test('GRASS-ON: where the browser offers WEBGL_provoking_vertex every array is drawn through its turned list, under the first-vertex convention for the field\'s draws alone and GL\'s back after them; with none, or `provoke` false, the field draws as it always did (mutants: the extension never asked, GL\'s convention not put back, the cards\' list unturned, the blades unindexed)', () => {
  for (const mode of ['offered', 'absent', 'refused']) {
    const { gl, calls, C } = stubGl({ provoking: mode !== 'absent' });
    const r = new LabGrassRenderer(gl, mode === 'refused' ? { provoke: false } : undefined);
    const turned = mode === 'offered';
    assert.equal(calls.some((c) => c[0] === 'getExtension' && c[1] === 'WEBGL_provoking_vertex'), mode !== 'refused', `${mode}: asked for only when the field may take it`);
    const idx = arrayIndices(calls, C);
    const want = {
      near: turned ? provokeFirst(identity(30)) : null, far: turned ? provokeFirst(identity(6)) : null,
      cards: turned ? provokeFirst(meadowCardIndices(MEADOW_CARDS)) : meadowCardIndices(MEADOW_CARDS),
      cardsFar: turned ? provokeFirst(meadowCardIndices(MEADOW_CARDS_FAR)) : meadowCardIndices(MEADOW_CARDS_FAR),
    };
    for (const [name, vao] of [['near', r.vao], ['far', r.vaoFar], ['cards', r.vaoCards], ['cardsFar', r.vaoCardsFar]]) {
      assert.deepEqual(idx.get(vao), want[name] && [...want[name]], `${mode}: the ${name} array's list`);
    }
    assert.deepEqual([r.verts, r.vertsFar, r.vertsCards, r.vertsCardsFar, r.countCards, r.countCardsFar], [30, 6, 12, 8, 18, 12], `${mode}: what a tuft shades and submits is unchanged`);
    const perCell = 49;
    r.allocSlots(perCell, 4);
    r.writeSlot(0, cellPlaced(perCell, { x: 0, z: 30 }));    // inside the near band
    r.writeSlot(1, cellPlaced(perCell, { x: 0, z: 200 }));   // past the far blade's and the far cards' handover
    for (const style of ['meadow', 'pixel', 'smooth']) {
      calls.length = 0;
      r.draw(PROJ, VIEW, new Float32Array(EYE), 0, LIGHT, WIND, 300, style);
      const draws = calls.filter((c) => c[0] === 'drawElementsInstanced' || c[0] === 'drawArraysInstanced');
      assert.equal(draws.length, 2, `${mode} ${style}: both cells`);
      const conv = calls.filter((c) => c[0] === 'provokingVertexWEBGL').map((c) => c[1]);
      if (turned) {
        assert.deepEqual(conv, [FIRST, LAST], `${style}: the first-vertex convention, and GL's back`);
        const at = (c) => calls.indexOf(c);
        const [on, off] = calls.filter((c) => c[0] === 'provokingVertexWEBGL');
        assert.ok(at(on) < at(draws[0]) && at(off) > at(draws[1]), `${style}: around the field's draws`);
        assert.ok(draws.every((c) => c[0] === 'drawElementsInstanced' && c[3] === C.UNSIGNED_SHORT && c[4] === 0), `${style}: every draw through its list`);
      } else {
        assert.deepEqual(conv, [], `${mode} ${style}: the convention untouched`);
        assert.equal(draws.filter((c) => c[0] === 'drawElementsInstanced').length, style === 'meadow' ? 2 : 0, `${mode} ${style}: the cards indexed as AUDIT MEADOW1 drew them, the blades not`);
      }
      const counts = draws.map((c) => (c[0] === 'drawElementsInstanced' ? c[2] : c[3]));
      assert.deepEqual(counts, style === 'meadow' ? [18, 12] : style === 'pixel' ? [6, 6] : [30, 6], `${mode} ${style}: each array's whole list, near then far`);
    }
    calls.length = 0;
    r.destroy();
    assert.equal(r._cornerBufs.length, turned ? 8 : 6, `${mode}: the blades' two lists only when turned`);
    for (const b of r._cornerBufs) assert.ok(calls.some((c) => c[0] === 'deleteBuffer' && c[1] === b), `${mode}: every corner and index buffer freed`);
  }
});

test('GRASS-ON: the cells in view are drawn nearest first in the sprite styles - stable, so cells at one distance keep the slots\' order, and each card array bound once - and in the slots\' order in the smooth style, which blends; what is drawn is the same either way (mutants: no order, the farthest first, the smooth style ordered)', () => {
  const { gl, calls } = stubGl({ provoking: false });
  const r = new LabGrassRenderer(gl);
  const perCell = 49;
  r.allocSlots(perCell, 5);
  const at = [{ x: 0, z: 120 }, { x: 0, z: 30 }, { x: -20, z: 120 }, { x: -20, z: 30 }, { x: 0, z: 80 }];   // far, near, far, near (a tie with 1), the band
  at.forEach((p, s) => r.writeSlot(s, cellPlaced(perCell, p)));
  const slotOf = (c) => at.findIndex((_, s) => r.slotFrame[s * 4] === c[2] && r.slotFrame[s * 4 + 1] === c[3]);   // a draw's cell, by the frame it was handed
  const run = (style) => {
    calls.length = 0;
    r.draw(PROJ, VIEW, new Float32Array(EYE), 0, LIGHT, WIND, 300, style);
    return { order: calls.filter((c) => c[0] === 'uniform4f' && c[1] === 'uCellFrame').map(slotOf), binds: calls.filter((c) => c[0] === 'bindVertexArray' && c[1] !== null && c[1] !== r.vao).map((c) => c[1]), drawn: { ...r.drawn } };
  };
  const meadow = run('meadow');
  assert.deepEqual(meadow.order, [1, 3, 4, 0, 2], 'nearest first, the tie in the slots\' order');
  assert.deepEqual(meadow.binds, [r.vaoCards, r.vaoCardsFar], 'the near cards, then the far - once each, where the slots\' order would bind four times');
  assert.deepEqual(run('pixel').order, [1, 3, 4, 0, 2]);
  const smooth = run('smooth');
  assert.deepEqual(smooth.order, [0, 1, 2, 3, 4], 'the smooth style blends: its order is its picture, and it keeps the slots\'');
  assert.deepEqual([meadow.drawn.slots, smooth.drawn.slots], [5, 5]);
  assert.equal(meadow.drawn.kept, 5 * perCell);
});

test('GRASS-ON: the world host hands the field `?provoke=last`, the door to time it under GL\'s own convention on a machine\'s own GPU (mutant: the door shut)', () => {
  const w = read('src/scenes/world.js');
  assert.ok(w.includes("new LabGrassRenderer(renderer.gl, { provoke: pageParam('provoke') !== 'last' })"));
  assert.equal((w.match(/new LabGrassRenderer\(/g) || []).length, 1, 'the grass\'s one host builds the one field');
  const lab = read('src/render/labGrass.js');
  assert.ok(lab.includes("this._pv = provoke ? (gl.getExtension('WEBGL_provoking_vertex') ?? null) : null;"));
});
