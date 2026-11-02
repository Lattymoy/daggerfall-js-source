// KETCH-LOOK KL1 (bible/11-Multiplayer/Sky-Ketch-Look.md sections 2, 5 and 14): HER LIGHT BY THE HOUR AND THE ZONE
// (world/ketch/ketchAtmos.js) and her look's shared numbers (world/ketch/ketchLook.js) - the lights pinned equal to their
// homes, the rows whole at their hours and walked between them without a step, the sun by its elevation and never from
// under the horizon, the moons' key by night, the trilight, below decks' warm close air, the cabin. tools/mutants/
// ketch_look_light.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KT_MEANING, KT_LADDER } from '../../../src/world/ketch/ketchLook.js';
import { KT_HOURS, KT_TRI, KT_SUN_LOW, KT_DAY_FULL, ketchHourLight, ketchSunColor, ketchSunAt, ketchHourWeights, ketchLightRecord } from '../../../src/world/ketch/ketchAtmos.js';
import { KT_LIGHT, KT_AIR_FOG, KT_BELOW_FOG } from '../../../src/world/ketch/ketchShip.js';
import { KT_LAMP } from '../../../src/world/ketch/ketchModel.js';
import { SD_LIGHT } from '../../../src/world/superDungeon/sdLook.js';
import { AIR_BRIGHT_THRESHOLD } from '../../../src/render/airPass.js';
import { EXTERIOR_NIGHT_AMBIENT, dayFraction, daylightScale } from '../../../src/world/worldClock.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const same3 = (a, b, e = 1e-9) => a.length >= 3 && [0, 1, 2].every((k) => near(a[k], b[k], e));

test('KETCH-LOOK KL1 THE LIGHTS ARE THEIR HOMES\' OWN: every meaning ketchLook writes is the colour its home already gave it - the lamps\', the lit things\', the Hour\'s red and moment - and the ladder\'s critical peak is where bloom begins (nothing re-pointed)', async () => {
  const { KT_GLOWS } = await import('../../../src/scenes/ketch/ketchDeckHost.js');
  assert.deepEqual([...KT_MEANING.lamp], [...KT_LAMP.color]);
  assert.deepEqual([...KT_MEANING.lampBelow], [...KT_LAMP.below]);
  assert.deepEqual([...KT_MEANING.aether], [...KT_GLOWS.cell.color]);
  assert.deepEqual([...KT_MEANING.aetherTrue], [...KT_GLOWS.resTrue.color]);
  assert.deepEqual([...KT_MEANING.ember], [...KT_GLOWS.resFalse.color]);
  assert.deepEqual([...KT_MEANING.red], [...SD_LIGHT.red]);
  assert.deepEqual([...KT_MEANING.beat], [...SD_LIGHT.moment]);
  assert.equal(KT_LADDER.critical.peak, AIR_BRIGHT_THRESHOLD);
  assert.ok(KT_LADDER.deck.max <= KT_LADDER.signal[0] && KT_LADDER.ambient[1] <= KT_LADDER.signal[0], 'nothing on L1 or L2 reaches a signal');
});

test('KETCH-LOOK KL1 THE ROWS AT THEIR HOURS: noon is the day row whole (her noon light, the sun\'s own colour at its share, the thin haze, the lamps dim); 02:00 the night\'s (no sun, the moons\' key, DFU\'s night floor under her tint, the lamps up); 06:00 dawn\'s and 18:15 dusk\'s at their windows\' peaks (mutants: the day\'s haze at the old 0.0028; the night under the floor)', () => {
  const L = ketchHourLight(720, 'deck');
  assert.ok(same3(L.ambient, KT_LIGHT.noon) && same3(L.sunColor, KT_LIGHT.sun) && near(L.sunScale, KT_LIGHT.sunScale), 'the day row');
  assert.ok(same3(L.fog.color, KT_AIR_FOG.color) && L.fog.density === KT_AIR_FOG.density && KT_AIR_FOG.density === 0.0016, 'the day\'s haze, thinner');
  assert.equal(L.lamps, KT_HOURS.day.lamps);
  assert.deepEqual({ ...L.grade }, { ...KT_HOURS.day.grade });
  assert.equal(L.key.scale, 0, 'no moon by day');
  const N = ketchHourLight(120, 'deck');
  assert.ok(same3(N.ambient, KT_HOURS.night.ambient) && N.sunScale === 0 && N.key.scale === 1 && same3(N.key.color, KT_HOURS.night.key), 'the night row');
  for (let k = 0; k < 3; k++) assert.ok(KT_HOURS.night.ambient[k] >= EXTERIOR_NIGHT_AMBIENT[k], 'never under the world\'s night floor');
  assert.equal(N.lamps, KT_HOURS.night.lamps);
  const D = ketchHourLight(360, 'deck'), K = ketchHourLight(18.25 * 60, 'deck');
  assert.ok(same3(D.ambient, KT_HOURS.dawn.ambient) && same3(D.fog.color, KT_HOURS.dawn.fog), 'dawn at its peak');
  assert.ok(same3(K.ambient, KT_HOURS.dusk.ambient) && same3(K.fog.color, KT_HOURS.dusk.fog) && near(K.fog.density, KT_HOURS.dusk.density), 'dusk at its peak');
  for (const n of ['dawn', 'day', 'dusk', 'night']) assert.ok(KT_HOURS[n].lamps > 0 && KT_HOURS[n].grade.adaptMax >= 1.5, n);
  for (const n of ['dawn', 'dusk', 'night']) assert.ok(KT_HOURS[n].lamps > KT_HOURS.day.lamps * 2, `the lamps brighter as the light goes (${n})`);
});

test('KETCH-LOOK KL1 NO HOUR STEPS: walked a minute at a time round the clock her light never jumps - the ambient, the haze, the sun\'s colour and share, the lamps and the grade each move under a twentieth a minute; the day row whole from 07:00 to 17:00, the morning never a grey between night and day (mutants: the twilight windows a step; the day walked by the daylight alone)', () => {
  let worst = 0, at = 0, a = ketchHourLight(0, 'deck', ketchLightRecord());
  for (let m = 1; m <= 1440; m++) {
    const b = ketchHourLight(m, 'deck', ketchLightRecord());
    const d = Math.max(
      ...[0, 1, 2].map((k) => Math.abs(a.ambient[k] - b.ambient[k])), ...[0, 1, 2].map((k) => Math.abs(a.fog.color[k] - b.fog.color[k])),
      ...[0, 1, 2].map((k) => Math.abs(a.sunColor[k] * a.sunScale - b.sunColor[k] * b.sunScale)), Math.abs(a.lamps - b.lamps) / 2,
      Math.abs(a.grade.adaptMax - b.grade.adaptMax) / 2, Math.abs(a.key.scale - b.key.scale) / 4,
    );
    if (d > worst) { worst = d; at = m; }
    a = b;
  }
  assert.ok(worst < 0.05, `the worst step ${worst.toFixed(4)} at minute ${at}`);
  for (const h of [7, 9, 12, 15, 17]) assert.ok(same3(ketchHourLight(h * 60, 'deck').ambient, KT_LIGHT.noon), `whole day at ${h}:00`);
  assert.equal(ketchHourWeights(7 * 60).day, 1, 'the day row whole when the dawn window closes');
  assert.ok(daylightScale(7 * 60) / daylightScale(720) >= KT_DAY_FULL, 'its share of the noon then');
});

test('KETCH-LOOK KL1 THE SUN BY ITS ELEVATION, NEVER FROM UNDER THE HORIZON: the day\'s colour above 12 degrees, a gold at 3, a red at the horizon; its share nothing while the clock\'s sun is down, coming up over its first degrees (mutants: the sun lit at 05:30; the low sun the day\'s colour)', () => {
  assert.ok(same3(ketchSunColor(30), KT_HOURS.day.sun) && same3(ketchSunColor(KT_SUN_LOW.high), KT_HOURS.day.sun));
  assert.ok(same3(ketchSunColor(KT_SUN_LOW.low), KT_SUN_LOW.gold) && same3(ketchSunColor(0), KT_SUN_LOW.red));
  for (let e = 0; e < 12; e += 0.5) assert.ok(ketchSunColor(e)[2] <= ketchSunColor(e + 0.5)[2] + 1e-12, 'bluer as it climbs');
  for (let m = 0; m < 1440; m += 5) {
    const t = dayFraction(m), L = ketchHourLight(m, 'deck');
    if (t <= 0 || t >= 1) assert.equal(L.sunScale, 0, `no sun at minute ${m}`);
    const dir = [0, 0, 0], e = ketchSunAt(m, dir);
    assert.ok(near(Math.hypot(...dir), 1, 1e-9) && e >= 0 && e <= 90);
  }
  for (let m = 6 * 60; m <= 19.5 * 60; m += 7) {   // the low sun's colour by its elevation, toward the twilight row's over its window
    const L = ketchHourLight(m, 'deck'), W = ketchHourWeights(m), T = KT_HOURS[W.row], c = ketchSunColor(ketchSunAt(m));
    for (let k = 0; k < 3; k++) assert.ok(near(L.sunColor[k], c[k] + (T.sun[k] - c[k]) * W.w, 1e-12), `the sun's colour at minute ${m}`);
  }
  assert.ok(ketchHourLight(6.5 * 60, 'deck').sunScale > 0, 'up at half past six');
  assert.ok(ketchHourLight(6.5 * 60, 'deck').sunColor[2] < KT_HOURS.day.sun[2] - 0.1, 'and low and warm');
});

test('KETCH-LOOK KL1 THE TRILIGHT: a floor takes the hour\'s ambient, a wall four fifths of it, a ceiling and her belly the deck\'s bounce of the sun and the moon - warm below decks (mutants: the equator the sky\'s; no bounce)', () => {
  for (const m of [120, 360, 720, 1100]) {
    const L = ketchHourLight(m, 'deck');
    assert.ok(same3(L.tri.sky, L.ambient));
    for (let k = 0; k < 3; k++) {
      assert.ok(near(L.tri.equator[k], L.ambient[k] * KT_TRI.equator, 1e-12));
      assert.ok(near(L.tri.ground[k], (L.sunColor[k] * L.sunScale + KT_HOURS.night.key[k] * L.key.scale) * KT_TRI.bounce, 1e-12));
    }
  }
  assert.ok(ketchHourLight(720, 'deck').tri.ground[0] > 0.25, 'the noon deck bounces');
  const B = ketchHourLight(720, 'below');
  assert.ok(same3(B.tri.ground, KT_HOURS.below.ground) && B.tri.ground[0] > B.tri.ground[2] * 2, 'below, a warm bounce');
});

test('KETCH-LOOK KL1 BELOW DECKS AND THE CABIN: below, the lamps\' warm close air at every hour - no sun, no moon, the warm haze the far end dissolves into, the lane\'s grade held to 1.5; the cabin its hour\'s light at seven tenths and its own grade (mutants: below decks lit by the sun; the below haze the old dark brown)', () => {
  for (const m of [0, 360, 720, 1110]) {
    const B = ketchHourLight(m, 'below');
    assert.ok(B.sunScale === 0 && B.key.scale === 0 && same3(B.ambient, KT_HOURS.below.ambient), `minute ${m}`);
    assert.ok(same3(B.fog.color, KT_BELOW_FOG.color) && B.fog.density === KT_BELOW_FOG.density);
    assert.deepEqual({ ...B.grade }, { ...KT_HOURS.below.grade });
    const C = ketchHourLight(m, 'cabin'), O = ketchHourLight(m, 'deck');
    for (let k = 0; k < 3; k++) assert.ok(near(C.ambient[k], O.ambient[k] * KT_HOURS.cabin.ambientK, 1e-12));
    assert.ok(same3(C.sunColor, O.sunColor) && C.sunScale === O.sunScale && same3(C.fog.color, O.fog.color), 'the hour\'s sun and haze');
    assert.deepEqual({ ...C.grade }, { ...KT_HOURS.cabin.grade });
  }
  assert.deepEqual([...KT_BELOW_FOG.color], [0.16, 0.12, 0.08]);
  assert.equal(KT_HOURS.below.grade.adaptMax, 1.5, 'the eye opened to 1.5, the structure lifted by light');
});

test('KETCH-LOOK KL1 HER LIGHT BUILDS NOTHING A FRAME: the record handed in is the record answered, every array in place', () => {
  const out = ketchLightRecord(), arrays = [out.ambient, out.sunColor, out.sunDir, out.fog.color, out.tri.sky, out.tri.equator, out.tri.ground, out.key.color];
  for (const [m, z] of [[720, 'deck'], [120, 'cabin'], [400, 'below']]) {
    assert.equal(ketchHourLight(m, z, out), out);
    const now = [out.ambient, out.sunColor, out.sunDir, out.fog.color, out.tri.sky, out.tri.equator, out.tri.ground, out.key.color];
    now.forEach((a, i) => assert.equal(a, arrays[i]));
  }
});
