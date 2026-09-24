// WIND4 (2026-09-15, Mac, three in one message):
//
//   1. "The wind wisps are far too many and the amount should be reduced."
//   2. "Clouds dont follow on the world timer with the direction of the wind"
//   3. "Grass doesnt get darker at night"
//
// Three faults, three different shapes, one slice.
//
// (1) was a NUMBER: 2400 wisps in a 90 m box at a gale - about one per
// three cubic metres of the air in front of you - which reads as a fog
// of streaks rather than as wind. The field's job is to make the
// DIRECTION legible, which a few streaks moving together do.
//
// (2) was a SIGN, and the one sign that cannot be seen from inside the
// shader. The cloud field is sampled at an absolute position: the
// floating origin's recenter is ADDED (`shift -= offset` at the seam,
// so `p + shift` is where the point really is). The drift is not a
// position - it is how far the AIR has travelled - and it was added
// too, so a field sampled at `p + d` showed the cloud that was at
// `p + d` standing at `p`: the whole sky crept UPWIND at exactly the
// wind's own speed. The wisps had it right all along (windWisps.js
// advances the wisp's POSITION by the same offset), which is why the
// two disagreed in the open.
//
// (3) was a MISSING TERM, twice over. Every other surface in the world
// lights as ambient + sun colour x sun SCALE x lambert + the moon's the
// same way (render/renderer.js and its three siblings); the sward used
// the sun's COLOUR and dropped its SCALE - the term that goes to zero
// when the sun sets - and had no moon at all. So at midnight the ground
// went dark and the grass stayed lit by a sun that was not there.
//
// The grass shader is byte-identical to `grass-proto.html` by GR1's
// law, so the lab carries the same change and hands the new uniforms
// its own way (no night in the lab: scale one, moon off).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WISP_MAX, WISP_FLOOR, WISP_BOX, WISP_LOOK, SAND_LOOK, wispCount } from '../src/render/windWisps.js';
import { WORLD_PER_DRIFT, wrapField } from '../src/render/volumetricClouds.js';
import { LAB_GRASS_FS, LAB_GRASS_VS, GRASS2_VS_EDITS } from '../src/render/labGrass.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WIND4 (1) the wisps thinned, executed - and WIND5 thinned them again (240, Mac: "reduce the amount of wind streaks"), and DISC17-A again (120, "reduce the amount of wind wisps"): a gale in the 90 m box, a calm ten', () => {
  assert.equal(WISP_MAX, 120, 'WIND4 took 2400 to 650; WIND5 to 240, each wisp now a flourish; DISC17-A to 120');
  assert.equal(WISP_FLOOR, 0.08);
  assert.equal(WISP_BOX, 90, 'the box is unchanged - this is density, not reach');
  assert.equal(wispCount(1), 120, 'a gale');
  assert.equal(wispCount(0), 10, 'a dead calm still shows the direction');
  // the shape of the curve is untouched: floor, smoothstep, clamped ends
  assert.equal(wispCount(2), WISP_MAX); assert.equal(wispCount(-1), wispCount(0));
  assert.ok(wispCount(0.35) > wispCount(0) && wispCount(0.35) < WISP_MAX);
  // THE MEASURE THAT MATTERS: wisps per cubic metre of the box, which
  // is what "far too many" was about. Under one per 1000 m3 at a gale.
  const perThousand = (n) => n / (WISP_BOX ** 3) * 1000;
  assert.ok(perThousand(wispCount(1)) < 1, `a gale is ${perThousand(wispCount(1)).toFixed(2)} wisps per 1000 m3`);
  assert.ok(perThousand(2400) > 3, 'where the old maximum was over three');
  // the SANDSTORM is a wall of sand and keeps its own density - it was
  // never the thing being complained about
  assert.equal(SAND_LOOK.count, 7000);
  assert.equal(SAND_LOOK.floor, 0, 'and no sand without a storm');
  assert.equal(WISP_LOOK.count, WISP_MAX);
});

test('WIND4 (2) the clouds go WITH the wind: the drift is subtracted from the sample, the recenter still added', () => {
  const vc = read('src/render/volumetricClouds.js');
  assert.match(vc, /vec3 q = vec3\(p\.x \+ uShift\.x - uDrift\.x \+ fShear \* \(p\.y - fBase\), p\.y, p\.z \+ uShift\.y - uDrift\.y\);/,
    'the density march');
  assert.match(vc, /textureLod\(uShape, vec3\(p\.x \+ uShift\.x - uDrift\.x, p\.y, p\.z \+ uShift\.y - uDrift\.y\) \/ MOTTLE_M/,
    'and the ambient mottle, which rides the same air');
  assert.ok(!/uShift\.x \+ uDrift\.x/.test(vc), 'no sample adds the drift any more');
  // THE LAW, AS ARITHMETIC. The shader reads N(p - d). A cloud sitting
  // at field position x0 is therefore drawn where p - d == x0, i.e. at
  // p = x0 + d - downwind, by exactly the drift. This is the shader's
  // own line restated in JS: a model, and labelled one, because a
  // fragment shader cannot be called from node.
  const sampleAt = (p, drift) => p - drift;            // the line above
  const cloudSeenAt = (x0, drift) => x0 + drift;       // its inverse
  for (const d of [0, 120, -400, 5000]) {
    assert.equal(sampleAt(cloudSeenAt(0, d), d), 0, `a cloud at the origin is drawn ${d} m downwind`);
  }
  // and the drift itself is the wind integrated on the WORLD clock, in
  // world metres - the seam that carries it, unchanged
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /driftXZ\[0\] \+= weatherRowNow\.wind\[0\] \* dt \* WIND_SECONDS_PER_MINUTE;/);
  assert.match(shared, /const dt = lastMin === null \|\| nowMin < lastMin \? 0 : nowMin - lastMin;/, 'dt is GAME minutes, so a rest moves the sky');
  assert.match(shared, /weatherRowNow\.wind = windModel\.vector\(\);/, 'and the wind is the live model\'s, not the row\'s table value');
  assert.ok(WORLD_PER_DRIFT > 0);
  assert.equal(wrapField(0), 0, 'the wrap is still the field\'s period');
});

test('WIND4 (3) the grass darkens: the sward takes the sun\'s SCALE and the moon, the two terms the ground always had', () => {
  assert.match(LAB_GRASS_FS, /uniform vec3 uAmb, uSunCol, uMoonCol; uniform float uDim, uSunScale, uMoonScale;/);
  assert.match(LAB_GRASS_FS, /c \*= \(uAmb \* 1\.25 \* \(0\.42 \+ 0\.58\*vT\) \+ uSunCol \* \(uSunScale \* 1\.15 \* vLam\) \+ uMoonCol \* \(uMoonScale \* 1\.15 \* vMoonLam\)\);/,
    'the sun is scaled and the moon is added');
  assert.match(LAB_GRASS_FS, /c \+= uSunCol \* \(uSunScale \* 0\.20\) \* smoothstep\(0\.86,1\.0,vT\) \* vLam;/, 'the rim goes out with the sun');
  assert.ok(!/uSunCol \* 1\.15 \* vLam/.test(LAB_GRASS_FS), 'the unscaled sun is gone');
  assert.match(LAB_GRASS_VS, /uniform vec3 uEye, uSunDir, uMoonDir;/);
  assert.match(LAB_GRASS_VS, /vMoonLam = max\(dot\(nrm, normalize\(uMoonDir\)\), 0\.0\);/);
  // the host hands all of it - three of five terms is what the bug was
  assert.match(read('src/scenes/world.js'),
    /sunScale: renderer\._sunScale, moonDir: renderer\._moonDir, moonScale: renderer\._moonScale, moonCol: renderer\._moonColor \}/);
  // ...and a host that hands none is the OLD look, never a black field
  const grass = read('src/render/labGrass.js');
  assert.match(grass, /gl\.uniform1f\(u\.uSunScale, light\.sunScale \?\? 1\);/);
  assert.match(grass, /gl\.uniform1f\(u\.uMoonScale, light\.moonScale \?\? 0\);/);
  for (const n of ['uSunScale', 'uMoonDir', 'uMoonScale', 'uMoonCol']) assert.ok(grass.includes(`'${n}'`), `${n} is looked up`);
  // GR1's law: the lab is the same text, and sets the new uniforms itself
  const lab = read('grass-proto.html');
  assert.ok(lab.includes(LAB_GRASS_FS), 'the lab carries this fragment stage verbatim - GRASS2 changed no fragment law');
  // GRASS2: the VERTEX stage is the lab's text plus its declared edits (four since GRASS6)
  // now, so it is no longer a substring of the lab. The whole-text law
  // lives in labGrass.test.js, which applies the edits and compares; what
  // is checked here is that the lab still carries the lines those edits
  // replace - if the lab moved under them, that pin's `from` would stop
  // matching and the departure would silently become a rewrite.
  for (const e of GRASS2_VS_EDITS) assert.ok(lab.includes(e.from), `the lab still carries the line this edit replaces: ${e.why}`);
  assert.ok(!lab.includes(LAB_GRASS_VS), 'and the port\'s vertex stage is NOT the lab\'s any more - the departure is real and says so here too');
  assert.match(lab, /gl\.uniform1f\(gl\.getUniformLocation\(grassProg, 'uSunScale'\), 1\);/, 'the lab has no night: scale one');
  assert.match(lab, /gl\.uniform1f\(gl\.getUniformLocation\(grassProg, 'uMoonScale'\), 0\);/);
});

test('WIND4 records: the rendering page, the ledger row and the testing row', () => {
  assert.match(read('bible/07-Rendering/Rendering.md'), /^## WIND4 - THE WISPS' COUNT, THE SKY'S DIRECTION, THE GRASS AT NIGHT \(2026-09-15\)/m);
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /THE WISPS' COUNT, THE SKY'S DIRECTION, THE GRASS AT NIGHT \(WIND4, 2026-09-15\)/);
  assert.match(read('bible/09-Testing/Testing.md'), /^\| wind4_windweather\.test\.js \| \d+ \| WIND4/m);
});
