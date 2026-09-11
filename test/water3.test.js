// WATER3 (2026-09-11, Mac: "waves, shorelines"): THE SWELL AND THE
// FOAM. The vertex rides the height whose gradient the fragment's
// trains are; the fragment foams the shore and the crests. Pinned by
// reading BOTH shaders and holding the trains' numbers equal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WATER_SURFACE_VS, waterSurfaceFs, waterUniforms, SWELL_DEPTH, FOAM_DEPTH, SHORE_DEPTH } from '../src/render/waterSurface.js';
import { BASIN_DEPTH } from '../src/render/waterBasin.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const FS = waterSurfaceFs('float cloudShadowAt(vec3 wp) { return 1.0; }');

test('WATER3: the vertex rides the INTEGRAL of the fragment\'s wave field - three trains, amplitude A / k, the same wavenumber, phase speed and distance fade, the same crossing rotations; the rain\'s trains are not ridden (mutant: a train\'s number changed on one side only)', () => {
  const grad = [...FS.matchAll(/g \+= \(([\d.]+) \* s \* exp\(-dist \* ([\d.]+)\)\) \* cos\(dot\(p, (d\d)\) \* ([\d.]+) \+ t \* ([\d.]+)\) \* d\d;/g)]
    .map((m) => ({ A: +m[1], fade: +m[2], d: m[3], k: +m[4], w: +m[5] }));
  const lift = [...WATER_SURFACE_VS.matchAll(/h \+= \(([\d.]+) \/ ([\d.]+) \* s \* exp\(-dist \* ([\d.]+)\)\) \* sin\(dot\(p, (d\d)\) \* ([\d.]+) \+ t \* ([\d.]+)\);/g)]
    .map((m) => ({ A: +m[1], k0: +m[2], fade: +m[3], d: m[4], k: +m[5], w: +m[6] }));
  assert.equal(grad.length, 3, 'three wind trains in the fragment');
  assert.equal(lift.length, 3, 'three in the vertex');
  for (let i = 0; i < 3; i++) {
    assert.deepEqual({ A: lift[i].A, fade: lift[i].fade, d: lift[i].d, k: lift[i].k, w: lift[i].w }, grad[i], `train ${i}`);
    assert.equal(lift[i].k0, lift[i].k, `train ${i}: the amplitude is A over its OWN wavenumber`);
  }
  for (const rot of [/vec2 d1 = vec2\(0\.809 \* d0\.x - 0\.588 \* d0\.y, 0\.588 \* d0\.x \+ 0\.809 \* d0\.y\);/, /vec2 d2 = vec2\(0\.766 \* d0\.x \+ 0\.643 \* d0\.y, -0\.643 \* d0\.x \+ 0\.766 \* d0\.y\);/, /float s = 0\.35 \+ 0\.65 \* uWindStrength;/]) {
    assert.match(WATER_SURFACE_VS, rot); assert.match(FS, rot);
  }
  assert.doesNotMatch(WATER_SURFACE_VS, /uRain/, 'the rain pocks the surface; it does not lift it');
  assert.match(WATER_SURFACE_VS, /float ride = clamp\(aDepth \/ uSwellDepth, 0\.0, 1\.0\);\s*\n\s*world\.y \+= swellHeight\(world\.xz, uTime, dist\) \* ride;\s*\n\s*vWorldPos = world\.xyz;/, 'ridden in the world frame before the varyings are taken, scaled by the bed');
  assert.match(WATER_SURFACE_VS, /float dist = length\(uCamPos - world\.xyz\);/, 'the fade\'s distance is the fragment\'s');
});

test('WATER3: the foam - the shore band by the bed\'s rise, wider on a wind; the crests by the field\'s slope, only on a wind; the lace drawn along the wind; lit white by the ground\'s light; not glass (mutant: crest foam on a calm, or foam under the alpha)', () => {
  assert.match(FS, /shore = smoothstep\(0\.0, uFoamDepth \* \(0\.6 \+ 0\.8 \* uWindStrength\), vDepth\);/, 'the band by the bed\'s rise where the corner table draws (WATER5: `shore`, the one band both arms fill)');
  assert.match(FS, /float shoreFoam = \(1\.0 - shore\) \* smoothstep\(0\.35, 0\.75, lace/);
  assert.match(FS, /float crestFoam = smoothstep\(0\.16, 0\.30, length\(g\)\) \* uWindStrength \* smoothstep\(0\.45, 0\.8, lace\);/);
  assert.match(FS, /float lace = vnoise\(vWorldPos\.xz \* 0\.9 \+ uWindDir \* \(uTime \* 0\.6\)\) \* 0\.6 \+ vnoise\(vWorldPos\.xz \* 3\.1 - uWindDir \* \(uTime \* 1\.1\)\) \* 0\.4;/);
  assert.match(FS, /float foam = clamp\(shoreFoam \+ crestFoam, 0\.0, 1\.0\) \* exp\(-dist \* 0\.004\);/, 'fades before it aliases');
  assert.match(FS, /vec3 foamLit = vec3\(0\.92\) \* \(uAmbient \+ uSunColor \* \(uSunScale \* shadow\) \+ uMoonColor \* uMoonScale\);\s*\n\s*col = mix\(col, foamLit, foam\);/);
  const foamAt = FS.indexOf('col = mix(col, foamLit, foam);'), fogAt = FS.indexOf('outColor = vec4(mix(uFogColor, col');
  assert.ok(foamAt > 0 && foamAt < fogAt, 'the foam goes in before the fog');
  assert.match(FS, /float alpha = \(max\(body, foam\) \+ \(1\.0 - max\(body, foam\)\) \* F\) \* edge;/, 'foam is opaque');
  assert.match(FS, /float vnoise\(vec2 p\) \{[\s\S]*?f = f \* f \* \(3\.0 - 2\.0 \* f\);/, 'a smoothed value noise');
});

test('WATER3: the two dials ride waterUniforms and the renderer, and sit where the basin puts them - the swell fully ridden past the shore fade, the foam band inside the basin (mutant: a dial dropped from the draw)', () => {
  const u = waterUniforms({});
  assert.equal(u.swellDepth, SWELL_DEPTH);
  assert.equal(u.foamDepth, FOAM_DEPTH);
  assert.ok(SWELL_DEPTH > SHORE_DEPTH * 2 && FOAM_DEPTH < BASIN_DEPTH / 2, `${SWELL_DEPTH} ${FOAM_DEPTH}`);
  const r = rd('src/render/renderer.js');
  assert.match(r, /swellDepth: u\('uSwellDepth'\), foamDepth: u\('uFoamDepth'\),/);
  assert.match(r, /gl\.uniform1f\(L\.swellDepth, u\.swellDepth\); gl\.uniform1f\(L\.foamDepth, u\.foamDepth\);/);
  for (const name of ['uTime', 'uWindDir', 'uWindStrength', 'uSwellDepth', 'uCamPos']) assert.match(WATER_SURFACE_VS, new RegExp(`uniform \\w+ ${name};`), `${name} reaches the vertex`);
});

test('WATER3: at a gale the long train lifts the surface a fifth of a unit, at a calm a third of that - the swell is a swell, not a step (mutant: the amplitude not divided by the wavenumber)', () => {
  const m = /h \+= \(([\d.]+) \/ ([\d.]+) \* s \* exp/.exec(WATER_SURFACE_VS);
  const amp = (+m[1]) / (+m[2]);
  assert.ok(Math.abs(amp * (0.35 + 0.65) - 0.2) < 1e-9, `gale ${amp}`);
  assert.ok(Math.abs(amp * 0.35 - 0.07) < 1e-9, 'calm');
  assert.ok(amp < SWELL_DEPTH / 4, 'never higher than the bed it rides is deep');
});
