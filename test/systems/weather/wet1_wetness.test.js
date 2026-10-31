// WET1 (bible/07-Rendering/Weather-Arc.md WET1): the ground soaks in the front's rain and dries after, on the game's
// clock, and the lane's ground and walls draw it. The law is place-free - it reads the front at the player, wherever in
// Tamriel that is - so no case here names a place.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rainOf, wetStep, createWetness, wetOn, WET_SOAK_MIN, PUDDLE_FILL_MIN, WET_DRY_MIN, PUDDLE_DRY_MIN, WET_FULL_RAIN, PUDDLE_RAIN,
} from '../../../src/systems/weather/wetness.js';
import { EL_TERRAIN_FS, EL_MESH_FS } from '../../../src/render/enhancedLighting.js';
import { snowTerrainFs } from '../../../src/render/snowfallGlsl.js';
import { RIPPLE_RATE, WET_SHEEN_SOIL, WET_SHEEN_ROAD, PUDDLE_EDGE, PUDDLE_DARK, PUDDLE_GLOSS, PUDDLE_SHEEN_SOIL, PUDDLE_STRETCH, WIN_GLINT_LOD0 } from '../../../src/render/wetGlsl.js';
import { LAB_WX_FS } from '../../../src/render/precipitation.js';
import { Renderer } from '../../../src/render/renderer.js';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('WET1 rainOf: rain and storm wet at their intensity, less the snow share; snow, sand, ash and clear wet nothing', () => {
  assert.equal(rainOf('rain', 0.5), 0.5);
  assert.equal(rainOf('storm', 1), 1);
  assert.equal(rainOf('rain', 0.8, 0.5), 0.4);
  assert.equal(rainOf('rain', 2), 1);
  for (const k of ['snow', 'sand', 'ash', null, undefined]) assert.equal(rainOf(k, 1), 0, String(k));
});

test('WET1 wetStep: a downpour soaks the ground over WET_SOAK_MIN and fills the puddles over PUDDLE_FILL_MIN', () => {
  assert.deepEqual([WET_SOAK_MIN, PUDDLE_FILL_MIN, WET_DRY_MIN, PUDDLE_DRY_MIN, WET_FULL_RAIN, [...PUDDLE_RAIN]], [10, 45, 120, 240, 0.25, [0.3, 0.8]]);
  const s = wetStep({ wet: 0, puddle: 0 }, 1, 5);
  close(s.wet, 0.5, 'half soaked at half the soak');
  close(s.puddle, 5 / 45, 'the puddles slower');
  assert.deepEqual(wetStep({ wet: 0.9, puddle: 0 }, 1, 60), { wet: 1, puddle: 1 }, 'capped at the target');
});

test('WET1 wetStep: a dry spell dries the ground over WET_DRY_MIN and the puddles over PUDDLE_DRY_MIN', () => {
  const s = wetStep({ wet: 1, puddle: 1 }, 0, 60);
  close(s.wet, 0.5, 'half dry');
  close(s.puddle, 0.75, 'the puddles last longer');
  assert.deepEqual(wetStep({ wet: 0.1, puddle: 0.1 }, 0, 600), { wet: 0, puddle: 0 }, 'never below dry');
});

test('WET1 wetStep: a sprinkle darkens the ground but stands no puddle; a shower past PUDDLE_RAIN[0] does', () => {
  const sprinkle = wetStep(null, 0.1, NaN);
  close(sprinkle.wet, 0.4, 'a sprinkle\'s wet');
  assert.equal(sprinkle.puddle, 0);
  close(wetStep(null, 0.55, NaN).puddle, 0.5, 'a shower half way up the puddle band');
});

test('WET1 wetStep: a first tick or a clock run back lands on the weather whole; a rest has run its course', () => {
  const dry = { wet: 0, puddle: 0 };
  assert.deepEqual(wetStep(null, 1, 1), { wet: 1, puddle: 1 });
  assert.deepEqual(wetStep(dry, 1, -5), { wet: 1, puddle: 1 });
  assert.deepEqual(wetStep(dry, 1, NaN), { wet: 1, puddle: 1 });
  assert.deepEqual(wetStep({ wet: 1, puddle: 1 }, 0, 8 * 60), dry, 'a night\'s rest after the rain: dry');
});

test('WET1 createWetness: the uniform is [wet, puddle, seconds mod 1000, rain], integrated on the game minutes; ?wet=off keeps it dry', () => {
  const w = createWetness({ on: () => true });
  w.tick({ minutes: 100, shown: null, intensity: 0, tsec: 1 });
  assert.deepEqual([...w.uniform], [0, 0, 1, 0], 'a dry first tick');
  w.tick({ minutes: 105, shown: 'rain', intensity: 1, tsec: 1001.5 });
  assert.deepEqual([...w.uniform], [0.5, Math.fround(5 / 45), 1.5, 1]);
  const off = createWetness({ on: () => false });
  assert.deepEqual([...off.tick({ minutes: 0, shown: 'storm', intensity: 1, tsec: 3 })], [0, 0, 3, 0]);
  assert.equal(wetOn('?wet=off'), false);
  assert.equal(wetOn('?x=1'), true);
  assert.ok(Number.isInteger(RIPPLE_RATE * 1000), 'the ripples\' phase is whole at the clock\'s wrap');
});

test('WET1 the lane draws it: the ground and the walls read uWet, glint every lamp and the sun in the wet, and show the sky', () => {
  for (const [name, fs] of [['terrain', EL_TERRAIN_FS], ['mesh', EL_MESH_FS]]) {
    assert.ok(fs.includes('uniform vec4 uWet;'), name);
    assert.ok(fs.includes('elPointLitWet(vWorldPos, n, wetG, wetGlint)'), `${name}: the lamps in the wet`);
    assert.ok(fs.includes('wetSunGlint(n, wetV, diff / max(ndl, 1e-4), wetG)'), `${name}: the sun in the wet`);
    assert.ok(/outColor = vec4\(elFinish\([^\n]*\n  outColor\.rgb = wetSky\(outColor\.rgb, n, wetV, wetG/.test(fs), `${name}: the sky over the finished colour`);
    assert.ok(!fs.includes('elPointLit(vWorldPos, n)'), `${name}: no dry lantern loop left`);
  }
  assert.ok(EL_TERRAIN_FS.includes('vec2 wetW = wetGround(vLocalXZ, n, wetAt.x, wetAt.y);'), 'the ground\'s puddles');
});

test('WET1 the Snowfall variant: the mod\'s snow replaces the decode and says it is dry, once', () => {
  const fs = snowTerrainFs(EL_TERRAIN_FS);
  assert.equal(fs.split('vec2 wetAt = ').length - 1, 1, 'one wetAt');
  assert.ok(fs.includes('vec2 wetAt = vec2(1.0, 0.0);'), 'the snow is never wet ground');
  assert.ok(!fs.includes('vec2 wetAt = vec2(snowC'), 'the ground\'s own is cut with its decode');
});

test('WET1 the renderer: setWet stores and moves the frame stamp on a change alone; beginFrame dries it', () => {
  const r = Object.create(Renderer.prototype);
  r._frameStamp = 0;
  r.setWet(new Float32Array([0.5, 0.25, 3, 1]));
  assert.deepEqual([...r._wet], [0.5, 0.25, 3, 1]);
  assert.equal(r._frameStamp, 1);
  r.setWet(new Float32Array([0.5, 0.25, 3, 1]));
  assert.equal(r._frameStamp, 1, 'the same wet uploads nothing again');
  r.setWet(null);
  assert.deepEqual([...r._wet], [0.5, 0.25, 3, 1], 'null is no word');
  const src = readFileSync(new URL('../../../src/render/renderer.js', import.meta.url), 'utf8');
  const begin = src.slice(src.indexOf('  beginFrame(proj, view, lightDir, opts = null) {'), src.indexOf('this._frameStamp++;   // PERF3'));
  assert.ok(begin.includes('this._wet?.fill(0);'), 'an interior or a dungeon never inherits the street\'s wet');
});

test('WET1b: soil stays matte, a road sheens, a puddle mirrors, and the puddle edge is wide', () => {
  assert.ok(WET_SHEEN_SOIL < WET_SHEEN_ROAD && WET_SHEEN_ROAD < 0.4);
  assert.ok(PUDDLE_EDGE >= 0.2, 'a narrow step draws a line around the puddle');
  assert.ok(EL_TERRAIN_FS.includes('wetGlossGround(wetW, road)') && EL_TERRAIN_FS.includes('elSpecK'));
  assert.ok(!EL_MESH_FS.includes('wetGlossGround(wetW'), 'a wall is not a road');
  assert.match(LAB_WX_FS, /smoothstep\(0\.0,0\.35,vT\) \* 0\.22/);
});

test('WET1d: a puddle is dark water with a point of each lamp and lit window in it; soil stays matte', () => {
  assert.ok(PUDDLE_DARK <= 0.25, 'a lamp\'s diffuse pool on the water reads as matte stone');
  assert.ok(PUDDLE_GLOSS >= 4000, 'a tall Blinn column needs a tight lobe and a stretch squeeze');
  assert.ok(PUDDLE_STRETCH >= 5, 'squeeze along the view on the ground shortens the lamp streak');
  assert.ok(WIN_GLINT_LOD0 >= 0.5, 'stone panes scatter a quarter more than the first dial');
  assert.ok(WET_SHEEN_SOIL <= WET_SHEEN_ROAD / 10, 'soil sheen is a tenth of a road\'s');
  assert.ok(PUDDLE_SHEEN_SOIL <= 0.15, 'a soil puddle is damp, not glass');
  assert.ok(EL_TERRAIN_FS.includes('elWetPow = mix('), 'the ground tightens the lobe in a puddle');
  assert.ok(EL_TERRAIN_FS.includes('road = roadAmt(data, unwrapped)'), 'soil↔stones smear at the paving\'s edge');
  assert.ok(EL_TERRAIN_FS.includes('soilK = mix(0.1, 1.0, road)'), 'soil\'s lamp and window glints are a tenth');
  assert.ok(EL_TERRAIN_FS.includes('winGlint(vWorldPos, n, wetV, elWetPow, soilScatter)'), 'a lit window glints in the puddle');
  assert.ok(EL_TERRAIN_FS.includes('soilScatter = (1.0 - road) * 0.4'), 'soil scatters more than stone, lightly');
  assert.ok(EL_TERRAIN_FS.includes('reflect(-V, n)'), 'the glass is mirrored, not the lamp');
  assert.ok(EL_TERRAIN_FS.includes('winGlintOcc('), 'a bush between the puddle and the pane hides it');
  assert.ok(EL_TERRAIN_FS.includes('length(c0.xyz - uCamPos)'), 'blur follows distance to the window, not the puddle underfoot');
  assert.ok(EL_TERRAIN_FS.includes('softIn') && EL_TERRAIN_FS.includes('fade'), 'far dissolves the hard square, not only the lattice');
  assert.ok(EL_TERRAIN_FS.includes('mix(0.33, 0.0, blur)'), 'stone softIn is a quarter wider');
  assert.ok(EL_TERRAIN_FS.includes('PUDDLE_STRETCH') || EL_TERRAIN_FS.includes('exp(-a * a / t2'), 'lamp streak is squeezed along the view');
  assert.ok(!EL_MESH_FS.includes('winGlint(vWorldPos'), 'a wall is not a puddle');
});

test('WET1c: rain runs down a roof and off its face, not down a wall or the ground', () => {
  assert.ok(EL_MESH_FS.includes('roofRunoff(wetAlbedo'), 'the building shader runs it');
  assert.ok(EL_MESH_FS.includes('smoothstep(0.4, 0.72, n.y) * uWet.w'), 'only an upward face, and only while rain falls');
  assert.ok(!EL_TERRAIN_FS.includes('roofRunoff(wetAlbedo'), 'the ground is puddles, not a roof');
});
