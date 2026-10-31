// RED-MOUNTAIN-SEEN (FIELD FEEDBACK 2026-10-31, #feature-feedback: "Red Mountain doesn't always render, not sure if bug
// or just issue with how distant terrain works. Or an issue with my setup."). The far views - the far ring, the middle
// ring, the far field and the band's trees past the streamed grid, where alone Red Mountain stands beyond the grid - were
// drawn under a linear fog row alone. Every exp row hides the ground before the grid's edge, so nothing was lost through
// the fog; but under a sky drawn clear (rain, snow, the ash Red Mountain's zone wears half its hours, Dynamic Skies'
// overcast) the land's shape against that sky was lost with it: the volcano went, and came back with the sun. Now such a
// row stands the far views in the fog's own colour (render/farRing.js ringFogOf); a fog over the sky stands none.
// bible/03-World/Red-Mountain.md "Recorded departures and readings".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FarRingRenderer, ringFogOf, RING_HAZE_HOLD, summitFromOf } from '../../src/render/farRing.js';
import { FOG_SETTINGS, fogForWeather, fogFactor } from '../../src/world/weather.js';
import { fogSettingsFromPresets } from '../../src/systems/dynamicSkies/dynamicSkies.js';
import { fallTerms } from '../../src/systems/weather/weatherFront.js';
import { LAND_VIEW_DEFAULT } from '../../src/world/landView.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** Dynamic Skies' five rows as the enhanced sky installs them (its density setting at its default, 1). */
const dsRows = () => {
  const dir = 'vendor/dynamic-skies/FogSettings/';
  const json = Object.fromEntries(readdirSync(new URL(`../../${dir}`, import.meta.url)).map((f) => [f.replace('.json', ''), rd(dir + f)]));
  return fogSettingsFromPresets(json, 1);
};
const WEATHERS = ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow', 'sandstorm', 'ashfall'];

test('RED-MOUNTAIN-SEEN the rows: a linear row its haze as ever; an exp row under a clear sky - rain, snow, ash, and Dynamic Skies\' overcast, rain and snow - the fog\'s own colour; a fog over the sky - the heavy fog, the sandstorm - none (mutants: a fog over the sky stands it; exp2 unread; the weather\'s hold; its ramp open)', () => {
  const clear = ringFogOf({ mode: 'linear', start: 2000, end: 3600 });
  assert.deepEqual({ ...clear }, { start: 2000, end: 3600, hold: RING_HAZE_HOLD, weather: false, law: 0, density: 0 }, 'the draw distance\'s haze, its ramp where the row has it');   // PIN MOVED (AUDIT FB1031 L2): and no weather law
  assert.equal(ringFogOf({ mode: 'linear', end: 2400 }).start, 0);
  const stood = (row) => (ringFogOf(row) ? (ringFogOf(row).weather ? 'fog' : 'haze') : 'none');
  assert.deepEqual(WEATHERS.map((w) => stood(fogForWeather(w))), ['haze', 'haze', 'haze', 'none', 'fog', 'fog', 'fog', 'none', 'fog'], 'the classic rows');
  const ds = dsRows();
  assert.deepEqual(WEATHERS.map((w) => stood(fogForWeather(w, ds))), ['haze', 'haze', 'fog', 'none', 'fog', 'fog', 'fog', 'none', 'fog'], 'Dynamic Skies\' rows (its overcast is weather)');
  assert.equal(fogForWeather('overcast', ds).mode, 'exp2');
  assert.deepEqual({ ...ringFogOf(FOG_SETTINGS.ashfall) }, { start: 0, end: 0, hold: 1, weather: true, law: 1, density: 0.006 }, 'the row\'s own law, the summits too');   // PIN MOVED (AUDIT FB1031 L2): its law and density, not wholly the fog's colour
  assert.equal(ringFogOf(null), null);
  assert.equal(ringFogOf({ mode: 'off' }), null);
});

test('RED-MOUNTAIN-SEEN the reading: at the default Land View every exp row - the classic and Dynamic Skies\' - has hidden the ground by the grid\'s edge, so the fog\'s colour there shows nothing it hides; the lightest rain on screen, a sprinkle\'s, leaves it 5% (mutants: the ash thinned)', () => {
  const edge = LAND_VIEW_DEFAULT * TERRAIN_SIZE;   // 4,096 m: the far views' nearest
  const ds = dsRows();
  for (const [name, row] of [...Object.entries(FOG_SETTINGS).filter(([w]) => w !== 'interior' && w !== 'dungeon'), ...Object.entries(ds).map(([w, r]) => [`Dynamic Skies ${w}`, r])]) {
    if (row.mode === 'linear') continue;
    assert.ok(fogFactor(row, edge) < 1e-4, `${name}: ${fogFactor(row, edge).toExponential(1)} of the ground at ${edge} m`);
  }
  const light = { sun: 0.65, dim: 0.8 };
  const sprinkle = fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.rainy }, 0, 'rain', light).fog;
  assert.ok(fogFactor(sprinkle, edge) > 0.04 && fogFactor(sprinkle, edge) < 0.05, `a sprinkle: ${fogFactor(sprinkle, edge).toFixed(3)} at the edge`);
  const ash = fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.ashfall }, 0, 'ashfall', light).fog;
  assert.ok(fogFactor(ash, edge) < 0.003, `the thinnest ash: ${fogFactor(ash, edge).toFixed(4)} at the edge, ${fogFactor(ash, 20000).toExponential(0)} at 20 km`);
});

/** A ring under the Proxy-GL stub (test/ui/farring.test.js's), its uniforms and draws counted; the fire and the glow
 *  stood in by spies. */
function stubRing() {
  const seen = { u1f: {}, draws: 0, fire: 0, band: null };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name });
      if (k === 'uniform1f') return (loc, v) => { seen.u1f[loc?.name] = v; };
      if (k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader') return () => ({});
      if (k === 'drawElements') return () => { seen.draws++; };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const r = new FarRingRenderer(gl);
  r.build({ heightBytes: new Uint8Array(1000 * 500).fill(30), mapWidth: 1000, mapHeight: 500, climateAt: () => 231, baseX: 207, baseY: 213, radius: 4 }, 207, 213, 2);
  r._coneNow = () => ({ at: { px: 207, py: 213, centre: [0, 0, 0], base: 0 } });
  r._fireNow = () => ({ draw: () => { seen.fire++; } });
  r._fenceNow = () => null;
  r._band = { count: 1, drawn: { baseX: 207, baseY: 213 }, draw: (o) => { seen.band = o; }, dispose: () => {} };
  r._floraRadius = 5;
  r._floraOf = () => () => null;
  r._bandGround = () => null;
  return { r, seen };
}
const frame = (fog) => ({
  origin: [0, 0, 0], lightDir: new Float32Array([0, 1, 0]), ambient: new Float32Array([0.4, 0.4, 0.4]), sunScale: 0.5,
  sunColor: new Float32Array([1, 1, 1]), fogColor: new Float32Array([0.5, 0.45, 0.4]), fog, fovY: 1, aspect: 1.6,
  eye: [0, 10, 0], worldProj: new Float32Array(16).fill(1),
});

test('RED-MOUNTAIN-SEEN the draw: in the ash the ring, the field and the band stand wholly in the fog\'s colour - its ramp closed, its hold whole, no summit through it - and the lava, the plume and the curtain are not drawn; in clear air as before; in the heavy fog nothing (mutants: the hold; the band\'s hold; the summits through the weather; the fire through the weather; no row, no return)', () => {
  const ash = stubRing();
  ash.r.draw(new Float32Array(16), frame(FOG_SETTINGS.ashfall));
  assert.equal(ash.seen.draws, 1, 'the horizon drawn');
  assert.deepEqual([ash.seen.u1f.uFogStart, ash.seen.u1f.uFogEnd, ash.seen.u1f.uHazeHold], [0, 0, 1], 'the ramp closed, the hold whole');
  assert.ok(ash.seen.u1f.uSummitFrom > 1e8, 'no thinner air');
  assert.deepEqual([ash.seen.band.fogStart, ash.seen.band.fogEnd, ash.seen.band.hold], [0, 0, 1], 'the band\'s trees as the ground');
  assert.equal(ash.seen.fire, 0, 'no fire through the ash');
  const sun = stubRing();
  sun.r.draw(new Float32Array(16), frame({ mode: 'linear', start: 0, end: 4000, excludeSky: true }));
  assert.deepEqual([sun.seen.u1f.uFogStart, sun.seen.u1f.uFogEnd, sun.seen.u1f.uHazeHold], [0, 4000, RING_HAZE_HOLD]);
  assert.equal(sun.seen.u1f.uSummitFrom, summitFromOf(5));
  assert.equal(sun.seen.band.hold, RING_HAZE_HOLD);
  assert.equal(sun.seen.fire, 1, 'the volcano\'s fire in clear air');
  const fog = stubRing();
  fog.r.draw(new Float32Array(16), frame(FOG_SETTINGS.heavy));
  assert.equal(fog.seen.draws, 0, 'the heavy fog: nothing');
  // the host hands the row and asks it, in the sky's span (test/ui/farring.test.js EV8's wiring)
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(farRing && ringFogOf\(fogNow\)\) \{/);
  assert.match(w, /fogColor, fog: fogNow, exposure: renderer\.exposure,/);
});
