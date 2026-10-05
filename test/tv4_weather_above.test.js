// TV4 (2026-09-28, bible/06-Systems/Travel-View.md, Mac: "Every detail like weather patterns, should be 1:1 in this
// mode").
//
// Pinned here: the curtains stood in the world for the view (render/rainCurtains.js - which cells fall, where the veil
// stands and how tall, its fade as the eye comes over it, the chord law in its shader, the fog from the traveller, the
// pass's own state), the four weather readings from the air measured against the laws that already hold them (the
// cloud shadow's square covers everything the view's fog lets through; the far ring under an exp fog is fog at its
// nearest edge, so its gate changes nothing; a strike's column stands on the traveller's ground), and the world host's
// wiring by source. The frame itself is proven in a browser by tools/travelViewProbe.mjs (TV4's four checks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  curtainsOf, curtainClock, CURTAINS_MAX, CURTAIN_REACH_M, CURTAIN_BELOW_M, CURTAIN_FS, CURTAIN_VS, CURTAIN_CLOCK_PERIOD, CURTAIN_FALL_HZ,
  CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, CURTAIN_FOOT_MARGIN_M, CURTAIN_OWN_ALPHA, CURTAIN_FOOT_SAMPLES, lowestGround, RainCurtainsRenderer,
} from '../src/render/rainCurtains.js';
import { CURTAIN_SHARE, CURTAIN_EXT, CURTAIN_INTO, CURTAIN_FALL, SHADOW_EXTENT, PIXEL_METRES, VC_PROFILE, cellOf } from '../src/render/volumetricClouds.js';
import { FOG_SETTINGS, scaleFogForDistance, fogForWeather } from '../src/world/weather.js';
import { LAND_VIEW_MAX, LAND_VIEW_DEFAULT } from '../src/world/landView.js';
import { strikeColumn } from '../src/systems/lightning.js';
import { TV_HEIGHT_MAX, TV_TILT_MIN } from '../src/player/travelCamera.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── THE CURTAINS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('TV4 curtains: the cells that FALL stand a veil - rain, the storm\'s heavier, snow paler; fog, cloud and a sandstorm stand none - VC7c\'s own cells and law', () => {
  const at = { focus: [0, 101.7, 0], eye: [0, 400, -300], ground: 100 };
  const cells = ['rain', 'thunder', 'snow', 'fog', 'cloudy', 'overcast', 'sandstorm', 'sunny'].map((w, i) => cellOf(w, 1000 + i * 10, 2000, 800));
  const got = curtainsOf(cells.filter(Boolean), at);
  assert.equal(got.length, 3, 'rain, thunder, snow');
  assert.deepEqual(Object.keys(CURTAIN_FALL).sort(), ['rain', 'snow', 'thunder']);
  const [r] = got.filter((c) => c.kind === 0).slice(0, 1);
  assert.equal(r.radius, 800 * CURTAIN_SHARE, 'the fall comes out of the core');
  assert.equal(r.depth, CURTAIN_EXT * CURTAIN_FALL.rain[0]);
  assert.equal(got.filter((c) => c.kind === 1).length, 1, 'snow, its own kind');
  const base = VC_PROFILE.rain.base + (VC_PROFILE.rain.top - VC_PROFILE.rain.base) * CURTAIN_INTO;
  assert.deepEqual(r.centre, [1000, 100 - CURTAIN_BELOW_M, 2000], 'its foot under the traveller\'s ground - the world\'s depth cuts it where the land is');
  assert.ok(near(r.height, 100 + base - (100 - CURTAIN_BELOW_M)), 'up a little into the cell it falls from');
  assert.deepEqual(CURTAIN_RAIN_COLOR.length, 3); assert.ok(CURTAIN_SNOW_COLOR[0] > CURTAIN_RAIN_COLOR[0], 'snow paler');
});

test('TV4 curtains: within reach of the traveller and no further, nearest first and at most CURTAINS_MAX; a young system\'s thinner; a storm\'s clip keeps its veil inside its disc', () => {
  const at = { focus: [0, 0, 0], eye: [0, 300, -200] };
  const cell = (x, z, fall = 1, extra = {}) => ({ x, z, r: 1000, base: 600, top: 2600, fall, fallKind: 0, ...extra });
  const far = CURTAIN_REACH_M + 1000 * CURTAIN_SHARE;
  assert.equal(curtainsOf([cell(far + 1, 0)], at).length, 0, 'past the reach');
  assert.equal(curtainsOf([cell(far - 1, 0)], at).length, 1, 'its rim within it');
  const many = Array.from({ length: 12 }, (_, i) => cell(2000 + i * 300, 0));
  const got = curtainsOf(many.reverse(), at);
  assert.equal(got.length, CURTAINS_MAX);
  assert.deepEqual(got.map((c) => c.centre[0]), got.map((c) => c.centre[0]).sort((a, b) => a - b), 'nearest first');
  assert.equal(curtainsOf([cell(3000, 0, 0.5)], at)[0].depth, CURTAIN_EXT * 0.5, 'a young system\'s rain is young too (grownCell\'s fall)');
  assert.equal(curtainsOf([cell(3000, 0, 0)], at).length, 0, 'nothing falls, no veil');
  assert.equal(curtainsOf([cell(3000, 0, 1, { clip: [9000, 0, 2000] })], at).length, 0, 'outside the disc its front paints within');
  assert.equal(curtainsOf([cell(3000, 0, 1, { clip: [3200, 0, 2000] })], at).length, 1);
  assert.deepEqual(curtainsOf(null, at), []);
});

test('TV4 curtains: the veil thins to nothing as the eye comes over it - the rain the traveller stands in is their own particles\'', () => {
  const c = { x: 0, z: 0, r: 1000, base: 600, top: 2600, fall: 1, fallKind: 0 };
  const R = 1000 * CURTAIN_SHARE;
  const alphaAt = (ex, fx = R * 3) => curtainsOf([c], { focus: [fx, 0, 0], eye: [ex, 300, 0] })[0]?.alpha ?? 0;
  assert.equal(alphaAt(R * 2), 1, 'from outside it: whole');
  assert.equal(alphaAt(R * 0.8), 0, 'the eye over its core: gone');
  const mid = alphaAt(R);
  assert.ok(mid > 0 && mid < 1, `across its rim it fades (${mid})`);
  // AUDIT TV D2: the traveller inside it with the eye still out - the storm's whole chord stood in front of their own ground
  assert.equal(alphaAt(R * 2, R * 0.5), CURTAIN_OWN_ALPHA, 'the traveller in the rain: thinned, not a wall between them and the eye - AUDIT DEEP R-5: and not gone, their own storm stays a storm from the air');
  assert.ok(alphaAt(R * 2, R) > CURTAIN_OWN_ALPHA && alphaAt(R * 2, R) < 1, 'at its rim: fading');
  assert.equal(alphaAt(R * 0.8, R * 0.5), 0, 'the eye over its core: gone, the traveller\'s floor or not');
  // AUDIT DEEP R-6: past the frame\'s fog nothing is stood; a veil stays inside its storm\'s disc
  const far = { x: 3000, z: 0, r: 1000, base: 600, top: 2600, fall: 1, fallKind: 0 };
  assert.equal(curtainsOf([far], { focus: [0, 0, 0], eye: [0, 300, -200], reach: 2000 }).length, 0, 'wholly fogged: not stood');
  assert.equal(curtainsOf([far], { focus: [0, 0, 0], eye: [0, 300, -200], reach: 4000 }).length, 1);
  // AUDIT DEEP2 D1: a veil near its front's edge keeps its own size - the clip is weighed in the shader across its rim,
  // as the sky's own veil is (shrunk to the disc, a storm 50 m inside its front was a column 50 m wide)
  const edge = curtainsOf([{ ...far, clip: [3000 - 700, 0, 800] }], { focus: [0, 0, 0], eye: [0, 300, -200] })[0];
  assert.equal(edge.radius, far.r * CURTAIN_SHARE, 'its own reach');
  assert.deepEqual([edge.clip.x, edge.clip.z, edge.clip.r], [2300, 0, 800], 'the clip carried to the shader');
  assert.equal(curtainsOf([{ ...far, clip: [0, 0, 500] }], { focus: [0, 0, 0], eye: [0, 300, -200] }).length, 0, 'wholly outside its front: nothing falls');
});

test('AUDIT TV D1/D3: the curtains come in with the view as OPACITY, never as a darker colour; the foot reaches under the LOWEST land about the veil (a valley under the storm), never above the traveller\'s own rule', () => {
  // D3: the foot
  const c = { x: 5000, z: 0, r: 1000, base: 600, top: 2600, fall: 1, fallKind: 0 };
  const R = 1000 * CURTAIN_SHARE;
  const at = { focus: [0, 101.7, 0], eye: [0, 400, -300], ground: 100 };
  assert.equal(curtainsOf([c], at)[0].centre[1], 100 - CURTAIN_BELOW_M, 'no host land: the traveller\'s rule');
  const valley = (x, z) => (Math.hypot(x - 5000, z) > R * 0.9 ? -900 : -200);
  const v = curtainsOf([c], { ...at, groundAt: valley })[0];
  assert.equal(v.centre[1], -900 - CURTAIN_FOOT_MARGIN_M, 'the valley floor at its rim, less the margin');
  const top0 = curtainsOf([c], at)[0];
  assert.ok(near(v.centre[1] + v.height, top0.centre[1] + top0.height), 'the top stays in the cell it falls from');
  const hill = () => 800;
  assert.equal(curtainsOf([c], { ...at, groundAt: hill })[0].centre[1], 800 - CURTAIN_FOOT_MARGIN_M, 'AUDIT DEEP R-4: a highland - the foot on ITS land, the traveller\'s rule only where no land is known');
  // AUDIT DEEP R-4: off a coast - the host hands the SEA's surface (and its margin) over the water, and the veil stops at it
  const offshore = (x) => (x > 5000 - R * 1.5 ? 0 + CURTAIN_FOOT_MARGIN_M : 5);   // the storm stands out at sea, the traveller on the beach
  assert.equal(curtainsOf([c], { ...at, ground: 2, groundAt: offshore })[0].centre[1], 0, 'the foot at the surface - no veil hung 300 m down through clear water');
  const hole = (x, z) => (Math.hypot(x - 5000, z) > R * 0.4 && Math.hypot(x - 5000, z) < R * 0.6 ? -500 : 0);
  assert.equal(curtainsOf([c], { ...at, groundAt: hole })[0].centre[1], -500 - CURTAIN_FOOT_MARGIN_M, 'a valley half way in is looked for too');
  assert.equal(lowestGround(() => -Infinity, 0, 0, 10), Infinity, 'land unknown everywhere: nothing learned');
  const asked = [];
  lowestGround((x, z) => { asked.push([x, z]); return 0; }, 0, 0, 10);
  assert.equal(asked.length, 2 * CURTAIN_FOOT_SAMPLES + 1, 'the rim, half way in, and the centre');
  assert.ok(asked.some(([x, z]) => x === 0 && z === 0));
  // D1: the fade
  const calls = [];
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z_]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); }) });
  const u = Object.fromEntries(['uVP', 'uCentre', 'uRadius', 'uHeight', 'uEye', 'uDepth', 'uAlpha', 'uTime', 'uColor', 'uLight', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uDwFog', 'uFocus'].map((n) => [n, n]));
  const fake = { gl, u, program: 'p', vao: 'v', count: 6, _vp: new Float32Array(16), drawn: 0 };
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const list = [{ centre: [0, 0, 0], radius: 100, height: 500, depth: 0.001, kind: 0, alpha: 1 }];
  const drawn = RainCurtainsRenderer.prototype.draw.call(fake, list, I, I, [0, 10, 0], 1, { light: 0.8, fade: 0.25 });
  assert.equal(drawn, 1);
  const f1 = (n) => calls.filter((x) => x[0] === 'uniform1f' && x[1] === n).map((x) => x[2]);
  assert.deepEqual(f1('uAlpha'), [0.25], 'the rise fades its opacity');
  assert.deepEqual(f1('uLight'), [0.8], 'and leaves its colour the frame\'s own');
  calls.length = 0;
  assert.equal(RainCurtainsRenderer.prototype.draw.call(fake, list, I, I, [0, 10, 0], 1, { light: 0.8, fade: 0 }), 0, 'nothing risen: nothing drawn');
  assert.equal(calls.length, 0, 'and nothing touched');
});

test('TV4 curtains: THE CHORD - a front face\'s optical depth is the line of sight\'s path through the solid cylinder, a back face\'s none; streaks slide down with the fall on a wrapped clock; fogged from the traveller; premultiplied', () => {
  assert.match(CURTAIN_FS, /float c = len > 1e-3 \? max\(0\.0, dot\(vNormal, toEye \/ len\)\) : 0\.0;\n\s*float chord = 2\.0 \* vReach \* c;/, '2 R cos, and zero facing away - R the outline\'s own reach at that bearing (AUDIT DEEP2 D1)');
  assert.match(CURTAIN_FS, /float a = \(1\.0 - exp\(-tau\)\) \* top \* clip \* uAlpha \* fogFactorAt\(vWorld\);/);
  assert.match(CURTAIN_FS, /o = vec4\(uColor \* uLight \* a, a\);   \/\/ premultiplied/);
  assert.match(CURTAIN_FS, /uniform vec4 uFocus;/, 'the fog block\'s focus - the traveller\'s');
  assert.match(CURTAIN_VS, /float r = uRadius \* shapeF\(uShapeA, uShapeB, n\);\n\s*vec3 p = uCentre \+ vec3\(n\.x \* r, aUV\.y \* uHeight, n\.y \* r\);/);
  assert.equal(CURTAIN_CLOCK_PERIOD % (1 / CURTAIN_FALL_HZ), 0, 'a whole number of falls over the clock - no stutter at the wrap');
  assert.equal(curtainClock(CURTAIN_CLOCK_PERIOD + 3), 3);
  assert.equal(curtainClock(-1), CURTAIN_CLOCK_PERIOD - 1);
  const src = rd('src/render/rainCurtains.js');
  assert.match(src, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\);\n\s*gl\.depthMask\(false\);\n\s*gl\.disable\(gl\.CULL_FACE\);/, 'over the frame, no depth written, both faces to the shader');
  assert.match(src, /if \(U\.uFocus\) gl\.uniform4fv\(U\.uFocus, fog\?\.focus \?\? NO_FOCUS\);/);
  assert.match(src, /gl\.enable\(gl\.CULL_FACE\);\n\s*gl\.depthMask\(true\);\n\s*gl\.disable\(gl\.BLEND\);/, 'and the state handed back');
});

// ── THE REST OF THE WEATHER, FROM THE AIR ───────────────────────────────────────────────────────────────────────────

test('TV4 shadows: the cloud shadow\'s square covers everything the view\'s fog lets through, at the widest band and the furthest grid - so the shadows over the whole view are the clouds\' own, unchanged', () => {
  const nearEdge = SHADOW_EXTENT / 2 - PIXEL_METRES / 2;   // the square snaps to the pixel grid: its nearest edge off the traveller
  const back = TV_HEIGHT_MAX / Math.tan(TV_TILT_MIN);   // the eye's furthest stand-back
  for (const w of ['sunny', 'cloudy', 'overcast']) {
    const fog = scaleFogForDistance(fogForWeather(w), LAND_VIEW_MAX);
    assert.equal(fog.mode, 'linear', `${w}: the far ring's weather`);
    assert.ok(fog.end + back <= nearEdge, `${w}: fogged out at ${fog.end + back} m, the shadow to ${nearEdge} m`);
  }
  for (const [w, row] of Object.entries(FOG_SETTINGS)) {
    if (row.mode !== 'exp' || w === 'interior' || w === 'dungeon') continue;
    assert.ok(Math.exp(-row.density * nearEdge) < 1e-6, `${w}: nothing seen past the shadow's edge`);
  }
});

test('TV4 far ring: under an exp fog the ring\'s nearest edge is already fog at the default grid - the gate that hides it hides nothing a traveller would see; under light weather (linear) it stands as ever', () => {
  const ringNear = LAND_VIEW_DEFAULT * PIXEL_METRES;
  for (const w of ['rainy', 'snowy', 'heavy', 'sandstorm']) assert.ok(Math.exp(-FOG_SETTINGS[w].density * ringNear) < 1e-4, `${w}: fog at ${ringNear} m`);
  const farRing = rd('test/farring.test.js');
  assert.match(farRing, /exp fog \(weather\) hides the ring/, 'the gate stands, pinned where it was');
  assert.match(rd('src/scenes/world.js'), /if \(farRing && fogNow\.mode === 'linear'\)/);
});

test('TV4 lightning: a strike\'s column stands on the traveller\'s ground - from the raised eye its foot hung 448 m in the air', () => {
  const head = [0, 101.7, 0], raised = [0, 550, -350];
  const onGround = strikeColumn(head, 3000, 0, 500, 1.7);
  assert.ok(Math.abs(onGround.groundY - 100) < 1, 'from the head, the ground');
  const fromAir = strikeColumn(raised, 3000, 0, 500, 1.7);
  assert.ok(fromAir.groundY > 500, 'from the raised eye it would be in the air - the bug');
  assert.match(rd('src/scenes/world.js'), /stormLights\.frame\(\{ seconds: now \/ 1000, eye: tvf \? cam\.pos : mwv\.eye, distant: struckFar,/);
});

test('AUDIT DEEP R-1: EVERY fogged program under the travel view measures its fog from the traveller - it uploads the focus itself, or the renderer does it for it; the rest never draw under the view, each named with its reason', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../src/render/', import.meta.url);
  const fogged = readdirSync(dir).filter((f) => f.endsWith('.js')).filter((f) => /\$\{FOG_GLSL\}|\$\{FOG_FACTOR_GLSL\}/.test(readFileSync(new URL(f, dir), 'utf8')));
  const RENDERER_OWNED = { 'renderer.js': 'its own programs (_fogLocs, _waterLocs, _uploadFog)', 'waterSurface.js': 'the renderer\'s _waterLocs upload it' };
  const DW_SENT = { 'oceanHolesRender.js': 'Deep Waters\' _frameUniforms sends it (merged beside OH-C)' };
  const NEVER_UNDER_THE_VIEW = { 'deadlands.js': 'the Burning Court alone - no sky, no view', 'gateTelegraph.js': 'the Burning Court alone', 'spoilsGlow.js': 'the Burning Court alone', 'courtCrystals.js': 'the Burning Court alone (WB9c: the Reckoning\'s crystals)', 'gateFx.js': 'the Burning Court alone (WB9e: his blows\' sparks, the meteor)', 'auraRing.js': 'a wearer\'s feet in the walking views - the hosts draw no aura under the travel view (WB9g: world.js auraFrame)', 'nodeGlow.js': 'a gathering node near the walker - the host lights none under the travel view (NODE-MARKS: world.js drawVeiledPeerBodies, the glow\'s own gate; the compass keeps the marks)' };
  for (const f of fogged) {
    if (RENDERER_OWNED[f] || NEVER_UNDER_THE_VIEW[f]) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.match(src, /'uFocus'/, `${f}: the focus located`);
    if (DW_SENT[f]) assert.match(src, /this\.dw\._frameUniforms\(u\);/, `${f}: and uploaded - ${DW_SENT[f]}`);
    else assert.match(src, /gl\.uniform4fv\([^\n]*uFocus/, `${f}: and uploaded`);
  }
  // Deep Waters: every fogged program of its own locates the focus, and the frame's uniforms send it
  const dw = readFileSync(new URL('deepWatersRender.js', dir), 'utf8');
  for (const prog of ['floor', 'under', 'skyFog', 'decor']) {
    const at = dw.indexOf(`${prog}: { p: ${prog}, u: locs(gl, ${prog}, [`);
    assert.ok(at > 0 && dw.slice(at, dw.indexOf(']) },', at)).includes("'uFocus'"), `Deep Waters' ${prog} locates the focus`);
  }
  assert.match(dw, /if \(u\.uFocus\) gl\.uniform4fv\(u\.uFocus, r\._focus\);   \/\/ AUDIT DEEP R-1: the travel view's focus/);
  assert.match(dw, /gl\.uniform4fv\(u\.uDwFog, r\._dwFog\);\n\s*if \(u\.uFocus\) gl\.uniform4fv\(u\.uFocus, r\._focus\);   \/\/ AUDIT DEEP R-1\n/, 'and the sky fog\'s own');
  const dwall = readFileSync(new URL('duelWall.js', dir), 'utf8');
  assert.match(dwall, /if \(U\.uFocus\) gl\.uniform4fv\(U\.uFocus, fog\?\.focus \?\? NO_FOCUS\);/);
  // GUILD1d (2026-09-30) joined the list: the guild halls' banners hang in the streets the view flies over, and upload it
  assert.match(readFileSync(new URL('bannerPass.js', dir), 'utf8'), /if \(U\.uFocus\) gl\.uniform4fv\(U\.uFocus, fog\?\.focus \?\? NO_FOCUS\);/);
  assert.match(rd('src/scenes/world.js'), /const hung = bannersHung\(\);[\s\S]{0,650}dw: renderer\._dwFog, focus: renderer\._focus \},/, 'the banners handed it');
  // NAV-B (2026-09-28) joined the list: the naval pass's smoke, flashes and aim ride Come Sail Away's frame, under the view too
  assert.deepEqual(fogged.filter((f) => !RENDERER_OWNED[f] && !NEVER_UNDER_THE_VIEW[f]).sort(), ['bannerPass.js', 'comeSailAwayRender.js', 'deepWatersRender.js', 'duelWall.js', 'foeTelegraph.js', 'gatePass.js', 'navalRender.js', 'oceanHolesRender.js', 'rainCurtains.js', 'riteSmoke.js', 'serpentRender.js', 'spellImpactFx.js'], 'the passes the view draws, all accounted for (merged beside CSA-F and OH-C: the boats\' parts and waves, the pits; NAV-B: the sea fight\'s; WB12d: the rite\'s smoke; SERPENT1: the sea serpent over the open sea; IMPACTFX: a spell\'s landing - the world pass draws the missiles, and so their bursts, under the view too)');
  // IMPACTFX (2026-10-05) joined the list: the cast engine hands its burst pass the renderer\'s focus
  assert.match(rd('src/scenes/hostMagic.js'), /fxPass\.draw\([^\n]*camPos: eye, focus: renderer\._focus \}\);/, 'the spell impacts handed it');
  const w = rd('src/scenes/world.js');
  assert.match(w, /camPos: renderer\._camPos, dw: renderer\._dwFog, focus: renderer\._focus \}\);   \/\/ DW-C/, 'the duel wall handed it');
  // R-11: the red storms stand round the traveller, and each peer shows the picture the view's eye sees
  assert.match(w, /const tvStand = tvf \? cam\.pos : mwv\.eye;[^\n]*\n\s*const gateSky = gateOmen\?\.sky\(tvStand, gateSkyTranslate\)/);
  assert.match(w, /dreadStorm\.tick\(\{ sharedMs: Date\.now\(\) \+ _sharedOffsetMs, eye: tvStand, weight: dreadW \}\)/);
  assert.match(w, /gateStorm\.tick\(\{ sharedMs: Date\.now\(\) \+ _sharedOffsetMs, eye: tvStand,/);
  assert.match(w, /dt, eye: travelView\?\.eye \?\? player\.pos, poseAgeMs:/);
  assert.match(w, /camPos: renderer\._camPos, focus: renderer\._focus \}\)\) renderer\.markForeignPass\(\);   \/\/ AUDIT DEEP R-1/, 'the gate handed it');
  // the gate's own upload, driven: a fake GL hears the focus it was handed, and w 0 without one
  const { GatePassRenderer } = await import('../src/render/gatePass.js');
  {
    const heard = [];
    const fake = { gl: { uniform1i() {}, uniform1f() {}, uniform2fv() {}, uniform3fv() {}, uniform4fv: (l, v) => heard.push([l, [...v]]) } };
    GatePassRenderer.prototype._fog.call(fake, { uFocus: 'F', uFogMode: 1, uFogDensity: 2, uFogRange: 3, uCamPos: 4 }, { mode: 1, focus: new Float32Array([1, 2, 3, 1]) }, [0, 0, 0]);
    GatePassRenderer.prototype._fog.call(fake, { uFocus: 'F' }, null, [0, 0, 0]);
    assert.deepEqual(heard, [['F', [1, 2, 3, 1]], ['F', [0, 0, 0, 0]]]);
  }
});

test('TV4 host wiring: the curtains built on the enhanced lane, drawn under the travel view alone from the weather map\'s own cells, lit by the frame and fogged by its fog from the traveller, then the renderer told', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const rainCurtains = isEnhanced\(\) \? \(\(\) => \{ try \{ return new RainCurtainsRenderer\(renderer\.gl\); \}/);
  assert.match(w, /if \(tvf && rainCurtains\) \{\n\s*if \(_tvFootMemo\.gen !== tvGroundGenNow\(\)\) \{ _tvFootMemo\.gen = tvGroundGen; _tvFootMemo\.map\.clear\(\); \}[^\n]*\n\s*const curtains = curtainsOf\(sky\.drawnCells\?\.\(\) \?\? fieldCellsHere\(\), \{[^\n]*\n\s* focus: cam\.pos, eye: mwv\.eye, ground: player\.feetAt\(\)\[1\], groundAt: tvGroundAt, reach: renderer\._fogMode === 1 \? renderer\._fogRange\[1\] : undefined, memo: _tvFootMemo\.map \}\);/, 'the clouds\' own cells, the shared minute');
  assert.match(w, /\{ light: lit, fade: Math\.min\(1, tvf\.blend \* 1\.5\), fog:/, 'AUDIT TV D1: the rise is opacity');
  assert.match(w, /const tvGroundAt = \(x, z\) => \{\n\s*const n = state\.worldCoords\(\[x, 0, z\]\);\n\s*const g = tvSceneOf\(n\.x, n\.z\)\[1\];/, 'AUDIT TV D3: the grid\'s land, the far ring\'s past it');
  assert.match(w, /if \(!deepWaters\) return g;\n(\s*\/\/[^\n]*\n)*\s*return Math\.max\(g, tvSeaY\(\) \+ CURTAIN_FOOT_MARGIN_M\);/, 'AUDIT DEEP R-4: the sea\'s surface over the water - AUDIT DEEP2 D4: at every point, a coast\'s and a carved cell\'s in a land pixel too');
  assert.match(w, /const tvSeaY = \(\) => \(deepWaters\?\.oceanLocalY \?\? SCALED_OCEAN_ELEVATION \* STREAMING_TERRAIN_SCALE\) \+ state\.pixelTranslation\(state\.current\.x, state\.current\.y, _tvSeaT\)\[1\];/);
  assert.match(w, /water = !place && hit\.point\[1\] <= tvSeaY\(\) \+ TV_SEA_EPS_M;/, 'AUDIT DEEP2 B-5: water where the click landed');
  assert.match(w, /fog: \{ mode: renderer\._fogMode, density: renderer\._fogDensity, range: renderer\._fogRange, camPos: renderer\._camPos, focus: renderer\._focus, dw: renderer\._dwFog \} \}\)\) renderer\.markForeignPass\(\);/);
  assert.ok(((i, j) => i >= 0 && j >= 0 && i > j)(w.indexOf('rainCurtains.draw(curtains'), w.indexOf('gatePool.drawPass(proj, view')), 'after the world and its other foreign passes');
});

test('AUDIT DEEP2 D1/D3/D5 curtains: the veil stands in its storm\'s own outline (the sky\'s polynomial), reaches in from where its shape does, carries its front\'s shaped clip to the shader; a veil that cannot be drawn takes no slot; the host hands the cells the sky draws', async () => {
  const { packShape } = await import('../src/render/rainCurtains.js');
  const { shapeFactor, shapeBound } = await import('../src/systems/weatherMap.js');
  const shape = [0.9, 0.3, 0.2, 0.1, -0.05, 0.08, 0.02];
  assert.deepEqual(packShape(shape), [...shape, 0]);
  assert.deepEqual(packShape(null), [1, 0, 0, 0, 0, 0, 0, 0], 'a circle for none');
  // the GLSL is the sky's own polynomial, word for word
  const vc = readFileSync(new URL('../src/render/volumetricClouds.js', import.meta.url), 'utf8');
  const body = (src) => src.slice(src.indexOf('float shapeF(vec4 a, vec4 b, vec2 u) {'), src.indexOf('}', src.indexOf('float shapeF(vec4 a, vec4 b, vec2 u) {')) + 1);
  assert.ok(body(CURTAIN_VS).length > 60);
  assert.equal(body(CURTAIN_VS), body(vc), 'the curtain\'s outline is the cloud\'s');
  assert.equal(body(CURTAIN_FS), body(vc), 'and its clip\'s');
  // the clip weighed across the cell's rim in the storm's front's own measure - VC7c's veilAcross line for line
  assert.match(CURTAIN_FS, /float clip = uClip\.z > 0\.0 \? 1\.0 - smoothstep\(uClip\.z - uClip\.w, uClip\.z, shapedDist\(vWorld\.xz - uClip\.xy, uClipA, uClipB\)\) : 1\.0;/);
  assert.match(vc, /if \(k\.z > 0\.0\) w \*= 1\.0 - smoothstep\(k\.z - k\.w, k\.z, shapedDist\(xz - k\.xy, uCellKS\[i\], uCellKU\[i\]\)\);/, 'the sky\'s own');
  // a storm whose circle is past the reach but whose outline reaches in is stood - carrying its shape
  const at = { focus: [0, 0, 0], eye: [0, 300, -200], reach: 2000 };
  const R = 1000 * CURTAIN_SHARE;
  const long = { x: 2000 + R * 1.3, z: 0, r: 1000, base: 600, top: 2600, fall: 1, fallKind: 0, shape: [1, 0.6, 0, 0, 0, 0, 0] };   // stretched along x: 1.6 R toward the traveller
  assert.ok(near(shapeFactor(long.shape, -1, 0), 1.6), 'its outline reaches toward the traveller');
  const got = curtainsOf([long], at);
  assert.equal(got.length, 1, 'its outline within the reach');
  assert.deepEqual(got[0].shape, packShape(long.shape));
  assert.equal(curtainsOf([{ ...long, shape: null }], at).length, 0, 'the same storm a circle: past it');
  assert.ok(shapeBound(long.shape) >= shapeFactor(long.shape, 1, 0));
  // D5: the nearest of nine falls over a massif higher than its own top - it takes no slot, the ninth is stood
  const cells = Array.from({ length: 9 }, (_, i) => ({ x: 1000 + i * 400, z: 0, r: 600, base: 600, top: 900, fall: 1, fallKind: 0 }));
  const massif = (x) => (x < 1400 ? 4000 : 0);
  const nine = curtainsOf(cells, { focus: [0, 0, 0], eye: [0, 300, -200], ground: 0, groundAt: (x) => massif(x) });
  assert.equal(nine.length, CURTAINS_MAX, 'eight drawn');
  assert.ok(nine.every((c) => c.height > 0), 'every one drawable');
  assert.ok(!nine.some((c) => c.centre[0] === 1000), 'the one over the massif is not among them');
  // D3: the host
  const shared = readFileSync(new URL('../src/scenes/shared.js', import.meta.url), 'utf8');
  assert.match(shared, /drawnCells: \(\) => clouds\?\.cells \?\? null,/);
});
