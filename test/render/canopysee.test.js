// CANOPY-SEE (Mac, 2026-10-31: "a sort of transparency when your overworld traveling in valenwood. Under the tall
// trees"; bible/06-Systems/Travel-View.md CANOPY-SEE): under the travel view a 3D tree between the eye and the traveller
// keeps TREE_SEE.keep of its fragments by the screen-door; flats, trees off the sight line and trees past the traveller
// stay whole. Run on the shader's own text (test/glsl.mjs), with the port's bayer4.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LPT_FS_HEAD, LPT_FS_KEEP, LPT_FS_TEXEL, TREE_SEE } from '../../src/render/lowPolyTreesGlsl.js';
import { BAYER_GLSL } from '../../src/render/orderedDither.js';
import { EL_BB_FS } from '../../src/render/enhancedLighting.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

const FS = `${LPT_FS_HEAD}\n${BAYER_GLSL}\nvec4 shade(vec4 tex) {\n${LPT_FS_KEEP}${LPT_FS_TEXEL}\n return tex; }`;
// a high eye over a Valenwood road, the traveller's head under it (the travel view's TV_HEIGHT_DEFAULT and tilt)
const EYE = [0, 260, -200], HEAD = [0, 1.6, 0];
const D = Math.hypot(HEAD[0] - EYE[0], HEAD[1] - EYE[1], HEAD[2] - EYE[2]);
const dir = HEAD.map((h, i) => (h - EYE[i]) / D);
/** a world point `along` metres down the sight line, `off` metres to its side (across x, square to it) */
const at = (along, off = 0) => [EYE[0] + dir[0] * along + off, EYE[1] + dir[1] * along, EYE[2] + dir[2] * along];
/** how many of bayer4's 16 cells keep the fragment */
function keptOf(world, { fade = 3, focus = [...HEAD, 1], eye = EYE } = {}) {
  let n = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const f = glslFunctions(FS, { vShade: [1, 1, 1], vAlpha: 1, vFade: fade, gl_FragCoord: [x + 0.5, y + 0.5, 0, 1], uFocus: focus, uCamPos: eye, vBBWorld: world });
    try { f.shade([1, 1, 1, 1]); n++; } catch (e) { if (!(e instanceof GlslDiscard)) throw e; }
  }
  return n;
}
const KEEP = Math.round(TREE_SEE.keep * 16);

test('CANOPY-SEE the window: a tree on the sight line keeps 4 of 16 - near the eye, midway, and over the traveller\'s head; off the cone, behind the eye and at the traveller it is whole; the rim and the near end ease (mutants: no window; the keep; the cone; the near end; the eye\'s back)', () => {
  assert.deepEqual({ ...TREE_SEE }, { core: 0.11, rim: 0.06, near: 2, ease: 10, keep: 0.25 }, 'about 6 degrees open, shut by 10; whole 2 m short of the traveller');
  for (const along of [20, D / 2, D - TREE_SEE.near - TREE_SEE.ease - 1]) assert.equal(keptOf(at(along)), KEEP, `on the line at ${along.toFixed(0)} m`);
  const mid = D / 2, side = (ang) => at(mid, Math.tan(ang) * mid);
  assert.equal(keptOf(side(TREE_SEE.core * 0.9)), KEEP, 'inside the core');
  assert.equal(keptOf(side(TREE_SEE.core + TREE_SEE.rim + 0.01)), 16, 'past the rim: whole');
  assert.equal(keptOf(side(0.18)), 16, 'whole by 0.18 rad');
  assert.equal(keptOf(side(0.10)), KEEP, 'open at 0.10 rad');
  const rim = keptOf(side(TREE_SEE.core + TREE_SEE.rim / 2));
  assert.ok(rim > KEEP && rim < 16, `the rim eases (${rim})`);
  assert.equal(keptOf(at(D - TREE_SEE.near + 0.5)), 16, 'at the traveller: whole - the trunk beside them, the ground under them');
  assert.equal(keptOf(at(D + 20)), 16, 'past the traveller: whole');
  const ease = keptOf(at(D - TREE_SEE.near - TREE_SEE.ease / 2));
  assert.ok(ease > KEEP && ease < 16, `the near end eases (${ease})`);
  assert.equal(keptOf(at(-30)), 16, 'behind the eye, on the line\'s own axis: whole');
});

test('CANOPY-SEE only a 3D tree under the travel view: a flat on the line is whole; no focus, nothing cut; an eye at the traveller (the rise\'s first frame) cuts nothing (mutants: the flats cut; the focus unasked)', () => {
  assert.equal(keptOf(at(D / 2), { fade: 1 }), 16, 'a flat (vFade 1)');
  assert.equal(keptOf(at(D / 2), { focus: [0, 0, 0, 0] }), 16, 'no travel view');
  const near = [HEAD[0], HEAD[1] + 1.5, HEAD[2] - 1];
  assert.equal(keptOf([HEAD[0], HEAD[1] + 0.7, HEAD[2] - 0.5], { eye: near }), 16, 'the eye still in the head');
});

test('CANOPY-SEE in the handover band: a tree crossfading with its far picture keeps the lesser of its share and the window\'s, never less', () => {
  for (const pic of [0.1, 0.5, 0.9]) {
    const alone = keptOf(at(5000), { fade: 3 - pic }), inWin = keptOf(at(D / 2), { fade: 3 - pic });
    assert.equal(inWin, Math.min(alone, KEEP), `picture share ${pic}`);
  }
});

test('CANOPY-SEE both lanes\' billboard shaders declare what the window reads before the trees\' fragment half', () => {
  const classic = readFileSync(new URL('../../src/render/renderer.js', import.meta.url), 'utf8').split('const BB_FS = `')[1].split('`;')[0];
  for (const [name, src] of [['BB_FS', classic], ['EL_BB_FS', EL_BB_FS]]) {
    const texel = src.includes('${LPT_FS_TEXEL}') ? src.indexOf('${LPT_FS_TEXEL}') : src.indexOf(LPT_FS_TEXEL);
    assert.ok(texel > 0, `${name} takes the trees' fragment half`);
    for (const decl of ['in vec3 vBBWorld;', 'uniform vec3 uCamPos;']) {
      const d = src.indexOf(decl);
      assert.ok(d >= 0 && d < texel, `${name}: ${decl}`);
    }
    const fog = ['${FOG_GLSL}', '${EL_FOG_GLSL}', 'uniform vec4 uFocus;'].map((k) => src.indexOf(k)).filter((i) => i >= 0);
    assert.ok(fog.length && Math.min(...fog) < texel, `${name}: uFocus (the fog's block) before it`);
  }
});
