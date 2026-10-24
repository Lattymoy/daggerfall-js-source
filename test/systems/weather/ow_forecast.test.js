// OW-FORECAST (2026-10-19, the owner: "I like this idea, but do it right"; bible/06-Systems/Travel-View.md OW-FORECAST):
// THE WEATHER AHEAD, ON THE OVERWORLD - the way's while a journey runs, here while standing, a place's on its card; every
// word the world weather map's own for its place and the minute it names (TV4's rule: nothing invented). Pinned on the
// law (systems/weather/owForecast.js: the samples, the way's answer and its words, here's, the pace measured), on the
// host's half over the REAL map (scenes/overworldForecastHost.js: a traveller flown at a steady pace, the line it says,
// and the forecast COMING TRUE where and when it said), off the map's lane (nothing said), on the cards, and on the
// wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FORECAST_WORDS, FORECAST_NOTABLE, ROUTE_STEP_M, ROUTE_AHEAD_M, ROUTE_SAMPLES_MAX, HERE_HOURS, HERE_STEP_MIN, PACE_TAU_S, PACE_MIN_MPS,
  etaWords, kmWords, samplesAlong, routeForecast, routeLine, hereLine, paceMeter, wayMinuteAt,
} from '../../../src/systems/weather/owForecast.js';
import { createOverworldForecast, wayAhead, FORECAST_EVERY_MS } from '../../../src/scenes/overworldForecastHost.js';
import { weatherAt, PRIORITY } from '../../../src/systems/weather/weatherMap.js';
import { setWeatherMapLaw } from '../../../src/systems/weather/weatherSim.js';
import { nativeFromField } from '../../../src/systems/weather/weatherField.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { createTravelViewMarks } from '../../../src/scenes/travelViewMarks.js';
import { hostText } from '../../hostText.mjs';

test('OW-FORECAST the words: every word a traveller is told of said as a traveller says it - what falls and what blinds is met, the rest is sky (PIN MOVED, AUDIT OW-REVISITED L3-11: the sky\'s own words were never said, and are gone); the time to the nearest five minutes under the hour, in hours past it; the distance in tenths under ten kilometres, in the language\'s figures (mutants: a word unsaid; the sky met; the rounding)', () => {
  for (const w of PRIORITY.filter((w2) => FORECAST_NOTABLE.has(w2))) assert.ok(FORECAST_WORDS[w], `the map's ${w} said`);
  assert.deepEqual(Object.keys(FORECAST_WORDS).sort(), [...FORECAST_NOTABLE].sort(), 'the words told of: what is met, no more');
  assert.equal(FORECAST_WORDS.thunder, 'Thunderstorm');
  assert.deepEqual([...FORECAST_NOTABLE].sort(), ['fog', 'rain', 'sandstorm', 'snow', 'thunder']);
  assert.equal(etaWords(0), 'now');
  assert.equal(etaWords(3), 'in 5 min');
  assert.equal(etaWords(22), 'in 20 min');
  assert.equal(etaWords(58), 'in about 1 h');
  assert.equal(etaWords(150), 'in about 3 h');
  assert.equal(kmWords(2400), '2.4 km');
  assert.equal(kmWords(12600), '13 km');
});

test('OW-FORECAST the samples: every ROUTE_STEP_M along the way, round its corners, out to ROUTE_AHEAD_M - never the traveller\'s own place - and the way\'s end when it lies within (the journey\'s end only where the way ran to it); at most ROUTE_SAMPLES_MAX (PIN MOVED, AUDIT OW-REVISITED L3-5: 400 m, a hundred places - a fog bank under a kilometre slipped between the 1.6 km ones) (mutants: the corner cut; the end dropped; the reach unheld; no cap; a way cut short called whole)', () => {
  assert.deepEqual([ROUTE_STEP_M, ROUTE_AHEAD_M, ROUTE_SAMPLES_MAX], [400, 40000, 101]);
  assert.deepEqual(samplesAlong([[0, 0], [3000, 0], [3000, 2000]], 1600), [
    { x: 1600, z: 0, d: 1600, end: false }, { x: 3000, z: 200, d: 3200, end: false }, { x: 3000, z: 1800, d: 4800, end: false }, { x: 3000, z: 2000, d: 5000, end: true },
  ]);
  assert.equal(samplesAlong([[0, 0], [3000, 0]], 1600, 40000, 101, false).at(-1).end, false, 'a way read only so far: its end is not the journey\'s');
  const long = samplesAlong([[0, 0], [100000, 0]]);
  assert.equal(long.length, 100, 'out to the reach: 40 km / 400 m');
  assert.ok(long.every((s) => !s.end && s.d <= ROUTE_AHEAD_M), 'the end past the reach: not asked');
  assert.equal(samplesAlong([[0, 0], [100000, 0]], 100).length, ROUTE_SAMPLES_MAX, 'the cap');
  // AUDIT OW-REVISITED L3-1: the minutes along a way of stretches each at its own minutes a metre
  const along = wayMinuteAt([[0, 0], [1000, 0], [1000, 2000]], [0.5, 2]);
  assert.deepEqual([along(0), along(500), along(1000), along(2000), along(3000), along(3500)], [0, 250, 500, 2500, 4500, 5500], 'each stretch at its own; past the end at the last');
  assert.deepEqual(samplesAlong([[0, 0]]), [], 'no way');
});

test('OW-FORECAST the way\'s answer: the first change a traveller meets (something met ahead, or what falls now giving out), each sample asked at the minute they reach it; else the same the whole way, to its end when it was read - in words (mutants: asked at the minute now; the clearing unsaid; the end unsaid; a sky change met)', () => {
  const samples = samplesAlong([[0, 0], [10000, 0]], 1600);
  const at = [];
  const ask = (wordAt, nowWord = 'sunny') => routeForecast(samples, { nowWord, now: 100, minuteAt: (d) => 100 + d / 100, wordAt: (x, z, m) => { at.push(m); return wordAt(x, z, m); } });
  const ahead = ask((x) => (x > 4000 ? 'rain' : 'sunny'));
  assert.deepEqual(ahead, { kind: 'ahead', word: 'rain', d: 4800, min: 48, all: false });
  assert.deepEqual(at.slice(0, 3), [116, 132, 148], 'each place at the minute it is reached');
  assert.equal(routeLine(ahead), 'Rain ahead - 4.8 km, in 50 min');
  const clearing = routeForecast(samplesAlong([[0, 0], [10000, 0]], 1600), { nowWord: 'thunder', now: 100, minuteAt: (d) => 100 + d / 100, wordAt: (x) => (x > 6000 ? 'cloudy' : 'thunder') });
  assert.equal(routeLine(clearing), 'Thunderstorm clears 6.4 km ahead');
  const sky = ask((x) => (x > 2000 ? 'overcast' : 'sunny'));
  assert.equal(sky.kind, 'steady', 'the sky\'s look changing is no news');
  assert.equal(routeLine(sky), 'Fair weather all the way', 'the way\'s end read: all the way');
  assert.equal(routeLine({ ...sky, all: false }), 'Fair weather ahead', 'its end past the reach: ahead');
  const arrive = routeForecast(samples, { nowWord: 'fog', now: 0, minuteAt: (d) => d, wordAt: () => 'fog' });
  assert.equal(routeLine(arrive, 'Daggerfall'), 'Fog all the way to Daggerfall');
  assert.equal(routeLine(arrive), 'Fog all the way');
  const atEnd = routeForecast([{ x: 0, z: 0, d: 500, end: true }], { nowWord: 'sunny', now: 0, minuteAt: () => 30, wordAt: () => 'snow' });
  assert.equal(routeLine(atEnd, 'Daggerfall'), 'Snow ahead - 0.5 km, in 30 min', 'met at the end itself: met');
  assert.equal(routeLine({ kind: 'steady', word: 'sunny', d: 5000, min: 0, all: true }, 'Daggerfall'), 'Fair weather all the way to Daggerfall');
  assert.equal(routeLine({ kind: 'steady', word: 'snow', d: 12000, min: 0, all: false }), 'Snow for the next 12 km');
});

test('OW-FORECAST here: what falls now and when it clears (or turns), what comes and when, or fair for the hours read (mutants: the clearing unread; the coming unread)', () => {
  assert.equal(HERE_HOURS, 6); assert.equal(HERE_STEP_MIN, 15);
  assert.equal(hereLine({ at: 0, now: { word: 'rain' }, steps: [{ at: 15, word: 'rain' }, { at: 90, word: 'cloudy' }] }), 'Rain - clearing in about 2 h');
  assert.equal(hereLine({ at: 0, now: { word: 'rain' }, steps: [{ at: 30, word: 'snow' }] }), 'Rain - snow in 30 min', 'turning to another');
  assert.equal(hereLine({ at: 0, now: { word: 'rain' }, steps: [{ at: 15, word: 'rain' }] }), 'Rain for the next 6 h');
  assert.equal(hereLine({ at: 0, now: { word: 'sunny' }, steps: [{ at: 15, word: 'cloudy' }, { at: 45, word: 'thunder' }] }), 'Thunderstorm in 45 min');
  assert.equal(hereLine({ at: 0, now: { word: 'cloudy' }, steps: [{ at: 15, word: 'overcast' }] }), 'Fair for the next 6 h');
  assert.equal(hereLine(null), '');
});

test('OW-FORECAST the pace, measured: field metres a real second and the weather\'s clock a real second, the first measure taken whole and then an exponential mean; nothing told until it has warmed, nor at a stand; a jump starts it again (mutants: a mean from nothing; the jump kept; told at a stand)', () => {
  assert.equal(PACE_TAU_S, 3); assert.equal(PACE_MIN_MPS, 0.5);
  const p = paceMeter();
  for (let i = 0; i <= 20; i++) p.step(i * 0.1, i * 2, 0, 1000 + i * 0.5);   // 20 m a real second, 5 game minutes a real second, two seconds of it
  assert.ok(Math.abs(p.v - 20) < 1e-9 && Math.abs(p.r - 5) < 1e-9, `a steady pace read whole (${p.v}, ${p.r})`);
  assert.ok(Math.abs(p.minutesFor(1000) - 250) < 1e-6, 'a kilometre at 20 m/s: 50 s, 250 game minutes');
  const cold = paceMeter();
  cold.step(0, 0, 0, 0); cold.step(0.5, 10, 0, 1);
  assert.equal(cold.minutesFor(1000), null, 'not warmed yet');
  const still = paceMeter();
  for (let i = 0; i <= 30; i++) still.step(i * 0.1, 0, 0, i);
  assert.equal(still.minutesFor(1000), null, 'standing: no minutes to give');
  p.step(2.1, 1e7, 0, 1011);
  assert.equal(p.v, 0, 'a jump: the meter again');
});

test('OW-FORECAST the way still to walk: the traveller, a town\'s streets still ahead (AUDIT OW-REVISITED L3-2 / L6-1: from the run the walk is on - the walked ones ran its distances back through the town), a rejoin, then each leg\'s point from the one being walked - each stretch\'s own pace, the way cut where the ground changes (a sea leg\'s pace is the ship\'s) - and its end\'s name (mutants: the legs behind kept; the streets left out; the walked streets kept; the sea read at the walk\'s pace)', () => {
  const trip = { natives: [[0, 0], [10, 0], [20, 0], [30, 0]], plan: { summary: { name: 'Daggerfall' } } };
  const pace = (of) => ({ fwd: of === 'street' ? 1 : 0.8, rate: of === 'street' ? 5 : 100, sea: of === 2, of });
  // the drawn points: the start, then where each leg aims - leg 1 walked, its own aim (n[2]) still ahead
  const w = wayAhead({ x: 5, z: 1 }, trip, { i: 1, legs: [{}, {}, {}], street: { pts: [{ x: 4, z: 4 }, { x: 6, z: 2 }] }, join: { x: 7, z: 0 } }, 1, pace);
  assert.deepEqual(w.points, [[5, 1], [6, 2], [7, 0], [20, 0]], 'the walked street dropped; cut before the sea leg');
  assert.deepEqual(w.paces.map((p) => p.of), ['street', 'join', 1], 'each stretch its own');
  assert.equal(w.whole, false, 'cut: not the journey\'s end');
  assert.equal(w.dest, 'Daggerfall');
  const all = wayAhead({ x: 5, z: 1 }, trip, { i: 0, legs: [{}, {}, {}] }, 0, () => ({ fwd: 1, rate: 1, sea: false }));
  assert.deepEqual([all.points, all.whole], [[[5, 1], [10, 0], [20, 0], [30, 0]], true]);
  assert.equal(wayAhead({ x: 5, z: 1 }, trip, { i: 0, legs: [{}, {}, {}] }, 0, () => ({ fwd: 1, rate: 1, sea: true }), true).whole, true, 'a sailor\'s sea read');
  assert.equal(wayAhead({ x: 0, z: 0 }, trip, null, 0, pace), null);
});

/** A traveller flown east at a steady pace over the REAL map - `v` field metres a real second, the clock `r` game minutes a
 *  real second - its line read each frame. */
function fly(x0, z0, m0, { v = 300, r = 2, seconds = 4, fps = 30 } = {}) {
  const climateAt = () => CLIMATES.Woodlands;
  let t = 0;
  const pos = () => nativeFromField(x0 + v * t, z0);
  const trip = { natives: [nativeFromField(x0, z0), nativeFromField(x0 + 60000, z0)], plan: { summary: { name: 'Ripwych' } }, line: '' };
  const fc = createOverworldForecast({
    climateAt, ground: null, minuteNow: () => m0 + r * t, here: () => { const [x, z] = pos(); return { x, z }; },
    tvTrip: trip, tvTripLive: () => true, travel: () => ({ route: { i: 0, legs: [{ kind: 'road' }] }, wayPace: () => ({ fwd: 1, rate: 1, sea: false }), paceNow: { fwd: 1, sea: false } }),
  });
  let line = '';
  for (let f = 0; f <= seconds * fps; f++) { t = f / fps; line = fc.line(t * 1000); }   // worked out at 0, 2 and 4 s (FORECAST_EVERY_MS)
  return { line, t, fc };
}

test('OW-FORECAST over the weather map: a traveller flown at a steady pace through the host is told the first weather they will meet - the map\'s own answer at the pace measured (PIN MOVED, AUDIT OW-REVISITED L3-6 / L6-5: a woodland map, never the real one it claimed, and its "comes true" re-asked the question the law had asked - the real map, and a walk the host never composed, are audit_owrevisited_forecast\'s L3-1); standing, here\'s next hours; off the map\'s lane, nothing (mutants: the pace unread; the minute now asked; the lane unread)', () => {
  setWeatherMapLaw(true);
  try {
    let found = null;
    for (let i = 0; i < 400 && !found; i++) {
      const x0 = 60000 + (i % 20) * 33000, z0 = 50000 + Math.floor(i / 20) * 15000, m0 = 2_000_000 + i * 977;
      const v = 300, r = 2;
      const now = m0 + r * 4, here0 = x0 + v * 4;
      const samples = samplesAlong([[here0, z0], [x0 + 60000, z0]]);   // the pass begun at 4 s, read a few places a frame
      const nowWord = weatherAt(here0, z0, Math.floor(now), () => CLIMATES.Woodlands).word;
      const want = routeForecast(samples, { nowWord, now, minuteAt: (d) => now + (d / v) * r, wordAt: (x, z, m) => weatherAt(x, z, Math.floor(m), () => CLIMATES.Woodlands).word });
      if (want.kind === 'ahead') found = { x0, z0, m0, v, r, want, now };
    }
    assert.ok(found, 'a road on the map with weather ahead');
    const { line } = fly(found.x0, found.z0, found.m0, { v: found.v, r: found.r, seconds: 6 });
    assert.equal(line, routeLine(found.want), 'the line the map\'s own answer, at the pace measured');
    // standing: here
    const still = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: null, minuteNow: () => found.m0, here: () => { const [x, z] = nativeFromField(found.x0, found.z0); return { x, z }; }, tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null });
    const hereSaid = still.line(10_000);
    assert.ok(hereSaid && !/ahead/.test(hereSaid), `standing: here's hours (${hereSaid})`);
    const [px, pz] = nativeFromField(found.x0, found.z0);
    assert.equal(still.placeLine({ x: px, z: pz }), hereSaid, 'a place\'s card: the same law at its middle');
  } finally { setWeatherMapLaw(false); }
  const off = createOverworldForecast({ climateAt: () => CLIMATES.Woodlands, ground: null, minuteNow: () => 0, here: () => ({ x: 0, z: 0 }), tvTrip: { natives: [] }, tvTripLive: () => false, travel: () => null });
  assert.equal(off.line(5000), '', 'off the map\'s lane: nothing said');
  assert.equal(off.placeLine({ x: 0, z: 0 }), '');
  setWeatherMapLaw(null);
});

test('OW-FORECAST a place\'s card: its own next hours first, then its town\'s card under it - the weather alone where the town has none; none said, the town\'s card as it was (mutants: the weather unsaid; the town\'s card dropped; the weather last)', () => {
  let sky = 'Rain - clearing in about 2 h';
  const host = {
    TV_PLACE_LIFT: 12, _bandChase: new Map(), _bandSpent: new Set(), _hiddenPeers: new Set(), _lodesSensed: new Set(), _peerMapPoses: new Map(),
    _townOfMapId: new Map(), _tvBountyHold: new Map(), _tvLodeHold: new Map(), _tvPartyHold: new Map(), _tvVendorHold: {}, _tvWaypointHold: new Map(),
    _veils: new Set(), _wildStrangerIds: new Set(), bandMake: () => null, bandNowMs: () => 0, bandPlace: () => ({ x: 0, z: 0 }),
    cam: { pos: [0, 0, 0] }, carriageTown: () => false, csaOn: () => false, exteriorFoes: { foes: [] }, livingHideoutsHostOf: () => ({ marks: () => [] }),
    lodeSense: () => false, lodeWords: {}, motherlodeBook: { sensedAll: () => [] }, myGuildTag: () => null, params: new URLSearchParams(),
    owForecast: { placeLine: () => sky },
    player: { pos: [0, 0, 0] }, playerTravelPixel: () => ({ x: 0, y: 0 }), questPixel: () => null, seaRaidPeerChase: () => null,
    townEcon: { tipFnAt: (id) => (id === 7 ? () => ({ title: 'Ripwych', lines: ['Prosperous', 'Bread 3 gp'] }) : null) },
    state: { worldCoords: () => ({ x: 0, z: 0 }) },
    travelViewBands: () => [], travelViewCamps: () => [], travelViewDungeons: () => [], travelViewRaiders: () => [], travellerBook: { live: () => [] },
    travelViewFarPlaces: () => [], travelViewPlaces: () => [{ key: 'place:7', summary: { name: 'Ripwych', mapId: 7, loc: {} }, x: 10, z: 20 }, { key: 'place:8', summary: { name: 'Glenpoint', mapId: 8, loc: {} }, x: 30, z: 40 }],
    tvRaid: { chase: new Map(), spent: new Set() }, tvSceneKept: (h, x, z, lift) => [x, lift, z], tvTrip: {}, tvTripLive: () => false, walkMode: true, wildCampKeys: () => new Set(), wildHidesPlayer: () => false,
  };
  const { travelViewMarks } = createTravelViewMarks(host);
  const plates = travelViewMarks().filter((m) => m.key.startsWith('place:'));
  assert.deepEqual(plates[0].tip(), { title: 'Ripwych', lines: ['Weather: Rain - clearing in about 2 h', 'Prosperous', 'Bread 3 gp'] }, 'the weather first, the town\'s card under it');
  assert.deepEqual(plates[1].tip(), { title: 'Glenpoint', lines: ['Weather: Rain - clearing in about 2 h'] }, 'the weather alone');
  sky = '';
  assert.deepEqual(plates[0].tip(), { title: 'Ripwych', lines: ['Prosperous', 'Bread 3 gp'] }, 'none said: the town\'s card as it was');
  assert.equal(plates[1].tip(), null);
});

test('OW-FORECAST the wiring: the host makes it over its own map, clock, place and route and hands it to the marks; the view says its line under the journey\'s, a line of its own in the block, shown only when it says something (mutants: the line unasked; the HUD line never shown)', () => {
  const w = hostText('src/scenes/world.js');
  // PIN MOVED (AUDIT OW-REVISITED L3-1 / L3-4 / L3-14): handed the traveller's height, Travel Options whole (its stretches'
  // paces), the shared clock, the clock's rate and the event that holds the sky
  assert.match(w, /const owForecast = createOverworldForecast\(\{ climateAt, ground: mapGroundHere, minuteNow: \(\) => playerTicker\.classicMinutes, here: \(\) => state\.worldCoords\(player\.pos\), alt: \(\) => fieldXZ\(\)\[2\], tvTrip, tvTripLive, travel: \(\) => travelOptions, shared: sharedClockOn, rateNow: worldTimeScale, held: \(\) => sunbaby\.on \}\);/);
  assert.match(w, /createTravelViewMarks\(\{[^]*?myGuildTag, owForecast, params,/);
  assert.match(w, /sky: \(\) => owForecast\.line\(performance\.now\(\)\),/);
  assert.match(readFileSync(new URL('../../../src/scenes/travelView.js', import.meta.url), 'utf8'), /sky: deps\.sky\?\.\(\) \?\? '',/);
  const hud = readFileSync(new URL('../../../src/ui/travel/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /text\.append\(title, where, trip, sky, hint\);/);
  assert.match(hud, /put\(parts\.sky, 'sky', f\.sky \?\? ''\);[^\n]*\n\s*style\(parts\.sky, 'sky-d', 'display', f\.sky \? '' : 'none'\);/);
  assert.match(hud, /const words = `\$\{last\.where\}\|\$\{last\.hint\}\|\$\{last\.trip\}\|\$\{last\.sky\}`;/, 'the bar measured again when its weather line comes or goes (AUDIT OW-REVISITED L3-6)');
});
