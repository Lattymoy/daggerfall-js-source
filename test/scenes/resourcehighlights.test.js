// RESOURCE-HIGHLIGHTS (2026-10-26, the owner: "Reintroduce resource highlights as an option" - bible/06-Systems/
// Professions-Arc.md section 54). NODE-OUTLINE's ring (section 46, retired by NODE-GLINT on 2026-10-20) back as a choice:
// the Resource highlights row (systems/features.js, the player's own pref) lights a gathering node with the glints (the
// default), the ring round its own picture in its profession's colour, or both - one pass, one mask, read each frame
// (render/nodeGlint.js). AUDIT GATHER F9 rides here too: a build that fails lets go of every program it made or started.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as NG from '../../src/render/nodeGlint.js';
import {
  RESOURCE_HIGHLIGHT_PREF, RESOURCE_HIGHLIGHTS, highlightLook, OUTLINE_PX, OUTLINE_PX_MIN, OUTLINE_TAPS, OUTLINE_ALPHA, OUTLINE_BREATH,
  OUTLINE_BREATH_HZ, OUTLINE_RING_BACK, outlinePx, outlineBreath, glintRatesWhole, NODE_RING_VS, NODE_RING_FS, NODE_GLINT_PROGRAMS,
  NodeGlintRenderer, createNodeGlintPass, GLINT_TILE,
} from '../../src/render/nodeGlint.js';
import { FEATURES } from '../../src/systems/features.js';
import { CATEGORIES } from '../../src/ui/settings/settingsMap.js';
import { getPref } from '../../src/systems/uiPrefs.js';
import { nodeMarkRgb } from '../../src/ui/nodeMarks.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A WebGL2 that records every call (the glint test's own, render/nodeGlint.js's needs): the viewport 640 x 480 at (8, 4);
 *  `failLink` the n-th link that fails (1-based), none by default. */
function fakeGl({ failLink = 0 } = {}) {
  const calls = [];
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, CULL_FACE: 11,
    DEPTH_TEST: 12, LESS: 13, VIEWPORT: 14, FRAMEBUFFER_BINDING: 15, FRAMEBUFFER: 16, TEXTURE_2D: 17, DEPTH_COMPONENT24: 18, DEPTH_ATTACHMENT: 19, NONE: 20,
    ELEMENT_ARRAY_BUFFER: 21, UNSIGNED_INT: 22, DYNAMIC_DRAW: 23, SCISSOR_TEST: 24, TEXTURE0: 25, DEPTH_BUFFER_BIT: 26, ONE: 27, TEXTURE1: 28,
    TEXTURE_MIN_FILTER: 29, TEXTURE_MAG_FILTER: 30, NEAREST: 31, TEXTURE_WRAP_S: 32, TEXTURE_WRAP_T: 33, CLAMP_TO_EDGE: 34, SRC_ALPHA: 35, ONE_MINUS_SRC_ALPHA: 36 };
  let n = 0, links = 0;
  const gl = new Proxy(C, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getProgramParameter' && a[1] === C.LINK_STATUS) return ++links !== failLink;
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k === 'getExtension') return null;
        if (k === 'getParameter') return a[0] === C.VIEWPORT ? new Int32Array([8, 4, 640, 480]) : a[0] === C.FRAMEBUFFER_BINDING ? 'frame-target' : null;
        if (k === 'isEnabled') return false;
        if (k === 'getShaderInfoLog' || k === 'getProgramInfoLog') return 'no';
        return { id: ++n, kind: k };
      };
    },
  });
  return { gl, calls };
}
const PROJ = new Float32Array([1.5, 0, 0, 0, 0, 2, 0, 0, 0, 0, -1.001, -1, 0, 0, -0.1, 0]);
const VIEW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.6, 0, 1]);
const fakeRenderer = (gl) => ({ gl, _proj: PROJ, _view: VIEW, _camPos: new Float32Array([0, 1.6, 0]), _bbRight: new Float32Array([1, 0, 0]), _bbUp: new Float32Array([0, 1, 0]),
  _fogMode: 0, _fogRange: [0, 1], _haze: new Float32Array(8), _dwFog: new Float32Array(20), textures: new Map([['500_9', { tex: 'herb' }]]), lptDrawnFrames: () => [] });
const batch = { archive: 500, record: 9, frame: null, vao: 'herb-vao', _ibOff: 0, size: { w: 1, h: 1 }, origin: [0, 0, 0] };
const LIST = () => [
  { alpha: 1, seed: 0.25, at: [1, 0, -6], rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [[1, 0, -6]] }] } },
  { alpha: 0.5, seed: 0.75, at: [-1, 0, -8], rgb: nodeMarkRgb('mining'), mark: { pictures: [{ batch, first: 1, count: 1, centers: [[-1, 0, -8]] }] } },
];
const used = (calls, prog) => calls.some((x) => x[0] === 'useProgram' && x[1] === prog);

test('RESOURCE-HIGHLIGHTS the row: Resource highlights in Sight, its three tiers, the glints by default, the player\'s own; on the Climbing & gathering page beside Foraging', () => {
  const row = FEATURES.find((f) => f.id === 'resource-highlights');
  assert.ok(row, 'the row stands');
  assert.equal(row.group, 'sight'); assert.deepEqual([...row.kinds], ['enhanced']);
  assert.equal(row.control.store, 'prefs'); assert.equal(row.control.key, RESOURCE_HIGHLIGHT_PREF); assert.equal(RESOURCE_HIGHLIGHT_PREF, 'resourceHighlights');
  assert.equal(row.control.initial, 'glint', 'the glints, the owner\'s choice of 2026-10-20'); assert.equal(row.control.online, 'player');
  assert.deepEqual(row.control.tiers.map(([k]) => k), Object.keys(RESOURCE_HIGHLIGHTS), 'a tier for each look, and a look for each tier');
  assert.equal(getPref(RESOURCE_HIGHLIGHT_PREF), 'glint', 'the shelf\'s default the row\'s');
  assert.match(row.note, /Outline/); assert.match(row.title, /Resource highlights/);
  const moving = CATEGORIES.find((c) => c.id === 'gameplay').sections.find((s) => s.id === 'moving');
  const items = moving.items;
  assert.ok(items.includes('feat:resource-highlights') && items.indexOf('feat:resource-highlights') < items.indexOf('feat:mod-foraging'));
});

test('RESOURCE-HIGHLIGHTS the looks and the ring\'s numbers by value (NODE-OUTLINE\'s, as they shipped): its width with the image, its breath whole over the clock and still under reduced motion', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RESOURCE_HIGHLIGHTS)), { glint: { glint: true, ring: false }, outline: { glint: false, ring: true }, both: { glint: true, ring: true } });
  assert.equal(highlightLook('outline'), RESOURCE_HIGHLIGHTS.outline); assert.equal(highlightLook('both'), RESOURCE_HIGHLIGHTS.both);
  assert.equal(highlightLook('nonsense'), RESOURCE_HIGHLIGHTS.glint, 'an unknown tier the default'); assert.equal(highlightLook(undefined), RESOURCE_HIGHLIGHTS.glint);
  assert.deepEqual([OUTLINE_PX, OUTLINE_PX_MIN, OUTLINE_TAPS, OUTLINE_ALPHA, OUTLINE_BREATH, OUTLINE_BREATH_HZ, OUTLINE_RING_BACK], [2.5, 1.5, 8, 0.95, 0.12, 0.25, 0.08]);
  assert.equal(outlinePx(1080), 2.5); assert.equal(outlinePx(2160), 5); assert.equal(outlinePx(360), 1.5, 'never under its floor');
  assert.equal(outlineBreath(0), 1); assert.ok(Math.abs(outlineBreath(2) - (1 - OUTLINE_BREATH)) < 1e-12, 'at its faintest, half a breath in');
  assert.equal(outlineBreath(2, true), 1, 'still under reduced motion');
  assert.ok(glintRatesWhole(), 'the breath whole over the glow\'s clock, beside the glints\' and the sheen\'s');
});

test('RESOURCE-HIGHLIGHTS the ring\'s programs: a quad over the node\'s rectangle; outside the silhouette within its width, at the depth it borders stood behind it, fogged, hazed and murked; the pass\'s third program', () => {
  assert.equal(NODE_GLINT_PROGRAMS.length, 3); assert.deepEqual(NODE_GLINT_PROGRAMS[2], [NODE_RING_VS, NODE_RING_FS]);
  assert.ok(NODE_RING_VS.includes('gl_Position = vec4(uRect.xy + aP * uRect.zw, 0.0, 1.0);'));
  const fs = NODE_RING_FS;
  assert.ok(fs.includes('  if (maskAt(at, lo, hi) < 1.0) discard;   // the node itself'), 'never over the node');
  assert.equal((fs.match(/d = min\(d, min\(maskAt\(at \+ vec2\(/g) ?? []).length, OUTLINE_TAPS, 'eight directions');
  assert.ok(fs.includes('* reach, lo, hi), maskAt(at + vec2('), 'at the width'); assert.ok(fs.includes('* (0.5 * reach), lo, hi)'), 'and half of it');
  // a node fitted into its tile: the node's by any of the four texel centres round the fragment, the reach half a texel more
  assert.ok(fs.includes('  bool fitted = any(lessThan(uTile.zw, uRect.zw * uViewport.zw - 0.5));'));
  assert.ok(fs.includes('  if (fitted && min(min(maskAt(at + vec2(-0.5, -0.5), lo, hi), maskAt(at + vec2(0.5, -0.5), lo, hi)), min(maskAt(at + vec2(-0.5, 0.5), lo, hi), maskAt(at + vec2(0.5, 0.5), lo, hi))) < 1.0) discard;'));
  assert.ok(fs.includes('  float reach = uRing + (fitted ? 0.5 : 0.0);'));
  assert.ok(fs.includes('  if (d >= 1.0) discard;   // no silhouette within the ring\'s reach'));
  assert.ok(fs.includes(`at3 + away * (${OUTLINE_RING_BACK.toFixed(4)} / max(length(away), 1e-4))`), 'stood behind the silhouette it borders');
  assert.ok(fs.includes('gl_FragDepth = clamp(c.z / c.w * 0.5 + 0.5, 0.0, 1.0);'));
  assert.ok(fs.includes('  o = vec4(dwWaterFog(uOutlineColor.rgb, at3), uOutlineColor.a * fogFactorAt(at3));'), 'fogged and hazed, the sea\'s murk a colour\'s');
});

test('RESOURCE-HIGHLIGHTS the draw: the outline rings every node in its colour, blended over the frame with no depth written, kindled and breathing - and draws no glints; the glints alone ring nothing; both, the ring first; none, nothing', () => {
  const { gl, calls } = fakeGl();
  const r = new NodeGlintRenderer(/** @type {any} */ (gl));
  const renderer = fakeRenderer(gl);
  calls.length = 0;
  assert.equal(r.draw(LIST(), renderer, 2, false, RESOURCE_HIGHLIGHTS.outline), 2);
  assert.equal(r.ringed, 2); assert.equal(r.drawn, 2);
  assert.ok(used(calls, r.ring) && !used(calls, r.light), 'the ring\'s program, not the light\'s');
  const back = calls.findIndex((x) => x[0] === 'bindFramebuffer' && x[2] === 'frame-target');
  const rings = calls.slice(back);
  const quad = rings.findIndex((x) => x[0] === 'drawArrays');
  assert.ok(rings.slice(0, quad).some((x) => x[0] === 'blendFunc' && x[1] === gl.SRC_ALPHA && x[2] === gl.ONE_MINUS_SRC_ALPHA), 'blended: a line in its colour');
  assert.ok(rings.slice(0, quad).some((x) => x[0] === 'depthMask' && x[1] === false), 'against the world\'s depth, never writing it');
  assert.equal(rings.filter((x) => x[0] === 'drawArrays').length, 2, 'one quad a node');
  const u = (name) => rings.filter((x) => x[0].startsWith('uniform') && x[1] === name).map((x) => x.slice(2));
  const breath = outlineBreath(2, false);
  const want = LIST().map((g) => [...g.rgb, OUTLINE_ALPHA * g.alpha * breath]);
  assert.deepEqual(u('uOutlineColor').map((v) => v.map((x) => +x.toFixed(6))), want.map((v) => v.map((x) => +x.toFixed(6))), 'its profession\'s compass colour, kindled, breathing');
  for (let i = 0; i < 2; i++) {
    const s = r._nodes[i], fit = Math.min(1, GLINT_TILE / Math.max(Math.round(s.rect[2] * 640), Math.round(s.rect[3] * 480)));
    assert.equal(u('uRing')[i][0], Math.max(1, outlinePx(480) * fit), 'its width in its tile\'s texels');
  }
  assert.deepEqual(u('uDwFog'), [[renderer._dwFog]]); assert.deepEqual(u('uJungleHaze'), [[renderer._haze]]);
  // AUDIT LOCKPICK D4: the ring's state and its every uniform, sent - each node its own rectangle and tile; the frame's
  // matrices, eye and fog once; blended, against the depth, the quad bound and the atlas on unit 0
  const nodes = r._nodes.slice(0, 2);
  assert.deepEqual(u('uRect'), nodes.map((s) => [...s.rect]), 'each node its rectangle');
  assert.deepEqual(u('uTile'), nodes.map((s) => [...s.tile]), 'and its tile');
  for (const n of ['uVP', 'uInvVP', 'uCamPos', 'uFogMode', 'uFogDensity', 'uFogRange', 'uViewport', 'uMask']) assert.equal(u(n).length, 1, `${n} sent once`);
  assert.deepEqual(u('uCamPos'), [[renderer._camPos]]); assert.deepEqual(u('uFogMode'), [[renderer._fogMode]]); assert.deepEqual(u('uMask'), [[0]]);
  assert.deepEqual(u('uViewport')[0], [8, 4, 640, 480], 'the frame\'s viewport, its origin too');
  const before = rings.slice(0, quad);
  assert.ok(before.some((x) => x[0] === 'enable' && x[1] === gl.BLEND), 'blended');
  assert.ok(before.some((x) => x[0] === 'bindVertexArray' && x[1] === r.quad), 'the quad bound');
  assert.ok(before.some((x) => x[0] === 'activeTexture' && x[1] === gl.TEXTURE0) && before.some((x) => x[0] === 'bindTexture' && x[2] === r.atlas), 'the atlas on unit 0');
  const depth = calls.slice(0, back + quad).filter((x) => (x[0] === 'enable' || x[0] === 'disable') && x[1] === gl.DEPTH_TEST).at(-1);
  assert.deepEqual(depth?.slice(0, 2), ['enable', gl.DEPTH_TEST], 'against the world\'s depth');
  const tail = calls.slice(calls.length - 1 - [...calls].reverse().findIndex((x) => x[0] === 'drawArrays')).map((x) => x.slice(0, 2).join(':'));
  for (const w of [`disable:${gl.BLEND}`, 'depthMask:true', `enable:${gl.CULL_FACE}`]) assert.ok(tail.includes(w), `the baseline handed back: ${w}`);
  assert.ok(r._nodes.slice(0, 2).every((s) => s.g === null), 'no mark held past the frame');
  const outlined = r._nodes.slice(0, 2).map((s) => s.rect[2]);
  // the glints alone: no ring
  calls.length = 0;
  assert.equal(r.draw(LIST(), renderer, 2), 2, 'the glints by default');
  // the ring alone takes its own width's room round a node (section 46's), never the glints' rays' - so more nodes hold a
  // texel a pixel in their tiles
  r._nodes.slice(0, 2).forEach((s, i) => assert.ok(outlined[i] < s.rect[2], `node ${i}: the outline's rectangle the narrower`));
  assert.equal(r.ringed, 0); assert.ok(used(calls, r.light) && !used(calls, r.ring));
  // both: the ring, then the light over it
  calls.length = 0;
  assert.equal(r.draw(LIST(), renderer, 2, true, RESOURCE_HIGHLIGHTS.both), 2);
  const ringAt = calls.findIndex((x) => x[0] === 'useProgram' && x[1] === r.ring), lightAt = calls.findIndex((x) => x[0] === 'useProgram' && x[1] === r.light);
  assert.ok(ringAt > 0 && lightAt > ringAt, 'the ring, then the glints');
  assert.equal(calls.filter((x) => x[0] === 'drawArrays').length, 4);
  assert.ok(calls.some((x) => x[0] === 'uniform4f' && x[1] === 'uOutlineColor' && Math.abs(x[5] - OUTLINE_ALPHA) < 1e-9), 'still: its breath whole');
  // neither: nothing
  calls.length = 0;
  assert.equal(r.draw(LIST(), renderer, 2, false, { glint: false, ring: false }), 0); assert.equal(calls.length, 0);
  // a node near enough to fill more than its tile: its ring's width fitted to the tile as its silhouette is
  const near = { alpha: 1, seed: 0.5, at: [0, 1.1, -1.2], rgb: nodeMarkRgb('logging'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 1.1, -1.2]] }] } };
  calls.length = 0;
  assert.equal(r.draw([near], renderer, 2, false, RESOURCE_HIGHLIGHTS.outline), 1);
  const s = r._nodes[0], fit = Math.min(1, GLINT_TILE / Math.max(Math.round(s.rect[2] * 640), Math.round(s.rect[3] * 480)));
  assert.ok(fit < 1, `the near node overfills its tile (fit ${fit})`);
  const ring = calls.filter((x) => x[0] === 'uniform1f' && x[1] === 'uRing').map((x) => x[2]);
  assert.deepEqual(ring, [Math.max(1, outlinePx(480) * fit)], 'its width in the tile\'s texels, as its silhouette was drawn');
  // and the ring's program goes with the pass
  calls.length = 0;
  const ringProgram = r.ring;
  r.dispose();
  assert.ok(calls.some((x) => x[0] === 'deleteProgram' && x[1] === ringProgram), 'the ring\'s program deleted');
  assert.equal(r.ring, null);
});

test('RESOURCE-HIGHLIGHTS the pass reads the player\'s choice each frame (the pref, its default the glints); the world host wires it as it was', () => {
  const looks = [];
  const fake = { draw: (list, r, t, still, look) => { looks.push(look); return list.length; }, dispose() {} };
  const renderer = { gl: {}, _camPos: [0, 0, 0], markForeignPass() {} };
  let tier = 'outline', t = 0;
  const pass = createNodeGlintPass(renderer, { glow: null, now: () => (t += 1), build: () => fake, start: () => () => true, idle: (fn) => fn(), reduced: () => false, look: () => highlightLook(tier) });
  const marks = [{ key: 'a', profession: 'herbalism', at: [0, 0, -5], w: 1, h: 1, pictures: [{}] }];   // kindled over the glow's 0.6 s - the clock a second a frame
  pass.draw(marks); pass.draw(marks);
  tier = 'both'; pass.draw(marks);
  assert.deepEqual(looks.slice(-2), [RESOURCE_HIGHLIGHTS.outline, RESOURCE_HIGHLIGHTS.both], 'a change takes effect at once');
  const fresh = [];
  const def = createNodeGlintPass(renderer, { glow: null, now: () => (t += 1), build: () => ({ draw: (l, r, t, s, look) => { fresh.push(look); return 1; }, dispose() {} }), start: () => () => true, idle: (fn) => fn(), reduced: () => false });
  def.draw(marks); def.draw(marks);
  assert.equal(fresh.at(-1), RESOURCE_HIGHLIGHTS.glint, 'the default pref\'s look');
  assert.match(src('src/render/nodeGlint.js'), /look = \(\) => highlightLook\(getPref\(RESOURCE_HIGHLIGHT_PREF\)\) \} = \{\}\) \{/);
  assert.match(src('src/scenes/world.js'), /const nodeGlintPass = createNodeGlintPass\(renderer\);/, 'bootWorld unchanged: the choice is the pass\'s to read');
});

test('AUDIT GATHER F9: a build that fails lets go of every program - the constructor the ones it built, the pass the ones it started', () => {
  for (const failLink of [1, 2, 3]) {
    const { gl, calls } = fakeGl({ failLink });
    assert.throws(() => new NodeGlintRenderer(/** @type {any} */ (gl)));
    const made = calls.filter((x) => x[0] === 'createProgram').length, freed = calls.filter((x) => x[0] === 'deleteProgram').length;
    assert.equal(made, failLink); assert.equal(freed, made, `the link ${failLink} failing: every program made is deleted`);
  }
  const { gl, calls } = fakeGl({ failLink: 2 });
  const pass = createNodeGlintPass({ gl, _camPos: [0, 0, 0], markForeignPass() {} }, { glow: null, now: () => 1, idle: (fn) => fn(), reduced: () => false });
  pass.draw([{ key: 'a', at: [0, 0, -5], rgb: [1, 1, 1], pictures: [{}] }]);   // the programs started (three), the build at idle fails on the second
  assert.equal(pass.pass, null);
  assert.equal(calls.filter((x) => x[0] === 'createProgram').length, 3, 'three started');
  assert.equal(calls.filter((x) => x[0] === 'deleteProgram').length, 3, 'and all three let go: the first the constructor\'s, the failing one its own, the third released');
  assert.equal(NG.NODE_GLINT_PROGRAMS.length, 3);
});
