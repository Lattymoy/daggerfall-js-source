// RAIN-FPS (2026-09-25, Mac: "some ... are reporting fps drops. I myself have flawless performance. One user said
// they turned off the rain and it fixed it") - THE SWEEP TAKES AS MANY FRAMES AS THE SKY COSTS, PINNED. On a
// software GPU the whole of rain's drop was the volumetric clouds' march (clouds off, rain costs a clear day), a
// covered sky's texel about twice a fair one's and each weather cell about a sixth more; the map was re-marched
// every eight frames whatever it held. Now a sweep takes the sky's cost in frames - 8 fair, 16 covered, 32
// covered under storm cells - latched at each sweep's start, so a frame's share of the march stays near a fair
// sky's in every weather and the map is the same map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VolumetricClouds, QUALITY, SWEEP_FRAMES, SWEEP_FRAMES_MAX, CELL_SWEEP_COST, sweepCost, sweepFramesFor,
  MARCH_UNIFORMS, SHADOW_UNIFORMS, parseCloudCellDoor,
} from '../src/render/volumetricClouds.js';
import { WEATHER_SKY, skyState } from '../src/render/enhancedSky.js';

const cover = (w) => WEATHER_SKY[w].cover;

test('RAIN-FPS: a sky\'s sweep - a fair sky\'s eight frames, a covered sky\'s sixteen, a covered sky under storm cells thirty-two; never past the longest; every pace divides every tier\'s maps (mutants: the cost, the rounding, the cap)', () => {
  assert.equal(SWEEP_FRAMES, 8);
  assert.equal(SWEEP_FRAMES_MAX, 32);
  assert.equal(CELL_SWEEP_COST, 0.15);
  assert.equal(sweepCost(cover('sunny'), 0), 1, 'a fair sky is the unit');
  assert.equal(sweepCost(cover('cloudy'), 0), 2, 'cloudy\'s cover doubles it');
  assert.ok(Math.abs(sweepCost(cover('rain'), 8) - 2 * (1 + 8 * CELL_SWEEP_COST)) < 1e-12, 'each cell a share more');
  assert.equal(sweepFramesFor(cover('sunny'), 0), 8);
  for (const w of ['cloudy', 'overcast', 'fog', 'rain', 'snow', 'thunder', 'sandstorm']) assert.equal(sweepFramesFor(cover(w), 0), 16, w);
  assert.equal(sweepFramesFor(cover('sunny'), 2), 8, 'two cells over a fair sky: still eight');
  assert.equal(sweepFramesFor(cover('sunny'), 3), 16, 'three: sixteen');
  assert.equal(sweepFramesFor(cover('rain'), 3), 32, 'a rain sky under three cells: thirty-two');
  assert.equal(sweepFramesFor(cover('rain'), 8), 32);
  assert.equal(sweepFramesFor(1, 1000), SWEEP_FRAMES_MAX, 'never past the longest');
  assert.equal(sweepFramesFor(undefined, undefined), 8, 'nothing known is a fair sky');
  assert.equal(sweepFramesFor(NaN, -3), 8);
  assert.equal(sweepFramesFor(cover('rain'), -3), 16, 'a negative count is no cells, not a cheaper sky');
  for (const q of Object.values(QUALITY)) {
    for (const f of [8, 16, 32]) { assert.equal(q.height % f, 0, `${q.width}: the sky map`); assert.equal(q.shadow % f, 0, `${q.shadow}: the shadow map`); }
  }
});

/** A VolumetricClouds driven through update() on a recording GL: every viewport the march sets. */
function rig(weather, cells = null) {
  const c = Object.create(VolumetricClouds.prototype);
  Object.assign(c, { q: QUALITY.default, cam: [0, 0], shift: [0, 0], profile: null, weather: null, state: null, row: null, cells: [], noise: { shape: { tex: 1 }, detail: { tex: 2 } } });
  const views = [];
  c.gl = new Proxy({}, {
    get: (_, k) => (k === 'viewport' ? (...v) => views.push(v)
      : typeof k === 'string' && k.toUpperCase() === k ? 1 : () => {}),
  });
  const set = (w, cs = null) => c.setState(skyState({ minuteOfDay: 720, weather: w, classicMinutes: 720 }), WEATHER_SKY[w], w, 1e9, [0, 0], 0, [0, 0, 0], cs);
  set(weather, cells);
  Object.assign(c, { mu: Object.fromEntries(MARCH_UNIFORMS.map((n) => [n, n])), su: Object.fromEntries(SHADOW_UNIFORMS.map((n) => [n, n])), map: {}, shadowMap: {}, stripe: 0, shadowStripe: 0, sweeps: 0, shadowFull: false, pace: SWEEP_FRAMES, shadowPace: SWEEP_FRAMES, origin: [0, 0] });
  const q = c.q;
  const step = () => { views.length = 0; c.update([0, 0, 320, 200]); return { sky: views.find((v) => v[2] === q.width), shadow: views.find((v) => v[2] === q.shadow) }; };
  return { c, set, step, q };
}
const ring = (n) => Array.from({ length: n }, (_, i) => parseCloudCellDoor('rain,0,4000', [Math.cos((i / n) * 2 * Math.PI) * 9000, 0, Math.sin((i / n) * 2 * Math.PI) * 9000]));

test('RAIN-FPS: the march paces itself - a sunny sweep in eight stripes, a rain sweep in sixteen, a rain sweep under eight cells in thirty-two, each stripe the map\'s share and the shadow map\'s with it (the draw path, on a recording GL)', () => {
  for (const [w, cells, frames] of [['sunny', null, 8], ['rain', null, 16], ['rain', ring(8), 32]]) {
    const { c, step, q } = rig(w, cells);
    for (let i = 0; i < frames; i++) {
      const { sky, shadow } = step();
      assert.deepEqual(sky, [0, i * (q.height / frames), q.width, q.height / frames], `${w} (${cells?.length ?? 0} cells), frame ${i}: the sky's stripe`);
      assert.deepEqual(shadow, [0, i * (q.shadow / frames), q.shadow, q.shadow / frames], `${w}, frame ${i}: the shadow's stripe`);
      assert.equal(c.sweeps, i === frames - 1 ? 1 : 0, `${w}: the sweep ends on its last stripe, not before`);
    }
  }
});

test('RAIN-FPS: a sweep keeps the pace it began with - the rain that comes in mid-sweep paces the NEXT sweep, so no stripe of the map is skipped or marched twice (the draw path)', () => {
  const { c, set, step, q } = rig('sunny');
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push(step().sky[1]);
  set('rain');
  c.pendingShift = null;   // the shadow square's own re-centring is not this pin's subject
  for (let i = 3; i < 8; i++) seen.push(step().sky[1]);
  assert.deepEqual(seen, [0, 32, 64, 96, 128, 160, 192, 224], 'the sunny sweep runs out at its own pace');
  assert.equal(c.sweeps, 1);
  const next = [];
  for (let i = 0; i < 16; i++) next.push(step().sky);
  assert.deepEqual(next.map((v) => v[1]), Array.from({ length: 16 }, (_, i) => i * 16), 'the next sweep is the rain\'s');
  assert.ok(next.every((v) => v[3] === q.height / 16));
  assert.equal(c.sweeps, 2);
  // the shadow map keeps its OWN sweep's pace: out of step with the sky's (a crossing's whole re-march resets it
  // alone), the rain the sky takes up at its sweep's start leaves the shadow's half-done sweep at eight
  const r = rig('sunny');
  r.c.shadowStripe = 4;
  r.set('rain');
  r.c.pendingShift = null;
  const first = r.step();
  assert.equal(first.sky[3], q.height / 16, 'the sky\'s new sweep is the rain\'s');
  assert.deepEqual(first.shadow, [0, 4 * (q.shadow / 8), q.shadow, q.shadow / 8], 'the shadow\'s sweep runs out at eight');
  for (let i = 5; i < 8; i++) assert.equal(r.step().shadow[3], q.shadow / 8);
  assert.deepEqual(r.step().shadow, [0, 0, q.shadow, q.shadow / 16], 'and its next is the rain\'s');
});
