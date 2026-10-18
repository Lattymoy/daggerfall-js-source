// WINDOW-WEATHER: depth at the real pane and in the captured street must decide which precipitation reaches the glass.
// The evaluator executes the generated fragment shader, so these checks exercise the shader's branches and samples.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowWeatherShaders, WW_SAND_NEEDLES } from '../../src/render/windowWeather.js';
import { WISP_VS, WISP_FS } from '../../src/render/windWisps.js';
import { GlslDiscard, glslFunctions } from '../glsl.mjs';

const identity4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX = { min: [-1, -1, -1], max: [1, 1, 1] };
const RECT = [0, 0, 20, 20];

function fragment(world, { street = 1, pane = 0, streetOn = 1, paneOn = 1, paneScale = [1, 1], sand = false } = {}) {
  const { fs } = sand ? windowWeatherShaders(WISP_VS, WISP_FS, WW_SAND_NEEDLES) : windowWeatherShaders();
  const samples = [];
  const f = glslFunctions(fs, {
    vT: 0.8,
    vSeed: 0.3,
    vWorld: world,
    uKind: 0,
    vLife: 1, uStrength: 1, uColor: [0.8, 0.6, 0.3], uAlpha: [0.2, 0.3],
    uRoomMin: BOX.min,
    uRoomMax: BOX.max,
    uGlassRect: RECT,
    gl_FragCoord: [10, 10, 0.5, 1],
    uStreetPV: identity4,
    uStreetDepth: 'uStreetDepth',
    uPaneDepth: 'uPaneDepth',
    uStreetDepthOn: streetOn,
    uPaneDepthOn: paneOn,
    uPaneScale: paneScale,
    texture: (sampler, uv) => {
      samples.push([sampler, [...uv]]);
      return [sampler === 'uStreetDepth' ? street : pane, 0, 0, 1];
    },
  });
  try {
    f.main();
    return { color: f.globals.o, samples };
  } catch (error) {
    if (error instanceof GlslDiscard) return { color: null, samples };
    throw error;
  }
}

test('WINDOW-WEATHER depth: the captured street occludes precipitation behind foreground geometry', () => {
  const hidden = fragment([0.2, -0.4, 0.6], { street: 0.7, pane: 0.4 });
  assert.equal(hidden.color, null, 'projected depth 0.8 is behind the street depth 0.7');
  const streetSample = hidden.samples.find(([sampler]) => sampler === 'uStreetDepth');
  assert.ok(streetSample, 'the street depth is sampled');
  assert.ok(Math.abs(streetSample[1][0] - 0.6) < 1e-9 && Math.abs(streetSample[1][1] - 0.3) < 1e-9, 'sampled at projected street UV');

  const visible = fragment([0, 0, 0.2], { street: 0.7, pane: 0.4 });
  assert.ok(visible.color, 'projected depth 0.6 is in front of the street depth 0.7');
  assert.ok(visible.samples.some(([sampler]) => sampler === 'uStreetDepth'));
  assert.ok(fragment([0, 0, 0.40001], { street: 0.7, pane: 0.2 }).color, 'the 1e-5 street tolerance avoids equality noise');
  assert.equal(fragment([0.2, -0.4, 0.6], { street: 0.7, pane: 0.4, sand: true }).color, null, 'sand behind the street is hidden too');
  assert.ok(fragment([0, 0, 0.2], { street: 0.7, pane: 0.4, sand: true }).color, 'sand in front of the street remains');
  const scaled = fragment([0.2, -0.4, 0.2], { street: 0.7, pane: 0.4, paneScale: [0.5, 0.75] });
  const paneUv = scaled.samples.find(([sampler]) => sampler === 'uPaneDepth')[1];
  assert.ok(Math.abs(paneUv[0] - 0.3) < 1e-9 && Math.abs(paneUv[1] - 0.225) < 1e-9, 'pane sampling uses its allocated texture share');
});

test('WINDOW-WEATHER depth: pane depth rejects room-side particles and retains a rotated-caravan exterior wedge', () => {
  const roomSide = fragment([0, 0, -0.4], { pane: 0.4 });
  assert.equal(roomSide.color, null, 'projected depth 0.3 is on the room side of pane depth 0.4');
  assert.ok(roomSide.samples.some(([sampler]) => sampler === 'uPaneDepth'));
  assert.equal(fragment([0, 0, 0.400005], { pane: 0.7 }).color, null, 'the 1e-5 pane tolerance rejects a point just on the room side');

  // A point in the world AABB of a 45-degree-turned square room but outside its diamond footprint.
  // It is beyond the pane, so AABB membership alone must not remove exterior weather.
  const rotatedCorner = fragment([0.9, 0.9, 0.6], { street: 1, pane: 0.4 });
  assert.ok(rotatedCorner.color, 'pane depth proves this AABB corner lies beyond the rotated room');
  assert.ok(rotatedCorner.samples.some(([sampler]) => sampler === 'uPaneDepth'));
  assert.ok(fragment([0.9, 0.9, 0.6], { street: 1, pane: 0.4, sand: true }).color, 'rotated-room sand uses the same pane boundary');
});

test('WINDOW-WEATHER depth: absent depth attachments retain the room-box fallback', () => {
  const inside = fragment([0, 0, 0], { streetOn: 0, paneOn: 0 });
  assert.equal(inside.color, null, 'without pane depth, preserve the existing AABB room discard');
  assert.equal(inside.samples.length, 0, 'disabled attachments are never sampled');
  assert.equal(fragment([0, 0, 0], { streetOn: 1, paneOn: 0 }).color, null, 'a street copy without pane depth still uses the room-box fallback');

  const outside = fragment([2, 0, 0], { streetOn: 0, paneOn: 0 });
  assert.ok(outside.color, 'weather beyond the fallback room box still draws');
  assert.equal(outside.samples.length, 0, 'no depth samples without attachments');
});
