// UW-GLOW (player report: a candle or torch underwater is "a near-white/grey disc of light around the player"):
// the lane's in-scatter gain is EL_SCATTER x the fog's density, and the dungeon's underwater murk (UnderwaterFog,
// exp 0.25) is ten times the medium the gain was tuned in - the glow it integrated washed the view out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EL_LANE, EL_SCATTER, EL_SCATTER_DENSITY_MAX, EL_EXPOSURE, elScatter, elTonemapRGB, elEncode, elDecode } from '../../src/render/enhancedLighting.js';
import { AIR_ADAPT_MAX } from '../../src/render/airPass.js';
import { UnderwaterFog, WATER_FOG_COLOR, applyFog } from '../../src/render/underwaterFog.js';
import { CANDLE } from '../../src/scenes/magicCandle.js';
import { EYE_HEIGHT, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { Renderer } from '../../src/render/renderer.js';

function recordingGl() {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const gainUnder = (fog) => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  applyFog(r, fog);
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  return calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uELScatter')[0][2];
};

test('UW-GLOW: the Light spell\'s candle under the dungeon\'s water lights the murk as a halo, not a white disc - the screen centre\'s glow over the water fog stays under mid-grey at the eye\'s widest adaptation; the thin fogs\' gain is EL_SCATTER x their own density, as before (mutants: the cap dropped; the cap applied to every fog)', () => {
  const fog = new UnderwaterFog().updateFog(0, -1e3, null);   // the eye far under the block's surface: fully submerged
  assert.equal(fog.mode, 'exp'); assert.equal(fog.density, 0.25);
  const gain = gainUnder(fog);
  assert.ok(gain > 0 && gain <= EL_SCATTER * EL_SCATTER_DENSITY_MAX + 1e-12, `the glow's gain is capped (${gain})`);
  // the candle: 1.4 ahead, at three quarters of the capsule; the eye at EYE_HEIGHT - the ray through the screen's centre
  const rel = [0, CAPSULE_HEIGHT * (0.5 + CANDLE.heightFraction) - EYE_HEIGHT, CANDLE.distance];
  const s = elScatter(rel, CANDLE.range, [0, 0, 1], 20, 1);
  const glow = elTonemapRGB([s, s, s].map((v) => v * gain * EL_EXPOSURE * AIR_ADAPT_MAX));
  const shown = WATER_FOG_COLOR.map((f, i) => elEncode(elDecode(f) + glow[i]));
  assert.ok(Math.max(...shown) < 0.5, `the centre reads ${shown.map((v) => Math.round(v * 255))} - a veil, not white`);
  // thinner media keep their glow exactly: DFU's dungeon fog and the tuning point itself
  assert.equal(gainUnder({ mode: 'exp', density: 0.005, start: 0, end: 0, color: [0, 0, 0] }), EL_SCATTER * 0.005);
  assert.equal(gainUnder({ mode: 'linear', density: 0, start: 10, end: 50, color: [0, 0, 0] }), EL_SCATTER / 40);
});
