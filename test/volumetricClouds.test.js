// VC3 - THE VOLUMETRIC CLOUDS (2026-09-07, Mac: "true volumetric clouds
// that move across the sky, build during weather"). A raymarched cloud
// slab written into a sky-space map a stripe per frame and composited
// over the port's own dome. Node has no GL: the pure laws and the seams
// are pinned here, the pictures in tools/volumetricCloudsProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUALITY, SWEEP_FRAMES, WORLD_PER_DRIFT, VC_PROFILE, easeProfile, cloudLight, MARCH_FS, COMPOSITE_FS, MARCH_UNIFORMS, COMPOSITE_UNIFORMS,
} from '../src/render/volumetricClouds.js';
import { easeWeather, WEATHER_SKY, WEATHER_EASE_SECONDS } from '../src/render/enhancedSky.js';
import { WEATHER_TYPES } from '../src/world/weather.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('VC3: the profile - one row per weather, eased on the weather ease\'s own exponential', () => {
  assert.deepEqual(Object.keys(VC_PROFILE).sort(), [...WEATHER_TYPES].sort(), 'a profile for every weather the sim can produce, and no more');
  for (const [name, p] of Object.entries(VC_PROFILE)) {
    assert.ok(p.base > 0 && p.top > p.base, `${name}: a slab with a base below its top`);
    for (const k of ['density', 'dark', 'flat']) assert.ok(p[k] >= 0 && p[k] <= 1, `${name}.${k} is 0..1`);
  }
  assert.ok(VC_PROFILE.overcast.flat > VC_PROFILE.sunny.flat && VC_PROFILE.thunder.dark > VC_PROFILE.overcast.dark, 'a lid is flat, a storm dark');
  assert.ok(VC_PROFILE.thunder.top > VC_PROFILE.sunny.top && VC_PROFILE.fog.top < 1000, 'the storm towers, the fog lies low');
  // the SAME clock as the row: after dt, the profile has crossed exactly the fraction the row has
  const row = easeWeather(WEATHER_SKY.sunny, WEATHER_SKY.overcast, 3.5);
  const prof = easeProfile(VC_PROFILE.sunny, VC_PROFILE.overcast, 3.5);
  const fr = (row.cover - WEATHER_SKY.sunny.cover) / (WEATHER_SKY.overcast.cover - WEATHER_SKY.sunny.cover);
  const fp = (prof.base - VC_PROFILE.sunny.base) / (VC_PROFILE.overcast.base - VC_PROFILE.sunny.base);
  assert.ok(Math.abs(fr - fp) < 1e-12, `the row crossed ${fr}, the profile ${fp}`);
  assert.ok(Math.abs(fp - (1 - Math.exp(-3.5 / WEATHER_EASE_SECONDS))) < 1e-12, 'the exponential itself');
  assert.deepEqual(easeProfile(null, VC_PROFILE.rain, 1), VC_PROFILE.rain, 'a boot takes the profile whole, as the row does');
  assert.deepEqual(easeProfile(VC_PROFILE.rain, VC_PROFILE.rain, 0), VC_PROFILE.rain, 'no dt, no move');
});

test('VC3: the light - the sun while it is up, else the brighter visible moon, dimmed, else none', () => {
  const masser = { dir: [0.3, 0.6, 0.7], color: [1, 0.8, 0.6], vis: 0.9 }, secunda = { dir: [-0.3, 0.4, 0.8], color: [0.8, 0.8, 1], vis: 0.5 };
  const day = cloudLight({ sunDir: [0, 0.7, 0.7], sun: [1, 0.95, 0.9], masser, secunda });
  assert.deepEqual(day, { dir: [0, 0.7, 0.7], color: [1, 0.95, 0.9], day: 1 });
  const night = cloudLight({ sunDir: [0, -0.2, 0.98], sun: [0, 0, 0], masser, secunda });
  assert.deepEqual(night.dir, masser.dir, 'Masser, the brighter');
  assert.ok(night.color[0] < 0.2 && night.day === 0, 'dim');
  const set = cloudLight({ sunDir: [0, -0.2, 0.98], sun: [0, 0, 0], masser: { ...masser, dir: [0.3, -0.1, 0.9] }, secunda: { ...secunda, vis: 0 } });
  assert.deepEqual(set.color, [0, 0, 0], 'no light: the sun down, Masser set, Secunda dark');
});

test('VC3: the map, the sweep, the drift - the numbers the rest of the outdoors already keeps', () => {
  assert.ok(QUALITY.lo.width < QUALITY.default.width && QUALITY.default.width < QUALITY.hi.width, 'three tiers, rising');
  assert.ok(QUALITY.lo.steps < QUALITY.default.steps && QUALITY.default.steps < QUALITY.hi.steps);
  for (const q of Object.values(QUALITY)) assert.ok(q.height % SWEEP_FRAMES === 0, 'a sweep divides the map evenly');
  assert.ok(Math.abs(WORLD_PER_DRIFT - 1 / 0.0038) < 1e-9, 'one drift unit is the metres the terrain\'s shadow field has always moved by');
  assert.match(read('src/render/renderer.js'), /vec2 sp = \(vWorldPos\.xz \+ uLightDir\.xz \/ max\(uLightDir\.y, 0\.12\) \* 260\.0\) \* 0\.0038 \+ uCloudDrift;/, 'the 0.0038 is still the ground\'s');
});

test('VC3: the shaders - the composite\'s ray is the dome\'s line for line, every uniform declared is fetched, the blend is sky * T + cloud', () => {
  const dome = read('src/render/enhancedSky.js');
  const rayLines = ['vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));',
    'float cp = cos(uPitch), sp = sin(uPitch);',
    'vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);',
    'float cy = cos(uYaw), sy = sin(uYaw);',
    'vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));'];
  for (const l of rayLines) { assert.ok(dome.includes(l), `the dome carries: ${l}`); assert.ok(COMPOSITE_FS.includes(l), `the composite carries: ${l}`); }
  assert.match(COMPOSITE_FS, /vec2 uv = vec2\(az \/ \(2\.0 \* PI\), el \/ \(0\.5 \* PI\)\);/, 'azimuth across, elevation up');
  assert.match(COMPOSITE_FS, /if \(el <= 0\.0\) discard;/, 'below the horizon the dome stands');
  assert.match(MARCH_FS, /vec3 dir = vec3\(sin\(az\) \* cos\(el\), sin\(el\), cos\(az\) \* cos\(el\)\);/, 'the march reads the same map coordinates back into a direction');
  for (const [fs, names] of [[MARCH_FS, MARCH_UNIFORMS], [COMPOSITE_FS, COMPOSITE_UNIFORMS]]) {
    const declared = [...fs.matchAll(/uniform\s+\w+\s+(\w+)/g)].map((m) => m[1]);
    assert.deepEqual(declared.sort(), [...names].sort(), 'every uniform the shader declares has its location fetched, and none is fetched that it lacks');
  }
  assert.match(MARCH_FS, /float t = t0 \+ ds \* hash12\(gl_FragCoord\.xy\);/, 'the jitter is a hash of the texel, never the clock - no flicker');
  assert.match(MARCH_FS, /sum \+= density\(p, 0\.0\) \* step;/, 'the light march reads the field itself, not a blurred level');
  assert.match(MARCH_FS, /outColor = vec4\(col, T\);/, 'colour and transmittance');
  const src = read('src/render/volumetricClouds.js');
  assert.match(src, /gl\.blendFunc\(gl\.ONE, gl\.SRC_ALPHA\);   \/\/ sky \* T \+ cloud/);
  assert.match(src, /createRenderTarget\(gl, this\.q\.width, this\.q\.height, \{ filter: 'LINEAR', wrapS: 'REPEAT', wrapT: 'CLAMP_TO_EDGE' \}\)/, 'the azimuth wraps, the elevation clamps');
  assert.match(src, /gl\.viewport\(0, y0, q\.width, Math\.min\(rows, q\.height - y0\)\);/, 'a stripe per frame');
  assert.doesNotMatch(src, /getParameter\(/, 'EV6: GL is never asked');
});

test('VC3: the seam - the clouds ride the dome only, behind the one switch, on the same row, dt and drift; the hosts hand the viewport and the flash', () => {
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const clouds = enhancedSky && cloudsDoor !== 'off'\s*\n\s*\? new VolumetricClouds\(gl, cloudsDoor in CLOUD_QUALITY \? cloudsDoor : 'default', \[0, 0, gl\.drawingBufferWidth, gl\.drawingBufferHeight\]\) : null;/, 'the dome only (never the mod), ?clouds=off the kill switch, ?clouds=lo|hi the tiers');
  assert.match(shared, /if \(clouds\) enhancedSky\.cloudsExternal = true;/, 'the dome\'s own decks stand down');
  assert.match(shared, /clouds\?\.setState\(enhancedSky\.state, weatherRowNow, weatherName, easeDt, driftXZ, extra\?\.flash \?\? 0\);/, 'the eased row, the front-stretched dt, the one drift integral, the host\'s flash');
  assert.match(shared, /draw\(yaw, pitch, fovY, aspect, viewport = \[0, 0, gl\.drawingBufferWidth, gl\.drawingBufferHeight\]\) \{\s*\n\s*\(enhancedSky \?\? dynamicSky \?\? sky\)\.draw\(yaw, pitch, fovY, aspect\);\s*\n\s*if \(clouds\) \{ clouds\.update\(viewport\); clouds\.draw\(yaw, pitch, fovY, aspect\); \}/, 'marched then composited after the dome, inside the host\'s marked span');
  const dome = read('src/render/enhancedSky.js');
  assert.match(dome, /gl\.uniform1f\(u\.uCloudCover, this\.cloudsExternal \? 0 : s\.cloudCover\);/, 'cover 0 to the dome\'s shader under the clouds; the state keeps the row\'s');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(h);
    assert.match(s, /sky\.draw\([^;]*worldAspect, renderer\.worldViewportPx \?\? \[0, 0, renderer\.gl\.drawingBufferWidth, renderer\.gl\.drawingBufferHeight\]\);/, `${h}: the world rect the map restores`);
    assert.match(s, /sun: wxNow\.sun, flash: flash - 1 \}\);/, `${h}: the strobe reaches the clouds`);
  }
  const lab = read('src/tools/skyLab.js');
  assert.match(lab, /if \(!dynamicOn && cloudsDoor !== 'off'\) sky\.cloudsExternal = true;/);
  assert.match(lab, /clouds \?\?= new VolumetricClouds\(gl, cloudsDoor in CLOUD_QUALITY \? cloudsDoor : 'default', \[0, 0, w, h\]\);/);
  assert.match(lab, /window\.__skyReady = texturesPending === 0 && \(!clouds \|\| clouds\.sweeps > 0\);/, 'the probe waits for the first sweep');
  assert.match(read('test/glstate.test.js'), /'src\/render\/volumetricClouds\.js'/, 'the AUDIT 47 sweep reads the march and the composite');
});
