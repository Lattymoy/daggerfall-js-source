// The ground soaks in the front's rain and dries after, on the game's
// clock, and the lane's ground and walls draw it. The law is place-free - it reads the front at the player, wherever in
// Tamriel that is - so no case here names a place.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rainOf, wetStep, createWetness, wetOn, wetWorldMode, puddleProxyOn, WET_SOAK_MIN, PUDDLE_FILL_MIN, WET_DRY_MIN, PUDDLE_DRY_MIN, WET_FULL_RAIN, PUDDLE_RAIN,
} from '../../../src/systems/weather/wetness.js';
import { FEATURES } from '../../../src/systems/features.js';
import { GRAPHICS_PRESETS, PRESET_ROWS } from '../../../src/systems/graphicsPresets.js';
const rd = (p) => readFileSync(p, 'utf8');
import { EL_TERRAIN_FS, EL_MESH_FS } from '../../../src/render/enhancedLighting.js';
import { snowTerrainFs } from '../../../src/render/snowfallGlsl.js';
import { RIPPLE_RATE, RIPPLE_WIDTH, RIPPLE_SLOPE, RIPPLE_NEAR_M, RIPPLE_GROW1, WET_SHEEN_SOIL, WET_SHEEN_ROAD, PUDDLE_EDGE, PUDDLE_DARK, PUDDLE_GLOSS, PUDDLE_SHEEN_SOIL, PUDDLE_STRETCH, WIN_GLINT_LOD0, PUDDLE_FLAT, PUDDLE_SALT, PUDDLE_SPREAD, RAIN_WET_GLSL, RAIN_GROUND_GLSL } from '../../../src/render/wetGlsl.js';
import { PUDDLE_PASS_FS, PUDDLE_BLEND_FS, WET_PROXY_DIST_M, WET_PROXY_DIST_FAR_M, WET_PROXY_STEPS, WET_PROXY_GATE, WET_PROXY_AIM0_M, WET_PROXY_AIM1_M, WET_PROXY_MIN_HIT_Y, WET_PROXY_BELOW_EYE_M, WET_PROXY_NEAR_M, WET_PROXY_FAR_M, WET_PROXY_ALPHA, WET_PROXY_BLUR0, PUDDLE_PROXY_FLAT, PUDDLE_PROXY_SPREAD, PUDDLE_PROXY_EDGE, PUDDLE_PROXY_SALT } from '../../../src/render/puddleProxyGlsl.js';
import { airPassPrograms } from '../../../src/render/airPass.js';
import { SNOW_TILE_M } from '../../../src/render/snowCoverGlsl.js';
import { LAB_WX_FS, LAB_WX_VS, packShelters, SHELTER_MAX, SHELTER_REACH_M } from '../../../src/render/precipitation.js';
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
  assert.equal(wetWorldMode('?wet=off'), 'off');
  assert.equal(puddleProxyOn('?wet=off'), false);
  assert.ok(Number.isInteger(RIPPLE_RATE * 1000), 'the ripples\' phase is whole at the clock\'s wrap');
});

test('WET1 settings: wet-world row on Graphics, High/Ultra ship Full (puddle mirrors)', () => {
  const row = FEATURES.find((f) => f.id === 'wet-world');
  assert.ok(row);
  assert.deepEqual(row.control.tiers.map(([v]) => v), ['full', 'wet', 'off']);
  assert.equal(row.control.key, 'wetWorld');
  assert.equal(row.control.initial, 'full');
  assert.equal(row.control.online, 'player');
  assert.ok(PRESET_ROWS.includes('wet-world'));
  const v = Object.fromEntries(GRAPHICS_PRESETS.map((p) => [p.id, p.values['wet-world']]));
  assert.deepEqual(v, { low: 'off', medium: 'wet', high: 'full', ultra: 'full' });
  assert.equal(v.high, row.control.initial, 'High is how the game ships');
  assert.equal(puddleProxyOn(''), true, 'default Full runs the colour proxy');
  assert.match(rd('src/ui/settings/settingsMap.js'), /'feat:water-quality',\s*'feat:wet-world'/);
  assert.match(rd('src/render/airPass.js'), /puddleProxyOn\(\)/, 'Full tier gates the colour proxy');
  assert.match(rd('src/render/renderer.js'), /key === 'terrain' \|\| key === 'snow'/, 'snow ground gets uWetProxy too');
  assert.ok(EL_TERRAIN_FS.includes('uWetProxy') && EL_TERRAIN_FS.includes('1.0 - uWetProxy'), 'Wet tier keeps winGlint');
});

test('WET1 the lane draws it: the ground and the walls read uWet, glint every lamp and the sun in the wet, and show the sky', () => {
  for (const [name, fs] of [['terrain', EL_TERRAIN_FS], ['mesh', EL_MESH_FS]]) {
    assert.ok(fs.includes('uniform vec4 uWet;'), name);
    assert.ok(fs.includes('elPointLitWet(vWorldPos, n, wetG, wetGlint)'), `${name}: the lamps in the wet`);
    assert.ok(fs.includes('wetSunGlint(n, wetV, diff / max(ndl, 1e-4), wetG)'), `${name}: the sun in the wet`);
    assert.ok(/outColor = vec4\(elFinish\([^\n]*\n  outColor\.rgb = wetSky\(outColor\.rgb, n, wetV, wetG/.test(fs), `${name}: the sky over the finished colour`);
    assert.ok(!fs.includes('elPointLit(vWorldPos, n)'), `${name}: no dry lantern loop left`);
  }
  assert.ok(EL_TERRAIN_FS.includes('vec2 wetW = wetGround(vLocalXZ, n, wetAt.x, wetAt.y, road);'), 'the ground\'s puddles only on paving');
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
  assert.equal(WET_SHEEN_SOIL, 0, 'soil never sheens');
  assert.equal(WET_SHEEN_ROAD, 0, 'paving without a puddle never mirrors');
  assert.ok(PUDDLE_EDGE >= 0.2, 'a narrow step draws a line around the puddle');
  assert.ok(EL_TERRAIN_FS.includes('wetGlossGround(wetW, road)') && EL_TERRAIN_FS.includes('elSpecK'));
  assert.ok(RAIN_WET_GLSL.includes('return w.y * road'), 'ground mirror gloss is puddle×road alone');
  assert.ok(!EL_MESH_FS.includes('wetGlossGround(wetW'), 'a wall is not a road');
  assert.match(LAB_WX_FS, /smoothstep\(0\.0,0\.35,vT\) \* 0\.22/);
});

test('WET1d: a puddle is dark water with a point of each lamp and lit window in it; soil stays matte', () => {
  assert.ok(PUDDLE_DARK <= 0.25, 'a lamp\'s diffuse pool on the water reads as matte stone');
  assert.ok(PUDDLE_GLOSS >= 512 && PUDDLE_GLOSS <= 2048, 'a tight lobe + stretch; 4500 pow() was GPU-heavy');
  assert.ok(PUDDLE_STRETCH >= 5, 'squeeze along the view on the ground shortens the lamp streak');
  assert.ok(WIN_GLINT_LOD0 >= 0.5, 'stone panes scatter a quarter more than the first dial');
  assert.equal(WET_SHEEN_SOIL, 0, 'soil sheen is off');
  assert.equal(WET_SHEEN_ROAD, 0, 'damp stone without a puddle is not a sheet');
  assert.equal(PUDDLE_SHEEN_SOIL, 0, 'a soil puddle never mirrors');
  assert.ok(EL_TERRAIN_FS.includes('elWetPow = mix('), 'the ground tightens the lobe in a puddle');
  assert.ok(EL_TERRAIN_FS.includes('road = roadAmt(data, unwrapped)'), 'soil↔stones smear at the paving\'s edge');
  assert.ok(EL_TERRAIN_FS.includes('soilK = mix(0.1, 1.0, road)'), 'soil\'s lamp and window glints are a tenth');
  assert.ok(EL_TERRAIN_FS.includes('pudGlint > 0.0') && EL_TERRAIN_FS.includes('lit += winGlint('), 'dry / proxy-owned puddles skip the pane march');
  assert.ok(EL_TERRAIN_FS.includes('soilScatter = (1.0 - road) * 0.4'), 'soil scatters more than stone, lightly');
  assert.ok(EL_TERRAIN_FS.includes('reflect(-V, n)'), 'the glass is mirrored, not the lamp');
  assert.ok(EL_TERRAIN_FS.includes('winGlintOcc('), 'a bush between the puddle and the pane hides it');
  assert.ok(EL_TERRAIN_FS.includes('length(c0.xyz - uCamPos)'), 'blur follows distance to the window, not the puddle underfoot');
  assert.ok(EL_TERRAIN_FS.includes('softIn') && EL_TERRAIN_FS.includes('fade'), 'far dissolves the hard square, not only the lattice');
  assert.ok(EL_TERRAIN_FS.includes('mix(0.33, 0.0, blur)'), 'stone softIn is a quarter wider');
  assert.ok(EL_TERRAIN_FS.includes('PUDDLE_STRETCH') || EL_TERRAIN_FS.includes('exp(-a * a / t2'), 'lamp streak is squeezed along the view');
  assert.ok(!EL_MESH_FS.includes('winGlint(vWorldPos'), 'a wall is not a puddle');
  assert.ok(!EL_MESH_FS.includes('winGlintOcc('), 'mesh does not compile the puddle pane march');
});

test('WET1e: puddle colour is a separate half-res pass, not terrain FS', () => {
  assert.ok(WET_PROXY_DIST_M >= 30 && WET_PROXY_DIST_FAR_M >= 50 && WET_PROXY_FAR_M >= 60 && WET_PROXY_STEPS >= 4 && WET_PROXY_GATE >= 0.15);
  assert.ok(WET_PROXY_AIM1_M > WET_PROXY_AIM0_M && WET_PROXY_AIM0_M >= 1 && WET_PROXY_AIM1_M >= 8, 'vertical span covers a facade, not a strip');
  assert.equal(PUDDLE_PROXY_SALT, PUDDLE_SALT);
  assert.equal(PUDDLE_PROXY_SPREAD, PUDDLE_SPREAD);
  assert.equal(PUDDLE_PROXY_EDGE, PUDDLE_EDGE);
  assert.ok(WET_PROXY_FAR_M > WET_PROXY_NEAR_M && WET_PROXY_NEAR_M >= 4, 'smooth distance fade');
  assert.deepEqual([...PUDDLE_PROXY_FLAT], [...PUDDLE_FLAT]);
  assert.ok(PUDDLE_PASS_FS.includes(` / ${SNOW_TILE_M}`), 'same tile metres as wetGround');
  assert.ok(PUDDLE_PASS_FS.includes('uFrame') && PUDDLE_PASS_FS.includes('uVP'), 'this frame colour + VP');
  assert.ok(PUDDLE_PASS_FS.includes('best') && PUDDLE_PASS_FS.includes('sampleBlur'), 'best hit in the vertical span + blur');
  assert.ok(PUDDLE_PASS_FS.includes('length(sceneW - rayP)'), 'world-space confidence');
  assert.ok(PUDDLE_PASS_FS.includes('maxT') && PUDDLE_PASS_FS.includes(`${WET_PROXY_DIST_FAR_M}`), 'search grows when backing off');
  assert.ok(PUDDLE_PASS_FS.includes(`${WET_PROXY_BLUR0}`), 'blur dial in the sample');
  assert.ok(!PUDDLE_PASS_FS.includes('uPrevColor'), 'no fixed prevColour stamp');
  assert.ok(!PUDDLE_PASS_FS.includes('bool behind(') && !PUDDLE_PASS_FS.includes('vec4 band('), 'no dual-band helpers (stripes)');
  assert.equal(WET_SHEEN_ROAD, 0, 'non-puddle road sheen off');
  assert.ok(PUDDLE_PASS_FS.includes(`${WET_PROXY_MIN_HIT_Y}`), 'reject ground self-hits');
  assert.ok(PUDDLE_PASS_FS.includes(`${WET_PROXY_BELOW_EYE_M}`), 'skip flat roofs above the eye');
  assert.ok(PUDDLE_PASS_FS.includes('distFade') && PUDDLE_PASS_FS.includes(`${WET_PROXY_FAR_M}`), 'fade in with approach');
  assert.ok(PUDDLE_PASS_FS.includes('nFlat'), 'level mirror, not noisy half-res normals');
  assert.ok(PUDDLE_PASS_FS.includes('pudNoise') && PUDDLE_PASS_FS.includes('flatN'), 'mask is wetGround-shaped blobs');
  assert.ok(PUDDLE_PASS_FS.includes('uEcoOrigin') && PUDDLE_PASS_FS.includes('wp.xz - uRoadMap.xy'), 'mask uses the terrain lattice, not raw world xz');
  assert.ok(PUDDLE_PASS_FS.includes('roadGate') && PUDDLE_PASS_FS.includes('uRoadMap'), 'colour proxy only on stone');
  assert.ok(RAIN_GROUND_GLSL.includes('uWet.y > 0.0 && road > 0.001') && !RAIN_GROUND_GLSL.includes('if (wet <= 0.0) return'), 'puddles outlast the sheen');
  assert.ok(PUDDLE_PASS_FS.includes(`${WET_PROXY_ALPHA}`), 'mirror alpha dial');
  assert.ok(PUDDLE_DARK <= 0.12, 'puddles darker than wet stone');
  assert.ok(EL_TERRAIN_FS.includes('pudGlint') && EL_TERRAIN_FS.includes('uWetProxy'), 'lamp/window glints yield while Full proxy runs');
  assert.ok(EL_TERRAIN_FS.includes('wetW.y * road'), 'glints gated to paving puddles');
  assert.ok(EL_TERRAIN_FS.includes('wetSky(outColor.rgb, n, wetV, wetG * 0.35)'), 'sky sheet only from road-puddle gloss');
  assert.ok(RAIN_GROUND_GLSL.includes('smoothstep(0.2, 0.55, road)'), 'soil stands no puddle');
  assert.ok(!EL_TERRAIN_FS.includes('mix(1.0, 1.25, wetW.y)'), 'no sky boost stacking on the proxy');
  assert.ok(RIPPLE_RATE <= 1.5 && RIPPLE_GROW1 >= 0.7 && RIPPLE_WIDTH >= 0.1, 'ripples live long enough to spread');
  assert.ok(RAIN_WET_GLSL.includes('mix(0.5, 1.55') && RAIN_WET_GLSL.includes('mix(0.6, 1.45'), 'drop size and width vary');
  assert.ok(RAIN_WET_GLSL.includes('1.0 - smoothstep(0.78, 1.0, age)') && RAIN_WET_GLSL.includes(`1.0 - smoothstep(${RIPPLE_NEAR_M * 0.4}`), 'soft late age + distance fade');   // rise, then 1 - smoothstep

  assert.ok(PUDDLE_BLEND_FS.includes('uPuddle'), 'resolve blend reads the half-res out');
  assert.ok(!EL_TERRAIN_FS.includes('uPrevColor'), 'terrain FS must not sample prev colour (TDR)');
  assert.ok(!EL_TERRAIN_FS.includes('bool behind(') && !EL_TERRAIN_FS.includes('PUDDLE_PASS'), 'colour proxy stays out of terrain FS');
  assert.ok(airPassPrograms({ vs: { mesh: 'm', bb: 'b' } }, false).some((p) => p[1] === PUDDLE_PASS_FS), 'air boot lists the pass');
  const airSrc = readFileSync(new URL('../../../src/render/airPass.js', import.meta.url), 'utf8');
  const blend = airSrc.slice(airSrc.indexOf('  _puddleProxy(rect) {'), airSrc.indexOf('  release() {'));
  assert.ok(blend.includes('gl.activeTexture(gl.TEXTURE0);') && blend.includes('gl.bindTexture(gl.TEXTURE_2D, frameImg.puddle)'), 'blend samples puddle on unit 0, not depth');
  assert.ok(airSrc.includes('_wetRoadDummy'), 'usampler2D always has an R8UI bound');
});

test('WET1c: rain runs down a roof and off its face, not down a wall or the ground', () => {
  assert.ok(EL_MESH_FS.includes('roofRunoff(wetAlbedo'), 'the building shader runs it');
  assert.ok(EL_MESH_FS.includes('smoothstep(0.4, 0.72, n.y) * uWet.w'), 'only an upward face, and only while rain falls');
  assert.ok(!EL_TERRAIN_FS.includes('roofRunoff(wetAlbedo'), 'the ground is puddles, not a roof');
});

test('WET1c: packShelters keeps the nearest boxes and the lab culls floor-to-roof', () => {
  const xz = new Float32Array(SHELTER_MAX * 4), y = new Float32Array(SHELTER_MAX * 2);
  const eye = [0, 1.6, 0];
  const near = { aabb: { min: [-2, 0, -2], max: [2, 8, 2] } };
  const far = { aabb: { min: [SHELTER_REACH_M + 10, 0, 0], max: [SHELTER_REACH_M + 14, 8, 4] } };
  assert.equal(packShelters(xz, y, [far, near], eye), 1);
  assert.deepEqual([...xz.slice(0, 4)], [-2, -2, 2, 2]);
  assert.deepEqual([...y.slice(0, 2)], [0, 8]);
  const many = Array.from({ length: SHELTER_MAX + 5 }, (_, i) => ({ aabb: { min: [i, 1, i], max: [i + 1, 5, i + 1] } }));
  assert.equal(packShelters(xz, y, many, eye), SHELTER_MAX, 'cap at SHELTER_MAX');
  assert.ok(LAB_WX_VS.includes('p.y > yy.x - 0.2 && p.y < yy.y + 0.4'), 'cull is inside the volume, not under a floating roof');
});
