// RAIN-SPRINKLE (FIELD BUGS 2026-10-01 #2 - "Rain shouldnt always be a downpour, should sometimes sprinkle"). WX2
// rolled a rain's peak in 0.25..1, and on the weather map's lane (on by default under the enhanced environments, and
// always online) the place's intensity - the system's envelope, uniform on 0.2..1 over its core's area - was the roll,
// so no rain anywhere drew under ~0.4 of the profile (ten thousand drops in the eye's 42 m box); and whatever fell,
// the world wore the downpour's row - exp fog 0.003, the sun at 0.45, the grass dimmed to 0.6. Now the roll is skewed
// toward the light end (rain u^2 from 0.05, snow u^1.5 from 0.05; a storm is never thin), and the terms follow what
// falls (`fallTerms`): a sprinkle's fog is a quarter of the row's and its sun and grass an overcast sky's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeatherFront, rollPeak, wander, fallTerms, PRECIP_PEAK, PRECIP_SKEW, FALL_LOOK, FALL_FOG_FLOOR,
} from '../../../src/systems/weather/weatherFront.js';
import { EDGE_INTENSITY } from '../../../src/systems/weather/weatherMap.js';
import { FOG_SETTINGS, weatherSunlightScale } from '../../../src/world/weather.js';
import { LAB_DIM } from '../../../src/render/labGrass.js';

/** The drawn share at the mean of the wander, over a rain system's core: the map's intensity at d of the core
 *  (bandAt's 1 - (1 - EDGE) f^2, f = d / core) and the front's roll of it, sampled evenly over the core's AREA. */
function coreShares(n = 2000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = Math.sqrt((i + 0.5) / n);   // area-even
    const place = 1 - (1 - EDGE_INTENSITY) * f * f;
    out.push(rollPeak('rain', place) * 0.8);
  }
  return out;
}
const share = (xs, p) => xs.filter(p).length / xs.length;

test('RAIN-SPRINKLE: over a rain system\'s core a third of the ground sprinkles and a downpour is its heart - before, nothing under 0.3 fell anywhere (mutants: the skew; the floor)', () => {
  const xs = coreShares();
  const light = share(xs, (v) => v < 0.3), heavy = share(xs, (v) => v >= 0.65);
  assert.ok(light >= 0.3, `a sprinkle or a light shower over ${(light * 100).toFixed(0)}% of the core`);
  assert.ok(heavy <= 0.35, `a downpour over ${(heavy * 100).toFixed(0)}% of it, at its heart`);
  assert.ok(Math.min(...xs) < 0.08, `the core's edge drizzles (${Math.min(...xs).toFixed(3)} of the profile)`);
  assert.ok(Math.max(...xs) > 0.79, 'and its heart still pours');
  // the edge is the light end and the heart the heavy one - walking in thickens it, as WEATHER3b has it
  assert.ok(rollPeak('rain', EDGE_INTENSITY) < rollPeak('rain', 0.6) && rollPeak('rain', 0.6) < rollPeak('rain', 1));
  // the seeded lane (no map): forty cuts' peaks, as WX2's own pin rolls them
  const peaks = [];
  for (let m = 0; m < 400; m++) { const fr = createWeatherFront({ seed: 7 }); fr.tick({ weather: 'rain', nowMinutes: m * 977, jump: true }); peaks.push(fr.state().episode.peak); }
  assert.ok(share(peaks, (p) => p < 0.3) >= 0.35, `the seeded lane sprinkles too (${(share(peaks, (p) => p < 0.3) * 100).toFixed(0)}%)`);
  // the ranges and their skews
  assert.deepEqual(PRECIP_PEAK.rain, [0.05, 1.0]);
  assert.deepEqual(PRECIP_PEAK.snow, [0.05, 0.85]);
  assert.deepEqual(PRECIP_SKEW, { rain: 2, snow: 1.5, storm: 1, sand: 1 });
  for (let u = 0; u <= 1; u += 0.05) assert.ok(rollPeak('storm', u) >= 0.6, 'a storm is never thin');
  assert.ok(Math.abs(rollPeak('rain', 0.5) - (0.05 + 0.95 * 0.25)) < 1e-12, 'u^2 placed in the range');
});

test('RAIN-SPRINKLE: what falls sets the look - a sprinkle\'s fog is a quarter of its row\'s and its sun and grass an overcast sky\'s; a downpour is the row itself; nothing else is touched (mutants: the band; the fog floor; the gate on the word)', () => {
  const light = { sun: weatherSunlightScale('overcast', false), dim: LAB_DIM.overcast };
  const row = (w) => ({ sun: weatherSunlightScale(w, false), dim: LAB_DIM[w], fog: w === 'snow' ? FOG_SETTINGS.snowy : w === 'fog' ? FOG_SETTINGS.heavy : w === 'sandstorm' ? FOG_SETTINGS.sandstorm : w === 'sunny' ? FOG_SETTINGS.sunny : FOG_SETTINGS.rainy });
  const sprinkle = fallTerms(row('rain'), FALL_LOOK[0], 'rain', light);
  assert.equal(sprinkle.fog.mode, 'exp', 'the fog keeps its mode - no switch on the screen');
  assert.ok(Math.abs(sprinkle.fog.density - FOG_SETTINGS.rainy.density * FALL_FOG_FLOOR) < 1e-12, `a sprinkle\'s fog: ${sprinkle.fog.density}`);
  assert.equal(sprinkle.sun, light.sun); assert.equal(sprinkle.dim, light.dim);
  assert.equal(FOG_SETTINGS.rainy.density, 0.003, 'the row itself is untouched');
  for (const w of ['rain', 'thunder', 'snow']) {
    const r = row(w);
    assert.equal(fallTerms(r, FALL_LOOK[1], w, light), r, `${w}: a full fall is the row itself`);
    let last = null;
    for (let k = 0; k <= 1.0001; k += 0.05) {
      const t = fallTerms(r, k, w, light);
      assert.ok(t.sun >= r.sun - 1e-12 && t.dim >= r.dim - 1e-12, `${w} ${k}: never darker than the row`);
      if (last) assert.ok(t.fog.density >= last.fog.density - 1e-15 && t.sun <= last.sun + 1e-12, `${w}: the heavier, the thicker and the darker`);
      last = t;
    }
  }
  // a word with nothing falling in its look is handed back as it came - a fog bank, a sandstorm, a clear sky draining
  for (const w of ['fog', 'sandstorm', 'sunny', 'cloudy', 'overcast']) {
    const r = row(w);
    assert.equal(fallTerms(r, 0, w, light), r, `${w}: untouched`);
  }
  assert.deepEqual(FALL_LOOK, [0.05, 0.6]);
  // the front's own sample drives it: a sprinkle rolled, landed whole, looks like one
  const fr = createWeatherFront({ seed: 7 });
  let s = null;
  for (let m = 0; m < 400 && !(s && s.peak < 0.1); m++) { fr.tick({ weather: 'sunny', nowMinutes: m * 977 }); s = fr.tick({ weather: 'rain', nowMinutes: m * 977 + 1, jump: true, tsec: 0 }); }
  assert.ok(s.peak < 0.1 && Math.abs(s.intensity - s.peak * wander(0, fr.state().episode.phase)) < 1e-9, 'a sprinkle, on the frame');
  assert.ok(fallTerms(row('rain'), s.intensity, 'rain', light).fog.density < 0.0012, 'and its fog is thin');
});
