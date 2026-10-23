// OW-HORIZON (2026-10-20, the owner: "the overworld map as it stands doesnt allow you to see as far as the eye can see, this
// needs to change without impacting performance"; bible/06-Systems/Travel-View.md OW-HORIZON) - FROM THE AIR, AS FAR AS
// THE EYE CAN SEE. Held here: the haze runs on to the far ring's rim under the view and nowhere else; the lens holds the
// whole grid from the raised eye with its depth kept; the camera looks out to the horizon and keeps the far half of its
// line of sight clear; the clouds' shadows run on past their square and onto the ring; the ring hazes from where the
// world's fog is measured and covers what the stream has not built; a click reaches the land the view shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { horizonFog, horizonPlanes, horizonProj, horizonHit, viewShare, TV_HAZE_END, TV_LENS_NEAR, TV_LENS_FAR, TV_PICK_REACH, WORLD_NEAR, WORLD_FAR } from '../../src/scenes/travelHorizon.js';
import { TV_TILT_MIN, TV_TILT_MAX, TV_HEIGHT_MAX, TV_GROUND_CLEAR, TV_CLEAR_SPAN, clearSteps, clearView, eyeFor, smooth01 } from '../../src/player/travelCamera.js';
import { RING_RIM_END, RING_RIM_START, FarRingRenderer, RING_CLOUD_UNIT, buildFarRingIndices, buildSeaFillIndices, buildFarRingGrid, footprintBuilt, BuiltPixels } from '../../src/render/farRing.js';
import { CLOUD_SHADOW_GLSL, CLOUD_SHADOW_RIM, RING_CLOUD_GLSL, cloudFarOf } from '../../src/render/cloudShadow.js';
import { CLOUD_SHADOW_UNIT } from '../../src/render/renderer.js';
import { FOG_SETTINGS, scaleFogForDistance, fogForWeather } from '../../src/world/weather.js';
import { LAND_VIEW_MAX, LAND_VIEW_DEFAULT } from '../../src/world/landView.js';
import { PIXEL_METRES } from '../../src/render/volumetricClouds.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const deg = (d) => (d * Math.PI) / 180;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const UP = { blend: 1 };

test('OW-HORIZON the haze: under the view a LINEAR row runs on to the far ring\'s rim, eased with the rise; on the ground, and under any weather row, the row itself - the same object (mutants: the row stretched on the ground; the weather stretched; no ease)', () => {
  assert.equal(TV_HAZE_END, RING_RIM_END, 'where the ring\'s land meets the sky');
  for (const w of ['sunny', 'cloudy', 'overcast']) {
    const row = scaleFogForDistance(fogForWeather(w), LAND_VIEW_DEFAULT);
    assert.equal(horizonFog(row, null), row, `${w}: the ground's own row`);
    assert.equal(horizonFog(row, { blend: 0 }), row, `${w}: a view not yet risen`);
    const up = horizonFog(row, UP);
    assert.notEqual(up, row, 'a copy - the table\'s row is frozen');
    assert.deepEqual({ ...up, end: 0 }, { ...row, end: 0 }, 'only the end moves');
    assert.ok(near(up.end, TV_HAZE_END), `${w}: up, its end the horizon's`);
    const half = horizonFog(row, { blend: 0.5 });
    assert.ok(near(half.end, row.end + (TV_HAZE_END - row.end) * smooth01(0.5)), 'eased by the eye\'s own smoothstep');
    assert.ok(horizonFog(row, { blend: 0.1 }).end < half.end && half.end < up.end, 'the rise opens it, the fall closes it');
  }
  for (const [w, row] of Object.entries(FOG_SETTINGS)) if (row.mode !== 'linear') assert.equal(horizonFog(row, UP), row, `${w}: weather stays the traveller's`);
  const far = { mode: 'linear', start: 0, end: TV_HAZE_END * 2, density: 0, excludeSky: true };
  assert.equal(horizonFog(far, UP), far, 'never nearer than the row\'s own');
  assert.equal(viewShare(null), 0);
  assert.equal(viewShare(UP), 1);
});

test('OW-HORIZON the lens: on the ground the eye\'s own planes; under the view eased out to hold the whole grid from the raised eye, its near plane grown so the depth buffer keeps its step out there (mutants: the far plane kept; the near kept; no ease)', () => {
  assert.deepEqual(horizonPlanes(WORLD_NEAR, null), [WORLD_NEAR, WORLD_FAR]);
  assert.deepEqual([WORLD_NEAR, WORLD_FAR], [0.2, 6000], 'the frame\'s own, as it was');
  assert.deepEqual(horizonPlanes(WORLD_NEAR, UP), [TV_LENS_NEAR, TV_LENS_FAR]);
  const [n, f] = horizonPlanes(WORLD_NEAR, { blend: 0.05 });
  assert.ok(n > WORLD_NEAR && n < 0.22 && f > WORLD_FAR && f < 6100, 'a frame into the rise: the head\'s lens, barely moved');
  assert.equal(horizonPlanes(5, UP)[0], 5, 'never nearer than the frame\'s own (a glass\'s focus)');
  // the grid's farthest corner at the widest Land View, from the eye at its furthest stand-off
  const corner = (LAND_VIEW_MAX + 1) * PIXEL_METRES * Math.SQRT2;
  const eye = Math.hypot(TV_HEIGHT_MAX, TV_HEIGHT_MAX / Math.tan(TV_TILT_MIN));
  assert.ok(corner + eye < TV_LENS_FAR * 0.85, `the grid ${corner.toFixed(0)} m + the eye ${eye.toFixed(0)} m inside the far plane, with room for a lift`);
  assert.ok(corner > WORLD_FAR, 'which the eye\'s own 6,000 m never held');
  // a 24-bit buffer's step at distance d: d^2 (f - n) / (f n 2^24)
  const step = (d, nn, ff) => (d * d * (ff - nn)) / (ff * nn * 2 ** 24);
  assert.ok(step(8000, TV_LENS_NEAR, TV_LENS_FAR) < 2, `8 km out: ${step(8000, TV_LENS_NEAR, TV_LENS_FAR).toFixed(2)} m a step`);
  assert.ok(step(8000, WORLD_NEAR, TV_LENS_FAR) > 15, 'through the eye\'s 0.2 it would have been nearly 20');
  const p = horizonProj(1.13, 16 / 9, WORLD_NEAR, UP);
  assert.ok(p[0] < 0, 'mirrored (HANDEDNESS)');
  assert.ok(Math.abs(p[14] / (p[10] + 1) / TV_LENS_FAR - 1) < 0.005, 'its far plane the view\'s (fp32 storage: a part in a few thousand)');
  assert.ok(near(p[14] / (p[10] - 1), TV_LENS_NEAR, 1e-3), 'its near plane the view\'s');
});

test('OW-HORIZON the camera: it looks out to the horizon - at the floor the horizon stands in the picture\'s top third, the traveller at its centre (mutants: the floor kept at 30)', () => {
  assert.ok(near(TV_TILT_MIN, deg(15)) && near(TV_TILT_MAX, deg(75)));
  const half = deg(65) / 2;   // DFU's 65-degree lens
  const fromTop = (1 - Math.tan(TV_TILT_MIN) / Math.tan(half)) / 2;
  assert.ok(fromTop > 0.2 && fromTop < 0.4, `the horizon ${(fromTop * 100).toFixed(0)}% down the picture`);
  assert.ok((1 - Math.tan(deg(30)) / Math.tan(half)) / 2 < 0.05, 'at the old 30 it hung at the very top');
});

test('OW-HORIZON the camera: the far half of the line of sight is asked at TV_CLEAR_SPAN - a hill three quarters back that the middle missed lifts the eye; a short line is the old two points; the near half is never asked, so looking out low over rolling land neither lifts nor steepens (mutants: the middle alone; the near half asked)', () => {
  assert.equal(TV_CLEAR_SPAN, 100);
  assert.equal(clearSteps(150), 1, 'the middle and the eye, as before');
  assert.equal(clearSteps(330), 2);
  assert.equal(clearSteps(1739), 9, 'looking out from 450 m: nine steps of under 100 m');
  assert.equal(clearSteps(NaN), 1);
  const focus = [0, 0, 0], tilt = deg(15), h = 450, back = h / Math.tan(tilt);
  // a hill whose crest stands three quarters of the way back to the eye, its middle clear
  const hill = (x, z) => (z < -0.7 * back && z > -0.8 * back ? 0.75 * h : 0);
  const v = clearView(focus, 0, tilt, h, hill);
  const e = eyeFor(focus, 0, v.tilt, v.height).eye;
  for (let s = 0.5; s <= 1; s += 0.01) {
    const p = [focus[0] + (e[0] - focus[0]) * s, focus[1] + (e[1] - focus[1]) * s, focus[2] + (e[2] - focus[2]) * s];
    assert.ok(p[1] >= hill(p[0], p[2]) + TV_GROUND_CLEAR - 1e-6 || hill(p[0], p[2]) === 0, `the line clears the crest at ${s.toFixed(2)}`);
  }
  assert.ok(v.height > h || v.tilt > tilt, 'it lifted (or steepened) for it');
  // rolling land, 60 m hills a kilometre across, the traveller anywhere, looking every way out at the floor
  const hills = (x, z) => 60 * Math.sin(x / 143) * Math.cos(z / 143);
  let moved = 0;
  for (let fx = 0; fx < 3000; fx += 97) for (let yaw = 0; yaw < 6.28; yaw += 0.5) {
    const r = clearView([fx, hills(fx, 0), 0], yaw, tilt, h, hills);
    if (r.tilt > tilt + 1e-9) moved++;
  }
  assert.equal(moved, 0, 'the view the player chose, not a steeper one');
});

/** The cloud block run: `told` the far law (x) or none; the map's texel `map` everywhere. */
function cloud(told, map = 0.4, far = 0.7) {
  const f = glslFunctions(CLOUD_SHADOW_GLSL, { uCloudShadowRect: [-500, -500, 1 / 1000, 1], uCloudShadowFar: told ? [far, 1] : [0, 0], texture: () => [map, 0, 0, 1] });
  return (x, z) => f.cloudShadowAt([x, 0, z]);
}

test('OW-HORIZON the clouds\' shadows: a program never told reads the map to its square\'s edge and full sun past it, as ever; a told one takes the far law past the square and eases into it over the rim, so the shadows run on without a line (mutants: the far law untold; no rim; the rim the other way)', () => {
  const plain = cloud(false), told = cloud(true);
  assert.ok(near(plain(0, 0), 0.4) && near(plain(499, 0), 0.4), 'untold: the map to its edge');
  assert.equal(plain(600, 0), 1, 'untold: full sun past it');
  assert.ok(near(told(0, 0), 0.4), 'told: the map at the middle');
  assert.ok(near(told(0.8 * 500 - 1, 0), 0.4), 'and to the rim\'s start (CLOUD_SHADOW_RIM)');
  assert.equal(CLOUD_SHADOW_RIM, 0.8);
  assert.ok(near(told(600, 0), 0.7) && near(told(-2000, 3000), 0.7), 'the far law past the square');
  assert.ok(near(told(499.999, 0), 0.7, 1e-4), 'the edge meets it - no line');
  const mid = told(0.9 * 500, 0);
  assert.ok(mid > 0.4 && mid < 0.7, `between, eased (${mid.toFixed(3)})`);
  assert.equal(cloud(true, 0.4, 0.7)(0, 0), cloud(false, 0.4, 0.7)(0, 0), 'inside the rim the told and the untold agree');
  const off = glslFunctions(CLOUD_SHADOW_GLSL, { uCloudShadowRect: [0, 0, 0, 0], uCloudShadowFar: [0.3, 1], texture: () => [0, 0, 0, 1] });
  assert.equal(off.cloudShadowAt([5000, 0, 0]), 1, 'no deck (the classic skin, every interior): full sun, told or not');
  // the deck's far law: its `far` with a map, else 1
  assert.equal(cloudFarOf(null), 1);
  assert.equal(cloudFarOf({ map: null, far: 0.4 }), 1);
  assert.equal(cloudFarOf({ map: {}, far: 0.4 }), 0.4);
  assert.equal(cloudFarOf({ map: {} }), 1);
});

test('OW-HORIZON the ring\'s sun: without a deck the host\'s scale whole, as before; with one, past the square the same (the far law the scale already carries); inside it the map\'s own, as the ground beside it takes (mutants: the map unread on the ring; the far law divided twice)', () => {
  const run = (deck, at) => glslFunctions(`uniform float uSunScale;\nin vec3 vWorld;\n${RING_CLOUD_GLSL}`, {
    uSunScale: 0.6 * (deck ? deck.far : 1), vWorld: at, texture: () => [0.25, 0, 0, 1],
    uCloudShadowRect: deck ? [-500, -500, 1 / 1000, 1] : [0, 0, 0, 0], uCloudShadowFar: [deck ? deck.far : 1, 1], uCloudFar: deck ? deck.far : 1,
  }).ringSun();
  assert.ok(near(run(null, [9000, 0, 0]), 0.6), 'no deck: the scale');
  const deck = { far: 0.7 };
  assert.ok(near(run(deck, [9000, 0, 0]), 0.6 * 0.7), 'past the square: the far law, the ring as it was');
  assert.ok(near(run(deck, [0, 0, 0]), 0.6 * 0.25), 'inside: the map\'s transmittance on the frame\'s sun - the ground\'s own');
});

test('OW-HORIZON the ring: its haze from where the world\'s fog is measured - the travel view\'s traveller, the eye on the ground - and the deck the ground takes, bound where the renderer binds it (mutants: the haze from the eye; the deck unbound)', () => {
  const fr = rd('src/render/farRing.js');
  assert.match(fr, /vDist = uHazeFrom\.w > 0\.5 \? length\(world - uHazeFrom\.xyz\) : length\(view\.xyz\);/, 'the VS: from the focus while one is set');
  assert.equal(RING_CLOUD_UNIT, CLOUD_SHADOW_UNIT, 'the renderer\'s own unit, the same map on it');
  const sent = {};
  let bound = null;
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name });
      if (/^uniform/.test(k)) return (loc, ...v) => { sent[loc?.name] = v.length === 1 ? v[0] : v; };
      if (k === 'bindTexture') return (t, tex) => { if (tex?.deck) bound = tex; };
      if (/^create/.test(k)) return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const map = { deck: true };
  const renderer = { lightingLane: null, focus: Float32Array.of(10, 20, 30, 1), cloudShadow: { map, rect: [1, 2, 3, 4], far: 0.6 } };
  const r = new FarRingRenderer(gl, { renderer });
  assert.equal(r.lane, null);
  const W = 120, Hh = 80;
  r.build({ heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 60, baseY: 40, radius: 6 }, 60, 40, 2);
  r.draw(new Float32Array(16), { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: [0.4, 0.4, 0.4], sunScale: 0.5, sunColor: [1, 1, 1], fogColor: [0.6, 0.7, 0.8], fogEnd: 2400, fovY: 1, aspect: 1.6 });
  assert.deepEqual([...sent.uHazeFrom], [10, 20, 30, 1], 'the focus');
  assert.equal(sent.uCloudFar, 0.6);
  assert.deepEqual(sent.uCloudShadowFar, [0.6, 1], 'told');
  assert.deepEqual(sent.uCloudShadowRect, [1, 2, 3, 4]);
  assert.equal(bound, map, 'the deck\'s map bound');
  assert.equal(sent.uCloudShadowMap, RING_CLOUD_UNIT);
  renderer.focus = new Float32Array(4); renderer.cloudShadow = null;
  r.draw(new Float32Array(16), { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: [0.4, 0.4, 0.4], sunScale: 0.5, sunColor: [1, 1, 1], fogColor: [0.6, 0.7, 0.8], fogEnd: 2400, fovY: 1, aspect: 1.6 });
  assert.equal(sent.uHazeFrom[3], 0, 'no focus: the eye, as ever');
  assert.equal(sent.uCloudFar, 1, 'no deck: the scale whole');
  assert.equal(sent.uCloudShadowRect[3], 0, 'and no shadow');
});

test('OW-HORIZON the ring\'s hole: a pixel the stream has not built is the ring\'s - its cells drawn, out of the sea\'s fill - and a built one the stream\'s, as ever; the hole is punched again when the built set\'s keys change - a drop and a build between two frames too - not every frame, nor for an entry replaced under its key (mutants: the built pixels unread; the key blind to them; the key by the set\'s size; a replace, a miss or an empty clear counted; the host\'s map a plain one)', () => {
  const W = 60, H = 60, base = 30, radius = 8, holeRadius = 3;
  const g = buildFarRingGrid({ heightBytes: new Uint8Array(W * H), mapWidth: W, mapHeight: H, climateAt: () => 231, baseX: base, baseY: base, radius });
  const hole = { baseX: base, baseY: base, radius, holeX: base, holeY: base, holeRadius, sea: g.sea };
  const all = new Map(), most = new BuiltPixels();
  for (let y = base - holeRadius; y <= base + holeRadius; y++) for (let x = base - holeRadius; x <= base + holeRadius; x++) { all.set(`${x},${y}`, 1); if (!(x === base + 2 && y === base - 3)) most.set(`${x},${y}`, 1); }
  const plain = buildFarRingIndices(hole).length;
  assert.equal(buildFarRingIndices({ ...hole, built: footprintBuilt(all, base, base, holeRadius) }).length, plain, 'every pixel built: the hole as ever');
  const owed = buildFarRingIndices({ ...hole, built: footprintBuilt(most, base, base, holeRadius) }).length;
  assert.equal(owed - plain, 2 * 6, 'one pixel owed on the footprint\'s edge row: the two cells over it are the ring\'s');
  const fillAll = buildSeaFillIndices({ ...hole, built: footprintBuilt(all, base, base, holeRadius) }).indices.length;
  const fillOwed = buildSeaFillIndices({ ...hole, built: footprintBuilt(most, base, base, holeRadius) }).indices.length;
  assert.equal(fillAll - fillOwed, 2 * 6, 'and out of the sea\'s fill - never drawn twice');
  const fp = footprintBuilt(most, base, base, holeRadius);
  assert.equal(fp.length, 49);
  assert.equal(fp[0 * 7 + 5], 0, 'the owed pixel, row by row from the north-west corner');
  // the key: the built set's changes
  let uploads = 0;
  const gl = new Proxy({}, { get: (o, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'bufferData') return (t, d) => { if (t === 'ELEMENT_ARRAY_BUFFER') uploads++; };
    if (/^create/.test(k)) return () => ({});
    if (typeof k === 'string' && k.toUpperCase() === k) return k;
    return () => {};
  } });
  const r = new FarRingRenderer(gl);
  r.build({ heightBytes: new Uint8Array(W * H), mapWidth: W, mapHeight: H, climateAt: () => 231, baseX: base, baseY: base, radius }, base, base, holeRadius, most);
  const was = uploads;
  r.punchHole(base, base, holeRadius, most);
  assert.equal(uploads, was, 'the same built set: nothing re-punched');
  most.set(`${base + 2},${base - 3}`, 1);
  r.punchHole(base, base, holeRadius, most);
  assert.equal(uploads, was + 1, 'a pixel built: the hole punched again');
  most.set(`${base + 2},${base - 3}`, 2);
  most.delete('no such pixel');
  r.punchHole(base, base, holeRadius, most);
  assert.equal(uploads, was + 1, 'an entry replaced under its key, a miss deleted: the same ground, nothing re-punched');
  // between two frames the stream drops one pixel and builds another: the size stands still, the ground does not
  const size = most.size, ringWas = r.ringCount;
  most.delete(`${base - 1},${base + 1}`);
  most.set(`${base + 9},${base + 9}`, 1);
  assert.equal(most.size, size);
  r.punchHole(base, base, holeRadius, most);
  assert.equal(uploads, was + 2, 'a drop and a build: the hole punched again');
  assert.equal(r.ringCount - ringWas, 4 * 6, '...the dropped pixel the ring\'s: the four cells over it');
  const seeded = new BuiltPixels([['a', 1], ['b', 2]]);
  assert.equal(seeded.size, 2);
  assert.equal(seeded.changes, 2, 'seeded: each key a change');
  seeded.clear();
  assert.equal(seeded.changes, 3);
  seeded.clear();
  assert.equal(seeded.changes, 3, 'an empty set cleared: no change');
});

test('OW-HORIZON the click: as far as the view shows the land - past the lens\'s old 6,000 m and the built grid, out to the haze\'s end (mutants: the reach kept)', () => {
  assert.equal(TV_PICK_REACH, TV_HAZE_END);
  const eye = [0, 450, 0];
  const dir = [0, -450, 15000].map((v, _, a) => v / Math.hypot(...a));
  const hit = horizonHit(eye, dir, () => 0);
  assert.ok(hit.point && Math.abs(hit.point[2] - 15000) < 5, `a field 15 km out: ${hit.point?.[2]}`);
  const sky = horizonHit(eye, [0, 0.01, 0.99995], () => 0);
  assert.equal(sky.point, null, 'above the horizon: none');
});

test('OW-HORIZON the host\'s wiring: the fog row and the lens through the view\'s horizon, the lens after the view\'s frame says how far up it stands, the ring handed the renderer and the built pixels, the click through horizonHit over the land itself; the renderer tells every program the far law; the deck carries it (mutants: each wire cut)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const fogNow = horizonFog\(wxNow\.fog, tvf\);/);
  const tvfAt = w.indexOf('const tvf = travelView?.frame(dt, { eye: tvHeadEye, fwd }) ?? null;');
  const projAt = w.indexOf('const proj = horizonProj(glassFov(fieldOfView() + climbFeel.fovRad(), spyglass.lens), worldAspect, spyglass.near, tvf);');
  assert.ok(tvfAt > 0 && projAt > tvfAt, 'the lens after the view\'s frame');
  assert.ok(projAt < w.indexOf('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);'), '...and before the frame begins with it');
  assert.ok(!/perspective\(glassFov\(fieldOfView\(\)/.test(w), 'no second lens');
  assert.match(w, /new FarRingRenderer\(renderer\.gl, \{ renderer \}\)/);
  assert.match(w, /\n  const built = new BuiltPixels\(\); \/\/ key -> pixel entry/, 'the host\'s built pixels count their changes');
  assert.match(w, /\}, state\.current\.x, state\.current\.y, state\.terrainDistance, built\);/);
  assert.match(w, /farRing\.punchHole\(state\.current\.x, state\.current\.y, state\.terrainDistance, built\);/);
  assert.equal((w.match(/const hit = horizonHit\(travelView\.eye, dir, \(x, z\) => tvGroundAt\(x, z, false\)\);/g) ?? []).length, 2, 'the click and the waypoint menu\'s');
  const r = rd('src/render/renderer.js');
  assert.match(r, /if \(farLoc\) gl\.uniform2f\(farLoc, cloudFarOf\(cs\), 1\);/);
  assert.equal((r.match(/gl\.getUniformLocation\([^,]+, 'uCloudShadowFar'\)\]/g) ?? []).length, 6, 'every program\'s pair a triple - the terrain, the mesh, the character, the flats, the decal and the ground\'s snow');
  assert.match(r, /cloud: \[u\('uCloudShadowMap'\), u\('uCloudShadowRect'\), u\('uCloudShadowFar'\)\],/, 'the water\'s too');
  const sh = rd('src/scenes/shared.js');
  assert.match(sh, /Object\.assign\(enhancedSky\.cloudShadow, clouds\.shadow, \{ far: farCoverSun\(\) \}\);/);
  assert.match(sh, /if \(!clouds\) return this\.sunFactor\(\);\s*\n\s*return farCoverSun\(\);/, 'the ring\'s dim and the deck\'s far one law');
  assert.ok(RING_RIM_START < TV_HAZE_END);
});
