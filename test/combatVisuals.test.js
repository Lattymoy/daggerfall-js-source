// ECV1 - ENHANCED COMBAT VISUALS (2026-09-07, Mac: "ill let you lead
// this. This can fold into a new toggle Enhanced Combat Visuals").
//
// What the enhanced skin DRAWS for a magically concealed foe. The rules
// are DFU's and untouched: an imp casts Chameleon on itself (ImpSpells
// 0x2C), EntityConcealmentBehaviour disables its renderer, it keeps
// acting and taking hits. On the classic skin, or with the switch off,
// every host still takes that A5 skip verbatim. On: chameleon shimmers,
// a shade is a silhouette, invisibility stays hidden, and a hit on an
// unseen foe flashes it for REVEAL_SECONDS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLEND_ALPHA, BLEND_SHIMMER, BLEND_HZ, SHADE_ALPHA, SHADE_DARK, REVEAL_SECONDS, REVEAL_ALPHA, CONCEAL_MODE,
  combatVisualsOn, concealVisual, foeDraw, markConcealedHit, foePhase,
} from '../src/systems/combatVisuals.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { Renderer } from '../src/render/renderer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const ent = (...kinds) => ({ activeEffects: kinds.map((kind) => ({ kind })) });

test('ECV1: the switch - the enhanced skin and the pref, with ?combatvisuals=off as the kill switch', () => {
  assert.equal(PREF_DEFAULTS.enhancedCombatVisuals, true, 'on by default, like the other enhanced visuals');
  assert.equal(combatVisualsOn('', true), true);
  assert.equal(combatVisualsOn('', false), false, 'the pref is the switch');
  assert.equal(combatVisualsOn('?skin=classic', true), false, 'the classic skin never draws it');
  assert.equal(combatVisualsOn('?combatvisuals=off', true), false, 'the kill switch');
  assert.match(read('src/ui/enhancedMenu.js'), /prefRow\('enhancedCombatVisuals', 'Enhanced combat visuals',/, 'the Enhanced menu carries the row');
});

test('ECV1: the law - plain, hidden, and the three concealed draws with invisible over blending over shade', () => {
  assert.equal(concealVisual({}, { t: 1 }), null, 'unconcealed: nothing to draw specially (the host asks foeDraw, which says plain)');
  assert.equal(concealVisual({ invisible: true }, { t: 1 }), null, 'invisibility stays hidden');
  const b = concealVisual({ blending: true }, { t: 0, phase: 0 });
  assert.equal(b.mode, CONCEAL_MODE.blend);
  assert.equal(b.alpha, BLEND_ALPHA, 'the shimmer starts at its base at t=0, phase 0');
  const q = concealVisual({ blending: true }, { t: 1 / (4 * BLEND_HZ), phase: 0 });
  assert.ok(Math.abs(q.alpha - (BLEND_ALPHA + BLEND_SHIMMER)) < 1e-9, 'a quarter period on, the shimmer peaks');
  for (let t = 0; t < 3; t += 0.05) {
    const a = concealVisual({ blending: true }, { t, phase: 1.7 }).alpha;
    assert.ok(a >= BLEND_ALPHA - BLEND_SHIMMER - 1e-9 && a <= BLEND_ALPHA + BLEND_SHIMMER + 1e-9, 'the shimmer stays in its band');
  }
  const s = concealVisual({ shade: true }, { t: 2, phase: 0.3 });
  assert.deepEqual(s, { mode: CONCEAL_MODE.shade, alpha: SHADE_ALPHA, t: 2, phase: 0.3 });
  assert.equal(concealVisual({ invisible: true, blending: true, shade: true }, { t: 1 }), null, 'invisible wins');
  assert.equal(concealVisual({ blending: true, shade: true }, { t: 1 }).mode, CONCEAL_MODE.blend, 'blending beats shade');
});

test('ECV1: the hit reveal - a landed blow flashes any concealed foe, invisibility included, fading over REVEAL_SECONDS', () => {
  const at = concealVisual({ invisible: true }, { t: 10, hitAt: 10 });
  assert.equal(at.mode, CONCEAL_MODE.reveal);
  assert.equal(at.alpha, REVEAL_ALPHA, 'brightest at the hit');
  const half = concealVisual({ blending: true }, { t: 10 + REVEAL_SECONDS / 2, hitAt: 10 });
  assert.equal(half.mode, CONCEAL_MODE.reveal, 'the reveal overrides the shimmer while it runs');
  assert.ok(Math.abs(half.alpha - REVEAL_ALPHA / 2) < 1e-9, 'halfway, half as bright');
  assert.equal(concealVisual({ invisible: true }, { t: REVEAL_SECONDS, hitAt: 0 }), null, 'over: hidden again');
  assert.equal(concealVisual({ shade: true }, { t: REVEAL_SECONDS, hitAt: 0 }).mode, CONCEAL_MODE.shade, 'over: the shade again');
  assert.equal(concealVisual({ shade: true }, { t: 9, hitAt: 10 }).mode, CONCEAL_MODE.shade, 'a hit in the future is no hit');
  const foe = {};
  markConcealedHit(foe, 4.5);
  assert.equal(foe._ecvHit, 4.5);
  const p = foePhase(foe, () => 0.25);
  assert.ok(Math.abs(p - Math.PI / 2) < 1e-9, 'the phase is the roll over a full turn');
  assert.equal(foePhase(foe, () => 0.9), p, 'minted once');
});

test('ECV1: foeDraw - the host\'s one question, reading the entity\'s effects; off is the A5 skip verbatim', () => {
  assert.deepEqual(foeDraw(ent(), true, { t: 1 }), { kind: 'plain' });
  assert.deepEqual(foeDraw(ent('chameleonNormal'), false, { t: 1 }), { kind: 'hidden' }, 'switch off: EntityConcealmentBehaviour disables the renderer');
  assert.deepEqual(foeDraw(ent('invisNormal'), true, { t: 1 }), { kind: 'hidden' });
  assert.deepEqual(foeDraw(ent('invisTrue'), true, { t: 1 }), { kind: 'hidden' });
  const c = foeDraw(ent('chameleonTrue'), true, { t: 0, phase: 0 });
  assert.equal(c.kind, 'conceal');
  assert.equal(c.visual.mode, CONCEAL_MODE.blend);
  assert.equal(foeDraw(ent('shadeNormal'), true, { t: 0 }).visual.mode, CONCEAL_MODE.shade);
  assert.equal(foeDraw(ent('invisNormal'), true, { t: 1, hitAt: 0.9 }).visual.mode, CONCEAL_MODE.reveal, 'a hit shows even an invisible foe');
});

// A recording renderer: a Proxy GL that logs every call (the incident
// suite's harness).
function recordingRenderer(log) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  r._proj = new Float32Array(16); r._view = new Float32Array(16);
  log.length = 0;
  return r;
}
const calls = (log, name) => log.filter((c) => c[0] === name);
const batch = (archive, record, conceal = null) => ({ archive, record, frame: null, size: { w: 1, h: 2 }, origin: null, vao: {}, indexCount: 6, conceal });

test('ECV1: the renderer\'s concealed phase - blended, depth-writes off, one uConceal per batch, plain batches untouched', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.textures.set('255_1', {}); r.textures.set('255_2', {}); r.textures.set('255_3', {});
  const cham = { mode: CONCEAL_MODE.blend, alpha: 0.25, t: 3.5, phase: 1 };
  const shade = { mode: CONCEAL_MODE.shade, alpha: SHADE_ALPHA, t: 3.5, phase: 2 };
  r.drawBillboards([batch(255, 1), batch(255, 2, cham), batch(255, 3, shade)], [1, 0, 0], [0, 1, 0]);
  const draws = calls(log, 'drawElements');
  assert.equal(draws.length, 3, 'every batch drew once');
  const u4 = calls(log, 'uniform4f').map((c) => c.slice(2));
  assert.deepEqual(u4[0], [0, 0, 0, 0], 'the plain phase says plain');
  assert.deepEqual(u4[1], [CONCEAL_MODE.blend, 0.25, 3.5, 1], 'the chameleon batch carries its visual');
  assert.deepEqual(u4[2], [CONCEAL_MODE.shade, SHADE_ALPHA, 3.5, 2], 'the shade batch carries its visual');
  assert.deepEqual(u4[3], [0, 0, 0, 0], 'and the uniform is cleared after the phase');
  // order: the plain draw, then blend on + depth off, the two concealed draws, depth on + blend off
  const seq = log.filter((c) => ['drawElements', 'enable', 'disable', 'depthMask'].includes(c[0])).map((c) => (c[0] === 'drawElements' ? c[0] : c[0] + ':' + c[1]));
  assert.deepEqual(seq.slice(seq.indexOf('drawElements')), ['drawElements', 'enable:BLEND', 'depthMask:false', 'drawElements', 'drawElements', 'depthMask:true', 'disable:BLEND', 'enable:CULL_FACE']);
  // a concealed ghost keeps its spectral flag inside the concealed phase
  log.length = 0;
  r.textures.set('273_1', {});
  r.drawBillboards([batch(273, 1, cham)], [1, 0, 0], [0, 1, 0]);
  assert.equal(calls(log, 'drawElements').length, 1, 'a concealed spectral batch draws once, in the concealed phase');
  const drawAt = log.findIndex((c) => c[0] === 'drawElements');
  const lastFlag = log.slice(0, drawAt).filter((c) => c[0] === 'uniform1i').pop();
  assert.equal(lastFlag[2], 1, 'and takes the spectral flag there (the last uniform1i before its draw)');
});

test('ECV1: the billboard shader declares uConceal and draws each mode - the ripple, the dark shade, the opacity', () => {
  const r = read('src/render/renderer.js');
  const fs = r.slice(r.indexOf('const BB_FS = `'), r.indexOf('`;', r.indexOf('const BB_FS = `')));
  assert.match(fs, /uniform vec4 uConceal;/);
  assert.match(fs, /if \(uConceal\.x == 1\.0\) uv\.x \+= sin\(vUV\.y \* 28\.0 \+ uConceal\.z \* 7\.0 \+ uConceal\.w\) \* 0\.008;/, 'chameleon ripples');
  assert.match(fs, /vec4 tex = texture\(uTex, uv\);/, 'the rippled UV is what samples');
  assert.match(fs, /texture\(uEmissionTex, uv\)/, 'the emission map too');
  assert.match(fs, /if \(tex\.a < \(\(uSpectral == 1 \|\| uConceal\.x > 0\.0\) \? 0\.1 : 0\.5\)\) discard;/, 'the concealed pass takes the blended threshold');
  assert.match(fs, new RegExp(`if \\(uConceal\\.x == 2\\.0\\) lit \\*= ${String(SHADE_DARK).replace('.', '\\.')};`), 'a shade is pulled to black by SHADE_DARK');
  assert.match(fs, /if \(uConceal\.x > 0\.0\) alpha = tex\.a \* uConceal\.y;/, 'the visual\'s opacity');
  assert.match(r, /this\.bbUConceal = gl\.getUniformLocation\(this\.bbProgram, 'uConceal'\);/);
  assert.match(r, /gl\.uniform4f\(this\.bbUConceal, c\.mode, c\.alpha, c\.t, c\.phase\);/);
});

test('ECV1: every foe host asks foeDraw where A5 skipped, stamps the hit where damage lands, and ticks its clock', () => {
  const hosts = ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js'];
  for (const h of hosts) {
    const s = read(h);
    assert.match(s, /import \{ combatVisualsOn, foeDraw, foePhase, markConcealedHit \} from '\.\.\/systems\/combatVisuals\.js';/, `${h} imports the law`);
    assert.match(s, /const ecv = foeDraw\(\w+\.entity, ecvOn, \{ t: _ecvT, hitAt: \w+\._ecvHit \?\? -Infinity, phase: foePhase\(\w+\) \}\);\s*\n\s*if \(ecv\.kind === 'hidden'\) continue;\s*\n\s*\w+\.batch\.conceal = ecv\.kind === 'conceal' \? ecv\.visual : null;/, `${h}: the draw asks, skips hidden, and hands the visual to the batch`);
    assert.doesNotMatch(s, /if \(isMagicallyConcealed\(\w+\.entity\)\) continue;/, `${h}: the bare A5 skip is inside foeDraw now`);
    assert.match(s, /if \(damage > 0\) markConcealedHit\(\w+, _ecvT\);/, `${h}: a landed blow stamps the clock`);
    assert.match(s, /_ecvT \+= dt;/, `${h}: the clock ticks`);
    assert.match(s, /const ecvOn = combatVisualsOn\(\);/, `${h}: the switch is read once per frame`);
  }
  // the module owns the classic law: no host reads the pref or the skin for this
  for (const h of hosts) assert.doesNotMatch(read(h), /getPref\('enhancedCombatVisuals'\)/, `${h} does not re-derive the switch`);
});
