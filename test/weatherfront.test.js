// WX2 - THE FRONT REACHES THE GROUND (2026-09-03, Mac: rain and snow
// should fade in and out slowly, as the grass prototype's front does,
// and not always be a downpour - a sprinkle, a light snow). The pure
// laws of systems/weatherFront.js, the wind model's arrival, the
// renderer's count, the hosts' wiring, and the classic path untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createWeatherFront, PRECIP_PEAK, PRECIP_IN, PRECIP_OUT, PRECIP_SMOOTH_SECONDS, WANDER_FLOOR,
  rollPeak, wander, smoothstep, precipKind, blendFog, blendTerms, soundWeather,
} from '../src/systems/weatherFront.js';
import { createWindModel, FRONT_LEAD_MIN, FRONT_HOLD_MIN, FRONT_TAIL_MIN } from '../src/systems/wind.js';
import { FOG_SETTINGS } from '../src/world/weather.js';
import {
  resetWeatherSim, setWeather, currentWeather, restoreWeather, applyClimateWeather, weatherRespawn, tickWeather,
  rollClimateWeathersForDay, rollWeather, weatherJumpStamp, STALE_DRAIN_MINUTES, WEATHER_TYPES,
} from '../src/systems/weatherSim.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { seasonValue, dateFromClassicMinutes } from '../src/systems/gameDate.js';
import { AmbientEffects } from '../src/systems/ambientEffects.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** tick the front `n` times at `dt` with a fixed arrival; returns the last sample */
function run(front, weather, arrival, { n = 1, dt = 1 / 60, nowMinutes = 0, tsec = 0 } = {}) {
  let s = null;
  for (let i = 0; i < n; i++) s = front.tick({ dt, weather, arrival, nowMinutes, tsec: tsec + i * dt });
  return s;
}
/** enough ticks for the smoothing to have settled (many time constants) */
const SETTLE = { n: 60 * 120, dt: 1 / 60 };

test('WX2 episode: a peak is rolled INSIDE the mode\u2019s range - a rain can sprinkle, a storm never does, snow stays light', () => {
  // the ranges themselves are the law: a rain may fall at a quarter of
  // the profile (a sprinkle), a storm never under six tenths, snow never
  // buries the screen
  assert.ok(PRECIP_PEAK.rain[0] < 0.5 && PRECIP_PEAK.rain[1] === 1.0, 'rain runs from a sprinkle to a downpour');
  assert.ok(PRECIP_PEAK.storm[0] >= 0.6, 'a storm biases heavy');
  assert.ok(PRECIP_PEAK.snow[1] < 1.0 && PRECIP_PEAK.snow[0] <= 0.25, 'snow biases light');
  for (const m of ['rain', 'storm', 'snow']) {
    assert.equal(rollPeak(m, 0), PRECIP_PEAK[m][0]);
    assert.equal(rollPeak(m, 1), PRECIP_PEAK[m][1]);
    assert.equal(rollPeak(m, 2), PRECIP_PEAK[m][1], 'the roll is clamped');
  }
  assert.equal(rollPeak(null, 0.5), 0, 'no mode, no peak');
  // the roll is SEEDED on the cut's minute: a replayed day rains alike,
  // and two cuts on different minutes may not
  const a = createWeatherFront({ seed: 3 }); const b = createWeatherFront({ seed: 3 }); const c = createWeatherFront({ seed: 3 });
  a.tick({ weather: 'sunny' }); b.tick({ weather: 'sunny' }); c.tick({ weather: 'sunny' });
  assert.equal(a.tick({ weather: 'rain', nowMinutes: 500 }).peak, b.tick({ weather: 'rain', nowMinutes: 500 }).peak, 'same seed, same minute, same peak');
  const peaks = new Set();
  for (let m = 0; m < 40; m++) { const f = createWeatherFront({ seed: 3 }); f.tick({ weather: 'sunny' }); peaks.add(f.tick({ weather: 'rain', nowMinutes: m * 97 }).peak); }
  assert.ok(peaks.size > 30, `forty cuts rolled ${peaks.size} distinct peaks - the roll is not one number`);
  for (const p of peaks) assert.ok(p >= PRECIP_PEAK.rain[0] && p <= PRECIP_PEAK.rain[1]);
  const sprinkles = [...peaks].filter((p) => p < 0.45).length;
  assert.ok(sprinkles > 5, `${sprinkles} of forty rains are sprinkles - the range is really used`);
});

test('WX2 wander: the intensity breathes under its peak and never below the floor', () => {
  let lo = 2; let hi = -1; let sum = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const w = wander(i * 0.1, 1.3); lo = Math.min(lo, w); hi = Math.max(hi, w); sum += w; }
  assert.ok(lo >= WANDER_FLOOR - 1e-9, `the wander never dips below the floor (${lo})`);
  assert.ok(hi <= 1.0 + 1e-9, `...and never over the peak (${hi})`);
  assert.ok(hi - lo > 0.3, 'and it really moves');
  assert.ok(Math.abs(sum / N - 0.8) < 0.02, 'centred on eight tenths');
  assert.equal(smoothstep(0, 1, 0.5), 0.5); assert.equal(smoothstep(2, 4, 1), 0); assert.equal(smoothstep(2, 4, 9), 1);
  assert.equal(precipKind('storm'), 'rain'); assert.equal(precipKind('snow'), 'snow'); assert.equal(precipKind(null), null);
});

test('WX2 arrival gate: the rain holds off until the front is mostly in, then fills to its peak', () => {
  const f = createWeatherFront({ seed: 11 });
  f.tick({ weather: 'sunny', arrival: 1 });
  // the cut: nothing falls yet, however long we wait at arrival 0
  let s = run(f, 'rain', 0, SETTLE);
  assert.equal(s.changed, false, 'changed is true on the cut\u2019s tick only');
  assert.equal(s.intensity, 0, 'at the cut, nothing falls');
  assert.equal(s.shown, null);
  assert.equal(s.from, 'sunny'); assert.equal(s.to, 'rain');
  // half in: still dry
  s = run(f, 'rain', PRECIP_IN[0] - 0.01, SETTLE);
  assert.equal(s.intensity, 0, 'dry until the window opens');
  // three quarters in: some rain, not all
  s = run(f, 'rain', 0.75, SETTLE);
  assert.ok(s.intensity > 0.05 && s.intensity < s.peak, `part way in, part of the peak (${s.intensity.toFixed(3)} of ${s.peak.toFixed(3)})`);
  assert.equal(s.shown, 'rain'); assert.equal(s.kind, 'rain');
  // landed: the peak, under the wander
  s = run(f, 'rain', 1, SETTLE);
  assert.ok(s.intensity <= s.peak + 1e-6 && s.intensity >= s.peak * WANDER_FLOOR - 0.02, `landed: the peak under its wander (${s.intensity.toFixed(3)} / ${s.peak.toFixed(3)})`);
  // the wander is real: the settled intensity moves over minutes
  const at0 = run(f, 'rain', 1, { n: 1, tsec: 0 }).intensity;
  const seen = new Set([at0.toFixed(4)]);
  for (let t = 10; t <= 240; t += 10) seen.add(run(f, 'rain', 1, { n: 600, dt: 1 / 60, tsec: t }).intensity.toFixed(4));
  assert.ok(seen.size > 8, 'the intensity is never one number for four minutes');
});

test('WX2 first tick: a boot into rain is rain - the first sample snaps, every later one eases', () => {
  const f = createWeatherFront({ seed: 5 });
  const s = f.tick({ weather: 'rain', arrival: 1, tsec: 0 });
  assert.ok(s.intensity > 0.1, 'the first tick lands on its target whole');
  assert.equal(s.changed, false, 'the first word is not a cut');
  assert.equal(s.from, 'rain', 'and the terms have nothing to cross from');
  assert.equal(s.shown, 'rain');
  // the smoothing: a target jump moves the intensity by 1 - exp(-dt/tau)
  const g = createWeatherFront({ seed: 5 });
  g.tick({ weather: 'sunny', arrival: 1 });
  g.tick({ weather: 'rain', arrival: 0, dt: 0 });
  const before = g.sample().intensity;   // 0
  const after = g.tick({ weather: 'rain', arrival: 1, dt: PRECIP_SMOOTH_SECONDS, tsec: 0 });
  const target = after.peak * wander(0, g.state().episode.phase);
  assert.ok(Math.abs((after.intensity - before) - (target - before) * (1 - Math.exp(-1))) < 1e-9, 'one time constant covers 1 - 1/e of the way');
});

test('WX2 clearing: the rain tapers over the front\u2019s first stretch and drains - a sunny word does not stop it dead', () => {
  const f = createWeatherFront({ seed: 2 });
  f.tick({ weather: 'sunny', arrival: 1 });
  const wet = run(f, 'rain', 1, SETTLE);
  const cut = f.tick({ weather: 'sunny', arrival: 0, dt: 1 / 60 });
  assert.equal(cut.changed, true);
  assert.equal(cut.shown, 'rain', 'the drops are still there on the frame of the cut');
  assert.ok(cut.intensity > wet.intensity * 0.9, 'and not a step fewer');
  const early = run(f, 'sunny', PRECIP_OUT[0] - 0.01, SETTLE);
  assert.ok(early.intensity > wet.peak * WANDER_FLOOR * 0.9, 'before the window, the rain is whole');
  const mid = run(f, 'sunny', (PRECIP_OUT[0] + PRECIP_OUT[1]) / 2, SETTLE);
  assert.ok(mid.intensity > 0.01 && mid.intensity < early.intensity * 0.7, `half way out, thinner (${mid.intensity.toFixed(3)} from ${early.intensity.toFixed(3)})`);
  assert.equal(mid.shown, 'rain', 'what tapers is still the rain');
  const gone = run(f, 'sunny', PRECIP_OUT[1] + 0.05, SETTLE);
  assert.equal(gone.intensity, 0, 'past the window, drained');
  assert.equal(gone.shown, null, 'and nothing is shown');
  assert.equal(gone.kind, null);
});

test('WX2 a change of kind: the old kind thins out before the new fills in, and the residual is never relabelled', () => {
  const f = createWeatherFront({ seed: 9 });
  f.tick({ weather: 'sunny', arrival: 1 });
  run(f, 'rain', 1, SETTLE);
  f.tick({ weather: 'snow', arrival: 0, dt: 1 / 60 });
  const early = run(f, 'snow', 0.3, SETTLE);
  assert.equal(early.shown, 'rain', 'a third in, the rain is still what falls');
  assert.ok(early.intensity > 0.01);
  // the moment the kind switches, the count starts from nothing - the
  // last drops do not become the first flakes
  const at = f.tick({ weather: 'snow', arrival: PRECIP_OUT[1] + 0.001, dt: 1 / 60 });
  assert.ok(at.intensity < 0.02, `the switch of kind starts the new count from nothing (${at.intensity})`);
  const late = run(f, 'snow', 1, SETTLE);
  assert.equal(late.shown, 'snow'); assert.equal(late.kind, 'snow');
  assert.ok(late.intensity > 0.1);
  assert.ok(late.intensity <= PRECIP_PEAK.snow[1] + 1e-9, 'a snow peak, not a rain one');
});

test('WX2 within a kind: rain thickening into a storm walks the peak across with no gap', () => {
  const f = createWeatherFront({ seed: 4 });
  f.tick({ weather: 'sunny', arrival: 1 });
  const rain = run(f, 'rain', 1, SETTLE);
  f.tick({ weather: 'thunder', arrival: 0, dt: 1 / 60 });
  const early = run(f, 'thunder', 0.3, SETTLE);
  assert.equal(early.shown, 'rain', 'before the midpoint the outgoing mode is named');
  assert.ok(early.intensity > rain.intensity * 0.8, `no taper on the way to a storm (${early.intensity.toFixed(3)} vs ${rain.intensity.toFixed(3)})`);
  const mid = run(f, 'thunder', 0.6, SETTLE);
  assert.equal(mid.shown, 'storm', 'past the midpoint the incoming mode is named');
  assert.ok(mid.intensity > rain.intensity * 0.55, `and it never fell away in between (${mid.intensity.toFixed(3)} vs ${rain.intensity.toFixed(3)})`);
  const storm = run(f, 'thunder', 1, SETTLE);
  assert.ok(storm.peak >= PRECIP_PEAK.storm[0], 'a storm\u2019s peak');
  assert.ok(storm.intensity <= storm.peak + 1e-6 && storm.intensity >= storm.peak * WANDER_FLOOR - 0.02, `landed on the storm\u2019s peak under its wander (${storm.intensity.toFixed(3)} / ${storm.peak.toFixed(3)})`);
});

test('WX2 terms: the sun, the dim and the fog cross on the front - the same mode lerps, a change of mode switches at the midpoint, a settled front hands back the table\u2019s own row', () => {
  const from = { sun: 1, dim: 1, fog: FOG_SETTINGS.sunny };
  const to = { sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.rainy };
  assert.equal(blendTerms(from, to, 1), to, 'at 1 the target itself - identity, so the classic and the settled paths read the frozen row');
  assert.equal(blendTerms(from, to, 0), from, 'at 0 the from itself');
  assert.equal(blendTerms(null, to, 0.3), to, 'nothing to cross from: the target');
  const half = blendTerms(from, to, 0.5);
  assert.ok(Math.abs(half.sun - 0.725) < 1e-12 && Math.abs(half.dim - 0.8) < 1e-12, 'the scalars lerp');
  // linear -> exp cannot blend: the switch is at the midpoint, not at the cut
  assert.equal(blendTerms(from, to, 0.49).fog, FOG_SETTINGS.sunny);
  assert.equal(blendTerms(from, to, 0.5).fog, FOG_SETTINGS.rainy);
  // exp -> exp lerps its density (rain thickening to snow, or to a pea-souper)
  const f2 = blendFog(FOG_SETTINGS.rainy, FOG_SETTINGS.heavy, 0.25);
  assert.equal(f2.mode, 'exp');
  assert.ok(Math.abs(f2.density - (0.003 + (0.05 - 0.003) * 0.25)) < 1e-12);
  assert.equal(f2.excludeSky, true, 'the sky flag follows the nearer row');
  assert.equal(blendFog(FOG_SETTINGS.rainy, FOG_SETTINGS.heavy, 0.75).excludeSky, false);
  // linear -> linear lerps the end (the distance haze of a sunny day IS overcast's)
  const l = blendFog({ ...FOG_SETTINGS.sunny, end: 2400 }, { ...FOG_SETTINGS.sunny, end: 3200 }, 0.5);
  assert.equal(l.end, 2800);
  // dim defaults to 1 when a host has no grass
  assert.equal(blendTerms({ sun: 1, fog: FOG_SETTINGS.sunny }, { sun: 0.5, fog: FOG_SETTINGS.sunny }, 0.5).dim, 1);
});

test('WX2 the ear: the ambience hears what falls, not the sim\u2019s word', () => {
  assert.equal(soundWeather({ shown: null }, 'rain'), 'cloudy', 'a rain word with nothing down yet is a cloudy day');
  assert.equal(soundWeather({ shown: null }, 'thunder'), 'cloudy');
  assert.equal(soundWeather({ shown: 'rain' }, 'sunny'), 'rain', 'the outgoing rain keeps its loop while it tapers');
  assert.equal(soundWeather({ shown: 'storm' }, 'thunder'), 'thunder');
  assert.equal(soundWeather({ shown: 'rain' }, 'thunder'), 'rain', 'before the midpoint a storm sounds like the rain it still is');
  assert.equal(soundWeather({ shown: 'snow' }, 'snow'), 'snow', 'snow has no loop in DFU and gets none here');
  assert.equal(soundWeather({ shown: null }, 'fog'), 'fog');
  // the rain loop's gain follows rainGain, is written only when it moves,
  // and tolerates a handle without the setter (the older stubs)
  const set = [];
  const engine = { loop: () => ({ stop() {}, setVolume: (v) => set.push(v) }), play3d() {}, playOneShot() {} };
  const amb = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0.5);
  assert.equal(amb.rainGain, 1, 'Unity\u2019s volume by default - the classic path never sets it');
  amb.setPreset('rain'); amb.update(0.016);
  assert.deepEqual(set, [1], 'a fresh loop takes the gain once');
  amb.update(0.016); amb.update(0.016);
  assert.deepEqual(set, [1], 'and is not written again while it stands');
  amb.rainGain = 0.3; amb.update(0.016);
  assert.deepEqual(set, [1, 0.3], 'a moved gain is written once');
  amb.setPreset('sunnyDay'); amb.update(0.016); amb.setPreset('storm'); amb.update(0.016);
  assert.deepEqual(set, [1, 0.3, 0.3], 'a restarted loop takes the current gain');
  const bare = new AmbientEffects({ minWait: 5, maxWait: 25 }, { loop: () => ({ stop() {} }), play3d() {}, playOneShot() {} }, () => 0.5);
  bare.setPreset('rain'); bare.rainGain = 0.5;
  assert.doesNotThrow(() => bare.update(0.016), 'a handle with no setter is left alone');
  assert.match(read('src/systems/audio.js'), /setVolume\(v\) \{ gain\.gain\.value = Math\.max\(0, Math\.min\(1, v\)\); \},/, 'the engine\u2019s loop handle carries the setter');
});

test('WX2 the wind model\u2019s arrival: 0 at the cut, 1 when the front lands, and 1 THROUGH the hold and the tail where frontProgress falls', () => {
  const m = createWindModel({ seed: 7 });
  m.tick(600, 'sunny');
  assert.equal(m.arrival(), 1, 'no front up: arrived');
  m.tick(601, 'thunder');
  assert.ok(m.arrival() < 0.001, `at the cut the incoming weather has not arrived (${m.arrival()})`);
  m.tick(601 + FRONT_LEAD_MIN / 2, 'thunder');
  assert.ok(Math.abs(m.arrival() - 0.5) < 1e-9, 'half the lead in, half arrived (the same ease as the wind)');
  assert.equal(m.arrival(), m.frontProgress(), 'on the way in the two agree');
  m.tick(601 + FRONT_LEAD_MIN, 'thunder');
  assert.equal(m.arrival(), 1, 'landed');
  m.tick(601 + FRONT_LEAD_MIN + FRONT_HOLD_MIN + FRONT_TAIL_MIN / 2, 'thunder');
  assert.equal(m.arrival(), 1, 'the wind is rolling away but the weather is still here');
  assert.ok(m.frontProgress() < 1, '...which is what frontProgress says instead');
  m.tick(601 + FRONT_LEAD_MIN + FRONT_HOLD_MIN + FRONT_TAIL_MIN + 5, 'thunder');
  assert.equal(m.arrival(), 1, 'and after the front is forgotten');
  // the controller exposes it beside frontProgress
  assert.match(read('src/scenes/shared.js'), /frontArrival\(\) \{ return windModel\.arrival\(\); \},/);
});

test('WX2 the renderer: the lab draw scales the profile by the intensity and draws nothing at zero; the classic draw never reads it', () => {
  const p = read('src/render/precipitation.js');
  assert.match(p, /this\.intensity = 1;/, 'the whole profile by default');
  assert.match(p, /const full = Math\.round\(\(LAB_COUNTS\[mode\] \?\? LAB_COUNTS\.rain\) \* Math\.min\(1, Math\.max\(0, this\.intensity\)\)\);\s*\n\s*const count = this\.countCap \? Math\.min\(full, this\.countCap\) : full;\s*\n\s*if \(count <= 0\) return;/,
    'the count is the profile times the intensity, capped as before, and zero draws nothing');
  // the classic draw() body carries no intensity term
  const classic = p.slice(p.indexOf('  draw(mode, proj, view, camPos, camRight, timeSeconds) {'));
  assert.doesNotMatch(classic, /intensity/, 'DFU\u2019s cap is drawn whole on the classic path');
});

test('WX2 the hosts: both read the front under the enhanced sky only, and the classic path takes the row\u2019s own terms whole', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /const enhancedFront = !!sky\?\.cloudShadow && params\.get\('front'\) !== 'off';/, `${host}: the front rides the enhanced sky, and ?front=off is its kill switch`);
    assert.match(h, /weatherFront\.tick\(\{ dt, weather, arrival: enhancedFront \? sky\.frontArrival\(\) : 1, nowMinutes: playerTicker\.classicMinutes, tsec: now \/ 1000, jump \}\)/, `${host}: the arrival is the wind's under the enhanced sky and 1 under the classic, and the jump rides along`);
    assert.match(h, /if \(fx\.changed\) wxFrom = wxNow;\s*\n\s*wxNow = enhancedFront \? blendTerms\(wxFrom, weatherTerms\(\), fx\.t\) : weatherTerms\(\);/, `${host}: the terms cross from what was ON SCREEN, and classic takes the row whole`);
    assert.match(h, /ambience\.setPreset\(presetForExterior\(enhancedFront \? soundWeather\(fx, weather\) : weather, isNight\(minute\)\)\);\s*\n\s*ambience\.rainGain = enhancedFront \? fx\.intensity : 1;/, `${host}: the ear follows the front, the gain too, classic verbatim`);
    assert.match(h, /const precipShown = enhancedFront \? fx\.shown : precipMode;\s*\n\s*if \(precipShown && precip\) \{/, `${host}: what falls is what the front shows`);
    assert.match(h, /if \(precip\.enhanced\) \{\s*\n\s*precip\.intensity = fx\.intensity;/, `${host}: the intensity is set inside the enhanced branch only`);
    assert.match(h, /precip\.draw\(precipShown, proj, view/, `${host}: the draw takes the shown mode`);
    assert.match(h, /const fogNow = wxNow\.fog;/, `${host}: the fog row is the front's`);
    assert.doesNotMatch(h.slice(h.indexOf('function frame(now)')), /[^.]weatherSun\b(?!\s*=)/, `${host}: no frame consumer reads the raw sun scale any more`);
    assert.doesNotMatch(h.slice(h.indexOf('function frame(now)')), /\bweatherFog\b(?!\s*=)/, `${host}: no frame consumer reads the raw fog row any more`);
    assert.match(h, /const weatherTerms = \(\) => \(\{ sun: weatherSun, dim: (LAB_DIM\[weather\] \?\? 1|1), fog: weatherFog \}\);/, `${host}: the terms are the weather's own numbers`);
  }
  assert.match(read('src/scenes/world.js'), /dim: wxNow\.dim \},\s+\/\/ WX2/, 'the grass dim crosses on the front');
  // the classic sky never ticks the wind model, so under it the arrival
  // is 1 and the front is a pass-through: pinned at the seam
  const sh = read('src/scenes/shared.js');
  assert.ok(sh.indexOf('windModel.tick(') > sh.indexOf('if (enhancedSky) {'), 'the model ticks inside the enhanced branch only');
});

// ═══ WX2a - AUDIT 57: the front audited ═══════════════════════════════

test('AUDIT 57 F3 (sim): a change the player was not present for stamps a JUMP - a load, a travel landing, a respawn roll, a stale drain - and a live day roll does not', () => {
  resetWeatherSim();
  try {
    const ci = CLIMATES.Woodlands;
    const NOW = 20 * 1440 + 600;
    const season = seasonValue(dateFromClassicMinutes(NOW));
    // two rolls that land on DIFFERENT words for this climate and season
    // rollWeather answers the ENUM (the array's byte); the sim's word is the name
    const lo = WEATHER_TYPES[rollWeather(ci, season, () => 0.001)]; const hi = WEATHER_TYPES[rollWeather(ci, season, () => 0.999)];
    assert.notEqual(lo, hi, 'the table has two ends');
    const stamp = () => weatherJumpStamp();
    // boot: the first drain rolls and applies, and is not a jump (the hosts' models are fresh anyway)
    tickWeather(NOW, ci, () => 0.001);
    assert.equal(stamp(), 0, 'a boot is not a jump');
    // a LIVE day roll, drained on the frame it happened, is a front
    rollClimateWeathersForDay(NOW + 840, () => 0.999);
    assert.equal(tickWeather(NOW + 840 + 1, ci), true, 'the drain applied the other end');
    assert.equal(currentWeather(), hi);
    assert.equal(stamp(), 0, 'a live drain is a front, not a jump');
    // a STALE one - the roll happened while the player was inside - is a jump
    rollClimateWeathersForDay(NOW + 2 * 1440, () => 0.001);
    assert.equal(tickWeather(NOW + 2 * 1440 + STALE_DRAIN_MINUTES + 1, ci), true);
    assert.equal(stamp(), 1, 'a drain more than the stale window after its roll is a jump');
    // the same lateness with NO change stamps nothing
    rollClimateWeathersForDay(NOW + 3 * 1440, () => 0.001);
    assert.equal(tickWeather(NOW + 3 * 1440 + 200, ci), false);
    assert.equal(stamp(), 1, 'no change, no jump');
    // a fast-travel landing (OnInitWorld's apply) is a jump when it changes the word
    rollClimateWeathersForDay(NOW + 4 * 1440, () => 0.999); tickWeather(NOW + 4 * 1440 + 1, ci);
    const before = stamp();
    assert.equal(applyClimateWeather(ci), false, 'the same slot: no change');
    assert.equal(stamp(), before, '...and no jump');
    rollClimateWeathersForDay(NOW + 5 * 1440, () => 0.001);
    assert.equal(applyClimateWeather(ci), true);
    assert.equal(stamp(), before + 1, 'a landing under a different sky is a jump');
    // a respawn roll to a new climate base is a jump when it changes the word
    setWeather(lo === 'sunny' ? hi : lo);
    const b2 = stamp();
    const changed = weatherRespawn(NOW + 6 * 1440, CLIMATES.Desert, () => (currentWeather() === 'sunny' ? 0.999 : 0.001));
    assert.equal(stamp(), b2 + (changed ? 1 : 0), 'the respawn stamps exactly when it changed the word');
    // a load always stamps: the player lands under the saved sky, whole
    const b3 = stamp();
    restoreWeather('rain');
    assert.equal(currentWeather(), 'rain');
    assert.equal(stamp(), b3 + 1, 'a restore is a jump');
    resetWeatherSim();
    assert.equal(stamp(), 0, 'the test seam clears it');
  } finally { resetWeatherSim(); }
});

test('AUDIT 57 F3 (wind + controller): a jumped change builds no front and drops one that is up; ?wseed reaches the wind', () => {
  const m = createWindModel({ seed: 7 });
  m.tick(600, 'sunny');
  m.jump();
  assert.equal(m.state().jumpPending, true);
  m.tick(601, 'thunder');
  assert.equal(m.state().front, null, 'the player arrived under the storm: no front');
  assert.equal(m.arrival(), 1, 'arrived');
  assert.equal(m.state().jumpPending, false, 'the jump is spent on the tick that saw it');
  m.tick(700, 'sunny');
  assert.ok(m.state().front, 'the next real change builds as before');
  assert.ok(m.arrival() < 1);
  m.jump();
  assert.equal(m.state().front, null, 'a jump drops the front that is up - the world it belonged to is gone');
  assert.equal(m.arrival(), 1);
  m.tick(701, 'sunny');
  assert.equal(m.state().front, null, 'and a jump with no change of word builds nothing');
  const sh = read('src/scenes/shared.js');
  assert.match(sh, /weatherJump\(\) \{\s*\n\s*weatherRowNow = null;\s*\n\s*windModel\.jump\(\);/, 'the controller drops its eased row (the first-call law takes the new one whole) and tells the wind');
  assert.match(sh, /const windModel = createWindModel\(\{ seed: Number\(params\.get\('wseed'\)\) \|\| 7 \}\);/, 'F4: ?wseed replays the wind\u2019s rolls too - the record claimed it and it did not');
});

test('AUDIT 57 F3 (front): a jumped change lands whole - no crossing, no taper, the drops down on the frame - and a later real change still builds', () => {
  const f = createWeatherFront({ seed: 5 });
  f.tick({ weather: 'sunny', arrival: 1 });
  const s = f.tick({ weather: 'rain', arrival: 0, jump: true, dt: 1 / 60, tsec: 0 });
  assert.equal(s.changed, false, 'nothing to cross');
  assert.equal(s.from, 'rain'); assert.equal(s.to, 'rain');
  assert.equal(s.t, 1, 'the arrival is 1 by contract, whatever the model\u2019s last frame said');
  assert.ok(s.intensity > 0.1 && Math.abs(s.intensity - s.peak * wander(0, f.state().episode.phase)) < 1e-9, 'the drops land whole on the frame');
  assert.equal(s.shown, 'rain');
  assert.equal(f.state().outgoing, null, 'no episode tapers');
  // a jump with the SAME word changes nothing
  const same = f.tick({ weather: 'rain', arrival: 1, jump: true, dt: 1 / 60, tsec: 1 });
  assert.equal(same.changed, false); assert.equal(same.shown, 'rain');
  // and the next real change builds as WX2 does
  const cut = f.tick({ weather: 'sunny', arrival: 0, dt: 1 / 60, tsec: 2 });
  assert.equal(cut.changed, true); assert.equal(cut.from, 'rain'); assert.equal(cut.shown, 'rain', 'the rain tapers from here');
  // a jump into a word with no precipitation, from rain, drains at once
  const g = createWeatherFront({ seed: 5 });
  g.tick({ weather: 'rain', arrival: 1 });
  const dry = g.tick({ weather: 'sunny', arrival: 1, jump: true, dt: 1 / 60 });
  assert.equal(dry.intensity, 0); assert.equal(dry.shown, null);
});

test('AUDIT 57 F1 + F2 + F3 (hosts): the flash waits for the storm, ?front=off is the kill switch, and the jump reaches the sky before the front', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /const jump = weatherJumpStamp\(\) !== seenJump;\s*\n\s*seenJump = weatherJumpStamp\(\);\s*\n\s*if \(jump\) sky\.weatherJump\(\);\s*\n\s*const fx = weatherFront\.tick\(/, `${host}: the stamp is read once, the sky told first, the front told on the same tick`);
    assert.match(h, /let seenJump = weatherJumpStamp\(\);/, `${host}: the boot's stamp is the baseline - a boot is never a jump`);
    assert.match(h, /const lightningShown = !enhancedFront \|\| fx\.shown === 'storm' \? lightning : null;/, `${host}: the flash follows the shown storm under the front and the player on classic`);
    assert.match(h, /const strobeNow = lightning \? lightning\.tick\(dt\) : 1;/, `${host}: the player ticks every frame regardless`);
    assert.match(h, /const flash = params\.has\('flashtest'\) \? 2 : \(isEnhanced\(\) \? strobe : 1\);/, `${host}: ?flashtest still pins the flash on`);
    assert.match(h, /params\.get\('front'\) !== 'off'/, `${host}: the kill switch`);
  }
});

test('AUDIT 57 F5 (record): the Rendering entry and the Ledger row quote the constants the module holds', () => {
  const r = read('bible/07-Rendering/Rendering.md');
  const entry = r.slice(r.indexOf('**WX2 (2026-09-03) THE FRONT REACHES THE'), r.indexOf('- `enhancedSky.js` - ES1 the ENHANCED SKY'));
  assert.ok(entry.length > 500, 'the WX2 entry stands');
  const fmt = (r2) => `${r2[0]}..${r2[1].toFixed(r2[1] === 1 ? 1 : 2).replace(/0$/, '')}`;
  for (const [mode, label] of [['rain', 'rain'], ['storm', 'storm'], ['snow', 'snow']]) {
    const [lo, hi] = PRECIP_PEAK[mode];
    const re = new RegExp(`${label}\\s+${String(lo).replace('.', '\\.')}\\.\\.${hi === 1 ? '1\\.0' : String(hi).replace('.', '\\.')}`);   // the entry wraps its lines
    assert.match(entry, re, `Rendering.md names the ${mode} range the module holds (${fmt([lo, hi])})`);
    assert.match(read('bible/01-Overview/Port-Ledger.md'), re, `the Ledger row names the ${mode} range`);
  }
  assert.match(entry, new RegExp(`\\(${PRECIP_IN[0]}\\.\\.${PRECIP_IN[1]}\\)`), 'the fill-in window');
  assert.match(entry, new RegExp(`\\(${PRECIP_OUT[0]}\\.\\.${PRECIP_OUT[1].toFixed(2)}\\)`), 'the thin-out window');
  assert.match(entry, /\?front=off/, 'the kill switch is recorded');
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /\?front=off/, 'and in the Ledger row');
});
