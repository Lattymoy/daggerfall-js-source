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
  QUALITY, SWEEP_FRAMES, WORLD_PER_DRIFT, VC_PROFILE, easeProfile, cloudLight, MARCH_FS, COMPOSITE_FS, SHADOW_FS, MARCH_UNIFORMS, COMPOSITE_UNIFORMS, SHADOW_UNIFORMS,
  SHADOW_EXTENT, PIXEL_METRES, shadowOrigin,
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
  // VC4d: the sun's weight fades over its last degrees (y from -0.02 to
  // 0.06), the moon's share rising as it goes - no pop at the horizon
  const dusk = cloudLight({ sunDir: [0, 0.02, 0.9998], sun: [1, 0.5, 0.3], masser, secunda });
  assert.ok(dusk.day > 0.49 && dusk.day < 0.51, 'half way down, half the weight');
  assert.ok(dusk.color[0] < 1 && dusk.color[0] > night.color[0], 'between the sun\'s and the moon\'s');
  assert.deepEqual(dusk.dir, [0, 0.02, 0.9998], 'still the sun\'s direction while any of it is up');
  const gone = cloudLight({ sunDir: [0, -0.02, 0.9998], sun: [1, 0.5, 0.3], masser, secunda });
  assert.deepEqual(gone, night, 'at -0.02 the sun weighs nothing: the moon\'s light exactly');
});

test('VC3: the map, the sweep, the drift - the numbers the rest of the outdoors already keeps', () => {
  assert.ok(QUALITY.lo.width < QUALITY.default.width && QUALITY.default.width < QUALITY.hi.width, 'three tiers, rising');
  assert.ok(QUALITY.lo.steps < QUALITY.default.steps && QUALITY.default.steps < QUALITY.hi.steps);
  for (const q of Object.values(QUALITY)) assert.ok(q.height % SWEEP_FRAMES === 0, 'a sweep divides the map evenly');
  assert.ok(Math.abs(WORLD_PER_DRIFT - 1 / 0.0038) < 1e-9, 'one drift unit is the metres the terrain\'s shadow field has always moved by');
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
  for (const [fs, names] of [[MARCH_FS, MARCH_UNIFORMS], [COMPOSITE_FS, COMPOSITE_UNIFORMS], [SHADOW_FS, SHADOW_UNIFORMS]]) {   // all THREE marched programs (the review: a drifted SHADOW_UNIFORMS was silent)
    const declared = [...fs.matchAll(/uniform\s+\w+\s+(\w+)/g)].map((m) => m[1]);
    assert.deepEqual(declared.sort(), [...names].sort(), 'every uniform the shader declares has its location fetched, and none is fetched that it lacks');
  }
  assert.match(MARCH_FS, /float t = t0 \+ ds \* hash12\(gl_FragCoord\.xy\);/, 'the jitter is a hash of the texel, never the clock - no flicker');
  assert.match(MARCH_FS, /sum \+= density\(p, 0\.0\) \* step;/, 'the light march reads the field itself, not a blurred level');
  assert.match(MARCH_FS, /outColor = vec4\(col, T\);/, 'colour and transmittance');
  const src = read('src/render/volumetricClouds.js');
  assert.match(src, /gl\.blendFuncSeparate\(gl\.ONE, gl\.SRC_ALPHA, gl\.ZERO, gl\.ONE\);   \/\/ sky \* T \+ cloud/, 'the colour blends sky * T + cloud; the buffer\'s alpha is left alone (ONE, SRC_ALPHA on alpha too would leave it 2T)');
  // VC4d: the flash lights the WHOLE sky on the composite, never one stripe of the map
  assert.doesNotMatch(MARCH_FS, /uFlash/, 'the march (a stripe a frame) carries no flash');
  assert.match(COMPOSITE_FS, /outColor = vec4\(c\.rgb \* \(1\.0 \+ uFlash \* 2\.0\), c\.a\);/, 'the composite lights every texel for the frame');
  assert.match(src, /gl\.uniform1f\(u\.uFlash, this\.flash\);/);
  assert.match(src, /createRenderTarget\(gl, this\.q\.width, this\.q\.height, \{ filter: 'LINEAR', wrapS: 'REPEAT', wrapT: 'CLAMP_TO_EDGE' \}\)/, 'the azimuth wraps, the elevation clamps');
  assert.match(src, /gl\.viewport\(0, y0, q\.width, Math\.min\(rows, q\.height - y0\)\);/, 'a stripe per frame');
  assert.doesNotMatch(src, /getParameter\(/, 'EV6: GL is never asked');
});

test('VC3: the seam - the clouds ride the dome only, behind the one switch, on the same row, dt and drift; the hosts hand the viewport and the flash', () => {
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const clouds = enhancedSky && cloudsDoor !== 'off'\s*\n\s*\? new VolumetricClouds\(gl, Object\.hasOwn\(CLOUD_QUALITY, cloudsDoor\) \? cloudsDoor : 'default', \[0, 0, gl\.drawingBufferWidth, gl\.drawingBufferHeight\]\) : null;/, 'the dome only (never the mod), ?clouds=off the kill switch, ?clouds=lo|hi the tiers');
  assert.match(shared, /if \(clouds\) enhancedSky\.cloudsExternal = true;/, 'the dome\'s own decks stand down');
  assert.match(shared, /weatherJump\(\) \{[\s\S]{0,300}?clouds\?\.jump\(\);/, 'a jump drops the profile with the row');
  const vc = read('src/render/volumetricClouds.js');
  assert.match(vc, /jump\(\) \{ this\.profile = null; this\.stripe = 0; this\.shadowFull = true; \}/);
  // VC4 review: the floating origin - the field is sampled at the ABSOLUTE position
  assert.match(vc, /vec3 q = vec3\(p\.x \+ uShift\.x \+ uDrift\.x \+ uShear \* \(p\.y - uBase\), p\.y, p\.z \+ uShift\.y \+ uDrift\.y\);/, 'every sample carries the accumulated recenters');
  assert.match(vc, /offsetOrigin\(offset\) \{\s*\n\s*this\.shift\[0\] -= offset\[0\]; this\.shift\[1\] -= offset\[2\];\s*\n\s*this\.cam\[0\] \+= offset\[0\]; this\.cam\[1\] \+= offset\[2\];\s*\n\s*if \(this\.origin\) \{ this\.origin\[0\] \+= offset\[0\]; this\.origin\[1\] \+= offset\[2\]; \}/, 'a recenter moves the camera and the square with the world and keeps the map');
  assert.match(read('src/scenes/world.js'), /player\.offsetOrigin\(r\.offset\);[^\n]*\n\s*sky\.offsetOrigin\(r\.offset\);/, 'the host hands the recenter to the sky');
  assert.match(shared, /offsetOrigin\(offset\) \{ clouds\?\.offsetOrigin\(offset\); \},/);
  // a pixel crossing without a recenter shifts the map by whole texels, no re-march
  assert.match(vc, /gl\.blitFramebuffer\(sx0, sy0, sx1, sy1, sx0 - dx, sy0 - dz, sx1 - dx, sy1 - dz, gl\.COLOR_BUFFER_BIT, gl\.NEAREST\);/);
  assert.match(vc, /if \(!this\.mapOrigin \|\| !this\.shadowMarched\) return null;/, 'the ground samples nothing before the first march, and the rect it takes is the corner the map HOLDS');
  assert.match(vc, /if \(this\.shadowFull\) \{ this\.shadowFull = false; this\.shadowMarched = true; this\.mapOrigin = \[this\.origin\[0\], this\.origin\[1\]\]; \}/, 'a full march publishes the corner it marched');
  // the square: sixteen pixels a side, a pixel a WHOLE number of texels at every tier (the crossing's shift depends on it)
  assert.equal(SHADOW_EXTENT, PIXEL_METRES * 16, 'sixteen pixels across: the near edge stands 6144 m out, past the far fog');
  for (const [k, q] of Object.entries(QUALITY)) {
    const texelsPerPixel = PIXEL_METRES / (SHADOW_EXTENT / q.shadow);
    assert.ok(Math.abs(texelsPerPixel - Math.round(texelsPerPixel)) < 1e-9 && texelsPerPixel >= 1, `${k}: a pixel is ${texelsPerPixel} texels - whole`);
  }
  // shadowOrigin, by value: the camera's pixel centred in the square
  const half = SHADOW_EXTENT / 2, p = PIXEL_METRES;
  assert.deepEqual(shadowOrigin(0, 0), [-half + p / 2, -half + p / 2], 'at the origin: the square\'s centre is pixel (0,0)\'s centre');
  for (const x of [37, 100, p - 1, p + 1, 2.5 * p, -0.3 * p, 12345.6]) {   // interior points: a camera ON an edge is float rounding's to place
    const o = shadowOrigin(x, -x);
    assert.ok(Math.abs(o[0] + half - (Math.floor(x / p) * p + p / 2)) < 1e-6, `x=${x}: the square is centred on the camera\'s pixel`);
    assert.ok(Math.abs(o[1] + half - (Math.floor(-x / p) * p + p / 2)) < 1e-6, `z=${-x}: and on z`);
    for (const k of [1, -3, 7]) {   // a whole-pixel recenter moves it by exactly the recenter
      const r = shadowOrigin(x + k * p, -x + k * p);
      assert.ok(Math.abs(r[0] - (o[0] + k * p)) < 1e-6 && Math.abs(r[1] - (o[1] + k * p)) < 1e-6, `x=${x}, k=${k}: invariant under a whole-pixel recenter`);
    }
  }
  const before = shadowOrigin(3 * p - 1, 0), after = shadowOrigin(3 * p + 1, 0);
  assert.ok(Math.abs(after[0] - before[0] - p) < 1e-6 && after[1] === before[1], 'a crossing moves the square by exactly one pixel, on that axis only');
  assert.match(SHADOW_FS, /int steps = min\(24, max\(uSteps, int\(ceil\(\(t1 - t0\) \/ 150\.0\)\)\)\);/, 'a low sun\'s long slant is sampled no coarser than 150 m');
  for (const q of Object.values(QUALITY)) assert.ok(q.shadowSteps >= 8 && q.shadowSteps <= 24, 'the tier\'s count is the floor under the ceiling');
  // the far ring stands outside the square: a cover-derived dim on the slab's own law
  assert.match(shared, /farSunFactor\(\) \{\s*\n\s*if \(!clouds\) return this\.sunFactor\(\);\s*\n\s*return 1 - 0\.7 \* Math\.pow\(weatherRowNow\?\.cover \?\? 0, 1\.6\);/);
  assert.match(read('src/scenes/world.js'), /sunScale: renderer\._sunScale \* sky\.farSunFactor\(\), sunColor: renderer\._sunColor,/, 'the ring takes it');
  assert.match(vc, /this\.white = new Uint8Array\(this\.q\.shadow \* this\.q\.shadow \* 4\)\.fill\(255\);/, 'the targets start all light by UPLOAD');
  assert.match(vc, /this\.shadowMap = createRenderTarget\(gl, this\.q\.shadow, this\.q\.shadow, \{ filter: 'LINEAR', wrap: 'CLAMP_TO_EDGE', data: this\.white \}\);/);
  assert.doesNotMatch(vc, /gl\.clear\(|clearColor\(/, 'never a clear - the renderer keeps a JS shadow of the clear colour that a clear here would falsify');
  assert.doesNotMatch(vc, /this\.full\b/, 'the first sky sweep is striped like every other - no stall');
  // the renderer's lens-local sprite borrow and the hosts' body deck
  const rr = read('src/render/renderer.js');
  assert.match(rr, /cloudShadow: this\._cloudShadow,   \/\/ VC4/, 'the studio borrow saves the deck');
  assert.match(rr, /if \(saved\.cloudShadow\) \{ this\._cloudShadow = saved\.cloudShadow; this\._csStamp\+\+; \}/, 'and returns it');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(h), /renderer\.setCloudShadow\(sky\?\.cloudShadow \?\? null\);[^\n]*\n\s*mwViewDrawBody\(/, `${h}: the body takes the frame's deck`);
  // VC5 review: the FP arm is lens-local geometry at the origin - the deck is borrowed off for it, and only for it
  assert.match(rr, /renderCharacterSprite\(mesh, modelMatrix, proj, view, pw, ph, \{ lensLocal = false \} = \{\}\)/);
  assert.match(rr, /const sd = lensLocal \? this\._cloudShadow : null;\s*\n\s*if \(sd\) \{ this\._cloudShadow = null; this\._csStamp\+\+; \}/, 'borrowed off');
  assert.match(rr, /finally \{\s*\n\s*this\._proj = sp; this\._view = sv; this\._fogMode = sf;\s*\n\s*if \(sd\) \{ this\._cloudShadow = sd; this\._csStamp\+\+; \}/, 'and returned with the stamp bumped, whatever the draw did');
  assert.match(read('src/combat/fpArm.js'), /renderer\.renderCharacterSprite\(mesh, NIF_TO_PASS, proj, view, pw, ph, \{ lensLocal: true \}\)/, 'the arm says so');
  assert.doesNotMatch(read('src/render/characterSprite.js'), /lensLocal/, 'the rig sprite box is in the world: it keeps the deck');
  assert.match(shared, /clouds\?\.setState\(enhancedSky\.state, weatherRowNow, weatherName, easeDt, driftXZ, extra\?\.flash \?\? 0, extra\?\.pos \?\? null\);/, 'the eased row, the front-stretched dt, the one drift integral, the host\'s flash and position');
  assert.match(shared, /draw\(yaw, pitch, fovY, aspect, viewport = \[0, 0, gl\.drawingBufferWidth, gl\.drawingBufferHeight\]\) \{\s*\n\s*\(enhancedSky \?\? dynamicSky \?\? sky\)\.draw\(yaw, pitch, fovY, aspect\);\s*\n\s*if \(clouds\) \{ clouds\.update\(viewport\); clouds\.draw\(yaw, pitch, fovY, aspect\); \}/, 'marched then composited after the dome, inside the host\'s marked span');
  const dome = read('src/render/enhancedSky.js');
  assert.match(dome, /gl\.uniform1f\(u\.uCloudCover, this\.cloudsExternal \? 0 : s\.cloudCover\);/, 'cover 0 to the dome\'s shader under the clouds; the state keeps the row\'s');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(h);
    assert.match(s, /sky\.draw\([^;]*worldAspect, renderer\.worldViewportPx \?\? \[0, 0, renderer\.gl\.drawingBufferWidth, renderer\.gl\.drawingBufferHeight\]\);/, `${h}: the world rect the map restores`);
    assert.match(s, /sun: wxNow\.sun, flash: flash - 1, pos: [^}]+ \}\);/, `${h}: the strobe and the camera's position reach the clouds`);
  }
  const lab = read('src/tools/skyLab.js');
  assert.match(lab, /if \(!dynamicOn && cloudsDoor !== 'off'\) sky\.cloudsExternal = true;/);
  assert.match(lab, /clouds \?\?= new VolumetricClouds\(gl, Object\.hasOwn\(CLOUD_QUALITY, cloudsDoor\) \? cloudsDoor : 'default', \[0, 0, w, h\]\);/);
  assert.match(lab, /window\.__skyReady = texturesPending === 0 && \(!clouds \|\| clouds\.sweeps > 0\);/, 'the probe waits for the first sweep');
  // VC5: the panel's clouds row is the URL doors made visible - a change rewrites the query and reloads
  assert.match(lab, /\$\('clouds'\)\.value = cloudsDoor === 'off' \|\| Object\.hasOwn\(CLOUD_QUALITY, cloudsDoor\) \? cloudsDoor : 'default';/);
  assert.match(lab, /\$\('shadowmap'\)\.checked = params\.has\('shadowmap'\);/);
  assert.match(lab, /if \(\$\('clouds'\)\.value === 'default'\) p\.delete\('clouds'\); else p\.set\('clouds', \$\('clouds'\)\.value\);/, 'default is no door');
  const html = read('sky.html');
  assert.match(html, /<select id="clouds"><option>off<\/option><option>lo<\/option><option>default<\/option><option>hi<\/option><\/select>/, 'the four doors');
  assert.match(html, /<input id="shadowmap" type="checkbox" \/>/);
  assert.match(read('test/glstate.test.js'), /'src\/render\/volumetricClouds\.js'/, 'the AUDIT 47 sweep reads the march and the composite');
});
