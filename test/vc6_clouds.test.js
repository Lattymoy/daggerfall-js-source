// VC6 - THE CLOUDS, SECOND PASS (2026-09-18). Mac, four reports in one:
//
//   1. "clouds repeat pretty consistently when its partly cloudy"
//   2. "in the evening when the sun is setting and the sky is golden,
//      clouds arent influenced by the sun"
//   3. "when the sun is covered by clouds, there shouldnt be sky rays or
//      sky rays coming through trees/flora"
//   4. "overall enhancing performance on the outside due to all our new
//      additions"
//
// VC6a the repeat, VC6b the golden hour, VC6c the shafts, VC6d the
// frame. Node has no GL: the pure laws and the shader TEXTS are pinned
// here, as VC3's own pins are, and the pictures are the lab's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLOUD_FIELD_GLSL, MARCH_FS, SHADOW_FS, MARCH_UNIFORMS, FIELD_UNIFORMS, VC_PROFILE,
  SHAPE_METRES, VARIATION_METRES, DETAIL_METRES, MOTTLE_METRES, WARP_METRES, FIELD_PERIOD_METRES,
  PIXEL_METRES, MARCH_SLACK, QUALITY, packCells, cellOf, horizonDip, EARTH_RADIUS_M,
} from '../src/render/volumetricClouds.js';
import { skyState } from '../src/render/enhancedSky.js';
import { CLOUD_SHADOW_GLSL } from '../src/render/cloudShadow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/** The body of `density()` alone - where every VC6a and VC6d law lives. */
const densityBody = () => {
  const i = CLOUD_FIELD_GLSL.indexOf('float density(vec3 p, float mip) {');
  assert.ok(i > 0, 'the field declares density');
  return CLOUD_FIELD_GLSL.slice(i);
};

// ═══════════════════════════════════════════════════════════════════════
// VC6a - THE REPEAT
// ═══════════════════════════════════════════════════════════════════════

test('VC6a: the periods no longer walk in step - the variation is five times the shape volume, not one and a bit, and every period still divides the field\'s', () => {
  // THE BUG, in two numbers. The shape volume tiles every 12288 m; the
  // variation field that is supposed to break it up tiled every 13107 m.
  // Seven per cent apart, so the two grids stayed in phase for kilometres
  // and the same bank came back inside ONE visible sky - the march reaches
  // 24000 m. Eighty pixels puts the beat out past the field's own period.
  assert.equal(SHAPE_METRES, PIXEL_METRES * 15);
  assert.equal(VARIATION_METRES, PIXEL_METRES * 80);
  assert.ok(VARIATION_METRES / SHAPE_METRES > 4, `the variation must not sit near the shape's period: ${VARIATION_METRES / SHAPE_METRES}x`);
  assert.ok(VARIATION_METRES > 24000, 'and it must outreach the march itself (24 km), or its own tile would show');
  // CLK1's invariant is unchanged and now covers the warp too: a position
  // moved by a whole field period is warped by the same vector and lands
  // on the same cloud, so the drift and the recenter can be wrapped.
  for (const [name, m] of Object.entries({ SHAPE_METRES, DETAIL_METRES, VARIATION_METRES, MOTTLE_METRES })) {
    const n = FIELD_PERIOD_METRES / m;
    assert.ok(Math.abs(n - Math.round(n)) < 1e-9 && n >= 1, `${name} divides the field's period (${n} times)`);
  }
  assert.ok(WARP_METRES > 0 && WARP_METRES < SHAPE_METRES / 3, `the warp bends the lattice, it does not tear a cloud: ${WARP_METRES} m against a ${SHAPE_METRES} m tile`);
});

test('VC6a: one texture read does four jobs - two coverage frequencies and the domain warp - so the repeat is broken for nothing', () => {
  const d = densityBody();
  // the variation sample is taken FIRST, on the UNWARPED position, and
  // all four of its channels are spent
  assert.match(d, /vec4 v = textureLod\(uShape, vec3\(q\.x \/ VARIATION_M, 0\.37, q\.z \/ VARIATION_M\), 0\.0\);/, 'the weather over the land, read whole');
  assert.match(d, /float variation = clamp\(v\.r \* 0\.65 \+ v\.a \* 0\.35, 0\.0, 1\.0\);/, 'two frequencies of coverage, not one');
  assert.match(d, /q\.xz \+= \(v\.gb \* 2\.0 - 1\.0\) \* WARP_M;/, 'and the other two read as a vector that bends the sample');
  // the ORDER is the whole trick: warp, then shape. A shape read before
  // the warp would be the unbent lattice the eye was finding.
  assert.ok(d.indexOf('q.xz += (v.gb') < d.indexOf('vec4 s = textureLod(uShape, q / SHAPE_M, mip);'), 'the warp is applied BEFORE the shape is sampled');
  // and it cost nothing: the same three reads the field always took
  assert.equal((d.match(/textureLod\(/g) || []).length, 3, 'the variation, the shape and the detail - no fourth read was added');
});

test('VC6a: the cloud TYPE varies across the sky, and collapses to one thing for a weather that IS one thing', () => {
  const d = densityBody();
  assert.match(d, /float flatHere = clamp\(fFlat \+ \(variation - 0\.5\) \* fVary, 0\.0, 1\.0\);/, 'flatter where there is more cloud, towers where there is less');
  assert.match(d, /float ceiling = 1\.0 - fVary \* \(1\.0 - variation\) \* 0\.8;/, 'and a lower ceiling where the cloud is thin');
  assert.match(d, /float grad = heightGradient\(clamp\(h \/ max\(ceiling, 0\.05\), 0\.0, 1\.0\), flatHere\);/, 'the gradient is taken at the PLACE\'s flatness and ceiling');
  // AT vary 0 THE WHOLE TERM IS THE OLD ONE. flatHere == fFlat and
  // ceiling == 1, so fog and a sandstorm are the lids they were - which
  // is what makes this safe to have added at all.
  assert.equal(VC_PROFILE.fog.vary, 0);
  assert.equal(VC_PROFILE.sandstorm.vary, 0);
  for (const [name, p] of Object.entries(VC_PROFILE)) {
    assert.ok(p.vary >= 0 && p.vary <= 1, `${name}: a fraction`);
    if (p.flat >= 0.95) assert.equal(p.vary, 0, `${name}: a lid is one thing everywhere`);
  }
  // a cell brings its own, on the tint array's spare lane - no fifth array
  const k = packCells([cellOf('thunder', 0, 0, 1000)], 8);
  assert.equal(k.t[3], Math.fround(VC_PROFILE.thunder.vary), 'the cell\'s vary rides uCellC.w');
  assert.match(CLOUD_FIELD_GLSL, /fVary = mix\(fVary, uCellC\[i\]\.w, w\);/, 'and is blended by the rim like every other term');
  assert.ok(FIELD_UNIFORMS.includes('uVary'), 'the zone\'s own, declared with the field so BOTH marches take it');
  assert.equal((CLOUD_FIELD_GLSL.match(/uniform float uVary;/g) || []).length, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// VC6b - THE GOLDEN HOUR
// ═══════════════════════════════════════════════════════════════════════

test('VC6b: the deck sees the sun past the ground\'s horizon, and the light it takes is that sun\'s colour', () => {
  // the geometry, by value - a degree and a half for this slab
  assert.equal(EARTH_RADIUS_M, 6371000);
  assert.ok(Math.abs(horizonDip(2300) * 180 / Math.PI - 1.54) < 0.01, `1.54 degrees: ${horizonDip(2300) * 180 / Math.PI}`);
  // THE PALETTE. The clouds used to be a quarter of the way to night by
  // the time the sun touched the horizon, and only a quarter of the way
  // to the sun's own colour. Both are the hour Mac is describing.
  const s = readFileSync(join(ROOT, 'src/render/enhancedSky.js'), 'utf8');
  assert.match(s, /const twilight = clamp01\(\(elevDeg \+ 9\) \/ 10\);/, 'full colour at the horizon, night over the civil twilight that follows');
  assert.match(s, /const lit = mix3\(nightLit, mix3\(cloudLitDay, pal\.sun, 0\.55 \* lowSun\), twilight\);/, 'over half the way to the sun\'s colour at a low sun');
  assert.match(s, /const shade = mix3\(nightShade, mix3\(cloudShadeDay, pal\.glow, 0\.30 \* \(1 - clamp01\(elevDeg \/ 12\)\)\), twilight\);/, 'and the shaded side takes the horizon\'s glow');
  // BY VALUE, on the real clock. At noon nothing moved; at the horizon
  // the cloud is amber and warmer than its own weather row.
  const noon = skyState({ minuteOfDay: 720, weather: 'sunny' });
  assert.ok(noon.cloudLit[0] > 0.9 && Math.abs(noon.cloudLit[0] - noon.cloudLit[2]) < 0.05, 'noon: white, as it was');
  const dusk = skyState({ minuteOfDay: 1080, weather: 'sunny' });
  assert.ok(Math.abs(dusk.elevDeg) < 0.5, `minute 1080 is the sun on the horizon: ${dusk.elevDeg}`);
  assert.ok(dusk.cloudLit[0] - dusk.cloudLit[2] > 0.2, `the lit side is warm at sunset: ${dusk.cloudLit}`);
  assert.ok(dusk.cloudShade[0] > dusk.cloudShade[2], 'and so, less, is the shaded side');
  assert.ok(dusk.cloudLit[0] > 0.8, 'still BRIGHT - a sunset cloud is not a dark cloud');
  // and it still goes out: deep dusk is the night colour, unchanged
  const night = skyState({ minuteOfDay: 1170, weather: 'sunny' });
  assert.ok(night.cloudLit[0] < 0.2 && night.cloudLit[2] > night.cloudLit[0], 'deep dusk: dim and blue');
});

test('VC6b: the march\'s three low-sun terms are weighted by how low the sun is, so noon is the picture it was', () => {
  assert.match(MARCH_FS, /float low = smoothstep\(0\.30, -0\.03, uLightDir\.y\);/, '0 above 17 degrees, 1 at and below the horizon');
  assert.match(MARCH_FS, /float toward = clamp\(cosTheta \* 0\.5 \+ 0\.5, 0\.0, 1\.0\);/, 'the half of the sky the sun is in');
  assert.match(MARCH_FS, /vec3 duskTint = mix\(hue\(uSkyTint\), hue\(uLightColor\), toward\);/, 'gold toward the sun, the zenith\'s blue away from it');
  assert.match(MARCH_FS, /float gain = mix\(0\.7, 1\.05, low\);/, 'the direct term opens as the sun drops - a rim lit from the horizon is the brightest thing in the sky');
  assert.match(MARCH_FS, /float sideLit = mix\(h, 0\.25 \* h \+ 0\.75, low\);/, 'top-lit by day, whole-lit at dusk: the UNDERSIDE is what burns');
  assert.match(MARCH_FS, /ambient \*= mix\(vec3\(1\.0\), duskTint, low \* 0\.8\);/);
  // A TINT MAY NOT TURN THE EXPOSURE UP. Both ends of duskTint go
  // through hue(), which normalises to luminance one, so the term can
  // only move a colour's hue - the golden hour is not a brightness cheat.
  assert.match(MARCH_FS, /vec3 hue\(vec3 c\) \{ return c \/ max\(dot\(c, vec3\(0\.2126, 0\.7152, 0\.0722\)\), 1e-4\); \}/);
  assert.equal((MARCH_FS.match(/hue\(/g) || []).length, 3, 'declared once, used at both ends of the tint and nowhere else');
  // every one of them is dead at noon: low is 0 for any sun above 0.30
  assert.ok(MARCH_FS.includes('uniform vec3 uSkyTint;'), 'the zenith is a uniform of the march');
  assert.ok(MARCH_UNIFORMS.includes('uSkyTint'), 'and its location is fetched');
  assert.match(read('src/render/volumetricClouds.js'), /gl\.uniform3fv\(u\.uSkyTint, s\.zenith\);/, 'from the dome\'s own zenith - one palette, two readers');
  // and the controller hands the light the SLAB it falls on, or the dip
  // would be the default 2300 m for a storm's 4200 m tops as well
  assert.match(read('src/render/volumetricClouds.js'), /const light = cloudLight\(s, p\);   \/\/ VC6b:/, 'the eased profile, not nothing');
  // the underside, by its own pin: a low sun lights it
  assert.match(MARCH_FS, /float sideLit = mix\(h, 0\.25 \* h \+ 0\.75, low\);   \/\/ VC6b: top-lit by day, whole-lit at dusk/);
  // the SHADOW march takes none of it: a shadow is a transmittance, and
  // has no colour to warm
  assert.doesNotMatch(SHADOW_FS, /uSkyTint|duskTint|sideLit/);
});

// ═══════════════════════════════════════════════════════════════════════
// VC6c - THE SHAFTS
// ═══════════════════════════════════════════════════════════════════════

test('VC6c: a sun behind a bank throws no shafts - the gate is the cloud shadow at the player\'s own feet', () => {
  const air = read('src/render/airPass.js');
  // THE BUG: the mask was sky depth alone, so anything at the far plane
  // near the sun's screen position was a light source, cloud or no cloud.
  assert.match(air, /float sky = depthAt\(uv\) >= 0\.99999 \? 1\.0 : 0\.0;/, 'the mask still finds the sky');
  assert.match(air, /float through = cloudShadowAt\(uEye\);/, 'and now asks how much sun reaches the player at all');
  assert.match(air, /uShaftParams\.y \* through \* through\), 1\.0\);/, 'squared: a shaft needs a BEAM, so half the sun is a quarter of the rays');
  assert.match(air, /\$\{CLOUD_SHADOW_GLSL\}/, 'the same block the ground reads - one field, three consumers');
  assert.match(air, /uniform vec3 uEye;/);
  assert.match(air, /shaft: P\(QUAD_VS, SHAFT_FS, \['uDepth', 'uSun', 'uShaftParams', 'uSunColor', 'uProjInfo', 'uRect', 'uCanvas', 'uEye', 'uCloudShadowMap', 'uCloudShadowRect'\]\)/, 'every uniform it declares has its location fetched');
  assert.match(air, /gl\.uniform3fv\(this\.programs\.shaft\.uEye, f\.eye\);/);
  assert.match(air, /gl\.uniform4fv\(this\.programs\.shaft\.uCloudShadowRect, deck\?\.rect \?\? this\._noDeck\);/);
  // OFF IS FREE. No deck - the classic skin, every interior, ?clouds=off -
  // means an amount of 0, and the block's own first line answers full sun
  // before it samples anything. The pass is exactly what it was.
  assert.match(CLOUD_SHADOW_GLSL, /if \(uCloudShadowRect\.w <= 0\.0\) return 1\.0;/);
  assert.match(air, /this\._noDeck = new Float32Array\(\[0, 0, 0, 0\]\);/, 'and that is what a missing deck uploads');
  assert.match(read('src/render/renderer.js'), /cloudShadow: this\._cloudShadow,   \/\/ VC6c: the sun behind a bank throws no shafts/, 'the renderer hands the frame\'s deck to the pass');
});

// ═══════════════════════════════════════════════════════════════════════
// VC6d - THE FRAME
// ═══════════════════════════════════════════════════════════════════════

test('VC6d: no sample is taken outside the band, and the gate is the band\'s own ends - never the gradient, which the place can reopen', () => {
  const d = densityBody();
  // Both marches walk the UNION slab (the zone's widened to hold every
  // cell's), so under a sunny zone with a thunderhead on the horizon
  // every ray walked 500-4200 m while the zone's cloud lives 1400-3200.
  // heightGradient already answered 0 outside the band - after two 3D
  // texture reads had been paid for.
  assert.match(d, /float hr = \(p\.y - fBase\) \/ max\(fTop - fBase, 1\.0\);\s*\n\s*if \(hr <= 0\.0 \|\| hr >= 1\.0\) return 0\.0;/, 'the UNCLAMPED height, and the band\'s own ends');
  const gate = d.indexOf('if (hr <= 0.0 || hr >= 1.0) return 0.0;');
  assert.ok(gate > 0 && gate < d.indexOf('textureLod('), 'and it returns before the first texture read');
  // it must NOT be a gradient test: the local flatness computed below can
  // reopen a height the zone's flatness would have closed (a lid's
  // gradient is 0 above h 0.5, a tower's is not), and a gradient gate
  // would have culled cloud the field is meant to grow there.
  const before = d.slice(0, gate).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(before, /heightGradient/, 'the gate is not the gradient');
});

test('VC6d: the march strides over empty air and walks the cloud\'s EDGE fine, and the slack is what keeps a far bank', () => {
  assert.match(MARCH_FS, /float coarse = ds \* 3\.0;/);
  assert.match(MARCH_FS, /if \(rho <= 0\.0\) \{ empty\+\+; t \+= \(empty > 4 \? coarse : ds\); continue; \}/, 'four empty steps, then stride');
  assert.match(MARCH_FS, /if \(empty > 4\) \{ t -= coarse; empty = 0; continue; \}/, 'and the step that finds cloud BACKS THE STRIDE OUT - the edge is never resolved coarsely, which is what a plain bigger step would have shown');
  assert.match(MARCH_FS, /if \(i >= uSteps \+ 12 \|\| t > t1\) break;/, 'the ray may finish early, or need a few steps more than its budget');
  assert.equal(MARCH_SLACK, 12);
  for (const [name, q] of Object.entries(QUALITY)) {
    assert.ok(q.steps + MARCH_SLACK <= 96, `${name}: the slack stays inside the loop's own hard cap`);
  }
  // the light march stops once no later step could be seen
  assert.match(MARCH_FS, /if \(sum \* EXT > 6\.0\) break;/, 'exp(-6) is two parts in a thousand');
  // the SHADOW march takes NONE of it: it is 24 steps over a slab it
  // already sizes to the path, and its whole answer is one exponential
  // of the sum - there is no edge to resolve and nothing to stride past.
  // (It gains the band gate above for free, through the shared field.)
  const shadowBody = SHADOW_FS.slice(SHADOW_FS.indexOf('void main()')).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(shadowBody, /coarse|empty|t -= /);
  assert.match(shadowBody, /sum \+= density\(p, 0\.5\) \* ds;\s*\n\s*t \+= ds;/, 'one fixed step, as it always was');
});

test('VC6d: the frame\'s spans TILE it - every mark hands the clock straight to the next, so the zones sum to the frame', () => {
  const r = read('src/render/renderer.js');
  const shared = read('src/scenes/shared.js');
  // shadow -> world -> (sky -> world) -> air -> stop. Every span begins
  // where the last ended; nothing is counted twice and nothing is lost
  // between them, which is the only reason the total in the line is true.
  assert.match(r, /this\._perf\.begin\(\); this\._perf\.mark\('shadow'\);/);
  assert.match(r, /this\._perf\?\.mark\('world'\);[^\n]*\n\s*sp\.discard\(\);/, 'the passes end where the world\'s draws begin');
  assert.match(r, /this\._perf\?\.mark\('air'\);[^\n]*\n\s*this\._air\.composite\(\);/);
  assert.match(r, /this\._perf\.end\(\);\s*\n\s*this\._perf\.stop\(\);/, 'and the last span closes with the frame');
  assert.match(shared, /meter\?\.mark\('sky'\);/); assert.match(shared, /meter\?\.mark\('world'\);/);
  assert.equal((shared.match(/meter\?\.mark\(/g) || []).length, 2, 'the sky takes its span and hands the frame back - it does not keep it');
  // the meter is found by the GL the host already holds: no renderer is
  // threaded into scenes/shared.js for a readout
  assert.match(shared, /import \{ meterFor \} from '\.\.\/render\/perfMeter\.js';/);
  assert.doesNotMatch(shared, /new PerfMeter\(/, 'one meter a context, and the renderer builds it');
});
