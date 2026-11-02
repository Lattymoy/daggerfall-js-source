// FIELD BUGS 2026-10-21b SNOW-YEAR (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md, BLACK-SCREEN): "Crashing every minute -
// No message just black", "when I enter dungeons or traveling overworld". The snow year's origin (snowpack.js
// yearOriginOf) floored a midsummer that carried a fractional minute's float error, so two minutes of one year could
// name origins a step apart; a pixel build waiting on the snow (snowCoverHost.js settle) held the minute it began at, and
// the frame's tick integrating the same window to the clock's minute reset its lattice points every pass - the build
// never finished, and the world built no pixel again that session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yearOriginOf, MIDSUMMER_MINUTE, SNOWPACK } from '../../../src/systems/weather/snowpack.js';
import { setAirGround } from '../../../src/systems/weather/airTemperature.js';
import { createSnowCoverHost } from '../../../src/scenes/snowCoverHost.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';

const Y = 360 * 1440;
const woods = () => CLIMATES.Woodlands;

test('SNOW-YEAR one snow year, one origin - at any fractional minute of it (it named two, a step apart, for 2.7% of them)', () => {
  // the running game's two minutes, a game half hour apart in one snow year
  assert.equal(yearOriginOf(523533.75644000125), yearOriginOf(523562.9080200079));
  assert.equal(yearOriginOf(523533.75644000125), 288000);
  let s = 11;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  for (const year of [1, 405, 406]) {
    const mid = year * Y + MIDSUMMER_MINUTE, origin = yearOriginOf(mid + 1);
    for (let k = 0; k < 2000; k++) {
      const t = mid + 0.5 + rnd() * (Y - 1);   // inside the year begun at this midsummer, every minute fractional
      assert.equal(yearOriginOf(t), origin, `year ${year}, minute ${t}`);
    }
    assert.equal(origin % SNOWPACK.stepMinutes, 0, 'on the grid');
  }
});

/** A snow cover host over Woodlands under mountains (snow to lay), the clock's minute `clock.t`, its frame clock running
 *  0.01 ms an ask (a slice of 2 ms is two hundred asks - a year is many slices). */
function coverHost(clock) {
  const state = { compensation: [0, 0, 0], mapOrigin: { x: 200, y: 100 }, current: { x: 200, y: 100 },
    pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 200) * 819.2; out[1] = 0; out[2] = -(py - 100) * 819.2; return out; } };
  let ms = 0;
  return createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: woods, mapHeight: 500, stateOf: () => state, builtOf: () => new Map(),
    heightAt: () => 0, owns: () => true, markReskin: () => {}, now: () => clock.t, place: () => ({ px: 200, py: 100 }), clock: () => (ms += 0.01) });
}

test('SNOW-YEAR a build waiting on the snow across the year\'s turn finishes - the frame\'s tick runs between its passes at the clock\'s minute, and each pass asks that minute too (it held the first pass\'s, another year\'s lattice, and the two reset each other for good)', async () => {
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: () => 900 });
  try {
    const clock = { t: 406 * Y + MIDSUMMER_MINUTE - 30 };   // half an hour before midsummer
    const host = coverHost(clock);
    let passes = 0;
    const breather = {
      left: () => 2,
      breathe: async () => {
        passes++;
        if (passes > 20_000) throw new Error('the build is still waiting on the snow');
        clock.t += 1;   // a game minute a pass - the year turns on the thirty-first
        host.tick({ px: 200, py: 100, dt: 0.016 });
      },
    };
    await host.settle(breather);
    assert.ok(clock.t > 406 * Y + MIDSUMMER_MINUTE, `it waited across the turn (${passes} passes)`);
    assert.notEqual(yearOriginOf(clock.t), yearOriginOf(406 * Y + MIDSUMMER_MINUTE - 30), 'another year by its end');
  } finally { setAirGround(null); }
});
