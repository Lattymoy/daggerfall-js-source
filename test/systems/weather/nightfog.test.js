// NIGHT-FOG (2026-10-26; bible/07-Rendering/Weather-Arc.md NIGHT-FOG; the owner: "In foggy biomes, when its dark, you can
// barely see anything"): THE FOG IS LIT BY THE LIGHT THE LAND IS LIT BY. On the enhanced lane the frame's fog colour is
// never darker than air of NIGHT_AIR.albedo lit by the open air's light - the exterior ambient and the moons - and what
// a fog lacks of that air's luminance is made up in the air's own colour (systems/weather/nightFog.js). Under Dynamic
// Skies (the lane's default sky) every fog closed to black from dusk to dawn; under the port's dome a clear night's fog
// was the night sky's 0.04-0.09. Pinned here: the air's numbers and its light, its colour, the lift (and the identity it
// keeps where nothing lacks), the day left where it was in every weather on both skies and both light curves, the night
// and the dusk, and the controller that hands every host its answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NIGHT_AIR, airLight, airColor, litFog, nightFogOn } from '../../../src/systems/weather/nightFog.js';
import { exteriorAmbient, setLightCurve, daylightScale } from '../../../src/world/worldClock.js';
import { FOG_SETTINGS, fogForWeather, weatherSunlightScale } from '../../../src/world/weather.js';
import { skyState } from '../../../src/render/enhancedSky.js';
import { DYNAMIC_LIGHT_CURVE, skyFrame, weatherRow } from '../../../src/systems/dynamicSkies/dynamicSkies.js';
import { createSkyController, outdoorFogColor } from '../../../src/scenes/shared.js';
import { getFloat, setValue } from '../../../src/systems/settings/settings.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const nearAll = (a, b, e = 1e-6) => a.length === b.length && [...a].every((v, i) => near(v, b[i], e));
const WEATHERS = ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow'];
// PIN MOVED (OWN-WORK4, 2026-10-31): Dynamic Skies is our own sky now - its fog colour is its horizon (skyFrame), its
// light curve its own rule. The mod's black night these pins were written against is history.
const MOD_CURVE = DYNAMIC_LIGHT_CURVE;
/** Dynamic Skies' fog colour at a minute: the sky's horizon, as the instance publishes it */
const modFog = (w, m) => skyFrame({ minuteOfDay: m, row: weatherRow(w), lightCurve: MOD_CURVE }).fogColor;
/** the port's dome's: SetSkyFogColor over the dome's horizon */
const domeFog = (w, m) => outdoorFogColor(fogForWeather(w), skyState({ minuteOfDay: m, weather: w }).clearColor);
/** the air at a minute in a weather, no moon */
const airAt = (w, m, nightScale = 1, moon = null) => airColor(airLight({ minute: m, nightScale, sun: weatherSunlightScale(w, false), moon }));
/** each light curve the world can run: the rig's (the dome) and Dynamic Skies' own (its rule, OWN-WORK4) */
const underCurve = (keys, fn) => { setLightCurve(keys); try { fn(); } finally { setLightCurve(null); } };

test('NIGHT-FOG THE AIR\'S NUMBERS: half the light that reaches it, half of Masser\'s key, leaned cool (mutants: each number moved)', () => {
  assert.deepEqual({ ...NIGHT_AIR, tint: [...NIGHT_AIR.tint] }, { albedo: 0.5, moon: 0.5, tint: [0.86, 0.95, 1.14] });
  assert.ok(Object.isFrozen(NIGHT_AIR) && Object.isFrozen(NIGHT_AIR.tint));
});

test('NIGHT-FOG THE OPEN AIR\'S LIGHT is the exterior ambient - the hour, the Night Brightness, the weather\'s scale - with Secunda\'s lift and half of Masser\'s key (mutants: the lift dropped; the key whole; the key\'s colour dropped; the ambient\'s scale dropped)', () => {
  assert.ok(nearAll(airLight({ minute: 0 }), [0.25, 0.25, 0.25]), 'ExteriorNightAmbientLight at midnight');
  assert.ok(nearAll(airLight({ minute: 0, nightScale: 0 }), [0, 0, 0]), 'the player\'s Night Brightness at none: no light');
  for (const m of [420, 720, 1000]) for (const sun of [1, 0.45]) assert.ok(nearAll(airLight({ minute: m, nightScale: 0.6, sun }), exteriorAmbient(m, 0.6, sun)), `the ambient whole at ${m}, sun ${sun}`);
  const moon = { scale: 0.2, color: [1, 0.5, 0.25], ambient: [0.01, 0.02, 0.03] };
  assert.ok(nearAll(airLight({ minute: 0, moon }), [0.25 + 0.01 + 0.1, 0.25 + 0.02 + 0.05, 0.25 + 0.03 + 0.025]), 'Secunda\'s lift and half of Masser\'s key');
  const out = new Float32Array(3);
  assert.equal(airLight({ minute: 0 }, out), out, 'into the array handed');
});

test('NIGHT-FOG THE AIR\'S COLOUR: the albedo of the light, leaned by the tint at its own luminance, never past white (mutants: the albedo dropped; the tint unnormalised; the tint dropped; the clamp gone)', () => {
  const t = NIGHT_AIR.tint, tl = lum(t);
  const a = airColor([0.25, 0.25, 0.25]);
  assert.ok(nearAll(a, [0.125 * t[0] / tl, 0.125 * t[1] / tl, 0.125 * t[2] / tl]));
  assert.ok(near(lum(a), 0.125), 'its luminance the albedo of the light\'s');
  assert.ok(a[2] > a[1] && a[1] > a[0], 'cool: blue over green over red');
  assert.deepEqual([...airColor([4, 4, 4])], [1, 1, 1], 'never past white');
});

test('NIGHT-FOG THE FOG, LIT: a black fog becomes the air, a fog as bright is ITSELF, and what a dim one lacks is made up in the air\'s colour with its own hue kept (mutants: the identity\'s edge moved; the lack unmeasured; the lift in the fog\'s colour; the floor clamp; the ceiling clamp)', () => {
  const air = airColor([0.25, 0.25, 0.25]);
  assert.ok(nearAll(litFog([0, 0, 0], air), air), 'black: the air');
  const bright = [0.5, 0.5, 0.5], same = [lum(air), lum(air), lum(air)];
  assert.equal(litFog(bright, air), bright, 'brighter: the fog itself, the same array');
  assert.equal(litFog(same, air), same, 'as bright, to the bit: the fog itself');
  const dim = [0.1, 0.05, 0.02], lit = litFog(dim, [0.2, 0.2, 0.2]);
  assert.ok(near(lum(lit), 0.2, 1e-6), 'its luminance the air\'s');
  const k = (0.2 - lum(dim)) / 0.2;
  assert.ok(nearAll(lit, [0.1 + 0.2 * k, 0.05 + 0.2 * k, 0.02 + 0.2 * k]), 'the lack, in the air\'s colour, over the fog\'s');
  assert.ok(lit[0] > lit[1] && lit[1] > lit[2], 'the fog\'s own hue kept');
  assert.deepEqual([...litFog([1, 0, 0], [0.9, 0.9, 0.9])].map((v) => +v.toFixed(4)), [1, +(0.9 * (0.9 - 0.299) / 0.9).toFixed(4), +(0.9 * (0.9 - 0.299) / 0.9).toFixed(4)], 'never past white');
  assert.deepEqual([...litFog([-0.5, 0, 0], [0.01, 0.01, 0.01])].map((v) => Math.max(0, v)), [...litFog([-0.5, 0, 0], [0.01, 0.01, 0.01])], 'never under black');
  const out = new Float32Array(3);
  assert.equal(litFog([0, 0, 0], air, out), out, 'into the array handed');
});

test('NIGHT-FOG THE DAY IS WHERE IT WAS: from 10:00 to 14:00 every weather\'s fog, on Dynamic Skies (its own light curve) and on the dome (the rig\'s), winter or not, comes back ITSELF - the storm\'s at noon over its air (mutants: the albedo raised to 0.55; the identity\'s edge moved)', () => {
  for (const [name, keys, fogOf] of [['Dynamic Skies', MOD_CURVE, modFog], ['the dome', null, domeFog]]) {
    underCurve(keys, () => {
      for (const w of WEATHERS) for (const winter of [false, true]) for (let m = 600; m <= 840; m += 20) {
        const fog = fogOf(w, m);
        const air = airColor(airLight({ minute: m, sun: weatherSunlightScale(w, winter) }));
        assert.equal(litFog(fog, air), fog, `${name}, ${w}${winter ? ' in winter' : ''} at ${m / 60}h: the fog itself (${[...fog].map((v) => v.toFixed(3))} against air ${lum(air).toFixed(3)})`);
      }
    });
  }
  underCurve(MOD_CURVE, () => {
    const thunder = modFog('thunder', 720), air = airAt('thunder', 720);
    assert.ok(lum(air) < lum(thunder), `the storm's fog at noon (${lum(thunder).toFixed(4)}) over its air (${lum(air).toFixed(4)})`);
  });
});

test('NIGHT-FOG THE NIGHT IS LIT AIR: Dynamic Skies\' dark night horizon is lifted to the air in every weather, the moons brighten it, the dome\'s night-blue horizon is lifted with its blue kept, the dome\'s rain and DFU\'s grey are left, and a player\'s Night Brightness at none keeps the night black (mutants: the albedo dropped; the moon unread; the lift from the fog\'s colour)', () => {
  underCurve(MOD_CURVE, () => {
    for (const w of WEATHERS) for (const m of [1260, 1380, 0, 240]) {
      const fog = modFog(w, m), lit = litFog(fog, airAt(w, m));
      assert.ok(near(lum(lit), Math.max(lum(fog), 0.125), 1e-6), `${w} at ${m / 60}h: never darker than the air (${lum(fog).toFixed(3)} to ${lum(lit).toFixed(3)})`);
    }
    for (const m of [1380, 0]) assert.ok(lum(modFog('sunny', m)) < 0.1, `a clear night's horizon is darker than the air at ${m / 60}h, so it is lifted`);
    const masser = { scale: 0.25, color: [0.827, 0.604, 0.525], ambient: [0.004, 0.004, 0.004] };
    assert.ok(lum(litFog([0, 0, 0], airAt('fog', 1380, 1, masser))) > 0.15, 'a full Masser lights the fog brighter');
    assert.deepEqual([...litFog([0, 0, 0], airAt('fog', 1380, 0))], [0, 0, 0], 'Night Brightness at none: the player\'s dark night');
  });
  const clear = domeFog('sunny', 1380), lifted = litFog(clear, airAt('sunny', 1380));
  assert.ok(lum(clear) < 0.07 && near(lum(lifted), 0.125), `the dome's clear midnight (${lum(clear).toFixed(3)}) lifted to the air`);
  assert.ok(lifted[2] > lifted[1] && lifted[1] > lifted[0] && lifted[2] - lifted[0] > airAt('sunny', 1380)[2] - airAt('sunny', 1380)[0], 'its night blue kept over the air\'s lean');
  for (const w of ['overcast', 'rain', 'thunder', 'fog', 'snow']) {
    const fog = domeFog(w, 1380);
    assert.equal(litFog(fog, airAt(w, 1380)), fog, `the dome's ${w} at night (${lum(fog).toFixed(3)}) already as bright as the air: itself`);
  }
});

test('NIGHT-FOG DUSK AND DAWN ARE SMOOTH: on both skies, minute by minute through both twilights in every weather, the fog is never darker than the air and the air adds less than 0.02 a minute to the sky\'s own step (mutants: the lift halved; the air\'s light a step at dusk)', () => {
  for (const [name, keys, fogOf] of [['Dynamic Skies', MOD_CURVE, modFog], ['the dome', null, domeFog]]) {
    underCurve(keys, () => {
      for (const w of WEATHERS) for (const [from, to] of [[240, 540], [900, 1200]]) {
        let prev = null, prevFog = null;
        for (let m = from; m <= to; m++) {
          const fog = fogOf(w, m), air = airAt(w, m), lit = litFog(fog, air);
          assert.ok(lum(lit) >= lum(air) - 1e-6, `${name}, ${w} at ${m}: never darker than the air`);
          if (prev) {   // the step the air adds over the sky's own (the dome's dawn and dusk horizon walks fast of itself)
            const own = Math.max(...[0, 1, 2].map((c) => Math.abs(fog[c] - prevFog[c])));
            for (let c = 0; c < 3; c++) assert.ok(Math.abs(lit[c] - prev[c]) < own + 0.02, `${name}, ${w} at ${m}: a step of ${(lit[c] - prev[c]).toFixed(3)} over the sky's ${own.toFixed(3)}`);
          }
          prev = [...lit]; prevFog = [...fog];
        }
      }
    });
  }
});

test('NIGHT-FOG THE CONTROLLER hands every host the lit fog on the enhanced lane - the hour and the sun its use() was handed, the player\'s Night Brightness, the moons - the sky\'s own colour where nothing lacks, and DFU\'s verbatim on the classic panorama and behind ?nightfog=off; indoors takes none of it (mutants: the lane unread; the door unread; the hour unkept; the moon unread; the Night Brightness unread)', () => {
  const stubGl = new Proxy({}, { get: (_t, k) => (k === 'getShaderParameter' || k === 'getProgramParameter' ? () => true : k === 'drawingBufferWidth' || k === 'drawingBufferHeight' ? 64 : () => ({})) });
  const at = (q, m, w = 'sunny') => {
    const ctl = createSkyController(stubGl, new URLSearchParams(`clouds=off&${q}`));
    ctl.use(16, m, true, { weather: w, classicMinutes: 400000 + m, skyMinutes: 400000 + m, sun: weatherSunlightScale(w, false), pos: [0, 0, 0] });
    return { ctl, fog: ctl.fogColorFor(fogForWeather(w)) };
  };
  setValue('Enhancements', 'NightAmbientLightScale', 0.8);   // the player's Night Brightness, off its default
  try {
    for (const m of [1380, 60, 1150]) {
      const { ctl, fog } = at('sky=enhanced', m);
      const want = litFog(ctl.renderer.clearColor, airColor(airLight({ minute: m, nightScale: 0.8, sun: 1, moon: ctl.moonlight() })));
      assert.ok(ctl.enhanced && nearAll(fog, want), `the dome at ${m}: the lit air (${[...fog].map((v) => v.toFixed(3))})`);
      assert.ok(fog !== ctl.renderer.clearColor && lum(fog) > lum(ctl.renderer.clearColor) + 0.03, 'lifted off the night sky');
    }
    assert.ok(at('sky=enhanced', 1380).ctl.moonlight(), 'a moon up at 23:00 here, so its light is read');
  } finally { setValue('Enhancements', 'NightAmbientLightScale', 1); }
  assert.equal(getFloat('Enhancements', 'NightAmbientLightScale', 0, 1), 1);
  const noon = at('sky=enhanced', 720);
  assert.equal(noon.fog, noon.ctl.renderer.clearColor, 'noon: the sky\'s own horizon, the same array');
  // the hour and the sun the use() was handed are the air's: a black sky at a thundery noon is the noon's air, not the night's
  for (const [m, w] of [[720, 'thunder'], [720, 'sunny'], [1000, 'rain']]) {
    const { ctl } = at('sky=enhanced', m, w);
    ctl.renderer.clearColor = Float32Array.of(0, 0, 0);
    assert.ok(nearAll(ctl.fogColorFor(FOG_SETTINGS.sunny), airAt(w, m)), `${w} at ${m / 60}h: a black sky\'s fog is that hour\'s air under that sun`);
  }
  const page = globalThis.location;
  globalThis.location = /** @type {any} */ ({ search: '?world&nightfog=off' });
  try {
    const off = at('sky=enhanced', 1380);
    assert.ok(!nightFogOn() && nightFogOn('?nightfog=on') && nightFogOn(''), 'the door, off the page\'s query');
    assert.equal(off.fog, off.ctl.renderer.clearColor, '?nightfog=off: the night sky\'s horizon, verbatim');
    globalThis.location = /** @type {any} */ ({ search: '?world' });
    assert.ok(nightFogOn() && lum(off.ctl.fogColorFor(fogForWeather('sunny'))) > lum(off.fog) + 0.03, 'read at every ask: the door opened under a standing controller lifts its next answer');
  } finally { globalThis.location = page; }
  const classic = at('sky=classic', 1380);
  classic.ctl.renderer.clearColor = Float32Array.of(0.02, 0.03, 0.05);   // a night panorama's horizon (NITE??I0's west, as dark as DFU paints it)
  assert.equal(classic.ctl.fogColorFor(FOG_SETTINGS.sunny), classic.ctl.renderer.clearColor, 'the classic panorama: SetSkyFogColor verbatim, however dark');
  assert.deepEqual([...at('sky=enhanced', 1380, 'fog').fog], [0.5, 0.5, 0.5], 'DFU\'s grey at midnight, brighter than the air: left');
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /const nightFogLane = Boolean\(enhancedSky \|\| dynamic\);/);
  assert.match(shared, /const litAir = \(fog\) => \(nightFogLane && nightFogOn\(\)/);
  assert.match(shared, /nightScale: getFloat\('Enhancements', 'NightAmbientLightScale', 0, 1\), sun: airAt\.sun, moon: moonNow\(\)/);
  assert.match(shared, /airAt\.minute = minuteOfDay; airAt\.sun = extra\?\.sun \?\? 1;/);
  // indoors: DFU's SetFog interior and dungeon branches set their own black fog, never through the sky's colour
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/interior.js', 'src/scenes/dungeon.js']) assert.doesNotMatch(rd(host), /fogColorFor/, `${host} takes no outdoor fog colour`);
});
