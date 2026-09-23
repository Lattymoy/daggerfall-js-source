// DSH1 (2026-09-20, Mac: "The far away horizon is still viewable even
// though it's cloudy"). Under Dynamic Skies a full overcast lid ended in
// a hard red sunset line at the horizon, and no weather in the game could
// touch it. Two causes, one symptom:
//
//   1. THE COLOUR THE DECK FADES INTO. The march's aerial perspective
//      closes every far bank on `uHorizonColor`, and the bridge handed it
//      the mod's RenderSettings.fogColor unchanged. That colour at dusk
//      is a saturated red; the mod's own dome shows it only in the
//      half-degree strip where Unity's procedural skybox lerps sky to
//      ground, while the deck was painting it across the whole far ring.
//      The port's own dome has never had this - `skyState` greys its
//      horizon by the weather's `grey` before anything reads it - so the
//      mod's colour takes the same greying now, toward the deck's OWN
//      shade, because the far end of an overcast lid is its near end seen
//      through air. Sunny is grey 0 and comes through untouched.
//
//   2. THE LAST HALF-DEGREE. The composite discarded at the horizon
//      exactly and the march answered its own near early-out with "no
//      cloud, nothing absorbed", so that strip of the dome came through
//      the lid whatever the weather. The lid carries the map's bottom row
//      over a SKIRT below the horizon instead, and the near early-out
//      answers the same aerial-fade colour the far one does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloudsStateUnderMod, modHorizon } from '../src/render/dynamicSkiesBridge.js';
import { COMPOSITE_FS, MARCH_FS, HORIZON_SKIRT } from '../src/render/volumetricClouds.js';
import { WEATHER_SKY, skyState } from '../src/render/enhancedSky.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MOD_DUSK = [0.55, 0.12, 0.14];   // the shape of the colour this arc is about: red, and nothing like a lid
const SHADE = [0.37, 0.41, 0.45];

test('DSH1: the mod’s horizon is greyed by the weather, toward the deck’s own shade', () => {
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, { grey: 0 }), MOD_DUSK, 'a clear sky changes nothing - the mod’s own colour, 1:1');
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, WEATHER_SKY.sunny), MOD_DUSK, 'and sunny IS grey 0');
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, { grey: 1 }), SHADE, 'a lid that grey is the lid’s own colour');
  // the thing the arc exists for: at an overcast greyness the red is
  // mostly gone, and the green and blue have come UP toward the lid.
  const over = modHorizon(MOD_DUSK, SHADE, WEATHER_SKY.overcast);
  assert.ok(WEATHER_SKY.overcast.grey > 0.5, 'the row this leans on is a grey one');
  assert.ok(over[0] < MOD_DUSK[0] && over[1] > MOD_DUSK[1] && over[2] > MOD_DUSK[2], 'red down, green and blue up');
  assert.ok(Math.abs(over[0] - over[1]) < Math.abs(MOD_DUSK[0] - MOD_DUSK[1]), 'and the colour is nearer neutral than it was');
  for (let i = 0; i < 3; i++) {
    const g = WEATHER_SKY.overcast.grey;
    assert.ok(Math.abs(over[i] - (MOD_DUSK[i] + (SHADE[i] - MOD_DUSK[i]) * g)) < 1e-12, 'the mix is the row’s greyness exactly');
  }
  // monotone in the greyness, so an easing row walks the colour rather
  // than jumping it when the weather turns.
  let prev = MOD_DUSK[0];
  for (const g of [0.1, 0.2, 0.4, 0.8, 1]) {
    const r = modHorizon(MOD_DUSK, SHADE, { grey: g })[0];
    assert.ok(r < prev, 'the red falls with every step of greyness');
    prev = r;
  }
});

test('DSH1: modHorizon is total - a missing shade, a missing row, a greyness off the end', () => {
  assert.deepEqual(modHorizon(MOD_DUSK, null, { grey: 1 }), MOD_DUSK, 'no shade to fade into: the mod’s colour stands');
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, null), MOD_DUSK, 'no row: nothing to grey by');
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, {}), MOD_DUSK, 'a row without a greyness reads 0, never NaN');
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, { grey: 4 }), SHADE, 'clamped above - never past the shade');
  assert.deepEqual(modHorizon(MOD_DUSK, SHADE, { grey: -2 }), MOD_DUSK, 'clamped below - never away from it');
  for (const v of modHorizon(MOD_DUSK, SHADE, { grey: 0.5 })) assert.ok(Number.isFinite(v));
});

test('DSH1: the bridge hands the greyed colour, and the row wins over the weather’s name', () => {
  const st = { sunDir: [0.3, 0.6, 0], clearColor: MOD_DUSK };
  const at = (o) => cloudsStateUnderMod(st, null, { minuteOfDay: 17 * 60, weather: 'overcast', ...o });
  const base = skyState({ minuteOfDay: 17 * 60, weather: 'overcast' });
  assert.deepEqual(at({}).horizon, modHorizon(MOD_DUSK, base.cloudShade, WEATHER_SKY.overcast), 'the weather’s own row');
  // the controller walks an EASED row between weathers and hands it in;
  // that row is the one the colour must follow, not the name beside it.
  const eased = { ...WEATHER_SKY.overcast, grey: 0 };
  assert.deepEqual(at({ row: eased }).horizon, MOD_DUSK, 'mid-ease at grey 0 the mod’s colour is back, whatever the name says');
  assert.notDeepEqual(at({}).horizon, at({ row: eased }).horizon, 'so the two answers differ - the row is read, not the name');
});

test('DSH1: the lid clears the horizon by a skirt, and the near early-out is the fade’s colour', () => {
  assert.ok(HORIZON_SKIRT > 0.01, 'the skirt clears Unity’s SKY_GROUND_THRESHOLD (0.01), the strip this arc is about');
  assert.ok(HORIZON_SKIRT < 0.03, 'and stays under two degrees, so a clear sky’s ground half is unchanged to the eye');
  assert.match(COMPOSITE_FS, new RegExp(`if \\(el <= -${HORIZON_SKIRT}\\) discard;`), 'the discard is BELOW the horizon by the skirt, never at it');
  assert.doesNotMatch(COMPOSITE_FS, /if \(el <= 0\.0\) discard;/, 'and never at the horizon exactly again');
  assert.match(COMPOSITE_FS, /max\(el, 0\.0\) \/ \(0\.5 \* PI\)/, 'over the skirt the map’s bottom row is held, not sampled off the end');
  // the march's two early-outs agree: both answer the aerial fade's
  // colour, so the lid has no seam where one takes over from the other.
  assert.match(MARCH_FS, /if \(dir\.y <= 0\.004\) \{ outColor = underCurtains\(uHorizonColor, 0\.0, cam, dir\); return; \}/, 'the near early-out: the fade’s colour, fully covering (VC7c: with the rain curtains in front of it)');
  assert.match(MARCH_FS, /if \(t0 > 120000\.0\) \{ outColor = underCurtains\(uHorizonColor, 0\.0, cam, dir\); return; \}/, 'the far one, unchanged, and the same answer');
  assert.doesNotMatch(MARCH_FS, /outColor = vec4\(0\.0, 0\.0, 0\.0, 1\.0\); return;/, 'no row answers "clear sky" at the horizon any more');
});

test('DSH1: the bridge is the one home - the controller and the lab both read it, neither greys by hand', () => {
  const bridge = read('src/render/dynamicSkiesBridge.js');
  assert.match(bridge, /horizon: modHorizon\(st\.clearColor \?\? base\.horizon, base\.cloudShade, row \?\? WEATHER_SKY\[weather\] \?\? WEATHER_SKY\.sunny\)/, 'greyed where the state is built, once');
  for (const p of ['src/scenes/shared.js', 'src/tools/skyLab.js', 'src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.doesNotMatch(read(p), /modHorizon/, `${p} takes the state, never the greying`);
  }
});
