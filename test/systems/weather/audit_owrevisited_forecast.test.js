// AUDIT OW-REVISITED (2026-10-20, the owner: "Audit this and ensure perfection"; bible/01-Overview/audits/Audit-Overworld-
// Revisited.md): THE FORECAST, as lane L3 found it and as it is now. The headline (L3-1): the whole way was asked at the
// pace of the moment, while a road runs at x100, the open ground at x60, a track at a cautious force and a town's streets
// at x5 - a third of the "ahead" lines untrue on arrival offline, four in five at an online journey's start. Each stretch
// now walks at its own pace; pinned against a PHYSICAL model of the walk (each stretch's motion and clock, never the
// host's own composition), over the real map where ARENA2 is (its climates and the host's ground law).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { samplesAlong, routeForecast, routeLine, paceMeter, kmWords, PACE_GAP_S, PACE_CLOCK_STEP_MIN } from '../../../src/systems/weather/owForecast.js';
import { createOverworldForecast, FORECAST_EVERY_MS, FORECAST_SLICE, FORECAST_CARDS_MAX } from '../../../src/scenes/overworldForecastHost.js';
import { weatherAt } from '../../../src/systems/weather/weatherMap.js';
import { setWeatherMapLaw, mapGround } from '../../../src/systems/weather/weatherSim.js';
import { nativeFromField, fieldFromNative } from '../../../src/systems/weather/weatherField.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { setLocale } from '../../../src/systems/textManager.js';
import { skipReal, game } from '../../lwRealTown.mjs';

/** The real map's climates where ARENA2 is, the host's own ground law over them; else the woodlands everywhere. */
const world = () => {
  if (skipReal) return { climateAt: () => CLIMATES.Woodlands, ground: null, real: false };
  const maps = game().maps;
  const climateAt = (px, py) => maps.getClimateIndex(px, py);
  return { climateAt, ground: mapGround(climateAt), real: true };
};

/**
 * A journey flown through the real host: two legs east - a road (force 1, x100) to `split` field metres, then the open
 * ground (force 0.8, x60) - its stretches' paces Travel Options' (wayPace) and its motion the PHYSICAL model: `b` field
 * metres a real second at x1 and force 1, the clock `c` game minutes a real second at x1 offline (`shared`: `rs` a real
 * second whatever the rate, online). The pass begins at 2 s (the meter warm); answers the line it said and the line the
 * physical model makes at that moment.
 */
function journey(w, x0, z0, m0, { split = 3000, b = 3, c = 0.02, shared = false, rs = 2, held = null } = {}) {
  const legs = [{ kind: 'road', fwd: 1, rate: 100 }, { kind: 'open', fwd: 0.8, rate: 60 }];
  const end = x0 + 60000;
  const speed = (leg) => b * leg.fwd * leg.rate;   // field metres a real second
  const clock = (leg) => (shared ? rs : c * leg.rate);   // game minutes a real second
  // `held`: the governor holds the clock under the road's rate while the pace is measured (the land loading) - the
  // stretches ahead at their own law's rate
  const nowLeg = held ? { ...legs[0], rate: held } : legs[0];
  let t = 0;
  const xAt = (tt) => x0 + speed(nowLeg) * tt;   // the first two seconds are all on the road (the split lies past them)
  const trip = { natives: [nativeFromField(x0, z0), nativeFromField(split + x0, z0), nativeFromField(end, z0)], plan: { summary: { name: 'Ripwych' } } };
  const route = { i: 0, legs: legs.map((l) => ({ kind: l.kind })) };
  const travel = { route, state: { autopilot: { seg: 0 } }, wayPace: (of) => (typeof of === 'number' ? { fwd: legs[of].fwd, rate: legs[of].rate, sea: false } : null), paceNow: { fwd: 1, sea: false } };
  const fc = createOverworldForecast({
    climateAt: w.climateAt, ground: w.ground, minuteNow: () => m0 + clock(nowLeg) * t, here: () => { const [x, z] = nativeFromField(xAt(t), z0); return { x, z }; },
    tvTrip: trip, tvTripLive: () => true, travel: () => travel, shared: () => shared, rateNow: () => nowLeg.rate,
  });
  let line = '';
  for (let f = 0; f <= 150; f++) { t = Math.min(f / 30, 2); line = fc.line((f / 30) * 1000); }   // the walk held at 2 s while the pass reads its places
  // the physical model at 2 s: the way from where the traveller stands, each stretch's own minutes a metre
  const here = [xAt(2), z0], now = m0 + clock(nowLeg) * 2;
  const pts = [here, [x0 + split, z0], [end, z0]];
  const mpm = legs.map((l) => clock(l) / speed(l));
  const truth = (d) => { const first = pts[1][0] - pts[0][0]; return now + Math.min(d, first) * mpm[0] + Math.max(0, d - first) * mpm[1]; };
  const wordAt = (x, z, m) => weatherAt(x, z, Math.floor(m), w.climateAt, { ground: w.ground }).word;
  const f = routeForecast(samplesAlong(pts), { nowWord: wordAt(here[0], here[1], now), now, minuteAt: truth, wordAt });
  return { line, want: routeLine(f, 'Ripwych'), f, split: pts[1][0] - pts[0][0] };
}

test('AUDIT OW-REVISITED L3-1: EACH STRETCH AT ITS OWN PACE - a road at x100 and force 1, then the open ground at x60 and force 0.8: the line said is the one the physical walk makes (each stretch\'s own motion and clock), offline (the calendar runs with the rate) and online (the shared clock does not), over the real map where ARENA2 is; so what it says ahead comes true where and when the traveller gets there (mutants: the whole way at the pace of the moment; the force unread; the rate unread online; the rate read offline)', () => {
  const w = world();
  setWeatherMapLaw(true);
  try {
    for (const [shared, held] of [[false, null], [true, null], [true, 50], [false, 50]]) {
      let met = 0, tried = 0;
      for (let i = 0; i < 300 && met < 6; i++) {
        const x0 = 150000 + (i % 15) * 23000, z0 = 120000 + Math.floor(i / 15) * 17000, m0 = 3_000_000 + i * 1237;
        const j = journey(w, x0, z0, m0, { shared, held });
        tried++;
        assert.equal(j.line, j.want, `${shared ? 'online' : 'offline'}${held ? ' (the clock held at x50)' : ''} #${i}: the physical walk's line`);
        if (j.f.kind === 'ahead' && j.f.d > j.split + 400) met++;   // met PAST the change of ground: the pace that matters is the second stretch's
      }
      assert.ok(met >= 6, `${shared ? 'online' : 'offline'}: ${met} lines met weather past the change of ground (${tried} tried, ${w.real ? 'the real map' : 'the woodlands'})`);
    }
  } finally { setWeatherMapLaw(null); }
});

test('AUDIT OW-REVISITED L3-3 / L3-8 / L3-9: A STOPPED JOURNEY IS NOT TRAVELLING - here said the frame nothing drives (it forecast at the pace it no longer had for twenty seconds); a gap or a clock that steps far ahead starts the meter again; the line never outlives the journey it spoke of (mutants: the meter kept while stopped; the gap measured; the clock\'s step kept; the line kept past its journey)', () => {
  assert.equal(PACE_GAP_S, 1);
  assert.equal(PACE_CLOCK_STEP_MIN, 2);
  const warmed = () => { const m = paceMeter(); for (let i = 0; i <= 60; i++) m.step(i / 30, i * 10, 0, 1000 + i * 0.05); return m; };   // two seconds: 300 m and 1.5 game minutes a real second
  const p = warmed();
  assert.ok(p.minutesFor(1000) != null, 'warm');
  p.step(2 + 2, 610, 0, 1003.05);   // two seconds' gap (the view down)
  assert.equal(p.minutesFor(1000), null, 'a gap: no measure');
  const q = warmed();
  q.step(61 / 30, 610, 0, 1006.5);   // the shared minute re-heard three minutes on
  assert.equal(q.v, 0, 'a clock\'s jump: the meter again');
  const ok = warmed();
  ok.step(61 / 30, 610, 0, 1003.05);
  assert.ok(ok.v > 0, 'its own pace: kept');
  const back = warmed();
  back.step(61 / 30, 610, 0, 999);
  assert.equal(back.v, 0, 'a clock that steps back: the meter again');
  // the host: driving, then stopped - here at once
  setWeatherMapLaw(true);
  try {
    let t = 0, driving = true, live = true;
    const plan = { summary: { name: 'Ripwych' } };
    const trip = { natives: [nativeFromField(100000, 100000), nativeFromField(160000, 100000)], plan };
    const travel = { route: { i: 0, legs: [{ kind: 'road' }] }, state: { autopilot: { seg: 0 } }, wayPace: () => ({ fwd: 1, rate: 1, sea: false }), get paceNow() { return driving ? { fwd: 1, sea: false } : null; } };
    const fc = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: null, minuteNow: () => 2_000_000 + t * 2, here: () => { const [x, z] = nativeFromField(100000 + (driving ? 300 * t : 300 * 4), 100000); return { x, z }; }, tvTrip: trip, tvTripLive: () => live, travel: () => travel });
    let line = '';
    for (let f = 0; f <= 120; f++) { t = f / 30; line = fc.line(t * 1000); }
    assert.match(line, /ahead|all the way|for the next/, `driving: the way ahead (${line})`);
    driving = false;
    t = 121 / 30;
    const stoppedAt = fc.line(t * 1000);
    assert.doesNotMatch(stoppedAt, /ahead|all the way|for the next/, `stopped: here the same frame, not the way (${stoppedAt})`);
    for (let f = 122; f <= 200; f++) { t = f / 30; line = fc.line(t * 1000); }
    assert.doesNotMatch(line, /ahead|all the way|for the next/, `stopped: here, not the way (${line})`);
    // the journey over: its line goes the same frame
    driving = true;
    for (let f = 201; f <= 330; f++) { t = f / 30; line = fc.line(t * 1000); }
    live = false;
    const after = fc.line((331 / 30) * 1000);
    assert.doesNotMatch(after, /Ripwych|ahead|all the way|for the next/, `the journey over: its line gone at once (${after})`);
  } finally { setWeatherMapLaw(null); }
});

test('AUDIT OW-REVISITED L3-10 / L3-6: A PASS IS READ A FEW PLACES A FRAME, and begun once every FORECAST_EVERY_MS - never a whole pass in one frame (up to 26 ms in the HUD\'s draw), never every frame; a place\'s card kept a minute and FORECAST_CARDS_MAX at most; the host\'s own ground law read for the way and for here (mutants: the whole pass in a frame; every frame; the card never renewed; the cards unbounded; the ground dropped)', () => {
  assert.equal(FORECAST_SLICE, 4);
  assert.equal(FORECAST_EVERY_MS, 2000);
  setWeatherMapLaw(true);
  try {
    // every word the ground law's 'sunny' (no news anywhere: the whole way is read) - each place read is one lawAir ask
    let reads = 0, t = 0;
    const ground = Object.assign(() => 'sunny', { lawAir: () => { reads++; return null; } });
    const trip = { natives: [nativeFromField(100000, 100000), nativeFromField(160000, 100000)], plan: { summary: { name: 'Ripwych' } } };
    const travel = { route: { i: 0, legs: [{ kind: 'road' }] }, state: { autopilot: { seg: 0 } }, wayPace: () => ({ fwd: 1, rate: 1, sea: false }), paceNow: { fwd: 1, sea: false } };
    const fc = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground, minuteNow: () => 2_000_000 + t * 0.1, here: () => { const [x, z] = nativeFromField(100000 + 300 * Math.min(t, 2), 100000); return { x, z }; }, tvTrip: trip, tvTripLive: () => true, travel: () => travel });
    const perFrame = [];
    let line = '';
    for (let f = 0; f <= 150; f++) { t = f / 30; reads = 0; line = fc.line(t * 1000); perFrame.push(reads); }
    assert.equal(line, 'Fair weather ahead', 'the ground law\'s word read along the way (every word its sunny; the end past the reach)');
    const pass = perFrame.slice(60, 100);
    assert.ok(Math.max(...pass) <= FORECAST_SLICE + 1, `a frame reads a few places (${Math.max(...pass)} at most)`);
    assert.ok(pass.filter((n) => n > 0).length >= 20, `the pass spread over frames (${pass.filter((n) => n > 0).length})`);
    assert.ok(perFrame.slice(100, 120).every((n) => n === 0), 'between passes, nothing read');
    // a card: kept within its minute, read again the next; bounded
    let minute = 2_000_000;
    const fc2 = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground, minuteNow: () => minute, here: () => ({ x: 0, z: 0 }), tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null });
    const card = () => { reads = 0; fc2.placeLine({ x: 50, z: 50 }); return reads; };
    assert.ok(card() > 0, 'read');
    assert.equal(card(), 0, 'kept within the minute');
    minute += 1;
    assert.ok(card() > 0, 'read again the next minute');
    for (let i = 0; i < FORECAST_CARDS_MAX + 10; i++) fc2.placeLine({ x: i * 1000, z: 0 });
    assert.equal(fc2.cardsKept(), FORECAST_CARDS_MAX, 'the cards bounded');
    // here: the ground law read too
    const here = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: Object.assign(() => 'snow', { lawAir: () => null }), minuteNow: () => 2_000_000, here: () => ({ x: 0, z: 0 }), tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null });
    assert.match(here.line(0), /^Snow/, 'here: the ground law\'s own word');
  } finally { setWeatherMapLaw(null); }
});

test('AUDIT OW-REVISITED L3-4 / L3-7 / L3-14: HERE AT THE TRAVELLER\'S OWN HEIGHT (the sky\'s air, never the ground\'s mean); a change found to the minute, not the quarter hour; an event that holds the sky (Sun Baby) says nothing (mutants: the height dropped; the bisection undone; the event unread)', () => {
  setWeatherMapLaw(true);
  try {
    const heights = [];
    const ground = Object.assign((w) => w, { lawAir: (m, a) => { heights.push(a); return null; } });
    const fc = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground, minuteNow: () => 2_000_000, here: () => ({ x: 0, z: 0 }), alt: () => 915, tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null });
    fc.line(0);
    assert.ok(heights.length && heights.every((a) => a === 915), `the traveller's height read (${[...new Set(heights)]})`);
    heights.length = 0;
    fc.placeLine({ x: 5000, z: 5000 });
    assert.ok(heights.every((a) => a == null), 'a place\'s card: its ground\'s');
    // a change to the minute: find a place where the word changes between quarter hours, and the line names its minute
    let found = null;
    for (let i = 0; i < 2000 && !found; i++) {
      const x = 40000 + (i % 40) * 9000, z = 40000 + Math.floor(i / 40) * 9000, m = 2_000_000 + i * 311;
      const w0 = weatherAt(x, z, m, () => CLIMATES.Woodlands).word, w15 = weatherAt(x, z, m + 15, () => CLIMATES.Woodlands).word;
      if (w0 !== w15) for (let k = 1; k < 15; k++) if (weatherAt(x, z, m + k, () => CLIMATES.Woodlands).word !== w0) { if (k <= 10) found = { x, z, m, k }; break; }
    }
    assert.ok(found, 'the premise: a change within the quarter hour');
    const [nx, nz] = nativeFromField(found.x, found.z);
    const card = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: null, minuteNow: () => found.m, here: () => ({ x: 0, z: 0 }), tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null }).placeLine({ x: nx, z: nz });
    const want = `${Math.max(5, Math.round(found.k / 5) * 5)} min`;
    assert.ok(card === '' || card.includes(want) || /for the next/.test(card), `the change named to its minute (+${found.k}: "${card}")`);
    // the event
    const held = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: null, minuteNow: () => found.m, here: () => ({ x: nx, z: nz }), tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null, held: () => true });
    assert.equal(held.line(0), '', 'the sky held: nothing said');
    assert.equal(held.placeLine({ x: nx, z: nz }), '', 'nor on a card');
  } finally { setWeatherMapLaw(null); }
  assert.ok(fieldFromNative(0, 0));
});

test('AUDIT OW-REVISITED L3-12: a distance in the language\'s own figures - "2,4 km" in German, "2.4 km" in English (mutant: the figures English everywhere)', () => {
  assert.equal(kmWords(2400), '2.4 km');
  try {
    setLocale('de');
    assert.equal(kmWords(2400), '2,4 km');
    assert.equal(kmWords(12600), '13 km');
  } finally { setLocale('en'); }
});

test('AUDIT OW-REVISITED L3-3 / L3-8: A WALK RESUMED IS MEASURED AFRESH - the meter not kept through a stop (its stale mean read the way at a pace never made); A NEW JOURNEY IS NEVER TOLD THE LAST ONE\'S LINE - here while its first pass reads its way (mutants: the meter kept while stopped; the old line kept)', () => {
  setWeatherMapLaw(true);
  try {
    // frames of 0.9 s (under the meter's gap): stopped for n frames, then resumed - the first frame back reads here or
    // nothing (a cold meter), never a route pass begun on the stale mean (a pass reads FORECAST_SLICE places; here reads 25)
    for (const n of [1, 2, 3, 4]) {
      let reads = 0, t = 0, driving = true, x = 100000;
      const ground = Object.assign((w) => w, { lawAir: () => { reads++; return null; } });
      const trip = { natives: [nativeFromField(100000, 100000), nativeFromField(160000, 100000)], plan: { summary: { name: 'Ripwych' } } };
      const travel = { route: { i: 0, legs: [{ kind: 'road' }] }, state: { autopilot: { seg: 0 } }, wayPace: () => ({ fwd: 1, rate: 1, sea: false }), get paceNow() { return driving ? { fwd: 1, sea: false } : null; } };
      const fc = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground, minuteNow: () => 2_000_000 + t * 2, here: () => { const [nx, nz] = nativeFromField(x, 100000); return { x: nx, z: nz }; }, tvTrip: trip, tvTripLive: () => true, travel: () => travel });
      const frame = (dt, move) => { t += dt; if (move) x += 300 * dt; reads = 0; fc.line(t * 1000); return reads; };
      for (let f = 0; f < 8; f++) frame(0.9, true);   // driving: warm
      driving = false;
      for (let f = 0; f < n; f++) frame(0.9, false);
      driving = true;
      const first = frame(0.9, true);
      assert.ok(first === 0 || first >= 20, `stopped ${n} frames: the first frame back reads here or nothing (${first} reads)`);
    }
    // journey A's line, then journey B begun: never A's line
    let t = 0;
    const tripA = { natives: [nativeFromField(100000, 100000), nativeFromField(102000, 100000)], plan: { summary: { name: 'Ripwych' } } };
    const travel = { route: { i: 0, legs: [{ kind: 'road' }] }, state: { autopilot: { seg: 0 } }, wayPace: () => ({ fwd: 1, rate: 1, sea: false }), paceNow: { fwd: 1, sea: false } };
    const fc = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: null, minuteNow: () => 2_000_000 + t * 2, here: () => { const [nx, nz] = nativeFromField(100000 + 30 * t, 100000); return { x: nx, z: nz }; }, tvTrip: tripA, tvTripLive: () => true, travel: () => travel });
    let line = '';
    for (let f = 0; f <= 120; f++) { t = f / 30; line = fc.line(t * 1000); }
    assert.match(line, /Ripwych/, `journey A's line (${line})`);
    tripA.plan = { summary: { name: 'Glenpoint' } };   // a new journey, on a way of its own
    tripA.natives = [nativeFromField(100000, 100000), nativeFromField(170000, 100000)];
    const next = fc.line((121 / 30) * 1000);
    assert.doesNotMatch(next, /Ripwych/, `journey B begun: never A's line (${next})`);
  } finally { setWeatherMapLaw(null); }
});
